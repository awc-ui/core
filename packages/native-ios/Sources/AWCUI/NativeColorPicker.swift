import SwiftUI
import Observation
#if canImport(AppKit)
import AppKit
#else
import UIKit
#endif

// md-color-picker: dedicated SwiftUI renderer (inline panel and popover variant) of the Web component
// (packages/core/src/components/md-color-picker): HSV plate, hue and alpha tracks, preview, hex and channel fields,
// presets; pointer drags with clamping, keyboard steps, events (mdInput / mdChange / mdOpenChange), methods
// (show / close), hooks (AWCColorPickerAppearance), density, RTL, reduced motion. Geometry and paint follow
// md-color-picker.css; behaviour follows md-color-picker.tsx statement by statement (see the source review).

/// Resolved geometry: hooks, density scale (panel padding / gap) and the spacing-token rung (field insets / gaps).
struct AWCColorPickerMetrics {
    let width, plateHeight, radius, thumb, preset: Double
    let padding, gap, insetSm, gapXs, gapSm, gapMd: Double
    init(_ a: AWCColorPickerAppearance, scale: Double, rung: Double) {
        width = a.width ?? 296; plateHeight = a.plateHeight ?? 176; radius = a.radius ?? 28; thumb = a.thumbSize ?? 18; preset = a.presetSize ?? 32
        padding = max(4, 20 + scale * 2); gap = max(4, 14 + scale * 2)
        insetSm = rung <= -3 ? 4 : 8; gapXs = rung <= -4 ? 2 : 4; gapSm = rung <= -3 ? 4 : 8; gapMd = rung <= -4 ? 4 : rung <= -2 ? 8 : 12
    }
    /// Input box: inset padding, 1px border, a 15px line box (13px text, `line-height: normal`).
    var inputHeight: Double { insetSm * 2 + 2 + 15 }
    var fieldHeight: Double { 16 + gapXs + inputHeight }
}

/// Mutable state of one picker (the Web component's @State and private fields).
@Observable final class AWCColorPickerRuntime {
    /// Mounted pickers by node id (tests and the Laboratory host reach a picker's fields and methods through it).
    @MainActor static var mounted: [String: Weak] = [:]
    final class Weak { weak var runtime: AWCColorPickerRuntime?; init(_ r: AWCColorPickerRuntime) { runtime = r } }
    var hsva = AWCHsva(h: 268, s: 53, v: 64, a: 1)
    var hexInput = ""
    var hexInvalid = false
    @ObservationIgnored var lastEmitted = ""
    /// What the host sees after the last render (value, open, selected presets, channel field texts): tests and the Laboratory probe.
    @ObservationIgnored var snapshot: (value: String, open: Bool, selected: [String], channels: [String]) = ("", false, [], [])
    @ObservationIgnored var loaded = false
    @ObservationIgnored var appliedValue: String?
    /// Part held by the primary pointer (`:active`): plate, hue, alpha, preset-N.
    var active: String?
    /// Part under the pointer (`:hover`).
    var hovered: String?
    var focused: String?
    var focusVisible = false
    /// Channel field text while it is being edited (a number input keeps the typed text until `change`).
    var editing: [String: String] = [:]
    @ObservationIgnored var editStart: [String: String] = [:]
    var openSerial = 0
    /// When the open popover first rendered (ms): the pop-in's 300ms clock (the keyframes start in the frame that renders
    /// the open state).
    @ObservationIgnored var openedAt: Double?
    @ObservationIgnored var dismissingOutside = false
    @ObservationIgnored var controls: [String: AWCColorPickerControlHandle] = [:]
    @ObservationIgnored var inputs: [String: AWCFieldInputHandle] = [:]
    @ObservationIgnored let triggerTarget = AWCPopupTarget(id: "")
    /// Part frames in the "awc-native-preview" space (hover from a host-supplied pointer).
    @ObservationIgnored var frames: [String: CGRect] = [:]
    /// Presented motion values per key (popover: opacity, scale, translateY; preset-N: scale, angle; thumb-<part>: press
    /// fraction) with their frame times in ms: the interaction suites compare them with Chrome's sampled transforms.
    @ObservationIgnored var motion: [String: [(t: Double, v: [Double])]] = [:]
    func record(_ key: String, _ v: [Double]) {
        let t = CACurrentMediaTime() * 1000
        var list = motion[key] ?? []
        if let last = list.last, last.v == v { return }
        list.append((t, v)); if list.count > 400 { list.removeFirst(list.count - 400) }
        motion[key] = list
    }
    /// CSS transitions of the thumbs' press fraction and the presets' transform (scale, angle): retargets start from the
    /// presented value, one frame after the state change (the source renders state in its next frame).
    @ObservationIgnored var transitions: [String: AWCColorPickerTransition] = [:]
    /// Bumped when a started transition has ended, so the views pause their frame timeline again.
    var settle = 0
    /// The track before a change that has not reached its frame yet, and that frame's time, by key.
    @ObservationIgnored var pendingTransitions: [String: (base: AWCColorPickerTransition, start: Double)] = [:]
    /// A style change starts its CSS transition in the next frame. Changes before that frame coalesce (Chrome computes the
    /// style once per frame): the transition runs from the style before the first of them to the last target, and a state
    /// set and reset within the frame starts none.
    @MainActor func retarget(_ key: String, _ target: [Double], duration: Double, curve: [Double]) {
        guard let track = transitions[key] else { transitions[key] = .init(target); return }
        guard track.value != target else { return }
        let now = CACurrentMediaTime() * 1000
        var base = track, start = now + AWCColorPickerMotion.frame * 1000
        if let pending = pendingTransitions[key], now < pending.start { base = pending.base; start = pending.start }
        pendingTransitions[key] = (base, start)
        var next = base
        next.set(target, now: start, duration: max(duration, 0.001), curve: curve); transitions[key] = next
        let wait = UInt64(max(0, AWCColorPickerMotion.frame * 1000 + duration) + 34) * 1_000_000
        Task { @MainActor [weak self] in try? await Task.sleep(nanoseconds: wait); self?.settle &+= 1 }
    }
    func presented(_ key: String, _ now: Double) -> [Double] { transitions[key]?.presented(now) ?? [] }
    func isRunning(_ key: String, _ now: Double) -> Bool { transitions[key]?.isRunning(now) ?? false }
    @MainActor func input(_ id: String) -> AWCFieldInputHandle { if let h = inputs[id] { return h }; let h = AWCFieldInputHandle(); inputs[id] = h; return h }
    @MainActor func control(_ id: String) -> AWCColorPickerControlHandle { if let h = controls[id] { return h }; let h = AWCColorPickerControlHandle(); controls[id] = h; return h }
}

/// Focus access to a plate / track bridge.
@MainActor final class AWCColorPickerControlHandle {
    var focus: (Bool) -> Bool = { _ in false }
    var isFocused: () -> Bool = { false }
    var blur: () -> Void = {}
    /// Focus came from the keyboard (or a programmatic focus): `:focus-visible`.
    var showFocus = false
    var focused = false
}

