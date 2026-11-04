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

/** Laboratory host: dedicated Card renderer, typed appearance, retained updates, pointer activation and the drag gesture. */
class LivePreviewCardHostTest {
    private val width300=JSONObject().put("points",300).put("fraction",0).put("em",0).put("rem",0).put("ch",0)
    @Test fun cardAppearanceRetainedUpdatesPointerActivationAndDrag() {
        // Recipe content (four children, three gaps) with a fixed width so wrapping cannot change.
        // A host session is configured once; each configuration uses its own session.
        var base=JSONObject()
        withHost { _,command->
            command(JSONObject().put("command","configure").put("tag","md-card").put("width",640).put("properties",JSONObject())
                .put("cardAppearance",JSONObject().put("width",width300)))
            Thread.sleep(150)
            base=card(command(JSONObject().put("command","frame")))
        }
        assertEquals("Width hook",300.0,base.getDouble("width"),.6)
        withHost { _,command->
        command(JSONObject().put("command","configure").put("tag","md-card").put("width",640).put("properties",JSONObject())
            .put("cardAppearanceDefaults",JSONObject().put("gap",4).put("containerColor","#00FF00"))
            .put("cardAppearance",JSONObject().put("width",width300).put("gap",12).put("padding",JSONObject().put("top",20).put("right",16).put("bottom",28).put("left",16))))
        Thread.sleep(150)
        val styled=card(command(JSONObject().put("command","frame")))
        assertEquals("Padding +16 and three gaps of 12 instead of 8",base.getDouble("height")+28,styled.getDouble("height"),.6)
        }
        withHost { token,command->
        // Plain text content: retained density and the pointer click.
        command(JSONObject().put("command","configure").put("tag","md-card").put("width",640).put("properties",JSONObject().put("interactive",true))
            .put("slots",JSONObject().put("","Open project")))
        Thread.sleep(150)
        val plain=card(command(JSONObject().put("command","frame")))
        command(JSONObject().put("command","update").put("properties",JSONObject().put("density",-4)))
        Thread.sleep(150)
        val dense=card(command(JSONObject().put("command","frame")))
        // Source density scale: padding 16 → 8 and body-medium line height 20 → 16 (12px type) for one line of text.
        assertEquals("One line at density 0: 16 + 20 + 16",52.0,plain.getDouble("height"),.6)
        assertEquals("Density -4: 8 + 16 + 8",32.0,dense.getDouble("height"),.6)
        val cx=dense.getDouble("x")+dense.getDouble("width")/2;val cy=dense.getDouble("y")+dense.getDouble("height")/2
        command(pointer("move",cx,cy))
        val clicked=events(command(pointer("down",cx,cy)))+events(command(pointer("up",cx,cy)))
        Thread.sleep(100)
        val click=one(clicked+events(command(JSONObject().put("command","frame"))),"mdClick")
        assertTrue(click.getBoolean("isTrusted"));assertEquals(1,click.getInt("detail"));assertEquals(0,click.getInt("button"))
        // Drag: 5-point Manhattan threshold, start + move with the same detail, end without a click.
        command(JSONObject().put("command","update").put("properties",JSONObject().put("interactive",false).put("dragEnabled",true)))
        Thread.sleep(100)
        val sx=dense.getDouble("x")+10;val sy=cy
        val below=events(command(pointer("down",sx,sy)))+events(command(pointer("move",sx+3,sy)))
        assertTrue("3 points stay below the threshold",below.none { it.getString("name")=="mdDragStart" })
        val moved=below+events(command(pointer("move",sx+12,sy+6)))+events(command(pointer("move",sx+30,sy+12)))+events(command(pointer("up",sx+30,sy+12)))
        Thread.sleep(100)
        val drag=(moved+events(command(JSONObject().put("command","frame")))).filter { it.getString("name").startsWith("mdDrag") || it.getString("name")=="mdClick" }
        assertEquals("mdDragStart",drag.first().getString("name"));assertEquals("mdDragMove",drag[1].getString("name"))
        assertEquals(drag[0].getJSONObject("detail").toString(),drag[1].getJSONObject("detail").toString())
        assertEquals("mdDragEnd",drag.last().getString("name"));assertTrue(drag.none { it.getString("name")=="mdClick" })
        val end=drag.last().getJSONObject("detail")
        for(key in listOf("clientX","clientY","offsetX","offsetY","startX","startY")) assertTrue(key,end.has(key))
        assertEquals(30.0,end.getDouble("clientX")-end.getDouble("startX"),1.0);assertEquals(12.0,end.getDouble("clientY")-end.getDouble("startY"),1.0)
        for(bad in listOf(JSONObject().put("variant","tonal"),JSONObject().put("density",-5),JSONObject().put("interactive","yes"),JSONObject().put("width",3))) {
            val response=request("POST","/command",token,JSONObject().put("command","update").put("properties",bad));assertTrue(response.first>=400 || response.second.has("error"))
        }
        }
    }
    private fun card(frame:JSONObject):JSONObject {
        val matches=nodes(frame).filter { it.getString("id")=="component" && it.optString("name")=="md-card" }
        assertEquals("md-card root in ${nodes(frame).map { it.getString("id")+"/"+it.optString("name") }}",1,matches.size)
        return matches.single().getJSONObject("bounds")
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
