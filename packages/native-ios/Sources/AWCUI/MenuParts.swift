import SwiftUI

/// md-menu's CSS parts (CEM order).
public enum AWCMenuPart: String, CaseIterable, Sendable, Hashable {
    case emptyText = "empty-text", surface, menuViewport = "menu-viewport"
}
/// md-menu-item's CSS parts (CEM order).
public enum AWCMenuItemPart: String, CaseIterable, Sendable, Hashable {
    case stateLayer = "state-layer", leadingIcon = "leading-icon", content, headline, supportingText = "supporting-text", badge, trailing
}
/// md-sub-menu-item's CSS parts (CEM order).
public enum AWCSubMenuItemPart: String, CaseIterable, Sendable, Hashable {
    case stateLayer = "state-layer", leadingIcon = "leading-icon", content, headline, supportingText = "supporting-text", badge
}

/// The `::part()` declarations with native meaning on the md-menu family's parts. Part rules come from the outer tree,
/// so a declared field wins over the hooks and every internal state rule (a state-layer `opacity` holds in every
/// interaction state; disabled rows still multiply their own 0.38).
/// - `background`: the part's fill. Surface, state layer and badge: replaces the role colour; other parts paint it behind their box.
/// - `color`: the part's ink (text and glyphs). On `content` it reaches the headline (CSS inheritance); the supporting text keeps its own colour rule.
/// - `outlineColor` / `outlineWidth`: a CSS outline around the part box (outside it, no layout effect).
/// - `cornerRadius`: the border radius of the part's fill and outline (surface: the surface shape and its shadow).
/// - `opacity`: the part's opacity (state layer: replaces the interaction-state opacity).
/// - `letterSpacing`: extra advance after every character of the part's text (headline, supporting text, badge, trailing text, empty text).
public struct AWCMenuPartAppearance: Equatable, Sendable {
    public let background: String?, color: String?, outlineColor: String?, outlineWidth: Double?
    public let cornerRadius: Double?, opacity: Double?, letterSpacing: Double?
    public init(background: String? = nil, color: String? = nil, outlineColor: String? = nil, outlineWidth: Double? = nil,
                cornerRadius: Double? = nil, opacity: Double? = nil, letterSpacing: Double? = nil) {
        func hex(_ v: String?) -> String? { v.flatMap { $0.range(of: "^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$", options: .regularExpression) != nil ? $0.uppercased() : nil } }
        func positive(_ v: Double?) -> Double? { v.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil } }
        self.background = hex(background); self.color = hex(color); self.outlineColor = hex(outlineColor)
        self.outlineWidth = positive(outlineWidth); self.cornerRadius = positive(cornerRadius)
        self.opacity = opacity.flatMap { $0.isFinite ? min(1, max(0, $0)) : nil }
        self.letterSpacing = letterSpacing.flatMap { $0.isFinite ? $0 : nil }
    }
    /// Laboratory / JSON form: `{"background": "#RRGGBB[AA]", "outlineWidth": 2, …}`; unknown keys and invalid values are ignored.
    public init(values: [String: AWCValue]) {
        func text(_ k: String) -> String? { guard case .string(let v) = values[k] else { return nil }; return v }
        func number(_ k: String) -> Double? { guard case .number(let v) = values[k] else { return nil }; return v }
        self.init(background: text("background"), color: text("color"), outlineColor: text("outlineColor"), outlineWidth: number("outlineWidth"),
                  cornerRadius: number("cornerRadius"), opacity: number("opacity"), letterSpacing: number("letterSpacing"))
    }
    public func merging(_ local: Self) -> Self {
        .init(background: local.background ?? background, color: local.color ?? color, outlineColor: local.outlineColor ?? outlineColor,
              outlineWidth: local.outlineWidth ?? outlineWidth, cornerRadius: local.cornerRadius ?? cornerRadius,
              opacity: local.opacity ?? opacity, letterSpacing: local.letterSpacing ?? letterSpacing)
    }
}

