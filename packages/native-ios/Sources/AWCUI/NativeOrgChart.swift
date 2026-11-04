import SwiftUI
import QuartzCore

// md-organization-chart renderer: the source's centred connector tree (vertical/horizontal, RTL) in its scrolling
// viewport, avatar cards, hung togglers, the selection trail, density, the fifteen hooks, state layers, hover elevation,
// ripple, focus ring, the 300 ms emphasized transitions (as explicit tracks, sampled per frame), the unfold motion, the
// roving tree-item focus and the WAI-ARIA tree keyboard model. Geometry comes from AWCOrgChartModel (OrgChartModel.swift).

private struct AWCOrgChartReducedMotionKey: EnvironmentKey { static let defaultValue: Bool? = nil }
private struct AWCOrgChartInspectorKey: EnvironmentKey { static let defaultValue: ((AWCOrgChartProbe) -> Void)? = nil }
private struct AWCOrgChartClockKey: EnvironmentKey { static let defaultValue: AWCOrgChartClock? = nil }
extension EnvironmentValues {
    /// Overrides the system reduced-motion setting for the chart (parity tests, the Laboratory's motion toggle).
    var awcOrgChartReducedMotion: Bool? { get { self[AWCOrgChartReducedMotionKey.self] } set { self[AWCOrgChartReducedMotionKey.self] = newValue } }
    /// Receives the chart's state probe on every render (parity tests).
    var awcOrgChartInspector: ((AWCOrgChartProbe) -> Void)? { get { self[AWCOrgChartInspectorKey.self] } set { self[AWCOrgChartInspectorKey.self] = newValue } }
    /// A frame-stepped animation clock (parity tests); nil uses the display clock.
    var awcOrgChartClock: AWCOrgChartClock? { get { self[AWCOrgChartClockKey.self] } set { self[AWCOrgChartClockKey.self] = newValue } }
}

/// A frame-stepped clock (ms) for deterministic motion tests: `tick` advances one frame, and transitions and unfold motion
/// that changed since the last frame start at the new frame's time, as the display clock does at the first rendered frame.
@MainActor final class AWCOrgChartClock {
    private(set) var now: Double
    private var states: [AWCOrgChartState] = []
    init(now: Double = 0) { self.now = now }
    func register(_ s: AWCOrgChartState) { if !states.contains(where: { $0 === s }) { states.append(s) } }
    func tick(_ ms: Double = 1000.0 / 60) { now += ms; for s in states { if s.startPending(now) { s.kick += 1 } } }
}

/// One CSS transition (`from` → `to`, emphasized easing over the chart's duration). Like a CSS transition, it starts
/// at the first frame that renders the change (`start` is NaN until then).
struct AWCOrgChartTrack {
    typealias Leg = (from: [Double], to: [Double], start: Double, factor: Double, reverseFrom: [Double]?)
    var from: [Double], to: [Double], start: Double
    /// CSS reversing: a transition back to where the running one began (its reversing-adjusted start value) lasts the
    /// share of the duration that one had covered (reversing shortening factor).
    var factor = 1.0
    var reverseFrom: [Double]? = nil
    /// The transition this one replaces: it keeps running until this one starts, which then starts from its value
    /// at that frame (CSS: a transition starts from the current value at the style change).
    var before: Leg? = nil
    /// Frames to wait before starting (a pointer-driven state change renders one frame after the input, see `pointerCommit`).
    var wait = 0
    static func curve(_ from: [Double], _ to: [Double], _ start: Double, _ now: Double, _ duration: Double, _ factor: Double = 1) -> [Double] {
        let d = duration * factor
        guard d > 0, start.isFinite, now - start < d else { return start == -.infinity || d <= 0 || now - start >= d ? to : from }
        let p = AWCOrgChartMotion.emphasized(max(0, (now - start) / d))
        return zip(from, to).map { $0 + ($1 - $0) * p }
    }
    func value(_ now: Double, _ duration: Double) -> [Double] {
        if start.isNaN { return before.map { Self.curve($0.from, $0.to, $0.start, now, duration, $0.factor) } ?? from }
        return Self.curve(from, to, start, now, duration, factor)
    }
    /// Starts this pending transition at `s` from the replaced one's value there (reversing it when it goes back).
    mutating func begin(_ s: Double, _ duration: Double) {
        let current = value(s, duration)
        if let b = before, duration > 0, b.start.isFinite, s - b.start < duration * b.factor, let r = b.reverseFrom, r.count == to.count,
           zip(r, to).allSatisfy({ abs($0 - $1) < 1e-6 }) {
            let p = AWCOrgChartMotion.emphasized(min(1, max(0, (s - b.start) / (duration * b.factor))))
            factor = min(1, max(0, abs(p * b.factor + 1 - b.factor))); reverseFrom = b.to
        } else { factor = 1; reverseFrom = current }
        from = current; before = nil; wait = 0; start = s
    }
}

/// What a card paints for its current state (the source's computed style targets).
struct AWCOrgChartVisual {
    var layer: Double, layerColor: String, border: [Double], borderWidth: Double, shadow: [Double], lifted: Bool
    /// Box-shadow lists are interpolated layer by layer, the shorter one padded with transparent zero shadows (CSS).
    static let shadowLayers = 3
    static func flatten(_ layers: [AWCBoxShadow]) -> [Double] {
        var out: [Double] = []
        for l in layers.prefix(shadowLayers) { let c = AWCOrgChartVisual.rgba(l.color); out += [l.x, l.y, l.blur, l.spread, c[0] * c[3], c[1] * c[3], c[2] * c[3], c[3]] }
        return out + Array(repeating: 0, count: (shadowLayers - min(layers.count, shadowLayers)) * 8)
    }
    static func layers(_ v: [Double]) -> [AWCBoxShadow] {
        stride(from: 0, to: v.count, by: 8).compactMap { i in
            let a = v[i + 7]; guard a > 0.0005 else { return nil }
            func b(_ x: Double) -> Int { Int((min(1, max(0, x / a)) * 255).rounded()) }
            return AWCBoxShadow(x: v[i], y: v[i + 1], blur: max(0, v[i + 2]), spread: v[i + 3], color: String(format: "#%02X%02X%02X%02X", b(v[i + 4]), b(v[i + 5]), b(v[i + 6]), Int((min(1, a) * 255).rounded())))
        }
    }
    static func rgba(_ hex: String) -> [Double] {
        let h = hex.trimmingCharacters(in: CharacterSet(charactersIn: "#")), v = UInt64(h, radix: 16) ?? 0, a = h.count == 8, rgb = a ? v >> 8 : v
        return [Double((rgb >> 16) & 255) / 255, Double((rgb >> 8) & 255) / 255, Double(rgb & 255) / 255, a ? Double(v & 255) / 255 : 1]
    }
}

