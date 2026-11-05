package dev.awc.playground.stepper

import android.graphics.Bitmap
import android.util.Log
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.test.platform.app.InstrumentationRegistry
import dev.awc.nativeui.AWCComponent
import dev.awc.nativeui.AWCStepperController
import dev.awc.nativeui.AWCStepperControllerScope
import dev.awc.nativeui.AWCStepperReducedMotionScope
import dev.awc.nativeui.AWCTheme
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import java.io.File

/**
 * md-stepper / md-step through AWCComponent's dispatch on the device: renders light / dark × LTR / RTL (PNG set in
 * files/accordion/stepper-views); the header semantics (button, composed name, disabled when unreachable, expanded /
 * collapsed with a panel) and activation; the built-in nav (Continue / Back → mdBeforeChange, mdStepChange, auto-complete),
 * the vertical panel actions (mdStepNext / mdStepBack, focus to the new header), mdComplete on Finish, keyboard Enter on a
 * header, next() / prev() / goTo() / reset() through AWCStepperController, the polite live region, host updates in place
 * (active → mdStepChange after the update; completed), a standalone md-step, remount and a disposed stepper emitting nothing.
 */
@OptIn(ExperimentalTestApi::class)
class StepperViewsTest {
    @get:Rule val compose = createComposeRule()
    data class Case(val name: String, val props: Map<String, Any?>, val steps: List<Map<String, Any?>>, val content: Boolean = false, val standalone: Boolean = false)
    private var case by mutableStateOf<Case?>(null)
    private var dark by mutableStateOf(false)
    private var rtl by mutableStateOf(false)
    private val controller = AWCStepperController()
    private val events = mutableListOf<Pair<String, Any?>>()
    private val failures = mutableListOf<String>()
    private var checks = 0
    private fun check(ok: Boolean, label: String) { checks++; if (!ok) failures += label }
    private val files = File(InstrumentationRegistry.getInstrumentation().targetContext.getExternalFilesDir(null), "accordion").apply { mkdirs() }

