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

/** Laboratory host: md-ripple on its token-styled recipe surface, typed hooks, the retained `disabled` update and trigger()/whenSettled(). */
class LivePreviewRippleHostTest {
    private fun configure(properties:JSONObject,extra:JSONObject.()->Unit={})=JSONObject().put("command","configure").put("tag","md-ripple").put("width",640).put("dark",false).put("properties",properties).apply(extra)
    private fun method(name:String,vararg args:Any)=JSONObject().put("command","method").put("method",name).put("arguments",JSONArray(args.toList()))
    private fun update(properties:JSONObject)=JSONObject().put("command","update").put("properties",properties)
    private val frameCommand get()=JSONObject().put("command","frame")
    @Test fun rippleSurfaceHooksUpdatesAndMethods() { withHost { token,command->
        command(configure(JSONObject()) { put("rippleAppearance",JSONObject().put("color","#123456").put("opacity",1.0).put("growDuration",2000).put("growEasing","linear")) });Thread.sleep(250)
        var frame=command(frameCommand);val box=root(frame,"md-ripple")
        assertTrue("recipe surface size ${box}",box.getDouble("width")>120 && abs(box.getDouble("height")-52.0)<=1.0)
        val surface=pixel(frame,box.getDouble("x")+4,box.getDouble("y")+box.getDouble("height")/2)
        assertColor("surface-container-highest",0xE6E0E9,surface)
        command(method("trigger"));Thread.sleep(80);frame=command(frameCommand)
        assertColor("an opaque #123456 wave grows from the centre",0x123456,pixel(frame,box.getDouble("x")+box.getDouble("width")/2,box.getDouble("y")+box.getDouble("height")/2))
        val t0=System.currentTimeMillis();command(method("whenSettled"));assertTrue("whenSettled returns",System.currentTimeMillis()-t0<1500)
        Thread.sleep(2600);frame=command(frameCommand)
        assertColor("the trigger wave ends",0xE6E0E9,pixel(frame,box.getDouble("x")+4,box.getDouble("y")+box.getDouble("height")/2))
        command(update(JSONObject().put("disabled",true)));command(method("trigger"));Thread.sleep(80);frame=command(frameCommand)
        assertTrue("no wave while disabled",rgb(pixel(frame,box.getDouble("x")+box.getDouble("width")/2,box.getDouble("y")+box.getDouble("height")/2))!=0x123456)
        assertRejected(token,update(JSONObject().put("disabled","yes")));assertRejected(token,update(JSONObject().put("bogus",1)));assertRejected(token,method("trigger",1));assertRejected(token,method("show"))
    } }
    private fun assertRejected(token:String,body:JSONObject) { val response=request("POST","/command",token,body);assertTrue("$body rejected: $response",response.first>=400 || response.second.has("error")) }
    private fun nodes(frame:JSONObject)=frame.getJSONObject("inspection").getJSONArray("nodes").let { a->(0 until a.length()).map { a.getJSONObject(it) } }
    private fun root(frame:JSONObject,tag:String):JSONObject {
        val matches=nodes(frame).filter { it.getString("id")=="component" && it.optString("name")==tag }
        assertEquals("$tag root in ${nodes(frame).map { it.getString("id")+"/"+it.optString("name") }}",1,matches.size)
        return matches.single().getJSONObject("bounds")
    }
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