struct AWCNativeColorPicker: View {
    let node: AWCNode
    let theme: AWCTheme
    let props: [String: AWCValue]
    let setProperty: (String, AWCValue) -> Void
    let emit: (String, AWCValue) -> Void
    let trigger: [AWCNode]
    let child: (AWCNode, ((AWCEvent) -> Void)?) -> AnyView
    @State private var rt = AWCColorPickerRuntime()
    @Environment(\.layoutDirection) private var direction
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.awcThemeTokens) private var themeTokens
    @Environment(\.awcColorPickerAppearance) private var inheritedAppearance
    @Environment(\.awcColorPickerAppearanceTargets) private var targetedAppearance
    @Environment(\.awcNativeDensity) private var inheritedDensity
    @Environment(\.awcNativeSpacingRung) private var inheritedRung
    @Environment(\.awcNativePointerState) private var pointer
    @Environment(\.accessibilityReduceMotion) private var systemReduceMotion
    @Environment(\.awcReducedMotion) private var reducedOverride
    @Environment(\.awcModalSession) private var modalSession
    @Environment(\.awcColorPickerControllers) private var controllers

    // MARK: Properties
    private func s(_ k: String, _ f: String = "") -> String { props[k]?.string ?? f }
    private func b(_ k: String, _ f: Bool = false) -> Bool { props[k]?.bool ?? f }
    private var value: String { s("value", "#6750A4") }
    private var format: String { ["hex", "rgb", "hsl"].contains(s("format")) ? s("format") : "hex" }
    private var alpha: Bool { b("alpha") }
    private var disabled: Bool { b("disabled") }
    private var popover: Bool { s("variant") == "popover" }
    private var open: Bool { b("open") }
    private var locale: String { s("locale", "en-US") }
    private var ariaLabel: String { [s("ariaLabelProp"), s("aria-label"), s("ariaLabel")].first { !$0.isEmpty } ?? "Color picker" }
    private var rtl: Bool { direction == .rightToLeft }
    private var reduceMotion: Bool { reducedOverride ?? systemReduceMotion }
    private var presets: [String] {
        let raw: [String]
        switch props["presets"] {
        case .array(let a)?: raw = a.map { $0.string }
        case .string(let t)?: raw = t.split(separator: ",", omittingEmptySubsequences: false).map(String.init)
        default: raw = []
        }
        return raw.map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }
    }
    private var tokens: [String: String] {
        if !themeTokens.isEmpty { return themeTokens }
        if !theme.tokens.isEmpty { return theme.tokens }
        return colorScheme == .dark ? AWCGeneratedTokens.dark : AWCGeneratedTokens.light
    }
    private func role(_ name: String) -> Color { Color(awcHex: tokens["--md-sys-color-" + name] ?? "#000000") }
    private var appearance: AWCColorPickerAppearance { inheritedAppearance.merging(targetedAppearance[node.id] ?? .init()) }
    private var metrics: AWCColorPickerMetrics {
        let local = props["density"]?.number
        let scale = AWCNativeDensity.resolve(local, inherited: inheritedDensity)
        let rung = local.flatMap { [-1.0, -2, -3, -4].contains($0) ? $0 : nil } ?? inheritedRung
        return .init(appearance, scale: scale, rung: rung)
    }
    private var surface: Color { appearance.surfaceColor.map { Color(awcHex: $0) } ?? role("surface-container-high") }
    private var onSurface: Color { appearance.onSurface.map { Color(awcHex: $0) } ?? role("on-surface") }
    private var outline: Color { appearance.outlineColor.map { Color(awcHex: $0) } ?? role("outline-variant") }
    private var outlineStrong: Color { appearance.outlineStrong.map { Color(awcHex: $0) } ?? role("outline") }
    private var primary: Color { role("primary") }
    private var thumbBorder: Color { appearance.thumbBorder.map { Color(awcHex: $0) } ?? .white }
    private func elevation(_ level: Int) -> [AWCBoxShadow] { AWCBoxShadow.source(tokens["--md-sys-elevation-\(level)"] ?? "none") ?? [] }
    // The source applies interaction state in its next render (Stencil batches state into the next animation frame), so a
    // state's paint, or the CSS transition it starts, lands one frame after the input; a state set and reset within that
    // frame never paints. The model, events and accessibility change at once; the paint follows one frame later, also
    // under reduced motion (where it then changes at once).
    private var stateAnimation: Animation? { reduceMotion ? AWCColorPickerMotion.nextFrame : .timingCurve(0.34, 0.80, 0.34, 1.00, duration: 0.2).delay(AWCColorPickerMotion.frame) }
    private var springAnimation: Animation? { reduceMotion ? AWCColorPickerMotion.nextFrame : .timingCurve(0.42, 1.67, 0.21, 0.90, duration: 0.35).delay(AWCColorPickerMotion.frame) }

    // MARK: Behaviour (md-color-picker.tsx)
    private func applyValue(_ input: String, emit doEmit: Bool) {
        if let parsed = AWCColorMath.parse(input) {
            rt.hsva = parsed; rt.hexInput = AWCColorMath.hex(parsed, withAlpha: alpha && parsed.a < 1); rt.hexInvalid = false
            if doEmit { emitValue() }
        } else { rt.hexInvalid = true }
    }
    private func emitValue(commit: Bool = false) {
        // Against the value last applied (a closure can run twice before the view re-renders with the new property,
        // e.g. UIKit delivers a touch's last move and its end in one turn).
        let out = AWCColorMath.format(rt.hsva, format)
        if out != (rt.appliedValue ?? value) {
            rt.lastEmitted = out; rt.appliedValue = out; setProperty("value", .string(out))
            emit("mdInput", ["value": .string(out)])
            if commit { emit("mdChange", ["value": .string(out)]) }
        } else if commit { emit("mdChange", ["value": .string(out)]) }
    }
    private func syncHex(alphaAlways: Bool = false) { rt.hexInput = AWCColorMath.hex(rt.hsva, withAlpha: alphaAlways || (alpha && rt.hsva.a < 1)); rt.hexInvalid = false }
    private func horizontalRatio(_ x: Double, _ w: Double) -> Double { guard w > 0 else { return 0 }; return rtl ? (w - x) / w : x / w }
    private func updatePlate(_ p: CGPoint, _ size: CGSize) {
        let s = max(0, min(100, horizontalRatio(p.x, size.width) * 100)), v = max(0, min(100, 100 - (p.y / size.height) * 100))
        rt.hsva.s = s; rt.hsva.v = v; syncHex(); emitValue()
    }
    private func updateHue(_ x: Double, _ w: Double) { rt.hsva.h = max(0, min(1, horizontalRatio(x, w))) * 360; syncHex(); emitValue() }
    private func updateAlpha(_ x: Double, _ w: Double) { rt.hsva.a = max(0, min(1, horizontalRatio(x, w))); syncHex(alphaAlways: true); emitValue() }
    private func key(_ part: String, _ key: String, _ shift: Bool) -> Bool {
        guard !disabled else { return false }
        if key == "Escape" { return escape() }
        switch part {
        case "plate":
            let step = shift ? 10.0 : 1; var s = rt.hsva.s, v = rt.hsva.v
            switch key {
            case "ArrowLeft": s += rtl ? step : -step
            case "ArrowRight": s += rtl ? -step : step
            case "ArrowDown": v -= step
            case "ArrowUp": v += step
            case "Home": s = 0
            case "End": s = 100
            case "PageDown": v = 0
            case "PageUp": v = 100
            default: return false
            }
            rt.hsva.s = max(0, min(100, s)); rt.hsva.v = max(0, min(100, v)); syncHex(); emitValue(commit: true); return true
        case "hue":
            let step = shift ? 15.0 : 1; var h = rt.hsva.h
            switch key {
            case "ArrowLeft": h += rtl ? step : -step
            case "ArrowRight": h += rtl ? -step : step
            case "Home": h = 0
            case "End": h = 360
            default: return false
            }
            rt.hsva.h = (h.truncatingRemainder(dividingBy: 360) + 360).truncatingRemainder(dividingBy: 360); syncHex(); emitValue(commit: true); return true
        default:
            let step = shift ? 0.1 : 0.01; var a = rt.hsva.a
            switch key {
            case "ArrowLeft": a += rtl ? step : -step
            case "ArrowRight": a += rtl ? -step : step
            case "Home": a = 0
            case "End": a = 1
            default: return false
            }
            rt.hsva.a = max(0, min(1, a)); syncHex(alphaAlways: true); emitValue(commit: true); return true
        }
    }
    private func hexEdited(_ text: String) {
        rt.hexInput = text
        if let parsed = AWCColorMath.parse(text.hasPrefix("#") ? text : "#" + text) { rt.hsva = parsed; rt.hexInvalid = false; emitValue() } else { rt.hexInvalid = true }
    }
    private func hexBlurred() {
        if rt.hexInvalid { syncHex() }
        emitValue(commit: true)
    }
    private func channelValue(_ ch: String) -> String {
        let rgb = AWCColorMath.rgba(rt.hsva), hsl = AWCColorMath.hsl(rt.hsva)
        switch ch {
        case "r": return String(Int(rgb.r)); case "g": return String(Int(rgb.g)); case "b": return String(Int(rgb.b))
        case "h": return String(Int(AWCColorMath.jsRound(hsl.h))); case "s": return String(Int(AWCColorMath.jsRound(hsl.s))); case "l": return String(Int(AWCColorMath.jsRound(hsl.l)))
        default: return AWCColorMath.fixed2(rt.hsva.a)
        }
    }
    private func fromChannels(_ r: Double, _ g: Double, _ b: Double) {
        let hex = "#" + [r, g, b].map { String(format: "%02x", Int($0)) }.joined()
        if let parsed = AWCColorMath.parse(hex) { rt.hsva = AWCHsva(h: parsed.h, s: parsed.s, v: parsed.v, a: rt.hsva.a); syncHex(); emitValue(commit: true) }
    }
    /// Number input `change`: the value differs from the one it had when focus entered (or Enter after an edit).
    private func channelCommit(_ ch: String) {
        guard let text = rt.editing[ch] else { return }
        let start = rt.editStart[ch] ?? channelValue(ch)
        rt.editing[ch] = nil
        guard text != start else { return }
        if ch == "a" {
            let n = AWCColorMath.parseFloat(text); rt.hsva.a = max(0, min(1, n.isNaN ? 0 : n)); rt.hexInput = AWCColorMath.hex(rt.hsva, withAlpha: true); emitValue(commit: true); return
        }
        let raw = AWCColorMath.parseInt(text) ?? 0
        if ["r", "g", "b"].contains(ch) {
            let num = max(0, min(255, raw)), rgb = AWCColorMath.rgba(rt.hsva)
            fromChannels(ch == "r" ? num : rgb.r, ch == "g" ? num : rgb.g, ch == "b" ? num : rgb.b)
        } else {
            let hsl = AWCColorMath.hsl(rt.hsva)
            let h = ch == "h" ? max(0, min(360, raw)) : hsl.h, sat = ch == "s" ? max(0, min(100, raw)) : hsl.s, l = ch == "l" ? max(0, min(100, raw)) : hsl.l
            let v = AWCColorMath.hslToRgb(h, sat, l); fromChannels(v.r, v.g, v.b)
        }
    }
    private func isSelected(_ preset: String) -> Bool {
        guard let parsed = AWCColorMath.parse(preset) else { return false }
        return AWCColorMath.hex(parsed, withAlpha: true) == AWCColorMath.hex(rt.hsva, withAlpha: true)
    }
    private func presetActivated(_ preset: String) {
        guard !disabled else { return }
        // Web: one input event for the new value, then change (an unchanged value only commits).
        applyValue(preset, emit: false); emitValue(commit: true)
    }
    // Popover lifecycle.
    private func setOpen(_ v: Bool) {
        guard v != open else { return }
        setProperty("open", .bool(v))
    }
    private func openChanged(_ v: Bool) {
        if !v && !rt.dismissingOutside, let f = rt.focused, f != "trigger" { _ = rt.triggerTarget.focus() }
        rt.dismissingOutside = false
        if !v { rt.focused = nil }
        rt.openSerial &+= 1
        emit("mdOpenChange", ["open": .bool(v)])
    }
    private func escape() -> Bool { guard popover && open else { return false }; setOpen(false); return true }
    /// Escape that reached the picker's host (Web: the keydown listener of the open picker, which stops propagation, so an
    /// enclosing md-dialog stays open): consumed when focus is inside the picker or on its trigger.
    /// The popover's first rendered frame starts its pop-in clock; a closed popover keeps no part transitions (the reopened
    /// panel renders fresh, as the source re-creates it).
    private func notePopoverOpen() {
        guard popover else { return }
        if open, rt.openedAt == nil {
            rt.openedAt = CACurrentMediaTime() * 1000
            Task { @MainActor [rt] in try? await Task.sleep(nanoseconds: 334_000_000); rt.settle &+= 1 }
        } else if !open, rt.openedAt != nil { rt.openedAt = nil; rt.transitions = [:]; rt.pendingTransitions = [:] }
    }
    private func registerEscapeClaim() {
        guard popover, let modalSession else { return }
        modalSession.escapeClaims[ObjectIdentifier(rt)] = { [self] in escapeIfFocusedInside() }
    }
    private func escapeIfFocusedInside() -> Bool {
        guard popover && open && !disabled else { return false }
        guard rt.focused != nil || rt.triggerTarget.handles.values.contains(where: { $0.isFocused }) else { return false }
        return escape()
    }
    private func toggleFromTrigger() { guard !disabled else { return }; setOpen(!open) }
    /// Methods: the bound AWCColorPickerController acts on this render's state (`show()` / `close()`, popover only, as the source).
    private func bindController() {
        guard let c = controllers[node.id] ?? controllers[""] else { return }
        c.runtime = rt
        c.showAction = { [self] in if popover && !disabled { setOpen(true) } }
        c.closeAction = { [self] in if popover { setOpen(false) } }
    }

    // MARK: Body
    var body: some View {
        let m = metrics
        let channelIDs = !b("showInputs", true) ? [] : (format == "hsl" ? ["h", "s", "l"] : ["r", "g", "b"]) + (alpha ? ["a"] : [])
        let _ = (rt.snapshot = (value, open, popover && !open ? [] : presets.filter { isSelected($0) }, channelIDs.map { rt.editing[$0] ?? channelValue($0) }))
        // Escape on the focused trigger closes the popover; inside a modal the picker claims Escape before the modal owner.
        let _ = (rt.triggerTarget.escape = { [self] in escape() })
        let _ = registerEscapeClaim()
        let _ = notePopoverOpen()
        let _ = bindController()
        Group {
            if popover {
                popoverHost(m)
            } else {
                panel(m, inPopover: false)
                    .accessibilityElement(children: .contain).accessibilityLabel(ariaLabel)
                    .awcInspect(nodeID: node.id, name: "md-color-picker") { _ in ["variant": "inline"] }
            }
        }
        .onAppear { AWCColorPickerRuntime.mounted[node.id] = .init(rt); if !rt.loaded { rt.loaded = true; rt.appliedValue = value; applyValue(value, emit: false) } }
        .onChange(of: value) { _, v in
            if v == rt.lastEmitted { rt.lastEmitted = "" ; rt.appliedValue = v; return }
            rt.appliedValue = v; applyValue(v, emit: false)
        }
        .onChange(of: open) { _, v in if popover { openChanged(v) } }
        .onDisappear { modalSession?.escapeClaims[ObjectIdentifier(rt)] = nil }
    }

    @ViewBuilder private func popoverHost(_ m: AWCColorPickerMetrics) -> some View {
        HStack(spacing: 0) {
            ForEach(trigger) { t in
                child(t, { e in if e.name == "mdClick" { toggleFromTrigger() } })
                    .environment(\.awcPopupTarget, rt.triggerTarget)
            }
        }
        .fixedSize()
        .awcInspect(nodeID: node.id, name: "md-color-picker") { _ in ["variant": "popover", "open": .bool(open)] }
        .overlay(alignment: .topLeading) {
            if open {
                GeometryReader { g in
                    popoverPanel(m).offset(y: g.size.height + 8)
                }
            }
        }
        .zIndex(open ? 1 : 0)
        .background {
            AWCColorPickerOutsidePressRegion(owner: rt)
                .onGeometryChange(for: CGRect.self) { $0.frame(in: .named("awc-native-preview")) } action: { AWCColorPickerPreviewRegions.set($0, "host", owner: ObjectIdentifier(rt)) }
            if popover && open && b("dismissOnOutsideClick") && !disabled { AWCColorPickerOutsidePress(owner: rt) { rt.dismissingOutside = true; setOpen(false) } }
        }
    }

    @ViewBuilder private func popoverPanel(_ m: AWCColorPickerMetrics) -> some View {
        let shape = RoundedRectangle(cornerRadius: m.radius, style: .circular)
        let shadows = appearance.popoverElevation.flatMap { AWCBoxShadow.source($0) } ?? elevation(3)
        AWCColorPickerPopIn(runtime: rt, reduceMotion: reduceMotion, rtl: rtl, probe: { [rt] in rt.record("popover", $0) }) {
            panel(m, inPopover: true)
                .padding(m.padding)
                .frame(width: m.width, alignment: .topLeading)
                .background { ZStack { AWCNativeBoxShadow(corners: AWCColorPickerShapes.rounded(m.radius), layers: shadows, placement: .outer); shape.fill(surface) } }
                .awcInspect(nodeID: node.id, part: "popover", name: "popover") { _ in [:] }
        }
        .accessibilityElement(children: .contain).accessibilityLabel(ariaLabel).accessibilityAddTraits(.isModal)
        .background {
            AWCColorPickerOutsidePressRegion(owner: rt)
                .onGeometryChange(for: CGRect.self) { $0.frame(in: .named("awc-native-preview")) } action: { AWCColorPickerPreviewRegions.set($0, "popover", owner: ObjectIdentifier(rt)) }
        }
    }

    @ViewBuilder private func panel(_ m: AWCColorPickerMetrics, inPopover: Bool) -> some View {
        VStack(alignment: .leading, spacing: m.gap) {
            plate(m)
            HStack(alignment: .center, spacing: m.gap) {
                VStack(spacing: m.gapMd) {
                    track("hue", m)
                    if alpha { track("alpha", m) }
                }
                .frame(maxWidth: .infinity)
                preview(m)
            }
            .frame(height: 42)
            .awcInspect(nodeID: node.id, part: "sliders", name: "sliders") { _ in [:] }
            if b("showHex", true) { hexField(m) }
            if b("showInputs", true) { channelFields(m) }
            if !presets.isEmpty { presetList(m) }
        }
        .padding(inPopover ? 0 : m.padding)
        .frame(maxWidth: inPopover ? .infinity : m.width, alignment: .topLeading)
        .background { if !inPopover { RoundedRectangle(cornerRadius: m.radius, style: .circular).fill(surface) } }
        .foregroundStyle(onSurface)
        .awcInspect(nodeID: node.id, part: "panel", name: "panel") { _ in ["background": .string(inPopover ? "#00000000" : appearance.surfaceColor ?? (tokens["--md-sys-color-surface-container-high"] ?? ""))] }
    }

    // MARK: Plate
    private func plateThumbOffset(_ size: CGSize, _ t: Double) -> CGSize {
        let w = Double(size.width), h = Double(size.height), s = rt.hsva.s, v = rt.hsva.v
        let x: Double = rtl ? w - w * s / 100 + t / 2 - (t + 4) : w * s / 100 - t / 2
        let y: Double = h * (100 - v) / 100 - t / 2
        return CGSize(width: x, height: y)
    }
    private func plateCanvas(_ size: CGSize, _ m: AWCColorPickerMetrics) -> some View {
        let hueColor: Color = AWCColorMath.color(AWCHsva(h: rt.hsva.h, s: 100, v: 100, a: 1), alpha: false)
        let white = LinearGradient(colors: [.white, .white.opacity(0)], startPoint: rtl ? .trailing : .leading, endPoint: rtl ? .leading : .trailing)
        let black = LinearGradient(colors: [.black.opacity(0), .black], startPoint: .top, endPoint: .bottom)
        let thumb = AWCColorPickerThumb(key: "thumb-plate", runtime: rt, diameter: m.thumb + 4, fill: AWCColorMath.color(rt.hsva, alpha: true), border: thumbBorder, primary: primary,
                                        rest: elevation(1), pressedShadow: elevation(2), pressed: rt.active == "plate", reduceMotion: reduceMotion)
        // Thumbs are placed (not offset) so their measured frames are where they paint; inside the plate the coordinates
        // are absolute (left to right), the formulas already mirror for RTL.
        let o = plateThumbOffset(size, m.thumb), d = m.thumb + 4
        return ZStack(alignment: .topLeading) {
            hueColor
            white
            black
            thumb.awcInspect(nodeID: node.id, part: "thumb", name: "thumb") { _ in [:] }.position(x: o.width + d / 2, y: o.height + d / 2)
        }
        .frame(width: size.width, height: size.height)
        .environment(\.layoutDirection, .leftToRight)
    }
    private func plateGesture(_ size: CGSize) -> some Gesture {
        DragGesture(minimumDistance: 0, coordinateSpace: .local)
            .onChanged { v in
                guard !disabled else { return }
                if rt.active != "plate" { rt.active = "plate"; _ = rt.control("plate").focus(false) }
                updatePlate(v.location, size)
            }
            .onEnded { _ in guard rt.active == "plate" else { return }; rt.active = nil; emitValue(commit: true) }
    }
    private func plateBridge() -> AWCColorPickerControlBridge {
        AWCColorPickerControlBridge(id: node.id + "-plate", part: "plate", label: AWCColorPickerLabels.label(locale, "saturation"), role: .application,
                                    value: nil, disabled: disabled, handle: rt.control("plate"), focusChanged: { focused($0, "plate") }, key: { key("plate", $0, $1) })
    }
    @ViewBuilder private func plate(_ m: AWCColorPickerMetrics) -> some View {
        let shape = RoundedRectangle(cornerRadius: 16, style: .circular)
        GeometryReader { g in
            plateCanvas(g.size, m).clipShape(shape).contentShape(shape).gesture(plateGesture(g.size))
        }
        .frame(height: m.plateHeight)
        .compositingGroup().opacity(disabled ? 0.5 : 1)
        .overlay { focusRing("plate", shape: RoundedRectangle(cornerRadius: 21, style: .circular), offset: 2) }
        .overlay { plateBridge() }
        .awcInspect(nodeID: node.id, part: "plate", name: "plate") { _ in ["background": .string(AWCColorMath.hex(AWCHsva(h: rt.hsva.h, s: 100, v: 100, a: 1)))] }
        .onContinuousHover { phase in if case .active = phase { rt.hovered = "plate" } else if rt.hovered == "plate" { rt.hovered = nil } }.modifier(tracked("plate"))
    }

    // MARK: Tracks
    private func trackRatio(_ part: String) -> Double { part == "hue" ? rt.hsva.h / 360 : rt.hsva.a }
    private func trackThumbX(_ part: String, _ w: Double, _ t: Double) -> Double { let r = trackRatio(part); return rtl ? w - r * w + t / 2 - (t + 4) : r * w - t / 2 }
    @ViewBuilder private func trackFill(_ part: String) -> some View {
        let start: UnitPoint = rtl ? .trailing : .leading, end: UnitPoint = rtl ? .leading : .trailing
        if part == "hue" {
            AWCColorPickerHueGradient(rtl: rtl).clipShape(Capsule())
        } else {
            let base: Color = AWCColorMath.color(AWCHsva(h: rt.hsva.h, s: rt.hsva.s, v: rt.hsva.v, a: 1), alpha: false)
            AWCColorPickerChecker(origin: .zero).clipShape(Capsule())
            Capsule().fill(LinearGradient(colors: [base.opacity(0), base], startPoint: start, endPoint: end))
        }
    }
    private func trackCanvas(_ part: String, _ size: CGSize, _ m: AWCColorPickerMetrics) -> some View {
        let t = m.thumb, hovered = isHovered(part) && !disabled
        let fill: Color = part == "hue" ? AWCColorMath.color(AWCHsva(h: rt.hsva.h, s: 100, v: 100, a: 1), alpha: false) : AWCColorMath.color(rt.hsva, alpha: true)
        let thumb = AWCColorPickerThumb(key: "thumb-" + part, runtime: rt, diameter: t + 4, fill: fill, border: thumbBorder, primary: primary, rest: elevation(1), pressedShadow: elevation(2),
                                        pressed: rt.active == part, reduceMotion: reduceMotion)
        return trackFill(part)
            .frame(width: size.width, height: size.height)
            .background { Capsule().fill(onSurface.opacity(hovered ? 0.08 : 0)).padding(-4).animation(stateAnimation, value: hovered) }
            .overlay(alignment: .topLeading) {
                ZStack(alignment: .topLeading) {
                    thumb.awcInspect(nodeID: node.id, part: part + "-thumb", name: part + "-thumb") { _ in [:] }
                        .position(x: trackThumbX(part, size.width, t) + (t + 4) / 2, y: size.height / 2)
                }
                .frame(width: size.width, height: size.height)
                .environment(\.layoutDirection, .leftToRight)
            }
    }
    private func trackGesture(_ part: String, _ w: Double) -> some Gesture {
        DragGesture(minimumDistance: 0, coordinateSpace: .local)
            .onChanged { v in
                guard !disabled else { return }
                if rt.active != part { rt.active = part; _ = rt.control(part).focus(false) }
                if part == "hue" { updateHue(v.location.x, w) } else { updateAlpha(v.location.x, w) }
            }
            .onEnded { _ in guard rt.active == part else { return }; rt.active = nil; emitValue(commit: true) }
    }
    private func trackValue(_ part: String) -> String { part == "hue" ? String(Int(AWCColorMath.jsRound(rt.hsva.h))) : AWCColorMath.fixed2(rt.hsva.a) }
    private func trackBridge(_ part: String) -> AWCColorPickerControlBridge {
        AWCColorPickerControlBridge(id: node.id + "-" + part, part: part, label: AWCColorPickerLabels.label(locale, part == "hue" ? "hue" : "opacity"), role: .slider,
                                    value: trackValue(part), disabled: disabled, handle: rt.control(part), focusChanged: { focused($0, part) }, key: { key(part, $0, $1) })
    }
    @ViewBuilder private func track(_ part: String, _ m: AWCColorPickerMetrics) -> some View {
        let t = m.thumb, hit = max(14, t)
        GeometryReader { g in
            trackCanvas(part, g.size, m)
                .contentShape(Rectangle().size(width: g.size.width + t, height: hit).offset(x: -t / 2, y: (g.size.height - hit) / 2))
                .gesture(trackGesture(part, g.size.width))
        }
        .frame(height: 14)
        .compositingGroup().opacity(disabled ? 0.5 : 1)
        .overlay { focusRing(part, shape: Capsule(), offset: 4) }
        .overlay { trackBridge(part) }
        .awcInspect(nodeID: node.id, part: part, name: part) { _ in ["valueNow": .string(trackValue(part))] }
        .onContinuousHover { phase in if case .active = phase { rt.hovered = part } else if rt.hovered == part { rt.hovered = nil } }.modifier(tracked(part))
    }

    // MARK: Preview
    @ViewBuilder private func preview(_ m: AWCColorPickerMetrics) -> some View {
        ZStack {
            AWCColorPickerChecker(origin: CGPoint(x: 1, y: 1)).clipShape(Circle()).padding(1)
            Circle().fill(AWCColorMath.color(rt.hsva, alpha: true)).padding(1).animation(stateAnimation, value: rt.hsva)
            Circle().strokeBorder(outline, lineWidth: 1)
        }
        .frame(width: 42, height: 42)
        .accessibilityElement().accessibilityLabel("\(AWCColorPickerLabels.label(locale, "current")) \(AWCColorMath.format(rt.hsva, format))").accessibilityAddTraits(.isImage)
        .awcInspect(nodeID: node.id, part: "preview", name: "preview") { _ in ["color": .string(AWCColorMath.hex(rt.hsva, withAlpha: true))] }
    }

    // MARK: Fields
    private func fieldLabel(_ text: String) -> some View {
        Text(text.uppercased()).font(AWCNativeFonts.label(size: 11, weight: 500)).tracking(0.5).lineLimit(1)
            .foregroundStyle(role("on-surface-variant")).frame(height: 16).frame(maxWidth: .infinity, alignment: .leading)
            .accessibilityHidden(true)
    }
    @ViewBuilder private func inputBox(_ id: String, text: String, label: String, mono: Bool, centered: Bool, invalid: Bool, m: AWCColorPickerMetrics,
                                       edited: @escaping (String) -> Void, focus: @escaping (Bool) -> Void, command: @escaping (String) -> Bool) -> some View {
        let focusedHere = rt.focused == id, hovered = isHovered(id) && !disabled
        let border = invalid ? role("error") : focusedHere ? primary : hovered ? outlineStrong : outline
        let shape = RoundedRectangle(cornerRadius: 4, style: .circular)
        let config = inputConfig(text: text, label: label, mono: mono, centered: centered, invalid: invalid)
        ZStack {
            shape.fill(role("surface-container-lowest"))
            AWCFieldTextInput(config: config, events: AWCFieldInputEvents(edited: { t, _, _ in edited(t); return nil }, focusChanged: focus, command: { k, _ in command(k) }), handle: rt.input(id))
                .frame(height: 15).padding(.horizontal, 6).padding(.vertical, m.insetSm)
        }
        .overlay { shape.strokeBorder(border, lineWidth: 1).animation(stateAnimation, value: border) }
        .overlay { if focusedHere { RoundedRectangle(cornerRadius: 5, style: .circular).strokeBorder(invalid ? role("error") : primary, lineWidth: 1).padding(-1) } }
        .frame(height: m.inputHeight)
        .compositingGroup().opacity(disabled ? 0.5 : 1)
        .onContinuousHover { phase in if case .active = phase { rt.hovered = id } else if rt.hovered == id { rt.hovered = nil } }.modifier(tracked(id))
        .awcInspect(nodeID: node.id, part: "input-" + id, name: "input-" + id) { _ in ["value": .string(text), "invalid": .bool(invalid)] }
    }
    private func inputConfig(text: String, label: String, mono: Bool, centered: Bool, invalid: Bool) -> AWCFieldInputConfig {
        var config = AWCFieldInputConfig()
        let ink = appearance.onSurface ?? (tokens["--md-sys-color-on-surface"] ?? "#1C1B1F")
        config.text = text; config.fontSize = 13; config.lineHeight = 15; config.tracking = mono ? 0.65 : 0; config.weight = 400
        config.monospaced = mono; config.color = ink; config.caret = ink; config.rtl = rtl; config.enabled = !disabled; config.centered = centered
        config.type = mono ? "text" : "number"; config.spellcheck = false; config.autocomplete = "off"; config.invalid = invalid
        // The source's field labels are `text-transform: uppercase`; Chrome names the inputs with the transformed text ("HEX").
        config.accessibilityLabel = label.uppercased(with: Locale(identifier: locale))
        return config
    }
    @ViewBuilder private func hexField(_ m: AWCColorPickerMetrics) -> some View {
        VStack(alignment: .leading, spacing: m.gapXs) {
            fieldLabel("Hex")
            inputBox("hex", text: rt.hexInput, label: "Hex", mono: true, centered: false, invalid: rt.hexInvalid, m: m,
                     edited: { hexEdited($0) }, focus: { f in focused(f, "hex", visible: true); if !f { hexBlurred() } },
                     command: { k in if k == "Enter" { rt.input("hex").blur(); return true }; if k == "Escape" { return escape() }; return false })
        }
        .frame(height: m.fieldHeight)
        .awcInspect(nodeID: node.id, part: "field-hex", name: "field-hex") { _ in [:] }
    }
    @ViewBuilder private func channelFields(_ m: AWCColorPickerMetrics) -> some View {
        let channels = (format == "hsl" ? ["h", "s", "l"] : ["r", "g", "b"]) + (alpha ? ["a"] : [])
        HStack(spacing: m.gapSm) {
            ForEach(channels, id: \.self) { ch in
                VStack(alignment: .leading, spacing: m.gapXs) {
                    fieldLabel(ch)
                    inputBox(ch, text: rt.editing[ch] ?? channelValue(ch), label: ch.uppercased(), mono: false, centered: true, invalid: false, m: m,
                             edited: { t in if rt.editing[ch] == nil { rt.editStart[ch] = channelValue(ch) }; rt.editing[ch] = t },
                             focus: { f in focused(f, ch, visible: true); if f { rt.editStart[ch] = channelValue(ch) } else { channelCommit(ch) } },
                             command: { k in
                                 if k == "Enter" { channelCommit(ch); return true }
                                 if k == "Escape" { return escape() }
                                 if k == "ArrowUp" || k == "ArrowDown" { step(ch, up: k == "ArrowUp"); return true }
                                 return false })
                }
                .frame(maxWidth: .infinity)
                .awcInspect(nodeID: node.id, part: "field-" + ch, name: "field-" + ch) { _ in [:] }
            }
        }
        .frame(height: m.fieldHeight)
        .awcInspect(nodeID: node.id, part: "inputs", name: "inputs") { _ in [:] }
    }
    /// Arrow keys in a number input step its value (an `input` event; `change` follows on blur or Enter).
    private func step(_ ch: String, up: Bool) {
        let current = rt.editing[ch] ?? channelValue(ch)
        if rt.editing[ch] == nil { rt.editStart[ch] = channelValue(ch) }
        let (lo, hi, unit): (Double, Double, Double) = ch == "a" ? (0, 1, 0.01) : ch == "h" ? (0, 360, 1) : ["s", "l"].contains(ch) ? (0, 100, 1) : (0, 255, 1)
        let n = AWCColorMath.parseFloat(current), base = n.isNaN ? lo : n
        let next = max(lo, min(hi, base + (up ? unit : -unit)))
        rt.editing[ch] = ch == "a" ? AWCColorMath.fixed2(next) : String(Int(next))
        // A keyboard spin of a number input fires `input` and `change` (Chrome): the stepped value commits at once.
        channelCommit(ch)
    }

    // MARK: Presets
    @ViewBuilder private func presetList(_ m: AWCColorPickerMetrics) -> some View {
        AWCColorPickerFlow(spacing: m.gapSm) {
            ForEach(Array(presets.enumerated()), id: \.offset) { i, preset in
                presetSwatch(i, preset, m)
            }
        }
        .accessibilityElement(children: .contain).accessibilityLabel(AWCColorPickerLabels.label(locale, "presets"))
        .awcInspect(nodeID: node.id, part: "presets", name: "presets") { _ in [:] }
    }
    @ViewBuilder private func presetSwatch(_ i: Int, _ preset: String, _ m: AWCColorPickerMetrics) -> some View {
        let id = "preset-\(i)", selected = isSelected(preset), hovered = isHovered(id) && !disabled, pressed = rt.active == id && !disabled
        let scale = pressed ? 1.05 : hovered ? (selected ? 1.18 : reduceMotion ? 1.06 : 1.15) : selected ? 1.1 : 1
        // The hover tilt is for an unselected swatch (a selected one grows to 1.18 upright).
        let angle = pressed ? 0.0 : hovered && !selected && !reduceMotion ? -4 : 0
        let d = m.preset, swatch = AWCColorMath.parse(preset).map { AWCColorMath.color($0, alpha: true) } ?? .clear
        let rings: [AWCBoxShadow] = selected ? [AWCBoxShadow(spread: 2, color: appearance.surfaceColor ?? tokens["--md-sys-color-surface-container-high"] ?? "#ECE6F0"),
                                                 AWCBoxShadow(spread: 4, color: tokens["--md-sys-color-primary"] ?? "#6750A4")] + elevation(1) : hovered ? elevation(1) : []
        ZStack {
            AWCNativeBoxShadow(corners: AWCColorPickerShapes.circle, layers: rings, placement: .outer)
            Circle().fill(swatch)
            Circle().strokeBorder(outline, lineWidth: 1)
            focusRing(id, shape: Circle(), offset: 3)
        }
        .frame(width: d, height: d)
        .modifier(AWCColorPickerPresetEffect(key: id, runtime: rt, target: [scale, angle], reduceMotion: reduceMotion))
        .compositingGroup().opacity(disabled ? 0.5 : 1)
        .contentShape(Circle())
        .gesture(DragGesture(minimumDistance: 0)
            .onChanged { v in
                guard !disabled else { return }
                if rt.active != id { rt.active = id; _ = rt.control(id).focus(false) }
            }
            .onEnded { v in
                guard rt.active == id else { return }; rt.active = nil
                if CGRect(x: 0, y: 0, width: d, height: d).contains(v.location) { presetActivated(preset) }
            })
        .overlay {
            AWCColorPickerControlBridge(id: node.id + "-" + id, part: id, label: preset, role: .option(selected), value: nil, disabled: disabled, handle: rt.control(id),
                                       focusChanged: { focused($0, id) }, key: { k, _ in
                                           if k == "Enter" || k == "Space" { presetActivated(preset); return true }
                                           if k == "Escape" { return escape() }
                                           return false })
        }
        .onContinuousHover { phase in if case .active = phase { rt.hovered = id } else if rt.hovered == id { rt.hovered = nil } }.modifier(tracked(id))
        .awcInspect(nodeID: node.id, part: id, name: id) { _ in ["selected": .bool(selected), "scale": .number(scale), "label": .string(preset)] }
    }

    // MARK: Focus and hover
    private func focused(_ f: Bool, _ part: String, visible: Bool? = nil) {
        if f { rt.focused = part; rt.focusVisible = visible ?? rt.control(part).showFocus } else if rt.focused == part { rt.focused = nil }
    }
    private func isHovered(_ part: String) -> Bool {
        if let pointer { guard let p = pointer.location, let f = rt.frames[part] else { return false }; return f.contains(p) }
        return rt.hovered == part
    }
    private func tracked(_ part: String) -> some ViewModifier { AWCColorPickerFrameTracker(part: part, runtime: rt) }
    @ViewBuilder private func focusRing<S: InsettableShape>(_ part: String, shape: S, offset: Double) -> some View {
        if rt.focused == part && rt.focusVisible {
            shape.strokeBorder(role("secondary"), lineWidth: 3).padding(-(offset + 3)).allowsHitTesting(false)
        }
    }
}


