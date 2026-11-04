import AppKit
import SwiftUI
import Observation
@testable import AWCUI

// md-button paint and geometry against Chrome 153 (outputs/native-parity/md-button/web-reference/paint.html, DPR 1):
// variant × state (rest, disabled, soft-disabled, toggle off/on, loading) × theme × direction, size × shape, density rungs ×
// sizes × content, inherited/local density, content compositions in both directions (icons, mirror/expand flip, authored
// slot icons, loading, full width, connected corners, static selected shape, links, truncation, no ripple), every hook per
// variant × state × theme, each hook alone and the part fixtures. Rendered through AWCNativeView (production dispatch).
// Checks: border box, label box, and every flat pixel of the source clip (the default loader is frozen at t = 0 on both
// sides; its box is excluded from the pixel comparison and checked by geometry).
@Observable final class ButtonPaintFixtureState {
    var c: AWCValue = .null
    var epoch = 0
    var measurements: [AWCNativeInspectionNode] = []
}
struct ButtonPaintFixture: View {
    let state: ButtonPaintFixtureState
    static func px(_ s: String) -> Double { Double(s.replacingOccurrences(of: "px", with: "").trimmingCharacters(in: .whitespaces)) ?? .nan }
    static func appearance(_ h: AWCValue, parts: String) -> AWCButtonAppearance {
        func s(_ k: String) -> String? { h[k] == .null ? nil : h[k].string }
        func n(_ k: String) -> Double? { s(k).map(px) }
        func o(_ k: String) -> Double? { s(k).flatMap(Double.init) }
        var a = AWCButtonAppearance(containerColor: s("container-color"), labelColor: s("label-color"), iconColor: s("icon-color"),
            trailingIconColor: s("trailing-icon-color"), loadingColor: s("loading-color"), stateLayerColor: s("state-layer-color"),
            outlineColor: s("outline-color"), iconSize: n("icon-size"), trailingIconSize: n("trailing-icon-size"), loadingSize: n("loading-size"),
            fontSize: n("font-size"), fontWeight: o("font-weight"), lineHeight: n("line-height"), letterSpacing: n("letter-spacing"),
            cornerRadius: n("container-shape"), outlineWidth: n("outline-width"), paddingInline: n("padding-inline"), paddingBlock: n("padding-block"),
            gap: n("gap"), hoverOpacity: o("hover-opacity"), focusOpacity: o("focus-opacity"), pressedOpacity: o("pressed-opacity"),
            focusRingColor: s("focus-ring-color"), width: n("width"), minWidth: n("min-width"), maxWidth: n("max-width"), height: n("height"), minHeight: n("min-height"))
        // The ::part() fixtures map to the same public colour fields (the source parts only recolour these regions).
        if parts == "parts-filled" { a = a.merging(.init(labelColor: "#3949AB", iconColor: "#8E24AA", trailingIconColor: "#E53935", stateLayerColor: "#F4511E", stateLayerOpacity: 0.2)) }
        if parts == "parts-loading" { a = a.merging(.init(loadingColor: "#E53935")) }
        return a
    }
    var body: some View {
        let c = state.c, epoch = state.epoch, theme = AWCTheme.generated(dark: c["theme"].string == "dark")
        var props: [String: AWCValue] = [:]
        let tag = c["tag"] == .null ? "md-button" : c["tag"].string
        if tag == "md-fab" { for k in ["variant", "size", "disabled", "softDisabled", "lowered", "icon", "label", "extended", "density"] where c[k] != .null { props[k] = c[k] } }
        else { for k in ["variant", "size", "shape", "disabled", "softDisabled", "loading", "icon", "trailingIcon", "toggle", "selected", "shapeMorph", "mirrorIcon", "suppressExpandIconFlip", "fullWidth", "connectedLeft", "connectedRight", "href", "density", "ripple"] where c[k] != .null { props[k] = c[k] } }
        if c["expanded"] != .null { props["aria-expanded"] = .string(c["expanded"] == .bool(true) ? "true" : "false") }
        var children: [AWCNode] = c["label"] == .null || tag == "md-fab" ? [] : [.text(c["label"].string)]
        let slot = c["slot"].string
        if slot.contains("slot=\"leading-icon\"") { children.append(.symbol("favorite", slot: "leading-icon")) }
        if slot.contains("slot=\"trailing-icon\"") { children.append(.symbol("arrow_drop_down", slot: "trailing-icon")) }
        let node = AWCNode(id: "button", tag: tag, properties: props, children: children)
        // An authored inline size is the native appearance width (the border box is fixed; overflowing content clips).
        let width: AWCButtonAppearance = c["width"] == .null ? .init() : .init(width: Self.px(c["width"].string))
        return ZStack(alignment: .topLeading) {
            AWCNativeView(node: node) { _ in }
                .awcButtonAppearance(Self.appearance(c["hooks"], parts: c["name"].string).merging(width))
                .frame(width: 360, alignment: .topLeading)
                .awcDensity(c["inheritedDensity"].number ?? .nan)
                .environment(\.layoutDirection, c["dir"].string == "rtl" ? .rightToLeft : .leftToRight)
                .offset(x: 40, y: 40)
        }
        .awcTheme(theme)
        .awcNativeInspection(rootID: "button", coordinateSpace: "awc-native-preview") { if state.epoch == epoch { state.measurements = $0 } }
        .id(epoch)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(theme.background).coordinateSpace(name: "awc-native-preview")
    }
}
struct ButtonGrid {
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
@main @MainActor enum NativeButtonPaintIntegration {
    static let state = ButtonPaintFixtureState()
    static var host: NSHostingView<ButtonPaintFixture>!, window: NSWindow!
    static var checks = 0, failures: [String] = []
    static var report: [[String: Any]] = []
    static let env = ProcessInfo.processInfo.environment
    static let captureDir = env["AWC_BUTTON_PAINT_CAPTURE_DIRECTORY"].map { URL(fileURLWithPath: $0) }
    static func check(_ value: Bool, _ name: String) { checks += 1; if !value { failures.append(name); print("FAIL: " + name); fflush(stdout) } }
    static func pump(_ duration: Double = 0.1) { let end = Date().addingTimeInterval(duration); repeat { while let e = NSApp.nextEvent(matching: .any, until: .distantPast, inMode: .default, dequeue: true) { NSApp.sendEvent(e) }; host.layoutSubtreeIfNeeded(); host.displayIfNeeded(); _ = RunLoop.current.run(mode: .default, before: Date().addingTimeInterval(0.004)) } while Date() < end }
    struct Shot { let cg: CGImage; let scale: Double; let origin: CGPoint }
    static func capture(_ r: CGRect) -> Shot {
        let rr = host.isFlipped ? r : CGRect(x: r.minX, y: host.bounds.height - r.maxY, width: r.width, height: r.height)
        let b = host.bitmapImageRepForCachingDisplay(in: rr)!; host.cacheDisplay(in: rr, to: b)
        return .init(cg: b.cgImage!, scale: Double(b.pixelsWide) / r.width, origin: r.origin)
    }
    static func grid(_ s: Shot, x: Int, y: Int, w: Int, h: Int) -> ButtonGrid {
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
    static func run(_ c: AWCValue, shots: URL) {
        let name = c["name"].string, s = c["snap"]
        state.c = c; state.epoch += 1; state.measurements = []; pump(0.25)
        let nodes = state.measurements, root = nodes.first { $0.id == "component" }
        let web = rect(s["rect"])
        if let r = root?.bounds { check(abs(r.minX - web.minX) <= 0.6 && abs(r.minY - web.minY) <= 0.6 && abs(r.width - web.width) <= 1.0 && abs(r.height - web.height) <= 0.6, "\(name) border box \(r) vs \(web)") }
        else { check(false, "\(name) measured") }
        if s["label"] != .null, let l = nodes.first(where: { $0.id == "component.label" })?.bounds, rect(s["label"]["rect"]).width > 0 {
            let wl = rect(s["label"]["rect"])
            check(abs(l.midX - wl.midX) <= 1.0 && abs(l.width - wl.width) <= 1.5, "\(name) label box \(l) vs \(wl)")
        }
        let loader = s["loading"] == .null ? nil : rect(s["loading"]["rect"])
        if let loader, let nl = nodes.first(where: { $0.id == "component.loader" })?.bounds { check(abs(nl.midX - loader.midX) <= 1 && abs(nl.width - loader.width) <= 1, "\(name) loader box \(nl) vs \(loader)") }
        let clip = c["clip"], cx = Int(clip["x"].number!), cy = Int(clip["y"].number!), cw = Int(clip["width"].number!), ch = Int(clip["height"].number!)
        let native = capture(CGRect(x: cx, y: cy, width: cw, height: ch))
        guard let source = NSImage(contentsOf: shots.appendingPathComponent(name + ".png"))?.cgImage(forProposedRect: nil, context: nil, hints: nil) else { check(false, "\(name) shot"); return }
        let wg = grid(.init(cg: source, scale: 1, origin: .init(x: cx, y: cy)), x: cx, y: cy, w: cw, h: ch), ng = grid(native, x: cx, y: cy, w: cw, h: ch)
        var n = 0, bad = 0, sum = 0.0, worst = 0.0, worstAt = ""
        for py in (cy + 1)..<(cy + ch - 1) { for pxl in (cx + 1)..<(cx + cw - 1) where wg.flat(pxl, py, 6) && ng.flat(pxl, py, 6) {
            if let loader, loader.insetBy(dx: -2, dy: -2).contains(CGPoint(x: Double(pxl) + 0.5, y: Double(py) + 0.5)) { continue }
            let a = wg.at(pxl, py), b = ng.at(pxl, py); var d = 0.0; for k in 0..<3 { d = max(d, abs(a[k] - b[k])) }
            n += 1; sum += d; if d > 6 { bad += 1 }
            if d > worst { worst = d; worstAt = "(\(pxl),\(py)) web \(a.map { Int($0) }) native \(b.map { Int($0.rounded()) })" }
        } }
        let mean = sum / Double(max(n, 1))
        check(n > 400 && Double(bad) / Double(max(n, 1)) <= 0.005 && mean <= 1.0, "\(name) flat pixels match (mean \(mean), >6: \(bad)/\(n), worst \(worst) at \(worstAt))")
        if let dir = captureDir { try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true); try? NSBitmapImageRep(cgImage: native.cg).representation(using: .png, properties: [:])?.write(to: dir.appendingPathComponent(name + ".png")) }
        report.append(["case": name, "group": c["group"].string, "compared": n, "mean": mean, "over6": bad, "worst": worst, "worstAt": worstAt,
                       "native": root.map { ["x": $0.bounds.minX, "y": $0.bounds.minY, "width": $0.bounds.width, "height": $0.bounds.height] } ?? [:]])
    }
    static func main() {
        _ = NSApplication.shared; NSApp.setActivationPolicy(.accessory)
        host = NSHostingView(rootView: ButtonPaintFixture(state: state)); window = NSWindow(contentRect: .init(x: -20000, y: -20000, width: 1200, height: 900), styleMask: [.borderless], backing: .buffered, defer: false); window.isReleasedWhenClosed = false; window.colorSpace = .sRGB; window.contentView = host; window.orderFrontRegardless(); pump(0.3)
        let fixtures = URL(fileURLWithPath: #filePath).deletingLastPathComponent().appendingPathComponent("Fixtures")
        let oracle = try! JSONDecoder().decode(AWCValue.self, from: Data(contentsOf: fixtures.appendingPathComponent("button-web-paint.json")))
        let only = env["AWC_BUTTON_PAINT_ONLY"]
        for c in oracle["cases"].array where only.map({ c["name"].string.contains($0) }) ?? true { run(c, shots: fixtures.appendingPathComponent("button-web-paint")) }
        if let output = env["AWC_BUTTON_PAINT_OUTPUT"] { try! JSONSerialization.data(withJSONObject: ["checks": checks, "failures": failures, "report": report], options: [.prettyPrinted, .sortedKeys]).write(to: URL(fileURLWithPath: output)) }
        print("Button native paint: \(checks - failures.count)/\(checks) checks passed")
        window.close(); if !failures.isEmpty { exit(1) }
    }
}
