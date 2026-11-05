import Foundation

// The interaction half of md-line-chart / md-area-chart, platform-neutral: chart.ts (LineChartEngine pointer,
// click, focusIndex, legend self-toggle, hover emphasis) plus the host component (keyboard cursor, live region,
// zoom window, drag band, pan, event payloads). Inputs are in plot-canvas coordinates; the SwiftUI view feeds
// gestures in, draws `scene` / `hover` / `dragBand`, and dispatches `onEvent`. Kept in lockstep with
// ChartInteraction.kt, which replays the Web interaction oracles in CI.

/// A component event as the Web element dispatches it: the event name and its detail, minus `nativeEvent`.
struct AWCChartEvent { var name: String; var detail: [String: Any?] }

/// JS `String.prototype.replace(string, string)`: the first occurrence only, with the `$$ $& $` $'` patterns.
func awcChartJSReplaceFirst(_ s: String, _ pattern: String, _ replacement: String) -> String {
    guard let range = s.range(of: pattern) else { return s }
    var r = ""
    var it = replacement.makeIterator()
    var pending: Character? = it.next()
    while let c = pending {
        pending = it.next()
        if c == "$", let n = pending {
            switch n {
            case "$": r.append("$"); pending = it.next(); continue
            case "&": r += pattern; pending = it.next(); continue
            case "`": r += s[s.startIndex..<range.lowerBound]; pending = it.next(); continue
            case "'": r += s[range.upperBound...]; pending = it.next(); continue
            default: break
            }
        }
        r.append(c)
    }
    return String(s[s.startIndex..<range.lowerBound]) + r + String(s[range.upperBound...])
}

/// A raw axis value as an event detail carries it (string / number; a Date as its epoch ms).
func awcChartAxisDetail(_ v: AWCChartAxisValue?) -> Any? {
    guard let v else { return nil }
    switch v { case .string(let s): return s; case .number(let n): return n; case .date(let ms): return ms }
}

/// xy.ts `datumY`.
func awcChartDatumYValue(_ d: AWCValue?) -> Double? {
    guard let d else { return nil }
    switch d {
    case .number(let n): return n
    case .object(let o): if case .number(let n)? = o["y"] { return n }; return nil
    case .array(let a): if a.count > 1, case .number(let n) = a[1] { return n }; return nil
    default: return nil
    }
}

/// md-line-chart / md-area-chart / md-bar-chart keyboard cursor (reading-direction arrows, Home / End, Escape); nil = not handled.
func awcChartKeyboardNext(_ key: String, current: Int, last: Int, rtl: Bool) -> Int? {
    let forward = rtl ? "ArrowLeft" : "ArrowRight", back = rtl ? "ArrowRight" : "ArrowLeft"
    switch key {
    case forward: return current < 0 ? 0 : Swift.min(last, current + 1)
    case back: return current < 0 ? last : Swift.max(0, current - 1)
    case "Home": return 0
    case "End": return last
    case "Escape": return current < 0 ? nil : -1
    default: return nil
    }
}

/// What the hover layer shows, the scene it was taken against (a stale card survives a re-render), and when its markers popped.
struct AWCChartHoverState { var model: AWCChartHoverModel; var scene: AWCChartScene; var rtl: Bool; var popStart: Double? }

