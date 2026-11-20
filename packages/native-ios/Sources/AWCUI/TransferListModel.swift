import SwiftUI

// md-transfer-list: data, logic and CSS metrics shared by the SwiftUI renderer and its parity tests
// (packages/core/src/components/md-transfer-list/md-transfer-list.{tsx,css}).

/// One item (`{value, label, description?, disabled?}`).
public struct AWCTransferItem: Equatable, Sendable {
    public let value: String, label: String, description: String, disabled: Bool
    /// `items` as an array of objects or its JSON string (the source parses the attribute); entries without a string value are skipped.
    static func parse(_ v: AWCValue?) -> [AWCTransferItem] {
        var source = v
        if case .string(let text)? = v, let data = text.data(using: .utf8), let decoded = try? JSONDecoder().decode(AWCValue.self, from: data) { source = decoded }
        guard case .array(let list)? = source else { return [] }
        return list.compactMap { o in
            guard case .object(let m) = o else { return nil }
            let value: String
            switch m["value"] { case .string(let s)?: value = s; case .number(let n)?: value = n == n.rounded() && abs(n) < 1e15 ? String(Int(n)) : String(n); default: return nil }
            return .init(value: value, label: m["label"]?.string ?? value, description: m["description"]?.string ?? "", disabled: m["disabled"]?.bool == true)
        }
    }
}

/// `--md-transfer-list-item-padding`: the CSS padding shorthand's physical sides (px as points).
public struct AWCTransferListInsets: Equatable, Sendable {
    public var top, right, bottom, left: Double
    public init(top: Double, right: Double, bottom: Double, left: Double) { self.top = top; self.right = right; self.bottom = bottom; self.left = left }
    public init(_ all: Double) { self.init(top: all, right: all, bottom: all, left: all) }
    public init(block: Double, inline: Double) { self.init(top: block, right: inline, bottom: block, left: inline) }
    var valid: Bool { [top, right, bottom, left].allSatisfy { $0.isFinite && $0 >= 0 } }
}

