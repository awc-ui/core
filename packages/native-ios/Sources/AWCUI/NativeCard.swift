import SwiftUI
import QuartzCore

// MARK: Source model

/// md-card's class/attribute logic (md-card.tsx render) as a pure model.
struct AWCCardModel: Equatable {
    var variant = "elevated", interactive = false, dragEnabled = false, disabled = false, softDisabled = false
    var ripple = true, fullWidth = false, fullHeight = false, hidden = false
    var density: Double? = nil
    init(properties p: [String: AWCValue]) {
        variant = ["elevated", "filled", "outlined"].contains(p["variant"]?.string ?? "") ? p["variant"]!.string : "elevated"
        interactive = p["interactive"]?.bool ?? false; dragEnabled = p["dragEnabled"]?.bool ?? false
        disabled = p["disabled"]?.bool ?? false; softDisabled = p["softDisabled"]?.bool ?? false
        ripple = p["ripple"]?.bool ?? true; fullWidth = p["fullWidth"]?.bool ?? false; fullHeight = p["fullHeight"]?.bool ?? false
        hidden = p["hidden"]?.bool ?? false; density = p["density"]?.number
    }
    var effectivelyDisabled: Bool { disabled || softDisabled }
    /// md-card.css cursor cascade: `:host(.md-card--interactive)` pointer, `--draggable` grab, `--interactive.--draggable`
    /// grab (higher specificity), `--dragged` grabbing, `--disabled` default, `--interactive[soft-disabled]` default.
    func cursor(dragged: Bool) -> AWCCursorStyle? {
        // `:host(.md-card--disabled) { pointer-events: none }`: a hard-disabled interactive card has no own cursor.
        if interactive && disabled && !softDisabled { return nil }
        var best: (spec: Int, order: Int, style: AWCCursorStyle)?
        func rule(_ on: Bool, _ spec: Int, _ order: Int, _ style: AWCCursorStyle) { if on, best.map({ ($0.spec, $0.order) < (spec, order) }) ?? true { best = (spec, order, style) } }
        rule(interactive, 2, 1, .pointer); rule(dragEnabled, 2, 2, .grab); rule(interactive && dragEnabled, 3, 3, .grab)
        rule(dragged, 2, 4, .grabbing); rule(disabledClass, 2, 5, .default); rule(interactive && softDisabled, 3, 6, .default)
        return best?.style
    }
    /// `.md-card--disabled` (visual disabled) applies only to interactive cards.
    var disabledClass: Bool { interactive && effectivelyDisabled }
    /// `:host(.md-card--interactive[soft-disabled])`: pointer events stay on, state layer hidden.
    var softClass: Bool { interactive && softDisabled }
    /// Hard-disabled interactive cards get `pointer-events: none`.
    var pointerInert: Bool { interactive && disabled && !softDisabled }
    var hasStateLayer: Bool { interactive || dragEnabled }
    var hasRipple: Bool { hasStateLayer && ripple }
    func actsAsButton(interactiveContent: Bool) -> Bool { interactive && !interactiveContent }
}

/// Pseudo-class / drag inputs of the cascade.
struct AWCCardStates: Equatable, Hashable { var hover = false, focusVisible = false, active = false, dragged = false }

