package dev.awc.playground

import android.content.Intent
import android.graphics.BitmapFactory
import android.util.Base64
import androidx.test.core.app.ActivityScenario
import androidx.test.core.app.ApplicationProvider
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import java.net.HttpURLConnection
import java.net.URL
import java.util.UUID
import kotlin.math.abs
import kotlin.math.max

/**
 * Gate-7 R2-D6: retained Laboratory property updates for md-badge, md-loading-indicator, md-meter and md-status-dot.
 * The mounted Compose root must survive an update, so the source's property-change behaviour stays visible:
 * md-meter's 300 ms value glide, md-status-dot's 200 ms colour transition and the continuous loading morph.
 */
class LivePreviewCommunicationHostTest {
    private fun node(frame:JSONObject,id:String="component"):JSONObject?=frame.optJSONObject("inspection")?.optJSONArray("nodes")?.let { nodes ->
        (0 until nodes.length()).map { nodes.getJSONObject(it) }.find { it.getString("id")==id }
    }
    private fun bounds(frame:JSONObject,id:String="component")=checkNotNull(node(frame,id)) { "missing $id in $frame" }.getJSONObject("bounds")
    private fun colour(frame:JSONObject,x:Double,y:Double):IntArray { val b=decode(frame);try { val c=b.getPixel((x*2).toInt(),(y*2).toInt())
        return intArrayOf(android.graphics.Color.red(c),android.graphics.Color.green(c),android.graphics.Color.blue(c)) } finally { b.recycle() } }
    private fun dist(a:IntArray,b:IntArray)=a.indices.maxOf { abs(a[it]-b[it]) }
    private fun regionMean(a:JSONObject,b:JSONObject,box:JSONObject):Double {
        val x0=(box.getDouble("x")*2).toInt();val y0=(box.getDouble("y")*2).toInt();val w=(box.getDouble("width")*2).toInt();val h=(box.getDouble("height")*2).toInt()
        val p=decode(a);val q=decode(b);var sum=0.0;var n=0
        try { for(y in y0 until y0+h) for(x in x0 until x0+w) { val c=p.getPixel(x,y);val d=q.getPixel(x,y)
            sum+=abs(android.graphics.Color.red(c)-android.graphics.Color.red(d))+abs(android.graphics.Color.green(c)-android.graphics.Color.green(d))+abs(android.graphics.Color.blue(c)-android.graphics.Color.blue(d));n+=3 } }
        finally { p.recycle();q.recycle() }
        return sum/max(1,n)
    }

    @Test fun meterValueGlidesAcrossARetainedUpdate() = withHost { token,command ->
        command(JSONObject().put("command","configure").put("tag","md-meter").put("width",640)
            .put("properties",JSONObject().put("value",72).put("showLabel",false).put("showValue",false)))
        Thread.sleep(500)
        assertEquals(216.0,bounds(command(JSONObject().put("command","frame")),"component.indicator").getDouble("width"),.5)
        // The host answers an update once its draws have settled (gate-7 R1-15); under heavy load that can take most of the
        // 300 ms glide, so the frames are sampled while the update is being answered. An attempt that still saw no
        // intermediate width (slow captures) is inconclusive and is repeated, at most twice.
        var widths=mutableListOf<Pair<Long,Double>>()
        for(attempt in 1..3) {
            val start=System.currentTimeMillis();widths=mutableListOf()
            val update=java.util.concurrent.CompletableFuture.supplyAsync { command(JSONObject().put("command","update").put("properties",JSONObject().put("value",20))) }
            while(System.currentTimeMillis()-start<900) { widths+=(System.currentTimeMillis()-start) to bounds(command(JSONObject().put("command","frame")),"component.indicator").getDouble("width");Thread.sleep(15) }
            val ack=update.get(5,java.util.concurrent.TimeUnit.SECONDS)
            assertTrue(ack.getBoolean("ack"));assertEquals(0,ack.getJSONArray("events").length())
            if(widths.any { it.second>61 && it.second<215 } || attempt==3) break
            command(JSONObject().put("command","update").put("properties",JSONObject().put("value",72)));Thread.sleep(800)
        }
        val trace=widths.joinToString(" ") { "${it.first}:${"%.1f".format(it.second)}" }
        assertTrue("Intermediate glide widths: $trace",widths.any { it.second>61 && it.second<215 })
        assertTrue("Monotonic glide: $trace",widths.zipWithNext().all { (a,b)->b.second<=a.second+.5 })
        assertEquals("Settles at 20% of the 300dp track: $trace",60.0,widths.last().second,.5)
        val settled=widths.first { abs(it.second-60.0)<.5 }.first
        assertTrue("Settles within the source 300 ms plus capture latency (at $settled ms): $trace",settled<800)
        for(patch in listOf(JSONObject().put("value","7"),JSONObject().put("showValue",1),JSONObject().put("variant","ring"),JSONObject().put("density",-5),JSONObject().put("unknown",1),JSONObject().put("formatOptions","x"))) {
            val invalid=request("POST","/command",token,JSONObject().put("command","update").put("properties",patch))
            assertTrue("Invalid Meter patch $patch rejected",invalid.first>=400 || invalid.second.has("error"))
        }
    }

