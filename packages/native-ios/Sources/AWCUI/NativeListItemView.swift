import SwiftUI
import QuartzCore

/// One md-list-item: row chrome, state layer, ripple, focus, morph, panel and events.
/// See `AWCNativeListItemView.renderShift`.
final class AWCListRenderShift { var dy: CGFloat = 0 }

struct AWCNativeListItemView: View {
    let node: AWCNode, theme: AWCTheme, ctx: AWCListItemContext?, runtime: AWCListRuntime?
    let emitItem: (String, String, AWCValue) -> Void
    let renderChild: (AWCNode) -> AnyView
    var onPanelClick: ((AWCNode) -> Void)? = nil
    @Environment(\.awcListItemAppearance) private var inherited
    @Environment(\.awcListItemAppearanceTargets) private var targets
    @Environment(\.awcListItemPartAppearance) private var parts
    @Environment(\.awcNativeDensity) private var inheritedDensity
    @Environment(\.awcListSpacingRung) private var inheritedRung
    @Environment(\.awcNativeSpacingRung) private var spacingRung
    @Environment(\.awcNativePointerState) private var pointer
    @Environment(\.accessibilityReduceMotion) private var systemReduced
    @Environment(\.awcListReducedMotion) private var reducedOverride
    @Environment(\.awcListShapeMorph) private var morph
    @Environment(\.layoutDirection) private var direction
    @Environment(\.awcListAuthoredBoxes) private var authoredBoxes
    @State private var focusHandle = AWCButtonFocusHandle()
    @State private var hovered = false
    @State private var frame: CGRect = .zero
    @State private var rowFrame: CGRect = .zero
    /// The row's drag/shift translation at the last render. Boxes measured inside the translated row are stored without
    /// it: stored with it, every render of a gliding row (sibling shift, 200 ms) changed @State its body reads, and on
    /// iOS SwiftUI re-rendered the row in a tight loop (≈10 000 updates per glide) that starved other animation
    /// timelines — the drop placeholder's glide started ~210 ms late. The translation is cleared at the drop.
    @State private var renderShift = AWCListRenderShift()
    @State private var globalFrame: CGRect = .zero
    @State private var caretFrame: CGRect = .zero
    /// Positioned parts that paint above the ripple and state layer in the source (image-wrap, the caret host).
    @State private var caretNamed: CGRect = .zero
    @State private var caretHover = false
    @State private var headlineTruncated = false
    /// A host-pointer press reaches the style one frame after it starts (Chrome applies :active at its next
    /// frame), so a press that ends before then never does.
    @State private var pressMature = false
    @State private var supportingTruncated = false
    @State private var imageNamed: CGRect = .zero
    /// md-avatar's image failed to load (its `error`): the avatar shows its initials, else the person icon.
    @State private var avatarFailed = false
    @State private var trailingFrames: [String: CGRect] = [:]
    @State private var caretFocus = AWCButtonFocusHandle()
    @State private var focusWithin = AWCListItemFocusWithin()
    @State private var held = false
    @State private var keyPressed = false
    @State private var pressOrigin: CGPoint?
    @State private var activation = 0
    @State private var press: CGPoint?
    @State private var localExpanded: Bool?
    @State private var corners = [AWCCSSTransitionTrack(), AWCCSSTransitionTrack(), AWCCSSTransitionTrack(), AWCCSSTransitionTrack()]
    @State private var layer = AWCCSSTransitionTrack()
    @State private var panel = AWCCSSTransitionTrack()
    @State private var inner = AWCCSSTransitionTrack()
    @State private var caret = AWCCSSTransitionTrack()
    @State private var panelHeight: CGFloat = 0
    @State private var shiftTrack = AWCCSSTransitionTrack()
    @State private var shadowTrack = AWCCSSTransitionTrack()
    @State private var handleOpacity = AWCCSSTransitionTrack()
    @State private var handleInk = AWCCSSTransitionTrack()
    @State private var handleScale = AWCCSSTransitionTrack()
    @State private var handleFrame: CGRect = .zero
    @State private var handleFrameNamed: CGRect = .zero
    @State private var handleHoverLocal = false
    /// Where a reordering drop happened: the re-inserted row's drag handle is not hovered until the pointer
    /// moves, and the row itself rests for the drop frame before Chrome re-applies `:hover` (with its transition).
    @State private var dropAt: CGPoint?
    @State private var dragging = false
    @State private var controlPress = false
    @State private var handle = AWCListItemHandle()
    @Environment(\.awcListItemControllers) private var itemControllers
    @State private var primed = false

