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

/** Gate-7 R1-04: retained Laboratory property updates for the button family on the Android live host (generated contract). */
class LivePreviewButtonFamilyHostTest {
    private fun configure(tag: String, p: JSONObject) = JSONObject().put("command", "configure").put("tag", tag).put("width", 640).put("dark", false).put("properties", p)
    private fun update(p: JSONObject) = JSONObject().put("command", "update").put("properties", p)
    private val frame get() = JSONObject().put("command", "frame")
    private fun case(tag: String, base: JSONObject, change: JSONObject, same: JSONObject, bad: JSONObject) = withHost { token, command ->
        command(configure(tag, base)); Thread.sleep(400)
        val before = command(frame).getString("png")
        val started = System.nanoTime(); command(update(same))
        assertTrue("$tag equal-value update acknowledged promptly", (System.nanoTime() - started) / 1_000_000 < 2000)
        val rejected = request("POST", "/command", token, update(bad)); assertTrue("$tag $bad rejected: $rejected", rejected.first >= 400 || rejected.second.has("error"))
        command(update(change)); Thread.sleep(900)
        val after = command(frame).getString("png")
        assertNotEquals("$tag $change changes the mounted preview", before, after)
        command(update(change)); assertTrue("$tag repeated update keeps the session", command(frame).has("png"))
    }
    @Test fun button() = case("md-button", JSONObject().put("variant", "filled").put("size", "md"), JSONObject().put("variant", "outlined"), JSONObject().put("disabled", false), JSONObject().put("variant", "nope"))
    @Test fun buttonGroup() = case("md-button-group", JSONObject(), JSONObject().put("variant", "connected"), JSONObject().put("required", false), JSONObject().put("selectionMode", "single"))
    @Test fun fab() = case("md-fab", JSONObject().put("icon", "add"), JSONObject().put("variant", "tertiary"), JSONObject().put("lowered", false), JSONObject().put("size", "huge"))
    @Test fun fabMenu() = case("md-fab-menu", JSONObject(), JSONObject().put("open", true), JSONObject().put("quick", false), JSONObject().put("placement", "left"))
    @Test fun fabMenuItem() = case("md-fab-menu-item", JSONObject().put("icon", "share").put("label", "Send"), JSONObject().put("label", "Share"), JSONObject().put("disabled", false), JSONObject().put("density", -7))
    @Test fun iconButton() = case("md-icon-button", JSONObject().put("icon", "favorite"), JSONObject().put("variant", "filled"), JSONObject().put("disabled", false), JSONObject().put("buttonWidth", "wider"))
    @Test fun segmentedButton() = case("md-segmented-button", JSONObject().put("label", "Day").put("value", "day").put("selected", true), JSONObject().put("label", "Week"), JSONObject().put("disabled", false), JSONObject().put("selected", "yes"))
    @Test fun segmentedButtonSet() = case("md-segmented-button-set", JSONObject(), JSONObject().put("density", -2), JSONObject().put("density", 0), JSONObject().put("multiselect", 1))
    @Test fun splitButton() = case("md-split-button", JSONObject().put("label", "Create project").put("icon", "add"), JSONObject().put("variant", "outlined"), JSONObject().put("disabled", false), JSONObject().put("haspopup", "popup"))

    private fun withHost(block: (String, (JSONObject) -> JSONObject) -> Unit) {
        val token = UUID.randomUUID().toString().replace("-", "") + UUID.randomUUID().toString().replace("-", "")
        val intent = Intent(ApplicationProvider.getApplicationContext(), LivePreviewActivity::class.java).putExtra("token", token).putExtra("profile", true)
        ActivityScenario.launch<LivePreviewActivity>(intent).use {
            val deadline = System.currentTimeMillis() + 5000; var ready = false
            while (!ready && System.currentTimeMillis() < deadline) { ready = runCatching { request("GET", "/health", token).first == 200 }.getOrDefault(false); if (!ready) Thread.sleep(25) }
            assertTrue("Debug host did not become ready", ready)
            block(token) { value -> val r = request("POST", "/command", token, value); assertEquals("$value -> ${r.second}", 200, r.first); assertFalse(r.second.toString(), r.second.has("error")); r.second }
        }
    }
    private fun request(method: String, path: String, token: String, body: JSONObject? = null): Pair<Int, JSONObject> {
        val c = (URL("http://127.0.0.1:39091$path").openConnection() as HttpURLConnection).apply { requestMethod = method; connectTimeout = 3000; readTimeout = 8000; setRequestProperty("Authorization", "Bearer $token") }
        try {
            if (body != null) { val b = body.toString().toByteArray(); c.doOutput = true; c.setRequestProperty("Content-Type", "application/json"); c.setFixedLengthStreamingMode(b.size); c.outputStream.use { it.write(b) } }
            val s = c.responseCode; return s to JSONObject((if (s < 400) c.inputStream else c.errorStream).bufferedReader().use { it.readText() })
        } finally { c.disconnect() }
    }
}
