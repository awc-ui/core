import SwiftUI

// MARK: Appearance (the `--md-multi-select-*` hooks)

/// A CSS `font` shorthand subset (`italic 500 15px Roboto`, `400 14px/20px Roboto`).
public struct AWCMultiSelectFont: Equatable, Sendable {
    public var italic = false, weight = 400.0, size = 14.0, line: Double? = nil
    public init(italic: Bool = false, weight: Double = 400, size: Double = 14, line: Double? = nil) { self.italic = italic; self.weight = weight; self.size = size; self.line = line }
    public init?(css: String) {
        var out = AWCMultiSelectFont(); var found = false
        for t in css.split(separator: " ").map(String.init) {
            if t == "italic" { out.italic = true }
            else if let w = Double(t), (100...900).contains(w) { out.weight = w }
            else if t.hasSuffix("px") || t.contains("px/") {
                let parts = t.split(separator: "/").map { Double($0.replacingOccurrences(of: "px", with: "")) }
                if let s = parts.first ?? nil { out.size = s; found = true }
                if parts.count > 1, let l = parts[1] { out.line = l }
            }
        }
        if !found { return nil }
        self = out
    }
}

/// The md-multi-select hooks; lengths are points (= CSS px), colours `#RRGGBB[AA]`. Paddings are CSS shorthands resolved to
/// (top, end, bottom, start).
public struct AWCMultiSelectAppearance: Equatable, Sendable {
    public var width: Double?, minWidth: Double?, triggerWidth: Double?, frameGap: Double?
    public var chipGap: Double?, chipHeight: Double?, chipRadius: Double?, chipOutline: String?
    public var caretColor: String?, caretSize: Double?, caretBoxSize: Double?
    public var clearColor: String?, clearBackground: String?, clearHoverBackground: String?, clearSize: Double?, clearIconSize: Double?, clearRadius: Double?
    public var clearFocusRingColor: String?, clearFocusRingWidth: Double?, clearFocusRingOffset: Double?
    public var optionIconColor: String?, optionIconSize: Double?
    public var searchBackground: String?, searchColor: String?, searchPlaceholderColor: String?, searchBorderColor: String?, searchBorderWidth: Double?
    public var searchPadding: [Double]?, searchSpinnerSize: Double?
    public var selectAllDividerColor: String?, selectAllDividerWidth: Double?
    public var emptyColor: String?, emptyPadding: [Double]?, emptyFont: AWCMultiSelectFont?
    public var loadingPadding: Double?, loaderSize: Double?, spinnerSize: Double?, inlineChipsBlockStart: Double?
    public init() {}
    static let keys: [String] = ["width", "min-width", "trigger-width", "frame-gap", "chip-gap", "chip-height", "chip-radius", "chip-outline", "caret-color", "caret-size",
                                 "caret-box-size", "clear-color", "clear-bg", "clear-hover-bg", "clear-size", "clear-icon-size", "clear-radius", "clear-focus-ring-color",
                                 "clear-focus-ring-width", "clear-focus-ring-offset", "option-icon-color", "option-icon-size", "search-bg", "search-color",
                                 "search-placeholder-color", "search-border-color", "search-border-width", "search-padding", "search-spinner-size",
                                 "select-all-divider-color", "select-all-divider-width", "empty-color", "empty-padding", "empty-font", "loading-padding", "loader-size",
                                 "spinner-size", "inline-chips-block-start"]
    /// CSS custom properties as authored on the host (`--md-multi-select-chip-height: 28px`).
    public init(css: [String: String]) {
        func raw(_ k: String) -> String? { css["--md-multi-select-" + k]?.trimmingCharacters(in: .whitespaces) }
        func px(_ k: String) -> Double? { raw(k).flatMap { Double($0.replacingOccurrences(of: "px", with: "").trimmingCharacters(in: .whitespaces)) }.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil } }
        func c(_ k: String) -> String? { raw(k).flatMap(awcFieldColor) }
        func box(_ k: String) -> [Double]? {
            guard let v = raw(k) else { return nil }
            let n = v.split(separator: " ").compactMap { Double($0.replacingOccurrences(of: "px", with: "")) }
            switch n.count { case 1: return [n[0], n[0], n[0], n[0]]; case 2: return [n[0], n[1], n[0], n[1]]; case 3: return [n[0], n[1], n[2], n[1]]
            case 4: return [n[0], n[1], n[2], n[3]]; default: return nil }
        }
        width = px("width"); minWidth = px("min-width"); triggerWidth = px("trigger-width"); frameGap = px("frame-gap")
        chipGap = px("chip-gap"); chipHeight = px("chip-height"); chipRadius = px("chip-radius"); chipOutline = c("chip-outline")
        caretColor = c("caret-color"); caretSize = px("caret-size"); caretBoxSize = px("caret-box-size")
        clearColor = c("clear-color"); clearBackground = c("clear-bg"); clearHoverBackground = c("clear-hover-bg"); clearSize = px("clear-size")
        clearIconSize = px("clear-icon-size"); clearRadius = px("clear-radius"); clearFocusRingColor = c("clear-focus-ring-color")
        clearFocusRingWidth = px("clear-focus-ring-width"); clearFocusRingOffset = px("clear-focus-ring-offset")
        optionIconColor = c("option-icon-color"); optionIconSize = px("option-icon-size")
        searchBackground = c("search-bg"); searchColor = c("search-color"); searchPlaceholderColor = c("search-placeholder-color")
        searchBorderColor = c("search-border-color"); searchBorderWidth = px("search-border-width"); searchPadding = box("search-padding"); searchSpinnerSize = px("search-spinner-size")
        selectAllDividerColor = c("select-all-divider-color"); selectAllDividerWidth = px("select-all-divider-width")
        emptyColor = c("empty-color"); emptyPadding = box("empty-padding"); emptyFont = raw("empty-font").flatMap(AWCMultiSelectFont.init(css:))
        loadingPadding = px("loading-padding"); loaderSize = px("loader-size"); spinnerSize = px("spinner-size"); inlineChipsBlockStart = px("inline-chips-block-start")
    }
    /// Typed values (Laboratory): camelCase keys of the hook names (`chipHeight`, `searchPadding` as a number or 4-array).
    public init(values v: [String: AWCValue]) {
        var css: [String: String] = [:]
        for k in Self.keys {
            let camel = k.split(separator: "-").enumerated().map { $0.offset == 0 ? String($0.element) : $0.element.prefix(1).uppercased() + $0.element.dropFirst() }.joined()
                .replacingOccurrences(of: "Bg", with: "Background")
            guard let x = v[camel] ?? v[k] else { continue }
            switch x {
            case .number(let n): css["--md-multi-select-" + k] = "\(n)px"
            case .string(let s) where !s.isEmpty: css["--md-multi-select-" + k] = s
            case .array(let a): css["--md-multi-select-" + k] = a.compactMap { $0.number.map { "\($0)px" } }.joined(separator: " ")
            default: break
            }
        }
        self.init(css: css)
    }
    public func merging(_ o: Self) -> Self {
        var r = self
        r.width = o.width ?? width; r.minWidth = o.minWidth ?? minWidth; r.triggerWidth = o.triggerWidth ?? triggerWidth; r.frameGap = o.frameGap ?? frameGap
        r.chipGap = o.chipGap ?? chipGap; r.chipHeight = o.chipHeight ?? chipHeight; r.chipRadius = o.chipRadius ?? chipRadius; r.chipOutline = o.chipOutline ?? chipOutline
        r.caretColor = o.caretColor ?? caretColor; r.caretSize = o.caretSize ?? caretSize; r.caretBoxSize = o.caretBoxSize ?? caretBoxSize
        r.clearColor = o.clearColor ?? clearColor; r.clearBackground = o.clearBackground ?? clearBackground; r.clearHoverBackground = o.clearHoverBackground ?? clearHoverBackground
        r.clearSize = o.clearSize ?? clearSize; r.clearIconSize = o.clearIconSize ?? clearIconSize; r.clearRadius = o.clearRadius ?? clearRadius
        r.clearFocusRingColor = o.clearFocusRingColor ?? clearFocusRingColor; r.clearFocusRingWidth = o.clearFocusRingWidth ?? clearFocusRingWidth
        r.clearFocusRingOffset = o.clearFocusRingOffset ?? clearFocusRingOffset
        r.optionIconColor = o.optionIconColor ?? optionIconColor; r.optionIconSize = o.optionIconSize ?? optionIconSize
        r.searchBackground = o.searchBackground ?? searchBackground; r.searchColor = o.searchColor ?? searchColor
        r.searchPlaceholderColor = o.searchPlaceholderColor ?? searchPlaceholderColor; r.searchBorderColor = o.searchBorderColor ?? searchBorderColor
        r.searchBorderWidth = o.searchBorderWidth ?? searchBorderWidth; r.searchPadding = o.searchPadding ?? searchPadding; r.searchSpinnerSize = o.searchSpinnerSize ?? searchSpinnerSize
        r.selectAllDividerColor = o.selectAllDividerColor ?? selectAllDividerColor; r.selectAllDividerWidth = o.selectAllDividerWidth ?? selectAllDividerWidth
        r.emptyColor = o.emptyColor ?? emptyColor; r.emptyPadding = o.emptyPadding ?? emptyPadding; r.emptyFont = o.emptyFont ?? emptyFont
        r.loadingPadding = o.loadingPadding ?? loadingPadding; r.loaderSize = o.loaderSize ?? loaderSize; r.spinnerSize = o.spinnerSize ?? spinnerSize
        r.inlineChipsBlockStart = o.inlineChipsBlockStart ?? inlineChipsBlockStart
        return r
    }
}
private struct AWCMultiSelectAppearanceKey: EnvironmentKey { static let defaultValue = AWCMultiSelectAppearance() }
private struct AWCMultiSelectAppearanceTargetsKey: EnvironmentKey { static let defaultValue: [String: AWCMultiSelectAppearance] = [:] }
extension EnvironmentValues {
    var awcMultiSelectAppearance: AWCMultiSelectAppearance { get { self[AWCMultiSelectAppearanceKey.self] } set { self[AWCMultiSelectAppearanceKey.self] = newValue } }
    var awcMultiSelectAppearanceTargets: [String: AWCMultiSelectAppearance] { get { self[AWCMultiSelectAppearanceTargetsKey.self] } set { self[AWCMultiSelectAppearanceTargetsKey.self] = newValue } }
}
private struct AWCMultiSelectAppearanceModifier: ViewModifier {
    let value: AWCMultiSelectAppearance, id: String?
    @Environment(\.awcMultiSelectAppearance) private var inherited
    @Environment(\.awcMultiSelectAppearanceTargets) private var targets
    func body(content: Content) -> some View {
        if let id { var t = targets; t[id] = (t[id] ?? .init()).merging(value); return AnyView(content.environment(\.awcMultiSelectAppearanceTargets, t)) }
        return AnyView(content.environment(\.awcMultiSelectAppearance, inherited.merging(value)))
    }
}
public extension View {
    /// md-multi-select hooks for every multi-select below (or only the one with source `id`).
    func awcMultiSelectAppearance(_ appearance: AWCMultiSelectAppearance, for id: String? = nil) -> some View { modifier(AWCMultiSelectAppearanceModifier(value: appearance, id: id)) }
}