/// The twenty `--md-transfer-list-*` hooks. Lengths are px (points), colours `#RRGGBB[AA]`; nil = the source default.
public struct AWCTransferListAppearance: Equatable, Sendable {
    public var width, minWidth, maxWidth, height, minHeight, maxHeight, columnMinWidth, columnMaxBlock, containerShape: Double?
    public var containerColor, headerColor, headerTextColor: String?
    public var itemInset: Double?
    public var itemPadding: AWCTransferListInsets?
    public var itemGap: Double?
    public var dividerColor: String?
    public var controlsGap, emptyIconSize, controlSize, controlIconSize: Double?
    public init(width: Double? = nil, minWidth: Double? = nil, maxWidth: Double? = nil, height: Double? = nil, minHeight: Double? = nil, maxHeight: Double? = nil,
                columnMinWidth: Double? = nil, columnMaxBlock: Double? = nil, containerShape: Double? = nil, containerColor: String? = nil, headerColor: String? = nil,
                headerTextColor: String? = nil, itemInset: Double? = nil, itemPadding: AWCTransferListInsets? = nil, itemGap: Double? = nil,
                dividerColor: String? = nil, controlsGap: Double? = nil, emptyIconSize: Double? = nil, controlSize: Double? = nil, controlIconSize: Double? = nil) {
        func l(_ v: Double?) -> Double? { v.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil } }
        func c(_ v: String?) -> String? { v.flatMap { $0.range(of: "^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$", options: .regularExpression) != nil ? $0.uppercased() : nil } }
        self.width = l(width); self.minWidth = l(minWidth); self.maxWidth = l(maxWidth); self.height = l(height); self.minHeight = l(minHeight); self.maxHeight = l(maxHeight)
        self.columnMinWidth = l(columnMinWidth); self.columnMaxBlock = l(columnMaxBlock); self.containerShape = l(containerShape)
        self.containerColor = c(containerColor); self.headerColor = c(headerColor); self.headerTextColor = c(headerTextColor)
        self.itemInset = l(itemInset); self.itemPadding = itemPadding.flatMap { $0.valid ? $0 : nil }; self.itemGap = l(itemGap)
        self.dividerColor = c(dividerColor); self.controlsGap = l(controlsGap); self.emptyIconSize = l(emptyIconSize); self.controlSize = l(controlSize); self.controlIconSize = l(controlIconSize)
    }
    /// Field-by-field merge: `inner` wins where set.
    public func merging(_ inner: AWCTransferListAppearance) -> AWCTransferListAppearance {
        .init(width: inner.width ?? width, minWidth: inner.minWidth ?? minWidth, maxWidth: inner.maxWidth ?? maxWidth, height: inner.height ?? height, minHeight: inner.minHeight ?? minHeight,
              maxHeight: inner.maxHeight ?? maxHeight, columnMinWidth: inner.columnMinWidth ?? columnMinWidth, columnMaxBlock: inner.columnMaxBlock ?? columnMaxBlock,
              containerShape: inner.containerShape ?? containerShape, containerColor: inner.containerColor ?? containerColor, headerColor: inner.headerColor ?? headerColor,
              headerTextColor: inner.headerTextColor ?? headerTextColor, itemInset: inner.itemInset ?? itemInset, itemPadding: inner.itemPadding ?? itemPadding, itemGap: inner.itemGap ?? itemGap, dividerColor: inner.dividerColor ?? dividerColor,
              controlsGap: inner.controlsGap ?? controlsGap, emptyIconSize: inner.emptyIconSize ?? emptyIconSize, controlSize: inner.controlSize ?? controlSize,
              controlIconSize: inner.controlIconSize ?? controlIconSize)
    }
    /// Laboratory / snippet values keyed by field name.
    public init(values: [String: AWCValue]) {
        func n(_ k: String) -> Double? { values[k]?.number }
        func s(_ k: String) -> String? { values[k]?.string }
        var pad: AWCTransferListInsets? = nil
        if case .object(let p)? = values["itemPadding"], let t = p["top"]?.number, let r = p["right"]?.number, let b = p["bottom"]?.number, let l = p["left"]?.number {
            pad = .init(top: t, right: r, bottom: b, left: l) }
        self.init(width: n("width"), minWidth: n("minWidth"), maxWidth: n("maxWidth"), height: n("height"), minHeight: n("minHeight"), maxHeight: n("maxHeight"),
                  columnMinWidth: n("columnMinWidth"), columnMaxBlock: n("columnMaxBlock"), containerShape: n("containerShape"), containerColor: s("containerColor"),
                  headerColor: s("headerColor"), headerTextColor: s("headerTextColor"), itemInset: n("itemInset"), itemPadding: pad,
                  itemGap: n("itemGap"), dividerColor: s("dividerColor"), controlsGap: n("controlsGap"), emptyIconSize: n("emptyIconSize"), controlSize: n("controlSize"),
                  controlIconSize: n("controlIconSize"))
    }
}

private struct AWCTransferListAppearanceKey: EnvironmentKey { static let defaultValue = AWCTransferListAppearance() }
public extension EnvironmentValues { var awcTransferListAppearance: AWCTransferListAppearance { get { self[AWCTransferListAppearanceKey.self] } set { self[AWCTransferListAppearanceKey.self] = newValue } } }
public extension View {
    /// md-transfer-list hooks for this subtree; nested calls merge field by field (inner wins).
    func awcTransferListAppearance(_ appearance: AWCTransferListAppearance) -> some View {
        transformEnvironment(\.awcTransferListAppearance) { $0 = $0.merging(appearance) }
    }
}

