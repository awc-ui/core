import Foundation

// md-slider's value model and interaction, platform-neutral: the component (md-slider.tsx: live vs committed
// values, controlled mode, range push and hand-over, the rail gestures for range / vertical, event details and
// order) and the native <input type=range> it embeds for the single horizontal slider and for every keyboard
// step (Blink: decimal step snapping, the page step, reading-direction arrows, the 16 px hidden thumb a press
// maps through, press-on-thumb without a jump). Lockstep port of SliderInteraction.kt (replayed against the
// Web oracle in CI).

struct AWCSliderEvent { var name: String; var detail: [String: Any] }

/// Blink `Decimal::FromDouble`: the double's shortest decimal form, exactly.
private func awcSliderDec(_ v: Double) -> Decimal { Decimal(string: awcSRJSNumberString(v), locale: Locale(identifier: "en_US_POSIX")) ?? Decimal(v) }

private func awcDecRound(_ v: Decimal, scale: Int, _ mode: NSDecimalNumber.RoundingMode) -> Decimal {
    var x = v, r = Decimal()
    NSDecimalRound(&r, &x, scale, mode)
    return r
}

/// A decimal's plain string (Blink `Decimal::ToString` for the values a slider takes).
private func awcDecString(_ d: Decimal) -> String {
    let s = NSDecimalNumber(decimal: d).stringValue
    return s == "-0" ? "0" : s
}

/// md-slider's host properties as the component reads them (one render's worth).
struct AWCSliderProps: Equatable {
    var min = 0.0, max = 100.0, step = 1.0, value = 50.0, valueStart = 0.0, valueEnd = 100.0
    var disabled = false, variant = "standard", range = false, stops = false, size = "xs", orientation = "horizontal"
    var valueIndicator = false, labeled = false, insetIcon = false, controlled = false, rtl = false
}

final class AWCSliderInteraction {
    var min = 0.0, max = 100.0, step = 1.0
    private(set) var value = 50.0
    var disabled = false
    var variant = "standard"
    var range = false
    var stops = false
    private(set) var valueStart = 0.0
    private(set) var valueEnd = 100.0
    var size = "xs"
    var orientation = "horizontal"
    var valueIndicator = false
    var labeled = false
    var insetIcon = false
    var controlled = false
    var rtl = false
    /// The hidden native input's thumb size (Blink's default range thumb), which a press on the single horizontal slider maps through.
    var inputThumb = 16.0
    var onEvent: (AWCSliderEvent) -> Void = { _ in }
    /// An uncontrolled write of a value property (the Web component mutates its own props).
    var onPropWrite: (String, Double) -> Void = { _, _ in }

    private var liveValue: Double? = nil, liveStart: Double? = nil, liveEnd: Double? = nil
    private(set) var inputValue = "50", inputStart = "0", inputEnd = "100"
    private(set) var focusedThumb: String? = nil
    private(set) var keyFocusedThumb: String? = nil
    private(set) var pressingThumb: String? = nil
    private var rangeDragThumb: String? = nil
    private var verticalDragging = false
    private var inputDragging = false
    private var inputValueAtPress = ""

    var vertical: Bool { orientation == "vertical" }
    var isCentered: Bool { !range && variant == "centered" }
    var showBubble: Bool { valueIndicator || labeled }
    var insetArea: Bool { insetIcon && !range && size != "xs" && size != "sm" }
    var displayValue: Double { liveValue ?? value }
    var displayStart: Double { liveStart ?? valueStart }
    var displayEnd: Double { liveEnd ?? valueEnd }
    var inputDriven: Bool { !range && !vertical }

    private func emit(_ name: String, _ detail: [String: Any]) { onEvent(AWCSliderEvent(name: name, detail: detail)) }

    // ── property writes from the host ──

    func load(value: Double, valueStart: Double, valueEnd: Double) {
        self.value = value; self.valueStart = valueStart; self.valueEnd = valueEnd
        clampValues()
        render()
    }
    func setValueProp(_ v: Double) { if v != value { value = v; liveValue = nil } }
    func setValueStartProp(_ v: Double) { if v != valueStart { valueStart = v; liveStart = nil } }
    func setValueEndProp(_ v: Double) { if v != valueEnd { valueEnd = v; liveEnd = nil } }
    func boundsChanged() { clampValues() }

