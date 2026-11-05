import Foundation

// Port of engine/pie-layout.ts plus md-pie-chart's spec building (flatten, harmonic palette).

struct AWCChartPieDatum {
    var label: String; var value: Double; var color: String; var hidden = false; var selected: Bool? = nil; var selectT: Double? = nil
    var radius: Double? = nil; var level = 0; var parent: Int? = nil
}

struct AWCChartPieSpec {
    var data: [AWCChartPieDatum]
    var title: String? = nil, subtitle: String? = nil, titleAlign: String? = nil
    var innerRadius: AWCValue, outerRadius: AWCValue
    var startAngleDeg: Double, endAngleDeg: Double, paddingAngleDeg: Double, cornerRadius: Double
    var showLabels: Bool, highlight: String, legend: String? = nil
    var valueFormatter: (Double) -> String
    var highlightIndex: Int? = nil, highlightT: Double? = nil
    var gradient: Bool? = nil, labelMode: String? = nil, sliceStroke: String? = nil, sliceStrokeWidth: Double? = nil, ringWidths: [Double]? = nil
    var legendExtent: Double? = nil, animation: String? = nil, animationDuration: Double? = nil
}

let AWC_PIE_SELECT_OFFSET = 12.0
private let LABEL_CHAR_W = 0.52, INNER_RING_WEIGHT = 1.45, LABEL_MIN_SWEEP_INSIDE = 0.12, LABEL_MIN_SWEEP_LEADER = 0.02
private let HOVER_RIM = 7.0, HOVER_GAP = 3.0, RIM_ROOM = 10.0, LEVEL_GAP = 3.0, FADE_STAGGER = 0.45
private let DEG = Double.pi / 180

private func awcSectorBox(_ a0: Double, _ sweep: Double, _ holeFrac: Double) -> (x0: Double, x1: Double, y0: Double, y1: Double) {
    let a1 = a0 + sweep, lo = Swift.min(a0, a1), hi = Swift.max(a0, a1)
    var xs: [Double] = [], ys: [Double] = []
    for a in [lo, hi] { for r in [1.0, holeFrac] { xs.append(cos(a) * r); ys.append(sin(a) * r) } }
    let q = Double.pi / 2
    var k = Int((lo / q).rounded(.up))
    while Double(k) * q <= hi { xs.append(cos(Double(k) * q)); ys.append(sin(Double(k) * q)); k += 1 }
    return (xs.min()!, xs.max()!, ys.min()!, ys.max()!)
}

private func awcIsAncestor(_ data: [AWCChartPieDatum], _ idx: Int, _ of: Int) -> Bool {
    var cur = of, guardN = 0
    while cur >= 0 && guardN < 32 { guardN += 1; if cur == idx { return true }; cur = cur < data.count ? (data[cur].parent ?? -1) : -1 }
    return false
}
private func awcSameFamily(_ data: [AWCChartPieDatum], _ a: Int, _ b: Int) -> Bool { awcIsAncestor(data, a, b) || awcIsAncestor(data, b, a) }

private func awcSliceLabel(_ d: AWCChartPieDatum, _ spec: AWCChartPieSpec, _ fallback: String) -> String {
    let mode = spec.labelMode ?? fallback
    let value = spec.valueFormatter(d.value)
    if mode == "name" { return d.label }
    if mode == "both" { return "\(d.label) · \(value)" }
    return value
}

private func awcLabelColorFor(_ fill: String) -> String { let c = awcChartParseColor(fill); return 0.299 * c.0 + 0.587 * c.1 + 0.114 * c.2 > 0.62 ? "rgba(0, 0, 0, 0.82)" : "#ffffff" }

private func awcResolveRadius(_ r: AWCValue, _ baseR: Double) -> Double {
    if case .number(let d) = r { return d.isFinite && d >= 0 ? d : 0 }
    let s = r.string.trimmingCharacters(in: .whitespaces)
    let n = awcJSParseFloat(s)
    if !n.isFinite || n < 0 { return 0 }
    return s.hasSuffix("%") ? (n / 100) * baseR : n
}

