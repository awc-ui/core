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

/** Laboratory host: md-line/area/bar/pie-chart and md-sparkline — typed hooks (defaults first, local values win), retained
 *  property updates with the source types, and the chart methods with results. */
class LivePreviewChartsHostTest {
    private fun configure(tag:String,properties:JSONObject,extra:JSONObject.()->Unit={})=JSONObject().put("command","configure").put("tag",tag).put("width",640).put("dark",false).put("properties",properties).apply(extra)
    private fun method(name:String,vararg args:Any)=JSONObject().put("command","method").put("method",name).put("arguments",JSONArray(args.toList()))
    private fun update(properties:JSONObject)=JSONObject().put("command","update").put("properties",properties)
    private val frameCommand get()=JSONObject().put("command","frame")
    private fun ints(vararg v:Int)=JSONArray(v.toList())
    private val series get()=JSONArray().put(JSONObject().put("label","Revenue").put("data",ints(12,18,15,22,28,26))).put(JSONObject().put("label","Cost").put("data",ints(8,11,10,14,16,18)))
    private val xAxis get()=JSONObject().put("data",JSONArray(listOf("Jan","Feb","Mar","Apr","May","Jun")))

    @Test fun chartHooksUpdatesAndMethods() { withHost { token,command->
        val configured=command(configure("md-line-chart",JSONObject().put("label","Revenue").put("series",series).put("xAxis",xAxis).put("zoom","slider").put("noAnimation",true)) {
            put("lineChartAppearanceDefaults",JSONObject().put("padding",96).put("background","#E0F7FA")); put("lineChartAppearance",JSONObject().put("background","#FFF3E0").put("padding",48)) })
        Thread.sleep(250)
        val first=command(frameCommand);val box=bounds(first,"md-line-chart")
        // Lifecycle: one mdReady after the first render (chart.ts emits it once per connection), none for later renders.
        val mounted=events(configured)+events(first)+events(command(frameCommand))
        assertEquals("one mdReady after mount: $mounted",1,mounted.count { it.getString("name")=="mdReady" })
        assertColor("line background hook (local wins)",0xFFF3E0,pixel(first,box.x+box.w/2,box.y+10))
        // padding 48 (local) wins over 96 (defaults): no ink above the padding edge, the title starts inside 48…94.
        assertEquals("nothing above the padding",0,ink(first,0xFFF3E0,box.x+40,box.y+4,box.x+box.w-40,box.y+44))
        assertTrue("title inside the local padding",ink(first,0xFFF3E0,box.x+40,box.y+48,box.x+box.w-40,box.y+92)>20)
        val zoom=events(command(method("setZoom",1,4)))+events(command(frameCommand).also { Thread.sleep(80) })+events(command(frameCommand))
        assertTrue("setZoom emits mdZoom 1…4: $zoom",zoom.any { it.getString("name")=="mdZoom" && it.getJSONObject("detail").let { d-> d.getInt("startIndex")==1 && d.getInt("endIndex")==4 } })
        val zoomed=command(frameCommand);assertNotEquals("setZoom re-renders",first.getString("png"),zoomed.getString("png"))
        val reset=events(command(method("resetZoom")))+events(command(frameCommand))
        assertTrue("resetZoom emits mdZoom reset: $reset",reset.any { it.getString("name")=="mdZoom" && it.getJSONObject("detail").optBoolean("reset") })
        val url=command(method("toDataURL")).getString("result")
        assertTrue(url.take(40),url.startsWith("data:image/png;base64,"))
        val png=Base64.decode(url.substringAfter(','),Base64.DEFAULT);val image=BitmapFactory.decodeByteArray(png,0,png.size)
        assertNotNull("toDataURL decodes",image);assertTrue("canvas size ${image.width}x${image.height}",image.width>=box.w && image.height>100)
        for(name in listOf("replay","refreshTheme","resize")) command(method(name))
        command(update(JSONObject().put("legend","bottom").put("curve","step").put("series",JSONArray().put(JSONObject().put("label","Revenue").put("data",ints(1,2,3,4,5,6))))))
        Thread.sleep(120);val updated=command(frameCommand);assertNotEquals("series update re-renders",zoomed.getString("png"),updated.getString("png"))
        assertTrue("a retained update does not emit mdReady again",events(updated).none { it.getString("name")=="mdReady" })
        for(bad in listOf(JSONObject().put("curve","bezier"),JSONObject().put("valueFormatter","x"),JSONObject().put("density",-5),JSONObject().put("series","x"),JSONObject().put("bogus",1)))
            assertRejected(token,update(bad))
        assertRejected(token,method("setZoom",1));assertRejected(token,method("getInstance"));assertRejected(token,method("replay",1));assertRejected(token,method("drill",0))
    } }

    @Test fun barPieAndSparkline() {
        withHost { token,command->
            command(configure("md-bar-chart",JSONObject().put("label","Revenue").put("series",series).put("xAxis",xAxis).put("noAnimation",true)) {
                put("barChartAppearance",JSONObject().put("background","#F1F8E9")) });Thread.sleep(200)
            val f=command(frameCommand);val box=bounds(f,"md-bar-chart");assertColor("bar background hook",0xF1F8E9,pixel(f,box.x+box.w/2,box.y+6))
            command(method("drill",0));assertRejected(token,method("drill",0,"left"));assertRejected(token,method("drill",-1))
        }
        withHost { token,command->
            val data=JSONArray().put(JSONObject().put("label","Search").put("value",42)).put(JSONObject().put("label","Direct").put("value",26))
            command(configure("md-pie-chart",JSONObject().put("label","Traffic").put("data",data).put("innerRadius","60%").put("noAnimation",true)) {
                put("pieChartAppearance",JSONObject().put("background","#E3F2FD")) });Thread.sleep(200)
            val f=command(frameCommand);val box=bounds(f,"md-pie-chart");assertColor("pie background hook",0xE3F2FD,pixel(f,box.x+box.w/2,box.y+6))
            command(method("drill",1,"up"));assertRejected(token,method("setZoom",0,1))
            command(update(JSONObject().put("innerRadius","40%").put("highlight","series")));Thread.sleep(120)
            assertNotEquals("pie update re-renders",f.getString("png"),command(frameCommand).getString("png"))
            assertRejected(token,update(JSONObject().put("labelMode","percent")))
        }
        withHost { token,command->
            command(configure("md-sparkline",JSONObject().put("data",ints(3,5,4,7,6,9,8))) { put("sparklineAppearance",JSONObject().put("blockSize",40)) });Thread.sleep(200)
            val box=bounds(command(frameCommand),"md-sparkline");assertEquals("sparkline block size hook",40.0,box.h,0.6)
            command(method("resize"));assertRejected(token,method("replay"));assertRejected(token,method("toDataURL"))
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
