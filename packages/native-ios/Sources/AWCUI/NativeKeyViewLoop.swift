import SwiftUI

// Sequential keyboard focus (Tab / Shift+Tab) for AWC focus views on UIKit.
//
// Chrome moves focus through tabbable elements in DOM order, starting from the document when nothing is
// focused; AppKit gives AWCUI the same through the window key-view loop (`canBecomeKeyView`,
// `selectNextKeyView`). UIKit has no sequential keyboard focus on iPhone (no focus system) and on iPad the focus
// engine moves between focus groups, not between AWC focus views. AWCUI therefore keeps its own loop on UIKit:
// every AWC focus view (`AWCKeyView`) answers Tab / Shift+Tab with the next view in key-view-loop order whose
// key-view policy admits it; past either end focus leaves the components (Chrome: back to the document). Tab with
// no first responder enters the loop through a SwiftUI keyboard shortcut installed once per outermost AWC view.
// An open modal session owns Tab (its focus trap) on both platforms.

private struct AWCKeyViewEntryInstalledKey: EnvironmentKey { static let defaultValue = false }
extension EnvironmentValues {
    var awcKeyViewEntryInstalled: Bool { get { self[AWCKeyViewEntryInstalledKey.self] } set { self[AWCKeyViewEntryInstalledKey.self] = newValue } }
}
extension View {
    /// Tab from no focus enters the AWC key-view loop (UIKit only; AppKit windows provide this themselves).
    func awcKeyViewEntry() -> some View { modifier(AWCKeyViewEntryModifier()) }
}
struct AWCKeyViewEntryModifier: ViewModifier {
    @Environment(\.awcKeyViewEntryInstalled) private var installed
    @ViewBuilder func body(content: Content) -> some View {
        #if canImport(AppKit)
        content
        #else
        if installed { content } else { content.environment(\.awcKeyViewEntryInstalled, true).background { AWCKeyViewEntryShortcuts() } }
        #endif
    }
}

#if !canImport(AppKit) && canImport(UIKit)
import UIKit

/// UIKit counterpart of AppKit's key-view surface for AWC focus views.
@MainActor protocol AWCKeyView: UIView {
    /// AppKit `acceptsFirstResponder`: programmatic focus (`focus()`, pointer focus) is possible.
    var awcAcceptsFirstResponder: Bool { get }
    /// AppKit `canBecomeKeyView`: the view is a sequential (Tab) stop right now.
    var awcCanBecomeKeyView: Bool { get }
    /// Focus reached by Tab: shows the focus indicator (`:focus-visible`).
    func awcBecomeKeyView() -> Bool
}