/// The source cascade, rule by rule in specificity and source order.
struct AWCCardStyle {
    let model: AWCCardModel, appearance: AWCCardAppearance, parts: AWCCardPartAppearance, tokens: [String: String]
    var forced: AWCForcedColorPalette? = nil
    func token(_ name: String, _ fallback: String) -> String { tokens["--md-sys-color-" + name] ?? fallback }
    func elevation(_ level: Int) -> [AWCBoxShadow] { AWCBoxShadow.source(tokens["--md-sys-elevation-\(level)"] ?? "none") ?? [] }
    static func mix(_ hex: String, _ alpha: Double) -> String {
        let c = Color(awcHex: hex).resolve(in: EnvironmentValues())
        return String(format: "#%02X%02X%02X%02X", Int((Double(c.red) * 255).rounded()), Int((Double(c.green) * 255).rounded()), Int((Double(c.blue) * 255).rounded()), Int((Double(c.opacity) * alpha * 255).rounded()))
    }
    var onSurface: String { token("on-surface", "#1C1B1F") }
    func layerOpacity(_ s: AWCCardStates) -> Double {
        guard model.hasStateLayer else { return 0 }
        var o = 0.0
        if s.dragged { o = 0.16 }                       // :host(.md-card--dragged) (0,3,0)
        if s.hover { o = 0.08 }                         // (0,4,0) in source order: hover,
        if s.focusVisible { o = 0.12 }                  // focus-visible,
        if s.active { o = 0.12 }                        // active,
        if model.disabledClass && (s.hover || s.active || s.focusVisible) { o = 0 }  // disabled overrides
        return o
    }
    var layerVisible: Bool { model.hasStateLayer && !model.softClass && forced == nil }
    func shadow(_ s: AWCCardStates) -> [AWCBoxShadow] {
        if model.disabledClass { return [] }            // !important
        let elevated = model.variant == "elevated"
        var e = appearance.containerElevation ?? (elevated ? elevation(1) : [])
        let pseudo = model.hasStateLayer
        if s.dragged && model.dragEnabled { e = elevation(elevated ? 4 : 3) }
        if pseudo && s.hover { e = elevation(elevated ? 2 : 1) }
        if pseudo && s.focusVisible { e = elevated ? elevation(1) : [] }
        if pseudo && s.active { e = elevated ? elevation(1) : [] }
        return e
    }
    var containerColor: String {
        if let forced { return forced.buttonFace }
        if model.disabledClass { return Self.mix(onSurface, 0.12) }
        return appearance.containerColor ?? token(model.variant == "filled" ? "surface-container-highest" : model.variant == "outlined" ? "surface" : "surface-container-low",
                                                  model.variant == "filled" ? "#E6E0E9" : model.variant == "outlined" ? "#FFFBFE" : "#F7F2FA")
    }
    var contentColor: String { forced.map { model.disabledClass ? $0.grayText : $0.buttonText } ?? (model.disabledClass ? Self.mix(onSurface, 0.38) : onSurface) }
    func outlineColor(_ s: AWCCardStates) -> String {
        if let part = parts.outlineColor { return part }
        var c = forced?.buttonText ?? appearance.outlineColor ?? token("outline-variant", "#CAC4D0")
        if s.dragged { c = token("outline-variant", "#CAC4D0") }
        if model.disabledClass { c = Self.mix(onSurface, 0.12) }
        if model.hasStateLayer && s.focusVisible { c = onSurface }
        return c
    }
    var outlineWidth: Double { parts.outlineWidth ?? appearance.outlineWidth ?? 1 }
    var stateLayerColor: String { parts.stateLayerColor ?? appearance.stateLayerColor ?? onSurface }
    var focusRingColor: String { forced?.highlight ?? token("secondary", "#625B71") }
    /// forced-colors: `border: 1px solid ButtonText` (GrayText when disabled) on the host.
    var forcedBorder: String? { forced.map { model.disabledClass ? $0.grayText : $0.buttonText } }
}

/// Composed-content interactivity (`INTERACTIVE_CONTENT_SELECTOR`), from the authored node tree.
enum AWCCardContent {
    static let tags: Set<String> = ["md-button", "md-icon-button", "md-fab", "md-checkbox", "md-switch", "md-radio", "md-chip", "md-select", "md-multi-select",
                                    "md-text-field", "md-slider", "md-segmented-button", "md-menu-button", "md-link", "md-autocomplete", "summary", "iframe"]
    static let roles: Set<String> = ["button", "link", "checkbox", "radio", "switch", "tab", "menuitem", "menuitemcheckbox", "menuitemradio", "option", "slider",
                                     "spinbutton", "textbox", "combobox", "searchbox"]
    static func isInteractive(_ n: AWCNode) -> Bool {
        let p = n.properties
        if p["hidden"]?.bool == true || p["inert"]?.bool == true { return false }
        if let t = p["tabindex"]?.number { return t >= 0 }
        if tags.contains(n.tag) { return true }
        if ["button", "select", "textarea"].contains(n.tag) { return p["disabled"]?.bool != true }
        if n.tag == "input" { return p["disabled"]?.bool != true && p["type"]?.string != "hidden" }
        if n.tag == "a" || n.tag == "area" { return !(p["href"]?.string ?? "").isEmpty }
        if ["audio", "video"].contains(n.tag) { return p["controls"]?.bool == true }
        if let ce = p["contenteditable"]?.string, ["true", "", "plaintext-only"].contains(ce) { return true }
        if let r = p["role"]?.string, roles.contains(r) { return true }
        return false
    }
    static func contains(_ nodes: [AWCNode]) -> Bool {
        nodes.contains { n in
            if n.properties["hidden"]?.bool == true || n.properties["inert"]?.bool == true { return false }
            return isInteractive(n) || contains(n.children)
        }
    }
}

