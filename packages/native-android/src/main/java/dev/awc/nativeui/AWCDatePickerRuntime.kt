package dev.awc.nativeui

import androidx.compose.runtime.*

/** md-date-picker's live state (a port of AWCUI's AWCDatePickerRuntime): the open panel, the views, the staging and roving
 *  days, the menus, the year list, validity, focus handles and the keyframe runs with their presented values (for the
 *  interaction suites). */
@Stable
class AWCDatePickerRuntime internal constructor() {
    var isOpen by mutableStateOf(false); internal set
    internal var closing by mutableStateOf(false)
    var inputMode by mutableStateOf(false); internal set
    /** The modal year grid shows (`viewMode === 'year'`). */
    var yearView by mutableStateOf(false); internal set
    var viewYear by mutableIntStateOf(2025); internal set
    var viewMonth by mutableIntStateOf(6); internal set
    /** The staged day (`pendingDate`), committed by OK / Enter. */
    var pending by mutableStateOf<AWCDay?>(null); internal set
    /** The roving day-grid focus target. */
    var focused by mutableStateOf(AWCDay(2025, 6, 1)); internal set
    internal var draft by mutableStateOf("")
    internal var fieldFocused by mutableStateOf(false)
    internal var entryDraft by mutableStateOf("")
    var monthMenuOpen by mutableStateOf(false); internal set
    var yearMenuOpen by mutableStateOf(false); internal set
    var validationMessage by mutableStateOf(""); internal set
    var committedValue by mutableStateOf(""); internal set
    /** The modal year grid's roving year and its scroll offset (centred when the view opens, then moved only as far as a key
     *  move needs, as focusYearCell does). */
    internal var yearFocus by mutableStateOf<Int?>(null)
    internal var yearScroll by mutableStateOf<Double?>(null)
    /** captureYearListRange: the year list's bounds while the year view / menu shows. */
    internal var yearRange by mutableStateOf<IntRange?>(null)
    internal var validityKey: String? = null
    /** The picker control holding focus (Escape and the calendar keys act only while focus is inside the picker). */
    var focusedControl by mutableStateOf<String?>(null); internal set
    internal var fieldHasFocus = false
    internal var entryHasFocus = false
    /** The last activation was a pointer press: a programmatic focus move then shows no ring (Chrome :focus-visible). */
    internal var pointerInput = false
    internal var pickPending = false
    internal var loaded = false
    internal var seenValue: String? = null
    internal var openedFromInside = false
    internal var closeSerial by mutableIntStateOf(0)
    /** Focus handles of the picker's own md-button / md-icon-button parts, by part id. */
    internal val buttons = mutableMapOf<String, AWCButtonFocusState>()
    internal fun button(id: String) = buttons.getOrPut(id) { AWCButtonFocusState() }
    /** A focus request once its target has rendered (the source waits two frames), retried for ~1 s; a newer one supersedes. */
    internal var focusTarget: String? = null
    internal var focusRing = true
    internal var focusSerial by mutableIntStateOf(0)
    internal fun focusLater(id: String, ring: Boolean = !pointerInput) { focusTarget = id; focusRing = ring; focusSerial++ }
    /** Focuses a picker part by id ("day-2025-06-18", "year-2025", "ok-button", …) with a focus ring (tests, Laboratory). */
    fun focusPart(id: String) = focusLater(id, true)
    // Motion: keyframe runs by key (token in force, start = first rendered frame, ms of the frame clock).
    internal val clock = AWCModalClock()
    internal val runs = mutableMapOf<String, Triple<Int, Double, Double>>()
    internal val pendingRuns = mutableMapOf<String, Pair<Int, Double>>()
    internal var panelClosing by mutableStateOf(false)
    internal var menuClosing by mutableStateOf(false)
    internal var yearClosing by mutableStateOf(false)
    internal var openToken by mutableIntStateOf(0)
    internal var menuToken by mutableIntStateOf(0)
    internal var yearToken by mutableIntStateOf(0)
    internal var calendarToken by mutableStateOf<Int?>(null)
    internal var slideToken by mutableStateOf<Int?>(null)
    internal var slideDirection by mutableIntStateOf(1)
    /** Run tokens are never reused: a token seen before would resume that run's start (no new keyframes). */
    private var runSerial = 0
    internal fun nextRun(): Int { runSerial++; return runSerial }
    /** The run `token` of `key`: its start (ms) once its first frame rendered, else null (it starts at the next frame). */
    internal fun runStart(key: String, token: Int, duration: Double): Double? {
        val r = runs[key]
        if (r != null && r.first == token) return r.second
        if (pendingRuns[key]?.first != token) { pendingRuns[key] = token to duration; clock.version++ }
        return null
    }
    /** The frame clock reached a frame: pending runs start at it (ms). */
    internal fun startPending(ms: Double) {
        if (pendingRuns.isEmpty()) return
        for ((k, v) in pendingRuns) { runs[k] = Triple(v.first, ms, v.second); runStarts.getOrPut(k) { mutableListOf() } += ms }
        pendingRuns.clear()
    }
    internal fun animating(now: Double) = pendingRuns.isNotEmpty() || runs.values.any { now < it.second + it.third + 34 }
    /** Suspends until the run `token` of `key` has rendered the frame `delay` ms after its start — the source's fixed delay
     *  before an exited element leaves (200 ms; the keyframes' own length follows the motion hooks) — at most `limit` ms, then
     *  one more frame. */
    internal suspend fun awaitRun(key: String, token: Int, limit: Double = 700.0, delay: Double = 200.0) {
        var first = -1.0
        while (true) {
            val t = androidx.compose.runtime.withFrameNanos { it / 1e6 }
            if (first < 0) first = t
            val r = runs[key]
            if (r != null && r.first == token && t >= r.second + delay) break
            if (t - first > limit) break
        }
        androidx.compose.runtime.withFrameNanos { }
    }
    /** Presented values per key ([opacity, scale, translateY, translateX]) with frame times (ms, frame clock). */
    val motion = mutableMapOf<String, MutableList<Pair<Double, List<Double>>>>()
    /** Every run's start by key (ms, frame clock). */
    val runStarts = mutableMapOf<String, MutableList<Double>>()
    internal fun record(key: String, v: List<Double>) {
        val list = motion.getOrPut(key) { mutableListOf() }
        if (list.lastOrNull()?.second == v) return
        list += clock.frameMillis to v; if (list.size > 600) list.subList(0, list.size - 600).clear()
    }
    /** Docked placement (positionDockedPanel). */
    internal var dockedEnd by mutableStateOf(false)
    internal var dockedAbove by mutableStateOf(false)
    internal var dockedMaxBlock by mutableStateOf<Double?>(null)
    /** Inspection mirror (tests, Laboratory inspector): the trigger's shown text (null without a trigger), the entry's text
     *  (null unless the entry shows), the roving tab stops (days / years with tabindex 0), the year grid's scroll offset, the
     *  text input holding focus ("field" / "entry"). */
    var fieldText by mutableStateOf<String?>(null); internal set
    val entryText: String? get() = entryOf()
    val tabStops: List<String> get() = stopsOf()
    val yearScrollTop: Double? get() = yearScrollOf()
    internal var stopsOf: () -> List<String> = { emptyList() }
    internal var yearScrollOf: () -> Double? = { null }
    internal var entryOf: () -> String? = { null }
    val inputFocus: String? get() = if (entryHasFocus) "entry" else if (fieldHasFocus) "field" else null
    /** Scrolls the open docked list to an entry (the list scrolls inside the panel, decision 3). */
    var revealMenuEntry: (Int) -> Unit = {}; internal set
    /** Test / inspector preparation of a shown sub-view, as the Web page prepares it: "entry", "year", "month-menu", "year-menu". */
    fun showView(view: String) {
        when (view) { "entry" -> inputMode = true; "year" -> yearView = true; "month-menu" -> monthMenuOpen = true; "year-menu" -> yearMenuOpen = true }
    }
    internal var show: () -> Unit = {}
    internal var hide: () -> Unit = {}
    internal var clear: () -> Unit = {}
    internal var focusInput: () -> Unit = {}
    /** Constraint validation (syncFormValue): the current message and failing flag; setCustomValidity's message; whether a
     *  report revealed the message (InlineValidationPresenter: the field's error text until valid or reset). */
    internal var validityMessage by mutableStateOf("")
    internal var validityFlag: String? = null
    internal var customValidity = ""
    internal var revealed by mutableStateOf(false)
    internal var isDisabled: () -> Boolean = { false }
    internal var revalidate: () -> Unit = {}
    companion object { val mounted = mutableMapOf<String, java.lang.ref.WeakReference<AWCDatePickerRuntime>>() }
}
