import SwiftUI
import Observation
import QuartzCore

/// `--md-side-sheet-container-shape`: a `border-radius` shorthand (1–4 radii, optional `/` vertical list), applied to
/// detached sheets only (flush sheets are square in both variants).
public typealias AWCSideSheetShape = AWCBottomSheetShape

/// The nine public md-side-sheet hooks (`--md-side-sheet-*`). Colours are #RRGGBB[AA]; `width`/`maxWidth` are lengths
/// whose fractions resolve against the containing block (the viewport for modal sheets, the parent for standard ones).
public struct AWCSideSheetAppearance: Equatable, Sendable {
    public let containerColor: String?, containerShape: AWCSideSheetShape?, headlineColor: String?, contentColor: String?
    public let scrimColor: String?, dividerColor: String?, iconColor: String?
    public let width: AWCSkeletonLength?, maxWidth: AWCSkeletonLength?
    public init(containerColor: String? = nil, containerShape: AWCSideSheetShape? = nil, headlineColor: String? = nil, contentColor: String? = nil,
                scrimColor: String? = nil, dividerColor: String? = nil, iconColor: String? = nil,
                width: AWCSkeletonLength? = nil, maxWidth: AWCSkeletonLength? = nil) {
        self.containerColor = awcModalColor(containerColor); self.containerShape = containerShape.flatMap { $0.valid ? $0 : nil }
        self.headlineColor = awcModalColor(headlineColor); self.contentColor = awcModalColor(contentColor); self.scrimColor = awcModalColor(scrimColor)
        self.dividerColor = awcModalColor(dividerColor); self.iconColor = awcModalColor(iconColor)
        self.width = width.flatMap { $0.valid ? $0 : nil }; self.maxWidth = maxWidth.flatMap { $0.valid ? $0 : nil }
    }
    /// From plain data (Laboratory/IR): hook names in camelCase; the shape as [AWCSideSheetShape], widths as [AWCSkeletonLength].
    public init(values: [String: AWCValue]) {
        func text(_ k: String) -> String? { values[k]?.string.isEmpty == false ? values[k]?.string : nil }
        func shape(_ k: String) -> AWCSideSheetShape? { guard case .object(let v)? = values[k] else { return nil }; return AWCSideSheetShape(values: v) }
        func length(_ k: String) -> AWCSkeletonLength? { guard case .object(let v)? = values[k] else { return nil }; return AWCSkeletonLength(values: v) }
        self.init(containerColor: text("containerColor"), containerShape: shape("containerShape"), headlineColor: text("headlineColor"), contentColor: text("contentColor"),
                  scrimColor: text("scrimColor"), dividerColor: text("dividerColor"), iconColor: text("iconColor"), width: length("width"), maxWidth: length("maxWidth"))
    }
    public func merging(_ o: Self) -> Self {
        .init(containerColor: o.containerColor ?? containerColor, containerShape: o.containerShape ?? containerShape, headlineColor: o.headlineColor ?? headlineColor,
              contentColor: o.contentColor ?? contentColor, scrimColor: o.scrimColor ?? scrimColor, dividerColor: o.dividerColor ?? dividerColor,
              iconColor: o.iconColor ?? iconColor, width: o.width ?? width, maxWidth: o.maxWidth ?? maxWidth)
    }
}

/// The nine md-side-sheet parts (`::part(...)`; the back wrapper has none).
public enum AWCSideSheetPart: String, CaseIterable, Sendable {
    case scrim, container, header, headline, close, dividerTop = "divider-top", dividerBottom = "divider-bottom", content, actions
}

/// Source methods `show()`, `close()` and `whenClosed()` (resolves once the current open cycle has closed and the
/// shell's exit motion has finished).
@MainActor @Observable public final class AWCSideSheetController {
    @ObservationIgnored var showAction: () -> Void = {}
    @ObservationIgnored var closeAction: () -> Void = {}
    @ObservationIgnored var openState: () -> Bool = { false }
    @ObservationIgnored var exiting: () -> Bool = { false }
    public init() {}
    public var isOpen: Bool { openState() }
    public func show() { showAction() }
    public func close() { closeAction() }
    public func whenClosed() async {
        repeat { try? await Task.sleep(nanoseconds: 16_000_000) } while openState() || exiting()
    }
}

