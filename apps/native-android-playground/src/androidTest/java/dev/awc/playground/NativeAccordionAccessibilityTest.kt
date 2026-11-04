package dev.awc.playground

import android.app.UiAutomation
import android.view.accessibility.AccessibilityNodeInfo
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.printToString
import androidx.compose.ui.unit.dp
import androidx.test.platform.app.InstrumentationRegistry
import dev.awc.nativeui.*
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test

/**
 * Real Android accessibility: the AccessibilityNodeInfo tree that TalkBack consumes,
 * fetched through UiAutomation (not Compose test semantics), and real accessibility
 * actions performed on those nodes.
 */
class NativeAccordionAccessibilityTest {
    @get:Rule val compose=createComposeRule()
    private val automation:UiAutomation by lazy { InstrumentationRegistry.getInstrumentation().getUiAutomation(UiAutomation.FLAG_DONT_SUPPRESS_ACCESSIBILITY_SERVICES) }
    private var checks=0
    private val evidence=JSONArray()
    private fun all():List<AccessibilityNodeInfo> {
        val out=mutableListOf<AccessibilityNodeInfo>()
        fun walk(n:AccessibilityNodeInfo?) { if(n==null) return;out+=n;for(i in 0 until n.childCount) walk(n.getChild(i)) }
        walk(automation.rootInActiveWindow);return out
    }
    private fun text(n:AccessibilityNodeInfo)=listOfNotNull(n.text?.toString(),n.contentDescription?.toString()).joinToString(" ")
    private fun descendants(n:AccessibilityNodeInfo):List<AccessibilityNodeInfo> = (0 until n.childCount).mapNotNull { n.getChild(it) }.flatMap { listOf(it)+descendants(it) }
    /** Compose exposes a merging header as a focusable heading node whose label comes from its
     * (non-focusable) Text descendants, with the Button role on a synthesized child node. */
    private fun header(name:String)=all().firstOrNull { it.isHeading && descendants(it).any { d-> d.text?.toString()==name } }
    private fun label(n:AccessibilityNodeInfo)=descendants(n).mapNotNull { it.text?.toString() }.joinToString(" ")
    private fun role(n:AccessibilityNodeInfo)=descendants(n).firstOrNull { it.className=="android.widget.Button" }?.className ?: n.className
    private fun present(fragment:String)=all().any { text(it).contains(fragment) }
    private fun eventually(label:String,condition:()->Boolean) {
        repeat(50) { compose.waitForIdle();if(runCatching(condition).getOrDefault(false)) { checks++;return };Thread.sleep(100) }
        fail("$label\n"+all().joinToString("\n") { "${it.className} '${text(it)}' heading=${it.isHeading} enabled=${it.isEnabled} state=${it.stateDescription} actions=${it.actionList.map { a->a.id }}" })
    }
    private fun describe(n:AccessibilityNodeInfo)=JSONObject().put("class",n.className).put("role",role(n).toString()).put("label",label(n)).put("heading",n.isHeading).put("enabled",n.isEnabled)
        .put("focusable",n.isFocusable).put("clickable",n.isClickable).put("state",n.stateDescription?.toString()).put("actions",JSONArray(n.actionList.map { it.id }))

