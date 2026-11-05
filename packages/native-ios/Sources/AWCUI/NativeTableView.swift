import SwiftUI
import Observation
import QuartzCore

/// Scroll context an md-table-container (or a frozen md-table body) supplies to its grid.
struct AWCTableScrollContext: Equatable {
    var offset: CGPoint = .zero          // logical (inline-start = 0)
    var viewport: CGSize? = nil
    var fill: Double? = nil
}
private struct AWCTableScrollKey: EnvironmentKey { static let defaultValue = AWCTableScrollContext() }
extension EnvironmentValues {
    var awcTableScroll: AWCTableScrollContext { get { self[AWCTableScrollKey.self] } set { self[AWCTableScrollKey.self] = newValue } }
}
/// Optional reduced-motion override (tests, Laboratory); nil follows the system setting.
private struct AWCTableReducedMotionKey: EnvironmentKey { static let defaultValue: Bool? = nil }
private struct AWCTableForcedColorsKey: EnvironmentKey { static let defaultValue = false }
extension EnvironmentValues {
    var awcTableReducedMotion: Bool? { get { self[AWCTableReducedMotionKey.self] } set { self[AWCTableReducedMotionKey.self] = newValue } }
    var awcTableForcedColors: Bool { get { self[AWCTableForcedColorsKey.self] } set { self[AWCTableForcedColorsKey.self] = newValue } }
}
public extension View {
    func awcTableReducedMotion(_ reduced: Bool?) -> some View { environment(\.awcTableReducedMotion, reduced) }
    /// High-contrast rendering equivalent to the source's `forced-colors: active` rules.
    func awcTableForcedColors(_ on: Bool) -> some View { environment(\.awcTableForcedColors, on) }
}

/// Non-observed geometry store for hit-testing (written during placement).
final class AWCTableGeometryBox {
    var grid = AWCTableResolvedGrid(widths: [], width: 0, rows: []); var frame: CGRect = .zero
    /// The frozen body's scrollport in the same space (nil: no frozen body).
    var clip: CGRect? = nil
    /// The frozen body's own scroll view (its offsets are the frozen state; a shared controller may still point elsewhere).
    let port = AWCTableScrollPortBox()
    /// keep-height: the last laid-out height (table, or frozen body).
    var lastHeight: CGFloat = 0
}

/// md-table (md-table.tsx / md-table.css): shared column tracks, row groups, selection / sort coordination,
/// expandable rows, loading (overlay / skeleton) and empty states.
struct AWCNativeTable: View {
    let node: AWCNode
    let theme: AWCTheme
    let onEvent: (AWCEvent) -> Void
    @State private var runtime = AWCTableRuntime()
    @State private var geometry = AWCTableGeometryBox()
    @State private var expandProgress: [String: Double] = [:]
    @State private var frozenOffset: CGPoint = .zero
    @State private var frozenViewport: CGSize = .zero
    @State private var frozenContent: CGSize = .zero
    @State private var ownScroller = AWCTableScrollController()
    @State private var handle = AWCTableHandle()
    @State private var rowFocus = AWCTableRowFocusRegistry()
    @State private var bodyFocus = AWCButtonFocusHandle()
    @State private var thumbPressed = false
    @State private var thumbDragStart: Double? = nil
    /// keep-height (default on): two frames after the first layout the table (frozen: its body) is floored at that height.
    @State private var heightFloor: CGFloat? = nil
    @Environment(\.awcTableControllers) private var controllers
    @Environment(\.awcTableMotionRecorder) private var motion
    @Environment(\.awcTableScrollController) private var scrollController
    @Environment(\.layoutDirection) private var direction
    @Environment(\.awcTableContainer) private var container
    @Environment(\.awcTableVars) private var inheritedVars
    @Environment(\.awcTableScroll) private var scroll
    @Environment(\.accessibilityReduceMotion) private var systemReduced
    @Environment(\.awcTableReducedMotion) private var reducedOverride
    @Environment(\.awcTableForcedColors) private var forcedColors
    @Environment(\.awcNativeDensity) private var inheritedDensity
    /// Host-supplied pointer (Laboratory live previews, tests) in the "awc-native-preview" space.
    @Environment(\.awcNativePointerState) private var pointer

    var p: [String: AWCValue] { (AWCComponentCatalog.defaults["md-table"] ?? [:]).merging(node.properties) { _, n in n } }
    func s(_ k: String, _ f: String = "") -> String { p[k]?.string ?? f }
    func b(_ k: String, _ f: Bool = false) -> Bool { p[k]?.bool ?? f }
    func n(_ k: String, _ f: Double = 0) -> Double { p[k]?.number ?? f }
    var rtl: Bool { direction == .rightToLeft }
    var reduced: Bool { reducedOverride ?? systemReduced }
    /// The family's custom properties here: inherited (container, host, appearance modifiers) under the table's own `style`.
    var vars: AWCTableVars { inheritedVars.merging(style: s("style")) }
    var hooks: AWCTableHooks { AWCTableHooks(vars: vars) }
    var selectionMode: String { ["single", "multiple"].contains(s("selection")) ? s("selection") : "none" }
    var sortBy: String { runtime.sortBy ?? s("sortBy") }
    var sortOrder: String { runtime.sortOrder ?? (["asc", "desc"].contains(s("sortOrder")) ? s("sortOrder") : "asc") }
    var loading: Bool { b("loading") }
    var skeleton: Bool { loading && s("loadingMode") == "skeleton" }
    var palette: AWCTablePalette { AWCTablePalette(tokens: theme.tokens, forced: forcedColors) }

    func metrics() -> AWCTableMetrics { AWCTableMetrics(density: node.properties["density"], inheritedScale: inheritedDensity, hooks: hooks) }

