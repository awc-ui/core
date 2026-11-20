package dev.awc.playground

import android.view.KeyEvent
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
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.test.platform.app.InstrumentationRegistry
import dev.awc.nativeui.*
import dev.awc.playground.CardWeb.objects
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import kotlin.math.abs

/**
 * md-date-picker interaction against Chrome 153 (the Mac capture shared byte-identically with
 * NativeDatePickerStatesIntegration.swift: 24 runs and the same 24 under reduced motion; today pinned to 2025-06-12): the
 * modal day and year keyboards in both directions, pointer picks, the year grid, dismissal (scrim, Escape, a non-dismissing
 * scrim), commit on select, the entry mode, the modal-input field, the docked panel (pointer menus, Shift+M / Shift+Y, outside
 * presses, clear), a required form, min / max clamping, the focus trap and a phone viewport. Each phase replays Chrome's input
 * at its recorded time on the test clock (density 1: the 1200 × 900 dp viewport fits the device); checks: the md* events with
 * every detail, per phase the end state (value, open, focused part, roving tab stop, selected day, view label, open menu, year
 * scroll, trigger / entry text, error) and every Chrome motion sample at its time into the native run (latency printed).
 */
@OptIn(ExperimentalTestApi::class)
class NativeDatePickerStatesTest {
    @get:Rule val compose = createComposeRule()
    private var run by mutableStateOf(JSONObject("{\"name\":\"init\",\"props\":{}}"))
    private var props by mutableStateOf<Map<String, Any?>>(emptyMap())
    private var reduced by mutableStateOf(false); private var phone by mutableStateOf(false); private var epoch by mutableIntStateOf(0)
    private val collector = AWCInspectionCollector(); private val controller = AWCDatePickerController()
    private val events = mutableListOf<Pair<String, Any?>>()
    private val outside = FocusRequester()
    private var checks = 0; private val failures = mutableListOf<String>(); private val report = JSONArray()
    private val latencies = mutableMapOf<String, MutableList<Double>>()
    private fun check(ok: Boolean, label: String) { checks++; if (!ok) { failures += label; android.util.Log.i("AWCAccordion", "FAIL: $label") } }
    private val rt get() = AWCDatePickerRuntime.mounted["dp"]?.get()
    private fun content() { compose.setContent { CompositionLocalProvider(LocalDensity provides Density(1f, 1f)) {
        val r = run; val rtl = r.optString("dir") == "rtl"; val vw = if (phone) 360.0 else 1200.0; val vh = if (phone) 640.0 else 900.0
        val modal = (props["variant"] as? String) == "modal"
        AWCTheme(r.optString("theme") == "dark") { AWCAccessibilityAppearanceScope(reducedMotion = reduced) {
            Box(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.surface)) { key(epoch) {
                Box(Modifier.wrapContentSize(Alignment.TopStart, unbounded = true).requiredSize(vw.dp, vh.dp)) {
                    AWCModalScope(Modifier.fillMaxSize(), insets = WindowInsets(0.dp, 0.dp, 0.dp, 0.dp)) { AWCColorPickerScope(Modifier.fillMaxSize()) {
                        Box(Modifier.absoluteOffset((vw - 60).dp, 4.dp).size(40.dp, 24.dp).focusRequester(outside).focusable())
                        Box(Modifier.absoluteOffset(24.dp, 24.dp).width((if (modal) 1.0 else if (phone) 320.0 else 360.0).dp)) {
                            CompositionLocalProvider(LocalLayoutDirection provides if (rtl) LayoutDirection.Rtl else LayoutDirection.Ltr) {
                                AWCDatePickerTodayScope(AWCDay(2025, 6, 12)) { AWCDatePickerControllerScope(controller) { AWCInspectionScope(collector) {
                                    // The page binds `open` / `value` to the element's properties, which the component itself changes.
                                    AWCComponent("md-date-picker", props + ("id" to "dp"), onEvent = { n, v ->
                                        if (n.startsWith("md")) events += n to v
                                        when (n) { "mdOpen" -> props = props + ("open" to true); "mdClose" -> props = props + ("open" to false)
                                            "mdChange" -> (v as? Map<*, *>)?.get("value")?.let { props = props + ("value" to it) } }
                                    })
                                } } }
                            }
                        }
                    } }
                }
            } }
        } }
    } } }
    @Test fun datePickerInteractionMatchesChrome() {
        content()
        val only = InstrumentationRegistry.getArguments().getString("awcDpOnly")
        val reducedOnly = InstrumentationRegistry.getArguments().getString("awcDpReducedOnly") != null
        for ((file, red) in listOf("DatePickerWebStates.json" to false, "DatePickerWebStatesReduced.json" to true)) {
            if (reducedOnly && !red) continue
            for (r in CardWeb.document(file).getJSONArray("runs").objects()) if (only == null || only.split(",").any { r.getString("name").contains(it) }) runCase(r, red)
        }
        if (only == null) yearGridScrolls()
        for ((k, l) in latencies.toSortedMap()) { val v = l.sorted(); android.util.Log.i("AWCAccordion", "motion latency $k: median ${v[v.size / 2].toInt()} ms, max ${v.last().toInt()} ms (${v.size} samples)") }
        android.util.Log.i("AWCAccordion", "Date picker native interaction states (Android): ${checks - failures.size}/$checks checks passed")
        AccordionEvidence.log("datepicker-states", JSONObject().put("checks", checks).put("failures", failures.size).put("failureList", JSONArray(failures.take(600))).put("report", report))
        assertTrue("${failures.size} of $checks failed:\n" + failures.take(80).joinToString("\n"), failures.isEmpty())
    }
    /** Native check (no oracle run scrolls): the year grid is `overflow-y: auto` — a drag scrolls the years and is not a pick. */
    private fun yearGridScrolls() {
        compose.mainClock.autoAdvance = true
        events.clear(); collector.clear(); reduced = true; phone = false; run = JSONObject("{\"name\":\"year-scroll\",\"props\":{}}")
        props = mapOf("variant" to "modal", "value" to "2025-06-18"); epoch++; compose.waitForIdle()
        compose.runOnIdle { controller.show() }; compose.waitForIdle()
        fun box(part: String) = collector.snapshot().nodes.firstOrNull { it.name == part }?.bounds
        val toggle = box("month-toggle")
        if (toggle == null) { check(false, "year-scroll: no month toggle"); return }
        compose.onRoot().performMouseInput { moveTo(Offset((toggle.x + toggle.width / 2).toFloat(), (toggle.y + toggle.height / 2).toFloat()), 0); press(); release() }; compose.waitForIdle()
        val scroll = box("year-grid-scroll"); val before = rt?.yearScrollTop
        check(scroll != null && before != null, "year-scroll: the year view is open ($scroll, $before)")
        if (scroll == null || before == null) return
        val x = (scroll.x + scroll.width / 2).toFloat(); val y0 = (scroll.y + scroll.height - 40).toFloat()
        compose.onRoot().performTouchInput { down(Offset(x, y0)); repeat(10) { moveBy(Offset(0f, -12f), 16) }; up() }; compose.waitForIdle()
        val after = rt?.yearScrollTop
        check(after != null && after - before >= 80.0, "year-scroll: a 120 px drag (and its fling) scrolls the years ($before → $after)")
        check(rt?.yearView == true && rt?.viewYear == 2025 && events.none { it.first == "mdMenuSelect" }, "year-scroll: the drag picks nothing (${events.map { it.first }})")
        compose.onRoot().performTouchInput { down(Offset(x, (scroll.y + 40).toFloat())); repeat(10) { moveBy(Offset(0f, 190f), 16) }; up() }; compose.waitForIdle()
        check(rt?.yearScrollTop == 0.0, "year-scroll: the scroll stops at the first row (${rt?.yearScrollTop})")
        compose.runOnIdle { controller.close() }; compose.waitForIdle()
    }
    private fun matrix(t: String?): DoubleArray { if (t == null || !t.startsWith("matrix(")) return doubleArrayOf(1.0, 0.0, 0.0, 1.0, 0.0, 0.0)
        return t.removePrefix("matrix(").removeSuffix(")").split(",").map { it.trim().toDouble() }.toDoubleArray() }
    /** A md* event as text: every detail; a `date` as its civil day (Chrome reports local midnight in UTC). */
    private fun text(name: String, d: Any?): String {
        fun v(k: String, x: Any?): String = when {
            x == null || x == JSONObject.NULL -> "null"
            x is Map<*, *> -> "{" + x.keys.map { it.toString() }.sorted().filter { x[it] == true }.joinToString(",") + "}"
            x is JSONObject -> "{" + x.keys().asSequence().sorted().filter { x.optBoolean(it) }.joinToString(",") + "}"
            x is Boolean -> x.toString()
            x is Number -> x.toDouble().toInt().toString()
            k == "date" && x.toString().contains("T") -> java.time.Instant.parse(x.toString()).plusSeconds(12 * 3600).toString().substring(0, 10)
            else -> x.toString()
        }
        return when (d) {
            is Map<*, *> -> name + "(" + d.keys.map { it.toString() }.sorted().joinToString(",") { "$it=" + v(it, d[it]) } + ")"
            is JSONObject -> name + "(" + d.keys().asSequence().sorted().joinToString(",") { "$it=" + v(it, d.get(it)) } + ")"
            else -> name
        }
    }
    /** The native focused part as Chrome's deep active element below the host. */
    private fun focusedPart(): String {
        val r = rt ?: return "body"
        when (r.inputFocus) { "entry" -> return "md-date-picker > entry-input > input"; "field" -> return "md-date-picker > field > input" }
        val f = r.focusedControl ?: return "body"
        return when {
            f.startsWith("day-") -> "md-date-picker > " + f.removePrefix("day-")
            f.startsWith("month-option-") -> "md-date-picker > month-option" + if (f.removePrefix("month-option-").toIntOrNull() == r.viewMonth) " month-option-selected" else ""
            f.startsWith("year-option-") -> "md-date-picker > year-option" + if (f.removePrefix("year-option-").toIntOrNull() == r.viewYear) " year-option-selected" else ""
            f.startsWith("year-") && f.removePrefix("year-").toIntOrNull() != null -> "md-date-picker > " + f.removePrefix("year-")
            f == "entry" -> "md-date-picker > entry-input > input"
            else -> "md-date-picker > $f"
        }
    }
    private fun key(code: Int, meta: Int = 0) {
        val ins = InstrumentationRegistry.getInstrumentation(); val t = android.os.SystemClock.uptimeMillis()
        ins.sendKeySync(KeyEvent(t, t, KeyEvent.ACTION_DOWN, code, 0, meta)); ins.sendKeySync(KeyEvent(t, t + 10, KeyEvent.ACTION_UP, code, 0, meta))
        compose.waitForIdle()
    }
    private val codes = mapOf("ArrowUp" to KeyEvent.KEYCODE_DPAD_UP, "ArrowDown" to KeyEvent.KEYCODE_DPAD_DOWN, "ArrowLeft" to KeyEvent.KEYCODE_DPAD_LEFT,
        "ArrowRight" to KeyEvent.KEYCODE_DPAD_RIGHT, "Home" to KeyEvent.KEYCODE_MOVE_HOME, "End" to KeyEvent.KEYCODE_MOVE_END, "PageUp" to KeyEvent.KEYCODE_PAGE_UP,
        "PageDown" to KeyEvent.KEYCODE_PAGE_DOWN, "Enter" to KeyEvent.KEYCODE_ENTER, " " to KeyEvent.KEYCODE_SPACE, "Escape" to KeyEvent.KEYCODE_ESCAPE,
        "Tab" to KeyEvent.KEYCODE_TAB, "M" to KeyEvent.KEYCODE_M, "Y" to KeyEvent.KEYCODE_Y, "a" to KeyEvent.KEYCODE_A)
    /** "Shift+PageDown", "Alt+ArrowDown", "Control+End", "Shift+M", "Shift+Tab", " ". */
    private fun press(label: String) {
        val parts = if (label == " ") listOf(" ") else label.split("+")
        var meta = 0
        for (m in parts.dropLast(1)) meta = meta or when (m) { "Shift" -> KeyEvent.META_SHIFT_ON or KeyEvent.META_SHIFT_LEFT_ON
            "Alt" -> KeyEvent.META_ALT_ON or KeyEvent.META_ALT_LEFT_ON; "Control" -> KeyEvent.META_CTRL_ON or KeyEvent.META_CTRL_LEFT_ON; else -> KeyEvent.META_META_ON }
        val code = codes[parts.last()] ?: run { check(false, "no key for $label"); return }
        key(code, meta)
    }
    private fun typeChar(ch: Char) = key(if (ch == '/') KeyEvent.KEYCODE_SLASH else KeyEvent.KEYCODE_0 + (ch - '0'))

    private fun runCase(r: JSONObject, red: Boolean) {
        val name = (if (red) "reduced/" else "") + r.getString("name")
        android.util.Log.i("AWCAccordion", "datepicker-states run $name")
        compose.mainClock.autoAdvance = true
        compose.onRoot().performMouseInput { moveTo(Offset(2f, 2f), 0) }
        events.clear(); collector.clear(); reduced = red; phone = r.getString("name").startsWith("phone-"); run = r
        props = NativeDatePickerPaintTest.props(r); epoch++; compose.waitForIdle()
        compose.mainClock.autoAdvance = false; compose.mainClock.advanceTimeBy(100); compose.waitForIdle(); events.clear()
        fun node(part: String) = collector.snapshot().nodes.firstOrNull { it.name == part }?.bounds
        fun center(part: String): Offset? { val b = node(part) ?: return null; return Offset((b.x + b.width / 2).toFloat(), (b.y + b.height / 2).toFloat()) }
        fun click(p: Offset?, what: String) {
            if (p == null) { check(false, "$name no target for $what"); return }
            compose.onRoot().performMouseInput { moveTo(p, 0); press(); release() }; compose.waitForIdle()
        }
        fun day(d: Int): Offset? { val v = rt ?: return null; return center("day-" + AWCDay(v.viewYear, v.viewMonth, d).iso) }
        // The entry was revealed before the phase's time (after the previous phase's check), so the click lands at Chrome's time.
        fun option(kind: String, n: Int): Offset? {
            return collector.snapshot().nodes.firstOrNull { it.id.endsWith("$kind-$n") }?.bounds?.let { Offset((it.x + it.width / 2).toFloat(), (it.y + it.height / 2).toFloat()) } }
        val vw = if (phone) 360f else 1200f; val vh = if (phone) 640f else 900f
        fun act(lbl: String) {
            when {
                lbl == "show" -> compose.runOnIdle { controller.show() }
                lbl == "open" || lbl == "open-calendar" -> click(center("calendar-button"), lbl)
                lbl == "clear" -> click(center("clear-button"), lbl)
                lbl == "focus-field" -> compose.runOnIdle { controller.focusInput() }
                lbl == "ok" -> click(center("ok-button"), lbl)
                lbl == "cancel" -> click(center("cancel-button"), lbl)
                lbl == "to-entry" || lbl == "to-calendar" -> click(center("mode-toggle"), lbl)
                lbl == "open-years" -> click(center("month-toggle"), lbl)
                lbl == "month-menu" -> click(center("month-menu-button"), lbl)
                lbl == "year-menu" -> click(center("year-menu-button"), lbl)
                lbl == "next-month" -> click(center("next-button") ?: center("next-month-button"), lbl)
                lbl == "prev-month" -> click(center("prev-button") ?: center("prev-month-button"), lbl)
                lbl == "prev-year" -> click(center("prev-year-button"), lbl)
                lbl == "pick-sep" -> click(option("month-option", 9), lbl)
                lbl == "pick-feb" -> click(option("month-option", 2), lbl)
                lbl == "pick-year+2" -> click(option("year-option", (rt?.viewYear ?: 0) + 2), lbl)
                // Any scrim point / any point outside the docked field and panel inside the device's 1080-px screen (Chrome: 1150, 850 / 1100, 120).
                lbl == "scrim" || lbl == "scrim-ignored" -> click(if (phone) Offset(vw - 50, vh - 50) else Offset(60f, vh - 50), lbl)
                lbl == "outside" || lbl == "outside-ignored" -> click(Offset(if (phone) vw - 20 else 700f, 120f), lbl)
                lbl == "Control+a" -> press("Control+a")
                lbl == "submit-empty" || lbl == "form-data" -> {}
                lbl == "reset" -> props = props + ("value" to "")
                lbl.startsWith("focus-") -> compose.runOnIdle { rt?.focusPart("day-" + lbl.removePrefix("focus-")) }
                lbl.startsWith("pick-day-") -> click(day(lbl.removePrefix("pick-day-").toIntOrNull() ?: 1), lbl)
                lbl.startsWith("pick-") -> { val n = lbl.removePrefix("pick-").toIntOrNull() ?: 0; click(if (n > 1000) center("year-$n") else day(n), lbl) }
                else -> press(lbl)
            }
        }
        val phases = r.getJSONArray("phases").objects()
        val webRuns = r.optJSONArray("anims")?.objects()?.mapNotNull { a -> val target = a.optString("target"); val prop = a.optString("property")
            if (!prop.startsWith("md-date-picker-")) null else target.split(" ").getOrNull(1)?.let { it to a.getDouble("start") } } ?: emptyList()
        val clock0 = compose.mainClock.currentTime + 50
        fun elapsed() = (compose.mainClock.currentTime - clock0).toDouble()
        fun advance() { compose.mainClock.advanceTimeByFrame(); compose.waitForIdle() }
        for ((i, ph) in phases.withIndex()) {
            val lbl = ph.getString("label"); val t = ph.getDouble("t")
            while (elapsed() < t) advance()
            if (lbl.startsWith("type-")) {
                // The page types "MM/DD/YYYY"; its label keeps the digits only.
                var typed = lbl.removePrefix("type-"); if (typed.length == 8) typed = typed.substring(0, 2) + "/" + typed.substring(2, 4) + "/" + typed.substring(4)
                for ((k, ch) in typed.withIndex()) { while (elapsed() < t + k * 33.3) advance(); typeChar(ch) }
            } else act(lbl)
            val next = if (i + 1 < phases.size) phases[i + 1].getDouble("t") else t + 900
            // A docked list entry the next phase clicks is revealed after this phase's check, 110 ms ahead, so the click itself is
            // replayed at Chrome's time (Chrome's lists show every entry: nothing scrolls there).
            val nextLabel = if (i + 1 < phases.size) phases[i + 1].getString("label") else ""
            val reveal: Int? = when (nextLabel) { "pick-sep" -> 9; "pick-feb" -> 2; "pick-year+2" -> (rt?.viewYear ?: 0) + 2; else -> null }
            while (elapsed() < next - (if (reveal == null) 20 else 110)) advance()
            phaseEnd(name, lbl, ph, clock0.toDouble(), webRuns)
            if (reveal != null) compose.runOnIdle { rt?.revealMenuEntry?.invoke(reveal) }
        }
        repeat(12) { advance() }
        val web = r.getJSONArray("events").objects().filter { it.getString("name").startsWith("md") }.map { text(it.getString("name"), it.opt("detail")) }
        val native = events.filter { it.first.startsWith("md") }.map { text(it.first, it.second) }
        val d0 = native.indices.firstOrNull { it >= web.size || native[it] != web[it] } ?: if (native.size < web.size) native.size else -1
        check(native == web, "$name events differ at $d0: native ${native.drop(maxOf(0, d0 - 1)).take(3)} vs web ${web.drop(maxOf(0, d0 - 1)).take(3)} (${native.size} vs ${web.size})")
        report.put(JSONObject().put("run", name).put("events", native.size).put("webEvents", web.size))
        if (rt?.isOpen == true) { compose.runOnIdle { controller.close() }; repeat(30) { advance() } }
        compose.runOnIdle { outside.requestFocus() }; repeat(2) { advance() }
        compose.mainClock.autoAdvance = true
    }
    private fun phaseEnd(name: String, lbl: String, ph: JSONObject, clock0: Double, webRuns: List<Pair<String, Double>>) {
        val ss = ph.getJSONArray("samples"); val last = if (ss.length() > 0) ss.getJSONObject(ss.length() - 1) else return
        val label = "$name/$lbl"; val r = rt
        val value = props["value"]?.toString() ?: ""
        check(value == last.optString("value"), "$label value $value vs ${last.optString("value")}")
        check((r?.isOpen ?: false) == last.optBoolean("open"), "$label open ${r?.isOpen} vs ${last.opt("open")}")
        val nf = focusedPart(); val wf = last.optString("active", "body")
        check(nf == wf, "$label focus $nf vs $wf")
        val webStops = last.optJSONArray("tabbable")?.let { a -> (0 until a.length()).map { a.getString(it) } } ?: listOfNotNull(last.optString("tabbable").takeIf { it.isNotEmpty() })
        check((r?.tabStops ?: emptyList()) == webStops, "$label tab stops ${r?.tabStops} vs $webStops")
        // The selected day as rendered: the staged day when the day grid shows it.
        val p = props; val loc = AWCDateLocale((p["locale"] as? String).orEmpty().ifEmpty { "en-US" })
        val fd = (p["firstDayOfWeek"] as? Number)?.toInt()?.takeIf { it in 0..6 } ?: loc.firstDayOfWeek
        val gridShown = r != null && r.isOpen && !r.inputMode && !r.yearView && !r.monthMenuOpen && !r.yearMenuOpen
        val selected = if (gridShown && r!!.pending != null && AWCDatePickerModel.monthMatrix(r.viewYear, r.viewMonth, fd).any { it.day == r.pending }) r.pending!!.iso else null
        val webSelected = if (last.isNull("selected")) null else last.optString("selected")
        check(selected == webSelected, "$label selected ${selected ?: "-"} vs ${webSelected ?: "-"}")
        // The view label: the month toggle (modal) or the month and year menu buttons (docked), without the caret glyphs.
        val webView = last.optString("view").split(" ").map { it.replace("arrow_drop_down", "").replace("arrow_drop_up", "").trim() }.filter { it.isNotEmpty() }.joinToString(" ")
        val docked = (p["variant"] as? String) == "docked"
        val nativeView = if (r == null || !r.isOpen || (r.inputMode && !docked)) "" else if (docked) loc.format(AWCDay(r.viewYear, r.viewMonth, 1), "MMM") + " " + r.viewYear
            else loc.format(AWCDay(r.viewYear, r.viewMonth, 1), "yMMMM")
        check(nativeView == webView, "$label view $nativeView vs $webView")
        val menus = (r?.monthMenuOpen ?: false) to (r?.yearMenuOpen ?: false)
        check(menus.first == !last.isNull("monthMenu") && menus.second == !last.isNull("yearMenu"), "$label menus $menus vs ${!last.isNull("monthMenu")}, ${!last.isNull("yearMenu")}")
        val scroll = r?.yearScrollTop; val webScroll = if (last.isNull("yearScrollTop")) null else last.optDouble("yearScrollTop")
        check((scroll == null) == (webScroll == null) && abs((scroll ?: 0.0) - (webScroll ?: 0.0)) <= 1, "$label year scroll ${scroll ?: "-"} vs ${webScroll ?: "-"}")
        val nativeField = r?.entryText ?: r?.fieldText; val webField = if (last.isNull("fieldValue")) null else last.optString("fieldValue")
        check(nativeField == webField, "$label field ${nativeField ?: "-"} vs ${webField ?: "-"}")
        val webEntry = if (last.isNull("entryValue")) null else last.optString("entryValue")
        check(r?.entryText == webEntry, "$label entry ${r?.entryText ?: "-"} vs ${webEntry ?: "-"}")
        val msg = r?.validationMessage ?: ""; val error = msg.isNotEmpty() || p["error"] == true
        check(error == last.optBoolean("error") && msg == last.optString("errorText"), "$label error $error $msg vs ${last.opt("error")} ${last.optString("errorText")}")
        // Motion: every Chrome sample of a running keyframe animation at its time into Chrome's run, against the native values
        // at the same time into the native run (the first native start 150 ms before to 400 ms after Chrome's; 700 for the calendar).
        for (smp in ss.objects()) {
            val st = smp.optDouble("t", Double.NaN); if (st.isNaN()) continue
            for ((webKey, part, comps) in listOf(Triple("panel", "panel", listOf(0, 1, 2)), Triple("scrim", "scrim", listOf(0)), Triple("calendar", "calendar", listOf(0, 1, 2)),
                Triple("grid", "grid", listOf(3)), Triple("monthMenu", "month-menu-wrap", listOf(0, 1, 2)), Triple("yearMenu", "year-menu-wrap", listOf(0, 1, 2)),
                Triple("yearWrap", "year-grid-wrap", listOf(0, 1, 2)))) {
                val o = smp.optJSONObject(webKey) ?: continue
                val anim = o.optString("animation"); if (anim.isEmpty() || anim == "none") continue
                val webStart = webRuns.filter { it.first == part && it.second <= st + 1 }.maxOfOrNull { it.second } ?: continue
                val m = matrix(o.optString("transform"))
                val webV = listOf(o.optString("opacity").toDoubleOrNull() ?: 1.0, m[0], m[5], m[4])
                val rr = r ?: continue
                val list = rr.motion[webKey]; if (list.isNullOrEmpty()) { check(false, "$label t=${st.toInt()} $webKey never presented natively"); continue }
                val start = rr.runStarts[webKey]?.firstOrNull { it - clock0 >= webStart - 150 && it - clock0 <= webStart + (if (webKey == "calendar") 700 else 400) }
                if (start == null) { check(false, "$label t=${st.toInt()} $webKey no native run near Chrome's start ${webStart.toInt()}"); continue }
                latencies.getOrPut(webKey) { mutableListOf() } += start - clock0 - webStart
                val at = start + (st - webStart)
                val before = list.lastOrNull { it.first <= at + .5 }?.second ?: list.first().second; val after = list.firstOrNull { it.first >= at - .5 }?.second ?: list.last().second
                val tol = listOf(.03, .006, .35, 2.0)
                val ok = comps.all { k -> webV[k] >= minOf(before[k], after[k]) - tol[k] && webV[k] <= maxOf(before[k], after[k]) + tol[k] }
                check(ok, "$label t=${st.toInt()} $webKey +${(st - webStart).toInt()}ms web ${comps.map { Math.round(webV[it] * 1000) / 1000.0 }} vs native ${comps.map { Math.round(before[it] * 1000) / 1000.0 }}…${comps.map { Math.round(after[it] * 1000) / 1000.0 }}")
            }
        }
    }
}