private struct AWCSideSheetAppearanceKey: EnvironmentKey { static let defaultValue = AWCSideSheetAppearance() }
private struct AWCSideSheetTargetsKey: EnvironmentKey { static let defaultValue: [String: AWCSideSheetAppearance] = [:] }
private struct AWCSideSheetPartsKey: EnvironmentKey { static let defaultValue: [String: AWCModalPartAppearance] = [:] }
private struct AWCSideSheetControllersKey: EnvironmentKey { static let defaultValue: [String: AWCSideSheetController] = [:] }
extension EnvironmentValues {
    var awcSideSheetAppearance: AWCSideSheetAppearance { get { self[AWCSideSheetAppearanceKey.self] } set { self[AWCSideSheetAppearanceKey.self] = newValue } }
    var awcSideSheetTargets: [String: AWCSideSheetAppearance] { get { self[AWCSideSheetTargetsKey.self] } set { self[AWCSideSheetTargetsKey.self] = newValue } }
    var awcSideSheetParts: [String: AWCModalPartAppearance] { get { self[AWCSideSheetPartsKey.self] } set { self[AWCSideSheetPartsKey.self] = newValue } }
    var awcSideSheetControllers: [String: AWCSideSheetController] { get { self[AWCSideSheetControllersKey.self] } set { self[AWCSideSheetControllersKey.self] = newValue } }
}
private struct AWCSideSheetAppearanceModifier: ViewModifier {
    let value: AWCSideSheetAppearance, id: String?
    @Environment(\.awcSideSheetAppearance) private var inherited
    @Environment(\.awcSideSheetTargets) private var targets
    func body(content: Content) -> some View {
        if let id { var t = targets; t[id] = (t[id] ?? .init()).merging(value); return AnyView(content.environment(\.awcSideSheetTargets, t)) }
        return AnyView(content.environment(\.awcSideSheetAppearance, inherited.merging(value)))
    }
}
private struct AWCSideSheetPartModifier: ViewModifier {
    let value: AWCModalPartAppearance, key: String
    @Environment(\.awcSideSheetParts) private var parts
    func body(content: Content) -> some View { var p = parts; p[key] = (p[key] ?? .init()).merging(value); return content.environment(\.awcSideSheetParts, p) }
}
private struct AWCSideSheetControllerModifier: ViewModifier {
    let controller: AWCSideSheetController, id: String
    @Environment(\.awcSideSheetControllers) private var controllers
    func body(content: Content) -> some View { var c = controllers; c[id] = controller; return content.environment(\.awcSideSheetControllers, c) }
}
public extension View {
    /// Apply md-side-sheet hooks to every side sheet below, or only to `id`.
    func awcSideSheetAppearance(_ value: AWCSideSheetAppearance, for id: String? = nil) -> some View { modifier(AWCSideSheetAppearanceModifier(value: value, id: id)) }
    /// Style one md-side-sheet part (`::part(name)`), for every side sheet below or only `id`.
    func awcSideSheetPartAppearance(_ value: AWCModalPartAppearance, part: AWCSideSheetPart, for id: String? = nil) -> some View {
        modifier(AWCSideSheetPartModifier(value: value, key: id.map { $0 + "|" + part.rawValue } ?? part.rawValue))
    }
    /// Attach a controller to the md-side-sheet `id` rendered below.
    func awcSideSheetController(_ controller: AWCSideSheetController, for id: String) -> some View { modifier(AWCSideSheetControllerModifier(controller: controller, id: id)) }
}

public struct AWCSideSheetSlots {
    public var content: AnyView?, headline: AnyView?, back: AnyView?, close: AnyView?, actions: AnyView?
    public init(content: AnyView? = nil, headline: AnyView? = nil, back: AnyView? = nil, close: AnyView? = nil, actions: AnyView? = nil) {
        self.content = content; self.headline = headline; self.back = back; self.close = close; self.actions = actions
    }
}

