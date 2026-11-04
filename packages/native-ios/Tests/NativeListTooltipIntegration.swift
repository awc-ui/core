import AppKit
import SwiftUI
import Observation
@testable import AWCUI

// md-list-item truncation tooltips: the headline / supporting-text md-tooltip is enabled only while the text is
// clipped (scroll vs client size in the source), carries the full text as its description, and opens its popup
// on hover through the shared md-tooltip renderer; a row that fits keeps both tooltips disabled.
@Observable final class ListTipState {
    var epoch = 0
    var measurements: [AWCNativeInspectionNode] = []
    let pointer = AWCNativePointerState()
}
struct ListTipFixture: View {
    let state: ListTipState
    static let long = "A very long headline that cannot fit in the available inline size of this row"
    static let longSupporting = "A deliberately long supporting sentence that has to wrap or clamp inside the row before it reaches the end"
    var body: some View {
        let epoch = state.epoch
        return AWCTooltipScope {
            AWCNativeView(node: .init(id: "list", tag: "md-list", properties: ["label": "Tips"], children: [
                .init(id: "t", tag: "md-list-item", properties: ["headline": .string(Self.long), "supportingText": .string(Self.longSupporting)]),
                .init(id: "u", tag: "md-list-item", properties: ["headline": "Fits", "supportingText": "Short"])]))
                .frame(width: 240)
        }
        .environment(\.awcNativePointerState, state.pointer)
        .awcNativeInspection(rootID: "list|t|u|t.headline-tooltip|u.headline-tooltip|t.supporting-tooltip|u.supporting-tooltip", coordinateSpace: "awc-native-preview") { if state.epoch == epoch { state.measurements = $0 } }
        .id(epoch).frame(width: 700, height: 500, alignment: .topLeading)
    }
}
@main @MainActor enum NativeListTooltipIntegration {
    static let state = ListTipState()
    static var host: NSHostingView<ListTipFixture>!, window: NSWindow!
    static var checks = 0, failures: [String] = []
    static func check(_ value: Bool, _ name: String) { checks += 1; if !value { failures.append(name); print("FAIL: " + name); fflush(stdout) } }
    static func pump(_ duration: Double = 0.15) { let end = Date().addingTimeInterval(duration); repeat { while let e = NSApp.nextEvent(matching: .any, until: .distantPast, inMode: .default, dequeue: true) { NSApp.sendEvent(e) }; host.layoutSubtreeIfNeeded(); host.displayIfNeeded(); _ = RunLoop.current.run(mode: .default, before: Date().addingTimeInterval(0.002)) } while Date() < end }
    /// RGB samples on a grid over a box (the popup's measured box exists while hidden; visibility shows as change).
    static func sample(_ box: CGRect?) -> [Double] {
        guard let box, box.width > 0, let rep = host.bitmapImageRepForCachingDisplay(in: host.bounds) else { return [] }
        host.cacheDisplay(in: host.bounds, to: rep)
        let sx = Double(rep.pixelsWide) / host.bounds.width
        var out: [Double] = []
        for i in 0..<12 { for j in 0..<4 {
            let x = box.minX + box.width * (Double(i) + 0.5) / 12, y = box.minY + box.height * (Double(j) + 0.5) / 4
            if let c = rep.colorAt(x: Int(x * sx), y: Int(y * sx))?.usingColorSpace(.sRGB) { out += [c.redComponent, c.greenComponent, c.blueComponent].map { Double($0) * 255 } }
        } }
        return out
    }
    static func change(_ a: [Double], _ b: [Double]) -> Double { a.count == b.count && !a.isEmpty ? zip(a, b).map { abs($0 - $1) }.reduce(0, +) / Double(a.count) : -1 }
    static func node(_ id: String, _ name: String, part: String? = nil) -> AWCNativeInspectionNode? {
        state.measurements.first { $0.id.hasPrefix(id + ":") && $0.name == name && (part == nil || $0.id.contains(":" + part!)) }
    }
    static func main() {
        _ = NSApplication.shared; NSApp.setActivationPolicy(.accessory)
        host = NSHostingView(rootView: ListTipFixture(state: state))
        window = NSWindow(contentRect: .init(x: -20000, y: -20000, width: 700, height: 500), styleMask: [.borderless], backing: .buffered, defer: false)
        window.contentView = host; window.orderFrontRegardless(); pump(0.6)
        let t = node("t", "md-list-item"), u = node("u", "md-list-item")
        check(t?.metrics["headlineTooltip"] == .bool(true), "clipped headline enables its tooltip \(t?.metrics["headlineTooltip"] ?? .null)")
        check(t?.metrics["supportingTooltip"] == .bool(true), "clamped supporting text enables its tooltip \(t?.metrics["supportingTooltip"] ?? .null)")
        check(u?.metrics["headlineTooltip"] == .bool(false) && u?.metrics["supportingTooltip"] == .bool(false), "a row that fits keeps both tooltips disabled")
        let tip = state.measurements.first { $0.id.hasPrefix("t.headline-tooltip:") && $0.name == "md-tooltip" && $0.metrics["description"] != nil }
        check(tip?.metrics["description"] == .string(ListTipFixture.long), "the headline tooltip describes the full text \(tip?.metrics["description"] ?? .null)")
        let fit = state.measurements.first { $0.id.hasPrefix("u.headline-tooltip:") && $0.name == "md-tooltip" && $0.metrics["description"] != nil }
        check(fit?.metrics["description"] == .string(""), "a disabled tooltip has no description \(fit?.metrics["description"] ?? .null)")
        guard let anchor = tip?.bounds else { check(false, "tooltip anchor measured"); finish(); return }
        let box = state.measurements.first { $0.id.hasPrefix("t.headline-tooltip:") && $0.id.contains("popup") }?.bounds
        let closed = sample(box)
        state.pointer.update(phase: .move, location: CGPoint(x: anchor.midX, y: anchor.midY)); pump(1.0)
        check(change(closed, sample(box)) > 25, "hovering the clipped headline opens the md-tooltip popup (mean change \(change(closed, sample(box))))")
        state.pointer.update(phase: .move, location: CGPoint(x: 650, y: 450)); pump(0.8)
        check(change(closed, sample(box)) < 3, "leaving closes it again (mean change \(change(closed, sample(box))))")
        if let ub = node("u", "md-list-item")?.bounds {
            let fitBox = state.measurements.first { $0.id.hasPrefix("u.headline-tooltip:") && $0.id.contains("popup") }?.bounds ?? ub
            let before = sample(fitBox)
            state.pointer.update(phase: .move, location: CGPoint(x: ub.minX + 40, y: ub.midY)); pump(1.0)
            check(change(before, sample(fitBox)) < 3, "hovering a row that fits opens nothing (mean change \(change(before, sample(fitBox))))")
        }
        finish()
    }
    static func finish() {
        print("List native truncation tooltips: \(checks - failures.count)/\(checks) checks passed"); window.close(); if !failures.isEmpty { exit(1) }
    }
}
