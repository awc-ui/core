import SwiftUI
import Observation
import QuartzCore
#if canImport(AppKit)
import AppKit
#else
import UIKit
#endif

// md-time-picker (packages/core/src/components/md-time-picker): a read-only md-text-field trigger and a modal dialog with
// the HH / MM tiles, the AM / PM group, the dial (dial variant) and the footer (mode toggle, Cancel, OK). The dialog is
// presented by the nearest AWCModalScope (viewport, scrim, Escape / Tab routing), as md-dialog is.

/// Resolved geometry: hooks, the density scale (type and tiles) and the spacing-token rung (insets and gaps).
struct AWCTimePickerMetrics {
    /// Roboto's ascent + descent (em): the line box of `line-height: normal`.
    static let naturalLine = 1.171875
    let padding, headlineSize, headlineWeight, headlineSpacing, inputFont, inputWeight, inputHeight, inputWidth, inputBorder, separator: Double
    let hintGap, periodFont, periodWeight, periodVWidth, periodVHeight, periodVHeightInput, periodHWidth, periodHHeight, periodOutline: Double
    let dial, target, center, handWidth, numberFont, numberWeight, numberActiveWeight, footerGap, actionsGap, insetMd, insetLg, insetXl: Double
    let dialogWidth, dialogShape, inputShape, periodShape, triggerWidth, triggerIcon, enter, modeSwap: Double
    let easing: [Double]
    init(_ a: AWCTimePickerAppearance, scale d: Double, rung r: Double, twelve: Bool, horizontal: Bool) {
        func n(_ k: String) -> Double? { a.number(k) }
        insetMd = r <= -2 ? 8 : 12; insetLg = r <= -4 ? 8 : r <= -2 ? 12 : 16; insetXl = r <= -3 ? 16 : r <= -2 ? 20 : 24
        let gapXs = r <= -4 ? 2.0 : 4, gapSm = r <= -3 ? 4.0 : 8
        padding = n("dialog-padding") ?? insetXl
        headlineSize = n("headline-font-size") ?? max(10, 12 + d * 0.5); headlineWeight = n("headline-font-weight") ?? 500
        headlineSpacing = n("headline-spacing") ?? max(4, 20 + d * 2)
        inputFont = n("input-font-size") ?? max(32, 45 + d * 2); inputWeight = n("input-font-weight") ?? 400
        inputHeight = n("input-height") ?? inputFont * 1.6; inputWidth = n("input-width") ?? inputHeight * 4 / 3
        inputBorder = n("input-border-width") ?? 2; separator = n("input-separator-width") ?? 24; hintGap = n("input-hint-gap") ?? gapXs
        periodFont = n("period-font-size") ?? max(12, 14 + d * 0.5); periodWeight = n("period-font-weight") ?? 500
        periodVWidth = n("period-vertical-width") ?? 52; periodVHeight = n("period-vertical-height") ?? 80; periodVHeightInput = n("period-vertical-height-input") ?? 72
        periodHWidth = n("period-horizontal-width") ?? 216; periodHHeight = n("period-horizontal-height") ?? 38; periodOutline = n("period-outline-width") ?? 1
        dial = n("dial-size") ?? 256; target = n("dial-target-size") ?? 48; center = n("dial-center-size") ?? 8; handWidth = n("dial-hand-width") ?? 2
        numberFont = n("dial-number-font-size") ?? max(13, 16 + d * 0.5); numberWeight = n("dial-number-font-weight") ?? 400
        numberActiveWeight = n("dial-number-active-font-weight") ?? 500
        footerGap = n("footer-gap") ?? gapSm; actionsGap = n("actions-gap") ?? gapSm
        dialogWidth = horizontal ? (twelve ? n("dialog-horizontal-width-12h") ?? 572 : n("dialog-horizontal-width-24h") ?? 608) : n("dialog-min-width") ?? 328
        dialogShape = n("dialog-shape") ?? 28; inputShape = n("input-shape") ?? 8; periodShape = n("period-shape") ?? 8
        // `trigger-icon-size` is applied to the slotted glyph, but md-text-field's own leading-icon size wins in Chrome (the
        // hook has no visible effect there; Gate-1 finding): the field's icon size is used.
        triggerWidth = n("trigger-min-width") ?? 240; triggerIcon = max(18, 24 + d)
        enter = n("dialog-enter-duration") ?? 500; modeSwap = n("mode-swap-duration") ?? 450; easing = a.easing ?? [0.05, 0.7, 0.1, 1]
    }
}

