import SwiftUI
import QuartzCore
#if canImport(Speech)
import Speech
#endif

// MARK: Methods

/// Native counterparts of the md-text-field methods. Attach with `.awcTextFieldController(_:for:)`.
@MainActor public final class AWCTextFieldController {
    weak var runtime: AWCTextFieldRuntime?
    public init() {}
    public var isConnected: Bool { runtime != nil }
    /// `setFocus()`: focuses the native input (caret at the end).
    @discardableResult public func setFocus() -> Bool { runtime?.input.focus() ?? false }
    /// `select()`: focuses and selects the whole value.
    public func select() { guard let r = runtime else { return }; _ = r.input.focus(); r.input.selectAll() }
    /// `getInputElement()`: the native input's live state (value, selection, focus, composition).
    public func getInputElement() -> AWCTextFieldInputInfo? {
        guard let r = runtime else { return nil }
        let s = r.input.selection()
        return .init(value: r.value(), selectionStart: s.0, selectionEnd: s.1, focused: r.input.isFocused(), composing: r.input.isComposing())
    }
    public func getValidity() -> AWCConstraintValidity { runtime?.validity() ?? .validState }
    /// Validity without presenting it; a barred (disabled / read-only) field reports true.
    public func checkValidity() -> Bool { guard let r = runtime else { return true }; return r.barred() || r.validity().valid }
    /// Like `checkValidity()`, but an invalid field shows its message in its own error state and takes focus.
    @discardableResult public func reportValidity() -> Bool {
        guard let r = runtime, !r.barred(), !r.validity().valid else { return true }
        r.revealed = true; DispatchQueue.main.async { _ = r.input.focus() }; return false
    }
    /// A non-empty message marks the field invalid (`customError`) until cleared with "".
    public func setCustomValidity(_ message: String) { runtime?.customMessage = message }
}

/// `getInputElement()` result: the native input's state.
public struct AWCTextFieldInputInfo: Equatable, Sendable {
    public let value: String, selectionStart: Int, selectionEnd: Int, focused: Bool, composing: Bool
}

private struct AWCTextFieldControllersKey: EnvironmentKey { static let defaultValue: [String: AWCTextFieldController] = [:] }
extension EnvironmentValues {
    var awcTextFieldControllers: [String: AWCTextFieldController] { get { self[AWCTextFieldControllersKey.self] } set { self[AWCTextFieldControllersKey.self] = newValue } }
}
private struct AWCTextFieldControllerModifier: ViewModifier {
    let id: String, controller: AWCTextFieldController
    @Environment(\.awcTextFieldControllers) private var inherited
    func body(content: Content) -> some View { var c = inherited; c[id] = controller; return content.environment(\.awcTextFieldControllers, c) }
}
public extension View {
    /// Attach a method controller to the md-text-field with node id `id`, or to descendant fields when nil.
    func awcTextFieldController(_ controller: AWCTextFieldController, for id: String? = nil) -> some View {
        modifier(AWCTextFieldControllerModifier(id: id ?? "", controller: controller))
    }
}

// MARK: Runtime state

@MainActor @Observable final class AWCTextFieldRuntime {
    var focused = false
    /// When the platform announced a focus move (UIKit: before its input-system work blocks the main thread); the
    /// focus / blur motion starts there, as Chrome's transition starts on the frame after the event.
    @ObservationIgnored var changeAt: Double?
    var editing = ""              // what the input shows
    var composing = false
    var passwordVisible = false
    var listening = false
    var userEdited = false
    var customMessage = ""
    var revealed = false
    var clearHover = false
    var passwordHover = false
    var speechHover = false
    var multilineHeight: Double = 0
    @ObservationIgnored var baseline = ""          // value as of the last change event / programmatic write
    @ObservationIgnored var lastValidityKey: String?
    @ObservationIgnored var lastValue: String?
    @ObservationIgnored var validityNow = AWCConstraintValidity.validState
    @ObservationIgnored var barredNow = false
    @ObservationIgnored let input = AWCFieldInputHandle()
    @ObservationIgnored let search = AWCSearchEmitter()
    @ObservationIgnored var value: () -> String = { "" }
    @ObservationIgnored var validity: () -> AWCConstraintValidity = { .validState }
    @ObservationIgnored var barred: () -> Bool = { false }
    #if canImport(Speech)
    @ObservationIgnored var recognizer: AnyObject?
    #endif
}

// MARK: Renderer

/// Hooks a composite built on the text field uses (md-number-field, md-otp-field, md-search): the source composes an
/// md-text-field and listens to its input, keydown, focus and blur events inside its own shadow root.
struct AWCFieldHooks {
    /// A user edit before any event: return false to keep the previous text (no input event, as a prevented keydown or a
    /// reverted paste). Arguments: previous text, new text.
    var accept: ((String, String) -> Bool)? = nil
    /// Keys in the input before the field's own handling ("ArrowUp", "Shift+ArrowDown", "Alt+ArrowUp", "Home", "End",
    /// "Enter", "Escape" …): return true when handled (the default action is suppressed).
    var key: ((String, Bool) -> Bool)? = nil
    /// The input gained or lost focus (after the field's own focus handling).
    var focus: ((Bool) -> Void)? = nil
    /// Replaces the trailing-icon slot (composite-owned buttons such as the inline steppers).
    var trailing: AnyView? = nil
    /// The composite's controller for the inner input (an embedded field attaches to no other controller).
    var controller: AWCTextFieldController? = nil
    /// Backspace / Delete / ArrowLeft / ArrowRight / Home / End reach `key` before the text system (unhandled keys keep their
    /// own editing): md-autocomplete / md-multi-select remove the last chip on Backspace in an empty input.
    var editingKeys = false
    /// Space and printable characters typed into a read-only input reach `key` (the character itself, " " for Space): Chrome
    /// still dispatches keydown in a readonly input (md-select / md-multi-select open on Space).
    var readOnlyKeys = false
}