/// A frame of the chart's state as the parity tests read it (host coordinates).
struct AWCOrgChartSnapshot {
    struct Node { let id: String; let tab: Int; let expanded: Bool?; let selected: Bool?; let onPath: Bool; let border: [Double]; let borderWidth: Double
                  let shadow: [Double]; let focusRing: Bool; let layer: Double; let layerColor: [Double]; let z: Int; let card: CGRect; let toggle: CGRect? }
    /// A group's own enter animation: opacity and the `translate(tx, ty) scale(s)` keyframe value.
    struct Group { let id: String; let opacity: Double; let scale: Double; let tx: Double; let ty: Double; let rect: CGRect }
    let active: String?
    let nodes: [Node]
    let groups: [Group]
    let hostHeight: Double
}
/// The chart's live state for parity tests: `snapshot(now)` evaluates every track at `now` (ms, CACurrentMediaTime).
struct AWCOrgChartProbe { let nodeID: String; let snapshot: (Double) -> AWCOrgChartSnapshot
    /// Keyboard focus on a tree item (the focus-visible ring), as Tab and the arrow keys give it.
    var focus: (String) -> Void = { _ in } }

/// Mutable view state of one chart: folds (rebuilt from `expanded` on every `nodes` assignment), the roving owner,
/// focus, pointer state, the transition tracks and the unfold motion clock.
@MainActor @Observable final class AWCOrgChartState {
    var collapsed: Set<String> = []
    var nodesValue: AWCValue? = nil
    var activeID = ""
    /// The tree item that holds native focus.
    var focused: String? = nil
    /// System pointer (no shared pointer state): hover and press locations in content coordinates.
    var hoverPoint: CGPoint? = nil
    var pressPoint: CGPoint? = nil
    /// Group (parent id) → start of its enter motion (ms, CACurrentMediaTime clock; NaN until its first frame).
    @ObservationIgnored var grow: [String: Double] = [:]
    /// Bumped when a transition or motion starts (re-renders the chart so its frame clock runs).
    var kick = 0
    @ObservationIgnored var tracks: [String: AWCOrgChartTrack] = [:]
    @ObservationIgnored var duration = 300.0
    @ObservationIgnored var lifted: Set<String> = []
    @ObservationIgnored var liftEnded: [String: Double] = [:]
    @ObservationIgnored private var handles: [String: AWCButtonFocusHandle] = [:]
    func handle(_ id: String) -> AWCButtonFocusHandle { if let h = handles[id] { return h }; let h = AWCButtonFocusHandle(); handles[id] = h; return h }
    func sync(nodes: AWCValue?, roots: [AWCOrgChartNode], collapsible: Bool) {
        guard nodes != nodesValue else { return }
        nodesValue = nodes
        collapsed = AWCOrgChartModel.seededCollapsed(roots)
        var ids = Set<String>(); func walk(_ l: [AWCOrgChartNode]) { for n in l { ids.insert(n.id); walk(n.children) } }; walk(roots)
        if activeID.isEmpty || !ids.contains(activeID) { activeID = roots.first?.id ?? "" }
        activeID = Self.visibleOwner(activeID, roots: roots, collapsed: collapsed, collapsible: collapsible)
    }
    /// The visible row for `id`: itself, or the outermost folded ancestor that hides it.
    static func visibleOwner(_ id: String, roots: [AWCOrgChartNode], collapsed: Set<String>, collapsible: Bool) -> String {
        guard collapsible else { return id }
        var chain: [String] = []
        func find(_ l: [AWCOrgChartNode], _ trail: [String]) -> Bool {
            for n in l { if n.id == id { chain = trail; return true }; if find(n.children, trail + [n.id]) { return true } }
            return false
        }
        _ = find(roots, [])
        return chain.first { collapsed.contains($0) } ?? id
    }
    /// Starts a transition from the presented value when a target changes (CSS: the change frame starts it).
    func retarget(_ key: String, _ target: [Double], now: Double, duration: Double, deferred: Bool = false) {
        guard let t = tracks[key] else { tracks[key] = .init(from: target, to: target, start: -.infinity); return }
        guard t.to != target else { return }
        // Without motion a change shows at once, a deferred one (pointer-driven state) a frame later.
        guard duration > 0 || deferred else { tracks[key] = .init(from: target, to: target, start: -.infinity); return }
        let before: AWCOrgChartTrack.Leg? = t.start.isNaN ? t.before : (from: t.from, to: t.to, start: t.start, factor: t.factor, reverseFrom: t.reverseFrom)
        tracks[key] = .init(from: t.value(now, duration), to: target, start: .nan, before: before, wait: deferred ? 1 : 0)
        self.duration = duration
    }
    func value(_ key: String, now: Double, duration: Double) -> [Double]? { tracks[key]?.value(now, duration) }
    /// z-index 4 while hovered, held 100 ms after (`transition: z-index 0s linear short2` delays the drop).
    func lift(_ id: String, _ lifted: Bool, now: Double) {
        if lifted { self.lifted.insert(id); liftEnded[id] = nil }
        else if self.lifted.remove(id) != nil { liftEnded[id] = .nan }
    }
    func z(_ id: String, now: Double, hold: Double) -> Int { lifted.contains(id) || (liftEnded[id].map { $0.isNaN || now - $0 < hold } ?? false) ? 4 : 2 }
    func animating(now: Double, duration: Double, hold: Double) -> Bool {
        grow.values.contains { $0.isNaN || now - $0 < duration } || tracks.values.contains { $0.start.isNaN || now - $0.start < duration }
            || liftEnded.values.contains { $0.isNaN || now - $0 < hold }
    }
    /// The first rendered frame after changes: pending starts take its time. Returns whether anything started.
    @discardableResult func startPending(_ now: Double) -> Bool {
        var any = false
        for (k, t) in tracks where t.start.isNaN {
            if t.wait > 0 { tracks[k]!.wait -= 1; any = true; continue }
            tracks[k]!.begin(now, duration); any = true
        }
        for (k, v) in grow where v.isNaN {
            if let w = growWait[k], w > 0 { growWait[k] = w - 1; any = true; continue }
            grow[k] = now; growWait[k] = nil; any = true
        }
        for (k, v) in liftEnded where v.isNaN { liftEnded[k] = now; any = true }
        return any
    }
    /// The groups shown at the last render and the keyframes they run (orientation; horizontal RTL mirrors them).
    @ObservationIgnored var shownGroups: Set<String>? = nil
    @ObservationIgnored var growWait: [String: Int] = [:]
    /// The source re-renders state changes asynchronously (Stencil): after a click, selection and fold paint one frame
    /// later than the pointer pseudo-classes (:hover/:active), which restyle at once. Set by pointer-driven changes and
    /// consumed by the next render, whose state-driven transitions (border, selection ring, unfold) then wait a frame.
    @ObservationIgnored var pointerCommit = false
    /// When the last pointer-driven change (click, toggler) happened: the renders within that frame commit it (`pointerCommit`).
    /// The selection reaches the chart through its properties, in a later render of the same frame.
    @ObservationIgnored var pointerCommitAt = -Double.infinity
    /// Each card's pointer pseudo-classes (hover, press) at the last render: a layer change without one is state-driven.
    @ObservationIgnored var pseudo: [String: [Bool]] = [:]
    @ObservationIgnored var motionKey = ""
    /// `md-org-chart-grow` runs when a group is inserted, and restarts on every shown group when its keyframes change.
    func detectGroups(_ ids: Set<String>, key: String, reduced: Bool) {
        defer { shownGroups = ids; motionKey = key }
        for id in grow.keys where !ids.contains(id) { grow[id] = nil }
        guard !reduced else { grow.removeAll(); return }
        let restart = shownGroups != nil && key != motionKey
        for id in ids where restart || !(shownGroups?.contains(id) ?? false) { grow[id] = .nan; if pointerCommit { growWait[id] = 1 } }
    }
    static func now() -> Double { CACurrentMediaTime() * 1000 }
}