enum AWCColorPickerMotion {
    /// One display frame at 60 Hz.
    static let frame = 1.0 / 60
    /// A change painted at once, one frame after the state change (reduced motion).
    static let nextFrame = Animation.linear(duration: 0.001).delay(frame)
}

enum AWCColorPickerShapes {
    static func rounded(_ r: Double) -> AWCCornerShape { let c = AWCCornerRadius(.init(points: r)); return .init(topLeft: c, topRight: c, bottomRight: c, bottomLeft: c) }
    static let circle: AWCCornerShape = { let c = AWCCornerRadius(.init(fraction: 0.5)); return .init(topLeft: c, topRight: c, bottomRight: c, bottomLeft: c) }()
}

/// A thumb: the colour disc inside its border ring, the 1px dark ring plus elevation 1 at rest; pressed (`:active`) it scales
/// by 1.15 with a 6px primary ring and elevation 2 (`--_state-duration` 200ms, `--_state-easing`), as a CSS transition.
struct AWCColorPickerThumb: View {
    let key: String, runtime: AWCColorPickerRuntime
    let diameter: Double, fill: Color, border: Color, primary: Color
    let rest: [AWCBoxShadow], pressedShadow: [AWCBoxShadow], pressed: Bool, reduceMotion: Bool
    var body: some View {
        let ring = [AWCBoxShadow(spread: 1, color: "#00000066")] + rest
        let primaryHex = primary.resolve(in: EnvironmentValues())
        let ring6 = String(format: "#%02X%02X%02X29", Int((primaryHex.red * 255).rounded()), Int((primaryHex.green * 255).rounded()), Int((primaryHex.blue * 255).rounded()))
        let pressedLayers = [AWCBoxShadow(spread: 6, color: ring6)] + pressedShadow
        let _ = runtime.settle
        let _ = runtime.retarget(key, [pressed ? 1 : 0], duration: reduceMotion ? 0 : 200, curve: [0.34, 0.80, 0.34, 1.00])
        TimelineView(.animation(paused: !runtime.isRunning(key, CACurrentMediaTime() * 1000))) { _ in
            let t = runtime.presented(key, CACurrentMediaTime() * 1000).first ?? (pressed ? 1 : 0)
            AWCColorPickerThumbBody(diameter: diameter, fill: fill, border: border, rest: ring, pressed: pressedLayers, t: t, probe: { [runtime, key] in runtime.record(key, [$0]) })
        }
        .frame(width: diameter, height: diameter)
        .allowsHitTesting(false)
    }
}
struct AWCColorPickerThumbBody: View {
    let diameter: Double, fill: Color, border: Color, rest: [AWCBoxShadow], pressed: [AWCBoxShadow]
    let t: Double
    var probe: ((Double) -> Void)? = nil
    var body: some View {
        let _ = probe?(t)
        ZStack {
            AWCNativeBoxShadow(corners: AWCColorPickerShapes.circle, layers: rest, toLayers: pressed, fraction: t, placement: .outer)
            Circle().fill(fill).padding(2)
            Circle().strokeBorder(border, lineWidth: 2)
        }
        .scaleEffect(1 + 0.15 * t)
    }
}

