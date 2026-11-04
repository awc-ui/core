import SwiftUI
import Observation
import QuartzCore

/// `--md-bottom-sheet-container-shape`: the same CSS value is a per-corner radius (`horizontal [vertical]`) on the
/// standard variant's two top corners and a `border-radius` shorthand (1–4 radii, optional `/` vertical list) on the
/// detached variant.
public struct AWCBottomSheetShape: Equatable, Sendable {
    public let radii: [Double], vertical: [Double]?
    public init(_ radii: [Double], vertical: [Double]? = nil) {
        self.radii = Array(radii.prefix(4)); self.vertical = vertical.map { Array($0.prefix(4)) }
    }
    var valid: Bool { !radii.isEmpty && (radii + (vertical ?? [])).allSatisfy { $0.isFinite && $0 >= 0 } && vertical.map { !$0.isEmpty } ?? true }
    /// From plain data (Laboratory/IR): `{ radii: [px], vertical?: [px] }`, one to four non-negative lengths each.
    public init?(values: [String: AWCValue]) {
        guard Set(values.keys).isSubset(of: ["radii", "vertical"]), case .array(let r)? = values["radii"] else { return nil }
        func list(_ a: [AWCValue]) -> [Double]? { let d = a.compactMap(\.number); return d.count == a.count && (1...4).contains(d.count) ? d : nil }
        guard let radii = list(r) else { return nil }
        var vertical: [Double]?
        if let v = values["vertical"] { guard case .array(let a) = v, let l = list(a) else { return nil }; vertical = l }
        self.init(radii, vertical: vertical)
        guard valid else { return nil }
    }
    private static func four(_ v: [Double]) -> [Double] {
        switch v.count { case 1: return [v[0], v[0], v[0], v[0]]; case 2: return [v[0], v[1], v[0], v[1]]; case 3: return [v[0], v[1], v[2], v[1]]; default: return v }
    }
    /// Detached: the `border-radius` shorthand.
    var shorthand: AWCCornerShape {
        let h = Self.four(radii), v = Self.four(vertical ?? radii)
        func r(_ i: Int) -> AWCCornerRadius { .init(x: .points(h[i]), y: .points(v[i])) }
        return .init(topLeft: r(0), topRight: r(1), bottomRight: r(2), bottomLeft: r(3))
    }
    /// Standard: `border-start-start-radius` / `border-start-end-radius` (one or two lengths; anything else is invalid → 0).
    var corner: AWCCornerRadius {
        guard vertical == nil, radii.count <= 2 else { return .init() }
        return .init(x: .points(radii[0]), y: .points(radii.count > 1 ? radii[1] : radii[0]))
    }
}

/// The sixteen public md-bottom-sheet hooks (`--md-bottom-sheet-*`). Colours are #RRGGBB[AA]; sizes are lengths whose
/// fractions resolve against the viewport (the fixed container's containing block).
public struct AWCBottomSheetAppearance: Equatable, Sendable {
    public let containerColor: String?, containerShape: AWCBottomSheetShape?, contentColor: String?, headlineColor: String?
    public let scrimColor: String?, dragHandleColor: String?, dividerColor: String?, iconColor: String?
    public let width: AWCSkeletonLength?, minWidth: AWCSkeletonLength?, maxWidth: AWCSkeletonLength?
    public let height: AWCSkeletonLength?, minHeight: AWCSkeletonLength?, maxHeight: AWCSkeletonLength?
    public let detachedMargin: Double?, contentPaddingInline: Double?
    public init(containerColor: String? = nil, containerShape: AWCBottomSheetShape? = nil, contentColor: String? = nil, headlineColor: String? = nil,
                scrimColor: String? = nil, dragHandleColor: String? = nil, dividerColor: String? = nil, iconColor: String? = nil,
                width: AWCSkeletonLength? = nil, minWidth: AWCSkeletonLength? = nil, maxWidth: AWCSkeletonLength? = nil,
                height: AWCSkeletonLength? = nil, minHeight: AWCSkeletonLength? = nil, maxHeight: AWCSkeletonLength? = nil,
                detachedMargin: Double? = nil, contentPaddingInline: Double? = nil) {
        self.containerColor = awcModalColor(containerColor); self.containerShape = containerShape.flatMap { $0.valid ? $0 : nil }
        self.contentColor = awcModalColor(contentColor); self.headlineColor = awcModalColor(headlineColor); self.scrimColor = awcModalColor(scrimColor)
        self.dragHandleColor = awcModalColor(dragHandleColor); self.dividerColor = awcModalColor(dividerColor); self.iconColor = awcModalColor(iconColor)
        func l(_ v: AWCSkeletonLength?) -> AWCSkeletonLength? { v.flatMap { $0.valid ? $0 : nil } }
        self.width = l(width); self.minWidth = l(minWidth); self.maxWidth = l(maxWidth); self.height = l(height); self.minHeight = l(minHeight); self.maxHeight = l(maxHeight)
        self.detachedMargin = detachedMargin.flatMap { $0.isFinite ? $0 : nil }; self.contentPaddingInline = contentPaddingInline.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil }
    }
    /// From plain data (Laboratory/IR): hook names in camelCase; shapes as [AWCBottomSheetShape], sizes as [AWCSkeletonLength].
    public init(values: [String: AWCValue]) {
        func text(_ k: String) -> String? { values[k]?.string.isEmpty == false ? values[k]?.string : nil }
        func shape(_ k: String) -> AWCBottomSheetShape? { guard case .object(let v)? = values[k] else { return nil }; return AWCBottomSheetShape(values: v) }
        func length(_ k: String) -> AWCSkeletonLength? { guard case .object(let v)? = values[k] else { return nil }; return AWCSkeletonLength(values: v) }
        self.init(containerColor: text("containerColor"), containerShape: shape("containerShape"), contentColor: text("contentColor"), headlineColor: text("headlineColor"),
                  scrimColor: text("scrimColor"), dragHandleColor: text("dragHandleColor"), dividerColor: text("dividerColor"), iconColor: text("iconColor"),
                  width: length("width"), minWidth: length("minWidth"), maxWidth: length("maxWidth"), height: length("height"), minHeight: length("minHeight"),
                  maxHeight: length("maxHeight"), detachedMargin: values["detachedMargin"]?.number, contentPaddingInline: values["contentPaddingInline"]?.number)
    }
    public func merging(_ o: Self) -> Self {
        .init(containerColor: o.containerColor ?? containerColor, containerShape: o.containerShape ?? containerShape, contentColor: o.contentColor ?? contentColor,
              headlineColor: o.headlineColor ?? headlineColor, scrimColor: o.scrimColor ?? scrimColor, dragHandleColor: o.dragHandleColor ?? dragHandleColor,
              dividerColor: o.dividerColor ?? dividerColor, iconColor: o.iconColor ?? iconColor, width: o.width ?? width, minWidth: o.minWidth ?? minWidth,
              maxWidth: o.maxWidth ?? maxWidth, height: o.height ?? height, minHeight: o.minHeight ?? minHeight, maxHeight: o.maxHeight ?? maxHeight,
              detachedMargin: o.detachedMargin ?? detachedMargin, contentPaddingInline: o.contentPaddingInline ?? contentPaddingInline)
    }
}

