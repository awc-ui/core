import SwiftUI
import QuartzCore
#if canImport(AppKit)
import AppKit
#else
import UIKit
#endif

// MARK: Viewport

private struct AWCAccordionViewportKey: EnvironmentKey { static let defaultValue: CGSize? = nil }
extension EnvironmentValues {
    /// Size of the nearest `awcAccordionViewport()`; floating accordions use it as
    /// the CSS initial containing block of `position: fixed` (physical coordinates).
    var awcAccordionViewport: CGSize? {
        get { self[AWCAccordionViewportKey.self] }
        set { self[AWCAccordionViewportKey.self] = newValue }
    }
}
private struct AWCAccordionViewportOriginKey: EnvironmentKey { static let defaultValue: CGPoint = .zero }
private struct AWCFloatingEntryKey: EnvironmentKey { static let defaultValue = false }
extension EnvironmentValues {
    /// Global origin of the nearest `awcAccordionViewport()` (zero without one): the overlay entry of a floating
    /// panel measures its own global origin and subtracts this to place the panel in viewport coordinates (r3-19).
    var awcAccordionViewportOrigin: CGPoint {
        get { self[AWCAccordionViewportOriginKey.self] }
        set { self[AWCAccordionViewportOriginKey.self] = newValue }
    }
    /// True inside the modal-layer entry of a floating panel (the placeholder in place must not publish again).
    var awcFloatingEntry: Bool {
        get { self[AWCFloatingEntryKey.self] }
        set { self[AWCFloatingEntryKey.self] = newValue }
    }
}
private struct AWCAccordionViewportModifier: ViewModifier {
    @State private var size: CGSize = .zero
    @State private var origin: CGPoint = .zero
    func body(content: Content) -> some View {
        content
            .environment(\.awcAccordionViewport, size)
            .environment(\.awcAccordionViewportOrigin, origin)
            .onGeometryChange(for: CGPoint.self) { $0.frame(in: .global).origin } action: { origin = $0 }
            .coordinateSpace(name: AWCAccordionViewport.space)
            .onGeometryChange(for: CGSize.self) { $0.size } action: { size = $0 }
    }
}
enum AWCAccordionViewport { static let space = "awc-accordion-viewport" }
public extension View {
    /// Declares the viewport for floating accordions (`floating`): panels are placed at
    /// `initialX`/`initialY` from its top-left, events report coordinates in it and the
    /// panel width is limited to its width minus 16 points. Without it the window is used.
    func awcAccordionViewport() -> some View { modifier(AWCAccordionViewportModifier()) }
}

// MARK: Placement

/// `position: fixed; top: 0; left: 0; transform: translate(x, y)`: the panel leaves
/// layout (zero footprint) and is drawn at physical viewport coordinates. One modifier
/// chain serves both modes, so toggling `floating` never replaces the subtree.
struct AWCAccordionFloatingHost<Content: View>: View {
    let active: Bool, x: Double, y: Double, z: Double, width: Double
    let entryID: String
    let content: Content
    @Environment(\.awcModalSession) private var session
    @Environment(\.awcFloatingEntry) private var inEntry
    @Environment(\.self) private var environment
    var body: some View {
        // Mechanism 2 (r3-19): under an `AWCModalScope` the panel is an entry of the scope's overlay, so no ancestor clips it and it
        // orders against sheets and dialogs by z-index; a zero-size placeholder stays in the flow. Without a scope: mechanism 1 (lift).
        if active, !inEntry, let session {
            let env = environment
            Color.clear.frame(width: 0, height: 0).allowsHitTesting(false)
                .preference(key: AWCModalEntries.self, value: [AWCModalEntry(
                    id: "floating-panel#" + entryID, zIndex: z + 0.001,
                    content: AnyView(AWCAccordionFloatingPanelBody(active: true, x: x, y: y, z: z, width: width, content: content)
                        .environment(\.awcFloatingEntry, true).environment(\.self, env)
                        .allowsHitTesting(!session.isActive)))])
        } else {
            AWCAccordionFloatingPanelBody(active: active, x: x, y: y, z: z, width: width, content: content)
        }
    }
}

