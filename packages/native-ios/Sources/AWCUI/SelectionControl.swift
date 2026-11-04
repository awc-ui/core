import SwiftUI

/// Constraint validity of md-switch / md-checkbox / md-radio, in the source's `getValidity()` shape:
/// a custom message (`setCustomValidity`) wins as `customError`; otherwise an empty required control is
/// `valueMissing` with its `valueMissingLabel`.
public struct AWCSelectionValidity: Equatable, Sendable {
    public let valid: Bool, validationMessage: String, flags: [String: Bool]
    /// The ten `ValidityState` flags Chrome reports (`valid` is the summary, not a flag).
    public static let flagNames = ["valueMissing", "typeMismatch", "patternMismatch", "tooLong", "tooShort", "rangeUnderflow", "rangeOverflow", "stepMismatch", "badInput", "customError"]
    public init(missing: Bool, missingMessage: String, customMessage: String) {
        var f = Dictionary(uniqueKeysWithValues: Self.flagNames.map { ($0, false) })
        if !customMessage.isEmpty { f["customError"] = true; valid = false; validationMessage = customMessage }
        else if missing { f["valueMissing"] = true; valid = false; validationMessage = missingMessage }
        else { valid = true; validationMessage = "" }
        flags = f
    }
    /// `{ valid, validationMessage, flags }` (the source method's resolved value).
    public var value: AWCValue { .object(["valid": .bool(valid), "validationMessage": .string(validationMessage), "flags": .object(flags.mapValues(AWCValue.bool))]) }
}

final class AWCSelectionControlHandle {
    var setFocus: () -> Bool = { false }
    var setBlur: () -> Void = {}
    var select: () -> Void = {}
    var validity: () -> AWCSelectionValidity = { .init(missing: false, missingMessage: "", customMessage: "") }
    var barred: () -> Bool = { false }
    var reveal: () -> Void = {}
    var setCustom: (String) -> Void = { _ in }
}

/// Native counterparts of the md-switch / md-checkbox / md-radio methods: `setFocus`, `setBlur`, `select`
/// (radio), `getValidity`, `checkValidity`, `reportValidity`, `setCustomValidity` and `syncValidityFromGroup`.
/// Attach with `.awcSelectionControlController(_:for:)` (SwiftUI) to the control with that node id, or to every
/// descendant selection control when no id is given.
public final class AWCSelectionControlController {
    weak var handle: AWCSelectionControlHandle?
    public init() {}
    public var isConnected: Bool { handle != nil }
    /// Focuses the control with its visible programmatic focus ring.
    @discardableResult public func setFocus() -> Bool { handle?.setFocus() ?? false }
    /// Removes focus from the control.
    public func setBlur() { handle?.setBlur() }
    /// md-radio `select()`: checks an enabled, unchecked radio (siblings uncheck silently) and emits `mdChange`.
    public func select() { handle?.select() }
    /// The current validity (`valid`, `validationMessage`, `flags`).
    public func getValidity() -> AWCSelectionValidity { handle?.validity() ?? .init(missing: false, missingMessage: "", customMessage: "") }
    /// Validity without presenting it. A hard-disabled control is barred from validation and reports true.
    public func checkValidity() -> Bool { guard let h = handle else { return true }; return h.barred() || h.validity().valid }
    /// Like `checkValidity()`, but an invalid control shows its message inline (kept in sync while it stays
    /// invalid) and takes focus with its focus ring.
    @discardableResult public func reportValidity() -> Bool {
        guard let h = handle, !h.barred(), !h.validity().valid else { return true }
        h.reveal(); return false
    }
    /// A non-empty message marks the control invalid (`customError`) until it is cleared with an empty string.
    public func setCustomValidity(_ message: String) { handle?.setCustom(message) }
    /// md-radio group coordination: validity and the roving tab stop are derived natively, so this is a refresh.
    public func syncValidityFromGroup() {}
}

private struct AWCSelectionControllersKey: EnvironmentKey { static let defaultValue: [String: AWCSelectionControlController] = [:] }
extension EnvironmentValues {
    var awcSelectionControllers: [String: AWCSelectionControlController] { get { self[AWCSelectionControllersKey.self] } set { self[AWCSelectionControllersKey.self] = newValue } }
}
private struct AWCSelectionControllerModifier: ViewModifier {
    let id: String, controller: AWCSelectionControlController
    @Environment(\.awcSelectionControllers) private var inherited
    func body(content: Content) -> some View { var c = inherited; c[id] = controller; return content.environment(\.awcSelectionControllers, c) }
}
public extension View {
    /// Attach a method controller to the md-switch / md-checkbox / md-radio with node id `id` rendered inside this
    /// view, or to the descendant selection controls when `id` is nil.
    func awcSelectionControlController(_ controller: AWCSelectionControlController, for id: String? = nil) -> some View {
        modifier(AWCSelectionControllerModifier(id: id ?? "", controller: controller))
    }
}

/// Per-control validation presentation (the source's InlineValidationPresenter): a reported, invalid control
/// shows its message until it becomes valid, its name changes, it is disabled or its form resets.
@Observable final class AWCSelectionValidationState {
    var customMessage = ""
    var revealed = false
    @ObservationIgnored var lastKey: String?
    @ObservationIgnored let handle = AWCSelectionControlHandle()
    /// The message to present inline, if revealed and still invalid.
    func shown(_ validity: AWCSelectionValidity) -> String? { revealed && !validity.valid ? validity.validationMessage : nil }
}

struct AWCSelectionValidationModifier: ViewModifier {
    let nodeID: String, state: AWCSelectionValidationState
    let missing: Bool, missingMessage: String, barred: Bool, name: String, formResets: Int
    let focus: () -> Bool, blur: () -> Void, select: () -> Void
    let changed: (AWCValue) -> Void
    @Environment(\.awcSelectionControllers) private var controllers
    func body(content: Content) -> some View {
        let validity = AWCSelectionValidity(missing: missing, missingMessage: missingMessage, customMessage: state.customMessage)
        let h = state.handle, s = state, missing = missing, message = missingMessage, barred = barred
        h.setFocus = focus; h.setBlur = blur; h.select = select; h.barred = { barred }
        h.validity = { AWCSelectionValidity(missing: missing, missingMessage: message, customMessage: s.customMessage) }
        h.setCustom = { s.customMessage = $0 }
        h.reveal = { [focus] in s.revealed = true; DispatchQueue.main.async { _ = focus() } }
        (controllers[nodeID] ?? controllers[""])?.handle = h
        return content
            .onChange(of: validity, initial: true) { _, next in
                let key = "\(next.valid)|\(next.validationMessage)"
                defer { s.lastKey = key }
                if let last = s.lastKey, last != key { changed(next.value) }   // the first evaluation only primes
            }
            .onChange(of: name) { _, _ in s.revealed = false }
            .onChange(of: formResets) { _, _ in s.revealed = false }
            .onChange(of: barred, initial: true) { _, disabled in if disabled { s.revealed = false } }
    }
}
