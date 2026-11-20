// md-menu setVirtualProvider() / setComboboxElement() natively (gate-7 r4 R4-13): a 10,000-row virtual list of which only an
// 8-row window is rendered as md-menu-item nodes, a search field in the menu's header as the combobox. Observable effects
// checked against the source (md-menu.tsx handleKeyDownVirtual / focusVirtual / handleTypeaheadVirtual, md-menu.virtual.spec.ts):
// listbox role, active option (aria-activedescendant) without moving focus, wrapping past disabled rows, Home/End across the
// window (ensureVisible before the row is marked), typeahead via findPrefix, Enter activating the active option, the header
// field's own arrow keys routed to the menu, roving focus on the rows without a combobox, and nil restoring the menu.
import AppKit
import SwiftUI
@testable import AWCUI

final class VirtualFruit: AWCMenuVirtualProvider, ObservableObject {
    static let names = ["Apple", "Banana", "Cherry", "Date", "Elder", "Fig", "Grape"]
    @Published var start = 0
    var ensured: [Int] = []
    let size = 10_000, window = 8
    func count() -> Int { size }
    func label(at i: Int) -> String { "\(Self.names[i % 7]) \(i)" }
    func isDisabled(at i: Int) -> Bool { i % 7 == 5 }   // every "Fig" row
    @MainActor func ensureVisible(_ i: Int) async {
        ensured.append(i)
        if i < start || i >= start + window { start = max(0, min(size - window, i - 3)); try? await Task.sleep(nanoseconds: 60_000_000) }
    }
    func rowID(at i: Int) -> String? { i >= start && i < start + window ? "row-\(i)" : nil }
    func findPrefix(_ buffer: String, from: Int) -> Int {
        for k in 0..<size { let i = (from + k) % size; if label(at: i).lowercased().hasPrefix(buffer) { return i } }
        return -1
    }
}
final class VirtualKeyWindow: NSWindow { override var canBecomeKey: Bool { true } }
struct VirtualMenuHost: View {
    @ObservedObject var provider: VirtualFruit
    let menus: AWCMenuScopeState
    @Binding var query: String
    let onEvent: (AWCEvent) -> Void
    var body: some View {
        let rows = (provider.start..<provider.start + provider.window).map { i in
            AWCNode(id: "row-\(i)", tag: "md-menu-item", properties: ["headline": .string(provider.label(at: i)), "disabled": .bool(provider.isDisabled(at: i))]) }
        AWCMenuScope(state: menus) {
            VStack(alignment: .leading, spacing: 8) {
                AWCNativeView(node: AWCNode(id: "trigger", tag: "md-button", properties: ["variant": "tonal"], children: [.text("Fruit")]))
                AWCNativeView(node: AWCNode(id: "vm", tag: "md-menu", properties: ["anchor": "trigger", "listLabel": "Fruit", "quick": true], children: rows), onEvent: onEvent)
            }.padding(24).frame(width: 480, height: 600, alignment: .topLeading)
        }
        .awcMenuHeader(for: "vm") { TextField("Search", text: $query).textFieldStyle(.plain).padding(8).accessibilityIdentifier("search") }
    }
}
@main @MainActor struct NativeMenuVirtualIntegration {
    static var checks = 0, failures: [String] = []
    static func check(_ ok: Bool, _ what: String) { checks += 1; if !ok { failures.append(what); print("FAIL: \(what)") } }
    static func pump(_ s: Double) { RunLoop.main.run(until: Date().addingTimeInterval(s)) }
    static func main() {
        _ = NSApplication.shared; NSApp.setActivationPolicy(.accessory)
        let provider = VirtualFruit(), menus = AWCMenuScopeState()
        var query = "", events: [AWCEvent] = []
        let host = NSHostingView(rootView: VirtualMenuHost(provider: provider, menus: menus, query: Binding(get: { query }, set: { query = $0 }), onEvent: { events.append($0) }))
        let window = VirtualKeyWindow(contentRect: .init(x: -20000, y: -20000, width: 480, height: 600), styleMask: [.borderless], backing: .buffered, defer: false)
        window.isReleasedWhenClosed = false; window.contentView = host; window.makeKeyAndOrderFront(nil); pump(0.4)
        let m = menus.menu("vm")
        func wait(_ ok: () -> Bool, _ s: Double = 1.5) { let end = Date().addingTimeInterval(s); while !ok() && Date() < end { pump(0.02) } }
        func searchFocused() -> Bool {
            #if canImport(UIKit)
            return window.firstResponder is UITextField || window.firstResponder is UITextView
            #else
            return (window.firstResponder as? NSTextView)?.isFieldEditor == true
            #endif
        }
        func focusSearch() {
            func all(_ v: NSView) -> [NSView] { [v] + v.subviews.flatMap(all) }
            #if canImport(UIKit)
            let field = all(host).first { $0 is UITextField }
            #else
            let field = all(host).first { ($0 as? NSTextField)?.isEditable == true }
            #endif
            if let f = field { window.makeFirstResponder(f) }
            pump(0.1)
        }
        func press(_ code: UInt16, _ chars: String) {
            for type in [NSEvent.EventType.keyDown, .keyUp] {
                let flags: NSEvent.ModifierFlags = [.function, .numericPad]
                if let e = NSEvent.keyEvent(with: type, location: .zero, modifierFlags: [53, 36].contains(code) ? [] : flags, timestamp: ProcessInfo.processInfo.systemUptime,
                                            windowNumber: window.windowNumber, context: nil, characters: chars, charactersIgnoringModifiers: chars, isARepeat: false, keyCode: code) {
                    NSApp.postEvent(e, atStart: false)
                }
            }
            while let e = NSApp.nextEvent(matching: .any, until: Date().addingTimeInterval(0.05), inMode: .default, dequeue: true) { NSApp.sendEvent(e) }
            pump(0.05)
        }
        // 1. Provider + combobox, opened like the filterable select (focus stays in the search field).
        m.setVirtualProvider(provider); m.setComboboxElement("search")
        check(m.isListbox, "a registered provider makes the surface a listbox")
        m.show(autoFocus: true); pump(0.3); focusSearch()
        wait { m.activeDescendant == "row-0" }
        check(m.activeDescendant == "row-0" && m.virtualIndex == 0, "show(): the first enabled index is active (\(String(describing: m.activeDescendant)), \(m.virtualIndex))")
        // 2. ArrowDown past the disabled "Fig 5": 0 → 1 → 2 → 3 → 4 → 6.
        for _ in 0..<5 { m.handleKey("ArrowDown") }
        wait { m.activeDescendant == "row-6" }
        check(m.virtualIndex == 6 && m.activeDescendant == "row-6", "ArrowDown wraps past disabled rows (index \(m.virtualIndex), active \(String(describing: m.activeDescendant)))")
        check(searchFocused(), "the combobox keeps focus while options become active")
        // 3. End / Home across the rendered window (ensureVisible first).
        m.handleKey("End"); wait { m.activeDescendant == "row-9999" }
        check(m.virtualIndex == 9999 && m.activeDescendant == "row-9999" && provider.start == 9992, "End: the last index is windowed and active (start \(provider.start), active \(String(describing: m.activeDescendant)))")
        check(provider.ensured.contains(9999), "End awaits ensureVisible(9999)")
        m.handleKey("ArrowDown"); wait { m.activeDescendant == "row-0" }
        check(m.virtualIndex == 0, "ArrowDown from the last index wraps to the first (\(m.virtualIndex))")
        m.handleKey("ArrowUp"); wait { m.activeDescendant == "row-9999" }
        check(m.virtualIndex == 9999, "ArrowUp from the first index wraps to the last (\(m.virtualIndex))")
        m.handleKey("Home"); wait { m.activeDescendant == "row-0" }
        check(m.virtualIndex == 0 && provider.start == 0, "Home: back to the first index and window (\(m.virtualIndex), start \(provider.start))")
        // 4. Typeahead (outside the input): "c" → next Cherry from index 1; "ch" keeps it; "e" → Elder 4.
        m.handleKey("c"); wait { m.activeDescendant == "row-2" }
        check(m.virtualIndex == 2 && m.activeDescendant == "row-2", "typeahead 'c' finds Cherry 2 (\(m.virtualIndex))")
        m.handleKey("h"); pump(0.1); check(m.virtualIndex == 2, "typeahead 'ch' stays on Cherry 2 (\(m.virtualIndex))")
        pump(0.6); m.handleKey("e"); wait { m.activeDescendant == "row-4" }
        check(m.virtualIndex == 4, "after the 500 ms buffer timeout, 'e' finds Elder 4 (\(m.virtualIndex))")
        // 5. The header field's own arrow keys reach the menu (keydown bubbling from the header input).
        focusSearch(); press(125, String(UnicodeScalar(NSDownArrowFunctionKey)!)); wait { m.activeDescendant == "row-6" }
        check(m.virtualIndex == 6 && m.activeDescendant == "row-6", "ArrowDown typed in the header field moves the active option (\(m.virtualIndex))")
        press(4, "h"); pump(0.1)
        check(m.virtualIndex == 6 && query == "h", "characters typed in the header field stay in the field (query '\(query)', index \(m.virtualIndex))")
        // 6. Enter activates the active option (mdClick from its row) and the menu closes.
        events.removeAll(); m.handleKey("Enter"); wait({ !m.isOpen }, 1.0)
        check(events.contains { $0.name == "mdClick" && $0.nodeID == "row-6" }, "Enter clicks the active option (\(events.map { "\($0.name)@\($0.nodeID)" }))")
        check(!m.isOpen && m.activeDescendant == nil, "activation closes the menu and clears the active option")
        // 7. Without a combobox the windowed row takes real focus (roving focus).
        m.setComboboxElement(nil); m.show(autoFocus: true); pump(0.4)
        m.handleKey("ArrowDown"); pump(0.3)
        let rowFocused = !(searchFocused()) && window.firstResponder !== window
        check(m.activeDescendant == nil && rowFocused, "without a combobox the active row takes focus (active \(String(describing: m.activeDescendant)), responder \(String(describing: window.firstResponder)))")
        m.close(); pump(0.3)
        // 8. nil restores the menu's own rows.
        m.setVirtualProvider(nil)
        check(!m.isListbox, "setVirtualProvider(nil): the surface is a menu again")
        // 9. Hook tests (S7-6-03): --md-menu-viewport-margin and --md-menu-section-gap with non-default values.
        do {
            let vp = CGSize(width: 400, height: 700), model = AWCMenuModel(["responsive": .bool(true)]), anchor = CGRect(x: 20, y: 100, width: 80, height: 40)
            let base = AWCMenuAppearance(), wide = AWCMenuAppearance(viewportMargin: "24px")
            let a = AWCMenuSurfacePlacement.resolve(anchor: anchor, surfaceWidth: 200, chrome: 8, content: 100, viewport: vp, model: model, appearance: base, minWidth: 112)
            let b = AWCMenuSurfacePlacement.resolve(anchor: anchor, surfaceWidth: 200, chrome: 8, content: 100, viewport: vp, model: model, appearance: wide, minWidth: 112)
            check(a.responsive && a.width == 400 - 2 * 8, "--md-menu-viewport-margin default 8px: responsive sheet width \(a.width) == 384")
            check(b.responsive && b.width == 400 - 2 * 24, "--md-menu-viewport-margin 24px: responsive sheet width \(b.width) == 352")
            let capA = AWCMenuSurfacePlacement.defaultCap(model: AWCMenuModel([:]), appearance: AWCMenuAppearance(maxBlockSize: "1000px"), viewport: vp, margin: 8)
            let capB = AWCMenuSurfacePlacement.defaultCap(model: AWCMenuModel([:]), appearance: AWCMenuAppearance(maxBlockSize: "1000px", viewportMargin: "50px"), viewport: vp, margin: 50)
            check(capA == 700 - 16 && capB == 700 - 100, "--md-menu-viewport-margin caps max-block-size at 100dvh - 2 x margin (\(capA), \(capB))")
            check(AWCMenuSurfacePlacement.sectionGap(appearance: base, viewport: vp) == 2, "--md-menu-section-gap default 2px")
            check(AWCMenuSurfacePlacement.sectionGap(appearance: AWCMenuAppearance(sectionGap: "10px"), viewport: vp) == 10, "--md-menu-section-gap 10px")
            check(AWCMenuSurfacePlacement.sectionGap(appearance: AWCMenuAppearance(css: ["--md-menu-section-gap": "5vh"]), viewport: vp) == 35, "--md-menu-section-gap 5vh resolves against the viewport (35)")
        }
        print("Menu virtual: \(checks - failures.count)/\(checks) checks passed")
        window.close(); if !failures.isEmpty { exit(1) }
    }
}