struct AWCNativeTimePicker: View {
    let node: AWCNode
    let theme: AWCTheme
    let props: [String: AWCValue]
    let setProperty: (String, AWCValue) -> Void
    let emit: (String, AWCValue) -> Void
    let child: (AWCNode, ((AWCEvent) -> Void)?) -> AnyView
    @State private var rt = AWCTimePickerRuntime()
    @State private var owner: AWCModalOwner
    @State private var buttons = AWCPopupTarget(id: "")
    @Environment(\.layoutDirection) private var direction
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.awcThemeTokens) private var themeTokens
    @Environment(\.awcTimePickerAppearance) private var inheritedAppearance
    @Environment(\.awcTimePickerAppearanceTargets) private var targetedAppearance
    @Environment(\.awcNativeDensity) private var inheritedDensity
    @Environment(\.awcNativeSpacingRung) private var inheritedRung
    @Environment(\.awcModalSession) private var session
    @Environment(\.awcTimePickerControllers) private var controllers
    @Environment(\.accessibilityReduceMotion) private var systemReduceMotion
    @Environment(\.awcReducedMotion) private var reducedOverride
    /// Pointer geometry from an embedding host (`:hover` of the period buttons), in the "awc-native-preview" space.
    @Environment(\.awcNativePointerState) private var pointer
    /// The picker's environment: the dialog renders in the modal scope's overlay, outside this view (density, theme, hooks,
    /// direction and the inspection scope are re-applied there, as md-dialog does).
    @Environment(\.self) private var environment

    init(node: AWCNode, theme: AWCTheme, props: [String: AWCValue], setProperty: @escaping (String, AWCValue) -> Void,
         emit: @escaping (String, AWCValue) -> Void, child: @escaping (AWCNode, ((AWCEvent) -> Void)?) -> AnyView) {
        self.node = node; self.theme = theme; self.props = props; self.setProperty = setProperty; self.emit = emit; self.child = child
        _owner = State(initialValue: AWCModalOwner(id: node.id + "#time-picker"))
    }

    // MARK: Properties
    private func s(_ k: String, _ f: String = "") -> String { props[k]?.string ?? f }
    private func b(_ k: String, _ f: Bool = false) -> Bool { props[k]?.bool ?? f }
    private var value: String { s("value") }
    private var twelve: Bool { s("format", "12h") != "24h" }
    private var variant: AWCTimePickerMode { s("variant") == "dial" ? .dial : .input }
    private var disabled: Bool { b("disabled") }
    private var open: Bool { b("open") }
    private var labels: AWCTimePickerLabels { AWCTimePickerLabels(props) }
    private var minuteStep: Int { Int(max(1, min(30, props["minuteStep"]?.number ?? 1))) }
    private var reduceMotion: Bool { reducedOverride ?? systemReduceMotion }
    private var rtl: Bool { direction == .rightToLeft }
    private var tokens: [String: String] {
        if !themeTokens.isEmpty { return themeTokens }
        if !theme.tokens.isEmpty { return theme.tokens }
        return colorScheme == .dark ? AWCGeneratedTokens.dark : AWCGeneratedTokens.light
    }
    private var dark: Bool { (tokens["--md-sys-color-surface"] ?? "#FFFBFE").uppercased() != "#FFFBFE" }
    private var appearance: AWCTimePickerAppearance { inheritedAppearance.merging(targetedAppearance[node.id] ?? .init()) }
    private func roleHex(_ name: String) -> String { tokens["--md-sys-color-" + name] ?? "#000000" }
    private func role(_ name: String) -> Color { Color(awcHex: roleHex(name)) }
    /// A hook's colour, else the role's.
    private func hookHex(_ k: String, _ fallback: String) -> String { appearance.color(k) ?? roleHex(fallback) }
    private func hook(_ k: String, _ fallback: String) -> Color { Color(awcHex: hookHex(k, fallback)) }
    /// A hook's colour, or nil (no paint) when unset.
    private func hookOptional(_ k: String) -> Color? { appearance.color(k).map { Color(awcHex: $0) } }
    private var scale: Double { AWCNativeDensity.resolve(props["density"]?.number, inherited: inheritedDensity) }
    private var rung: Double { props["density"]?.number.flatMap { [-1.0, -2, -3, -4].contains($0) ? $0 : nil } ?? inheritedRung }
    /// The adaptive policy (`responsive`): the viewport the modal scope reports.
    private var viewport: CGSize { session?.viewport ?? .zero }
    private var effectiveVariant: AWCTimePickerMode {
        guard b("responsive"), viewport.height > 0 else { return variant }
        return viewport.height < 460 ? .input : variant
    }
    private var horizontalDialog: Bool {
        guard rt.mode == .dial else { return false }
        let orientation = s("orientation", "vertical")
        guard b("responsive"), viewport.width > 0, viewport.height > 0 else { return orientation == "horizontal" }
        if orientation == "vertical" && viewport.width >= 720 && viewport.width > viewport.height { return true }
        if orientation == "horizontal" && viewport.width < 620 { return false }
        return orientation == "horizontal"
    }
    private var periodHorizontal: Bool {
        if rt.mode == .input { return false }
        if horizontalDialog { return true }
        return s("periodLayout", "vertical") == "horizontal"
    }
    private var metrics: AWCTimePickerMetrics { .init(appearance, scale: scale, rung: rung, twelve: twelve, horizontal: horizontalDialog) }
    private var displayValue: String {
        guard !rt.committedValue.isEmpty else { return "" }
        let h = rt.committedHours, m = rt.committedMinutes
        if !twelve { return AWCTimeMath.iso(h, m) }
        return "\(AWCTimeMath.displayHour(h, twelve: true)):\(String(format: "%02d", m)) \(h >= 12 ? labels.pm : labels.am)"
    }

    // MARK: Behaviour (md-time-picker.tsx)
    private func load() {
        guard !rt.loaded else { return }
        rt.loaded = true
        if !rt.parseValueInto(value) { rt.parseValueInto("") ; if !value.isEmpty { setProperty("value", .string("")) } }
        else if !value.isEmpty, AWCTimeMath.iso(rt.draftHours, rt.draftMinutes) != value { setProperty("value", .string(AWCTimeMath.iso(rt.draftHours, rt.draftMinutes))) }
        rt.committedHours = rt.draftHours; rt.committedMinutes = rt.draftMinutes
        rt.committedValue = AWCTimeMath.parse(value) == nil ? "" : AWCTimeMath.iso(rt.draftHours, rt.draftMinutes)
        rt.defaultValue = rt.committedValue
        rt.mode = effectiveVariant
        updateValidity()
        if open && !disabled { openPicker() } else if open { setProperty("open", false) }
    }
    private func valueChanged(_ v: String) {
        let normalized: String
        if v.isEmpty { rt.parseValueInto(""); normalized = "" }
        else if rt.parseValueInto(v) { normalized = AWCTimeMath.iso(rt.draftHours, rt.draftMinutes) }
        else { rt.parseValueInto(""); normalized = "" }
        if normalized != v { setProperty("value", .string(normalized)); return }
        rt.committedHours = rt.draftHours; rt.committedMinutes = rt.draftMinutes; rt.committedValue = v
        if rt.isOpen { rt.syncInputsFromDraft(twelve: twelve); rt.lastInputEmitKey = rt.draftHours * 60 + rt.draftMinutes }
        else { rt.hourBuffer = String(rt.displayHour(twelve: twelve)); rt.minuteBuffer = String(format: "%02d", rt.draftMinutes) }
        updateValidity()
    }
    private func emitInputIfChanged() {
        guard rt.isOpen else { return }
        let key = rt.draftHours * 60 + rt.draftMinutes
        guard key != rt.lastInputEmitKey else { return }
        rt.lastInputEmitKey = key
        emit("mdInput", awcTimePickerDetail(rt.draftHours, rt.draftMinutes))
    }
    private func openPicker() {
        guard !disabled, !rt.isOpen else { return }
        rt.draftHours = rt.committedHours; rt.draftMinutes = rt.committedMinutes
        rt.lastInputEmitKey = rt.draftHours * 60 + rt.draftMinutes
        rt.selecting = .hour; rt.mode = effectiveVariant
        rt.syncInputsFromDraft(twelve: twelve)
        rt.lastHandMode = nil; rt.hourAngle = 0; rt.minuteAngle = 0
        rt.transitions = [:]; rt.pendingTransitions = [:]; rt.colorTargets = [:]; rt.colorSpaces = [:]; rt.colorLegacy = [:]
        rt.openedAt = nil; rt.modeAt = nil
        // Opened from the trigger (its click / Enter / Space; its focus is tracked asynchronously, so the activation says so).
        rt.openedFromTrigger = rt.activatedFromTrigger || rt.triggerFocus.isFocused(); rt.activatedFromTrigger = false
        rt.isOpen = true
        if !open { setProperty("open", true) }
        session?.acquire(owner)
        emit("mdOpen", .null)
        // Initial focus (the source focuses the hour field in the next frame): retried until the tile is in the window.
        AWCTimePickerRuntime.retry({ [rt] in !rt.isOpen || rt.input("input-hour").isFocused() }) { [rt] in
            guard rt.isOpen else { return }; _ = rt.input("input-hour").focus(); rt.input("input-hour").selectAll() }
    }
    private func closePicker() {
        guard rt.isOpen else { return }
        rt.isOpen = false; rt.focused = nil; rt.hovered = nil; rt.activatedFromTrigger = false
        if open { setProperty("open", false) }
        let restored = session != nil
        session?.release(owner.id)
        emit("mdClose", .null)
        // The source restores the opener when it is outside the picker, else focuses the trigger (opened from the trigger, or
        // with nothing to restore).
        if !restored || owner.opener == nil || rt.openedFromTrigger, !disabled {
            // The picker focuses the trigger itself (no competing restoration), retried until the content under the modal is
            // focusable again (it leaves the inert state in the next view update).
            owner.opener = nil
            AWCTimePickerRuntime.retry({ [rt] in rt.isOpen || rt.triggerFocus.isFocused() }) { [rt] in rt.focusTrigger() }
        }
    }
    private func cancel() {
        guard rt.isOpen else { return }
        rt.draftHours = rt.committedHours; rt.draftMinutes = rt.committedMinutes
        emit("mdCancel", .null)
        closePicker()
    }
    private func confirm() {
        guard !disabled else { return }
        applyInputs(.both)
        if rt.hourError || rt.minuteError { return }
        rt.committedHours = rt.draftHours; rt.committedMinutes = rt.draftMinutes
        let v = AWCTimeMath.iso(rt.draftHours, rt.draftMinutes)
        rt.committedValue = v
        if value != v { setProperty("value", .string(v)) }
        updateValidity()
        emit("mdChange", awcTimePickerDetail(rt.draftHours, rt.draftMinutes))
        closePicker()
    }
    /// Constraint validity of the committed value; mdValidityChange on a change after the first evaluation.
    private func validity() -> (valid: Bool, message: String, flags: [String: Bool]) {
        let current = AWCTimeMath.parse(rt.committedValue), minM = AWCTimeMath.parse(s("min")), maxM = AWCTimeMath.parse(s("max"))
        func msg(_ t: String) -> String { t.replacingOccurrences(of: "{min}", with: s("min")).replacingOccurrences(of: "{max}", with: s("max")) }
        if b("required") && current == nil { return (false, labels.valueMissing, ["valueMissing": true]) }
        if let c = current, let lo = minM, let hi = maxM, lo > hi {
            return c < lo && c > hi ? (false, msg(labels.rangeOutside), ["rangeUnderflow": true, "rangeOverflow": true]) : (true, "", [:])
        }
        if let c = current, let lo = minM, c < lo { return (false, msg(labels.rangeUnderflow), ["rangeUnderflow": true]) }
        if let c = current, let hi = maxM, c > hi { return (false, msg(labels.rangeOverflow), ["rangeOverflow": true]) }
        return (true, "", [:])
    }
    private func updateValidity() {
        let v = validity(), key = "\(v.valid)|\(v.message)"
        guard rt.lastValidityKey != key else { return }
        let primed = rt.lastValidityKey != nil
        rt.lastValidityKey = key
        if rt.revealed { rt.validationMessage = v.valid ? "" : v.message }
        if primed {
            var flags: [String: AWCValue] = [:]
            for f in ["valueMissing", "rangeUnderflow", "rangeOverflow"] { flags[f] = .bool(v.flags[f] ?? false) }
            emit("mdValidityChange", ["valid": .bool(v.valid), "validationMessage": .string(v.message), "flags": .object(flags)])
        }
    }
    private func togglePeriod(_ p: String) {
        guard twelve, rt.period != p else { return }
        if p == "AM" && rt.draftHours >= 12 { rt.draftHours -= 12 } else if p == "PM" && rt.draftHours < 12 { rt.draftHours += 12 }
        emitInputIfChanged()
        rt.syncInputsFromDraft(twelve: twelve)
    }
    private func toggleMode() {
        let previous = rt.mode
        rt.mode = rt.mode == .dial ? .input : .dial
        emit("mdModeChange", ["mode": .string(rt.mode.rawValue), "previousMode": .string(previous.rawValue)])
        rt.selecting = .hour
        rt.syncInputsFromDraft(twelve: twelve)
        rt.modeAt = nil
        DispatchQueue.main.async { [rt] in _ = rt.input("input-hour").focus(); rt.input("input-hour").selectAll() }
    }
    private enum Scope { case hour, minute, both }
    /// `applyInputsToDraft`: both buffers valid → the draft takes them (mdInput when it changed).
    @discardableResult private func applyInputs(_ scope: Scope) -> Bool {
        let h = AWCTimeMath.parseInt(rt.hourBuffer), m = AWCTimeMath.parseInt(rt.minuteBuffer)
        let range = twelve ? 1...12 : 0...23
        let hValid = h.map { range.contains($0) } ?? false, mValid = m.map { (0...59).contains($0) } ?? false
        if scope != .minute { rt.hourError = !hValid }
        if scope != .hour { rt.minuteError = !mValid }
        guard hValid, mValid, let h, let m else { return false }
        rt.draftMinutes = m
        rt.draftHours = AWCTimeMath.hour24(display: h, pm: rt.period == "PM", twelve: twelve)
        emitInputIfChanged()
        return true
    }
    private func edited(_ id: String, _ text: String) -> (String, Int)? {
        let digits = String(text.filter { ("0"..."9").contains($0) }.prefix(2))
        if id == "input-hour" { rt.hourBuffer = digits; applyInputs(.hour) } else { rt.minuteBuffer = digits; applyInputs(.minute) }
        return digits == text ? nil : (digits, digits.utf16.count)
    }
    private func blurred(_ id: String) {
        applyInputs(.both)
        if id == "input-hour" {
            if !rt.hourError, AWCTimeMath.parseInt(rt.hourBuffer) == rt.displayHour(twelve: twelve) { rt.hourBuffer = String(rt.displayHour(twelve: twelve)); rt.inputSeed &+= 1 }
        } else if !rt.minuteError, AWCTimeMath.parseInt(rt.minuteBuffer) == rt.draftMinutes { rt.minuteBuffer = String(format: "%02d", rt.draftMinutes); rt.inputSeed &+= 1 }
    }
    /// ArrowUp / ArrowDown in a tile (bumpFocusedInput): hours wrap (12h 1…12 without flipping the period), minutes step by
    /// `minute-step` from the snapped value.
    private func bump(_ direction: Int, _ id: String) {
        if id == "input-hour" {
            let base = rt.hourError ? rt.displayHour(twelve: twelve) : (AWCTimeMath.parseInt(rt.hourBuffer) ?? rt.displayHour(twelve: twelve))
            if !twelve { rt.draftHours = ((base + direction) % 24 + 24) % 24 }
            else { var next = base + direction; if next > 12 { next = 1 } else if next < 1 { next = 12 }
                rt.draftHours = AWCTimeMath.hour24(display: next, pm: rt.period == "PM", twelve: true) }
            rt.hourError = false; rt.hourBuffer = String(rt.displayHour(twelve: twelve))
        } else {
            let base = rt.minuteError ? rt.draftMinutes : (AWCTimeMath.parseInt(rt.minuteBuffer) ?? rt.draftMinutes)
            let snapped = Int(AWCTimeMath.jsRound(Double(base) / Double(minuteStep))) * minuteStep
            rt.draftMinutes = ((snapped + direction * minuteStep) % 60 + 60) % 60
            rt.minuteError = false; rt.minuteBuffer = String(format: "%02d", rt.draftMinutes)
        }
        rt.inputSeed &+= 1
        DispatchQueue.main.async { [rt] in rt.input(id).selectAll() }
        emitInputIfChanged()
    }
    private func tileCommand(_ id: String, _ key: String) -> Bool {
        switch key {
        case "Enter": confirm(); return true
        case "ArrowUp": bump(1, id); return true
        case "ArrowDown": bump(-1, id); return true
        case "Escape": cancel(); return true
        default: return false
        }
    }
    /// Dial pointer (applyDialPointer).
    private func dialPointer(_ p: CGPoint, size: Double) {
        let pt = AWCTimeMath.dialPoint(p, size: size)
        if rt.selecting == .hour {
            let idx = Int(AWCTimeMath.jsRound(pt.angle / 30)) % 12
            if twelve { rt.draftHours = AWCTimeMath.hour24(display: idx == 0 ? 12 : idx, pm: rt.period == "PM", twelve: true) }
            else if pt.distance < pt.radius * 0.66 { rt.draftHours = idx == 0 ? 0 : 12 + idx }
            else { rt.draftHours = idx == 0 ? 12 : idx }
        } else {
            let raw = Int(AWCTimeMath.jsRound(pt.angle / 6))
            rt.draftMinutes = (Int(AWCTimeMath.jsRound(Double(raw) / Double(minuteStep))) * minuteStep) % 60
        }
        emitInputIfChanged()
        rt.syncInputsFromDraft(twelve: twelve)
    }
    private func dialReleased() {
        guard rt.dragging else { return }
        rt.dragging = false
        if rt.selecting == .hour {
            rt.selecting = .minute
            DispatchQueue.main.async { [rt] in _ = rt.input("input-minute").focus(); rt.input("input-minute").selectAll() }
        }
    }
    private func periodKey(_ key: String) -> Bool {
        guard twelve else { return false }
        let next: String
        switch key {
        case "Home": next = "AM"
        case "End": next = "PM"
        case "Space": next = rt.period
        case "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown": next = rt.period == "AM" ? "PM" : "AM"
        default: return false
        }
        togglePeriod(next)
        DispatchQueue.main.async { [rt] in _ = rt.periodHandle(next).focus(true) }
        return true
    }
    /// Tab order inside the dialog: hour, minute, the checked period radio (12h), mode toggle, Cancel, OK (wrapping).
    private func focusOrder() -> [String] {
        var order: [String] = ["input-hour", "input-minute"]
        if twelve { order.append(rt.period == "AM" ? "period-am" : "period-pm") }
        order += [node.id + "-toggle-mode", node.id + "-cancel", node.id + "-confirm"]
        return order
    }
    private func focusPart(_ id: String) -> Bool {
        if id.hasPrefix("input-") { let ok = rt.input(id).focus(); rt.input(id).selectAll(); return ok }
        if id.hasPrefix("period-") { return rt.periodHandle(id == "period-am" ? "AM" : "PM").focus(true) }
        return buttons.handles[id]?.requestFocus?() ?? false
    }
    private func currentFocus() -> String? {
        for id in focusOrder() {
            if id.hasPrefix("input-") ? rt.input(id).isFocused() : id.hasPrefix("period-") ? rt.periodHandle(id == "period-am" ? "AM" : "PM").isFocused() : (buttons.handles[id]?.isFocused ?? false) { return id }
        }
        return nil
    }
    private func trapTab(_ backward: Bool) -> Bool {
        let order = focusOrder(); guard !order.isEmpty else { return false }
        guard let current = currentFocus(), let i = order.firstIndex(of: current) else { return focusPart(order[backward ? order.count - 1 : 0]) }
        return focusPart(order[(i + (backward ? order.count - 1 : 1)) % order.count])
    }
    @discardableResult private func attachOwner() -> Bool {
        owner.escape = { [self] in guard rt.isOpen else { return false }; cancel(); return true }
        owner.tab = { [self] backward in rt.isOpen ? trapTab(backward) : false }
        owner.focusInitial = { [rt] in _ = rt.input("input-hour").focus(); rt.input("input-hour").selectAll() }
        AWCTimePickerRuntime.mounted[node.id] = .init(rt)
        rt.focusTrigger = { [rt] in _ = rt.triggerFocus.focus() }
        rt.show = { [self] in openPicker() }
        rt.hide = { [self] in cancel() }
        rt.validityRecord = { [self] in validity() }
        rt.disabledNow = disabled
        (controllers[node.id] ?? controllers[""])?.runtime = rt
        return true
    }

    // MARK: Body
    var body: some View {
        let m = metrics
        let _ = attachOwner()
        trigger(m)
            .background {
                Color.clear.frame(width: 0, height: 0)
                    .preference(key: AWCModalEntries.self, value: rt.isOpen && session != nil ? [modalEntry(m)] : [])
            }
            // Without an AWCModalScope the dialog is a platform sheet (as md-dialog's fallback).
            .sheet(isPresented: Binding(get: { rt.isOpen && session == nil }, set: { if !$0 && rt.isOpen { cancel() } })) {
                dialog(m).padding(m.insetXl)
            }
            .onAppear { load() }
            .onChange(of: value) { _, v in if v != rt.committedValue || AWCTimeMath.parse(v) == nil { valueChanged(v) } }
            .onChange(of: open) { _, v in if v && !rt.isOpen { openPicker() } else if !v && rt.isOpen { closePicker() } }
            .onChange(of: disabled) { _, v in if v { rt.revealed = false; rt.validationMessage = "" }; if v && rt.isOpen { cancel() } }
            .onChange(of: variant) { _, v in if !rt.isOpen { rt.mode = v } }
            .onChange(of: [s("min"), s("max"), s("valueMissingLabel"), s("rangeUnderflowLabel"), s("rangeOverflowLabel"), s("rangeOutsideLabel")]) { _, _ in updateValidity() }
            .onChange(of: b("required")) { _, _ in updateValidity() }
            .onDisappear { if rt.isOpen { session?.release(owner.id) } }
    }

    // MARK: Trigger
    /// The source's trigger: a read-only outlined md-text-field with the `schedule` glyph in its leading slot; click and
    /// Enter / Space (its keydown) open the dialog. The picker's trigger hooks are piped onto the field's own hooks.
    @ViewBuilder private func trigger(_ m: AWCTimePickerMetrics) -> some View {
        if b("hideTrigger") {
            Color.clear.frame(width: 0, height: 0).accessibilityHidden(true)
        } else {
            let showError = b("error") || !rt.validationMessage.isEmpty
            let errorText = s("errorText").isEmpty ? rt.validationMessage : s("errorText")
            let display = displayValue
            let p: [String: AWCValue] = ["variant": "outlined", "readOnly": true, "label": .string(labels.label), "value": .string(display),
                                         "supportingText": .string(showError && !errorText.isEmpty ? "" : s("supportingText")), "error": .bool(showError),
                                         "errorText": .string(errorText), "reserveSupportingSpace": .bool(b("reserveSupportingSpace")), "disabled": .bool(disabled),
                                         "required": .bool(b("required")), "appearFocused": .bool(rt.isOpen),
                                         "aria-label": .string(display.isEmpty ? labels.label : "\(labels.label), \(display)")]
            let field = AWCNode(id: node.id + "-trigger", tag: "md-text-field", properties: p, children: [.symbol("schedule", slot: "leading-icon")])
            let a = appearance
            child(field, nil)
                .awcTextFieldAppearance(AWCTextFieldAppearance(activeIndicatorColor: a.color("trigger-focus-color"), containerShape: a.number("trigger-shape"),
                                                               iconColor: a.color("trigger-icon-color"), inputColor: a.color("trigger-color"),
                                                               labelColor: a.color("trigger-icon-color"), outlineColor: a.color("trigger-outline-color")),
                                        for: node.id + "-trigger")
                .environment(\.awcFieldActivation, { _ in guard !disabled else { return false }; rt.activatedFromTrigger = true; openPicker(); return true })
                .environment(\.awcFieldFocusTarget, rt.triggerFocus)
                .frame(width: m.triggerWidth)
                .contentShape(Rectangle())
                .simultaneousGesture(TapGesture().onEnded { if !disabled { rt.activatedFromTrigger = true; openPicker() } })
                // The field's own parts report as the picker's `trigger` part (the source's ::part(trigger)).
                .environment(\.awcInspectionAlias, AWCInspectionAlias(childID: node.id + "-trigger", parentID: node.id, part: "trigger"))
                .awcInspect(nodeID: node.id, name: "md-time-picker") { _ in ["open": .bool(rt.isOpen), "mode": .string(rt.mode.rawValue)] }
        }
    }

    // MARK: Dialog
    private func modalEntry(_ m: AWCTimePickerMetrics) -> AWCModalEntry {
        // Innermost wins: the picker's environment, minus the inert bit of the content it lives in.
        let content = dialogLayer(m).environment(\.awcNativeInert, false).environment(\.self, environment)
        return AWCModalEntry(id: owner.id, zIndex: 1000, content: AnyView(content))
    }
    private func dialogLayer(_ m: AWCTimePickerMetrics) -> some View {
        AWCTimePickerDialogLayer(nodeID: node.id, runtime: rt, reduceMotion: reduceMotion, enter: m.enter, easing: m.easing,
                                 scrimColor: appearance.color("scrim-color") ?? (dark ? "#00000099" : "#00000052"),
                                 padding: m.insetXl, cancel: { cancel() }) {
            dialog(m)
        }
        .environment(\.layoutDirection, direction)
    }
    @ViewBuilder private func dialog(_ m: AWCTimePickerMetrics) -> some View {
        let isInput = rt.mode == .input, horizontal = horizontalDialog
        let shape = RoundedRectangle(cornerRadius: m.dialogShape, style: .circular)
        let headline = labels.headline.isEmpty ? (isInput ? labels.headlineInput : labels.headlineDial) : labels.headline
        let shadows = appearance.raw("dialog-elevation").flatMap { AWCBoxShadow.source($0) } ?? AWCBoxShadow.source(tokens["--md-sys-elevation-3"] ?? "none") ?? []
        VStack(alignment: .leading, spacing: 0) {
            Text(headline).font(AWCNativeFonts.label(size: m.headlineSize, weight: m.headlineWeight)).tracking(0.5).lineLimit(1)
                .foregroundStyle(hook("headline-color", "on-surface-variant"))
                .frame(height: 16, alignment: .leading).frame(maxWidth: .infinity, alignment: .leading)
                .awcInspect(nodeID: node.id, part: "headline", name: "headline") { _ in [:] }
                .padding(.bottom, m.headlineSpacing)
            timeBody(m, isInput: isInput, horizontal: horizontal)
            footer(m, isInput: isInput)
        }
        .padding(m.padding)
        .frame(width: min(m.dialogWidth, max(0, viewport.width - 48)), alignment: .topLeading)
        .background { ZStack { AWCNativeBoxShadow(corners: .points(m.dialogShape), layers: shadows, placement: .outer); shape.fill(hook("dialog-color", "surface-container-high")) } }
        .foregroundStyle(hook("dialog-on-color", "on-surface"))
        .accessibilityElement(children: .contain).accessibilityLabel(headline).accessibilityAddTraits(.isModal)
        // The source's polite live region (`sr-status`): the unit being selected, announced when it changes.
        .onChange(of: rt.selecting) { _, v in awcTimePickerAnnounce(v == .hour ? labels.hour : labels.minute) }
        .awcInspect(nodeID: node.id, part: "dialog", name: "dialog") { _ in ["role": "dialog", "label": .string(headline), "status": .string(rt.selecting == .hour ? labels.hour : labels.minute)] }
    }
    @ViewBuilder private func timeBody(_ m: AWCTimePickerMetrics, isInput: Bool, horizontal: Bool) -> some View {
        let timeArea = VStack(spacing: 0) {
            inputArea(m, inlinePeriod: !(twelve && periodHorizontal), dial: !isInput)
            if !isInput && twelve && periodHorizontal { periodGroup(m, horizontal: true, inInput: false).padding(.top, horizontal ? m.insetLg : m.insetMd).padding(.bottom, horizontal ? 0 : m.insetXl) }
        }
        Group {
            if horizontal {
                // A flex row (gap 52) as wide as the dialog's content box, 24 below (the body's margin in landscape).
                HStack(alignment: .top, spacing: 52) {
                    timeArea.fixedSize().awcInspect(nodeID: node.id, part: "time-area", name: "time-area") { _ in [:] }
                    dialWrap(m, bottom: 0)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.bottom, m.insetXl)
            } else if isInput {
                inputArea(m, inlinePeriod: true, dial: false)
            } else {
                VStack(spacing: 0) { timeArea.frame(maxWidth: .infinity).awcInspect(nodeID: node.id, part: "time-area", name: "time-area") { _ in [:] }; dialWrap(m, bottom: m.insetXl) }
            }
        }
        .awcInspect(nodeID: node.id, part: "body", name: "body") { _ in [:] }
    }
    // HH / MM tiles with their hints, the colon, and (12h, inline) the vertical AM / PM group.
    @ViewBuilder private func inputArea(_ m: AWCTimePickerMetrics, inlinePeriod: Bool, dial: Bool) -> some View {
        let inlineGroup = twelve && inlinePeriod
        // A flex row: on a narrow dialog the separator and the period pill shrink in proportion to their inner widths
        // (CSS flex-shrink; the tiles keep their width).
        let available: Double = horizontalDialog ? .infinity : min(m.dialogWidth, max(0, viewport.width - 48)) - 2 * m.padding
        let periodInner: Double = inlineGroup ? m.periodVWidth - 2 * m.periodOutline : 0
        let needed: Double = 2 * m.inputWidth + m.separator + (inlineGroup ? m.insetMd + m.periodVWidth : 0)
        let overflow: Double = max(0, needed - available)
        let shrinkBase: Double = m.separator + periodInner
        let separatorWidth: Double = shrinkBase > 0 ? max(0, m.separator - overflow * m.separator / shrinkBase) : m.separator
        let periodWidth: Double = shrinkBase > 0 ? max(0, m.periodVWidth - overflow * periodInner / shrinkBase) : m.periodVWidth
        AWCTimePickerModeIn(runtime: rt, key: "mode-input", reduceMotion: reduceMotion, duration: m.modeSwap, easing: m.easing) {
            HStack(alignment: .top, spacing: 0) {
                tile("input-hour", m, active: rt.selecting == .hour, error: rt.hourError, label: labels.hour)
                Text(":").font(AWCNativeFonts.label(size: m.inputFont, weight: m.inputWeight)).lineLimit(1)
                    .foregroundStyle(hookOptional("input-separator-color") ?? hook("dialog-on-color", "on-surface"))
                    .frame(width: separatorWidth, height: m.inputHeight).accessibilityHidden(true)
                tile("input-minute", m, active: rt.selecting == .minute, error: rt.minuteError, label: labels.minute)
                if inlineGroup { periodGroup(m, horizontal: false, inInput: true, width: periodWidth).padding(.leading, m.insetMd) }
            }
            .frame(maxWidth: .infinity)
        }
        .awcInspect(nodeID: node.id, part: "input-area", name: "input-area") { _ in [:] }
        .padding(.bottom, dial && horizontalDialog ? 0 : m.insetXl)
    }
    @ViewBuilder private func tile(_ id: String, _ m: AWCTimePickerMetrics, active: Bool, error: Bool, label: String) -> some View {
        let a = appearance, focusedHere = rt.focused == id, hovered = rt.hovered == id
        let bg0 = active ? hook("input-active-bg", "primary-container") : hook("input-bg", "surface-container-highest")
        let inkHex = error ? hookHex("input-error-color", "error") : active ? hookHex("input-active-color", "on-primary-container") : hookHex("input-color", "on-surface")
        let hoverInk = active ? hook("input-active-color", "on-primary-container") : hook("input-color", "on-surface")
        let opacity = (a.number("input-hover-opacity") ?? 8) / 100
        let border: Color = error ? hook("input-error-color", "error") : focusedHere ? hook("input-active-outline-color", "primary") : active ? .clear : (hookOptional("input-outline-color") ?? .clear)
        let shape = RoundedRectangle(cornerRadius: m.inputShape, style: .circular)
        let text = id == "input-hour" ? rt.hourBuffer : rt.minuteBuffer
        VStack(spacing: m.hintGap) {
            ZStack {
                shape.fill(bg0)
                if hovered && !focusedHere { shape.fill(hoverInk.opacity(opacity)) }
                // The source writes the uncontrolled inputs imperatively; here the field follows the buffer (the text is
                // replaced only when it differs, so the caret and focus stay).
                AWCFieldTextInput(config: tileConfig(text: text, m: m, inkHex: inkHex, label: label, error: error, id: id),
                                  events: AWCFieldInputEvents(edited: { t, _, _ in edited(id, t) },
                                                              focusChanged: { f in
                                                                  if f { rt.focused = id; rt.selecting = id == "input-hour" ? .hour : .minute }
                                                                  else { if rt.focused == id { rt.focused = nil }; blurred(id) } },
                                                              command: { k, _ in tileCommand(id, k) }),
                                  handle: rt.input(id))
                    .frame(height: m.inputFont * AWCTimePickerMetrics.naturalLine).padding(.horizontal, 16)
            }
            .overlay { shape.strokeBorder(border, lineWidth: m.inputBorder) }
            .frame(width: m.inputWidth, height: m.inputHeight)
            .onContinuousHover { phase in if case .active = phase { rt.hovered = id } else if rt.hovered == id { rt.hovered = nil } }
            .awcInspect(nodeID: node.id, part: id, name: id) { _ in ["value": .string(text), "invalid": .bool(error), "active": .bool(active)] }
            Text(label).font(AWCNativeFonts.label(size: 12, weight: 400)).tracking(0.4).lineLimit(1)
                .foregroundStyle(error ? hook("input-error-color", "error") : hook("input-hint-color", "on-surface-variant"))
                .fixedSize().accessibilityHidden(true)
        }
    }
    private func tileConfig(text: String, m: AWCTimePickerMetrics, inkHex: String, label: String, error: Bool, id: String) -> AWCFieldInputConfig {
        var c = AWCFieldInputConfig()
        // `line-height: 1` in a 72px box: Chrome centres the glyphs in the box; natively the field's line is the font's
        // natural line (Roboto ascent + descent), centred, which puts the glyphs at the same place.
        c.text = text; c.fontSize = m.inputFont; c.lineHeight = m.inputFont * AWCTimePickerMetrics.naturalLine; c.tracking = 0; c.weight = m.inputWeight; c.color = inkHex; c.caret = inkHex
        // type="text" inputmode="numeric" role="spinbutton": the vertical arrows reach `command` (bumpFocusedInput).
        c.centered = true; c.rtl = false; c.enabled = !disabled; c.type = "text"; c.inputMode = "numeric"; c.autocomplete = "off"; c.spellcheck = false
        c.accessibilityLabel = label; c.invalid = error; c.role = "spinbutton"
        c.accessibilityValue = error ? nil : text
        return c
    }
    // AM / PM radio group.
    @ViewBuilder private func periodGroup(_ m: AWCTimePickerMetrics, horizontal: Bool, inInput: Bool, width: Double? = nil) -> some View {
        let outline = hook("period-outline-color", "outline"), w = m.periodOutline
        let r = m.periodShape, inner = max(0, r - w)
        let verticalHeight: Double = inInput || !rtModeIsDial ? m.periodVHeightInput : m.periodVHeight
        let groupWidth: Double = horizontal ? m.periodHWidth : (width ?? m.periodVWidth)
        let groupHeight: Double = horizontal ? m.periodHHeight : verticalHeight
        // Inside the 1px outline the AM button carries the divider as its trailing / bottom border (Chrome: AM 35.5 + PM 34.5
        // of 70 in the vertical pill, 107.5 + 106.5 of 214 in the horizontal one).
        let crossInner: Double = (horizontal ? groupHeight : groupWidth) - 2 * w
        let mainInner: Double = (horizontal ? groupWidth : groupHeight) - 2 * w
        let pm: Double = max(0, (mainInner - w) / 2), am: Double = mainInner - pm
        let amSize = horizontal ? CGSize(width: am, height: crossInner) : CGSize(width: crossInner, height: am)
        let pmSize = horizontal ? CGSize(width: pm, height: crossInner) : CGSize(width: crossInner, height: pm)
        let layout = horizontal ? AnyLayout(HStackLayout(spacing: 0)) : AnyLayout(VStackLayout(spacing: 0))
        layout {
            ZStack(alignment: horizontal ? .leading : .top) {
                periodButton("AM", m, horizontal: horizontal, corners: horizontal ? (inner, 0, 0, inner) : (inner, inner, 0, 0))
                    .frame(width: horizontal ? pm : nil, height: horizontal ? nil : pm)
                Rectangle().fill(outline).frame(width: horizontal ? w : nil, height: horizontal ? nil : w)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: horizontal ? .trailing : .bottom)
            }
            .frame(width: amSize.width, height: amSize.height)
            .awcInspect(nodeID: node.id, part: "period-am", name: "period-am") { _ in ["checked": .bool(rt.period == "AM")] }
            periodButton("PM", m, horizontal: horizontal, corners: horizontal ? (0, inner, inner, 0) : (0, 0, inner, inner))
                .frame(width: pmSize.width, height: pmSize.height)
                .awcInspect(nodeID: node.id, part: "period-pm", name: "period-pm") { _ in ["checked": .bool(rt.period == "PM")] }
        }
        .padding(w)
        .overlay { RoundedRectangle(cornerRadius: r, style: .circular).strokeBorder(outline, lineWidth: w) }
        .frame(width: groupWidth, height: groupHeight)
        .accessibilityElement(children: .contain).accessibilityLabel(labels.period)
        .awcInspect(nodeID: node.id, part: "period-toggle", name: "period-toggle") { _ in ["horizontal": .bool(horizontal)] }
    }
    private var rtModeIsDial: Bool { rt.mode == .dial }
    @ViewBuilder private func periodButton(_ p: String, _ m: AWCTimePickerMetrics, horizontal: Bool, corners: (Double, Double, Double, Double)) -> some View {
        let a = appearance, active = rt.period == p, id = p == "AM" ? "period-am" : "period-pm"
        let restHex = active ? hookHex("period-active-bg", "tertiary-container") : (appearance.color("period-bg") ?? "#00000000")
        let inkHex = active ? hookHex("period-active-color", "on-tertiary-container") : hookHex("period-color", "on-surface")
        let opacity = (a.number("period-hover-opacity") ?? 8) / 100
        let hovered: Bool = pointer.map { ptr in ptr.location.map { rt.periodFrames[id]?.contains($0) ?? false } ?? false } ?? (rt.hovered == id)
        // :hover — background: color-mix(in srgb, <ink> 8%, transparent | <active bg>) (a non-legacy colour: Oklab transitions).
        let bgSpec = hovered ? "mix:" + AWCTimePickerOKLab.mix(inkHex, opacity, active ? restHex : "#00000000") : restHex
        let shape = UnevenRoundedRectangle(topLeadingRadius: corners.0, bottomLeadingRadius: corners.3, bottomTrailingRadius: corners.2, topTrailingRadius: corners.1, style: .circular)
        // background-color and color: 150ms standard transitions.
        AWCTimePickerColors(runtime: rt, key: id, targets: [bgSpec, inkHex], duration: reduceMotion ? 0 : 150) { colors in
            ZStack {
                shape.fill(colors[0])
                Text(p == "AM" ? labels.am : labels.pm).font(AWCNativeFonts.label(size: m.periodFont, weight: m.periodWeight)).tracking(0.1).lineLimit(1)
                    .foregroundStyle(colors[1])
                if rt.focused == id && rt.focusVisible { shape.stroke(role("secondary"), lineWidth: 3).padding(-3.5).allowsHitTesting(false) }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .contentShape(shape)
        .onTapGesture { togglePeriod(p); _ = rt.periodHandle(p).focus(false) }
        .onContinuousHover { phase in if case .active = phase { rt.hovered = id } else if rt.hovered == id { rt.hovered = nil } }
        .onGeometryChange(for: CGRect.self) { $0.frame(in: .named("awc-native-preview")) } action: { rt.periodFrames[id] = $0 }
        // Roving tabindex: only the checked radio is in the dialog's Tab order (focusOrder); both take focus.
        .overlay {
            AWCColorPickerControlBridge(id: node.id + "-" + id, part: id, label: p == "AM" ? labels.am : labels.pm, role: .radio(active), value: nil, disabled: disabled,
                                       handle: rt.periodControl(p), focusChanged: { f in if f { rt.focused = id; rt.focusVisible = rt.periodControl(p).showFocus } else if rt.focused == id { rt.focused = nil } },
                                       key: { k, _ in periodKey(k) })
        }
    }
    // The dial: face, hand, centre dot and the 12 (or 24) numbers.
    @ViewBuilder private func dialWrap(_ m: AWCTimePickerMetrics, bottom: Double) -> some View {
        AWCTimePickerModeIn(runtime: rt, key: "mode-dial", reduceMotion: reduceMotion, duration: m.modeSwap, easing: m.easing) {
            dial(m)
        }
        .frame(maxWidth: horizontalDialog ? nil : .infinity)
        .awcInspect(nodeID: node.id, part: "dial-wrap", name: "dial-wrap") { _ in [:] }
        .padding(.bottom, bottom)
    }
    @ViewBuilder private func dial(_ m: AWCTimePickerMetrics) -> some View {
        let isHour = rt.selecting == .hour
        let hand = handGeometry()
        let angle = rt.advanceHand(isHour ? .hour : .minute, hand.angle)
        let lengthRatio: Double = appearance.number("hand-length").map { $0 / 100 } ?? hand.ratio
        let size = m.dial
        let alpha: Double = disabled ? 0.38 : 1
        let info: [String: AWCValue] = ["mode": .string(isHour ? "hour" : "minute"), "hand": .number(angle), "length": .number(lengthRatio)]
        dialFace(m, angle: angle, lengthRatio: lengthRatio)
            .frame(width: size, height: size)
            .environment(\.layoutDirection, .leftToRight)
            .compositingGroup()
            .opacity(alpha)
            .contentShape(Circle())
            .gesture(dialGesture(size))
            .accessibilityHidden(true)
            .awcInspect(nodeID: node.id, part: "dial", name: "dial") { _ in info }
    }
    private func dialGesture(_ size: Double) -> some Gesture {
        DragGesture(minimumDistance: 0, coordinateSpace: .local)
            .onChanged { v in guard !disabled else { return }; rt.dragging = true; dialPointer(v.location, size: size) }
            .onEnded { _ in dialReleased() }
    }
    @ViewBuilder private func dialFace(_ m: AWCTimePickerMetrics, angle: Double, lengthRatio: Double) -> some View {
        let size = m.dial, radius = size / 2
        let handInk = hook("dial-hand-color", "primary")
        let face = hook("dial-bg", "surface-container-highest")
        ZStack(alignment: .topLeading) {
            Circle().fill(face).frame(width: size, height: size)
            AWCTimePickerHand(nodeID: node.id, runtime: rt, angle: angle, length: radius * lengthRatio, radius: radius, width: m.handWidth, target: m.target, ink: handInk, reduceMotion: reduceMotion)
            Circle().fill(handInk).frame(width: m.center, height: m.center).position(x: radius, y: radius)
            ForEach(numbers(), id: \.value) { n in numberView(n, m, radius: radius) }
        }
    }
    @ViewBuilder private func numberView(_ n: DialNumber, _ m: AWCTimePickerMetrics, radius: Double) -> some View {
        let r: Double = radius * (n.inner ? 0.52 : 0.8)
        let rad: Double = (n.angle - 90) * .pi / 180
        let x: Double = radius + cos(rad) * r, y: Double = radius + sin(rad) * r
        let inkHex = n.active ? hookHex("dial-number-active-color", "on-primary") : hookHex("dial-number-color", "on-surface")
        let weight = n.active ? m.numberActiveWeight : m.numberWeight
        let info: [String: AWCValue] = ["text": .string(n.label), "active": .bool(n.active)]
        // color: 150ms standard transition (the weight changes at once).
        AWCTimePickerColors(runtime: rt, key: "number-\(n.value)", targets: [inkHex], duration: reduceMotion ? 0 : 150) { colors in
            Text(n.label).font(AWCNativeFonts.label(size: m.numberFont, weight: weight)).monospacedDigit().lineLimit(1)
                .foregroundStyle(colors[0])
        }
        .frame(width: m.target, height: m.target)
        .awcInspect(nodeID: node.id, part: "dial-number-\(n.value)", name: "dial-number") { _ in info }
        .position(x: x, y: y)
    }
    private struct DialNumber { let label: String; let angle: Double; let inner: Bool; let value: Int; let active: Bool }
    private func numbers() -> [DialNumber] {
        if rt.selecting == .minute {
            return (0..<12).map { (i: Int) -> DialNumber in
                let v = i * 5
                return DialNumber(label: String(format: "%02d", v), angle: Double(v) * 6, inner: false, value: 100 + v, active: rt.draftMinutes == v)
            }
        }
        let shown = twelve ? rt.displayHour(twelve: true) : rt.draftHours
        var out: [DialNumber] = []
        for i in 0..<12 {
            let value = i == 0 ? 12 : i
            out.append(DialNumber(label: String(value), angle: Double(i) * 30, inner: false, value: value, active: shown == value))
        }
        if !twelve {
            for i in 0..<12 {
                let value = i == 0 ? 0 : 12 + i
                out.append(DialNumber(label: i == 0 ? "00" : String(value), angle: Double(i) * 30, inner: true, value: value, active: rt.draftHours == value))
            }
        }
        return out
    }
    /// Raw hand angle and length ratio for the current selection (renderDial).
    private func handGeometry() -> (angle: Double, ratio: Double) {
        guard rt.selecting == .hour else { return (Double(rt.draftMinutes) * 6, 0.8) }
        if twelve { let d = rt.displayHour(twelve: true); return (Double(d == 12 ? 0 : d) * 30, 0.8) }
        let h = rt.draftHours
        if h == 0 { return (0, 0.52) }
        if h <= 12 { return (Double(h == 12 ? 0 : h) * 30, 0.8) }
        return (Double(h - 12) * 30, 0.52)
    }
    // Footer: the mode toggle (md-icon-button) and the Cancel / OK text buttons (md-button).
    @ViewBuilder private func footer(_ m: AWCTimePickerMetrics, isInput: Bool) -> some View {
        HStack(spacing: m.footerGap) {
            child(AWCNode(id: node.id + "-toggle-mode", tag: "md-icon-button",
                          properties: ["variant": "standard", "size": "sm", "icon": .string(isInput ? "schedule" : "keyboard"),
                                       "aria-label": .string(isInput ? labels.toggleDial : labels.toggleInput)]),
                  { e in if e.name == "mdClick" { toggleMode() } })
                .awcInspect(nodeID: node.id, part: "toggle-mode", name: "toggle-mode") { _ in [:] }
            Spacer(minLength: 0)
            HStack(spacing: m.actionsGap) {
                child(AWCNode(id: node.id + "-cancel", tag: "md-button", properties: ["variant": "text", "size": "sm"], children: [.text(labels.cancel)]),
                      { e in if e.name == "mdClick" { cancel() } })
                    .awcInspect(nodeID: node.id, part: "cancel-button", name: "cancel-button") { _ in [:] }
                child(AWCNode(id: node.id + "-confirm", tag: "md-button", properties: ["variant": "text", "size": "sm"], children: [.text(labels.ok)]),
                      { e in if e.name == "mdClick" { confirm() } })
                    .awcInspect(nodeID: node.id, part: "confirm-button", name: "confirm-button") { _ in [:] }
            }
            .awcInspect(nodeID: node.id, part: "actions", name: "actions") { _ in [:] }
        }
        .environment(\.awcPopupTarget, buttons)
        .awcInspect(nodeID: node.id, part: "footer", name: "footer") { _ in [:] }
    }
}

extension AWCTimePickerRuntime {
    /// Runs `attempt` now and every 8 ms until `done` holds (at most 12 times): focus that waits for views to attach.
    @MainActor static func retry(_ done: @escaping () -> Bool, attempts: Int = 12, _ attempt: @escaping () -> Void) {
        DispatchQueue.main.async {
            if done() { return }
            attempt()
            guard attempts > 1 else { return }
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.008) { retry(done, attempts: attempts - 1, attempt) }
        }
    }
    @MainActor func periodControl(_ p: String) -> AWCColorPickerControlHandle {
        let key = "period-" + p
        if let h = periodControls[key] { return h }
        let h = AWCColorPickerControlHandle(); periodControls[key] = h; return h
    }
    @MainActor func periodHandle(_ p: String) -> AWCColorPickerControlHandle { periodControl(p) }
}

