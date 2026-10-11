@file:OptIn(androidx.compose.ui.test.ExperimentalTestApi::class)
package dev.awc.playground

import androidx.compose.foundation.layout.Column
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import dev.awc.nativeui.*
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test

class NativeAutomaticFormTest {
    @get:Rule val compose = createComposeRule()

    @Test fun automaticFieldValidationResetAndSuccessfulDataNeedNoManualBindings() {
        lateinit var form: AWCFormState
        val submissions = mutableListOf<AWCFormSubmission>(); val input = mutableListOf<String>()
        compose.setContent { AWCTheme {
            form = rememberAWCFormState(onSubmit = { submissions += it })
            AWCFormScope(form) { Column {
                AWCComponent("md-text-field", mapOf("name" to "name", "label" to "Name", "value" to "Ada", "required" to true), onEvent = { event, _ -> input += event })
                AWCComponent("md-checkbox", mapOf("name" to "flag", "checked" to true, "value" to "yes"))
                AWCComponent("md-text-field", mapOf("name" to "excluded", "value" to "hidden", "disabled" to true))
                AWCComponent("md-button", mapOf("type" to "submit", "label" to "Submit"))
            } }
        } }
        compose.onAllNodes(hasSetTextAction())[0].performTextReplacement("")
        compose.onNodeWithText("Submit").performClick()
        compose.onNodeWithText("This field is required").assertExists()
        compose.onAllNodes(hasSetTextAction())[0].performTextReplacement("Grace")
        compose.onNodeWithText("This field is required").assertDoesNotExist()
        compose.onNodeWithText("Submit").performClick()
        compose.runOnIdle { assertEquals(listOf(AWCFormEntry("name", "Grace"), AWCFormEntry("flag", "yes")), submissions.last().entries); input.clear(); form.reset() }
        compose.onAllNodes(hasSetTextAction())[0].assertTextContains("Ada")
        compose.runOnIdle { assertTrue("Reset must not fabricate edit events", input.isEmpty()) }
    }

    @Test fun hardwareEnterAndImeUseCancelableDefaultButtonAndNeverSkipBlockedFirst() {
        var blocked by mutableStateOf(true); var cancel by mutableStateOf(false)
        var submits = 0; val clicked = mutableListOf<String>()
        compose.setContent { AWCTheme {
            val form = rememberAWCFormState(onSubmit = { submits++ })
            AWCFormScope(form) { AWCActionScope(onAction = { if (cancel) it.preventDefault() }) { Column {
                AWCComponent("md-text-field", mapOf("name" to "name", "label" to "Name", "value" to "Ada", "required" to true))
                AWCComponent("md-button", mapOf("label" to "First", "type" to "submit", "disabled" to blocked), onEvent = { name, _ -> if (name == "mdClick") clicked += "first" })
                AWCComponent("md-button", mapOf("label" to "Second", "type" to "submit"), onEvent = { name, _ -> if (name == "mdClick") clicked += "second" })
            } } }
        } }
        val field = compose.onNode(hasSetTextAction())
        field.performClick().performKeyInput { pressKey(Key.Enter) }
        compose.runOnIdle { assertEquals(0, submits); assertTrue(clicked.isEmpty()); blocked = false; cancel = true }
        field.performImeAction()
        compose.runOnIdle { assertEquals(0, submits); assertEquals(listOf("first"), clicked); cancel = false }
        field.performKeyInput { pressKey(Key.Enter) }
        compose.runOnIdle { assertEquals(1, submits); assertEquals(listOf("first", "first"), clicked) }
    }

    @Test fun nativeFormEventCancellationRetainsResetValuesAndBlocksSubmission() {
        val events = mutableListOf<String>()
        compose.setContent { AWCTheme { AWCButtonBehaviorDemo(onEvent = { event, _ -> events += event }) } }
        compose.onNode(hasSetTextAction()).performTextReplacement("Grace")
        compose.onNodeWithContentDescription("Cancel form events").performClick()
        compose.onNodeWithText("Submit").performClick()
        compose.onNodeWithText("Status: Submit canceled").assertExists()
        compose.onNodeWithText("Reset").performClick()
        compose.onNode(hasSetTextAction()).assertTextContains("Grace")
        compose.runOnIdle { assertFalse(events.contains("mdSubmit")); assertFalse(events.contains("mdReset")) }
        compose.onNodeWithContentDescription("Cancel form events").performClick()
        compose.onNodeWithText("Reset").performClick()
        compose.onNode(hasSetTextAction()).assertTextContains("Ada")
    }

    @Test fun explicitOwnerRegistersSiblingControlsAndRadioChangesCoordinate() {
        lateinit var form: AWCFormState
        var external by mutableStateOf(false)
        compose.setContent { AWCTheme { AWCFormRegistryScope {
            form = rememberAWCFormState()
            Column {
                AWCFormScope(form, id = "account") { Text("Account form") }
                AWCFormOwnerScope("account") {
                    AWCComponent("md-text-field", mapOf("name" to "outside", "value" to "Owned"))
                    AWCComponent("md-radio", mapOf("name" to "team", "value" to "one", "checked" to true, "required" to true)) { Text("One") }
                    AWCComponent("md-radio", mapOf("name" to "team", "value" to "two", "checked" to external)) { Text("Two") }
                }
            }
        } } }
        compose.runOnIdle { assertEquals(listOf(AWCFormEntry("outside", "Owned"), AWCFormEntry("team", "one")), form.entries); external = true }
        compose.runOnIdle { assertEquals(listOf(AWCFormEntry("outside", "Owned"), AWCFormEntry("team", "two")), form.entries); assertTrue(form.validate()) }
        compose.onAllNodes(isSelectable())[0].performClick()
        compose.runOnIdle { assertEquals(AWCFormEntry("team", "one"), form.entries.last()) }
    }

    @Test fun numberDraftNormalizesOnEnterAndSubmitsWithoutButtonClick() {
        var submits = 0; var clicks = 0
        compose.setContent { AWCTheme {
            val form = rememberAWCFormState(onSubmit = { submits++; assertTrue(it.entries.isEmpty()) })
            AWCFormScope(form) { Column {
                AWCComponent("md-number-field", mapOf("name" to "amount", "value" to null, "steppers" to "none"))
                AWCComponent("md-button", mapOf("type" to "submit", "label" to "Send"), onEvent = { event, _ -> if (event == "mdClick") clicks++ })
            } }
        } }
        compose.onNode(hasSetTextAction()).performTextReplacement("-")
        compose.onNode(hasSetTextAction()).performImeAction()
        compose.onNode(hasSetTextAction()).assertTextEquals("")
        compose.runOnIdle { assertEquals(1, submits); assertEquals(0, clicks) }
    }

    @Test fun readOnlyRequiredFieldAllowsNativeSubmitAndKeepsItsValue() {
        val submissions = mutableListOf<AWCFormSubmission>()
        compose.setContent { AWCTheme {
            val form = rememberAWCFormState(onSubmit = { submissions += it })
            AWCFormScope(form) { Column {
                AWCComponent("md-text-field", mapOf("name" to "locked", "value" to "", "label" to "Read only", "readOnly" to true, "required" to true))
                AWCComponent("md-button", mapOf("type" to "submit", "label" to "Submit"))
            } }
        } }
        compose.onNodeWithText("Submit").performClick()
        compose.onNodeWithText("This field is required").assertDoesNotExist()
        compose.runOnIdle { assertEquals(listOf(AWCFormEntry("locked", "")), submissions.single().entries) }
    }
}
