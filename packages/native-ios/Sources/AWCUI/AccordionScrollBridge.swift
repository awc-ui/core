import SwiftUI
import Observation

@Observable final class AWCAccordionScrollState {
    var focused = false
    @ObservationIgnored var offset = 0.0
}

#if canImport(AppKit)
import AppKit

/// Supplements the real SwiftUI NSScrollView with a keyboard tab stop. It
/// neither owns a second hosting tree nor replaces SwiftUI's scroll delegate.
final class AWCAccordionScrollFocusView: NSView {
    var scrollState: AWCAccordionScrollState?
    var scrollable = false, inert = true
    private var restore = false, restoring = false, restorationScheduled = false
    private weak var observedClip: NSClipView?
    private var observation: NSObjectProtocol?
    override var acceptsFirstResponder: Bool { scrollable && !inert }
    override var canBecomeKeyView: Bool { acceptsFirstResponder && window != nil && !isHidden }
    override func hitTest(_ point: NSPoint) -> NSView? { nil }
    override func isAccessibilityElement() -> Bool { false } // The native scroll view owns the scroll-area role.
    override func becomeFirstResponder() -> Bool {
        guard acceptsFirstResponder else { return false }; scrollState?.focused = true; return true
    }
    override func resignFirstResponder() -> Bool { scrollState?.focused = false; return true }
    func configure(scrollable: Bool, inert: Bool, state: AWCAccordionScrollState) {
        if scrollable && !self.scrollable { restore = true }
        self.scrollable = scrollable; self.inert = inert; scrollState = state
        if !acceptsFirstResponder && window?.firstResponder === self { window?.makeFirstResponder(nil) }
        DispatchQueue.main.async { [weak self] in self?.connect() }
    }
    override func viewDidMoveToWindow() { super.viewDidMoveToWindow(); connect() }
    override func layout() { super.layout(); connect() }
    private func connect(restoreNow: Bool = false) {
        guard let scroll = enclosingScrollView else { return }
        let clip = scroll.contentView
        if observedClip !== clip {
            disconnect(); observedClip = clip; clip.postsBoundsChangedNotifications = true
            observation = NotificationCenter.default.addObserver(forName: NSView.boundsDidChangeNotification, object: clip, queue: .main) { [weak self] _ in
                guard let self, scrollable, !restoring, let clip = observedClip else { return }
                if restore { connect(); return }
                scrollState?.offset = clip.bounds.minY
            }
        }
        if restore, scrollable {
            // A bounds notification can occur inside SwiftUI's resize. Its
            // final offset write would overwrite synchronous restoration.
            // Keep the saved offset protected until that transaction finishes.
            if !restoreNow {
                guard !restorationScheduled else { return }
                restorationScheduled = true
                DispatchQueue.main.async { [weak self] in
                    guard let self else { return }
                    restorationScheduled = false; connect(restoreNow: true)
                }
                return
            }
            let maximum = max(0,(scroll.documentView?.frame.height ?? 0)-clip.bounds.height)
            // Updating the modifier can precede SwiftUI's viewport layout.
            // Keep the saved offset pending while the old uncapped viewport
            // still fills the document; layout() will retry after it shrinks.
            guard maximum > 0 || (scrollState?.offset ?? 0) <= 0 else { return }
            restoring = true
            clip.scroll(to: .init(x: 0,y: min(maximum,scrollState?.offset ?? 0)))
            scroll.reflectScrolledClipView(clip); restoring = false; restore = false
        }
    }
    func disconnect() {
        if let observation { NotificationCenter.default.removeObserver(observation) }
        observation = nil; observedClip = nil
    }
    deinit { if let observation { NotificationCenter.default.removeObserver(observation) } }
    private func scroll(_ key: UInt16, backwards: Bool, in view: NSScrollView) -> Bool {
        let clip = view.contentView, maximum = max(0,(view.documentView?.frame.height ?? 0)-view.contentSize.height)
        let current = clip.bounds.minY, page = max(1,view.contentSize.height * 0.875)
        let target: Double
        switch key {
        case 125: target = current+40
        case 126: target = current-40
        case 121: target = current+page
        case 116: target = current-page
        case 49: target = current+(backwards ? -page : page)
        case 115: target = 0
        case 119: target = maximum
        default: return false
        }
        let next = min(maximum,max(0,target))
        guard abs(next-current) > 0.01 else { return false }
        clip.scroll(to: .init(x: clip.bounds.minX,y: next)); view.reflectScrolledClipView(clip); return true
    }
    override func keyDown(with event: NSEvent) {
        guard acceptsFirstResponder else { return }
        if event.keyCode == 48 {
            if event.modifierFlags.contains(.shift) { window?.selectPreviousKeyView(self) } else { window?.selectNextKeyView(self) }; return
        }
        guard event.modifierFlags.intersection([.command,.control,.option]).isEmpty else { super.keyDown(with: event); return }
        var current = enclosingScrollView
        while let view = current {
            if scroll(event.keyCode, backwards: event.modifierFlags.contains(.shift), in: view) { return }
            current = view.enclosingScrollView
        }
        super.keyDown(with: event)
    }
}
struct AWCAccordionScrollBridge: NSViewRepresentable {
    let id: String, scrollable: Bool, state: AWCAccordionScrollState
    @Environment(\.awcNativeInert) private var inert
    func makeNSView(context: Context) -> AWCAccordionScrollFocusView { AWCAccordionScrollFocusView() }
    func updateNSView(_ view: AWCAccordionScrollFocusView, context: Context) {
        view.setAccessibilityIdentifier(id); view.configure(scrollable: scrollable, inert: inert, state: state)
    }
    static func dismantleNSView(_ view: AWCAccordionScrollFocusView, coordinator: ()) { view.disconnect() }
}
#elseif canImport(UIKit)
import UIKit

