import SwiftUI
import Observation
#if canImport(AppKit)
import AppKit
#elseif canImport(UIKit)
import UIKit
import UIKit.UIGestureRecognizerSubclass
#endif

/// Anchors, open surfaces and dismissal for the md-menu family. Anchored menus present in the nearest
/// `AWCMenuScope` (the top layer: above content, positioned in the scope's viewport); outside one they render in flow.
@Observable final class AWCMenuRegistry {
    let space = "awc-menu-\(UUID().uuidString)"
    var anchors: [String: CGRect] = [:]
    var wanted: Set<String> = []
    var viewport: CGSize = .zero
    @ObservationIgnored var surfaces: [String: CGRect] = [:]
    @ObservationIgnored var controllers: [String: AWCMenuController] = [:]
    @ObservationIgnored var order: [String] = []
    /// The most recent user interaction was a pointer press (Chrome's :focus-visible heuristic for script focus).
    @ObservationIgnored var pointerModality = false
    /// Focus actions of mounted anchors (the anchor element of `anchor="<id>"`).
    @ObservationIgnored var anchorFocus: [String: () -> Bool] = [:]
    @ObservationIgnored var anchorOwners: [String: UUID] = [:]
    /// Composite click listeners (md-select's onClick on its field), keyed by owner; `downPoint` is the press of the click.
    @ObservationIgnored var clickObservers: [String: AWCMenuClickObserver] = [:]
    @ObservationIgnored var downPoint: CGPoint?
    /// Accessible names of mounted anchors and submenu rows (a menu is named after its anchor).
    var anchorLabels: [String: String] = [:]
    func setAnchorLabel(_ id: String, _ label: String) { if anchorLabels[id] != label { anchorLabels[id] = label } }
    /// aria-expanded of the anchor `id`: nil while no top-level menu names it, else whether one of them is open
    /// (`open` turns false at the end of the exit, as on the Web).
    func anchorExpanded(_ id: String) -> Bool? {
        guard !id.isEmpty, wanted.contains(id), registrations >= 0 else { return nil }
        let menus = controllers.values.filter { $0.parent == nil && $0.model.anchor == id }
        return menus.isEmpty ? nil : menus.contains { $0.isOpen }
    }
    /// Bumped when a menu registers or unregisters (anchors re-read their expanded state).
    var registrations = 0
    func register(_ c: AWCMenuController) { if controllers[c.nodeID] == nil { order.append(c.nodeID) }; controllers[c.nodeID] = c; registrations &+= 1 }
    func unregister(_ c: AWCMenuController) { if controllers[c.nodeID] === c { controllers[c.nodeID] = nil; order.removeAll { $0 == c.nodeID }; surfaces[c.nodeID] = nil; registrations &+= 1 } }
    /// `document` click: every open, non-persistent menu whose element (surface tree) does not contain the point closes.
    func pointerDown(at p: CGPoint) { pointerModality = true; click(at: p) }
    /// `document` click listener: runs after the target's handler; a menu opened by this very click is not dismissed.
    /// `time` is when the click was delivered (the deferred listener can run after a slow first render of that menu).
    func click(at p: CGPoint, time: Double = CACurrentMediaTime() * 1000) {
        let down = downPoint ?? p; downPoint = nil
        for o in clickObservers.values where o.frame.contains(p) && o.frame.contains(down) && !o.exclude.contains(where: { $0.contains(p) || $0.contains(down) }) { o.handler() }
        for id in order { guard let c = controllers[id], c.isOpen, !c.closing, !c.model.persistent, c.openedAt < time - 40 else { continue }
            if !c.treeContains(p, surfaces: surfaces) { c.close(requestedAt: time) } }
    }
    /// Escape outside any menu row: the open anchored menus close and focus their anchors.
    @discardableResult func escape() -> Bool {
        var handled = false
        for id in order.reversed() { if let c = controllers[id], c.isOpen, !c.closing, c.parent == nil, !c.model.anchor.isEmpty { c.close(); c.focusAnchor(); handled = true } }
        return handled
    }
    /// Opening a menu closes every other open, non-persistent menu that neither contains nor is contained by it.
    func dismissPeers(of opened: AWCMenuController) {
        guard !opened.model.persistent else { return }
        for id in order { guard let c = controllers[id], c !== opened, c.isOpen, !c.model.persistent else { continue }
            if c.isAncestor(of: opened) || opened.isAncestor(of: c) { continue }; c.close() }
    }
}
struct AWCMenuEntry: Identifiable { let id: String; let order: Int; let content: (CGSize) -> AnyView }
struct AWCMenuEntries: PreferenceKey {
    static var defaultValue: [AWCMenuEntry] { [] }
    static func reduce(value: inout [AWCMenuEntry], nextValue: () -> [AWCMenuEntry]) { value.append(contentsOf: nextValue()) }
}
private struct AWCMenuRegistryKey: EnvironmentKey { static let defaultValue: AWCMenuRegistry? = nil }
private struct AWCMenuControllerKey: EnvironmentKey { static let defaultValue: AWCMenuController? = nil }
extension EnvironmentValues {
    var awcMenuRegistry: AWCMenuRegistry? { get { self[AWCMenuRegistryKey.self] } set { self[AWCMenuRegistryKey.self] = newValue } }
    /// The md-menu that owns the rows below (closest menu).
    var awcMenuController: AWCMenuController? { get { self[AWCMenuControllerKey.self] } set { self[AWCMenuControllerKey.self] = newValue } }
}