    @Test fun meterFormatOptionsNullRestoresThePercentage() = withHost { _,command ->
        val base=JSONObject().put("value",30).put("min",0).put("max",80).put("locale","en-US").put("showLabel",false).put("showValue",true)
        command(JSONObject().put("command","configure").put("tag","md-meter").put("width",640).put("properties",base))
        Thread.sleep(500);val percent=command(JSONObject().put("command","frame"))
        val box=bounds(percent,"component.value")
        assertTrue(command(JSONObject().put("command","update").put("properties",JSONObject().put("formatOptions",JSONObject()))).getBoolean("ack"))
        Thread.sleep(500);val raw=command(JSONObject().put("command","frame"))
        assertTrue("{} formats the raw number, not the percentage",regionMean(percent,raw,box)>1.0)
        assertTrue(command(JSONObject().put("command","update").put("properties",JSONObject().put("formatOptions",JSONObject.NULL))).getBoolean("ack"))
        Thread.sleep(500);val restored=command(JSONObject().put("command","frame"))
        assertEquals("null (Studio Unset) restores the localized percentage",0.0,regionMean(percent,restored,bounds(restored,"component.value")),.5)
        assertTrue(command(JSONObject().put("command","update").put("properties",JSONObject().put("value",1).put("min",-5).put("max",5).put("label","Disk").put("showLabel",true)
            .put("showValue",true).put("valueText","one").put("locale","ro-RO").put("formatOptions",JSONObject().put("style","percent")).put("color","tertiary")
            .put("variant","circular").put("size",64).put("thickness",6).put("density",-4))).getBoolean("ack"))
    }

    @Test fun statusDotColourTransitionsAcrossARetainedUpdate() = withHost { token,command ->
        // One configure per host session: the settled post-update colour is the busy reference.
        command(JSONObject().put("command","configure").put("tag","md-status-dot").put("width",640)
            .put("properties",JSONObject().put("state","online").put("size","large")))
        Thread.sleep(500)
        val frame=command(JSONObject().put("command","frame"));val box=bounds(frame)
        val cx=box.getDouble("x")+box.getDouble("width")/2;val cy=box.getDouble("y")+box.getDouble("height")/2
        val online=colour(frame,cx,cy)
        // As for the meter glide (gate-7 R1-15): the frames are sampled while the update is being answered; an attempt that
        // still saw no intermediate colour is inconclusive and is repeated, at most twice.
        var samples=mutableListOf<Pair<Long,IntArray>>();var busy=online
        for(attempt in 1..3) {
            val start=System.currentTimeMillis();samples=mutableListOf()
            val update=java.util.concurrent.CompletableFuture.supplyAsync { command(JSONObject().put("command","update").put("properties",JSONObject().put("state","busy"))) }
            while(System.currentTimeMillis()-start<700) { samples+=(System.currentTimeMillis()-start) to colour(command(JSONObject().put("command","frame")),cx,cy);Thread.sleep(10) }
            assertTrue(update.get(5,java.util.concurrent.TimeUnit.SECONDS).getBoolean("ack"))
            Thread.sleep(400);busy=colour(command(JSONObject().put("command","frame")),cx,cy)
            if(samples.any { dist(it.second,online)>12 && dist(it.second,busy)>12 } || attempt==3) break
            command(JSONObject().put("command","update").put("properties",JSONObject().put("state","online")));Thread.sleep(700)
        }
        val trace=samples.joinToString(" ") { "${it.first}:${it.second.toList()}" }
        assertTrue("online/busy differ: ${online.toList()} ${busy.toList()}",dist(online,busy)>60)
        assertTrue("Intermediate colours: $trace",samples.any { dist(it.second,online)>12 && dist(it.second,busy)>12 })
        assertTrue("Settled within the sampled 700 ms: $trace",dist(samples.last().second,busy)<=3)
        assertTrue(command(JSONObject().put("command","update").put("properties",JSONObject().put("state","online").put("size","small").put("inline",true)
            .put("shape","circle").put("live",true).put("label","Away soon").put("density",-2))).getBoolean("ack"))
        for(patch in listOf(JSONObject().put("state","idle"),JSONObject().put("size",12),JSONObject().put("inline","yes"),JSONObject().put("shape","square"))) {
            val invalid=request("POST","/command",token,JSONObject().put("command","update").put("properties",patch))
            assertTrue("Invalid Status Dot patch $patch rejected",invalid.first>=400 || invalid.second.has("error"))
        }
    }

