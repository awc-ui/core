package dev.awc.playground

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.requiredSize
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.test.junit4.createComposeRule
import dev.awc.nativeui.*
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

/**
 * md-autocomplete lifecycle and methods, as the source's own contract tests state them (md-autocomplete.api.spec.ts,
 * md-autocomplete.spec.ts): showMenu / closeMenu (no-op while disabled or already closed, focus stays where it is), loadOptions
 * (replaces the list; an empty list; an options update replaces loaded options), getLabels (a plain map; an unknown value is
 * its own label), the value in single and multiple mode, the spinner while loading, the clear affordance kept mounted while
 * empty, the validity API with mdValidityChange, retained property updates, and unmounting while open then remounting.
 */
class NativeAutocompleteLifecycleTest {
    @get:Rule val compose=createComposeRule()
    private val fruit=listOf<AWCValue>(mapOf("value" to "a","label" to "Apple"),mapOf("value" to "b","label" to "Apricot"),
        mapOf("value" to "c","label" to "Avocado","disabled" to true),mapOf("value" to "d","label" to "Banana"))
    private var props by mutableStateOf(mapOf<String,AWCValue>("id" to "m","label" to "Fruit","options" to fruit))
    private var mounted by mutableStateOf(true)
    private val controller=AWCAutocompleteController()
    private val collector=AWCInspectionCollector()
    private val selectInspection=AWCSelectInspection()
    private val events=mutableListOf<Pair<String,Any?>>()
    private var checks=0;private val failures=mutableListOf<String>()
    private fun check(ok:Boolean,label:String) { checks++;if(!ok) failures+=label }
    private fun state()=selectInspection.states["m"] ?: emptyMap()
    private fun count(name:String)=events.count { it.first==name }
    private fun part(name:String)=collector.snapshot().nodes.firstOrNull { it.id=="m.$name" }
    private fun settle(ms:Long=300) { compose.waitForIdle();compose.mainClock.advanceTimeBy(ms);compose.waitForIdle() }
    private fun set(vararg p:Pair<String,AWCValue>) { props=props+p;settle(150) }
    @Test fun autocompleteLifecycleAndMethods() {
        compose.setContent { AWCTheme(false) { Box(Modifier.requiredSize(600.dp,600.dp)) {
            AWCMenuScope(rememberAWCMenuScopeState(),Modifier.requiredSize(600.dp,600.dp)) {
                AWCAutocompleteControllerScope(controller) { AWCMenuReducedMotionScope(true) { AWCFieldReducedMotionScope(true) { AWCSelectInspectionScope(selectInspection) {
                    if(mounted) Box(Modifier.padding(24.dp).width(320.dp)) { AWCInspectionScope(collector,"m") {
                        AWCComponent("md-autocomplete",props,onEvent={ n,d-> if(n.startsWith("md")) events+=n to d }) } }
                } } } }
            } } } }
        // The loading spinner animates forever: the clock advances only when the test says so.
        compose.mainClock.autoAdvance=false
        settle(600)
        val c=controller
        check(c.isConnected,"the controller attaches to the mounted autocomplete")
        compose.runOnIdle { c.showMenu() };settle()
        check(state()["open"]==true && count("mdOpen")==1,"showMenu opens (mdOpen): ${state()["open"]} ${events.map { it.first }}")
        check(state()["focused"]!=true,"showMenu does not take focus")
        check(state()["status"]=="4 suggestions available","status with every option: ${state()["status"]}")
        compose.runOnIdle { c.closeMenu() };settle()
        check(state()["open"]==false && count("mdClose")==1,"closeMenu closes (mdClose)")
        compose.runOnIdle { c.closeMenu() };settle(200)
        check(count("mdClose")==1,"closing an already-closed menu is a no-op")
        set("disabled" to true);compose.runOnIdle { c.showMenu() };settle(200)
        check(state()["open"]==false && count("mdOpen")==1,"showMenu refuses to open while disabled")
        set("disabled" to false)
        compose.runOnIdle { c.focusInput() };settle(150);compose.runOnIdle { c.showMenu() };settle()
        check(state()["focused"]==true && state()["open"]==true,"opens without stealing focus from the input")
        compose.runOnIdle { c.closeMenu() };settle()
        compose.runOnIdle { c.loadOptions(listOf(mapOf("value" to "kiwi"),mapOf("value" to "lime","label" to "Lime","description" to "Citrus")));c.showMenu() };settle()
        check(state()["status"]=="2 suggestions available","loadOptions replaces the dataset: ${state()["status"]}")
        compose.runOnIdle { c.loadOptions(emptyList()) };settle(150)
        check(state()["status"]=="0 suggestions available","an empty dataset: ${state()["status"]}")
        compose.runOnIdle { c.loadOptions(listOf(mapOf("value" to "kiwi"),mapOf("value" to "lime","label" to "Lime"))) };settle(100)
        val labels=compose.runOnIdle { c.getLabels(listOf("lime","kiwi","zz")) }
        check(labels==mapOf("lime" to "Lime","kiwi" to "kiwi","zz" to "zz"),"getLabels returns a plain map, unknown values echo: $labels")
        set("options" to fruit+listOf<AWCValue>(mapOf("value" to "e","label" to "Elderberry")))
        check(state()["status"]=="5 suggestions available","an options update replaces the loaded list: ${state()["status"]}")
        compose.runOnIdle { c.closeMenu() };settle()
        set("value" to "b")
        check(state()["value"]=="b" && state()["inputValue"]=="Apricot","a bare string value in single mode shows its label: ${state()["value"]} ${state()["inputValue"]}")
        check(compose.runOnIdle { c.getLabels(listOf("b")) }==mapOf("b" to "Apricot"),"getLabels reads option labels")
        check(part("clear")!=null,"the clear affordance is mounted with a value")
        set("multiple" to true,"value" to listOf("a","d"))
        check(state()["value"]==listOf("a","d"),"an array in multiple mode: ${state()["value"]}")
        check(part("chip-0")!=null && part("chip-1")!=null && part("chip-2")==null,"a chip per value")
        set("multiple" to false,"value" to "")
        check(part("clear")!=null,"the clear affordance stays mounted while empty (hidden)")
        set("loading" to true)
        check(part("loading-spinner")!=null && part("caret")==null,"the spinner replaces the caret while loading")
        set("loading" to false)
        check(part("caret")!=null,"the caret returns")
        val before=count("mdValidityChange")
        set("required" to true)
        val v1=compose.runOnIdle { c.getValidity() }
        check(!v1.valid && v1.flags["valueMissing"]==true && v1.validationMessage=="Please make a selection","required without a value: valueMissing ($v1)")
        check(count("mdValidityChange")>before,"mdValidityChange on the validity change")
        set("errorText" to "Pick a fruit")
        check(compose.runOnIdle { c.getValidity() }.validationMessage=="Pick a fruit","errorText wins over valueMissingLabel")
        compose.runOnIdle { c.setCustomValidity("Out of season") };settle(100)
        val v2=compose.runOnIdle { c.getValidity() }
        check(v2.flags["customError"]==true && v2.validationMessage=="Out of season","a custom error ($v2)")
        compose.runOnIdle { c.setCustomValidity("") };settle(100)
        compose.runOnIdle { c.reportValidity() };settle(200)
        check(state()["focused"]==true && state()["valid"]==false,"reportValidity focuses the invalid input")
        set("value" to "a")
        check(compose.runOnIdle { c.checkValidity() } && state()["valid"]==true,"a value satisfies required")
        compose.runOnIdle { c.showMenu() };settle()
        mounted=false;settle()
        check(collector.snapshot().nodes.none { it.id.startsWith("m::menu") },"unmounting while open removes the menu")
        mounted=true;settle(400)
        check(c.isConnected && state()["open"]==false && state()["value"]=="a","remounts closed with its value: ${state()}")
        android.util.Log.i("AWCSelect","ac-lifecycle ${checks-failures.size}/$checks")
        assertTrue("${failures.size} of $checks failed:\n"+failures.joinToString("\n"),failures.isEmpty())
    }
}
