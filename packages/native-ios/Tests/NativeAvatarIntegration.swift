import AppKit
import SwiftUI
import Observation
@testable import AWCUI

// md-avatar against Chrome (md-avatar/web-oracle: paint.html, lifecycle.html; DPR 1, 1200×900):
// 278 paint cases (size × shape × content × theme × direction, density incl. inherited, custom
// CSS sizes, every hook together and alone, palette hooks, parts, slots), 52 identity cases
// (initials, palette bucket, role, label), 4 image lifecycle scripts (load/error/recover with
// mdLoad/mdError order) and the AWCNativeView dispatch path.
@Observable final class AvatarFixtureState {
    var c: AWCValue = .null
    var props: [String: AWCValue] = [:]
    var epoch = 0
    var dispatch = false
    var measurements: [AWCNativeInspectionNode] = []
    var events: [(String, String)] = []
}
struct AvatarFixture: View {
    let state: AvatarFixtureState
    static func corners(_ css: String) -> AWCCornerShape {
        let halves = css.split(separator: "/").map { $0.split(separator: " ").compactMap { Double($0.replacingOccurrences(of: "px", with: "")) } }
        func four(_ v: [Double]) -> [Double] { v.count == 1 ? [v[0], v[0], v[0], v[0]] : v.count == 2 ? [v[0], v[1], v[0], v[1]] : v.count == 3 ? [v[0], v[1], v[2], v[1]] : v }
        let h = four(halves[0]), v = halves.count > 1 ? four(halves[1]) : h
        func r(_ i: Int) -> AWCCornerRadius { .init(x: .points(h[i]), y: .points(v[i])) }
        return .init(topLeft: r(0), topRight: r(1), bottomRight: r(2), bottomLeft: r(3))
    }
    static func length(_ css: String?) -> AWCAvatarLength? { css.flatMap { AWCAvatarLength(css: $0) } }
    static func appearance(_ hooks: AWCValue) -> AWCAvatarAppearance {
        func s(_ k: String) -> String? { hooks[k] == .null ? nil : hooks[k].string }
        return .init(size: length(s("size")), containerColor: s("container-color"), containerShape: s("container-shape").map(corners), labelColor: s("label-color"),
                     labelFontFamily: s("label-font-family"), labelFontSize: length(s("label-font-size")), labelFontWeight: s("label-font-weight").flatMap(Double.init),
                     labelLetterSpacing: length(s("label-letter-spacing")), iconSize: length(s("icon-size")), outlineColor: s("outline-color"), outlineWidth: length(s("outline-width")),
                     palette1Container: s("palette-1-container"), palette1Label: s("palette-1-label"), palette2Container: s("palette-2-container"), palette2Label: s("palette-2-label"), palette3Container: s("palette-3-container"), palette3Label: s("palette-3-label"), palette4Container: s("palette-4-container"), palette4Label: s("palette-4-label"), palette5Container: s("palette-5-container"), palette5Label: s("palette-5-label"), palette6Container: s("palette-6-container"), palette6Label: s("palette-6-label"), palette7Container: s("palette-7-container"), palette7Label: s("palette-7-label"))
    }
    static func parts(_ css: String) -> AWCAvatarPartAppearance {
        if css.contains("part(initials)") { return .init(initialsColor: "#1B5E20", initialsFontSize: .points(18), initialsLetterSpacing: .points(0)) }
        if css.contains("part(icon)") { return .init(iconColor: "#E65100", iconFontSize: .points(20)) }
        if css.contains("part(image)") { return .init(imagePositionX: 0, imagePositionY: 0, imageOpacity: 0.5) }
        return .init()
    }
    static func slot(_ html: String) -> [AWCNode] {
        if html.contains("md-badge") { return [AWCNode(tag: "md-badge", properties: html.contains("value=") ? ["value": "3"] : [:])] }
        if html.contains("★") { return [.text("★")] }
        return []
    }
    var body: some View {
        let c = state.c, epoch = state.epoch, theme = AWCTheme.generated(dark: c["theme"].string == "dark")
        let x = c["rect"]["x"].number ?? 40, y = c["rect"]["y"].number ?? 40
        let node = AWCNode(id: "avatar", tag: "md-avatar", properties: state.props, children: AvatarFixture.slot(c["slot"] == .null ? "" : c["slot"].string))
        ZStack(alignment: .topLeading) {
            Group {
                if state.dispatch {
                    AWCNativeView(node: node, onEvent: { e in state.events.append((e.name, e.detail["src"].string)) })
                } else {
                    AWCNativeAvatar(nodeID: "avatar", properties: state.props, theme: theme, emit: { name, detail in state.events.append((name, detail["src"].string)) },
                                    slotItems: node.children(inSlot: nil), child: { AnyView(AWCNativeView(node: $0)) })
                }
            }
            .awcAvatarAppearance(AvatarFixture.appearance(c["hooks"]))
            .awcAvatarPartAppearance(AvatarFixture.parts(c["parts"] == .null ? "" : c["parts"].string))
            .environment(\.awcNativeDensity, c["inherit"].number ?? 0)
            .environment(\.layoutDirection, c["direction"].string == "rtl" ? .rightToLeft : .leftToRight)
            .awcTheme(theme)
            .padding(.leading, x).padding(.top, y)
        }
        .awcNativeInspection(rootID: "avatar", coordinateSpace: "avatar-root") { if state.epoch == epoch { state.measurements = $0 } }
        .id(epoch)
        .awcAvatarViewport(CGSize(width: 1200, height: 900))
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(theme.background).coordinateSpace(name: "avatar-root")
        .environment(\.layoutDirection, .leftToRight)
    }
}
struct AvatarGrid { let x: Int, y: Int, w: Int, h: Int; var v: [Double]
    func at(_ px: Int, _ py: Int) -> [Double] { let i = ((py - y) * w + (px - x)) * 3; return [v[i], v[i+1], v[i+2]] }
    func flat(_ px: Int, _ py: Int, _ limit: Double) -> Bool {
        guard px - 1 >= x, py - 1 >= y, px + 1 < x + w, py + 1 < y + h else { return false }
        for c in 0..<3 { var lo = 999.0, hi = -1.0
            for dy in -1...1 { for dx in -1...1 { let q = v[((py + dy - y) * w + (px + dx - x)) * 3 + c]; lo = min(lo, q); hi = max(hi, q) } }
            if hi - lo > limit { return false } }
        return true
    }
}
@main @MainActor enum NativeAvatarIntegration {
    static let state = AvatarFixtureState()
    static var host: NSHostingView<AvatarFixture>!, window: NSWindow!
    static var checks = 0, failures: [String] = [], report: [[String: Any]] = []
    static func check(_ ok: Bool, _ name: String) { checks += 1; if !ok { failures.append(name); print("FAIL: " + name); fflush(stdout) } }
    static func pump(_ d: Double = 0.1) { let end = Date().addingTimeInterval(d); repeat { while let e = NSApp.nextEvent(matching: .any, until: .distantPast, inMode: .default, dequeue: true) { NSApp.sendEvent(e) }; host.layoutSubtreeIfNeeded(); host.displayIfNeeded(); _ = RunLoop.current.run(mode: .default, before: Date().addingTimeInterval(0.002)) } while Date() < end }
    struct Shot { let cg: CGImage; let scale: Double; let origin: CGPoint }
    static func capture(_ r: CGRect) -> Shot {
        let rr = host.isFlipped ? r : CGRect(x: r.minX, y: host.bounds.height - r.maxY, width: r.width, height: r.height)
        let b = host.bitmapImageRepForCachingDisplay(in: rr)!; host.cacheDisplay(in: rr, to: b)
        return .init(cg: b.cgImage!, scale: Double(b.pixelsWide) / r.width, origin: r.origin)
    }
    static func grid(_ s: Shot, x: Int, y: Int, w: Int, h: Int) -> AvatarGrid {
        let k = max(1, Int(s.scale.rounded()))
        var v = [Double](repeating: -999, count: max(0, w * h * 3))
        guard w > 0, h > 0, let cg = s.cg.cropping(to: CGRect(x: (Double(x) - s.origin.x) * Double(k), y: (Double(y) - s.origin.y) * Double(k), width: Double(w * k), height: Double(h * k))),
              cg.width == w * k, cg.height == h * k else { return .init(x: x, y: y, w: w, h: h, v: v) }
        var buf = [UInt8](repeating: 0, count: cg.width * cg.height * 4)
        buf.withUnsafeMutableBytes { raw in
            let ctx = CGContext(data: raw.baseAddress, width: cg.width, height: cg.height, bitsPerComponent: 8, bytesPerRow: cg.width * 4, space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
            ctx.draw(cg, in: .init(x: 0, y: 0, width: cg.width, height: cg.height))
        }
        for py in 0..<h { for px in 0..<w { var sum = [0.0, 0.0, 0.0]
            for yy in (py * k)..<(py * k + k) { for xx in (px * k)..<(px * k + k) { let i = (yy * cg.width + xx) * 4; for c in 0..<3 { sum[c] += Double(buf[i + c]) } } }
            for c in 0..<3 { v[(py * w + px) * 3 + c] = sum[c] / Double(k * k) } } }
        return .init(x: x, y: y, w: w, h: h, v: v)
    }
    static func diff(_ a: [Double], _ b: [Double]) -> Double { (0..<3).map { abs(a[$0] - b[$0]) }.max()! }
    static func css(_ s: String) -> [Double] {
        let n = s.split(whereSeparator: { !"0123456789.-e".contains($0) }).compactMap { Double($0) }
        if s.hasPrefix("rgba") { return [n[0] / 255, n[1] / 255, n[2] / 255, n[3]] }
        if s.hasPrefix("rgb") { return [n[0] / 255, n[1] / 255, n[2] / 255, 1] }
        if s.hasPrefix("color(srgb") { return [n[0], n[1], n[2], n.count > 3 ? n[3] : 1] }
        return []
    }
    static func node(_ name: String) -> AWCNativeInspectionNode? { state.measurements.first { $0.name == name } }
    /// Ink of glyphs inside the avatar: pixels far from the container fill. Compared by centroid
    /// and extent, not per pixel: font rasterisation differs by platform.
    static func ink(_ g: AvatarGrid, rect: CGRect, fill: [Double]) -> (cx: Double, cy: Double, minX: Double, maxX: Double, minY: Double, maxY: Double, n: Double)? {
        var sx = 0.0, sy = 0.0, n = 0.0, x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9
        // The centered 70 % square: inside every shape (a circle's corners stay outside it) and
        // around the initials/icon box (40 %/60 % of the size).
        let half = rect.width * 0.35, x0i = Int((rect.midX - half).rounded(.up)), x1i = Int((rect.midX + half).rounded(.down)), y0i = Int((rect.midY - half).rounded(.up)), y1i = Int((rect.midY + half).rounded(.down))
        for py in y0i..<max(y0i, y1i) { for px in x0i..<max(x0i, x1i) where px >= g.x && py >= g.y && px < g.x + g.w && py < g.y + g.h {
            let d = diff(g.at(px, py), fill) / 255
            if d > 0.08 { let w = min(1, d * 2); sx += Double(px) * w; sy += Double(py) * w; n += w; x0 = min(x0, Double(px)); x1 = max(x1, Double(px)); y0 = min(y0, Double(py)); y1 = max(y1, Double(py)) }
        } }
        return n < 2 ? nil : (sx / n, sy / n, x0, x1, y0, y1, n)
    }
    static func props(_ c: AWCValue) -> [String: AWCValue] {
        var p: [String: AWCValue] = [:]
        if case .object(let o) = c["props"] { for (k, v) in o { p[k] = v } }
        return p
    }
    static func paint(_ c: AWCValue, shots: URL) {
        let name = c["name"].string
        guard c["hidden"].bool != true, !s(c["slot"]).contains("<svg") else { return }
        state.dispatch = false; state.c = c; state.props = props(c); state.epoch += 1; pump(0.25)
        var tries = 0; while tries < 20, state.props["src"]?.string.isEmpty == false, node("image") == nil, node("initials") == nil, node("icon") == nil, node("slot") == nil { pump(0.05); tries += 1 }
        guard let a = node("md-avatar") else { check(false, "\(name) measured"); return }
        let r = c["rect"], wr = CGRect(x: r["x"].number!, y: r["y"].number!, width: r["width"].number!, height: r["height"].number!)
        check(abs(a.bounds.width - wr.width) <= 0.5 && abs(a.bounds.height - wr.height) <= 0.5, "\(name) size \(a.bounds.size) vs \(wr.size)")
        let mode = String(c["classes"].string.split(separator: " ").first { $0.hasPrefix("md-avatar--mode-") }?.dropFirst(16) ?? "")
        check(a.metrics["mode"]?.string == mode, "\(name) mode \(a.metrics["mode"]?.string ?? "nil") vs \(mode)")
        let palette = Double(c["classes"].string.split(separator: " ").first { $0.hasPrefix("md-avatar--palette-") }?.dropFirst(19) ?? "0") ?? 0
        check(a.metrics["palette"]?.number == palette, "\(name) palette \(a.metrics["palette"]?.number ?? -1) vs \(palette)")
        check(a.metrics["role"]?.string == c["role"].string && (a.metrics["label"]?.string ?? "") == (c["ariaLabel"] == .null ? "" : c["ariaLabel"].string), "\(name) role/label \(a.metrics["role"]?.string ?? "") \(a.metrics["label"]?.string ?? "")")
        let bg = css(c["style"]["background"].string), nb = a.metrics["background"]?.array.compactMap(\.number) ?? []
        check(nb.count == 4 && bg.count == 4 && (0..<4).allSatisfy { i in abs((i < 3 ? nb[i] * nb[3] : nb[3]) - (i < 3 ? bg[i] * bg[3] : bg[3])) <= 0.006 }, "\(name) container \(nb) vs \(bg)")
        let fg = css(c["style"]["color"].string), nf = a.metrics["color"]?.array.compactMap(\.number) ?? []
        if mode != "image" { check(nf.count == 4 && fg.count == 4 && (0..<3).allSatisfy { abs(nf[$0] - fg[$0]) <= 0.006 }, "\(name) label colour \(nf) vs \(fg)") }
        if mode == "initials", let i = node("initials") {
            let wi = c["initials"]
            check(i.metrics["text"]?.string == wi["text"].string, "\(name) initials \(i.metrics["text"]?.string ?? "") vs \(wi["text"].string)")
            let fs = Double(wi["fontSize"].string.replacingOccurrences(of: "px", with: "")) ?? -1, ls = Double(wi["letterSpacing"].string.replacingOccurrences(of: "px", with: "")) ?? 0
            check(abs((i.metrics["fontSize"]?.number ?? 0) - fs) <= 0.01 && abs((i.metrics["letterSpacing"]?.number ?? 0) - ls) <= 0.01, "\(name) label font \(i.metrics["fontSize"]?.number ?? 0)/\(i.metrics["letterSpacing"]?.number ?? 0) vs \(fs)/\(ls)")
            // Fallback-font runs (emoji) have platform advances: width within 2 pt, centring exact.
            let ascii = wi["text"].string.allSatisfy(\.isASCII), ww = wi["rect"]["width"].number!
            if ww == 0 { check(i.bounds.width <= 0.5 || (i.metrics["fontSize"]?.number ?? 1) == 0, "\(name) zero-size typography paints nothing") }
            else { check(abs(i.bounds.width - ww) <= (ascii ? 1.0 : 2.0) && abs(i.bounds.midX - (wi["rect"]["x"].number! + ww / 2)) <= 0.6, "\(name) initials run \(i.bounds) vs \(wi["rect"])") }
        }
        if mode == "slot", let i = node("icon"), c["icon"]["fontSize"].string != "" {
            let fs = Double(c["icon"]["fontSize"].string.replacingOccurrences(of: "px", with: "")) ?? -1
            check(abs((i.metrics["fontSize"]?.number ?? 0) - fs) <= 0.01, "\(name) icon size \(i.metrics["fontSize"]?.number ?? 0) vs \(fs)")
        }
        guard wr.width > 0 else { return }
        let clip = c["clip"], cx = Int(clip["x"].number!), cy = Int(clip["y"].number!), cw = Int(clip["width"].number!), ch = Int(clip["height"].number!)
        guard let src = NSImage(contentsOf: shots.appendingPathComponent(name + ".png"))?.cgImage(forProposedRect: nil, context: nil, hints: nil) else { check(false, "\(name) shot"); return }
        let web = grid(.init(cg: src, scale: 1, origin: CGPoint(x: cx, y: cy)), x: cx, y: cy, w: cw, h: ch)
        let shot = capture(CGRect(x: cx, y: cy, width: cw, height: ch)), nat = grid(shot, x: cx, y: cy, w: cw, h: ch)
        if let dir = ProcessInfo.processInfo.environment["AWC_AVATAR_CAPTURE_DIRECTORY"] {
            try? FileManager.default.createDirectory(atPath: dir, withIntermediateDirectories: true)
            try? NSBitmapImageRep(cgImage: shot.cg).representation(using: .png, properties: [:])?.write(to: URL(fileURLWithPath: dir).appendingPathComponent(name + ".png"))
        }
        var n = 0, bad = 0, sum = 0.0, worst = 0.0, worstAt = ""
        for py in (cy + 1)..<(cy + ch - 1) { for px in (cx + 1)..<(cx + cw - 1) where web.flat(px, py, 6) && nat.flat(px, py, 6) {
            let d = diff(web.at(px, py), nat.at(px, py)); n += 1; sum += d; if d > 6 { bad += 1 }
            if d > worst { worst = d; worstAt = "(\(px),\(py)) web \(web.at(px, py).map { Int($0) }) native \(nat.at(px, py).map { Int($0.rounded()) })" }
        } }
        let mean = sum / Double(max(n, 1))
        check(n > 20 && Double(bad) / Double(n) <= 0.005 && mean <= 1.0, "\(name) flat pixels (mean \(mean), >6: \(bad)/\(n), worst \(worst) at \(worstAt))")
        var entry: [String: Any] = ["case": name, "compared": n, "mean": mean, "over6": bad, "worst": worst]
        if mode == "initials" || (mode == "slot" && c["slotted"].array.isEmpty) || !c["slotted"].array.isEmpty {
            let fill = web.at(Int(wr.midX), Int(wr.minY) + 1 + (s(c["props"]["shape"]) == "square" ? 0 : Int(wr.height * 0.15)))
            let fillN = nat.at(Int(wr.midX), Int(wr.minY) + 1 + (s(c["props"]["shape"]) == "square" ? 0 : Int(wr.height * 0.15)))
            let w = ink(web, rect: wr, fill: fill), v = ink(nat, rect: wr, fill: fillN)
            if let w, let v {
                // Glyph placement, not glyph shapes: horizontally within one CSS pixel; vertically
                // within 1.5 (Chrome snaps text baselines to whole pixels at DPR 1, native renders
                // at 2x and hints differently at small sizes). Exact metrics are checked above.
                let tol = c["hooks"]["label-font-family"].string == "monospace" ? 1.5 : 1.0
                check(abs(w.cx - v.cx) <= tol && abs(w.cy - v.cy) <= 1.5, "\(name) glyph ink centroid (\(v.cx),\(v.cy)) vs (\(w.cx),\(w.cy))")
                check(abs(w.minX - v.minX) <= 2 && abs(w.maxX - v.maxX) <= 2 && abs(w.minY - v.minY) <= 2 && abs(w.maxY - v.maxY) <= 2, "\(name) glyph ink extent x \(v.minX)…\(v.maxX) vs \(w.minX)…\(w.maxX), y \(v.minY)…\(v.maxY) vs \(w.minY)…\(w.maxY)")
                entry["ink"] = ["web": [w.cx, w.cy, w.minX, w.maxX, w.minY, w.maxY], "native": [v.cx, v.cy, v.minX, v.maxX, v.minY, v.maxY]]
            } else if wr.width >= 16 { check((w == nil) == (v == nil), "\(name) glyph ink presence agrees (web \(w != nil), native \(v != nil))") }
        }
        report.append(entry)
    }
    static func s(_ v: AWCValue) -> String { v == .null ? "" : v.string }
    static func identity(_ cases: [AWCValue]) {
        for c in cases {
            let i = c["input"], ini = s(i["initials"]), name = s(i["name"]), label = s(i["label"]), alt = s(i["alt"]), cfn = i["colorFromName"].bool ?? true
            let text = AWCAvatarIdentity.initials(initials: ini, name: name, locale: Locale(identifier: "en_US"))
            let mode = text.isEmpty ? "slot" : "initials"
            check(mode == c["mode"].string, "identity \(i) mode \(mode) vs \(c["mode"].string)")
            if mode == "initials" { check(text == c["initials"].string, "identity \(i) initials \(text) vs \(c["initials"].string)") }
            let p = AWCAvatarIdentity.palette(initials: ini, name: name, label: label, colorFromName: cfn)
            check(Double(p) == c["palette"].number, "identity \(i) palette \(p) vs \(c["palette"].number ?? -1)")
            let l = AWCAvatarIdentity.accessibleLabel(label: label, alt: alt, name: name)
            check((l == nil ? "presentation" : "img") == c["role"].string && (l ?? "") == s(c["ariaLabel"]), "identity \(i) role/label \(l ?? "nil")")
        }
    }
    static func lifecycle(_ runs: [AWCValue], images: AWCValue) {
        for r in runs {
            let name = r["name"].string, script = r["script"].array
            state.dispatch = false; state.c = .object(["theme": "light"]); state.props = ["size": "large"]; state.events = []; state.epoch += 1; pump(0.2)
            var native: [(String, Int, String)] = []
            check(script.count == r["trace"].array.count - 1, "\(name) script matches the Chrome trace")
            for (step, t) in r["trace"].array.dropFirst().enumerated() {
                let key = script[step].array[0].string, raw = script[step].array[1]
                var value = raw
                if key == "src", case .string(let k) = raw { value = .string(k.isEmpty ? "" : images[k].string) }
                check(t["set"].array[0].string == key, "\(name) step \(step) sets \(key)")
            let before = state.events.count
                state.props[key] = value; pump(0.3)
                for e in state.events[before...] { native.append((e.0, step, String(e.1.prefix(40)))) }
                guard let a = node("md-avatar") else { check(false, "\(name) step \(step) measured"); continue }
                let w = t["settled"]
                check(a.metrics["mode"]?.string == w["mode"].string, "\(name) step \(step) mode \(a.metrics["mode"]?.string ?? "") vs \(w["mode"].string)")
                check(a.metrics["palette"]?.number == w["palette"].number, "\(name) step \(step) palette \(a.metrics["palette"]?.number ?? -1) vs \(w["palette"].number ?? -1)")
                check((a.metrics["initials"]?.string ?? "") == s(w["initials"]), "\(name) step \(step) initials")
                check(a.metrics["role"]?.string == w["role"].string && (a.metrics["label"]?.string ?? "") == s(w["ariaLabel"]), "\(name) step \(step) role/label")
                let bg = css(w["background"].string), nb = a.metrics["background"]?.array.compactMap(\.number) ?? []
                check(nb.count == 4 && bg.count == 4 && (0..<4).allSatisfy { i in abs((i < 3 ? nb[i] * nb[3] : nb[3]) - (i < 3 ? bg[i] * bg[3] : bg[3])) <= 0.006 }, "\(name) step \(step) background \(nb) vs \(bg)")
            }
            let web = r["events"].array.map { ($0["name"].string, Int($0["step"].number!), $0["detail"]["src"].string) }
            check(native.map { "\($0.0)@\($0.1)" } == web.map { "\($0.0)@\($0.1)" }, "\(name) events \(native.map { "\($0.0)@\($0.1)" }) vs \(web.map { "\($0.0)@\($0.1)" })")
            check(zip(native, web).allSatisfy { $0.2 == $1.2 }, "\(name) event src payloads")
            report.append(["lifecycle": name, "events": native.count])
        }
    }
    static func dispatch(_ c: AWCValue, shots: URL) {
        state.dispatch = true; state.c = c; state.props = props(c); state.epoch += 1; pump(0.3)
        let a = node("md-avatar")
        check(a != nil && abs((a?.bounds.width ?? 0) - c["rect"]["width"].number!) <= 0.5 && a?.metrics["mode"]?.string == "initials", "AWCNativeView dispatches md-avatar to the dedicated renderer")
        state.dispatch = false
    }
    static func main() {
        _ = NSApplication.shared; NSApp.setActivationPolicy(.accessory)
        host = NSHostingView(rootView: AvatarFixture(state: state))
        window = NSWindow(contentRect: .init(x: -20000, y: -20000, width: 1200, height: 900), styleMask: [.borderless], backing: .buffered, defer: false)
        window.isReleasedWhenClosed = false; window.colorSpace = .sRGB; window.contentView = host; window.orderFrontRegardless(); pump(0.2)
        let fx = URL(fileURLWithPath: #filePath).deletingLastPathComponent().appendingPathComponent("Fixtures")
        let oracle = try! JSONDecoder().decode(AWCValue.self, from: Data(contentsOf: fx.appendingPathComponent("avatar-web-paint.json")))
        let life = try! JSONDecoder().decode(AWCValue.self, from: Data(contentsOf: fx.appendingPathComponent("avatar-web-lifecycle.json")))
        let only = ProcessInfo.processInfo.environment["AWC_AVATAR_ONLY"]
        identity(oracle["identity"].array)
        for c in oracle["paint"].array where only == nil || c["name"].string.contains(only!) { paint(c, shots: fx.appendingPathComponent("avatar-web-paint")) }
        lifecycle(life["runs"].array, images: life["images"])
        if let c = oracle["paint"].array.first(where: { $0["name"].string == "matrix-medium-circle-initials-light-ltr" }) { dispatch(c, shots: fx) }
        if let out = ProcessInfo.processInfo.environment["AWC_AVATAR_OUTPUT"] { try! JSONSerialization.data(withJSONObject: ["checks": checks, "failures": failures, "report": report], options: [.prettyPrinted, .sortedKeys]).write(to: URL(fileURLWithPath: out)) }
        print("Avatar native renderer: \(checks - failures.count)/\(checks) checks passed")
        window.close(); if !failures.isEmpty { exit(1) }
    }
}
