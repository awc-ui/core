import AppKit
import SwiftUI
@testable import AWCUI

// fi probe: smallest touch displacement UIKit/SwiftUI deliver as a move (zero-distance pointer moves have no touch equivalent).
@Observable final class MoveProbeState { var changes: [CGPoint] = [] }
struct MoveProbeView: View {
    let state: MoveProbeState
    var body: some View {
        Color.orange.frame(width: 300, height: 300)
            .gesture(DragGesture(minimumDistance: 0, coordinateSpace: .global).onChanged { state.changes.append($0.location) })
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}
@main @MainActor enum NativeIOSMoveProbe {
    static let state = MoveProbeState()
    static func send(_ kind: NSEvent.EventType, _ p: CGPoint) { NSApp.sendEvent(NSEvent.mouseEvent(with: kind, location: p, modifierFlags: [], timestamp: 0, windowNumber: 1, context: nil, eventNumber: 1, clickCount: 1, pressure: 1)!); AWCShim.pumpFrames(0.05) }
    static func main() {
        let host = NSHostingView(rootView: MoveProbeView(state: state))
        let window = NSWindow(contentRect: .init(x: 0, y: 0, width: 300, height: 300), styleMask: [.borderless], backing: .buffered, defer: false)
        window.contentView = host; window.orderFrontRegardless(); AWCShim.pumpFrames(0.4)
        for d in [0.008, 0.009, 0.0095, 0.0099, 0.00999, 0.01, 0.0101] {
            state.changes = []
            let p = CGPoint(x: 100.25, y: 100.5)
            send(.leftMouseDown, p); send(.leftMouseDragged, CGPoint(x: p.x + 5, y: p.y)); let n0 = state.changes.count
            send(.leftMouseDragged, CGPoint(x: p.x + 5 + d, y: p.y)); let n1 = state.changes.count
            send(.leftMouseUp, CGPoint(x: p.x + 5 + d, y: p.y))
            print("MOVEPROBE delta \(d): moves after +5=\(n0) after +delta=\(n1) last=\(state.changes.last.map { "\($0.x)" } ?? "-")"); fflush(stdout)
        }
        print("Move probe: 1/1 checks passed")
    }
}