    private var model: AWCListItemModel { .init(properties: node.properties) }
    /// The list's roving tab stop; rows in a parent's expanded panel keep their own (tabindex 0).
    private var tabbable: Bool { ctx?.inPanel == true ? true : runtime.map { $0.activeID == node.id } ?? true }
    private var expanded: Bool { model.expandable && (localExpanded ?? runtime?.expanded[node.id] ?? model.expanded) }
    private var selected: Bool { runtime?.isSelected(node.id, fallback: model.selected) ?? model.selected }
    private var reduced: Bool { reducedOverride ?? systemReduced }
    private var hasSlot: (String) -> Bool { { s in node.children(inSlot: s).contains { $0.tag != "#text" || !($0.properties["text"]?.string ?? "").isEmpty } } }
    private var leadingVideo: Bool { node.children(inSlot: "leading").contains { $0.tag == "video" } }
    private var style: AWCListItemStyle {
        let local = model.density
        let scale = AWCNativeDensity.resolve(local, inherited: inheritedDensity)
        let rung = (local ?? 0) <= -2 ? local! : (inheritedRung ?? spacingRung)
        return .init(model: model, ctx: ctx, inline: targets[node.id] ?? .init(), inherited: inherited, tokens: theme.tokens, rtl: direction == .rightToLeft,
                     density: scale, rung: rung, selected: selected, expanded: expanded, slottedOverline: hasSlot("overline"), slottedSupporting: hasSlot("supporting-text"),
                     leadingVideo: leadingVideo, morph: morph)
    }
    private var hover: Bool {
        // After a reordering drop the other rows' frames are stale for one frame (they still hold the pre-drop layout under the
        // pointer): Chrome re-hit-tests the re-inserted DOM and hovers none of them (C65-01).
        guard style.interactive, !hoverHeld, !staleUnderDrop else { return false }
        // `.md-list-item__row:hover` drives the layer: hovering the expanded panel does not.
        return pointer.map { $0.location.map(rowFrame.contains) ?? false } ?? hovered
    }
    private var states: AWCListItemStates {
        // `:active` stays on the row that took the press (a sibling sliding under it during a drag is not pressed).
        let ownsPress: Bool = runtime?.dragID == nil || runtime?.dragID == node.id
        let s = style, hostPress = ownsPress && (pointer.map { p in p.isPointerDown && p.pressLocation.map(rowFrame.contains) == true } ?? false)
        // With a host pointer stream the press is read from it, so a press that ends before the next update never
        // reaches the style (SwiftUI may deliver the gesture's end an update later).
        let down = pointer != nil ? (hostPress && pressMature) || (isDragged && pointer?.isPointerDown == true) : (held || hostPress)
        let pressed = down && s.interactive && !s.disabledClass
        let roving = (model.rovingFocusVisible || runtime?.rovingVisibleID == node.id) && !focusHandle.isFocused
        return .init(hover: hover, active: down && s.interactive, pressed: pressed || keyPressed, focusVisible: focusHandle.isFocusVisible,
                     roving: roving, dragged: isDragged)
    }
    private var isDragged: Bool { runtime?.dragID == node.id && runtime != nil }
    /// No hover while another row is dragged (the source captures the pointer on the handle). 9-31: no drop rest;
    /// staleUnderDrop guards the stale pointer of the re-inserted row (job 035: no rest crosses on time in 4 of 5 pairs, rest 4 ms in 1 of 5).
    private var hoverHeld: Bool {
        if let drag = runtime?.dragID, drag != node.id { return true }
        return false
    }
    private var staleUnderDrop: Bool {
        guard dropAt == nil, runtime?.dropShifted.contains(node.id) == true, let d = runtime?.dropPoint, let p = pointer?.location else { return false }
        return abs(p.x - d.x) < 0.5 && abs(p.y - d.y) < 0.5
    }
    private var handleStill: Bool {
        guard let d = dropAt else { return false }
        if let p = pointer { return p.location.map { abs($0.x - d.x) < 0.5 && abs($0.y - d.y) < 0.5 } ?? false }
        return true
    }
    private var handleHovered: Bool {
        guard style.reorderable, runtime?.dragID == nil, !hoverHeld, !handleStill else { return false }
        return pointer.map { $0.location.map(handleFrameNamed.contains) ?? false } ?? handleHoverLocal
    }
    private struct Targets: Equatable { var corners: [Double], layer: Double, active: Bool, expanded: Bool, shift: Double, lifting: Bool, dragged: Bool, handle: [Double], gen = 0 }
    private var targetValues: Targets {
        let s = style, st = states, d = isDragged, h = handleHovered
        return .init(corners: s.corners(st), layer: s.layerOpacity(st), active: s.stateShape(st) != nil, expanded: expanded, shift: runtime?.shift(node.id) ?? 0,
                     lifting: runtime?.dragID != nil, dragged: d, handle: d ? [1, 1, 1] : h ? [1, 1, reduced ? 1 : 1.08] : [0.55, 0, 1],
                     gen: runtime?.reinsertions[node.id] ?? 0)
    }
    private func apply(_ next: Targets) {
        let a = style.a
        let moved = runtime?.snapNext.remove(node.id) != nil
        if !primed || moved {
            // A reordered row is re-inserted in the source: it restarts from its resting style (no transitions)
            // and its interactive states (focus, hover) then transition in from there.
            let rest = AWCListItemStates(), base = moved && primed ? Targets(corners: style.corners(rest), layer: style.layerOpacity(rest), active: false, expanded: next.expanded,
                                                                   shift: next.shift, lifting: next.lifting, dragged: false, handle: [0.55, 0, 1]) : next
            for i in 0..<4 { corners[i].snap(base.corners[i]) }; layer.snap(base.layer); panel.snap(base.expanded ? 1 : 0); inner.snap(base.expanded ? 1 : 0)
            caret.snap(base.expanded ? 1 : 0); shiftTrack.snap(base.shift); shadowTrack.snap(base.dragged ? 1 : 0)
            handleOpacity.snap(base.handle[0]); handleInk.snap(base.handle[1]); handleScale.snap(base.handle[2])
            let wasPrimed = primed; primed = true
            if !(moved && wasPrimed) { return }
        }
        let now = CACurrentMediaTime() * 1000
        let standard = awcCSSCubicBezier(theme.tokens["--md-sys-motion-easing-standard"]) ?? [0.2, 0, 0, 1]
        let decel = awcCSSCubicBezier(theme.tokens["--md-sys-motion-easing-emphasized-decelerate"]) ?? [0.05, 0.7, 0.1, 1]
        let accel = awcCSSCubicBezier(theme.tokens["--md-sys-motion-easing-emphasized-accelerate"]) ?? [0.3, 0, 0.8, 0.15]
        let shape = reduced ? 0 : (next.active ? 200.0 : 400.0)
        for i in 0..<4 { corners[i].set(next.corners[i], now: now, duration: shape, curve: next.active ? standard : decel) }
        layer.set(next.layer, now: now, duration: 100, curve: standard)
        let open = next.expanded, d = reduced ? 0 : (open ? a.expandDuration ?? 350 : a.collapseDuration ?? 200)
        panel.set(open ? 1 : 0, now: now, duration: d, curve: open ? decel : accel); inner.set(open ? 1 : 0, now: now, duration: d, curve: open ? decel : accel)
        caret.set(open ? 1 : 0, now: now, duration: reduced ? 0 : awcCSSDuration(theme.tokens["--md-sys-motion-duration-medium2"]) ?? 300, curve: standard)
        // Siblings glide (`--shifting`, 200ms) only while a drag runs; the drop clears transforms in one tick.
        shiftTrack.set(next.shift, now: next.lifting ? AWCListPlaceholderView.glideStart(runtime?.targetChangedAt ?? 0) : now, duration: reduced || !next.lifting ? 0 : 200, curve: standard)
        shadowTrack.set(next.dragged ? 1 : 0, now: now, duration: 100, curve: standard)
        let hd = reduced ? 0.0 : 150.0
        handleOpacity.set(next.handle[0], now: now, duration: hd, curve: standard); handleInk.set(next.handle[1], now: now, duration: hd, curve: standard)
        handleScale.set(next.handle[2], now: now, duration: hd, curve: standard)
    }
    private func running(_ now: Double) -> Bool { corners.contains { $0.isRunning(now) } || layer.isRunning(now) || panel.isRunning(now) || inner.isRunning(now) || caret.isRunning(now)
        || shiftTrack.isRunning(now) || shadowTrack.isRunning(now) || handleOpacity.isRunning(now) || handleInk.isRunning(now) || handleScale.isRunning(now) || isDragged }

    var body: some View {
        if model.hidden { EmptyView() } else {
            let now = CACurrentMediaTime() * 1000
            TimelineView(.animation(paused: !running(now))) { _ in item(CACurrentMediaTime() * 1000) }
                .onChange(of: targetValues, initial: true) { _, next in apply(next) }
                .task(id: targetValues) { await Task.yield(); if !Task.isCancelled { apply(targetValues) } }
                .onChange(of: node.properties["expanded"]) { _, _ in localExpanded = nil }
                .onChange(of: node.properties, initial: true) { _, _ in attachController() }
                .onChange(of: focusHandle.isFocused) { _, focused in
                    // Roving activation; mdRequestActivation is asked by the focus bridges when focus enters the item.
                    if focused, style.rovingFocusable { runtime?.activate(node.id, showRoving: false) }
                }
        }
    }

    // MARK: Paint

