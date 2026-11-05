import Foundation

// The rest of the chart motion: animate.ts `drillScene` (bar drill), the bar-race follow (bar-chart.ts
// barKeys / lerpBar / barsDiffer / renderFollow), and the entrance clock every engine runs.

private let DRILL_STAGGER = 0.3
private let FOLLOW_MS = 260.0

/// animate.ts `drillScene`: every bar rises from the baseline at its final slot; `split` cascades left to right.
func awcChartDrillScene(_ scene: AWCChartScene, _ t: Double, split: Bool) -> AWCChartScene {
    let tc = Swift.min(1, Swift.max(0, t))
    let maxDi = split ? Swift.max(0, scene.bars.map(\.dataIndex).max() ?? 0) : 0
    var s = scene
    s.bars = scene.bars.map { b in
        let lag = split && maxDi > 0 ? (Double(b.dataIndex) / Double(maxDi)) * DRILL_STAGGER : 0
        let span = 1 - lag == 0 ? 1 : 1 - lag
        let g = awcChartEmphasizedDecelerate(Swift.min(1, Swift.max(0, (tc - lag) / span)))
        return awcChartGrowBar(b, g, scene.barBaseline)
    }
    return s
}

/// bar-chart.ts `keyerFor`: identity by series + category when categories are unique, else by slot.
func awcChartBarKeyer(_ scene: AWCChartScene) -> (AWCChartSceneBar) -> String {
    let cats = scene.xValues.map { v -> String in switch v { case .string(let s): return s; case .number(let n): return awcJSNumberString(n); case .date(let ms): return awcJSNumberString(ms) } }
    let unique = !cats.isEmpty && Set(cats).count == cats.count
    return { b in unique ? "\(b.seriesIndex)::\(b.dataIndex < cats.count ? cats[b.dataIndex] : String(b.dataIndex))" : "\(b.seriesIndex)#\(b.dataIndex)" }
}

/// bar-chart.ts `barKeys`: occurrence-aware, so the pieces of a broken-axis bar keep distinct identities (`~n`).
func awcChartBarKeys(_ scene: AWCChartScene) -> [String] {
    let base = awcChartBarKeyer(scene)
    var seen: [String: Int] = [:]
    return scene.bars.map { b in
        let k = base(b)
        let n = seen[k] ?? 0; seen[k] = n + 1
        return n == 0 ? k : "\(k)~\(n)"
    }
}

func awcChartBarsByKey(_ scene: AWCChartScene) -> [String: AWCChartSceneBar] {
    var m: [String: AWCChartSceneBar] = [:]
    for (k, b) in zip(awcChartBarKeys(scene), scene.bars) { m[k] = b }
    return m
}

func awcChartLerpBar(_ a: AWCChartSceneBar, _ b: AWCChartSceneBar, _ e: Double) -> AWCChartSceneBar {
    var o = b
    o.x = a.x + (b.x - a.x) * e; o.y = a.y + (b.y - a.y) * e; o.w = a.w + (b.w - a.w) * e; o.h = a.h + (b.h - a.h) * e
    return o
}

/// bar-chart.ts `barsDiffer` (looks each new bar up by its plain key, as the Web does).
func awcChartBarsDiffer(_ a: AWCChartScene, _ b: AWCChartScene) -> Bool {
    if a.bars.count != b.bars.count { return true }
    let am = awcChartBarsByKey(a)
    let key = awcChartBarKeyer(b)
    for nb in b.bars {
        guard let ob = am[key(nb)] else { return true }
        if abs(ob.x - nb.x) > 0.5 || abs(ob.y - nb.y) > 0.5 || abs(ob.w - nb.w) > 0.5 || abs(ob.h - nb.h) > 0.5 { return true }
    }
    return false
}

/// The bar-race follow: bars on screen ease a `dt / 260 ms` share of their gap toward the live target each frame.
struct AWCChartBarFollow {
    var displayed: [String: AWCChartSceneBar]? = nil
    var active = false
    var last = 0.0

    /// One frame toward `target`; returns the bars to draw and whether they are still moving.
    mutating func step(_ target: AWCChartScene, rate: Double) -> [AWCChartSceneBar] {
        let keys = awcChartBarKeys(target)
        let from = displayed ?? awcChartBarsByKey(target)
        var next: [String: AWCChartSceneBar] = [:]
        var bars: [AWCChartSceneBar] = []
        var moving = false
        for (k, b) in zip(keys, target.bars) {
            let bar = from[k].map { awcChartLerpBar($0, b, rate) } ?? b
            next[k] = bar; bars.append(bar)
            if abs(bar.x - b.x) > 0.3 || abs(bar.y - b.y) > 0.3 || abs(bar.w - b.w) > 0.3 || abs(bar.h - b.h) > 0.3 { moving = true }
        }
        displayed = next
        active = moving
        return bars
    }

    mutating func frame(_ target: AWCChartScene, now: Double) -> [AWCChartSceneBar] {
        let dt = last != 0 ? now - last : 16
        last = now
        return step(target, rate: Swift.min(1, dt / FOLLOW_MS))
    }

    mutating func settle(_ target: AWCChartScene) { displayed = awcChartBarsByKey(target); active = false; last = 0 }
}

/// The entrance every engine plays on its first render with content (and on replay / legend toggle).
struct AWCChartIntro {
    var start: Double? = nil
    var variant = "none"
    var duration = AWC_CHART_INTRO_MS
    var hasRendered = false
    /// The entrance's synchronous t = 0 paint (playIntro draws it before the loop starts) is still to be drawn.
    var firstPaint = false

    /// Called on every render: arms the entrance on the first render that has geometry.
    mutating func render(hasContent: Bool, variant v: String, duration d: Double, reducedMotion: Bool, now: Double, staggerSeries: Int) {
        let animate = !hasRendered && v != "none" && !reducedMotion
        if animate {
            hasRendered = hasContent
            variant = v
            duration = v == "stagger" ? Swift.min(d * Double(Swift.max(1, staggerSeries)), 5200) : d
            start = now
            firstPaint = true
        } else {
            hasRendered = hasRendered || hasContent
            firstPaint = false
            start = nil   // stopIntro: any other render ends a running entrance on its final frame
        }
    }

    mutating func replay() { hasRendered = false }

    /// The raw timeline progress, or nil once settled.
    mutating func progress(_ now: Double) -> Double? {
        guard let s = start else { return nil }
        let t = (now - s) / duration
        if t >= 1 { start = nil; return nil }
        return Swift.max(0, t)
    }
}
