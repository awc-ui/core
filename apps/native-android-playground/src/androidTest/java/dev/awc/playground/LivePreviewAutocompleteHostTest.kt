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

/** Laboratory host: md-autocomplete with typed hooks, retained property updates and the nine methods with results. */
class LivePreviewAutocompleteHostTest {
    private val fruit=JSONArray().put(JSONObject().put("value","a").put("label","Apple")).put(JSONObject().put("value","b").put("label","Apricot"))
        .put(JSONObject().put("value","c").put("label","Avocado").put("disabled",true)).put(JSONObject().put("value","d").put("label","Banana"))
    private fun configure(properties:JSONObject,extra:JSONObject.()->Unit={})=JSONObject().put("command","configure").put("tag","md-autocomplete").put("width",640).put("dark",false).put("properties",properties).apply(extra)
    private fun method(name:String,vararg args:Any)=JSONObject().put("command","method").put("method",name).put("arguments",JSONArray(args.toList()))
    private fun update(properties:JSONObject)=JSONObject().put("command","update").put("properties",properties)
    private val frameCommand get()=JSONObject().put("command","frame")
    private fun host(frame:JSONObject)=nodes(frame).first { it.optString("name")=="md-autocomplete" }
    @Test fun autocompleteHooksUpdatesAndMethods() { withHost { token,raw->
        // Every command reply carries the md* events the native autocomplete dispatched since the previous one.
        val events=mutableListOf<JSONObject>()
        val command={ body:JSONObject-> raw(body).also { r-> r.optJSONArray("events")?.let { a-> for(i in 0 until a.length()) events+=a.getJSONObject(i) } } }
        fun names()=events.map { it.getString("name") }
        fun settle() { Thread.sleep(260);command(frameCommand) }
        // value "" overrides the Laboratory sample's value; the hooks: local width 300, the defaults' minimum width 320 wins over it.
        command(configure(JSONObject().put("label","Fruit").put("options",fruit).put("required",true).put("supportingText","Pick one").put("value","")) {
            put("autocompleteAppearance",JSONObject().put("width",300).put("caretColor","#C62828"))
            put("autocompleteAppearanceDefaults",JSONObject().put("minWidth",320).put("width",260)) });Thread.sleep(250)
        var frame=command(frameCommand)
        assertEquals(320.0,host(frame).getJSONObject("bounds").getDouble("width"),0.6)
        assertTrue("caret and field are measured",nodes(frame).any { it.optString("name")=="caret" } && nodes(frame).any { it.optString("name")=="field" })
        // Popup methods: showMenu opens without focus, closeMenu plays the exit; both report their events.
        events.clear();command(method("showMenu"));settle()
        assertTrue("mdOpen after showMenu: ${names()}","mdOpen" in names())
        command(method("closeMenu"));settle()
        assertTrue("mdClose after closeMenu: ${names()}","mdClose" in names())
        // loadOptions replaces the list; getLabels reads labels (unknown values map to themselves).
        command(method("loadOptions",JSONArray().put(JSONObject().put("value","kiwi")).put(JSONObject().put("value","lime").put("label","Lime").put("supportingText","Citrus"))))
        var r=command(method("getLabels",JSONArray().put("lime").put("kiwi").put("zz"))).getJSONObject("result").getJSONObject("awcAutocompleteLabels")
        assertEquals("Lime",r.getString("lime"));assertEquals("kiwi",r.getString("kiwi"));assertEquals("zz",r.getString("zz"))
        // Validity: required without a value → valueMissing ("Please make a selection"); a custom error wins; a value clears it.
        var v=command(method("getValidity")).getJSONObject("result")
        assertFalse(v.toString(),v.getBoolean("valid"));assertTrue(v.toString(),v.getJSONObject("flags").getBoolean("valueMissing"));assertEquals("Please make a selection",v.getString("validationMessage"))
        command(method("setCustomValidity","Out of season"));v=command(method("getValidity")).getJSONObject("result")
        assertTrue(v.toString(),v.getJSONObject("flags").getBoolean("customError"));assertEquals("Out of season",v.getString("validationMessage"))
        command(method("setCustomValidity",""));assertFalse(command(method("checkValidity")).getBoolean("result"))
        assertFalse(command(method("reportValidity")).getBoolean("result"))
        command(update(JSONObject().put("value","lime")));Thread.sleep(120)
        assertTrue("a value satisfies required",command(method("checkValidity")).getBoolean("result"))
        command(method("focusInput"));Thread.sleep(80)
        // Typed retained updates: multiple with chips inline, density, variant, options as JSON text, limits.
        command(update(JSONObject().put("multiple",true).put("value",JSONArray().put("a").put("d")).put("options",fruit.toString()).put("chipPosition","inline")
            .put("density",-2).put("variant","outlined").put("limitResults",2).put("maxSelected",3).put("statusTemplate","{count} fruit").put("placement","top-start")
            .put("maxHeight",JSONObject.NULL).put("clearOnBlur",true).put("loading",false)));Thread.sleep(150)
        frame=command(frameCommand)
        assertTrue("two chips: ${nodes(frame).map { it.optString("name") }}",nodes(frame).count { it.optString("name")=="chip" }==2)
        r=command(method("getLabels",JSONArray().put("a").put("d"))).getJSONObject("result").getJSONObject("awcAutocompleteLabels")
        assertEquals("Apple",r.getString("a"));assertEquals("Banana",r.getString("d"))
        command(update(JSONObject().put("loading",true)));Thread.sleep(120);frame=command(frameCommand)
        assertTrue("the spinner replaces the caret",nodes(frame).any { it.optString("name")=="loading-spinner" })
        for(bad in listOf(JSONObject().put("chipPosition","bottom"),JSONObject().put("bogus",1),JSONObject().put("density",-5),JSONObject().put("value",3),
                JSONObject().put("options",JSONArray().put(JSONObject().put("label","No value"))),JSONObject().put("options",JSONArray().put("kiwi")),JSONObject().put("limitResults",-1),JSONObject().put("filterer","x"),JSONObject().put("virtualize","always")))
            assertRejected(token,update(bad))
        assertRejected(token,method("loadOptions","kiwi"));assertRejected(token,method("getLabels",JSONArray().put(1)));assertRejected(token,method("showMenu",1));assertRejected(token,method("setCustomValidity"))
    } }
    private fun assertRejected(token:String,body:JSONObject) { val response=request("POST","/command",token,body);assertTrue("$body rejected: $response",response.first>=400 || response.second.has("error")) }
    private fun nodes(frame:JSONObject)=frame.getJSONObject("inspection").getJSONArray("nodes").let { a->(0 until a.length()).map { a.getJSONObject(it) } }
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