    private var synced: AWCSliderProps? = nil
    /// The host's properties → the component, as Stencil applies them: plain props are read on every render; the value
    /// watchers run only when their prop changed since the last sync (clearing the live drag value), and a min / max change
    /// re-clamps (@Watch('min' / 'max') → clampValues). The first sync is componentDidLoad (clamp). Clamps write the
    /// component's own props back through onPropWrite.
    func sync(_ p: AWCSliderProps) {
        let prev = synced; synced = p
        min = p.min; max = p.max; step = p.step; disabled = p.disabled; variant = p.variant; range = p.range; stops = p.stops
        size = p.size; orientation = p.orientation; valueIndicator = p.valueIndicator; labeled = p.labeled; insetIcon = p.insetIcon
        controlled = p.controlled; rtl = p.rtl
        guard let prev else { load(value: p.value, valueStart: p.valueStart, valueEnd: p.valueEnd); return }
        if p.value != prev.value { setValueProp(p.value) }
        if p.valueStart != prev.valueStart { setValueStartProp(p.valueStart) }
        if p.valueEnd != prev.valueEnd { setValueEndProp(p.valueEnd) }
        if p.min != prev.min || p.max != prev.max { clampValues() }
        if p.disabled && !prev.disabled { disabledChanged() }
        render()
    }

    /// The host disabled the slider: Blink ends a native-input drag (a change event when the value moved) and the focused
    /// input loses focus. The component's pressing state is left as it was (its pointerup handler ignores a disabled slider).
    private func disabledChanged() {
        if inputDragging { inputDragging = false; if inputValue != inputValueAtPress { handleChange("single") } }
        if focusedThumb != nil { blur() }
    }

    /// clampValues: the component assigns its own value props (a changed one fires its watcher and is written back).
    private func clampValues() {
        let v = Swift.min(max, Swift.max(min, value)); if v != value { writeValue(v) }
        if range {
            let a = Swift.min(max, Swift.max(min, valueStart)); if a != valueStart { writeStart(a) }
            let b = Swift.min(max, Swift.max(min, valueEnd)); if b != valueEnd { writeEnd(b) }
        }
    }
    private func writeValue(_ v: Double) { setValueProp(v); onPropWrite("value", v) }
    private func writeStart(_ v: Double) { setValueStartProp(v); onPropWrite("valueStart", v) }
    private func writeEnd(_ v: Double) { setValueEndProp(v); onPropWrite("valueEnd", v) }
    private func setSingle(_ v: Double) { if controlled { liveValue = v } else { writeValue(v) } }
    private func setStart(_ v: Double) { if controlled { liveStart = v } else { writeStart(v) } }
    private func setEnd(_ v: Double) { if controlled { liveEnd = v } else { writeEnd(v) } }

    private func commit() {
        if controlled { liveValue = nil; liveStart = nil; liveEnd = nil; return }
        if let v = liveValue { writeValue(v) }; liveValue = nil
        if let v = liveStart { writeStart(v) }; liveStart = nil
        if let v = liveEnd { writeEnd(v) }; liveEnd = nil
    }

    /// componentDidRender: each native input shows what the slider shows — through the range input's value sanitization
    /// (clamped and aligned to the step, as the browser stores it: value 150 with max 100 reads "100").
    func render() {
        func sanitized(_ v: Double) -> String { v.isFinite ? awcDecString(clampToStep(awcSliderDec(v))) : awcSRJSNumberString(v) }
        if range { inputStart = sanitized(displayStart); inputEnd = sanitized(displayEnd) }
        else { inputValue = sanitized(displayValue) }
    }

    // ── geometry the view draws from ──

    func pct(_ v: Double) -> Double { max == min ? 0 : ((v - min) / (max - min)) * 100 }
    var valuePct: Double { pct(displayValue) }
    var startPct: Double { pct(displayStart) }
    var endPct: Double { pct(displayEnd) }
    var centerPct: Double { pct((min + max) / 2) }
    var activeStartPct: Double { Swift.min(centerPct, valuePct) }
    var activeWidthPct: Double { Swift.max(centerPct, valuePct) - activeStartPct }
    var insetOnActive: Bool {
        guard insetArea else { return false }
        if isCentered { return displayValue < (min + max) / 2 }
        return displayValue > min
    }

