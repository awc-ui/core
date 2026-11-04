package dev.awc.playground

import android.content.Intent
import android.graphics.BitmapFactory
import android.util.Base64
import androidx.test.core.app.ActivityScenario
import androidx.test.core.app.ApplicationProvider
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import java.net.HttpURLConnection
import java.net.URL
import java.util.UUID
import kotlin.math.abs

/**
 * The debug live host presents md-dialog, md-bottom-sheet and md-side-sheet in the preview's own viewport through
 * AWCModalScope: geometry against the source, typed appearance from the Studio wire values, retained updates,
 * correlated lifecycle methods, window-level Escape, touch on the scrim and the back control, and the source events.
 */
class LivePreviewModalHostTest {
    @Test fun dialogPresentsInTheViewportWithMethodsUpdatesAppearanceAndDismissal() = withHost { token, command ->
        var frame = command(configure("md-dialog", 640, 480, JSONObject().put("open", true).put("headline", "Discard draft?")))
        assertEquals(640.0, frame.getDouble("logicalWidth"), .01); assertEquals(480.0, frame.getDouble("logicalHeight"), .01)
        val opened = events(frame).toMutableList()
        Thread.sleep(450); frame = command(JSONObject().put("command", "frame")); opened += events(frame)
        var c = box(frame, "container"); val s = box(frame, "scrim")
        assertEquals("Initially open emits one mdOpen: $opened", listOf("mdOpen"), opened.map { it.getString("name") })
        near(560.0, c.w, "basic dialog width"); near(320.0, c.x + c.w / 2, "centred x"); near(240.0, c.y + c.h / 2, "centred y")
        near(0.0, s.x, "scrim x"); near(0.0, s.y, "scrim y"); near(640.0, s.w, "scrim width"); near(480.0, s.h, "scrim height")
        // Window-level Escape: mdCancel then mdClose; the surface leaves after its exit motion.
        val escaped = events(command(JSONObject().put("command", "key").put("key", "Escape"))).toMutableList()
        Thread.sleep(450); frame = command(JSONObject().put("command", "frame")); escaped += events(frame)
        assertEquals(listOf("mdCancel", "mdClose"), escaped.map { it.getString("name") })
        assertNull("The closed dialog leaves", find(frame, "container"))
        // Correlated lifecycle methods through AWCDialogController.
        val shown = mutableListOf<JSONObject>()
        assertEquals("accepted", command(method("show", "d-show")).getJSONObject("methodCall").getString("status"))
        assertEquals("fulfilled", result(command, "d-show", shown))
        Thread.sleep(450); frame = command(JSONObject().put("command", "frame")); shown += events(frame)
        assertEquals(listOf("mdOpen"), shown.map { it.getString("name") }); assertNotNull(find(frame, "container"))
        val closed = mutableListOf<JSONObject>()
        command(method("whenClosed", "d-wait"))
        assertEquals("whenClosed pends while open", "pending", poll(command, "d-wait", closed))
        command(method("close", "d-close")); val closedAt = System.currentTimeMillis()
        assertEquals("fulfilled", result(command, "d-close", closed))
        assertEquals("fulfilled", result(command, "d-wait", closed))
        assertTrue("whenClosed waits for the exit motion", System.currentTimeMillis() - closedAt >= 150)
        assertEquals("close() emits mdClose only", listOf("mdClose"), closed.map { it.getString("name") })
        // Retained updates keep the instance: a fullscreen dialog fills the viewport without a scrim.
        val updated = events(command(JSONObject().put("command", "update").put("properties", JSONObject().put("open", true).put("fullscreen", true).put("headline", "Edit profile")))).toMutableList()
        Thread.sleep(450); frame = command(JSONObject().put("command", "frame")); updated += events(frame)
        c = box(frame, "container")
        near(0.0, c.x, "fullscreen x"); near(0.0, c.y, "fullscreen y"); near(640.0, c.w, "fullscreen width"); near(480.0, c.h, "fullscreen height")
        assertNull("A fullscreen dialog has no scrim", find(frame, "scrim"))
        assertEquals(listOf("mdOpen"), updated.map { it.getString("name") })
        for (bad in listOf(JSONObject().put("fullscreen", "yes"), JSONObject().put("density", -5), JSONObject().put("variant", "modal"), JSONObject().put("headline", "x".repeat(4097)))) {
            val response = request("POST", "/command", token, JSONObject().put("command", "update").put("properties", bad))
            assertTrue("Invalid dialog patch $bad", response.first >= 400 || response.second.has("error"))
        }
    }

