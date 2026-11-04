import SwiftUI

// md-menu family: source model, hooks, metrics and placement (md-menu.tsx / md-menu.css, md-menu-item.css,
// md-sub-menu-item.css, md-menu-item-group.css). Pure data so the geometry is testable headless.

/// CSS length with the units the source hooks accept here: px, bare numbers (px), vh, vw and %.
struct AWCMenuLength: Equatable {
    let value: Double, unit: String
    init?(_ raw: String?) {
        guard let raw = raw?.trimmingCharacters(in: .whitespaces), !raw.isEmpty else { return nil }
        if let n = Double(raw) { value = n; unit = "px"; return }
        for u in ["px", "vh", "vw", "dvh", "%"] where raw.hasSuffix(u) {
            guard let n = Double(raw.dropLast(u.count)) else { return nil }
            value = n; unit = u == "dvh" ? "vh" : u; return
        }
        return nil
    }
    init(px: Double) { value = px; unit = "px" }
    func resolve(viewport: CGSize, percentBase: Double = 0) -> Double {
        switch unit { case "vh": return value * viewport.height / 100; case "vw": return value * viewport.width / 100
        case "%": return value * percentBase / 100; default: return value }
    }
}

/// The md-menu and md-menu-item CSS custom properties (hooks). Values are CSS lengths; colors are hex.
public struct AWCMenuAppearance: Equatable, Sendable {
    public var minWidth: String?, maxWidth: String?, maxBlockSize: String?, viewportMargin: String?
    public var groupGap: String?, sectionGap: String?, groupShape: String?, groupContainerShape: String?
    public var inlineSurfaceColor: String?, inlineFillRadiusEnd: String?
    public var itemHeight: String?, itemPaddingInline: String?, itemGap: String?, itemIconSize: String?, itemCheckSize: String?
    public init(minWidth: String? = nil, maxWidth: String? = nil, maxBlockSize: String? = nil, viewportMargin: String? = nil,
                groupGap: String? = nil, sectionGap: String? = nil, groupShape: String? = nil, groupContainerShape: String? = nil,
                inlineSurfaceColor: String? = nil, inlineFillRadiusEnd: String? = nil,
                itemHeight: String? = nil, itemPaddingInline: String? = nil, itemGap: String? = nil, itemIconSize: String? = nil, itemCheckSize: String? = nil) {
        self.minWidth = minWidth; self.maxWidth = maxWidth; self.maxBlockSize = maxBlockSize; self.viewportMargin = viewportMargin
        self.groupGap = groupGap; self.sectionGap = sectionGap; self.groupShape = groupShape; self.groupContainerShape = groupContainerShape
        self.inlineSurfaceColor = inlineSurfaceColor; self.inlineFillRadiusEnd = inlineFillRadiusEnd
        self.itemHeight = itemHeight; self.itemPaddingInline = itemPaddingInline; self.itemGap = itemGap; self.itemIconSize = itemIconSize; self.itemCheckSize = itemCheckSize
    }
    static let cssNames: [(String, WritableKeyPath<AWCMenuAppearance, String?>)] = [
        ("--md-menu-min-width", \.minWidth), ("--md-menu-max-width", \.maxWidth), ("--md-menu-max-block-size", \.maxBlockSize),
        ("--md-menu-viewport-margin", \.viewportMargin), ("--md-menu-group-gap", \.groupGap), ("--md-menu-section-gap", \.sectionGap),
        ("--md-menu-group-shape", \.groupShape), ("--md-menu-group-container-shape", \.groupContainerShape),
        ("--md-menu-inline-surface-color", \.inlineSurfaceColor), ("--md-menu-inline-fill-radius-end", \.inlineFillRadiusEnd),
        ("--md-menu-item-height", \.itemHeight), ("--md-menu-item-padding-inline", \.itemPaddingInline), ("--md-menu-item-gap", \.itemGap),
        ("--md-menu-item-icon-size", \.itemIconSize), ("--md-menu-item-check-size", \.itemCheckSize)]
    /// From authored CSS custom properties (the `style` map of a compiled node); unknown names are ignored.
    public init(css: [String: String]) {
        self.init(); for (name, path) in Self.cssNames { if let v = css[name] { self[keyPath: path] = v } }
    }
    /// Laboratory values: field names (`itemHeight`) or hook names without the `--md-menu-` prefix (`item-height`); a number
    /// is a px length, a string a CSS length (`inlineSurfaceColor`: #RRGGBB[AA]). Nil when a key or value is invalid.
    public init?(values: [String: AWCValue]) {
        self.init()
        for (k, v) in values {
            let hook = k.contains("-") ? k : k.replacingOccurrences(of: "([A-Z])", with: "-$1", options: .regularExpression).lowercased()
            guard let (_, path) = Self.cssNames.first(where: { $0.0 == "--md-menu-" + hook }) else { return nil }
            let text: String
            switch v {
            case .number(let n): guard n.isFinite, n >= 0 else { return nil }; text = (n == n.rounded() && abs(n) < 1e15 ? String(Int64(n)) : String(n)) + "px"
            case .string(let s): text = s.trimmingCharacters(in: .whitespaces)
            default: return nil
            }
            if path == \.inlineSurfaceColor { guard text.range(of: "^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$", options: .regularExpression) != nil else { return nil } }
            else if AWCMenuLength(text) == nil { return nil }
            self[keyPath: path] = text
        }
    }
    /// Inherited CSS custom properties: the inner (more specific) value wins.
    func merging(_ inner: AWCMenuAppearance) -> AWCMenuAppearance {
        var out = self; for (_, path) in Self.cssNames { if let v = inner[keyPath: path] { out[keyPath: path] = v } }; return out
    }
}
private struct AWCMenuAppearanceKey: EnvironmentKey { static let defaultValue = AWCMenuAppearance() }
private struct AWCMenuReducedMotionKey: EnvironmentKey { static let defaultValue: Bool? = nil }
extension EnvironmentValues {
    var awcMenuAppearance: AWCMenuAppearance { get { self[AWCMenuAppearanceKey.self] } set { self[AWCMenuAppearanceKey.self] = newValue } }
    var awcMenuReducedMotion: Bool? { get { self[AWCMenuReducedMotionKey.self] } set { self[AWCMenuReducedMotionKey.self] = newValue } }
}
public extension View {
    /// md-menu / md-menu-item hooks for every menu in this subtree (inner scopes override outer ones per hook).
    func awcMenuAppearance(_ appearance: AWCMenuAppearance) -> some View { modifier(AWCMenuAppearanceModifier(appearance: appearance)) }
    /// Test and preview override of the reduced-motion preference for menus.
    func awcMenuReducedMotion(_ reduced: Bool?) -> some View { environment(\.awcMenuReducedMotion, reduced) }
}
private struct AWCMenuAppearanceModifier: ViewModifier {
    @Environment(\.awcMenuAppearance) private var outer
    let appearance: AWCMenuAppearance
    func body(content: Content) -> some View { content.environment(\.awcMenuAppearance, outer.merging(appearance)) }
}

