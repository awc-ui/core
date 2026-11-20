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
        // closeTree() focuses the anchor first; a text-field anchor (the select family's trigger) takes focus a run-loop turn
        // later. Continue from it after that, as the source's Tab continues from the focused anchor.
        DispatchQueue.main.async { DispatchQueue.main.async { advanceNow(backward: backward) } }
    }
    static func advanceNow(backward: Bool) {
        #if canImport(AppKit)
        AWCMenuDebug.log("tab advance responders \(NSApp.windows.map { String(describing: $0.firstResponder.map { type(of: $0) }) })")
        // The anchor may be a text field (the select family's trigger): its field editor is the first responder. Continue from the
        // field as its own Tab does (FieldTextInput: document order, else AppKit's key-view loop).
        func fieldOwner(_ r: NSResponder?) -> NSView? { (r as? NSTextView).flatMap { $0.isFieldEditor ? $0.delegate as? NSView : nil } }
        if !NSApp.windows.contains(where: { $0.firstResponder is AWCNativeButtonFocusView }),
           let w = NSApp.windows.first(where: { fieldOwner($0.firstResponder) != nil }), let field = fieldOwner(w.firstResponder) {
            AWCMenuDebug.log("tab advance from field \(type(of: field))")
            // Document order first; when it has nowhere else to go (the field is the only AWC stop) AppKit's key-view loop
            // continues past the AWC views (Chrome: Tab leaves the page).
            if MainActor.assumeIsolated({ AWCDocumentTabOrder.move(from: field, backward: backward) }), fieldOwner(w.firstResponder) !== field { return }
            if backward { w.selectPreviousKeyView(nil) } else { w.selectNextKeyView(nil) }
            // No key view follows (Chrome: focus leaves the page, document.activeElement is the body): the field resigns.
            if fieldOwner(w.firstResponder) === field { w.makeFirstResponder(nil) }
            AWCMenuDebug.log("tab advance → \(String(describing: w.firstResponder.map { type(of: $0) }))")
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.12) { AWCMenuDebug.log("tab advance +120 ms → \(String(describing: w.firstResponder.map { type(of: $0) }))") }
            return
        }
        guard let w = NSApp.windows.first(where: { $0.firstResponder is AWCNativeButtonFocusView }), let current = w.firstResponder as? NSView, let root = w.contentView else { return }
        // Inside a document-order root: document order (NativeDocumentOrder.swift), as AWCKeyViewLoop gives on UIKit.
        if MainActor.assumeIsolated({ AWCDocumentTabOrder.move(from: current, backward: backward) }) { return }
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
    /// The owner's claim on keys typed on a row before typeahead (printable characters and "Backspace"): md-autocomplete keeps
    /// typing in its input (`handleListboxKeyDown`). Returns true when the owner consumed the key.
    @ObservationIgnored var rowKeyClaim: ((String) -> Bool)?
    @ObservationIgnored var openedViaKeyboard = false
    /// setVirtualProvider(): the virtual data model (nil: the rendered rows drive navigation).
    @ObservationIgnored var provider: AWCMenuVirtualProvider?
    /// The surface is a listbox while a provider is set (the source's listboxMode).
    var listboxMode = false
    /// setComboboxElement(): the element that keeps focus while the provider's rows are navigated.
    @ObservationIgnored var comboboxID: String?
    /// iOS md-select / md-multi-select: rows take the logical focus (focusedID + the row's focus handle) and the UIKit first
    /// responder stays on the trigger field, whose key router forwards the menu keys (no text-field <-> row responder hop).
    @ObservationIgnored var logicalRowFocus = false
    /// The combobox's active option (its aria-activedescendant) and the row ringed without focus (data-md-focused).
    var activeDescendant: String?
    var virtualRing: String?
    @ObservationIgnored var virtualIndex = -1
    /// The header slot's frame (global): a focused text field inside it is the combobox the source's keydown bubbles from.
    @ObservationIgnored var headerFrame: CGRect = .zero
    @ObservationIgnored private var virtualSeq = 0
    @ObservationIgnored private var virtualBuffer = ""
    @ObservationIgnored private var virtualBufferAt = 0.0
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
        /// The row's click (Enter on the combobox's active option).
        var activate: () -> Void = {}
        /// The row's keyboard activation (Enter / Space), as its focus view would run it.
        var keyActivate: (String) -> Void = { _ in }
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
    func close(requestedAt: Double? = nil) {
        guard isOpen, !closing else { return }
        if logicalRowFocus { for r in rows.values where r.handle.isFocused { r.handle.isFocused = false } }
        collapseSubmenus()
        if model.quick { lingering = false; finishClose(); return }
        closing = true; closingAt = AWCInputDelivery.time(requestedAt); closeToken &+= 1; let token = closeToken
        lingering = true
        // The exit runs from the close request (closingAt), not from when the main actor first runs these tasks: work that
        // follows a close in the same turn (an md-autocomplete pick re-renders the field and the rows) would lengthen it.
        let from = closingAt
        func left(_ ms: Double) -> UInt64 { UInt64(max(0, ms - (CACurrentMediaTime() * 1000 - from)) * 1_000_000) }
        Task { @MainActor in try? await Task.sleep(nanoseconds: left(205)); if self.closeToken == token { self.lingering = false } }
        Task { @MainActor in try? await Task.sleep(nanoseconds: left(150)); if self.closeToken == token && self.closing { self.finishClose() } }
    }
    /// `open = false` without the exit (md-sub-menu-item `collapse()`).
    func closeNow() { guard isOpen else { return }; collapseSubmenus(); closeToken &+= 1; lingering = false; finishClose() }
    private func finishClose() {
        closing = false; isOpen = false; ringed = nil; focusedID = nil; virtualIndex = -1; virtualRing = nil; activeDescendant = nil; setOpen(false); emit("mdClose")
        let waiters = closeWaiters; closeWaiters = []; waiters.forEach { $0.resume() }
    }
    /// `closeEntireMenuTree()` (Tab) closes the root and focuses its anchor.
    func closeTree() { let r = root; r.close(); _ = r.focusAnchor() }
    /// Row activation without `keep-open`: the root anchor takes focus now, the root closes after 150 ms.
    func activated() {
        let r = root; _ = r.focusAnchor()
        // 9-27: the close request is the activation plus 150 ms (Chrome's setTimeout target), not the time this task happens to wake
        let at = AWCInputDelivery.time(nil), due = at + 150
        Task { @MainActor in try? await Task.sleep(nanoseconds: UInt64(max(0, due - CACurrentMediaTime() * 1000) * 1_000_000)); r.close(requestedAt: due) }
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
        if logicalRowFocus && comboboxID == nil {
            for (other, r) in rows where other != id && r.handle.isFocused { r.handle.isFocused = false }
            row.handle.isFocused = true; ensureVisible(id); return true
        }
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
        if let p = provider { let n = p.count(); if n > 0 { focusVirtual(nextEnabled(-1, 1, n), ring: ring) }; return }
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
    // MARK: virtual provider (handleKeyDownVirtual / focusVirtual / handleTypeaheadVirtual)
    /// Next non-disabled index from `from` in `dir`, wrapping; -1 only when every row is disabled or the list is empty.
    func nextEnabled(_ from: Int, _ dir: Int, _ count: Int) -> Int {
        guard count > 0, let p = provider else { return -1 }
        var idx = from
        for _ in 0..<count { idx += dir; if idx < 0 { idx = count - 1 } else if idx >= count { idx = 0 }; if !p.isDisabled(at: idx) { return idx } }
        return from >= 0 && from < count ? from : -1
    }
    /// The active index moves at once; after `ensureVisible` the latest request rings its windowed row and (combobox) marks it
    /// active without moving focus, or (no combobox) focuses it.
    func focusVirtual(_ index: Int, ring: Bool = true) {
        guard index >= 0, let p = provider else { return }
        virtualSeq &+= 1; let seq = virtualSeq; virtualIndex = index
        Task { @MainActor in
            await p.ensureVisible(index)
            guard seq == self.virtualSeq, self.isOpen, !self.closing, self.provider === p, let id = p.rowID(at: index) else { return }
            if self.comboboxID != nil {
                self.focusedID = id; self.virtualRing = ring ? id : nil; self.activeDescendant = id; self.ensureVisible(id)
            } else { _ = self.focus(id, ring: ring) }
        }
    }
    /// Keys from the combobox (header input or `AWCMenuHandle.handleKey`).
    func comboboxKey(_ key: String, shift: Bool, modified: Bool, fromInput: Bool = false) -> Bool {
        keyboardModality = true; registry?.pointerModality = false
        if provider != nil, let handled = virtualKey(key, shift: shift, modified: modified, fromInput: fromInput) { return handled }
        switch key {
        case "Escape": close(); _ = focusAnchor(); return true
        case "Tab": closeTree(); AWCMenuFocusTraversal.advance(backward: shift); return true
        default: return false
        }
    }
    /// The source's handleKeyDownVirtual; nil: the key keeps the menu's ordinary handling (Escape, Tab).
    func virtualKey(_ key: String, shift: Bool, modified: Bool, fromInput: Bool = false) -> Bool? {
        guard let p = provider else { return nil }
        let n = p.count()
        switch key {
        case "ArrowDown": focusVirtual(nextEnabled(virtualIndex, 1, n)); return true
        case "ArrowUp": focusVirtual(nextEnabled(virtualIndex, -1, n)); return true
        case "Home": focusVirtual(nextEnabled(-1, 1, n)); return true
        case "End": focusVirtual(nextEnabled(n, -1, n)); return true
        case "Enter":
            guard comboboxID != nil, virtualIndex >= 0 else { return false }
            if let id = p.rowID(at: virtualIndex) { rows[id]?.activate() }
            return true
        case "Escape", "Tab": return nil
        default:
            // Characters typed in the header search field are its own (the source checks e.target).
            guard !fromInput, key.count == 1, !modified, !shift else { return false }
            let now = CACurrentMediaTime() * 1000
            if now - virtualBufferAt > 500 { virtualBuffer = "" }
            virtualBuffer += key.lowercased(); virtualBufferAt = now
            let from = virtualBuffer.count == 1 ? virtualIndex + 1 : virtualIndex
            let hit = p.findPrefix(virtualBuffer, from: max(0, from))
            if hit >= 0 { focusVirtual(hit) }
            return true
        }
    }
    /// md-menu `handleKeyDown` for a row of this menu (focus is on the row).
    func key(_ key: String, from id: String, shift: Bool, modified: Bool, rtl: Bool = false) -> Bool {
        guard isOpen else { return false }
        keyboardModality = true; registry?.pointerModality = false
        if provider != nil, let handled = virtualKey(key, shift: shift, modified: modified) { return handled }
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
            if let claim = rowKeyClaim, !modified, key.count == 1 || key == "Backspace" { if claim(key == "\u{7F}" ? "Backspace" : key) { return true } }
            guard key.count == 1, !modified, !shift else { return false }
            let labels = rowOrder.map { rows[$0]?.label ?? "" }
            let hit = typeahead.next(key, now: CACurrentMediaTime() * 1000, focused: index, labels: labels)
            AWCMenuDebug.log("typeahead \(key) from \(id) index \(index) buffer \(typeahead.buffer) -> \(String(describing: hit))")
            if let hit { move(to: hit) }
            return true
        }
    }
}

/// 6-6: when the input that requests a menu change was delivered (KNOWN-CAUSES row 3, ios-harness.md item 31). A close
/// requested while a raw touch release is handled, or by a document click with its delivered time, runs its exit from
/// that input (Chrome: the style change in the input's task), not from when the main thread got to the handler.
enum AWCInputDelivery {
    static var touchEndedAt: Double? = nil
    /// iOS: the last touch-up the window delivered (AWCDeliveredTapRecognizer), for clicks that SwiftUI reports later.
    static var lastTouchUpAt: Double? = nil
    static func time(_ requested: Double?) -> Double {
        let now = CACurrentMediaTime() * 1000
        guard let t = requested ?? touchEndedAt, t > 0, t <= now, now - t < 100 else { return now }
        return t
    }
}
