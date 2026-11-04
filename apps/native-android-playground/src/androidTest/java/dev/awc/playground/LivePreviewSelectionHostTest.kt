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

/** Laboratory host: md-switch, md-checkbox, md-radio and md-chip with typed appearance, retained updates, the selection method controller and mdValidityChange. */
class LivePreviewSelectionHostTest {
    private fun configure(tag:String,properties:JSONObject,extra:JSONObject.()->Unit={})=JSONObject().put("command","configure").put("tag",tag).put("width",640).put("dark",false).put("properties",properties).apply(extra)
    private fun method(name:String,vararg args:Any)=JSONObject().put("command","method").put("method",name).put("arguments",JSONArray(args.toList()))
    private fun update(properties:JSONObject)=JSONObject().put("command","update").put("properties",properties)
    private val frameCommand get()=JSONObject().put("command","frame")
    @Test fun switchHooksMethodsAndValidity() { withHost { token,command->
        command(configure("md-switch",JSONObject().put("selected",true).put("required",true)) { put("switchAppearance",JSONObject().put("trackWidth",60).put("selectedTrackColor","#123456")) });Thread.sleep(200)
        var frame=command(frameCommand);val box=root(frame,"md-switch")
        assertEquals("track width hook",60.0,box.getDouble("width"),.6)
        assertColor("selected track colour hook",0x123456,pixel(frame,box.getDouble("x")+8,box.getDouble("y")+box.getDouble("height")/2))
        var reply=command(method("getValidity"));val valid=reply.getJSONObject("result")
        assertTrue("selected required switch is valid: $valid",valid.getBoolean("valid"));assertEquals(10,valid.getJSONObject("flags").length())
        val seen=events(command(update(JSONObject().put("selected",false))))+events(command(frameCommand)).also { Thread.sleep(100) }+events(command(frameCommand))
        assertTrue("turning a required switch off emits mdValidityChange: $seen",seen.any { it.getString("name")=="mdValidityChange" && !it.getJSONObject("detail").getBoolean("valid") })
        assertEquals(false,command(method("checkValidity")).get("result"))
        assertEquals(false,command(method("reportValidity")).get("result"));Thread.sleep(150)
        frame=command(frameCommand)
        assertTrue("reportValidity shows the message below the switch",root(frame,"md-switch").getDouble("height")>=box.getDouble("height")-.6)
        reply=command(method("getValidity"))
        assertEquals("Please turn this on if you want to proceed.",reply.getJSONObject("result").getString("validationMessage"))
        val custom=events(command(method("setCustomValidity","Server rejected this")))+events(command(frameCommand))
        val change=custom.lastOrNull { it.getString("name")=="mdValidityChange" }
        assertEquals("custom message wins: $custom","Server rejected this",change?.getJSONObject("detail")?.getString("validationMessage"))
        assertTrue(change!!.getJSONObject("detail").getJSONObject("flags").getBoolean("customError"))
        assertRejected(token,update(JSONObject().put("density",-7)));assertRejected(token,method("setCustomValidity",1));assertRejected(token,method("select"))
    } }
    @Test fun checkboxReportShowsTheSupportLine() { withHost { token,command->
        command(configure("md-checkbox",JSONObject().put("required",true)) { put("checkboxAppearance",JSONObject().put("containerSize",20).put("outlineColor","#FF0000")) });Thread.sleep(200)
        var frame=command(frameCommand);val rest=root(frame,"md-checkbox")
        assertEquals(false,command(method("reportValidity")).get("result"));Thread.sleep(150)
        frame=command(frameCommand);val reported=root(frame,"md-checkbox")
        assertTrue("the support line adds height (${rest.getDouble("height")} → ${reported.getDouble("height")})",reported.getDouble("height")>rest.getDouble("height")+10)
        assertTrue("error-coloured message ink",ink(frame,reported,0xB3261E,bottom=true)>20)
        val seen=events(command(update(JSONObject().put("checked",true))))+events(command(frameCommand))
        assertTrue("checking emits mdValidityChange: $seen",seen.any { it.getString("name")=="mdValidityChange" && it.getJSONObject("detail").getBoolean("valid") })
        Thread.sleep(150);frame=command(frameCommand)
        assertEquals("the message hides once valid",rest.getDouble("height"),root(frame,"md-checkbox").getDouble("height"),.6)
        assertRejected(token,method("setFocus"))
    } }
    @Test fun radioReportSelectAndFocusMethods() { withHost { token,command->
        command(configure("md-radio",JSONObject().put("name","plan").put("value","pro").put("required",true)) { put("radioAppearance",JSONObject().put("iconSize",24).put("selectedIconColor","#1B5E20")) });Thread.sleep(200)
        var frame=command(frameCommand);val rest=root(frame,"md-radio")
        assertEquals(false,command(method("reportValidity")).get("result"));Thread.sleep(150)
        frame=command(frameCommand)
        assertTrue("radio message below the target",root(frame,"md-radio").getDouble("height")>rest.getDouble("height")+10)
        val blur=events(command(method("setBlur")))+events(command(frameCommand))
        assertTrue("setBlur emits mdBlur: $blur",blur.any { it.getString("name")=="mdBlur" })
        val selected=events(command(method("select")))+events(command(frameCommand))
        val change=selected.firstOrNull { it.getString("name")=="mdChange" }?.getJSONObject("detail")
        assertTrue("select() emits mdChange { checked, value }: $selected",change?.getBoolean("checked")==true && change.getString("value")=="pro")
        Thread.sleep(150);frame=command(frameCommand);val box=root(frame,"md-radio")
        assertEquals("valid again: the message hides",rest.getDouble("height"),box.getDouble("height"),.6)
        assertTrue("selected icon colour hook",ink(frame,box,0x1B5E20)>20)
        assertTrue(command(method("getValidity")).getJSONObject("result").getBoolean("valid"))
        val focus=events(command(method("setFocus")))+events(command(frameCommand))
        assertTrue("setFocus emits mdFocus: $focus",focus.any { it.getString("name")=="mdFocus" })
        command(method("syncValidityFromGroup"));assertRejected(token,method("setCustomValidity"))
    } }
    @Test fun chipHooksAndRetainedUpdates() { withHost { token,command->
        command(configure("md-chip",JSONObject().put("label","Design").put("variant","filter").put("icon","palette")) { put("chipAppearance",JSONObject().put("containerHeight",40).put("outlineColor","#FF0000").put("outlineWidth",2)) });Thread.sleep(200)
        var frame=command(frameCommand);val box=root(frame,"md-chip")
        assertEquals("container height hook",40.0,box.getDouble("height"),.6)
        assertColor("outline colour hook",0xFF0000,pixel(frame,box.getDouble("x")+box.getDouble("width")/2,box.getDouble("y")+.5))
        command(update(JSONObject().put("selected",true).put("appearance","filled").put("label","Design systems")));Thread.sleep(150)
        frame=command(frameCommand);assertTrue("the label update widens the chip",root(frame,"md-chip").getDouble("width")>box.getDouble("width")+20)
        assertRejected(token,update(JSONObject().put("variant","choice")));assertRejected(token,method("reportValidity"))
    } }

