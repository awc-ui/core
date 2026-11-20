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

/** Laboratory host: n5's navigation components (md-toolbar, md-navigation-rail, md-navigation-rail-tab) — typed hooks
 *  (defaults first, local values win), retained property updates with the source types, the methods through their
 *  controllers (setFocus(); expand / collapse / toggle / focusTab, clearSubmenuSelection), and the lifecycle (a new session
 *  binds a fresh controller). */
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

    @Test fun railHooksUpdatesAndMethods() { withHost { token,command->
        // The Laboratory recipe (Home active, Saved, Settings): default + local hooks, the destination hook passed down.
        command(configure("md-navigation-rail",JSONObject()) {
            put("navigationRailAppearanceDefaults",JSONObject().put("containerColor","#E0F2F1").put("containerWidth",96)); put("navigationRailAppearance",JSONObject().put("containerColor","#FFF3E0"))
            put("navigationRailTabAppearance",JSONObject().put("indicatorColor","#FFCC80")) })
        Thread.sleep(350)
        var f=command(frameCommand);var box=bounds(f,"md-navigation-rail")
        assertEquals("collapsed width from the default hook",96.0,box.w,0.6)
        assertColor("rail colour (local wins)",0xFFF3E0,pixel(f,box.x+4,box.y+box.h-6))
        assertColor("the active indicator takes the destination hook",0xFFCC80,pixel(f,box.x+box.w/2-20,box.y+60))
        for((name,width) in listOf("expand" to 220.0,"collapse" to 96.0,"toggle" to 220.0)) {
            command(method(name));Thread.sleep(450);f=command(frameCommand);box=bounds(f,"md-navigation-rail");assertEquals("$name()",width,box.w,0.6)
        }
        command(method("focusTab",1))
        for(bad in listOf(method("focusTab"),method("focusTab",1.5),method("expand",1),method("setFocus"))) assertRejected(token,bad)
        command(update(JSONObject().put("orientation","horizontal")));Thread.sleep(250)
        f=command(frameCommand);box=bounds(f,"md-navigation-rail");assertTrue("a horizontal bar (${box.w}x${box.h})",box.w>box.h)
        command(update(JSONObject().put("orientation","vertical").put("variant","standard").put("labelVisibility","none").put("density",-2).put("activeIndex",2)));Thread.sleep(450)
        f=command(frameCommand);box=bounds(f,"md-navigation-rail");assertEquals("collapsed again",96.0,box.w,0.6)
        for(bad in listOf(JSONObject().put("variant","mini"),JSONObject().put("alignment","center"),JSONObject().put("density",-5),JSONObject().put("orientation","diagonal"),JSONObject().put("modal","yes"),JSONObject().put("bogus",1)))
            assertRejected(token,update(bad))
    } }

    @Test fun railContentInsideItsDestination() {
        // The Laboratory recipe (Home active) in each layout: the active destination's icon draws inside its indicator pill (the
        // parts are laid out in the destination's own box, as Chrome draws them), checked on the committed frame. A session is
        // configured once: one per layout.
        for(props in listOf(JSONObject(),JSONObject().put("variant","expanded"),JSONObject().put("orientation","horizontal"))) withHost { _,command->
            command(configure("md-navigation-rail",props));Thread.sleep(450)
            val f=command(frameCommand);val box=bounds(f,"md-navigation-rail")
            android.util.Log.i("AWCRailGeom","$props rail $box nodes "+nodes(f).filter { it.optString("name").isNotEmpty() }.joinToString(" | ") { n->
                "${n.optString("name")}:${n.optJSONObject("bounds")}" }.take(3000))
            val bm=bitmap(f);val scale=bm.width/640.0
            fun at(x:Double,y:Double)=bm.getPixel((x*scale).toInt().coerceIn(0,bm.width-1),(y*scale).toInt().coerceIn(0,bm.height-1))
            var minX=1e9;var minY=1e9;var maxX=-1.0;var maxY=-1.0
            var y=box.y;while(y<box.y+minOf(box.h,420.0)) { var x=box.x;while(x<box.x+box.w) { if(near(at(x,y),0xE8DEF8,4)) { minX=minOf(minX,x);maxX=maxOf(maxX,x);minY=minOf(minY,y);maxY=maxOf(maxY,y) };x+=1.0 };y+=1.0 }
            assertTrue("$props: the active indicator pill is drawn",maxX>=0)
            var ink=0;y=minY;while(y<=maxY) { var x=minX;while(x<=maxX) { val c=at(x,y);if((c shr 16 and 255)+(c shr 8 and 255)+(c and 255)<300) ink++;x+=1.0 };y+=1.0 }
            assertTrue("$props: the active destination's icon draws inside its pill (pill x $minX..$maxX y $minY..$maxY)",ink>4)
        }
    }

    @Test fun railHiddenDestination() { withHost { _,command->
        // A hidden destination (Web: display: none) keeps its index and takes no box: Settings (index 2) is active, where Saved would be.
        fun tab(label:String,hidden:Boolean=false)=JSONObject().put("tag","md-navigation-rail-tab").put("properties",JSONObject().put("label",label).put("icon","home").apply { if(hidden) put("hidden",true) })
        command(configure("md-navigation-rail",JSONObject().put("activeIndex",2)) { put("children",JSONArray(listOf(tab("Home"),tab("Saved",true),tab("Settings")))) })
        Thread.sleep(450)
        // The frame lists the rail (its destinations are not inspection nodes here): the active pill along the rail's axis.
        val f=command(frameCommand);val box=bounds(f,"md-navigation-rail")
        val bm=bitmap(f);val scale=bm.width/640.0
        val ys=(0 until minOf(box.h,420.0).toInt()).map { box.y+it }.filter { y-> near(bm.getPixel(((box.x+box.w/2-20)*scale).toInt(),(y*scale).toInt()),0xE8DEF8,4) }
        assertTrue("the active pill is drawn",ys.isNotEmpty())
        // Slots: Home's pill 51 px below the rail top, then one per 64 px. Hidden Saved takes no box: Settings (index 2) in the second.
        val top=ys.first()-box.y
        assertTrue("Settings (index 2) is active in the second slot (pill top $top px below the rail top)",top>90 && top<150)
    } }

    @Test fun railTabAlone() { withHost { token,command->
        command(configure("md-navigation-rail-tab",JSONObject().put("label","Home").put("icon","home").put("active",true)) { put("navigationRailTabAppearance",JSONObject().put("indicatorColor","#B2DFDB")) })
        Thread.sleep(300)
        val f=command(frameCommand);val box=bounds(f,"md-navigation-rail-tab")
        assertTrue("a destination (${box.w}x${box.h})",box.w>=56 && box.h>=48)
        // The indicator pill sits in the destination's upper part (its offset depends on the standalone box): scan it.
        val column=(0 until 48 step 2).map { dy-> pixel(f,box.x+box.w/2-20,box.y+dy) }
        assertTrue("its indicator takes the destination hook #B2DFDB (box $box; column ${column.map { "#%06X".format(it and 0xFFFFFF) }.distinct()})",column.any { near(it,0xB2DFDB,3) })
        command(method("clearSubmenuSelection"));assertRejected(token,method("clearSubmenuSelection",0))
        command(update(JSONObject().put("label","Inbox").put("badgeValue","3")));assertRejected(token,update(JSONObject().put("active",1)))
    } }

    @Test fun appBarHooksAndUpdates() { withHost { token,command->
        // The Laboratory recipe (Your workspace, the menu leading icon, a trailing Search action): default + local hooks as CSS text.
        command(configure("md-app-bar",JSONObject().put("headline","Your workspace").put("leadingIcon","menu").put("leadingIconLabel","Open navigation")) {
            put("appBarAppearanceDefaults",JSONObject().put("containerColor","#E0F2F1").put("rowHeight",72)); put("appBarAppearance",JSONObject().put("containerColor","#FFF3E0")) })
        Thread.sleep(350)
        var f=command(frameCommand);var row=bounds(f,"row")
        assertEquals("the default row height applies where no local value is set",72.0,row.h,0.6)
        assertColor("the local container colour wins",0xFFF3E0,pixel(f,row.x+row.w/2,row.y+4))
        command(update(JSONObject().put("variant","medium").put("subtitle","12 unread")));Thread.sleep(300)
        f=command(frameCommand);assertTrue("a medium bar's expanded block",nodes(f).any { it.optString("name")=="expanded" })
        command(update(JSONObject().put("scrolled",true)));Thread.sleep(400)
        f=command(frameCommand);row=bounds(f,"row");val scrolled=pixel(f,row.x+row.w/2,row.y+4)
        assertTrue("scrolled takes the scrolled container colour (#%06X)".format(scrolled and 0xFFFFFF),!near(scrolled,0xFFF3E0,3))
        command(update(JSONObject().put("variant","search").put("searchDisabled",true).put("titleAlignment","center").put("density",-2)));Thread.sleep(300)
        f=command(frameCommand);assertTrue("a search bar",nodes(f).any { it.optString("name")=="search" })
        for(bad in listOf(JSONObject().put("variant","tiny"),JSONObject().put("titleAlignment","end"),JSONObject().put("density",-5),JSONObject().put("scrolled","yes"),JSONObject().put("bogus",1)))
            assertRejected(token,update(bad))
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
