import Foundation

// Port of engine/animate.ts: entrance variants as pure scene transforms of the settled scene.

let AWC_CHART_INTRO_MS = 700.0
private func clamp01(_ n: Double) -> Double { n < 0 ? 0 : n > 1 ? 1 : n }

func awcChartExpressiveEase(_ t: Double) -> Double { t <= 0 ? 0 : t >= 1 ? 1 : 1 - exp(-7 * t) * cos(6 * t) }
func awcChartEaseOutCubic(_ t: Double) -> Double { 1 - pow(1 - clamp01(t), 3) }
func awcChartEaseInOutCubic(_ t: Double) -> Double { let c = clamp01(t); return c < 0.5 ? 4 * c * c * c : 1 - pow(-2 * c + 2, 3) / 2 }

/// animate.ts `cubicBezier` (Newton then bisection, same iteration counts).
func awcChartCubicBezier(_ x1: Double, _ y1: Double, _ x2: Double, _ y2: Double) -> (Double) -> Double {
    let cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx
    let cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by
    func sampleX(_ t: Double) -> Double { ((ax * t + bx) * t + cx) * t }
    func sampleY(_ t: Double) -> Double { ((ay * t + by) * t + cy) * t }
    func slopeX(_ t: Double) -> Double { (3 * ax * t + 2 * bx) * t + cx }
    return { x in
        if x <= 0 { return 0 }
        if x >= 1 { return 1 }
        var t = x
        for _ in 0..<8 {
            let err = sampleX(t) - x
            if abs(err) < 1e-6 { return sampleY(t) }
            let d = slopeX(t)
            if abs(d) < 1e-6 { break }
            t -= err / d
        }
        var lo = 0.0, hi = 1.0
        t = x
        for _ in 0..<24 {
            let err = sampleX(t) - x
            if abs(err) < 1e-6 { break }
            if err > 0 { hi = t } else { lo = t }
            t = (lo + hi) / 2
        }
        return sampleY(t)
    }
}

let awcChartEmphasizedDecelerate = awcChartCubicBezier(0.05, 0.7, 0.1, 1)

func awcChartEasingFor(_ variant: String) -> (Double) -> Double {
    variant == "draw" || variant == "stagger" ? awcChartEaseInOutCubic : awcChartEmphasizedDecelerate
}

private func isHorizontalBar(_ b: AWCChartSceneBar) -> Bool { b.horizontal ?? (b.w > b.h) }

func awcChartGrowBar(_ b: AWCChartSceneBar, _ e: Double, _ base: Double?) -> AWCChartSceneBar {
    var o = b
    if isHorizontalBar(b) {
        let x0 = base ?? b.x
        let a = x0 + (b.x - x0) * e, z = x0 + (b.x + b.w - x0) * e
        o.x = Swift.min(a, z); o.w = abs(z - a)
    } else {
        let y0 = base ?? (b.y + b.h)
        let a = y0 + (b.y - y0) * e, z = y0 + (b.y + b.h - y0) * e
        o.y = Swift.min(a, z); o.h = abs(z - a)
    }
    return o
}

private func animateSlices(_ scene: AWCChartScene, _ e: Double) -> [AWCChartSceneSlice] {
    if scene.polar == true {
        var base: [Int: Double] = [:]
        for s in scene.slices { if let cur = base[s.dataIndex] { if s.startAngle < cur { base[s.dataIndex] = s.startAngle } } else { base[s.dataIndex] = s.startAngle } }
        return scene.slices.map { s in var o = s; let s0 = base[s.dataIndex]!; o.startAngle = s0 + (s.startAngle - s0) * e; o.endAngle = s0 + (s.endAngle - s0) * e; return o }
    }
    let g = clamp01(e)
    return scene.slices.map { var o = $0; o.innerR = $0.innerR * g; o.outerR = $0.outerR * g; return o }
}

func awcChartEaseScene(_ scene: AWCChartScene, _ e: Double) -> AWCChartScene {
    let baseY = scene.plot.y + scene.plot.height
    func lift(_ y: Double) -> Double { baseY + (y - baseY) * e }
    func liftPts(_ p: [AWCChartPt]) -> [AWCChartPt] { p.map { AWCChartPt(x: $0.x, y: lift($0.y)) } }
    var s = scene
    s.lines = scene.lines.map { l in
        var o = l
        if l.radial != true { o.points = liftPts(l.points); return o }
        let cx = scene.plot.x + scene.plot.width / 2, cy = scene.plot.y + scene.plot.height / 2, g = clamp01(e)
        o.points = l.points.map { AWCChartPt(x: cx + ($0.x - cx) * g, y: cy + ($0.y - cy) * g) }
        return o
    }
    s.areas = scene.areas.map { var a = $0; a.points = liftPts($0.points); a.basePoints = $0.basePoints.map(liftPts); return a }
    s.markers = scene.markers.map { var m = $0; m.y = lift($0.y); return m }
    s.glyphs = scene.glyphs?.map { var g = $0; g.y = lift($0.y); return g }
    s.endLabels = scene.endLabels?.map { var l = $0; l.y = lift($0.y); return l }
    s.bars = scene.bars.map { awcChartGrowBar($0, e, scene.barBaseline) }
    s.slices = animateSlices(scene, e)
    return s
}

