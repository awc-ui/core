import SwiftUI

// The dedicated SwiftUI renderer for md-line-chart, md-area-chart, md-bar-chart, md-pie-chart and md-sparkline:
// the ported engine's scene on a Canvas, overlay text / bar labels / glyphs, legend chips, the hover layer
// (crosshair, markers, tooltip card), the drag-to-zoom band and zoom slider, the keyboard cursor and its live
// announcement, the entrance / drill / follow motion, and the component events. The interaction logic is in the
// platform-neutral controllers (ChartInteraction / ChartBarInteraction / ChartPieInteraction / ChartSparkInteraction).

/// A component event detail as the generic native event payload.
func awcChartEventPayload(_ v: Any?) -> AWCValue {
    switch v {
    case nil: return .null
    case let a as AWCValue: return a
    case let d as [String: Any?]: return .object(d.mapValues { awcChartEventPayload($0) })
    case let d as [String: Any]: return .object(d.mapValues { awcChartEventPayload($0) })
    case let a as [Any?]: return .array(a.map { awcChartEventPayload($0) })
    case let a as [Int]: return .array(a.map { .number(Double($0)) })
    case let a as [[String: Any?]]: return .array(a.map { awcChartEventPayload($0) })
    case let b as Bool: return .bool(b)
    case let i as Int: return .number(Double(i))
    case let n as Double: return .number(n)
    case let s as String: return .string(s)
    case let o as Optional<Any>: if case .some(let w) = o { return awcChartEventPayload(w) }; return .null
    default: return .null
    }
}

/// The interaction and motion state of one chart node, kept across SwiftUI updates.
final class AWCChartState: ObservableObject {
    @Published private(set) var version = 0
    func bump() { version &+= 1 }

    private(set) var kind: AWCChartKind = .line
    private var properties: [String: AWCValue] = [:]
    private var tokens: [String: String] = [:]
    private var density = 0.0
    private(set) var formatters = AWCChartFormatters()
    private(set) var size = CGSize.zero
    private(set) var rtl = false
    var reducedMotion = false
    var nodeID = ""
    var dispatch: ((String, String, AWCValue) -> Void)? = nil

    private(set) var plot: AWCChartPlotInteraction? = nil
    private(set) var pie: AWCChartPieInteraction? = nil
    private(set) var spark: AWCChartSparkInteraction? = nil
    private(set) var sceneLtr: AWCChartScene? = nil
    var intro = AWCChartIntro()
    var follow = AWCChartBarFollow()
    private var lastIntroToken = 0
    private var barDrill: (split: Bool, start: Double?, armedAt: Double)? = nil
    private(set) var barDrillStart: Double? = nil
    private var started = false
    private var lastAnnouncement = ""
    private var loading = false

    var props: AWCChartProps { AWCChartProps(properties) }
    var theme: AWCChartTheme { awcChartReadTheme(tokens: tokens, density: density) }
    /// Injectable clock (ms) for frame-exact replays; the uptime clock otherwise.
    var clock: (() -> Double)? = nil
    func now() -> Double { clock?() ?? ProcessInfo.processInfo.systemUptime * 1000 }

    /// Called from `body`: feeds the current inputs in; a property / theme change re-applies the engine and a
    /// size / direction change re-lays it out. No publishing here — the view is already rendering.
    func sync(kind: AWCChartKind, properties: [String: AWCValue], tokens: [String: String], density: Double, formatters: AWCChartFormatters, size: CGSize, rtl: Bool, reducedMotion: Bool) {
        self.formatters = formatters
        self.reducedMotion = reducedMotion
        let first = !started
        if first || kind != self.kind { self.kind = kind; makeControllers() }
        let propsChanged = properties != self.properties || tokens != self.tokens || density != self.density || first
        let sizeChanged = size != self.size || rtl != self.rtl
        self.properties = properties; self.tokens = tokens; self.density = density
        self.size = size; self.rtl = rtl
        if size.width < 2 || size.height < 2 { return }
        let nowLoading = props.bool("loading")
        let wasLoading = loading
        loading = nowLoading
        if propsChanged || !started {
            configure()
            applyEngine()
            if wasLoading != nowLoading { loadingChanged(now: nowLoading, before: wasLoading) }
            if !started { started = true; emit("mdReady", nil) }
        } else if sizeChanged {
            plot?.rtl = rtl; pie?.rtl = rtl
            plot?.resize(); pie?.resize(); spark?.plot?.resize()
        }
    }

    private func makeControllers() {
        plot = nil; pie = nil; spark = nil
        intro = AWCChartIntro(); follow = AWCChartBarFollow()
        switch kind {
        case .line, .area:
            let c = AWCChartCartesianInteraction(isArea: kind == .area)
            c.rebuild = { [unowned self] in self.rebuildPlot() }
            c.onEvent = { [unowned self] e in self.emit(e.name, e.detail) }
            plot = c
        case .bar:
            let c = AWCChartBarInteraction()
            c.rebuild = { [unowned self] in self.rebuildPlot() }
            c.onEvent = { [unowned self] e in self.emit(e.name, e.detail) }
            plot = c
        case .pie:
            let c = AWCChartPieInteraction()
            c.buildSpec = { [unowned self] in self.buildPieSpec() }
            c.layout = { [unowned self] spec in self.layoutPie(spec) }
            c.onRender = { [unowned self] in self.afterPieRender() }
            c.onEvent = { [unowned self] e in self.emit(e.name, e.detail) }
            pie = c
        case .sparkline:
            let c = AWCChartSparkInteraction()
            c.rebuild = { [unowned self] p in self.rebuildSpark(p) }
            c.onEvent = { [unowned self] e in self.emit(e.name, e.detail) }
            spark = c
        }
    }

    private func emit(_ name: String, _ detail: [String: Any?]?) {
        dispatch?(nodeID, name, detail.map { awcChartEventPayload($0) } ?? .null)
    }

    private func input() -> AWCChartCartesianInput {
        AWCChartCartesianInput(tag: kind.rawValue, props: props, tokens: tokens, density: density, formatters: formatters)
    }

