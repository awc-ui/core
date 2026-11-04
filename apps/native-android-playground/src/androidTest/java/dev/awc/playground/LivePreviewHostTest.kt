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

/** Exercises real GPU window pixels and local input, without global input or semantics shortcuts. */
class LivePreviewHostTest {
    @Test fun statusDotCapturesAnchorsInlineTypedStylesZeroAndHiddenWithoutParentFallback() {
        fun root(frame:JSONObject):JSONObject {
            val nodes=frame.getJSONObject("inspection").getJSONArray("nodes")
            val result=(0 until nodes.length()).map { nodes.getJSONObject(it) }.single { it.getString("id")=="component" }
            assertEquals("md-status-dot",result.getString("name"))
            return result.getJSONObject("bounds")
        }
        fun configure(properties:JSONObject=JSONObject(),styles:JSONObject=JSONObject(),rtl:Boolean=false):JSONObject =
            JSONObject().put("command","configure").put("tag","md-status-dot").put("width",640)
                .put("direction",if(rtl) "rtl" else "ltr").put("properties",properties)
                .put("statusDotAppearance",styles)
        withHost { _,command->
            val frame=command(configure(JSONObject().put("state","online")))
            val bounds=root(frame)
            assertEquals(12.0,bounds.getDouble("width"),.01)
            assertEquals(334.0,bounds.getDouble("x"),.01);assertEquals(70.0,bounds.getDouble("y"),.01)
        }
        withHost { _,command->
            val frame=command(configure(JSONObject().put("shape","circle"),rtl=true))
            val bounds=root(frame)
            assertEquals(297.029456,bounds.getDouble("x"),.3)
            assertEquals(66.970544,bounds.getDouble("y"),.3)
        }
        withHost { _,command->
            val bounds=root(command(configure(JSONObject().put("dir","ltr"),rtl=true)))
            assertEquals("Local direction overrides inherited RTL",334.0,bounds.getDouble("x"),.01)
        }
        withHost { _,command->
            val frame=command(configure(JSONObject().put("inline",true).put("label","Available"),
                JSONObject().put("color","#12345680")))
            val bounds=root(frame)
            assertEquals(344.0,bounds.getDouble("x"),.01);assertEquals(50.0,bounds.getDouble("y"),.01)
            val bitmap=decode(frame)
            val center=bitmap.getPixel(((bounds.getDouble("x")+6)*2).toInt(),((bounds.getDouble("y")+6)*2).toInt())
            assertEquals(136.0,android.graphics.Color.red(center).toDouble(),3.0)
            assertEquals(153.0,android.graphics.Color.green(center).toDouble(),3.0)
            assertEquals(170.0,android.graphics.Color.blue(center).toDouble(),3.0)
            bitmap.recycle()
        }
        withHost { _,command->
            val request=configure(styles=JSONObject().put("size",20).put("color","#345678")
                .put("outlineWidth",3).put("insetEnd",JSONObject().put("points",3).put("fraction",.25))
                .put("insetBlockEnd",JSONObject().put("points",-2).put("fraction",.5)).put("pulseDuration",0))
                .put("statusDotAppearanceDefaults",JSONObject().put("size",16).put("color","#123456")
                    .put("pulseColor","#ABCDEF80").put("outlineColor","#FEDCBA"))
            val bounds=root(command(request))
            assertEquals(20.0,bounds.getDouble("width"),.01)
            assertEquals(309.0,bounds.getDouble("x"),.01);assertEquals(38.0,bounds.getDouble("y"),.01)
        }
        withHost { _,command->
            val bounds=root(command(configure(styles=JSONObject().put("size",0))))
            assertEquals(0.0,bounds.getDouble("width"),.0);assertEquals(0.0,bounds.getDouble("height"),.0)
            assertEquals(346.0,bounds.getDouble("x"),.01);assertEquals(82.0,bounds.getDouble("y"),.01)
        }
        withHost { _,command->
            val frame=command(configure(JSONObject().put("hidden",true)))
            assertTrue("Hidden dot must never substitute the notification parent",
                frame.optJSONObject("inspection")?.optJSONArray("nodes")?.length()?.let { it==0 } ?: true)
        }
    }

    @Test fun badgeUsesTheReal48dpNotificationParentAndNestedTypedAppearanceInCapturedPixels() {
        fun root(frame:JSONObject):JSONObject {
            val nodes=frame.getJSONObject("inspection").getJSONArray("nodes")
            val roots=(0 until nodes.length()).map { nodes.getJSONObject(it) }.filter { it.getString("id")=="component" }
            assertEquals("The notification parent must not replace the inspected Badge",1,roots.size)
            assertEquals("md-badge",roots.single().getString("name"))
            return roots.single()
        }
        withHost { _,command->
            val frame=command(JSONObject().put("command","configure").put("tag","md-badge").put("width",640)
                .put("properties",JSONObject().put("variant","large").put("value","8")))
            val bounds=root(frame).getJSONObject("bounds")
            assertEquals(112.0,frame.getDouble("logicalHeight"),.5)
            assertEquals(16.0,bounds.getDouble("width"),.5);assertEquals(16.0,bounds.getDouble("height"),.5)
            assertEquals(336.0,bounds.getDouble("x"),.5);assertEquals(24.0,bounds.getDouble("y"),.5)
        }
        withHost { _,command->
            val frame=command(JSONObject().put("command","configure").put("tag","md-badge").put("width",640)
                .put("properties",JSONObject().put("variant","large").put("value","8").put("icon","add"))
                .put("slots",JSONObject().put("icon",JSONObject().put("kind","symbol").put("value","favorite")))
                .put("badgeAppearanceDefaults",JSONObject().put("containerColor","#112233").put("labelColor","#FEDCBA")
                    .put("iconColor","#00FF00").put("largeHeight",24).put("iconSize",12).put("cornerRadius",0).put("smallSize",8))
                .put("badgeAppearance",JSONObject().put("containerColor","#345678")
                    .put("largePadding",JSONArray(listOf(2,3,4,5)))
                    .put("offsetX",JSONObject().put("points",3).put("fraction",.25))
                    .put("offsetY",JSONObject().put("points",5).put("fraction",-.5))))
            val node=root(frame);val bounds=node.getJSONObject("bounds")
            assertEquals(24.0,bounds.getDouble("height"),.5)
            assertEquals(347.0-.75*bounds.getDouble("width"),bounds.getDouble("x"),.5)
            assertEquals(37.0-.5*bounds.getDouble("height"),bounds.getDouble("y"),.5)
            val padding=node.getJSONObject("metrics").getJSONArray("padding")
            listOf(2.0,3.0,4.0,5.0).forEachIndexed { i,value->assertEquals(value,padding.getDouble(i),.01) }
            val nodes=frame.getJSONObject("inspection").getJSONArray("nodes")
            val icon=(0 until nodes.length()).map { nodes.getJSONObject(it) }.single { it.getString("id")=="component.slot-icon" }
            assertEquals(12.0,icon.getJSONObject("bounds").getDouble("width"),.5)
            val bitmap=decode(frame)
            fun containsColor(color:Int):Boolean=(0 until bitmap.height).any { y->(0 until bitmap.width).any { x->bitmap.getPixel(x,y)==color } }
            assertTrue("Local Badge container overrides its global default",containsColor(android.graphics.Color.rgb(52,86,120)))
            assertTrue("Authored icon inherits the native icon color",containsColor(android.graphics.Color.GREEN))
            bitmap.recycle()
        }
    }

