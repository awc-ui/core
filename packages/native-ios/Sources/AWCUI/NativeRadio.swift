import SwiftUI
import QuartzCore

// MARK: Source model

/// md-radio's render/class logic (md-radio.tsx) as a pure model.
struct AWCRadioModel: Equatable {
    var checked = false, disabled = false, softDisabled = false, required = false, hidden = false
    var name = "", value = "", validationMessage = ""
    var density: Double? = nil
    init(properties p: [String: AWCValue], checked: Bool, validationMessage: String) {
        self.checked = checked; self.validationMessage = validationMessage
        disabled = p["disabled"]?.bool ?? false; softDisabled = p["softDisabled"]?.bool ?? false
        required = p["required"]?.bool ?? false; hidden = p["hidden"]?.bool ?? false
        name = p["name"]?.string ?? ""; value = p["value"]?.string ?? ""; density = p["density"]?.number
    }
    /// `.md-radio--disabled` covers hard and soft disabled.
    var disabledClass: Bool { disabled || softDisabled }
}

struct AWCRadioStates: Equatable, Hashable { var hover = false, focusVisible = false, active = false, pressed = false }

/// Every value md-radio.css derives, rule by rule in specificity and source order.
struct AWCRadioStyle {
    let model: AWCRadioModel, appearance: AWCRadioAppearance, parts: AWCRadioPartAppearance, tokens: [String: String], density: Double
    func token(_ name: String, _ fallback: String) -> String { tokens["--md-sys-color-" + name] ?? fallback }
    private var disabledOpacity: Double { Double((tokens["--md-sys-state-disabled-content-opacity"] ?? "").trimmingCharacters(in: .whitespaces)) ?? 0.38 }
    private var disabledInk: String { AWCSwitchStyle.mix(token("on-surface", "#1C1B1F"), disabledOpacity) }
    var touch: Double { max(32, 48 + density * 4) }
    var stateLayer: Double { max(24, (appearance.stateLayerSize ?? 40) + density * 4) }
    var icon: Double { appearance.iconSize ?? max(16, 20 + density) }
    var inner: Double { appearance.innerCircleSize ?? max(8, 10 + density * 0.5) }
    let border = 2.0
    var outerColor: String {
        if let part = parts.outerColor { return part }
        if model.disabledClass { return disabledInk }
        return model.checked ? appearance.selectedIconColor ?? token("primary", "#6750A4") : appearance.iconColor ?? token("on-surface-variant", "#49454F")
    }
    var outerFill: String { parts.outerFill ?? "#00000000" }
    var innerColor: String { parts.innerColor ?? (model.disabledClass && model.checked ? disabledInk : appearance.selectedIconColor ?? token("primary", "#6750A4")) }
    var innerScale: Double { model.checked ? 1 : 0 }
    var stateLayerColor: String { parts.stateLayerColor ?? (model.checked ? appearance.selectedStateLayerColor ?? token("primary", "#6750A4") : appearance.stateLayerColor ?? token("on-surface", "#1C1B1F")) }
    var layerVisible: Bool { !model.disabledClass }
    /// Hover and :active only: the radio has no focus-visible state layer (its focus is the ring).
    func layerOpacity(_ s: AWCRadioStates) -> Double {
        guard layerVisible else { return 0 }
        if let part = parts.stateLayerOpacity { return part }
        func state(_ k: String, _ f: Double) -> Double { Double((tokens["--md-sys-state-\(k)-state-layer-opacity"] ?? "").trimmingCharacters(in: .whitespaces)) ?? f }
        if s.active { return state("pressed", 0.12) }
        if s.hover { return state("hover", 0.08) }
        return 0
    }
    var focusRingColor: String { token("secondary", "#625B71") }
    var supportFontSize: Double { max(10, 12 + density * 0.5) }
    var supportLineHeight: Double { max(14, 16 + density * 0.5) }
    func scale(_ s: AWCRadioStates) -> Double { s.pressed && !model.disabledClass ? 0.82 : 1 }
}

// MARK: Renderer

