import Foundation

// The interaction half of md-bar-chart: bar-chart.ts (BarChartEngine hover / polar spotlight / dwell tooltip /
// bar click / legend self-toggle / hover re-resolve on render) plus the host (keyboard cursor and bar activation,
// live region, zoom window, drag band, pan, event payloads). Lockstep port of ChartBarInteraction.kt.

private let POLAR_DIM = 0.62
private let POLAR_FADE_MS = 200.0
private let POLAR_DWELL_MS = 220.0

/// bar-chart.ts `pointInSlice` (about the slice's own centre, folded so any angular range works).
func awcChartPointInSlice(_ px: Double, _ py: Double, _ s: AWCChartSceneSlice) -> Bool {
    let dx = px - s.cx, dy = py - s.cy
    let r = hypot(dx, dy)
    if r < s.innerR || r > s.outerR { return false }
    let lo = Swift.min(s.startAngle, s.endAngle), hi = Swift.max(s.startAngle, s.endAngle)
    let twoPi = Double.pi * 2
    var d = (atan2(dy, dx) - lo).truncatingRemainder(dividingBy: twoPi)
    if d < 0 { d += twoPi }
    return d <= hi - lo
}

func awcChartSliceAt(_ slices: [AWCChartSceneSlice], _ px: Double, _ py: Double) -> AWCChartSceneSlice? {
    slices.first { $0.endAngle != $0.startAngle && awcChartPointInSlice(px, py, $0) }
}

private func sliceKey(_ dataIndex: Int, _ seriesIndex: Int?) -> String { "\(dataIndex):\(seriesIndex ?? -1)" }

/// bar-chart.ts `emphasizePolar`.
func awcChartEmphasizePolar(_ scene: AWCChartScene, _ dimByKey: [String: Double], surface: String) -> AWCChartScene {
    var s = scene
    s.slices = scene.slices.map { sl in
        let d = dimByKey[sliceKey(sl.dataIndex, sl.seriesIndex)] ?? 0
        guard d > 0.002 else { return sl }
        var o = sl; o.color = awcChartMixColor(sl.color, surface, POLAR_DIM * d); return o
    }
    return s
}

private enum AWCBarGrab { case band(x: Double), pan(frac: Double, win: (Int, Int)) }

final class AWCChartBarInteraction: AWCChartPlotInteraction {
    var series: [AWCValue] = []
    var xAxisData: [AWCValue]? = nil
    var valueFormatter: (Double) -> String = { awcJSNumberString($0) }
    var formatters = AWCChartFormatters()
    var renderer: ((AWCChartTooltipContext) -> AWCChartTooltipContent)? = nil
    var missingFormatter: ((Double?) -> String)? = nil
    var locale = ""
    var labelPoint = "%x%: %values%"
    var tooltip = "axis"
    var zoom = "none"
    var polar = false
    var horizontal = false
    var clickable = false
    var surface = "#FFFBFE"
    var rtl = false
    var reducedMotion = false
    var doubleClickMs = 500.0
    var doubleClickSlop = 4.0
    var onEvent: (AWCChartEvent) -> Void = { _ in }
    var rebuild: () -> Void = {}
    var now: () -> Double = { ProcessInfo.processInfo.systemUptime * 1000 }

    var scene: AWCChartScene? = nil
    private(set) var zoomWin: (Int, Int)? = nil
    var legendHidden: [String: Bool] = [:]
    private var legendOrder: [String] = []
    var hiddenOverride: [Int: Bool] = [:]
    private(set) var kbIndex = -1
    private(set) var announcement = ""
    private(set) var hover: AWCChartHoverState? = nil
    private(set) var hoverIndexAttr: Int? = nil
    private(set) var dragBand: (Double, Double)? = nil
    private(set) var introToken = 0
    /// The hand cursor over an actionable bar / segment.
    private(set) var pointerCursor = false
    private var lastHoverIndex = -2
    private var hoverSlice: (Int, Int)? = nil
    private(set) var dimAnim: [String: Double] = [:]
    private var dimAnimating = false
    private var dimLast = 0.0
    private var tooltipDue: Double? = nil
    private var tooltipFor: (Int, Int)? = nil
    private var tooltipShown = false
    private var lastPointer = (0.0, 0.0)
    private var grab: AWCBarGrab? = nil
    private var lastClick: (Double, Double, Double)? = nil
    /// A zoom / pan re-render snaps to the new window rather than following (md-bar-chart applyEngine(snap)).
    var zoomRenderPending = false

