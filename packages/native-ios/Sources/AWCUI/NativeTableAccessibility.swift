import SwiftUI

// md-table family accessibility. The source's ARIA: md-table role="table" (role="treegrid" once any row is expandable),
// named by `label` / the caption; md-table-row role="row" (aria-selected / aria-expanded stamped by the table: selected
// only with a selection mode, expanded only under a treegrid); md-table-cell cell / gridcell (treegrid) / columnheader /
// rowheader, named from content; aria-rowcount / aria-rowindex for paged data; md-table-toolbar role="toolbar";
// md-table-pagination role="navigation". Sub-tags shown alone have no table around them on the Web: the native wrapper
// table is presentational.

enum AWCTableAXMode: Equatable { case table, treegrid, presentational }

enum AWCTableAX {
    /// Marks the table / body / row the dispatch wraps around a sub-tag shown alone (no table semantics, as on the Web).
    static let presentationalKey = "awcTablePresentational"

    /// The sort label's accessible name: its text, then the polite status text Chrome includes ("sorted ascending").
    static func sortLabelName(_ node: AWCNode, env: AWCTableEnvironment?) -> String {
        let text = awcCollapsedInlineText(node.authoredTextContent)
        let column = node.properties["column"]?.string ?? ""
        let active = env.map { !column.isEmpty && column == $0.sortBy } ?? (node.properties["active"]?.bool ?? false)
        guard active else { return text }
        let own = node.properties["order"]?.string ?? ""
        let order = env?.sortOrder ?? (["asc", "desc"].contains(own) ? own : "asc")
        let status = order == "desc" ? (node.properties["sortedDescendingLabel"]?.string ?? "sorted descending")
            : (node.properties["sortedAscendingLabel"]?.string ?? "sorted ascending")
        return text.isEmpty ? status : text + " " + status
    }

    /// Name from content (Chrome's computation for a cell or a row): text runs, a sort label's name with its sort state,
    /// controls by their aria-label; icon ligatures are decorative.
    static func name(_ node: AWCNode, env: AWCTableEnvironment?) -> String {
        func walk(_ n: AWCNode) -> [String] {
            switch n.tag {
            case "#text", "#slot-text": return [n.properties["text"]?.string ?? ""]
            case "#symbol", "md-icon": return []
            case "md-table-sort-label": return [sortLabelName(n, env: env)]
            default:
                if let label = n.properties["ariaLabel"]?.string, !label.isEmpty { return [label] }
                if n.properties["class"]?.string.contains("material-symbols") == true { return [] }
                if n.children.isEmpty, n.tag.hasPrefix("#") == false, n.properties["text"] == nil { return [] }
                return n.children.filter { ($0.slot ?? "").isEmpty }.flatMap(walk)
            }
        }
        return awcCollapsedInlineText(walk(node).joined(separator: " "))
    }

    /// A row's name: from its cells under a treegrid (Chrome names treegrid rows from content), none in a table.
    static func rowName(_ row: AWCTableRowEntry, env: AWCTableEnvironment?, mode: AWCTableAXMode) -> String {
        mode == .treegrid ? awcCollapsedInlineText(row.cells.map { name($0, env: env) }.filter { !$0.isEmpty }.joined(separator: " ")) : ""
    }
    /// The label a row's own focus surface carries on iOS / Android (no row element there): its cells' text.
    static func rowStopLabel(_ row: AWCTableRowEntry, env: AWCTableEnvironment?) -> String {
        awcCollapsedInlineText(row.cells.map { name($0, env: env) }.filter { !$0.isEmpty }.joined(separator: " "))
    }

    /// A polite announcement (the source's aria-live="polite" status text).
    static func announce(_ text: String) {
        guard !text.isEmpty else { return }
        #if os(iOS)
        // UIKit's announcement with an NSAttributedString: the Swift AttributedString bridge resolves its attribute scopes through
        // the runtime's protocol-conformance scan on first use (25 ms on the simulator), inside the update of the sort click,
        // before the reordered rows' first frame (S7-15-01).
        UIAccessibility.post(notification: .announcement, argument: NSAttributedString(string: text, attributes: [.accessibilitySpeechAnnouncementPriority: UIAccessibilityPriority.low]))
        #else
        if #available(macOS 14.0, *) {
            var message = AttributedString(text); message.accessibilitySpeechAnnouncementPriority = .low
            AccessibilityNotification.Announcement(message).post()
        }
        #endif
    }
}

