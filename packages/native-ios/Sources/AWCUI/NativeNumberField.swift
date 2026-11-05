import SwiftUI
#if canImport(AppKit)
import AppKit
#else
import UIKit
#endif

// md-number-field: the source composes md-text-field (the input, label, supporting row) with md-icon-button steppers
// (inline in the trailing slot, or tonal circles split around the field). Intl display/parse via AWCNumberIntl.

/// The five md-number-field hooks (`--md-number-field-*`); the md-text-field hooks pass through to the inner field.
public struct AWCNumberFieldAppearance: Equatable, Sendable {
    public let width: Double?, minWidth: Double?, stepperIconSize: Double?, stepperColor: String?, splitStepperSize: Double?
    public init(width: Double? = nil, minWidth: Double? = nil, stepperIconSize: Double? = nil, stepperColor: String? = nil, splitStepperSize: Double? = nil) {
        func l(_ v: Double?) -> Double? { v.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil } }
        self.width = l(width); self.minWidth = l(minWidth); self.stepperIconSize = l(stepperIconSize)
        self.stepperColor = awcFieldColor(stepperColor); self.splitStepperSize = l(splitStepperSize)
    }
    public init(values v: [String: AWCValue]) {
        self.init(width: v["width"]?.number, minWidth: v["minWidth"]?.number, stepperIconSize: v["stepperIconSize"]?.number,
                  stepperColor: (v["stepperColor"]?.string).flatMap { $0.isEmpty ? nil : $0 }, splitStepperSize: v["splitStepperSize"]?.number)
    }
    public func merging(_ o: Self) -> Self {
        .init(width: o.width ?? width, minWidth: o.minWidth ?? minWidth, stepperIconSize: o.stepperIconSize ?? stepperIconSize,
              stepperColor: o.stepperColor ?? stepperColor, splitStepperSize: o.splitStepperSize ?? splitStepperSize)
    }
}
private struct AWCNumberFieldAppearanceKey: EnvironmentKey { static let defaultValue = AWCNumberFieldAppearance() }
private struct AWCNumberFieldAppearanceTargetsKey: EnvironmentKey { static let defaultValue: [String: AWCNumberFieldAppearance] = [:] }
private struct AWCNumberFieldControllersKey: EnvironmentKey { static let defaultValue: [String: AWCNumberFieldController] = [:] }
extension EnvironmentValues {
    var awcNumberFieldAppearance: AWCNumberFieldAppearance { get { self[AWCNumberFieldAppearanceKey.self] } set { self[AWCNumberFieldAppearanceKey.self] = newValue } }
    var awcNumberFieldAppearanceTargets: [String: AWCNumberFieldAppearance] { get { self[AWCNumberFieldAppearanceTargetsKey.self] } set { self[AWCNumberFieldAppearanceTargetsKey.self] = newValue } }
    var awcNumberFieldControllers: [String: AWCNumberFieldController] { get { self[AWCNumberFieldControllersKey.self] } set { self[AWCNumberFieldControllersKey.self] = newValue } }
}
private struct AWCNumberFieldAppearanceModifier: ViewModifier {
    let value: AWCNumberFieldAppearance, id: String?
    @Environment(\.awcNumberFieldAppearance) private var inherited
    @Environment(\.awcNumberFieldAppearanceTargets) private var targets
    func body(content: Content) -> some View {
        if let id { var t = targets; t[id] = (t[id] ?? .init()).merging(value); return AnyView(content.environment(\.awcNumberFieldAppearanceTargets, t)) }
        return AnyView(content.environment(\.awcNumberFieldAppearance, inherited.merging(value)))
    }
}
private struct AWCNumberFieldControllerModifier: ViewModifier {
    let controller: AWCNumberFieldController, id: String?
    @Environment(\.awcNumberFieldControllers) private var controllers
    func body(content: Content) -> some View { var c = controllers; c[id ?? ""] = controller; return content.environment(\.awcNumberFieldControllers, c) }
}
public extension View {
    /// md-number-field hook values for descendant number fields, or for the one with node id `id`.
    func awcNumberFieldAppearance(_ value: AWCNumberFieldAppearance, for id: String? = nil) -> some View { modifier(AWCNumberFieldAppearanceModifier(value: value, id: id)) }
    /// Attaches `controller` to the number field with node id `id` (every descendant number field without an id).
    func awcNumberFieldController(_ controller: AWCNumberFieldController, for id: String? = nil) -> some View { modifier(AWCNumberFieldControllerModifier(controller: controller, id: id)) }
}