/// The eleven md-bottom-sheet parts (`::part(...)`).
public enum AWCBottomSheetPart: String, CaseIterable, Sendable {
    case scrim, container, dragHandle = "drag-handle", dragHandleIndicator = "drag-handle-indicator", header, headline, close
    case dividerTop = "divider-top", dividerBottom = "divider-bottom", content, actions
}

/// Source methods `show()` and `close()` (state changes immediately; the source has no `whenClosed()`).
@MainActor @Observable public final class AWCBottomSheetController {
    @ObservationIgnored var showAction: () -> Void = {}
    @ObservationIgnored var closeAction: () -> Void = {}
    @ObservationIgnored var openState: () -> Bool = { false }
    public init() {}
    public var isOpen: Bool { openState() }
    public func show() { showAction() }
    public func close() { closeAction() }
}

private struct AWCBottomSheetAppearanceKey: EnvironmentKey { static let defaultValue = AWCBottomSheetAppearance() }
private struct AWCBottomSheetTargetsKey: EnvironmentKey { static let defaultValue: [String: AWCBottomSheetAppearance] = [:] }
private struct AWCBottomSheetPartsKey: EnvironmentKey { static let defaultValue: [String: AWCModalPartAppearance] = [:] }
private struct AWCBottomSheetControllersKey: EnvironmentKey { static let defaultValue: [String: AWCBottomSheetController] = [:] }
extension EnvironmentValues {
    var awcBottomSheetAppearance: AWCBottomSheetAppearance { get { self[AWCBottomSheetAppearanceKey.self] } set { self[AWCBottomSheetAppearanceKey.self] = newValue } }
    var awcBottomSheetTargets: [String: AWCBottomSheetAppearance] { get { self[AWCBottomSheetTargetsKey.self] } set { self[AWCBottomSheetTargetsKey.self] = newValue } }
    var awcBottomSheetParts: [String: AWCModalPartAppearance] { get { self[AWCBottomSheetPartsKey.self] } set { self[AWCBottomSheetPartsKey.self] = newValue } }
    var awcBottomSheetControllers: [String: AWCBottomSheetController] { get { self[AWCBottomSheetControllersKey.self] } set { self[AWCBottomSheetControllersKey.self] = newValue } }
}
private struct AWCBottomSheetAppearanceModifier: ViewModifier {
    let value: AWCBottomSheetAppearance, id: String?
    @Environment(\.awcBottomSheetAppearance) private var inherited
    @Environment(\.awcBottomSheetTargets) private var targets
    func body(content: Content) -> some View {
        if let id { var t = targets; t[id] = (t[id] ?? .init()).merging(value); return AnyView(content.environment(\.awcBottomSheetTargets, t)) }
        return AnyView(content.environment(\.awcBottomSheetAppearance, inherited.merging(value)))
    }
}
private struct AWCBottomSheetPartModifier: ViewModifier {
    let value: AWCModalPartAppearance, key: String
    @Environment(\.awcBottomSheetParts) private var parts
    func body(content: Content) -> some View { var p = parts; p[key] = (p[key] ?? .init()).merging(value); return content.environment(\.awcBottomSheetParts, p) }
}
private struct AWCBottomSheetControllerModifier: ViewModifier {
    let controller: AWCBottomSheetController, id: String
    @Environment(\.awcBottomSheetControllers) private var controllers
    func body(content: Content) -> some View { var c = controllers; c[id] = controller; return content.environment(\.awcBottomSheetControllers, c) }
}
public extension View {
    /// Apply md-bottom-sheet hooks to every sheet below, or only to `id`.
    func awcBottomSheetAppearance(_ value: AWCBottomSheetAppearance, for id: String? = nil) -> some View { modifier(AWCBottomSheetAppearanceModifier(value: value, id: id)) }
    /// Style one md-bottom-sheet part (`::part(name)`), for every sheet below or only `id`.
    func awcBottomSheetPartAppearance(_ value: AWCModalPartAppearance, part: AWCBottomSheetPart, for id: String? = nil) -> some View {
        modifier(AWCBottomSheetPartModifier(value: value, key: id.map { $0 + "|" + part.rawValue } ?? part.rawValue))
    }
    /// Attach a controller to the md-bottom-sheet `id` rendered below.
    func awcBottomSheetController(_ controller: AWCBottomSheetController, for id: String) -> some View { modifier(AWCBottomSheetControllerModifier(controller: controller, id: id)) }
}