struct AWCNativeTextField: View {
    let node: AWCNode, theme: AWCTheme
    let value: String
    let setValue: (String) -> Void
    let emit: (String, AWCValue) -> Void
    let leading: [AWCNode], trailing: [AWCNode], chips: [AWCNode]
    let clearIcon: [AWCNode], passwordIcon: [AWCNode], speechIcon: [AWCNode], errorIcon: [AWCNode]
    let child: (AWCNode) -> AnyView
    var formMessage: String? = nil
    var formResets = 0
    var formDisabled = false
    var submit: () -> Void = {}
    var validityBox: AWCFieldValidityBox? = nil
    /// Set by composites (see AWCFieldHooks); nil for a standalone md-text-field.
    var hooks: AWCFieldHooks? = nil
    @Environment(\.awcTextFieldAppearance) private var inheritedAppearance
    @Environment(\.awcTextFieldAppearanceTargets) private var appearanceTargets
    @Environment(\.awcTextFieldPartAppearance) private var inheritedParts
    @Environment(\.awcTextFieldPartAppearanceTargets) private var partTargets
    @Environment(\.awcFieldActivation) private var activation
    @Environment(\.awcFieldFocusTarget) private var focusTarget
    @Environment(\.awcTextFieldControllers) private var controllers
    @Environment(\.awcTextFieldFormatting) private var formattings
    @Environment(\.awcNativeDensity) private var inheritedDensity
    @Environment(\.awcNativePointerState) private var pointer
    @Environment(\.accessibilityReduceMotion) private var systemReduced
    @Environment(\.awcFieldReducedMotion) private var reducedOverride
    @Environment(\.layoutDirection) private var direction
    @State private var rt = AWCTextFieldRuntime()
    @State private var hovered = false
    @State private var frame: CGRect = .zero
    @State private var width: Double = 0
    @State private var labelTrack = AWCCSSTransitionTrack()          // 0 resting → 1 floated (emphasized)
    @State private var legendTrack = AWCCSSTransitionTrack()
    @State private var labelColorTrack = AWCCSSColorTrack()
    @State private var indicatorHeight = AWCCSSTransitionTrack(initial: 1)
    @State private var indicatorColor = AWCCSSColorTrack()
    @State private var outlineColor = AWCCSSColorTrack()
    @State private var containerColor = AWCCSSColorTrack()
    @State private var layerTrack = AWCCSSTransitionTrack()
    @State private var primed = false

    private var model: AWCTextFieldModel { AWCTextFieldModel(properties: node.properties.merging(["value": .string(value)]) { _, n in n }) }
    private var appearance: AWCTextFieldAppearance { inheritedAppearance.merging(appearanceTargets[node.id] ?? .init()) }
    private var localRung: Double? { model.density.flatMap { [-1.0, -2, -3, -4].contains($0) ? $0 : nil } }
    private var scale: Double { AWCNativeDensity.resolve(model.density, inherited: inheritedDensity) }
    private var style: AWCTextFieldStyle {
        var st = AWCTextFieldStyle(model: model, appearance: appearance, tokens: theme.tokens, scale: scale, localRung: localRung)
        st.parts = inheritedParts.merging(partTargets[node.id] ?? .init()); return st
    }
    private var reduced: Bool { reducedOverride ?? systemReduced }
    private var formatting: AWCTextFieldFormatting { formattings[node.id] ?? formattings[""] ?? .init() }
    private var effectiveFormatOn: String { model.formatOn == "input" && formatting.formatter != nil && formatting.parser == nil ? "blur" : model.formatOn }
    private var disabled: Bool { model.disabled || formDisabled }
    private var constraints: AWCTextConstraints { var c = AWCTextConstraints(model: model); c.mutable = !disabled && !model.readOnly; return c }
    private var validity: AWCConstraintValidity { constraints.evaluate(value, userEdited: rt.userEdited, custom: rt.customMessage) }
    private var validationMessage: String { rt.revealed && !validity.valid ? validity.validationMessage : "" }
    private var hasError: Bool { model.error || !validationMessage.isEmpty }
    private var supportMessage: String { hasError ? (model.errorText.isEmpty ? (validationMessage.isEmpty ? model.supportingText : validationMessage) : model.errorText) : model.supportingText }
    private var floating: Bool { rt.focused || model.appearFocused || !value.isEmpty || !model.placeholder.isEmpty || !chips.isEmpty }
    private var hover: Bool {
        guard !disabled else { return false }
        return pointer.map { $0.location.map(frame.contains) ?? false } ?? hovered
    }
    private var states: AWCTextFieldStates {
        .init(focused: rt.focused || model.appearFocused, hover: hover, floating: floating, hasLeading: !leading.isEmpty, hasError: hasError,
              disabled: disabled, hasLabel: !model.label.isEmpty, hasChips: !chips.isEmpty, listening: rt.listening,
              clearHover: rt.clearHover, passwordHover: rt.passwordHover, speechHover: rt.speechHover)
    }
    private var displayValue: String { displayed(value) }
    /// What the input shows for `v` (the formatter's text unless focused in `formatOn="blur"`).
    private func displayed(_ v: String) -> String {
        guard let f = formatting.formatter else { return v }
        if rt.focused && effectiveFormatOn == "blur" { return v }
        return f(v)
    }
    private var counter: String {
        guard let max = model.maxLength else { return "" }
        let usesFormatterLimit = formatting.formatter != nil && effectiveFormatOn == "input"
        let length = usesFormatterLimit ? value.replacingOccurrences(of: "[-/\\s]", with: "", options: .regularExpression).utf16.count : value.utf16.count
        return "\(length)/\(max)"
    }
    private var secure: Bool { model.type == "password" && !(model.passwordToggle == .internal && rt.passwordVisible) }
    private var passwordRevealed: Bool { model.passwordToggle == .internal ? rt.passwordVisible : model.type != "password" }
    private var clearDisabled: Bool { disabled || model.readOnly || value.isEmpty }
    private var trailingIsButton: Bool { hooks?.trailing != nil || trailing.contains { ["md-icon-button", "md-button", "button", "a", "input", "select", "textarea"].contains($0.tag) || $0.properties["tabindex"] != nil } }

    private struct Targets: Equatable { var floated: Double, legend: Double, label: String, indicatorH: Double, indicator: String, outline: String, container: String, layer: Double }
    private var targets: Targets {
        let s = states, st = style
        return .init(floated: floating ? 1 : 0, legend: floating && !model.label.isEmpty ? 1 : 0, label: st.labelColor(s), indicatorH: st.indicator(s).height,
                     indicator: st.indicator(s).color, outline: st.outline(s).color, container: st.containerFill(s), layer: st.stateLayerOpacity(s))
    }
    private func apply(_ next: Targets, previous: Targets?) {
        let st = style
        guard primed, !reduced, let previous else {
            labelTrack.snap(next.floated); legendTrack.snap(next.legend); indicatorHeight.snap(next.indicatorH); layerTrack.snap(next.layer)
            labelColorTrack.set(Color(awcHex: next.label), now: 0, duration: 0, curve: [0, 0, 1, 1])
            indicatorColor.set(Color(awcHex: next.indicator), now: 0, duration: 0, curve: [0, 0, 1, 1])
            outlineColor.set(Color(awcHex: next.outline), now: 0, duration: 0, curve: [0, 0, 1, 1])
            containerColor.set(Color(awcHex: next.container), now: 0, duration: 0, curve: [0, 0, 1, 1])
            primed = true; return
        }
        let current = CACurrentMediaTime() * 1000
        let now = rt.changeAt.map { current - $0 >= 0 && current - $0 < 150 ? $0 : current } ?? current
        rt.changeAt = nil
        let label = st.labelMotion, color = st.colorMotion, layer = st.layerMotion
        labelTrack.set(next.floated, now: now, duration: label.0, curve: label.1)
        legendTrack.set(next.legend, now: now, duration: label.0, curve: label.1)
        labelColorTrack.set(Color(awcHex: next.label), now: now, duration: color.0, curve: color.1)
        // Focused rules declare `transition: height` only: colour snaps on focus, eases back on blur.
        let focusing = next.indicatorH > previous.indicatorH || (states.focused && next.indicator != previous.indicator)
        indicatorHeight.set(next.indicatorH, now: now, duration: color.0, curve: color.1)
        indicatorColor.set(Color(awcHex: next.indicator), now: now, duration: focusing ? 0 : color.0, curve: color.1)
        outlineColor.set(Color(awcHex: next.outline), now: now, duration: states.focused ? 0 : label.0, curve: label.1)
        containerColor.set(Color(awcHex: next.container), now: now, duration: label.0, curve: label.1)
        layerTrack.set(next.layer, now: now, duration: layer.0, curve: layer.1)
    }
    private func running(_ t: Double) -> Bool {
        labelTrack.isRunning(t) || legendTrack.isRunning(t) || labelColorTrack.isRunning(t) || indicatorHeight.isRunning(t) || indicatorColor.isRunning(t)
            || outlineColor.isRunning(t) || containerColor.isRunning(t) || layerTrack.isRunning(t) || rt.listening
    }