/// Native counterparts of md-number-field's methods: setFocus, select, stepUp, stepDown, getValidity, checkValidity,
/// reportValidity, setCustomValidity.
@MainActor public final class AWCNumberFieldController {
    weak var runtime: AWCNumberFieldRuntime?
    let field = AWCTextFieldController()
    public init() {}
    public var isConnected: Bool { runtime != nil }
    @discardableResult public func setFocus() -> Bool { field.setFocus() }
    public func select() { field.select() }
    public func stepUp(_ times: Double = 1) { runtime?.step(1, times) }
    public func stepDown(_ times: Double = 1) { runtime?.step(-1, times) }
    public func getValidity() -> AWCConstraintValidity { runtime?.validity().constraint ?? .validState }
    public func checkValidity() -> Bool { guard let r = runtime else { return true }; return r.barred() || r.validity().valid }
    @discardableResult public func reportValidity() -> Bool {
        guard let r = runtime, !r.barred(), !r.validity().valid else { return true }
        r.revealed = true; DispatchQueue.main.async { [field] in _ = field.setFocus() }; return false
    }
    public func setCustomValidity(_ message: String) { runtime?.customMessage = message }
    /// The raw value (nil = empty) and the display text.
    public var value: Double? { runtime?.value }
    public var formattedValue: String { runtime?.inputValue ?? "" }
}

@MainActor @Observable final class AWCNumberFieldRuntime {
    var inputValue = ""
    var value: Double?
    var focused = false
    var revealed = false
    var customMessage = ""
    var stepperPressed: Int? = nil
    @ObservationIgnored var lastCommitted: Double?
    @ObservationIgnored var defaultValue: Double?
    @ObservationIgnored var lastProp: AWCValue?
    @ObservationIgnored var lastValidityKey: String?
    @ObservationIgnored var started = false
    @ObservationIgnored var holdTimer: Timer?
    @ObservationIgnored var holdDir = 1.0
    @ObservationIgnored var step: (Double, Double) -> Void = { _, _ in }
    @ObservationIgnored var validity: () -> AWCNumberFieldValidity = { .init(custom: "", required: false, empty: false, missingMessage: "") }
    @ObservationIgnored var barred: () -> Bool = { false }
    /// A mouse press focused the input (beginHold): the release hands focus back to it, even when the hold already ended at a bound.
    @ObservationIgnored var pressFocused = false
    func endHold() { holdTimer?.invalidate(); holdTimer = nil; stepperPressed = nil }
}

struct AWCNativeNumberField: View {
    let node: AWCNode, theme: AWCTheme
    let setValue: (AWCValue) -> Void
    let emit: (String, AWCValue) -> Void
    let child: (AWCNode, @escaping (AWCEvent) -> Void) -> AnyView
    var formMessage: String? = nil
    var formResets = 0
    var formDisabled = false
    var submit: () -> Void = {}
    var validityBox: AWCFieldValidityBox? = nil
    @Environment(\.awcNumberFieldAppearance) private var inheritedAppearance
    @Environment(\.awcNumberFieldAppearanceTargets) private var appearanceTargets
    @Environment(\.awcNumberFieldControllers) private var controllers
    @Environment(\.awcTextFieldAppearance) private var fieldAppearance
    @Environment(\.awcTextFieldAppearanceTargets) private var fieldTargets
    @Environment(\.awcNativeDensity) private var inheritedDensity
    @State private var rt = AWCNumberFieldRuntime()