/// The menus presented in one `AWCMenuScope`: md-menu methods by source id (Laboratory, tests and app code).
@MainActor public final class AWCMenuScopeState {
    let registry = AWCMenuRegistry()
    public init() {}
    public func menu(_ id: String) -> AWCMenuHandle { AWCMenuHandle(registry: registry, id: id) }
    /// Ids of the menus mounted in the scope, in registration order.
    public var menuIDs: [String] { registry.order }
}
/// md-menu's imperative API for the menu node `id` (`show`, `close`, `reposition`, `whenClosed`, `getScrollViewport`)
/// and md-sub-menu-item `collapse()`. Calls on a menu that is not mounted return false / nil.
@MainActor public struct AWCMenuHandle {
    let registry: AWCMenuRegistry
    public let id: String
    var c: AWCMenuController? { registry.controllers[id] }
    public var isOpen: Bool { c?.isOpen ?? false }
    public var isClosing: Bool { c?.closing ?? false }
    /// `show({autoFocus})`: opens (and dismisses peers); `autoFocus` nil follows the menu's `auto-focus` property.
    @discardableResult public func show(autoFocus: Bool? = nil) -> Bool { guard let c else { return false }; c.show(autoFocus: autoFocus); return true }
    /// `close()`: the 150 ms exit, then `open` turns false and mdClose fires.
    @discardableResult public func close() -> Bool { guard let c else { return false }; c.close(); return true }
    @discardableResult public func reposition() -> Bool { guard let c else { return false }; c.repositions &+= 1; return true }
    public func whenClosed() async { await c?.whenClosed() }
    /// The capped scroll viewport (dp): scrollTop, scrollHeight (content) and clientHeight; nil while closed.
    public func getScrollViewport() -> (scrollTop: Double, scrollHeight: Double, clientHeight: Double)? {
        guard let c, c.isOpen else { return nil }
        return (c.scrollTop, c.contentHeight, c.viewportHeight)
    }
    /// md-sub-menu-item `collapse()` on the submenu row `row` of this menu (its flyout closes without the exit).
    @discardableResult public func collapse(row: String) -> Bool { guard let r = c?.rows[row] else { return false }; r.collapse(); return true }
    public var rows: [String] { c?.rowOrder ?? [] }
}

