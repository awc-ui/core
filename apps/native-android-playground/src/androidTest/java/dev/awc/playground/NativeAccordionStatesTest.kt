package dev.awc.playground

import android.os.SystemClock
import android.view.InputDevice
import android.view.MotionEvent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusManager
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toPixelMap
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import androidx.test.platform.app.InstrumentationRegistry
import dev.awc.nativeui.*
import dev.awc.playground.AccordionWebFixtures.channels
import dev.awc.playground.AccordionWebFixtures.objects
import dev.awc.playground.AccordionWebFixtures.over
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import kotlin.math.abs
import kotlin.math.hypot
import kotlin.math.roundToInt

/**
 * Header interaction states with real Android input, frame by frame on the composition
 * clock, for the 56 Chrome trusted-input cases of accordion-web-states.json. Mouse input
 * is Android MotionEvents from a mouse (SOURCE_MOUSE / TOOL_TYPE_MOUSE: ACTION_HOVER_*,
 * ACTION_DOWN/BUTTON_PRESS, ACTION_MOVE, ACTION_UP/BUTTON_RELEASE) dispatched to the
 * window's root view; Tab is a key event. Each frame's pixels (state layer, ripple, grip,
 * focus ring) and grip bounds must equal the item's native style tracks, and the tracks
 * must start the same transitions as Chrome (count, durations, easing, end values).
 */
@OptIn(ExperimentalTestApi::class)
class NativeAccordionStatesTest {
    @get:Rule val compose=createComposeRule()
    private var theme by mutableStateOf("light");private var preset by mutableStateOf("expressive")
    private var reduced by mutableStateOf(false);private var scenario by mutableStateOf("hover-closed")
    private var epoch by mutableIntStateOf(0)
    private val collector=AWCInspectionCollector()
    private val styles=mutableMapOf<String,AWCAccordionItemStyleInspection>()
    private var focus:FocusManager?=null
    private var page=listOf(1.0,1.0,1.0,1.0);private var onSurface=Color.Black;private var onSecondaryContainer=Color.Black;private var secondary=Color.Black
    private var rootView:android.view.View?=null
    private fun node(id:String)=collector.snapshot().nodes.singleOrNull { it.id==id }
    private val ids=listOf("a","b","c")

