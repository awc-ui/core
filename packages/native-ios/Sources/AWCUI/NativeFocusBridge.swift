import SwiftUI

private struct AWCButtonFocusGroupKey: EnvironmentKey { static let defaultValue: AWCButtonFocusGroup? = nil }
private struct AWCNativeFocusChangedKey: EnvironmentKey { static let defaultValue: ((String, Bool) -> Void)? = nil }
private struct AWCGridCellContextKey: EnvironmentKey { static let defaultValue: AWCGridCellContext? = nil }
public extension EnvironmentValues {
    var awcNativeFocusChanged: ((String, Bool) -> Void)? { get { self[AWCNativeFocusChangedKey.self] } set { self[AWCNativeFocusChangedKey.self] = newValue } }
    var awcButtonFocusGroup: AWCButtonFocusGroup? { get { self[AWCButtonFocusGroupKey.self] } set { self[AWCButtonFocusGroupKey.self] = newValue } }
    var awcGridCellContext: AWCGridCellContext? { get { self[AWCGridCellContextKey.self] } set { self[AWCGridCellContextKey.self] = newValue } }
}

struct AWCNativeFocusConfiguration {
    let id: String
    let label: String
    let policy: AWCButtonAccessibilityPolicy
    let group: AWCButtonFocusGroup?
    let cell: AWCGridCellContext?
    let handle: AWCButtonFocusHandle
    let focusChanged: (Bool) -> Void
    let activate: () -> Void
    var applicableGroup: AWCButtonFocusGroup? { group?.items.contains(where: { $0.id == id }) == true ? group : nil }
    var sequential: Bool { !policy.hardDisabled && (applicableGroup.map { $0.tabindex(for: id) >= 0 } ?? policy.sequentiallyFocusable) }
}

#if canImport(AppKit)
import AppKit

/// Native first-responder and accessibility surface; pointer hits reach the visible SwiftUI Button.
final class AWCNativeButtonFocusView: NSView {
    var configuration: AWCNativeFocusConfiguration?
    override var acceptsFirstResponder: Bool { configuration?.policy.programmaticallyFocusable == true }
    override var canBecomeKeyView: Bool { configuration?.sequential == true && window != nil && !isHidden }
    override func hitTest(_ point: NSPoint) -> NSView? { nil }
    override func becomeFirstResponder() -> Bool {
        guard acceptsFirstResponder else { return false }
        if window?.firstResponder === self && configuration?.handle.isFocused == true { return true }
        configuration?.handle.isFocused = true
        if let c = configuration { c.group?.didFocus(id: c.id); c.focusChanged(true) }
        return true
    }
    override func resignFirstResponder() -> Bool {
        configuration?.handle.isFocused = false; configuration?.focusChanged(false); return true
    }
    override func keyDown(with event: NSEvent) {
        guard let c = configuration else { return }
        let key: String
        switch event.keyCode {
        case 123: key = "ArrowLeft"; case 124: key = "ArrowRight"; case 115: key = "Home"; case 119: key = "End"
        case 36, 76: key = "Enter"; case 49: key = "Space"
        case 48: if event.modifierFlags.contains(.shift) { window?.selectPreviousKeyView(self) } else { window?.selectNextKeyView(self) }; return
        default: super.keyDown(with: event); return
        }
        if ["Enter", "Space"].contains(key) { if !c.policy.activationBlocked { c.activate() }; return }
        if c.applicableGroup?.move(key, from: c.id) != true { super.keyDown(with: event) }
    }
    override func isAccessibilityElement() -> Bool { true }
    override func accessibilityIdentifier() -> String { configuration?.id ?? "" }
    override func accessibilityLabel() -> String? { configuration?.label }
    override func accessibilityRole() -> NSAccessibility.Role? {
        switch configuration?.policy.role { case .gridcell: return .cell; case .link: return .link; default: return .button }
    }
    override func isAccessibilityEnabled() -> Bool { configuration?.policy.activationBlocked == false }
    override func isAccessibilitySelected() -> Bool { configuration?.policy.selected == true }
    override func isAccessibilityFocused() -> Bool { window?.firstResponder === self }
    override func setAccessibilityFocused(_ value: Bool) { if value { _ = window?.makeFirstResponder(self) } }
    override func accessibilityValue() -> Any? { configuration?.policy.selected == true ? "Selected" : nil }
    override func accessibilityRowIndexRange() -> NSRange { configuration?.cell?.rowRange ?? NSRange(location: NSNotFound, length: 0) }
    override func accessibilityColumnIndexRange() -> NSRange { configuration?.cell?.columnRange ?? NSRange(location: NSNotFound, length: 0) }
    override func accessibilityPerformPress() -> Bool {
        guard let c = configuration, !c.policy.activationBlocked else { return false }; c.activate(); return true
    }
}

