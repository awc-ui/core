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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusProperties
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.TransformOrigin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.graphics.addOutline
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.key.*
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.PointerEventType
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.semantics.*
import androidx.compose.ui.text.TextRange
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.TextFieldValue
import androidx.compose.ui.text.style.LineHeightStyle
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt
import kotlin.math.sin
import kotlin.math.sqrt

// md-time-picker: dedicated Compose renderer of the Web component (packages/core/src/components/md-time-picker): a read-only
// md-text-field trigger and a modal dialog with the HH / MM tiles, the AM / PM group, the dial (dial variant) and the footer
// (mode toggle, Cancel, OK), hosted by the nearest AWCModalScope (viewport, scrim, Escape / back / Tab routing) as md-dialog is.
// A port of the SwiftUI renderer (NativeTimePicker.swift / TimePickerModel.swift), which follows md-time-picker.css / .tsx.

/**
 * md-time-picker's public CSS custom properties (`--md-time-picker-<name>`) as native appearance hooks, keyed by the name
 * without the prefix (`"dial-bg"`, `"input-shape"`, …): colours `#RRGGBB[AA]` or `rgb[a](…)`, lengths in dp (a `px` suffix is
 * accepted), durations in ms, `motion-easing` a `cubic-bezier(…)`, `dialog-elevation` a box-shadow list, `hand-length` a
 * percentage of the dial radius. Unknown names are ignored, as an unknown custom property is.
 */
@Immutable data class AWCTimePickerAppearance(val hooks: Map<String, String> = emptyMap()) {
    /** Later values win (a targeted appearance over the inherited one). */
    fun merge(o: AWCTimePickerAppearance) = AWCTimePickerAppearance(hooks + o.hooks)
    /** The source's back-compat alias: `time-display-shape` sets the tile shape (the legacy `time-display-*` colours were dropped). */
    internal fun raw(k: String): String? = hooks[k]?.trim() ?: if (k == "input-shape") hooks["time-display-shape"]?.trim() else null
    internal fun color(k: String): String? = raw(k)?.let(::awcTimePickerColor)
    internal fun number(k: String): Double? {
        var v = raw(k) ?: return null
        for (s in listOf("px", "ms", "%")) if (v.endsWith(s)) v = v.dropLast(s.length)
        return v.trim().toDoubleOrNull()?.takeIf { it.isFinite() }
    }
    internal val easing: List<Double>? get() = accordionCubicBezierCurve(raw("motion-easing"))
    companion object {
        /** Hooks from plain data (the Laboratory transport, picker-appearance.js): strings and numbers by hook name, the name in
         *  kebab or camel case (`dialogHorizontalWidth12h` → `dialog-horizontal-width-12h`). */
        fun fromValues(values: Map<String, AWCValue>) = AWCTimePickerAppearance(values.mapNotNull { (k, v) ->
            when (v) { is String -> hookName(k) to v; is Number -> hookName(k) to v.toString(); else -> null } }.toMap())
        /** A dash before each capital and before a number that follows a letter (kebab names are kept). */
        fun hookName(name: String) = buildString { var previous: Char? = null
            for (c in name) { if (c.isUpperCase() || (c.isDigit() && previous?.isLetter() == true)) append('-'); append(c.lowercaseChar()); previous = c } }
    }
}
/** `#RGB[A]`, `#RRGGBB[AA]` or `rgb[a](r, g, b[, a])` (also the slash and space syntaxes) as `#RRGGBBAA`. */
internal fun awcTimePickerColor(raw: String): String? {
    val v = raw.trim()
    if (v.startsWith("#")) {
        val h = v.drop(1)
        if (!h.all { it.isDigit() || it.lowercaseChar() in 'a'..'f' }) return null
        return when (h.length) {
            3, 4 -> "#" + h.map { "$it$it" }.joinToString("").uppercase() + (if (h.length == 3) "FF" else "")
            6 -> v.uppercase() + "FF"
            8 -> v.uppercase()
            else -> null
        }
    }
    if (!v.startsWith("rgb") || !v.contains('(') || !v.endsWith(")")) return null
    val parts = v.substringAfter('(').dropLast(1).replace("/", " ").replace(",", " ").split(" ").filter { it.isNotBlank() }
    if (parts.size != 3 && parts.size != 4) return null
    val c = parts.mapIndexed { i, p ->
        val pct = p.endsWith("%"); val n = (if (pct) p.dropLast(1) else p).toDoubleOrNull()?.takeIf { it.isFinite() } ?: return null
        if (i < 3) min(255.0, max(0.0, if (pct) n * 2.55 else n)) else min(1.0, max(0.0, if (pct) n / 100 else n))
    }
    val a = if (c.size == 4) c[3] else 1.0
    return String.format(java.util.Locale.US, "#%02X%02X%02X%02X", c[0].roundToInt(), c[1].roundToInt(), c[2].roundToInt(), (a * 255).roundToInt())
}
internal val LocalAWCTimePickerAppearance = staticCompositionLocalOf { AWCTimePickerAppearance() }
internal val LocalAWCTimePickerAppearanceTargets = staticCompositionLocalOf<Map<String, AWCTimePickerAppearance>> { emptyMap() }
internal val LocalAWCTimePickerInspector = staticCompositionLocalOf<((AWCTimePickerRuntime) -> Unit)?> { null }
internal val LocalAWCTimePickerController = staticCompositionLocalOf<AWCTimePickerController?> { null }
/** Binds `controller` to the md-time-picker(s) below. */
@Composable fun AWCTimePickerControllerScope(controller: AWCTimePickerController, content: @Composable () -> Unit) =
    CompositionLocalProvider(LocalAWCTimePickerController provides controller, content = content)

/** `getValidity()` of md-time-picker: validity, message and the three flags the source sets (ElementInternals). */
data class AWCTimePickerValidity(val valid: Boolean, val validationMessage: String, val valueMissing: Boolean, val rangeUnderflow: Boolean, val rangeOverflow: Boolean) {
    /** As AWCConstraintValidity.value: `{ valid, validationMessage, flags: { valueMissing, rangeUnderflow, rangeOverflow } }`. */
    val value: Map<String, AWCValue> get() = mapOf("valid" to valid, "validationMessage" to validationMessage,
        "flags" to mapOf("valueMissing" to valueMissing, "rangeUnderflow" to rangeUnderflow, "rangeOverflow" to rangeOverflow))
    companion object { val VALID = AWCTimePickerValidity(true, "", false, false, false) }
}

/** md-time-picker's methods for a mounted picker: `show()` (opens the dialog), `hide()` (closes it as Cancel: `mdCancel`) and
 *  constraint validation (`checkValidity()`, `reportValidity()`, `getValidity()`). Attach with AWCTimePickerControllerScope. */
class AWCTimePickerController {
    internal var runtime: AWCTimePickerRuntime? = null
    val isConnected get() = runtime != null
    val isOpen get() = runtime?.isOpen ?: false
    fun show() { runtime?.show?.invoke() }
    fun hide() { runtime?.hide?.invoke() }
    /** The committed value's validity (`required`, `min` / `max`, an overnight window), whether or not it is disabled. */
    fun getValidity(): AWCTimePickerValidity {
        val v = runtime?.validityRecord?.invoke() ?: return AWCTimePickerValidity.VALID
        return AWCTimePickerValidity(v.first, v.second, v.third["valueMissing"] ?: false, v.third["rangeUnderflow"] ?: false, v.third["rangeOverflow"] ?: false)
    }
    /** Validity without presenting it; a disabled picker is barred from validation and reports true. */
    fun checkValidity(): Boolean { val r = runtime ?: return true; return r.disabledNow || getValidity().valid }
    /** Like checkValidity(), but an invalid picker shows its message as the trigger's error text and focuses the trigger. */
    fun reportValidity(): Boolean {
        val r = runtime ?: return true
        if (r.disabledNow) return true
        val v = getValidity(); if (v.valid) return true
        r.revealed = true; r.validationMessage = v.validationMessage; r.focusLater("trigger"); return false
    }
}
/** md-time-picker hooks for every picker below (or for the picker whose `id` is [id]). */
@Composable fun AWCTimePickerAppearanceScope(appearance: AWCTimePickerAppearance, id: String? = null, content: @Composable () -> Unit) {
    if (id != null) {
        val t = LocalAWCTimePickerAppearanceTargets.current
        CompositionLocalProvider(LocalAWCTimePickerAppearanceTargets provides t + (id to (t[id] ?: AWCTimePickerAppearance()).merge(appearance)), content = content)
    } else CompositionLocalProvider(LocalAWCTimePickerAppearance provides LocalAWCTimePickerAppearance.current.merge(appearance), content = content)
}
/** Receives each mounted picker's runtime (tests, Laboratory inspector). */
@Composable fun AWCTimePickerInspectionScope(onPicker: (AWCTimePickerRuntime) -> Unit, content: @Composable () -> Unit) =
    CompositionLocalProvider(LocalAWCTimePickerInspector provides onPicker, content = content)

/** The source's user-facing strings (all properties, English defaults). */
internal data class AWCTimePickerLabels(val p: Props) {
    private fun s(k: String, f: String) = (p[k] as? String) ?: f
    val label = s("label", "Select time"); val headline = s("headline", ""); val headlineInput = s("headlineInputLabel", "Enter time")
    val headlineDial = s("headlineDialLabel", "Select time"); val valueMissing = s("valueMissingLabel", "Please select a time.")
    val rangeUnderflow = s("rangeUnderflowLabel", "Please select a time at or after {min}."); val rangeOverflow = s("rangeOverflowLabel", "Please select a time at or before {max}.")
    val rangeOutside = s("rangeOutsideLabel", "Please select a time at or after {min} or at or before {max}.")
    val cancel = s("cancelLabel", "Cancel"); val ok = s("okLabel", "OK"); val am = s("amLabel", "AM"); val pm = s("pmLabel", "PM")
    val hour = s("hourLabel", "Hour"); val minute = s("minuteLabel", "Minute"); val toggleDial = s("toggleDialLabel", "Toggle dial picker")
    val toggleInput = s("toggleInputLabel", "Toggle keyboard input"); val period = s("periodLabel", "Period")
}

