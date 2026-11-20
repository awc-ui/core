import SwiftUI
import Observation
import QuartzCore
#if canImport(AppKit)
import AppKit
#elseif canImport(UIKit)
import UIKit
#endif

/// Paint order of open modals. `.sourceZIndex` reproduces the source stylesheets: Dialog surface/scrim use
/// `--md-dialog-z-index` / `--md-dialog-scrim-z-index` (near int32 max) while the sheets use 1001/1000, so a dialog
/// paints above a sheet opened on top of it even though the sheet owns focus and keys (measured in Chrome).
/// `.ownerOrder` paints in session order (the last opened owner on top).
public enum AWCModalPaintOrder: Sendable { case sourceZIndex, ownerOrder }

/// One open modal in the owner stack (a port of the source `ModalSession` entry).
final class AWCModalOwner {
    let id: String
    var escape: () -> Bool = { false }
    var tab: (Bool) -> Bool = { _ in false }
    var focusInitial: () -> Void = {}
    var covered: () -> Void = {}
    #if canImport(AppKit)
    weak var opener: NSResponder?
    #elseif canImport(UIKit)
    weak var opener: UIResponder?
    #endif
    init(id: String) { self.id = id }
}

/// The shared modal owner stack and viewport for Dialog, Bottom Sheet and Side Sheet. Only the top owner handles
/// Escape, Tab and scrim dismissal; content under any owner is inert; the opener captured when the first owner
/// opens is restored when the last closes, and a lower owner closing first forwards its opener upward.
@Observable public final class AWCModalSession {
    public internal(set) var viewport: CGSize = .zero
    public internal(set) var safeArea = EdgeInsets()
    public var paintOrder: AWCModalPaintOrder
    private(set) var owners: [String] = []
    @ObservationIgnored var registry: [String: AWCModalOwner] = [:]
    /// Last input modality: programmatic focus after a pointer press is not focus-visible (Chrome `:focus-visible`).
    @ObservationIgnored var lastInputPointer = false
    #if canImport(AppKit)
    @ObservationIgnored weak var window: NSWindow?
    #elseif canImport(UIKit)
    @ObservationIgnored weak var window: UIWindow?
    #endif
    public init(paintOrder: AWCModalPaintOrder = .sourceZIndex) { self.paintOrder = paintOrder }
    var isActive: Bool { !owners.isEmpty }
    func isTop(_ id: String) -> Bool { owners.last == id }
    func index(_ id: String) -> Int? { owners.firstIndex(of: id) }
    func acquire(_ owner: AWCModalOwner) {
        if owners.contains(owner.id) { registry[owner.id] = owner; return }
        let previous = owners.last.flatMap { registry[$0] }
        #if canImport(AppKit)
        owner.opener = window?.firstResponder
        #elseif canImport(UIKit)
        owner.opener = window.flatMap(Self.firstResponder(in:))
        #endif
        registry[owner.id] = owner; owners.append(owner.id)
        previous?.covered()
        DispatchQueue.main.async { [weak self] in
            guard let self, self.isTop(owner.id), self.registry[owner.id] === owner else { return }
            owner.focusInitial()
        }
    }
    func release(_ id: String) {
        guard let index = owners.firstIndex(of: id), let owner = registry[id] else { return }
        owners.remove(at: index); registry[id] = nil
        if index < owners.count {
            // A lower owner closed first: the owner above inherits its opener (the source forwards restoration).
            if let above = registry[owners[index]], owner.opener != nil { above.opener = owner.opener }
        } else {
            restore(owner.opener)
            if let next = owners.last.flatMap({ registry[$0] }) { _ = next }
        }
    }
    #if canImport(AppKit)
    /// Restoration waits for the underlying content to leave the inert state (the next view update), so it is
    /// retried for a few frames; it stops once the opener is first responder or no longer in the window.
    private func restore(_ responder: NSResponder?, attempts: Int = 8) {
        guard let window, let responder else { return }
        if let view = responder as? NSView, view.window !== window { return }
        if window.makeFirstResponder(responder), window.firstResponder === responder { return }
        guard attempts > 0 else { return }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.008) { [weak self] in
            self?.restore(responder, attempts: attempts - 1)
        }
    }
    #elseif canImport(UIKit)
    /// As on AppKit: the opener sits in content that is still inert until the next view update, so restoration is
    /// retried for a few frames; it stops once the opener is first responder or no longer in the window.
    private func restore(_ responder: UIResponder?, attempts: Int = 8) {
        guard let responder else { return }
        if let view = responder as? UIView, view.window == nil || (window != nil && view.window !== window) { return }
        if responder.isFirstResponder || responder.becomeFirstResponder() { return }
        guard attempts > 0 else { return }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.008) { [weak self] in
            self?.restore(responder, attempts: attempts - 1)
        }
    }
    /// UIKit has no `firstResponder` accessor on a window: AWC focus targets are views, so search the hierarchy.
    static func firstResponder(in view: UIView) -> UIResponder? {
        if view.isFirstResponder { return view }
        for subview in view.subviews { if let found = firstResponder(in: subview) { return found } }
        return nil
    }
    #endif
    /// Pressing a non-focusable surface (a protected scrim) blurs focus to the document body in Chrome.
    func blur() {
        #if canImport(AppKit)
        _ = window?.makeFirstResponder(nil)
        #elseif canImport(UIKit)
        _ = window.flatMap(Self.firstResponder(in:))?.resignFirstResponder()
        // Chrome blurs to the document body, which still receives Escape; UIKit delivers key commands only along
        // a first responder's chain, so the open session's host takes that role.
        _ = AWCModalHostView.active(in: window)?.becomeFirstResponder()
        #endif
    }
    /// Focused content inside a modal that handles Escape itself (an open popup: md-color-picker's popover) gets it before the
    /// top owner, as Chrome dispatches keydown to the focused element before the dialog's handler. Each claim returns true
    /// when it consumed the key.
    @ObservationIgnored var escapeClaims: [ObjectIdentifier: () -> Bool] = [:]
    @discardableResult func escape() -> Bool {
        for claim in escapeClaims.values where claim() { return true }
        return owners.last.flatMap { registry[$0] }?.escape() ?? false
    }
    @discardableResult func tab(backward: Bool) -> Bool { owners.last.flatMap { registry[$0] }?.tab(backward) ?? false }
    private func owner(_ entry: String) -> String { entry.split(separator: "#").first.map(String.init) ?? entry }
    /// Ordering key for an entry: the source z-index, or its owner position.
    func paintKey(id: String, zIndex: Double) -> Double {
        switch paintOrder {
        // `<owner>#scrim` is the owner's separately stacked scrim layer.
        case .sourceZIndex: return zIndex + Double(index(owner(id)) ?? -1) * 1e-6
        case .ownerOrder: return Double(index(owner(id)) ?? -1)
        }
    }
}

