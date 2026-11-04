import Foundation

// The interaction half of md-pie-chart: pie-chart.ts (hover rim tween, tooltip, press ripple, click-to-pick with its
// slide, legend self-toggle, drill arming, the hover reset when the slices change) plus the host (keyboard cursor
// over the drawn slices, activation, live region, cursor re-sync). Lockstep port of ChartPieInteraction.kt.

private let HOVER_TWEEN_MS = 260.0
private let RIPPLE_MS = 450.0
private let RIPPLE_ALPHA = 0.16
private let SELECT_MS = 300.0
let AWC_CHART_DRILL_MS = 520.0
private let DRILL_CROSSFADE = 0.5
/// Slice labels hold back until the entrance reaches this point, then fade in over 180 ms.
let AWC_CHART_PIE_LABEL_ARRIVES_AT = 0.8

/// md-pie-chart `datumKeys` over the depth-first flattening.
func awcChartPieDatumKeys(_ flat: [AWCValue]) -> [String] {
    var seen: [String: Int] = [:]
    return flat.enumerated().map { i, d in
        let base = d["id"] != .null ? "id:\(d["id"].string)" : d["label"] != .null ? "label:\(d["label"].string)" : "pos:\(i)"
        let n = seen[base] ?? 0; seen[base] = n + 1
        return n == 0 ? base : "\(base)#\(n)"
    }
}

func awcChartPieSliceAt(_ scene: AWCChartScene, _ px: Double, _ py: Double) -> AWCChartSceneSlice? { scene.slices.first { awcChartPointInSlice(px, py, $0) } }

private func ringSlices(_ s: AWCChartScene) -> [AWCChartSceneSlice] { s.slices.filter { $0.pill != true && $0.endAngle != $0.startAngle } }

/// animate.ts `splitScene`: the drill frame (outer level opening around the pivot, inner level laid in its window).
func awcChartSplitScene(_ outer: AWCChartScene, _ inner: AWCChartScene, _ pivotIndex: Int, _ pRaw: Double) -> (base: AWCChartScene, over: AWCChartScene, overAlpha: Double)? {
    let p = Swift.min(1, Swift.max(0, pRaw))
    let outs = ringSlices(outer), ins = ringSlices(inner)
    guard !outs.isEmpty, !ins.isEmpty else { return nil }
    let at = outs.firstIndex { $0.dataIndex == pivotIndex } ?? 0
    let pivot = outs[at]
    let ringStart = outs[0].startAngle
    let total = outs.reduce(0) { $0 + ($1.endAngle - $1.startAngle) }
    let pivotSpan = pivot.endAngle - pivot.startAngle
    let rest = total - pivotSpan
    let w = pivotSpan + rest * p
    let w0 = pivot.startAngle + (ringStart - pivot.startAngle) * p
    let k = abs(rest) < 1e-9 ? 0 : (total - w) / rest
    let order = Array(outs[(at + 1)...]) + Array(outs[..<at])
    var cursor = w0 + w
    var base: [AWCChartSceneSlice] = order.map { s in var o = s; let span = (s.endAngle - s.startAngle) * k; o.startAngle = cursor; cursor += span; o.endAngle = cursor; return o }
    var pv = pivot; pv.startAngle = w0; pv.endAngle = w0 + w; base.append(pv)
    let innerStart = ins[0].startAngle
    let innerTotalRaw = ins.reduce(0) { $0 + ($1.endAngle - $1.startAngle) }
    let innerTotal = innerTotalRaw == 0 ? 1 : innerTotalRaw
    func map(_ a: Double) -> Double { w0 + ((a - innerStart) / innerTotal) * w }
    let over = ins.map { s -> AWCChartSceneSlice in var o = s; o.startAngle = map(s.startAngle); o.endAngle = map(s.endAngle); return o }
    var b = outer; b.slices = base; b.lines = []; b.gridlines = []; b.texts = []
    var o = inner; o.slices = over; o.lines = []; o.gridlines = []; o.texts = []; o.background = nil
    return (b, o, Swift.min(1, Swift.max(0, p / DRILL_CROSSFADE)))
}

/// One frame of a pie drill for the renderer: draw `base`, then `over` at `overAlpha`.
struct AWCChartPieDrillFrame { var base: AWCChartScene; var over: AWCChartScene; var overAlpha: Double; var labelProgress: Double }

struct AWCChartPieTooltip { var index: Int; var label: String?; var value: String?; var color: String?; var customText: String?; var anchor: CGPoint }

