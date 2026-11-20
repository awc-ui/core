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

/** Laboratory host: the md-breadcrumbs recipe trail, typed hooks, retained updates (collapse window, author current) and expand()/collapse(). */
class LivePreviewBreadcrumbsHostTest {
    private fun configure(tag:String,properties:JSONObject,extra:JSONObject.()->Unit={})=JSONObject().put("command","configure").put("tag",tag).put("width",640).put("dark",false).put("properties",properties).apply(extra)
    private fun method(name:String,vararg args:Any)=JSONObject().put("command","method").put("method",name).put("arguments",JSONArray(args.toList()))
    private fun update(properties:JSONObject)=JSONObject().put("command","update").put("properties",properties)
    private val frameCommand get()=JSONObject().put("command","frame")
    private fun count(frame:JSONObject,box:JSONObject,color:Int):Int { val b=bitmap(frame);val s=b.width/640.0;var n=0
        val y=((box.getDouble("y")+box.getDouble("height")/2)*s).toInt()
        for(x in (box.getDouble("x")*s).toInt() until ((box.getDouble("x")+box.getDouble("width"))*s).toInt().coerceAtMost(b.width-1)) if(listOf(16,8,0).all { abs((color shr it and 255)-(b.getPixel(x,y) shr it and 255))<=3 }) n++
        return n }
    /** Glyph ink (gate-7 R6-22 / R6-23): in the band 15–60 % of a box, inset by a quarter of its height at both ends (a pill's round
     *  ends), the dominant colour (the background) and the pixel farthest from it. */
    private fun ink(frame:JSONObject,box:JSONObject):Pair<Int,Int> { val b=bitmap(frame);val s=b.width/640.0;val inset=box.getDouble("height")*.25
        val x0=((box.getDouble("x")+inset)*s).toInt().coerceAtLeast(0);val x1=((box.getDouble("x")+box.getDouble("width")-inset)*s).toInt().coerceAtMost(b.width)
        val y0=((box.getDouble("y")+box.getDouble("height")*.15)*s).toInt().coerceAtLeast(0);val y1=((box.getDouble("y")+box.getDouble("height")*.6)*s).toInt().coerceAtMost(b.height)
        val counts=HashMap<Int,Int>();for(y in y0 until y1)for(x in x0 until x1){val k=b.getPixel(x,y) and 0xFFFFFF;counts[k]=(counts[k]?:0)+1}
        val bg=counts.maxByOrNull { it.value }?.key?:0;var best=bg;var far=-1
        for(y in y0 until y1)for(x in x0 until x1){val p=b.getPixel(x,y) and 0xFFFFFF;val d=listOf(16,8,0).maxOf { abs((p shr it and 255)-(bg shr it and 255)) };if(d>far){far=d;best=p}}
        return bg to best }
    private fun assertInk(label:String,frame:JSONObject,box:JSONObject,color:Int,alpha:Double=1.0) { val (bg,got)=ink(frame,box)
        val ok=listOf(16,8,0).all { abs(((bg shr it and 255)*(1-alpha)+(color shr it and 255)*alpha)-(got shr it and 255))<=12 }
        assertTrue("$label: label ink #%06X on #%06X, expected #%06X at %.2f".format(got,bg,color,alpha),ok) }
    private fun events(r:JSONObject)=r.optJSONArray("events")?.let { a->(0 until a.length()).map { a.getJSONObject(it) } }.orEmpty()
    @Test fun breadcrumbsTrailHooksUpdatesAndMethods() { withHost { token,command->
        command(configure("md-breadcrumbs",JSONObject()) { put("breadcrumbsAppearance",JSONObject().put("currentBackground","#6A1B9A").put("gap",14)) });Thread.sleep(900)
        var frame=command(frameCommand);val box=root(frame,"md-breadcrumbs")
        val pill=count(frame,box,0x6A1B9A)
        assertTrue("the current page pill takes the hook background ($pill px)",pill>40)
        command(update(JSONObject().put("maxItems",2).put("itemsBeforeCollapse",1).put("itemsAfterCollapse",1)));Thread.sleep(400)
        var r=command(method("expand"))
        assertTrue("expand emits mdExpand ${events(r)}",events(r).any { it.getString("name")=="mdExpand" && it.getJSONObject("detail").optBoolean("expanded") && it.getJSONObject("detail").optInt("itemCount")==3 })
        r=command(method("collapse"))
        assertTrue("collapse emits mdExpand ${events(r)}",events(r).any { it.getString("name")=="mdExpand" && !it.getJSONObject("detail").optBoolean("expanded",true) })
        r=command(method("collapse"));assertTrue("collapse again emits nothing",events(r).none { it.getString("name")=="mdExpand" })
        command(update(JSONObject().put("separator","›").put("label","Site path")));Thread.sleep(200)
        assertRejected(token,update(JSONObject().put("maxItems",-1)));assertRejected(token,update(JSONObject().put("bogus",1)));assertRejected(token,method("expand",1));assertRejected(token,method("trigger"))
    } }
    @Test fun breadcrumbItemStandaloneHooksAndUpdates() { withHost { token,command->
        var frame:JSONObject
        command(configure("md-breadcrumb-item",JSONObject()) { put("breadcrumbItemAppearance",JSONObject().put("currentBackground","#6A1B9A")) });Thread.sleep(900)
        frame=command(frameCommand);val item=root(frame,"md-breadcrumb-item")
        assertEquals("a standalone crumb is a link, not the current page",0,count(frame,item,0x6A1B9A))
        // Gate-7 R6-22: the label repaints in the update that changes it (glyph ink, not only the pill).
        assertInk("a standalone link",frame,item,0x49454F)
        command(update(JSONObject().put("disabled",true)));Thread.sleep(500);frame=command(frameCommand)
        assertInk("disabled by an update",frame,root(frame,"md-breadcrumb-item"),0x1C1B1F,.61)
        command(update(JSONObject().put("disabled",false)));Thread.sleep(500);frame=command(frameCommand)
        assertInk("enabled again by an update",frame,root(frame,"md-breadcrumb-item"),0x49454F)
        command(update(JSONObject().put("current",true)));Thread.sleep(400);frame=command(frameCommand)
        assertTrue("current paints the pill",count(frame,item,0x6A1B9A)>20)
        assertInk("current by an update",frame,root(frame,"md-breadcrumb-item"),0x1D192B)
        command(update(JSONObject().put("current",false)));Thread.sleep(500);frame=command(frameCommand)
        assertInk("a link again by an update",frame,root(frame,"md-breadcrumb-item"),0x49454F)
        assertRejected(token,update(JSONObject().put("collapsed",true)));assertRejected(token,update(JSONObject().put("current","yes")))
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
