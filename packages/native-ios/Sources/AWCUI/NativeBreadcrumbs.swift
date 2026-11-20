import SwiftUI
import Observation
import CoreText

// MARK: - Hooks

/// The twelve public hooks of md-breadcrumbs (`--md-breadcrumbs-*`) and md-breadcrumb-item (`--md-breadcrumb-item-*`).
/// Lengths are points; the stagger is milliseconds; `itemPadding` is the CSS padding shorthand (one to four px values).
/// Unset hooks keep the density-derived defaults of the source; nearer values win.
public struct AWCBreadcrumbsAppearance: Equatable, Sendable {
    public let gap: Double?, separatorColor: String?, textColor: String?, stagger: Double?
    public let linkColor: String?, currentColor: String?, currentBackground: String?, disabledColor: String?
    public let hoverColor: String?, stateLayerColor: String?, itemGap: Double?, itemPadding: [Double]?
    public init(gap: Double? = nil, separatorColor: String? = nil, textColor: String? = nil, stagger: Double? = nil,
                linkColor: String? = nil, currentColor: String? = nil, currentBackground: String? = nil, disabledColor: String? = nil,
                hoverColor: String? = nil, stateLayerColor: String? = nil, itemGap: Double? = nil, itemPadding: [Double]? = nil) {
        func len(_ v: Double?) -> Double? { v.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil } }
        self.gap = len(gap); self.separatorColor = awcSwitchColor(separatorColor); self.textColor = awcSwitchColor(textColor); self.stagger = len(stagger)
        self.linkColor = awcSwitchColor(linkColor); self.currentColor = awcSwitchColor(currentColor); self.currentBackground = awcSwitchColor(currentBackground)
        self.disabledColor = awcSwitchColor(disabledColor); self.hoverColor = awcSwitchColor(hoverColor); self.stateLayerColor = awcSwitchColor(stateLayerColor)
        self.itemGap = len(itemGap)
        self.itemPadding = itemPadding.flatMap { p in (1...4).contains(p.count) && p.allSatisfy { $0.isFinite && $0 >= 0 } ? p : nil }
    }
    /// Laboratory/source names; colours `#RRGGBB(AA)`, lengths in points, `itemPadding` as a number list.
    public init(values: [String: AWCValue]) {
        func n(_ k: String) -> Double? { values[k]?.number }; func s(_ k: String) -> String? { values[k]?.string }
        self.init(gap: n("gap"), separatorColor: s("separatorColor"), textColor: s("textColor"), stagger: n("stagger"), linkColor: s("linkColor"),
                  currentColor: s("currentColor"), currentBackground: s("currentBackground"), disabledColor: s("disabledColor"), hoverColor: s("hoverColor"),
                  stateLayerColor: s("stateLayerColor"), itemGap: n("itemGap"), itemPadding: Self.padding(values["itemPadding"]))
    }
    /// `itemPadding` as one number, a list of one to four numbers, or the Laboratory's {top, right, bottom, left}.
    static func padding(_ v: AWCValue?) -> [Double]? {
        guard let v else { return nil }
        if let n = v.number { return [n] }
        if case .object(let o) = v { let e = ["top", "right", "bottom", "left"].compactMap { o[$0]?.number }; return e.count == 4 ? e : nil }
        let a = v.array.compactMap(\.number); return a.isEmpty ? nil : a
    }
    public func merging(_ o: Self) -> Self {
        .init(gap: o.gap ?? gap, separatorColor: o.separatorColor ?? separatorColor, textColor: o.textColor ?? textColor, stagger: o.stagger ?? stagger,
              linkColor: o.linkColor ?? linkColor, currentColor: o.currentColor ?? currentColor, currentBackground: o.currentBackground ?? currentBackground,
              disabledColor: o.disabledColor ?? disabledColor, hoverColor: o.hoverColor ?? hoverColor, stateLayerColor: o.stateLayerColor ?? stateLayerColor,
              itemGap: o.itemGap ?? itemGap, itemPadding: o.itemPadding ?? itemPadding)
    }
    /// CSS padding shorthand → (top, right, bottom, left).
    var padding: (Double, Double, Double, Double)? {
        guard let p = itemPadding else { return nil }
        switch p.count { case 1: return (p[0], p[0], p[0], p[0]); case 2: return (p[0], p[1], p[0], p[1]); case 3: return (p[0], p[1], p[2], p[1]); default: return (p[0], p[1], p[2], p[3]) }
    }
}
private struct AWCBreadcrumbsAppearanceKey: EnvironmentKey { static let defaultValue = AWCBreadcrumbsAppearance() }
private struct AWCBreadcrumbsControllerKey: EnvironmentKey { static let defaultValue: AWCBreadcrumbsController? = nil }
private struct AWCBreadcrumbsReducedMotionKey: EnvironmentKey { static let defaultValue: Bool? = nil }
public extension EnvironmentValues {
    var awcBreadcrumbsAppearance: AWCBreadcrumbsAppearance { get { self[AWCBreadcrumbsAppearanceKey.self] } set { self[AWCBreadcrumbsAppearanceKey.self] = newValue } }
    var awcBreadcrumbsController: AWCBreadcrumbsController? { get { self[AWCBreadcrumbsControllerKey.self] } set { self[AWCBreadcrumbsControllerKey.self] = newValue } }
    /// Overrides the system Reduce Motion setting for trails (nil follows the system).
    var awcBreadcrumbsReducedMotion: Bool? { get { self[AWCBreadcrumbsReducedMotionKey.self] } set { self[AWCBreadcrumbsReducedMotionKey.self] = newValue } }
}
private struct AWCBreadcrumbsAppearanceModifier: ViewModifier {
    let value: AWCBreadcrumbsAppearance
    @Environment(\.awcBreadcrumbsAppearance) private var inherited
    func body(content: Content) -> some View { content.environment(\.awcBreadcrumbsAppearance, inherited.merging(value)) }
}
public extension View {
    /// Applies md-breadcrumbs / md-breadcrumb-item hook values to descendant trails.
    func awcBreadcrumbsAppearance(_ value: AWCBreadcrumbsAppearance) -> some View { modifier(AWCBreadcrumbsAppearanceModifier(value: value)) }
    /// Binds expand() / collapse() to the trails below.
    func awcBreadcrumbsController(_ controller: AWCBreadcrumbsController) -> some View { environment(\.awcBreadcrumbsController, controller) }
}

// MARK: - Parts

