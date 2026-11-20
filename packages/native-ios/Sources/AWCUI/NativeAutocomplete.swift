import SwiftUI
#if canImport(AppKit)
import AppKit
#elseif canImport(UIKit)
import UIKit
#endif

// md-autocomplete: an editable md-text-field (combobox) with an md-menu listbox of option rows that never takes focus while
// the user types, composed from the library's own renderers as the source composes its primitives (md-text-field, md-menu,
// md-menu-item, md-chip, md-icon-button). The option model, caret, chip flow and scope frames are md-select's /
// md-multi-select's (SelectSupport.swift, NativeSelect.swift, NativeMultiSelect.swift).

// MARK: Hooks

/// The eleven md-autocomplete hooks (`--md-autocomplete-*`); lengths are points (= CSS px), colours `#RRGGBB[AA]`.
public struct AWCAutocompleteAppearance: Equatable, Sendable {
    public var width: Double?, minWidth: Double?, chipGap: Double?, chipRadius: Double?, caretColor: String?, caretSize: Double?
    public var clearColor: String?, optionIconColor: String?, optionIconSize: Double?, loadingColor: String?, spinnerSize: Double?
    public init(width: Double? = nil, minWidth: Double? = nil, chipGap: Double? = nil, chipRadius: Double? = nil, caretColor: String? = nil,
                caretSize: Double? = nil, clearColor: String? = nil, optionIconColor: String? = nil, optionIconSize: Double? = nil,
                loadingColor: String? = nil, spinnerSize: Double? = nil) {
        func len(_ v: Double?) -> Double? { v.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil } }
        self.width = len(width); self.minWidth = len(minWidth); self.chipGap = len(chipGap); self.chipRadius = len(chipRadius)
        self.caretColor = awcFieldColor(caretColor); self.caretSize = len(caretSize); self.clearColor = awcFieldColor(clearColor)
        self.optionIconColor = awcFieldColor(optionIconColor); self.optionIconSize = len(optionIconSize)
        self.loadingColor = awcFieldColor(loadingColor); self.spinnerSize = len(spinnerSize)
    }
    /// Typed values (Laboratory): `width`, `minWidth`, `chipGap` …
    public init(values v: [String: AWCValue]) {
        func t(_ k: String) -> String? { (v[k]?.string).flatMap { $0.isEmpty ? nil : $0 } }
        self.init(width: v["width"]?.number, minWidth: v["minWidth"]?.number, chipGap: v["chipGap"]?.number, chipRadius: v["chipRadius"]?.number,
                  caretColor: t("caretColor"), caretSize: v["caretSize"]?.number, clearColor: t("clearColor"), optionIconColor: t("optionIconColor"),
                  optionIconSize: v["optionIconSize"]?.number, loadingColor: t("loadingColor"), spinnerSize: v["spinnerSize"]?.number)
    }
    /// CSS custom properties as authored on the host (`--md-autocomplete-caret-size: 30px`).
    public init(css: [String: String]) {
        func raw(_ k: String) -> String? { css["--md-autocomplete-" + k]?.trimmingCharacters(in: .whitespaces) }
        func px(_ k: String) -> Double? { raw(k).flatMap { Double($0.replacingOccurrences(of: "px", with: "").trimmingCharacters(in: .whitespaces)) } }
        self.init(width: px("width"), minWidth: px("min-width"), chipGap: px("chip-gap"), chipRadius: px("chip-radius"), caretColor: raw("caret-color"),
                  caretSize: px("caret-size"), clearColor: raw("clear-color"), optionIconColor: raw("option-icon-color"), optionIconSize: px("option-icon-size"),
                  loadingColor: raw("loading-color"), spinnerSize: px("spinner-size"))
    }
    public func merging(_ o: Self) -> Self {
        .init(width: o.width ?? width, minWidth: o.minWidth ?? minWidth, chipGap: o.chipGap ?? chipGap, chipRadius: o.chipRadius ?? chipRadius,
              caretColor: o.caretColor ?? caretColor, caretSize: o.caretSize ?? caretSize, clearColor: o.clearColor ?? clearColor,
              optionIconColor: o.optionIconColor ?? optionIconColor, optionIconSize: o.optionIconSize ?? optionIconSize,
              loadingColor: o.loadingColor ?? loadingColor, spinnerSize: o.spinnerSize ?? spinnerSize)
    }
}
private struct AWCAutocompleteAppearanceKey: EnvironmentKey { static let defaultValue = AWCAutocompleteAppearance() }
private struct AWCAutocompleteAppearanceTargetsKey: EnvironmentKey { static let defaultValue: [String: AWCAutocompleteAppearance] = [:] }
extension EnvironmentValues {
    var awcAutocompleteAppearance: AWCAutocompleteAppearance { get { self[AWCAutocompleteAppearanceKey.self] } set { self[AWCAutocompleteAppearanceKey.self] = newValue } }
    var awcAutocompleteAppearanceTargets: [String: AWCAutocompleteAppearance] {
        get { self[AWCAutocompleteAppearanceTargetsKey.self] } set { self[AWCAutocompleteAppearanceTargetsKey.self] = newValue }
    }
}
private struct AWCAutocompleteAppearanceModifier: ViewModifier {
    let value: AWCAutocompleteAppearance, id: String?
    @Environment(\.awcAutocompleteAppearance) private var inherited
    @Environment(\.awcAutocompleteAppearanceTargets) private var targets
    func body(content: Content) -> some View {
        if let id { var t = targets; t[id] = (t[id] ?? .init()).merging(value); return AnyView(content.environment(\.awcAutocompleteAppearanceTargets, t)) }
        return AnyView(content.environment(\.awcAutocompleteAppearance, inherited.merging(value)))
    }
}
public extension View {
    /// md-autocomplete hooks for the autocomplete with node id `id`, or for every descendant autocomplete when nil.
    func awcAutocompleteAppearance(_ appearance: AWCAutocompleteAppearance, for id: String? = nil) -> some View {
        modifier(AWCAutocompleteAppearanceModifier(value: appearance, id: id))
    }
}

// MARK: Methods

