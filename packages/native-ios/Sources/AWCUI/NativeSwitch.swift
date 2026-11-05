import SwiftUI
import QuartzCore

// MARK: Source model

/// md-switch's render/class logic (md-switch.tsx) as a pure model.
struct AWCSwitchModel: Equatable {
    var selected = false, disabled = false, softDisabled = false, icons = false, showOnlySelectedIcon = false, hidden = false
    var selectedIcon = "check", unselectedIcon = "close"
    var density: Double? = nil
    init(properties p: [String: AWCValue], selected: Bool) {
        self.selected = selected
        disabled = p["disabled"]?.bool ?? false; softDisabled = p["softDisabled"]?.bool ?? false
        icons = p["icons"]?.bool ?? false; showOnlySelectedIcon = p["showOnlySelectedIcon"]?.bool ?? false
        hidden = p["hidden"]?.bool ?? false; density = p["density"]?.number
        selectedIcon = p["selectedIcon"]?.string ?? "check"; unselectedIcon = p["unselectedIcon"]?.string ?? "close"
    }
    /// `.md-switch--disabled` covers hard and soft disabled (`isDisabled`).
    var disabledClass: Bool { disabled || softDisabled }
    /// `.md-switch--with-icon`.
    var showIcon: Bool { selected ? (icons || showOnlySelectedIcon) : icons }
}

/// Pseudo-class and class inputs of the cascade: `:hover`, `:focus-visible`, `:active` and `.md-switch--pressed`.
struct AWCSwitchStates: Equatable, Hashable { var hover = false, focusVisible = false, active = false, pressed = false, focusRing = false }

/// Every value md-switch.css derives, rule by rule in specificity and source order.
struct AWCSwitchStyle {
    let model: AWCSwitchModel, appearance: AWCSwitchAppearance, parts: AWCSwitchPartAppearance, tokens: [String: String], density: Double
    func token(_ name: String, _ fallback: String) -> String { tokens["--md-sys-color-" + name] ?? fallback }
    static func mix(_ hex: String, _ alpha: Double) -> String {
        let c = Color(awcHex: hex).resolve(in: EnvironmentValues())
        return String(format: "#%02X%02X%02X%02X", Int((Double(c.red) * 255).rounded()), Int((Double(c.green) * 255).rounded()), Int((Double(c.blue) * 255).rounded()), Int((Double(c.opacity) * alpha * 255).rounded()))
    }
    // Geometry (section 1): every size derives from the track by calc().
    var trackWidth: Double { appearance.trackWidth ?? max(28, 52 + density * 6) }
    var trackHeight: Double { max(16, (appearance.trackHeight ?? 32) + density * 4) }
    let border = 2.0
    var layerSize: Double { trackHeight + 8 }
    var handleSelected: Double { appearance.handleSize ?? trackHeight * 0.75 }
    var hostHeight: Double { max(48, trackHeight) }
    /// `inset-inline-start` of the handle container inside the track's padding box.
    func inlineOffset(selected: Bool) -> Double {
        selected ? trackWidth - trackHeight / 2 - layerSize / 2 - border : trackHeight / 2 - layerSize / 2 - border
    }
    func handleSize(_ s: AWCSwitchStates) -> Double {
        var size = handleSelected * 2 / 3
        if model.selected || model.showIcon { size = handleSelected }
        if s.pressed && !model.disabledClass { size = handleSelected * 7 / 6 }
        return size
    }
    private var interactive: Bool { !model.disabledClass }
    private func engaged(_ s: AWCSwitchStates) -> Bool { interactive && (s.hover || s.focusVisible || s.pressed) }
    func trackColor(_ s: AWCSwitchStates) -> String {
        if let part = parts.trackColor { return part }
        if model.disabledClass { return model.selected ? Self.mix(token("on-surface", "#1C1B1F"), 0.12) : Self.mix(token("surface-container-highest", "#E6E0E9"), 0.12) }
        return model.selected ? appearance.selectedTrackColor ?? token("primary", "#6750A4") : appearance.trackColor ?? token("surface-container-highest", "#E6E0E9")
    }
    func outlineColor(_ s: AWCSwitchStates) -> String {
        if let part = parts.trackOutlineColor { return part }
        if model.disabledClass { return Self.mix(token("on-surface", "#1C1B1F"), 0.12) }
        if model.selected { return appearance.selectedTrackColor ?? token("primary", "#6750A4") }
        if engaged(s) { return token("on-surface", "#1C1B1F") }
        return appearance.trackOutlineColor ?? token("outline", "#79747E")
    }
    func handleColor(_ s: AWCSwitchStates) -> String {
        if let part = parts.handleColor { return part }
        if model.disabledClass { return model.selected ? token("surface", "#FEF7FF") : Self.mix(token("on-surface", "#1C1B1F"), 0.38) }
        if engaged(s) { return model.selected ? token("primary-container", "#EADDFF") : token("on-surface-variant", "#49454F") }
        return model.selected ? appearance.selectedHandleColor ?? token("on-primary", "#FFFFFF") : appearance.handleColor ?? token("outline", "#79747E")
    }
    var iconColor: String {
        if let part = parts.iconColor { return part }
        if model.disabledClass { return model.selected ? Self.mix(token("on-surface", "#1C1B1F"), 0.38) : Self.mix(token("surface-container-highest", "#E6E0E9"), 0.38) }
        return model.selected ? appearance.selectedIconColor ?? token("on-primary-container", "#21005D") : appearance.iconColor ?? token("surface-container-highest", "#E6E0E9")
    }
    var stateLayerColor: String { parts.stateLayerColor ?? appearance.stateLayerColor ?? (model.selected ? token("primary", "#6750A4") : token("on-surface", "#1C1B1F")) }
    var focusRingColor: String { appearance.focusRingColor ?? token("secondary", "#625B71") }
    /// The state layer has `display: none` when disabled (soft or hard).
    var layerVisible: Bool { !model.disabledClass }
    func layerOpacity(_ s: AWCSwitchStates) -> Double {
        guard layerVisible else { return 0 }
        func state(_ k: String, _ f: Double) -> Double { Double((tokens["--md-sys-state-\(k)-state-layer-opacity"] ?? "").trimmingCharacters(in: .whitespaces)) ?? f }
        if s.active || s.pressed { return state("pressed", 0.12) }
        if s.focusVisible { return state("focus", 0.12) }
        if s.hover { return state("hover", 0.08) }
        return 0
    }
    /// `:host(:focus-visible:not([disabled]))` or programmatic `.md-switch--focus-ring`: only hard disabled hides it.
    func focusRing(_ s: AWCSwitchStates) -> Bool { !model.disabled && (s.focusVisible || s.focusRing) }
}

