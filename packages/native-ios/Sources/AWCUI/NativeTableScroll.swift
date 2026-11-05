import SwiftUI
#if canImport(AppKit)
import AppKit
#elseif canImport(UIKit)
import UIKit
#endif

/// Programmatic access to an md-table scrollport (the container's or a frozen table body): scroll to logical
/// offsets (inline-start = 0, so RTL is handled here) like setting `scrollLeft` / `scrollTop`.
public final class AWCTableScrollController {
    #if canImport(AppKit)
    weak var scrollView: NSScrollView?
    #elseif canImport(UIKit)
    weak var scrollView: UIScrollView?
    #endif
    var rtl = false
    public init() {}
    /// Logical offsets of a scroll view (inline-start = 0 when `rtl` maps it) and its scrollable ranges.
    #if canImport(AppKit)
    @MainActor static func position(of scroll: NSScrollView?, rtl: Bool) -> (x: Double, y: Double, maxX: Double, maxY: Double)? {
        guard let scroll, let document = scroll.documentView else { return nil }
        let clip = scroll.contentView
        let maxX = Swift.max(0, Double(document.frame.width - clip.bounds.width)), maxY = Swift.max(0, Double(document.frame.height - clip.bounds.height))
        let px = Double(clip.bounds.origin.x), py = document.isFlipped ? Double(clip.bounds.origin.y) : maxY - Double(clip.bounds.origin.y)
        return (rtl ? maxX - px : px, py, maxX, maxY)
    }
    #elseif canImport(UIKit)
    @MainActor static func position(of scroll: UIScrollView?, rtl: Bool) -> (x: Double, y: Double, maxX: Double, maxY: Double)? {
        guard let scroll else { return nil }
        let maxX = Swift.max(0, Double(scroll.contentSize.width - scroll.bounds.width)), maxY = Swift.max(0, Double(scroll.contentSize.height - scroll.bounds.height))
        let px = Double(scroll.contentOffset.x)
        return (rtl ? maxX - px : px, Double(scroll.contentOffset.y), maxX, maxY)
    }
    #endif
    /// Scrolls to logical offsets; nil keeps that axis. Returns false while no scrollport is attached.
    @MainActor @discardableResult public func scroll(x: Double?, y: Double?) -> Bool {
        #if canImport(AppKit)
        guard let scroll = scrollView, let document = scroll.documentView else { return false }
        let clip = scroll.contentView
        let maxX = Swift.max(0, document.frame.width - clip.bounds.width), maxY = Swift.max(0, document.frame.height - clip.bounds.height)
        var origin = clip.bounds.origin
        // Whole points, like scrollLeft / scrollTop at a device pixel ratio of 1.
        if let x { let lx = Swift.min(maxX, Swift.max(0, x.rounded())); origin.x = rtl ? maxX - lx : lx }
        if let y { let ly = Swift.min(maxY, Swift.max(0, y.rounded())); origin.y = document.isFlipped ? ly : maxY - ly }
        clip.scroll(to: origin); scroll.reflectScrolledClipView(clip)
        return true
        #elseif canImport(UIKit)
        guard let scroll = scrollView else { return false }
        let maxX = Swift.max(0, scroll.contentSize.width - scroll.bounds.width), maxY = Swift.max(0, scroll.contentSize.height - scroll.bounds.height)
        var offset = scroll.contentOffset
        if let x { let lx = Swift.min(maxX, Swift.max(0, x.rounded())); offset.x = rtl ? maxX - lx : lx }
        if let y { offset.y = Swift.min(maxY, Swift.max(0, y.rounded())) }
        scroll.setContentOffset(offset, animated: false)
        return true
        #else
        return false
        #endif
    }
}
#if canImport(AppKit)
public extension AWCTableScrollController {
    /// md-table-container scrolls 40 px on ArrowLeft / ArrowRight that the focused control does not use (the browser's default
    /// action), through an NSApplication local event monitor. A host that delivers key events straight to a window
    /// (`NSWindow.sendEvent`, which bypasses those monitors: offscreen previews, test harnesses) calls this first and skips
    /// its own delivery when it returns true (the focused control's key route took the arrow).
    @MainActor static func routeKeyDown(_ event: NSEvent) -> Bool {
        var consumed = false
        for probe in AWCTableScrollBridge.Probe.arrowProbes.allObjects where probe.window === event.window { if probe.arrow(event) { consumed = true } }
        return consumed
    }
}
#endif
/// The scroll view one table's bridge attached to (its own scrollport, whatever controller it reports to).
final class AWCTableScrollPortBox {
    #if canImport(AppKit)
    weak var port: NSScrollView?
    #elseif canImport(UIKit)
    weak var port: UIScrollView?
    #endif
}
private struct AWCTableScrollControllerKey: EnvironmentKey { static let defaultValue: AWCTableScrollController? = nil }
extension EnvironmentValues {
    var awcTableScrollController: AWCTableScrollController? { get { self[AWCTableScrollControllerKey.self] } set { self[AWCTableScrollControllerKey.self] = newValue } }
}
public extension View {
    /// Attaches a controller to the md-table scrollport(s) inside this view.
    func awcTableScrollController(_ controller: AWCTableScrollController?) -> some View { environment(\.awcTableScrollController, controller) }
}