    @Test fun androidNodeTreeExposesHeadingButtonsStateActionsAndHidesCollapsedPanelsAndIcons() {
        val log=mutableListOf<String>()
        compose.setContent { AWCTheme(false) { run { Column(Modifier.width(400.dp)) {
            AWCComponent("md-accordion",mapOf("transition" to "none"),onEvent={ n,_->log+=n }) { slot-> if(slot=="") {
                AWCComponent("md-accordion-item",mapOf("headline" to "Alpha","supportingText" to "Alpha details","icon" to "favorite")) { if(it=="") Text("Alpha body") }
                AWCComponent("md-accordion-item",mapOf("headline" to "Beta","expanded" to true)) { if(it=="") Text("Beta body") }
                AWCComponent("md-accordion-item",mapOf("headline" to "Gamma","disabled" to true,"expanded" to true)) { if(it=="") Text("Gamma body") }
            } }
            AWCComponent("md-accordion",mapOf("keepOneExpanded" to true,"transition" to "none")) { slot-> if(slot=="")
                AWCComponent("md-accordion-item",mapOf("headline" to "Locked")) { if(it=="") Text("Locked body") } }
        } } } }
        compose.waitForIdle()
        java.io.File(InstrumentationRegistry.getInstrumentation().targetContext.getExternalFilesDir(null),"accordion").apply { mkdirs() }
            .resolve("semantics-unmerged.txt").writeText(compose.onRoot(useUnmergedTree=true).printToString(Int.MAX_VALUE)+"\n\nMERGED\n"+compose.onRoot().printToString(Int.MAX_VALUE))
        eventually("Alpha header exposed") { header("Alpha")!=null }
        val alpha=header("Alpha")!!
        assertEquals("button role","android.widget.Button",role(alpha).toString());checks++
        assertEquals("label is headline then supporting text","Alpha Alpha details",label(alpha));checks++
        assertTrue(alpha.isEnabled && alpha.isClickable && alpha.isFocusable);checks++
        assertEquals("Collapsed",alpha.stateDescription?.toString());checks++
        assertTrue("collapsed header offers expand",alpha.actionList.any { it.id==AccessibilityNodeInfo.ACTION_EXPAND } && alpha.actionList.none { it.id==AccessibilityNodeInfo.ACTION_COLLAPSE });checks++
        assertFalse("decorative leading glyph name is hidden",present("favorite"));checks++
        assertFalse("collapsed panel content is hidden",present("Alpha body"));checks++
        val beta=header("Beta")!!
        assertEquals("Expanded",beta.stateDescription?.toString());checks++
        assertTrue("expanded header offers collapse",beta.actionList.any { it.id==AccessibilityNodeInfo.ACTION_COLLAPSE });checks++
        assertTrue("expanded panel content is exposed",present("Beta body"));checks++
        val gamma=header("Gamma")!!
        assertFalse("disabled header",gamma.isEnabled);checks++
        assertTrue("disabled-but-open content stays readable (source: disabled does not make the panel inert)",present("Gamma body"));checks++
        eventually("keep-one locked header") { header("Locked")?.stateDescription?.toString()=="Expanded" }
        val locked=header("Locked")!!
        assertFalse("locked-open header is announced unavailable (aria-disabled)",locked.isEnabled);checks++
        // Android omits the click action of a disabled node; source activation is a no-op anyway.
        assertTrue("locked-open header stays focusable",locked.isFocusable);checks++
        assertTrue("locked-open header offers no collapse",locked.actionList.none { it.id==AccessibilityNodeInfo.ACTION_COLLAPSE });checks++
        listOf(alpha,beta,gamma,locked).forEach { evidence.put(describe(it)) }
        // Real accessibility actions dispatched through the platform node.
        assertTrue(alpha.performAction(AccessibilityNodeInfo.ACTION_EXPAND));checks++
        eventually("expand action opens Alpha") { header("Alpha")?.stateDescription?.toString()=="Expanded" && present("Alpha body") }
        assertTrue(header("Beta")!!.performAction(AccessibilityNodeInfo.ACTION_CLICK));checks++
        eventually("click action collapses Beta") { header("Beta")?.stateDescription?.toString()=="Collapsed" && !present("Beta body") }
        assertEquals(listOf("mdToggle","mdToggle"),log.filter { it=="mdToggle" }.takeLast(2));checks++
        // Traversal order: each header precedes its own panel content.
        val order=all().map(::text)
        assertTrue("header precedes panel",order.indexOfFirst { it=="Alpha" }<order.indexOfFirst { it.contains("Alpha body") });checks++
        AccordionEvidence.log("accessibility",JSONObject().put("checks",checks).put("nodes",evidence))
    }
}