/// One suggestion, as the `filterer` sees it (`SelectOptionData`).
public struct AWCAutocompleteOption: Equatable, Sendable {
    public var value: String, label: String, disabled: Bool, supportingText: String, icon: String, iconColor: String
    public init(value: String, label: String? = nil, disabled: Bool = false, supportingText: String = "", icon: String = "", iconColor: String = "") {
        self.value = value; self.label = label ?? value; self.disabled = disabled; self.supportingText = supportingText; self.icon = icon; self.iconColor = iconColor
    }
    init(_ o: AWCSelectOptionData) { self.init(value: o.value, label: o.label, disabled: o.disabled, supportingText: o.supportingText, icon: o.icon, iconColor: o.iconColor) }
    var data: AWCSelectOptionData { .init(value: value, label: label, disabled: disabled, icon: icon, iconColor: iconColor, supportingText: supportingText) }
}

/// md-autocomplete methods: `focusInput`, `showMenu`, `closeMenu`, `loadOptions`, `getLabels` and the validity API, plus the
/// `filterer` function property. Attach with `.awcAutocompleteController(_:for:)`.
@MainActor public final class AWCAutocompleteController {
    weak var runtime: AWCAutocompleteRuntime?
    public init() {}
    public var isConnected: Bool { runtime != nil }
    public func focusInput() { runtime?.focusInput() }
    public func showMenu() { runtime?.show() }
    public func closeMenu() { runtime?.close() }
    /// Replaces the options (`loadOptions(array)`); native lists are not virtualized.
    public func loadOptions(_ options: [AWCValue]) { runtime?.loaded = options.compactMap(AWCAutocompleteModel.option(init:)) }
    /// `getLabels(values)`: the label of each value (the value itself when it has none).
    public func getLabels(_ values: [String]) -> [String: String] { runtime?.labels(values) ?? Dictionary(values.map { ($0, $0) }, uniquingKeysWith: { a, _ in a }) }
    public func getValidity() -> AWCConstraintValidity { runtime?.validity() ?? .validState }
    public func checkValidity() -> Bool { runtime?.validity().valid ?? true }
    @discardableResult public func reportValidity() -> Bool { runtime?.reportValidity() ?? true }
    public func setCustomValidity(_ message: String) { runtime?.customMessage = message }
    /// The `filterer` property: `(options, inputValue, selected) -> options` (the client-side filter; `limitResults` still applies).
    public var filterer: ((_ options: [AWCAutocompleteOption], _ inputValue: String, _ selected: [String]) -> [AWCAutocompleteOption])? {
        get { runtime?.filterer } set { runtime?.filterer = newValue; pendingFilterer = newValue }
    }
    var pendingFilterer: ((_ options: [AWCAutocompleteOption], _ inputValue: String, _ selected: [String]) -> [AWCAutocompleteOption])?
}
private struct AWCAutocompleteControllersKey: EnvironmentKey { static let defaultValue: [String: AWCAutocompleteController] = [:] }
extension EnvironmentValues {
    var awcAutocompleteControllers: [String: AWCAutocompleteController] {
        get { self[AWCAutocompleteControllersKey.self] } set { self[AWCAutocompleteControllersKey.self] = newValue }
    }
}
private struct AWCAutocompleteControllerModifier: ViewModifier {
    let id: String, controller: AWCAutocompleteController
    @Environment(\.awcAutocompleteControllers) private var inherited
    func body(content: Content) -> some View { var c = inherited; c[id] = controller; return content.environment(\.awcAutocompleteControllers, c) }
}
public extension View {
    /// Attach a method controller to the md-autocomplete with node id `id`, or to descendant autocompletes when nil.
    func awcAutocompleteController(_ controller: AWCAutocompleteController, for id: String? = nil) -> some View {
        modifier(AWCAutocompleteControllerModifier(id: id ?? "", controller: controller))
    }
}

/// Runtime state of one md-autocomplete (the typing gate, event dedupe, pending list focus, validity presentation). Handlers
/// read the `…Now` mirrors: a menu event handler can hold a copy of the view from before its last update.
@MainActor @Observable final class AWCAutocompleteRuntime {
    var loaded: [AWCSelectOptionData]?
    var customMessage = ""
    var revealed = false
    var focused = false
    /// Only what was typed since the popup opened filters the list (`typedSinceOpen`).
    var typedSinceOpen = false
    @ObservationIgnored var filterer: ((_ options: [AWCAutocompleteOption], _ inputValue: String, _ selected: [String]) -> [AWCAutocompleteOption])?
    @ObservationIgnored var lastEmit: String?
    @ObservationIgnored var lastValidityKey: String?
    @ObservationIgnored var openedByKey = false
    /// ArrowDown / ArrowUp in the input: focus the first / last enabled row once the popup is open and painted.
    @ObservationIgnored var pendingListFocus: String?
    @ObservationIgnored var listFocusToken = 0
    /// Labels of committed values that are not (or no longer) options: picks and free-solo values (`labelMap`).
    @ObservationIgnored var labelCache: [String: String] = [:]
    @ObservationIgnored var valueNow: [String] = []
    @ObservationIgnored var inputNow = ""
    @ObservationIgnored var openNow = false
    @ObservationIgnored var openWriteAt: Double = 0
    @ObservationIgnored var disabledNow = false
    @ObservationIgnored var validityNow = AWCConstraintValidity.validState
    @ObservationIgnored var optionsNow: [AWCSelectOptionData] = []
    @ObservationIgnored var lastStatus = ""
    @ObservationIgnored var show: () -> Void = {}
    @ObservationIgnored var close: () -> Void = {}
    @ObservationIgnored var focusInput: () -> Void = {}
    @ObservationIgnored var validity: () -> AWCConstraintValidity = { .validState }
    @ObservationIgnored var reportValidity: () -> Bool = { true }
    @ObservationIgnored var labels: ([String]) -> [String: String] = { _ in [:] }
    /// Tests: types `text` into the input as the user would (the paint fixtures' typed-open state).
    @ObservationIgnored var typeText: (String) -> Void = { _ in }
    func label(_ v: String) -> String { optionsNow.first { $0.value == v }?.label ?? labelCache[v] ?? v }
}