    @Test fun loadingKeepsAnimatingAcrossARetainedUpdate() = withHost { token,command ->
        command(JSONObject().put("command","configure").put("tag","md-loading-indicator").put("width",640)
            .put("properties",JSONObject().put("label","Busy")))
        Thread.sleep(400)
        val box0=bounds(command(JSONObject().put("command","frame")))
        val ack=command(JSONObject().put("command","update").put("properties",JSONObject().put("label","Still busy")))
        assertTrue(ack.getBoolean("ack"));assertEquals(0,ack.getJSONArray("events").length())
        val first=command(JSONObject().put("command","frame"));Thread.sleep(200);val second=command(JSONObject().put("command","frame"))
        assertTrue("The same root keeps morphing after a retained update",regionMean(first,second,bounds(second))>0.2)
        for(k in listOf("x","y","width","height")) assertEquals(k,box0.getDouble(k),bounds(second).getDouble(k),.05)
        assertTrue(command(JSONObject().put("command","update").put("properties",JSONObject().put("variant","contained").put("density",-1))).getBoolean("ack"))
        Thread.sleep(100)
        assertEquals(44.0,bounds(command(JSONObject().put("command","frame"))).getDouble("width"),.5)
        for(patch in listOf(JSONObject().put("variant","boxed"),JSONObject().put("label",3),JSONObject().put("density",1))) {
            val invalid=request("POST","/command",token,JSONObject().put("command","update").put("properties",patch))
            assertTrue("Invalid Loading patch $patch rejected",invalid.first>=400 || invalid.second.has("error"))
        }
    }

    @Test fun badgeContentAndVariantAreRetainedUpdates() = withHost { token,command ->
        command(JSONObject().put("command","configure").put("tag","md-badge").put("width",640).put("properties",JSONObject().put("value","3")))
        Thread.sleep(300)
        val w1=bounds(command(JSONObject().put("command","frame"))).getDouble("width")
        assertTrue(command(JSONObject().put("command","update").put("properties",JSONObject().put("value","1234"))).getBoolean("ack"))
        val w2=bounds(command(JSONObject().put("command","frame"))).getDouble("width")
        assertTrue("A longer value widens the same badge ($w1 → $w2)",w2>w1)
        assertTrue(command(JSONObject().put("command","update").put("properties",JSONObject().put("variant","small"))).getBoolean("ack"))
        val small=bounds(command(JSONObject().put("command","frame")))
        assertTrue("Small variant is the square dot: $small",small.getDouble("width")<w1 && abs(small.getDouble("width")-small.getDouble("height"))<.05)
        assertTrue(command(JSONObject().put("command","update").put("properties",JSONObject().put("variant","large").put("value","").put("max",9)
            .put("icon","error").put("shape","circle").put("density",-3))).getBoolean("ack"))
        for(patch in listOf(JSONObject().put("variant","medium"),JSONObject().put("max","9"),JSONObject().put("shape","square"),JSONObject().put("value",9))) {
            val invalid=request("POST","/command",token,JSONObject().put("command","update").put("properties",patch))
            assertTrue("Invalid Badge patch $patch rejected",invalid.first>=400 || invalid.second.has("error"))
        }
    }

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
