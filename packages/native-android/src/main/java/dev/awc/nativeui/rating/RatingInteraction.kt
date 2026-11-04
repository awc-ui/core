package dev.awc.nativeui.rating

import dev.awc.nativeui.slider.srJsNumberString
import kotlin.math.max
import kotlin.math.min
import kotlin.math.round

// md-rating's value model and interaction, platform-neutral (md-rating.tsx): hover preview with half steps,
// click to set / click the current value to reset to `default-value`, the keyboard (reading-direction arrows,
// Home / End, digits), the readonly / disabled / soft-disabled gates, value labels and the item fill.

data class RatingEvent(val name: String, val detail: Any?)

/** md-rating's host properties as the component reads them (one render's worth). */
data class RatingProps(
    val value: Double = 0.0, val defaultValue: Double = 0.0, val max: Int = 5, val precision: Double = 1.0, val readonly: Boolean = false,
    val disabled: Boolean = false, val softDisabled: Boolean = false, val hover: String = "preview", val rtl: Boolean = false,
)

class RatingInteraction {
    var value = 0.0; private set
    var defaultValue = 0.0
    var max = 5
    var precision = 1.0
    var readonly = false
    var disabled = false
    var softDisabled = false
    var hover = "preview"
    var rtl = false
    var getLabel: ((Double) -> String)? = null
    var onEvent: (RatingEvent) -> Unit = {}
    var onPropWrite: (Double) -> Unit = {}

    var hoveredValue: Double? = null; private set
    var focused = false; private set
    /** Keyboard focus (`:focus-visible`): a press focuses the slider without the ring. */
    var focusVisible = false; private set

    val isInteractive get() = !readonly && !disabled && !softDisabled
    val displayValue get() = if (hoveredValue != null && hover == "preview") hoveredValue!! else value

    private fun emit(name: String, detail: Any?) = onEvent(RatingEvent(name, detail))

    /** The host set `value` (validateValue: NaN → 0, clamped to [0, max]). */
    fun setValueProp(v: Double) { value = if (v.isNaN()) 0.0 else min(max.toDouble(), max(0.0, v)) }
    private fun write(v: Double) { setValueProp(v); onPropWrite(value) }

    private var synced: RatingProps? = null
    /**
     * The host's properties → the component, as Stencil applies them: plain props every render; @Watch('value')
     * (validateValue: NaN → 0, clamped to [0, max], the clamp written back to the prop) runs at load and when the value
     * prop changed; @Watch('max') re-clamps a value above the new max.
     */
    fun sync(p: RatingProps) {
        val prev = synced; synced = p
        max = p.max; precision = p.precision; defaultValue = p.defaultValue; readonly = p.readonly; disabled = p.disabled
        softDisabled = p.softDisabled; hover = p.hover; rtl = p.rtl
        if (prev == null || p.value != prev.value) { setValueProp(p.value); if (value != p.value) onPropWrite(value) }
        if (prev != null && p.max != prev.max && value > max) write(max.toDouble())
    }

    fun label(v: Double): String = getLabel?.invoke(v) ?: when (v) { 0.0 -> "Empty"; 1.0 -> "1 Star"; else -> "${srJsNumberString(v)} Stars" }

    /** Item i's fill: 1 full, 0 < p < 1 half, 0 empty. */
    fun fill(i: Int): Double = max(0.0, min(1.0, displayValue - i))
    fun itemState(i: Int): String { val p = fill(i); return if (p >= 1) "full" else if (p > 0) "half" else "empty" }

    /** The widest-label sizers (one per step 0…max). */
    fun labelVariants(): List<String> {
        val step = if (precision == 0.0) 1.0 else precision
        val out = LinkedHashSet<String>()
        var v = 0.0
        while (v <= max + 1e-9) { out.add(label(min(jsRound(v / step) * step, max.toDouble()))); v += step }
        return out.toList()
    }

    private fun jsRound(v: Double): Double { val r = kotlin.math.floor(v); return if (v - r >= 0.5) r + 1 else r }

    /** computeValueFromPointer: `fx` = the pointer's fraction across item i from its left edge. */
    fun valueAt(i: Int, fx: Double): Double {
        if (precision == 1.0) return (i + 1).toDouble()
        val ratio = if (rtl) 1 - fx else fx
        return i + if (ratio <= 0.5) 0.5 else 1.0
    }

    fun pointerMove(i: Int, fx: Double) {
        if (!isInteractive || hover == "off") return
        val next = valueAt(i, fx)
        if (next != hoveredValue) { hoveredValue = next; emit("mdHover", next) }
    }

    /** A press on an item focuses the rating (the browser focuses the slider container); the view runs the glyph ripple. */
    fun pointerDown() { if (focusable && !focused) focus(keyboard = false) }

    /** A touch tap (Chrome): after pointerdown/up the synthesized mousedown focuses the rating without :focus-visible, then click. */
    fun tap(i: Int, fx: Double) { if (focusable && !focused) focus(keyboard = false); click(i, fx) }

    fun pointerLeave() {
        if (!isInteractive || hoveredValue == null) return
        hoveredValue = null
        emit("mdHover", null)
    }

    fun click(i: Int, fx: Double) {
        if (!isInteractive) return
        var next = valueAt(i, fx)
        if (next == value) next = defaultValue
        write(next)
        emit("mdChange", next)
    }

    fun keyDown(key: String): Boolean {
        if (focused) focusVisible = true   // a key press makes the focused element :focus-visible
        if (!isInteractive) return false
        val step = precision
        var next = when (key) {
            "ArrowRight" -> if (rtl) value - step else value + step
            "ArrowLeft" -> if (rtl) value + step else value - step
            "ArrowUp" -> value + step
            "ArrowDown" -> value - step
            "Home" -> 0.0
            "End" -> max.toDouble()
            else -> if (key.length == 1 && key[0] in '0'..'9') { val d = (key[0] - '0').toDouble(); if (d <= max) d else value } else return false
        }
        next = max(0.0, min(max.toDouble(), next))
        if (next != value) { write(next); emit("mdChange", next) }
        return true
    }

    /**
     * An assistive technology's SetProgress (TalkBack scroll, Switch Access, voice): the target rounded to the precision; a
     * target that rounds back to the value moves one step towards it (TalkBack's scroll increment is range / 20, under a
     * step). A change is written and reported like a key (mdChange).
     */
    fun setFromAssistive(target: Double): Boolean {
        if (!isInteractive) return false
        val step = precision
        var next = Math.round(target / step) * step
        if (next == value && target != value) next = if (target > value) value + step else value - step
        next = max(0.0, min(max.toDouble(), next))
        if (next != value) { write(next); emit("mdChange", next) }
        return true
    }

    fun focus(keyboard: Boolean = true) { focused = true; focusVisible = keyboard }
    fun blur() {
        focused = false; focusVisible = false
        if (hoveredValue != null) { hoveredValue = null; emit("mdHover", null) }
    }

    /** The rating is focusable unless disabled (`-1`) or readonly (no tabindex). */
    val focusable get() = !disabled && !readonly
}
