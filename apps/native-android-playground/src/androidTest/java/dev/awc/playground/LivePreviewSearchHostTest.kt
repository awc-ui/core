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

/** Laboratory host: md-search with typed hooks, retained property updates and the controller methods the preview runs. */
class LivePreviewSearchHostTest {
    private fun configure(properties:JSONObject,extra:JSONObject.()->Unit={})=JSONObject().put("command","configure").put("tag","md-search").put("width",640).put("dark",false).put("properties",properties).apply(extra)
    private fun method(name:String,vararg args:Any)=JSONObject().put("command","method").put("method",name).put("arguments",JSONArray(args.toList()))
    private fun update(properties:JSONObject)=JSONObject().put("command","update").put("properties",properties)
    private val frameCommand get()=JSONObject().put("command","frame")
    @Test fun searchHooksUpdatesAndMethods() { withHost { token,command->
        command(configure(JSONObject().put("layout","docked").put("placeholder","Search projects").put("value","pro").put("open",false)) {
            put("searchAppearance",JSONObject().put("containerColor","#FFF3E0").put("containerHeight",64).put("expandEasing",JSONArray(listOf(0.2,0,0,1)))) });Thread.sleep(300)
        var frame=command(frameCommand);var bar=part(frame,"bar")
        assertEquals("container height hook",64.0,bar.getDouble("height"),0.6)
        assertColor("container hook",0xFFF3E0,pixel(frame,bar.getDouble("x")+bar.getDouble("width")/2,bar.getDouble("y")+4))
        assertFalse("closed: no panel content",nodes(frame).any { it.optString("name")=="results-viewport" && it.getJSONObject("bounds").getDouble("height")>1 })
        command(method("show"));Thread.sleep(500);frame=command(frameCommand)
        assertTrue("show() reveals the panel",nodes(frame).any { it.optString("name")=="panel" && it.getJSONObject("bounds").getDouble("height")>1 })
        command(method("toggle"));Thread.sleep(700);command(method("toggle"));Thread.sleep(500);command(method("close"));Thread.sleep(700);command(method("focusInput"));Thread.sleep(150)
        command(update(JSONObject().put("variant","divided").put("density",-2).put("elevation",3).put("showClearButton",false).put("open",true)));Thread.sleep(500);frame=command(frameCommand)
        assertTrue("divider of the divided variant",nodes(frame).any { it.optString("name")=="divider" })
        assertFalse("showClearButton=false removes the clear button",nodes(frame).any { it.optString("name")=="clear-button" })
        for(bad in listOf(JSONObject().put("variant","plain"),JSONObject().put("bogus",1),JSONObject().put("density",-5),JSONObject().put("elevation",6),JSONObject().put("open","true"),JSONObject().put("debounce",-1)))
            assertRejected(token,update(bad))
        assertRejected(token,method("show",1));assertRejected(token,method("startVoice"));assertRejected(token,method("whenClosed"))
    } }
    @Test fun searchAcceptsViewportHeight() { withHost { token,command->
        command(configure(JSONObject().put("layout","docked").put("placeholder","Search projects").put("value","pro").put("open",true)) { put("height",400) });Thread.sleep(600)
        val frame=command(frameCommand); val panel=nodes(frame).first { it.optString("name")=="panel" }.getJSONObject("bounds")
        assertTrue("docked panel not clipped to the 240 px default (height ${panel.getDouble("height")})",panel.getDouble("height")>60)
        assertRejected(token,configure(JSONObject().put("label","x")) { put("tag","md-chip");put("height",400) })
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