/// What a chart view needs from its interaction controller (line / area and bar share it).
protocol AWCChartPlotInteraction: AnyObject {
    var scene: AWCChartScene? { get set }
    var hover: AWCChartHoverState? { get }
    var hoverIndexAttr: Int? { get }
    var announcement: String { get }
    var kbIndex: Int { get }
    var dragBand: (Double, Double)? { get }
    var introToken: Int { get }
    var rtl: Bool { get set }
    var reducedMotion: Bool { get set }
    var now: () -> Double { get set }
    var onEvent: (AWCChartEvent) -> Void { get set }
    var rebuild: () -> Void { get set }
    var zoomInside: Bool { get }
    var zoomSliderOn: Bool { get }
    func applyEngine()
    func resize()
    func replay()
    func loadingChanged(now: Bool, before: Bool)
    func tick(_ now: Double)
    func drawnScene() -> AWCChartScene?
    func pointerDown(_ px: Double, _ py: Double, button: Int)
    func pointerMove(_ px: Double, _ py: Double)
    func pointerLeave()
    func pointerUp(_ px: Double, _ py: Double, insideCanvas: Bool)
    func doubleClick(_ px: Double, _ py: Double)
    func keyDown(_ key: String) -> Bool
    func blur()
    func legendToggle(_ seriesIndex: Int)
    func win() -> (Int, Int)
    func zoomWindow() -> (start: Int, end: Int)?
    func dataLength() -> Int
    func setZoom(_ start: Double, _ end: Double)
    func resetZoom()
    func zoomSliderInput(_ valueStart: Double, _ valueEnd: Double)
    func panStart(_ frac: Double)
    func panMove(_ frac: Double)
    func panEnd()
    func tooltipOrigin(_ tw: Double, _ th: Double, roomAbove: Bool) -> CGPoint?
    func visibleSeriesIndices() -> [Int]
    var animating: Bool { get }
}

private enum AWCChartGrab { case band(x: Double), pan(frac: Double, win: (Int, Int)) }

final class AWCChartCartesianInteraction: AWCChartPlotInteraction {
    let isArea: Bool
    init(isArea: Bool) { self.isArea = isArea }

    // ── host-provided configuration (refreshed on every property change) ──
    var series: [AWCValue] = []
    var xAxisData: [AWCValue]? = nil
    var merged: AWCChartNormalizedX? = nil
    var yFormatter: (Double) -> String = { awcJSNumberString($0) }
    var formatters = AWCChartFormatters()
    var renderer: ((AWCChartTooltipContext) -> AWCChartTooltipContent)? = nil
    /// Opts a series with no reading at the hovered x into a tooltip row (the charts pass `valueFormatter`; md-sparkline none).
    var missingFormatter: ((Double?) -> String)? = nil
    var locale = ""
    var labelPoint = "%x%: %values%"
    var tooltip = "axis"
    var zoom = "none"
    var rtl = false
    var reducedMotion = false
    var doubleClickMs = 500.0
    var doubleClickSlop = 4.0
    var onEvent: (AWCChartEvent) -> Void = { _ in }
    /// Rebuild `scene` from the current props, `zoomWindow()`, `legendHidden` and `hiddenOverride`.
    var rebuild: () -> Void = {}
    var now: () -> Double = { ProcessInfo.processInfo.systemUptime * 1000 }

    // ── state ──
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
    private(set) var emphasisSeries = -1
    private(set) var emphasisT = 0.0
    private var emphasisTarget = 0.0
    private var emphasisLast = 0.0
    private(set) var emphasisAnimating = false
    private(set) var introToken = 0
    private var lastHoverIndex = -2
    private let focus = AWCChartHoverFocus()
    private var downAt: (Double, Double)? = nil
    private var dragged = false
    private var grab: AWCChartGrab? = nil
    private var lastClick: (Double, Double, Double)? = nil

    var zoomInside: Bool { zoom == "inside" || zoom == "both" }
    var zoomSliderOn: Bool { zoom == "slider" || zoom == "both" }
    var animating: Bool { emphasisAnimating || (hover?.popStart.map { now() - $0 < 320 } ?? false) }

    func dataLength() -> Int {
        if isArea {
            let longest = series.reduce(0) { acc, s in Swift.max(acc, s["range"] != .null ? s["range"].array.count : s["data"].array.count) }
            return Swift.max(longest, xAxisData?.count ?? 0)
        }
        guard let m = merged else { return 0 }
        return Swift.max(m.data.reduce(0) { Swift.max($0, $1.count) }, m.xValues.count)
    }

    func win() -> (Int, Int) {
        let last = Swift.max(0, dataLength() - 1)
        guard let w = zoomWin else { return (0, last) }
        let start = Swift.min(Swift.max(0, w.0), Swift.max(0, last - 1))
        return (start, Swift.min(Swift.max(start + 1, w.1), last))
    }

