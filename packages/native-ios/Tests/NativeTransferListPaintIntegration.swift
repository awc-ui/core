import AppKit
import SwiftUI
@testable import AWCUI

// md-transfer-list against Chrome 153 (md-transfer-list/web-oracle paint.json, 105 cases at DPR 1): light/dark × LTR/RTL
// × default/checked/all-checked/filtered/filtered-empty/empty target (icon, text)/disabled/not-searchable/no select-all/
// single-step-only, densities, the ≤ 640 px stacked layout (also under an RTL ancestor), host dir, keyboard focus, row hover
// (plain, checked, disabled), locales, custom icons, long labels, a scrolling list, full width/height and every hook.
// Checks: every part box (columns, headers, title cluster, count, search, list or empty state, rows, movers) against the
// oracle and every flat pixel of the clip. The harness steps are replayed at Chrome's own times from the oracle's input
// timeline, on a replay clock that row transitions and md-ripple waves render on (the harness's own pumps do not age them).
// The typed ::part() API (AWCTransferListPartAppearance) against the oracle's ::part() cases (web-oracle/parts.json: each of
// the ten parts, all parts in light LTR and dark RTL, and a baseline case).

@MainActor final class TransferPaintState: ObservableObject {
    @Published var c: AWCValue = .null
    @Published var epoch = 0
    var measurements: [AWCNativeInspectionNode] = []
}
struct TransferPaintFixture: View {
    @ObservedObject var state: TransferPaintState
    static func attr(_ html: String, _ name: String) -> String? {
        guard let i = html.range(of: "<md-transfer-list") else { return nil }
        let tag = String(html[i.lowerBound...].prefix { $0 != ">" })
        for q in ["'", "\""] { if let r = tag.range(of: " " + name + "=" + q) { let rest = tag[r.upperBound...]; return String(rest.prefix { String($0) != q }) } }
        return tag.range(of: " " + name + "[ >]|" + " " + name + "$", options: .regularExpression) != nil ? "" : nil
    }
    static func px(_ s: String) -> Double? { Double(s.replacingOccurrences(of: "px", with: "").trimmingCharacters(in: .whitespaces)) }
    static func hooks(_ html: String) -> AWCTransferListAppearance {
        var h: [String: String] = [:]
        for d in (attr(html, "style") ?? "").split(separator: ";") { let kv = d.split(separator: ":", maxSplits: 1); if kv.count == 2 { h[kv[0].trimmingCharacters(in: .whitespaces)] = kv[1].trimmingCharacters(in: .whitespaces) } }
        func c(_ k: String) -> String? { h["--md-transfer-list-" + k] }
        func n(_ k: String) -> Double? { c(k).flatMap(px) }
        let pad = c("item-padding")?.split(separator: " ").compactMap { px(String($0)) } ?? []
        return AWCTransferListAppearance(width: n("width"), minWidth: n("min-width"), maxWidth: n("max-width"), height: n("height"), minHeight: n("min-height"), maxHeight: n("max-height"),
            columnMinWidth: n("column-min-width"), columnMaxBlock: n("column-max-block"), containerShape: n("container-shape"), containerColor: c("container-color"),
            headerColor: c("header-color"), headerTextColor: c("header-text-color"), itemInset: n("item-inset"), itemPadding: pad.isEmpty ? nil : pad.count == 1 ? .init(pad[0]) : pad.count == 2 ? .init(block: pad[0], inline: pad[1]) : .init(top: pad[0], right: pad[1], bottom: pad[2], left: pad.count > 3 ? pad[3] : pad[1]),
            itemGap: n("item-gap"), dividerColor: c("divider-color"), controlsGap: n("controls-gap"), emptyIconSize: n("empty-icon-size"), controlSize: n("control-size"), controlIconSize: n("control-icon-size"))
    }
    /// The case's `::part()` rules (a <style> before the element) as the typed part appearance.
    static func partStyles(_ html: String) -> AWCTransferListPartAppearance {
        var v: [String: AWCValue] = [:]
        let re = try! NSRegularExpression(pattern: "::part\\(([a-z-]+)\\)\\s*\\{([^}]*)\\}")
        for m in re.matches(in: html, range: NSRange(html.startIndex..., in: html)) {
            guard let nr = Range(m.range(at: 1), in: html), let br = Range(m.range(at: 2), in: html) else { continue }
            var f: [String: AWCValue] = [:]
            for d in html[br].split(separator: ";") {
                let kv = d.split(separator: ":", maxSplits: 1).map { $0.trimmingCharacters(in: .whitespaces) }; guard kv.count == 2 else { continue }
                switch kv[0] {
                case "background-color": f["backgroundColor"] = .string(kv[1])
                case "color": f["color"] = .string(kv[1])
                case "border-color", "border-block-end-color": f["borderColor"] = .string(kv[1])
                case "border-radius": if let n = px(kv[1]) { f["shape"] = .number(n) }
                case "font-size": if let n = px(kv[1]) { f["size"] = .number(n) }
                case "opacity": if let n = Double(kv[1]) { f["opacity"] = .number(n) }
                default: break
                }
            }
            v[String(html[nr])] = .object(f)
        }
        return AWCTransferListPartAppearance(values: v)
    }
    /// The harness's `value` for the case (setValue steps).
    static func value(_ name: String) -> [String] {
        if name.hasPrefix("tl-part") && (name.contains("empty") || name.hasPrefix("tl-parts-all")) { return [] }
        if name.contains("hooks-all") || name.contains("target-empty") || name.contains("long-labels") || name.contains("many-items") || name.hasSuffix("ro-empty") { return [] }
        if name.hasPrefix("tl-hook-") { return ["e"] }
        if name == "tl-custom-icons" { return ["a", "b", "c", "e", "f"] }
        return ["e", "f"]
    }
    static func properties(_ c: AWCValue) -> [String: AWCValue] {
        let html = c["html"].string; var p: [String: AWCValue] = [:]
        if let items = attr(html, "items") { p["items"] = .string(items.replacingOccurrences(of: "&#39;", with: "'").replacingOccurrences(of: "&quot;", with: "\"")) }
        p["value"] = .array(value(c["name"].string).map(AWCValue.string))
        for (a, k) in [("source-title", "sourceTitle"), ("target-title", "targetTitle"), ("source-search-placeholder", "sourceSearchPlaceholder"), ("target-search-placeholder", "targetSearchPlaceholder"),
                       ("empty-text", "emptyText"), ("empty-icon", "emptyIcon"), ("count-template", "countTemplate"), ("select-all-label", "selectAllLabel"), ("search-icon", "searchIcon"),
                       ("move-right-icon", "moveRightIcon"), ("move-left-icon", "moveLeftIcon"), ("move-all-right-icon", "moveAllRightIcon"), ("move-all-left-icon", "moveAllLeftIcon")] {
            if let v = attr(html, a) { p[k] = .string(v) } }
        if let d = attr(html, "density").flatMap(Double.init) { p["density"] = .number(d) }
        if attr(html, "disabled") != nil { p["disabled"] = true }
        if attr(html, "searchable") == "false" { p["searchable"] = false }
        if attr(html, "show-select-all") == "false" { p["showSelectAll"] = false }
        if attr(html, "single-step-only") != nil { p["singleStepOnly"] = true }
        if attr(html, "full-width") != nil { p["fullWidth"] = true }
        if attr(html, "full-height") != nil { p["fullHeight"] = true }
        return p
    }
    static func rtl(_ c: AWCValue) -> Bool { c["dir"].string == "rtl" || c["html"].string.contains("dir=\"rtl\"") }
    var body: some View {
        let c = state.c, epoch = state.epoch, html = c["html"].string
        let theme = AWCTheme.generated(dark: c["theme"].string == "dark")
        let host = c["tree"]["rect"]
        ZStack(alignment: .topLeading) {
            if c != .null {
                let node = AWCNode(id: "tl", tag: "md-transfer-list", properties: Self.properties(c))
                AWCNativeView(node: node) { _ in }
                    .awcTransferListAppearance(Self.hooks(html))
                    .awcTransferListPartAppearance(Self.partStyles(html))
                    .awcTransferListViewport(c["name"].string.contains("stacked-500") ? 500 : 1200)
                    .frame(width: CGFloat(host["width"].number ?? 900), height: (Self.attr(html, "full-height") != nil || html.contains("-height:")) ? host["height"].number.map { CGFloat($0) } : nil, alignment: .topLeading)
                    .environment(\.layoutDirection, Self.rtl(c) ? .rightToLeft : .leftToRight)
                    .awcNativeInspection(rootID: "tl", coordinateSpace: "awc-native-preview") { if state.epoch == epoch { state.measurements = $0 } }
                    .offset(x: CGFloat(host["x"].number ?? 24), y: CGFloat(host["y"].number ?? 24))
            }
        }
        .environment(\.awcTransferListInspector, { NativeTransferListPaintIntegration.probe = $0 })
        .environment(\.awcTransferListClock, NativeTransferListPaintIntegration.clock)
        .awcTheme(theme)
        .id(epoch)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(theme.background).coordinateSpace(name: "awc-native-preview")
    }
}
struct TransferGrid {
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
@main @MainActor enum NativeTransferListPaintIntegration {
    static let state = TransferPaintState()
    static var host: NSHostingView<TransferPaintFixture>!, window: NSWindow!
    static var checks = 0, failures: [String] = [], pending: [String] = []
    static var probe: AWCTransferListProbe?
    /// The replay clock (ms), driven by `pump` (the offscreen window has no display-link frames): Chrome's timeline time of the event
    /// being replayed; between events it follows real time up to the next event's time, and it stops at the shot's instant. Row
    /// transitions (AWCTransferListClock) and md-ripple waves (AWCRippleTestClock) render on it, so a press's pumps do not age them.
    static var vBase = CACurrentMediaTime() * 1000, vReal = CACurrentMediaTime() * 1000, vCap = Double.infinity
    static func virtualNow() -> Double { min(vBase + (CACurrentMediaTime() * 1000 - vReal), vCap) }
    static func pin(_ t: Double, cap: Double) { vBase = t; vReal = CACurrentMediaTime() * 1000; vCap = cap; advanceClock() }
    static let clock = AWCTransferListClock(now: CACurrentMediaTime() * 1000)
    static let rippleClock = AWCRippleTestClock(now: CACurrentMediaTime() * 1000)
    static func advanceClock() { let t = virtualNow(); if t > clock.now { clock.tick(t - clock.now) }; if t > rippleClock.now { rippleClock.now = t } }
    static var report: [[String: Any]] = []
    static let env = ProcessInfo.processInfo.environment
    static let captureDir = env["AWC_TRANSFER_PAINT_CAPTURE_DIRECTORY"].map { URL(fileURLWithPath: $0) }
    static func mouse(_ kind: NSEvent.EventType, _ p: CGPoint) {
        let point = host.convert(.init(x: p.x, y: host.isFlipped ? p.y : host.bounds.height - p.y), to: nil)
        window.sendEvent(NSEvent.mouseEvent(with: kind, location: point, modifierFlags: [], timestamp: ProcessInfo.processInfo.systemUptime, windowNumber: window.windowNumber,
                                            context: nil, eventNumber: 1, clickCount: 1, pressure: kind == .leftMouseUp ? 0 : 1)!)
    }
    static func key(_ code: UInt16, _ text: String, _ flags: NSEvent.ModifierFlags = []) {
        for type in [NSEvent.EventType.keyDown, .keyUp] {
            let e = NSEvent.keyEvent(with: type, location: .zero, modifierFlags: flags, timestamp: ProcessInfo.processInfo.systemUptime, windowNumber: window.windowNumber,
                                     context: nil, characters: text, charactersIgnoringModifiers: text, isARepeat: false, keyCode: code)!
            // NSApp's local key monitors (AWCKeyViewGroup's Tab routing in DOM order) run before the window gets the key.
            if type == .keyDown && AWCKeyViewGroup.handle(e) { continue }
            window.sendEvent(e)
        }
    }
    static func responder() -> String {
        guard let r = window.firstResponder else { return "nil" }
        if let v = r as? NSView { return "\(type(of: v)) \(v.accessibilityIdentifier()) \(v.accessibilityLabel() ?? "") \(Int(v.convert(v.bounds, to: nil).midX)),\(Int(host.bounds.height - v.convert(v.bounds, to: nil).midY))" }
        return "\(type(of: r))"
    }
    static func check(_ value: Bool, _ name: String) { checks += 1; if !value { failures.append(name); print("FAIL: " + name); fflush(stdout) } }
    static func pump(_ duration: Double = 0.1) { let end = Date().addingTimeInterval(duration); repeat { advanceClock(); while let e = NSApp.nextEvent(matching: .any, until: .distantPast, inMode: .default, dequeue: true) { NSApp.sendEvent(e) }; host.layoutSubtreeIfNeeded(); host.displayIfNeeded(); _ = RunLoop.current.run(mode: .default, before: Date().addingTimeInterval(0.005)) } while Date() < end }
    struct Shot { let cg: CGImage; let scale: Double; let origin: CGPoint }
    static func capture(_ r: CGRect) -> Shot {
        let rr = host.isFlipped ? r : CGRect(x: r.minX, y: host.bounds.height - r.maxY, width: r.width, height: r.height)
        let b = host.bitmapImageRepForCachingDisplay(in: rr)!; host.cacheDisplay(in: rr, to: b)
        return .init(cg: b.cgImage!, scale: Double(b.pixelsWide) / r.width, origin: r.origin)
    }
    static func grid(_ s: Shot, x: Int, y: Int, w: Int, h: Int) -> TransferGrid {
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
    static func rect(_ v: AWCValue) -> CGRect { .init(x: v["x"].number ?? .nan, y: v["y"].number ?? .nan, width: v["width"].number ?? .nan, height: v["height"].number ?? .nan) }
    /// The oracle's parts keyed like the renderer's inspection parts.
    static func webParts(_ c: AWCValue) -> [(String, CGRect)] {
        var out: [(String, CGRect)] = [], side = "source", item = 0
        let values = AWCTransferItem.parse(TransferPaintFixture.properties(c)["items"])
        for p in c["tree"]["parts"].array {
            let part = p["part"].string, r = rect(p["rect"])
            if part.contains("column-target") { side = "target"; item = 0 }
            if part.hasPrefix("column") { out.append(("column-" + side, r)); continue }
            if part == "item" { out.append(("item-\(side)#\(item)", r)); item += 1; continue }
            if part == "controls" { out.append(("controls", r)); continue }
            if ["header", "header-title", "count", "search", "list", "empty"].contains(part) { out.append((part + "-" + side, r)) }
        }
        _ = values; return out
    }
    static func run(_ c: AWCValue, shots: URL) {
        let name = c["name"].string, hostRect = rect(c["tree"]["rect"])
        probe = nil; state.c = c; state.epoch += 1; pump(0.4)
        let props = TransferPaintFixture.properties(c), items = AWCTransferItem.parse(props["items"]), value = Set((props["value"]?.array ?? []).map(\.string))
        let source = items.filter { !value.contains($0.value) }, target = items.filter { value.contains($0.value) }
        // The harness steps at Chrome's own times: the oracle's input timeline (trusted pointer and key events, performance.now()
        // ms) replayed in real time up to the frame the shot paints. Presses on rows go in as mouse input (md-ripple waves at
        // Chrome's phase), moves set the row hover, a press outside the list blurs (the page body takes it), typed keys set the
        // query at the last key, and the harness's Tabs end on the row the case names (keyboard focus).
        let timeline = c["timeline"].array, away = CGPoint(x: 1190, y: 890)
        // Rows do not move while the timeline plays (toggles repaint, measurements may be republished mid-update): the boxes at its start.
        let rowsAtStart = state.measurements
        func row(_ q: CGPoint) -> (Bool, String)? {
            guard let m = (rowsAtStart.isEmpty ? state.measurements : rowsAtStart).first(where: { $0.id.hasPrefix("component.item-") && $0.bounds.contains(q) }) else { return nil }
            let key = m.id.dropFirst("component.item-".count); return (key.hasPrefix("t:"), String(key.dropFirst(2)))
        }
        if !timeline.isEmpty, let shotT = c["shotFrame"].number ?? c["shotAt"].number, let t0 = timeline[0]["t"].number {
            let start = virtualNow()
            func at(_ e: AWCValue?) -> Double { start + ((e?["t"].number ?? shotT) - t0) }
            func until(_ v: Double) { var g = 0; while virtualNow() < v - 0.01 && g < 4000 { pump(min(0.005, max(0.0005, (v - virtualNow()) / 1000))); g += 1 } }
            let lastTab = timeline.lastIndex { $0["key"].string == "Tab" }, lastTyped = timeline.lastIndex { $0["type"].string == "keydown" && $0["key"].string.count == 1 }
            var typed = "", held = false, fromPageEnd = false
            let debug = env["AWC_TRANSFER_DEBUG"] != nil
            for (i, e) in timeline.enumerated() {
                // The event at its Chrome time; its pumps may run the clock up to the next event's time, never past it.
                until(at(e)); pin(at(e), cap: i + 1 < timeline.count ? at(timeline[i + 1]) : start + shotT - t0)
                let q = CGPoint(x: e["x"].number ?? 0, y: e["y"].number ?? 0)
                switch e["type"].string {
                case "pointermove":
                    // The oracle parks the pointer at x = 1190 (inside the 1200 px viewport, over the page): the row loses :hover
                    // (the shots show the checked row at 8% under its md-ripple wave, not at the 12% hover layer).
                    mouse(.mouseMoved, q.x < host.bounds.width && q.y < host.bounds.height ? q : away)
                    if let r = row(q) { probe?.hover(r.0, r.1) } else { probe?.hover(false, nil) }
                case "pointerdown":
                    // The move renders before the press, and each press / release gets its own frames (a press right after a
                    // toggle otherwise reaches SwiftUI mid-update and is lost).
                    if row(q) != nil { mouse(.mouseMoved, q); pump(0.04); mouse(.leftMouseDown, q); held = true; pump(0.02) }
                    else if !hostRect.contains(q) { _ = window.makeFirstResponder(nil); fromPageEnd = q.y > hostRect.maxY }
                    if debug { print("DBG \(name) down \(q) row \(String(describing: row(q))) snapshot \(probe?.snapshot()?.source.rows.map { $0.checked } ?? [])") }
                case "pointerup":
                    if held { pump(0.02); mouse(.leftMouseUp, q); held = false; pump(0.02) }
                    // The harness then parks the pointer at (1190, 600): outside the 500 px viewport of the stacked cases Chrome
                    // dispatches no event, but the pointer has left the row (no :hover) — a release with no move after it is that move.
                    if name.contains("stacked-500"), !(i + 1 < timeline.count && timeline[i + 1]["type"].string == "pointermove") { mouse(.mouseMoved, away); probe?.hover(false, nil) }
                    if debug { print("DBG \(name) up \(probe?.snapshot()?.source.rows.map { $0.checked } ?? []) \(probe?.snapshot()?.target.rows.map { $0.checked } ?? [])") }
                case "keydown":
                    let k = e["key"].string; if k.count == 1 { typed += k }
                    if i == lastTyped { probe?.search(false, typed) }
                    // Tab: the window's key-view loop. A press on the page's end puts Chrome's sequential focus starting point after
                    // the list, so its first Tab leaves the page (browser UI) and the next one enters at the top: nothing in-page.
                    if k == "Tab" {
                        if fromPageEnd { fromPageEnd = false } else { key(48, "\t", e["shift"].bool == true ? [.shift] : []); pump(0.02) }
                        if debug { print("DBG \(name) Tab -> \(responder())") }
                    }
                default: break
                }
            }
            // The shot's instant: the clock stops there while the frame renders.
            until(start + shotT - t0); pin(start + shotT - t0, cap: start + shotT - t0); pump(0.05)
        } else { pump(0.45) }
        // Geometry.
        let mine = Dictionary(state.measurements.map { ($0.id, $0.bounds) }, uniquingKeysWith: { a, _ in a })
        var itemIndex: [String: Int] = [:]
        for (key, w) in webParts(c) {
            var k = key
            if key.hasPrefix("item-") { let side = key.contains("target") ? "t" : "s"; let n = itemIndex[side, default: 0]; itemIndex[side] = n + 1
                let list = key.contains("target") ? target : source
                let q = name.hasSuffix("-filtered") && side == "s" ? list.filter { $0.label.lowercased().contains("al") || $0.description.lowercased().contains("al") } : list
                guard n < q.count else { check(false, "\(name) \(key) extra web item"); continue }
                k = "item-" + side + ":" + q[n].value }
            guard let m = mine["component." + k] else { check(false, "\(name) part \(k) missing"); continue }
            check(abs(m.minX - w.minX) <= 1 && abs(m.minY - w.minY) <= 1 && abs(m.width - w.width) <= 1 && abs(m.height - w.height) <= 1, "\(name) \(k) \(m) vs \(w)")
        }
        let clip = c["clip"], cx = Int(clip["x"].number!), cy = Int(clip["y"].number!), cw = Int(clip["width"].number!), ch = Int(clip["height"].number!)
        let native = capture(CGRect(x: cx, y: cy, width: cw, height: ch))
        guard let shot = NSImage(contentsOf: shots.appendingPathComponent(name + ".png"))?.cgImage(forProposedRect: nil, context: nil, hints: nil) else { check(false, "\(name) shot"); return }
        let wg = grid(.init(cg: shot, scale: 1, origin: .init(x: cx, y: cy)), x: cx, y: cy, w: cw, h: ch), ng = grid(native, x: cx, y: cy, w: cw, h: ch)
        var n = 0, bad = 0, sum = 0.0, worst = 0.0, worstAt = ""
        for py in (cy + 1)..<(cy + ch - 1) { for pxl in (cx + 1)..<(cx + cw - 1) where wg.flat(pxl, py, 6) && ng.flat(pxl, py, 6) {
            let a = wg.at(pxl, py), b = ng.at(pxl, py); var d = 0.0; for k in 0..<3 { d = max(d, abs(a[k] - b[k])) }
            n += 1; sum += d; if d > 6 { bad += 1 }
            if d > worst { worst = d; worstAt = "(\(pxl),\(py)) web \(a.map { Int($0) }) native \(b.map { Int($0.rounded()) })" }
        } }
        let mean = sum / Double(max(n, 1))
        check(n > 400 && Double(bad) / Double(max(n, 1)) <= 0.005 && mean <= 1.0, "\(name) flat pixels match (mean \(mean), >6: \(bad)/\(n), worst \(worst) at \(worstAt))")
        if let dir = captureDir { try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true); try? NSBitmapImageRep(cgImage: native.cg).representation(using: .png, properties: [:])?.write(to: dir.appendingPathComponent(name + ".png")) }
        report.append(["case": name, "compared": n, "mean": mean, "over6": bad, "worst": worst, "worstAt": worstAt, "host": "\(hostRect)"])
        _ = window.makeFirstResponder(nil)
        pin(virtualNow(), cap: .infinity)
    }
    static func main() {
        _ = NSApplication.shared; NSApp.setActivationPolicy(.accessory)
        AWCRippleEngine.testClock = rippleClock
        host = NSHostingView(rootView: TransferPaintFixture(state: state)); window = NSWindow(contentRect: .init(x: -20000, y: -20000, width: 1200, height: 900), styleMask: [.borderless], backing: .buffered, defer: false)
        window.isReleasedWhenClosed = false; window.colorSpace = .sRGB; window.contentView = host; window.orderFrontRegardless(); pump(0.3)
        let fixtures = URL(fileURLWithPath: #filePath).deletingLastPathComponent().appendingPathComponent("Fixtures")
        let oracle = try! JSONDecoder().decode(AWCValue.self, from: Data(contentsOf: fixtures.appendingPathComponent("transferlist-web-paint.json")))
        let only = env["AWC_TRANSFER_PAINT_ONLY"]
        for c in oracle["cases"].array where !c["name"].string.hasPrefix("tl-fc-") && (only.map({ o in o.split(separator: ",").contains { c["name"].string.contains($0) } }) ?? true) { run(c, shots: fixtures.appendingPathComponent("transferlist-web-paint")) }
        // The typed ::part() cases (web-oracle/parts.json, slimmed like paint.json).
        if let data = try? Data(contentsOf: fixtures.appendingPathComponent("transferlist-web-parts.json")), let parts = try? JSONDecoder().decode(AWCValue.self, from: data) {
            for c in parts["cases"].array where only.map({ o in o.split(separator: ",").contains { c["name"].string.contains($0) } }) ?? true { run(c, shots: fixtures.appendingPathComponent("transferlist-web-parts")) }
        } else { check(false, "parts fixture transferlist-web-parts.json missing") }
        if let output = env["AWC_TRANSFER_PAINT_OUTPUT"] { try! JSONSerialization.data(withJSONObject: ["checks": checks, "failures": failures, "pending": pending, "report": report], options: [.prettyPrinted, .sortedKeys]).write(to: URL(fileURLWithPath: output)) }
        print("Transfer list native paint: \(checks - failures.count)/\(checks) checks passed; pending \(pending.count)")
        window.close(); if !failures.isEmpty { exit(1) }
    }
}