/// The scrim (150ms fade, standard easing) and the dialog's enter keyframes (opacity, translateY 12 → 0, scale 0.88 → 1 from
/// the centre top, 500ms emphasized-decelerate), centred in the modal viewport; the scrim press cancels.
struct AWCTimePickerDialogLayer<Content: View>: View {
    let nodeID: String, runtime: AWCTimePickerRuntime, reduceMotion: Bool, enter: Double, easing: [Double]
    let scrimColor: String, padding: Double
    let cancel: () -> Void
    @ViewBuilder let content: () -> Content
    var body: some View {
        let _ = runtime.settle
        let now = CACurrentMediaTime() * 1000
        let start = runtime.openedAt ?? now
        let _ = runtime.openedAt == nil ? runtime.noteOpened(now, longest: enter) : ()
        TimelineView(.animation(paused: reduceMotion || now > start + max(enter, 150))) { _ in
            let t = CACurrentMediaTime() * 1000 - start
            let s = reduceMotion ? 1 : AWCTimePickerMotion.progress(t, duration: 150, curve: [0.2, 0, 0, 1])
            let p = reduceMotion ? 1 : AWCTimePickerMotion.progress(t, duration: enter, curve: easing)
            let _ = runtime.record("scrim", [s])
            let _ = runtime.record("dialog", [p, 0.88 + 0.12 * p, 12 * (1 - p)])
            ZStack {
                Color(awcHex: scrimColor).opacity(s).contentShape(Rectangle()).onTapGesture { cancel() }
                    .awcInspect(nodeID: nodeID, part: "scrim", name: "scrim") { _ in [:] }
                content()
                    .scaleEffect(0.88 + 0.12 * p, anchor: .top)
                    .offset(y: 12 * (1 - p))
                    .opacity(p)
                    .padding(padding)
            }
        }
    }
}