/// `::part()` styling of md-breadcrumb-item: separator (color, font-size), icon / label (color), link (color,
/// `text-decoration: underline`), static (color, background-color, border width and colour) and state-layer
/// (background-color, opacity). Part rules come from the outer tree, so they win over the hooks and every internal state rule:
/// a link colour holds on hover, a static colour / background replaces the current-page and disabled ones, and a state-layer
/// opacity shows in every state (links only: a static crumb has no state layer), as in Chrome. The underline is drawn in the
/// link colour (the decorating box's `currentColor`) under the label and an icon-font glyph. Colours `#RRGGBB(AA)`, lengths in
/// points; a border without a colour uses the crumb's colour.
public struct AWCBreadcrumbItemPartAppearance: Equatable, Sendable {
    public let separatorColor: String?, separatorFontSize: Double?, iconColor: String?, labelColor: String?
    public let linkColor: String?, linkUnderline: Bool?, staticColor: String?, staticBackground: String?, staticBorderWidth: Double?, staticBorderColor: String?
    public let stateLayerColor: String?, stateLayerOpacity: Double?
    public init(separatorColor: String? = nil, separatorFontSize: Double? = nil, iconColor: String? = nil, labelColor: String? = nil,
                linkColor: String? = nil, linkUnderline: Bool? = nil, staticColor: String? = nil, staticBackground: String? = nil,
                staticBorderWidth: Double? = nil, staticBorderColor: String? = nil, stateLayerColor: String? = nil, stateLayerOpacity: Double? = nil) {
        func len(_ v: Double?) -> Double? { v.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil } }
        self.separatorColor = awcSwitchColor(separatorColor); self.separatorFontSize = len(separatorFontSize).flatMap { $0 > 0 ? $0 : nil }
        self.iconColor = awcSwitchColor(iconColor); self.labelColor = awcSwitchColor(labelColor)
        self.linkColor = awcSwitchColor(linkColor); self.linkUnderline = linkUnderline
        self.staticColor = awcSwitchColor(staticColor); self.staticBackground = awcSwitchColor(staticBackground)
        self.staticBorderWidth = len(staticBorderWidth); self.staticBorderColor = awcSwitchColor(staticBorderColor)
        self.stateLayerColor = awcSwitchColor(stateLayerColor); self.stateLayerOpacity = stateLayerOpacity.flatMap { $0.isFinite ? min(1, max(0, $0)) : nil }
    }
    /// Laboratory names (the fields above).
    public init(values: [String: AWCValue]) {
        func n(_ k: String) -> Double? { values[k]?.number }; func s(_ k: String) -> String? { values[k]?.string }
        self.init(separatorColor: s("separatorColor"), separatorFontSize: n("separatorFontSize"), iconColor: s("iconColor"), labelColor: s("labelColor"),
                  linkColor: s("linkColor"), linkUnderline: values["linkUnderline"]?.bool, staticColor: s("staticColor"), staticBackground: s("staticBackground"),
                  staticBorderWidth: n("staticBorderWidth"), staticBorderColor: s("staticBorderColor"), stateLayerColor: s("stateLayerColor"), stateLayerOpacity: n("stateLayerOpacity"))
    }
    public func merging(_ o: Self) -> Self {
        .init(separatorColor: o.separatorColor ?? separatorColor, separatorFontSize: o.separatorFontSize ?? separatorFontSize, iconColor: o.iconColor ?? iconColor,
              labelColor: o.labelColor ?? labelColor, linkColor: o.linkColor ?? linkColor, linkUnderline: o.linkUnderline ?? linkUnderline,
              staticColor: o.staticColor ?? staticColor, staticBackground: o.staticBackground ?? staticBackground, staticBorderWidth: o.staticBorderWidth ?? staticBorderWidth,
              staticBorderColor: o.staticBorderColor ?? staticBorderColor, stateLayerColor: o.stateLayerColor ?? stateLayerColor, stateLayerOpacity: o.stateLayerOpacity ?? stateLayerOpacity)
    }
}
/// `::part()` styling of md-breadcrumbs: list (background-color and the CSS padding shorthand, physical edges), separator (the
/// overflow item's separator: color, font-size) and overflow-button (background-color in every state, replacing the hover /
/// focus tint, and the colour of its dots) and overflow (the overflow item's box: background, border, radius and padding with the
/// layout shift, `AWCPartBox`; gate-7 R6-17).
public struct AWCBreadcrumbsPartAppearance: Equatable, Sendable {
    public let listBackground: String?, listPadding: [Double]?, separatorColor: String?, separatorFontSize: Double?
    public let overflowButtonBackground: String?, overflowButtonColor: String?
    public let overflow: AWCPartBox?
    public init(listBackground: String? = nil, listPadding: [Double]? = nil, separatorColor: String? = nil, separatorFontSize: Double? = nil,
                overflowButtonBackground: String? = nil, overflowButtonColor: String? = nil, overflow: AWCPartBox? = nil) {
        self.listBackground = awcSwitchColor(listBackground)
        self.listPadding = listPadding.flatMap { p in (1...4).contains(p.count) && p.allSatisfy { $0.isFinite && $0 >= 0 } ? p : nil }
        self.separatorColor = awcSwitchColor(separatorColor); self.separatorFontSize = separatorFontSize.flatMap { $0.isFinite && $0 > 0 ? $0 : nil }
        self.overflowButtonBackground = awcSwitchColor(overflowButtonBackground); self.overflowButtonColor = awcSwitchColor(overflowButtonColor)
        self.overflow = overflow
    }
    /// Laboratory names; `listPadding` as one number, a list of one to four numbers or {top, right, bottom, left}.
    public init(values: [String: AWCValue]) {
        self.init(listBackground: values["listBackground"]?.string, listPadding: AWCBreadcrumbsAppearance.padding(values["listPadding"]), separatorColor: values["separatorColor"]?.string,
                  separatorFontSize: values["separatorFontSize"]?.number, overflowButtonBackground: values["overflowButtonBackground"]?.string, overflowButtonColor: values["overflowButtonColor"]?.string,
                  overflow: AWCPartBox(value: values["overflow"]))
    }
    public func merging(_ o: Self) -> Self {
        .init(listBackground: o.listBackground ?? listBackground, listPadding: o.listPadding ?? listPadding, separatorColor: o.separatorColor ?? separatorColor,
              separatorFontSize: o.separatorFontSize ?? separatorFontSize, overflowButtonBackground: o.overflowButtonBackground ?? overflowButtonBackground,
              overflowButtonColor: o.overflowButtonColor ?? overflowButtonColor, overflow: AWCPartBox.merge(overflow, o.overflow))
    }
    /// The list padding shorthand → physical (top, right, bottom, left).
    var listInsets: (Double, Double, Double, Double) {
        guard let p = listPadding else { return (0, 0, 0, 0) }
        switch p.count { case 1: return (p[0], p[0], p[0], p[0]); case 2: return (p[0], p[1], p[0], p[1]); case 3: return (p[0], p[1], p[2], p[1]); default: return (p[0], p[1], p[2], p[3]) }
    }
}
private struct AWCBreadcrumbItemPartAppearanceKey: EnvironmentKey { static let defaultValue = AWCBreadcrumbItemPartAppearance() }
private struct AWCBreadcrumbItemPartAppearanceTargetsKey: EnvironmentKey { static let defaultValue: [String: AWCBreadcrumbItemPartAppearance] = [:] }
private struct AWCBreadcrumbsPartAppearanceKey: EnvironmentKey { static let defaultValue = AWCBreadcrumbsPartAppearance() }
private struct AWCBreadcrumbsPartAppearanceTargetsKey: EnvironmentKey { static let defaultValue: [String: AWCBreadcrumbsPartAppearance] = [:] }
extension EnvironmentValues {
    var awcBreadcrumbItemPartAppearance: AWCBreadcrumbItemPartAppearance { get { self[AWCBreadcrumbItemPartAppearanceKey.self] } set { self[AWCBreadcrumbItemPartAppearanceKey.self] = newValue } }
    var awcBreadcrumbItemPartAppearanceTargets: [String: AWCBreadcrumbItemPartAppearance] { get { self[AWCBreadcrumbItemPartAppearanceTargetsKey.self] } set { self[AWCBreadcrumbItemPartAppearanceTargetsKey.self] = newValue } }
    var awcBreadcrumbsPartAppearance: AWCBreadcrumbsPartAppearance { get { self[AWCBreadcrumbsPartAppearanceKey.self] } set { self[AWCBreadcrumbsPartAppearanceKey.self] = newValue } }
    var awcBreadcrumbsPartAppearanceTargets: [String: AWCBreadcrumbsPartAppearance] { get { self[AWCBreadcrumbsPartAppearanceTargetsKey.self] } set { self[AWCBreadcrumbsPartAppearanceTargetsKey.self] = newValue } }
}
private struct AWCBreadcrumbItemPartAppearanceModifier: ViewModifier {
    let value: AWCBreadcrumbItemPartAppearance, id: String?
    @Environment(\.awcBreadcrumbItemPartAppearance) private var inherited
    @Environment(\.awcBreadcrumbItemPartAppearanceTargets) private var targets
    func body(content: Content) -> some View {
        if let id { var t = targets; t[id] = (t[id] ?? .init()).merging(value); return AnyView(content.environment(\.awcBreadcrumbItemPartAppearanceTargets, t)) }
        return AnyView(content.environment(\.awcBreadcrumbItemPartAppearance, inherited.merging(value)))
    }
}
private struct AWCBreadcrumbsPartAppearanceModifier: ViewModifier {
    let value: AWCBreadcrumbsPartAppearance, id: String?
    @Environment(\.awcBreadcrumbsPartAppearance) private var inherited
    @Environment(\.awcBreadcrumbsPartAppearanceTargets) private var targets
    func body(content: Content) -> some View {
        if let id { var t = targets; t[id] = (t[id] ?? .init()).merging(value); return AnyView(content.environment(\.awcBreadcrumbsPartAppearanceTargets, t)) }
        return AnyView(content.environment(\.awcBreadcrumbsPartAppearance, inherited.merging(value)))
    }
}
public extension View {
    /// Applies md-breadcrumb-item `::part()` styling to descendant crumbs, or to the crumb with `id`.
    func awcBreadcrumbItemPartAppearance(_ value: AWCBreadcrumbItemPartAppearance, for id: String? = nil) -> some View { modifier(AWCBreadcrumbItemPartAppearanceModifier(value: value, id: id)) }
    /// Applies md-breadcrumbs `::part()` styling to descendant trails, or to the trail with `id`.
    func awcBreadcrumbsPartAppearance(_ value: AWCBreadcrumbsPartAppearance, for id: String? = nil) -> some View { modifier(AWCBreadcrumbsPartAppearanceModifier(value: value, id: id)) }
}

/// md-breadcrumbs' methods: expand() and collapse() set the trail state and emit mdExpand (even with maxItems 0, as the source).
@MainActor @Observable public final class AWCBreadcrumbsController {
    @ObservationIgnored var setExpanded: ((Bool) -> Void)?
    nonisolated public init() {}
    public var isConnected: Bool { setExpanded != nil }
    public func expand() { setExpanded?(true) }
    public func collapse() { setExpanded?(false) }
}