struct AWCNativeRadio: View {
    let node: AWCNode, theme: AWCTheme, checked: Bool, label: String, validationMessage: String
    let groups: AWCRadioGroups
    let select: () -> Void, uncheck: () -> Void, focusChanged: (Bool) -> Void
    var validityChanged: (AWCValue) -> Void = { _ in }
    var formResets = 0
    @Environment(\.awcRadioAppearance) private var appearance
    @Environment(\.awcRadioPartAppearance) private var parts
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
    @State private var supportFrame: CGRect = .zero
    @State private var scaleTrack = AWCCSSTransitionTrack()
    @State private var layerTrack = AWCCSSTransitionTrack()
    @State private var innerTrack = AWCCSSTransitionTrack()
    @State private var outerTrack = AWCCSSColorTrack()
    @State private var wave: AWCCheckboxWave? = nil
    @State private var primed = false
    @State private var validation = AWCSelectionValidationState()
    private var validityMissing: Bool { (node.properties["name"]?.string ?? "").isEmpty ? (node.properties["required"]?.bool ?? false) && !checked : groups.valueMissing(node.properties["name"]?.string ?? "", required: node.properties["required"]?.bool ?? false) }
    private var validityMessage: String { node.properties["valueMissingLabel"]?.string ?? "Please select one of these options." }
    private var validity: AWCSelectionValidity { .init(missing: validityMissing, missingMessage: validityMessage, customMessage: validation.customMessage) }

    private var model: AWCRadioModel { AWCRadioModel(properties: node.properties, checked: checked, validationMessage: validation.shown(validity) ?? validationMessage) }
    private var density: Double { AWCNativeDensity.resolve(model.density, inherited: inheritedDensity) }
    private var style: AWCRadioStyle { .init(model: model, appearance: appearance, parts: parts, tokens: theme.tokens, density: density) }
    private var reduced: Bool { reducedOverride ?? systemReduced }
    private var hover: Bool {
        guard !model.disabled else { return false }   // pointer-events: none
        return pointer.map { $0.location.map(frame.contains) ?? false } ?? hovered
    }
    private var states: AWCRadioStates {
        let hostPress = pointer.map { $0.isPointerDown && hover } ?? false
        return .init(hover: hover, focusVisible: focusHandle.isFocusVisible, active: (held || hostPress) && !model.disabled, pressed: pressed)
    }
    private var tabIndex: Int { groups.tabIndex(model.name, node.id, checked: model.checked, disabled: model.disabled) }
    private struct Targets: Equatable { var scale: Double, layer: Double, inner: Double, outer: String }
    private var targets: Targets { let s = states, st = style; return .init(scale: st.scale(s), layer: st.layerOpacity(s), inner: st.innerScale, outer: st.outerColor) }
    private func timing(_ key: String, _ fallback: Double, _ easing: String, _ curve: [Double]) -> (Double, [Double]) {
        if reduced { return (0, curve) }
        return (awcCSSDuration(theme.tokens["--md-sys-motion-duration-\(key)"]) ?? fallback, awcCSSCubicBezier(theme.tokens["--md-sys-motion-easing-\(easing)"]) ?? curve)
    }
    private func apply(_ next: Targets) {
        let now = CACurrentMediaTime() * 1000
        guard primed else {
            scaleTrack.snap(next.scale); layerTrack.snap(next.layer); innerTrack.snap(next.inner)
            outerTrack.set(Color(awcHex: next.outer), now: 0, duration: 0, curve: [0, 0, 1, 1]); primed = true; return
        }
        let standard = timing("short2", 100, "standard", [0.2, 0, 0, 1]), spring = timing("medium4", 400, "emphasized-decelerate", [0.05, 0.7, 0.1, 1])
        // Pressing uses the pressed rule's transform transition; releasing the base rule's spring-back.
        let transform = next.scale < 1 ? timing("short4", 200, "standard", [0.2, 0, 0, 1]) : spring
        scaleTrack.set(next.scale, now: now, duration: transform.0, curve: transform.1)
        layerTrack.set(next.layer, now: now, duration: standard.0, curve: standard.1)
        innerTrack.set(next.inner, now: now, duration: spring.0, curve: spring.1)
        outerTrack.set(Color(awcHex: next.outer), now: now, duration: standard.0, curve: standard.1)
    }
    private func running(_ now: Double) -> Bool {
        scaleTrack.isRunning(now) || layerTrack.isRunning(now) || innerTrack.isRunning(now) || outerTrack.isRunning(now) || (wave.map { !$0.done(now) } ?? false)
    }
    private func register() {
        let m = model, member = groups.member(m.name, node.id)
        member.value = m.value; member.disabled = m.disabled; member.softDisabled = m.softDisabled; member.required = m.required
        member.focus = { [focusHandle] in _ = focusHandle.requestFocus?() }
        // An arrow selection focuses and checks the target, which starts its own centred ripple (source triggerRipple(target)).
        member.select = { source in if source == "arrow" && !model.disabledClass { centreWave() }; select() }
        member.uncheck = { uncheck() }
        if !globalFrame.isEmpty { groups.place(m.name, node.id, frame: globalFrame, rtl: direction == .rightToLeft) }
        if m.checked && !m.name.isEmpty && groups.checked[m.name] != node.id { groups.didCheck(m.name, node.id) }
    }

