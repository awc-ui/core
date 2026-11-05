import SwiftUI
import QuartzCore

/// CSS colour transition (premultiplied sRGB interpolation via `awcInterpolatedColor`)
/// with the same retarget/reversal rules as `AWCCSSTransitionTrack`.
struct AWCCSSColorTrack {
    private(set) var value: Color?
    private var from: Color?
    private var reversing: Color?
    private(set) var running: AWCCSSTransition?
    private(set) var history: [AWCCSSTransition] = []
    func presented(_ now: Double) -> Color? {
        guard let value else { return nil }
        guard let running, let from, now < running.end else { return value }
        return awcInterpolatedColor(from, value, running.outputProgress(now))
    }
    func isRunning(_ now: Double) -> Bool { running.map { now < $0.end } ?? false }
    mutating func set(_ target: Color, now: Double, duration: Double, curve: [Double]) {
        guard let old = value else { value = target; return }
        if old == target { return }
        let current = presented(now) ?? old
        var factor = 1.0, nextReversing = current
        if let running, now < running.end, reversing == target {
            factor = min(1, max(0, abs(running.outputProgress(now) * running.shortening + 1 - running.shortening)))
            nextReversing = old
        }
        value = target
        guard duration > 0 else { running = nil; history.append(.instant(0, 1, now)); return }
        from = current; reversing = nextReversing
        let t = AWCCSSTransition(from: 0, to: 1, start: now, duration: duration * factor, curve: curve, reversingAdjustedStart: 0, shortening: factor)
        running = t; history.append(t)
    }
}

/// Source timings for the header/grip: `--_effects-duration`/`--_effects-easing`
/// (opacity, colour) and `--_spring-duration`/`--_spring-easing` (grip transform).
struct AWCAccordionInteractionTiming: Equatable {
    var effects: AWCAccordionReorderMotion.Timing
    var spring: AWCAccordionReorderMotion.Timing
    init(motion: AWCNativeAccordionMotion, preset: String, tokens: [String: String]) {
        effects = .init(duration: motion.effectsDuration, curve: motion.effectsCurve)
        if motion.reduced { spring = .init(duration: 0, curve: motion.spatialCurve); return }
        let duration: Double
        switch preset {
        case "standard", "collapse": duration = awcCSSDuration(tokens["--md-sys-motion-duration-medium2"]) ?? 300
        case "fade": duration = awcCSSDuration(tokens["--md-sys-motion-duration-short3"]) ?? 175
        default: duration = awcCSSDuration(tokens["--md-sys-motion-spring-spatial-default-duration"]) ?? 500
        }
        spring = .init(duration: duration, curve: motion.spatialCurve)
    }
}

/// Header surface: md-ripple then the state layer (source DOM order), the
/// focus ring and the shared clip. State-layer opacity follows the source
/// cascade (hover .08 < focus-visible .12 < active .12) on the effects
/// transition. While lifted the header has `pointer-events: none`, which drops
/// :hover but keeps :active until release; a grip press is a header press.
struct AWCAccordionHeaderSurface<Label: View>: View {
    let label: Label, isPressed: Bool
    let focused: Bool, disabled: Bool, stateColor: Color, focusColor: Color, rippleColor: Color
    let layer: AWCAccordionPartAppearance, corners: AWCCornerShape, border: Double, nodeID: String
    let dragging: Bool, gripPress: CGPoint?, timing: AWCAccordionInteractionTiming
    /// Floating chassis grip over the header ("awc-native-preview" space): it sits on top of the
    /// header in the source, so pointing at it hovers the grip, not the header.
    var exclusion: CGRect? = nil
    @Environment(\.awcNativePointerState) private var pointer
    @State private var hovered = false
    @State private var frame: CGRect = .zero
    @State private var localOrigin: CGPoint?
    @State private var localDown = false
    @State private var opacity = AWCCSSTransitionTrack()
    @State private var primed = false
    private var pointerHover: Bool { pointer.map { $0.location.map { frame.contains($0) && !(exclusion?.contains($0) ?? false) } ?? false } ?? hovered }
    /// A primary press inside the header (outside the chassis grip): `:active` from pointerdown until pointerup, as in
    /// Chrome. SwiftUI's `isPressed` alone arrives late on iOS 18 (the expressive press transition started frames
    /// after Chrome's) and ends when the pointer leaves the button.
    private var sourcePressed: Bool {
        if let pointer { return pointer.isPointerDown && pointer.pressLocation.map { frame.contains($0) && !(exclusion?.contains($0) ?? false) } == true }
        return localDown && localOrigin.map { !(exclusion?.contains(CGPoint(x: frame.minX + $0.x, y: frame.minY + $0.y)) ?? false) } == true
    }
    private var target: Double { isPressed || sourcePressed || gripPress != nil || focused ? 0.12 : pointerHover && !dragging ? 0.08 : 0 }
    private var origin: CGPoint? {
        if let gripPress { return gripPress }
        if let pointer, pointer.isPointerDown, let p = pointer.pressLocation { return .init(x: p.x - frame.minX, y: p.y - frame.minY) }
        return localDown ? localOrigin : nil
    }
    private func apply(_ next: Double) {
        // The first style is not a transition (no before-change style).
        guard primed else { opacity.snap(next); primed = true; return }
        opacity.set(next, now: CACurrentMediaTime() * 1000, duration: disabled ? 0 : timing.effects.duration, curve: timing.effects.curve)
    }
    private func stateLayer(_ now: Double) -> some View {
        let value = layer.opacity ?? (timing.effects.duration <= 0 || disabled ? target : opacity.presented(now))
        return Color.clear.modifier(AWCAccordionPartBox(value: layer, background: stateColor, stretch: true, applyOpacity: false))
            .awcInspect(nodeID: nodeID, part: "state-layer", parentPart: "header", name: "state-layer") { _ in ["opacity": .number(value), "renderTime": .number(now)] }
            .opacity(value)
    }
    var body: some View {
        label
            .overlay {
                if !disabled {
                    ZStack {
                        AWCNativeButtonRipple(pressed: isPressed || gripPress != nil, nativePressed: false, nativeActivation: 0,
                                              color: rippleColor, origin: origin, honorsReducedMotion: false)
                        if timing.effects.duration > 0 {
                            TimelineView(.animation(paused: !opacity.isRunning(CACurrentMediaTime() * 1000))) { _ in
                                stateLayer(CACurrentMediaTime() * 1000)
                            }
                        } else { stateLayer(CACurrentMediaTime() * 1000) }
                    }
                    .padding(border).allowsHitTesting(false)
                }
            }
            .overlay { if focused { AWCNativeCornerShape(corners: corners).strokeBorder(focusColor, lineWidth: 3).allowsHitTesting(false) } }
            .clipShape(AWCNativeCornerShape(corners: corners))
            .contentShape(Rectangle())
            .onContinuousHover(coordinateSpace: .named("awc-native-preview")) { phase in
                var next = false
                if case .active(let p) = phase { next = !(exclusion?.contains(p) ?? false) }
                if hovered != next { hovered = next }
            }
            .onGeometryChange(for: CGRect.self) { $0.frame(in: .named("awc-native-preview")) } action: { frame = $0 }
            .awcObservePointerOrigin(enabled: pointer == nil) { p, down in localOrigin = p; localDown = down }
            .onChange(of: target, initial: true) { _, next in apply(next) }
            // SwiftUI drops a second onChange in the same frame (e.g. a drop moving the header
            // under a still pointer); reconcile with the settled target afterwards.
            .task(id: target) { await Task.yield(); if !Task.isCancelled { apply(target) } }

    }
}

