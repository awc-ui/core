package dev.awc.playground

import android.content.Intent
import android.graphics.BitmapFactory
import android.hardware.display.DisplayManager
import android.util.Base64
import androidx.test.core.app.ActivityScenario
import androidx.test.core.app.ApplicationProvider
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import java.net.HttpURLConnection
import java.net.URL
import java.util.UUID

/** Exercises real GPU window pixels and local input, without global input or semantics shortcuts. */
class LivePreviewHostTest {
    @Test fun dialogOverlayIsInTheStreamAndReceivesLocalPointerInput() = withHost { _, command ->
        val initial = command(JSONObject().put("command", "configure").put("tag", "md-dialog").put("width", 640)
            .put("slots", JSONObject().put("", "Live overlay 👋 <b>literal</b>"))
            .put("properties", JSONObject().put("open", false).put("headline", "Captured dialog").put("scrimDismissible", true)))
        command(JSONObject().put("command", "click").put("x", 320).put("y", initial.getDouble("logicalHeight") / 2))
        var open = command(JSONObject().put("command", "frame"))
        repeat(20) { if(open.getDouble("logicalHeight") < 600) { Thread.sleep(25); open = command(JSONObject().put("command", "frame")) } }
        assertTrue("The modal must expand the captured native canvas", open.getDouble("logicalHeight") >= 600)
        val bitmap = decode(open)
        assertNotEquals("The dialog surface must appear over the in-window scrim", bitmap.getPixel(8, 8), bitmap.getPixel(bitmap.width / 2, bitmap.height / 2))
        bitmap.recycle()
        val dismissed = command(JSONObject().put("command", "click").put("x", 4).put("y", 4)).getJSONArray("events")
        assertTrue((0 until dismissed.length()).any { dismissed.getJSONObject(it).getString("name") == "mdClose" })
        var closed = command(JSONObject().put("command", "frame"))
        repeat(20) { if(closed.getDouble("logicalHeight") >= 600) { Thread.sleep(25); closed = command(JSONObject().put("command", "frame")) } }
        assertTrue("Local pointer dismissal must remove the captured overlay", closed.getDouble("logicalHeight") < 600)
    }