    private func item(_ t: Double) -> some View {
        let s = style, st = states, a = s.a
        let _ = { renderShift.dy = CGFloat(isDragged ? (runtime?.dragDelta ?? 0) : shiftTrack.presented(t)) }()
        let logical = (0..<4).map { corners[$0].presented(t) }, phys = s.physical(logical)
        let shape = AWCNativeCornerShape(corners: AWCCornerShape(topLeft: .init(.points(phys[0])), topRight: .init(.points(phys[1])),
                                                                 bottomRight: .init(.points(phys[2])), bottomLeft: .init(.points(phys[3]))))
        let opacity = layer.presented(t)  // the state layer keeps its 100ms transition under reduced motion (Chrome)
        let ring = s.focusRing(st)
        return VStack(spacing: 0) {
            row(s, st, a, t, opacity)
            if model.expandable { panelView(s, a, t) }
        }
        .background {
            ZStack {
                shape.fill(Color(awcHex: s.containerColor))
                if ring { shape.strokeBorder(Color(awcHex: s.color("secondary", "#625B71")), lineWidth: 3) }
            }
        }
        .clipShape(shape)
        .contentShape(shape)
        .background {
            let lift = shadowTrack.presented(t)
            if lift > 0 { AWCNativeBoxShadow(corners: AWCCornerShape(topLeft: .init(.points(phys[0])), topRight: .init(.points(phys[1])), bottomRight: .init(.points(phys[2])), bottomLeft: .init(.points(phys[3]))),
                                             layers: [], toLayers: a.draggedContainerElevation ?? AWCBoxShadow.source(theme.tokens["--md-sys-elevation-4"] ?? "none") ?? [], fraction: lift, placement: .outer) }
        }
        .onGeometryChange(for: CGRect.self) { $0.frame(in: .named("awc-native-preview")) } action: { frame = $0 }
        .onGeometryChange(for: CGRect.self) { $0.frame(in: .global) } action: { globalFrame = $0; if runtime?.dragID == nil { runtime?.frames[node.id] = $0 } }
        .offset(y: isDragged ? (runtime?.dragDelta ?? 0) : shiftTrack.presented(t))
        .zIndex(ring || isDragged || shadowTrack.presented(t) > 0 ? 1 : 0)
        .awcInspect(nodeID: node.id, name: "md-list-item") { _ in
            func rgba(_ hex: String) -> AWCValue { let r = Color(awcHex: hex).resolve(in: EnvironmentValues()); return .array([.number(Double(r.red)), .number(Double(r.green)), .number(Double(r.blue)), .number(Double(r.opacity))]) }
            return ["renderTime": .number(t), "layerOpacity": .number(s.layerVisible ? opacity : -1), "layerColor": rgba(s.stateLayerColor),
                    "radius": .array(logical.map { .number($0) }), "background": rgba(s.containerColor), "labelColor": rgba(s.labelColor),
                    "leadingIconColor": rgba(s.leadingIconColor(st)), "trailingIconColor": rgba(s.trailingIconColor(st)), "focusRing": .bool(ring),
                    "panel": .number(panel.presented(t)), "panelHeight": .number(Double(max(CGFloat(2 * (style.a.expandedPanelPaddingBlock ?? 0)), panelHeight * CGFloat(panel.presented(t))))), "inner": .number(inner.presented(t)), "caret": .number(caret.presented(t)),
                    "selected": .bool(s.selectedClass), "expanded": .bool(expanded), "lines": .number(Double(s.lines)), "interactive": .bool(s.interactive),
                    "tabbable": .bool(tabbable), "focused": .bool(focusHandle.isFocused),
                    "offsetY": .number(isDragged ? (runtime?.dragDelta ?? 0) : shiftTrack.presented(t)), "lift": .number(shadowTrack.presented(t)), "dragged": .bool(isDragged),
                    "handleOpacity": .number(handleOpacity.presented(t)), "handleScale": .number(handleScale.presented(t)),
                    "headlineTooltip": .bool(headlineTruncated), "supportingTooltip": .bool(supportingTruncated)]
        }
    }

    private func row(_ s: AWCListItemStyle, _ st: AWCListItemStates, _ a: AWCListItemAppearance, _ t: Double, _ opacity: Double) -> some View {
        let p = s.padding, three = s.lines == 3
        let centerLeading = model.hasAvatar
        return AWCListRowLayout(gap: s.gap, top: p.top, bottom: p.bottom, start: p.start, end: p.end, minHeight: s.minHeight, three: three, centerLeading: centerLeading) {
            if s.hasPrimaryAction {
                AWCListRowLayout(gap: s.gap, top: 0, bottom: 0, start: 0, end: 0, minHeight: 0, three: three, centerLeading: centerLeading) { leading(s, st, a); content(s, a).layoutValue(key: AWCListRowRole.self, value: 1) }
                    .layoutValue(key: AWCListRowRole.self, value: 1).awcInspect(nodeID: node.id, part: "primary", name: "primary").modifier(AWCListPartPaint(value: parts[.primary]))
            } else { leading(s, st, a); content(s, a).layoutValue(key: AWCListRowRole.self, value: 1) }
            trailing(s, st, a, t).layoutValue(key: AWCListRowRole.self, value: 2)
        }
        .frame(maxWidth: .infinity)
        .background { if let bg = parts[.row]?.backgroundColor { Color(awcHex: bg) } }
        .overlay {
            ZStack {
                if s.interactive && !isDragged && !s.disabledClass {
                    AWCNativeButtonRipple(pressed: held, nativePressed: false, nativeActivation: activation, color: Color(awcHex: s.labelColor), origin: pressOrigin,
                                          honorsReducedMotion: false, inspectNodeID: node.id)
                }
                // ::part(state-layer) opacity replaces the state opacity (the element exists on interactive rows).
                if s.layerVisible || (s.interactive && parts[.stateLayer]?.opacity != nil) {
                    Color(awcHex: parts[.stateLayer]?.backgroundColor ?? s.stateLayerColor).opacity(parts[.stateLayer]?.opacity ?? opacity)
                        .awcInspect(nodeID: node.id, part: "state-layer", name: "state-layer") { _ in ["opacity": .number(opacity), "renderTime": .number(t)] }
                }
            }
            .clipShape(rowLayerShape(s, st))
            .mask { layerMask(s) }
            .allowsHitTesting(false)
        }
        .overlay { if let row = parts[.row], let c = row.borderColor, let w = row.borderWidth { Rectangle().strokeBorder(Color(awcHex: c), lineWidth: w).allowsHitTesting(false) } }
        .opacity(parts[.row]?.opacity ?? 1)
        .contentShape(Rectangle())
        .onGeometryChange(for: CGRect.self) { $0.frame(in: .named("awc-native-preview")).offsetBy(dx: 0, dy: -renderShift.dy) } action: { rowFrame = $0; if runtime?.dropShifted.contains(node.id) == true { runtime?.dropShifted.remove(node.id) } }
        .onContinuousHover(coordinateSpace: .global) { phase in var next = false; if case .active(let at) = phase { next = true; if let d = dropAt, abs(at.x - d.x) >= 0.5 || abs(at.y - d.y) >= 0.5 { dropAt = nil } }; if hovered != next { hovered = next } }
        .simultaneousGesture(pointerGesture)
        .onChange(of: pointer.map { $0.isPointerDown && $0.pressLocation.map(rowFrame.contains) == true } ?? false) { _, pressing in
            pressMature = false
            if pressing { Task { @MainActor in try? await Task.sleep(nanoseconds: 16_000_000); if pointer?.isPointerDown == true { pressMature = true } } }
        }
        .allowsHitTesting(!model.disabled)
        // An option is named by its full text (as on Web): its visible texts are not repeated as separate elements.
        .accessibilityHidden(s.participates)
        .awcFocusBridgeLayer { if (s.focusable || s.rovingFocusable || s.participates || menuRow(s)) && runtime != nil || (s.focusable && ctx == nil) { focusBridge(s).accessibilityHidden(false) } }
        // md-list-item.css: interactive row pointer; text rows outside selection/expansion default (higher specificity);
        // [soft-disabled] row default; otherwise the row inherits the host (`--disabled` default).
        .awcCursor({ () -> AWCCursorStyle? in
            // `:host(.md-list-item--disabled) { pointer-events: none }` (soft-disabled restores events): no own cursor.
            if model.disabled && !model.softDisabled { return nil }
            var best: (spec: Int, order: Int, style: AWCCursorStyle)?
            func rule(_ on: Bool, _ spec: Int, _ order: Int, _ style: AWCCursorStyle) { if on, best.map({ ($0.spec, $0.order) < (spec, order) }) ?? true { best = (spec, order, style) } }
            rule(s.interactive, 3, 1, .pointer); rule(model.type == "text" && !s.participates && !model.expandable, 5, 2, .default)
            rule(model.softDisabled, 3, 5, .default)
            return best?.style
        }())
        .awcInspect(nodeID: node.id, part: "row", name: "row") { _ in ["padding": .array([.number(p.top), .number(p.end), .number(p.bottom), .number(p.start)]), "gap": .object(["row": .number(0), "column": .number(s.gap)]), "contentGap": .number(s.gap), "minHeight": .number(s.minHeight)] }
    }