    func zoomWindow() -> (start: Int, end: Int)? { zoomWin == nil ? nil : { let w = win(); return (w.0, w.1) }() }
    private func absOf(_ local: Int) -> Int { local + (zoomWin != nil ? win().0 : 0) }
    private func axisValueAt(_ abs: Int) -> Any? {
        if isArea { guard let d = xAxisData, abs >= 0, abs < d.count else { return nil }; return awcChartEventValue(d[abs]) }
        guard let m = merged, abs >= 0, abs < m.xValues.count else { return nil }
        return awcChartAxisDetail(m.xValues[abs])
    }
    private func emit(_ name: String, _ detail: [String: Any?]) { onEvent(AWCChartEvent(name: name, detail: detail)) }

    // ── spec lifecycle (setSpec / replay) ──

    func applyEngine() {
        focus.reset()
        emphasisSeries = -1; emphasisT = 0; emphasisTarget = 0; emphasisAnimating = false
        hiddenOverride = [:]
        if !isArea {
            let keys = awcChartSeriesKeys(series)
            for (i, s) in series.enumerated() where s["hidden"] != .null { legendHidden[keys[i]] = nil; legendOrder.removeAll { $0 == keys[i] } }
        }
        rebuild()
    }

    /// The canvas box changed size: re-lay-out with the same spec (engine.resize → render), keeping hover focus.
    func resize() { rebuild() }
    func loadingChanged(now: Bool, before: Bool) { if before && !now { introToken += 1 } }
    /// chart.ts replay(): hasRendered = false; render() — the entrance plays again from t = 0.
    func replay() { introToken += 1; rebuild() }

    // ── emphasis (setFocus + its 260 ms fade) ──

    private func setFocus(_ idx: Int) {
        let target = idx >= 0 ? 1.0 : 0.0
        let si = idx >= 0 ? idx : emphasisSeries
        if target == emphasisTarget && si == emphasisSeries { return }
        emphasisSeries = si; emphasisTarget = target
        if reducedMotion {
            emphasisAnimating = false
            emphasisT = target
            if target == 0 { emphasisSeries = -1 }
            return
        }
        emphasisAnimating = true; emphasisLast = 0
    }

    func tick(_ now: Double) {
        guard emphasisAnimating else { return }
        let dt = emphasisLast == 0 ? 0 : now - emphasisLast
        emphasisLast = now
        let dir: Double = emphasisTarget > emphasisT ? 1 : -1
        emphasisT += dir * (dt / AWC_CHART_EMPHASIS_MS)
        if (dir > 0 && emphasisT >= emphasisTarget) || (dir < 0 && emphasisT <= emphasisTarget) {
            emphasisT = emphasisTarget
            if emphasisTarget == 0 { emphasisSeries = -1 }
            emphasisAnimating = false
        }
    }

    func drawnScene() -> AWCChartScene? { scene.map { awcChartEmphasizeScene($0, emphasisSeries, emphasisT) } }

    // ── hover layer ──

    private func clearHover() { hover = nil; hoverIndexAttr = nil }

    private func renderHover(_ s: AWCChartScene, _ index: Int, _ cx: Double, _ cy: Double, _ orient: String, _ focusSeries: Int) {
        let isNew = hoverIndexAttr != index
        if index < 0 { clearHover(); return }
        if index >= s.xPositions.count { hover = nil; return }
        hoverIndexAttr = index
        let model = awcChartHoverModel(s, index: index, yFormatter: yFormatter, cursor: CGPoint(x: cx, y: cy), orient: orient, focusSeries: focusSeries,
                                       trigger: tooltip == "item" ? "item" : "axis", missingFormatter: missingFormatter, renderer: renderer)
        // A custom card is positioned without the host direction (hover.ts passes no rtl on that path).
        hover = model.map { AWCChartHoverState(model: $0, scene: s, rtl: $0.customText != nil ? false : rtl, popStart: isNew && !reducedMotion ? now() : nil) }
    }

