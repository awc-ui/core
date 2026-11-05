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

/** Laboratory host: md-stepper and md-step — typed hooks (defaults first, local values win), next() / prev() / goTo() / reset()
 *  through AWCStepperController with the source events, retained property updates with the source types (active through the
 *  watcher, readonly, a standalone step's active), rejected updates and methods. */
class LivePreviewStepperHostTest {
    private fun configure(tag:String,properties:JSONObject,extra:JSONObject.()->Unit={})=JSONObject().put("command","configure").put("tag",tag).put("width",640).put("dark",false).put("properties",properties).apply(extra)
    private fun method(name:String,vararg args:Any)=JSONObject().put("command","method").put("method",name).put("arguments",JSONArray(args.toList()))
    private fun update(properties:JSONObject)=JSONObject().put("command","update").put("properties",properties)
    private val frameCommand get()=JSONObject().put("command","frame")

    @Test fun stepperHooksMethodsAndUpdates() { withHost { token,command->
        command(configure("md-stepper",JSONObject()) {
            put("stepperAppearanceDefaults",JSONObject().put("activeColor","#00838F").put("indicatorSize",40)); put("stepperAppearance",JSONObject().put("activeColor","#C62828")) });Thread.sleep(700)
        var f=command(frameCommand);val box=bounds(f,"md-stepper")
        val first=count(f,0xC62828,box.x,box.y,box.x+box.w,box.y+box.h)
        assertTrue("active bubble in the local hook colour ($first px)",first>1500)
        assertEquals("defaults colour replaced",0,count(f,0x00838F,box.x,box.y,box.x+box.w,box.y+box.h))
        val (top,bottom)=extent(f,0xC62828,0.0,box.y,box.y+box.h,whole=box)
        assertTrue("indicator size from the defaults: bubble ${bottom-top} (40 × 1.12)",bottom-top in 42.0..48.0)
        val x0=centroid(f,0xC62828,box)
        var ev=events(command(method("next")))+events(command(frameCommand).also { Thread.sleep(700) });f=command(frameCommand)
        assertEquals("next() events",listOf("mdBeforeChange","mdStepChange"),ev.map { it.getString("name") })
        val x1=centroid(f,0xC62828,box);assertTrue("next(): the active bubble moves to step 2 ($x0 → $x1)",x1>x0+box.w/5)
        command(method("next"));Thread.sleep(700)
        ev=events(command(method("next")))+events(command(frameCommand))
        assertTrue("next() on the last step emits mdComplete: ${ev.map { it.getString("name") }}",ev.map { it.getString("name") }==listOf("mdComplete"))
        command(method("reset"));Thread.sleep(700);f=command(frameCommand)
        assertEquals("reset(): back on step 1",x0,centroid(f,0xC62828,box),4.0)
        ev=events(command(method("goTo",2)))+events(command(frameCommand).also { Thread.sleep(300) })
        assertTrue("goTo(2) — linear, nothing completed: blocked: ${ev.map { it.getString("name") }}",ev.isEmpty())
        command(method("next"));Thread.sleep(700)
        ev=events(command(method("goTo",0)))+events(command(frameCommand).also { Thread.sleep(700) })
        assertTrue("goTo(0) goes back: ${ev.map { it.getString("name") }}",ev.map { it.getString("name") }==listOf("mdBeforeChange","mdStepChange"))
        ev=events(command(update(JSONObject().put("active",2))))+events(command(frameCommand).also { Thread.sleep(700) })+events(command(frameCommand))
        assertTrue("a host write to active runs the watcher (mdStepChange only): ${ev.map { it.getString("name") }}",ev.map { it.getString("name") }==listOf("mdStepChange"))
        f=command(frameCommand);assertTrue("active update moves the bubble to step 3",centroid(f,0xC62828,box)>x1+box.w/5)
        command(update(JSONObject().put("readonly",true).put("label","Checkout")))
        for(bad in listOf(JSONObject().put("orientation","diagonal"),JSONObject().put("active",-1),JSONObject().put("active","1"),JSONObject().put("active",1.5),JSONObject().put("density",2),JSONObject().put("bogus",true))) assertRejected(token,update(bad))
        for(bad in listOf(method("goTo"),method("goTo","x"),method("goTo",-1),method("next",1),method("focusRating"))) assertRejected(token,bad)
    } }

