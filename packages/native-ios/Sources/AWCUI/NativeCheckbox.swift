import SwiftUI
import QuartzCore
import CoreText

// MARK: Source model

/// md-checkbox's render/class logic (md-checkbox.tsx) as a pure model.
struct AWCCheckboxModel: Equatable {
    var checked = false, indeterminate = false, disabled = false, softDisabled = false, error = false, required = false, hidden = false, decorative = false
    var errorText = "", supportingText = "", validationMessage = ""
    var density: Double? = nil
    init(properties p: [String: AWCValue], checked: Bool, indeterminate: Bool, validationMessage: String) {
        self.checked = checked; self.indeterminate = indeterminate; self.validationMessage = validationMessage
        disabled = p["disabled"]?.bool ?? false; softDisabled = p["softDisabled"]?.bool ?? false
        error = p["error"]?.bool ?? false; required = p["required"]?.bool ?? false; hidden = p["hidden"]?.bool ?? false
        decorative = p["ariaHidden"]?.string == "true" || p["aria-hidden"]?.string == "true"
        errorText = p["errorText"]?.string ?? ""; supportingText = p["supportingText"]?.string ?? ""; density = p["density"]?.number
    }
    var selected: Bool { checked || indeterminate }
    /// `.md-checkbox--disabled` covers hard and soft disabled.
    var disabledClass: Bool { disabled || softDisabled }
    var hasError: Bool { error || !validationMessage.isEmpty }
    /// errorText, then the validation message, then supporting text.
    var supportMessage: String { !errorText.isEmpty ? errorText : !validationMessage.isEmpty ? validationMessage : supportingText }
    var glyph: String { indeterminate ? "remove" : "check" }
}

struct AWCCheckboxStates: Equatable, Hashable { var hover = false, focusVisible = false, active = false, pressed = false }

/// Every value md-checkbox.css derives, rule by rule in specificity and source order.
struct AWCCheckboxStyle {
    let model: AWCCheckboxModel, appearance: AWCCheckboxAppearance, parts: AWCCheckboxPartAppearance, tokens: [String: String], density: Double
    func token(_ name: String, _ fallback: String) -> String { tokens["--md-sys-color-" + name] ?? fallback }
    private var disabledOpacity: Double { Double((tokens["--md-sys-state-disabled-content-opacity"] ?? "").trimmingCharacters(in: .whitespaces)) ?? 0.38 }
    var touch: Double { max(32, (appearance.touchTargetSize ?? 48) + density * 4) }
    var container: Double { appearance.containerSize ?? max(14, 18 + density) }
    var icon: Double { appearance.iconSize ?? max(14, 18 + density) }
    var stateLayer: Double { appearance.stateLayerSize ?? min(40, touch) }
    var outlineWidth: Double { appearance.outlineWidth ?? 2 }
    var shape: AWCCornerShape { parts.containerShape ?? appearance.containerShape ?? .points(2) }
    var containerColor: String {
        if let part = parts.containerColor { return part }
        let m = model
        if m.disabledClass { return m.selected ? AWCSwitchStyle.mix(token("on-surface", "#1C1B1F"), disabledOpacity) : "#00000000" }
        if m.hasError && m.selected { return token("error", "#B3261E") }
        return m.selected ? appearance.selectedContainerColor ?? token("primary", "#6750A4") : appearance.containerColor ?? "#00000000"
    }
    var outlineColor: String {
        if let part = parts.containerOutlineColor { return part }
        let m = model
        if m.disabledClass { return m.selected ? "#00000000" : AWCSwitchStyle.mix(token("on-surface", "#1C1B1F"), disabledOpacity) }
        if m.hasError { return token("error", "#B3261E") }
        return m.selected ? appearance.selectedContainerColor ?? token("primary", "#6750A4") : appearance.outlineColor ?? token("on-surface-variant", "#49454F")
    }
    var iconColor: String { parts.iconColor ?? (model.disabledClass && model.selected ? token("surface", "#FEF7FF") : appearance.iconColor ?? token("on-primary", "#FFFFFF")) }
    var stateLayerColor: String { parts.stateLayerColor ?? (model.selected ? appearance.selectedStateLayerColor ?? token("primary", "#6750A4") : appearance.stateLayerColor ?? token("on-surface", "#1C1B1F")) }
    var layerVisible: Bool { !model.disabledClass }
    func layerOpacity(_ s: AWCCheckboxStates) -> Double {
        guard layerVisible else { return 0 }
        if let part = parts.stateLayerOpacity { return part }
        func state(_ k: String, _ f: Double) -> Double { Double((tokens["--md-sys-state-\(k)-state-layer-opacity"] ?? "").trimmingCharacters(in: .whitespaces)) ?? f }
        if s.active { return state("pressed", 0.12) }
        if s.focusVisible { return state("focus", 0.12) }
        if s.hover { return state("hover", 0.08) }
        return 0
    }
    var focusRingColor: String { token("secondary", "#625B71") }
    /// The focus outline sits at the state-layer edge: offset (layer − touch)/2 from the host.
    var ringOffset: Double { (stateLayer - touch) / 2 }
    var supportFontSize: Double { max(10, 12 + density * 0.5) }
    var supportLineHeight: Double { max(14, 16 + density * 0.5) }
    var supportColor: String { parts.supportingTextColor ?? (model.hasError ? appearance.errorTextColor ?? token("error", "#B3261E") : appearance.supportingTextColor ?? token("on-surface-variant", "#49454F")) }
    func scale(_ s: AWCCheckboxStates) -> Double { s.pressed && !model.disabledClass ? 0.82 : 1 }
}