/// One `::part()` rule of md-transfer-list in typed form: what the part's own box paints. Colours `#RRGGBB[AA]`, lengths px.
/// A part value wins over the hooks and every state rule (hover, checked, focus, disabled), as a `::part()` declaration of the
/// outer tree does. A property the part does not paint is ignored (AWCTransferListPartAppearance lists them per part).
public struct AWCTransferListPartStyle: Equatable, Sendable {
    /// `background-color`.
    public let backgroundColor: String?
    /// `color` (count text; empty text and icon; empty-icon glyph).
    public let color: String?
    /// `border-color` (column: its 1px border) / `border-block-end-color` (header: the divider under it).
    public let borderColor: String?
    /// `border-radius` (column, count, item).
    public let shape: Double?
    /// `font-size` (empty-icon: the glyph's size).
    public let size: Double?
    /// `opacity` (empty-icon).
    public let opacity: Double?
    public init(backgroundColor: String? = nil, color: String? = nil, borderColor: String? = nil, shape: Double? = nil, size: Double? = nil, opacity: Double? = nil) {
        func c(_ v: String?) -> String? { v.flatMap { $0.range(of: "^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$", options: .regularExpression) != nil ? $0.uppercased() : nil } }
        func l(_ v: Double?) -> Double? { v.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil } }
        self.backgroundColor = c(backgroundColor); self.color = c(color); self.borderColor = c(borderColor); self.shape = l(shape); self.size = l(size)
        self.opacity = opacity.flatMap { $0.isFinite ? min(1, max(0, $0)) : nil }
    }
    /// Laboratory / snippet values keyed by field name.
    public init(values v: [String: AWCValue]) {
        self.init(backgroundColor: v["backgroundColor"]?.string, color: v["color"]?.string, borderColor: v["borderColor"]?.string,
                  shape: v["shape"]?.number, size: v["size"]?.number, opacity: v["opacity"]?.number)
    }
    /// Field-by-field merge: `inner` wins where set.
    public func merging(_ inner: AWCTransferListPartStyle) -> AWCTransferListPartStyle {
        .init(backgroundColor: inner.backgroundColor ?? backgroundColor, color: inner.color ?? color, borderColor: inner.borderColor ?? borderColor,
              shape: inner.shape ?? shape, size: inner.size ?? size, opacity: inner.opacity ?? opacity)
    }
    /// The colour as premultiplied sRGB + alpha (what a row paints).
    static func premultiplied(_ hex: String) -> [Double] {
        let h = hex.dropFirst(), a = h.count == 8 ? Double(Int(h.suffix(2), radix: 16) ?? 255) / 255 : 1
        return AWCTransferListTrack.srgb(AWCTransferListTrack.oklab(hex, alpha: a))
    }
}