    @ViewBuilder private func leading(_ s: AWCListItemStyle, _ st: AWCListItemStates, _ a: AWCListItemAppearance) -> some View {
        let slotted = node.children(inSlot: "leading"), ink = Color(awcHex: parts[.leadingIcon]?.color ?? s.leadingIconColor(st))
        if !slotted.isEmpty {
            HStack(spacing: 0) {
                ForEach(slotted) { child in
                    if child.tag == "video" {
                        AWCNativeCornerShape(corners: .points(a.leadingVideoShape ?? 8)).fill(Color.clear)
                            .frame(width: a.leadingVideoWidth ?? 100, height: a.leadingVideoHeight ?? 56)
                    } else { authored(child) }
                }
            }
            .frame(minWidth: 24).foregroundStyle(ink).awcInspect(nodeID: node.id, part: "leading", name: "leading")
            .frame(maxHeight: s.lines == 3 && !slotted.contains { $0.tag == "md-avatar" } ? nil : nil, alignment: .top)
        } else if model.hasAvatar {
            avatar(s, a).frame(minWidth: 24).awcInspect(nodeID: node.id, part: "leading", name: "leading").modifier(AWCListPartPaint(value: parts[.leading]))
        } else if !model.leadingImage.isEmpty {
            image(s, a).frame(minWidth: 24).awcInspect(nodeID: node.id, part: "leading", name: "leading").modifier(AWCListPartPaint(value: parts[.leading]))
        } else if !model.leadingIcon.isEmpty {
            AWCListGlyph(name: model.leadingIcon, size: s.leadingIconSize, color: ink, fill: expanded ? 1 : 0)
                .awcInspect(nodeID: node.id, part: "leading-icon", name: "leading-icon").modifier(AWCListPartPaint(value: parts[.leadingIcon]))
                .frame(minWidth: 24).awcInspect(nodeID: node.id, part: "leading", name: "leading").modifier(AWCListPartPaint(value: parts[.leading]))
        }
    }

    /// Slotted authored content keeps its own box (an author `width`/`height` on the element).
    @ViewBuilder private func authored(_ child: AWCNode) -> some View {
        if let box = authoredBoxes[child.id] { renderChild(child).frame(width: box.width, height: box.height) }
        // md-switch's host box is 52×48 in the source (its 48px touch target), which sets the row's height.
        else if child.tag == "md-switch" { renderChild(child).frame(minWidth: 52, minHeight: 48) }
        else { renderChild(child) }
    }

    private func avatar(_ s: AWCListItemStyle, _ a: AWCListItemAppearance) -> some View {
        let size = a.leadingAvatarSize ?? 40, shape = AWCNativeCornerShape(corners: .points(min(a.leadingAvatarShape ?? 9999, size / 2)))
        let label = Color(awcHex: a.leadingAvatarLabelColor ?? s.color("on-primary-container", "#21005D"))
        let initials: String = {
            if !model.leadingAvatarLabel.isEmpty { return String(model.leadingAvatarLabel.prefix(2)).uppercased() }
            let words = model.leadingAvatarName.split(separator: " ").filter { !$0.isEmpty }
            return words.count > 1 ? String(words.first!.prefix(1) + words.last!.prefix(1)).uppercased() : String(words.first?.prefix(1) ?? "").uppercased()
        }()
        // md-avatar's modes: the image, else (none or a failed one) the initials, else the person icon. ::part(avatar) is
        // md-avatar's host: its background and corner shape (which clips, overflow hidden) win over the avatar tokens.
        let showsImage = !model.leadingAvatar.isEmpty && !avatarFailed && !AWCListImage.undecodable(model.leadingAvatar)
        let pa = parts[.avatar], clip = pa?.cornerShape.map { AWCNativeCornerShape(corners: $0) } ?? shape
        return ZStack {
            clip.fill(Color(awcHex: pa?.backgroundColor ?? (showsImage ? "#00000000" : a.leadingAvatarColor ?? s.color("primary-container", "#EADDFF"))))
            if showsImage {
                AWCListImage(source: model.leadingAvatar, onFailure: { avatarFailed = true }).frame(width: size, height: size).opacity(parts[.avatarImage]?.opacity ?? 1)
            } else if !initials.isEmpty {
                AWCListText(text: initials, size: 16, lineHeight: 16, weight: 500, tracking: 0.15, color: parts[.avatarInitials]?.color.map { Color(awcHex: $0) } ?? label).fixedSize()
                    .opacity(parts[.avatarInitials]?.opacity ?? 1)
            } else {
                AWCListGlyph(name: "person", size: size * 0.6, color: parts[.avatarIcon]?.color.map { Color(awcHex: $0) } ?? label).opacity(parts[.avatarIcon]?.opacity ?? 1)
            }
        }
        .frame(width: size, height: size).clipShape(clip).opacity(pa?.opacity ?? 1)
        .onChange(of: model.leadingAvatar) { _, _ in avatarFailed = false }
        .awcInspect(nodeID: node.id, part: "avatar", name: "avatar")
    }