    /// Host property → controller configuration (what each component's applyEngine hands its engine).
    private func configure() {
        let pr = props
        let xAxis = pr.obj("xAxis")
        let xData: [AWCValue]? = xAxis.flatMap { $0["data"] == .null ? nil : $0["data"].array }
        let series = pr.obj("series")?.array ?? []
        if let c = plot as? AWCChartCartesianInteraction {
            c.series = series; c.xAxisData = xData
            let scale = xAxis.flatMap { AWCChartScaleType(rawValue: $0["scale"].string) } ?? .category
            c.merged = awcChartNormalizeSeriesX(series.map { $0["data"].array }, xData?.compactMap(awcChartAxisValue), scale)
            c.tooltip = pr.str("tooltip", "axis"); c.zoom = pr.str("zoom", "none"); c.locale = pr.str("locale", "")
            c.labelPoint = pr.str("labelPoint", "%x%: %values%"); c.formatters = formatters
            c.missingFormatter = formatters.valueFormatter; c.renderer = formatters.tooltipRenderer
            c.rtl = rtl; c.reducedMotion = reducedMotion
        }
        if let b = plot as? AWCChartBarInteraction {
            b.series = series; b.xAxisData = xData
            b.tooltip = pr.str("tooltip", "axis"); b.zoom = pr.str("zoom", "none"); b.locale = pr.str("locale", "")
            b.labelPoint = pr.str("labelPoint", "%x%: %values%"); b.formatters = formatters
            b.missingFormatter = formatters.valueFormatter; b.renderer = formatters.tooltipRenderer
            b.polar = pr.bool("polar"); b.horizontal = pr.str("layout", "vertical") == "horizontal"; b.clickable = pr.bool("clickable")
            b.rtl = rtl; b.reducedMotion = reducedMotion
        }
        if let p = pie {
            p.data = pr.obj("data")?.array ?? []
            p.locale = pr.str("locale", ""); p.labelPoint = pr.str("labelPoint", "%label%: %value% (%percent%)")
            p.valueFormatter = formatters.valueFormatter.map { f in { v in f(v) } }
            p.renderer = formatters.tooltipRenderer
            p.rtl = rtl; p.reducedMotion = reducedMotion
        }
        if let s = spark {
            s.data = pr.obj("data")?.array ?? []
            s.showTooltip = pr.bool("showTooltip", true)
            s.rtl = rtl; s.reducedMotion = reducedMotion
        }
    }

    private func applyEngine() {
        if let p = plot { p.applyEngine() }
        if let p = pie { p.applyEngine() }
        if let s = spark { s.applyEngine(variant: props.str("variant", "line")) }
    }

    private func loadingChanged(now: Bool, before: Bool) {
        guard before && !now else { return }
        if let c = plot as? AWCChartCartesianInteraction { c.loadingChanged(now: now, before: before); rebuildPlot() }
        else { plot?.loadingChanged(now: now, before: before) }
        if let p = pie { p.loadingChanged() }
    }

    // ── scene builds (the engines' render) ──

    private func rebuildPlot() {
        guard let p = plot else { return }
        let t = theme
        var inp = input()
        inp.zoomWindow = p.zoomWindow()
        let w = Double(size.width).rounded(), h = Double(size.height).rounded()
        let old = p.scene
        let ltr: AWCChartScene
        var variant = "none", duration = AWC_CHART_INTRO_MS
        if let c = p as? AWCChartCartesianInteraction {
            inp.legendHidden = c.legendHidden; inp.hiddenOverride = c.hiddenOverride
            var spec = awcChartBuildCartesianSpec(inp, theme: t)
            c.yFormatter = spec.yFormatter
            (variant, duration) = awcChartResolveIntro(animation: spec.animation, animationDuration: spec.animationDuration, animate: nil)
            ltr = awcChartRenderScene(&spec, t.engine, width: w, height: h, rtl: false)
        } else if let b = p as? AWCChartBarInteraction {
            inp.legendHidden = b.legendHidden; inp.hiddenOverride = b.hiddenOverride
            var spec = awcChartBuildBarSpec(inp, theme: t)
            b.valueFormatter = spec.valueFormatter; b.surface = t.engine.surface
            (variant, duration) = awcChartResolveIntro(animation: spec.animation, animationDuration: spec.animationDuration, animate: nil)
            ltr = awcChartRenderBarScene(&spec, t.engine, width: w, height: h, rtl: false)
        } else { return }
        sceneLtr = ltr
        p.scene = rtl ? awcChartMirrorScene(ltr) : ltr
        afterRender(p, old: old, variant: variant, duration: duration)
    }

    private func afterRender(_ p: AWCChartPlotInteraction, old: AWCChartScene?, variant: String, duration: Double) {
        guard let s = sceneLtr else { return }
        if p.introToken != lastIntroToken { lastIntroToken = p.introToken; intro.replay() }
        let isBar = p is AWCChartBarInteraction
        let hasContent = isBar ? (!s.bars.isEmpty || !s.slices.isEmpty) : (!s.lines.isEmpty || !s.areas.isEmpty || !s.markers.isEmpty)
        let t = now()
        if isBar, let d = barDrill, t - d.armedAt < 50, variant != "none", !reducedMotion {
            barDrill = nil; barDrillStart = t; intro.hasRendered = true; intro.start = nil
            barDrillSplit = d.split
            return
        }
        let series = Set(s.lines.map { $0.seriesIndex ?? 0 }).count
        intro.render(hasContent: hasContent, variant: variant, duration: duration, reducedMotion: reducedMotion, now: t, staggerSeries: series)
        if intro.start != nil { follow.settle(p.scene ?? s); return }
        if isBar, let cur = p.scene {
            let zoomed = (p as? AWCChartBarInteraction)?.consumeZoomRender() ?? false
            if !zoomed && !reducedMotion, let o = old, o.width == cur.width, o.height == cur.height, awcChartBarsDiffer(o, cur) || follow.active {
                follow.active = true
                return
            }
            follow.settle(cur)
        }
    }
    private(set) var barDrillSplit = false

    /// md-bar-chart drill(): arm the next data swap to grow out of its slots (cascading on the way down).
    func drill(_ index: Int, direction: String) {
        if kind == .pie { pie?.drill(index, direction: direction); return }
        barDrill = (direction != "up", nil, now())
    }

