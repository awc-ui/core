package dev.awc.nativeui.slider

import java.math.BigDecimal
import java.math.MathContext
import java.math.RoundingMode
import kotlin.math.abs
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min
import kotlin.math.round

// md-slider's value model and interaction, platform-neutral: the component (md-slider.tsx: live vs committed
// values, controlled mode, range push and hand-over, the rail gestures for range / vertical, event details and
// order) and the native <input type=range> it embeds for the single horizontal slider and for every keyboard step
// (Blink's RangeInputType / SliderThumbElement: step snapping in decimal, the page step, the reading-direction
// arrows, the 16 px hidden thumb a press maps through, press-on-thumb without a jump). The Compose and SwiftUI
// views feed gestures and keys in and draw from `display*`, `pct`, `ticks()` and `indicatorText`.

data class SliderEvent(val name: String, val detail: Map<String, Any?>)

/** JS `Number.prototype.toString` for the values the slider prints (aria-valuenow, form values). */
fun sliderNumberString(v: Double): String = srJsNumberString(v)

/** Blink `Decimal::FromDouble`: the double's shortest decimal form, as an exact decimal. */
private fun dec(v: Double): BigDecimal = BigDecimal(sliderNumberString(v))

/** md-slider's host properties as the component reads them (one render's worth). */
data class SliderProps(
    val min: Double = 0.0, val max: Double = 100.0, val step: Double = 1.0, val value: Double = 50.0, val valueStart: Double = 0.0, val valueEnd: Double = 100.0,
    val disabled: Boolean = false, val variant: String = "standard", val range: Boolean = false, val stops: Boolean = false, val size: String = "xs",
    val orientation: String = "horizontal", val valueIndicator: Boolean = false, val labeled: Boolean = false, val insetIcon: Boolean = false,
    val controlled: Boolean = false, val rtl: Boolean = false,
)

class SliderInteraction {
    // ── properties (the host keeps them current; uncontrolled interaction writes value / valueStart / valueEnd) ──
    var min = 0.0
    var max = 100.0
    var value = 50.0; private set
    var step = 1.0
    var disabled = false
    var variant = "standard"
    var range = false
    var stops = false
    var valueStart = 0.0; private set
    var valueEnd = 100.0; private set
    var size = "xs"
    var orientation = "horizontal"
    var valueIndicator = false
    var labeled = false
    var insetIcon = false
    var controlled = false
    var rtl = false
    /** The hidden native input's thumb size (Blink's default range thumb), which a press on the single horizontal slider maps through. */
    var inputThumb = 16.0
    var onEvent: (SliderEvent) -> Unit = {}
    /** An uncontrolled write of a value property (the Web component mutates its own props). */
    var onPropWrite: (name: String, value: Double) -> Unit = { _, _ -> }

    // ── state ──
    private var liveValue: Double? = null
    private var liveStart: Double? = null
    private var liveEnd: Double? = null
    /** The native inputs' own values (Blink keeps them until the component re-renders). */
    var inputValue = "50"; private set
    var inputStart = "0"; private set
    var inputEnd = "100"; private set
    var focusedThumb: String? = null; private set
    var keyFocusedThumb: String? = null; private set
    var pressingThumb: String? = null; private set
    private var rangeDragThumb: String? = null
    private var verticalDragging = false
    private var inputDragging = false
    private var inputValueAtPress = ""

    val vertical get() = orientation == "vertical"
    val isCentered get() = !range && variant == "centered"
    val showBubble get() = valueIndicator || labeled
    val insetArea get() = insetIcon && !range && size != "xs" && size != "sm"
    val displayValue get() = liveValue ?: value
    val displayStart get() = liveStart ?: valueStart
    val displayEnd get() = liveEnd ?: valueEnd
    /** The single horizontal slider is driven by its native input; range and vertical by the rail. */
    val inputDriven get() = !range && !vertical

    private fun emit(name: String, detail: Map<String, Any?>) = onEvent(SliderEvent(name, detail))

    // ── property writes from the host ──

    /** First render (componentDidLoad): clamp, then the inputs take the shown values. */
    fun load(value: Double, valueStart: Double, valueEnd: Double) {
        this.value = value; this.valueStart = valueStart; this.valueEnd = valueEnd
        clampValues()
        render()
    }

