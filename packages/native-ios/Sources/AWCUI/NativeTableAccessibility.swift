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
        if #available(iOS 17.0, macOS 14.0, *) {
            var message = AttributedString(text); message.accessibilitySpeechAnnouncementPriority = .low
            AccessibilityNotification.Announcement(message).post()
        }
    }
}

extension AWCNode {
    var awcTablePresentational: Bool { properties[AWCTableAX.presentationalKey]?.bool == true }
}

/// The element a family part is on each platform. macOS: an AppKit element over the SwiftUI layout (whose own elements are
/// hidden), so the table is AXTable → AXRow → AXCell with the controls inside each cell, the toolbar AXToolbar, the
/// pagination a navigation landmark. iOS: a labelled SwiftUI container (UIKit has no table / toolbar / landmark element).
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
        if kind == .group { content.accessibilityElement(children: .contain) }
        else { content.accessibilityElement(children: .contain).accessibilityLabel(label).accessibilityHint(hint) }
        #endif
    }
}

/// A static text (or heading) the macOS family element lists in place of the hidden SwiftUI text; elsewhere a no-op.
struct AWCTableAXText: ViewModifier {
    let text: String
    var heading = false
    @ViewBuilder func body(content: Content) -> some View {
        #if canImport(AppKit)
        // The marker is listed by its family element only (hidden from SwiftUI's tree, which may still show the content around it).
        content.accessibilityHidden(true).background { AWCTableAXMarker(info: .init(kind: heading ? .heading : .text, label: text)).allowsHitTesting(false).accessibilityHidden(true) }
        #else
        content
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
        var ariaRowCount: Int? = nil
        var ariaRowIndex: Int? = nil
        var columnCount = 0
        /// row: the table's id; cell: its row's id (structure by identity, so rows scrolled out of view stay in place).
        var ownerID = ""
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
    override func accessibilityRowIndexRange() -> NSRange { info.kind == .cell && info.rowIndex >= 0 ? NSRange(location: info.rowIndex, length: 1) : NSRange(location: NSNotFound, length: 0) }
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
            if v is NSTextField || v is NSTextView, v.isAccessibilityElement() { candidates.append(.init(view: v, rank: 3, frame: box(v))) }
        }
        let byID = Dictionary(containers.filter { !$0.info.identifier.isEmpty }.map { ($0.info.identifier, $0) }, uniquingKeysWith: { a, _ in a })
        func container(of c: Candidate) -> AWCTableAXView? {
            if let m = c.view as? AWCTableAXView, !m.info.ownerID.isEmpty, let owner = byID[m.info.ownerID], owner !== m, owner.rank < m.rank { return owner }
            let p = NSPoint(x: c.frame.midX, y: c.frame.midY)
            // (A container holds what fits in it: the frozen body's focus surface spans rows, so it belongs to the table.)
            return containers.filter { $0 !== c.view && $0.rank < c.rank && box($0).insetBy(dx: -0.5, dy: -0.5).contains(p)
                && box($0).width + 1 >= c.frame.width && box($0).height + 1 >= c.frame.height }
                .max { a, b in a.rank != b.rank ? a.rank < b.rank : box(a).width * box(a).height > box(b).width * box(b).height }
        }
        let rtl = parent.userInterfaceLayoutDirection == .rightToLeft
        let mine = candidates.filter { container(of: $0) === parent }.sorted { a, b in
            if abs(a.frame.maxY - b.frame.maxY) > 1 { return a.frame.maxY > b.frame.maxY }
            return rtl ? a.frame.maxX > b.frame.maxX : a.frame.minX < b.frame.minX
        }
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
            return c.view
        }
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
#endif