private struct AWCModalSessionKey: EnvironmentKey { static let defaultValue: AWCModalSession? = nil }
extension EnvironmentValues {
    var awcModalSession: AWCModalSession? {
        get { self[AWCModalSessionKey.self] }
        set { self[AWCModalSessionKey.self] = newValue }
    }
}

struct AWCModalEntry: Identifiable, Equatable {
    let id: String
    let zIndex: Double
    let content: AnyView
    /// Every owner update republishes its entry; AnyView has no equality, so a serial stands in for it.
    let revision: Int
    nonisolated(unsafe) private static var serial = 0
    init(id: String, zIndex: Double, content: AnyView) {
        self.id = id; self.zIndex = zIndex; self.content = content
        AWCModalEntry.serial &+= 1; revision = AWCModalEntry.serial
    }
    static func == (a: AWCModalEntry, b: AWCModalEntry) -> Bool { a.id == b.id && a.zIndex == b.zIndex && a.revision == b.revision }
}
struct AWCModalEntries: PreferenceKey {
    static var defaultValue: [AWCModalEntry] { [] }
    static func reduce(value: inout [AWCModalEntry], nextValue: () -> [AWCModalEntry]) { value.append(contentsOf: nextValue()) }
}

extension Dictionary where Key == String, Value == AWCValue {
    /// A boolean property as a writable projection (`$local[awcBool: "open"]`). The modal owners take their `open` state
    /// this way: a location-based binding is unchanged between updates, while SwiftUI reports `Binding(get:set:)` (closures,
    /// no identity) as changed on every graph update — the owner's body ran again after each delivery of its entries and
    /// republished them several times per frame, and a bound preference is delivered once per frame: a dropped removal
    /// left the closed modal mounted (d2's finding, 2026-11-11).
    subscript(awcBool key: String) -> Bool {
        get { self[key]?.bool ?? false }
        set { self[key] = .bool(newValue) }
    }
}