    var zoomInside: Bool { !polar && (zoom == "inside" || zoom == "both") }
    var zoomSliderOn: Bool { !polar && (zoom == "slider" || zoom == "both") }
    var animating: Bool { dimAnimating || tooltipDue != nil || (hover?.popStart.map { now() - $0 < 320 } ?? false) }

    func dataLength() -> Int { Swift.max(series.reduce(0) { Swift.max($0, $1["data"].array.count) }, xAxisData?.count ?? 0) }
    func win() -> (Int, Int) {
        let last = Swift.max(0, dataLength() - 1)
        guard let w = zoomWin else { return (0, last) }
        let start = Swift.min(Swift.max(0, w.0), Swift.max(0, last - 1))
        return (start, Swift.min(Swift.max(start + 1, w.1), last))
    }
    func zoomWindow() -> (start: Int, end: Int)? { zoomWin != nil && !polar ? { let w = win(); return (w.0, w.1) }() : nil }
    private func winStart() -> Int { zoomWin != nil && !polar ? win().0 : 0 }
    private func emit(_ name: String, _ detail: [String: Any?]) { onEvent(AWCChartEvent(name: name, detail: detail)) }
    private func xAt(_ abs: Int) -> Any? { guard let d = xAxisData, abs >= 0, abs < d.count else { return nil }; return awcChartEventValue(d[abs]) }

    // ── render (bar-chart.ts render(): a new scene re-resolves the hover at the same index) ──

    private func render() {
        let had = scene?.xPositions.count ?? 0
        hoverSlice = nil; dimAnim = [:]; dimAnimating = false
        tooltipDue = nil; tooltipShown = false
        rebuild()
        guard let s = scene else { return }
        if lastHoverIndex >= 0 {
            if lastHoverIndex < s.xPositions.count && had == s.xPositions.count { focusIndexInternal(lastHoverIndex) }
            else { clearHover(); lastHoverIndex = -1 }
        }
    }

    func applyEngine() { hiddenOverride = [:]; render() }
    func resize() { render() }
    func loadingChanged(now: Bool, before: Bool) { if before && !now { replay() } }
    func replay() { introToken += 1; render() }

    // ── hover ──

    private func clearHover() { hover = nil; hoverIndexAttr = nil }

    private func renderHover(_ s: AWCChartScene, _ index: Int, _ cx: Double, _ cy: Double, _ orient: String, _ focusSeries: Int, _ trigger: String) {
        let isNew = hoverIndexAttr != index
        if index < 0 { clearHover(); return }
        if index >= s.xPositions.count { hover = nil; return }
        hoverIndexAttr = index
        let model = awcChartHoverModel(s, index: index, yFormatter: valueFormatter, cursor: CGPoint(x: cx, y: cy), orient: orient, focusSeries: focusSeries,
                                       trigger: trigger, missingFormatter: missingFormatter, renderer: renderer)
        // The bar engine never passes the host direction to the card.
        hover = model.map { AWCChartHoverState(model: $0, scene: s, rtl: false, popStart: isNew && !reducedMotion ? now() : nil) }
    }

    func tooltipOrigin(_ tw: Double, _ th: Double, roomAbove: Bool) -> CGPoint? {
        guard let h = hover, h.model.customText != nil || !h.model.rows.isEmpty else { return nil }
        let w = awcJSRound(tw), hh = awcJSRound(th)
        let o = awcChartTooltipOrigin(h.scene, size: CGSize(width: w, height: hh), cursor: h.model.cursor, orient: h.model.orient, pos: h.model.pos, rtl: h.rtl)
        return hh + 8 > h.scene.height && roomAbove ? CGPoint(x: o.x, y: awcJSRound(-hh - 6)) : o
    }