/// Hosts anchored md-menu surfaces above `content` within this view's bounds (the menu viewport).
public struct AWCMenuScope<Content: View>: View {
    @State private var registry = AWCMenuRegistry()
    private let content: Content
    public init(@ViewBuilder content: () -> Content) { self.content = content() }
    /// A scope whose menus are reachable through `state` (methods).
    public init(state: AWCMenuScopeState, @ViewBuilder content: () -> Content) { _registry = State(initialValue: state.registry); self.content = content() }
    init(registry: AWCMenuRegistry, @ViewBuilder content: () -> Content) { _registry = State(initialValue: registry); self.content = content() }
    public var body: some View {
        ZStack(alignment: .topLeading) { content }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .environment(\.awcMenuRegistry, registry)
            .overlayPreferenceValue(AWCMenuEntries.self) { entries in
                GeometryReader { g in
                    ZStack(alignment: .topLeading) {
                        ForEach(entries.sorted { $0.order < $1.order }) { entry in entry.content(g.size) }
                    }.frame(width: g.size.width, height: g.size.height, alignment: .topLeading)
                }
                .environment(\.awcMenuRegistry, registry)
            }
            .coordinateSpace(name: registry.space)
            .onGeometryChange(for: CGSize.self) { $0.size } action: { registry.viewport = $0 }
            .background { AWCMenuNativeHost(registry: registry).allowsHitTesting(false) }
            #if canImport(UIKit)
            .modifier(AWCMenuScopeVirtualKeys(registry: registry))
            #endif
    }
}

/// Reports a view's frame as an md-menu anchor (`anchor="<id>"`) to the nearest `AWCMenuScope`.
public extension View {
    /// `focus` moves focus to the anchor when a menu restores focus (Escape, Tab, activation).
    /// `label` names the menus anchored here (their accessible name, as the Web names a menu after its anchor).
    func awcMenuAnchor(_ id: String, label: String? = nil, focus: (() -> Bool)? = nil) -> some View { modifier(AWCMenuAnchorModifier(id: id, focus: focus, label: label)) }
}
/// AWCNativeView applies this to every node: it reports the frame only while some menu names the node as its anchor.
struct AWCMenuAnchorAuto: ViewModifier {
    let id: String
    /// The anchor's accessible name (computed only while a menu names this node).
    var label: () -> String = { "" }
    @Environment(\.awcMenuRegistry) private var registry
    func body(content: Content) -> some View {
        if let registry, registry.wanted.contains(id) { content.modifier(AWCMenuAnchorModifier(id: id, focus: nil, label: label())) } else { content }
    }
}
struct AWCMenuAnchorModifier: ViewModifier {
    let id: String
    var focus: (() -> Bool)? = nil
    var label: String? = nil
    @Environment(\.awcMenuRegistry) private var registry
    /// The view that registered `id` last owns it: a replacing view (new identity) appears before the old one disappears.
    @State private var token = UUID()
    func body(content: Content) -> some View {
        if let registry, !id.isEmpty {
            content.onGeometryChange(for: CGRect.self) { $0.frame(in: .named(registry.space)) } action: { registry.anchors[id] = $0; registry.anchorOwners[id] = token }
                .onAppear { registry.anchorOwners[id] = token; if let focus { registry.anchorFocus[id] = focus } }
                .onChange(of: label, initial: true) { _, l in if let l { registry.setAnchorLabel(id, l) } }
                .onDisappear {
                    guard registry.anchorOwners[id] == token else { return }
                    registry.anchors[id] = nil; registry.anchorFocus[id] = nil; registry.anchorLabels[id] = nil; registry.anchorOwners[id] = nil
                }
        } else { content }
    }
}