// MARK: Renderer

struct AWCNativeSwitch<SelectedIcon: View, UnselectedIcon: View>: View {
    let node: AWCNode, theme: AWCTheme, selected: Bool, label: String, validationMessage: String?
    let toggle: () -> Void
    @ViewBuilder let selectedSlot: () -> SelectedIcon
    @ViewBuilder let unselectedSlot: () -> UnselectedIcon
    let hasSelectedSlot: Bool, hasUnselectedSlot: Bool
    var validityChanged: (AWCValue) -> Void = { _ in }
    var formResets = 0
    @Environment(\.awcSwitchAppearance) private var inheritedAppearance
    @Environment(\.awcSwitchAppearanceTargets) private var appearanceTargets
    @Environment(\.awcSwitchPartAppearance) private var inheritedParts
    @Environment(\.awcSwitchPartAppearanceTargets) private var partTargets
    @Environment(\.awcNativeDensity) private var inheritedDensity
    @Environment(\.awcNativePointerState) private var pointer
    @Environment(\.accessibilityReduceMotion) private var systemReduced
    @Environment(\.awcSelectionReducedMotion) private var reducedOverride
    @Environment(\.layoutDirection) private var direction
    @State private var focusHandle = AWCButtonFocusHandle()
    @State private var hovered = false
    @State private var frame: CGRect = .zero
    @State private var globalFrame: CGRect = .zero
    @State private var pressed = false
    @State private var held = false
    @State private var began = false
    @State private var keyPressToken = 0
    @State private var offsetTrack = AWCCSSTransitionTrack()
    @State private var sizeTrack = AWCCSSTransitionTrack()
    @State private var layerTrack = AWCCSSTransitionTrack()
    @State private var handleColorTrack = AWCCSSColorTrack()
    @State private var trackColorTrack = AWCCSSColorTrack()
    @State private var outlineTrack = AWCCSSColorTrack()
    @State private var primed = false
    @State private var validation = AWCSelectionValidationState()
    private var validityMissing: Bool { (node.properties["required"]?.bool ?? false) && !selected }
    private var validityMessage: String { node.properties["valueMissingLabel"]?.string ?? "Please turn this on if you want to proceed." }
    private var validity: AWCSelectionValidity { .init(missing: validityMissing, missingMessage: validityMessage, customMessage: validation.customMessage) }

