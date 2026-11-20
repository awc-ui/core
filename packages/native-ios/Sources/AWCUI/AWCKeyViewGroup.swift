import SwiftUI
#if canImport(AppKit)
import AppKit
#elseif canImport(UIKit)
import UIKit
#endif

// Tab order of a composite whose source order is not AWCUI's geometric key-view order.
//
// AWCUI's sequential focus (AppKit's window key-view loop; AWCKeyViewLoop on UIKit) visits focus views in rows from top to
// bottom, leading to trailing — Chrome's DOM order for most components. A composite laid out in columns (md-transfer-list:
// the source column, the movers, the target column) is visited column by column in Chrome. An AWCKeyViewGroup lists the
// composite's regions in source order; its members (focus views whose centre lies in a region) are visited region by region
// (inside a region: rows top to bottom, leading to trailing), entered at the first (Shift+Tab: last) member, and left from the
// last (first) member to whatever AWCUI's loop has next.

@MainActor final class AWCKeyViewRegionBox {
    #if canImport(AppKit)
    weak var view: NSView?
    #else
    weak var view: UIView?
    #endif
}

@MainActor final class AWCKeyViewGroup {
    let regions: [AWCKeyViewRegionBox]
    var rtl = false
    init(regions count: Int) { regions = (0..<count).map { _ in AWCKeyViewRegionBox() } }

    private static let groups = NSHashTable<AWCKeyViewGroup>.weakObjects()
    func activate() { Self.groups.add(self); Self.installMonitor() }
    func deactivate() { Self.groups.remove(self) }

    #if canImport(AppKit)
    typealias PlatformView = NSView
    private static func frame(_ v: NSView) -> CGRect { let f = v.convert(v.bounds, to: nil); return CGRect(x: f.minX, y: -f.maxY, width: f.width, height: f.height) }   // y down
    #else
    typealias PlatformView = UIView
    private static func frame(_ v: UIView) -> CGRect { v.convert(v.bounds, to: nil) }
    #endif

    /// The region index of a view (nil: not a member).
    private func region(of v: PlatformView) -> Int? {
        let f = Self.frame(v), c = CGPoint(x: f.midX, y: f.midY)
        return regions.firstIndex { box in
            guard let r = box.view, r.window != nil, r.window === v.window else { return false }
            return Self.frame(r).insetBy(dx: -0.5, dy: -0.5).contains(c)
        }
    }
    /// `items` (in geometric order) with this group's members in source order, at the place of the first member.
    func reorder<T>(_ items: [T], view: (T) -> PlatformView) -> [T] {
        let tagged = items.enumerated().map { ($0.offset, $0.element, region(of: view($0.element))) }
        let members = tagged.filter { $0.2 != nil }
        guard let first = members.first?.0 else { return items }
        let sorted = members.sorted { a, b in
            if a.2! != b.2! { return a.2! < b.2! }
            let fa = Self.frame(view(a.1)), fb = Self.frame(view(b.1))
            if abs(fa.midY - fb.midY) > min(fa.height, fb.height) / 2 { return fa.midY < fb.midY }
            return rtl ? fa.midX > fb.midX : fa.midX < fb.midX
        }.map(\.1)
        var out: [T] = []
        for (i, item, r) in tagged { if i == first { out += sorted }; if r == nil { out.append(item) } }
        return out
    }
    /// Every active group's members reordered (UIKit's AWCKeyViewLoop and the AppKit monitor below).
    static func reorderAll<T>(_ items: [T], view: (T) -> PlatformView) -> [T] {
        groups.allObjects.reduce(items) { $1.reorder($0, view: view) }
    }