/// The check / remove glyph: Material Symbols with FILL 1, wght 600, GRAD 0, opsz 24 (md-checkbox.css).
enum AWCCheckboxGlyph {
    static func font(size: Double) -> CTFont {
        _ = AWCNativeFonts.symbolFamily()
        let axes: [NSNumber: Double] = [NSNumber(value: 0x46494C4C): 1, NSNumber(value: 0x77676874): 600, NSNumber(value: 0x47524144): 0, NSNumber(value: 0x6F70737A): 24]
        return CTFontCreateWithFontDescriptor(CTFontDescriptorCreateWithAttributes([kCTFontNameAttribute: "MaterialSymbolsOutlined-Regular", kCTFontVariationAttribute: axes] as CFDictionary), size, nil)
    }
    /// `md-checkbox-glyph-in`: 0% scale 0 / opacity 0, 60% scale 1.18 / opacity 1, 100% scale 1; the easing applies per keyframe interval.
    static func frame(_ elapsed: Double, duration: Double, curve: [Double]) -> (scale: Double, opacity: Double) {
        guard duration > 0, elapsed < duration else { return (1, 1) }
        let t = max(0, elapsed) / duration
        func ease(_ u: Double) -> Double { AWCNativeButtonTiming.cubic(u, x1: curve[0], y1: curve[1], x2: curve[2], y2: curve[3]) }
        if t < 0.6 { let e = ease(t / 0.6); return (1.18 * e, e) }
        let e = ease((t - 0.6) / 0.4); return (1.18 + (1 - 1.18) * e, 1)
    }
}

/// One md-ripple wave in the ripple layer (a state-layer-sized circle): grows 450 ms, fades 150 ms from
/// max(grow end, release), peak opacity 0.12, radius to the farthest corner of the layer box.
struct AWCCheckboxWave: Equatable {
    var origin: CGPoint, radius: Double, began: Double, released: Double?
    static let grow = 450.0, fade = 150.0, opacity = 0.12
    func frame(_ t: Double) -> (scale: Double, opacity: Double)? {
        let scale = AWCNativeButtonTiming.cubic(min(1, max(0, (t - began) / Self.grow)), x1: 0.2, y1: 0, x2: 0, y2: 1)
        guard let released else { return (scale, Self.opacity) }
        let fadeStart = max(began + Self.grow, released)
        if t < fadeStart { return (scale, Self.opacity) }
        if t >= fadeStart + Self.fade { return nil }
        return (scale, Self.opacity * (1 - AWCNativeButtonTiming.cubic((t - fadeStart) / Self.fade, x1: 0.2, y1: 0, x2: 0, y2: 1)))
    }
    func done(_ t: Double) -> Bool { released.map { t >= max(began + Self.grow, $0) + Self.fade } ?? false }
}

// MARK: Renderer