    private func focusIndexInternal(_ index: Int) {
        guard let s = scene else { return }
        if polar {
            let next: (Int, Int)? = index < 0 ? nil : (index, -1)
            if next?.0 != hoverSlice?.0 || next?.1 != hoverSlice?.1 { hoverSlice = next; startDim() }
        }
        if index < 0 { clearHover(); return }
        let pt = s.hoverPoints.lazy.compactMap { $0.byIndex[index] }.first
        let pos = index < s.xPositions.count ? s.xPositions[index] : 0
        renderHover(s, index, pt?.x ?? (horizontal ? s.plot.x : pos), pt?.y ?? (horizontal ? pos : s.plot.y), polar ? "none" : horizontal ? "horizontal" : "vertical", -1, "axis")
    }

    private func dimTarget(_ s: AWCChartSceneSlice) -> Double {
        guard let h = hoverSlice else { return 0 }
        if h.1 < 0 { return s.dataIndex == h.0 ? 0 : 1 }
        return s.dataIndex == h.0 && s.seriesIndex == h.1 ? 0 : 1
    }

    private func startDim() {
        guard let s = scene else { return }
        if reducedMotion {
            dimAnimating = false
            for sl in s.slices { dimAnim[sliceKey(sl.dataIndex, sl.seriesIndex)] = dimTarget(sl) }
            return
        }
        if !dimAnimating { dimLast = 0; dimAnimating = true }
    }

    func tick(_ now: Double) {
        if dimAnimating, let s = scene {
            let dt = dimLast != 0 ? now - dimLast : 16
            dimLast = now
            var moving = false
            for sl in s.slices {
                let key = sliceKey(sl.dataIndex, sl.seriesIndex)
                let target = dimTarget(sl), cur = dimAnim[key] ?? 0
                let sgn: Double = target > cur ? 1 : target < cur ? -1 : 0
                var next = cur + sgn * (dt / POLAR_FADE_MS)
                if (target - cur) * (target - next) <= 0 { next = target }
                dimAnim[key] = next
                if next != target { moving = true }
            }
            dimAnimating = moving
        }
        if let due = tooltipDue, now >= due {
            tooltipDue = nil
            if let h = hoverSlice, let f = tooltipFor, h == f { showPolarTooltip(f); tooltipShown = true }
        }
    }

    func drawnScene() -> AWCChartScene? { scene.map { polar ? awcChartEmphasizePolar($0, dimAnim, surface: surface) : $0 } }

    private func armTooltip(_ hovered: (Int, Int)?) {
        tooltipDue = nil
        clearHover()
        tooltipShown = false
        guard let hovered else { return }
        tooltipFor = hovered
        tooltipDue = now() + POLAR_DWELL_MS
    }

    private func showPolarTooltip(_ h: (Int, Int)) {
        guard let s = scene else { return }
        renderHover(s, h.0, lastPointer.0, lastPointer.1, "none", h.1, "item")
    }

    private func overBar(_ px: Double, _ py: Double) -> Bool { scene?.bars.contains { px >= $0.x && px <= $0.x + $0.w && py >= $0.y && py <= $0.y + $0.h } ?? false }

    // ── pointer ──

    func insidePlot(_ px: Double, _ py: Double) -> Bool { guard let p = scene?.plot else { return false }; return awcChartInsidePlot(p, px, py) }

    func pointerDown(_ px: Double, _ py: Double, button: Int = 0) {
        guard zoomInside, button == 0, grab == nil, insidePlot(px, py) else { return }
        grab = .band(x: px)
        dragBand = (px, px)
    }

