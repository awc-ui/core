import SwiftUI

/// The md-table family's exported `::part()` targets (33 on 7 tags), named "tag::part".
public enum AWCTablePart: String, CaseIterable, Sendable, Hashable {
    // md-table
    case caption = "md-table::caption", grid = "md-table::grid", headerGrid = "md-table::header-grid"
    case hscrollbar = "md-table::hscrollbar", hscrollbarThumb = "md-table::hscrollbar-thumb"
    case vscrollbar = "md-table::vscrollbar", vscrollbarThumb = "md-table::vscrollbar-thumb"
    case skeletonRow = "md-table::skeleton-row", loading = "md-table::loading", progress = "md-table::progress", empty = "md-table::empty"
    // md-table-cell
    case cellContent = "md-table-cell::content", cellPin = "md-table-cell::pin"
    // md-table-container
    case containerTop = "md-table-container::top", containerScroll = "md-table-container::scroll", containerBottom = "md-table-container::bottom"
    // md-table-row
    case rowExpanded = "md-table-row::expanded"
    // md-table-sort-label
    case sortLabelIcon = "md-table-sort-label::icon", sortLabelLabel = "md-table-sort-label::label"
    // md-table-toolbar
    case toolbarMain = "md-table-toolbar::main", toolbarLeading = "md-table-toolbar::leading", toolbarHeadline = "md-table-toolbar::headline"
    case toolbarSupportingText = "md-table-toolbar::supporting-text", toolbarSelectionCaption = "md-table-toolbar::selection-caption", toolbarActions = "md-table-toolbar::actions"
    // md-table-pagination
    case paginationDisplay = "md-table-pagination::display", paginationRpp = "md-table-pagination::rpp", paginationRppSelect = "md-table-pagination::rpp-select"
    case paginationNav = "md-table-pagination::nav", paginationFirstButton = "md-table-pagination::first-button", paginationPrevButton = "md-table-pagination::prev-button"
    case paginationNextButton = "md-table-pagination::next-button", paginationLastButton = "md-table-pagination::last-button"

    public var tag: String { String(rawValue.split(separator: ":").first ?? "") }
    public var part: String { String(rawValue.split(separator: ":").last ?? "") }
    public init?(tag: String, part: String) { self.init(rawValue: tag + "::" + part) }
}

/// The md-table family's name for the shared part vocabulary.
public typealias AWCTablePartStyle = AWCPartStyle
/// Physical box edges of a part (shared name).
public typealias AWCPartEdges = AWCTableEdges

/// Physical box edges (CSS padding: top, right, bottom, left — not mirrored in right-to-left).
public struct AWCTableEdges: Equatable, Sendable {
    public var top: Double, right: Double, bottom: Double, left: Double
    public init(top: Double = 0, right: Double = 0, bottom: Double = 0, left: Double = 0) { self.top = top; self.right = right; self.bottom = bottom; self.left = left }
    func insets(rtl: Bool) -> EdgeInsets { EdgeInsets(top: top, leading: rtl ? right : left, bottom: bottom, trailing: rtl ? left : right) }
}

/// Sparse `::part()` declarations of an exported part — the shared vocabulary of the table family, the charts and the
/// organization chart. Part rules come from the outer tree, so they win over the hooks and the internal state rules of the
/// part's own box. Each field is one CSS declaration (shorthands expand).
public struct AWCPartStyle: Equatable, Sendable {
    /// color (the part's text and icon colour)
    public var color: String?
    /// background-color (#RRGGBB / #RRGGBBAA)
    public var backgroundColor: String?
    /// opacity (0…1, the whole part)
    public var opacity: Double?
    /// border-radius (px; clips the part's background)
    public var cornerRadius: Double?
    /// padding (padding / padding-block / padding-inline / padding-top … expand to physical edges)
    public var padding: AWCTableEdges?
    /// font-size / font-weight / letter-spacing (px, 1…1000, px)
    public var fontSize: Double?, fontWeight: Double?, letterSpacing: Double?

