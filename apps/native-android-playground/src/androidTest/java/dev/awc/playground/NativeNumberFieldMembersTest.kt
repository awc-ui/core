package dev.awc.playground

import androidx.compose.foundation.layout.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import dev.awc.nativeui.*
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test

/**
 * md-number-field members with no Chrome phase (S71-02, S71-05): stepUp / stepDown after retained step, min, max and snapOnStep updates,
 * snapOnStep, allowOutOfRange and the stepper labels. Same cases as the SwiftUI NativeNumberFieldStatesIntegration `members()`.
 */
@OptIn(ExperimentalTestApi::class)
class NativeNumberFieldMembersTest {
    @get:Rule val compose=createComposeRule()
    @org.junit.Before @org.junit.After fun touchMode() { runCatching { androidx.test.platform.app.InstrumentationRegistry.getInstrumentation().setInTouchMode(true) } }
    private val base:Map<String,Any?> = mapOf("label" to "Team","value" to 7.0,"min" to 0.0,"max" to 10.0,"variant" to "outlined")
    private var props by mutableStateOf(base)
    private var epoch by mutableIntStateOf(0)
    private var values:Map<String,Map<String,Any?>> = emptyMap()
    private val controller=AWCNumberFieldController()
    private val collector=AWCInspectionCollector()
    private fun content() { compose.setContent { CompositionLocalProvider(LocalDensity provides Density(2f,1f)) { AWCTheme(false) { key(epoch) {
        Box(Modifier.absoluteOffset(24.dp,24.dp).width(320.dp)) { AWCNumberFieldInspectionScope({ values=it }) { AWCInspectionScope(collector) { AWCNumberFieldControllerScope(controller) {
            AWCComponent("md-number-field",props,onEvent={ _,_-> }) } } } } } } } } }
    private fun create(extra:Map<String,Any?> = emptyMap()) { props=base+extra;epoch++;compose.waitForIdle();settle() }
    private fun retain(extra:Map<String,Any?>) { props=props+extra;settle() }
    private fun settle() { repeat(3) { compose.waitForIdle() } }
    private fun value():Double? = values["md-number-field"]?.get("value") as? Double
    private fun steps(vararg ops:Int):List<Double?> = ops.map { op-> compose.runOnIdle { if(op>0) controller.stepUp() else controller.stepDown() };settle();value() }
    private fun typed(extra:Map<String,Any?>):Double? { create(extra);compose.runOnIdle { controller.select() };compose.onNode(hasSetTextAction()).performTextInput("250")
        compose.runOnIdle { controller.runtimeBlur() };settle();return value() }
    @Test fun numberFieldMembers() {
        content()
        create();retain(mapOf("step" to 2.0));assertEquals("stepUp, stepUp, stepDown after a step update",listOf<Double?>(9.0,10.0,8.0),steps(1,1,-1))
        create(mapOf("step" to 2.0));assertEquals("the same steps on a created field",listOf<Double?>(9.0,10.0,8.0),steps(1,1,-1))
        create();retain(mapOf("max" to 8.0));assertEquals("stepUp after a max update",listOf<Double?>(8.0,8.0),steps(1,1))
        create(mapOf("value" to 6.0));retain(mapOf("min" to 5.0));assertEquals("stepDown after a min update",listOf<Double?>(5.0,5.0),steps(-1,-1))
        create(mapOf("step" to 2.0));retain(mapOf("snapOnStep" to true));assertEquals("snapOnStep after an update",listOf<Double?>(8.0,6.0),steps(1,-1))
        create(mapOf("step" to 2.0));assertEquals("snapOnStep off",listOf<Double?>(9.0),steps(1))
        assertEquals("allowOutOfRange keeps a typed value past max",250.0,typed(mapOf("value" to 5.0,"max" to 100.0,"allowOutOfRange" to true)))
        assertEquals("allowOutOfRange off clamps to max",100.0,typed(mapOf("value" to 5.0,"max" to 100.0)))
        create(mapOf("incrementLabel" to "Plus one","decrementLabel" to "Minus one"))
        compose.onNode(hasContentDescription("Plus one")).assertExists();compose.onNode(hasContentDescription("Minus one")).assertExists()
        retain(mapOf("incrementLabel" to "More","decrementLabel" to "Less"))
        compose.onNode(hasContentDescription("More")).assertExists();compose.onNode(hasContentDescription("Less")).assertExists()
        AccordionEvidence.log("numberfield-members",org.json.JSONObject().put("checks",12).put("failures",0))
    }
}