object AWCTimeMath {
    /** `^(\d{1,2}):(\d{2})$` within 00:00…23:59 (minutes of the day), or null. */
    fun parse(v: String): Int? {
        val parts = v.split(":"); if (parts.size != 2) return null
        val (a, b) = parts
        if (a.length !in 1..2 || b.length != 2 || !a.all { it in '0'..'9' } || !b.all { it in '0'..'9' }) return null
        val h = a.toInt(); val m = b.toInt()
        return if (h <= 23 && m <= 59) h * 60 + m else null
    }
    fun two(v: Int) = String.format(java.util.Locale.US, "%02d", v)
    fun iso(h: Int, m: Int) = two(h) + ":" + two(m)
    /** The hour shown for a 24-hour value (12h: 12, 1…12). */
    fun displayHour(h24: Int, twelve: Boolean) = if (!twelve) h24 else if (h24 == 0) 12 else if (h24 > 12) h24 - 12 else h24
    fun hour24(display: Int, pm: Boolean, twelve: Boolean): Int {
        if (!twelve) return ((display % 24) + 24) % 24
        val n = if (display == 0) 12 else display
        return if (n == 12) (if (pm) 12 else 0) else if (pm) n + 12 else n
    }
    /** `parseInt` of a buffer (leading digits), or null. */
    fun parseInt(s: String): Int? { val d = s.takeWhile { it in '0'..'9' }; return if (d.isEmpty()) null else d.toIntOrNull() }
    /** The clock the details read "today" from (`new Date()` in the source); tests pin it as the oracle page does. */
    @Volatile var clock: () -> Long = { System.currentTimeMillis() }
    /** Today's date at h:m (local), the detail's `date` / `isoDateTime` (UTC, `toISOString`). */
    fun isoDateTime(h: Int, m: Int, now: Long = clock()): String {
        val cal = java.util.Calendar.getInstance(); cal.timeInMillis = now
        cal.set(java.util.Calendar.HOUR_OF_DAY, h); cal.set(java.util.Calendar.MINUTE, m); cal.set(java.util.Calendar.SECOND, 0); cal.set(java.util.Calendar.MILLISECOND, 0)
        val f = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.US); f.timeZone = java.util.TimeZone.getTimeZone("UTC")
        return f.format(cal.time)
    }
    /** JS `Math.round` (halves toward +∞). */
    fun jsRound(v: Double) = floor(v + 0.5)
    /** Premultiplied sRGB (0–1) ↔ premultiplied Oklab (CSS Color 4). */
    fun srgbToOklab(v: List<Double>): List<Double> {
        val a = v[3]; if (a <= 0) return listOf(0.0, 0.0, 0.0, 0.0)
        fun lin(c: Double) = if (c <= 0.04045) c / 12.92 else Math.pow((c + 0.055) / 1.055, 2.4)
        val r = lin(v[0] / a); val g = lin(v[1] / a); val b = lin(v[2] / a)
        val l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
        val m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
        val s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
        return listOf((0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s) * a, (1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s) * a,
            (0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s) * a, a)
    }
    fun oklabToSRGB(v: List<Double>): List<Double> {
        val a = v[3]; if (a <= 0) return listOf(0.0, 0.0, 0.0, 0.0)
        val L = v[0] / a; val A = v[1] / a; val B = v[2] / a
        val l = Math.pow(L + 0.3963377774 * A + 0.2158037573 * B, 3.0); val m = Math.pow(L - 0.1055613458 * A - 0.0638541728 * B, 3.0)
        val s = Math.pow(L - 0.0894841775 * A - 1.2914855480 * B, 3.0)
        fun gam(c: Double) = (if (c <= 0.0031308) 12.92 * c else 1.055 * Math.pow(c, 1 / 2.4) - 0.055).coerceIn(0.0, 1.0)
        return listOf(gam(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s) * a, gam(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s) * a,
            gam(-0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s) * a, a)
    }
}
/** `color-mix(in srgb, x p, y)` (premultiplied) as `#RRGGBBAA`. */
internal fun tpMix(x: String, p: Double, y: String): String {
    val cx = tpPremultiplied(x); val cy = tpPremultiplied(y); val mm = (0..3).map { cx[it] * p + cy[it] * (1 - p) }; val a = mm[3]
    fun b(c: Double) = (c.coerceIn(0.0, 1.0) * 255).roundToInt()
    return if (a <= 0) "#00000000" else String.format(java.util.Locale.US, "#%02X%02X%02X%02X", b(mm[0] / a), b(mm[1] / a), b(mm[2] / a), b(a))
}

/** The source's detail object (`MdTimePickerChangeDetail`). */
internal fun awcTimePickerDetail(h: Int, m: Int): Map<String, AWCValue> {
    val value = AWCTimeMath.iso(h, m); val iso = AWCTimeMath.isoDateTime(h, m)
    return mapOf("value" to value, "iso" to "$value:00", "isoDateTime" to iso, "date" to iso, "hours" to h.toDouble(), "minutes" to m.toDouble(),
        "period" to if (h >= 12) "PM" else "AM")
}

/** A CSS transition over several channels (a colour's premultiplied RGBA, the hand angle), started at the next frame. */
internal class TPTrack(initial: List<Double>) {
    var channels = initial.map { v -> AWCCSSTransitionTrack().also { it.snap(v) } }
    var target: List<Double> = initial
    var pending: List<Double>? = null
    var duration = 0.0
    /** The change was made in the input handler: the transition started with the frame that was being rendered. */
    var immediate = false
    fun presented(now: Double) = channels.map { it.presented(now) }
    fun isRunning(now: Double) = pending != null || channels.any { it.isRunning(now) }
}

/** The component's state (@State and private fields of md-time-picker.tsx), its presented motion and focus handles. */
@Stable
class AWCTimePickerRuntime internal constructor() {
    var isOpen by mutableStateOf(false); internal set
    /** "dial" or "input". */
    var mode by mutableStateOf("dial"); internal set
    /** "hour" or "minute". */
    var selecting by mutableStateOf("hour"); internal set
    var draftHours by mutableIntStateOf(12); internal set
    var draftMinutes by mutableIntStateOf(0); internal set
    var hourBuffer by mutableStateOf(""); internal set
    var minuteBuffer by mutableStateOf(""); internal set
    var hourError by mutableStateOf(false); internal set
    var minuteError by mutableStateOf(false); internal set
    var validationMessage by mutableStateOf(""); internal set
    /** Inline validation (InlineValidationPresenter): the message shows once reportValidity() revealed it, then follows the
     *  validity until the picker is disabled. */
    internal var revealed = false
    internal var disabledNow = false
    /** Focused part inside the dialog (input-hour, input-minute, period-am, period-pm, toggle-mode, cancel-button, confirm-button) or "trigger". */
    var focused by mutableStateOf<String?>(null); internal set
    var focusVisible by mutableStateOf(false); internal set
    var hovered by mutableStateOf<String?>(null); internal set
    /** The active dial number's label and the presented hand angle (degrees, unwrapped). */
    var activeNumber by mutableStateOf<String?>(null); internal set
    var handAngle = 0.0; internal set
    /** The hand's target angle (unwrapped) and length (fraction of the radius): the source's inline rotate() and length. */
    var handTarget = 0.0; internal set
    var handLength = .8; internal set
    // Committed state and bookkeeping.
    var committedHours = 12; internal set
    var committedMinutes = 0; internal set
    var committedValue = ""; internal set
    internal var defaultValue = ""
    internal var loaded = false
    internal var seenValue: String? = null
    internal var lastInputEmitKey = -1
    internal var hourAngle = 0.0; internal var minuteAngle = 0.0; internal var lastHandMode: String? = null
    internal var lastValidityKey: String? = null
    internal var dragging = false
    internal var viewportPending = false
    internal var openedFromTrigger = false
    // Motion: the frame clock, the dialog's and the mode area's keyframe starts, CSS transitions by key.
    internal val clock = AWCModalClock()
    internal var openedAt: Double? = null; internal var openPending = false
    internal var modeAt: Double? = null; internal var modePending = false
    internal val tracks = mutableMapOf<String, TPTrack>()
    /** Presented motion per key (scrim, dialog, mode-dial / mode-input, hand, period / number colours) with frame times (ms). */
    val motion = mutableMapOf<String, MutableList<Pair<Double, List<Double>>>>()
    internal fun record(key: String, v: List<Double>) {
        val list = motion.getOrPut(key) { mutableListOf() }
        if (list.lastOrNull()?.second == v) return
        list += clock.frameMillis to v; if (list.size > 600) list.subList(0, list.size - 600).clear()
    }
    /** A style change starts its CSS transition in the next frame; changes before that frame coalesce. */
    /** `immediate`: the source writes the style in the input handler (the hand's rotation): the transition starts with the
     *  frame being rendered instead of the next one. */
    internal fun retarget(key: String, target: List<Double>, duration: Double, immediate: Boolean = false) {
        val t = tracks[key] ?: run { tracks[key] = TPTrack(target); return }
        if (t.target == target) return
        t.target = target; t.duration = duration; clock.version++
        t.pending = target; t.immediate = immediate
    }
    /** Colour transitions: Chrome interpolates two legacy colours in premultiplied sRGB and any other pair (a `color-mix()`
     *  result is `color(srgb …)`) in premultiplied Oklab; presented and recorded as premultiplied sRGB. */
    internal val colorOklab = mutableMapOf<String, Boolean>(); internal val colorLegacy = mutableMapOf<String, Boolean>()
    internal val colorTarget = mutableMapOf<String, List<Double>>()
    internal fun retargetColor(key: String, premultiplied: List<Double>, legacy: Boolean, duration: Double) {
        val previous = colorTarget[key]
        if (previous == null || tracks[key] == null) { colorTarget[key] = premultiplied; colorLegacy[key] = legacy; colorOklab[key] = false; tracks[key] = TPTrack(premultiplied); return }
        if (previous == premultiplied) { colorLegacy[key] = legacy; return }
        val oklab = !((colorLegacy[key] ?: true) && legacy)
        if (oklab != (colorOklab[key] ?: false)) {
            val current = presentedColor(key, clock.frameMillis)
            tracks[key] = TPTrack(if (oklab) AWCTimeMath.srgbToOklab(current) else current); colorOklab[key] = oklab
        }
        colorTarget[key] = premultiplied; colorLegacy[key] = legacy
        retarget(key, if (oklab) AWCTimeMath.srgbToOklab(premultiplied) else premultiplied, duration)
    }
    internal fun presentedColor(key: String, now: Double): List<Double> = presented(key, now).let { if (colorOklab[key] == true && it.size == 4) AWCTimeMath.oklabToSRGB(it) else it }
    /** Selects the focused tile's text (Control+A). */
    fun selectAll() { val f = focused ?: return; fields[f]?.let { fields[f] = it.copy(selection = TextRange(0, it.text.length)) } }
    internal fun presented(key: String, now: Double): List<Double> = tracks[key]?.presented(now) ?: emptyList()
    internal val requesters = mutableMapOf<String, FocusRequester>()
    internal fun requester(id: String) = requesters.getOrPut(id) { FocusRequester() }
    /** The tiles' text and selection (the source writes the uncontrolled inputs imperatively). */
    internal val fields = mutableStateMapOf<String, TextFieldValue>()
    /** A part to focus at the next frame (and select, for a tile); bumped serial re-runs the request. */
    internal var pendingFocus: String? = null
    internal var focusSerial by mutableIntStateOf(0)
    internal var pendingFrames = 2
    internal fun focusLater(id: String, frames: Int = 2) { pendingFocus = id; pendingFrames = frames; focusSerial++ }
    /** Methods (`show()`, `close()`, `checkValidity()` / `reportValidity()`), bound by the mounted view. */
    var show: () -> Unit = {}; internal set
    var hide: () -> Unit = {}; internal set
    var validityRecord: () -> Triple<Boolean, String, Map<String, Boolean>> = { Triple(true, "", emptyMap()) }; internal set

