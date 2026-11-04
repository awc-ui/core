import Foundation

// The RenderScene as the Web oracle serialises it (`sceneJson`: JSON.stringify with every number
// rounded to 0.01 and non-finite numbers as strings; undefined fields and functions omitted).
// Used by the parity fixtures and the Laboratory's inspection.

func awcChartSceneJSON(_ s: AWCChartScene) -> [String: Any] {
    func n(_ v: Double) -> Any { v.isFinite ? awcJSRound(v * 100) / 100 : awcJSNumberString(v) }
    func pt(_ p: AWCChartPt) -> [String: Any] { ["x": n(p.x), "y": n(p.y)] }
    func put(_ d: inout [String: Any], _ k: String, _ v: Any?) { if let v { d[k] = v } }
    func seg(_ g: AWCChartSegment) -> [String: Any] {
        var d: [String: Any] = ["x1": n(g.x1), "y1": n(g.y1), "x2": n(g.x2), "y2": n(g.y2), "color": g.color, "width": n(g.width)]
        put(&d, "dash", g.dash?.map(n)); return d
    }
    var o: [String: Any] = ["width": n(s.width), "height": n(s.height), "plot": ["x": n(s.plot.x), "y": n(s.plot.y), "width": n(s.plot.width), "height": n(s.plot.height)]]
    put(&o, "barBaseline", s.barBaseline.map(n))
    put(&o, "background", s.background)
    put(&o, "bands", s.bands?.map { ["x": n($0.x), "y": n($0.y), "w": n($0.w), "h": n($0.h), "color": $0.color] as [String: Any] })
    o["gridlines"] = s.gridlines.map(seg)
    o["axisLines"] = s.axisLines.map(seg)
    o["areas"] = s.areas.map { a -> [String: Any] in
        var d: [String: Any] = ["points": a.points.map(pt), "baselineY": n(a.baselineY), "colorTop": a.colorTop, "colorBottom": a.colorBottom]
        put(&d, "basePoints", a.basePoints?.map(pt)); put(&d, "horizontal", a.horizontal); put(&d, "seriesIndex", a.seriesIndex); return d
    }
    o["bars"] = s.bars.map { b -> [String: Any] in
        var d: [String: Any] = ["x": n(b.x), "y": n(b.y), "w": n(b.w), "h": n(b.h), "color": b.color, "radius": b.radius.map(n), "seriesIndex": b.seriesIndex, "dataIndex": b.dataIndex]
        put(&d, "horizontal", b.horizontal); put(&d, "arrow", b.arrow); put(&d, "notch", b.notch); return d
    }
    o["slices"] = s.slices.map { c -> [String: Any] in
        var d: [String: Any] = ["cx": n(c.cx), "cy": n(c.cy), "innerR": n(c.innerR), "outerR": n(c.outerR), "startAngle": n(c.startAngle), "endAngle": n(c.endAngle), "color": c.color, "dataIndex": c.dataIndex]
        put(&d, "seriesIndex", c.seriesIndex); put(&d, "cornerRadius", c.cornerRadius.map(n)); put(&d, "gap", c.gap.map(n)); put(&d, "gapColor", c.gapColor)
        if let g = c.gradient { d["gradient"] = ["from": g.from, "to": g.to] }
        put(&d, "pill", c.pill); put(&d, "capStart", c.capStart); put(&d, "capEnd", c.capEnd); return d
    }
    o["lines"] = s.lines.map { l -> [String: Any] in
        var d: [String: Any] = ["points": l.points.map(pt), "color": l.color, "width": n(l.width)]
        put(&d, "dash", l.dash?.map(n)); put(&d, "seriesIndex", l.seriesIndex); put(&d, "radial", l.radial); put(&d, "cap", l.cap); return d
    }
    o["markers"] = s.markers.map { m -> [String: Any] in
        var d: [String: Any] = ["x": n(m.x), "y": n(m.y), "r": n(m.r), "color": m.color]
        put(&d, "symbol", m.symbol); put(&d, "seriesIndex", m.seriesIndex); put(&d, "hollow", m.hollow); put(&d, "fill", m.fill); return d
    }
    put(&o, "glyphs", s.glyphs?.map { g -> [String: Any] in
        var d: [String: Any] = ["x": n(g.x), "y": n(g.y), "text": g.text, "size": n(g.size)]
        if let l = g.label { d["label"] = ["color": l.color, "weight": n(l.weight), "dx": n(l.dx), "dy": n(l.dy), "anchorX": l.anchorX, "anchorY": l.anchorY] }
        return d
    })
    put(&o, "endLabels", s.endLabels?.map { e -> [String: Any] in
        var d: [String: Any] = ["key": e.key, "x": n(e.x), "y": n(e.y), "text": e.text, "color": e.color, "size": n(e.size), "visible": e.visible]
        put(&d, "side", e.side); return d
    })
    o["texts"] = s.texts.map { t -> [String: Any] in
        var d: [String: Any] = ["x": n(t.x), "y": n(t.y), "text": t.text, "color": t.color, "fontSize": n(t.fontSize), "align": t.align, "baseline": t.baseline, "key": t.key]
        put(&d, "fontWeight", t.fontWeight.map(n)); put(&d, "rotate", t.rotate.map(n)); return d
    }
    put(&o, "barLabels", s.barLabels?.map { b -> [String: Any] in
        var d: [String: Any] = ["seriesIndex": b.seriesIndex, "dataIndex": b.dataIndex, "text": b.text, "color": b.color, "size": n(b.size)]
        put(&d, "fontWeight", b.fontWeight.map(n)); put(&d, "inside", b.inside); put(&d, "atLowEnd", b.atLowEnd); return d
    })
    o["legend"] = s.legend.map { ["label": $0.label, "color": $0.color, "seriesIndex": $0.seriesIndex, "hidden": $0.hidden, "x": n($0.x), "y": n($0.y)] as [String: Any] }
    put(&o, "legendPosition", s.legendPosition)
    put(&o, "pieCenterSlot", s.pieCenterSlot.map(pt)); put(&o, "pieCenter", s.pieCenter.map(pt))
    put(&o, "pieHoleSize", s.pieHoleSize.map(n)); put(&o, "pieHoleHeight", s.pieHoleHeight.map(n))
    put(&o, "inverted", s.inverted); put(&o, "polar", s.polar)
    o["xPositions"] = s.xPositions.map(n)
    o["xValues"] = s.xValues.map { v -> Any in switch v { case .number(let x): return n(x); case .string(let t): return t; case .date(let ms): return awcChartISOString(ms) } }
    o["xLabels"] = s.xLabels
    o["hoverPoints"] = s.hoverPoints.map { h -> [String: Any] in
        var by: [String: Any] = [:]
        for (k, p) in h.byIndex {
            var d: [String: Any] = ["x": n(p.x), "y": n(p.y), "value": n(p.value)]
            put(&d, "low", p.low.map(n)); put(&d, "high", p.high.map(n)); put(&d, "symbol", p.symbol); put(&d, "color", p.color)
            by[String(k)] = d
        }
        var d: [String: Any] = ["seriesIndex": h.seriesIndex, "color": h.color, "label": h.label, "byIndex": by]
        put(&d, "unanchored", h.unanchored)
        put(&d, "values", h.values?.map { c -> Any in if case .num(let v) = c { return n(v) }; return NSNull() })
        return d
    }
    if let r = s.ripple { o["ripple"] = ["dataIndex": r.dataIndex, "x": n(r.x), "y": n(r.y), "radius": n(r.radius), "color": r.color, "alpha": n(r.alpha)] }
    return o
}

/// JSON.stringify(Date) → toISOString().
func awcChartISOString(_ ms: Double) -> String {
    let f = ISO8601DateFormatter(); f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]; f.timeZone = TimeZone(secondsFromGMT: 0)
    return f.string(from: Date(timeIntervalSince1970: ms / 1000))
}