/// md-menu properties (source defaults).
struct AWCMenuModel: Equatable {
    var open = false, anchor = "", placement = "bottom-start", quick = false, variant = "baseline", layout = "standard"
    var useGap = false, emptyText = "", matchAnchorWidth = false, responsive = false, persistent = false, autoFocus = true
    var maxHeight: String? = nil, listLabel = "", listbox = false, density: Double? = nil, hidden = false
    init(_ p: [String: AWCValue]) {
        func b(_ k: String, _ d: Bool = false) -> Bool { p[k]?.bool ?? d }
        func s(_ k: String) -> String? { p[k]?.string }
        open = b("open"); anchor = s("anchor") ?? ""
        let pl = s("placement") ?? ""; placement = ["bottom-start", "bottom-end", "top-start", "top-end"].contains(pl) ? pl : "bottom-start"
        quick = b("quick"); let v = s("variant") ?? ""; variant = ["baseline", "standard", "vibrant"].contains(v) ? v : "baseline"
        layout = s("layout") == "grouped" ? "grouped" : "standard"; useGap = b("useGap"); emptyText = s("emptyText") ?? ""
        matchAnchorWidth = b("matchAnchorWidth"); responsive = b("responsive"); persistent = b("persistent"); autoFocus = b("autoFocus", true)
        if let n = p["maxHeight"]?.number { maxHeight = String(n) } else if let m = s("maxHeight"), !m.isEmpty { maxHeight = m }
        listLabel = s("listLabel") ?? ""; listbox = b("listbox"); density = p["density"]?.number; hidden = b("hidden")
    }
    /// `md-menu--grouped` exists only for the standard and vibrant variants.
    var grouped: Bool { variant != "baseline" && layout == "grouped" }
    var groupedGapCards: Bool { grouped && useGap }
}

