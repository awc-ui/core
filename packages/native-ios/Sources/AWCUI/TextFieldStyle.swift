import SwiftUI

func awcFieldColor(_ value: String?) -> String? {
    guard let value, value.range(of: "^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$", options: .regularExpression) != nil else { return nil }
    return value.uppercased()
}

/// The 17 public md-text-field hooks (`--md-text-field-*`). Lengths are CSS px. `filledPill` is the unitless
/// multiplier the stylesheet expects (a length there is invalid at computed-value time, i.e. the default).
public struct AWCTextFieldAppearance: Equatable, Sendable {
    public let activeIndicatorColor: String?, containerColor: String?, containerShape: Double?, cursor: String?
    public let errorColor: String?, filledPill: Double?, focusBorderWidth: Double?, focusInset: Double?
    public let iconColor: String?, iconSize: Double?, inputColor: String?, labelColor: String?, opticalNudge: Double?
    public let outlineColor: String?, paddingInlineStart: Double?, paddingInlineEnd: Double?, supportingTextColor: String?
    public init(activeIndicatorColor: String? = nil, containerColor: String? = nil, containerShape: Double? = nil, cursor: String? = nil,
                errorColor: String? = nil, filledPill: Double? = nil, focusBorderWidth: Double? = nil, focusInset: Double? = nil,
                iconColor: String? = nil, iconSize: Double? = nil, inputColor: String? = nil, labelColor: String? = nil, opticalNudge: Double? = nil,
                outlineColor: String? = nil, paddingInlineStart: Double? = nil, paddingInlineEnd: Double? = nil, supportingTextColor: String? = nil) {
        func length(_ v: Double?) -> Double? { v.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil } }
        func signed(_ v: Double?) -> Double? { v.flatMap { $0.isFinite ? $0 : nil } }
        self.activeIndicatorColor = awcFieldColor(activeIndicatorColor); self.containerColor = awcFieldColor(containerColor)
        self.containerShape = length(containerShape)
        self.cursor = cursor.flatMap { $0.range(of: "^[a-z-]+$", options: .regularExpression) != nil ? $0 : nil }
        self.errorColor = awcFieldColor(errorColor); self.filledPill = signed(filledPill)
        self.focusBorderWidth = length(focusBorderWidth); self.focusInset = signed(focusInset)
        self.iconColor = awcFieldColor(iconColor); self.iconSize = length(iconSize); self.inputColor = awcFieldColor(inputColor)
        self.labelColor = awcFieldColor(labelColor); self.opticalNudge = signed(opticalNudge); self.outlineColor = awcFieldColor(outlineColor)
        self.paddingInlineStart = length(paddingInlineStart); self.paddingInlineEnd = length(paddingInlineEnd)
        self.supportingTextColor = awcFieldColor(supportingTextColor)
    }
    public init(values v: [String: AWCValue]) {
        func t(_ k: String) -> String? { (v[k]?.string).flatMap { $0.isEmpty ? nil : $0 } }
        self.init(activeIndicatorColor: t("activeIndicatorColor"), containerColor: t("containerColor"), containerShape: v["containerShape"]?.number,
                  cursor: t("cursor"), errorColor: t("errorColor"), filledPill: v["filledPill"]?.number, focusBorderWidth: v["focusBorderWidth"]?.number,
                  focusInset: v["focusInset"]?.number, iconColor: t("iconColor"), iconSize: v["iconSize"]?.number, inputColor: t("inputColor"),
                  labelColor: t("labelColor"), opticalNudge: v["opticalNudge"]?.number, outlineColor: t("outlineColor"),
                  paddingInlineStart: v["paddingInlineStart"]?.number, paddingInlineEnd: v["paddingInlineEnd"]?.number, supportingTextColor: t("supportingTextColor"))
    }
    public func merging(_ o: Self) -> Self {
        .init(activeIndicatorColor: o.activeIndicatorColor ?? activeIndicatorColor, containerColor: o.containerColor ?? containerColor,
              containerShape: o.containerShape ?? containerShape, cursor: o.cursor ?? cursor, errorColor: o.errorColor ?? errorColor,
              filledPill: o.filledPill ?? filledPill, focusBorderWidth: o.focusBorderWidth ?? focusBorderWidth, focusInset: o.focusInset ?? focusInset,
              iconColor: o.iconColor ?? iconColor, iconSize: o.iconSize ?? iconSize, inputColor: o.inputColor ?? inputColor,
              labelColor: o.labelColor ?? labelColor, opticalNudge: o.opticalNudge ?? opticalNudge, outlineColor: o.outlineColor ?? outlineColor,
              paddingInlineStart: o.paddingInlineStart ?? paddingInlineStart, paddingInlineEnd: o.paddingInlineEnd ?? paddingInlineEnd,
              supportingTextColor: o.supportingTextColor ?? supportingTextColor)
    }
}

