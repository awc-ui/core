import SwiftUI
import Observation
#if canImport(AppKit)
import AppKit
#elseif canImport(UIKit)
import UIKit
#endif

/// Tab from a menu row: focus is put back on the anchor, then sequential navigation continues from there (the source
/// does not prevent the Tab key). Reading order of the window's focusable AWC views; leaving the first/last one resigns.
enum AWCMenuFocusTraversal {
    static func advance(backward: Bool) {
        #if canImport(AppKit)
        guard let w = NSApp.windows.first(where: { $0.firstResponder is AWCNativeButtonFocusView }), let current = w.firstResponder as? NSView, let root = w.contentView else { return }
        func all(_ v: NSView) -> [NSView] { [v] + v.subviews.flatMap(all) }
        func frame(_ v: NSView) -> CGRect { v.convert(v.bounds, to: nil) }
        let order = all(root).compactMap { $0 as? AWCNativeButtonFocusView }.filter { $0 === current || ($0.canBecomeKeyView && !$0.isHiddenOrHasHiddenAncestor) }
            .sorted { a, b in let fa = frame(a), fb = frame(b); return abs(fa.maxY - fb.maxY) > 1 ? fa.maxY > fb.maxY : fa.minX < fb.minX }
        guard let i = order.firstIndex(where: { $0 === current }) else { return }
        let j = backward ? i - 1 : i + 1
        if order.indices.contains(j) { w.makeFirstResponder(order[j]) } else { w.makeFirstResponder(nil) }
        #elseif canImport(UIKit)
        // UIKit: the AWC key-view loop (reading order) from the current first responder (the anchor the tree closed to).
        // Key handling runs on the main thread; the UIKit responder APIs are main-actor isolated.
        MainActor.assumeIsolated {
            guard let current = AWCFirstResponderProbe.current() as? UIView, let window = current.window else { return }
            AWCKeyViewLoop.select(from: current, in: window, backward: backward)
        }
        #endif
    }
}

/// One md-menu instance: open / closing state, its rows (roving focus, typeahead, radio scopes), its flyouts,
/// and the source's close-the-tree rules. Nested flyout menus link to the menu of their submenu row.
@Observable final class AWCMenuController {
    let nodeID: String
    var model: AWCMenuModel = .init([:])
    var isOpen = false
    var closing = false
    /// Row that currently shows the focus ring (`data-md-focused`) and the roving index.
    var ringed: String?
    var focusedID: String?
    /// The submenu row whose flyout is open (one per menu).
    var openSubmenu: String?
    var scrollTop = 0.0
    /// The surface is still painted while its exit transition runs (after `open` turned false).
    var lingering = false
    /// Checkbox / radio state of this menu's rows; it outlives the row views of a closed surface.
    var selection: [String: Bool] = [:]
    @ObservationIgnored weak var parent: AWCMenuController?
    @ObservationIgnored weak var registry: AWCMenuRegistry?
    @ObservationIgnored var parentRowID: String?
    @ObservationIgnored var rowOrder: [String] = []
    @ObservationIgnored var rows: [String: Row] = [:]
    @ObservationIgnored var children: [String: AWCMenuController] = [:]
    @ObservationIgnored var setOpen: (Bool) -> Void = { _ in }
    @ObservationIgnored var emit: (String) -> Void = { _ in }
    /// Time (ms, CACurrentMediaTime) of the last open / close request: the surface transition starts two frames later.
    @ObservationIgnored var closingAt = 0.0
    @ObservationIgnored var focusAnchorAction: (() -> Bool)?
    @ObservationIgnored var openedViaKeyboard = false
    @ObservationIgnored var keyboardModality = false
    @ObservationIgnored private var typeahead = AWCMenuTypeahead()
    @ObservationIgnored private var closeToken = 0
    @ObservationIgnored var surfaceFrame: CGRect = .zero
    @ObservationIgnored var viewportFrame: CGRect = .zero
    @ObservationIgnored var rowFrames: [String: CGRect] = [:]
    @ObservationIgnored var openedAt = 0.0
    /// Pointer over this (flyout) surface: the submenu row's close intent waits while it is inside.
    @ObservationIgnored var pointerInside = false
    /// The scroll viewport's natural content height and visible height (getScrollViewport()).
    @ObservationIgnored var contentHeight = 0.0
    @ObservationIgnored var viewportHeight = 0.0
    /// `reposition()`: bumping it re-runs placement (the surface also re-places on every geometry change).
    var repositions = 0
    @ObservationIgnored private var closeWaiters: [CheckedContinuation<Void, Never>] = []
    /// `whenClosed()`: resolves at once while closed, else when `open` turns false.
    func whenClosed() async {
        guard isOpen else { return }
        await withCheckedContinuation { closeWaiters.append($0) }
    }
    struct Row {
        let handle: AWCButtonFocusHandle
        var label: String, disabled: Bool, sub: Bool, radioScope: String?
        var deselect: () -> Void = {}
        var openSubmenu: (Bool) -> Void = { _ in }
        var collapse: () -> Void = {}
        var hoverLeave: () -> Void = {}
        /// `closeSubmenu()`: the flyout plays its exit, the row keeps its open state for 100 ms.
        var closeSubmenu: () -> Void = {}
    }
    init(nodeID: String) { self.nodeID = nodeID }
    var justOpened: Bool { CACurrentMediaTime() * 1000 - openedAt < 40 }

