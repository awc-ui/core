import SwiftUI

// Port of engine/renderer-canvas.ts (drawSceneCanvas) onto a SwiftUI GraphicsContext, plus
// emphasis.ts. Geometry comes straight from the RenderScene, so both platforms draw what the Web draws.

extension Color {
    /// A chart CSS colour string (hex, rgb()/rgba(), hsl(), named) as an sRGB colour.
    init(awcChartCSS css: String) {
        let c = awcChartParseColor(css)
        self.init(.sRGB, red: c.0, green: c.1, blue: c.2, opacity: Swift.max(0, Swift.min(1, c.3)))
    }
}

/// `ctx.fillStyle = color` with the canvas rule that an invalid colour leaves the previous style.
private func awcChartCSSValid(_ css: String) -> Bool { awcChartIsCSSColor(css) }

/// Canvas `arc(x, y, r, a0, a1, anticlockwise)` with its sweep normalisation.
func awcChartArc(_ p: inout Path, _ cx: Double, _ cy: Double, _ r: Double, _ a0: Double, _ a1: Double, _ ccw: Bool) {
    guard r >= 0, r.isFinite, a0.isFinite, a1.isFinite else { return }
    p.addArc(center: CGPoint(x: cx, y: cy), radius: r, startAngle: .radians(a0), endAngle: .radians(a1), clockwise: ccw)
}

private func awcTraceChevron(_ p: inout Path, _ b: AWCChartSceneBar) {
    let along = b.horizontal ?? (b.w > b.h)
    let t = awcChartChevronTipDepth(along ? b.h : b.w)
    let cut = b.notch == false ? 0 : t
    func m(_ x: Double, _ y: Double) { p.move(to: CGPoint(x: x, y: y)) }
    func l(_ x: Double, _ y: Double) { p.addLine(to: CGPoint(x: x, y: y)) }
    if along {
        let my = b.y + b.h / 2
        if b.arrow == 1 { m(b.x, b.y); l(b.x + b.w, b.y); l(b.x + b.w + t, my); l(b.x + b.w, b.y + b.h); l(b.x, b.y + b.h); if cut != 0 { l(b.x + cut, my) } }
        else { m(b.x + b.w, b.y); l(b.x, b.y); l(b.x - t, my); l(b.x, b.y + b.h); l(b.x + b.w, b.y + b.h); if cut != 0 { l(b.x + b.w - cut, my) } }
    } else {
        let mx = b.x + b.w / 2
        if b.arrow == 1 { m(b.x, b.y + b.h); l(b.x, b.y); l(mx, b.y - t); l(b.x + b.w, b.y); l(b.x + b.w, b.y + b.h); if cut != 0 { l(mx, b.y + b.h - cut) } }
        else { m(b.x, b.y); l(b.x, b.y + b.h); l(mx, b.y + b.h + t); l(b.x + b.w, b.y + b.h); l(b.x + b.w, b.y); if cut != 0 { l(mx, b.y + cut) } }
    }
    p.closeSubpath()
}

