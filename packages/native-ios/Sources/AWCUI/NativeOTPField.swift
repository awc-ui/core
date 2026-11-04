import SwiftUI
import QuartzCore

// md-otp-field: one real native text input per character (SwiftUI on AppKit / UIKit inputs), the source's single
// sanitizing pipeline (strip whitespace → transform → validation-type filter → clamp) for typing, paste, autofill and
// programmatic writes, the contiguous value model, per-cell Tab stops, completion / auto-submit, and form validity.

// MARK: Appearance (the seven --md-otp-field-* hooks)

public struct AWCOTPFieldAppearance: Equatable, Sendable {
    public let cellGap: Double?, cellHeight: Double?, cellShape: Double?, cellWidth: Double?, focusColor: String?, fontSize: Double?, outlineColor: String?
    public init(cellGap: Double? = nil, cellHeight: Double? = nil, cellShape: Double? = nil, cellWidth: Double? = nil, focusColor: String? = nil,
                fontSize: Double? = nil, outlineColor: String? = nil) {
        func l(_ v: Double?) -> Double? { v.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil } }
        self.cellGap = l(cellGap); self.cellHeight = l(cellHeight); self.cellShape = l(cellShape); self.cellWidth = l(cellWidth)
        self.focusColor = awcFieldColor(focusColor); self.fontSize = l(fontSize); self.outlineColor = awcFieldColor(outlineColor)
    }
    public init(values v: [String: AWCValue]) {
        func c(_ k: String) -> String? { (v[k]?.string).flatMap { $0.isEmpty ? nil : $0 } }
        self.init(cellGap: v["cellGap"]?.number, cellHeight: v["cellHeight"]?.number, cellShape: v["cellShape"]?.number, cellWidth: v["cellWidth"]?.number,
                  focusColor: c("focusColor"), fontSize: v["fontSize"]?.number, outlineColor: c("outlineColor"))
    }
    public func merging(_ o: Self) -> Self {
        .init(cellGap: o.cellGap ?? cellGap, cellHeight: o.cellHeight ?? cellHeight, cellShape: o.cellShape ?? cellShape, cellWidth: o.cellWidth ?? cellWidth,
              focusColor: o.focusColor ?? focusColor, fontSize: o.fontSize ?? fontSize, outlineColor: o.outlineColor ?? outlineColor)
    }
}
private struct AWCOTPFieldAppearanceKey: EnvironmentKey { static let defaultValue = AWCOTPFieldAppearance() }
private struct AWCOTPFieldAppearanceTargetsKey: EnvironmentKey { static let defaultValue: [String: AWCOTPFieldAppearance] = [:] }
private struct AWCOTPFieldControllersKey: EnvironmentKey { static let defaultValue: [String: AWCOTPFieldController] = [:] }
extension EnvironmentValues {
    var awcOTPFieldAppearance: AWCOTPFieldAppearance { get { self[AWCOTPFieldAppearanceKey.self] } set { self[AWCOTPFieldAppearanceKey.self] = newValue } }
    var awcOTPFieldAppearanceTargets: [String: AWCOTPFieldAppearance] { get { self[AWCOTPFieldAppearanceTargetsKey.self] } set { self[AWCOTPFieldAppearanceTargetsKey.self] = newValue } }
    var awcOTPFieldControllers: [String: AWCOTPFieldController] { get { self[AWCOTPFieldControllersKey.self] } set { self[AWCOTPFieldControllersKey.self] = newValue } }
}
private struct AWCOTPFieldAppearanceModifier: ViewModifier {
    let value: AWCOTPFieldAppearance, id: String?
    @Environment(\.awcOTPFieldAppearance) private var inherited
    @Environment(\.awcOTPFieldAppearanceTargets) private var targets
    func body(content: Content) -> some View {
        if let id { var t = targets; t[id] = (t[id] ?? .init()).merging(value); return AnyView(content.environment(\.awcOTPFieldAppearanceTargets, t)) }
        return AnyView(content.environment(\.awcOTPFieldAppearance, inherited.merging(value)))
    }
}
private struct AWCOTPFieldControllerModifier: ViewModifier {
    let controller: AWCOTPFieldController, id: String?
    @Environment(\.awcOTPFieldControllers) private var controllers
    func body(content: Content) -> some View { var c = controllers; c[id ?? ""] = controller; return content.environment(\.awcOTPFieldControllers, c) }
}
public extension View {
    /// md-otp-field hook values for descendant OTP fields, or for the one with node id `id`.
    func awcOTPFieldAppearance(_ value: AWCOTPFieldAppearance, for id: String? = nil) -> some View { modifier(AWCOTPFieldAppearanceModifier(value: value, id: id)) }
    /// Attaches `controller` to the OTP field with node id `id` (every descendant OTP field without an id).
    func awcOTPFieldController(_ controller: AWCOTPFieldController, for id: String? = nil) -> some View { modifier(AWCOTPFieldControllerModifier(controller: controller, id: id)) }
}

