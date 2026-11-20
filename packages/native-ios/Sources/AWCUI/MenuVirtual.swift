import SwiftUI
#if canImport(AppKit)
import AppKit
#endif

/// md-menu `setVirtualProvider()`: the menu's virtual data model (the source's `VirtualMenuProvider`). With a provider the
/// menu's keyboard navigation runs against the provider's (filtered) indices instead of its rendered rows: ArrowUp / ArrowDown
/// wrap past disabled rows, Home / End, typeahead through `findPrefix`, and Enter activates the active option in combobox mode.
/// Only the windowed rows exist as md-menu-item nodes: `ensureVisible(_:)` brings an index into the app's window before the
/// menu focuses its row (or, with a combobox, marks it active). The surface is a listbox while a provider is set.
/// The menu calls it on the main thread.
public protocol AWCMenuVirtualProvider: AnyObject {
    /// Number of rows in the current (filtered) list.
    func count() -> Int
    /// Label of the row at `index` (typeahead, accessibility).
    func label(at index: Int) -> String
    /// Whether the row at `index` is disabled (skipped by the arrow keys).
    func isDisabled(at index: Int) -> Bool
    /// Scroll `index` into the rendered window; return once the window shows it (isolate it to the main actor when it updates views).
    func ensureVisible(_ index: Int) async
    /// The node ID of the rendered md-menu-item for `index` while it is windowed, else nil (the source's `domItemForIndex`).
    func rowID(at index: Int) -> String?
    /// Typeahead: the first index at or after `from` whose label starts with `buffer` (wrapping), or -1.
    func findPrefix(_ buffer: String, from: Int) -> Int
}

public extension AWCMenuHandle {
    /// `setVirtualProvider(provider)`: navigation, typeahead and roving focus run against the provider; nil restores the rows.
    func setVirtualProvider(_ provider: AWCMenuVirtualProvider?) {
        guard let c else { return }
        c.provider = provider; c.listboxMode = provider != nil; c.virtualIndex = -1
        if provider == nil { c.virtualRing = nil; c.activeDescendant = nil }
    }
    /// `setComboboxElement(id)`: the element (its native ID, e.g. the search field in the menu's header) keeps focus while the
    /// provider's rows are navigated; the active option is published as `activeDescendant` (the source's
    /// aria-activedescendant) and shows the focus ring without taking focus. nil returns to roving focus on the rows.
    func setComboboxElement(_ id: String?) {
        guard let c else { return }
        if c.comboboxID != id { c.activeDescendant = nil; c.virtualRing = nil }
        c.comboboxID = id
    }
    /// The combobox's active option: the node ID of the active windowed row (nil while closed or without a combobox).
    var activeDescendant: String? { c?.activeDescendant }
    /// The active (filtered) index of the virtual list, or -1.
    var virtualIndex: Int { c?.virtualIndex ?? -1 }
    /// The surface's role: listbox (the `listbox` property or a registered provider), else menu.
    var isListbox: Bool { (c?.model.listbox ?? false) || (c?.listboxMode ?? false) }
    /// The menu's keydown handling for a key typed in a combobox that holds focus (the source's keydown bubbles from the
    /// header input to md-menu): "ArrowDown", "ArrowUp", "Home", "End", "Enter", "Escape", "Tab" or one character.
    /// Returns true when the menu handled it. The header slot routes its focused descendants' keys here itself.
    @discardableResult func handleKey(_ key: String, shift: Bool = false, modified: Bool = false) -> Bool {
        guard let c, c.isOpen else { return false }
        return c.comboboxKey(key, shift: shift, modified: modified)
    }
}

