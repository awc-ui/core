import SwiftUI
import QuartzCore
#if os(macOS)
import AppKit
#else
import UIKit
#endif

// Dedicated SwiftUI renderer for md-stepper / md-step. AWCStepperModel owns the behaviour (active index and its watcher,
// linear reachability, auto-complete, navigation, the cancelable mdBeforeChange, announcements); AWCStepperLayout gives
// every box and colour as Chrome lays them out (row / grid / rail / mobile bar, density, hooks, RTL) and runs the CSS
// transitions through AWCStepperMotion. The chrome (bubbles, dots, halos, state layers, connectors, labels, focus ring)
// is drawn on a Canvas from the layout; step content, the `content` slot and the built-in nav (native md-buttons) are
// real views placed by AWCStepperFrame, which measures them and feeds their sizes back into the layout.

// MARK: - Public API

/// Typed `--md-step-*` hooks (19, inherited by every step) and `--md-stepper-gap`: colours as CSS colour text, lengths
/// in points.
public struct AWCStepperAppearance: Equatable, Sendable {
    public let css: [String: String]
    static let stepSuffixes = ["indicator-size", "indicator-ring", "indicator-color", "indicator-text", "active-color", "active-text", "active-halo-color",
                               "completed-color", "completed-text", "error-color", "error-text", "connector-color", "connector-filled-color",
                               "connector-thickness", "label-color", "label-active-color", "description-color", "state-layer-color", "panel-padding-block-start",
                               "connector-duration", "expand-duration", "collapse-duration"]
    public init(indicatorSize: Double? = nil, indicatorRing: Double? = nil, indicatorColor: String? = nil, indicatorText: String? = nil,
                activeColor: String? = nil, activeText: String? = nil, activeHaloColor: String? = nil, completedColor: String? = nil,
                completedText: String? = nil, errorColor: String? = nil, errorText: String? = nil, connectorColor: String? = nil,
                connectorFilledColor: String? = nil, connectorThickness: Double? = nil, labelColor: String? = nil, labelActiveColor: String? = nil,
                descriptionColor: String? = nil, stateLayerColor: String? = nil, panelPaddingBlockStart: Double? = nil, gap: Double? = nil,
                connectorDuration: Double? = nil, expandDuration: Double? = nil, collapseDuration: Double? = nil) {
        var c: [String: String] = [:]
        func px(_ k: String, _ v: Double?) { if let v, v.isFinite { c["--md-step-" + k] = "\(v)px" } }
        func text(_ k: String, _ v: String?) { if let v, !v.isEmpty { c["--md-step-" + k] = v } }
        px("indicator-size", indicatorSize); px("indicator-ring", indicatorRing); text("indicator-color", indicatorColor); text("indicator-text", indicatorText)
        text("active-color", activeColor); text("active-text", activeText); text("active-halo-color", activeHaloColor); text("completed-color", completedColor)
        text("completed-text", completedText); text("error-color", errorColor); text("error-text", errorText); text("connector-color", connectorColor)
        text("connector-filled-color", connectorFilledColor); px("connector-thickness", connectorThickness); text("label-color", labelColor)
        text("label-active-color", labelActiveColor); text("description-color", descriptionColor); text("state-layer-color", stateLayerColor)
        px("panel-padding-block-start", panelPaddingBlockStart)
        func ms(_ k: String, _ v: Double?) { if let v, v.isFinite, v >= 0 { c["--md-step-" + k] = "\(v)ms" } }
        ms("connector-duration", connectorDuration); ms("expand-duration", expandDuration); ms("collapse-duration", collapseDuration)
        if let gap, gap.isFinite { c["--md-stepper-gap"] = "\(gap)px" }
        css = c
    }
    public init(cssValues: [String: String]) {
        css = cssValues.filter { k, _ in k == "--md-stepper-gap" || (k.hasPrefix("--md-step-") && Self.stepSuffixes.contains(String(k.dropFirst("--md-step-".count)))) }
    }
    public init(values: [String: AWCValue]) {
        func n(_ k: String) -> Double? { values[k]?.number }
        func s(_ k: String) -> String? { values[k]?.string }
        self.init(indicatorSize: n("indicatorSize"), indicatorRing: n("indicatorRing"), indicatorColor: s("indicatorColor"), indicatorText: s("indicatorText"),
                  activeColor: s("activeColor"), activeText: s("activeText"), activeHaloColor: s("activeHaloColor"), completedColor: s("completedColor"),
                  completedText: s("completedText"), errorColor: s("errorColor"), errorText: s("errorText"), connectorColor: s("connectorColor"),
                  connectorFilledColor: s("connectorFilledColor"), connectorThickness: n("connectorThickness"), labelColor: s("labelColor"),
                  labelActiveColor: s("labelActiveColor"), descriptionColor: s("descriptionColor"), stateLayerColor: s("stateLayerColor"),
                  panelPaddingBlockStart: n("panelPaddingBlockStart"), gap: n("gap"),
                  connectorDuration: n("connectorDuration"), expandDuration: n("expandDuration"), collapseDuration: n("collapseDuration"))
    }
    public func merging(_ o: Self) -> Self { .init(cssValues: css.merging(o.css) { _, new in new }) }
}

/// md-stepper's methods: `next()`, `prev()`, `goTo(_:)`, `reset()` (the source's navigation rules and events).
@MainActor @Observable public final class AWCStepperController {
    @ObservationIgnored var actions: ((String, Int?) -> Void)?
    nonisolated public init() {}
    public var isConnected: Bool { actions != nil }
    public func next() { actions?("next", nil) }
    public func prev() { actions?("prev", nil) }
    public func goTo(_ index: Int) { actions?("goTo", index) }
    public func reset() { actions?("reset", nil) }
}

