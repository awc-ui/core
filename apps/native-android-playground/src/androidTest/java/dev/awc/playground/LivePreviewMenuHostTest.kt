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

/** Laboratory host: the md-menu recipe (trigger toggle), typed hooks, show/close/whenClosed, reposition, retained updates and collapse. */
class LivePreviewMenuHostTest {
    private fun configure(tag:String,properties:JSONObject,extra:JSONObject.()->Unit={})=JSONObject().put("command","configure").put("tag",tag).put("width",640).put("dark",false).put("properties",properties).apply(extra)
    private fun method(name:String,vararg args:Any)=JSONObject().put("command","method").put("method",name).put("arguments",JSONArray(args.toList()))
    private fun call(id:String,name:String,vararg args:Any)=method(name,*args).put("callId",id).put("target","component")
    private fun results(vararg ids:String)=JSONObject().put("command","method-results").put("callIds",JSONArray(ids.toList())).put("acknowledged",JSONArray())
    private fun update(properties:JSONObject)=JSONObject().put("command","update").put("properties",properties)
    private fun click(x:Double,y:Double)=JSONObject().put("command","click").put("x",x).put("y",y)
    private fun key(name:String)=JSONObject().put("command","key").put("key",name)
    private val frameCommand get()=JSONObject().put("command","frame")
    private fun events(r:JSONObject)=r.optJSONArray("events")?.let { a->(0 until a.length()).map { a.getJSONObject(it) } }.orEmpty()
    private fun named(r:JSONObject,name:String)=events(r).count { it.getString("name")==name }
    private fun bitmap(frame:JSONObject):Bitmap { val bytes=Base64.decode(frame.getString("png"),Base64.DEFAULT);return BitmapFactory.decodeByteArray(bytes,0,bytes.size) }
    private fun near(a:Int,b:Int)=listOf(16,8,0).all { abs((a shr it and 255)-(b shr it and 255))<=3 }
    /** The tonal trigger (secondary container #E8DEF8) on the centre line: its top edge in dp. */
    private fun trigger(frame:JSONObject):Double { val b=bitmap(frame);val s=b.width/640.0;val x=(320*s).toInt()
        for(y in 0 until b.height) if(near(b.getPixel(x,y),0xE8DEF8)) return y/s
        fail("no tonal trigger on the centre line");return 0.0 }
    /** Pixels of the menu container (surface container #F3EDF7) on the row `y` (dp). */
    private fun surface(frame:JSONObject,y:Double):Int { val b=bitmap(frame);val s=b.width/640.0;val py=(y*s).toInt().coerceIn(0,b.height-1)
        return (0 until b.width).count { near(b.getPixel(it,py),0xF3EDF7) } }
    /** Menu container pixels in the whole frame (every second pixel). */
    private fun area(frame:JSONObject):Int { val b=bitmap(frame);var n=0
        for(y in 0 until b.height step 2) for(x in 0 until b.width step 2) if(near(b.getPixel(x,y),0xF3EDF7)) n++
        return n }
    /** Menu container pixels right of x = `fromX` dp (every second pixel). */
    private fun beyond(frame:JSONObject,fromX:Double):Int { val b=bitmap(frame);val s=b.width/640.0;var n=0
        for(y in 0 until b.height step 2) for(x in (fromX*s).toInt() until b.width step 2) if(near(b.getPixel(x,y),0xF3EDF7)) n++
        return n }
    private fun nodes(frame:JSONObject)=frame.optJSONObject("inspection")?.optJSONArray("nodes")?.let { a->(0 until a.length()).map { a.getJSONObject(it) } }.orEmpty()
    private fun status(r:JSONObject,id:String)=r.getJSONArray("methodResults").let { a->(0 until a.length()).map { a.getJSONObject(it) }.single { it.getString("callId")==id }.getString("status") }

