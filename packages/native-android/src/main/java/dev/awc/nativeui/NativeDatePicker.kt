@file:OptIn(androidx.compose.ui.ExperimentalComposeUiApi::class)
package dev.awc.nativeui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.focusGroup
import androidx.compose.foundation.focusable
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.waitForUpOrCancellation
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.gestures.draggable
import androidx.compose.animation.core.animateDecay
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusProperties
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.TransformOrigin
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.key.*
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.PointerEventType
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.layout.Placeable
import androidx.compose.ui.layout.layout
import androidx.compose.ui.layout.boundsInRoot
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.platform.LocalWindowInfo
import androidx.compose.ui.semantics.*
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.LineHeightStyle
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.zIndex
import kotlinx.coroutines.launch
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

// md-date-picker (packages/core/src/components/md-date-picker): dedicated Compose renderer, a port of AWCUI's
// NativeDatePicker.swift with the Web anatomy (decision 1). modal-input: an md-text-field trigger (typed entry, clear and
// calendar buttons) and a modal dialog; modal: the dialog alone (`open` / show()); docked: the trigger and a panel anchored
// under it with month / year menus. The dialog is hosted by the nearest AWCModalScope (viewport, scrim, Escape / back / Tab
// routing), as md-dialog and md-time-picker are; the panel's parts are md-button / md-icon-button / md-text-field children.

private val DPStandard = listOf(.2, 0.0, 0.0, 1.0)
private val DPEmphasized = listOf(.2, 0.0, 0.0, 1.0)
private val DPDecelerate = listOf(.05, .7, .1, 1.0)
private val DPAccelerate = listOf(.3, 0.0, .8, .15)
private fun dpProgress(elapsed: Double, duration: Double, curve: List<Double>): Double {
    if (duration <= 0) return 1.0
    val t = (elapsed / duration).coerceIn(0.0, 1.0)
    return if (t == 0.0) 0.0 else if (t == 1.0) 1.0 else accordionCubicBezier(t, curve)
}
/** md-date-picker-selection-bloom-in (the docked calendar's from scale 0.92): opacity 0, translateY 8, scale → 1. */
private fun dpBloomIn(p: Double, from: Double = .94) = listOf(p, from + (1 - from) * p, 8 * (1 - p), 0.0)
/** md-date-picker-panel-bloom-out / selection-bloom-out: opacity 1 → 0, translateY 0 → 4, scale 1 → 0.96. */
private fun dpBloomOut(p: Double) = listOf(1 - p, 1 - .04 * p, 4 * p, 0.0)
private val DPLineBox = LineHeightStyle(LineHeightStyle.Alignment.Center, LineHeightStyle.Trim.None)
private fun dpText(size: Double, weight: Double, line: Double, color: Color, spacing: Double = 0.0, align: TextAlign = TextAlign.Start) =
    TextStyle(fontFamily = AccordionRoboto, fontWeight = FontWeight(weight.roundToInt().coerceIn(1, 1000)), fontSize = size.sp, lineHeight = line.sp,
        letterSpacing = spacing.sp, color = color, textAlign = align, lineHeightStyle = DPLineBox,
        platformStyle = androidx.compose.ui.text.PlatformTextStyle(includeFontPadding = false))
/** `#RRGGBB[AA]` with its alpha multiplied by [a] (`color-mix(in srgb, c a%, transparent)`), as `#RRGGBBAA`. */
internal fun dpAlpha(hex: String, a: Double): String {
    val h = hex.trim().removePrefix("#")
    val rgb = if (h.length >= 6) h.substring(0, 6) else "000000"
    val alpha = if (h.length == 8) (h.substring(6, 8).toIntOrNull(16) ?: 255) / 255.0 else 1.0
    return "#" + rgb.uppercase() + String.format(java.util.Locale.ROOT, "%02X", (alpha * a * 255).roundToInt().coerceIn(0, 255))
}

/** A keyframe animation of the source (CSS `animation` with `both` fill): the run `token` starts with the first frame that
 *  renders it and presents values(progress) = [opacity, scale, translateY, translateX]; a null token or reduced motion
 *  presents the end state. */
@Composable
private fun DPKeyframes(rt: AWCDatePickerRuntime, key: String, token: Int?, duration: Double, curve: List<Double>, reduced: Boolean,
                        modifier: Modifier = Modifier, origin: TransformOrigin = TransformOrigin.Center, values: (Double) -> List<Double>,
                        content: @Composable () -> Unit) {
    val running = token != null && !reduced
    val start = if (running) rt.runStart(key, token!!, duration) else null
    val now = rt.clock.frameMillis
    val pr = if (!running) 1.0 else if (start == null) 0.0 else dpProgress(now - start, duration, curve)
    val v = values(pr)
    rt.record(key, v)
    Box(modifier.graphicsLayer {
        alpha = v[0].toFloat().coerceIn(0f, 1f); scaleX = v[1].toFloat(); scaleY = v[1].toFloat()
        translationY = (v[2] * density).toFloat(); translationX = (v[3] * density).toFloat(); transformOrigin = origin
    }) { content() }
}

/** The source's user-facing strings (all properties, English defaults). */
private class DPLabels(val p: Props) {
    fun s(k: String, f: String) = (p[k] as? String) ?: f
    val label get() = s("label", "Date")
    val headline get() = s("headline", "Select date")
    val selectDate get() = s("selectDateLabel", "Select date")
    val enterDates get() = s("enterDatesLabel", "Enter dates")
    val cancel get() = s("cancelLabel", "Cancel")
    val ok get() = s("okLabel", "OK")
    val clear get() = s("clearLabel", "Clear date")
    val openCalendar get() = s("openCalendarLabel", "Open calendar")
    val closeCalendar get() = s("closeCalendarLabel", "Close calendar")
    val toggleCalendar get() = s("toggleCalendarLabel", "Switch to calendar input")
    val toggleText get() = s("toggleTextLabel", "Switch to text input")
    val chooseMonthYear get() = s("chooseMonthYearLabel", "Choose a different month and year")
    val chooseMonth get() = s("chooseMonthLabel", "Choose month")
    val chooseYear get() = s("chooseYearLabel", "Choose year")
    val previousMonth get() = s("previousMonthLabel", "Previous month")
    val nextMonth get() = s("nextMonthLabel", "Next month")
    val previousYear get() = s("previousYearLabel", "Previous year")
    val nextYear get() = s("nextYearLabel", "Next year")
    val invalidDate get() = s("invalidDateLabel", "Invalid date")
    val valueMissing get() = s("valueMissingLabel", "Please choose a date.")
}