struct AWCAccordionFloatingPanelBody<Content: View>: View {
    let active: Bool, x: Double, y: Double, z: Double, width: Double
    let content: Content
    @Environment(\.awcAccordionViewport) private var viewport
    @Environment(\.awcAccordionViewportOrigin) private var viewportOrigin
    @Environment(\.awcFloatingEntry) private var inEntry
    @Environment(\.layoutDirection) private var direction
    @State private var anchor: CGPoint = .zero
    var body: some View {
        let used = viewport.map { min(width, max(0, $0.width - 16)) } ?? width
        if inEntry && active {
            // In the overlay the panel takes layout position (padding from the entry's top-left), so inspection and
            // accessibility geometry follow it; an `.offset` inside a zero-size frame is not reflected in measured frames.
            content
                .environment(\.layoutDirection, direction)
                .frame(width: used)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.leading, x - anchor.x).padding(.top, y - anchor.y)
                .onGeometryChange(for: CGPoint.self) { proxy in
                    let o = proxy.frame(in: .global).origin; return CGPoint(x: o.x - viewportOrigin.x, y: o.y - viewportOrigin.y)
                } action: { anchor = $0 }
                .environment(\.layoutDirection, .leftToRight)
        } else {
        content
            .environment(\.layoutDirection, direction)
            .frame(width: active ? used : nil)
            .fixedSize(horizontal: false, vertical: active)
            .offset(x: active ? x - anchor.x : 0, y: active ? y - anchor.y : 0)
            .frame(width: active ? 0 : nil, height: active ? 0 : nil, alignment: .topLeading)
            .onGeometryChange(for: CGPoint.self) { proxy in
                if inEntry { let o = proxy.frame(in: .global).origin; return CGPoint(x: o.x - viewportOrigin.x, y: o.y - viewportOrigin.y) }
                return (viewport != nil ? proxy.frame(in: .named(AWCAccordionViewport.space)) : proxy.frame(in: .global)).origin
            } action: { anchor = $0 }
            .environment(\.layoutDirection, .leftToRight)
            // `z-index` of the fixed panel stacks against the document (r3-19): the hosts above rise with it.
            .modifier(AWCStackingLift(own: active && !inEntry ? z : 0, publish: !inEntry))
        }
    }
}

// MARK: Panel chassis

struct AWCAccordionFloatingShape: Shape {
    var corners: AWCCornerShape, active: Bool
    func path(in rect: CGRect) -> Path { active ? AWCNativeCornerShape(corners: corners).path(in: rect) : Path(rect.insetBy(dx: -1_000, dy: -1_000)) }  // "no clip". A ±100 000 pt clip box made iOS SwiftUI place hosted views of a lifted RTL item at x -4 instead of 40 (lift fixture); ±1 000 pt clips nothing either.
}

/// Floating surface: background, radius with `overflow: hidden`, and the resting /
/// dragging elevation on the effects transition (`transition="none"` or reduced
/// motion snap). Inactive, it draws nothing and clips nothing.
struct AWCAccordionFloatingChassis: ViewModifier {
    let nodeID: String, active: Bool, dragging: Bool, corners: AWCCornerShape, background: Color
    let resting: [AWCBoxShadow], lifted: [AWCBoxShadow], timing: AWCAccordionReorderMotion.Timing
    @State private var lift = AWCCSSTransitionTrack()
    func body(content: Content) -> some View {
        let now = CACurrentMediaTime() * 1000
        content
            .compositingGroup()
            .clipShape(AWCAccordionFloatingShape(corners: corners, active: active))
            .background { if active { AWCNativeCornerShape(corners: corners).fill(background) } }
            .background {
                if active {
                    if timing.duration > 0 {
                        TimelineView(.animation(paused: !lift.isRunning(now))) { _ in
                            let t = CACurrentMediaTime() * 1000
                            shadow(lift.presented(t), at: t)
                        }
                    } else {
                        shadow(dragging ? 1 : 0, at: now)
                    }
                }
            }
            .onChange(of: dragging) { _, next in lift.set(next ? 1 : 0, now: CACurrentMediaTime() * 1000, duration: timing.duration, curve: timing.curve) }
    }
    /// `fraction` is the eased resting→lifted progress of every shadow parameter.
    private func shadow(_ fraction: Double, at time: Double) -> some View {
        AWCNativeBoxShadow(corners: corners, layers: resting, toLayers: lifted, fraction: fraction, placement: .outer)
            .awcInspect(nodeID: nodeID, part: "floating-panel", name: "floating-panel") { _ in ["fraction": .number(fraction), "renderTime": .number(time)] }
    }
}

