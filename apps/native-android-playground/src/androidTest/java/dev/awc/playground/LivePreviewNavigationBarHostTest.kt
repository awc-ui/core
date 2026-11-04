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

/** Laboratory host: the md-navigation-bar recipe bar, typed hooks, announced activeIndex writes, select / focusTab, and the destination page. */
class LivePreviewNavigationBarHostTest {
    private fun configure(tag:String,properties:JSONObject,extra:JSONObject.()->Unit={})=JSONObject().put("command","configure").put("tag",tag).put("width",640).put("dark",false).put("properties",properties).apply(extra)
    private fun method(name:String,vararg args:Any)=JSONObject().put("command","method").put("method",name).put("arguments",JSONArray(args.toList()))
    private fun update(properties:JSONObject)=JSONObject().put("command","update").put("properties",properties)
    private val frameCommand get()=JSONObject().put("command","frame")
    /** Pixels of `color` along the row at `y` (dp) across the box. */
    private fun count(frame:JSONObject,box:JSONObject,color:Int,y:Double=box.getDouble("y")+box.getDouble("height")/2):Int { val b=bitmap(frame);val s=b.width/640.0;var n=0
        val py=(y*s).toInt().coerceIn(0,b.height-1)
        for(x in (box.getDouble("x")*s).toInt() until ((box.getDouble("x")+box.getDouble("width"))*s).toInt().coerceAtMost(b.width-1)) if(listOf(16,8,0).all { abs((color shr it and 255)-(b.getPixel(x,py) shr it and 255))<=3 }) n++
        return n }
    private fun events(r:JSONObject)=r.optJSONArray("events")?.let { a->(0 until a.length()).map { a.getJSONObject(it) } }.orEmpty()
    private fun changes(r:JSONObject)=events(r).filter { it.getString("name")=="mdChange" }
    @Test fun barHooksSelectAndUpdates() { withHost { token,command->
        command(configure("md-navigation-bar",JSONObject()) { put("navigationBarAppearance",JSONObject().put("containerColor","#E8F5E9").put("activeIndicatorColor","#FFCC80")) });Thread.sleep(900)
        val frame=command(frameCommand);val box=root(frame,"md-navigation-bar")
        val host=count(frame,box,0xE8F5E9,box.getDouble("y")+2)
        assertTrue("the bar takes the container hook ($host px)",host>200)
        val pill=count(frame,box,0xFFCC80,box.getDouble("y")+12)
        assertTrue("the active indicator takes the colour hook ($pill px)",pill>20)
        var r=command(method("select",2))
        assertTrue("select(2) emits mdChange ${events(r)}",changes(r).size==1 && changes(r)[0].getJSONObject("detail").getInt("index")==2 && changes(r)[0].getJSONObject("detail").getInt("previousIndex")==0)
        r=command(method("select",2));assertTrue("selecting the active destination again emits nothing",changes(r).isEmpty())
        r=command(method("focusTab",0));assertTrue("focusTab does not select",changes(r).isEmpty())
        r=command(update(JSONObject().put("activeIndex",1)));Thread.sleep(300)
        command(update(JSONObject().put("labelBehavior","selected").put("manualActivation",true)));Thread.sleep(300)
        assertRejected(token,update(JSONObject().put("labelBehavior","hidden")));assertRejected(token,update(JSONObject().put("bogus",1)))
        assertRejected(token,method("select"));assertRejected(token,method("select","1"));assertRejected(token,method("selectTab",1))
    } }
    @Test fun destinationPage() { withHost { token,command->
        command(configure("md-navigation-tab",JSONObject()) { put("navigationTabAppearance",JSONObject().put("activeIndicatorColor","#FFCC80")) });Thread.sleep(900)
        val frame=command(frameCommand);val tab=root(frame,"md-navigation-tab")
        assertTrue("the standalone destination takes the indicator hook",count(frame,tab,0xFFCC80,tab.getDouble("y")+12)>20)
        command(update(JSONObject().put("badgeValue","1200").put("softDisabled",true)));Thread.sleep(300)
        command(method("focusEl"))
        assertRejected(token,update(JSONObject().put("badge","yes")));assertRejected(token,method("focusEl",1))
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