final class AWCChartPieInteraction {
    /// The `data` property (a tree: `children` nest rings).
    var data: [AWCValue] = []
    var valueFormatter: ((Double) -> String)? = nil
    var renderer: ((AWCChartTooltipContext) -> AWCChartTooltipContent)? = nil
    var locale = ""
    var labelPoint = "%label%: %value% (%percent%)"
    var rtl = false
    var reducedMotion = false
    var onEvent: (AWCChartEvent) -> Void = { _ in }
    /// md-pie-chart buildSpec from the current props, theme and `legendHidden`.
    var buildSpec: () -> AWCChartPieSpec? = { nil }
    /// pie-layout computePieLayout for the current size.
    var layout: (AWCChartPieSpec) -> AWCChartScene? = { _ in nil }
    var now: () -> Double = { ProcessInfo.processInfo.systemUptime * 1000 }
    /// After every engine render (the entrance clock arms on the first one with slices; any later one ends it).
    var onRender: () -> Void = {}

    private(set) var spec: AWCChartPieSpec? = nil
    private(set) var scene: AWCChartScene? = nil
    var legendHidden: [String: Bool] = [:]
    private(set) var kbIndex = -1
    private(set) var announcement = ""
    private(set) var tooltip: AWCChartPieTooltip? = nil
    private(set) var pointerCursor = false
    private(set) var introToken = 0
    private var hoverIndex = -1
    private var litIndex = -1
    private(set) var hoverT = 0.0
    private var hoverTween: (t0: Double, from: Double, target: Double)? = nil
    private var selectTween: (t0: Double, from: [Double], to: [Double])? = nil
    private var ripple: (r: AWCChartSceneRipple, start: Double, max: Double)? = nil
    private var pendingDrill: (index: Int, up: Bool, leaving: AWCChartScene)? = nil
    private var drillRun: (index: Int, up: Bool, frozen: AWCChartScene)? = nil
    private var drillStart = 0.0

    var animating: Bool { hoverTween != nil || selectTween != nil || ripple != nil || drillRun != nil }
    private func emit(_ name: String, _ detail: [String: Any?]) { onEvent(AWCChartEvent(name: name, detail: detail)) }

    // ── the slices as the host sees them (depth-first, the engine's order) ──

    private struct Entry { var d: AWCValue; var parent: Int?; var hidden: Bool; var drawn: Bool }

    private func flatDatums() -> [AWCValue] {
        var out: [AWCValue] = []
        func walk(_ items: [AWCValue]) { for d in items { out.append(d); walk(d["children"].array) } }
        walk(data)
        return out
    }

    private func entries() -> [Entry] {
        let keys = awcChartPieDatumKeys(flatDatums())
        var out: [Entry] = []
        func walk(_ items: [AWCValue], _ parent: Int?, _ underHidden: Bool) {
            for d in items {
                let at = out.count
                let hidden = d["hidden"].bool ?? legendHidden[keys[at]] ?? false
                out.append(Entry(d: d, parent: parent, hidden: hidden, drawn: !hidden && !underHidden))
                walk(d["children"].array, at, underHidden || hidden)
            }
        }
        walk(data, nil, false)
        return out
    }

    private func navigable() -> [Int] { entries().enumerated().filter { $0.element.drawn }.map(\.offset) }
    private func num(_ v: AWCValue) -> Double { v.number ?? .nan }
    private func formatValue(_ v: Double) -> String { valueFormatter?(v) ?? AWCChartIntl.number(v, locale) }
    private func formatPercent(_ p: Double) -> String { AWCChartIntl.number(p, locale, options: ["maximumFractionDigits": 1]) + "%" }

    // ── spec lifecycle ──

    /// Any property change (and the first mount): md-pie-chart applyEngine → engine.setSpec.
    func applyEngine() {
        guard let next = buildSpec() else { return }
        let changed: Bool
        if let before = spec?.data {
            changed = before.count != next.data.count || before.enumerated().contains { i, d in i >= next.data.count || d.label != next.data[i].label || d.value != next.data[i].value }
        } else { changed = true }
        spec = next
        if changed { litIndex = -1 }
        if changed && hoverIndex != -1 { hoverIndex = -1; tooltip = nil }
        let armed = pendingDrill
        pendingDrill = nil
        render()
        let variant = spec.map { awcChartResolveIntro(animation: $0.animation, animationDuration: $0.animationDuration, animate: nil).variant } ?? "none"
        if let a = armed, variant != "none", !reducedMotion { drillRun = (a.index, a.up, a.leaving); drillStart = now() }
        syncKeyboardCursor()
    }

