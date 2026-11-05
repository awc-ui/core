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

/** Laboratory host: n5's navigation components (md-toolbar) — typed hooks (defaults first, local values win), retained
 *  property updates with the source types, setFocus() through AWCToolbarController, and the lifecycle (a new session binds
 *  a fresh controller). */
class LivePreviewNavHostTest {
    private fun configure(tag:String,properties:JSONObject,extra:JSONObject.()->Unit={})=JSONObject().put("command","configure").put("tag",tag).put("width",640).put("dark",false).put("properties",properties).apply(extra)
    private fun method(name:String,vararg args:Any)=JSONObject().put("command","method").put("method",name).put("arguments",JSONArray(args.toList()))
    private fun update(properties:JSONObject)=JSONObject().put("command","update").put("properties",properties)
    private val frameCommand get()=JSONObject().put("command","frame")

    @Test fun toolbarHooksUpdatesAndSetFocus() { withHost { token,command->
        command(configure("md-toolbar",JSONObject().put("variant","floating").put("ariaLabelProp","Formatting")) {
            put("toolbarAppearanceDefaults",JSONObject().put("containerColor","#E0F7FA").put("containerHeight",80)); put("toolbarAppearance",JSONObject().put("containerColor","#FFE0B2")) })
        Thread.sleep(300)
        var f=command(frameCommand);var box=bounds(f,"md-toolbar")
        // The local colour wins over the default; the default height applies where no local value is set.
        assertColor("pill colour hook (local wins)",0xFFE0B2,pixel(f,box.x+box.w/2,box.y+3))
        assertEquals("pill height from the default hook",80.0,box.h,0.6)
        assertTrue("horizontal pill (${box.w}x${box.h})",box.w>box.h)
        command(method("setFocus"))
        assertRejected(token,method("setFocus",1));assertRejected(token,method("expand"))
        command(update(JSONObject().put("layout","vertical")));Thread.sleep(150)
        f=command(frameCommand);box=bounds(f,"md-toolbar");assertTrue("vertical pill (${box.w}x${box.h})",box.h>box.w)
        command(update(JSONObject().put("variant","docked").put("density",-2)));Thread.sleep(150)
        f=command(frameCommand);box=bounds(f,"md-toolbar")
        assertEquals("the default height hook sizes the docked bar too (a hooked height ignores density)",80.0,box.h,0.6);assertTrue("a docked bar fills the preview's content width (${box.w})",box.w>=560.0)
        command(update(JSONObject().put("containerSemantics","generic").put("color","vibrant").put("alignment","center").put("ariaLabelledby","title")))
        command(update(JSONObject().put("containerSemantics","toolbar")))
        for(bad in listOf(JSONObject().put("variant","pill"),JSONObject().put("layout","diagonal"),JSONObject().put("density",-5),JSONObject().put("alignment","around"),JSONObject().put("bogus",1),JSONObject().put("ariaLabelProp",3)))
            assertRejected(token,update(bad))
    } }

    @Test fun toolbarLifecycle() {
        // A new session starts from its own configuration and binds a fresh controller.
        for(label in listOf("Formatting","Edit")) withHost { _,command->
            command(configure("md-toolbar",JSONObject().put("variant","docked").put("ariaLabelProp",label)));Thread.sleep(250)
            val box=bounds(command(frameCommand),"md-toolbar");assertEquals("docked bar height",64.0,box.h,0.6)
            command(method("setFocus"))
        }
    }

    private data class Box(val x:Double,val y:Double,val w:Double,val h:Double)
    private fun bounds(frame:JSONObject,name:String):Box {
        val matches=nodes(frame).filter { it.optString("name")==name }
        assertTrue("$name in ${nodes(frame).map { it.getString("id")+"/"+it.optString("name") }}",matches.isNotEmpty())
        val b=matches.first().getJSONObject("bounds");return Box(b.getDouble("x"),b.getDouble("y"),b.getDouble("width"),b.getDouble("height"))
    }
    private fun assertRejected(token:String,body:JSONObject) { val response=request("POST","/command",token,body);assertTrue("$body rejected: $response",response.first>=400 || response.second.has("error")) }
    private fun nodes(frame:JSONObject)=frame.getJSONObject("inspection").getJSONArray("nodes").let { a->(0 until a.length()).map { a.getJSONObject(it) } }
    private fun events(frame:JSONObject):List<JSONObject> = frame.optJSONArray("events")?.let { a->(0 until a.length()).map { a.getJSONObject(it) } } ?: emptyList()
    private fun bitmap(frame:JSONObject):Bitmap { val bytes=Base64.decode(frame.getString("png"),Base64.DEFAULT);return BitmapFactory.decodeByteArray(bytes,0,bytes.size) }
    private fun pixel(frame:JSONObject,x:Double,y:Double):Int { val b=bitmap(frame);val scale=b.width/640.0;return b.getPixel((x*scale).toInt(),(y*scale).toInt()) }
    private fun near(a:Int,b:Int,tol:Int)=listOf(16,8,0).all { abs((a shr it and 255)-(b shr it and 255))<=tol }
    /** Pixels that differ from the background [color] by more than 3 per channel (glyph ink, anti-aliasing included). */
    private fun ink(frame:JSONObject,color:Int,x0:Double,y0:Double,x1:Double,y1:Double):Int {
        val b=bitmap(frame);val s=b.width/640.0;var n=0
        for(y in (y0*s).toInt() until (y1*s).toInt()) for(x in (x0*s).toInt() until (x1*s).toInt()) if(!near(b.getPixel(x,y),color,3)) n++
        return n
    }
    private fun assertColor(label:String,expected:Int,actual:Int) =
        assertTrue("$label: expected #%06X, got #%06X".format(expected,actual and 0xFFFFFF),near(expected,actual,3))
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