// MARK: Methods

/// Native counterparts of md-otp-field's methods: setFocus, clear, getValidity, setCustomValidity, checkValidity, reportValidity.
@MainActor public final class AWCOTPFieldController {
    weak var runtime: AWCOTPFieldRuntime?
    public init() {}
    public var isConnected: Bool { runtime != nil }
    /// Focuses the first empty cell (the last cell when the code is complete).
    public func setFocus() { runtime?.focusFirstEmpty() }
    /// Clears the code without mdInput / mdChange (programmatic writes stay silent).
    public func clear() { runtime?.clear() }
    public func getValidity() -> AWCConstraintValidity { runtime?.validity() ?? .validState }
    public func setCustomValidity(_ message: String) { runtime?.customMessage = message }
    public func checkValidity() -> Bool { guard let r = runtime else { return true }; return r.barred() || r.validity().valid }
    /// Like checkValidity(), but an invalid field shows its message in its own error state and takes focus.
    @discardableResult public func reportValidity() -> Bool {
        guard let r = runtime, !r.barred(), !r.validity().valid else { return true }
        r.revealed = true; DispatchQueue.main.async { r.focusFirstEmpty() }; return false
    }
    /// The current code.
    public var value: String { runtime?.value ?? "" }
}

// MARK: Model

struct AWCOTPFieldModel {
    var length = 6.0, validationType = "numeric", transform = "none", mask = false, autoSubmit = false, groupSize = 0.0, inputMode = ""
    var name = "", disabled = false, readOnly = false, required = false, error = false, errorText = "", supportingText = ""
    var label = "One-time code", cellLabelTemplate = "Character {index} of {length}", valueMissingLabel = "Please enter the complete code.", incompleteLabel = ""
    var density: Double? = nil, reserveSupportingSpace = false, hidden = false
    init(properties p: [String: AWCValue]) {
        func s(_ k: String, _ d: String = "") -> String { if case .string(let v)? = p[k] { return v }; if case .number(let n)? = p[k] { return AWCOTPFieldModel.text(n) }; return d }
        func b(_ k: String) -> Bool { switch p[k] { case .bool(let v)?: return v; case .string(let v)?: return v != "false"; default: return false } }
        func n(_ k: String) -> Double? { switch p[k] { case .number(let v)?: return v; case .string(let v)?: return Double(v.trimmingCharacters(in: .whitespaces)); default: return nil } }
        length = n("length") ?? 6
        validationType = ["numeric", "alpha", "alphanumeric", "none"].contains(s("validationType")) ? s("validationType") : "numeric"
        transform = s("transform") == "uppercase" ? "uppercase" : "none"
        mask = b("mask"); autoSubmit = b("autoSubmit"); groupSize = n("groupSize") ?? 0; inputMode = s("inputMode", s("inputmode"))
        name = s("name"); disabled = b("disabled"); readOnly = b("readOnly") || b("readonly"); required = b("required"); error = b("error")
        errorText = s("errorText"); supportingText = s("supportingText")
        label = p["label"] == nil ? "One-time code" : s("label")
        cellLabelTemplate = p["cellLabelTemplate"] == nil ? cellLabelTemplate : s("cellLabelTemplate")
        valueMissingLabel = p["valueMissingLabel"] == nil ? valueMissingLabel : s("valueMissingLabel")
        incompleteLabel = s("incompleteLabel")
        density = n("density").flatMap { [0, -1, -2, -3, -4].contains($0) ? $0 : nil }
        reserveSupportingSpace = b("reserveSupportingSpace"); hidden = b("hidden")
    }
    static func text(_ n: Double) -> String { n == n.rounded() && abs(n) < 1e15 ? String(Int64(n)) : String(n) }
    /// `length` hardened against zero / negative / fractional authoring.
    var cellCount: Int { let v = length.rounded(.down); return v.isFinite && v > 0 ? Int(min(v, 64)) : 1 }
    var group: Int { let g = groupSize.rounded(.down); return g.isFinite && g > 0 ? Int(g) : 0 }
    var effectiveInputMode: String { !inputMode.isEmpty ? inputMode : validationType == "numeric" ? "numeric" : "text" }
    /// The one value pipeline: strip whitespace → transform → validation-type filter → clamp. `rejected`: the filter dropped characters.
    func sanitize(_ raw: String) -> (clean: String, rejected: Bool) {
        let stripped = String(raw.filter { !$0.isWhitespace })
        let transformed = transform == "uppercase" ? stripped.uppercased() : stripped
        let kept: String
        switch validationType {
        case "numeric": kept = String(transformed.filter { $0.isASCII && $0.isNumber })
        case "alpha": kept = String(transformed.filter { $0.isASCII && $0.isLetter })
        case "alphanumeric": kept = String(transformed.filter { $0.isASCII && ($0.isLetter || $0.isNumber) })
        default: kept = transformed
        }
        return (String(kept.prefix(cellCount)), kept.count != transformed.count)
    }
}