    var body: some View {
        if model.hidden { EmptyView() } else {
            let now = CACurrentMediaTime() * 1000
            TimelineView(.animation(paused: !running(now))) { _ in field(CACurrentMediaTime() * 1000) }
                .onChange(of: targets, initial: true) { old, next in apply(next, previous: old == next ? nil : old) }
                .onChange(of: disabled || model.readOnly, initial: true) { _, barred in rt.barredNow = barred }
                .onChange(of: validity, initial: true) { _, next in
                    rt.validityNow = next
                    let key = next.key; defer { rt.lastValidityKey = key }
                    if let last = rt.lastValidityKey, last != key { emit("mdValidityChange", next.eventValue) }
                }
                .onChange(of: value, initial: true) { old, new in
                    // A programmatic write (prop change, clear, reset) moves the change baseline; typing does not.
                    if rt.lastValue != new { rt.baseline = new; if !rt.focused { rt.userEdited = false } }
                    rt.lastValue = new
                    // From `new`: the action may run with the view value of the previous update (a composite's value arriving
                    // after the field appeared).
                    let shown = displayed(new)
                    if rt.focused, rt.editing != shown, !rt.composing { rt.editing = effectiveFormatOn == "blur" && formatting.formatter != nil ? new : shown }
                    if !rt.focused { rt.editing = shown }
                }
                .onChange(of: model.name) { _, _ in rt.revealed = false }
                .onChange(of: formResets) { _, _ in rt.revealed = false; rt.userEdited = false }
                .onChange(of: formMessage) { _, m in if m != nil { rt.revealed = true } }
                .onChange(of: disabled, initial: true) { _, d in if d { rt.revealed = false } }
                .onAppear { connect() }
                .onDisappear { rt.search.cancel(); stopSpeech() }
        }
    }

    private func connect() {
        // The value's initial onChange may have run first, with the newer value (a composite's arriving after the field
        // appeared): what it set stands.
        if rt.lastValue == nil { rt.editing = displayValue; rt.baseline = value; rt.lastValue = value }
        let r = rt
        rt.value = { r.lastValue ?? "" }; rt.validity = { r.validityNow }; rt.barred = { r.barredNow }
        rt.search.send = { emit("mdSearch", .string($0)) }
        rt.search.current = { r.lastValue ?? "" }
        validityBox?.evaluate = { r.validity() }
        if let hooks { hooks.controller?.runtime = rt } else { (controllers[node.id] ?? controllers[""])?.runtime = rt }
    }

    // MARK: Editing pipeline (handleInput)

    private func edited(_ raw: String, _ caret: Int, _ composing: Bool) -> (String, Int)? {
        rt.composing = composing
        if composing { rt.editing = raw; return nil }
        if let accept = hooks?.accept, !accept(rt.editing, raw) {
            let kept = rt.editing, removed = raw.utf16.count - kept.utf16.count
            return (kept, max(0, min(caret - max(0, removed), kept.utf16.count)))
        }
        var text = raw, pos = caret, shaped: (String, Int)? = nil
        let m = model
        var restricted = m.applyRestrict(text)
        if !m.restrict.isEmpty, let max = m.maxLength, restricted.utf16.count > max { restricted = AWCTextFieldModel.truncate(restricted, utf16Limit: max) }
        if restricted != text {
            let before = m.applyRestrict(String((text as NSString).substring(to: min(caret, (text as NSString).length))))
            text = restricted; pos = min(before.utf16.count, text.utf16.count); shaped = (text, pos)
        } else if m.restrict.isEmpty, !(formatting.formatter != nil && effectiveFormatOn == "input"), let max = m.maxLength, text.utf16.count > max {
            // The input's own maxlength refuses the insertion: no `input` event fires.
            let kept = rt.editing
            return (kept, min(pos, kept.utf16.count))
        }
        if !m.isMultiline { text = text.replacingOccurrences(of: "[\r\n]+", with: "", options: .regularExpression) }
        var newValue = text
        if let parser = formatting.parser { newValue = parser(text) }
        if let f = formatting.formatter, effectiveFormatOn == "input" {
            if let max = m.maxLength {
                let content = newValue.replacingOccurrences(of: "[-/\\s]", with: "", options: .regularExpression)
                if content.utf16.count > max { newValue = AWCTextFieldModel.truncate(content, utf16Limit: max) }
            }
            let formatted = f(newValue)
            func contentLen(_ s: String) -> Int { formatting.parser.map { $0(s).utf16.count } ?? s.filter { $0.isLetter || $0.isNumber }.count }
            let before = contentLen(String((text as NSString).substring(to: min(pos, (text as NSString).length))))
            var newPos = before == 0 ? 0 : formatted.utf16.count
            if before > 0 { for i in 0..<formatted.utf16.count where contentLen(String((formatted as NSString).substring(to: i + 1))) == before { newPos = i + 1; break } }
            shaped = (formatted, newPos); rt.editing = formatted
        } else { rt.editing = text }
        rt.userEdited = true
        rt.lastValue = newValue
        setValue(newValue)
        emit("mdInput", .string(newValue))
        rt.search.emit(newValue, debounce: m.debounce, throttle: m.throttle)
        return shaped
    }

