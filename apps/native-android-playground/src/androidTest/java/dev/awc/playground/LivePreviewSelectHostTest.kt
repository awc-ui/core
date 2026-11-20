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

/** Laboratory host (gate 3): md-select / md-multi-select with typed hooks, retained property updates and the controller methods
 *  with results (validity, getLabels, show / close, setQuery, loadOptions, reset). */
class LivePreviewSelectHostTest {
    private val options get()=JSONArray().put(JSONObject().put("label","London").put("value","london")).put(JSONObject().put("label","Paris").put("value","paris"))
        .put(JSONObject().put("label","Tokyo").put("value","tokyo"))
    private fun configure(tag:String,properties:JSONObject,extra:JSONObject.()->Unit={})=JSONObject().put("command","configure").put("tag",tag).put("width",640).put("dark",false).put("properties",properties).apply(extra)
    private fun method(name:String,vararg args:Any)=JSONObject().put("command","method").put("method",name).put("arguments",JSONArray(args.toList()))
    private fun update(properties:JSONObject)=JSONObject().put("command","update").put("properties",properties)
    private val frameCommand get()=JSONObject().put("command","frame")
    private fun labels(result:JSONObject)=result.getJSONObject("result").getJSONObject("awcSelectLabels")
    @Test fun selectHooksUpdatesAndMethods() { withHost { token,command->
        command(configure("md-select",JSONObject().put("label","City").put("required",true).put("value","").put("options",options).put("filterable",true)) {
            put("selectAppearance",JSONObject().put("caretSize",30).put("caretColor","#B3261E")) });Thread.sleep(250)
        assertTrue(command(frameCommand).has("png"))
        var v=command(method("getValidity")).getJSONObject("result")
        assertFalse(v.toString(),v.getBoolean("valid"));assertTrue(v.toString(),v.getJSONObject("flags").getBoolean("valueMissing"))
        assertEquals("Please select an item in the list.",v.getString("validationMessage"))
        command(method("setCustomValidity","Pick one"));Thread.sleep(120);v=command(method("getValidity")).getJSONObject("result")
        assertTrue(v.toString(),v.getJSONObject("flags").getBoolean("customError"));assertEquals("Pick one",v.getString("validationMessage"))
        command(method("setCustomValidity",""));command(update(JSONObject().put("value","paris")));Thread.sleep(100)
        assertTrue(command(method("checkValidity")).getBoolean("result"))
        val l=labels(command(method("getLabels",JSONArray().put("london").put("tokyo").put("nowhere"))))
        assertEquals("London",l.getString("london"));assertEquals("Tokyo",l.getString("tokyo"));assertFalse(l.has("nowhere"))
        command(method("show"));Thread.sleep(400);command(method("setQuery","to"));Thread.sleep(150);command(method("close"));Thread.sleep(400)
        command(method("loadOptions",JSONArray().put(JSONObject().put("value","oslo").put("label","Oslo"))))
        val l2=labels(command(method("getLabels",JSONArray().put("oslo").put("london"))));assertEquals("Oslo",l2.getString("oslo"));assertFalse(l2.has("london"))
        command(method("reset"));Thread.sleep(100);assertFalse("reset → required empty",command(method("checkValidity")).getBoolean("result"))
        assertFalse(command(method("reportValidity")).getBoolean("result"));command(method("focusTrigger"))
        // Outside a menu scope (this host) the listbox renders in flow: after show() the option rows are in the frame.
        command(method("show"));Thread.sleep(500);assertTrue("md-select: the open listbox is rendered in the host",command(frameCommand).toString().contains("::opt0"))
        command(method("close"));Thread.sleep(400);assertFalse("md-select: closed again",command(frameCommand).toString().contains("::opt0"))
        command(update(JSONObject().put("variant","filled").put("density",-2).put("clearable",true).put("placement","top-start").put("maxHeight","12rem").put("options","[{\"value\":\"a\",\"label\":\"A\"}]")))
        for(bad in listOf(JSONObject().put("virtualize","never"),JSONObject().put("density",-5),JSONObject().put("options",JSONArray().put(JSONObject().put("value",1))),
                JSONObject().put("value",JSONArray().put("a")),JSONObject().put("bogus",1)))
            assertRejected(token,update(bad))
        assertRejected(token,method("show",1));assertRejected(token,method("setQuery"));assertRejected(token,method("getLabels","x"))
    } }
    @Test fun multiSelectHooksUpdatesAndMethods() { withHost { token,command->
        command(configure("md-multi-select",JSONObject().put("label","Cities").put("required",true).put("value",JSONArray().put("london")).put("options",options)) {
            put("multiSelectAppearance",JSONObject().put("chipHeight","28px")) });Thread.sleep(250)
        assertTrue(command(frameCommand).has("png"))
        val l=labels(command(method("getLabels",JSONArray().put("london").put("paris"))));assertEquals("Paris",l.getString("paris"))
        command(update(JSONObject().put("value",JSONArray().put("london").put("paris")).put("displayMode","count").put("maxSelected",2)));Thread.sleep(100)
        assertTrue(command(method("checkValidity")).getBoolean("result"))
        command(method("reset"));Thread.sleep(100);val v=command(method("getValidity")).getJSONObject("result")
        assertTrue(v.toString(),v.getJSONObject("flags").getBoolean("valueMissing"))
        command(method("show"));Thread.sleep(500);assertTrue("md-multi-select: the open listbox is rendered in the host",command(frameCommand).toString().contains("::opt0"))
        command(method("close"));Thread.sleep(400)
        for(bad in listOf(JSONObject().put("value","london"),JSONObject().put("displayMode","list"),JSONObject().put("countFormatter","x"),JSONObject().put("maxHeight","12rem")))
            assertRejected(token,update(bad))
    } }
    private fun assertRejected(token:String,body:JSONObject) { val response=request("POST","/command",token,body);assertTrue("$body rejected: $response",response.first>=400 || response.second.has("error")) }
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
