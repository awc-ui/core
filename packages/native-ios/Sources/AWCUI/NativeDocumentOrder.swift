import SwiftUI
#if canImport(AppKit)
import AppKit
#elseif canImport(UIKit)
import UIKit
#endif

// Sequential focus in document order (gate-7 R4-05).
//
// Chrome moves Tab / Shift+Tab through the tabbable elements in DOM order. AppKit's window key-view loop, and AWCUI's
// UIKit loop that reproduces it (NativeKeyViewLoop.swift), order key views by geometry: rows from top to bottom, then
// leading to trailing. That differs from DOM order wherever the layout does not follow the source: a standard
// md-side-sheet beside the page puts its header row before page controls further down. SwiftUI combines preference
// values in view-tree order, which is the source order of the content, so every AWC focus bridge publishes a token and a
// document-order root numbers the tokens of its content (keeping known positions: `zIndex` reorders siblings' values). `AWCModalScope`, which applications place at their content root,
// is that root. In a key-view loop the root's AWC focus views take the positions the loop gives them, in document order;
// other key views (text inputs, platform controls) keep theirs. A bridge placed behind or over its content publishes
// after the controls inside that content, so a focus view whose frame contains the ones just before it moves ahead of
// them (an element precedes its descendants in the DOM). Past the last (first) stop focus leaves the content, as Chrome
// leaves the page. Without a root the key-view loop is unchanged.

/// The place of one AWC focus bridge in the document: its index in the outermost document-order root that collected it.
final class AWCDocumentToken: Equatable {
    var order = 0
    weak var root: AWCDocumentOrderRoot?
    /// Nesting depth of the root that numbered the token (the outermost root numbers it).
    var depth = Int.max
    static func == (a: AWCDocumentToken, b: AWCDocumentToken) -> Bool { a === b }
}
/// One document-order root (`AWCDocumentOrderCollector`). Positions are kept across updates: a sibling raised with
/// `zIndex` (a focus-visible control paints its focus ring above its neighbours) moves to the end of its container's
/// preference values without moving in the document. A token that is new goes before the first known token that follows it
/// in the update (at the end when none does); tokens no longer present leave.
final class AWCDocumentOrderRoot {
    private var known: [AWCDocumentToken] = []
    func update(_ tokens: [AWCDocumentToken]) -> [AWCDocumentToken] {
        if known.isEmpty { var seen = Set<ObjectIdentifier>(); known = tokens.filter { seen.insert(ObjectIdentifier($0)).inserted }; return known }
        let present = Set(tokens.map { ObjectIdentifier($0) })
        var order = known.filter { present.contains(ObjectIdentifier($0)) }
        var index: [ObjectIdentifier: Int] = [:]
        func reindex() { index = [:]; for (i, token) in order.enumerated() { index[ObjectIdentifier(token)] = i } }
        reindex()
        for (i, token) in tokens.enumerated() where index[ObjectIdentifier(token)] == nil {
            let following = tokens[(i + 1)...].first { index[ObjectIdentifier($0)] != nil }
            order.insert(token, at: following.flatMap { index[ObjectIdentifier($0)] } ?? order.count)
            reindex()
        }
        known = order
        return order
    }
}

/// The tokens of the AWC focus bridges below a view, in view-tree order.
struct AWCDocumentOrderKey: PreferenceKey {
    static var defaultValue: [AWCDocumentToken] { [] }
    static func reduce(value: inout [AWCDocumentToken], nextValue: () -> [AWCDocumentToken]) { value.append(contentsOf: nextValue()) }
}
private struct AWCDocumentOrderDepthKey: EnvironmentKey { static let defaultValue = 0 }
extension EnvironmentValues {
    var awcDocumentOrderDepth: Int { get { self[AWCDocumentOrderDepthKey.self] } set { self[AWCDocumentOrderDepthKey.self] = newValue } }
}

/// A document-order root: numbers the AWC focus bridges of its content in view-tree (source) order.
struct AWCDocumentOrderCollector: ViewModifier {
    @Environment(\.awcDocumentOrderDepth) private var depth
    @State private var root = AWCDocumentOrderRoot()
    init() {}
    func body(content: Content) -> some View {
        let root = root, depth = depth
        content
            .environment(\.awcDocumentOrderDepth, depth + 1)
            .onPreferenceChange(AWCDocumentOrderKey.self) { tokens in
                for (index, token) in root.update(tokens).enumerated() where depth <= token.depth || token.root == nil {
                    token.order = index; token.root = root; token.depth = depth
                }
            }
    }
}

