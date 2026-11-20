package dev.awc.playground

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.graphics.layer.drawLayer
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
import kotlin.math.max

/**
 * md-date-picker paint and geometry against Chrome 153 (the Mac capture shared byte-identically with
 * NativeDatePickerPaintIntegration.swift: 129 cases, today pinned to 2025-06-12): every variant × theme × direction, the field
 * states, locales / week starts / separators / labels / slots, the entry mode, the year grid, the docked menus, densities,
 * every hook, phone viewports. Checks the locale strings, the host, every part box, the days' states and every flat pixel of
 * the clip. Rendered through AWCComponent (dispatch) inside an AWCModalScope of the case's viewport. Decision 3 (a docked
 * list stays inside the panel) and decision 9 (exact year centring, reduced-motion capture) are recorded as on Apple.
 */
@OptIn(ExperimentalTestApi::class)
class NativeDatePickerPaintTest {
    @get:Rule val compose = createComposeRule()
    private var case by mutableStateOf(JSONObject("{\"name\":\"init\",\"props\":{},\"host\":{\"x\":24,\"y\":24,\"width\":360,\"height\":56}}"))
    private var epoch by mutableIntStateOf(0)
    /** The whole scene (the case's viewport) recorded offscreen: a clip beyond the emulator's screen is read from it. */
    private var sceneLayer: androidx.compose.ui.graphics.layer.GraphicsLayer? = null
    private val collector = AWCInspectionCollector()
    private val controller = AWCDatePickerController()
    private var checks = 0; private val failures = mutableListOf<String>(); private val recorded = mutableListOf<String>(); private val report = JSONArray()
    private fun check(ok: Boolean, label: String) { checks++; if (!ok) { failures += label; android.util.Log.i("AWCAccordion", "FAIL: $label") } }
    companion object {
        fun json(v: Any?): Any? = when (v) { JSONObject.NULL -> null; is JSONObject -> v.keys().asSequence().associateWith { json(v.get(it)) }
            is JSONArray -> (0 until v.length()).map { json(v.get(it)) }; else -> v }
        @Suppress("UNCHECKED_CAST") fun props(c: JSONObject): Map<String, Any?> = (json(c.optJSONObject("props") ?: JSONObject()) as Map<String, Any?>)
        fun hooks(h: JSONObject?): AWCDatePickerAppearance = AWCDatePickerAppearance(h?.keys()?.asSequence()?.associateWith { h.get(it).toString() } ?: emptyMap())
        fun viewport(c: JSONObject): Pair<Double, Double> { val v = c.optJSONArray("viewport"); return if (v != null && v.length() == 2) v.getDouble(0) to v.getDouble(1) else 1200.0 to 900.0 }
        /** A page-level `data-density` wrapper (density-global-*): the scale every descendant inherits. */
        fun pageDensity(html: String): Double? = Regex("data-density=\"(-?[0-9.]+)\"").find(html)?.groupValues?.get(1)?.toDoubleOrNull()
        /** Light-DOM slot content the cases author (header / actions / leading-icon / calendar-icon): (slot, tag, text, attrs). */
        fun slots(html: String): List<List<String>> = Regex("<(\\w[\\w-]*)([^>]*)\\bslot=\"([\\w-]+)\"([^>]*)>(.*?)</\\1>", RegexOption.DOT_MATCHES_ALL).findAll(html).map { m ->
            listOf(m.groupValues[3], m.groupValues[1], m.groupValues[5].replace(Regex("<[^>]+>"), "").trim(), m.groupValues[2] + m.groupValues[4]) }.toList()
    }
    @Composable private fun Slot(s: List<String>) {
        val (_, tag, text, attrs) = s
        if (attrs.contains("material-symbols") || tag == "md-icon") AWCMaterialSymbol(text, size = 24.dp)
        else if (tag.startsWith("md-")) {
            val p = Regex("([\\w-]+)=\"([^\"]*)\"").findAll(attrs).filter { it.groupValues[1] != "slot" && it.groupValues[1] != "class" }.associate { it.groupValues[1] to (it.groupValues[2] as Any?) }
            AWCComponent(tag, p + ("label" to text))
        } else Text(text)
    }
    private fun content() { compose.setContent { CompositionLocalProvider(LocalDensity provides Density(2f, 1f)) {
        val c = case; val rtl = c.optString("dir") == "rtl"; val h = c.getJSONObject("host"); val (vw, vh) = viewport(c)
        val modal = c.optJSONObject("props")?.optString("variant") == "modal"
        val slotted = slots(c.optString("html"))
        val registry = AWCSlotRegistry(slotted.groupBy { it[0] }.mapValues { (_, list) -> @Composable { list.forEach { Slot(it) } } })
        val density = pageDensity(c.optString("html"))
        AWCTheme(c.optString("theme") == "dark") { Box(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.surface)) { key(epoch) {
            val layer = androidx.compose.ui.graphics.rememberGraphicsLayer(); SideEffect { sceneLayer = layer }
            Box(Modifier.wrapContentSize(Alignment.TopStart, unbounded = true).requiredSize(vw.dp, vh.dp)
                .drawWithContent { layer.record { this@drawWithContent.drawContent() }; drawLayer(layer) }
                .background(MaterialTheme.colorScheme.surface)) {
                AWCModalScope(Modifier.fillMaxSize(), insets = WindowInsets(0.dp, 0.dp, 0.dp, 0.dp)) { AWCColorPickerScope(Modifier.fillMaxSize()) {
                    Box(Modifier.absoluteOffset((if (modal) 24.0 else h.getDouble("x")).dp, (if (modal) 24.0 else h.getDouble("y")).dp).width((if (modal) 1.0 else max(h.getDouble("width"), 1.0)).dp)) {
                        CompositionLocalProvider(LocalLayoutDirection provides if (rtl) LayoutDirection.Rtl else LayoutDirection.Ltr) {
                            AWCDensityScope(density ?: 0.0) { AWCAccessibilityAppearanceScope(reducedMotion = true) {
                                AWCDatePickerAppearanceScope(hooks(c.optJSONObject("hooks"))) { AWCDatePickerTodayScope(AWCDay(2025, 6, 12)) {
                                    AWCDatePickerControllerScope(controller) { AWCSlotsScope(registry) { AWCInspectionScope(collector) {
                                        Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.TopStart) { AWCComponent("md-date-picker", props(c) + ("id" to "dp")) }
                                    } } }
                                } }
                            } }
                        }
                    }
                } }
            }
        } } }
    } } }
    @Test fun datePickerMatchesChromePaintAndGeometry() {
        // Touch mode (Compose focuses its buttons only in keyboard mode): Chrome's capture loads without key input, so the
        // roving day / year / list entry shows no focus ring. A lane's earlier key-driven run can leave the display in
        // keyboard mode (A-test.sh taps once to restore it; n4-A042 paint-7 still started in keyboard mode: 11 cases showed rings).
        androidx.test.platform.app.InstrumentationRegistry.getInstrumentation().setInTouchMode(true)
        content()
        val args = androidx.test.platform.app.InstrumentationRegistry.getArguments()
        val only = args.getString("awcDpOnly"); val file = args.getString("awcDpPaint") ?: "DatePickerWebPaint"
        // Decision 9 (motion fixture) is the default, as in the Swift test (story 1-3, job 100-install-paint-test); awcDpStrict=1 runs the strict mode.
        val d9 = args.getString("awcDpStrict") == null
        for (c in CardWeb.document("$file.json").getJSONArray("cases").objects()) if (only == null || only.split(",").any { c.getString("name").contains(it) }) run(c, file, d9)
        AccordionEvidence.log("datepicker-paint", JSONObject().put("checks", checks).put("failures", failures.size).put("failureList", JSONArray(failures.take(600)))
            .put("recorded", JSONArray(recorded)).put("report", report))
        android.util.Log.i("AWCAccordion", "Date picker native paint (Android): ${checks - failures.size}/$checks checks passed, ${recorded.size} recorded differences")
        assertTrue("${failures.size} of $checks failed:\n" + failures.take(120).joinToString("\n"), failures.isEmpty())
    }
    /** The model's strings against Chrome's (Intl over ICU): headline, weekday letters, day names, field value / hint. */
    private fun locale(c: JSONObject) {
        val name = c.getString("name"); val p = c.optJSONObject("props") ?: JSONObject()
        val loc = AWCDateLocale(p.optString("locale", "").ifEmpty { "en-US" }); val sep = p.optString("dateSeparator", "")
        val value = AWCDay.iso(p.optString("value", ""))
        val fd = p.optInt("firstDayOfWeek", -1); val first = if (fd in 0..6) fd else loc.firstDayOfWeek
        val els = c.getJSONArray("elements").objects()
        val webWeekdays = els.filter { it.getString("key") == "weekday" }.map { it.optString("text") }
        if (webWeekdays.isNotEmpty()) check(webWeekdays == loc.weekdays(first), "$name locale weekdays ${loc.weekdays(first)} vs $webWeekdays")
        val h = els.firstOrNull { it.getString("key") == "headline" }?.optString("text").orEmpty()
        if (value != null && h.isNotEmpty() && h != "Enter dates" && h != "Select date") { val mine = loc.format(value, "MMMEd"); check(mine == h, "$name locale headline $mine vs $h") }
        for (e in els.filter { it.getString("key") == "day" }) {
            val d = AWCDay.iso(e.optJSONObject("attrs")?.optString("data-date")) ?: continue
            val mine = loc.format(d, "yMMMMEEEEd"); val web = e.optJSONObject("attrs")?.optString("aria-label").orEmpty()
            if (mine != web) { check(false, "$name locale day name $mine vs $web"); break }
        }
    }
    private fun run(c: JSONObject, file: String, d9Run: Boolean) {
        val name = c.getString("name")
        android.util.Log.i("AWCAccordion", "datepicker-paint case $name")
        locale(c)
        compose.onRoot().performMouseInput { moveTo(Offset(4f, 4f), 0) }
        controller.isDateDisabled = if (name == "cal-weekends-disabled") { d -> d.weekday == 0 || d.weekday == 6 } else null
        collector.clear(); case = c; epoch++
        val props = c.optJSONObject("props") ?: JSONObject()
        val open = props.optBoolean("open")
        compose.waitForIdle(); compose.mainClock.advanceTimeBy(if (open) 900 else 350); compose.waitForIdle()
        // The page's preparation (the shown sub-view): entry mode, the year grid, a docked menu.
        val keys = c.getJSONArray("elements").objects().map { it.getString("key") }.toSet()
        val rt = AWCDatePickerRuntime.mounted["dp"]?.get()
        for ((k, v) in listOf("entry" to "entry", "year-grid" to "year", "month-menu" to "month-menu", "year-menu" to "year-menu"))
            if (k in keys) { compose.runOnIdle { rt?.showView(v) }; compose.mainClock.advanceTimeBy(300); compose.waitForIdle() }
        val nodes = collector.snapshot().nodes
        fun m(part: String) = nodes.firstOrNull { it.name == part }
        val menuCase = "month-menu" in keys || "year-menu" in keys
        val d9 = d9Run && name.startsWith("hook-year") && "year-grid" in keys
        fun near(a: Double, b: Double, label: String, tol: Double = .6, record: String? = null) {
            if (record != null && abs(a - b) > tol) { recorded += "$name $label $a vs $b [$record]"; return }
            check(abs(a - b) <= tol, "$name $label $a vs $b")
        }
        fun rect(b: AWCInspectionBounds?, r: JSONObject?, label: String, tol: Double = .6, recordY: String? = null, recordHeight: String? = null, recordInline: String? = null) {
            if (r == null || (r.optDouble("width") <= 0 && r.optDouble("height") <= 0)) return
            if (b == null) { check(false, "$name $label missing"); return }
            near(b.x, r.getDouble("x"), "$label x", tol, recordInline); near(b.y, r.getDouble("y"), "$label y", tol, recordY)
            near(b.width, r.getDouble("width"), "$label width", tol, recordInline); near(b.height, r.getDouble("height"), "$label height", tol, recordHeight)
        }
        // Font availability (AUDIT exception, n4 2026-11-08): Chrome on macOS draws Arabic / Hebrew labels with Geeza Pro / Lucida
        // Grande (the shared fallback list matches them on macOS); Android ships neither, so its Noto faces' advances set the
        // month toggle's width (and, in RTL, its x). Recorded, never counted as passed.
        val fontAvailability = if (name == "cal-locale-ar-EG" || name == "cal-locale-he-IL") "font availability: no Geeza Pro / Lucida Grande on Android" else null
        val d3 = if (menuCase) "decision 3" else null; val d9r = if (d9) "decision 9" else null
        val h = c.getJSONObject("host"); val modal = props.optString("variant") == "modal"
        if (!modal) { val root = m("md-date-picker"); if (root == null) { check(false, "$name measured"); return }; rect(root.bounds, h, "host") }
        val direct = setOf("modal", "scrim", "panel", "header", "supporting", "headline", "mode-toggle", "body", "nav", "month-toggle", "prev-button", "next-button",
            "calendar", "weekdays", "grid", "actions", "cancel-button", "ok-button", "year-grid", "year-grid-scroll", "year-grid-wrap", "entry", "entry-input",
            "month-menu-button", "year-menu-button", "prev-month-chevron-slot", "next-month-chevron-slot", "prev-year-chevron-slot", "next-year-chevron-slot",
            "calendar-button", "selection-divider")
        var weekday = 0; val optionIndex = mutableMapOf<String, Int>()
        val els = c.getJSONArray("elements").objects()
        for (e in els) {
            val key = e.getString("key"); val r = e.optJSONObject("rect")
            when {
                key == "body" || key == "panel" -> rect(m(key)?.bounds, r, key, recordHeight = d3)
                key == "actions" || key == "cancel-button" || key == "ok-button" -> rect(m(key)?.bounds, r, key, recordY = d3)
                key == "year-grid" -> rect(m(key)?.bounds, r, key, recordY = d9r)
                key == "month-toggle" -> rect(m(key)?.bounds, r, key, recordInline = fontAvailability)
                key in direct -> rect(m(key)?.bounds, r, key)
                key == "month-menu" || key == "year-menu" -> rect(m(key)?.bounds, r, key, recordHeight = d3)
                key == "month-option" || key == "year-option" -> {
                    // Entry i is month i + 1 / year min + i; geometry relative to the selected entry on both sides.
                    val options = els.filter { it.getString("key") == key }
                    val i = optionIndex.getOrDefault(key, 0); optionIndex[key] = i + 1
                    val selW = options.firstOrNull { it.optString("part").contains("-option-selected") } ?: continue
                    val year = key == "year-option"
                    val viewYear = AWCDay.iso(props.optString("value", ""))?.year ?: 2025
                    val first = if (year) (AWCDay.iso(props.optString("min", ""))?.year ?: (viewYear - 100)) else 1
                    val selectedN = if (year) rt?.viewYear else rt?.viewMonth
                    val n = nodes.firstOrNull { it.id.endsWith("$key-${first + i}") }; val sel = nodes.firstOrNull { it.id.endsWith("$key-$selectedN") }
                    if (n == null || sel == null) { check(false, "$name $key ${first + i} missing (lazy list: off-screen)"); continue }
                    val rr = r ?: continue
                    near(n.bounds.x, rr.getDouble("x"), "$key ${first + i} x"); near(n.bounds.width, rr.getDouble("width"), "$key ${first + i} width")
                    near(n.bounds.height, rr.getDouble("height"), "$key ${first + i} height")
                    near(n.bounds.y - sel.bounds.y, rr.getDouble("y") - selW.getJSONObject("rect").getDouble("y"), "$key ${first + i} y from selected")
                    check(((first + i) == selectedN) == e.optString("part").contains("-option-selected"), "$name $key ${first + i} selected")
                }
                key == "md-text-field#0/container" -> rect(m("container")?.bounds, r, "field container")
                key == "md-text-field#0/label" -> rect(m("label")?.bounds, r, "field label", 1.0)
                key == "md-text-field#0/supporting-text" -> rect(m("supporting-text")?.bounds, r, "field supporting", 1.0)
                key == "weekday" -> { rect(nodes.firstOrNull { it.id.endsWith(".weekday-$weekday") }?.bounds, r, "weekday $weekday"); weekday++ }
                // The trigger: the embedded md-text-field's root (the picker's `field` part).
                key == "field" -> rect(nodes.firstOrNull { it.id.endsWith(".field") }?.bounds, r, key)
                key == "day" -> {
                    val iso = e.optJSONObject("attrs")?.optString("data-date").orEmpty()
                    val n = m("day-$iso"); rect(n?.bounds, r, "day $iso")
                    val d = AWCDay.iso(iso)
                    if (n != null && d != null && rt != null) {
                        val parts = e.optString("part").split(" ")
                        check((rt.pending == d) == ("day-selected" in parts), "$name day $iso selected")
                    }
                }
                key == "year" -> rect(m("year-${e.optString("text")}")?.bounds, r, "year ${e.optString("text")}", recordY = d9r)
                else -> continue
            }
        }
        // Pixels (above a docked list only: decision 3).
        val clip = c.getJSONObject("clip")
        val divider = els.firstOrNull { it.getString("key") == "selection-divider" }?.optJSONObject("rect")
        val ch = if (menuCase && divider != null) kotlin.math.ceil(divider.getDouble("y") + divider.getDouble("height")).toInt() + 1 - clip.getInt("y") else clip.getInt("height")
        val box = JSONObject(clip.toString()).put("height", ch)
        var shot = compose.onRoot().captureToImage()
        val pm = shot.toPixelMap()
        val cx = box.getInt("x"); val cy = box.getInt("y"); val cw = box.getInt("width")
        val nat = if ((cx + cw) * 2 <= pm.width && (cy + ch) * 2 <= pm.height) CardWeb.nativeGrid(pm, cx, cy, cw, ch) else {
            // A clip beyond the emulator's screen (a 1200-dp viewport at 2 px per dp): the scene's offscreen recording (the same
            // draw, not clipped to the window) supplies it; its on-screen part must match the window capture.
            val layer = sceneLayer!!
            val recording = kotlinx.coroutines.runBlocking(kotlinx.coroutines.Dispatchers.Main) { layer.toImageBitmap() }; shot = recording
            val lm = recording.toPixelMap()
            val ow = minOf(cw, pm.width / 2 - cx); val oh = minOf(ch, pm.height / 2 - cy)
            // (A clip entirely beyond the screen — the end-aligned docked panel — has no on-screen part to compare.)
            if (ow > 40 && oh > 40) {
                val agree = CardWeb.compare(CardWeb.nativeGrid(lm, cx, cy, ow, oh), CardWeb.nativeGrid(pm, cx, cy, ow, oh), emptyList())
                check(agree.getInt("compared") > 1000 && agree.getInt("over6") == 0 && agree.getDouble("mean") <= 0.1, "$name offscreen recording vs window capture $agree")
            }
            CardWeb.nativeGrid(lm, cx, cy, cw, ch)
        }
        val res = CardWeb.compare(CardWeb.webGrid("$file/$name.png", box), nat, emptyList())
        val area = max(1, (box.getInt("width") - 2) * (ch - 2))
        check(res.getInt("compared").toDouble() / area > .5 && res.getInt("over6").toDouble() / max(1, res.getInt("compared")) <= .005 && res.getDouble("mean") <= 1.0, "$name flat pixels $res")
        report.put(res.put("case", name))
        // Evidence: the native picture of a case with more than a trace of differing flat pixels (they pass up to 0.5 %).
        if (res.getInt("over6") > 400) AccordionEvidence.png("datepicker-$name", shot)
        compose.runOnIdle { controller.close() }; compose.mainClock.advanceTimeBy(100); compose.waitForIdle()
    }
}
