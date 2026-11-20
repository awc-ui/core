import SwiftUI
import Observation

// MARK: Grid layout

/// What a subview of the table grid is.
enum AWCTableGridItem: Equatable {
    case chrome(row: Int)                      // row background + divider (under cells)
    case cell(row: Int, column: Int, span: Int, pinned: String?)
    case overlay(row: Int)                     // hover layer + focus ring (over unpinned cells)
    case expanded(row: Int)                    // expandable row's detail zone (inside the row box)
    case skeleton(row: Int, column: Int)       // loading-mode="skeleton" bar
}
struct AWCTableGridItemKey: LayoutValueKey { static let defaultValue: AWCTableGridItem = .chrome(row: -1) }

/// Per-row facts the layout needs (min height, divider edges, sticky).
struct AWCTableGridRow: Equatable {
    var minHeight: Double
    var borderTop: Double, borderBottom: Double
    var stickyTop: Bool, stickyBottom: Bool
    var expandedFraction: Double
}

/// The single grid every row subgrids into (md-table.css `.md-table__grid`): shared column tracks from the template,
/// rows as full-width boxes (cells + optional expanded zone + border), pinned cells and sticky head / foot rows
/// following the enclosing scroll offsets.
struct AWCTableGridLayout: Layout {
    var tracks: [AWCTableTrack]
    var rows: [AWCTableGridRow]
    var minWidth: Double?
    var rtl: Bool
    var pinMode: String
    /// Scroll offsets of the enclosing scrollport (logical: inline-start = 0) and its size.
    var scroll: CGPoint = .zero
    var viewport: CGSize? = nil
    /// The scrollport's width when the grid sits in a horizontal scroller (the grid fills at least that width).
    var fill: Double? = nil
    /// Frozen header with sort labels / pins (md-table.tsx syncHeaderContentFloors): each head cell's content floors its track.
    var floorRow: Int? = nil
    var floorSkip: Set<Int> = []
    var floorExtra: [Int: Double] = [:]
    var onResolve: ((AWCTableResolvedGrid) -> Void)? = nil

    /// What the subviews measure (until they change): a horizontal scroller (md-table-container) sizes its content at the
    /// viewport width and at the content's own width in every layout pass, so a single-width cache missed on nearly every call
    /// and re-measured every cell twice per pass (tb-contract: the container's frames took 40–50 ms during a sort).
    struct Cache {
        /// Each cell's min- / max-content contribution and the head-floored tracks: they depend on the subviews, not on the width.
        var items: [AWCTableContribution]? = nil, resolvedTracks: [AWCTableTrack] = []
        /// The grid's floor (min-inline-size: the explicit min width, else max-content): any available width below it solves alike.
        var floor = 0.0
        /// Column solutions by available width.
        var solved: [Double: ([Double], Double)] = [:]
        /// Row boxes by column widths, for the rows they were measured with.
        var boxes: [[Double]: [(y: Double, cells: Double, expanded: Double, height: Double)]] = [:], boxRows: [AWCTableGridRow] = []
    }
    func makeCache(subviews: Subviews) -> Cache { .init() }
    func updateCache(_ cache: inout Cache, subviews: Subviews) { cache = .init() }

