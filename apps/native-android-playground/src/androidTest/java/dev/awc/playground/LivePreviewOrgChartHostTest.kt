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

/** Laboratory host: dedicated Organization chart renderer, typed appearance, retained updates with the source property types,
 *  the WAI-ARIA tree keys (fold with mdNodeToggle) and pointer selection (mdSelectionChange). */
class LivePreviewOrgChartHostTest {
    private val nodes=JSONArray("""[{"id":"studio","name":"AWC Studio","title":"Design systems","children":[{"id":"ios","name":"iOS","title":"SwiftUI"},{"id":"android","name":"Android","title":"Compose"}]}]""")
    private fun configure(properties:JSONObject,extra:JSONObject.()->Unit={})=JSONObject().put("command","configure").put("tag","md-organization-chart").put("width",640).put("dark",false).put("properties",properties).apply(extra)
    private fun base()=JSONObject().put("nodes",nodes).put("selectionMode","single")
    @Test fun organizationChartAppearanceRetainedUpdatesKeysAndPointer() {
        var height=0.0
        withHost { _,command->
            command(configure(base()));Thread.sleep(500)
            val box=chart(command(JSONObject().put("command","frame")))
            height=box.getDouble("height")
            assertTrue("two levels in the 640 dp host: $box",height>150 && box.getDouble("width")>=500)
        }
        withHost { _,command->
            // The level gap hook (the local value wins over the subtree default) adds to the host height.
            command(configure(base()) { put("orgChartAppearanceDefaults",JSONObject().put("levelGap",30));put("orgChartAppearance",JSONObject().put("levelGap",64).put("connectorColor","#C62828")) });Thread.sleep(500)
            val gapped=chart(command(JSONObject().put("command","frame"))).getDouble("height")
            assertTrue("levelGap 64 grows the chart ($height -> $gapped)",gapped-height>20)
        }
        withHost { token,command->
            command(configure(base()));Thread.sleep(400)
            command(JSONObject().put("command","update").put("properties",JSONObject().put("density",-4)));Thread.sleep(500)
            val dense=chart(command(JSONObject().put("command","frame"))).getDouble("height")
            assertTrue("density -4 is denser ($height -> $dense)",dense<height-8)
            command(JSONObject().put("command","update").put("properties",JSONObject().put("density",0).put("nodes","""[{"id":"solo","name":"Solo"}]""")));Thread.sleep(500)
            val solo=chart(command(JSONObject().put("command","frame"))).getDouble("height")
            assertTrue("nodes as a JSON string: one root ($solo)",solo<height/2+40)
            for(bad in listOf(JSONObject().put("orientation","radial"),JSONObject().put("density",-5),JSONObject().put("selectionMode","all"),JSONObject().put("nodes",3),
                JSONObject().put("selectedIds","studio"),JSONObject().put("collapsible","false"),JSONObject().put("open",true))) {
                val response=request("POST","/command",token,JSONObject().put("command","update").put("properties",bad));assertTrue("$bad rejected",response.first>=400 || response.second.has("error"))
            }
        }
        withHost { _,command->
            command(configure(base()));Thread.sleep(500)
            // Pointer: a click on the root card selects it with the source payload.
            val box=chart(command(JSONObject().put("command","frame")))
            val x=box.getDouble("x")+box.getDouble("width")/2;val y=box.getDouble("y")+8+20
            val seen=mutableListOf<JSONObject>()
            for(phase in listOf("move","down","up")) seen+=events(command(JSONObject().put("command","pointer").put("phase",phase).put("x",x).put("y",y)))
            seen+=poll(command,"mdSelectionChange")
            val selection=seen.filter { it.getString("name")=="mdSelectionChange" }
            assertEquals("one mdSelectionChange in $seen",1,selection.size)
            val detail=selection.single().getJSONObject("detail")
            assertEquals("studio",detail.getJSONObject("node").getString("id"));assertEquals("[\"studio\"]",detail.getJSONArray("selectedIds").toString())
            // Keyboard: the clicked row holds focus; ArrowLeft folds the expanded root, ArrowRight unfolds it.
            val fold=events(command(JSONObject().put("command","key").put("key","ArrowLeft")))+poll(command,"mdNodeToggle")
            val folded=fold.filter { it.getString("name")=="mdNodeToggle" }
            assertEquals("one fold in $fold",1,folded.size);assertFalse(folded.single().getJSONObject("detail").getBoolean("expanded"))
            Thread.sleep(400)
            assertTrue("the folded chart shows only the root",chart(command(JSONObject().put("command","frame"))).getDouble("height")<height-40)
            val unfold=events(command(JSONObject().put("command","key").put("key","ArrowRight")))+poll(command,"mdNodeToggle")
            val unfolded=unfold.filter { it.getString("name")=="mdNodeToggle" }
            assertEquals("one unfold in $unfold",1,unfolded.size);assertTrue(unfolded.single().getJSONObject("detail").getBoolean("expanded"))
        }
    }
    private fun poll(command:(JSONObject)->JSONObject,name:String):List<JSONObject> {
        val seen=mutableListOf<JSONObject>();val deadline=System.currentTimeMillis()+1500
        while(System.currentTimeMillis()<deadline) { Thread.sleep(60);seen+=events(command(JSONObject().put("command","frame")));if(seen.any { it.getString("name")==name }) { Thread.sleep(120);seen+=events(command(JSONObject().put("command","frame")));break } }
        return seen
    }
    private fun chart(frame:JSONObject):JSONObject {
        val matches=nodes(frame).filter { it.getString("id")=="component" && it.optString("name")=="md-organization-chart" }
        assertEquals("md-organization-chart root in ${nodes(frame).map { it.getString("id")+"/"+it.optString("name") }}",1,matches.size)
        return matches.single().getJSONObject("bounds")
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