/// JS `String.prototype.length` / `slice` work in UTF-16 units.
private func awcUTF16Prefix(_ s: String, _ n: Int) -> String { let u = Array(s.utf16); return String(utf16CodeUnits: Array(u.prefix(Swift.max(0, n))), count: Swift.min(Swift.max(0, n), u.count)) }

func awcChartComputePieLayout(_ spec: AWCChartPieSpec, _ theme: AWCChartEngineTheme, _ width: Double, _ height: Double) -> AWCChartScene {
    let visible = spec.data.enumerated().filter { !$1.hidden && $1.value > 0 && $1.level == 0 }.map { (d: $1, i: $0) }
    let total = visible.reduce(0) { $0 + $1.d.value }
    let depth = spec.data.reduce(1) { Swift.max($0, $1.level + 1) }
    let titleH = (spec.title?.isEmpty == false) ? theme.titleSize + 12 + ((spec.subtitle?.isEmpty == false) ? theme.labelSize + 4 : 0) : 0
    let legendPos: String? = (spec.legend?.isEmpty == false) && spec.legend != "none" && spec.data.count > 1 ? spec.legend : nil
    let maxLegendW = legendPos != nil ? awcMax(0, spec.data.map { awcChartApproxWidth($0.label, theme.labelSize) }) : 0
    var padL = 8.0, padR = 8.0, padT = 8 + titleH, padB = 8.0
    if let lp = legendPos {
        if lp == "left" || lp == "right" {
            let want = spec.legendExtent != nil ? spec.legendExtent! + 16 : maxLegendW + 30
            let w = Swift.min(want, width * AWC_LEGEND_SIDE_MAX_FRACTION)
            if lp == "left" { padL += w } else { padR += w }
        } else {
            var band = spec.legendExtent != nil ? spec.legendExtent! + 8 : 0
            if spec.legendExtent == nil {
                let availW = Swift.max(60, width * 0.86)
                var rows = 1, rowW = 0.0
                for d in spec.data { let iw = awcChartApproxWidth(d.label, theme.labelSize) + 28; if rowW > 0 && rowW + iw > availW { rows += 1; rowW = iw } else { rowW += iw } }
                band = Double(rows) * (theme.labelSize + 8) + 6
            }
            if lp.hasPrefix("bottom") { padB += band } else { padT += band }
        }
    }
    let plot = AWCChartRect(x: padL, y: padT, width: Swift.max(1, width - padL - padR), height: Swift.max(1, height - padT - padB))
    let startRad = -spec.startAngleDeg * DEG
    let sweepTotal = -(spec.endAngleDeg - spec.startAngleDeg) * DEG
    let holeFrac: Double = { let inner = awcResolveRadius(spec.innerRadius, 100), outer = awcResolveRadius(spec.outerRadius, 100); return outer > 0 ? Swift.max(0, Swift.min(0.95, inner / outer)) : 0 }()
    let partial = abs(sweepTotal) < Double.pi * 2 - 0.02
    let box = partial ? awcSectorBox(startRad, sweepTotal, holeFrac) : (x0: -1.0, x1: 1.0, y0: -1.0, y1: 1.0)
    let baseR = Swift.max(1, Swift.min(plot.width / Swift.max(0.01, box.x1 - box.x0), plot.height / Swift.max(0.01, box.y1 - box.y0)))
    let cx = plot.x + plot.width / 2 - ((box.x0 + box.x1) / 2) * baseR
    let cy = plot.y + plot.height / 2 - ((box.y0 + box.y1) / 2) * baseR
    let labelRoom: Double = {
        if !spec.showLabels || legendPos != nil { return 6 }
        let longest = visible.reduce(0) { Swift.max($0, awcSliceLabel($1.d, spec, "both").utf16.count) }
        let want = awcResolveRadius(spec.outerRadius, baseR)
        let textW = 12 + Double(longest) * theme.labelSize * LABEL_CHAR_W
        let f = Swift.max(0.05, want / Swift.max(1, baseR))
        return Swift.max(6, Swift.min(baseR * 0.45, (want + textW - baseR) / f))
    }()
    let ringR = Swift.max(8, baseR - labelRoom)
    let outerR = Swift.max(1, Swift.min(awcResolveRadius(spec.outerRadius, ringR), ringR))
    let innerR = Swift.max(0, Swift.min(awcResolveRadius(spec.innerRadius, ringR), outerR - 2))
    let ringWeights: [Double] = (0..<depth).map { level in
        if let w = spec.ringWidths?[safe: level], w.isFinite, w > 0 { return w }
        return level < depth - 1 ? INNER_RING_WEIGHT : 1
    }
    let ws = ringWeights.reduce(0, +)
    let weightSum = ws == 0 ? 1 : ws
    let bandSpan = outerR - innerR
    let levelGap = depth > 1 ? Swift.min(LEVEL_GAP, (bandSpan / Double(depth)) * 0.3) : 0
    let bandable = Swift.max(1, bandSpan - levelGap * Double(depth - 1))
    func bandAt(_ level: Int) -> Double { (bandable * ringWeights[level]) / weightSum }
    var ringStarts: [Double] = []
    do { var acc = innerR; for level in 0..<depth { ringStarts.append(acc); acc += bandAt(level) + (level < depth - 1 ? levelGap : 0) } }
    func ringInner(_ level: Int) -> Double { level < ringStarts.count ? ringStarts[level] : innerR }
    func ringOuter(_ level: Int) -> Double { ringInner(level) + bandAt(level) }
    var span: [Int: (Double, Double)] = [:]
    let hasKids = Set(spec.data.compactMap { $0.parent.flatMap { $0 >= 0 ? $0 : nil } })
    func outerFor(_ level: Int, _ i: Int) -> Double {
        let full = hasKids.contains(i) ? ringOuter(level) : outerR
        guard i < spec.data.count, let r = spec.data[i].radius else { return full }
        let base = ringInner(level)
        return base + (full - base) * Swift.max(0.15, Swift.min(1, r))
    }
    let sign: Double = sweepTotal >= 0 ? 1 : -1
    let totalPad = !visible.isEmpty ? Swift.min(spec.paddingAngleDeg * DEG * Double(visible.count), abs(sweepTotal) * 0.9) : 0
    let perPad = !visible.isEmpty ? totalPad / Double(visible.count) : 0
    let availSweep = sweepTotal - sign * totalPad
    var slices: [AWCChartSceneSlice] = [], texts: [AWCChartTextItem] = [], leaders: [AWCChartSegment] = []
    final class Out { let key: String, text: String, x1: Double, y1: Double, x: Double; var y: Double; let right: Bool
        init(_ key: String, _ text: String, _ x1: Double, _ y1: Double, _ x: Double, _ y: Double, _ right: Bool) { self.key = key; self.text = text; self.x1 = x1; self.y1 = y1; self.x = x; self.y = y; self.right = right } }
    var outside: [Out] = []
    var cursor = startRad
    let sepColor = spec.sliceStroke ?? theme.surface
    let sepWidth = visible.count > 1 ? (spec.sliceStrokeWidth ?? 1) : 0
    let hubCut: Double = {
        if innerR > 0 || sepWidth <= 0 || visible.count < 2 { return 0 }
        let g = sepWidth / 2
        let t0 = visible.reduce(0) { $0 + Swift.max(0, $1.d.value) }
        let tot = t0 == 0 ? 1 : t0
        let fullSweep = abs(-(spec.endAngleDeg - spec.startAngleDeg) * DEG)
        var worst = 0.0
        for v in visible { let sw = (Swift.max(0, v.d.value) / tot) * fullSweep; if sw > 0.001 { worst = Swift.max(worst, g / sin(Swift.min(sw, Double.pi) / 2)) } }
        return Swift.min(worst, outerR * 0.04, 4)
    }()
    let hi = Swift.max(0, Swift.min(1, spec.highlightT ?? 1))
    var hoverBands: [AWCChartSceneSlice] = []
    func pushBand(_ bx: Double, _ by: Double, _ rOut: Double, _ a0: Double, _ a1: Double, _ color: String) {
        let rimH = HOVER_RIM * hi, gap = HOVER_GAP * hi
        let midR = rOut + gap + rimH / 2
        let dArc = (midR > 0 ? rimH / 2 / midR : 0) * sign
        hoverBands.append(AWCChartSceneSlice(cx: bx, cy: by, innerR: rOut + gap, outerR: rOut + gap + rimH, startAngle: a0 + dArc, endAngle: a1 - dArc, color: color, dataIndex: -1, pill: true))
    }
    let hovering = spec.highlight != "none" && spec.highlightIndex != nil && spec.highlightIndex! >= 0
    var midFrac: [Double] = []
    do { var acc = 0.0; for v in visible { let frac = total > 0 ? v.d.value / total : 0; midFrac.append(acc + frac / 2); acc += frac } }
    let hoveredPos = visible.firstIndex { $0.i == spec.highlightIndex } ?? -1
    let hoveredLevel: Double = hovering ? Double((spec.highlightIndex! < spec.data.count ? spec.data[spec.highlightIndex!].level : 0)) : .infinity
    func fadeFor(_ pos: Int) -> Double {
        if hoveredPos < 0 { return hi }
        let diff = abs(midFrac[pos] - midFrac[hoveredPos])
        let lag = Swift.min(diff, 1 - diff) * 2 * FADE_STAGGER
        let den = 1 - lag
        return Swift.max(0, Swift.min(1, (hi - lag) / (den == 0 ? 1 : den)))
    }
    var offOf: [Int: (Double, Double)] = [:]
    for (pos, v) in visible.enumerated() {
        let (d, i) = (v.d, v.i)
        let fade = fadeFor(pos)
        let frac = total > 0 ? d.value / total : 0
        let sliceSweep = availSweep * frac
        let a0 = cursor + (sign * perPad) / 2
        let a1 = a0 + sliceSweep
        cursor = a1 + (sign * perPad) / 2
        let mid = (a0 + a1) / 2
        let isHovered = hovering && (spec.highlightIndex == i || spec.highlight == "series")
        let litByFamily = hovering && awcSameFamily(spec.data, i, spec.highlightIndex ?? -1)
        let ex = (d.selectT ?? (d.selected == true ? 1 : 0)) * AWC_PIE_SELECT_OFFSET
        let scx = cx + cos(mid) * ex, scy = cy + sin(mid) * ex
        offOf[i] = (scx - cx, scy - cy)
        let fill = hovering && !isHovered && !litByFamily && fade > 0 ? awcChartMixColor(d.color, theme.surface, 0.62 * fade) : d.color
        if isHovered && hi > 0 { pushBand(scx, scy, outerFor(0, i), a0, a1, d.color) }
        slices.append(AWCChartSceneSlice(cx: scx, cy: scy, innerR: Swift.max(ringInner(0), hubCut), outerR: outerFor(0, i), startAngle: a0, endAngle: a1, color: fill, dataIndex: i,
                                         cornerRadius: spec.cornerRadius, gap: sepWidth, gapColor: sepColor, gradient: spec.gradient == true ? (from: awcChartMixColor(d.color, theme.surface, 0.3), to: d.color) : nil))
        span[i] = (a0, a1)
        let inside = legendPos != nil || depth > 1
        if spec.showLabels && abs(sliceSweep) > (inside ? LABEL_MIN_SWEEP_INSIDE : LABEL_MIN_SWEEP_LEADER) {
            if inside {
                let r0 = ringInner(0), r1 = outerFor(0, i)
                let labelR = r0 > 0 ? (r0 + r1) / 2 : r1 * 0.62
                texts.append(AWCChartTextItem(x: scx + cos(mid) * labelR, y: scy + sin(mid) * labelR, text: awcSliceLabel(d, spec, depth > 1 ? "name" : "value"), color: awcLabelColorFor(fill), fontSize: theme.labelSize, fontWeight: nil, align: "center", baseline: "middle", rotate: nil, key: "pl-\(i)"))
            } else {
                outside.append(Out("pl-\(i)", awcSliceLabel(d, spec, "both"), scx + cos(mid) * outerFor(0, i), scy + sin(mid) * outerFor(0, i), scx + cos(mid) * (outerR + 12), scy + sin(mid) * (outerR + 12), cos(mid) >= 0))
            }
        }
    }
    if depth > 1 {
        for level in 1..<depth {
            let here = spec.data.enumerated().filter { $1.level == level && !$1.hidden }.map { (d: $1, i: $0) }
            var order: [Int] = [], byParent: [Int: [(d: AWCChartPieDatum, i: Int)]] = [:]
            for x in here { let p = x.d.parent ?? -1; if byParent[p] == nil { order.append(p) }; byParent[p, default: []].append(x) }
            for parentIdx in order {
                let kids = byParent[parentIdx]!
                guard let pSpan = span[parentIdx] else { continue }
                let sum = kids.reduce(0) { $0 + Swift.max(0, $1.d.value) }
                if sum <= 0 { continue }
                let sweepAll = pSpan.1 - pSpan.0
                var cur = pSpan.0
                for (d, i) in kids {
                    let a0 = cur, a1 = a0 + sweepAll * (Swift.max(0, d.value) / sum)
                    cur = a1
                    span[i] = (a0, a1)
                    let shove = Double(level) > hoveredLevel ? RIM_ROOM * hi : 0
                    let rIn = ringInner(level) + shove, rOut = outerFor(level, i) + shove
                    let related = hoveredPos < 0 || spec.highlightIndex == i || awcSameFamily(spec.data, i, spec.highlightIndex ?? -1)
                    let kex = (d.selectT ?? (d.selected == true ? 1 : 0)) * AWC_PIE_SELECT_OFFSET
                    let kmid = (a0 + a1) / 2
                    let pOff = offOf[parentIdx] ?? (0, 0)
                    let ox = pOff.0 + cos(kmid) * kex, oy = pOff.1 + sin(kmid) * kex
                    offOf[i] = (ox, oy)
                    slices.append(AWCChartSceneSlice(cx: cx + ox, cy: cy + oy, innerR: rIn, outerR: rOut, startAngle: a0, endAngle: a1,
                                                     color: hovering && !related && hi > 0 ? awcChartMixColor(d.color, theme.surface, 0.62 * hi) : d.color, dataIndex: i,
                                                     cornerRadius: spec.cornerRadius, gap: sepWidth, gapColor: sepColor, gradient: spec.gradient == true ? (from: awcChartMixColor(d.color, theme.surface, 0.3), to: d.color) : nil))
                    if hovering && spec.highlightIndex == i && hi > 0 { pushBand(cx + ox, cy + oy, rOut, a0, a1, d.color) }
                    let mid = (a0 + a1) / 2
                    if spec.showLabels && abs(a1 - a0) > LABEL_MIN_SWEEP_LEADER && level == depth - 1 {
                        outside.append(Out("pl-\(i)", awcSliceLabel(d, spec, "both"), cx + ox + cos(mid) * rOut, cy + oy + sin(mid) * rOut, cx + ox + cos(mid) * (rOut + 12), cy + oy + sin(mid) * (rOut + 12), cos(mid) >= 0))
                    }
                }
            }
        }
    }
    if !outside.isEmpty {
        let lineH = theme.labelSize * 1.45
        for right in [true, false] {
            let col = outside.filter { $0.right == right }.awcStableSorted { $0.y < $1.y }
            if col.isEmpty { continue }
            for k in 1..<Swift.max(1, col.count) where col[k].y - col[k - 1].y < lineH { col[k].y = col[k - 1].y + lineH }
            let over = col[col.count - 1].y - (height - lineH / 2)
            if over > 0 { for l in col { l.y -= over } }
            let under = lineH / 2 - col[0].y
            if under > 0 { for l in col { l.y += under } }
        }
        for l in outside {
            let room = l.right ? width - 6 - l.x : l.x - 6
            let fits = Swift.max(3, Int((room / (theme.labelSize * LABEL_CHAR_W)).rounded(.down)))
            let text = l.text.utf16.count > fits ? awcUTF16Prefix(l.text, fits - 1) + "…" : l.text
            leaders.append(AWCChartSegment(x1: l.x1, y1: l.y1, x2: l.x, y2: l.y, color: theme.gridLineColor, width: 1, dash: nil))
            texts.append(AWCChartTextItem(x: l.x + (l.right ? 3 : -3), y: l.y, text: text, color: theme.textColorMuted, fontSize: theme.labelSize, fontWeight: nil, align: l.right ? "start" : "end", baseline: "middle", rotate: nil, key: l.key))
        }
    }
    slices += hoverBands
    if let title = spec.title, !title.isEmpty {
        let tt = awcChartTitlePlacement(spec.titleAlign, 12, width - 24)
        texts.append(AWCChartTextItem(x: tt.x, y: 6, text: title, color: theme.textColor, fontSize: theme.titleSize, fontWeight: 600, align: tt.align, baseline: "top", rotate: nil, key: "title"))
        if let sub = spec.subtitle, !sub.isEmpty { texts.append(AWCChartTextItem(x: tt.x, y: 6 + theme.titleSize + 4, text: sub, color: theme.textColorMuted, fontSize: theme.labelSize, fontWeight: nil, align: tt.align, baseline: "top", rotate: nil, key: "subtitle")) }
    }
    let legend: [AWCChartLegendItem] = legendPos != nil ? spec.data.enumerated().map { AWCChartLegendItem(label: $1.label, color: $1.color, seriesIndex: $0, hidden: $1.hidden, x: 0, y: 0) } : []
    let h = partial ? awcSectorBox(startRad, sweepTotal, 0) : (x0: -1.0, x1: 1.0, y0: -1.0, y1: 1.0)
    let k = innerR / 2.0.squareRoot()
    var scene = AWCChartScene(barBaseline: nil, width: width, height: height, plot: plot, background: theme.background == "transparent" ? nil : theme.background, bands: nil,
                              gridlines: leaders, axisLines: [], areas: [], bars: [], slices: slices, lines: [], markers: [], glyphs: nil, endLabels: nil, texts: texts, barLabels: nil,
                              legend: legend, legendPosition: legendPos)
    scene.pieCenter = AWCChartPt(x: cx, y: cy)
    scene.pieHoleSize = innerR > 0 ? (h.x1 - h.x0) * k : 0
    scene.pieHoleHeight = innerR > 0 ? (h.y1 - h.y0) * k : 0
    scene.pieCenterSlot = AWCChartPt(x: cx + ((h.x0 + h.x1) / 2) * k, y: cy + ((h.y0 + h.y1) / 2) * k)
    return scene
}

