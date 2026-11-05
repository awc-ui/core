import SwiftUI
import Observation
import QuartzCore

// MARK: Colours

/// sRGB colours from CSS values used by the table family (`#rgb[a]`, `#rrggbb[aa]`, `rgb()/rgba()`), and
/// `color-mix(in srgb, A p%, B)` with premultiplied interpolation (B may be transparent).
enum AWCTableColor {
    typealias RGBA = (r: Double, g: Double, b: Double, a: Double)
    static func parse(_ raw: String?) -> RGBA? {
        guard let s = raw?.trimmingCharacters(in: .whitespaces).lowercased(), !s.isEmpty else { return nil }
        if s == "transparent" { return (0, 0, 0, 0) }
        if s.hasPrefix("#") {
            var h = String(s.dropFirst())
            if h.count == 3 || h.count == 4 { h = h.map { "\($0)\($0)" }.joined() }
            guard h.count == 6 || h.count == 8, let v = UInt64(h, radix: 16) else { return nil }
            let n = h.count == 6 ? (v << 8) | 0xFF : v
            return (Double((n >> 24) & 0xFF) / 255, Double((n >> 16) & 0xFF) / 255, Double((n >> 8) & 0xFF) / 255, Double(n & 0xFF) / 255)
        }
        if s.hasPrefix("rgb"), let open = s.firstIndex(of: "("), s.hasSuffix(")") {
            let parts = s[s.index(after: open)..<s.index(before: s.endIndex)].replacingOccurrences(of: "/", with: ",")
                .split(whereSeparator: { $0 == "," || $0 == " " }).map(String.init).filter { !$0.isEmpty }
            guard parts.count >= 3 else { return nil }
            func channel(_ t: String) -> Double? { t.hasSuffix("%") ? Double(t.dropLast()).map { $0 / 100 } : Double(t).map { $0 / 255 } }
            func alpha(_ t: String) -> Double? { t.hasSuffix("%") ? Double(t.dropLast()).map { $0 / 100 } : Double(t) }
            guard let r = channel(parts[0]), let g = channel(parts[1]), let b = channel(parts[2]) else { return nil }
            return (r, g, b, parts.count > 3 ? (alpha(parts[3]) ?? 1) : 1)
        }
        return nil
    }
    static func color(_ c: RGBA) -> Color { Color(.sRGB, red: c.r, green: c.g, blue: c.b, opacity: c.a) }
    static func color(_ raw: String?, _ fallback: String) -> Color { color(parse(raw) ?? parse(fallback) ?? (0, 0, 0, 1)) }
    /// `color-mix(in srgb, a p, b)`; `b == nil` is `transparent`.
    static func mix(_ a: String, _ p: Double, _ b: String?) -> RGBA {
        let x = parse(a) ?? (0, 0, 0, 1), y = b.flatMap(parse) ?? (0, 0, 0, 0)
        let p = Swift.min(1, Swift.max(0, p)), q = 1 - p
        let alpha = x.a * p + y.a * q
        guard alpha > 0 else { return (0, 0, 0, 0) }
        return ((x.r * x.a * p + y.r * y.a * q) / alpha, (x.g * x.a * p + y.g * y.a * q) / alpha, (x.b * x.a * p + y.b * y.a * q) / alpha, alpha)
    }
    static func hex(_ c: RGBA) -> String {
        String(format: "#%02X%02X%02X%02X", Int((c.r * 255).rounded()), Int((c.g * 255).rounded()), Int((c.b * 255).rounded()), Int((c.a * 255).rounded()))
    }
}

/// Theme colour roles read by the table family (token → light fallback).
struct AWCTablePalette {
    let tokens: [String: String]
    /// `forced-colors: active` (Mac Chrome's forced palette): Canvas black, CanvasText white, Highlight rgba(0,230,255,.8),
    /// HighlightText black. Author colours give way to these system colours, as in the source's forced-colors cascade.
    var forced = false
    static let forcedRoles: [String: String] = [
        "on-surface": "#FFFFFF", "on-surface-variant": "#FFFFFF", "on-secondary-container": "#FFFFFF", "on-primary-container": "#FFFFFF",
        "on-tertiary-container": "#FFFFFF", "outline": "#FFFFFF", "outline-variant": "#FFFFFF", "surface": "#000000", "surface-container": "#000000",
        "surface-container-low": "#000000", "surface-container-high": "#000000", "surface-container-highest": "#000000",
        "secondary-container": "#000000", "primary-container": "#000000", "tertiary-container": "#000000",
        "primary": "#00E6FFCC", "on-primary": "#000000", "secondary": "#FFFFFF"]
    func hex(_ role: String) -> String {
        if forced, let v = Self.forcedRoles[role] { return v }
        let fallbacks = ["on-surface": "#1C1B1F", "on-surface-variant": "#49454F", "surface": "#FEF7FF", "surface-container": "#F3EDF7",
                         "surface-container-low": "#F7F2FA", "surface-container-high": "#ECE6F0", "surface-container-highest": "#E6E0E9",
                         "outline": "#79747E", "outline-variant": "#CAC4D0", "primary": "#6750A4", "on-primary": "#FFFFFF", "primary-container": "#EADDFF",
                         "on-primary-container": "#21005D", "secondary": "#625B71", "secondary-container": "#E8DEF8", "on-secondary-container": "#1E192B",
                         "tertiary-container": "#FFD8E4", "on-tertiary-container": "#31111D"]
        return tokens["--md-sys-color-" + role] ?? fallbacks[role] ?? "#000000"
    }
    func color(_ role: String) -> Color { AWCTableColor.color(hex(role), "#000000") }
}