extension AWCNode {
    var awcTablePresentational: Bool { properties[AWCTableAX.presentationalKey]?.bool == true }
}

/// The element a family part is on each platform. macOS: an AppKit element over the SwiftUI layout (whose own elements are
/// hidden), so the table is AXTable → AXRow → AXCell with the controls inside each cell, the toolbar AXToolbar, the
/// pagination a navigation landmark. iOS: the table a UIKit data table over the hidden SwiftUI layout; toolbar and pagination
/// labelled SwiftUI containers (UIKit has no toolbar / landmark element).
struct AWCTableAXRoot: ViewModifier {
    enum Kind { case table, group, toolbar, landmark }
    let kind: Kind, label: String, identifier: String
    var hint = ""
    var ariaRowCount: Int? = nil
    var columnCount = 0
    /// macOS: hide only the parts the element re-exposes (a pagination keeps its md-select in SwiftUI's tree).
    var hideContent = true
    @ViewBuilder func body(content: Content) -> some View {
        #if canImport(AppKit)
        let k: AWCTableAXView.Kind = kind == .table ? .table : kind == .group ? .group : kind == .toolbar ? .toolbar : .landmark
        (hideContent ? AnyView(content.accessibilityHidden(true)) : AnyView(content))
            .background {
                AWCTableAXMarker(info: .init(kind: k, label: label, identifier: identifier, help: hint, ariaRowCount: ariaRowCount, columnCount: columnCount))
                    .allowsHitTesting(false)
            }
        #else
        if kind == .table {
            // A UIKit data table over the hidden SwiftUI layout (see AWCTableAXView).
            content.accessibilityHidden(true).background {
                AWCTableAXMarker(info: .init(kind: .table, label: label, identifier: identifier, help: hint, ariaRowCount: ariaRowCount, columnCount: columnCount))
                    .allowsHitTesting(false)
            }
        }
        else if kind == .group { content.accessibilityElement(children: .contain) }
        else { content.accessibilityElement(children: .contain).accessibilityLabel(label).accessibilityHint(hint) }
        #endif
    }
}

/// A static text (or heading) the family element (macOS; iOS inside a table) lists in place of the hidden SwiftUI text.
struct AWCTableAXText: ViewModifier {
    let text: String
    var heading = false
    @ViewBuilder func body(content: Content) -> some View {
        #if canImport(AppKit)
        // The marker is listed by its family element only (hidden from SwiftUI's tree, which may still show the content around it).
        content.accessibilityHidden(true).background { AWCTableAXMarker(info: .init(kind: heading ? .heading : .text, label: text)).allowsHitTesting(false).accessibilityHidden(true) }
        #else
        // iOS: SwiftUI reads the text; inside a table (hidden SwiftUI content) the data table lists the marker instead.
        content.background { AWCTableAXMarker(info: .init(kind: heading ? .heading : .text, label: text)).allowsHitTesting(false).accessibilityHidden(true) }
        #endif
    }
}

#if canImport(AppKit)
import AppKit

