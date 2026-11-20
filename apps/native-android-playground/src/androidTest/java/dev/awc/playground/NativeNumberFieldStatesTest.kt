package dev.awc.playground

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import dev.awc.nativeui.*
import dev.awc.playground.CardWeb.objects
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import kotlin.math.abs

/**
 * md-number-field interaction against Chrome 153 (Mac capture of nf-states.html: 7 runs, full and reduced motion) — the same
 * fixture as the SwiftUI NativeNumberFieldStatesIntegration. Keys (arrows with Shift/Alt, Home/End, Enter), IME text input,
 * focus moves, stepper clicks and press-and-hold, mouse wheel (with Shift, horizontal) fire at Chrome's times on the test clock.
 * Compares the md* event sequence (value, formattedValue, reason; hold tick times), every phase's end state (value, display
 * text, focus, stepper disabled states) and the label motion within Chrome's samples ±2 frames.
 */
@OptIn(ExperimentalTestApi::class)
class NativeNumberFieldStatesTest {
    @get:Rule val compose=createComposeRule()
    // Touch mode is per display (Android 14+): a key-driven suite earlier in the run leaves keyboard mode, where a field takes
    // initial focus when composed. Chrome's baseline is a pointer session: start and leave every test in touch mode.
    @org.junit.Before @org.junit.After fun touchMode() { runCatching { androidx.test.platform.app.InstrumentationRegistry.getInstrumentation().setInTouchMode(true) } }
    private var run by mutableStateOf(JSONObject("{\"name\":\"init\",\"html\":\"<md-number-field></md-number-field>\"}"))
    private var reduced by mutableStateOf(false);private var epoch by mutableIntStateOf(0)
    private val collector=AWCInspectionCollector()
    private var values:Map<String,Map<String,Any?>> = emptyMap();private var fieldValues:Map<String,Map<String,Any?>> = emptyMap()
    private val controller=AWCNumberFieldController()
    private val events=mutableListOf<Triple<Double,String,AWCValue>>();private var clock0=0L
    private var checks=0;private val failures=mutableListOf<String>();private val report=JSONArray()
    private fun check(ok:Boolean,label:String) { checks++;if(!ok) failures+=label }
    private fun now()=(compose.mainClock.currentTime-clock0).toDouble()
    private fun props(html:String):Map<String,Any?> {
        val tag=Regex("<md-number-field([^>]*)>").find(html)!!.groupValues[1];val m=mutableMapOf<String,Any?>()
        for(a in Regex("([a-z-]+)(?:=(?:\"([^\"]*)\"|'([^']*)'))?").findAll(tag)) { val k=a.groupValues[1];val v=a.groups[2]?.value ?: a.groups[3]?.value
            val camel=if(k=="readonly") "readOnly" else k.split("-").mapIndexed { i,s-> if(i==0) s else s.replaceFirstChar { it.uppercase() } }.joinToString("")
            m[camel]=if(k in setOf("value","min","max","step","small-step","large-step","density") && v!=null) v.toDouble() else v ?: true }
        return m }
    private fun content() { compose.setContent { CompositionLocalProvider(LocalDensity provides Density(2f,1f)) {
        val r=run;val p=props(r.getString("html"))
        AWCTheme(r.optString("theme")=="dark") { AWCFieldReducedMotionScope(reduced) { Box(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.surface)) { key(epoch) {
            CompositionLocalProvider(LocalLayoutDirection provides if(r.optString("dir")=="rtl") LayoutDirection.Rtl else LayoutDirection.Ltr) {
                Box(Modifier.absoluteOffset(24.dp,24.dp).width(320.dp)) {
                    AWCTextFieldInspectionScope({ fieldValues=it }) { AWCNumberFieldInspectionScope({ values=it }) { AWCInspectionScope(collector) { AWCNumberFieldControllerScope(controller) {
                        AWCComponent("md-number-field",p,onEvent={ n,v-> if(n.startsWith("md")) events+=Triple(now(),n,v) })
                    } } } }
                }
            }
        } } } }
    } } }
    @Test fun numberFieldInteractionMatchesChrome() {
        content()
        val doc=CardWeb.document("NumberFieldWebStates.json")
        for((k,red) in listOf("runs" to false,"reduced" to true)) for(r in doc.getJSONArray(k).objects()) runCase(r,red)
        AccordionEvidence.log("numberfield-states",JSONObject().put("checks",checks).put("failures",failures.size).put("failureList",JSONArray(failures.take(300))).put("report",report))
        assertTrue("${failures.size} of $checks failed:\n"+failures.take(80).joinToString("\n"),failures.isEmpty())
    }
    private class Frame(val t:Double,val font:Double?,val y:Double?)
    private fun centre(part:String):Offset? = collector.snapshot().nodes.firstOrNull { it.name==part }?.bounds?.let { Offset(((it.x+it.width/2)*2).toFloat(),((it.y+it.height/2)*2).toFloat()) }
    private fun runCase(r:JSONObject,red:Boolean) {
        val name=(if(red) "reduced/" else "")+r.getString("name")
        compose.mainClock.autoAdvance=true
        compose.onRoot().performMouseInput { moveTo(Offset(1400f,1600f),0) }
        events.clear();values=emptyMap();fieldValues=emptyMap();collector.clear();reduced=red;run=r;epoch++;compose.waitForIdle()
        compose.mainClock.autoAdvance=false;compose.mainClock.advanceTimeBy(100);compose.waitForIdle();clock0=compose.mainClock.currentTime
        val phases=r.getJSONArray("phases").objects();val web=r.getJSONArray("events").objects().filter { it.getString("name")!="mdSearch" }
        fun field()=compose.onNode(hasSetTextAction())
        fun key(k:Key,mod:Key?=null) { runCatching { compose.onNode(isFocused()).performKeyInput { if(mod!=null) withKeyDown(mod) { pressKey(k) } else pressKey(k) } } }
        fun click(o:Offset?) { if(o==null) { check(false,"$name no target");return };compose.onRoot().performMouseInput { moveTo(o,0);press();release() } }
        fun wheel(dx:Float,dy:Float,shift:Boolean=false) { val c=centre("md-number-field") ?: return
            compose.onRoot().performMultiModalInput {
                if(shift) key { keyDown(Key.ShiftLeft) }
                mouse { moveTo(c,0);if(dy!=0f) scroll(dy,ScrollWheel.Vertical);if(dx!=0f) scroll(dx,ScrollWheel.Horizontal) }
                if(shift) key { keyUp(Key.ShiftLeft) } } }
        val steps=mutableListOf<Pair<Double,()->Unit>>()
        for((i,ph) in phases.withIndex()) { val t=ph.getDouble("t");val label=ph.getString("label")
            val end=if(i+1<phases.size) phases[i+1].getDouble("t") else t+450
            val keystrokes=web.filter { it.getString("name")=="mdInput" && it.getDouble("t")>=t && it.getDouble("t")<end }.map { it.getDouble("t") }
            // Chrome types at a steady cadence; a key that leaves the number unchanged (a separator) fires no input event, so the
            // event times map to keys only when every key fired one. Keys stay in order, a frame apart at least.
            fun typing(text:String) { steps+=t to { controller.select() };var prev=t
                text.forEachIndexed { j,ch-> val at=(if(keystrokes.size==text.length) keystrokes[j] else (keystrokes.firstOrNull() ?: (t+17))+33.33*j).coerceAtLeast(prev+16.0);prev=at
                    steps+=at to { field().performTextInput(ch.toString()) } } }
            when(label) {
                "focus"->steps+=t to { click(centre("input")) }
                "ArrowUp","ArrowUp-at-max"->steps+=t to { key(Key.DirectionUp) }
                "Shift+ArrowUp"->steps+=t to { key(Key.DirectionUp,Key.ShiftLeft) }
                "Alt+ArrowDown"->steps+=t to { key(Key.DirectionDown,Key.AltLeft) }
                "End"->steps+=t to { key(Key.MoveEnd) }
                "Home"->steps+=t to { key(Key.MoveHome) }
                "select-type-12.5"->typing("12.5")
                "type-out-of-range"->typing("250")
                "select-type-9876,5"->typing("9876,5")
                "Enter-commit"->steps+=t to { key(Key.Enter) }
                // Chrome blurs at the Tab keydown: the page has nothing focusable after the field.
                "Tab-blur-clamps","Tab-reformat"->steps+=t to { compose.runOnIdle { controller.runtimeBlur() } }
                "click-increment","click-decrement"->{ val part=label.removePrefix("click-");val press=web.firstOrNull { it.getDouble("t")>=t }?.getDouble("t") ?: (t+33)
                    steps+=press to { centre(part)?.let { o-> compose.onRoot().performMouseInput { moveTo(o,0);press() } } }
                    steps+=(press+16) to { compose.onRoot().performMouseInput { release() } } }
                "hold-increment-1200ms"->{ val press=web.firstOrNull { it.getDouble("t")>=t }?.getDouble("t") ?: (t+17)
                    steps+=press to { centre("increment")?.let { o-> compose.onRoot().performMouseInput { moveTo(o,0);press() } } }
                    steps+=(press+1200) to { compose.onRoot().performMouseInput { release() } } }
                "wheel-unfocused-ignored","wheel-up"->steps+=t to { wheel(0f,-100f) }
                "wheel-down"->steps+=t to { wheel(0f,100f) }
                "shift-wheel-down"->steps+=t to { wheel(0f,100f,true) }
                "horizontal-pan-ignored"->steps+=t to { wheel(100f,0f) }
                else->check(false,"$name unknown phase $label")
            }
        }
        steps.sortBy { it.first }
        val frames=mutableListOf<Frame>();var next=0
        val ends=mutableMapOf<String,Triple<Map<String,Any?>,Map<String,Any?>,Map<String,Any?>>>()
        val endT=phases.last().getDouble("t")+450
        var phaseIdx=0
        while(now()<endT) {
            // One step per frame: a step's state change (select(), focus) reaches the composition before the next input.
            if(next<steps.size && now()>=steps[next].first) { steps[next].second();next++ }
            compose.mainClock.advanceTimeByFrame();compose.waitForIdle()
            while(phaseIdx+1<phases.size && now()>=phases[phaseIdx+1].getDouble("t")) phaseIdx++
            val label=collector.snapshot().nodes.firstOrNull { it.name=="label" }
            frames+=Frame(now(),fieldValues["label"]?.get("fontSize") as? Double,label?.bounds?.y)
            val ph=phases[phaseIdx];val last=ph.getJSONArray("samples").objects().lastOrNull()
            if(last!=null && now()<=ph.getDouble("t")+last.getDouble("t")+17) ends[ph.getString("label")]=Triple(values["md-number-field"].orEmpty(),values["increment"].orEmpty()+mapOf("d" to values["decrement"]?.get("disabled")),fieldValues["input"].orEmpty())
        }
        fun env(t:Double,read:(Frame)->Double?):Pair<Double,Double>? { val v=frames.filter { it.t>=t-40 && it.t<=t+34 }.mapNotNull(read);return if(v.isEmpty()) null else v.min() to v.max() }
        for(ph in phases) { val label=ph.getString("label");var bad=0;var n=0
            for(s in ph.getJSONArray("samples").objects()) { val t=ph.getDouble("t")+s.getDouble("t")
                s.optJSONObject("label")?.let { l-> env(t) { it.font }?.let { e-> n++;val v=l.getDouble("fontSize");if(v<e.first-.05 || v>e.second+.05) bad++ }
                    env(t) { it.y }?.let { e-> n++;val v=l.getDouble("y");if(v<e.first-.3 || v>e.second+.3) bad++ } } }
            check(bad==0,"$name $label motion: $bad/$n frames outside the envelope")
            val last=ph.getJSONArray("samples").objects().lastOrNull() ?: continue;val (host,steppers,input)=ends[label] ?: continue
            val want=if(last.isNull("value")) null else last.getDouble("value")
            check((host["value"] as? Double)==want,"$name $label value ${host["value"]} vs $want")
            check(input["value"]==last.getString("text"),"$name $label text ${input["value"]} vs ${last.getString("text")}")
            check(host["focused"]==last.getBoolean("focused"),"$name $label focused ${host["focused"]} vs ${last.getBoolean("focused")}")
            last.optJSONObject("increment")?.let { check(steppers["disabled"]==it.getBoolean("disabled"),"$name $label increment disabled ${steppers["disabled"]} vs ${it.getBoolean("disabled")}") }
            last.optJSONObject("decrement")?.let { check(steppers["d"]==it.getBoolean("disabled"),"$name $label decrement disabled ${steppers["d"]} vs ${it.getBoolean("disabled")}") }
        }
        check(events.size==web.size,"$name ${events.size} md events vs ${web.size}: ${events.map { it.second+" "+it.third }}")
        for((i,w) in web.withIndex()) { val e=events.getOrNull(i) ?: break
            check(e.second==w.getString("name"),"$name event $i ${e.second} vs ${w.getString("name")}")
            val wd=w.optJSONObject("detail");val nd=e.third as? Map<*,*>
            if(wd!=null && wd.has("reason")) check(nd!=null && (nd["value"] as? Number)?.toDouble()==(if(wd.isNull("value")) null else wd.getDouble("value")) && nd["formattedValue"]==wd.getString("formattedValue") && nd["reason"]==wd.getString("reason"),
                "$name event $i ${e.second} detail $nd vs $wd")
        }
        if(name.endsWith("nf-steppers-pointer")) { val wt=web.filter { it.getString("name")=="mdInput" }.map { it.getDouble("t") };val nt=events.filter { it.second=="mdInput" }.map { it.first }
            for(i in 1 until minOf(wt.size,nt.size)) check(abs((nt[i]-nt[0])-(wt[i]-wt[0]))<=40,"$name tick $i at ${nt[i]-nt[0]} vs ${wt[i]-wt[0]}") }
        compose.mainClock.autoAdvance=true;compose.runOnIdle { controller.runtimeBlur() };compose.waitForIdle()
    }
}