// MARK: Row model

enum AWCTableRowGroup: String { case head, body, foot }
struct AWCTableRowEntry: Identifiable, Equatable {
    var node: AWCNode
    var group: AWCTableRowGroup
    /// Index among the table's body rows (head / foot rows: within their group) — the default identity (T1).
    var groupIndex: Int
    var id: String { node.id }
    var cells: [AWCNode] { node.children.filter { $0.tag == "md-table-cell" && ($0.slot ?? "").isEmpty } }
    var expandedContent: [AWCNode] { node.children.filter { $0.slot == "expanded" } }
    func bool(_ key: String, _ fallback: Bool = false) -> Bool { node.properties[key]?.bool ?? fallback }
    var value: String { node.properties["value"]?.string ?? "" }
    var identity: String { value.isEmpty ? String(groupIndex) : value }
}

extension AWCNode {
    /// md-table rows in document order: head rows, body rows (rows directly in md-table count as body), foot rows.
    var awcTableRows: [AWCTableRowEntry] {
        var out: [AWCTableRowEntry] = []
        var counters: [AWCTableRowGroup: Int] = [:]
        func add(_ row: AWCNode, _ g: AWCTableRowGroup) { out.append(.init(node: row, group: g, groupIndex: counters[g, default: 0])); counters[g, default: 0] += 1 }
        for child in children where (child.slot ?? "").isEmpty || child.slot == "head" {
            switch child.tag {
            case "md-table-head": child.children.filter { $0.tag == "md-table-row" }.forEach { add($0, .head) }
            case "md-table-body": child.children.filter { $0.tag == "md-table-row" }.forEach { add($0, .body) }
            case "md-table-foot": child.children.filter { $0.tag == "md-table-row" }.forEach { add($0, .foot) }
            case "md-table-row": add(child, .body)
            default: break
            }
        }
        return out
    }
}

// MARK: Runtime state

/// Interaction state one md-table owns natively (the source keeps it on reflected row / label properties).
/// Host property changes replace the matching local override.
@Observable final class AWCTableRuntime {
    var selected: [String: Bool] = [:]
    var expanded: [String: Bool] = [:]
    var sortBy: String? = nil
    var sortOrder: String? = nil
    var hoverRow: String? = nil
    /// Last pointer location over the grid: Chrome re-hit-tests hover after layout (a page change under a resting pointer
    /// hovers the row now under it), so the hovered row is derived from this point and the current geometry.
    @ObservationIgnored var hoverPoint: CGPoint? = nil
    /// Column pins / hidden columns once pinColumn or setColumnVisibility established the pin base.
    var pinLayout: AWCTablePinLayout? = nil
    var scrollX = 0.0
    var scrollY = 0.0
    var viewport: CGSize = .zero
    var focusedRow: String? = nil
    var announcement = ""
    @ObservationIgnored var authoredSelected: [String: Bool] = [:]
    @ObservationIgnored var authoredExpanded: [String: Bool] = [:]
    @ObservationIgnored var rowFrames: [(id: String, minY: Double, maxY: Double)] = []
    @ObservationIgnored var lastSelection: AWCTableSelectionState? = nil
    /// FLIP bracket: the next row-order change before this time glides (sort / pagination / animateNextChange).
    @ObservationIgnored var armedUntil = 0.0
    @ObservationIgnored var lastOrder: [String] = []
    /// captureFlip plays keyed by row id: movers glide from their old box (fast spatial spring), entrants fade and drop in
    /// from -8 px; 18 ms stagger per element (capped at 6). A new token restarts a row's keyframes.
    struct Flip: Equatable { var token: Int; var dy: Double; var delay: Double; var enter: Bool }
    var flips: [String: Flip] = [:]
    @ObservationIgnored var flipToken = 0
    /// Last laid-out height of each row (old and new boxes of an order change).
    @ObservationIgnored var rowPitch: [String: Double] = [:]
    @ObservationIgnored var lastExpandIDs: [String] = []
    /// Direction of the latest expansion change (open: 500 ms spatial spring; close: 200 ms exit curve).
    @ObservationIgnored var expandOpening = true
    /** The selection count the container's auto-bound toolbar shows: it follows mdSelectionChange events (a re-render
     *  that drops selected rows emits nothing, so the toolbar keeps the last announced count). */
    var announcedCount: Int? = nil
    @ObservationIgnored var lastFractions: [Double] = []
    func isSelected(_ row: AWCTableRowEntry) -> Bool { selected[row.id] ?? row.bool("selected") }
    func isExpanded(_ row: AWCTableRowEntry) -> Bool { expanded[row.id] ?? row.bool("expanded") }
    struct AuthoredChange { let row: AWCTableRowEntry; let selected: Bool?; let expanded: Bool? }
    /// Host property changes win over local state (AWCNativeView semantics). A change of a row already seen whose
    /// effective value differs is returned: the source's row watchers emit for property sets too.
    @discardableResult func absorb(_ rows: [AWCTableRowEntry]) -> [AuthoredChange] {
        var out: [AuthoredChange] = []
        for row in rows {
            let s = row.bool("selected"), e = row.bool("expanded")
            var cs: Bool? = nil, ce: Bool? = nil
            if let old = authoredSelected[row.id] {
                if old != s { let before = selected[row.id] ?? old; authoredSelected[row.id] = s; selected[row.id] = nil; if before != s { cs = s } }
            } else { authoredSelected[row.id] = s }
            if let old = authoredExpanded[row.id] {
                if old != e { let before = expanded[row.id] ?? old; authoredExpanded[row.id] = e; expanded[row.id] = nil; if before != e { ce = e } }
            } else { authoredExpanded[row.id] = e }
            if cs != nil || ce != nil { out.append(.init(row: row, selected: cs, expanded: ce)) }
        }
        return out
    }
}