/// md-menu-item / md-sub-menu-item properties.
struct AWCMenuItemModel: Equatable {
    var sub = false, headline = "", supportingText = "", trailingText = "", disabled = false, selected = false, indeterminate = false
    var keepOpen = false, divider = false, gap = false, badge = "", type = "button", checkPosition = "end", presentation = "menuitem"
    var roleOverride = "", density: Double? = nil, openDelay = 100.0, closeDelay = 400.0, hidden = false
    init(tag: String, _ p: [String: AWCValue]) {
        func b(_ k: String) -> Bool { p[k]?.bool ?? false }
        func s(_ k: String) -> String { p[k]?.string ?? "" }
        sub = tag == "md-sub-menu-item"; headline = s("headline"); supportingText = s("supportingText"); trailingText = sub ? "" : s("trailingText")
        disabled = b("disabled"); selected = !sub && b("selected"); indeterminate = !sub && b("indeterminate"); keepOpen = b("keepOpen")
        divider = b("divider"); gap = b("gap"); badge = s("badge")
        let t = s("type"); type = sub ? "button" : (["checkbox", "radio"].contains(t) ? t : "button")
        checkPosition = s("checkPosition") == "start" ? "start" : "end"; presentation = s("presentation") == "option" ? "option" : "menuitem"
        roleOverride = s("roleOverride"); density = p["density"]?.number
        if let d = p["openDelay"]?.number, d.isFinite { openDelay = d }; if let d = p["closeDelay"]?.number, d.isFinite { closeDelay = d }
        hidden = b("hidden")
    }
    var role: String {
        if !roleOverride.isEmpty { return roleOverride }
        if presentation == "option" { return "option" }
        return type == "checkbox" ? "menuitemcheckbox" : type == "radio" ? "menuitemradio" : "menuitem"
    }
    /// The row's accessible name: its text content as Chrome computes it (headline, supporting text, badge and, without
    /// a slotted trailing icon, the trailing text; the check, icons and arrow are aria-hidden).
    func accessibleName(trailingSlot: Bool) -> String {
        [headline, supportingText, badge, sub || trailingSlot ? "" : trailingText]
            .map { awcCollapsedInlineText($0) }.filter { !$0.isEmpty }.joined(separator: " ")
    }
    /// aria-checked: "mixed" for indeterminate (not selected) checkbox/radio rows, absent for buttons and options.
    var ariaChecked: String? { presentation == "option" || type == "button" ? nil : (indeterminate && !selected ? "mixed" : String(selected)) }
    var checkGlyph: String { selected ? "check" : indeterminate ? "remove" : "" }
}

/// Spacing tokens per density rung (md3.css `[density]` / `[data-density]` rules for -2…-4).
struct AWCMenuSpacing {
    let insetXS = 4.0, insetSM: Double, insetMD: Double, insetLG: Double, gapXS: Double, gapMD: Double
    init(rung: Double) {
        insetSM = rung <= -3 ? 4 : 8; insetMD = rung <= -2 ? 8 : 12; insetLG = rung <= -4 ? 8 : rung <= -2 ? 12 : 16
        gapXS = rung <= -4 ? 2 : 4; gapMD = rung <= -4 ? 4 : rung <= -2 ? 8 : 12
    }
}

