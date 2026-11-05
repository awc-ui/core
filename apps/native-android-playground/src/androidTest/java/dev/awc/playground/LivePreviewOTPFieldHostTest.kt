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

/** Laboratory host: md-otp-field with typed hooks, retained property updates and the focus / clear / validation methods with results. */
class LivePreviewOTPFieldHostTest {
    private fun configure(properties:JSONObject,extra:JSONObject.()->Unit={})=JSONObject().put("command","configure").put("tag","md-otp-field").put("width",640).put("dark",false).put("properties",properties).apply(extra)
    private fun method(name:String,vararg args:Any)=JSONObject().put("command","method").put("method",name).put("arguments",JSONArray(args.toList()))
    private fun update(properties:JSONObject)=JSONObject().put("command","update").put("properties",properties)
    private val frameCommand get()=JSONObject().put("command","frame")
    @Test fun otpFieldHooksUpdatesAndMethods() { withHost { token,command->
        command(configure(JSONObject().put("label","Verification code").put("required",true).put("incompleteLabel","Enter all six digits.").put("value","12")) {
            put("otpFieldAppearance",JSONObject().put("cellWidth",52).put("outlineColor","#1565C0")) });Thread.sleep(250)
        var frame=command(frameCommand);val cell=part(frame,"cell-5")
        assertEquals(52.0,part(frame,"cell-0").getDouble("width"),0.6)
        assertColor("outline hook",0x1565C0,pixel(frame,cell.getDouble("x")+cell.getDouble("width")/2,cell.getDouble("y")+0.4))
        var v=command(method("getValidity")).getJSONObject("result")
        assertFalse(v.toString(),v.getBoolean("valid"));assertTrue(v.toString(),v.getJSONObject("flags").getBoolean("valueMissing"));assertEquals("Enter all six digits.",v.getString("validationMessage"))
        command(update(JSONObject().put("value","12 34-56x")));Thread.sleep(80);assertTrue("complete code",command(method("checkValidity")).getBoolean("result"))
        command(method("setCustomValidity","Expired"));v=command(method("getValidity")).getJSONObject("result")
        assertTrue(v.toString(),v.getJSONObject("flags").getBoolean("customError"));assertEquals("Expired",v.getString("validationMessage"))
        command(method("setCustomValidity",""));command(method("clear"));Thread.sleep(80)
        v=command(method("getValidity")).getJSONObject("result");assertEquals("Please enter the complete code.",v.getString("validationMessage"))
        assertFalse(command(method("reportValidity")).getBoolean("result"))
        command(update(JSONObject().put("disabled",true)));Thread.sleep(80);assertTrue("barred",command(method("checkValidity")).getBoolean("result"))
        command(update(JSONObject().put("disabled",false).put("length",4).put("groupSize",2).put("validationType","alphanumeric").put("transform","uppercase").put("mask",true).put("density",-2).put("value","ab1")))
        Thread.sleep(120);frame=command(frameCommand)
        assertTrue("four cells",nodes(frame).any { it.optString("name")=="cell-3" } && nodes(frame).none { it.optString("name")=="cell-4" })
        assertTrue("group separator",nodes(frame).any { it.optString("name")=="separator-0" })
        command(method("setFocus"));Thread.sleep(80)
        for(bad in listOf(JSONObject().put("length",0),JSONObject().put("validationType","hex"),JSONObject().put("bogus",1),JSONObject().put("mask","yes"),JSONObject().put("value",12),JSONObject().put("density",-5)))
            assertRejected(token,update(bad))
        assertRejected(token,method("clear",1));assertRejected(token,method("setCustomValidity"));assertRejected(token,method("select"))
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