    func resize() { render() }
    func replay() { introToken += 1; render() }
    /// Coming out of `loading` re-runs applyEngine (it is a watched prop).
    func loadingChanged() { applyEngine() }

    private func render() {
        guard var s = spec else { return }
        s.highlightIndex = hoverIndex >= 0 ? hoverIndex : hoverT > 0 ? litIndex : -1
        s.highlightT = hoverT
        spec = s
        scene = layout(s)
        onRender()
    }

    /// md-pie-chart drill(): arm a drill out of (`down`) / back into (`up`) the wedge at `index`; the next data swap plays it.
    func drill(_ index: Int, direction: String = "down") { pendingDrill = scene.map { (index, direction == "up", $0) } }

    /// The drill in flight at `now`, or nil (then draw `drawnScene()`).
    func drillFrame(_ now: Double) -> AWCChartPieDrillFrame? {
        guard let run = drillRun, let target = scene else { return nil }
        let t = (now - drillStart) / AWC_CHART_DRILL_MS
        if t >= 1 { drillRun = nil; return nil }
        func centreOf(_ sc: AWCChartScene) -> (Double, Double)? { (sc.slices.first { $0.dataIndex >= 0 } ?? sc.slices.first).map { ($0.cx, $0.cy) } }
        var frozen = run.frozen
        if let lc = centreOf(target), let fc = centreOf(run.frozen), lc.0 != fc.0 || lc.1 != fc.1 {
            frozen.slices = run.frozen.slices.map { var o = $0; o.cx += lc.0 - fc.0; o.cy += lc.1 - fc.1; return o }
        }
        let outer = run.up ? target : frozen, inner = run.up ? frozen : target
        let eased = awcChartEaseInOutCubic(t)
        guard let split = awcChartSplitScene(outer, inner, run.index, run.up ? 1 - eased : eased) else { drillRun = nil; return nil }
        return AWCChartPieDrillFrame(base: withRipple(split.base, now), over: split.over, overAlpha: split.overAlpha, labelProgress: t)
    }

    // ── per-frame state: hover rim tween, pick slide, ripple ──

    func tick(_ now: Double) {
        var dirty = false
        if let h = hoverTween {
            let p = Swift.min(1, (now - h.t0) / HOVER_TWEEN_MS)
            hoverT = h.from + (h.target - h.from) * awcChartExpressiveEase(p)
            if p >= 1 { hoverTween = nil }
            dirty = true
        }
        if let st = selectTween, var s = spec {
            let p = Swift.min(1, (now - st.t0) / SELECT_MS)
            let e = awcChartExpressiveEase(p)
            for i in s.data.indices { s.data[i].selectT = st.from[i] + (st.to[i] - st.from[i]) * e }
            spec = s
            if p >= 1 { selectTween = nil }
            dirty = true
        }
        if let r = ripple, (now - r.start) / RIPPLE_MS >= 1 { ripple = nil }
        if dirty { render() }
    }

    /// The scene as drawn right now (the ripple stamped on).
    func drawnScene(_ now: Double) -> AWCChartScene? { scene.map { withRipple($0, now) } }

    private func withRipple(_ s: AWCChartScene, _ now: Double) -> AWCChartScene {
        guard let r = ripple else { return s }
        let t = Swift.min(1, (now - r.start) / RIPPLE_MS)
        var o = s
        var rr = r.r
        rr.radius = r.max * awcChartEaseOutCubic(t)
        rr.alpha = RIPPLE_ALPHA * (1 - Swift.max(0, (t - 0.35) / 0.65))
        o.ripple = rr
        return o
    }

    private func tweenHover() {
        let target = hoverIndex >= 0 ? 1.0 : 0.0
        if hoverIndex >= 0 { litIndex = hoverIndex }
        if reducedMotion { hoverT = target; hoverTween = nil; render(); return }
        hoverTween = nil
        if hoverT == target { render(); return }
        hoverTween = (now(), hoverT, target)
    }

    // ── tooltip ──