@MainActor enum AWCKeyViewLoop {
    /// AWC focus views of `window` in Tab order.
    ///
    /// UIKit's subview order of SwiftUI-hosted views does not follow the source order, so the order is the one AWCUI's
    /// AppKit branch gets from the window key-view loop: rows from top to bottom, and within a row from the leading to
    /// the trailing edge (right to left under a right-to-left layout). Views whose vertical extents overlap by at least
    /// half of the smaller height share a row. The AWC focus views of a document-order root (NativeDocumentOrder.swift) then
    /// take their positions in document (source) order.
    static func views(in window: UIWindow) -> [any AWCKeyView] {
        var found: [(view: any AWCKeyView, frame: CGRect)] = []
        func walk(_ view: UIView) {
            guard !view.isHidden, view.alpha > 0 else { return }
            if let key = view as? any AWCKeyView { found.append((key, key.convert(key.bounds, to: window))) }
            for child in view.subviews { walk(child) }
        }
        walk(window)
        var rows: [(top: CGFloat, bottom: CGFloat, items: [(view: any AWCKeyView, frame: CGRect)])] = []
        for item in found.sorted(by: { $0.frame.midY < $1.frame.midY }) {
            if let last = rows.indices.last {
                let overlap = min(rows[last].bottom, item.frame.maxY) - max(rows[last].top, item.frame.minY)
                let smaller = min(rows[last].bottom - rows[last].top, item.frame.height)
                if smaller > 0 && overlap >= smaller / 2 {
                    rows[last].items.append(item); rows[last].top = min(rows[last].top, item.frame.minY); rows[last].bottom = max(rows[last].bottom, item.frame.maxY); continue
                }
            }
            rows.append((item.frame.minY, item.frame.maxY, [item]))
        }
        let geometric = rows.flatMap { row -> [any AWCKeyView] in
            let rtl = row.items.first?.view.effectiveUserInterfaceLayoutDirection == .rightToLeft
            return row.items.sorted { rtl ? $0.frame.maxX > $1.frame.maxX : $0.frame.minX < $1.frame.minX }.map { $0.view }
        }
        // Composites laid out in columns (AWCKeyViewGroup, md-transfer-list: text inputs carry no document token) keep their source order.
        return AWCKeyViewGroup.reorderAll(AWCDocumentTabOrder.fill(geometric, token: { ($0 as? AWCNativeButtonFocusView)?.documentToken }, frame: { $0.convert($0.bounds, to: window) })) { $0 as UIView }
    }
    /// AppKit `selectNextKeyView` / `selectPreviousKeyView` from `current` (nil: from the document).
    @discardableResult static func select(from current: UIView?, in window: UIWindow, backward: Bool) -> Bool {
        AWCKeyViewEngineEntry.entered = nil
        if let session = AWCModalHostView.active(in: window)?.session { return session.tab(backward: backward) }
        let all = views(in: window)
        let start = current.flatMap { view in all.firstIndex { $0 === view } }
        let indices: [Int] = backward ? Array((0..<(start ?? all.count)).reversed()) : Array((start.map { $0 + 1 } ?? 0)..<all.count)
        for index in indices where all[index].awcCanBecomeKeyView {
            if all[index].awcBecomeKeyView() { return true }
        }
        // Past the last (first) tab stop Chrome leaves the page content: no AWC view keeps focus. iPad: the document stand-in
        // takes first responder at once (`AWCKeyViewEngineEntry`), so the next Tab reaches AWCUI before the focus engine.
        if let current, current.isFirstResponder, !AWCKeyViewEngineEntry.claim(in: window) { _ = current.resignFirstResponder() }
        return false
    }
    /// Tab with no AWC first responder (the shortcut path): enter the loop from the start (end for Shift+Tab).
    static func enter(near anchor: UIView?, backward: Bool) {
        guard let window = anchor?.window else { return }
        let responder = AWCFirstResponderProbe.current().flatMap { AWCKeyViewEngineEntry.isDocumentResponder($0) ? nil : $0 }
        // A host control (e.g. a text field) owns Tab; SwiftUI's hosting view, which takes first responder for keyboard
        // routing once an AWC view resigns, stands for the document like no first responder at all.
        if let responder, !(responder is any AWCKeyView), !(responder is AWCModalHostView) {
            guard let container = responder as? UIView, let anchor, anchor.isDescendant(of: container) else { return }
        }
        select(from: (responder as? any AWCKeyView).map { $0 as UIView }, in: window, backward: backward)
    }
    /// Key commands every AWC key view adds for Tab and Shift+Tab.
    static func tabCommands(_ action: Selector) -> [UIKeyCommand] {
        [UIKeyCommand(input: "\t", modifierFlags: [], action: action), UIKeyCommand(input: "\t", modifierFlags: .shift, action: action)]
            .map { $0.wantsPriorityOverSystemBehavior = true; return $0 }
    }
}