// MARK: Controller

/// md-multi-select methods. Attach with `.awcMultiSelectController(_:for:)`.
@MainActor public final class AWCMultiSelectController {
    weak var runtime: AWCMultiSelectRuntime?
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
    /// Filters the menu as typing into its search field would.
    public func setQuery(_ query: String) { runtime?.query = query; runtime?.queryText = query }
    /// Replaces the programmatic options (native lists are not virtualized).
    public func loadOptions(_ options: [AWCValue]) { runtime?.loaded = options.compactMap(AWCSelectOptions.from(init:)) }
    public func getLabels(_ values: [String]) -> [String: String] { runtime?.labels(values) ?? [:] }
}
private struct AWCMultiSelectControllersKey: EnvironmentKey { static let defaultValue: [String: AWCMultiSelectController] = [:] }
extension EnvironmentValues {
    var awcMultiSelectControllers: [String: AWCMultiSelectController] { get { self[AWCMultiSelectControllersKey.self] } set { self[AWCMultiSelectControllersKey.self] = newValue } }
}
private struct AWCMultiSelectControllerModifier: ViewModifier {
    let id: String, controller: AWCMultiSelectController
    @Environment(\.awcMultiSelectControllers) private var inherited
    func body(content: Content) -> some View { var c = inherited; c[id] = controller; return content.environment(\.awcMultiSelectControllers, c) }
}
public extension View {
    func awcMultiSelectController(_ controller: AWCMultiSelectController, for id: String? = nil) -> some View { modifier(AWCMultiSelectControllerModifier(id: id ?? "", controller: controller)) }
}