    private fun assertRejected(token:String,body:JSONObject) { val response=request("POST","/command",token,body);assertTrue("$body rejected: $response",response.first>=400 || response.second.has("error")) }
    private fun root(frame:JSONObject,tag:String):JSONObject {
        val matches=nodes(frame).filter { it.getString("id")=="component" && it.optString("name")==tag }
        assertEquals("$tag root in ${nodes(frame).map { it.getString("id")+"/"+it.optString("name") }}",1,matches.size)
        return matches.single().getJSONObject("bounds")
    }
    private fun bitmap(frame:JSONObject):Bitmap { val bytes=Base64.decode(frame.getString("png"),Base64.DEFAULT);return BitmapFactory.decodeByteArray(bytes,0,bytes.size) }
    private fun pixel(frame:JSONObject,x:Double,y:Double):Int { val b=bitmap(frame);val scale=b.width/640.0;return b.getPixel((x*scale).toInt(),(y*scale).toInt()) }
    private fun rgb(color:Int)=color and 0xFFFFFF
    /** Device pixels of [color] (±16 per channel) in the box, or in its lower 40 % ([bottom]) or a band around it. */
    private fun ink(frame:JSONObject,box:JSONObject,color:Int,bottom:Boolean=false):Int { val b=bitmap(frame);val scale=b.width/640.0;var n=0
        val x0=(box.getDouble("x")*scale).toInt().coerceAtLeast(0);val x1=((box.getDouble("x")+box.getDouble("width")+300)*scale).toInt().coerceAtMost(b.width)
        val y0=((box.getDouble("y")+if(bottom) box.getDouble("height")*.6 else 0.0)*scale).toInt();val y1=((box.getDouble("y")+box.getDouble("height"))*scale).toInt().coerceAtMost(b.height)
        for(y in y0 until y1) for(x in x0 until x1) { val c=b.getPixel(x,y);if(listOf(16,8,0).all { abs((color shr it and 255)-(c shr it and 255))<=16 }) n++ }
        return n }
    private fun assertColor(label:String,expected:Int,actual:Int) {
        val ok=listOf(16,8,0).all { abs((expected shr it and 255)-(actual shr it and 255))<=3 }
        assertTrue("$label: expected #%06X, got #%06X".format(expected,rgb(actual)),ok)
    }
    private fun nodes(frame:JSONObject)=frame.getJSONObject("inspection").getJSONArray("nodes").let { a->(0 until a.length()).map { a.getJSONObject(it) } }
    private fun events(frame:JSONObject):List<JSONObject> = frame.optJSONArray("events")?.let { a->(0 until a.length()).map { a.getJSONObject(it) } } ?: emptyList()
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