    private func renderTooltip(_ idx: Int, _ px: Double, _ py: Double) {
        tooltip = nil
        guard let s = spec, idx >= 0, scene != nil, idx < s.data.count else { return }
        let datum = s.data[idx]
        func ringTotal(_ d: AWCChartPieDatum) -> Double { s.data.reduce(0) { sum, o in o.hidden || o.level != d.level || o.parent != d.parent ? sum : sum + o.value } }
        let total = ringTotal(datum)
        let percent = total > 0 ? (datum.value / total) * 100 : 0
        if let r = renderer {
            let series = s.data.enumerated().map { i, d -> AWCChartTooltipSeries in
                let t = i == idx ? total : ringTotal(d)
                return AWCChartTooltipSeries(seriesIndex: i, label: d.label, color: d.color, value: d.value, formattedValue: s.valueFormatter(d.value), focused: i == idx, missing: false, percent: t > 0 ? (d.value / t) * 100 : 0)
            }
            if case .text(let text) = r(AWCChartTooltipContext(dataIndex: idx, axisValue: .string(datum.label), axisLabel: datum.label, series: series, missing: [], focusedSeriesIndex: idx)) {
                tooltip = AWCChartPieTooltip(index: idx, label: nil, value: nil, color: nil, customText: text, anchor: CGPoint(x: px, y: py))
            }
            return
        }
        // The card's share: one decimal, always (spec.percentFormatter); the announcement drops a trailing .0.
        let pct = AWCChartIntl.number(percent, locale, options: ["minimumFractionDigits": 1, "maximumFractionDigits": 1])
        tooltip = AWCChartPieTooltip(index: idx, label: datum.label, value: "\(s.valueFormatter(datum.value)) (\(pct)%)", color: datum.color, customText: nil, anchor: CGPoint(x: px, y: py))
    }

    /// pie-chart.ts `placeTooltip` for the measured card (offsetWidth / offsetHeight are whole pixels).
    func tooltipOrigin(_ tw0: Double, _ th0: Double) -> CGPoint? {
        guard let t = tooltip, let s = scene else { return nil }
        let tw = awcJSRound(tw0) > 0 ? awcJSRound(tw0) : 120, th = awcJSRound(th0) > 0 ? awcJSRound(th0) : 40
        var left = t.anchor.x + 14
        if left + tw > s.width - 4 { left = t.anchor.x - tw - 14 }
        let top = Swift.max(4, Swift.min(t.anchor.y - th / 2, s.height - th - 4))
        return CGPoint(x: Swift.max(4, left), y: top)
    }

    // ── pointer ──

    func pointerMove(_ px: Double, _ py: Double) {
        guard let s = scene else { return }
        let slice = awcChartPieSliceAt(s, px, py)
        let idx = slice?.dataIndex ?? -1
        pointerCursor = slice != nil
        if idx != hoverIndex { hoverIndex = idx; tweenHover() }
        renderTooltip(idx, px, py)
    }

    func pointerLeave() {
        tooltip = nil
        if hoverIndex != -1 { hoverIndex = -1; pointerCursor = false; tweenHover() }
    }

    func pointerDown(_ px: Double, _ py: Double) { if let s = scene, let sl = awcChartPieSliceAt(s, px, py) { startRipple(px, py, sl) } }

    func pointerUp(_ px: Double, _ py: Double) {
        guard let s = scene, let slice = awcChartPieSliceAt(s, px, py) else { return }
        emitSliceClick(slice.dataIndex)
        toggleSelected(slice.dataIndex)
    }

    private func startRipple(_ x: Double, _ y: Double, _ slice: AWCChartSceneSlice) {
        if reducedMotion { return }
        let corners = [slice.startAngle, slice.endAngle].flatMap { a in [slice.innerR, slice.outerR].map { r in hypot(slice.cx + cos(a) * r - x, slice.cy + sin(a) * r - y) } }
        ripple = (AWCChartSceneRipple(dataIndex: slice.dataIndex, x: x, y: y, radius: 0, color: awcChartOnColor(slice.color), alpha: RIPPLE_ALPHA), now(), Swift.max(corners.max() ?? 1, 1))
    }

    private func toggleSelected(_ index: Int) {
        guard var s = spec, index >= 0, index < s.data.count else { return }
        let from = s.data.map { $0.selectT ?? ($0.selected == true ? 1 : 0) }
        let wasOut = s.data[index].selected == true
        for i in s.data.indices { s.data[i].selected = i == index && !wasOut }
        let to = s.data.map { $0.selected == true ? 1.0 : 0.0 }
        spec = s
        if from == to { return }
        if reducedMotion { for i in s.data.indices { s.data[i].selectT = to[i] }; spec = s; render(); return }
        selectTween = (now(), from, to)
    }