    var body: some View {
        if model.hidden { EmptyView() } else {
            let now = CACurrentMediaTime() * 1000
            TimelineView(.animation(paused: !running(now))) { _ in control(CACurrentMediaTime() * 1000) }
                .onChange(of: targets, initial: true) { _, next in apply(next) }
                .task(id: targets) { await Task.yield(); if !Task.isCancelled { apply(targets) } }
                .modifier(AWCSelectionValidationModifier(nodeID: node.id, state: validation, missing: validityMissing, missingMessage: validityMessage, barred: node.properties["disabled"]?.bool ?? false, name: node.properties["name"]?.string ?? "", formResets: formResets, focus: { focusHandle.requestFocus?() ?? false }, blur: { focusHandle.resignFocus?() }, select: { if !model.disabledClass { select() } }, changed: validityChanged))
                .onAppear { register() }
                .onChange(of: node.properties) { _, _ in register() }
                .onChange(of: checked) { _, isChecked in
                    guard !model.name.isEmpty else { return }
                    if isChecked { groups.didCheck(model.name, node.id) } else { groups.didUncheck(model.name, node.id) }
                }
                .onDisappear { groups.remove(model.name, node.id) }
        }
    }

    private func control(_ t: Double) -> some View {
        let st = style, s = states, m = model
        let touch = st.touch, sl = st.stateLayer, ic = st.icon
        let scale = reduced ? targets.scale : scaleTrack.presented(t)
        let layer = reduced ? targets.layer : layerTrack.presented(t)
        let inner = reduced ? targets.inner : innerTrack.presented(t)
        let outer = reduced ? Color(awcHex: targets.outer) : outerTrack.presented(t) ?? Color(awcHex: targets.outer)
        let support = m.validationMessage, hasSupport = !support.isEmpty
        let hostH = hasSupport ? touch + 2 + max(st.supportLineHeight, supportFrame.height) : touch
        let ring = s.focusVisible, rtl = direction == .rightToLeft, inset = (touch - ic) / 2
        return ZStack(alignment: .topLeading) {
            ZStack {
                if st.layerVisible { Circle().fill(Color(awcHex: st.stateLayerColor)).opacity(layer).frame(width: sl, height: sl) }
                if !m.disabledClass, let w = wave, let f = w.frame(t) {
                    ZStack { Circle().fill(Color(awcHex: st.stateLayerColor)).frame(width: 2 * w.radius * f.scale, height: 2 * w.radius * f.scale).position(x: w.origin.x, y: w.origin.y) }
                        .frame(width: sl, height: sl).clipShape(Circle()).opacity(f.opacity)
                }
                ZStack {
                    Circle().fill(Color(awcHex: st.outerFill)).overlay { Circle().strokeBorder(outer, lineWidth: st.border) }
                    Circle().fill(Color(awcHex: st.innerColor)).frame(width: st.inner, height: st.inner).scaleEffect(max(0.0001, inner)).opacity(inner > 0 ? 1 : 0)
                }
                .frame(width: ic, height: ic).scaleEffect(scale)
                // The focus ring is the target's ::after: a 3pt outline around the state-layer circle.
                if ring { Circle().stroke(Color(awcHex: st.focusRingColor), lineWidth: 3).frame(width: sl + 3, height: sl + 3) }
            }
            .frame(width: touch, height: touch).clipShape(Circle())
            if hasSupport {
                Text(support).font(AWCNativeFonts.label(size: st.supportFontSize, weight: 400)).foregroundStyle(Color(awcHex: st.token("error", "#B3261E")))
                    .lineLimit(1).fixedSize().frame(height: st.supportLineHeight)
                    .onGeometryChange(for: CGRect.self) { $0.frame(in: .named("awc-native-preview")) } action: { supportFrame = $0 }
                    .padding(rtl ? .trailing : .leading, inset)
                    .frame(width: touch, alignment: rtl ? .trailing : .leading)
                    .offset(y: touch + 2)
            }
        }
        .frame(width: touch, height: hostH, alignment: .topLeading)
        .environment(\.layoutDirection, .leftToRight)
        .contentShape(Rectangle())
        .onGeometryChange(for: CGRect.self) { $0.frame(in: .named("awc-native-preview")) } action: { frame = $0 }
        .onGeometryChange(for: CGRect.self) { $0.frame(in: .global) } action: { globalFrame = $0; groups.place(model.name, node.id, frame: $0, rtl: direction == .rightToLeft) }
        .onContinuousHover(coordinateSpace: .global) { phase in var next = false; if case .active = phase { next = true }; if hovered != next { hovered = next } }
        .gesture(pointerGesture)
        .allowsHitTesting(!m.disabled)
        .awcFocusBridgeLayer {
            AWCNativeButtonFocusBridge(configuration: .init(id: node.id, label: label,
                policy: AWCButtonAccessibilityPolicy(properties: ["disabled": .bool(m.disabled), "softDisabled": .bool(m.softDisabled), "roleOverride": "radio", "selected": .bool(m.checked), "invalid": .bool(node.properties["error"]?.bool == true || (node.properties["required"]?.bool == true && !m.checked)), "required": .bool(node.properties["required"]?.bool == true),
                                                                  "groupTabindex": .number(Double(tabIndex))]),
                group: nil, cell: nil, handle: focusHandle, focusChanged: { focusChanged($0) }, activate: { if !model.disabledClass { click() } },
                routeKey: { key, _, modified in
                    guard !modified else { return false }
                    switch key {
                    case "Space", " ": keyboardSpace(); return true
                    case "ArrowDown", "ArrowRight": arrow(1); return true
                    case "ArrowUp", "ArrowLeft": arrow(-1); return true
                    default: return key == "Enter"   // Enter is reserved for form submission
                    }
                }))
        }
        .awcInspect(nodeID: node.id, name: "md-radio") { _ in
            func rgba(_ c: Color) -> AWCValue { let r = c.resolve(in: EnvironmentValues()); return .array([.number(Double(r.red)), .number(Double(r.green)), .number(Double(r.blue)), .number(Double(r.opacity))]) }
            let f = wave.flatMap { $0.frame(t) }
            return ["renderTime": .number(t), "touch": .number(touch), "stateLayerSize": .number(sl), "iconSize": .number(ic), "innerSize": .number(st.inner), "containerX": .number(inset),
                    "outerColor": rgba(outer), "outerFill": rgba(Color(awcHex: st.outerFill)), "innerColor": rgba(Color(awcHex: st.innerColor)), "innerScale": .number(inner), "scale": .number(scale),
                    "layerOpacity": .number(st.layerVisible ? layer : -1), "layerColor": rgba(Color(awcHex: st.stateLayerColor)), "focusRing": .bool(ring),
                    "support": .string(support), "supportX": .number(supportFrame.minX), "supportY": .number(supportFrame.minY), "supportWidth": .number(supportFrame.width), "hostHeight": .number(hostH),
                    "hover": .bool(s.hover), "pressed": .bool(s.pressed), "active": .bool(s.active), "focused": .bool(focusHandle.isFocused), "focusVisible": .bool(s.focusVisible),
                    "checked": .bool(m.checked), "tabindex": .number(Double(tabIndex)), "valueMissing": .bool(groups.valueMissing(m.name, required: m.required)), "waveScale": f.map { .number($0.scale) } ?? .null, "waveOpacity": .number(f?.opacity ?? 0)]
        }
    }