private struct AWCStepperAppearanceKey: EnvironmentKey { static let defaultValue = AWCStepperAppearance() }
private struct AWCStepperControllerKey: EnvironmentKey { static let defaultValue: AWCStepperController? = nil }
private struct AWCStepperReducedMotionKey: EnvironmentKey { static let defaultValue: Bool? = nil }
private struct AWCStepperSettledKey: EnvironmentKey { static let defaultValue = false }
public extension EnvironmentValues {
    var awcStepperAppearance: AWCStepperAppearance { get { self[AWCStepperAppearanceKey.self] } set { self[AWCStepperAppearanceKey.self] = newValue } }
    var awcStepperController: AWCStepperController? { get { self[AWCStepperControllerKey.self] } set { self[AWCStepperControllerKey.self] = newValue } }
    /// Overrides the system Reduce Motion setting for steppers below (tests and previews).
    var awcStepperReducedMotion: Bool? { get { self[AWCStepperReducedMotionKey.self] } set { self[AWCStepperReducedMotionKey.self] = newValue } }
    /// Renders steppers below settled — every transition and keyframe animation at its end (snapshots, still previews).
    var awcStepperSettled: Bool { get { self[AWCStepperSettledKey.self] } set { self[AWCStepperSettledKey.self] = newValue } }
}
private struct AWCStepperAppearanceModifier: ViewModifier {
    let value: AWCStepperAppearance
    @Environment(\.awcStepperAppearance) private var inherited
    func body(content: Content) -> some View { content.environment(\.awcStepperAppearance, inherited.merging(value)) }
}
public extension View {
    /// Applies md-stepper / md-step hook values to descendant steppers (inherited; nearer values win).
    func awcStepperAppearance(_ value: AWCStepperAppearance) -> some View { modifier(AWCStepperAppearanceModifier(value: value)) }
    /// Binds `next()`, `prev()`, `goTo(_:)` and `reset()` of the stepper below.
    func awcStepperController(_ controller: AWCStepperController) -> some View { environment(\.awcStepperController, controller) }
}

// MARK: - Runtime

/// Behaviour, motion, pointer state and the last measured layout of one stepper.
final class AWCStepperRuntime: ObservableObject {
    let model = AWCStepperModel()
    let motion = AWCStepperMotion()
    var pointer = AWCStepperPointer()
    /// Last layout (written by AWCStepperFrame, read by the chrome canvas and the header controls).
    var paint = AWCStepperPaint()
    var ripples: [Int: AWCRippleController] = [:]
    /// Layout → view feedback: the header controls and panel opacity read the last layout; the timeline runs while the
    /// motion does. A changed layout or a motion start / end schedules one more render.
    var signature = ""
    var timelineRunning = false
    var syncing = false
    var measureCache: [String: Double] = [:]
    @Published var version = 0
    func perform(_ body: () -> Void) { body(); version &+= 1 }
    func didLayout(_ p: AWCStepperPaint, now: Double) {
        let sig = "\(p.host.width)x\(p.host.height)|" + p.steps.map { "\($0.inner.x),\($0.inner.y),\($0.inner.width),\($0.indicator.x),\($0.indicator.width)" }.joined(separator: ";")
        let moving = motion.active(now)
        if sig != signature || moving != timelineRunning {
            signature = sig
            DispatchQueue.main.async { [weak self] in guard let self else { return }; self.timelineRunning = self.motion.active(CACurrentMediaTime() * 1000); self.version &+= 1 }
        }
    }
    var handles: [Int: AWCButtonFocusHandle] = [:]
    func handle(_ i: Int) -> AWCButtonFocusHandle { if let h = handles[i] { return h }; let h = AWCButtonFocusHandle(); handles[i] = h; return h }
    func ripple(_ i: Int) -> AWCRippleController { if let r = ripples[i] { return r }; let r = AWCRippleController(); ripples[i] = r; return r }
    lazy var measure: AWCStepperMeasure = { [unowned self] text, size, weight, ls in
        let key = "\(size)|\(weight)|\(ls)|\(text)"
        if let v = measureCache[key] { return v }
        let v = awcStepperCoreTextMeasure(text, size, weight, ls)
        if measureCache.count > 512 { measureCache.removeAll() }
        measureCache[key] = v
        return v
    }
}

/// The bundled Material Symbols face at FILL / wght (GRAD 0, opsz 24), as md-step's glyph uses it.
func awcStepperSymbolFont(size: Double, fill: Double, weight: Double) -> CTFont {
    _ = AWCNativeFonts.symbol(size: size)
    let axes: [NSNumber: Double] = [NSNumber(value: 0x46494C4C): fill, NSNumber(value: 0x77676874): weight,
                                     NSNumber(value: 0x47524144): 0, NSNumber(value: 0x6F70737A): 24]
    let d = CTFontDescriptorCreateWithAttributes([kCTFontNameAttribute: "MaterialSymbolsOutlined-Regular", kCTFontVariationAttribute: axes] as CFDictionary)
    return CTFontCreateWithFontDescriptor(d, size, nil)
}

extension Color {
    init(awcStepper c: AWCStepperRGBA) { self.init(.sRGB, red: c.r, green: c.g, blue: c.b, opacity: c.a) }
}

// MARK: - Layout container

