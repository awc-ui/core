package dev.awc.playground

import android.content.Intent
import androidx.test.core.app.ActivityScenario
import androidx.test.core.app.ApplicationProvider
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import java.net.HttpURLConnection
import java.net.URL
import java.util.UUID

/** Laboratory host: dedicated Accordion renderer, typed appearance, retained updates, pointer drags and item methods. */
class LivePreviewAccordionHostTest {
    @Test fun accordionAppearancePointerToggleRetainedUpdatesAndFloatingDrag()=withHost { token,command->
        // The Laboratory always sends the complete property set (source defaults + recipe attributes).
        command(JSONObject().put("command","configure").put("tag","md-accordion").put("width",640).put("properties",JSONObject().put("exclusive",false).put("keepOneExpanded",false).put("defaultExpanded",""))
            .put("accordionAppearanceDefaults",JSONObject().put("gap",4)).put("accordionAppearance",JSONObject().put("gap",20)))
        Thread.sleep(150)
        var frame=command(JSONObject().put("command","frame"))
        val first=part(frame,"item-0");val second=part(frame,"item-1")
        assertEquals("Local gap overrides the subtree default and the source gap",20.0,second.getDouble("y")-(first.getDouble("y")+first.getDouble("height")),.6)
        val header=part(frame,"item-1.header")
        val x=header.getDouble("x")+header.getDouble("width")/2;val y=header.getDouble("y")+header.getDouble("height")/2
        val pressed=events(command(pointer("down",x,y)))+events(command(pointer("up",x,y)))
        Thread.sleep(100);val toggled=pressed+events(command(JSONObject().put("command","frame")))
        val item=one(toggled,"mdItemToggle")
        assertTrue(item.getBoolean("expanded"));assertEquals(1,item.getInt("index"))
        val group=one(toggled,"mdToggle")
        assertEquals(1,group.getInt("index"));assertTrue(group.getBoolean("expanded"));assertEquals("[0,1]",group.getJSONArray("expandedIndices").toString())
        val exclusive=events(command(JSONObject().put("command","update").put("properties",JSONObject().put("exclusive",true))))
        Thread.sleep(100);val collapsed=exclusive+events(command(JSONObject().put("command","frame")))
        assertTrue("Enabling exclusive collapses the other open item",collapsed.any { it.getString("name")=="mdItemToggle" && !it.getJSONObject("detail").getBoolean("expanded") })
        command(JSONObject().put("command","update").put("properties",JSONObject().put("variant","outlined").put("floating",true).put("initialX",24).put("initialY",16)))
        Thread.sleep(150);frame=command(JSONObject().put("command","frame"))
        // The in-flow root is a zero-size anchor; the flush first item carries the panel's origin and width.
        val panel=part(frame,"item-0")
        assertEquals(32.0+24,panel.getDouble("x"),.6);assertEquals(32.0+16,panel.getDouble("y"),.6);assertEquals(360.0,panel.getDouble("width"),.6)
        val gx=panel.getDouble("x")+panel.getDouble("width")/2;val gy=panel.getDouble("y")+12
        command(pointer("move",gx,gy))
        val drag=(events(command(pointer("down",gx,gy)))+events(command(pointer("move",gx+40,gy+20)))+events(command(pointer("up",gx+40,gy+20)))).filter { it.getString("name").startsWith("mdDrag") }
        assertEquals("mdDragStart",drag.first().getString("name"));assertEquals("mdDragEnd",drag.last().getString("name"))
        assertTrue(drag.any { it.getString("name")=="mdDragMove" })
        val start=drag.first().getJSONObject("detail");val end=drag.last().getJSONObject("detail")
        assertEquals(gx-32,start.getDouble("clientX"),.6);assertEquals(24.0,start.getDouble("x"),.01);assertEquals(0.0,start.getDouble("dx"),.01)
        assertEquals(40.0,end.getDouble("dx"),.6);assertEquals(20.0,end.getDouble("dy"),.6);assertEquals(64.0,end.getDouble("x"),.6);assertEquals(36.0,end.getDouble("y"),.6)
        Thread.sleep(100);val moved=part(command(JSONObject().put("command","frame")),"item-0")
        assertEquals(32.0+64,moved.getDouble("x"),.6);assertEquals(32.0+36,moved.getDouble("y"),.6)
        for(bad in listOf(JSONObject().put("variant","plain"),JSONObject().put("elevation",9),JSONObject().put("floating","yes"),JSONObject().put("width",3))) {
            val response=request("POST","/command",token,JSONObject().put("command","update").put("properties",bad));assertTrue(response.first>=400 || response.second.has("error"))
        }
        AccordionEvidence.log("laboratory-host",JSONObject().put("gap",second.getDouble("y")-(first.getDouble("y")+first.getDouble("height"))).put("floating",panel).put("drag",JSONArray(drag.map { it.getJSONObject("detail") })))
    }
    @Test fun accordionItemAppearanceAndControllerMethods()=withHost { token,command->
        command(JSONObject().put("command","configure").put("tag","md-accordion-item").put("width",640)
            .put("properties",JSONObject().put("headline","A shared design language").put("supportingText","Built for every surface").put("expanded",true))
            .put("accordionItemAppearance",JSONObject().put("headerMinHeight",96).put("contentPadding",JSONObject().put("top",30).put("right",24).put("bottom",30).put("left",24))))
        Thread.sleep(150)
        val frame=command(JSONObject().put("command","frame"))
        assertEquals("Header minimum height hook",96.0,part(frame,"header").getDouble("height"),.6)
        val toggled=events(command(JSONObject().put("command","method").put("method","toggle").put("arguments",JSONArray())))+events(command(JSONObject().put("command","frame")))
        val detail=one(toggled,"mdItemToggle")
        assertFalse(detail.getBoolean("expanded"));assertEquals("A standalone item is never owned",-1,detail.getInt("index"))
        assertTrue(events(command(JSONObject().put("command","method").put("method","focusHeader").put("arguments",JSONArray()))).none { it.getString("name")=="mdItemToggle" })
        // A semantics-only retained update still acknowledges (it draws no new pixels).
        command(JSONObject().put("command","update").put("properties",JSONObject().put("regionRole","group")))
        command(JSONObject().put("command","update").put("properties",JSONObject().put("disabled",true)))
        val blocked=events(command(JSONObject().put("command","method").put("method","toggle").put("arguments",JSONArray())))
        assertTrue("toggle() is blocked on a disabled item",blocked.none { it.getString("name")=="mdItemToggle" })
        val invalid=request("POST","/command",token,JSONObject().put("command","method").put("method","toggle").put("arguments",JSONArray().put(1)))
        assertTrue(invalid.first>=400 || invalid.second.has("error"))
    }
    private fun pointer(phase:String,x:Double,y:Double)=JSONObject().put("command","pointer").put("phase",phase).put("x",x).put("y",y)
    private fun nodes(frame:JSONObject)=frame.getJSONObject("inspection").getJSONArray("nodes").let { a->(0 until a.length()).map { a.getJSONObject(it) } }
    private fun part(frame:JSONObject,name:String):JSONObject {
        val matches=nodes(frame).filter { it.getString("id")=="component.$name" }
        assertEquals("component.$name in ${nodes(frame).map { it.getString("id") }}",1,matches.size)
        return matches.single().getJSONObject("bounds")
    }
    private fun one(events:List<JSONObject>,name:String):JSONObject {
        val matches=events.filter { it.getString("name")==name }
        assertEquals("$name once in $events",1,matches.size)
        return matches.single().getJSONObject("detail")
    }
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