public struct AWCBottomSheetSlots {
    public var content: AnyView?, headline: AnyView?, close: AnyView?, actions: AnyView?
    public init(content: AnyView? = nil, headline: AnyView? = nil, close: AnyView? = nil, actions: AnyView? = nil) {
        self.content = content; self.headline = headline; self.close = close; self.actions = actions
    }
}

struct AWCBottomSheetModel: Equatable {
    var variant = "standard", headline = "", showDragHandle = true, closeable = false, scrimDismissible = true
    var topDivider = false, bottomDivider = false, ariaLabel = "", scrollShadow = true, headlineAlign = "start", contentAlign = "start"
    var density: Double? = nil, hidden = false
    init(_ p: [String: AWCValue]) {
        variant = p["variant"]?.string == "detached" ? "detached" : "standard"; headline = p["headline"]?.string ?? ""
        showDragHandle = p["showDragHandle"]?.bool ?? true; closeable = p["closeable"]?.bool ?? false; scrimDismissible = p["scrimDismissible"]?.bool ?? true
        topDivider = p["topDivider"]?.bool ?? false; bottomDivider = p["bottomDivider"]?.bool ?? false
        ariaLabel = p["sheetAriaLabel"]?.string ?? p["aria-label"]?.string ?? ""; scrollShadow = p["scrollShadow"]?.bool ?? true
        headlineAlign = ["center", "end"].contains(p["headlineAlign"]?.string ?? "") ? p["headlineAlign"]!.string : "start"
        contentAlign = ["center", "end"].contains(p["contentAlign"]?.string ?? "") ? p["contentAlign"]!.string : "start"
        density = p["density"]?.number; hidden = p["hidden"]?.bool ?? false
    }
}

/// Spacing tokens of the md3.css density rungs: each comes from the nearest rung that defines it (the element's own
/// `[density]`, else the inherited `[data-density]`), else the default.
enum AWCSheetSpacing {
    static let rungs: [Double: [String: Double]] = [
        -2: ["inset-lg": 12, "inset-xl": 20],
        -3: ["inset-sm": 4, "inset-lg": 12, "inset-xl": 16, "gap-sm": 4],
        -4: ["inset-sm": 4, "inset-lg": 8, "inset-xl": 16, "gap-sm": 4],
    ]
    static let defaults: [String: Double] = ["inset-sm": 8, "inset-lg": 16, "inset-xl": 24, "gap-sm": 8]
    static func token(_ name: String, local: Double?, inherited: Double) -> Double {
        if let local, let v = rungs[local]?[name] { return v }
        if let v = rungs[inherited]?[name] { return v }
        return defaults[name] ?? 0
    }
}

/// Column of a bottom sheet: rows keep their natural height; the content (`flex: 1 1 auto; min-block-size: 0`) takes
/// the free space of the clamped container height or shrinks to its padding; the bottom divider sits after the
/// content (its `margin-top: auto` never receives space because the content grows).
struct AWCSheetColumn: Layout {
    let width: CGFloat, height: CGFloat?, minHeight: CGFloat, maxHeight: CGFloat, top: CGFloat, bottom: CGFloat
    let contentIndex: Int, contentMin: CGFloat, contentNatural: CGFloat
    private func rows(_ subviews: Subviews) -> (rows: [CGFloat], total: CGFloat) {
        var rows = subviews.indices.map { i -> CGFloat in i == contentIndex ? 0 : subviews[i].sizeThatFits(.init(width: width, height: nil)).height }
        let others = rows.reduce(0, +) + top + bottom
        let natural = others + max(contentMin, contentNatural)
        let total = max(minHeight, min(height ?? natural, maxHeight))
        if rows.indices.contains(contentIndex) { rows[contentIndex] = max(contentMin, total - others) }
        return (rows, total)
    }
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize { .init(width: width, height: rows(subviews).total) }
    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var y = bounds.minY + top
        for (i, row) in rows(subviews).rows.enumerated() {
            subviews[i].place(at: .init(x: bounds.minX, y: y), anchor: .topLeading, proposal: .init(width: width, height: row)); y += row
        }
    }
}

/// The sheet content column (`display: flex; flex-direction: column`): its slotted blocks are flex items (`flex: 0 1 auto`,
/// `min-height: auto`). When their ideal heights exceed the available height, the negative free space is distributed by flex
/// basis (flex-shrink 1 × ideal) and each item is clamped at its minimum (its height for a zero proposal), freezing clamped items
/// and redistributing, as CSS does. `sink.ideal` keeps the unshrunk sum for the sheet's natural height (gate-7 R4-01).
final class AWCSheetFlexSink { var ideal: CGFloat = 0 }
struct AWCSheetFlexColumn: Layout {
    let available: CGFloat, alignment: HorizontalAlignment, sink: AWCSheetFlexSink
    private func heights(_ width: CGFloat?, _ subviews: Subviews) -> [CGFloat] {
        let ideal = subviews.map { $0.sizeThatFits(.init(width: width, height: nil)).height }
        sink.ideal = ideal.reduce(0, +)
        guard available.isFinite, sink.ideal > available else { return ideal }  // 0 available: every child at its minimum (it scrolls)
        let minimum = subviews.map { $0.sizeThatFits(.init(width: width, height: 0)).height }
        var size = ideal, frozen = ideal.indices.map { ideal[$0] <= minimum[$0] }
        for _ in 0..<subviews.count + 1 {
            let free = available - size.reduce(0, +)
            let basis = ideal.indices.filter { !frozen[$0] }.reduce(CGFloat(0)) { $0 + ideal[$1] }
            guard free < -0.001, basis > 0 else { break }
            var clamped = false
            for i in ideal.indices where !frozen[i] {
                let target = size[i] + free * ideal[i] / basis
                if target <= minimum[i] { size[i] = minimum[i]; frozen[i] = true; clamped = true } else { size[i] = target }
            }
            if !clamped { break }
        }
        return size
    }
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let h = heights(proposal.width, subviews)
        let w = proposal.width ?? subviews.map { $0.sizeThatFits(.unspecified).width }.max() ?? 0
        return .init(width: w, height: h.reduce(0, +))
    }
    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var y = bounds.minY
        for (i, h) in heights(bounds.width, subviews).enumerated() {
            let s = subviews[i].sizeThatFits(.init(width: bounds.width, height: h))
            let x = alignment == .center ? bounds.midX - s.width / 2 : alignment == .trailing ? bounds.maxX - s.width : bounds.minX
            subviews[i].place(at: .init(x: x, y: y), anchor: .topLeading, proposal: .init(width: bounds.width, height: h)); y += h
        }
    }
}

