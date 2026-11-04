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

/** Laboratory host: dedicated List renderer, typed appearance, retained updates, controller methods and pointer selection. */
class LivePreviewListHostTest {
    @Test fun listAppearanceRetainedUpdatesMethodsAndPointerSelection() {
        // Fixture: a single-select list of three one-line rows (headline + leading icon, 56 each) with block padding 8.
        var base=JSONObject()
        withHost { _,command->
            command(JSONObject().put("command","configure").put("tag","md-list").put("width",640).put("properties",JSONObject()))
            Thread.sleep(200)
            base=root(command(JSONObject().put("command","frame")),"md-list")
        }
        assertEquals("Three 56 rows and block padding 8",184.0,base.getDouble("height"),.6)
        withHost { _,command->
            // Local list padding wins over the subtree default; row spacing hooks are inherited by every row.
            command(JSONObject().put("command","configure").put("tag","md-list").put("width",640).put("properties",JSONObject())
                .put("listAppearanceDefaults",JSONObject().put("paddingBlock",4))
                .put("listAppearance",JSONObject().put("paddingBlock",20).put("paddingInline",6))
                .put("listItemAppearance",JSONObject().put("topSpace",24).put("bottomSpace",24)))
            Thread.sleep(200)
            val styled=root(command(JSONObject().put("command","frame")),"md-list")
            assertEquals("Padding 20 (+24) and rows 24 + 24 + 24 (+16 each)",base.getDouble("height")+24+48,styled.getDouble("height"),.6)
        }
        withHost { token,command->
            command(JSONObject().put("command","configure").put("tag","md-list").put("width",640).put("properties",JSONObject()))
            Thread.sleep(200)
            // Retained update: segmented lists drop the block padding and separate rows by 2.
            command(JSONObject().put("command","update").put("properties",JSONObject().put("listStyle","segmented")))
            Thread.sleep(150)
            val segmented=root(command(JSONObject().put("command","frame")),"md-list")
            assertEquals("Segmented: 3 × 56 + 2 gaps of 2",172.0,segmented.getDouble("height"),.6)
            command(JSONObject().put("command","update").put("properties",JSONObject().put("listStyle","standard")))
            Thread.sleep(150)
            // Controller methods: roving activation emits mdActivate, selectItem is silent, getSelectedIndices returns the indices.
            val activated=command(method("activateNext"))
            Thread.sleep(100)
            val activate=events(activated)+events(command(JSONObject().put("command","frame")))
            assertEquals("activateNext moves from the initially active first row to the second: $activate",1,one(activate,"mdActivate").getInt("index"))
            val silent=events(command(method("selectItem",JSONArray().put(1))))
            assertTrue("selectItem emits no mdSelect: $silent",silent.none { it.getString("name")=="mdSelect" })
            assertEquals("[1]",command(method("getSelectedIndices")).getJSONArray("result").toString())
            // Pointer selection of the third row with the source payload.
            val list=root(command(JSONObject().put("command","frame")),"md-list")
            val x=list.getDouble("x")+60;val y=list.getDouble("y")+8+56*2.5
            command(pointer("move",x,y))
            val clicked=events(command(pointer("down",x,y)))+events(command(pointer("up",x,y)))
            Thread.sleep(150)
            val select=one(clicked+events(command(JSONObject().put("command","frame"))),"mdSelect")
            assertEquals(2,select.getInt("index"));assertTrue(select.getBoolean("selected"));assertTrue(select.has("item"))
            assertEquals("Single selection moves to the clicked row","[2]",command(method("getSelectedIndices")).getJSONArray("result").toString())
            for(bad in listOf(JSONObject().put("listStyle","plain"),JSONObject().put("density",-5),JSONObject().put("reorderable","yes"),JSONObject().put("headline","x"))) {
                val response=request("POST","/command",token,JSONObject().put("command","update").put("properties",bad))
                assertTrue("Invalid update $bad",response.first>=400 || response.second.has("error"))
            }
            val badMethod=request("POST","/command",token,method("selectItem",JSONArray().put("1")))
            assertTrue("selectItem rejects a non-index argument",badMethod.first>=400 || badMethod.second.has("error"))
        }
        withHost { token,command->
            // md-list-item: item methods and retained updates on a standalone expandable row.
            command(JSONObject().put("command","configure").put("tag","md-list-item").put("width",640).put("properties",JSONObject().put("expandable",true).put("type","text")))
            Thread.sleep(200)
            assertEquals("Collapsed panel",0.0,panel(command(JSONObject().put("command","frame"))),.5)
            val expand=events(command(method("expand")))
            Thread.sleep(600)
            val open=command(JSONObject().put("command","frame"))
            assertTrue("expand() opens the panel",panel(open)>8)
            assertTrue("expand() emits no mdExpand",(expand+events(open)).none { it.getString("name")=="mdExpand" })
            command(method("toggle"))
            Thread.sleep(600)
            assertEquals("toggle() collapses",0.0,panel(command(JSONObject().put("command","frame"))),.5)
            command(JSONObject().put("command","update").put("properties",JSONObject().put("headline","Renamed row").put("disabled",true)))
            Thread.sleep(150)
            command(method("expand"))
            Thread.sleep(400)
            assertEquals("expand() is a no-op on a disabled row",0.0,panel(command(JSONObject().put("command","frame"))),.5)
            command(method("setFocus",JSONArray().put(JSONObject().put("focusVisible",true))))
            val badFocus=request("POST","/command",token,method("setFocus",JSONArray().put("visible")))
            assertTrue("setFocus rejects a non-object argument",badFocus.first>=400 || badFocus.second.has("error"))
        }
    }
    private fun method(name:String,arguments:JSONArray=JSONArray())=JSONObject().put("command","method").put("method",name).put("arguments",arguments)
    private fun root(frame:JSONObject,name:String):JSONObject {
        val matches=nodes(frame).filter { it.getString("id")=="component" && it.optString("name")==name }
        assertEquals("$name root in ${nodes(frame).map { it.getString("id")+"/"+it.optString("name") }}",1,matches.size)
        return matches.single().getJSONObject("bounds")
    }
    private fun panel(frame:JSONObject):Double=nodes(frame).firstOrNull { it.getString("id")=="component.expanded-panel" }?.getJSONObject("bounds")?.getDouble("height") ?: 0.0
    private fun pointer(phase:String,x:Double,y:Double)=JSONObject().put("command","pointer").put("phase",phase).put("x",x).put("y",y)
    private fun nodes(frame:JSONObject)=frame.getJSONObject("inspection").getJSONArray("nodes").let { a->(0 until a.length()).map { a.getJSONObject(it) } }
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