    /// `.md-list-item__row` keeps its own state radius (max(container-shape corner, state shape)); the host's
    /// expanded rule squares only the host's end corners, so the layer stays rounded there.
    private func rowLayerShape(_ s: AWCListItemStyle, _ st: AWCListItemStates) -> AWCNativeCornerShape {
        guard let shape = s.stateShape(st), expanded else { return AWCNativeCornerShape(corners: .points(0)) }
        let c = s.physical(s.ownCorners.map { max($0, shape) })
        return AWCNativeCornerShape(corners: AWCCornerShape(topLeft: .init(.points(c[0])), topRight: .init(.points(c[1])), bottomRight: .init(.points(c[2])), bottomLeft: .init(.points(c[3]))))
    }
    /// The ripple and state layer are positioned before the image-wrap and the caret host in the source, so
    /// those paint above them: the layer leaves the image and the open caret's fill uncovered.
    private func layerMask(_ s: AWCListItemStyle) -> some View {
        ZStack(alignment: .topLeading) {
            Rectangle()
            if !model.leadingImage.isEmpty, imageNamed.width > 0 {
                RoundedRectangle(cornerRadius: s.imageShape).frame(width: imageNamed.width, height: imageNamed.height)
                    .offset(x: imageNamed.minX - rowFrame.minX, y: imageNamed.minY - rowFrame.minY).blendMode(.destinationOut)
            }
            if model.expandable && expanded, caretNamed.width > 0 {
                Circle().frame(width: caretNamed.width, height: caretNamed.height)
                    .offset(x: caretNamed.minX - rowFrame.minX, y: caretNamed.minY - rowFrame.minY).blendMode(.destinationOut)
            }
        }.environment(\.layoutDirection, .leftToRight).compositingGroup()
    }
    private func image(_ s: AWCListItemStyle, _ a: AWCListItemAppearance) -> some View {
        // ::part(image-wrap) clips (overflow hidden) in its corner shape; the scrim holds the circle, which holds the check.
        let pw = parts[.imageWrap], w = a.leadingImageWidth ?? 56, h = a.leadingImageHeight ?? 56
        let shape = AWCNativeCornerShape(corners: pw?.cornerShape ?? .points(s.imageShape))
        let icon = a.leadingImageSelectionIconSize ?? 24, ind = parts[.imageSelectionIndicator], circle = parts[.imageSelectionCircle], check = parts[.imageSelectionCheck]
        return ZStack {
            AWCListImage(source: model.leadingImage).frame(width: w, height: h).clipped().opacity(parts[.image]?.opacity ?? 1)
            if s.selectedClass {
                ZStack {
                    Color(awcHex: ind?.backgroundColor ?? a.leadingImageSelectionScrimColor ?? AWCListItemStyle.mix(s.color("scrim", "#000000"), 0.32))
                    AWCNativeCornerShape(corners: circle?.cornerShape ?? .points(icon / 2))
                        .fill(Color(awcHex: circle?.backgroundColor ?? a.leadingImageSelectionCircleColor ?? AWCListItemStyle.mix(s.color("on-surface", "#1D1B20"), 0.6))).frame(width: icon, height: icon)
                        .overlay { AWCListGlyph(name: "check", size: icon * 0.667, color: Color(awcHex: check?.color ?? a.leadingImageSelectionIconColor ?? s.color("surface", "#FEF7FF")), fill: 1).opacity(check?.opacity ?? 1) }
                        .opacity(circle?.opacity ?? 1)
                }
                .opacity(ind?.opacity ?? 1)
            }
        }
        .frame(width: w, height: h).background { if let bg = pw?.backgroundColor { shape.fill(Color(awcHex: bg)) } }.clipShape(shape).opacity(pw?.opacity ?? 1)
        .onGeometryChange(for: CGRect.self) { $0.frame(in: .named("awc-native-preview")).offsetBy(dx: 0, dy: -renderShift.dy) } action: { imageNamed = $0 }
        .awcInspect(nodeID: node.id, part: "image", name: "image")
    }