    private func focusChanged(_ f: Bool) {
        guard f != rt.focused else { return }
        rt.focused = f
        if f {
            rt.baseline = value
            if formatting.formatter != nil && effectiveFormatOn == "blur" { rt.editing = value }
        } else {
            rt.composing = false
            commitChange()
            rt.editing = displayValue
        }
        hooks?.focus?(f)
    }
    /// The native `change` event: the value differs from the last change / programmatic write.
    private func commitChange() {
        guard value != rt.baseline else { return }
        rt.baseline = value; emit("mdChange", .string(value))
    }
    private func command(_ key: String, _ composing: Bool) -> Bool {
        if let hook = hooks?.key, hook(key, composing) { return true }
        switch key {
        case "Escape":
            guard !composing, model.clearable == .internal, !value.isEmpty, !model.readOnly, !disabled else { return false }
            clearValue(); emit("mdClear", .null); return true
        case "Enter":
            guard !composing, !model.isMultiline else { return false }
            commitChange()
            if !disabled { submit() }
            return true
        default: return false
        }
    }
    private func clearValue() {
        rt.lastValue = ""; rt.baseline = ""; rt.editing = ""
        setValue("")
        emit("mdInput", .string("")); emit("mdChange", .string(""))
        rt.search.emit("", debounce: model.debounce, throttle: model.throttle)
    }
    private func clearTapped() {
        guard !disabled, !model.readOnly, !value.isEmpty else { return }
        if model.clearable == .internal { clearValue() }
        emit("mdClear", .null); _ = rt.input.focus()
    }
    private func passwordTapped() {
        guard !disabled else { return }
        if model.passwordToggle == .internal { rt.passwordVisible.toggle(); emit("mdPasswordToggle", ["visible": .bool(rt.passwordVisible)]) }
        else { emit("mdPasswordToggle", ["visible": .bool(model.type == "password")]) }
        _ = rt.input.focus()
    }
    private func speechTapped() {
        guard !disabled, !model.readOnly else { return }
        if model.speechToText == .external {
            rt.listening.toggle(); emit("mdSpeechResult", ["transcript": "", "listening": .bool(rt.listening)]); return
        }
        if rt.listening { stopSpeech(); return }
        startSpeech()
    }
    private func stopSpeech() {
        #if canImport(Speech)
        (rt.recognizer as? AWCFieldSpeechSession)?.stop()
        #endif
    }
    private func startSpeech() {
        #if canImport(Speech)
        // Speech needs the host's usage descriptions; without them it is unsupported, as without Web Speech.
        guard Bundle.main.object(forInfoDictionaryKey: "NSSpeechRecognitionUsageDescription") != nil,
              Bundle.main.object(forInfoDictionaryKey: "NSMicrophoneUsageDescription") != nil else {
            print("md-text-field: speech recognition is not supported by this host."); return
        }
        let base = value, separator = !base.isEmpty && !base.hasSuffix(" ") ? " " : ""
        let session = AWCFieldSpeechSession(locale: model.speechLang)
        rt.recognizer = session; rt.listening = true
        session.start(result: { text, final in
            let full = base + separator + text
            rt.lastValue = full; setValue(full); emit("mdInput", .string(full))
            emit("mdSpeechResult", ["transcript": .string(text), "listening": .bool(true)])
            _ = final
        }, end: { finalText in
            rt.listening = false; rt.recognizer = nil
            let full = base + separator + finalText
            rt.lastValue = full; rt.baseline = full; setValue(full)
            emit("mdInput", .string(full)); emit("mdChange", .string(full))
            emit("mdSpeechResult", ["transcript": .string(finalText), "listening": .bool(false)])
        })
        #else
        print("md-text-field: speech recognition is not supported by this host.")
        #endif
    }

    // MARK: Layout

