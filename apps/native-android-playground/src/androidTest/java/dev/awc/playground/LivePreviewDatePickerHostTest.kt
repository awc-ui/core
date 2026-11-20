package dev.awc.playground

import android.content.Intent
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

/** Laboratory host: md-date-picker in the overlay viewport, the hook map, retained updates of source properties and the methods
 *  through AWCDatePickerController (show, close, clear, focusInput, constraint validation with results). */
class LivePreviewDatePickerHostTest {
    private fun configure(tag:String,properties:JSONObject,extra:JSONObject.()->Unit={})=JSONObject().put("command","configure").put("tag",tag).put("width",400).put("height",640).put("dark",false).put("properties",properties).apply(extra)
    private fun method(name:String,vararg args:Any)=JSONObject().put("command","method").put("method",name).put("arguments",JSONArray(args.toList()))
    private fun update(properties:JSONObject)=JSONObject().put("command","update").put("properties",properties)
    private val frameCommand get()=JSONObject().put("command","frame")
    @Test fun datePickerViewportHooksMethodsAndUpdates() { withHost { token,command->
        val events=mutableListOf<String>()
        fun run(body:JSONObject)=command(body).also { r-> r.optJSONArray("events")?.let { a-> for(i in 0 until a.length()) events+=a.getJSONObject(i).optString("name") } }
        fun frame()=run(frameCommand)
        run(configure("md-date-picker",JSONObject().put("label","Start date").put("value","2026-10-07").put("required",true)) {
            put("datePickerAppearance",JSONObject().put("panelWidth","340px").put("daySelectedBg","#386A20")) });Thread.sleep(300)
        assertNull("closed after configure",node(frame(),"panel"))
        run(method("show"));Thread.sleep(800)
        var f=frame()
        val panel=node(f,"panel");assertNotNull("show() opens the dialog",panel)
        val box=panel!!.getJSONObject("bounds")
        assertTrue("panel-width hook $box",abs(box.getDouble("width")-340)<=1)
        assertTrue("the dialog centres in the viewport $box",abs(box.getDouble("x")+box.getDouble("width")/2-200)<=2)
        assertEquals("six weeks of days",42,nodes(f).count { it.optString("name").startsWith("day-") })
        assertTrue("show() emits mdOpen: $events","mdOpen" in events)
        run(method("close"));Thread.sleep(700)
        assertNull("close() closes the dialog",node(frame(),"panel"))
        assertTrue("close() commits nothing: $events","mdClose" in events && "mdChange" !in events)
        assertEquals(true,run(method("checkValidity")).get("result"))
        run(method("clear"));Thread.sleep(150);frame()
        assertTrue("clear() emits mdChange: $events","mdChange" in events)
        val validity=run(method("getValidity")).getJSONObject("result")
        assertFalse("getValidity $validity",validity.getBoolean("valid"));assertTrue(validity.getJSONObject("flags").getBoolean("valueMissing"))
        assertEquals("Please choose a date.",validity.getString("validationMessage"))
        assertEquals(false,run(method("checkValidity")).get("result"))
        assertEquals(false,run(method("reportValidity")).get("result"));Thread.sleep(150)
        run(update(JSONObject().put("value","2026-10-08")));Thread.sleep(150)
        assertEquals("a new value is valid again",true,run(method("checkValidity")).get("result"))
        run(method("setCustomValidity","Choose a weekday."));Thread.sleep(80)
        val custom=run(method("getValidity")).getJSONObject("result")
        assertFalse("a custom message makes the picker invalid $custom",custom.getBoolean("valid"));assertTrue(custom.getJSONObject("flags").getBoolean("customError"))
        assertEquals("Choose a weekday.",custom.getString("validationMessage"))
        run(method("setCustomValidity",""));Thread.sleep(80)
        assertEquals("an empty custom message clears it",true,run(method("checkValidity")).get("result"))
        run(update(JSONObject().put("value","").put("disabled",true)));Thread.sleep(150)
        assertEquals("a disabled picker is barred from validation",true,run(method("checkValidity")).get("result"))
        run(update(JSONObject().put("disabled",false).put("value","2026-10-07").put("firstDayOfWeek",1).put("locale","de-DE").put("label","Start").put("clearable",true).put("density",-2)))
        for(bad in listOf(JSONObject().put("variant","inline"),JSONObject().put("firstDayOfWeek",9),JSONObject().put("open","yes"),JSONObject().put("isDateDisabled","x"),JSONObject().put("bogus",1))) assertRejected(token,update(bad))
        assertRejected(token,method("show",1));assertRejected(token,method("setCustomValidity"));assertRejected(token,method("hide"))
        run(method("focusInput"))
    } }
    @Test fun dockedPanelOpensUnderTheFieldInTheViewport() { withHost { _,command->
        command(configure("md-date-picker",JSONObject().put("label","Due").put("value","2026-10-07").put("variant","docked")) {
            put("datePickerAppearance",JSONObject().put("dockedPanelWidth","330px")) });Thread.sleep(300)
        command(method("show"));Thread.sleep(800)
        var f=command(frameCommand)
        val panel=node(f,"panel")?.getJSONObject("bounds");val field=(node(f,"field") ?: node(f,"md-text-field"))?.getJSONObject("bounds")
        assertNotNull("show() opens the docked panel",panel);assertNotNull("the trigger field (nodes: ${nodes(f).map { it.optString("name") }.filter { !it.startsWith("day-") }.distinct()})",field)
        assertTrue("docked-panel-width hook $panel",abs(panel!!.getDouble("width")-330)<=1)
        assertTrue("under the field, 24 dp in: $panel / $field",panel.getDouble("y")>=field!!.getDouble("y")+field.getDouble("height") && abs(panel.getDouble("x")-24)<=1)
        assertNotNull("month list button",node(f,"month-menu-button"));assertNotNull("year list button",node(f,"year-menu-button"))
        command(update(JSONObject().put("open",false)));Thread.sleep(700)
        assertNull("open = false closes the docked panel",node(command(frameCommand),"panel"))
    } }
    private fun assertRejected(token:String,body:JSONObject) { val response=request("POST","/command",token,body);assertTrue("$body rejected: $response",response.first>=400 || response.second.has("error")) }
    private fun nodes(frame:JSONObject)=frame.getJSONObject("inspection").getJSONArray("nodes").let { a->(0 until a.length()).map { a.getJSONObject(it) } }
    private fun node(frame:JSONObject,name:String)=nodes(frame).firstOrNull { it.optString("name")==name }
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