// MARK: Transitions

func awcCardHex(_ c: Color) -> String {
    let r = c.resolve(in: EnvironmentValues())
    func b(_ v: Float) -> Int { Int((min(1, max(0, Double(v))) * 255).rounded()) }
    return String(format: "#%02X%02X%02X%02X", b(r.red), b(r.green), b(r.blue), b(r.opacity))
}
/// CSS box-shadow list interpolation: lists padded with transparent layers, per-component
/// lengths, premultiplied colours; mismatched inset makes the whole list discrete.
func awcCardInterpolate(_ a: [AWCBoxShadow], _ b: [AWCBoxShadow], _ t: Double) -> [AWCBoxShadow] {
    if t <= 0 { return a }; if t >= 1 { return b }
    let n = max(a.count, b.count)
    let pa = (0..<n).map { $0 < a.count ? a[$0] : AWCBoxShadow(color: "#00000000", inset: b[$0].inset) }
    let pb = (0..<n).map { $0 < b.count ? b[$0] : AWCBoxShadow(color: "#00000000", inset: a[$0].inset) }
    if zip(pa, pb).contains(where: { $0.inset != $1.inset }) { return t < 0.5 ? a : b }
    return zip(pa, pb).map { x, y in
        func l(_ u: Double, _ v: Double) -> Double { u + (v - u) * t }
        return AWCBoxShadow(x: l(x.x, y.x), y: l(x.y, y.y), blur: max(0, l(x.blur, y.blur)), spread: l(x.spread, y.spread),
                            color: awcCardHex(awcInterpolatedColor(Color(awcHex: x.color), Color(awcHex: y.color), t)), inset: x.inset)
    }
}
struct AWCCardShadowTrack {
    private(set) var value: [AWCBoxShadow]?
    private var from: [AWCBoxShadow] = []
    private var reversing: [AWCBoxShadow]?
    private(set) var running: AWCCSSTransition?
    func presented(_ now: Double) -> [AWCBoxShadow] {
        guard let value else { return [] }
        guard let running, now < running.end else { return value }
        return awcCardInterpolate(from, value, running.outputProgress(now))
    }
    func isRunning(_ now: Double) -> Bool { running.map { now < $0.end } ?? false }
    mutating func set(_ target: [AWCBoxShadow], now: Double, duration: Double, curve: [Double]) {
        guard let old = value else { value = target; return }
        if old == target { return }
        let current = presented(now)
        var factor = 1.0, nextReversing = current
        if let running, now < running.end, reversing == target {
            factor = min(1, max(0, abs(running.outputProgress(now) * running.shortening + 1 - running.shortening))); nextReversing = old
        }
        value = target
        guard duration > 0 else { running = nil; return }
        from = current; reversing = nextReversing
        running = AWCCSSTransition(from: 0, to: 1, start: now, duration: duration * factor, curve: curve, reversingAdjustedStart: 0, shortening: factor)
    }
}

// MARK: Layout

