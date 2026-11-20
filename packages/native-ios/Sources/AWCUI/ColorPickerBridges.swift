import SwiftUI
#if canImport(AppKit)
import AppKit
#else
import UIKit
#endif

// md-color-picker platform surfaces: the focus / keyboard / accessibility bridge of the plate, the tracks and the presets
// (Web: tabindex=0 div role=application / role=slider, button role=option), and the outside-press observer of the
// popover (`dismiss-on-outside-click`: a mousedown outside the host closes it).

enum AWCColorPickerRole: Equatable { case application, slider, option(Bool), radio(Bool) }

struct AWCColorPickerBridgeConfig {
    let part: String, label: String, role: AWCColorPickerRole, value: String?, disabled: Bool
    let handle: AWCColorPickerControlHandle
    let focusChanged: (Bool) -> Void
    let key: (String, Bool) -> Bool
}

#if canImport(AppKit)
final class AWCColorPickerControlView: NSView {
    var config: AWCColorPickerBridgeConfig?
    private var requestedVisible: Bool?
    override var acceptsFirstResponder: Bool { config?.disabled == false }
    override var canBecomeKeyView: Bool { config?.disabled == false && window != nil && !isHidden }
    override func hitTest(_ point: NSPoint) -> NSView? { nil }
    func requestFocus(visible: Bool) -> Bool {
        guard acceptsFirstResponder, let window else { return false }
        requestedVisible = visible; defer { requestedVisible = nil }
        config?.handle.showFocus = visible
        if window.firstResponder === self { config?.focusChanged(true); return true }
        return window.makeFirstResponder(self)
    }
    override func becomeFirstResponder() -> Bool {
        guard acceptsFirstResponder else { return false }
        config?.handle.showFocus = requestedVisible ?? true; config?.handle.focused = true; config?.focusChanged(true); return true
    }
    override func resignFirstResponder() -> Bool { config?.handle.focused = false; config?.focusChanged(false); return true }
    override func keyDown(with event: NSEvent) {
        guard let c = config, !c.disabled else { return super.keyDown(with: event) }
        let names: [UInt16: String] = [123: "ArrowLeft", 124: "ArrowRight", 125: "ArrowDown", 126: "ArrowUp", 115: "Home", 119: "End", 116: "PageUp", 121: "PageDown",
                                       36: "Enter", 76: "Enter", 49: "Space", 53: "Escape", 48: "Tab"]
        let key = names[event.keyCode] ?? (event.charactersIgnoringModifiers ?? "")
        if key != "Tab" { c.handle.showFocus = true; c.focusChanged(true) }
        if c.key(key, event.modifierFlags.contains(.shift)) { return }
        if key == "Tab" { AWCDocumentTabOrder.select(from: self, backward: event.modifierFlags.contains(.shift)); return }
        if ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown", "Space", "Enter"].contains(key) { return }
        super.keyDown(with: event)
    }
    override func isAccessibilityElement() -> Bool { config != nil }
    override func accessibilityLabel() -> String? { config?.label }
    override func accessibilityIdentifier() -> String { config?.part ?? "" }
    override func accessibilityRole() -> NSAccessibility.Role? {
        switch config?.role { case .slider?: return .slider; case .option?: return .staticText; case .radio?: return .radioButton; default: return .group }
    }
    override func accessibilityRoleDescription() -> String? { config?.role == .application ? "application" : super.accessibilityRoleDescription() }
    override func accessibilityValue() -> Any? {
        if case .option(let selected)? = config?.role { return selected ? config?.label : config?.label }
        if case .radio(let checked)? = config?.role { return NSNumber(value: checked ? 1 : 0) }
        return config?.value.flatMap { Double($0) }.map { NSNumber(value: $0) }
    }
    override func isAccessibilitySelected() -> Bool { if case .option(let s)? = config?.role { return s }; return false }
    override func isAccessibilityEnabled() -> Bool { config?.disabled == false }
    override func isAccessibilityFocused() -> Bool { window?.firstResponder === self }
    override func setAccessibilityFocused(_ value: Bool) { if value { _ = requestFocus(visible: true) } }
    override func accessibilityPerformIncrement() -> Bool { config?.key(userInterfaceLayoutDirection == .rightToLeft ? "ArrowLeft" : "ArrowRight", false) ?? false }
    override func accessibilityPerformDecrement() -> Bool { config?.key(userInterfaceLayoutDirection == .rightToLeft ? "ArrowRight" : "ArrowLeft", false) ?? false }
    override func accessibilityPerformPress() -> Bool {
        if case .option? = config?.role { return config?.key("Enter", false) ?? false }
        if case .radio? = config?.role { return config?.key("Space", false) ?? false }
        return false
    }
}
struct AWCColorPickerControlBridge: NSViewRepresentable {
    let id: String, part: String, label: String, role: AWCColorPickerRole, value: String?, disabled: Bool
    let handle: AWCColorPickerControlHandle
    let focusChanged: (Bool) -> Void
    let key: (String, Bool) -> Bool
    func makeNSView(context: Context) -> AWCColorPickerControlView { AWCColorPickerControlView() }
    func updateNSView(_ view: AWCColorPickerControlView, context: Context) {
        view.config = .init(part: part, label: label, role: role, value: value, disabled: disabled, handle: handle, focusChanged: focusChanged, key: key)
        handle.focus = { [weak view] visible in view?.requestFocus(visible: visible) ?? false }
        handle.isFocused = { [weak view] in view?.window?.firstResponder === view }
        handle.blur = { [weak view] in if let view, view.window?.firstResponder === view { view.window?.makeFirstResponder(nil) } }
        if disabled && view.window?.firstResponder === view { view.window?.makeFirstResponder(nil) }
    }
}
#else
final class AWCColorPickerControlView: UIView, AWCKeyView {
    var config: AWCColorPickerBridgeConfig?
    private var requestedVisible: Bool?
    override var canBecomeFirstResponder: Bool { config?.disabled == false }
    var awcAcceptsFirstResponder: Bool { canBecomeFirstResponder }
    var awcCanBecomeKeyView: Bool { config?.disabled == false && window != nil && !isHidden }
    func awcBecomeKeyView() -> Bool { requestFocus(visible: true) }
    override func point(inside point: CGPoint, with event: UIEvent?) -> Bool { false }
    func requestFocus(visible: Bool) -> Bool {
        guard canBecomeFirstResponder else { return false }
        requestedVisible = visible; defer { requestedVisible = nil }
        config?.handle.showFocus = visible
        if isFirstResponder { config?.focusChanged(true); return true }
        return becomeFirstResponder()
    }
    override func becomeFirstResponder() -> Bool {
        guard super.becomeFirstResponder() else { return false }
        config?.handle.showFocus = requestedVisible ?? true; config?.handle.focused = true; config?.focusChanged(true); return true
    }
    override func resignFirstResponder() -> Bool {
        guard super.resignFirstResponder() else { return false }
        config?.handle.focused = false; config?.focusChanged(false); return true
    }
    override var keyCommands: [UIKeyCommand]? {
        guard config?.disabled == false else { return [] }
        var out: [UIKeyCommand] = []
        for input in [UIKeyCommand.inputLeftArrow, UIKeyCommand.inputRightArrow, UIKeyCommand.inputUpArrow, UIKeyCommand.inputDownArrow, UIKeyCommand.inputHome,
                      UIKeyCommand.inputEnd, UIKeyCommand.inputPageUp, UIKeyCommand.inputPageDown, UIKeyCommand.inputEscape, "\r", " ", "\t"] {
            for flags in [UIKeyModifierFlags(), .shift] { let c = UIKeyCommand(input: input, modifierFlags: flags, action: #selector(handle(_:))); c.wantsPriorityOverSystemBehavior = true; out.append(c) }
        }
        return out
    }
    @objc private func handle(_ command: UIKeyCommand) {
        guard let c = config else { return }
        let names = [UIKeyCommand.inputLeftArrow: "ArrowLeft", UIKeyCommand.inputRightArrow: "ArrowRight", UIKeyCommand.inputUpArrow: "ArrowUp", UIKeyCommand.inputDownArrow: "ArrowDown",
                     UIKeyCommand.inputHome: "Home", UIKeyCommand.inputEnd: "End", UIKeyCommand.inputPageUp: "PageUp", UIKeyCommand.inputPageDown: "PageDown",
                     UIKeyCommand.inputEscape: "Escape", "\r": "Enter", " ": "Space", "\t": "Tab"]
        let key = names[command.input ?? ""] ?? "", shift = command.modifierFlags.contains(.shift)
        if key != "Tab" { c.handle.showFocus = true; c.focusChanged(true) }
        if c.key(key, shift) { return }
        if key == "Tab", let window { AWCKeyViewLoop.select(from: self, in: window, backward: shift) }
        // An Escape the picker does not use (no open popover) continues to an open modal, as the keydown bubbles on Web.
        if key == "Escape", let window { AWCModalHostView.active(in: window)?.session?.escape() }
    }
    override var isAccessibilityElement: Bool { get { config != nil } set {} }
    override var accessibilityLabel: String? { get { config?.label } set {} }
    override var accessibilityValue: String? { get { if case .option? = config?.role { return nil }; return config?.value } set {} }
    override var accessibilityTraits: UIAccessibilityTraits {
        get {
            let traits: UIAccessibilityTraits
            switch config?.role { case .slider?, .application?: traits = .adjustable; case .option(let s)?, .radio(let s)?: traits = s ? [.button, .selected] : .button; default: traits = .none }
            // A disabled picker's controls are not enabled (Web: aria-disabled on the slider, disabled options).
            return config?.disabled == true ? traits.union(.notEnabled) : traits
        }
        set {}
    }
    override func accessibilityIncrement() { _ = config?.key(effectiveUserInterfaceLayoutDirection == .rightToLeft ? "ArrowLeft" : "ArrowRight", false) }
    override func accessibilityDecrement() { _ = config?.key(effectiveUserInterfaceLayoutDirection == .rightToLeft ? "ArrowRight" : "ArrowLeft", false) }
    override func accessibilityActivate() -> Bool {
        if case .option? = config?.role { return config?.key("Enter", false) ?? false }
        if case .radio? = config?.role { return config?.key("Space", false) ?? false }
        return false
    }
}
struct AWCColorPickerControlBridge: UIViewRepresentable {
    let id: String, part: String, label: String, role: AWCColorPickerRole, value: String?, disabled: Bool
    let handle: AWCColorPickerControlHandle
    let focusChanged: (Bool) -> Void
    let key: (String, Bool) -> Bool
    func makeUIView(context: Context) -> AWCColorPickerControlView { AWCColorPickerControlView() }
    func updateUIView(_ view: AWCColorPickerControlView, context: Context) {
        view.config = .init(part: part, label: label, role: role, value: value, disabled: disabled, handle: handle, focusChanged: focusChanged, key: key)
        view.accessibilityIdentifier = id
        handle.focus = { [weak view] visible in view?.requestFocus(visible: visible) ?? false }
        handle.isFocused = { [weak view] in view?.isFirstResponder ?? false }
        handle.blur = { [weak view] in if let view, view.isFirstResponder { _ = view.resignFirstResponder() } }
        if disabled && view.isFirstResponder { _ = view.resignFirstResponder() }
    }
}
#endif

// MARK: Outside press (`dismiss-on-outside-click`)

/// Regions that count as "inside" the picker (the host with its trigger, the popover panel), by picker.
@MainActor final class AWCColorPickerRegions {
    static var byOwner: [ObjectIdentifier: [WeakRegion]] = [:]
    final class WeakRegion { weak var view: AWCPlatformRegionView?; init(_ v: AWCPlatformRegionView) { view = v } }
    static func add(_ v: AWCPlatformRegionView, owner: ObjectIdentifier) { byOwner[owner, default: []].removeAll { $0.view == nil || $0.view === v }; byOwner[owner, default: []].append(.init(v)) }
    static func contains(_ windowPoint: CGPoint, owner: ObjectIdentifier, window: AnyObject?) -> Bool {
        (byOwner[owner] ?? []).contains { r in
            guard let v = r.view, v.window === window else { return false }
            #if canImport(AppKit)
            return v.convert(v.bounds, to: nil).contains(windowPoint)
            #else
            return v.convert(v.bounds, to: nil).contains(windowPoint)
            #endif
        }
    }
}
#if canImport(AppKit)
final class AWCPlatformRegionView: NSView { override func hitTest(_ point: NSPoint) -> NSView? { nil } }
#else
final class AWCPlatformRegionView: UIView { override func point(inside point: CGPoint, with event: UIEvent?) -> Bool { false } }
#endif

/// Marks its frame as inside the picker owned by `owner`.
struct AWCColorPickerOutsidePressRegion: View {
    let owner: AnyObject
    var body: some View { AWCColorPickerRegionRepresentable(owner: ObjectIdentifier(owner)).allowsHitTesting(false).accessibilityHidden(true) }
}
#if canImport(AppKit)
private struct AWCColorPickerRegionRepresentable: NSViewRepresentable {
    let owner: ObjectIdentifier
    func makeNSView(context: Context) -> AWCPlatformRegionView { let v = AWCPlatformRegionView(); AWCColorPickerRegions.add(v, owner: owner); return v }
    func updateNSView(_ view: AWCPlatformRegionView, context: Context) { AWCColorPickerRegions.add(view, owner: owner) }
}
#else
private struct AWCColorPickerRegionRepresentable: UIViewRepresentable {
    let owner: ObjectIdentifier
    func makeUIView(context: Context) -> AWCPlatformRegionView { let v = AWCPlatformRegionView(); AWCColorPickerRegions.add(v, owner: owner); return v }
    func updateUIView(_ view: AWCPlatformRegionView, context: Context) { AWCColorPickerRegions.add(view, owner: owner) }
}
#endif

/// Calls `action` for a primary press outside every region of `owner` (AppKit: local mouse-down monitor; UIKit: a passive
/// window recognizer; a host-supplied `AWCNativePointerState` drives it when present).
struct AWCColorPickerOutsidePress: View {
    let owner: AnyObject
    let action: () -> Void
    @Environment(\.awcNativePointerState) private var pointer
    var body: some View {
        if let pointer {
            // Every press counts, also one already released when SwiftUI delivers the change (a click within one update).
            Color.clear.allowsHitTesting(false).onChange(of: pointer.pressSequence) { _, _ in
                guard let p = pointer.pressLocation else { return }
                if !AWCColorPickerPreviewRegions.contains(p, owner: ObjectIdentifier(owner)) { action() }
            }
        } else {
            AWCColorPickerOutsideMonitor(owner: ObjectIdentifier(owner), action: action).allowsHitTesting(false).accessibilityHidden(true)
        }
    }
}
/// Region frames in the "awc-native-preview" space (for host-supplied pointer state).
@MainActor enum AWCColorPickerPreviewRegions {
    static var frames: [ObjectIdentifier: [String: CGRect]] = [:]
    static func set(_ r: CGRect, _ key: String, owner: ObjectIdentifier) { frames[owner, default: [:]][key] = r }
    static func contains(_ p: CGPoint, owner: ObjectIdentifier) -> Bool { (frames[owner] ?? [:]).values.contains { $0.contains(p) } }
}
#if canImport(AppKit)
private final class AWCOutsideMonitorView: NSView {
    var owner: ObjectIdentifier?; var action: () -> Void = {}
    private var monitor: Any?
    override func hitTest(_ point: NSPoint) -> NSView? { nil }
    override func viewDidMoveToWindow() {
        super.viewDidMoveToWindow(); stop()
        guard window != nil else { return }
        // Armed on the next frame, as the Web attaches its listener in requestAnimationFrame.
        DispatchQueue.main.async { [weak self] in
            guard let self, self.window != nil, self.monitor == nil else { return }
            self.monitor = NSEvent.addLocalMonitorForEvents(matching: .leftMouseDown) { [weak self] e in
                guard let self, let owner = self.owner, e.window === self.window else { return e }
                if !AWCColorPickerRegions.contains(e.locationInWindow, owner: owner, window: self.window) { self.action() }
                return e
            }
        }
    }
    func stop() { if let monitor { NSEvent.removeMonitor(monitor); self.monitor = nil } }
}
private struct AWCColorPickerOutsideMonitor: NSViewRepresentable {
    let owner: ObjectIdentifier, action: () -> Void
    func makeNSView(context: Context) -> AWCOutsideMonitorView { AWCOutsideMonitorView() }
    func updateNSView(_ v: AWCOutsideMonitorView, context: Context) { v.owner = owner; v.action = action }
    static func dismantleNSView(_ v: AWCOutsideMonitorView, coordinator: ()) { v.stop() }
}
#else
private final class AWCOutsidePressRecognizer: UIGestureRecognizer, UIGestureRecognizerDelegate {
    var owner: ObjectIdentifier?; var action: () -> Void = {}
    override init(target: Any?, action: Selector?) { super.init(target: target, action: action); cancelsTouchesInView = false; delaysTouchesBegan = false; delaysTouchesEnded = false; delegate = self }
    func gestureRecognizer(_ g: UIGestureRecognizer, shouldRecognizeSimultaneouslyWith o: UIGestureRecognizer) -> Bool { true }
    override func canPrevent(_ p: UIGestureRecognizer) -> Bool { false }
    override func canBePrevented(by p: UIGestureRecognizer) -> Bool { false }
    override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent) {
        guard let owner, let w = view as? UIWindow, let t = touches.first else { return }
        if !AWCColorPickerRegions.contains(t.location(in: w), owner: owner, window: w) { action() }
    }
    override func touchesEnded(_ touches: Set<UITouch>, with event: UIEvent) { state = .failed }
    override func touchesCancelled(_ touches: Set<UITouch>, with event: UIEvent) { state = .failed }
}
private final class AWCOutsideMonitorView: UIView {
    let recognizer = AWCOutsidePressRecognizer(target: nil, action: nil)
    override func point(inside point: CGPoint, with event: UIEvent?) -> Bool { false }
    override func didMoveToWindow() {
        super.didMoveToWindow(); recognizer.view?.removeGestureRecognizer(recognizer)
        guard let window else { return }
        DispatchQueue.main.async { [weak self, weak window] in guard let self, let window, self.window === window else { return }; window.addGestureRecognizer(self.recognizer) }
    }
    func stop() { recognizer.view?.removeGestureRecognizer(recognizer) }
}
private struct AWCColorPickerOutsideMonitor: UIViewRepresentable {
    let owner: ObjectIdentifier, action: () -> Void
    func makeUIView(context: Context) -> AWCOutsideMonitorView { AWCOutsideMonitorView() }
    func updateUIView(_ v: AWCOutsideMonitorView, context: Context) { v.recognizer.owner = owner; v.recognizer.action = action }
    static func dismantleUIView(_ v: AWCOutsideMonitorView, coordinator: ()) { v.stop() }
}
#endif