    /// Where the tooltip card goes for a measured card size; `roomAbove` = the host's top edge has room for it in the window.
    func tooltipOrigin(_ tw: Double, _ th: Double, roomAbove: Bool) -> CGPoint? {
        guard let h = hover, h.model.customText != nil || !h.model.rows.isEmpty else { return nil }
        // The Web places the card from offsetWidth / offsetHeight, which are whole pixels.
        let w = awcJSRound(tw), hh = awcJSRound(th)
        let o = awcChartTooltipOrigin(h.scene, size: CGSize(width: w, height: hh), cursor: h.model.cursor, orient: h.model.orient, pos: h.model.pos, rtl: h.rtl)
        return hh + 8 > h.scene.height && roomAbove ? CGPoint(x: o.x, y: awcJSRound(-hh - 6)) : o
    }

    private func nearestSeries(_ s: AWCChartScene, _ px: Double, _ py: Double) -> Int {
        if !s.areas.isEmpty && tooltip != "item" { focus.reset(); return -1 }
        let inArea = awcChartAreaSeriesAt(s, px, py)
        if inArea >= 0 { focus.reset(); return inArea }
        let inverted = s.inverted == true
        let lines = awcChartSeriesSampleLines(s)
        let candidates = s.hoverPoints.enumerated().map { (i, hp) in (seriesIndex: hp.seriesIndex, distance: awcChartDistanceToLine(lines[i], inverted ? py : px, inverted ? px : py)) }
        return focus.pick(candidates, now())
    }

    // ── pointer ──

    func insidePlot(_ px: Double, _ py: Double) -> Bool { guard let p = scene?.plot else { return false }; return awcChartInsidePlot(p, px, py) }

    func pointerDown(_ px: Double, _ py: Double, button: Int = 0) {
        downAt = (px, py); dragged = false
        guard zoomInside, button == 0, grab == nil, insidePlot(px, py) else { return }
        grab = .band(x: px)
        dragBand = (px, px)
    }

    func pointerMove(_ px: Double, _ py: Double) {
        if let d = downAt, hypot(px - d.0, py - d.1) > 8 { dragged = true }
        // The host's handler runs in the event; the engine's hover waits for the next frame, so it sees the result.
        if case .band(let x)? = grab, let p = scene?.plot { dragBand = (x, Swift.min(Swift.max(px, p.x), p.x + p.width)) }
        guard let s = scene, tooltip != "none" else { return }
        let inverted = s.inverted == true
        let idx = awcChartNearestIndex(s.xPositions, inverted ? py : px)
        let f = s.hoverPoints.count > 1 ? nearestSeries(s, px, py) : -1
        renderHover(s, idx, px, py, inverted ? "horizontal" : "vertical", f)
        setFocus(f)
        if idx != lastHoverIndex { lastHoverIndex = idx; hostHover(idx) }
    }

    func pointerLeave() {
        clearHover()
        focus.reset()
        setFocus(-1)
        if lastHoverIndex != -1 { lastHoverIndex = -1 }
    }

    /// Release: the host's drag-band end, then the click the browser fires, then dblclick on a quick second click.
    func pointerUp(_ px: Double, _ py: Double, insideCanvas: Bool = true) {
        let captured = grab != nil
        hostUp()
        if insideCanvas || captured {
            click(px, py)
            let t = now()
            if let prev = lastClick, t - prev.2 <= doubleClickMs, hypot(px - prev.0, py - prev.1) <= doubleClickSlop {
                lastClick = nil
                doubleClick(px, py)
            } else { lastClick = (px, py, t) }
        } else { dragged = false; downAt = nil }
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
        let wasDragged = dragged
        dragged = false; downAt = nil
        guard let s = scene, let hit = awcChartHitTestScene(s, px, py) else { return }
        switch hit {
        case .mark(let si, let di): if let d = clickDetail(si, di) { emit("mdMarkerClick", d) }
        case .line(let si, let di): if !wasDragged, let d = clickDetail(si, di) { emit("mdLineClick", d) }
        case .area(let si, let di): if !wasDragged, let d = clickDetail(si, di) { emit("mdAreaClick", d) }
        case .axis(let di): if !wasDragged { emit("mdAxisClick", axisDetail(di, awcChartAxisSeriesValues(s, di))) }
        }
    }

