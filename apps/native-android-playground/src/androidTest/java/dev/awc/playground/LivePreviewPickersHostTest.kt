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

/** Laboratory host: md-time-picker and md-color-picker in the overlay viewport, typed hooks, retained updates of source
 *  properties and the methods through AWCTimePickerController / AWCColorPickerController. */
class LivePreviewPickersHostTest {
    private fun configure(tag:String,properties:JSONObject,extra:JSONObject.()->Unit={})=JSONObject().put("command","configure").put("tag",tag).put("width",400).put("height",640).put("dark",false).put("properties",properties).apply(extra)
    private fun method(name:String,vararg args:Any)=JSONObject().put("command","method").put("method",name).put("arguments",JSONArray(args.toList()))
    private fun update(properties:JSONObject)=JSONObject().put("command","update").put("properties",properties)
    private val frameCommand get()=JSONObject().put("command","frame")
    @Test fun timePickerViewportHooksMethodsAndUpdates() { withHost { token,command->
        command(configure("md-time-picker",JSONObject().put("label","Meeting time").put("value","14:30").put("required",true).put("variant","dial")) {
            put("timePickerAppearance",JSONObject().put("dialSize","240px").put("dialHandColor","#123456")) });Thread.sleep(300)
        assertNull("closed after configure",node(command(frameCommand),"dialog"))
        command(method("show"));Thread.sleep(800)
        var frame=command(frameCommand)
        val dialog=node(frame,"dialog");assertNotNull("show() opens the dialog",dialog)
        val dial=node(frame,"dial")!!.getJSONObject("bounds");assertTrue("dial-size hook ${dial}",abs(dial.getDouble("width")-240)<=1)
        val box=dialog!!.getJSONObject("bounds");assertTrue("the dialog centres in the viewport $box",abs(box.getDouble("x")+box.getDouble("width")/2-200)<=2)
        command(method("hide"));Thread.sleep(600)
        assertNull("hide() closes the dialog",node(command(frameCommand),"dialog"))
        assertEquals(true,command(method("checkValidity")).get("result"))
        command(update(JSONObject().put("value","")));Thread.sleep(100)
        val validity=command(method("getValidity")).getJSONObject("result")
        assertFalse("getValidity $validity",validity.getBoolean("valid"));assertTrue(validity.getJSONObject("flags").getBoolean("valueMissing"));assertTrue(validity.getString("validationMessage").isNotEmpty())
        assertEquals(false,command(method("checkValidity")).get("result"))
        assertEquals(false,command(method("reportValidity")).get("result"))
        command(update(JSONObject().put("disabled",true)));Thread.sleep(100)
        assertEquals("a disabled picker is barred from validation",true,command(method("checkValidity")).get("result"))
        command(update(JSONObject().put("format","24h").put("minuteStep",5).put("label","Start").put("disabled",false)))
        for(bad in listOf(JSONObject().put("format","13h"),JSONObject().put("minuteStep","5"),JSONObject().put("bogus",1))) assertRejected(token,update(bad))
        assertRejected(token,method("show",1));assertRejected(token,method("close"))
    } }
    @Test fun colorPickerHooksMethodsAndUpdates() { withHost { token,command->
        // The inline panel carries the hooks; the Laboratory example has no trigger, so the popover's show() / close() are
        // checked through their mdOpenChange events.
        command(configure("md-color-picker",JSONObject().put("value","#6750A4").put("presets",JSONArray(listOf("#6750A4","#386A20"))).put("showHex",true)) {
            put("colorPickerAppearance",JSONObject().put("width",320).put("radius",12).put("surfaceColor","#FFF3E0")) });Thread.sleep(300)
        val events=mutableListOf<String>()
        fun run(body:JSONObject)=command(body).also { r-> r.optJSONArray("events")?.let { a-> for(i in 0 until a.length()) events+=a.getJSONObject(i).optString("name") } }
        fun frame()=run(frameCommand)
        val panel=node(frame(),"panel");assertNotNull("inline panel",panel)
        assertTrue("width hook ${panel!!.getJSONObject("bounds")}",abs(panel.getJSONObject("bounds").getDouble("width")-320)<=1)
        run(method("show"));Thread.sleep(100);frame()
        assertEquals("show() does nothing on an inline picker",0,events.count { it=="mdOpenChange" })
        run(update(JSONObject().put("variant","popover")));Thread.sleep(150)
        run(method("show"));Thread.sleep(400);frame()
        assertEquals("show() opens the popover: $events",1,events.count { it=="mdOpenChange" })
        run(method("close"));Thread.sleep(200);frame()
        assertEquals("close() closes it: $events",2,events.count { it=="mdOpenChange" })
        run(update(JSONObject().put("disabled",true)));run(method("show"));Thread.sleep(150);frame()
        assertEquals("show() does nothing while disabled",2,events.count { it=="mdOpenChange" })
        for(bad in listOf(JSONObject().put("variant","dialog"),JSONObject().put("presets",JSONArray(listOf(1))),JSONObject().put("open","yes"))) assertRejected(token,update(bad))
        assertRejected(token,method("hide"))
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