    private func field(_ t: Double) -> some View {
        let st = style, s = states, m = model
        let support = supportMessage, count = counter
        let showSupport = !support.isEmpty || !count.isEmpty || m.reserveSupportingSpace
        return VStack(alignment: .leading, spacing: 0) {
            container(t, st, s)
            if showSupport {
                HStack(alignment: .top, spacing: 16) {
                    // CSS line boxes: line-height minus the font's ascent+descent is split above and below every line.
                    let gap = max(0, st.supportLine - (AWCFieldMetrics.ascent + AWCFieldMetrics.descent) * st.supportFont)
                    Text(support.isEmpty ? (m.reserveSupportingSpace ? "\u{200B}" : "") : support)
                        .font(AWCNativeFonts.label(size: st.supportFont, regular: true)).lineSpacing(gap)
                        .padding(.vertical, gap / 2)
                        .frame(minHeight: st.supportLine, alignment: .center)
                        .foregroundStyle(Color(awcHex: st.supportColor(s)))
                        .fixedSize(horizontal: false, vertical: true)
                        .awcInspect(nodeID: node.id, part: "supporting-text", name: "supporting-text") { _ in ["role": .string(hasError ? "alert" : "")] }
                        // Always plain static text: inside a composite (md-number-field) the combined support row otherwise picked up the
                        // host's actions on macOS and read as a selectable option.
                        .accessibilityAddTraits(.isStaticText)
                    Spacer(minLength: 0)
                    if !count.isEmpty {
                        Text(count).font(AWCNativeFonts.label(size: st.supportFont, regular: true))
                            .frame(minHeight: st.supportLine).foregroundStyle(Color(awcHex: st.counterColor(s))).fixedSize()
                            .awcInspect(nodeID: node.id, part: "counter", name: "counter")
                    }
                }
                .padding(.top, 4).padding(.horizontal, 16)
                .accessibilityElement(children: .combine)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        // Runtime values are captured by value: the inspection re-evaluates when they change (a composite's value can arrive after
        // the field appeared without any geometry change, macOS).
        .awcInspect(nodeID: node.id, part: hooks == nil ? nil : "text-field", name: "md-text-field") { [focused = rt.focused, editing = rt.editing, composing = rt.composing,
                                                                                                         passwordVisible = rt.passwordVisible, listening = rt.listening] _ in   // composed: a part of the host
            ["focused": .bool(focused), "floating": .bool(floating), "hover": .bool(hover), "error": .bool(hasError), "value": .string(value),
             "displayValue": .string(editing), "composing": .bool(composing), "passwordVisible": .bool(passwordVisible), "listening": .bool(listening),
             "validationMessage": .string(validationMessage), "valid": .bool(validity.valid), "labelProgress": .number(labelTrack.presented(t))]
        }
    }

    private var hasTrailingCluster: Bool { m_clear || model.showPasswordToggle || model.speechToText.on || hasError || !trailing.isEmpty || hooks?.trailing != nil }
    private var m_clear: Bool { model.clearable.on }

    private func containerHeight(_ st: AWCTextFieldStyle) -> Double {
        let m = model
        if m.isMultiline {
            let line = st.inputLine
            let rows = Double(m.effectiveRows)
            let content = m.multiline == "fixed" ? rows * line : max(rows * line, rt.multilineHeight)
            let wrap = (st.filled ? 20 : 0) + content
            return st.padBlock * 2 + wrap
        }
        let chipsH: Double = chips.isEmpty ? 0 : 32
        let affix = (!m.prefixText.isEmpty || !m.suffixText.isEmpty) && floating ? st.affixLine : 0
        let row = max(st.inputLine, chipsH, affix)
        let chipPad: Double = st.filled && floating && !chips.isEmpty && !m.label.isEmpty ? max(12, 16 + st.scale) : 0
        let content = max(row + chipPad, st.iconSize)
        return max(st.minHeight, st.padBlock * 2 + content)
    }

    private func container(_ t: Double, _ st: AWCTextFieldStyle, _ s: AWCTextFieldStates) -> some View {
        let m = model, h = containerHeight(st)
        let fill = reduced ? Color(awcHex: targets.container) : containerColor.presented(t) ?? Color(awcHex: targets.container)
        let shape = UnevenRoundedRectangle(topLeadingRadius: st.shape, bottomLeadingRadius: st.bottomRadius, bottomTrailingRadius: st.bottomRadius, topTrailingRadius: st.shape)
        let layer = reduced ? targets.layer : layerTrack.presented(t)
        return ZStack(alignment: .topLeading) {
            shape.fill(fill)
            if st.filled { shape.fill(Color(awcHex: st.onSurface)).opacity(layer).allowsHitTesting(false)
                .awcInspect(nodeID: node.id, part: "state-layer", name: "state-layer") { _ in ["opacity": .number(layer)] } }
            row(t, st, s, height: h)
        }
        .frame(height: h)
        // Neither the indicator nor the fieldset takes part in layout (a negative focus inset draws outside the box).
        .overlay(alignment: .topLeading) { if st.filled { indicator(t, st, s, height: h) } else { outline(t, st, s, height: h) } }
        .contentShape(Rectangle())
        .onTapGesture { if !disabled { _ = rt.input.focus() } }
        .onContinuousHover { phase in if case .active = phase { hovered = true } else { hovered = false } }
        .onGeometryChange(for: CGRect.self) { $0.frame(in: .named("awc-native-preview")) } action: { frame = $0 }
        .onGeometryChange(for: Double.self) { Double($0.size.width) } action: { width = $0 }
        .awcFieldCursor(appearance.cursor ?? "text", enabled: !disabled)
        .awcInspect(nodeID: node.id, part: "container", name: "container") { _ in
            ["background": .string(targets.container), "padBlock": .number(st.padBlock), "padStart": .number(st.padStart), "padEnd": .number(st.padEnd)]
        }
    }

    private func row(_ t: Double, _ st: AWCTextFieldStyle, _ s: AWCTextFieldStates, height: Double) -> some View {
        let m = model, multi = m.isMultiline
        let fixedMulti = multi && m.multiline == "fixed"
        let align: VerticalAlignment = multi ? .top : .center
        let iconTop: Double = fixedMulti ? 16 : 0
        return HStack(alignment: align, spacing: 0) {
            if !leading.isEmpty {
                slotIcon(leading, color: st.leadingIconColor(s), size: st.iconSize)
                    .padding(.top, iconTop).padding(.trailing, st.gapLG)
                    .frame(maxHeight: multi && !fixedMulti ? .infinity : nil)
                    .awcInspect(nodeID: node.id, part: "leading-icon", name: "leading-icon")
            }
            wrap(t, st, s, height: height)
            if m.clearable.on { clearButton(st, s).padding(.top, iconTop).frame(maxHeight: multi && !fixedMulti ? .infinity : nil) }
            if m.showPasswordToggle { passwordButton(st, s).padding(.top, iconTop).frame(maxHeight: multi && !fixedMulti ? .infinity : nil) }
            if m.speechToText.on { speechButton(st, s).padding(.top, iconTop).frame(maxHeight: multi && !fixedMulti ? .infinity : nil) }
            if hasError {
                Group { if errorIcon.isEmpty { AWCFieldGlyph(name: "error", size: st.iconSize, fill: 1) } else { ForEach(errorIcon) { child($0) } } }
                    .frame(width: st.iconSize, height: st.iconSize).foregroundStyle(Color(awcHex: st.errorColor))
                    .padding(.top, iconTop).padding(.leading, st.gapLG).frame(maxHeight: multi && !fixedMulti ? .infinity : nil)
                    .accessibilityHidden(true)
                    .awcInspect(nodeID: node.id, part: "error-icon", name: "error-icon")
            }
            if !trailing.isEmpty || hooks?.trailing != nil {
                Group { if let accessory = hooks?.trailing { accessory } else if trailingIsButton { ForEach(trailing) { child($0) } } else { slotIcon(trailing, color: st.trailingIconColor(s), size: st.iconSize) } }
                    // `.md-text-field__error-icon + .md-text-field__trailing-icon-button { margin-inline-start: 4px }`
                    .padding(.leading, hasError && trailingIsButton ? 4 : 0)
                    .padding(.top, iconTop).frame(maxHeight: multi && !fixedMulti ? .infinity : nil)
                    .accessibilityHidden(!trailingIsButton)
                    .awcInspect(nodeID: node.id, part: "trailing-icon", name: "trailing-icon")
            }
        }
        .padding(.leading, st.padStart).padding(.trailing, st.padEnd)
        .padding(.vertical, st.padBlock)
        .frame(height: height, alignment: .top)
    }

    @ViewBuilder private func slotIcon(_ nodes: [AWCNode], color: String, size: Double) -> some View {
        Group { ForEach(nodes) { n in
            if n.tag == "#symbol" || n.tag == "#text" || n.tag == "#slot-text" {
                AWCFieldGlyph(name: n.properties["name"]?.string ?? n.properties["text"]?.string ?? "", size: size, fill: 0)
            } else { child(n) }
        } }
        .frame(width: size, height: size)
        .foregroundStyle(Color(awcHex: color))
        .environment(\.awcMaterialSymbolSize, size)
    }

    /// The input wrap: the absolutely positioned label above the input row.
    private func wrap(_ t: Double, _ st: AWCTextFieldStyle, _ s: AWCTextFieldStates, height: Double) -> some View {
        let m = model, multi = m.isMultiline
        let wrapH = multi ? (st.filled ? 20 : 0) + (m.multiline == "fixed" ? Double(m.effectiveRows) * st.inputLine : max(Double(m.effectiveRows) * st.inputLine, rt.multilineHeight)) : height - st.padBlock * 2
        let chipPad: Double = st.filled && floating && !chips.isEmpty && !m.label.isEmpty ? max(12, 16 + st.scale) : 0
        let chipsH: Double = chips.isEmpty ? 0 : 32
        let affixOn = floating
        let rowH = max(st.inputLine, chipsH, affixOn && (!m.prefixText.isEmpty || !m.suffixText.isEmpty) ? st.affixLine : 0)
        // justify-content: filled single-line → flex-end (centre without a label), outlined → centre, multiline → start.
        let rowTop: Double = multi ? (st.filled ? 20 : 0) : (st.filled && !m.label.isEmpty ? wrapH - rowH : (wrapH - rowH - chipPad) / 2 + chipPad)
        let lp = labelPosition(t, st, s, wrapH: wrapH)
        return AWCFieldWrapLayout(height: wrapH, rowTop: rowTop, labelX: lp.x, labelY: lp.y) {
            inputRow(st, s, rowH: rowH)
            if !m.label.isEmpty { label(t, st, s, wrapH: wrapH) }
        }
        .frame(maxWidth: .infinity, minHeight: wrapH, maxHeight: wrapH, alignment: .topLeading)
    }

    /// The label's `inset-inline-start` and `top − translateY` inside the input wrap (each interpolated with the same progress).
    private func labelPosition(_ t: Double, _ st: AWCTextFieldStyle, _ s: AWCTextFieldStates, wrapH: Double) -> (x: Double, y: Double) {
        let m = model, p = reduced ? targets.floated : labelTrack.presented(t)
        let line = st.restLine + (st.floatLine - st.restLine) * p
        let restTop: Double = m.isMultiline ? (st.filled ? 32 : 12) : wrapH / 2
        let top = restTop + (st.floatTop - restTop) * p
        let translate = st.filled ? -0.5 * (1 - p) : -0.5
        return (!st.filled && s.hasLeading ? -(st.iconSize + st.gapLG) * p : 0, top + translate * line)
    }
    private func label(_ t: Double, _ st: AWCTextFieldStyle, _ s: AWCTextFieldStates, wrapH: Double) -> some View {
        let m = model, p = reduced ? targets.floated : labelTrack.presented(t)
        let multi = m.isMultiline
        let font = st.restFont + (st.floatFont - st.restFont) * p
        let line = st.restLine + (st.floatLine - st.restLine) * p
        // `top` (px) and the translateY percentage, each interpolated with the same emphasized progress.
        let restTop: Double = multi ? (st.filled ? 32 : 12) : wrapH / 2
        let floatTop = st.floatTop
        let top = restTop + (floatTop - restTop) * p
        let translate = st.filled ? -0.5 * (1 - p) : -0.5
        let color = reduced ? Color(awcHex: targets.label) : labelColorTrack.presented(t) ?? Color(awcHex: targets.label)
        return Text(m.label)
            .font(AWCNativeFonts.label(size: font, regular: true)).tracking(0)
            .lineLimit(1).truncationMode(.tail)
            .frame(height: line)
            .foregroundStyle(color)
            .fixedSize(horizontal: false, vertical: true)
            .allowsHitTesting(false)
            .accessibilityHidden(true)
            .awcInspect(nodeID: node.id, part: "label", name: "label") { _ in ["fontSize": .number(font), "lineHeight": .number(line), "progress": .number(p), "color": .string(targets.label)] }
    }

    private func inputRow(_ st: AWCTextFieldStyle, _ s: AWCTextFieldStates, rowH: Double) -> some View {
        let m = model
        let nudge = st.filled ? 0 : (appearance.opticalNudge ?? 0)
        let inputH = m.isMultiline ? (m.multiline == "fixed" ? Double(m.effectiveRows) * st.inputLine : max(Double(m.effectiveRows) * st.inputLine, rt.multilineHeight)) : st.inputLine
        return HStack(alignment: m.isMultiline ? .top : .center, spacing: chips.isEmpty ? 0 : 4) {
            if !chips.isEmpty {
                AWCFieldChipsLayout(wrap: m.chipsWrap, gap: 4) { ForEach(chips) { child($0) } }
                    .awcInspect(nodeID: node.id, part: "chips", name: "chips")
                    .layoutPriority(1)
            }
            if !m.prefixText.isEmpty && floating {
                Text(m.prefixText).font(AWCNativeFonts.label(size: st.inputFont, regular: true)).frame(height: st.affixLine)
                    .foregroundStyle(Color(awcHex: st.affixColor(s))).fixedSize()
                    .awcInspect(nodeID: node.id, part: "prefix", name: "prefix").padding(.trailing, 2)
            }
            AWCFieldTextInput(config: inputConfig(st, s), events: inputEvents, handle: rt.input)
                .frame(minWidth: chips.isEmpty ? 0 : 40, maxWidth: .infinity)
                .frame(height: inputH)
                // Measured on an overlay identified by the shown text: a text change without any geometry change (a composite's
                // value arriving after the field appeared, macOS) still re-measures the input.
                .overlay {
                    Color.clear.allowsHitTesting(false).accessibilityHidden(true)
                        .awcInspect(nodeID: node.id, part: "input", name: "input") { [editing = rt.editing] _ in
                            ["value": .string(editing), "secure": .bool(secure), "fontSize": .number(st.inputFont), "lineHeight": .number(st.inputLine), "color": .string(st.inputColor(s)), "caret": .string(st.caretColor(s))]
                        }
                        .id(rt.editing)
                }
                .padding(.top, nudge).padding(.bottom, -nudge)
            if !m.suffixText.isEmpty && floating {
                Text(m.suffixText).font(AWCNativeFonts.label(size: st.inputFont, regular: true)).frame(height: st.affixLine)
                    .foregroundStyle(Color(awcHex: st.affixColor(s))).fixedSize()
                    .awcInspect(nodeID: node.id, part: "suffix", name: "suffix").padding(.leading, 2)
            }
        }
        .frame(minHeight: rowH, alignment: .center)
    }

    private func inputConfig(_ st: AWCTextFieldStyle, _ s: AWCTextFieldStates) -> AWCFieldInputConfig {
        let m = model
        var c = AWCFieldInputConfig()
        c.text = rt.editing; c.secure = secure; c.multiline = m.isMultiline; c.autoGrow = m.multiline == "auto-grow"
        c.fontSize = st.inputFont; c.lineHeight = st.inputLine; c.tracking = st.tracking
        c.color = st.inputColor(s); c.caret = st.caretColor(s); c.placeholder = floating ? m.placeholder : ""; c.placeholderColor = st.placeholderColor
        c.rtl = direction == .rightToLeft; c.editable = !m.readOnly; c.enabled = !disabled
        c.type = m.type; c.inputMode = m.inputMode; c.autocapitalize = m.autoCapitalize; c.autocomplete = m.autocomplete
        c.enterKeyHint = m.enterKeyHint; c.spellcheck = m.spellcheck
        c.accessibilityLabel = m.label.isEmpty ? m.ariaLabel : m.label
        c.accessibilityHint = [supportMessage, counter].filter { !$0.isEmpty }.joined(separator: " ")
        c.role = m.inputRole == "combobox" ? "combobox" : "textbox"; c.expanded = m.inputRole == "combobox" ? m.inputExpanded : nil
        c.invalid = hasError; c.required = m.required
        c.navigationKeys = hooks?.key != nil
        c.editingKeys = hooks?.editingKeys ?? false; c.readOnlyKeys = hooks?.readOnlyKeys ?? false
        return c
    }
    private var inputEvents: AWCFieldInputEvents {
        var e = AWCFieldInputEvents()
        e.edited = { text, caret, composing in edited(text, caret, composing) }
        e.focusChanged = { focusChanged($0) }
        e.focusMark = { [rt] in rt.changeAt = CACurrentMediaTime() * 1000 }
        e.command = { key, composing in command(key, composing) }
        e.activate = activation
        if let focusTarget { focusTarget.focus = { [rt] in rt.input.focus() }; focusTarget.isFocused = { [rt] in rt.input.isFocused() } }
        e.contentHeight = { h in if model.multiline == "auto-grow", abs(h - rt.multilineHeight) > 0.5 { rt.multilineHeight = h } }
        return e
    }

    // MARK: Trailing actions

    private func actionButton(_ name: String, label: String, pressed: Bool?, disabled d: Bool, hidden: Bool, color: (String, Double), icon: [AWCNode], hoverKey: ReferenceWritableKeyPath<AWCTextFieldRuntime, Bool>, part: String, action: @escaping () -> Void) -> some View {
        let st = style
        return AWCFieldActionButton(size: st.iconSize, ring: st.focusRingColor, disabled: d, label: label, pressed: pressed, action: action,
                                    hoverChanged: { rt[keyPath: hoverKey] = $0 }) {
            Group { if icon.isEmpty { AWCFieldGlyph(name: name, size: st.iconSize, fill: 0) } else { ForEach(icon) { child($0) } } }
                .foregroundStyle(Color(awcHex: color.0)).opacity(color.1)
        }
        .opacity(hidden ? 0 : 1)
        .padding(.horizontal, -6).padding(.vertical, -8)
        .awcInspect(nodeID: node.id, part: part, name: part) { _ in ["disabled": .bool(d), "label": .string(label), "pressed": pressed.map(AWCValue.bool) ?? .null] }
    }
    private func clearButton(_ st: AWCTextFieldStyle, _ s: AWCTextFieldStates) -> some View {
        actionButton("cancel", label: "Clear", pressed: nil, disabled: clearDisabled, hidden: value.isEmpty, color: st.actionColor(s, disabled: clearDisabled, hovered: rt.clearHover),
                     icon: clearIcon, hoverKey: \.clearHover, part: "clear", action: clearTapped)
    }
    private func passwordButton(_ st: AWCTextFieldStyle, _ s: AWCTextFieldStates) -> some View {
        let revealed = passwordRevealed
        return actionButton(revealed ? "visibility_off" : "visibility", label: revealed ? model.hidePasswordLabel : model.showPasswordLabel, pressed: revealed,
                            disabled: disabled, hidden: false, color: st.actionColor(s, disabled: disabled, hovered: rt.passwordHover), icon: passwordIcon,
                            hoverKey: \.passwordHover, part: "password-toggle", action: passwordTapped)
    }
    private func speechButton(_ st: AWCTextFieldStyle, _ s: AWCTextFieldStates) -> some View {
        let d = disabled || model.readOnly
        let pulse = rt.listening && !reduced ? 0.7 + 0.3 * cos(CACurrentMediaTime() * 2 * .pi / 1.2) : 1
        var color = st.actionColor(s, disabled: d, hovered: rt.speechHover, listening: rt.listening); color.opacity *= rt.listening ? (pulse < 0.4 ? 0.4 : pulse) : 1
        return actionButton(rt.listening ? "hearing" : "mic", label: rt.listening ? "Stop listening" : "Start voice input", pressed: rt.listening, disabled: d, hidden: false,
                            color: color, icon: speechIcon, hoverKey: \.speechHover, part: "speech", action: speechTapped)
    }

    // MARK: Indicator and outline

    private func indicator(_ t: Double, _ st: AWCTextFieldStyle, _ s: AWCTextFieldStates, height: Double) -> some View {
        let h = reduced ? targets.indicatorH : indicatorHeight.presented(t)
        let c = reduced ? Color(awcHex: targets.indicator) : indicatorColor.presented(t) ?? Color(awcHex: targets.indicator)
        return VStack(spacing: 0) { Spacer(minLength: 0); Rectangle().fill(c).frame(height: max(0, h)) }
            .opacity(st.indicatorOpacity).frame(height: height).allowsHitTesting(false)
            .awcInspect(nodeID: node.id, part: "indicator", name: "indicator") { _ in ["height": .number(h), "color": .string(targets.indicator)] }
    }

    private func outline(_ t: Double, _ st: AWCTextFieldStyle, _ s: AWCTextFieldStates, height: Double) -> some View {
        let o = st.outline(s)
        let c = reduced ? Color(awcHex: o.color) : outlineColor.presented(t) ?? Color(awcHex: o.color)
        let p = reduced ? targets.legend : legendTrack.presented(t)
        let inset = o.inset
        let w = width - 2 * inset, hh = height - 2 * inset
        // The legend: content width min(label text at the legend font, max-width) plus 2 × 4px padding, both interpolated.
        let text = Double(AWCFieldMetrics.textWidth(model.label, size: st.legendFont))
        let maxContent = max(0, w - 2 * o.width - (st.padStart - 5) - (st.padEnd - 5))
        let content = min(text, min(maxContent, w - 16), p * maxContent)
        let legendW = model.label.isEmpty ? 0 : max(0, content + 8 * p)
        let start = o.width + st.padStart - 5
        return AWCFieldOutlineShape(radius: st.shape, width: o.width, gapStart: start, gapLength: legendW, rtl: direction == .rightToLeft)
            .fill(c, style: FillStyle(eoFill: true))
            .frame(width: max(0, w), height: max(0, hh))
            .allowsHitTesting(false)
            .awcInspect(nodeID: node.id, part: "fieldset", name: "fieldset") { _ in
                ["borderWidth": .number(o.width), "color": .string(o.color), "legendStart": .number(start), "legendWidth": .number(legendW), "inset": .number(inset)]
            }
            .padding(inset)      // `inset: var(--md-text-field-focus-inset)`: a negative inset draws outside the box
    }
}


/// The input wrap: the input row at its flex position and the absolutely positioned label (mirrored under RTL).
struct AWCFieldWrapLayout: Layout {
    let height: Double, rowTop: Double, labelX: Double, labelY: Double
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        CGSize(width: proposal.width ?? subviews.first.map { $0.sizeThatFits(.unspecified).width } ?? 0, height: height)
    }
    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        guard let row = subviews.first else { return }
        let rowSize = row.sizeThatFits(ProposedViewSize(width: bounds.width, height: nil))
        row.place(at: CGPoint(x: bounds.minX, y: bounds.minY + rowTop), proposal: ProposedViewSize(width: bounds.width, height: rowSize.height))
        if subviews.count > 1 {
            let label = subviews[1], size = label.sizeThatFits(ProposedViewSize(width: bounds.width, height: nil))
            label.place(at: CGPoint(x: bounds.minX + labelX, y: bounds.minY + labelY), proposal: ProposedViewSize(width: min(size.width, bounds.width), height: size.height))
        }
    }
}

