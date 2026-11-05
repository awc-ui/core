import AppKit
import SwiftUI
import Observation
import QuartzCore
@testable import AWCUI

// md-card interaction against Chrome trusted-input records (web-oracle/states.html, and the
// reduced-motion set): pointer, keyboard, drag (threshold, translate, z-index), drag-then-click,
// ripple off, soft/hard disabled, nested controls, custom hooks and RTL. Each rendered value is
// compared at its render time with Chrome's per-frame samples; phase paint, geometry, focus,
// payloads, event order and source timings are checked too.
@Observable final class CardStatesFixtureState {
    var run: AWCValue = .null
    var epoch = 0
    var reduced = false
    var measurements: [AWCNativeInspectionNode] = []
    var events: [(String, AWCValue, Double)] = []
    var innerClicks = 0
    let pointer = AWCNativePointerState()
}
struct CardStatesFixture: View {
    let state: CardStatesFixtureState
    static let hooks = AWCCardAppearance(containerColor: "#22556699", containerShape: .init(topLeft: .init(x: .points(20), y: .points(8)), topRight: .init(x: .points(4), y: .points(12)), bottomRight: .init(x: .points(20), y: .points(8)), bottomLeft: .init(x: .points(4), y: .points(12))),
                                         containerElevation: [AWCBoxShadow(x: 0, y: 3, blur: 6, spread: 0, color: "#00000033")], outlineColor: "#CC3377CC", outlineWidth: 3, stateLayerColor: "#33EEAA80",
                                         width: .points(280), minWidth: .points(200), maxWidth: .points(300), height: .points(190), minHeight: .points(150), maxHeight: .points(220), padding: .init(vertical: 10, horizontal: 18), gap: 13)
    var body: some View {
        let r = state.run, epoch = state.epoch, theme = AWCTheme.generated(dark: r["theme"].string == "dark"), scenario = r["scenario"].string
        var props: [String: AWCValue] = ["variant": .string(r["variant"].string)]
        for (k, v) in r["props"].object { props[k] = v }
        let nested = scenario == "nested"
        return ZStack(alignment: .topLeading) {
            AWCNativeView(node: .init(id: "before", tag: "md-button", properties: ["variant": "text"], children: [.text("Before")])).offset(x: 1000, y: 10)
            AWCNativeCard(node: .init(id: "card", tag: "md-card", properties: props), theme: theme, interactiveContent: nested, label: "Card title",
                          emit: { name, detail in state.events.append((name, detail, CACurrentMediaTime() * 1000)) }) {
                Text("Card title").frame(maxWidth: .infinity, minHeight: 20, maxHeight: 20, alignment: .topLeading)
                if nested {
                    AWCNativeView(node: .init(id: "inner", tag: "md-button", properties: ["variant": "outlined"], children: [.text("Inner action")]), onEvent: { e in if e.name == "mdClick" { state.innerClicks += 1 } })
                        .fixedSize().frame(maxWidth: .infinity, minHeight: 36, maxHeight: 36, alignment: .leading).modifier(AWCCardInteractiveRegion(active: true))
                } else { Text("Two lines of body content").frame(maxWidth: .infinity, minHeight: 40, maxHeight: 40, alignment: .topLeading) }
                Text("Footer").frame(maxWidth: .infinity, minHeight: 30, maxHeight: 30, alignment: .topLeading)
            }
            .awcCardAppearance(scenario == "custom" ? Self.hooks : .init())
            .frame(width: 320, height: 240, alignment: .topLeading)
            .environment(\.layoutDirection, r["dir"].string == "rtl" ? .rightToLeft : .leftToRight)
            .offset(x: 60, y: 60)
            AWCNativeView(node: .init(id: "after", tag: "md-button", properties: ["variant": "text"], children: [.text("After")])).offset(x: 10, y: 860)
        }
        .awcCardReducedMotion(state.reduced)
        .awcTheme(theme)
        .awcNativeInspection(rootID: "card", coordinateSpace: "awc-native-preview") { if state.epoch == epoch { state.measurements = $0 } }
        .environment(\.awcNativePointerState, state.pointer)
        .id(epoch)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(theme.background).coordinateSpace(name: "awc-native-preview")
    }
}
struct CardStatesGrid {
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
@main @MainActor enum NativeCardStatesIntegration {
    static let state = CardStatesFixtureState()
    static var host: NSHostingView<CardStatesFixture>!, window: NSWindow!
    static var checks = 0, failures: [String] = []
    static var report: [[String: Any]] = []
    static let captureDir = ProcessInfo.processInfo.environment["AWC_CARD_STATES_CAPTURE_DIRECTORY"].map { URL(fileURLWithPath: $0) }
    static func check(_ value: Bool, _ name: String) { checks += 1; if !value { failures.append(name); print("FAIL: " + name); fflush(stdout) } }
    static func pump(_ duration: Double = 0.1) { let end = Date().addingTimeInterval(duration); repeat { while let e = NSApp.nextEvent(matching: .any, until: .distantPast, inMode: .default, dequeue: true) { NSApp.sendEvent(e) }; host.layoutSubtreeIfNeeded(); host.displayIfNeeded(); _ = RunLoop.current.run(mode: .default, before: Date().addingTimeInterval(0.002)) } while Date() < end }
    static func now() -> Double { CACurrentMediaTime() * 1000 }
    static func mouse(_ kind: NSEvent.EventType, _ p: CGPoint) { let point = host.convert(.init(x: p.x, y: host.isFlipped ? p.y : host.bounds.height - p.y), to: nil); let e = NSEvent.mouseEvent(with: kind, location: point, modifierFlags: [], timestamp: ProcessInfo.processInfo.systemUptime, windowNumber: window.windowNumber, context: nil, eventNumber: 1, clickCount: 1, pressure: kind == .leftMouseUp ? 0 : 1)!; window.sendEvent(e) }
    static func key(_ code: UInt16, _ text: String) { let e = NSEvent.keyEvent(with: .keyDown, location: .zero, modifierFlags: [], timestamp: ProcessInfo.processInfo.systemUptime, windowNumber: window.windowNumber, context: nil, characters: text, charactersIgnoringModifiers: text, isARepeat: false, keyCode: code)!; window.sendEvent(e) }
    static func all(_ v: NSView) -> [NSView] { [v] + v.subviews.flatMap(all) }
    static func focusView(_ id: String) -> AWCNativeButtonFocusView? { all(host).compactMap { $0 as? AWCNativeButtonFocusView }.first { $0.accessibilityIdentifier() == id } }
    static func focusedID() -> String { (window.firstResponder as? AWCNativeButtonFocusView)?.accessibilityIdentifier() ?? "body" }
    struct Shot { let cg: CGImage; let scale: Double; let origin: CGPoint }
    static func capture(_ r: CGRect) -> Shot {
        let rr = host.isFlipped ? r : CGRect(x: r.minX, y: host.bounds.height - r.maxY, width: r.width, height: r.height)
        let b = host.bitmapImageRepForCachingDisplay(in: rr)!; host.cacheDisplay(in: rr, to: b)
        return .init(cg: b.cgImage!, scale: Double(b.pixelsWide) / r.width, origin: r.origin)
    }
    static func grid(_ s: Shot, x: Int, y: Int, w: Int, h: Int) -> CardStatesGrid {
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
    static func numbers(_ s: String) -> [Double] { var out: [Double] = [], cur = ""; for ch in s { if "0123456789.-e".contains(ch) { cur.append(ch) } else { if let v = Double(cur) { out.append(v) }; cur = "" } }; if let v = Double(cur) { out.append(v) }; return out }
    static func color(_ s: String) -> [Double] {
        let n = numbers(s)
        if s.hasPrefix("rgba") { return [n[0] / 255, n[1] / 255, n[2] / 255, n[3]] }
        if s.hasPrefix("rgb") { return [n[0] / 255, n[1] / 255, n[2] / 255, 1] }
        if s.hasPrefix("color(srgb") { return [n[0], n[1], n[2], n.count > 3 ? n[3] : 1] }
        return [0, 0, 0, 0]
    }
    static func pre(_ c: [Double]) -> [Double] { c.count < 4 ? c : [c[0] * c[3], c[1] * c[3], c[2] * c[3], c[3]] }
    /// Shadow list → padded [x,y,blur,spread, premultiplied r,g,b,a] × 2 layers.
    static func shadow(_ s: String) -> [Double] {
        var layers: [[Double]] = []
        if s != "none" {
            var parts: [String] = [], depth = 0, cur = ""
            for ch in s { if ch == "(" { depth += 1 }; if ch == ")" { depth -= 1 }; if ch == "," && depth == 0 { parts.append(cur); cur = "" } else { cur.append(ch) } }
            parts.append(cur)
            layers = parts.map { layer in
                let t = layer.trimmingCharacters(in: .whitespaces), close = t.firstIndex(of: ")")!
                let rest = numbers(String(t[t.index(after: close)...]))
                return [rest[0], rest[1], rest.count > 2 ? rest[2] : 0, rest.count > 3 ? rest[3] : 0] + pre(color(String(t[...close])))
            }
        }
        while layers.count < 2 { layers.append([0, 0, 0, 0, 0, 0, 0, 0]) }
        return layers.flatMap { $0 }
    }
    static func nativeShadow(_ v: AWCValue?) -> [Double] {
        let n = v?.array.compactMap(\.number) ?? []
        var layers = stride(from: 0, to: n.count, by: 8).map { i in Array(n[i..<(i + 4)]) + pre(Array(n[(i + 4)..<(i + 8)])) }
        while layers.count < 2 { layers.append([0, 0, 0, 0, 0, 0, 0, 0]) }
        return layers.flatMap { $0 }
    }
    struct Sample { let t: Double; let cardT: Double?; let layerT: Double?; let rippleT: Double?; let card: [String: AWCValue]; let layer: Double?; let ripple: [String: AWCValue]?; let frame: CGRect? }
    static func sample() -> Sample {
        let m = state.measurements, card = m.first { $0.name == "md-card" }, layer = m.first { $0.name == "state-layer" }, ripple = m.first { $0.name == "ripple" }
        return .init(t: now(), cardT: card?.metrics["renderTime"]?.number, layerT: layer?.metrics["renderTime"]?.number, rippleT: ripple?.metrics["renderTime"]?.number,
                     card: card?.metrics ?? [:], layer: layer?.metrics["opacity"]?.number, ripple: ripple?.metrics, frame: card?.bounds)
    }
    static func run(_ r: AWCValue, shots: URL, reduced: Bool) {
        let name = r["name"].string, scenario = r["scenario"].string, label = (reduced ? "reduced/" : "") + name
        state.reduced = reduced; state.run = r; state.pointer.update(phase: .leave); state.epoch += 1; pump(0.35)
        _ = window.makeFirstResponder(nil); state.events = []; state.innerClicks = 0; pump(0.05)
        let rest = r["rest"], p = CGPoint(x: r["pointer"].array[0].number!, y: r["pointer"].array[1].number!), away = CGPoint(x: 1190, y: 600)
        if let f = sample().frame { check(abs(f.minX - rest["x"].number!) <= 0.6 && abs(f.minY - rest["y"].number!) <= 0.6 && abs(f.width - rest["width"].number!) <= 0.6 && abs(f.height - rest["height"].number!) <= 0.6, "\(label) rest box \(f) vs \(rest)") }
        else { check(false, "\(label) card measured") }
        let phases = r["phases"].array, webT0 = phases.first?["t"].number ?? 0
        // Native actions per source phase (same inputs at the same source times).
        func move(_ q: CGPoint) { state.pointer.update(phase: .move, location: q); mouse(.leftMouseDragged, q) }
        func hoverTo(_ q: CGPoint) { state.pointer.update(phase: .move, location: q) }
        func down(_ q: CGPoint) { state.pointer.update(phase: .down, location: q); mouse(.leftMouseDown, q) }
        func up(_ q: CGPoint) { mouse(.leftMouseDragged, q); mouse(.leftMouseUp, q); state.pointer.update(phase: .up, location: q) }
        let nestedRect = CGRect(x: rest["x"].number!, y: rest["y"].number!, width: rest["width"].number!, height: rest["height"].number!)
        // The source pressed the inner button's centre; its mdClick reports that point.
        let innerClick = r["events"].array.filter { $0["name"].string == "mdClick" }.dropFirst().first
        func innerCenter() -> CGPoint { CGPoint(x: innerClick?["detail"]["clientX"].number ?? nestedRect.minX + 70, y: innerClick?["detail"]["clientY"].number ?? nestedRect.minY + 62) }
        typealias Step = (Double, () -> Void)
        var actions: [String: [Step]] = [:]
        actions["hover"] = [(0, { hoverTo(p) })]
        actions["press"] = [(0, { down(p) })]
        actions["release"] = [(0, { up(p) })]
        actions["leave"] = [(0, { state.pointer.update(phase: .leave) })]
        actions["tab"] = [(0, { key(48, "\t") })]
        actions["enter"] = [(0, { key(36, "\r") })]
        actions["space"] = [(0, { key(49, " ") })]
        actions["tabAway"] = [(0, { key(48, "\t") })]
        actions["creep"] = [(0, { move(CGPoint(x: p.x + 2, y: p.y + 2)) })]
        actions["start"] = [(0, { move(CGPoint(x: p.x + 12, y: p.y + 6)) })]
        actions["moves"] = [1.0, 2, 3].map { (k: Double) -> Step in (16.7 * (k - 1), { move(CGPoint(x: p.x + 12 + 28 * k / 3, y: p.y + 6 + 18 * k / 3)) }) }
        actions["clickHover"] = [(0, { hoverTo(p) })]
        actions["clickPress"] = [(0, { down(p) })]
        actions["clickRelease"] = [(0, { up(p) })]
        actions["drag"] = [(0, { move(CGPoint(x: p.x + 20, y: p.y + 10)) })]
        actions["pressBackground"] = [(0, { let q = CGPoint(x: nestedRect.maxX - 30, y: nestedRect.maxY - 12); hoverTo(q); down(q) })]
        actions["releaseBackground"] = [(0, { up(CGPoint(x: nestedRect.maxX - 30, y: nestedRect.maxY - 12)) })]
        actions["pressInner"] = [(0, { let q = innerCenter(); hoverTo(q); down(q) })]
        actions["releaseInner"] = [(0, { up(innerCenter()) })]
        actions["enterInner"] = [(0, { key(36, "\r") })]
        if scenario == "drag" || scenario == "custom" { actions["release"] = [(0, { up(CGPoint(x: p.x + 40, y: p.y + 24)) })] }
        if scenario == "dragClick" { actions["release"] = [(0, { up(CGPoint(x: p.x + 20, y: p.y + 10)) })] }
        // Before keyboard sequences the source focuses #before (scenario-specific placement in the phase list).
        let focusBefore: Set<String> = scenario == "keyboard" ? ["tab"] : scenario == "softDisabled" || scenario == "disabled" ? ["tab"] : scenario == "nested" ? ["tab"] : []
        var samples: [Sample] = [], stepTimes: [(Double, Double)] = [], snaps: [(Int, Shot, [String: AWCValue], CGRect?, String)] = []
        let t0 = now()
        for (i, phase) in phases.enumerated() {
            let lbl = phase["label"].string, start = phase["t"].number! - webT0
            if focusBefore.contains(lbl) { state.pointer.update(phase: .leave); _ = focusView("before")?.requestNativeFocus(); pump(0.03) }
            while now() - t0 < start { pump(0.004); samples.append(sample()) }
            let nativeStart = now(); stepTimes.append((phase["t"].number!, nativeStart))
            var queue = actions[lbl] ?? []
            let end = (i + 1 < phases.count ? phases[i + 1]["t"].number! - webT0 : start + 500) - 25
            while now() - t0 < end {
                while let first = queue.first, now() - nativeStart >= first.0 { first.1(); queue.removeFirst() }
                pump(0.004); samples.append(sample())
            }
            let s = sample()
            snaps.append((i, capture(CGRect(x: r["clip"]["x"].number!, y: r["clip"]["y"].number!, width: r["clip"]["width"].number!, height: r["clip"]["height"].number!)), s.card, s.frame, focusedID()))
        }
        let tail = now(); while now() - tail < 150 { pump(0.004); samples.append(sample()) }
        // Events: the card's mdClick / mdDrag* sequence and payloads (DOM click entries excluded).
        let web = r["events"].array.filter { $0["name"].string != "click" }
        check(state.events.map(\.0) == web.map { $0["name"].string }, "\(label) events \(state.events.map(\.0)) vs \(web.map { $0["name"].string })")
        for (e, w) in zip(state.events, web) {
            for (k, v) in w["detail"].object { if let n = v.number { check(abs((e.1[k].number ?? .nan) - n) < 0.01, "\(label) \(e.0).\(k) \(e.1[k]) vs \(n)") } else { check(e.1[k] == v, "\(label) \(e.0).\(k) \(e.1[k]) vs \(v)") } }
        }
        if scenario == "nested" { check(state.innerClicks >= 1, "\(label) inner control keeps its own activation") }
        // Phase end states: geometry incl. drag translate, focus, ring, z-index, paint.
        var pending: [(String, Shot, AWCValue)] = []
        for (i, shot, card, frame, focused) in snaps {
            let ph = phases[i], snap = ph["snap"], lbl = ph["label"].string
            if let f = frame { check(abs(f.minX - snap["rect"]["x"].number!) <= 0.6 && abs(f.minY - snap["rect"]["y"].number!) <= 0.6 && abs(f.width - snap["rect"]["width"].number!) <= 0.6, "\(label)/\(lbl) box \(f) vs \(snap["rect"])") }
            else { check(false, "\(label)/\(lbl) box measured") }
            let webFocus = snap["active"].string == "card" ? "card" : snap["active"].string == "after" ? "after" : snap["active"].string == "before" ? "before" : snap["active"].string == "inner" ? "inner" : "body"
            check(focused == webFocus || (webFocus == "body" && !["card"].contains(focused)), "\(label)/\(lbl) focus \(focused) vs \(snap["active"].string)")
            check((card["focusRing"]?.bool ?? false) == (snap["focusRing"]["style"].string == "solid"), "\(label)/\(lbl) focus ring \(card["focusRing"] ?? .null) vs \(snap["focusRing"]["style"].string)")
            check((card["zIndex"]?.number ?? 0) == (snap["zIndex"].string == "1000" ? 1000 : 0), "\(label)/\(lbl) z-index \(card["zIndex"] ?? .null) vs \(snap["zIndex"].string)")
            check(snap["attrs"]["role"] == .null ? card["role"]?.string == "" : card["role"]?.string == snap["attrs"]["role"].string, "\(label)/\(lbl) role")
            pending.append(("\(label)/\(lbl)", shot, ph["clip"] == .null ? r["clip"] : r["clip"]))
        }
        // Per-frame values at render time within Chrome's samples (±2 frames; monotone envelope across gaps > 2 frames).
        var webSamples = phases.flatMap { $0["samples"].array }
        // Before Chrome's first rAF sample, the first phase's transition records give the values:
        // each transition's "from" value at its start time (the pre-input state).
        if let first = webSamples.first {
            var seed = first.object, start = first["t"].number!
            for a in r["anims"].array where a["phase"].string == phases[0]["label"].string && a["startTime"] != .null {
                start = min(start, a["startTime"].number!)
                if a["target"].string == "state-layer" && a["property"].string == "opacity" { var l = first["layer"].object; l["opacity"] = .number(Double(a["from"]["opacity"].string) ?? 0); seed["layer"] = .object(l) }
                if a["target"].string == "host" && a["property"].string == "box-shadow" { seed["shadow"] = a["from"]["boxShadow"] }
                if a["target"].string == "host" && a["property"].string == "background-color" { seed["background"] = a["from"]["backgroundColor"] }
            }
            seed["t"] = .number(min(start, first["t"].number!)); seed["waves"] = .array([])
            webSamples.insert(.object(seed), at: 0)
        }
        func webTime(_ native: Double) -> Double { guard let step = stepTimes.last(where: { $0.1 <= native }) else { return webT0 + native - t0 }; return step.0 + native - step.1 }
        func envelope(_ read: (AWCValue) -> [Double]?, _ t: Double) -> ([Double], [Double])? {
            guard let after = webSamples.firstIndex(where: { $0["t"].number! >= t }) else { return read(webSamples.last!).map { ($0, $0) } }
            if after == 0 { return read(webSamples[0]).map { ($0, $0) } }
            let a = webSamples[after - 1], b = webSamples[after], ta = a["t"].number!, tb = b["t"].number!
            guard let va = read(a), let vb = read(b), va.count == vb.count else { return read(b).map { ($0, $0) } }
            if tb - ta > 34 { return (zip(va, vb).map { min($0, $1) }, zip(va, vb).map { max($0, $1) }) }
            let x = tb > ta ? (t - ta) / (tb - ta) : 1; let v = zip(va, vb).map { $0 + ($1 - $0) * x }; return (v, v)
        }
        let rippleRead: (AWCValue) -> [Double]? = { s in s["waves"].array.first.map { [$0["opacity"].number ?? 0] } ?? [0] }
        typealias Prop = (String, Double, (AWCValue) -> [Double]?, (Sample) -> (Double?, [Double]?))
        var props: [Prop] = []
        let webLayer: (AWCValue) -> [Double]? = { s in s["layer"] == .null || s["layer"]["display"].string == "none" ? nil : [s["layer"]["opacity"].number ?? 0] }
        let natLayer: (Sample) -> (Double?, [Double]?) = { s in (s.layerT, s.layer.map { [$0] }) }
        props.append(("state layer", 0.004, webLayer, natLayer))
        let webShadow: (AWCValue) -> [Double]? = { s in shadow(s["shadow"].string) }
        let natShadow: (Sample) -> (Double?, [Double]?) = { s in (s.cardT, s.cardT == nil ? nil : nativeShadow(s.card["shadow"])) }
        props.append(("shadow", 0.02, webShadow, natShadow))
        let webBackground: (AWCValue) -> [Double]? = { s in pre(color(s["background"].string)) }
        let natBackground: (Sample) -> (Double?, [Double]?) = { s in
            guard let c = s.card["background"]?.array.compactMap(\.number), c.count == 4 else { return (nil, nil) }
            return (s.cardT, pre(c))
        }
        props.append(("container", 0.008, webBackground, natBackground))
        let webTranslate: (AWCValue) -> [Double]? = { s in
            let m: [Double] = s["transform"].string == "none" ? [1, 0, 0, 1, 0, 0] : numbers(s["transform"].string)
            return [m[4], m[5]]
        }
        let natTranslate: (Sample) -> (Double?, [Double]?) = { s in (s.cardT, s.cardT == nil ? nil : [s.card["offsetX"]?.number ?? 0, s.card["offsetY"]?.number ?? 0]) }
        props.append(("translate", 0.01, webTranslate, natTranslate))
        let natRippleOpacity: (Sample) -> (Double?, [Double]?) = { s in (s.rippleT, [s.ripple?["opacity"]?.number ?? 0]) }
        props.append(("ripple opacity", 0.006, rippleRead, natRippleOpacity))
        let webScale: (AWCValue) -> [Double]? = { s in s["waves"].array.first.map { [numbers($0["transform"].string).first ?? 1] } }
        let natScale: (Sample) -> (Double?, [Double]?) = { s in
            guard let r = s.ripple, (r["opacity"]?.number ?? 0) > 0, let k = r["scale"]?.number else { return (nil, nil) }
            return (s.rippleT, [k])
        }
        props.append(("ripple scale", 0.02, webScale, natScale))
        if r["variant"].string == "outlined" { _ = 0 }
        var compared: [String: Int] = [:]
        for (prop, tol, readWeb, read) in props {
            for s in samples {
                let (time, value) = read(s); guard let v = value else { continue }
                let at = time ?? s.t
                var lo: [Double]? = nil, hi: [Double]? = nil, x = at - 34
                while x <= at + 40 { if let e = envelope(readWeb, webTime(x)), e.0.count == v.count { lo = zip(lo ?? e.0, e.0).map { min($0, $1) }; hi = zip(hi ?? e.1, e.1).map { max($0, $1) } }; x += 2 }
                guard let lo, let hi else { continue }
                check((0..<v.count).allSatisfy { v[$0] >= lo[$0] - tol && v[$0] <= hi[$0] + tol }, "\(label) \(prop) rendered \(v) at web \(webTime(at)) within Chrome [\(lo), \(hi)]")
                compared[prop, default: 0] += 1
            }
        }
        check((compared["shadow"] ?? 0) > 50, "\(label) per-frame samples compared \(compared)")
        // Ripple geometry: physical origin and radius to the farthest corner (diameter = 2·radius).
        if let w = phases.flatMap({ $0["samples"].array }).compactMap({ $0["waves"].array.first }).first, let n = samples.compactMap(\.ripple).first(where: { ($0["opacity"]?.number ?? 0) > 0 }) {
            let size = numbers(w["size"].string)[0], left = numbers(w["left"].string)[0], top = numbers(w["top"].string)[0]
            check(abs((n["diameter"]?.number ?? 0) - size) < 0.6 && abs((n["x"]?.number ?? 0) - (left + size / 2)) < 0.6 && abs((n["y"]?.number ?? 0) - (top + size / 2)) < 0.6,
                  "\(label) ripple origin/diameter (\(n["x"] ?? .null),\(n["y"] ?? .null)) \(n["diameter"] ?? .null) vs (\(left + size / 2),\(top + size / 2)) \(size)")
        }
        // Source timings for the transitions this run recorded.
        for a in r["anims"].array where a["target"].string != "wave" {
            let d = a["duration"].number!, expected = reduced ? 0.0 : a["target"].string == "state-layer" ? 50 : 100
            check(d == expected || (reduced && d > 0 && false) , "\(label) \(a["target"].string) \(a["property"].string) duration \(d) is the native timing \(expected)")
            check(a["easing"].string == "cubic-bezier(0.2, 0, 0, 1)", "\(label) easing \(a["easing"].string)")
        }
        // Phase paint.
        for (lbl, shot, clip) in pending {
            let phase = lbl.split(separator: "/").last.map(String.init) ?? ""
            guard let source = NSImage(contentsOf: shots.appendingPathComponent(name + "-" + phase + ".png"))?.cgImage(forProposedRect: nil, context: nil, hints: nil) else { check(false, "\(lbl) shot"); continue }
            let cx = Int(clip["x"].number!), cy = Int(clip["y"].number!), cw = Int(clip["width"].number!), ch = Int(clip["height"].number!)
            let web = grid(.init(cg: source, scale: 1, origin: .init(x: cx, y: cy)), x: cx, y: cy, w: cw, h: ch), nat = grid(shot, x: cx, y: cy, w: cw, h: ch)
            var n = 0, bad = 0, sum = 0.0, worst = 0.0, worstAt = ""
            for py in (cy + 1)..<(cy + ch - 1) { for px in (cx + 1)..<(cx + cw - 1) where web.flat(px, py, 6) && nat.flat(px, py, 6) {
                if scenario == "nested" && CGRect(x: 60 + 16, y: 60 + 16 + 28, width: 160, height: 40).contains(CGPoint(x: px, y: py)) { continue }
                var d = 0.0; let a = web.at(px, py), b = nat.at(px, py); for c in 0..<3 { d = max(d, abs(a[c] - b[c])) }
                n += 1; sum += d; if d > 6 { bad += 1 }; if d > worst { worst = d; worstAt = "(\(px),\(py)) web \(a.map { Int($0) }) native \(b.map { Int($0.rounded()) })" }
            } }
            check(n > 1000 && Double(bad) / Double(max(n, 1)) <= 0.005 && sum / Double(max(n, 1)) <= 1.0, "\(lbl) flat pixels match (mean \(sum / Double(max(n, 1))), >6: \(bad)/\(n), worst \(worst) at \(worstAt))")
            if let dir = captureDir { try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true); try? NSBitmapImageRep(cgImage: shot.cg).representation(using: .png, properties: [:])?.write(to: dir.appendingPathComponent(lbl.replacingOccurrences(of: "/", with: "-") + ".png")) }
            report.append(["case": lbl, "compared": n, "mean": sum / Double(max(n, 1)), "over6": bad, "worst": worst, "worstAt": worstAt])
        }
        report.append(["case": label, "samples": samples.count, "compared": compared])
        state.pointer.update(phase: .leave); pump(0.1)
    }
    static func main() {
        _ = NSApplication.shared; NSApp.setActivationPolicy(.accessory)
        host = NSHostingView(rootView: CardStatesFixture(state: state)); window = NSWindow(contentRect: .init(x: -20000, y: -20000, width: 1200, height: 900), styleMask: [.borderless], backing: .buffered, defer: false); window.isReleasedWhenClosed = false; window.colorSpace = .sRGB; window.contentView = host; window.orderFrontRegardless(); pump(0.2)
        let fixtures = URL(fileURLWithPath: #filePath).deletingLastPathComponent().appendingPathComponent("Fixtures")
        let only = ProcessInfo.processInfo.environment["AWC_CARD_STATES_ONLY"]
        for (file, reduced) in [("card-web-states", false), ("card-web-states-reduced", true)] {
            let oracle = try! JSONDecoder().decode(AWCValue.self, from: Data(contentsOf: fixtures.appendingPathComponent(file + ".json")))
            for r in oracle["runs"].array where only.map({ r["name"].string.contains($0) }) ?? true { run(r, shots: fixtures.appendingPathComponent(file), reduced: reduced) }
        }
        if let output = ProcessInfo.processInfo.environment["AWC_CARD_STATES_OUTPUT"] { try! JSONSerialization.data(withJSONObject: ["checks": checks, "failures": failures, "report": report], options: [.prettyPrinted, .sortedKeys]).write(to: URL(fileURLWithPath: output)) }
        print("Card native interaction states: \(checks - failures.count)/\(checks) checks passed")
        window.close(); if !failures.isEmpty { exit(1) }
    }
}