/// The header's key routing exists only while a provider is registered (listboxMode): menus without one keep their header untouched.
struct AWCMenuVirtualKeysIf: ViewModifier {
    let controller: AWCMenuController
    @ViewBuilder func body(content: Content) -> some View {
        if controller.listboxMode { content.modifier(AWCMenuVirtualKeys(controller: controller)) } else { content }
    }
}
/// Keys pressed in the header slot (the combobox's search field) reach the menu's virtual navigation, as the source's keydown
/// bubbles from the header input to md-menu. Without a provider the header keeps its own keys. SwiftUI focus (onKeyPress) and,
/// on macOS, an AppKit text field in the header (its field editor consumes arrow keys before SwiftUI sees them: a local key
/// monitor routes the keys typed in a field inside the header).
struct AWCMenuVirtualKeys: ViewModifier {
    let controller: AWCMenuController
    #if canImport(AppKit)
    @State private var monitor: Any?
    #endif
    static func name(_ key: KeyEquivalent) -> String? {
        switch key {
        case .downArrow: return "ArrowDown"
        case .upArrow: return "ArrowUp"
        case .home: return "Home"
        case .end: return "End"
        case .return: return "Enter"
        default: return nil
        }
    }
    func body(content: Content) -> some View {
        content
            .onGeometryChange(for: CGRect.self) { $0.frame(in: .global) } action: { controller.headerFrame = $0 }
            .onKeyPress(phases: .down) { press in
                guard controller.provider != nil, controller.isOpen, let key = Self.name(press.key) else { return .ignored }
                return controller.comboboxKey(key, shift: press.modifiers.contains(.shift), modified: false, fromInput: true) ? .handled : .ignored
            }
            #if canImport(AppKit)
            .onAppear {
                guard monitor == nil else { return }
                let c = controller
                monitor = NSEvent.addLocalMonitorForEvents(matching: .keyDown) { e in
                    guard c.provider != nil, c.isOpen, let w = e.window, let editor = w.firstResponder as? NSTextView, editor.isFieldEditor,
                          let field = editor.delegate as? NSView, let root = w.contentView else { return e }
                    let r = field.convert(field.bounds, to: nil)
                    let inHeader = CGRect(x: r.minX, y: root.bounds.height - r.maxY, width: r.width, height: r.height).intersects(c.headerFrame)
                    // While a combobox is registered it holds focus (the source's comboboxEl): a focused text field is it.
                    let named = c.comboboxID != nil
                    AWCMenuDebug.log("virtual key \(e.keyCode) inHeader \(inHeader) combobox \(String(describing: c.comboboxID)) header \(c.headerFrame)")
                    guard inHeader || named else { return e }
                    let key: String
                    switch e.keyCode {
                    case 125: key = "ArrowDown"
                    case 126: key = "ArrowUp"
                    case 115: key = "Home"
                    case 119: key = "End"
                    case 36, 76: key = "Enter"
                    default: return e
                    }
                    return c.comboboxKey(key, shift: e.modifierFlags.contains(.shift), modified: false, fromInput: true) ? nil : e
                }
            }
            .onDisappear { if let monitor { NSEvent.removeMonitor(monitor) }; monitor = nil }
            #endif
    }
}

#if canImport(UIKit)
import UIKit

/// iOS: a hardware key typed in a UIKit text field of a menu's header (declared with `.awcMenuHeader`) reaches SwiftUI's key
/// handling at the scope, not at the surface's header slot (the menus render through the scope's preference overlay). The scope
/// routes it to an open menu with a virtual provider when the focused text input lies in that menu's header, or while a
/// combobox is registered — the source's keydown bubbling from the header input to md-menu. Other keys and menus pass through.
struct AWCMenuScopeVirtualKeys: ViewModifier {
    let registry: AWCMenuRegistry
    func body(content: Content) -> some View {
        content.onKeyPress(phases: .down) { press in
            guard let key = AWCMenuVirtualKeys.name(press.key) else { return .ignored }
            let open = registry.controllers.values.filter { $0.provider != nil && $0.listboxMode && $0.isOpen }
            guard !open.isEmpty else { return .ignored }
            let field = AWCFirstResponder.textInputFrame()
            for c in open where c.comboboxID != nil || (field.map { $0.intersects(c.headerFrame) } ?? false) {
                AWCMenuDebug.log("scope virtual key \(key) header \(c.headerFrame) field \(String(describing: field))")
                return c.comboboxKey(key, shift: press.modifiers.contains(.shift), modified: false, fromInput: true) ? .handled : .ignored
            }
            return .ignored
        }
    }
}
/// The app's first responder (UIKit has no window property for it): the responder chain answers a nil-targeted action.
@MainActor enum AWCFirstResponder {
    fileprivate static weak var found: UIResponder?
    static func current() -> UIResponder? {
        found = nil
        UIApplication.shared.sendAction(#selector(UIResponder.awcReportFirstResponder(_:)), to: nil, from: nil, for: nil)
        return found
    }
    /// The focused text input's frame in its window (SwiftUI's global space in a window-filling host), else nil.
    static func textInputFrame() -> CGRect? {
        guard let view = current() as? UIView, view is UITextInput, view.window != nil else { return nil }
        return view.convert(view.bounds, to: nil)
    }
}
extension UIResponder {
    @objc fileprivate func awcReportFirstResponder(_ sender: Any?) { AWCFirstResponder.found = self }
}
#endif