// MARK: Chassis handle (first item of a floating accordion)

/// The slim top-centre grip: a 52×16 hit area 4 points below the item's top edge with
/// a 32×4 pill. Hover widens the pill to 38 at .9 opacity with a 10 % state-layer tint;
/// press and an active panel drag show 40 at full opacity (16 % tint while pressed).
/// The pill is primary while dragging and on-secondary-container on an expanded item.
struct AWCAccordionChassisHandle: View {
    let context: AWCAccordionReorderContext?, nodeID: String, expanded: Bool, dragging: Bool
    let barColor: Color, tint: Color, hoverTint: Color?, timing: AWCAccordionInteractionTiming
    /// Hit area in "awc-native-preview" space, for the header underneath (hover exclusion).
    var onFrame: (CGRect) -> Void = { _ in }
    /// forced-colors: `.md-accordion-item__chassis-handle-bar { background-color: CanvasText; opacity: 1 }`.
    var forced = false
    /// `::part(chassis-handle)` / `::part(chassis-handle-bar)` declarations.
    var handlePart = AWCAccordionPartAppearance(), barPart = AWCAccordionPartAppearance()
    @Environment(\.awcNativePointerState) private var pointer
    @Environment(\.awcAccordionViewport) private var viewport
    @State private var hovered = false
    @State private var frame: CGRect = .zero
    @State private var viewportFrame: CGRect = .zero
    @State private var pressed = false
    @State private var width = AWCCSSTransitionTrack(initial: 32)
    @State private var opacity = AWCCSSTransitionTrack(initial: 0.45)
    @State private var background = AWCCSSColorTrack()
    @State private var bar = AWCCSSColorTrack()
    @State private var primed = false
    private var hover: Bool { pointer.map { $0.location.map(frame.contains) ?? false } ?? hovered }
    private struct Targets: Hashable { var width: Double, opacity: Double, background: Color, bar: Color }
    private var targets: Targets {
        let active = pressed || dragging
        return .init(width: active ? 40 : hover ? 38 : 32, opacity: forced || active ? 1 : hover ? 0.9 : 0.45,
                     background: pressed ? hoverTint ?? tint.opacity(0.16) : hover ? hoverTint ?? tint.opacity(0.10) : .clear, bar: barColor)
    }
    private func apply(_ next: Targets) {
        guard primed else { width.snap(next.width); opacity.snap(next.opacity); background.set(next.background, now: 0, duration: 0, curve: [0,0,1,1]); bar.set(next.bar, now: 0, duration: 0, curve: [0,0,1,1]); primed = true; return }
        let now = CACurrentMediaTime() * 1000
        width.set(next.width, now: now, duration: timing.spring.duration, curve: timing.spring.curve)
        opacity.set(next.opacity, now: now, duration: timing.effects.duration, curve: timing.effects.curve)
        background.set(next.background, now: now, duration: timing.effects.duration, curve: timing.effects.curve)
        bar.set(next.bar, now: now, duration: timing.effects.duration, curve: timing.effects.curve)
    }
    private func pill(_ t: Double) -> some View {
        let instant = timing.effects.duration <= 0, instantWidth = timing.spring.duration <= 0
        let w = instantWidth ? targets.width : width.presented(t), o = instant ? targets.opacity : opacity.presented(t)
        let fill = instant ? targets.background : background.presented(t) ?? .clear, ink = instant ? targets.bar : bar.presented(t) ?? barColor
        // A declared part value wins in every state (an outer ::part declaration over the inner state rules).
        let barW = barPart.width ?? w, barH = barPart.height ?? 4, barO = barPart.opacity ?? o
        let barInk = barPart.backgroundColor.map { Color(awcHex: $0) } ?? ink, handleFill = handlePart.backgroundColor.map { Color(awcHex: $0) } ?? fill
        return ZStack {
            AWCAccordionPartShape(corners: handlePart.cornerShape).fill(handleFill)
            AWCAccordionPartShape(corners: barPart.cornerShape).fill(barInk).frame(width: barW, height: barH).opacity(barO)
                .awcInspect(nodeID: nodeID, part: "chassis-handle-bar", parentPart: "chassis-handle", name: "chassis-handle-bar") { _ in
                    let r = barInk.resolve(in: EnvironmentValues())
                    return ["width": .number(barW), "opacity": .number(barO), "color": .array([.number(Double(r.red)), .number(Double(r.green)), .number(Double(r.blue))]), "renderTime": .number(t)]
                }
        }
        .frame(width: handlePart.width ?? 52, height: handlePart.height ?? 16)
        .opacity(handlePart.opacity ?? 1)
        .awcCursor(pressed || dragging ? .grabbing : .grab, active: .grabbing)
        .awcInspect(nodeID: nodeID, part: "chassis-handle", name: "chassis-handle") { _ in
            let r = fill.resolve(in: EnvironmentValues()); return ["background": .array([.number(Double(r.red)), .number(Double(r.green)), .number(Double(r.blue)), .number(Double(r.opacity))]), "renderTime": .number(t)]
        }
    }
    var body: some View {
        let now = CACurrentMediaTime() * 1000
        Group {
            if timing.effects.duration > 0 || timing.spring.duration > 0 {
                TimelineView(.animation(paused: !(width.isRunning(now) || opacity.isRunning(now) || background.isRunning(now) || bar.isRunning(now)))) { _ in pill(CACurrentMediaTime() * 1000) }
            } else { pill(now) }
        }
        .contentShape(Capsule())
        .onHover { hovered = $0 }
        .overlay { if let context { AWCAccordionChassisCapture(context: context, viewportOrigin: viewportFrame.origin, pressed: { pressed = $0 }) } }
        .onGeometryChange(for: CGRect.self) { $0.frame(in: .named("awc-native-preview")) } action: { frame = $0; onFrame($0) }
        .onGeometryChange(for: CGRect.self) { proxy in viewport != nil ? proxy.frame(in: .named(AWCAccordionViewport.space)) : proxy.frame(in: .global) } action: { viewportFrame = $0 }
        .onChange(of: targets, initial: true) { _, next in apply(next) }
        .task(id: targets) { await Task.yield(); if !Task.isCancelled { apply(targets) } }
        .accessibilityHidden(true)
    }
}