    #if canImport(AppKit)
    private static var monitor: Any?
    /// AppKit: Tab / Shift+Tab inside (or into) a group follow the group's order; everything else is AppKit's key-view loop.
    private static func installMonitor() {
        guard monitor == nil else { return }
        monitor = NSEvent.addLocalMonitorForEvents(matching: .keyDown) { e in handle(e) ? nil : e }
    }
    /// The monitor's handling of a key-down (true: consumed). Parity tests that deliver keys to the window directly call it first.
    static func handle(_ e: NSEvent) -> Bool {
        guard e.type == .keyDown, e.keyCode == 48, !e.modifierFlags.contains(.control), !e.modifierFlags.contains(.command), let w = e.window, !groups.allObjects.isEmpty else { return false }
        return tab(backward: e.modifierFlags.contains(.shift), in: w)
    }
    private static let debug = ProcessInfo.processInfo.environment["AWC_KEYVIEW_DEBUG"] != nil
    private static func describe(_ v: NSView?) -> String {
        guard let v else { return "nil" }
        let f = frame(v), r = groups.allObjects.compactMap { $0.region(of: v) }.first
        return "\(type(of: v)):\(v.accessibilityIdentifier()):\(Int(f.minX)),\(Int(f.minY)) \(Int(f.width))x\(Int(f.height))\(r.map { " r\($0)" } ?? "")"
    }
    private static func current(_ w: NSWindow) -> NSView? {
        guard let r = w.firstResponder else { return nil }
        if let tv = r as? NSTextView, tv.isFieldEditor, let f = tv.delegate as? NSView { return f }
        guard let v = r as? NSView, v !== w.contentView else { return nil }
        return v
    }
    private static func keyViews(_ w: NSWindow, current: NSView? = nil) -> [NSView] {
        guard let root = w.contentView else { return [] }
        var found: [NSView] = []
        func walk(_ v: NSView) {
            if v.isHidden || v.alphaValue == 0 { return }
            if let b = v as? AWCNativeButtonFocusView { if b.canBecomeKeyView || b === current { found.append(b) } }
            else if let t = v as? NSTextField { if (t.isEditable && t.isEnabled && t.canBecomeKeyView) || t === current { found.append(t) } }
            for c in v.subviews { walk(c) }
        }
        walk(root)
        // AppKit's own order: rows top to bottom, leading to trailing.
        return found.sorted { a, b in
            let fa = frame(a), fb = frame(b)
            if abs(fa.midY - fb.midY) > min(fa.height, fb.height) / 2 { return fa.midY < fb.midY }
            let rtl = a.userInterfaceLayoutDirection == .rightToLeft
            return rtl ? fa.midX > fb.midX : fa.midX < fb.midX
        }
    }
    private static func isMember(_ v: NSView) -> Bool { groups.allObjects.contains { $0.region(of: v) != nil } }
    private static func focus(_ v: NSView) {
        if let b = v as? AWCNativeButtonFocusView { _ = b.requestNativeFocus(showIndicator: true) } else { _ = v.window?.makeFirstResponder(v) }
    }
    /// Handles the Tab when it starts at, or would land on, a group member.
    private static func tab(backward: Bool, in w: NSWindow) -> Bool {
        let cur = current(w)
        let geometric = keyViews(w, current: cur)
        let curIndex = cur.flatMap { c in geometric.firstIndex { $0 === c } }
        let candidate: NSView? = {
            // Outside the groups AppKit's own loop decides where the key goes (its wrap included).
            if let c = cur, !isMember(c) { return backward ? c.previousValidKeyView : c.nextValidKeyView }
            if let i = curIndex { let j = backward ? i - 1 : i + 1; return geometric.indices.contains(j) ? geometric[j] : nil }
            return cur == nil ? (backward ? geometric.last : geometric.first) : nil
        }()
        guard (cur.map(isMember) ?? false) || (candidate.map(isMember) ?? false) else {
            if debug { print("KV pass cur \(describe(cur)) candidate \(describe(candidate))") }
            // AppKit's own loop moves the key now; when it lands inside a group from outside, the group is entered at its
            // first (Shift+Tab: last) member, as Chrome enters a composite in source order.
            DispatchQueue.main.async { enterIfLanded(backward: backward, in: w, from: cur) }
            return false
        }
        let ordered = reorderAll(geometric) { $0 }
        if debug { print("KV tab\(backward ? " back" : "") cur \(describe(cur)) resp \(w.firstResponder.map { String(describing: type(of: $0)) } ?? "nil")"); for v in ordered { print("KV   \(describe(v))\(v === cur ? "  <" : "")") } }
        if let c = cur, let i = ordered.firstIndex(where: { $0 === c }) {
            let j = backward ? i - 1 : i + 1
            if ordered.indices.contains(j) { focus(ordered[j]); return true }
            // Past either end Chrome leaves the page content (the document).
            _ = w.makeFirstResponder(nil); return true
        }
        if cur == nil, let first = backward ? ordered.last : ordered.first { focus(first); return true }
        // Entering from outside: the group's first (last) member stands where AppKit would have landed.
        let members = ordered.filter(isMember)
        if let cand = candidate, isMember(cand), let target = backward ? members.last : members.first { focus(target); return true }
        return false
    }
    private static func enterIfLanded(backward: Bool, in w: NSWindow, from previous: NSView?) {
        guard let now = current(w), now !== previous, isMember(now) else { return }
        let members = reorderAll(keyViews(w, current: now)) { $0 }.filter(isMember)
        guard let target = backward ? members.last : members.first, target !== now else { return }
        if debug { print("KV enter \(describe(target)) (AppKit landed on \(describe(now)))") }
        focus(target)
    }
    #else
    private static func installMonitor() {}
    /// UIKit: Tab follows AWCKeyViewLoop (reordered by `reorderAll`); nothing to intercept.
    static func handle<E>(_ e: E) -> Bool { false }
    #endif
}

#if canImport(AppKit)
final class AWCKeyViewRegionView: NSView { weak var box: AWCKeyViewRegionBox?; override func hitTest(_ point: NSPoint) -> NSView? { nil } }
struct AWCKeyViewRegion: NSViewRepresentable {
    let box: AWCKeyViewRegionBox
    func makeNSView(context: Context) -> AWCKeyViewRegionView { let v = AWCKeyViewRegionView(); v.setAccessibilityElement(false); v.box = box; box.view = v; return v }
    // A view SwiftUI is tearing down (the stacked / columns layout switch) still gets an update after its replacement was made (n1 1-1, AWC_KEYVIEW_DEBUG trace): it must not take the box back; the box is released when the view is dismantled.
    func updateNSView(_ view: AWCKeyViewRegionView, context: Context) { if box.view == nil { box.view = view } }
    static func dismantleNSView(_ view: AWCKeyViewRegionView, coordinator: ()) { if view.box?.view === view { view.box?.view = nil } }
}
#else
final class AWCKeyViewRegionView: UIView { weak var box: AWCKeyViewRegionBox?; override func point(inside point: CGPoint, with event: UIEvent?) -> Bool { false } }
struct AWCKeyViewRegion: UIViewRepresentable {
    let box: AWCKeyViewRegionBox
    func makeUIView(context: Context) -> AWCKeyViewRegionView { let v = AWCKeyViewRegionView(); v.isAccessibilityElement = false; v.backgroundColor = .clear; v.box = box; box.view = v; return v }
    func updateUIView(_ view: AWCKeyViewRegionView, context: Context) { if box.view == nil { box.view = view } }
    static func dismantleUIView(_ view: AWCKeyViewRegionView, coordinator: ()) { if view.box?.view === view { view.box?.view = nil } }
}
#endif