/// Typed counterparts of md-text-field's `::part()` rules (container, label, input, supporting-text, counter). Part values
/// come from the outer tree, so they win over the hooks and every internal hover, focus, error and disabled rule, as
/// `::part()` declarations do. Colours are #RRGGBB or #RRGGBBAA. The chips part styles nothing of its own: chips are
/// md-chip children (use their chip appearance).
public struct AWCTextFieldPartAppearance: Equatable, Sendable {
    /// `::part(container) { background-color }` (both variants; the outlined container is transparent by default).
    public let containerColor: String?
    /// `::part(label) { color }`.
    public let labelColor: String?
    /// `::part(input) { color }` and `{ caret-color }`.
    public let inputColor: String?, caretColor: String?
    /// `::part(supporting-text) { color }` (supporting and error text) and `::part(counter) { color }`.
    public let supportingTextColor: String?, counterColor: String?
    public init(containerColor: String? = nil, labelColor: String? = nil, inputColor: String? = nil, caretColor: String? = nil,
                supportingTextColor: String? = nil, counterColor: String? = nil) {
        self.containerColor = awcFieldColor(containerColor); self.labelColor = awcFieldColor(labelColor); self.inputColor = awcFieldColor(inputColor)
        self.caretColor = awcFieldColor(caretColor); self.supportingTextColor = awcFieldColor(supportingTextColor); self.counterColor = awcFieldColor(counterColor)
    }
    public init(values v: [String: AWCValue]) {
        func t(_ k: String) -> String? { (v[k]?.string).flatMap { $0.isEmpty ? nil : $0 } }
        self.init(containerColor: t("containerColor"), labelColor: t("labelColor"), inputColor: t("inputColor"), caretColor: t("caretColor"),
                  supportingTextColor: t("supportingTextColor"), counterColor: t("counterColor"))
    }
    public func merging(_ o: Self) -> Self {
        .init(containerColor: o.containerColor ?? containerColor, labelColor: o.labelColor ?? labelColor, inputColor: o.inputColor ?? inputColor,
              caretColor: o.caretColor ?? caretColor, supportingTextColor: o.supportingTextColor ?? supportingTextColor, counterColor: o.counterColor ?? counterColor)
    }
}
private struct AWCTextFieldPartAppearanceKey: EnvironmentKey { static let defaultValue = AWCTextFieldPartAppearance() }
private struct AWCTextFieldPartAppearanceTargetsKey: EnvironmentKey { static let defaultValue: [String: AWCTextFieldPartAppearance] = [:] }
private struct AWCTextFieldAppearanceKey: EnvironmentKey { static let defaultValue = AWCTextFieldAppearance() }
private struct AWCTextFieldAppearanceTargetsKey: EnvironmentKey { static let defaultValue: [String: AWCTextFieldAppearance] = [:] }
private struct AWCFieldReducedMotionKey: EnvironmentKey { static let defaultValue: Bool? = nil }
extension EnvironmentValues {
    var awcTextFieldAppearance: AWCTextFieldAppearance { get { self[AWCTextFieldAppearanceKey.self] } set { self[AWCTextFieldAppearanceKey.self] = newValue } }
    var awcTextFieldAppearanceTargets: [String: AWCTextFieldAppearance] { get { self[AWCTextFieldAppearanceTargetsKey.self] } set { self[AWCTextFieldAppearanceTargetsKey.self] = newValue } }
    var awcTextFieldPartAppearance: AWCTextFieldPartAppearance { get { self[AWCTextFieldPartAppearanceKey.self] } set { self[AWCTextFieldPartAppearanceKey.self] = newValue } }
    var awcTextFieldPartAppearanceTargets: [String: AWCTextFieldPartAppearance] { get { self[AWCTextFieldPartAppearanceTargetsKey.self] } set { self[AWCTextFieldPartAppearanceTargetsKey.self] = newValue } }
    /// Overrides the system reduce-motion setting for the text-input family (tests, previews).
    var awcFieldReducedMotion: Bool? { get { self[AWCFieldReducedMotionKey.self] } set { self[AWCFieldReducedMotionKey.self] = newValue } }
}
private struct AWCTextFieldAppearanceModifier: ViewModifier {
    let value: AWCTextFieldAppearance, id: String?
    @Environment(\.awcTextFieldAppearance) private var inherited
    @Environment(\.awcTextFieldAppearanceTargets) private var targets
    func body(content: Content) -> some View {
        if let id { var t = targets; t[id] = (t[id] ?? .init()).merging(value); return AnyView(content.environment(\.awcTextFieldAppearanceTargets, t)) }
        return AnyView(content.environment(\.awcTextFieldAppearance, inherited.merging(value)))
    }
}
private struct AWCTextFieldPartAppearanceModifier: ViewModifier {
    let value: AWCTextFieldPartAppearance, id: String?
    @Environment(\.awcTextFieldPartAppearance) private var inherited
    @Environment(\.awcTextFieldPartAppearanceTargets) private var targets
    func body(content: Content) -> some View {
        if let id { var t = targets; t[id] = (t[id] ?? .init()).merging(value); return AnyView(content.environment(\.awcTextFieldPartAppearanceTargets, t)) }
        return AnyView(content.environment(\.awcTextFieldPartAppearance, inherited.merging(value)))
    }
}
public extension View {
    /// Applies md-text-field `::part()` values to descendant fields, or to the field with node id `id`.
    func awcTextFieldPartAppearance(_ value: AWCTextFieldPartAppearance, for id: String? = nil) -> some View { modifier(AWCTextFieldPartAppearanceModifier(value: value, id: id)) }
    /// Applies md-text-field hook values to descendant fields, or to the field with node id `id`.
    func awcTextFieldAppearance(_ value: AWCTextFieldAppearance, for id: String? = nil) -> some View { modifier(AWCTextFieldAppearanceModifier(value: value, id: id)) }
    /// Forces reduced (or full) motion for the text-input family, overriding the system setting.
    func awcFieldReducedMotion(_ reduced: Bool?) -> some View { environment(\.awcFieldReducedMotion, reduced) }
}

