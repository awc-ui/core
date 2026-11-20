import AppKit
import SwiftUI
import Observation
@testable import AWCUI

// Native replay of the Chrome stacking oracle (Fixtures/stacking-web.json from d3-lab/web2/stacking.mjs; gate-7 r3-19)
// through the production AWCNativeView dispatch: a floating md-accordion declared in an earlier container paints over the
// container that follows it, a dragged md-card paints over the container that follows its own, and the keyboard and
// accessibility orders stay those of the document. The authored tree is the oracle's page (div containers).
@Observable final class StackingState {
    var node = AWCNode(id: "page", tag: "div")
    var epoch = 0
    var root = "acc"
    var measurements: [AWCNativeInspectionNode] = []
}
struct StackingFixture: View {
    @Bindable var state: StackingState
    var body: some View {
        let epoch = state.epoch
        AWCNativeView(node: state.node)
            .awcNativeInspection(rootID: state.root, coordinateSpace: "awc-native-preview") { if state.epoch == epoch { state.measurements = $0 } }
            .id(epoch)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .awcAccordionViewport()
            .awcTheme(AWCTheme.generated(dark: false))
            .background(Color.white).coordinateSpace(name: "awc-native-preview")
    }
}
@main @MainActor enum NativeStackingIntegration {
    static let state = StackingState()
    static var host: NSHostingView<StackingFixture>!, window: NSWindow!
    static var checks = 0, failures: [String] = []
    static func check(_ value: Bool, _ name: String) { checks += 1; if !value { failures.append(name); print("FAIL: " + name); fflush(stdout) } }
    static func pump(_ duration: Double = 0.12) { let end = Date().addingTimeInterval(duration); repeat { while let e = NSApp.nextEvent(matching: .any, until: .distantPast, inMode: .default, dequeue: true) { NSApp.sendEvent(e) }; host.layoutSubtreeIfNeeded(); host.displayIfNeeded(); _ = RunLoop.current.run(mode: .default, before: Date().addingTimeInterval(0.002)) } while Date() < end }
    static func mouse(_ kind: NSEvent.EventType, _ p: CGPoint) { let point = host.convert(.init(x: p.x, y: host.isFlipped ? p.y : host.bounds.height - p.y), to: nil); let e = NSEvent.mouseEvent(with: kind, location: point, modifierFlags: [], timestamp: ProcessInfo.processInfo.systemUptime, windowNumber: window.windowNumber, context: nil, eventNumber: 1, clickCount: 1, pressure: kind == .leftMouseUp ? 0 : 1)!; window.sendEvent(e); pump(0.03) }
    static func tab() { let e = NSEvent.keyEvent(with: .keyDown, location: .zero, modifierFlags: [], timestamp: ProcessInfo.processInfo.systemUptime, windowNumber: window.windowNumber, context: nil, characters: "\t", charactersIgnoringModifiers: "\t", isARepeat: false, keyCode: 48)!; window.sendEvent(e); pump(0.15) }
    static func all(_ v: NSView) -> [NSView] { [v] + v.subviews.flatMap(all) }
    static func focusView(_ id: String) -> AWCNativeButtonFocusView? { all(host).compactMap { $0 as? AWCNativeButtonFocusView }.first { $0.accessibilityIdentifier() == id } }
    static func focusedID() -> String { (window.firstResponder as? AWCNativeButtonFocusView)?.accessibilityIdentifier() ?? "body" }
    #if canImport(AppKit)
    static func elements(_ e: AnyObject) -> [AnyObject] { [e] + ((e.accessibilityChildren?() ?? []).map { $0 as AnyObject }).flatMap(elements) }
    static func ident(_ e: AnyObject) -> String? { e.responds(to: NSSelectorFromString("accessibilityIdentifier")) ? e.perform(NSSelectorFromString("accessibilityIdentifier"))?.takeUnretainedValue() as? String : nil }
    #endif
    static func bounds(_ name: String) -> CGRect? { state.measurements.first { $0.name == name }?.bounds }
    /// sRGB pixels of the hosting view; `rgb` takes points.
    static func snapshot() -> (Double, Double) -> [Int] {
        host.layoutSubtreeIfNeeded(); pump(0.1)
        let rep = host.bitmapImageRepForCachingDisplay(in: host.bounds)!; host.cacheDisplay(in: host.bounds, to: rep)
        let image = rep.cgImage!, W = image.width, H = image.height, scale = Double(W) / Double(host.bounds.width)
        var px = [UInt8](repeating: 0, count: W * H * 4)
        px.withUnsafeMutableBytes { buf in
            let ctx = CGContext(data: buf.baseAddress, width: W, height: H, bitsPerComponent: 8, bytesPerRow: W * 4, space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
            ctx.draw(image, in: CGRect(x: 0, y: 0, width: W, height: H))
        }
        return { x, y in let X = min(W - 1, max(0, Int(x * scale))), Y = min(H - 1, max(0, Int(y * scale))), i = (Y * W + X) * 4; return [Int(px[i]), Int(px[i + 1]), Int(px[i + 2])] }
    }
    static func near(_ a: [Int], _ b: [Int], _ t: Int) -> Bool { zip(a, b).allSatisfy { abs($0 - $1) <= t } }
    static let teal = [0, 137, 123], tealStyle = "background:#00897B;padding:60px"
    static func button(_ id: String, _ label: String) -> AWCNode { .init(id: id, tag: "md-button", children: [.text(label)]) }
    static func floatingPage(_ floating: Bool) -> AWCNode {
        .init(id: "page", tag: "div", children: [
            button("before", "Before"),
            .init(id: "first", tag: "div", children: [
                .init(id: "acc", tag: "md-accordion", properties: ["floating": .bool(floating), "initialX": .number(24), "initialY": .number(60)], children: [
                    .init(id: "item", tag: "md-accordion-item", properties: ["headline": .string("Panel")], children: [.text("Body")])])]),
            .init(id: "second", tag: "div", properties: ["style": .string(tealStyle)], children: [button("after", "After")])])
    }
    static let cardPage = AWCNode(id: "page", tag: "div", children: [
        .init(id: "first", tag: "div", properties: ["style": .string("padding:8px")], children: [
            .init(id: "card", tag: "md-card", properties: ["interactive": .bool(true), "dragEnabled": .bool(true)], children: [.text("Drag me")])]),
        .init(id: "second", tag: "div", properties: ["style": .string(tealStyle)], children: [.text("Later")])])

    static func main() {
        _ = NSApplication.shared; NSApp.setActivationPolicy(.accessory)
        let web = try! JSONDecoder().decode(AWCValue.self, from: Data(contentsOf: URL(fileURLWithPath: #filePath).deletingLastPathComponent().appendingPathComponent("Fixtures/stacking-web.json")))
        let size = web["viewport"]
        host = NSHostingView(rootView: StackingFixture(state: state))
        window = NSWindow(contentRect: .init(x: -20000, y: -20000, width: size["width"].number ?? 480, height: size["height"].number ?? 360), styleMask: [.borderless], backing: .buffered, defer: false)
        window.isReleasedWhenClosed = false; window.contentView = host; window.orderFrontRegardless(); pump(0.2)
        func rgbOf(_ v: AWCValue) -> [Int] { v["rgb"].array.map { Int($0.number ?? -1) } }

        // 1. Floating panel declared before the teal container: Chrome paints the panel (z-index 1000, fixed) over it.
        state.node = floatingPage(true); state.epoch += 1; pump(0.9)
        var rgb = snapshot()
        let floating = web["floating"]
        for p in floating["probes"].array {
            let x = p["x"].number ?? 0, y = p["y"].number ?? 0, want = rgbOf(p), got = rgb(x, y), label = p["label"].string
            check(near(got, want, p["top"].string == "second" ? 3 : 8), "floating: \(label) at (\(x), \(y)) \(got) vs Chrome \(want) [\(p["top"].string)]")
        }
        // Keyboard order is the document's: before, the panel's header, after.
        _ = focusView("before")?.requestNativeFocus(); pump(0.1)
        var order = [focusedID()]; tab(); order.append(focusedID()); tab(); order.append(focusedID())
        let webTab = floating["tab"].array.map { $0.string.split(separator: ">").first.map(String.init) ?? "" }
        check(order.count == 3 && order[0] == webTab[0] && order[1].hasPrefix(webTab[1]) && order[2] == webTab[2], "floating: Tab order \(order) vs Chrome \(webTab)")
        // Accessibility order is the document's as well (AppKit tree; iOS orders by geometry).
        #if canImport(AppKit)
        // As an assistive client does: the window's tree is requested, which builds SwiftUI's accessibility nodes.
        NSApp.accessibilitySetValue(true, forAttribute: NSAccessibility.Attribute(rawValue: "AXManualAccessibility"))
        NSApp.accessibilitySetValue(true, forAttribute: NSAccessibility.Attribute(rawValue: "AXEnhancedUserInterface"))
        _ = window.accessibilityChildren(); _ = host.accessibilityChildren(); pump(0.4); _ = elements(host); pump(0.3)
        let all = elements(host), ids = all.compactMap(ident).filter { !$0.isEmpty }
        let iBefore = ids.firstIndex(of: "before"), iItem = ids.firstIndex { $0.hasPrefix("item") || $0 == "acc" }, iAfter = ids.firstIndex(of: "after")
        check(iBefore != nil && iItem != nil && iAfter != nil && iBefore! < iItem! && iItem! < iAfter!, "floating: accessibility order before < panel < after (\(all.count) elements, ids \(ids.prefix(24)))")
        #endif
        // Leaving `floating` returns the panel to the flow in the same view (no subtree replacement): the teal container moves below it.
        state.node = floatingPage(false); pump(0.8)
        rgb = snapshot()
        let inflow = floating["inflow"]["second"].array.map { $0.number ?? 0 }
        check(near(rgb(100, inflow[1] + 20), teal, 3) && !near(rgb(30, 60), teal, 40), "floating off: the panel is in the flow above the later container (\(rgb(30, 60)), \(rgb(100, inflow[1] + 20)))")
        state.node = floatingPage(true); pump(0.8); rgb = snapshot()
        if let p = floating["probes"].array.first { check(near(rgb(p["x"].number ?? 0, p["y"].number ?? 0), rgbOf(p), 8), "floating on again: the panel paints over the later container (\(rgb(p["x"].number ?? 0, p["y"].number ?? 0)))") }

        // 2. A card dragged over the container that follows its own: Chrome paints the card (z-index 1000) over it.
        state.node = cardPage; state.root = "card"; state.measurements = []; state.epoch += 1; pump(0.9)
        let card = web["card"], dy = (card["dragged"].array[1].number ?? 78) - (card["rects"]["card"].array[1].number ?? 8)
        if let b = bounds("md-card") {
            let start = CGPoint(x: b.minX + 10, y: b.minY + 10)
            let over: (Double, Double) = (Double(b.minX) + 30, Double(b.minY) + 8 + dy), edge: (Double, Double) = (Double(b.minX) + 30, Double(b.minY) + dy + Double(b.height) - 6)
            rgb = snapshot()
            check(near(rgb(over.0, over.1), teal, 3), "card: the later container is under the probe before the drag (\(rgb(over.0, over.1)))")
            mouse(.leftMouseDown, start); mouse(.leftMouseDragged, .init(x: start.x, y: start.y + 20)); mouse(.leftMouseDragged, .init(x: start.x, y: start.y + dy)); pump(0.5)
            let lifted = state.measurements.first { $0.name == "md-card" }
            check(lifted?.metrics["dragging"]?.bool == true && abs((lifted?.metrics["offsetY"]?.number ?? 0) - dy) <= 1, "card: dragging by \(dy) (\(String(describing: lifted?.metrics["offsetY"]?.number)))")
            rgb = snapshot()
            let probes = card["probes"].array
            for (i, at) in [over, edge].enumerated() where i < probes.count {
                let want = rgbOf(probes[i]), got = rgb(at.0, at.1)
                check(!near(got, teal, 40) && near(got, want, 12), "card: \(probes[i]["label"].string) at \(at) \(got) vs Chrome \(want)")
            }
            mouse(.leftMouseUp, .init(x: start.x, y: start.y + dy)); pump(0.6); rgb = snapshot()
            check(near(rgb(over.0, over.1), teal, 3), "card: released, it returns and the later container shows again (\(rgb(over.0, over.1)))")
        } else { check(false, "card measured natively (\(state.measurements.map(\.name).prefix(12)))") }

        print("Native stacking: \(checks - failures.count)/\(checks) checks passed")
        if !failures.isEmpty { exit(1) }
        exit(0)
    }
}
