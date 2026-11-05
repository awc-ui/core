import SwiftUI

// MARK: Column template (md-table `column-template` / `columns` / derived count)

/// Minimum sizing function of one grid track (CSS Grid `minmax()` first argument).
enum AWCTableTrackMin: Equatable { case px(Double), percent(Double), auto, minContent, maxContent }
/// Maximum sizing function of one grid track.
enum AWCTableTrackMax: Equatable { case px(Double), percent(Double), fr(Double), auto, minContent, maxContent, fitContent(Double) }
struct AWCTableTrack: Equatable {
    var min: AWCTableTrackMin, max: AWCTableTrackMax
    var isFlexible: Bool { if case .fr = max { return true }; return false }
    var flex: Double { if case .fr(let f) = max { return f }; return 0 }
}

/// `grid-template-columns` subset used by md-table: px / % / fr / auto / min- and max-content,
/// `minmax(a, b)`, `max(Npx, a)` floors (md-table.tsx floorTrack), `fit-content(Npx)` and `repeat(n, …)`.
enum AWCTableTemplate {
    static func parse(_ raw: String) -> [AWCTableTrack]? {
        let tokens = split(raw.trimmingCharacters(in: .whitespacesAndNewlines))
        guard !tokens.isEmpty else { return nil }
        var out: [AWCTableTrack] = []
        for token in tokens {
            if token.hasPrefix("repeat(") && token.hasSuffix(")") {
                let inner = String(token.dropFirst(7).dropLast())
                guard let comma = topLevelComma(inner), let n = Int(inner[..<comma].trimmingCharacters(in: .whitespaces)), n > 0, n <= 1000,
                      let tracks = parse(String(inner[inner.index(after: comma)...])) else { return nil }
                for _ in 0..<n { out += tracks }
            } else if let t = track(token) { out.append(t) } else { return nil }
        }
        return out
    }
    static func track(_ token: String) -> AWCTableTrack? {
        let t = token.trimmingCharacters(in: .whitespaces).lowercased()
        if t.hasPrefix("minmax(") && t.hasSuffix(")") {
            let inner = String(t.dropFirst(7).dropLast())
            guard let comma = topLevelComma(inner), let lo = minimum(String(inner[..<comma])), let hi = maximum(String(inner[inner.index(after: comma)...])) else { return nil }
            return .init(min: lo, max: hi)
        }
        if t.hasPrefix("fit-content(") && t.hasSuffix(")") {
            guard let px = length(String(t.dropFirst(12).dropLast())) else { return nil }
            return .init(min: .auto, max: .fitContent(px))
        }
        if let f = fr(t) { return .init(min: .auto, max: .fr(f)) }
        guard let hi = maximum(t), let lo = minimum(t) else { return nil }
        return .init(min: lo, max: hi)
    }
    /// `max(Npx, a)` (a header floor) keeps the larger fixed minimum; a keyword `a` is replaced by N.
    static func minimum(_ raw: String) -> AWCTableTrackMin? {
        let t = raw.trimmingCharacters(in: .whitespaces)
        if t.hasPrefix("max(") && t.hasSuffix(")") {
            let inner = String(t.dropFirst(4).dropLast())
            guard let comma = topLevelComma(inner), let n = length(String(inner[..<comma])) else { return nil }
            let other = minimum(String(inner[inner.index(after: comma)...]))
            if case .px(let a)? = other { return .px(Swift.max(n, a)) }
            return .px(n)
        }
        switch t {
        case "auto": return .auto
        case "min-content": return .minContent
        case "max-content": return .maxContent
        default:
            if t.hasSuffix("%"), let p = Double(t.dropLast()) { return .percent(p) }
            return length(t).map { .px($0) }
        }
    }
    static func maximum(_ raw: String) -> AWCTableTrackMax? {
        let t = raw.trimmingCharacters(in: .whitespaces)
        if let f = fr(t) { return .fr(f) }
        if t.hasPrefix("fit-content(") && t.hasSuffix(")") { return length(String(t.dropFirst(12).dropLast())).map { .fitContent($0) } }
        switch t {
        case "auto": return .auto
        case "min-content": return .minContent
        case "max-content": return .maxContent
        default:
            if t.hasSuffix("%"), let p = Double(t.dropLast()) { return .percent(p) }
            return length(t).map { .px($0) }
        }
    }
    /// md-table floorTrack: `minmax(max(N, a), b)`; keyword minimums become N; fit-content tracks are not floored.
    static func floored(_ t: AWCTableTrack, _ need: Double) -> AWCTableTrack {
        if case .fitContent = t.max { return t }
        switch t.min {
        case .px(let v): return .init(min: .px(Swift.max(v, need)), max: t.max)
        default: return .init(min: .px(need), max: t.max)
        }
    }
    static func fr(_ t: String) -> Double? { t.hasSuffix("fr") ? Double(t.dropLast(2)).flatMap { $0 >= 0 ? $0 : nil } : nil }
    static func length(_ raw: String) -> Double? {
        let t = raw.trimmingCharacters(in: .whitespaces)
        if t == "0" { return 0 }
        if t.hasSuffix("px"), let v = Double(t.dropLast(2)), v >= 0 { return v }
        if t.hasSuffix("rem"), let v = Double(t.dropLast(3)), v >= 0 { return v * 16 }
        if t.hasSuffix("em"), let v = Double(t.dropLast(2)), v >= 0 { return v * 14 }
        return nil
    }
    static func split(_ s: String) -> [String] {
        var out: [String] = [], cur = "", depth = 0
        for ch in s {
            if ch == "(" { depth += 1 } else if ch == ")" { depth -= 1 }
            if ch.isWhitespace && depth == 0 { if !cur.isEmpty { out.append(cur); cur = "" } } else { cur.append(ch) }
        }
        if !cur.isEmpty { out.append(cur) }
        return out
    }
    static func topLevelComma(_ s: String) -> String.Index? {
        var depth = 0
        for i in s.indices { let ch = s[i]; if ch == "(" { depth += 1 } else if ch == ")" { depth -= 1 } else if ch == "," && depth == 0 { return i } }
        return nil
    }
}