/// One md-table family element on macOS, laid over the SwiftUI part it stands for (its frame is that part's frame).
final class AWCTableAXView: NSView {
    enum Kind { case table, group, toolbar, landmark, row, cell, text, heading }
    struct Info: Equatable {
        var kind: Kind
        var label = ""
        var identifier = ""
        var help = ""
        /// row: the md-table-row id (its focus surface stands for the row when the row is a tab stop).
        var rowID = ""
        var selected: Bool? = nil
        var expanded: Bool? = nil
        var header = false
        var rowIndex = -1
        var columnIndex = -1
        var columnSpan = 1
        /// aria-rowspan: the source reflects `rowspan` to semantics only (no visual span; decision log).
        var rowSpan = 1
        var ariaRowCount: Int? = nil
        var ariaRowIndex: Int? = nil
        var columnCount = 0
        /// row: the table's id; cell: its row's id (structure by identity, so rows scrolled out of view stay in place).
        var ownerID = ""
        /// row: the focus surfaces (ids) that are this row's cells, whatever their frames (md-date-picker: a clipped week's days).
        var memberIDs: [String] = []
    }
    var info = Info(kind: .text)
    weak var axContainer: NSView?
    /// Containers list the elements whose centre lies inside them, innermost container first (rank: table / toolbar /
    /// landmark / group < row < cell < leaf).
    var rank: Int { switch info.kind { case .table, .group, .toolbar, .landmark: return 0; case .row: return 1; case .cell: return 2; case .text, .heading: return 3 } }
    override func hitTest(_ point: NSPoint) -> NSView? { nil }
    override func isAccessibilityElement() -> Bool { true }
    override func accessibilityIdentifier() -> String { info.identifier }
    override func accessibilityRole() -> NSAccessibility.Role? {
        switch info.kind {
        case .table: return .table
        case .group, .landmark: return .group
        case .toolbar: return .toolbar
        case .row: return .row
        case .cell: return .cell
        case .text: return .staticText
        case .heading: return NSAccessibility.Role(rawValue: "AXHeading")
        }
    }
    override func accessibilitySubrole() -> NSAccessibility.Subrole? { info.kind == .landmark ? NSAccessibility.Subrole(rawValue: "AXLandmarkNavigation") : nil }
    override func accessibilityLabel() -> String? { info.kind == .text ? nil : info.label }
    override func accessibilityTitle() -> String? { info.kind == .heading ? info.label : nil }
    override func accessibilityValue() -> Any? { info.kind == .text ? info.label : nil }
    override func accessibilityHelp() -> String? { info.help.isEmpty ? nil : info.help }
    override func accessibilityParent() -> Any? { axContainer ?? super.accessibilityParent() }
    override func accessibilityChildren() -> [Any]? { rank < 3 ? AWCTableAXTree.children(of: self) : [] }
    override func isAccessibilitySelected() -> Bool { info.selected == true }
    override func isAccessibilityExpanded() -> Bool { info.expanded == true }
    override func accessibilityIndex() -> Int { info.kind == .row ? Swift.max(0, info.rowIndex) : super.accessibilityIndex() }
    override func accessibilityRowIndexRange() -> NSRange { info.kind == .cell && info.rowIndex >= 0 ? NSRange(location: info.rowIndex, length: info.rowSpan) : NSRange(location: NSNotFound, length: 0) }
    override func accessibilityColumnIndexRange() -> NSRange { info.kind == .cell && info.columnIndex >= 0 ? NSRange(location: info.columnIndex, length: info.columnSpan) : NSRange(location: NSNotFound, length: 0) }
    override func accessibilityRows() -> [Any]? { info.kind == .table ? AWCTableAXTree.children(of: self).filter(AWCTableAXTree.isRow) : nil }
    override func accessibilityRowCount() -> Int { info.kind == .table ? (accessibilityRows()?.count ?? 0) : 0 }
    override func accessibilityColumnCount() -> Int { info.kind == .table ? info.columnCount : 0 }
    override func accessibilityColumnHeaderUIElements() -> [Any]? { info.kind == .table ? AWCTableAXTree.headerCells(of: self) : nil }
    override func accessibilityAttributeValue(_ attribute: NSAccessibility.Attribute) -> Any? {
        switch attribute.rawValue {
        case "AXARIARowCount" where info.kind == .table: return info.ariaRowCount.map { NSNumber(value: $0) }
        case "AXARIARowIndex" where info.kind == .row: return info.ariaRowIndex.map { NSNumber(value: $0) }
        default: return super.accessibilityAttributeValue(attribute)
        }
    }
}

struct AWCTableAXMarker: NSViewRepresentable {
    let info: AWCTableAXView.Info
    func makeNSView(context: Context) -> AWCTableAXView { AWCTableAXView() }
    func updateNSView(_ view: AWCTableAXView, context: Context) {
        if view.info != info { view.info = info }
        // A table encodes its tab-stop rows on their focus surfaces as soon as it updates (keyboard focus may be read first).
        if info.kind == .table { DispatchQueue.main.async { [weak view] in if let view, view.window != nil { _ = AWCTableAXTree.children(of: view) } } }
    }
}