/// Declared part appearances: per part for every element of the tag (`md-menu-item::part(x)`), and per element ID
/// (`#id::part(x)`, which outranks the tag rule field by field).
struct AWCMenuPartStyles: Equatable {
    var menu: [String: AWCMenuPartAppearance] = [:], item: [String: AWCMenuPartAppearance] = [:], sub: [String: AWCMenuPartAppearance] = [:]
    static func key(_ part: String, _ id: String?) -> String { id.map { "\($0)\u{1}\(part)" } ?? part }
    static func resolve(_ d: [String: AWCMenuPartAppearance], _ part: String, _ id: String) -> AWCMenuPartAppearance? {
        switch (d[part], d[key(part, id)]) {
        case (nil, nil): return nil
        case let (g?, nil): return g
        case let (nil, t?): return t
        case let (g?, t?): return g.merging(t)
        }
    }
    func menu(_ part: AWCMenuPart, id: String) -> AWCMenuPartAppearance? { Self.resolve(menu, part.rawValue, id) }
    func row(_ part: String, id: String, sub isSub: Bool) -> AWCMenuPartAppearance? { Self.resolve(isSub ? sub : item, part, id) }
}
private struct AWCMenuPartStylesKey: EnvironmentKey { static let defaultValue = AWCMenuPartStyles() }
extension EnvironmentValues {
    var awcMenuParts: AWCMenuPartStyles { get { self[AWCMenuPartStylesKey.self] } set { self[AWCMenuPartStylesKey.self] = newValue } }
}
private struct AWCMenuPartsModifier: ViewModifier {
    let table: WritableKeyPath<AWCMenuPartStyles, [String: AWCMenuPartAppearance]>, key: String, value: AWCMenuPartAppearance
    @Environment(\.awcMenuParts) private var outer
    func body(content: Content) -> some View {
        var styles = outer; styles[keyPath: table][key] = (styles[keyPath: table][key] ?? .init()).merging(value)
        return content.environment(\.awcMenuParts, styles)
    }
}
public extension View {
    /// `md-menu::part(<part>)` styling for descendant menus (flyouts included), or `#menuID::part(<part>)` for one menu.
    func awcMenuPartAppearance(_ value: AWCMenuPartAppearance, part: AWCMenuPart, for menuID: String? = nil) -> some View {
        modifier(AWCMenuPartsModifier(table: \.menu, key: AWCMenuPartStyles.key(part.rawValue, menuID), value: value))
    }
    /// `md-menu-item::part(<part>)` styling for descendant rows, or `#itemID::part(<part>)` for one row.
    func awcMenuItemPartAppearance(_ value: AWCMenuPartAppearance, part: AWCMenuItemPart, for itemID: String? = nil) -> some View {
        modifier(AWCMenuPartsModifier(table: \.item, key: AWCMenuPartStyles.key(part.rawValue, itemID), value: value))
    }
    /// `md-sub-menu-item::part(<part>)` styling for descendant submenu rows, or `#itemID::part(<part>)` for one row.
    func awcSubMenuItemPartAppearance(_ value: AWCMenuPartAppearance, part: AWCSubMenuItemPart, for itemID: String? = nil) -> some View {
        modifier(AWCMenuPartsModifier(table: \.sub, key: AWCMenuPartStyles.key(part.rawValue, itemID), value: value))
    }
}

/// Paints a part's declared fill (behind the box), outline (outside it) and opacity; the renderer applies the part's ink.
struct AWCMenuPartBox: ViewModifier {
    let part: AWCMenuPartAppearance?
    var fill = true, applyOpacity = true
    @ViewBuilder func body(content: Content) -> some View {
        if let part {
            let shape = AWCNativeCornerShape(corners: .points(part.cornerRadius ?? 0))
            content
                .background { if fill, let b = part.background { shape.fill(Color(awcHex: b)) } }
                .overlay {
                    if let w = part.outlineWidth, w > 0 {
                        shape.inset(by: -w / 2).stroke(Color(awcHex: part.outlineColor ?? part.color ?? "#000000"), lineWidth: w).allowsHitTesting(false)
                    }
                }
                .opacity(applyOpacity ? part.opacity ?? 1 : 1)
        } else { content }
    }
}
/// The part's declared ink, if any (otherwise the inherited foreground style stays).
struct AWCMenuPartInk: ViewModifier {
    let color: String?
    @ViewBuilder func body(content: Content) -> some View { if let color { content.foregroundStyle(Color(awcHex: color)) } else { content } }
}

private struct AWCMenuInlineFillKey: EnvironmentKey { static let defaultValue = false }
extension EnvironmentValues {
    var awcMenuInlineFill: Bool { get { self[AWCMenuInlineFillKey.self] } set { self[AWCMenuInlineFillKey.self] = newValue } }
}
public extension View {
    /// The inline-fill embedding (the source's `md-menu--inline-fill` host class, md-date-picker's docked panel): descendant
    /// anchorless menus fill this view without shadow, padding or corner radius except the end corners
    /// (`--md-menu-inline-fill-radius-end`, AWCMenuAppearance.inlineFillRadiusEnd), on `--md-menu-inline-surface-color`
    /// (inlineSurfaceColor, transparent by default), bounded by this view instead of the height cap.
    func awcMenuInlineFill(_ on: Bool = true) -> some View { environment(\.awcMenuInlineFill, on) }
}