/// Places the stepper's real views (chrome canvas, header controls, panels, slot, nav buttons) at the layout's boxes;
/// measures panel content, the slot and the nav buttons and feeds their sizes into AWCStepperLayout.
struct AWCStepperFrame: Layout {
    enum Role: Equatable { case chrome, header(Int), panel(Int), slot, navBack, navNext }
    let roles: [Role]
    let compute: (AWCStepperLayoutInput) -> AWCStepperPaint
    let base: AWCStepperLayoutInput
    let store: AWCStepperRuntime
    let now: Double

    func resolve(width: Double, subviews: Subviews) -> AWCStepperPaint {
        var input = base
        input.width = width
        // First pass for the panel widths, then measure every panel's natural height at that width.
        let first = compute(input)
        for (k, role) in roles.enumerated() {
            switch role {
            case .panel(let i):
                guard i < first.steps.count, let pn = first.steps[i].panel else { continue }
                input.panelInnerHeights[i] = Double(subviews[k].sizeThatFits(.init(width: pn.contentWidth, height: nil)).height)
            case .slot:
                input.slotHeight = Double(subviews[k].sizeThatFits(.init(width: width, height: nil)).height)
            case .navBack:
                let b = subviews[k].sizeThatFits(.unspecified)
                input.buttonWidths = (Double(b.width), input.buttonWidths?.next ?? 0)
            case .navNext:
                let b = subviews[k].sizeThatFits(.unspecified)
                input.buttonWidths = (input.buttonWidths?.back ?? 0, Double(b.width))
            default: break
            }
        }
        return compute(input)
    }
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let w = proposal.width.map(Double.init) ?? 480
        let p = resolve(width: w.isFinite ? w : 480, subviews: subviews)
        return CGSize(width: w.isFinite ? w : 480, height: p.host.y + p.host.height)
    }
    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let p = resolve(width: Double(bounds.width), subviews: subviews)
        store.paint = p
        store.didLayout(p, now: now)
        let ox = bounds.minX, oy = bounds.minY
        func place(_ k: Int, _ r: AWCStepperRect) {
            subviews[k].place(at: CGPoint(x: ox + r.x, y: oy + r.y), anchor: .topLeading, proposal: .init(width: r.width, height: r.height))
        }
        for (k, role) in roles.enumerated() {
            switch role {
            case .chrome: place(k, AWCStepperRect(x: 0, y: 0, width: Double(bounds.width), height: p.host.y + p.host.height))
            case .header(let i): place(k, i < p.steps.count ? p.steps[i].inner : .zero)
            case .panel(let i):
                if i < p.steps.count, let pn = p.steps[i].panel, pn.visible {
                    // The panel clips its content (the sizer is overflow: hidden while the grid row animates).
                    place(k, AWCStepperRect(x: pn.contentOrigin.x, y: pn.rect.y, width: pn.contentWidth, height: pn.rect.height))
                } else { place(k, AWCStepperRect(x: 0, y: 0, width: 0, height: 0)) }
            case .slot: place(k, p.content)
            case .navBack: place(k, p.navButtons?.back ?? .zero)
            case .navNext: place(k, p.navButtons?.next ?? .zero)
            }
        }
    }
}

/// One step's panel: [top padding] content [gap-lg + Back / Continue] [bottom padding]. Proposed its natural height it
/// lays out normally; proposed a smaller height (the animating grid row) it keeps the natural positions — the parent
/// clips it.
struct AWCStepPanelBody: Layout {
    let top: Double, bottom: Double, actionsGap: Double
    func natural(_ w: Double?, _ subviews: Subviews) -> Double {
        var h = top + bottom
        for (k, s) in subviews.enumerated() { h += Double(s.sizeThatFits(.init(width: w.map { CGFloat($0) }, height: nil)).height) + (k > 0 ? actionsGap : 0) }
        return h
    }
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let w = proposal.width.map(Double.init)
        return CGSize(width: w ?? 0, height: proposal.height ?? natural(w, subviews))
    }
    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var y = Double(bounds.minY) + top
        for (k, s) in subviews.enumerated() {
            if k > 0 { y += actionsGap }
            let h = s.sizeThatFits(.init(width: bounds.width, height: nil)).height
            s.place(at: CGPoint(x: bounds.minX, y: y), anchor: .topLeading, proposal: .init(width: bounds.width, height: h))
            y += Double(h)
        }
    }
}

// MARK: - View