/// The mode area's enter keyframes (opacity, translateY 8 → 0, scale 0.96 → 1 from the centre top, 450ms), replayed when the
/// mode swaps.
struct AWCTimePickerModeIn<Content: View>: View {
    let runtime: AWCTimePickerRuntime, key: String, reduceMotion: Bool, duration: Double, easing: [Double]
    @ViewBuilder let content: () -> Content
    var body: some View {
        let _ = runtime.settle
        let now = CACurrentMediaTime() * 1000
        let pending = runtime.modeAt == nil
        TimelineView(.animation(paused: reduceMotion || (!pending && now > (runtime.modeAt ?? now) + duration))) { _ in
            // The keyframes start with the first frame that renders the area (progress 0 in that frame, as Chrome's).
            let t = CACurrentMediaTime() * 1000
            let start = runtime.modeAt ?? runtime.noteModeIn(t, duration: duration)
            let p = reduceMotion ? 1 : AWCTimePickerMotion.progress(t - start, duration: duration, curve: easing)
            let _ = runtime.record(key, [p, 0.96 + 0.04 * p, 8 * (1 - p)])
            content()
                .scaleEffect(0.96 + 0.04 * p, anchor: .top)
                .offset(y: 8 * (1 - p))
                .opacity(p)
        }
    }
}