    func columns(_ available: Double, _ subviews: Subviews, _ cache: inout Cache) -> ([Double], Double) {
        if cache.items == nil {
            // A cell's min-content width only sizes a track whose minimum or maximum is min-content / fit-content (the solver reads
            // nothing else of it): measured only there — measuring every cell at zero width doubled the cost of each re-layout.
            func readsMinContent(_ start: Int, _ span: Int) -> Bool {
                (start..<Swift.min(tracks.count, start + span)).contains { i in
                    if case .minContent = tracks[i].min { return true }
                    switch tracks[i].max { case .minContent, .fitContent: return true; default: return false }
                }
            }
            var items: [AWCTableContribution] = [], maxContent: [Int: Double] = [:]
            for (k, s) in subviews.enumerated() {
                guard case .cell(_, let column, let span, _) = s[AWCTableGridItemKey.self] else { continue }
                let maxW = Double(s.sizeThatFits(.unspecified).width)
                let minW = readsMinContent(column, span) ? Double(s.sizeThatFits(.init(width: 0, height: nil)).width) : maxW
                items.append(.init(start: column, span: span, minContent: minW, maxContent: maxW)); maxContent[k] = maxW
            }
            var resolvedTracks = tracks
            if let floorRow {
                for (k, s) in subviews.enumerated() {
                    guard case .cell(floorRow, let column, 1, _) = s[AWCTableGridItemKey.self], column < tracks.count, !floorSkip.contains(column) else { continue }
                    let need = ((maxContent[k] ?? Double(s.sizeThatFits(.unspecified).width)) + (floorExtra[column] ?? 0)).rounded(.up)
                    resolvedTracks[column] = AWCTableTemplate.floored(tracks[column], need)
                }
            }
            cache.items = items; cache.resolvedTracks = resolvedTracks
            cache.floor = minWidth ?? AWCTableColumnSolver.maxContentWidth(resolvedTracks, items: items)
        }
        // AWCTableColumnSolver.solve sizes the tracks for max(available, floor): an overflowing grid (the scroller's viewport width,
        // the content width and its pixel-rounded value) is one solution.
        let key = tracks.isEmpty ? available : Swift.max(available, cache.floor)
        if let hit = cache.solved[key] { return hit }
        let solved = AWCTableColumnSolver.solve(cache.resolvedTracks, items: cache.items ?? [], available: key, minWidth: minWidth)
        if cache.solved.count >= 8 { cache.solved.removeAll() }
        cache.solved[key] = (solved.widths, solved.width)
        return (solved.widths, solved.width)
    }
    func x(_ widths: [Double], _ column: Int) -> Double { widths.prefix(Swift.max(0, column)).reduce(0, +) }
    func spanWidth(_ widths: [Double], _ column: Int, _ span: Int) -> Double {
        guard column < widths.count else { return 0 }
        return widths[column..<Swift.min(widths.count, column + span)].reduce(0, +)
    }
    /// Row boxes: y, cell height, expanded height, total height.
    func rowBoxes(_ widths: [Double], _ subviews: Subviews, _ cache: inout Cache) -> [(y: Double, cells: Double, expanded: Double, height: Double)] {
        if cache.boxRows != rows { cache.boxes.removeAll(); cache.boxRows = rows }
        if let hit = cache.boxes[widths] { return hit }
        var cellHeights = rows.map { $0.minHeight }, expanded = [Double](repeating: 0, count: rows.count)
        for s in subviews {
            switch s[AWCTableGridItemKey.self] {
            case .cell(let row, let column, let span, _) where row < rows.count:
                let h = Double(s.sizeThatFits(.init(width: spanWidth(widths, column, span), height: nil)).height)
                cellHeights[row] = Swift.max(cellHeights[row], h)
            case .expanded(let row) where row < rows.count:
                let h = Double(s.sizeThatFits(.init(width: widths.reduce(0, +), height: nil)).height)
                expanded[row] = h * rows[row].expandedFraction
            default: break
            }
        }
        var y = 0.0, out: [(y: Double, cells: Double, expanded: Double, height: Double)] = []
        for i in rows.indices {
            let h = rows[i].borderTop + cellHeights[i] + expanded[i] + rows[i].borderBottom
            out.append((y, cellHeights[i], expanded[i], h)); y += h
        }
        if cache.boxes.count >= 8 { cache.boxes.removeAll() }
        cache.boxes[widths] = out
        return out
    }
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout Cache) -> CGSize {
        let available = Swift.max(proposal.width.map(Double.init) ?? 0, fill ?? 0)
        let (widths, width) = columns(available.isFinite ? available : 0, subviews, &cache)
        let boxes = rowBoxes(widths, subviews, &cache)
        return .init(width: Swift.max(Double(proposal.width ?? 0), width), height: boxes.last.map { $0.y + $0.height } ?? 0)
    }
    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout Cache) {
        let (widths, gridWidth) = columns(Swift.max(Double(bounds.width), fill ?? 0), subviews, &cache)
        let boxes = rowBoxes(widths, subviews, &cache)
        let total = boxes.last.map { $0.y + $0.height } ?? 0
        // Pinned offsets (pin-mode="static": cumulative widths of earlier pins in the row).
        var startOffsets: [Int: [Int: Double]] = [:], endOffsets: [Int: [Int: Double]] = [:]
        if pinMode == "static" {
            var byRow: [Int: [(Int, Int, String)]] = [:]
            for s in subviews { if case .cell(let r, let c, let span, let pin?) = s[AWCTableGridItemKey.self] { byRow[r, default: []].append((c, span, pin)) } }
            for (r, cells) in byRow {
                var cum = 0.0
                for (c, span, pin) in cells.sorted(by: { $0.0 < $1.0 }) where pin == "start" { startOffsets[r, default: [:]][c] = cum; cum += spanWidth(widths, c, span) }
                cum = 0
                for (c, span, pin) in cells.sorted(by: { $0.0 > $1.0 }) where pin == "end" { endOffsets[r, default: [:]][c] = cum; cum += spanWidth(widths, c, span) }
            }
        }
        let viewW = Double(viewport?.width ?? bounds.width), viewH = Double(viewport?.height ?? CGFloat(total))
        // SwiftUI mirrors custom layouts under a right-to-left layout direction: place in logical (leading-origin) space.
        func place(_ s: LayoutSubview, x: Double, y: Double, w: Double, h: Double) {
            let px = Double(bounds.minX) + x
            s.place(at: .init(x: px, y: Double(bounds.minY) + y), anchor: .topLeading, proposal: .init(width: w, height: h))
        }
        func stickyY(_ row: Int) -> Double {
            let b = boxes[row], r = rows[row]
            if r.stickyTop { return Swift.max(b.y, Swift.min(Double(scroll.y), total - b.height)) }
            if r.stickyBottom { return Swift.min(b.y, Swift.max(0, Double(scroll.y) + viewH - b.height)) }
            return b.y
        }
        var resolved = AWCTableResolvedGrid(widths: widths, width: gridWidth, rows: [])
        for (i, b) in boxes.enumerated() { resolved.rows.append(.init(y: stickyY(i), height: b.height, cells: b.cells)) }
        // Pinned columns (first row that pins them): natural x, width, side and static offset, for painting what they cover.
        var seen: Set<Int> = []
        for s in subviews {
            guard case .cell(let row, let column, let span, let pin?) = s[AWCTableGridItemKey.self], row < rows.count, !seen.contains(column) else { continue }
            seen.insert(column)
            let off = pin == "start" ? (startOffsets[row]?[column] ?? 0) : (endOffsets[row]?[column] ?? 0)
            resolved.pins.append(.init(x: x(widths, column), width: spanWidth(widths, column, span), end: pin == "end", offset: off))
        }
        for s in subviews {
            switch s[AWCTableGridItemKey.self] {
            case .chrome(let row) where row >= 0 && row < rows.count:
                place(s, x: 0, y: stickyY(row), w: gridWidth, h: boxes[row].height)
            case .overlay(let row) where row < rows.count:
                place(s, x: 0, y: stickyY(row), w: gridWidth, h: boxes[row].height)
            case .expanded(let row) where row < rows.count:
                let b = boxes[row]
                place(s, x: 0, y: stickyY(row) + rows[row].borderTop + b.cells, w: gridWidth, h: Swift.max(0, b.expanded))
            case .cell(let row, let column, let span, let pin) where row < rows.count:
                let w = spanWidth(widths, column, span)
                var cx = x(widths, column)
                if pin == "start" { cx = Swift.min(Swift.max(cx, Double(scroll.x) + (startOffsets[row]?[column] ?? 0)), gridWidth - w) }
                if pin == "end" { cx = Swift.max(Swift.min(cx, Double(scroll.x) + viewW - (endOffsets[row]?[column] ?? 0) - w), 0) }
                place(s, x: cx, y: stickyY(row) + rows[row].borderTop, w: w, h: boxes[row].cells)
            case .skeleton(let row, let column) where row < rows.count:
                place(s, x: x(widths, column), y: stickyY(row) + rows[row].borderTop, w: spanWidth(widths, column, 1), h: boxes[row].cells)
            default: break
            }
        }
        onResolve?(resolved)
    }
}