    private var model: AWCSwitchModel { AWCSwitchModel(properties: node.properties, selected: selected) }
    private var appearance: AWCSwitchAppearance { inheritedAppearance.merging(appearanceTargets[node.id] ?? .init()) }
    private var parts: AWCSwitchPartAppearance { inheritedParts.merging(partTargets[node.id] ?? .init()) }
    private var density: Double { AWCNativeDensity.resolve(model.density, inherited: inheritedDensity) }
    private var style: AWCSwitchStyle { .init(model: model, appearance: appearance, parts: parts, tokens: theme.tokens, density: density) }
    private var reduced: Bool { reducedOverride ?? systemReduced }
    private var hover: Bool {
        guard !model.disabled else { return false }   // pointer-events: none
        return pointer.map { $0.location.map(frame.contains) ?? false } ?? hovered
    }
    private var states: AWCSwitchStates {
        let hostPress = pointer.map { $0.isPointerDown && hover } ?? false
        return .init(hover: hover, focusVisible: focusHandle.isFocusVisible, active: (held || hostPress) && !model.disabled, pressed: pressed, focusRing: false)
    }
    private struct Targets: Equatable { var offset: Double, size: Double, layer: Double, handle: String, track: String, outline: String }
    private var targets: Targets {
        let s = states, st = style
        return .init(offset: st.inlineOffset(selected: model.selected), size: st.handleSize(s), layer: st.layerOpacity(s), handle: st.handleColor(s), track: st.trackColor(s), outline: st.outlineColor(s))
    }
    private func timing(_ kind: String, _ duration: Double, _ curve: [Double]) -> (Double, [Double]) {
        if reduced { return (0, curve) }
        return (awcCSSDuration(theme.tokens["--md-sys-motion-spring-\(kind)-fast-duration"]) ?? duration, awcCSSCubicBezier(theme.tokens["--md-sys-motion-spring-\(kind)-fast-easing"]) ?? curve)
    }
    private func apply(_ next: Targets) {
        guard primed else {
            offsetTrack.snap(next.offset); sizeTrack.snap(next.size); layerTrack.snap(next.layer)
            handleColorTrack.set(Color(awcHex: next.handle), now: 0, duration: 0, curve: [0, 0, 1, 1])
            trackColorTrack.set(Color(awcHex: next.track), now: 0, duration: 0, curve: [0, 0, 1, 1])
            outlineTrack.set(Color(awcHex: next.outline), now: 0, duration: 0, curve: [0, 0, 1, 1]); primed = true; return
        }
        let now = CACurrentMediaTime() * 1000
        let spatial = timing("spatial", 350, [0.42, 1.67, 0.21, 0.90]), effects = timing("effects", 150, [0.31, 0.94, 0.34, 1.00])
        offsetTrack.set(next.offset, now: now, duration: spatial.0, curve: spatial.1)
        sizeTrack.set(next.size, now: now, duration: spatial.0, curve: spatial.1)
        layerTrack.set(next.layer, now: now, duration: effects.0, curve: effects.1)
        handleColorTrack.set(Color(awcHex: next.handle), now: now, duration: effects.0, curve: effects.1)
        trackColorTrack.set(Color(awcHex: next.track), now: now, duration: effects.0, curve: effects.1)
        outlineTrack.set(Color(awcHex: next.outline), now: now, duration: effects.0, curve: effects.1)
    }
    private func running(_ now: Double) -> Bool {
        offsetTrack.isRunning(now) || sizeTrack.isRunning(now) || layerTrack.isRunning(now) || handleColorTrack.isRunning(now) || trackColorTrack.isRunning(now) || outlineTrack.isRunning(now)
    }

    var body: some View {
        if model.hidden { EmptyView() } else {
            let now = CACurrentMediaTime() * 1000
            VStack(alignment: .leading, spacing: 2) {
                TimelineView(.animation(paused: !running(now))) { _ in control(CACurrentMediaTime() * 1000) }
            }
            .onChange(of: targets, initial: true) { _, next in apply(next) }
            .task(id: targets) { await Task.yield(); if !Task.isCancelled { apply(targets) } }
            .modifier(AWCSelectionValidationModifier(nodeID: node.id, state: validation, missing: validityMissing, missingMessage: validityMessage, barred: node.properties["disabled"]?.bool ?? false, name: node.properties["name"]?.string ?? "", formResets: formResets, focus: { focusHandle.requestFocus?() ?? false }, blur: { focusHandle.resignFocus?() }, select: {}, changed: validityChanged))
        }
    }