/// Drag grip: hover raises opacity to 1 and colour to the expanded headline
/// colour (effects transition) and scales to 1.08 (spring transition). A lifted
/// item loses hover; its grip keeps opacity 1 in the expanded icon colour.
struct AWCAccordionGrip: View {
    let size: Double, rest: Color, hoverColor: Color, draggingColor: Color
    let partColor: Color?, partOpacity: Double?, dragging: Bool, timing: AWCAccordionInteractionTiming
    let nodeID: String
    @Environment(\.awcNativePointerState) private var pointer
    @State private var hovered = false
    @State private var frame: CGRect = .zero
    @State private var opacity = AWCCSSTransitionTrack(initial: 0.55)
    @State private var scale = AWCCSSTransitionTrack(initial: 1)
    @State private var color = AWCCSSColorTrack()
    @State private var primed = false
    private var active: Bool { !dragging && (pointer.map { $0.location.map(frame.contains) ?? false } ?? hovered) }
    private struct Targets: Hashable { var opacity: Double, scale: Double, color: Color }
    private var targets: Targets { .init(opacity: dragging || active ? 1 : 0.55, scale: active ? 1.08 : 1, color: dragging ? draggingColor : active ? hoverColor : rest) }
    private func apply(_ next: Targets) {
        guard primed else { opacity.snap(next.opacity); scale.snap(next.scale); color.set(next.color, now: 0, duration: 0, curve: [0,0,1,1]); primed = true; return }
        let now = CACurrentMediaTime() * 1000
        opacity.set(next.opacity, now: now, duration: timing.effects.duration, curve: timing.effects.curve)
        color.set(next.color, now: now, duration: timing.effects.duration, curve: timing.effects.curve)
        scale.set(next.scale, now: now, duration: timing.spring.duration, curve: timing.spring.curve)
    }
    private func glyph(_ t: Double) -> some View {
        // Without a transition the computed style is the current target (no track state involved).
        let instant = timing.effects.duration <= 0, instantScale = timing.spring.duration <= 0
        let o = partOpacity ?? (instant ? targets.opacity : opacity.presented(t)), s = instantScale ? targets.scale : scale.presented(t)
        let c = partColor ?? (instant ? targets.color : color.presented(t) ?? rest)
        return AWCMaterialSymbol("drag_indicator", size: max(16, size)).frame(width: 24, height: 24)
            .foregroundStyle(c)
            .scaleEffect(s)
            .opacity(o)
            .awcInspect(nodeID: nodeID, part: "drag-handle-paint", parentPart: "drag-handle", name: "drag-handle-paint") { _ in
                let r = c.resolve(in: EnvironmentValues())
                return ["renderTime": .number(t), "opacity": .number(o), "scale": .number(s), "color": .array([.number(Double(r.red)), .number(Double(r.green)), .number(Double(r.blue)), .number(Double(r.opacity))])]
            }
    }
    var body: some View {
        let now = CACurrentMediaTime() * 1000
        // Structure depends only on the preset/reduced-motion timing, never on interaction
        // state: replacing views under a held grip would cancel its pointer capture. Instant
        // timing renders the current targets directly (a paused TimelineView keeps its frame).
        Group {
            if timing.effects.duration > 0 || timing.spring.duration > 0 {
                TimelineView(.animation(paused: !(opacity.isRunning(now) || scale.isRunning(now) || color.isRunning(now)))) { _ in
                    glyph(CACurrentMediaTime() * 1000)
                }
            } else { glyph(now) }
        }
        .onHover { hovered = $0 }
        .onGeometryChange(for: CGRect.self) { $0.frame(in: .named("awc-native-preview")) } action: { frame = $0 }
        .onChange(of: targets, initial: true) { _, next in apply(next) }
        .task(id: targets) { await Task.yield(); if !Task.isCancelled { apply(targets) } }
    }
}

