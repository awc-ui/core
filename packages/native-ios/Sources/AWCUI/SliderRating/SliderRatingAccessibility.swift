import SwiftUI

// The native focus and accessibility element of md-slider's thumbs (the Web's native range inputs) and of md-rating
// (role slider; img when readonly): an AppKit / UIKit view in AWCUI's key-view loop (Tab / Shift+Tab like the other
// AWC controls), first-responder focus with or without the indicator (keyboard vs pointer / script), the slider keys
// routed to the component, and the platform slider element — AXSlider with AXValue / AXMinValue / AXMaxValue /
// AXValueDescription / AXOrientation and increment / decrement on macOS; the adjustable trait with the value text
// and increment / decrement on iOS. A readonly rating is an image (Web role="img") with its composed label.

struct AWCAdjustableConfiguration {
    enum Role { case slider, image }
    let id: String
    let label: String
    var role: Role = .slider
    var value = 0.0, min = 0.0, max = 100.0
    /// aria-valuetext (else the number).
    var valueText: String? = nil
    var vertical = false
    /// Disabled (aria-disabled): reported not enabled; increment / decrement refused.
    var enabled = true
    /// Focusable at all (soft-disabled keeps focus; disabled does not). Nil: follows `enabled`.
    var focusable: Bool? = nil
    var canFocus: Bool { focusable ?? enabled }
    /// A sequential (Tab) stop.
    var tabStop = true
    let handle: AWCButtonFocusHandle
    /// (focused, keyboard: the focus indicator shows).
    let focusChanged: (Bool, Bool) -> Void
    /// (key name, key up) → handled.
    let key: (String, Bool) -> Bool
    let step: (Bool) -> Void          // increment (true) / decrement (false)
    var valueString: String { valueText ?? awcSRJSNumberString(value) }
}

#if canImport(AppKit)
import AppKit

final class AWCNativeAdjustableFocusView: NSView {
    var configuration: AWCAdjustableConfiguration?
    private var requestedIndicator: Bool?
    override var acceptsFirstResponder: Bool { configuration?.canFocus == true && configuration?.role == .slider }
    override var canBecomeKeyView: Bool { acceptsFirstResponder && configuration?.tabStop == true && window != nil && !isHidden }
    override func hitTest(_ point: NSPoint) -> NSView? { nil }
    func requestNativeFocus(showIndicator: Bool) -> Bool {
        guard acceptsFirstResponder, let window else { return false }
        requestedIndicator = showIndicator
        defer { requestedIndicator = nil }
        configuration?.handle.showFocus = showIndicator
        if window.firstResponder === self { configuration?.focusChanged(true, showIndicator); return true }
        return window.makeFirstResponder(self)
    }
    override func becomeFirstResponder() -> Bool {
        guard acceptsFirstResponder else { return false }
        let indicator = requestedIndicator ?? true
        configuration?.handle.showFocus = indicator; configuration?.handle.isFocused = true
        configuration?.focusChanged(true, indicator)
        return true
    }
    override func resignFirstResponder() -> Bool { configuration?.handle.isFocused = false; configuration?.focusChanged(false, false); return true }
    static func keyName(_ event: NSEvent) -> String? {
        switch event.keyCode {
        case 123: return "ArrowLeft"; case 124: return "ArrowRight"; case 125: return "ArrowDown"; case 126: return "ArrowUp"
        case 115: return "Home"; case 119: return "End"; case 116: return "PageUp"; case 121: return "PageDown"; case 48: return "Tab"
        default:
            let c = event.charactersIgnoringModifiers ?? ""
            return c.count == 1 && c.first!.isNumber ? c : nil
        }
    }
    override func keyDown(with event: NSEvent) {
        guard let c = configuration, let name = Self.keyName(event) else { super.keyDown(with: event); return }
        if name == "Tab" { AWCDocumentTabOrder.select(from: self, backward: event.modifierFlags.contains(.shift)); return }
        c.handle.showFocus = true
        if !c.key(name, false) { super.keyDown(with: event) }
    }
    override func keyUp(with event: NSEvent) {
        guard let c = configuration, let name = Self.keyName(event), name != "Tab" else { super.keyUp(with: event); return }
        if !c.key(name, true) { super.keyUp(with: event) }
    }
    override func isAccessibilityElement() -> Bool { configuration != nil }
    override func accessibilityIdentifier() -> String { configuration?.id ?? "" }
    override func accessibilityRole() -> NSAccessibility.Role? { configuration?.role == .image ? .image : .slider }
    override func accessibilityLabel() -> String? { configuration?.label }
    override func isAccessibilityEnabled() -> Bool { configuration?.enabled == true }
    override func accessibilityValue() -> Any? { configuration?.role == .image ? nil : configuration.map { NSNumber(value: $0.value) } }
    override func accessibilityMinValue() -> Any? { configuration?.role == .image ? nil : configuration.map { NSNumber(value: $0.min) } }
    override func accessibilityMaxValue() -> Any? { configuration?.role == .image ? nil : configuration.map { NSNumber(value: $0.max) } }
    override func accessibilityValueDescription() -> String? { configuration?.role == .image ? nil : configuration?.valueString }
    override func accessibilityOrientation() -> NSAccessibilityOrientation { configuration?.vertical == true ? .vertical : .horizontal }
    override func isAccessibilityFocused() -> Bool { window?.firstResponder === self }
    override func setAccessibilityFocused(_ value: Bool) { if value { _ = requestNativeFocus(showIndicator: true) } }
    override func accessibilityPerformIncrement() -> Bool { guard let c = configuration, c.enabled, c.role == .slider else { return false }; c.step(true); return true }
    override func accessibilityPerformDecrement() -> Bool { guard let c = configuration, c.enabled, c.role == .slider else { return false }; c.step(false); return true }
}