/// The outlined border with the legend notch cut out of its top edge (fieldset + legend).
struct AWCFieldOutlineShape: Shape {
    let radius: Double, width: Double, gapStart: Double, gapLength: Double, rtl: Bool
    func path(in rect: CGRect) -> Path {
        var p = Path()
        let r = min(radius, rect.width / 2, rect.height / 2)
        p.addRoundedRect(in: rect, cornerSize: CGSize(width: r, height: r))
        let ir = max(0, r - width)
        let inner = rect.insetBy(dx: width, dy: width)
        if inner.width > 0 && inner.height > 0 { p.addRoundedRect(in: inner, cornerSize: CGSize(width: ir, height: ir)) }
        if gapLength > 0 {
            let x = rtl ? rect.maxX - gapStart - gapLength : rect.minX + gapStart
            p.addRect(CGRect(x: x, y: rect.minY, width: gapLength, height: width))
        }
        return p
    }
}

/// A Material Symbols glyph (FILL axis for the error icon).
struct AWCFieldGlyph: View {
    let name: String, size: Double, fill: Double
    var body: some View {
        Text(name).font(Font(AWCNativeFonts.accordionSymbol(size: size, fill: fill))).fixedSize()
            .frame(width: size, height: size).environment(\.layoutDirection, .leftToRight).accessibilityHidden(true)
    }
}