/// renderer-canvas.ts `traceSlice`: a ring sector with rounded corners and a surface-coloured gap.
func awcChartTraceSlice(_ p: inout Path, cx: Double, cy: Double, innerR: Double, outerR: Double, a0: Double, a1: Double, cornerRadius: Double?, gap: Double?) {
    let ccw = a1 < a0
    let towards: Double = ccw ? -1 : 1
    let sweep = abs(a1 - a0)
    func at(_ r: Double, _ a: Double) -> CGPoint { CGPoint(x: cx + cos(a) * r, y: cy + sin(a) * r) }
    let lone = sweep >= Double.pi * 2 - 0.01
    let g = lone ? 0 : Swift.min((gap ?? 0) / 2, outerR * sin(sweep / 2) * 0.4)
    func insetAt(_ R: Double) -> Double { g > 0 && R > g ? asin(Swift.min(1, g / R)) : 0 }
    let b0 = a0 + towards * insetAt(outerR), b1 = a1 - towards * insetAt(outerR)
    if towards * (b1 - b0) <= 0 { return }
    func edgeAt(_ base: Double, _ dir: Double, _ R: Double) -> Double {
        let mid = (a0 + a1) / 2
        let a = base + dir * insetAt(R)
        return dir * towards > 0 ? Swift.min(a * towards, mid * towards) * towards : Swift.max(a * towards, mid * towards) * towards
    }
    let span = Swift.min(abs(b1 - b0), Double.pi / 2) / 4
    let maxByBand = (outerR - innerR) / 2
    let maxBySweep = outerR * tan(span)
    let maxBySweepInner = innerR > 0 ? innerR * tan(span) : .infinity
    let r = Swift.max(0, Swift.min(cornerRadius ?? 0, maxByBand, maxBySweep, maxBySweepInner))
    let n0 = edgeAt(a0, towards, Swift.max(innerR, 0.01)), n1 = edgeAt(a1, -towards, Swift.max(innerR, 0.01))
    if r < 0.5 {
        p.move(to: at(innerR, n0))
        p.addLine(to: at(outerR, b0))
        awcChartArc(&p, cx, cy, outerR, b0, b1, ccw)
        p.addLine(to: at(innerR, n1))
        if innerR > 0 && towards * (n1 - n0) > 0 { awcChartArc(&p, cx, cy, innerR, n1, n0, !ccw) }
        p.closeSubpath()
        return
    }
    let rhoO = outerR - r
    let dO = asin(Swift.min(1, r / rhoO)) * towards
    let footO = (Swift.max(0, rhoO * rhoO - r * r)).squareRoot()
    let c0 = b0 + dO, c1 = b1 - dO
    let donut = innerR > 0
    let rhoI = innerR + r
    let dI = asin(Swift.min(1, r / rhoI)) * towards
    let footI = (Swift.max(0, rhoI * rhoI - r * r)).squareRoot()
    let i0 = edgeAt(a0, towards, rhoI), i1 = edgeAt(a1, -towards, rhoI)
    let e0 = i0 + dI, e1 = i1 - dI
    let off0 = b0 + (ccw ? Double.pi / 2 : -Double.pi / 2)
    let off1 = b1 + (ccw ? -Double.pi / 2 : Double.pi / 2)
    p.move(to: at(donut ? footI : 0, i0))
    p.addLine(to: at(footO, b0))
    awcChartArc(&p, at(rhoO, c0).x, at(rhoO, c0).y, r, off0, c0, ccw)
    awcChartArc(&p, cx, cy, outerR, c0, c1, ccw)
    awcChartArc(&p, at(rhoO, c1).x, at(rhoO, c1).y, r, c1, off1, ccw)
    p.addLine(to: at(footO, b1))
    if donut {
        p.addLine(to: at(footI, i1))
        awcChartArc(&p, at(rhoI, e1).x, at(rhoI, e1).y, r, off1, e1 + Double.pi, ccw)
        if towards * (e1 - e0) > 0 { awcChartArc(&p, cx, cy, innerR, e1, e0, !ccw) }
        awcChartArc(&p, at(rhoI, e0).x, at(rhoI, e0).y, r, e0 + Double.pi, off0, ccw)
    } else {
        p.addLine(to: at(0, i1))
    }
    p.closeSubpath()
}

/// Canvas `roundRect(x, y, w, h, [tl, tr, br, bl])`.
func awcChartRoundRect(_ p: inout Path, _ x: Double, _ y: Double, _ w: Double, _ h: Double, _ r: [Double]) {
    let tl = r[0], tr = r[1], br = r[2], bl = r[3]
    p.move(to: CGPoint(x: x + tl, y: y))
    p.addLine(to: CGPoint(x: x + w - tr, y: y))
    if tr > 0 { awcChartArc(&p, x + w - tr, y + tr, tr, -Double.pi / 2, 0, false) }
    p.addLine(to: CGPoint(x: x + w, y: y + h - br))
    if br > 0 { awcChartArc(&p, x + w - br, y + h - br, br, 0, Double.pi / 2, false) }
    p.addLine(to: CGPoint(x: x + bl, y: y + h))
    if bl > 0 { awcChartArc(&p, x + bl, y + h - bl, bl, Double.pi / 2, Double.pi, false) }
    p.addLine(to: CGPoint(x: x, y: y + tl))
    if tl > 0 { awcChartArc(&p, x + tl, y + tl, tl, Double.pi, Double.pi * 1.5, false) }
    p.closeSubpath()
}