    private func buildPieSpec() -> AWCChartPieSpec? {
        guard let p = pie else { return nil }
        var inp = input()
        inp.legendHidden = p.legendHidden
        return awcChartBuildPieSpec(inp, theme: theme, rtl: rtl)
    }

    private func layoutPie(_ spec: AWCChartPieSpec) -> AWCChartScene? {
        let s = awcChartComputePieLayout(spec, theme.engine, Double(size.width).rounded(), Double(size.height).rounded())
        sceneLtr = s
        return s
    }

    private func afterPieRender() {
        guard let p = pie, let s = p.scene, let spec = p.spec else { return }
        if p.introToken != lastIntroToken { lastIntroToken = p.introToken; intro.replay() }
        let (variant, duration) = awcChartResolveIntro(animation: spec.animation, animationDuration: spec.animationDuration, animate: nil)
        intro.render(hasContent: !s.slices.isEmpty, variant: variant, duration: duration, reducedMotion: reducedMotion, now: now(), staggerSeries: 1)
    }

    private func rebuildSpark(_ p: AWCChartPlotInteraction) {
        let t = theme
        let old = p.scene
        let input = AWCChartSparkInput(props: props, tokens: tokens, formatters: formatters)
        let ltr = awcChartRenderSparkScene(input, theme: t, width: Double(size.width).rounded(), height: Double(size.height).rounded(), rtl: false)
        let fmt: (Double) -> String = { [formatters] v in formatters.valueFormatter?(v) ?? AWCChartIntl.number(v, "") }
        (p as? AWCChartCartesianInteraction)?.yFormatter = fmt
        (p as? AWCChartBarInteraction)?.valueFormatter = fmt
        sceneLtr = ltr
        p.scene = rtl ? awcChartMirrorScene(ltr) : ltr
        afterRender(p, old: old, variant: props.bool("noAnimation") ? "none" : "expressive", duration: AWC_CHART_INTRO_MS)
    }

    // ── per frame ──

    var activePlot: AWCChartPlotInteraction? { plot ?? spark?.plot }

    var animating: Bool {
        intro.start != nil || barDrillStart != nil || follow.active || (activePlot?.animating ?? false) || (pie?.animating ?? false)
    }

    struct Frame { var scene: AWCChartScene; var alpha: Double; var labelAlpha: Double; var over: (AWCChartScene, Double)? }

    /// The geometry to draw at `t` (the entrance, a drill or a follow step in flight, else the settled scene).
    func frame(_ t: Double) -> Frame? {
        activePlot?.tick(t)
        if let p = pie {
            p.tick(t)
            if let d = p.drillFrame(t) { return Frame(scene: d.base, alpha: 1, labelAlpha: d.labelProgress >= AWC_CHART_PIE_LABEL_ARRIVES_AT ? 1 : 0, over: (d.over, d.overAlpha)) }
            guard let settled = p.drawnScene(t) else { return nil }
            if let tr = intro.progress(t), let target = sceneLtr {
                let step = awcChartStepAnimation(intro.variant, target, tr)
                return Frame(scene: step.scene, alpha: step.alpha, labelAlpha: tr >= AWC_CHART_PIE_LABEL_ARRIVES_AT ? 1 : 0, over: nil)
            }
            return Frame(scene: settled, alpha: 1, labelAlpha: 1, over: nil)
        }
        guard let p = activePlot, let drawn = p.drawnScene() else { return nil }
        if let start = barDrillStart, let target = sceneLtr {
            let dur = intro.duration
            let tt = (t - start) / dur
            if tt >= 1 { barDrillStart = nil; follow.settle(drawn) }
            else { let s = awcChartDrillScene(target, tt, split: barDrillSplit); return Frame(scene: rtl ? awcChartMirrorScene(s) : s, alpha: 1, labelAlpha: 1, over: nil) }
        }
        if let tr = intro.progress(t), let target = sceneLtr {
            // md-bar-chart steps its finished (mirrored) scene (bar-chart.ts playIntro); the line/area engine sweeps in
            // LTR space and mirrors each frame, except the first, drawn before the loop from the un-mirrored scene (chart.ts).
            let first = intro.firstPaint
            intro.firstPaint = false
            if kind == .bar {
                let step = awcChartStepAnimation(intro.variant, rtl ? awcChartMirrorScene(target) : target, tr)
                return Frame(scene: step.scene, alpha: step.alpha, labelAlpha: 1, over: nil)
            }
            let step = awcChartStepAnimation(intro.variant, target, tr)
            let s = first || !rtl ? step.scene : awcChartMirrorScene(step.scene)
            return Frame(scene: s, alpha: step.alpha, labelAlpha: 1, over: nil)
        }
        if follow.active {
            var s = drawn
            s.bars = follow.frame(drawn, now: t)
            return Frame(scene: s, alpha: 1, labelAlpha: 1, over: nil)
        }
        return Frame(scene: drawn, alpha: 1, labelAlpha: 1, over: nil)
    }

    // ── input forwarding (each call may change what is drawn) ──

    func perform(_ body: () -> Void) { body(); announceIfNeeded(); bump() }

    private func announceIfNeeded() {
        let text = pie?.announcement ?? activePlot?.announcement ?? ""
        guard text != lastAnnouncement else { return }
        lastAnnouncement = text
        guard !text.isEmpty else { return }
        if #available(iOS 17.0, macOS 14.0, *) { AccessibilityNotification.Announcement(text).post() }
    }

    var announcement: String { pie?.announcement ?? activePlot?.announcement ?? "" }
}

extension AWCChartBarInteraction {
    /// True once after a zoom re-render (a view change snaps instead of following).
    func consumeZoomRender() -> Bool { let z = zoomRenderPending; zoomRenderPending = false; return z }
}

// MARK: The chart view

struct AWCNativeChartView: View {
    let nodeID: String
    let kind: AWCChartKind
    let properties: [String: AWCValue]
    let slots: [String: [AWCNode]]
    @Environment(\.awcThemeTokens) private var envTokens
    @Environment(\.awcChartAppearance) private var appearance
    @Environment(\.awcChartController) private var publicController
    @Environment(\.displayScale) private var displayScale
    @Environment(\.layoutDirection) private var direction
    @Environment(\.awcNativeDensity) private var inheritedDensity
    @Environment(\.awcChartFormatters) private var allFormatters
    @Environment(\.awcEventDispatcher) private var dispatcher
    @Environment(\.awcEventTargetListeners) private var listeners
    let onEvent: (AWCEvent) -> Void
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @StateObject private var ctl = AWCChartState()
    @State private var tipSize: CGSize = .zero
    @State private var dragStart: CGPoint? = nil

