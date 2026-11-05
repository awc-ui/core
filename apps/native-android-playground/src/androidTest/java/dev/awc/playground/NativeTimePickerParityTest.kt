package dev.awc.playground

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.toPixelMap
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import dev.awc.nativeui.*
import dev.awc.playground.CardWeb.objects
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sin

/**
 * md-time-picker paint and geometry against Chrome 153 (Mac capture of tp-paint.html, DPR 1, 96 cases): the trigger (12h / 24h ×
 * empty / value, dark, RTL, error, supporting, disabled, required, reserve-space, label, density −1…−4), the dial dialog (12h /
 * 24h × theme × direction, inner ring, AM, empty, horizontal period, minute step, min / max, headline, translated labels,
 * densities, landscape, the responsive policy on two viewports), the input dialog, every hook alone and together, the
 * undocumented aliases. Checks the host, every part box (dial numbers by text, the rotated hand's box), the tiles' values, the
 * focused part and every flat pixel of the clip. Rendered through AWCComponent (dispatch) inside an AWCModalScope of the
 * case's viewport.
 */
@OptIn(ExperimentalTestApi::class)
class NativeTimePickerParityTest {
    @get:Rule val compose = createComposeRule()
    private var case by mutableStateOf(JSONObject("{\"name\":\"init\",\"props\":{},\"host\":{\"x\":24,\"y\":24,\"width\":240,\"height\":56}}"))
    private var epoch by mutableIntStateOf(0)
    private val collector = AWCInspectionCollector()
    private var picker: AWCTimePickerRuntime? = null
    private var checks = 0; private val failures = mutableListOf<String>(); private val report = JSONArray()
    private fun check(ok: Boolean, label: String) { checks++; if (!ok) { failures += label; android.util.Log.i("AWCAccordion", "FAIL: $label") } }
    companion object {
        fun json(v: Any?): Any? = when (v) { JSONObject.NULL -> null; is JSONObject -> v.keys().asSequence().associateWith { json(v.get(it)) }
            is JSONArray -> (0 until v.length()).map { json(v.get(it)) }; else -> v }
        @Suppress("UNCHECKED_CAST") fun props(c: JSONObject): Map<String, Any?> = (json(c.optJSONObject("props") ?: JSONObject()) as Map<String, Any?>)
        fun hooks(h: JSONObject?): AWCTimePickerAppearance = AWCTimePickerAppearance(h?.keys()?.asSequence()?.associateWith { h.get(it).toString() } ?: emptyMap())
        fun viewport(c: JSONObject): Pair<Double, Double> { val v = c.optJSONArray("viewport"); return if (v != null && v.length() == 2) v.getDouble(0) to v.getDouble(1) else 1200.0 to 900.0 }
    }
    private fun content() { compose.setContent { CompositionLocalProvider(LocalDensity provides Density(2f, 1f)) {
        val c = case; val rtl = c.optString("dir") == "rtl"; val h = c.getJSONObject("host"); val (vw, vh) = viewport(c)
        AWCTheme(c.optString("theme") == "dark") { Box(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.surface)) { key(epoch) {
            Box(Modifier.wrapContentSize(Alignment.TopStart, unbounded = true).requiredSize(vw.dp, vh.dp)) {
                AWCModalScope(Modifier.fillMaxSize(), insets = WindowInsets(0.dp, 0.dp, 0.dp, 0.dp)) {
                    // The page positions the host (its rect in the oracle) in physical coordinates.
                    Box(Modifier.absoluteOffset(h.getDouble("x").dp, h.getDouble("y").dp).width(max(h.getDouble("width"), 1.0).dp)) {
                        CompositionLocalProvider(LocalLayoutDirection provides if (rtl) LayoutDirection.Rtl else LayoutDirection.Ltr) {
                            AWCAccessibilityAppearanceScope(reducedMotion = false) { AWCTimePickerAppearanceScope(hooks(c.optJSONObject("hooks"))) {
                                AWCTimePickerInspectionScope({ picker = it }) { AWCInspectionScope(collector) {
                                    Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.TopStart) { AWCComponent("md-time-picker", props(c) + ("id" to "tp")) }
                                } }
                            } }
                        }
                    }
                }
            }
        } } }
    } } }
    @Test fun timePickerMatchesChromePaintAndGeometry() {
        AWCTimeMath.clock = { java.util.GregorianCalendar(2025, 5, 12, 10, 30).timeInMillis }
        content()
        val only = androidx.test.platform.app.InstrumentationRegistry.getArguments().getString("awcTpOnly")
        for (c in CardWeb.document("TimePickerWebPaint.json").getJSONArray("cases").objects()) if (only == null || only.split(",").any { c.getString("name").contains(it) }) run(c)
        AccordionEvidence.log("timepicker-paint", JSONObject().put("checks", checks).put("failures", failures.size).put("failureList", JSONArray(failures.take(600))).put("report", report))
        assertTrue("${failures.size} of $checks failed:\n" + failures.take(120).joinToString("\n"), failures.isEmpty())
    }
    private fun run(c: JSONObject) {
        val name = c.getString("name")
        android.util.Log.i("AWCAccordion", "timepicker-paint case $name")
        compose.onRoot().performMouseInput { moveTo(Offset(4f, 4f), 0) }
        picker = null; collector.clear(); case = c; epoch++
        val open = c.optJSONObject("props")?.optBoolean("open") == true
        compose.waitForIdle(); compose.mainClock.advanceTimeBy(if (open) 900 else 350); compose.waitForIdle()
        val nodes = collector.snapshot().nodes
        fun m(part: String) = nodes.firstOrNull { it.name == part }
        fun near(a: Double, b: Double, label: String, tol: Double = .6) = check(abs(a - b) <= tol, "$name $label $a vs $b")
        fun rect(b: AWCInspectionBounds?, r: JSONObject?, label: String, tol: Double = .6) {
            if (r == null) return
            if (b == null) { check(false, "$name $label missing"); return }
            near(b.x, r.getDouble("x"), "$label x", tol); near(b.y, r.getDouble("y"), "$label y", tol)
            near(b.width, r.getDouble("width"), "$label width", tol); near(b.height, r.getDouble("height"), "$label height", tol)
        }
        val h = c.getJSONObject("host")
        val root = m("md-time-picker")
        if (h.getDouble("width") > 0 && h.getDouble("height") > 0) { if (root == null) { check(false, "$name measured"); return }; rect(root.bounds, h, "host") }
        val direct = setOf("scrim", "dialog", "headline", "body", "input-area", "input-hour", "input-minute", "footer", "toggle-mode", "actions",
            "cancel-button", "confirm-button", "period-toggle", "period-am", "period-pm", "time-area", "dial-wrap", "dial")
        val rtl = c.optString("dir") == "rtl"
        val pk = picker
        for (e in c.getJSONArray("elements").objects()) {
            val key = e.getString("key"); val r = e.optJSONObject("rect")
            when {
                key in direct -> rect(m(key)?.bounds, r, key)
                key == "trigger" -> rect(m("md-text-field")?.bounds, r, key)
                // The field's leading-icon part is the glyph slot; Chrome's rect is the slotted glyph (a square of the slot height at its leading edge).
                key == "trigger-icon" -> { val b = m("leading-icon")?.bounds
                    rect(b?.let { AWCInspectionBounds(if (rtl) it.x + it.width - it.height else it.x, it.y, it.height, it.height) }, r, key) }
                key == "trigger/container" -> rect(m("container")?.bounds, r, key)
                key == "dial-number" -> { val text = e.optString("text"); val n = m("dial-number-$text")
                    rect(n?.bounds, r, "dial-number $text", .8)
                    if (n != null) check((pk?.activeNumber == text) == e.optString("cls").contains("--active"), "$name dial-number $text active") }
                key == "dial-hand" -> {
                    // A zero-width bar from the dial centre (radius long) rotated about its foot: Chrome's box is the segment's.
                    val dial = m("dial")?.bounds
                    if (dial == null || pk == null) { check(false, "$name dial-hand missing"); continue }
                    val a = pk.handAngle * Math.PI / 180; val rr = dial.height / 2; val cx = dial.x + dial.width / 2; val cy = dial.y + dial.height / 2
                    val tx = cx + rr * sin(a); val ty = cy - rr * cos(a)
                    rect(AWCInspectionBounds(min(cx, tx), min(cy, ty), abs(tx - cx), abs(ty - cy)), r, key, .8)
                }
                key == "value-input-hour" -> check(pk?.hourBuffer == e.optString("value"), "$name $key ${pk?.hourBuffer} vs ${e.optString("value")}")
                key == "value-input-minute" -> check(pk?.minuteBuffer == e.optString("value"), "$name $key ${pk?.minuteBuffer} vs ${e.optString("value")}")
                else -> continue
            }
        }
        // The focused part (Chrome's active element).
        val active = c.optString("active", "body"); val expected = if (active == "body") null else active.split(" > ").last()
        val focused = pk?.focused?.takeUnless { it == "trigger" }
        check(focused == expected, "$name focus ${focused ?: "body"} vs ${expected ?: "body"}")
        val clip = c.getJSONObject("clip")
        val nat = CardWeb.nativeGrid(compose.onRoot().captureToImage().toPixelMap(), clip.getInt("x"), clip.getInt("y"), clip.getInt("width"), clip.getInt("height"))
        // A focused tile's text is selected on open (`select()`): the selection highlight is the platform's (Chrome on macOS
        // #AAC9FE; Android / AppKit / UIKit their own), not a component style, so the tile's text box is not compared there.
        val mask = if (expected?.startsWith("input-") == true) listOfNotNull(m(expected ?: "")?.bounds?.let { b ->
            androidx.compose.ui.geometry.Rect((b.x + 16).toFloat(), (b.y + 4).toFloat(), (b.x + b.width - 16).toFloat(), (b.y + b.height - 4).toFloat()) }) else emptyList()
        val res = CardWeb.compare(CardWeb.webGrid("TimePickerWebPaint/$name.png", clip), nat, mask)
        val area = max(1, (clip.getInt("width") - 2) * (clip.getInt("height") - 2))
        check(res.getInt("compared").toDouble() / area > .5 && res.getInt("over6").toDouble() / max(1, res.getInt("compared")) <= .005 && res.getDouble("mean") <= 1.0, "$name flat pixels $res")
        report.put(res.put("case", name))
        compose.runOnIdle { picker?.hide() }; compose.mainClock.advanceTimeBy(100); compose.waitForIdle()
    }
}