/// Column flex box with border-box sizing: explicit/percentage width and height (100% for
/// full-width/height), min wins over max, auto width fills the proposal (block level),
/// auto height wraps the content, padding is physical and children stretch.
struct AWCCardLayout: Layout {
    let padding: AWCCardInsets, gap: Double, fontSize: Double
    let width: AWCCardLength?, minWidth: AWCCardLength?, maxWidth: AWCCardLength?
    let height: AWCCardLength?, minHeight: AWCCardLength?, maxHeight: AWCCardLength?
    func resolve(_ l: AWCCardLength?, _ basis: CGFloat?) -> Double? {
        guard let l else { return nil }
        if l.fraction != 0 && (basis == nil || !basis!.isFinite) { return nil }
        return l.points + l.fraction * Double(basis ?? 0) + l.em * fontSize + l.rem * 16 + l.ch * fontSize * 0.5
    }
    private func childHeights(_ subviews: Subviews, _ w: Double) -> [Double] { subviews.map { Double($0.sizeThatFits(.init(width: w, height: nil)).height) } }
    func geometry(_ proposal: ProposedViewSize, _ subviews: Subviews) -> (CGSize, [Double]) {
        let padH = padding.left + padding.right, padV = padding.top + padding.bottom
        var w: Double
        if let v = resolve(width, proposal.width) { w = v }
        else if let pw = proposal.width, pw.isFinite { w = Double(pw) }
        else { w = (subviews.map { Double($0.sizeThatFits(.unspecified).width) }.max() ?? 0) + padH }
        if let mx = resolve(maxWidth, proposal.width) { w = min(w, mx) }
        if let mn = resolve(minWidth, proposal.width) { w = max(w, mn) }
        w = max(w, padH)
        let heights = childHeights(subviews, max(0, w - padH))
        let content = heights.reduce(0, +) + gap * Double(max(0, heights.count - 1))
        var h = resolve(height, proposal.height) ?? (content + padV)
        if let mx = resolve(maxHeight, proposal.height) { h = min(h, mx) }
        if let mn = resolve(minHeight, proposal.height) { h = max(h, mn) }
        return (CGSize(width: w, height: max(h, padV)), heights)
    }
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize { geometry(proposal, subviews).0 }
    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let heights = childHeights(subviews, max(0, Double(bounds.width) - padding.left - padding.right))
        var y = Double(bounds.minY) + padding.top
        for (index, subview) in subviews.enumerated() {
            subview.place(at: .init(x: Double(bounds.minX) + padding.left, y: y), anchor: .topLeading,
                          proposal: .init(width: max(0, Double(bounds.width) - padding.left - padding.right), height: heights[index]))
            y += heights[index] + gap
        }
    }
}

/// Frames (global) of authored interactive content, where a press never starts a drag.
struct AWCCardInteractiveRegionsKey: PreferenceKey {
    static var defaultValue: [CGRect] { [] }
    static func reduce(value: inout [CGRect], nextValue: () -> [CGRect]) { value.append(contentsOf: nextValue()) }
}
struct AWCCardInteractiveRegion: ViewModifier {
    let active: Bool
    func body(content: Content) -> some View {
        content.background { if active { GeometryReader { g in Color.clear.preference(key: AWCCardInteractiveRegionsKey.self, value: [g.frame(in: .global)]) } } }
    }
}

// MARK: Renderer

struct AWCCardPendingMove: Equatable { let token: Int; let offset: CGSize; let detail: AWCValue }
final class AWCCardLifecycle { var attached = true }