/// The hand: a line from the centre to the selected number and the 48px tip disc, rotated with a 200ms emphasized transition.
struct AWCTimePickerHand: View {
    let nodeID: String
    let runtime: AWCTimePickerRuntime
    let angle: Double, length: Double, radius: Double, width: Double, target: Double
    let ink: Color, reduceMotion: Bool
    var body: some View {
        let _ = runtime.settle
        // The source writes the hand's rotation in the pointer handler: its transition starts with the frame being rendered.
        let _ = runtime.retarget("hand", [angle], duration: reduceMotion ? 0 : 200, curve: [0.2, 0, 0, 1], immediate: true)
        TimelineView(.animation(paused: !runtime.isRunning("hand", CACurrentMediaTime() * 1000))) { _ in
            let a = runtime.presented("hand", CACurrentMediaTime() * 1000).first ?? angle
            let _ = runtime.record("hand", [a])
            ZStack(alignment: .bottom) {
                Rectangle().fill(ink).frame(width: width, height: length)
                Circle().fill(ink).frame(width: target, height: target).offset(y: -length + target / 2)
            }
            .frame(width: target, height: radius, alignment: .bottom)
            .rotationEffect(.degrees(a), anchor: .bottom)
            .awcInspect(nodeID: nodeID, part: "dial-hand", name: "dial-hand") { _ in ["angle": .number(a)] }
            .position(x: radius, y: radius / 2)
        }
        .allowsHitTesting(false)
    }
}