private func awcAreaGradient(_ a: AWCChartSceneArea, _ hasBase: Bool) -> (start: CGPoint, end: CGPoint, stops: [Gradient.Stop]) {
    let horiz = a.horizontal == true
    func at(_ p: AWCChartPt) -> Double { horiz ? p.x : p.y }
    var coords = a.points.map(at)
    if hasBase { coords += a.basePoints!.map(at) }
    coords.append(a.baselineY)
    let lo = coords.min()!, hi = coords.max()!
    let start = horiz ? CGPoint(x: lo, y: 0) : CGPoint(x: 0, y: lo)
    let end = horiz ? CGPoint(x: hi, y: 0) : CGPoint(x: 0, y: hi)
    let top = Color(awcChartCSS: a.colorTop), bottom = Color(awcChartCSS: a.colorBottom)
    let span = hi - lo
    if span < 1e-6 { return (start, end, [.init(color: top, location: 0), .init(color: bottom, location: 1)]) }
    let t = (a.baselineY - lo) / span
    if t <= 1e-4 { return (start, end, [.init(color: bottom, location: 0), .init(color: top, location: 1)]) }
    if t >= 1 - 1e-4 { return (start, end, [.init(color: top, location: 0), .init(color: bottom, location: 1)]) }
    return (start, end, [.init(color: top, location: 0), .init(color: bottom, location: t), .init(color: top, location: 1)])
}

private func awcStroke(_ ctx: inout GraphicsContext, _ g: AWCChartSegment, cap: CGLineCap = .butt) {
    var p = Path(); p.move(to: CGPoint(x: g.x1, y: g.y1)); p.addLine(to: CGPoint(x: g.x2, y: g.y2))
    ctx.stroke(p, with: .color(Color(awcChartCSS: g.color)), style: StrokeStyle(lineWidth: g.width, lineCap: cap, dash: (g.dash ?? []).map { CGFloat($0) }))
}