#if canImport(AppKit)
/// Document-level pointer and Escape observation (the source's `document` listeners), never consuming the event
/// except an Escape that closed a menu.
final class AWCMenuHostView: NSView {
    weak var registry: AWCMenuRegistry?
    private var monitors: [Any] = []
    override func hitTest(_ point: NSPoint) -> NSView? { nil }
    override func viewDidMoveToWindow() {
        super.viewDidMoveToWindow(); dispose(); guard window != nil else { return }
        monitors.append(NSEvent.addLocalMonitorForEvents(matching: [.leftMouseDown, .rightMouseDown, .leftMouseUp]) { [weak self] event in
            guard let self, event.window === self.window, let registry = self.registry else { return event }
            let p = self.convert(event.locationInWindow, from: nil), flipped = CGPoint(x: p.x, y: self.isFlipped ? p.y : self.bounds.height - p.y)
            if event.type == .leftMouseUp { let t = CACurrentMediaTime() * 1000; DispatchQueue.main.async { registry.click(at: flipped, time: t) } }
            else { registry.pointerModality = true; if event.type == .leftMouseDown { registry.downPoint = flipped } }
            return event
        } as Any)
    }
    override var isFlipped: Bool { true }
    func dispose() { for m in monitors { NSEvent.removeMonitor(m) }; monitors = [] }
}
struct AWCMenuNativeHost: NSViewRepresentable {
    let registry: AWCMenuRegistry
    func makeNSView(context: Context) -> AWCMenuHostView { let v = AWCMenuHostView(); v.registry = registry; return v }
    func updateNSView(_ view: AWCMenuHostView, context: Context) { view.registry = registry }
    static func dismantleNSView(_ view: AWCMenuHostView, coordinator: ()) { view.dispose() }
}
#elseif canImport(UIKit)
/// The document click is timed from the release UIKit delivered (UIEvent.timestamp), not from when the tap action ran.
final class AWCDeliveredTapRecognizer: UITapGestureRecognizer {
    var endedAt = 0.0
    override func touchesEnded(_ touches: Set<UITouch>, with event: UIEvent) { endedAt = event.timestamp * 1000; super.touchesEnded(touches, with: event) }
}
/// 6-6: records the delivered time (UIEvent.timestamp) of every touch-up in the window. Passive: never recognizes,
/// cannot be prevented (a SwiftUI drag on a menu row prevents the tap recognizer, so that one misses row releases).
final class AWCTouchUpRecorder: AWCPassiveTouchRecognizer {
    override func touchesEnded(_ touches: Set<UITouch>, with event: UIEvent) { AWCInputDelivery.lastTouchUpAt = event.timestamp * 1000; finishIfIdle(event) }
    override func touchesCancelled(_ touches: Set<UITouch>, with event: UIEvent) { finishIfIdle(event) }
}
final class AWCMenuHostView: UIView {
    weak var registry: AWCMenuRegistry?
    private var recognizer: UITapGestureRecognizer?
    private var recorder: AWCTouchUpRecorder?
    override func point(inside point: CGPoint, with event: UIEvent?) -> Bool { false }
    override func didMoveToWindow() {
        super.didMoveToWindow()
        if let r = recognizer { r.view?.removeGestureRecognizer(r); recognizer = nil }
        if let u = recorder { u.view?.removeGestureRecognizer(u); recorder = nil }
        guard let window else { return }
        let r = AWCDeliveredTapRecognizer(target: self, action: #selector(tap(_:))); r.cancelsTouchesInView = false; r.delaysTouchesBegan = false
        window.addGestureRecognizer(r); recognizer = r
        let u = AWCTouchUpRecorder(); window.addGestureRecognizer(u); recorder = u
    }
    /// The source's `document` click listener runs after the target's own handler: a tap that opens a menu (and closes its
    /// peers) is seen first by that target, then by the document (deferred to the next turn, as AppKit's mouse-up monitor).
    @objc private func tap(_ r: UITapGestureRecognizer) {
        guard let registry else { return }
        registry.pointerModality = true
        let p = r.location(in: self), t = AWCInputDelivery.time((r as? AWCDeliveredTapRecognizer)?.endedAt)
        DispatchQueue.main.async { [weak registry] in registry?.click(at: p, time: t) }
    }
}
struct AWCMenuNativeHost: UIViewRepresentable {
    let registry: AWCMenuRegistry
    func makeUIView(context: Context) -> AWCMenuHostView { let v = AWCMenuHostView(); v.registry = registry; return v }
    func updateUIView(_ view: AWCMenuHostView, context: Context) { view.registry = registry }
}
#endif