@MainActor @Observable final class AWCMultiSelectRuntime {
    var query = ""
    var queryText: String?
    var loaded: [AWCSelectOptionData]?
    var customMessage = ""
    var revealed = false
    var focused = false
    var searchFocus = 0
    var chipWidths: [String: CGFloat] = [:]
    var plusWidth: CGFloat = 0
    var inlineStart: CGFloat = 0
    var trailingStart: CGFloat = 0
    @ObservationIgnored var lastEmit: String?
    @ObservationIgnored var lastValidityKey: String?
    @ObservationIgnored var openedByKey = false
    @ObservationIgnored var valueNow: [String] = []
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

// MARK: Renderer

/// md-multi-select: a read-only md-text-field (or a compact md-button) trigger, the selection as md-chip tokens beside it
/// (or inside the field), and an md-menu listbox of checkbox option rows with the optional search field and "Select all"
/// row pinned in its header — composed from the library's own renderers as the source composes its primitives. The menu
/// presents in the nearest `AWCMenuScope`.
struct AWCNativeMultiSelect: View {
    let node: AWCNode, local: [String: AWCValue], theme: AWCTheme
    let set: (String, AWCValue) -> Void
    let emit: (String, AWCValue) -> Void
    let child: (AWCNode, @escaping (AWCEvent) -> Void) -> AnyView
    @Environment(\.awcMenuRegistry) private var registry
    @Environment(\.awcMultiSelectAppearance) private var inheritedAppearance
    @Environment(\.awcMultiSelectAppearanceTargets) private var appearanceTargets
    @Environment(\.awcMultiSelectControllers) private var controllers
    @Environment(\.awcTextFieldAppearanceTargets) private var fieldTargets
    @Environment(\.awcNativeSpacingRung) private var inheritedRung
    @Environment(\.accessibilityReduceMotion) private var systemReduced
    @Environment(\.awcFieldReducedMotion) private var reducedOverride
    @Environment(\.layoutDirection) private var direction
    @State private var rt = AWCMultiSelectRuntime()
    @State private var field = AWCTextFieldController()
    @State private var fieldFrame: CGRect = .zero
    @State private var clearFrame: CGRect = .zero
    @State private var inlineFrame: CGRect = .zero
    @State private var clearHover = false
    @FocusState private var clearFocused: Bool

    private func s(_ k: String, _ d: String = "") -> String { local[k]?.string.nonEmpty ?? d }
    private func b(_ k: String, _ d: Bool = false) -> Bool { local[k]?.bool ?? d }
    private var appearance: AWCMultiSelectAppearance { inheritedAppearance.merging(appearanceTargets[node.id] ?? .init()) }
    private var reduced: Bool { reducedOverride ?? systemReduced }
    private var open: Bool { b("open") }
    private var disabled: Bool { b("disabled") }
    private var isDisabled: Bool { disabled || b("softDisabled") }
    private var value: [String] {
        switch local["value"] {
        case .array(let a)?: return a.map { $0.string }
        case .string(let s)? where !s.isEmpty:
            if let d = s.data(using: .utf8), let a = try? JSONDecoder().decode([String].self, from: d) { return a }
            return [s]
        default: return []
        }
    }
    private var options: [AWCSelectOptionData] { rt.loaded ?? AWCSelectOptions.collect(node, options: local["options"]) }
    private var selected: [AWCSelectOptionData] { value.compactMap { v in options.first { $0.value == v } } }
    private var displayMode: String { ["chips", "chips-inline", "count", "text"].contains(s("displayMode")) ? s("displayMode") : "chips" }
    private var chipOverflow: String { s("chipOverflow") == "wrap" ? "wrap" : "count" }
    private var chipPosition: String { ["bottom", "top", "left", "right"].contains(s("chipPosition")) ? s("chipPosition") : "bottom" }
    private var buttonTrigger: Bool { s("trigger") == "button" }
    private var inline: Bool { !buttonTrigger && displayMode == "chips-inline" }
    /// The chip-position classes apply to the button trigger and display-mode="chips".
    private var positioned: Bool { buttonTrigger || displayMode == "chips" }
    private var position: String { positioned ? chipPosition : "bottom" }
    private var anchorID: String { node.id + "::trigger" }
    private var menuID: String { node.id + "::menu" }
    private var accessibleName: String { s("label").nonEmpty ?? s("aria-label").nonEmpty ?? s("ariaLabel") }
    private var hostDensity: Double { local["density"]?.number ?? 0 }
    private var validity: AWCConstraintValidity {
        if !rt.customMessage.isEmpty { return .init(flag: "customError", message: rt.customMessage) }
        if b("required") && value.isEmpty { return .init(flag: "valueMissing", message: s("valueMissingLabel", "Please select at least one option")) }
        return .validState
    }
    private var validationMessage: String { rt.revealed && !validity.valid ? validity.validationMessage : "" }
    /// `--md-sys-spacing-inset-lg` / `-md` of the host's density rung.
    private var rung: Double { [-1.0, -2, -3, -4].contains(hostDensity) ? hostDensity : inheritedRung }
    private var insetLG: Double { rung <= -4 ? 8 : rung <= -2 ? 12 : 16 }
    /// `--md-sys-spacing-gap-xs` (the chip gap's fallback): 2 on the −4 rung.
    private var gapXS: Double { rung <= -4 ? 2 : 4 }
    private var tint: String { theme.tokens["--md-sys-color-on-surface-variant"].flatMap(awcFieldColor) ?? "#49454F" }
    private func token(_ k: String, _ d: String) -> String { theme.tokens[k].flatMap(awcFieldColor) ?? d }
    private var countText: String { value.isEmpty ? "" : "\(value.count) selected" }

    var body: some View {
        if b("hidden") { EmptyView() } else { composed }
    }
    private var composed: some View {
        let a = appearance, minW = a.minWidth ?? 200
        return VStack(alignment: .leading, spacing: 0) {
            frame
            menu
        }
        .frame(minWidth: CGFloat(minW), maxWidth: a.width.map { CGFloat(max($0, minW)) } ?? .infinity, alignment: .leading)
        .awcInspect(nodeID: node.id, name: "md-multi-select") { _ in
            ["value": .array(value.map { .string($0) }), "open": .bool(open), "focused": .bool(rt.focused), "valid": .bool(validity.valid), "validationMessage": .string(validationMessage)]
        }
        .onAppear { connect() }
        .onDisappear { registry?.stopObservingClicks(node.id) }
        .onChange(of: open) { _, o in syncMenu(o) }
        .onChange(of: validity, initial: true) { _, next in
            rt.validityNow = next
            let key = next.key; defer { rt.lastValidityKey = key }
            if let last = rt.lastValidityKey, last != key { emit("mdValidityChange", next.eventValue) }
        }
        .onChange(of: fieldFrame) { _, f in observeClicks(f) }
        .onChange(of: clearFrame) { _, _ in observeClicks(fieldFrame) }
        .onChange(of: value, initial: true) { _, v in rt.valueNow = v }
        .onChange(of: options, initial: true) { _, o in rt.optionsNow = o }
    }

    // MARK: Frame (trigger + chips)

