import SwiftUI

/// The press of an AWC control as the platform's raw input reports it (iOS: the UIKit touch, see `AWCTouchPressRouter`).
/// macOS never sets it: AppKit delivers mouse events synchronously and SwiftUI's Button press is already immediate there.
@Observable final class AWCTouchPressState {
    private(set) var isDown = false
    private(set) var origin: CGPoint?
    /// The router owns the current touch: the control's press is `isDown` alone. SwiftUI's own (late) report of the same
    /// touch is ignored until it settles, so it cannot press the control a second time after the release.
    private(set) var ownsTouch = false
    @ObservationIgnored private var completedAt: CFTimeInterval = -1
    @ObservationIgnored private var generation = 0
    func begin(at point: CGPoint) { generation &+= 1; origin = point; isDown = true; ownsTouch = true; completedAt = -1 }
    func end(completed: Bool) {
        isDown = false
        guard completed else { ownsTouch = false; return }
        completedAt = CACurrentMediaTime()
        let current = generation
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) { [weak self] in
            guard let self, self.generation == current, !self.isDown else { return }
            self.ownsTouch = false
        }
    }
    /// SwiftUI's report of the touch ended (its isPressed is false again).
    func swiftUIReleased() { if !isDown && ownsTouch { ownsTouch = false } }
    /// True once, for the SwiftUI Button action of the touch the router already completed (it follows within the same
    /// update, < 2 ms after the touch-up: probe `NativeIOSTouchBridgeProbe`).
    func consumeCompletedTouch() -> Bool {
        guard completedAt >= 0, CACurrentMediaTime() - completedAt < 0.1 else { return false }
        completedAt = -1; return true
    }
}

extension ButtonStyleConfiguration {
    /// The control's press: the raw touch while `AWCTouchPressRouter` owns it (iOS), SwiftUI's isPressed otherwise.
    func awcPressed(_ touch: AWCTouchPressState?) -> Bool {
        guard let touch else { return isPressed }
        return touch.ownsTouch ? touch.isDown : isPressed || touch.isDown
    }
}

private struct AWCTouchPressKey: EnvironmentKey { static let defaultValue: AWCTouchPressState? = nil }
extension EnvironmentValues {
    var awcTouchPress: AWCTouchPressState? { get { self[AWCTouchPressKey.self] } set { self[AWCTouchPressKey.self] = newValue } }
}

/// Raw-touch callbacks of a focus bridge (`AWCNativeFocusConfiguration.touchPress`).
struct AWCTouchPressHandler {
    /// Touch down on the control (point in the control's coordinates). False: the control takes no press (hard-disabled).
    var began: (CGPoint) -> Bool
    /// Touch up; `inside`: the touch ended inside the control (Chrome's click: pointerup on the pressed element).
    var ended: (_ inside: Bool) -> Void
    /// The touch left the router (moved beyond the slop, claimed by a scroll view, cancelled).
    var cancelled: () -> Void
}

#if canImport(UIKit) && !canImport(AppKit)
import UIKit

/// iOS raw-touch press path of AWC tappables (`AWCNativeActionControl`: md-button, icon button, FAB, FAB menu item,
/// segmented and split button, and with them every sheet / dialog / menu trigger built from them).
///
/// SwiftUI reports a Button's press late on iOS 18: `ButtonStyle.Configuration.isPressed` arrives one display frame after
/// UIKit delivers the touch for a plain Button, and an AWC button held still reports it only at touch-up (harness probe
/// `NativeIOSTouchBridgeProbe`; button states timeline on iOS 18.6), so focus on press, `:active` and the press ripple
/// started late or not at all during a hold; iOS 26 reports it in the same update. The router takes press and click
/// from the touch itself, synchronously inside `UIApplication.sendEvent`, as Chrome does from pointerdown / pointerup.
/// It is one passive recognizer per window that never recognizes, delays, prevents or cancels anything, so SwiftUI keeps
/// its own gestures; the SwiftUI Button action of a touch the router completed is skipped.
///
/// Target: the AWC focus bridges stacked under the touch (their `point(inside:)` answers only during this probe); a bridge
/// nested inside the frontmost one (an md-button in an md-card) wins. SwiftUI content above a control (a scrim, a label)
/// is visible to the probe only where SwiftUI renders it into UIKit views of its own (iOS 18); when the probe falls
/// through to the hosting view (iOS 26) occlusion cannot be decided in UIKit and the touch stays SwiftUI's, whose press is
/// synchronous there. A touch that moves beyond `slop` or that a scroll view claims returns to SwiftUI as well.
final class AWCTouchPressRouter: UIGestureRecognizer, UIGestureRecognizerDelegate {
    private(set) static var probing = false
    private static var excluded = Set<ObjectIdentifier>()
    static let slop: CGFloat = 10
    static func install(in window: UIWindow) {
        guard !(window.gestureRecognizers ?? []).contains(where: { $0 is AWCTouchPressRouter }) else { return }
        let router = AWCTouchPressRouter(target: nil, action: nil)
        router.delegate = router; router.cancelsTouchesInView = false; router.delaysTouchesBegan = false; router.delaysTouchesEnded = false
        window.addGestureRecognizer(router)
    }
    /// A focus bridge answers `point(inside:)` only while the router probes for a touch target.
    static func probes(_ view: UIView) -> Bool { probing && !excluded.contains(ObjectIdentifier(view)) }