/// The pseudo-class / class inputs of md-text-field.css.
struct AWCTextFieldStates: Equatable {
    var focused = false          // .md-text-field--focused (real focus or appear-focused)
    var hover = false            // :host(:hover)
    var floating = false
    var hasLeading = false, hasError = false, disabled = false, hasLabel = true, hasChips = false, listening = false
    var clearHover = false, passwordHover = false, speechHover = false
}

/// Every value md-text-field.css derives, rule by rule (specificity and source order resolved).
struct AWCTextFieldStyle {
    let model: AWCTextFieldModel, appearance: AWCTextFieldAppearance, tokens: [String: String]
    /// `::part()` values: they win over hooks and every state rule.
    var parts = AWCTextFieldPartAppearance()
    /// `--md-sys-density-scale` (local prop wins over an inherited `data-density`).
    let scale: Double
    /// The reflected `density` attribute when it is one of the -1…-4 rungs (the label overrides key on it).
    let localRung: Double?
    func color(_ name: String, _ fallback: String) -> String { awcFieldColor(tokens["--md-sys-color-" + name]) ?? tokens["--md-sys-color-" + name] ?? fallback }
    static func mix(_ hex: String, _ alpha: Double) -> String {
        let c = Color(awcHex: hex).resolve(in: EnvironmentValues())
        return String(format: "#%02X%02X%02X%02X", Int((Double(c.red) * 255).rounded()), Int((Double(c.green) * 255).rounded()), Int((Double(c.blue) * 255).rounded()), Int((Double(c.opacity) * alpha * 255).rounded()))
    }
    var filled: Bool { model.variant == "filled" }
    // Spacing tokens per rung (tokens.css section 12): inset-lg 16/16/12/12/8, gap-lg 16/16/12/12/8.
    var insetLG: Double { scale <= -4 ? 8 : scale <= -2 ? 12 : 16 }
    var gapLG: Double { insetLG }
    var textInset: Double { insetLG + 7 }
    var padStart: Double { appearance.paddingInlineStart ?? textInset }
    var padEnd: Double { appearance.paddingInlineEnd ?? textInset }
    var iconSize: Double { appearance.iconSize ?? max(18, 24 + scale) }
    var minHeight: Double { 56 + scale * 4 }
    var padBlock: Double { filled ? max(2, 8 + scale * 0.5) : max(2, 8 + scale) }
    var inputFont: Double { max(13, 16 + scale * 0.5) }
    var inputLine: Double { filled ? max(16, 24 + scale * 2) : max(18, 24 + scale) }
    var restFont: Double { max(13, 16 + scale * 0.5) }
    var restLine: Double { max(18, 24 + scale) }
    var affixLine: Double { max(18, 24 + scale) }
    var tracking: Double { Double((tokens["--md-sys-typescale-body-large-tracking"] ?? "").replacingOccurrences(of: "px", with: "").trimmingCharacters(in: .whitespaces)) ?? 0.5 }
    /// The floated label (font size, line height, `top` inside the input wrap).
    var floatFont: Double {
        if filled { if localRung != nil { return 11 }; let small = Double((tokens["--md-sys-typescale-body-small-size"] ?? "").replacingOccurrences(of: "px", with: "")) ?? 12; return max(11, small + scale * 0.25) }
        return max(10, 12 + scale * 0.5)
    }
    var floatLine: Double {
        if filled && localRung != nil { return 12 }
        if filled { let small = Double((tokens["--md-sys-typescale-body-small-line-height"] ?? "").replacingOccurrences(of: "px", with: "")) ?? 16; return max(12, small + scale) }
        return max(12, 16 + scale)
    }
    var floatTop: Double {
        if filled { if let r = localRung { return r == -2 ? -2 : 1 }; return 0 }
        if let r = localRung, r <= -3 { return -4 }
        return -8 - scale
    }
    var legendFont: Double { max(10, 12 + scale * 0.5) }
    var supportFont: Double { max(10, 12 + scale * 0.5) }
    var supportLine: Double { max(14, 16 + scale * 0.5) }
    var shape: Double { appearance.containerShape ?? (Double((tokens["--md-sys-shape-corner-extra-small"] ?? "").replacingOccurrences(of: "px", with: "")) ?? 4) }
    var pill: Double { appearance.filledPill ?? 0 }
    var bottomRadius: Double { filled ? max(0, pill * shape) : shape }
    /// The focus border width: a non-default prop is written inline on the host and beats the hook.
    var focusBorder: Double { model.focusBorderWidth != 3 ? max(0, model.focusBorderWidth) : (appearance.focusBorderWidth ?? 3) }
    var focusInset: Double { model.focusBorderWidth != 3 ? -(model.focusBorderWidth - 1) : (appearance.focusInset ?? 0) }