// MARK: - Model

/// The trail as the source computes it: item indices/total, the current crumb (the last one unless an author marks
/// another), the collapse window (`maxItems > 0 && count > maxItems && !expanded`, before ≥ 0, after ≥ 1) and the toggle.
struct AWCBreadcrumbsModel {
    let items: [AWCNode], maxItems: Int, before: Int, after: Int, expanded: Bool
    /// A crumb outside a trail: never promoted to the current page (only an authored `current` makes it one).
    let standalone: Bool
    init(node: AWCNode, properties: [String: AWCValue], expanded: Bool) {
        items = node.children.filter { $0.tag == "md-breadcrumb-item" }
        standalone = properties["_standalone"]?.bool == true
        func int(_ k: String, _ d: Int) -> Int { properties[k]?.number.flatMap { $0.isFinite ? Int($0.rounded(.towardZero)) : nil } ?? d }
        maxItems = int("maxItems", 0); before = max(0, int("itemsBeforeCollapse", 1)); after = max(1, int("itemsAfterCollapse", 2)); self.expanded = expanded
    }
    var count: Int { items.count }
    var collapsing: Bool { !expanded && maxItems > 0 && count > maxItems }
    var showsToggle: Bool { collapsing }
    func collapsed(_ i: Int) -> Bool { collapsing && !(i < before || i >= count - after) }
    func tail(_ i: Int) -> Bool { collapsing && i >= count - after }
    var manualCurrent: Bool { items.enumerated().contains { i, it in it.properties["current"]?.bool == true && i != count - 1 } }
    func current(_ i: Int) -> Bool { manualCurrent || standalone ? items[i].properties["current"]?.bool == true : i == count - 1 }
    /// Display order: the leading crumbs, the toggle (nil), then the tail.
    var order: [Int?] {
        guard collapsing else { return items.indices.map { $0 } }
        return items.indices.filter { $0 < before && !tail($0) } + [nil] + items.indices.filter { tail($0) }
    }
}

/// Density-derived metrics (`--md-sys-density-scale` d ≤ 0) of the source stylesheets.
struct AWCBreadcrumbMetrics {
    let d: Double
    /// The density rungs set on this element and its ancestors (nearest first). md3.css defines the spacing tokens only
    /// on some rungs (`gap-sm` on −3/−4, `gap-xs` on −4), so a nearer rung that does not define one inherits it.
    var rungs: [Double] = []
    var listGap: Double { 8 + 2 * d }
    /// `--md-sys-spacing-gap-sm` / `-gap-xs` of the density ladder (md3.css `[density]` rules).
    var hostGap: Double { (rungs.isEmpty ? [d] : rungs).contains { $0 <= -3 } ? 4 : 8 }
    var toggleGap: Double { (rungs.isEmpty ? [d] : rungs).contains { $0 <= -4 } ? 2 : 4 }
    var fontSize: Double { max(12, 14 + 0.5 * d) }
    var lineHeight: Double { max(16, 20 + d) }
    var separatorSize: Double { max(13, 16 + 0.5 * d) }
    var paddingBlock: Double { 8 + 2 * d }
    var paddingInline: Double { max(4, 12 + 2 * d) }
    var iconGap: Double { 6 + d }
    var glyphSize: Double { max(14, 18 + d) }
    static let iconBox = 18.0, toggleSize = 32.0
}

// MARK: - Flow layout (the source's `display:flex; flex-wrap:wrap; align-items:center; gap: 0 <gap>`)

struct AWCBreadcrumbsFlow: Layout {
    let gap: Double, rtl: Bool
    func rows(_ sizes: [CGSize], width: Double) -> [[Int]] {
        var rows: [[Int]] = [[]], used = 0.0
        for (i, s) in sizes.enumerated() {
            let w = Double(s.width)
            if !rows[rows.count - 1].isEmpty && used + gap + w > width + 0.01 { rows.append([i]); used = w }
            else { used += (rows[rows.count - 1].isEmpty ? 0 : gap) + w; rows[rows.count - 1].append(i) }
        }
        return rows
    }
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let sizes = subviews.map { $0.sizeThatFits(.unspecified) }
        let width = Double(proposal.width ?? .infinity)
        let r = rows(sizes, width: width)
        let h = r.reduce(0.0) { $0 + Double($1.map { sizes[$0].height }.max() ?? 0) }
        return CGSize(width: proposal.width ?? CGFloat(r.map { row in row.reduce(0.0) { $0 + Double(sizes[$1].width) } + gap * Double(max(0, row.count - 1)) }.max() ?? 0), height: h)
    }
    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let sizes = subviews.map { $0.sizeThatFits(.unspecified) }
        var y = Double(bounds.minY)
        for row in rows(sizes, width: Double(bounds.width)) {
            let h = Double(row.map { sizes[$0].height }.max() ?? 0)
            var x = rtl ? Double(bounds.maxX) : Double(bounds.minX)
            for i in row {
                let w = Double(sizes[i].width)
                if rtl { x -= w }
                subviews[i].place(at: CGPoint(x: x, y: y + (h - Double(sizes[i].height)) / 2), anchor: .topLeading, proposal: ProposedViewSize(sizes[i]))
                x += rtl ? -gap : w + gap
            }
            y += h
        }
    }
}

// MARK: - Fonts

extension AWCNativeFonts {
    /// Material Symbols with the FILL and wght axes (breadcrumb icons: FILL 0 / wght 500, current FILL 1 / wght 600).
    static func breadcrumbSymbol(size: CGFloat, fill: Double, weight: Double) -> CTFont {
        _ = symbol(size: size)
        let axes: [NSNumber: Double] = [NSNumber(value: 0x46494C4C): fill, NSNumber(value: 0x77676874): weight, NSNumber(value: 0x47524144): 0, NSNumber(value: 0x6F70737A): 24]
        let descriptor = CTFontDescriptorCreateWithAttributes([kCTFontNameAttribute: "MaterialSymbolsOutlined-Regular", kCTFontVariationAttribute: axes] as CFDictionary)
        return CTFontCreateWithFontDescriptor(descriptor, size, nil)
    }
    /// Advance width of a single-run label (kerning on, CSS letter-spacing after every character).
    static func breadcrumbTextWidth(_ text: String, size: CGFloat, weight: Double, tracking: Double) -> Double {
        _ = label(size: size, weight: 500)
        let font = CTFontCreateWithName((weight >= 600 ? "Roboto-Bold" : weight >= 500 ? "Roboto-Medium" : "Roboto-Regular") as CFString, size, nil)
        let line = CTLineCreateWithAttributedString(NSAttributedString(string: text, attributes: [NSAttributedString.Key(kCTFontAttributeName as String): font]))
        return Double(CTLineGetTypographicBounds(line, nil, nil, nil)) + tracking * Double(text.count)
    }
    /// A neutral run in a right-to-left paragraph shows its bidi-mirrored glyphs (">>" renders and measures as "<<").
    static func bidiMirrored(_ text: String) -> String {
        let pairs: [Character: Character] = ["<": ">", ">": "<", "(": ")", ")": "(", "[": "]", "]": "[", "{": "}", "}": "{", "«": "»", "»": "«", "‹": "›", "›": "‹"]
        return String(text.map { pairs[$0] ?? $0 })
    }
    /// The `ch` unit of the label font (advance of "0"; Roboto's digits are tabular).
    static func breadcrumbCh(size: CGFloat, weight: Double = 500) -> Double {
        _ = label(size: size, weight: 500)
        let font = CTFontCreateWithName((weight >= 600 ? "Roboto-Bold" : weight >= 500 ? "Roboto-Medium" : "Roboto-Regular") as CFString, size, nil)
        var ch: UniChar = 0x30, glyph: CGGlyph = 0
        guard CTFontGetGlyphsForCharacters(font, &ch, &glyph, 1) else { return Double(size) * 0.5615 }
        var advance = CGSize.zero
        CTFontGetAdvancesForGlyphs(font, .horizontal, &glyph, &advance, 1)
        return Double(advance.width)
    }
}

// MARK: - Shared paint

