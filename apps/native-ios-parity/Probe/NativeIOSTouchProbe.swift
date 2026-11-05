import AppKit
import SwiftUI
@testable import AWCUI

// Harness self-test (iOS only): in-process touch synthesis reaches SwiftUI DragGesture/onTapGesture,
// UIKit touchesBegan overrides, and AWCUI controls (md-switch toggles through its own gesture path).
@Observable final class TouchProbeState { var drag: [String] = []; var taps = 0; var uikit: [String] = []; var events: [String] = []; var eventTimes: [Double] = [] }
final class TouchProbeUIView: UIView {
    var log: (String) -> Void = { _ in }
    override func touchesBegan(_ t: Set<UITouch>, with e: UIEvent?) { log("began \(Int(t.first!.location(in: self).x))") }
    override func touchesMoved(_ t: Set<UITouch>, with e: UIEvent?) { log("moved \(Int(t.first!.location(in: self).x))") }
    override func touchesEnded(_ t: Set<UITouch>, with e: UIEvent?) { log("ended \(Int(t.first!.location(in: self).x))") }
}
struct TouchProbeUIKit: UIViewRepresentable {
    let state: TouchProbeState
    func makeUIView(context: Context) -> TouchProbeUIView { let v = TouchProbeUIView(); v.backgroundColor = .systemTeal; v.log = { state.uikit.append($0) }; return v }
    func updateUIView(_ v: TouchProbeUIView, context: Context) {}
}
struct TouchProbeView: View {
    let state: TouchProbeState
    var body: some View {
        ZStack(alignment: .topLeading) {
            Color.white
            Rectangle().fill(.orange).frame(width: 120, height: 60)
                .gesture(DragGesture(minimumDistance: 0).onChanged { state.drag.append("changed \(Int($0.location.x))") }.onEnded { state.drag.append("ended \(Int($0.location.x))") })
                .offset(x: 20, y: 20)
            Rectangle().fill(.purple).frame(width: 60, height: 60).onTapGesture { state.taps += 1 }.offset(x: 200, y: 20)
            TouchProbeUIKit(state: state).frame(width: 120, height: 60).offset(x: 20, y: 120)
            AWCNativeView(node: .init(id: "switch", tag: "md-switch")) { e in state.events.append(e.name); state.eventTimes.append(CACurrentMediaTime()) }.offset(x: 20, y: 220)
            Rectangle().fill(.green).frame(width: 60, height: 60).onTapGesture { state.taps += 100 }.offset(x: 500, y: 20)
        }.frame(width: 600, height: 400, alignment: .topLeading)
    }
}
@main @MainActor enum NativeIOSTouchProbe {
    static let state = TouchProbeState()
    static var host: NSHostingView<TouchProbeView>!, window: NSWindow!
    static func pump(_ d: Double = 0.1) { let end = Date().addingTimeInterval(d); repeat { host.layoutSubtreeIfNeeded(); host.displayIfNeeded(); _ = RunLoop.current.run(mode: .default, before: Date().addingTimeInterval(0.002)) } while Date() < end }
    static func mouse(_ kind: NSEvent.EventType, _ p: CGPoint) { let point = host.convert(p, to: nil); NSApp.sendEvent(NSEvent.mouseEvent(with: kind, location: point, modifierFlags: [], timestamp: ProcessInfo.processInfo.systemUptime, windowNumber: window.windowNumber, context: nil, eventNumber: 1, clickCount: 1, pressure: 1)!) }
    static func drag(_ from: CGPoint, _ to: CGPoint, steps: Int = 6) {
        mouse(.leftMouseDown, from); pump(0.05)
        for i in 1...steps { let f = Double(i) / Double(steps); mouse(.leftMouseDragged, .init(x: from.x + (to.x - from.x) * f, y: from.y + (to.y - from.y) * f)); pump(0.02) }
        mouse(.leftMouseUp, to); pump(0.15)
    }
    static func sequenceAll(_ v: UIView) -> [UIView] { [v] + v.subviews.flatMap(sequenceAll) }
    static func main() {
        _ = NSApplication.shared; NSApp.setActivationPolicy(.accessory)
        host = NSHostingView(rootView: TouchProbeView(state: state))
        window = NSWindow(contentRect: .init(x: -20000, y: -20000, width: 600, height: 400), styleMask: [.borderless], backing: .buffered, defer: false)
        window.contentView = host; window.orderFrontRegardless(); pump(0.5)
        print("TOUCH synth available=\(AWCTouchSynth.available) hid=\(AWCTouchSynth.hidAvailable)")
        for mode in ["hid", "kif"] {
        AWCTouchSynth.mode = mode; state.drag = []; state.taps = 0; state.uikit = []; state.events = []
        print("TOUCH mode=\(mode)")
        drag(.init(x: 30, y: 50), .init(x: 120, y: 50)); print("TOUCH swiftui drag: \(state.drag.count) events first=\(state.drag.first ?? "-") last=\(state.drag.last ?? "-")")
        drag(.init(x: 230, y: 50), .init(x: 230, y: 50), steps: 1); print("TOUCH swiftui tap: taps=\(state.taps)")
        drag(.init(x: 30, y: 150), .init(x: 110, y: 150), steps: 4); print("TOUCH uikit: \(state.uikit.joined(separator: ","))")
        let before = state.events.count
        drag(.init(x: 46, y: 236), .init(x: 46, y: 236), steps: 1); pump(0.3); print("TOUCH md-switch tap events: \(state.events.dropFirst(before).joined(separator: ","))")
        drag(.init(x: 530, y: 50), .init(x: 530, y: 50), steps: 1); print("TOUCH offscreen tap (x=530 > screen width): taps=\(state.taps)")
        let ok = state.drag.count >= 3 && state.taps == 101 && state.uikit.contains { $0.hasPrefix("began") } && state.uikit.contains { $0.hasPrefix("ended") }
        if mode == "hid" {
            // Keyboard: focus the switch, Space toggles it; Tab moves focus.
            let fv = sequenceAll(host).compactMap { $0 as? AWCNativeButtonFocusView }.first
            let focused = fv?.requestNativeFocus() ?? false; pump(0.2)
            let k0 = state.events.count
            let sent = CACurrentMediaTime()
            NSApp.sendEvent(NSEvent.keyEvent(with: .keyDown, location: .zero, modifierFlags: [], timestamp: 0, windowNumber: 1, context: nil, characters: " ", charactersIgnoringModifiers: " ", isARepeat: false, keyCode: 49)!); pump(0.4)
            print("TOUCH key latency ms: \(state.eventTimes.dropFirst(k0).map { Int(($0 - sent) * 1000) })")
            let k2 = state.events.count, sent2 = CACurrentMediaTime()
            NSApp.sendEvent(NSEvent.keyEvent(with: .keyDown, location: .zero, modifierFlags: [], timestamp: 0, windowNumber: 1, context: nil, characters: " ", charactersIgnoringModifiers: " ", isARepeat: false, keyCode: 49)!); pump(0.4)
            print("TOUCH second key latency ms: \(state.eventTimes.dropFirst(k2).map { Int(($0 - sent2) * 1000) })")
            let k1 = state.events.count, tsent = CACurrentMediaTime()
            mouse(.leftMouseDown, .init(x: 46, y: 236)); pump(0.03); mouse(.leftMouseUp, .init(x: 46, y: 236)); let tup = CACurrentMediaTime(); pump(0.3)
            print("TOUCH tap latency ms from down/up: \(state.eventTimes.dropFirst(k1).map { "\(Int(($0 - tsent) * 1000))/\(Int(($0 - tup) * 1000))" })")
            print("TOUCH key: focused=\(focused) firstResponder=\(String(describing: window.firstResponder.map { type(of: $0) })) space events: \(state.events.dropFirst(k0).joined(separator: ","))")
        }
        print("Touch probe \(mode): \(ok ? "PASS" : "FAIL")")
        }
        window.close()
    }
}