/// A preset swatch's `transform: scale() rotate()` as one CSS transition (350ms spring-effects easing; the functions
/// interpolate pairwise), reporting its presented values.
struct AWCColorPickerPresetEffect: ViewModifier {
    let key: String, runtime: AWCColorPickerRuntime, target: [Double], reduceMotion: Bool
    func body(content: Content) -> some View {
        let _ = runtime.settle
        let _ = runtime.retarget(key, target, duration: reduceMotion ? 0 : 350, curve: [0.42, 1.67, 0.21, 0.90])
        return TimelineView(.animation(paused: !runtime.isRunning(key, CACurrentMediaTime() * 1000))) { _ in
            let v = runtime.presented(key, CACurrentMediaTime() * 1000), s = v.first ?? target[0], a = v.count > 1 ? v[1] : target[1]
            let _ = runtime.record(key, [s, a])
            content.scaleEffect(s).rotationEffect(.degrees(a))
        }
    }
}

/// One CSS transition of a list of numbers that interpolate together (CSS Transitions Level 1, "Starting of transitions",
/// as `AWCCSSTransitionTrack`): a retarget starts from the presented value; returning to the reversing-adjusted start value
/// is shortened by the reversing shortening factor. Times in ms.
struct AWCColorPickerTransition: Equatable {
    private(set) var value: [Double]
    private var from: [Double] = [], start = 0.0, duration = 0.0, curve: [Double] = [0, 0, 1, 1]
    private var reversingAdjustedStart: [Double] = [], shortening = 1.0, active = false
    init(_ value: [Double]) { self.value = value }
    private var end: Double { start + duration }
    private func progress(_ now: Double) -> Double {
        guard duration > 0 else { return 1 }
        let t = min(1, max(0, (now - start) / duration))
        return t == 0 ? 0 : t == 1 ? 1 : AWCNativeLoadingMotion.cubic(t, curve[0], curve[1], curve[2], curve[3])
    }
    func isRunning(_ now: Double) -> Bool { active && now < end }
    func presented(_ now: Double) -> [Double] {
        guard isRunning(now) else { return value }
        let p = progress(now)
        return zip(from, value).map { $0 + ($1 - $0) * p }
    }
    mutating func set(_ target: [Double], now: Double, duration d: Double, curve c: [Double]) {
        let running = isRunning(now), current = presented(now)
        if running && value == target { return }
        let reversing = running && reversingAdjustedStart == target
        let factor = reversing ? min(1, max(0, abs(progress(now) * shortening + 1 - shortening))) : 1
        let adjusted = reversing ? value : current
        value = target
        guard current != target else { active = false; return }
        from = current; start = now; duration = d * factor; curve = c; reversingAdjustedStart = adjusted; shortening = factor; active = true
    }
}