/// Option source and filtering (md-autocomplete's `refreshOptions`, `normalize`, `filteredOptions`, `defaultFilter`).
enum AWCAutocompleteModel {
    /// `normalize`: label defaults to the value; `description` is a legacy alias of `supportingText`.
    static func option(init v: AWCValue) -> AWCSelectOptionData? {
        guard var o = AWCSelectOptions.from(init: v) else { return nil }
        // `normalize`: label ?? value.
        if v["label"].string.isEmpty && o.label.isEmpty { o.label = o.value }
        let description = v["description"].string
        if o.supportingText.isEmpty && !description.isEmpty { o.supportingText = description }
        return o
    }
    /// Visible carriers win; with none (every carrier hidden counts as none) the `options` property is read.
    static func collect(_ node: AWCNode, options: AWCValue?) -> [AWCSelectOptionData] {
        let visible = node.children.filter { AWCSelectOptions.isOption($0) && !AWCSelectOptions.hidden($0) }
        if !visible.isEmpty { return visible.map(AWCSelectOptions.from(option:)) }
        guard let options else { return [] }
        if case .string(let json) = options {
            guard let data = json.data(using: .utf8), let parsed = try? JSONDecoder().decode(AWCValue.self, from: data) else { return [] }
            return parsed.array.compactMap(option(init:))
        }
        return options.array.compactMap(option(init:))
    }
    /// `defaultFilter`: case-insensitive substring of the label, the value or the supporting text.
    static func filter(_ options: [AWCSelectOptionData], query: String) -> [AWCSelectOptionData] {
        let q = query.lowercased()
        guard !q.isEmpty else { return options }
        return options.filter { $0.label.lowercased().contains(q) || $0.value.lowercased().contains(q) || $0.supportingText.lowercased().contains(q) }
    }
}

// MARK: View

struct AWCNativeAutocomplete: View {
    let node: AWCNode, local: [String: AWCValue], theme: AWCTheme
    let set: (String, AWCValue) -> Void
    let emit: (String, AWCValue) -> Void
    let child: (AWCNode, @escaping (AWCEvent) -> Void) -> AnyView
    @Environment(\.awcMenuRegistry) private var registry
    @Environment(\.awcAutocompleteAppearance) private var inheritedAppearance
    @Environment(\.awcAutocompleteAppearanceTargets) private var appearanceTargets
    @Environment(\.awcAutocompleteControllers) private var controllers
    @Environment(\.awcTextFieldAppearanceTargets) private var fieldTargets
    @Environment(\.awcNativeSpacingRung) private var inheritedRung
    @Environment(\.accessibilityReduceMotion) private var systemReduced
    @Environment(\.awcFieldReducedMotion) private var reducedOverride
    @State private var rt = AWCAutocompleteRuntime()
    @State private var field = AWCTextFieldController()
    @State private var fieldFrame: CGRect = .zero
    @State private var trailingFrame: CGRect = .zero
    @State private var inlineFrame: CGRect = .zero

    private func s(_ k: String, _ d: String = "") -> String { local[k]?.string.nonEmpty ?? d }
    private func b(_ k: String, _ d: Bool = false) -> Bool { local[k]?.bool ?? d }
    private var appearance: AWCAutocompleteAppearance { inheritedAppearance.merging(appearanceTargets[node.id] ?? .init()) }
    private var reduced: Bool { reducedOverride ?? systemReduced }
    private var open: Bool { b("open") }
    private var disabled: Bool { b("disabled") }
    private var inert: Bool { disabled || b("softDisabled") }
    private var multiple: Bool { b("multiple") }
    private var freeSolo: Bool { b("freeSolo") }
    private var busy: Bool { b("loading") }
    private var inputValue: String { local["inputValue"]?.string ?? "" }
    /// `selectedArray`: the array value (multiple) or the non-empty string value.
    private var value: [String] {
        switch local["value"] {
        case .array(let a)?: return multiple ? a.map(\.string) : []
        case .string(let v)? where !v.isEmpty:
            if multiple {
                if let d = v.data(using: .utf8), let a = try? JSONDecoder().decode([String].self, from: d) { return a }
                return []
            }
            return [v]
        default: return []
        }
    }
    private var options: [AWCSelectOptionData] { rt.loaded ?? AWCAutocompleteModel.collect(node, options: local["options"]) }
    private var chipPosition: String { ["below", "top", "left", "right", "inline"].contains(s("chipPosition")) ? s("chipPosition") : "below" }
    private var inlineChips: Bool { multiple && chipPosition == "inline" }
    private var anchorID: String { node.id + "::trigger" }
    private var menuID: String { node.id + "::menu" }
    private var accessibleName: String { s("label").nonEmpty ?? s("aria-label").nonEmpty ?? s("ariaLabel") }
    private var validity: AWCConstraintValidity {
        if !rt.customMessage.isEmpty { return .init(flag: "customError", message: rt.customMessage) }
        if b("required") && value.isEmpty { return .init(flag: "valueMissing", message: s("errorText").nonEmpty ?? s("valueMissingLabel", "Please make a selection")) }
        return .validState
    }
    private var validationMessage: String { rt.revealed && !validity.valid ? validity.validationMessage : "" }
    private var hostDensity: Double { local["density"]?.number ?? 0 }
    private var rung: Double { [-1.0, -2, -3, -4].contains(hostDensity) ? hostDensity : inheritedRung }
    private var insetLG: Double { rung <= -4 ? 8 : rung <= -2 ? 12 : 16 }
    private var insetMD: Double { rung <= -2 ? 8 : 12 }
    private var insetSM: Double { rung <= -3 ? 4 : 8 }
    private var gapSM: Double { rung <= -3 ? 4 : 8 }
    private var gapXS: Double { rung <= -4 ? 2 : 4 }
    private var tint: String { theme.tokens["--md-sys-color-on-surface-variant"].flatMap(awcFieldColor) ?? "#49454F" }
    private func label(_ v: String) -> String { options.first { $0.value == v }?.label ?? rt.labelCache[v] ?? v }
    /// The active filter query: only what was typed since the popup opened counts.
    private var query: String { rt.typedSinceOpen ? inputValue.trimmingCharacters(in: .whitespacesAndNewlines) : "" }
    private var filtered: [AWCSelectOptionData] {
        var results: [AWCSelectOptionData]
        if let f = rt.filterer { results = f(options.map(AWCAutocompleteOption.init), query, value).map(\.data) }
        else { results = AWCAutocompleteModel.filter(options, query: query) }
        let limit = Int(local["limitResults"]?.number ?? 0)
        if limit > 0 { results = Array(results.prefix(limit)) }
        return results
    }
    private var status: String {
        busy ? s("loadingText", "Loading…") : open ? s("statusTemplate", "{count} suggestions available").replacingOccurrences(of: "{count}", with: String(filtered.count)) : ""
    }

