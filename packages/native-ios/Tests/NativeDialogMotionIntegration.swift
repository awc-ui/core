import AppKit
import SwiftUI
import Observation
import QuartzCore
@testable import AWCUI

// md-dialog motion, events, focus and methods against Chrome trusted-input runs (dialog native-motion.html:
// 17 runs + 2 reduced-motion runs). Each native step is replayed at Chrome's step time; every rendered frame's
// scrim/container opacity and translate and the close-button tint are compared with Chrome's per-frame samples.
@MainActor @Observable final class DialogMotionState {
    var run: AWCValue = .null
    var epoch = 0
    var open = false
    var reduced = false
    var measurements: [AWCNativeInspectionNode] = []
    var events: [(String, Double)] = []
    let controller = AWCDialogController()
    let pointer = AWCNativePointerState()
}
struct DialogMotionFixture: View {
    let state: DialogMotionState
    var body: some View {
        let r = state.run, epoch = state.epoch, theme = AWCTheme.generated(dark: r["theme"].string == "dark")
        var properties: [String: AWCValue] = ["headline": "Account details"]
        if case .object(let o) = r["props"] { for (k, v) in o { properties[k] = v } }
        let model = AWCDialogModel(properties)
        let slots = AWCDialogSlots(
            content: AnyView(Text("Supporting text").modifier(AWCCSSLineBox(size: 14, line: 20)).frame(maxWidth: .infinity, minHeight: 60, maxHeight: 60, alignment: .topLeading)),
            actions: r["actions"] == .bool(true) ? AnyView(Group {
                AWCNativeView(node: .init(id: "later", tag: "md-button", properties: ["variant": "text"], children: [.text("Later")])).fixedSize()
                AWCNativeView(node: .init(id: "accept", tag: "md-button", properties: ["variant": "filled"], children: [.text("Accept")])).fixedSize()
                    .awcInspect(nodeID: "dut", part: "accept", name: "accept")
            }) : r["textActions"] == .bool(true) ? AnyView(Text("No actions")) : nil,
            headerAction: r["headerAction"] == .bool(true) && model.fullscreen ? AnyView(AWCNativeView(node: .init(id: "save", tag: "md-button", properties: ["variant": "text"], children: [.text("Save")])).fixedSize()) : nil)
        return AWCModalScope {
            ZStack(alignment: .topLeading) {
                Color(awcHex: theme.tokens["--md-sys-color-surface"] ?? "#FFFBFE")
                Rectangle().fill(Color(awcHex: theme.tokens["--md-sys-color-primary-container"] ?? "#EADDFF")).frame(width: 200, height: 120).offset(x: 16, y: 64)
                AWCNativeView(node: .init(id: "opener", tag: "md-button", properties: ["variant": "text"], children: [.text("Open")])) { e in
                    if e.name == "mdClick" { state.controller.show() }
                }.fixedSize().offset(x: 16, y: 16).awcInspect(nodeID: "dut", part: "opener", name: "opener")
                AWCNativeDialog(id: "dut", model: model, theme: theme, open: Binding(get: { state.open }, set: { state.open = $0 }), slots: slots,
                                emit: { name in state.events.append((name, CACurrentMediaTime() * 1000)) })
            }
            .environment(\.layoutDirection, r["dir"].string == "rtl" ? .rightToLeft : .leftToRight)
        }
        .awcDialogController(state.controller, for: "dut")
        .awcModalReducedMotion(state.reduced)
        .awcTheme(theme)
        .environment(\.awcNativePointerState, state.pointer)
        .awcNativeInspection(rootID: "dut", coordinateSpace: "awc-native-preview") { if state.epoch == epoch { state.measurements = $0 } }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .coordinateSpace(name: "awc-native-preview")
        .id(epoch)
    }
}
@main @MainActor enum NativeDialogMotionIntegration {
    static let state = DialogMotionState()
    static var host: NSHostingView<DialogMotionFixture>!, window: NSWindow!
    static var checks = 0, failures: [String] = []
    static var report: [[String: Any]] = []
    static func check(_ ok: Bool, _ name: String) { checks += 1; if !ok { failures.append(name); print("FAIL: " + name); fflush(stdout) } }
    static func pump(_ d: Double = 0.004) { let end = Date().addingTimeInterval(d); repeat { while let e = NSApp.nextEvent(matching: .any, until: .distantPast, inMode: .default, dequeue: true) { NSApp.sendEvent(e) }; host.layoutSubtreeIfNeeded(); host.displayIfNeeded(); _ = RunLoop.current.run(mode: .default, before: Date().addingTimeInterval(0.002)) } while Date() < end }
    static func now() -> Double { CACurrentMediaTime() * 1000 }
    static func point(_ p: CGPoint) -> CGPoint { host.convert(.init(x: p.x, y: host.isFlipped ? p.y : host.bounds.height - p.y), to: nil) }
    static func mouse(_ kind: NSEvent.EventType, _ p: CGPoint) {
        NSApp.sendEvent(NSEvent.mouseEvent(with: kind, location: point(p), modifierFlags: [], timestamp: ProcessInfo.processInfo.systemUptime, windowNumber: window.windowNumber, context: nil, eventNumber: 1, clickCount: 1, pressure: kind == .leftMouseUp ? 0 : 1)!)
    }
    static func click(_ p: CGPoint) { state.pointer.update(phase: .move, location: p); mouse(.mouseMoved, p); state.pointer.update(phase: .down, location: p); mouse(.leftMouseDown, p); mouse(.leftMouseUp, p); state.pointer.update(phase: .up, location: p) }
    /// NSApplication delivers keys to the key window; the off-screen test window is never key, so after the
    /// application-level monitors (where AWCModalScope routes Escape/Tab) the event goes to the window directly.
    static func key(_ code: UInt16, _ text: String, shift: Bool = false) {
        for type in [NSEvent.EventType.keyDown, .keyUp] {
            let e = NSEvent.keyEvent(with: type, location: .zero, modifierFlags: shift ? [.shift] : [], timestamp: ProcessInfo.processInfo.systemUptime, windowNumber: window.windowNumber, context: nil, characters: text, charactersIgnoringModifiers: text, isARepeat: false, keyCode: code)!
            if code == 53 || code == 48 { NSApp.sendEvent(e) } else { window.sendEvent(e) }
        }
    }
    static func center(_ name: String) -> CGPoint? { state.measurements.first { $0.name == name }.map { CGPoint(x: $0.bounds.midX, y: $0.bounds.midY) } }
    static func focused() -> (String, Bool) {
        let id = (window.firstResponder as? NSView)?.accessibilityIdentifier() ?? ""
        return (id, false)
    }
    static func css(_ s: String) -> [Double] {
        var out: [Double] = [], cur = ""
        for ch in s { if "0123456789.-e".contains(ch) { cur.append(ch) } else { if let v = Double(cur) { out.append(v) }; cur = "" } }
        if let v = Double(cur) { out.append(v) }
        return out
    }
    struct Sample { let t: Double; let renderT: Double?; let opacity: Double?; let translate: Double?; let scrim: Double?; let tint: Double?; let tintT: Double? }
    static func sample() -> Sample {
        let m = state.measurements
        let c = m.first { $0.name == "container-motion" }, s = m.first { $0.name == "scrim" }, k = m.first { $0.name == "close-tint" }
        return .init(t: now(), renderT: c?.metrics["renderTime"]?.number, opacity: c?.metrics["opacity"]?.number, translate: c?.metrics["translateY"]?.number,
                     scrim: s?.metrics["opacity"]?.number, tint: k?.metrics["alpha"]?.number, tintT: k?.metrics["renderTime"]?.number)
    }
    static func expectedID(_ path: [String]) -> String? {
        guard let leaf = path.last else { return nil }
        if leaf == "body" { return "" }
        if leaf.contains("#opener") { return "opener" }
        for (needle, id) in [("cancel-button", "dut.cancel-button"), ("ok-button", "dut.ok-button"), ("close-button", "dut.close-button")] where leaf.contains(needle) { return id }
        if leaf.hasPrefix("md-dialog") || leaf.contains("[part=container]") { return "dut.container" }
        if leaf.contains("[slot=header-action]") { return "save" }
        if leaf.contains("md-button") { return nil }
        return nil
    }
    static func run(_ r: AWCValue, reducedSet: Bool) {
        let name = r["name"].string
        let vp = r["vp"].array.map { CGFloat($0.number ?? 0) }
        window.setContentSize(.init(width: vp[0], height: vp[1])); host.frame = .init(x: 0, y: 0, width: vp[0], height: vp[1])
        state.reduced = reducedSet; state.open = false; state.run = r; state.events = []; state.epoch += 1
        state.pointer.update(phase: .leave); pump(0.4); _ = window.makeFirstResponder(nil); pump(0.05)
        let phases = r["phases"].array
        guard phases.count >= 2 else { check(false, "\(name) phases"); return }
        let webT0 = phases[0]["t"].number ?? 0, t0 = now()
        // Chrome step time = trusted-input delivery where the run records it: the first event the step caused.
        let webEventTimes = r["events"].array.compactMap { $0["t"].number }
        let stepWeb: [Double] = phases.indices.map { i in
            let start = phases[i]["t"].number ?? 0, end = i + 1 < phases.count ? (phases[i + 1]["t"].number ?? .infinity) : .infinity
            return webEventTimes.filter { $0 >= start && $0 < end }.min() ?? start
        }
        var stepTimes: [Int: Double] = [:], samples: [Sample] = [], focusAtEnd: [Int: String] = [:], methodTimes: [(String, Double, Double)] = []
        var next = 1, eventStepTimes: [Int: Double] = [:]
        let end = (phases.last?["t"].number ?? 0) - webT0 + 470
        while now() - t0 < end {
            while next < phases.count && now() - t0 >= stepWeb[next] - webT0 {
                focusAtEnd[next - 1] = focused().0
                let label = phases[next]["label"].string, step = String(label.split(separator: "-", maxSplits: 1).last ?? "")
                stepTimes[next] = now()
                #if os(iOS)
                let deliveryMark = AWCShimTouch.deliveredAt.count
                #endif
                switch step {
                case "open": if let p = center("opener") { click(p) }
                case "escape": key(53, "\u{1b}")
                case "tab": key(48, "\t")
                case "shifttab": key(48, "\t", shift: true)
                case "enter": key(36, "\r")
                case "scrim": click(.init(x: 12, y: vp[1] - 12))
                case "cancel": if let p = center("cancel-button") { click(p) }
                case "ok": if let p = center("ok-button") { click(p) }
                case "close": if let p = center("close-button") { click(p) }
                case "accept": if let p = center("accept") { click(p) }
                case "hoverClose": if let p = center("close-button") { state.pointer.update(phase: .move, location: p); mouse(.mouseMoved, p) }
                case "pressClose": if let p = center("close-button") { state.pointer.update(phase: .down, location: p); mouse(.leftMouseDown, p) }
                case "releaseClose": if let p = center("close-button") { mouse(.leftMouseUp, p); state.pointer.update(phase: .up, location: p) }
                case "show": let called = now(); state.controller.show(); methodTimes.append(("show", called, called))
                case "hide": let called = now(); state.controller.close()
                    Task { @MainActor in await state.controller.whenClosed(); methodTimes.append(("whenClosed", called, now())) }
                default: check(false, "\(name) unknown step \(step)")
                }
                #if os(iOS)
                // iOS harness: a synthesized touch / key reaches the app when UIKit delivers it, one touch phase per frame (a
                // click's release 2 frames after it is queued, more under load). Chrome times an event from its trusted
                // input's first event, so the native event delay is timed from the delivery of the step's last input
                // (gate-7 r3-23, R4-19); the per-frame motion keeps the step's queue time. AWC_MOTION_STEP_ANCHOR=queue: events
                // from the queue time too, as before.
                if ProcessInfo.processInfo.environment["AWC_MOTION_STEP_ANCHOR"] != "queue", AWCShimTouch.deliveredAt.count > deliveryMark, let delivered = AWCShimTouch.deliveredAt.last { eventStepTimes[next] = delivered }
                #endif
                next += 1
            }
            pump(); samples.append(sample())
        }
        pump(0.35)
        focusAtEnd[phases.count - 1] = focused().0
        // Events: same names and order; time from the causing step within one frame budget of Chrome's.
        let webEvents = r["events"].array.map { ($0["name"].string, $0["t"].number ?? 0) }
        check(state.events.map(\.0) == webEvents.map(\.0), "\(name) events \(state.events.map(\.0)) vs \(webEvents.map(\.0))")
        func stepIndex(webT: Double) -> Int { var k = 0; for (i, p) in phases.enumerated() where (p["t"].number ?? 0) <= webT { k = i }; return k }
        for ((n, nt), (_, wt)) in zip(state.events, webEvents) {
            let k = stepIndex(webT: wt)
            guard let ns = eventStepTimes[k] ?? stepTimes[k] else { continue }
            let nativeDelay = nt - ns, webDelay = wt - stepWeb[k]
            if ProcessInfo.processInfo.environment["AWC_DIALOG_TIMING"] == "1" { print(String(format: "DLGTIMING %@ %@ native %.1f ms web %.1f ms", name, n, nativeDelay, webDelay)) }
            check(nativeDelay >= -1 && nativeDelay <= webDelay + 40, "\(name) \(n) \(nativeDelay) ms after its step (Chrome \(webDelay))")
        }
        // Focus after every phase.
        for (i, p) in phases.enumerated() {
            let path = p["focus"]["path"].array.map(\.string)
            if let want = expectedID(path), let got = focusAtEnd[i] {
                check(got == want || (want == "" && !got.hasPrefix("dut")), "\(name) focus after \(p["label"].string): \(got) vs \(path.last ?? "")")
            }
        }
        // Per-frame: container opacity/translate and scrim opacity at render time within Chrome's envelope.
        var web: [(Double, [String: Double])] = []
        for p in phases { for s in p["samples"].array {
            let d = s["md-dialog#dut"], t = d["t"].number ?? 0
            var v: [String: Double] = [:]
            if let o = d["container"]["opacity"].number { v["opacity"] = o }
            let m = css(d["container"]["transform"].string)
            if m.count == 6 { v["translate"] = r["props"]["fullscreen"] == .bool(true) ? m[5] : m[5] + (d["container"]["rect"]["height"].number ?? 0) / 2 }
            else if d["container"]["transform"].string == "none" { v["translate"] = 0 }
            if let o = d["scrim"]["opacity"].number { v["scrim"] = o }
            let bg = css(d["closeButton"]["background"].string); if bg.count == 4 { v["tint"] = bg[3] } else if bg.count == 3 { v["tint"] = 1 }
            web.append((t, v))
        } }
        web.sort { $0.0 < $1.0 }
        func webTime(_ native: Double) -> Double {
            var best: (Int, Double)? = nil
            for (k, ns) in stepTimes where ns <= native { if best == nil || ns > best!.1 { best = (k, ns) } }
            guard let b = best else { return webT0 + (native - t0) }
            return stepWeb[b.0] + (native - b.1)
        }
        func envelope(_ key: String, _ t: Double) -> (Double, Double)? {
            guard let after = web.firstIndex(where: { $0.0 >= t }) else { return web.last?.1[key].map { ($0, $0) } }
            if after == 0 { return web[0].1[key].map { ($0, $0) } }
            let a = web[after - 1], b = web[after]
            guard let va = a.1[key], let vb = b.1[key] else { return (a.1[key] ?? b.1[key]).map { ($0, $0) } }
            if b.0 - a.0 > 34 { return (min(va, vb), max(va, vb)) }
            let x = (t - a.0) / max(1e-9, b.0 - a.0), v = va + (vb - va) * x
            return (v, v)
        }
        var compared = 0
        for s in samples {
            for (key, value, time, tol) in [("opacity", s.opacity, s.renderT, 0.01), ("translate", s.translate, s.renderT, 0.3), ("scrim", s.scrim, s.renderT, 0.01), ("tint", s.tint, s.tintT, 0.012)] {
                guard let v = value, let at = time ?? Optional(s.t) else { continue }
                var lo = Double.infinity, hi = -Double.infinity, x = at - 34
                while x <= at + 40 { if let e = envelope(key, webTime(x)) { lo = min(lo, e.0); hi = max(hi, e.1) }; x += 2 }
                guard lo.isFinite else { continue }
                check(v >= lo - tol && v <= hi + tol, "\(name) \(key) \(v) at web \(webTime(at)) within Chrome [\(lo),\(hi)]"); compared += 1
            }
        }
        check(compared > 50, "\(name) rendered values compared (\(compared))")
        // Source timings of the shell transitions.
        for a in r["anims"].array where ["container", "scrim"].contains(a["target"].string) {
            check(abs((a["duration"].number ?? 0) - (reducedSet ? 0 : 300)) < 0.5 && a["easing"].string == "cubic-bezier(0.2, 0, 0, 1)", "\(name) \(a["target"].string) \(a["property"].string) timing \(a["duration"]) \(a["easing"])")
        }
        if reducedSet { check(r["anims"].array.allSatisfy { !["container", "scrim"].contains($0["target"].string) }, "\(name) reduced motion has no shell transitions") }
        // Methods: show() idempotent, whenClosed() after the exit motion.
        for m in r["methods"].array where m["method"].string == "whenClosed" {
            let webDelay = (m["resolved"].number ?? 0) - (m["called"].number ?? 0)
            if let native = methodTimes.first(where: { $0.0 == "whenClosed" }) { let d = native.2 - native.1; check(abs(d - webDelay) <= 45, "\(name) whenClosed after \(d) ms (Chrome \(webDelay))") }
            else { check(false, "\(name) whenClosed resolved") }
        }
        report.append(["run": name, "samples": samples.count, "compared": compared, "events": state.events.map(\.0)])
        state.open = false; pump(0.4)
    }
    static func main() {
        _ = NSApplication.shared; NSApp.setActivationPolicy(.accessory)
        host = NSHostingView(rootView: DialogMotionFixture(state: state))
        window = NSWindow(contentRect: .init(x: -20000, y: -20000, width: 800, height: 600), styleMask: [.borderless], backing: .buffered, defer: false)
        window.isReleasedWhenClosed = false; window.colorSpace = .sRGB; window.contentView = host; window.orderFrontRegardless(); pump(0.2)
        let fixtures = URL(fileURLWithPath: #filePath).deletingLastPathComponent().appendingPathComponent("Fixtures")
        let only = ProcessInfo.processInfo.environment["AWC_DIALOG_ONLY"]
        for (file, reduced) in [("dialog-web-motion.json", false), ("dialog-web-motion-reduced.json", true)] {
            let oracle = try! JSONDecoder().decode(AWCValue.self, from: Data(contentsOf: fixtures.appendingPathComponent(file)))
            for r in oracle["runs"].array where only.map({ r["name"].string.contains($0) }) ?? true { run(r, reducedSet: reduced) }
        }
        if let out = ProcessInfo.processInfo.environment["AWC_DIALOG_OUTPUT"] { try! JSONSerialization.data(withJSONObject: ["checks": checks, "failures": failures, "report": report], options: [.prettyPrinted, .sortedKeys]).write(to: URL(fileURLWithPath: out)) }
        print("Dialog native motion: \(checks - failures.count)/\(checks) checks passed")
        window.close(); if !failures.isEmpty { exit(1) }
    }
}