struct AWCNativeCheckbox: View {
    let node: AWCNode, theme: AWCTheme, checked: Bool, indeterminate: Bool, label: String, validationMessage: String
    let toggle: () -> Void
    var validityChanged: (AWCValue) -> Void = { _ in }
    var formResets = 0
    @Environment(\.awcCheckboxAppearance) private var appearance
    @Environment(\.awcCheckboxPartAppearance) private var parts
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
    @State private var fillTrack = AWCCSSColorTrack()
    @State private var outlineTrack = AWCCSSColorTrack()
    @State private var glyphStart: Double? = nil
    @State private var wave: AWCCheckboxWave? = nil
    @State private var primed = false
    @State private var validation = AWCSelectionValidationState()
    private var validityMissing: Bool { (node.properties["required"]?.bool ?? false) && !checked }
    private var validityMessage: String { node.properties["valueMissingLabel"]?.string ?? "Please check this box if you want to proceed." }
    private var validity: AWCSelectionValidity { .init(missing: validityMissing, missingMessage: validityMessage, customMessage: validation.customMessage) }

    private var model: AWCCheckboxModel { AWCCheckboxModel(properties: node.properties, checked: checked, indeterminate: indeterminate, validationMessage: validation.shown(validity) ?? validationMessage) }
    private var density: Double { AWCNativeDensity.resolve(model.density, inherited: inheritedDensity) }
    private var style: AWCCheckboxStyle { .init(model: model, appearance: appearance, parts: parts, tokens: theme.tokens, density: density) }
    private var reduced: Bool { reducedOverride ?? systemReduced }
    private var hover: Bool {
        guard !model.disabled else { return false }   // pointer-events: none
        return pointer.map { $0.location.map(frame.contains) ?? false } ?? hovered
    }
    private var states: AWCCheckboxStates {
        let hostPress = pointer.map { $0.isPointerDown && hover } ?? false
        return .init(hover: hover, focusVisible: focusHandle.isFocusVisible, active: (held || hostPress) && !model.disabled, pressed: pressed)
    }
    private struct Targets: Equatable { var scale: Double, layer: Double, fill: String, outline: String, selected: Bool }
    private var targets: Targets { let s = states, st = style; return .init(scale: st.scale(s), layer: st.layerOpacity(s), fill: st.containerColor, outline: st.outlineColor, selected: model.selected) }
    private func timing(_ key: String, _ fallback: Double, _ easing: String, _ curve: [Double]) -> (Double, [Double]) {
        if reduced { return (0, curve) }
        return (awcCSSDuration(theme.tokens["--md-sys-motion-duration-\(key)"]) ?? fallback, awcCSSCubicBezier(theme.tokens["--md-sys-motion-easing-\(easing)"]) ?? curve)
    }
    private var standard: [Double] { awcCSSCubicBezier(theme.tokens["--md-sys-motion-easing-standard"]) ?? [0.2, 0, 0, 1] }
    private func apply(_ next: Targets) {
        let now = CACurrentMediaTime() * 1000
        guard primed else {
            scaleTrack.snap(next.scale); layerTrack.snap(next.layer)
            fillTrack.set(Color(awcHex: next.fill), now: 0, duration: 0, curve: [0, 0, 1, 1]); outlineTrack.set(Color(awcHex: next.outline), now: 0, duration: 0, curve: [0, 0, 1, 1])
            if next.selected && !reduced { glyphStart = now }   // the entrance animation also runs on first render
            lastSelected = next.selected; primed = true; return
        }
        let colors = timing("short2", 200, "standard", [0.2, 0, 0, 1])
        // Pressing uses the pressed rule's transform transition; releasing the base rule's spring-back.
        let transform = next.scale < 1 ? timing("short4", 200, "standard", [0.2, 0, 0, 1]) : timing("medium4", 400, "emphasized-decelerate", [0.05, 0.7, 0.1, 1])
        scaleTrack.set(next.scale, now: now, duration: transform.0, curve: transform.1)
        layerTrack.set(next.layer, now: now, duration: timing("short1", 100, "standard", [0.2, 0, 0, 1]).0, curve: standard)
        fillTrack.set(Color(awcHex: next.fill), now: now, duration: colors.0, curve: colors.1)
        outlineTrack.set(Color(awcHex: next.outline), now: now, duration: colors.0, curve: colors.1)
        // The glyph entrance plays when the mark appears (checked ↔ indeterminate keeps the running animation).
        if next.selected && !lastSelected { glyphStart = reduced ? nil : now }
        if !next.selected { glyphStart = nil }
        lastSelected = next.selected
    }
    @State private var lastSelected = false
    private var glyphDuration: Double { reduced ? 0 : awcCSSDuration(theme.tokens["--md-sys-motion-duration-short2"]) ?? 200 }
    private func running(_ now: Double) -> Bool {
        scaleTrack.isRunning(now) || layerTrack.isRunning(now) || fillTrack.isRunning(now) || outlineTrack.isRunning(now) || (glyphStart.map { now < $0 + glyphDuration } ?? false) || (wave.map { !$0.done(now) } ?? false)
    }