    private var model: AWCNumberFieldModel { AWCNumberFieldModel(properties: node.properties) }
    private var appearance: AWCNumberFieldAppearance { inheritedAppearance.merging(appearanceTargets[node.id] ?? .init()) }
    private var intl: AWCNumberIntl { .shared }
    private var disabled: Bool { model.disabled || formDisabled }
    private var scale: Double { AWCNativeDensity.resolve(model.density, inherited: inheritedDensity) }
    private var validity: AWCNumberFieldValidity {
        AWCNumberFieldValidity(custom: rt.customMessage, required: model.required, empty: rt.value == nil, missingMessage: model.errorText.isEmpty ? model.valueMissingLabel : model.errorText)
    }
    private var validationMessage: String { rt.revealed && !validity.valid ? validity.message : "" }
    private var controller: AWCNumberFieldController? { controllers[node.id] ?? controllers[""] }
    /// `numeric` when negatives are impossible and neither step nor format implies decimals, else `decimal`.
    private var inputMode: String {
        let fractional = model.stepAmount != model.stepAmount.rounded() || intl.fractionalFormat(model)
        if let min = model.min, min >= 0, !fractional { return "numeric" }
        return "decimal"
    }
    // Density-tapered metrics (md-number-field.css §1).
    private var stepperIcon: Double { appearance.stepperIconSize ?? max(14, 20 + scale) }
    private var inlineStepper: Double { max(20, 28 + scale * 2) }
    private var splitStepper: Double { appearance.splitStepperSize ?? max(32, 40 + scale * 4) }
    private var fieldBox: Double { max(40, 56 + scale * 4) }
    // Spacing tokens per density rung (md3.css section 12): inset-sm 8 → 4 from −3, gap-sm 8 → 4 from −3, gap-xs 4 → 2 at −4.
    private var insetSm: Double { scale <= -3 ? 4 : 8 }
    private var gapSm: Double { scale <= -3 ? 4 : 8 }
    private var gapXs: Double { scale <= -4 ? 2 : 4 }
    private var stepperColor: String { appearance.stepperColor ?? theme.tokens["--md-sys-color-on-surface-variant"].flatMap(awcFieldColor) ?? "#49454F" }

    var body: some View {
        if model.hidden { EmptyView() } else { observed(model) }
    }
    private func arranged(_ m: AWCNumberFieldModel) -> some View {
        Group {
            if m.split {
                HStack(alignment: .top, spacing: gapSm) {
                    stepper(-1, m).padding(.top, (fieldBox - splitStepper) / 2)
                    field(m).frame(minWidth: 0, maxWidth: .infinity)
                    stepper(1, m).padding(.top, (fieldBox - splitStepper) / 2)
                }
            } else { field(m) }
        }
    }
    private func sized(_ m: AWCNumberFieldModel) -> some View {
        let minWidth: Double = appearance.minWidth ?? 200
        let width: Double? = appearance.width.map { max($0, minWidth) }
        return arranged(m)
            .frame(minWidth: minWidth, maxWidth: appearance.width ?? .infinity, alignment: .leading)
            .frame(width: width.map { CGFloat($0) })
    }
    private var hostMetrics: [String: AWCValue] {
        var out: [String: AWCValue] = ["formattedValue": .string(rt.inputValue), "focused": .bool(rt.focused), "validationMessage": .string(validationMessage)]
        out["value"] = rt.value.map(AWCValue.number) ?? .null; out["valid"] = .bool(validity.valid); out["inputMode"] = .string(inputMode)
        return out
    }
    private func inspected(_ m: AWCNumberFieldModel) -> some View {
        let metrics = hostMetrics
        return sized(m).awcInspect(nodeID: node.id, name: "md-number-field") { _ in metrics }
    }
    private func lifecycle(_ m: AWCNumberFieldModel) -> some View {
        let formatKey: String = m.locale + "|" + m.formatJSON
        return inspected(m)
            .onAppear { start() }
            .onDisappear { rt.endHold() }
            .onChange(of: node.properties["value"]) { _, v in externalValue(v) }
            .onChange(of: formatKey) { _, _ in rt.inputValue = intl.format(rt.value, model) }
    }
    private func observed(_ m: AWCNumberFieldModel) -> some View {
        let v: AWCNumberFieldValidity = validity
        let view = lifecycle(m)
            .onChange(of: v, initial: true) { _, next in validityChanged(next) }
            .onChange(of: m.name) { _, _ in rt.revealed = false }
            .onChange(of: formResets) { _, _ in formReset() }
            .onChange(of: formMessage) { _, msg in if msg != nil { rt.revealed = true } }
            .onChange(of: disabled) { _, d in if d { rt.revealed = false } }
            .onChange(of: "\(m.required)|\(m.errorText)|\(m.valueMissingLabel)|\(disabled)|\(m.readOnly)") { _, _ in installValidity() }
        #if canImport(AppKit)
        let active: Bool = m.allowWheelScrub && !disabled && !m.readOnly && rt.focused
        return view.background(AWCNumberWheelMonitor(active: active) { dir, shift, alt in wheelStep(dir, shift, alt) })
        #else
        return view
        #endif
    }
    private func validityChanged(_ v: AWCNumberFieldValidity) {
        let key = v.key; defer { rt.lastValidityKey = key }
        if let last = rt.lastValidityKey, last != key { emit("mdValidityChange", v.constraint.eventValue) }
    }
    private func wheelStep(_ dir: Double, _ shift: Bool, _ alt: Bool) {
        let mm = model
        doStep(dir, shift ? mm.largeStep : alt ? mm.smallStep : mm.stepAmount, nearest: alt, reason: "wheel")
    }