struct AWCNativeStepper: View {
    let node: AWCNode
    let properties: [String: AWCValue]
    let theme: AWCTheme
    /// A standalone md-step (no stepper): rendered like the source with its data-* defaults.
    var standalone = false
    let setActive: (Int) -> Void
    /// (name, tag, nodeID, detail, cancelable) → false when prevented.
    let dispatch: (String, String, String, AWCValue, Bool) -> Bool
    let renderChild: (AWCNode) -> AnyView
    @Environment(\.awcStepperAppearance) private var appearance
    @Environment(\.awcStepperController) private var controller
    @Environment(\.awcThemeTokens) private var envTokens
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.layoutDirection) private var direction
    @Environment(\.awcNativeDensity) private var inheritedDensity
    @Environment(\.accessibilityReduceMotion) private var systemReduceMotion
    @Environment(\.awcStepperReducedMotion) private var reducedOverride
    @Environment(\.awcStepperSettled) private var settled
    @StateObject private var rt = AWCStepperRuntime()
    @State private var internalDispatcher = AWCEventDispatcher(id: "md-stepper-internal", handler: { _ in })

    var reduced: Bool { reducedOverride ?? systemReduceMotion }
    var stepNodes: [AWCNode] { standalone ? [node] : node.children.filter { $0.tag == "md-step" } }
    var slotNodes: [AWCNode] { standalone ? [] : node.children.filter { $0.slot == "content" } }
    func contentNodes(_ step: AWCNode) -> [AWCNode] {
        step.children.filter { $0.slot == nil && !($0.tag == "#text" && ($0.properties["text"]?.string ?? "").trimmingCharacters(in: .whitespacesAndNewlines).isEmpty) }
    }
    private func str(_ k: String, _ d: String) -> String { let v = properties[k]?.string ?? ""; return v.isEmpty ? d : v }
    private func flag(_ k: String, _ d: Bool = false) -> Bool { properties[k]?.bool ?? d }

    var hostProps: AWCStepperProps {
        var p = AWCStepperProps()
        p.orientation = str("orientation", "horizontal"); p.indicator = str("indicator", "numbered"); p.variant = str("variant", "default")
        p.mode = str("mode", "linear"); p.active = properties["active"]?.number ?? 0
        p.autoComplete = flag("autoComplete", true); p.nav = standalone ? true : flag("nav", true); p.readonly = flag("readonly")
        p.nextDisabled = flag("nextDisabled"); p.loading = flag("loading"); p.lazy = flag("lazy")
        p.label = str("label", "Progress"); p.stepWord = str("stepWord", "Step"); p.ofWord = str("ofWord", "of")
        p.completedWord = str("completedWord", "completed"); p.currentWord = str("currentWord", "current"); p.errorWord = str("errorWord", "error")
        p.optionalWord = str("optionalWord", "Optional"); p.nextLabel = str("nextLabel", "Continue"); p.backLabel = str("backLabel", "Back")
        p.finishLabel = str("finishLabel", "Finish"); p.density = properties["density"]?.number ?? 0
        return p
    }
    func stepProps(_ n: AWCNode) -> AWCStepProps {
        let q = n.properties
        func s(_ k: String, _ d: String = "") -> String { let v = q[k]?.string ?? ""; return v.isEmpty ? d : v }
        var p = AWCStepProps()
        p.label = s("label"); p.description = s("description"); p.errorText = s("errorText"); p.icon = s("icon")
        p.completedIcon = s("completedIcon", "check"); p.errorIcon = s("errorIcon", "priority_high"); p.accessibleName = q["accessibleName"]?.string
        p.completed = q["completed"]?.bool ?? false; p.error = q["error"]?.bool ?? false; p.disabled = q["disabled"]?.bool ?? false
        p.optional = q["optional"]?.bool ?? false; p.editable = q["editable"]?.bool ?? false; p.hideActions = q["hideActions"]?.bool ?? false
        p.density = q["density"]?.number ?? 0
        if standalone { p.active = q["active"]?.bool ?? false }
        p.style = q["style"]?.string ?? ""
        p.hasContent = !standalone && !contentNodes(n).isEmpty
        return p
    }
    var hooks: AWCStepperHooks {
        var v = appearance.css
        for part in (properties["style"]?.string ?? "").split(separator: ";") {
            let kv = part.split(separator: ":", maxSplits: 1).map { $0.trimmingCharacters(in: .whitespaces) }
            if kv.count == 2, kv[0].hasPrefix("--md-step") { v[kv[0]] = kv[1] }
        }
        return AWCStepperHooks(v)
    }

    /// Host properties → the model, once per render (watcher semantics), and the model's outputs → the host.
    private func sync() {
        let m = rt.model, box = rt
        m.emit = { [dispatch, node, stepNodes] name, detail, cancelable in
            let isStep = name == "mdStepClick" || name == "mdStepNext" || name == "mdStepBack"
            let idx = (detail?["index"] as? Int) ?? 0
            let target = isStep && idx < stepNodes.count ? stepNodes[idx] : node
            var d: AWCValue = .null
            if let detail { d = .object(detail.reduce(into: [:]) { $0[$1.key] = ($1.value as? Int).map { .number(Double($0)) } ?? .null }) }
            // A watcher run during a host sync (a host write to `active`) reports after the update, never during body.
            if box.syncing { DispatchQueue.main.async { _ = dispatch(name, isStep ? "md-step" : "md-stepper", target.id, d, false) }; return true }
            return dispatch(name, isStep ? "md-step" : "md-stepper", target.id, d, cancelable)
        }
        m.onWrite = { [setActive] what, _, value in
            if what == "active", let v = value as? Int { DispatchQueue.main.async { setActive(v) } }
        }
        m.labelTotal = standalone ? 0 : nil
        m.standalone = standalone
        box.syncing = true
        m.sync(hostProps, steps: stepNodes.map(stepProps))
        box.syncing = false
    }

    private var tokens: [String: String] { envTokens.isEmpty ? AWCTheme.generated(dark: colorScheme == .dark).tokens : envTokens }

    func input(now: Double) -> AWCStepperLayoutInput {
        var i = AWCStepperLayoutInput(width: 480)
        i.rtl = direction == .rightToLeft; i.dark = colorScheme == .dark
        i.globalDensity = inheritedDensity; i.tokens = tokens; i.hooks = hooks
        #if os(iOS)
        i.viewportWidth = Double(UIScreen.main.bounds.width)
        #else
        i.viewportWidth = 1200
        #endif
        return i
    }

    var animating: Bool { rt.timelineRunning || rt.motion.active(CACurrentMediaTime() * 1000) }

    var body: some View {
        let _ = rt.version
        let _ = sync()
        let m = rt.model
        TimelineView(.animation(minimumInterval: nil, paused: !animating)) { ctx in
            let now = CACurrentMediaTime() * 1000
            let base = input(now: now)
            frame(m, base: base, now: now)
        }
        .environment(\.layoutDirection, .leftToRight)   // the layout mirrors RTL itself
        .accessibilityElement(children: .contain)
        .accessibilityLabel(standalone ? "" : m.p.label)
        .modifier(AWCStepperAnnouncer(live: m.live, errorLive: m.errorLive))
        .awcInspect(nodeID: node.id, name: node.tag) { size in
            ["width": .number(Double(size.width)), "height": .number(Double(size.height)), "active": .number(Double(m.active)),
             "steps": .number(Double(m.count)), "panelMode": .string(m.panelMode), "live": .string(m.live), "errorLive": .string(m.errorLive),
             "completed": .array(m.steps.map { .bool($0.completed) }),
             // The active step's bubble (hooks: active colour, indicator size).
             "activeColor": .string(m.active < rt.paint.steps.count ? awcStepperHex(rt.paint.steps[m.active].bubbleColor) : ""),
             "indicatorSize": .number(m.active < rt.paint.steps.count ? rt.paint.steps[m.active].bubbleSize : 0)]
        }
        .onAppear { bindController() }
        .onDisappear { controller?.actions = nil }
    }

    func bindController() {
        controller?.actions = { [rt] action, index in
            rt.perform {
                switch action {
                case "next": rt.model.next()
                case "prev": rt.model.prev()
                case "goTo": rt.model.goTo(index ?? 0)
                default: rt.model.reset()
                }
            }
        }
    }

    @ViewBuilder func frame(_ m: AWCStepperModel, base: AWCStepperLayoutInput, now: Double) -> some View {
        let steps = stepNodes
        let withPanel = steps.indices.filter { m.renderPanel($0) }
        let showNav = m.p.nav && m.count > 0 && ((m.p.variant != "mobile" && m.p.orientation == "horizontal") || m.p.variant == "mobile")
        AWCStepperFrame(roles: roles(steps.count, withPanel, slot: !slotNodes.isEmpty, nav: showNav && !standalone), compute: { [rt, reduced, settled] inp in
            AWCStepperLayout.layout(rt.model, inp, measure: rt.measure, motion: settled ? nil : rt.motion, now: now, reduced: reduced, pointer: rt.pointer)
        }, base: base, store: rt, now: now) {
            AWCStepperChrome(rt: rt, now: now, reduced: reduced)
            // Source order (reading and keyboard order): header i, its panel, then the next header.
            ForEach(steps.indices, id: \.self) { i in
                header(i, m)
                if withPanel.contains(i) { panel(i, steps[i], m) }
            }
            if !slotNodes.isEmpty { VStack(alignment: .leading, spacing: 0) { ForEach(slotNodes) { renderChild($0) } } }
            if showNav && !standalone {
                navButton("back", label: m.p.backLabel, filled: false, enabled: m.backEnabled, loading: false) { moveFocus { rt.model.footerBack() } }
                navButton("next", label: m.isFinishStep ? m.p.finishLabel : m.p.nextLabel, filled: true, enabled: m.continueEnabled, loading: m.p.loading) {
                    rt.perform { rt.model.next(); rt.model.focus = .nav(1) }
                }
            }
        }
    }

    func roles(_ n: Int, _ panels: [Int], slot: Bool, nav: Bool) -> [AWCStepperFrame.Role] {
        var r: [AWCStepperFrame.Role] = [.chrome]
        for i in 0..<n { r.append(.header(i)); if panels.contains(i) { r.append(.panel(i)) } }
        if slot { r.append(.slot) }
        if nav { r.append(.navBack); r.append(.navNext) }
        return r
    }

    /// A built-in md-button (size sm): its own events stay internal (the source stops their composed mdClick).
    func navButton(_ key: String, label: String, filled: Bool, enabled: Bool, loading: Bool, action: @escaping () -> Void) -> some View {
        let n = AWCNode(id: "\(node.id)-\(key)", tag: "md-button",
                        properties: ["variant": .string(filled ? "filled" : "text"), "size": "sm", "disabled": .bool(!enabled), "loading": .bool(loading),
                                     "density": .number(rt.paint.buttonDensity)],
                        children: [.text(label)])
        return AWCNativeView(node: n) { e in if e.name == "mdClick" && enabled { action() } }
            .environment(\.awcEventDispatcher, internalDispatcher)
            .fixedSize()
            .id("\(n.id)|\(rt.paint.buttonDensity)")   // fresh @State when the layout's density arrives (before the first render)
    }

    /// The header control at the inner box: pointer (hover / press / click), the ripple on the indicator, and the step's
    /// AWC focus element (AWCNativeButtonFocusBridge: a button in the key-view loop, Enter / Space activation, the
    /// composed name, disabled when unreachable, expanded / collapsed when it owns a panel). Readonly: plain text.
    @ViewBuilder func header(_ i: Int, _ m: AWCStepperModel) -> some View {
        let sp = i < rt.paint.steps.count ? rt.paint.steps[i] : AWCStepPaint()
        let live = !m.p.readonly && !(i < m.count && m.effectivelyDisabled(i))
        let indOff = (x: sp.indicator.x - sp.inner.x, y: sp.indicator.y - sp.inner.y)
        let base = Color.clear
            .contentShape(Rectangle())
            .overlay(alignment: .topLeading) {
                if !m.p.readonly {
                    Color.clear.frame(width: sp.indicator.width, height: sp.indicator.height)
                        .awcRipple(disabled: !live, cornerRadius: sp.indicator.width / 2, contentColor: Color(awcStepper: sp.stateColor), controller: rt.ripple(i))
                        .offset(x: indOff.x, y: indOff.y)
                }
            }
            .onContinuousHover { phase in
                switch phase {
                case .active: if rt.pointer.hover != i { rt.perform { rt.pointer.hover = i } }
                case .ended: if rt.pointer.hover == i { rt.perform { rt.pointer.hover = nil } }
                }
            }
            .simultaneousGesture(DragGesture(minimumDistance: 0)
                .onChanged { _ in
                    guard rt.pointer.pressed != i, !m.p.readonly else { return }
                    rt.perform { rt.pointer.pressed = i; rt.model.focusVisible = nil }
                    _ = rt.handle(i).requestPointerFocus?()       // mousedown focuses the header without the ring
                }
                .onEnded { v in
                    let inside = v.location.x >= 0 && v.location.y >= 0 && v.location.x <= sp.inner.width && v.location.y <= sp.inner.height
                    rt.perform { rt.pointer.pressed = nil; if inside { rt.model.activateHeader(i) } }
                })
            .accessibilityHidden(true)
        if m.p.readonly || i >= m.count {
            base.accessibilityElement(children: .ignore)
                .accessibilityLabel(i < m.count ? ([m.steps[i].label] + m.textLines(i)).filter { !$0.isEmpty }.joined(separator: "\n") : "")
                .accessibilityAddTraits(.isStaticText)
        } else {
            base.awcFocusBridgeLayer {
                AWCNativeButtonFocusBridge(configuration: AWCNativeFocusConfiguration(
                    id: stepNodes[i].id, label: m.a11yLabel(i), policy: AWCButtonAccessibilityPolicy(properties: ["disabled": .bool(!live)]),
                    group: nil, cell: nil, handle: rt.handle(i),
                    focusChanged: { on in
                        rt.perform {
                            if on { rt.model.focus = .header(i); rt.model.focusVisible = rt.handle(i).showFocus ? i : nil }
                            else if rt.model.focus == .header(i) { rt.model.focus = nil; if rt.model.focusVisible == i { rt.model.focusVisible = nil } }
                        }
                    },
                    activate: { rt.perform { rt.model.activateHeader(i) } },
                    activateFrom: { source in
                        if source == .keyboard { rt.ripple(i).trigger() }      // md-step: keyboard activation runs a centred wave
                        rt.perform { rt.model.activateHeader(i) }
                    },
                    keyPress: { rt.perform { rt.model.focusVisible = i } },
                    disclosureExpanded: m.hasPanel(i) ? m.isActive(i) : nil)).accessibilityHidden(false)
            }
            .overlay(alignment: .topLeading) { descriptionText(i, sp, m) }
        }
    }

    /// The description under a header as static text (Web: a text run inside the header, not part of its composed name),
    /// at its painted line; drawn by the chrome, so the text itself is transparent.
    @ViewBuilder func descriptionText(_ i: Int, _ sp: AWCStepPaint, _ m: AWCStepperModel) -> some View {
        let s = i < m.count ? m.steps[i] : AWCStepProps()
        if i < m.count, !(s.error && !s.errorText.isEmpty), let line = sp.lines.first(where: { $0.part == "description" }), !line.text.isEmpty {
            Text(line.text).foregroundStyle(.clear).font(awcStepperFont(size: line.fontSize, weight: line.weight))
                .frame(width: line.rect.width, height: line.rect.height, alignment: .topLeading)
                .offset(x: line.rect.x - sp.inner.x, y: line.rect.y - sp.inner.y)
                .allowsHitTesting(false)
        }
    }

    @ViewBuilder func panel(_ i: Int, _ step: AWCNode, _ m: AWCStepperModel) -> some View {
        let e = (s: awcStepperDensity(m.steps[i].density, awcStepperDensity(m.p.density, inheritedDensity)), theme: AWCStepperTheme(tokens: tokens))
        let vertical = m.p.orientation == "vertical"
        let top = vertical ? e.theme.spacing("inset-xs", rung: e.s, 4) : (hooks.merging(style: m.steps[i].style).px("panel-padding-block-start") ?? e.theme.spacing("inset-lg", rung: e.s, 16))
        let actions = vertical && m.navActions(i)
        // visibility: hidden — out of the accessibility tree and the key-view loop.
        let shown = i < rt.paint.steps.count && (rt.paint.steps[i].panel?.visible ?? false)
        AWCStepPanelBody(top: top, bottom: e.theme.spacing("inset-lg", rung: e.s, 16), actionsGap: e.theme.spacing("gap-lg", rung: e.s, 16)) {
            let content = contentNodes(step)
            if !content.isEmpty { VStack(alignment: .leading, spacing: 0) { ForEach(content) { renderChild($0) } }.frame(maxWidth: .infinity, alignment: .leading) }
            if actions {
                HStack(spacing: e.theme.spacing("gap-sm", rung: e.s, 8)) {
                    actionButton(i, back: true, label: m.p.backLabel, enabled: shown && i != 0 && !m.p.loading, density: e.s) { moveFocus { rt.model.stepBack(i) } }
                    actionButton(i, back: false, label: m.isLast(i) ? m.p.finishLabel : m.p.nextLabel, enabled: shown && m.continueEnabled, density: e.s) {
                        moveFocus { rt.model.stepNext(i) }
                    }
                }.frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .clipped()
        // The panel's opacity, md-step-content-enter (a lazy panel's mount) and md-step-enter (the step's mount).
        .opacity(i < rt.paint.steps.count ? (rt.paint.steps[i].panel?.opacity ?? 1) * rt.paint.steps[i].contentOpacity * rt.paint.steps[i].hostOpacity : 1)
        .offset(y: i < rt.paint.steps.count ? rt.paint.steps[i].contentDY : 0)
        .disabled(!shown)
        .accessibilityElement(children: .contain)
        .accessibilityLabel(m.regionLabel(i))
        .accessibilityHidden(!shown)
    }

    /// Runs a navigation that may move focus to the new active header (the panel's buttons collapse with it; Back disables
    /// itself on the first step): the model names the header, the AWC focus element takes it (keyboard focus, with the ring).
    func moveFocus(_ body: () -> Void) {
        let before = rt.model.focus
        rt.perform(body)
        if rt.model.focus != before, case .header(let h)? = rt.model.focus {
            DispatchQueue.main.async { _ = rt.handle(h).requestFocus?() }
        }
    }

    func actionButton(_ i: Int, back: Bool, label: String, enabled: Bool, density: Double, action: @escaping () -> Void) -> some View {
        let n = AWCNode(id: "\(stepNodes[i].id)-\(back ? "back" : "next")", tag: "md-button",
                        properties: ["variant": .string(back ? "text" : "filled"), "size": "sm", "disabled": .bool(!enabled),
                                     "loading": .bool(!back && rt.model.p.loading), "density": .number(density)],
                        children: [.text(label)])
        return AWCNativeView(node: n) { e in if e.name == "mdClick" && enabled { action() } }
            .environment(\.awcEventDispatcher, internalDispatcher)
            .fixedSize()
            .id("\(n.id)|\(enabled)|\(rt.model.p.loading)|\(density)")   // fresh @State when a prop flips before the first render
    }
}

/// The chrome drawn from the last layout: state layers, halos, bubbles / dots (number or glyph), labels, connectors with
/// their fill, the indicator focus ring, the mobile progress (dots or caption).
struct AWCStepperChrome: View {
    @ObservedObject var rt: AWCStepperRuntime
    let now: Double, reduced: Bool
    var body: some View {
        Canvas { ctx, size in
            let p = rt.paint
            for s in p.steps where !s.inner.isEmpty {
                if let c = s.connector, !c.rect.isEmpty {
                  ctx.drawLayer { ctx in
                    ctx.opacity = s.hostOpacity                 // md-step-enter fades the whole step
                    let r = CGRect(x: c.rect.x, y: c.rect.y, width: c.rect.width, height: c.rect.height)
                    let shape = Capsule().path(in: r)
                    ctx.fill(shape, with: .color(Color(awcStepper: c.color)))
                    if c.fill > 0 {
                        // ::after scales from the inline start (left, or right in RTL) / the top.
                        var fr = r
                        if c.vertical { fr.size.height = r.height * c.fill } else {
                            fr.size.width = r.width * c.fill
                            if rt.model.p.orientation == "horizontal", awcStepperRTL(p) { fr.origin.x = r.maxX - fr.width }
                        }
                        ctx.drawLayer { l in l.clip(to: shape); l.fill(Path(fr), with: .color(Color(awcStepper: c.fillColor))) }
                    }
                  }
                }
            }
            for s in p.steps where !s.inner.isEmpty {
                let ind = CGRect(x: s.indicator.x, y: s.indicator.y, width: s.indicator.width, height: s.indicator.height)
              ctx.drawLayer { ctx in
                ctx.opacity = s.hostOpacity
                if let ring = s.focusRing {
                    ctx.fill(Circle().path(in: ind.insetBy(dx: -5, dy: -5)), with: .color(Color(awcStepper: ring.outer)))
                    ctx.fill(Circle().path(in: ind.insetBy(dx: -2, dy: -2)), with: .color(Color(awcStepper: ring.inner)))
                }
                ctx.drawLayer { l in
                    l.opacity = s.indicatorOpacity
                    if s.stateLayerVisible && s.stateOpacity > 0 {
                        var c = s.stateColor; c.a *= s.stateOpacity
                        l.fill(Circle().path(in: ind), with: .color(Color(awcStepper: c)))
                    }
                    let b = CGRect(x: s.bubble.x, y: s.bubble.y, width: s.bubble.width, height: s.bubble.height)
                    if let h = s.halo, h.spread > 0 {
                        l.fill(Circle().path(in: b.insetBy(dx: -h.spread * s.scale, dy: -h.spread * s.scale)), with: .color(Color(awcStepper: h.color)))
                    }
                    l.fill(Circle().path(in: b), with: .color(Color(awcStepper: s.bubbleColor)))
                    if let fg = s.bubbleText {
                        if let n = s.number {
                            let t = l.resolve(Text(n).font(awcStepperFont(size: s.bubbleFontSize * s.scale, weight: 500)).foregroundColor(Color(awcStepper: fg)))
                            l.draw(t, at: CGPoint(x: b.midX, y: b.midY), anchor: .center)
                        } else if let g = s.glyph, s.glyphScale * s.glyphSize * s.scale > 0.05 {
                            // md-step-glyph-in: the span scales about the bubble centre and fades in.
                            l.drawLayer { gl in
                                gl.opacity = s.glyphOpacity
                                let font = awcStepperSymbolFont(size: s.glyphSize * s.scale * s.glyphScale, fill: s.glyphFilled ? 1 : 0, weight: s.glyphFilled ? 600 : 500)
                                let t = gl.resolve(Text(g).font(Font(font)).foregroundColor(Color(awcStepper: fg)))
                                gl.draw(t, at: CGPoint(x: b.midX, y: b.midY), anchor: .center)
                            }
                        }
                    }
                }
                if let tr = s.text {
                    ctx.drawLayer { l in
                        l.opacity = s.textOpacity
                        for line in s.lines {
                            let lead = awcStepperHalfLeading(size: line.fontSize, lineHeight: line.lineHeight)
                            for (k, t) in (line.wrapped.isEmpty ? [line.text] : line.wrapped).enumerated() {
                                let text = Text(t).font(awcStepperFont(size: line.fontSize, weight: line.weight > 500 ? 700 : line.weight, italic: line.italic))
                                    .foregroundColor(Color(awcStepper: line.color))
                                let r = l.resolve(text)
                                let w = Double(r.measure(in: CGSize(width: 10_000, height: 10_000)).width)
                                // Each line centred in a horizontal step's text column, start-aligned in a vertical one.
                                let x = rt.model.p.orientation == "horizontal" ? line.rect.x + (line.rect.width - w) / 2 : line.rect.x
                                l.draw(r, at: CGPoint(x: x, y: line.rect.y + Double(k) * line.lineHeight + lead), anchor: .topLeading)
                            }
                        }
                        _ = tr
                    }
                }
              }
            }
            for d in p.mobileDots {
                let r = CGRect(x: d.rect.x, y: d.rect.y, width: d.rect.width, height: d.rect.height)
                ctx.fill(Circle().path(in: r.insetBy(dx: -r.width * (d.scale - 1) / 2, dy: -r.height * (d.scale - 1) / 2)), with: .color(Color(awcStepper: d.color)))
            }
            if let t = p.mobileText {
                let text = ctx.resolve(Text(t.text).font(awcStepperFont(size: 14, weight: 500)).foregroundColor(Color(awcStepper: t.color)))
                ctx.draw(text, at: CGPoint(x: t.rect.x, y: t.rect.y + awcStepperHalfLeading(size: 14, lineHeight: 20)), anchor: .topLeading)
            }
        }
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }
}

/// Roboto at the face CSS font matching picks for `weight` (400 / 500 / 700), as the layout measures it.
func awcStepperFont(size: Double, weight: Double, italic: Bool = false) -> Font {
    _ = AWCNativeFonts.labelFamily(regular: true)
    let name = weight > 500 ? "Roboto-Bold" : weight > 400 ? "Roboto-Medium" : "Roboto-Regular"
    var f = CTFontCreateWithName(name as CFString, size, nil)
    if italic, let o = CTFontCreateCopyWithSymbolicTraits(f, size, nil, .traitItalic, .traitItalic) { f = o }
    return Font(f)
}

/// `#RRGGBB` of a colour (the inspection reports hook colours like the other renderers).
func awcStepperHex(_ c: AWCStepperRGBA) -> String {
    func h(_ v: Double) -> String { String(format: "%02X", Int((Swift.max(0, Swift.min(1, v)) * 255).rounded())) }
    return "#" + h(c.r) + h(c.g) + h(c.b)
}

/// Half-leading: CSS centres the glyphs (Roboto ascent 1900 + descent 500 per 2048) in the line box.
func awcStepperHalfLeading(size: Double, lineHeight: Double) -> Double { (lineHeight - size * 2400 / 2048) / 2 }

func awcStepperRTL(_ p: AWCStepperPaint) -> Bool {
    // The first step's connector sits right of its bubble in LTR, left of it in RTL.
    guard let s = p.steps.first, let c = s.connector, !c.vertical else { return false }
    return c.rect.x < s.indicator.x
}

/// Posts the live regions' texts: the polite status and the assertive alert (UIAccessibility / NSAccessibility).
struct AWCStepperAnnouncer: ViewModifier {
    let live: String, errorLive: String
    func body(content: Content) -> some View {
        content
            .onChange(of: live) { _, t in post(t, assertive: false) }
            .onChange(of: errorLive) { _, t in post(t, assertive: true) }
    }
    func post(_ text: String, assertive: Bool) {
        guard !text.isEmpty else { return }
        #if os(macOS)
        NSAccessibility.post(element: NSApp as Any, notification: .announcementRequested,
                             userInfo: [.announcement: text, .priority: (assertive ? NSAccessibilityPriorityLevel.high : .medium).rawValue])
        #else
        var s = AttributedString(text)
        s.accessibilitySpeechAnnouncementPriority = assertive ? .high : .default
        AccessibilityNotification.Announcement(s).post()
        #endif
    }
}

// MARK: - Dispatch

extension AWCNativeView {
    /// md-stepper: the dedicated renderer (its md-step children are the steps; `content`-slot children the shared panel).
    @ViewBuilder var nativeStepper: some View {
        AWCNativeStepper(node: node, properties: (AWCComponentCatalog.defaults[node.tag] ?? [:]).merging(node.properties) { _, new in new }, theme: theme,
                         setActive: { set("active", .number(Double($0))) },
                         dispatch: { name, tag, id, detail, cancelable in
                             let ctx = AWCEventDispatcher.dispatch(AWCEvent(name: name, tag: tag, nodeID: id, detail: detail), through: eventDispatcher,
                                                                   cancelable: cancelable, targetListeners: eventTargetListeners)
                             onEvent(ctx.observedEvent)
                             return !ctx.defaultPrevented
                         },
                         renderChild: { child($0) })
    }
    /// A standalone md-step renders like the source with no stepper around it (data-* defaults: first, horizontal, shared).
    @ViewBuilder var nativeStep: some View {
        AWCNativeStepper(node: node, properties: [:], theme: theme, standalone: true, setActive: { _ in },
                         dispatch: { name, tag, id, detail, _ in emit(name, detail); return true },
                         renderChild: { child($0) })
    }
}