// MARK: Runtime

@MainActor @Observable final class AWCOTPFieldRuntime {
    var value = ""
    var focusedIndex: Int?
    var hoverIndex: Int?
    var customMessage = ""
    var revealed = false
    @ObservationIgnored var lastCommitted = ""
    @ObservationIgnored var lastValidityKey: String?
    @ObservationIgnored var lastProp: AWCValue?
    @ObservationIgnored var started = false
    @ObservationIgnored var changeAt: Double?
    /// Cells a key or edit focused since the last render: Chrome restyles on every focus(), so a cell the focus only passed
    /// through still eases out of the focus colour.
    @ObservationIgnored var touched: Set<Int> = []
    @ObservationIgnored var handles: [AWCFieldInputHandle] = []
    @ObservationIgnored var count = 6
    @ObservationIgnored var validity: () -> AWCConstraintValidity = { .validState }
    @ObservationIgnored var barred: () -> Bool = { false }
    @ObservationIgnored var write: (String) -> Void = { _ in }
    func handle(_ i: Int) -> AWCFieldInputHandle { while handles.count <= i { handles.append(AWCFieldInputHandle()) }; return handles[i] }
    func focusCell(_ index: Int) {
        let i = max(0, min(index, count - 1))
        let h = handle(i)
        if h.isFocused() { h.selectAll(); return }
        if h.focus() {
            touched.insert(i)
            if changeAt == nil { changeAt = CACurrentMediaTime() * 1000 }
            focusedIndex = i
        }
        h.selectAll()
    }
    func focusFirstEmpty() { let filled = value.count; focusCell(filled >= count ? count - 1 : filled) }
    func clear() { write(""); lastCommitted = "" }
}

// MARK: Renderer

struct AWCNativeOTPField: View {
    let node: AWCNode, theme: AWCTheme
    let setValue: (AWCValue) -> Void
    let emit: (String, AWCValue) -> Void
    let child: (AWCNode) -> AnyView
    var formMessage: String? = nil
    var formResets = 0
    var formDisabled = false
    var submit: () -> Void = {}
    var requestSubmit: () -> Void = {}
    var validityBox: AWCFieldValidityBox? = nil
    @Environment(\.awcOTPFieldAppearance) private var inheritedAppearance
    @Environment(\.awcOTPFieldAppearanceTargets) private var appearanceTargets
    @Environment(\.awcOTPFieldControllers) private var controllers
    @Environment(\.awcNativeDensity) private var inheritedDensity
    @Environment(\.awcNativePointerState) private var pointer
    @Environment(\.accessibilityReduceMotion) private var systemReduced
    @Environment(\.awcFieldReducedMotion) private var reducedOverride
    @Environment(\.layoutDirection) private var direction
    @State private var rt = AWCOTPFieldRuntime()
    @State private var borders: [AWCCSSColorTrack] = []
    @State private var cellFrames: [Int: CGRect] = [:]
    @State private var primed = false

    private var model: AWCOTPFieldModel { AWCOTPFieldModel(properties: node.properties) }
    private var appearance: AWCOTPFieldAppearance { inheritedAppearance.merging(appearanceTargets[node.id] ?? .init()) }
    private var scale: Double { AWCNativeDensity.resolve(model.density, inherited: inheritedDensity) }
    private var reduced: Bool { reducedOverride ?? systemReduced }
    private var disabled: Bool { model.disabled || formDisabled }
    private var count: Int { model.cellCount }
    private var chars: [String] { let a = Array(rt.value); return (0..<count).map { $0 < a.count ? String(a[$0]) : "" } }

