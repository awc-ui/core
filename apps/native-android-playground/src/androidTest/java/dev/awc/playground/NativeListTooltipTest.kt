package dev.awc.playground

import androidx.compose.foundation.layout.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import dev.awc.nativeui.*
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

/** md-list-item truncation tooltips: the headline / supporting-text md-tooltip is enabled only while the text is
 *  clipped, opens through the shared md-tooltip renderer on hover, and a row that fits opens nothing. */
class NativeListTooltipTest {
    @get:Rule val compose=createComposeRule()
    private val long="A very long headline that cannot fit in the available inline size of this row"
    private val longSupporting="A deliberately long supporting sentence that has to wrap or clamp inside the row before it reaches the end"
    @Test fun clippedTextEnablesAndOpensTheMdTooltip() {
        val inspection=AWCListInspection();val checks=mutableListOf<Pair<Boolean,String>>()
        compose.setContent { CompositionLocalProvider(LocalDensity provides Density(2f,1f)) { AWCTheme(false) { AWCTooltipScope(Modifier.fillMaxSize()) {
            Box(Modifier.width(240.dp)) { AWCListInspectionScope(inspection) {
                AWCComponent("md-list",mapOf("label" to "Tips","id" to "list")) { slot-> if(slot=="") {
                    AWCComponent("md-list-item",mapOf("headline" to long,"supportingText" to longSupporting,"id" to "t"))
                    AWCComponent("md-list-item",mapOf("headline" to "Fits","supportingText" to "Short","id" to "u")) } }
            } }
        } } } }
        compose.waitForIdle()
        val t=inspection.rows["t"].orEmpty();val u=inspection.rows["u"].orEmpty()
        checks+=(t["headlineTooltip"]==true) to "clipped headline enables its tooltip ${t["headlineTooltip"]}"
        checks+=(t["supportingTooltip"]==true) to "clamped supporting text enables its tooltip ${t["supportingTooltip"]}"
        checks+=(u["headlineTooltip"]==false && u["supportingTooltip"]==false) to "a row that fits keeps both tooltips disabled $u"
        fun shown(text:String)=compose.onAllNodesWithText(text,useUnmergedTree=true).fetchSemanticsNodes().size
        val root=compose.onRoot().fetchSemanticsNode().boundsInRoot
        // md-tooltip's show/hide delays run on the main looper (real time), the motion on the frame clock.
        fun hover(p:Offset) { if(p!=Offset.Unspecified) compose.onRoot().performMouseInput { moveTo(p,0) };compose.mainClock.advanceTimeBy(600);compose.waitForIdle()
            Thread.sleep(900);compose.waitForIdle();compose.mainClock.advanceTimeBy(400);compose.waitForIdle() }
        // The enabled md-tooltip exposes its description as the anchor's accessibility action (the shared renderer);
        // a disabled one exposes none. Invoking it opens the popup with the full text.
        val actions=compose.onAllNodes(SemanticsMatcher.keyIsDefined(androidx.compose.ui.semantics.SemanticsActions.CustomActions),useUnmergedTree=true)
            .fetchSemanticsNodes().flatMap { it.config[androidx.compose.ui.semantics.SemanticsActions.CustomActions] }
        val open=actions.firstOrNull { it.label==long }
        checks+=(open!=null) to "the clipped headline's md-tooltip carries the full text (${actions.map { it.label }})"
        checks+=(actions.none { it.label=="Fits" || it.label=="Short" }) to "a row that fits has no enabled tooltip"
        fun popups()=compose.onAllNodes(SemanticsMatcher.keyIsDefined(androidx.compose.ui.semantics.SemanticsProperties.IsPopup),useUnmergedTree=true).fetchSemanticsNodes().size
        val before=popups()
        compose.runOnIdle { open?.action?.invoke() };hover(Offset.Unspecified)
        checks+=(before==0 && popups()==1) to "invoking it opens the md-tooltip popup ($before → ${popups()})"
        val failed=checks.filter { !it.first }.map { it.second }
        android.util.Log.i("AWCList","list-tooltips ${checks.size-failed.size}/${checks.size}")
        assertTrue(failed.joinToString("\n"),failed.isEmpty())
    }
}