    // MARK: Composition

    private func field(_ m: AWCNumberFieldModel) -> some View {
        let message: String = validationMessage
        var p: [String: AWCValue] = [:]
        p["variant"] = .string(m.variant); p["label"] = .string(m.label); p["placeholder"] = .string(m.placeholder)
        p["disabled"] = .bool(disabled); p["readOnly"] = .bool(m.readOnly); p["required"] = .bool(m.required)
        p["error"] = .bool(m.error || !message.isEmpty); p["errorText"] = .string(m.errorText.isEmpty ? message : m.errorText)
        p["supportingText"] = .string(m.supportingText); p["reserveSupportingSpace"] = .bool(m.reserveSupportingSpace)
        p["inputMode"] = .string(inputMode); p["autocomplete"] = .string("off"); p["spellcheck"] = .bool(false)
        if let d = m.density { p["density"] = .number(d) }
        if !m.ariaLabel.isEmpty { p["aria-label"] = .string(m.ariaLabel) }
        let inner = AWCNode(id: node.id, tag: "md-text-field", properties: p)
        var hooks = AWCFieldHooks()
        hooks.controller = controller?.field ?? fallbackField
        hooks.accept = { old, new in accept(old, new) }
        hooks.key = { key, composing in fieldKey(key, composing) }
        hooks.focus = { f in focusChanged(f) }
        if m.inline { hooks.trailing = AnyView(HStack(spacing: gapXs) { stepper(-1, m); stepper(1, m) }) }
        // :host(.md-number-field--inline) sets --md-text-field-padding-inline-end: 8px; the host's own (targeted) hook still wins.
        let ownPadding = m.inline && fieldTargets[node.id]?.paddingInlineEnd == nil ? AWCTextFieldAppearance(paddingInlineEnd: insetSm) : AWCTextFieldAppearance()
        return AWCNativeTextField(node: inner, theme: theme, value: rt.inputValue, setValue: { raw in fieldInput(raw) }, emit: { _, _ in },
                                  leading: [], trailing: [], chips: [], clearIcon: [], passwordIcon: [], speechIcon: [], errorIcon: [],
                                  child: { child($0, { _ in }) }, formMessage: nil, formResets: formResets, formDisabled: formDisabled,
                                  submit: {}, validityBox: nil, hooks: hooks)
            .awcTextFieldAppearance(ownPadding)
            .awcInspect(nodeID: node.id, part: "field", name: "field")
    }
    @State private var fallbackField = AWCTextFieldController()