    private fun host() = compose.setContent {
        CompositionLocalProvider(LocalDensity provides Density(2f, 1f)) {
            AWCTheme(dark) {
                CompositionLocalProvider(LocalLayoutDirection provides if (rtl) LayoutDirection.Rtl else LayoutDirection.Ltr) {
                    Box(Modifier.testTag("host").background(if (dark) Color(0xFF1C1B1F) else Color(0xFFFFFBFE)).padding(8.dp).width(560.dp)) {
                        val c = case
                        if (c != null) key(c.name, dark, rtl) {
                            AWCStepperReducedMotionScope(true) {
                                AWCStepperControllerScope(controller) {
                                    if (c.standalone) AWCComponent("md-step", c.steps[0], onEvent = { n, v -> events += n to v })
                                    else AWCComponent("md-stepper", c.props, onEvent = { n, v -> events += n to v }) { slot ->
                                        if (slot == "") for ((k, sp) in c.steps.withIndex()) key(k) {
                                            AWCComponent("md-step", sp, onEvent = { n, v -> events += n to v }) { s2 -> if (s2 == "" && c.content) Text("Content ${k + 1}") }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    private val three = listOf(mapOf("label" to "Account"), mapOf("label" to "Shipping", "description" to "Address"), mapOf("label" to "Review"))
    private val cases = listOf(
        Case("horizontal", emptyMap(), three),
        Case("horizontal-panels", emptyMap(), three, content = true),
        Case("vertical-panels", mapOf("orientation" to "vertical"), three, content = true),
        Case("dots-nonlinear", mapOf("indicator" to "dot", "mode" to "non-linear", "active" to 1.0), three),
        Case("mobile-numbered", mapOf("variant" to "mobile", "active" to 1.0), three),
        Case("error-optional", mapOf("active" to 1.0), listOf(mapOf("label" to "Account", "completed" to true), mapOf("label" to "Payment", "error" to true, "errorText" to "Card declined"), mapOf("label" to "Gift", "optional" to true))),
        Case("readonly", mapOf("readonly" to true, "active" to 1.0), three),
        Case("standalone-step", emptyMap(), listOf(mapOf("label" to "Alone", "active" to true)), standalone = true),
    )
    private fun show(c: Case?, dark: Boolean = false, rtl: Boolean = false) {
        this.dark = dark; this.rtl = rtl; events.clear(); case = c
        compose.waitForIdle(); compose.mainClock.advanceTimeBy(1200); compose.waitForIdle()
    }
    private fun update(vararg changes: Pair<String, Any?>) { val c = case!!; case = c.copy(props = c.props + changes); compose.waitForIdle(); compose.mainClock.advanceTimeBy(800); compose.waitForIdle() }
    private fun settle() { compose.waitForIdle(); compose.mainClock.advanceTimeBy(800); compose.waitForIdle() }
    private fun header(i: Int, total: Int = 3) = compose.onNode(SemanticsMatcher("header $i") { n ->
        (n.config.getOrNull(SemanticsProperties.ContentDescription)?.firstOrNull() ?: "").startsWith("Step ${i + 1} of $total") && n.config.contains(SemanticsActions.OnClick) })
    private fun desc(n: SemanticsNodeInteraction) = n.fetchSemanticsNode().config.getOrNull(SemanticsProperties.ContentDescription)?.firstOrNull() ?: ""
    private fun disabled(n: SemanticsNodeInteraction) = n.fetchSemanticsNode().config.contains(SemanticsProperties.Disabled)
    private fun names() = events.map { it.first }
    private fun allNames() = compose.onAllNodes(SemanticsMatcher("any") { true }).fetchSemanticsNodes().mapNotNull { it.config.getOrNull(SemanticsProperties.ContentDescription)?.firstOrNull() }
    private fun focusedNames() = compose.onAllNodes(SemanticsMatcher("focused") { it.config.getOrNull(SemanticsProperties.Focused) == true }).fetchSemanticsNodes().map { it.config.getOrNull(SemanticsProperties.ContentDescription)?.firstOrNull() ?: "?" }
    /** The first placed button with the label (hidden panels' actions stay composed but are not placed). */
    private fun button(label: String): SemanticsNodeInteraction {
        val all = compose.onAllNodes(hasText(label) and hasClickAction())
        val k = all.fetchSemanticsNodes().indexOfFirst { it.layoutInfo.isPlaced }
        return all[if (k < 0) 0 else k]
    }

    @Test fun viewsRenderWireAndLifecycle() {
        host()
        val dir = File(files, "stepper-views").apply { mkdirs() }
        val manifest = StringBuilder()
        // 1. Renders: 8 cases × light/dark × LTR/RTL.
        for (c in cases) for ((d, r) in listOf(false to false, true to true, false to true, true to false)) {
            show(c, d, r)
            val mode = (if (d) "dark" else "light") + "-" + (if (r) "rtl" else "ltr")
            val bmp = compose.onNodeWithTag("host").captureToImage().asAndroidBitmap()
            File(dir, "${c.name}-$mode.png").outputStream().use { bmp.compress(Bitmap.CompressFormat.PNG, 100, it) }
            val colours = HashSet<Int>(); for (y in 0 until bmp.height step 2) for (x in 0 until bmp.width step 2) { colours += bmp.getPixel(x, y); if (colours.size > 8) break }
            manifest.append("${c.name}-$mode: ${bmp.width}x${bmp.height} colours>${colours.size}\n")
            check(bmp.width > 20 && bmp.height > 20 && colours.size > 2, "render ${c.name}-$mode blank (${bmp.width}x${bmp.height}, ${colours.size} colours)")
            check(names().all { it == "mdStepChange" } , "render ${c.name}-$mode emitted ${names()}")
        }
        show(null)
        File(dir, "manifest.txt").writeText(manifest.toString())

        // 2. Horizontal: header semantics, linear reachability, the nav (Continue / Back), auto-complete, live region.
        show(cases[0])
        check(desc(header(0)) == "Step 1 of 3: Account, current", "header 0 name '${desc(header(0))}'")
        check(!disabled(header(0)) && disabled(header(2)), "linear reachability: header 0 ${disabled(header(0))}, header 2 ${disabled(header(2))}")
        header(2).performClick(); settle()
        check(events.isEmpty(), "unreachable header click emitted ${names()}")
        button("Continue").performClick(); settle()
        check(names() == listOf("mdBeforeChange", "mdStepChange"), "Continue events ${names()}")
        check(desc(header(0)).contains("completed") && desc(header(1)).endsWith("current"), "after Continue: '${desc(header(0))}' / '${desc(header(1))}'")
        val polite = compose.onAllNodes(SemanticsMatcher.expectValue(SemanticsProperties.LiveRegion, androidx.compose.ui.semantics.LiveRegionMode.Polite)).fetchSemanticsNodes()
        check(polite.any { (it.config.getOrNull(SemanticsProperties.ContentDescription)?.firstOrNull() ?: "") == "Step 2 of 3: Shipping, current" }, "polite live region ${polite.map { it.config.getOrNull(SemanticsProperties.ContentDescription) }}")
        events.clear(); button("Back").performClick(); settle()
        check(names() == listOf("mdBeforeChange", "mdStepChange") && desc(header(0)).endsWith("current"), "Back events ${names()} '${desc(header(0))}'")
        // Header activation (click, keyboard Enter) on a reachable step.
        events.clear(); button("Continue").performClick(); settle(); events.clear()
        header(0).performClick(); settle()
        check(names() == listOf("mdStepClick", "mdBeforeChange", "mdStepChange"), "header click events ${names()}")
        events.clear(); button("Continue").performClick(); settle(); events.clear()
        header(0).requestFocus(); header(0).performKeyInput { pressKey(Key.Enter) }; settle()
        check(names() == listOf("mdStepClick", "mdBeforeChange", "mdStepChange") && desc(header(0)).endsWith("current"), "Enter on header events ${names()}")
        // Methods through the controller (from the first step).
        check(controller.isConnected, "controller not bound")
        fun method(name: String, block: () -> Unit, expect: List<String>, current: Int) {
            events.clear(); compose.runOnUiThread(block); settle()
            check(names() == expect && desc(header(current)).endsWith("current"), "$name: ${names()} '${desc(header(current))}'")
        }
        method("next()", { controller.next() }, listOf("mdBeforeChange", "mdStepChange"), 1)
        method("next()", { controller.next() }, listOf("mdBeforeChange", "mdStepChange"), 2)
        method("next() on the last step", { controller.next() }, listOf("mdComplete"), 2)
        check(button("Finish").fetchSemanticsNode().config.contains(SemanticsActions.OnClick), "Finish on the last step")
        method("prev()", { controller.prev() }, listOf("mdBeforeChange", "mdStepChange"), 1)
        method("goTo(0)", { controller.goTo(0) }, listOf("mdBeforeChange", "mdStepChange"), 0)
        method("next()", { controller.next() }, listOf("mdBeforeChange", "mdStepChange"), 1)
        method("reset()", { controller.reset() }, listOf("mdStepChange"), 0)
        // Host updates in place: active (watcher → mdStepChange after the update), a step's completed.
        events.clear(); update("active" to 2.0)
        check(names() == listOf("mdStepChange") && desc(header(2)).endsWith("current"), "host active update ${names()} '${desc(header(2))}'")
        events.clear(); update("readonly" to true)
        check(compose.onAllNodes(SemanticsMatcher.keyIsDefined(SemanticsActions.OnClick) and SemanticsMatcher("step header") { (it.config.getOrNull(SemanticsProperties.ContentDescription)?.firstOrNull() ?: "").startsWith("Step ") })
            .fetchSemanticsNodes().isEmpty() && events.isEmpty(), "readonly update: headers still buttons / ${names()} ${allNames()}")

        // 3. Panels: expanded / collapsed headers; the vertical panel actions move focus to the new header.
        show(cases[1])
        check(header(0).fetchSemanticsNode().config.contains(SemanticsActions.Collapse) && header(1).fetchSemanticsNode().config.contains(SemanticsActions.Expand), "panel headers expanded / collapsed")
        check(compose.onAllNodes(hasText("Content 1")).fetchSemanticsNodes().count { it.layoutInfo.isPlaced } == 1 &&
            compose.onAllNodes(hasText("Content 2")).fetchSemanticsNodes().none { it.layoutInfo.isPlaced }, "only the active panel is shown")
        show(cases[2])
        button("Continue").performClick(); settle()
        check(names() == listOf("mdStepNext", "mdBeforeChange", "mdStepChange"), "vertical Continue events ${names()}")
        check(header(1).fetchSemanticsNode().config.getOrNull(SemanticsProperties.Focused) == true, "focus moved to the new active header (focused: ${focusedNames()})")
        events.clear(); button("Back").performClick(); settle()
        check(names() == listOf("mdStepBack", "mdBeforeChange", "mdStepChange"), "vertical Back events ${names()}")

        // 4. Standalone md-step: a header named "Step 1 of 0: Alone".
        show(cases[7])
        check(compose.onAllNodes(SemanticsMatcher("standalone") { (it.config.getOrNull(SemanticsProperties.ContentDescription)?.firstOrNull() ?: "") == "Step 1 of 0: Alone, current" }).fetchSemanticsNodes().size == 1, "standalone md-step name ${allNames()}")

        // 5. Remount re-reads the props; a disposed stepper emits nothing; the controller unbinds.
        show(cases[3]); check(desc(header(1)).endsWith("current"), "remount active from props '${desc(header(1))}'")
        show(null); events.clear(); compose.mainClock.advanceTimeBy(1500); compose.waitForIdle()
        check(events.isEmpty(), "disposed stepper emitted ${names()}")
        check(!controller.isConnected, "controller still bound after dispose")

        val summary = "stepper views: ${checks - failures.size}/$checks checks"
        Log.i("AWCAccordion", summary); failures.take(40).forEach { Log.i("AWCAccordion", "stepper views: FAIL $it") }
        File(files, "stepper-views.txt").writeText("$summary\n" + failures.joinToString("\n") + "\n" + manifest)
        assertTrue("$summary\n" + failures.joinToString("\n"), failures.isEmpty())
    }
}