    var body: some View {
        if model.hidden { EmptyView() } else {
            let now = CACurrentMediaTime() * 1000
            TimelineView(.animation(paused: !running(now))) { _ in control(CACurrentMediaTime() * 1000) }
                .onChange(of: targets, initial: true) { _, next in apply(next) }
                .task(id: targets) { await Task.yield(); if !Task.isCancelled { apply(targets) } }
                .modifier(AWCSelectionValidationModifier(nodeID: node.id, state: validation, missing: validityMissing, missingMessage: validityMessage, barred: node.properties["disabled"]?.bool ?? false, name: node.properties["name"]?.string ?? "", formResets: formResets, focus: { focusHandle.requestFocus?() ?? false }, blur: { focusHandle.resignFocus?() }, select: {}, changed: validityChanged))
        }
    }

    private func control(_ t: Double) -> some View {
        let st = style, s = states, m = model
        let touch = st.touch, c = st.container, sl = st.stateLayer
        let scale = reduced ? targets.scale : scaleTrack.presented(t)
        let layer = reduced ? targets.layer : layerTrack.presented(t)
        let fill = reduced ? Color(awcHex: targets.fill) : fillTrack.presented(t) ?? Color(awcHex: targets.fill)
        let outline = reduced ? Color(awcHex: targets.outline) : outlineTrack.presented(t) ?? Color(awcHex: targets.outline)
        let glyph = m.selected ? AWCCheckboxGlyph.frame(glyphStart.map { t - $0 } ?? (lastSelected || reduced ? glyphDuration : 0), duration: glyphDuration, curve: standard) : (scale: 1.0, opacity: 1.0)
        let support = m.supportMessage, hasSupport = !support.isEmpty
        let hostH = hasSupport ? touch + 2 + max(st.supportLineHeight, supportFrame.height) : touch
        let ring = s.focusVisible
        let rtl = direction == .rightToLeft, inset = (touch - c) / 2
        let shape = AWCNativeCornerShape(corners: st.shape)
        return ZStack(alignment: .topLeading) {
            ZStack {
                if let target = parts.targetColor { Circle().fill(Color(awcHex: target)) }
                if st.layerVisible { Circle().fill(Color(awcHex: st.stateLayerColor)).opacity(layer).frame(width: sl, height: sl) }
                if !m.disabledClass, let w = wave, let f = w.frame(t) {
                    ZStack { Circle().fill(Color(awcHex: st.stateLayerColor)).frame(width: 2 * w.radius * f.scale, height: 2 * w.radius * f.scale).position(x: w.origin.x, y: w.origin.y) }
                        .frame(width: sl, height: sl).clipShape(Circle()).opacity(f.opacity)
                }
                ZStack {
                    shape.fill(fill).overlay { shape.strokeBorder(outline, lineWidth: st.outlineWidth) }
                    Text(m.glyph).font(Font(AWCCheckboxGlyph.font(size: st.icon))).foregroundStyle(Color(awcHex: st.iconColor)).accessibilityHidden(true)
                        .lineLimit(1).fixedSize().frame(width: st.icon, height: st.icon)
                        .scaleEffect(max(0.0001, glyph.scale)).opacity(m.selected ? glyph.opacity : 0)
                }
                .frame(width: c, height: c).scaleEffect(scale)
            }
            .frame(width: touch, height: touch).clipShape(Circle()).accessibilityElement(children: .ignore).accessibilityHidden(true)
            if ring {
                let o = st.ringOffset
                if hasSupport { Rectangle().inset(by: -o - 1).stroke(Color(awcHex: st.focusRingColor), lineWidth: 2).frame(width: touch, height: hostH) }
                else { Circle().inset(by: -o - 1).stroke(Color(awcHex: st.focusRingColor), lineWidth: 2).frame(width: touch, height: touch) }
            }
            if hasSupport {
                Text(support).font(AWCNativeFonts.label(size: st.supportFontSize, weight: 400)).foregroundStyle(Color(awcHex: st.supportColor))
                    .lineLimit(1).fixedSize().frame(height: st.supportLineHeight)
                    .onGeometryChange(for: CGRect.self) { $0.frame(in: .named("awc-native-preview")) } action: { supportFrame = $0 }
                    .padding(rtl ? .trailing : .leading, inset)
                    .frame(width: touch, alignment: rtl ? .trailing : .leading)
                    .offset(y: touch + 2)
                    .accessibilityAddTraits(m.hasError ? .isStaticText : [])
                    .accessibilityHidden(m.decorative)
            }
        }
        .frame(width: touch, height: hostH, alignment: .topLeading)
        .environment(\.layoutDirection, .leftToRight)
        .contentShape(Rectangle())
        .onGeometryChange(for: CGRect.self) { $0.frame(in: .named("awc-native-preview")) } action: { frame = $0 }
        .onGeometryChange(for: CGRect.self) { $0.frame(in: .global) } action: { globalFrame = $0 }
        .onContinuousHover(coordinateSpace: .global) { phase in var next = false; if case .active = phase { next = true }; if hovered != next { hovered = next } }
        .gesture(pointerGesture)
        .allowsHitTesting(!m.disabled)
        .awcFocusBridgeLayer {
            AWCNativeButtonFocusBridge(configuration: .init(id: node.id, label: label,
                policy: AWCButtonAccessibilityPolicy(properties: ["disabled": .bool(m.disabled), "softDisabled": .bool(m.softDisabled), "roleOverride": "checkbox", "selected": .bool(m.checked && !m.indeterminate), "mixed": .bool(m.indeterminate), "invalid": .bool(m.hasError || (node.properties["required"]?.bool == true && !m.checked)), "required": .bool(node.properties["required"]?.bool == true), "errorText": .string(m.hasError ? m.supportMessage : ""),
                                                                  "groupTabindex": m.decorative ? .number(-1) : .null]),
                group: nil, cell: nil, handle: focusHandle, focusChanged: { _ in }, activate: { if !model.disabledClass { toggle() } },
                routeKey: { key, _, modified in
                    guard !modified else { return false }
                    if key == "Space" { if !awcSelectionKeyRepeat() { keyboardToggle() }; return true }   // a held Space toggles once
                    return key == "Enter"   // Space only; Enter is reserved for form submission
                })).accessibilityHidden(m.decorative)   // decorative: fix-ax-7
        }
        // The Web error line is role="alert": announce it assertively when it appears or changes.
        .onChange(of: m.hasError ? m.supportMessage : "") { _, message in if !message.isEmpty { var text = AttributedString(message); text.accessibilitySpeechAnnouncementPriority = .high; AccessibilityNotification.Announcement(text).post() } }
        .awcInspect(nodeID: node.id, name: "md-checkbox") { _ in
            func rgba(_ c: Color) -> AWCValue { let r = c.resolve(in: EnvironmentValues()); return .array([.number(Double(r.red)), .number(Double(r.green)), .number(Double(r.blue)), .number(Double(r.opacity))]) }
            return ["renderTime": .number(t), "touch": .number(touch), "containerSize": .number(c), "containerX": .number(inset), "iconSize": .number(st.icon), "stateLayerSize": .number(sl),
                    "outlineWidth": .number(st.outlineWidth), "containerColor": rgba(fill), "outlineColor": rgba(outline), "scale": .number(scale),
                    "layerOpacity": .number(st.layerVisible ? layer : -1), "layerColor": rgba(Color(awcHex: st.stateLayerColor)), "iconColor": rgba(Color(awcHex: st.iconColor)),
                    "iconOpacity": .number(m.selected ? 1 : 0), "glyph": .string(m.glyph), "glyphScale": .number(glyph.scale), "glyphOpacity": .number(glyph.opacity),
                    "focusRing": .bool(ring), "ringOffset": .number(st.ringOffset), "support": .string(support), "supportColor": rgba(Color(awcHex: st.supportColor)),
                    "supportX": .number(supportFrame.minX), "supportY": .number(supportFrame.minY), "supportWidth": .number(supportFrame.width), "hostHeight": .number(hostH),
                    "targetColor": parts.targetColor.map { rgba(Color(awcHex: $0)) } ?? .null,
                    "hover": .bool(s.hover), "pressed": .bool(s.pressed), "active": .bool(s.active), "focused": .bool(focusHandle.isFocused), "focusVisible": .bool(s.focusVisible),
                    "checked": .bool(m.checked), "indeterminate": .bool(m.indeterminate), "tabindex": .number(m.decorative ? -2 : m.disabled ? -1 : 0),
                    "waveScale": wave.flatMap { $0.frame(t) }.map { .number($0.scale) } ?? .null, "waveOpacity": .number(wave.flatMap { $0.frame(t) }?.opacity ?? 0)]
        }
    }

