import SwiftUI
import Accessibility

// The chart plot as a keyboard stop and accessibility element (Web: the plot is a focusable role="application" element
// that the arrow keys drive). SwiftUI focus is not part of the AppKit key-view loop or the UIKit focus system that a
// hardware Tab walks, so — like the AWC button focus bridge — an invisible native view carries focus, keys and the
// accessibility element (label = labelPlot, value = the cursor announcement, the chart descriptor), while pointer
// input stays with the SwiftUI plot (the bridge never hit-tests). Announcements stay with AWCChartState (the Web live region).

struct AWCChartPlotFocusConfiguration {
    var label: String
    var value: String
    var descriptor: AWCChartAXDescriptor?
    var rtl: Bool
    /// The Web key name ("ArrowRight", "Home", …); true when the chart handled it.
    var onKey: (String) -> Bool
    var onFocus: (Bool) -> Void
    func step(_ forward: Bool) { _ = onKey(forward != rtl ? "ArrowRight" : "ArrowLeft") }
}

#if canImport(AppKit)
import AppKit

final class AWCChartPlotFocusView: NSView, AXChart {
    var configuration: AWCChartPlotFocusConfiguration?
    var accessibilityChartDescriptor: AXChartDescriptor? {
        get { configuration?.descriptor?.makeChartDescriptor() }
        set { }
    }
    override var acceptsFirstResponder: Bool { configuration != nil }
    override var canBecomeKeyView: Bool { configuration != nil && window != nil && !isHidden }
    override func hitTest(_ point: NSPoint) -> NSView? { nil }
    override func becomeFirstResponder() -> Bool { configuration?.onFocus(true); needsDisplay = true; return true }
    override func resignFirstResponder() -> Bool { configuration?.onFocus(false); needsDisplay = true; return true }
    override var focusRingMaskBounds: NSRect { bounds }
    override func drawFocusRingMask() { NSBezierPath(rect: bounds).fill() }
    override func keyDown(with event: NSEvent) {
        guard let c = configuration else { return super.keyDown(with: event) }
        let key: String
        switch event.keyCode {
        case 123: key = "ArrowLeft"; case 124: key = "ArrowRight"; case 125: key = "ArrowDown"; case 126: key = "ArrowUp"
        case 115: key = "Home"; case 119: key = "End"; case 53: key = "Escape"; case 36, 76: key = "Enter"; case 49: key = " "
        case 48:
            if event.modifierFlags.contains(.shift) { window?.selectPreviousKeyView(self) } else { window?.selectNextKeyView(self) }
            return
        default: return super.keyDown(with: event)
        }
        if !c.onKey(key) { super.keyDown(with: event) }
    }
    override func isAccessibilityElement() -> Bool { configuration != nil }
    override func accessibilityRole() -> NSAccessibility.Role? { .group }
    override func accessibilityLabel() -> String? { configuration?.label }
    override func accessibilityValue() -> Any? { configuration?.value }
    override func isAccessibilityFocused() -> Bool { window?.firstResponder === self }
    override func setAccessibilityFocused(_ value: Bool) { if value { window?.makeFirstResponder(self) } }
    override func accessibilityPerformIncrement() -> Bool { configuration?.step(true); return configuration != nil }
    override func accessibilityPerformDecrement() -> Bool { configuration?.step(false); return configuration != nil }
}

struct AWCChartPlotFocusBridge: NSViewRepresentable {
    let configuration: AWCChartPlotFocusConfiguration
    func makeNSView(context: Context) -> AWCChartPlotFocusView { AWCChartPlotFocusView() }
    func updateNSView(_ view: AWCChartPlotFocusView, context: Context) { view.configuration = configuration }
}
#else
import UIKit