    /// The bridge that takes a touch at `point` (window coordinates); nil leaves the touch to SwiftUI.
    static func target(at point: CGPoint, in window: UIWindow) -> AWCNativeButtonFocusView? {
        probing = true; excluded = []
        defer { probing = false; excluded = [] }
        var chain: [AWCNativeButtonFocusView] = [], terminal: UIView?
        while chain.count < 16, let hit = window.hitTest(point, with: nil) {
            guard let bridge = hit as? AWCNativeButtonFocusView else { terminal = hit; break }
            chain.append(bridge); excluded.insert(ObjectIdentifier(bridge))
        }
        guard var target = chain.first else { return nil }
        for inner in chain.dropFirst() {
            guard target.convert(target.bounds, to: window).insetBy(dx: -0.5, dy: -0.5).contains(inner.convert(inner.bounds, to: window)) else { break }
            target = inner
        }
        guard let terminal, !target.isDescendant(of: terminal), let configuration = target.configuration, !configuration.inert,
              configuration.touchPress != nil else { return nil }
        return target
    }

    private weak var touch: UITouch?
    private weak var target: AWCNativeButtonFocusView?
    private var start = CGPoint.zero
    func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer, shouldRecognizeSimultaneouslyWith other: UIGestureRecognizer) -> Bool { true }
    override func canPrevent(_ preventedGestureRecognizer: UIGestureRecognizer) -> Bool { false }
    override func canBePrevented(by preventingGestureRecognizer: UIGestureRecognizer) -> Bool { false }
    override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent) {
        guard touch == nil, let window = view as? UIWindow, let first = touches.first, event.allTouches?.count == 1 else { return }
        let point = first.location(in: window)
        guard let target = Self.target(at: point, in: window), target.configuration?.touchPress?.began(first.location(in: target)) == true else { return }
        touch = first; self.target = target; start = point
    }
    override func touchesMoved(_ touches: Set<UITouch>, with event: UIEvent) {
        guard let touch, touches.contains(touch), let window = view as? UIWindow else { return }
        let point = touch.location(in: window)
        if hypot(point.x - start.x, point.y - start.y) > Self.slop || Self.scrolling(touch) { leave() }
    }
    override func touchesEnded(_ touches: Set<UITouch>, with event: UIEvent) {
        if let touch, touches.contains(touch) {
            if Self.scrolling(touch) { leave() }
            else {
                let handler = target?.configuration?.touchPress, inside = target.map { $0.bounds.contains(touch.location(in: $0)) } ?? false
                self.touch = nil; target = nil
                handler?.ended(inside)
            }
        }
        finishIfIdle(event)
    }
    override func touchesCancelled(_ touches: Set<UITouch>, with event: UIEvent) {
        if let touch, touches.contains(touch) { leave() }
        finishIfIdle(event)
    }
    override func reset() { super.reset(); if touch != nil { leave() } }
    private func leave() { let handler = target?.configuration?.touchPress; touch = nil; target = nil; handler?.cancelled() }
    private func finishIfIdle(_ event: UIEvent) {
        if event.allTouches?.allSatisfy({ $0.phase == .ended || $0.phase == .cancelled }) ?? true { state = .failed }
    }
    private static func scrolling(_ touch: UITouch) -> Bool {
        touch.gestureRecognizers?.contains { $0 is UIPanGestureRecognizer && $0.view is UIScrollView && [.began, .changed, .ended].contains($0.state) } ?? false
    }
}
#endif