    // Colors
    var active: String { appearance.activeIndicatorColor ?? color("primary", "#6750A4") }
    var errorColor: String { appearance.errorColor ?? color("error", "#B3261E") }
    var onSurface: String { color("on-surface", "#1C1B1F") }
    var onErrorContainer: String { color("on-error-container", "#8C1D18") }
    var baseLabel: String { appearance.labelColor ?? color("on-surface-variant", "#49454F") }
    var baseSupport: String { appearance.supportingTextColor ?? color("on-surface-variant", "#49454F") }
    var baseIcon: String { appearance.iconColor ?? color("on-surface-variant", "#49454F") }
    func containerFill(_ s: AWCTextFieldStates) -> String {
        if let c = parts.containerColor { return c }
        guard filled else { return "#00000000" }
        if s.disabled { return Self.mix(onSurface, 0.04) }
        return appearance.containerColor ?? color("surface-container-highest", "#E6E0E9")
    }
    func inputColor(_ s: AWCTextFieldStates) -> String { parts.inputColor ?? (s.disabled ? Self.mix(onSurface, 0.38) : appearance.inputColor ?? onSurface) }
    var placeholderColor: String { baseLabel }
    func caretColor(_ s: AWCTextFieldStates) -> String { parts.caretColor ?? (s.hasError ? errorColor : active) }
    private func idleHover(_ s: AWCTextFieldStates) -> Bool { s.hover && !s.focused && !s.disabled }
    func labelColor(_ s: AWCTextFieldStates) -> String {
        if let c = parts.labelColor { return c }
        if s.disabled { return Self.mix(onSurface, 0.38) }
        if idleHover(s) { return s.hasError ? onErrorContainer : onSurface }
        if s.hasError { return errorColor }
        if s.focused { return active }
        return baseLabel
    }
    func indicator(_ s: AWCTextFieldStates) -> (height: Double, color: String) {
        if s.disabled { return (1, Self.mix(onSurface, 0.38)) }
        if idleHover(s) { return (1, s.hasError ? onErrorContainer : onSurface) }
        if s.focused { return (focusBorder, s.hasError ? errorColor : active) }
        return (1, s.hasError ? errorColor : color("on-surface-variant", "#49454F"))
    }
    var indicatorOpacity: Double { min(1, max(0, 1 - pill)) }
    func outline(_ s: AWCTextFieldStates) -> (width: Double, color: String, inset: Double) {
        if s.disabled { return (s.focused ? focusBorder : 1, Self.mix(onSurface, 0.12), s.focused ? focusInset : 0) }
        if idleHover(s) { return (1, s.hasError ? onErrorContainer : onSurface, 0) }
        if s.focused { return (focusBorder, s.hasError ? errorColor : active, focusInset) }
        return (1, s.hasError ? errorColor : (appearance.outlineColor ?? color("outline", "#79747E")), 0)
    }
    func affixColor(_ s: AWCTextFieldStates) -> String { s.disabled ? Self.mix(onSurface, 0.38) : idleHover(s) ? onSurface : baseSupport }
    func leadingIconColor(_ s: AWCTextFieldStates) -> String { s.disabled ? Self.mix(onSurface, 0.38) : idleHover(s) ? onSurface : baseIcon }
    func trailingIconColor(_ s: AWCTextFieldStates) -> String {
        if s.disabled { return Self.mix(onSurface, 0.38) }
        if s.hasError { return errorColor }
        return idleHover(s) ? onSurface : baseIcon
    }
    /// Clear / password / speech glyph colour and opacity (`--disabled` classes are on-surface at 0.38 opacity).
    func actionColor(_ s: AWCTextFieldStates, disabled: Bool, hovered: Bool, listening: Bool = false) -> (color: String, opacity: Double) {
        if disabled { return (onSurface, 0.38) }
        if listening { return (errorColor, 1) }
        if s.hasError { return (errorColor, 1) }
        return (hovered ? onSurface : baseIcon, 1)
    }
    func supportColor(_ s: AWCTextFieldStates) -> String { parts.supportingTextColor ?? (s.disabled ? Self.mix(onSurface, 0.38) : s.hasError ? errorColor : baseSupport) }
    func counterColor(_ s: AWCTextFieldStates) -> String { parts.counterColor ?? (s.disabled ? Self.mix(onSurface, 0.38) : baseSupport) }
    func stateLayerOpacity(_ s: AWCTextFieldStates) -> Double {
        guard filled, s.hover, !s.disabled else { return 0 }
        return Double((tokens["--md-sys-state-hover-state-layer-opacity"] ?? "").trimmingCharacters(in: .whitespaces)) ?? 0.08
    }
    var focusRingColor: String { color("secondary", "#625B71") }

    // Motion tokens
    func duration(_ name: String, _ fallback: Double) -> Double { awcCSSDuration(tokens["--md-sys-motion-duration-\(name)"]) ?? fallback }
    func easing(_ name: String, _ fallback: [Double]) -> [Double] { awcCSSCubicBezier(tokens["--md-sys-motion-easing-\(name)"]) ?? fallback }
    var labelMotion: (Double, [Double]) { (duration("medium1", 250), easing("emphasized", [0.2, 0, 0, 1])) }
    var colorMotion: (Double, [Double]) { (duration("short2", 100), [0.25, 0.1, 0.25, 1]) }   // `ease`
    var layerMotion: (Double, [Double]) { (duration("short2", 100), easing("standard", [0.2, 0, 0, 1])) }
}