final class AWCAccordionScrollFocusView: UIView, AWCKeyView {
    var scrollState: AWCAccordionScrollState?
    var scrollable = false, inert = true
    private var restore = false, restorationScheduled = false
    private weak var observedScroll: UIScrollView?
    private var observation: NSKeyValueObservation?
    private var boundsObservation: NSKeyValueObservation?
    private var sizeObservation: NSKeyValueObservation?
    private var restoring = false
    private var scrollView: UIScrollView? {
        var parent = superview
        while let view = parent { if let scroll = view as? UIScrollView { return scroll }; parent = view.superview }
        return nil
    }
    override var canBecomeFirstResponder: Bool { scrollable && !inert }
    override var canBecomeFocused: Bool { canBecomeFirstResponder }
    var awcAcceptsFirstResponder: Bool { canBecomeFirstResponder }
    var awcCanBecomeKeyView: Bool { canBecomeFirstResponder && window != nil && !isHidden }
    func awcBecomeKeyView() -> Bool { becomeFirstResponder() }
    override var focusGroupIdentifier: String? { get { awcCanBecomeKeyView ? "awc.key-view.\(UInt(bitPattern: ObjectIdentifier(self).hashValue))" : nil } set {} }
    override func point(inside point: CGPoint, with event: UIEvent?) -> Bool { false }
    override func becomeFirstResponder() -> Bool {
        guard canBecomeFirstResponder, super.becomeFirstResponder() else { return false }; scrollState?.focused = true; return true
    }
    override func resignFirstResponder() -> Bool {
        guard super.resignFirstResponder() else { return false }; scrollState?.focused = false; return true
    }
    override func didUpdateFocus(in context: UIFocusUpdateContext, with coordinator: UIFocusAnimationCoordinator) {
        super.didUpdateFocus(in: context, with: coordinator)
        if context.nextFocusedItem === self { _ = becomeFirstResponder() }
        else if context.previouslyFocusedItem === self { _ = resignFirstResponder() }
    }
    func configure(scrollable: Bool, inert: Bool, state: AWCAccordionScrollState) {
        if scrollable && !self.scrollable { restore = true }
        self.scrollable = scrollable; self.inert = inert; scrollState = state
        if !canBecomeFirstResponder && isFirstResponder { _ = resignFirstResponder() }
        DispatchQueue.main.async { [weak self] in self?.connect() }
    }
    override func layoutSubviews() { super.layoutSubviews(); connect() }
    private func connect(restoreNow: Bool = false) {
        guard let scroll = scrollView else { return }
        if observedScroll !== scroll {
            observedScroll = scroll
            observation = scroll.observe(\.contentOffset, options: []) { [weak self] scroll, _ in
                guard let self, scrollable, !restoring else { return }
                if restore { connect(); return }; scrollState?.offset = scroll.contentOffset.y
            }
            boundsObservation = scroll.observe(\.bounds, options: []) { [weak self] _, _ in
                guard let self, restore, !restoring else { return }; connect()
            }
            sizeObservation = scroll.observe(\.contentSize, options: []) { [weak self] _, _ in
                guard let self, restore, !restoring else { return }; connect()
            }
        }
        if restore, scrollable {
            if !restoreNow {
                guard !restorationScheduled else { return }
                restorationScheduled = true
                DispatchQueue.main.async { [weak self] in
                    guard let self else { return }
                    restorationScheduled = false; connect(restoreNow: true)
                }
                return
            }
            let maximum = max(0,scroll.contentSize.height-scroll.bounds.height)
            guard maximum > 0 || (scrollState?.offset ?? 0) <= 0 else { return }
            restoring = true
            scroll.setContentOffset(.init(x: scroll.contentOffset.x,y: min(maximum,scrollState?.offset ?? 0)),animated: false)
            restoring = false; restore = false
        }
    }
    override var keyCommands: [UIKeyCommand]? {
        guard canBecomeFirstResponder else { return [] }
        let keys = [UIKeyCommand.inputUpArrow, UIKeyCommand.inputDownArrow, UIKeyCommand.inputHome, UIKeyCommand.inputEnd, UIKeyCommand.inputPageUp, UIKeyCommand.inputPageDown, " "]
        return keys.map { input in
            let command = UIKeyCommand(input: input, modifierFlags: [], action: #selector(handleKey(_:))); command.wantsPriorityOverSystemBehavior = true; return command
        } + [UIKeyCommand(input: " ", modifierFlags: .shift, action: #selector(handleKey(_:)))] + AWCKeyViewLoop.tabCommands(#selector(tabKey(_:)))
    }
    @objc private func tabKey(_ command: UIKeyCommand) { if let window { AWCKeyViewLoop.select(from: self, in: window, backward: command.modifierFlags.contains(.shift)) } }
    @objc private func handleKey(_ command: UIKeyCommand) {
        guard canBecomeFirstResponder else { return }
        var current = scrollView
        while let scroll = current {
            let y = scroll.contentOffset.y, maximum = max(0,scroll.contentSize.height-scroll.bounds.height), page = max(1,scroll.bounds.height*0.875)
            let target: Double
            switch command.input {
            case UIKeyCommand.inputUpArrow: target = y-40
            case UIKeyCommand.inputDownArrow: target = y+40
            case UIKeyCommand.inputHome: target = 0
            case UIKeyCommand.inputEnd: target = maximum
            case UIKeyCommand.inputPageUp: target = y-page
            case UIKeyCommand.inputPageDown: target = y+page
            case " ": target = y+(command.modifierFlags.contains(.shift) ? -page : page)
            default: return
            }
            let next = min(maximum,max(0,target))
            if abs(next-y)>0.01 { scroll.setContentOffset(.init(x:scroll.contentOffset.x,y:next),animated:false); return }
            var ancestor = scroll.superview; current = nil
            while let view = ancestor { if let outer = view as? UIScrollView { current = outer; break }; ancestor = view.superview }
        }
    }
}
struct AWCAccordionScrollBridge: UIViewRepresentable {
    let id: String, scrollable: Bool, state: AWCAccordionScrollState
    @Environment(\.awcNativeInert) private var inert
    func makeUIView(context: Context) -> AWCAccordionScrollFocusView { AWCAccordionScrollFocusView() }
    func updateUIView(_ view: AWCAccordionScrollFocusView, context: Context) {
        view.isAccessibilityElement = false; view.accessibilityIdentifier = id
        view.configure(scrollable: scrollable, inert: inert, state: state)
    }
}
#endif