    private func content(_ s: AWCListItemStyle, _ a: AWCListItemAppearance) -> some View {
        let showOverline = !model.overline.isEmpty || hasSlot("overline"), showSupporting = !model.supportingText.isEmpty || hasSlot("supporting-text")
        let slotText: (String) -> String? = { slot in
            let nodes = node.children(inSlot: slot); guard !nodes.isEmpty else { return nil }
            return nodes.compactMap { $0.properties["text"]?.string }.joined(separator: " ")
        }
        let defaultText = node.children(inSlot: nil).filter { $0.tag == "#text" }.compactMap { $0.properties["text"]?.string }.joined(separator: " ")
        let headline = slotText("headline") ?? (model.headline.isEmpty ? defaultText : model.headline)
        let hp = parts[.headline]
        return VStack(alignment: .leading, spacing: 0) {
            if showOverline {
                AWCListText(text: slotText("overline") ?? model.overline, size: 11, lineHeight: 16, weight: 500, tracking: 0.5, color: Color(awcHex: parts[.overline]?.color ?? s.overlineColor), uppercase: slotText("overline") == nil)
                    .frame(maxWidth: .infinity, alignment: .leading).awcInspect(nodeID: node.id, part: "overline", name: "overline").modifier(AWCListPartPaint(value: parts[.overline]))
            }
            AWCListText(text: headline, size: s.headlineSize, lineHeight: s.headlineLine, weight: 400, tracking: hp?.letterSpacing ?? 0.5,
                        color: Color(awcHex: hp?.color ?? s.labelColor), family: a.labelTextFont, onTruncation: { if headlineTruncated != $0 { headlineTruncated = $0 } })
                .frame(maxWidth: .infinity, alignment: .leading)
                .awcListTruncationTooltip(id: node.id + ".headline-tooltip", text: headline, enabled: headlineTruncated, theme: theme)
                .awcInspect(nodeID: node.id, part: "headline", name: "headline").modifier(AWCListPartPaint(value: parts[.headline]))
            if showSupporting {
                AWCListText(text: slotText("supporting-text") ?? model.supportingText, size: s.supportingSize, lineHeight: s.supportingLine, weight: 400, tracking: 0.25,
                            color: Color(awcHex: parts[.supportingText]?.color ?? s.supportingColor), family: a.supportingTextFont, lines: s.lines == 3 ? 2 : 1,
                            onTruncation: { if supportingTruncated != $0 { supportingTruncated = $0 } })
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .awcListTruncationTooltip(id: node.id + ".supporting-tooltip", text: slotText("supporting-text") ?? model.supportingText, enabled: supportingTruncated, theme: theme)
                    .awcInspect(nodeID: node.id, part: "supporting-text", name: "supporting-text").modifier(AWCListPartPaint(value: parts[.supportingText]))
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading).layoutPriority(-1)
        .awcInspect(nodeID: node.id, part: "content", name: "content").modifier(AWCListPartPaint(value: parts[.content]))
    }

    @ViewBuilder private func trailing(_ s: AWCListItemStyle, _ st: AWCListItemStates, _ a: AWCListItemAppearance, _ t: Double) -> some View {
        let slotted = node.children(inSlot: "trailing")
        let text = node.children(inSlot: "trailing-supporting-text").compactMap { $0.properties["text"]?.string }.first ?? model.trailingSupportingText
        let has = !slotted.isEmpty || !text.isEmpty || !model.trailingIcon.isEmpty || model.expandable || s.reorderable
        if has {
            let ink = Color(awcHex: parts[.trailingIcon]?.color ?? s.trailingIconColor(st)), three = s.lines == 3
            let layout = three ? AnyLayout(AWCListTrailingColumn()) : AnyLayout(HStackLayout(alignment: .center, spacing: 4))
            layout {
                if !slotted.isEmpty {
                    ForEach(slotted) { child in authored(child).onGeometryChange(for: CGRect.self) { $0.frame(in: .global) } action: { r in trailingFrames[child.id] = r } }
                } else {
                    if !text.isEmpty {
                        AWCListText(text: text, size: 11, lineHeight: 16, weight: 500, tracking: 0, color: Color(awcHex: parts[.trailingSupportingText]?.color ?? s.trailingTextColor),
                                    family: a.trailingSupportingTextFont).fixedSize()
                            .awcInspect(nodeID: node.id, part: "trailing-supporting-text", name: "trailing-supporting-text").modifier(AWCListPartPaint(value: parts[.trailingSupportingText]))
                    }
                    if !model.trailingIcon.isEmpty {
                        AWCListGlyph(name: model.trailingIcon, size: s.trailingIconSize, color: ink).awcInspect(nodeID: node.id, part: "trailing-icon", name: "trailing-icon").modifier(AWCListPartPaint(value: parts[.trailingIcon]))
                            .layoutValue(key: AWCListAutoMargin.self, value: true)
                    }
                }
                if model.expandable { caretButton(s, a, t) }
                if s.reorderable {
                    let hi = handleInk.presented(t), base = Color(awcHex: parts[.dragHandle]?.color ?? s.trailingIconColor(st))
                    AWCListGlyph(name: "drag_indicator", size: 24, color: parts[.dragHandle]?.color != nil ? base : awcInterpolatedColor(base, Color(awcHex: s.onSurface), hi), glyphSize: 22)
                        .modifier(AWCListPartPaint(value: parts[.dragHandle], fades: false))
                        .scaleEffect(handleScale.presented(t)).opacity(parts[.dragHandle]?.opacity ?? handleOpacity.presented(t))
                        .onGeometryChange(for: CGRect.self) { $0.frame(in: .global) } action: { handleFrame = $0 }
                        .onGeometryChange(for: CGRect.self) { $0.frame(in: .named("awc-native-preview")).offsetBy(dx: 0, dy: -renderShift.dy) } action: { handleFrameNamed = $0 }
                        .onHover { handleHoverLocal = $0 }
                        .awcCursor(dragging ? .grabbing : .grab, active: .grabbing)
                        .awcInspect(nodeID: node.id, part: "drag-handle", name: "drag-handle")
                }
            }
            .foregroundStyle(ink)
            .modifier(AWCListPartPaint(value: parts[.trailing]))
            .awcInspect(nodeID: node.id, part: "trailing", name: "trailing")
        }
    }

    private func caretButton(_ s: AWCListItemStyle, _ a: AWCListItemAppearance, _ t: Double) -> some View {
        let size = a.expandButtonSize ?? 32, chevron = a.expandChevronSize ?? 24, open = expanded
        let ink = open ? s.color("on-primary", "#FFFFFF") : s.chevronColor
        let ringed = caretFocus.isFocusVisible
        let over = pointer?.location.map { caretNamed.contains($0) } ?? caretHover
        let pressing = pointer.map { $0.isPointerDown && $0.pressLocation.map(caretNamed.contains) == true } ?? false
        // md-icon-button's own state layer (ink): pressed 0.10 > focus-visible 0.12 > hover 0.08 (source order).
        let caretLayer = s.disabledClass ? 0 : pressing ? 0.1 : ringed ? 0.12 : over ? 0.08 : 0
        // md-icon-button's exported parts: ::part(expand-button-state-layer) (its opacity replaces the state opacity),
        // ::part(expand-button-icon); ::part(expand-button) is the md-icon-button host.
        let pb = parts[.expandButton], psl = parts[.expandButtonStateLayer], pic = parts[.expandButtonIcon], layerOpacity = psl?.opacity ?? caretLayer
        return ZStack {
            Circle().fill(open ? Color(awcHex: s.color("primary", "#6750A4")) : .clear)
            // md-icon-button :focus-visible: the focus state layer (12%) and a 3px secondary outline offset by 2px.
            if layerOpacity > 0 { Circle().fill(Color(awcHex: psl?.backgroundColor ?? ink).opacity(layerOpacity)) }
            AWCListGlyph(name: "expand_more", size: chevron, color: Color(awcHex: pic?.color ?? ink)).opacity(pic?.opacity ?? 1).rotationEffect(.degrees(180 * caret.presented(t)))
        }
        .overlay { if ringed { Circle().inset(by: -3.5).stroke(Color(awcHex: s.color("secondary", "#625B71")), lineWidth: 3) } }
        .frame(width: size, height: size)
        .background { if let bg = pb?.backgroundColor { AWCNativeCornerShape(corners: pb?.cornerShape ?? .points(0)).fill(Color(awcHex: bg)) } }
        .opacity(pb?.opacity ?? 1)
        .contentShape(Circle())
        .onGeometryChange(for: CGRect.self) { $0.frame(in: .global) } action: { caretFrame = $0 }
        .onGeometryChange(for: CGRect.self) { $0.frame(in: .named("awc-native-preview")).offsetBy(dx: 0, dy: -renderShift.dy) } action: { caretNamed = $0 }
        .onHover { caretHover = $0 }
        .onTapGesture { if !s.disabledClass { toggleExpanded() } }
        .awcFocusBridgeLayer { caretBridge(s) }
        .awcInspect(nodeID: node.id, part: "expand-button", name: "expand-button") { _ in ["rotation": .number(180 * caret.presented(t)), "open": .bool(open)] }
        .padding(.trailing, -4)
    }

    /// The expand button is its own tab stop (md-icon-button in the source).
    private func caretBridge(_ s: AWCListItemStyle) -> some View {
        let props: [String: AWCValue] = ["disabled": .bool(model.disabled), "softDisabled": .bool(model.softDisabled)]
        var configuration = AWCNativeFocusConfiguration(id: node.id + ".expand-button", label: expanded ? "Collapse" : "Expand", policy: AWCButtonAccessibilityPolicy(properties: props), group: nil, cell: nil,
                                                        handle: caretFocus, focusChanged: { focusWithin.set(caret: $0) { requestActivation(s, caret: true) } }, activate: { if !s.disabledClass { toggleExpanded() } })
        configuration.disclosureExpanded = expanded
        // The caret sits in the row's shadow tree: md-list-item's host key handler and the list's roving take its keys
        // (ArrowRight/Left expand/collapse; Enter/Space activate md-icon-button and then click the host, as Chrome does).
        configuration.routeKey = { key, _, modified in
            if modified { return false }
            if s.interactive && !s.disabledClass {
                if key == "ArrowRight" && !expanded { toggleExpanded(); return true }
                if key == "ArrowLeft" && expanded { toggleExpanded(); return true }
                if key == "Enter" || key == "Space" { toggleExpanded(); keyboardActivate(); return true }
            }
            if ["ArrowRight", "ArrowLeft"].contains(key) { return true }
            if let runtime { if runtime.move(key, from: node.id) { return true }; return runtime.typeaheadKey(key, from: node.id) }
            return false
        }
        return AWCNativeButtonFocusBridge(configuration: configuration)
    }
    @ViewBuilder private func panelView(_ s: AWCListItemStyle, _ a: AWCListItemAppearance, _ t: Double) -> some View {
        let children = node.children(inSlot: "expanded-content"), rows = children.filter { $0.tag == "md-list-item" }
        let fraction = panel.presented(t), offset = -8 * (1 - inner.presented(t))
        let start = a.expandedPanelPaddingInlineStart ?? a.expandedPanelPaddingInline ?? 0, end = a.expandedPanelPaddingInline ?? 0, block = a.expandedPanelPaddingBlock ?? 0
        VStack(spacing: 0) {
            ForEach(children.filter { $0.tag != "#text" }) { child in
                if child.tag == "md-list-item" {
                    let i = rows.firstIndex { $0.id == child.id } ?? 0
                    AWCNativeListItemView(node: child, theme: theme, ctx: panelContext(i, rows.count), runtime: runtime, emitItem: emitItem, renderChild: renderChild,
                                          onPanelClick: { c in
                        runtime?.childClicked(c, siblings: rows, parentID: node.id)
                        emitItem(node.id, "mdItemSelect", ["index": .number(Double(rows.firstIndex { $0.id == c.id } ?? 0)), "value": .string(AWCListRuntime.label(c)),
                                                           "selected": .bool(runtime?.selection.contains(c.id) ?? false), "item": .string(c.id)])
                    })
                } else { renderChild(child) }
            }
        }
        .padding(.vertical, block).padding(.leading, start).padding(.trailing, end)
        .modifier(AWCListPartPaint(value: parts[.expandedPanelInner], clips: true))
        .offset(y: offset)
        .fixedSize(horizontal: false, vertical: true)
        .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { panelHeight = $0 }
        // The source's 0fr grid row cannot shrink the panel below its block padding (the padding is the grid
        // item's min-content), so a collapsed panel with `expanded-panel-padding-block` keeps that height;
        // the panel's background fades with its opacity (same element in the source).
        .frame(height: max(CGFloat(2 * block), panelHeight * CGFloat(fraction)), alignment: .top).clipped()
        .background(Color(awcHex: parts[.expandedPanel]?.backgroundColor ?? a.expandedPanelBackground ?? "#00000000"))
        .opacity((fraction > 0 ? panel.presented(t) : 0) * (parts[.expandedPanel]?.opacity ?? 1))
        .allowsHitTesting(expanded)
        // Collapsed content is retained for the transition: it leaves the keyboard order with the accessibility tree (the
        // source hides it with `visibility`, gate-7 r3-26). The inert bit reaches the rows' focus bridges.
        .awcNativeInert(!expanded)
        // The panel is a `list` (rows), a `group` (selection) or a `region`, labelled by the headline unless a region.
        .accessibilityElement(children: .contain)
        .accessibilityLabel(rows.isEmpty && !(ctx?.selectionMode ?? "none").contains("select") ? "" : AWCListRuntime.label(node))
        .accessibilityHidden(!expanded)
        .awcInspect(nodeID: node.id, part: "expanded-panel", name: "expanded-panel") { _ in ["fraction": .number(fraction), "natural": .number(Double(panelHeight))] }
    }
    private func panelContext(_ i: Int, _ count: Int) -> AWCListItemContext {
        var c = ctx ?? AWCListItemContext(); c.inPanel = true; c.childIndex = i; c.first = i == 0; c.last = i == count - 1
        c.lastInLastExpanded = (ctx?.last ?? false) && ctx != nil && i == count - 1; c.reorderable = false
        return c
    }

    // MARK: Pointer, keyboard and activation

    private func attachController() {
        handle.focus = { visible in
            guard style.rovingFocusable else { return false }
            runtime?.activate(node.id, showRoving: false)
            return visible ? (focusHandle.requestFocus?() ?? false) : (focusHandle.requestPointerFocus?() ?? false)
        }
        handle.setExpanded = { value in
            guard model.expandable, !style.disabledClass else { return }
            let next = value ?? !expanded
            localExpanded = next; runtime?.expanded[node.id] = next
        }
        itemControllers[node.id]?.handle = handle
    }

    private var pointerGesture: some Gesture {
        DragGesture(minimumDistance: 0, coordinateSpace: .global)
            .onChanged { v in if press == nil { begin(v.startLocation) }; if dragging { runtime?.moveDrag(y: Double(v.location.y)) } }
            .onEnded { v in end(v.location) }
    }
    private func begin(_ p: CGPoint) {
        press = p
        if style.reorderable, handleFrame.contains(p), let runtime, runtime.beginDrag(node.id, y: Double(p.y)) {
            dragging = true; held = true; pressOrigin = CGPoint(x: p.x - globalFrame.minX, y: p.y - globalFrame.minY)
            if style.focusable { _ = focusHandle.requestPointerFocus?() }
            return
        }
        // A press inside the expand button or an authored trailing control keeps that control's own
        // activation; the row is only :active (the source host matches :active through its descendants).
        if caretFrame.contains(p) || trailingFrames.values.contains(where: { $0.contains(p) }) {
            // The expand button (md-icon-button) takes focus on pointerdown, like any button in Chrome.
            if caretFrame.contains(p) && !style.disabledClass { _ = caretFocus.requestPointerFocus?() }
            if style.interactive { controlPress = true; held = true; if !style.disabledClass { pressOrigin = CGPoint(x: p.x - globalFrame.minX, y: p.y - globalFrame.minY) } }; return }
        let s = style
        guard s.interactive, !s.disabledClass || model.softDisabled else { return }
        if !s.disabledClass { held = true; pressOrigin = CGPoint(x: p.x - globalFrame.minX, y: p.y - globalFrame.minY) } else { held = true }
        // Focus moves on pointerdown: mdActivate precedes the click (synchronously, like the source).
        if s.focusable { runtime?.activate(node.id, showRoving: false); _ = focusHandle.requestPointerFocus?() }
    }
    private func end(_ p: CGPoint) {
        if dragging {
            dragging = false; press = nil; held = false
            // A drop that moved the row re-inserts it in the source, so focus falls back to the document.
            if runtime?.endDrag() == true {
                dropAt = pointer?.location ?? p; runtime?.dropPoint = dropAt; AWCListRuntime.blurFocus(node.id)
                // The other rows' frames are stale for about one frame only: release the hold after that (C65-01), so the row under a still pointer hovers again.
                Task { @MainActor in try? await Task.sleep(nanoseconds: 40_000_000); runtime?.dropPoint = nil }
            }
            return
        }
        if controlPress { controlPress = false; press = nil; held = false; return }
        let start = press; press = nil
        let wasHeld = held; held = false
        guard let start, wasHeld, !caretFrame.contains(start), globalFrame.contains(p) else { return }
        click()
    }
    private func click() {
        let s = style
        guard s.interactive, !s.disabledClass else { return }
        if let onPanelClick, ctx?.inPanel == true { emitItem(node.id, "mdClick", ["item": .string(node.id)]); onPanelClick(node); return }
        if model.expandable { toggleExpanded(); emitItem(node.id, "mdClick", ["item": .string(node.id)]); return }
        // mdItemClick's detail is built before the list handles it: `selected` is the value before the click.
        let index = runtime?.rows.firstIndex { $0.id == node.id } ?? 0, wasSelected = runtime?.selection.contains(node.id) ?? model.selected
        emitItem(node.id, "mdClick", ["item": .string(node.id)])
        runtime?.itemClicked(node.id)
        emitItem(node.id, "mdItemClick", ["index": .number(Double(index)), "selected": .bool(wasSelected)])
    }
    private func toggleExpanded() {
        let next = !expanded
        localExpanded = next; runtime?.expanded[node.id] = next
        let index = ctx?.index ?? 0
        emitItem(node.id, "mdExpand", ["expanded": .bool(next), "index": .number(Double(index)), "value": .string(AWCListRuntime.label(node)), "item": .string(node.id)])
    }
    /// Source handleFocus: focus entering a row hosted directly by a list (not an expanded-content child) asks the list for
    /// roving activation.
    /// Source handleFocus: focus entering the item from outside asks its list for roving activation. md-list answers by making a
    /// roving row its active row (`mdActivate` first: the list's listener runs before the event leaves the list); the row's own
    /// focus has activated it already, the caret's has not.
    private func requestActivation(_ s: AWCListItemStyle, caret: Bool = false) {
        guard let runtime, s.interactive, ctx?.inPanel != true else { return }
        if caret, s.rovingFocusable { runtime.activate(node.id, showRoving: false) }
        emitItem(node.id, "mdRequestActivation", .null)
    }
    private func menuRow(_ s: AWCListItemStyle) -> Bool { ["menu", "menubar"].contains(ctx?.containerRole ?? "") && !s.participates && s.interactive && (model.type == "button" || model.type == "link") }
    private func keyboardActivate() {
        let s = style
        guard s.interactive, !s.disabledClass else { return }
        keyPressed = true; activation &+= 1
        click()
        Task { try? await Task.sleep(nanoseconds: 150_000_000); keyPressed = false }
    }
    private func focusBridge(_ s: AWCListItemStyle) -> some View {
        var props: [String: AWCValue] = ["disabled": .bool(model.disabled), "softDisabled": .bool(model.softDisabled), "groupTabindex": .number(s.rovingFocusable && tabbable ? 0 : -1)]
        // Accessibility roles (md-list-item.tsx): a selection row is an `option` with `aria-selected` (a radio button
        // in a single-select listbox, a checkbox in a multi-select one), a button/link row inside a menu is a
        // `menuitem`, otherwise the primary action is a button or link. The row's index is its set position.
        if s.participates { props["roleOverride"] = "option"; props["selected"] = .bool(s.selected) }
        else if menuRow(s) { props["roleOverride"] = "menuitem" }
        else if model.type == "link" { props["href"] = node.properties["href"] ?? .null }
        let position = AWCGridCellContext(row: ctx?.childIndex ?? ctx?.index ?? -1, column: -1)
        var configuration = AWCNativeFocusConfiguration(id: node.id, label: s.participates ? [node.properties["overline"]?.string, AWCListRuntime.label(node), node.properties["supportingText"]?.string, node.properties["trailingSupportingText"]?.string].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " ") : AWCListRuntime.label(node), policy: AWCButtonAccessibilityPolicy(properties: props), group: nil, cell: position,
                                                        handle: focusHandle, focusChanged: { focusWithin.set(row: $0) { requestActivation(s) } }, activate: { keyboardActivate() })
        configuration.routeKey = { key, _, modified in
            if modified { return false }
            if model.expandable && !s.disabledClass {
                if key == "ArrowRight" && !expanded { toggleExpanded(); return true }
                if key == "ArrowLeft" && expanded { toggleExpanded(); return true }
            }
            if ["ArrowRight", "ArrowLeft"].contains(key) { return true }
            if let runtime { if runtime.move(key, from: node.id) { return true }; return runtime.typeaheadKey(key, from: node.id) }
            return false
        }
        configuration.routeKeyWithAlt = { key, alt in
            guard alt, key == "ArrowUp" || key == "ArrowDown", s.reorderable else { return false }
            return runtime?.keyReorder(node.id, up: key == "ArrowUp") ?? false
        }
        configuration.disclosureExpanded = model.expandable ? expanded : nil
        let bridge = AWCNativeButtonFocusBridge(configuration: configuration)
        return bridge.onAppear { runtime?.focusRequests[node.id] = { visible in visible ? (focusHandle.requestFocus?() ?? false) : (focusHandle.requestPointerFocus?() ?? false) } }
    }
}

