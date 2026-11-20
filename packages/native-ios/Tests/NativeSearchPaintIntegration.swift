import AppKit
import SwiftUI
import Observation
@testable import AWCUI

// md-search paint and geometry against Chrome 153 (Mac capture of search-paint.html, DPR 1, 123 cases): theme × direction ×
// variant × ten states (docked closed / value / avatar / open with results / open empty / loading / disabled, full-screen bar
// and icon triggers closed, full-screen open with results), densities −1…−4 closed and open, elevation 0 and 3, full width,
// voice, no results, and the hooks alone and together. Checks the host, bar (box, colour, corners, opacity, elevation), the
// leading button, input (box, value, colour, name, expanded), trailing cluster, clear / voice / loading / trigger buttons,
// the panel (box, colour, corners, opacity, transform), divider, empty state, result rows and every flat pixel of the clip.
@Observable final class SearchPaintState {
    var node = AWCNode(id: "search", tag: "md-search")
    var epoch = 0
    var dark = false
    var rtl = false
    var width = 420.0
    var appearance = AWCSearchAppearance()
    var parts = AWCSearchPartAppearance()
    var measurements: [AWCNativeInspectionNode] = []
}
@MainActor let searchPaintController = AWCSearchController()
struct SearchPaintFixture: View {
    let state: SearchPaintState
    var body: some View {
        let epoch = state.epoch, theme = AWCTheme.generated(dark: state.dark)
        AWCModalScope {
            // Chrome's page: the harness box (left 24, top 24, inline-size, dir on the box) in an LTR page.
            VStack(alignment: .leading, spacing: 0) {
                AWCNativeView(node: state.node).frame(width: state.width, alignment: .leading)
            }
            .frame(width: state.width, alignment: .leading)
            .environment(\.layoutDirection, state.rtl ? .rightToLeft : .leftToRight)
            .padding(.leading, 24).padding(.top, 24)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .environment(\.layoutDirection, .leftToRight)
        }
        .environment(\.layoutDirection, state.rtl ? .rightToLeft : .leftToRight)
        .awcSearchAppearance(state.appearance, for: "search").awcSearchPartAppearance(state.parts, for: "search")
        .awcSearchController(searchPaintController).awcSearchReducedMotion(true)
        .awcTheme(theme)
        .awcNativeInspection(rootID: "search|alpha|alpine|alpaca", coordinateSpace: "awc-native-preview") { if state.epoch == epoch { state.measurements = $0 } }
        .id(epoch)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(theme.background).coordinateSpace(name: "awc-native-preview")
    }
}
struct SearchGrid {
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
@main @MainActor enum NativeSearchPaintIntegration {
    static let state = SearchPaintState()
    static var host: NSHostingView<SearchPaintFixture>!, window: NSWindow!
    static var checks = 0, failures: [String] = [], report: [[String: Any]] = []
    static func check(_ value: Bool, _ name: String) { checks += 1; if !value { failures.append(name); print("FAIL: " + name); fflush(stdout) } }
    static func pump(_ duration: Double = 0.1) { let end = Date().addingTimeInterval(duration); repeat { while let e = NSApp.nextEvent(matching: .any, until: .distantPast, inMode: .default, dequeue: true) { NSApp.sendEvent(e) }; host.layoutSubtreeIfNeeded(); RunLoop.current.run(until: Date().addingTimeInterval(0.01)) } while Date() < end }
    struct Shot { let cg: CGImage; let scale: Double; let origin: CGPoint }
    static func capture(_ r: CGRect) -> Shot {
        let rr = host.isFlipped ? r : CGRect(x: r.minX, y: host.bounds.height - r.maxY, width: r.width, height: r.height)
        let b = host.bitmapImageRepForCachingDisplay(in: rr)!; host.cacheDisplay(in: rr, to: b)
        return .init(cg: b.cgImage!, scale: Double(b.pixelsWide) / r.width, origin: r.origin)
    }
    static func grid(_ s: Shot, x: Int, y: Int, w: Int, h: Int) -> SearchGrid {
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
    static func diff(_ a: [Double], _ b: [Double]) -> Double { var m = 0.0; for i in 0..<3 { m = max(m, abs(a[i] - b[i])) }; return m }
    static func numbers(_ s: String) -> [Double] { var out: [Double] = [], cur = ""; for ch in s { if "0123456789.-e".contains(ch) { cur.append(ch) } else { if let v = Double(cur) { out.append(v) }; cur = "" } }; if let v = Double(cur) { out.append(v) }; return out }
    static func css(_ s: String) -> [Double] {
        let n = numbers(s)
        if s.hasPrefix("rgba") { return [n[0] / 255, n[1] / 255, n[2] / 255, n[3]] }
        if s.hasPrefix("rgb") { return [n[0] / 255, n[1] / 255, n[2] / 255, 1] }
        if s.hasPrefix("color(srgb") { return [n[0], n[1], n[2], n.count > 3 ? n[3] : 1] }
        return [0, 0, 0, 0]
    }
    static func hex(_ h: String) -> [Double] { let c = Color(awcHex: h).resolve(in: EnvironmentValues()); return [Double(c.red), Double(c.green), Double(c.blue), Double(c.opacity)] }
    static func premul(_ c: [Double]) -> [Double] { [c[0] * c[3], c[1] * c[3], c[2] * c[3], c[3]] }
    static func colorClose(_ native: String?, _ web: String?, _ tol: Double = 0.012) -> Bool {
        guard let web else { return false }
        // A Chrome part with no background (alpha 0) has no native paint: an absent or empty native value is the same box.
        if premul(css(web)).allSatisfy({ abs($0) <= tol }), native == nil || native!.isEmpty { return true }
        guard let native else { return false }
        return zip(premul(hex(native)), premul(css(web))).allSatisfy { abs($0 - $1) <= tol }
    }
    static func px(_ s: String) -> Double? { s.hasSuffix("px") ? Double(s.dropLast(2)) : Double(s) }
    /// The case's hooks as the typed appearance (lengths in px).
    static func hooks(_ h: AWCValue) -> AWCSearchAppearance {
        guard case .object(let o) = h else { return .init() }
        var v: [String: AWCValue] = [:]
        for (k, raw) in o {
            let name = k.replacingOccurrences(of: "--md-search-", with: "").split(separator: "-").enumerated().map { $0.offset == 0 ? String($0.element) : $0.element.capitalized }.joined()
            v[name] = px(raw.string).map { .number($0) } ?? raw
        }
        return AWCSearchAppearance(values: v)
    }
    /// The case's ::part() rules as the typed part appearance.
    static func partsAppearance(_ r: AWCValue) -> AWCSearchPartAppearance {
        func s(_ p: String, _ k: String) -> String? { r[p][k] == .null ? nil : r[p][k].string }
        func n(_ p: String, _ k: String) -> Double? { s(p, k).flatMap { Double($0) } }
        return AWCSearchPartAppearance(barBackgroundColor: s("bar", "background-color"), stateLayerColor: s("state-layer", "background-color"),
            stateLayerOpacity: n("state-layer", "opacity"), leadingBackgroundColor: s("leading", "background-color"),
            leadingStateLayerColor: s("leading-state-layer", "background-color"), leadingStateLayerOpacity: n("leading-state-layer", "opacity"),
            inputColor: s("input", "color"), caretColor: s("input", "caret-color"), trailingBackgroundColor: s("trailing", "background-color"),
            clearButtonBackgroundColor: s("clear-button", "background-color"), voiceButtonBackgroundColor: s("voice-button", "background-color"),
            triggerButtonBackgroundColor: s("trigger-button", "background-color"), dividerColor: s("divider", "background-color"),
            panelBackgroundColor: s("panel", "background-color"), emptyColor: s("empty", "color"), resultsViewportBackgroundColor: s("results-viewport", "background-color"),
            triggerBackgroundColor: s("trigger", "background-color"), panelBodyBackgroundColor: s("panel-body", "background-color"), resultsHostBackgroundColor: s("results-host", "background-color"),
            loadingBackgroundColor: s("loading", "background-color"), loadingShapeBackgroundColor: s("loading-shape", "background-color"), statusBackgroundColor: s("status", "background-color"))  // parts2:
    }
    static func list() -> AWCNode {
        AWCNode(id: "results", tag: "md-list", children: [
            AWCNode(id: "alpha", tag: "md-list-item", properties: ["headline": "Alpha", "supportingText": "First result", "type": "button"]),
            AWCNode(id: "alpine", tag: "md-list-item", properties: ["headline": "Alpine", "type": "button"]),
            AWCNode(id: "alpaca", tag: "md-list-item", properties: ["headline": "Alpaca", "type": "button"])], slot: "results")
    }
    static func run(_ c: AWCValue, shots: URL) {
        let name = c["name"].string
        state.dark = c["theme"].string == "dark"; state.rtl = c["dir"].string == "rtl"; state.width = c["width"].number ?? 420
        state.appearance = hooks(c["hooks"]); state.parts = partsAppearance(c["partRules"])
        var p: [String: AWCValue] = [:]; if case .object(let o) = c["props"] { p = o }
        var children: [AWCNode] = []
        if c["avatar"].bool == true { children.append(AWCNode.symbol("account_circle", slot: "trailing")) }
        if c["list"].bool == true { children.append(list()) }
        state.node = AWCNode(id: "search", tag: "md-search", properties: p, children: children); state.measurements = []; state.epoch += 1; pump(0.3)
        if c["open"].bool == true { searchPaintController.show(); pump(0.7) }
        let ms = state.measurements
        // The scope inspects the search and the three rows ("search:…", "alpha:…"): search parts are the "search:" ones.
        func m(_ part: String) -> AWCNativeInspectionNode? { ms.first { $0.name == part && $0.id.hasPrefix("search:") } }
        guard let root = m("md-search") else { check(false, "\(name) measured"); return }
        func near(_ a: Double, _ b: Double, _ label: String, _ tol: Double = 0.6) { check(abs(a - b) <= tol, "\(name) \(label) \(a) vs \(b)") }
        func rect(_ n: AWCNativeInspectionNode?, _ r: AWCValue, _ label: String, tol: Double = 0.6, widthTol: Double = 0.6) {
            guard r != .null else { return }
            guard let n else { check(false, "\(name) \(label) missing"); return }
            let b = n.bounds
            near(b.minX, r["x"].number!, "\(label) x", tol); near(b.minY, r["y"].number!, "\(label) y", tol)
            near(b.width, r["width"].number!, "\(label) width", widthTol); near(b.height, r["height"].number!, "\(label) height", tol)
        }
        let open = c["open"].bool == true
        check(root.metrics["open"]?.bool == open, "\(name) open \(String(describing: root.metrics["open"])) vs \(open)")
        check(root.metrics["status"]?.string == c["status"].string, "\(name) status \(root.metrics["status"]?.string ?? "-") vs \(c["status"].string)")
        let fullScreenOpen = open && (p["layout"]?.string ?? "full-screen") == "full-screen"
        if !fullScreenOpen { rect(root, c["host"], "host", widthTol: 1.2) }
        if c["bar"] != .null {
            let bar = c["bar"]
            rect(m("bar"), bar["rect"], "bar")
            check(colorClose(m("bar")?.metrics["background"]?.string, bar["backgroundColor"].string), "\(name) bar colour \(m("bar")?.metrics["background"]?.string ?? "-") vs \(bar["backgroundColor"].string)")
            let h = bar["rect"]["height"].number ?? 0
            let top = min(px(bar["borderTopLeftRadius"].string) ?? 0, h / 2), bottom = min(px(bar["borderBottomLeftRadius"].string) ?? 0, h / 2)
            near(m("bar")?.metrics["radiusTop"]?.number ?? -1, top, "bar top radius", 0.01); near(m("bar")?.metrics["radiusBottom"]?.number ?? -1, bottom, "bar bottom radius", 0.01)
            near(m("bar")?.metrics["opacity"]?.number ?? -1, Double(bar["opacity"].string) ?? 1, "bar opacity", 0.001)
            let shadows = bar["boxShadow"].string.components(separatedBy: "px, ").count
            let visible = !bar["boxShadow"].string.hasPrefix("rgba(0, 0, 0, 0) 0px 0px 0px 0px") && bar["boxShadow"].string != "none"
            check((m("bar")?.metrics["elevation"]?.number ?? 0) == (visible ? Double(shadows) : 0), "\(name) bar elevation layers \(String(describing: m("bar")?.metrics["elevation"])) vs \(visible ? shadows : 0)")
            rect(m("leading"), c["leading"]["rect"], "leading")
            if c["leadingButton"] != .null {
                rect(m("leading-button"), c["leadingButton"]["rect"], "leading button")
                check(m("leading-button")?.metrics["label"]?.string == c["leadingButton"]["label"].string, "\(name) leading label \(m("leading-button")?.metrics["label"]?.string ?? "-") vs \(c["leadingButton"]["label"].string)")
            }
            let inp = c["input"]
            rect(m("input"), inp["rect"], "input")
            check(m("input")?.metrics["value"]?.string == inp["value"].string, "\(name) input value \(m("input")?.metrics["value"]?.string ?? "-") vs \(inp["value"].string)")
            check(m("input")?.metrics["label"]?.string == inp["label"].string, "\(name) input name \(m("input")?.metrics["label"]?.string ?? "-") vs \(inp["label"].string)")
            check(m("input")?.metrics["expanded"]?.bool == (inp["expanded"].string == "true"), "\(name) input expanded")
            check(colorClose(m("input")?.metrics["color"]?.string, inp["color"].string), "\(name) input colour \(m("input")?.metrics["color"]?.string ?? "-") vs \(inp["color"].string)")
            near(m("input")?.metrics["fontSize"]?.number ?? -1, px(inp["fontSize"].string) ?? 0, "input font", 0.01)
            if c["trailing"] != .null && (c["trailing"]["rect"]["height"].number ?? 0) > 0 { rect(m("trailing"), c["trailing"]["rect"], "trailing") }
        } else { check(m("bar") == nil, "\(name) no bar") }
        if c["clear"] != .null {
            rect(m("clear-button"), c["clear"]["rect"], "clear button", tol: 1, widthTol: 1)
            near(m("clear-button")?.metrics["opacity"]?.number ?? -1, Double(c["clear"]["opacity"].string) ?? 1, "clear opacity", 0.01)
            check(colorClose(m("clear-button")?.metrics["color"]?.string, c["clear"]["color"].string), "\(name) clear colour \(m("clear-button")?.metrics["color"]?.string ?? "-") vs \(c["clear"]["color"].string)")
        } else { check(m("clear-button") == nil || (m("clear-button")?.metrics["opacity"]?.number ?? 0) == 0, "\(name) no clear button") }
        if c["voice"] != .null { rect(m("voice-button"), c["voice"]["rect"], "voice button") } else { check(m("voice-button") == nil, "\(name) no voice button") }
        if c["loading"] != .null { rect(m("loading"), c["loading"], "loading") } else { check(m("loading") == nil, "\(name) no loading indicator") }
        if c["trigger"] != .null { rect(m("trigger-button"), c["trigger"], "trigger button") } else { check(m("trigger-button") == nil, "\(name) no trigger button") }
        let panel = c["panel"]
        if panel != .null {
            let opacity = Double(panel["opacity"].string) ?? 0
            near(m("panel")?.metrics["opacity"]?.number ?? 0, opacity, "panel opacity", 0.01)
            if opacity > 0 {
                rect(m("panel"), panel["rect"], "panel")
                check(colorClose(m("panel")?.metrics["background"]?.string, panel["backgroundColor"].string), "\(name) panel colour \(m("panel")?.metrics["background"]?.string ?? "-") vs \(panel["backgroundColor"].string)")
                if let top = m("panel")?.metrics["radiusTop"]?.number, (p["layout"]?.string ?? "") == "docked" {
                    near(top, px(panel["borderTopLeftRadius"].string) ?? 0, "panel top radius", 0.01)
                    near(m("panel")?.metrics["radiusBottom"]?.number ?? -1, min(px(panel["borderBottomLeftRadius"].string) ?? 0, 28), "panel bottom radius", 0.01)
                }
            }
        }
        if c["divider"] != .null {
            rect(m("divider"), c["divider"]["rect"], "divider")
            check(colorClose(m("divider")?.metrics["color"]?.string, c["divider"]["backgroundColor"].string), "\(name) divider colour")
        } else { check(m("divider") == nil, "\(name) no divider") }
        if c["empty"] != .null {
            rect(m("empty"), c["empty"]["rect"], "empty state")
            check(m("empty")?.metrics["text"]?.string == c["empty"]["text"].string, "\(name) empty text")
            check(colorClose(m("empty")?.metrics["color"]?.string, c["empty"]["color"].string), "\(name) empty colour")
        } else { check(m("empty") == nil, "\(name) no empty state") }
        // ::part() cases: the typed parts' paint (backgrounds, layers, caret) as Chrome computes it.
        if c["partRules"] != .null {
            func bg(_ node: String, _ key: String) {
                guard c[key] != .null, c[key]["backgroundColor"] != .null, (c[key]["rect"]["height"].number ?? 0) > 0 else { return }
                check(colorClose(m(node)?.metrics["background"]?.string, c[key]["backgroundColor"].string), "\(name) \(node) background \(m(node)?.metrics["background"]?.string ?? "-") vs \(c[key]["backgroundColor"].string)")
            }
            for (node, key) in [("leading", "leading"), ("trailing", "trailing"), ("clear-button", "clear"), ("voice-button", "voice"), ("trigger-button", "triggerButton"), ("results-viewport", "viewport"), ("panel-body", "panelBody"), ("results-host", "resultsHost"), ("loading", "loadingPart")] { bg(node, key) }
            if c["stateLayer"] != .null, m("bar") != nil {
                check(colorClose(m("bar")?.metrics["stateLayerColor"]?.string, c["stateLayer"]["backgroundColor"].string), "\(name) state layer colour")
                near(m("bar")?.metrics["stateLayer"]?.number ?? -1, Double(c["stateLayer"]["opacity"].string) ?? 0, "state layer opacity", 0.01)
            }
            if c["leadingStateLayer"] != .null, m("leading-button") != nil {
                check(colorClose(m("leading-button")?.metrics["layer"]?.string, c["leadingStateLayer"]["backgroundColor"].string), "\(name) leading state layer colour")
                near(m("leading-button")?.metrics["layerOpacity"]?.number ?? -1, Double(c["leadingStateLayer"]["opacity"].string) ?? 0, "leading state layer opacity", 0.01)
            }
            if c["input"] != .null { check(colorClose(m("input")?.metrics["caret"]?.string, c["input"]["caretColor"].string), "\(name) caret colour") }
        }
        // Result rows: the slotted md-list's items where the panel lays them out (md-list paints them; its own gate).
        let rows = ["alpha", "alpine", "alpaca"].compactMap { id in ms.first { $0.id == id + ":component" } }
        if open && (panel["opacity"].string == "1") {
            for (i, r) in c["rows"].array.enumerated() where i < rows.count { rect(rows[i], r, "row \(i)", tol: 1, widthTol: 1) }
            check(rows.count == c["rows"].array.count || c["rows"].array.isEmpty, "\(name) rows \(rows.count) vs \(c["rows"].array.count)")
        }
        // Flat pixels of the clip (the window is the 1200 × 900 viewport, like the page).
        let clip = c["clip"], cxp = max(0, Int(clip["x"].number!)), cyp = Int(clip["y"].number!)
        let cw = min(Int(clip["width"].number!), 1200 - cxp), ch = min(Int(clip["height"].number!), 900 - cyp)
        guard let src = NSImage(contentsOf: shots.appendingPathComponent(name + ".png"))?.cgImage(forProposedRect: nil, context: nil, hints: nil) else { check(false, "\(name) source shot"); return }
        let web = grid(.init(cg: src, scale: 1, origin: .init(x: Int(clip["x"].number!), y: cyp)), x: cxp, y: cyp, w: cw, h: ch)
        let shot = capture(CGRect(x: cxp, y: cyp, width: cw, height: ch)), nat = grid(shot, x: cxp, y: cyp, w: cw, h: ch)
        var n = 0, bad = 0, sum = 0.0, worst = 0.0, worstAt = ""
        for py in (cyp + 1)..<(cyp + ch - 1) { for pxx in (cxp + 1)..<(cxp + cw - 1) where web.flat(pxx, py, 6) && nat.flat(pxx, py, 6) {
            let d = diff(web.at(pxx, py), nat.at(pxx, py)); n += 1; sum += d; if d > 6 { bad += 1 }
            if d > worst { worst = d; worstAt = "(\(pxx),\(py)) web \(web.at(pxx, py).map { Int($0) }) native \(nat.at(pxx, py).map { Int($0.rounded()) })" } } }
        check(Double(n) / Double(max(1, (cw - 2) * (ch - 2))) > 0.5, "\(name) flat coverage")
        check(Double(bad) / Double(max(n, 1)) <= 0.005 && sum / Double(max(n, 1)) <= 1.0, "\(name) flat pixels match (mean \(sum / Double(max(n, 1))), >6: \(bad)/\(n), worst \(worst) at \(worstAt))")
        if let dir = ProcessInfo.processInfo.environment["AWC_SEARCH_CAPTURE_DIRECTORY"] {
            try? FileManager.default.createDirectory(atPath: dir, withIntermediateDirectories: true)
            try? NSBitmapImageRep(cgImage: shot.cg).representation(using: .png, properties: [:])?.write(to: URL(fileURLWithPath: dir).appendingPathComponent(name + ".png"))
        }
        report.append(["case": name, "compared": n, "mean": sum / Double(max(n, 1)), "over6": bad, "worst": worst, "worstAt": worstAt])
        searchPaintController.close(); pump(0.05)
        _ = window.makeFirstResponder(nil); pump(0.05)
    }
    static func main() {
        _ = NSApplication.shared; NSApp.setActivationPolicy(.accessory)
        host = NSHostingView(rootView: SearchPaintFixture(state: state)); window = NSWindow(contentRect: .init(x: -20000, y: -20000, width: 1200, height: 900), styleMask: [.borderless], backing: .buffered, defer: false)
        window.isReleasedWhenClosed = false; window.colorSpace = .sRGB; window.contentView = host; window.orderFrontRegardless(); window.makeKey(); pump(0.2)
        let fixtures = URL(fileURLWithPath: #filePath).deletingLastPathComponent().appendingPathComponent("Fixtures")
        let oracle = try! JSONDecoder().decode(AWCValue.self, from: Data(contentsOf: fixtures.appendingPathComponent("search-web-paint.json")))
        let only = ProcessInfo.processInfo.environment["AWC_SEARCH_ONLY"]
        for c in oracle["cases"].array where only.map({ f in f.split(separator: ",").contains { c["name"].string.contains($0) } }) ?? true { run(c, shots: fixtures.appendingPathComponent("search-web-paint")) }
        // The ::part() reference (search-parts.html: 9 cases).
        let partsOracle = try! JSONDecoder().decode(AWCValue.self, from: Data(contentsOf: fixtures.appendingPathComponent("search-web-parts.json")))
        for c in partsOracle["cases"].array where only.map({ f in f.split(separator: ",").contains { c["name"].string.contains($0) } }) ?? true { run(c, shots: fixtures.appendingPathComponent("search-web-parts")) }
        if let output = ProcessInfo.processInfo.environment["AWC_SEARCH_PAINT_OUTPUT"] { try! JSONSerialization.data(withJSONObject: ["checks": checks, "failures": failures, "report": report], options: [.prettyPrinted, .sortedKeys]).write(to: URL(fileURLWithPath: output)) }
        print("Search native paint: \(checks - failures.count)/\(checks) checks passed")
        window.close(); if !failures.isEmpty { exit(1) }
    }
}