    var body: some View {
        if b("hidden") { EmptyView() } else { composed }
    }
    private var composed: some View {
        let a = appearance, minW = a.minWidth ?? 220
        return VStack(alignment: .leading, spacing: 0) {
            frame
            menu
        }
        .frame(minWidth: CGFloat(minW), maxWidth: a.width.map { CGFloat(max($0, minW)) } ?? .infinity, alignment: .leading)
        .frame(width: a.width.map { CGFloat(max($0, minW)) })
        // `.md-autocomplete__sr-status` (role="status", visually hidden): the polite status is a readable text while it has
        // words (VoiceOver reads it when navigated; changes are also announced), no pixels and no layout space.
        .overlay(alignment: .topLeading) {
            if !status.isEmpty {
                Text(status).font(.system(size: 1)).foregroundStyle(Color.clear).lineLimit(1).fixedSize()
                    .frame(width: 1, height: 1, alignment: .topLeading).clipped().allowsHitTesting(false)
            }
        }
        .awcInspect(nodeID: node.id, name: "md-autocomplete") { _ in
            ["value": local["value"].map { $0 == .null ? .string("") : $0 } ?? .string(""), "inputValue": .string(inputValue), "open": .bool(open),
             "focused": .bool(rt.focused), "status": .string(status), "valid": .bool(validity.valid), "validationMessage": .string(validationMessage)]
        }
        .onAppear { connect() }
        .onChange(of: open) { _, o in syncMenu(o) }
        .onChange(of: validity, initial: true) { _, next in
            rt.validityNow = next
            let key = next.key; defer { rt.lastValidityKey = key }
            if let last = rt.lastValidityKey, last != key { emit("mdValidityChange", next.eventValue) }
        }
        .onChange(of: value, initial: true) { _, v in rt.valueNow = v; syncCommittedText() }
        .onChange(of: inputValue, initial: true) { _, v in rt.inputNow = v }
        .onChange(of: open, initial: true) { _, o in rt.openNow = o }
        .onChange(of: inert, initial: true) { _, d in rt.disabledNow = d }
        .onChange(of: options, initial: true) { _, o in rt.optionsNow = o }
        // `@Watch('options')` / slotchange (`refreshOptions`): the authored list replaces options loaded with loadOptions().
        .onChange(of: local["options"]) { rt.loaded = nil }
        .onChange(of: AWCAutocompleteModel.collect(node, options: nil)) { rt.loaded = nil }
        .onChange(of: status) { _, text in announce(text) }
    }

    // MARK: Frame (chips around the field)