/// Colours under a CSS transition (premultiplied sRGB interpolation, as Chrome's), keyed per element.
struct AWCTimePickerColors<Content: View>: View {
    let runtime: AWCTimePickerRuntime, key: String, targets: [String], duration: Double
    @ViewBuilder let content: ([Color]) -> Content
    var body: some View {
        let _ = runtime.settle
        // A "mix:" target is a color-mix() result (non-legacy colour); each colour transitions on its own.
        let specs = targets.map { $0.hasPrefix("mix:") ? (String($0.dropFirst(4)), false) : ($0, true) }
        let target = specs.flatMap { AWCTimePickerOKLab.premultiplied($0.0) }
        let _ = specs.enumerated().forEach { i, sp in runtime.retargetColor("\(key)#\(i)", AWCTimePickerOKLab.premultiplied(sp.0), legacy: sp.1, duration: duration, curve: [0.2, 0, 0, 1]) }
        let keys = specs.indices.map { "\(key)#\($0)" }
        TimelineView(.animation(paused: !keys.contains { runtime.isRunning($0, CACurrentMediaTime() * 1000) })) { _ in
            let now = CACurrentMediaTime() * 1000
            let v = keys.flatMap { runtime.presentedColor($0, now) }
            let values = v.count == target.count ? v : target
            let _ = runtime.record(key, values)
            content(stride(from: 0, to: values.count, by: 4).map { i in
                let a = values[i + 3]
                return a <= 0 ? Color.clear : Color(.sRGB, red: values[i] / a, green: values[i + 1] / a, blue: values[i + 2] / a, opacity: a)
            })
        }
    }
    static func premultiplied(_ hex: String) -> [Double] {
        let h = hex.trimmingCharacters(in: CharacterSet(charactersIn: "#"))
        let v = UInt64(h, radix: 16) ?? 0, rgba = h.count == 8, rgb = rgba ? v >> 8 : v
        let a = rgba ? Double(v & 255) / 255 : 1
        return [Double((rgb >> 16) & 255) / 255 * a, Double((rgb >> 8) & 255) / 255 * a, Double(rgb & 255) / 255 * a, a]
    }
}