    // ── keyboard ──

    func keyDown(_ key: String) -> Bool {
        let nav = navigable()
        guard let first = nav.first, let last = nav.last else { return false }
        let forward = rtl ? "ArrowLeft" : "ArrowRight", back = rtl ? "ArrowRight" : "ArrowLeft"
        let next: Int
        switch key {
        case forward, "ArrowDown": next = kbIndex < 0 ? first : (nav.first(where: { $0 > kbIndex }) ?? last)
        case back, "ArrowUp": next = kbIndex < 0 ? last : (nav.last(where: { $0 < kbIndex }) ?? first)
        case "Home": next = first
        case "End": next = last
        case "Escape": if kbIndex < 0 { return false }; next = -1
        case "Enter", " ":
            if kbIndex < 0 || !nav.contains(kbIndex) { return false }
            emitSliceClick(kbIndex)
            activate(kbIndex)
            return true
        default: return false
        }
        moveKeyboardCursor(next)
        return true
    }

    func blur() { if kbIndex >= 0 { moveKeyboardCursor(-1) } }

    private func activate(_ index: Int) {
        guard let slice = scene?.slices.first(where: { $0.pill != true && $0.dataIndex == index }) else { return }
        let mid = (slice.startAngle + slice.endAngle) / 2, r = (slice.innerR + slice.outerR) / 2
        startRipple(slice.cx + cos(mid) * r, slice.cy + sin(mid) * r, slice)
        toggleSelected(index)
    }

    private func focusIndex(_ index: Int) {
        guard let s = scene else { return }
        if index < 0 { tooltip = nil; if hoverIndex != -1 { hoverIndex = -1; tweenHover() }; return }
        guard let slice = s.slices.first(where: { $0.dataIndex == index }) else {
            tooltip = nil; if hoverIndex != -1 { hoverIndex = -1; tweenHover() }; return
        }
        if hoverIndex != index { hoverIndex = index; tweenHover() }
        // Anchored on the slice as it was before the hover re-render (pie-chart.ts reads it first).
        let mid = (slice.startAngle + slice.endAngle) / 2, r = (slice.innerR + slice.outerR) / 2
        renderTooltip(index, slice.cx + cos(mid) * r, slice.cy + sin(mid) * r)
    }

    private func syncKeyboardCursor() {
        if kbIndex < 0 { return }
        let nav = navigable()
        if nav.contains(kbIndex) { return }
        moveKeyboardCursor(nav.first(where: { $0 > kbIndex }) ?? nav.last ?? -1)
    }

    private func moveKeyboardCursor(_ next: Int) {
        kbIndex = next
        focusIndex(next)
        if next < 0 { announcement = ""; return }
        let es = entries()
        guard next < es.count else { return }
        let e = es[next]
        let value = num(e.d["value"])
        let total = es.reduce(0.0) { acc, o in o.parent == e.parent && !o.hidden ? acc + num(o.d["value"]) : acc }
        let pct = total > 0 ? (value / total) * 100 : 0
        let label = e.d["label"] == .null ? "undefined" : e.d["label"].string
        announcement = awcChartJSReplaceFirst(awcChartJSReplaceFirst(awcChartJSReplaceFirst(labelPoint, "%label%", label), "%value%", formatValue(value)), "%percent%", formatPercent(pct))
    }

    // ── legend + events ──

    func legendToggle(_ index: Int) {
        guard var s = spec, index >= 0, index < s.data.count else { return }
        let nh = !s.data[index].hidden
        s.data[index].hidden = nh
        spec = s
        introToken += 1
        render()
        let keys = awcChartPieDatumKeys(flatDatums())
        if index < keys.count { legendHidden[keys[index]] = nh }
        syncKeyboardCursor()
        emit("mdLegendClick", ["dataIndex": index, "selected": !nh])
    }

    private func emitSliceClick(_ index: Int) {
        let flat = flatDatums()
        guard index >= 0, index < flat.count else { return }
        let d = flat[index]
        var m: [String: Any?] = ["seriesIndex": 0]
        if d["id"] != .null { m["seriesId"] = awcChartEventValue(d["id"]) }
        m["dataIndex"] = index
        m.updateValue(awcChartEventValue(d["value"]), forKey: "value")
        m["series"] = d
        emit("mdSliceClick", m)
    }
}