#if canImport(AppKit)
final class AWCAccordionChassisPointerView: NSView {
    var context: AWCAccordionReorderContext?
    var viewportOrigin: CGPoint = .zero
    var pressed: (Bool) -> Void = { _ in }
    private var active = false, pressing = false, offset: CGPoint = .zero
    override var acceptsFirstResponder: Bool { false }
    override func isAccessibilityElement() -> Bool { false }
    private func windowPoint(_ event: NSEvent) -> CGPoint {
        guard let root = window?.contentView else { return .zero }
        let p = root.convert(event.locationInWindow, from: nil)
        return .init(x: p.x, y: root.isFlipped ? p.y : root.bounds.height - p.y)
    }
    private func originInWindow() -> CGPoint {
        guard let root = window?.contentView else { return .zero }
        let r = root.convert(bounds, from: self)
        return .init(x: r.minX, y: root.isFlipped ? r.minY : root.bounds.height - r.maxY)
    }
    override func mouseDown(with event: NSEvent) {
        pressing = true; pressed(true)
        // Viewport origin in window coordinates, fixed for the whole drag.
        let mine = originInWindow(); offset = .init(x: mine.x - viewportOrigin.x, y: mine.y - viewportOrigin.y)
        let p = windowPoint(event)
        active = context?.state.beginChassis(pointer: 0, clientX: p.x - offset.x, clientY: p.y - offset.y) ?? false
    }
    override func mouseDragged(with event: NSEvent) {
        guard active else { return }; let p = windowPoint(event)
        context?.state.moveChassis(pointer: 0, clientX: p.x - offset.x, clientY: p.y - offset.y)
    }
    override func mouseUp(with event: NSEvent) {
        if pressing { pressing = false; pressed(false) }
        guard active else { return }; active = false; let p = windowPoint(event)
        context?.state.endChassis(pointer: 0, clientX: p.x - offset.x, clientY: p.y - offset.y)
    }
    func cancel() {
        if pressing { pressing = false; pressed(false) }
        active = false
    }
    override func viewWillMove(toWindow newWindow: NSWindow?) { if newWindow == nil { cancel() }; super.viewWillMove(toWindow: newWindow) }
}
struct AWCAccordionChassisCapture: NSViewRepresentable {
    let context: AWCAccordionReorderContext, viewportOrigin: CGPoint, pressed: (Bool) -> Void
    func makeNSView(context: Context) -> AWCAccordionChassisPointerView { .init() }
    func updateNSView(_ view: AWCAccordionChassisPointerView, context ctx: Context) {
        view.context = context; view.viewportOrigin = viewportOrigin; view.pressed = pressed; view.setAccessibilityIdentifier(context.groupID + ".chassis-pointer")
    }
    static func dismantleNSView(_ view: AWCAccordionChassisPointerView, coordinator: ()) { view.cancel() }
}
#else
final class AWCAccordionChassisPointerView: UIView {
    var context: AWCAccordionReorderContext?
    var viewportOrigin: CGPoint = .zero
    var pressed: (Bool) -> Void = { _ in }
    private var active: UITouch?, offset: CGPoint = .zero
    private func originInWindow() -> CGPoint { convert(bounds, to: window).origin }
    override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent?) {
        guard active == nil, let touch = touches.first, let window else { return }
        pressed(true); let mine = originInWindow(); offset = .init(x: mine.x - viewportOrigin.x, y: mine.y - viewportOrigin.y)
        let p = touch.location(in: window)
        if context?.state.beginChassis(pointer: 0, clientX: p.x - offset.x, clientY: p.y - offset.y) == true { active = touch } else { pressed(false) }
    }
    override func touchesMoved(_ touches: Set<UITouch>, with event: UIEvent?) {
        guard let touch = active, touches.contains(touch), let window else { return }; let p = touch.location(in: window)
        context?.state.moveChassis(pointer: 0, clientX: p.x - offset.x, clientY: p.y - offset.y)
    }
    override func touchesEnded(_ touches: Set<UITouch>, with event: UIEvent?) {
        guard let touch = active, touches.contains(touch), let window else { return }; active = nil; pressed(false); let p = touch.location(in: window)
        context?.state.endChassis(pointer: 0, clientX: p.x - offset.x, clientY: p.y - offset.y)
    }
    override func touchesCancelled(_ touches: Set<UITouch>, with event: UIEvent?) { if let touch = active, let window { touchesEnded([touch], with: event); _ = window } }
    func cancel() { active = nil; pressed(false) }
}
struct AWCAccordionChassisCapture: UIViewRepresentable {
    let context: AWCAccordionReorderContext, viewportOrigin: CGPoint, pressed: (Bool) -> Void
    func makeUIView(context: Context) -> AWCAccordionChassisPointerView { let v = AWCAccordionChassisPointerView(); v.isExclusiveTouch = true; return v }
    func updateUIView(_ view: AWCAccordionChassisPointerView, context ctx: Context) { view.context = context; view.viewportOrigin = viewportOrigin; view.pressed = pressed; view.accessibilityIdentifier = context.groupID + ".chassis-pointer" }
    static func dismantleUIView(_ view: AWCAccordionChassisPointerView, coordinator: ()) { view.cancel() }
}
#endif