    func pointerMove(_ px: Double, _ py: Double) {
        if case .band(let x)? = grab, let p = scene?.plot { dragBand = (x, Swift.min(Swift.max(px, p.x), p.x + p.width)) }
        guard let s = scene, tooltip != "none" else { return }
        if polar {
            let slice = awcChartSliceAt(s.slices, px, py)
            let hovered: (Int, Int)? = slice.map { ($0.dataIndex, $0.seriesIndex ?? -1) }
            lastPointer = (px, py)
            pointerCursor = hovered != nil
            if hovered?.0 != hoverSlice?.0 || hovered?.1 != hoverSlice?.1 { hoverSlice = hovered; startDim(); armTooltip(hovered) }
            else if tooltipShown, let h = hovered { showPolarTooltip(h) }
            let idx = hovered?.0 ?? -1
            if idx != lastHoverIndex { lastHoverIndex = idx; hostHover(idx) }
            return
        }
        let idx = awcChartNearestIndex(s.xPositions, horizontal ? py : px)
        pointerCursor = clickable && overBar(px, py)
        renderHover(s, idx, px, py, horizontal ? "horizontal" : "vertical", -1, "axis")
        if idx != lastHoverIndex { lastHoverIndex = idx; hostHover(idx) }
    }

    func pointerLeave() {
        pointerCursor = false
        clearHover()
        if polar && scene != nil {
            tooltipDue = nil; tooltipShown = false
            if hoverSlice != nil { hoverSlice = nil; startDim() }
        }
        if lastHoverIndex != -1 { lastHoverIndex = -1 }
    }

    func pointerUp(_ px: Double, _ py: Double, insideCanvas: Bool = true) {
        let captured = grab != nil
        hostUp()
        if insideCanvas || captured {
            click(px, py)
            let t = now()
            if let prev = lastClick, t - prev.2 <= doubleClickMs, hypot(px - prev.0, py - prev.1) <= doubleClickSlop { lastClick = nil; doubleClick(px, py) }
            else { lastClick = (px, py, t) }
        }
    }

    private func hostUp() {
        guard let g = grab else { return }
        grab = nil
        let band = dragBand
        dragBand = nil
        guard case .band = g, let b = band, abs(b.1 - b.0) >= 8 else { return }
        let ab = [indexAtX(b.0), indexAtX(b.1)].sorted()
        if ab[1] - ab[0] >= 1 { applyZoom(Double(ab[0]), Double(ab[1])) }
    }

    private func indexAtX(_ x: Double) -> Int {
        let w = win()
        guard let s = scene, !s.xPositions.isEmpty else { return w.0 }
        var best = 0, bestD = Double.infinity
        for (i, p) in s.xPositions.enumerated() { let d = abs(p - x); if d < bestD { bestD = d; best = i } }
        return w.0 + best
    }

    private func click(_ px: Double, _ py: Double) {
        guard let s = scene else { return }
        if polar { if let sl = awcChartSliceAt(s.slices, px, py) { barClick(sl.seriesIndex ?? 0, sl.dataIndex) }; return }
        for b in s.bars where px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h { barClick(b.seriesIndex, b.dataIndex); return }
    }

    func doubleClick(_ px: Double, _ py: Double) { if zoomInside && zoomWin != nil && insidePlot(px, py) { resetZoom() } }

    // ── zoom ──

    func applyZoom(_ start: Double, _ end: Double, reset: Bool = false) {
        let last = Swift.max(0, dataLength() - 1)
        let s = Swift.min(Swift.max(0, Int(awcJSRound(start))), Swift.max(0, last - 1))
        let e = Swift.min(Swift.max(s + 1, Int(awcJSRound(end))), last)
        zoomWin = reset ? nil : (s, e)
        zoomRenderPending = true
        applyEngine()
        emit("mdZoom", ["startIndex": reset ? 0 : s, "endIndex": reset ? last : e, "reset": reset])
    }
    func setZoom(_ start: Double, _ end: Double) { applyZoom(start, end) }
    func resetZoom() { applyZoom(0, 0, reset: true) }
    func zoomSliderInput(_ valueStart: Double, _ valueEnd: Double) { applyZoom(valueStart, valueEnd) }
    func panStart(_ frac: Double) { grab = .pan(frac: frac, win: win()) }
    func panMove(_ frac: Double) {
        guard case .pan(let f0, let w)? = grab else { return }
        let last = Swift.max(1, dataLength() - 1)
        let span = w.1 - w.0
        let delta = Int(awcJSRound((frac - f0) * Double(last)))
        let s = Swift.min(Swift.max(0, w.0 + delta), last - span)
        applyZoom(Double(s), Double(s + span))
    }
    func panEnd() { if case .pan? = grab { grab = nil } }

