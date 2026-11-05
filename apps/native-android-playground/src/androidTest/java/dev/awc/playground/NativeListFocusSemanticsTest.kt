@file:OptIn(androidx.compose.ui.test.ExperimentalTestApi::class)
package dev.awc.playground

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.unit.dp
import dev.awc.nativeui.*
import org.junit.Rule
import org.junit.Test

/** md-list: the keyboard (roving) focus is reported to accessibility services, as Web reports the focused option. */
class NativeListFocusSemanticsTest {
    @get:Rule val compose = createComposeRule()
    private var mode by mutableStateOf("single-select")
    @Test fun keyboardFocusedRowReportsFocus() {
        compose.setContent { AWCTheme(darkTheme = false) { key(mode) { Column(Modifier.padding(24.dp).width(360.dp)) {
            AWCComponent("md-button", mapOf("variant" to "text", "label" to "Before"))
            AWCComponent("md-list", mapOf("selectionMode" to mode)) { slot -> if (slot == "") for (t in listOf("Design review", "Prototype", "Release")) AWCComponent("md-list-item", mapOf("headline" to t)) }
        } } } }
        for (m in listOf("single-select", "multi-select")) {
            mode = m; compose.waitForIdle()
            compose.onNode(hasText("Before") and hasClickAction()).requestFocus(); compose.waitForIdle()
            compose.onNode(hasText("Before") and hasClickAction()).performKeyInput { pressKey(Key.Tab) }; compose.waitForIdle()
            compose.onNode(hasText("Design review")).assertIsFocused()
            compose.onNode(hasText("Prototype")).assertIsNotFocused()
            compose.onNode(hasText("Design review")).performKeyInput { pressKey(Key.DirectionDown) }; compose.waitForIdle()
            compose.onNode(hasText("Prototype")).assertIsFocused()
            compose.onNode(hasText("Design review")).assertIsNotFocused()
        }
    }
}
