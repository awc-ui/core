package dev.awc.playground

import android.content.ClipData
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.platform.ClipEntry
import androidx.compose.ui.platform.Clipboard
import androidx.compose.ui.platform.LocalClipboard
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.semantics.SemanticsActions
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
 * md-otp-field interaction against Chrome 153 (Mac capture of otp-states.html: 4 runs, full and reduced motion) — the same fixture as
 * the SwiftUI NativeOTPFieldStatesIntegration. Steps fire at Chrome's phase and keystroke times on the test clock (mouse press and
 * hover, IME text input, hardware keys, the text field's paste); every frame's cell borders must lie within Chrome's samples ±2
 * frames; each phase's end state (value, focused cell, characters, borders) and the event sequence (with the form's submit) match.
 */
@OptIn(ExperimentalTestApi::class)
class NativeOTPFieldStatesTest {
    @get:Rule val compose=createComposeRule()
    // Touch mode is per display (Android 14+): a key-driven suite earlier in the run leaves keyboard mode, where a field takes
    // initial focus when composed. Chrome's baseline is a pointer session: start and leave every test in touch mode.
    @org.junit.Before @org.junit.After fun touchMode() { runCatching { androidx.test.platform.app.InstrumentationRegistry.getInstrumentation().setInTouchMode(true) } }
    private var run by mutableStateOf(JSONObject("{\"name\":\"init\",\"html\":\"<md-otp-field></md-otp-field>\"}"))
    private var reduced by mutableStateOf(false);private var epoch by mutableIntStateOf(0)
    private val collector=AWCInspectionCollector();private var values:Map<String,Map<String,Any?>> = emptyMap()
    private val controller=AWCOTPFieldController()
    private val events=mutableListOf<Triple<Double,String,Any?>>();private var clock0=0L
    private var form=AWCFormState(onSubmit={ events+=Triple(now(),"submit",null) })
    private var checks=0;private val failures=mutableListOf<String>();private val report=JSONArray()
    private fun check(ok:Boolean,label:String) { checks++;if(!ok) failures+=label }
    private fun now()=(compose.mainClock.currentTime-clock0).toDouble()
    private fun props(html:String):Map<String,Any?> {
        val tag=Regex("<md-otp-field([^>]*)>").find(html)!!.groupValues[1];val m=mutableMapOf<String,Any?>()
        for(a in Regex("([a-z-]+)(?:=\"([^\"]*)\")?").findAll(tag)) { val k=a.groupValues[1];val v=a.groups[2]?.value
            val camel=if(k=="readonly") "readOnly" else k.split("-").mapIndexed { i,s-> if(i==0) s else s.replaceFirstChar { it.uppercase() } }.joinToString("")
            m[camel]=if(k in setOf("length","group-size","density") && v!=null) v.toDouble() else v ?: true }
        return m }
    /** The paste source: the test's clipboard (the field's paste path reads LocalClipboard; the system clipboard is untouched). */
    private class TestClipboard(val base:Clipboard):Clipboard by base { var text:String?=null
        override suspend fun getClipEntry():ClipEntry?=text?.let { ClipEntry(ClipData.newPlainText("otp",it)) } ?: base.getClipEntry() }
    private var clipboard:TestClipboard?=null
    private fun content() { compose.setContent { val board=LocalClipboard.current.let { b-> remember(b) { TestClipboard(b).also { clipboard=it } } }
        CompositionLocalProvider(LocalDensity provides Density(2f,1f),LocalClipboard provides board) {
        val r=run;val p=props(r.getString("html"))
        AWCTheme(r.optString("theme")=="dark") { AWCFieldReducedMotionScope(reduced) { Box(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.surface)) { key(epoch) {
            CompositionLocalProvider(LocalLayoutDirection provides if(r.optString("dir")=="rtl") LayoutDirection.Rtl else LayoutDirection.Ltr) {
                Box(Modifier.absoluteOffset(24.dp,24.dp).width(440.dp)) {
                    AWCOTPFieldInspectionScope({ values=it }) { AWCInspectionScope(collector) { AWCOTPFieldControllerScope(controller) {
                        val field=@Composable { AWCComponent("md-otp-field",p,onEvent={ n,v-> if(n.startsWith("md")) events+=Triple(now(),n,v) }) }
                        if(r.getString("html").contains("<form")) AWCFormScope(form) { field() } else field()
                    } } }
                }
            }
        } } } }
    } } }
    @Test fun otpFieldInteractionMatchesChrome() {
        content()
        val doc=CardWeb.document("OTPFieldWebStates.json")
        for((k,red) in listOf("runs" to false,"reduced" to true)) { val runs=doc.getJSONArray(k).objects();for((i,r) in runs.withIndex()) runCase(r,red,i==runs.size-1) }
        AccordionEvidence.log("otpfield-states",JSONObject().put("checks",checks).put("failures",failures.size).put("failureList",JSONArray(failures.take(300))).put("report",report))
        assertTrue("${failures.size} of $checks failed:\n"+failures.take(80).joinToString("\n"),failures.isEmpty())
    }
    private class Frame(val t:Double,val borders:List<String?>)
    private fun centre(part:String):Offset? = collector.snapshot().nodes.firstOrNull { it.name==part }?.bounds?.let { Offset(((it.x+it.width/2)*2).toFloat(),((it.y+it.height/2)*2).toFloat()) }
    private fun rgb(css:String)=Regex("[0-9.]+").findAll(css).map { it.value.toDouble() }.toList().take(3)
    private fun hex(h:String?)=h?.removePrefix("#")?.takeIf { it.length>=6 }?.let { s-> (0 until 3).map { s.substring(it*2,it*2+2).toInt(16).toDouble() } }
    private fun runCase(r:JSONObject,red:Boolean,last:Boolean) {
        val name=(if(red) "reduced/" else "")+r.getString("name")
        compose.mainClock.autoAdvance=true
        compose.onRoot().performMouseInput { moveTo(Offset(1400f,1600f),0) }
        form=AWCFormState(onSubmit={ events+=Triple(now(),"submit",null) })
        events.clear();values=emptyMap();collector.clear();reduced=red;run=r;epoch++;compose.waitForIdle()
        compose.mainClock.autoAdvance=false;compose.mainClock.advanceTimeBy(100);compose.waitForIdle();clock0=compose.mainClock.currentTime
        val phases=r.getJSONArray("phases").objects();val web=r.getJSONArray("events").objects()
        fun focused()=compose.onNode(isFocused())
        // Down and up at the same event time: pressKey holds 50 ms, which the injection adds to the test clock (Chrome's CDP key
        // press has no hold). Several presses go out in one dispatch, as Chrome's back-to-back keydowns land in one frame.
        fun key(k:Key,shift:Boolean=false,times:Int=1) { runCatching { focused().performKeyInput { repeat(times) { if(shift) withKeyDown(Key.ShiftLeft) { keyDown(k);keyUp(k) } else { keyDown(k);keyUp(k) } } } }.onFailure { android.util.Log.i("AWCAccordion","  $name key $k failed: $it") } }
        fun click(o:Offset?) { if(o==null) { check(false,"$name no target");return };compose.onRoot().performMouseInput { moveTo(o,0);press();release() } }
        fun paste(text:String) {
            clipboard?.text=text
            runCatching { focused().performSemanticsAction(SemanticsActions.PasteText) }.onFailure { check(false,"$name paste: $it") }
            clipboard?.text=null
        }
        val steps=mutableListOf<Pair<Double,()->Unit>>()
        for((i,ph) in phases.withIndex()) { val t=ph.getDouble("t");val label=ph.getString("label")
            val end=if(i+1<phases.size) phases[i+1].getDouble("t") else t+300
            val keystrokes=web.filter { it.getString("name") in setOf("mdInput","mdInvalidInput") && it.getDouble("t")>=t && it.getDouble("t")<end }.map { it.getDouble("t") }
            fun typing(text:String) { text.forEachIndexed { j,ch-> steps+=(keystrokes.getOrNull(j)?.let { maxOf(it,t) } ?: (t+33.0*j)) to { runCatching { focused().performTextInput(ch.toString()) }.onFailure { android.util.Log.i("AWCAccordion","  $name type $ch failed: $it") } } } }
            when(label) {
                "click-cell-3-lands-first-empty"->steps+=t to { click(centre("cell-3")) }
                "focus"->steps+=t to { click(centre("cell-0")) }
                "type-12"->typing("12"); "type-x-rejected"->typing("x"); "type-3456-complete"->typing("3456"); "overtype-last-7"->typing("7"); "type-a1!b"->typing("a1!b")
                "ArrowLeft"->steps+=t to { key(Key.DirectionLeft) }
                "Home"->steps+=t to { key(Key.MoveHome) }
                "End"->steps+=t to { key(Key.MoveEnd) }
                "Backspace-filled"->steps+=t to { key(Key.Backspace) }
                "Backspace-x3"->steps+=t to { key(Key.Backspace,times=3) }
                "Delete-at-0"->{ steps+=t to { key(Key.MoveHome) };steps+=(t+16) to { key(Key.Delete) } }
                "Tab-out-commits"->steps+=t to { key(Key.Tab) }
                "paste-12-34-56x"->steps+=t to { paste(" 12-34 56x") }
                "paste-same-again"->steps+=t to { paste("123456") }
                else->check(false,"$name unknown phase $label")
            }
        }
        steps.sortBy { it.first }
        val frames=mutableListOf<Frame>();var next=0
        val ends=mutableMapOf<String,Map<String,Map<String,Any?>>>()
        val endT=phases.last().getDouble("t")+300
        var phaseIdx=0
        while(now()<endT) {
            // One step per frame: a step's state change (focus, selection) reaches the composition before the next input.
            if(next<steps.size && now()>=steps[next].first) { steps[next].second();next++ }
            compose.mainClock.advanceTimeByFrame();compose.waitForIdle()
            while(phaseIdx+1<phases.size && now()>=phases[phaseIdx+1].getDouble("t")) phaseIdx++
            val cellsN=(0 until 12).map { values["cell-$it"]?.get("border") as? String }
            frames+=Frame(now(),cellsN)
            val ph=phases[phaseIdx];val lastS=ph.getJSONArray("samples").objects().lastOrNull()
            if(lastS!=null && now()<=ph.getDouble("t")+lastS.getDouble("t")+17) ends[ph.getString("label")]=values
        }
        // Motion: every cell's border colour in each Chrome frame inside the native envelope (±2 frames).
        for(ph in phases) { val label=ph.getString("label");var bad=0;var n=0
            for(s in ph.getJSONArray("samples").objects()) { val t=ph.getDouble("t")+s.getDouble("t")
                val window=frames.filter { it.t>=t-40 && it.t<=t+34 }
                for((k,c) in s.getJSONArray("cells").objects().withIndex()) { val want=rgb(c.getString("bc"));val got=window.mapNotNull { hex(it.borders.getOrNull(k)) }
                    if(got.isEmpty()) continue;n++
                    if((0 until 3).any { ch-> want[ch]<got.minOf { it[ch] }-3 || want[ch]>got.maxOf { it[ch] }+3 }) { bad++
                        if(bad<=3) android.util.Log.i("AWCAccordion","  $name $label t=${s.getDouble("t")} cell $k want $want got ${window.map { "%.0f:%s".format(it.t-ph.getDouble("t"),it.borders.getOrNull(k)) }}") } } }
            check(bad==0,"$name $label motion: $bad/$n frames outside the envelope");report.put(JSONObject().put("run",name).put("phase",label).put("frames",n).put("outside",bad))
            val lastS=ph.getJSONArray("samples").objects().lastOrNull() ?: continue;val v=ends[label] ?: continue
            check(v["md-otp-field"]?.get("value")==lastS.getString("value"),"$name $label value ${v["md-otp-field"]?.get("value")} vs ${lastS.getString("value")}")
            val active=if(lastS.isNull("active")) -1 else lastS.getInt("active")
            check(((v["md-otp-field"]?.get("focusedIndex") as? Int) ?: -1)==active,"$name $label focused cell ${v["md-otp-field"]?.get("focusedIndex")} vs $active")
            for((k,c) in lastS.getJSONArray("cells").objects().withIndex()) { val cell=v["cell-$k"]
                check(cell?.get("text")==c.getString("v"),"$name $label cell $k text ${cell?.get("text")} vs ${c.getString("v")}")
                check((cell?.get("borderWidth") as? Double)==c.getDouble("bw"),"$name $label cell $k border width ${cell?.get("borderWidth")} vs ${c.getDouble("bw")}")
                val g=hex(cell?.get("border") as? String);val w=rgb(c.getString("bc"))
                check(g!=null && (0 until 3).all { abs(g[it]-w[it])<=3 },"$name $label cell $k border ${cell?.get("border")} vs ${c.getString("bc")}") }
        }
        // Teardown: Chrome's next run replaces the field, which blurs it (a pending change commits). The page's last run is not replaced.
        compose.mainClock.autoAdvance=true
        if(!last) { compose.runOnIdle { controller.runtimeBlur() };compose.waitForIdle() }
        check(events.size==web.size,"$name ${events.size} events vs ${web.size}: ${events.map { it.second+" "+it.third }}")
        for((i,w) in web.withIndex()) { val e=events.getOrNull(i) ?: break
            check(e.second==w.getString("name"),"$name event $i ${e.second} vs ${w.getString("name")}")
            val d=w.opt("detail")
            when(d) { is String->check(e.third==d,"$name event $i ${e.second} detail ${e.third} vs $d")
                is JSONObject->{ val m=e.third as? Map<*,*>;check(m!=null && d.keys().asSequence().all { k-> m[k]==d.get(k) },"$name event $i ${e.second} detail $m vs $d") } }
        }
        compose.runOnIdle { controller.runtimeBlur() }
    }
}