/// Typed counterparts of md-transfer-list's `::part()` names (the source names each column `column` and `column-source` /
/// `column-target`: a side's values merge over `column`'s). What each part paints: column (backgroundColor, borderColor,
/// shape), header (backgroundColor, borderColor: the divider under it), headerTitle (backgroundColor), count (backgroundColor,
/// color, shape), search (backgroundColor: the field's padded box), list (backgroundColor), item (backgroundColor, which replaces
/// the hover / checked / focus layers as `::part(item) { background-color }` does; shape: the row's corners, its focus ring and
/// ripple), empty (backgroundColor, color: text and icon), emptyIcon (color, size, opacity), controls (backgroundColor).
public struct AWCTransferListPartAppearance: Equatable, Sendable {
    public let column, columnSource, columnTarget, header, headerTitle, count, search, list, item, empty, emptyIcon, controls: AWCTransferListPartStyle
    public init(column: AWCTransferListPartStyle = .init(), columnSource: AWCTransferListPartStyle = .init(), columnTarget: AWCTransferListPartStyle = .init(), header: AWCTransferListPartStyle = .init(), headerTitle: AWCTransferListPartStyle = .init(),
                count: AWCTransferListPartStyle = .init(), search: AWCTransferListPartStyle = .init(), list: AWCTransferListPartStyle = .init(),
                item: AWCTransferListPartStyle = .init(), empty: AWCTransferListPartStyle = .init(), emptyIcon: AWCTransferListPartStyle = .init(),
                controls: AWCTransferListPartStyle = .init()) {
        self.column = column; self.columnSource = columnSource; self.columnTarget = columnTarget; self.header = header; self.headerTitle = headerTitle; self.count = count; self.search = search; self.list = list
        self.item = item; self.empty = empty; self.emptyIcon = emptyIcon; self.controls = controls
    }
    /// The column's values on one side: `column-source` / `column-target` over `column`.
    func column(target: Bool) -> AWCTransferListPartStyle { column.merging(target ? columnTarget : columnSource) }
    /// Laboratory / snippet values keyed by the CSS part name: `{ "column": { "backgroundColor": "#FFF8E1" }, "empty-icon": { "size": 48 } }`.
    public init(values v: [String: AWCValue]) {
        func p(_ k: String) -> AWCTransferListPartStyle { AWCTransferListPartStyle(values: v[k]?.object ?? [:]) }
        self.init(column: p("column"), columnSource: p("column-source"), columnTarget: p("column-target"), header: p("header"), headerTitle: p("header-title"), count: p("count"), search: p("search"), list: p("list"),
                  item: p("item"), empty: p("empty"), emptyIcon: p("empty-icon"), controls: p("controls"))
    }
    /// Part by part, field by field: `inner` wins where set.
    public func merging(_ inner: AWCTransferListPartAppearance) -> AWCTransferListPartAppearance {
        .init(column: column.merging(inner.column), columnSource: columnSource.merging(inner.columnSource), columnTarget: columnTarget.merging(inner.columnTarget),
              header: header.merging(inner.header), headerTitle: headerTitle.merging(inner.headerTitle),
              count: count.merging(inner.count), search: search.merging(inner.search), list: list.merging(inner.list), item: item.merging(inner.item),
              empty: empty.merging(inner.empty), emptyIcon: emptyIcon.merging(inner.emptyIcon), controls: controls.merging(inner.controls))
    }
}
private struct AWCTransferListPartAppearanceKey: EnvironmentKey { static let defaultValue = AWCTransferListPartAppearance() }
public extension EnvironmentValues { var awcTransferListPartAppearance: AWCTransferListPartAppearance { get { self[AWCTransferListPartAppearanceKey.self] } set { self[AWCTransferListPartAppearanceKey.self] = newValue } } }
public extension View {
    /// md-transfer-list `::part()` values for this subtree; nested calls merge part by part, field by field (inner wins).
    func awcTransferListPartAppearance(_ parts: AWCTransferListPartAppearance) -> some View {
        transformEnvironment(\.awcTransferListPartAppearance) { $0 = $0.merging(parts) }
    }
}

/// The CSS metrics at a density rung (tokens.css spacing rungs + the component's own tapers) with the hooks applied.
struct AWCTransferListMetrics: Equatable {
    let s: Double
    let insetXs = 4.0, insetSm, insetMd, insetLg, gapSm, gapMd, gapLg: Double
    let titleSize, titleLine, countSize, countLine, labelSize, descSize, emptySize, emptyPad, emptyIcon: Double
    let itemPad: AWCTransferListInsets
    let columnMinWidth: Double, columnMaxBlock: Double?, shape, itemInset, itemGap, controlsGap, controlSize, controlIconSize: Double
    let searchTop: Double
    init(density: Double, appearance a: AWCTransferListAppearance, fullHeight: Bool = false) {
        let s = max(-4, min(0, density.rounded())); self.s = s
        insetSm = s <= -3 ? 4 : 8; insetMd = s <= -2 ? 8 : 12; insetLg = s <= -4 ? 8 : s <= -2 ? 12 : 16
        gapSm = s <= -3 ? 4 : 8; gapMd = s <= -4 ? 4 : s <= -2 ? 8 : 12; gapLg = s <= -4 ? 8 : s <= -2 ? 12 : 16
        titleSize = max(12, 14 + 0.5 * s); titleLine = max(16, 20 + s); countSize = max(10, 11 + 0.5 * s); countLine = max(14, 16 + 0.5 * s)
        labelSize = max(12, 14 + 0.5 * s); descSize = max(10, 12 + 0.5 * s); emptySize = max(12, 14 + 0.5 * s)
        emptyPad = max(4, 32 + 2 * s); emptyIcon = a.emptyIconSize ?? max(24, 32 + 2 * s)
        columnMinWidth = a.columnMinWidth ?? 260; columnMaxBlock = a.columnMaxBlock ?? (fullHeight ? nil : a.height ?? 360)   // nil: `100%` of the grid row (full-height)
        shape = a.containerShape ?? 16; itemInset = a.itemInset ?? 6
        itemPad = a.itemPadding ?? AWCTransferListInsets(block: insetSm, inline: insetLg - itemInset)
        itemGap = a.itemGap ?? gapMd; controlsGap = a.controlsGap ?? gapMd
        controlSize = a.controlSize ?? max(24, 40 + 4 * s); controlIconSize = a.controlIconSize ?? max(16, 24 + 2 * s)
        searchTop = 8 + max(4, 8 + s)
    }
}