func awcBreadcrumbRGBA(_ c: Color) -> AWCValue {
    let r = c.resolve(in: EnvironmentValues())
    return .array([.number(Double(r.red)), .number(Double(r.green)), .number(Double(r.blue)), .number(Double(r.opacity))])
}
struct AWCBreadcrumbPalette {
    let tokens: [String: String], a: AWCBreadcrumbsAppearance
    func token(_ k: String, _ d: String) -> Color { Color(awcHex: tokens["--md-sys-color-" + k] ?? d) }
    var separator: Color { a.separatorColor.map { Color(awcHex: $0) } ?? token("on-surface-variant", "#49454F") }
    var link: Color { (a.linkColor ?? a.textColor).map { Color(awcHex: $0) } ?? token("on-surface-variant", "#49454F") }
    var current: Color { a.currentColor.map { Color(awcHex: $0) } ?? token("on-secondary-container", "#1D192B") }
    var currentBackground: Color { a.currentBackground.map { Color(awcHex: $0) } ?? token("secondary-container", "#E8DEF8") }
    var disabled: Color { a.disabledColor.map { Color(awcHex: $0) } ?? token("on-surface", "#1C1B1F").opacity(0.61) }
    var hover: Color { a.hoverColor.map { Color(awcHex: $0) } ?? token("primary", "#6750A4") }
    var stateLayer: Color { a.stateLayerColor.map { Color(awcHex: $0) } ?? token("on-surface", "#1C1B1F") }
    var focusRing: Color { token("secondary", "#625B71") }
    var toggle: Color { token("on-surface-variant", "#49454F") }
    /// The trail's text colour (`--md-breadcrumbs-text-color`): the `currentColor` of the overflow item.
    var text: Color { a.textColor.map { Color(awcHex: $0) } ?? token("on-surface-variant", "#49454F") }
}

/// The overflow toggle's glyph: three 1.6-radius dots at x = 6, 12, 18 of a 24 viewBox, drawn in a 20 × 20 box.
struct AWCBreadcrumbDots: Shape {
    func path(in r: CGRect) -> Path {
        var p = Path(); let k = r.width / 24
        for x in [6.0, 12.0, 18.0] { p.addEllipse(in: CGRect(x: r.minX + (x - 1.6) * k, y: r.minY + (12 - 1.6) * k, width: 3.2 * k, height: 3.2 * k)) }
        return p
    }
}

/// The source's CSS transitions and the staggered entrance, on the frame clock (CACurrentMediaTime, ms):
/// colour / state layer / toggle background and press scale 200 ms cubic-bezier(0.34, 0.8, 0.34, 1), the hover nudge 350 ms
/// cubic-bezier(0.42, 1.67, 0.21, 0.9); a retarget starts from the current value like a CSS transition. The entrance is
/// opacity 0 → 1 and an 8-point slide from the inline start, 500 ms cubic-bezier(0.38, 1.21, 0.22, 1), delayed by
/// stagger × min(index, 11). Reduce Motion: instant transitions, no entrance, no nudge or press scale.
final class AWCBreadcrumbMotion {
    struct Track {
        var from: [Double]; var to: [Double]; var start: Double; var duration: Double; var curve: (Double, Double, Double, Double)
        /// The transition this one replaces: it keeps running until this one starts (0 or 1 element).
        var prior: [Track] = []
    }
    private(set) var tracks: [String: Track] = [:]
    /// One display frame (ms): a state change starts its CSS transition in the source's next frame — Chrome computes style once
    /// per frame, after the input — from the value at that frame.
    static let frame = 1000.0 / 60
    /// Per key, the track before a change that has not reached its frame yet, and that frame's time.
    private var pending: [String: (base: Track, start: Double)] = [:]
    private(set) var entranceStart: Double?
    private(set) var end = 0.0
    /// The surface kind (link / static) the tracks belong to; the source swaps the element, so a change starts no transition.
    private(set) var kind: String?
    /// Records the surface kind; true when it changed (the tracks then snap).
    func swap(kind next: String) -> Bool { defer { kind = next }; return kind != nil && kind != next }
    static func now() -> Double { CACurrentMediaTime() * 1000 }
    static let standard = (0.34, 0.8, 0.34, 1.0), nudge = (0.42, 1.67, 0.21, 0.9)
    func value(_ k: String, at t: Double) -> [Double] { tracks[k].map { Self.value($0, at: t) } ?? [] }
    static func value(_ tr: Track, at t: Double) -> [Double] {
        if t < tr.start { return tr.prior.first.map { value($0, at: t) } ?? tr.from }
        guard tr.duration > 0, t < tr.start + tr.duration else { return tr.to }
        let e = AWCNativeButtonTiming.cubic(max(0, (t - tr.start) / tr.duration), x1: tr.curve.0, y1: tr.curve.1, x2: tr.curve.2, y2: tr.curve.3)
        return zip(tr.from, tr.to).map { $0 + ($1 - $0) * e }
    }
    func scalar(_ k: String, at t: Double) -> Double { value(k, at: t).first ?? 0 }
    /// The first value applies without a transition (no prior style).
    /// A change starts in the next frame (`frame`); changes before it coalesce, and a set-and-reset within it starts none.
    func set(_ k: String, _ target: [Double], duration: Double, curve: (Double, Double, Double, Double), now t: Double, snap: Bool = false) {
        guard let tr = tracks[k], !snap else { tracks[k] = Track(from: target, to: target, start: t, duration: 0, curve: curve); pending[k] = nil; return }
        if let p = pending[k], t < p.start {
            guard p.base.to != target else { tracks[k] = p.base; pending[k] = nil; return }
            guard tr.to != target else { return }
            let from = Self.value(p.base, at: p.start)
            tracks[k] = Track(from: from.count == target.count ? from : target, to: target, start: p.start, duration: duration, curve: curve, prior: [p.base])
            end = max(end, p.start + duration); return
        }
        guard tr.to != target else { return }
        var base = tr; base.prior = []
        let start = t + Self.frame, from = Self.value(base, at: start)
        pending[k] = (base, start)
        tracks[k] = Track(from: from.count == target.count ? from : target, to: target, start: start, duration: duration, curve: curve, prior: [base])
        end = max(end, start + duration)
    }
    func startEntrance(now t: Double, enabled: Bool, delay: Double) {
        guard entranceStart == nil else { return }
        entranceStart = enabled ? t : -.infinity
        if enabled { end = max(end, t + delay + 500) }
    }
    /// (opacity, inline offset) of the entrance keyframes at time t.
    func entrance(at t: Double, delay: Double, rtl: Bool) -> (Double, Double) {
        guard let s = entranceStart, s.isFinite else { return (1, 0) }
        let e = t - s - delay
        let p = e <= 0 ? 0 : e >= 500 ? 1 : AWCNativeButtonTiming.cubic(e / 500, x1: 0.38, y1: 1.21, x2: 0.22, y2: 1)
        return (Swift.min(1, Swift.max(0, p)), (rtl ? 8 : -8) * (1 - p))
    }
}
func awcBreadcrumbComponents(_ c: Color) -> [Double] {
    let r = c.resolve(in: EnvironmentValues())
    return [Double(r.red), Double(r.green), Double(r.blue), Double(r.opacity)].map { ($0 * 10000).rounded() / 10000 }
}
func awcBreadcrumbColor(_ v: [Double]) -> Color { v.count == 4 ? Color(.sRGB, red: v[0], green: v[1], blue: v[2], opacity: v[3]) : .clear }

/// Keeps a TimelineView running while a motion has frames left.
struct AWCBreadcrumbClock {
    /// A 120 Hz periodic schedule while a motion runs (the values are computed from the media clock at render time,
    /// so frame pacing never changes them); an idle trail schedules nothing.
    static func schedule(paused: Bool) -> PeriodicTimelineSchedule { .periodic(from: paused ? .distantFuture : .now, by: 1.0 / 120) }
    static func kick(_ motion: AWCBreadcrumbMotion, _ animating: Binding<Bool>) {
        let wait = motion.end - AWCBreadcrumbMotion.now()
        if wait <= 0 { if animating.wrappedValue { animating.wrappedValue = false }; return }
        if !animating.wrappedValue { animating.wrappedValue = true }
        DispatchQueue.main.asyncAfter(deadline: .now() + wait / 1000 + 0.03) { kick(motion, animating) }
    }
}

// MARK: - Crumb

/// `max-inline-size: 32ch` with an ellipsis: the label keeps its natural width up to the cap, then truncates.
struct AWCBreadcrumbCapWidth: Layout {
    let limit: Double
    /// The exact (fractional) advance of a plain-text label, when known.
    var measured: Double? = nil
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        guard let v = subviews.first else { return .zero }
        let natural = v.sizeThatFits(.unspecified)
        if let measured { return CGSize(width: Swift.min(measured, limit), height: natural.height) }
        return Double(natural.width) <= limit ? natural : v.sizeThatFits(ProposedViewSize(width: limit, height: nil))
    }
    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        guard let v = subviews.first else { return }
        // Below the cap the text keeps its natural width (never an ellipsis from a fractional box); at the cap it truncates.
        let natural = Double(v.sizeThatFits(.unspecified).width)
        let truncating = (measured ?? natural) > limit
        v.place(at: bounds.origin, anchor: .topLeading, proposal: ProposedViewSize(width: truncating ? bounds.width : nil, height: bounds.height))
    }
}