/// Hosts Dialog, Bottom Sheet and Side Sheet in the application's actual viewport (not platform windows): place it
/// at the content root. Content under an open modal is inert (no hit testing, no keyboard focus, hidden from
/// assistive technology), Escape and Tab route to the top owner, and the viewport/safe areas feed vw/vh, the
/// sheet breakpoints and the dialog limits.
public struct AWCModalScope<Content: View>: View {
    @State private var session: AWCModalSession
    /// The presented entries, kept as state: an `overlayPreferenceValue` overlay's own preferences (the inspection
    /// nodes) stop reaching the ancestors once nothing else in the scope changes, so a removed modal's nodes stayed.
    @State private var entries: [AWCModalEntry] = []
    private let content: Content
    public init(paintOrder: AWCModalPaintOrder = .sourceZIndex, @ViewBuilder content: () -> Content) {
        _session = State(initialValue: AWCModalSession(paintOrder: paintOrder)); self.content = content()
    }
    public init(session: AWCModalSession, @ViewBuilder content: () -> Content) {
        _session = State(initialValue: session); self.content = content()
    }
    public var body: some View {
        let active = session.isActive
        ZStack(alignment: .topLeading) {
            content
                .environment(\.awcNativeInert, active)
                .allowsHitTesting(!active)
                .accessibilityHidden(active)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .environment(\.awcModalSession, session)
        .background {
            GeometryReader { geometry in
                Color.clear
                    .onChange(of: geometry.size, initial: true) { _, size in session.viewport = size }
                    .onChange(of: geometry.safeAreaInsets, initial: true) { _, insets in session.safeArea = insets }
            }.allowsHitTesting(false)
        }
        .background { AWCModalNativeHost(session: session).allowsHitTesting(false) }
        .onPreferenceChange(AWCModalEntries.self) { entries = $0 }
        .overlay(alignment: .topLeading) {
            let ordered = entries.sorted { session.paintKey(id: $0.id, zIndex: $0.zIndex) < session.paintKey(id: $1.id, zIndex: $1.zIndex) }
            ZStack(alignment: .topLeading) {
                ForEach(ordered) { entry in
                    entry.content.frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                        .zIndex(session.paintKey(id: entry.id, zIndex: entry.zIndex))
                }
            }
            .environment(\.awcStackingNested, true)   // components slotted in a modal join the lift chain (r3-19)
        }
        // Tab order: the AWC focus views of the content and of the open modals in document (source) order.
        .modifier(AWCDocumentOrderCollector())
    }
}

#if canImport(AppKit)
final class AWCModalHostView: NSView {
    weak var session: AWCModalSession?
    private var monitor: Any?
    override func hitTest(_ point: NSPoint) -> NSView? { nil }
    override func viewDidMoveToWindow() {
        super.viewDidMoveToWindow(); dispose()
        session?.window = window
        guard window != nil else { return }
        monitor = NSEvent.addLocalMonitorForEvents(matching: [.keyDown, .leftMouseDown, .rightMouseDown]) { [weak self] event in
            guard let self, let session = self.session, event.window === self.window else { return event }
            if event.type != .keyDown { session.lastInputPointer = true; return event }
            session.lastInputPointer = false
            // Tab from the document (no first responder) enters the content in document order (NativeDocumentOrder.swift).
            if !session.isActive, event.keyCode == 48, event.modifierFlags.intersection([.control, .option, .command]).isEmpty, let window = self.window,
               window.firstResponder == nil || window.firstResponder === window {
                return MainActor.assumeIsolated { AWCDocumentTabOrder.enter(in: window, backward: event.modifierFlags.contains(.shift)) } ? nil : event
            }
            guard session.isActive else { return event }
            switch event.keyCode {
            case 53: return session.escape() ? nil : event
            case 48: return session.tab(backward: event.modifierFlags.contains(.shift)) ? nil : event
            default: return event
            }
        }
    }
    func dispose() { if let monitor { NSEvent.removeMonitor(monitor); self.monitor = nil } }
}
struct AWCModalNativeHost: NSViewRepresentable {
    let session: AWCModalSession
    func makeNSView(context: Context) -> AWCModalHostView { let view = AWCModalHostView(); view.session = session; return view }
    func updateNSView(_ view: AWCModalHostView, context: Context) { view.session = session; if session.window == nil { session.window = view.window } }
    static func dismantleNSView(_ view: AWCModalHostView, coordinator: ()) { view.dispose() }
}
/// The modal surface's own focus target (`tabindex=-1` container): focused when no tabbable descendant exists.
final class AWCModalContainerFocusView: NSView {
    var label = ""
    var focusChanged: (Bool) -> Void = { _ in }
    override var acceptsFirstResponder: Bool { window != nil && !isHidden }
    override func becomeFirstResponder() -> Bool { let ok = super.becomeFirstResponder(); if ok { focusChanged(true) }; return ok }
    override func resignFirstResponder() -> Bool { let ok = super.resignFirstResponder(); if ok { focusChanged(false) }; return ok }
    override func hitTest(_ point: NSPoint) -> NSView? { nil }
    override func isAccessibilityElement() -> Bool { true }
    override func accessibilityRole() -> NSAccessibility.Role? { .group }
    override func accessibilityLabel() -> String? { label }
}
struct AWCModalContainerFocus: NSViewRepresentable {
    let id: String, label: String, register: (AWCModalContainerFocusView) -> Void
    var focusChanged: (Bool) -> Void = { _ in }
    func makeNSView(context: Context) -> AWCModalContainerFocusView { AWCModalContainerFocusView() }
    func updateNSView(_ view: AWCModalContainerFocusView, context: Context) { view.label = label; view.setAccessibilityIdentifier(id); view.focusChanged = focusChanged; register(view) }
}
#elseif canImport(UIKit)
final class AWCModalHostView: UIView {
    weak var session: AWCModalSession?
    /// UIKit has no window-level key monitor (AppKit uses one): key commands come from the first responder's
    /// chain, which does not pass through this background view. AWC focus targets therefore route their
    /// `next` responder through the topmost active host in their window (`active(in:)`).
    private static let hosts = NSHashTable<AWCModalHostView>.weakObjects()
    static func active(in window: UIWindow?) -> AWCModalHostView? {
        guard let window else { return nil }
        return hosts.allObjects.last { $0.window === window && $0.session?.isActive == true }
    }
    override func point(inside point: CGPoint, with event: UIEvent?) -> Bool { false }
    /// The stand-in for Chrome's focused document body while a modal is open (see `AWCModalSession.blur()`).
    override var canBecomeFirstResponder: Bool { session?.isActive == true }
    override var keyCommands: [UIKeyCommand]? {
        guard session?.isActive == true else { return [] }
        return [UIKeyCommand(input: UIKeyCommand.inputEscape, modifierFlags: [], action: #selector(escape)),
                UIKeyCommand(input: "\t", modifierFlags: [], action: #selector(tabForward)),
                UIKeyCommand(input: "\t", modifierFlags: .shift, action: #selector(tabBackward))].map { $0.wantsPriorityOverSystemBehavior = true; return $0 }
    }
    override func didMoveToWindow() { super.didMoveToWindow(); session?.window = window; if window != nil { Self.hosts.add(self) } else { Self.hosts.remove(self) } }
    @objc private func escape() { session?.escape() }
    @objc private func tabForward() { session?.tab(backward: false) }
    @objc private func tabBackward() { session?.tab(backward: true) }
}
struct AWCModalNativeHost: UIViewRepresentable {
    let session: AWCModalSession
    func makeUIView(context: Context) -> AWCModalHostView { let view = AWCModalHostView(); view.session = session; return view }
    func updateUIView(_ view: AWCModalHostView, context: Context) { view.session = session }
}
final class AWCModalContainerFocusView: UIView, AWCKeyView {
    var label = ""
    // `tabindex=-1` container: focusable, never a Tab stop; Tab inside the modal is the session's trap.
    var awcAcceptsFirstResponder: Bool { canBecomeFirstResponder }
    var awcCanBecomeKeyView: Bool { false }
    func awcBecomeKeyView() -> Bool { becomeFirstResponder() }
    var focusChanged: (Bool) -> Void = { _ in }
    override var canBecomeFirstResponder: Bool { window != nil && !isHidden }
    override var canBecomeFocused: Bool { true }
    override var next: UIResponder? { AWCModalHostView.active(in: window) ?? super.next }
    // Report focus like the AppKit view so the surface paints its `:focus-visible` container ring.
    override func becomeFirstResponder() -> Bool { let ok = super.becomeFirstResponder(); if ok { focusChanged(true) }; return ok }
    override func resignFirstResponder() -> Bool { let ok = super.resignFirstResponder(); if ok { focusChanged(false) }; return ok }
    // A focus target only (AppKit: hitTest → nil): touches reach the surface beneath it.
    override func point(inside point: CGPoint, with event: UIEvent?) -> Bool { false }
}
struct AWCModalContainerFocus: UIViewRepresentable {
    let id: String, label: String, register: (AWCModalContainerFocusView) -> Void
    var focusChanged: (Bool) -> Void = { _ in }
    func makeUIView(context: Context) -> AWCModalContainerFocusView { let v = AWCModalContainerFocusView(); v.isAccessibilityElement = false; return v }
    func updateUIView(_ view: AWCModalContainerFocusView, context: Context) { view.label = label; view.accessibilityIdentifier = id; view.focusChanged = focusChanged; register(view) }
}
#endif

/// Focus traversal inside one modal surface: AWC controls register in rendered order per region (an
/// `AWCPopupTarget` each); the trap walks regions in source DOM order and wraps in both directions.
@Observable final class AWCModalFocusRegions {
    @ObservationIgnored var regions: [AWCPopupTarget] = []
    @ObservationIgnored var extra: [(region: Int, position: Int, handle: AWCButtonFocusHandle)] = []
    @ObservationIgnored weak var container: AWCModalContainerFocusView?
    init(count: Int) { regions = (0..<count).map { AWCPopupTarget(id: "modal-region-\($0)") } }
    func handles() -> [AWCButtonFocusHandle] {
        var out: [AWCButtonFocusHandle] = []
        for (index, region) in regions.enumerated() {
            let fixed = extra.filter { $0.region == index }.sorted { $0.position < $1.position }
            out += fixed.filter { $0.position < 0 }.map(\.handle)
            out += region.order.compactMap { region.handles[$0] }
            out += fixed.filter { $0.position >= 0 }.map(\.handle)
        }
        return out
    }
    func focusContainer() -> Bool {
        #if canImport(AppKit)
        guard let container, let window = container.window else { return false }
        return window.makeFirstResponder(container)
        #else
        return container?.becomeFirstResponder() ?? false
        #endif
    }
    /// Focus the first tabbable descendant, or the container when there is none.
    func focusFirst(visible: Bool, attempts: Int = 10) {
        for handle in handles() where request(handle, visible: visible) { return }
        // The surface renders in the update after the open change: wait for it (its container view in a window) first;
        // a reopened surface may still reference the previous, detached container view.
        if (container == nil || container?.window == nil || !focusContainer()) && attempts > 0 {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.008) { [weak self] in self?.focusFirst(visible: visible, attempts: attempts - 1) }
            return
        }
    }
    private func request(_ handle: AWCButtonFocusHandle, visible: Bool) -> Bool {
        handle.showFocus = visible
        let ok = handle.requestFocus?() == true
        if ok { handle.showFocus = visible }
        return ok
    }
    /// Tab / Shift+Tab: wrap at the ends; a container without tabbables keeps focus.
    func move(backward: Bool) -> Bool {
        let list = handles()
        guard !list.isEmpty else { _ = focusContainer(); return true }
        let current = list.firstIndex { $0.isFocused }
        var index = current.map { backward ? $0 - 1 : $0 + 1 } ?? (backward ? list.count - 1 : 0)
        if index < 0 { index = list.count - 1 }; if index >= list.count { index = 0 }
        for step in 0..<list.count {
            let candidate = list[(index + (backward ? -step : step) + list.count * 2) % list.count]
            if request(candidate, visible: true) { return true }
        }
        return true
    }
}