/// md-organization-chart, rendered from its properties. `renderChild` draws nested source components (md-avatar,
/// md-icon-button, md-tooltip) through the production dispatch; `dispatch` emits the source events.
struct AWCNativeOrgChart: View {
    let nodeID: String
    let properties: [String: AWCValue]
    let theme: AWCTheme
    let density: Double
    let emptySlot: AnyView?
    let renderChild: (AWCNode, ((AWCEvent) -> Void)?) -> AnyView
    let dispatch: (String, AWCValue) -> Void
    let setSelectedIDs: ([String]) -> Void
    @Environment(\.awcOrgChartAppearance) private var appearance
    @Environment(\.layoutDirection) private var direction
    @Environment(\.accessibilityReduceMotion) private var systemReduceMotion
    @Environment(\.awcOrgChartReducedMotion) private var reducedOverride
    @Environment(\.awcOrgChartInspector) private var inspector
    @Environment(\.awcOrgChartClock) private var clock
    @Environment(\.awcNativePointerState) private var pointer
    @Environment(\.awcThemeTokens) private var inheritedTokens
    @State private var state = AWCOrgChartState()
    @State private var width: CGFloat? = nil
    /// The content's origin in the preview coordinate space (pointer-state hover hit-testing).
    @State private var origin: CGPoint = .zero
    var reduceMotion: Bool { reducedOverride ?? systemReduceMotion }
    private func now() -> Double { clock?.now ?? AWCOrgChartState.now() }

    private func s(_ k: String, _ d: String = "") -> String { properties[k]?.string.isEmpty == false ? properties[k]!.string : d }
    private var roots: [AWCOrgChartNode] { AWCOrgChartNode.parse(properties["nodes"]) }
    private var collapsible: Bool { properties["collapsible"]?.bool ?? true }
    private var mode: String { ["none", "single", "multiple"].contains(s("selectionMode")) ? s("selectionMode") : "none" }
    private var selection: [String] { (properties["selectedIds"]?.array ?? []).map(\.string) }
    private var vertical: Bool { s("orientation", "vertical") != "horizontal" }
    private var rtl: Bool { direction == .rightToLeft }
    private var metrics: AWCOrgChartMetrics { .init(density: density, appearance: appearance) }
    private var duration: Double { reduceMotion ? 0 : metrics.duration }
    private var hold: Double { reduceMotion ? 0 : 100 }
    private var tokens: [String: String] { theme.tokens.merging(inheritedTokens) { _, b in b } }
    private func token(_ name: String, _ fallback: String) -> String { tokens["--md-sys-color-" + name] ?? fallback }
    private func color(_ hook: String?, _ role: String, _ fallback: String) -> Color { Color(awcHex: hook ?? token(role, fallback)) }

    var model: AWCOrgChartModel {
        .init(roots: roots, collapsed: state.collapsed, collapsible: collapsible, mode: mode, selection: selection, vertical: vertical, rtl: rtl, metrics: metrics)
    }

    var body: some View {
        let _ = AWCNativeFonts.label(size: 14)
        let roots = self.roots
        let W = Double(width ?? 600)
        let model = self.model
        let layout = model.layout(width: W)
        let now = self.now()
        let _ = { state.pointerCommit = now - state.pointerCommitAt < 8 }()
        let _ = state.detectGroups(Set(layout.groups.keys), key: vertical ? "v" : (rtl ? "h-rtl" : "h"), reduced: reduceMotion)
        let visuals = roots.isEmpty ? [:] : self.visuals(layout, model: model, now: now)
        let _ = inspector?(probe(layout, model: model, visuals: visuals))
        Group {
            if roots.isEmpty { empty }
            else { viewport(layout, model: model, visuals: visuals, width: W) }
        }
        .frame(maxWidth: .infinity, alignment: .topLeading)
        .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { if $0 > 0 && $0 != width { width = $0 } }
        .onAppear { clock?.register(state); state.sync(nodes: properties["nodes"], roots: roots, collapsible: collapsible) }
        .onChange(of: properties["nodes"]) { _, v in
            let focused = state.focused
            state.sync(nodes: v, roots: AWCOrgChartNode.parse(v), collapsible: collapsible)
            refocus(from: focused)
        }
        .onChange(of: collapsible) { _, c in
            let focused = state.focused
            state.activeID = AWCOrgChartState.visibleOwner(state.activeID, roots: roots, collapsed: state.collapsed, collapsible: c)
            refocus(from: focused)
        }
        .orgChartAccessibility(label: s("label", "Organization chart").isEmpty ? "Organization chart" : s("label", "Organization chart"), id: nodeID, outline: !roots.isEmpty)
    }