struct AWCNativeCard<Content: View>: View {
    let node: AWCNode, theme: AWCTheme, interactiveContent: Bool, label: String
    let emit: (String, AWCValue) -> Void
    @ViewBuilder let content: () -> Content
    @Environment(\.awcCardAppearance) private var inheritedAppearance
    @Environment(\.awcCardAppearanceTargets) private var appearanceTargets
    @Environment(\.awcCardPartAppearance) private var inheritedParts
    @Environment(\.awcCardPartAppearanceTargets) private var partTargets
    @Environment(\.awcNativeDensity) private var inheritedDensity
    @Environment(\.awcNativePointerState) private var pointer
    @Environment(\.accessibilityReduceMotion) private var systemReduced
    @Environment(\.awcCardReducedMotion) private var reducedOverride
    @Environment(\.layoutDirection) private var direction
    @Environment(\.awcForcedColors) private var forced
    @State private var focusHandle = AWCButtonFocusHandle()
    @State private var hovered = false
    @State private var frame: CGRect = .zero
    @State private var globalFrame: CGRect = .zero
    @State private var pressed = false
    @State private var pressOrigin: CGPoint?
    @State private var activation = 0
    @State private var drag: (start: CGPoint, started: Bool, armed: Bool)?
    @State private var offset: CGSize = .zero
    @State private var dragging = false
    @State private var regions: [CGRect] = []
    @State private var layer = AWCCSSTransitionTrack()
    @State private var shadowTrack = AWCCardShadowTrack()
    @State private var background = AWCCSSColorTrack()
    @State private var primed = false
    /// The move paired with mdDragStart, held until the view update that follows the start event, where
    /// a start handler's property changes (disable, drag off, removal) apply, like the source's
    /// synchronous re-entrancy guard. A pointer event arriving first flushes it in order.
    @State private var pendingMove: AWCCardPendingMove?
    @State private var moveToken = 0
    /// Reference state the gesture closures can still read after the view leaves the hierarchy.
    @State private var lifecycle = AWCCardLifecycle()

    private var model: AWCCardModel { AWCCardModel(properties: node.properties) }
    private var appearance: AWCCardAppearance { inheritedAppearance.merging(appearanceTargets[node.id] ?? .init()) }
    private var parts: AWCCardPartAppearance { inheritedParts.merging(partTargets[node.id] ?? .init()) }
    private var style: AWCCardStyle { .init(model: model, appearance: appearance, parts: parts, tokens: theme.tokens, forced: forced) }
    private var density: Double { AWCNativeDensity.resolve(model.density, inherited: inheritedDensity) }
    private var reduced: Bool { reducedOverride ?? systemReduced }
    private var actsAsButton: Bool { model.actsAsButton(interactiveContent: interactiveContent) }
    private var hover: Bool {
        guard !model.pointerInert else { return false }
        let shifted = frame.offsetBy(dx: offset.width, dy: offset.height)
        return pointer.map { $0.location.map(shifted.contains) ?? false } ?? hovered
    }
    private var states: AWCCardStates {
        // A host-reported press over the card is :active in the same style pass as its :hover.
        let hostPress = pointer.map { $0.isPointerDown && hover } ?? false
        return .init(hover: hover, focusVisible: actsAsButton && focusHandle.isFocusVisible, active: (pressed || hostPress) && !model.pointerInert, dragged: dragging)
    }
    private struct Targets: Equatable { var layer: Double, shadow: [AWCBoxShadow], background: String }
    private var targets: Targets { .init(layer: style.layerOpacity(states), shadow: style.shadow(states), background: style.containerColor) }
    private func apply(_ next: Targets) {
        guard primed else { layer.snap(next.layer); shadowTrack.set(next.shadow, now: 0, duration: 0, curve: [0, 0, 1, 1])
            background.set(Color(awcHex: next.background), now: 0, duration: 0, curve: [0, 0, 1, 1]); primed = true; return }
        let now = CACurrentMediaTime() * 1000, curve = awcCSSCubicBezier(theme.tokens["--md-sys-motion-easing-standard"]) ?? [0.2, 0, 0, 1]
        let short1 = reduced ? 0 : awcCSSDuration(theme.tokens["--md-sys-motion-duration-short1"]) ?? 100
        let short2 = reduced ? 0 : awcCSSDuration(theme.tokens["--md-sys-motion-duration-short2"]) ?? 200
        layer.set(next.layer, now: now, duration: short1, curve: curve)
        shadowTrack.set(next.shadow, now: now, duration: short2, curve: curve)
        background.set(Color(awcHex: next.background), now: now, duration: short2, curve: curve)
    }
    private func running(_ now: Double) -> Bool { layer.isRunning(now) || shadowTrack.isRunning(now) || background.isRunning(now) }