    @Test fun dialogOverlayIsInTheStreamAndReceivesLocalPointerInput() = withHost { _, command ->
        // The dialog presents in the preview's own viewport (AWCModalScope): the canvas is the configured viewport.
        val initial = command(JSONObject().put("command", "configure").put("tag", "md-dialog").put("width", 640).put("height", 480)
            .put("slots", JSONObject().put("", "Live overlay 👋 <b>literal</b>"))
            .put("properties", JSONObject().put("open", false).put("headline", "Captured dialog").put("scrimDismissible", true)))
        assertEquals(480.0, initial.getDouble("logicalHeight"), .01)
        val opened = command(JSONObject().put("command", "update").put("properties", JSONObject().put("open", true))).getJSONArray("events")
        assertTrue((0 until opened.length()).any { opened.getJSONObject(it).getString("name") == "mdOpen" })
        Thread.sleep(450)
        val bitmap = decode(command(JSONObject().put("command", "frame")))
        assertNotEquals("The dialog surface must appear over the in-viewport scrim", bitmap.getPixel(8, 8), bitmap.getPixel(bitmap.width / 2, bitmap.height / 2))
        bitmap.recycle()
        val dismissed = command(JSONObject().put("command", "click").put("x", 4).put("y", 4)).getJSONArray("events")
        assertTrue((0 until dismissed.length()).any { dismissed.getJSONObject(it).getString("name") == "mdClose" })
        Thread.sleep(450)
        val nodes = command(JSONObject().put("command", "frame")).optJSONObject("inspection")?.optJSONArray("nodes")
        assertTrue("Local pointer dismissal must remove the overlay", (0 until (nodes?.length() ?: 0)).none { nodes!!.getJSONObject(it).optString("name") == "container" })
    }

    @Test fun authenticatedRetinaPixelsHeldPointerKeyboardAndDisplayDisposal() {
        val context = ApplicationProvider.getApplicationContext<android.content.Context>()
        val displays = context.getSystemService(DisplayManager::class.java)
        val original = displays.displays.map { it.displayId }.toSet()
        withHost { token, command ->
            assertEquals(401, request("GET", "/health", "wrong-token").first)
            val configured = command(JSONObject().put("command", "configure").put("tag", "md-button")
                .put("width", 1024).put("dark", false).put("text", "Continue")
                .put("properties", JSONObject().put("toggle", true).put("ripple", false)))
            val bitmap = decode(configured)
            assertEquals("Render two physical pixels per logical unit", 2048, bitmap.width)
            assertEquals(bitmap.width, configured.getInt("width"))
            assertEquals(bitmap.height, configured.getInt("height"))
            assertEquals(1024.0, configured.getDouble("logicalWidth"), 0.01)
            assertTrue(configured.getDouble("logicalHeight") >= 100)
            assertTrue(bitmap.width.toLong() * bitmap.height <= LivePreviewSurface.MAX_PIXELS)
            val diagnostics = configured.getJSONObject("diagnostics")
            assertEquals(2.0, diagnostics.getDouble("captureScale"), 0.0)
            assertTrue(diagnostics.getLong("captureSequence") > 0)
            assertTrue(diagnostics.getDouble("captureMs") >= 0)
            assertTrue(diagnostics.getDouble("encodeMs") >= 0)
            val inspection = configured.getJSONObject("inspection")
            assertEquals(1, inspection.getInt("version"))
            assertEquals("dp", inspection.getString("unit"))
            assertEquals("Compose layout", inspection.getString("source"))
            assertTrue("Native parts accompany the component root", inspection.getJSONArray("nodes").length() >= 4)
            val measured = inspection.getJSONArray("nodes").getJSONObject(0)
            assertEquals("component", measured.getString("id"))
            assertEquals("md-button", measured.getString("name"))
            val bounds = measured.getJSONObject("bounds")
            assertTrue("Measure the button, not the full padded preview", bounds.getDouble("width") in 1.0..960.0)
            assertTrue("The component root starts inside the 32dp preview padding", bounds.getDouble("y") >= 32.0)
            assertEquals(configured.getDouble("logicalWidth") / 2, bounds.getDouble("x") + bounds.getDouble("width") / 2, 0.5)
            assertEquals(configured.getDouble("logicalHeight") / 2, bounds.getDouble("y") + bounds.getDouble("height") / 2, 0.5)
            // Correlate the reported layout with this exact PNG: the filled button's
            // center-row edges must match its measured horizontal bounds at 2× scale.
            val middleRow = ((bounds.getDouble("y") + bounds.getDouble("height") / 2) * 2).toInt()
            val background = bitmap.getPixel(0, middleRow)
            // Sample the flat container just inside its straight middle edge.
            // The unselected toggle fill is deliberately low contrast, so a
            // contrast threshold would confuse its text with its real bounds.
            val containerPixel=bitmap.getPixel((bounds.getDouble("x")*2+8).toInt(),middleRow)
            assertNotEquals("The container sample must be actual button paint",background,containerPixel)
            val drawnColumns=(0 until bitmap.width).filter { bitmap.getPixel(it,middleRow)==containerPixel }
            assertTrue("The measured root must contain rendered pixels", drawnColumns.isNotEmpty())
            assertEquals(bounds.getDouble("x") * 2, drawnColumns.first().toDouble(), 2.0)
            assertEquals((bounds.getDouble("x") + bounds.getDouble("width")) * 2 - 1, drawnColumns.last().toDouble(), 2.0)
            // A 1×1 display sink must not collapse PixelCopy's full-resolution
            // window source. Check the actual button, glyph and antialiased edges.
            val cy = bitmap.height / 2
            val cx = bitmap.width / 2
            val colors = mutableSetOf<Int>()
            val fill = bitmap.getPixel(cx, cy - 30)
            var glyphPixels = 0
            var solidButtonPixels = 0
            for (y in cy - 25 until cy + 25) for (x in cx - 60 until cx + 60) {
                val color = bitmap.getPixel(x, y)
                colors += color
                val contrast = maxOf(kotlin.math.abs(android.graphics.Color.red(color) - android.graphics.Color.red(fill)),
                    kotlin.math.abs(android.graphics.Color.green(color) - android.graphics.Color.green(fill)),
                    kotlin.math.abs(android.graphics.Color.blue(color) - android.graphics.Color.blue(fill)))
                if (contrast > 60) glyphPixels++ else solidButtonPixels++
            }
            assertTrue("Native glyphs must occupy distinct physical pixels", glyphPixels > 100)
            assertTrue("The button must have visible native container pixels", solidButtonPixels > 1000)
            assertTrue("Native text rasterization must retain antialiased shades", colors.size > 20)
            bitmap.recycle()
            assertEquals(1, displays.displays.count { it.displayId !in original && it.name == "AWC native preview" })
            val x = configured.getDouble("logicalWidth") / 2
            val y = configured.getDouble("logicalHeight") / 2
            fun pointer(phase: String) = command(JSONObject().put("command", "pointer").put("phase", phase).put("x", x).put("y", y))
            assertEquals(0, pointer("down").getJSONArray("events").length())
            val activated = pointer("up").getJSONArray("events")
            val names = (0 until activated.length()).map { activated.getJSONObject(it).getString("name") }
            assertEquals(listOf("mdClick", "mdChange"), names)
            assertTrue(activated.getJSONObject(1).getJSONObject("detail").getBoolean("selected"))
            assertTrue(activated.getJSONObject(0).getString("id").isNotEmpty())
            assertEquals("pointer", activated.getJSONObject(0).getJSONObject("activation").getString("source"))
            assertFalse(activated.getJSONObject(0).getBoolean("defaultPrevented"))
            assertTrue(activated.getJSONObject(0).getJSONArray("propagationPath").length() >= 2)
            pointer("down")
            assertEquals(0, pointer("cancel").getJSONArray("events").length())
            assertEquals(0, pointer("up").getJSONArray("events").length())
            // Focus is owned by the Presentation, not Activity.currentFocus.
            command(JSONObject().put("command", "key").put("key", "Tab"))
            val keyboard = command(JSONObject().put("command", "key").put("key", "Enter")).getJSONArray("events")
            assertEquals(listOf("mdClick", "mdChange"), (0 until keyboard.length()).map { keyboard.getJSONObject(it).getString("name") })
            assertFalse(keyboard.getJSONObject(1).getJSONObject("detail").getBoolean("selected"))
            assertEquals("keyboard", keyboard.getJSONObject(0).getJSONObject("activation").getString("source"))
            assertEquals(0, command(JSONObject().put("command", "frame")).getJSONArray("events").length())
        }
        val deadline = System.currentTimeMillis() + 3000
        while (displays.displays.any { it.displayId !in original && it.name == "AWC native preview" } && System.currentTimeMillis() < deadline) Thread.sleep(25)
        assertFalse("Closing the host must release its private display", displays.displays.any { it.displayId !in original && it.name == "AWC native preview" })
    }