/** md-date-picker. */
@Composable
internal fun NativeDatePicker(p: Props, onEvent: EventSink, slot: Slot?) {
    val emitLatest by rememberUpdatedState(onEvent)
    val rt = remember { AWCDatePickerRuntime() }
    val scope = rememberCoroutineScope()
    val id = p.str("id")
    val variant = p.str("variant").takeIf { it in setOf("modal", "modal-input", "docked") } ?: "modal-input"
    val docked = variant == "docked"
    val disabled = p.bool("disabled")
    var value by awcState(p["value"]) { p.str("value") }
    var open by awcState(p["open"]) { p.bool("open") }
    val tokens = LocalAWCThemeTokens.current
    val rtl = LocalLayoutDirection.current == LayoutDirection.Rtl
    val appearance = LocalAWCDatePickerAppearance.current.merge(LocalAWCDatePickerAppearanceTargets.current[id] ?: AWCDatePickerAppearance())
        .merge(AWCDatePickerAppearance.fromStyle(p.str("style")))
    // The motion hooks set the keyframes' durations and the bloom-in easing; the state changes that follow an exit keep the
    // source's fixed delays (200 ms), as the source's timers do.
    val selBloomMs = appearance.duration("selection-bloom-duration") ?: 450.0
    val selBloomCurve = appearance.easing("selection-bloom-easing") ?: DPDecelerate
    val selOutMs = appearance.duration("selection-bloom-out-duration") ?: 200.0
    val calBloomMs = appearance.duration("calendar-bloom-duration") ?: 300.0
    val gridSlideMs = appearance.duration("grid-slide-duration") ?: 300.0
    val panelOutMs = appearance.duration("panel-bloom-out-duration") ?: 200.0
    val reduced = rememberAWCAccessibilityAppearance().first
    val inherited = LocalAWCNativeDensity.current
    val scale = resolveAWCDensity(p["density"], inherited)
    // The nearest spacing rung that defines the insets / gaps (−1 redefines only row-height): own density, then ancestors'.
    val rung = LocalAWCDensityRungs.current.firstOrNull { it in listOf(-2.0, -3.0, -4.0) } ?: 0.0
    val m = DPMetrics(appearance, scale, rung)
    val locale = remember(p.str("locale")) { AWCDateLocale(p.str("locale")) }
    val pinnedToday = LocalAWCDatePickerToday.current
    val today = pinnedToday ?: remember { AWCDay.today() }
    val controller = LocalAWCDatePickerController.current
    val owner = remember { AWCModalOwner("md-date-picker-" + java.util.UUID.randomUUID()) }
    val triggerFocus = remember { FocusRequester() }
    val entryRequester = remember { FocusRequester() }
    // The document body: a non-tabbable target outside the parts that a press on a non-focusable area (or a removed focused
    // part) leaves focus on, as Chrome blurs to <body> (Android would otherwise move focus to a default control, the field).
    val bodyRequester = remember { FocusRequester() }
    var bodyWanted by remember { mutableStateOf(false) }
    val entryController = remember { AWCTextFieldController() }
    val triggerController = remember { AWCTextFieldController() }
    val inspection = LocalAWCInspection.current
    val slots = LocalAWCSlots.current
    val labels = DPLabels(p)
    val windowInfo = LocalWindowInfo.current
    val pxDensity = LocalDensity.current.density.toDouble()
    fun s(k: String, f: String = "") = p.str(k, f)
    fun b(k: String, f: Boolean = false) = p.bool(k, f)
    fun emit(n: String, d: AWCValue) = emitLatest(n, d)
    fun token(role: String, fallback: String) = tokens["--md-sys-color-$role"] ?: fallback
    fun hook(k: String, role: String, fallback: String) = appearance.color(k) ?: token(role, fallback)
    fun color(hex: String) = awcColor(hex, Color.Black)
    val firstDay = ((p["firstDayOfWeek"] as? Number)?.toInt() ?: p.str("firstDayOfWeek").toIntOrNull())?.takeIf { it in 0..6 } ?: locale.firstDayOfWeek
    val sep = s("dateSeparator")
    fun hasSlot(n: String) = slots?.contains(n) == true
    val hasActionRow = hasSlot("actions") || !b("commitOnSelect") || rt.inputMode
    DisposableEffect(controller, rt) { onDispose { if (controller?.runtime === rt) controller.runtime = null } }
    SideEffect { if (id.isNotEmpty()) AWCDatePickerRuntime.mounted[id] = java.lang.ref.WeakReference(rt) }

    AWCModalImplicitScope(rt.isOpen && !docked) {
        val session = LocalAWCModalSession.current
        val vw = session?.viewportWidth?.takeIf { it > 0 } ?: windowInfo.containerSize.width / pxDensity
        val vh = session?.viewportHeight?.takeIf { it > 0 } ?: windowInfo.containerSize.height / pxDensity
        fun panelWidth(dock: Boolean) = min(if (dock) m.dockedWidth else m.panelWidth, vw - 32)
        fun panelMax(): Double {
            val block = rt.dockedMaxBlock
            if (docked && block != null) return min(block, m.panelMax)
            return min(m.panelMax, vh - 32)
        }

        // MARK: Behaviour (md-date-picker.tsx)
        fun isDisabled(d: AWCDay): Boolean = AWCDatePickerModel.outOfRange(d, s("min"), s("max")) || (controller?.isDateDisabled?.invoke(d) ?: false)
        fun syncValidity(v: String) {
            val missing = b("required") && v.isEmpty(); val custom = rt.customValidity
            val message = if (missing) labels.valueMissing else custom
            rt.validityFlag = if (missing) "valueMissing" else if (custom.isNotEmpty()) "customError" else null
            if (rt.validityMessage != message) rt.validityMessage = message
            val key = "${message.isEmpty()}|$message"
            if (rt.validityKey == key) return
            val primed = rt.validityKey != null
            rt.validityKey = key
            if (primed) emit("mdValidityChange", mapOf("valid" to message.isEmpty(), "validationMessage" to message,
                "flags" to if (missing) mapOf("valueMissing" to true) else if (custom.isNotEmpty()) mapOf("customError" to true) else emptyMap<String, AWCValue>()))
        }
        fun yearBounds(): IntRange {
            rt.yearRange?.let { return it }
            val lo = AWCDay.iso(s("min"))?.year ?: (rt.viewYear - 100); val hi = AWCDay.iso(s("max"))?.year ?: (rt.viewYear + 100)
            return lo..max(lo, hi)
        }
        fun captureYearRange() { rt.yearRange = yearBounds() }
        fun isDisabledYear(y: Int) = (AWCDay.iso(s("min"))?.let { y < it.year } ?: false) || (AWCDay.iso(s("max"))?.let { y > it.year } ?: false)
        fun nearestEnabledYear(from: Int, step: Int): Int {
            val bounds = yearBounds(); val start = from.coerceIn(bounds.first, bounds.last)
            for (dir in listOf(step, -step)) { var y = start; while (y in bounds) { if (!isDisabledYear(y)) return y; y += dir } }
            return start
        }
        fun yearFocusTarget() = rt.yearFocus ?: nearestEnabledYear(rt.viewYear, 1)
        fun dayID(d: AWCDay) = "day-" + d.iso
        fun focusDay() = rt.focusLater(dayID(rt.focused))
        fun slideGrid(delta: Int) {
            if (reduced || rt.monthMenuOpen || rt.yearMenuOpen || rt.menuClosing) return
            rt.slideDirection = if (delta > 0) 1 else -1; rt.slideToken = rt.nextRun()
        }
        fun goToMonth(delta: Int, source: String?) {
            slideGrid(delta)
            val n = AWCDay(rt.viewYear, rt.viewMonth, 1).plusMonths(delta)
            rt.viewYear = n.year; rt.viewMonth = n.month
            if (source != null) emit("mdViewChange", mapOf("month" to (n.month - 1), "year" to n.year, "source" to source))
        }
        fun dropFocus() { rt.focusTarget = null; rt.focusedControl = null; bodyWanted = true; runCatching { bodyRequester.requestFocus() } }
        fun finishClose(emitClose: Boolean) {
            if (!rt.isOpen) return
            // The docked panel's focused part leaves with it: focus goes to the body (Chrome); the modal's session restores.
            if (docked && rt.focusedControl != null && rt.focusedControl != "calendar-button" && rt.focusedControl != "clear-button") dropFocus()
            rt.isOpen = false; rt.closing = false; rt.panelClosing = false; rt.menuClosing = false; rt.yearClosing = false
            rt.monthMenuOpen = false; rt.yearMenuOpen = false; rt.focusedControl = null; rt.focusTarget = null; rt.closeSerial++
            if (open) open = false
            if (emitClose) emit("mdClose", null)
        }
        /** dismissPanel: open docked menus bloom out first (200ms), then the panel and scrim (200ms); reduced motion closes at once. */
        fun closePicker(emitClose: Boolean) {
            if (!rt.isOpen || rt.closing) return
            if (reduced) { finishClose(emitClose); return }
            rt.closing = true
            val menus = docked && (rt.monthMenuOpen || rt.yearMenuOpen)
            if (menus) rt.menuClosing = true else rt.panelClosing = true
            scope.launch {
                if (menus) {
                    rt.awaitRun(if (rt.yearMenuOpen) "yearMenu" else "monthMenu", -rt.menuToken, 400.0)
                    if (!rt.closing) return@launch
                    rt.monthMenuOpen = false; rt.yearMenuOpen = false; rt.menuClosing = false; rt.panelClosing = true
                }
                rt.awaitRun("panel", -rt.openToken, 400.0)
                if (rt.closing) finishClose(emitClose)
            }
        }
        fun cancel() { if (!rt.isOpen || rt.closing) return; emit("mdCancel", null); closePicker(true) }
        fun commit() {
            val d = rt.pending ?: run { closePicker(true); return }
            if (d.iso != value) {
                value = d.iso; rt.committedValue = d.iso; rt.seenValue = d.iso; syncValidity(d.iso)
                emit("mdChange", mapOf("value" to d.iso, "date" to d.iso))
            }
            closePicker(true)
        }
        fun clearValue() {
            if (value.isEmpty()) return
            value = ""; rt.committedValue = ""; rt.seenValue = ""; rt.pending = null; rt.draft = ""; syncValidity("")
            emit("mdChange", mapOf("value" to "", "date" to null))
        }
        fun select(d: AWCDay) {
            if (isDisabled(d)) return
            rt.pending = d; rt.focused = d
            if (d.month != rt.viewMonth || d.year != rt.viewYear) { rt.viewYear = d.year; rt.viewMonth = d.month }
            emit("mdSelected", mapOf("value" to d.iso, "date" to d.iso))
            if (b("commitOnSelect") && !rt.inputMode) commit()
        }
        fun openPicker(emitOpen: Boolean = true) {
            if (rt.isOpen || disabled) return
            val v = AWCDay.iso(value)
            rt.pending = v; rt.inputMode = false; rt.yearView = false; rt.monthMenuOpen = false; rt.yearMenuOpen = false
            rt.yearFocus = null; rt.yearScroll = null; rt.yearRange = null
            val base = v ?: today
            rt.viewYear = base.year; rt.viewMonth = base.month
            rt.focused = AWCDatePickerModel.clamp(v ?: today, s("min"), s("max"))
            rt.entryDraft = v?.let { locale.display(it, sep) } ?: ""
            rt.openedFromInside = rt.focusedControl != null || rt.fieldHasFocus
            rt.isOpen = true; rt.closing = false; rt.panelClosing = false; rt.menuClosing = false; rt.yearClosing = false
            rt.openToken++; rt.calendarToken = null; rt.slideToken = null
            if (!open) open = true
            if (emitOpen) emit("mdOpen", null)
            // focusFocusedDay: the roving day takes focus once rendered (decision 6).
            focusDay()
        }
        fun fieldCommit() {
            val text = rt.draft.trim()
            if (text.isEmpty()) { if (value.isNotEmpty()) clearValue(); rt.validationMessage = ""; return }
            val d = AWCDatePickerModel.parse(text, locale, sep)
            if (d == null || isDisabled(d)) { rt.validationMessage = labels.invalidDate; return }
            rt.validationMessage = ""
            if (d.iso != value) { value = d.iso; rt.committedValue = d.iso; rt.seenValue = d.iso; syncValidity(d.iso); emit("mdChange", mapOf("value" to d.iso, "date" to d.iso)) }
        }
        fun entryCommit() {
            val text = rt.entryDraft.trim()
            if (text.isEmpty()) { rt.validationMessage = ""; return }
            val d = AWCDatePickerModel.parse(text, locale, sep)
            if (d == null || isDisabled(d)) { rt.validationMessage = labels.invalidDate; return }
            rt.validationMessage = ""; rt.pending = d
        }
        fun entryEnter() { entryCommit(); if (rt.validationMessage.isEmpty() && rt.pending != null) commit() }
        fun toggleInputMode() {
            rt.inputMode = !rt.inputMode
            if (rt.inputMode) { rt.entryDraft = rt.pending?.let { locale.display(it, sep) } ?: ""; rt.focusLater("entry") }
            else if (rt.entryDraft.isNotEmpty()) {
                val d = AWCDatePickerModel.parse(rt.entryDraft, locale, sep)
                if (d != null && !isDisabled(d)) { rt.pending = d; rt.focused = d; rt.viewYear = d.year; rt.viewMonth = d.month }
            }
            emit("mdModeChange", mapOf("mode" to if (rt.inputMode) "input" else "calendar"))
        }
        /** closeYearViewAnimated: the grid blooms out (200ms), then the day grid blooms in; `then` runs when the calendar shows. */
        fun closeYearView(then: () -> Unit = {}) {
            if (!rt.yearView || rt.yearClosing) return
            if (reduced) { rt.yearView = false; rt.yearFocus = null; rt.yearRange = null; then(); return }
            rt.yearClosing = true
            scope.launch {
                rt.awaitRun("yearWrap", -rt.yearToken, 400.0)
                if (!rt.yearClosing) return@launch
                rt.yearClosing = false; rt.yearView = false; rt.yearFocus = null; rt.yearRange = null; rt.calendarToken = rt.nextRun()
                then()
            }
        }
        fun openYearView() {
            rt.calendarToken = null; rt.yearClosing = false; rt.yearToken++
            captureYearRange(); rt.yearFocus = nearestEnabledYear(rt.viewYear, 1); rt.yearScroll = null; rt.yearView = true
            emit("mdMenuOpen", mapOf("type" to "year"))
            rt.focusLater("year-${yearFocusTarget()}")
        }
        fun selectYear(y: Int) {
            if (isDisabledYear(y)) return
            // The picked cell unmounts with the grid: focus lands on the day grid when it was in the grid (source selectYear).
            val inGrid = rt.focusedControl?.startsWith("year-") ?: false
            rt.viewYear = y; rt.focused = AWCDay(y, rt.viewMonth, 1); rt.yearFocus = null
            emit("mdMenuSelect", mapOf("type" to "year", "value" to y, "label" to y.toString()))
            emit("mdViewChange", mapOf("month" to (rt.viewMonth - 1), "year" to y, "source" to "year-menu"))
            closeYearView { if (inGrid) focusDay() }
        }
        /** closeDockedSelectionMenu: the list blooms out (200ms), the day grid blooms in; focus returns to the menu button
         *  (`restoreFocus`) or to the roving day (decision 6). */
        fun closeMenus(restoreFocus: Boolean) {
            if (!(rt.monthMenuOpen || rt.yearMenuOpen) || rt.menuClosing) return
            val year = rt.yearMenuOpen
            val finish = {
                rt.monthMenuOpen = false; rt.yearMenuOpen = false; rt.menuClosing = false; rt.yearRange = null
                if (!reduced) rt.calendarToken = rt.nextRun()
                // A pick: focusFocusedDay — the roving day when the new view shows it; otherwise the removed entry's focus leaves
                // the picker (Chrome: the body, D8), as on Apple.
                if (restoreFocus) rt.focusLater(if (year) "year-menu-button" else "month-menu-button")
                else { dropFocus(); if (rt.focused.year == rt.viewYear && rt.focused.month == rt.viewMonth) focusDay() }
            }
            if (reduced) { finish(); return }
            rt.menuClosing = true
            scope.launch { rt.awaitRun(if (year) "yearMenu" else "monthMenu", -rt.menuToken, 400.0); if (rt.menuClosing) finish() }
        }
        fun toggleMenu(year: Boolean, pointer: Boolean) {
            rt.pointerInput = pointer
            val opening = if (year) !rt.yearMenuOpen else !rt.monthMenuOpen
            if (opening) {
                rt.calendarToken = null; rt.menuClosing = false; rt.menuToken++
                rt.yearRange = null; if (year) captureYearRange()
                rt.monthMenuOpen = !year; rt.yearMenuOpen = year
                emit("mdMenuOpen", mapOf("type" to if (year) "year" else "month"))
                rt.focusLater((if (year) "year-option-" else "month-option-") + (if (year) rt.viewYear else rt.viewMonth))
            } else closeMenus(true)
        }
        /** pickDockedSelection: the picked entry's ripple settles first (waitForHostRipple: whenSettled is bounded at 200ms after the click; a 150ms beat under reduced motion). */
        fun afterRipple(body: () -> Unit) {
            rt.pickPending = true
            scope.launch {
                kotlinx.coroutines.delay(if (reduced) 150L else 200L)
                rt.pickPending = false
                if (rt.isOpen) body()
            }
        }
        fun pickMonth(month: Int) {
            if (rt.menuClosing || rt.pickPending) return
            afterRipple {
                rt.viewMonth = month
                emit("mdMenuSelect", mapOf("type" to "month", "value" to (month - 1), "label" to locale.format(AWCDay(2024, month, 1), "MMMM")))
                emit("mdViewChange", mapOf("month" to (month - 1), "year" to rt.viewYear, "source" to "month-menu"))
                closeMenus(false)
            }
        }
        fun pickYear(year: Int) {
            if (rt.menuClosing || rt.pickPending) return
            afterRipple {
                rt.viewYear = year
                emit("mdMenuSelect", mapOf("type" to "year", "value" to year, "label" to year.toString()))
                emit("mdViewChange", mapOf("month" to (rt.viewMonth - 1), "year" to year, "source" to "year-menu"))
                closeMenus(false)
            }
        }
        fun focusInside() = rt.focusedControl != null || rt.fieldHasFocus || rt.entryHasFocus
        fun escapeKey() { if (docked && (rt.monthMenuOpen || rt.yearMenuOpen)) closeMenus(true) else cancel() }
        /** focusYearCell('move'): scroll only as far as needed to show the cell in the scroll viewport. */
        fun yearScrollTop(years: IntRange, rows: Int): Double {
            val index = (rt.viewYear - years.first).coerceIn(0, max(0, years.last - years.first))
            val row = (index / 3).toDouble(); val n = rows.toDouble()
            val content = 8 + n * m.yearHeight + max(0.0, n - 1) * m.yearGap + 16
            val target = 8 + row * (m.yearHeight + m.yearGap) + m.yearHeight / 2 - m.yearViewport / 2
            return max(0.0, min(target, max(0.0, content - m.yearViewport)))
        }
        fun revealYear(y: Int) {
            val bounds = yearBounds(); val rows = (bounds.last - bounds.first + 1 + 2) / 3
            val current = rt.yearScroll ?: yearScrollTop(bounds, rows)
            val row = ((y - bounds.first) / 3).toDouble(); val top = 8 + row * (m.yearHeight + m.yearGap); val bottom = top + m.yearHeight
            val content = 8 + rows * m.yearHeight + max(0, rows - 1) * m.yearGap + 16
            var next = current
            if (top < current) next = top else if (bottom > current + m.yearViewport) next = bottom - m.yearViewport
            rt.yearScroll = max(0.0, min(next, max(0.0, content - m.yearViewport)))
        }
        /** handleYearGridKeyDown: three years a row (horizontal arrows mirrored in RTL), Page ± 18, Home / End the row's ends
         *  (Control: the list's), disabled years skipped. */
        fun yearKey(key: String, control: Boolean, alt: Boolean, meta: Boolean): Boolean {
            if (alt || meta) return false
            val bounds = yearBounds(); val current = yearFocusTarget(); val inline = if (rtl) -1 else 1
            val rowStart = bounds.first + ((current - bounds.first) / 3) * 3
            val (target, step) = when (key) {
                "ArrowRight" -> (current + inline) to inline
                "ArrowLeft" -> (current - inline) to -inline
                "ArrowDown" -> (current + 3) to 1
                "ArrowUp" -> (current - 3) to -1
                "PageDown" -> (current + 18) to 1
                "PageUp" -> (current - 18) to -1
                "Home" -> (if (control) bounds.first else rowStart) to 1
                "End" -> (if (control) bounds.last else min(bounds.last, rowStart + 2)) to -1
                else -> return false
            }
            if (key.startsWith("Arrow") && target !in bounds) return true
            val next = nearestEnabledYear(target, step)
            if (isDisabledYear(next)) return true
            rt.yearFocus = next; revealYear(next)
            rt.focusLater("year-$next")
            return true
        }
        /** routePickerKeyDown / onPanelKeyDown for a key at the picker control `target`: Escape, Shift+M / Shift+Y (docked), the
         *  year grid's keys, then the calendar keys. Unhandled keys reach the control. */
        fun pickerKey(target: String, e: KeyEvent): Boolean {
            if (e.type != KeyEventType.KeyDown || !rt.isOpen || rt.closing) return false
            rt.pointerInput = false
            val shift = e.isShiftPressed; val control = e.isCtrlPressed; val alt = e.isAltPressed; val meta = e.isMetaPressed
            var key = when (e.key) {
                Key.Escape -> "Escape"; Key.DirectionRight -> "ArrowRight"; Key.DirectionLeft -> "ArrowLeft"; Key.DirectionDown -> "ArrowDown"
                Key.DirectionUp -> "ArrowUp"; Key.MoveHome -> "Home"; Key.MoveEnd -> "End"; Key.PageUp -> "PageUp"; Key.PageDown -> "PageDown"
                Key.Enter, Key.NumPadEnter -> "Enter"; Key.Spacebar -> "Space"; Key.M -> "m"; Key.Y -> "y"; else -> return false
            }
            if (key == "Escape") { escapeKey(); return true }
            val menuOpen = rt.monthMenuOpen || rt.yearMenuOpen
            if (docked && shift && !control && !meta && !alt && (key == "m" || key == "y") && !rt.yearView && !rt.inputMode) { toggleMenu(key == "y", false); return true }
            if (key == "m" || key == "y") return false
            if (rt.yearView) return target.startsWith("year-") && yearKey(key, control, alt, meta)
            if (rt.inputMode || menuOpen || target.startsWith("month-option-") || target.startsWith("year-option-")) return false
            // resolveNavigationKey: Alt+ArrowUp / Alt+ArrowDown are Page Up / Page Down.
            if (alt && !shift && !control && !meta) key = if (key == "ArrowUp") "PageUp" else if (key == "ArrowDown") "PageDown" else key
            val f = rt.focused; val inline = if (rtl) -1 else 1; val onDay = target.startsWith("day-")
            val next = when (key) {
                "ArrowRight" -> f.plusDays(inline)
                "ArrowLeft" -> f.plusDays(-inline)
                "ArrowDown" -> f.plusDays(7)
                "ArrowUp" -> f.plusDays(-7)
                "Home" -> AWCDay(f.year, f.month, 1)
                "End" -> AWCDay(f.year, f.month, AWCDay.daysIn(f.year, f.month))
                "PageUp" -> f.plusMonths(if (shift) -12 else -1)
                "PageDown" -> f.plusMonths(if (shift) 12 else 1)
                "Enter" -> { if (!onDay) return false; if (!isDisabled(f)) { select(f); if (rt.isOpen) commit() }; return true }
                "Space" -> { if (!onDay) return false; select(f); return true }
                else -> return false
            }
            rt.focused = AWCDatePickerModel.clamp(next, s("min"), s("max"))
            if ((key == "PageUp" || key == "PageDown") && (rt.focused.year != rt.viewYear || rt.focused.month != rt.viewMonth)) slideGrid(if (key == "PageDown") 1 else -1)
            rt.viewYear = rt.focused.year; rt.viewMonth = rt.focused.month
            focusDay()
            return true
        }
        fun load() {
            if (rt.loaded) return
            rt.loaded = true
            rt.committedValue = value; rt.seenValue = value; syncValidity(value)
            val v = AWCDay.iso(value) ?: today
            rt.viewYear = v.year; rt.viewMonth = v.month; rt.focused = v; rt.pending = AWCDay.iso(value)
            if (open && !disabled) openPicker(false) else if (open) open = false
        }

        // Lifecycle: load once, follow `value` / `open` / `required` / `disabled`.
        SideEffect {
            load()
            rt.show = { openPicker() }; rt.hide = { closePicker(true) }; rt.clear = { clearValue() }
            rt.focusInput = { triggerController.setFocus() }
            rt.isDisabled = { disabled }; rt.revalidate = { syncValidity(value) }
            controller?.runtime = rt
            owner.escape = { if (rt.isOpen && focusInside()) { escapeKey(); true } else false }
        }
        val currentValue = value
        SideEffect { if (rt.loaded && currentValue != rt.seenValue) { rt.seenValue = currentValue; syncValidity(currentValue); if (currentValue != rt.committedValue) { rt.committedValue = currentValue; rt.pending = AWCDay.iso(currentValue) } } }
        val openNow = open
        SideEffect { if (rt.loaded) { if (openNow && !rt.isOpen) openPicker() else if (!openNow && rt.isOpen && !rt.closing) closePicker(true) } }
        val requiredNow = b("required")
        LaunchedEffect(requiredNow) { if (rt.loaded) syncValidity(value) }
        // InlineValidationPresenter.reset: a renamed or disabled control forgets a reported message.
        val nameNow = s("name"); LaunchedEffect(nameNow) { rt.revealed = false }
        LaunchedEffect(disabled) { if (disabled) rt.revealed = false }
        SideEffect { if (disabled && rt.isOpen) cancel() }
        // The inspection mirror reads the live state when asked (a pick recomposes only the cells, not this scope).
        SideEffect {
            // The roving tab stop as rendered: the year cell in the year view, else the roving day when the grid shows it.
            rt.stopsOf = {
                if (!rt.isOpen || (rt.inputMode && !docked) || rt.monthMenuOpen || rt.yearMenuOpen) emptyList()
                else if (rt.yearView) listOf(yearFocusTarget().toString())
                else if (AWCDatePickerModel.monthMatrix(rt.viewYear, rt.viewMonth, firstDay).any { it.day == rt.focused }) listOf(rt.focused.iso) else emptyList()
            }
            rt.entryOf = { if (rt.isOpen && rt.inputMode && !docked) rt.entryDraft else null }
            rt.yearScrollOf = { if (rt.isOpen && rt.yearView) { val b = yearBounds(); rt.yearScroll ?: yearScrollTop(b, (b.last - b.first + 1 + 2) / 3) } else null }
        }

        // Focus requests once the target has rendered (two frames), retried ~1 s; the ring shows unless the last input was a press.
        LaunchedEffect(rt.focusSerial) {
            val target = rt.focusTarget ?: return@LaunchedEffect
            val serial = rt.focusSerial
            for (attempt in 0 until 40) {
                withFrameNanos { }; if (attempt == 0) withFrameNanos { }
                if (rt.focusSerial != serial || (!rt.isOpen && target != "trigger" && target != "calendar-button")) return@LaunchedEffect
                if (target == "trigger") { if (triggerController.setFocus()) break else { kotlinx.coroutines.delay(16); continue } }
                if (target == "entry") { if (entryController.setFocus()) break else { kotlinx.coroutines.delay(16); continue } }
                val state = rt.buttons[target]
                if (state != null && (if (rt.focusRing) state.requestFocus() else state.requestPointerFocus())) break
                kotlinx.coroutines.delay(16)
            }
            if (rt.focusSerial == serial) rt.focusTarget = null
        }
        // Motion clock: keyframe runs start at the frame after the change that mounts them.
        AWCModalTicker(rt.clock, { now -> rt.animating(now) }) { ms -> rt.startPending(ms) }

        // MARK: Parts
        /** A picker-owned md-button / md-icon-button with a focus handle; its focus moves `focusedControl`. */
        @Composable fun Control(part: String, tag: String, props: Props, modifier: Modifier = Modifier, keys: Boolean = true,
                                onClick: (AWCValue) -> Unit, content: (@Composable (String) -> Unit)? = null) {
            Box(modifier
                .onPreviewKeyEvent { e -> if (e.type == KeyEventType.KeyDown) rt.pointerInput = false; keys && pickerKey(part, e) }
                .pointerInput(part) { awaitEachGesture { awaitFirstDown(requireUnconsumed = false, pass = PointerEventPass.Initial); rt.pointerInput = true } }
                .inspectAWCNode(inspection, part, part)) {
                AWCButtonFocusScope(rt.button(part), onFocusChanged = { f -> if (f) rt.focusedControl = part else if (rt.focusedControl == part) rt.focusedControl = null }) {
                    AWCComponent(tag, props, onEvent = { n, d -> if (n == "mdClick") onClick(d) }, content = content)
                }
            }
        }
        val densityProps: Map<String, AWCValue> = if (scale != 0.0) mapOf("density" to scale) else emptyMap()
        /** The menu toggle (md-button, text, toggle): label + the fixed 20px caret slot (`.md-date-picker__menu-caret`). */
        @Composable fun MonthToggle(part: String, text: String, expanded: Boolean, aria: String, action: () -> Unit) {
            val ink = if (expanded) token("on-secondary-container", "#1D192B") else token("on-surface-variant", "#49454F")
            AWCButtonAppearanceScope(AWCButtonAppearance(containerColor = if (expanded) token("secondary-container", "#E8DEF8") else null, labelColor = ink,
                iconColor = ink, trailingIconColor = ink, stateLayerColor = ink, iconSize = 20.0, trailingIconSize = 20.0, fontSize = m.menuFont, fontWeight = 500.0,
                lineHeight = m.menuLine, letterSpacing = .1, gap = 2.0)) {
                Control(part, "md-button", mapOf("variant" to "text", "size" to "sm", "toggle" to true, "selected" to expanded, "label" to text,
                    "suppressExpandIconFlip" to true, "mirrorIcon" to expanded, "aria-label" to aria, "aria-expanded" to if (expanded) "true" else "false", "exposeExpanded" to true) + densityProps,
                    onClick = { action() }) { name ->
                    if (name == "trailing-icon") Box(Modifier.size(20.dp), contentAlignment = Alignment.Center) {
                        AWCMaterialSymbol(if (expanded) "arrow_drop_up" else "arrow_drop_down", size = m.caret.dp)
                    }
                }
            }
        }
        @Composable fun Chevron(side: String, part: String, aria: String, enabled: Boolean = true, action: () -> Unit) {
            Control(part, "md-icon-button", mapOf("size" to "sm", "icon" to if (side == "prev") "chevron_left" else "chevron_right", "aria-label" to aria,
                "disabled" to !enabled) + densityProps, modifier = Modifier.graphicsLayer { scaleX = if (rtl) -1f else 1f }, onClick = { action() })
        }

        // MARK: Calendar
        @Composable fun Day(cell: AWCDayCell) {
            val d = cell.day; val dis = isDisabled(d); val isToday = d == today; val selected = rt.pending == d
            val base = hook("day-color", "on-surface", "#1C1B1F")
            val labelHex = when {
                selected -> hook("day-selected-color", "on-primary", "#FFFFFF")
                dis -> dpAlpha(base, .38)
                isToday -> hook("today-outline-color", "primary", "#6750A4")
                cell.outOfMonth -> hook("day-outside-color", "on-surface-variant", "#49454F")
                else -> base
            }
            val radius: Double? = if (isToday && !selected) (appearance.length("day-today-shape") ?: m.daySize / 2) else if (selected) appearance.length("day-selected-shape") else null
            val part = dayID(d)
            Box(Modifier.size(m.daySize.dp)
                .then(if (isToday && !selected) Modifier.drawBehind {
                    val r = ((radius ?: m.daySize / 2) * density).toFloat(); val w = density
                    drawRoundRect(color(hook("today-outline-color", "primary", "#6750A4")), topLeft = androidx.compose.ui.geometry.Offset(-w / 2, -w / 2),
                        size = androidx.compose.ui.geometry.Size(size.width + w, size.height + w), cornerRadius = androidx.compose.ui.geometry.CornerRadius(r + w / 2),
                        style = androidx.compose.ui.graphics.drawscope.Stroke(w))
                } else Modifier)) {
                AWCButtonAppearanceScope(AWCButtonAppearance(containerColor = if (selected) hook("day-selected-bg", "primary", "#6750A4") else "#00000000",
                    labelColor = labelHex, fontSize = m.dayFont, fontWeight = 400.0, lineHeight = 24.0, letterSpacing = .5, cornerRadius = radius, paddingInline = 0.0,
                    width = m.daySize, minWidth = m.daySize, height = m.daySize)) {
                    Control(part, "md-button", mapOf("variant" to if (selected) "filled" else "text", "size" to "sm", "shape" to "square", "selected" to selected,
                        "disabled" to dis, "roleOverride" to "gridcell", "groupTabindex" to if (d == rt.focused) 0 else -1,
                        "aria-label" to locale.format(d, "yMMMMEEEEd"), "label" to d.day.toString()) + densityProps,
                        onClick = { select(d) })
                }
            }
        }
        @Composable fun Calendar(dock: Boolean) {
            val cells = AWCDatePickerModel.monthMatrix(rt.viewYear, rt.viewMonth, firstDay)
            val names = locale.weekdays(firstDay, "narrow")
            val gridWidth = panelWidth(dock) - 24
            // `grid-template-columns: repeat(7, 1fr); gap; justify-items: center` (1fr never below min-content).
            val col = max(m.daySize, (gridWidth - 6 * m.gridGap) / 7)
            val fr = (gridWidth - 6 * m.gridGap) / 7 >= m.daySize
            // The calendar clips (overflow hidden / auto): the roving day's row is scrolled into view (nearest edge).
            val row = (cells.indexOfFirst { it.day == rt.focused }.coerceAtLeast(0) / 7).toDouble()
            val rowBottom = m.weekdaySize + m.insetLg + row * (m.daySize + m.gridGap) + m.daySize
            var visible by remember { mutableStateOf(0.0) }
            val scroll = if (visible > 0) max(0.0, rowBottom - visible) else 0.0
            Box(Modifier.fillMaxWidth().clipToBounds()
                .onGloballyPositioned { visible = it.size.height / pxDensity }
                .inspectAWCNode(inspection, "calendar", "calendar")) {
                Column(Modifier.fillMaxWidth().wrapContentHeight(Alignment.Top, unbounded = true).offset(y = (-scroll).dp).padding(bottom = if (dock) m.insetSm.dp else 0.dp)) {
                    DPCellRow(col, m.gridGap, Modifier.fillMaxWidth().inspectAWCNode(inspection, "weekdays", "weekdays").padding(bottom = m.insetLg.dp)
                        .semantics { hideFromAccessibility() } /* story 1-5 a11y: Web role="row" aria-hidden="true" */) {
                        names.forEachIndexed { i, n ->
                            Box(Modifier.size(m.daySize.dp, m.weekdaySize.dp).inspectAWCNode(inspection, "weekday-$i", "weekday"), contentAlignment = Alignment.Center) {
                                Text(n, maxLines = 1, softWrap = false, modifier = Modifier.wrapContentHeight(unbounded = true),
                                    style = dpText(m.weekdayFont, 400.0, 24.0, color(hook("weekday-color", "on-surface", "#1C1B1F")), .5, TextAlign.Center))
                            }
                        }
                    }
                    val slide = rt.slideDirection * (if (rtl) -1 else 1)
                    DPKeyframes(rt, "grid", rt.slideToken, gridSlideMs, DPEmphasized, reduced, values = { pr -> listOf(1.0, 1.0, 0.0, slide * gridWidth * (1 - pr)) }) {
                        Column(Modifier.then(if (fr) Modifier.fillMaxWidth() else Modifier).height(m.gridHeight.dp).inspectAWCNode(inspection, "grid", "grid")
                            .semantics { collectionInfo = CollectionInfo(6, 7) }, verticalArrangement = Arrangement.spacedBy(m.gridGap.dp)) {
                            for (r in 0 until 6) DPCellRow(col, m.gridGap, Modifier.then(if (fr) Modifier.fillMaxWidth() else Modifier).height(m.daySize.dp)) {
                                for (c in 0 until 7) { val cell = cells[r * 7 + c]; key(cell.day.iso) { Day(cell) } }
                            }
                        }
                    }
                }
            }
        }
        @Composable fun BloomingCalendar(dock: Boolean) {
            DPKeyframes(rt, "calendar", rt.calendarToken, calBloomMs, selBloomCurve, reduced, origin = TransformOrigin(.5f, 0f), values = { pr -> dpBloomIn(pr, .92) }) { Calendar(dock) }
        }

        // MARK: Year grid (modal)
        @Composable fun YearCell(y: Int) {
            val selected = y == rt.viewYear; val dis = isDisabledYear(y)
            val base = hook("day-color", "on-surface", "#1C1B1F")
            val labelHex = if (selected) hook("day-selected-color", "on-primary", "#FFFFFF") else if (dis) dpAlpha(base, .38) else base
            AWCButtonAppearanceScope(AWCButtonAppearance(containerColor = if (selected) hook("day-selected-bg", "primary", "#6750A4") else "#00000000", labelColor = labelHex,
                fontSize = m.dayFont, fontWeight = 400.0, lineHeight = 24.0, letterSpacing = .5, cornerRadius = if (selected) appearance.length("day-selected-shape") else null,
                paddingInline = 0.0, width = m.yearWidth, minWidth = m.yearWidth, height = m.yearHeight)) {
                Control("year-$y", "md-button", mapOf("variant" to if (selected) "filled" else "text", "size" to "sm", "shape" to "square", "selected" to selected,
                    "disabled" to dis, "roleOverride" to "gridcell", "groupTabindex" to if (y == yearFocusTarget()) 0 else -1, "aria-label" to y.toString(),
                    "label" to y.toString()) + densityProps, modifier = Modifier.size(m.yearWidth.dp, m.yearHeight.dp), onClick = { selectYear(y) })
            }
        }
        @Composable fun YearGrid() {
            val bounds = yearBounds(); val years = bounds.toList(); val rows = (years.size + 2) / 3
            val top = rt.yearScroll ?: yearScrollTop(bounds, rows)
            // `overflow-y: auto`: a drag, a fling or the wheel scrolls the years (a drag is not a pick); keys keep revealing
            // the roving year.
            val maxScroll = max(0.0, 8 + rows * m.yearHeight + max(0, rows - 1) * m.yearGap + 16 - m.yearViewport)
            val topNow by rememberUpdatedState(top); val maxNow by rememberUpdatedState(maxScroll)
            // (Not Modifier.scrollable: it also answers its focused children's bring-into-view requests and Page keys, which
            // belong to the roving year here.)
            fun scrollYearsBy(dp: Double): Double { val next = (topNow + dp).coerceIn(0.0, maxNow); val used = next - topNow; if (used != 0.0) rt.yearScroll = next; return used }
            val flingDecay = androidx.compose.animation.rememberSplineBasedDecay<Float>(); val flingScope = rememberCoroutineScope()
            var fling by remember { mutableStateOf<kotlinx.coroutines.Job?>(null) }
            Box(Modifier.fillMaxWidth().layout12().clipToBounds().inspectAWCNode(inspection, "year-grid-wrap", "year-grid-wrap")) {
                // A fixed 288px scroll viewport: the wrap (shrunk with the body) clips it from the bottom.
                Box(Modifier.fillMaxWidth().wrapContentHeight(Alignment.Top, unbounded = true).height(m.yearViewport.dp).clipToBounds()
                    // Touch drag on the Initial pass (the year md-buttons consume their own pointer moves, so a parent
                    // `draggable` never saw them): past the touch slop the moves are consumed (the cell's press is cancelled and
                    // its click suppressed, a drag is not a pick), then the release flings.
                    .pointerInput(Unit) {
                        awaitEachGesture {
                            val down = awaitFirstDown(requireUnconsumed = false, pass = androidx.compose.ui.input.pointer.PointerEventPass.Initial)
                            if (down.type != androidx.compose.ui.input.pointer.PointerType.Touch) return@awaitEachGesture
                            val tracker = androidx.compose.ui.input.pointer.util.VelocityTracker(); tracker.addPosition(down.uptimeMillis, down.position)
                            var dragging = false
                            while (true) {
                                val ev = awaitPointerEvent(androidx.compose.ui.input.pointer.PointerEventPass.Initial)
                                val ch = ev.changes.firstOrNull { it.id == down.id } ?: break
                                tracker.addPosition(ch.uptimeMillis, ch.position)
                                if (!dragging && kotlin.math.abs(ch.position.y - down.position.y) > viewConfiguration.touchSlop) { dragging = true; fling?.cancel() }
                                if (dragging) { scrollYearsBy(-(ch.position.y - ch.previousPosition.y) / pxDensity.toDouble()); ch.consume() }
                                if (!ch.pressed) break
                            }
                            if (dragging && !rt.yearClosing) {
                                val velocity = tracker.calculateVelocity().y
                                fling = flingScope.launch {
                                    var last = 0f
                                    androidx.compose.animation.core.AnimationState(0f, initialVelocity = velocity).animateDecay(flingDecay) {
                                        val d = this.value - last; last = this.value
                                        if (d != 0f && scrollYearsBy(-d / pxDensity) == 0.0) cancelAnimation()
                                    }
                                }
                            }
                        }
                    }
                    .pointerInput(Unit) {
                        awaitPointerEventScope {
                            while (true) {
                                val e = awaitPointerEvent()
                                if (e.type == androidx.compose.ui.input.pointer.PointerEventType.Scroll) {
                                    val dy = e.changes.sumOf { it.scrollDelta.y.toDouble() }
                                    if (dy != 0.0 && scrollYearsBy(dy * 48) != 0.0) e.changes.forEach { it.consume() }
                                }
                            }
                        }
                    }
                    .inspectAWCNode(inspection, "year-grid-scroll", "year-grid-scroll")) {
                    Column(Modifier.fillMaxWidth().wrapContentHeight(Alignment.Top, unbounded = true).offset(y = (-top).dp)
                        .inspectAWCNode(inspection, "year-grid", "year-grid")
                        .padding(start = m.yearPadInline.dp, end = m.yearPadInline.dp, top = 8.dp, bottom = 16.dp),
                        verticalArrangement = Arrangement.spacedBy(m.yearGap.dp)) {
                        for (r in 0 until rows) key(years[r * 3]) {
                            Row(Modifier.fillMaxWidth().height(m.yearHeight.dp), verticalAlignment = Alignment.CenterVertically) {
                                for (c in 0 until 3) {
                                    val i = r * 3 + c
                                    Box(Modifier.weight(1f), contentAlignment = when (c) { 0 -> Alignment.CenterStart; 1 -> Alignment.Center; else -> Alignment.CenterEnd }) {
                                        if (i < years.size) key(years[i]) { YearCell(years[i]) }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // MARK: Header, nav, entry, actions
        @Composable fun Header() {
            // The divider overlays the header's last pixel; 1px of the panel shows below it (source: border + margin).
            Column(Modifier.width(panelWidth(false).dp)
                .inspectAWCNode(inspection, "header", "header")
                .padding(bottom = 1.dp)
                .background(color(hook("header-color", "surface-container-high", "#ECE6F0")))
                .drawBehind { drawRect(color(token("outline-variant", "#CAC4D0")), topLeft = androidx.compose.ui.geometry.Offset(0f, size.height - density),
                    size = androidx.compose.ui.geometry.Size(size.width, density)) }
                .padding(start = m.insetXl.dp, top = m.insetLg.dp, end = m.insetMd.dp, bottom = m.insetMd.dp)) {
                if (hasSlot("header")) slots!!.Render("header")
                else {
                    // CSS line boxes: fixed heights (Compose would grow a line for a taller fallback font's metrics).
                    Box(Modifier.fillMaxWidth().inspectAWCNode(inspection, "supporting", "supporting").padding(bottom = m.supportingPad.dp).height(m.supportingLine.dp),
                        contentAlignment = Alignment.CenterStart) {
                        Text(labels.headline, maxLines = 1, softWrap = false, modifier = Modifier.wrapContentHeight(unbounded = true),
                            style = dpText(m.supportingFont, 500.0, m.supportingLine, color(hook("supporting-color", "on-surface-variant", "#49454F")), .5))
                    }
                    Row(Modifier.fillMaxWidth().heightIn(min = m.rowMin.dp), horizontalArrangement = Arrangement.spacedBy(m.gapSm.dp), verticalAlignment = Alignment.CenterVertically) {
                        val headline = if (rt.inputMode) labels.enterDates else rt.pending?.let { locale.format(it, "MMMEd") } ?: labels.selectDate
                        Box(Modifier.weight(1f).height(m.headlineLine.dp).inspectAWCNode(inspection, "headline", "headline"), contentAlignment = Alignment.CenterStart) {
                            Text(headline, maxLines = 1, softWrap = false, modifier = Modifier.wrapContentHeight(unbounded = true), style = dpText(m.headlineFont, 400.0, m.headlineLine, color(hook("headline-color", "on-surface", "#1C1B1F"))))
                        }
                        AWCIconButtonAppearanceScope(AWCIconButtonAppearance(width = 48.0, height = 48.0)) {
                            Control("mode-toggle", "md-icon-button", mapOf("icon" to if (rt.inputMode) "calendar_today" else "edit",
                                "aria-label" to if (rt.inputMode) labels.toggleCalendar else labels.toggleText) + densityProps, onClick = { toggleInputMode() })
                        }
                    }
                }
            }
        }
        @Composable fun Nav() {
            val expanded = rt.yearView
            Row(Modifier.fillMaxWidth().heightIn(min = 48.dp).inspectAWCNode(inspection, "nav", "nav").padding(horizontal = m.insetXs.dp),
                verticalAlignment = Alignment.CenterVertically) {
                MonthToggle("month-toggle", locale.format(AWCDay(rt.viewYear, rt.viewMonth, 1), "yMMMM"), expanded, labels.chooseMonthYear) {
                    if (expanded) closeYearView() else openYearView()
                }
                Spacer(Modifier.weight(1f))
                if (!expanded) Row(horizontalArrangement = Arrangement.spacedBy(m.gapXs.dp)) {
                    Chevron("prev", "prev-button", labels.previousMonth) { goToMonth(-1, "chevron-month") }
                    Chevron("next", "next-button", labels.nextMonth) { goToMonth(1, "chevron-month") }
                }
            }
            Spacer(Modifier.height(m.insetXs.dp))
        }
        @Composable fun ChevronSlot(side: String, unit: String, size: Double, visible: Boolean, action: () -> Unit) {
            val aria = if (side == "prev") (if (unit == "month") labels.previousMonth else labels.previousYear) else (if (unit == "month") labels.nextMonth else labels.nextYear)
            Box(Modifier.size(size.dp).inspectAWCNode(inspection, "$side-$unit-chevron-slot", "$side-$unit-chevron-slot"), contentAlignment = Alignment.Center) {
                Box(Modifier.graphicsLayer { alpha = if (visible) 1f else 0f }) { Chevron(side, "$side-$unit-button", aria, visible, action) }
            }
        }
        @Composable fun DockedNav() {
            val chevronSize = max(32.0, 40 + m.scale * 4)
            Row(Modifier.fillMaxWidth().inspectAWCNode(inspection, "nav", "nav").padding(bottom = 30.dp), horizontalArrangement = Arrangement.spacedBy(m.gapLg.dp, Alignment.CenterHorizontally),
                verticalAlignment = Alignment.CenterVertically) {
                Row(horizontalArrangement = Arrangement.spacedBy(m.gapXs.dp), verticalAlignment = Alignment.CenterVertically) {
                    ChevronSlot("prev", "month", chevronSize, !rt.yearMenuOpen) { goToMonth(-1, "chevron-month") }
                    MonthToggle("month-menu-button", locale.format(AWCDay(rt.viewYear, rt.viewMonth, 1), "MMM"), rt.monthMenuOpen, labels.chooseMonth) { toggleMenu(false, rt.pointerInput) }
                    ChevronSlot("next", "month", chevronSize, !rt.yearMenuOpen) { goToMonth(1, "chevron-month") }
                }
                Row(horizontalArrangement = Arrangement.spacedBy(m.gapXs.dp), verticalAlignment = Alignment.CenterVertically) {
                    ChevronSlot("prev", "year", chevronSize, !rt.monthMenuOpen) { goToMonth(-12, "chevron-year") }
                    MonthToggle("year-menu-button", rt.viewYear.toString(), rt.yearMenuOpen, labels.chooseYear) { toggleMenu(true, rt.pointerInput) }
                    ChevronSlot("next", "year", chevronSize, !rt.monthMenuOpen) { goToMonth(12, "chevron-year") }
                }
            }
        }
        @Composable fun Entry() {
            val showError = b("error") || rt.validationMessage.isNotEmpty()
            val fieldProps: Props = mapOf("variant" to "outlined", "label" to labels.label, "placeholder" to s("placeholder").ifEmpty { locale.pattern(sep) },
                "value" to rt.entryDraft, "error" to showError, "errorText" to s("errorText").ifEmpty { rt.validationMessage },
                "reserveSupportingSpace" to b("reserveSupportingSpace"))
            val hooks = AWCFieldHooks(key = { k -> if (k == "Enter") { entryEnter(); true } else false },
                focus = { f -> rt.entryHasFocus = f; if (f) rt.focusedControl = "entry" else if (rt.focusedControl == "entry") rt.focusedControl = null },
                controller = entryController,
                event = { n, d -> if (n == "mdInput") { rt.entryDraft = d as? String ?: ""; emit("mdInput", mapOf("value" to rt.entryDraft)) } })
            Box(Modifier.fillMaxWidth().inspectAWCNode(inspection, "entry", "entry").focusRequester(entryRequester).focusGroup()) {
                Box(Modifier.fillMaxWidth().inspectAWCNode(inspection, "entry-input", "entry-input")) {
                    CompositionLocalProvider(LocalAWCInspection provides inspection?.let { it.copy(id = it.id + ".entry-field", entered = true, parentId = it.id) }) {
                        NativeTextField(fieldProps, { _, _ -> }, { _, _ -> }, null, null, null, hooks)
                    }
                }
            }
        }
        @Composable fun Actions() {
            Row(Modifier.fillMaxWidth().inspectAWCNode(inspection, "actions", "actions")
                .padding(start = 12.dp, end = 12.dp, top = m.insetSm.dp, bottom = m.insetMd.dp).heightIn(min = m.actionsMin.dp),
                horizontalArrangement = Arrangement.spacedBy(m.gapSm.dp, Alignment.End), verticalAlignment = Alignment.CenterVertically) {
                if (hasSlot("actions")) slots!!.Render("actions")
                else AWCButtonAppearanceScope(AWCButtonAppearance(labelColor = hook("action-color", "primary", "#6750A4"))) {
                    Control("cancel-button", "md-button", mapOf("variant" to "text", "size" to "sm", "label" to labels.cancel) + densityProps, keys = false, onClick = { cancel() })
                    Control("ok-button", "md-button", mapOf("variant" to "text", "size" to "sm", "label" to labels.ok) + densityProps, keys = false, onClick = {
                        if (rt.inputMode) { entryCommit(); if (rt.validationMessage.isNotEmpty()) return@Control }
                        commit()
                    })
                }
            }
        }

        // MARK: Docked month / year lists (decision 3: the list scrolls inside the panel)
        @Composable fun MenuRow(year: Boolean, n: Int, text: String, selected: Boolean) {
            val part = (if (year) "year-option-" else "month-option-") + n
            val ink = color(token("on-surface", "#1C1B1F")); val ring = color(token("secondary", "#625B71"))
            val state = rt.button(part)
            var focusedHere by remember { mutableStateOf(false) }
            var pressed by remember { mutableStateOf(false) }
            val requester = remember { FocusRequester() }
            LaunchedEffect(state.revision) { if (state.pending) { runCatching { requester.requestFocus() }; state.pending = false } }
            DisposableEffect(state) { state.attached = true; state.enabled = true; onDispose { state.attached = false; state.isFocused = false } }
            Row(Modifier.fillMaxWidth().height(48.dp)
                .background(if (selected) color(token("secondary-container", "#E8DEF8")) else Color.Transparent)
                .drawBehind {
                    if (pressed || (focusedHere && state.showFocus)) drawRect(ink.copy(alpha = .12f))
                    if (focusedHere && state.showFocus) { val w = 3 * density; drawRect(ring, topLeft = androidx.compose.ui.geometry.Offset(w / 2, w / 2),
                        size = androidx.compose.ui.geometry.Size(size.width - w, size.height - w), style = androidx.compose.ui.graphics.drawscope.Stroke(w)) }
                }
                .focusRequester(requester)
                .onFocusChanged { f -> focusedHere = f.isFocused; state.isFocused = f.isFocused
                    if (f.isFocused) rt.focusedControl = part else if (rt.focusedControl == part) rt.focusedControl = null }
                .focusProperties { canFocus = selected || state.isFocused || state.pending }
                .focusable()
                .onPreviewKeyEvent { e ->
                    if (e.type != KeyEventType.KeyDown) return@onPreviewKeyEvent false
                    state.showFocus = true
                    when (e.key) {
                        Key.Escape -> { escapeKey(); true }
                        Key.Enter, Key.NumPadEnter, Key.Spacebar -> { rt.pointerInput = false; if (year) pickYear(n) else pickMonth(n); true }
                        Key.DirectionDown, Key.DirectionUp, Key.MoveHome, Key.MoveEnd -> {
                            val range = if (year) yearBounds() else 1..12
                            val next = when (e.key) { Key.DirectionDown -> min(range.last, n + 1); Key.DirectionUp -> max(range.first, n - 1); Key.MoveHome -> range.first; else -> range.last }
                            rt.pointerInput = false; rt.focusLater((if (year) "year-option-" else "month-option-") + next); true
                        }
                        else -> false
                    }
                }
                .pointerInput(part) { awaitEachGesture { awaitFirstDown(); pressed = true; state.showFocus = false; runCatching { requester.requestFocus() }
                    val up = waitForUpOrCancellation(); pressed = false; if (up != null) { rt.pointerInput = true; if (year) pickYear(n) else pickMonth(n) } } }
                .semantics { role = Role.RadioButton; this.selected = selected; contentDescription = text }
                .inspectAWCNode(inspection, part, if (year) "year-option" else "month-option")
                .padding(start = (m.insetLg + 12).dp, end = 12.dp),
                horizontalArrangement = Arrangement.spacedBy(m.gapLg.dp), verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(24.dp).graphicsLayer { alpha = if (selected) 1f else 0f }) { AWCMaterialSymbol("check", size = 24.dp) }
                Text(text, maxLines = 1, softWrap = false, modifier = Modifier.weight(1f), style = dpText(m.dayFont, 400.0, 24.0, ink, .5))
            }
        }
        @Composable fun SelectionMenu(year: Boolean) {
            val bounds = yearBounds()
            val entries: List<Pair<Int, String>> = if (year) bounds.map { it to it.toString() } else (1..12).map { it to locale.format(AWCDay(2024, it, 1), "MMMM") }
            val current = if (year) rt.viewYear else rt.viewMonth
            // Every entry is composed (the source's md-menu renders them all); the list scrolls inside the panel (decision 3) with
            // the selected entry centred when it opens and the focused entry kept in view.
            val scroll = rememberScrollState()
            val rowPx = 48 * pxDensity
            var viewportPx by remember { mutableStateOf(0) }
            val menuScope = rememberCoroutineScope()
            SideEffect { rt.revealMenuEntry = { n -> val i = entries.indexOfFirst { it.first == n }
                if (i >= 0 && viewportPx > 0) menuScope.launch { scroll.scrollTo(max(0.0, i * rowPx - (viewportPx - rowPx) / 2).roundToInt()) } } }
            LaunchedEffect(viewportPx > 0) {
                if (viewportPx <= 0) return@LaunchedEffect
                val i = entries.indexOfFirst { it.first == current }.coerceAtLeast(0)
                scroll.scrollTo(max(0.0, i * rowPx - (viewportPx - rowPx) / 2).roundToInt())
            }
            LaunchedEffect(rt.focusedControl) {
                val f = rt.focusedControl ?: return@LaunchedEffect
                val prefix = if (year) "year-option-" else "month-option-"
                if (!f.startsWith(prefix) || viewportPx <= 0) return@LaunchedEffect
                val i = entries.indexOfFirst { it.first == f.removePrefix(prefix).toIntOrNull() }.takeIf { it >= 0 } ?: return@LaunchedEffect
                val top = i * rowPx
                if (top < scroll.value) scroll.scrollTo(top.roundToInt()) else if (top + rowPx > scroll.value + viewportPx) scroll.scrollTo((top + rowPx - viewportPx).roundToInt())
            }
            Column(Modifier.fillMaxWidth().heightIn(max = panelMax().dp)
                .background(color(hook("menu-color", "surface-container-high", "#ECE6F0")), RoundedCornerShape(bottomStart = 16.dp, bottomEnd = 16.dp))
                .clip(RoundedCornerShape(bottomStart = 16.dp, bottomEnd = 16.dp))
                .onSizeChanged { viewportPx = it.height }
                .inspectAWCNode(inspection, if (year) "year-menu" else "month-menu", if (year) "year-menu" else "month-menu")
                .verticalScroll(scroll)) {
                for (e in entries) key(e.first) { MenuRow(year, e.first, e.second, e.first == current) }
            }
        }

        // MARK: Body and panel
        @Composable fun Body(dock: Boolean) {
            val entry = rt.inputMode && !dock
            Column(Modifier.width(panelWidth(dock).dp).clipToBounds().inspectAWCNode(inspection, "body", "body")
                .padding(start = if (entry) m.insetXl.dp else 12.dp, end = if (entry) m.insetXl.dp else 12.dp,
                    top = (if (entry) m.insetXl else if (dock) m.dockedTop else m.insetMd).dp,
                    bottom = (if (entry) m.insetSm else if (hasActionRow) 0.0 else if (dock) max(0.0, m.dockedTop - m.insetSm) else m.dockedTop).dp)) {
                when {
                    entry -> Entry()
                    dock -> {
                        DockedNav()
                        if (rt.monthMenuOpen || rt.yearMenuOpen) {
                            val closing = rt.menuClosing; val key = if (rt.yearMenuOpen) "yearMenu" else "monthMenu"
                            Box(Modifier.layout12()) {
                                Column {
                                    DPKeyframes(rt, "divider", if (closing) null else rt.menuToken, selBloomMs, selBloomCurve, reduced, values = { pr -> listOf(pr, 1.0, 0.0, 0.0) }) {
                                        Box(Modifier.fillMaxWidth().height(1.dp).background(color(token("outline-variant", "#CAC4D0"))).inspectAWCNode(inspection, "selection-divider", "selection-divider"))
                                    }
                                    DPKeyframes(rt, key, if (closing) -rt.menuToken else rt.menuToken, if (closing) selOutMs else selBloomMs, if (closing) DPAccelerate else selBloomCurve, reduced,
                                        origin = TransformOrigin(.5f, 0f), values = { pr -> if (closing) dpBloomOut(pr) else dpBloomIn(pr) }) { SelectionMenu(rt.yearMenuOpen) }
                                }
                            }
                        } else BloomingCalendar(true)
                    }
                    else -> {
                        Nav()
                        if (rt.yearView) {
                            val closing = rt.yearClosing
                            DPKeyframes(rt, "yearWrap", if (closing) -rt.yearToken else rt.yearToken, if (closing) selOutMs else selBloomMs, if (closing) DPAccelerate else selBloomCurve, reduced,
                                origin = TransformOrigin(.5f, 0f), values = { pr -> if (closing) dpBloomOut(pr) else dpBloomIn(pr) }) { YearGrid() }
                        } else BloomingCalendar(false)
                    }
                }
            }
        }
        @Composable fun Panel(dock: Boolean, modifier: Modifier = Modifier) {
            val bg = if (dock) token("surface-container-high", "#ECE6F0") else hook("container-color", "surface-container-high", "#ECE6F0")
            val radius = if (dock) 16.0 else m.shape
            val corners = AWCCornerShape.uniform(radius)
            val shadows = if (dock) emptyList() else NativeShadowLayer.parse(tokens["--md-sys-elevation-3"] ?: "0 4px 8px 3px rgba(0, 0, 0, 0.15), 0 1px 3px rgba(0, 0, 0, 0.3)")
            val ink = color(hook("field-text-color", "on-surface", "#1C1B1F"))
            DPColumn(panelWidth(dock), panelMax(), flexible = if (dock) (if (hasActionRow && !rt.monthMenuOpen && !rt.yearMenuOpen) -1 else 0) else 1,
                modifier = modifier
                    .then(if (shadows.isNotEmpty()) Modifier.accordionShadow(corners, shadows, false) else Modifier)
                    .then(if (dock) Modifier.background(color(bg), RoundedCornerShape(radius.dp)) else Modifier.clip(RoundedCornerShape(radius.dp)).background(color(bg)))
                    .then(if (dock) Modifier else Modifier.awcModalSurface(session, owner))
                    .pointerInput(Unit) { awaitPointerEventScope { while (true) { val e = awaitPointerEvent(PointerEventPass.Final); e.changes.forEach { it.consume() } } } }
                    .semantics { paneTitle = labels.label; isTraversalGroup = true }
                    .inspectAWCNode(inspection, "panel", "panel")) {
                CompositionLocalProvider(androidx.compose.material3.LocalContentColor provides ink) {
                    if (!dock) Header()
                    Body(dock)
                    if (hasActionRow) Actions()
                }
            }
        }

        // MARK: Trigger
        // A reported invalid value shows its message until it is valid again (InlineValidationPresenter.refresh).
        val shown = rt.validationMessage.ifEmpty { if (rt.revealed) rt.validityMessage else "" }
        val showError = b("error") || shown.isNotEmpty()
        val errorText = s("errorText").ifEmpty { shown }
        val selectedDay = AWCDay.iso(value)
        val display = if (rt.fieldFocused) rt.draft else selectedDay?.let { locale.display(it, sep) } ?: ""
        val supporting = if (showError && errorText.isNotEmpty()) "" else s("supportingText").ifEmpty { locale.pattern(sep) }
        SideEffect { rt.fieldText = if (variant == "modal") null else display }
        var anchor by remember { mutableStateOf(Rect.Zero) }
        var dockedHeight by remember { mutableStateOf(0.0) }
        fun positionDocked() {
            if (!docked || !rt.isOpen || dockedHeight <= 0) return
            val a = anchor; val margin = 16.0; val gap = 4.0; val w = panelWidth(true); val h = dockedHeight
            val aMinX = a.left / pxDensity; val aMaxX = a.right / pxDensity; val aMinY = a.top / pxDensity; val aMaxY = a.bottom / pxDensity
            fun projected(end: Boolean): Pair<Double, Double> =
                if (!end) (if (rtl) (aMaxX - w) to aMaxX else aMinX to (aMinX + w)) else (if (rtl) aMinX to (aMinX + w) else (aMaxX - w) to aMaxX)
            var end = false
            if (projected(false).second > vw - margin && projected(true).first >= margin) end = true
            val active = projected(end)
            if (active.first < margin) { if (projected(true).first >= margin) end = true }
            else if (end && projected(true).first < margin && projected(false).second <= vw - margin) end = false
            var above = false; var maxBlock: Double? = null
            if (aMaxY + gap + h > vh - margin) {
                if (aMinY - gap - h >= margin) above = true
                else { val available = vh - margin - aMaxY - gap; if (available > 0) maxBlock = floor(available) }
            }
            if (above) { val available = aMinY - gap - margin; if (available > 0 && h > available) maxBlock = floor(available) }
            if (rt.dockedEnd != end) rt.dockedEnd = end
            if (rt.dockedAbove != above) rt.dockedAbove = above
            if (rt.dockedMaxBlock != maxBlock) rt.dockedMaxBlock = maxBlock
        }
        val outsideRegistry = LocalAWCColorPickerOutside.current
        var panelBox by remember { mutableStateOf(Rect.Zero) }
        if (outsideRegistry != null && docked && rt.isOpen && !disabled) {
            val entry = remember(outsideRegistry) { AWCColorPickerOutsideRegistry.Entry({ pt -> anchor.contains(pt) || panelBox.contains(pt) }) {
                if (rt.isOpen && docked) { if (b("outsideClickDismissible", true)) { dropFocus(); cancel() } else dropFocus() }
            } }
            DisposableEffect(entry) { outsideRegistry.entries += entry; onDispose { outsideRegistry.entries -= entry } }
        }
        val calendarSlot = hasSlot("calendar-icon")
        @Composable fun TriggerButtons() {
            Row(verticalAlignment = Alignment.CenterVertically) {
                if (b("clearable") && value.isNotEmpty() && !disabled)
                    Control("clear-button", "md-icon-button", mapOf("variant" to "standard", "icon" to "close", "aria-label" to labels.clear) + densityProps, keys = false,
                        onClick = { clearValue(); rt.focusLater("calendar-button") })
                Control("calendar-button", "md-icon-button", mapOf("variant" to if (rt.isOpen) "tonal" else "standard",
                    "icon" to if (calendarSlot) "" else s("calendarIcon", "calendar_today"),
                    "aria-label" to if (rt.isOpen) labels.closeCalendar else labels.openCalendar, "aria-haspopup" to "dialog",
                    "aria-expanded" to if (rt.isOpen) "true" else "false", "disabled" to disabled) + densityProps, keys = false,
                    onClick = { if (rt.isOpen) closePicker(true) else openPicker() }) { n -> if (n == "" && calendarSlot) slots!!.Render("calendar-icon") }
            }
        }
        @Composable fun Trigger() {
            val a = appearance
            val focusColor = a.color("field-focus-color") ?: token("primary", "#6750A4")
            val fieldProps: Props = mapOf("variant" to if (s("fieldVariant") == "filled") "filled" else "outlined", "label" to labels.label, "value" to display,
                "supportingText" to supporting, "error" to showError, "errorText" to errorText, "reserveSupportingSpace" to b("reserveSupportingSpace"),
                "disabled" to disabled, "required" to b("required"), "appearFocused" to rt.isOpen)
            // An embedded md-text-field (as md-number-field's): its events stay inside the picker; the clear / calendar buttons
            // are the picker's own trailing controls.
            val hooks = AWCFieldHooks(
                focus = { f -> rt.fieldHasFocus = f },
                trailing = { TriggerButtons() },
                controller = triggerController,
                event = { n, d ->
                    when (n) {
                        // Typing shows the draft (`focused ? inputDraft : formatted`) until a commit (Enter / blur) succeeds.
                        "mdInput" -> { rt.fieldFocused = true; rt.draft = d?.toString() ?: ""; emit("mdInput", mapOf("value" to rt.draft)) }
                        "mdChange" -> { rt.draft = d?.toString() ?: rt.draft; fieldCommit(); rt.fieldFocused = rt.validationMessage.isNotEmpty() }
                    }
                })
            Box(Modifier.widthIn(max = m.triggerMax.dp)
                .onGloballyPositioned { anchor = it.boundsInRoot(); positionDocked() }
                .inspectAWCNode(inspection, "field", "field")
                .focusRequester(triggerFocus).focusGroup()) {
                CompositionLocalProvider(LocalAWCInspection provides inspection?.let { it.copy(id = it.id + ".field", entered = true, parentId = it.id) }) {
                    AWCTextFieldAppearanceScope(AWCTextFieldAppearance(activeIndicatorColor = focusColor, containerColor = a.color("field-container-color"),
                        containerShape = a.length("field-container-shape"), filledPill = a.length("field-filled-pill"), iconColor = if (rt.isOpen) focusColor else a.color("icon-color"),
                        inputColor = a.color("field-text-color"), labelColor = a.color("label-color"), outlineColor = a.color("field-color"),
                        supportingTextColor = a.color("field-supporting-color"))) {
                        NativeTextField(fieldProps, { _, _ -> }, { _, _ -> }, { name -> if (name == "leading-icon" && hasSlot("leading-icon")) slots!!.Render("leading-icon") },
                            null, null, hooks)
                    }
                }
            }
        }

        // MARK: Composition
        val hostModifier = Modifier.graphicsLayer { alpha = if (disabled) .5f else 1f }
        // The app's slots render only where the source places them: nested parts (md-button, md-text-field) never see them.
        CompositionLocalProvider(LocalAWCSlots provides null) {
        if (docked) {
            Layout(content = {
                // Keys at the body move no focus (Chrome scrolls the page): Android would search for a default control.
                Box { Trigger(); Box(Modifier.size(0.dp).focusRequester(bodyRequester).onFocusChanged { if (!it.isFocused) bodyWanted = false }
                    .focusProperties { canFocus = bodyWanted }
                    .onKeyEvent { e -> e.key in setOf(Key.DirectionUp, Key.DirectionDown, Key.DirectionLeft, Key.DirectionRight, Key.PageUp, Key.PageDown,
                        Key.MoveHome, Key.MoveEnd, Key.Spacebar, Key.Enter) }
                    .focusable().semantics { hideFromAccessibility() }) }
                if (rt.isOpen) {
                    val closing = rt.panelClosing; val end = rt.dockedEnd != rtl
                    val origin = if (rt.dockedAbove && !closing) TransformOrigin(if (end) 1f else 0f, 1f) else TransformOrigin(if (end) 1f else 0f, 0f)
                    DPKeyframes(rt, "panel", if (closing) -rt.openToken else rt.openToken, if (closing) panelOutMs else selBloomMs, if (closing) DPAccelerate else selBloomCurve, reduced,
                        modifier = Modifier.onGloballyPositioned { panelBox = it.boundsInRoot(); if (rt.dockedMaxBlock == null) dockedHeight = it.size.height / pxDensity; positionDocked() },
                        origin = origin, values = { pr -> if (closing) dpBloomOut(pr) else dpBloomIn(pr) }) { Panel(true) }
                }
            }, modifier = hostModifier.zIndex(if (rt.isOpen) 1f else 0f)) { ms, c ->
                val trigger = ms[0].measure(c.copy(minWidth = 0, minHeight = 0))
                val panel = ms.getOrNull(1)?.measure(Constraints())
                layout(trigger.width, trigger.height) {
                    trigger.placeRelative(0, 0)
                    if (panel != null) {
                        val gap = (4 * density).roundToInt()
                        val shown = rt.dockedMaxBlock?.let { min(panel.height, (it * density).roundToInt()) } ?: panel.height
                        val y = if (rt.dockedAbove) -(gap + shown) else trigger.height + gap
                        val x = if (rt.dockedEnd) trigger.width - panel.width else 0
                        panel.placeRelative(x, y, 1f)
                    }
                }
            }
        } else {
            // The modal variant's host is 0 × 0 (Chrome): it is recorded anyway so the dialog's parts have their root.
            Box(hostModifier.then(if (variant == "modal") Modifier.inspectAWCNode(inspection, "", "md-date-picker", allowZeroSize = true) else Modifier)) {
                if (variant == "modal") Box(Modifier.size(0.dp).semantics { hideFromAccessibility() }) else Trigger()
            }
        }

        }

        // MARK: Modal dialog
        if (!docked && rt.isOpen && session != null) {
            // Opened from its own trigger (calendar button / field), the dialog restores nothing on close (Chrome: <body>).
            DisposableEffect(session, owner) { session.acquire(owner); if (rt.openedFromInside) owner.opener = null; onDispose { session.release(owner.id) } }
            val context = currentCompositionLocalContext
            AWCModalEntryEffect(session, owner.id, true, 1000.0) {
                CompositionLocalProvider(context) {
                    CompositionLocalProvider(LocalAWCNativeDensity provides scale, LocalAWCSlots provides null) {
                        val closing = rt.panelClosing; val tokenNow = if (closing) -rt.openToken else rt.openToken
                        val scrimColor = color(dpAlpha(hook("scrim-color", "scrim", "#000000"), .32))
                        Box(Modifier.fillMaxSize().inspectAWCNode(inspection, "modal", "modal")) {
                            DPKeyframes(rt, "scrim", tokenNow, if (closing) panelOutMs else 150.0, DPStandard, reduced, modifier = Modifier.fillMaxSize(),
                                values = { pr -> listOf(if (closing) 1 - pr else pr, 1.0, 0.0, 0.0) }) {
                                Box(Modifier.fillMaxSize().background(scrimColor)
                                    .pointerInput(Unit) { awaitPointerEventScope { while (true) { val e = awaitPointerEvent(PointerEventPass.Main); e.changes.forEach { it.consume() }
                                        if (e.type == PointerEventType.Release) { if (b("scrimDismissible", true)) cancel() else { rt.focusedControl = null; session.blur() } } } } }
                                    .inspectAWCNode(inspection, "scrim", "scrim"))
                            }
                            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                                DPKeyframes(rt, "panel", tokenNow, if (closing) panelOutMs else 300.0, if (closing) DPAccelerate else DPEmphasized, reduced, origin = TransformOrigin(.5f, 0f),
                                    values = { pr -> if (closing) dpBloomOut(pr) else listOf(pr, .9 + .1 * pr, 0.0, 0.0) }) { Panel(false) }
                            }
                        }
                    }
                }
            }
        }
    }
}

/** One row of the 7-column grid (`repeat(7, 1fr)`, `justify-items: center`): each cell centred in its column at its exact
 *  position (rounded once to the pixel; a Row would round every column width and drift up to a pixel across the row). A grid
 *  narrower than seven cells keeps them at `col` and overflows towards the inline end, as Chrome's min-content columns do. */
@Composable
private fun DPCellRow(col: Double, gap: Double, modifier: Modifier, content: @Composable () -> Unit) {
    Layout(content, modifier) { ms, c ->
        val ps = ms.map { it.measure(Constraints()) }
        val total = ((7 * col + 6 * gap) * density).roundToInt()
        val w = if (c.hasBoundedWidth) max(c.minWidth, min(c.maxWidth, total)).let { if (c.minWidth == c.maxWidth) c.maxWidth else it } else total
        val h = max(c.minHeight, ps.maxOfOrNull { it.height } ?: 0)
        layout(w, h) {
            ps.forEachIndexed { i, pl -> pl.placeRelative(((i * (col + gap) + col / 2) * density - pl.width / 2.0).roundToInt(), (h - pl.height) / 2) }
        }
    }
}

/** Spans the body's 12px inline padding (the selection divider / list, the year-grid wrap). */
private fun Modifier.layout12(): Modifier = this.layout { measurable, constraints ->
    val extra = (24 * density).roundToInt()
    val p = measurable.measure(constraints.copy(minWidth = (constraints.minWidth + extra).coerceAtLeast(0),
        maxWidth = if (constraints.hasBoundedWidth) constraints.maxWidth + extra else Constraints.Infinity))
    layout(p.width - extra, p.height) { p.placeRelative(-extra / 2, 0) }
}

/** The panel column: header and actions at their natural height, the body between them shrunk (and clipped) so the panel
 *  stays within its max-block-size; `flexible < 0`: nothing shrinks, the box stops at maxHeight and the rest overflows. */
@Composable
private fun DPColumn(width: Double, maxHeight: Double, flexible: Int, modifier: Modifier, content: @Composable () -> Unit) {
    Layout(content, modifier) { ms, _ ->
        val w = (width * density).roundToInt(); val maxH = (maxHeight * density).roundToInt()
        val natural = Constraints(minWidth = w, maxWidth = w)
        val placeables = arrayOfNulls<Placeable>(ms.size)
        ms.forEachIndexed { i, mm -> if (i != flexible) placeables[i] = mm.measure(natural) }
        val fixed = placeables.filterNotNull().sumOf { it.height }
        if (flexible in ms.indices) placeables[flexible] = ms[flexible].measure(Constraints(minWidth = w, maxWidth = w, maxHeight = max(0, maxH - fixed)))
        val list = placeables.map { it!! }
        val total = list.sumOf { it.height }
        layout(w, if (flexible < 0) min(total, maxH) else total) {
            var y = 0
            list.forEach { it.placeRelative(0, y); y += it.height }
        }
    }
}