    init(nodeID: String, tag: String, properties: [String: AWCValue], slots: [String: [AWCNode]] = [:], onEvent: @escaping (AWCEvent) -> Void = { _ in }) {
        self.nodeID = nodeID; self.kind = AWCChartKind(rawValue: tag) ?? .line; self.properties = properties; self.slots = slots; self.onEvent = onEvent
    }

    private var props: AWCChartProps { AWCChartProps(properties) }
    /// Theme tokens, then the typed hooks (`.awcChartAppearance`), then the host's inline `style` custom properties —
    /// what the source's computed style resolves for the engine theme and the host box.
    private var tokens: [String: String] { awcEffectiveTokens(envTokens, hooks: appearance.hooks(prefix: kind.prefix), style: properties["style"]?.string) }
    private var density: Double { kind == .sparkline ? inheritedDensity : awcChartDensity(props, inherited: inheritedDensity) }
    private var formatters: AWCChartFormatters { allFormatters[nodeID] ?? allFormatters[""] ?? AWCChartFormatters() }
    private var host: AWCChartHostMetrics { AWCChartHostMetrics.of(kind, tokens: tokens, density: density) }
    private var rtl: Bool { direction == .rightToLeft }
    private var explicitHeight: Double? {
        if kind == .sparkline { return awcChartCSSPixels(props.optStr("height")) ?? awcChartCSSPixels(tokens["--md-sparkline-block-size"]) ?? 28 }
        return awcChartCSSPixels(props.optStr("height")) ?? awcChartCSSPixels(tokens["--\(kind.prefix)-block-size"])
    }
    private var zoomSliderOn: Bool { (kind == .line || kind == .area || (kind == .bar && !props.bool("polar"))) && ["slider", "both"].contains(props.str("zoom", "none")) }
    private var zoomSize: Double { awcChartCSSPixels(tokens["--\(kind.prefix)-zoom-size"]) ?? 28 }
    private var isEmpty: Bool {
        let loading = props.bool("loading")
        switch kind {
        case .pie: return (props.obj("data")?.array.isEmpty ?? true) && !loading
        case .sparkline: return false
        default: return (props.obj("series")?.array.isEmpty ?? true) && !loading
        }
    }

    var body: some View {
        let h = host
        let _ = ctl.version
        GeometryReader { geo in
            let w = geo.size.width, ht = geo.size.height
            let plotW = Swift.max(0, w - 2 * h.padding)
            let plotH = Swift.max(0, ht - 2 * h.padding - (zoomSliderOn ? zoomSize : 0))
            let _ = sync(CGSize(width: plotW, height: plotH))
            ZStack(alignment: .topLeading) {
                // header / footer slots: in-flow blocks (margin-block 8px, collapsing) inside the padding, under the
                // absolutely positioned canvas, which covers the whole padding box (chart CSS) — so they share its top.
                let flow = (slots["header"] ?? []) + (slots["footer"] ?? [])
                if !flow.isEmpty {
                    VStack(alignment: .leading, spacing: 8) { ForEach(flow) { AWCNativeView(node: $0) } }
                        .padding(.vertical, 8)
                        .frame(width: plotW, alignment: .topLeading)
                        .environment(\.layoutDirection, direction)
                        .offset(x: h.padding, y: h.padding)
                }
                if plotW >= 2 && plotH >= 2 {
                    plotStack(plotW, plotH, globalTop: geo.frame(in: .global).minY + h.padding)
                        .frame(width: plotW, height: plotH, alignment: .topLeading)
                        .offset(x: h.padding, y: h.padding)
                    if zoomSliderOn {
                        AWCChartZoomSlider(ctl: ctl, tokens: tokens, prefix: kind.prefix, rtl: rtl, labelStart: props.str("labelZoomStart", "Zoom range start"), labelEnd: props.str("labelZoomEnd", "Zoom range end"), xData: props.obj("xAxis")?["data"].array ?? [])
                            .frame(width: plotW, height: zoomSize)
                            .offset(x: h.padding, y: h.padding + plotH)
                    }
                }
                if kind == .pie, let center = slots["center"], !center.isEmpty, let scene = ctl.pie?.scene {
                    // md-pie-chart's centre slot: centred on the ring's computed centre (getCenter(), canvas-relative,
                    // plus the padding), capped at the hole (getHoleBox()); physical coordinates in either direction.
                    let c = scene.pieCenterSlot ?? AWCChartPt(x: scene.plot.x + scene.plot.width / 2, y: scene.plot.y + scene.plot.height / 2)
                    let holeW = scene.pieHoleSize ?? 0, holeH = scene.pieHoleHeight ?? 0
                    ZStack { ForEach(center) { AWCNativeView(node: $0) } }
                        .multilineTextAlignment(.center)
                        .foregroundStyle(Color(awcChartCSS: tokens["--md-pie-chart-center-color"].flatMap { $0.isEmpty ? nil : $0 } ?? awcChartToken(tokens, "--md-sys-color-on-surface", "#1C1B1F")))
                        .frame(maxWidth: holeW > 0 ? holeW : nil, maxHeight: holeH > 0 ? holeH : nil)
                        .fixedSize(horizontal: holeW <= 0, vertical: holeH <= 0)
                        .environment(\.layoutDirection, direction)
                        .position(x: h.padding + c.x, y: h.padding + c.y)
                }
                if let subtitle = props.optStr("subtitle"), !subtitle.isEmpty, kind != .sparkline {
                    Color.clear.frame(width: 1, height: 1)
                        .accessibilityElement().accessibilityLabel(subtitle).accessibilityAddTraits(.isStaticText)
                        .offset(x: h.padding, y: h.padding)
                }
                if isEmpty { emptyOverlay(h).environment(\.layoutDirection, direction) }
                if props.bool("loading") { loadingOverlay(h).environment(\.layoutDirection, direction) }
            }
            .frame(width: w, height: ht, alignment: .topLeading)
            // Every part is placed at the engine's physical coordinates (already mirrored for RTL): SwiftUI must not flip
            // them again. Text runs that follow the host direction (legend chips, tooltip cards, empty / loading) re-apply it.
            .environment(\.layoutDirection, .leftToRight)
        }
        .frame(height: explicitHeight.map { CGFloat($0) })
        .modifier(AWCChartAspectSizing(aspect: host.aspect, minHeight: host.minHeight, explicit: explicitHeight != nil))
        .background(Color(awcChartCSS: host.background), in: RoundedRectangle(cornerRadius: host.shape))
        .awcInspect(nodeID: nodeID, name: kind.rawValue) { size in inspectionMetrics(size) }
        .modifier(AWCChartHostAccessibility(image: kind == .sparkline, summary: summary))
        .onAppear { publicController?.state = ctl; publicController?.scale = displayScale }
        .onDisappear { if publicController?.state === ctl { publicController?.state = nil } }
    }