/// renderer-canvas.ts `drawSceneCanvas`.
func awcChartDrawScene(_ ctx: inout GraphicsContext, _ scene: AWCChartScene) {
    if let bg = scene.background { ctx.fill(Path(CGRect(x: 0, y: 0, width: scene.width, height: scene.height)), with: .color(Color(awcChartCSS: bg))) }
    for b in scene.bands ?? [] where awcChartCSSValid(b.color) {
        ctx.fill(Path(CGRect(x: b.x, y: b.y, width: b.w, height: b.h)), with: .color(Color(awcChartCSS: b.color)))
    }
    for g in scene.gridlines { awcStroke(&ctx, g) }
    for a in scene.areas where a.points.count >= 2 {
        let hasBase = !(a.basePoints?.isEmpty ?? true)
        var p = Path()
        p.move(to: CGPoint(x: a.points[0].x, y: a.points[0].y))
        for pt in a.points.dropFirst() { p.addLine(to: CGPoint(x: pt.x, y: pt.y)) }
        if hasBase { for pt in a.basePoints!.reversed() { p.addLine(to: CGPoint(x: pt.x, y: pt.y)) } }
        else { p.addLine(to: CGPoint(x: a.points[a.points.count - 1].x, y: a.baselineY)); p.addLine(to: CGPoint(x: a.points[0].x, y: a.baselineY)) }
        p.closeSubpath()
        let g = awcAreaGradient(a, hasBase)
        ctx.fill(p, with: .linearGradient(Gradient(stops: g.stops), startPoint: g.start, endPoint: g.end))
    }
    for a in scene.axisLines { awcStroke(&ctx, a) }
    for b in scene.bars where b.w > 0 && b.h > 0 {
        var p = Path()
        if let arrow = b.arrow, arrow != 0 { awcTraceChevron(&p, b) }
        else {
            let maxR = Swift.min(b.w, b.h) / 2
            awcChartRoundRect(&p, b.x, b.y, b.w, b.h, b.radius.map { Swift.max(0, Swift.min($0, maxR)) })
        }
        ctx.fill(p, with: .color(Color(awcChartCSS: b.color)))
    }
    let backed = scene.slices.filter { $0.pill != true && ($0.gap ?? 0) != 0 && $0.gapColor != nil && $0.endAngle != $0.startAngle }
    if !backed.isEmpty {
        var p = Path()
        for s in backed { awcChartTraceSlice(&p, cx: s.cx, cy: s.cy, innerR: s.innerR, outerR: s.outerR, a0: s.startAngle, a1: s.endAngle, cornerRadius: s.cornerRadius, gap: 0) }
        ctx.fill(p, with: .color(Color(awcChartCSS: backed[0].gapColor!)))
    }
    for s in scene.slices where s.endAngle != s.startAngle {
        if s.pill == true {
            let mid = (s.innerR + s.outerR) / 2, thickness = abs(s.outerR - s.innerR)
            if thickness <= 0 || mid <= 0 { continue }
            let perEnd = s.capStart != nil || s.capEnd != nil
            let color = Color(awcChartCSS: s.color)
            var p = Path()
            awcChartArc(&p, s.cx, s.cy, mid, s.startAngle, s.endAngle, s.endAngle < s.startAngle)
            ctx.stroke(p, with: .color(color), style: StrokeStyle(lineWidth: thickness, lineCap: perEnd ? .butt : .round))
            if perEnd {
                func cap(_ angle: Double) { var c = Path(); awcChartArc(&c, s.cx + mid * cos(angle), s.cy + mid * sin(angle), thickness / 2, 0, Double.pi * 2, false); ctx.fill(c, with: .color(color)) }
                if s.capStart == true { cap(s.startAngle) }
                if s.capEnd == true { cap(s.endAngle) }
            }
            continue
        }
        var p = Path()
        awcChartTraceSlice(&p, cx: s.cx, cy: s.cy, innerR: s.innerR, outerR: s.outerR, a0: s.startAngle, a1: s.endAngle, cornerRadius: s.cornerRadius, gap: s.gap)
        if let gr = s.gradient {
            let mid = (s.startAngle + s.endAngle) / 2
            ctx.fill(p, with: .linearGradient(Gradient(colors: [Color(awcChartCSS: gr.from), Color(awcChartCSS: gr.to)]),
                                              startPoint: CGPoint(x: s.cx + cos(mid) * s.innerR, y: s.cy + sin(mid) * s.innerR),
                                              endPoint: CGPoint(x: s.cx + cos(mid) * s.outerR, y: s.cy + sin(mid) * s.outerR)))
        } else { ctx.fill(p, with: .color(Color(awcChartCSS: s.color))) }
    }
    if let rip = scene.ripple, rip.alpha > 0, rip.radius > 0, let host = scene.slices.first(where: { $0.pill != true && $0.dataIndex == rip.dataIndex }) {
        var clip = Path()
        awcChartTraceSlice(&clip, cx: host.cx, cy: host.cy, innerR: host.innerR, outerR: host.outerR, a0: host.startAngle, a1: host.endAngle, cornerRadius: host.cornerRadius, gap: host.gap)
        ctx.drawLayer { layer in
            layer.clip(to: clip)
            layer.opacity = rip.alpha
            var c = Path(); awcChartArc(&c, rip.x, rip.y, rip.radius, 0, Double.pi * 2, false)
            layer.fill(c, with: .color(Color(awcChartCSS: rip.color)))
        }
    }
    for line in scene.lines {
        let color = Color(awcChartCSS: line.color)
        if line.points.count < 2 {
            if line.points.count == 1 { var c = Path(); awcChartArc(&c, line.points[0].x, line.points[0].y, line.width, 0, Double.pi * 2, false); ctx.fill(c, with: .color(color)) }
            continue
        }
        var p = Path()
        p.move(to: CGPoint(x: line.points[0].x, y: line.points[0].y))
        for pt in line.points.dropFirst() { p.addLine(to: CGPoint(x: pt.x, y: pt.y)) }
        let cap: CGLineCap = line.cap == "butt" ? .butt : line.cap == "square" ? .square : .round
        ctx.stroke(p, with: .color(color), style: StrokeStyle(lineWidth: line.width, lineCap: cap, lineJoin: .round, dash: (line.dash ?? []).map { CGFloat($0) }))
    }
    for m in scene.markers {
        var p = Path()
        if let poly = awcChartMarkerPolygon(m.symbol, m.x, m.y, m.r) {
            p.move(to: CGPoint(x: poly[0].x, y: poly[0].y))
            for pt in poly.dropFirst() { p.addLine(to: CGPoint(x: pt.x, y: pt.y)) }
            p.closeSubpath()
        } else { awcChartArc(&p, m.x, m.y, m.r, 0, Double.pi * 2, false) }
        if m.hollow == true {
            ctx.fill(p, with: .color(Color(awcChartCSS: m.fill ?? "rgba(0,0,0,0)")))
            ctx.stroke(p, with: .color(Color(awcChartCSS: m.color)), style: StrokeStyle(lineWidth: 2, lineCap: .round, lineJoin: .round))
        } else {
            ctx.fill(p, with: .color(Color(awcChartCSS: m.color)))
            ctx.stroke(p, with: .color(Color(awcChartCSS: "rgba(255,255,255,0.9)")), style: StrokeStyle(lineWidth: 1.5, lineCap: .round, lineJoin: .round))
        }
    }
}