    val period get() = if (draftHours >= 12) "PM" else "AM"
    fun displayHour(twelve: Boolean) = AWCTimeMath.displayHour(draftHours, twelve)
    /** `parseValueInto`: an empty value seeds 12:00. */
    internal fun parseValueInto(v: String): Boolean {
        if (v.isEmpty()) { draftHours = 12; draftMinutes = 0; return true }
        val mins = AWCTimeMath.parse(v) ?: return false
        draftHours = mins / 60; draftMinutes = mins % 60; return true
    }
    internal fun setField(id: String, text: String, selectAll: Boolean = false) {
        fields[id] = TextFieldValue(text, if (selectAll) TextRange(0, text.length) else TextRange(text.length))
    }
    internal fun syncInputsFromDraft(twelve: Boolean) {
        hourBuffer = displayHour(twelve).toString(); minuteBuffer = AWCTimeMath.two(draftMinutes)
        hourError = false; minuteError = false
        setField("input-hour", hourBuffer, fields["input-hour"]?.let { it.selection.length == it.text.length && it.text.isNotEmpty() } ?: false)
        setField("input-minute", minuteBuffer, fields["input-minute"]?.let { it.selection.length == it.text.length && it.text.isNotEmpty() } ?: false)
    }
    /** The hand angle unwrapped so it turns the short way (advanceHandAngle). */
    internal fun advanceHand(mode: String, raw: Double): Double {
        if (lastHandMode != mode) { lastHandMode = mode; if (mode == "hour") hourAngle = raw else minuteAngle = raw; return raw }
        val last = if (mode == "hour") hourAngle else minuteAngle
        val delta = ((raw - last) % 360 + 540) % 360 - 180
        val next = last + delta
        if (mode == "hour") hourAngle = next else minuteAngle = next
        return next
    }
    companion object {
        /** Mounted pickers by `id` (tests, Laboratory methods). */
        val mounted = mutableMapOf<String, java.lang.ref.WeakReference<AWCTimePickerRuntime>>()
    }
}

/** Resolved geometry: hooks, the density scale (type and tiles) and the spacing-token rung (insets and gaps). */
internal class TPMetrics(private val a: AWCTimePickerAppearance, d: Double, r: Double, twelve: Boolean, horizontal: Boolean) {
    private fun n(k: String) = a.number(k)
    val insetMd = if (r <= -2) 8.0 else 12.0
    val insetLg = if (r <= -4) 8.0 else if (r <= -2) 12.0 else 16.0
    val insetXl = if (r <= -3) 16.0 else if (r <= -2) 20.0 else 24.0
    private val gapXs = if (r <= -4) 2.0 else 4.0; private val gapSm = if (r <= -3) 4.0 else 8.0
    val padding = n("dialog-padding") ?: insetXl
    val headlineSize = n("headline-font-size") ?: max(10.0, 12 + d * .5); val headlineWeight = n("headline-font-weight") ?: 500.0
    val headlineSpacing = n("headline-spacing") ?: max(4.0, 20 + d * 2)
    val inputFont = n("input-font-size") ?: max(32.0, 45 + d * 2); val inputWeight = n("input-font-weight") ?: 400.0
    val inputHeight = n("input-height") ?: inputFont * 1.6; val inputWidth = n("input-width") ?: inputHeight * 4 / 3
    val inputBorder = n("input-border-width") ?: 2.0; val separator = n("input-separator-width") ?: 24.0; val hintGap = n("input-hint-gap") ?: gapXs
    val periodFont = n("period-font-size") ?: max(12.0, 14 + d * .5); val periodWeight = n("period-font-weight") ?: 500.0
    val periodVWidth = n("period-vertical-width") ?: 52.0; val periodVHeight = n("period-vertical-height") ?: 80.0
    val periodVHeightInput = n("period-vertical-height-input") ?: 72.0
    val periodHWidth = n("period-horizontal-width") ?: 216.0; val periodHHeight = n("period-horizontal-height") ?: 38.0; val periodOutline = n("period-outline-width") ?: 1.0
    val dial = n("dial-size") ?: 256.0; val target = n("dial-target-size") ?: 48.0; val center = n("dial-center-size") ?: 8.0; val handWidth = n("dial-hand-width") ?: 2.0
    val numberFont = n("dial-number-font-size") ?: max(13.0, 16 + d * .5); val numberWeight = n("dial-number-font-weight") ?: 400.0
    val numberActiveWeight = n("dial-number-active-font-weight") ?: 500.0
    val footerGap = n("footer-gap") ?: gapSm; val actionsGap = n("actions-gap") ?: gapSm
    val dialogWidth = if (horizontal) (if (twelve) n("dialog-horizontal-width-12h") ?: 572.0 else n("dialog-horizontal-width-24h") ?: 608.0) else n("dialog-min-width") ?: 328.0
    val dialogShape = n("dialog-shape") ?: 28.0; val inputShape = n("input-shape") ?: 8.0; val periodShape = n("period-shape") ?: 8.0
    // `trigger-icon-size` has no visible effect in Chrome (md-text-field's own leading-icon size wins; Gate-1 finding).
    val triggerWidth = n("trigger-min-width") ?: 240.0
    val enter = n("dialog-enter-duration") ?: 500.0; val modeSwap = n("mode-swap-duration") ?: 450.0
    val easing = a.easing ?: listOf(.05, .7, .1, 1.0)
    companion object { const val NATURAL_LINE = 1.171875 }
}

private val TPStandard = listOf(.2, 0.0, 0.0, 1.0)
/** CSS line box: the glyphs centred in the full line height, nothing trimmed. */
private val TPLineBox = LineHeightStyle(LineHeightStyle.Alignment.Center, LineHeightStyle.Trim.None)
private fun tpProgress(elapsed: Double, duration: Double, curve: List<Double>): Double {
    if (duration <= 0) return 1.0
    val t = (elapsed / duration).coerceIn(0.0, 1.0)
    return if (t == 0.0) 0.0 else if (t == 1.0) 1.0 else accordionCubicBezier(t, curve)
}
internal fun tpPremultiplied(hex: String): List<Double> {
    val h = hex.trim().removePrefix("#")
    val v = h.toLongOrNull(16) ?: 0L; val rgba = h.length == 8; val rgb = if (rgba) v shr 8 else v
    val a = if (rgba) (v and 255L) / 255.0 else 1.0
    return listOf(((rgb shr 16) and 255L) / 255.0 * a, ((rgb shr 8) and 255L) / 255.0 * a, (rgb and 255L) / 255.0 * a, a)
}
private fun tpColor(v: List<Double>, offset: Int = 0): Color {
    val a = v[offset + 3]
    return if (a <= 0) Color.Transparent else Color((v[offset] / a).toFloat().coerceIn(0f, 1f), (v[offset + 1] / a).toFloat().coerceIn(0f, 1f),
        (v[offset + 2] / a).toFloat().coerceIn(0f, 1f), a.toFloat().coerceIn(0f, 1f))
}
private fun tpText(size: Double, weight: Double, line: Double, color: Color, spacing: Double = 0.0, align: TextAlign = TextAlign.Center) =
    TextStyle(fontFamily = AccordionRoboto, fontWeight = FontWeight(weight.roundToInt().coerceIn(1, 1000)), fontSize = size.sp, lineHeight = line.sp,
        letterSpacing = spacing.sp, color = color, textAlign = align, lineHeightStyle = TPLineBox,
        platformStyle = androidx.compose.ui.text.PlatformTextStyle(includeFontPadding = false))

private data class TPNumber(val label: String, val angle: Double, val inner: Boolean, val value: Int, val active: Boolean)

