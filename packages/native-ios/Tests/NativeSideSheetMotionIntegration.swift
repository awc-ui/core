import AppKit
import SwiftUI
import Observation
import QuartzCore
@testable import AWCUI

// md-side-sheet motion, events, focus and methods against Chrome trusted-input runs (side-sheet native-motion.html:
// 17 runs + 2 reduced-motion runs). Each native step is replayed at Chrome's step time with real AppKit mouse/key
// events; every rendered frame's scrim/container opacity and translateX are compared with Chrome's per-frame samples
// (±2 frames, monotone envelope across gaps longer than 34 ms); whenClosed() timing, the variant switch and focus too.
@MainActor @Observable final class SideMotionState {
    var run: AWCValue = .null
    var epoch = 0
    var open = false
    var reduced = false
    var variant: String? = nil
    var measurements: [AWCNativeInspectionNode] = []
    var events: [(String, Double)] = []
    var methods: [(String, Double, Double)] = []
    var controller = AWCSideSheetController()
    let pointer = AWCNativePointerState()
}
struct SideMotionPage: Layout {
    let sheetRight: Bool
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize { proposal.replacingUnspecifiedDimensions() }
    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let sheet = subviews[1].sizeThatFits(.init(width: bounds.width, height: bounds.height))
        let mainWidth = max(0, bounds.width - sheet.width)
        subviews[0].place(at: .init(x: sheetRight ? bounds.minX : bounds.minX + sheet.width, y: bounds.minY), anchor: .topLeading, proposal: .init(width: mainWidth, height: bounds.height))
        subviews[1].place(at: .init(x: sheetRight ? bounds.minX + mainWidth : bounds.minX, y: bounds.minY), anchor: .topLeading, proposal: .init(width: bounds.width, height: bounds.height))
    }
}
struct SideMotionFixture: View {
    let state: SideMotionState
    var body: some View {
        let r = state.run, epoch = state.epoch, theme = AWCTheme.generated(dark: r["theme"].string == "dark")
        var properties: [String: AWCValue] = ["headline": "Filters"]
        if case .object(let o) = r["props"] { for (k, v) in o { properties[k] = v } }
        let initialModal = (properties["variant"]?.string ?? "standard") == "modal"
        if let v = state.variant { properties["variant"] = .string(v) }
        let rtl = r["dir"].string == "rtl"
        let model = AWCSideSheetModel(properties)
        let slots = AWCSideSheetSlots(
            content: AnyView(Text("Sheet content").modifier(AWCCSSLineBox(size: 14, line: 20)).frame(maxWidth: .infinity, minHeight: 120, maxHeight: 120, alignment: .topLeading)),
            actions: r["actions"] == .bool(true) ? AnyView(Group {
                AWCNativeView(node: .init(id: "save", tag: "md-button", properties: ["variant": "filled"], children: [.text("Save")])).fixedSize()
                AWCNativeView(node: .init(id: "cancel", tag: "md-button", properties: ["variant": "outlined"], children: [.text("Cancel")])).fixedSize()
            }) : nil)
        let sheet = AWCNativeSideSheet(id: "dut", model: model, theme: theme, open: Binding(get: { state.open }, set: { state.open = $0 }), slots: slots,
                                       emit: { name in state.events.append((name, CACurrentMediaTime() * 1000)) })
            .environment(\.layoutDirection, rtl ? .rightToLeft : .leftToRight)
        let main = ZStack(alignment: .topLeading) {
            Color.clear
            Rectangle().fill(Color(awcHex: theme.tokens["--md-sys-color-primary-container"] ?? "#EADDFF")).frame(width: 200, height: 120).offset(x: 16, y: 64)
            AWCNativeView(node: .init(id: "opener", tag: "md-button", properties: ["variant": "text"], children: [.text("Open")])) { e in
                if e.name == "mdClick" { state.controller.show() }
            }.fixedSize().offset(x: 16, y: 16).awcInspect(nodeID: "dut", part: "opener", name: "opener")
            AWCNativeView(node: .init(id: "after", tag: "md-button", properties: ["variant": "text"], children: [.text("After")])).fixedSize().offset(x: 16, y: 200)
        }
        .frame(minWidth: 0, maxWidth: .infinity, minHeight: 0, maxHeight: .infinity, alignment: .topLeading)
        return AWCModalScope {
            ZStack(alignment: .topLeading) {
                Color(awcHex: theme.tokens["--md-sys-color-surface"] ?? "#FFFBFE")
                // The oracle appends a modal sheet inside #main (a later switch to standard lays it out there) and a
                // standard one beside #main in the flex page.
                if initialModal { ZStack(alignment: .topLeading) { main; sheet } }
                else { SideMotionPage(sheetRight: (model.side == "end") != rtl) { main; sheet } }
            }
            .environment(\.layoutDirection, .leftToRight)
        }
        .awcSideSheetController(state.controller, for: "dut")
        .awcModalReducedMotion(state.reduced)
        .awcTheme(theme)
        .environment(\.awcNativePointerState, state.pointer)
        .awcNativeInspection(rootID: "dut", coordinateSpace: "awc-native-preview") { if state.epoch == epoch { state.measurements = $0 } }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .coordinateSpace(name: "awc-native-preview")
        .id(epoch)
    }
}
@main @MainActor enum NativeSideSheetMotionIntegration {
    static let state = SideMotionState()
    static var host: NSHostingView<SideMotionFixture>!, window: NSWindow!
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
    static func key(_ code: UInt16, _ text: String, shift: Bool = false) {
        for type in [NSEvent.EventType.keyDown, .keyUp] {
            let e = NSEvent.keyEvent(with: type, location: .zero, modifierFlags: shift ? [.shift] : [], timestamp: ProcessInfo.processInfo.systemUptime, windowNumber: window.windowNumber, context: nil, characters: text, charactersIgnoringModifiers: text, isARepeat: false, keyCode: code)!
            if code == 53 || code == 48 { NSApp.sendEvent(e) } else { window.sendEvent(e) }
        }
    }
    static func center(_ name: String) -> CGPoint? { state.measurements.first { $0.name == name }.map { CGPoint(x: $0.bounds.midX, y: $0.bounds.midY) } }
    /// Inspection frames refresh on layout, not on the render-only slide, so they can still carry the closed offset:
    /// anchor a control to the settled open position of its container (flush or 16 pt detached inset at either edge).
    static func openCenter(_ name: String, vw: CGFloat, detached: Bool) -> CGPoint? {
        guard var p = center(name) else { return nil }
        if let c = state.measurements.first(where: { $0.name == "container" })?.bounds {
            let inset: CGFloat = detached ? 16 : 0, right = vw - inset - c.width, left = inset
            let target = abs(c.minX - right) <= abs(c.minX - left) ? right : left
            p.x -= c.minX - target
        }
        return p
    }
    static func focused() -> String { (window.firstResponder as? NSView)?.accessibilityIdentifier() ?? "" }
    static func css(_ s: String) -> [Double] {
        var out: [Double] = [], cur = ""
        for ch in s { if "0123456789.-e".contains(ch) { cur.append(ch) } else { if let v = Double(cur) { out.append(v) }; cur = "" } }
        if let v = Double(cur) { out.append(v) }
        return out
    }
    struct Sample { let renderT: Double?; let opacity: Double?; let translate: Double?; let scrim: Double? }
    static func sample() -> Sample {
        let m = state.measurements
        let c = m.first { $0.name == "container-motion" }, s = m.first { $0.name == "scrim" }
        return .init(renderT: c?.metrics["renderTime"]?.number, opacity: c?.metrics["opacity"]?.number, translate: c?.metrics["translateX"]?.number, scrim: s?.metrics["opacity"]?.number)
    }
    static func expectedID(_ path: [String], _ text: String) -> String? {
        guard let leaf = path.last else { return nil }
        if leaf == "body" { return "" }
        if leaf.contains("#opener") { return "opener" }
        if leaf.contains("#after") { return "after" }
        if leaf.hasPrefix("md-icon-button") { return text == "Back" ? "dut.back-button" : "dut.close-button" }
        if leaf.contains("[slot=actions]") { return text.lowercased() }
        if leaf.contains("[part=container]") || leaf.hasPrefix("md-side-sheet") { return "dut.container" }
        return nil
    }
    static func run(_ r: AWCValue, reducedSet: Bool) {
        let name = (reducedSet ? "reduced/" : "") + r["name"].string
        let vp = r["vp"].array.map { CGFloat($0.number ?? 0) }
        let detached = r["props"]["detached"] == .bool(true)
        window.setContentSize(.init(width: vp[0], height: vp[1])); host.frame = .init(x: 0, y: 0, width: vp[0], height: vp[1])
        state.reduced = reducedSet; state.open = false; state.variant = nil; state.run = r; state.events = []; state.methods = []
        state.controller = AWCSideSheetController(); state.epoch += 1
        let rest = CGPoint(x: vp[0] - 2, y: vp[1] - 2)
        state.pointer.update(phase: .move, location: rest); mouse(.mouseMoved, rest); pump(0.4); _ = window.makeFirstResponder(nil); pump(0.05)
        let phases = r["phases"].array
        guard phases.count >= 2 else { check(false, "\(name) phases"); return }
        let webT0 = phases[0]["t"].number ?? 0, t0 = now()
        let webEventTimes = r["events"].array.compactMap { $0["t"].number }
        let stepWeb: [Double] = phases.indices.map { i in
            let start = phases[i]["t"].number ?? 0, end = i + 1 < phases.count ? (phases[i + 1]["t"].number ?? .infinity) : .infinity
            return webEventTimes.filter { $0 >= start && $0 < end }.min() ?? start
        }
        var stepTimes: [Int: Double] = [:], samples: [Sample] = [], focusAtEnd: [Int: String] = [:]
        var next = 1
        var standardNow: Bool { (state.variant ?? r["props"]["variant"].string) != "modal" }
        var tabbedStandard = Set<Int>()
        let end = (phases.last?["t"].number ?? 0) - webT0 + 560
        while now() - t0 < end {
            while next < phases.count && now() - t0 >= stepWeb[next] - webT0 {
                focusAtEnd[next - 1] = focused()
                let label = phases[next]["label"].string, step = String(label.split(separator: "-", maxSplits: 1).last ?? "")
                stepTimes[next] = now()
                if (step == "tab" || step == "shifttab") && standardNow { tabbedStandard.insert(next) }
                switch step {
                case "open": if let p = center("opener") { click(p) }
                case "escape": key(53, "\u{1b}")
                // Without an active modal, Tab is the host's key-view loop (AppKit `selectNextKeyView`).
                case "tab": if standardNow { window.selectNextKeyView(nil) } else { key(48, "\t") }
                case "shifttab": if standardNow { window.selectPreviousKeyView(nil) } else { key(48, "\t", shift: true) }
                case "scrim":
                    let c = state.measurements.first { $0.name == "container" }?.bounds ?? .zero
                    click(c.midX > vp[0] / 2 ? CGPoint(x: 12, y: 12) : CGPoint(x: vp[0] - 12, y: 12))
                case "close": if let p = openCenter("close", vw: vp[0], detached: detached) { click(p) }
                case "back": if let p = openCenter("back", vw: vp[0], detached: detached) { click(p) }
                case "show": let c = now(); state.controller.show(); state.methods.append(("show", c, c))
                case "hide":
                    let c = now(), controller = state.controller
                    controller.close()
                    Task { @MainActor in await controller.whenClosed(); state.methods.append(("whenClosed", c, now())) }
                case "toStandard": state.variant = "standard"
                case "toModal": state.variant = "modal"
                default: check(false, "\(name) unknown step \(step)")
                }
                next += 1
            }
            pump(); samples.append(sample())
        }
        pump(0.35)
        focusAtEnd[phases.count - 1] = focused()
        let webEvents = r["events"].array.map { ($0["name"].string, $0["t"].number ?? 0) }
        check(state.events.map(\.0) == webEvents.map(\.0), "\(name) events \(state.events.map(\.0)) vs \(webEvents.map(\.0))")
        func stepIndex(webT: Double) -> Int { var k = 0; for (i, p) in phases.enumerated() where (p["t"].number ?? 0) <= webT { k = i }; return k }
        for ((n, nt), (_, wt)) in zip(state.events, webEvents) {
            let k = stepIndex(webT: wt)
            guard let ns = stepTimes[k] else { continue }
            let nativeDelay = nt - ns, webDelay = wt - stepWeb[k]
            check(nativeDelay >= -1 && nativeDelay <= webDelay + 40, "\(name) \(n) \(nativeDelay) ms after its step (Chrome \(webDelay))")
        }
        // Known platform difference: a standard (non-modal) sheet does not trap Tab, so traversal is the host's key-view
        // loop, ordered geometrically by AppKit rather than in DOM order; the controls reached must be the same.
        if !tabbedStandard.isEmpty {
            let want = Set(tabbedStandard.compactMap { expectedID(phases[$0]["focus"]["path"].array.map(\.string), phases[$0]["focus"]["text"].string) })
            let got = Set(tabbedStandard.compactMap { focusAtEnd[$0] })
            check(want == got, "\(name) Tab reaches \(got.sorted()) vs Chrome \(want.sorted())")
        }
        for (i, p) in phases.enumerated() where !tabbedStandard.contains(i) {
            let path = p["focus"]["path"].array.map(\.string)
            if let want = expectedID(path, p["focus"]["text"].string), let got = focusAtEnd[i] {
                check(got == want || (want == "" && !got.hasPrefix("dut") && !["opener", "after", "save", "cancel"].contains(got)), "\(name) focus after \(p["label"].string): \(got) vs \(path.last ?? "")")
            }
        }
        var web: [(Double, [String: Double])] = []
        for p in phases { for s in p["samples"].array {
            let d = s["md-side-sheet#dut"], t = d["t"].number ?? 0
            var v: [String: Double] = [:]
            // Only the modal shell is sampled (a standard container has no shell motion, and is `display: none` closed).
            if d["host"]["display"].string == "contents" {
                if let o = d["container"]["opacity"].number { v["opacity"] = o }
                let m = css(d["container"]["transform"].string)
                if m.count == 6 { v["translate"] = m[4] } else if d["container"]["transform"].string == "none" { v["translate"] = 0 }
                if let o = d["scrim"]["opacity"].number { v["scrim"] = o }
            }
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
            for (key, value, tol) in [("opacity", s.opacity, 0.01), ("translate", s.translate, 0.6), ("scrim", s.scrim, 0.01)] {
                guard let v = value, let at = s.renderT else { continue }
                var lo = Double.infinity, hi = -Double.infinity, x = at - 34
                while x <= at + 40 { if let e = envelope(key, webTime(x)) { lo = min(lo, e.0); hi = max(hi, e.1) }; x += 2 }
                guard lo.isFinite else { continue }
                check(v >= lo - tol && v <= hi + tol, "\(name) \(key) \(v) at web \(webTime(at)) within Chrome [\(lo),\(hi)]"); compared += 1
            }
        }
        let modal = r["props"]["variant"].string == "modal"
        if modal { check(compared > 50, "\(name) rendered values compared (\(compared))") }
        else { check(samples.allSatisfy { $0.opacity == nil }, "\(name) standard sheet has no modal shell") }
        for a in r["anims"].array where ["container", "scrim"].contains(a["target"].string) {
            let duration = a["duration"].number ?? -1, easing = a["easing"].string
            check(abs(duration - (reducedSet ? 0 : 300)) < 0.5 && easing == "cubic-bezier(0.2, 0, 0, 1)", "\(name) \(a["target"].string) \(a["property"].string) timing \(duration) \(easing)")
        }
        if reducedSet || !modal { check(r["anims"].array.allSatisfy { !["container", "scrim"].contains($0["target"].string) }, "\(name) no shell transitions") }
        let webClosed = r["methods"].array.filter { $0["method"].string == "whenClosed" }
        let nativeClosed = state.methods.filter { $0.0 == "whenClosed" }
        for (i, m) in webClosed.enumerated() {
            let webDelay = (m["resolved"].number ?? 0) - (m["called"].number ?? 0)
            if i < nativeClosed.count { check(abs(nativeClosed[i].2 - nativeClosed[i].1 - webDelay) <= 45, "\(name) whenClosed after \(nativeClosed[i].2 - nativeClosed[i].1) ms (Chrome \(webDelay))") }
            else { check(false, "\(name) whenClosed resolved") }
        }
        report.append(["run": name, "samples": samples.count, "compared": compared, "events": state.events.map(\.0)])
        state.open = false; pump(0.5)
    }
    static func main() {
        _ = NSApplication.shared; NSApp.setActivationPolicy(.accessory)
        host = NSHostingView(rootView: SideMotionFixture(state: state))
        window = NSWindow(contentRect: .init(x: -20000, y: -20000, width: 800, height: 600), styleMask: [.borderless], backing: .buffered, defer: false)
        window.isReleasedWhenClosed = false; window.colorSpace = .sRGB; window.contentView = host; window.orderFrontRegardless(); pump(0.2)
        let fixtures = URL(fileURLWithPath: #filePath).deletingLastPathComponent().appendingPathComponent("Fixtures")
        let only = ProcessInfo.processInfo.environment["AWC_SIDE_ONLY"]
        for (file, reduced) in [("side-sheet-web-motion.json", false), ("side-sheet-web-motion-reduced.json", true)] {
            let oracle = try! JSONDecoder().decode(AWCValue.self, from: Data(contentsOf: fixtures.appendingPathComponent(file)))
            for r in oracle["runs"].array where only.map({ r["name"].string.contains($0) }) ?? true { run(r, reducedSet: reduced) }
        }
        if let out = ProcessInfo.processInfo.environment["AWC_SIDE_OUTPUT"] { try! JSONSerialization.data(withJSONObject: ["checks": checks, "failures": failures, "report": report], options: [.prettyPrinted, .sortedKeys]).write(to: URL(fileURLWithPath: out)) }
        print("Side sheet native motion: \(checks - failures.count)/\(checks) checks passed")
        window.close(); if !failures.isEmpty { exit(1) }
    }
}
