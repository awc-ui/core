import SwiftUI
import QuartzCore

// MARK: Options (utils/select-options.ts)

/// One option of md-select / md-multi-select / md-autocomplete (`SelectOptionData`).
struct AWCSelectOptionData: Equatable, Identifiable {
    var value = "", label = "", disabled = false, icon = "", iconColor = "", supportingText = "", selected = false
    var id: String { value }
}
enum AWCSelectOptions {
    /// `fromElement`: label = `label` property, else the trimmed text content.
    static func from(option n: AWCNode) -> AWCSelectOptionData {
        let p = n.properties
        func s(_ k: String) -> String { p[k]?.string ?? "" }
        let label = s("label").isEmpty ? n.authoredTextContent.trimmingCharacters(in: .whitespacesAndNewlines) : s("label").trimmingCharacters(in: .whitespacesAndNewlines)
        return .init(value: s("value"), label: label, disabled: p["disabled"]?.bool ?? false, icon: s("icon"), iconColor: s("iconColor"),
                     supportingText: s("supportingText"), selected: p["selected"]?.bool ?? false)
    }
    /// `fromInit`: label defaults to the value.
    static func from(init v: AWCValue) -> AWCSelectOptionData? {
        guard case .object = v, let value = v["value"].string ?? v["value"].number.map({ String(format: "%g", $0) }) else { return nil }
        func s(_ k: String) -> String { v[k].string ?? "" }
        return .init(value: value, label: v["label"].string ?? value, disabled: v["disabled"].bool ?? false, icon: s("icon"), iconColor: s("iconColor"),
                     supportingText: s("supportingText"), selected: v["selected"].bool ?? false)
    }
    /// The `options` property: an array, or a JSON string (malformed JSON degrades to an empty list).
    static func inits(_ v: AWCValue?) -> [AWCSelectOptionData] {
        guard let v else { return [] }
        if case .string(let json) = v {
            guard let data = json.data(using: .utf8), let parsed = try? JSONDecoder().decode(AWCValue.self, from: data) else { return [] }
            return parsed.array.compactMap(from(init:))
        }
        return v.array.compactMap(from(init:))
    }
    static func isOption(_ n: AWCNode) -> Bool { n.tag == "md-select-option" }
    static func hidden(_ n: AWCNode) -> Bool { n.properties["hidden"]?.bool ?? false }
    /// `collectOptions`: slotted md-select-option children (hidden ones skipped) win over the `options` property.
    static func collect(_ node: AWCNode, options: AWCValue?) -> [AWCSelectOptionData] {
        let slotted = node.children.filter(isOption)
        if !slotted.isEmpty { return slotted.filter { !hidden($0) }.map(from(option:)) }
        return inits(options)
    }
    /// `hiddenOptionLabel`: the label of a hidden option with that value (a "Choose one" placeholder option).
    static func hiddenLabel(_ node: AWCNode, value: String) -> String {
        node.children.first { isOption($0) && hidden($0) && ($0.properties["value"]?.string ?? "") == value }.map { from(option: $0).label } ?? ""
    }
    static func label(_ options: [AWCSelectOptionData], _ value: String) -> String { options.first { $0.value == value }?.label ?? "" }
}

// MARK: Hooks