    /// New data or a `collapsible` change can un-render the focused row: focus moves to the roving owner (CH2), keeping
    /// the focus indicator it had.
    private func refocus(from focused: String?) {
        guard let focused, focused != state.activeID else { return }
        let owner = state.activeID, visible = state.handle(focused).isFocusVisible
        DispatchQueue.main.async { focus(owner, indicator: visible) }
    }

    // MARK: empty state
    @ViewBuilder private var empty: some View {
        // `role=status`: the `empty` slot or the default "No data" (body-medium 14px, on-surface-variant, padding 32/16).
        VStack(spacing: 0) {
            if let emptySlot { AWCOrgChartLineBox { emptySlot } } else {
                Text("No data").frame(height: 16, alignment: .center)
            }
        }
        // Slotted content inherits the empty state's text style (body-medium 14px, on-surface-variant), as CSS does.
        .font(AWCNativeFonts.label(size: 14, regular: true)).foregroundStyle(Color(awcHex: token("on-surface-variant", "#49454F")))
        .frame(maxWidth: .infinity).padding(.vertical, 32).padding(.horizontal, 16)
        .padding(.top, 8).padding(.horizontal, 8).padding(.bottom, metrics.toggle / 2 + 10)
        .accessibilityElement(children: .combine)   // role=status: its text in reading order (as WebKit reads a status)
    }

    // MARK: viewport
    /// `.md-org-chart__viewport { overflow: auto }`: the tree scrolls inline when wider than the host; RTL starts at the
    /// right edge. The content is laid out in physical (left-to-right) coordinates.
    private func viewport(_ layout: AWCOrgChartLayout, model: AWCOrgChartModel, visuals: [String: AWCOrgChartVisual], width W: Double) -> some View {
        let overflow = layout.contentWidth > W + 0.5, dx = rtl ? layout.contentWidth - W : 0
        return ScrollView(.horizontal) {
            chart(layout, model: model, visuals: visuals, width: W)
                .onGeometryChange(for: CGPoint.self) { $0.frame(in: .named("awc-native-preview")).origin } action: { origin = $0 }
                .padding(.leading, dx)
                .frame(width: layout.contentWidth, height: layout.hostHeight, alignment: .topLeading)
        }
        .scrollDisabled(!overflow)
        .scrollBounceBehavior(.basedOnSize)
        .defaultScrollAnchor(rtl ? .trailing : .leading)
        .environment(\.layoutDirection, .leftToRight)
        .frame(height: layout.hostHeight)
    }

    // MARK: chart
    private func chart(_ layout: AWCOrgChartLayout, model: AWCOrgChartModel, visuals: [String: AWCOrgChartVisual], width W: Double) -> some View {
        let animating = clock == nil && state.animating(now: now(), duration: duration, hold: hold)
        return TimelineView(.animation(minimumInterval: 1 / 120, paused: !animating)) { _ in
            let now = self.now()
            let _ = clock == nil ? state.startPending(now) : false
            ZStack(alignment: .topLeading) {
                Canvas { ctx, _ in
                    for box in layout.connectors { draw(box, in: &ctx, layout: layout, now: now) }
                }
                .frame(width: W, height: layout.hostHeight)
                .allowsHitTesting(false)
                // One stacking context per node (the source card is `position: relative; z-index: 2`, 4 while hovered,
                // held 100 ms): its card, then its toggler (`z-index: 3` inside it).
                ForEach(layout.items, id: \.node.id) { item in
                    ZStack(alignment: .topLeading) {
                        card(item, model: model, layout: layout, visual: visuals[item.node.id], now: now)
                        if item.toggle != nil { toggle(item, model: model, layout: layout, now: now) }
                    }
                    .zIndex(Double(state.z(item.node.id, now: now, hold: hold)))
                }
                // The tree items' native focus elements, at the cards' layout boxes (focus, keyboard, accessibility), read in
                // the tree's DOM (pre-)order — `layout.items` order — not geometrically (a parent's later siblings come after
                // its descendants).
                ForEach(Array(layout.items.enumerated()), id: \.element.node.id) { index, item in
                    AWCNativeButtonFocusBridge(configuration: focusConfiguration(item, order: index, model: model, layout: layout))
                        .frame(width: item.card.width, height: item.card.height)
                        .padding(.leading, item.card.minX).padding(.top, item.card.minY)
                        .allowsHitTesting(false)
                        .accessibilitySortPriority(Double(layout.items.count - index))
                }
            }
            .frame(width: W, height: layout.hostHeight, alignment: .topLeading)
            .contentShape(Rectangle())
            .onContinuousHover(coordinateSpace: .local) { phase in
                guard pointer == nil else { return }
                switch phase { case .active(let p): state.hoverPoint = p; case .ended: state.hoverPoint = nil }
            }
            // A press focuses the card's tree item (browsers move focus on mousedown); a release on the same card clicks it.
            // Presses on a toggler belong to its md-icon-button.
            .simultaneousGesture(DragGesture(minimumDistance: 0, coordinateSpace: .local)
                .onChanged { v in
                    guard state.pressPoint == nil else { return }
                    state.pressPoint = v.startLocation
                    if let id = card(at: v.startLocation, layout) { focus(id, indicator: false) }
                }
                .onEnded { v in
                    let start = state.pressPoint; state.pressPoint = nil; state.pointerCommitAt = self.now()
                    if let start, let id = card(at: start, layout), card(at: v.location, layout) == id, let n = layout.items.first(where: { $0.node.id == id })?.node { select(n, model: model) }
                })
        }
        .frame(width: W, height: layout.hostHeight)
    }

