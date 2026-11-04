import AppKit
import SwiftUI
import Observation
import QuartzCore
@testable import AWCUI

// md-radio interaction against Chrome trusted-input runs (radio/states.html): hover, press, release (select with the
// inner-circle spring), leave, keyboard focus, Space (150 ms press pulse; inert on a checked radio), ArrowDown/ArrowUp
// (focus moves to the sibling and checks it, the tested radio is unchecked silently, then re-checked), Enter (inert) and
// Tab past the group's single tab stop; dark, RTL, all hooks, density −4, soft/hard disabled, form reset,
// press-and-drag-off and reduced motion. Each rendered frame is compared at its render time with Chrome's per-frame
// samples; the group's checked states, roving tab stops, key-view loop and focus at each phase end; phase paint per
// screenshot. Then the keyboard group cases (radio/group.html: roving tab stop, arrows that wrap and skip unavailable
// members, Space, a single enabled member, unnamed radios) and the group `required` rule.
@Observable final class RadioStatesFixtureState {
    var radios: [AWCNode] = []
    var epoch = 0
    var dark = false
    var rtl = false
    var reduced = false
    var spacing = 24.0
    var after = true
    var appearance = AWCRadioAppearance()
    var measurements: [AWCNativeInspectionNode] = []
    var events: [(String, String, AWCValue)] = []
    var formMode = false
    var form = AWCFormState()
    let pointer = AWCNativePointerState()
}
struct RadioStatesFixture: View {
    let state: RadioStatesFixtureState
    var group: some View {
        // Only the tested radio (r0) carries the run's direction and hooks, as in the source page.
        ForEach(state.radios, id: \.id) { node in
            AWCNativeView(node: node, onEvent: { e in state.events.append((node.id, e.name, e.detail)) })
                .awcRadioAppearance(node.id == "r0" ? state.appearance : .init())
                .environment(\.layoutDirection, state.rtl && node.id == "r0" ? .rightToLeft : .leftToRight)
        }
    }
    var body: some View {
        let epoch = state.epoch, theme = AWCTheme.generated(dark: state.dark)
        AWCNativeScope {
            // Inside the source's form the probes and radios are inline (no flex gap).
            HStack(spacing: state.spacing) {
                Color.clear.frame(width: 60, height: 32)
                if state.formMode { AWCFormScope(form: state.form) { HStack(spacing: 0) { group } } } else { group }
                if state.after { Color.clear.frame(width: 60, height: 32) }
            }
        }
        .awcSelectionReducedMotion(state.reduced)
        .awcTheme(theme)
        .awcNativeInspection(rootID: "r0|r1|r2|r3", coordinateSpace: "awc-native-preview") { if state.epoch == epoch { state.measurements = $0 } }
        .environment(\.awcNativePointerState, state.pointer)
        .id(epoch)
        .padding(.leading, 40).padding(.top, 40)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(theme.background).coordinateSpace(name: "awc-native-preview")
    }
}
struct RadioStatesGrid {
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
@main @MainActor enum NativeRadioStatesIntegration {
    static let state = RadioStatesFixtureState()
    static var host: NSHostingView<RadioStatesFixture>!, window: NSWindow!
    static var checks = 0, failures: [String] = [], report: [[String: Any]] = []
    static func check(_ value: Bool, _ name: String) { checks += 1; if !value { failures.append(name); print("FAIL: " + name); fflush(stdout) } }
    static func pump(_ duration: Double = 0.1) { let end = Date().addingTimeInterval(duration); repeat { while let e = NSApp.nextEvent(matching: .any, until: .distantPast, inMode: .default, dequeue: true) { NSApp.sendEvent(e) }; host.layoutSubtreeIfNeeded(); host.displayIfNeeded(); _ = RunLoop.current.run(mode: .default, before: Date().addingTimeInterval(0.002)) } while Date() < end }
    static func now() -> Double { CACurrentMediaTime() * 1000 }
    static func all(_ v: NSView) -> [NSView] { [v] + v.subviews.flatMap(all) }
    static func focusView(_ id: String) -> AWCNativeButtonFocusView? { all(host).compactMap { $0 as? AWCNativeButtonFocusView }.first { $0.accessibilityIdentifier() == id } }
    static func mouse(_ kind: NSEvent.EventType, _ p: CGPoint) { let point = host.convert(.init(x: p.x, y: host.isFlipped ? p.y : host.bounds.height - p.y), to: nil); let e = NSEvent.mouseEvent(with: kind, location: point, modifierFlags: [], timestamp: ProcessInfo.processInfo.systemUptime, windowNumber: window.windowNumber, context: nil, eventNumber: 1, clickCount: 1, pressure: kind == .leftMouseUp ? 0 : 1)!; window.sendEvent(e) }
    static func key(_ code: UInt16, _ text: String) { let e = NSEvent.keyEvent(with: .keyDown, location: .zero, modifierFlags: [], timestamp: ProcessInfo.processInfo.systemUptime, windowNumber: window.windowNumber, context: nil, characters: text, charactersIgnoringModifiers: text, isARepeat: false, keyCode: code)!; window.sendEvent(e) }
    static let arrows: [String: (UInt16, String)] = ["ArrowDown": (125, "\u{F701}"), "ArrowUp": (126, "\u{F700}"), "ArrowRight": (124, "\u{F703}"), "ArrowLeft": (123, "\u{F702}")]
    static var ids: [String] { state.radios.map(\.id) }
    static func metrics(_ id: String) -> [String: AWCValue]? { state.measurements.first { $0.name == "md-radio" && $0.id.hasPrefix(id + ":") }?.metrics }
    /// Sequential focus navigation (Tab): the next radio after the focused one whose focus view is in the key-view loop
    /// (`canBecomeKeyView` follows the roving tabindex); past the last one focus leaves the group (the "after" probe).
    static func sequential(_ v: AWCNativeButtonFocusView?) -> Bool {
        #if canImport(AppKit)
        return v?.canBecomeKeyView ?? false
        #else
        return v?.configuration?.sequential ?? false   // UIKit: the same policy decides canBecomeFocused for sequential focus
        #endif
    }
    static func tabNext() {
        let views = ids.map(focusView)
        let current = ids.firstIndex { metrics($0)?["focused"]?.bool == true } ?? -1
        if let next = views.indices.first(where: { $0 > current && sequential(views[$0]) }), let v = views[next] { _ = v.requestNativeFocus() } else { _ = window.makeFirstResponder(nil) }
    }
    static func press(_ k: String) { if k == "Tab" { tabNext() } else if k == " " { key(49, " ") } else if k == "Enter" { key(36, "\r") } else if let a = arrows[k] { key(a.0, a.1) } }
    struct Group: Equatable { var checked: [Bool], tabindex: [String], active: String, keyViews: [Bool], missing: [Bool] }
    static func group() -> Group {
        let checked: [Bool] = ids.map { metrics($0)?["checked"]?.bool ?? false }
        let tabindex: [String] = ids.map { id in metrics(id)?["tabindex"]?.number.map { String(Int($0)) } ?? "?" }
        let active: String = ids.first { metrics($0)?["focused"]?.bool == true } ?? "none"
        let keyViews: [Bool] = ids.map { sequential(focusView($0)) }
        let missing: [Bool] = ids.map { metrics($0)?["valueMissing"]?.bool ?? false }
        return Group(checked: checked, tabindex: tabindex, active: active, keyViews: keyViews, missing: missing)
    }
    /// The group against a web state ({checked, tabindex, active}): the key-view loop holds exactly the tabindex-0 members.
    static func compare(_ name: String, _ g: Group, checked wc: [Bool], tabindex wt: [String], active wa: String) {
        check(g.checked == wc, "\(name) checked \(g.checked) vs \(wc)")
        check(g.tabindex == wt, "\(name) tabindex \(g.tabindex) vs \(wt)")
        check(g.keyViews == wt.map { $0 == "0" }, "\(name) key-view loop \(g.keyViews) vs tabindex \(wt)")
        let want = ids.contains(wa) ? wa : "none"
        check(g.active == want, "\(name) focus \(g.active) vs \(wa)")
    }
    struct Shot { let cg: CGImage; let scale: Double; let origin: CGPoint }
    static func capture(_ r: CGRect) -> Shot { let rr = host.isFlipped ? r : CGRect(x: r.minX, y: host.bounds.height - r.maxY, width: r.width, height: r.height); let b = host.bitmapImageRepForCachingDisplay(in: rr)!; host.cacheDisplay(in: rr, to: b); return .init(cg: b.cgImage!, scale: Double(b.pixelsWide) / r.width, origin: r.origin) }
    static func grid(_ s: Shot, x: Int, y: Int, w: Int, h: Int) -> RadioStatesGrid {
        let k = max(1, Int(s.scale.rounded())), crop = CGRect(x: (Double(x) - s.origin.x) * Double(k), y: (Double(y) - s.origin.y) * Double(k), width: Double(w * k), height: Double(h * k))
        var values = [Double](repeating: -999, count: w * h * 3)
        guard let cg = s.cg.cropping(to: crop), cg.width == w * k, cg.height == h * k else { return .init(x: x, y: y, w: w, h: h, values: values) }
        var buffer = [UInt8](repeating: 0, count: cg.width * cg.height * 4)
        buffer.withUnsafeMutableBytes { raw in let ctx = CGContext(data: raw.baseAddress, width: cg.width, height: cg.height, bitsPerComponent: 8, bytesPerRow: cg.width * 4, space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!; ctx.draw(cg, in: .init(x: 0, y: 0, width: cg.width, height: cg.height)) }
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
    static func premul(_ c: [Double]) -> [Double] { c.count < 4 ? c : [c[0] * c[3], c[1] * c[3], c[2] * c[3], c[3]] }
    static func px(_ s: String) -> Double { Double(s.replacingOccurrences(of: "px", with: "")) ?? 0 }
    static func hooks(_ v: AWCValue) -> AWCRadioAppearance {
        guard case .object(let o) = v else { return .init() }
        func n(_ k: String) -> Double? { o[k].map { px($0.string) } }; func c(_ k: String) -> String? { o[k]?.string }
        return .init(iconColor: c("icon-color"), selectedIconColor: c("selected-icon-color"), iconSize: n("icon-size"), innerCircleSize: n("inner-circle-size"),
                     stateLayerSize: n("state-layer-size"), stateLayerColor: c("state-layer-color"), selectedStateLayerColor: c("selected-state-layer-color"))
    }
    struct Sample { let t: Double; let renderT: Double?; let scale: Double?; let outer: [Double]?; let inner: Double?; let layer: Double?; let layerColor: [Double]? }
    static func sample() -> Sample {
        let m = metrics("r0")
        func rgba(_ k: String) -> [Double]? { m?[k]?.array.compactMap(\.number) }
        let layer = m?["layerOpacity"]?.number
        return .init(t: now(), renderT: m?["renderTime"]?.number, scale: m?["scale"]?.number, outer: rgba("outerColor"), inner: m?["innerScale"]?.number, layer: layer,
                     layerColor: layer.flatMap { $0 < 0 ? nil : rgba("layerColor") })
    }
    static func run(_ c: AWCValue, shots: URL, reduced: Bool) {
        let name = (reduced ? "reduced/" : "") + c["name"].string, cfg = c["config"]
        state.formMode = cfg["form"] == .bool(true); state.form = AWCFormState(); state.spacing = state.formMode ? 0 : 24; state.after = true
        state.dark = cfg["theme"].string == "dark"; state.rtl = cfg["dir"].string == "rtl"; state.reduced = reduced
        state.appearance = cfg["hooks"] == .null ? .init() : hooks(cfg["hooks"])
        var p: [String: AWCValue] = ["checked": .bool(cfg["checked"] == .bool(true)), "name": "g", "value": "a"]
        if let d = cfg["density"].number, d != 0 { p["density"] = .number(d) }
        if cfg["state"].string == "disabled" { p["disabled"] = true }; if cfg["state"].string == "softDisabled" { p["softDisabled"] = true }
        state.pointer.update(phase: .leave); _ = window.makeFirstResponder(nil)
        state.radios = [.init(id: "r0", tag: "md-radio", properties: p), .init(id: "r1", tag: "md-radio", properties: ["name": "g", "value": "b"]),
                        .init(id: "r2", tag: "md-radio", properties: ["name": "g", "value": "c"])]
        state.measurements = []; state.epoch += 1; pump(0.5); state.events = []
        let phases = c["phases"].array, hp = CGPoint(x: c["handlePoint"].array[0].number!, y: c["handlePoint"].array[1].number!), off = CGPoint(x: hp.x, y: hp.y + 60)
        let hostX = phases[0]["snap"]["rect"]["x"].number!
        if let m = state.measurements.first(where: { $0.name == "md-radio" && $0.id.hasPrefix("r0:") }) { check(abs(m.bounds.minX - hostX) < 0.6 && abs(m.bounds.minY - phases[0]["snap"]["rect"]["y"].number!) < 0.6, "\(name) host at the source position \(m.bounds)") }
        else { check(false, "\(name) measured") }
        var steps: [(String, Double, () -> Void)] = []
        let events = c["events"].array
        // Chrome renders an input's style change in the first frame at or after it; a transition the input started gives
        // that frame directly, otherwise the first sampled frame at or after the trusted event (or the phase start).
        let frameTimes = phases.flatMap { $0["samples"].array.compactMap { $0["t"].number } }
        let animStarts = c["anims"].array.compactMap { $0["startTime"].number }
        func frameAfter(_ t: Double) -> Double { animStarts.filter { $0 >= t - 17 && $0 <= t + 34 }.min() ?? frameTimes.first { $0 >= t && $0 <= t + 34 } ?? t }
        func at(_ ph: AWCValue, _ kinds: [String], _ fallback: Double) -> Double {
            let t = ph["t"].number!
            return frameAfter(events.first { kinds.contains($0["name"].string) && $0["t"].number! >= t && $0["t"].number! <= t + 150 }?["t"].number ?? t + fallback)
        }
        for ph in phases {
            let t = ph["t"].number!
            switch ph["label"].string {
            case "hover": steps.append(("hover", frameAfter(t + 5), { state.pointer.update(phase: .move, location: hp) }))
            case "press": steps.append(("press", at(ph, ["focus"], 10), { state.pointer.update(phase: .down, location: hp); mouse(.leftMouseDown, hp) }))
            case "release": steps.append(("release", at(ph, ["mdChange"], 10), { mouse(.leftMouseUp, hp); state.pointer.update(phase: .up, location: hp) }))
            case "leave": steps.append(("leave", frameAfter(t + 5), { state.pointer.update(phase: .leave) }))
            case "pressOff": steps.append(("pressOff", at(ph, ["focus"], 10), { state.pointer.update(phase: .down, location: hp); mouse(.leftMouseDown, hp) }))
                steps.append(("pressOffMove", at(ph, ["pointerleave"], 75), { state.pointer.update(phase: .move, location: off); mouse(.leftMouseDragged, off) }))
            case "releaseOff": steps.append(("releaseOff", frameAfter(t + 10), { mouse(.leftMouseUp, off); state.pointer.update(phase: .up, location: off) }))
            // The source focuses "before", then presses Tab: focus lands on the group's tab stop.
            case "tab": steps.append(("tab", t, { _ = window.makeFirstResponder(nil) })); steps.append(("tabFocus", at(ph, ["focus"], 30), { tabNext() }))
            case "space": steps.append(("space", at(ph, ["mdChange"], 5), { key(49, " ") }))
            case "arrowDown": steps.append(("arrowDown", at(ph, ["blur", "mdChange"], 5), { press("ArrowDown") }))
            case "arrowUp": steps.append(("arrowUp", at(ph, ["focus", "mdChange"], 5), { press("ArrowUp") }))
            case "enter": steps.append(("enter", frameAfter(t + 5), { key(36, "\r") }))
            case "reset": steps.append(("reset", frameAfter(t + 2), { _ = state.form.reset() }))
            case "tabAway": steps.append(("tabAway", at(ph, ["blur"], 5), { tabNext() }))
            default: steps.append((ph["label"].string, t, {}))
            }
        }
        var samples: [Sample] = [], stepTimes: [String: Double] = [:], pending: [(String, AWCValue, Shot, Group)] = []
        let webT0 = steps[0].1, t0 = now(), end = steps.last!.1 - webT0 + 470
        var next = 0
        while now() - t0 < end {
            while next < steps.count && now() - t0 >= steps[next].1 - webT0 {
                if next > 0 && !["tabFocus", "pressOffMove"].contains(steps[next].0), let i = phases.firstIndex(where: { $0["label"].string == steps[next].0 }), i > 0 {
                    let ph = phases[i - 1]; pending.append((ph["label"].string, ph, capture(clipRect(ph["clip"])), group())) }
                stepTimes[steps[next].0] = now(); steps[next].2(); next += 1
            }
            let due = next < steps.count ? steps[next].1 - webT0 - (now() - t0) : 4
            if due >= 4 { pump(0.004) } else if due > 0 { let until = now() + due; while now() < until {} }
            samples.append(sample())
        }
        let lastPh = phases.last!; pending.append((lastPh["label"].string, lastPh, capture(clipRect(lastPh["clip"])), group()))
        // Events: every mdChange (target and detail), and the tested radio's focus/blur sequence within the run.
        let horizon = lastPh["t"].number! + 470
        let webChanges = events.filter { $0["name"].string == "mdChange" }, changes = state.events.filter { $0.1 == "mdChange" }
        check(changes.map(\.0) == webChanges.map { $0["target"].string }, "\(name) mdChange targets \(changes.map(\.0)) vs \(webChanges.map { $0["target"].string })")
        for (e, w) in zip(changes, webChanges) { check(e.2["checked"] == w["detail"]["checked"] && e.2["value"] == w["detail"]["value"], "\(name) \(e.0) mdChange detail \(e.2) vs \(w["detail"])") }
        let webFocus = events.filter { ["focus", "blur"].contains($0["name"].string) && $0["t"].number! <= horizon }.map { $0["name"].string }
        let focus = state.events.filter { $0.0 == "r0" && ["mdFocus", "mdBlur"].contains($0.1) }.map { $0.1 == "mdFocus" ? "focus" : "blur" }
        check(focus == webFocus, "\(name) r0 focus/blur \(focus) vs \(webFocus)")
        // Per-frame values against Chrome's samples.
        var web = phases.flatMap { $0["samples"].array }
        if c["rest"] != .null { var rest = c["rest"]; if case .object(var o) = rest { o["t"] = .number(webT0 - 5); rest = .object(o) }; web.insert(rest, at: 0) }
        let webSteps = steps.map { ($0.0, $0.1) }
        func webTime(_ native: Double) -> Double {
            let done = webSteps.filter { stepTimes[$0.0].map { $0 <= native } ?? false }
            guard let step = done.last, let n = stepTimes[step.0] else { return webT0 + (native - t0) }
            return step.1 + (native - n)
        }
        func webValue(_ read: (AWCValue) -> [Double], _ t: Double) -> (lo: [Double], hi: [Double]) {
            guard let after = web.firstIndex(where: { $0["t"].number! >= t }) else { let v = read(web.last!); return (v, v) }
            if after == 0 { let v = read(web[0]); return (v, v) }
            let a = web[after - 1], b = web[after], ta = a["t"].number!, tb = b["t"].number!, va = read(a), vb = read(b)
            if tb - ta > 34 { return (zip(va, vb).map { min($0, $1) }, zip(va, vb).map { max($0, $1) }) }
            let x = tb > ta ? (t - ta) / (tb - ta) : 1; let v = zip(va, vb).map { $0 + ($1 - $0) * x }; return (v, v)
        }
        var props: [(String, Double, (AWCValue) -> [Double], (Sample) -> [Double]?)] = [
            ("container scale", 0.004, { [$0["scale"].number!] }, { s in s.scale.map { [$0] } }),
            ("outer colour", 0.012, { premul(css($0["outerBorder"].string)) }, { s in s.outer.map(premul) }),
            ("inner scale", 0.01, { [$0["innerScale"].number!] }, { s in s.inner.map { [$0] } }),
            ("state layer", 0.004, { $0["layerDisplay"].string == "none" ? [-1] : [$0["layerOpacity"].number!] }, { s in s.layer.map { [$0] } }),
        ]
        if cfg["state"].string == "rest" { props.append(("state layer colour", 0.012, { premul(css($0["layerBg"].string)) }, { s in s.layerColor.map(premul) })) }
        var compared: [String: Int] = [:]
        for (prop, tol, readWeb, read) in props {
            var seen = Set<Double>()
            for s in samples {
                guard let v = read(s), !v.isEmpty else { continue }
                let at = s.renderT ?? s.t
                if let r = s.renderT { if seen.contains(r) { continue }; seen.insert(r) }
                var lo = Array(repeating: Double.infinity, count: v.count), hi = Array(repeating: -Double.infinity, count: v.count), x = at - 34
                while x <= at + 40 { let e = webValue(readWeb, webTime(x)); for i in 0..<min(v.count, e.lo.count) { lo[i] = min(lo[i], e.lo[i]); hi[i] = max(hi[i], e.hi[i]) }; x += 2 }
                let w0 = webTime(at - 34), w1 = webTime(at + 40)
                for smp in web where smp["t"].number! >= w0 && smp["t"].number! <= w1 { let e = readWeb(smp); for i in 0..<min(v.count, e.count) { lo[i] = min(lo[i], e[i]); hi[i] = max(hi[i], e[i]) } }
                check((0..<min(v.count, lo.count)).allSatisfy { v[$0] >= lo[$0] - tol && v[$0] <= hi[$0] + tol }, "\(name) \(prop) rendered \(v) at web \(Int(webTime(at))) within Chrome [\(lo),\(hi)]"); compared[prop, default: 0] += 1
            }
            if let final = samples.last.flatMap(read) { let want = readWeb(web.last!); check(zip(final, want).allSatisfy { abs($0 - $1) <= max(tol, 0.012) }, "\(name) \(prop) settles \(final) vs \(want)") }
            let varies = Set(web.map { readWeb($0).map { ($0 * 1000).rounded() } }).count > 1
            check((compared[prop] ?? 0) > (varies ? 8 : 0), "\(name) \(prop) samples compared (\(compared[prop] ?? 0))")
        }
        // Group state at each phase end: checked members, roving tab stops (and the key-view loop) and focus.
        for (label, ph, _, g) in pending {
            let w = ph["samples"].array.last!, wg = w["group"].array
            compare("\(name)/\(label) group", g, checked: wg.map { $0["checked"] == .bool(true) }, tabindex: wg.map { $0["tabindex"].string }, active: w["active"].string)
        }
        // Phase paint: every flat pixel of each source phase screenshot (the source's probe buttons excluded).
        let b = c["before"], probe = CGRect(x: b["x"].number!, y: b["y"].number!, width: b["width"].number!, height: b["height"].number!)
        for (label, ph, shot, _) in pending {
            let clip = ph["clip"], cx = Int(clip["x"].number!), cy = Int(clip["y"].number!), cw = Int(clip["width"].number!), ch = Int(clip["height"].number!)
            guard let src = NSImage(contentsOf: shots.appendingPathComponent(c["name"].string + "-" + label + ".png"))?.cgImage(forProposedRect: nil, context: nil, hints: nil) else { check(false, "\(name)/\(label) source"); continue }
            let webG = grid(.init(cg: src, scale: 1, origin: .init(x: cx, y: cy)), x: cx, y: cy, w: cw, h: ch), nat = grid(shot, x: cx, y: cy, w: cw, h: ch)
            var n = 0, bad = 0, sum = 0.0, worst = 0.0, worstAt = ""
            for py in (cy + 1)..<(cy + ch - 1) { for pxx in (cx + 1)..<(cx + cw - 1) where webG.flat(pxx, py, 6) && nat.flat(pxx, py, 6) && !probe.insetBy(dx: -2, dy: -2).contains(CGPoint(x: Double(pxx) + 0.5, y: Double(py) + 0.5)) {
                let d = diff(webG.at(pxx, py), nat.at(pxx, py)); n += 1; sum += d; if d > 6 { bad += 1 }
                if d > worst { worst = d; worstAt = "(\(pxx),\(py)) web \(webG.at(pxx, py).map { Int($0) }) native \(nat.at(pxx, py).map { Int($0.rounded()) })" } } }
            check(Double(bad) / Double(max(n, 1)) <= 0.005 && sum / Double(max(n, 1)) <= 1.0, "\(name)/\(label) flat pixels match (mean \(sum / Double(max(n, 1))), >6: \(bad)/\(n), worst \(worst) at \(worstAt))")
            if let dir = ProcessInfo.processInfo.environment["AWC_RADIO_CAPTURE_DIRECTORY"] { try? FileManager.default.createDirectory(atPath: dir, withIntermediateDirectories: true); try? NSBitmapImageRep(cgImage: shot.cg).representation(using: .png, properties: [:])?.write(to: URL(fileURLWithPath: dir).appendingPathComponent(name.replacingOccurrences(of: "/", with: "-") + "-" + label + ".png")) }
        }
        report.append(["case": name, "samples": samples.count, "compared": compared])
        state.pointer.update(phase: .leave); _ = window.makeFirstResponder(nil); pump(0.1)
    }
    static func clipRect(_ c: AWCValue) -> CGRect { .init(x: c["x"].number!, y: c["y"].number!, width: c["width"].number!, height: c["height"].number!) }
    static func load(_ radios: [[String]], name: String, required: Int? = nil) {
        state.formMode = false; state.spacing = 16; state.after = false; state.dark = false; state.rtl = false; state.reduced = true; state.appearance = .init()
        state.radios = radios.enumerated().map { i, flags in
            var p: [String: AWCValue] = ["name": .string(name), "value": .string("v\(i)")]
            if flags.contains("checked") { p["checked"] = true }; if flags.contains("disabled") { p["disabled"] = true }; if flags.contains("soft") { p["softDisabled"] = true }
            if required == i { p["required"] = true }
            return AWCNode(id: "r\(i)", tag: "md-radio", properties: p)
        }
        state.pointer.update(phase: .leave); _ = window.makeFirstResponder(nil); state.measurements = []; state.epoch += 1; pump(0.4); state.events = []
    }
    /// radio/group.html: trusted keys from the "before" button; per key the group state and the md events in order.
    static func runGroup(_ c: AWCValue) {
        let name = "group/" + c["name"].string
        load(c["radios"].array.map { $0.array.map(\.string) }, name: c["name"].string == "unnamed" ? "" : "g")
        let steps = c["steps"].array
        func compareStep(_ label: String, _ w: AWCValue) {
            compare("\(name) \(label)", group(), checked: w["checked"].array.map { $0 == .bool(true) }, tabindex: w["tabindex"].array.map(\.string), active: w["active"].string)
        }
        compareStep("initial", steps[0])
        for (i, k) in c["keys"].array.map(\.string).enumerated() {
            state.events = []; press(k); pump(0.15)
            let w = steps[i + 1]; compareStep("\(i):\(k)", w)
            func line(_ target: String, _ ev: String, _ value: String) -> String { ev == "mdChange" ? "\(target) \(ev) \(value)" : "\(target) \(ev)" }
            let want = w["events"].array.map { line($0["target"].string, $0["name"].string, $0["detail"]["value"].string) }
            let got = state.events.filter { ["mdChange", "mdFocus", "mdBlur"].contains($0.1) }.map { line($0.0, $0.1, $0.2["value"].string) }
            check(got == want, "\(name) \(i):\(k) events \(got) vs \(want)")
        }
        report.append(["case": name, "keys": c["keys"].array.count])
    }
    /// The source's group validity (no oracle page): `required` on any member makes the whole group required, and every
    /// member reports valueMissing until one is checked.
    static func runRequired() {
        load([[], [], []], name: "g", required: 2)
        check(group().missing == [true, true, true], "required group: all members missing \(group().missing)")
        press("Tab"); pump(0.1); press("ArrowDown"); pump(0.15)
        let g = group()
        check(g.checked == [false, true, false] && g.missing == [false, false, false], "required group satisfied by an arrow selection \(g.checked) \(g.missing)")
        load([[], [], []], name: "g")
        check(group().missing == [false, false, false], "optional group: nothing missing \(group().missing)")
        report.append(["case": "group/required"])
    }
    static func main() {
        _ = NSApplication.shared; NSApp.setActivationPolicy(.accessory)
        host = NSHostingView(rootView: RadioStatesFixture(state: state)); window = NSWindow(contentRect: .init(x: -20000, y: -20000, width: 600, height: 400), styleMask: [.borderless], backing: .buffered, defer: false)
        window.isReleasedWhenClosed = false; window.colorSpace = .sRGB; window.contentView = host; window.orderFrontRegardless(); pump(0.2)
        let fixtures = URL(fileURLWithPath: #filePath).deletingLastPathComponent().appendingPathComponent("Fixtures")
        let only = ProcessInfo.processInfo.environment["AWC_RADIO_ONLY"]
        for (file, reduced) in [("radio-web-states", false), ("radio-web-states-reduced", true)] {
            let oracle = try! JSONDecoder().decode(AWCValue.self, from: Data(contentsOf: fixtures.appendingPathComponent(file + ".json")))
            for c in oracle["runs"].array where only.map({ c["name"].string.contains($0) }) ?? true { run(c, shots: fixtures.appendingPathComponent(file), reduced: reduced) }
        }
        let groups = try! JSONDecoder().decode(AWCValue.self, from: Data(contentsOf: fixtures.appendingPathComponent("radio-web-group.json")))
        for c in groups["cases"].array where only.map({ c["name"].string.contains($0) }) ?? true { runGroup(c) }
        if only == nil { runRequired() }
        if let output = ProcessInfo.processInfo.environment["AWC_RADIO_STATES_OUTPUT"] { try! JSONSerialization.data(withJSONObject: ["checks": checks, "failures": failures, "report": report], options: [.prettyPrinted, .sortedKeys]).write(to: URL(fileURLWithPath: output)) }
        print("Radio native states: \(checks - failures.count)/\(checks) checks passed")
        window.close(); if !failures.isEmpty { exit(1) }
    }
}