    @Test fun authenticatedRetinaPixelsHeldPointerKeyboardAndDisplayDisposal() {
        val context = ApplicationProvider.getApplicationContext<android.content.Context>()
        val displays = context.getSystemService(DisplayManager::class.java)
        val original = displays.displays.map { it.displayId }.toSet()
        withHost { token, command ->
            assertEquals(401, request("GET", "/health", "wrong-token").first)
            val configured = command(JSONObject().put("command", "configure").put("tag", "md-button")
                .put("width", 1024).put("dark", false).put("text", "Continue")
                .put("properties", JSONObject().put("toggle", true).put("ripple", false)))
            val bitmap = decode(configured)
            assertEquals("Render two physical pixels per logical unit", 2048, bitmap.width)
            assertEquals(bitmap.width, configured.getInt("width"))
            assertEquals(bitmap.height, configured.getInt("height"))
            assertEquals(1024.0, configured.getDouble("logicalWidth"), 0.01)
            assertTrue(configured.getDouble("logicalHeight") >= 100)
            assertTrue(bitmap.width.toLong() * bitmap.height <= LivePreviewSurface.MAX_PIXELS)
            val diagnostics = configured.getJSONObject("diagnostics")
            assertEquals(2.0, diagnostics.getDouble("captureScale"), 0.0)
            assertTrue(diagnostics.getLong("captureSequence") > 0)
            assertTrue(diagnostics.getDouble("captureMs") >= 0)
            assertTrue(diagnostics.getDouble("encodeMs") >= 0)
            // A 1×1 display sink must not collapse PixelCopy's full-resolution
            // window source. Check the actual button, glyph and antialiased edges.
            val cy = bitmap.height / 2
            val cx = bitmap.width / 2
            val colors = mutableSetOf<Int>()
            val fill = bitmap.getPixel(cx, cy - 30)
            var glyphPixels = 0
            var solidButtonPixels = 0
            for (y in cy - 25 until cy + 25) for (x in cx - 60 until cx + 60) {
                val color = bitmap.getPixel(x, y)
                colors += color
                val contrast = maxOf(kotlin.math.abs(android.graphics.Color.red(color) - android.graphics.Color.red(fill)),
                    kotlin.math.abs(android.graphics.Color.green(color) - android.graphics.Color.green(fill)),
                    kotlin.math.abs(android.graphics.Color.blue(color) - android.graphics.Color.blue(fill)))
                if (contrast > 60) glyphPixels++ else solidButtonPixels++
            }
            assertTrue("Native glyphs must occupy distinct physical pixels", glyphPixels > 100)
            assertTrue("The button must have visible native container pixels", solidButtonPixels > 1000)
            assertTrue("Native text rasterization must retain antialiased shades", colors.size > 20)
            bitmap.recycle()
            assertEquals(1, displays.displays.count { it.displayId !in original && it.name == "AWC native preview" })
            val x = configured.getDouble("logicalWidth") / 2
            val y = configured.getDouble("logicalHeight") / 2
            fun pointer(phase: String) = command(JSONObject().put("command", "pointer").put("phase", phase).put("x", x).put("y", y))
            assertEquals(0, pointer("down").getJSONArray("events").length())
            val activated = pointer("up").getJSONArray("events")
            val names = (0 until activated.length()).map { activated.getJSONObject(it).getString("name") }
            assertEquals(listOf("mdClick", "mdChange"), names)
            assertTrue(activated.getJSONObject(1).getJSONObject("detail").getBoolean("selected"))
            assertTrue(activated.getJSONObject(0).getString("id").isNotEmpty())
            pointer("down")
            assertEquals(0, pointer("cancel").getJSONArray("events").length())
            assertEquals(0, pointer("up").getJSONArray("events").length())
            // Focus is owned by the Presentation, not Activity.currentFocus.
            command(JSONObject().put("command", "key").put("key", "Tab"))
            val keyboard = command(JSONObject().put("command", "key").put("key", "Enter")).getJSONArray("events")
            assertEquals(listOf("mdClick", "mdChange"), (0 until keyboard.length()).map { keyboard.getJSONObject(it).getString("name") })
            assertFalse(keyboard.getJSONObject(1).getJSONObject("detail").getBoolean("selected"))
            assertEquals(0, command(JSONObject().put("command", "frame")).getJSONArray("events").length())
        }
        val deadline = System.currentTimeMillis() + 3000
        while (displays.displays.any { it.displayId !in original && it.name == "AWC native preview" } && System.currentTimeMillis() < deadline) Thread.sleep(25)
        assertFalse("Closing the host must release its private display", displays.displays.any { it.displayId !in original && it.name == "AWC native preview" })
    }