/// One md-breadcrumb-item: the leading separator (index > 0) and its surface — a link (href, not current, not disabled)
/// with hover (hover colour, 2-point inline nudge, 8 % layer), keyboard focus (12 % layer, 3-point secondary ring offset 2),
/// press (12 % layer) and the md-ripple wave, or a static span (current page pill: secondary-container, weight 600, FILL 1
/// icon). Labels truncate at 32 ch with an ellipsis and keep the full accessible name. Hover follows the host pointer
/// (`awcNativePointerState`) when one is supplied, otherwise the platform hover.
struct AWCBreadcrumbItemView: View {
    let item: AWCNode, trailID: String, index: Int, total: Int, current: Bool
    let separator: String, density: Double, rungs: [Double], palette: AWCBreadcrumbPalette, appearance: AWCBreadcrumbsAppearance
    let rtl: Bool, reduced: Bool, entrance: Bool
    let label: AnyView, labelText: String, iconSlot: AnyView?
    /// The label is one text run (its width is measured exactly).
    var plainLabel = false
    let select: (AWCActivationMetadata.Source) -> Void
    let focusHandle: AWCButtonFocusHandle
    @Environment(\.awcNativePointerState) private var pointer
    @Environment(\.awcBreadcrumbItemPartAppearance) private var partScope
    @Environment(\.awcBreadcrumbItemPartAppearanceTargets) private var partTargets
    @State private var hover = false
    @State private var pressed = false
    @State private var frame: CGRect = .zero
    @State private var motion = AWCBreadcrumbMotion()
    @State private var animating = false
    /// The crumb's `::part()` styling (descendant scope merged with its id target).
    var parts: AWCBreadcrumbItemPartAppearance { partScope.merging(partTargets[item.id] ?? .init()) }
    var props: [String: AWCValue] { item.properties }
    var disabled: Bool { props["disabled"]?.bool == true }
    var href: String { props["href"]?.string ?? "" }
    var isLink: Bool { !current && !href.isEmpty && !disabled }
    var m: AWCBreadcrumbMetrics { .init(d: density, rungs: rungs) }
    var icon: String { props["icon"]?.string ?? "" }
    var hasIcon: Bool { iconSlot != nil || !icon.isEmpty }
    var padding: (Double, Double, Double, Double) { appearance.padding ?? (m.paddingBlock, m.paddingInline, m.paddingBlock, m.paddingInline) }
    var hovered: Bool { guard isLink else { return false }; return pointer.map { p in p.location.map { frame.contains($0) } ?? false } ?? hover }
    var isPressed: Bool { isLink && (pressed || (pointer?.isPointerDown == true && hovered)) }
    /// ::part(link) / ::part(static) colour wins over the hover, current and disabled colours.
    var ink: Color {
        if let c = isLink ? parts.linkColor : parts.staticColor { return Color(awcHex: c) }
        return disabled ? palette.disabled : current ? palette.current : hovered ? palette.hover : palette.link
    }
    var layerTarget: Double { guard isLink else { return 0 }; if let o = parts.stateLayerOpacity { return o }; return focusHandle.isFocusVisible || isPressed ? 0.12 : hovered ? 0.08 : 0 }
    var nudgeTarget: Double { isLink && hovered && !reduced ? (rtl ? -2 : 2) : 0 }
    var entranceDelay: Double { (appearance.stagger ?? 40) * Double(min(index, 11)) }
    var targets: [Double] { awcBreadcrumbComponents(ink) + [layerTarget, nudgeTarget] }
    /// CSS weight 600 matches the 700 face (the reference fonts ship Roboto 400/500/700).
    var weight: Double { current ? 700 : 500 }
    private var focusConfiguration: AWCNativeFocusConfiguration {
        .init(id: item.id, label: labelText, policy: AWCButtonAccessibilityPolicy(properties: isLink ? ["href": .string(href)] : ["disabled": true]), group: nil, cell: nil,
              handle: focusHandle, focusChanged: { _ in }, activate: { select(.keyboard) },
              routeKey: { key, _, _ in key == "Space" })   // a link activates on Enter only
    }
    var body: some View {
        let now = AWCBreadcrumbMotion.now(), t = targets, swapped = motion.swap(kind: isLink ? "link" : "static")
        let _ = motion.set("ink", Array(t[0..<4]), duration: reduced ? 0 : 200, curve: AWCBreadcrumbMotion.standard, now: now, snap: swapped)
        let _ = motion.set("layer", [t[4]], duration: reduced ? 0 : 200, curve: AWCBreadcrumbMotion.standard, now: now, snap: swapped)
        let _ = motion.set("nudge", [t[5]], duration: reduced ? 0 : 350, curve: AWCBreadcrumbMotion.nudge, now: now, snap: swapped)
        let _ = motion.startEntrance(now: now, enabled: entrance && !reduced, delay: entranceDelay)
        TimelineView(AWCBreadcrumbClock.schedule(paused: !animating)) { _ in content(at: AWCBreadcrumbMotion.now()) }
            .onChange(of: t) { _, _ in AWCBreadcrumbClock.kick(motion, $animating) }
            .onAppear { AWCBreadcrumbClock.kick(motion, $animating) }
    }
    @ViewBuilder func content(at now: Double) -> some View {
        let fontSize = m.fontSize, lineHeight = m.lineHeight, ch = AWCNativeFonts.breadcrumbCh(size: fontSize, weight: weight)
        let inkNow = motion.value("ink", at: now), layer = motion.scalar("layer", at: now), nudge = motion.scalar("nudge", at: now)
        let inkColor = awcBreadcrumbColor(inkNow), (opacity, slide) = motion.entrance(at: now, delay: entranceDelay, rtl: rtl)
        let ps = parts, sepSize = ps.separatorFontSize ?? m.separatorSize, sepColor = ps.separatorColor.map { Color(awcHex: $0) } ?? palette.separator
        let iconInk = ps.iconColor.map { Color(awcHex: $0) }, labelInk = ps.labelColor.map { Color(awcHex: $0) }
        let underline = isLink && ps.linkUnderline == true, border = isLink ? 0 : ps.staticBorderWidth ?? 0
        let surfaceBackground = isLink ? Color.clear : ps.staticBackground.map { Color(awcHex: $0) } ?? (current ? palette.currentBackground : .clear)
        let layerFill = ps.stateLayerColor.map { Color(awcHex: $0) } ?? palette.stateLayer
        HStack(spacing: appearance.gap ?? m.hostGap) {
            if index > 0 {
                AWCBreadcrumbCapWidth(limit: .infinity, measured: AWCNativeFonts.breadcrumbTextWidth(rtl ? AWCNativeFonts.bidiMirrored(separator) : separator, size: sepSize, weight: 500, tracking: 0.1)) {
                    Text(separator).font(AWCNativeFonts.label(size: sepSize, weight: 500)).tracking(0.1).foregroundStyle(sepColor).opacity(0.7) }
                    // The glyph sits in the crumb's line box (a ::part(separator) font-size larger than the line overflows it).
                    .frame(minHeight: lineHeight, maxHeight: ps.separatorFontSize == nil ? .infinity : lineHeight).accessibilityHidden(true)
                    .awcInspect(nodeID: item.id, part: "separator", name: "separator") { _ in ["color": awcBreadcrumbRGBA(sepColor), "fontSize": .number(sepSize), "text": .string(separator)] }
            }
            HStack(spacing: appearance.itemGap ?? m.iconGap) {
                if hasIcon {
                    Group {
                        if let iconSlot { iconSlot } else {
                            Text(icon).font(Font(AWCNativeFonts.breadcrumbSymbol(size: m.glyphSize, fill: current ? 1 : 0, weight: current ? 600 : 500))).tracking(0)
                                .underline(underline, color: inkColor).fixedSize()
                        }
                    }
                    .foregroundStyle(iconInk ?? inkColor).frame(width: AWCBreadcrumbMetrics.iconBox, height: AWCBreadcrumbMetrics.iconBox).accessibilityHidden(true)
                    .awcInspect(nodeID: item.id, part: "icon", name: "icon") { _ in ["color": awcBreadcrumbRGBA(iconInk ?? ink), "glyphSize": .number(m.glyphSize), "fill": .number(current ? 1 : 0)] }
                }
                AWCBreadcrumbCapWidth(limit: 32 * ch, measured: plainLabel ? AWCNativeFonts.breadcrumbTextWidth(labelText, size: fontSize, weight: weight, tracking: 0.1) : nil) { label.font(AWCNativeFonts.label(size: fontSize, weight: weight)).tracking(0.1).foregroundStyle(labelInk ?? inkColor).underline(underline, color: inkColor).lineLimit(1).truncationMode(.tail) }
                    .frame(minHeight: lineHeight)
                    .awcInspect(nodeID: item.id, part: "label", name: "label") { _ in ["color": awcBreadcrumbRGBA(labelInk ?? ink), "fontSize": .number(fontSize), "fontWeight": .number(weight), "maxWidth": .number(32 * ch), "underline": .bool(underline)] }
            }
            .padding(.top, padding.0).padding(.trailing, rtl ? padding.3 : padding.1).padding(.bottom, padding.2).padding(.leading, rtl ? padding.1 : padding.3)
            .padding(border)   // ::part(static) border: outside the padding, inside the pill
            .background { Capsule().fill(surfaceBackground) }
            .background { if isLink { Capsule().fill(layerFill).opacity(layer) } }
            .overlay { if border > 0 { Capsule().strokeBorder(ps.staticBorderColor.map { Color(awcHex: $0) } ?? inkColor, lineWidth: border) } }
            .awcRipple(disabled: !isLink, cornerRadius: 9999, contentColor: ink)
            .overlay { if isLink && focusHandle.isFocusVisible { Capsule().inset(by: -3.5).stroke(palette.focusRing, lineWidth: 3) } }
            .contentShape(Capsule())
            .offset(x: nudge)
            // The resting frame (hover hit area): measured outside the nudge (offset leaves the layout frame alone) and
            // without the entrance slide of the crumb; a frame that followed them would feed every animation frame back
            // into a state update (a synchronous update loop).
            // `.offset` follows the layout direction (a positive slide moves left in RTL): undo it physically.
            .onGeometryChange(for: CGRect.self) { $0.frame(in: .named("awc-native-preview")).offsetBy(dx: rtl ? slide : -slide, dy: 0) } action: { frame = $0 }
            .onContinuousHover { phase in if case .active = phase { hover = isLink } else { hover = false } }
            .simultaneousGesture(DragGesture(minimumDistance: 0).onChanged { _ in if isLink { pressed = true } }.onEnded { v in
                let inside = abs(v.translation.width) < 8 && abs(v.translation.height) < 8
                pressed = false; if isLink && inside { select(.pointer) } })
            .modifier(AWCBreadcrumbAccessibility(isLink: isLink, label: labelText, configuration: focusConfiguration))
            .awcInspect(nodeID: item.id, part: "surface", name: "surface") { _ in
                ["kind": .string(isLink ? "link" : "static"), "color": awcBreadcrumbRGBA(ink), "background": awcBreadcrumbRGBA(surfaceBackground),
                 // Laboratory inspection schema: `border` is four-edge; the width stays under `borderWidth`.
                 "border": .array(Array(repeating: .number(border), count: 4)), "borderWidth": .number(border),
                 "borderColor": awcBreadcrumbRGBA(border > 0 ? ps.staticBorderColor.map { Color(awcHex: $0) } ?? ink : .clear), "underline": .bool(underline),
                 "layerColor": awcBreadcrumbRGBA(layerFill),
                 "padding": .array([.number(padding.0), .number(padding.1), .number(padding.2), .number(padding.3)]), "layerOpacity": .number(layerTarget),
                 "focusRing": .bool(isLink && focusHandle.isFocusVisible), "hover": .bool(hovered), "pressed": .bool(isPressed), "current": .bool(current), "tabStop": .bool(isLink),
                 "inkNow": .array(inkNow.map { .number($0) }), "layerNow": .number(layer), "nudgeNow": .number(nudge), "renderTime": .number(now),
                 "motion": .number(Double(UInt(bitPattern: ObjectIdentifier(motion).hashValue) % 100_000)), "inkStart": .number(motion.tracks["ink"]?.start ?? -1), "inkDuration": .number(motion.tracks["ink"]?.duration ?? -1)]
            }
        }
        .opacity(opacity).offset(x: slide)
        .awcInspect(nodeID: item.id, name: "md-breadcrumb-item") { _ in
            ["itemIndex": .number(Double(index)), "itemTotal": .number(Double(total)), "current": .bool(current), "disabled": .bool(disabled), "density": .number(density),
             "opacity": .number(opacity), "slide": .number(slide), "renderTime": .number(now), "entranceStart": .number(motion.entranceStart.flatMap { $0.isFinite ? $0 : nil } ?? -1e9)]
        }
    }
}