/// Row metrics of md-menu-item / md-sub-menu-item for a density scale, variant and hooks.
struct AWCMenuRowMetrics: Equatable {
    let height: Double, paddingInline: Double, gap: Double, iconSize: Double, checkSize: Double
    let headlineSize: Double, headlineLine: Double, supportingSize: Double, supportingLine: Double
    init(scale d: Double, rung: Double, variant: String, sub: Bool, hooks a: AWCMenuAppearance, viewport: CGSize) {
        let sp = AWCMenuSpacing(rung: rung), styled = variant != "baseline"
        func len(_ s: String?) -> Double? { AWCMenuLength(s)?.resolve(viewport: viewport) }
        // Submenu rows ignore the --md-menu-item-* hooks (documented in their readme; a decision recorded in the source review).
        height = (sub ? nil : len(a.itemHeight)) ?? (48 + d * 4)
        paddingInline = (sub ? nil : len(a.itemPaddingInline)) ?? sp.insetMD
        gap = (sub ? nil : len(a.itemGap)) ?? (styled ? 8 : sp.gapMD)
        iconSize = (sub ? nil : len(a.itemIconSize)) ?? (styled ? max(16, 20 + d) : max(18, 24 + d))
        checkSize = (sub ? nil : len(a.itemCheckSize)) ?? max(16, 20 + d)
        headlineSize = max(13, 16 + d * 0.5); headlineLine = max(18, 24 + d); supportingSize = max(11, 14 + d * 0.5); supportingLine = max(16, 20 + d)
    }
}

/// Logical corner radii (start-start, start-end, end-start, end-end) of a row in the standard / vibrant variants.
struct AWCMenuRowCorners: Equatable {
    var ss: Double, se: Double, es: Double, ee: Double
    static func all(_ r: Double) -> Self { .init(ss: r, se: r, es: r, ee: r) }
    func physical(rtl: Bool) -> AWCCornerShape {
        func c(_ v: Double) -> AWCCornerRadius { .init(.points(v)) }
        return rtl ? AWCCornerShape(topLeft: c(se), topRight: c(ss), bottomRight: c(es), bottomLeft: c(ee))
                   : AWCCornerShape(topLeft: c(ss), topRight: c(se), bottomRight: c(ee), bottomLeft: c(es))
    }
    var values: [Double] { [ss, se, es, ee] }
    /// md-menu.css `::slotted` rules (direct menu children; they win over the row's own `:host` rules) and
    /// md-menu-item.css / md-sub-menu-item.css `:host` rules (rows inside groups).
    static func resolve(variant: String, first: Bool, last: Bool, afterGap: Bool, gap: Bool, directChild: Bool,
                        hover: Bool, active: Bool, selected: Bool, sub: Bool) -> Self {
        guard variant != "baseline" else { return .all(0) }
        let small = 8.0, large = 16.0, xs = 4.0, medium = 12.0
        var r = Self.all(small); if first { r.ss = large; r.se = large }; if last { r.es = large; r.ee = large }
        if directChild {
            // Source order inside md-menu.css: hover (0,1,1) < active/selected (0,1,1) < first:hover (0,2,1) < last:hover < first:last:hover.
            if hover { r = .all(xs) }
            if active || (selected && !sub) { r = .all(medium) }
            if hover && first && last { r = .all(large) }
            else if hover && first { r = .init(ss: large, se: large, es: xs, ee: xs) }
            else if hover && last { r = .init(ss: xs, se: xs, es: large, ee: large) }
            return r
        }
        // :host rules: selected (0,2,0) < hover (0,2,0) < active < first:hover < last:hover < first:last:hover < after-gap:hover < gap:hover < after-gap:gap:hover.
        if selected && !sub { r = .all(medium) }
        if hover { r = .all(xs) }
        if active { r = .all(medium) }
        if hover && first { r = .init(ss: large, se: large, es: xs, ee: xs) }
        if hover && last { r = .init(ss: xs, se: xs, es: large, ee: large) }
        if hover && first && last { r = .all(large) }
        if hover && afterGap { r = .init(ss: large, se: large, es: xs, ee: xs) }
        if hover && gap { r = .init(ss: xs, se: xs, es: large, ee: large) }
        if hover && afterGap && gap { r = .all(large) }
        return r
    }
}

