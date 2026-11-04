package dev.awc.playground

import androidx.compose.foundation.background
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.*
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.toPixelMap
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.text.TextRange
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

/**
 * md-color-picker paint and geometry against Chrome 153 (Mac capture of cp-paint.html, DPR 1, 165 cases): theme × direction
 * × variant (inline, open popover) × 13 states, densities −1…−4 (local and an ancestor −3), keyboard focus on every part
 * (real Tab walk), hover on plate / hue / preset / hex input, an invalid hex entry, every hook alone and together, a 240px
 * cap, locales (full motion, settled: Chrome's hover spring and pop-in end states). Checks the host, panel, plate, sliders, tracks, preview, fields, inputs (box and value), presets and every
 * flat pixel of the clip. Rendered through AWCComponent (dispatch).
 */
@OptIn(ExperimentalTestApi::class)
class NativeColorPickerParityTest {
    @get:Rule val compose = createComposeRule()
    private var case by mutableStateOf(JSONObject("{\"name\":\"init\",\"props\":{}}"))
    private var epoch by mutableIntStateOf(0)
    private val collector = AWCInspectionCollector()
    private var picker: AWCColorPickerRuntime? = null
    private val before = FocusRequester()
    private var checks = 0; private val failures = mutableListOf<String>(); private val report = JSONArray()
    private fun check(ok: Boolean, label: String) { checks++; if (!ok) failures += label }
    companion object {
        fun json(v: Any?): Any? = when (v) { JSONObject.NULL -> null; is JSONObject -> v.keys().asSequence().associateWith { json(v.get(it)) }
            is JSONArray -> (0 until v.length()).map { json(v.get(it)) }; else -> v }
        @Suppress("UNCHECKED_CAST") fun props(c: JSONObject): Map<String, Any?> = (json(c.optJSONObject("props") ?: JSONObject()) as Map<String, Any?>)
        fun appearance(h: JSONObject?): AWCColorPickerAppearance {
            if (h == null) return AWCColorPickerAppearance()
            fun s(k: String) = if (h.has(k) && !h.isNull(k)) h.getString(k) else null
            fun l(k: String) = s(k)?.removeSuffix("px")?.toDoubleOrNull()
            fun c(k: String) = s(k)?.let(CardWeb::hex)
            return AWCColorPickerAppearance(l("width"), l("plate-height"), l("radius"), c("surface-color"), c("on-surface"), c("outline-color"), c("outline-strong"),
                l("thumb-size"), c("thumb-border"), l("preset-size"), s("popover-elevation"))
        }
    }
    private fun content() { compose.setContent { CompositionLocalProvider(LocalDensity provides Density(2f, 1f)) {
        // `dir="rtl"` on the host alone leaves Chrome's layout LTR (only the pop-in origin follows it): the page direction decides.
        val c = case; val rtl = c.optString("dir") == "rtl"
        val width = if (c.has("width") && !c.isNull("width")) c.getString("width").removeSuffix("px").toDouble() else 340.0
        AWCTheme(c.optString("theme") == "dark") { Box(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.surface)) { key(epoch) {
            AWCColorPickerScope(Modifier.fillMaxSize()) {
                Box(Modifier.absoluteOffset(1000.dp, 10.dp).size(60.dp, 32.dp).focusRequester(before).focusable())
                Box(Modifier.absoluteOffset(24.dp, 24.dp).width(width.dp)) {
                    CompositionLocalProvider(LocalLayoutDirection provides if (rtl) LayoutDirection.Rtl else LayoutDirection.Ltr) {
                        AWCDensityScope(if (c.has("wrapperDensity") && !c.isNull("wrapperDensity")) c.getDouble("wrapperDensity") else 0.0) {
                        AWCColorPickerReducedMotionScope(false) { AWCColorPickerAppearanceScope(appearance(c.optJSONObject("hooks"))) {
                            AWCColorPickerInspectionScope({ picker = it }) { AWCInspectionScope(collector) {
                                Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.TopStart) {
                                    AWCComponent("md-color-picker", props(c), content = { slot -> if (slot == "trigger") AWCComponent("md-button", mapOf("variant" to "tonal", "label" to "Colour")) })
                                }
                            } }
                        } } }
                    }
                }
            }
        } } }
    } } }
    @Test fun colorPickerMatchesChromePaintAndGeometry() {
        content()
        for (c in CardWeb.document("ColorPickerWebPaint.json").getJSONArray("cases").objects()) run(c)
        AccordionEvidence.log("colorpicker-paint", JSONObject().put("checks", checks).put("failures", failures.size).put("failureList", JSONArray(failures.take(400))).put("report", report))
        assertTrue("${failures.size} of $checks failed:\n" + failures.take(80).joinToString("\n"), failures.isEmpty())
    }
    private fun center(r: JSONObject) = Offset(((r.getDouble("x") + r.getDouble("width") / 2) * 2).toFloat(), ((r.getDouble("y") + r.getDouble("height") / 2) * 2).toFloat())
    private fun run(c: JSONObject) {
        val name = c.getString("name")
        android.util.Log.i("AWCAccordion", "colorpicker-paint case $name")
        compose.onRoot().performMouseInput { moveTo(Offset(2380f, 1700f), 0) }
        picker = null; collector.clear(); case = c; epoch++; compose.waitForIdle(); compose.mainClock.advanceTimeBy(450); compose.waitForIdle()
        val parts = c.getJSONArray("parts").objects()
        // Keyboard focus: a real Tab walk from the element before the picker until the target part has focus.
        if (c.has("focus") && !c.isNull("focus")) {
            val t = c.getString("focus"); val target = when { t == "channel-r" -> "r"; else -> t }
            compose.runOnIdle { before.requestFocus() }; compose.waitForIdle()
            var n = 0
            while (picker?.focused != target && n < 24) { compose.onRoot().performKeyInput { pressKey(Key.Tab) }; compose.waitForIdle(); n++ }
            check(picker?.focused == target, "$name Tab walk reaches $target (${picker?.focused})")
            compose.mainClock.advanceTimeBy(400); compose.waitForIdle()
        }
        if (c.has("hover") && !c.isNull("hover")) {
            val hover = c.getString("hover"); val sel = mapOf("preset" to "preset", "plate" to "plate", "hue" to "hue", "hex-input" to "field-hex")[hover]
            var r = parts.firstOrNull { it.getString("part") == sel }?.getJSONObject("rect")
            if (hover == "hex-input") r = c.getJSONArray("inputs").objects().firstOrNull()?.getJSONObject("rect") ?: r
            if (r != null) { val pt = center(r); compose.onRoot().performMouseInput { moveTo(pt, 0) }; compose.mainClock.advanceTimeBy(500); compose.waitForIdle() }
        }
        if (c.has("typeHex") && !c.isNull("typeHex")) {
            val node = compose.onNode(hasContentDescription("Hex") and hasSetTextAction())
            node.performClick(); compose.waitForIdle()
            node.performTextInputSelection(TextRange(0, picker?.hexInput?.length ?: 0))
            for (ch in c.getString("typeHex")) { node.performTextInput(ch.toString()); compose.mainClock.advanceTimeBy(20); compose.waitForIdle() }
            compose.mainClock.advanceTimeBy(350); compose.waitForIdle()
        }
        val nodes = collector.snapshot().nodes
        fun m(part: String) = nodes.firstOrNull { it.name == part }
        fun near(a: Double, b: Double, label: String, tol: Double = .6) = check(abs(a - b) <= tol, "$name $label $a vs $b")
        fun rect(n: AWCInspectionNode?, r: JSONObject?, label: String, tol: Double = .6) {
            if (r == null) return
            if (n == null) { check(false, "$name $label missing"); return }
            near(n.bounds.x, r.getDouble("x"), "$label x", tol); near(n.bounds.y, r.getDouble("y"), "$label y", tol)
            near(n.bounds.width, r.getDouble("width"), "$label width", tol); near(n.bounds.height, r.getDouble("height"), "$label height", tol)
        }
        val root = m("md-color-picker") ?: run { check(false, "$name measured"); return }
        rect(root, c.getJSONObject("host"), "host")
        var presetIndex = 0
        for (p in parts) {
            when (val part = p.getString("part")) {
                "label", "thumb" -> continue
                // The swatch box is transformed (selected: scale 1.1): Chrome reports its transformed bounds, as the native layer does.
                "preset" -> { rect(m("preset-$presetIndex"), p.optJSONObject("rect"), "preset $presetIndex", .8); presetIndex++ }
                else -> rect(m(part), p.optJSONObject("rect"), part)
            }
        }
        val fieldIDs = mapOf("field-hex" to "hex", "field-r" to "r", "field-g" to "g", "field-b" to "b", "field-a" to "a", "field-h" to "h", "field-s" to "s", "field-l" to "l")
        val inputParts = parts.mapNotNull { fieldIDs[it.getString("part")] }
        val pk = picker
        for ((i, input) in c.getJSONArray("inputs").objects().filter { it.getString("tag") == "input" }.withIndex()) {
            val id = inputParts.getOrNull(i) ?: break
            rect(m("input-$id"), input.getJSONObject("rect"), "input $id")
            val native = if (id == "hex") pk?.hexInput else pk?.channels?.getOrNull(inputParts.filter { it != "hex" }.indexOf(id))
            check(native == input.optString("value"), "$name input $id value $native vs ${input.optString("value")}")
        }
        val clip = c.getJSONObject("clip")
        val nat = CardWeb.nativeGrid(compose.onRoot().captureToImage().toPixelMap(), clip.getInt("x"), clip.getInt("y"), clip.getInt("width"), clip.getInt("height"))
        // Gate-1 finding: `dir="rtl"` on the host alone keeps Chrome's layout and pointer mapping LTR (`:host { direction:
        // inherit }`) but flips the plate and slider gradients (`:host([dir="rtl"])` rules). Natives have no host-only direction;
        // the case renders consistently LTR, so its gradient areas are not compared.
        val mask = if (c.optString("hostDir") == "rtl") listOf("plate", "hue", "alpha").mapNotNull { m(it)?.bounds?.let { b -> androidx.compose.ui.geometry.Rect(b.x.toFloat(), b.y.toFloat(), (b.x + b.width).toFloat(), (b.y + b.height).toFloat()) } } else emptyList()
        val res = CardWeb.compare(CardWeb.webGrid("ColorPickerWebPaint/$name.png", clip), nat, mask)
        check(res.getInt("compared") > 600 && res.getInt("over6").toDouble() / res.getInt("compared") <= .005 && res.getDouble("mean") <= 1.0, "$name flat pixels $res"); report.put(res.put("case", name))
        compose.runOnIdle { before.requestFocus() }
    }
}