struct AWCNativeAdjustableBridge: NSViewRepresentable {
    let configuration: AWCAdjustableConfiguration
    func makeNSView(context: Context) -> AWCNativeAdjustableFocusView { AWCNativeAdjustableFocusView() }
    func updateNSView(_ view: AWCNativeAdjustableFocusView, context: Context) {
        view.configuration = configuration
        configuration.handle.requestFocus = { [weak view] in view?.requestNativeFocus(showIndicator: true) ?? false }
        configuration.handle.requestPointerFocus = { [weak view] in view?.requestNativeFocus(showIndicator: false) ?? false }
        configuration.handle.resignFocus = { [weak view] in if let view, view.window?.firstResponder === view { _ = view.window?.makeFirstResponder(nil) } }
        if !view.acceptsFirstResponder && view.window?.firstResponder === view { _ = view.window?.makeFirstResponder(nil) }
    }
    static func dismantleNSView(_ view: AWCNativeAdjustableFocusView, coordinator: ()) {
        view.configuration?.handle.requestFocus = nil; view.configuration?.handle.requestPointerFocus = nil
    }
}
#elseif canImport(UIKit)
import UIKit

final class AWCNativeAdjustableFocusView: UIView, AWCKeyView {
    var configuration: AWCAdjustableConfiguration?
    private var requestedIndicator: Bool?
    private var requestingExplicitFocus = false
    override var canBecomeFirstResponder: Bool { configuration?.canFocus == true && configuration?.role == .slider }
    var awcAcceptsFirstResponder: Bool { canBecomeFirstResponder }
    var awcCanBecomeKeyView: Bool { canBecomeFirstResponder && configuration?.tabStop == true && window != nil && !isHidden }
    func awcBecomeKeyView() -> Bool { requestNativeFocus(showIndicator: true) }
    override var focusGroupIdentifier: String? { get { awcCanBecomeKeyView ? "awc.key-view.\(UInt(bitPattern: ObjectIdentifier(self).hashValue))" : nil } set {} }
    override var canBecomeFocused: Bool { canBecomeFirstResponder && (requestingExplicitFocus || configuration?.tabStop == true) }
    override func didUpdateFocus(in context: UIFocusUpdateContext, with coordinator: UIFocusAnimationCoordinator) {
        super.didUpdateFocus(in: context, with: coordinator)
        if context.nextFocusedItem === self { _ = becomeFirstResponder() } else if context.previouslyFocusedItem === self { _ = resignFirstResponder() }
    }
    func requestNativeFocus(showIndicator: Bool) -> Bool {
        guard canBecomeFirstResponder else { return false }
        requestedIndicator = showIndicator
        defer { requestedIndicator = nil }
        configuration?.handle.showFocus = showIndicator
        if isFirstResponder { configuration?.focusChanged(true, showIndicator); return true }
        requestingExplicitFocus = true
        if let system = UIFocusSystem.focusSystem(for: self) { system.requestFocusUpdate(to: self); system.updateFocusIfNeeded() }
        let ok = becomeFirstResponder()
        if !ok { requestingExplicitFocus = false }
        return ok
    }
    override func point(inside point: CGPoint, with event: UIEvent?) -> Bool { false }
    override func becomeFirstResponder() -> Bool {
        if isFirstResponder { return true }
        guard super.becomeFirstResponder() else { return false }
        let indicator = requestedIndicator ?? true
        configuration?.handle.showFocus = indicator; configuration?.handle.isFocused = true
        configuration?.focusChanged(true, indicator)
        return true
    }
    override func resignFirstResponder() -> Bool {
        guard super.resignFirstResponder() else { return false }
        requestingExplicitFocus = false
        configuration?.handle.isFocused = false; configuration?.focusChanged(false, false); return true
    }
    static let names: [String: String] = [UIKeyCommand.inputLeftArrow: "ArrowLeft", UIKeyCommand.inputRightArrow: "ArrowRight", UIKeyCommand.inputUpArrow: "ArrowUp",
                                          UIKeyCommand.inputDownArrow: "ArrowDown", UIKeyCommand.inputHome: "Home", UIKeyCommand.inputEnd: "End",
                                          UIKeyCommand.inputPageUp: "PageUp", UIKeyCommand.inputPageDown: "PageDown", "\t": "Tab"]
    override var keyCommands: [UIKeyCommand]? {
        guard configuration?.canFocus == true else { return [] }
        var out = Self.names.keys.map { k -> UIKeyCommand in let c = UIKeyCommand(input: k, modifierFlags: [], action: #selector(handleKey(_:))); c.wantsPriorityOverSystemBehavior = true; return c }
        let back = UIKeyCommand(input: "\t", modifierFlags: .shift, action: #selector(handleKey(_:))); back.wantsPriorityOverSystemBehavior = true; out.append(back)
        for d in "0123456789" { out.append(UIKeyCommand(input: String(d), modifierFlags: [], action: #selector(handleKey(_:)))) }
        return out
    }
    @objc private func handleKey(_ command: UIKeyCommand) {
        guard let c = configuration else { return }
        let input = command.input ?? ""
        let name = Self.names[input] ?? input
        if name == "Tab" { if let window { AWCKeyViewLoop.select(from: self, in: window, backward: command.modifierFlags.contains(.shift)) }; return }
        c.handle.showFocus = true
        // UIKit delivers key commands on key down only; the slider's keyup commit follows at once.
        if c.key(name, false) { _ = c.key(name, true) }
    }
    override func accessibilityIncrement() { if let c = configuration, c.enabled { c.step(true) } }
    override func accessibilityDecrement() { if let c = configuration, c.enabled { c.step(false) } }
}

struct AWCNativeAdjustableBridge: UIViewRepresentable {
    let configuration: AWCAdjustableConfiguration
    func makeUIView(context: Context) -> AWCNativeAdjustableFocusView { AWCNativeAdjustableFocusView() }
    func updateUIView(_ view: AWCNativeAdjustableFocusView, context: Context) {
        view.configuration = configuration; view.backgroundColor = .clear
        view.isAccessibilityElement = true; view.accessibilityIdentifier = configuration.id; view.accessibilityLabel = configuration.label
        var traits: UIAccessibilityTraits = configuration.role == .image ? .image : .adjustable
        if !configuration.enabled { traits.insert(.notEnabled) }
        view.accessibilityTraits = traits
        view.accessibilityValue = configuration.role == .image ? nil : configuration.valueString
        configuration.handle.requestFocus = { [weak view] in view?.requestNativeFocus(showIndicator: true) ?? false }
        configuration.handle.requestPointerFocus = { [weak view] in view?.requestNativeFocus(showIndicator: false) ?? false }
        configuration.handle.resignFocus = { [weak view] in if let view, view.isFirstResponder { _ = view.resignFirstResponder() } }
        if !view.canBecomeFirstResponder && view.isFirstResponder { _ = view.resignFirstResponder() }
    }
    static func dismantleUIView(_ view: AWCNativeAdjustableFocusView, coordinator: ()) {
        view.configuration?.handle.requestFocus = nil; view.configuration?.handle.requestPointerFocus = nil
    }
}
#endif