/// Colors of the three menu variants (md-menu.css surfaces, md-menu-item.css / md-sub-menu-item.css rows).
struct AWCMenuPalette {
    let tokens: [String: String]
    func c(_ name: String, _ fallback: String) -> String { tokens["--md-sys-color-" + name] ?? fallback }
    func surface(_ variant: String) -> String {
        variant == "standard" ? c("surface-container-low", "#F7F2FA") : variant == "vibrant" ? c("tertiary-container", "#FFD8E4") : c("surface-container", "#F7F2FA")
    }
    func ink(_ variant: String, selected: Bool) -> String {
        if selected && variant == "standard" { return c("on-tertiary-container", "#31111D") }
        if selected && variant == "vibrant" { return c("on-tertiary", "#FFFFFF") }
        return variant == "vibrant" ? c("on-tertiary-container", "#31111D") : c("on-surface", "#1C1B1F")
    }
    /// Leading icon, trailing, supporting text and submenu arrow; selected rows inherit the row ink.
    func secondaryInk(_ variant: String, selected: Bool) -> String {
        if selected { return ink(variant, selected: true) }
        return variant == "vibrant" ? c("on-tertiary-container", "#31111D") : c("on-surface-variant", "#49454F")
    }
    func selectedFill(_ variant: String) -> String {
        variant == "standard" ? c("tertiary-container", "#FFD8E4") : variant == "vibrant" ? c("tertiary", "#7D5260") : c("secondary-container", "#E8DEF8")
    }
    func stateLayer(_ variant: String) -> String { variant == "vibrant" ? c("on-tertiary-container", "#31111D") : c("on-surface", "#1C1B1F") }
    var focusRing: String { c("secondary", "#625B71") }
    var divider: String { c("outline-variant", "#CAC4D0") }
    var badgeFill: String { c("tertiary-container", "#FFD8E4") }
    var badgeInk: String { c("on-tertiary-container", "#31111D") }
    var emptyInk: String { c("on-surface-variant", "#49454F") }
    var groupLabel: String { c("on-surface-variant", "#49454F") }
    static func surfaceShadow(_ variant: String) -> [AWCBoxShadow] {
        variant == "baseline" ? [.init(y: 1, blur: 2, color: "#0000004D"), .init(y: 2, blur: 6, spread: 2, color: "#00000026")]
                              : [.init(y: 1, blur: 3, color: "#0000001F"), .init(y: 4, blur: 8, spread: 3, color: "#00000014")]
    }
    /// Grouped cards: box-shadow on each group when the menu has a submenu, else the surface's drop-shadow filter.
    static let groupShadow: [AWCBoxShadow] = [.init(y: 1, blur: 2, color: "#00000026"), .init(y: 2, blur: 6, color: "#0000001A")]
}

