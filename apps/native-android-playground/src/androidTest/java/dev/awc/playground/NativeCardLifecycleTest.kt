@file:OptIn(androidx.compose.ui.test.ExperimentalTestApi::class)
package dev.awc.playground

import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.layout.boundsInRoot
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.unit.dp
import androidx.compose.ui.zIndex
import dev.awc.nativeui.*
import dev.awc.playground.CardWeb.objects
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import kotlin.math.abs

/**
 * Native replay of the eighteen md-card lifecycle scenarios (web-lifecycle.json) through the
 * production AWCComponent dispatch with injected touch/key input. DOM-only mechanisms map to their
 * Compose equivalents: Modifier.awcCardInteractiveContent() for authored/shadow controls (a text
 * field passes activates=false: Enter/Space do not activate it, so no click bubbles), removal
 * from composition for disconnect, outer modifiers for authored inline styles, and ACTION_CANCEL
 * (the platform's only capture-loss signal) for pointercancel and lostpointercapture.
 */
class NativeCardLifecycleTest {
    @get:Rule val compose=createComposeRule()
    private var props by mutableStateOf(mapOf<String,Any?>("interactive" to true,"dragEnabled" to true))
    private var content by mutableStateOf("text");private var marked by mutableStateOf(true);private var shown by mutableStateOf(true)
    private var scaled by mutableStateOf(false);private var epoch by mutableIntStateOf(0);private var text by mutableStateOf("")
    private val events=mutableListOf<Pair<String,Map<*,*>>>();private var inspection:AWCCardInspection?=null
    private var onStart:(()->Unit)?=null;private val field=FocusRequester()
    private var checks=0;private val failures=mutableListOf<String>();private val report=JSONArray()
    private fun check(ok:Boolean,label:String) { checks++;if(!ok) failures+=label }
    private fun values()=inspection?.values ?: emptyMap()
    private fun names()=events.map { it.first }.filter { it in setOf("mdClick","mdDragStart","mdDragMove","mdDragEnd") }
    private fun setUp() { compose.setContent { AWCTheme { Column(Modifier.padding(40.dp)) { key(epoch) { if(shown) Box(Modifier.testTag("card").width(320.dp).graphicsLayer { if(scaled) { scaleX=.9f;scaleY=.9f } }.zIndex(if(scaled) 7f else 0f)) {
        AWCCardInspectionScope({ inspection=it }) {
            AWCComponent("md-card",props,onEvent={ n,v-> if(n.startsWith("md")) { events+=n to (v as? Map<*,*> ?: emptyMap<String,Any>());if(n=="mdDragStart") onStart?.invoke() } }) { slot-> if(slot=="") when(content) {
                "field"->BasicTextField(text,{ text=it },Modifier.width(200.dp).height(40.dp).awcCardInteractiveContent(activates=false).focusRequester(field))
                "button"->Button(onClick={},Modifier.testTag("authored").awcCardInteractiveContent()) { Text("Save") }
                "focusable"->Box(Modifier.size(120.dp,32.dp).then(if(marked) Modifier.awcCardInteractiveContent() else Modifier).focusable()) { Text("Custom control") }
                "nested"->Column { Text("Wrapper"); if(marked) Button(onClick={},Modifier.awcCardInteractiveContent()) { Text("Shadow action") } }
                "empty"->{}
                else->Text("Content",Modifier.height(40.dp))
            } }
        }
    } } } } } }
    private fun make(kind:String="text",scale:Boolean=false) {
        props=mapOf("interactive" to true,"dragEnabled" to true);content=kind;marked=true;shown=true;scaled=scale;text="";onStart=null;inspection=null
        events.clear();epoch++;compose.waitForIdle()
    }
    private fun card()=compose.onNodeWithTag("card")
    private fun record(scenario:String) { report.put(JSONObject().put("scenario",scenario).put("events",JSONArray(names())).put("role",values()["role"]).put("dragging",values()["dragging"]).put("offsetX",values()["offsetX"])) }
    private fun touch(block:TouchInjectionScope.()->Unit)=card().performTouchInput(block)
    @Test fun lifecycleScenariosMatchTheSource() {
        setUp()
        val web=CardWeb.document("CardWebLifecycle.json").getJSONArray("scenarios").objects().associateBy { it.getString("scenario") }
        check(web.size==18,"eighteen source scenarios")
        fun expected(name:String)=web.getValue(name).getJSONArray("events").objects().map { it.getString("type") }
        // Trusted CDP touch capture (laboratory/trusted-lifecycle): the clicks Chrome adds for physical
        // touch input, which the synthetic oracle cannot show. Touch is Android's pointer modality.
        val touchRuns=CardWeb.document("CardWebLifecycleTrusted.json").getJSONObject("modes").getJSONArray("touch").objects().associateBy { it.getString("scenario") }
        fun trusted(name:String)=touchRuns.getValue(name).getJSONArray("events").objects().map { it.getString("type") }
        val p=Offset(30f,30f)
        // authored-keyboard
        make("field");compose.runOnIdle { field.requestFocus() };compose.waitForIdle()
        compose.onRoot().performKeyInput { pressKey(Key.Spacebar);pressKey(Key.A) };compose.waitForIdle()
        check(names().isEmpty() && expected("authored-keyboard").isEmpty(),"authored-keyboard: no card events ${names()}")
        check(text==" a","authored-keyboard: keys reach the authored field unprevented (\"$text\")");record("authored-keyboard")
        // authored-pointer
        make("button");compose.onNodeWithTag("authored").performTouchInput { down(center);moveBy(Offset(30f*density,0f));up() };compose.waitForIdle()
        check("mdDragStart" !in names() && values()["dragging"]==false,"authored-pointer: no drag from authored content ${names()}")
        // Chrome cancels the touch tap after the 30-point move (trusted touch: no events); so does the Compose card.
        check(names().filter { it=="mdClick" || it=="click" }.isEmpty() && trusted("authored-pointer").none { it=="mdClick" || it=="click" },"authored-pointer: a moved touch does not click ${names()} vs ${trusted("authored-pointer")}")
        report.put(JSONObject().put("scenario","authored-pointer-trusted-touch").put("chrome",JSONArray(trusted("authored-pointer"))).put("native",JSONArray(names())));record("authored-pointer")
        // pointer-ownership: a second pointer never takes over the drag of the first.
        make();touch { down(1,p*density);down(2,Offset(150f,30f)*density);moveTo(2,Offset(200f,30f)*density);up(2);moveTo(1,(p+Offset(20f,0f))*density) };compose.waitForIdle()
        val own=events.filter { it.first=="mdDragStart" || it.first=="mdDragMove" }.map { it.second }
        check(names()==listOf("mdDragStart","mdDragMove") && own.all { abs((it["offsetX"] as Number).toDouble()-20)<.6 },"pointer-ownership: only the first pointer drags (${names()} $own)")
        check(abs((values()["offsetX"] as? Number ?: 0).toDouble()-20)<.6,"pointer-ownership: translate(20, 0)")
        touch { up(1) };compose.waitForIdle();record("pointer-ownership")
        // pointercancel / lostpointercapture (ACTION_CANCEL)
        for(name in listOf("pointercancel","lostpointercapture")) {
            make();touch { down(1,p*density);moveTo(1,(p+Offset(30f,0f))*density);cancel() };compose.waitForIdle()
            check(names()==expected(name) && (name!="pointercancel" || names()==trusted(name)),"$name: events ${names()} vs ${expected(name)}")
            check(values()["dragging"]==false && (values()["offsetX"] as Number).toDouble()==0.0,"$name: drag cleared without translation");record(name)
        }
        // toggle-* during a drag
        for((property,value) in listOf("disabled" to true,"softDisabled" to true,"dragEnabled" to false)) {
            make();touch { down(1,p*density);moveTo(1,(p+Offset(30f,0f))*density) };compose.waitForIdle()
            props=props+(property to value);compose.waitForIdle()
            touch { moveTo(1,(p+Offset(80f,0f))*density);up(1) };compose.waitForIdle()
            check(names()==expected("toggle-$property") && names()==trusted("toggle-$property"),"toggle-$property: events ${names()} vs ${expected("toggle-$property")} / trusted touch ${trusted("toggle-$property")}")
            check(values()["dragging"]==false && (values()["offsetX"] as Number).toDouble()==0.0,"toggle-$property: drag cleared");record("toggle-$property")
        }
        // authored-style-restoration: authored outer scale and stacking survive the drag.
        make(scale=true);val before=card().fetchSemanticsNode().boundsInRoot
        touch { down(1,p*density);moveTo(1,(p+Offset(30f,0f))*density);up(1) };compose.waitForIdle()
        val after=card().fetchSemanticsNode().boundsInRoot
        check(names()==listOf("mdDragStart","mdDragMove","mdDragEnd") && abs(after.width-before.width)<1 && abs(after.left-before.left)<1,"authored-style-restoration: authored scale kept ($before → $after)");record("authored-style-restoration")
        // generic-focusable
        make("focusable");check(values()["role"]=="","generic-focusable: container role");record("generic-focusable")
        // dynamic-attributes: the marker follows authored state (source attribute observation).
        make("focusable");marked=false;compose.waitForIdle();val initial=values()["role"]
        marked=true;compose.waitForIdle();val enabled=values()["role"];marked=false;compose.waitForIdle()
        check(initial=="button" && enabled=="" && values()["role"]=="button","dynamic-attributes: button → container → button ($initial, $enabled, ${values()["role"]})");record("dynamic-attributes")
        // reconnect-observation
        make("text");shown=false;compose.waitForIdle();shown=true;compose.waitForIdle();content="button";compose.waitForIdle()
        check(values()["role"]=="","reconnect-observation: container after reconnect");record("reconnect-observation")
        // reentrant-*
        for(mutation in listOf("disabled","dragEnabled","disconnect")) {
            make();onStart={ if(mutation=="disconnect") shown=false else props=props+(mutation to (mutation=="disabled")) }
            touch { down(1,p*density);moveTo(1,(p+Offset(30f,0f))*density) };compose.waitForIdle()
            if(mutation!="disconnect") { touch { moveTo(1,(p+Offset(50f,0f))*density);up(1) };compose.waitForIdle() }
            check(names()==expected("reentrant-$mutation") && names()==trusted("reentrant-$mutation"),"reentrant-$mutation: events ${names()} vs ${expected("reentrant-$mutation")} / trusted touch ${trusted("reentrant-$mutation")}")
            if(mutation=="disconnect") check(compose.onAllNodesWithTag("card").fetchSemanticsNodes().isEmpty(),"reentrant-disconnect: removed")
            else check(values()["dragging"]==false && (values()["offsetX"] as Number).toDouble()==0.0,"reentrant-$mutation: no translation")
            record("reentrant-$mutation")
        }
        // shadow-*: nested authored content is observed and released.
        make("nested");check(values()["role"]=="","shadow-control: nested control → container")
        marked=false;compose.waitForIdle();val hidden=values()["role"];marked=true;compose.waitForIdle()
        check(hidden=="button" && values()["role"]=="","shadow-attribute-observation: button while unavailable, container again ($hidden)")
        content="empty";compose.waitForIdle();check(values()["role"]=="button","shadow-detach: no stale observation after removal")
        for(name in listOf("shadow-control","shadow-attribute-observation","shadow-detach")) record(name)
        AccordionEvidence.log("card-lifecycle",JSONObject().put("checks",checks).put("failures",failures.size).put("failureList",JSONArray(failures)).put("report",report))
        assertTrue("${failures.size} of $checks failed:\n"+failures.joinToString("\n"),failures.isEmpty())
    }
}