    /// Laboratory inspection: the host box hooks, the plot box, the live announcement and the interaction state.
    private func inspectionMetrics(_ size: CGSize) -> [String: AWCValue] {
        let h = host
        var m: [String: AWCValue] = ["background": .string(h.background), "padding": .number(h.padding), "shape": .number(h.shape),
                                     "width": .number(Double(size.width)), "height": .number(Double(size.height)), "announcement": .string(ctl.announcement)]
        if let scene = ctl.activePlot?.scene ?? ctl.pie?.scene {
            m["plotX"] = .number(scene.plot.x); m["plotY"] = .number(scene.plot.y); m["plotWidth"] = .number(scene.plot.width); m["plotHeight"] = .number(scene.plot.height)
            m["legendHidden"] = .array(scene.legend.map { .bool($0.hidden) })
            m["lines"] = .number(Double(scene.lines.count)); m["areas"] = .number(Double(scene.areas.count)); m["bars"] = .number(Double(scene.bars.count))
            m["slices"] = .number(Double(scene.slices.count))
            if let c = scene.pieCenterSlot { m["centerX"] = .number(c.x + h.padding); m["centerY"] = .number(c.y + h.padding) }
        }
        if let p = ctl.activePlot, kind != .pie, kind != .sparkline { let w = p.win(); m["zoomStart"] = .number(Double(w.0)); m["zoomEnd"] = .number(Double(w.1)) }
        return m
    }

    private func sync(_ plot: CGSize) {
        ctl.nodeID = nodeID
        ctl.dispatch = { [kind, dispatcher, listeners, onEvent] id, name, payload in
            onEvent(AWCEventDispatcher.dispatch(AWCEvent(name: name, tag: kind.rawValue, nodeID: id, detail: payload), through: dispatcher, targetListeners: listeners).observedEvent)
        }
        ctl.sync(kind: kind, properties: properties, tokens: tokens, density: density, formatters: formatters, size: plot, rtl: rtl, reducedMotion: reduceMotion)
    }

    // MARK: plot

    @ViewBuilder private func plotStack(_ w: Double, _ h: Double, globalTop: Double) -> some View {
        TimelineView(.animation(paused: !ctl.animating)) { tl in
            let _ = tl.date
            let t = ctl.now()
            let fr = ctl.frame(t)
            ZStack(alignment: .topLeading) {
                if let fr {
                    Canvas { ctx, _ in
                        var c = ctx
                        c.opacity = fr.alpha
                        awcChartDrawScene(&c, fr.scene)
                        if let ov = fr.over { var o = ctx; o.opacity = ov.1; awcChartDrawScene(&o, ov.0) }
                        awcChartDrawBarLabels(&c, fr.scene)
                        // The text overlay is synced once per render (it does not animate); glyphs and end labels ride the frame.
                        var overlay = ctl.pie?.scene ?? fr.scene
                        if ctl.pie == nil { overlay.glyphs = fr.scene.glyphs; overlay.endLabels = fr.scene.endLabels }
                        var g = ctx; g.opacity = ctl.pie == nil ? 1 : 1
                        awcChartDrawOverlay(&g, overlay, pieLabelAlpha: fr.labelAlpha)
                    }
                    .accessibilityHidden(true)
                    hoverLayer(t, globalTop: globalTop)
                    if let band = ctl.activePlot?.dragBand, abs(band.1 - band.0) > 1, let plot = ctl.activePlot?.scene?.plot {
                        Rectangle().fill(Color(awcChartCSS: bandColor))
                            .overlay(HStack(spacing: 0) { handleEdge; Spacer(minLength: 0); handleEdge })
                            .frame(width: abs(band.1 - band.0), height: plot.height)
                            .offset(x: Swift.min(band.0, band.1), y: plot.y)
                            .allowsHitTesting(false)
                    }
                }
            }
        }
        .frame(width: w, height: h, alignment: .topLeading)
        .contentShape(Rectangle())
        .modifier(AWCChartPointerInput(ctl: ctl, size: CGSize(width: w, height: h), dragStart: $dragStart))
        .modifier(AWCChartKeyboard(ctl: ctl, enabled: kind != .sparkline && !isEmpty, label: props.str("labelPlot", kind == .pie
            ? "Chart data. Use the arrow keys to move between slices, Home and End for the first and last, Escape to leave."
            : "Chart data. Use the arrow keys to move between points, Home and End for the first and last, Escape to leave."), rtl: rtl,
            descriptor: awcChartAXDescriptor(kind: kind, props: props, summary: summary)))
        .overlay(alignment: .topLeading) { legendLayer() }
    }

    private var bandColor: String {
        tokens["--\(kind.prefix)-zoom-band-color"].flatMap { $0.isEmpty ? nil : $0 } ?? awcChartWithAlpha(awcChartToken(tokens, "--md-sys-color-primary", "#6750A4"), 0.16)
    }
    private var handleEdge: some View {
        Rectangle().fill(Color(awcChartCSS: tokens["--\(kind.prefix)-zoom-handle-color"].flatMap { $0.isEmpty ? nil : $0 } ?? awcChartToken(tokens, "--md-sys-color-primary", "#6750A4"))).frame(width: 1)
    }

    // MARK: hover layer