/// md-menu `positionMenu()`: placement, flips, viewport clamp, responsive sheet and the scroll cap.
struct AWCMenuSurfacePlacement: Equatable {
    var origin: CGPoint, width: Double, cap: Double, vertical: String, horizontal: String, responsive: Bool
    /// `chrome` is the surface height outside the scroll viewport (padding + header), `content` the viewport's natural height.
    static func resolve(anchor: CGRect, surfaceWidth: Double, chrome: Double, content: Double, viewport: CGSize, model: AWCMenuModel,
                        appearance: AWCMenuAppearance, minWidth: Double) -> Self {
        let gap = 4.0, vw = Double(viewport.width), vh = Double(viewport.height)
        let m = AWCMenuLength(appearance.viewportMargin)?.resolve(viewport: viewport) ?? 8
        let baseCap = defaultCap(model: model, appearance: appearance, viewport: viewport, margin: m)
        func height(_ cap: Double) -> Double { chrome + min(content, cap) }
        let a = anchor
        if model.responsive && vw <= 600 {
            let w = vw - 2 * m, h = height(baseCap)
            var top = Double(a.maxY) + gap, vertical = "bottom"
            if top + h + m > vh && Double(a.minY) - gap - h >= m { top = Double(a.minY) - gap - h; vertical = "top" }
            top = max(m, min(top, vh - h - m))
            return .init(origin: .init(x: m, y: top), width: w, cap: baseCap, vertical: vertical, horizontal: "start", responsive: true)
        }
        let w = model.matchAnchorWidth ? max(surfaceWidth, Double(a.width)) : surfaceWidth
        var vertical = model.placement.hasPrefix("bottom") ? "bottom" : "top", horizontal = model.placement.hasSuffix("start") ? "start" : "end"
        let menuH0 = height(baseCap)
        let below = vh - Double(a.maxY) - gap - m, above = Double(a.minY) - gap - m
        if vertical == "bottom" && menuH0 > below { if menuH0 <= above || above > below { vertical = "top" } }
        else if vertical == "top" && menuH0 > above { if menuH0 <= below || below > above { vertical = "bottom" } }
        if horizontal == "start" && Double(a.minX) + w > vw { if Double(a.maxX) - w >= 0 { horizontal = "end" } }
        else if horizontal == "end" && Double(a.maxX) - w < 0 { if Double(a.minX) + w <= vw { horizontal = "start" } }
        let avail = vertical == "bottom" ? below : above
        let cap = min(baseCap, max(48, avail - chrome))
        let menuH = height(cap)
        let top = vertical == "bottom" ? Double(a.maxY) + gap : Double(a.minY) - gap - menuH
        let left = horizontal == "start" ? Double(a.minX) : Double(a.maxX) - w
        return .init(origin: .init(x: max(m, min(left, vw - w - m)), y: max(m, min(top, vh - menuH - m))), width: w, cap: cap,
                     vertical: vertical, horizontal: horizontal, responsive: false)
    }
    /// `max-block-size: min(<max-height> | var(--md-menu-max-block-size, 250px), 100dvh - 2 × margin)`.
    static func defaultCap(model: AWCMenuModel, appearance: AWCMenuAppearance, viewport: CGSize, margin: Double) -> Double {
        let mh = AWCMenuLength(model.maxHeight)?.resolve(viewport: viewport)
        let hook = AWCMenuLength(appearance.maxBlockSize)?.resolve(viewport: viewport) ?? 250
        return min(mh ?? hook, Double(viewport.height) - 2 * margin)
    }
    /// Transform origin of the open / close motion (physical, as the source writes it).
    var unitAnchor: UnitPoint { .init(x: horizontal == "start" ? 0 : 1, y: vertical == "bottom" ? 0 : 1) }
}

/// md-sub-menu-item `autoPositionSubmenu()`: inline-end of the row, flipped to inline-start when only that fits; clamped.
func awcSubmenuOrigin(row: CGRect, size: CGSize, viewport: CGSize, rtl: Bool) -> CGPoint {
    let w = Double(size.width > 0 ? size.width : 200), h = Double(size.height > 0 ? size.height : 200), vw = Double(viewport.width), vh = Double(viewport.height), m = 8.0
    let endLeft = rtl ? Double(row.minX) - w : Double(row.maxX), startLeft = rtl ? Double(row.maxX) : Double(row.minX) - w
    func fits(_ l: Double) -> Bool { l >= 0 && l + w <= vw }
    var left = endLeft; if !fits(endLeft) && fits(startLeft) { left = startLeft }
    var top = Double(row.minY); if top + h > vh { top = Double(row.maxY) - h }
    return .init(x: max(m, min(left, vw - w - m)), y: max(m, min(top, vh - h - m)))
}

/// Typeahead (500 ms buffer): a single character starts after the focused row; longer buffers include it.
struct AWCMenuTypeahead {
    private(set) var buffer = "", last = 0.0
    mutating func next(_ char: String, now: Double, focused: Int, labels: [String]) -> Int? {
        if now - last > 500 { buffer = "" }
        last = now; buffer += char.lowercased()
        let start = buffer.count == 1 ? focused + 1 : focused
        guard !labels.isEmpty else { return nil }
        for i in 0..<labels.count { let idx = ((start + i) % labels.count + labels.count) % labels.count; if labels[idx].lowercased().hasPrefix(buffer) { return idx } }
        return nil
    }
}

/// The accessible name of a menu anchor (the menu's name: Web aria-labelledby / ariaLabelledByElements = [anchor]):
/// aria-label, else a label property, else the anchor's text content.
func awcMenuAnchorName(_ node: AWCNode, _ p: [String: AWCValue]) -> String {
    for key in ["aria-label", "ariaLabel", "label"] {
        if let s = (p[key]?.string).map(awcCollapsedInlineText), !s.isEmpty { return s }
    }
    return awcCollapsedInlineText(node.authoredTextContent)
}