    @Test fun fullWidthUsesTheSame32UnitPreviewInsetsAsWeb() = withHost { _, command ->
        val frame=command(JSONObject().put("command","configure").put("tag","md-button").put("width",1024)
            .put("text","Continue").put("properties",JSONObject().put("fullWidth",true)))
        val bounds=frame.getJSONObject("inspection").getJSONArray("nodes").getJSONObject(0).getJSONObject("bounds")
        assertEquals(32.0,bounds.getDouble("x"),.5)
        assertEquals(32.0,bounds.getDouble("y"),.5)
        assertEquals(960.0,bounds.getDouble("width"),.5)
        assertEquals(1024.0,frame.getDouble("logicalWidth"),.01)
    }

    @Test fun iconButtonHostUsesTypedAppearanceSlotsAndRealPointerEvents() = withHost { _, command ->
        val frame=command(JSONObject().put("command","configure").put("tag","md-icon-button").put("width",640)
            .put("properties",JSONObject().put("toggle",true).put("aria-label","Save to favorites"))
            .put("iconButtonAppearanceDefaults",JSONObject().put("height",60))
            .put("iconButtonAppearance",JSONObject().put("width",80).put("iconSize",30))
            .put("slots",JSONObject().put("",JSONObject().put("kind","symbol").put("value","favorite"))
                .put("selected",JSONObject().put("kind","symbol").put("value","check"))))
        val nodes=frame.getJSONObject("inspection").getJSONArray("nodes")
        val root=(0 until nodes.length()).map { nodes.getJSONObject(it) }.single { it.getString("id")=="component" }.getJSONObject("bounds")
        assertEquals(80.0,root.getDouble("width"),.5);assertEquals(60.0,root.getDouble("height"),.5)
        val x=root.getDouble("x")+40;val y=root.getDouble("y")+30
        val down=command(JSONObject().put("command","pointer").put("phase","down").put("x",x).put("y",y))
        assertEquals(0,down.getJSONArray("events").length())
        val up=command(JSONObject().put("command","pointer").put("phase","up").put("x",x).put("y",y))
        val events=up.getJSONArray("events")
        assertEquals(1,events.length());assertEquals("mdClick",events.getJSONObject(0).getString("name"))
        assertTrue(events.getJSONObject(0).getJSONObject("detail").getBoolean("selected"))
        assertEquals("pointer",events.getJSONObject(0).getJSONObject("activation").getString("source"))
        assertEquals(40.0,events.getJSONObject(0).getJSONObject("activation").getDouble("x"),.5)
        assertEquals(0,command(JSONObject().put("command","frame")).getJSONArray("events").length())
    }

    @Test fun streamedDrawsAdvanceSequenceWhileIdleHeartbeatsReuseIt() = withHost { token, command ->
        val configured = command(JSONObject().put("command", "configure").put("tag", "md-button")
            .put("width", 1200).put("properties", JSONObject().put("ripple", false)))
        assertEquals(2400, configured.getInt("width"))
        val connection = connection("GET", "/stream", token)
        try {
            assertEquals(200, connection.responseCode)
            val reader = connection.inputStream.bufferedReader()
            fun nextFrame(): JSONObject = JSONObject(checkNotNull(reader.readLine()) { "Native stream closed" }).also { assertEquals("frame", it.getString("kind")) }
            var first = nextFrame()
            var second = nextFrame()
            val deadline = System.currentTimeMillis() + 5000
            while (first.getJSONObject("diagnostics").getLong("captureSequence") != second.getJSONObject("diagnostics").getLong("captureSequence") && System.currentTimeMillis() < deadline) { first = second; second = nextFrame() }
            assertEquals("Idle stream must reuse its last capture", first.getJSONObject("diagnostics").getLong("captureSequence"), second.getJSONObject("diagnostics").getLong("captureSequence"))
            assertEquals(first.getJSONObject("diagnostics").getDouble("capturedAtMs"), second.getJSONObject("diagnostics").getDouble("capturedAtMs"), 0.0)
            val idleSequence = second.getJSONObject("diagnostics").getLong("captureSequence")
            val down = command(JSONObject().put("command", "pointer").put("phase", "down").put("x", 600).put("y", configured.getDouble("logicalHeight") / 2))
            assertTrue(down.getBoolean("ack"))
            assertFalse("Streaming input should ACK without waiting for a PNG", down.has("png"))
            val pressed = nextFrame()
            assertTrue("A real native redraw must produce a fresh capture", pressed.getJSONObject("diagnostics").getLong("captureSequence") > idleSequence)
            var visible = pressed.getString("png") != second.getString("png")
            repeat(8) { if (!visible) visible = nextFrame().getString("png") != second.getString("png") }
            assertTrue("A held pointer must visibly animate native pixels", visible)
            command(JSONObject().put("command", "pointer").put("phase", "up").put("x", 600).put("y", configured.getDouble("logicalHeight") / 2))
            command(JSONObject().put("command", "stream").put("enabled", false))
        } finally { connection.disconnect() }
    }

