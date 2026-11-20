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

/** Laboratory host: dedicated Transfer list renderer, typed appearance, retained updates with the source property types,
 *  a pointer check on a row and the moveSelectedRight()/moveSelectedLeft() methods (mdChange + mdMove). Mirrors
 *  apps/native-ios-playground/scripts/test-live-transferlist.mjs. */
class LivePreviewTransferListHostTest {
    private val items=JSONArray("""[{"value":"a","label":"Analytics","description":"Dashboards"},{"value":"b","label":"Billing"},{"value":"c","label":"Calendar"}]""")
    private fun configure(properties:JSONObject,extra:JSONObject.()->Unit={})=JSONObject().put("command","configure").put("tag","md-transfer-list").put("width",900).put("dark",false).put("properties",properties).apply(extra)
    private fun base()=JSONObject().put("items",items).put("value",JSONArray().put("c"))
    @Test fun transferListAppearanceRetainedUpdatesPointerAndMethods() {
        withHost { _,command->
            command(configure(base()));Thread.sleep(500)
            val frame=command(JSONObject().put("command","frame"))
            val host=root(frame);val column=part(frame,"column-source")
            assertTrue("dedicated renderer: host $host, source column $column",host.getDouble("width")>=800 && column!=null && Math.abs(column.getDouble("height")-360)<1)
            assertNotNull("rows on their sides (value = target)",part(frame,"item-s:a"));assertNotNull(part(frame,"item-t:c"))
        }
        withHost { _,command->
            // The column cap hook (the local value wins over the subtree default).
            command(configure(base()) { put("transferListAppearanceDefaults",JSONObject().put("columnMaxBlock",300));put("transferListAppearance",JSONObject().put("columnMaxBlock",240).put("itemPadding",JSONObject().put("top",4).put("right",8).put("bottom",4).put("left",8))) });Thread.sleep(500)
            val capped=part(command(JSONObject().put("command","frame")),"column-source")
            assertTrue("columnMaxBlock 240 caps the column ($capped)",capped!=null && Math.abs(capped.getDouble("height")-240)<1)
        }
        withHost { token,command->
            command(configure(base()));Thread.sleep(400)
            command(JSONObject().put("command","update").put("properties",JSONObject().put("value",JSONArray().put("a").put("c")).put("countTemplate","{checked} of {total}")));Thread.sleep(500)
            var frame=command(JSONObject().put("command","frame"))
            assertTrue("value update moves Analytics to the target",part(frame,"item-t:a")!=null && part(frame,"item-s:a")==null)
            val row0=part(frame,"item-t:a")!!.getDouble("height")
            command(JSONObject().put("command","update").put("properties",JSONObject().put("density",-4)));Thread.sleep(500)
            frame=command(JSONObject().put("command","frame"))
            val row4=part(frame,"item-t:a")!!.getDouble("height")
            assertTrue("density -4 is denser ($row0 -> $row4)",row4<row0-8)
            for(bad in listOf(JSONObject().put("items",3),JSONObject().put("value","b"),JSONObject().put("value",JSONArray().put(1)),JSONObject().put("searchable","false"),
                JSONObject().put("density",-5),JSONObject().put("sourceTitle",3),JSONObject().put("open",true))) {
                val response=request("POST","/command",token,JSONObject().put("command","update").put("properties",bad));assertTrue("$bad rejected",response.first>=400 || response.second.has("error"))
            }
        }
        withHost { token,command->
            command(configure(base()));Thread.sleep(500)
            // Pointer: a click on a source row checks it; moveSelectedRight() moves it with the source payloads.
            val b=part(command(JSONObject().put("command","frame")),"item-s:b")!!
            val x=b.getDouble("x")+b.getDouble("width")/2;val y=b.getDouble("y")+b.getDouble("height")/2
            val seen=mutableListOf<JSONObject>()
            for(phase in listOf("move","down","up")) seen+=events(command(JSONObject().put("command","pointer").put("phase",phase).put("x",x).put("y",y)))
            Thread.sleep(300);seen+=events(command(JSONObject().put("command","frame")))
            seen+=events(command(JSONObject().put("command","method").put("method","moveSelectedRight").put("arguments",JSONArray())))
            seen+=poll(command,"mdMove")
            val change=seen.filter { it.getString("name")=="mdChange" };val move=seen.filter { it.getString("name")=="mdMove" }
            assertEquals("one mdChange in $seen",1,change.size);assertEquals("[\"c\",\"b\"]",change.single().getJSONArray("detail").toString())
            assertEquals("one mdMove in $seen",1,move.size)
            val detail=move.single().getJSONObject("detail")
            assertEquals("right",detail.getString("direction"));assertEquals("[\"b\"]",detail.getJSONArray("moved").toString());assertEquals("[\"c\",\"b\"]",detail.getJSONArray("target").toString())
            Thread.sleep(300)
            assertNotNull("Billing is on the target side",part(command(JSONObject().put("command","frame")),"item-t:b"))
            // moveSelectedLeft() with nothing checked: no events.
            val none=events(command(JSONObject().put("command","method").put("method","moveSelectedLeft").put("arguments",JSONArray())))+run { Thread.sleep(400);events(command(JSONObject().put("command","frame"))) }
            assertTrue("moveSelectedLeft() with nothing checked emits nothing: $none",none.none { it.getString("name").startsWith("md") })
            val invalid=request("POST","/command",token,JSONObject().put("command","method").put("method","moveSelectedRight").put("arguments",JSONArray().put(1)))
            assertTrue("methods take no arguments",invalid.first>=400 || invalid.second.has("error"))
        }
    }
    private fun poll(command:(JSONObject)->JSONObject,name:String):List<JSONObject> {
        val seen=mutableListOf<JSONObject>();val deadline=System.currentTimeMillis()+1500
        while(System.currentTimeMillis()<deadline) { Thread.sleep(60);seen+=events(command(JSONObject().put("command","frame")));if(seen.any { it.getString("name")==name }) { Thread.sleep(120);seen+=events(command(JSONObject().put("command","frame")));break } }
        return seen
    }
    private fun root(frame:JSONObject):JSONObject {
        val matches=nodes(frame).filter { it.getString("id")=="component" && it.optString("name")=="md-transfer-list" }
        assertEquals("md-transfer-list root in ${nodes(frame).map { it.getString("id")+"/"+it.optString("name") }}",1,matches.size)
        return matches.single().getJSONObject("bounds")
    }
    private fun part(frame:JSONObject,id:String)=nodes(frame).firstOrNull { it.getString("id")=="component.$id" }?.getJSONObject("bounds")
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