/** md-time-picker. */
@Composable
internal fun NativeTimePicker(p: Props, onEvent: EventSink) {
    val emitLatest by rememberUpdatedState(onEvent)
    val rt = remember { AWCTimePickerRuntime() }
    val id = p.str("id")
    val disabled = p.bool("disabled")
    var value by awcState(p["value"]) { p.str("value") }
    var open by awcState(p["open"]) { p.bool("open") }
    val tokens = LocalAWCThemeTokens.current
    val direction = LocalLayoutDirection.current
    val appearance = LocalAWCTimePickerAppearance.current.merge(LocalAWCTimePickerAppearanceTargets.current[id] ?: AWCTimePickerAppearance())
    val reduced = rememberAWCAccessibilityAppearance().first
    val inherited = LocalAWCNativeDensity.current
    val scale = resolveAWCDensity(p["density"], inherited)
    val rung = (p["density"] as? Number)?.toDouble()?.takeIf { it in listOf(-1.0, -2.0, -3.0, -4.0) } ?: inherited
    val twelve = p.str("format", "12h") != "24h"
    val variant = if (p.str("variant") == "dial") "dial" else "input"
    val labels = AWCTimePickerLabels(p)
    val minuteStep = max(1.0, min(30.0, (p["minuteStep"] as? Number)?.toDouble() ?: p.str("minuteStep").toDoubleOrNull() ?: 1.0)).toInt()
    val owner = remember { AWCModalOwner("md-time-picker-" + java.util.UUID.randomUUID()) }
    val triggerFocus = remember { FocusRequester() }
    val inspector = LocalAWCTimePickerInspector.current
    val controller = LocalAWCTimePickerController.current
    DisposableEffect(controller, rt) { onDispose { if (controller?.runtime === rt) controller.runtime = null } }
    SideEffect { inspector?.invoke(rt); if (id.isNotEmpty()) AWCTimePickerRuntime.mounted[id] = java.lang.ref.WeakReference(rt) }
    fun emit(name: String, detail: AWCValue) = emitLatest(name, detail)
    fun roleHex(name: String) = tokens["--md-sys-color-$name"] ?: "#000000"
    fun hookHex(k: String, fallback: String) = appearance.color(k) ?: roleHex(fallback)
    fun hook(k: String, fallback: String) = awcColor(hookHex(k, fallback), Color.Black)
    fun hookOptional(k: String) = appearance.color(k)?.let { awcColor(it, Color.Transparent) }
    val dark = (tokens["--md-sys-color-surface"] ?: "#FFFBFE").uppercase() != "#FFFBFE"

    AWCModalImplicitScope(rt.isOpen) {
        val session = LocalAWCModalSession.current
        val vw = session?.viewportWidth ?: 0.0; val vh = session?.viewportHeight ?: 0.0
        val effectiveVariant = if (p.bool("responsive") && vh > 0 && vh < 460) "input" else variant
        val horizontalDialog = run {
            if (rt.mode != "dial") return@run false
            val orientation = p.str("orientation", "vertical")
            if (!p.bool("responsive") || vw <= 0 || vh <= 0) return@run orientation == "horizontal"
            if (orientation == "vertical" && vw >= 720 && vw > vh) return@run true
            if (orientation == "horizontal" && vw < 620) return@run false
            orientation == "horizontal"
        }
        val periodHorizontal = rt.mode != "input" && (horizontalDialog || p.str("periodLayout", "vertical") == "horizontal")
        val m = TPMetrics(appearance, scale, rung, twelve, horizontalDialog)

        // MARK: Behaviour (md-time-picker.tsx)
        fun validity(): Triple<Boolean, String, Map<String, Boolean>> {
            val current = AWCTimeMath.parse(rt.committedValue); val lo = AWCTimeMath.parse(p.str("min")); val hi = AWCTimeMath.parse(p.str("max"))
            fun msg(t: String) = t.replace("{min}", p.str("min")).replace("{max}", p.str("max"))
            if (p.bool("required") && current == null) return Triple(false, labels.valueMissing, mapOf("valueMissing" to true))
            if (current != null && lo != null && hi != null && lo > hi)
                return if (current < lo && current > hi) Triple(false, msg(labels.rangeOutside), mapOf("rangeUnderflow" to true, "rangeOverflow" to true)) else Triple(true, "", emptyMap())
            if (current != null && lo != null && current < lo) return Triple(false, msg(labels.rangeUnderflow), mapOf("rangeUnderflow" to true))
            if (current != null && hi != null && current > hi) return Triple(false, msg(labels.rangeOverflow), mapOf("rangeOverflow" to true))
            return Triple(true, "", emptyMap())
        }
        fun updateValidity() {
            val v = validity(); val key = "${v.first}|${v.second}"
            if (rt.lastValidityKey == key) return
            val primed = rt.lastValidityKey != null
            rt.lastValidityKey = key
            if (rt.revealed) rt.validationMessage = if (v.first) "" else v.second
            if (primed) emit("mdValidityChange", mapOf("valid" to v.first, "validationMessage" to v.second,
                "flags" to listOf("valueMissing", "rangeUnderflow", "rangeOverflow").associateWith { (v.third[it] ?: false) }))
        }
        fun emitInputIfChanged() {
            if (!rt.isOpen) return
            val key = rt.draftHours * 60 + rt.draftMinutes
            if (key == rt.lastInputEmitKey) return
            rt.lastInputEmitKey = key
            emit("mdInput", awcTimePickerDetail(rt.draftHours, rt.draftMinutes))
        }
        fun openPicker() {
            if (disabled || rt.isOpen) return
            rt.draftHours = rt.committedHours; rt.draftMinutes = rt.committedMinutes
            rt.lastInputEmitKey = rt.draftHours * 60 + rt.draftMinutes
            rt.selecting = "hour"; rt.mode = effectiveVariant
            // The responsive policy needs the modal viewport: decided again once the scope has measured it.
            rt.viewportPending = p.bool("responsive") && vh <= 0
            rt.syncInputsFromDraft(twelve)
            rt.lastHandMode = null; rt.hourAngle = 0.0; rt.minuteAngle = 0.0
            rt.tracks.clear(); rt.colorTarget.clear(); rt.colorOklab.clear(); rt.colorLegacy.clear(); rt.openedAt = null; rt.openPending = true; rt.modeAt = null; rt.modePending = true; rt.clock.version++
            rt.isOpen = true
            if (!open) open = true
            emit("mdOpen", null)
            rt.focusLater("input-hour")
        }
        fun closePicker() {
            if (!rt.isOpen) return
            rt.isOpen = false; rt.focused = null; rt.hovered = null
            if (open) open = false
            emit("mdClose", null)
            // The source restores the opener when it is outside the picker, else focuses the trigger (the session restores a
            // captured opener when the owner is released).
            // The source restores the opener when it is outside the picker, else focuses the trigger. Opened from the trigger
            // (or with nothing to restore) the picker focuses its trigger itself, a few frames later: once the session's
            // release has run and the field has laid out its new value (focusing a text field in the frame its value grows
            // trips Compose's bring-into-view on the previous layout).
            if (!disabled && (rt.openedFromTrigger || owner.opener == null)) {
                // In the closing frame, before the field takes the new value (Compose's bring-into-view captures the value and
                // layout at focus); the session then restores this same child (saved) instead of blurring to the body.
                runCatching { triggerFocus.requestFocus() }
                owner.opener = triggerFocus.takeIf { runCatching { it.saveFocusedChild() }.getOrDefault(false) }
                if (owner.opener == null) rt.focusLater("trigger", 4)
            }
        }
        fun cancel() {
            if (!rt.isOpen) return
            rt.draftHours = rt.committedHours; rt.draftMinutes = rt.committedMinutes
            emit("mdCancel", null)
            closePicker()
        }
        fun applyInputs(scope: String): Boolean {
            val h = AWCTimeMath.parseInt(rt.hourBuffer); val mm = AWCTimeMath.parseInt(rt.minuteBuffer)
            val range = if (twelve) 1..12 else 0..23
            val hValid = h != null && h in range; val mValid = mm != null && mm in 0..59
            if (scope != "minute") rt.hourError = !hValid
            if (scope != "hour") rt.minuteError = !mValid
            if (!hValid || !mValid) return false
            rt.draftMinutes = mm!!
            rt.draftHours = AWCTimeMath.hour24(h!!, rt.period == "PM", twelve)
            emitInputIfChanged()
            return true
        }
        fun confirm() {
            if (disabled) return
            applyInputs("both")
            if (rt.hourError || rt.minuteError) return
            rt.committedHours = rt.draftHours; rt.committedMinutes = rt.draftMinutes
            val v = AWCTimeMath.iso(rt.draftHours, rt.draftMinutes)
            rt.committedValue = v; rt.seenValue = v
            if (value != v) value = v
            updateValidity()
            emit("mdChange", awcTimePickerDetail(rt.draftHours, rt.draftMinutes))
            closePicker()
        }
        fun load() {
            if (rt.loaded) return
            rt.loaded = true
            var v = value
            if (!rt.parseValueInto(v)) { rt.parseValueInto(""); if (v.isNotEmpty()) { v = ""; value = "" } }
            else if (v.isNotEmpty() && AWCTimeMath.iso(rt.draftHours, rt.draftMinutes) != v) { v = AWCTimeMath.iso(rt.draftHours, rt.draftMinutes); value = v }
            rt.committedHours = rt.draftHours; rt.committedMinutes = rt.draftMinutes
            rt.committedValue = if (AWCTimeMath.parse(v) == null) "" else AWCTimeMath.iso(rt.draftHours, rt.draftMinutes)
            rt.defaultValue = rt.committedValue; rt.seenValue = v
            rt.mode = effectiveVariant
            updateValidity()
            if (open && !disabled) openPicker() else if (open) open = false
        }
        fun valueChanged(v: String) {
            val normalized = when { v.isEmpty() -> { rt.parseValueInto(""); "" }
                rt.parseValueInto(v) -> AWCTimeMath.iso(rt.draftHours, rt.draftMinutes)
                else -> { rt.parseValueInto(""); "" } }
            if (normalized != v) { value = normalized; return }
            rt.committedHours = rt.draftHours; rt.committedMinutes = rt.draftMinutes; rt.committedValue = v
            if (rt.isOpen) { rt.syncInputsFromDraft(twelve); rt.lastInputEmitKey = rt.draftHours * 60 + rt.draftMinutes }
            else { rt.hourBuffer = rt.displayHour(twelve).toString(); rt.minuteBuffer = AWCTimeMath.two(rt.draftMinutes) }
            updateValidity()
        }
        fun togglePeriod(target: String) {
            if (!twelve || rt.period == target) return
            if (target == "AM" && rt.draftHours >= 12) rt.draftHours -= 12 else if (target == "PM" && rt.draftHours < 12) rt.draftHours += 12
            emitInputIfChanged()
            rt.syncInputsFromDraft(twelve)
        }
        fun toggleMode() {
            val previous = rt.mode
            rt.mode = if (rt.mode == "dial") "input" else "dial"
            emit("mdModeChange", mapOf("mode" to rt.mode, "previousMode" to previous))
            rt.selecting = "hour"
            rt.syncInputsFromDraft(twelve)
            rt.modeAt = null; rt.modePending = true; rt.clock.version++
            rt.focusLater("input-hour")
        }
        fun edited(fid: String, v: TextFieldValue) {
            val digits = v.text.filter { it in '0'..'9' }.take(2)
            val old = if (fid == "input-hour") rt.hourBuffer else rt.minuteBuffer
            rt.fields[fid] = if (digits == v.text) v else TextFieldValue(digits, TextRange(digits.length))
            if (digits == old && digits == v.text) return
            if (fid == "input-hour") { rt.hourBuffer = digits; applyInputs("hour") } else { rt.minuteBuffer = digits; applyInputs("minute") }
        }
        fun blurred(fid: String) {
            applyInputs("both")
            if (fid == "input-hour") {
                if (!rt.hourError && AWCTimeMath.parseInt(rt.hourBuffer) == rt.displayHour(twelve)) { rt.hourBuffer = rt.displayHour(twelve).toString(); rt.setField(fid, rt.hourBuffer) }
            } else if (!rt.minuteError && AWCTimeMath.parseInt(rt.minuteBuffer) == rt.draftMinutes) { rt.minuteBuffer = AWCTimeMath.two(rt.draftMinutes); rt.setField(fid, rt.minuteBuffer) }
        }
        /** ArrowUp / ArrowDown in a tile (bumpFocusedInput): hours wrap (12h 1…12 keeping the period), minutes step by `minute-step`. */
        fun bump(dir: Int, fid: String) {
            if (fid == "input-hour") {
                val base = if (rt.hourError) rt.displayHour(twelve) else AWCTimeMath.parseInt(rt.hourBuffer) ?: rt.displayHour(twelve)
                if (!twelve) rt.draftHours = ((base + dir) % 24 + 24) % 24
                else { var next = base + dir; if (next > 12) next = 1 else if (next < 1) next = 12; rt.draftHours = AWCTimeMath.hour24(next, rt.period == "PM", true) }
                rt.hourError = false; rt.hourBuffer = rt.displayHour(twelve).toString(); rt.setField(fid, rt.hourBuffer, true)
            } else {
                val base = if (rt.minuteError) rt.draftMinutes else AWCTimeMath.parseInt(rt.minuteBuffer) ?: rt.draftMinutes
                val snapped = AWCTimeMath.jsRound(base.toDouble() / minuteStep).toInt() * minuteStep
                rt.draftMinutes = ((snapped + dir * minuteStep) % 60 + 60) % 60
                rt.minuteError = false; rt.minuteBuffer = AWCTimeMath.two(rt.draftMinutes); rt.setField(fid, rt.minuteBuffer, true)
            }
            emitInputIfChanged()
        }
        fun tileKey(fid: String, e: KeyEvent): Boolean {
            if (e.type != KeyEventType.KeyDown) return false
            return when (e.key) {
                Key.Enter, Key.NumPadEnter -> { confirm(); true }
                Key.DirectionUp -> { bump(1, fid); true }
                Key.DirectionDown -> { bump(-1, fid); true }
                Key.Escape -> { cancel(); true }
                else -> false
            }
        }
        /** Dial pointer (applyDialPointer), in dp from the dial's top-left corner. */
        fun dialPointer(x: Double, y: Double, size: Double) {
            val dx = x - size / 2; val dy = y - size / 2
            val angle = ((atan2(dy, dx) * 180 / Math.PI) + 90 + 360) % 360
            val distance = sqrt(dx * dx + dy * dy); val radius = size / 2
            if (rt.selecting == "hour") {
                val idx = AWCTimeMath.jsRound(angle / 30).toInt() % 12
                rt.draftHours = when {
                    twelve -> AWCTimeMath.hour24(if (idx == 0) 12 else idx, rt.period == "PM", true)
                    distance < radius * .66 -> if (idx == 0) 0 else 12 + idx
                    else -> if (idx == 0) 12 else idx
                }
            } else {
                val raw = AWCTimeMath.jsRound(angle / 6).toInt()
                rt.draftMinutes = (AWCTimeMath.jsRound(raw.toDouble() / minuteStep).toInt() * minuteStep) % 60
            }
            emitInputIfChanged()
            rt.syncInputsFromDraft(twelve)
        }
        fun dialReleased() {
            if (!rt.dragging) return
            rt.dragging = false
            if (rt.selecting == "hour") { rt.selecting = "minute"; rt.focusLater("input-minute") }
        }
        fun periodKey(key: Key): Boolean {
            if (!twelve) return false
            val next = when (key) {
                Key.MoveHome -> "AM"; Key.MoveEnd -> "PM"; Key.Spacebar -> rt.period
                Key.DirectionLeft, Key.DirectionRight, Key.DirectionUp, Key.DirectionDown -> if (rt.period == "AM") "PM" else "AM"
                else -> return false
            }
            togglePeriod(next)
            rt.focusLater(if (next == "AM") "period-am" else "period-pm")
            return true
        }

        // Lifecycle: load once, follow `value` / `open` / `disabled` / constraint changes.
        SideEffect {
            load()
            rt.show = { openPicker() }; rt.hide = { cancel() }; rt.validityRecord = { validity() }
            controller?.runtime = rt
            owner.escape = { if (rt.isOpen) { cancel(); true } else false }
        }
        val currentValue = value
        SideEffect { if (rt.loaded && currentValue != rt.seenValue) { rt.seenValue = currentValue; if (currentValue != rt.committedValue || AWCTimeMath.parse(currentValue) == null) valueChanged(currentValue) } }
        val openNow = open
        SideEffect { if (rt.loaded) { if (openNow && !rt.isOpen) openPicker() else if (!openNow && rt.isOpen) closePicker() } }
        SideEffect { rt.disabledNow = disabled; if (disabled) { rt.revealed = false; rt.validationMessage = "" }; if (disabled && rt.isOpen) cancel() }
        SideEffect { if (rt.viewportPending && vh > 0) { rt.viewportPending = false; if (rt.isOpen && rt.mode != effectiveVariant) rt.mode = effectiveVariant } }
        SideEffect { if (!rt.isOpen && rt.loaded && rt.mode != variant) rt.mode = variant }
        SideEffect { if (rt.loaded) updateValidity() }

        // Focus requests one frame later (after the parts attach): tiles are selected, the trigger focuses its field.
        LaunchedEffect(rt.focusSerial) {
            val target = rt.pendingFocus ?: return@LaunchedEffect
            var frames = 0
            do { withFrameNanos { }; frames++ } while (frames < rt.pendingFrames)
            rt.pendingFocus = null
            if (target == "trigger") { runCatching { triggerFocus.requestFocus() }; return@LaunchedEffect }
            if (!rt.isOpen) return@LaunchedEffect
            session?.captureOpener(owner)
            if (target.startsWith("input-")) rt.fields[target]?.let { rt.fields[target] = it.copy(selection = TextRange(0, it.text.length)) }
            runCatching { rt.requester(target).requestFocus() }
        }
        // Motion clock: keyframe starts and transition starts at the frame after the change.
        AWCModalTicker(rt.clock, { now ->
            rt.openPending || rt.modePending || rt.tracks.values.any { it.isRunning(now) } ||
                (rt.openedAt?.let { now < it + max(m.enter, 150.0) + 34 } ?: false) || (rt.modeAt?.let { now < it + m.modeSwap + 34 } ?: false)
        }) { ms ->
            if (rt.openPending) { rt.openedAt = ms; rt.openPending = false }
            if (rt.modePending) { rt.modeAt = ms; rt.modePending = false }
            for (t in rt.tracks.values) t.pending?.let { target ->
                // An input-handler change reaches this clock two frames after the input (event → recomposition → frame):
                // its transition is dated back to the input's frame.
                val start = if (t.immediate) ms - 2000.0 / 60 else ms
                t.channels.forEachIndexed { i, c -> c.set(target[i], start, t.duration, TPStandard) }; t.pending = null; t.immediate = false }
        }

        // MARK: Trigger
        val showError = p.bool("error") || rt.validationMessage.isNotEmpty()
        val errorText = p.str("errorText").ifEmpty { rt.validationMessage }
        val display = if (rt.committedValue.isEmpty()) "" else if (!twelve) AWCTimeMath.iso(rt.committedHours, rt.committedMinutes)
            else "${AWCTimeMath.displayHour(rt.committedHours, true)}:${AWCTimeMath.two(rt.committedMinutes)} ${if (rt.committedHours >= 12) labels.pm else labels.am}"
        val inspection = LocalAWCInspection.current
        if (p.bool("hideTrigger")) Box(Modifier.size(0.dp).semantics { hideFromAccessibility() })
        else {
            val fieldProps: Map<String, AWCValue> = mapOf("variant" to "outlined", "readOnly" to true, "label" to labels.label, "value" to display,
                "supportingText" to if (showError && errorText.isNotEmpty()) "" else p.str("supportingText"), "error" to showError, "errorText" to errorText,
                "reserveSupportingSpace" to p.bool("reserveSupportingSpace"), "disabled" to disabled, "required" to p.bool("required"), "appearFocused" to rt.isOpen,
                "aria-label" to if (display.isEmpty()) labels.label else "${labels.label}, $display")
            val a = appearance
            Box(Modifier.width(m.triggerWidth.dp)
                .focusRequester(triggerFocus).focusGroup()
                .onFocusChanged { f -> if (f.hasFocus) rt.focused = "trigger" else if (rt.focused == "trigger") rt.focused = null }
                // Click and Enter / Space (keydown on the input) open the dialog; the field still takes the press (focus).
                .pointerInput(disabled) {
                    awaitPointerEventScope {
                        while (true) {
                            val e = awaitPointerEvent(PointerEventPass.Initial)
                            if (e.type == PointerEventType.Release && !disabled) {
                                val c = e.changes.firstOrNull() ?: continue
                                if (c.position.x >= 0 && c.position.y >= 0 && c.position.x <= size.width && c.position.y <= size.height) openPicker()
                            }
                        }
                    }
                }
                .onPreviewKeyEvent { e -> if (e.type == KeyEventType.KeyDown && !disabled && (e.key == Key.Enter || e.key == Key.NumPadEnter || e.key == Key.Spacebar)) { openPicker(); true } else false }
                ) {
                // The field's own parts report as the picker's trigger parts (the source's ::part(trigger)).
                CompositionLocalProvider(LocalAWCInspection provides inspection?.let { it.copy(id = it.id + ".trigger", entered = false, parentId = it.id) }) {
                    AWCTextFieldAppearanceScope(AWCTextFieldAppearance(activeIndicatorColor = a.color("trigger-focus-color"), containerShape = a.number("trigger-shape"),
                        iconColor = a.color("trigger-icon-color"), inputColor = a.color("trigger-color"), labelColor = a.color("trigger-icon-color"),
                        outlineColor = a.color("trigger-outline-color"))) {
                        AWCComponent("md-text-field", fieldProps, Modifier.fillMaxWidth()) { slot -> if (slot == "leading-icon") AWCMaterialSymbol("schedule") }
                    }
                }
            }
        }

        // MARK: Dialog
        if (rt.isOpen && session != null) {
            DisposableEffect(session, owner) { rt.openedFromTrigger = rt.focused == "trigger"; session.acquire(owner); onDispose { session.release(owner.id) } }
            val context = currentCompositionLocalContext
            AWCModalEntryEffect(session, owner.id, true, 1000.0) {
                CompositionLocalProvider(context) {
                    CompositionLocalProvider(LocalAWCNativeDensity provides scale, LocalAWCSlots provides null) {
                        TPDialogLayer(rt, owner, session, m, appearance, labels, reduced, twelve, disabled, horizontalDialog, periodHorizontal, dark, vw, minuteStep,
                            ::hook, ::hookHex, ::hookOptional, ::roleHex, ::cancel, ::confirm, ::toggleMode, ::togglePeriod, ::tileKey, ::edited, ::blurred,
                            ::dialPointer, ::dialReleased, ::periodKey)
                    }
                }
            }
        }
    }
}