    // Validity (utils/form setValidityState): custom, else required-and-empty or required-and-incomplete (with incompleteLabel).
    private var validity: AWCConstraintValidity {
        let m = model, len = rt.value.count
        if !rt.customMessage.isEmpty { return .init(flag: "customError", message: rt.customMessage) }
        let missing = m.required && len == 0, incomplete = m.required && !m.incompleteLabel.isEmpty && len > 0 && len < count
        if missing || incomplete { return .init(flag: "valueMissing", message: incomplete ? m.incompleteLabel : m.valueMissingLabel) }
        return .validState
    }
    private var validationMessage: String { rt.revealed && !validity.valid ? validity.validationMessage : "" }
    private var hasError: Bool { model.error || !validationMessage.isEmpty }
    private var supportText: String {
        let alt = model.errorText.isEmpty ? validationMessage : model.errorText
        return hasError && !alt.isEmpty ? alt : model.supportingText
    }

    // Tokens and density-tapered metrics (md-otp-field.css §1).
    private func color(_ name: String, _ fallback: String) -> String { awcFieldColor(theme.tokens["--md-sys-color-" + name]) ?? fallback }
    private func length(_ name: String) -> Double? { theme.tokens[name].flatMap { Double($0.replacingOccurrences(of: "px", with: "").trimmingCharacters(in: .whitespaces)) } }
    private var cellWidth: Double { appearance.cellWidth ?? max(32, 48 + scale * 4) }
    private var cellHeight: Double { appearance.cellHeight ?? max(40, 56 + scale * 4) }
    /// --md-sys-spacing-gap-sm per density rung (md3.css section 12): 8, 4 from −3.
    private var cellGap: Double { appearance.cellGap ?? (scale <= -3 ? 4 : length("--md-sys-spacing-gap-sm") ?? 8) }
    private var cellShape: Double { appearance.cellShape ?? length("--md-sys-shape-corner-small") ?? 8 }
    private var fontSize: Double { appearance.fontSize ?? max(16, 24 + scale) }
    private var outline: String { appearance.outlineColor ?? color("outline", "#79747E") }
    private var focusColor: String { appearance.focusColor ?? color("primary", "#6750A4") }
    private var errorColor: String { color("error", "#B3261E") }
    private var onSurface: String { color("on-surface", "#1C1B1F") }
    private var supportColor: String { color("on-surface-variant", "#49454F") }
    private func alpha(_ hex: String, _ a: Double) -> String { String(hex.prefix(7)) + String(format: "%02X", Int((a * 255).rounded())) }
    private var disabledBorder: String { alpha(onSurface, Double(theme.tokens["--md-sys-state-disabled-container-opacity"] ?? "") ?? 0.12) }
    private var disabledContent: String { alpha(onSurface, Double(theme.tokens["--md-sys-state-disabled-content-opacity"] ?? "") ?? 0.38) }
    private var separatorWidth: Double { max(8, 12 + scale) }
    private var dotSize: Double { max(6, 8 + scale * 0.5) }
    private var supportFont: Double { max(10, 12 + scale * 0.5) }
    private var supportLine: Double { max(14, 16 + scale * 0.5) }

    private func hovered(_ i: Int) -> Bool {
        guard !disabled else { return false }
        #if canImport(AppKit)
        if let pointer { return pointer.location.map { cellFrames[i]?.contains($0) ?? false } ?? false }
        #endif
        // iOS: a touch never hovers (the host's pointer state keeps a touch's last location); only a hovering pointer does.
        return rt.hoverIndex == i
    }
    /// The cell's border (colour, width) — resting / hover / focus / error / read-only / disabled (md-otp-field.css §3–6).
    private func border(_ i: Int, focusedOverride: Bool? = nil) -> (String, Double) {
        if disabled { return (disabledBorder, 1) }
        let focused = focusedOverride ?? (rt.focusedIndex == i)
        if hasError { return focused ? (errorColor, 3) : (hovered(i) && !model.readOnly ? color("on-error-container", "#8C1D18") : errorColor, 1) }
        if focused { return (focusColor, 3) }
        return (hovered(i) && !model.readOnly ? onSurface : outline, 1)
    }
    private func textColor() -> String { disabled ? disabledContent : hasError ? errorColor : onSurface }
    private var borderTargets: [String] { (0..<count).map { border($0).0 } }
    private var motion: (Double, [Double]) {
        (awcCSSDuration(theme.tokens["--md-sys-motion-duration-short2"]) ?? 100, awcCSSCubicBezier(theme.tokens["--md-sys-motion-easing-standard"]) ?? [0.2, 0, 0, 1])
    }
    private func applyBorders(_ next: [String]) {
        if borders.count != next.count { borders = next.map { var t = AWCCSSColorTrack(); t.set(Color(awcHex: $0), now: 0, duration: 0, curve: [0, 0, 1, 1]); return t } }
        let current = CACurrentMediaTime() * 1000
        let now = rt.changeAt.map { current - $0 >= 0 && current - $0 < 150 ? $0 : current } ?? current
        rt.changeAt = nil
        let (duration, curve) = motion
        for (i, hex) in next.enumerated() {
            // A cell the focus passed through since the last frame takes the focus colour first (Chrome's style recalc in focus()).
            if primed && !reduced && rt.touched.contains(i) && rt.focusedIndex != i {
                borders[i].set(Color(awcHex: border(i, focusedOverride: true).0), now: now, duration: 0, curve: curve)
            }
            // :focus declares `transition: none`: a cell taking focus snaps; leaving focus or hover eases (border-color 100 ms).
            let snap = !primed || reduced || rt.focusedIndex == i
            borders[i].set(Color(awcHex: hex), now: now, duration: snap ? 0 : duration, curve: curve)
        }
        rt.touched = []
        primed = true
    }
    private func running(_ t: Double) -> Bool { borders.contains { $0.isRunning(t) } }

