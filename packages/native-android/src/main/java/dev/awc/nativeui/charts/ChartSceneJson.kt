package dev.awc.nativeui.charts

// The RenderScene as the Web oracle serialises it (`sceneJson`: numbers rounded to 0.01, non-finite
// numbers as strings, undefined fields and functions omitted). Plain maps/lists for fixtures and inspection.

fun chartSceneJson(s: ChartScene): Map<String, Any?> {
    fun n(v: Double): Any = if (v.isFinite()) jsRound(v * 100) / 100 else jsNumberString(v)
    fun pt(p: ChartPt) = mapOf("x" to n(p.x), "y" to n(p.y))
    fun MutableMap<String, Any?>.put2(k: String, v: Any?) { if (v != null) this[k] = v }
    fun seg(g: ChartSegment) = linkedMapOf<String, Any?>("x1" to n(g.x1), "y1" to n(g.y1), "x2" to n(g.x2), "y2" to n(g.y2), "color" to g.color, "width" to n(g.width)).apply { put2("dash", g.dash?.map(::n)) }
    val o = linkedMapOf<String, Any?>("width" to n(s.width), "height" to n(s.height), "plot" to mapOf("x" to n(s.plot.x), "y" to n(s.plot.y), "width" to n(s.plot.width), "height" to n(s.plot.height)))
    o.put2("barBaseline", s.barBaseline?.let(::n)); o.put2("background", s.background)
    o.put2("bands", s.bands?.map { mapOf("x" to n(it.x), "y" to n(it.y), "w" to n(it.w), "h" to n(it.h), "color" to it.color) })
    o["gridlines"] = s.gridlines.map(::seg); o["axisLines"] = s.axisLines.map(::seg)
    o["areas"] = s.areas.map { a -> linkedMapOf<String, Any?>("points" to a.points.map(::pt), "baselineY" to n(a.baselineY), "colorTop" to a.colorTop, "colorBottom" to a.colorBottom).apply { put2("basePoints", a.basePoints?.map(::pt)); put2("horizontal", a.horizontal); put2("seriesIndex", a.seriesIndex) } }
    o["bars"] = s.bars.map { b -> linkedMapOf<String, Any?>("x" to n(b.x), "y" to n(b.y), "w" to n(b.w), "h" to n(b.h), "color" to b.color, "radius" to b.radius.map(::n), "seriesIndex" to b.seriesIndex, "dataIndex" to b.dataIndex).apply { put2("horizontal", b.horizontal); put2("arrow", b.arrow); put2("notch", b.notch) } }
    o["slices"] = s.slices.map { c -> linkedMapOf<String, Any?>("cx" to n(c.cx), "cy" to n(c.cy), "innerR" to n(c.innerR), "outerR" to n(c.outerR), "startAngle" to n(c.startAngle), "endAngle" to n(c.endAngle), "color" to c.color, "dataIndex" to c.dataIndex).apply {
        put2("seriesIndex", c.seriesIndex); put2("cornerRadius", c.cornerRadius?.let(::n)); put2("gap", c.gap?.let(::n)); put2("gapColor", c.gapColor)
        put2("gradient", c.gradient?.let { mapOf("from" to it.first, "to" to it.second) }); put2("pill", c.pill); put2("capStart", c.capStart); put2("capEnd", c.capEnd) } }
    o["lines"] = s.lines.map { l -> linkedMapOf<String, Any?>("points" to l.points.map(::pt), "color" to l.color, "width" to n(l.width)).apply { put2("dash", l.dash?.map(::n)); put2("seriesIndex", l.seriesIndex); put2("radial", l.radial); put2("cap", l.cap) } }
    o["markers"] = s.markers.map { m -> linkedMapOf<String, Any?>("x" to n(m.x), "y" to n(m.y), "r" to n(m.r), "color" to m.color).apply { put2("symbol", m.symbol); put2("seriesIndex", m.seriesIndex); put2("hollow", m.hollow); put2("fill", m.fill) } }
    o.put2("glyphs", s.glyphs?.map { g -> linkedMapOf<String, Any?>("x" to n(g.x), "y" to n(g.y), "text" to g.text, "size" to n(g.size)).apply { put2("label", g.label?.let { mapOf("color" to it.color, "weight" to n(it.weight), "dx" to n(it.dx), "dy" to n(it.dy), "anchorX" to it.anchorX, "anchorY" to it.anchorY) }) } })
    o.put2("endLabels", s.endLabels?.map { e -> linkedMapOf<String, Any?>("key" to e.key, "x" to n(e.x), "y" to n(e.y), "text" to e.text, "color" to e.color, "size" to n(e.size), "visible" to e.visible).apply { put2("side", e.side) } })
    o["texts"] = s.texts.map { t -> linkedMapOf<String, Any?>("x" to n(t.x), "y" to n(t.y), "text" to t.text, "color" to t.color, "fontSize" to n(t.fontSize), "align" to t.align, "baseline" to t.baseline, "key" to t.key).apply { put2("fontWeight", t.fontWeight?.let(::n)); put2("rotate", t.rotate?.let(::n)) } }
    o.put2("barLabels", s.barLabels?.map { b -> linkedMapOf<String, Any?>("seriesIndex" to b.seriesIndex, "dataIndex" to b.dataIndex, "text" to b.text, "color" to b.color, "size" to n(b.size)).apply { put2("fontWeight", b.fontWeight?.let(::n)); put2("inside", b.inside); put2("atLowEnd", b.atLowEnd) } })
    o["legend"] = s.legend.map { mapOf("label" to it.label, "color" to it.color, "seriesIndex" to it.seriesIndex, "hidden" to it.hidden, "x" to n(it.x), "y" to n(it.y)) }
    o.put2("legendPosition", s.legendPosition); o.put2("pieCenterSlot", s.pieCenterSlot?.let(::pt)); o.put2("pieCenter", s.pieCenter?.let(::pt))
    o.put2("pieHoleSize", s.pieHoleSize?.let(::n)); o.put2("pieHoleHeight", s.pieHoleHeight?.let(::n)); o.put2("inverted", s.inverted); o.put2("polar", s.polar)
    o["xPositions"] = s.xPositions.map(::n)
    o["xValues"] = s.xValues.map { when (it) { is ChartAxisValue.Num -> n(it.v); is ChartAxisValue.Str -> it.v; is ChartAxisValue.DateMs -> java.time.Instant.ofEpochMilli(it.ms.toLong()).toString() } }
    o["xLabels"] = s.xLabels
    o["hoverPoints"] = s.hoverPoints.map { h ->
        linkedMapOf<String, Any?>("seriesIndex" to h.seriesIndex, "color" to h.color, "label" to h.label, "byIndex" to h.byIndex.entries.associate { (k, p) ->
            k.toString() to linkedMapOf<String, Any?>("x" to n(p.x), "y" to n(p.y), "value" to n(p.value)).apply { put2("low", p.low?.let(::n)); put2("high", p.high?.let(::n)); put2("symbol", p.symbol); put2("color", p.color) }
        }).apply { put2("unanchored", h.unanchored); put2("values", h.values?.map { c -> (c as? ChartCell.Num)?.let { n(it.v) } }) }
    }
    s.ripple?.let { r -> o["ripple"] = mapOf("dataIndex" to r.dataIndex, "x" to n(r.x), "y" to n(r.y), "radius" to n(r.radius), "color" to r.color, "alpha" to n(r.alpha)) }
    return o
}
