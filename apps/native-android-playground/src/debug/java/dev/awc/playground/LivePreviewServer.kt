package dev.awc.playground

import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedInputStream
import java.io.BufferedOutputStream
import java.io.Closeable
import java.net.InetAddress
import java.net.InetSocketAddress
import java.net.ServerSocket
import java.net.Socket
import java.nio.charset.StandardCharsets
import java.security.MessageDigest
import java.util.concurrent.ArrayBlockingQueue
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors
import java.util.concurrent.ThreadPoolExecutor
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

/** Minimal bounded HTTP transport for the debug host; no routes execute shell/system input. */
internal class LivePreviewServer(
    token: String,
    private val command: (JSONObject) -> JSONObject,
    private val openStream: (Stream) -> Unit,
) : Closeable {
    private val bearer = "Bearer $token".toByteArray(StandardCharsets.UTF_8)
    private val alive = AtomicBoolean(true)
    private val listener = ServerSocket().apply {
        reuseAddress = true
        bind(InetSocketAddress(InetAddress.getByName("127.0.0.1"), 39091), 4)
    }
    private val sockets = ConcurrentHashMap.newKeySet<Socket>()
    private val clients = ThreadPoolExecutor(4, 4, 0, TimeUnit.MILLISECONDS, ArrayBlockingQueue(4), { runnable ->
        Thread(runnable, "AWC-native-http").apply { isDaemon = true }
    })
    private val encoder = Executors.newSingleThreadExecutor { runnable -> Thread(runnable, "AWC-native-png").apply { isDaemon = true } }

    fun start() {
        Thread({
            while (alive.get()) {
                val socket = try { listener.accept() } catch (_: Exception) { break }
                socket.soTimeout = 5000
                socket.tcpNoDelay = true
                sockets.add(socket)
                try { clients.execute { serve(socket) } } catch (_: Exception) { sockets.remove(socket); socket.close() }
            }
        }, "AWC-native-listener").apply { isDaemon = true; start() }
    }

    override fun close() {
        if (!alive.getAndSet(false)) return
        runCatching { listener.close() }
        sockets.forEach { runCatching { it.close() } }
        sockets.clear()
        clients.shutdownNow()
        // The bounded encoder drains its one submitted bitmap so its finally
        // block can recycle it even when the Activity closes mid-compression.
        encoder.shutdown()
    }

    private fun serve(socket: Socket) {
        var reqInfo = "?"
        try {
            val input = BufferedInputStream(socket.getInputStream())
            val output = BufferedOutputStream(socket.getOutputStream())
            var headerBytes = 0
            fun line(): String {
                val bytes = ArrayList<Byte>()
                while (true) {
                    val next = input.read()
                    check(next >= 0) { "Incomplete HTTP request." }
                    headerBytes++
                    require(headerBytes <= 16_384) { "HTTP headers are too large." }
                    if (next == 10) break
                    bytes.add(next.toByte())
                }
                return bytes.toByteArray().toString(StandardCharsets.US_ASCII).trimEnd('\r')
            }
            val request = line().split(' ')
            require(request.size == 3 && request[2] == "HTTP/1.1") { "Unsupported HTTP request." }
            val headers = mutableMapOf<String, String>()
            while (true) {
                val header = line()
                if (header.isEmpty()) break
                val colon = header.indexOf(':')
                require(colon > 0) { "Malformed HTTP header." }
                val name = header.substring(0, colon).lowercase()
                require(name !in headers) { "Duplicate HTTP header." }
                headers[name] = header.substring(colon + 1).trim()
            }
            val authenticated = MessageDigest.isEqual(headers["authorization"].orEmpty().toByteArray(StandardCharsets.UTF_8), bearer)
            if (!authenticated) { reply(output, 401, JSONObject().put("error", "Native session token required.")); return }
            require("transfer-encoding" !in headers) { "Chunked request bodies are not supported." }
            val length = headers["content-length"]?.toIntOrNull() ?: 0
            require(length in 0..131_072) { "Native request body exceeds the supported limit." }
            val body = ByteArray(length)
            var offset = 0
            while (offset < length) {
                val count = input.read(body, offset, length - offset)
                check(count > 0) { "Incomplete native request body." }
                offset += count
            }
            reqInfo = "${request[0]} ${request[1]} len=$length"
            when (request[0] to request[1]) {
                "GET" to "/health" -> reply(output, 200, JSONObject().put("ready", true).put("platform", "android")
                    .put("renderer", "Jetpack Compose").put("protocol", 1))
                "POST" to "/command" -> {
                    require(length > 0) { "Native command requires JSON." }
                    val cmdJson = JSONObject(body.toString(StandardCharsets.UTF_8))
                    val result = command(cmdJson)
                    reply(output, 200, result)
                }
                "GET" to "/stream" -> {
                    val stream = Stream(socket, output, encoder)
                    openStream(stream)
                    stream.write()
                }
                else -> reply(output, 404, JSONObject().put("error", "Unknown native endpoint."))
            }
        } catch (error: Exception) {
            // s7-11-01: a stage that outlives its 5 s wait (UI thread or PixelCopy starved by host load) throws a TimeoutException
            // with no message; it used to surface as 400 "Native request failed.", as if the request were invalid. It is a server-side
            // timeout: answer 504 and name the request, so a slow host can no longer be read as a bad request.
            val timedOut = generateSequence<Throwable>(error) { it.cause }.any { it is java.util.concurrent.TimeoutException }
            if (timedOut) android.util.Log.e("AWC400", "timeout req=$reqInfo thread=${Thread.currentThread().name}", error)
            runCatching { reply(BufferedOutputStream(socket.getOutputStream()), if (timedOut) 504 else 400, JSONObject().put("error", if (timedOut) "Native preview did not answer within 5 s ($reqInfo)." else (error.cause?.message ?: error.message ?: "Native request failed."))) }
        } finally {
            sockets.remove(socket)
            runCatching { socket.close() }
        }
    }

    private fun reply(output: BufferedOutputStream, status: Int, value: JSONObject) {
        val bytes = value.toString().toByteArray(StandardCharsets.UTF_8)
        output.write(("HTTP/1.1 $status ${when (status) { 200 -> "OK"; 504 -> "Gateway Timeout"; else -> "Error" }}\r\nContent-Type: application/json\r\n" +
            "Content-Length: ${bytes.size}\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n").toByteArray(StandardCharsets.US_ASCII))
        output.write(bytes)
        output.flush()
    }

    /** One unsent frame bounds memory and prevents a slow reader from building animation lag. */
    class Stream internal constructor(
        private val socket: Socket,
        private val output: BufferedOutputStream,
        private val encoder: java.util.concurrent.ExecutorService,
    ) : Closeable {
        private val monitor = Object()
        @Volatile private var active = true
        private var latest: JSONObject? = null
        val isOpen: Boolean get() = active && !socket.isClosed

        fun encode(block: () -> Unit): Boolean {
            return try { encoder.execute(block); true } catch (_: Exception) { close(); false }
        }

        fun offer(frame: JSONObject): Boolean = synchronized(monitor) {
            if (!active) return@synchronized false
            val previousEvents = latest?.optJSONArray("events")
            val nextEvents = frame.optJSONArray("events") ?: JSONArray()
            if (previousEvents != null && previousEvents.length() > 0) {
                val combined = JSONArray()
                val all = (0 until previousEvents.length()).map { previousEvents.get(it) } + (0 until nextEvents.length()).map { nextEvents.get(it) }
                if (all.size > 256) { close(); return@synchronized false }
                all.forEach(combined::put)
                frame.put("events", combined)
            }
            latest = frame
            monitor.notifyAll()
            true
        }

        fun fail(message: String) { offer(JSONObject().put("error", message).put("events", JSONArray())) }

        internal fun write() {
            output.write(("HTTP/1.1 200 OK\r\nContent-Type: application/x-ndjson\r\nCache-Control: no-store\r\n" +
                "Connection: close\r\nX-Content-Type-Options: nosniff\r\n\r\n").toByteArray(StandardCharsets.US_ASCII))
            output.flush()
            try {
                while (isOpen) {
                    val frame = synchronized(monitor) {
                        while (active && latest == null) monitor.wait(1000)
                        latest.also { latest = null }
                    } ?: continue
                    val bytes = (frame.toString() + "\n").toByteArray(StandardCharsets.UTF_8)
                    check(bytes.size <= 16 * 1024 * 1024) { "Native frame exceeds the bounded transport size." }
                    output.write(bytes)
                    output.flush()
                }
            } finally { close() }
        }

        override fun close() {
            synchronized(monitor) { active = false; latest = null; monitor.notifyAll() }
            runCatching { socket.close() }
        }
    }
}