    /** The host (or an event handler) set `value`: Stencil's @Watch fires only on a real change. */
    fun setValueProp(v: Double) { if (v != value) { value = v; liveValue = null } }
    fun setValueStartProp(v: Double) { if (v != valueStart) { valueStart = v; liveStart = null } }
    fun setValueEndProp(v: Double) { if (v != valueEnd) { valueEnd = v; liveEnd = null } }
    fun boundsChanged() { clampValues() }

    private var synced: SliderProps? = null
    /**
     * The host's properties → the component, as Stencil applies them: plain props are read on every render; the value
     * watchers run only when their prop changed since the last sync (clearing the live drag value), and a min / max change
     * re-clamps (@Watch('min' / 'max') → clampValues). The first sync is componentDidLoad (clamp). Clamps write the
     * component's own props back through onPropWrite.
     */
    fun sync(p: SliderProps) {
        val prev = synced; synced = p
        min = p.min; max = p.max; step = p.step; disabled = p.disabled; variant = p.variant; range = p.range; stops = p.stops
        size = p.size; orientation = p.orientation; valueIndicator = p.valueIndicator; labeled = p.labeled; insetIcon = p.insetIcon
        controlled = p.controlled; rtl = p.rtl
        if (prev == null) { load(p.value, p.valueStart, p.valueEnd); return }
        if (p.value != prev.value) setValueProp(p.value)
        if (p.valueStart != prev.valueStart) setValueStartProp(p.valueStart)
        if (p.valueEnd != prev.valueEnd) setValueEndProp(p.valueEnd)
        if (p.min != prev.min || p.max != prev.max) clampValues()
        if (p.disabled && !prev.disabled) disabledChanged()
        render()
    }

    /**
     * The host disabled the slider: Blink ends a native-input drag (a change event when the value moved) and the focused
     * input loses focus. The component's pressing state is left as it was (its pointerup handler ignores a disabled slider).
     */
    private fun disabledChanged() {
        if (inputDragging) { inputDragging = false; if (inputValue != inputValueAtPress) handleChange("single") }
        if (focusedThumb != null) blur()
    }

    /** clampValues: the component assigns its own value props (a changed one fires its watcher and is written back). */
    private fun clampValues() {
        val v = min(max, max(min, value)); if (v != value) writeValue(v)
        if (range) {
            val a = min(max, max(min, valueStart)); if (a != valueStart) writeStart(a)
            val b = min(max, max(min, valueEnd)); if (b != valueEnd) writeEnd(b)
        }
    }

    private fun writeValue(v: Double) { setValueProp(v); onPropWrite("value", v) }
    private fun writeStart(v: Double) { setValueStartProp(v); onPropWrite("valueStart", v) }
    private fun writeEnd(v: Double) { setValueEndProp(v); onPropWrite("valueEnd", v) }

    private fun setSingle(v: Double) { if (controlled) liveValue = v else writeValue(v) }
    private fun setStart(v: Double) { if (controlled) liveStart = v else writeStart(v) }
    private fun setEnd(v: Double) { if (controlled) liveEnd = v else writeEnd(v) }

    private fun commit() {
        if (controlled) { liveValue = null; liveStart = null; liveEnd = null; return }
        liveValue?.let { writeValue(it) }; liveValue = null
        liveStart?.let { writeStart(it) }; liveStart = null
        liveEnd?.let { writeEnd(it) }; liveEnd = null
    }

    /** componentDidRender: each native input shows what the slider shows. */
    /** componentDidRender, through the range input's value sanitization (clamped and aligned to the step: value 150 with max 100 reads "100"). */
    fun render() {
        fun sanitized(v: Double) = if (v.isFinite()) clampToStep(dec(v)).stripTrailingZeros().toPlainString() else sliderNumberString(v)
        if (range) { inputStart = sanitized(displayStart); inputEnd = sanitized(displayEnd) }
        else inputValue = sanitized(displayValue)
    }

    // ── geometry the view draws from ──