    var body: some View {
        if model.hidden { EmptyView() } else {
            let now = CACurrentMediaTime() * 1000
            // The paused timeline (reduced motion, no transition running) re-renders its content only when the closure differs: the
            // border tracks, focus and value are captured by value so a snapped border change is drawn at once.
            TimelineView(.animation(paused: !running(now))) { [b = borders, f = rt.focusedIndex, v = rt.value] _ in
                _ = (b.count, f, v); return content(CACurrentMediaTime() * 1000)
            }
                .onChange(of: borderTargets, initial: true) { _, next in applyBorders(next) }
                .onChange(of: validity, initial: true) { _, next in
                    let key = next.key; defer { rt.lastValidityKey = key }
                    if let last = rt.lastValidityKey, last != key { emit("mdValidityChange", next.eventValue) }
                    if rt.revealed && next.valid { rt.revealed = false }
                }
                .onChange(of: node.properties["value"]) { _, v in externalValue(v) }
                .onChange(of: "\(model.length)|\(model.validationType)|\(model.transform)") { _, _ in resanitize() }
                .onChange(of: model.name) { _, _ in rt.revealed = false }
                .onChange(of: formResets) { _, _ in rt.revealed = false; rt.value = ""; rt.lastCommitted = ""; setValue(.string("")) }
                .onChange(of: formMessage) { _, m in if m != nil { rt.revealed = true } }
                .onChange(of: disabled, initial: true) { _, d in if d { rt.revealed = false } }
                .onChange(of: "\(model.required)|\(model.incompleteLabel)|\(model.valueMissingLabel)|\(model.length)|\(disabled)|\(model.readOnly)") { _, _ in installValidity() }
                .onAppear { start() }
        }
    }

    private func start() {
        rt.count = count
        guard !rt.started else { return }
        rt.started = true
        let clean = model.sanitize(node.properties["value"]?.string ?? "").clean
        rt.value = clean; rt.lastCommitted = clean; rt.lastProp = node.properties["value"]
        if clean != (node.properties["value"]?.string ?? "") { setValue(.string(clean)) }
        let r = rt
        installValidity()
        rt.write = { v in r.value = v; setValue(.string(v)) }
        validityBox?.evaluate = { r.validity() }
        (controllers[node.id] ?? controllers[""])?.runtime = rt
    }
    /// The methods' validity and barring follow the current properties.
    private func installValidity() {
        let r = rt, m = model, barred = disabled || m.readOnly
        rt.validity = {
            if !r.customMessage.isEmpty { return .init(flag: "customError", message: r.customMessage) }
            let len = r.value.count, n = m.cellCount
            let incomplete = m.required && !m.incompleteLabel.isEmpty && len > 0 && len < n
            return m.required && len == 0 || incomplete ? .init(flag: "valueMissing", message: incomplete ? m.incompleteLabel : m.valueMissingLabel) : .validState
        }
        rt.barred = { barred }
    }
    private func externalValue(_ v: AWCValue?) {
        guard v != rt.lastProp else { return }
        rt.lastProp = v
        let clean = model.sanitize(v?.string ?? "").clean
        if clean != rt.value { rt.value = clean }
        if clean != (v?.string ?? "") { setValue(.string(clean)) }
    }
    private func resanitize() {
        rt.count = count
        let clean = model.sanitize(rt.value).clean
        if clean != rt.value { rt.value = clean; setValue(.string(clean)) }
    }

    // MARK: Editing (handleInput / handleKeyDown / handlePaste / focusout)