    /// The supporting line: the reported validation message, else the registered form's message.
    private var supportMessage: String { validation.shown(validity) ?? validationMessage ?? "" }
    private func control(_ t: Double) -> some View {
        let st = style, s = states, m = model
        let w = st.trackWidth, h = st.trackHeight, sl = st.layerSize, hostH = st.hostHeight
        let support = supportMessage, supportLine = max(14, 16 + density * 0.5)
        let offset = reduced ? targets.offset : offsetTrack.presented(t)
        let size = reduced ? targets.size : sizeTrack.presented(t)
        let layer = reduced ? targets.layer : layerTrack.presented(t)
        let handleFill = reduced ? Color(awcHex: targets.handle) : handleColorTrack.presented(t) ?? Color(awcHex: targets.handle)
        let trackFill = reduced ? Color(awcHex: targets.track) : trackColorTrack.presented(t) ?? Color(awcHex: targets.track)
        let outline = reduced ? Color(awcHex: targets.outline) : outlineTrack.presented(t) ?? Color(awcHex: targets.outline)
        // Physical x of the handle container: inset-inline-start mirrors under right-to-left.
        let containerX = direction == .rightToLeft ? w - st.border - offset - sl : st.border + offset
        let trackY = (hostH - h) / 2, containerY = trackY + h / 2 - sl / 2
        let trackCorners = parts.trackShape ?? .points(h / 2), handleCorners = parts.handleShape ?? .points(size / 2)
        let trackShape = AWCNativeCornerShape(corners: trackCorners)
        let ring = st.focusRing(s), iconName = m.selected ? m.selectedIcon : m.unselectedIcon, hasSlot = m.selected ? hasSelectedSlot : hasUnselectedSlot
        let iconInk = Color(awcHex: st.iconColor)
        return ZStack(alignment: .topLeading) {
            trackShape.fill(trackFill).overlay { trackShape.strokeBorder(outline, lineWidth: st.border) }
                .frame(width: w, height: h)
                .overlay { if ring { AWCNativeCornerShape(corners: trackCorners.spread(3.5, in: CGSize(width: w, height: h))).stroke(Color(awcHex: st.focusRingColor), lineWidth: 3).padding(-3.5) } }
                .offset(y: trackY)
            ZStack {
                if st.layerVisible { Circle().fill(Color(awcHex: st.stateLayerColor)).opacity(layer) }
                ZStack {
                    AWCNativeCornerShape(corners: handleCorners).fill(handleFill)
                    if m.showIcon {
                        Group {
                            if hasSlot { (m.selected ? AnyView(selectedSlot()) : AnyView(unselectedSlot())).frame(width: 16, height: 16) }
                            else { AWCMaterialSymbol(iconName, size: 16) }
                        }.foregroundStyle(iconInk)
                    }
                }
                .frame(width: size, height: size).opacity(parts.handleOpacity ?? 1)
            }
            .frame(width: sl, height: sl).offset(x: containerX, y: containerY)
            if !support.isEmpty {
                // The source's support line: below the host's control row, start-aligned with the track and
                // overflowing toward the inline end (the host keeps the track's width).
                Text(support).font(AWCNativeFonts.label(size: max(10, 12 + density * 0.5), weight: 400))
                    .foregroundStyle(Color(awcHex: st.token("error", "#B3261E"))).lineLimit(1).fixedSize().frame(height: supportLine)
                    .frame(width: w, alignment: direction == .rightToLeft ? .trailing : .leading)
                    .offset(y: hostH + 2).accessibilityAddTraits(.isStaticText)
            }
        }
        .frame(width: w, height: support.isEmpty ? hostH : hostH + 2 + supportLine, alignment: .topLeading)
        .environment(\.layoutDirection, .leftToRight)
        .contentShape(Rectangle())
        .onGeometryChange(for: CGRect.self) { $0.frame(in: .named("awc-native-preview")) } action: { frame = $0 }
        .onGeometryChange(for: CGRect.self) { $0.frame(in: .global) } action: { globalFrame = $0 }
        .onContinuousHover(coordinateSpace: .global) { phase in var next = false; if case .active = phase { next = true }; if hovered != next { hovered = next } }
        .gesture(pointerGesture)
        .allowsHitTesting(!m.disabled)
        .awcFocusBridgeLayer {
            AWCNativeButtonFocusBridge(configuration: .init(id: node.id, label: label,
                policy: AWCButtonAccessibilityPolicy(properties: ["disabled": .bool(m.disabled), "softDisabled": .bool(m.softDisabled), "roleOverride": "switch", "selected": .bool(m.selected), "invalid": .bool(node.properties["error"]?.bool == true || (node.properties["required"]?.bool == true && !m.selected)), "required": .bool(node.properties["required"]?.bool == true)]),
                group: nil, cell: nil, handle: focusHandle, focusChanged: { _ in }, activate: { if !model.disabledClass { toggle() } },
                routeKey: { key, _, modified in
                    guard !modified else { return false }
                    if key == "Space" { if !awcSelectionKeyRepeat() { keyboardToggle() }; return true }   // a held Space toggles once
                    return key == "Enter"   // the source handles Space only; Enter is inert
                }))
        }
        .awcInspect(nodeID: node.id, name: "md-switch") { _ in
            func rgba(_ c: Color) -> AWCValue { let r = c.resolve(in: EnvironmentValues()); return .array([.number(Double(r.red)), .number(Double(r.green)), .number(Double(r.blue)), .number(Double(r.opacity))]) }
            return ["renderTime": .number(t), "containerX": .number(containerX), "containerY": .number(containerY), "layerSize": .number(sl),
                    "handleSize": .number(size), "layerOpacity": .number(st.layerVisible ? layer : -1), "handleColor": rgba(handleFill), "trackColor": rgba(trackFill),
                    "outlineColor": rgba(outline), "layerColor": rgba(Color(awcHex: st.stateLayerColor)), "iconColor": rgba(iconInk), "icon": .string(m.showIcon ? (hasSlot ? "#slot" : iconName) : ""),
                    "trackWidth": .number(w), "trackHeight": .number(h), "hostHeight": .number(hostH), "focusRing": .bool(ring),
                    "hover": .bool(s.hover), "pressed": .bool(s.pressed), "active": .bool(s.active), "focused": .bool(focusHandle.isFocused), "focusVisible": .bool(s.focusVisible),
                    "selected": .bool(m.selected), "tabindex": .number(m.disabled ? -1 : 0)]
        }
    }

