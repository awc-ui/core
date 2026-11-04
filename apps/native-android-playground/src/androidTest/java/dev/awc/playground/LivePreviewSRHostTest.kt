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

/** Laboratory host: md-slider and md-rating — typed hooks (defaults first, local values win), retained property updates with the
 *  source types (in place: value, min / max re-clamp, range, precision, max re-clamp), focusRating() with its key follow-up. */
class LivePreviewSRHostTest {
    private fun configure(tag:String,properties:JSONObject,extra:JSONObject.()->Unit={})=JSONObject().put("command","configure").put("tag",tag).put("width",640).put("dark",false).put("properties",properties).apply(extra)
    private fun method(name:String,vararg args:Any)=JSONObject().put("command","method").put("method",name).put("arguments",JSONArray(args.toList()))
    private fun update(properties:JSONObject)=JSONObject().put("command","update").put("properties",properties)
    private val frameCommand get()=JSONObject().put("command","frame")

    @Test fun sliderHooksAndUpdates() { withHost { token,command->
        command(configure("md-slider",JSONObject().put("value",30).put("sliderAriaLabel","Volume")) {
            put("sliderAppearanceDefaults",JSONObject().put("activeColor","#00838F").put("trackHeight",24)); put("sliderAppearance",JSONObject().put("activeColor","#C62828")) });Thread.sleep(250)
        var f=command(frameCommand);val box=bounds(f,"md-slider")
        val active=count(f,0xC62828,box.x,box.y,box.x+box.w,box.y+box.h)
        assertTrue("active track in the local hook colour ($active px)",active>500)
        assertEquals("defaults colour replaced",0,count(f,0x00838F,box.x,box.y,box.x+box.w,box.y+box.h))
        val (top,bottom)=extent(f,0xC62828,box.x+box.w*0.1,box.y,box.y+box.h)
        assertEquals("track height from the defaults",24.0,bottom-top,1.5)
        command(update(JSONObject().put("value",70)));Thread.sleep(150);f=command(frameCommand)
        val longer=count(f,0xC62828,box.x,box.y,box.x+box.w,box.y+box.h);assertTrue("value update lengthens the active track ($active → $longer)",longer>active*3/2)
        val clamp=events(command(update(JSONObject().put("max",50))))+events(command(frameCommand).also { Thread.sleep(150) })
        f=command(frameCommand);val full=count(f,0xC62828,box.x,box.y,box.x+box.w,box.y+box.h)
        assertTrue("max 50 re-clamps 70 to the end of the track ($longer → $full)",full>longer)
        assertTrue("host updates emit nothing: $clamp",clamp.isEmpty())
        command(update(JSONObject().put("range",true).put("valueStart",10).put("valueEnd",30)));Thread.sleep(150);f=command(frameCommand)
        val range=count(f,0xC62828,box.x,box.y,box.x+box.w,box.y+box.h);assertTrue("range update ($full → $range)",range in 1 until full)
        for(bad in listOf(JSONObject().put("size","xxl"),JSONObject().put("value","1"),JSONObject().put("density",2),JSONObject().put("getLabel","x"))) assertRejected(token,update(bad))
        assertRejected(token,method("focusRating"))
    } }

    @Test fun ratingHooksUpdatesAndFocus() { withHost { token,command->
        command(configure("md-rating",JSONObject().put("value",3).put("ratingLabel","Rating")) {
            put("ratingAppearanceDefaults",JSONObject().put("itemSize",48).put("activeColor","#00838F")); put("ratingAppearance",JSONObject().put("activeColor","#FFB300")) });Thread.sleep(250)
        var f=command(frameCommand);val box=bounds(f,"md-rating")
        val (top,bottom)=extent(f,0xFFB300,box.x,box.y,box.y+box.h,whole=box)
        assertTrue("item size from the defaults: star height ${bottom-top}",bottom-top in 34.0..50.0)
        val three=count(f,0xFFB300,box.x,box.y,box.x+box.w,box.y+box.h);assertTrue("active colour: local wins ($three px)",three>500)
        command(method("focusRating"));Thread.sleep(120)
        val keyed=events(command(JSONObject().put("command","key").put("key","ArrowRight")))+events(command(frameCommand))
        assertTrue("focusRating() takes keyboard focus: $keyed",keyed.any { it.getString("name")=="mdChange" && it.optDouble("detail")==4.0 })
        command(update(JSONObject().put("value",2).put("precision",0.5)));Thread.sleep(150);f=command(frameCommand)
        val two=count(f,0xFFB300,box.x,box.y,box.x+box.w,box.y+box.h);assertTrue("value update ($three → $two)",two in 1 until three)
        command(update(JSONObject().put("value",9)));Thread.sleep(150);f=command(frameCommand)
        val five=count(f,0xFFB300,box.x,box.y,box.x+box.w,box.y+box.h);assertTrue("value 9 clamps to the 5 stars ($two → $five)",five>three)
        command(update(JSONObject().put("max",3)));Thread.sleep(150);f=command(frameCommand)
        val maxed=count(f,0xFFB300,box.x,box.y,box.x+box.w,box.y+box.h);assertTrue("max 3 re-clamps ($five → $maxed)",maxed in (three*8/10)..(three*12/10))
        for(bad in listOf(JSONObject().put("precision",0.25),JSONObject().put("getLabel","x"),JSONObject().put("hover","on"))) assertRejected(token,update(bad))
        assertRejected(token,method("focusRating",1));assertRejected(token,method("setZoom",0,1))
    } }

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