/// Everything a row / cell needs from its md-table.
struct AWCTableEnvironment {
    var metrics: AWCTableMetrics
    var hooks: AWCTableHooks
    var palette: AWCTablePalette
    var surface: String            // --md-table-surface (container variant) for pinned cells
    var striped: Bool, noDividers: Bool, hoverable: Bool, reducedMotion: Bool, rtl: Bool, forcedColors: Bool
    var vibrant = false
    var selection: String
    var pinIcon: String
    var sortBy: String, sortOrder: String
    var requestSort: (String, String) -> Void = { _, _ in }
    var toggleRow: (String) -> Void = { _ in }
    var rowClick: (String) -> Void = { _ in }
    var motion: AWCTableMotionRecorder? = nil
    /// Accessibility: the table's id and how its structure is exposed (table / treegrid / none for a wrapper around a lone part).
    var tableID = ""
    var axMode = AWCTableAXMode.table
    /// The family's `--md-table-*` custom properties at the table (inherited + the table's own declarations).
    var vars = AWCTableVars()
    var dividerHex: String {
        if forcedColors { return palette.hex("on-surface") }
        if noDividers { return "#00000000" }
        return hooks.dividerColor ?? palette.hex("outline-variant")
    }
    var headBackground: String { hooks.headBackground ?? palette.hex("surface-container") }
    var headColor: String { hooks.headColor ?? palette.hex("on-surface-variant") }
    var footBackground: String { hooks.footBackground ?? palette.hex("surface-container-low") }
    var stripeColor: AWCTableColor.RGBA { forcedColors ? (0, 0, 0, 0.04) : AWCTableColor.parse(hooks.stripeColor) ?? AWCTableColor.mix(palette.hex("on-surface"), 0.04, nil) }
    /// Forced colours turn the hover layer's background into Canvas (invisible on Canvas).
    var hoverColor: String { forcedColors ? "#000000" : hooks.rowHoverColor ?? palette.hex("on-surface") }
    var selectedBackground: String { hooks.rowSelectedBackground ?? palette.hex("secondary-container") }
    var selectedColor: String { hooks.rowSelectedColor ?? palette.hex("on-secondary-container") }
}
/// Focus handles of clickable rows (a pointer click focuses the row like Chrome's mousedown on tabindex 0).
final class AWCTableRowFocusRegistry { var handles: [String: AWCButtonFocusHandle] = [:] }
private struct AWCTableRowFocusKey: EnvironmentKey { static let defaultValue: AWCTableRowFocusRegistry? = nil }
extension EnvironmentValues {
    var awcTableRowFocus: AWCTableRowFocusRegistry? { get { self[AWCTableRowFocusKey.self] } set { self[AWCTableRowFocusKey.self] = newValue } }
}
private struct AWCTableEnvironmentKey: EnvironmentKey { static let defaultValue: AWCTableEnvironment? = nil }
extension EnvironmentValues {
    var awcTableEnvironment: AWCTableEnvironment? { get { self[AWCTableEnvironmentKey.self] } set { self[AWCTableEnvironmentKey.self] = newValue } }
}

/// The container's `--md-table-surface` and table-wide overrides (vibrant variant), plus its scroll offsets.
struct AWCTableContainerContext: Equatable {
    var surface: String? = nil
    /// `max-height` forwarded to a frozen table's body.
    var bodyMaxHeight: Double? = nil
    var vibrant = false
    var hasBottomBar = false
    var inContainer = false
}
private struct AWCTableContainerKey: EnvironmentKey { static let defaultValue = AWCTableContainerContext() }
extension EnvironmentValues {
    var awcTableContainer: AWCTableContainerContext { get { self[AWCTableContainerKey.self] } set { self[AWCTableContainerKey.self] = newValue } }
}