/// One grid item's contribution: the columns it spans and its min-/max-content outer widths.
struct AWCTableContribution: Equatable { var start: Int, span: Int, minContent: Double, maxContent: Double }

/// CSS Grid track sizing (css-grid-1 §11) for one axis with a definite container width, as md-table uses it:
/// the grid is `min-inline-size: var(--_min-width, max-content)` inside a 100%-wide host.
enum AWCTableColumnSolver {
    /// Returns resolved track widths and the grid width (≥ available; overflow scrolls).
    static func solve(_ tracks: [AWCTableTrack], items: [AWCTableContribution], available: Double, minWidth: Double?) -> (widths: [Double], width: Double) {
        guard !tracks.isEmpty else { return ([], available) }
        let floor = minWidth ?? maxContentWidth(tracks, items: items)
        let width = Swift.max(available, floor)
        return (size(tracks, items: items, space: width), width)
    }
    /// The grid's max-content inline size (free space indefinite).
    static func maxContentWidth(_ tracks: [AWCTableTrack], items: [AWCTableContribution]) -> Double {
        var (base, limit) = intrinsic(tracks, items: items, space: nil)
        for i in tracks.indices where !tracks[i].isFlexible && limit[i].isFinite { base[i] = Swift.max(base[i], limit[i]) }
        let flexible = tracks.indices.filter { tracks[$0].isFlexible }
        if !flexible.isEmpty {
            var fraction = 0.0
            for i in flexible { let f = tracks[i].flex; fraction = Swift.max(fraction, f > 1 ? base[i] / f : base[i]) }
            for item in items where (item.start..<item.start + item.span).contains(where: { tracks.indices.contains($0) && tracks[$0].isFlexible }) {
                let range = (item.start..<Swift.min(tracks.count, item.start + item.span))
                fraction = Swift.max(fraction, frSize(range.map { $0 }, tracks: tracks, base: base, space: item.maxContent))
            }
            for i in flexible { base[i] = Swift.max(base[i], fraction * tracks[i].flex) }
        }
        return base.reduce(0, +)
    }
    static func size(_ tracks: [AWCTableTrack], items: [AWCTableContribution], space: Double) -> [Double] {
        var (base, limit) = intrinsic(tracks, items: items, space: space)
        // Maximize tracks: distribute free space equally to non-flexible tracks up to their growth limits.
        var free = space - base.reduce(0, +)
        var growable = tracks.indices.filter { !tracks[$0].isFlexible && limit[$0] > base[$0] }
        while free > 1e-9 && !growable.isEmpty {
            let share = free / Double(growable.count)
            var next: [Int] = []
            for i in growable { let add = Swift.min(share, limit[i] - base[i]); base[i] += add; free -= add; if limit[i] - base[i] > 1e-9 { next.append(i) } }
            if next.count == growable.count && share <= 1e-9 { break }
            growable = next
        }
        // Expand flexible tracks.
        let flexible = tracks.indices.filter { tracks[$0].isFlexible }
        if !flexible.isEmpty {
            let fixed = tracks.indices.filter { !tracks[$0].isFlexible }.reduce(0.0) { $0 + base[$1] }
            let fraction = frSize(flexible, tracks: tracks, base: base, space: space - fixed)
            for i in flexible { base[i] = Swift.max(base[i], fraction * tracks[i].flex) }
        } else {
            // Stretch `auto` tracks (justify-content: normal).
            let autos = tracks.indices.filter { if case .auto = tracks[$0].max { return true }; return false }
            let left = space - base.reduce(0, +)
            if left > 0 && !autos.isEmpty { for i in autos { base[i] += left / Double(autos.count) } }
        }
        return base
    }
    /// css-grid-1 §12.7.1 "Find the Size of an fr".
    static func frSize(_ indices: [Int], tracks: [AWCTableTrack], base: [Double], space: Double) -> Double {
        var flexible = Set(indices.filter { tracks[$0].isFlexible })
        var leftover = space - indices.filter { !flexible.contains($0) }.reduce(0.0) { $0 + base[$1] }
        while true {
            let sum = Swift.max(1, flexible.reduce(0.0) { $0 + tracks[$1].flex })
            let hypothetical = Swift.max(0, leftover) / sum
            let inflexible = flexible.filter { hypothetical * tracks[$0].flex < base[$0] }
            if inflexible.isEmpty { return hypothetical }
            for i in inflexible { flexible.remove(i); leftover -= base[i] }
            if flexible.isEmpty { return 0 }
        }
    }
    /// Base sizes and growth limits after resolving intrinsic sizes (single-span items first, then spanning items).
    static func intrinsic(_ tracks: [AWCTableTrack], items: [AWCTableContribution], space: Double?) -> ([Double], [Double]) {
        var base = [Double](repeating: 0, count: tracks.count), limit = [Double](repeating: .infinity, count: tracks.count)
        for (i, t) in tracks.enumerated() {
            switch t.min { case .px(let v): base[i] = v; case .percent(let p): base[i] = space.map { $0 * p / 100 } ?? 0; default: base[i] = 0 }
            switch t.max {
            case .px(let v): limit[i] = v
            case .percent(let p): limit[i] = space.map { $0 * p / 100 } ?? .infinity
            case .fr: limit[i] = .infinity
            default: limit[i] = -1   // intrinsic: set from items below
            }
        }
        var sawIntrinsic = [Bool](repeating: false, count: tracks.count)
        for item in items where item.span == 1 && tracks.indices.contains(item.start) {
            let i = item.start, t = tracks[i]
            switch t.min {
            case .auto: base[i] = Swift.max(base[i], 0)     // md-table-cell: min-inline-size: 0 → minimum contribution 0
            case .minContent: base[i] = Swift.max(base[i], item.minContent)
            case .maxContent: base[i] = Swift.max(base[i], item.maxContent)
            default: break
            }
            switch t.max {
            case .auto, .maxContent: limit[i] = Swift.max(limit[i], item.maxContent); sawIntrinsic[i] = true
            case .minContent: limit[i] = Swift.max(limit[i], item.minContent); sawIntrinsic[i] = true
            case .fitContent(let cap): limit[i] = Swift.max(limit[i], Swift.min(item.maxContent, Swift.max(item.minContent, cap))); sawIntrinsic[i] = true
            default: break
            }
        }
        for i in tracks.indices where limit[i] < 0 { limit[i] = sawIntrinsic[i] ? limit[i] : base[i] }
        for i in tracks.indices where limit[i].isFinite && limit[i] < base[i] { limit[i] = base[i] }
        // Spanning items that cross no flexible track: grow intrinsic growth limits evenly.
        for item in items where item.span > 1 {
            let range = (item.start..<Swift.min(tracks.count, item.start + item.span)).map { $0 }
            guard !range.isEmpty, !range.contains(where: { tracks[$0].isFlexible }) else { continue }
            let current = range.reduce(0.0) { $0 + (limit[$1].isFinite ? limit[$1] : base[$1]) }
            let extra = item.maxContent - current
            let targets = range.filter { if case .px = tracks[$0].max { return false }; return true }
            if extra > 0 && !targets.isEmpty { for i in targets { limit[i] = (limit[i].isFinite ? limit[i] : base[i]) + extra / Double(targets.count) } }
        }
        return (base, limit)
    }
}

