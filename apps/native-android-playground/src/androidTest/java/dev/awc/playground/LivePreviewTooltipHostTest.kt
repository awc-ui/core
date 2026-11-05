package dev.awc.playground

import android.content.Intent
import android.graphics.BitmapFactory
import android.util.Base64
import androidx.test.core.app.ActivityScenario
import androidx.test.core.app.ApplicationProvider
import org.json.JSONObject
import org.json.JSONArray
import org.junit.Assert.*
import org.junit.Test
import java.net.HttpURLConnection
import java.net.URL
import java.util.UUID

class LivePreviewTooltipHostTest {
    @Test fun tooltipPanelSlotsReachActualRenderedRichContent()=withHost { _,command->
        command(JSONObject().put("command","configure").put("tag","md-tooltip").put("width",640).put("height",400)
            .put("properties",JSONObject().put("variant","rich").put("open",true).put("text","").put("subhead",""))
            .put("slots",JSONObject().put("subhead","Authored heading").put("content","Authored body")))
        Thread.sleep(140)
        val authored=command(JSONObject().put("command","frame"))
        assertEquals("Both authored text slots occupy their real line boxes",64.0,part(authored,"popup").getDouble("height"),.6)
        assertEquals(20.0,part(authored,"subhead").getDouble("height"),.6)
        assertEquals(20.0,part(authored,"supporting-text").getDouble("height"),.6)
    }
    @Test fun tooltipPanelEmptySlotsSuppressFallbacks()=withHost { _,command->
        command(JSONObject().put("command","configure").put("tag","md-tooltip").put("width",640).put("height",400)
            .put("properties",JSONObject().put("variant","rich").put("open",true).put("text","Fallback body").put("subhead","Fallback heading"))
            .put("slots",JSONObject().put("subhead","").put("content","")))
        Thread.sleep(140)
        val empty=command(JSONObject().put("command","frame"))
        assertTrue("Explicit empty slots suppress both property fallbacks",part(empty,"popup").getDouble("height")<30)
    }
    @Test fun tooltipRetainedPropertiesImmediateMethodsAndResizeKeepLifecycle()=withHost { token,command->
        command(JSONObject().put("command","configure").put("tag","md-tooltip").put("width",640).put("height",400)
            .put("properties",JSONObject().put("open",false).put("text","Helpful information")))
        val update=JSONObject().put("text","Updated text").put("subhead","Details").put("variant","rich").put("position","bottom-end")
            .put("autoPosition",false).put("offset",20).put("crossOffset",17).put("open",true).put("showDelay",500).put("hideDelay",200).put("disabled",false).put("density",-2)
        val ack=command(JSONObject().put("command","update").put("properties",update))
        assertTrue(ack.getBoolean("ack"));assertEquals(1,events(ack).count { it.getString("name")=="mdOpen" })
        Thread.sleep(140)
        val before=command(JSONObject().put("command","frame"));val anchor=root(before);val popup=part(before,"popup")
        assertEquals(anchor.getDouble("y")+anchor.getDouble("height")+20,popup.getDouble("y"),.6)
        assertEquals(anchor.getDouble("x")+anchor.getDouble("width")-kotlin.math.floor(popup.getDouble("width")+.5)+17,popup.getDouble("x"),.6)
        command(method("hide","hide"));val hidden=command(JSONObject().put("command","frame"))
        val close=events(hidden).single { it.getString("name")=="mdClose" };assertTrue(close.isNull("detail"));assertEquals(listOf("component","preview-root"),(0 until close.getJSONArray("propagationPath").length()).map { close.getJSONArray("propagationPath").getString(it) })
        Thread.sleep(140)
        val resized=command(JSONObject().put("command","resize").put("width",360).put("height",480))
        assertEquals(360.0,resized.getDouble("logicalWidth"),.01);assertEquals(480.0,resized.getDouble("logicalHeight"),.01)
        assertFalse(hasPart(resized,"popup"));assertTrue(events(resized).isEmpty())
        val reopened=command(JSONObject().put("command","update").put("properties",JSONObject().put("open",true)))
        assertEquals("Panel open after method hide reopens retained instance",1,events(reopened).count { it.getString("name")=="mdOpen" })
        Thread.sleep(140)
        val shown=command(JSONObject().put("command","frame"));assertTrue(hasPart(shown,"popup"))
        assertTrue(events(shown).isEmpty())
        for(bad in listOf(JSONObject().put("position","center"),JSONObject().put("open",1),JSONObject().put("density",-5),JSONObject().put("text","x".repeat(4097)))) {
            val response=request("POST","/command",token,JSONObject().put("command","update").put("properties",bad));assertTrue(response.first>=400 || response.second.has("error"))
        }
        val invalid=request("POST","/command",token,method("show","bad",JSONArray().put("extra")))
        assertTrue(invalid.first>=400 || invalid.second.has("error"))
    }
    @Test fun tooltipActualHoverGraceEscapeSuppressionAndDisabledOpenAreRetained()=withHost { _,command->
        command(JSONObject().put("command","configure").put("tag","md-tooltip").put("width",640).put("height",400)
            .put("properties",JSONObject().put("open",false).put("text","Helpful information").put("showDelay",250).put("hideDelay",250)))
        fun move(x:Double,y:Double)=command(JSONObject().put("command","pointer").put("phase","move").put("x",x).put("y",y))
        var frame=command(JSONObject().put("command","frame"));val anchor=root(frame)
        val ax=anchor.getDouble("x")+anchor.getDouble("width")/2;val ay=anchor.getDouble("y")+anchor.getDouble("height")/2
        move(ax,ay);Thread.sleep(400);frame=command(JSONObject().put("command","frame"))
        assertTrue(hasPart(frame,"popup"));assertEquals(1,events(frame).count { it.getString("name")=="mdOpen" })
        val popup=part(frame,"popup");move(popup.getDouble("x")+popup.getDouble("width")/2,popup.getDouble("y")+popup.getDouble("height")/2)
        Thread.sleep(400);assertTrue(hasPart(command(JSONObject().put("command","frame")),"popup"))
        val escape=events(command(JSONObject().put("command","key").put("key","Escape"))).toMutableList()
        Thread.sleep(150);frame=command(JSONObject().put("command","frame"));escape+=events(frame)
        assertEquals(1,escape.count { it.getString("name")=="mdClose" });assertFalse(hasPart(frame,"popup"))
        move(ax,ay);Thread.sleep(400);assertFalse(hasPart(command(JSONObject().put("command","frame")),"popup"))
        move(5.0,5.0);move(ax,ay);Thread.sleep(400);assertTrue(hasPart(command(JSONObject().put("command","frame")),"popup"))
        command(JSONObject().put("command","update").put("properties",JSONObject().put("disabled",true).put("open",true)))
        Thread.sleep(150);assertFalse(hasPart(command(JSONObject().put("command","frame")),"popup"))
        command(JSONObject().put("command","update").put("properties",JSONObject().put("disabled",false)))
        Thread.sleep(400);assertFalse(hasPart(command(JSONObject().put("command","frame")),"popup"))
    }
    private fun hasPart(frame:JSONObject,name:String)=frame.optJSONObject("inspection")?.optJSONArray("nodes")?.let { a->(0 until a.length()).any { a.getJSONObject(it).getString("id")=="component.$name" } } ?: false
    private fun root(frame:JSONObject):JSONObject {
        val a=frame.getJSONObject("inspection").getJSONArray("nodes")
        return (0 until a.length()).map { a.getJSONObject(it) }.single { it.getString("id")=="component" }.getJSONObject("bounds")
    }
    private fun events(frame:JSONObject):List<JSONObject> = frame.optJSONArray("events")?.let { a->(0 until a.length()).map { a.getJSONObject(it) } } ?: emptyList()
    private fun part(frame:JSONObject,name:String):JSONObject {
        val a=frame.getJSONObject("inspection").getJSONArray("nodes")
        return (0 until a.length()).map { a.getJSONObject(it) }.single { it.getString("id")=="component.$name" }.getJSONObject("bounds")
    }
    private fun method(name:String,id:String,args:JSONArray=JSONArray())=JSONObject().put("command","method").put("target","component").put("method",name).put("arguments",args).put("callId",id)
    private fun decode(frame: JSONObject): android.graphics.Bitmap {
        val bytes = Base64.decode(frame.getString("png"), Base64.DEFAULT)
        return checkNotNull(BitmapFactory.decodeByteArray(bytes, 0, bytes.size)) { "Frame must be a real decodable PNG" }
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

    private fun connection(method: String, path: String, token: String): HttpURLConnection = (URL("http://127.0.0.1:39091$path").openConnection() as HttpURLConnection).apply {
        requestMethod = method
        connectTimeout = 3000
        readTimeout = 6000
        setRequestProperty("Authorization", "Bearer $token")
    }

    private fun request(method: String, path: String, token: String, body: JSONObject? = null): Pair<Int, JSONObject> {
        val connection = connection(method, path, token)
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