    func tableEnvironment(_ rows: [AWCTableRowEntry]) -> AWCTableEnvironment {
        var colorHooks = vibrantHooks(hooks)
        if forcedColors { colorHooks.dividerColor = nil; colorHooks.headBackground = nil; colorHooks.headColor = nil; colorHooks.footBackground = nil
            colorHooks.rowHoverColor = nil; colorHooks.rowSelectedBackground = nil; colorHooks.rowSelectedColor = nil; colorHooks.stripeColor = nil }
        var env = AWCTableEnvironment(metrics: metrics(), hooks: colorHooks, palette: palette,
                                      surface: (forcedColors ? nil : vars.color("--md-table-surface")) ?? container.surface ?? palette.hex("surface"), striped: b("striped"), noDividers: b("noDividers"),
                                      hoverable: b("hoverable", true), reducedMotion: reduced, rtl: rtl, forcedColors: forcedColors,
                                      selection: selectionMode, pinIcon: s("pinIcon"), sortBy: sortBy, sortOrder: sortOrder)
        env.vibrant = container.vibrant
        env.vars = vars
        env.requestSort = { column, defaultOrder in requestSort(column, defaultOrder) }
        env.toggleRow = { id in toggle(id, rows) }
        env.rowClick = { id in if let row = rows.first(where: { $0.id == id }) { rowClick(row) } }
        env.motion = motion
        env.tableID = node.id
        env.axMode = node.awcTablePresentational ? .presentational : rows.contains { $0.bool("expandable") } ? .treegrid : .table
        return env
    }
    /// md-table-container--vibrant re-points the table hooks (inherited custom properties).
    func vibrantHooks(_ h: AWCTableHooks) -> AWCTableHooks {
        guard container.vibrant else { return h }
        var v = AWCTableHooks()
        let primary = palette.hex("primary")
        v.headBackground = palette.hex("primary-container"); v.headColor = palette.hex("on-primary-container")
        v.rowHoverColor = primary; v.rowSelectedBackground = palette.hex("tertiary-container"); v.rowSelectedColor = palette.hex("on-tertiary-container")
        v.dividerColor = AWCTableColor.hex(AWCTableColor.mix(primary, 0.22, nil)); v.stripeColor = AWCTableColor.hex(AWCTableColor.mix(primary, 0.07, nil))
        return v.merging(h)
    }

    // MARK: Columns

    func tracks(_ rows: [AWCTableRowEntry]) -> [AWCTableTrack] {
        let template: String
        if !s("columnTemplate").isEmpty { template = s("columnTemplate") }
        else if n("columns") > 0 { template = "repeat(\(Int(n("columns"))), minmax(0, 1fr))" }
        else if let t = hooks.columnsTemplate { template = t }
        else {
            let count = rows.first.map { $0.cells.reduce(0) { $0 + span($1) } } ?? 0
            template = count > 0 ? "repeat(\(count), minmax(0, 1fr))" : ""
        }
        if let pins = runtime.pinLayout { return AWCTableTemplate.parse(pins.template) ?? [] }
        return AWCTableTemplate.parse(template) ?? []
    }
    func span(_ cell: AWCNode) -> Int { Int(cell.properties["colSpan"]?.number ?? cell.properties["colspan"]?.number ?? 1).clamped(1, 1000) }
    func pin(_ cell: AWCNode) -> String? {
        let v = cell.properties["sticky"]?.string ?? ""
        return ["start", "end"].contains(v) ? v : nil
    }
    /// Display placement of a row's cells: (cell, display column, span, pinned side); hidden columns are left out.
    func placements(_ r: AWCTableRowEntry) -> [(cell: AWCNode, column: Int, span: Int, pinned: String?)] {
        if let pins = runtime.pinLayout {
            let visible = pins.visible
            return r.cells.enumerated().compactMap { k, cell in visible.firstIndex(of: k).map { (cell, $0, 1, pins.pins[k]) } }
        }
        var out: [(AWCNode, Int, Int, String?)] = [], column = 0
        for cell in r.cells { let sp = span(cell); out.append((cell, column, sp, pin(cell))); column += sp }
        return out
    }

    // MARK: Behaviour