struct AWCSideSheetModel: Equatable {
    var variant = "standard", side = "end", headline = "", closeable = true, showBack = false, scrimDismissible = true
    var topDivider = false, bottomDivider = false, detached = false, ariaLabel = "", density: Double? = nil, hidden = false
    init(_ p: [String: AWCValue]) {
        variant = p["variant"]?.string == "modal" ? "modal" : "standard"; side = p["side"]?.string == "start" ? "start" : "end"
        headline = p["headline"]?.string ?? ""; closeable = p["closeable"]?.bool ?? true; showBack = p["showBack"]?.bool ?? false
        scrimDismissible = p["scrimDismissible"]?.bool ?? true; topDivider = p["topDivider"]?.bool ?? false; bottomDivider = p["bottomDivider"]?.bool ?? false
        detached = p["detached"]?.bool ?? false; ariaLabel = p["sheetAriaLabel"]?.string ?? p["aria-label"]?.string ?? ""
        density = p["density"]?.number; hidden = p["hidden"]?.bool ?? false
    }
    var modal: Bool { variant == "modal" }
}

/// Column of a side sheet: rows keep their natural height and the content (`flex: 1; min-block-size: 0`) takes the
/// rest of the container's definite height (it scrolls, and can shrink to nothing on a short sheet).
struct AWCSideSheetColumn: Layout {
    let contentIndex: Int
    private func rows(_ subviews: Subviews, width: CGFloat) -> [CGFloat] {
        subviews.indices.map { i in i == contentIndex ? 0 : subviews[i].sizeThatFits(.init(width: width, height: nil)).height }
    }
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let w = proposal.width ?? 0
        if let h = proposal.height, h.isFinite { return .init(width: w, height: h) }
        let content = subviews.indices.contains(contentIndex) ? subviews[contentIndex].sizeThatFits(.init(width: w, height: nil)).height : 0
        return .init(width: w, height: rows(subviews, width: w).reduce(0, +) + content)
    }
    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var rows = rows(subviews, width: bounds.width)
        if rows.indices.contains(contentIndex) { rows[contentIndex] = max(0, bounds.height - rows.reduce(0, +)) }
        var y = bounds.minY
        for i in subviews.indices {
            subviews[i].place(at: .init(x: bounds.minX, y: y), anchor: .topLeading, proposal: .init(width: bounds.width, height: rows[i])); y += rows[i]
        }
    }
}

/// Standard host box: `inline-size: min(width, 100%)`, `max-inline-size: min(max-width, 100%)`, `block-size: 100%`
/// of the parent's proposal (an indefinite parent resolves percentages as auto).
struct AWCSideSheetHost: Layout {
    let width: AWCSkeletonLength, maxWidth: AWCSkeletonLength
    func used(_ proposal: ProposedViewSize) -> CGFloat {
        if let basis = proposal.width, basis.isFinite {
            return max(0, min(CGFloat(width.points) + CGFloat(width.fraction) * basis, basis, CGFloat(maxWidth.points) + CGFloat(maxWidth.fraction) * basis))
        }
        return max(0, min(CGFloat(width.points), CGFloat(maxWidth.points)))
    }
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let w = used(proposal)
        if let h = proposal.height, h.isFinite { return .init(width: w, height: h) }
        return .init(width: w, height: subviews.first?.sizeThatFits(.init(width: w, height: nil)).height ?? 0)
    }
    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        for s in subviews { s.place(at: bounds.origin, anchor: .topLeading, proposal: .init(width: bounds.width, height: bounds.height)) }
    }
}

/// Per-instance runtime of the modal open cycle on the frame clock.
@Observable final class AWCSideSheetMotion {
    var opacity = AWCCSSTransitionTrack()
    var fraction = AWCCSSTransitionTrack(initial: 1)
    var tick = 0
    func running(_ now: Double) -> Bool { opacity.isRunning(now) || fraction.isRunning(now) }
}