    private func stepper(_ dir: Int, _ m: AWCNumberFieldModel) -> some View {
        let kind = dir > 0 ? "increment" : "decrement"
        let size = m.inline ? inlineStepper : splitStepper
        let off = disabled || m.readOnly || atBound(Double(dir))
        var props: [String: AWCValue] = [:]
        props["variant"] = .string(m.inline ? "standard" : "tonal"); props["icon"] = .string(dir > 0 ? "add" : "remove")
        props["aria-label"] = .string(dir > 0 ? m.incrementLabel : m.decrementLabel); props["disabled"] = .bool(off); props["groupTabindex"] = .number(-1)
        let look = AWCIconButtonAppearance(iconColor: stepperColor, iconSize: stepperIcon, width: size, height: size)
        let press = DragGesture(minimumDistance: 0, coordinateSpace: .local)
            .onChanged { g in pressChanged(g, dir: Double(dir), size: size) }
            .onEnded { _ in
                let pressed = rt.pressFocused
                rt.pressFocused = false
                rt.endHold()
                #if canImport(AppKit)
                // The source prevents the press's default (focus stays in the input): the stepper button must not keep it.
                if pressed { DispatchQueue.main.async { [field = controller?.field ?? fallbackField] in _ = field.setFocus() } }
                #endif
            }
        let metrics: [String: AWCValue] = ["disabled": .bool(off)]
        return child(AWCNode(id: "\(node.id)-\(kind)", tag: "md-icon-button", properties: props), { _ in })
            .awcIconButtonAppearance(look)
            .simultaneousGesture(press)
            .awcInspect(nodeID: node.id, part: kind, name: kind) { _ in metrics }
    }
    private func pressChanged(_ g: DragGesture.Value, dir: Double, size: Double) {
        let inside = CGRect(x: 0, y: 0, width: size, height: size).contains(g.location)
        if rt.stepperPressed == nil && g.translation == .zero { beginHold(dir) }
        else if !inside { rt.endHold() }   // pointerleave ends the hold
    }

    // MARK: Lifecycle

    private func start() {
        guard !rt.started else { return }
        rt.started = true
        let v = AWCNumberFieldModel.number(node.properties["value"])
        rt.value = v; rt.defaultValue = v; rt.lastCommitted = v; rt.lastProp = node.properties["value"]
        rt.inputValue = intl.format(v, model)
        let r = rt
        rt.step = { dir, times in doStep(dir, model.stepAmount * max(1, times), nearest: false, reason: "none") }
        installValidity()
        validityBox?.evaluate = { r.validity().constraint }
        controller?.runtime = rt
        syncForm()
    }
    /// The methods' validity and barring follow the current properties (required, labels, disabled, read-only).
    private func installValidity() {
        let r = rt, m = model, barred = disabled || m.readOnly
        rt.validity = { AWCNumberFieldValidity(custom: r.customMessage, required: m.required, empty: r.value == nil,
                                               missingMessage: m.errorText.isEmpty ? m.valueMissingLabel : m.errorText) }
        rt.barred = { barred }
    }
    private func externalValue(_ v: AWCValue?) {
        guard v != rt.lastProp else { return }
        rt.lastProp = v
        let n = AWCNumberFieldModel.number(v)
        // A programmatic write is a committed fact, not a pending edit.
        rt.value = n; rt.lastCommitted = n
        let formatted = intl.format(n, model); if rt.inputValue != formatted { rt.inputValue = formatted }
        syncForm()
    }
    private func formReset() {
        rt.revealed = false; rt.customMessage = ""
        rt.value = rt.defaultValue; rt.inputValue = intl.format(rt.value, model); rt.lastCommitted = rt.value
        syncForm()
    }
    private func syncForm() { setValue(rt.value.map(AWCValue.number) ?? .null) }
    private func write(_ v: Double?) { rt.value = v; syncForm() }

    // MARK: Stepping (doStep / setAndCommit / commitTyped)

