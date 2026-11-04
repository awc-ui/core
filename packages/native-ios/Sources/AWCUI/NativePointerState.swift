import Observation
import SwiftUI

/// Coordinates supplied by an embedding native host, in the named
/// "awc-native-preview" coordinate space. This carries pointer geometry only;
/// native ButtonStyle.isPressed remains the source of activation/press state.
@Observable
public final class AWCNativePointerState {
    public enum Phase: String, Sendable { case down, move, up, cancel, leave }
    public private(set) var location: CGPoint?
    public private(set) var pressLocation: CGPoint?
    public private(set) var pressSequence = 0
    public private(set) var isPointerDown = false

    public init() {}

    /// Call on the native UI thread alongside the actual scoped native event.
    public func update(phase: Phase, location: CGPoint? = nil) {
        switch phase {
        case .down:
            self.location = location
            pressLocation = location
            pressSequence &+= 1
            isPointerDown = true
        case .move: self.location = location
        case .up: self.location = location; isPointerDown = false
        case .cancel: self.location = nil; isPointerDown = false
        case .leave: self.location = nil
        }
    }
}

private struct AWCNativePointerStateKey: EnvironmentKey {
    static let defaultValue: AWCNativePointerState? = nil
}

public extension EnvironmentValues {
    var awcNativePointerState: AWCNativePointerState? {
        get { self[AWCNativePointerStateKey.self] }
        set { self[AWCNativePointerStateKey.self] = newValue }
    }
}

// Observe AppKit events without installing a competing SwiftUI drag recognizer
// inside ButtonStyle. The Button remains responsible for press and activation.
#if canImport(AppKit)
import AppKit

private final class AWCNativePointerObservationView: NSView {
    var changed: (CGPoint?, Bool) -> Void = { _, _ in }
    private var monitor: Any?
    private var origin: CGPoint?
    override var isFlipped: Bool { true }
    override func hitTest(_ point: NSPoint) -> NSView? { nil }
    override func viewDidMoveToWindow() {
        super.viewDidMoveToWindow()
        stop()
        guard window != nil else { return }
        monitor = NSEvent.addLocalMonitorForEvents(matching: [.leftMouseDown, .leftMouseUp]) { [weak self] event in
            guard let self, event.window === self.window else { return event }
            if event.type == .leftMouseDown {
                let point = self.convert(event.locationInWindow, from: nil)
                if self.bounds.contains(point) { self.origin = point; self.changed(point, true) }
            } else if let origin = self.origin {
                self.origin = nil; self.changed(origin, false)
            }
            return event
        }
    }
    func stop() {
        if let monitor { NSEvent.removeMonitor(monitor); self.monitor = nil }
        origin = nil
    }
}
private struct AWCNativePointerObserver: NSViewRepresentable {
    let changed: (CGPoint?, Bool) -> Void
    func makeNSView(context: Context) -> AWCNativePointerObservationView { .init() }
    func updateNSView(_ view: AWCNativePointerObservationView, context: Context) { view.changed = changed }
    static func dismantleNSView(_ view: AWCNativePointerObservationView, coordinator: ()) { view.stop() }
}
#elseif canImport(UIKit)
import UIKit

/// Passive touch observer: records touches that begin inside the observed view and never recognizes, prevents,
/// cancels or delays anything. A SwiftUI `DragGesture(minimumDistance: 0)` added as a simultaneous gesture inside a
/// ButtonStyle (the previous UIKit implementation) suppresses the Button's own action on iOS 18 and later, so real
/// taps on AWC buttons emitted no events; the window-level recognizer leaves the Button the only activation source.
private final class AWCNativePointerOriginRecognizer: UIGestureRecognizer {
    weak var observed: UIView?
    var changed: (CGPoint?, Bool) -> Void = { _, _ in }
    private var origin: CGPoint?
    private weak var tracked: UITouch?
    override init(target: Any?, action: Selector?) {
        super.init(target: target, action: action)
        cancelsTouchesInView = false; delaysTouchesBegan = false; delaysTouchesEnded = false
    }
    override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent) {
        guard tracked == nil, let observed, let touch = touches.first else { return }
        let point = touch.location(in: observed)
        guard observed.bounds.contains(point) else { return }
        tracked = touch; origin = point; changed(point, true)
    }
    override func touchesEnded(_ touches: Set<UITouch>, with event: UIEvent) { finish(touches, event) }
    override func touchesCancelled(_ touches: Set<UITouch>, with event: UIEvent) { finish(touches, event) }
    private func finish(_ touches: Set<UITouch>, _ event: UIEvent) {
        if let tracked, touches.contains(tracked), let origin { self.tracked = nil; self.origin = nil; changed(origin, false) }
        if event.allTouches?.allSatisfy({ $0.phase == .ended || $0.phase == .cancelled }) ?? true { state = .failed }
    }
    override func reset() { super.reset(); if let origin { self.origin = nil; tracked = nil; changed(origin, false) } }
    override func canPrevent(_ preventedGestureRecognizer: UIGestureRecognizer) -> Bool { false }
    override func canBePrevented(by preventingGestureRecognizer: UIGestureRecognizer) -> Bool { false }
}
private final class AWCNativePointerObservationView: UIView, UIGestureRecognizerDelegate {
    var changed: (CGPoint?, Bool) -> Void = { _, _ in } { didSet { recognizer.changed = changed } }
    private let recognizer = AWCNativePointerOriginRecognizer(target: nil, action: nil)
    override init(frame: CGRect) { super.init(frame: frame); recognizer.observed = self; recognizer.delegate = self; isAccessibilityElement = false }
    required init?(coder: NSCoder) { nil }
    override func point(inside point: CGPoint, with event: UIEvent?) -> Bool { false }
    override func didMoveToWindow() {
        super.didMoveToWindow()
        recognizer.view?.removeGestureRecognizer(recognizer)
        window?.addGestureRecognizer(recognizer)
    }
    func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer, shouldRecognizeSimultaneouslyWith other: UIGestureRecognizer) -> Bool { true }
    func stop() { recognizer.view?.removeGestureRecognizer(recognizer) }
}
private struct AWCNativePointerObserver: UIViewRepresentable {
    let changed: (CGPoint?, Bool) -> Void
    func makeUIView(context: Context) -> AWCNativePointerObservationView { .init(frame: .zero) }
    func updateUIView(_ view: AWCNativePointerObservationView, context: Context) { view.changed = changed }
    static func dismantleUIView(_ view: AWCNativePointerObservationView, coordinator: ()) { view.stop() }
}
#endif

extension View {
    @ViewBuilder func awcObservePointerOrigin(enabled: Bool, changed: @escaping (CGPoint?, Bool) -> Void) -> some View {
        background {
            if enabled { AWCNativePointerObserver(changed: changed).allowsHitTesting(false) }
        }
    }
}