    public init(color: String? = nil, backgroundColor: String? = nil, opacity: Double? = nil, cornerRadius: Double? = nil, padding: AWCTableEdges? = nil,
                fontSize: Double? = nil, fontWeight: Double? = nil, letterSpacing: Double? = nil) {
        func hex(_ v: String?) -> String? { v.flatMap { $0.range(of: "^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$", options: .regularExpression) != nil ? $0.uppercased() : nil } }
        func positive(_ v: Double?) -> Double? { v.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil } }
        self.color = hex(color); self.backgroundColor = hex(backgroundColor)
        self.opacity = opacity.flatMap { $0.isFinite ? Swift.min(1, Swift.max(0, $0)) : nil }
        self.cornerRadius = positive(cornerRadius); self.padding = padding
        self.fontSize = positive(fontSize); self.fontWeight = fontWeight.flatMap { $0.isFinite && (1...1000).contains($0) ? $0 : nil }
        self.letterSpacing = letterSpacing.flatMap { $0.isFinite ? $0 : nil }
    }
    /// From CSS declarations (property → value), as a `::part()` rule authors them. Unknown properties are ignored.
    public init(declarations: [String: String]) {
        func px(_ v: String) -> Double? { let t = v.trimmingCharacters(in: .whitespaces); return Double(t.hasSuffix("px") ? String(t.dropLast(2)) : t) }
        func color(_ v: String?) -> String? {
            guard var t = v?.trimmingCharacters(in: .whitespaces).lowercased(), t.hasPrefix("#") else { return nil }
            if t.count == 4 || t.count == 5 { t = "#" + t.dropFirst().map { "\($0)\($0)" }.joined() }
            return t
        }
        var pad: AWCTableEdges? = nil
        func edges(_ v: String) -> [Double]? { let n = v.split(separator: " ").compactMap { px(String($0)) }; return n.isEmpty ? nil : n }
        for (k, v) in declarations.sorted(by: { $0.key < $1.key }) where k.hasPrefix("padding") {
            guard let n = edges(v) else { continue }
            var e = pad ?? AWCTableEdges()
            switch k {
            case "padding":
                let t = n[0], r = n.count > 1 ? n[1] : t, b = n.count > 2 ? n[2] : t, l = n.count > 3 ? n[3] : r
                e = AWCTableEdges(top: t, right: r, bottom: b, left: l)
            case "padding-block": e.top = n[0]; e.bottom = n.count > 1 ? n[1] : n[0]
            case "padding-inline": e.left = n[0]; e.right = n.count > 1 ? n[1] : n[0]
            case "padding-top", "padding-block-start": e.top = n[0]
            case "padding-bottom", "padding-block-end": e.bottom = n[0]
            case "padding-left": e.left = n[0]
            case "padding-right": e.right = n[0]
            default: continue
            }
            pad = e
        }
        let weights = ["normal": 400.0, "bold": 700.0]
        self.init(color: color(declarations["color"]), backgroundColor: color(declarations["background-color"] ?? declarations["background"]),
                  opacity: declarations["opacity"].flatMap { Double($0.trimmingCharacters(in: .whitespaces)) }, cornerRadius: declarations["border-radius"].flatMap(px),
                  padding: pad, fontSize: declarations["font-size"].flatMap(px),
                  fontWeight: declarations["font-weight"].flatMap { weights[$0.trimmingCharacters(in: .whitespaces)] ?? Double($0.trimmingCharacters(in: .whitespaces)) },
                  letterSpacing: declarations["letter-spacing"].flatMap(px))
    }
    /// From a `::part()` rule body (`color:#B71C1C;padding:6px 12px`).
    public init(css: String) {
        var d: [String: String] = [:]
        for decl in css.split(separator: ";") {
            let kv = decl.split(separator: ":", maxSplits: 1).map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            if kv.count == 2, !kv[0].isEmpty { d[kv[0].lowercased()] = kv[1] }
        }
        self.init(declarations: d)
    }
    /// The authored values of `local` over these.
    public func merging(_ local: Self) -> Self {
        .init(color: local.color ?? color, backgroundColor: local.backgroundColor ?? backgroundColor, opacity: local.opacity ?? opacity, cornerRadius: local.cornerRadius ?? cornerRadius,
              padding: local.padding ?? padding, fontSize: local.fontSize ?? fontSize, fontWeight: local.fontWeight ?? fontWeight, letterSpacing: local.letterSpacing ?? letterSpacing)
    }
    public var isEmpty: Bool { self == .init() }
    /// Forced colours: Chrome replaces author colours with the system palette (the part's box declarations stay).
    var withoutColors: Self { var s = self; s.color = nil; s.backgroundColor = nil; return s }
    static func resolve(_ p: AWCTablePart, _ id: String, _ parts: [AWCTablePart: AWCTablePartStyle], _ targets: [String: [AWCTablePart: AWCTablePartStyle]], forced: Bool) -> Self {
        let base = parts[p] ?? .init(), style = targets[id]?[p].map { base.merging($0) } ?? base
        return forced ? style.withoutColors : style
    }
    /// The part's text colour over the hook / state colour.
    func color(over base: Color) -> Color { color.map { AWCTableColor.color($0, "#000000") } ?? base }
    func weight(over base: Double) -> Double { fontWeight ?? base }
    func size(over base: Double) -> Double { fontSize ?? base }
}

