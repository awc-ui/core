import SwiftUI

#if canImport(AppKit)
import AppKit
typealias AWCAccordionPlatformView = NSView
#else
import UIKit
typealias AWCAccordionPlatformView = UIView
#endif

private final class AWCAccordionWeakGeometry {
    weak var view: AWCAccordionPlatformView?
    init(_ view: AWCAccordionPlatformView) { self.view = view }
}

/// Actual native bounds, sampled only on pointer-down. Transformed siblings
/// never feed back into the source algorithm's snapshotted drop targets.
final class AWCAccordionPointerRegistry {
    private var views: [String: AWCAccordionWeakGeometry] = [:]
    /// UIKit only: the SwiftUI-reported frame (global space) of each probe; see `AWCAccordionGeometryProbe`.
    private var frames: [String: CGRect] = [:]
    func register(_ view: AWCAccordionPlatformView, id: String) { views[id] = .init(view) }
    func setFrame(_ frame: CGRect, id: String) { frames[id] = frame }
    func remove(_ view: AWCAccordionPlatformView, id: String) {
        if views[id]?.view === view { views.removeValue(forKey: id) }
    }
    func rect(_ id: String) -> CGRect? {
        guard let view = views[id]?.view, let window = view.window else { return nil }
        #if canImport(AppKit)
        guard let root = window.contentView else { return nil }
        let rect = root.convert(view.bounds, from: view)
        return root.isFlipped ? rect : CGRect(x: rect.minX, y: root.bounds.height-rect.maxY, width: rect.width, height: rect.height)
        #else
        return frames[id] ?? view.convert(view.bounds, to: window)
        #endif
    }
}

struct AWCAccordionReorderContext {
    let registry: AWCAccordionPointerRegistry, state: AWCNativeAccordionState, groupID: String
    var motion: AWCAccordionReorderMotion? = nil
    func begin(_ id: String, pointer: Int, point: CGPoint) -> Bool {
        guard let item = state.items.first(where: { $0.id == id }), let host = registry.rect(groupID) else { return false }
        let rects = state.items.compactMap { registry.rect($0.id) }
        guard rects.count == state.items.count else { return false }
        return state.beginReorder(item: item, pointer: pointer, clientY: point.y, hostTop: host.minY,
                                  rects: rects.map { .init(top: $0.minY, height: $0.height) })
    }
}
private struct AWCAccordionReorderContextKey: EnvironmentKey {
    static let defaultValue: AWCAccordionReorderContext? = nil
}
extension EnvironmentValues {
    var awcAccordionReorderContext: AWCAccordionReorderContext? {
        get { self[AWCAccordionReorderContextKey.self] }
        set { self[AWCAccordionReorderContextKey.self] = newValue }
    }
}

#if canImport(AppKit)
final class AWCAccordionGeometryView: NSView {
    override func hitTest(_ point: NSPoint) -> NSView? { nil }
    override func isAccessibilityElement() -> Bool { false }
}
struct AWCAccordionGeometryProbe: NSViewRepresentable {
    let id: String, registry: AWCAccordionPointerRegistry
    func makeNSView(context: Context) -> AWCAccordionGeometryView { .init() }
    func updateNSView(_ view: AWCAccordionGeometryView, context: Context) { registry.register(view,id:id) }
}