final class AWCChartPlotFocusView: UIView, AXChart, AWCKeyView {
    var configuration: AWCChartPlotFocusConfiguration? { didSet { refresh() } }
    var accessibilityChartDescriptor: AXChartDescriptor? {
        get { configuration?.descriptor?.makeChartDescriptor() }
        set { }
    }
    override init(frame: CGRect) { super.init(frame: frame); backgroundColor = .clear; isAccessibilityElement = true }
    required init?(coder: NSCoder) { fatalError() }
    private func refresh() {
        isAccessibilityElement = configuration != nil
        accessibilityLabel = configuration?.label
        accessibilityValue = configuration?.value
        accessibilityTraits = configuration == nil ? [] : .adjustable
    }
    override func point(inside point: CGPoint, with event: UIEvent?) -> Bool { false }
    // The AWC key-view loop (NativeKeyViewLoop.swift): Tab / Shift+Tab reach the plot in geometric order, as AppKit does.
    override var canBecomeFirstResponder: Bool { configuration != nil }
    var awcAcceptsFirstResponder: Bool { canBecomeFirstResponder }
    var awcCanBecomeKeyView: Bool { configuration != nil && window != nil && !isHidden }
    func awcBecomeKeyView() -> Bool { requestNativeFocus() }
    override var focusGroupIdentifier: String? { get { awcCanBecomeKeyView ? "awc.key-view.\(UInt(bitPattern: ObjectIdentifier(self).hashValue))" : nil } set {} }
    override var canBecomeFocused: Bool { configuration != nil }
    override func didUpdateFocus(in context: UIFocusUpdateContext, with coordinator: UIFocusAnimationCoordinator) {
        super.didUpdateFocus(in: context, with: coordinator)
        if context.nextFocusedItem === self { _ = becomeFirstResponder() } else if context.previouslyFocusedItem === self { _ = resignFirstResponder() }
    }
    func requestNativeFocus() -> Bool {
        guard canBecomeFirstResponder else { return false }
        if let system = UIFocusSystem.focusSystem(for: self) { system.requestFocusUpdate(to: self); system.updateFocusIfNeeded() }
        return becomeFirstResponder()
    }
    override func becomeFirstResponder() -> Bool {
        if isFirstResponder { return true }
        guard super.becomeFirstResponder() else { return false }
        configuration?.onFocus(true); return true
    }
    override func resignFirstResponder() -> Bool {
        guard super.resignFirstResponder() else { return false }
        configuration?.onFocus(false); return true
    }
    private static let names = [UIKeyCommand.inputLeftArrow: "ArrowLeft", UIKeyCommand.inputRightArrow: "ArrowRight", UIKeyCommand.inputUpArrow: "ArrowUp",
                                UIKeyCommand.inputDownArrow: "ArrowDown", UIKeyCommand.inputHome: "Home", UIKeyCommand.inputEnd: "End",
                                UIKeyCommand.inputEscape: "Escape", "\r": "Enter", " ": " "]
    override var keyCommands: [UIKeyCommand]? {
        guard configuration != nil else { return [] }
        var commands = (Array(Self.names.keys) + ["\t"]).map { input -> UIKeyCommand in
            let command = UIKeyCommand(input: input, modifierFlags: [], action: #selector(handleKey(_:)))
            command.wantsPriorityOverSystemBehavior = true; return command
        }
        let reverse = UIKeyCommand(input: "\t", modifierFlags: .shift, action: #selector(handleKey(_:)))
        reverse.wantsPriorityOverSystemBehavior = true; commands.append(reverse)
        return commands
    }
    @objc private func handleKey(_ command: UIKeyCommand) {
        guard let c = configuration, let input = command.input else { return }
        if input == "\t" { if let window { AWCKeyViewLoop.select(from: self, in: window, backward: command.modifierFlags.contains(.shift)) }; return }
        if let name = Self.names[input] { _ = c.onKey(name) }
    }
    override func accessibilityIncrement() { configuration?.step(true) }
    override func accessibilityDecrement() { configuration?.step(false) }
}

struct AWCChartPlotFocusBridge: UIViewRepresentable {
    let configuration: AWCChartPlotFocusConfiguration
    func makeUIView(context: Context) -> AWCChartPlotFocusView { AWCChartPlotFocusView(frame: .zero) }
    func updateUIView(_ view: AWCChartPlotFocusView, context: Context) { view.configuration = configuration }
}
#endif