    /// formatValue: the step's decimals (JS toFixed: sign first, magnitude rounded half up on its exact binary value).
    func formatValue(_ v: Double) -> String {
        if step > 0 {
            let decimals = awcSRJSNumberString(step).split(separator: ".").dropFirst().first?.count ?? 0
            if abs(v) >= 1e21 { return awcSRJSNumberString(v) }
            let mag = awcDecRound(Decimal(abs(v)), scale: decimals, .plain)
            var s = NSDecimalNumber(decimal: mag).stringValue
            if decimals > 0 {
                let frac = s.split(separator: ".").dropFirst().first?.count ?? 0
                if frac == 0 { s += "." }
                s += String(repeating: "0", count: decimals - frac)
            }
            return (v < 0 ? "-" : "") + s
        }
        return awcSRJSNumberString(awcSRJSRound(v))
    }
    var indicatorTexts: [String] { !showBubble ? [] : range ? [formatValue(displayStart), formatValue(displayEnd)] : [formatValue(displayValue)] }

    /// getTickMarks: per stop, "active" (under a thumb), "filled" or "inactive".
    func ticks() -> [String]? {
        guard stops, step > 0 else { return nil }
        let count = Int((max - min) / step) + 1
        guard count >= 2 else { return nil }
        let eps = step * 0.001
        func near(_ a: Double, _ b: Double) -> Bool { abs(a - b) < eps }
        let mid = (min + max) / 2, v = displayValue, vs = displayStart, ve = displayEnd
        return (0..<count).map { i in
            let t = min + Double(i) * step
            let hidden = range ? near(t, vs) || near(t, ve) : near(t, v)
            let onActive = range ? t >= vs && t <= ve : isCentered ? t >= Swift.min(mid, v) && t <= Swift.max(mid, v) : t <= v
            return hidden ? "active" : onActive ? "filled" : "inactive"
        }
    }

    // ── the native input (Blink) ──

    /// StepRange::ClampValue: clamp, then round to `min + k·step` (ties away from zero), backing off one step past max.
    /// RangeInputType::CreateStepRange: a max below min becomes max(min, 100).
    private func clampToStep(_ v: Decimal) -> Decimal {
        let lo = awcSliderDec(min), hiRaw = awcSliderDec(max), hi = hiRaw >= lo ? hiRaw : Swift.max(lo, 100)
        let inRange = Swift.min(Swift.max(v, lo), hi)
        guard step > 0 else { return inRange }
        let s = awcSliderDec(step)
        let k = awcDecRound((inRange - lo) / s, scale: 0, .plain)
        var r = k * s + lo
        if r > hi { r -= s }
        return r
    }

    private func inputOf(_ thumb: String) -> String { thumb == "start" ? inputStart : thumb == "end" ? inputEnd : inputValue }
    private func setInput(_ thumb: String, _ s: String) { if thumb == "start" { inputStart = s } else if thumb == "end" { inputEnd = s } else { inputValue = s } }
    private func decOf(_ s: String) -> Decimal { Decimal(string: s, locale: Locale(identifier: "en_US_POSIX")) ?? 0 }

    /// A key on a focused thumb input: keydown handler, Blink's step (input + change), then the keyup handler.
    private static let sliderKeys: Set<String> = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown"]

    /// keydown on a thumb's input: the drag starts (once per hold; repeats keep it), then the input's default step.
    func keyDown(_ thumb: String, _ key: String) {
        guard !disabled, Self.sliderKeys.contains(key) else { return }
        if pressingThumb == nil { pressingThumb = thumb; emit("mdDragStart", dragDetail(thumb)) }
        let cur = decOf(inputOf(thumb))
        let s = awcSliderDec(step)
        let big = Swift.max((awcSliderDec(max) - awcSliderDec(min)) / 10, s)
        // Reading direction: a horizontal RTL input steps up with ArrowLeft; a vertical one (vertical-lr) with Up and Right.
        let up: Set<String> = vertical ? ["ArrowUp", "ArrowRight"] : rtl ? ["ArrowUp", "ArrowLeft"] : ["ArrowUp", "ArrowRight"]
        let raw: Decimal
        switch key {
        case "Home": raw = awcSliderDec(min)
        case "End": raw = awcSliderDec(max)
        case "PageUp": raw = cur + big
        case "PageDown": raw = cur - big
        default: raw = up.contains(key) ? cur + s : cur - s
        }
        let next = clampToStep(raw)
        if next != cur {
            setInput(thumb, awcDecString(next))
            handleInput(thumb)
            handleChange(thumb)
        }
    }