    func doubleClick(_ px: Double, _ py: Double) { if zoomInside && zoomWin != nil && insidePlot(px, py) { resetZoom() } }

    // ── zoom ──

    func applyZoom(_ start: Double, _ end: Double, reset: Bool = false) {
        let last = Swift.max(0, dataLength() - 1)
        let s = Swift.min(Swift.max(0, Int(awcJSRound(start))), Swift.max(0, last - 1))
        let e = Swift.min(Swift.max(s + 1, Int(awcJSRound(end))), last)
        zoomWin = reset ? nil : (s, e)
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

    private func specHidden(_ i: Int) -> Bool {
        guard i < series.count else { return false }
        return hiddenOverride[i] ?? series[i]["hidden"].bool ?? legendHidden[awcChartSeriesKeys(series)[i]] ?? false
    }

    private func remember(_ key: String, _ hidden: Bool) {
        legendOrder.removeAll { $0 == key }
        legendOrder.append(key); legendHidden[key] = hidden
        if legendOrder.count > 256 { legendHidden[legendOrder.removeFirst()] = nil }
    }

    func legendToggle(_ seriesIndex: Int) {
        guard seriesIndex >= 0, seriesIndex < series.count else { return }
        let nh = !specHidden(seriesIndex)
        hiddenOverride[seriesIndex] = nh
        introToken += 1
        rebuild()
        remember(awcChartSeriesKeys(series)[seriesIndex], nh)
        var d: [String: Any?] = ["seriesIndex": seriesIndex]
        if series[seriesIndex]["id"] != .null { d["seriesId"] = awcChartEventValue(series[seriesIndex]["id"]) }
        d["selected"] = !nh
        emit("mdLegendClick", d)
    }

    // ── keyboard ──

    func keyDown(_ key: String) -> Bool {
        let last: Int
        if isArea {
            guard let s = scene else { return false }
            last = Swift.max(0, s.xPositions.count - 1)
        } else {
            let length = dataLength()
            if length == 0 { return false }
            last = zoomWin != nil ? win().1 - win().0 : length - 1
        }
        if !isArea && (key == "Enter" || key == " ") {
            if kbIndex < 0 { return false }
            emit("mdAxisClick", axisDetail(kbIndex, seriesValuesAt(kbIndex)))
            return true
        }
        guard let next = awcChartKeyboardNext(key, current: kbIndex, last: last, rtl: rtl) else { return false }
        moveKeyboardCursor(next)
        return true
    }

    func blur() { if kbIndex >= 0 { moveKeyboardCursor(-1) } }

    private func moveKeyboardCursor(_ next: Int) {
        kbIndex = next
        focusIndex(next)
        if next < 0 { announcement = ""; return }
        let fmt = formatters.valueFormatter
        let yFmt: (Double) -> String = { v in fmt?(v) ?? AWCChartIntl.number(v, self.locale) }
        if isArea {
            let s = scene
            let xText = s.flatMap { next < $0.xLabels.count ? $0.xLabels[next] : nil } ?? String(next + 1)
            let values = (s?.hoverPoints ?? []).compactMap { hp in hp.byIndex[next].map { "\(hp.label) \(yFmt($0.value))" } }.joined(separator: ", ")
            announcement = awcChartJSReplaceFirst(awcChartJSReplaceFirst(labelPoint, "%x%", xText), "%values%", values)
            return
        }
        let abs = absOf(next)
        let xRaw = merged.flatMap { abs < $0.xValues.count ? $0.xValues[abs] : nil }
        let xText: String
        if let xf = formatters.xAxisFormatter, let x = xRaw { xText = xf(x) } else { xText = awcChartDefaultValueFormatter(xRaw ?? .number(Double(abs + 1)), locale) }
        let values = seriesValuesAt(next).compactMap { v in v.value.map { "\(v.label) \(yFmt($0))" } }.joined(separator: ", ")
        announcement = awcChartJSReplaceFirst(awcChartJSReplaceFirst(labelPoint, "%x%", xText), "%values%", values)
        emit("mdHover", ["dataIndex": abs, "axisValue": awcChartAxisDetail(xRaw), "seriesIndices": visibleSeriesIndices()])
    }

    /// chart.ts `focusIndex`: the pointer's hover UI, anchored on the topmost point at the index.
    private func focusIndex(_ index: Int) {
        guard let s = scene else { return }
        if index < 0 { clearHover(); focus.reset(); setFocus(-1); return }
        let inverted = s.inverted == true
        let pt = s.hoverPoints.lazy.compactMap { $0.byIndex[index] }.first
        let pos = index < s.xPositions.count ? s.xPositions[index] : 0
        renderHover(s, index, pt?.x ?? (inverted ? s.plot.x : pos), pt?.y ?? (inverted ? pos : s.plot.y), inverted ? "horizontal" : "vertical", -1)
    }

    // ── event payloads ──

    private func hostHover(_ idx: Int) {
        if idx < 0 { return }
        let abs = absOf(idx)
        emit("mdHover", ["dataIndex": abs, "axisValue": axisValueAt(abs), "seriesIndices": visibleSeriesIndices()])
    }

    func visibleSeriesIndices() -> [Int] {
        if let s = scene { return s.hoverPoints.map(\.seriesIndex) }
        if isArea { return series.indices.filter { series[$0]["hidden"].bool != true } }
        let keys = awcChartSeriesKeys(series)
        return series.indices.filter { !(series[$0]["hidden"].bool ?? legendHidden[keys[$0]] ?? false) }
    }

    private func seriesValuesAt(_ di: Int) -> [(seriesIndex: Int, label: String, value: Double?)] { scene.map { awcChartAxisSeriesValues($0, di) } ?? [] }

    private func ownIndex(_ si: Int, _ abs: Int) -> Int {
        guard let m = merged, si < m.toOwn.count, let toOwn = m.toOwn[si] else { return abs }
        return abs < toOwn.count ? toOwn[abs] : -1
    }

    private func clickDetail(_ si: Int, _ di: Int) -> [String: Any?]? {
        guard si >= 0, si < series.count else { return nil }
        let s = series[si]
        let abs = absOf(di)
        var d: [String: Any?] = ["seriesIndex": si]
        if s["id"] != .null { d["seriesId"] = awcChartEventValue(s["id"]) }
        let data = s["data"].array
        if isArea {
            d["dataIndex"] = abs
            d.updateValue(abs < data.count ? awcChartEventValue(data[abs]) : nil, forKey: "value")
        } else {
            let own = ownIndex(si, abs)
            d["dataIndex"] = own >= 0 ? own : abs
            d.updateValue(own >= 0 && own < data.count ? awcChartDatumYValue(data[own]) : nil, forKey: "value")
        }
        d.updateValue(axisValueAt(abs), forKey: "axisValue")
        d["series"] = s
        return d
    }

    private func axisDetail(_ di: Int, _ values: [(seriesIndex: Int, label: String, value: Double?)]) -> [String: Any?] {
        let abs = absOf(di)
        let sv: [[String: Any?]] = values.map { v in
            var m: [String: Any?] = ["seriesIndex": v.seriesIndex]
            if v.seriesIndex < series.count, series[v.seriesIndex]["id"] != .null { m["seriesId"] = awcChartEventValue(series[v.seriesIndex]["id"]) }
            m["label"] = v.label
            m["dataIndex"] = v.value == nil ? -1 : isArea ? abs : ownIndex(v.seriesIndex, abs)
            m.updateValue(v.value, forKey: "value")
            return m
        }
        return ["dataIndex": abs, "axisValue": axisValueAt(abs), "seriesValues": sv]
    }
}

/// A raw property value as a JS event detail would carry it.
func awcChartEventValue(_ v: AWCValue) -> Any? {
    switch v {
    case .null: return nil
    case .number(let n): return n
    case .string(let s): return s
    case .bool(let b): return b
    default: return v
    }
}