/// The hue track: CSS interpolates gradient stops component-wise in sRGB (a SwiftUI gradient does not), so a CGGradient draws it.
struct AWCColorPickerHueGradient: View {
    let rtl: Bool
    static let gradient: CGGradient? = {
        let c: [(Double, Double, Double)] = [(1, 0, 0), (1, 1, 0), (0, 1, 0), (0, 1, 1), (0, 0, 1), (1, 0, 1), (1, 0, 0)]
        let comps: [CGFloat] = c.flatMap { t -> [CGFloat] in [CGFloat(t.0), CGFloat(t.1), CGFloat(t.2), 1] }
        let locs: [CGFloat] = [0, 0.17, 0.33, 0.5, 0.67, 0.83, 1]
        return CGColorSpace(name: CGColorSpace.sRGB).flatMap { CGGradient(colorSpace: $0, colorComponents: comps, locations: locs, count: locs.count) }
    }()
    var body: some View {
        Canvas { ctx, size in
            guard let g = Self.gradient else { return }
            ctx.withCGContext { cg in
                let a = CGPoint(x: rtl ? size.width : 0, y: 0), b = CGPoint(x: rtl ? 0 : size.width, y: 0)
                cg.drawLinearGradient(g, start: a, end: b, options: [.drawsBeforeStartLocation, .drawsAfterEndLocation])
            }
        }
        .allowsHitTesting(false)
    }
}

