package dev.awc.playground

import android.content.Intent
import androidx.test.core.app.ActivityScenario
import androidx.test.core.app.ApplicationProvider
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import java.net.HttpURLConnection
import java.net.URL
import java.util.UUID

/**
 * Laboratory host: a retained property update whose value equals the current one must ACK promptly and keep the session
 * (gate-7 R4-17). The update bumps the property revision even when the configuration is structurally equal; the revision is
 * snapshot state, so the preview still recomposes, draws that revision and completes the pending update.
 */
class LivePreviewNoOpUpdateHostTest {
    private fun configure(tag: String, properties: JSONObject, width: Int = 640, height: Int? = null) =
        JSONObject().put("command", "configure").put("tag", tag).put("width", width).put("dark", false).put("properties", properties)
            .apply { if (height != null) put("height", height) }
    private fun update(properties: JSONObject) = JSONObject().put("command", "update").put("properties", properties)
    private val frameCommand get() = JSONObject().put("command", "frame")

    private fun noOpThenChange(tag: String, configureProps: JSONObject, noOp: JSONObject, change: JSONObject, width: Int = 640, height: Int? = null) =
        withHost { command ->
            command(configure(tag, configureProps, width, height)); Thread.sleep(300)
            assertTrue("$tag first frame", command(frameCommand).has("png"))
            val started = System.nanoTime()
            command(update(noOp))
            val elapsed = (System.nanoTime() - started) / 1_000_000
            assertTrue("$tag no-op update $noOp acknowledged in $elapsed ms", elapsed < 2000)
            assertTrue("$tag session survives the no-op update", command(frameCommand).has("png"))
            command(update(noOp))
            command(update(change))
            assertTrue("$tag session survives a following real update", command(frameCommand).has("png"))
            command(update(change))
            assertTrue("$tag repeated equal update", command(frameCommand).has("png"))
        }

    @Test fun radio() = noOpThenChange("md-radio", JSONObject().put("value", "a"), JSONObject().put("softDisabled", false), JSONObject().put("softDisabled", true))
    @Test fun switchControl() = noOpThenChange("md-switch", JSONObject(), JSONObject().put("softDisabled", false), JSONObject().put("selected", true))
    @Test fun checkbox() = noOpThenChange("md-checkbox", JSONObject(), JSONObject().put("softDisabled", false), JSONObject().put("checked", true))
    @Test fun chip() = noOpThenChange("md-chip", JSONObject().put("label", "Design"), JSONObject().put("softDisabled", false), JSONObject().put("selected", true))
    @Test fun bottomSheet() = noOpThenChange("md-bottom-sheet", JSONObject().put("open", true).put("headline", "Share"),
        JSONObject().put("scrimDismissible", true), JSONObject().put("scrimDismissible", false), 800, 480)
    @Test fun sideSheet() = noOpThenChange("md-side-sheet", JSONObject().put("open", true).put("headline", "Filters"),
        JSONObject().put("closeable", true), JSONObject().put("closeable", false), 800, 480)
    @Test fun menu() = noOpThenChange("md-menu", JSONObject(), JSONObject().put("quick", false), JSONObject().put("quick", true))
    @Test fun menuItem() = noOpThenChange("md-menu-item", JSONObject(), JSONObject().put("disabled", false), JSONObject().put("disabled", true))

    private fun withHost(block: ((JSONObject) -> JSONObject) -> Unit) {
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
            block { value ->
                val response = request("POST", "/command", token, value)
                assertEquals("$value -> ${response.second}", 200, response.first)
                assertFalse(response.second.toString(), response.second.has("error"))
                response.second
            }
        }
    }
    private fun request(method: String, path: String, token: String, body: JSONObject? = null): Pair<Int, JSONObject> {
        val connection = (URL("http://127.0.0.1:39091$path").openConnection() as HttpURLConnection).apply {
            requestMethod = method; connectTimeout = 3000; readTimeout = 8000; setRequestProperty("Authorization", "Bearer $token")
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