/// An AWC focus bridge: the native focus surface (`AWCNativeButtonFocusSurface`, NativeFocusBridge.swift) and its
/// document-order token.
struct AWCNativeButtonFocusBridge: View {
    let configuration: AWCNativeFocusConfiguration
    @State private var token = AWCDocumentToken()
    init(configuration: AWCNativeFocusConfiguration) { self.configuration = configuration }
    var body: some View {
        AWCNativeButtonFocusSurface(configuration: configuration, token: token).preference(key: AWCDocumentOrderKey.self, value: [token])
    }
}

@MainActor enum AWCDocumentTabOrder {
    /// `list`, a key-view loop, with the AWC focus views of each document-order root put in document order into the
    /// positions they occupy; other entries keep their positions.
    static func fill<V>(_ list: [V], token: (V) -> AWCDocumentToken?, frame: (V) -> CGRect) -> [V] {
        var positions: [ObjectIdentifier: [Int]] = [:]
        for (index, item) in list.enumerated() { if let root = token(item)?.root { positions[ObjectIdentifier(root), default: []].append(index) } }
        var out = list
        for slots in positions.values where slots.count > 1 {
            let members = containersFirst(slots.map { list[$0] }.sorted { (token($0)?.order ?? 0) < (token($1)?.order ?? 0) }, frame: frame)
            for (slot, member) in zip(slots, members) { out[slot] = member }
        }
        return out
    }
    /// DOM pre-order for focus views that contain others: a view whose frame contains the views just before it moves
    /// ahead of them.
    static func containersFirst<V>(_ list: [V], frame: (V) -> CGRect) -> [V] {
        var out = list
        for index in out.indices {
            let item = out[index], outer = frame(item)
            var target = index
            while target > 0, encloses(outer, frame(out[target - 1])) { target -= 1 }
            if target < index { out.remove(at: index); out.insert(item, at: target) }
        }
        return out
    }
    private static func encloses(_ outer: CGRect, _ inner: CGRect) -> Bool {
        inner.width > 0 && inner.height > 0 && outer.insetBy(dx: -0.5, dy: -0.5).contains(inner) && outer.width * outer.height > inner.width * inner.height + 1
    }
}