    /// `.md-multi-select__frame`: a flex column (bottom), column-reverse (top) or row (left / right) of the trigger and the chips.
    @ViewBuilder private var frame: some View {
        let a = appearance
        let gap = a.frameGap ?? max(6, 8 + hostDensity * 0.5)
        let topGap = a.frameGap ?? max(6, 16 + hostDensity * 2.5)
        let showChips = positioned && !selected.isEmpty
        Group {
            switch position {
            case "top":
                VStack(alignment: .leading, spacing: topGap) { if showChips { chips }; trigger }
            case "left", "right":
                HStack(alignment: .center, spacing: gap) {
                    if showChips && position == "left" { chips }
                    trigger
                    if showChips && position == "right" { chips }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            default:
                VStack(alignment: .leading, spacing: gap) { trigger; if showChips { chips } }
            }
        }
        .awcInspect(nodeID: node.id, part: "frame", name: "frame")
    }
    private var chipAppearance: AWCChipHookAppearance {
        let a = appearance
        return AWCChipHookAppearance(containerShape: .points(a.chipRadius ?? 8), containerHeight: .points(a.chipHeight ?? 32),
                                     outlineColor: a.chipOutline ?? token("--md-sys-color-outline-variant", "#CAC4D0"))
    }
    private func chipNode(_ o: AWCSelectOptionData, _ k: Int, prefix: String) -> some View {
        let n = AWCNode(id: "\(node.id)::\(prefix)\(k)", tag: "md-chip", properties: ["variant": "input", "selectable": false, "label": .string(o.label),
                                                                                      "disabled": .bool(isDisabled), "removable": .bool(!isDisabled)])
        return child(n, { e in if e.name == "mdRemove" { removeValue(o.value) } })
    }
    /// `.md-multi-select__chips`: removable tokens of the selection (wrapping row, gap chip-gap).
    private var chips: some View {
        let a = appearance
        return AWCMultiChipsFlow(gap: a.chipGap ?? gapXS, rowGap: a.chipGap ?? gapXS, wrap: true) {
            ForEach(Array(selected.enumerated()), id: \.element.value) { k, o in
                chipNode(o, k, prefix: "chip").awcInspect(nodeID: node.id, part: "chip-\(k)", name: "chip")
            }
        }
        .awcChipAppearance(chipAppearance)
        // Bottom / top: a block-level flex row (the full frame width); left / right: flex 0 1 auto beside the trigger.
        .frame(maxWidth: position == "left" || position == "right" ? nil : .infinity, alignment: .leading)
        .layoutPriority(position == "left" || position == "right" ? 0 : 1)
        .awcInspect(nodeID: node.id, part: "chips", name: "chips")
    }

    // MARK: Trigger

    @ViewBuilder private var trigger: some View {
        if buttonTrigger { buttonTriggerView } else { fieldTrigger }
    }
    /// Chrome's max-content width of a density −3 md-text-field (a size-20 input): the left / right chip positions.
    private static let fieldMaxContent = 213.0
    private var fieldTrigger: some View {
        let a = appearance
        let sideways = position == "left" || position == "right"
        let displayValue = inline ? "" : displayMode == "text" && !selected.isEmpty ? selected.map(\.label).joined(separator: ", ") : countText
        var p: [String: AWCValue] = [:]
        p["variant"] = .string(s("variant", "outlined")); p["label"] = .string(s("label"))
        if s("label").isEmpty, !accessibleName.isEmpty { p["aria-label"] = .string(accessibleName) }
        p["placeholder"] = .string(selected.isEmpty ? s("placeholder") : ""); p["readOnly"] = true; p["disabled"] = .bool(disabled); p["required"] = .bool(b("required"))
        p["error"] = .bool(b("error") || !validationMessage.isEmpty); p["errorText"] = .string(s("errorText").nonEmpty ?? validationMessage)
        p["reserveSupportingSpace"] = .bool(b("reserveSupportingSpace")); p["supportingText"] = .string(s("supportingText"))
        if sideways { p["density"] = -3 } else if let d = local["density"]?.number { p["density"] = .number(d) }
        p["appearFocused"] = .bool(open)
        p["chipsWrap"] = .bool(inline && chipOverflow == "wrap")
        let inner = AWCNode(id: node.id, tag: "md-text-field", properties: p)
        let inlineNode = AWCNode(id: node.id + "::inline", tag: "#awc-multi-inline", properties: [:])
        var hooks = AWCFieldHooks()
        hooks.controller = field
        hooks.key = { key, composing in fieldKey(key, composing) }
        hooks.focus = { f in rt.focused = f }
        hooks.trailing = AnyView(trailing)
        hooks.readOnlyKeys = true
        let padding = fieldTargets[node.id]?.paddingInlineEnd == nil ? AWCTextFieldAppearance(paddingInlineEnd: insetLG) : AWCTextFieldAppearance()
        let width: Double? = sideways ? (a.triggerWidth ?? Self.fieldMaxContent + (showClear ? (a.clearSize ?? 28) : 0) + ((a.caretBoxSize ?? 24) - 24)) : nil
        return AWCNativeTextField(node: inner, theme: theme, value: displayValue, setValue: { _ in }, emit: { _, _ in },
                                  leading: [], trailing: [], chips: inline && !selected.isEmpty ? [inlineNode] : [], clearIcon: [], passwordIcon: [], speechIcon: [], errorIcon: [],
                                  child: { n in n.id == inlineNode.id ? AnyView(inlineChips) : child(n, { _ in }) }, hooks: hooks)
            .awcTextFieldAppearance(padding)
            .frame(width: width.map { CGFloat($0) })
            .awcMenuAnchor(anchorID, label: nil, focus: { field.setFocus() })
            .modifier(AWCSelectScopeFrame(registry: registry) { fieldFrame = $0 })
            .overlay { AWCSelectClickCatcher(exclude: fieldFrame.width > 0 ? ((showClear ? [clearFrame] : []) + (inline && !selected.isEmpty ? [inlineFrame] : []))
                                                .map { $0.offsetBy(dx: -fieldFrame.minX, dy: -fieldFrame.minY) } : [],
                                             press: { _ = field.setFocus() }, click: { toggleOpen() }) }
            .awcInspect(nodeID: node.id, part: "field", name: "field")
    }
    /// The compact button trigger (md-button outlined xs with the trigger icon); the selection shows as chips beside it.
    private var buttonTriggerView: some View {
        let label = s("triggerLabel").nonEmpty ?? s("label")
        let n = AWCNode(id: anchorID, tag: "md-button", properties: ["variant": "outlined", "size": "xs", "icon": .string(s("triggerIcon", "add")),
                                                                  "loading": .bool(b("loading")), "disabled": .bool(isDisabled), "aria-haspopup": "listbox", "fullWidth": true],
                        children: [AWCNode(id: anchorID + "~t", tag: "#text", properties: ["text": .string(label)])])
        let message = (b("error") || !validationMessage.isEmpty) && !(s("errorText").nonEmpty ?? validationMessage).isEmpty ? (s("errorText").nonEmpty ?? validationMessage) : s("supportingText")
        let isError = (b("error") || !validationMessage.isEmpty) && !(s("errorText").nonEmpty ?? validationMessage).isEmpty
        return VStack(alignment: .leading, spacing: 0) {
            child(n, { e in if e.name == "mdClick" { toggleOpen() } })
                .frame(maxWidth: .infinity, alignment: .leading)
                .awcMenuAnchor(anchorID, label: nil)
                .awcInspect(nodeID: node.id, part: "field", name: "field")
            if !message.isEmpty {
                Text(message).font(AWCNativeFonts.label(size: 12, regular: true)).lineSpacing(0).frame(minHeight: 16, alignment: .topLeading)
                    .foregroundStyle(Color(awcHex: isError ? token("--md-sys-color-error", "#B3261E") : tint))
                    .padding(.top, 4).padding(.horizontal, 16)
                    .awcInspect(nodeID: node.id, part: "button-desc", name: "button-desc")
            }
        }
    }
    private var showClear: Bool { b("clearable") && !selected.isEmpty && !isDisabled }
    /// The trailing cluster: the loader while loading, else the clear button and the caret box.
    private var trailing: some View {
        let a = appearance
        return Group {
            if b("loading") {
                loader.frame(width: a.loaderSize ?? 24, height: a.loaderSize ?? 24)
                    .awcInspect(nodeID: node.id, part: "loading-spinner", name: "loading-spinner")
            } else {
                HStack(spacing: 0) {
                    if showClear { clearButton }
                    AWCSelectCaret(nodeID: node.id, open: open, reduced: reduced, size: a.caretSize ?? 24, color: a.caretColor ?? tint, glyph: s("dropdownIcon", "arrow_drop_down"),
                                   slot: node.children(inSlot: "dropdown-icon"), child: { child($0, { _ in }) })
                        .frame(width: a.caretBoxSize ?? 24, height: a.caretBoxSize ?? 24)
                        .awcInspect(nodeID: node.id, part: "caret", name: "caret")
                        .awcInspect(nodeID: node.id, part: "caret-box", name: "caret-box")
                        .accessibilityHidden(true)
                }
            }
        }
        .onGeometryChange(for: CGRect.self) { $0.frame(in: .global) } action: { f in rt.trailingStart = direction == .rightToLeft ? f.maxX : f.minX }
    }
    private var loader: some View {
        let size = appearance.spinnerSize ?? 22
        return Group {
            if let slot = node.children(inSlot: "loader").first { child(slot, { _ in }) }
            else { child(AWCNode(id: node.id + "::loader", tag: "md-loading-indicator", properties: ["label": .string(s("loadingText", "Loading…"))]), { _ in }) }
        }
        .awcLoadingIndicatorAppearance(.init(size: size, shapeSize: size))
    }
    /// `.md-multi-select__clear`: a real button (28 × 28, round) before the caret; hover tints it with on-surface 8 %.
    private var clearButton: some View {
        let a = appearance, size = a.clearSize ?? 28
        let color = a.clearColor ?? tint
        let hover = a.clearHoverBackground ?? awcFieldMix(token("--md-sys-color-on-surface", "#1D1B20"), 0.08)
        let bg = clearHover ? hover : (a.clearBackground ?? "#00000000")
        let radius = a.clearRadius ?? size / 2
        return Button(action: clearValue) {
            AWCFieldGlyph(name: s("clearIcon", "close"), size: a.clearIconSize ?? 18, fill: 0)
                .foregroundStyle(Color(awcHex: color))
                .frame(width: size, height: size)
                .background(RoundedRectangle(cornerRadius: radius).fill(Color(awcHex: bg)))
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .focusable().focused($clearFocused)
        .overlay {
            if clearFocused {
                let w = a.clearFocusRingWidth ?? 2, off = a.clearFocusRingOffset ?? 1
                RoundedRectangle(cornerRadius: radius + off + w / 2).strokeBorder(Color(awcHex: a.clearFocusRingColor ?? token("--md-sys-color-primary", "#6750A4")), lineWidth: w)
                    .padding(-(off + w)).allowsHitTesting(false)
            }
        }
        .onHover { clearHover = $0 }
        .accessibilityLabel(s("clearLabel", "Clear selection"))
        .modifier(AWCSelectScopeFrame(registry: registry) { clearFrame = $0 })
        .awcInspect(nodeID: node.id, part: "clear", name: "clear")
    }

    // MARK: Inline chips (display-mode="chips-inline")

    /// Chips inside the field. `wrap` grows the field; `count` keeps one line and collapses the chips that do not fit into a
    /// "+N" chip, from the intrinsic chip widths (measured in a hidden row) and the width up to the trailing cluster.
    private var inlineChips: some View {
        let a = appearance, gap = a.chipGap ?? gapXS
        let wrap = chipOverflow == "wrap"
        let all = selected
        let visible = wrap ? all.count : visibleCount(all, gap: gap)
        let overflow = all.count - visible
        return AWCMultiChipsFlow(gap: gap, rowGap: gap, wrap: wrap) {
            ForEach(Array(all.prefix(visible).enumerated()), id: \.element.value) { k, o in
                chipNode(o, k, prefix: "chip").awcInspect(nodeID: node.id, part: "chip-\(k)", name: "chip")
            }
            if overflow > 0 {
                overflowChip(overflow).awcInspect(nodeID: node.id, part: "overflow-chip", name: "overflow-chip")
            }
        }
        .frame(width: inlineAvailable.map { wrap ? $0 + 4 : $0 }, alignment: .leading)
        .padding(.top, wrap ? (a.inlineChipsBlockStart ?? 4) : 0)
        .clipped()
        .awcChipAppearance(chipAppearance)
        .background(alignment: .topLeading) { if !wrap { measureRow(all, gap: gap) } }
        .onGeometryChange(for: CGRect.self) { $0.frame(in: .global) } action: { f in rt.inlineStart = direction == .rightToLeft ? f.maxX : f.minX }
        .modifier(AWCSelectScopeFrame(registry: registry) { inlineFrame = $0 })
        .awcInspect(nodeID: node.id, part: "chips", name: "chips")
    }
    /// The display row's width: from its start to the trailing cluster (the row is flex 1 1 auto in the field's chip area).
    private var inlineAvailable: CGFloat? {
        guard rt.trailingStart != 0, rt.inlineStart != 0 else { return nil }
        let w = direction == .rightToLeft ? rt.inlineStart - rt.trailingStart - 4 : rt.trailingStart - rt.inlineStart - 4
        return w > 0 ? w : nil
    }
    private func visibleCount(_ all: [AWCSelectOptionData], gap: Double) -> Int {
        guard let avail = inlineAvailable else { return all.count }
        let widths = all.map { rt.chipWidths[$0.value] ?? 0 }
        if widths.contains(where: { $0 <= 0 }) { return all.count }
        let sumAll = widths.enumerated().reduce(0.0) { $0 + Double($1.element) + ($1.offset > 0 ? gap : 0) }
        if sumAll <= Double(avail) + 0.5 { return all.count }
        let budget = Double(avail) - Double(rt.plusWidth > 0 ? rt.plusWidth : 44) - gap
        var used = 0.0, visible = 0
        for (i, w) in widths.enumerated() { let add = Double(w) + (i > 0 ? gap : 0); if used + add <= budget { used += add; visible += 1 } else { break } }
        return visible
    }
    /// The hidden measurement row (`.md-multi-select__inline-measure`): every chip at its intrinsic width plus a "+N" chip.
    private func measureRow(_ all: [AWCSelectOptionData], gap: Double) -> some View {
        HStack(spacing: gap) {
            ForEach(Array(all.enumerated()), id: \.element.value) { k, o in
                chipNode(o, k, prefix: "measure").fixedSize()
                    .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { w in if rt.chipWidths[o.value] != w { rt.chipWidths[o.value] = w } }
            }
            overflowChip(all.count).fixedSize().onGeometryChange(for: CGFloat.self) { $0.size.width } action: { w in if rt.plusWidth != w { rt.plusWidth = w } }
        }
        .fixedSize()
        .hidden()
        .allowsHitTesting(false)
        .accessibilityHidden(true)
        .frame(width: 0, height: 0, alignment: .topLeading)
    }
    /// `.md-multi-select__overflow-chip`: "+N" (padding 12, 1 px chip-outline border, chip radius). Chrome renders its label in
    /// the inherited 16 px / 400 Roboto with `line-height: normal`: the source's `font` shorthand holds `var()` fallbacks
    /// with commas and is invalid at computed-value time.
    private func overflowChip(_ n: Int) -> some View {
        let a = appearance, h = a.chipHeight ?? 32, r = a.chipRadius ?? 8
        let outline = a.chipOutline ?? token("--md-sys-color-outline-variant", "#CAC4D0")
        // Chrome's fractional label advance (the chip is 26 + text wide, not the text's pixel-rounded box).
        return Text("+\(n)").font(AWCNativeFonts.label(size: 16, regular: true)).foregroundStyle(Color(awcHex: tint))
            .lineLimit(1).fixedSize().frame(width: awcMenuTextWidth("+\(n)", size: 16, weight: 400))
            .padding(.horizontal, 13).frame(height: h)
            .overlay(RoundedRectangle(cornerRadius: r).strokeBorder(Color(awcHex: outline), lineWidth: 1))
            .contentShape(Rectangle())
            .onTapGesture { toggleOpen() }
            .accessibilityElement().accessibilityLabel("\(n) more selected — open to manage").accessibilityAddTraits(.isButton)
    }

    // MARK: Menu

    private var query: String { b("filterable") ? rt.query.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() : "" }
    private var listOptions: [AWCSelectOptionData] {
        let q = query
        return q.isEmpty ? options : options.filter { $0.label.lowercased().contains(q) || $0.supportingText.lowercased().contains(q) }
    }
    private var rows: [AWCNode] {
        guard !b("loading") else { return [] }
        let a = appearance, iconColor = a.optionIconColor ?? tint
        return listOptions.enumerated().map { i, o in
            let p: [String: AWCValue] = ["presentation": "option", "type": "checkbox", "checkPosition": "start", "keepOpen": true, "disabled": .bool(o.disabled),
                                         "selected": .bool(value.contains(o.value)), "headline": .string(o.label), "supportingText": .string(o.supportingText),
                                         "optionValue": .string(o.value)]
            let icon = o.icon.isEmpty ? [] : [AWCNode(id: "\(node.id)::opt\(i)::icon", tag: "#symbol", properties: ["name": .string(o.icon), "color": .string(awcFieldColor(o.iconColor) ?? iconColor),
                                                                                                                  "size": .number(a.optionIconSize ?? 20)], slot: "leading-icon")]
            return AWCNode(id: "\(node.id)::opt\(i)", tag: "md-menu-item", properties: p, children: icon)
        }
    }
    private var menu: some View {
        var p: [String: AWCValue] = ["anchor": .string(anchorID), "placement": .string(s("placement", "bottom-start")),
                                     "matchAnchorWidth": .bool(b("matchTriggerWidth", true)), "emptyText": "", "autoFocus": .bool(!b("filterable")),
                                     "listbox": true, "listLabel": .string(accessibleName.nonEmpty ?? "Options")]
        if let mh = local["maxHeight"], mh != .null { p["maxHeight"] = mh }
        if let d = local["density"]?.number { p["density"] = .number(d) }
        // "Select all" (pinned in the header) precedes the options in the roving order, as in the source's DOM.
        if b("showSelectAll") && !b("loading") && !options.isEmpty { p["headerRows"] = .array([.string(node.id + "::selectAll")]) }
        let menuNode = AWCNode(id: menuID, tag: "md-menu", properties: p, children: rows)
        let byID = Dictionary(listOptions.enumerated().map { ("\(node.id)::opt\($0.offset)", $0.element.value) }, uniquingKeysWith: { a, _ in a })
        return AWCNativeView(node: menuNode) { e in
            switch e.name {
            case "mdOpen": menuOpened()
            case "mdClose": menuClosed()
            case "mdClick": if let v = byID[e.nodeID] { toggleValue(v) }
            default: break
            }
        }
        .awcMenuHeader(for: menuID) { header }
    }
    private var eligible: [String] { options.filter { !$0.disabled }.map(\.value) }
    @ViewBuilder private var header: some View {
        let a = appearance
        let showNoOptions = !b("loading") && query.isEmpty && options.isEmpty
        let showNoResults = !b("loading") && !query.isEmpty && listOptions.isEmpty
        VStack(spacing: 0) {
            if b("filterable") && !b("loading") {
                AWCMultiSearchField(text: Binding(get: { rt.query }, set: { rt.query = $0; rt.queryText = nil }), placeholder: s("searchPlaceholder", "Search…"),
                                    label: s("filterLabel").nonEmpty ?? (s("label").isEmpty ? "Filter options" : "Filter \(s("label"))"), theme: theme, appearance: a,
                                    focusRequest: rt.searchFocus, pending: rt.queryText, consumed: { rt.queryText = nil })
                    .awcInspect(nodeID: node.id, part: "search", name: "search")
                    .awcInspect(nodeID: node.id, part: "search-wrap", name: "search-wrap")
            }
            if b("showSelectAll") && !b("loading") && !options.isEmpty {
                let all = !eligible.isEmpty && eligible.allSatisfy { value.contains($0) }
                let some = !all && eligible.contains { value.contains($0) }
                let n = AWCNode(id: node.id + "::selectAll", tag: "md-menu-item", properties: ["type": "checkbox", "checkPosition": "start", "roleOverride": "checkbox", "keepOpen": true,
                                                                                             "headline": .string(s("selectAllLabel", "Select all")), "selected": .bool(all),
                                                                                             "indeterminate": .bool(some), "disabled": .bool(isDisabled)])
                VStack(spacing: 0) {
                    child(n, { e in if e.name == "mdClick" { toggleSelectAll() } })
                        .awcInspect(nodeID: node.id, part: "select-all-item", name: "select-all-item")
                    Rectangle().fill(Color(awcHex: a.selectAllDividerColor ?? token("--md-sys-color-outline-variant", "#CAC4D0"))).frame(height: a.selectAllDividerWidth ?? 1)
                }
                .awcInspect(nodeID: node.id, part: "select-all", name: "select-all")
            }
            if b("loading") {
                let pad = a.loadingPadding ?? insetLG
                child(AWCNode(id: node.id + "::progress", tag: "md-progress-indicator", properties: ["variant": "linear", "indeterminate": true, "wave": true, "label": .string(s("loadingText", "Loading…"))]), { _ in })
                    .frame(maxWidth: .infinity)
                    .awcInspect(nodeID: node.id, part: "loading-progress", name: "loading-progress")
                    .padding(.vertical, pad).padding(.horizontal, pad)
                    .awcInspect(nodeID: node.id, part: "loading-bar", name: "loading-bar")
            } else if showNoOptions || showNoResults {
                emptyView(showNoOptions ? s("noOptionsText", "No options") : s("noResultsText", "No results"))
            }
        }
    }
    /// `.md-multi-select__empty`: the centred no-options / no-results message (body-medium, on-surface-variant).
    private func emptyView(_ text: String) -> some View {
        let a = appearance, f = a.emptyFont ?? AWCMultiSelectFont(size: 14, line: 20)
        let pad = a.emptyPadding ?? [12, 16, 12, 16]
        let line = f.line ?? ((AWCFieldMetrics.ascent + AWCFieldMetrics.descent) * f.size).rounded()
        return Text(text).font(AWCNativeFonts.label(size: f.size, weight: f.weight)).italic(f.italic)
            .foregroundStyle(Color(awcHex: a.emptyColor ?? tint))
            .multilineTextAlignment(.center)
            .frame(minHeight: line)
            .frame(maxWidth: .infinity)
            .padding(.top, pad[0]).padding(.trailing, pad[1]).padding(.bottom, pad[2]).padding(.leading, pad[3])
            .awcInspect(nodeID: node.id, part: "empty", name: "empty")
    }

    // MARK: Behaviour

    private func connect() {
        let r = rt
        rt.show = { if !isDisabled { set("open", true) } }
        rt.close = { set("open", false) }
        rt.focusTrigger = { [field] in _ = field.setFocus() }
        rt.reset = { guard !r.valueNow.isEmpty else { return }; set("value", .array([])); emit("mdChange", .array([])) }
        rt.validity = { r.validityNow }
        rt.reportValidity = { [field] in if r.validityNow.valid { return true }; r.revealed = true; _ = field.setFocus(); return false }
        rt.labels = { values in Dictionary(values.compactMap { v in r.optionsNow.first { $0.value == v }.map { (v, $0.label) } }, uniquingKeysWith: { a, _ in a }) }
        (controllers[node.id] ?? controllers[""])?.runtime = rt
        if open { syncMenu(true) }
        observeClicks(fieldFrame)
    }
    private func observeClicks(_ frame: CGRect) {
        // The field's click catcher (AWCSelectClickCatcher, AppKit and UIKit) handles the field; the scope's observers are not used.
        #if canImport(AppKit) || canImport(UIKit)
        return
        #endif
        guard let registry, frame.width > 0, !buttonTrigger else { return }
        registry.observeClicks(node.id, frame: frame, exclude: showClear ? [clearFrame] : []) { toggleOpen() }
    }
    private func toggleOpen() { guard !isDisabled else { return }; set("open", .bool(!open)) }
    /// `@Watch('open')`: the host's open state drives the menu (auto-focus off while filterable: the search field takes focus).
    private func syncMenu(_ o: Bool, attempt: Int = 0) {
        guard let registry else { return }
        guard let c = registry.controllers[menuID] else {
            if attempt < 20 { DispatchQueue.main.async { syncMenu(o, attempt: attempt + 1) } }
            return
        }
        if o { if !c.isOpen || c.closing { c.show(autoFocus: !b("filterable"), keyboard: rt.openedByKey) } }
        else if c.isOpen && !c.closing { c.close() }
        rt.openedByKey = false
    }
    private func menuOpened() {
        // The menu's event handler can hold a copy of this view from before its last update: set without reading `open`.
        set("open", true)
        if rt.lastEmit != "open" { rt.lastEmit = "open"; emit("mdOpen", .null) }
        if b("filterable") { DispatchQueue.main.async { rt.searchFocus += 1 } }
    }
    private func menuClosed() {
        set("open", false)
        if !rt.query.isEmpty { rt.query = ""; rt.queryText = "" }
        if rt.lastEmit != "close" { rt.lastEmit = "close"; emit("mdClose", .null) }
    }
    // Handlers read the runtime's value (a menu handler can hold a copy of this view from before its last update).
    private func commit(_ next: [String]) { rt.valueNow = next; set("value", .array(next.map { .string($0) })); emit("mdChange", .array(next.map { .string($0) })) }
    private func toggleValue(_ v: String) {
        guard !isDisabled else { return }
        let cur = rt.valueNow, has = cur.contains(v), max = Int(local["maxSelected"]?.number ?? 0)
        if !has && max > 0 && cur.count >= max { return }
        commit(has ? cur.filter { $0 != v } : cur + [v])
    }
    private func removeValue(_ v: String) {
        guard !isDisabled, rt.valueNow.contains(v) else { return }
        let removed = rt.valueNow.compactMap { x in options.first { $0.value == x } }.firstIndex { $0.value == v } ?? 0
        let next = rt.valueNow.filter { $0 != v }; rt.valueNow = next
        set("value", .array(next.map { .string($0) }))
        emit("mdRemove", .string(v)); emit("mdChange", .array(next.map { .string($0) }))
        // The source focuses the remove button of the chip now at the removed index (else the last one), or the trigger, in
        // a requestAnimationFrame after its re-render: Chrome's focus is on the body for the two frames in between.
        let remaining = next.filter { x in options.contains { $0.value == x } }.count
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.04) {
            if remaining == 0 { _ = field.setFocus() } else { awcFocusNativeView("\(node.id)::chip\(min(removed, remaining - 1)).remove") }
        }
    }
    private func clearValue() {
        guard !isDisabled, !rt.valueNow.isEmpty else { return }
        rt.valueNow = []; set("value", .array([])); emit("mdChange", .array([])); emit("mdClear", .null)
        _ = field.setFocus()
    }
    private func toggleSelectAll() {
        guard !isDisabled else { return }
        let e = eligible, max = Int(local["maxSelected"]?.number ?? 0)
        let cur = rt.valueNow, all = !e.isEmpty && e.allSatisfy { cur.contains($0) }
        commit(all ? [] : Array(e.prefix(max > 0 ? max : e.count)))
    }
    /// md-multi-select `handleKeyDown` for keys in the trigger (keys inside the menu belong to the menu).
    private func fieldKey(_ key: String, _ composing: Bool) -> Bool {
        guard !isDisabled, !composing else { return false }
        if !open && ["ArrowDown", "ArrowUp", "Enter", " "].contains(key) { rt.openedByKey = true; set("open", true); return true }
        if open && key == "Escape" { set("open", false); _ = field.setFocus(); return true }
        return false
    }
}

/// A wrapping row (flex-wrap with `gap` between items and `rowGap` between rows); `wrap: false` keeps one line.
struct AWCMultiChipsFlow: Layout {
    let gap: Double, rowGap: Double, wrap: Bool
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let maxW = proposal.width ?? .infinity
        var x = 0.0, y = 0.0, rowH = 0.0, w = 0.0
        for s in subviews {
            let size = s.sizeThatFits(.unspecified)
            if wrap && x > 0 && x + gap + size.width > maxW { y += rowH + rowGap; x = 0; rowH = 0 }
            x += (x > 0 ? gap : 0) + size.width; rowH = max(rowH, size.height); w = max(w, x)
        }
        return CGSize(width: proposal.width.map { min(w, $0) } ?? w, height: y + rowH)
    }
    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x = 0.0, y = 0.0, rowH = 0.0
        var rows: [[(LayoutSubview, CGSize, Double)]] = [[]]
        for s in subviews {
            let size = s.sizeThatFits(.unspecified)
            if wrap && x > 0 && x + gap + size.width > bounds.width { rows.append([]); y += rowH + rowGap; x = 0; rowH = 0 }
            let px = x + (x > 0 ? gap : 0)
            rows[rows.count - 1].append((s, size, px)); x = px + size.width; rowH = max(rowH, size.height)
        }
        // align-items: center within each row.
        y = 0
        for row in rows {
            let h = row.map { $0.1.height }.max() ?? 0
            for (s, size, px) in row { s.place(at: CGPoint(x: bounds.minX + px, y: bounds.minY + y + (h - size.height) / 2), proposal: ProposedViewSize(size)) }
            y += h + rowGap
        }
    }
}