    /// The enter motion of every unfolding ancestor group of an element: (opacity, transform) composed outer → inner.
    private func motion(group: String?, layout: AWCOrgChartLayout, now: Double) -> (Double, CGAffineTransform) {
        var opacity = 1.0, t = CGAffineTransform.identity
        var chain: [String] = []
        var g = group
        let parents = Dictionary(uniqueKeysWithValues: layout.items.map { ($0.node.id, $0.parent) })
        while let id = g { chain.append(id); g = parents[id] ?? nil }
        for id in chain.reversed() {
            let (o, m) = ownMotion(id, layout: layout, now: now)
            t = t.concatenating(m); opacity *= o
        }
        return (opacity, t)
    }
    /// One group's own `md-org-chart-grow` keyframe value at `now`: (opacity, scale, tx, ty) — opacity 0 → 1 and
    /// `translateY(-8px) scale(0.96)` → none (horizontal: `translateX(∓8px)`), sharing the emphasized easing.
    private func ownKeyframe(_ id: String, now: Double) -> (Double, Double, Double, Double) {
        guard !reduceMotion, let start = state.grow[id] else { return (1, 1, 0, 0) }
        if start.isNaN { return (0, 0.96, vertical ? 0 : (rtl ? 8 : -8), vertical ? -8 : 0) }
        let raw = (now - start) / max(1, metrics.duration)
        guard raw < 1 else { return (1, 1, 0, 0) }
        let p = AWCOrgChartMotion.emphasized(max(0, raw)), shift = -8 * (1 - p)
        return (p, 0.96 + 0.04 * p, vertical ? 0 : (rtl ? -shift : shift), vertical ? shift : 0)
    }
    /// The keyframe about the group's transform-origin (top centre; horizontal: the start edge's centre).
    private func ownMotion(_ id: String, layout: AWCOrgChartLayout, now: Double) -> (Double, CGAffineTransform) {
        let (o, scale, dx, dy) = ownKeyframe(id, now: now)
        guard let box = layout.groups[id], o < 1 || scale != 1 else { return (o, .identity) }
        let origin: CGPoint = vertical ? CGPoint(x: box.midX, y: box.minY) : CGPoint(x: rtl ? box.maxX : box.minX, y: box.midY)
        // transform-origin, translate, then scale (CSS `translate(...) scale(...)`).
        let m = CGAffineTransform(translationX: -origin.x, y: -origin.y).concatenating(.init(scaleX: scale, y: scale))
            .concatenating(.init(translationX: origin.x + dx, y: origin.y + dy))
        return (o, m)
    }

    // MARK: connectors
    private func draw(_ box: AWCOrgChartBorderBox, in ctx: inout GraphicsContext, layout: AWCOrgChartLayout, now: Double) {
        let (opacity, t) = motion(group: box.owner, layout: layout, now: now)
        guard opacity > 0 else { return }
        var c = ctx; c.opacity = opacity; c.concatenate(t)
        let connector = color(appearance.connectorColor, "outline-variant", "#CAC4D0"), selected = color(appearance.selectedColor, "primary", "#6750A4")
        let r = box.rect
        let inner = CGRect(x: r.minX + box.left, y: r.minY + box.top, width: max(0, r.width - box.left - box.right), height: max(0, r.height - box.top - box.bottom))
        let outerPath = Path(roundedRect: r, cornerRadii: .init(topLeading: box.topLeft, bottomLeading: box.bottomLeft, bottomTrailing: box.bottomRight, topTrailing: box.topRight), style: .circular)
        func ir(_ rad: Double, _ a: Double, _ b: Double) -> Double { max(0, rad - max(a, b)) }
        let innerPath = Path(roundedRect: inner, cornerRadii: .init(topLeading: ir(box.topLeft, box.left, box.top), bottomLeading: ir(box.bottomLeft, box.left, box.bottom),
                                                                       bottomTrailing: ir(box.bottomRight, box.right, box.bottom), topTrailing: ir(box.topRight, box.right, box.top)), style: .circular)
        var ring = outerPath; ring.addPath(innerPath)
        let wedges: [(String, Double, [CGPoint])] = [
            ("top", box.top, [CGPoint(x: r.minX, y: r.minY), CGPoint(x: r.maxX, y: r.minY), CGPoint(x: inner.maxX, y: inner.minY), CGPoint(x: inner.minX, y: inner.minY)]),
            ("right", box.right, [CGPoint(x: r.maxX, y: r.minY), CGPoint(x: r.maxX, y: r.maxY), CGPoint(x: inner.maxX, y: inner.maxY), CGPoint(x: inner.maxX, y: inner.minY)]),
            ("bottom", box.bottom, [CGPoint(x: r.maxX, y: r.maxY), CGPoint(x: r.minX, y: r.maxY), CGPoint(x: inner.minX, y: inner.maxY), CGPoint(x: inner.maxX, y: inner.maxY)]),
            ("left", box.left, [CGPoint(x: r.minX, y: r.maxY), CGPoint(x: r.minX, y: r.minY), CGPoint(x: inner.minX, y: inner.minY), CGPoint(x: inner.minX, y: inner.maxY)]),
        ]
        for (side, width, points) in wedges where width > 0 {
            var w = Path(); w.addLines(points); w.closeSubpath()
            var sc = c; sc.clip(to: w)
            sc.fill(ring, with: .color(box.roles[side] == .selected ? selected : connector), style: FillStyle(eoFill: true))
        }
    }

    // MARK: pointer
    /// The node under a content point: its card or its hung toggler (a descendant of the source card).
    private func hit(_ p: CGPoint?, _ layout: AWCOrgChartLayout) -> String? {
        guard let p else { return nil }
        return layout.items.last { $0.card.contains(p) || ($0.toggle?.contains(p) ?? false) }?.node.id
    }
    /// The card under a content point, unless the point is on a hung toggler.
    private func card(at p: CGPoint, _ layout: AWCOrgChartLayout) -> String? {
        guard !layout.items.contains(where: { $0.toggle?.contains(p) ?? false }) else { return nil }
        return layout.items.last { $0.card.contains(p) }?.node.id
    }
    private func hoverPoint() -> CGPoint? {
        if let pointer { return pointer.location.map { CGPoint(x: $0.x - origin.x, y: $0.y - origin.y) } }
        return state.hoverPoint
    }
    private func pressPoint() -> CGPoint? {
        if let pointer { return pointer.isPointerDown ? pointer.pressLocation.map { CGPoint(x: $0.x - origin.x, y: $0.y - origin.y) } : nil }
        return state.pressPoint
    }