    @ViewBuilder private var frame: some View {
        let showChips = multiple && !inlineChips && !value.isEmpty
        switch multiple ? chipPosition : "below" {
        case "top":
            VStack(alignment: .leading, spacing: 0) { if showChips { chips.padding(.bottom, insetSM) }; trigger }
        case "left", "right":
            if showChips {
                AWCAutocompleteSideLayout(chipsFirst: chipPosition == "left", gap: gapSM) {
                    if chipPosition == "left" { sideChips; trigger } else { trigger; sideChips }
                }
            } else { trigger }
        default:
            VStack(alignment: .leading, spacing: 0) { trigger; if showChips { chips.padding(.top, insetSM) } }
        }
    }
    private var chipAppearance: AWCChipHookAppearance {
        AWCChipHookAppearance(containerShape: .points(appearance.chipRadius ?? 8))
    }
    private func chip(_ v: String, _ k: Int) -> some View {
        let n = AWCNode(id: "\(node.id)::chip\(k)", tag: "md-chip", properties: ["variant": "input", "selectable": false, "label": .string(label(v)),
                                                                              "disabled": .bool(inert), "removable": .bool(!inert)])
        return child(n, { e in if e.name == "mdRemove" { removeChip(v) } })
            .awcInspect(nodeID: node.id, part: "chip-\(k)", name: "chip")
    }
    /// `.md-autocomplete__chips`: a wrapping row of removable tokens (the field alone sizes the host: `contain: inline-size`).
    private var chips: some View {
        AWCMultiChipsFlow(gap: appearance.chipGap ?? gapXS, rowGap: appearance.chipGap ?? gapXS, wrap: true) {
            ForEach(Array(value.enumerated()), id: \.element) { k, v in chip(v, k) }
        }
        .awcChipAppearance(chipAppearance)
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .contain).accessibilityLabel(s("label").isEmpty ? "Selected" : "\(s("label")) — selected")
        .awcInspect(nodeID: node.id, part: "chips", name: "chips")
    }
    /// Left / right: `flex: 0 1 auto; max-inline-size: 50%` beside the field.
    private var sideChips: some View {
        AWCMultiChipsFlow(gap: appearance.chipGap ?? gapXS, rowGap: appearance.chipGap ?? gapXS, wrap: true) {
            ForEach(Array(value.enumerated()), id: \.element) { k, v in chip(v, k) }
        }
        .awcChipAppearance(chipAppearance)
        .accessibilityElement(children: .contain).accessibilityLabel(s("label").isEmpty ? "Selected" : "\(s("label")) — selected")
        .awcInspect(nodeID: node.id, part: "chips", name: "chips")
    }
    /// `.md-autocomplete__inline-chips` in the field's chips slot (`chips-wrap`: the field grows with the rows).
    private var inlineChipRow: some View {
        AWCMultiChipsFlow(gap: appearance.chipGap ?? gapXS, rowGap: appearance.chipGap ?? gapXS, wrap: true) {
            ForEach(Array(value.enumerated()), id: \.element) { k, v in chip(v, k) }
        }
        .awcChipAppearance(chipAppearance)
        .modifier(AWCSelectScopeFrame(registry: registry) { inlineFrame = $0 })
        .accessibilityElement(children: .contain).accessibilityLabel(s("label").isEmpty ? "Selected" : "\(s("label")) — selected")
        .awcInspect(nodeID: node.id, part: "chips", name: "chips")
    }

    // MARK: Trigger

    private var trigger: some View {
        var p: [String: AWCValue] = [:]
        p["variant"] = .string(s("variant", "filled")); p["label"] = .string(s("label"))
        if s("label").isEmpty, !accessibleName.isEmpty { p["aria-label"] = .string(accessibleName) }
        p["placeholder"] = .string(s("placeholder")); p["disabled"] = .bool(disabled); p["required"] = .bool(b("required"))
        p["error"] = .bool(b("error") || !validationMessage.isEmpty); p["errorText"] = .string(s("errorText").nonEmpty ?? validationMessage)
        p["reserveSupportingSpace"] = .bool(b("reserveSupportingSpace")); p["supportingText"] = .string(s("supportingText"))
        if let d = local["density"]?.number { p["density"] = .number(d) }
        p["appearFocused"] = .bool(open || rt.focused)
        p["aria-haspopup"] = "listbox"
        p["inputRole"] = "combobox"; p["inputExpanded"] = .bool(open); p["inputAriaAutocomplete"] = "list"
        p["chipsWrap"] = .bool(inlineChips)
        let inner = AWCNode(id: node.id, tag: "md-text-field", properties: p)
        let inlineNode = AWCNode(id: node.id + "::inline", tag: "#awc-autocomplete-inline", properties: [:])
        var hooks = AWCFieldHooks()
        hooks.controller = field
        hooks.key = { key, composing in fieldKey(key, composing) }
        hooks.focus = { f in focusChanged(f) }
        hooks.trailing = AnyView(trailing)
        hooks.editingKeys = true
        // :host sets --md-text-field-padding-inline-end: inset-lg; a hook targeted at this autocomplete still wins.
        let padding = fieldTargets[node.id]?.paddingInlineEnd == nil ? AWCTextFieldAppearance(paddingInlineEnd: insetLG) : AWCTextFieldAppearance()
        return AWCNativeTextField(node: inner, theme: theme, value: inputValue, setValue: { typed($0) }, emit: { _, _ in },
                                  leading: [], trailing: [], chips: inlineChips && !value.isEmpty ? [inlineNode] : [], clearIcon: [], passwordIcon: [],
                                  speechIcon: [], errorIcon: [],
                                  child: { n in n.id == inlineNode.id ? AnyView(inlineChipRow) : child(n, { _ in }) }, hooks: hooks)
            .awcTextFieldAppearance(padding)
            .awcMenuAnchor(anchorID, label: nil, focus: { field.setFocus() })
            .modifier(AWCSelectScopeFrame(registry: registry) { fieldFrame = $0 })
            // Chips and the trailing buttons stop their clicks (the source's stopPropagation): they never toggle the popup.
            .background { AWCAutocompletePressMonitor(exclude: fieldFrame.width > 0 ? ([trailingFrame] + (inlineChips && !value.isEmpty ? [inlineFrame] : []))
                                                        .map { $0.offsetBy(dx: -fieldFrame.minX, dy: -fieldFrame.minY) } : []) { fieldPressed() } }
            .awcInspect(nodeID: node.id, part: "field", name: "field")
    }
    /// Clear: shown with typed text or a value (multiple: a value); kept (hidden) while empty or busy so the trailing cluster's
    /// width never changes.
    private var clearShown: Bool { b("clearable", true) && !busy && (multiple ? !value.isEmpty : !inputValue.isEmpty || !value.isEmpty) }
    private var trailing: some View {
        let a = appearance
        return HStack(spacing: 0) {
            if b("clearable", true) { clearButton.padding(.trailing, 2) }
            if busy {
                loader.frame(width: 24, height: 24).awcInspect(nodeID: node.id, part: "loading-spinner", name: "loading-spinner")
            } else {
                // `aria-hidden="true"` on the caret: no element and no text (tools/ax read the glyph's ligature name otherwise).
                AWCSelectCaret(nodeID: node.id, since: rt.openWriteAt + AWCAutocompleteCaretLead, open: open, reduced: reduced, size: a.caretSize ?? 24, color: a.caretColor ?? tint,
                               glyph: s("dropdownIcon", "arrow_drop_down"), slot: node.children(inSlot: "dropdown-icon"), child: { child($0, { _ in }) })
                    .accessibilityHidden(true)
                    .frame(width: 24, height: 24)
                    .contentShape(Rectangle())
                    .onTapGesture { if !rt.disabledNow { setOpen(!rt.openNow) } }
                    .accessibilityElement(children: .ignore)
                    .accessibilityHidden(true)
                    .awcInspect(nodeID: node.id, part: "caret", name: "caret")
            }
        }
        .modifier(AWCSelectScopeFrame(registry: registry) { trailingFrame = $0 })
        .awcInspect(nodeID: node.id, part: "trailing", name: "trailing")
    }
    private var loader: some View {
        let size = appearance.spinnerSize ?? 22
        return Group {
            if let slot = node.children(inSlot: "loader").first { child(slot, { _ in }) }
            else { child(AWCNode(id: node.id + "::loader", tag: "md-loading-indicator", properties: ["label": .string(s("loadingText", "Loading…"))]), { _ in }) }
        }
        .awcLoadingIndicatorAppearance(.init(size: size, shapeSize: size))
    }
    /// The 28 × 28 md-icon-button (18 glyph) before the caret; `visibility: hidden` while there is nothing to clear.
    private var clearButton: some View {
        let color = appearance.clearColor ?? tint
        let n = AWCNode(id: node.id + "::clear", tag: "md-icon-button", properties: ["variant": "standard", "size": "xs", "icon": .string(s("clearIcon", "close")),
                                                                                     "aria-label": "Clear value", "toggle": false,
                                                                                     // Chrome: inside the disabled field the clear button is a disabled Tab stop (aria-disabled).
                                                                                     "softDisabled": .bool(disabled)])
        return child(n, { e in if e.name == "mdClick" { clearAll() } })
            .awcIconButtonAppearance(.init(iconColor: color, stateLayerColor: color, iconSize: 18, width: 28, height: 28))
            .frame(width: 28, height: 28)
            .opacity(clearShown ? 1 : 0)
            .allowsHitTesting(clearShown)
            .accessibilityHidden(!clearShown)
            .environment(\.awcNativeInert, !clearShown)
            .awcInspect(nodeID: node.id, part: "clear", name: "clear") { _ in ["visible": .bool(clearShown)] }
    }

    // MARK: Menu

    private var emptyText: String {
        if busy { return "" }
        if options.isEmpty { return s("noOptionsText", "No options") }
        return filtered.isEmpty ? s("noResultsText", "No results") : ""
    }
    /// Row ids follow the option's position in the full option list, not in the filtered list: md-menu keeps per-row state
    /// (checked, focus) by id, so a filtered-index id would hand one option's state to another when the query changes.
    private func rowID(_ i: Int) -> String { "\(node.id)::opt\(i)" }
    private var indexedRows: [(Int, AWCSelectOptionData)] {
        var used = Set<Int>()
        return filtered.enumerated().map { k, o in
            let i = options.indices.first { !used.contains($0) && options[$0] == o } ?? options.count + k
            used.insert(i); return (i, o)
        }
    }
    private var rows: [AWCNode] {
        guard !busy else { return [] }
        let a = appearance, iconColor = a.optionIconColor ?? tint
        return indexedRows.map { i, o in
            var p: [String: AWCValue] = ["presentation": "option", "type": .string(multiple ? "checkbox" : "radio"), "checkPosition": "start", "keepOpen": true,
                                         "disabled": .bool(o.disabled), "selected": .bool(value.contains(o.value)), "headline": .string(o.label),
                                         "supportingText": .string(o.supportingText)]
            p["optionValue"] = .string(o.value)
            let icon = o.icon.isEmpty ? [] : [AWCNode(id: "\(rowID(i))::icon", tag: "#symbol", properties: ["name": .string(o.icon),
                                                      "color": .string(awcFieldColor(o.iconColor) ?? iconColor), "size": .number(a.optionIconSize ?? 20)], slot: "leading-icon")]
            return AWCNode(id: rowID(i), tag: "md-menu-item", properties: p, children: icon)
        }
    }
    private var menu: some View {
        var p: [String: AWCValue] = ["anchor": .string(anchorID), "placement": .string(s("placement", "bottom-start")),
                                     "matchAnchorWidth": .bool(b("matchTriggerWidth", true)), "persistent": .bool(b("disableCloseOnSelect")),
                                     "emptyText": .string(emptyText), "autoFocus": false, "listbox": true, "listLabel": .string(s("label").nonEmpty ?? "Options")]
        if let mh = local["maxHeight"], mh != .null { p["maxHeight"] = mh }
        if let d = local["density"]?.number { p["density"] = .number(d) }
        // md-menu re-reads `open` on every model change: mirror its controller's own state, so a property change while it is
        // open (emptyText becoming "No results", the list label) never reads as a host-driven close.
        p["open"] = .bool(registry?.controllers[menuID]?.isOpen ?? open)
        let menuNode = AWCNode(id: menuID, tag: "md-menu", properties: p, children: rows)
        let byID = Dictionary(indexedRows.map { (rowID($0.0), $0.1) }, uniquingKeysWith: { a, _ in a })
        return AWCNativeView(node: menuNode) { e in
            switch e.name {
            case "mdOpen": menuOpened()
            case "mdClose": menuClosed()
            case "mdClick": if let o = byID[e.nodeID] { pick(o) }
            default: break
            }
        }
        .awcMenuHeader(for: menuID) { header }
    }
    @ViewBuilder private var header: some View {
        if busy {
            child(AWCNode(id: node.id + "::progress", tag: "md-progress-indicator", properties: ["variant": "linear", "indeterminate": true, "wave": true,
                                                                                               "label": .string(s("loadingText", "Loading…"))]), { _ in })
                .frame(maxWidth: .infinity)
                .awcInspect(nodeID: node.id, part: "loading-progress", name: "loading-progress")
                .padding(.vertical, insetMD).padding(.horizontal, insetLG)
                .foregroundStyle(Color(awcHex: appearance.loadingColor ?? tint))
                .accessibilityElement(children: .combine).accessibilityLabel(s("loadingText", "Loading…"))
                .awcInspect(nodeID: node.id, part: "loading", name: "loading")
        }
    }

    // MARK: Behaviour

    private func connect() {
        let r = rt
        rt.show = { if !r.disabledNow { set("open", true) } }
        rt.close = { set("open", false) }
        rt.focusInput = { [field] in _ = field.setFocus() }
        rt.validity = { r.validityNow }
        rt.reportValidity = { [field] in if r.validityNow.valid { return true }; r.revealed = true; _ = field.setFocus(); return false }
        rt.labels = { values in Dictionary(values.map { ($0, r.label($0)) }, uniquingKeysWith: { a, _ in a }) }
        rt.typeText = { text in typed(text) }
        let controller = controllers[node.id] ?? controllers[""]
        controller?.runtime = rt
        if let f = controller?.pendingFilterer { rt.filterer = f }
        if open && !inert { syncMenu(true) }
    }
    /// `@Watch('open')`: the host's open state drives the menu; it opens without taking focus (typing keeps filtering).
    private func syncMenu(_ o: Bool, attempt: Int = 0) {
        if !o { rt.pendingListFocus = nil }
        guard let registry else { return }
        guard let c = registry.controllers[menuID] else {
            if attempt < 20 { DispatchQueue.main.async { syncMenu(o, attempt: attempt + 1) } }
            return
        }
        // Printable keys and Backspace on a row return to the input (`handleListboxKeyDown`).
        c.rowKeyClaim = { key in rowKey(key) }
        if o { if !c.isOpen || c.closing { c.show(autoFocus: false, keyboard: rt.openedByKey) } }
        else if c.isOpen && !c.closing { c.close() }
        rt.openedByKey = false
    }
    private func menuOpened() {
        // The menu's handler can hold a copy of this view from before its last update: set without reading `open`.
        set("open", true); rt.openNow = true
        if rt.lastEmit != "open" { rt.lastEmit = "open"; emit("mdOpen", .null) }
        scheduleListFocus()
    }
    private func menuClosed() {
        set("open", false); rt.openNow = false; rt.pendingListFocus = nil
        if rt.lastEmit != "close" { rt.lastEmit = "close"; emit("mdClose", .null) }
        // Reopening shows the full list: the typing gate resets on close.
        rt.typedSinceOpen = false
        // Strict single mode: the text snaps back to the committed label (or empty).
        if !multiple && !freeSolo {
            let committed = rt.valueNow.first.map { rt.label($0) } ?? ""
            if rt.inputNow != committed { setInput(committed); emit("mdInput", .string(committed)) }
        }
    }
    /// A programmatic single value while closed shows its label in the input, silently (`syncFormValue`).
    private func syncCommittedText() {
        guard !multiple, !rt.openNow else { return }
        let committed = value.first.map { label($0) } ?? ""
        if inputValue != committed && (local["value"] != nil) { setInput(committed) }
    }
    /// A programmatic text: Chrome's value setter puts the caret at the end of the new text.
    private func setInput(_ text: String) {
        rt.inputNow = text; set("inputValue", .string(text))
        let n = (text as NSString).length
        DispatchQueue.main.async { [field] in if field.runtime?.focused == true { field.runtime?.input.setSelection(n, n) } }
    }
    /// The open state and the menu in the same frame as the input that asked for it (`@Watch('open')` follows later changes).
    private func setOpen(_ o: Bool, keyboard: Bool = false) {
        if rt.openNow != o { rt.openWriteAt = CACurrentMediaTime() * 1000 }
        rt.openNow = o; set("open", .bool(o))
        guard let c = registry?.controllers[menuID] else { return }
        c.rowKeyClaim = { key in rowKey(key) }
        if o { if !c.isOpen || c.closing { c.show(autoFocus: false, keyboard: keyboard) } } else if c.isOpen && !c.closing { c.close() }
    }
    private func commit(_ next: [String]) {
        rt.valueNow = next
        let v: AWCValue = multiple ? .array(next.map { .string($0) }) : .string(next.first ?? "")
        set("value", v); emit("mdChange", v)
    }
    /// `applyTyped`: the text, the typing gate, one mdInput, and the popup opens.
    private func typed(_ text: String) {
        rt.pendingListFocus = nil
        setInput(text); rt.typedSinceOpen = true
        emit("mdInput", .string(text))
        if !rt.openNow && !rt.disabledNow { setOpen(true) }
    }
    private func pick(_ o: AWCSelectOptionData) {
        guard !o.disabled, !rt.disabledNow else { return }
        rt.labelCache[o.value] = o.label
        if multiple {
            let cur = rt.valueNow, exists = cur.contains(o.value), max = Int(local["maxSelected"]?.number ?? 0)
            // md-menu-item toggled itself before mdClick: a blocked pick re-renders it unselected from the value.
            if !exists && max > 0 && cur.count >= max { return }
            commit(exists ? cur.filter { $0 != o.value } : cur + [o.value])
            setInput(""); emit("mdInput", .string("")); rt.typedSinceOpen = false
            focusAtEnd()
        } else {
            commit([o.value])
            setInput(o.label); emit("mdInput", .string(o.label)); rt.typedSinceOpen = false
            if !b("disableCloseOnSelect") { setOpen(false) }
            focusAtEnd()
        }
    }
    /// Enter in the input: a free-solo value commits the trimmed text.
    private func commitFreeSolo() -> Bool {
        guard freeSolo else { return false }
        let raw = rt.inputNow.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !raw.isEmpty else { return false }
        if multiple {
            let cur = rt.valueNow
            if cur.contains(raw) { return true }
            let max = Int(local["maxSelected"]?.number ?? 0)
            if max > 0 && cur.count >= max { return false }
            rt.labelCache[raw] = raw
            commit(cur + [raw]); setInput(""); emit("mdInput", .string(""))
        } else {
            commit([raw])
        }
        return true
    }
    private func removeChip(_ v: String) {
        guard !rt.disabledNow, multiple else { return }
        commit(rt.valueNow.filter { $0 != v })
    }
    private func clearAll() {
        guard !rt.disabledNow else { return }
        setInput(""); emit("mdInput", .string("")); rt.typedSinceOpen = false
        commit([]); emit("mdClear", .null)
        focusAtEnd()
    }
    /// `inputEl.focus()` right after the value setter: Chrome keeps the caret the setter put at the end of the text, where
    /// AppKit's field editor would restore the selection it had when focus left (Backspace then deleted inside the label).
    private func focusAtEnd() {
        _ = field.setFocus()
        let n = (rt.inputNow as NSString).length
        field.runtime?.input.setSelection(n, n)
        DispatchQueue.main.async { [field] in if field.runtime?.focused == true { field.runtime?.input.setSelection(n, n) } }
    }
    private func focusChanged(_ f: Bool) {
        rt.focused = f
        guard !f, !rt.openNow, b("clearOnBlur"), !multiple, !freeSolo else { return }
        let committed = rt.valueNow.first.map { rt.label($0) } ?? ""
        if !rt.inputNow.isEmpty && rt.inputNow != committed { setInput(committed); emit("mdInput", .string(committed)) }
    }
    /// A press in the field (not on the trailing cluster): opens a closed popup; a press while open is a click outside the
    /// menu, which closes it (md-menu's document listener).
    private func fieldPressed() {
        guard !rt.disabledNow else { return }
        setOpen(!rt.openNow)
    }
    /// md-autocomplete `handleFieldKeyDown`.
    private func fieldKey(_ key: String, _ composing: Bool) -> Bool {
        guard !rt.disabledNow, !composing else { return false }
        switch key {
        case "ArrowDown", "ArrowUp":
            rt.pendingListFocus = key == "ArrowDown" ? "first" : "last"
            if !rt.openNow { setOpen(true, keyboard: true) }
            scheduleListFocus()
            return true
        case "Enter":
            if commitFreeSolo() { if !multiple { setOpen(false, keyboard: true) }; return true }
            return false
        case "Escape":
            if rt.openNow { setOpen(false, keyboard: true); return true }
            return false
        case "Backspace":
            if multiple && rt.inputNow.isEmpty && !rt.valueNow.isEmpty { commit(Array(rt.valueNow.dropLast())) }
            return false
        default:
            return false
        }
    }
    /// The arrow key's row focus waits until the popup is open and its rows are mounted (two frames in the source).
    private func scheduleListFocus() {
        guard rt.pendingListFocus != nil, rt.openNow else { return }
        rt.listFocusToken &+= 1
        let token = rt.listFocusToken, r = rt
        Task { @MainActor in
            for _ in 0..<40 {
                try? await Task.sleep(nanoseconds: 16_000_000)
                guard r.listFocusToken == token, let which = r.pendingListFocus, r.openNow else { return }
                guard let c = registry?.controllers[menuID], c.isOpen, !c.closing else { continue }
                let enabled = c.rowOrder.filter { c.rows[$0].map { !$0.disabled } ?? false }
                guard let target = which == "first" ? enabled.first : enabled.last else { continue }
                if c.focus(target, ring: true) { r.pendingListFocus = nil; return }
            }
        }
    }
    /// `handleListboxKeyDown`: printable keys and Backspace on a row keep typing in the input.
    private func rowKey(_ key: String) -> Bool {
        guard !rt.disabledNow else { return false }
        let backspace = key == "Backspace"
        guard backspace || (key.count == 1 && key != " ") else { return false }
        typed(backspace ? String(rt.inputNow.dropLast()) : rt.inputNow + key)
        focusAtEnd()
        return true
    }
    private func announce(_ text: String) {
        guard !text.isEmpty, text != rt.lastStatus else { rt.lastStatus = text; return }
        rt.lastStatus = text
        var message = AttributedString(text); message.accessibilitySpeechAnnouncementPriority = .default
        AccessibilityNotification.Announcement(message).post()
    }
}

