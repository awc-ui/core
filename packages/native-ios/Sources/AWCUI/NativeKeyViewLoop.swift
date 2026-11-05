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
    /// half of the smaller height share a row.
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
        return rows.flatMap { row -> [any AWCKeyView] in
            let rtl = row.items.first?.view.effectiveUserInterfaceLayoutDirection == .rightToLeft
            return row.items.sorted { rtl ? $0.frame.maxX > $1.frame.maxX : $0.frame.minX < $1.frame.minX }.map { $0.view }
        }
    }
    /// AppKit `selectNextKeyView` / `selectPreviousKeyView` from `current` (nil: from the document).
    @discardableResult static func select(from current: UIView?, in window: UIWindow, backward: Bool) -> Bool {
        if let session = AWCModalHostView.active(in: window)?.session { return session.tab(backward: backward) }
        let all = views(in: window)
        let start = current.flatMap { view in all.firstIndex { $0 === view } }
        let indices: [Int] = backward ? Array((0..<(start ?? all.count)).reversed()) : Array((start.map { $0 + 1 } ?? 0)..<all.count)
        for index in indices where all[index].awcCanBecomeKeyView {
            if all[index].awcBecomeKeyView() { return true }
        }
        // Past the last (first) tab stop Chrome leaves the page content: no AWC view keeps focus.
        if let current, current.isFirstResponder { _ = current.resignFirstResponder() }
        return false
    }
    /// Tab with no AWC first responder (the shortcut path): enter the loop from the start (end for Shift+Tab).
    static func enter(near anchor: UIView?, backward: Bool) {
        guard let window = anchor?.window else { return }
        let responder = AWCFirstResponderProbe.current()
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
