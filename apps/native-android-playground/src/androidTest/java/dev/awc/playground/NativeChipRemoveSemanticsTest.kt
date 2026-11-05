package dev.awc.playground

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.unit.dp
import dev.awc.nativeui.*
import org.junit.Rule
import org.junit.Test

/** md-chip's remove button is its own (disabled) button in every state, as on Web; its name never joins the chip's name. */
class NativeChipRemoveSemanticsTest {
    @get:Rule val compose = createComposeRule()
    private var props by mutableStateOf(mapOf<String, Any?>("label" to "Design system", "variant" to "input"))
    @Test fun removeButtonStaysItsOwnElement() {
        compose.setContent { AWCTheme(darkTheme = false) { Box(Modifier.padding(24.dp)) { AWCComponent("md-chip", props) } } }
        for (state in listOf(null, "disabled", "softDisabled")) {
            props = mapOf<String, Any?>("label" to "Design system", "variant" to "input") + (state?.let { mapOf(it to true) } ?: emptyMap()); compose.waitForIdle()
            compose.onAllNodes(hasContentDescription("Remove Design system")).assertCountEquals(1)
            compose.onNode(hasContentDescription("Remove Design system")).assert(SemanticsMatcher.expectValue(SemanticsProperties.Role, Role.Button))
            compose.onNode(hasText("Design system") and hasContentDescription("Remove Design system")).assertDoesNotExist()
            if (state != null) compose.onNode(hasContentDescription("Remove Design system")).assertIsNotEnabled()
        }
    }
}