private func trimPolylineX(_ pts: [AWCChartPt], _ cutX: Double) -> [AWCChartPt] {
    var out: [AWCChartPt] = []
    for (i, p) in pts.enumerated() {
        if p.x <= cutX { out.append(p) }
        else {
            if i > 0 { let a = pts[i - 1]; let d = p.x - a.x; let span = d == 0 || d.isNaN ? 1 : d; let f = (cutX - a.x) / span; out.append(AWCChartPt(x: cutX, y: a.y + (p.y - a.y) * f)) }
            break
        }
    }
    return out
}

func awcChartRevealScene(_ scene: AWCChartScene, _ e: Double) -> AWCChartScene {
    let p = scene.plot, ec = clamp01(e)
    let cutX = p.x + ec * p.width, cutY = p.y + ec * p.height
    var s = scene
    s.lines = scene.lines.map { l in l.radial == true ? l : { var o = l; o.points = trimPolylineX(l.points, cutX); return o }() }
    s.areas = scene.areas.map { var a = $0; a.points = trimPolylineX($0.points, cutX); a.basePoints = $0.basePoints.map { trimPolylineX($0, cutX) }; return a }
    s.markers = scene.markers.filter { $0.x <= cutX }
    s.glyphs = scene.glyphs?.filter { $0.x <= cutX }
    s.bars = scene.bars.map { b in
        let localE = isHorizontalBar(b) ? clamp01((cutY - b.y) / Swift.max(b.h, 1)) : clamp01((cutX - b.x) / Swift.max(b.w, 1))
        return awcChartGrowBar(b, localE, scene.barBaseline)
    }
    s.slices = scene.slices.map { var o = $0; o.endAngle = $0.startAngle + ($0.endAngle - $0.startAngle) * ec; return o }
    return s
}

func awcChartStaggerReveal(_ scene: AWCChartScene, _ tRaw: Double) -> AWCChartScene {
    let order = Array(Set(scene.lines.map { $0.seriesIndex ?? 0 })).sorted()
    let n = Double(order.isEmpty ? 1 : order.count)
    var rank: [Int: Int] = [:]
    for (k, si) in order.enumerated() { rank[si] = k }
    let p = scene.plot
    func cutXFor(_ si: Int?) -> Double { let k = Double(rank[si ?? 0] ?? 0); return p.x + awcChartEaseInOutCubic(clamp01(tRaw * n - k)) * p.width }
    let globalCut = p.x + awcChartEaseInOutCubic(clamp01(tRaw)) * p.width
    var s = scene
    s.lines = scene.lines.map { l in l.radial == true ? l : { var o = l; o.points = trimPolylineX(l.points, cutXFor(l.seriesIndex)); return o }() }
    s.areas = scene.areas.map { var a = $0; let c = cutXFor($0.seriesIndex); a.points = trimPolylineX($0.points, c); a.basePoints = $0.basePoints.map { trimPolylineX($0, c) }; return a }
    s.markers = scene.markers.filter { $0.x <= cutXFor($0.seriesIndex) }
    s.glyphs = scene.glyphs?.filter { $0.x <= globalCut }
    s.bars = scene.bars.map { awcChartGrowBar($0, clamp01((globalCut - $0.x) / Swift.max($0.w, 1)), scene.barBaseline) }
    s.slices = scene.slices.map { var o = $0; o.endAngle = $0.startAngle + ($0.endAngle - $0.startAngle) * clamp01(tRaw); return o }
    return s
}

/// animate.ts `resolveIntro`.
func awcChartResolveIntro(animation: String?, animationDuration: Double?, animate: Bool?) -> (variant: String, duration: Double) {
    var variant = animation ?? (animate == false ? "none" : "expressive")
    let requested = animationDuration ?? AWC_CHART_INTRO_MS
    let ok = requested.isFinite && requested > 0
    if !ok { variant = "none" }
    return (variant, ok ? requested : AWC_CHART_INTRO_MS)
}

private func fadeGrid(_ scene: AWCChartScene, _ e: Double) -> [AWCChartSegment] {
    let a = clamp01(e * 2)
    if a >= 1 { return scene.gridlines }
    return scene.gridlines.map { var g = $0; g.color = awcChartWithAlpha($0.color, a); return g }
}

/// animate.ts `stepAnimation`: the frame scene and the canvas/glyph layer opacity.
func awcChartStepAnimation(_ variant: String, _ target: AWCChartScene, _ tRaw: Double) -> (scene: AWCChartScene, alpha: Double) {
    let e = awcChartEasingFor(variant)(clamp01(tRaw))
    switch variant {
    case "fade": return (target, clamp01(e))
    case "draw": var s = awcChartRevealScene(target, e); s.gridlines = fadeGrid(target, e); return (s, 1)
    case "stagger": let t = clamp01(tRaw); var s = awcChartStaggerReveal(target, t); s.gridlines = fadeGrid(target, t); return (s, 1)
    default: return (awcChartEaseScene(target, e), clamp01(e))
    }
}