    @Test fun browserAbortImmediatelyResubscribesAndRecoversNativeAnimation() = withHost { token, command ->
        val configured = command(JSONObject().put("command", "configure").put("tag", "md-button")
            .put("width", 1024).put("properties", JSONObject().put("ripple", true)))
        val y = configured.getDouble("logicalHeight") / 2
        var previousSequence = configured.getJSONObject("diagnostics").getLong("captureSequence")
        repeat(4) {
            val connection = connection("GET", "/stream", token)
            try {
                assertEquals("Immediate resubscribe must replace the token's old writer", 200, connection.responseCode)
                val reader = connection.inputStream.bufferedReader()
                val first = JSONObject(checkNotNull(reader.readLine()))
                assertFalse(first.toString(), first.has("error"))
                assertTrue("Each new subscriber must receive a fresh capture", first.getJSONObject("diagnostics").getLong("captureSequence") > previousSequence)
                previousSequence = first.getJSONObject("diagnostics").getLong("captureSequence")
                command(JSONObject().put("command", "pointer").put("phase", "down").put("x", 512).put("y", y))
                val drawn = JSONObject(checkNotNull(reader.readLine()))
                assertTrue(drawn.getJSONObject("diagnostics").getLong("captureSequence") > previousSequence)
                previousSequence = drawn.getJSONObject("diagnostics").getLong("captureSequence")
                command(JSONObject().put("command", "pointer").put("phase", "up").put("x", 512).put("y", y))
                // Match browser AbortController: close only the HTTP connection,
                // without a stream:false command or an idle-heartbeat delay.
            } finally { connection.disconnect() }
        }
        command(JSONObject().put("command", "stream").put("enabled", false))
    }

    @Test fun buttonGroupHostCapturesOrderedSelectionAndTypedSizing() = withHost { _,command ->
        val initial=command(JSONObject().put("command","configure").put("tag","md-button-group").put("width",1024)
            .put("buttonGroupSelection",JSONArray(listOf(false,true,false)))
            .put("buttonGroupAppearance",JSONObject().put("gap",10).put("height",64))
            .put("properties",JSONObject().put("fullWidth",true)))
        assertEquals("[false,true,false]",initial.getJSONArray("buttonGroupSelection").toString())
        val root=initial.getJSONObject("inspection").getJSONArray("nodes").getJSONObject(0).getJSONObject("bounds")
        assertEquals(960.0,root.getDouble("width"),.5);assertEquals(64.0,root.getDouble("height"),.5)
        val clicked=command(JSONObject().put("command","click").put("x",200).put("y",root.getDouble("y")+32))
        var measured=clicked
        repeat(10) { if(!measured.has("buttonGroupSelection")) measured=command(JSONObject().put("command","frame")) }
        assertEquals("[true,false,false]",measured.getJSONArray("buttonGroupSelection").toString())
        val events=clicked.getJSONArray("events")
        assertEquals("mdSelectionChange",events.getJSONObject(events.length()-1).getString("name"))
        assertEquals("[\"day\"]",events.getJSONObject(events.length()-1).getJSONObject("detail").getJSONArray("values").toString())
    }

    @Test fun fabHostMeasuresTypedAppearanceAndAcknowledgesAppliedMenuIconWhileDisabled() = withHost { _,command ->
        val initial=command(JSONObject().put("command","configure").put("tag","md-fab").put("width",640)
            .put("fabAppearance",JSONObject().put("iconSize",32).put("cornerRadius",0).put("iconColor","#00FF00"))
            .put("slots",JSONObject().put("icon",JSONObject().put("kind","symbol").put("value","favorite")))
            .put("properties",JSONObject().put("icon","add").put("label","Create").put("disabled",true)))
        val nodes=initial.getJSONObject("inspection").getJSONArray("nodes")
        val icon=(0 until nodes.length()).map { nodes.getJSONObject(it) }.first { it.getString("id")=="component.icon" }
        assertEquals(32.0,icon.getJSONObject("bounds").getDouble("width"),.5)
        val changed=command(JSONObject().put("command","method").put("method","setMenuIcon").put("arguments",JSONArray().put("close")))
        assertTrue("A frame alone is not an acknowledgement",changed.getBoolean("ack"))
        var changedFrame=changed
        repeat(10) { if(changedFrame.getString("png")==initial.getString("png")) changedFrame=command(JSONObject().put("command","frame")) }
        assertNotEquals(initial.getString("png"),changedFrame.getString("png"))
        val restored=command(JSONObject().put("command","method").put("method","setMenuIcon").put("arguments",JSONArray().put(JSONObject.NULL)))
        assertTrue(restored.getBoolean("ack"))
        val root=nodes.getJSONObject(0).getJSONObject("bounds")
        val click=command(JSONObject().put("command","click").put("x",root.getDouble("x")+root.getDouble("width")/2).put("y",root.getDouble("y")+28))
        assertEquals(0,click.getJSONArray("events").length())
    }