/// The eight md-select hooks (`--md-select-*`); lengths are points (= CSS px), colours `#RRGGBB[AA]`.
public struct AWCSelectAppearance: Equatable, Sendable {
    public var width: Double?, minWidth: Double?, caretColor: String?, caretSize: Double?, clearColor: String?
    public var trailingGap: Double?, optionIconColor: String?, spinnerSize: Double?
    public init(width: Double? = nil, minWidth: Double? = nil, caretColor: String? = nil, caretSize: Double? = nil, clearColor: String? = nil,
                trailingGap: Double? = nil, optionIconColor: String? = nil, spinnerSize: Double? = nil) {
        func len(_ v: Double?) -> Double? { v.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil } }
        self.width = len(width); self.minWidth = len(minWidth); self.caretColor = awcFieldColor(caretColor); self.caretSize = len(caretSize)
        self.clearColor = awcFieldColor(clearColor); self.trailingGap = len(trailingGap); self.optionIconColor = awcFieldColor(optionIconColor)
        self.spinnerSize = len(spinnerSize)
    }
    /// Typed values (Laboratory): `width`, `minWidth`, `caretColor` …
    public init(values v: [String: AWCValue]) {
        func t(_ k: String) -> String? { (v[k]?.string).flatMap { $0.isEmpty ? nil : $0 } }
        self.init(width: v["width"]?.number, minWidth: v["minWidth"]?.number, caretColor: t("caretColor"), caretSize: v["caretSize"]?.number,
                  clearColor: t("clearColor"), trailingGap: v["trailingGap"]?.number, optionIconColor: t("optionIconColor"), spinnerSize: v["spinnerSize"]?.number)
    }
    /// CSS custom properties as authored on the host (`--md-select-caret-size: 30px`).
    public init(css: [String: String]) {
        func px(_ k: String) -> Double? { css[k].flatMap { Double($0.replacingOccurrences(of: "px", with: "").trimmingCharacters(in: .whitespaces)) } }
        self.init(width: px("--md-select-width"), minWidth: px("--md-select-min-width"), caretColor: css["--md-select-caret-color"], caretSize: px("--md-select-caret-size"),
                  clearColor: css["--md-select-clear-color"], trailingGap: px("--md-select-trailing-gap"), optionIconColor: css["--md-select-option-icon-color"],
                  spinnerSize: px("--md-select-spinner-size"))
    }
    public func merging(_ o: Self) -> Self {
        .init(width: o.width ?? width, minWidth: o.minWidth ?? minWidth, caretColor: o.caretColor ?? caretColor, caretSize: o.caretSize ?? caretSize,
              clearColor: o.clearColor ?? clearColor, trailingGap: o.trailingGap ?? trailingGap, optionIconColor: o.optionIconColor ?? optionIconColor,
              spinnerSize: o.spinnerSize ?? spinnerSize)
    }
}
private struct AWCSelectAppearanceKey: EnvironmentKey { static let defaultValue = AWCSelectAppearance() }
private struct AWCSelectAppearanceTargetsKey: EnvironmentKey { static let defaultValue: [String: AWCSelectAppearance] = [:] }
extension EnvironmentValues {
    var awcSelectAppearance: AWCSelectAppearance { get { self[AWCSelectAppearanceKey.self] } set { self[AWCSelectAppearanceKey.self] = newValue } }
    var awcSelectAppearanceTargets: [String: AWCSelectAppearance] { get { self[AWCSelectAppearanceTargetsKey.self] } set { self[AWCSelectAppearanceTargetsKey.self] = newValue } }
}
private struct AWCSelectAppearanceModifier: ViewModifier {
    let value: AWCSelectAppearance, id: String?
    @Environment(\.awcSelectAppearance) private var inherited
    @Environment(\.awcSelectAppearanceTargets) private var targets
    func body(content: Content) -> some View {
        if let id { var t = targets; t[id] = (t[id] ?? .init()).merging(value); return AnyView(content.environment(\.awcSelectAppearanceTargets, t)) }
        return AnyView(content.environment(\.awcSelectAppearance, inherited.merging(value)))
    }
}
public extension View {
    /// md-select hooks for the select with node id `id`, or for every descendant select when nil.
    func awcSelectAppearance(_ appearance: AWCSelectAppearance, for id: String? = nil) -> some View { modifier(AWCSelectAppearanceModifier(value: appearance, id: id)) }
}

// MARK: Methods