/// The current first responder (UIKit has no public accessor): an action sent to nil reaches it.
@MainActor enum AWCFirstResponderProbe {
    fileprivate static weak var found: UIResponder?
    static func current() -> UIResponder? {
        found = nil
        UIApplication.shared.sendAction(#selector(UIResponder.awcReportFirstResponder), to: nil, from: nil, for: nil)
        return found
    }
}
extension UIResponder {
    @objc func awcReportFirstResponder() { AWCFirstResponderProbe.found = self }
}

private final class AWCKeyViewAnchorView: UIView {
    override func point(inside point: CGPoint, with event: UIEvent?) -> Bool { false }
    // iPad: the document's stand-in first responder (`AWCKeyViewEngineEntry`).
    fileprivate var claiming = false
    override var canBecomeFirstResponder: Bool { claiming || isFirstResponder }
    override var canBecomeFocused: Bool { false }
    override func didMoveToWindow() { super.didMoveToWindow(); AWCKeyViewEngineEntry.attach(self) }
    override var keyCommands: [UIKeyCommand]? { isFirstResponder ? AWCKeyViewLoop.tabCommands(#selector(documentTab(_:))) : nil }
    @objc private func documentTab(_ command: UIKeyCommand) { AWCKeyViewLoop.enter(near: self, backward: command.modifierFlags.contains(.shift)) }
    override func resignFirstResponder() -> Bool {
        guard super.resignFirstResponder() else { return false }
        if let window { AWCKeyViewEngineEntry.reclaim(in: window) }; return true
    }
}
/// iPad (a focus system is present). With no first responder (nothing focused yet, past either end of the loop, after a
/// press on empty space), Tab / Shift+Tab reach no responder: the focus engine takes the key, before any key command or
/// SwiftUI keyboard shortcut, and focuses its own initial item (the top-leading one, or the one it focused last) whatever
/// the key's direction. Chrome enters at the first (Shift+Tab: last) tab stop from the document.
/// 1. The document stand-in: when focus leaves the loop past either end, and whenever nothing is first responder and the
///    engine focuses nothing, an entry anchor (invisible, never focused by the engine) becomes first responder; its priority Tab / Shift+Tab commands enter the loop at the first
///    (last) stop before the engine sees the key. It stands for no focus (`isDocumentResponder`): it gives way to any
///    responder and resigns when the engine focuses a non-AWC item, so host focus navigation keeps its keys.
/// 2. Fallback, when the engine still entered from nothing (before the anchor could claim): UIKit delivers the key's
///    release to the item the engine focused; an AWC key view there moves focus to the loop's first (last) stop.
/// iPhone has no focus system: the SwiftUI shortcuts enter the loop.
@MainActor enum AWCKeyViewEngineEntry {
    /// The AWC key view the focus engine focused from no focus without an AWC request (until the next focus update or Tab).
    static weak var entered: UIView?
    /// An AWC view is asking the focus system for focus (pointer focus, `focus()`, the loop's own moves).
    static var requesting = false
    private static var observing = false
    private static let anchors = NSHashTable<AWCKeyViewAnchorView>.weakObjects()
    /// The responder standing for the document (no focus) on iPad: callers that ask for the first responder treat it as none.
    static func isDocumentResponder(_ responder: UIResponder?) -> Bool { responder is AWCKeyViewAnchorView }
    fileprivate static func attach(_ anchor: AWCKeyViewAnchorView) {
        guard let window = anchor.window, UIFocusSystem.focusSystem(for: window) != nil else { return }
        anchors.add(anchor); observe(); reclaim(in: window)
    }
    /// After focus left every responder: the anchor of `window` takes first responder (next run-loop turn, so a responder
    /// that is taking over is not displaced).
    static func reclaim(in window: UIWindow) {
        DispatchQueue.main.async { [weak window] in
            guard let window, let system = UIFocusSystem.focusSystem(for: window), system.focusedItem == nil,
                  AWCFirstResponderProbe.current() == nil else { return }
            claim(in: window)
        }
    }
    /// The anchor of `window` takes first responder now (iPad); false without a focus system or an anchor.
    @discardableResult static func claim(in window: UIWindow) -> Bool {
        guard UIFocusSystem.focusSystem(for: window) != nil,
              let anchor = anchors.allObjects.first(where: { $0.window === window && !$0.isHidden }) else { return false }
        anchor.claiming = true; defer { anchor.claiming = false }
        return anchor.becomeFirstResponder()
    }
    static func observe() {
        guard !observing else { return }; observing = true
        NotificationCenter.default.addObserver(forName: UIFocusSystem.didUpdateNotification, object: nil, queue: nil) { note in
            let context = note.userInfo?[UIFocusSystem.focusUpdateContextUserInfoKey] as? UIFocusUpdateContext
            let fromNothing = context?.previouslyFocusedItem == nil, nextItem = context?.nextFocusedItem
            let next = nextItem as? UIView, window = (context?.previouslyFocusedItem as? UIView)?.window ?? next?.window
            MainActor.assumeIsolated {
                entered = fromNothing && !requesting && next is any AWCKeyView ? next : nil
                if nextItem == nil, let window { reclaim(in: window) }
                else if nextItem != nil, !(next is any AWCKeyView), let anchor = AWCFirstResponderProbe.current() as? AWCKeyViewAnchorView { _ = anchor.resignFirstResponder() }
            }
        }
    }
    /// An AWC key view's `pressesEnded`: true when this is the release of the Tab / Shift+Tab that made the engine focus it.
    static func released(_ presses: Set<UIPress>, at view: UIView) -> Bool {
        guard let entry = entered, entry === view, view.isFirstResponder, let window = view.window,
              let key = presses.compactMap(\.key).first(where: { $0.keyCode == .keyboardTab }) else { return false }
        AWCKeyViewLoop.select(from: nil, in: window, backward: key.modifierFlags.contains(.shift))
        return true
    }
}
private final class AWCKeyViewAnchorBox { weak var view: UIView? }
private struct AWCKeyViewAnchor: UIViewRepresentable {
    let box: AWCKeyViewAnchorBox
    func makeUIView(context: Context) -> AWCKeyViewAnchorView { let view = AWCKeyViewAnchorView(); view.isAccessibilityElement = false; box.view = view; return view }
    func updateUIView(_ view: AWCKeyViewAnchorView, context: Context) { box.view = view }
}
/// Hidden shortcuts: SwiftUI consults keyboard shortcuts when no first responder handles the key.
private struct AWCKeyViewEntryShortcuts: View {
    @State private var anchor = AWCKeyViewAnchorBox()
    var body: some View {
        ZStack {
            Button("") { AWCKeyViewLoop.enter(near: anchor.view, backward: false) }.keyboardShortcut(.tab, modifiers: [])
            Button("") { AWCKeyViewLoop.enter(near: anchor.view, backward: true) }.keyboardShortcut(.tab, modifiers: .shift)
            AWCKeyViewAnchor(box: anchor)
        }
        .frame(width: 0, height: 0).opacity(0).allowsHitTesting(false).accessibilityHidden(true)
    }
}
#endif