    @Test fun menuRecipeHooksAndLifecycle() { withHost { token,command->
        command(configure("md-menu",JSONObject()) { put("menuAppearance",JSONObject().put("minWidth",260).put("itemHeight",56)) });Thread.sleep(900)
        var frame=command(frameCommand);val top=trigger(frame)
        assertTrue("the menu starts closed",surface(frame,top+80)<20)
        var r=command(click(320.0,top+20));Thread.sleep(600)
        frame=command(frameCommand)
        assertEquals("the trigger opens the menu (mdOpen) ${events(r)+events(frame)}",1,named(r,"mdOpen")+named(frame,"mdOpen"))
        val open=surface(frame,top+80)
        assertTrue("the open menu paints its container below the trigger ($open px)",open>=(260*bitmap(frame).width/640.0).toInt()-4)
        assertTrue("the menu nodes are inspected ${nodes(frame).map { it.optString("id") }}",nodes(frame).any { it.optString("id").startsWith("demo-menu") })
        r=command(click(320.0,top+20));Thread.sleep(500);frame=command(frameCommand)
        assertEquals("the trigger toggles it closed (mdClose)",1,named(r,"mdClose")+named(frame,"mdClose"))
        assertTrue("closed",surface(frame,top+80)<20)
        // Lifecycle methods through call IDs.
        assertEquals("accepted","accepted",command(call("s1","show",JSONObject().put("autoFocus",false))).getJSONObject("methodCall").getString("status"))
        Thread.sleep(500);frame=command(frameCommand);assertTrue("show() opens",surface(frame,top+80)>200)
        assertEquals("fulfilled",status(command(results("s1")),"s1"))
        command(call("w1","whenClosed"));Thread.sleep(100)
        assertEquals("whenClosed() waits for the close","pending",status(command(results("w1")),"w1"))
        command(call("c1","close"));Thread.sleep(500)
        r=command(results("w1","c1"));assertEquals("whenClosed() settles after the exit","fulfilled",status(r,"w1"));assertEquals("fulfilled",status(r,"c1"))
        frame=command(frameCommand);assertTrue("close() closes",surface(frame,top+80)<20)
        command(method("reposition"))
        assertRejected(token,method("reposition",1));assertRejected(token,call("x1","show",JSONObject().put("autoFocus","yes")));assertRejected(token,call("x2","close",1))
        assertRejected(token,call("x3","toggle"))
        // Retained updates.
        command(update(JSONObject().put("placement","top-start").put("listLabel","Project actions").put("quick",true)))
        command(update(JSONObject().put("open",true)));Thread.sleep(400);frame=command(frameCommand)
        assertTrue("open: true opens the menu (above the trigger: top-start)",surface(frame,top-30)>200 || surface(frame,top+80)>200)
        assertRejected(token,update(JSONObject().put("placement","left")));assertRejected(token,update(JSONObject().put("open","yes")))
        assertRejected(token,update(JSONObject().put("density",-5)));assertRejected(token,update(JSONObject().put("bogus",1)))
    } }
    @Test fun rowPage() { withHost { token,command->
        command(configure("md-menu-item",JSONObject().put("type","checkbox").put("selected",true)));Thread.sleep(800)
        var frame=command(frameCommand);var top=trigger(frame);val closedArea=area(frame)
        command(click(320.0,top+20));Thread.sleep(600);frame=command(frameCommand)
        // The previewed row is the selected checkbox row (secondary-container fill): count the whole menu container instead.
        val openArea=area(frame)
        assertTrue("the row page opens the recipe menu ($closedArea -> $openArea container samples)",openArea>closedArea+1500)
        command(update(JSONObject().put("headline","Rename").put("disabled",true)))
        assertRejected(token,update(JSONObject().put("type","switch")));assertRejected(token,update(JSONObject().put("anchor","x")))
    } }
    // The debug host configures one element per session: each page gets its own session.
    @Test fun groupPage() { withHost { token,command->
        command(configure("md-menu-item-group",JSONObject()));Thread.sleep(800)
        command(update(JSONObject().put("label","Project")));assertRejected(token,update(JSONObject().put("label",3)))
    } }
    @Test fun submenuPage() { withHost { token,command->
        command(configure("md-sub-menu-item",JSONObject()));Thread.sleep(800)
        var frame=command(frameCommand);val top=trigger(frame)
        command(click(320.0,top+20));Thread.sleep(600)
        command(key("ArrowDown"));command(key("ArrowDown"));Thread.sleep(200)
        command(key("ArrowRight"));Thread.sleep(500);frame=command(frameCommand)
        // The flyout sits beside the root menu (right of x = 460 dp, where the root surface never reaches).
        val withFlyout=beyond(frame,460.0)
        assertTrue("ArrowRight on Export opens its flyout ($withFlyout container samples right of the menu)",withFlyout>200)
        command(method("collapse"));Thread.sleep(300);frame=command(frameCommand)
        val collapsed=beyond(frame,460.0)
        assertTrue("collapse() closes the Export flyout ($withFlyout -> $collapsed samples)",collapsed<20)
        command(update(JSONObject().put("openDelay",0).put("badge","2")))
        assertRejected(token,update(JSONObject().put("openDelay",-1)));assertRejected(token,method("collapse",true))
    } }
    private fun assertRejected(token:String,body:JSONObject) { val response=request("POST","/command",token,body);assertTrue("$body rejected: $response",response.first>=400 || response.second.has("error") || response.second.optJSONObject("methodCall")?.optString("status")=="rejected") }
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