/// Focus inside one list item (its row and its caret), set synchronously by their focus bridges. The source host's `focus`
/// event fires only when focus enters the item from outside: a move between the row and its caret is not an entry, so a
/// blur stays pending until the next run-loop turn.
/// md-list-item `::part()` paint declarations (md-list.md "Parts"): `backgroundColor` fills the part's box in its corner shape,
/// `cornerShape` also clips the parts the source clips, `opacity` fades the part with its content (replacing the part's own
/// opacity where it has one). Text and glyph parts take `color` where they draw.
struct AWCListPartPaint: ViewModifier {
    let value: AWCListPartAppearance?
    var clips = false
    /// false where the part's own opacity track applies the declared opacity (the drag handle).
    var fades = true
    @ViewBuilder func body(content: Content) -> some View {
        if let v = value, v.backgroundColor != nil || (fades && v.opacity != nil) || (clips && v.cornerShape != nil) {
            let shape = AWCNativeCornerShape(corners: v.cornerShape ?? .points(0)), alpha = fades ? v.opacity ?? 1 : 1
            let filled = content.background { if let bg = v.backgroundColor { shape.fill(Color(awcHex: bg)) } }
            if clips, v.cornerShape != nil { filled.clipShape(shape).opacity(alpha) } else { filled.opacity(alpha) }
        } else { content }
    }
}