    func emit(_ name: String, _ detail: AWCValue = .null, tag: String = "md-table", id: String? = nil) {
        if name == "mdSelectionChange" { runtime.announcedCount = Int(detail["count"].number ?? 0) }
        onEvent(AWCEvent(name: name, tag: tag, nodeID: id ?? node.id, detail: detail))
    }
    func selectableRows(_ rows: [AWCTableRowEntry]) -> [AWCTableSelectableRow] {
        rows.filter { $0.group == .body }.map { .init(id: $0.id, value: $0.value, selected: runtime.isSelected($0), disabled: $0.bool("disabled"), selectable: $0.bool("selectable", true)) }
    }
    func selectionState(_ rows: [AWCTableRowEntry]) -> AWCTableSelectionState { AWCTableSelectionState.compute(selectableRows(rows)) }
    /// Row selection change (checkbox, toggle or select-all), emitted as the source does.
    /// A row's `selected` changed (checkbox, keyboard, host property): the source's row watcher emits mdRowSelectionChange
    /// and md-table handles it during that dispatch — single mode first deselects the others (their events reach the
    /// application first), then the recomputed mdSelectionChange — so the application sees the row's own event last.
    func setSelected(_ row: AWCTableRowEntry, _ value: Bool, _ rows: [AWCTableRowEntry], alreadyApplied: Bool = false) {
        guard alreadyApplied || runtime.isSelected(row) != value else { return }
        runtime.selected[row.id] = value
        if selectionMode == "single" && value {
            for other in rows where other.group == .body && other.id != row.id && runtime.isSelected(other) {
                runtime.selected[other.id] = false
                emit("mdRowSelectionChange", ["selected": false, "value": .string(other.identity)], tag: "md-table-row", id: other.id)
            }
        }
        emit("mdSelectionChange", selectionState(rows).detail)
        emit("mdRowSelectionChange", ["selected": .bool(value), "value": .string(row.identity)], tag: "md-table-row", id: row.id)
    }
    /// Host property changes the source's row watchers report (selected / expanded set by the application).
    func authored(_ changes: [AWCTableRuntime.AuthoredChange], _ rows: [AWCTableRowEntry]) {
        // Each row's watcher fires as its property is set, so a batch of host changes is handled one row at a time:
        // rows not reached yet still count with their previous value (two `selected = true` writes emit 1/n, then 2/n).
        for c in changes { if let v = c.selected { runtime.selected[c.row.id] = !v } }
        for c in changes {
            if let v = c.selected { setSelected(c.row, v, rows, alreadyApplied: true) }
            if let v = c.expanded { runtime.expandOpening = v; emit("mdRowExpandedChange", ["expanded": .bool(v)], tag: "md-table-row", id: c.row.id) }
        }
    }
    /// `selection` switched to single with several rows selected: the first stays, the rest are deselected.
    func trimSingle(_ rows: [AWCTableRowEntry]) {
        let selected = rows.filter { $0.group == .body && runtime.isSelected($0) }
        guard selected.count > 1 else { return }
        for r in selected.dropFirst() { runtime.selected[r.id] = false; emit("mdRowSelectionChange", ["selected": false, "value": .string(r.identity)], tag: "md-table-row", id: r.id) }
        emit("mdSelectionChange", selectionState(rows).detail)
    }
    func selectAll(_ value: Bool, _ rows: [AWCTableRowEntry]) {
        if value && selectionMode != "multiple" { return }
        for row in rows where row.group == .body && (!value || (!row.bool("disabled") && row.bool("selectable", true))) && runtime.isSelected(row) != value {
            runtime.selected[row.id] = value
            emit("mdRowSelectionChange", ["selected": .bool(value), "value": .string(row.identity)], tag: "md-table-row", id: row.id)
        }
        emit("mdSelectionChange", selectionState(rows).detail)
    }
    func requestSort(_ column: String, _ defaultOrder: String) {
        guard !column.isEmpty else { return }
        let next = AWCTableSort.next(currentColumn: sortBy, currentOrder: sortOrder, column: column, defaultOrder: defaultOrder)
        runtime.sortBy = next.column; runtime.sortOrder = next.order == "none" ? "asc" : next.order
        arm()
        emit("mdSortChange", ["column": .string(next.column), "order": .string(next.order)])
    }
    func setSort(_ column: String, _ order: String) {
        runtime.sortBy = column; runtime.sortOrder = order
        arm()
        emit("mdSortChange", ["column": .string(column), "order": .string(order)])
    }
    /// FLIP bracket (md-table.tsx armMotion): the consumer's synchronous reorder glides the rows.
    func arm() { if s("motion") != "none" { runtime.armedUntil = CACurrentMediaTime() + 0.6 } }
    func pinColumn(_ column: Int, _ side: String, _ rows: [AWCTableRowEntry]) -> String? {
        guard var layout = runtime.pinLayout ?? AWCTablePinLayout.make(template: s("columnTemplate"), rows: rows) else { return nil }
        if side == "none" || layout.pins[column] == side { layout.pins[column] = nil } else { layout.pins[column] = side }
        runtime.pinLayout = layout
        let effective = layout.pins[column]
        emit("mdPinChange", ["column": .number(Double(column)), "side": effective.map { .string($0) } ?? .null])
        return effective
    }
    func setColumnVisibility(_ column: Int, _ visible: Bool, _ rows: [AWCTableRowEntry]) -> Bool {
        guard var layout = runtime.pinLayout ?? AWCTablePinLayout.make(template: s("columnTemplate"), rows: rows) else { return true }
        guard column >= 0 && column < layout.base.count else { return true }
        if !visible && layout.hidden.count >= layout.base.count - 1 && !layout.hidden.contains(column) { return true }
        if visible { layout.hidden.remove(column) } else { layout.hidden.insert(column) }
        runtime.pinLayout = layout
        let effective = !layout.hidden.contains(column)
        emit("mdColumnVisibilityChange", ["column": .number(Double(column)), "visible": .bool(effective), "hidden": .array(layout.hidden.sorted().map { .number(Double($0)) })])
        return effective
    }
    /// Refreshes the controller's view of this table (current rows) on every render.
    func connect(_ rows: [AWCTableRowEntry]) -> Bool {
        handle.getSelection = { selectionState(rows).detail }
        handle.selectAll = { v in selectAll(v, rows) }
        handle.toggleSelectAll = { selectAll(!selectionState(rows).all, rows) }
        handle.setSort = { c, o in setSort(c, o) }
        handle.pinColumn = { c, side in pinColumn(c, side, rows) }
        handle.setColumnVisibility = { c, v in setColumnVisibility(c, v, rows) }
        handle.animateNextChange = { runtime.armedUntil = CACurrentMediaTime() + 0.6 }
        handle.toggleRow = { id in toggle(id, rows) }
        if let c = controllers[node.id], c.handle !== handle { c.handle = handle }
        return true
    }
    func toggle(_ id: String, _ rows: [AWCTableRowEntry]) {
        guard let row = rows.first(where: { $0.id == id }), row.bool("expandable") else { return }
        let value = !runtime.isExpanded(row)
        runtime.expandOpening = value
        runtime.expanded[id] = value
        emit("mdRowExpandedChange", ["expanded": .bool(value)], tag: "md-table-row", id: id)
    }

    // MARK: Body

