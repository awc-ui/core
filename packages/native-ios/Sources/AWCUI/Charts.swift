import SwiftUI

struct AWCPlotSeries: Identifiable {
    var id: Int
    var name: String
    var color: Color
    var values: [Double?]
    var source: AWCValue
}

extension AWCNativeView {
    var chartColors: [Color] { [theme.primary, theme.tertiary, .teal, .orange, .pink, .blue] }
    var plotSeries: [AWCPlotSeries] {
        if node.tag == "md-sparkline" { return [AWCPlotSeries(id: 0, name: "", color: s("color").hasPrefix("#") ? Color(awcHex: s("color")) : theme.primary, values: a("data").map(pointValue), source: p("data"))] }
        if node.tag == "md-pie-chart" { return a("data").enumerated().map { index, item in AWCPlotSeries(id: index, name: item["name"].string.isEmpty ? item["label"].string : item["name"].string, color: item["color"].string.hasPrefix("#") ? Color(awcHex: item["color"].string) : chartColors[index % chartColors.count], values: [item["value"].number], source: item) } }
        return a("series").enumerated().map { index, item in
            AWCPlotSeries(id: index, name: item["name"].string.isEmpty ? item["label"].string : item["name"].string, color: item["color"].string.hasPrefix("#") ? Color(awcHex: item["color"].string) : chartColors[index % chartColors.count], values: item["data"].array.map(pointValue), source: item)
        }
    }
    func pointValue(_ value: AWCValue) -> Double? { value.number ?? value["y"].number ?? value["value"].number }
    var chart: some View {
        VStack(alignment: .leading, spacing: 12) {
            content("header")
            if !label.isEmpty { Text(label).font(.headline) }
            if !s("subtitle").isEmpty { Text(s("subtitle")).font(.caption).foregroundStyle(.secondary) }
            if b("loading") { content("loader"); content("loading"); ProgressView(s("loadingLabel", "Loading chart")) }
            else if plotSeries.allSatisfy({ $0.values.compactMap { $0 }.isEmpty }) { content("empty"); Text(s("labelEmpty", "No data")).foregroundStyle(.secondary).frame(height: 140) }
            else {
                GeometryReader { geometry in
                    Canvas { context, size in
                        if node.tag == "md-pie-chart" { drawPie(context: &context, size: size) }
                        else { drawCartesian(context: &context, size: size) }
                    }.contentShape(Rectangle()).gesture(SpatialTapGesture().onEnded { gesture in chartTap(gesture.location, size: geometry.size) })
                }.frame(height: numericDimension(s("heightProp")) ?? (node.tag == "md-sparkline" ? 64 : 220))
                if let selection = local["_chartSelection"] { Text(selection.string).font(.caption).foregroundStyle(.secondary) }
            }
            if s("legend", "bottom") != "none" && node.tag != "md-sparkline" {
                ScrollView(.horizontal) {
                    HStack(spacing: 14) { ForEach(plotSeries) { series in
                        Button {
                            let key = String(series.id)
                            if selectedIDs.contains(key) { selectedIDs.remove(key) } else { selectedIDs.insert(key) }
                            emit("mdLegendClick", node.tag == "md-pie-chart" ? ["dataIndex": .number(Double(series.id)), "selected": .bool(!selectedIDs.contains(key))] : ["seriesIndex": .number(Double(series.id)), "seriesId": series.source["id"], "selected": .bool(!selectedIDs.contains(key))])
                        } label: { HStack(spacing: 5) { Circle().fill(series.color).frame(width: 8, height: 8); Text(series.name.isEmpty ? "Series \(series.id + 1)" : series.name).font(.caption) }.opacity(selectedIDs.contains(String(series.id)) ? 0.4 : 1) }.buttonStyle(.plain)
                    } }
                }
            }
            if !s("summary").isEmpty { Text(s("summary")).font(.caption).foregroundStyle(.secondary) }; content("footer")
        }.accessibilityElement(children: .contain).accessibilityLabel(s("labelPlot", label))
        .onAppear { emit("mdReady") }
    }
    var visibleSeries: [AWCPlotSeries] { plotSeries.filter { !selectedIDs.contains(String($0.id)) } }
    func chartBounds() -> (Double, Double) {
        let values = visibleSeries.flatMap(\.values).compactMap { $0 }
        let minimum = node.tag == "md-sparkline" ? n("min", values.min() ?? 0) : min(0, values.min() ?? 0)
        let maximum = node.tag == "md-sparkline" ? n("max", values.max() ?? 1) : max(0, values.max() ?? 1)
        return (minimum, max(minimum + 0.001, maximum))
    }
    func drawCartesian(context: inout GraphicsContext, size: CGSize) {
        let series = visibleSeries
        let spark = node.tag == "md-sparkline"
        let inset: CGFloat = spark ? 3 : 24
        let width = max(1, size.width - inset * 2), height = max(1, size.height - inset * 2)
        let bounds = chartBounds()
        func point(_ value: Double, _ index: Int, _ count: Int) -> CGPoint { CGPoint(x: inset + CGFloat(index) / CGFloat(max(1, count - 1)) * width, y: inset + height * (1 - CGFloat((value - bounds.0) / (bounds.1 - bounds.0)))) }
        if !spark && s("grid", "horizontal") != "none" {
            for index in 0...4 {
                let y = inset + CGFloat(index) * height / 4
                var path = Path(); path.move(to: CGPoint(x: inset, y: y)); path.addLine(to: CGPoint(x: size.width - inset, y: y))
                context.stroke(path, with: .color(.secondary.opacity(0.12)), lineWidth: 1)
                let value = bounds.1 - Double(index) / 4 * (bounds.1 - bounds.0)
                context.draw(Text(String(format: "%.0f", value)).font(.system(size: 9)).foregroundStyle(.secondary), at: CGPoint(x: inset - 3, y: y), anchor: .trailing)
            }
        }
        for (seriesIndex, item) in series.enumerated() {
            let count = item.values.count
            let bar = node.tag == "md-bar-chart" || spark && s("variant") == "bar"
            if bar {
                let groupWidth = width / CGFloat(max(1, count))
                let barWidth = min(CGFloat(n("barWidth", 1000)), groupWidth * 0.78 / CGFloat(max(1, series.count)))
                let baseline = point(0, 0, count).y
                for (index, value) in item.values.enumerated() {
                    guard let value else { continue }
                    let top = point(value, index, count).y
                    let x = inset + CGFloat(index) * groupWidth + groupWidth * 0.11 + CGFloat(seriesIndex) * barWidth
                    let rect = CGRect(x: x, y: min(top, baseline), width: max(1, barWidth - 2), height: max(1, abs(baseline - top)))
                    context.fill(Path(roundedRect: rect, cornerRadius: CGFloat(n("cornerRadius", 3))), with: .color(item.color))
                    if b("showLabels") { context.draw(Text(String(format: "%.0f", value)).font(.system(size: 10)).foregroundStyle(item.color), at: CGPoint(x: rect.midX, y: top - 8)) }
                }
            } else {
                var path = Path(); var active = false
                var first: CGPoint?, last: CGPoint?
                for (index, value) in item.values.enumerated() {
                    guard let value else { if !b("connectNulls") { active = false }; continue }
                    let location = point(value, index, count)
                    if active { path.addLine(to: location) } else { path.move(to: location); active = true }
                    if first == nil { first = location }; last = location
                    if b("showMarks") || s("showMarks") == "all" { context.fill(Path(ellipseIn: CGRect(x: location.x - 3, y: location.y - 3, width: 6, height: 6)), with: .color(item.color)) }
                }
                let area = node.tag == "md-area-chart" || b("area") || spark && s("variant") == "area"
                if area, let first, let last {
                    var fill = path; fill.addLine(to: CGPoint(x: last.x, y: inset + height)); fill.addLine(to: CGPoint(x: first.x, y: inset + height)); fill.closeSubpath()
                    context.fill(fill, with: .color(item.color.opacity(n("fillOpacity", 0.2))))
                }
                if b("showLine", true) { context.stroke(path, with: .color(item.color), style: StrokeStyle(lineWidth: CGFloat(n("lineWidth", 2.5)), lineCap: .round, lineJoin: .round)) }
            }
        }
    }
    func drawPie(context: inout GraphicsContext, size: CGSize) {
        let series = visibleSeries
        let total = series.reduce(0.0) { $0 + max(0, $1.values.first.flatMap { $0 } ?? 0) }
        guard total > 0 else { return }
        let center = CGPoint(x: size.width / 2, y: size.height / 2)
        let outer = min(size.width, size.height) / 2 - 8
        let innerValue = s("innerRadius", "0")
        let inner = innerValue.hasSuffix("%") ? outer * CGFloat(Double(innerValue.dropLast()) ?? 0) / 100 : CGFloat(n("innerRadius"))
        var start = n("startAngle", -90)
        let sweep = n("endAngle", start + 360) - start
        for item in series {
            let value = max(0, item.values.first.flatMap { $0 } ?? 0)
            let end = start + value / total * sweep
            var path = Path()
            path.move(to: CGPoint(x: center.x + inner * CGFloat(cos(start * .pi / 180)), y: center.y + inner * CGFloat(sin(start * .pi / 180))))
            path.addArc(center: center, radius: outer, startAngle: .degrees(start), endAngle: .degrees(end), clockwise: sweep < 0)
            path.addArc(center: center, radius: max(0, min(inner, outer - 1)), startAngle: .degrees(end), endAngle: .degrees(start), clockwise: sweep >= 0)
            path.closeSubpath(); context.fill(path, with: .color(item.color)); context.stroke(path, with: .color(.white.opacity(0.7)), lineWidth: CGFloat(n("paddingAngle", 1)))
            if b("showLabels") {
                let angle = (start + end) / 2 * .pi / 180, radius = (outer + inner) / 2
                let text = s("labelMode") == "name" ? item.name : s("labelMode") == "both" ? "\(item.name) \(Int(value))" : String(Int(value))
                context.draw(Text(text).font(.system(size: 11, weight: .semibold)).foregroundStyle(.white), at: CGPoint(x: center.x + radius * CGFloat(cos(angle)), y: center.y + radius * CGFloat(sin(angle))))
            }
            start = end
        }
    }
    func chartTap(_ location: CGPoint, size: CGSize) {
        let series = visibleSeries; guard !series.isEmpty else { return }
        if node.tag == "md-pie-chart" {
            let total = series.reduce(0.0) { $0 + max(0, $1.values.first.flatMap { $0 } ?? 0) }; guard total > 0 else { return }
            let start = n("startAngle", -90), sweep = n("endAngle", start + 360) - start
            var angle = (atan2(Double(location.y - size.height / 2), Double(location.x - size.width / 2)) * 180 / .pi - start) * (sweep < 0 ? -1 : 1)
            angle = angle.truncatingRemainder(dividingBy: 360); if angle < 0 { angle += 360 }; guard angle <= abs(sweep) else { return }
            var cumulative = 0.0
            for item in series {
                let value = max(0, item.values.first.flatMap { $0 } ?? 0); cumulative += value / total * abs(sweep)
                if angle <= cumulative { emit("mdSliceClick", ["seriesIndex": 0, "dataIndex": .number(Double(item.id)), "value": .number(value), "series": item.source]); set("_chartSelection", .string("\(item.name): \(value)")); return }
            }
        } else {
            let item = series[0]; guard !item.values.isEmpty else { return }
            let index = min(item.values.count - 1, max(0, Int((location.x / max(1, size.width) * CGFloat(item.values.count - 1)).rounded())))
            let value = item.values[index].map(AWCValue.number) ?? .null
            let detail: AWCValue = ["seriesIndex": .number(Double(item.id)), "seriesId": item.source["id"], "dataIndex": .number(Double(index)), "value": value, "series": item.source]
            emit(node.tag == "md-sparkline" ? "mdSparkClick" : node.tag == "md-bar-chart" ? "mdBarClick" : node.tag == "md-area-chart" ? "mdAreaClick" : "mdMarkerClick", detail)
            set("_chartSelection", .string("\(item.name.isEmpty ? "Point" : item.name) \(index + 1): \(value.string)"))
        }
    }
}
