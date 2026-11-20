package dev.awc.playground

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.toPixelMap
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.unit.Density
import androidx.test.platform.app.InstrumentationRegistry
import dev.awc.nativeui.*
import dev.awc.playground.CardWeb.objects
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import kotlin.math.abs
import kotlin.math.max

/**
 * Button family paint and geometry against Mac Chrome 153 (gate-7 R1-03a–f; button-family/web-reference: cases.js, paint.html,
 * DPR 1): md-fab, md-icon-button, md-button-group, md-segmented-button(+set), md-split-button and md-fab-menu(+item) — light/dark,
 * variants × states, sizes, densities (local and inherited), content, RTL, every hook at once and each hook alone. The shared
 * fixture (ButtonFamilyWebPaint.json, byte-identical to the SwiftUI one) drives FamilyScene. Checks the first root's border box
 * and every flat pixel of Chrome's clip. Instrumentation args: familyOnly (name substring), familyComps (comma list).
 */
class NativeButtonFamilyPaintTest {
    @get:Rule val compose = createComposeRule()
    private var case by mutableStateOf<JSONObject?>(null)
    private var epoch by mutableIntStateOf(0)
    private val collector = AWCInspectionCollector()
    private var checks = 0; private val failures = mutableListOf<String>(); private val report = JSONArray()
    private fun check(ok: Boolean, label: String) { checks++; if (!ok) failures += label }
    @Test fun buttonFamilyMatchesChromePaintAndGeometry() {
        compose.setContent { CompositionLocalProvider(LocalDensity provides Density(2f, 1f)) {
            val c = case
            AWCTheme(c?.optString("theme") == "dark") { Box(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.surface)) {
                key(epoch) { if (c != null) FamilyScene(c, collector, { _, _, _, _ -> }) }
            } }
        } }
        // Infinite motion (none expected at rest) must not keep Compose busy: the whole test runs on the manual clock.
        compose.mainClock.autoAdvance = false
        FamilyWeb.viewport = compose.onRoot().fetchSemanticsNode().size.width / 2.0
        val args = InstrumentationRegistry.getArguments(); val only = args.getString("familyOnly"); val comps = args.getString("familyComps")?.split(",")?.toSet()
        for (c in CardWeb.document("ButtonFamilyWebPaint.json").getJSONArray("cases").objects())
            if ((only == null || c.getString("name").contains(only)) && (comps == null || c.getString("comp") in comps)) run(c)
        AccordionEvidence.log("button-family-paint", JSONObject().put("checks", checks).put("failures", failures.size).put("failureList", JSONArray(failures.take(600))).put("report", report))
        assertTrue("${failures.size} of $checks failed:\n" + failures.take(80).joinToString("\n"), failures.isEmpty())
    }
    private fun run(c0: JSONObject) {
        val c = FamilyWeb.opened(c0); val name = c.getString("name")
        android.util.Log.i("AWCAccordion", "button-family-paint case $name")
        collector.clear(); case = c; epoch++
        compose.mainClock.advanceTimeBy(if (c.optString("comp") == "fab-menu") 700 else 96); compose.waitForIdle()
        val nodes = collector.snapshot().nodes; val b = nodes.firstOrNull { it.id == "component" }?.bounds
        val r = c.getJSONArray("snaps").getJSONObject(0).getJSONObject("rect"); val dx = FamilyWeb.shift(c)
        if (b == null) check(false, "$name measured")
        else check(abs(b.x + dx - r.getDouble("x")) <= .75 && abs(b.y - r.getDouble("y")) <= .75 && abs(b.width - r.getDouble("width")) <= 1.0 && abs(b.height - r.getDouble("height")) <= .75,
            "$name border box $b (shift $dx) vs $r; parts ${nodes.filter { it.id.startsWith("component.") }.joinToString { "${it.id}=${it.bounds}" }}")
        val clip = c.getJSONObject("clip")
        val image = compose.onRoot().captureToImage()
        val nat = CardWeb.nativeGrid(image.toPixelMap(), clip.getInt("x") - dx, clip.getInt("y"), clip.getInt("width"), clip.getInt("height")).let { CardWeb.Grid(clip.getInt("x"), it.y, it.w, it.h, it.v) }
        val res = CardWeb.compare(CardWeb.webGrid("ButtonFamilyWebPaint/$name.png", clip), nat)
        val boxOk = b != null && abs(b.x + dx - r.getDouble("x")) <= .75 && abs(b.width - r.getDouble("width")) <= 1.0
        // Failing cases keep the native frame (device files/accordion/png/family-<case>.png; Chrome's is ButtonFamilyWebPaint/<case>.png).
        if (!familyOk(res) || !boxOk) AccordionEvidence.png("family-$name", image)
        check(familyOk(res), "$name flat pixels $res"); report.put(res.put("case", name).put("comp", c.getString("comp")).put("group", c.optString("group")))
    }
}

/** The family's pixel bar (same as SwiftUI): > 200 flat pixels compared, ≤ 0.5 % over 6/255, mean ≤ 1.0. */
internal fun familyOk(r: JSONObject) = r.getInt("compared") > 200 && r.getInt("over6").toDouble() / max(r.getInt("compared"), 1) <= .005 && r.getDouble("mean") <= 1.0