final class AWCAccordionReorderPointerView: NSView {
    var context: AWCAccordionReorderContext?, itemID = ""
    /// Grip press in grip-local top-left coordinates (nil on release/cancel): the
    /// grip sits inside the header button, so a grip press is also a header :active.
    var pressed: (CGPoint?) -> Void = { _ in }
    var inert = false { didSet { if inert { cancel() } } }
    private var active = false
    override var acceptsFirstResponder: Bool { false }
    override func isAccessibilityElement() -> Bool { false }
    override func hitTest(_ point: NSPoint) -> NSView? { inert ? nil:super.hitTest(point) }
    private func point(_ event: NSEvent) -> CGPoint {
        guard let root = window?.contentView else { return .zero }
        let p = root.convert(event.locationInWindow, from:nil)
        return .init(x:p.x,y:root.isFlipped ? p.y:root.bounds.height-p.y)
    }
    override func mouseDown(with event: NSEvent) {
        guard !inert else { return }
        let local = convert(event.locationInWindow, from: nil)
        pressed(.init(x: local.x, y: isFlipped ? local.y : bounds.height - local.y)); pressing = true
        active = context?.begin(itemID,pointer:0,point:point(event)) ?? false
        // The source grip consumes clicks even when only one item exists.
    }
    override func mouseDragged(with event: NSEvent) {
        if active { context?.state.moveReorder(pointer:0,clientY:point(event).y) }
    }
    private var pressing = false
    override func mouseUp(with event: NSEvent) {
        if pressing { pressing = false; pressed(nil) }
        guard active else { return }; active = false; context?.state.endReorder(pointer:0)
    }
    func cancel() {
        if pressing { pressing = false; pressed(nil) }
        guard active else { return }; active = false; context?.state.endReorder(pointer:0,cancelled:true)
    }
    override func viewWillMove(toWindow newWindow: NSWindow?) {
        if newWindow == nil { cancel() }; super.viewWillMove(toWindow:newWindow)
    }
}
struct AWCAccordionReorderCapture: NSViewRepresentable {
    let id: String, capture: AWCAccordionReorderContext
    var pressed: (CGPoint?) -> Void = { _ in }
    @Environment(\.awcNativeInert) private var inert
    func makeNSView(context: Context) -> AWCAccordionReorderPointerView { .init() }
    func updateNSView(_ view: AWCAccordionReorderPointerView, context: Context) {
        view.context = capture; view.itemID = id; view.pressed = pressed; view.inert = inert; view.setAccessibilityIdentifier(id+".reorder-pointer")
    }
    static func dismantleNSView(_ view: AWCAccordionReorderPointerView, coordinator: ()) { view.cancel() }
}
#else
final class AWCAccordionGeometryView: UIView {
    override func point(inside point: CGPoint, with event: UIEvent?) -> Bool { false }
}
private struct AWCAccordionGeometryProbeView: UIViewRepresentable {
    let id: String, registry: AWCAccordionPointerRegistry
    func makeUIView(context: Context) -> AWCAccordionGeometryView { .init() }
    func updateUIView(_ view: AWCAccordionGeometryView, context: Context) { view.isAccessibilityElement=false;registry.register(view,id:id) }
}
/// Under a right-to-left layout UIKit places a lifted (z-raised) item's hosted views inside SwiftUI's private
/// container with a mirrored horizontal frame (measured: x -4 for an item drawn at x 40), so the UIKit frame no longer
/// matches what is drawn. The registry therefore uses SwiftUI's own geometry of the probe, in the global (window) space.
struct AWCAccordionGeometryProbe: View {
    let id: String, registry: AWCAccordionPointerRegistry
    var body: some View {
        AWCAccordionGeometryProbeView(id: id, registry: registry)
            .onGeometryChange(for: CGRect.self) { $0.frame(in: .global) } action: { registry.setFrame($0, id: id) }
    }
}
final class AWCAccordionReorderPointerView: UIView {
    var context: AWCAccordionReorderContext?, itemID = ""
    var pressed: (CGPoint?) -> Void = { _ in }
    var inert = false { didSet { if inert { cancel() } } }
    private var active: UITouch?
    private func pointer(_ touch: UITouch) -> Int { ObjectIdentifier(touch).hashValue }
    override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent?) {
        guard !inert, active == nil, let touch = touches.first else { return }
        pressed(touch.location(in: self)); pressing = touch
        if context?.begin(itemID,pointer:pointer(touch),point:touch.location(in:window)) == true { active=touch }
    }
    override func touchesMoved(_ touches: Set<UITouch>, with event: UIEvent?) {
        guard let touch=active,touches.contains(touch) else{return}
        context?.state.moveReorder(pointer:pointer(touch),clientY:touch.location(in:window).y)
    }
    private var pressing: UITouch?
    override func touchesEnded(_ touches: Set<UITouch>, with event: UIEvent?) {
        if let p=pressing,touches.contains(p) {pressing=nil;pressed(nil)}
        guard let touch=active,touches.contains(touch) else{return};active=nil
        context?.state.endReorder(pointer:pointer(touch))
    }
    override func touchesCancelled(_ touches: Set<UITouch>, with event: UIEvent?) { cancel() }
    func cancel() {
        // A cancelled SwiftUI-driven drag ignores the rest of its gesture (UIKit touches end with the cancel).
        if gesturePressing { gestureSuppressed = true; gestureCancelled() }
        if pressing != nil {pressing=nil;pressed(nil)}
        guard let touch=active else{return};active=nil
        context?.state.endReorder(pointer:pointer(touch),cancelled:true)
    }
    override func willMove(toWindow newWindow: UIWindow?) { if newWindow == nil {cancel()};super.willMove(toWindow:newWindow) }
    // SwiftUI path. The grip sits inside the header, whose SwiftUI gestures win SwiftUI's hit test for real touch
    // events (iOS 18+), so UIKit never delivers touchesBegan here: the capture's DragGesture feeds the same sequence.
    private var gesturePressing = false, gestureActive = false, gestureSuppressed = false
    func gestureChanged(_ location: CGPoint, start: CGPoint) {
        guard let window, !gestureSuppressed else { return }
        if !gesturePressing {
            guard !inert, active == nil else { return }
            gesturePressing = true; pressed(start)
            gestureActive = context?.begin(itemID, pointer: 0, point: convert(start, to: window)) == true
            return
        }
        if gestureActive { context?.state.moveReorder(pointer: 0, clientY: convert(location, to: window).y) }
    }
    func gestureEnded() {
        gestureSuppressed = false
        if gesturePressing { gesturePressing = false; pressed(nil) }
        guard gestureActive else { return }; gestureActive = false
        context?.state.endReorder(pointer: 0)
    }
    func gestureCancelled() {
        if gesturePressing { gesturePressing = false; pressed(nil) }
        guard gestureActive else { return }; gestureActive = false
        context?.state.endReorder(pointer: 0, cancelled: true)
    }
}
private final class AWCAccordionReorderViewBox { weak var view: AWCAccordionReorderPointerView? }
private struct AWCAccordionReorderPointerHost: UIViewRepresentable {
    let id: String, capture: AWCAccordionReorderContext, pressed: (CGPoint?) -> Void, inert: Bool, box: AWCAccordionReorderViewBox
    func makeUIView(context: Context) -> AWCAccordionReorderPointerView { let view=AWCAccordionReorderPointerView();view.isExclusiveTouch=true;return view }
    func updateUIView(_ view: AWCAccordionReorderPointerView, context: Context) {
        view.context=capture;view.itemID=id;view.pressed=pressed;view.inert=inert;view.isUserInteractionEnabled = !inert;view.isAccessibilityElement=false;view.accessibilityIdentifier=id+".reorder-pointer"
        box.view = view
    }
    static func dismantleUIView(_ view: AWCAccordionReorderPointerView, coordinator: ()) { view.gestureCancelled(); view.cancel() }
}
struct AWCAccordionReorderCapture: View {
    let id: String, capture: AWCAccordionReorderContext
    var pressed: (CGPoint?) -> Void = { _ in }
    @Environment(\.awcNativeInert) private var inert
    @State private var box = AWCAccordionReorderViewBox()
    var body: some View {
        AWCAccordionReorderPointerHost(id: id, capture: capture, pressed: pressed, inert: inert, box: box)
            .contentShape(Rectangle())
            .highPriorityGesture(DragGesture(minimumDistance: 0, coordinateSpace: .local)
                .onChanged { value in box.view?.gestureChanged(value.location, start: value.startLocation) }
                .onEnded { _ in box.view?.gestureEnded() }, including: inert ? .subviews : .all)
    }
}
#endif