    @Test fun fabMenuMethodsStayIndependentOfStreamingAndCorrelateActualLifecycleAndItemEvents() = withHost { _,command->
        val events=mutableListOf<JSONObject>()
        fun send(value:JSONObject):JSONObject=command(value).also { reply->
            val batch=reply.optJSONArray("events") ?: JSONArray()
            for(i in 0 until batch.length()) events+=batch.getJSONObject(i)
        }
        fun method(id:String,name:String)=send(JSONObject().put("command","method").put("target","component")
            .put("callId",id).put("method",name).put("arguments",JSONArray())).getJSONObject("methodCall")
        fun query(vararg ids:String)=send(JSONObject().put("command","method-results").put("callIds",JSONArray(ids.toList()))
            .put("acknowledged",JSONArray())).getJSONArray("methodResults")
        fun terminal(id:String):JSONObject {
            var result=query(id).getJSONObject(0)
            val deadline=System.currentTimeMillis()+3000
            while(result.getString("status")=="pending" && System.currentTimeMillis()<deadline) {
                Thread.sleep(20);result=query(id).getJSONObject(0)
            }
            assertEquals(result.toString(),"fulfilled",result.getString("status"));return result
        }
        fun acknowledge(vararg ids:String) { send(JSONObject().put("command","method-results")
            .put("callIds",JSONArray()).put("acknowledged",JSONArray(ids.toList()))) }
        val initial=send(JSONObject().put("command","configure").put("tag","md-fab-menu").put("width",640)
            .put("properties",JSONObject().put("anchor","demo-fab-anchor").put("placement","down").put("open",false)))
        assertEquals(544.0,initial.getDouble("logicalHeight"),.51)
        assertTrue(events.isEmpty())
        assertFalse("A closed menu must not publish the fixture viewport as component geometry",initial.has("inspection"))
        send(JSONObject().put("command","stream").put("enabled",false))
        assertEquals("accepted",method("open","show").getString("status"));terminal("open")
        assertTrue(events.any { it.optString("name")=="mdOpen" && it.optString("tag")=="md-fab-menu" && it.optString("nodeID")=="component" })
        assertEquals("accepted",method("open","show").getString("status"))
        val mismatch=method("open","close")
        assertEquals("rejected",mismatch.getString("status"));assertEquals("METHOD_CALL_ID_MISMATCH",mismatch.getJSONObject("error").getString("code"))
        assertEquals("accepted",method("wait","whenClosed").getString("status"))
        assertEquals("pending",query("wait").getJSONObject(0).getString("status"))
        assertEquals("accepted",method("close","close").getString("status"));terminal("close")
        terminal("wait")
        assertTrue(events.any { it.optString("name")=="mdClose" && it.optString("nodeID")=="component" })
        val closedFrame=send(JSONObject().put("command","frame"))
        assertFalse("Closed menu nodes must be removed from captured inspection",closedFrame.has("inspection"))
        acknowledge("open","close","wait")
        assertEquals("UNKNOWN_METHOD_CALL",query("open").getJSONObject(0).getJSONObject("error").getString("code"))
        // Actual local native pointer capture opens without an anchor mdClick.
        events.clear()
        send(JSONObject().put("command","click").put("x",320).put("y",272))
        var opened=send(JSONObject().put("command","frame"))
        repeat(20) { if(!opened.has("inspection")) { Thread.sleep(20);opened=send(JSONObject().put("command","frame")) } }
        assertTrue(opened.toString(),opened.has("inspection"))
        val openNodes=opened.getJSONObject("inspection").getJSONArray("nodes")
        val overlay=(0 until openNodes.length()).map { openNodes.getJSONObject(it) }.single { it.getString("id")=="component" }
        assertEquals("md-fab-menu overlay",overlay.getString("name"))
        // Items are laid out at the anchor (centred FAB, placement down), in canvas coordinates, as menu parts.
        val first=(0 until openNodes.length()).map { openNodes.getJSONObject(it) }.single { it.getString("id")=="component.item-1" }.getJSONObject("bounds")
        assertTrue(first.toString(),first.getDouble("x")>100 && first.getDouble("y")>272)
        assertTrue(events.any { it.optString("name")=="mdOpen" })
        assertFalse(events.any { it.optString("tag")=="md-fab" })
        send(JSONObject().put("command","key").put("key","ArrowDown"))
        send(JSONObject().put("command","key").put("key","u"))
        send(JSONObject().put("command","key").put("key","Enter"))
        repeat(20) {
            if(events.none { it.optString("name")=="mdClick" && it.optString("tag")=="md-fab-menu-item" }) {
                Thread.sleep(20);send(JSONObject().put("command","frame"))
            }
        }
        assertTrue("Typeahead must activate the actual Upload item",events.any { it.optString("name")=="mdClick" && it.optString("nodeID")=="menu-item-image" })
        method("closed-after-item","whenClosed");terminal("closed-after-item");acknowledge("closed-after-item")
        method("limits-open","show");terminal("limits-open");acknowledge("limits-open")
        repeat(32) { assertEquals("accepted",method("pending-$it","whenClosed").getString("status")) }
        val busy=method("overflow","show")
        assertEquals("rejected",busy.getString("status"));assertEquals("METHOD_CALLS_BUSY",busy.getJSONObject("error").getString("code"))
        // Outside the authored 360×480 fixture, but within the native viewport.
        send(JSONObject().put("command","click").put("x",3).put("y",3))
        terminal("pending-0")
        assertEquals("fulfilled",query("pending-31").getJSONObject(0).getString("status"))
    }

    @Test fun segmentedContextUsesRealOrderedSelectionTypedSlotsAndCommittedFrameMeasurements() {
        withHost { _,command->
            fun context(mode:String,multi:Boolean,states:List<Boolean>)=JSONObject().put("mode",mode).put("multiselect",multi).put("density",-3).put("selection",JSONArray(states))
            var frame=command(JSONObject().put("command","configure").put("tag","md-segmented-button").put("width",640)
                .put("segmentedContext",context("set",false,listOf(true,false,false)))
                .put("properties",JSONObject().put("label","Day").put("value","duplicate"))
                .put("segmentedButtonAppearanceDefaults",JSONObject().put("outlineColor","#00FF00"))
                .put("segmentedButtonAppearance",JSONObject().put("iconSize",22).put("cornerRadius",6)))
            repeat(20) { if(!frame.has("inspection") || frame.optJSONArray("segmentedSelection")?.length()!=3) { Thread.sleep(25);frame=command(JSONObject().put("command","frame")) } }
            assertEquals("[true,false,false]",frame.getJSONArray("segmentedSelection").toString())
            val nodes=frame.getJSONObject("inspection").getJSONArray("nodes")
            val root=(0 until nodes.length()).map { nodes.getJSONObject(it) }.single { it.getString("id")=="component" }
            val bounds=root.getJSONObject("bounds")
            assertEquals("md-segmented-button",root.getString("name"));assertEquals(28.0,bounds.getDouble("height"),.5)
            assertEquals(8.0,root.getJSONObject("metrics").getJSONArray("padding").getDouble(1),.01)
            val clicked=command(JSONObject().put("command","click").put("x",bounds.getDouble("x")+bounds.getDouble("width")*1.5).put("y",bounds.getDouble("y")+14))
            val events=clicked.getJSONArray("events")
            assertEquals("The set stops child proposals before the canvas listener",1,events.length())
            val change=(0 until events.length()).map { events.getJSONObject(it) }.single { it.getString("name")=="mdChange" }
            assertEquals("md-segmented-button-set",change.getString("tag"));assertEquals("segmented-set",change.getString("nodeID"))
            assertEquals("[\"week\"]",change.getJSONArray("detail").toString());assertEquals("pointer",change.getJSONObject("activation").getString("source"))
            frame=clicked
            repeat(20) { if(frame.optJSONArray("segmentedSelection")?.toString()!="[false,true,false]") { Thread.sleep(25);frame=command(JSONObject().put("command","frame")) } }
            assertEquals("[false,true,false]",frame.getJSONArray("segmentedSelection").toString())
        }
        withHost { _,command->
            var frame=command(JSONObject().put("command","configure").put("tag","md-segmented-button").put("width",640)
                .put("segmentedContext",JSONObject().put("mode","standalone").put("multiselect",false).put("density",0).put("selection",JSONArray()))
                .put("properties",JSONObject().put("selected",false).put("label","Property wins").put("icon","add").put("value","solo"))
                .put("slots",JSONObject().put("","Masked retained content").put("icon",JSONObject().put("kind","symbol").put("value","favorite"))))
            repeat(20) { if(!frame.has("inspection")) { Thread.sleep(25);frame=command(JSONObject().put("command","frame")) } }
            val nodes=frame.getJSONObject("inspection").getJSONArray("nodes")
            val indexed=(0 until nodes.length()).map { nodes.getJSONObject(it) }.associateBy { it.getString("id") }
            assertTrue(indexed.containsKey("component.icon"));assertTrue(indexed.containsKey("component.icon-slot-0"));assertTrue(indexed.containsKey("component.label"))
            val root=indexed.getValue("component").getJSONObject("bounds")
            val clicked=command(JSONObject().put("command","click").put("x",root.getDouble("x")+root.getDouble("width")/2).put("y",root.getDouble("y")+root.getDouble("height")/2))
            val proposal=clicked.getJSONArray("events").getJSONObject(0)
            assertEquals("mdSegmentClick",proposal.getString("name"));assertTrue(proposal.getJSONObject("detail").getBoolean("selected"))
            Thread.sleep(50);frame=command(JSONObject().put("command","frame"))
            assertEquals(0,frame.getJSONArray("segmentedSelection").length())
            val updated=frame.getJSONObject("inspection").getJSONArray("nodes")
            assertFalse((0 until updated.length()).any { updated.getJSONObject(it).getString("id")=="component.checkmark" })
        }
    }

