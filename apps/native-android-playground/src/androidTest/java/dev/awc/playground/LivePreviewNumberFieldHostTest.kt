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
import kotlin.math.abs

/** Laboratory host: md-number-field with typed hooks, retained property updates and the stepping / validation / focus methods with results. */
class LivePreviewNumberFieldHostTest {
    private fun configure(properties:JSONObject,extra:JSONObject.()->Unit={})=JSONObject().put("command","configure").put("tag","md-number-field").put("width",640).put("dark",false).put("properties",properties).apply(extra)
    private fun method(name:String,vararg args:Any)=JSONObject().put("command","method").put("method",name).put("arguments",JSONArray(args.toList()))
    private fun update(properties:JSONObject)=JSONObject().put("command","update").put("properties",properties)
    private val frameCommand get()=JSONObject().put("command","frame")
    private fun host(frame:JSONObject)=nodes(frame).first { it.optString("name")=="md-number-field" }
    @Test fun numberFieldHooksUpdatesAndMethods() { withHost { token,raw->
        // Every command reply carries the md* events the native field dispatched since the previous one.
        val events=mutableListOf<JSONObject>()
        val command={ body:JSONObject-> raw(body).also { r-> r.optJSONArray("events")?.let { a-> for(i in 0 until a.length()) events+=a.getJSONObject(i) } } }
        fun last(name:String)=events.lastOrNull { it.getString("name")==name }?.getJSONObject("detail")
        command(configure(JSONObject().put("label","Guests").put("value",2).put("min",0).put("max",8).put("required",true).put("supportingText","Up to 8")) {
            put("numberFieldAppearance",JSONObject().put("stepperColor","#C62828").put("width",300)) });Thread.sleep(250)
        var frame=command(frameCommand)
        assertEquals(300.0,host(frame).getJSONObject("bounds").getDouble("width"),0.6)
        assertTrue("steppers",nodes(frame).any { it.optString("name")=="increment" } && nodes(frame).any { it.optString("name")=="decrement" })
        fun step(name:String,vararg args:Any,expect:Double) { command(method(name,*args));Thread.sleep(80);command(frameCommand)
            val d=last("mdChange");assertNotNull("$name mdChange",d);assertEquals("$name ${args.toList()}",expect,d!!.getDouble("value"),1e-9);assertEquals("none",d.getString("reason")) }
        step("stepUp",expect=3.0);step("stepUp",3,expect=6.0);step("stepUp",10,expect=8.0);step("stepDown",2.5,expect=5.5)
        var v=command(method("getValidity")).getJSONObject("result");assertTrue(v.toString(),v.getBoolean("valid"))
        command(update(JSONObject().put("value",JSONObject.NULL)));Thread.sleep(80)
        v=command(method("getValidity")).getJSONObject("result")
        assertFalse(v.toString(),v.getBoolean("valid"));assertTrue(v.toString(),v.getJSONObject("flags").getBoolean("valueMissing"));assertEquals("Please enter a number.",v.getString("validationMessage"))
        command(method("setCustomValidity","Too many"));v=command(method("getValidity")).getJSONObject("result")
        assertTrue(v.toString(),v.getJSONObject("flags").getBoolean("customError"));assertEquals("Too many",v.getString("validationMessage"))
        command(method("setCustomValidity",""));assertFalse(command(method("reportValidity")).getBoolean("result"))
        command(update(JSONObject().put("disabled",true)));Thread.sleep(80);assertTrue("barred",command(method("checkValidity")).getBoolean("result"))
        command(update(JSONObject().put("disabled",false).put("max",JSONObject.NULL).put("value",1234.5).put("locale","de-DE").put("formatOptions",JSONObject().put("minimumFractionDigits",2))
            .put("steppers","split").put("density",-2).put("variant","outlined")));Thread.sleep(120)
        frame=command(frameCommand);assertTrue("split steppers",nodes(frame).any { it.optString("name")=="increment" })
        command(method("stepUp"));Thread.sleep(80);command(frameCommand)
        assertEquals("locale + formatOptions","1.235,50",last("mdChange")?.getString("formattedValue"))
        command(method("select"));command(method("setFocus"));Thread.sleep(80)
        for(bad in listOf(JSONObject().put("steppers","trailing"),JSONObject().put("bogus",1),JSONObject().put("density",-5),JSONObject().put("value","12"),JSONObject().put("step",JSONObject.NULL),
                JSONObject().put("formatOptions",JSONObject().put("style",JSONObject().put("nested",1)))))
            assertRejected(token,update(bad))
        assertRejected(token,method("stepUp","3"));assertRejected(token,method("stepDown",1,2));assertRejected(token,method("select",1));assertRejected(token,method("setCustomValidity"))
    } }
    private fun part(frame:JSONObject,name:String):JSONObject {
        val matches=nodes(frame).filter { it.optString("name")==name }
        assertTrue("$name in ${nodes(frame).map { it.getString("id")+"/"+it.optString("name") }}",matches.isNotEmpty())
        return matches.first().getJSONObject("bounds")
    }
    private fun assertRejected(token:String,body:JSONObject) { val response=request("POST","/command",token,body);assertTrue("$body rejected: $response",response.first>=400 || response.second.has("error")) }
    private fun nodes(frame:JSONObject)=frame.getJSONObject("inspection").getJSONArray("nodes").let { a->(0 until a.length()).map { a.getJSONObject(it) } }
    private fun bitmap(frame:JSONObject):Bitmap { val bytes=Base64.decode(frame.getString("png"),Base64.DEFAULT);return BitmapFactory.decodeByteArray(bytes,0,bytes.size) }
    private fun pixel(frame:JSONObject,x:Double,y:Double):Int { val b=bitmap(frame);val scale=b.width/640.0;return b.getPixel((x*scale).toInt(),(y*scale).toInt()) }
    private fun rgb(color:Int)=color and 0xFFFFFF
    private fun assertColor(label:String,expected:Int,actual:Int) {
        val ok=listOf(16,8,0).all { abs((expected shr it and 255)-(actual shr it and 255))<=3 }
        assertTrue("$label: expected #%06X, got #%06X".format(expected,rgb(actual)),ok)
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