    @Test fun streamedDrawsAdvanceSequenceWhileIdleHeartbeatsReuseIt() = withHost { token, command ->
        val configured = command(JSONObject().put("command", "configure").put("tag", "md-button")
            .put("width", 1200).put("properties", JSONObject().put("ripple", false)))
        assertEquals(2400, configured.getInt("width"))
        val connection = connection("GET", "/stream", token)
        try {
            assertEquals(200, connection.responseCode)
            val reader = connection.inputStream.bufferedReader()
            fun nextFrame(): JSONObject = JSONObject(checkNotNull(reader.readLine()) { "Native stream closed" }).also { assertEquals("frame", it.getString("kind")) }
            var first = nextFrame()
            var second = nextFrame()
            val deadline = System.currentTimeMillis() + 5000
            while (first.getJSONObject("diagnostics").getLong("captureSequence") != second.getJSONObject("diagnostics").getLong("captureSequence") && System.currentTimeMillis() < deadline) { first = second; second = nextFrame() }
            assertEquals("Idle stream must reuse its last capture", first.getJSONObject("diagnostics").getLong("captureSequence"), second.getJSONObject("diagnostics").getLong("captureSequence"))
            assertEquals(first.getJSONObject("diagnostics").getDouble("capturedAtMs"), second.getJSONObject("diagnostics").getDouble("capturedAtMs"), 0.0)
            val idleSequence = second.getJSONObject("diagnostics").getLong("captureSequence")
            val down = command(JSONObject().put("command", "pointer").put("phase", "down").put("x", 600).put("y", configured.getDouble("logicalHeight") / 2))
            assertTrue(down.getBoolean("ack"))
            assertFalse("Streaming input should ACK without waiting for a PNG", down.has("png"))
            val pressed = nextFrame()
            assertTrue("A real native redraw must produce a fresh capture", pressed.getJSONObject("diagnostics").getLong("captureSequence") > idleSequence)
            var visible = pressed.getString("png") != second.getString("png")
            repeat(8) { if (!visible) visible = nextFrame().getString("png") != second.getString("png") }
            assertTrue("A held pointer must visibly animate native pixels", visible)
            command(JSONObject().put("command", "pointer").put("phase", "up").put("x", 600).put("y", configured.getDouble("logicalHeight") / 2))
            command(JSONObject().put("command", "stream").put("enabled", false))
        } finally { connection.disconnect() }
    }

    @Test fun browserAbortImmediatelyResubscribesAndRecoversNativeAnimation() = withHost { token, command ->
        val configured = command(JSONObject().put("command", "configure").put("tag", "md-button")
            .put("width", 1024).put("properties", JSONObject().put("ripple", true)))
        val y = configured.getDouble("logicalHeight") / 2
        var previousSequence = configured.getJSONObject("diagnostics").getLong("captureSequence")
        repeat(4) {
            val connection = connection("GET", "/stream", token)
            try {
                assertEquals("Immediate resubscribe must replace the token's old writer", 200, connection.responseCode)
                val reader = connection.inputStream.bufferedReader()
                val first = JSONObject(checkNotNull(reader.readLine()))
                assertFalse(first.toString(), first.has("error"))
                assertTrue("Each new subscriber must receive a fresh capture", first.getJSONObject("diagnostics").getLong("captureSequence") > previousSequence)
                previousSequence = first.getJSONObject("diagnostics").getLong("captureSequence")
                command(JSONObject().put("command", "pointer").put("phase", "down").put("x", 512).put("y", y))
                val drawn = JSONObject(checkNotNull(reader.readLine()))
                assertTrue(drawn.getJSONObject("diagnostics").getLong("captureSequence") > previousSequence)
                previousSequence = drawn.getJSONObject("diagnostics").getLong("captureSequence")
                command(JSONObject().put("command", "pointer").put("phase", "up").put("x", 512).put("y", y))
                // Match browser AbortController: close only the HTTP connection,
                // without a stream:false command or an idle-heartbeat delay.
            } finally { connection.disconnect() }
        }
        command(JSONObject().put("command", "stream").put("enabled", false))
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

    private fun connection(method: String, path: String, token: String): HttpURLConnection = (URL("http://127.0.0.1:39091$path").openConnection() as HttpURLConnection).apply {
        requestMethod = method
        connectTimeout = 3000
        readTimeout = 6000
        setRequestProperty("Authorization", "Bearer $token")
    }

    private fun request(method: String, path: String, token: String, body: JSONObject? = null): Pair<Int, JSONObject> {
        val connection = connection(method, path, token)
        try {
            if (body != null) {
                val bytes = body.toString().toByteArray()
                connection.doOutput = true
                connection.setRequestProperty("Content-Type", "application/json")
                connection.setFixedLengthStreamingMode(bytes.size)
                connection.outputStream.use { it.write(bytes) }
            }
            val status = connection.responseCode
            val stream = if (status < 400) connection.inputStream else connection.errorStream
            return status to JSONObject(stream.bufferedReader().use { it.readText() })
        } finally { connection.disconnect() }
    }
}
