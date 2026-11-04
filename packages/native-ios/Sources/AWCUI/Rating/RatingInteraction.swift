import Foundation

// md-rating's value model and interaction, platform-neutral (md-rating.tsx): hover preview with half steps, click to
// set / click the current value to reset to `default-value`, the keyboard (reading-direction arrows, Home / End,
// digits), the readonly / disabled / soft-disabled gates, value labels and the item fill. Lockstep port of
// RatingInteraction.kt (replayed against the Web oracle in CI).

/// md-rating's host properties as the component reads them (one render's worth).
struct AWCRatingProps: Equatable {
    var value = 0.0, defaultValue = 0.0, max = 5, precision = 1.0
    var readonly = false, disabled = false, softDisabled = false, hover = "preview", rtl = false
}

final class AWCRatingInteraction {
    private(set) var value = 0.0
    var defaultValue = 0.0
    var max = 5
    var precision = 1.0
    var readonly = false
    var disabled = false
    var softDisabled = false
    var hover = "preview"
    var rtl = false
    var getLabel: ((Double) -> String)? = nil
    var onEvent: (String, Double?) -> Void = { _, _ in }
    var onPropWrite: (Double) -> Void = { _ in }

    private(set) var hoveredValue: Double? = nil
    private(set) var focused = false
    /// Keyboard focus (`:focus-visible`): a press focuses the slider without the ring.
    private(set) var focusVisible = false

    var isInteractive: Bool { !readonly && !disabled && !softDisabled }
    var displayValue: Double { hoveredValue != nil && hover == "preview" ? hoveredValue! : value }
    /// Focusable unless disabled (tabindex -1) or readonly (no tabindex).
    var focusable: Bool { !disabled && !readonly }

    /// The host set `value` (validateValue: NaN → 0, clamped to [0, max]).
    func setValueProp(_ v: Double) { value = v.isNaN ? 0 : Swift.min(Double(max), Swift.max(0, v)) }
    private func write(_ v: Double) { setValueProp(v); onPropWrite(value) }

    private var synced: AWCRatingProps? = nil
    /// The host's properties → the component, as Stencil applies them: plain props every render; @Watch('value')
    /// (validateValue: NaN → 0, clamped to [0, max], the clamp written back to the prop) runs at load and when the value
    /// prop changed; @Watch('max') re-clamps a value above the new max.
    func sync(_ p: AWCRatingProps) {
        let prev = synced; synced = p
        max = p.max; precision = p.precision; defaultValue = p.defaultValue; readonly = p.readonly; disabled = p.disabled
        softDisabled = p.softDisabled; hover = p.hover; rtl = p.rtl
        if prev == nil || p.value != prev!.value { setValueProp(p.value); if value != p.value { onPropWrite(value) } }
        if let prev, p.max != prev.max, value > Double(max) { write(Double(max)) }
    }

    func label(_ v: Double) -> String {
        if let f = getLabel { return f(v) }
        if v == 0 { return "Empty" }
        if v == 1 { return "1 Star" }
        return "\(awcSRJSNumberString(v)) Stars"
    }

    func fill(_ i: Int) -> Double { Swift.max(0, Swift.min(1, displayValue - Double(i))) }
    func itemState(_ i: Int) -> String { let p = fill(i); return p >= 1 ? "full" : p > 0 ? "half" : "empty" }

    /// The widest-label sizers (one per step 0…max).
    func labelVariants() -> [String] {
        let step = precision == 0 ? 1 : precision
        var out: [String] = [], seen = Set<String>()
        var v = 0.0
        while v <= Double(max) + 1e-9 {
            let l = label(Swift.min(awcSRJSRound(v / step) * step, Double(max)))
            if seen.insert(l).inserted { out.append(l) }
            v += step
        }
        return out
    }

    /// computeValueFromPointer: `fx` = the pointer's fraction across item i from its left edge.
    func valueAt(_ i: Int, _ fx: Double) -> Double {
        if precision == 1 { return Double(i + 1) }
        let ratio = rtl ? 1 - fx : fx
        return Double(i) + (ratio <= 0.5 ? 0.5 : 1)
    }

    func pointerMove(_ i: Int, _ fx: Double) {
        guard isInteractive, hover != "off" else { return }
        let next = valueAt(i, fx)
        if next != hoveredValue { hoveredValue = next; onEvent("mdHover", next) }
    }

    /// A press on an item focuses the rating (the browser focuses the slider container); the view runs the glyph ripple.
    func pointerDown() { if focusable && !focused { focus(keyboard: false) } }

    /// A touch tap (Chrome): after pointerdown/up the synthesized mousedown focuses the rating without :focus-visible, then click.
    func tap(_ i: Int, _ fx: Double) {
        if focusable && !focused { focus(keyboard: false) }
        click(i, fx)
    }

    func pointerLeave() {
        guard isInteractive, hoveredValue != nil else { return }
        hoveredValue = nil
        onEvent("mdHover", nil)
    }

    func click(_ i: Int, _ fx: Double) {
        guard isInteractive else { return }
        var next = valueAt(i, fx)
        if next == value { next = defaultValue }
        write(next)
        onEvent("mdChange", next)
    }

    @discardableResult func keyDown(_ key: String) -> Bool {
        if focused { focusVisible = true }   // a key press makes the focused element :focus-visible
        guard isInteractive else { return false }
        let step = precision
        var next: Double
        switch key {
        case "ArrowRight": next = rtl ? value - step : value + step
        case "ArrowLeft": next = rtl ? value + step : value - step
        case "ArrowUp": next = value + step
        case "ArrowDown": next = value - step
        case "Home": next = 0
        case "End": next = Double(max)
        default:
            guard key.count == 1, let d = Int(key) else { return false }
            next = d <= max ? Double(d) : value
        }
        next = Swift.max(0, Swift.min(Double(max), next))
        if next != value { write(next); onEvent("mdChange", next) }
        return true
    }

    func focus(keyboard: Bool = true) { focused = true; focusVisible = keyboard }
    func blur() {
        focused = false; focusVisible = false
        if hoveredValue != nil { hoveredValue = nil; onEvent("mdHover", nil) }
    }
}