/// Per-instance runtime: open cycle and drag on the frame clock.
@Observable final class AWCBottomSheetMotion {
    var opacity = AWCCSSTransitionTrack()
    var fraction = AWCCSSTransitionTrack(initial: 1)
    var pixels = AWCCSSTransitionTrack()
    var indicator = AWCCSSTransitionTrack(initial: 0.4)
    var dragging = false
    var drag: CGFloat = 0
    var hover = false
    var tick = 0
    func running(_ now: Double) -> Bool { [opacity, fraction, pixels, indicator].contains { $0.isRunning(now) } }
}

/// md-bottom-sheet: standard (anchored, top corners rounded) and detached (16 pt margins, all corners, elevation 3),
/// both modal in the nearest `AWCModalScope`. Events: mdOpen/mdClose on every open change; Escape (always), an
/// enabled scrim, the fallback close and a drag released beyond 100 pt emit mdCancel then mdClose; `close()` emits
/// mdClose only. Payloads are void.
struct AWCNativeBottomSheet: View {
    let id: String
    let model: AWCBottomSheetModel
    let theme: AWCTheme
    let open: Binding<Bool>
    let slots: AWCBottomSheetSlots
    let emit: (String) -> Void
    @Environment(\.self) private var environment
    @Environment(\.awcModalSession) private var session
    @Environment(\.awcBottomSheetAppearance) private var inheritedAppearance
    @Environment(\.awcBottomSheetTargets) private var targets
    @Environment(\.awcBottomSheetParts) private var partValues
    @Environment(\.awcBottomSheetControllers) private var controllers
    @Environment(\.awcNativeDensity) private var inheritedDensity
    @Environment(\.accessibilityReduceMotion) private var systemReduced
    @Environment(\.awcModalReducedMotion) private var reducedOverride
    @Environment(\.awcNativePointerState) private var pointer
    @State private var motion = AWCBottomSheetMotion()
    @State private var emitted: Bool?
    @State private var owner: AWCModalOwner
    @State private var regions = AWCModalFocusRegions(count: 3)
    @State private var contentNatural: CGFloat = 0
    @State private var contentAvailable: CGFloat = 0
    @State private var flexSink = AWCSheetFlexSink()
    @State private var containerFocus = false
    @State private var containerRing = false
    @State private var settle = 0
    @State private var handleFrame: CGRect = .zero
    @State private var containerHeight: CGFloat = 0

    init(id: String, model: AWCBottomSheetModel, theme: AWCTheme, open: Binding<Bool>, slots: AWCBottomSheetSlots, emit: @escaping (String) -> Void) {
        self.id = id; self.model = model; self.theme = theme; self.open = open; self.slots = slots; self.emit = emit
        _owner = State(initialValue: AWCModalOwner(id: id))
    }
    private var appearance: AWCBottomSheetAppearance { inheritedAppearance.merging(targets[id] ?? .init()) }
    private func part(_ p: AWCBottomSheetPart) -> AWCModalPartAppearance { (partValues[p.rawValue] ?? .init()).merging(partValues[id + "|" + p.rawValue] ?? .init()) }
    private var density: Double { AWCNativeDensity.resolve(model.density, inherited: inheritedDensity) }
    private var localRung: Double? { model.density.flatMap { [-1.0, -2, -3, -4].contains($0) ? $0 : nil } }
    private var reduced: Bool { reducedOverride ?? systemReduced }
    private var curve: [Double] { awcCSSCubicBezier(theme.tokens["--md-sys-motion-easing-standard"]) ?? [0.2, 0, 0, 1] }
    private var emphasized: [Double] { awcCSSCubicBezier(theme.tokens["--md-sys-motion-easing-emphasized"]) ?? [0.2, 0, 0, 1] }
    private var fade: Double { reduced ? 0 : awcCSSDuration(theme.tokens["--md-sys-motion-duration-medium2"]) ?? 300 }
    private var slide: Double { reduced ? 0 : awcCSSDuration(theme.tokens["--md-sys-motion-duration-medium4"]) ?? 400 }
    private func color(_ token: String, _ fallback: String) -> Color { Color(awcHex: theme.tokens["--md-sys-color-" + token] ?? fallback) }
    private func hex(_ value: String?) -> Color? { value.map { Color(awcHex: $0) } }
    private var hasHeadline: Bool { !model.headline.isEmpty || slots.headline != nil }
    private var hasClose: Bool { model.closeable || slots.close != nil }
    private var accessibleName: String { !model.ariaLabel.isEmpty ? model.ariaLabel : hasHeadline ? model.headline : "Bottom sheet" }