    var body: some View {
        if model.hidden { EmptyView() } else {
            let now = CACurrentMediaTime() * 1000
            TimelineView(.animation(paused: !running(now))) { _ in card(CACurrentMediaTime() * 1000) }
                // translate() is physical: SwiftUI mirrors an x offset under right-to-left.
                .offset(x: direction == .rightToLeft ? -offset.width : offset.width, y: offset.height)
                // `z-index: 1000` while dragging stacks against the document (r3-19): the hosts above rise with it.
                .modifier(AWCStackingLift(own: dragging ? 1000 : 0, publish: true))
                .onChange(of: targets, initial: true) { _, next in apply(next) }
                .task(id: targets) { await Task.yield(); if !Task.isCancelled { apply(targets) } }
                .onChange(of: model) { _, next in if next.effectivelyDisabled || !next.dragEnabled { cancelDrag() } }
                .onChange(of: pendingMove?.token) { _, token in if token != nil { flushMove() } }
                .onAppear { lifecycle.attached = true }
                .onDisappear { lifecycle.attached = false; cancelDrag() }
        }
    }

    private func card(_ t: Double) -> some View {
        let style = style, model = model, d = density, corners = appearance.containerShape ?? .points(12)
        let shape = AWCNativeCornerShape(corners: corners)
        let fontSize = max(12, 14 + 0.5 * d), lineHeight = max(16, 20 + d)
        let padding = appearance.padding ?? .init(max(8, 16 + 2 * d)), gap = appearance.gap ?? max(4, 8 + d)
        let opacity = reduced ? targets.layer : layer.presented(t)
        let shadow = shadowTrack.presented(t), fill = background.presented(t) ?? Color(awcHex: style.containerColor)
        let ink = Color(awcHex: style.contentColor), outline = style.outlineColor(states)
        let ring = model.interactive && actsAsButton && focusHandle.isFocusVisible
        return AWCCardLayout(padding: padding, gap: gap, fontSize: fontSize, width: model.fullWidth ? .fraction(1) : appearance.width, minWidth: appearance.minWidth,
                             maxWidth: appearance.maxWidth, height: model.fullHeight ? .fraction(1) : appearance.height, minHeight: appearance.minHeight, maxHeight: appearance.maxHeight) {
            // A keyboard/assistive activation of authored content is a click that bubbles to the
            // card in the source (`mdClick` with detail 0); pointer clicks reach the card gesture.
            AWCEventScope(id: node.id + ".content", onEvent: { context in
                guard context.event.name == "mdClick", context.targetID != node.id, model.interactive, !model.effectivelyDisabled,
                      let source = context.activation?.source, source == .keyboard || source == .accessibility else { return }
                emit("mdClick", ["type": "click", "isTrusted": true, "button": 0, "detail": 0, "clientX": 0, "clientY": 0])
            }) { content().environment(\.awcTextInk, ink).environment(\.awcTextLineBox, CGSize(width: fontSize, height: lineHeight)) }
        }
        .font(AWCNativeFonts.label(size: fontSize, weight: 400)).tracking(0.25).lineSpacing(max(0, lineHeight - fontSize * 1.171875))
        .foregroundStyle(ink)
        .onPreferenceChange(AWCCardInteractiveRegionsKey.self) { regions = $0 }
        .background(shape.fill(fill))
        .overlay {
            if model.hasRipple && !model.effectivelyDisabled {
                AWCNativeButtonRipple(pressed: pressed, nativePressed: false, nativeActivation: activation, color: ink, origin: pressOrigin,
                                      honorsReducedMotion: false, inspectNodeID: node.id)
            }
        }
        .overlay { if model.variant == "outlined" { shape.strokeBorder(Color(awcHex: outline), lineWidth: style.outlineWidth).allowsHitTesting(false) } }
        .overlay {
            if style.layerVisible {
                Color(awcHex: style.stateLayerColor).opacity(opacity).allowsHitTesting(false)
                    .awcInspect(nodeID: node.id, part: "state-layer", name: "state-layer") { _ in ["opacity": .number(opacity), "renderTime": .number(t)] }
            }
        }
        .compositingGroup().clipShape(shape)
        .modifier(AWCForcedHostBorder(width: 1, color: style.forcedBorder, fill: style.forced?.buttonFace, corners: corners))
        .background { AWCNativeBoxShadow(corners: corners, layers: shadow, placement: .outer) }
        .overlay { if ring { shape.inset(by: -3.5).stroke(Color(awcHex: style.focusRingColor), lineWidth: 3).allowsHitTesting(false) } }
        .contentShape(shape)
        .onGeometryChange(for: CGRect.self) { $0.frame(in: .named("awc-native-preview")) } action: { frame = $0 }
        .onGeometryChange(for: CGRect.self) { $0.frame(in: .global) } action: { globalFrame = $0 }
        .onContinuousHover(coordinateSpace: .global) { phase in
            var next = false; if case .active = phase { next = true }; if hovered != next { hovered = next }
        }
        .simultaneousGesture(pointerGesture)
        .allowsHitTesting(!model.pointerInert)
        .awcFocusBridgeLayer {
            if actsAsButton {
                AWCNativeButtonFocusBridge(configuration: .init(id: node.id, label: label, policy: AWCButtonAccessibilityPolicy(properties: node.properties), group: nil, cell: nil,
                    handle: focusHandle, focusChanged: { _ in }, activate: { keyboardActivate() },
                    // iOS: :active from the raw touch, synchronously in sendEvent (the DragGesture reports touch-down a frame
                    // later; Chrome's pointerdown paints the press in the next frame). The gesture keeps drag and click.
                    touchPress: .init(began: { p in
                        guard !model.pointerInert else { return false }
                        pressed = true; pressOrigin = p; _ = focusHandle.requestPointerFocus?(); return true
                    }, ended: { _ in pressed = false }, cancelled: {}), grabbed: model.dragEnabled ? dragging : nil))
            }
        }
        .accessibilityElement(children: actsAsButton ? .ignore : .contain)
        .accessibilityHidden(actsAsButton)
        .awcContainerAccessibility(identifier: node.id, model.dragEnabled && !actsAsButton ? .init(grabbed: dragging) : nil)
        .awcCursor(model.cursor(dragged: dragging))
        .awcInspect(nodeID: node.id, name: "md-card") { _ in
            func rgba(_ c: Color) -> AWCValue { let r = c.resolve(in: EnvironmentValues()); return .array([.number(Double(r.red)), .number(Double(r.green)), .number(Double(r.blue)), .number(Double(r.opacity))]) }
            return ["renderTime": .number(t), "layerOpacity": .number(style.layerVisible ? opacity : -1),
                    "shadow": .array(shadow.flatMap { s -> [AWCValue] in let c = Color(awcHex: s.color).resolve(in: EnvironmentValues())
                        return [.number(s.x), .number(s.y), .number(s.blur), .number(s.spread), .number(Double(c.red)), .number(Double(c.green)), .number(Double(c.blue)), .number(Double(c.opacity))] }),
                    "background": rgba(fill), "color": rgba(ink), "outlineColor": rgba(Color(awcHex: outline)), "outlineWidth": .number(model.variant == "outlined" ? style.outlineWidth : 0),
                    "focusRing": .bool(ring), "dragging": .bool(dragging), "offsetX": .number(offset.width), "offsetY": .number(offset.height), "zIndex": .number(dragging ? 1000 : 0),
                    "role": .string(actsAsButton ? "button" : ""), "tabindex": .number(actsAsButton ? (model.disabled ? -1 : 0) : -2),
                    "focused": .bool(focusHandle.isFocused), "hover": .bool(states.hover), "active": .bool(states.active),
                    "padding": .array([.number(padding.top), .number(padding.right), .number(padding.bottom), .number(padding.left)]), "gap": .object(["row": .number(gap), "column": .number(0)]), "contentGap": .number(gap),
                    "fontSize": .number(fontSize), "lineHeight": .number(lineHeight)]
        }
    }