/// The overflow toggle: a 32-point round "…" button (three 1.6-radius dots) labelled with expandLabel, preceded by a
/// separator when crumbs lead it; hover 8 % / focus 12 % background and a 0.94 press scale (200 ms), the focus ring.
struct AWCBreadcrumbToggleView: View {
    @Environment(\.layoutDirection) private var toggleDirection
    let nodeID: String, separator: String?, m: AWCBreadcrumbMetrics, palette: AWCBreadcrumbPalette, expandLabel: String, reduced: Bool
    /// Activation; true from the keyboard (the revealed crumb then shows the focus ring).
    let handle: AWCButtonFocusHandle, activate: (Bool) -> Void
    /// The trail's ::part(separator) / ::part(overflow-button) styling.
    var parts = AWCBreadcrumbsPartAppearance()
    @Environment(\.awcNativePointerState) private var pointer
    @State private var hover = false
    @State private var pressed = false
    @State private var frame: CGRect = .zero
    @State private var motion = AWCBreadcrumbMotion()
    @State private var animating = false
    var hovered: Bool { pointer.map { p in p.location.map { frame.contains($0) } ?? false } ?? hover }
    var isPressed: Bool { pressed || (pointer?.isPointerDown == true && hovered) }
    var focused: Bool { handle.isFocusVisible }
    var layerTarget: Double { focused ? 0.12 : hovered ? 0.08 : 0 }
    var scaleTarget: Double { isPressed ? 0.94 : 1 }
    var body: some View {
        let now = AWCBreadcrumbMotion.now(), t = [layerTarget, scaleTarget]
        let _ = motion.set("layer", [t[0]], duration: reduced ? 0 : 200, curve: AWCBreadcrumbMotion.standard, now: now)
        let _ = motion.set("scale", [t[1]], duration: reduced ? 0 : 200, curve: AWCBreadcrumbMotion.standard, now: now)
        TimelineView(AWCBreadcrumbClock.schedule(paused: !animating)) { _ in content(at: AWCBreadcrumbMotion.now()) }
            .onChange(of: t) { _, _ in AWCBreadcrumbClock.kick(motion, $animating) }
    }
    @ViewBuilder func content(at now: Double) -> some View {
        let layer = motion.scalar("layer", at: now), scale = motion.scalar("scale", at: now)
        let configuration = AWCNativeFocusConfiguration(id: nodeID + "-overflow", label: expandLabel, policy: AWCButtonAccessibilityPolicy(properties: [:]), group: nil, cell: nil,
                                                        handle: handle, focusChanged: { _ in }, activate: { activate(true) }, disclosureExpanded: false)
        let sepSize = parts.separatorFontSize ?? m.separatorSize, sepColor = parts.separatorColor.map { Color(awcHex: $0) } ?? palette.separator
        let dots = parts.overflowButtonColor.map { Color(awcHex: $0) } ?? palette.toggle
        // ::part(overflow-button) background-color replaces the hover / focus tint in every state.
        let fill = parts.overflowButtonBackground.map { Color(awcHex: $0) } ?? palette.toggle.opacity(layer)
        HStack(spacing: m.toggleGap) {
            if let separator {
                AWCBreadcrumbCapWidth(limit: .infinity, measured: AWCNativeFonts.breadcrumbTextWidth(toggleDirection == .rightToLeft ? AWCNativeFonts.bidiMirrored(separator) : separator, size: sepSize, weight: 400, tracking: 0)) {
                    Text(separator).font(AWCNativeFonts.label(size: sepSize, weight: 400)).foregroundStyle(sepColor) }.accessibilityHidden(true)
                    .awcInspect(nodeID: nodeID, part: "overflow-separator", name: "separator") { _ in ["color": awcBreadcrumbRGBA(sepColor), "fontSize": .number(sepSize)] }
            }
            AWCBreadcrumbDots().fill(dots).frame(width: 20, height: 20)
                .frame(width: AWCBreadcrumbMetrics.toggleSize, height: AWCBreadcrumbMetrics.toggleSize)
                .background(Circle().fill(fill))
                .overlay { if focused { Circle().inset(by: -3.5).stroke(palette.focusRing, lineWidth: 3) } }
                .contentShape(Circle())
                .scaleEffect(scale)
                // The resting frame, measured outside the press scale (a frame that followed it would loop into state).
                .onGeometryChange(for: CGRect.self) { $0.frame(in: .named("awc-native-preview")) } action: { frame = $0 }
                .onContinuousHover { phase in if case .active = phase { hover = true } else { hover = false } }
                .simultaneousGesture(DragGesture(minimumDistance: 0).onChanged { _ in pressed = true }.onEnded { v in
                    pressed = false; if abs(v.translation.width) < 8 && abs(v.translation.height) < 8 { activate(false) } })
                .awcFocusBridgeLayer { AWCNativeButtonFocusBridge(configuration: configuration) }
                .awcInspect(nodeID: nodeID, part: "overflow-button", name: "overflow-button") { _ in
                    ["color": awcBreadcrumbRGBA(dots), "background": awcBreadcrumbRGBA(parts.overflowButtonBackground.map { Color(awcHex: $0) } ?? palette.toggle.opacity(layerTarget)), "layerOpacity": .number(layerTarget), "focusRing": .bool(focused), "scale": .number(scaleTarget),
                     "layerNow": .number(layer), "scaleNow": .number(scale), "hover": .bool(hovered), "pressed": .bool(isPressed), "label": .string(expandLabel), "renderTime": .number(now)]
                }
        }
        // ::part(overflow) box (gate-7 R6-17): border + padding around the separator and the toggle; the list row grows with it.
        .awcPartBox(parts.overflow, ink: palette.text)
        .awcInspect(nodeID: nodeID, part: "overflow", name: "overflow") { _ in
            (parts.overflow?.metrics(ink: palette.text) ?? [:]).merging(["gap": .object(["row": 0, "column": .number(m.toggleGap)]), "toggleGap": .number(m.toggleGap)]) { _, b in b } }
    }
}