    private func clamp(_ x: Double) -> Double { var n = x; if let lo = model.min, n < lo { n = lo }; if let hi = model.max, n > hi { n = hi }; return n }
    private func snap(_ candidate: Double, _ amount: Double, _ dir: Double, nearest: Bool) -> Double {
        let base = model.min ?? 0, offset = candidate - base, eps = amount * 1e-10
        let units = nearest ? (offset / amount).rounded(.toNearestOrAwayFromZero) : dir > 0 ? (offset / amount + eps).rounded(.down) : (offset / amount - eps).rounded(.up)
        return intl.cleanFloat(base + units * amount)
    }
    private func atBound(_ dir: Double) -> Bool {
        guard let v = rt.value else { return false }
        return dir > 0 ? (model.max.map { v >= $0 } ?? false) : (model.min.map { v <= $0 } ?? false)
    }
    private func detail(_ reason: String) -> AWCValue {
        .object(["value": rt.value.map(AWCValue.number) ?? .null, "formattedValue": .string(rt.inputValue), "reason": .string(reason)])
    }
    private func commit(_ next: Double?, _ reason: String) {
        let prev = rt.value
        write(next); rt.inputValue = intl.format(next, model)
        let d = detail(reason)
        if next != prev { emit("mdInput", d) }
        if next != rt.lastCommitted { rt.lastCommitted = next; emit("mdChange", d) }
    }
    private func doStep(_ dir: Double, _ amount0: Double, nearest: Bool, reason: String) {
        let m = model
        let amount = amount0.isFinite && amount0 > 0 ? amount0 : m.stepAmount
        let base = intl.parse(rt.inputValue, m) ?? rt.value ?? 0
        var next = base + dir * amount
        if m.snapOnStep { next = snap(next, amount, dir, nearest: nearest) }
        commit(intl.cleanFloat(clamp(next)), reason)
    }
    private func setAndCommit(_ n: Double, _ reason: String) { commit(intl.cleanFloat(clamp(n)), reason) }
    private func commitTyped(_ reason: String) {
        var next = intl.parse(rt.inputValue, model)
        if let n = next, !model.allowOutOfRange { next = clamp(n) }
        commit(next, reason)
    }

    // MARK: Press-and-hold (400 ms, then every 60 ms; no acceleration)

    private func beginHold(_ dir: Double) {
        guard !disabled, !model.readOnly else { return }
        #if canImport(AppKit)
        _ = (controller?.field ?? fallbackField).setFocus()    // mouse: keep the typing context in the input
        rt.pressFocused = true
        #endif
        rt.endHold()
        rt.holdDir = dir; rt.stepperPressed = Int(dir)
        holdTick()
        let r = rt
        let t = Timer(timeInterval: 0.4, repeats: false) { _ in
            MainActor.assumeIsolated {
                guard r.stepperPressed != nil else { return }
                let tick = Timer(timeInterval: 0.06, repeats: true) { _ in MainActor.assumeIsolated { holdTick() } }
                RunLoop.main.add(tick, forMode: .common); r.holdTimer = tick
            }
        }
        RunLoop.main.add(t, forMode: .common); rt.holdTimer = t
    }
    private func holdTick() {
        let dir = rt.holdDir
        if atBound(dir) { rt.endHold(); return }
        let m = model
        #if canImport(AppKit)
        let flags = NSEvent.modifierFlags, shift = flags.contains(.shift), alt = flags.contains(.option)
        #else
        let shift = false, alt = false
        #endif
        doStep(dir, shift ? m.largeStep : alt ? m.smallStep : m.stepAmount, nearest: alt, reason: dir > 0 ? "increment-press" : "decrement-press")
    }

    // MARK: The inner field's events