    var root: AWCMenuController { parent?.root ?? self }
    func isAncestor(of other: AWCMenuController) -> Bool { var p = other.parent; while let q = p { if q === self { return true }; p = q.parent }; return false }
    func treeContains(_ p: CGPoint, surfaces: [String: CGRect]) -> Bool {
        if isOpen, surfaces[nodeID]?.contains(p) == true { return true }
        return children.values.contains { $0.treeContains(p, surfaces: surfaces) }
    }

    // MARK: open / close (md-menu show() / close())
    func show(autoFocus: Bool? = nil, keyboard: Bool = false) {
        closeToken &+= 1; closing = false
        openedViaKeyboard = keyboard || keyboardModality
        let wasOpen = isOpen
        if !isOpen { openedAt = CACurrentMediaTime() * 1000 }
        isOpen = true
        if !wasOpen { setOpen(true); emit("mdOpen") }
        registry?.dismissPeers(of: self)
        // data-md-focused follows the keyboard; script focus is still :focus-visible unless a pointer press came last.
        if autoFocus ?? model.autoFocus { focusFirst(ring: openedViaKeyboard || !(registry?.pointerModality ?? false)) } else { focusedID = rowOrder.first; ringed = nil }
    }
    /// Non-quick menus play the 150 ms exit before `open` turns false (mdClose fires then).
    func close() {
        guard isOpen, !closing else { return }
        collapseSubmenus()
        if model.quick { lingering = false; finishClose(); return }
        closing = true; closingAt = CACurrentMediaTime() * 1000; closeToken &+= 1; let token = closeToken
        lingering = true
        Task { @MainActor in try? await Task.sleep(nanoseconds: 205_000_000); if self.closeToken == token { self.lingering = false } }
        Task { @MainActor in try? await Task.sleep(nanoseconds: 150_000_000); if self.closeToken == token && self.closing { self.finishClose() } }
    }
    /// `open = false` without the exit (md-sub-menu-item `collapse()`).
    func closeNow() { guard isOpen else { return }; collapseSubmenus(); closeToken &+= 1; lingering = false; finishClose() }
    private func finishClose() {
        closing = false; isOpen = false; ringed = nil; focusedID = nil; setOpen(false); emit("mdClose")
        let waiters = closeWaiters; closeWaiters = []; waiters.forEach { $0.resume() }
    }
    /// `closeEntireMenuTree()` (Tab) closes the root and focuses its anchor.
    func closeTree() { let r = root; r.close(); _ = r.focusAnchor() }
    /// Row activation without `keep-open`: the root anchor takes focus now, the root closes after 150 ms.
    func activated() {
        let r = root; _ = r.focusAnchor()
        Task { @MainActor in try? await Task.sleep(nanoseconds: 150_000_000); r.close() }
    }
    @discardableResult func focusAnchor() -> Bool {
        if let parent, let row = parentRowID { return parent.focus(row, ring: true) }
        return focusAnchorAction?() ?? false
    }
    func collapseSubmenus() { for id in rowOrder { rows[id]?.collapse() }; openSubmenu = nil }