/// Assembles the family's AppKit elements from the marker views and the focus surfaces in the window.
enum AWCTableAXTree {
    static func views(_ v: NSView) -> [NSView] { [v] + v.subviews.flatMap(views) }
    static func box(_ v: NSView) -> NSRect { v.convert(v.bounds, to: nil) }
    static func isRow(_ o: Any) -> Bool {
        if let v = o as? AWCTableAXView { return v.info.kind == .row }
        if let f = o as? AWCNativeButtonFocusView { return f.awcAccessibilityOverride?.role == .row }
        return false
    }
    struct Candidate { let view: NSView; let rank: Int; let frame: NSRect }
    /// The elements whose innermost family container is `parent`, in reading order. A row whose focus surface is a tab stop
    /// is that surface (encoded as the AXRow); controls inside cells are their focus surfaces; text fields keep their own.
    static func children(of parent: AWCTableAXView) -> [Any] {
        guard let window = parent.window, let content = window.contentView else { return [] }
        let all = views(content).filter { !$0.isHiddenOrHasHiddenAncestor }
        let family = all.compactMap { $0 as? AWCTableAXView }
        let containers = family.filter { $0.rank < 3 }
        let rowMarkers = Dictionary(family.filter { $0.info.kind == .row && !$0.info.rowID.isEmpty }.map { ($0.info.rowID, $0) }, uniquingKeysWith: { a, _ in a })
        var candidates: [Candidate] = []
        var rowSurface: [ObjectIdentifier: AWCNativeButtonFocusView] = [:]
        for v in all {
            if let f = v as? AWCTableAXView { candidates.append(.init(view: f, rank: f.rank, frame: box(f))); continue }
            if let f = v as? AWCNativeButtonFocusView {
                guard f.configuration?.inert == false else { continue }
                if let id = f.configuration?.id, let marker = rowMarkers[id] { rowSurface[ObjectIdentifier(marker)] = f; continue }
                candidates.append(.init(view: f, rank: 3, frame: box(f))); continue
            }
            // A text field's element is its cell (AppKit ignores the control); the field editor inside a field is that field.
            if let field = v as? NSTextField { if field.isAccessibilityElement() || field.cell?.isAccessibilityElement() == true { candidates.append(.init(view: v, rank: 3, frame: box(v))) } }
            else if let text = v as? NSTextView, !text.isFieldEditor, text.isAccessibilityElement() { candidates.append(.init(view: v, rank: 3, frame: box(v))) }
        }
        let byID = Dictionary(containers.filter { !$0.info.identifier.isEmpty }.map { ($0.info.identifier, $0) }, uniquingKeysWith: { a, _ in a })
        let memberOwner = Dictionary(containers.flatMap { row in row.info.memberIDs.map { ($0, row) } }, uniquingKeysWith: { a, _ in a })
        func container(of c: Candidate) -> AWCTableAXView? {
            if let f = c.view as? AWCNativeButtonFocusView, let id = f.configuration?.id, let owner = memberOwner[id] { return owner }
            if let m = c.view as? AWCTableAXView, !m.info.ownerID.isEmpty, let owner = byID[m.info.ownerID], owner !== m, owner.rank < m.rank { return owner }
            let p = NSPoint(x: c.frame.midX, y: c.frame.midY)
            // (A container holds what fits in it: the frozen body's focus surface spans rows, so it belongs to the table.)
            return containers.filter { $0 !== c.view && $0.rank < c.rank && box($0).insetBy(dx: -0.5, dy: -0.5).contains(p)
                && box($0).width + 1 >= c.frame.width && box($0).height + 1 >= c.frame.height }
                .max { a, b in a.rank != b.rank ? a.rank < b.rank : box(a).width * box(a).height > box(b).width * box(b).height }
        }
        let rtl = parent.userInterfaceLayoutDirection == .rightToLeft
        var mine = candidates.filter { container(of: $0) === parent }.sorted { a, b in
            if abs(a.frame.maxY - b.frame.maxY) > 1 { return a.frame.maxY > b.frame.maxY }
            return rtl ? a.frame.maxX > b.frame.maxX : a.frame.minX < b.frame.minX
        }
        if parent.info.kind == .landmark { mine = inlineOrder(mine, rtl: rtl) }
        // The element that lists these: a row's focus surface when it stands for the row.
        let owner: NSView = rowSurface[ObjectIdentifier(parent)] ?? parent
        return mine.map { c -> Any in
            if let marker = c.view as? AWCTableAXView, marker.info.kind == .row, let surface = rowSurface[ObjectIdentifier(marker)] {
                let info = marker.info
                surface.awcAccessibilityOverride = AWCFocusAccessibilityOverride(role: .row, label: info.label, selected: info.selected, expanded: info.expanded,
                                                                                  index: info.rowIndex >= 0 ? info.rowIndex : nil,
                                                                                  children: { [weak marker] in marker.map { children(of: $0) } ?? [] })
                surface.awcAccessibilityContainer = owner
                return surface
            }
            if let v = c.view as? AWCTableAXView { v.axContainer = owner }
            else if let f = c.view as? AWCNativeButtonFocusView { f.awcAccessibilityContainer = owner }
            else if c.view is NSTextField { c.view.setAccessibilityParent(owner); return NSAccessibility.unignoredDescendant(of: c.view) ?? c.view }
            return c.view
        }
    }
    /// A bar's parts sit on one line with different heights (the pagination: a 22 pt field beside 40 pt buttons), so they read
    /// in inline order line by line — the Web's DOM order — not top edge first. The tallest part of a line sets its band.
    static func inlineOrder(_ items: [Candidate], rtl: Bool) -> [Candidate] {
        var lines: [(band: ClosedRange<CGFloat>, items: [Candidate])] = []
        for c in items.sorted(by: { $0.frame.height > $1.frame.height }) {
            if let i = lines.firstIndex(where: { $0.band.contains(c.frame.midY) }) { lines[i].items.append(c) }
            else { lines.append((c.frame.minY...c.frame.maxY, [c])) }
        }
        return lines.sorted { $0.band.upperBound > $1.band.upperBound }
            .flatMap { $0.items.sorted { a, b in rtl ? a.frame.maxX > b.frame.maxX : a.frame.minX < b.frame.minX } }
    }
    /// The table's header cells (columnheader / rowheader), for AXColumnHeaderUIElements.
    static func headerCells(of table: AWCTableAXView) -> [Any] {
        children(of: table).flatMap { row -> [Any] in
            let cells: [Any]
            if let v = row as? AWCTableAXView, v.info.kind == .row { cells = children(of: v) }
            else if let f = row as? AWCNativeButtonFocusView, let o = f.awcAccessibilityOverride { cells = o.children() }
            else { cells = [] }
            return cells.filter { ($0 as? AWCTableAXView)?.info.header == true }
        }
    }
}
#elseif canImport(UIKit)
import UIKit