    // MARK: Pointer and keyboard

    private var pointerGesture: some Gesture {
        DragGesture(minimumDistance: 0, coordinateSpace: .global)
            .onChanged { value in
                if !began {
                    began = true; held = true
                    if !model.disabledClass { pressed = true }   // pointerdown
                    _ = focusHandle.requestPointerFocus?()        // tabindex=0 host takes focus on mousedown
                }
                // pointerleave clears .md-switch--pressed; :active stays until release.
                if pressed && !globalFrame.contains(value.location) { pressed = false }
            }
            .onEnded { value in
                began = false; held = false; pressed = false
                // A click needs press and release on the host.
                if globalFrame.contains(value.location) && !model.disabledClass { toggle() }
            }
    }
    /// Space: toggle on keydown with a 150 ms pressed pulse (source `handleKeyDown`).
    private func keyboardToggle() {
        guard !model.disabledClass else { return }
        pressed = true; toggle()
        keyPressToken &+= 1; let token = keyPressToken
        Task { @MainActor in try? await Task.sleep(nanoseconds: 150_000_000); if keyPressToken == token { pressed = false } }
    }
}

extension AWCNativeView {
    /// md-switch: the dedicated renderer. The source has no default slot (authored text is not rendered);
    /// `selected-icon` / `unselected-icon` replace the glyphs.
    var nativeSwitch: some View {
        let selectedSlot = node.children(inSlot: "selected-icon"), unselectedSlot = node.children(inSlot: "unselected-icon")
        return AWCNativeSwitch(node: node, theme: theme, selected: b("selected"), label: [node.properties["aria-label"]?.string, node.properties["ariaLabel"]?.string].compactMap { $0 }.first { !$0.isEmpty } ?? "",
                               validationMessage: registeredForm?.validationMessages[formRegistrationID],
                               toggle: { switchToggle() },
                               selectedSlot: { ForEach(selectedSlot) { child($0) } }, unselectedSlot: { ForEach(unselectedSlot) { child($0) } },
                               hasSelectedSlot: !selectedSlot.isEmpty, hasUnselectedSlot: !unselectedSlot.isEmpty, validityChanged: { emit("mdValidityChange", $0) }, formResets: registeredForm?.resetCount ?? 0)
    }
    /// `toggle()`: cancelable mdInput with the proposed state, then the commit and mdChange.
    func switchToggle() {
        let proposed = !b("selected")
        let event = AWCEvent(name: "mdInput", tag: node.tag, nodeID: node.id, detail: ["selected": .bool(proposed)])
        let context = AWCEventDispatcher.dispatch(event, through: eventDispatcher, cancelable: true, targetListeners: eventTargetListeners)
        onEvent(context.observedEvent)
        guard !context.defaultPrevented else { return }
        set("selected", .bool(proposed)); emit("mdChange", ["selected": .bool(proposed)])
    }
}