    fun pct(v: Double): Double = if (max == min) 0.0 else ((v - min) / (max - min)) * 100
    val valuePct get() = pct(displayValue)
    val startPct get() = pct(displayStart)
    val endPct get() = pct(displayEnd)
    val centerPct get() = pct((min + max) / 2)
    /** Centered fill: from the midpoint to the value, either side. */
    val activeStartPct get() = min(centerPct, valuePct)
    val activeWidthPct get() = max(centerPct, valuePct) - activeStartPct
    val insetOnActive: Boolean get() {
        if (!insetArea) return false
        if (isCentered) return displayValue < (min + max) / 2
        return displayValue > min
    }

    /** formatValue: the step's decimals (JS toFixed), else the rounded value. */
    fun formatValue(v: Double): String {
        if (step > 0) {
            val decimals = sliderNumberString(step).substringAfter('.', "").length
            // JS toFixed: the sign first, then the magnitude rounded half up on its exact binary value.
            if (abs(v) >= 1e21) return sliderNumberString(v)
            return (if (v < 0) "-" else "") + BigDecimal(abs(v)).setScale(decimals, RoundingMode.HALF_UP).toPlainString()
        }
        return sliderNumberString(jsRound(v))
    }
    val indicatorTexts: List<String> get() = if (!showBubble) emptyList() else if (range) listOf(formatValue(displayStart), formatValue(displayEnd)) else listOf(formatValue(displayValue))

    /** getTickMarks: per stop, `active` (under a thumb), `filled` or `inactive`. */
    fun ticks(): List<String>? {
        if (!stops || step <= 0) return null
        val span = max - min
        val count = floor(span / step).toInt() + 1
        if (count < 2) return null
        val eps = step * 0.001
        fun near(a: Double, b: Double) = abs(a - b) < eps
        val mid = (min + max) / 2
        val v = displayValue; val vs = displayStart; val ve = displayEnd
        return (0 until count).map { i ->
            val t = min + i * step
            val hidden = if (range) near(t, vs) || near(t, ve) else near(t, v)
            val onActive = if (range) t >= vs && t <= ve else if (isCentered) t >= min(mid, v) && t <= max(mid, v) else t <= v
            if (hidden) "active" else if (onActive) "filled" else "inactive"
        }
    }

    // ── the native input (Blink) ──

    /** StepRange::ClampValue: clamp, then round to `min + k·step` (ties away from zero), backing off one step past max. */
    /** StepRange::ClampValue; RangeInputType::CreateStepRange: a max below min becomes max(min, 100). */
    private fun clampToStep(v: BigDecimal): BigDecimal {
        val lo = dec(min); val hiRaw = dec(max); val hi = if (hiRaw >= lo) hiRaw else lo.max(BigDecimal(100))
        val inRange = v.max(lo).min(hi)
        if (step <= 0) return inRange
        val s = dec(step)
        val k = inRange.subtract(lo).divide(s, MathContext.DECIMAL128).setScale(0, RoundingMode.HALF_UP)
        var r = k.multiply(s).add(lo)
        if (r > hi) r = r.subtract(s)
        return r
    }

    private fun inputOf(thumb: String) = when (thumb) { "start" -> inputStart; "end" -> inputEnd; else -> inputValue }
    private fun setInput(thumb: String, s: String) { when (thumb) { "start" -> inputStart = s; "end" -> inputEnd = s; else -> inputValue = s } }

    /** Key on a focused thumb input: keydown handler, Blink's step (input + change), then the keyup handler. */
    private val sliderKeys = setOf("ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown")

    /** keydown on a thumb's input: the drag starts (once per hold; repeats keep it), then the input's default step. */
    fun keyDown(thumb: String, key: String) {
        if (disabled || key !in sliderKeys) return
        if (pressingThumb == null) { pressingThumb = thumb; emit("mdDragStart", dragDetail(thumb)) }
        val cur = BigDecimal(inputOf(thumb))
        val s = dec(step)
        val big = dec(max).subtract(dec(min)).divide(BigDecimal.TEN, MathContext.DECIMAL128).max(s)
        // Reading direction: a horizontal RTL input steps up with ArrowLeft; a vertical one (vertical-lr) with Up and Right.
        val up = if (vertical) setOf("ArrowUp", "ArrowRight") else if (rtl) setOf("ArrowUp", "ArrowLeft") else setOf("ArrowUp", "ArrowRight")
        val next = when (key) {
            "Home" -> dec(min)
            "End" -> dec(max)
            "PageUp" -> cur.add(big)
            "PageDown" -> cur.subtract(big)
            else -> if (key in up) cur.add(s) else cur.subtract(s)
        }.let(::clampToStep)
        if (next.compareTo(cur) != 0) {
            setInput(thumb, next.stripTrailingZeros().toPlainString())
            handleInput(thumb)
            handleChange(thumb)
        }
    }