    @ViewBuilder private func hoverLayer(_ t: Double, globalTop: Double) -> some View {
        if let p = ctl.activePlot, let hs = p.hover {
            let m = hs.model
            let onSurface = awcChartToken(tokens, "--md-sys-color-on-surface", "#1C1B1F")
            let surface = awcChartToken(tokens, "--md-sys-color-surface", "#FFFBFE")
            ZStack(alignment: .topLeading) {
                if let line = m.line {
                    ZStack {
                        Rectangle().fill(Color(awcChartCSS: surface)).frame(width: line.width + 2, height: line.height + 2)
                        Rectangle().fill(Color(awcChartCSS: onSurface)).frame(width: line.width, height: line.height)
                    }
                    .opacity(0.7)
                    .position(x: line.midX, y: line.midY)
                }
                ForEach(Array(m.markers.enumerated()), id: \.offset) { _, mk in
                    let pop = mk.dimmed ? 1 : (hs.popStart.map { awcChartPopScale(t - $0) } ?? 1)
                    AWCChartHoverMarker(symbol: mk.symbol, color: mk.color, surface: surface)
                        .scaleEffect(pop)
                        .opacity(mk.dimmed ? 0.4 : 1)
                        .position(x: mk.x, y: mk.y)
                }
                if m.customText != nil || !m.rows.isEmpty {
                    let o = p.tooltipOrigin(tipSize.width, tipSize.height, roomAbove: globalTop - awcJSRound(tipSize.height) - 6 >= 0) ?? .zero
                    AWCChartTooltipCard(model: m, fontSize: hs.scene.texts.first?.fontSize ?? 12, tokens: tokens)
                        .environment(\.layoutDirection, kind == .bar ? .leftToRight : direction)   // the bar card never takes the host direction (Web)
                        .onGeometryChange(for: CGSize.self) { $0.size } action: { tipSize = $0 }
                        .offset(x: o.x, y: o.y)
                        .opacity(tipSize == .zero ? 0 : 1)
                }
            }
            .allowsHitTesting(false)
        } else if let pie = ctl.pie, let tip = pie.tooltip {
            let o = pie.tooltipOrigin(tipSize.width, tipSize.height) ?? .zero
            AWCChartPieTooltipCard(tip: tip, fontSize: ctl.theme.labelSize, tokens: tokens)
                .environment(\.layoutDirection, direction)
                .onGeometryChange(for: CGSize.self) { $0.size } action: { tipSize = $0 }
                .offset(x: o.x, y: o.y)
                .opacity(tipSize == .zero ? 0 : 1)
                .allowsHitTesting(false)
        }
    }

    // MARK: legend

    @ViewBuilder private func legendLayer() -> some View {
        if let scene = ctl.activePlot?.scene ?? ctl.pie?.scene, kind != .sparkline {
            let layout = awcChartLegendLayout(scene, rtl: rtl)
            ZStack(alignment: .topLeading) {
                ForEach(layout.chips.indices, id: \.self) { i in
                    let chip = layout.chips[i]
                    AWCChartLegendChip(item: chip.item, fontSize: layout.fontSize, rtl: rtl, tokens: tokens) {
                        ctl.perform {
                            ctl.activePlot?.pointerLeave(); ctl.pie?.pointerLeave()
                            if let p = ctl.activePlot { p.legendToggle(chip.item.seriesIndex) } else { ctl.pie?.legendToggle(chip.item.seriesIndex) }
                        }
                    }
                    .environment(\.layoutDirection, direction)
                    .frame(width: chip.frame.width, height: chip.frame.height, alignment: rtl ? .trailing : .leading)
                    .offset(x: chip.frame.minX, y: chip.frame.minY)
                    .onHover { inside in if inside { ctl.perform { ctl.activePlot?.pointerLeave(); ctl.pie?.pointerLeave() } } }
                }
            }
        }
    }

    // MARK: empty / loading

    private func emptyOverlay(_ h: AWCChartHostMetrics) -> some View {
        let fontSize = awcChartCSSPixels(tokens["--\(kind.prefix)-empty-font-size"]) ?? awcChartCSSPixels(tokens["--md-sys-typescale-body-medium-font-size"]) ?? 14
        return VStack(spacing: 12) {
            if let slot = slots["empty"], !slot.isEmpty { ForEach(slot) { AWCNativeView(node: $0) } }
            else { Text(props.str("labelEmpty", "No data to display")).font(.custom("Roboto-Regular", fixedSize: fontSize)).multilineTextAlignment(.center) }
        }
        .foregroundColor(Color(awcChartCSS: h.emptyColor))
        .padding(24)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(awcChartCSS: h.emptyBackground), in: RoundedRectangle(cornerRadius: h.shape))
        .allowsHitTesting(false)
    }

    private func loadingOverlay(_ h: AWCChartHostMetrics) -> some View {
        let label = props.str("loadingLabel", "Loading chart…")
        let fontSize = awcChartCSSPixels(tokens["--md-sys-typescale-body-medium-font-size"]) ?? 14
        return VStack(spacing: 12) {
            if let slot = slots["loader"] ?? slots["loading"], !slot.isEmpty { ForEach(slot) { AWCNativeView(node: $0) } }
            else {
                AWCNativeView(node: AWCNode(id: "\(nodeID)-spinner", tag: "md-progress-indicator", properties: ["variant": .string("circular"), "indeterminate": .bool(true), "label": .string(label)]))
                    .frame(width: 40, height: 40)
                Text(label).font(.custom("Roboto-Regular", fixedSize: fontSize)).accessibilityHidden(true)
            }
        }
        .foregroundColor(Color(awcChartCSS: h.emptyColor))
        .padding(24)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(awcChartCSS: h.emptyBackground), in: RoundedRectangle(cornerRadius: h.shape))
    }

    /// a11y.ts `buildChartSummary` (the host's aria-label) unless `summary` is authored.
    private var summary: String {
        let authored = props.str("summary", "")
        if !authored.isEmpty && kind != .sparkline { return authored }
        let locale = props.str("locale", "")
        switch kind {
        case .pie:
            let n = props.obj("data")?.array.count ?? 0
            return awcChartBuildSummary(title: props.str("label", ""), chartType: "pie", seriesCount: n, xMin: nil, xMax: nil, locale: locale)
        case .sparkline: return awcChartSparkSummary(props, formatters: formatters)
        default:
            let series = props.obj("series")?.array ?? []
            let xs: [AWCChartAxisValue]
            if kind == .line {
                let axisData = props.obj("xAxis").map { $0["data"].array.compactMap(awcChartAxisValue) }
                xs = awcChartNormalizeSeriesX(series.map { $0["data"].array }, axisData, props.obj("xAxis").flatMap { AWCChartScaleType(rawValue: $0["scale"].string) } ?? .category).xValues
            } else { xs = props.obj("xAxis").map { $0["data"].array.compactMap(awcChartAxisValue) } ?? [] }
            let type = kind == .bar ? "bar" : (kind == .area || props.bool("area")) ? "area" : "line"
            // md-bar-chart builds its summary without the locale.
            return awcChartBuildSummary(title: props.str("label", ""), chartType: type, seriesCount: series.count, xMin: xs.first, xMax: xs.last, locale: kind == .bar ? "" : locale)
        }
    }
}