    // ── legend ──

    func legendToggle(_ seriesIndex: Int) {
        guard seriesIndex >= 0, seriesIndex < series.count else { return }
        let s = series[seriesIndex]
        let key = awcChartSeriesKeys(series)[seriesIndex]
        let nh = !(hiddenOverride[seriesIndex] ?? s["hidden"].bool ?? legendHidden[key] ?? false)
        hiddenOverride[seriesIndex] = nh
        introToken += 1
        render()
        legendOrder.removeAll { $0 == key }; legendOrder.append(key); legendHidden[key] = nh
        if legendOrder.count > 256 { legendHidden[legendOrder.removeFirst()] = nil }
        var d: [String: Any?] = ["seriesIndex": seriesIndex]
        if s["id"] != .null { d["seriesId"] = awcChartEventValue(s["id"]) }
        d["selected"] = !nh
        emit("mdLegendClick", d)
    }

    // ── keyboard ──

    func keyDown(_ key: String) -> Bool {
        guard let s = scene else { return false }
        let last = Swift.max(0, s.xPositions.count - 1)
        if key == "Enter" || key == " " || key == "Spacebar" {
            if kbIndex < 0 { return false }
            barClick(visibleSeriesIndices().first ?? 0, kbIndex)
            return true
        }
        guard let next = awcChartKeyboardNext(key, current: kbIndex, last: last, rtl: rtl) else { return false }
        moveKeyboardCursor(next)
        return true
    }

    func blur() { if kbIndex >= 0 { moveKeyboardCursor(-1) } }

    private func moveKeyboardCursor(_ next: Int) {
        kbIndex = next
        lastHoverIndex = next
        focusIndexInternal(next)
        if next < 0 { announcement = ""; return }
        let s = scene
        let xText = s.flatMap { next < $0.xLabels.count ? $0.xLabels[next] : nil } ?? String(next + 1)
        let fmt = formatters.valueFormatter
        let yFmt: (Double) -> String = { v in fmt?(v) ?? AWCChartIntl.number(v, self.locale) }
        let values = (s?.hoverPoints ?? []).compactMap { hp in hp.byIndex[next].map { "\(hp.label) \(yFmt($0.value))" } }.joined(separator: ", ")
        announcement = awcChartJSReplaceFirst(awcChartJSReplaceFirst(labelPoint, "%x%", xText), "%values%", values)
    }

    // ── payloads ──

    private func hostHover(_ idx: Int) {
        if idx < 0 { return }
        let abs = idx + winStart()
        emit("mdHover", ["dataIndex": abs, "axisValue": xAt(abs), "seriesIndices": visibleSeriesIndices()])
    }

    func visibleSeriesIndices() -> [Int] {
        if let s = scene { return s.hoverPoints.map(\.seriesIndex) }
        return series.indices.filter { series[$0]["hidden"].bool != true }
    }

    private func barClick(_ si: Int, _ di: Int) {
        guard si >= 0, si < series.count else { return }
        let s = series[si]
        let abs = di + winStart()
        let data = s["data"].array
        var d: [String: Any?] = ["seriesIndex": si]
        if s["id"] != .null { d["seriesId"] = awcChartEventValue(s["id"]) }
        d["dataIndex"] = abs
        d.updateValue(abs < data.count ? awcChartEventValue(data[abs]) : nil, forKey: "value")
        d.updateValue(xAt(abs), forKey: "axisValue")
        d["series"] = s
        emit("mdBarClick", d)
    }
}