/// `chip-position` left / right: a centred row; the chips are `flex: 0 1 auto` capped at half the width (their single-line
/// width when it fits), the field takes the rest.
struct AWCAutocompleteSideLayout: Layout {
    let chipsFirst: Bool, gap: CGFloat
    private func widths(_ w: CGFloat, _ subviews: Subviews) -> (chips: CGFloat, field: CGFloat) {
        let chips = subviews[chipsFirst ? 0 : 1]
        let c = min(chips.sizeThatFits(.unspecified).width, max(0, w * 0.5))
        return (c, max(0, w - gap - c))
    }
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let w = proposal.width ?? 320, (cw, fw) = widths(w, subviews)
        let ch = subviews[chipsFirst ? 0 : 1].sizeThatFits(.init(width: cw, height: nil)).height
        let fh = subviews[chipsFirst ? 1 : 0].sizeThatFits(.init(width: fw, height: nil)).height
        return .init(width: w, height: max(ch, fh))
    }
    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let (cw, fw) = widths(bounds.width, subviews)
        var x = bounds.minX
        for (i, v) in subviews.enumerated() {
            let isChips = (i == 0) == chipsFirst, w = isChips ? cw : fw
            let h = v.sizeThatFits(.init(width: w, height: nil)).height
            v.place(at: .init(x: x, y: bounds.midY - h / 2), anchor: .topLeading, proposal: .init(width: w, height: h))
            x += w + gap
        }
    }
}