// MARK: Density, metrics and tokens

/// md-table's density-dependent metrics (md-table.css / md-table-row.css / md-table-cell.css).
struct AWCTableMetrics: Equatable {
    var rowHeight: Double, headHeight: Double, padInline: Double, padBlock: Double
    var fontSize: Double, lineHeight: Double, scale: Double, compact: Bool, comfortable: Bool
    var checkboxTarget: Double?
    /// --md-sys-spacing-gap-xs (sort-label arrow gap).
    var gapXS = 4.0
    /// `density` = compact | standard | comfortable | 0…-4 (scale), inherited scale from an ancestor `data-density`.
    init(density raw: AWCValue?, inheritedScale: Double, hooks: AWCTableHooks = .init()) {
        var scale = inheritedScale, mode = "standard"
        if let s = raw?.string, ["compact", "standard", "comfortable"].contains(s) { mode = s }
        else if let n = raw?.number ?? (raw?.string).flatMap({ Double($0) }), [-1.0, -2, -3, -4].contains(n) { scale = n }
        else if let n = raw?.number ?? (raw?.string).flatMap({ Double($0) }), n == 0 { scale = inheritedScale }
        self.scale = scale; compact = mode == "compact"; comfortable = mode == "comfortable"
        let standard = hooks.rowHeightStandard ?? (52 + scale * 4)
        let compactH = hooks.rowHeightCompact ?? Swift.max(28, 36 + scale * 4)
        let comfortableH = hooks.rowHeightComfortable ?? Swift.max(40, 60 + scale * 4)
        rowHeight = compact ? compactH : comfortable ? comfortableH : standard
        headHeight = hooks.headerHeight ?? Swift.max(40, 56 + scale * 4)
        // --md-sys-spacing-inset-lg / -sm per density rung (the Mac oracle: -1 keeps 16 / 8; -2 12 / 8; -3 12 / 4; -4 8 / 4).
        let rung = Int(scale.rounded())
        let insetLg: Double = rung <= -4 ? 8 : rung <= -2 ? 12 : 16, insetSm: Double = rung <= -3 ? 4 : 8
        padInline = hooks.cellPaddingInline ?? (compact ? 12 : comfortable ? 20 : insetLg)
        padBlock = hooks.cellPaddingBlock ?? (compact ? 4 : insetSm)
        gapXS = rung <= -4 ? 2 : 4
        fontSize = Swift.max(12, 14 + scale * 0.5); lineHeight = Swift.max(16, 20 + scale * 1)
        checkboxTarget = compact ? 32 : nil
    }
}

