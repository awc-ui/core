package dev.awc.playground

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.performTextInput
import androidx.compose.ui.test.performClick
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.unit.dp
import dev.awc.nativeui.*
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

/**
 * S71-05: md-text-field members that no native test covered, read from the renderer's own inspection values and semantics:
 * enterKeyHint, autoCapitalize, spellcheck, showPasswordLabel, hidePasswordLabel, speechLang, pattern and the slots
 * clear-icon, password-toggle-icon, speech-icon. A renderer that ignores a member fails its case (mutation runs: story 9-8).
 */
class NativeTextFieldMembersTest {
    @get:Rule val compose=createComposeRule()
    @org.junit.Before @org.junit.After fun touchMode() { runCatching { androidx.test.platform.app.InstrumentationRegistry.getInstrumentation().setInTouchMode(true) } }
    private var props by mutableStateOf<Map<String,Any?>>(emptyMap())
    private var slots by mutableStateOf<Set<String>>(emptySet())
    private var epoch by mutableIntStateOf(0)
    private var formatting by mutableStateOf<AWCTextFieldFormatting?>(null)
    private val events=mutableListOf<Pair<String,Any?>>()
    private var values:Map<String,Map<String,Any?>> = emptyMap()
    private val collector=AWCInspectionCollector()
    private val controller=AWCTextFieldController()
    private var checks=0;private val failures=mutableListOf<String>()
    private fun check(ok:Boolean,label:String) { checks++;if(!ok) failures+=label }
    private fun settle() { repeat(3) { compose.waitForIdle();compose.mainClock.advanceTimeBy(64) };compose.waitForIdle() }
    private fun show(p:Map<String,Any?>,s:Set<String> = emptySet()) { values=emptyMap();props=p;slots=s;epoch++;settle() }
    private fun v(part:String,key:String)=values[part]?.get(key)
    private fun content() { compose.setContent {
        AWCTheme(false) { Box(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.surface)) { key(epoch) { Box(Modifier.absoluteOffset(24.dp,24.dp).width(320.dp)) {
            AWCFieldReducedMotionScope(true) { AWCTextFieldInspectionScope({ values=it }) { AWCInspectionScope(collector) { AWCTextFieldControllerScope(controller) { AWCTextFieldFormattingScope(formatting ?: AWCTextFieldFormatting()) {
                AWCComponent("md-text-field",props,onEvent={ n,d-> events+=n to d },content={ name-> if(name in slots) Box(Modifier.size(12.dp).testTag("slot-$name")) })
            } } } } }
        } } } }
    } }
    private fun finish(name:String) {
        AccordionEvidence.log(name,JSONObject().put("checks",checks).put("failures",failures.size).put("failureList",JSONArray(failures)))
        assertTrue("${failures.size} of $checks failed:\n"+failures.joinToString("\n"),failures.isEmpty())
    }
    @Test fun keyboardHints() {
        content()
        show(mapOf("label" to "Q","enterKeyHint" to "search","autoCapitalize" to "words","spellcheck" to false))
        check(v("input","imeAction")==ImeAction.Search.toString(),"enterKeyHint search ${v("input","imeAction")}")
        check(v("input","capitalization")==KeyboardCapitalization.Words.toString(),"autoCapitalize words ${v("input","capitalization")}")
        check(v("input","autoCorrect")==false,"spellcheck false ${v("input","autoCorrect")}")
        show(mapOf("label" to "Q","enterKeyHint" to "go","autoCapitalize" to "characters","spellcheck" to true))
        check(v("input","imeAction")==ImeAction.Go.toString(),"enterKeyHint go ${v("input","imeAction")}")
        check(v("input","capitalization")==KeyboardCapitalization.Characters.toString(),"autoCapitalize characters ${v("input","capitalization")}")
        check(v("input","autoCorrect")==true,"spellcheck true ${v("input","autoCorrect")}")
        show(mapOf("label" to "Q"))
        check(v("input","imeAction")==ImeAction.Done.toString() && v("input","capitalization")==KeyboardCapitalization.None.toString() && v("input","autoCorrect")==true,"hint defaults")
        finish("textfield-members-hints")
    }
    @Test fun passwordLabelsAndSpeechLang() {
        content()
        show(mapOf("label" to "P","type" to "password","passwordToggle" to true,"value" to "secret","showPasswordLabel" to "Mostrar","hidePasswordLabel" to "Ocultar"))
        check(v("password-toggle","label")=="Mostrar","showPasswordLabel ${v("password-toggle","label")}")
        compose.onNodeWithContentDescription("Mostrar").performClick();settle()
        check(v("password-toggle","label")=="Ocultar","hidePasswordLabel ${v("password-toggle","label")}")
        compose.onNodeWithContentDescription("Ocultar").assertIsDisplayed()
        show(mapOf("label" to "P","type" to "password","passwordToggle" to true,"value" to "secret"))
        check(v("password-toggle","label")=="Show password","showPasswordLabel default ${v("password-toggle","label")}")
        show(mapOf("label" to "V","speechToText" to true,"speechLang" to "ro-RO"))
        check(v("speech","lang")=="ro-RO","speechLang ${v("speech","lang")}")
        show(mapOf("label" to "V","speechToText" to true))
        check(v("speech","lang")=="","speechLang default ${v("speech","lang")}")
        finish("textfield-members-labels")
    }
    @Test fun slots() {
        content()
        for((slot,p) in listOf("clear-icon" to mapOf<String,Any?>("clearable" to true,"value" to "x"),
            "password-toggle-icon" to mapOf("type" to "password","passwordToggle" to true,"value" to "x"),"speech-icon" to mapOf("speechToText" to true))) {
            show(p+("label" to "S"),setOf(slot))
            val present=runCatching { compose.onNodeWithTag("slot-$slot",useUnmergedTree=true).assertIsDisplayed() }.isSuccess
            check(present,"slot $slot rendered")
            show(p+("label" to "S"))
            check(runCatching { compose.onNodeWithTag("slot-$slot",useUnmergedTree=true).assertIsDisplayed() }.isFailure,"slot $slot absent without content")
        }
        finish("textfield-members-slots")
    }
    @Test fun pattern() {
        content()
        show(mapOf("label" to "Z","pattern" to "[a-z]+","value" to "ABC"));compose.runOnIdle { check(!controller.checkValidity(),"pattern rejects ABC") }
        show(mapOf("label" to "Z","pattern" to "[a-z]+","value" to "abc"));compose.runOnIdle { check(controller.checkValidity(),"pattern accepts abc") }
        show(mapOf("label" to "Z","value" to "ABC"));compose.runOnIdle { check(controller.checkValidity(),"no pattern accepts ABC") }
        finish("textfield-members-pattern")
    }
    @Test fun parserFormatOnAndRole() {
        content()
        formatting=AWCTextFieldFormatting({ it.uppercase() },{ it.lowercase() })
        for((fo,shown) in listOf("input" to "AB","blur" to "ab")) {
            show(mapOf("label" to "F","formatOn" to fo));events.clear()
            compose.onNode(hasSetTextAction()).performTextInput("Ab");settle()
            check(v("input","value")==shown,"formatOn $fo shows $shown got ${v("input","value")}")
            if(fo=="input") { val last=events.lastOrNull { it.first=="mdInput" }?.second;check(last=="ab","parser detail ab got $last") }
        }
        formatting=null
        show(mapOf("label" to "C","inputRole" to "combobox","inputExpanded" to true,"inputAriaAutocomplete" to "list"))
        check(v("input","role")=="combobox","inputRole combobox ${v("input","role")}");check(v("input","expanded")=="true","inputExpanded true ${v("input","expanded")}")
        check(v("input","ariaAutocomplete")=="list","inputAriaAutocomplete list ${v("input","ariaAutocomplete")}")
        show(mapOf("label" to "C","inputRole" to "combobox","inputExpanded" to false))
        check(v("input","expanded")=="false","inputExpanded false ${v("input","expanded")}")
        show(mapOf("label" to "C"))
        check(v("input","role")=="textbox" && v("input","expanded")=="none" && v("input","ariaAutocomplete")=="","inputRole defaults")
        finish("textfield-members-format-role")
    }
    @Test fun speechResultEvent() {
        content()
        show(mapOf("label" to "V","speechToText" to "external"));events.clear()
        compose.onNodeWithContentDescription("Start voice input").performClick();settle()
        var sp=events.filter { it.first=="mdSpeechResult" }
        check(sp.size==1 && (sp.last().second as? Map<*,*>)?.get("listening")==true && (sp.last().second as? Map<*,*>)?.get("transcript")=="","mdSpeechResult start ${sp}")
        compose.onNodeWithContentDescription("Stop listening").performClick();settle()
        sp=events.filter { it.first=="mdSpeechResult" }
        check(sp.size==2 && (sp.last().second as? Map<*,*>)?.get("listening")==false,"mdSpeechResult stop ${sp}")
        finish("textfield-members-speech-result")
    }
}