    /** keyup: the drag ends (the knob's press morph reverses). */
    fun keyUp(thumb: String, key: String) {
        if (disabled || key !in sliderKeys) return
        pressingThumb = null
        emit("mdDragEnd", dragDetail(thumb))
    }

    /** A full key press (down + up). */
    fun key(thumb: String, key: String) { keyDown(thumb, key); keyUp(thumb, key) }

    private fun dragDetail(thumb: String): Map<String, Any?> = if (range)
        mapOf("thumb" to thumb, "value" to (if (thumb == "start") displayStart else displayEnd), "valueStart" to displayStart, "valueEnd" to displayEnd)
    else mapOf("thumb" to "single", "value" to displayValue)

    private fun rangeDetail(thumb: String?): Map<String, Any?> =
        mapOf("value" to (if (thumb == "start") displayStart else displayEnd), "valueStart" to displayStart, "valueEnd" to displayEnd)

    private fun applyInputValue(thumb: String) {
        val v = inputOf(thumb).toDouble()
        if (range) {
            if (thumb == "start") { if (v > displayEnd) { setEnd(v); setStart(v) } else setStart(v) }
            else { if (v < displayStart) { setStart(v); setEnd(v) } else setEnd(v) }
        } else setSingle(v)
    }

    private fun handleInput(thumb: String) {
        applyInputValue(thumb)
        emit("mdInput", if (range) rangeDetail(thumb) else mapOf("value" to displayValue))
    }

    private fun handleChange(thumb: String) {
        applyInputValue(thumb)
        emit("mdChange", if (range) rangeDetail(thumb) else mapOf("value" to displayValue))
        commit()
    }

    /** SliderThumbElement::SetPositionFromPoint over the input box (`x` from the box's left edge, `w` its width). */
    private fun inputValueAt(x: Double, w: Double): BigDecimal {
        val trackSize = layoutUnit(w - inputThumb)
        var pos = layoutUnit(x) - layoutUnit(inputThumb / 2)
        pos = max(0.0, min(pos, trackSize))
        val ratio = if (trackSize > 0) dec(pos / trackSize) else BigDecimal.ZERO
        val fraction = if (rtl) BigDecimal.ONE.subtract(ratio) else ratio
        return clampToStep(dec(min).add(fraction.multiply(dec(max).subtract(dec(min)))))
    }

    /** Blink LayoutUnit: 1/64 px fixed point, truncating. */
    private fun layoutUnit(v: Double) = (v * 64).toLong() / 64.0

    private fun thumbCentre(w: Double): Double {
        val cur = inputValue.toDouble()
        val f = if (max == min) 0.0 else (cur - min) / (max - min)
        val ff = if (rtl) 1 - f else f
        return inputThumb / 2 + ff * (w - inputThumb)
    }

    // ── pointer: `x`/`y` in the rail box, `w`/`h` its size ──

    /**
     * `touch`: a finger (Chrome's touch contract): the native input jumps to the touch point — no grab of the thumb — and is
     * not focused. The rails (range, vertical) take touch like the mouse.
     */
    fun pointerDown(x: Double, y: Double, w: Double, h: Double, touch: Boolean = false) {
        if (disabled) return
        if (range) { railDownRange(railValue(x, y, w, h)); return }
        if (vertical) { railDownVertical(railValue(x, y, w, h)); return }
        // The native input: its pointerdown listener, then Blink's press (no jump when it lands on the thumb), then focus.
        pressingThumb = "single"
        emit("mdDragStart", dragDetail("single"))
        inputDragging = true
        inputValueAtPress = inputValue
        if (touch || abs(x - thumbCentre(w)) > inputThumb / 2) moveInputTo(x, w)
        if (!touch) focus("single")
    }

    fun pointerMove(x: Double, y: Double, w: Double, h: Double) {
        if (range) { if (!disabled && rangeDragThumb != null) applyRangePointerValue(railValue(x, y, w, h)); return }
        if (vertical) { if (verticalDragging) { setSingle(railValue(x, y, w, h)); emit("mdInput", mapOf("value" to displayValue)) }; return }
        if (inputDragging) moveInputTo(x, w)
    }