    @Test fun dialogTypedAppearanceAndScrimTouch() = withHost { _, command ->
        val appearance = JSONObject().put("containerColor", "#123456")
        var frame = command(configure("md-dialog", 640, 480, JSONObject().put("open", true).put("headline", "Styled"))
            .put("dialogAppearanceDefaults", JSONObject().put("containerColor", "#654321")).put("dialogAppearance", appearance))
        Thread.sleep(450); frame = command(JSONObject().put("command", "frame"))
        val c = box(frame, "container")
        val image = decode(frame); val scale = image.width / 640.0
        val pixel = image.getPixel(((c.x + 6) * scale).toInt(), ((c.y + c.h / 2) * scale).toInt()); image.recycle()
        assertEquals("Local container color wins over the subtree default", 0x123456, pixel and 0xFFFFFF)
        val dismissed = mutableListOf<JSONObject>()
        for (phase in listOf("down", "up")) dismissed += events(command(JSONObject().put("command", "pointer").put("phase", phase).put("x", 12).put("y", 12)))
        Thread.sleep(450); dismissed += events(command(JSONObject().put("command", "frame")))
        assertEquals("A touch on the enabled scrim dismisses", listOf("mdCancel", "mdClose"), dismissed.map { it.getString("name") })
    }

    @Test fun bottomSheetGeometryVariantsAppearanceAndMethods() = withHost { token, command ->
        var frame = command(configure("md-bottom-sheet", 800, 480, JSONObject().put("open", true).put("headline", "Share")))
        Thread.sleep(600); frame = command(JSONObject().put("command", "frame"))
        var c = box(frame, "container")
        near(640.0, c.w, "standard width"); near(400.0, c.x + c.w / 2, "centred"); near(480.0, c.y + c.h, "bottom edge")
        assertNotNull(find(frame, "scrim"))
        command(JSONObject().put("command", "update").put("properties", JSONObject().put("variant", "detached")))
        Thread.sleep(600); frame = command(JSONObject().put("command", "frame")); c = box(frame, "container")
        near(464.0, c.y + c.h, "detached sheet keeps the source 16 margin ${nodes(frame).map { it.optString("name") + it.optJSONObject("bounds") }}")
        for (bad in listOf(JSONObject().put("variant", "modal"), JSONObject().put("headlineAlign", "left"), JSONObject().put("side", "start"))) {
            val response = request("POST", "/command", token, JSONObject().put("command", "update").put("properties", bad))
            assertTrue("Invalid bottom-sheet patch $bad", response.first >= 400 || response.second.has("error"))
        }
        val closed = mutableListOf<JSONObject>()
        command(method("close", "b-close")); assertEquals("fulfilled", result(command, "b-close", closed))
        Thread.sleep(600); frame = command(JSONObject().put("command", "frame")); closed += events(frame)
        assertEquals(listOf("mdClose"), closed.map { it.getString("name") }); assertNull(find(frame, "container"))
        val noWait = request("POST", "/command", token, method("whenClosed", "b-wait"))
        assertTrue("The source bottom sheet has no whenClosed()", noWait.first >= 400 || noWait.second.has("error"))
    }

    @Test fun bottomSheetTypedMaxWidth() = withHost { _, command ->
        command(configure("md-bottom-sheet", 800, 480, JSONObject().put("open", true).put("headline", "Share"))
            .put("bottomSheetAppearance", JSONObject().put("maxWidth", JSONObject().put("points", 20).put("fraction", .5))))
        Thread.sleep(600); val c = box(command(JSONObject().put("command", "frame")), "container")
        near(420.0, c.w, "typed max width calc(50% + 20px) against the viewport"); near(400.0, c.x + c.w / 2, "still centred")
    }

