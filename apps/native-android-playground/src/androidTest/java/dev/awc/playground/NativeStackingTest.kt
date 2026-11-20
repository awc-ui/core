package dev.awc.playground

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import androidx.test.platform.app.InstrumentationRegistry
import dev.awc.nativeui.*
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import kotlin.math.abs

/** d3 (gate-7 r3-19): CSS document stacking against Chrome 153 (stacking-web.json from d3-lab/web2/stacking.mjs). A floating
 * md-accordion declared in an earlier container draws over the container that follows it, a dragged md-card draws over the
 * container that follows its own (and over its own later sibling), and focus and semantics keep the document order. The
 * oracle's div containers are application containers here; one that is not an AWC component joins with AWCStackingLift. */
class NativeStackingTest {
    @get:Rule val compose = createComposeRule()
    private val oracle by lazy { JSONObject(InstrumentationRegistry.getInstrumentation().context.assets.open("stacking-web.json").bufferedReader().readText()) }
    private fun JSONArray.ints() = (0 until length()).map { getInt(it) }
    private fun JSONArray.objects() = (0 until length()).map { getJSONObject(it) }
    private val teal = Color(0xFF00897B)
    private var scene by mutableStateOf("floating"); private var floating by mutableStateOf(true)
    private var inspection: AWCCardInspection? = null
    private val failures = mutableListOf<String>(); private var checks = 0
    private fun check(ok: Boolean, msg: String) { checks++; if (!ok) failures += msg }
    private fun near(a: List<Int>, b: List<Int>, t: Int) = a.zip(b).all { abs(it.first - it.second) <= t }

    @Composable private fun Button(id: String, label: String) = AWCComponent("md-button", mapOf("id" to id), Modifier.testTag(id)) { if (it == "") Text(label) }
    @Composable private fun Scene() {
        Column(Modifier.requiredSize(480.dp, 360.dp).background(Color.White)) {
            when (scene) {
                "floating" -> AWCAccordionViewport(Modifier.fillMaxSize()) { Column {
                    Button("before", "Before")
                    // #first: an application container between the accordion and the container it must rise above.
                    AWCStackingLift { Box { AWCComponent("md-accordion", mapOf("floating" to floating, "initialX" to 24.0, "initialY" to 60.0)) { slot ->
                        if (slot == "") AWCComponent("md-accordion-item", mapOf("headline" to "Panel")) { if (it == "") Text("Body") } } } }
                    Box(Modifier.testTag("second").background(teal).padding(60.dp)) { Button("after", "After") }
                } }
                // The card directly among its siblings: the host itself rises over the sibling that follows it.
                "card-direct" -> { Spacer(Modifier.height(8.dp))
                    AWCCardInspectionScope({ inspection = it }) { AWCComponent("md-card", mapOf("interactive" to true, "dragEnabled" to true), Modifier.testTag("card").padding(start = 8.dp)) { if (it == "") Text("Drag me") } }
                    Box(Modifier.testTag("second").background(teal).padding(60.dp)) { Text("Later") } }
                // The oracle's page: the card inside its own container (#first), the teal container after it.
                else -> { AWCStackingLift { Box(Modifier.padding(8.dp)) {
                        AWCCardInspectionScope({ inspection = it }) { AWCComponent("md-card", mapOf("interactive" to true, "dragEnabled" to true), Modifier.testTag("card")) { if (it == "") Text("Drag me") } } } }
                    Box(Modifier.testTag("second").background(teal).padding(60.dp)) { Text("Later") } }
            }
        }
    }
    private var density = 1f; private var view: android.view.View? = null
    private fun tab() { compose.runOnUiThread { val v = view!!; val t = android.os.SystemClock.uptimeMillis()
        v.dispatchKeyEvent(android.view.KeyEvent(t, t, android.view.KeyEvent.ACTION_DOWN, android.view.KeyEvent.KEYCODE_TAB, 0, 0)); v.dispatchKeyEvent(android.view.KeyEvent(t, t, android.view.KeyEvent.ACTION_UP, android.view.KeyEvent.KEYCODE_TAB, 0, 0)) }
        compose.waitForIdle() }
    /** The focused control by its label: the two buttons and the panel's header. */
    private fun focusedName(): String {
        fun any(m: SemanticsMatcher) = listOf(false, true).any { u -> compose.onAllNodes(isFocused() and m, useUnmergedTree = u).fetchSemanticsNodes().isNotEmpty() }
        return when { any(hasText("Before")) -> "before"; any(hasText("After")) -> "after"
            any(hasText("Panel", substring = true) or hasAnyDescendant(hasText("Panel", substring = true))) -> "item"; else -> "other" }
    }
    private fun shot(): (Double, Double) -> List<Int> {
        compose.waitForIdle(); val bitmap = compose.onRoot().captureToImage().asAndroidBitmap()
        return { x, y -> val p = bitmap.getPixel((x * density).toInt().coerceIn(0, bitmap.width - 1), (y * density).toInt().coerceIn(0, bitmap.height - 1))
            listOf((p shr 16) and 255, (p shr 8) and 255, p and 255) }
    }