/// md-side-sheet: `standard` is an inline region in the authored layout (no modal resources, no focus move or trap;
/// hidden when closed); `modal` is a fixed overlay in the nearest `AWCModalScope` that slides from its logical side.
/// Events: mdOpen/mdClose on every open change; the fallback close emits mdCancel then mdClose in both variants; modal
/// Escape and scrim emit mdCancel then mdClose only when `scrimDismissible` (a protected Escape is consumed, a
/// protected scrim click blurs); the back control emits mdBack and stays open; `close()` emits mdClose only.
struct AWCNativeSideSheet: View {
    let id: String
    let model: AWCSideSheetModel
    let theme: AWCTheme
    let open: Binding<Bool>
    let slots: AWCSideSheetSlots
    let emit: (String) -> Void
    @Environment(\.self) private var environment
    @Environment(\.awcModalSession) private var session
    @Environment(\.awcSideSheetAppearance) private var inheritedAppearance
    @Environment(\.awcSideSheetTargets) private var targets
    @Environment(\.awcSideSheetParts) private var partValues
    @Environment(\.awcSideSheetControllers) private var controllers
    @Environment(\.awcNativeDensity) private var inheritedDensity
    @Environment(\.accessibilityReduceMotion) private var systemReduced
    @Environment(\.awcModalReducedMotion) private var reducedOverride
    @State private var motion = AWCSideSheetMotion()
    @State private var emitted: Bool?
    @State private var acquired = false
    @State private var owner: AWCModalOwner
    @State private var regions = AWCModalFocusRegions(count: 3)
    @State private var settle = 0

    init(id: String, model: AWCSideSheetModel, theme: AWCTheme, open: Binding<Bool>, slots: AWCSideSheetSlots, emit: @escaping (String) -> Void) {
        self.id = id; self.model = model; self.theme = theme; self.open = open; self.slots = slots; self.emit = emit
        _owner = State(initialValue: AWCModalOwner(id: id))
    }
    private var appearance: AWCSideSheetAppearance { inheritedAppearance.merging(targets[id] ?? .init()) }
    private func part(_ p: AWCSideSheetPart) -> AWCModalPartAppearance { (partValues[p.rawValue] ?? .init()).merging(partValues[id + "|" + p.rawValue] ?? .init()) }
    private var density: Double { AWCNativeDensity.resolve(model.density, inherited: inheritedDensity) }
    private var reduced: Bool { reducedOverride ?? systemReduced }
    private var curve: [Double] { awcCSSCubicBezier(theme.tokens["--md-sys-motion-easing-standard"]) ?? [0.2, 0, 0, 1] }
    private var emphasized: [Double] { awcCSSCubicBezier(theme.tokens["--md-sys-motion-easing-emphasized"]) ?? [0.2, 0, 0, 1] }
    private var duration: Double { reduced ? 0 : awcCSSDuration(theme.tokens["--md-sys-motion-duration-medium2"]) ?? 300 }
    private func color(_ token: String, _ fallback: String) -> Color { Color(awcHex: theme.tokens["--md-sys-color-" + token] ?? fallback) }
    private func hex(_ value: String?) -> Color? { value.map { Color(awcHex: $0) } }
    private var hasHeadline: Bool { !model.headline.isEmpty || slots.headline != nil }
    private var showBack: Bool { model.modal && model.showBack }
    private var accessibleName: String { !model.ariaLabel.isEmpty ? model.ariaLabel : hasHeadline ? model.headline : "Side sheet" }
    private var isOpen: Bool { open.wrappedValue && !model.hidden }
    private var widthHook: AWCSkeletonLength { appearance.width ?? .points(max(280, 360 + 16 * density)) }
    private var maxWidthHook: AWCSkeletonLength { appearance.maxWidth ?? .points(max(320, 400 + 16 * density)) }

    var body: some View {
        Group {
            if model.modal { modalAnchor } else if isOpen { standard } else { Color.clear.frame(width: 0, height: 0) }
        }
        .onAppear { attach(); sync(open.wrappedValue) }
        .onChange(of: open.wrappedValue) { _, value in sync(value) }
        .onChange(of: model.hidden) { _, _ in sync(open.wrappedValue) }
        .onChange(of: model.variant) { _, _ in variantChanged() }
        .onDisappear { if acquired { session?.release(id) }; acquired = false; emitted = nil }
    }