/// `.md-multi-select__search`: the filter input pinned in the menu header (padding 12 44 12 16, surface-container fill,
/// 1 px outline-variant bottom border; every value a hook).
struct AWCMultiSearchField: View {
    @Binding var text: String
    let placeholder: String, label: String, theme: AWCTheme, appearance: AWCMultiSelectAppearance
    var focusRequest = 0
    var pending: String?
    var consumed: () -> Void = {}
    @FocusState private var focused: Bool
    var body: some View {
        let t = theme.tokens, a = appearance
        let pad = a.searchPadding ?? [12, 44, 12, 16], border = a.searchBorderWidth ?? 1
        ZStack(alignment: .leading) {
            if text.isEmpty {
                Text(placeholder).font(AWCNativeFonts.label(size: 16, regular: true)).lineLimit(1).allowsHitTesting(false)
                    .foregroundStyle(Color(awcHex: a.searchPlaceholderColor ?? t["--md-sys-color-on-surface-variant"] ?? "#49454F"))
            }
            TextField("", text: $text).textFieldStyle(.plain).font(AWCNativeFonts.label(size: 16, regular: true)).focused($focused)
                .foregroundStyle(Color(awcHex: a.searchColor ?? t["--md-sys-color-on-surface"] ?? "#1D1B20")).accessibilityLabel(label)
        }
        // The input's content box: `line-height: normal` of 16 px Roboto, rounded as Chrome's inner editor (19).
        .frame(height: ((AWCFieldMetrics.ascent + AWCFieldMetrics.descent) * 16).rounded())
        .padding(.top, pad[0]).padding(.bottom, pad[2] + border).padding(.leading, pad[3]).padding(.trailing, pad[1])
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(awcHex: a.searchBackground ?? t["--md-sys-color-surface-container"] ?? "#F3EDF7"))
        .overlay(alignment: .bottom) { Rectangle().fill(Color(awcHex: a.searchBorderColor ?? t["--md-sys-color-outline-variant"] ?? "#CAC4D0")).frame(height: border) }
        .onChange(of: pending, initial: true) { _, q in if let q { text = q; consumed() } }
        .onChange(of: focusRequest) { _, _ in focused = true }
    }
}

/// Focuses the native focus view whose accessibility identifier is `id` (an md-chip's remove button: `<chip id>.remove`) in the
/// key window. UIKit: no programmatic chip focus (the trigger keeps focus).
@MainActor func awcFocusNativeView(_ id: String) {
    #if canImport(AppKit)
    func find(_ v: NSView) -> NSView? { if v.accessibilityIdentifier() == id { return v }; for c in v.subviews { if let f = find(c) { return f } }; return nil }
    for w in NSApp.windows { if let root = w.contentView, let v = find(root) { w.makeFirstResponder(v); return } }
    #endif
}

/// `color-mix(in srgb, <color> <amount>, transparent)` as `#RRGGBBAA`.
func awcFieldMix(_ color: String, _ amount: Double) -> String {
    let hex = color.hasPrefix("#") ? String(color.dropFirst()) : color
    let rgb = String(hex.prefix(6))
    return "#" + rgb + String(format: "%02X", Int((amount * 255).rounded()))
}

extension AWCNativeView {
    var nativeMultiSelect: some View {
        AWCNativeMultiSelect(node: node, local: local, theme: theme, set: { set($0, $1) }, emit: { emit($0, $1) }, child: { n, h in child(n, handler: h) })
    }
}