/// A zero-size view inside the scroll content that hands the real platform scroll view to the controller.
#if canImport(AppKit)
struct AWCTableScrollBridge: NSViewRepresentable {
    let controller: AWCTableScrollController?
    /// md-table-container's scrollport: ArrowLeft / ArrowRight that the focused control does not use scroll it (the browser's
    /// default action on a scroll container), 40 px per press.
    var arrowScroll = false
    /// The scroll view's logical direction when it differs from the layout direction here (a frozen body: a physical
    /// left-to-right scroll view around a right-to-left grid, whose inline start is the physical right edge).
    var rtlOverride: Bool? = nil
    var portBox: AWCTableScrollPortBox? = nil
    @Environment(\.layoutDirection) private var direction
    final class Probe: NSView {
        var controller: AWCTableScrollController?
        var rtl = false
        var arrowScroll = false
        var portBox: AWCTableScrollPortBox?
        private var startedAtInlineStart = false
        private var monitor: Any?
        override func hitTest(_ point: NSPoint) -> NSView? { nil }
        override func isAccessibilityElement() -> Bool { false }
        private weak var attachedPort: NSScrollView?
        override func viewDidMoveToWindow() {
            super.viewDidMoveToWindow()
            // Leaving the window: a controller must not keep answering for a scrollport that is gone.
            if window == nil { if let c = controller, c.scrollView != nil, c.scrollView === attachedPort { c.scrollView = nil } } else { attach() }
            if let m = monitor { NSEvent.removeMonitor(m); monitor = nil }
            Self.arrowProbes.remove(self)
            if window != nil && arrowScroll {
                monitor = NSEvent.addLocalMonitorForEvents(matching: .keyDown) { [weak self] e in (self?.arrow(e) ?? false) ? nil : e }
                Self.arrowProbes.add(self)
            }
        }
        /// Container scrollports with arrow-key scrolling (for hosts that bypass NSApplication's event monitors).
        nonisolated(unsafe) static let arrowProbes = NSHashTable<Probe>.weakObjects()
        override func layout() { super.layout(); attach() }
        /// The scroll view around this probe: the enclosing one, else the deepest scroll view whose frame holds the probe
        /// (a right-to-left SwiftUI scroll view may host its content outside the NSScrollView's superview chain).
        var scrollPort: NSScrollView? {
            if let sv = enclosingScrollView { return sv }
            guard let root = window?.contentView else { return nil }
            let me = convert(bounds, to: nil)
            func all(_ v: NSView) -> [NSView] { [v] + v.subviews.flatMap(all) }
            return all(root).compactMap { $0 as? NSScrollView }.filter { $0.convert($0.bounds, to: nil).insetBy(dx: -1, dy: -1).contains(me.origin) }.last
        }
        func attach() {
            guard window != nil else { return }
            let port = scrollPort
            attachedPort = port; portBox?.port = port
            controller?.scrollView = port; controller?.rtl = rtl
            // A right-to-left scrollport starts at its inline start (the physical right edge), like the source's scrollLeft 0.
            if rtl, !startedAtInlineStart, let sv = port, let doc = sv.documentView, doc.frame.width - sv.contentView.bounds.width > 0.5 {
                startedAtInlineStart = true
                sv.contentView.scroll(to: NSPoint(x: doc.frame.width - sv.contentView.bounds.width, y: sv.contentView.bounds.origin.y)); sv.reflectScrolledClipView(sv.contentView)
            }
        }
        /// Returns true when the event was consumed here (a focused control's own key route took the arrow).
        func arrow(_ e: NSEvent) -> Bool {
            guard e.keyCode == 123 || e.keyCode == 124, e.modifierFlags.intersection([.command, .control, .option, .shift]).isEmpty,
                  let sv = scrollPort, let doc = sv.documentView, let responder = window?.firstResponder as? NSView,
                  // The focused control lies in this scrollport (SwiftUI may host its focus view outside the document view).
                  responder.isDescendant(of: sv) || sv.convert(sv.bounds, to: nil).intersects(responder.convert(responder.bounds, to: nil)),
                  !(responder is NSText || responder is NSTextField),
                  doc.frame.width > sv.contentView.bounds.width + 0.5, let controller, let p = controller.position() else {
                if e.keyCode == 123 || e.keyCode == 124, ProcessInfo.processInfo.environment["AWC_TABLE_DIAG"] != nil { print("DIAG arrow monitor: keyCode \(e.keyCode) port \(scrollPort != nil) responder \(String(describing: window?.firstResponder))"); fflush(stdout) }
                return false
            }
            if ProcessInfo.processInfo.environment["AWC_TABLE_DIAG"] != nil {
                let c = (responder as? AWCNativeButtonFocusView)?.configuration
                print("DIAG arrow route: responder \(type(of: responder)) id \(c?.id ?? "-") group \(c?.applicableGroup != nil) alt \(c?.routeKeyWithAlt != nil) route \(c?.routeKey != nil) x \(p.x) max \(p.maxX)"); fflush(stdout)
            }
            if let c = (responder as? AWCNativeButtonFocusView)?.configuration {
                // Arrow-routed controls (groups, alt routes) keep the arrows; a key route that does not take the arrow (a checkbox's
                // Space / Enter route) leaves it to the scrollport, and one that does consumes it here (delivered once).
                if c.applicableGroup != nil || c.routeKeyWithAlt != nil { return false }
                if let route = c.routeKey, route(e.keyCode == 124 ? "ArrowRight" : "ArrowLeft", false, false) { return true }
            }
            let physical = e.keyCode == 124 ? 40.0 : -40.0
            _ = controller.animate(x: p.x + (rtl ? -physical : physical), y: nil)
            return false
        }
        deinit { if let m = monitor { NSEvent.removeMonitor(m) } }
    }
    func makeNSView(context: Context) -> Probe { let v = Probe(); v.controller = controller; v.rtl = rtlOverride ?? (direction == .rightToLeft); v.arrowScroll = arrowScroll; v.portBox = portBox; return v }
    func updateNSView(_ v: Probe, context: Context) { v.controller = controller; v.rtl = rtlOverride ?? (direction == .rightToLeft); v.arrowScroll = arrowScroll; v.portBox = portBox; v.attach() }
}
#elseif canImport(UIKit)
struct AWCTableScrollBridge: UIViewRepresentable {
    let controller: AWCTableScrollController?
    /// Hardware-keyboard arrow scrolling is the system's on iOS (no browser default to mirror).
    var arrowScroll = false
    var rtlOverride: Bool? = nil
    var portBox: AWCTableScrollPortBox? = nil
    @Environment(\.layoutDirection) private var direction
    final class Probe: UIView {
        var controller: AWCTableScrollController?
        var portBox: AWCTableScrollPortBox?
        var rtl = false
        private var startedAtInlineStart = false
        override func point(inside point: CGPoint, with event: UIEvent?) -> Bool { false }
        override func didMoveToWindow() { super.didMoveToWindow(); attach() }
        override func layoutSubviews() { super.layoutSubviews(); attach() }
        func attach() {
            var v: UIView? = superview
            while let c = v, !(c is UIScrollView) { v = c.superview }
            let port = v as? UIScrollView
            controller?.scrollView = port; controller?.rtl = rtl; portBox?.port = port
            // A right-to-left scrollport starts at its inline start (the physical right edge), like the source's scrollLeft 0.
            if rtl, !startedAtInlineStart, let sv = port, window != nil, sv.contentSize.width - sv.bounds.width > 0.5 {
                startedAtInlineStart = true
                sv.setContentOffset(CGPoint(x: sv.contentSize.width - sv.bounds.width, y: sv.contentOffset.y), animated: false)
            }
        }
    }
    func makeUIView(context: Context) -> Probe { let v = Probe(); v.isAccessibilityElement = false; v.controller = controller; v.portBox = portBox; v.rtl = rtlOverride ?? (direction == .rightToLeft); return v }
    func updateUIView(_ v: Probe, context: Context) { v.controller = controller; v.portBox = portBox; v.rtl = rtlOverride ?? (direction == .rightToLeft); v.attach() }
}
#endif