/// Clear / password-toggle / speech button: a 40×40 (min) target with the focus-visible ring 6px inside.
struct AWCFieldActionButton<Content: View>: View {
    let size: Double, ring: String, disabled: Bool, label: String, pressed: Bool?
    let action: () -> Void
    let hoverChanged: (Bool) -> Void
    @ViewBuilder let content: () -> Content
    @FocusState private var focused: Bool
    var body: some View {
        let box = max(40, size)
        Button(action: { if !disabled { action() } }) {
            ZStack {
                content().frame(width: size, height: size)
                if focused && !disabled { Circle().strokeBorder(Color(awcHex: ring), lineWidth: 2).frame(width: box - 12, height: box - 12) }
            }
            .frame(width: box, height: box)
            .contentShape(Rectangle())
        }
        .buttonStyle(AWCFieldBareButtonStyle())
        .onContinuousHover { phase in if case .active = phase { hoverChanged(!disabled) } else { hoverChanged(false) } }
        .focused($focused).focusEffectDisabled()
        .accessibilityElement(children: .ignore).accessibilityLabel(label).accessibilityAddTraits(.isButton)
        .accessibilityAddTraits(pressed == true ? .isSelected : [])
        .disabled(disabled)
    }
}

struct AWCFieldBareButtonStyle: ButtonStyle { func makeBody(configuration: Configuration) -> some View { configuration.label } }