/// iOS: md-table is a UIKit data table (UIAccessibilityContainerDataTable) over the SwiftUI layout, whose own elements are
/// hidden (as on macOS): a cell is a static-text element at its row / column (header cells are the column headers); a control
/// inside a cell is its focus surface, placed at that cell (aria-rowindex when the table has row-count); a row's tab stop is its
/// focus surface at its row. The family's other parts stay labelled SwiftUI containers (UIKit has no toolbar / landmark element).
final class AWCTableAXView: UIView, UIAccessibilityContainerDataTable {
    enum Kind { case table, group, toolbar, landmark, row, cell, text, heading }
    struct Info: Equatable {
        var kind: Kind
        var label = ""
        var identifier = ""
        var help = ""
        var rowID = ""
        var selected: Bool? = nil
        var expanded: Bool? = nil
        var header = false
        var rowIndex = -1
        var columnIndex = -1
        var columnSpan = 1
        var rowSpan = 1
        var ariaRowCount: Int? = nil
        var ariaRowIndex: Int? = nil
        var columnCount = 0
        var ownerID = ""
    }
    var info = Info(kind: .text)
    /// Text elements of the cells / texts this table lists (stable identity across queries, so VoiceOver keeps its place).
    var proxies: [ObjectIdentifier: AWCTableAXCellElement] = [:]
    /// (row, column) → element, rebuilt with the element list.
    var slots: [[Int]: NSObject] = [:]
    var headers: [Int: [NSObject]] = [:]
    var rowTotal = 0
    override init(frame: CGRect) { super.init(frame: frame); isUserInteractionEnabled = false; backgroundColor = .clear }
    required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }
    override var isAccessibilityElement: Bool { get { false } set { } }
    /// Markers other than the table are read through their table only.
    override var accessibilityElementsHidden: Bool { get { info.kind != .table } set { } }
    override var accessibilityElements: [Any]? { get { info.kind == .table ? AWCTableAXTree.elements(of: self) : [] } set { } }
    override var accessibilityContainerType: UIAccessibilityContainerType { get { info.kind == .table ? .dataTable : .none } set { } }
    override var accessibilityLabel: String? { get { info.kind == .table && !info.label.isEmpty ? info.label : nil } set { } }
    override var accessibilityHint: String? { get { info.kind == .table && !info.help.isEmpty ? info.help : nil } set { } }
    override var accessibilityIdentifier: String? { get { info.identifier.isEmpty ? nil : info.identifier } set { } }
    func accessibilityDataTableCellElement(forRow row: Int, column: Int) -> UIAccessibilityContainerDataTableCell? {
        _ = AWCTableAXTree.elements(of: self); return slots[[row, column]] as? UIAccessibilityContainerDataTableCell
    }
    func accessibilityRowCount() -> Int { _ = AWCTableAXTree.elements(of: self); return Swift.max(rowTotal, info.ariaRowCount ?? 0) }
    func accessibilityColumnCount() -> Int { info.columnCount }
    func accessibilityHeaderElements(forColumn column: Int) -> [UIAccessibilityContainerDataTableCell]? {
        _ = AWCTableAXTree.elements(of: self); return headers[column]?.compactMap { $0 as? UIAccessibilityContainerDataTableCell }
    }
    func accessibilityHeaderElements(forRow row: Int) -> [UIAccessibilityContainerDataTableCell]? { nil }
}

