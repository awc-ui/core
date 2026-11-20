import AppKit
import SwiftUI
import Observation
import QuartzCore
@testable import AWCUI

// Button family interaction and motion against Mac Chrome 153 trusted-input records (gate-7 R1-03a–f;
// outputs/native-parity/button-family/web-reference: runs.js, states.html, and the reduced-motion set): pointer
// hover/press/release/leave/click, keyboard (Tab, Enter/Space, arrows, Escape), hard/soft disabled, property and method driven
// motion (FAB extend/collapse, setMenuIcon, split trailing check), FAB menu open/close/roving. Inputs replay at Chrome's recorded
// times. Checked per phase: md* events (order, target), focus, and every flat pixel of Chrome's phase screenshot against the
// native frames inside Chrome's recorded capture window [shotStart, shotEnd]; per frame of motion phases the root's border box
// width/height against Chrome's samples (one Chrome frame either side).
@Observable final class FamilyStatesState {
    var run: AWCValue = .null
    var epoch = 0
    var reduced = false
    var measurements: [AWCNativeInspectionNode] = []
    var events: [(String, String, String, Double)] = []    // name, tag, node id, ms
    let pointer = AWCNativePointerState()
    let fab = AWCFabController()
    /// When the fixture's view last took a changed run (a replayed `set`): the SwiftUI update the component's own onChange runs in.
    @ObservationIgnored var applied = 0.0
}
// Shared with NativeButtonFamilyPaintIntegration.swift (each fixture is its own single-file executable): keep in sync.
enum FamilyTree {
    /// The family.js node → AWCNode (ids: the authored id, else the index path "n0-1-2").
    static func node(_ v: AWCValue, _ id: String) -> AWCNode {
        if v["text"] != .null { return .text(v["text"].string) }
        if v["symbol"] != .null { return .symbol(v["symbol"].string, slot: v["slot"] == .null ? nil : v["slot"].string) }
        var props: [String: AWCValue] = [:]
        for (k, x) in v["props"].object { props[k] = x }
        for (k, x) in v["attrs"].object { props[k] = x }
        let kids = v["children"].array.enumerated().map { node($1, id + "-" + String($0)) }
        return AWCNode(id: v["id"] == .null ? id : v["id"].string, tag: v["tag"].string, properties: props, children: kids)
    }
    /// The inspection root: the first root's authored id, else "n0".
    static func rootID(_ c: AWCValue) -> String { let n = c["nodes"].array.first ?? .null; return n["id"] == .null ? "n0" : n["id"].string }
    /// Every authored appearance in the case, keyed by node id (one tag per node).
    static func appearances(_ v: AWCValue, _ id: String, into out: inout [(String, String, [String: AWCValue])]) {
        guard v["tag"] != .null else { return }
        let nid = v["id"] == .null ? id : v["id"].string
        if v["appearance"] != .null { out.append((v["tag"].string, nid, v["appearance"].object)) }
        for (i, c) in v["children"].array.enumerated() { appearances(c, id + "-" + String(i), into: &out) }
    }
}
/// Applies the case's hooks with each tag's public appearance API. Subtree scopes for root tags; md-segmented-button and
/// md-fab-menu-item target their node id (the source styles that one element).
struct FamilyAppearance: ViewModifier {
    let items: [(String, String, [String: AWCValue])]
    func body(content: Content) -> some View {
        var v = AnyView(content)
        for (tag, id, values) in items {
            switch tag {
            case "md-fab": v = AnyView(v.awcFabAppearance(.init(values: values)))
            case "md-icon-button": v = AnyView(v.awcIconButtonAppearance(.init(values: values)))
            case "md-button-group": v = AnyView(v.awcButtonGroupAppearance(.init(values: values)))
            case "md-segmented-button": v = AnyView(v.awcSegmentedButtonAppearance(.init(values: values), nodeID: id))
            case "md-split-button": v = AnyView(v.awcSplitButtonAppearance(.init(values: values)))
            case "md-fab-menu": v = AnyView(v.awcFabMenuAppearance(.init(values: values)))
            case "md-fab-menu-item": v = AnyView(v.awcFabMenuItemAppearance(.init(values: values), nodeID: id))
            default: break
            }
        }
        return v
    }
}
/// One case (or states run) of the family: the roots in the scope box Chrome used (left/top/width, direction, inherited density).
struct FamilyScene: View {
    let c: AWCValue
    let fab: AWCFabController
    let onEvent: (AWCEvent) -> Void
    var body: some View {
        let nodes = c["nodes"].array, roots = nodes.enumerated().map { FamilyTree.node($1, "n" + String($0)) }
        var looks: [(String, String, [String: AWCValue])] = []
        for (i, n) in nodes.enumerated() { FamilyTree.appearances(n, "n" + String(i), into: &looks) }
        let density = c["density"].number ?? .nan, dir: LayoutDirection = c["dir"].string == "rtl" ? .rightToLeft : .leftToRight
        let width = c["width"].number ?? 360, left = c["left"].number ?? 40, top = c["top"].number ?? 40
        return Group {
            if c["comp"].string == "fab-menu", roots.count == 2 {
                // The menu scope is the viewport (Chrome's md-fab-menu host is position: fixed, inset 0); the anchor sits in the scope box.
                AWCFabMenuScope {
                    AWCNativeView(node: roots[0], onEvent: onEvent).awcFabController(fab)
                        .frame(width: width, alignment: .topLeading).environment(\.layoutDirection, dir)
                        .offset(x: left, y: top)
                        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading).environment(\.layoutDirection, .leftToRight)
                    AWCNativeView(node: roots[1], onEvent: onEvent)
                }
                .modifier(FamilyAppearance(items: looks))
                .awcDensity(density)
                .environment(\.layoutDirection, dir)
            } else {
                VStack(alignment: .leading, spacing: 0) { ForEach(roots, id: \.id) { AWCNativeView(node: $0, onEvent: onEvent) } }
                    .modifier(FamilyAppearance(items: looks))
                    .frame(width: width, alignment: .topLeading)
                    .awcDensity(density)
                    .environment(\.layoutDirection, dir)
                    .offset(x: left, y: top)
            }
        }
    }
}
struct FamilyGrid {
    let x: Int, y: Int, w: Int, h: Int; var values: [Double]
    func at(_ px: Int, _ py: Int) -> [Double] { let i = ((py - y) * w + (px - x)) * 3; return [values[i], values[i + 1], values[i + 2]] }
    func flat(_ px: Int, _ py: Int, _ limit: Double) -> Bool {
        guard px - 1 >= x && py - 1 >= y && px + 1 < x + w && py + 1 < y + h else { return false }
        for c in 0..<3 { var lo = 999.0, hi = -1.0
            for dy in -1...1 { for dx in -1...1 { let v = values[((py + dy - y) * w + (px + dx - x)) * 3 + c]; lo = min(lo, v); hi = max(hi, v) } }
            if hi - lo > limit { return false } }
        return true
    }
}
/// Pixel helpers shared by the family paint and states suites.
@MainActor enum FamilyPixels {
    struct Shot { let cg: CGImage; let scale: Double; let origin: CGPoint }
    static func capture(_ host: NSView, _ r: CGRect) -> Shot {
        let rr = host.isFlipped ? r : CGRect(x: r.minX, y: host.bounds.height - r.maxY, width: r.width, height: r.height)
        let b = host.bitmapImageRepForCachingDisplay(in: rr)!; host.cacheDisplay(in: rr, to: b)
        return .init(cg: b.cgImage!, scale: Double(b.pixelsWide) / r.width, origin: r.origin)
    }
    static func grid(_ s: Shot, x: Int, y: Int, w: Int, h: Int) -> FamilyGrid {
        let k = max(1, Int(s.scale.rounded()))
        let crop = CGRect(x: (Double(x) - s.origin.x) * Double(k), y: (Double(y) - s.origin.y) * Double(k), width: Double(w * k), height: Double(h * k))
        var values = [Double](repeating: -999, count: w * h * 3)
        guard let cg = s.cg.cropping(to: crop), cg.width == w * k, cg.height == h * k else { return .init(x: x, y: y, w: w, h: h, values: values) }
        var buffer = [UInt8](repeating: 0, count: cg.width * cg.height * 4)
        buffer.withUnsafeMutableBytes { raw in
            let ctx = CGContext(data: raw.baseAddress, width: cg.width, height: cg.height, bitsPerComponent: 8, bytesPerRow: cg.width * 4, space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
            ctx.draw(cg, in: .init(x: 0, y: 0, width: cg.width, height: cg.height))
        }
        let n = Double(k * k)
        for py in 0..<h { for px in 0..<w { var sum = [0.0, 0.0, 0.0]
            for yy in (py * k)..<(py * k + k) { for xx in (px * k)..<(px * k + k) { let i = (yy * cg.width + xx) * 4; for c in 0..<3 { sum[c] += Double(buffer[i + c]) } } }
            for c in 0..<3 { values[(py * w + px) * 3 + c] = sum[c] / n } } }
        return .init(x: x, y: y, w: w, h: h, values: values)
    }
    struct Diff { let n: Int, bad: Int, mean: Double, worst: Double, worstAt: String; var ok: Bool { n > 200 && Double(bad) / Double(max(n, 1)) <= 0.005 && mean <= 1.0 } }
    /// Every pixel flat in both images (3×3 neighbourhood within 6/255) is compared; edges are the antialiasing both draw.
    static func diff(_ web: FamilyGrid, _ native: FamilyGrid) -> Diff {
        var n = 0, bad = 0, sum = 0.0, worst = 0.0, worstAt = ""
        for py in (web.y + 1)..<(web.y + web.h - 1) { for px in (web.x + 1)..<(web.x + web.w - 1) where web.flat(px, py, 6) && native.flat(px, py, 6) {
            let a = web.at(px, py), b = native.at(px, py); var d = 0.0; for k in 0..<3 { d = max(d, abs(a[k] - b[k])) }
            n += 1; sum += d; if d > 6 { bad += 1 }
            if d > worst { worst = d; worstAt = "(\(px),\(py)) web \(a.map { Int($0) }) native \(b.map { Int($0.rounded()) })" }
        } }
        return .init(n: n, bad: bad, mean: sum / Double(max(n, 1)), worst: worst, worstAt: worstAt)
    }
    static func webGrid(_ file: URL, _ clip: CGRect) -> FamilyGrid? {
        guard let cg = NSImage(contentsOf: file)?.cgImage(forProposedRect: nil, context: nil, hints: nil) else { return nil }
        return grid(.init(cg: cg, scale: 1, origin: clip.origin), x: Int(clip.minX), y: Int(clip.minY), w: Int(clip.width), h: Int(clip.height))
    }
    static func rect(_ v: AWCValue) -> CGRect { .init(x: v["x"].number ?? .nan, y: v["y"].number ?? .nan, width: v["width"].number ?? .nan, height: v["height"].number ?? .nan) }
}
#if os(iOS)
/// iOS: a frame of the capture window, taken as a render-server snapshot view (about 2 ms) and drawn to pixels after the window.
/// A hierarchy capture holds the main thread for a display frame or more (15-24 ms at 3x, fx-104), so SwiftUI's frame-driven
/// content skipped frames under it and the window held every second or third native frame, never two adjacent ones (fx-103).
/// The snapshot drawn later has the pixels of a direct capture of that moment (fx-104: identical on iOS 26.3 and 18.6; checked
/// once per process in `run`).
@MainActor enum FamilyFrames {
    static var verified = false
    static func take(_ host: UIView, _ r: CGRect) -> UIView? { host.snapshotView(afterScreenUpdates: false) }
    /// S921-01: whole-host snapshot in a clipping box (see NativeButtonStatesIntegration.develop).
    static func develop(_ frame: UIView, _ r: CGRect, in window: UIWindow) -> FamilyPixels.Shot? {
        let full = frame.bounds.size, rect = CGRect(origin: .zero, size: r.size)
        let box = UIView(frame: rect); box.clipsToBounds = true; box.backgroundColor = .white
        frame.frame = CGRect(x: -r.minX , y: -r.minY, width: full.width, height: full.height); box.addSubview(frame)
        window.addSubview(box); defer { box.removeFromSuperview(); frame.removeFromSuperview() }
        CATransaction.flush(); _ = RunLoop.current.run(mode: .default, before: Date().addingTimeInterval(0.02))
        let format = UIGraphicsImageRendererFormat(); format.scale = window.screen.scale; format.opaque = true; format.preferredRange = .standard
        let image = UIGraphicsImageRenderer(size: r.size, format: format).image { _ in _ = box.drawHierarchy(in: rect, afterScreenUpdates: true) }
        return image.cgImage.map { .init(cg: $0, scale: Double($0.width) / r.width, origin: r.origin) }
    }
}
#endif
struct FamilyStatesFixture: View {
    let state: FamilyStatesState
    var body: some View {
        let r = state.run, epoch = state.epoch, theme = AWCTheme.generated(dark: r["theme"].string == "dark")
        return ZStack(alignment: .topLeading) {
            AWCNativeView(node: .init(id: "before", tag: "md-button", properties: ["variant": "text"], children: [.text("Before")])).offset(x: 1000, y: 10)
            // Events are observed in the capture phase at the document, as the Chrome record (document capture listeners): a set or
            // menu that stops a child's proposal (mdSegmentClick) still shows it, exactly as in Chrome.
            if r != .null { AWCEventScope(id: "document", onCapture: { c in state.events.append((c.event.name, c.event.tag, c.event.nodeID, CACurrentMediaTime() * 1000)) }, onEvent: { _ in }) { FamilyScene(c: r, fab: state.fab) { _ in } } }
            AWCNativeView(node: .init(id: "after", tag: "md-button", properties: ["variant": "text"], children: [.text("After")])).offset(x: 10, y: 860)
        }
        .onChange(of: r) { state.applied = CACurrentMediaTime() * 1000 }
        .awcReducedMotion(state.reduced)
        .awcTheme(theme)
        .awcNativeInspection(rootID: FamilyTree.rootID(r), coordinateSpace: "awc-native-preview") { if state.epoch == epoch { state.measurements = $0 } }
        .environment(\.awcNativePointerState, state.pointer)
        .id(epoch)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(theme.background).coordinateSpace(name: "awc-native-preview")
    }
}
@main @MainActor enum NativeButtonFamilyStatesIntegration {
    static let state = FamilyStatesState()
    static var host: NSHostingView<FamilyStatesFixture>!, window: NSWindow!
    static var checks = 0, failures: [String] = []
    static var report: [[String: Any]] = []
    static let env = ProcessInfo.processInfo.environment
    static let captureDir = env["AWC_FAMILY_STATES_CAPTURE_DIRECTORY"].map { URL(fileURLWithPath: $0) }
    /// Chrome photographs a phase on demand, at any moment of its animation clock, while native frames come on display frames;
    /// across a fast fade (click2's 150 ms ripple release) Chrome's photo can fall between two native frames and match neither on
    /// a large surface. When two consecutive distinct captured frames straddle Chrome's image (one darker, one lighter over the
    /// compared pixels), the frame at Chrome's moment is their blend (1 - w)·A + w·B, checked with the same thresholds (md-button's
    /// states fixture: di-054, ios-harness.md item 46). Only frames at most one display frame apart (+4 ms) bracket: across a native
    /// stall the blend would stand for frames never drawn (R1-14). AWC_FAMILY_STATES_BRACKET=0: off.
    static let bracketFallback = env["AWC_FAMILY_STATES_BRACKET"] != "0"
    /// iOS: while a ripple wave is growing or fading at Chrome's capture window (click2 and key activations: the only transition
    /// whose photo moment matters within a frame), captures continue two display frames past the window. A simulator capture
    /// shows the last committed frame, up to a frame plus TimelineView's content offset older than the capture (md-button's
    /// states fixture, ios-harness.md item 47). The frames are counted, not timed: the window ends with the second frame taken
    /// past it, within three frame times (fx-106, iOS 18.6: the second frame came 1 ms after two frame times and Chrome's photo
    /// lay between it and the frame before). The phase clock keeps the extension from making the next phase late.
    /// AWC_FAMILY_STATES_WINDOW_EXTRA=<ms>: another extension (0: Chrome's window only).
    static let windowExtra = Double(env["AWC_FAMILY_STATES_WINDOW_EXTRA"] ?? "") ?? 2000.0 / 60
    /// Each phase runs on its own clock, started when its first input is applied, as Chrome's phase starts with its input. When
    /// the previous phase's captures overran its window (an iOS hierarchy capture holds the main thread 20-50 ms on a loaded
    /// host, fx-097b), the phase's inputs, box samples and capture window keep Chrome's distances from the phase start
    /// (md-button's states fixture, gate-7 R1-01). AWC_FAMILY_STATES_SHOT_ANCHOR=t0: the run clock for every phase.
    static let phaseClock = env["AWC_FAMILY_STATES_SHOT_ANCHOR"] != "t0"
    /// The sampler runs on the main thread, as SwiftUI does. When a turn of its loop took longer than a display frame (+4 ms),
    /// nothing was drawn meanwhile, so the box read next is the frame from before that hold: it is compared with Chrome's frames
    /// back to the hold's start, at most three display frames (fx-105b: a 28 ms host stall in mid-morph failed one sample).
    /// iOS: the same when the display did not tick for more than a frame and a half (a loaded simulator skips frames while the
    /// main thread runs: fx-106, 18.6, the morph's box unchanged across 30-40 ms of samples). Both are measured here, counted and
    /// printed with the summary; a failed box's BOXES line shows the display frame of every sample.
    static var holdCount = 0, holdLongest = 0.0, stallCount = 0, stallLongest = 0.0, applyLongest = 0.0, leadCount = 0, lateStallBoxes = 0
    /// Reproducer for a display frame lost mid-motion (R1-17, iOS 18.6 under load: the group's box unchanged on one display frame
    /// across +43/+53/+63 ms of key3-Enter, then one frame later 2.5 px wider). AWC_FAMILY_STATES_DROP_FRAME=<case>/<phase>:<from>:<ms>
    /// freezes, from <from> ms after the phase's start for <ms> ms, the box the sampler reads and the display frame it counts: the
    /// samples read in that stretch are the frame from before it, as when the display skipped a tick.
    static let dropFrame: (phase: String, from: Double, ms: Double)? = {
        guard let v = env["AWC_FAMILY_STATES_DROP_FRAME"] else { return nil }
        let p = v.split(separator: ":").map(String.init)
        guard p.count == 3, let f = Double(p[1]), let m = Double(p[2]) else { return nil }
        return (p[0], f, m)
    }()
    /// AWC_FAMILY_STATES_STALL_LATE=0: boxes read before a stall is known are not compared back (the behaviour before R1-17).
    static let lateStall = env["AWC_FAMILY_STATES_STALL_LATE"] != "0"
    static func bracket(_ web: FamilyGrid, _ frames: [(at: Double, grid: FamilyGrid)], ticks: [Double: Int] = [:]) -> (ok: Bool, a: Double, b: Double, w: Double, mean: Double, bad: Int, n: Int)? {
        // A run of identical captures is one native frame, on screen from its first capture to its last. Two frames are adjacent
        // when the later one's first capture follows the earlier one's last within a display frame (+4 ms), or (iOS, `ticks`: the
        // display frame of each capture) on the very next display tick: a display that stalled drew no frame in between, and the
        // BRACKET line reports the stall (gate-7 R1-14).
        var distinct: [(at: Double, until: Double, grid: FamilyGrid)] = []
        for f in frames { if let last = distinct.last, zip(last.grid.values, f.grid.values).allSatisfy({ abs($0 - $1) < 0.5 }) { distinct[distinct.count - 1].until = f.at; continue }; distinct.append((f.at, f.at, f.grid)) }
        var best: (ok: Bool, a: Double, b: Double, w: Double, mean: Double, bad: Int, n: Int)? = nil
        for (fa, fb) in zip(distinct, distinct.dropFirst()) where fb.at - fa.until <= 1000.0 / 60 + 4 || (ticks[fb.at].flatMap { next in ticks[fa.until].map { next - $0 == 1 } } ?? false) {
            var pixels: [(Int, Int)] = [], sa = 0.0, sb = 0.0
            for py in (web.y + 1)..<(web.y + web.h - 1) { for px in (web.x + 1)..<(web.x + web.w - 1) where web.flat(px, py, 6) && fa.grid.flat(px, py, 6) && fb.grid.flat(px, py, 6) {
                pixels.append((px, py)); let c0 = web.at(px, py), a = fa.grid.at(px, py), b = fb.grid.at(px, py)
                for c in 0..<3 { sa += a[c] - c0[c]; sb += b[c] - c0[c] }
            } }
            guard pixels.count > 200 else { continue }
            sa /= Double(pixels.count * 3); sb /= Double(pixels.count * 3)
            guard sa * sb < 0 else { continue }
            for k in 1...19 {
                let w = Double(k) / 20; var bad = 0, sum = 0.0
                for (px, py) in pixels {
                    let c0 = web.at(px, py), a = fa.grid.at(px, py), b = fb.grid.at(px, py); var d = 0.0
                    for c in 0..<3 { d = max(d, abs((1 - w) * a[c] + w * b[c] - c0[c])) }
                    sum += d; if d > 6 { bad += 1 }
                }
                let mean = sum / Double(pixels.count), ok = Double(bad) / Double(pixels.count) <= 0.005 && mean <= 1.0
                if best == nil || (ok && !best!.ok) || (ok == best!.ok && mean < best!.mean) { best = (ok, fa.until, fb.at, w, mean, bad, pixels.count) }
            }
        }
        return best
    }
    static func check(_ value: Bool, _ name: String) { checks += 1; if !value { failures.append(name); print("FAIL: " + name); fflush(stdout) } }
    static func now() -> Double { CACurrentMediaTime() * 1000 }
    static func pump(_ duration: Double = 0.004) { let end = Date().addingTimeInterval(duration); repeat { while let e = NSApp.nextEvent(matching: .any, until: .distantPast, inMode: .default, dequeue: true) { NSApp.sendEvent(e) }; host.layoutSubtreeIfNeeded(); RunLoop.current.run(until: Date().addingTimeInterval(0.002)) } while Date() < end }
    static func mouse(_ type: NSEvent.EventType, _ p: CGPoint) {
        let loc = host.convert(NSPoint(x: p.x, y: host.isFlipped ? p.y : host.bounds.height - p.y), to: nil)
        // Through the application queue (as real input): local event monitors (the FAB menu's outside click) see it too.
        NSApp.postEvent(NSEvent.mouseEvent(with: type, location: loc, modifierFlags: [], timestamp: ProcessInfo.processInfo.systemUptime, windowNumber: window.windowNumber, context: nil, eventNumber: 1, clickCount: 1, pressure: type == .leftMouseUp ? 0 : 1)!, atStart: false)
        while let e = NSApp.nextEvent(matching: .any, until: .distantPast, inMode: .default, dequeue: true) { NSApp.sendEvent(e) }
    }
    static let keys: [String: (UInt16, String)] = ["Tab": (48, "\t"), "Enter": (36, "\r"), "Space": (49, " "), "Escape": (53, "\u{1b}"),
        "ArrowLeft": (123, String(UnicodeScalar(NSLeftArrowFunctionKey)!)), "ArrowRight": (124, String(UnicodeScalar(NSRightArrowFunctionKey)!)),
        "ArrowDown": (125, String(UnicodeScalar(NSDownArrowFunctionKey)!)), "ArrowUp": (126, String(UnicodeScalar(NSUpArrowFunctionKey)!))]
    static func key(_ name: String) {
        guard let (code, text) = keys[name] else { return }
        let flags: NSEvent.ModifierFlags = code >= 123 ? [.numericPad, .function] : []
        window.sendEvent(NSEvent.keyEvent(with: .keyDown, location: .zero, modifierFlags: flags, timestamp: ProcessInfo.processInfo.systemUptime, windowNumber: window.windowNumber, context: nil, characters: text, charactersIgnoringModifiers: text, isARepeat: false, keyCode: code)!)
        window.sendEvent(NSEvent.keyEvent(with: .keyUp, location: .zero, modifierFlags: flags, timestamp: ProcessInfo.processInfo.systemUptime, windowNumber: window.windowNumber, context: nil, characters: text, charactersIgnoringModifiers: text, isARepeat: false, keyCode: code)!)
    }
    static func all(_ v: NSView) -> [NSView] { [v] + v.subviews.flatMap(all) }
    static func focusView(_ id: String) -> AWCNativeButtonFocusView? { all(host).compactMap { $0 as? AWCNativeButtonFocusView }.first { $0.configuration?.id == id } }
    static func focusedID() -> String { (window.firstResponder as? AWCNativeButtonFocusView)?.configuration?.id ?? "body" }
    /// Tag of a node id in the run's tree ("before" for the page's button).
    static func tag(of id: String, in r: AWCValue) -> String {
        if id == "before" || id == "after" || id == "body" { return id }
        for (i, n) in r["nodes"].array.enumerated() {
            let rid = n["id"] == .null ? "n" + String(i) : n["id"].string
            if id == rid || id.hasPrefix(rid + "/") || id.hasPrefix(rid + ".") { return n["tag"].string }
            for (j, c) in n["children"].array.enumerated() where c["tag"] != .null {
                let cid = c["id"] == .null ? rid + "-" + String(j) : c["id"].string
                if id == cid || id.hasPrefix(cid + "/") || id.hasPrefix(cid + "-") || id.hasPrefix(cid + ".") { return c["tag"].string }
            }
        }
        return id
    }
    /// Applies a recorded `set` action to the run's node tree (the view updates in place: same epoch).
    static func set(_ a: AWCValue) {
        var nodes = state.run["nodes"].array, root = nodes[Int(a["at"]["root"].number ?? 0)].object
        func put(_ n: inout [String: AWCValue]) { var p = n["props"]?.object ?? [:]; p[a["prop"].string] = a["value"]; n["props"] = .object(p) }
        if let ci = a["at"]["child"].number { var kids = root["children"]?.array ?? []; var k = kids[Int(ci)].object; put(&k); kids[Int(ci)] = .object(k); root["children"] = .array(kids) } else { put(&root) }
        nodes[Int(a["at"]["root"].number ?? 0)] = .object(root)
        var o = state.run.object; o["nodes"] = .array(nodes); state.run = .object(o)
    }
    static func run(_ r: AWCValue, shotDir: URL, reduced: Bool) {
        let name = r["name"].string, label = (reduced ? "reduced/" : "") + name
        state.reduced = reduced; state.run = r; state.pointer.update(phase: .leave); state.epoch += 1; pump(0.4)
        _ = window.makeFirstResponder(nil); state.events = []; pump(0.05)
        Task { await state.fab.setMenuIcon(nil) }
        let away = CGPoint(x: 1190, y: 600)
        if let f = state.measurements.first(where: { $0.id == "component" })?.bounds, let rest = r["rest"].array.first {
            check(abs(f.minX - (rest["x"].number ?? 0)) <= 1 && abs(f.minY - (rest["y"].number ?? 0)) <= 0.75 && abs(f.width - (rest["width"].number ?? 0)) <= 1 && abs(f.height - (rest["height"].number ?? 0)) <= 0.75, "\(label) rest box \(f) vs \(rest)")
        } else { check(false, "\(label) measured") }
        func hoverTo(_ q: CGPoint) { state.pointer.update(phase: .move, location: q); mouse(.mouseMoved, q) }
        func down(_ q: CGPoint) { state.pointer.update(phase: .down, location: q); mouse(.leftMouseDown, q) }
        func up(_ q: CGPoint) { mouse(.leftMouseDragged, q); mouse(.leftMouseUp, q); state.pointer.update(phase: .up, location: q) }
        func leave() { hoverTo(away); state.pointer.update(phase: .leave) }
        func at(_ a: AWCValue) -> CGPoint { .init(x: a["x"].number ?? away.x, y: a["y"].number ?? away.y) }
        #if os(iOS)
        // Once per process, on a run's rest state: a snapshot frame drawn later has the pixels of a direct capture.
        if !FamilyFrames.verified, let frame = FamilyFrames.take(host, FamilyPixels.rect(r["clip"])) {
            FamilyFrames.verified = true
            let c = FamilyPixels.rect(r["clip"]), direct = FamilyPixels.capture(host, c)
            let a = FamilyPixels.grid(direct, x: Int(c.minX), y: Int(c.minY), w: Int(c.width), h: Int(c.height))
            let b = FamilyFrames.develop(frame, c, in: window).map { FamilyPixels.grid($0, x: Int(c.minX), y: Int(c.minY), w: Int(c.width), h: Int(c.height)) }
            check(b.map { zip(a.values, $0.values).allSatisfy { abs($0 - $1) < 0.01 } } ?? false, "iOS snapshot frame equals a direct capture (\(label) rest)")
            pump(0.035)
        }
        #endif
        let phases = r["phases"].array, webT0 = phases.first?["t"].number ?? 0, t0 = now()
        let clip = FamilyPixels.rect(r["clip"])
        var snaps: [(Int, [(Double, FamilyPixels.Shot)], String, [(Double, CGRect)])] = []
        var holds: [Double: Double] = [:]   // box sample time -> the main-thread hold or display stall before it (ms)
        var ticks: [Double: Int] = [:]      // iOS: box sample time -> the display frame it was read in
        var shotTicks: [Double: Int] = [:]  // iOS: captured frame time -> its display frame
        for (i, phase) in phases.enumerated() {
            let lbl = phase["label"].string, acts = phase["actions"].array
            // A click (down + up in one phase): Chrome's wave starts the frame after the press and the click follows the release;
            // a same-turn native down/up never shows the pressed state, so press one frame before Chrome's wave and release at its click.
            let isClick = acts.count >= 2 && acts.contains { $0["type"].string == "down" } && acts.contains { $0["type"].string == "up" }
            var plan: [(Double, AWCValue)] = acts.map { (($0["t"].number ?? phase["t"].number!) - webT0, $0) }
            if isClick, let d = acts.firstIndex(where: { $0["type"].string == "down" }), let u = acts.firstIndex(where: { $0["type"].string == "up" }) {
                let t = phase["t"].number!
                let wave = r["anims"].array.first { $0["phase"].string == lbl && $0["target"].string.contains("ripple__wave") && $0["startTime"] != .null }?["startTime"].number
                // Chrome's click: the first event the press produced - the DOM click, or the component's own click event where the record
                // has no DOM click (mdClick in a button group, mdSegmentClick in a segmented set).
                let click = r["events"].array.first { ($0["t"].number ?? 0) >= t && ($0["t"].number ?? 0) <= t + 200 }?["t"].number
                if let wave { plan[d].0 = max(plan[d].0, wave - 16 - webT0) }
                plan[u].0 = max(plan[d].0 + 4, (click ?? (plan[u].0 + webT0)) - webT0)
            }
            // A property set / method call replays at Chrome's recorded time: a CSS transition is timed from the style change and
            // the native motion from the property change (md-fab extend, gate-7 R1-12), so neither side needs a lead.
            let first = plan.map { $0.0 }.min() ?? (phase["t"].number ?? webT0) - webT0
            while now() - t0 < first { pump() }
            var late = phaseClock ? max(0, now() - t0 - first) : 0
            func clock() -> Double { now() - t0 - late }
            for (n, (due, a)) in plan.enumerated() {
                while clock() < due { pump() }
                switch a["type"].string {
                case "move": hoverTo(at(a))
                case "down": down(at(a))
                case "up": up(at(a))
                case "away": leave()
                case "key": key(a["key"].string)
                case "focusBefore": leave(); _ = focusView("before")?.requestNativeFocus(); pump(0.02)
                case "set":
                    let setAt = now(); state.applied = 0; set(a)
                    // A phase that starts with a property set starts its clock when the view has taken the property: the update that
                    // applies it runs in the next turn, and the motion is timed from there (as md-card's shots are timed from the
                    // delivered input, ios-harness.md item 41). On a loaded simulator the update came 27 ms after the set (fx-109),
                    // which left the whole morph that much behind Chrome's clock and one stalled frame away from a failed sample.
                    // The update is seen by the fixture's own onChange (same SwiftUI update as the component's): the rest of that
                    // turn (commit, render: 20 ms and more on a loaded simulator, fx-112) is motion time, not latency.
                    if n == 0, phaseClock {
                        pump(); let turn = now() - setAt
                        while state.applied < setAt, now() - setAt < 60 { pump() }
                        let latency = state.applied >= setAt ? state.applied - setAt : turn
                        late += latency; applyLongest = max(applyLongest, latency)
                    }
                case "call": if a["method"].string == "setMenuIcon" { let icon = a["args"].array.first.flatMap { $0 == .null ? nil : $0.string }; Task { await state.fab.setMenuIcon(icon) } }
                default: break
                }
            }
            let start = (phase["t"].number ?? webT0) - webT0, next = i + 1 < phases.count ? phases[i + 1]["t"].number! - webT0 : start + 500
            let shotStart = (phase["shotStart"].number ?? next + webT0) - webT0, shotEnd = min(next, (phase["shotEnd"].number ?? next + webT0) - webT0)
            let windowEnd = max(shotStart, min(shotEnd, next - 3))
            #if os(iOS)
            // md-ripple grows for 450 ms from the frame after the press and fades for 150 ms from the release, or from the grow's end
            // when the release came first (click2, Enter/Space): still running at Chrome's window when that begins before its end.
            let waves = r["anims"].array.filter { $0["phase"].string == lbl && $0["target"].string.contains("ripple__wave") }
            let phaseT = phase["t"].number ?? webT0, grow = waves.first { $0["duration"].number == 450 }
            let waveEnd = (grow.map { ($0["startTime"].number ?? phaseT + 17) + 450 } ?? phaseT + 17) + (waves.contains { $0["duration"].number == 150 } ? 150 : 0) + 17 - webT0
            let extraFrames = !waves.isEmpty && shotStart < waveEnd ? Int((windowExtra * 60 / 1000).rounded()) : 0
            let captureEnd = windowEnd + Double(extraFrames) * 1.5 * 1000 / 60
            #else
            let captureEnd = windowEnd
            #endif
            var due = Array(stride(from: max(start, shotStart - 4), through: captureEnd, by: 5.0)), shots: [(Double, FamilyPixels.Shot)] = [], boxes: [(Double, CGRect)] = []
            var lastBox = -100.0, lastTurn = now(), held = 0.0
            var sinceTick: [Double] = []   // box samples read since the display last ticked (as this loop sees it)
            var frozen: CGRect? = nil, lastBound: CGRect? = nil, dropDone = false, dropUntil = -1.0
            let phaseStart = (phase["t"].number ?? webT0) - webT0
            #if os(iOS)
            var frames: [(Double, UIView)] = [], lastFrame = -1, past = 0
            var tick = AWCShimFrameClock.frames, tickAt = now(), stalled = 0.0, stalledUntil = 0.0
            #endif
            while clock() < captureEnd {
                let at = clock(); held = max(held, now() - lastTurn); lastTurn = now()
                #if os(iOS)
                // The display's ticks as this loop sees them (every few ms): a gap over a frame and a half is a stall; the box read
                // during it, and the first one after it (SwiftUI redraws on that tick), is the frame from before it.
                var dropping = at < dropUntil
                if !dropping { frozen = nil }
                // The reproducer: from <from> ms on the display shows the frame it showed before, for <ms> ms, and its last tick counts as
                // just seen (R1-17: f9989 first seen at +43 ms, still on screen at +63, the next tick at +75).
                if let d = dropFrame, "\(label)/\(lbl)" == d.phase, !dropDone, at - phaseStart >= d.from, let kept = lastBound {
                    dropDone = true; dropUntil = at + d.ms; dropping = true; frozen = kept; tickAt = now()
                    print("DROPPED-FRAME \(label)/\(lbl): from +\(Int(at - phaseStart)) ms the box stays \(kept.width) and the display frame \(tick) for \(Int(d.ms)) ms")
                }
                if !dropping, AWCShimFrameClock.frames != tick {
                    if now() - tickAt > 1500.0 / 60 {
                        stalled = now() - tickAt; stalledUntil = now() + 10; stallCount += 1; stallLongest = max(stallLongest, stalled)
                        // A stall is known only when the display ticks again: the box samples read since the last tick (they showed
                        // that tick's frame, drawn before the stall began) are compared back to its start like those read after
                        // 1.5 frames of it (R1-17: 18.6 under load, +43/+53/+63 ms on one frame, the next tick 32 ms later).
                        for s in sinceTick where lateStall { holds[s] = min(max(holds[s] ?? 0, stalled), 50); lateStallBoxes += 1 }
                    }
                    tick = AWCShimFrameClock.frames; tickAt = now(); sinceTick = []
                }
                let stall = now() - tickAt > 1500.0 / 60 ? now() - tickAt : now() < stalledUntil ? stalled : 0
                #else
                let stall = 0.0
                #endif
                if at - lastBox >= 8, let real = state.measurements.first(where: { $0.id == "component" })?.bounds {
                    let b = frozen ?? real; if frozen == nil { lastBound = real }
                    boxes.append((at + webT0, b)); lastBox = at; sinceTick.append(at + webT0)
                    if held > 1000.0 / 60 + 4 { holdCount += 1; holdLongest = max(holdLongest, held) }
                    if max(held > 1000.0 / 60 + 4 ? held : 0, stall) > 0 { holds[at + webT0] = min(max(held, stall), 50) }
                    #if os(iOS)
                    ticks[at + webT0] = tick
                    #endif
                    held = 0
                }
                #if os(iOS)
                // One snapshot view per display frame (FamilyFrames); drawn to pixels after the window.
                if let d = due.first, at >= d, AWCShimFrameClock.frames != lastFrame, let frame = FamilyFrames.take(host, clip) { frames.append((at + webT0, frame)); lastFrame = AWCShimFrameClock.frames; shotTicks[at + webT0] = lastFrame; if at > windowEnd { past += 1 } }
                if at > windowEnd, past >= extraFrames { break }
                #else
                if let d = due.first, at >= d { shots.append((at + webT0, FamilyPixels.capture(host, clip))); due.removeAll { $0 <= at }; lastTurn = now() }
                #endif
                pump()
            }
            #if os(iOS)
            // Drawing the snapshots adds and removes views in the window; two quiet frames follow, so the next phase's input meets
            // an idle main thread (fx-105: a set right after them reached the view 30-40 ms late). The phase clock absorbs both.
            shots = frames.compactMap { item in FamilyFrames.develop(item.1, clip, in: window).map { (item.0, $0) } }
            if !frames.isEmpty { pump(0.035) }
            #endif
            if shots.isEmpty { shots.append((clock() + webT0, FamilyPixels.capture(host, clip))) }
            snaps.append((i, shots, focusedID(), boxes))
        }
        pump(0.15)
        // Events: md* names in order with their target tag (DOM click excluded).
        let web = r["events"].array.filter { $0["name"].string != "click" }
        let mine = state.events.map { "\($0.0)@\($0.1)" }, theirs = web.map { "\($0["name"].string)@\($0["target"]["tag"].string)" }
        check(mine == theirs, "\(label) events \(mine) vs \(theirs)")
        let wg0 = clip
        for (i, shots, focused, boxes) in snaps {
            let ph = phases[i], lbl = ph["label"].string
            let webActive = ph["active"]["host"].string, nativeActive = tag(of: focused, in: r)
            let norm: (String) -> String = { ["body", "before", "after", "fm-anchor"].contains($0) ? $0 : ($0.hasPrefix("md-") ? $0 : "other") }
            // Tab past the page's last stop: Chrome hands focus to the browser UI (activeElement = body); the native key loop wraps.
            let leftPage = webActive == "body" && i > 0 && phases[i - 1]["active"]["host"].string == "after" && ph["actions"].array.contains { $0["key"].string == "Tab" }
            check(norm(nativeActive == "md-fab" && webActive == "fm-anchor" ? "fm-anchor" : nativeActive) == norm(webActive) || (webActive == "fm-anchor" && focused == "fm-anchor") || (leftPage && ["before", "body"].contains(nativeActive)), "\(label)/\(lbl) focus \(focused) (\(nativeActive)) vs \(webActive)")
            // Motion: the root's border box per frame against Chrome's samples ±1 Chrome frame.
            let all = phases.flatMap { $0["samples"].array }
            // Chrome frames shown within one frame of t: the samples within ±17 ms and the frame still on screen 17 ms before
            // (the last earlier sample, possibly the previous phase's); `back` ms further into the past after a hold or a stall.
            func near(_ t: Double, back: Double, ahead: Double = 0) -> [CGRect] {
                let before = all.last { ($0["t"].number ?? 1e9) < t - 17 - back }
                // Before the first sample the frame on screen is the rest frame (a set at the run's start).
                let restFrame: [CGRect] = before == nil ? r["rest"].array.prefix(1).map { FamilyPixels.rect($0) } : []
                let sampled: [CGRect] = (all.filter { let x = $0["t"].number ?? -1e9; return x >= t - 17 - back && x <= t + 17 + ahead } + (before.map { [$0] } ?? [])).compactMap { $0["comps"].array.first.map { FamilyPixels.rect($0["rect"]) } }
                return sampled + restFrame
            }
            // Chrome reacts to an input in its first frame after it - the phase's first sample, 10-15 ms after a property set and
            // 25-46 ms after a pointer event in the record - and its transition clock starts there; the native motion clock starts
            // at the input itself (md-fab extend, the button group's width motion). A native sample can therefore show what Chrome
            // shows that much later: a sample outside the ±1 frame window is compared `lead` ms further ahead (at most two display
            // frames), and the summary counts those samples (fx-112: a group's press width 1.64 px in at +24 ms, Chrome's at +43).
            let lead: Double = { guard let a = ph["actions"].array.first, let s = ph["samples"].array.first?["t"].number else { return 0 }; return max(0, min(2000.0 / 60, s - (a["t"].number ?? ph["t"].number ?? s))) }()
            func fits(_ b: CGRect, _ near: [CGRect]) -> Bool {
                let okW = near.contains { abs($0.width - b.width) <= 1.5 } || (near.map(\.width).min()! - 1.5...near.map(\.width).max()! + 1.5).contains(b.width)
                let okH = near.contains { abs($0.height - b.height) <= 1.5 } || (near.map(\.height).min()! - 1.5...near.map(\.height).max()! + 1.5).contains(b.height)
                return okW && okH
            }
            var boxFailed = false
            for (t, b) in boxes {
                var frames = near(t, back: holds[t] ?? 0)
                guard !frames.isEmpty else { continue }
                var ok = fits(b, frames)
                if !ok, lead > 0 { frames = near(t, back: holds[t] ?? 0, ahead: lead); ok = fits(b, frames); if ok { leadCount += 1 } }
                check(ok, "\(label)/\(lbl) box at +\(Int(t - (ph["t"].number ?? 0))) ms \(b.size) vs Chrome \(frames.map(\.size))")
                if !ok { boxFailed = true }
            }
            // A failed box lists the phase's native samples: time from the phase start, width x height, on iOS the display frame the
            // sample was read in (f) and any hold / stall before it (h, ms). A stale stretch on one display frame is a display stall.
            if boxFailed || dropFrame.map({ "\(label)/\(lbl)" == $0.phase }) == true { print("BOXES \(label)/\(lbl): " + boxes.map { String(format: "+%.0f %.2fx%.2f", $0.0 - (ph["t"].number ?? 0), $0.1.width, $0.1.height) + (ticks[$0.0].map { " f\($0)" } ?? "") + (holds[$0.0].map { String(format: " h%.0f", $0) } ?? "") }.joined(separator: " | ")); fflush(stdout) }
            guard let wg = FamilyPixels.webGrid(shotDir.appendingPathComponent(name + "-" + lbl + ".png"), wg0) else { check(false, "\(label)/\(lbl) shot"); continue }
            var best: (FamilyPixels.Diff, Double, FamilyPixels.Shot)? = nil
            for (at, shot) in shots {
                let d = FamilyPixels.diff(wg, FamilyPixels.grid(shot, x: Int(wg0.minX), y: Int(wg0.minY), w: Int(wg0.width), h: Int(wg0.height)))
                if best == nil || (d.ok && !best!.0.ok) || (d.ok == best!.0.ok && d.mean < best!.0.mean) { best = (d, at, shot) }
            }
            let b = best!
            var matched = b.0.ok, between = ""
            if !matched, bracketFallback, shots.count > 1,
               let m = bracket(wg, shots.map { (at: $0.0, grid: FamilyPixels.grid($0.1, x: Int(wg0.minX), y: Int(wg0.minY), w: Int(wg0.width), h: Int(wg0.height))) }, ticks: shotTicks) {
                let stall = m.b - m.a > 1000.0 / 60 + 4 ? String(format: "; the display stalled %.0f ms between them (consecutive display frames)", m.b - m.a) : ""
                print(String(format: "BRACKET %@/%@ %@: between native frames at web %.1f and %.1f, blend w %.2f: mean %.3f, >6: %ld/%ld (best single frame mean %.3f)", label, lbl, m.ok ? "match" : "no match", m.a, m.b, m.w, m.mean, m.bad, m.n, b.0.mean) + stall); fflush(stdout)
                if m.ok { matched = true; between = String(format: "; Chrome's frame between native frames at web %.1f and %.1f (blend w %.2f: mean %.3f)", m.a, m.b, m.w, m.mean) + stall }
            }
            check(matched, "\(label)/\(lbl) flat pixels match (mean \(b.0.mean), >6: \(b.0.bad)/\(b.0.n), \(b.0.worstAt); best of \(shots.count) frames in Chrome's capture window\(between))")
            if !matched || env["AWC_FAMILY_STATES_FRAMES"] == "1" {
                // A failed shot (AWC_FAMILY_STATES_FRAMES=1: every shot) lists each captured frame against Chrome's photo: time from
                // the phase start, mean |difference|, signed mean (native - Chrome) and pixels over 6, so a frame Chrome's photo
                // lies between (or a capture gap) shows.
                let frames = shots.map { item -> String in
                    let (at, shot) = item, g = FamilyPixels.grid(shot, x: Int(wg0.minX), y: Int(wg0.minY), w: Int(wg0.width), h: Int(wg0.height)), d = FamilyPixels.diff(wg, g)
                    var sum = 0.0, n = 0
                    for py in (wg.y + 1)..<(wg.y + wg.h - 1) { for px in (wg.x + 1)..<(wg.x + wg.w - 1) where wg.flat(px, py, 6) && g.flat(px, py, 6) { let a = wg.at(px, py), c = g.at(px, py); sum += (c[0] - a[0] + c[1] - a[1] + c[2] - a[2]) / 3; n += 1 } }
                    return String(format: "+%.0f ms mean %.2f signed %+.2f over6 %ld", at - (ph["t"].number ?? 0), d.mean, n > 0 ? sum / Double(n) : 0, d.bad)
                }
                print("FRAMES \(label)/\(lbl): " + frames.joined(separator: " | ")); fflush(stdout)
            }
            if let dir = captureDir, !matched { try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true); try? NSBitmapImageRep(cgImage: b.2.cg).representation(using: .png, properties: [:])?.write(to: dir.appendingPathComponent(label.replacingOccurrences(of: "/", with: "-") + "-" + lbl + ".png")) }
            report.append(["case": "\(label)/\(lbl)", "compared": b.0.n, "mean": b.0.mean, "over6": b.0.bad, "worstAt": b.0.worstAt, "frame": b.1, "windowFrames": shots.count, "bracket": between])
        }
        state.pointer.update(phase: .leave); pump(0.1)
    }
    static func main() {
        _ = NSApplication.shared; NSApp.setActivationPolicy(.accessory)
        host = NSHostingView(rootView: FamilyStatesFixture(state: state)); window = NSWindow(contentRect: .init(x: -20000, y: -20000, width: 1200, height: 900), styleMask: [.borderless], backing: .buffered, defer: false)
        window.isReleasedWhenClosed = false; window.colorSpace = .sRGB; window.contentView = host; window.orderFrontRegardless(); window.makeKey(); pump(0.2)
        #if os(iOS)
        AWCShimFrameClock.start()
        #endif
        let fixtures = URL(fileURLWithPath: #filePath).deletingLastPathComponent().appendingPathComponent("Fixtures")
        let only = env["AWC_FAMILY_STATES_ONLY"], comps = env["AWC_FAMILY_COMPS"].map { Set($0.split(separator: ",").map(String.init)) }
        for (file, reduced) in [("button-family-web-states", false), ("button-family-web-states-reduced", true)] {
            let oracle = try! JSONDecoder().decode(AWCValue.self, from: Data(contentsOf: fixtures.appendingPathComponent(file + ".json")))
            for r in oracle["runs"].array where (only.map { list in list.split(separator: ",").contains { r["name"].string.contains($0) } } ?? true) && (comps.map { $0.contains(r["comp"].string) } ?? true) { run(r, shotDir: fixtures.appendingPathComponent(file), reduced: reduced) }
        }
        if let output = env["AWC_FAMILY_STATES_OUTPUT"] { try! JSONSerialization.data(withJSONObject: ["checks": checks, "failures": failures, "report": report], options: [.prettyPrinted, .sortedKeys]).write(to: URL(fileURLWithPath: output)) }
        if holdCount + stallCount > 0 { print(String(format: "Box samples compared back to the start of a hold or stall: %ld main-thread holds over one display frame (longest %.0f ms), %ld display stalls over a frame and a half (longest %.0f ms)", holdCount, holdLongest, stallCount, stallLongest)) }
        if applyLongest > 0 { print(String(format: "Phases led by a property set: clock started at the view's update, at most %.0f ms after the set", applyLongest)) }
        if leadCount > 0 { print("Box samples ahead of Chrome's ±1 frame window by at most its input latency (the record's first frame after the input): \(leadCount)") }
        print("Button family native interaction states: \(checks - failures.count)/\(checks) checks passed")
        window.close(); if !failures.isEmpty { exit(1) }
    }
}