// MARK: Field press (the source's onClick on its md-text-field)

/// Reports a pointer press inside `frame` (scope coordinates), outside `exclude`, without taking it: the editable input keeps
/// its own caret placement and selection. AppKit: a local mouse-down monitor (an NSTextField tracks the rest of the click in a
/// nested loop). UIKit: a window-level tap recognizer that never cancels the text field's touches.
#if canImport(AppKit)
struct AWCAutocompletePressMonitor: NSViewRepresentable {
    let exclude: [CGRect], press: () -> Void
    final class Monitor: NSView {
        var press: () -> Void = {}, exclude: [CGRect] = []
        private var token: Any?
        override var isFlipped: Bool { true }
        override func hitTest(_ point: NSPoint) -> NSView? { nil }
        override func viewDidMoveToWindow() {
            super.viewDidMoveToWindow(); if let token { NSEvent.removeMonitor(token); self.token = nil }
            guard window != nil else { return }
            token = NSEvent.addLocalMonitorForEvents(matching: .leftMouseDown) { [weak self] e in
                guard let self, e.window === self.window, !self.isHiddenOrHasHiddenAncestor else { return e }
                let p = self.convert(e.locationInWindow, from: nil)
                if self.bounds.contains(p) && !self.exclude.contains(where: { $0.contains(p) }) { self.press() }
                return e
            }
        }
        deinit { if let token { NSEvent.removeMonitor(token) } }
    }
    func makeNSView(context: Context) -> Monitor { Monitor() }
    func updateNSView(_ v: Monitor, context: Context) { v.press = press; v.exclude = exclude }
}
#elseif canImport(UIKit)
struct AWCAutocompletePressMonitor: UIViewRepresentable {
    let exclude: [CGRect], press: () -> Void
    final class Monitor: UIView, UIGestureRecognizerDelegate {
        var press: () -> Void = {}, exclude: [CGRect] = []
        private var recognizer: UITapGestureRecognizer?
        override func point(inside point: CGPoint, with event: UIEvent?) -> Bool { false }
        override func didMoveToWindow() {
            super.didMoveToWindow()
            if let recognizer { recognizer.view?.removeGestureRecognizer(recognizer); self.recognizer = nil }
            guard let window else { return }
            let r = UITapGestureRecognizer(target: self, action: #selector(tapped(_:)))
            r.cancelsTouchesInView = false; r.delaysTouchesBegan = false; r.delaysTouchesEnded = false; r.delegate = self
            window.addGestureRecognizer(r); recognizer = r
        }
        func gestureRecognizer(_ g: UIGestureRecognizer, shouldRecognizeSimultaneouslyWith other: UIGestureRecognizer) -> Bool { true }
        @objc private func tapped(_ g: UITapGestureRecognizer) {
            let p = g.location(in: self)
            if bounds.contains(p) && !exclude.contains(where: { $0.contains(p) }) { press() }
        }
    }
    func makeUIView(context: Context) -> Monitor { let v = Monitor(); v.backgroundColor = .clear; return v }
    func updateUIView(_ v: Monitor, context: Context) { v.press = press; v.exclude = exclude }
}
#else
struct AWCAutocompletePressMonitor: View {
    let exclude: [CGRect], press: () -> Void
    var body: some View { Color.clear.allowsHitTesting(false) }
}
#endif

extension AWCNativeView {
    var nativeAutocomplete: some View {
        AWCNativeAutocomplete(node: node, local: local, theme: theme, set: { set($0, $1) }, emit: { emit($0, $1) }, child: { n, h in child(n, handler: h) })
    }
}

/// Chrome starts the caret's 200 ms transition in the first style update after md-autocomplete's open write (its mdOpen
/// event is dispatched before that frame; oracle: caret start 16.6 to 33.3 ms after mdOpen in all 16 opens): one display frame.
#if os(macOS)
let AWCAutocompleteCaretLead = 1000.0 / 60
#else
let AWCAutocompleteCaretLead = 0.0
#endif
