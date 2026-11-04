package dev.awc.playground

import android.content.Intent
import android.graphics.BitmapFactory
import android.hardware.display.DisplayManager
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

class LivePreviewSnackbarHostTest {
    @Test fun snackbarConfiguredHeightRetainedResizeAndMethodClosedStateAreReal() = withHost { token,command ->
        val configured=command(JSONObject().put("command","configure").put("tag","md-snackbar").put("width",640).put("height",310)
            .put("properties",JSONObject().put("open",true).put("message","Saved").put("autoHide",false).put("closeable",true)))
        assertEquals(310.0,configured.getDouble("logicalHeight"),.01)
        Thread.sleep(300)
        fun resize(width:Double,height:Double)=command(JSONObject().put("command","resize").put("width",width).put("height",height)).also { assertTrue(it.getBoolean("ack")) }
        var frame=resize(360.0,480.0)
        assertEquals(360.0,frame.getDouble("logicalWidth"),.01);assertEquals(480.0,frame.getDouble("logicalHeight"),.01)
        assertTrue("Resizing generates no lifecycle events",events(frame).isEmpty())
        val surface=part(frame,"surface");assertEquals(16.0,surface.getDouble("x"),.01);assertEquals(328.0,surface.getDouble("width"),.01)
        assertEquals(464.0,surface.getDouble("y")+surface.getDouble("height"),.01)
        val image=decode(frame);assertEquals(720,image.width);assertEquals(960,image.height);image.recycle()
        command(method("hide","hidden",JSONArray().put("action")))
        val hidden=command(JSONObject().put("command","method-results").put("callIds",JSONArray().put("hidden")).put("acknowledged",JSONArray()))
        assertEquals("action",events(hidden).single { it.getString("name")=="mdClose" }.getJSONObject("detail").getString("reason"))
        Thread.sleep(250)
        frame=resize(1200.0,5000.0)
        assertEquals(1200.0,frame.getDouble("logicalWidth"),.01);assertEquals(1666.0,frame.getDouble("logicalHeight"),.01)
        assertEquals("Method-hidden state survives source open=true resize",0,frame.optJSONObject("inspection")?.optJSONArray("nodes")?.length() ?: 0)
        assertTrue(events(frame).isEmpty())
        frame=resize(100.0,.1)
        assertEquals(320.0,frame.getDouble("logicalWidth"),.01);assertEquals(1.0,frame.getDouble("logicalHeight"),.01)
        for(bad in listOf(JSONObject().put("command","resize").put("width",0).put("height",10),JSONObject().put("command","resize").put("width",640).put("height","310"),JSONObject().put("command","resize").put("width",640).put("height",310).put("extra",true))) {
            val response=request("POST","/command",token,bad)
            assertTrue(response.first>=400 || response.second.has("error"))
        }
        frame=command(JSONObject().put("command","frame"))
        assertEquals(320.0,frame.getDouble("logicalWidth"),.01);assertEquals(1.0,frame.getDouble("logicalHeight"),.01)
    }

    @Test fun snackbarRetainedAllPropertiesAndCorrelatedImmediateMethods() = withHost { token,command ->
        command(JSONObject().put("command","configure").put("tag","md-snackbar").put("width",640).put("height",400)
            .put("properties",JSONObject().put("open",false)))
        val update=JSONObject().put("open",true).put("message","Records saved").put("action","Undo").put("closeable",true)
            .put("autoHide",false).put("autoHideDuration",10000).put("position","top-end").put("stacked",true)
            .put("politeness","assertive").put("dismissLabel","Close notification").put("density",-2)
        val ack=command(JSONObject().put("command","update").put("properties",update))
        assertTrue(ack.getBoolean("ack"));assertEquals(1,events(ack).count { it.getString("name")=="mdOpen" })
        Thread.sleep(300)
        val frame=command(JSONObject().put("command","frame"))
        assertEquals(20.0,part(frame,"surface").getDouble("y"),.01)
        assertEquals(620.0,part(frame,"surface").getDouble("x")+part(frame,"surface").getDouble("width"),.01)
        assertEquals(22.0,part(frame,"close-icon").getDouble("width"),.01)
        for(reason in listOf("auto","action","close")) {
            command(method("hide","hide-$reason",JSONArray().put(reason)))
            val poll=command(JSONObject().put("command","method-results").put("callIds",JSONArray().put("hide-$reason")).put("acknowledged",JSONArray()))
            assertEquals(reason,events(poll).single { it.getString("name")=="mdClose" }.getJSONObject("detail").getString("reason"))
            assertEquals("fulfilled",poll.getJSONArray("methodResults").getJSONObject(0).getString("status"))
            command(method("show","show-$reason"))
            assertEquals(1,events(command(JSONObject().put("command","frame"))).count { it.getString("name")=="mdOpen" })
        }
        val mismatch=command(method("hide","hide-auto",JSONArray().put("close")))
        assertEquals("METHOD_CALL_ID_MISMATCH",mismatch.getJSONObject("methodCall").getJSONObject("error").getString("code"))
        for(bad in listOf(JSONObject().put("density",-5),JSONObject().put("closeable",1),JSONObject().put("message","x".repeat(4097)),JSONObject().put("hidden",true))) {
            val response=request("POST","/command",token,JSONObject().put("command","update").put("properties",bad))
            assertTrue(response.first>=400 || response.second.has("error"))
        }
        val invalid=request("POST","/command",token,method("hide","bad",JSONArray().put("other")))
        assertTrue(invalid.first>=400 || invalid.second.has("error"))
    }