/// Public `--md-table-*` hooks (CSS custom properties of md-table).
struct AWCTableHooks: Equatable {
    var bodyMaxHeight: Double? = nil, cellPaddingBlock: Double? = nil, cellPaddingInline: Double? = nil, columnsTemplate: String? = nil
    var dividerColor: String? = nil, emptyMinHeight: Double? = nil, footBackground: String? = nil, headBackground: String? = nil
    var headColor: String? = nil, headerHeight: Double? = nil, minWidth: Double? = nil, rowHeightCompact: Double? = nil
    var rowHeightStandard: Double? = nil, rowHeightComfortable: Double? = nil, rowHoverColor: String? = nil, rowSelectedBackground: String? = nil
    var rowSelectedColor: String? = nil, stripeColor: String? = nil
    /// Reads `style="--md-table-…: …"` declarations (the oracle authors hooks inline).
    init() {}
    /// md-table's hooks from the family's custom properties (inherited and authored).
    init(vars v: AWCTableVars) {
        bodyMaxHeight = v.length("--md-table-body-max-h"); cellPaddingBlock = v.length("--md-table-cell-padding-block")
        cellPaddingInline = v.length("--md-table-cell-padding-inline"); columnsTemplate = v["--md-table-columns-template"]
        dividerColor = v["--md-table-divider-color"]; emptyMinHeight = v.length("--md-table-empty-min-height")
        footBackground = v["--md-table-foot-bg"]; headBackground = v["--md-table-head-bg"]; headColor = v["--md-table-head-color"]
        headerHeight = v.length("--md-table-header-height"); minWidth = v.length("--md-table-min-width")
        rowHeightCompact = v.length("--md-table-row-height-compact"); rowHeightStandard = v.length("--md-table-row-height-standard")
        rowHeightComfortable = v.length("--md-table-row-height-comfortable"); rowHoverColor = v["--md-table-row-hover-color"]
        rowSelectedBackground = v["--md-table-row-selected-bg"]; rowSelectedColor = v["--md-table-row-selected-color"]
        stripeColor = v["--md-table-stripe-color"]
    }
    init(style: String) {
        for decl in style.split(separator: ";") {
            let parts = decl.split(separator: ":", maxSplits: 1).map { $0.trimmingCharacters(in: .whitespaces) }
            guard parts.count == 2 else { continue }
            let (k, v) = (parts[0], parts[1]), px = AWCTableTemplate.length(v)
            switch k {
            case "--md-table-body-max-h": bodyMaxHeight = px
            case "--md-table-cell-padding-block": cellPaddingBlock = px
            case "--md-table-cell-padding-inline": cellPaddingInline = px
            case "--md-table-columns-template": columnsTemplate = v
            case "--md-table-divider-color": dividerColor = v
            case "--md-table-empty-min-height": emptyMinHeight = px
            case "--md-table-foot-bg": footBackground = v
            case "--md-table-head-bg": headBackground = v
            case "--md-table-head-color": headColor = v
            case "--md-table-header-height": headerHeight = px
            case "--md-table-min-width": minWidth = px
            case "--md-table-row-height-compact": rowHeightCompact = px
            case "--md-table-row-height-standard": rowHeightStandard = px
            case "--md-table-row-height-comfortable": rowHeightComfortable = px
            case "--md-table-row-hover-color": rowHoverColor = v
            case "--md-table-row-selected-bg": rowSelectedBackground = v
            case "--md-table-row-selected-color": rowSelectedColor = v
            case "--md-table-stripe-color": stripeColor = v
            default: break
            }
        }
    }
    func merging(_ o: AWCTableHooks) -> AWCTableHooks {
        var r = self
        r.bodyMaxHeight = o.bodyMaxHeight ?? bodyMaxHeight; r.cellPaddingBlock = o.cellPaddingBlock ?? cellPaddingBlock
        r.cellPaddingInline = o.cellPaddingInline ?? cellPaddingInline; r.columnsTemplate = o.columnsTemplate ?? columnsTemplate
        r.dividerColor = o.dividerColor ?? dividerColor; r.emptyMinHeight = o.emptyMinHeight ?? emptyMinHeight
        r.footBackground = o.footBackground ?? footBackground; r.headBackground = o.headBackground ?? headBackground
        r.headColor = o.headColor ?? headColor; r.headerHeight = o.headerHeight ?? headerHeight; r.minWidth = o.minWidth ?? minWidth
        r.rowHeightCompact = o.rowHeightCompact ?? rowHeightCompact; r.rowHeightStandard = o.rowHeightStandard ?? rowHeightStandard
        r.rowHeightComfortable = o.rowHeightComfortable ?? rowHeightComfortable; r.rowHoverColor = o.rowHoverColor ?? rowHoverColor
        r.rowSelectedBackground = o.rowSelectedBackground ?? rowSelectedBackground; r.rowSelectedColor = o.rowSelectedColor ?? rowSelectedColor
        r.stripeColor = o.stripeColor ?? stripeColor
        return r
    }
}