/// Posts a polite announcement (the source's `aria-live="polite"` status region).
func awcTimePickerAnnounce(_ text: String) {
    #if canImport(AppKit)
    NSAccessibility.post(element: NSApp as Any, notification: .announcementRequested, userInfo: [.announcement: text, .priority: NSAccessibilityPriorityLevel.medium.rawValue])
    #else
    UIAccessibility.post(notification: .announcement, argument: NSAttributedString(string: text, attributes: [.accessibilitySpeechQueueAnnouncement: true]))
    #endif
}

enum AWCTimePickerMotion {
    static func progress(_ elapsed: Double, duration: Double, curve: [Double]) -> Double {
        guard duration > 0 else { return 1 }
        let t = min(1, max(0, elapsed / duration))
        return t == 0 ? 0 : t == 1 ? 1 : AWCNativeLoadingMotion.cubic(t, curve[0], curve[1], curve[2], curve[3])
    }
}

extension AWCTimePickerRuntime {
    /// The dialog's first rendered frame starts its enter keyframes (and the mode area's); the frame timeline pauses after.
    @MainActor func noteOpened(_ now: Double, longest: Double) {
        openedAt = now
        // The mode areas' keyframes start with the dialog's (the same first frame); a later mode swap starts them anew.
        if modeAt == nil { modeAt = now }
        Task { @MainActor [weak self] in try? await Task.sleep(nanoseconds: UInt64(max(longest, 450) + 34) * 1_000_000); self?.settle &+= 1 }
    }
    @discardableResult func noteModeIn(_ now: Double, duration: Double) -> Double {
        modeAt = now
        Task { @MainActor [weak self] in try? await Task.sleep(nanoseconds: UInt64(duration + 34) * 1_000_000); self?.settle &+= 1 }
        return now
    }
}

extension AWCNativeView {
    var nativeTimePicker: some View {
        AWCNativeTimePicker(node: node, theme: theme, props: local, setProperty: { k, v in set(k, v) }, emit: { emit($0, $1) },
                            child: { n, h in child(n, handler: { e in h?(e); onEvent(e) }) })
    }
}