    // MARK: Behaviour
    private func attach() {
        owner.escape = { [self] in
            guard isOpen, model.modal, session?.isTop(id) ?? true else { return false }
            // A protected sheet consumes Escape (preventDefault + stopPropagation) and stays open.
            if model.scrimDismissible { dismiss() }
            return true
        }
        owner.tab = { [regions] backward in regions.move(backward: backward) }
        owner.focusInitial = { [regions, session] in regions.focusFirst(visible: !(session?.lastInputPointer ?? false)) }
        if let controller = controllers[id] {
            controller.showAction = { [self] in if !open.wrappedValue { open.wrappedValue = true; sync(true) } }
            controller.closeAction = { [self] in if open.wrappedValue { open.wrappedValue = false; sync(false) } }
            controller.openState = { [self] in open.wrappedValue }
            controller.exiting = { [motion] in motion.running(CACurrentMediaTime() * 1000) }
        }
    }
    private func acquireIfModal() { if model.modal && !acquired, let session { session.acquire(owner); acquired = true } }
    private func releaseIfAcquired() { if acquired { session?.release(id); acquired = false } }
    private func sync(_ value: Bool) {
        let active = value && !model.hidden
        let now = CACurrentMediaTime() * 1000
        if emitted == nil {
            emitted = active
            if active { begin(open: true, now: now); acquireIfModal(); emit("mdOpen"); scheduleSettle() }
            return
        }
        guard active != emitted else { return }
        emitted = active
        begin(open: active, now: now)
        if active { acquireIfModal(); emit("mdOpen") } else { releaseIfAcquired(); emit("mdClose") }
        scheduleSettle()
    }
    /// Switching presentation while open acquires or releases the modal session without an mdOpen/mdClose cycle.
    private func variantChanged() {
        guard emitted == true else { return }
        if model.modal {
            motion.opacity.snap(1); motion.fraction.snap(0)
            // Acquire once the overlay surface has mounted (the source focuses the first tabbable one frame later).
            Task { @MainActor in try? await Task.sleep(nanoseconds: 34_000_000); if model.modal && isOpen { acquireIfModal() } }
        } else { releaseIfAcquired() }
        motion.tick &+= 1
    }
    private func begin(open: Bool, now: Double) {
        // The standard variant has no shell transition (it is `display: none` when closed).
        let d = model.modal ? duration : 0
        motion.opacity.set(open ? 1 : 0, now: now, duration: d, curve: curve)
        motion.fraction.set(open ? 0 : 1, now: now, duration: d, curve: emphasized)
        motion.tick &+= 1
    }
    private func scheduleSettle() {
        let wait = UInt64(duration + 34) * 1_000_000
        Task { @MainActor in try? await Task.sleep(nanoseconds: wait); settle += 1 }
    }
    private func cancel() {
        emit("mdCancel"); open.wrappedValue = false; sync(false)
    }
    /// Escape and scrim (modal, top owner, `scrimDismissible`).
    private func dismiss() {
        guard isOpen, model.modal, session.map({ $0.isTop(id) }) ?? true else { return }
        cancel()
    }
    /// The fallback close: always an explicit dismissal (both variants; a covered modal ignores it).
    private func closeClicked() {
        guard isOpen, !model.modal || (session.map { $0.isTop(id) } ?? true) else { return }
        cancel()
    }
    private func backClicked() {
        guard isOpen, model.modal, model.showBack, session.map({ $0.isTop(id) }) ?? true else { return }
        emit("mdBack")
    }