extension Array { subscript(safe i: Int) -> Element? { i >= 0 && i < count ? self[i] : nil } }

/// theme.ts `harmonicPalette`.
func awcChartHarmonicPalette(_ anchors: [String], _ n: Int, light: String, dark: String) -> [String] {
    let usable = anchors.filter { !$0.isEmpty }
    if n <= 0 || usable.isEmpty { return [] }
    if usable.count == 1 { return Array(repeating: usable[0], count: n) }
    let ramp: [String] = (0..<n).map { i in
        if n == 1 { return usable[0] }
        let t = (Double(i) / Double(n - 1)) * Double(usable.count - 1)
        let lo = Int(t.rounded(.down)), hiI = Swift.min(usable.count - 1, lo + 1), f = t - Double(lo)
        return f == 0 ? usable[lo] : f == 1 ? usable[hiI] : awcChartMixColor(usable[lo], usable[hiI], f)
    }
    if n <= usable.count { return ramp }
    return ramp.enumerated().map { i, c in i % 2 == 0 ? c : awcChartMixColor(c, i % 4 == 1 ? dark : light, 0.22) }
}

func awcChartMirrorLegend(_ pos: String) -> String {
    ["left": "right", "right": "left", "top-start": "top-end", "top-end": "top-start", "bottom-start": "bottom-end", "bottom-end": "bottom-start"][pos] ?? pos
}

