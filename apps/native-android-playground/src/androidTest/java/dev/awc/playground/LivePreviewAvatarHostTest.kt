package dev.awc.playground

import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.Base64
import androidx.test.core.app.ActivityScenario
import androidx.test.core.app.ApplicationProvider
import androidx.test.platform.app.InstrumentationRegistry
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import java.net.HttpURLConnection
import java.net.URL
import java.util.UUID
import kotlin.math.abs

/** Laboratory host: dedicated Avatar renderer, typed appearance (palette hooks included), retained updates and the image events. */
class LivePreviewAvatarHostTest {
    private fun length(points:Int)=JSONObject().put("points",points).put("fraction",0).put("em",0).put("rem",0).put("ch",0)
    private val images=InstrumentationRegistry.getInstrumentation().context.assets.open("AvatarWebLifecycle.json").bufferedReader().use { JSONObject(it.readText()) }.getJSONObject("images")
    private fun configure(properties:JSONObject,extra:JSONObject.()->Unit={})=JSONObject().put("command","configure").put("tag","md-avatar").put("width",640).put("dark",false).put("properties",properties).apply(extra)
    @Test fun avatarAppearanceRetainedUpdatesImageEventsAndFallback() {
        withHost { _,command->
            // Dispatch: Ada Lovelace → AL in palette bucket 3 (tertiary container), large 56.
            command(configure(JSONObject().put("name","Ada Lovelace").put("size","large")));Thread.sleep(200)
            val frame=command(JSONObject().put("command","frame"))
            val box=avatar(frame)
            assertEquals("large preset",56.0,box.getDouble("width"),.6);assertEquals(56.0,box.getDouble("height"),.6)
            assertColor("palette 3 container",0xFFD8E4,fill(frame,box))
        }
        withHost { _,command->
            // Typed appearance: the local palette hook wins over the subtree default; size, outline hooks.
            command(configure(JSONObject().put("name","Ada Lovelace")) {
                put("avatarAppearanceDefaults",JSONObject().put("palette3Container","#00FF00"))
                put("avatarAppearance",JSONObject().put("size",length(52)).put("palette3Container","#123456").put("outlineWidth",length(3)).put("outlineColor","#FF0000"))
            });Thread.sleep(200)
            val frame=command(JSONObject().put("command","frame"));val box=avatar(frame)
            assertEquals("size hook",52.0,box.getDouble("width"),.6)
            assertColor("local palette hook",0x123456,fill(frame,box))
            assertColor("outline ring over the content",0xFF0000,pixel(frame,box.getDouble("x")+box.getDouble("width")/2,box.getDouble("y")+1.0))
        }
        withHost { _,command->
            // containerColor colours only neutral avatars (no name palette), as in the source.
            command(configure(JSONObject().put("name","Ada Lovelace").put("colorFromName",false)) { put("avatarAppearance",JSONObject().put("containerColor","#FFE082")) });Thread.sleep(200)
            val frame=command(JSONObject().put("command","frame"));assertColor("neutral container hook",0xFFE082,fill(frame,avatar(frame)))
        }
        withHost { _,command->
            command(configure(JSONObject().put("name","Ada Lovelace")) { put("avatarAppearance",JSONObject().put("containerColor","#FFE082")) });Thread.sleep(200)
            val frame=command(JSONObject().put("command","frame"));assertColor("the name palette wins over containerColor",0xFFD8E4,fill(frame,avatar(frame)))
        }
        withHost { token,command->
            // Retained updates: density and size re-evaluate the preset; colorFromName drops the palette.
            command(configure(JSONObject().put("name","Ada Lovelace").put("size","large")));Thread.sleep(150)
            command(JSONObject().put("command","update").put("properties",JSONObject().put("size","small").put("density",-2)));Thread.sleep(150)
            var frame=command(JSONObject().put("command","frame"))
            assertEquals("small at density -2: max(18, 24 - 3)",21.0,avatar(frame).getDouble("width"),.6)
            command(JSONObject().put("command","update").put("properties",JSONObject().put("size","4rem").put("colorFromName",false)));Thread.sleep(150)
            frame=command(JSONObject().put("command","frame"));val box=avatar(frame)
            assertEquals("custom CSS size",64.0,box.getDouble("width"),.6)
            assertColor("neutral surface-container-highest",0xE6E0E9,fill(frame,box))
            // Image events: mdLoad with { src }, then mdError and the fallback to initials.
            val square=images.getString("square");val broken=images.getString("broken")
            val loaded=collect(command,JSONObject().put("src",square),"mdLoad")
            assertEquals(square,loaded.getString("src"))
            frame=command(JSONObject().put("command","frame"))
            assertNotEquals("the image replaces the container fill",0xE6E0E9,rgb(fill(frame,avatar(frame))))
            val failed=collect(command,JSONObject().put("src",broken),"mdError")
            assertEquals(broken,failed.getString("src"))
            Thread.sleep(150);frame=command(JSONObject().put("command","frame"))
            assertColor("a failed image falls back to the initials tile",0xE6E0E9,fill(frame,avatar(frame)))
            for(bad in listOf(JSONObject().put("shape","oval"),JSONObject().put("density",-5),JSONObject().put("colorFromName","yes"),JSONObject().put("crossorigin","x"),JSONObject().put("loading","auto"),JSONObject().put("headline","x"))) {
                val response=request("POST","/command",token,JSONObject().put("command","update").put("properties",bad));assertTrue("$bad rejected",response.first>=400 || response.second.has("error"))
            }
        }
        withHost { _,command->
            // No image and no initials: the person icon (slot fallback) in the neutral tile, medium 40 (the host fixture is large).
            command(configure(JSONObject().put("name","").put("size","medium")));Thread.sleep(150)
            val frame=command(JSONObject().put("command","frame"));val box=avatar(frame)
            assertEquals(40.0,box.getDouble("width"),.6)
            assertColor("neutral tile",0xE6E0E9,pixel(frame,box.getDouble("x")+3,box.getDouble("y")+box.getDouble("height")/2))
            assertTrue("person glyph ink (on-surface-variant) in the icon box",ink(frame,box,0x49454F)>20)
        }
    }
    private fun collect(command:(JSONObject)->JSONObject,patch:JSONObject,name:String):JSONObject {
        val seen=mutableListOf<JSONObject>();seen+=events(command(JSONObject().put("command","update").put("properties",patch)))
        val deadline=System.currentTimeMillis()+3000
        while(seen.none { it.getString("name")==name } && System.currentTimeMillis()<deadline) { Thread.sleep(50);seen+=events(command(JSONObject().put("command","frame"))) }
        val matches=seen.filter { it.getString("name")==name }
        assertEquals("$name once in $seen",1,matches.size)
        return matches.single().getJSONObject("detail")
    }
    private fun avatar(frame:JSONObject):JSONObject {
        val matches=nodes(frame).filter { it.getString("id")=="component" && it.optString("name")=="md-avatar" }
        assertEquals("md-avatar root in ${nodes(frame).map { it.getString("id")+"/"+it.optString("name") }}",1,matches.size)
        return matches.single().getJSONObject("bounds")
    }
    private fun bitmap(frame:JSONObject):Bitmap { val bytes=Base64.decode(frame.getString("png"),Base64.DEFAULT);return BitmapFactory.decodeByteArray(bytes,0,bytes.size) }
    /** The tile colour above the glyphs (20 % down the centre line). */
    private fun fill(frame:JSONObject,box:JSONObject)=pixel(frame,box.getDouble("x")+box.getDouble("width")/2,box.getDouble("y")+box.getDouble("height")*.2)
    private fun pixel(frame:JSONObject,x:Double,y:Double):Int { val b=bitmap(frame);val scale=b.width/640.0;return b.getPixel((x*scale).toInt(),(y*scale).toInt()) }
    private fun rgb(color:Int)=color and 0xFFFFFF
    /** Device pixels of [color] (±12 per channel) in the centred 60 % of the avatar. */
    private fun ink(frame:JSONObject,box:JSONObject,color:Int):Int { val b=bitmap(frame);val scale=b.width/640.0;var n=0
        val x0=((box.getDouble("x")+box.getDouble("width")*.2)*scale).toInt();val x1=((box.getDouble("x")+box.getDouble("width")*.8)*scale).toInt()
        val y0=((box.getDouble("y")+box.getDouble("height")*.2)*scale).toInt();val y1=((box.getDouble("y")+box.getDouble("height")*.8)*scale).toInt()
        for(y in y0 until y1) for(x in x0 until x1) { val c=b.getPixel(x,y);if(listOf(16,8,0).all { abs((color shr it and 255)-(c shr it and 255))<=12 }) n++ }
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