    // MARK: card state (computed style targets) and transitions
    private func selectedHex(_ n: AWCOrgChartNode) -> String { n.accent.flatMap { awcCardColor($0) } ?? appearance.selectedColor ?? token("primary", "#6750A4") }
    private func visuals(_ layout: AWCOrgChartLayout, model: AWCOrgChartModel, now: Double) -> [String: AWCOrgChartVisual] {
        let m = metrics, hovered = hit(hoverPoint(), layout), pressed = hit(pressPoint(), layout)
        let _ = state.kick
        let elevation = AWCBoxShadow.source(tokens["--md-sys-elevation-1"] ?? "0px 1px 2px rgba(0,0,0,0.3), 0px 1px 3px 1px rgba(0,0,0,0.15)") ?? []
        var out: [String: AWCOrgChartVisual] = [:]
        for item in layout.items {
            let n = item.node, selectable = model.isSelectable(n), selected = model.isSelected(n), sel = selectedHex(n)
            let hover = hovered == n.id, press = pressed == n.id && selectable
            // `.selectable:hover` / `:active` (0,3,0) outrank `.selected` (0,2,0) for the layer opacity; the selected layer keeps its colour.
            let layer = selectable ? (press ? 0.12 : (hover || selected) ? 0.08 : 0) : (selected ? 0.08 : 0)
            let border = selected ? sel : (appearance.nodeOutlineColor ?? token("outline-variant", "#CAC4D0"))
            let shadow = selectable && hover ? (selected ? [AWCBoxShadow(spread: 1, color: sel)] : []) + elevation : []
            var v = AWCOrgChartVisual(layer: layer, layerColor: selected ? sel : (appearance.stateLayerColor ?? token("on-surface", "#1C1B1F")),
                                      border: AWCOrgChartVisual.rgba(border), borderWidth: selected ? m.outline + 1 : m.outline,
                                      shadow: AWCOrgChartVisual.flatten(shadow), lifted: hover)
            let previous = state.pseudo.updateValue([hover, press], forKey: n.id), pseudoChanged = previous != nil && previous! != [hover, press]
            state.retarget(n.id + ".layer", [v.layer], now: now, duration: duration, deferred: state.pointerCommit && !pseudoChanged)
            state.retarget(n.id + ".border", v.border, now: now, duration: duration, deferred: state.pointerCommit)
            state.retarget(n.id + ".shadow", v.shadow, now: now, duration: duration, deferred: state.pointerCommit)
            state.lift(n.id, hover, now: now)
            v.layer = state.value(n.id + ".layer", now: now, duration: duration)?.first ?? v.layer
            out[n.id] = v
        }
        return out
    }
    private func presented(_ key: String, _ fallback: [Double], now: Double) -> [Double] { state.value(key, now: now, duration: duration) ?? fallback }

    // MARK: cards
    @ViewBuilder private func card(_ item: AWCOrgChartLayout.Item, model: AWCOrgChartModel, layout: AWCOrgChartLayout, visual: AWCOrgChartVisual?, now: Double) -> some View {
        let n = item.node, m = metrics
        let selectable = model.isSelectable(n)
        let accent = n.accent.flatMap { awcCardColor($0) }
        let v = visual ?? AWCOrgChartVisual(layer: 0, layerColor: "#1C1B1F", border: [0, 0, 0, 1], borderWidth: m.outline, shadow: [], lifted: false)
        let border = presented(n.id + ".border", v.border, now: now), layer = presented(n.id + ".layer", [v.layer], now: now)[0]
        let shadow = AWCOrgChartVisual.layers(presented(n.id + ".shadow", v.shadow, now: now))
        let (opacity, t) = motion(group: item.groupID, layout: layout, now: now)
        let c = item.card, corner = AWCCornerRadius(.init(points: m.radius, fraction: 0))
        ZStack(alignment: .topLeading) {
            if !shadow.isEmpty {
                AWCNativeBoxShadow(corners: .init(topLeft: corner, topRight: corner, bottomRight: corner, bottomLeft: corner), layers: shadow, placement: .outer)
            }
            // Paint order of the source card: background and border, the in-flow text, the positioned state layer and
            // md-ripple, then md-avatar (its host is `position: relative`, later in the DOM) above them.
            RoundedRectangle(cornerRadius: m.radius, style: .circular).fill(color(appearance.nodeColor, "surface-container-low", "#F7F2FA"))
            RoundedRectangle(cornerRadius: m.radius, style: .circular)
                .strokeBorder(Color(.sRGB, red: border[0], green: border[1], blue: border[2], opacity: border[3]), lineWidth: v.borderWidth)
            text(n, size: c.size)
            RoundedRectangle(cornerRadius: m.radius, style: .circular).fill(Color(awcHex: v.layerColor)).padding(v.borderWidth).opacity(layer)
                .modifier(AWCOrgChartRippleIf(enabled: selectable, radius: m.radius, color: selectedHex(n)))
                .allowsHitTesting(selectable)
            avatar(n, accent: accent)
                .padding(.horizontal, m.padInline + m.outline)
                .frame(width: c.width, height: c.height, alignment: rtl ? .trailing : .leading)
            if state.focused == n.id && state.handle(n.id).isFocusVisible {
                // `outline: 3px solid; outline-offset: 2px` follows the border radius.
                RoundedRectangle(cornerRadius: m.radius + 3.5, style: .circular)
                    .stroke(color(appearance.focusRingColor, "secondary", "#625B71"), lineWidth: 3)
                    .frame(width: c.width + 7, height: c.height + 7).offset(x: -3.5, y: -3.5)
            }
        }
        .frame(width: c.width, height: c.height, alignment: .topLeading)
        .contentShape(RoundedRectangle(cornerRadius: m.radius))
        .opacity(opacity)
        .transformEffect(CGAffineTransform(translationX: c.minX, y: c.minY).concatenating(t))
        .accessibilityHidden(true)
    }

    /// The avatar: md-avatar (medium, circle, primary-container), ringed by the node's accent (`box-shadow: 0 0 0 2px`).
    @ViewBuilder private func avatar(_ n: AWCOrgChartNode, accent: String?) -> some View {
        let m = metrics
        renderChild(AWCNode(id: "org-avatar-" + n.id, tag: "md-avatar", properties: [
            "src": n.avatar.map(AWCValue.string) ?? .null, "initials": n.avatarInitials.map(AWCValue.string) ?? .null,
            "name": .string(n.name), "size": "medium", "shape": "circle", "colorFromName": false, "density": .number(density)]), nil)
            .awcAvatarAppearance(.init(containerColor: token("primary-container", "#EADDFF"), labelColor: token("on-primary-container", "#21005D")))
            .frame(width: m.avatar, height: m.avatar)
            .overlay { if let accent { Circle().stroke(Color(awcHex: accent), lineWidth: 2).padding(-1) } }
            .environment(\.layoutDirection, rtl ? .rightToLeft : .leftToRight)
            .accessibilityHidden(true)
    }