    /// keyup: the drag ends (the knob's press morph reverses).
    func keyUp(_ thumb: String, _ key: String) {
        guard !disabled, Self.sliderKeys.contains(key) else { return }
        pressingThumb = nil
        emit("mdDragEnd", dragDetail(thumb))
    }

    /// A full key press (down + up).
    func key(_ thumb: String, _ key: String) { keyDown(thumb, key); keyUp(thumb, key) }

    private func dragDetail(_ thumb: String) -> [String: Any] {
        range ? ["thumb": thumb, "value": thumb == "start" ? displayStart : displayEnd, "valueStart": displayStart, "valueEnd": displayEnd]
              : ["thumb": "single", "value": displayValue]
    }
    private func rangeDetail(_ thumb: String?) -> [String: Any] { ["value": thumb == "start" ? displayStart : displayEnd, "valueStart": displayStart, "valueEnd": displayEnd] }

    private func applyInputValue(_ thumb: String) {
        let v = Double(inputOf(thumb)) ?? 0
        if range {
            if thumb == "start" { if v > displayEnd { setEnd(v); setStart(v) } else { setStart(v) } }
            else { if v < displayStart { setStart(v); setEnd(v) } else { setEnd(v) } }
        } else { setSingle(v) }
    }
    private func handleInput(_ thumb: String) { applyInputValue(thumb); emit("mdInput", range ? rangeDetail(thumb) : ["value": displayValue]) }
    private func handleChange(_ thumb: String) { applyInputValue(thumb); emit("mdChange", range ? rangeDetail(thumb) : ["value": displayValue]); commit() }

    /// Blink LayoutUnit: 1/64 px fixed point, truncating.
    private func layoutUnit(_ v: Double) -> Double { Double(Int64(v * 64)) / 64 }

    /// SliderThumbElement::SetPositionFromPoint over the input box (`x` from its left edge, `w` its width).
    private func inputValueAt(_ x: Double, _ w: Double) -> Decimal {
        let track = layoutUnit(w - inputThumb)
        let pos = Swift.max(0, Swift.min(layoutUnit(x) - layoutUnit(inputThumb / 2), track))
        let ratio = track > 0 ? awcSliderDec(pos / track) : 0
        let fraction = rtl ? 1 - ratio : ratio
        return clampToStep(awcSliderDec(min) + fraction * (awcSliderDec(max) - awcSliderDec(min)))
    }

    private func thumbCentre(_ w: Double) -> Double {
        let cur = Double(inputValue) ?? 0
        let f = max == min ? 0 : (cur - min) / (max - min)
        return inputThumb / 2 + (rtl ? 1 - f : f) * (w - inputThumb)
    }

    // ── pointer: `x`/`y` in the rail box, `w`/`h` its size ──

    /// `touch`: a finger (Chrome's touch contract): the native input jumps to the touch point — no grab of the thumb — and
    /// is not focused. The rails (range, vertical) take touch like the mouse.
    func pointerDown(_ x: Double, _ y: Double, _ w: Double, _ h: Double, touch: Bool = false) {
        if disabled { return }
        if range { railDownRange(railValue(x, y, w, h)); return }
        if vertical { railDownVertical(railValue(x, y, w, h)); return }
        // The native input: its pointerdown listener, then Blink's press (no jump when it lands on the thumb), then focus.
        pressingThumb = "single"
        emit("mdDragStart", dragDetail("single"))
        inputDragging = true
        inputValueAtPress = inputValue
        if touch || abs(x - thumbCentre(w)) > inputThumb / 2 { moveInputTo(x, w) }
        if !touch { focus("single") }
    }