    private func update(_ next: String) -> Bool {
        guard next != rt.value else { return false }
        rt.value = next; setValue(.string(next)); return true
    }
    private func commit() {
        guard rt.value != rt.lastCommitted else { return }
        rt.lastCommitted = rt.value; emit("mdChange", .string(rt.value))
    }
    private func maybeComplete(_ prev: String, force: Bool) {
        guard rt.value.count >= count else { return }
        guard prev.count < count || force else { return }
        commit()
        emit("mdComplete", .object(["value": .string(rt.value)]))
        if model.autoSubmit { requestSubmit() }
    }
    /// Focus moves once the text system has finished the edit in progress (the next keystroke goes to the new cell).
    private func later(_ action: @escaping @MainActor () -> Void) { DispatchQueue.main.async { action() } }
    private func removing(_ prev: String, at i: Int) -> String { var a = Array(prev); a.remove(at: i); return String(a) }
    private func edited(_ i: Int, _ text: String, _ composing: Bool) -> (String, Int)? {
        if composing { return nil }
        let current = chars
        if disabled || model.readOnly { return (current[i], current[i].utf16.count) }
        let m = model, prev = rt.value, had = current[i]
        var raw = text
        // A keystroke into a filled cell whose character is not selected (the caret after it): it replaces the cell.
        if !had.isEmpty, text.count == had.count + 1 {
            let data: String? = text.hasPrefix(had) ? String(text.dropFirst(had.count)) : text.hasSuffix(had) ? String(text.dropLast(had.count)) : nil
            if let data {
                let one = m.sanitize(data).clean
                if let c = one.first {
                    var a = Array(prev); a[i] = c
                    let changed = update(String(a))
                    later { rt.focusCell(min(i + 1, count - 1)) }
                    if changed { emit("mdInput", .string(rt.value)) }
                    maybeComplete(prev, force: false)
                    return (chars[i], chars[i].utf16.count)
                }
                raw = data
            }
        }
        if raw.isEmpty {
            // Native deletion (cut / delete in the menu): Backspace / Delete keys never reach here.
            if i < prev.count { if update(removing(prev, at: i)) { emit("mdInput", .string(rt.value)) } }
            return (chars[i], chars[i].utf16.count)
        }
        let (clean, rejected) = m.sanitize(raw)
        if rejected { emit("mdInvalidInput", .object(["attempted": .string(raw), "reason": .string("input-change")])) }
        guard !clean.isEmpty else { return (current[i], current[i].utf16.count) }
        let next: String, target: Int
        if clean.count >= count { next = String(clean.prefix(count)); target = count - 1 }   // full-code burst (autofill / IME)
        else {
            // Contiguous model: a character typed past the fill point lands in the first empty cell.
            let start = min(i, prev.count)
            var a = Array(prev)
            for (k, c) in clean.enumerated() { if start + k < a.count { a[start + k] = c } else { a.append(c) } }
            next = String(a.prefix(count)); target = min(start + clean.count, count - 1)
        }
        let changed = update(next)
        later { rt.focusCell(target) }
        if changed { emit("mdInput", .string(rt.value)) }
        maybeComplete(prev, force: false)
        return (chars[i], chars[i].utf16.count)
    }
    private func key(_ i: Int, _ key: String) -> Bool {
        guard !disabled else { return false }
        let prev = rt.value
        switch key {
        case "Enter": submit(); return true
        case "Backspace":
            if model.readOnly { return true }
            if !chars[i].isEmpty {
                if update(removing(prev, at: i)) { emit("mdInput", .string(rt.value)) }
            } else if i > 0 {
                let t = i - 1
                rt.focusCell(t)
                if t < prev.count, update(removing(prev, at: t)) { emit("mdInput", .string(rt.value)) }
            }
            return true
        case "Delete":
            if model.readOnly { return true }
            if i < prev.count, update(removing(prev, at: i)) { emit("mdInput", .string(rt.value)) }
            return true
        // The row is LTR in every direction: physical left is the previous cell.
        case "ArrowLeft": rt.focusCell(i - 1); return true
        case "ArrowRight": rt.focusCell(i + 1); return true
        case "Home": rt.focusCell(0); return true
        case "End": rt.focusCell(count - 1); return true
        // Every cell is a Tab stop, in order (the row is LTR): Tab past the last cell leaves the group.
        case "Tab": if i < count - 1 { rt.focusCell(i + 1); return true }; return false
        case "Shift+Tab": if i > 0 { rt.focusCell(i - 1); return true }; return false
        default: return false
        }
    }
    private func paste(_ i: Int, _ text: String) -> Bool {
        guard !disabled, !model.readOnly else { return true }
        let prev = rt.value
        let (clean, rejected) = model.sanitize(text)
        if rejected { emit("mdInvalidInput", .object(["attempted": .string(text), "reason": .string("input-paste")])) }
        guard !clean.isEmpty else { return true }
        // Whole-value replace from cell 0, whichever cell was pasted into; a complete paste always announces completion.
        let changed = update(clean)
        later { rt.focusCell(min(clean.count, count - 1)) }
        if changed { emit("mdInput", .string(rt.value)) }
        maybeComplete(prev, force: true)
        return true
    }
    private func focusChanged(_ i: Int, _ f: Bool) {
        if f {
            rt.focusedIndex = i
            // Select-on-focus: a keystroke replaces the cell's character.
            DispatchQueue.main.async { [rt] in if rt.focusedIndex == i { rt.handle(i).selectAll() } }
        } else {
            if rt.focusedIndex == i { rt.focusedIndex = nil }
            // Commit when focus leaves the whole group (not when it moves to another cell).
            DispatchQueue.main.async { [rt] in if rt.focusedIndex == nil { commit() } }
        }
    }