/// The 8px CSS checkerboard (#ccc squares in the top-right and bottom-left quadrants of each tile), tile origin at `origin`.
struct AWCColorPickerChecker: View {
    let origin: CGPoint
    var body: some View {
        Canvas { ctx, size in
            var path = Path()
            let x0 = Int(((-origin.x) / 4).rounded(.down)) - 1, y0 = Int(((-origin.y) / 4).rounded(.down)) - 1
            for j in y0...(Int(size.height / 4) + 2) { for i in x0...(Int(size.width / 4) + 2) where (i + j) & 1 == 1 {
                path.addRect(CGRect(x: origin.x + Double(i) * 4, y: origin.y + Double(j) * 4, width: 4, height: 4))
            } }
            ctx.fill(path, with: .color(Color(.sRGB, red: 0.8, green: 0.8, blue: 0.8)))
        }
        .allowsHitTesting(false)
    }
}

/// `display: flex; flex-wrap: wrap; gap` (rows from the inline start).
struct AWCColorPickerFlow: Layout {
    let spacing: Double
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = proposal.width ?? .infinity; var x = 0.0, y = 0.0, row = 0.0, maxX = 0.0
        for s in subviews { let z = s.sizeThatFits(.unspecified); if x > 0 && x + z.width > width { x = 0; y += row + spacing; row = 0 }; x += z.width + spacing; maxX = max(maxX, x - spacing); row = max(row, z.height) }
        return CGSize(width: proposal.width ?? maxX, height: subviews.isEmpty ? 0 : y + row)
    }
    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x = 0.0, y = 0.0, row = 0.0
        for s in subviews { let z = s.sizeThatFits(.unspecified); if x > 0 && x + z.width > bounds.width { x = 0; y += row + spacing; row = 0 }
            s.place(at: CGPoint(x: bounds.minX + x, y: bounds.minY + y), proposal: .init(z)); x += z.width + spacing; row = max(row, z.height) }
    }
}