    func pointerMove(_ x: Double, _ y: Double, _ w: Double, _ h: Double) {
        if range { if !disabled && rangeDragThumb != nil { applyRangePointerValue(railValue(x, y, w, h)) }; return }
        if vertical { if verticalDragging { setSingle(railValue(x, y, w, h)); emit("mdInput", ["value": displayValue]) }; return }
        if inputDragging { moveInputTo(x, w) }
    }

    func pointerUp(_ x: Double, _ y: Double, _ w: Double, _ h: Double) {
        if range { endRangeGesture(); return }
        if vertical {
            guard verticalDragging else { return }
            verticalDragging = false; pressingThumb = nil
            let d: [String: Any] = ["value": displayValue]
            emit("mdChange", d); emit("mdDragEnd", d.merging(["thumb": "single"]) { a, _ in a })
            commit()
            return
        }
        guard !disabled, inputDragging else { return }
        pressingThumb = nil
        emit("mdDragEnd", dragDetail("single"))
        inputDragging = false
        if inputValue != inputValueAtPress { handleChange("single") }
    }

    private func moveInputTo(_ x: Double, _ w: Double) {
        let next = inputValueAt(x, w)
        if next != decOf(inputValue) { inputValue = awcDecString(next); handleInput("single") }
    }

    /// pointerToValue over the rail (no thumb inset): bottom-up when vertical, reading direction otherwise.
    private func railValue(_ x: Double, _ y: Double, _ w: Double, _ h: Double) -> Double {
        let r0 = vertical ? (h > 0 ? (h - y) / h : 0) : (w > 0 ? (rtl ? (w - x) / w : x / w) : 0)
        let ratio = Swift.min(1, Swift.max(0, r0))
        let raw = min + ratio * (max - min)
        guard step > 0 else { return Swift.min(max, Swift.max(min, raw)) }
        let q = awcSRJSRound((raw - min) / step)
        return Swift.min(max, Swift.max(min, min + q * step))
    }

    private func railDownRange(_ v: Double) {
        let dStart = abs(v - displayStart), dEnd = abs(v - displayEnd)
        rangeDragThumb = dStart == dEnd ? (v >= displayEnd ? "end" : "start") : dStart < dEnd ? "start" : "end"
        pressingThumb = rangeDragThumb
        emit("mdDragStart", dragDetail(rangeDragThumb!))
        applyRangePointerValue(v)
    }

    private func applyRangePointerValue(_ v: Double) {
        if rangeDragThumb == "start" {
            if v > displayEnd { rangeDragThumb = "end"; pressingThumb = "end"; setEnd(v) } else { setStart(v) }
        } else if rangeDragThumb == "end" {
            if v < displayStart { rangeDragThumb = "start"; pressingThumb = "start"; setStart(v) } else { setEnd(v) }
        }
        emit("mdInput", rangeDetail(rangeDragThumb))
    }

    private func endRangeGesture() {
        guard let thumb = rangeDragThumb else { return }
        let d = rangeDetail(thumb)
        rangeDragThumb = nil; pressingThumb = nil
        emit("mdChange", d)
        emit("mdDragEnd", d.merging(["thumb": thumb]) { a, _ in a })
        commit()
    }

    private func railDownVertical(_ v: Double) {
        verticalDragging = true; pressingThumb = "single"
        setSingle(v)
        emit("mdDragStart", ["thumb": "single", "value": displayValue])
        emit("mdInput", ["value": displayValue])
    }

    /// Lost pointer capture / cancel mid-gesture: the rail commits like a release.
    func pointerCancel() {
        if range { endRangeGesture(); return }
        if vertical && verticalDragging { pointerUp(0, 0, 0, 0); return }
        if inputDragging { inputDragging = false; pressingThumb = nil; emit("mdDragEnd", dragDetail("single")) }
    }

    // ── focus ──

    func focus(_ thumb: String, keyboard: Bool = false) {
        if disabled || focusedThumb == thumb { return }
        if focusedThumb != nil { blur() }
        focusedThumb = thumb
        if keyboard { keyFocusedThumb = thumb }
        emit("mdFocus", ["thumb": thumb])
    }

    func blur() {
        guard let t = focusedThumb else { return }
        focusedThumb = nil; keyFocusedThumb = nil
        emit("mdBlur", ["thumb": t])
    }
}