    @Test fun splitButtonCapturesIndependentNativeActionsAdditiveSlotsAndActualCheckedState() {
        withHost { _,command ->
            var frame=command(JSONObject().put("command","configure").put("tag","md-split-button").put("width",640)
                .put("properties",JSONObject().put("label","Publish").put("icon","upload").put("fullWidth",true).put("density",-2))
                .put("slots",JSONObject().put("","now"))
                .put("splitButtonAppearanceDefaults",JSONObject().put("outlineColor","#00FF00").put("iconSize",30))
                .put("splitButtonAppearance",JSONObject().put("containerColor","#123456").put("labelColor","#ABCDEF").put("cornerRadius",6)))
            repeat(20) { if(!frame.has("inspection") || !frame.has("splitButtonChecked")) {
                Thread.sleep(25);frame=command(JSONObject().put("command","frame"))
            } }
            assertFalse(frame.getBoolean("splitButtonChecked"))
            val nodes=frame.getJSONObject("inspection").getJSONArray("nodes")
            val indexed=(0 until nodes.length()).map { nodes.getJSONObject(it) }.associateBy { it.getString("id") }
            val root=indexed.getValue("component").getJSONObject("bounds")
            assertEquals(576.0,root.getDouble("width"),.01);assertEquals(32.0,root.getDouble("height"),.01)
            assertTrue("An authored default slot must not remove the label property",indexed.containsKey("component.label"))
            assertEquals(30.0,indexed.getValue("component.icon").getJSONObject("bounds").getDouble("width"),.01)
            val leading=indexed.getValue("component.leading").getJSONObject("bounds")
            val trailing=indexed.getValue("component.trailing").getJSONObject("bounds")
            val first=command(JSONObject().put("command","click").put("x",leading.getDouble("x")+leading.getDouble("width")/2).put("y",leading.getDouble("y")+16))
            val leadingEvent=first.getJSONArray("events").getJSONObject(0)
            assertEquals("mdLeadingClick",leadingEvent.getString("name"));assertTrue(leadingEvent.isNull("detail"))
            assertEquals("pointer",leadingEvent.getJSONObject("activation").getString("source"))
            val next=command(JSONObject().put("command","click").put("x",trailing.getDouble("x")+trailing.getDouble("width")/2).put("y",trailing.getDouble("y")+16))
            val trailingEvent=next.getJSONArray("events").getJSONObject(0)
            assertEquals("mdTrailingClick",trailingEvent.getString("name"));assertEquals("{\"checked\":true}",trailingEvent.getJSONObject("detail").toString())
            frame=next
            repeat(20) { if(!frame.optBoolean("splitButtonChecked")) { Thread.sleep(25);frame=command(JSONObject().put("command","frame")) } }
            assertTrue(frame.getBoolean("splitButtonChecked"))
            val keyed=command(JSONObject().put("command","key").put("key","Enter"))
            assertFalse(keyed.getJSONArray("events").getJSONObject(0).getJSONObject("detail").getBoolean("checked"))
            frame=keyed
            repeat(20) { if(!frame.has("splitButtonChecked") || frame.optBoolean("splitButtonChecked")) { Thread.sleep(25);frame=command(JSONObject().put("command","frame")) } }
            assertFalse(frame.getBoolean("splitButtonChecked"))
        }
    }

    @Test fun loadingHooksAndShortComponentsStayCenteredInTheirActualCapturedSurface() {
        fun root(frame:JSONObject):JSONObject {
            val nodes=frame.getJSONObject("inspection").getJSONArray("nodes")
            return (0 until nodes.length()).map { nodes.getJSONObject(it) }.single { it.getString("id")=="component" }.getJSONObject("bounds")
        }
        fun configure(tag:String,props:JSONObject,appearanceKey:String,appearance:JSONObject)=JSONObject()
            .put("command","configure").put("tag",tag).put("width",640).put("properties",props).put(appearanceKey,appearance)
        withHost { _,command->
            val request=configure("md-loading-indicator",JSONObject().put("variant","contained").put("label","Busy"),
                "loadingIndicatorAppearance",JSONObject().put("size",24).put("shapeSize",80).put("color","#00FF0080")
                    .put("containerShape",JSONObject().put("topLeft",JSONObject().put("x",JSONObject().put("points",0)))))
                .put("loadingIndicatorAppearanceDefaults",JSONObject().put("containerColor","#123456").put("size",48))
            var frame=command(request)
            repeat(10) { if(!frame.has("inspection")) frame=command(JSONObject().put("command","frame")) }
            val bounds=root(frame)
            assertEquals(100.0,frame.getDouble("logicalHeight"),.01)
            assertEquals(24.0,bounds.getDouble("width"),.01);assertEquals(24.0,bounds.getDouble("height"),.01)
            assertEquals(38.0,bounds.getDouble("y"),.01)
            val bitmap=decode(frame)
            // Square container corner is outside the centered polygon, proving
            // the captured paint shares the same minimum-height centering.
            assertEquals(android.graphics.Color.rgb(18,52,86),bitmap.getPixel((bounds.getDouble("x")*2+1).toInt(),77))
            assertNotEquals(android.graphics.Color.rgb(18,52,86),bitmap.getPixel((bounds.getDouble("x")*2+1).toInt(),65))
            bitmap.recycle()
        }
        withHost { _,command->
            val frame=command(configure("md-split-button",JSONObject().put("size","sm").put("density",-4),
                "splitButtonAppearance",JSONObject().put("containerColor","#123456").put("cornerRadius",0)))
            val bounds=root(frame);assertEquals(24.0,bounds.getDouble("height"),.01);assertEquals(38.0,bounds.getDouble("y"),.01)
            val bitmap=decode(frame);assertEquals(android.graphics.Color.rgb(18,52,86),bitmap.getPixel((bounds.getDouble("x")*2+2).toInt(),80));bitmap.recycle()
        }
        withHost { _,command->
            val request=configure("md-segmented-button",JSONObject().put("density",-4).put("label","Day"),
                "segmentedButtonAppearance",JSONObject()).put("segmentedContext",JSONObject().put("mode","standalone").put("multiselect",false).put("density",0).put("selection",JSONArray()))
            val bounds=root(command(request));assertEquals(24.0,bounds.getDouble("height"),.01);assertEquals(38.0,bounds.getDouble("y"),.01)
        }
        withHost { _,command->
            val request=configure("md-loading-indicator",JSONObject(),"loadingIndicatorAppearance",JSONObject().put("size",0))
            val bounds=root(command(request));assertEquals(0.0,bounds.getDouble("width"),.0);assertEquals(50.0,bounds.getDouble("y"),.01)
        }
        withHost { _,command->
            val hidden=command(configure("md-loading-indicator",JSONObject().put("hidden",true),"loadingIndicatorAppearance",JSONObject()))
            assertFalse("Hidden indicator cannot borrow recipe bounds",hidden.has("inspection"))
        }
    }