    var body: some View {
        let now = CACurrentMediaTime() * 1000
        let visible = !model.hidden && (open.wrappedValue || motion.running(now) || motion.opacity.presented(now) > 0.0001)
        Color.clear.frame(width: 0, height: 0)
            .preference(key: AWCModalEntries.self, value: visible ? [entry(now, layer: 0), entry(now, layer: 1)] : [])
            .onAppear { attach(); sync(open.wrappedValue) }
            .onChange(of: open.wrappedValue) { _, value in sync(value) }
            .onChange(of: model.hidden) { _, _ in sync(open.wrappedValue) }
            .onChange(of: model.showDragHandle) { _, show in if !show { cancelDrag() } }
            .onDisappear { if emitted == true { session?.release(id) }; emitted = nil }
            .accessibilityHidden(true)
    }

    // MARK: Behaviour
    private func attach() {
        owner.escape = { [self] in
            guard open.wrappedValue, session?.isTop(id) ?? true else { return false }
            dismiss(); return true
        }
        owner.tab = { [regions] backward in regions.move(backward: backward) }
        owner.focusInitial = { [regions, session] in regions.focusFirst(visible: !(session?.lastInputPointer ?? false)) }
        // A newly active owner cancels an in-progress drag on this sheet (late pointer events cannot dismiss it).
        owner.covered = { [self] in cancelDrag() }
        if let controller = controllers[id] {
            controller.showAction = { [self] in if !open.wrappedValue { open.wrappedValue = true; sync(true) } }
            controller.closeAction = { [self] in if open.wrappedValue { open.wrappedValue = false; sync(false) } }
            controller.openState = { [self] in open.wrappedValue }
        }
    }
    private func sync(_ value: Bool) {
        let active = value && !model.hidden
        let now = CACurrentMediaTime() * 1000
        if emitted == nil {
            emitted = active
            if active { begin(open: true, now: now); session?.acquire(owner); emit("mdOpen"); scheduleSettle() }
            return
        }
        guard active != emitted else { return }
        emitted = active
        cancelDrag(keepOffset: !active)
        begin(open: active, now: now)
        if active { session?.acquire(owner); emit("mdOpen") } else { session?.release(id); emit("mdClose") }
        scheduleSettle()
    }
    private func begin(open: Bool, now: Double) {
        motion.opacity.set(open ? 1 : 0, now: now, duration: fade, curve: curve)
        motion.fraction.set(open ? 0 : 1, now: now, duration: slide, curve: emphasized)
        motion.tick &+= 1
    }
    private func scheduleSettle() {
        let wait = UInt64(max(fade, slide) + 34) * 1_000_000
        Task { @MainActor in try? await Task.sleep(nanoseconds: wait); settle += 1 }
    }
    private func dismiss() {
        guard open.wrappedValue, session.map({ $0.isTop(id) }) ?? true else { return }
        emit("mdCancel"); open.wrappedValue = false; sync(false)
    }
    /// Pointer cancel, lost capture, hiding the handle, closing and being covered: the dragged offset returns
    /// without an event. Closing keeps the offset as the start of the exit transition (the source clears the inline
    /// transform in the same tick, so the transition starts from the dragged value).
    private func cancelDrag(keepOffset: Bool = false) {
        guard motion.dragging || motion.drag != 0 else { return }
        let from = motion.drag
        motion.dragging = false; motion.drag = 0
        let now = CACurrentMediaTime() * 1000
        motion.pixels.snap(Double(from)); motion.pixels.set(0, now: now, duration: slide, curve: emphasized)
        setIndicator(now)
        _ = keepOffset
    }
    private func setIndicator(_ now: Double) {
        let p = part(.dragHandleIndicator)
        // Chrome never renders the `--dragging` state (.8) during a handle drag: only hover (.6) and rest (.4) apply.
        let target = p.opacity ?? (motion.hover ? 0.6 : 0.4)
        // The handle indicator keeps its 100 ms transition under reduced motion (the source only removes the shell's).
        motion.indicator.set(target, now: now, duration: awcCSSDuration(theme.tokens["--md-sys-motion-duration-short2"]) ?? 100, curve: curve)
        motion.tick &+= 1
    }
    private var dragGesture: some Gesture {
        DragGesture(minimumDistance: 0, coordinateSpace: .global)
            .onChanged { value in
                guard open.wrappedValue, model.showDragHandle, session.map({ $0.isTop(id) }) ?? true else { if motion.dragging { cancelDrag() }; return }
                if !motion.dragging {
                    // The press lands on the handle: Chrome's :hover (from the pointer move that precedes it) applies.
                    motion.hover = true; motion.dragging = true; motion.pixels.snap(0); setIndicator(CACurrentMediaTime() * 1000)
                    // Chrome: pressing the (non-focusable) handle focuses its nearest focusable ancestor, the
                    // container (tabindex=-1), without a focus ring.
                    if !containerFocus { _ = regions.focusContainer() }
                }
                motion.drag = max(0, value.translation.height)
                motion.pixels.snap(Double(motion.drag))
            }
            .onEnded { _ in
                guard motion.dragging else { return }
                let dismissing = motion.drag > 100
                if dismissing {
                    // The exit transition starts from the dragged offset.
                    let from = motion.drag
                    motion.dragging = false; motion.drag = 0
                    let now = CACurrentMediaTime() * 1000
                    motion.pixels.snap(Double(from)); motion.pixels.set(0, now: now, duration: slide, curve: emphasized)
                    setIndicator(now)
                    dismiss()
                } else { cancelDrag() }
            }
    }