    @Test fun sideSheetEdgesBackScrimAndTypedWidth() = withHost { token, command ->
        var frame = command(configure("md-side-sheet", 800, 480, JSONObject().put("open", true).put("variant", "modal").put("headline", "Filters").put("showBack", true)))
        Thread.sleep(600); frame = command(JSONObject().put("command", "frame"))
        var c = box(frame, "container")
        near(800.0, c.x + c.w, "end edge"); near(0.0, c.y, "top"); near(480.0, c.h, "full height")
        assertNotNull(find(frame, "scrim"))
        val back = box(frame, "back")
        val backed = mutableListOf<JSONObject>()
        for (phase in listOf("down", "up")) backed += events(command(JSONObject().put("command", "pointer").put("phase", phase).put("x", back.x + back.w / 2).put("y", back.y + back.h / 2)))
        Thread.sleep(150); backed += events(command(JSONObject().put("command", "frame")))
        assertTrue("The back control emits mdBack: $backed", backed.any { it.getString("name") == "mdBack" })
        command(JSONObject().put("command", "update").put("properties", JSONObject().put("side", "start")))
        Thread.sleep(600); c = box(command(JSONObject().put("command", "frame")), "container")
        near(0.0, c.x, "start edge after a retained update")
        for (bad in listOf(JSONObject().put("variant", "detached"), JSONObject().put("side", "left"), JSONObject().put("showBack", "true"))) {
            val response = request("POST", "/command", token, JSONObject().put("command", "update").put("properties", bad))
            assertTrue("Invalid side-sheet patch $bad", response.first >= 400 || response.second.has("error"))
        }
        val dismissed = mutableListOf<JSONObject>()
        command(method("whenClosed", "s-wait")); assertEquals("pending", poll(command, "s-wait", dismissed))
        for (phase in listOf("down", "up")) dismissed += events(command(JSONObject().put("command", "pointer").put("phase", phase).put("x", 780).put("y", 240)))
        assertEquals("fulfilled", result(command, "s-wait", dismissed))
        assertEquals(listOf("mdCancel", "mdClose"), dismissed.map { it.getString("name") })
    }

    @Test fun sideSheetTypedWidth() = withHost { _, command ->
        command(configure("md-side-sheet", 800, 480, JSONObject().put("open", true).put("variant", "modal").put("headline", "Filters"))
            .put("sideSheetAppearance", JSONObject().put("width", JSONObject().put("points", 320))))
        Thread.sleep(600); val c = box(command(JSONObject().put("command", "frame")), "container")
        near(320.0, c.w, "typed width"); near(800.0, c.x + c.w, "end edge")
    }

    @Test fun nonModalPreviewsKeepTheirFittedHeight() = withHost { _, command ->
        val frame = command(JSONObject().put("command", "configure").put("tag", "md-card").put("width", 640).put("properties", JSONObject()))
        assertTrue("Non-modal previews keep their fitted height", frame.getDouble("logicalHeight") < 480)
    }

    @Test fun closedModalsShowTheRecipeLauncher() {
        for (tag in listOf("md-dialog", "md-bottom-sheet", "md-side-sheet")) withHost { _, command ->
            val properties = JSONObject().put("open", false).put("headline", "Share")
            if (tag == "md-side-sheet") properties.put("variant", "modal")
            var frame = command(configure(tag, 640, 480, properties))
            Thread.sleep(300); frame = command(JSONObject().put("command", "frame"))
            assertNull("$tag starts closed", find(frame, "container"))
            val opened = events(frame).toMutableList()
            for (phase in listOf("down", "up")) opened += events(command(JSONObject().put("command", "pointer").put("phase", phase).put("x", 40).put("y", 44)))
            Thread.sleep(600); frame = command(JSONObject().put("command", "frame")); opened += events(frame)
            assertEquals("$tag: the launcher calls show() once", listOf("mdOpen"), opened.map { it.getString("name") })
            assertNotNull("$tag opens in the viewport", find(frame, "container"))
            assertEquals(480.0, frame.getDouble("logicalHeight"), .01)
        }
    }