final class AWCListItemFocusWithin {
    private var row = false, caret = false, pending = false
    func set(row value: Bool? = nil, caret part: Bool? = nil, entered: () -> Void) {
        if value ?? part ?? false {
            let inside = row || caret || pending
            if value != nil { row = true } else { caret = true }
            if !inside { entered() }
        } else {
            if value != nil { row = false } else { caret = false }
            pending = true
            DispatchQueue.main.async { [weak self] in self?.pending = false }
        }
    }
}

private struct AWCListShapeMorphKey: EnvironmentKey { static let defaultValue = true }
extension EnvironmentValues {
    /// `--md-sys-shape-morph-enabled` (`data-shape-morph="off"` freezes the state shapes).
    var awcListShapeMorph: Bool { get { self[AWCListShapeMorphKey.self] } set { self[AWCListShapeMorphKey.self] = newValue } }
}
public extension View {
    /// `data-shape-morph="off"`: state shapes resolve to the resting corners.
    func awcListShapeMorph(_ enabled: Bool) -> some View { environment(\.awcListShapeMorph, enabled) }
}

private struct AWCListAuthoredBoxesKey: EnvironmentKey { static let defaultValue: [String: CGSize] = [:] }
extension EnvironmentValues {
    /// Author-specified boxes of slotted elements by node id (CSS width/height on the slotted element).
    var awcListAuthoredBoxes: [String: CGSize] { get { self[AWCListAuthoredBoxesKey.self] } set { self[AWCListAuthoredBoxesKey.self] = newValue } }
}