    // MARK: Presentation
    private var standard: some View {
        AWCSideSheetHost(width: widthHook, maxWidth: maxWidthHook) {
            GeometryReader { g in
                let inset: CGFloat = model.detached ? 16 : 0
                container(width: max(0, g.size.width - 2 * inset), height: max(0, g.size.height - 2 * inset), modal: false)
                    .offset(x: inset, y: inset)
            }
        }
        .awcInspect(nodeID: id, part: "host", name: "host")
    }
    private var modalAnchor: some View {
        let now = CACurrentMediaTime() * 1000
        let visible = !model.hidden && (open.wrappedValue || motion.running(now) || motion.opacity.presented(now) > 0.0001)
        return Color.clear.frame(width: 0, height: 0)
            .preference(key: AWCModalEntries.self, value: visible ? [entry(now, layer: 0), entry(now, layer: 1)] : [])
            .accessibilityHidden(true)
    }
    private func entry(_ now: Double, layer: Int = 1) -> AWCModalEntry {
        let running = motion.running(now) || settle < 0
        let content = TimelineView(.animation(paused: !running)) { _ in
            GeometryReader { geometry in shell(viewport: geometry.size, time: CACurrentMediaTime() * 1000, layer: layer) }
        }
        .environment(\.awcNativeInert, false)
        .environment(\.self, environment)
        // Source `--md-sys-z-index-dialog-scrim` (1001) surface over its `--md-sys-z-index-popup` (1000) scrim.
        // Two layers, as in the source: the scrim (1000) and the surface (1001) sort independently in the scope, so a later
        // sheet's scrim paints below an earlier sheet's surface (Chrome's stacking).
        return .init(id: layer == 0 ? id + "#scrim" : id, zIndex: layer == 0 ? 1000 : 1001, content: AnyView(content))
    }
    private func resolve(_ l: AWCSkeletonLength, _ basis: CGFloat) -> CGFloat { CGFloat(l.points) + CGFloat(l.fraction) * basis }
    /// Physical placement of the modal surface: inline size `min(width, room)` capped by `min(max-width, room)`, where
    /// room is 100% (flush) or `max(0, 100% − 32)` (detached); logical `side` follows the layout direction.
    private func placement(_ viewport: CGSize) -> (x: CGFloat, y: CGFloat, width: CGFloat, height: CGFloat, right: Bool) {
        let vw = viewport.width, vh = viewport.height, d = density
        let room = model.detached ? max(0, vw - 32) : vw
        let width = max(0, min(resolve(widthHook, vw), room, resolve(maxWidthHook, vw), room))
        let rtl = environment.layoutDirection == .rightToLeft
        let right = (model.side == "end") != rtl
        let inline: CGFloat = model.detached ? 16 : 0
        let block = model.detached ? CGFloat(max(8, 16 + 2 * d)) : 0
        let height = model.detached ? max(0, vh - CGFloat(max(16, 32 + 4 * d))) : vh
        return (right ? vw - inline - width : inline, block, width, height, right)
    }
    @ViewBuilder private func shell(viewport: CGSize, time: Double, layer: Int) -> some View {
        let open = isOpen
        let opacity = reduced ? (open ? 1 : 0) : motion.opacity.presented(time)
        let fraction = reduced ? (open ? 0 : 1) : motion.fraction.presented(time)
        let p = placement(viewport)
        let sign: Double = p.right ? 1 : -1
        ZStack(alignment: .topLeading) {
            if layer == 0 {
            let scrimPart = part(.scrim)
            (hex(scrimPart.background) ?? hex(appearance.scrimColor) ?? Color(.sRGB, red: 0, green: 0, blue: 0, opacity: 0.32))
                .frame(width: viewport.width, height: viewport.height)
                .opacity(opacity)
                .contentShape(Rectangle())
                .onTapGesture {
                    guard session.map({ $0.isTop(id) }) ?? true else { return }
                    // A protected scrim click leaves the sheet open and moves focus to the document (`<body>`).
                    if model.scrimDismissible { dismiss() } else { session?.blur() }
                }
                .allowsHitTesting(open)
                .awcInspect(nodeID: id, part: "scrim", name: "scrim") { _ in ["opacity": .number(opacity), "renderTime": .number(time)] }
            }
            // translateX(±100%) closed: the percentage resolves against the container's own width.
            if layer == 1 {
            container(width: p.width, height: p.height, modal: true)
                .opacity(opacity)
                .awcInspect(nodeID: id, part: "container-motion", name: "container-motion") { size in
                    ["opacity": .number(opacity), "translateX": .number(sign * fraction * Double(size.width)), "renderTime": .number(time)]
                }
                .visualEffect { content, proxy in content.offset(x: CGFloat(sign * fraction) * proxy.size.width) }
                .offset(x: p.x, y: p.y)
                .allowsHitTesting(open)
            }
        }
        .frame(width: viewport.width, height: viewport.height, alignment: .topLeading)
        .environment(\.layoutDirection, .leftToRight)
    }

