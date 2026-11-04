import AppKit
import SwiftUI
import Observation
import QuartzCore
@testable import AWCUI

// Mixed modal ownership against Chrome (md-dialog/web-reference/modal-stack.html: 13 runs over Dialog, Bottom Sheet and
// Side Sheet in both orders, the lower owner closing first, and a bottom-sheet drag cancelled when a dialog covers it).
// Steps are replayed at Chrome's phase times with real AppKit input; checks: the event sequence with targets, the focus
// chain after every phase, the final open state, and the end-of-phase paint (flat pixels against Chrome's phase shots,
// which fixes the paint order of the two owners and their scrims).
@MainActor @Observable final class StackState {
    var run: AWCValue = .null
    var epoch = 0
    var openA = false
    var openB = false
    var measurements: [AWCNativeInspectionNode] = []
    var events: [(String, String)] = []
    let pointer = AWCNativePointerState()
}
struct StackFixture: View {
    let state: StackState
    func content(_ owner: String, _ button: String, _ label: String, kind: String, action: @escaping () -> Void) -> AnyView {
        AnyView(VStack(alignment: .leading, spacing: 0) {
            Text("Body of \(owner)").modifier(AWCCSSLineBox(size: 14, line: 20)).frame(maxWidth: .infinity, minHeight: 80, maxHeight: 80, alignment: .topLeading)
            AWCNativeView(node: .init(id: button, tag: "md-button", properties: ["variant": "text"], children: [.text(label)])) { e in if e.name == "mdClick" { action() } }
                .fixedSize().frame(height: 36)
                .awcInspect(nodeID: owner, part: button, name: button)
        })
    }
    @ViewBuilder func modal(_ kind: String, _ owner: String, open: Binding<Bool>, theme: AWCTheme, slot: AnyView) -> some View {
        let emit: (String) -> Void = { name in state.events.append((owner, name)) }
        switch kind {
        case "dialog": AWCNativeDialog(id: owner, model: AWCDialogModel(["headline": .string(owner)]), theme: theme, open: open, slots: AWCDialogSlots(content: slot), emit: emit)
        case "bottom": AWCNativeBottomSheet(id: owner, model: AWCBottomSheetModel(["headline": .string(owner)]), theme: theme, open: open, slots: AWCBottomSheetSlots(content: slot), emit: emit)
        default: AWCNativeSideSheet(id: owner, model: AWCSideSheetModel(["headline": .string(owner), "variant": "modal"]), theme: theme, open: open, slots: AWCSideSheetSlots(content: slot), emit: emit)
        }
    }
    var body: some View {
        let r = state.run, epoch = state.epoch, theme = AWCTheme.generated(dark: false)
        return AWCModalScope {
            ZStack(alignment: .topLeading) {
                Color(awcHex: theme.tokens["--md-sys-color-surface"] ?? "#FFFBFE")
                Rectangle().fill(Color(awcHex: theme.tokens["--md-sys-color-primary-container"] ?? "#EADDFF")).frame(width: 200, height: 120).offset(x: 16, y: 64)
                AWCNativeView(node: .init(id: "opener", tag: "md-button", properties: ["variant": "text"], children: [.text("Open")])) { e in
                    if e.name == "mdClick" { state.openA = true }
                }.fixedSize().offset(x: 16, y: 16).awcInspect(nodeID: "page", part: "opener", name: "opener")
                modal(r["a"].string, "A", open: Binding(get: { state.openA }, set: { state.openA = $0 }), theme: theme,
                      slot: content("A", "openB", "Open B", kind: r["a"].string) { state.openB = true })
                modal(r["b"].string, "B", open: Binding(get: { state.openB }, set: { state.openB = $0 }), theme: theme,
                      slot: content("B", "inB", "Inside B", kind: r["b"].string) {})
            }
            .environment(\.layoutDirection, .leftToRight)
        }
        // The stack oracle checks end-of-phase states (every phase outlasts the shell motion, which the motion fixtures
        // verify frame by frame): reduced motion settles the shells at once, so input points and phase-end paint do not
        // depend on frame timing.
        .awcModalReducedMotion(true)
        .awcTheme(theme)
        .environment(\.awcNativePointerState, state.pointer)
        .awcNativeInspection(rootID: "page|A|B", coordinateSpace: "awc-native-preview") { if state.epoch == epoch { state.measurements = $0 } }
        .frame(width: 800, height: 600, alignment: .topLeading)
        .coordinateSpace(name: "awc-native-preview")
        .id(epoch)
    }
}
struct StackGrid {
    let w: Int, h: Int; var v: [Float]
    func flat(_ px: Int, _ py: Int, _ limit: Float) -> Bool {
        guard px >= 1 && py >= 1 && px + 1 < w && py + 1 < h else { return false }
        for k in 0..<3 {
            var lo: Float = 999, hi: Float = -1
            for y in (py - 1)...(py + 1) { for x in (px - 1)...(px + 1) { let q = v[(y * w + x) * 3 + k]; lo = min(lo, q); hi = max(hi, q) } }
            if hi - lo > limit { return false }
        }
        return true
    }
    func diff(_ o: StackGrid, _ px: Int, _ py: Int) -> Float { let i = (py * w + px) * 3; return max(abs(v[i] - o.v[i]), max(abs(v[i + 1] - o.v[i + 1]), abs(v[i + 2] - o.v[i + 2]))) }
}
@main @MainActor enum NativeModalStackIntegration {
    static let state = StackState()
    static var host: NSHostingView<StackFixture>!, window: NSWindow!
    static var checks = 0, failures: [String] = []
    static var report: [[String: Any]] = []
    static func check(_ ok: Bool, _ name: String) { checks += 1; if !ok { failures.append(name); print("FAIL: " + name); fflush(stdout) } }
    static func pump(_ d: Double = 0.004) { let end = Date().addingTimeInterval(d); repeat { while let e = NSApp.nextEvent(matching: .any, until: .distantPast, inMode: .default, dequeue: true) { NSApp.sendEvent(e) }; host.layoutSubtreeIfNeeded(); host.displayIfNeeded(); _ = RunLoop.current.run(mode: .default, before: Date().addingTimeInterval(0.002)) } while Date() < end }
    static func now() -> Double { CACurrentMediaTime() * 1000 }
    static func point(_ p: CGPoint) -> CGPoint { host.convert(.init(x: p.x, y: host.isFlipped ? p.y : host.bounds.height - p.y), to: nil) }
    static func mouse(_ kind: NSEvent.EventType, _ p: CGPoint) {
        NSApp.sendEvent(NSEvent.mouseEvent(with: kind, location: point(p), modifierFlags: [], timestamp: ProcessInfo.processInfo.systemUptime, windowNumber: window.windowNumber, context: nil, eventNumber: 1, clickCount: 1, pressure: kind == .leftMouseUp || kind == .mouseMoved ? 0 : 1)!)
    }
    static func click(_ p: CGPoint) { state.pointer.update(phase: .move, location: p); mouse(.mouseMoved, p); state.pointer.update(phase: .down, location: p); mouse(.leftMouseDown, p); mouse(.leftMouseUp, p); state.pointer.update(phase: .up, location: p) }
    static func key(_ code: UInt16, _ text: String) {
        for type in [NSEvent.EventType.keyDown, .keyUp] {
            NSApp.sendEvent(NSEvent.keyEvent(with: type, location: .zero, modifierFlags: [], timestamp: ProcessInfo.processInfo.systemUptime, windowNumber: window.windowNumber, context: nil, characters: text, charactersIgnoringModifiers: text, isARepeat: false, keyCode: code)!)
        }
    }
    static func node(_ name: String) -> CGRect? { state.measurements.first { $0.name == name }?.bounds }
    /// Inspection frames refresh on layout, not on the render-only open transform: anchor a control inside owner A to
    /// A's settled open position (a bottom sheet's container ends at the viewport bottom, a side sheet's at its edge).
    static func settled(_ name: String, kind: String) -> CGPoint? {
        guard let b = node(name) else { return nil }
        var p = CGPoint(x: b.midX, y: b.midY)
        if let c = node("container") {
            if kind == "bottom", c.maxY - 600 > 0.5 { p.y -= c.maxY - 600 }
            if kind == "side" { let right = 800 - c.width; p.x -= c.minX - (abs(c.minX - right) <= abs(c.minX) ? right : 0) }
        }
        return p
    }
    static func focused() -> String { (window.firstResponder as? NSView)?.accessibilityIdentifier() ?? "" }
    static func expected(_ path: [String]) -> String? {
        guard let leaf = path.last else { return nil }
        if leaf == "body" { return "" }
        for id in ["opener", "openB", "inB"] where leaf == "button#" + id { return id }
        let owner = path.count > 1 ? String(path[path.count - 2].split(separator: "#").last ?? "") : ""
        if leaf.hasPrefix("md-icon-button") { return owner + ".close-button" }
        if leaf.contains("[part=container]") { return owner + ".container" }
        return nil
    }
    static func grid(_ cg: CGImage, scale: Double) -> StackGrid {
        let w = 800, h = 600
        var buffer = [UInt8](repeating: 0, count: cg.width * cg.height * 4)
        buffer.withUnsafeMutableBytes { raw in
            let ctx = CGContext(data: raw.baseAddress, width: cg.width, height: cg.height, bitsPerComponent: 8, bytesPerRow: cg.width * 4, space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
            ctx.draw(cg, in: .init(x: 0, y: 0, width: cg.width, height: cg.height))
        }
        let k = max(1, Int(scale.rounded())), n = Float(k * k)
        var v = [Float](repeating: 0, count: w * h * 3)
        for py in 0..<h { for px in 0..<w {
            var r: Float = 0, g: Float = 0, b: Float = 0
            for yy in (py * k)..<min(cg.height, py * k + k) { for xx in (px * k)..<min(cg.width, px * k + k) { let i = (yy * cg.width + xx) * 4; r += Float(buffer[i]); g += Float(buffer[i + 1]); b += Float(buffer[i + 2]) } }
            let o = (py * w + px) * 3; v[o] = r / n; v[o + 1] = g / n; v[o + 2] = b / n
        } }
        return .init(w: w, h: h, v: v)
    }
    static func paint(_ name: String, _ label: String, shots: URL) {
        guard let source = NSImage(contentsOf: shots.appendingPathComponent("\(name)-\(label).png"))?.cgImage(forProposedRect: nil, context: nil, hints: nil) else { check(false, "\(name) \(label) shot"); return }
        let b = host.bitmapImageRepForCachingDisplay(in: host.bounds)!; host.cacheDisplay(in: host.bounds, to: b)
        if let dir = ProcessInfo.processInfo.environment["AWC_STACK_CAPTURE_DIRECTORY"] {
            try? FileManager.default.createDirectory(atPath: dir, withIntermediateDirectories: true)
            try? b.representation(using: .png, properties: [:])?.write(to: URL(fileURLWithPath: dir).appendingPathComponent("\(name)-\(label).png"))
        }
        let web = grid(source, scale: 1), nat = grid(b.cgImage!, scale: Double(b.pixelsWide) / host.bounds.width)
        // UA page/slotted buttons are not component paint: mask their rows (the slotted ones at the native position).
        var masks: [CGRect] = [.init(x: 12, y: 12, width: 100, height: 48), .init(x: 12, y: 196, width: 100, height: 48)]
        for id in ["openB", "inB"] { if let r = node(id) { masks.append(.init(x: r.minX - 6, y: r.minY - 4, width: 620, height: 44)) } }
        var n = 0, bad = 0, sum = 0.0, worst: Float = 0, at = ""
        for py in 1..<599 { for px in 1..<799 {
            if masks.contains(where: { $0.contains(CGPoint(x: px, y: py)) }) { continue }
            guard web.flat(px, py, 6) && nat.flat(px, py, 6) else { continue }
            let q = web.diff(nat, px, py); n += 1; sum += Double(max(0, q - 1)); if q > 6 { bad += 1 }
            if q > worst { worst = q; at = "(\(px),\(py))" }
        } }
        let ratio = Double(bad) / Double(max(1, n)), mean = sum / Double(max(1, n))
        check(n > 200_000 && ratio <= 0.005 && mean <= 1.0, "\(name) \(label) paint (mean \(mean), >6: \(bad)/\(n), worst \(worst) at \(at))")
        report.append(["case": "\(name)-\(label)", "compared": n, "meanBeyondOneLevel": mean, "over6": bad, "worst": worst, "worstAt": at])
    }
    static func run(_ r: AWCValue, shots: URL) {
        let name = r["name"].string
        state.openA = false; state.openB = false; state.events = []; state.run = r; state.epoch += 1
        let rest = CGPoint(x: 798, y: 598)
        state.pointer.update(phase: .move, location: rest); mouse(.mouseMoved, rest); pump(0.5); _ = window.makeFirstResponder(nil); pump(0.05)
        let phases = r["phases"].array
        let webT0 = phases[0]["t"].number ?? 0
        var t0 = now()
        var focusAtEnd: [Int: String] = [:], next = 1, drag = CGPoint.zero
        let end = (phases.last?["t"].number ?? 0) - webT0 + 520
        // The flat-pixel comparison takes seconds in a debug build: the replay clock stops while it runs, so the next
        // step still follows the previous one by Chrome's interval (with the updates between them pumped).
        func endPhase(_ i: Int) {
            focusAtEnd[i] = focused()
            let start = now()
            if i > 0 { paint(name, phases[i]["label"].string, shots: shots) }
            t0 += now() - start
        }
        while now() - t0 < end {
            while next < phases.count && now() - t0 >= (phases[next]["t"].number ?? 0) - webT0 {
                endPhase(next - 1)
                let step = String(phases[next]["label"].string.split(separator: "-", maxSplits: 1).last ?? "")
                switch step {
                case "openA": if let p = node("opener").map({ CGPoint(x: $0.midX, y: $0.midY) }) { click(p) }
                case "openB": if let p = settled("openB", kind: r["a"].string) { click(p) }
                case "escape": key(53, "\u{1b}")
                case "closeLower": state.openA = false
                case "openBProgrammatic": state.openB = true
                case "pressHandle":
                    if let p = settled("drag-handle", kind: "bottom") { drag = p; state.pointer.update(phase: .move, location: p); mouse(.mouseMoved, p); state.pointer.update(phase: .down, location: p); mouse(.leftMouseDown, p) }
                case "moveHandle": let p = CGPoint(x: drag.x, y: drag.y + 50); state.pointer.update(phase: .move, location: p); mouse(.leftMouseDragged, p)
                case "releaseHandle": let p = CGPoint(x: drag.x, y: drag.y + 50); mouse(.leftMouseUp, p); state.pointer.update(phase: .up, location: p)
                default: check(false, "\(name) unknown step \(step)")
                }
                next += 1
            }
            pump()
        }
        endPhase(phases.count - 1)
        let web = r["events"].array.map { ($0["target"].string.split(separator: "#").last.map(String.init) ?? "", $0["name"].string) }
        check(state.events.map { "\($0.0):\($0.1)" } == web.map { "\($0.0):\($0.1)" }, "\(name) events \(state.events.map { "\($0.0):\($0.1)" }) vs \(web.map { "\($0.0):\($0.1)" })")
        for (i, p) in phases.enumerated() {
            let path = p["focus"]["path"].array.map(\.string)
            if let want = expected(path), let got = focusAtEnd[i] {
                check(got == want || (want == "" && !["opener", "openB", "inB"].contains(got) && !got.contains(".")), "\(name) focus after \(p["label"].string): \(got) vs \(path.suffix(2).joined(separator: " "))")
            }
        }
        check(state.openA == (r["openState"]["A"] == .bool(true)) && state.openB == (r["openState"]["B"] == .bool(true)), "\(name) final open state A=\(state.openA) B=\(state.openB)")
        state.openA = false; state.openB = false; pump(0.6)
    }
    static func main() {
        _ = NSApplication.shared; NSApp.setActivationPolicy(.accessory)
        host = NSHostingView(rootView: StackFixture(state: state))
        window = NSWindow(contentRect: .init(x: -20000, y: -20000, width: 800, height: 600), styleMask: [.borderless], backing: .buffered, defer: false)
        window.isReleasedWhenClosed = false; window.colorSpace = .sRGB; window.contentView = host; window.orderFrontRegardless(); pump(0.2)
        let fixtures = URL(fileURLWithPath: #filePath).deletingLastPathComponent().appendingPathComponent("Fixtures")
        let oracle = try! JSONDecoder().decode(AWCValue.self, from: Data(contentsOf: fixtures.appendingPathComponent("modal-web-stack.json")))
        let only = ProcessInfo.processInfo.environment["AWC_STACK_ONLY"]
        for r in oracle["runs"].array where only.map({ r["name"].string.contains($0) }) ?? true { run(r, shots: fixtures.appendingPathComponent("modal-web-stack")) }
        if let out = ProcessInfo.processInfo.environment["AWC_STACK_OUTPUT"] { try! JSONSerialization.data(withJSONObject: ["checks": checks, "failures": failures, "report": report], options: [.prettyPrinted, .sortedKeys]).write(to: URL(fileURLWithPath: out)) }
        print("Modal stack native: \(checks - failures.count)/\(checks) checks passed")
        window.close(); if !failures.isEmpty { exit(1) }
    }
}