/// md-color-picker-pop-in: opacity 0 → 1, scale 0.8 → 1 and translateY(-8px) → 0 over 300ms emphasized-decelerate, origin
/// at the inline-start top. Closing removes the panel at once (the Web's closing animation is never applied).
struct AWCColorPickerPopIn<Content: View>: View {
    let runtime: AWCColorPickerRuntime, reduceMotion: Bool, rtl: Bool
    var probe: (([Double]) -> Void)? = nil
    @ViewBuilder let content: () -> Content
    var body: some View {
        let _ = runtime.settle
        let start = runtime.openedAt ?? 0, now = CACurrentMediaTime() * 1000
        TimelineView(.animation(paused: reduceMotion || now > start + 300)) { _ in
            let t = min(1, max(0, (CACurrentMediaTime() * 1000 - start) / 300))
            let p = reduceMotion || t >= 1 ? 1 : AWCNativeLoadingMotion.cubic(t, 0.05, 0.7, 0.1, 1)
            content().modifier(AWCColorPickerPopInEffect(p: p, rtl: rtl, probe: probe))
        }
    }
}
/// The keyframes interpolate per function: `scale(0.8 → 1) translateY(-8px → 0)`, so the translation is scaled by the current
/// scale (matrix ty = s · −8 · (1 − p)), and opacity 0 → 1, origin at the inline-start top.
struct AWCColorPickerPopInEffect: ViewModifier, Animatable {
    var p: Double
    let rtl: Bool
    let probe: (([Double]) -> Void)?
    var animatableData: Double { get { p } set { p = newValue } }
    func body(content: Content) -> some View {
        let s = 0.8 + 0.2 * p, ty = s * -8 * (1 - p)
        probe?([p, s, ty])
        return content
            .scaleEffect(s, anchor: rtl ? .topTrailing : .topLeading)
            .offset(y: ty)
            .opacity(p)
    }
}

extension AWCNativeView {
    var nativeColorPicker: some View {
        AWCNativeColorPicker(node: node, theme: theme, props: local, setProperty: { k, v in set(k, v) }, emit: { emit($0, $1) },
                             trigger: node.children(inSlot: "trigger"), child: { n, h in child(n, handler: { e in h?(e); onEvent(e) }) })
    }
}

private struct AWCColorPickerFrameTracker: ViewModifier {
    let part: String
    let runtime: AWCColorPickerRuntime
    func body(content: Content) -> some View {
        content.onGeometryChange(for: CGRect.self) { $0.frame(in: .named("awc-native-preview")) } action: { runtime.frames[part] = $0 }
    }
}