// MARK: Behaviour models (selection, sort, pagination) — pure, shared with tests

enum AWCTableSort {
    /// md-table handleSortRequest: first activation starts at the label's default order; then
    /// first → second → none → first.
    static func next(currentColumn: String, currentOrder: String, column: String, defaultOrder: String) -> (column: String, order: String) {
        let first = defaultOrder == "desc" ? "desc" : "asc", second = first == "asc" ? "desc" : "asc"
        var order = first
        if currentColumn == column { order = currentOrder == first ? second : currentOrder == second ? "none" : first }
        return (order == "none" ? "" : column, order)
    }
    /// The aria-sort value stamped on a head cell.
    static func ariaSort(sortBy: String, sortOrder: String, column: String) -> String {
        guard !column.isEmpty, column == sortBy else { return "none" }
        return sortOrder == "desc" ? "descending" : "ascending"
    }
}

/// One body row as the selection model sees it.
struct AWCTableSelectableRow: Equatable { var id: String, value: String, selected: Bool, disabled: Bool, selectable: Bool }
struct AWCTableSelectionState: Equatable {
    var count: Int, total: Int, values: [String], all: Bool, indeterminate: Bool
    var detail: AWCValue { ["count": .number(Double(count)), "total": .number(Double(total)), "values": .array(values.map { .string($0) }), "all": .bool(all), "indeterminate": .bool(indeterminate)] }
    /// md-table recomputeSelection: values are row values or the row's index among body rows (T1).
    static func compute(_ rows: [AWCTableSelectableRow]) -> AWCTableSelectionState {
        let selectable = rows.filter { !$0.disabled && $0.selectable }
        let selected = selectable.filter(\.selected)
        let all = !selectable.isEmpty && selected.count == selectable.count
        return .init(count: selected.count, total: selectable.count,
                     values: selected.map { r in r.value.isEmpty ? String(rows.firstIndex(of: r) ?? 0) : r.value },
                     all: all, indeterminate: !selected.isEmpty && !all)
    }
}

