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
 * md-text-field interaction against Chrome 153 (Mac capture of tf-states.html: 13 runs, full and reduced motion) — the same
 * fixture as the SwiftUI NativeTextFieldStatesIntegration. Steps fire at Chrome's phase and keystroke times on the test clock
 * (mouse hover/press, IME text input, hardware keys, focus moves, form submit); every frame's label size/position, indicator
 * height and outline notch must lie within Chrome's samples ±2 frames; each phase's end state and the md* event sequence
 * (names, details, debounce/throttle timing) are compared.
 */
@OptIn(ExperimentalTestApi::class)
class NativeTextFieldStatesTest {
    @get:Rule val compose=createComposeRule()
    private var run by mutableStateOf(JSONObject("{\"name\":\"init\",\"html\":\"<md-text-field></md-text-field>\"}"))
    private var reduced by mutableStateOf(false);private var epoch by mutableIntStateOf(0)
    private val collector=AWCInspectionCollector();private var values:Map<String,Map<String,Any?>> = emptyMap()
    private val controller=AWCTextFieldController();private var form=AWCFormState()
    private val events=mutableListOf<Triple<Double,String,AWCValue>>();private var clock0=0L
    private var checks=0;private val failures=mutableListOf<String>();private val report=JSONArray()
    private fun check(ok:Boolean,label:String) { checks++;if(!ok) failures+=label }
    private fun now()=(compose.mainClock.currentTime-clock0).toDouble()
    /** The md-text-field attributes of the run's markup, typed as the Laboratory sends them. */
    private fun props(html:String):Map<String,Any?> {
        val tag=Regex("<md-text-field([^>]*)>").find(html)!!.groupValues[1];val m=mutableMapOf<String,Any?>()
        for(a in Regex("([a-z-]+)(?:=\"([^\"]*)\")?").findAll(tag)) { val k=a.groupValues[1];val v=a.groups[2]?.value
            val camel=if(k=="readonly") "readOnly" else k.split("-").mapIndexed { i,s-> if(i==0) s else s.replaceFirstChar { it.uppercase() } }.joinToString("")
            m[camel]=if(k in setOf("max-length","debounce","throttle","rows","min-length") && v!=null) v.toDouble() else v ?: true }
        return m }
    private fun content() { compose.setContent { CompositionLocalProvider(LocalDensity provides Density(2f,1f)) {
        val r=run;val p=props(r.getString("html"))
        AWCTheme(r.optString("theme")=="dark") { AWCFieldReducedMotionScope(reduced) { Box(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.surface)) { key(epoch) {
            CompositionLocalProvider(LocalLayoutDirection provides if(r.optString("dir")=="rtl") LayoutDirection.Rtl else LayoutDirection.Ltr) {
                Box(Modifier.absoluteOffset(24.dp,24.dp).width(320.dp)) {
                    AWCTextFieldInspectionScope({ values=it }) { AWCInspectionScope(collector) { AWCTextFieldControllerScope(controller) {
                        val field=@Composable { AWCComponent("md-text-field",p,onEvent={ n,v-> if(n.startsWith("md")) events+=Triple(now(),n,v) }) }
                        if(r.getString("html").contains("<form")) AWCFormScope(form) { field() } else field()
                    } } }
                }
            }
        } } } }
    } } }
    @Test fun textFieldInteractionMatchesChrome() {
        content()
        val doc=CardWeb.document("TextFieldWebStates.json")
        for((k,red) in listOf("runs" to false,"reduced" to true)) { val runs=doc.getJSONArray(k).objects();for((i,r) in runs.withIndex()) runCase(r,red,i==runs.size-1) }
        AccordionEvidence.log("textfield-states",JSONObject().put("checks",checks).put("failures",failures.size).put("failureList",JSONArray(failures.take(300))).put("report",report))
        assertTrue("${failures.size} of $checks failed:\n"+failures.take(80).joinToString("\n"),failures.isEmpty())
    }
    private class Frame(val t:Double,val font:Double?,val y:Double?,val indicator:Double?,val notch:Double?,val focused:Any?=null,val floating:Any?=null)
    private fun centre(part:String):Offset? = collector.snapshot().nodes.firstOrNull { it.name==part }?.bounds?.let { Offset(((it.x+it.width/2)*2).toFloat(),((it.y+it.height/2)*2).toFloat()) }
    private fun runCase(r:JSONObject,red:Boolean,last:Boolean) {
        val name=(if(red) "reduced/" else "")+r.getString("name")
        val timed=r.getString("name").let { it.contains("debounce") || it.contains("throttle") }
        compose.mainClock.autoAdvance=true
        compose.onRoot().performMouseInput { moveTo(Offset(1400f,1600f),0) }
        form=AWCFormState();events.clear();values=emptyMap();collector.clear();reduced=red;run=r;epoch++;compose.waitForIdle()
        compose.mainClock.autoAdvance=false;compose.mainClock.advanceTimeBy(100);compose.waitForIdle();clock0=compose.mainClock.currentTime
        val phases=r.getJSONArray("phases").objects();val web=r.getJSONArray("events").objects()
        fun field()=compose.onNode(hasSetTextAction())
        fun mouseClick(o:Offset?) { if(o==null) { check(false,"$name no target");return };compose.onRoot().performMouseInput { moveTo(o,0);press();release() } }
        fun key(k:Key) { runCatching { compose.onNode(isFocused()).performKeyInput { pressKey(k) } } }
        // Steps on Chrome's timeline: each phase starts at its recorded offset; keystrokes land at Chrome's input events.
        val steps=mutableListOf<Pair<Double,()->Unit>>()
        // Buttons: Chrome's release lands where the phase's first md event did (CDP press latency), as in the Swift suite.
        fun held(t:Double,end:Double,part:String) { val first=web.firstOrNull { it.getDouble("t")>=t && it.getDouble("t")<end }?.getDouble("t")?.minus(t) ?: 0.0
            if(first<=4) { steps+=t to { mouseClick(centre(part)) };return }
            var at:Offset?=null
            steps+=t to { at=centre(part);if(at==null) check(false,"$name no target") else compose.onRoot().performMouseInput { moveTo(at!!,0);press() } }
            steps+=(t+first-2) to { if(at!=null) compose.onRoot().performMouseInput { release() } } }
        for((i,ph) in phases.withIndex()) { val t=ph.getDouble("t");val label=ph.getString("label")
            val end=if(i+1<phases.size) phases[i+1].getDouble("t") else t+450
            val keystrokes=web.filter { it.getString("name")=="mdInput" && it.getDouble("t")>=t && it.getDouble("t")<end }.map { it.getDouble("t") }
            fun typing(text:String) { text.forEachIndexed { j,ch-> steps+=(keystrokes.getOrNull(j) ?: (t+33.0*j)) to { field().performTextInput(ch.toString()) } } }
            when(label) {
                "hover"->steps+=t to { compose.onRoot().performMouseInput { centre("container")?.let { moveTo(it,0) } } }
                "press-focus","focus"->steps+=t to { mouseClick(centre("container")) }
                "type-Hello"->typing("Hello")
                "select-all-delete"->{ steps+=t to { controller.select() };steps+=t to { key(Key.Backspace) } }
                // Chrome blurs at the Tab keydown: the page has nothing focusable after the field.
                "tab-out","blur"->steps+=t to { compose.runOnIdle { controller.runtimeBlur() } }
                "tab-back-in"->if(ph.getJSONArray("samples").objects().lastOrNull()?.optJSONObject("input")?.optBoolean("focused")==true) steps+=t to { compose.runOnIdle { controller.setFocus() } }
                "click-clear"->held(t,end,"clear")
                "type-abc"->typing("abc")
                "escape-clears","escape-empty-noop"->steps+=t to { key(Key.Escape) }
                "reveal","hide"->held(t,end,"password-toggle")
                "type-bad"->typing("ada@")
                "submit-enter"->steps+=t to { compose.runOnIdle { form.requestSubmit() } }
                "fix"->{ steps+=t to { mouseClick(centre("container")) };typing("x.io") }
                "type-a1b2c3d4e5"->{ val ks="a1b2c3d4e5";ks.forEachIndexed { j,ch-> steps+=(t+33.0*j+16) to { field().performTextInput(ch.toString()) } } }
                "type-d"->typing("d")
                "type-abcdefgh"->typing("abcdefgh")
                "type-3-lines"->{ val text="one\ntwo\nthree";text.forEachIndexed { j,ch-> steps+=(keystrokes.getOrNull(j) ?: (t+33.0*j)) to { field().performTextInput(ch.toString()) } } }
                else->check(false,"$name unknown phase $label")
            }
        }
        steps.sortBy { it.first }
        val frames=mutableListOf<Frame>();var next=0
        val endT=phases.last().getDouble("t")+450
        while(now()<endT) {
            // One step per frame: a step's state change (select(), focus) reaches the composition before the next input.
            // Timer runs (debounce / throttle): a keystroke lands at Chrome's own time, not the next frame of the test clock, so a
            // window that ends on a keystroke resolves key-first as in Chrome (the input is dispatched before a timer due then).
            if(timed && next<steps.size && steps[next].first>now() && steps[next].first<now()+16) {
                compose.mainClock.advanceTimeBy(kotlin.math.round(steps[next].first-now()).toLong(),true);compose.waitForIdle() }
            if(next<steps.size && now()>=steps[next].first) { steps[next].second();next++ }
            compose.mainClock.advanceTimeByFrame();compose.waitForIdle()
            val label=collector.snapshot().nodes.firstOrNull { it.name=="label" }
            frames+=Frame(now(),values["label"]?.get("fontSize") as? Double,label?.bounds?.y,values["indicator"]?.get("height") as? Double,values["fieldset"]?.get("legendWidth") as? Double,values[""]?.get("focused"),values[""]?.get("floating"))
        }
        // Motion: every Chrome frame inside the native envelope (native may lead by ≤40 ms or trail by ≤34 ms).
        fun env(t:Double,read:(Frame)->Double?):Pair<Double,Double>? { val v=frames.filter { it.t>=t-40 && it.t<=t+34 }.mapNotNull(read);return if(v.isEmpty()) null else v.min() to v.max() }
        for(ph in phases) { val label=ph.getString("label");var bad=0;var n=0
            for(s in ph.getJSONArray("samples").objects()) { val t=ph.getDouble("t")+s.getDouble("t")
                s.optJSONObject("label")?.let { l-> env(t) { it.font }?.let { e-> n++;val v=l.getDouble("fontSize");if(v<e.first-.05 || v>e.second+.05) { bad++;if(bad<=2) android.util.Log.i("AWCAccordion","  $name $label t=${s.getDouble("t")} label font $v not in $e") } }
                    env(t) { it.y }?.let { e-> n++;val v=l.getDouble("y");if(v<e.first-.3 || v>e.second+.3) { bad++;if(bad<=2) android.util.Log.i("AWCAccordion","  $name $label t=${s.getDouble("t")} label y $v not in $e") } } }
                s.optJSONObject("indicator")?.let { w-> env(t) { it.indicator }?.let { e-> n++;val v=w.getDouble("height");if(v<e.first-.05 || v>e.second+.05) bad++ } }
                if(s.has("notch")) env(t) { it.notch }?.let { e-> n++;val v=s.getDouble("notch");if(v<e.first-.6 || v>e.second+.6) bad++ }
            }
            if(bad>0) android.util.Log.i("AWCAccordion","  $name $label native frames: "+frames.filter { it.t>=ph.getDouble("t")-34 && it.t<=ph.getDouble("t")+220 }.joinToString(" ") { "%.0f:%.2f/%.1f/n%.1f/i%.1f%s".format(it.t-ph.getDouble("t"),it.font ?: -1.0,it.y ?: -1.0,it.notch ?: -1.0,it.indicator ?: -1.0,(if(it.focused==true) "F" else "")+(if(it.floating==true) "L" else "")) })
            check(bad==0,"$name $label motion: $bad/$n frames outside the envelope");report.put(JSONObject().put("run",name).put("phase",label).put("frames",n).put("outside",bad))
            // End state: Chrome's last frame of the phase against the native frame at that time.
            val last=ph.getJSONArray("samples").objects().lastOrNull() ?: continue
            val f=frames.lastOrNull { it.t<=ph.getDouble("t")+last.getDouble("t")+17 } ?: continue
            last.optJSONObject("label")?.let { l-> check(f.font!=null && abs(f.font-l.getDouble("fontSize"))<=.05,"$name $label end label font ${f.font} vs ${l.getDouble("fontSize")}") }
        }
        val host=values[""].orEmpty();val lastHost=phases.last().getJSONArray("samples").objects().lastOrNull()?.optJSONObject("host")
        if(lastHost!=null) check(host["value"]==lastHost.optString("value"),"$name final value ${host["value"]} vs ${lastHost.optString("value")}")
        // Teardown: Chrome's next run replaces the field, which blurs it (a pending change commits). The page's last run is not replaced.
        if(!last) { compose.mainClock.autoAdvance=true;compose.runOnIdle { controller.runtimeBlur() };compose.waitForIdle() }
        // Events: md* names and details (form-level events are not field events); debounce/throttle timing ±40 ms.
        val nat=events.filter { it.second !in setOf("mdInvalid","mdSubmit","mdReset") }
        check(nat.size==web.size,"$name ${nat.size} md events vs ${web.size}: ${nat.map { it.second+" "+it.third+" @"+it.first.toInt() }}")
        for((i,w) in web.withIndex()) { val e=nat.getOrNull(i) ?: break
            check(e.second==w.getString("name"),"$name event $i ${e.second} vs ${w.getString("name")}")
            val d=w.opt("detail")
            if(w.getString("name")=="mdValidityChange") { val m=e.third as? Map<*,*>;val wd=d as JSONObject
                check(m?.get("valid")==wd.getBoolean("valid") && m["validationMessage"]==wd.getString("validationMessage"),"$name event $i validity $m vs $wd") }
            else if(d is String) check(e.third==d,"$name event $i ${e.second} detail ${e.third} vs $d")
            if(w.getString("name")=="mdSearch" && (name.contains("debounce") || name.contains("throttle"))) {
                val pw=web.take(i).lastOrNull { it.getString("name")=="mdInput" };val pn=nat.take(i).lastOrNull { it.second=="mdInput" }
                if(pw!=null && pn!=null) check(abs((w.getDouble("t")-pw.getDouble("t"))-(e.first-pn.first))<=40,"$name mdSearch $i delay ${e.first-pn.first} vs ${w.getDouble("t")-pw.getDouble("t")}") }
        }
        compose.mainClock.autoAdvance=true;compose.runOnIdle { controller.runtimeBlur() };compose.waitForIdle()
    }
}