    // MARK: Pointer and keyboard

    private func click() { if !model.disabledClass && !model.checked { select() } }
    private var pointerGesture: some Gesture {
        DragGesture(minimumDistance: 0, coordinateSpace: .global)
            .onChanged { value in
                if !began {
                    began = true; held = true
                    if !model.disabledClass { pressed = true }   // pointerdown
                    let st = style, sl = st.stateLayer, local = CGPoint(x: value.startLocation.x - globalFrame.minX - (st.touch - sl) / 2, y: value.startLocation.y - globalFrame.minY - (st.touch - sl) / 2)
                    if !model.disabledClass && hypot(local.x - sl / 2, local.y - sl / 2) <= sl / 2 {
                        let dx = max(local.x, sl - local.x), dy = max(local.y, sl - local.y)
                        wave = .init(origin: local, radius: hypot(dx, dy), began: CACurrentMediaTime() * 1000, released: nil)
                    }
                    _ = focusHandle.requestPointerFocus?()
                }
                if pressed && !globalFrame.contains(value.location) { pressed = false }   // pointerleave
            }
            .onEnded { value in
                began = false; held = false; pressed = false
                if wave != nil && wave?.released == nil { wave?.released = CACurrentMediaTime() * 1000 }
                if globalFrame.contains(value.location) { click() }
            }
    }
    /// Space: pressed pulse (150 ms), centred ripple and the click (a checked radio ignores it) — source `handleKeyDown`.
    private func keyboardSpace() {
        guard !model.disabledClass else { return }
        centreWave(); pressed = true; click()
        keyPressToken &+= 1; let token = keyPressToken
        Task { @MainActor in try? await Task.sleep(nanoseconds: 150_000_000); if keyPressToken == token { pressed = false } }
    }
    private func centreWave() {
        let sl = style.stateLayer, now = CACurrentMediaTime() * 1000
        wave = .init(origin: CGPoint(x: sl / 2, y: sl / 2), radius: hypot(sl / 2, sl / 2), began: now, released: now)
    }
    private func arrow(_ step: Int) {
        guard !model.disabledClass, !model.name.isEmpty else { return }
        groups.move(model.name, from: node.id, by: step)
    }
}

extension AWCNativeView {
    /// md-radio: the dedicated renderer with its name-scoped group (no slots: authored children are not rendered).
    var nativeRadio: some View {
        AWCNativeRadio(node: node, theme: theme, checked: b("checked"), label: [node.properties["aria-label"]?.string, node.properties["ariaLabel"]?.string].compactMap { $0 }.first { !$0.isEmpty } ?? "",
                       validationMessage: registeredForm?.validationMessages[formRegistrationID] ?? "", groups: AWCRadioGroups.of(interactionStore),
                       select: { radioSelect() }, uncheck: { set("checked", false) }, focusChanged: { emit($0 ? "mdFocus" : "mdBlur") }, validityChanged: { emit("mdValidityChange", $0) }, formResets: registeredForm?.resetCount ?? 0)
    }
    /// `handleClick` / arrow selection: check this radio (siblings are unchecked silently) and emit `mdChange {checked, value}`.
    func radioSelect() {
        guard !b("checked") else { return }
        set("checked", true)
        if !s("name").isEmpty { AWCRadioGroups.of(interactionStore).didCheck(s("name"), node.id); interactionStore.radioValues[s("name")] = s("value") }
        emit("mdChange", ["checked": true, "value": .string(s("value"))])
    }
}