    /// The in-flow text column beside the avatar's slot (inline-flex, align-items centre, start-aligned in the card's
    /// direction). `text-overflow: ellipsis` cuts at the line's end edge: a run whose own direction differs from the
    /// card's is cut at its head.
    private func cut(_ s: String) -> Text.TruncationMode { AWCOrgChartText.isRTL(s) == rtl ? .tail : .head }
    @ViewBuilder private func text(_ n: AWCOrgChartNode, size: CGSize) -> some View {
        let m = metrics
        HStack(spacing: m.gap) {
            Color.clear.frame(width: m.avatar, height: m.avatar)
            VStack(alignment: .leading, spacing: 2) {
                Text(n.name).font(.custom("Roboto-Bold", fixedSize: m.nameSize)).foregroundStyle(Color(awcHex: token("on-surface", "#1C1B1F")))
                    .lineLimit(1).truncationMode(cut(n.name)).frame(height: m.nameLine)
                if !n.title.isEmpty {
                    Text(n.title).font(AWCNativeFonts.label(size: m.titleSize, regular: true)).foregroundStyle(Color(awcHex: token("on-surface-variant", "#49454F")))
                        .lineLimit(1).truncationMode(cut(n.title)).frame(height: m.titleLine)
                }
            }
            .frame(minWidth: 0, alignment: .leading)
        }
        .padding(.horizontal, m.padInline + m.outline)
        .padding(.vertical, m.padBlock + m.outline)
        .frame(width: size.width, height: size.height, alignment: .leading)
        .environment(\.layoutDirection, rtl ? .rightToLeft : .leftToRight)
        .allowsHitTesting(false)
    }

    // MARK: toggler
    /// md-tooltip (position bottom, the expand/collapse label) around an md-icon-button (xs, tonal, round, aria-hidden,
    /// out of the tab order).
    @ViewBuilder private func toggle(_ item: AWCOrgChartLayout.Item, model: AWCOrgChartModel, layout: AWCOrgChartLayout, now: Double) -> some View {
        let n = item.node, m = metrics, expanded = model.isExpanded(n), t = item.toggle!
        let (opacity, transform) = motion(group: item.groupID, layout: layout, now: now)
        let button = AWCNode(id: "org-toggle-" + n.id, tag: "md-icon-button", properties: [
            "icon": .string(expanded ? "expand_less" : "expand_more"), "size": "xs", "variant": "tonal", "shape": "round",
            "aria-hidden": "true", "groupTabindex": -1, "density": .number(density)])
        renderChild(AWCNode(id: "org-toggle-tip-" + n.id, tag: "md-tooltip", properties: [
            "text": .string(expanded ? s("collapseLabel", "Collapse") : s("expandLabel", "Expand")), "position": "bottom"], children: [button]), { event in
                if event.name == "mdClick" && event.nodeID == button.id { state.pointerCommitAt = self.now(); toggleFold(n, model: model, focus: true) }
            })
            .awcIconButtonAppearance(.init(containerColor: token("surface-container-high", "#ECE6F0"), iconSize: m.toggle * 0.66, width: m.toggle, height: m.toggle))
            .frame(width: m.toggle, height: m.toggle)
            .opacity(opacity)
            .transformEffect(CGAffineTransform(translationX: t.minX, y: t.minY).concatenating(transform))
            .accessibilityHidden(true)
    }

    // MARK: focus and keyboard (WAI-ARIA tree)
    private func focusConfiguration(_ item: AWCOrgChartLayout.Item, order: Int, model: AWCOrgChartModel, layout: AWCOrgChartLayout) -> AWCNativeFocusConfiguration {
        let n = item.node
        return .init(id: nodeID + "/" + n.id, label: [n.name, n.title].filter { !$0.isEmpty }.joined(separator: " "),
                     policy: AWCButtonAccessibilityPolicy(properties: ["groupTabindex": .number(n.id == state.activeID ? 0 : -1), "roleOverride": .string("treeitem"),
                                                                       "selected": .bool(model.isSelectable(n) && model.isSelected(n))]),
                     group: nil, cell: nil, handle: state.handle(n.id),
                     focusChanged: { focused in
                         if focused { state.focused = n.id; state.activeID = n.id } else if state.focused == n.id { state.focused = nil }
                     },
                     activate: { _ = key("Enter", on: n) },
                     disclosureExpanded: n.hasChildren ? model.isExpanded(n) : nil, treeLevel: item.level, treeOrder: order,
                     routeKeyWithAlt: { k, _ in key(k, on: n) })
    }
    /// Moves the roving tab stop and native focus to `id` (the indicator shows for keyboard focus only).
    func focus(_ id: String, indicator: Bool) {
        state.activeID = id
        let h = state.handle(id)
        if (indicator ? h.requestFocus?() : h.requestPointerFocus?()) != true {
            DispatchQueue.main.async { _ = indicator ? h.requestFocus?() : h.requestPointerFocus?() }
        }
    }
    /// The source `handleKeyDown` on a focused tree item. Modifiers are ignored; Tab and other keys pass through.
    func key(_ k: String, on n: AWCOrgChartNode) -> Bool {
        let model = self.model, layout = model.layout(width: Double(width ?? 600))
        let items = layout.items, idx = items.firstIndex { $0.node.id == n.id }
        guard let idx else { return false }
        let forward = rtl ? "ArrowLeft" : "ArrowRight", backward = rtl ? "ArrowRight" : "ArrowLeft"
        func to(_ i: Int) { if items.indices.contains(i) { focus(items[i].node.id, indicator: true) } }
        switch k {
        case "ArrowDown": to(idx + 1)
        case "ArrowUp": to(idx - 1)
        case forward:
            if n.hasChildren {
                if !model.isExpanded(n) { toggleFold(n, model: model) }
                else if let child = items.first(where: { $0.parent == n.id }) { focus(child.node.id, indicator: true) }
            }
        case backward:
            if collapsible && n.hasChildren && model.isExpanded(n) { toggleFold(n, model: model) }
            else if let parent = items[idx].parent { focus(parent, indicator: true) }
        case "Home": to(0)
        case "End": to(items.count - 1)
        case "Enter", "Space", " ":
            if model.isSelectable(n) { select(n, model: model) } else if n.hasChildren { toggleFold(n, model: model) }
        default: return false
        }
        return true
    }

