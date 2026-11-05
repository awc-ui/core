import Foundation

// Port of engine/hit-test.ts: which mark / line / area / category a plot point lands on.

let AWC_CHART_MARK_HIT_RADIUS = 26.0
let AWC_CHART_LINE_HIT_TOLERANCE = 8.0

enum AWCChartHit: Equatable { case mark(series: Int, index: Int), line(series: Int, index: Int), area(series: Int, index: Int), axis(index: Int) }

func awcChartNearestIndex(_ positions: [Double], _ px: Double) -> Int {
    if positions.isEmpty { return -1 }
    var best = 0, bestD = Double.infinity
    for (i, p) in positions.enumerated() { let d = abs(p - px); if d < bestD { bestD = d; best = i } }
    return best
}

/// hit-test.ts `seriesSampleLines` (byIndex keys enumerate in ascending numeric order, like JS objects).
func awcChartSeriesSampleLines(_ scene: AWCChartScene) -> [[(Double, Double)]] {
    let inverted = scene.inverted == true
    return scene.hoverPoints.map { hp in
        let pts: [(Double, Double)] = hp.byIndex.keys.sorted().map { k in let p = hp.byIndex[k]!; return inverted ? (p.y, p.x) : (p.x, p.y) }
        if pts.count >= 2 && pts[0].0 > pts[pts.count - 1].0 { return Array(pts.reversed()) }
        return pts
    }
}

func awcChartAxisSeriesValues(_ scene: AWCChartScene, _ index: Int) -> [(seriesIndex: Int, label: String, value: Double?)] {
    scene.hoverPoints.map { ($0.seriesIndex, $0.label, $0.byIndex[index]?.value) }
}

func awcChartInsidePlot(_ plot: AWCChartRect, _ px: Double, _ py: Double) -> Bool { px >= plot.x && px <= plot.x + plot.width && py >= plot.y && py <= plot.y + plot.height }

private func polylineY(_ input: [AWCChartPt], _ x: Double) -> Double? {
    let n = input.count
    if n == 0 { return nil }
    let points = n > 1 && input[0].x > input[n - 1].x ? Array(input.reversed()) : input
    if x < points[0].x || x > points[n - 1].x { return nil }
    if n == 1 { return points[0].y }
    var lo = 0, hi = n - 1
    while hi - lo > 1 { let mid = (lo + hi) >> 1; if points[mid].x <= x { lo = mid } else { hi = mid } }
    let a = points[lo], b = points[hi]
    return b.x == a.x ? a.y : a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x)
}

private func areaContains(_ area: AWCChartSceneArea, _ px: Double, _ py: Double) -> Bool {
    guard let top = polylineY(area.points, px) else { return false }
    let base = (area.basePoints.flatMap { polylineY($0, px) }) ?? area.baselineY
    return py >= Swift.min(top, base) && py <= Swift.max(top, base)
}

func awcChartAreaSeriesAt(_ scene: AWCChartScene, _ px: Double, _ py: Double) -> Int {
    if !awcChartInsidePlot(scene.plot, px, py) { return -1 }
    var best = -1, bestD = Double.infinity
    for a in scene.areas {
        guard let si = a.seriesIndex, areaContains(a, px, py) else { continue }
        let d = polylineY(a.points, px).map { abs(py - $0) } ?? .infinity
        if d < bestD { bestD = d; best = si }
    }
    return best
}

func awcChartHitTestScene(_ scene: AWCChartScene, _ px: Double, _ py: Double, lines: [[(Double, Double)]]? = nil) -> AWCChartHit? {
    let lines = lines ?? awcChartSeriesSampleLines(scene)
    let inverted = scene.inverted == true
    let cursorMain = inverted ? py : px, cursorValue = inverted ? px : py
    let dataIndex = awcChartNearestIndex(scene.xPositions, cursorMain)
    if dataIndex < 0 { return nil }
    var markSeries = -1, markD = Double.infinity
    for hp in scene.hoverPoints { guard let p = hp.byIndex[dataIndex] else { continue }; let d = hypot(p.x - px, p.y - py); if d < markD { markD = d; markSeries = hp.seriesIndex } }
    if markSeries >= 0 && markD <= AWC_CHART_MARK_HIT_RADIUS { return .mark(series: markSeries, index: dataIndex) }
    if !awcChartInsidePlot(scene.plot, px, py) { return nil }
    var lineSeries = -1, lineD = Double.infinity
    for (i, hp) in scene.hoverPoints.enumerated() { let d = awcChartDistanceToLine(i < lines.count ? lines[i] : [], cursorMain, cursorValue); if d < lineD { lineD = d; lineSeries = hp.seriesIndex } }
    if lineSeries >= 0 && lineD <= AWC_CHART_LINE_HIT_TOLERANCE { return .line(series: lineSeries, index: dataIndex) }
    var areaSeries = -1, areaD = Double.infinity
    for a in scene.areas {
        guard let si = a.seriesIndex, areaContains(a, px, py) else { continue }
        let d = abs(py - (polylineY(a.points, px) ?? .nan))
        if d < areaD { areaD = d; areaSeries = si }
    }
    if areaSeries >= 0 { return .area(series: areaSeries, index: dataIndex) }
    return .axis(index: dataIndex)
}