    private fun content() { compose.setContent { CompositionLocalProvider(LocalDensity provides Density(2f,1f)) { AWCTheme(theme=="dark") {
        focus=LocalFocusManager.current;rootView=LocalView.current
        page=MaterialTheme.colorScheme.surface.channels();onSurface=MaterialTheme.colorScheme.onSurface
        onSecondaryContainer=MaterialTheme.colorScheme.onSecondaryContainer;secondary=MaterialTheme.colorScheme.secondary
        AWCAccessibilityAppearanceScope(reducedMotion=reduced) {
            Box(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.surface)) {
                Box(Modifier.padding(40.dp).requiredWidth(400.dp).testTag("canvas")) {
                    AWCInspectionScope(collector) { AWCAccordionStyleInspectionScope({ name,ins-> styles[name]=ins }) { key(epoch) {
                        AWCComponent("md-accordion",mapOf("reorderable" to true,"transition" to preset,"variant" to "filled")) { slot-> if(slot=="")
                            ids.forEachIndexed { i,id-> key(id) { AWCComponent("md-accordion-item",mapOf("headline" to id,"expanded" to (i==0),"disabled" to (i==2 && scenario=="disabled"))) { if(it=="") Text("Body") } } }
                        }
                    } } }
                }
            }
        }
    } } } }

    private fun mix(a:List<Double>,b:List<Double>)=a.zip(b).all { (x,y)-> abs(x-y)<=3.5/255 }
    private fun Color.c()=channels()

    @Test fun fiftySixChromeStateCasesRenderTheNativeStyleTracks() {
        // Optional focused runs: -e awcCase <substring of theme/preset/scenario> -e awcRepeat <n> (default: every case once).
        val args=androidx.test.platform.app.InstrumentationRegistry.getArguments()
        val only=args.getString("awcCase");val repeat=args.getString("awcRepeat")?.toIntOrNull() ?: 1
        val reference=AccordionWebFixtures.document("AccordionWebStates.json").getJSONArray("cases").objects()
            .filter { only==null || "${it.getString("theme")}/${it.getString("preset")}${if(it.getBoolean("reduced")) "-reduced" else ""}/${it.getString("scenario")}".contains(only) }
            .flatMap { c-> List(repeat) { c } }
        content()
        var checks=0;var pixelChecks=0;val failures=mutableListOf<String>();val report=JSONArray()
        fun check(ok:Boolean,label:String) { checks++;if(!ok) failures+=label }
        fun near(a:Double?,b:Double,tol:Double,label:String)=check(a!=null && abs(a-b)<=tol,"$label: Android $a vs $b")
        val outside=Offset(1000f,1500f)
        for(c in reference) {
            val label="${c.getString("theme")}/${c.getString("preset")}${if(c.getBoolean("reduced")) "-reduced" else ""}/${c.getString("scenario")}"
            compose.mainClock.autoAdvance=true
            compose.onRoot().performMouseInput { moveTo(outside) }
            compose.runOnIdle { focus?.clearFocus(true);theme=c.getString("theme");preset=c.getString("preset");reduced=c.getBoolean("reduced");scenario=c.getString("scenario");styles.clear();epoch++ }
            compose.waitForIdle()
            val target=c.getString("target");val ti=ids.indexOf(target)
            val ins=styles[target]!!
            val header=node("component.item-$ti.header")!!.bounds
            val gripNode=node("component.item-$ti.drag-handle")?.bounds
            val headerPoint=Offset(((header.x+header.width*.6)*2).toFloat(),((header.y+header.height/2)*2).toFloat())
            val gripPoint=gripNode?.let { Offset(((it.x+it.width/2)*2).toFloat(),((it.y+it.height/2)*2).toFloat()) } ?: headerPoint
            near(header.width,400.0,.51,"$label header width");near(header.height,64.0,.51,"$label header height")
            fun probe()=Offset(((header.x+header.width-8)*2).toFloat(),((header.y+8)*2).toFloat())
            val image0=compose.onRoot().captureToImage().toPixelMap()
            val base0=image0[probe().x.toInt(),probe().y.toInt()].channels()
            compose.mainClock.autoAdvance=false
            val steps=c.getJSONArray("steps").objects()
            val t0=steps[0].getDouble("t")
            val plan=steps.associate { ((it.getDouble("t")-t0)/16).roundToInt() to it.getString("label") }
            val inputFrames=mutableListOf<Double>()
            val frames=(c.getJSONArray("samples").objects().last().getDouble("t")/16).roundToInt()+4
            data class Frame(val f:Int,val now:Double,val state:Double,val computed:Double,val stateColor:Color,val waves:List<AWCAccordionRippleState>,val focus:Boolean,val probe:List<Double>?,val ring:List<Double>?,val disclosure:Boolean,val expanded:Boolean,val gripScale:Double,val gripBounds:Double?)
            val recorded=mutableListOf<Frame>();val hoverTrace=JSONArray()
            for(f in 0 until frames) {
                when(plan[f]) {
                    "enter"->compose.onRoot().performMouseInput { moveTo(if(c.getString("scenario").startsWith("grip")) gripPoint else headerPoint,delayMillis=0) }
                    "leave"->compose.onRoot().performMouseInput { moveTo(outside,delayMillis=0) }
                    "down"->compose.onRoot().performMouseInput { press() }
                    "move"->compose.onRoot().performMouseInput { moveTo(gripPoint+Offset(0f,40f),delayMillis=0) }
                    "up"->compose.onRoot().performMouseInput { release() }
                    "tab","tab2"->compose.onRoot().performKeyInput { keyDown(Key.Tab);keyUp(Key.Tab) }
                }
                compose.mainClock.advanceTimeByFrame()
                val now=ins.frameMillis
                if(plan[f]!=null) inputFrames+=now
                val elapsed=compose.onNode(hasText(target) and SemanticsMatcher.keyIsDefined(AWCAccordionTransitionElapsed)).fetchSemanticsNode().config[AWCAccordionTransitionElapsed]
                val expanded=compose.onNode(hasText(target) and SemanticsMatcher.keyIsDefined(AWCAccordionTransitionElapsed)).fetchSemanticsNode().config[androidx.compose.ui.semantics.SemanticsProperties.StateDescription]=="Expanded"
                val capture=f%3==0 || plan[f]!=null || plan[f-1]!=null
                // Keep only the sampled pixels (a full frame is 10 MB).
                var probePixel:List<Double>?=null;var ringPixel:List<Double>?=null
                // The header moves with a lifted item: sample at its current position.
                val now_=node("component.item-$ti.header")!!.bounds
                if(capture) { val map=compose.onRoot().captureToImage().toPixelMap()
                    probePixel=map[((now_.x+now_.width-8)*2).toInt(),((now_.y+8)*2).toInt()].channels()
                    ringPixel=map[((now_.x+1)*2).toInt(),((now_.y+now_.height/2)*2).toInt()].channels() }
                hoverTrace.put(if(ins.hovered) 1 else 0)
                val grip=node("component.item-$ti.drag-handle")?.bounds
                recorded+=Frame(f,now,ins.stateOpacity(now),ins.computedStateOpacity(now),if(expanded) onSecondaryContainer else onSurface,ins.waves(now),ins.focusVisible,probePixel,ringPixel,elapsed>=0,expanded,ins.gripScale(now),grip?.width)
                // Grip bounds carry the transitioning scale (24 dp box).
                if(grip!=null) near(grip.width/24,ins.gripScale(now),.006,"$label frame $f grip scale renders its track")
                // A dragging header has pointer-events:none: no hover; :active persists.
                if(ins.dragging) check(!ins.hovered && !ins.gripHovered,"$label frame $f dragging header is not hovered")
            }
            // Settle and sample the expanded base for frames after a press expands the item.
            compose.onRoot().performMouseInput { moveTo(outside,delayMillis=0) }
            repeat(60) { compose.mainClock.advanceTimeByFrame() }
            val baseEnd=compose.onRoot().captureToImage().toPixelMap()[probe().x.toInt(),probe().y.toInt()].channels()
            // ---- rendered pixels versus the native tracks ----
            val px=probe();val pdp=Offset((px.x/2-header.x).toFloat(),(px.y/2-header.y).toFloat())
            for((k,fr) in recorded.withIndex()) {
                val actual=fr.probe ?: continue
                // Disclosure frames (a released press expands the item) are covered by the motion suites:
                // skip from the frame the expanded state flips until its transition has finished.
                if(fr.disclosure || recorded.getOrNull(k+1)?.disclosure==true || recorded.getOrNull(k-1)?.let { it.expanded!=fr.expanded }==true) continue
                // Bases: the probe before any input, and (once a press has expanded the item) after it settles.
                val base=if(fr.expanded==(target=="a")) base0 else baseEnd
                val ink=if(fr.expanded) onSecondaryContainer else onSurface
                var expected=base
                for(w in fr.waves) {
                    val d=hypot(pdp.x-w.originX,pdp.y-w.originY);val r=w.radius*w.scale
                    if(abs(d-r)<1.5) { expected=listOf(Double.NaN);break }
                    if(d<r) expected=over(ink.c().let { listOf(it[0],it[1],it[2],w.opacity) },expected)
                }
                if(expected[0].isNaN()) continue
                expected=over(fr.stateColor.c().let { listOf(it[0],it[1],it[2],fr.state) },expected)
                pixelChecks++;check(mix(actual,expected),"$label frame ${fr.f} state layer/ripple pixel ${actual.take(3)} vs ${expected.take(3)} (state ${fr.state}, waves ${fr.waves.size})")
                // Focus-visible: the 3 dp secondary outline inside the header edge.
                val ring=fr.ring!!
                if(fr.focus) { pixelChecks++;check(mix(ring,secondary.c()),"$label frame ${fr.f} focus ring ${ring.take(3)} vs ${secondary.c().take(3)}") }
                else if(c.getString("scenario")=="focus") { pixelChecks++;check(!mix(ring,secondary.c()),"$label frame ${fr.f} no focus ring") }
            }
            // ---- native transitions versus the source records ----
            val web=c.getJSONArray("anims").objects()
            // The settle step after the recorded window (moving the mouse away) is not part of the source run.
            val hist=ins.history().filter { it.animated && it.start<=recorded.last().now }
            fun records(part:String,prop:String)=web.filter { it.getString("part")==part && it.getString("property")==prop }.sortedBy { it.getDouble("startTime") }
            fun cmp(part:String,prop:String,native:String,value:(JSONObject)->Double?) {
                val w=records(part,prop);val n=hist.filter { it.property==native }
                check(w.size==n.size,"$label $native transitions ${n.size} vs source ${w.size}")
                for((a,b) in n.zip(w)) {
                    near(a.duration,b.getDouble("duration"),.01,"$label $native duration")
                    check(b.getString("easing")=="cubic-bezier(${a.curve.joinToString(", ") { x-> if(x==Math.floor(x)) x.toLong().toString() else x.toString() }})","$label $native easing")
                    check(a.start in inputFrames,"$label $native starts at the frame that renders the input (${a.start} in $inputFrames)")
                    value(b.getJSONObject("to"))?.let { v-> near((a.to as? Double) ?: Double.NaN,v,.0005,"$label $native end value") }
                }
            }
            cmp("state-layer","opacity","state-layer.opacity") { it.getString("opacity").toDouble() }
            cmp("drag-handle","opacity","drag-handle.opacity") { it.getString("opacity").toDouble() }
            cmp("drag-handle","color","drag-handle.color") { null }
            cmp("drag-handle","transform","drag-handle.transform") { val t=it.getString("transform");if(t=="none") 1.0 else t.removePrefix("scale(").removeSuffix(")").toDouble() }
            for((a,b) in hist.filter { it.property=="drag-handle.color" }.zip(records("drag-handle","color"))) {
                val to=AccordionWebFixtures.css(b.getJSONObject("to").getString("color"));val n=(a.to as Color).c()
                check((0..2).all { abs(n[it]-to[it])<=1.01/255 },"$label grip colour end ${n.take(3)} vs ${to.take(3)}")
            }
            val grows=web.filter { it.getString("part")=="wave" && it.getJSONObject("to").has("transform") }
            val started=ins.startedWaves()
            check(started.size==grows.size,"$label ripple waves ${started.size} vs ${grows.size}")
            val webWidth=c.getJSONArray("samples").objects().flatMap { it.getJSONArray("waves").objects() }.maxOfOrNull { it.getDouble("width") }
            for(w in started) {
                check(w.began in inputFrames,"$label wave begins at the press frame")
                if(webWidth!=null) near(2*w.radius,webWidth,1.0,"$label wave farthest-corner diameter")
            }
            // ---- settled states versus the source at the end of every step ----
            val samples=c.getJSONArray("samples").objects()
            for((k,step) in steps.withIndex()) {
                val end=steps.getOrNull(k+1)?.getDouble("t") ?: Double.MAX_VALUE
                val webLast=samples.lastOrNull { it.getDouble("t")<end-1 } ?: continue
                val endFrame=(((end.takeIf { it<1e9 } ?: samples.last().getDouble("t"))-t0)/16).roundToInt()-1
                val fr=recorded.getOrNull(endFrame.coerceIn(0,recorded.lastIndex)) ?: continue
                val computed=if(c.getString("scenario")=="disabled") fr.computed else fr.state
                near(computed,webLast.getJSONObject("state").getDouble("opacity"),.002,"$label ${step.getString("label")} settled state-layer opacity")
                if(c.getString("scenario")!="disabled") near(fr.gripScale,webLast.getJSONObject("grip").getDouble("scale"),.002,"$label ${step.getString("label")} settled grip scale")
            }
            // Disabled: computed 0.08 on hover, never painted.
            if(c.getString("scenario")=="disabled") check(recorded.all { it.state==0.0 },"$label disabled state layer is not painted")
            report.put(JSONObject().put("case",label).put("frames",recorded.size).put("inputFrames",JSONArray(inputFrames)).put("hovered",hoverTrace)
                .put("transitions",JSONArray(hist.map { JSONObject().put("property",it.property).put("start",it.start).put("duration",it.duration).put("to",it.to.toString()) }))
                .put("waves",JSONArray(started.map { JSONObject().put("began",it.began).put("released",it.released).put("radius",it.radius) })))
            compose.mainClock.autoAdvance=true
        }
        AccordionEvidence.log("states",JSONObject().put("cases",reference.size).put("checks",checks).put("pixelChecks",pixelChecks).put("failures",failures.size).put("report",report))
        if(only==null && repeat==1) assertEquals(56,reference.size)
        assertTrue("${failures.size} of $checks failed:\n"+failures.take(80).joinToString("\n"),failures.isEmpty())
    }

    /** Touch has no hover on Android: a tap gives :active (0.12) and the ripple, then the layer clears. */
    @Test fun touchPressMapsToActiveAndRippleWithoutHover() {
        content()
        compose.waitForIdle()
        val ins=styles["b"]!!
        val header=node("component.item-1.header")!!.bounds
        val p=Offset(((header.x+header.width*.6)*2).toFloat(),((header.y+header.height/2)*2).toFloat())
        compose.mainClock.autoAdvance=false
        compose.onRoot().performTouchInput { down(p) }
        compose.mainClock.advanceTimeByFrame()
        assertTrue(ins.pressed);assertFalse(ins.hovered)
        assertEquals(1,ins.waves(ins.frameMillis).size)
        repeat(20) { compose.mainClock.advanceTimeByFrame() }
        assertEquals(.12,ins.stateOpacity(ins.frameMillis),1e-9)
        compose.onRoot().performTouchInput { up() }
        repeat(60) { compose.mainClock.advanceTimeByFrame() }
        assertFalse(ins.pressed);assertFalse(ins.hovered)
        assertEquals("no sticky touch hover",0.0,ins.stateOpacity(ins.frameMillis),1e-9)
        assertTrue(ins.waves(ins.frameMillis).isEmpty())
        AccordionEvidence.log("states-touch",JSONObject().put("checks",6))
    }

    /** The platform input pipeline: a mouse hover injected through UiAutomation reaches the header. */
    @Test fun systemInjectedMouseHoverReachesTheHeader() {
        content()
        compose.waitForIdle()
        val ins=styles["b"]!!
        val header=node("component.item-1.header")!!.bounds
        val location=IntArray(2);compose.runOnIdle { rootView!!.getLocationOnScreen(location) }
        val x=location[0]+((header.x+header.width*.6)*2).toFloat();val y=location[1]+((header.y+header.height/2)*2).toFloat()
        val automation=InstrumentationRegistry.getInstrumentation().uiAutomation
        fun hover(action:Int,px:Float,py:Float) {
            val now=SystemClock.uptimeMillis()
            val props=arrayOf(MotionEvent.PointerProperties().apply { id=0;toolType=MotionEvent.TOOL_TYPE_MOUSE })
            val coords=arrayOf(MotionEvent.PointerCoords().apply { this.x=px;this.y=py;pressure=0f;size=1f })
            val e=MotionEvent.obtain(now,now,action,1,props,coords,0,0,1f,1f,0,0,InputDevice.SOURCE_MOUSE,0)
            assertTrue(automation.injectInputEvent(e,true));e.recycle()
        }
        hover(MotionEvent.ACTION_HOVER_MOVE,x,y)
        compose.waitUntil(3000) { ins.hovered }
        compose.waitForIdle()
        assertEquals(.08,ins.computedStateOpacity(Double.MAX_VALUE),1e-9)
        hover(MotionEvent.ACTION_HOVER_MOVE,location[0]+1000f,location[1]+1500f)
        compose.waitUntil(3000) { !ins.hovered }
        AccordionEvidence.log("states-system-hover",JSONObject().put("hovered",true).put("cleared",true))
    }
}