    @Test fun standaloneStepHooksAndUpdates() { withHost { token,command->
        command(configure("md-step",JSONObject().put("label","Workspace").put("active",true)) { put("stepAppearance",JSONObject().put("activeColor","#C62828")) });Thread.sleep(700)
        var f=command(frameCommand);val box=bounds(f,"md-step")
        assertTrue("standalone active step in the hook colour",count(f,0xC62828,box.x,box.y,box.x+box.w,box.y+box.h)>500)
        command(update(JSONObject().put("active",false)));Thread.sleep(700);f=command(frameCommand)
        assertEquals("active false: the pending colour",0,count(f,0xC62828,box.x,box.y,box.x+box.w,box.y+box.h))
        for(bad in listOf(JSONObject().put("active","yes"),JSONObject().put("density",-5),JSONObject().put("getLabel","x"))) assertRejected(token,update(bad))
        assertRejected(token,method("next"))
    } }

    /** Mean x (dp) of the pixels within ±16 of [color] in [box]. */
    private fun centroid(frame:JSONObject,color:Int,box:Box):Double {
        val b=bitmap(frame);val s=b.width/640.0;var sx=0.0;var n=0
        for(y in (box.y*s).toInt().coerceAtLeast(0) until ((box.y+box.h)*s).toInt().coerceAtMost(b.height)) for(x in (box.x*s).toInt().coerceAtLeast(0) until ((box.x+box.w)*s).toInt().coerceAtMost(b.width)) if(near(b.getPixel(x,y),color,16)) { sx+=x;n++ }
        assertTrue("#%06X present".format(color),n>0)
        return sx/n/s
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
    /** Pixels within ±16 of [color] in a dp rectangle. */
    private fun count(frame:JSONObject,color:Int,x0:Double,y0:Double,x1:Double,y1:Double):Int {
        val b=bitmap(frame);val s=b.width/640.0;var n=0
        for(y in (y0*s).toInt().coerceAtLeast(0) until (y1*s).toInt().coerceAtMost(b.height)) for(x in (x0*s).toInt().coerceAtLeast(0) until (x1*s).toInt().coerceAtMost(b.width)) if(near(b.getPixel(x,y),color,16)) n++
        return n
    }
    /** Pixels that differ from the background [color] by more than 3 per channel (glyph ink, anti-aliasing included). */
    private fun ink(frame:JSONObject,color:Int,x0:Double,y0:Double,x1:Double,y1:Double):Int {
        val b=bitmap(frame);val s=b.width/640.0;var n=0
        for(y in (y0*s).toInt() until (y1*s).toInt()) for(x in (x0*s).toInt() until (x1*s).toInt()) if(!near(b.getPixel(x,y),color,3)) n++
        return n
    }
    /** Vertical extent (dp) of [color] in one column, or across [whole] when given. */
    private fun extent(frame:JSONObject,color:Int,x:Double,y0:Double,y1:Double,whole:Box?=null):Pair<Double,Double> {
        val b=bitmap(frame);val s=b.width/640.0
        val columns=if(whole==null) listOf((x*s).toInt()) else ((whole.x*s).toInt() until ((whole.x+whole.w)*s).toInt().coerceAtMost(b.width)).toList()
        val rows=((y0*s).toInt() until (y1*s).toInt().coerceAtMost(b.height)).filter { y-> columns.any { near(b.getPixel(it,y),color,16) } }
        assertTrue("#%06X present".format(color),rows.isNotEmpty())
        return rows.first()/s to (rows.last()+1)/s
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