/// md-table-pagination arithmetic (md-table-pagination.tsx).
struct AWCTablePaginationModel: Equatable {
    var count: Int, page: Int, rowsPerPage: Int
    /// `rows-per-page-options`: comma list; `all` = count (or -1 with no count) labelled `label-all`;
    /// other entries keep their raw text as label and are dropped unless numeric and > 0.
    static func options(_ raw: String, count: Int, labelAll: String) -> [(value: Int, label: String)] {
        var out: [(value: Int, label: String)] = []
        for part in raw.split(separator: ",") {
            let t = part.trimmingCharacters(in: .whitespaces)
            guard !t.isEmpty else { continue }
            if t.lowercased() == "all" { let v = count != 0 ? count : -1; if v > 0 { out.append((v, labelAll)) } }
            else if let n = Double(t), n.isFinite, n > 0 { out.append((Int(n), t)) }
        }
        return out
    }
    /// Page is clamped by the source's count / rows-per-page watcher (silently, no event).
    var lastPage: Int { rowsPerPage <= 0 ? 0 : Swift.max(0, Int((Double(count) / Double(rowsPerPage)).rounded(.up)) - 1) }
    var clampedPage: Int { page > lastPage ? Swift.max(0, lastPage) : page }
    var from: Int { count == 0 ? 0 : clampedPage * rowsPerPage + 1 }
    var to: Int { count == 0 ? 0 : Swift.min((clampedPage + 1) * rowsPerPage, count) }
    /// `label-displayed-rows`: first occurrence of each placeholder is replaced (source behaviour).
    func display(_ template: String) -> String {
        func once(_ s: String, _ key: String, _ value: String) -> String { guard let r = s.range(of: key) else { return s }; return s.replacingCharacters(in: r, with: value) }
        return once(once(once(template, "%from%", String(from)), "%to%", String(to)), "%count%", String(count))
    }
}

/// `label-selected` on md-table-toolbar: the first `%count%` replaced by the en-US grouped count (`toLocaleString`).
func awcTableSelectedLabel(_ template: String, count: Int) -> String {
    guard let r = template.range(of: "%count%") else { return template }
    let f = NumberFormatter(); f.locale = Locale(identifier: "en_US"); f.numberStyle = .decimal
    return template.replacingCharacters(in: r, with: f.string(from: NSNumber(value: count)) ?? String(count))
}