    // MARK: Presentation
    private func entry(_ now: Double, layer: Int = 1) -> AWCModalEntry {
        // While the pointer is over the handle the frame clock keeps observing it: hover follows pointer movement only
        // (Chrome keeps :hover while the sheet moves under a still pointer).
        let running = motion.running(now) || settle < 0 || (pointer != nil && (motion.hover || motion.dragging))
        let content = TimelineView(.animation(paused: !running)) { _ in
            GeometryReader { geometry in shell(viewport: geometry.size, time: CACurrentMediaTime() * 1000, layer: layer) }
                .onChange(of: pointer?.location) { _, location in pointerMoved(location) }
        }
        .environment(\.awcNativeInert, false)
        .environment(\.self, environment)
        // Source `--md-sys-z-index-dialog-scrim` (1001) surface over `--md-sys-z-index-popup` (1000) scrim.
        // Two layers, as in the source: the scrim (1000) and the surface (1001) sort independently in the scope, so a later
        // sheet's scrim paints below an earlier sheet's surface (Chrome's stacking).
        return .init(id: layer == 0 ? id + "#scrim" : id, zIndex: layer == 0 ? 1000 : 1001, content: AnyView(content))
    }
    private func resolve(_ l: AWCSkeletonLength?, _ basis: CGFloat) -> CGFloat? { l.map { CGFloat($0.points) + CGFloat($0.fraction) * basis } }
    /// Inline size and position: `inline-size` clamped by `max-inline-size` then `min-inline-size` (min wins), centred by
    /// `margin-inline: auto` between the insets (0 standard, the detached margin otherwise); an over-wide sheet starts at
    /// the inline-start inset. Default width 100% below a 640 pt viewport, else 640 capped at 100% − 112.
    private func placement(_ viewport: CGSize) -> (CGFloat, CGFloat, CGFloat) {
        let a = appearance, vw = viewport.width
        let detached = model.variant == "detached", margin = CGFloat(a.detachedMargin ?? 16), wide = vw >= 640
        let widthL = a.width ?? (wide ? .points(640) : .fraction(1))
        let maxL = a.maxWidth ?? (wide ? .init(points: -112, fraction: 1) : .fraction(1))
        var maxW = resolve(maxL, vw) ?? vw
        if detached { maxW = min(maxW, vw - 2 * margin) }
        let width = max(resolve(a.minWidth, vw) ?? 0, min(resolve(widthL, vw) ?? vw, maxW))
        let left: CGFloat = detached ? margin : 0, right: CGFloat = detached ? vw - margin : vw
        let rtl = environment.layoutDirection == .rightToLeft
        let x = width <= right - left ? left + (right - left - width) / 2 : (rtl ? right - width : left)
        return (width, x, detached ? margin : 0)
    }

    @ViewBuilder private func shell(viewport: CGSize, time: Double, layer: Int) -> some View {
        let open = self.open.wrappedValue && !model.hidden
        let opacity = reduced ? (open ? 1 : 0) : motion.opacity.presented(time)
        let fraction = reduced ? (open ? 0 : 1) : motion.fraction.presented(time)
        let pixels = motion.dragging ? Double(motion.drag) : (reduced ? 0 : motion.pixels.presented(time))
        let d = density, vw = viewport.width, vh = viewport.height
        let detached = model.variant == "detached"
        let (width, x, bottomInset) = placement(viewport)
        ZStack(alignment: .topLeading) {
            if layer == 0 {
            let scrimPart = part(.scrim)
            (hex(scrimPart.background) ?? hex(appearance.scrimColor) ?? Color(.sRGB, red: 0, green: 0, blue: 0, opacity: 0.32))
                .frame(width: vw, height: vh)
                .opacity(opacity)
                .contentShape(Rectangle())
                .onTapGesture {
                    guard session.map({ $0.isTop(id) }) ?? true else { return }
                    if model.scrimDismissible { dismiss() } else { session?.blur() }
                }
                .allowsHitTesting(open)
                .awcInspect(nodeID: id, part: "scrim", name: "scrim") { _ in ["opacity": .number(opacity), "renderTime": .number(time)] }
            }
            // translateY(100%) closed: the percentage resolves against the container's own rendered height.
            if layer == 1 {
            container(viewport: viewport, width: width, density: d, detached: detached)
                .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { containerHeight = $0 }
                .opacity(opacity)
                .awcInspect(nodeID: id, part: "container-motion", name: "container-motion") { size in
                    ["opacity": .number(opacity), "translateY": .number(fraction * Double(size.height) + pixels), "height": .number(Double(size.height)),
                     "indicator": .number(motion.indicator.presented(time)), "renderTime": .number(time)]
                }
                .visualEffect { content, proxy in content.offset(y: CGFloat(fraction) * proxy.size.height + CGFloat(pixels)) }
                .offset(x: x)
                .frame(width: vw, height: max(0, vh - bottomInset), alignment: .bottomLeading)
                .allowsHitTesting(open)
            }
        }
        .frame(width: vw, height: vh, alignment: .topLeading)
        .environment(\.layoutDirection, .leftToRight)
    }