    @Test fun snackbarPointerHoverPausesAndResizePreservesOriginalDeadline() = withHost { _,command ->
        command(JSONObject().put("command","configure").put("tag","md-snackbar").put("width",640).put("height",310)
            .put("properties",JSONObject().put("open",true).put("message","Saved").put("autoHide",true).put("autoHideDuration",1500).put("closeable",true)))
        Thread.sleep(300)
        var frame=command(JSONObject().put("command","frame"));val box=part(frame,"surface")
        command(JSONObject().put("command","pointer").put("phase","move").put("x",box.getDouble("x")+20).put("y",box.getDouble("y")+20))
        Thread.sleep(1600)
        frame=command(JSONObject().put("command","frame"));assertTrue("Hover holds the real native timer",events(frame).none { it.getString("name")=="mdClose" })
        assertNotNull(part(frame,"surface"))
        command(JSONObject().put("command","pointer").put("phase","leave").put("x",-1).put("y",-1))
        val resumed=System.currentTimeMillis()
        Thread.sleep(650)
        frame=command(JSONObject().put("command","resize").put("width",480).put("height",420))
        assertTrue(events(frame).none { it.getString("name")=="mdClose" })
        val rest=1700-(System.currentTimeMillis()-resumed)
        if(rest>0) Thread.sleep(rest)
        frame=command(JSONObject().put("command","frame"))
        assertEquals("Resize must retain the original deadline: "+JSONObject(frame.toString()).apply { remove("png") },1,events(frame).count { it.getString("name")=="mdClose" && it.getJSONObject("detail").getString("reason")=="auto" })
    }

    @Test fun snackbarActualFallbackActionCloseAndUnfocusedEscapeEmitSourceReasons() = withHost { _,command ->
        fun configure()=command(JSONObject().put("command","configure").put("tag","md-snackbar").put("width",640).put("height",310)
            .put("properties",JSONObject().put("open",true).put("message","Saved").put("action","Undo").put("autoHide",false).put("autoHideDuration",900).put("closeable",true)))
        fun click(name:String):List<JSONObject> {
            val b=part(command(JSONObject().put("command","frame")),name)
            val x=b.getDouble("x")+b.getDouble("width")/2;val y=b.getDouble("y")+b.getDouble("height")/2
            val all=mutableListOf<JSONObject>()
            for(phase in listOf("down","up")) all+=events(command(JSONObject().put("command","pointer").put("phase",phase).put("x",x).put("y",y)))
            all+=events(command(JSONObject().put("command","frame")));return all
        }
        configure();Thread.sleep(300)
        val escaped=events(command(JSONObject().put("command","key").put("key","Escape"))).toMutableList()
        Thread.sleep(220);escaped+=events(command(JSONObject().put("command","frame")))
        assertEquals("Escape must work before a Snackbar control receives focus",1,escaped.count { it.getString("name")=="mdClose" && it.getJSONObject("detail").getString("reason")=="close" })
        command(method("show","action-cycle"));Thread.sleep(300);command(JSONObject().put("command","frame"))
        val clicked=click("actions")
        assertEquals(1,clicked.count { it.getString("name")=="mdAction" });assertTrue(clicked.none { it.getString("name")=="mdClose" })
        Thread.sleep(1100)
        assertEquals("Action starts its source timer even with autoHide=false","auto",events(command(JSONObject().put("command","frame"))).single { it.getString("name")=="mdClose" }.getJSONObject("detail").getString("reason"))
        command(method("show","close-cycle"));Thread.sleep(300);command(JSONObject().put("command","frame"))
        val closed=click("close").toMutableList();Thread.sleep(220);closed+=events(command(JSONObject().put("command","frame")))
        assertEquals(1,closed.count { it.getString("name")=="mdClose" && it.getJSONObject("detail").getString("reason")=="close" })
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