    private func container(width: CGFloat, height: CGFloat, modal: Bool) -> some View {
        let a = appearance, d = density
        let corners: AWCCornerShape = model.detached ? (a.containerShape?.shorthand ?? .points(Double(theme.tokens["--md-sys-shape-corner-large"].flatMap { Double($0.replacingOccurrences(of: "px", with: "")) } ?? 16))) : .points(0)
        let fill = hex(a.containerColor) ?? (modal ? color("surface-container-low", "#F7F2FA") : color("surface", "#FFFBFE"))
        let containerPart = part(.container)
        let rtl = environment.layoutDirection == .rightToLeft
        let divider = hex(a.dividerColor) ?? color("outline-variant", "#CAC4D0")
        // Standard flush: a 1 pt divider-coloured border on the content-facing edge (inline-start for `end`).
        let border = !modal && !model.detached
        let borderEdge: Edge = model.side == "end" ? .leading : .trailing
        let elevation = modal ? (model.detached ? "--md-sys-elevation-3" : "--md-sys-elevation-1") : (model.detached ? "--md-sys-elevation-1" : nil)
        let hasActions = slots.actions != nil
        let contentIndex = model.topDivider ? 2 : 1
        let shapeView = AWCNativeCornerShape(corners: corners)
        return AWCSideSheetColumn(contentIndex: contentIndex) {
            header(density: d)
            if model.topDivider { dividerRow(.dividerTop) }
            content(density: d)
            if hasActions && model.bottomDivider { dividerRow(.dividerBottom) }
            if hasActions { actions(density: d) }
        }
        .padding(Edge.Set(borderEdge), border ? 1 : 0)
        .frame(width: width, height: height, alignment: .topLeading)
        .clipShape(shapeView)
        .background { shapeView.fill(hex(containerPart.background) ?? fill) }
        .overlay(alignment: borderEdge == .leading ? .leading : .trailing) { if border { Rectangle().fill(divider).frame(width: 1).allowsHitTesting(false) } }
        .background {
            if let elevation { AWCNativeBoxShadow(corners: corners, layers: AWCBoxShadow.source(theme.tokens[elevation] ?? "none") ?? [], placement: .outer) }
        }
        .overlay {
            if let outline = containerPart.outlineColor, let lineWidth = containerPart.outlineWidth { shapeView.strokeBorder(Color(awcHex: outline), lineWidth: lineWidth).allowsHitTesting(false) }
        }
        .background {
            if modal {
                AWCModalContainerFocus(id: id + ".container", label: accessibleName, register: { view in regions.container = view })
                    .accessibilityHidden(true)
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel(accessibleName)
        .modifier(AWCSideSheetModalTrait(modal: modal))
        .awcInspect(nodeID: id, part: "container", name: "container") { size in
            ["role": .string(modal ? "dialog" : "region"), "label": .string(accessibleName), "radius": .number(Double(corners.radii(in: size).first?.width ?? 0))]
        }
        .environment(\.awcNativeDensity, d)
        .environment(\.layoutDirection, rtl ? .rightToLeft : .leftToRight)
    }
    private func iconAppearance(_ d: Double) -> AWCIconButtonAppearance {
        let size = max(32, 40 + 4 * d)
        return .init(iconColor: appearance.iconColor ?? theme.tokens["--md-sys-color-on-surface-variant"] ?? "#49454F", iconSize: max(18, 24 + d), width: size, height: size)
    }
    private func header(density d: Double) -> some View {
        let p = part(.header), hp = part(.headline), cp = part(.close)
        let pad = max(12, 24 + 2 * d), bottom = max(8, 12 + d), gap = max(4, 12 + 2 * d)
        let size = max(16, 22 + d), line = max(22, 28 + d)
        return HStack(alignment: .center, spacing: gap) {
            if showBack {
                Group {
                    if let back = slots.back { back.fixedSize() }
                    else {
                        AWCNativeView(node: AWCNode(id: id + ".back-button", tag: "md-icon-button",
                                                    properties: ["icon": "arrow_back", "variant": "standard", "aria-label": "Back"])) { event in
                            if event.name == "mdClick" { backClicked() }
                        }
                        .fixedSize()
                    }
                }
                .awcIconButtonAppearance(iconAppearance(d))
                .awcInspect(nodeID: id, part: "back", name: "back")
                .padding(.leading, CGFloat(-12 - d))
            }
            Group {
                if hasHeadline {
                    Group { if let slot = slots.headline { slot } else { Text(model.headline) } }
                        .font(AWCNativeFonts.label(size: size, weight: 400))
                        .tracking(hp.letterSpacing ?? 0)
                        .underline(hp.underline ?? false)
                        .lineLimit(1).truncationMode(.tail)
                        .foregroundStyle(hex(hp.color) ?? hex(appearance.headlineColor) ?? color("on-surface-variant", "#49454F"))
                        .modifier(AWCCSSLineBox(size: size, line: line))
                } else { Color.clear.frame(height: 0) }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .background { if let bg = hp.background { Color(awcHex: bg) } }
            .awcInspect(nodeID: id, part: "headline", name: "headline")
            if model.closeable {
                Group {
                    if let close = slots.close { close.fixedSize() }
                    else {
                        AWCNativeView(node: AWCNode(id: id + ".close-button", tag: "md-icon-button",
                                                    properties: ["icon": "close", "variant": "standard", "aria-label": "Close side sheet"])) { event in
                            if event.name == "mdClick" { closeClicked() }
                        }
                        .fixedSize()
                    }
                }
                .awcIconButtonAppearance(iconAppearance(d))
                .background { if let bg = cp.background { Color(awcHex: bg) } }
                .awcInspect(nodeID: id, part: "close", name: "close")
                .padding(.trailing, CGFloat(-12 - d))
            }
        }
        .environment(\.awcPopupTarget, regions.regions[0])
        .padding(.horizontal, pad).padding(.top, pad).padding(.bottom, bottom)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background { if let bg = p.background { Color(awcHex: bg) } }
        .awcInspect(nodeID: id, part: "header", name: "header")
    }
    private func dividerRow(_ which: AWCSideSheetPart) -> some View {
        let p = part(which)
        return Rectangle().fill(hex(p.background) ?? hex(appearance.dividerColor) ?? color("outline-variant", "#CAC4D0"))
            .frame(maxWidth: .infinity).frame(height: p.height ?? 1)
            .awcInspect(nodeID: id, part: which.rawValue, name: which.rawValue)
    }
    private func content(density d: Double) -> some View {
        let p = part(.content)
        let gutter = max(12, 24 + 2 * d), block = max(8, 12 + d)
        let size = max(12, 14 + 0.5 * d), line = max(16, 20 + d)
        let ink = hex(p.color) ?? hex(appearance.contentColor) ?? color("on-surface", "#1C1B1F")
        return ScrollView(.vertical) {
            VStack(alignment: .leading, spacing: 0) { slots.content }
                .frame(maxWidth: .infinity, alignment: .topLeading)
                .padding(EdgeInsets(top: block, leading: gutter, bottom: block, trailing: gutter))
                .font(AWCNativeFonts.label(size: size, weight: 400)).tracking(0.25)
                .lineSpacing(AWCCSSLineBox.spacing(size, line))
                .foregroundStyle(ink)
                .environment(\.awcPopupTarget, regions.regions[1])
        }
        .scrollIndicators(.never)
        .scrollBounceBehavior(.basedOnSize)
        .background { if let bg = p.background { Color(awcHex: bg) } }
        .awcInspect(nodeID: id, part: "content", name: "content") { _ in ["fontSize": .number(size), "lineHeight": .number(line)] }
    }
    private func actions(density d: Double) -> some View {
        let p = part(.actions)
        let gap = max(4, 8 + d), inline = max(12, 24 + 2 * d), block = max(6, 12 + d), minHeight = max(40, 72 + 4 * d)
        return HStack(spacing: gap) { slots.actions; Spacer(minLength: 0) }
            .environment(\.awcPopupTarget, regions.regions[2])
            .padding(.horizontal, inline).padding(.vertical, block)
            .frame(maxWidth: .infinity, minHeight: minHeight, alignment: .leading)
            .background { if let bg = p.background { Color(awcHex: bg) } }
            .awcInspect(nodeID: id, part: "actions", name: "actions")
    }
}

private struct AWCSideSheetModalTrait: ViewModifier {
    let modal: Bool
    func body(content: Content) -> some View { if modal { content.accessibilityAddTraits(.isModal) } else { content } }
}

extension AWCNativeView {
    var nativeSideSheet: some View { AWCModalPresentationFallback(modern: nativeSideSheetRenderer, legacy: sheet) }
    var nativeSideSheetRenderer: some View {
        let slot = { (name: String?) -> AnyView? in
            let items = node.children(inSlot: name)
            return items.isEmpty ? nil : AnyView(ForEach(items) { item in child(item) })
        }
        return AWCNativeSideSheet(id: node.id, model: AWCSideSheetModel(local), theme: theme,
                                  open: Binding(get: { b("open") }, set: { set("open", .bool($0)) }),
                                  slots: AWCSideSheetSlots(content: slot(nil), headline: slot("headline"), back: slot("back"), close: slot("close"), actions: slot("actions")),
                                  emit: { name in emit(name) })
    }
}