struct AWCNativeButtonFocusBridge: NSViewRepresentable {
    let configuration: AWCNativeFocusConfiguration
    func makeNSView(context: Context) -> AWCNativeButtonFocusView { AWCNativeButtonFocusView() }
    func updateNSView(_ view: AWCNativeButtonFocusView, context: Context) {
        if let previous = view.configuration, previous.group !== configuration.group || previous.id != configuration.id { previous.group?.unregister(id: previous.id) }
        view.configuration = configuration
        let focus = { [weak view] in guard let view else { return false }; return view.window?.makeFirstResponder(view) ?? false }
        configuration.handle.requestFocus = focus; configuration.group?.register(id: configuration.id, requestFocus: focus)
        if configuration.policy.hardDisabled && view.window?.firstResponder === view { _ = view.window?.makeFirstResponder(nil) }
    }
    static func dismantleNSView(_ view: AWCNativeButtonFocusView, coordinator: ()) {
        view.configuration?.group?.unregister(id: view.configuration?.id ?? ""); view.configuration?.handle.requestFocus = nil
    }
}
#elseif canImport(UIKit)
import UIKit

/// UIKit has no ARIA gridcell trait. Data-table-cell location plus actionable
/// button/selected traits supplies the native equivalent for composite owners.
final class AWCNativeButtonFocusView: UIView, UIAccessibilityContainerDataTableCell {
    var configuration: AWCNativeFocusConfiguration?
    override var canBecomeFirstResponder: Bool { configuration?.policy.programmaticallyFocusable == true }
    private var requestingExplicitFocus = false
    override var canBecomeFocused: Bool { configuration?.policy.programmaticallyFocusable == true && (requestingExplicitFocus || configuration?.sequential == true) }
    override func didUpdateFocus(in context: UIFocusUpdateContext, with coordinator: UIFocusAnimationCoordinator) {
        super.didUpdateFocus(in: context, with: coordinator)
        if context.nextFocusedItem === self { _ = becomeFirstResponder() }
        else if context.previouslyFocusedItem === self { _ = resignFirstResponder() }
    }
    func requestNativeFocus() -> Bool {
        guard canBecomeFirstResponder else { return false }
        requestingExplicitFocus = true
        if let system = UIFocusSystem.focusSystem(for: self) {
            system.requestFocusUpdate(to: self); system.updateFocusIfNeeded()
        }
        let accepted = becomeFirstResponder()
        if !accepted { requestingExplicitFocus = false }
        return accepted
    }
    override func point(inside point: CGPoint, with event: UIEvent?) -> Bool { false }
    override func becomeFirstResponder() -> Bool {
        if isFirstResponder { return true }
        guard super.becomeFirstResponder() else { return false }
        configuration?.handle.isFocused = true
        if let c = configuration { c.group?.didFocus(id: c.id); c.focusChanged(true) }; return true
    }
    override func resignFirstResponder() -> Bool {
        guard super.resignFirstResponder() else { return false }
        requestingExplicitFocus = false
        configuration?.handle.isFocused = false; configuration?.focusChanged(false); return true
    }
    override var keyCommands: [UIKeyCommand]? {
        var keys = ["\r", " "]
        if configuration?.applicableGroup != nil { keys += [UIKeyCommand.inputLeftArrow, UIKeyCommand.inputRightArrow, UIKeyCommand.inputHome, UIKeyCommand.inputEnd] }
        return keys.map { input in
            let command = UIKeyCommand(input: input, modifierFlags: [], action: #selector(handleKey(_:)))
            command.wantsPriorityOverSystemBehavior = true; return command
        }
    }
    @objc private func handleKey(_ command: UIKeyCommand) {
        guard let c = configuration else { return }
        let key = command.input ?? ""
        if key == "\r" || key == " " { if !c.policy.activationBlocked { c.activate() }; return }
        let names = [UIKeyCommand.inputLeftArrow: "ArrowLeft", UIKeyCommand.inputRightArrow: "ArrowRight", UIKeyCommand.inputHome: "Home", UIKeyCommand.inputEnd: "End"]
        if let name = names[key] { _ = c.applicableGroup?.move(name, from: c.id) }
    }
    override func accessibilityActivate() -> Bool {
        guard let c = configuration, !c.policy.activationBlocked else { return false }; c.activate(); return true
    }
    func accessibilityRowRange() -> NSRange { configuration?.cell?.rowRange ?? NSRange(location: NSNotFound, length: 0) }
    func accessibilityColumnRange() -> NSRange { configuration?.cell?.columnRange ?? NSRange(location: NSNotFound, length: 0) }
}
struct AWCNativeButtonFocusBridge: UIViewRepresentable {
    let configuration: AWCNativeFocusConfiguration
    func makeUIView(context: Context) -> AWCNativeButtonFocusView { AWCNativeButtonFocusView() }
    func updateUIView(_ view: AWCNativeButtonFocusView, context: Context) {
        if let previous = view.configuration, previous.group !== configuration.group || previous.id != configuration.id { previous.group?.unregister(id: previous.id) }
        view.configuration = configuration; view.backgroundColor = .clear
        view.isAccessibilityElement = true; view.accessibilityIdentifier = configuration.id; view.accessibilityLabel = configuration.label
        var traits: UIAccessibilityTraits = configuration.policy.role == .link ? .link : .button
        if configuration.policy.selected { traits.insert(.selected) }; if configuration.policy.activationBlocked { traits.insert(.notEnabled) }
        view.accessibilityTraits = traits
        view.accessibilityHint = configuration.policy.role == .gridcell ? "Grid cell" : nil
        let focus = { [weak view] in view?.requestNativeFocus() ?? false }
        configuration.handle.requestFocus = focus; configuration.group?.register(id: configuration.id, requestFocus: focus)
        if configuration.policy.hardDisabled && view.isFirstResponder { _ = view.resignFirstResponder() }
    }
    static func dismantleUIView(_ view: AWCNativeButtonFocusView, coordinator: ()) {
        view.configuration?.group?.unregister(id: view.configuration?.id ?? ""); view.configuration?.handle.requestFocus = nil
    }
}
#endif

struct AWCIconButtonFocusModifier: ViewModifier {
    let id: String
    let label: String
    let enabled: Bool
    let properties: [String: AWCValue]
    let group: AWCButtonFocusGroup?
    let handle: AWCButtonFocusHandle
    let focusChanged: ((String, Bool) -> Void)?
    let activate: () -> Void
    @ViewBuilder func body(content: Content) -> some View {
        if enabled {
            content.focusable(false).accessibilityHidden(true).background {
                AWCNativeButtonFocusBridge(configuration: .init(id: id, label: label,
                    policy: .init(properties: properties), group: group, cell: nil, handle: handle,
                    focusChanged: { focusChanged?(id, $0) }, activate: activate)).accessibilityHidden(false)
            }
        } else { content }
    }
}