/// md-select methods: `show`, `close`, `focusTrigger`, `reset`, `getValidity`, `checkValidity`, `reportValidity`,
/// `setCustomValidity`, `setQuery`, `loadOptions`, `getLabels`. Attach with `.awcSelectController(_:for:)`.
@MainActor public final class AWCSelectController {
    weak var runtime: AWCSelectRuntime?
    public init() {}
    public var isConnected: Bool { runtime != nil }
    public func show() { runtime?.show() }
    public func close() { runtime?.close() }
    public func focusTrigger() { runtime?.focusTrigger() }
    public func reset() { runtime?.reset() }
    public func getValidity() -> AWCConstraintValidity { runtime?.validity() ?? .validState }
    public func checkValidity() -> Bool { runtime?.validity().valid ?? true }
    @discardableResult public func reportValidity() -> Bool { runtime?.reportValidity() ?? true }
    public func setCustomValidity(_ message: String) { runtime?.customMessage = message }
    /// Filters the menu as typing into its search field would (the text is mirrored into the field).
    public func setQuery(_ query: String) { runtime?.query = query; runtime?.queryText = query }
    /// Replaces the programmatic options (`loadOptions(array)`); native lists are not virtualized.
    public func loadOptions(_ options: [AWCValue]) { runtime?.loaded = options.compactMap(AWCSelectOptions.from(init:)) }
    /// Labels of the given values (values without an option are left out).
    public func getLabels(_ values: [String]) -> [String: String] { runtime?.labels(values) ?? [:] }
}
private struct AWCSelectControllersKey: EnvironmentKey { static let defaultValue: [String: AWCSelectController] = [:] }
extension EnvironmentValues {
    var awcSelectControllers: [String: AWCSelectController] { get { self[AWCSelectControllersKey.self] } set { self[AWCSelectControllersKey.self] = newValue } }
}
private struct AWCSelectControllerModifier: ViewModifier {
    let id: String, controller: AWCSelectController
    @Environment(\.awcSelectControllers) private var inherited
    func body(content: Content) -> some View { var c = inherited; c[id] = controller; return content.environment(\.awcSelectControllers, c) }
}
public extension View {
    /// Attach a method controller to the md-select with node id `id`, or to descendant selects when nil.
    func awcSelectController(_ controller: AWCSelectController, for id: String? = nil) -> some View { modifier(AWCSelectControllerModifier(id: id ?? "", controller: controller)) }
}

/// Runtime state of one md-select (open sync guard, event dedupe, query, validity presentation).
@MainActor @Observable final class AWCSelectRuntime {
    var query = ""
    @ObservationIgnored var queryText: String?
    var loaded: [AWCSelectOptionData]?
    var customMessage = ""
    var revealed = false
    var focused = false
    @ObservationIgnored var lastEmit: String?
    @ObservationIgnored var lastValidityKey: String?
    @ObservationIgnored var openedByKey = false
    /// Time (CACurrentMediaTime ms) of the last open/close write by an input handler: the caret rotation starts there (6-6).
    @ObservationIgnored var openWriteAt: Double = 0
    @ObservationIgnored var openSynced: Bool?
    @ObservationIgnored var valueNow = ""
    @ObservationIgnored var disabledNow = false
    @ObservationIgnored var validityNow = AWCConstraintValidity.validState
    @ObservationIgnored var optionsNow: [AWCSelectOptionData] = []
    @ObservationIgnored var show: () -> Void = {}
    @ObservationIgnored var close: () -> Void = {}
    @ObservationIgnored var focusTrigger: () -> Void = {}
    @ObservationIgnored var reset: () -> Void = {}
    @ObservationIgnored var validity: () -> AWCConstraintValidity = { .validState }
    @ObservationIgnored var reportValidity: () -> Bool = { true }
    @ObservationIgnored var labels: ([String]) -> [String: String] = { _ in [:] }
}

// MARK: Field click (the composite's onClick on its md-text-field)

extension AWCMenuRegistry {
    /// A pointer click inside `frame` (scope coordinates), outside every `exclude` frame, calls `handler` before the open menus
    /// handle the same click as an outside click (the target's own listener runs before the document's).
    func observeClicks(_ owner: String, frame: CGRect, exclude: [CGRect], handler: @escaping () -> Void) { clickObservers[owner] = .init(frame: frame, exclude: exclude, handler: handler) }
    func stopObservingClicks(_ owner: String) { clickObservers[owner] = nil }
}
struct AWCMenuClickObserver { var frame: CGRect, exclude: [CGRect], handler: () -> Void }