    var body: some View {
        let rows = node.awcTableRows
        let env = tableEnvironment(rows)
        let m = env.metrics
        let _ = connect(rows)
        VStack(alignment: .leading, spacing: 0) {
            if !s("caption").isEmpty {
                AWCListText(text: s("caption"), size: 14, lineHeight: 20, weight: 500, tracking: 0.1, color: palette.color("on-surface-variant"))
                    .padding(.vertical, 12).padding(.horizontal, m.padInline)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .accessibilityHidden(true)
            }
            if b("frozenHeader") { frozen(rows, env) } else { grid(rows, env) }
            if b("empty") && !loading && !b("frozenHeader") { emptyState(m) }
        }
        .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { if !b("frozenHeader") { geometry.lastHeight = $0 } }
        .frame(minHeight: b("keepHeight", true) && !b("frozenHeader") ? heightFloor : nil, alignment: .top)
        .onAppear {
            // md-table.tsx componentDidLoad: two animation frames after the first layout, min-block-size = that height.
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.034) { if heightFloor == nil, b("keepHeight", true), geometry.lastHeight > 1 { heightFloor = geometry.lastHeight.rounded() } }
        }
        .font(AWCNativeFonts.label(size: m.fontSize, weight: 400))
        .foregroundStyle(palette.color("on-surface"))
        .overlay(alignment: .topLeading) { if loading && !skeleton { loadingOverlay(m) } }
        .environment(\.awcTableEnvironment, env)
        .preference(key: AWCTableSelectionCountKey.self, value: selectionMode == "none" ? 0 : runtime.announcedCount ?? selectionState(rows).count)
        .environment(\.awcTableRowFocus, rowFocus)
        .onAppear { runtime.absorb(rows); if runtime.announcedCount == nil { runtime.announcedCount = selectionState(rows).count } }
        .onChange(of: rows) { _, value in authored(runtime.absorb(value), value) }
        .onChange(of: selectionMode) { _, mode in if mode == "single" { trimSingle(rows) } }
        .onChange(of: s("sortBy") + "|" + s("sortOrder")) { _, _ in runtime.sortBy = nil; runtime.sortOrder = nil }
        // role="table" / "treegrid" named by label or caption (macOS AXTable → AXRow → AXCell; aria-rowcount when paged).
        .modifier(AWCTableAXRoot(kind: env.axMode == .presentational ? .group : .table,
                                 label: env.axMode == .presentational ? "" : ([s("label"), s("caption")].first { !$0.isEmpty } ?? "Data table"), identifier: node.id,
                                 hint: s("summary"), ariaRowCount: ariaRowCount(rows), columnCount: geometry.grid.widths.count))
        .awcInspect(nodeID: node.id, name: "md-table") { _ in
            let st = selectionState(rows)
            return ["role": .string(rows.contains { $0.bool("expandable") } ? "treegrid" : "table"), "sortBy": .string(sortBy), "sortOrder": .string(sortOrder),
                    "selectionCount": .number(Double(st.count)), "total": .number(Double(st.total)), "all": .bool(st.all), "indeterminate": .bool(st.indeterminate),
                    "headCheckbox": .array(selectAllBox(st).map { .bool($0) }), "columnOrder": .array((runtime.pinLayout?.visible ?? []).map { .number(Double($0)) }), "busy": .bool(loading), "columns": .array(geometry.grid.widths.map { .number($0) }),
                    "gridWidth": .number(geometry.grid.width), "rows": .array(geometry.grid.rows.map { .array([.number($0.y), .number($0.height)]) })]
        }
    }

    /// Row boxes (min height, divider edges, sticky) and grid subviews for the rows shown.
    func gridModel(_ rows: [AWCTableRowEntry], _ env: AWCTableEnvironment) -> (shown: [AWCTableRowEntry], rows: [AWCTableGridRow], items: [Item]) {
        let m = env.metrics
        let shown = skeleton ? rows.filter { $0.group == .head } : rows
        let lastIndex = shown.count - 1
        let footExists = shown.contains { $0.group == .foot }
        let lastBody = shown.lastIndex { $0.group == .body }
        let suppressLast = container.inContainer && !container.hasBottomBar
        let skeletonCount = skeleton ? Swift.max(1, Int(n("loadingRows", 4))) : 0
        let columnCount = Swift.max(1, tracks(rows).count)
        var gridRows: [AWCTableGridRow] = []
        for (i, r) in shown.enumerated() {
            let top = r.group == .foot && (i == 0 || shown[i - 1].group != .foot) ? 1.0 : 0
            var bottom = r.group == .foot ? 0.0 : 1
            if suppressLast && i == lastIndex && skeletonCount == 0 { bottom = 0 }
            if footExists && i == lastBody { bottom = 0 }
            gridRows.append(.init(minHeight: r.group == .head ? m.headHeight : m.rowHeight, borderTop: top, borderBottom: bottom,
                                  stickyTop: r.group == .head && (b("stickyHeader") || b("frozenHeader")), stickyBottom: r.group == .foot && b("stickyFooter"),
                                  expandedFraction: r.bool("expandable") ? (runtime.isExpanded(r) ? 1 : 0) : 0))
        }
        for k in 0..<skeletonCount { gridRows.append(.init(minHeight: m.rowHeight, borderTop: 0, borderBottom: k == skeletonCount - 1 ? 0 : 1, stickyTop: false, stickyBottom: false, expandedFraction: 0)) }
        return (shown, gridRows, gridItems(shown, env, skeletonRows: skeletonCount, columns: columnCount))
    }

    @ViewBuilder func grid(_ rows: [AWCTableRowEntry], _ env: AWCTableEnvironment, scroll override: AWCTableScrollContext? = nil) -> some View {
        let scroll = override ?? self.scroll
        let model = gridModel(rows, env)
        let shown = model.shown, gridRows = model.rows, items = model.items
        let hover = hoveredRow(shown)
        let floors = headerFloors(shown)
        // Frozen grids are `min-inline-size: max(100%, min-width)` (no max-content floor).
        let minWidth = AWCTableTemplate.length(s("minWidth")) ?? hooks.minWidth ?? (b("frozenHeader") ? 0 : nil)
        AWCTableGridLayout(tracks: tracks(rows), rows: gridRows, minWidth: minWidth, rtl: rtl,
                           pinMode: s("pinMode", "stack"), scroll: scroll.offset, viewport: scroll.viewport, fill: scroll.fill,
                           floorRow: floors?.row, floorSkip: floors?.skip ?? [], floorExtra: floors?.extra ?? [:],
                           onResolve: { [geometry, runtime, pointer] g in
                               geometry.grid = g
                               for (i, r) in g.rows.enumerated() where i < shown.count { runtime.rowPitch[shown[i].id] = r.height }
                               // Chrome re-hit-tests hover after layout: the row now under a resting pointer is hovered.
                               let y = runtime.hoverPoint.flatMap { Self.visible($0, scroll) ? Double($0.y) : nil }
                                   ?? pointer?.location.flatMap { p in geometry.frame.contains(p) && (geometry.clip.map { $0.contains(p) } ?? true) ? Double(p.y - geometry.frame.minY) : nil }
                               let id = y.flatMap { Self.hit($0, g, shown) }
                               if id != runtime.hoverRow { DispatchQueue.main.async { if runtime.hoverRow != id { runtime.hoverRow = id } } }
                           }) {
            ForEach(items) { item in
                itemView(item, shown, rows, env, hover: hover)
                    .layoutValue(key: AWCTableGridItemKey.self, value: item.kind)
                    .zIndex(item.z)
            }
        }
        .awcCheckboxAppearance(env.metrics.compact ? .init(touchTargetSize: 32) : .init())
        // Expanded zone: opens on the spatial spring (500 ms), closes on the exit curve (200 ms) — md-table-row.css.
        // (Only for the same rows: a reorder or a page change is the FLIP's, not an expansion.)
        .animation(reduced ? nil : expandAnimation(shown.map(\.id), gridRows.map(\.expandedFraction)), value: zip(shown.map(\.id), gridRows.map(\.expandedFraction)).map { "\($0)=\($1)" })
        // FLIP (md-table.tsx armMotion → captureFlip): rows jump to the new order, then each glides from its old box.
        .onChange(of: shown.filter { $0.group == .body }.map(\.id)) { old, new in startFlip(old, new) }
        .onGeometryChange(for: CGRect.self) { $0.frame(in: .named("awc-native-preview")) } action: { geometry.frame = $0 }
        .onContinuousHover(coordinateSpace: .local) { phase in
            switch phase {
            case .active(let point):
                runtime.hoverPoint = point
                // Content scrolled out of the scrollport (under a scrollbar, past its edges) is not under the pointer.
                let id = Self.visible(point, scroll) ? hitRow(Double(point.y), shown) : nil
                if runtime.hoverRow != id { runtime.hoverRow = id }
            case .ended: runtime.hoverPoint = nil; runtime.hoverRow = nil
            }
        }
        .accessibilityElement(children: .contain)
    }

    func expandAnimation(_ ids: [String], _ fractions: [Double]) -> Animation? {
        if ids != runtime.lastExpandIDs { runtime.lastExpandIDs = ids; runtime.lastFractions = fractions; return nil }
        if fractions != runtime.lastFractions {
            if fractions.count == runtime.lastFractions.count { runtime.expandOpening = zip(fractions, runtime.lastFractions).contains { $0 > $1 } }
            runtime.lastFractions = fractions
        }
        return runtime.expandOpening ? .timingCurve(0.38, 1.21, 0.22, 1, duration: 0.5) : .timingCurve(0.3, 0, 0.8, 0.15, duration: 0.2)
    }
    /// captureFlip: the body-row change right after a sort / pagination event (or animateNextChange) plays — survivors that
    /// moved more than 6 px glide back from their old box, rows that appeared fade and drop in (18 ms stagger, capped at 6).
    func startFlip(_ old: [String], _ new: [String]) {
        guard !reduced, s("motion") != "none", runtime.armedUntil > CACurrentMediaTime(), !old.isEmpty, old != new else { return }
        func tops(_ ids: [String]) -> [String: Double] { var y = 0.0, out: [String: Double] = [:]; for id in ids { out[id] = y; y += runtime.rowPitch[id] ?? 53 }; return out }
        let before = tops(old), after = tops(new)
        runtime.flipToken += 1
        var flips: [String: AWCTableRuntime.Flip] = [:], movers = 0, entrants = 0
        for id in new {
            if let a = before[id], let b = after[id] {
                guard abs(a - b) > 6 else { continue }
                flips[id] = .init(token: runtime.flipToken, dy: a - b, delay: Double(Swift.min(movers, 6)) * 0.018, enter: false); movers += 1
            } else {
                flips[id] = .init(token: runtime.flipToken, dy: -8, delay: Double(Swift.min(entrants, 6)) * 0.018, enter: true); entrants += 1
            }
        }
        runtime.flips = flips
    }
    /// Frozen header with sort labels or pins: the first head row's cells floor their tracks (checkbox cells excepted).
    func headerFloors(_ shown: [AWCTableRowEntry]) -> (row: Int, skip: Set<Int>, extra: [Int: Double])? {
        guard b("frozenHeader"), let i = shown.firstIndex(where: { $0.group == .head }) else { return nil }
        let cells = shown[i].cells
        let hasLabels = cells.contains { c in c.children.contains { $0.tag == "md-table-sort-label" } }
        let hasPins = shown.contains { r in r.cells.contains { ["start", "end"].contains($0.properties["sticky"]?.string ?? "") } } || runtime.pinLayout != nil
        guard hasLabels || hasPins else { return nil }
        // The source measures the children's border boxes: a sort label overhangs its margin box by 4px per side.
        var skip: Set<Int> = [], extra: [Int: Double] = [:]
        for p in placements(shown[i]) {
            if p.cell.properties["padding"]?.string == "checkbox" { skip.insert(p.column) }
            if p.cell.children.contains(where: { $0.tag == "md-table-sort-label" }) { extra[p.column] = 8 }
        }
        return (i, skip, extra)
    }
    /// The hovered body row: real pointer hover, or the host pointer location mapped into the grid.
    func hoveredRow(_ shown: [AWCTableRowEntry]) -> String? {
        if runtime.hoverPoint != nil { return runtime.hoverRow }
        guard let p = pointer?.location, geometry.frame.contains(p), geometry.clip.map({ $0.contains(p) }) ?? true else { return nil }
        // (A relayout under a resting host pointer re-renders through runtime.hoverRow, set by the grid's resolve.)
        _ = runtime.hoverRow
        return hitRow(Double(p.y - geometry.frame.minY), shown)
    }
    /// Whether a grid-local point lies inside the enclosing scrollport (frozen body or container) at its current offsets.
    static func visible(_ p: CGPoint, _ scroll: AWCTableScrollContext) -> Bool {
        guard let vp = scroll.viewport else { return true }
        return Double(p.y) >= Double(scroll.offset.y) && Double(p.y) < Double(scroll.offset.y + vp.height)
    }
    /// The enabled body row under a grid-local y (current geometry).
    func hitRow(_ y: Double, _ shown: [AWCTableRowEntry]) -> String? { Self.hit(y, geometry.grid, shown) }
    static func hit(_ y: Double, _ g: AWCTableResolvedGrid, _ shown: [AWCTableRowEntry]) -> String? {
        guard let i = g.rows.indices.first(where: { y >= g.rows[$0].y && y < g.rows[$0].y + g.rows[$0].height }), i < shown.count,
              shown[i].group == .body, !shown[i].bool("disabled") else { return nil }
        return shown[i].id
    }
    struct Item: Identifiable { var id: String; var kind: AWCTableGridItem; var z: Double; var row: Int; var node: AWCNode? }
    func gridItems(_ rows: [AWCTableRowEntry], _ env: AWCTableEnvironment, skeletonRows: Int, columns: Int) -> [Item] {
        var out: [Item] = []
        for (i, r) in rows.enumerated() {
            let sticky = (r.group == .head && (b("stickyHeader") || b("frozenHeader"))) || (r.group == .foot && b("stickyFooter"))
            let lift = sticky ? 20.0 : 0
            out.append(.init(id: "chrome-" + r.id, kind: .chrome(row: i), z: lift, row: i, node: nil))
            for p in placements(r) {
                out.append(.init(id: "cell-" + p.cell.id, kind: .cell(row: i, column: p.column, span: p.span, pinned: p.pinned), z: lift + (p.pinned == nil ? 1 : 3), row: i, node: p.cell))
            }
            if r.bool("expandable") { out.append(.init(id: "expanded-" + r.id, kind: .expanded(row: i), z: lift + 1, row: i, node: nil)) }
            out.append(.init(id: "overlay-" + r.id, kind: .overlay(row: i), z: lift + 2, row: i, node: nil))
        }
        for k in 0..<skeletonRows {
            let row = rows.count + k
            out.append(.init(id: "sk-chrome-\(k)", kind: .chrome(row: row), z: 0, row: row, node: nil))
            for c in 0..<columns { out.append(.init(id: "sk-\(k)-\(c)", kind: .skeleton(row: row, column: c), z: 1, row: row, node: nil)) }
        }
        return out
    }

    @ViewBuilder func itemView(_ item: Item, _ shown: [AWCTableRowEntry], _ rows: [AWCTableRowEntry], _ env: AWCTableEnvironment, hover: String?) -> some View {
        switch item.kind {
        case .chrome(let r):
            if r < shown.count {
                AWCTableRowChrome(row: shown[r], index: r, env: env, selected: runtime.isSelected(shown[r]), hovered: hover == shown[r].id, last: false)
                    .modifier(AWCTableFlipEffect(flip: runtime.flips[shown[r].id], probe: ("order:" + shown[r].id, Double(shown[r].groupIndex), env.metrics.rowHeight + 1), motion: motion))
                    // The expanded zone's open fraction (probed on the always-present row box; the zone itself fades out).
                    .awcTableMotion("expand:" + shown[r].id, runtime.isExpanded(shown[r]) ? 1 : 0, motion)
            }
            else { AWCTableSkeletonChrome(env: env) }
        case .overlay(let r):
            AWCTableRowOverlay(row: shown[r], env: env, hovered: hover == shown[r].id,
                               activate: { rowClick(shown[r]) }, index: r, selected: runtime.isSelected(shown[r]), expanded: runtime.isExpanded(shown[r]),
                               ariaRowIndex: ariaRowIndex(shown[r], shown))
                .modifier(AWCTableFlipEffect(flip: runtime.flips[shown[r].id], probe: nil, motion: nil))
                .awcInspect(nodeID: shown[r].id, name: "md-table-row") { size in
                    ["group": .string(shown[r].group.rawValue), "selected": .bool(runtime.isSelected(shown[r])), "expanded": .bool(runtime.isExpanded(shown[r])),
                     "hovered": .bool(hover == shown[r].id), "height": .number(Double(size.height))]
                }
        case .expanded(let r):
            AWCTableExpandedZone(row: shown[r], env: env, open: runtime.isExpanded(shown[r]), theme: theme, onEvent: onEvent)
                .modifier(AWCTableFlipEffect(flip: runtime.flips[shown[r].id], probe: nil, motion: nil))
        case .cell(let r, let column, let span, let pinned):
            if let cell = item.node {
                AWCTableCellView(cell: cell, row: shown[r], rowIndex: r, env: env, pinned: pinned, selected: runtime.isSelected(shown[r]),
                                 hovered: hover == shown[r].id, theme: theme,
                                 checkboxState: checkboxState(shown[r], rows), onCheckbox: { checked in checkbox(shown[r], checked, rows) },
                                 expanded: runtime.isExpanded(shown[r]), onEvent: onEvent, column: column, span: span)
                    .modifier(AWCTableFlipEffect(flip: runtime.flips[shown[r].id], probe: nil, motion: nil))
            }
        case .skeleton:
            AWCTableSkeletonBar(env: env)
        }
    }

    /// aria-rowindex (md-table.tsx syncRows, with row-count set): 1-based, header rows first, body rows offset by row-offset,
    /// foot rows after the whole data set.
    func ariaRowIndex(_ row: AWCTableRowEntry, _ shown: [AWCTableRowEntry]) -> Int? {
        let count = Int(node.properties["rowCount"]?.number ?? 0); guard count > 0 else { return nil }
        let nHead = shown.filter { $0.group == .head }.count, offset = Int(node.properties["rowOffset"]?.number ?? 0)
        switch row.group { case .head: return row.groupIndex + 1; case .body: return nHead + offset + row.groupIndex + 1; case .foot: return nHead + count + row.groupIndex + 1 }
    }
    /// aria-rowcount: row-count plus the header and foot rows.
    func ariaRowCount(_ rows: [AWCTableRowEntry]) -> Int? {
        let count = Int(node.properties["rowCount"]?.number ?? 0)
        return count > 0 ? count + rows.filter { $0.group != .body }.count : nil
    }
    /// The select-all checkbox as shown (single mode: disabled and cleared, md-table.tsx syncSelectionUI).
    func selectAllBox(_ st: AWCTableSelectionState) -> [Bool] {
        selectionMode == "single" ? [false, false, true] : selectionMode == "none" ? [false, false, false] : [st.all, st.indeterminate, false]
    }
    /// Auto-wired selection checkbox state for a row (head: select-all, disabled in single mode).
    func checkboxState(_ row: AWCTableRowEntry, _ rows: [AWCTableRowEntry]) -> (checked: Bool, indeterminate: Bool, disabled: Bool)? {
        guard selectionMode != "none" else { return row.group == .head ? (false, false, false) : nil }
        if row.group == .head {
            if selectionMode == "single" { return (false, false, true) }
            let st = selectionState(rows); return (st.all, st.indeterminate, false)
        }
        guard row.group == .body else { return nil }
        return (runtime.isSelected(row), false, row.bool("disabled"))
    }
    func checkbox(_ row: AWCTableRowEntry, _ checked: Bool, _ rows: [AWCTableRowEntry]) {
        guard selectionMode != "none" else { return }
        if row.group == .head { if selectionMode == "multiple" { selectAll(checked, rows) }; return }
        guard row.group == .body, !row.bool("disabled"), row.bool("selectable", true) else { return }
        setSelected(row, checked, rows)
    }
    func rowClick(_ row: AWCTableRowEntry) {
        guard row.bool("clickable"), !row.bool("disabled") else { return }
        if rowFocus.handles[row.id]?.isFocused != true { _ = rowFocus.handles[row.id]?.requestPointerFocus?() }
        emit("mdRowClick", ["value": .string(row.identity), "row": .string(row.id)], tag: "md-table-row", id: row.id)
    }

    // MARK: Frozen header

    /// `frozen-header`: the head stays put while the body scrolls on both axes inside --md-table-body-max-h; custom overlay
    /// bars (scrollbar="overlay") or the platform's indicators in a reserved gutter (scrollbar="gutter").
    @ViewBuilder func frozen(_ rows: [AWCTableRowEntry], _ env: AWCTableEnvironment) -> some View {
        let m = env.metrics
        let headBox = Double(rows.filter { $0.group == .head }.count) * (m.headHeight + 1)
        let bodyMax = hooks.bodyMaxHeight ?? container.bodyMaxHeight ?? .infinity
        let bodyContent = Swift.max(0, Double(frozenContent.height) - headBox)
        let bodyHeight = Swift.max(b("keepHeight", true) ? Double(heightFloor ?? 0) : 0, Swift.min(bodyMax, bodyContent))
        let _ = { geometry.lastHeight = CGFloat(Swift.min(bodyMax, bodyContent)) }()
        let gutter = s("scrollbar") == "gutter"
        let overflowX = Double(frozenContent.width) > Double(frozenViewport.width) + 0.5 && frozenViewport.width > 0
        let overflowY = bodyContent > bodyHeight + 0.5
        let controller = scrollController ?? ownScroller
        let covered = geometry.grid.pinnedRanges(scrollX: Double(frozenOffset.x), viewport: Double(frozenViewport.width))
        VStack(spacing: 0) {
            ScrollView([.horizontal, .vertical]) {
                VStack(spacing: 0) {
                    grid(rows, env, scroll: .init(offset: frozenOffset, viewport: frozenViewport == .zero ? nil : frozenViewport, fill: frozenViewport.width > 0 ? Double(frozenViewport.width) : nil))
                    if b("empty") && !loading { emptyState(m) }
                }
                // The scrollport itself scrolls in physical (left-to-right) coordinates; the grid inside keeps the table's
                // direction, so a right-to-left grid's inline start is the physical right edge: the bridge maps logical offsets
                // (rtlOverride) and starts the body there, like the source's scrollLeft 0.
                .environment(\.layoutDirection, rtl ? .rightToLeft : .leftToRight)
                .onGeometryChange(for: CGRect.self) { $0.frame(in: .named("awc-table-frozen")) } action: { frame in
                    frozenContent = frame.size
                    // The scroll view's own offsets are authoritative (a right-to-left grid reports its frame mirrored); the
                    // content frame is the fallback until the bridge attaches.
                    let physicalX = -Double(frame.minX), maxX = Swift.max(0, Double(frame.width - frozenViewport.width))
                    var next = CGPoint(x: Swift.max(0, rtl ? maxX - physicalX : physicalX), y: Swift.max(0, -Double(frame.minY)))
                    if let p = AWCTableScrollController.position(of: geometry.port.port, rtl: rtl) { next = CGPoint(x: p.x, y: p.y) }
                    // Applied on the next turn of the run loop: a state change made inside the geometry pass waits for the next
                    // display update, which an idle scroll (no other change) does not request.
                    DispatchQueue.main.async {
                        guard next != frozenOffset else { return }
                        frozenOffset = next
                        // mdScroll (the source emits once per frame from the body scroller; RTL scrollLeft runs negative).
                        emit("mdScroll", ["scrollLeft": .number(rtl ? -Double(next.x) : Double(next.x)), "scrollTop": .number(Double(next.y))])
                    }
                }
                .background { AWCTableScrollBridge(controller: controller, rtlOverride: rtl, portBox: geometry.port) }
            }
            .environment(\.layoutDirection, .leftToRight)
            .coordinateSpace(name: "awc-table-frozen")
            .scrollIndicators(gutter ? .visible : .hidden, axes: [.horizontal, .vertical])
            .scrollBounceBehavior(.basedOnSize)
            .onGeometryChange(for: CGSize.self) { $0.size } action: { frozenViewport = $0 }
            .onGeometryChange(for: CGRect.self) { $0.frame(in: .named("awc-native-preview")) } action: { geometry.clip = $0 }
            .frame(height: CGFloat(headBox + bodyHeight))
            .overlay(alignment: .topLeading) {
                // The body scroller is a keyboard tab stop (WAI scrollable region) with an inset 2px secondary ring.
                Color.clear
                    .frame(height: CGFloat(Swift.max(1, bodyHeight)))
                    // The ring is the body scroller's outline: Chrome paints it under the sticky pinned cells.
                    .overlay { if bodyFocus.isFocusVisible { Rectangle().inset(by: 1).stroke(env.palette.color("secondary"), lineWidth: 2).mask(AWCTableUncovered(ranges: covered, width: Double(frozenViewport.width), rtl: rtl).environment(\.layoutDirection, .leftToRight)) } }
                    .background {
                        AWCNativeButtonFocusBridge(configuration: .init(id: node.id + "-body", label: s("label").isEmpty ? "Table body" : s("label"),
                            policy: AWCButtonAccessibilityPolicy(properties: [:]), group: nil, cell: nil, handle: bodyFocus, focusChanged: { _ in }, activate: {},
                            routeKey: { key, shift, modified in AWCTableBodyKeys.route(key, shift: shift, modified: modified, controller: controller, pageHeight: bodyHeight, rtl: false) }))
                    }
                    .padding(.top, CGFloat(headBox))
                    .allowsHitTesting(false)
                    #if os(iOS)
                    // UIKit hands Page Up / Page Down to the responder chain's key commands, not to the focus view's key route.
                    .background {
                        if bodyFocus.isFocused {
                            Group {
                                Button("") { _ = AWCTableBodyKeys.route("PageDown", shift: false, modified: false, controller: controller, pageHeight: bodyHeight, rtl: false) }
                                    .keyboardShortcut(.pageDown, modifiers: [])
                                Button("") { _ = AWCTableBodyKeys.route("PageUp", shift: false, modified: false, controller: controller, pageHeight: bodyHeight, rtl: false) }
                                    .keyboardShortcut(.pageUp, modifiers: [])
                            }
                            .frame(width: 0, height: 0).opacity(0).accessibilityHidden(true)
                        }
                    }
                    #endif
                    .awcInspect(nodeID: node.id, part: "body-scroll", name: "body-scroll") { _ in ["focused": .bool(bodyFocus.isFocused), "focusRing": .bool(bodyFocus.isFocusVisible)] }
            }
            .overlay(alignment: .topTrailing) {
                if !gutter && overflowY && bodyHeight > 0 {
                    let thumb = Swift.max(24, bodyHeight * bodyHeight / Swift.max(1, bodyContent))
                    let travel = bodyHeight - thumb, progress = Double(frozenOffset.y) / Swift.max(1, bodyContent - bodyHeight)
                    ZStack(alignment: .top) {
                        Capsule().fill(scrollThumb(env, vertical: true)).frame(width: 8, height: thumb).offset(y: travel * Swift.min(1, progress))
                    }
                    .frame(width: 8, height: bodyHeight, alignment: .top)
                    .padding(.top, headBox).padding(.trailing, 3)
                    .allowsHitTesting(false).accessibilityHidden(true)
                }
            }
            if !gutter && overflowX {
                GeometryReader { box in
                    let track = Double(box.size.width), vw = Double(frozenViewport.width), cw = Swift.max(1, Double(frozenContent.width))
                    let thumb = Swift.max(24, track * vw / cw), progress = Double(frozenOffset.x) / Swift.max(1, cw - vw)
                    // Laid out physically (left-to-right): a right-to-left thumb starts at the right end and travels left.
                    let travel = (track - thumb) * Swift.min(1, progress)
                    // A host-supplied pointer (Laboratory, tests) releases the thumb with its own pointer-up, ahead of the gesture's end.
                    let pressed = thumbPressed && (pointer?.isPointerDown ?? true)
                    Capsule().fill(pressed && !env.forcedColors ? env.palette.color("on-surface-variant") : scrollThumb(env, vertical: false)).frame(width: thumb, height: 8)
                        .awcTableMotion("thumb:" + node.id, pressed ? 1 : 0, motion)
                        .awcInspect(nodeID: node.id, part: "hthumb", name: "hthumb") { _ in ["pressed": .bool(pressed)] }
                        .animation(reduced ? nil : .timingCurve(0.31, 0.94, 0.34, 1, duration: 0.15), value: pressed)
                        .offset(x: rtl ? track - thumb - travel : travel, y: 1)
                        // The thumb drags the body (pointer only; the body is the keyboard tab stop).
                        .gesture(DragGesture(minimumDistance: 0, coordinateSpace: .global)
                            .onChanged { g in
                                if thumbDragStart == nil { thumbDragStart = Double(frozenOffset.x); thumbPressed = true }
                                let ratio = (cw - vw) / Swift.max(1, track - thumb), dx = Double(g.translation.width) * (rtl ? -1 : 1)
                                _ = controller.scroll(x: (thumbDragStart ?? 0) + dx * ratio, y: nil)
                            }
                            .onEnded { _ in thumbDragStart = nil; thumbPressed = false })
                }
                .environment(\.layoutDirection, .leftToRight)
                .frame(height: 10).padding(.vertical, 2).padding(.horizontal, 8)
                .accessibilityHidden(true)
            }
        }
        .awcInspect(nodeID: node.id, part: "frozen", name: "frozen") { _ in
            ["scrollLeft": .number(Double(frozenOffset.x)), "scrollTop": .number(Double(frozenOffset.y)), "bodyHeight": .number(bodyHeight), "overflowX": .bool(overflowX), "overflowY": .bool(overflowY)]
        }
    }
    func scrollThumb(_ env: AWCTableEnvironment, vertical: Bool) -> Color {
        if env.forcedColors { return env.palette.color("on-surface") }
        return vertical ? AWCTableColor.color(AWCTableColor.mix(env.palette.hex("on-surface"), 0.5, nil)) : env.palette.color("outline")
    }

    // MARK: Loading and empty

    @ViewBuilder func loadingOverlay(_ m: AWCTableMetrics) -> some View {
        // `loader` (or the older `loading`) replaces the progress line and scrim; `loader` wins when both are given.
        let loader = node.children.filter { $0.slot == "loader" }, legacy = node.children.filter { $0.slot == "loading" }
        let custom = loader.isEmpty ? legacy : loader
        if !custom.isEmpty {
            VStack(alignment: .leading, spacing: 0) { ForEach(custom) { AWCTableSlotContent(node: $0, theme: theme, color: palette.color("on-surface"), metrics: m, onEvent: onEvent) } }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                .allowsHitTesting(false)
        } else {
        GeometryReader { box in
            let top = m.headHeight
            // The scrim follows the progress line in the source's DOM order, so it dims the line too.
            ZStack(alignment: .topLeading) {
                AWCNativeProgressIndicator(nodeID: node.id + "-progress", properties: ["variant": "linear", "indeterminate": true, "ariaLabel": "Loading"], theme: theme, onComplete: {})
                    .frame(width: box.size.width).offset(y: top)
                Rectangle().fill(AWCTableColor.color(AWCTableColor.mix(palette.hex("surface"), 0.55, nil)))
                    .frame(width: box.size.width, height: Swift.max(0, box.size.height - top)).offset(y: top)
            }
        }
        .accessibilityHidden(true)
        }
    }
    @ViewBuilder func emptyState(_ m: AWCTableMetrics) -> some View {
        let slotted = node.children.filter { $0.slot == "empty" }
        VStack(spacing: 0) {
            if slotted.isEmpty {
                AWCListText(text: "No data", size: m.fontSize, lineHeight: m.lineHeight, weight: 400, tracking: 0.25, color: palette.color("on-surface-variant"), alignment: .center)
            } else {
                ForEach(slotted) { AWCTableSlotContent(node: $0, theme: theme, color: palette.color("on-surface-variant"), metrics: m, onEvent: onEvent) }
            }
        }
        .padding(.vertical, 32).padding(.horizontal, m.padInline)
        .frame(maxWidth: .infinity, minHeight: hooks.emptyMinHeight ?? 160)
        .accessibilityElement(children: .combine)
    }
}

extension Int { func clamped(_ lo: Int, _ hi: Int) -> Int { Swift.min(hi, Swift.max(lo, self)) } }