/// The chips slot: one line (clipped) by default, wrapping rows with `chips-wrap`.
struct AWCFieldChipsLayout: Layout {
    let wrap: Bool, gap: Double
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let maxW = proposal.width ?? .infinity
        var x = 0.0, y = 0.0, rowH = 0.0, w = 0.0
        for s in subviews {
            let size = s.sizeThatFits(.unspecified)
            if wrap && x > 0 && x + size.width > maxW { y += rowH + 6; x = 0; rowH = 0 }
            x += (x > 0 ? gap : 0) + size.width; rowH = max(rowH, size.height); w = max(w, x)
        }
        return CGSize(width: wrap ? min(w, maxW) : min(w, maxW), height: y + rowH)
    }
    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x = 0.0, y = 0.0, rowH = 0.0
        for s in subviews {
            let size = s.sizeThatFits(.unspecified)
            if wrap && x > 0 && x + size.width > bounds.width { y += rowH + 6; x = 0; rowH = 0 }
            let px = x + (x > 0 ? gap : 0)
            s.place(at: CGPoint(x: bounds.minX + px, y: bounds.minY + y), proposal: ProposedViewSize(size))
            x = px + size.width; rowH = max(rowH, size.height)
        }
    }
}

extension AWCFieldMetrics {
    static func textWidth(_ text: String, size: Double, weight: Double = 400) -> CGFloat {
        guard !text.isEmpty else { return 0 }
        let s = NSAttributedString(string: text, attributes: [.font: platformFont(size, weight: weight)])
        return s.size().width
    }
}

private struct AWCFieldCursorModifier: ViewModifier {
    let name: String, enabled: Bool
    func body(content: Content) -> some View {
        #if canImport(AppKit)
        content.onContinuousHover { phase in
            guard enabled else { return }
            switch phase {
            case .active: Self.cursor(name).set()
            case .ended: NSCursor.arrow.set()
            }
        }
        #else
        content
        #endif
    }
    #if canImport(AppKit)
    static func cursor(_ n: String) -> NSCursor {
        switch n {
        case "crosshair": return .crosshair
        case "pointer": return .pointingHand
        case "default", "auto": return .arrow
        case "not-allowed", "no-drop": return .operationNotAllowed
        case "grab": return .openHand
        case "grabbing": return .closedHand
        case "col-resize", "ew-resize": return .resizeLeftRight
        case "row-resize", "ns-resize": return .resizeUpDown
        default: return .iBeam
        }
    }
    #endif
}
extension View {
    func awcFieldCursor(_ name: String, enabled: Bool) -> some View { modifier(AWCFieldCursorModifier(name: name, enabled: enabled)) }
}

#if canImport(Speech)
/// `speech-to-text="internal"` on Apple platforms: SFSpeechRecognizer over the microphone (requires the host's usage strings).
final class AWCFieldSpeechSession: NSObject {
    private let recognizer: SFSpeechRecognizer?
    private let engine = AVAudioEngine()
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?
    private var endHandler: ((String) -> Void)?
    private var finalText = ""
    init(locale: String) { recognizer = locale.isEmpty ? SFSpeechRecognizer() : SFSpeechRecognizer(locale: Locale(identifier: locale)) }
    func start(result: @escaping (String, Bool) -> Void, end: @escaping (String) -> Void) {
        endHandler = end
        SFSpeechRecognizer.requestAuthorization { status in
            DispatchQueue.main.async {
                guard status == .authorized, let recognizer = self.recognizer, recognizer.isAvailable else { self.finish(); return }
                let request = SFSpeechAudioBufferRecognitionRequest(); request.shouldReportPartialResults = true; self.request = request
                let input = self.engine.inputNode
                input.installTap(onBus: 0, bufferSize: 1024, format: input.outputFormat(forBus: 0)) { buffer, _ in request.append(buffer) }
                do { try self.engine.start() } catch { self.finish(); return }
                self.task = recognizer.recognitionTask(with: request) { r, error in
                    DispatchQueue.main.async {
                        if let r { let text = r.bestTranscription.formattedString; if r.isFinal { self.finalText = text }; result(text, r.isFinal) }
                        if error != nil || r?.isFinal == true { self.finish() }
                    }
                }
            }
        }
    }
    func stop() { request?.endAudio() }
    private func finish() {
        engine.stop(); engine.inputNode.removeTap(onBus: 0); task?.cancel(); task = nil; request = nil
        let h = endHandler; endHandler = nil; h?(finalText)
    }
}
#endif

// MARK: AWCNativeView wiring

/// The field's live constraint validity, read by the owning native form when it validates.
@MainActor final class AWCFieldValidityBox { var evaluate: () -> AWCConstraintValidity = { .validState } }

extension AWCNativeView {
    var nativeTextField: some View {
        AWCNativeTextField(node: node, theme: theme, value: s("value"), setValue: { v in set("value", .string(v)) }, emit: { emit($0, $1) },
                           leading: node.children(inSlot: "leading-icon"), trailing: node.children(inSlot: "trailing-icon"), chips: node.children(inSlot: "chips"),
                           clearIcon: node.children(inSlot: "clear-icon"), passwordIcon: node.children(inSlot: "password-toggle-icon"),
                           speechIcon: node.children(inSlot: "speech-icon"), errorIcon: node.children(inSlot: "error-icon"),
                           child: { child($0) }, formMessage: registeredForm?.validationMessages[formRegistrationID],
                           formResets: registeredForm?.resetCount ?? 0, submit: { submitFromNativeText() }, validityBox: fieldValidityBox)
    }
}
