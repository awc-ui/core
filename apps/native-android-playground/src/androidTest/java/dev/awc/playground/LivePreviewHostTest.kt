package dev.awc.playground

import android.content.Intent
import android.graphics.BitmapFactory
import android.util.Base64
import androidx.test.core.app.ActivityScenario
import androidx.test.core.app.ApplicationProvider
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import java.net.HttpURLConnection
import java.net.URL
import java.util.UUID

/** Exercises the private debug surface, without adb/global input or semantics shortcuts. */
class LivePreviewHostTest {
    @Test fun authenticatedWindowPixelsAndRealHeldButtonInput() {
        val token = UUID.randomUUID().toString().replace("-", "") + UUID.randomUUID().toString().replace("-", "")
        val intent = Intent(ApplicationProvider.getApplicationContext(), LivePreviewActivity::class.java).putExtra("token", token)
        ActivityScenario.launch<LivePreviewActivity>(intent).use {
            val deadline = System.currentTimeMillis() + 5000
            var ready = false
            while (!ready && System.currentTimeMillis() < deadline) {
                ready = runCatching { request("GET", "/health", token).first == 200 }.getOrDefault(false)
                if (!ready) Thread.sleep(25)
            }
            assertTrue("Debug host did not become ready", ready)
            assertEquals(401, request("GET", "/health", "wrong-token").first)
            fun command(value: JSONObject): JSONObject {
                val response = request("POST", "/command", token, value)
                assertEquals(response.second.toString(), 200, response.first)
                assertFalse(response.second.toString(), response.second.has("error"))
                return response.second
            }
            val configured = command(JSONObject().put("command", "configure").put("tag", "md-button")
                .put("width", 640).put("dark", false).put("properties", JSONObject().put("toggle", true).put("ripple", false)))
            val bytes = Base64.decode(configured.getString("png"), Base64.DEFAULT)
            val bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
            assertNotNull("Frame must be a real decodable PNG", bitmap)
            assertEquals(bitmap.width, configured.getInt("width"))
            assertEquals(bitmap.height, configured.getInt("height"))
            assertEquals(640.0, configured.getDouble("logicalWidth"), 1.0)
            assertTrue(configured.getDouble("logicalHeight") >= 100)
            bitmap.recycle()
            fun pointer(phase: String, x: Int = 48, y: Int = 48) = command(JSONObject().put("command", "pointer")
                .put("phase", phase).put("x", x).put("y", y))
            assertEquals(0, pointer("down").getJSONArray("events").length())
            val activated = pointer("up").getJSONArray("events")
            val names = (0 until activated.length()).map { activated.getJSONObject(it).getString("name") }
            assertEquals(listOf("mdClick", "mdChange"), names)
            assertTrue(activated.getJSONObject(1).getJSONObject("detail").getBoolean("selected"))
            assertTrue(activated.getJSONObject(0).getString("id").isNotEmpty())
            pointer("down")
            assertEquals(0, pointer("cancel").getJSONArray("events").length())
            assertEquals(0, pointer("up").getJSONArray("events").length())
            assertEquals(0, command(JSONObject().put("command", "frame")).getJSONArray("events").length())
        }
    }

    private fun request(method: String, path: String, token: String, body: JSONObject? = null): Pair<Int, JSONObject> {
        val connection = URL("http://127.0.0.1:39091$path").openConnection() as HttpURLConnection
        try {
            connection.requestMethod = method
            connection.connectTimeout = 3000
            connection.readTimeout = 6000
            connection.setRequestProperty("Authorization", "Bearer $token")
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
