import AppKit
import SwiftUI
import AWCUI

/// Stuck-state probe for closure-based `open` bindings handed to a view that publishes preferences (story 6-4).
/// A sheet owner inside AWCPreviewScope is opened and closed 20 times by property updates; after every close the
/// preview surface must shrink back (no presentation left mounted), after every open it must grow.
final class StuckModel: ObservableObject { @Published var open = false }
struct StuckHost: View {
    @ObservedObject var model: StuckModel
    let tag: String
    var body: some View {
        AWCPreviewScope { AWCNativeView(tag: tag, properties: ["open": .bool(model.open), "label": "Stuck probe"]) }.frame(width: 640)
    }
}
@main @MainActor enum NativeBindingStuckProbe {
    static var checks = 0
    static func check(_ valid: Bool, _ message: String) { checks += 1; precondition(valid, message) }
    static func pump() {
        let end = Date().addingTimeInterval(0.25)
        while Date() < end {
            while let event = NSApp.nextEvent(matching: .any, until: .distantPast, inMode: .default, dequeue: true) { NSApp.sendEvent(event) }
            _ = RunLoop.current.run(mode: .default, before: Date().addingTimeInterval(0.01))
        }
    }
    static func main() {
        _ = NSApplication.shared; NSApp.setActivationPolicy(.accessory)
        for tag in ["md-dialog", "md-bottom-sheet", "md-side-sheet"] {
            let model = StuckModel()
            let host = NSHostingView(rootView: StuckHost(model: model, tag: tag))
            let window = NSWindow(contentRect: NSRect(x: -20000, y: -20000, width: 640, height: 688), styleMask: .borderless, backing: .buffered, defer: false)
            window.isReleasedWhenClosed = false; window.contentView = host; window.orderBack(nil)
            pump(); host.layoutSubtreeIfNeeded()
            let closedHeight = host.fittingSize.height
            for cycle in 1...20 {
                model.open = true; pump(); host.layoutSubtreeIfNeeded()
                check(host.fittingSize.height >= 640, "\(tag) cycle \(cycle): open must size the surface (\(host.fittingSize.height))")
                model.open = false; pump(); host.layoutSubtreeIfNeeded()
                check(host.fittingSize.height <= closedHeight + 1, "\(tag) cycle \(cycle): close left the presentation mounted (\(host.fittingSize.height) vs \(closedHeight))")
            }
            window.close(); pump()
        }
        print("Passed \(checks) binding stuck-state checks.")
    }
}