    fun pointerUp(x: Double, y: Double, w: Double, h: Double) {
        if (range) { endRangeGesture(); return }
        if (vertical) {
            if (!verticalDragging) return
            verticalDragging = false; pressingThumb = null
            val d = mapOf("value" to displayValue)
            emit("mdChange", d); emit("mdDragEnd", mapOf("thumb" to "single") + d)
            commit()
            return
        }
        if (disabled || !inputDragging) return
        pressingThumb = null
        emit("mdDragEnd", dragDetail("single"))
        inputDragging = false
        if (inputValue != inputValueAtPress) handleChange("single")
    }

    private fun moveInputTo(x: Double, w: Double) {
        val next = inputValueAt(x, w)
        if (next.compareTo(BigDecimal(inputValue)) != 0) {
            inputValue = next.stripTrailingZeros().toPlainString()
            handleInput("single")
        }
    }

    /** pointerToValue over the rail (no thumb inset): bottom-up when vertical, reading direction otherwise. */
    private fun railValue(x: Double, y: Double, w: Double, h: Double): Double {
        val ratio = (if (vertical) (if (h > 0) (h - y) / h else 0.0) else if (w > 0) (if (rtl) (w - x) / w else x / w) else 0.0).coerceIn(0.0, 1.0)
        val raw = min + ratio * (max - min)
        if (step <= 0) return min(max, max(min, raw))
        val q = jsRound((raw - min) / step)
        return min(max, max(min, min + q * step))
    }

    private fun jsRound(v: Double): Double { val r = floor(v); return if (v - r >= 0.5) r + 1 else r }

    private fun railDownRange(v: Double) {
        val dStart = abs(v - displayStart); val dEnd = abs(v - displayEnd)
        rangeDragThumb = if (dStart == dEnd) (if (v >= displayEnd) "end" else "start") else if (dStart < dEnd) "start" else "end"
        pressingThumb = rangeDragThumb
        emit("mdDragStart", dragDetail(rangeDragThumb!!))
        applyRangePointerValue(v)
    }

    private fun applyRangePointerValue(v: Double) {
        if (rangeDragThumb == "start") {
            if (v > displayEnd) { rangeDragThumb = "end"; pressingThumb = "end"; setEnd(v) } else setStart(v)
        } else if (rangeDragThumb == "end") {
            if (v < displayStart) { rangeDragThumb = "start"; pressingThumb = "start"; setStart(v) } else setEnd(v)
        }
        emit("mdInput", rangeDetail(rangeDragThumb))
    }

    private fun endRangeGesture() {
        val thumb = rangeDragThumb ?: return
        val d = rangeDetail(thumb)
        rangeDragThumb = null; pressingThumb = null
        emit("mdChange", d)
        emit("mdDragEnd", mapOf("thumb" to thumb) + d)
        commit()
    }

    private fun railDownVertical(v: Double) {
        verticalDragging = true; pressingThumb = "single"
        setSingle(v)
        emit("mdDragStart", mapOf("thumb" to "single", "value" to displayValue))
        emit("mdInput", mapOf("value" to displayValue))
    }

    /** Lost pointer capture / cancel mid-gesture: the rail commits like a release. */
    fun pointerCancel() {
        if (range) { endRangeGesture(); return }
        if (vertical && verticalDragging) { pointerUp(0.0, 0.0, 0.0, 0.0); return }
        if (inputDragging) { inputDragging = false; pressingThumb = null; emit("mdDragEnd", dragDetail("single")) }
    }

    // ── focus ──

    /** A thumb input took focus (`keyboard` = it matches :focus-visible). */
    fun focus(thumb: String, keyboard: Boolean = false) {
        if (disabled || focusedThumb == thumb) return
        focusedThumb?.let { blur() }
        focusedThumb = thumb
        if (keyboard) keyFocusedThumb = thumb
        emit("mdFocus", mapOf("thumb" to thumb))
    }

    fun blur() {
        val t = focusedThumb ?: return
        focusedThumb = null; keyFocusedThumb = null
        emit("mdBlur", mapOf("thumb" to t))
    }
}