/// md-pie-chart `buildSpec` + `flatten`.
func awcChartBuildPieSpec(_ input: AWCChartCartesianInput, theme t: AWCChartTheme, rtl: Bool) -> AWCChartPieSpec {
    let pr = input.props
    let dataValues = pr.obj("data")?.array ?? []
    var flat: [AWCValue] = []
    func walkFlat(_ items: [AWCValue]) { for d in items { flat.append(d); walkFlat(d["children"].array) } }
    walkFlat(dataValues)
    var seen: [String: Int] = [:]
    let keys: [String] = flat.enumerated().map { i, d in
        let base = d["id"] != .null ? "id:\(d["id"].string)" : d["label"] != .null ? "label:\(d["label"].string)" : "pos:\(i)"
        let n = seen[base] ?? 0; seen[base] = n + 1
        return n == 0 ? base : "\(base)#\(n)"
    }
    let palette = awcChartHarmonicPalette(Array(t.palette.prefix(3)), dataValues.count, light: t.surface, dark: t.textColor)
    let mono = pr.optStr("monochrome")
    let monoBase = mono.map { awcChartResolveSeriesColor(input.tokens, $0.isEmpty ? "primary" : $0, t.palette[0]) }
    var out: [AWCChartPieDatum] = []
    func walk(_ items: [AWCValue], _ level: Int, _ parent: Int?, _ parentColor: String?) {
        for (i, d) in items.enumerated() {
            let base: String
            if let pc = parentColor { base = awcChartMixColor(pc, t.surface, 0.18 + (Double(i) / Double(Swift.max(1, items.count))) * 0.42) }
            else if let mb = monoBase { base = awcChartMixColor(mb, t.surface, (Double(i) / Double(Swift.max(1, items.count))) * 0.7) }
            else { base = i < palette.count ? palette[i] : awcChartPickPaletteColor(t.palette, i) }
            let color = awcChartResolveSeriesColor(input.tokens, d["color"] == .null ? nil : d["color"].string, base)
            let at = out.count
            out.append(AWCChartPieDatum(label: d["label"] == .null ? "undefined" : d["label"].string, value: d["value"].number ?? .nan, color: color,
                                        hidden: d["hidden"].bool ?? input.legendHidden[keys[at]] ?? false, selected: d["selected"].bool, selectT: nil, radius: d["radius"].number, level: level, parent: parent))
            let kids = d["children"].array
            if !kids.isEmpty { walk(kids, level + 1, at, color) }
        }
    }
    walk(dataValues, 0, nil, nil)
    let locale = pr.str("locale", "")
    let vf = input.formatters.valueFormatter
    let label = pr.str("label", ""), subtitle = pr.str("subtitle", "")
    let legend = pr.str("legend", "right")
    return AWCChartPieSpec(data: out, title: label.isEmpty ? nil : label, subtitle: subtitle.isEmpty ? nil : subtitle, titleAlign: pr.str("titleAlign", "start"),
                           innerRadius: pr.p["innerRadius"] ?? .string("0%"), outerRadius: pr.p["outerRadius"] ?? .string("75%"),
                           startAngleDeg: pr.num("startAngle", 90), endAngleDeg: pr.num("endAngle", -270), paddingAngleDeg: pr.num("paddingAngle", 0), cornerRadius: pr.num("cornerRadius", 4),
                           showLabels: pr.bool("showLabels", true), highlight: pr.str("highlight", "slice"), legend: rtl ? awcChartMirrorLegend(legend) : legend,
                           valueFormatter: { v in vf != nil ? vf!(v) : AWCChartIntl.number(v, locale) }, gradient: pr.bool("gradient"), labelMode: pr.optStr("labelMode"),
                           ringWidths: pr.obj("ringWidths")?.array.compactMap(\.number),
                           animation: pr.bool("noAnimation") ? "none" : pr.str("animation", "expressive"), animationDuration: pr.num("animationDuration"))
}
