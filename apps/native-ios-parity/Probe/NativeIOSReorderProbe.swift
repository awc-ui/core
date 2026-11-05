import AppKit
import SwiftUI
import Observation
import ObjectiveC
@testable import AWCUI

// Diagnoses touch delivery to the accordion reorder grip: logs UIKit touch callbacks on the grip view
// (swizzled), gesture recognizers that leave .possible, and whether the drop placeholder is measured.
@Observable final class ReorderProbeState { var node = AWCNode(id: "accordion", tag: "md-accordion"); var epoch = 0; var top = 460.0; var measurements: [AWCNativeInspectionNode] = [] }
struct ReorderProbeView: View {
    let state: ReorderProbeState
    var body: some View {
        let epoch = state.epoch, theme = AWCTheme.generated(dark: false)
        AWCNativeAccordionGroup(node: state.node, theme: theme, onEvent: { _ in })
            .environment(\.awcAccordionReducedMotion, true).awcTheme(theme).frame(width: 400)
            .awcNativeInspection(rootID: "accordion", coordinateSpace: "probe") { if state.epoch == epoch { state.measurements = $0 } }
            .id(epoch).padding(.leading, 40).padding(.top, state.top).frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .background(theme.background).coordinateSpace(name: "probe")
    }
}
@main @MainActor enum NativeIOSReorderProbe {
    static let state = ReorderProbeState()
    static var host: NSHostingView<ReorderProbeView>!, window: NSWindow!
    static func pump(_ d: Double = 0.1) { let end = Date().addingTimeInterval(d); repeat { host.layoutSubtreeIfNeeded(); _ = RunLoop.current.run(mode: .default, before: Date().addingTimeInterval(0.002)) } while Date() < end }
    static func all(_ v: UIView) -> [UIView] { [v] + v.subviews.flatMap(all) }
    static func mouse(_ kind: NSEvent.EventType, _ p: CGPoint) { NSApp.sendEvent(NSEvent.mouseEvent(with: kind, location: host.convert(p, to: nil), modifierFlags: [], timestamp: 0, windowNumber: 1, context: nil, eventNumber: 1, clickCount: 1, pressure: 1)!) }
    static func swizzle(_ cls: AnyClass, _ name: String) {
        let sel = NSSelectorFromString(name)
        guard let m = class_getInstanceMethod(cls, sel) else { print("REORDER no method \(name)"); return }
        typealias F = @convention(c) (AnyObject, Selector, NSSet, UIEvent?) -> Void
        let original = unsafeBitCast(method_getImplementation(m), to: F.self)
        let block: @convention(block) (AnyObject, NSSet, UIEvent?) -> Void = { obj, touches, event in
            print("REORDER \(name) \(type(of: obj)) \((obj as? UIView)?.accessibilityIdentifier ?? "")"); fflush(stdout)
            original(obj, sel, touches, event)
        }
        method_setImplementation(m, imp_implementationWithBlock(block))
    }
    static func swizzleHitTest(_ cls: AnyClass) {
        let sel = NSSelectorFromString("hitTest:withEvent:")
        guard let m = class_getInstanceMethod(cls, sel) else { return }
        typealias F = @convention(c) (AnyObject, Selector, CGPoint, UIEvent?) -> UIView?
        let original = unsafeBitCast(method_getImplementation(m), to: F.self)
        let block: @convention(block) (AnyObject, CGPoint, UIEvent?) -> UIView? = { obj, p, e in
            let r = original(obj, sel, p, e)
            if e != nil { print("REORDER hitTest \(type(of: obj)) at \(p) event=\(e!.type.rawValue) -> \(r.map { "\(type(of: $0)) \($0.accessibilityIdentifier ?? "")" } ?? "nil")"); fflush(stdout) }
            return r
        }
        method_setImplementation(m, imp_implementationWithBlock(block))
    }
    static func recognizers() -> String {
        all(window).flatMap { v in (v.gestureRecognizers ?? []).map { (v, $0) } }.filter { $0.1.state != .possible }
            .map { "\(type(of: $0.1))@\(type(of: $0.0)) state=\($0.1.state.rawValue) cancels=\($0.1.cancelsTouchesInView)" }.joined(separator: "; ")
    }
    static func main() {
        _ = NSApplication.shared
        host = NSHostingView(rootView: ReorderProbeView(state: state))
        window = NSWindow(contentRect: .init(x: -20000, y: -20000, width: 600, height: 800), styleMask: [.borderless], backing: .buffered, defer: false)
        window.contentView = host; window.orderFrontRegardless(); pump(0.3)
        for name in ["touchesBegan:withEvent:", "touchesMoved:withEvent:", "touchesEnded:withEvent:", "touchesCancelled:withEvent:"] { swizzle(AWCAccordionReorderPointerView.self, name) }
        swizzle(UIView.self, "touchesBegan:withEvent:"); swizzle(UIView.self, "touchesCancelled:withEvent:")
        swizzleHitTest(type(of: host.controller.view!)); swizzleHitTest(NSWindow.self)
        state.node = .init(id: "accordion", tag: "md-accordion", properties: ["reorderable": true, "transition": "none", "variant": "filled"], children: ["a", "b", "c"].map { .init(id: $0, tag: "md-accordion-item", properties: ["headline": .string($0)], children: [.text("Body")]) })
        for top in [60.0, 460.0] {
        state.top = top; state.epoch += 1; pump(0.4)
        print("REORDER top=\(top)")
        guard let grip = all(host).compactMap({ $0 as? AWCAccordionReorderPointerView }).first(where: { $0.accessibilityIdentifier == "c.reorder-pointer" }) else { print("REORDER no grip"); return }
        let g = host.convert(grip.bounds, from: grip), p = CGPoint(x: g.midX, y: g.midY)
        print("REORDER grip \(g) gestures on grip: \(grip.gestureRecognizers?.count ?? 0) exclusive=\(grip.isExclusiveTouch) interaction=\(grip.isUserInteractionEnabled)")
        var chain: [UIView] = []; var v: UIView? = grip; while let x = v { chain.append(x); v = x.superview }
        print("REORDER ancestor recognizers: " + chain.flatMap { view in (view.gestureRecognizers ?? []).map { "\(type(of: $0))@\(type(of: view)) delaysBegan=\($0.delaysTouchesBegan) cancels=\($0.cancelsTouchesInView) enabled=\($0.isEnabled)" } }.joined(separator: "; "))
        mouse(.leftMouseDown, p); pump(0.05); print("REORDER after down: recognizers [\(recognizers())] placeholder=\(state.measurements.contains { $0.name == "drop-placeholder" })")
        mouse(.leftMouseDragged, .init(x: p.x, y: p.y - 30)); pump(0.05); print("REORDER after move1: recognizers [\(recognizers())] placeholder=\(state.measurements.contains { $0.name == "drop-placeholder" })")
        mouse(.leftMouseDragged, .init(x: p.x, y: max(20, p.y - 330))); pump(0.4); print("REORDER after move2: recognizers [\(recognizers())] placeholder=\(state.measurements.contains { $0.name == "drop-placeholder" }) names=\(Set(state.measurements.map(\.name)).sorted().prefix(30))")
        mouse(.leftMouseUp, .init(x: p.x, y: max(20, p.y - 330))); pump(0.2)
        }
        // Raw delivery check at the same height: a plain UIView placed under the grip position.
        let probe = UIView(frame: CGRect(x: 300, y: 600, width: 80, height: 80)); probe.backgroundColor = .red; host.addSubview(probe)
        pump(0.1); mouse(.leftMouseDown, .init(x: 340, y: 640)); pump(0.05); mouse(.leftMouseUp, .init(x: 340, y: 640)); pump(0.1)
        print("REORDER plain view at y=640 done (look for touchesBegan UIView line)")
        print("Reorder probe: done")
    }
}