    @Test fun meterUsesActual300DpParentAndTypedStylesWithCustomAlphaRoles() {
        fun root(frame:JSONObject):JSONObject {
            val nodes=frame.getJSONObject("inspection").getJSONArray("nodes")
            return (0 until nodes.length()).map { nodes.getJSONObject(it) }.single { it.getString("id")=="component" }.getJSONObject("bounds")
        }
        withHost { _,command->
            val request=JSONObject().put("command","configure").put("tag","md-meter").put("width",640)
                .put("properties",JSONObject().put("value",25).put("color","Brand").put("showLabel",false).put("showValue",false))
                .put("themeTokens",JSONObject().put("--md-sys-color-Brand","#FF000080").put("--md-sys-color-Brand-container","#0000FF"))
                .put("meterAppearanceDefaults",JSONObject().put("height",4))
                .put("meterAppearance",JSONObject().put("height",10).put("trackShape",JSONObject()))
            val frame=command(request);val b=root(frame)
            assertEquals(300.0,b.getDouble("width"),.01);assertEquals(10.0,b.getDouble("height"),.01)
            assertEquals(170.0,b.getDouble("x"),.01);assertEquals(45.0,b.getDouble("y"),.01)
            val bitmap=decode(frame);val pixel=bitmap.getPixel(380,100)
            assertEquals(128.0,android.graphics.Color.red(pixel).toDouble(),2.0);assertEquals(0.0,android.graphics.Color.green(pixel).toDouble(),2.0);assertEquals(127.0,android.graphics.Color.blue(pixel).toDouble(),2.0);bitmap.recycle()
        }
        withHost { _,command->
            val frame=command(JSONObject().put("command","configure").put("tag","md-meter").put("width",640)
                .put("properties",JSONObject().put("variant","circular").put("showLabel",false).put("showValue",true))
                .put("meterAppearance",JSONObject().put("size",64)))
            val b=root(frame);assertEquals(64.0,b.getDouble("width"),.01);assertEquals(288.0,b.getDouble("x"),.01)
        }
        withHost { _,command->
            val frame=command(JSONObject().put("command","configure").put("tag","md-meter").put("width",640).put("properties",JSONObject().put("hidden",true)))
            assertFalse("Hidden meter cannot borrow recipe bounds",frame.has("inspection"))
        }
    }

    @Test fun progressHostRetainsMountedUpdatesAndAcknowledgesActualAppliedFrames() = withHost { token,command ->
        val configured=command(JSONObject().put("command","configure").put("tag","md-progress-indicator").put("width",640)
            .put("properties",JSONObject().put("variant","circular").put("wave",false).put("value",37).put("complete",true))
            .put("progressIndicatorAppearance",JSONObject().put("activeIndicatorColor","#12345680").put("trackActiveIndicatorSpace",-9)))
        fun node(frame:JSONObject,id:String):JSONObject?=frame.optJSONObject("inspection")?.optJSONArray("nodes")?.let { nodes ->
            (0 until nodes.length()).map { nodes.getJSONObject(it) }.find { it.getString("id")==id }
        }
        assertEquals(40.0,node(configured,"component")!!.getJSONObject("bounds").getDouble("width"),.01)
        Thread.sleep(150)
        assertEquals("Initial complete=true does not emit",0,command(JSONObject().put("command","frame")).getJSONArray("events").length())
        fun update(patch:JSONObject)=command(JSONObject().put("command","update").put("properties",patch)).also { assertTrue(it.getBoolean("ack")) }
        update(JSONObject().put("size",64).put("density",-4))
        val resized=command(JSONObject().put("command","frame"))
        assertEquals("ACK follows the applied retained layout",64.0,node(resized,"component")!!.getJSONObject("bounds").getDouble("width"),.01)
        assertEquals(0,resized.getJSONArray("events").length())
        for(patch in listOf(JSONObject().put("value","bad"),JSONObject().put("density",-5),JSONObject().put("unknown",1),JSONObject().put("value",JSONObject.NULL))) {
            val invalid=request("POST","/command",token,JSONObject().put("command","update").put("properties",patch))
            assertTrue("Invalid patch rejects without replacing session",invalid.first>=400 || invalid.second.has("error"))
        }
        update(JSONObject().put("complete",false))
        val events=mutableListOf<JSONObject>()
        fun collect(reply:JSONObject) { reply.optJSONArray("events")?.let { a->for(i in 0 until a.length()) events+=a.getJSONObject(i) } }
        collect(update(JSONObject().put("complete",true)))
        val deadline=System.currentTimeMillis()+4500
        while(events.isEmpty() && System.currentTimeMillis()<deadline) { Thread.sleep(40);collect(command(JSONObject().put("command","frame"))) }
        assertEquals("One actual completion after retained false→true",1,events.size)
        assertEquals("mdComplete",events.single().getString("name"));assertTrue(events.single().isNull("detail"))
        assertNotNull("Flat circular retains its actual track",node(command(JSONObject().put("command","frame")),"component.track"))
        update(JSONObject().put("complete",false));collect(update(JSONObject().put("complete",true)))
        Thread.sleep(100);collect(command(JSONObject().put("command","frame")));assertEquals("False does not reset terminal state",1,events.size)
    }

    @Test fun animatedProgressCapturesKeepChangingPartsWithTheirCommittedSurface() = withHost { _,command ->
        command(JSONObject().put("command","configure").put("tag","md-progress-indicator").put("width",640)
            .put("properties",JSONObject().put("variant","circular").put("wave",false).put("indeterminate",true).put("size",80))
            .put("progressIndicatorAppearance",JSONObject().put("activeIndicatorColor","#FF0000").put("trackColor","#0000FF")))
        val widths=mutableSetOf<Int>();val surfaces=mutableSetOf<Long>();var frames=0
        repeat(20) {
            val frame=command(JSONObject().put("command","frame"))
            val nodes=frame.getJSONObject("inspection").getJSONArray("nodes")
            fun part(id:String)=(0 until nodes.length()).map { nodes.getJSONObject(it) }.single { it.getString("id")==id }.getJSONObject("bounds")
            val root=part("component");val track=part("component.track");val active=part("component.active-indicator")
            assertEquals(80.0,root.getDouble("width"),.01)
            for(box in listOf(track,active)) {
                val width=box.getDouble("width");assertTrue("Actually rotated full-circle element box: $box",width in 75.99..107.49)
                assertEquals(width,box.getDouble("height"),.04)
                assertEquals(root.getDouble("x")+40,box.getDouble("x")+width/2,.04)
                assertEquals(root.getDouble("y")+40,box.getDouble("y")+width/2,.04)
            }
            widths+=(track.getDouble("width")*100).toInt();surfaces+=frame.getJSONObject("diagnostics").getLong("surfaceDrawSequence")
            val bitmap=decode(frame);var red=0;var blue=0
            for(y in (root.getDouble("y")*2).toInt() until ((root.getDouble("y")+80)*2).toInt())
                for(x in (root.getDouble("x")*2).toInt() until ((root.getDouble("x")+80)*2).toInt()) {
                    val color=bitmap.getPixel(x,y)
                    if(android.graphics.Color.red(color)>200 && android.graphics.Color.blue(color)<60) red++
                    if(android.graphics.Color.blue(color)>200 && android.graphics.Color.red(color)<60) blue++
                }
            bitmap.recycle();assertTrue("Both real animated arcs remain painted",red>4 && blue>4);frames++
            Thread.sleep(24)
        }
        assertEquals(20,frames);assertTrue("Animation must continue while capture stays coherent",widths.size>5 && surfaces.size>5)
    }