    // MARK: Pointer and keyboard

    private var pointerGesture: some Gesture {
        DragGesture(minimumDistance: 0, coordinateSpace: .global)
            .onChanged { value in
                if !began {
                    began = true; held = true
                    if !model.disabledClass { pressed = true }   // pointerdown
                    // md-ripple: a press on the (circular) ripple layer starts a wave at the press point.
                    let st = style, sl = st.stateLayer, local = CGPoint(x: value.startLocation.x - globalFrame.minX - (st.touch - sl) / 2, y: value.startLocation.y - globalFrame.minY - (st.touch - sl) / 2)
                    if !model.disabledClass && hypot(local.x - sl / 2, local.y - sl / 2) <= sl / 2 {
                        let dx = max(local.x, sl - local.x), dy = max(local.y, sl - local.y)
                        wave = .init(origin: local, radius: hypot(dx, dy), began: CACurrentMediaTime() * 1000, released: nil)
                    }
                    if !model.decorative { _ = focusHandle.requestPointerFocus?() }
                }
                if pressed && !globalFrame.contains(value.location) { pressed = false }   // pointerleave
            }
            .onEnded { value in
                began = false; held = false; pressed = false
                if wave != nil && wave?.released == nil { wave?.released = CACurrentMediaTime() * 1000 }
                if globalFrame.contains(value.location) && !model.disabledClass { toggle() }
            }
    }
    /// Space: toggle on keydown with a 150 ms pressed pulse (source `handleKeyDown`; a held key acts once).
    private func keyboardToggle() {
        guard !model.disabledClass else { return }
        let sl = style.stateLayer, now = CACurrentMediaTime() * 1000
        wave = .init(origin: CGPoint(x: sl / 2, y: sl / 2), radius: hypot(sl / 2, sl / 2), began: now, released: now)   // triggerRipple: centred, grows then fades
        pressed = true; toggle()
        keyPressToken &+= 1; let token = keyPressToken
        Task { @MainActor in try? await Task.sleep(nanoseconds: 150_000_000); if keyPressToken == token { pressed = false } }
    }
}

extension AWCNativeView {
    /// md-checkbox: the dedicated renderer. The source has no slots: authored children are not rendered.
    var nativeCheckbox: some View {
        AWCNativeCheckbox(node: node, theme: theme, checked: b("checked"), indeterminate: b("indeterminate"), label: [node.properties["aria-label"]?.string, node.properties["ariaLabel"]?.string].compactMap { $0 }.first { !$0.isEmpty } ?? "",
                          validationMessage: registeredForm?.validationMessages[formRegistrationID] ?? "", toggle: { checkboxToggle() }, validityChanged: { emit("mdValidityChange", $0) }, formResets: registeredForm?.resetCount ?? 0)
    }
    /// `handleClick`: indeterminate becomes checked; otherwise checked flips; then mdChange (not cancelable).
    func checkboxToggle() {
        let next = b("indeterminate") ? true : !b("checked")
        set("indeterminate", false); set("checked", .bool(next))
        emit("mdChange", ["checked": .bool(next), "indeterminate": false])
    }
}
