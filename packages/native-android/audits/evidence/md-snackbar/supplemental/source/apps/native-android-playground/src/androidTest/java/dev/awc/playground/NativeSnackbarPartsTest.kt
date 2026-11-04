package dev.awc.playground

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toPixelMap
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInRoot
import androidx.compose.ui.platform.*
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.unit.*
import dev.awc.nativeui.*
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import kotlin.math.abs

class NativeSnackbarPartsTest {
    @get:Rule val compose=createComposeRule()
    @Test fun signedCloseMarginActuallyOverlapsInBothLogicalDirections() {
        var rtl by mutableStateOf(false);var margin by mutableDoubleStateOf(0.0)
        val collector=AWCInspectionCollector()
        compose.setContent { CompositionLocalProvider(LocalDensity provides Density(1f),LocalLayoutDirection provides if(rtl) LayoutDirection.Rtl else LayoutDirection.Ltr) { AWCTheme(false) {
            AWCAccessibilityAppearanceScope(reducedMotion=true) { AWCSnackbarScope(Modifier.requiredSize(800.dp,240.dp)) {
                Box(Modifier.fillMaxSize())
                AWCSnackbarPartAppearanceScope(AWCSnackbarPartAppearance(marginInlineStart=margin),AWCSnackbarPart.Close) {
                    AWCInspectionScope(collector) { AWCComponent("md-snackbar",mapOf("open" to true,"autoHide" to false,"message" to "Saved","action" to "Undo","closeable" to true)) }
                }
            } }
        } } }
        for(direction in listOf(false,true)) for(value in listOf(0.0,-7.0,7.0)) {
            compose.runOnIdle { rtl=direction;margin=value };compose.waitForIdle()
            val nodes=compose.runOnIdle { collector.snapshot().nodes }
            val a=nodes.single { it.id=="component.actions" }.bounds;val c=nodes.single { it.id=="component.close" }.bounds
            assertEquals("Actual logical gap rtl=$direction",value,if(rtl) a.x-c.x-c.width else c.x-a.x-a.width,.01)
        }
    }

    @Test fun everyTypedPartPaintsItsAuthoredColorsBorderAndTextWeight() {
        var selected by mutableStateOf(AWCSnackbarPart.Surface);var rtl by mutableStateOf(false)
        val collector=AWCInspectionCollector();var px=0.0;var py=0.0
        compose.setContent { CompositionLocalProvider(LocalDensity provides Density(1f),LocalLayoutDirection provides if(rtl) LayoutDirection.Rtl else LayoutDirection.Ltr) { AWCTheme(false) {
            AWCAccessibilityAppearanceScope(reducedMotion=true) { AWCSnackbarScope(Modifier.requiredSize(800.dp,240.dp).background(Color.White).testTag("canvas").onGloballyPositioned { px=it.positionInRoot().x.toDouble();py=it.positionInRoot().y.toDouble() }) {
                Box(Modifier.fillMaxSize())
                AWCSnackbarPartAppearanceScope(AWCSnackbarPartAppearance(color="#0000CC",backgroundColor="#00CC00",borderColor="#CC0000",borderWidth=2.0,cornerShape=AWCCornerShape.uniform(4.0),fontWeight=700,paddingInlineStart=6.0,marginInlineStart=-7.0),selected) {
                    val slots=AWCSlotRegistry(mapOf<String,@Composable ()->Unit>("" to { AWCSlotText("Message") },"action" to { AWCSlotText("Action") })+if(selected==AWCSnackbarPart.CloseIcon) emptyMap() else mapOf<String,@Composable ()->Unit>("close" to { AWCSlotText("Close") }))
                    AWCSlotsScope(slots) { AWCInspectionScope(collector) { AWCComponent("md-snackbar",mapOf("open" to true,"autoHide" to false,"message" to "Fallback","action" to "Undo","closeable" to true)) } }
                }
            } }
        } } }
        for(direction in listOf(false,true)) for(part in AWCSnackbarPart.entries) {
            compose.runOnIdle { selected=part;rtl=direction };compose.waitForIdle()
            val name=when(part) { AWCSnackbarPart.CloseIcon->"close-icon";else->part.name.lowercase() }
            val b=compose.runOnIdle { collector.snapshot().nodes.single { it.id=="component.$name" }.bounds }
            val pixels=compose.onNodeWithTag("canvas").captureToImage().toPixelMap()
            fun painted(r:Float,g:Float,blue:Float):Boolean {
                for(y in maxOf(0,(b.y-py).toInt()) until minOf(pixels.height,(b.y-py+b.height).toInt()))
                    for(x in maxOf(0,(b.x-px).toInt()) until minOf(pixels.width,(b.x-px+b.width).toInt())) {
                        val c=pixels[x,y];if(maxOf(abs(c.red-r),abs(c.green-g),abs(c.blue-blue))<.08) return true
                    }
                return false
            }
            assertTrue("$part rtl=$rtl border paint",painted(.8f,0f,0f))
            assertTrue("$part rtl=$rtl background paint",painted(0f,.8f,0f))
            if(part!=AWCSnackbarPart.Actions && part!=AWCSnackbarPart.Close) assertTrue("$part rtl=$rtl glyph paint",painted(0f,0f,.8f))
            if(part!=AWCSnackbarPart.CloseIcon) {
                val label=when(part) { AWCSnackbarPart.Surface,AWCSnackbarPart.Message->"Message";AWCSnackbarPart.Actions->"Action";else->"Close" }
                val layouts=mutableListOf<TextLayoutResult>()
                compose.onNodeWithText(label,useUnmergedTree=true).performSemanticsAction(SemanticsActions.GetTextLayoutResult) { it(layouts) }
                assertEquals("$part real authored text weight",if(part==AWCSnackbarPart.Surface) 400 else 700,layouts.single().layoutInput.style.fontWeight!!.weight)
            }
        }
    }
}