/// Resolved geometry the grid reports after placement (hover hit-testing, inspection).
struct AWCTableResolvedGrid: Equatable {
    struct Row: Equatable { var y: Double, height: Double, cells: Double }
    struct Pin: Equatable { var x: Double, width: Double, end: Bool, offset: Double }
    var widths: [Double], width: Double, rows: [Row]
    var pins: [Pin] = []
    /// The logical inline ranges (relative to the scrollport's inline start) the pinned columns cover at a scroll offset.
    func pinnedRanges(scrollX: Double, viewport: Double) -> [ClosedRange<Double>] {
        pins.map { p in
            var cx = p.x
            if p.end { cx = Swift.max(Swift.min(cx, scrollX + viewport - p.offset - p.width), 0) }
            else { cx = Swift.min(Swift.max(cx, scrollX + p.offset), width - p.width) }
            return (cx - scrollX)...(cx - scrollX + p.width)
        }
    }
}

/// What the pinned columns leave visible of a scrollport-wide paint (the frozen body's focus ring): the complement of the
/// covered logical ranges, drawn physically (right-to-left ranges are measured from the right edge).
struct AWCTableUncovered: Shape {
    let ranges: [ClosedRange<Double>]
    let width: Double
    let rtl: Bool
    func path(in rect: CGRect) -> Path {
        let w = width > 0 ? width : Double(rect.width)
        let physical = ranges.map { r in rtl ? (w - r.upperBound)...(w - r.lowerBound) : r }.sorted { $0.lowerBound < $1.lowerBound }
        var merged: [ClosedRange<Double>] = []
        for r in physical {
            if let last = merged.last, r.lowerBound <= last.upperBound { merged[merged.count - 1] = last.lowerBound...Swift.max(last.upperBound, r.upperBound) }
            else { merged.append(r) }
        }
        var p = Path(), x = Double(rect.minX)
        for r in merged {
            let lo = Double(rect.minX) + r.lowerBound
            if lo > x { p.addRect(CGRect(x: x, y: Double(rect.minY), width: lo - x, height: Double(rect.height))) }
            x = Swift.max(x, Double(rect.minX) + r.upperBound)
        }
        if Double(rect.maxX) > x { p.addRect(CGRect(x: x, y: Double(rect.minY), width: Double(rect.maxX) - x, height: Double(rect.height))) }
        return p
    }
}