// MARK: Pointer input

/// Pointer → controller: hover (macOS pointer / iPad trackpad), press, drag, release, double click. Touch has no
/// hover, so a touch reports a move with its press and leaves after its release, as a browser does for touch.
private struct AWCChartPointerInput: ViewModifier {
    @ObservedObject var ctl: AWCChartState
    let size: CGSize
    @Binding var dragStart: CGPoint?
    func body(content: Content) -> some View {
        content
            .onContinuousHover(coordinateSpace: .local) { phase in
                ctl.perform {
                    switch phase {
                    case .active(let p): move(p)
                    case .ended: ctl.activePlot?.pointerLeave(); ctl.pie?.pointerLeave()
                    }
                }
            }
            .gesture(DragGesture(minimumDistance: 0, coordinateSpace: .local)
                .onChanged { v in
                    ctl.perform {
                        if dragStart == nil {
                            dragStart = v.startLocation
                            move(v.startLocation)
                            ctl.activePlot?.pointerDown(v.startLocation.x, v.startLocation.y, button: 0)
                            ctl.pie?.pointerDown(v.startLocation.x, v.startLocation.y)
                        }
                        move(v.location)
                    }
                }
                .onEnded { v in
                    ctl.perform {
                        dragStart = nil
                        let inside = v.location.x >= 0 && v.location.y >= 0 && v.location.x <= size.width && v.location.y <= size.height
                        ctl.activePlot?.pointerUp(v.location.x, v.location.y, insideCanvas: inside)
                        if inside { ctl.pie?.pointerUp(v.location.x, v.location.y) }
                        #if os(iOS)
                        ctl.activePlot?.pointerLeave(); ctl.pie?.pointerLeave()
                        #endif
                    }
                })
    }
    private func move(_ p: CGPoint) {
        let inside = p.x >= 0 && p.y >= 0 && p.x <= size.width && p.y <= size.height
        if inside { ctl.activePlot?.pointerMove(p.x, p.y); ctl.pie?.pointerMove(p.x, p.y) }
        else if ctl.activePlot?.dragBand != nil { ctl.activePlot?.pointerMove(p.x, p.y) }
    }
}

// MARK: Keyboard

/// The focusable plot (role=application on the Web): arrows walk the data, Home / End jump, Enter / Space
/// activate, Escape leaves; blur clears the cursor. The keyboard stop and the accessibility element are the native plot
/// focus bridge (ChartPlotFocusBridge.swift): a Tab stop in the AppKit key-view loop / the AWC UIKit loop, an element
/// with increment / decrement (iOS: adjustable — VoiceOver swipes step the cursor) that carries the chart descriptor.
private struct AWCChartKeyboard: ViewModifier {
    @ObservedObject var ctl: AWCChartState
    let enabled: Bool
    let label: String
    let rtl: Bool
    let descriptor: AWCChartAXDescriptor?
    func body(content: Content) -> some View {
        if enabled {
            content
                .accessibilityHidden(true)
                .awcFocusBridgeLayer {
                    AWCChartPlotFocusBridge(configuration: AWCChartPlotFocusConfiguration(
                        label: label, value: ctl.announcement, descriptor: descriptor, rtl: rtl,
                        onKey: { key in
                            var handled = false
                            ctl.perform { handled = ctl.pie?.keyDown(key) ?? ctl.activePlot?.keyDown(key) ?? false }
                            return handled
                        },
                        onFocus: { now in if !now { ctl.perform { ctl.activePlot?.blur(); ctl.pie?.blur() } } }))
                }
        } else { content }
    }
}

/// The host: a labelled container (the Web host's aria-label summary), or for md-sparkline an image (role="img").
private struct AWCChartHostAccessibility: ViewModifier {
    let image: Bool
    let summary: String
    func body(content: Content) -> some View {
        if image { content.accessibilityElement(children: .ignore).accessibilityLabel(summary).accessibilityAddTraits(.isImage) }
        else { content.accessibilityElement(children: .contain).accessibilityLabel(summary) }
    }
}

// MARK: Zoom slider (the md-slider range the Web chart embeds, with the pan grip over its window)