// MARK: - Trail

/// The trail's navigation landmark (a labelled container); a standalone crumb has none.
/// The trail is a navigation landmark named by `label`: macOS an AXGroup/AXLandmarkNavigation element listing the crumbs
/// (links through their focus bridges, static crumbs as text) and the toggle; iOS a labelled container (UIKit exposes
/// landmarks as containers, not elements).
struct AWCBreadcrumbsLandmark: ViewModifier {
    let label: String, enabled: Bool, id: String
    @ViewBuilder func body(content: Content) -> some View {
        if !enabled { content } else {
            #if canImport(AppKit)
            content.accessibilityHidden(true).environment(\.awcBreadcrumbsInLandmark, true)
                .background { AWCBreadcrumbsLandmarkBridge(label: label, identifier: id) }
            #else
            content.accessibilityElement(children: .contain).accessibilityLabel(label)
            #endif
        }
    }
}
private struct AWCBreadcrumbsInLandmarkKey: EnvironmentKey { static let defaultValue = false }
extension EnvironmentValues {
    var awcBreadcrumbsInLandmark: Bool { get { self[AWCBreadcrumbsInLandmarkKey.self] } set { self[AWCBreadcrumbsInLandmarkKey.self] = newValue } }
}
/// A link crumb is exposed by its focus bridge (AXLink / link trait named by the label, as Chrome exposes the anchor); a
/// static crumb (current, disabled or without href) is its label as static text, as Chrome exposes the span. Separators
/// and icons are decorative.
struct AWCBreadcrumbAccessibility: ViewModifier {
    let isLink: Bool, label: String, configuration: AWCNativeFocusConfiguration
    @Environment(\.awcBreadcrumbsInLandmark) private var inLandmark
    @ViewBuilder func body(content: Content) -> some View {
        if isLink {
            content.accessibilityHidden(true).awcFocusBridgeLayer { AWCNativeButtonFocusBridge(configuration: configuration) }
        } else {
            #if canImport(AppKit)
            if inLandmark { content.background { AWCBreadcrumbsTextElement(label: label) } }
            else { content.accessibilityElement(children: .ignore).accessibilityLabel(label).accessibilityAddTraits(.isStaticText) }
            #else
            content.accessibilityElement(children: .ignore).accessibilityLabel(label).accessibilityAddTraits(.isStaticText)
            #endif
        }
    }
}
#if canImport(AppKit)
import AppKit
/// AppKit landmark element: lists the crumbs' focus bridges and static texts inside its bounds in reading order.
final class AWCBreadcrumbsLandmarkView: NSView {
    var label = "", elementIdentifier = ""
    override func hitTest(_ point: NSPoint) -> NSView? { nil }
    override func isAccessibilityElement() -> Bool { true }
    override func accessibilityRole() -> NSAccessibility.Role? { .group }
    override func accessibilitySubrole() -> NSAccessibility.Subrole? { NSAccessibility.Subrole(rawValue: "AXLandmarkNavigation") }
    override func accessibilityLabel() -> String? { label }
    override func accessibilityIdentifier() -> String { elementIdentifier }
    override func accessibilityChildren() -> [Any]? {
        guard let window, let content = window.contentView else { return [] }
        let box = convert(bounds, to: nil).insetBy(dx: -1, dy: -1)
        func all(_ view: NSView) -> [NSView] { [view] + view.subviews.flatMap(all) }
        let items = all(content).filter { v in
            if let f = v as? AWCNativeButtonFocusView { guard f.configuration?.inert == false else { return false } } else if !(v is AWCBreadcrumbsTextElementView) { return false }
            let r = v.convert(v.bounds, to: nil); return box.contains(NSPoint(x: r.midX, y: r.midY))
        }.sorted { a, b in
            let ra = a.convert(a.bounds, to: nil), rb = b.convert(b.bounds, to: nil)
            if abs(ra.maxY - rb.maxY) > 1 { return ra.maxY > rb.maxY }
            return userInterfaceLayoutDirection == .rightToLeft ? ra.maxX > rb.maxX : ra.minX < rb.minX
        }
        for v in items { (v as? AWCNativeButtonFocusView)?.awcAccessibilityContainer = self; (v as? AWCBreadcrumbsTextElementView)?.container = self }
        return items
    }
}
/// The static text of a crumb inside the landmark (AXStaticText whose value is the label).
final class AWCBreadcrumbsTextElementView: NSView {
    var label = ""
    weak var container: NSView?
    override func hitTest(_ point: NSPoint) -> NSView? { nil }
    override func isAccessibilityElement() -> Bool { true }
    override func accessibilityRole() -> NSAccessibility.Role? { .staticText }
    override func accessibilityValue() -> Any? { label }
    override func accessibilityParent() -> Any? { container ?? super.accessibilityParent() }
}
struct AWCBreadcrumbsLandmarkBridge: NSViewRepresentable {
    let label: String, identifier: String
    func makeNSView(context: Context) -> AWCBreadcrumbsLandmarkView { AWCBreadcrumbsLandmarkView() }
    func updateNSView(_ view: AWCBreadcrumbsLandmarkView, context: Context) { view.label = label; view.elementIdentifier = identifier }
}
struct AWCBreadcrumbsTextElement: NSViewRepresentable {
    let label: String
    func makeNSView(context: Context) -> AWCBreadcrumbsTextElementView { AWCBreadcrumbsTextElementView() }
    func updateNSView(_ view: AWCBreadcrumbsTextElementView, context: Context) { view.label = label }
}
#endif

@MainActor @Observable final class AWCBreadcrumbsRuntime {
    var handles: [String: AWCButtonFocusHandle] = [:]
    let toggleHandle = AWCButtonFocusHandle()
    func handle(_ id: String) -> AWCButtonFocusHandle { if let h = handles[id] { return h }; let h = AWCButtonFocusHandle(); handles[id] = h; return h }
}