/// The source's selection and move rules (checks per side, Set insertion order).
struct AWCTransferListLogic {
    var items: [AWCTransferItem]
    var value: [String]
    var sourceChecked: [String] = [], targetChecked: [String] = []
    var sourceQuery = "", targetQuery = ""
    var sourceItems: [AWCTransferItem] { let v = Set(value); return items.filter { !v.contains($0.value) } }
    var targetItems: [AWCTransferItem] { let v = Set(value); return items.filter { v.contains($0.value) } }
    func visible(_ target: Bool) -> [AWCTransferItem] {
        let q = (target ? targetQuery : sourceQuery).trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let list = target ? targetItems : sourceItems
        return q.isEmpty ? list : list.filter { $0.label.lowercased().contains(q) || $0.description.lowercased().contains(q) }
    }
    func checked(_ target: Bool) -> [String] { target ? targetChecked : sourceChecked }
    /// Visible, enabled, checked items of a side, in check order.
    func eligibleChecked(_ target: Bool) -> [String] {
        let ok = Set(visible(target).filter { !$0.disabled }.map(\.value)); return checked(target).filter { ok.contains($0) }
    }
    mutating func toggle(_ target: Bool, _ v: String) {
        var c = checked(target); if let i = c.firstIndex(of: v) { c.remove(at: i) } else { c.append(v) }
        if target { targetChecked = c } else { sourceChecked = c }
    }
    func selectAllState(_ target: Bool) -> (checked: Int, total: Int, all: Bool, some: Bool) {
        let eligible = visible(target).filter { !$0.disabled }; let c = Set(checked(target))
        let n = eligible.filter { c.contains($0.value) }.count, all = !eligible.isEmpty && n == eligible.count
        return (n, eligible.count, all, n > 0 && !all)
    }
    mutating func toggleSelectAll(_ target: Bool) {
        let eligible = visible(target).filter { !$0.disabled }.map(\.value); var c = checked(target)
        if selectAllState(target).all { c.removeAll { eligible.contains($0) } } else { for v in eligible where !c.contains(v) { c.append(v) } }
        if target { targetChecked = c } else { sourceChecked = c }
    }
    /// A move: nil when nothing is eligible (no events). Returns (direction, moved, new value).
    mutating func move(right: Bool, all: Bool) -> (String, [String], [String])? {
        let side = !right
        let moved = all ? (side ? targetItems : sourceItems).filter { !$0.disabled }.map(\.value) : eligibleChecked(side)
        guard !moved.isEmpty else { return nil }
        if right { value += moved.filter { !value.contains($0) } } else { let m = Set(moved); value.removeAll { m.contains($0) } }
        if side { targetChecked = [] } else { sourceChecked = [] }
        return (right ? "right" : "left", moved, value)
    }
    /// Checks are dropped when an item leaves its side or the pool by a controlled change (TL4).
    mutating func prune() {
        let s = Set(sourceItems.map(\.value)), t = Set(targetItems.map(\.value))
        sourceChecked.removeAll { !s.contains($0) }; targetChecked.removeAll { !t.contains($0) }
    }
}