    @Test fun liftedPanelAndDraggedCardStackOverLaterContainers() {
        compose.setContent { CompositionLocalProvider(LocalDensity provides Density(2f, 1f)) { density = LocalDensity.current.density; view = androidx.compose.ui.platform.LocalView.current
            AWCTheme(darkTheme = false) { AWCAccessibilityAppearanceScope(reducedMotion = true) { key(scene) { Scene() } } } } }
        val tealRgb = oracle.getJSONArray("teal").ints()
        // 1. Floating panel over the later container (Chrome: fixed, z-index 1000).
        compose.waitForIdle(); compose.mainClock.advanceTimeBy(600)
        var rgb = shot(); val web = oracle.getJSONObject("floating")
        for (p in web.getJSONArray("probes").objects()) {
            val want = p.getJSONArray("rgb").ints(); val got = rgb(p.getDouble("x"), p.getDouble("y"))
            check(near(got, want, if (p.getString("top") == "second") 3 else 8), "floating: ${p.getString("label")} at (${p.getDouble("x")}, ${p.getDouble("y")}) $got vs Chrome $want")
        }
        // Focus order is the document's: before, the panel's header, after.
        compose.runOnUiThread { view?.clearFocus() }; compose.waitForIdle()
        val order = (0 until 3).map { tab(); focusedName() }
        val webTab = web.getJSONArray("tab").let { a -> (0 until a.length()).map { a.getString(it).substringBefore('>') } }
        check(order == webTab, "floating: Tab order $order vs Chrome $webTab")
        // Leaving `floating` returns the panel to the flow; the later container moves below it. Floating again lifts it again.
        compose.runOnIdle { floating = false }; compose.waitForIdle(); compose.mainClock.advanceTimeBy(600); rgb = shot()
        val inflow = web.getJSONObject("inflow").getJSONArray("second").getDouble(1)
        check(near(rgb(100.0, inflow + 20), tealRgb, 3) && !near(rgb(30.0, 60.0), tealRgb, 40), "floating off: the panel is in the flow above the later container (${rgb(30.0, 60.0)}, ${rgb(100.0, inflow + 20)})")
        compose.runOnIdle { floating = true }; compose.waitForIdle(); compose.mainClock.advanceTimeBy(600); rgb = shot()
        web.getJSONArray("probes").objects().first().let { p -> check(near(rgb(p.getDouble("x"), p.getDouble("y")), p.getJSONArray("rgb").ints(), 8), "floating on again: the panel draws over the later container (${rgb(p.getDouble("x"), p.getDouble("y"))})") }

        // 2. A dragged card over the container after its own (Chrome: z-index 1000 while dragging), in both compositions.
        val card = oracle.getJSONObject("card"); val dy = card.getJSONArray("dragged").getDouble(1) - card.getJSONObject("rects").getJSONArray("card").getDouble(1)
        for (name in listOf("card", "card-direct")) {
            compose.runOnIdle { scene = name; inspection = null }; compose.waitForIdle(); compose.mainClock.advanceTimeBy(600)
            val b = compose.onNodeWithTag("card").fetchSemanticsNode().boundsInRoot; val x0 = b.left / density + 8.0 * (if (name == "card-direct") 1 else 0); val y0 = b.top / density.toDouble()
            val h = b.height / density.toDouble(); val over = (x0 + 30) to (y0 + 8 + dy); val edge = (x0 + 30) to (y0 + dy + h - 6)
            rgb = shot(); check(near(rgb(over.first, over.second), tealRgb, 3), "$name: the later container is under the probe before the drag (${rgb(over.first, over.second)})")
            val start = Offset(((x0 - b.left / density) + 10).toFloat() * density, 10f * density)
            compose.onNodeWithTag("card").performTouchInput { down(start); moveBy(Offset(0f, 20f * density)); moveBy(Offset(0f, (dy - 20).toFloat() * density)) }
            compose.waitForIdle(); compose.mainClock.advanceTimeBy(500)
            check(inspection?.values?.get("dragging") == true, "$name: dragging (${inspection?.values?.get("dragging")}, offsetY ${inspection?.values?.get("offsetY")})")
            rgb = shot(); val probes = card.getJSONArray("probes").objects()
            listOf(over, edge).forEachIndexed { i, at -> val want = probes[i].getJSONArray("rgb").ints(); val got = rgb(at.first, at.second)
                check(!near(got, tealRgb, 40) && near(got, want, 12), "$name: ${probes[i].getString("label")} at $at $got vs Chrome $want") }
            compose.onNodeWithTag("card").performTouchInput { up() }; compose.waitForIdle(); compose.mainClock.advanceTimeBy(600); rgb = shot()
            check(near(rgb(over.first, over.second), tealRgb, 3), "$name: released, it returns and the later container shows again (${rgb(over.first, over.second)})")
        }
        println("NativeStackingTest: ${checks - failures.size}/$checks checks passed")
        assertTrue("${failures.size} of $checks failed:\n" + failures.joinToString("\n"), failures.isEmpty())
    }
}