/// md-breadcrumbs: a navigation landmark (label) holding the wrapping list of crumbs, the separators and the overflow toggle.
struct AWCNativeBreadcrumbs: View {
    let node: AWCNode, properties: [String: AWCValue], expanded: Bool, theme: AWCTheme
    /// The density inherited from outside the trail (the trail's own environment already holds its resolved value) and
    /// whether any ancestor sets a −3/−4 rung (md3.css `gap-sm`), for the spacing tokens that only some rungs define.
    var outerDensity: Double? = nil
    var compactSmallGap = false
    let setExpanded: (Bool, Bool) -> Void          // (expanded, from the toggle)
    let renderChild: (AWCNode) -> AnyView
    let select: (AWCNode, Int, Int, Bool, AWCActivationMetadata.Source) -> Void
    @Environment(\.awcBreadcrumbsAppearance) private var appearance
    @Environment(\.awcBreadcrumbsController) private var controller
    @Environment(\.awcNativeDensity) private var inheritedDensity
    @Environment(\.layoutDirection) private var direction
    @Environment(\.accessibilityReduceMotion) private var systemReduceMotion
    @Environment(\.awcBreadcrumbsReducedMotion) private var reducedOverride
    @Environment(\.awcBreadcrumbsPartAppearance) private var partScope
    @Environment(\.awcBreadcrumbsPartAppearanceTargets) private var partTargets
    var reduced: Bool { reducedOverride ?? systemReduceMotion }
    @Environment(\.awcThemeTokens) private var tokens
    @State private var runtime = AWCBreadcrumbsRuntime()
    static let toggleKey = "\u{0}overflow"
    var density: Double { AWCNativeDensity.resolve(properties["density"]?.number, inherited: inheritedDensity) }
    var trailRungs: [Double] { [properties["density"]?.number, outerDensity ?? inheritedDensity, compactSmallGap ? -3 : nil].compactMap { $0 } }
    var body: some View {
        let model = AWCBreadcrumbsModel(node: node, properties: properties, expanded: expanded)
        let m = AWCBreadcrumbMetrics(d: density, rungs: trailRungs), rtl = direction == .rightToLeft
        let palette = AWCBreadcrumbPalette(tokens: tokens.isEmpty ? theme.tokens : tokens, a: appearance)
        let separator = properties["separator"]?.string ?? "/", label = properties["label"]?.string ?? "Breadcrumb"
        let parts = partScope.merging(partTargets[node.id] ?? .init()), list = parts.listInsets
        // SwiftUI mirrors custom layouts in right-to-left environments: the flow places in reading order.
        AWCBreadcrumbsFlow(gap: appearance.gap ?? m.listGap, rtl: false) {
            // Identity follows the crumb (revealed crumbs mount and replay the entrance; the others keep their state).
            ForEach(model.order.map { slot in slot.map { model.items[$0].id } ?? AWCNativeBreadcrumbs.toggleKey }, id: \.self) { key in
                if key == AWCNativeBreadcrumbs.toggleKey {
                    AWCBreadcrumbToggleView(nodeID: node.id, separator: model.before > 0 ? separator : nil, m: m, palette: palette,
                                            expandLabel: properties["expandLabel"]?.string ?? "Show full breadcrumb trail", reduced: reduced,
                                            handle: runtime.toggleHandle, activate: { expandFromToggle(model, keyboard: $0) }, parts: parts)
                } else if let i = model.items.firstIndex(where: { $0.id == key }), model.items[i].properties["hidden"]?.bool != true {
                    crumb(model.items[i], index: i, model: model, palette: palette, separator: separator, rtl: rtl)
                }
            }
        }
        // ::part(list): the CSS padding shorthand is physical (left stays left in RTL), the background fills the padded list.
        .padding(.top, list.0).padding(.bottom, list.2).padding(.leading, rtl ? list.1 : list.3).padding(.trailing, rtl ? list.3 : list.1)
        .background { if let c = parts.listBackground { Color(awcHex: c).awcInspect(nodeID: node.id, part: "list", name: "list") { _ in ["background": awcBreadcrumbRGBA(Color(awcHex: c))] } } }
        .frame(maxWidth: .infinity, alignment: rtl ? .trailing : .leading)
        .modifier(AWCBreadcrumbsLandmark(label: label, enabled: !model.standalone, id: node.id))
        .onAppear { bind(model) }
        .onChange(of: model.count) { _, _ in bind(model) }
        .awcInspect(nodeID: node.id, name: "md-breadcrumbs") { _ in
            ["itemCount": .number(Double(model.count)), "expanded": .bool(expanded), "collapsing": .bool(model.collapsing), "listGap": .number(appearance.gap ?? m.listGap),
             "listPadding": .array([.number(list.0), .number(list.1), .number(list.2), .number(list.3)]),
             "density": .number(density), "label": .string(label)]
        }
    }
    func bind(_ model: AWCBreadcrumbsModel) { controller?.setExpanded = { setExpanded($0, false) } }
    func itemDensity(_ item: AWCNode) -> Double { AWCNativeDensity.resolve(item.properties["density"]?.number, inherited: density) }
    @ViewBuilder func crumb(_ item: AWCNode, index: Int, model: AWCBreadcrumbsModel, palette: AWCBreadcrumbPalette, separator: String, rtl: Bool) -> some View {
        let icons = item.children.filter { $0.slot == "icon" }, content = item.children.filter { $0.slot != "icon" }
        let text = content.map(\.authoredTextContent).joined().trimmingCharacters(in: .whitespacesAndNewlines)
        let current = model.current(index)
        AWCBreadcrumbItemView(item: item, trailID: node.id, index: index, total: model.count, current: current, separator: separator,
                              density: itemDensity(item), rungs: [item.properties["density"]?.number].compactMap { $0 } + trailRungs, palette: palette, appearance: appearance, rtl: rtl, reduced: reduced,
                              entrance: true,
                              label: AnyView(HStack(spacing: 0) { ForEach(content) { c in
                                  // Slotted text paints in the crumb's ink (gate-7 R6-21): a text node rendered as its own view would set
                                  // the on-surface foreground over the link / hook / disabled / current colours.
                                  if c.tag == "#text" { Text(c.properties["text"]?.string ?? "") } else { renderChild(c) } } }), labelText: text,
                              iconSlot: icons.isEmpty ? nil : AnyView(ForEach(icons) { renderChild($0) }),
                              plainLabel: content.count == 1 && content[0].tag == "#text",
                              select: { source in select(item, index, model.count, current, source) }, focusHandle: runtime.handle(item.id))
            // Inspected from the trail (the Laboratory inspects the root), each crumb reports as part item-N of the trail.
            .environment(\.awcInspectionAlias, AWCInspectionAlias(childID: item.id, parentID: node.id, part: "item-\(index)"))
    }
    /// The toggle expands the trail, emits mdExpand and moves focus to the first revealed crumb with a link.
    func expandFromToggle(_ model: AWCBreadcrumbsModel, keyboard: Bool) {
        let first = model.items.indices.first { model.collapsed($0) }
        setExpanded(true, true)
        guard let first else { return }
        let target = model.items[first...].enumerated().first { offset, it in
            let i = first + offset
            return !(it.properties["href"]?.string ?? "").isEmpty && it.properties["disabled"]?.bool != true && !model.current(i)
        }?.element
        // Keyboard activation focuses with the ring (focus-visible); a pointer activation focuses without it.
        if let target { DispatchQueue.main.async { DispatchQueue.main.async { let h = runtime.handle(target.id); _ = keyboard ? h.requestFocus?() : (h.requestPointerFocus ?? h.requestFocus)?() } } }
    }
}

extension AWCNativeView {
    /// md-breadcrumbs: the dedicated renderer (items are its md-breadcrumb-item children).
    @ViewBuilder var nativeBreadcrumbs: some View {
        let properties = node.properties.merging(local) { _, l in l }
        AWCNativeBreadcrumbs(node: node, properties: properties, expanded: b("_expanded"), theme: theme,
            outerDensity: inheritedDensity, compactSmallGap: inheritedCompactSmallGap,
            setExpanded: { next, _ in
                guard b("_expanded") != next else { return }
                set("_expanded", .bool(next))
                // Cancelable like the source event; the trail state does not depend on it (documented "cancelable but ignored").
                let detail: AWCValue = .object(["expanded": .bool(next), "itemCount": .number(Double(node.children.filter { $0.tag == "md-breadcrumb-item" }.count))])
                onEvent(AWCEventDispatcher.dispatch(AWCEvent(name: "mdExpand", tag: node.tag, nodeID: node.id, detail: detail), through: eventDispatcher, cancelable: true, targetListeners: eventTargetListeners).observedEvent)
            },
            renderChild: { child($0) },
            select: { item, index, total, current, _ in selectCrumb(item, index: index, total: total, current: current) })
    }
    /// A crumb outside a trail renders as the first crumb (no separator, never current unless authored).
    @ViewBuilder var nativeBreadcrumbItem: some View {
        let trail = AWCNode(id: node.id + "-trail", tag: "md-breadcrumbs", properties: [:], children: [node])
        AWCNativeBreadcrumbs(node: trail, properties: ["_standalone": true], expanded: false, theme: theme, outerDensity: inheritedDensity, compactSmallGap: inheritedCompactSmallGap, setExpanded: { _, _ in }, renderChild: { child($0) },
                             select: { item, index, total, current, _ in selectCrumb(item, index: index, total: total, current: current) })
    }
    /// mdSelect (cancelable) with the source detail; unless prevented, the link opens through the URL router.
    func selectCrumb(_ item: AWCNode, index: Int, total: Int, current: Bool) {
        let href = item.properties["href"]?.string ?? ""
        let label = item.children.filter { $0.slot != "icon" }.map(\.authoredTextContent).joined().trimmingCharacters(in: .whitespacesAndNewlines)
        let detail: AWCValue = .object(["href": .string(href), "label": .string(label), "current": .bool(current), "itemIndex": .number(Double(index)), "itemTotal": .number(Double(total))])
        let context = AWCEventDispatcher.dispatch(AWCEvent(name: "mdSelect", tag: "md-breadcrumb-item", nodeID: item.id, detail: detail), through: eventDispatcher, cancelable: true, targetListeners: eventTargetListeners)
        onEvent(context.observedEvent)
        guard !context.defaultPrevented else { return }
        let router = urlRouter ?? AWCURLRouter { request in openURL(request.url); return true }
        router.route(href: href, target: item.properties["target"]?.string ?? "_self", nodeID: item.id)
    }
}