    @Test fun skeletonHostUsesDefinite260By160ContextAndAllTypedAppearanceFields() {
        fun root(frame:JSONObject):JSONObject {
            val nodes=frame.getJSONObject("inspection").getJSONArray("nodes")
            return (0 until nodes.length()).map { nodes.getJSONObject(it) }.single { it.getString("id")=="component" }.getJSONObject("bounds")
        }
        withHost { _,command ->
            val appearance=JSONObject().put("color","#12345680").put("highlight","#FEDCBA80").put("radius",JSONObject())
                .put("roundedRadius",JSONObject()).put("width",JSONObject().put("fraction",.5).put("points",-10))
                .put("height",JSONObject().put("em",2)).put("size",JSONObject().put("points",64))
                .put("lineGap",JSONObject().put("points",9)).put("pulseDuration",0).put("waveDuration",0).put("bloomDuration",0)
            val frame=command(JSONObject().put("command","configure").put("tag","md-skeleton").put("width",640)
                .put("properties",JSONObject().put("variant","text").put("lines",3).put("fullWidth",false).put("height","18px"))
                .put("skeletonAppearance",appearance))
            val b=root(frame);assertEquals(120.0,b.getDouble("width"),.01);assertEquals(72.0,b.getDouble("height"),.01)
            val nodes=frame.getJSONObject("inspection").getJSONArray("nodes")
            val rootNode=(0 until nodes.length()).map { nodes.getJSONObject(it) }.single { it.getString("id")=="component" }
            assertEquals(9.0,rootNode.getJSONObject("metrics").getJSONObject("gap").getDouble("row"),.01)
            assertEquals(0.0,rootNode.getJSONObject("metrics").getJSONObject("gap").getDouble("column"),.01)
            assertEquals(190.0,b.getDouble("x"),.01);assertEquals(32.0,b.getDouble("y"),.01)
            assertEquals("Actual parent contributes definite160dp plus preview padding",224.0,frame.getDouble("logicalHeight"),.01)
            val bitmap=decode(frame);val color=bitmap.getPixel(420,80)
            assertEquals(136.0,android.graphics.Color.red(color).toDouble(),3.0);assertEquals(153.0,android.graphics.Color.green(color).toDouble(),3.0)
            assertEquals(170.0,android.graphics.Color.blue(color).toDouble(),3.0);bitmap.recycle()
        }
        withHost { _,command ->
            val frame=command(JSONObject().put("command","configure").put("tag","md-skeleton").put("width",640)
                .put("properties",JSONObject().put("variant","circular").put("fullHeight",true).put("width","80px").put("animation","none"))
                .put("skeletonAppearance",JSONObject().put("bloomDuration",0)))
            val b=root(frame);assertEquals(160.0,b.getDouble("width"),.01);assertEquals(160.0,b.getDouble("height"),.01)
        }
    }

    @Test fun skeletonHostRetainsAllTenPropertiesWithoutRestartingEntrance() = withHost { token,command->
        fun nodes(frame:JSONObject)=frame.getJSONObject("inspection").getJSONArray("nodes").let { array->
            (0 until array.length()).map { array.getJSONObject(it) }
        }
        fun root(frame:JSONObject)=nodes(frame).single { it.getString("id")=="component" }
        command(JSONObject().put("command","configure").put("tag","md-skeleton").put("width",640)
            .put("properties",JSONObject().put("variant","text").put("lines",2).put("animation","none").put("width","200px").put("height","24px").put("fullWidth",false))
            .put("skeletonAppearance",JSONObject().put("color","#FF0000").put("lineGap",JSONObject().put("points",11))))
        Thread.sleep(700)
        fun update(p:JSONObject)=command(JSONObject().put("command","update").put("properties",p)).also { assertTrue(it.getBoolean("ack")) }
        update(JSONObject().put("lines",3).put("height","22px").put("ariaLabelProp","Loading records").put("announce",false).put("density",-2))
        val updated=command(JSONObject().put("command","frame"));val bounds=root(updated).getJSONObject("bounds")
        assertEquals(200.0,bounds.getDouble("width"),.01);assertEquals(88.0,bounds.getDouble("height"),.01)
        assertEquals(11.0,root(updated).getJSONObject("metrics").getJSONObject("gap").getDouble("row"),.01)
        assertEquals(4,nodes(updated).size)
        val bitmap=decode(updated);val pixel=bitmap.getPixel(((bounds.getDouble("x")+50)*2).toInt(),((bounds.getDouble("y")+8)*2).toInt())
        assertEquals("Property ACK preserves completed entrance opacity",0,android.graphics.Color.green(pixel));assertEquals(255,android.graphics.Color.red(pixel));bitmap.recycle()
        update(JSONObject().put("variant","circular").put("animation","wave").put("width","80px").put("height","40px").put("fullWidth",false).put("fullHeight",true))
        val circle=root(command(JSONObject().put("command","frame"))).getJSONObject("bounds")
        assertEquals(160.0,circle.getDouble("width"),.01);assertEquals(160.0,circle.getDouble("height"),.01)
        for(invalid in listOf(JSONObject().put("lines","3"),JSONObject().put("variant","pill"),JSONObject().put("animation","spin"),JSONObject().put("density",-5),JSONObject().put("announce",1),JSONObject().put("width",32),JSONObject().put("hidden",true),JSONObject().put("height",JSONObject.NULL),JSONObject().put("ariaLabelProp","x".repeat(4097)))) {
            val response=request("POST","/command",token,JSONObject().put("command","update").put("properties",invalid))
            assertTrue("Malformed retained edits reject without replacing the session",response.first>=400 || response.second.has("error"))
        }
        update(JSONObject().put("variant","rounded").put("animation","none").put("fullHeight",false).put("fullWidth",true).put("height","30px"))
        val final=root(command(JSONObject().put("command","frame"))).getJSONObject("bounds")
        assertEquals(260.0,final.getDouble("width"),.01);assertEquals(30.0,final.getDouble("height"),.01)
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