    // MARK: rows
    func register(_ id: String, _ row: Row) { rows[id] = row }
    func unregister(_ id: String) { rows[id] = nil; if ringed == id { ringed = nil } }
    func select(radio id: String) {
        guard let scope = rows[id]?.radioScope else { return }
        for (other, row) in rows where other != id && row.radioScope == scope { row.deselect() }
    }
    @discardableResult func focus(_ id: String, ring: Bool) -> Bool {
        guard let row = rows[id] else { return false }
        focusedID = id; ringed = ring ? id : nil
        row.handle.showFocus = ring
        let ok = (ring ? row.handle.requestFocus?() : row.handle.requestPointerFocus?()) ?? false
        ensureVisible(id)
        return ok
    }
    /// `focus()` scrolls the capped viewport so the row is visible (nearest edge).
    func ensureVisible(_ id: String) {
        guard let r = rowFrames[id], viewportFrame.height > 0 else { return }
        if r.minY < viewportFrame.minY { scrollTop = max(0, scrollTop - Double(viewportFrame.minY - r.minY)) }
        else if r.maxY > viewportFrame.maxY { scrollTop += Double(r.maxY - viewportFrame.maxY) }
    }
    func focusFirst(ring: Bool) {
        // The surface mounts after placement (a frame or more): retry until the first row's focus view is in a window.
        Task { @MainActor in
            for _ in 0..<40 {
                guard self.isOpen, !self.closing else { return }
                if let first = self.rowOrder.first, self.rows[first] != nil, self.focus(first, ring: ring) { return }
                try? await Task.sleep(nanoseconds: 16_000_000)
            }
        }
    }
    func didFocus(_ id: String) { if rowOrder.contains(id) { focusedID = id } }
    private func move(to index: Int) {
        guard !rowOrder.isEmpty else { return }
        let i = index < 0 ? rowOrder.count - 1 : index >= rowOrder.count ? 0 : index
        _ = focus(rowOrder[i], ring: true)
    }
    /// md-menu `handleKeyDown` for a row of this menu (focus is on the row).
    func key(_ key: String, from id: String, shift: Bool, modified: Bool, rtl: Bool = false) -> Bool {
        guard isOpen else { return false }
        keyboardModality = true; registry?.pointerModality = false
        let index = rowOrder.firstIndex(of: id) ?? -1
        // Inside a flyout, Escape and the close key reach the submenu row: it closes the flyout and takes focus back.
        if let parent, let row = parentRowID, key == "Escape" || key == (rtl ? "ArrowRight" : "ArrowLeft") {
            parent.rows[row]?.closeSubmenu(); _ = parent.focus(row, ring: true); return true
        }
        switch key {
        case "Escape":
            close(); _ = focusAnchor(); return true
        case "ArrowDown": move(to: index + 1); return true
        case "ArrowUp": move(to: index - 1); return true
        case "Home": move(to: 0); return true
        case "End": move(to: rowOrder.count - 1); return true
        case "Tab": closeTree(); AWCMenuFocusTraversal.advance(backward: shift); return true
        default:
            guard key.count == 1, !modified, !shift else { return false }
            let labels = rowOrder.map { rows[$0]?.label ?? "" }
            let hit = typeahead.next(key, now: CACurrentMediaTime() * 1000, focused: index, labels: labels)
            AWCMenuDebug.log("typeahead \(key) from \(id) index \(index) buffer \(typeahead.buffer) -> \(String(describing: hit))")
            if let hit { move(to: hit) }
            return true
        }
    }
}