    // MARK: Layout

    private func lineHeight(_ font: Double) -> Double { (font * (AWCFieldMetrics.ascent + AWCFieldMetrics.descent)).rounded(.up) + 2 }
    private func inputConfig(_ i: Int) -> AWCFieldInputConfig {
        let m = model
        var c = AWCFieldInputConfig()
        c.text = chars[i]; c.secure = m.mask; c.fontSize = fontSize; c.lineHeight = lineHeight(fontSize); c.tracking = 0
        c.color = textColor(); c.caret = disabled ? disabledContent : hasError ? errorColor : focusColor
        c.centered = true; c.editable = !m.readOnly; c.enabled = !disabled
        c.type = m.mask ? "password" : "text"; c.inputMode = m.effectiveInputMode; c.autocomplete = i == 0 ? "one-time-code" : "off"; c.spellcheck = false
        c.accessibilityLabel = m.cellLabelTemplate.replacingOccurrences(of: "{index}", with: "\(i + 1)").replacingOccurrences(of: "{length}", with: "\(count)")
        c.accessibilityHint = supportText
        c.invalid = hasError; c.required = i == 0 && m.required
        c.editingKeys = true
        // macOS reports the bordered cell as the textbox frame (Chrome: the input is the 48 × 56 cell).
        c.axOutset = CGSize(width: 3, height: max(0, (cellHeight - lineHeight(fontSize)) / 2))
        return c
    }
    private func events(_ i: Int) -> AWCFieldInputEvents {
        var e = AWCFieldInputEvents()
        e.edited = { text, _, composing in edited(i, text, composing) }
        e.focusChanged = { focusChanged(i, $0) }
        e.focusMark = { [rt] in rt.changeAt = CACurrentMediaTime() * 1000 }
        e.command = { k, composing in composing ? false : key(i, k) }
        e.paste = { text in paste(i, text) }
        return e
    }
    private func cell(_ i: Int, _ t: Double) -> some View {
        let (target, width) = border(i)
        let presented = i < borders.count ? (borders[i].presented(t) ?? Color(awcHex: target)) : Color(awcHex: target)
        let line = lineHeight(fontSize)
        return ZStack {
            RoundedRectangle(cornerRadius: cellShape, style: .circular).strokeBorder(presented, lineWidth: width)
            AWCFieldTextInput(config: inputConfig(i), events: events(i), handle: rt.handle(i))
                .frame(width: max(0, cellWidth - 6), height: line)
        }
        .frame(width: cellWidth, height: cellHeight)
        .contentShape(Rectangle())
        .onContinuousHover { phase in if case .active = phase { rt.hoverIndex = i } else if rt.hoverIndex == i { rt.hoverIndex = nil } }
        .onGeometryChange(for: CGRect.self) { $0.frame(in: .named("awc-native-preview")) } action: { cellFrames[i] = $0 }
        .awcInspect(nodeID: node.id, part: "cell-\(i)", name: "cell-\(i)") { _ in
            ["border": .string(awcOTPHex(presented)), "borderWidth": .number(width), "text": .string(chars[i]), "color": .string(textColor()),
             "focused": .bool(rt.focusedIndex == i), "secure": .bool(model.mask), "fontSize": .number(fontSize)]
        }
    }
    @ViewBuilder private func separator(_ k: Int) -> some View {
        // The separator slot fills the first gap; later gaps keep the built-in dot.
        let slotted = k == 0 ? node.children(inSlot: "separator") : []
        Group {
            if slotted.isEmpty {
                Circle().fill(Color(awcHex: disabled ? disabledBorder : outline)).frame(width: dotSize, height: dotSize)
            } else { HStack(spacing: 0) { ForEach(slotted) { child($0) } }.font(AWCNativeFonts.label(size: 16, regular: true)).foregroundStyle(Color(awcHex: supportColor)) }
        }
        .frame(minWidth: separatorWidth)
        .accessibilityHidden(true)
        .awcInspect(nodeID: node.id, part: "separator-\(k)", name: "separator-\(k)")
    }
    private func row(_ t: Double) -> some View {
        let g = model.group
        return HStack(spacing: cellGap) {
            ForEach(0..<count, id: \.self) { i in
                if g > 0 && i > 0 && i % g == 0 { separator(i / g - 1) }
                cell(i, t)
            }
        }
        // Codes read left to right in RTL locales too: the row is pinned LTR.
        .environment(\.layoutDirection, .leftToRight)
        .accessibilityElement(children: .contain)
        .accessibilityLabel(model.label)
        .modifier(AWCOTPGroupEnabled())
        .awcInspect(nodeID: node.id, part: "cells", name: "cells")
    }
    private func content(_ t: Double) -> some View {
        let text = supportText, show = !text.isEmpty || model.reserveSupportingSpace
        return VStack(alignment: .leading, spacing: 0) {
            row(t)
            if show {
                // The support row's line is the host's 16px strut (line-height normal: 19); the 12px text sits on its baseline.
                let color = disabled ? disabledContent : hasError ? errorColor : supportColor
                Text(text.isEmpty ? "\u{200B}" : text)
                    .font(AWCNativeFonts.label(size: supportFont, regular: true))
                    .foregroundStyle(Color(awcHex: color))
                    .fixedSize()
                    // CSS line-height normal: the rounded ascent plus the rounded descent (UIKit's line height rounds up).
                    .frame(height: (supportFont * AWCFieldMetrics.ascent).rounded() + (supportFont * AWCFieldMetrics.descent).rounded(), alignment: .top)
                    .awcInspect(nodeID: node.id, part: "supporting-text", name: "supporting-text") { _ in
                        ["text": .string(text), "role": .string(hasError && !text.isEmpty ? "alert" : ""), "color": .string(color)]
                    }
                    .padding(.top, (16 * AWCFieldMetrics.ascent).rounded() - supportFont * AWCFieldMetrics.ascent)
                    .frame(height: (16 * AWCFieldMetrics.ascent).rounded() + (16 * AWCFieldMetrics.descent).rounded(), alignment: .topLeading)
                    .padding(.top, 4).padding(.horizontal, 4)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .fixedSize()
        .allowsHitTesting(!disabled)
        .awcInspect(nodeID: node.id, name: "md-otp-field") { _ in
            ["value": .string(rt.value), "focused": .bool(rt.focusedIndex != nil), "focusedIndex": rt.focusedIndex.map { .number(Double($0)) } ?? .null,
             "validationMessage": .string(validationMessage), "valid": .bool(validity.valid), "error": .bool(hasError)]
        }
    }
}

/// #RRGGBBAA of a presented colour (inspection).
func awcOTPHex(_ c: Color) -> String {
    let r = c.resolve(in: EnvironmentValues())
    func h(_ v: Float) -> String { String(format: "%02X", Int((max(0, min(1, v)) * 255).rounded())) }
    return "#" + h(r.red) + h(r.green) + h(r.blue) + h(r.opacity)
}

extension AWCNativeView {
    var nativeOTPField: some View {
        AWCNativeOTPField(node: node, theme: theme, setValue: { v in set("value", v) }, emit: { emit($0, $1) },
                          child: { n in child(n, handler: { _ in }) },
                          formMessage: registeredForm?.validationMessages[formRegistrationID], formResets: registeredForm?.resetCount ?? 0,
                          submit: { submitFromNativeText() }, requestSubmit: { _ = resolvedForm?.submit(dispatcher: eventDispatcher, observe: onEvent) },
                          validityBox: fieldValidityBox)
    }
}

/// The host's `.disabled` would mark the cells' AXGroup disabled on macOS; Web's role=group has no disabled state (each
/// input is disabled). The cells keep their own enabled state (AppKit controls), so the group is re-enabled for AX only.
private struct AWCOTPGroupEnabled: ViewModifier {
    func body(content: Content) -> some View {
        #if canImport(AppKit)
        content.environment(\.isEnabled, true)
        #else
        content
        #endif
    }
}