    // MARK: state changes (source toggle / select)
    func toggleFold(_ n: AWCOrgChartNode, model: AWCOrgChartModel, focus moveFocus: Bool = false) {
        if collapsible && n.hasChildren {
            let willExpand = state.collapsed.contains(n.id)
            if willExpand { state.collapsed.remove(n.id) } else { state.collapsed.insert(n.id) }
            if !willExpand { state.activeID = AWCOrgChartState.visibleOwner(state.activeID, roots: roots, collapsed: state.collapsed, collapsible: collapsible) }
            dispatch("mdNodeToggle", ["node": n.raw, "expanded": .bool(willExpand)])
        }
        // A toggler press focuses the row it belongs to, which becomes the roving owner (CH2).
        if moveFocus { focus(n.id, indicator: false) }
    }
    func select(_ n: AWCOrgChartNode, model: AWCOrgChartModel) {
        guard model.isSelectable(n) else { return }
        var next = selection
        if mode == "single" { let only = next == [n.id]; next = only ? [] : [n.id] }
        else if let i = next.firstIndex(of: n.id) { next.remove(at: i) } else { next.append(n.id) }
        setSelectedIDs(next)
        dispatch("mdSelectionChange", ["node": n.raw, "selectedIds": .array(next.map(AWCValue.string))])
    }
    /// A card click: the tree item takes (pointer) focus and the roving tab stop; a selectable node toggles its selection.
    func activate(_ n: AWCOrgChartNode, model: AWCOrgChartModel) {
        focus(n.id, indicator: false)
        select(n, model: model)
    }

    // MARK: parity probe
    private func probe(_ layout: AWCOrgChartLayout, model: AWCOrgChartModel, visuals: [String: AWCOrgChartVisual]) -> AWCOrgChartProbe {
        let state = self.state, duration = self.duration, hold = self.hold, active = state.activeID
        let focusItem: (String) -> Void = { id in focus(id, indicator: true) }
        return AWCOrgChartProbe(nodeID: nodeID, snapshot: { now in
            let nodes = layout.items.map { item -> AWCOrgChartSnapshot.Node in
                let n = item.node, v = visuals[n.id]
                return .init(id: n.id, tab: n.id == active ? 0 : -1, expanded: n.hasChildren ? model.isExpanded(n) : nil,
                             selected: model.isSelectable(n) ? model.isSelected(n) : nil, onPath: item.onPath,
                             border: state.value(n.id + ".border", now: now, duration: duration) ?? v?.border ?? [],
                             borderWidth: v?.borderWidth ?? 0,
                             shadow: state.value(n.id + ".shadow", now: now, duration: duration) ?? v?.shadow ?? [],
                             focusRing: state.focused == n.id && state.handle(n.id).isFocusVisible,
                             layer: state.value(n.id + ".layer", now: now, duration: duration)?.first ?? v?.layer ?? 0,
                             layerColor: AWCOrgChartVisual.rgba(v?.layerColor ?? "#000000"),
                             z: state.z(n.id, now: now, hold: hold), card: item.card, toggle: item.toggle)
            }
            let groups = layout.groups.keys.sorted().map { id -> AWCOrgChartSnapshot.Group in
                let (o, s, tx, ty) = ownKeyframe(id, now: now)
                return .init(id: id, opacity: o, scale: s, tx: tx, ty: ty, rect: layout.groups[id]!)
            }
            return .init(active: state.focused, nodes: nodes, groups: groups, hostHeight: layout.hostHeight)
        }, focus: focusItem)
    }
}

enum AWCOrgChartMotion {
    /// cubic-bezier(0.2, 0, 0, 1) (md-sys-motion-easing-emphasized) at progress x.
    static func emphasized(_ x: Double) -> Double { AWCNativeButtonTiming.cubic(min(1, max(0, x)), x1: 0.2, y1: 0, x2: 0, y2: 1) }
}

/// Selectable cards carry an md-ripple in the selected colour.
private struct AWCOrgChartRippleIf: ViewModifier {
    let enabled: Bool, radius: Double, color: String
    func body(content: Content) -> some View {
        if enabled { content.awcRipple(cornerRadius: radius, appearance: AWCRippleAppearance(color: color)) } else { content }
    }
}

extension AWCNativeView {
    /// Production dispatch of md-organization-chart (AWCNativeView): the dedicated renderer above.
    @ViewBuilder var nativeOrgChart: some View {
        let empties = node.children(inSlot: "empty")
        AWCNativeOrgChart(nodeID: node.id, properties: local, theme: theme,
                          density: AWCNativeDensity.resolve(local["density"]?.number, inherited: inheritedDensity),
                          emptySlot: empties.isEmpty ? nil : AnyView(VStack(spacing: 0) { ForEach(empties) { child($0) } }),
                          renderChild: { n, handler in child(n, handler: handler) },
                          dispatch: { name, detail in emit(name, detail) },
                          setSelectedIDs: { ids in set("selectedIds", .array(ids.map(AWCValue.string))) })
    }
}

private extension View {
    /// Web role="tree" named by `label` (`aria-label`). macOS: an AppKit outline element owns the tree items (outline rows, see
    /// the focus bridge's treeitem role); iOS has no tree container trait, so the items stay a contained, labelled group.
    /// The empty chart has no tree (Web renders only the status), so no label either.
    @ViewBuilder func orgChartAccessibility(label: String, id: String, outline: Bool) -> some View {
        #if canImport(AppKit)
        if outline { self.accessibilityHidden(true).background { AWCNativeContainerAccessibilityBridge(role: NSAccessibility.Role.outline.rawValue, label: label, identifier: id, level: 0, members: .all) } }
        else { self.accessibilityElement(children: .contain) }
        #else
        if outline { self.accessibilityElement(children: .contain).accessibilityLabel(label) } else { self.accessibilityElement(children: .contain) }
        #endif
    }
}


/// CSS `line-height: normal` of the empty state's 14px Roboto: Chrome rounds the ascent and descent separately (13 + 3), so a
/// line of slotted text is 16px where the platform line is 16.41 (and snaps up to its pixel grid). Content that is not lines
/// of that text keeps its own height.
private struct AWCOrgChartLineBox: Layout {
    private let css: CGFloat = 16, line: CGFloat = 14 * 2400 / 2048
    private func height(_ natural: CGFloat) -> CGFloat {
        let n = (natural / line).rounded()
        return n >= 1 && abs(natural - n * line) < 1 ? n * css : natural
    }
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        guard let v = subviews.first else { return .zero }
        let s = v.sizeThatFits(proposal); return CGSize(width: s.width, height: height(s.height))
    }
    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        guard let v = subviews.first else { return }
        let s = v.sizeThatFits(.init(width: bounds.width, height: nil))
        v.place(at: CGPoint(x: bounds.midX, y: bounds.midY), anchor: .center, proposal: .init(width: bounds.width, height: s.height))
    }
}