// MARK: Dispatch from AWCNativeView

extension AWCNativeView {
    static let tableWrapper: [String: AWCValue] = [AWCTableAX.presentationalKey: .bool(true)]
    /// md-table family routing (each tag renders its dedicated native view; sub-tags shown alone get a table around them).
    @ViewBuilder var nativeTableFamily: some View {
        switch node.tag {
        case "md-table": AWCNativeTable(node: node, theme: theme, onEvent: onEvent)
        case "md-table-container": AWCNativeTableContainer(node: node, theme: theme, onEvent: onEvent)
        case "md-table-toolbar": AWCNativeTableToolbar(node: node, theme: theme, onEvent: onEvent)
        case "md-table-pagination": AWCNativeTablePagination(node: node, theme: theme, onEvent: onEvent)
        case "md-table-sort-label": AWCTableSortLabelView(node: node, env: nil, onEvent: onEvent)
        case "md-table-expand-toggle": AWCTableStandaloneExpandToggle(node: node, onEvent: onEvent)
        // The wrappers are presentational (no table semantics around a lone part, as on the Web).
        case "md-table-head", "md-table-body", "md-table-foot":
            AWCNativeTable(node: AWCNode(id: node.id + "-table", tag: "md-table", properties: Self.tableWrapper, children: [node]), theme: theme, onEvent: onEvent)
        case "md-table-row":
            AWCNativeTable(node: AWCNode(id: node.id + "-table", tag: "md-table", properties: Self.tableWrapper, children: [AWCNode(id: node.id + "-body", tag: "md-table-body", properties: Self.tableWrapper, children: [node])]), theme: theme, onEvent: onEvent)
        default: // md-table-cell
            AWCNativeTable(node: AWCNode(id: node.id + "-table", tag: "md-table", properties: Self.tableWrapper, children: [AWCNode(id: node.id + "-body", tag: "md-table-body", properties: Self.tableWrapper, children: [AWCNode(id: node.id + "-row", tag: "md-table-row", properties: Self.tableWrapper, children: [node])])]), theme: theme, onEvent: onEvent)
        }
    }
}
/// An expand toggle outside a row keeps its own state (the source binds to `closest('md-table-row')`).
struct AWCTableStandaloneExpandToggle: View {
    let node: AWCNode
    let onEvent: (AWCEvent) -> Void
    @State private var expanded = false
    @Environment(\.layoutDirection) private var direction
    @Environment(\.accessibilityReduceMotion) private var reduced
    var body: some View {
        AWCTableExpandToggleView(node: node, expanded: expanded, rtl: direction == .rightToLeft, reduced: reduced, toggle: { }, onEvent: onEvent)
    }
}
