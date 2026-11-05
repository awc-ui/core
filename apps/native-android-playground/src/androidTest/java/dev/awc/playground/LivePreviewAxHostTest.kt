package dev.awc.playground

import android.content.Intent
import android.graphics.Bitmap
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

/**
 * Laboratory host behaviour tools/ax relies on: a shared example (`children`) renders with its own properties only; the modal
 * recipe's page order (launcher, then the component); the removable chip's ✕ glyph in the captured pixels.
 */
class LivePreviewAxHostTest {
    private fun configure(tag: String, properties: JSONObject, width: Int = 640) =
        JSONObject().put("command", "configure").put("tag", tag).put("width", width).put("dark", false).put("properties", properties)
    private val frame get() = JSONObject().put("command", "frame")

    @Test fun sharedExampleCarriesItsOwnProperties() {
        val props = JSONObject().put("label", "Add to calendar").put("variant", "assist").put("removable", false).put("selected", false)
        var shared = 0.0; var explicit = 0.0
        withHost { _, command -> command(configure("md-chip", props).put("children", JSONArray())); Thread.sleep(250); shared = root(command(frame), "md-chip").getDouble("width") }
        withHost { _, command -> command(configure("md-chip", JSONObject(props.toString()).put("icon", "").put("selectable", false)).put("children", JSONArray())); Thread.sleep(250); explicit = root(command(frame), "md-chip").getDouble("width") }
        assertEquals("the host's sample fixture (a leading icon) does not leak into a shared example", explicit, shared, .6)
    }

    @Test fun standardSideSheetSitsBelowTheLauncher() = withHost { _, command ->
        command(JSONObject().put("command", "configure").put("tag", "md-side-sheet").put("width", 640).put("height", 480)
            .put("properties", JSONObject().put("open", true).put("variant", "standard").put("headline", "Project details")))
        Thread.sleep(600); val f = command(frame)
        val sheet = (nodes(f).firstOrNull { it.optString("name") == "container" } ?: nodes(f).first { it.getString("id") == "component" }).getJSONObject("bounds")
        assertTrue("the inline sheet starts below the 24 + 40 launcher: $sheet", sheet.getDouble("y") >= 63.0)
    }

    @Test fun removableChipPaintsItsRemoveGlyph() {
        for (sharedExample in listOf(false, true)) withHost { _, command ->
            val request = configure("md-chip", JSONObject().put("label", "Alex Morgan").put("variant", "input").put("icon", "star").put("removable", true).put("selected", false))
            if (sharedExample) request.put("children", JSONArray())
            command(request); Thread.sleep(300)
            val f = command(frame); val chip = root(f, "md-chip"); val b = bitmap(f); val scale = b.width / 640.0
            // The remove button: the 18 dp box before the chip's 8 dp end padding, vertically centred.
            val right = chip.getDouble("x") + chip.getDouble("width"); val cy = chip.getDouble("y") + chip.getDouble("height") / 2
            var ink = 0
            for (y in ((cy - 9) * scale).toInt() until ((cy + 9) * scale).toInt()) for (x in ((right - 26) * scale).toInt() until ((right - 8) * scale).toInt()) {
                val c = b.getPixel(x, y); if (((c shr 16 and 255) + (c shr 8 and 255) + (c and 255)) / 3 < 140) ink++ }
            assertTrue("remove glyph ink (shared example: $sharedExample): $ink device pixels; parts ${nodes(f).map { it.optString("name") + it.optJSONObject("bounds") }}", ink >= 20)
        }
    }

    private fun root(frame: JSONObject, tag: String): JSONObject {
        val matches = nodes(frame).filter { it.getString("id") == "component" && it.optString("name") == tag }
        assertEquals("$tag root in ${nodes(frame).map { it.getString("id") + "/" + it.optString("name") }}", 1, matches.size)
        return matches.single().getJSONObject("bounds")
    }
    private fun nodes(frame: JSONObject) = frame.getJSONObject("inspection").getJSONArray("nodes").let { a -> (0 until a.length()).map { a.getJSONObject(it) } }
    private fun bitmap(frame: JSONObject): Bitmap { val bytes = Base64.decode(frame.getString("png"), Base64.DEFAULT); return BitmapFactory.decodeByteArray(bytes, 0, bytes.size) }
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
            try {
                block(token) { value ->
                    val response = request("POST", "/command", token, value)
                    assertEquals(response.second.toString(), 200, response.first)
                    assertFalse(response.second.toString(), response.second.has("error"))
                    response.second
                }
            } finally { runCatching { request("POST", "/command", token, JSONObject().put("command", "close")) }; Thread.sleep(400) }
        }
    }
    private fun request(method: String, path: String, token: String, body: JSONObject? = null): Pair<Int, JSONObject> {
        val connection = (URL("http://127.0.0.1:39091$path").openConnection() as HttpURLConnection).apply {
            requestMethod = method; connectTimeout = 3000; readTimeout = 6000; setRequestProperty("Authorization", "Bearer $token")
        }
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