private struct AWCTablePartsKey: EnvironmentKey { static let defaultValue: [AWCTablePart: AWCTablePartStyle] = [:] }
private struct AWCTablePartTargetsKey: EnvironmentKey { static let defaultValue: [String: [AWCTablePart: AWCTablePartStyle]] = [:] }
extension EnvironmentValues {
    var awcTableParts: [AWCTablePart: AWCTablePartStyle] { get { self[AWCTablePartsKey.self] } set { self[AWCTablePartsKey.self] = newValue } }
    var awcTablePartTargets: [String: [AWCTablePart: AWCTablePartStyle]] { get { self[AWCTablePartTargetsKey.self] } set { self[AWCTablePartTargetsKey.self] = newValue } }
}
private struct AWCTablePartModifier: ViewModifier {
    let styles: [AWCTablePart: AWCTablePartStyle], id: String?
    @Environment(\.awcTableParts) private var inherited
    @Environment(\.awcTablePartTargets) private var targets
    func body(content: Content) -> some View {
        if let id {
            var t = targets; var own = t[id] ?? [:]
            for (p, s) in styles { own[p] = (own[p] ?? .init()).merging(s) }
            t[id] = own; return AnyView(content.environment(\.awcTablePartTargets, t))
        }
        var all = inherited; for (p, s) in styles { all[p] = (all[p] ?? .init()).merging(s) }
        return AnyView(content.environment(\.awcTableParts, all))
    }
}
public extension View {
    /// `::part()` styling for the md-table family parts in this view (`for`: only the component with that node id).
    func awcTablePartAppearance(_ part: AWCTablePart, _ style: AWCTablePartStyle, for id: String? = nil) -> some View { modifier(AWCTablePartModifier(styles: [part: style], id: id)) }
    /// Several parts at once.
    func awcTablePartAppearance(_ styles: [AWCTablePart: AWCTablePartStyle], for id: String? = nil) -> some View { modifier(AWCTablePartModifier(styles: styles, id: id)) }
}
extension EnvironmentValues {
    /// A part's effective style for the component with node id `id`.
    func awcTablePart(_ part: AWCTablePart, id: String) -> AWCTablePartStyle {
        let base = awcTableParts[part] ?? .init()
        return awcTablePartTargets[id]?[part].map { base.merging($0) } ?? base
    }
}

/// A part's box declarations: padding (physical), background (clipped to border-radius), opacity. Text colour and font
/// are applied by the renderer where it draws the part's text (AWCTablePartStyle.color(over:) …).
struct AWCTablePartBox: ViewModifier {
    let style: AWCTablePartStyle
    @Environment(\.layoutDirection) private var direction
    @ViewBuilder func body(content: Content) -> some View {
        if style.isEmpty { content }
        else {
            content
                .padding(style.padding?.insets(rtl: direction == .rightToLeft) ?? EdgeInsets())
                .background { if let bg = style.backgroundColor { RoundedRectangle(cornerRadius: style.cornerRadius ?? 0, style: .circular).fill(AWCTableColor.color(bg, "#00000000")) } }
                .opacity(style.opacity ?? 1)
        }
    }
}
extension View {
    func awcTablePartBox(_ style: AWCTablePartStyle) -> some View { modifier(AWCTablePartBox(style: style)) }
}
extension AWCTablePartStyle {
    /// The part's background, clipped to its border-radius.
    @ViewBuilder var backgroundView: some View {
        if let bg = backgroundColor { RoundedRectangle(cornerRadius: cornerRadius ?? 0, style: .circular).fill(AWCTableColor.color(bg, "#00000000")) }
    }
    /// A fill the part's background-color replaces (a scrollbar thumb's colour, a skeleton row's tint).
    func fill(over base: Color) -> Color { backgroundColor.map { AWCTableColor.color($0, "#00000000") } ?? base }
    func edges(_ fallback: EdgeInsets, rtl: Bool) -> EdgeInsets { padding?.insets(rtl: rtl) ?? fallback }
}