#if canImport(AppKit)
extension AWCDocumentTabOrder {
    /// Tab / Shift+Tab from `view`, any key view: document order in a window that holds a document-order root, else the
    /// window key-view loop.
    static func select(from view: NSView, backward: Bool) {
        if move(from: view, backward: backward) { return }
        if backward { if !movePrevious(from: view) { view.window?.selectPreviousKeyView(view) } } else { if !moveNext(from: view) { view.window?.selectNextKeyView(view) } }
    }
    /// Moves sequential focus from `view` in document order; false (nothing moved) when its window holds no document-order
    /// root.
    @discardableResult static func move(from view: NSView, backward: Bool) -> Bool {
        guard let window = view.window else { return false }
        // From a field editor: its text field.
        let view = (view as? NSTextView).flatMap { $0.isFieldEditor ? $0.delegate as? NSView : nil } ?? view
        guard let order = loop(in: window, including: view), let index = order.firstIndex(where: { $0 === view }) else { return false }
        let rest = backward ? Array(order[..<index].reversed()) : Array(order[(index + 1)...])
        for candidate in rest where candidate.canBecomeKeyView && window.makeFirstResponder(candidate) { return true }
        // Past the last (first) stop Chrome leaves the page content, as AWCUI's UIKit loop does: no view keeps focus.
        _ = window.makeFirstResponder(nil)
        return true
    }
    /// Shift+Tab from `view` in a window without a document-order root: the previous key view of the same geometric loop, the
    /// last one from the first (AppKit's loop wraps). AppKit's own previous-key-view chain is unset for views SwiftUI adds after
    /// the window was shown, and a field editor's Shift+Tab then lands on the next view.
    @discardableResult static func movePrevious(from view: NSView) -> Bool {
        guard let window = view.window else { return false }
        let view = (view as? NSTextView).flatMap { $0.isFieldEditor ? $0.delegate as? NSView : nil } ?? view
        guard let order = loop(in: window, including: view, requireRoot: false), let index = order.firstIndex(where: { $0 === view }) else { return false }
        for candidate in Array(order[..<index].reversed()) + Array(order[(index + 1)...].reversed()) where candidate.canBecomeKeyView && window.makeFirstResponder(candidate) { return true }
        return false
    }
    /// Tab from `view` in a window without a document-order root: the next key view of the same geometric loop (the first one from
    /// the last: AppKit's loop wraps). The counterpart of `movePrevious`: a field editor's Tab through AppKit's own chain stays on the
    /// field when SwiftUI added the views after the window was shown (md-table-pagination's rows-per-page select).
    @discardableResult static func moveNext(from view: NSView) -> Bool {
        guard let window = view.window else { return false }
        let view = (view as? NSTextView).flatMap { $0.isFieldEditor ? $0.delegate as? NSView : nil } ?? view
        guard let order = loop(in: window, including: view, requireRoot: false), let index = order.firstIndex(where: { $0 === view }) else { return false }
        for candidate in Array(order[(index + 1)...]) + Array(order[..<index]) where candidate.canBecomeKeyView && window.makeFirstResponder(candidate) { return true }
        return false
    }
    /// Tab from the document (no first responder): the first (Shift+Tab: last) key view in document order.
    static func enter(in window: NSWindow, backward: Bool) -> Bool {
        guard let order = loop(in: window, including: nil) else { return false }
        for candidate in (backward ? order.reversed() : order) where candidate.canBecomeKeyView && window.makeFirstResponder(candidate) { return true }
        return false
    }
    /// The window's key views in the order of AppKit's automatic key-view loop (rows from top to bottom, views whose
    /// vertical extents overlap by at least half of the smaller height sharing a row, then leading to trailing; the order
    /// AWCUI's UIKit loop reproduces), with the document-order roots' focus views filled in; nil when no focus view has a
    /// root and `current` reads left to right (AppKit's own loop then). Under a right-to-left layout a row reads from the
    /// trailing edge, as Chrome's DOM order does there and AppKit's geometric loop does not (md-autocomplete: Tab from the
    /// input reaches its clear button). `current` is included even when it is not a Tab stop. (The views' own `nextKeyView` chain is not that loop:
    /// AppKit leaves it unset for views SwiftUI adds after the window was shown.)
    static func loop(in window: NSWindow, including current: NSView?, requireRoot: Bool = true) -> [NSView]? {
        guard let content = window.contentView else { return nil }
        var found: [(view: NSView, frame: CGRect)] = [], rooted = false
        func walk(_ view: NSView) {
            guard !view.isHidden, view.alphaValue > 0 else { return }
            // A text field's field editor (in the field while it edits) stands for the field, which is the key view.
            if (view as? NSTextView)?.isFieldEditor == true { return }
            if view !== content, view === current || view.canBecomeKeyView, !String(describing: type(of: view)).contains("HostingView") {
                let r = view.convert(view.bounds, to: nil)   // window coordinates (y up): rows are read in a y-down copy
                found.append((view, CGRect(x: r.minX, y: -r.maxY, width: r.width, height: r.height)))
                if token(view)?.root != nil { rooted = true }
            }
            for child in view.subviews { walk(child) }
        }
        walk(content)
        guard rooted || !requireRoot || found.contains(where: { $0.view.userInterfaceLayoutDirection == .rightToLeft }) else { return nil }
        var rows: [(top: CGFloat, bottom: CGFloat, items: [(view: NSView, frame: CGRect)])] = []
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
        var frames: [ObjectIdentifier: CGRect] = [:]
        for item in found { frames[ObjectIdentifier(item.view)] = item.frame }
        let geometric = rows.flatMap { row -> [NSView] in
            // A row reads from the trailing edge when any of its views is laid out right to left (an AppKit text field keeps
            // its own direction; the focus bridges follow SwiftUI's layout direction).
            let rtl = row.items.contains { $0.view.userInterfaceLayoutDirection == .rightToLeft }
            return row.items.sorted { rtl ? $0.frame.maxX > $1.frame.maxX : $0.frame.minX < $1.frame.minX }.map { $0.view }
        }
        return fill(geometric, token: { token($0) }, frame: { frames[ObjectIdentifier($0)] ?? .zero })
    }
    private static func token(_ view: NSView) -> AWCDocumentToken? { (view as? AWCNativeButtonFocusView)?.documentToken }
}
#endif