/** The scrim (150ms fade) and the dialog's enter keyframes (opacity, translateY 12 → 0, scale 0.88 → 1 from the top centre). */
@Composable
private fun TPDialogLayer(rt: AWCTimePickerRuntime, owner: AWCModalOwner, session: AWCModalSession, m: TPMetrics, appearance: AWCTimePickerAppearance,
                          labels: AWCTimePickerLabels, reduced: Boolean, twelve: Boolean, disabled: Boolean, horizontalDialog: Boolean, periodHorizontal: Boolean,
                          dark: Boolean, vw: Double, minuteStep: Int,
                          hook: (String, String) -> Color, hookHex: (String, String) -> String, hookOptional: (String) -> Color?, roleHex: (String) -> String,
                          cancel: () -> Unit, confirm: () -> Unit, toggleMode: () -> Unit, togglePeriod: (String) -> Unit, tileKey: (String, KeyEvent) -> Boolean,
                          edited: (String, TextFieldValue) -> Unit, blurred: (String) -> Unit, dialPointer: (Double, Double, Double) -> Unit,
                          dialReleased: () -> Unit, periodKey: (Key) -> Boolean) {
    val inspection = LocalAWCInspection.current
    val now = rt.clock.frameMillis
    val start = rt.openedAt
    val s = if (reduced) 1.0 else if (start == null) 0.0 else tpProgress(now - start, 150.0, TPStandard)
    val pr = if (reduced) 1.0 else if (start == null) 0.0 else tpProgress(now - start, m.enter, m.easing)
    rt.record("scrim", listOf(s)); rt.record("dialog", listOf(pr, .88 + .12 * pr, 12 * (1 - pr)))
    val scrim = appearance.color("scrim-color")?.let { awcColor(it, Color.Transparent) } ?: if (dark) Color(0f, 0f, 0f, .6f) else Color(0f, 0f, 0f, .32f)
    Box(Modifier.fillMaxSize()) {
        Box(Modifier.fillMaxSize().drawBehind { drawRect(scrim.copy(alpha = scrim.alpha * s.toFloat())) }
            .pointerInput(Unit) {
                awaitPointerEventScope {
                    while (true) {
                        val e = awaitPointerEvent(PointerEventPass.Main)
                        e.changes.forEach { it.consume() }
                        if (e.type == PointerEventType.Release) cancel()
                    }
                }
            }
            .inspectAWCNode(inspection, "scrim", "scrim"))
        Box(Modifier.fillMaxSize().padding(m.insetXl.dp), contentAlignment = Alignment.Center) {
            Box(Modifier.graphicsLayer {
                alpha = pr.toFloat(); val k = (.88 + .12 * pr).toFloat(); scaleX = k; scaleY = k
                transformOrigin = TransformOrigin(.5f, 0f); translationY = (12 * (1 - pr) * density).toFloat()
            }) {
                TPDialog(rt, owner, session, m, appearance, labels, reduced, twelve, disabled, horizontalDialog, periodHorizontal, vw, minuteStep,
                    hook, hookHex, hookOptional, roleHex, cancel, confirm, toggleMode, togglePeriod, tileKey, edited, blurred, dialPointer, dialReleased, periodKey)
            }
        }
    }
}