/// A cell's (or a listed text's) element: its text, at its row / column.
final class AWCTableAXCellElement: UIAccessibilityElement, UIAccessibilityContainerDataTableCell {
    weak var marker: UIView?
    var rowRange = NSRange(location: NSNotFound, length: 0), columnRange = NSRange(location: NSNotFound, length: 0)
    func accessibilityRowRange() -> NSRange { rowRange }
    func accessibilityColumnRange() -> NSRange { columnRange }
    override var accessibilityFrame: CGRect {
        get { marker.map { UIAccessibility.convertToScreenCoordinates($0.bounds, in: $0) } ?? .zero }
        set { }
    }
}

struct AWCTableAXMarker: UIViewRepresentable {
    let info: AWCTableAXView.Info
    func makeUIView(context: Context) -> AWCTableAXView { AWCTableAXView() }
    func updateUIView(_ view: AWCTableAXView, context: Context) {
        if view.info != info { view.info = info; if info.kind == .table { UIAccessibility.post(notification: .layoutChanged, argument: nil) } }
    }
}

/// Assembles the table's elements from the marker views and the focus surfaces in the window.
enum AWCTableAXTree {
    static func views(_ v: UIView) -> [UIView] { [v] + v.subviews.flatMap(views) }
    static func shown(_ v: UIView) -> Bool { var c: UIView? = v; while let x = c { if x.isHidden || x.alpha < 0.01 { return false }; c = x.superview }; return true }
    static func box(_ v: UIView) -> CGRect { v.convert(v.bounds, to: nil) }
    static func area(_ r: CGRect) -> CGFloat { r.width * r.height }
    static func elements(of table: AWCTableAXView) -> [Any] {
        guard let window = table.window else { return [] }
        let all = views(window).filter { $0.window != nil && shown($0) }
        let markers = all.compactMap { $0 as? AWCTableAXView }
        let tables = markers.filter { $0.info.kind == .table }
        /// The innermost table holding a frame's centre (nested tables list their own content).
        func owner(_ r: CGRect) -> AWCTableAXView? {
            tables.filter { box($0).insetBy(dx: -0.5, dy: -0.5).contains(CGPoint(x: r.midX, y: r.midY)) }.min { area(box($0)) < area(box($1)) }
        }
        let cells = markers.filter { $0.info.kind == .cell && owner(box($0)) === table }
        let texts = markers.filter { ($0.info.kind == .text || $0.info.kind == .heading) && !$0.info.label.isEmpty && owner(box($0)) === table }
        let controls = all.filter { v in
            if let f = v as? AWCNativeButtonFocusView { return f.configuration?.inert == false && f.isAccessibilityElement }
            return (v is UITextField || v is UITextView) && v.isAccessibilityElement
        }.filter { owner(box($0)) === table }
        func cell(of r: CGRect) -> AWCTableAXView? {
            cells.filter { let b = box($0).insetBy(dx: -0.5, dy: -0.5); return b.contains(CGPoint(x: r.midX, y: r.midY)) && b.width + 1 >= r.width && b.height + 1 >= r.height }
                .min { area(box($0)) < area(box($1)) }
        }
        func row(_ i: AWCTableAXView.Info) -> Int { i.ariaRowIndex.map { $0 - 1 } ?? i.rowIndex }
        var items: [(frame: CGRect, sub: CGFloat, element: NSObject)] = []
        var slots: [[Int]: NSObject] = [:], headers: [Int: [NSObject]] = [:]
        var inCell: [ObjectIdentifier: [UIView]] = [:]
        var live = Set<ObjectIdentifier>()
        for c in controls {
            let f = box(c)
            if let m = cell(of: f) { inCell[ObjectIdentifier(m), default: []].append(c); continue }
            // A row's tab stop (it spans the row's cells): placed at its row.
            if let fv = c as? AWCNativeButtonFocusView {
                let r = cells.first { box($0).minY - 0.5 <= f.midY && f.midY <= box($0).maxY + 0.5 }.map { row($0.info) } ?? -1
                fv.awcCellOverride = AWCGridCellContext(row: r, column: -1)
            }
            items.append((f, f.minX, c))
        }
        for m in cells {
            let i = m.info, r = row(i)
            if let inside = inCell[ObjectIdentifier(m)], !inside.isEmpty {
                for c in inside {
                    if let fv = c as? AWCNativeButtonFocusView { fv.awcCellOverride = AWCGridCellContext(row: r, column: i.columnIndex) }
                    items.append((box(m), box(c).minX, c))   // in its cell's place (controls sit below the cell's top)
                }
                for dr in 0..<Swift.max(1, i.rowSpan) { for dc in 0..<Swift.max(1, i.columnSpan) where slots[[r + dr, i.columnIndex + dc]] == nil { slots[[r + dr, i.columnIndex + dc]] = inside[0] } }
                if i.header { headers[i.columnIndex, default: []].append(inside[0]) }
                continue
            }
            guard !i.label.isEmpty else { continue }
            let key = ObjectIdentifier(m); live.insert(key)
            let e = table.proxies[key] ?? AWCTableAXCellElement(accessibilityContainer: table)
            table.proxies[key] = e
            e.marker = m; e.accessibilityLabel = i.label; e.accessibilityTraits = .staticText   // header cells: the table's column headers (no heading trait: not a Web heading)
            e.accessibilityIdentifier = i.identifier.isEmpty ? nil : i.identifier
            e.rowRange = r >= 0 ? NSRange(location: r, length: Swift.max(1, i.rowSpan)) : NSRange(location: NSNotFound, length: 0)
            e.columnRange = i.columnIndex >= 0 ? NSRange(location: i.columnIndex, length: Swift.max(1, i.columnSpan)) : NSRange(location: NSNotFound, length: 0)
            for dr in 0..<Swift.max(1, i.rowSpan) { for dc in 0..<Swift.max(1, i.columnSpan) { slots[[r + dr, i.columnIndex + dc]] = e } }
            if i.header { headers[i.columnIndex, default: []].append(e) }
            items.append((box(m), box(m).minX, e))
        }
        for m in texts {
            let key = ObjectIdentifier(m); live.insert(key)
            let e = table.proxies[key] ?? AWCTableAXCellElement(accessibilityContainer: table)
            table.proxies[key] = e
            e.marker = m; e.accessibilityLabel = m.info.label; e.accessibilityTraits = m.info.kind == .heading ? [.staticText, .header] : .staticText
            items.append((box(m), box(m).minX, e))
        }
        table.proxies = table.proxies.filter { live.contains($0.key) }
        table.slots = slots; table.headers = headers
        table.rowTotal = Set(cells.map { row($0.info) }).count
        let rtl = table.effectiveUserInterfaceLayoutDirection == .rightToLeft
        return items.sorted { a, b in
            if abs(a.frame.minY - b.frame.minY) > 1 { return a.frame.minY < b.frame.minY }
            // Inline order; at the same start the wider box first (a row's tab stop before its first cell).
            let (sa, sb, ea, eb) = rtl ? (-a.frame.maxX, -b.frame.maxX, -a.frame.minX, -b.frame.minX) : (a.frame.minX, b.frame.minX, a.frame.maxX, b.frame.maxX)
            if abs(sa - sb) > 0.5 { return sa < sb }
            if abs(ea - eb) > 0.5 { return ea > eb }
            return rtl ? a.sub > b.sub : a.sub < b.sub
        }.map(\.element)
    }
}
#endif