    private func accept(_ old: String, _ new: String) -> Bool {
        let m = model
        if new.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { return true }
        // A single typed character passes the key filter (keydown preventDefault); pastes are checked as a whole.
        if new.count == old.count + 1, let ch = typedCharacter(old, new), !intl.allowedKey(String(ch), m) { return false }
        return intl.allowedText(new, m)
    }
    private func typedCharacter(_ old: String, _ new: String) -> Character? {
        let a = Array(old), b = Array(new)
        var i = 0; while i < a.count && a[i] == b[i] { i += 1 }
        return i < b.count && Array(b[(i + 1)...]) == Array(a[i...]) ? b[i] : nil
    }
    private func fieldInput(_ raw: String) {
        if raw.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            rt.inputValue = raw
            if rt.value != nil { write(nil); emit("mdInput", .object(["value": .null, "formattedValue": .string(raw), "reason": .string("input-clear")])) }
            return
        }
        rt.inputValue = raw
        if let parsed = intl.parse(raw, model), parsed != rt.value {
            write(parsed); emit("mdInput", .object(["value": .number(parsed), "formattedValue": .string(raw), "reason": .string("input-change")]))
        }
    }
    private func fieldKey(_ key: String, _ composing: Bool) -> Bool {
        let m = model
        guard !disabled, !composing else { return false }
        let parts = key.split(separator: "+").map(String.init), name = parts.last ?? key
        let shift = parts.contains("Shift"), alt = parts.contains("Alt")
        switch name {
        case "ArrowUp", "ArrowDown":
            if m.readOnly { return true }
            doStep(name == "ArrowUp" ? 1 : -1, shift ? m.largeStep : alt ? m.smallStep : m.stepAmount, nearest: alt, reason: "keyboard"); return true
        case "Home":
            guard let lo = m.min, !m.readOnly, !shift, !alt else { return false }
            setAndCommit(lo, "keyboard"); return true
        case "End":
            guard let hi = m.max, !m.readOnly, !shift, !alt else { return false }
            setAndCommit(hi, "keyboard"); return true
        case "Enter":
            commitTyped("input-blur"); submit(); return true
        default: return false
        }
    }
    private func focusChanged(_ f: Bool) {
        rt.focused = f
        if !f { commitTyped("input-blur") }
    }
}

#if canImport(AppKit)
/// Wheel scrub (opt-in, only while the input has focus): a vertical delta steps; a horizontal-only delta steps only with
/// Shift; Control (pinch-zoom) is never taken; the page keeps every other wheel event.
private struct AWCNumberWheelMonitor: NSViewRepresentable {
    let active: Bool
    let step: (Double, Bool, Bool) -> Void
    final class Coordinator { var monitor: Any?; var parent: AWCNumberWheelMonitor?; weak var view: NSView? }
    func makeCoordinator() -> Coordinator { Coordinator() }
    func makeNSView(context: Context) -> NSView {
        let v = NSView(); context.coordinator.view = v; context.coordinator.parent = self
        let c = context.coordinator
        c.monitor = NSEvent.addLocalMonitorForEvents(matching: .scrollWheel) { [weak c] e in
            guard let c, let p = c.parent, p.active, let view = c.view, let win = view.window, e.window == nil || e.window === win else { return e }
            // A window-less (posted) wheel event carries screen coordinates.
            let local = view.convert(e.window == nil ? win.convertPoint(fromScreen: e.locationInWindow) : e.locationInWindow, from: nil)
            guard view.bounds.contains(local) else { return e }
            if e.modifierFlags.contains(.control) { return e }
            let shift = e.modifierFlags.contains(.shift), alt = e.modifierFlags.contains(.option)
            // Chrome's WheelEvent delta is the negated AppKit scrolling delta.
            let dy = -e.scrollingDeltaY, dx = -e.scrollingDeltaX
            let delta = dy != 0 ? dy : (shift ? dx : 0)
            guard delta != 0 else { return e }
            MainActor.assumeIsolated { p.step(delta > 0 ? -1 : 1, shift, alt) }
            return nil
        }
        return v
    }
    func updateNSView(_ nsView: NSView, context: Context) { context.coordinator.parent = self }
    static func dismantleNSView(_ nsView: NSView, coordinator: Coordinator) { if let m = coordinator.monitor { NSEvent.removeMonitor(m) } }
}
#endif

extension AWCNativeView {
    var nativeNumberField: some View {
        AWCNativeNumberField(node: node, theme: theme, setValue: { v in set("value", v) }, emit: { emit($0, $1) },
                             child: { n, handler in child(n, handler: handler) },
                             formMessage: registeredForm?.validationMessages[formRegistrationID], formResets: registeredForm?.resetCount ?? 0,
                             // Enter commits, then requestSubmit() as the source: the form submits, the default button is not clicked.
                             submit: { _ = resolvedForm?.submit(dispatcher: eventDispatcher, observe: onEvent) }, validityBox: fieldValidityBox)
    }
}