private struct AWCChartZoomSlider: View {
    @ObservedObject var ctl: AWCChartState
    let tokens: [String: String]
    let prefix: String
    let rtl: Bool
    let labelStart: String
    let labelEnd: String
    let xData: [AWCValue]
    @State private var panning = false
    var body: some View {
        GeometryReader { geo in
            let p = ctl.activePlot
            let last = Double(Swift.max(1, (p?.dataLength() ?? 1) - 1))
            let w = p?.win() ?? (0, 0)
            let width = geo.size.width
            let x: (Int) -> Double = { i in let f = Double(i) / last; return (rtl ? 1 - f : f) * width }
            let frac: (Double) -> Double = { px in let raw = px / Swift.max(1, width); return Swift.min(Swift.max(rtl ? 1 - raw : raw, 0), 1) }
            let track = tok("track-color", "--md-sys-color-surface-container-highest", "#E6E0E9")
            let window = tok("window-color", "--md-sys-color-secondary-container", "#E8DEF8")
            let handle = tok("handle-color", "--md-sys-color-primary", "#6750A4")
            let lo = Swift.min(x(w.0), x(w.1)), hi = Swift.max(x(w.0), x(w.1))
            ZStack(alignment: .leading) {
                Capsule().fill(Color(awcChartCSS: track)).frame(height: 12)
                Capsule().fill(Color(awcChartCSS: window)).frame(width: Swift.max(0, hi - lo), height: 12).offset(x: lo)
                // Pan grip, inset 10px at both ends so the thumbs stay grabbable.
                Color.clear.contentShape(Rectangle()).frame(width: Swift.max(0, hi - lo - 20), height: geo.size.height).offset(x: lo + 10)
                    .gesture(DragGesture(minimumDistance: 0, coordinateSpace: .named("awc-zoom")).onChanged { v in
                        ctl.perform { if !panning { panning = true; p?.panStart(frac(v.startLocation.x)) }; p?.panMove(frac(v.location.x)) }
                    }.onEnded { _ in panning = false; ctl.perform { p?.panEnd() } })
                thumb(handle, at: x(w.0), height: geo.size.height, label: labelStart, value: text(w.0)) { v in ctl.perform { p?.zoomSliderInput(Double(v), Double(w.1)) } } drag: { px in
                    ctl.perform { p?.zoomSliderInput((frac(px) * last).rounded(), Double(w.1)) }
                }
                thumb(handle, at: x(w.1), height: geo.size.height, label: labelEnd, value: text(w.1)) { v in ctl.perform { p?.zoomSliderInput(Double(w.0), Double(v)) } } drag: { px in
                    ctl.perform { p?.zoomSliderInput(Double(w.0), (frac(px) * last).rounded()) }
                }
            }
            .frame(height: geo.size.height)
            .coordinateSpace(name: "awc-zoom")
        }
    }
    private func tok(_ k: String, _ sys: String, _ fallback: String) -> String {
        tokens["--\(prefix)-zoom-\(k)"].flatMap { $0.isEmpty ? nil : $0 } ?? awcChartToken(tokens, sys, fallback)
    }
    private func text(_ i: Int) -> String { i < xData.count ? xData[i].string : String(i) }
    private func thumb(_ color: String, at x: Double, height: Double, label: String, value: String, step: @escaping (Int) -> Void, drag: @escaping (Double) -> Void) -> some View {
        let w = ctl.activePlot?.win() ?? (0, 0)
        return Capsule().fill(Color(awcChartCSS: color)).frame(width: 4, height: height)
            .padding(.horizontal, 8).contentShape(Rectangle())
            .offset(x: x - 10)
            .gesture(DragGesture(minimumDistance: 0, coordinateSpace: .named("awc-zoom")).onChanged { v in drag(v.location.x) })
            .accessibilityElement()
            .accessibilityLabel(label)
            .accessibilityValue(value)
            .accessibilityAdjustableAction { dir in
                let isStart = label == labelStart
                let cur = isStart ? w.0 : w.1
                step(dir == .increment ? cur + 1 : cur - 1)
            }
    }
}

// MARK: Cards

/// pie-chart.ts `renderTooltip`'s card: swatch, label, value with its share (or a custom renderer's text).
struct AWCChartPieTooltipCard: View {
    let tip: AWCChartPieTooltip
    let fontSize: Double
    let tokens: [String: String]
    var body: some View {
        let bg = awcChartToken(tokens, "--md-sys-color-surface-container-high", "#ECE6F0")
        let ink = awcChartToken(tokens, "--md-sys-color-on-surface", "#1C1B1F")
        Group {
            if let custom = tip.customText {
                Text(custom).font(.custom(awcChartFontName(weight: 400), fixedSize: fontSize))
            } else {
                HStack(spacing: 8) {
                    RoundedRectangle(cornerRadius: 3).fill(Color(awcChartCSS: tip.color ?? "transparent")).frame(width: 10, height: 10)
                    Text(tip.label ?? "").font(.custom(awcChartFontName(weight: 400), fixedSize: fontSize)).fixedSize()
                    Text(tip.value ?? "").font(.custom(awcChartFontName(weight: 700), fixedSize: fontSize)).fixedSize()
                }
                .frame(height: fontSize * 1.5)
            }
        }
        .foregroundColor(Color(awcChartCSS: ink))
        .padding(.vertical, 8).padding(.horizontal, 10)
        .background(Color(awcChartCSS: bg), in: RoundedRectangle(cornerRadius: 8))
        .shadow(color: .black.opacity(0.15), radius: 3, x: 0, y: 2)
        .shadow(color: .black.opacity(0.2), radius: 1, x: 0, y: 1)
        .fixedSize()
    }
}

// MARK: Bar value labels (overlay.ts renderBarLabels: re-placed from the bars' current geometry every frame)

func awcChartDrawBarLabels(_ ctx: inout GraphicsContext, _ scene: AWCChartScene) {
    for bl in scene.barLabels ?? [] {
        let pieces = scene.bars.filter { $0.seriesIndex == bl.seriesIndex && $0.dataIndex == bl.dataIndex }
        guard let first = pieces.first else { continue }
        let horizontal = first.horizontal == true
        let loX = pieces.map(\.x).min()!, hiX = pieces.map { $0.x + $0.w }.max()!
        let loY = pieces.map(\.y).min()!, hiY = pieces.map { $0.y + $0.h }.max()!
        var x: Double, y: Double, ax: Double, ay: Double
        if bl.inside == true {
            x = (loX + hiX) / 2; y = (loY + hiY) / 2; ax = -0.5; ay = -0.5
            if let arrow = first.arrow, arrow != 0 {
                let tip = awcChartChevronTipDepth(horizontal ? hiY - loY : hiX - loX)
                let cut = first.notch == false ? 0 : tip
                let shift = Double(arrow) * (tip + cut) / 2
                if horizontal { x += shift } else { y -= shift }
            }
        } else if horizontal {
            y = (loY + hiY) / 2; ay = -0.5
            x = bl.atLowEnd == true ? loX - 4 : hiX + 4; ax = bl.atLowEnd == true ? -1 : 0
        } else {
            x = (loX + hiX) / 2; ax = -0.5
            y = bl.atLowEnd == true ? hiY + 4 : loY - 4; ay = bl.atLowEnd == true ? 0 : -1
        }
        awcChartDrawSpan(&ctx, text: bl.text, x: x, y: y, ax: ax, ay: ay, size: bl.size, weight: bl.fontWeight ?? 400, color: bl.color)
    }
}