    private func container(viewport: CGSize, width: CGFloat, density d: Double, detached: Bool) -> some View {
        let a = appearance, vh = viewport.height
        let shape = a.containerShape
        let corners: AWCCornerShape = {
            let base = max(16, 28 + 2 * d)
            if detached { return shape?.shorthand ?? .points(base) }
            let corner = shape?.corner ?? .init(.points(base))
            return .init(topLeft: corner, topRight: corner, bottomRight: .init(), bottomLeft: .init())
        }()
        let fill = hex(a.containerColor) ?? color("surface-container-low", "#F7F2FA")
        let containerPart = part(.container)
        let rtl = environment.layoutDirection == .rightToLeft
        let gutter = CGFloat(a.contentPaddingInline ?? max(12, 24 + 2 * d))
        let insetSM = AWCSheetSpacing.token("inset-sm", local: localRung, inherited: inheritedDensity)
        let insetLG = AWCSheetSpacing.token("inset-lg", local: localRung, inherited: inheritedDensity)
        let hasActions = slots.actions != nil
        let showHeader = hasHeadline || hasClose
        var index = 0
        if model.showDragHandle { index += 1 }
        if showHeader { index += 1 }
        if model.topDivider { index += 1 }
        let contentIndex = index
        let top: CGFloat = model.showDragHandle ? 0 : CGFloat(max(12, 24 + 2 * d))
        let shapeView = AWCNativeCornerShape(corners: corners)
        return AWCSheetColumn(width: width, height: resolve(a.height, vh), minHeight: resolve(a.minHeight, vh) ?? 0, maxHeight: resolve(a.maxHeight, vh) ?? vh * 0.8,
                              top: top, bottom: session?.safeArea.bottom ?? 0, contentIndex: contentIndex,
                              contentMin: CGFloat(insetSM + insetLG), contentNatural: contentNatural) {
            if model.showDragHandle { dragHandle(density: d) }
            if showHeader { header(density: d) }
            if model.topDivider { divider(.dividerTop) }
            content(gutter: gutter, top: insetSM, bottom: insetLG, density: d)
            if hasActions && model.bottomDivider { divider(.dividerBottom) }
            if hasActions { actions() }
        }
        .frame(width: width, alignment: .topLeading)
        .clipShape(shapeView)
        .background { shapeView.fill(hex(containerPart.background) ?? fill) }
        .background {
            if detached { AWCNativeBoxShadow(corners: corners, layers: AWCBoxShadow.source(theme.tokens["--md-sys-elevation-3"] ?? "none") ?? [], placement: .outer) }
        }
        .overlay {
            if let outline = containerPart.outlineColor, let lineWidth = containerPart.outlineWidth { shapeView.strokeBorder(Color(awcHex: outline), lineWidth: lineWidth).allowsHitTesting(false) }
        }
        .overlay {
            // `:focus-visible` container (no tabbable descendant): 3 pt secondary outline offset −3 pt, following the corners.
            if containerFocus && containerRing { shapeView.strokeBorder(color("secondary", "#625B71"), lineWidth: 3).allowsHitTesting(false) }
        }
        .background {
            AWCModalContainerFocus(id: id + ".container", label: accessibleName, register: { view in regions.container = view },
                                   focusChanged: { focused in containerFocus = focused; if focused { containerRing = !(session?.lastInputPointer ?? false) } })
                .accessibilityHidden(true)
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel(accessibleName)
        .accessibilityAddTraits(.isModal)
        .awcInspect(nodeID: id, part: "container", name: "container") { size in
            ["role": .string("dialog"), "label": .string(accessibleName), "radius": .number(Double(corners.radii(in: size).first?.width ?? 0))]
        }
        .environment(\.awcNativeDensity, d)
        .environment(\.layoutDirection, rtl ? .rightToLeft : .leftToRight)
    }
    private func dragHandle(density d: Double) -> some View {
        let p = part(.dragHandle), ip = part(.dragHandleIndicator)
        let pad = max(12, 22 + 2 * d), iw = max(24, 32 + 2 * d), ih = max(3, 4 + 0.25 * d)
        let time = CACurrentMediaTime() * 1000
        return ZStack {
            RoundedRectangle(cornerRadius: 2).fill(hex(ip.background) ?? hex(appearance.dragHandleColor) ?? color("on-surface-variant", "#49454F"))
                .frame(width: iw, height: ih)
                .opacity(ip.opacity ?? motion.indicator.presented(time))
                .awcInspect(nodeID: id, part: "drag-handle-indicator", name: "drag-handle-indicator")
        }
        .frame(maxWidth: .infinity, minHeight: 2 * pad + ih, maxHeight: 2 * pad + ih)
        .background { if let bg = p.background { Color(awcHex: bg) } }
        .contentShape(Rectangle())
        .onHover { inside in guard pointer == nil, !motion.dragging else { return }; motion.hover = inside; setIndicator(CACurrentMediaTime() * 1000) }
        .onGeometryChange(for: CGRect.self) { $0.frame(in: .named("awc-native-preview")) } action: { handleFrame = $0 }
        .gesture(dragGesture)
        .accessibilityHidden(true)
        .awcInspect(nodeID: id, part: "drag-handle", name: "drag-handle")
    }
    /// The handle's rendered frame: its layout frame moved by the sheet's current translate.
    private func pointerMoved(_ location: CGPoint?) {
        guard !motion.dragging, let location else { return }
        let now = CACurrentMediaTime() * 1000
        let shift = (reduced ? (open.wrappedValue ? 0 : 1) : motion.fraction.presented(now)) * Double(containerHeight) + (reduced ? 0 : motion.pixels.presented(now))
        let inside = handleFrame.offsetBy(dx: 0, dy: CGFloat(shift)).contains(location)
        if inside != motion.hover { motion.hover = inside; setIndicator(now) }
    }
    private func header(density d: Double) -> some View {
        let p = part(.header), hp = part(.headline), cp = part(.close)
        let pad = max(12, 24 + 2 * d), bottom = max(4, 8 + d), gap = max(4, 12 + 2 * d)
        let size = max(18, 24 + d), line = max(24, 32 + 2 * d)
        let align: TextAlignment = model.headlineAlign == "center" ? .center : model.headlineAlign == "end" ? .trailing : .leading
        let frameAlign: Alignment = model.headlineAlign == "center" ? .center : model.headlineAlign == "end" ? .trailing : .leading
        let iconSize = max(32, 40 + 4 * d)
        return HStack(spacing: gap) {
            if hasHeadline {
                Group { if let slot = slots.headline { slot } else { Text(model.headline) } }
                    .font(AWCNativeFonts.label(size: size, weight: 400))
                    .tracking(hp.letterSpacing ?? 0)
                    .underline(hp.underline ?? false)
                    .foregroundStyle(hex(hp.color) ?? hex(appearance.headlineColor) ?? color("on-surface", "#1C1B1F"))
                    .multilineTextAlignment(align)
                    .modifier(AWCCSSLineBox(size: size, line: line))
                    .frame(maxWidth: .infinity, alignment: frameAlign)
                    .background { if let bg = hp.background { Color(awcHex: bg) } }
                    .awcInspect(nodeID: id, part: "headline", name: "headline")
            } else { Spacer(minLength: 0) }
            if hasClose {
                Group {
                    if let close = slots.close { close.fixedSize() }
                    else {
                        AWCNativeView(node: AWCNode(id: id + ".close-button", tag: "md-icon-button",
                                                    properties: ["icon": "close", "variant": "standard", "aria-label": "Close bottom sheet"])) { event in
                            if event.name == "mdClick" { dismiss() }
                        }
                        .awcIconButtonAppearance(.init(iconColor: appearance.iconColor ?? theme.tokens["--md-sys-color-on-surface-variant"], iconSize: max(18, 24 + d), width: iconSize, height: iconSize))
                        .fixedSize()
                    }
                }
                .background { if let bg = cp.background { Color(awcHex: bg) } }
                .awcInspect(nodeID: id, part: "close", name: "close")
                .padding(.trailing, CGFloat(-12 - d))
            }
        }
        .environment(\.awcPopupTarget, regions.regions[0])
        .padding(.horizontal, pad).padding(.bottom, bottom)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background { if let bg = p.background { Color(awcHex: bg) } }
        .awcInspect(nodeID: id, part: "header", name: "header")
    }
    private func divider(_ which: AWCBottomSheetPart) -> some View {
        let p = part(which)
        return Rectangle().fill(hex(p.background) ?? hex(appearance.dividerColor) ?? color("outline-variant", "#CAC4D0"))
            .frame(maxWidth: .infinity).frame(height: p.height ?? 1)
            .awcInspect(nodeID: id, part: which.rawValue, name: which.rawValue)
    }
    private func content(gutter: CGFloat, top: Double, bottom: Double, density d: Double) -> some View {
        let p = part(.content)
        let size = max(12, 14 + 0.5 * d), line = max(16, 20 + d)
        let ink = hex(p.color) ?? hex(appearance.contentColor) ?? color("on-surface", "#1C1B1F")
        let align: HorizontalAlignment = model.contentAlign == "center" ? .center : model.contentAlign == "end" ? .trailing : .leading
        let text: TextAlignment = model.contentAlign == "center" ? .center : model.contentAlign == "end" ? .trailing : .leading
        // The content part is the only scroller; its slotted blocks are flex items that shrink to their minimum first (gate-7 R4-01).
        return ScrollView(.vertical) {
            AWCSheetFlexColumn(available: contentAvailable > 0 ? max(0, contentAvailable - top - bottom) : .infinity, alignment: align, sink: flexSink) { slots.content }
                .frame(maxWidth: .infinity, alignment: Alignment(horizontal: align, vertical: .top))
                .multilineTextAlignment(text)
                .padding(EdgeInsets(top: top, leading: gutter, bottom: bottom, trailing: gutter))
                .font(AWCNativeFonts.label(size: size, weight: 400)).tracking(0.25)
                .lineSpacing(AWCCSSLineBox.spacing(size, line))
                .foregroundStyle(ink)
                .environment(\.awcPopupTarget, regions.regions[1])
                // The natural height is the unshrunk content (+ padding), never the shrunk size (no feedback into the sheet height).
                .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { _ in contentNatural = flexSink.ideal + top + bottom }
        }
        .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { contentAvailable = $0 }
        .scrollIndicators(.never)
        .scrollBounceBehavior(.basedOnSize)
        .background { if let bg = p.background { Color(awcHex: bg) } }
        .awcInspect(nodeID: id, part: "content", name: "content") { _ in ["fontSize": .number(size), "lineHeight": .number(line)] }
    }
    private func actions() -> some View {
        let p = part(.actions)
        let gap = AWCSheetSpacing.token("gap-sm", local: localRung, inherited: inheritedDensity)
        let xl = AWCSheetSpacing.token("inset-xl", local: localRung, inherited: inheritedDensity), lg = AWCSheetSpacing.token("inset-lg", local: localRung, inherited: inheritedDensity)
        return HStack(spacing: gap) { slots.actions; Spacer(minLength: 0) }
            .environment(\.awcPopupTarget, regions.regions[2])
            .padding(.horizontal, xl).padding(.top, lg).padding(.bottom, xl)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background { if let bg = p.background { Color(awcHex: bg) } }
            .awcInspect(nodeID: id, part: "actions", name: "actions")
    }
}

extension AWCNativeView {
    var nativeBottomSheet: some View { AWCModalPresentationFallback(modern: nativeBottomSheetRenderer, legacy: sheet) }
    var nativeBottomSheetRenderer: some View {
        let slot = { (name: String?) -> AnyView? in
            let items = node.children(inSlot: name)
            return items.isEmpty ? nil : AnyView(ForEach(items) { item in child(item) })
        }
        return AWCNativeBottomSheet(id: node.id, model: AWCBottomSheetModel(local), theme: theme,
                                    open: Binding(get: { b("open") }, set: { set("open", .bool($0)) }),
                                    slots: AWCBottomSheetSlots(content: slot(nil), headline: slot("headline"), close: slot("close"), actions: slot("actions")),
                                    emit: { name in emit(name) })
    }
}