    // MARK: Pointer, drag and activation

    private var pointerGesture: some Gesture {
        DragGesture(minimumDistance: 0, coordinateSpace: .global)
            .onChanged { value in
                if drag == nil { begin(value.startLocation) }
                move(value.location)
            }
            .onEnded { value in end(value.location) }
    }
    private func detail(_ p: CGPoint, _ start: CGPoint) -> AWCValue {
        ["clientX": .number(p.x), "clientY": .number(p.y), "offsetX": .number(p.x - start.x), "offsetY": .number(p.y - start.y), "startX": .number(start.x), "startY": .number(start.y)]
    }
    private func begin(_ p: CGPoint) {
        guard !model.pointerInert else { return }
        pressed = true
        pressOrigin = CGPoint(x: p.x - globalFrame.minX, y: p.y - globalFrame.minY)
        if actsAsButton { _ = focusHandle.requestPointerFocus?() }
        let onContent = regions.contains { $0.contains(p) }
        drag = (p, false, model.dragEnabled && !model.effectivelyDisabled && !onContent)
    }
    private func move(_ p: CGPoint) {
        flushMove()
        guard lifecycle.attached, var state = drag, state.armed else { return }
        let dx = p.x - state.start.x, dy = p.y - state.start.y
        if !state.started {
            if abs(dx) + abs(dy) < 5 { return }
            state.started = true; drag = state; dragging = true
            emit("mdDragStart", detail(p, state.start))
            // A start handler may disable, turn off or remove the card: its paired move waits for the
            // next view update (`flushMove`), where those changes are visible.
            moveToken &+= 1
            pendingMove = .init(token: moveToken, offset: CGSize(width: dx, height: dy), detail: detail(p, state.start))
            return
        }
        offset = CGSize(width: dx, height: dy)
        emit("mdDragMove", detail(p, state.start))
    }
    private func flushMove() {
        guard let pending = pendingMove else { return }
        pendingMove = nil
        guard lifecycle.attached, let state = drag, state.armed, state.started, !model.effectivelyDisabled, model.dragEnabled else { return }
        offset = pending.offset
        emit("mdDragMove", pending.detail)
    }
    private func end(_ p: CGPoint) {
        flushMove()
        // A card removed during the gesture (for example by its start handler) reports nothing more.
        guard lifecycle.attached else { drag = nil; pressed = false; dragging = false; offset = .zero; return }
        let state = drag
        drag = nil; pressed = false
        if let state, state.armed, state.started {
            emit("mdDragEnd", detail(p, state.start))
            dragging = false; offset = .zero
            return
        }
        dragging = false; offset = .zero
        // A click reaches the card when press and release share it (released over the card).
        guard model.interactive, state != nil, globalFrame.contains(p), !model.effectivelyDisabled else { return }
        emit("mdClick", ["type": "click", "isTrusted": true, "button": 0, "detail": 1, "clientX": .number(p.x), "clientY": .number(p.y)])
    }
    private func cancelDrag() {
        pendingMove = nil
        guard drag != nil || dragging else { return }
        if var state = drag { state.armed = false; state.started = false; drag = state }
        dragging = false; offset = .zero
    }
    /// Enter/Space on the card itself: centred ripple, then an untrusted keyboard click.
    private func keyboardActivate() {
        guard model.interactive, !model.effectivelyDisabled, actsAsButton else { return }
        if model.hasRipple { activation &+= 1 }
        emit("mdClick", ["type": "click", "isTrusted": false, "button": 0, "detail": 0, "clientX": 0, "clientY": 0])
    }
}

extension AWCNativeView {
    /// md-card: the dedicated renderer over the default slot (the only source slot).
    var nativeCard: some View {
        let children = node.children(inSlot: nil)
        return AWCNativeCard(node: node, theme: theme, interactiveContent: AWCCardContent.contains(children), label: node.authoredTextContent.trimmingCharacters(in: .whitespacesAndNewlines),
                             emit: { name, detail in emit(name, detail) }) {
            ForEach(children) { item in
                child(item).frame(maxWidth: .infinity, alignment: .leading).modifier(AWCCardInteractiveRegion(active: AWCCardContent.contains([item])))
            }
        }
    }
}