    private data class Box(val x: Double, val y: Double, val w: Double, val h: Double)
    private fun near(expected: Double, actual: Double, label: String) = assertTrue("$label: $actual vs $expected", abs(expected - actual) <= 1.0)
    private fun configure(tag: String, width: Int, height: Int, properties: JSONObject) =
        JSONObject().put("command", "configure").put("tag", tag).put("width", width).put("height", height).put("properties", properties)
    private fun events(frame: JSONObject): List<JSONObject> = frame.optJSONArray("events")?.let { a -> (0 until a.length()).map { a.getJSONObject(it) } } ?: emptyList()
    private fun nodes(frame: JSONObject): List<JSONObject> = frame.optJSONObject("inspection")?.optJSONArray("nodes")?.let { a -> (0 until a.length()).map { a.getJSONObject(it) } } ?: emptyList()
    private fun find(frame: JSONObject, name: String): JSONObject? = nodes(frame).firstOrNull { it.optString("name") == name }
    private fun box(frame: JSONObject, name: String): Box {
        val node = checkNotNull(find(frame, name)) { "No inspected $name in ${nodes(frame).map { it.optString("name") }}" }
        val b = node.getJSONObject("bounds")
        return Box(b.getDouble("x"), b.getDouble("y"), b.getDouble("width"), b.getDouble("height"))
    }
    private fun method(name: String, id: String) = JSONObject().put("command", "method").put("target", "component").put("method", name).put("arguments", JSONArray()).put("callId", id)
    private fun poll(command: (JSONObject) -> JSONObject, id: String, sink: MutableList<JSONObject>): String {
        val reply = command(JSONObject().put("command", "method-results").put("callIds", JSONArray().put(id)).put("acknowledged", JSONArray()))
        sink += events(reply)
        return reply.getJSONArray("methodResults").getJSONObject(0).getString("status")
    }
    private fun result(command: (JSONObject) -> JSONObject, id: String, sink: MutableList<JSONObject>): String {
        var status = "pending"
        repeat(150) { if (status == "pending") { status = poll(command, id, sink); if (status == "pending") Thread.sleep(10) } }
        return status
    }
    private fun decode(frame: JSONObject): android.graphics.Bitmap {
        val bytes = Base64.decode(frame.getString("png"), Base64.DEFAULT)
        return checkNotNull(BitmapFactory.decodeByteArray(bytes, 0, bytes.size)) { "Frame must be a real decodable PNG" }
    }
    private fun withHost(block: (String, (JSONObject) -> JSONObject) -> Unit) {
        val token = UUID.randomUUID().toString().replace("-", "") + UUID.randomUUID().toString().replace("-", "")
        val intent = Intent(ApplicationProvider.getApplicationContext(), LivePreviewActivity::class.java).putExtra("token", token).putExtra("profile", true)
        ActivityScenario.launch<LivePreviewActivity>(intent).use {
            val deadline = System.currentTimeMillis() + 5000
            var ready = false
            while (!ready && System.currentTimeMillis() < deadline) {
                ready = runCatching { request("GET", "/health", token).first == 200 }.getOrDefault(false)
                if (!ready) Thread.sleep(25)
            }
            assertTrue("Debug host did not become ready", ready)
            block(token) { value ->
                val response = request("POST", "/command", token, value)
                assertEquals(response.second.toString(), 200, response.first)
                assertFalse(response.second.toString(), response.second.has("error"))
                response.second
            }
        }
    }
    private fun request(method: String, path: String, token: String, body: JSONObject? = null): Pair<Int, JSONObject> {
        val connection = (URL("http://127.0.0.1:39091$path").openConnection() as HttpURLConnection).apply {
            requestMethod = method; connectTimeout = 3000; readTimeout = 6000; setRequestProperty("Authorization", "Bearer $token")
        }
        try {
            if (body != null) {
                val bytes = body.toString().toByteArray()
                connection.doOutput = true; connection.setRequestProperty("Content-Type", "application/json")
                connection.setFixedLengthStreamingMode(bytes.size); connection.outputStream.use { it.write(bytes) }
            }
            val status = connection.responseCode
            val stream = if (status < 400) connection.inputStream else connection.errorStream
            return status to JSONObject(stream.bufferedReader().use { it.readText() })
        } finally { connection.disconnect() }
    }
}