@Composable
private fun TPDialog(rt: AWCTimePickerRuntime, owner: AWCModalOwner, session: AWCModalSession, m: TPMetrics, appearance: AWCTimePickerAppearance,
                     labels: AWCTimePickerLabels, reduced: Boolean, twelve: Boolean, disabled: Boolean, horizontalDialog: Boolean, periodHorizontal: Boolean,
                     vw: Double, minuteStep: Int,
                     hook: (String, String) -> Color, hookHex: (String, String) -> String, hookOptional: (String) -> Color?, roleHex: (String) -> String,
                     cancel: () -> Unit, confirm: () -> Unit, toggleMode: () -> Unit, togglePeriod: (String) -> Unit, tileKey: (String, KeyEvent) -> Boolean,
                     edited: (String, TextFieldValue) -> Unit, blurred: (String) -> Unit, dialPointer: (Double, Double, Double) -> Unit,
                     dialReleased: () -> Unit, periodKey: (Key) -> Boolean) {
    val inspection = LocalAWCInspection.current
    val tokens = LocalAWCThemeTokens.current
    val isInput = rt.mode == "input"
    val headline = labels.headline.ifEmpty { if (isInput) labels.headlineInput else labels.headlineDial }
    val shadows = appearance.raw("dialog-elevation")?.let { NativeShadowLayer.parse(it) } ?: NativeShadowLayer.parse(tokens["--md-sys-elevation-3"] ?: "none")
    val corners = AWCCornerShape.uniform(m.dialogShape)
    val width = min(m.dialogWidth, max(0.0, vw - 48))
    val container = remember { FocusRequester() }
    var containerWanted by remember { mutableStateOf(false) }
    var containerFocused by remember { mutableStateOf(false) }
    SideEffect {
        owner.focusContainer = { containerWanted = true; runCatching { container.requestFocus() }.getOrDefault(false) }
        owner.containerHasFocus = { containerFocused }
    }
    val status = if (rt.selecting == "hour") labels.hour else labels.minute
    val ink = hook("dialog-on-color", "on-surface")

    // A time part's focus (source focus / blur handlers).
    fun Modifier.part(id: String, tile: Boolean): Modifier = this.focusRequester(rt.requester(id)).onFocusChanged { f ->
        if (f.isFocused) {
            rt.focused = id; rt.focusVisible = !session.lastInputPointer
            if (tile) {
                rt.selecting = if (id == "input-hour") "hour" else "minute"
                // Keyboard focus into a text input selects its text (Chrome; a pointer press places the caret).
                if (!session.lastInputPointer) rt.fields[id]?.let { rt.fields[id] = it.copy(selection = TextRange(0, it.text.length)) }
            }
        } else if (rt.focused == id) { rt.focused = null; if (tile) blurred(id) }
    }
    fun Modifier.hover(id: String): Modifier = this.pointerInput(id) {
        awaitPointerEventScope { while (true) { val e = awaitPointerEvent(PointerEventPass.Main)
            when (e.type) { PointerEventType.Enter, PointerEventType.Move -> rt.hovered = id; PointerEventType.Exit -> if (rt.hovered == id) rt.hovered = null } } }
    }

    @Composable fun ModeIn(key: String, content: @Composable () -> Unit) {
        val t0 = rt.modeAt
        val pm = if (reduced) 1.0 else if (t0 == null) 0.0 else tpProgress(rt.clock.frameMillis - t0, m.modeSwap, m.easing)
        rt.record(key, listOf(pm, .96 + .04 * pm, 8 * (1 - pm)))
        Box(Modifier.graphicsLayer { alpha = pm.toFloat(); val k = (.96 + .04 * pm).toFloat(); scaleX = k; scaleY = k
            transformOrigin = TransformOrigin(.5f, 0f); translationY = (8 * (1 - pm) * density).toFloat() }) { content() }
    }
    @Composable fun Colors(key: String, targets: List<String>, content: @Composable (List<Color>) -> Unit) {
        // A "mix:" target is a color-mix() result (non-legacy colour); each colour transitions on its own.
        val specs = targets.map { if (it.startsWith("mix:")) it.removePrefix("mix:") to false else it to true }
        val target = specs.flatMap { tpPremultiplied(it.first) }
        specs.forEachIndexed { i, sp -> rt.retargetColor("$key#$i", tpPremultiplied(sp.first), sp.second, if (reduced) 0.0 else 150.0) }
        val v = specs.indices.flatMap { rt.presentedColor("$key#$it", rt.clock.frameMillis) }.takeIf { it.size == target.size } ?: target
        rt.record(key, v)
        content((0 until v.size / 4).map { tpColor(v, it * 4) })
    }
    @Composable fun Tile(id: String, active: Boolean, invalid: Boolean, label: String) {
        val focusedHere = rt.focused == id; val hovered = rt.hovered == id
        val bg = if (active) hook("input-active-bg", "primary-container") else hook("input-bg", "surface-container-highest")
        val inkHex = if (invalid) hookHex("input-error-color", "error") else if (active) hookHex("input-active-color", "on-primary-container") else hookHex("input-color", "on-surface")
        val hoverInk = if (active) hook("input-active-color", "on-primary-container") else hook("input-color", "on-surface")
        val opacity = ((appearance.number("input-hover-opacity") ?: 8.0) / 100).toFloat()
        val border: Color = if (invalid) hook("input-error-color", "error") else if (focusedHere) hook("input-active-outline-color", "primary") else if (active) Color.Transparent
            else hookOptional("input-outline-color") ?: Color.Transparent
        val shape = RoundedCornerShape(m.inputShape.dp)
        val ink = awcColor(inkHex, Color.Black)
        val field = rt.fields[id] ?: TextFieldValue(if (id == "input-hour") rt.hourBuffer else rt.minuteBuffer)
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(m.hintGap.dp)) {
            Box(Modifier.size(m.inputWidth.dp, m.inputHeight.dp)
                .inspectAWCNode(inspection, id, id)
                .background(bg, shape)
                .then(if (hovered && !focusedHere) Modifier.background(hoverInk.copy(alpha = opacity), shape) else Modifier)
                .border(m.inputBorder.dp, border, shape)
                .hover(id), contentAlignment = Alignment.Center) {
                BasicTextField(field, { v -> edited(id, v) },
                    Modifier.fillMaxWidth().padding(horizontal = 16.dp).height((m.inputFont * TPMetrics.NATURAL_LINE).dp)
                        .part(id, true)
                        .onPreviewKeyEvent { e -> tileKey(id, e) }
                        .semantics { contentDescription = label; if (invalid) error(label) else stateDescription = field.text },
                    enabled = !disabled, singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    textStyle = tpText(m.inputFont, m.inputWeight, m.inputFont * TPMetrics.NATURAL_LINE, ink),
                    cursorBrush = SolidColor(ink))
            }
            Text(label, maxLines = 1, softWrap = false, modifier = Modifier.height((12 * TPMetrics.NATURAL_LINE).dp).clearAndSetSemantics { },
                style = tpText(12.0, 400.0, 12 * TPMetrics.NATURAL_LINE, if (invalid) hook("input-error-color", "error") else hook("input-hint-color", "on-surface-variant"), .4))
        }
    }
    @Composable fun PeriodButton(per: String, horizontal: Boolean, corners: List<Double>, modifier: Modifier) {
        val active = rt.period == per; val pid = if (per == "AM") "period-am" else "period-pm"
        val restHex = if (active) hookHex("period-active-bg", "tertiary-container") else appearance.color("period-bg") ?: "#00000000"
        val inkHex = if (active) hookHex("period-active-color", "on-tertiary-container") else hookHex("period-color", "on-surface")
        val opacity = (appearance.number("period-hover-opacity") ?: 8.0) / 100
        // :hover — background: color-mix(in srgb, <ink> 8%, transparent | <active bg>) (a non-legacy colour: Oklab transitions).
        val bgSpec = if (rt.hovered == pid) "mix:" + tpMix(inkHex, opacity, if (active) restHex else "#00000000") else restHex
        val shape = RoundedCornerShape(corners[0].dp, corners[1].dp, corners[2].dp, corners[3].dp)
        val ring = awcColor(roleHex("secondary"), Color.Black)
        Colors(pid, listOf(bgSpec, inkHex)) { colors ->
            Box(modifier
                .drawWithContent {
                    drawContent()
                    if (rt.focused == pid && rt.focusVisible) {
                        val e = 3.5.dp.toPx(); val w = 3.dp.toPx()
                        val o = shape.createOutline(Size(size.width + 2 * e, size.height + 2 * e), layoutDirection, this)
                        translate(-e, -e) { drawPath(Path().apply { addOutline(o) }, ring, style = Stroke(w)) }
                    }
                }
                .clip(shape).background(colors[0])
                .part(pid, false)
                .focusProperties { canFocus = active }
                .focusable()
                .onKeyEvent { e -> e.type == KeyEventType.KeyDown && periodKey(e.key) }
                .pointerInput(per) { awaitEachGesture { awaitFirstDown(); val up = waitForUpOrCancellation(); if (up != null) { togglePeriod(per); rt.focusLater(pid) } } }
                .hover(pid)
                .semantics { role = Role.RadioButton; selected = active; contentDescription = if (per == "AM") labels.am else labels.pm },
                contentAlignment = Alignment.Center) {
                Text(if (per == "AM") labels.am else labels.pm, maxLines = 1, softWrap = false,
                    style = tpText(m.periodFont, m.periodWeight, m.periodFont * TPMetrics.NATURAL_LINE, colors[1], .1))
            }
        }
    }
    @Composable fun PeriodGroup(horizontal: Boolean, inInput: Boolean, width: Double? = null) {
        val outline = hook("period-outline-color", "outline"); val w = m.periodOutline
        val r = m.periodShape; val inner = max(0.0, r - w)
        val groupWidth = if (horizontal) m.periodHWidth else width ?: m.periodVWidth
        val groupHeight = if (horizontal) m.periodHHeight else if (inInput || rt.mode != "dial") m.periodVHeightInput else m.periodVHeight
        // Inside the outline the AM button carries the divider as its trailing / bottom border.
        val crossInner = (if (horizontal) groupHeight else groupWidth) - 2 * w
        val mainInner = (if (horizontal) groupWidth else groupHeight) - 2 * w
        val pmSize = max(0.0, (mainInner - w) / 2); val amSize = mainInner - pmSize
        Box(Modifier.size(groupWidth.dp, groupHeight.dp)
            .inspectAWCNode(inspection, "period-toggle", "period-toggle")
            .border(w.dp, outline, RoundedCornerShape(r.dp))
            .padding(w.dp)
            .semantics { contentDescription = labels.period; selectableGroup() }) {
            @Composable fun Am() {
                Box(Modifier.then(if (horizontal) Modifier.size(amSize.dp, crossInner.dp) else Modifier.size(crossInner.dp, amSize.dp)).inspectAWCNode(inspection, "period-am", "period-am")) {
                    PeriodButton("AM", horizontal, if (horizontal) listOf(inner, 0.0, 0.0, inner) else listOf(inner, inner, 0.0, 0.0),
                        if (horizontal) Modifier.size(pmSize.dp, crossInner.dp) else Modifier.size(crossInner.dp, pmSize.dp))
                    Box(Modifier.align(if (horizontal) Alignment.CenterEnd else Alignment.BottomCenter)
                        .then(if (horizontal) Modifier.size(w.dp, crossInner.dp) else Modifier.size(crossInner.dp, w.dp)).background(outline))
                }
            }
            @Composable fun Pm() {
                Box(Modifier.then(if (horizontal) Modifier.size(pmSize.dp, crossInner.dp) else Modifier.size(crossInner.dp, pmSize.dp)).inspectAWCNode(inspection, "period-pm", "period-pm")) {
                    PeriodButton("PM", horizontal, if (horizontal) listOf(0.0, inner, inner, 0.0) else listOf(0.0, 0.0, inner, inner), Modifier.fillMaxSize())
                }
            }
            if (horizontal) Row { Am(); Pm() } else Column { Am(); Pm() }
        }
    }
    @Composable fun InputArea(inlinePeriod: Boolean, dial: Boolean, fill: Boolean) {
        val inlineGroup = twelve && inlinePeriod
        // A flex row: on a narrow dialog the separator and the period pill shrink in proportion to their inner widths.
        val available = if (horizontalDialog) Double.POSITIVE_INFINITY else width - 2 * m.padding
        val periodInner = if (inlineGroup) m.periodVWidth - 2 * m.periodOutline else 0.0
        val needed = 2 * m.inputWidth + m.separator + if (inlineGroup) m.insetMd + m.periodVWidth else 0.0
        val overflow = max(0.0, needed - available); val shrinkBase = m.separator + periodInner
        val separatorWidth = if (shrinkBase > 0) max(0.0, m.separator - overflow * m.separator / shrinkBase) else m.separator
        val periodWidth = if (shrinkBase > 0) max(0.0, m.periodVWidth - overflow * periodInner / shrinkBase) else m.periodVWidth
        Box(Modifier.padding(bottom = if (dial && horizontalDialog) 0.dp else m.insetXl.dp).then(if (fill) Modifier.fillMaxWidth() else Modifier)
            .inspectAWCNode(inspection, "input-area", "input-area")) {
            ModeIn("mode-input") {
                Row(Modifier.then(if (fill) Modifier.fillMaxWidth() else Modifier), horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.Top) {
                    Tile("input-hour", rt.selecting == "hour", rt.hourError, labels.hour)
                    Box(Modifier.size(separatorWidth.dp, m.inputHeight.dp).clearAndSetSemantics { }, contentAlignment = Alignment.Center) {
                        Text(":", maxLines = 1, softWrap = false, style = tpText(m.inputFont, m.inputWeight, m.inputFont * TPMetrics.NATURAL_LINE,
                            hookOptional("input-separator-color") ?: hook("dialog-on-color", "on-surface")))
                    }
                    Tile("input-minute", rt.selecting == "minute", rt.minuteError, labels.minute)
                    if (inlineGroup) Box(Modifier.padding(start = m.insetMd.dp)) { PeriodGroup(false, true, periodWidth) }
                }
            }
        }
    }
    @Composable fun Dial() {
        val isHour = rt.selecting == "hour"
        val raw: Pair<Double, Double> = when {
            !isHour -> rt.draftMinutes * 6.0 to .8
            twelve -> { val d = rt.displayHour(true); (if (d == 12) 0.0 else d * 30.0) to .8 }
            rt.draftHours == 0 -> 0.0 to .52
            rt.draftHours <= 12 -> (if (rt.draftHours == 12) 0.0 else rt.draftHours * 30.0) to .8
            else -> (rt.draftHours - 12) * 30.0 to .52
        }
        val angle = rt.advanceHand(if (isHour) "hour" else "minute", raw.first)
        val ratio = appearance.number("hand-length")?.let { it / 100 } ?: raw.second
        val dialSize = m.dial; val radius = dialSize / 2
        rt.handTarget = angle; rt.handLength = ratio
        // The source writes the hand's rotation in the pointer handler: its transition starts with the frame being rendered.
        rt.retarget("hand", listOf(angle), if (reduced) 0.0 else 200.0, immediate = true)
        val a = rt.presented("hand", rt.clock.frameMillis).firstOrNull() ?: angle
        rt.handAngle = a; rt.record("hand", listOf(a))
        val handInk = hook("dial-hand-color", "primary"); val face = hook("dial-bg", "surface-container-highest")
        val length = radius * ratio
        // Numbers: 12 (or 24) labelled targets on the 0.8 (and 0.52) rings.
        val numbers = if (!isHour) (0 until 12).map { i -> val v = i * 5; TPNumber(AWCTimeMath.two(v), v * 6.0, false, 100 + v, rt.draftMinutes == v) }
            else {
                val shown = if (twelve) rt.displayHour(true) else rt.draftHours
                (0 until 12).map { i -> val v = if (i == 0) 12 else i; TPNumber(v.toString(), i * 30.0, false, v, shown == v) } +
                    if (!twelve) (0 until 12).map { i -> val v = if (i == 0) 0 else 12 + i; TPNumber(if (i == 0) "00" else v.toString(), i * 30.0, true, v, rt.draftHours == v) } else emptyList()
            }
        rt.activeNumber = numbers.firstOrNull { it.active }?.label
        CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
            Box(Modifier.size(dialSize.dp)
                .graphicsLayer { alpha = if (disabled) .38f else 1f }
                .pointerInput(disabled) {
                    if (disabled) return@pointerInput
                    awaitEachGesture {
                        val down = awaitFirstDown()
                        rt.dragging = true; dialPointer(down.position.x / density.toDouble(), down.position.y / density.toDouble(), dialSize)
                        while (true) {
                            val e = awaitPointerEvent()
                            val c = e.changes.firstOrNull { it.id == down.id } ?: break
                            if (!c.pressed) break
                            dialPointer(c.position.x / density.toDouble(), c.position.y / density.toDouble(), dialSize)
                        }
                        dialReleased()
                    }
                }
                .clearAndSetSemantics { }
                .inspectAWCNode(inspection, "dial", "dial")) {
                Box(Modifier.fillMaxSize().background(face, CircleShape))
                // The hand: a bar from the centre to the selected number and the target-sized tip disc, rotated about the centre.
                Box(Modifier.absoluteOffset((radius - m.target / 2).dp, 0.dp).size(m.target.dp, radius.dp)
                    .graphicsLayer { rotationZ = a.toFloat(); transformOrigin = TransformOrigin(.5f, 1f) }
                    .drawBehind {
                        val cx = size.width / 2; val bottom = size.height; val len = (length * density).toFloat(); val hw = (m.handWidth * density).toFloat()
                        drawRect(handInk, Offset(cx - hw / 2, bottom - len), Size(hw, len))
                        drawCircle(handInk, (m.target * density / 2).toFloat(), Offset(cx, bottom - len))
                    }
                    .inspectAWCNode(inspection, "dial-hand", "dial-hand"))
                Box(Modifier.absoluteOffset((radius - m.center / 2).dp, (radius - m.center / 2).dp).size(m.center.dp).background(handInk, CircleShape))
                for (n in numbers) key(n.value) {
                    val r = radius * if (n.inner) .52 else .8
                    val rad = (n.angle - 90) * Math.PI / 180
                    val x = radius + cos(rad) * r; val y = radius + sin(rad) * r
                    val inkHex = if (n.active) hookHex("dial-number-active-color", "on-primary") else hookHex("dial-number-color", "on-surface")
                    Colors("number-${n.value}", listOf(inkHex)) { colors ->
                        Box(Modifier.absoluteOffset((x - m.target / 2).dp, (y - m.target / 2).dp).size(m.target.dp)
                            .inspectAWCNode(inspection, "dial-number-${n.value}", "dial-number-${n.label}"), contentAlignment = Alignment.Center) {
                            Text(n.label, maxLines = 1, softWrap = false,
                                style = tpText(m.numberFont, if (n.active) m.numberActiveWeight else m.numberWeight, m.numberFont * TPMetrics.NATURAL_LINE, colors[0])
                                    .copy(fontFeatureSettings = "tnum"))
                        }
                    }
                }
            }
        }
    }
    @Composable fun DialWrap(bottom: Double) {
        Box(Modifier.padding(bottom = bottom.dp).then(if (horizontalDialog) Modifier else Modifier.fillMaxWidth()).inspectAWCNode(inspection, "dial-wrap", "dial-wrap"),
            contentAlignment = Alignment.TopCenter) {
            ModeIn("mode-dial") { Dial() }
        }
    }
    @Composable fun TimeArea(fill: Boolean) {
        Column(Modifier.then(if (fill) Modifier.fillMaxWidth() else Modifier).inspectAWCNode(inspection, "time-area", "time-area"), horizontalAlignment = Alignment.CenterHorizontally) {
            InputArea(!(twelve && periodHorizontal), !isInput, fill)
            if (!isInput && twelve && periodHorizontal) Box(Modifier.padding(top = (if (horizontalDialog) m.insetLg else m.insetMd).dp, bottom = if (horizontalDialog) 0.dp else m.insetXl.dp)) {
                PeriodGroup(true, false)
            }
        }
    }
    // The picker's density reaches its own md-button / md-icon-button children (they read the `density` property).
    val density: Map<String, AWCValue> = LocalAWCNativeDensity.current.let { d -> if (d != 0.0) mapOf("density" to d) else emptyMap() }
    @Composable fun Footer() {
        Row(Modifier.fillMaxWidth().inspectAWCNode(inspection, "footer", "footer"), horizontalArrangement = Arrangement.spacedBy(m.footerGap.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.inspectAWCNode(inspection, "toggle-mode", "toggle-mode").onFocusChanged { if (it.hasFocus) { rt.focused = "toggle-mode" } else if (rt.focused == "toggle-mode") rt.focused = null }) {
                AWCComponent("md-icon-button", mapOf("variant" to "standard", "size" to "sm", "icon" to if (isInput) "schedule" else "keyboard",
                    "aria-label" to if (isInput) labels.toggleDial else labels.toggleInput) + density, onEvent = { n, _ -> if (n == "mdClick") toggleMode() })
            }
            Spacer(Modifier.weight(1f))
            Row(Modifier.inspectAWCNode(inspection, "actions", "actions"), horizontalArrangement = Arrangement.spacedBy(m.actionsGap.dp)) {
                Box(Modifier.inspectAWCNode(inspection, "cancel-button", "cancel-button").onFocusChanged { if (it.hasFocus) rt.focused = "cancel-button" else if (rt.focused == "cancel-button") rt.focused = null }) {
                    AWCComponent("md-button", mapOf("variant" to "text", "size" to "sm", "label" to labels.cancel) + density, onEvent = { n, _ -> if (n == "mdClick") cancel() })
                }
                Box(Modifier.inspectAWCNode(inspection, "confirm-button", "confirm-button").onFocusChanged { if (it.hasFocus) rt.focused = "confirm-button" else if (rt.focused == "confirm-button") rt.focused = null }) {
                    AWCComponent("md-button", mapOf("variant" to "text", "size" to "sm", "label" to labels.ok) + density, onEvent = { n, _ -> if (n == "mdClick") confirm() })
                }
            }
        }
    }

    Column(Modifier.width(width.dp)
        .then(if (shadows.isNotEmpty()) Modifier.accordionShadow(corners, shadows, false) else Modifier)
        .clip(corners)
        .background(hook("dialog-color", "surface-container-high"))
        .awcModalSurface(session, owner)
        // Arrow keys no part used do nothing (Chrome); unconsumed they would move focus directionally (Android D-pad search).
        .onKeyEvent { e -> e.type == KeyEventType.KeyDown && e.key in setOf(Key.DirectionUp, Key.DirectionDown, Key.DirectionLeft, Key.DirectionRight) }
        .focusRequester(container)
        .onFocusChanged { containerFocused = it.isFocused; if (!it.isFocused) containerWanted = false }
        .focusProperties { canFocus = containerWanted }
        .focusable()
        // Presses on the surface never reach the scrim.
        .pointerInput(Unit) { awaitPointerEventScope { while (true) { val e = awaitPointerEvent(PointerEventPass.Final); e.changes.forEach { it.consume() } } } }
        .semantics { paneTitle = headline; contentDescription = headline; isTraversalGroup = true }
        .inspectAWCNode(inspection, "dialog", "dialog")
        .padding(m.padding.dp)) {
        CompositionLocalProvider(androidx.compose.material3.LocalContentColor provides ink) {
            Box(Modifier.padding(bottom = m.headlineSpacing.dp).fillMaxWidth().height(16.dp).inspectAWCNode(inspection, "headline", "headline"), contentAlignment = Alignment.CenterStart) {
                Text(headline, maxLines = 1, softWrap = false, style = tpText(m.headlineSize, m.headlineWeight, 16.0, hook("headline-color", "on-surface-variant"), .5, TextAlign.Start))
            }
            Box(Modifier.inspectAWCNode(inspection, "body", "body")) {
                when {
                    horizontalDialog -> Row(Modifier.fillMaxWidth().padding(bottom = m.insetXl.dp), horizontalArrangement = Arrangement.spacedBy(52.dp), verticalAlignment = Alignment.Top) {
                        Box(Modifier.width(max(2 * m.inputWidth + m.separator, if (twelve) m.periodHWidth else 0.0).dp)) { TimeArea(false) }
                        DialWrap(0.0)
                    }
                    isInput -> InputArea(true, false, true)
                    else -> Column(Modifier.fillMaxWidth()) { TimeArea(true); DialWrap(m.insetXl) }
                }
            }
            Footer()
            // The source's polite live region (`sr-status`): the unit being selected.
            Box(Modifier.size(0.dp).semantics { liveRegion = LiveRegionMode.Polite; contentDescription = status })
        }
    }
}