// MARK: emphasis.ts

let AWC_CHART_EMPHASIS_MS = 260.0
let AWC_CHART_FOCUS_STICK = 4.0
let AWC_CHART_FOCUS_DWELL_MS = 140.0

func awcChartEmphasizeScene(_ scene: AWCChartScene, _ focusIndex: Int, _ t: Double) -> AWCChartScene {
    if focusIndex < 0 || t <= 0 { return scene }
    let factor = 1 - (1 - 0.22) * Swift.min(1, t)
    func dim(_ si: Int?) -> Bool { si != nil && si! != focusIndex }
    var s = scene
    s.lines = scene.lines.map { var l = $0; if dim(l.seriesIndex) { l.color = awcChartWithAlpha(l.color, factor) }; return l }
    s.areas = scene.areas.map { var a = $0; if dim(a.seriesIndex) { a.colorTop = awcChartWithAlpha(a.colorTop, factor); a.colorBottom = awcChartWithAlpha(a.colorBottom, factor) }; return a }
    s.markers = scene.markers.map { var m = $0; if dim(m.seriesIndex) { m.color = awcChartWithAlpha(m.color, factor) }; return m }
    return s
}

func awcChartDistanceToLine(_ points: [(Double, Double)], _ cursorMain: Double, _ cursorValue: Double) -> Double {
    let n = points.count
    if n == 0 { return .infinity }
    let first = points[0], last = points[n - 1]
    if cursorMain <= first.0 { return hypot(first.0 - cursorMain, first.1 - cursorValue) }
    if cursorMain >= last.0 { return hypot(last.0 - cursorMain, last.1 - cursorValue) }
    var lo = 0, hi = n - 1
    while hi - lo > 1 { let mid = (lo + hi) >> 1; if points[mid].0 <= cursorMain { lo = mid } else { hi = mid } }
    let a = points[lo], b = points[hi]
    let t = b.0 == a.0 ? 0 : (cursorMain - a.0) / (b.0 - a.0)
    return abs(a.1 + (b.1 - a.1) * t - cursorValue)
}

func awcChartPickFocusSeries(_ candidates: [(seriesIndex: Int, distance: Double)], _ held: Int, _ stick: Double = AWC_CHART_FOCUS_STICK) -> Int {
    var best = -1, bestD = Double.infinity, heldD = Double.infinity
    for c in candidates {
        if c.seriesIndex == held { heldD = c.distance }
        if c.distance < bestD { bestD = c.distance; best = c.seriesIndex }
    }
    if held >= 0 && bestD > heldD - stick { return held }
    return best
}

/// emphasis.ts `HoverFocus`: hysteresis + dwell so the emphasised series doesn't flicker between close lines.
final class AWCChartHoverFocus {
    private var held = -1, candidate = -1
    private var since = 0.0
    func pick(_ candidates: [(seriesIndex: Int, distance: Double)], _ now: Double) -> Int {
        let wanted = awcChartPickFocusSeries(candidates, held)
        if wanted != candidate { candidate = wanted; since = now }
        if held < 0 { held = wanted } else if wanted != held && now - since >= AWC_CHART_FOCUS_DWELL_MS { held = wanted }
        return held
    }
    func reset() { held = -1; candidate = -1; since = 0 }
}
