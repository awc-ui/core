import Foundation
@testable import AWCUI

// md-slider and md-rating interaction parity: the Web state runs (states.json / states-reduced.json) replayed
// through AWCSliderInteraction / AWCRatingInteraction — events (name + detail), the value props, the native
// inputs (value, aria-valuenow, focus), the CSS position variables, value-indicator text, stops, the rating's
// ARIA, item fill and label; lifecycle.json (runtime property changes through the Stencil watchers, form reset,
// focusRating(), touch) when present. The interaction is driven through sync(props) as the views drive it. Lockstep with
// the Android harnesses (androidTest dev.awc.playground.sr).
// Usage: NativeSliderRatingIntegration [<md-slider oracle dir> <md-rating oracle dir>]  (default: Tests/Fixtures/{slider,rating}-web-oracle;
// AWC_TOKENS_CSS: the token sheet, default packages/tokens/src/tokens.css)
let awcSRTestsDir = URL(fileURLWithPath: #filePath).deletingLastPathComponent()

@main enum NativeSliderRatingIntegration {
    static func main() {
        let given = Array(CommandLine.arguments.dropFirst())
        let args = given.isEmpty ? ["slider", "rating"].map { awcSRTestsDir.appendingPathComponent("Fixtures/\($0)-web-oracle").path } : given
        var total = 0, passed = 0
        for (i, dir) in args.enumerated() {
            if i == 0, !((try? Data(contentsOf: URL(fileURLWithPath: dir).appendingPathComponent("paint.json"))).flatMap { try? JSONSerialization.jsonObject(with: $0) as? [String: Any] }?["cases"] is [[String: Any]]) {
                print("missing \(dir)/paint.json"); total += 1
            }
            if i == 0, let data = try? Data(contentsOf: URL(fileURLWithPath: dir).appendingPathComponent("paint.json")),
               let root = try? JSONSerialization.jsonObject(with: data) as? [String: Any], let cases = root["cases"] as? [[String: Any]] {
                var ok = 0
                for c in cases {
                    let diffs = SliderPaintCase(c).run()
                    total += 1
                    if diffs.isEmpty { ok += 1; passed += 1 } else { print("FAIL \(c["name"] ?? "?") (paint.json)"); diffs.prefix(10).forEach { print("   " + $0) } }
                }
                print("md-slider paint.json: \(ok)/\(cases.count)")
            }
            if i == 1, !((try? Data(contentsOf: URL(fileURLWithPath: dir).appendingPathComponent("paint.json"))).flatMap { try? JSONSerialization.jsonObject(with: $0) as? [String: Any] }?["cases"] is [[String: Any]]) {
                print("missing \(dir)/paint.json"); total += 1
            }
            if i == 1, let data = try? Data(contentsOf: URL(fileURLWithPath: dir).appendingPathComponent("paint.json")),
               let root = try? JSONSerialization.jsonObject(with: data) as? [String: Any], let cases = root["cases"] as? [[String: Any]] {
                var ok = 0
                for c in cases {
                    let diffs = RatingPaintCase(c).run()
                    total += 1
                    if diffs.isEmpty { ok += 1; passed += 1 } else { print("FAIL \(c["name"] ?? "?") (paint.json)"); diffs.prefix(10).forEach { print("   " + $0) } }
                }
                print("md-rating paint.json: \(ok)/\(cases.count)")
            }
            for file in ["states.json", "states-reduced.json", "lifecycle.json"] {
                guard let data = try? Data(contentsOf: URL(fileURLWithPath: dir).appendingPathComponent(file)),
                      let root = try? JSONSerialization.jsonObject(with: data) as? [String: Any], let runs = root["runs"] as? [[String: Any]] else { print("missing \(dir)/\(file)"); total += 1; continue }
                var ok = 0
                for (k, c) in runs.enumerated() {
                    let diffs = i == 0 ? SliderReplay(c, last: k == runs.count - 1, reduced: file.contains("reduced")).run() : RatingReplay(c, reduced: file.contains("reduced")).run()
                    total += 1
                    if diffs.isEmpty { ok += 1; passed += 1 } else { print("FAIL \(c["name"] ?? "?") (\(file))"); diffs.prefix(12).forEach { print("   " + $0) } }
                }
                print("\(i == 0 ? "md-slider" : "md-rating") \(file): \(ok)/\(runs.count)")
            }
        }
        print("NativeSliderRatingIntegration: \(passed)/\(total) runs identical")
        exit(passed == total ? 0 : 1)
    }
}

private func attr(_ tag: String, _ html: String, _ name: String) -> String? {
    guard let open = html.range(of: "<" + tag), let close = html[open.upperBound...].firstIndex(of: ">") else { return nil }
    let attrs = " " + String(html[open.upperBound..<close]) + " "
    let re = try! NSRegularExpression(pattern: "\\s\(name)(?:=\"([^\"]*)\")?(?=[\\s>])")
    guard let m = re.firstMatch(in: attrs, range: NSRange(attrs.startIndex..., in: attrs)) else { return nil }
    return m.range(at: 1).location == NSNotFound ? "" : String(attrs[Range(m.range(at: 1), in: attrs)!])
}

private func norm(_ v: Any?) -> String {
    switch v {
    case nil, is NSNull: return "null"
    case let n as NSNumber where CFGetTypeID(n) == CFBooleanGetTypeID(): return n.boolValue ? "true" : "false"
    case let n as NSNumber: return awcSRJSNumberString(n.doubleValue)
    case let d as Double: return awcSRJSNumberString(d)
    case let i as Int: return awcSRJSNumberString(Double(i))
    case let s as String: return "\"\(s)\""
    case let o as [String: Any]: return "{" + o.keys.sorted().map { "\($0):\(norm(o[$0]))" }.joined(separator: ",") + "}"
    default: return String(describing: v!)
    }
}

final class SliderReplay {
    let c: [String: Any], name: String, phases: [[String: Any]], rtl: Bool, last: Bool
    let s = AWCSliderInteraction()
    var events: [(Int, AWCSliderEvent)] = []
    var phaseIdx = 0, w = 480.0, ox = 24.0
    var diffs: [String] = []
    var fractions: [Double] = []
    let motion: AWCSliderMotion
    let theme: AWCSliderTheme
    let hooks: AWCSliderHooks
    let fullHeight: Bool
    let anims: [[String: Any]]
    var deferredKeyUp: (() -> Void)? = nil
    /// The host's properties (the node state the view syncs from); the component's own writes land here too.
    var props = AWCSliderProps()
    var initial = AWCSliderProps()

    init(_ c: [String: Any], last: Bool, reduced: Bool = false) {
        motion = AWCSliderMotion(reducedMotion: reduced)
        theme = WebTokens.theme(dark: (c["theme"] as? String) == "dark", density: 0)
        hooks = sliderHooks(attr("md-slider", c["html"] as? String ?? "", "style") ?? "")
        fullHeight = (c["html"] as? String ?? "").contains("full-height")
        anims = c["anims"] as? [[String: Any]] ?? []
        self.c = c; self.last = last; name = c["name"] as? String ?? ""; phases = c["phases"] as? [[String: Any]] ?? []; rtl = (c["dir"] as? String) == "rtl"
        let html = c["html"] as? String ?? ""
        func a(_ n: String) -> String? { attr("md-slider", html, n) }
        func num(_ n: String, _ d: Double) -> Double { a(n).flatMap(Double.init) ?? d }
        props = AWCSliderProps(min: num("min", 0), max: num("max", 100), step: num("step", 1), value: num("value", 50), valueStart: num("value-start", 0),
                               valueEnd: num("value-end", 100), disabled: a("disabled") != nil, variant: a("variant") ?? "standard", range: a("range") != nil,
                               stops: a("stops") != nil, size: a("size") ?? "xs", orientation: a("orientation") ?? "horizontal",
                               valueIndicator: a("value-indicator") != nil, labeled: a("labeled") != nil, insetIcon: a("inset-icon") != nil,
                               controlled: a("controlled") != nil, rtl: rtl)
        initial = props
        s.onEvent = { [unowned self] e in self.events.append((self.phaseIdx, e)) }
        s.onPropWrite = { [unowned self] k, v in
            switch k { case "value": self.props.value = v; case "valueStart": self.props.valueStart = v; case "valueEnd": self.props.valueEnd = v; default: break }
        }
        s.sync(props)
        if let parts = (phases.first?["snap"] as? [String: Any])?["parts"] as? [[String: Any]], let r = parts.first(where: { ($0["part"] as? String) == "surface" })?["rect"] as? [String: Any] {
            w = (r["width"] as? NSNumber)?.doubleValue ?? 480; ox = (r["x"] as? NSNumber)?.doubleValue ?? 24
        }
        func drag(_ a: Double, _ b: Double, _ n: Int = 5) -> [Double] {
            var out: [Double] = [a, a]
            for k in 1...n { let d: Double = (b - a) * Double(k); out.append(a + d / Double(n)) }
            out.append(b)
            return out
        }
        switch true {
        case name.hasPrefix("drag-standard"): fractions = drag(0.3, 0.7)
        case name.hasPrefix("drag-range-crossing"): fractions = drag(0.2, 0.8, 6) + drag(0.8, 0.5, 3)
        case name == "track-click-ltr": fractions = [0.85, 0.85, 0.85]
        case name == "track-click-range-ltr": fractions = [0.9, 0.9, 0.05, 0.05]
        case name == "drag-centered-ltr": fractions = drag(0.7, 0.2, 6)
        case name == "drag-stops-ltr": fractions = drag(0.3, 0.74, 4)
        case name == "drag-indicator-ltr": fractions = drag(0.3, 0.6, 3)
        case name == "drag-inset-lg-ltr": fractions = drag(0.05, 0.6, 6)
        case name == "drag-vertical-ltr": fractions = drag(0.3, 0.8, 5)
        case name == "drag-vertical-range-rtl": fractions = drag(0.2, 0.7, 5)
        case name == "controlled-cap-drag-ltr": fractions = drag(0.4, 0.9, 5)
        case name == "controlled-reject-ltr": fractions = drag(0.5, 0.8, 3)
        case name == "disabled-ltr": fractions = [0.3, 0.7, 0.7]
        case name == "dark-drag-ltr": fractions = drag(0.3, 0.6, 3)
        default: break
        }
    }

    func at(_ f: Double) -> (Double, Double) {
        if s.vertical { return (0, 1000 * (1 - f)) }
        let page = rtl ? ox + w - w * f : ox + w * f
        return (Double(Float(page)) - ox, 22)
    }

    /// `prop:<name>=<JSON>`: the host sets one property (Stencil runs its watcher if it changed).
    func setProp(_ spec: String) {
        let kv = spec.split(separator: "=", maxSplits: 1).map(String.init)
        guard kv.count == 2, let v = try? JSONSerialization.jsonObject(with: Data(kv[1].utf8), options: .fragmentsAllowed) else { diffs.append("bad prop step \(spec)"); return }
        let n = (v as? NSNumber)?.doubleValue, b = (v as? NSNumber)?.boolValue, t = v as? String
        switch kv[0] {
        case "min": props.min = n ?? 0
        case "max": props.max = n ?? 100
        case "step": props.step = n ?? 1
        case "value": props.value = n ?? 50
        case "valueStart": props.valueStart = n ?? 0
        case "valueEnd": props.valueEnd = n ?? 100
        case "disabled": props.disabled = b ?? false
        case "variant": props.variant = t ?? "standard"
        case "range": props.range = b ?? false
        case "stops": props.stops = b ?? false
        case "size": props.size = t ?? "xs"
        case "orientation": props.orientation = t ?? "horizontal"
        case "valueIndicator": props.valueIndicator = b ?? false
        case "labeled": props.labeled = b ?? false
        case "insetIcon": props.insetIcon = b ?? false
        case "controlled": props.controlled = b ?? false
        case "icon": break   // the inset glyph (view only)
        default: diffs.append("unknown prop \(kv[0])")
        }
        s.sync(props)
    }

    func step(_ label: String) {
        if label.hasPrefix("prop:") { setProp(String(label.dropFirst(5))); return }
        if label == "form-reset" {
            // The owning form restores the authored values (formResetCallback; natively the form resets the node's values).
            props.value = initial.value; props.valueStart = initial.valueStart; props.valueEnd = initial.valueEnd; s.sync(props); return
        }
        if label.hasPrefix("touch-") {
            // Trusted touch (Chrome): the finger lands without a hover move; a lift has no move either.
            let tp = label.split(separator: "-")
            guard tp.count == 3, let pct = Double(tp[2]) else { diffs.append("unknown step \(label)"); return }
            let pt = at(pct / 100)
            switch tp[1] { case "down": s.pointerDown(pt.0, pt.1, w, 1000, touch: true); case "move": s.pointerMove(pt.0, pt.1, w, 1000); default: s.pointerUp(pt.0, pt.1, w, 1000) }
            return
        }
        let parts = label.split(separator: "-")
        if label == "arm" || label == "leave" { return }
        if label == "install-cap-handler" {
            let prev = s.onEvent
            s.onEvent = { [unowned self] e in prev(e); if e.name == "mdInput", let v = e.detail["value"] as? Double { self.s.setValueProp(Swift.min(60, v)) } }
            return
        }
        // The page focuses the button before the slider, then tabs: a focused thumb blurs first.
        if label == "tab-in" { if s.focusedThumb != nil { s.blur() }; if !s.disabled { s.focus(s.range ? "start" : "single", keyboard: true) }; return }
        if label == "key-Tab" { if s.range && s.focusedThumb == "start" { s.focus("end", keyboard: true) } else { s.blur() }; return }
        if label == "key-Tab+Shift" { s.blur(); return }
        if label.hasPrefix("key-") {
            if let t = s.focusedThumb { let k = String(label.dropFirst(4)); s.keyDown(t, k); deferredKeyUp = { [unowned self] in self.s.keyUp(t, k) } }
            return
        }
        guard parts.count == 2, let pct = Double(parts[1]), ["move", "down", "up"].contains(String(parts[0])) else { diffs.append("unknown step \(label)"); return }
        let f = fractions.isEmpty ? pct / 100 : fractions.removeFirst()
        let p = at(f)
        switch parts[0] {
        case "move": s.pointerMove(p.0, p.1, w, 1000)
        case "down": s.pointerMove(p.0, p.1, w, 1000); s.pointerDown(p.0, p.1, w, 1000)
        default: s.pointerMove(p.0, p.1, w, 1000); s.pointerUp(p.0, p.1, w, 1000)
        }
    }

    func num(_ v: Any?) -> Double? { (v as? NSNumber)?.doubleValue }
    /// A key press whose keyup landed a frame after the keydown: the press morph started, then reversed (shortened).
    func keyRelease(_ i: Int, _ p: [String: Any]) -> Double? {
        let t0 = num(p["t"]) ?? 0, end = i + 1 < phases.count ? num(phases[i + 1]["t"]) ?? .infinity : .infinity
        return anims.first { (($0["target"] as? String) ?? "").hasSuffix("thumb-knob") && (num($0["duration"]) ?? 100) < 99 && (num($0["startTime"]).map { $0 >= t0 && $0 < end } ?? false) }
            .flatMap { num($0["startTime"]) }
    }
    func paintAt(_ now: Double) -> AWCSliderPaint {
        AWCSliderLayout.layout(s, theme: theme, hooks: hooks, containerWidth: 480, containerHeight: fullHeight ? 300 : nil, fullHeight: fullHeight, motion: motion, now: now)
    }
    func comparePaint(_ i: Int, _ p: [String: Any]) {
        let samples = p["samples"] as? [[String: Any]] ?? []
        let t0 = num(p["t"]) ?? 0
        let first = samples.first.flatMap { num($0["t"]) } ?? t0 + 16.7
        // The style change lands on the frame the transitions start on (Chrome stamps them with that frame's time).
        let change = anims.compactMap { num($0["startTime"]) }.filter { $0 >= t0 - 1e-6 && $0 <= first + 1 }.max().map { Swift.min($0, first) } ?? first - 16.7
        if let release = keyRelease(i, p), let up = deferredKeyUp {
            _ = paintAt(release - 16.67); up(); deferredKeyUp = nil; _ = paintAt(release)
        } else { _ = paintAt(change) }
        let tol = 1.0 / 64 + 1e-6
        for sm in samples {
            guard let t = num(sm["t"]) else { continue }
            // document.timeline times are coarsened to 0.1 ms: accept anything the native value takes within ±0.1 ms.
            let window = [paintAt(t - 0.1), paintAt(t + 0.1), paintAt(t)]
            let tag = "\(p["label"] ?? "")#\(i)@\(String(format: "%.1f", t))"
            func within(_ l: String, _ w: AWCSliderRect?, _ pick: (AWCSliderPaint) -> AWCSliderRect?) {
                guard let w else { return }
                let rs = window.compactMap(pick).map { $0.offset(24, 24) }
                guard !rs.isEmpty else { return }
                func ok(_ v: Double, _ f: (AWCSliderRect) -> Double) -> Bool { v >= rs.map(f).min()! - tol && v <= rs.map(f).max()! + tol }
                if !(ok(w.x) { $0.x } && ok(w.y) { $0.y } && ok(w.width) { $0.width } && ok(w.height) { $0.height }) { diffs.append("\(l) web \(w) native \(rs.last!)") }
            }
            for (j, th) in (sm["thumbs"] as? [[String: Any]] ?? []).enumerated() {
                within("\(tag) thumb[\(j)]", rectOf(th["rect"])) { j < $0.thumbs.count ? $0.thumbs[j].box : nil }
                within("\(tag) knob[\(j)]", rectOf(th["knob"])) { j < $0.thumbs.count ? $0.thumbs[j].knob : nil }
            }
            if let a = sm["active"] as? [String: Any] { within("\(tag) active", rectOf(a["rect"])) { $0.segments.first { $0.kind == "active" }?.rect } }
            for (j, str) in (sm["ticks"] as? [String] ?? []).enumerated() {
                let op = Double(str.split(separator: ":").last ?? "") ?? -1
                let ops = window.compactMap { j < $0.ticks.count ? $0.ticks[j].opacity : nil }
                if !ops.isEmpty && (op < ops.min()! - 0.0051 || op > ops.max()! + 0.0051) { diffs.append("\(tag) tick[\(j)] opacity web \(op) native \(ops.last!)") }
            }
        }
        guard let snap = p["snap"] as? [String: Any] else { return }
        let snapT = i + 1 < phases.count ? num(phases[i + 1]["t"]) ?? first : (samples.last.flatMap { num($0["t"]) } ?? first) + 16.7
        let sp = paintAt(snapT)
        // The snapshot is read after the phase's screenshot; skip it if a transition may still be mid-flight then.
        if !motion.active(snapT) { sliderTreeDiff(snap, sp) { [unowned self] m in self.diffs.append("\(p["label"] ?? "")#\(i) paint: \(m)") } }
    }

    func run() -> [String] {
        for (i, p) in phases.enumerated() {
            phaseIdx = i; step(p["label"] as? String ?? "")
            if keyRelease(i, p) == nil { deferredKeyUp?(); deferredKeyUp = nil }
            s.sync(props)   // the render after the step (a no-op unless the host state changed)
            s.render(); compare(i, p); comparePaint(i, p)
        }
        if !last { phaseIdx = phases.count - 1; s.blur() }
        let web = (c["events"] as? [[String: Any]] ?? []).map { "\($0["name"] ?? "") \(norm($0["detail"]))" }
        let mine = events.map { "\($0.1.name) \(norm($0.1.detail))" }
        if web != mine { diffs.append("events web \(web) native \(mine)") }
        return diffs
    }

    func compare(_ i: Int, _ p: [String: Any]) {
        let label = "\(p["label"] ?? "")#\(i)"
        guard let sm = (p["samples"] as? [[String: Any]])?.last else { return }
        func eq(_ a: Any?, _ b: Double) -> Bool { ((a as? NSNumber)?.doubleValue).map { abs($0 - b) < 1e-9 } ?? false }
        if !eq(sm["value"], s.value) { diffs.append("\(label) value web \(sm["value"] ?? "") native \(s.value)") }
        if s.range {
            if !eq(sm["valueStart"], s.valueStart) { diffs.append("\(label) valueStart web \(sm["valueStart"] ?? "") native \(s.valueStart)") }
            if !eq(sm["valueEnd"], s.valueEnd) { diffs.append("\(label) valueEnd web \(sm["valueEnd"] ?? "") native \(s.valueEnd)") }
        }
        let mine: [(String, String, Bool)] = s.range ? [(s.inputStart, awcSRJSNumberString(s.displayStart), s.focusedThumb == "start"), (s.inputEnd, awcSRJSNumberString(s.displayEnd), s.focusedThumb == "end")]
                                                     : [(s.inputValue, awcSRJSNumberString(s.displayValue), s.focusedThumb == "single")]
        for (k, inp) in (sm["inputs"] as? [[String: Any]] ?? []).enumerated() where k < mine.count {
            if (inp["value"] as? String) != mine[k].0 { diffs.append("\(label) input[\(k)] value web \(inp["value"] ?? "") native \(mine[k].0)") }
            if (inp["now"] as? String) != mine[k].1 { diffs.append("\(label) input[\(k)] valuenow web \(inp["now"] ?? "") native \(mine[k].1)") }
            if (inp["focused"] as? Bool) != mine[k].2 { diffs.append("\(label) input[\(k)] focused web \(inp["focused"] ?? "") native \(mine[k].2)") }
        }
        let vars = sm["vars"] as? [String: Any] ?? [:]
        func v(_ k: String, _ x: Double) { let w = (vars[k] as? String).flatMap { Double($0.replacingOccurrences(of: "%", with: "")) }; if w == nil || abs(w! - x) > 1e-9 { diffs.append("\(label) \(k) web \(vars[k] ?? "") native \(x)") } }
        v("--_value-pct", s.valuePct); v("--_active-start-pct", s.activeStartPct); v("--_active-width-pct", s.activeWidthPct)
        if s.range { v("--_start-pct", s.startPct); v("--_end-pct", s.endPct) }
        let ind = (sm["indicators"] as? [[String: Any]] ?? []).compactMap { $0["text"] as? String }
        if ind != s.indicatorTexts { diffs.append("\(label) indicators web \(ind) native \(s.indicatorTexts)") }
        let ticks = (sm["ticks"] as? [String])?.map { String($0.split(separator: ":").first ?? "") }
        if ticks != s.ticks() { diffs.append("\(label) ticks web \(ticks ?? []) native \(s.ticks() ?? [])") }
    }
}

final class RatingReplay {
    let c: [String: Any], name: String, phases: [[String: Any]]
    let r = AWCRatingInteraction()
    var events: [(String, Double?)] = []
    var hoverItem = -1, showLabel = false
    var diffs: [String] = []
    var pressedItem = -1, pendingPress = -1, visHover = -1, visPressed = -1
    var ripples: [AWCRatingRipple] = []
    var pendingRipple: (Int, Double)? = nil
    /// A tap's :active (the synthesized mousedown) is held at least 150 ms (kMinimumActiveInterval), then drops to :hover.
    var touchRelease = false
    let reduced: Bool
    let motion: AWCSliderMotion
    let anims: [[String: Any]]
    var size = "md", icon = "star"
    var hooks = AWCRatingHooks()
    let theme: AWCRatingTheme
    var props = AWCRatingProps(), initialValue = 0.0
    var densityProp: Int? = nil

    init(_ c: [String: Any], reduced: Bool = false) {
        self.reduced = reduced; motion = AWCSliderMotion(reducedMotion: reduced); anims = c["anims"] as? [[String: Any]] ?? []
        theme = ratingTheme(dark: (c["theme"] as? String) == "dark", density: 0)
        self.c = c; name = c["name"] as? String ?? ""; phases = c["phases"] as? [[String: Any]] ?? []
        let html = c["html"] as? String ?? ""
        func a(_ n: String) -> String? { attr("md-rating", html, n) }
        props = AWCRatingProps(value: a("value").flatMap(Double.init) ?? 0, defaultValue: a("default-value").flatMap(Double.init) ?? 0,
                               max: a("max").flatMap(Int.init) ?? 5, precision: a("precision").flatMap(Double.init) ?? 1, readonly: a("readonly") != nil,
                               disabled: a("disabled") != nil, softDisabled: a("soft-disabled") != nil, hover: a("hover") ?? "preview",
                               rtl: (c["dir"] as? String) == "rtl")
        showLabel = a("show-value-label") != nil
        size = a("size") ?? "md"; icon = a("icon") ?? "star"; hooks = ratingHooks(a("style") ?? ""); densityProp = a("density").flatMap { Int($0) }
        r.onEvent = { [unowned self] n, v in self.events.append((n, v)) }
        r.onPropWrite = { [unowned self] v in self.props.value = v }
        r.sync(props)
        initialValue = r.value   // componentWillLoad: the validated initial value
    }

    func setProp(_ spec: String) {
        let kv = spec.split(separator: "=", maxSplits: 1).map(String.init)
        guard kv.count == 2, let v = try? JSONSerialization.jsonObject(with: Data(kv[1].utf8), options: .fragmentsAllowed) else { diffs.append("bad prop step \(spec)"); return }
        let n = (v as? NSNumber)?.doubleValue, b = (v as? NSNumber)?.boolValue, t = v as? String
        switch kv[0] {
        case "value": props.value = n ?? 0
        case "defaultValue": props.defaultValue = n ?? 0
        case "max": props.max = Int(n ?? 5)
        case "precision": props.precision = n ?? 1
        case "readonly": props.readonly = b ?? false
        case "disabled": props.disabled = b ?? false
        case "softDisabled": props.softDisabled = b ?? false
        case "hover": props.hover = t ?? "preview"
        case "size": size = t ?? "md"
        case "density": densityProp = n.map { Int($0) }
        case "showValueLabel": showLabel = b ?? false
        case "icon": icon = t ?? "star"
        default: diffs.append("unknown prop \(kv[0])")
        }
        r.sync(props)
        // A state that removes focusability takes the focus away (the readonly host loses its tabindex).
        if r.focused && !r.focusable { r.blur() }
    }

    func step(_ label: String) {
        if label == "arm" { return }
        if label.hasPrefix("prop:") { setProp(String(label.dropFirst(5))); return }
        if label == "form-reset" { props.value = initialValue; r.sync(props); return }
        if label == "method:focusRating" { if r.focusable { r.focus(keyboard: false) }; return }   // script focus: no ring until a key
        if label.hasPrefix("touch-") {
            // Trusted touch (Chrome): pointerdown runs the ripple; the synthesized mouse events after the lift focus the rating
            // without :focus-visible, click, and leave the tapped item :hover — no mdHover (no pointermove), no :active.
            let re = try! NSRegularExpression(pattern: "^touch-(down|up)-(\\d+)@(\\d+)$")
            guard let m = re.firstMatch(in: label, range: NSRange(label.startIndex..., in: label)) else { diffs.append("unknown step \(label)"); return }
            let i = Int(label[Range(m.range(at: 2), in: label)!])! - 1
            let f = Double(label[Range(m.range(at: 3), in: label)!])! / 100
            let fx = r.rtl ? 1 - f : f
            if label.contains("-down-") { pendingRipple = (i, fx * 100) }                  // ripple only: no :active, no focus yet
            else { r.tap(i, fx); hoverItem = i; if r.isInteractive { pressedItem = i; touchRelease = true } }   // focus (no ring), click; :active (a live state layer only), then :hover
            return
        }
        if label == "leave" { if hoverItem >= 0 { r.pointerLeave() }; hoverItem = -1; pressedItem = -1; return }
        if label == "tab-in" { if r.focused { r.blur() }; if r.focusable { r.focus(keyboard: true) }; return }
        if label == "key-Tab" { if r.focused { r.blur() }; return }
        if label.hasPrefix("key-") { if r.focused { r.keyDown(String(label.dropFirst(4))) }; return }
        let re = try! NSRegularExpression(pattern: "^(move|down|up)-(\\d+)@(\\d+)$")
        guard let m = re.firstMatch(in: label, range: NSRange(label.startIndex..., in: label)) else { diffs.append("unknown step \(label)"); return }
        let kind = String(label[Range(m.range(at: 1), in: label)!])
        let i = Int(label[Range(m.range(at: 2), in: label)!])! - 1
        let f = Double(label[Range(m.range(at: 3), in: label)!])! / 100
        let fx = r.rtl ? 1 - f : f
        hoverItem = i
        switch kind {
        case "move": r.pointerMove(i, fx)
        case "down": r.pointerMove(i, fx); r.pointerDown(); pendingPress = i; pendingRipple = (i, fx * 100)
        default: r.pointerMove(i, fx); r.click(i, fx); pressedItem = -1
        }
    }

    func run() -> [String] {
        for (i, p) in phases.enumerated() { step(p["label"] as? String ?? ""); r.sync(props); compare(i, p); compareMotion(i, p) }
        let web = (c["events"] as? [[String: Any]] ?? []).map { "\($0["name"] ?? "") \(norm($0["detail"]))" }
        let mine = events.map { "\($0.0) \(norm($0.1))" }
        if web != mine { diffs.append("events web \(web) native \(mine)") }
        return diffs
    }

    func num(_ v: Any?) -> Double? { (v as? NSNumber)?.doubleValue }
    func paintAt(_ now: Double) -> AWCRatingPaint {
        AWCRatingLayout.layout(r, theme: theme, hooks: hooks, size: size, icon: icon, showValueLabel: showLabel, densityProp: densityProp,
                               hoverItem: r.disabled ? -1 : visHover, pressedItem: r.disabled ? -1 : visPressed, ripples: ripples,
                               reducedMotion: reduced, motion: motion, now: now)
    }
    /// Per frame: the hover pop (scale), state-layer opacity, glyph ripple and focus ring, within the coarsened timestamps (±0.1 ms).
    func compareMotion(_ i: Int, _ p: [String: Any]) {
        let samples = p["samples"] as? [[String: Any]] ?? []
        let t0 = num(p["t"]) ?? 0
        let next = i + 1 < phases.count ? num(phases[i + 1]["t"]) ?? .infinity : .infinity
        let first = samples.first.flatMap { num($0["t"]) } ?? t0 + 16.7
        // The visual state changes on the frame its CSS transitions start (possibly after the first sample);
        // a WAAPI animation (the ripple) resolves its start a frame later.
        let trStarts = anims.filter { ($0["property"] as? String) != "animation" }.compactMap { num($0["startTime"]) }.filter { $0 >= t0 - 1e-6 && $0 < next }
        let change = trStarts.min() ?? first - 16.7
        let rippleStart = anims.filter { (($0["target"] as? String) ?? "").hasSuffix("ripple") }.compactMap { num($0["startTime"]) }.first { $0 >= t0 - 1e-6 && $0 < next }
        if pendingPress >= 0 { pressedItem = pendingPress; pendingPress = -1 }
        if let pr = pendingRipple, r.isInteractive, let rippleStart { ripples.append(AWCRatingRipple(item: pr.0, start: rippleStart, xPct: pr.1, yPct: 50)) }
        pendingRipple = nil
        let disabling = ["prop:disabled=true", "prop:softDisabled=true", "prop:readonly=true"].contains(p["label"] as? String ?? "")
        let prevStates = i > 0 ? ((phases[i - 1]["samples"] as? [[String: Any]])?.last?["items"] as? [[String: Any]] ?? []).map { num($0["state"]) ?? -1 } : []
        var applied = false
        func apply() { if !applied { visHover = hoverItem; visPressed = pressedItem; applied = true; _ = paintAt(change) } }
        if change <= first { apply() }
        // The tap's :active drops on the phase's next transition start, which must come 100–170 ms after the change
        // (Chrome's 150 ms minimum counts from the synthesized mousedown, before the change frame).
        var releaseAt = Double.infinity
        if touchRelease {
            touchRelease = false
            let later = trStarts.filter { $0 > change + 100 }.min()
            if let later, later <= change + 170 { releaseAt = later }
            else { diffs.append("\(p["label"] ?? "")#\(i) :active release web \(later.map { String($0 - change) } ?? "none") ms after the tap"); releaseAt = change + 150 }
        }
        for sm in samples {
            guard let t = num(sm["t"]) else { continue }
            if t >= change - 0.05 { apply() }
            if t >= releaseAt - 0.05 { pressedItem = -1; visPressed = -1; _ = paintAt(releaseAt); releaseAt = .infinity }
            let win = [paintAt(t - 0.1), paintAt(t + 0.1), paintAt(t)]
            let tag = "\(p["label"] ?? "")#\(i)@\(String(format: "%.1f", t))"
            func within(_ l: String, _ web: Double, _ tol: Double, _ pick: (AWCRatingPaint) -> Double?) {
                let vs = win.compactMap(pick); guard !vs.isEmpty else { return }
                if web < vs.min()! - tol || web > vs.max()! + tol { diffs.append("\(tag) \(l) web \(web) native \(vs.last!)") }
            }
            for (k, it) in (sm["items"] as? [[String: Any]] ?? []).enumerated() {
                let tr = it["transform"] as? String ?? "none"
                let sc = tr == "none" ? 1 : Double(tr.replacingOccurrences(of: "matrix(", with: "").split(separator: ",").first ?? "") ?? -1
                within("item[\(k)] scale", sc, 1e-4) { k < $0.itemList.count ? $0.itemList[k].scale : nil }
                let webState = num(it["state"]) ?? -1
                // Chrome drops :hover a frame after a disabling class change (its hover update runs on the next frame): for
                // that frame a state layer may still read its previous value.
                if !(disabling && t < change + 16.7 && k < prevStates.count && abs(webState - prevStates[k]) < 1e-9) {
                    within("item[\(k)] state", webState, 0.0006) { k < $0.itemList.count ? $0.itemList[k].stateOpacity : nil }
                }
                if let rp = (it["ripple"] as? [[String: Any]])?.last {
                    let clip = rp["clip"] as? String ?? ""
                    let rad = clip.range(of: "circle(").flatMap { r0 in Double(clip[r0.upperBound...].prefix { $0 != "%" }) } ?? -1
                    within("item[\(k)] ripple radius", rad, 0.05) { k < $0.itemList.count ? ($0.itemList[k].rippleRadiusPct ?? 0) : nil }
                    within("item[\(k)] ripple opacity", Double(rp["opacity"] as? String ?? "") ?? -1, 0.0005) { k < $0.itemList.count ? $0.itemList[k].rippleOpacity : nil }
                } else if k < win[0].itemList.count, win[0].itemList[k].rippleRadiusPct != nil, win[2].itemList[k].rippleRadiusPct != nil {
                    diffs.append("\(tag) item[\(k)] ripple web none native \(win[2].itemList[k].rippleRadiusPct!)")
                }
            }
            let ring = (sm["outline"] as? String ?? "").hasPrefix("solid")
            if ring != win[2].focusRing { diffs.append("\(tag) focus ring web \(sm["outline"] ?? "") native \(win[2].focusRing)") }
        }
    }

    func compare(_ i: Int, _ p: [String: Any]) {
        let label = "\(p["label"] ?? "")#\(i)"
        guard let s = (p["samples"] as? [[String: Any]])?.last else { return }
        if (s["value"] as? NSNumber)?.doubleValue != r.value { diffs.append("\(label) value web \(s["value"] ?? "") native \(r.value)") }
        let aria = s["aria"] as? [String: Any] ?? [:]
        if !r.readonly {
            if (aria["now"] as? String) != awcSRJSNumberString(r.value) { diffs.append("\(label) valuenow web \(aria["now"] ?? "")") }
            if (aria["text"] as? String) != r.label(r.value) { diffs.append("\(label) valuetext web \(aria["text"] ?? "") native \(r.label(r.value))") }
        } else if (aria["label"] as? String) != "Rating: \(r.label(r.value))" { diffs.append("\(label) aria-label web \(aria["label"] ?? "")") }
        let tab: String? = r.disabled ? "-1" : r.readonly ? nil : "0"
        if (aria["tabindex"] as? String) != tab { diffs.append("\(label) tabindex web \(aria["tabindex"] ?? "nil") native \(tab ?? "nil")") }
        if (s["focused"] as? Bool) != r.focused { diffs.append("\(label) focused web \(s["focused"] ?? "") native \(r.focused)") }
        let items = (s["items"] as? [[String: Any]] ?? []).map { (($0["cls"] as? String) ?? "").replacingOccurrences(of: "md-rating__item--", with: "").split(separator: " ").first.map(String.init) ?? "" }
        let mine = (0..<r.max).map { r.itemState($0) }
        if items != mine { diffs.append("\(label) items web \(items) native \(mine)") }
        let lbl = s["label"] as? String
        let myLbl = showLabel ? r.label(r.displayValue) : nil
        if lbl != myLbl { diffs.append("\(label) label web \(lbl ?? "nil") native \(myLbl ?? "nil")") }
    }
}

// MARK: paint (md-slider paint.json and the per-phase snapshots)

enum WebTokens {
    static let css: String = {
        let path = ProcessInfo.processInfo.environment["AWC_TOKENS_CSS"] ?? awcSRTestsDir.appendingPathComponent("../../tokens/src/tokens.css").standardized.path
        return (try? String(contentsOfFile: path, encoding: .utf8)) ?? ""
    }()
    static func block(_ start: String) -> [String: String] {
        guard let r = css.range(of: start), let open = css[r.lowerBound...].firstIndex(of: "{"), let close = css[open...].range(of: "\n}") else { return [:] }
        let body = String(css[css.index(after: open)..<close.lowerBound])
        let re = try! NSRegularExpression(pattern: "(--[\\w-]+)\\s*:\\s*([^;]+);")
        var out: [String: String] = [:]
        for m in re.matches(in: body, range: NSRange(body.startIndex..., in: body)) {
            out[String(body[Range(m.range(at: 1), in: body)!])] = String(body[Range(m.range(at: 2), in: body)!]).trimmingCharacters(in: .whitespaces)
        }
        return out
    }
    static let light = block(":root {")
    static let dark = light.merging(block("[data-theme=\"dark\"] {")) { $1 }
    static func theme(dark isDark: Bool, density: Double) -> AWCSliderTheme {
        let t = isDark ? dark : light
        func col(_ n: String) -> String { t["--md-sys-color-\(n)"] ?? "#000" }
        var th = AWCSliderTheme(primary: col("primary"), onPrimary: col("on-primary"), secondary: col("secondary"), secondaryContainer: col("secondary-container"),
                                onSecondaryContainer: col("on-secondary-container"), inverseSurface: col("inverse-surface"), inverseOnSurface: col("inverse-on-surface"),
                                surface: col("surface"), onSurface: col("on-surface"))
        th.densityScale = density
        return th
    }
}

func sliderHooks(_ style: String) -> AWCSliderHooks {
    var hk: [String: String] = [:]
    let re = try! NSRegularExpression(pattern: "--md-slider-([\\w-]+)\\s*:\\s*([^;]+)")
    for m in re.matches(in: style, range: NSRange(style.startIndex..., in: style)) {
        hk[String(style[Range(m.range(at: 1), in: style)!])] = String(style[Range(m.range(at: 2), in: style)!]).trimmingCharacters(in: .whitespaces)
    }
    func px(_ k: String) -> Double? { hk[k].flatMap { Double($0.replacingOccurrences(of: "px", with: "")) } }
    return AWCSliderHooks(activeColor: hk["active-color"], inactiveColor: hk["inactive-color"], tickActiveColor: hk["tick-active-color"],
                          tickFilledColor: hk["tick-filled-color"], tickInactiveColor: hk["tick-inactive-color"], thumbColor: hk["thumb-color"],
                          thumbWidth: px("thumb-width"), thumbHeight: px("thumb-height"), trackHeight: px("track-height"), trackShape: px("track-shape"),
                          trackLength: px("track-length"), minTrackLength: px("min-track-length"), valueBg: hk["value-bg"], valueColor: hk["value-color"],
                          valueShape: px("value-shape"), valueFontFamily: nil, valueFontSize: px("value-font-size"), valueFontWeight: hk["value-font-weight"].flatMap(Double.init),
                          valueLineHeight: px("value-line-height"), valuePaddingInline: px("value-padding-inline"), valuePaddingBlock: px("value-padding-block"),
                          insetIconColor: hk["inset-icon-color"], insetIconActiveColor: hk["inset-icon-active-color"], valueIndicatorReserve: px("value-indicator-reserve"))
}

func rectOf(_ v: Any?) -> AWCSliderRect? {
    guard let m = v as? [String: Any] else { return nil }
    func n(_ k: String) -> Double { (m[k] as? NSNumber)?.doubleValue ?? 0 }
    return AWCSliderRect(x: n("x"), y: n("y"), width: n("width"), height: n("height"))
}

/// Chrome's serialised colours: rgb(), rgba() and color(srgb r g b / a).
func cssColor(_ s: String) -> AWCSRRGBA {
    let re = try! NSRegularExpression(pattern: "color\\(srgb ([\\d.e-]+) ([\\d.e-]+) ([\\d.e-]+)(?: / ([\\d.e-]+))?\\)")
    if let m = re.firstMatch(in: s, range: NSRange(s.startIndex..., in: s)) {
        func g(_ i: Int) -> Double? { Range(m.range(at: i), in: s).flatMap { Double(s[$0]) } }
        return (g(1) ?? 0, g(2) ?? 0, g(3) ?? 0, g(4) ?? 1)
    }
    return awcSRParseColor(s)
}

func sliderTreeDiff(_ tree: [String: Any], _ p: AWCSliderPaint, _ d: (String) -> Void) {
    func px(_ v: Any?) -> Double { Double((v as? String ?? "0").replacingOccurrences(of: "px", with: "")) ?? 0 }
    let tol = 1.0 / 64 + 1e-6
    func eqR(_ l: String, _ w: AWCSliderRect?, _ m: AWCSliderRect) {
        guard let w else { return }
        if abs(w.x - m.x) > tol || abs(w.y - m.y) > tol || abs(w.width - m.width) > tol || abs(w.height - m.height) > tol { d("\(l) rect web \(w) native \(m)") }
    }
    func eqC(_ l: String, _ web: String, _ m: AWCSRRGBA) {
        let w = cssColor(web)
        if abs(w.3 - m.3) > 0.002 { d("\(l) alpha web \(web) native \(m)"); return }
        if w.3 == 0 { return }
        if abs(w.0 - m.0) > 0.6 / 255 || abs(w.1 - m.1) > 0.6 / 255 || abs(w.2 - m.2) > 0.6 / 255 { d("\(l) colour web \(web) native \(m)") }
    }
    func eqN(_ l: String, _ w: Double, _ m: Double) { if abs(w - m) > 1e-6 { d("\(l) web \(w) native \(m)") } }
    guard let host = rectOf(tree["rect"]) else { return }
    let ox = host.x, oy = host.y
    func at(_ r: AWCSliderRect) -> AWCSliderRect { r.offset(ox, oy) }
    eqR("host", host, AWCSliderRect(x: ox, y: oy, width: p.width, height: p.height))
    let hs = tree["style"] as? [String: Any] ?? [:]
    eqN("paddingTop", px(hs["paddingTop"]), p.paddingTop); eqN("paddingLeft", px(hs["paddingLeft"]), p.paddingLeft); eqN("paddingRight", px(hs["paddingRight"]), p.paddingRight)
    eqN("opacity", Double(hs["opacity"] as? String ?? "1") ?? 1, p.opacity)
    let parts = tree["parts"] as? [[String: Any]] ?? []
    func part(_ k: String) -> [[String: Any]] { parts.filter { ($0["part"] as? String) == k } }
    func radii(_ m: [String: Any]) -> AWCSliderRadii { AWCSliderRadii(tl: px(m["borderTopLeftRadius"]), tr: px(m["borderTopRightRadius"]), br: px(m["borderBottomRightRadius"]), bl: px(m["borderBottomLeftRadius"])) }
    if let t = part("track").first { eqR("track", rectOf(t["rect"]), at(p.track)); eqN("trackRadius", px(t["borderTopLeftRadius"]), p.trackRadius) }
    func segCheck(_ l: String, _ web: [String: Any]?, _ kind: String, _ rect: AWCSliderRect?) {
        let mine = p.segments.first { $0.kind == kind }
        if (web == nil) != (mine == nil) { d("\(l) presence web \(web != nil) native \(mine != nil)"); return }
        guard let web, let mine else { return }
        eqR(l, rect, at(mine.rect))
        if radii(web) != mine.radii { d("\(l) radii web \(radii(web)) native \(mine.radii)") }
        eqC(l, web["backgroundColor"] as? String ?? "", mine.color)
    }
    if let w = part("track-inactive").first { segCheck("inactive", w, "inactive", rectOf(w["rect"])) }
    if let w = part("track-active").first { segCheck("active", w, "active", rectOf(w["rect"])) }
    if let after = tree["trackAfter"] as? [String: Any], let tr = rectOf(after["trackRect"]) {
        // Rebuilt from the pseudo's computed insets (no client rect for ::after): in RTL the used box hangs off `right`.
        let aw = px(after["width"])
        let ax = (hs["direction"] as? String) == "rtl" ? tr.x + tr.width - px(after["right"]) - aw : tr.x + px(after["left"])
        segCheck("after", after, "after", AWCSliderRect(x: ax, y: tr.y + px(after["top"]), width: aw, height: px(after["height"])))
    } else { segCheck("after", nil, "after", nil) }
    let knobs = part("thumb-knob"), thumbs = tree["thumbs"] as? [[String: Any]] ?? []
    if knobs.count != p.thumbs.count { d("knobs web \(knobs.count) native \(p.thumbs.count)") }
    for (i, t) in p.thumbs.enumerated() {
        if i < knobs.count { eqR("knob[\(i)]", rectOf(knobs[i]["rect"]), at(t.knob)); eqC("knob[\(i)]", knobs[i]["backgroundColor"] as? String ?? "", t.knobColor) }
        if i < thumbs.count {
            eqR("thumb[\(i)]", rectOf(thumbs[i]["rect"]), at(t.box))
            let cls = thumbs[i]["cls"] as? String ?? ""
            if cls.contains("--pressing") != t.pressing { d("thumb[\(i)] pressing web \(cls) native \(t.pressing)") }
            if cls.contains("--focus-visible") != t.focusRing { d("thumb[\(i)] focus-visible web \(cls) native \(t.focusRing)") }
        }
    }
    let inds = part("value-indicator")
    if inds.count != p.indicators.count { d("indicators web \(inds.count) native \(p.indicators.count)") }
    for (i, ind) in p.indicators.enumerated() where i < inds.count {
        let w = inds[i]
        eqR("indicator[\(i)]", rectOf(w["rect"]), at(ind.rect))
        if (w["text"] as? String) != ind.text { d("indicator[\(i)] text web \(w["text"] ?? "") native \(ind.text)") }
        eqC("indicator[\(i)] bg", w["backgroundColor"] as? String ?? "", ind.background); eqC("indicator[\(i)] fg", w["color"] as? String ?? "", ind.color)
        eqN("indicator[\(i)] radius", px(w["borderTopLeftRadius"]), ind.radius); eqN("indicator[\(i)] font", px(w["fontSize"]), ind.fontSize)
        eqN("indicator[\(i)] weight", Double(w["fontWeight"] as? String ?? "") ?? 0, ind.fontWeight)
        eqN("indicator[\(i)] padBlock", px(w["paddingTop"]), ind.paddingBlock); eqN("indicator[\(i)] padInline", px(w["paddingLeft"]), ind.paddingInline)
    }
    let ins = part("inset")
    if ins.count != (p.inset == nil ? 0 : 1) { d("inset web \(ins.count) native \(p.inset != nil)") }
    if let w = ins.first, let mine = p.inset { eqR("inset", rectOf(w["rect"]), at(mine.rect)); eqC("inset fg", w["color"] as? String ?? "", mine.color) }
    let ticks = tree["ticks"] as? [[String: Any]] ?? []
    if ticks.count != p.ticks.count { d("ticks web \(ticks.count) native \(p.ticks.count)") }
    for (i, t) in p.ticks.enumerated() where i < ticks.count {
        let w = ticks[i]
        let kind = (w["cls"] as? String ?? "").components(separatedBy: "md-slider__tick--on-").last ?? ""
        if kind != t.kind { d("tick[\(i)] kind web \(kind) native \(t.kind)") }
        eqR("tick[\(i)]", rectOf(w["rect"]), at(t.rect)); eqC("tick[\(i)]", w["background"] as? String ?? "", t.color)
        eqN("tick[\(i)] opacity", (w["opacity"] as? NSNumber)?.doubleValue ?? -1, t.opacity)
    }
}

final class SliderPaintCase {
    let c: [String: Any], name: String
    var diffs: [String] = []
    init(_ c: [String: Any]) { self.c = c; name = c["name"] as? String ?? "" }
    func run() -> [String] {
        let html = c["html"] as? String ?? ""
        func a(_ n: String) -> String? { attr("md-slider", html, n) }
        func num(_ n: String, _ d: Double) -> Double { a(n).flatMap(Double.init) ?? d }
        let s = AWCSliderInteraction()
        s.min = num("min", 0); s.max = num("max", 100); s.step = num("step", 1)
        s.disabled = a("disabled") != nil; s.variant = a("variant") ?? "standard"; s.range = a("range") != nil; s.stops = a("stops") != nil
        s.size = a("size") ?? "xs"; s.orientation = a("orientation") ?? "horizontal"
        s.valueIndicator = a("value-indicator") != nil; s.labeled = a("labeled") != nil; s.insetIcon = a("inset-icon") != nil
        s.rtl = (c["dir"] as? String) == "rtl"
        s.load(value: num("value", 50), valueStart: num("value-start", 0), valueEnd: num("value-end", 100))
        let hooks = sliderHooks(a("style") ?? "")
        var density = 0.0
        if name.hasPrefix("density-scale-"), let n = Double(String(name.dropFirst("density-scale-".count).prefix(1))) { density = -n }
        let theme = WebTokens.theme(dark: (c["theme"] as? String) == "dark", density: density)
        let boxH: Double? = name.hasPrefix("vertical-full-height-") ? Double(name.split(separator: "-").last ?? "") : nil
        let width = (c["width"] as? NSNumber)?.doubleValue ?? 480
        let p = AWCSliderLayout.layout(s, theme: theme, hooks: hooks, containerWidth: boxH != nil ? 0 : width, containerHeight: boxH,
                                       fullHeight: a("full-height") != nil, densityProp: a("density").flatMap { Int($0) })
        sliderTreeDiff(c["tree"] as? [String: Any] ?? [:], p) { diffs.append($0) }
        return diffs
    }
}

// MARK: md-rating paint.json

func ratingTheme(dark isDark: Bool, density: Double) -> AWCRatingTheme {
    let t = isDark ? WebTokens.dark : WebTokens.light
    func col(_ n: String) -> String { t["--md-sys-color-\(n)"] ?? "#000" }
    var th = AWCRatingTheme(secondary: col("secondary"), onSurface: col("on-surface"), onSurfaceVariant: col("on-surface-variant"))
    th.densityScale = density
    return th
}

func ratingHooks(_ style: String) -> AWCRatingHooks {
    var hk: [String: String] = [:]
    let re = try! NSRegularExpression(pattern: "--md-rating-([\\w-]+)\\s*:\\s*([^;]+)")
    for m in re.matches(in: style, range: NSRange(style.startIndex..., in: style)) {
        hk[String(style[Range(m.range(at: 1), in: style)!])] = String(style[Range(m.range(at: 2), in: style)!]).trimmingCharacters(in: .whitespaces)
    }
    func px(_ k: String) -> Double? { hk[k].flatMap { Double($0.replacingOccurrences(of: "px", with: "")) } }
    var h = AWCRatingHooks(itemSize: px("item-size"), itemGap: px("item-gap"), activeColor: hk["active-color"], inactiveColor: hk["inactive-color"],
                           focusRingColor: hk["focus-ring-color"], focusRingWidth: px("focus-ring-width"), focusRingOffset: px("focus-ring-offset"),
                           stateLayerColor: hk["state-layer-color"], valueLabelColor: hk["value-label-color"])
    // `font` shorthand: [weight] size/line-height family
    if let f = hk["value-label-font"], let m = try! NSRegularExpression(pattern: "(\\d+)px/(\\d+)px\\s+(.+)$").firstMatch(in: f, range: NSRange(f.startIndex..., in: f)) {
        h.valueLabelLineHeight = Double(f[Range(m.range(at: 2), in: f)!]); h.valueLabelFontFamily = String(f[Range(m.range(at: 3), in: f)!])
    }
    h.popScale = hk["pop-scale"].flatMap(Double.init); h.durationMs = hk["duration"].flatMap { Double($0.replacingOccurrences(of: "ms", with: "")) }
    return h
}

final class RatingPaintCase {
    let c: [String: Any], name: String
    var diffs: [String] = []
    init(_ c: [String: Any]) { self.c = c; name = c["name"] as? String ?? "" }
    func run() -> [String] {
        let html = c["html"] as? String ?? ""
        func a(_ n: String) -> String? { attr("md-rating", html, n) }
        let r = AWCRatingInteraction()
        r.precision = a("precision").flatMap(Double.init) ?? 1; r.max = a("max").flatMap(Int.init) ?? 5
        r.defaultValue = a("default-value").flatMap(Double.init) ?? 0
        r.readonly = a("readonly") != nil; r.disabled = a("disabled") != nil; r.softDisabled = a("soft-disabled") != nil
        r.rtl = (c["dir"] as? String) == "rtl"
        r.setValueProp(a("value").flatMap(Double.init) ?? 0)
        if name.hasPrefix("focus-visible") && r.focusable { r.focus(keyboard: true) }
        if name == "label-getlabel" {
            r.getLabel = { v in let names = ["Awful", "Poor", "Fair", "Good", "Great", "Superb"]; return v.truncatingRemainder(dividingBy: 1) == 0 && Int(v) >= 0 && Int(v) < names.count ? names[Int(v)] : awcSRJSNumberString(v) }
        }
        var density = 0.0
        if name.hasPrefix("density-scale-"), let n = Double(String(name.dropFirst("density-scale-".count).prefix(1))) { density = -n }
        let outlineEmpty = a("outline-empty").map { $0 != "false" } ?? true
        let icon = a("icon") ?? "star"
        let p = AWCRatingLayout.layout(r, theme: ratingTheme(dark: (c["theme"] as? String) == "dark", density: density), hooks: ratingHooks(a("style") ?? ""),
                                       size: a("size") ?? "md", icon: icon, emptyIcon: a("empty-icon") ?? "star", outlineEmpty: outlineEmpty,
                                       showValueLabel: a("show-value-label") != nil, densityProp: a("density").flatMap { Int($0) })
        let tree = c["tree"] as? [String: Any] ?? [:]
        func px(_ v: Any?) -> Double { Double((v as? String ?? "0").replacingOccurrences(of: "px", with: "")) ?? 0 }
        let tol = 1.0 / 64 + 1e-6
        func eqR(_ l: String, _ w: AWCSliderRect?, _ m: AWCSliderRect) {
            guard let w else { return }
            if abs(w.x - m.x) > tol || abs(w.y - m.y) > tol || abs(w.width - m.width) > tol || abs(w.height - m.height) > tol { diffs.append("\(l) rect web \(w) native \(m)") }
        }
        func eqC(_ l: String, _ web: String, _ m: AWCSRRGBA) {
            let w = cssColor(web)
            if abs(w.3 - m.3) > 0.002 { diffs.append("\(l) alpha web \(web) native \(m)"); return }
            if w.3 == 0 { return }
            if abs(w.0 - m.0) > 0.6 / 255 || abs(w.1 - m.1) > 0.6 / 255 || abs(w.2 - m.2) > 0.6 / 255 { diffs.append("\(l) colour web \(web) native \(m)") }
        }
        guard let host = rectOf(tree["rect"]) else { return ["no host rect"] }
        func at(_ r: AWCSliderRect) -> AWCSliderRect { r.offset(host.x, host.y) }
        eqR("host", host, AWCSliderRect(x: host.x, y: host.y, width: p.width, height: p.height))
        let hs = tree["style"] as? [String: Any] ?? [:]
        if abs((Double(hs["opacity"] as? String ?? "1") ?? 1) - p.opacity) > 1e-6 { diffs.append("opacity web \(hs["opacity"] ?? "") native \(p.opacity)") }
        eqC("host colour", hs["color"] as? String ?? "", p.activeColor)
        let parts = tree["parts"] as? [[String: Any]] ?? []
        if let w = parts.first(where: { ($0["part"] as? String) == "items" }) {
            eqR("items", rectOf(w["rect"]), at(p.items))
            let ring = (w["outlineStyle"] as? String) == "solid"
            if ring != p.focusRing { diffs.append("focus ring web \(ring) native \(p.focusRing)") }
            if ring {
                eqC("ring colour", w["outlineColor"] as? String ?? "", p.focusRingColor)
                if px(w["outlineWidth"]) != p.focusRingWidth || px(w["outlineOffset"]) != p.focusRingOffset { diffs.append("ring web \(w["outlineWidth"] ?? "")/\(w["outlineOffset"] ?? "")") }
            }
        }
        let items = tree["items"] as? [[String: Any]] ?? []
        if items.count != p.itemList.count { diffs.append("items web \(items.count) native \(p.itemList.count)") }
        for (i, it) in p.itemList.enumerated() where i < items.count {
            let w = items[i]
            eqR("item[\(i)]", rectOf(w["rect"]), at(it.rect))
            let kind = ((w["cls"] as? String ?? "").components(separatedBy: "md-rating__item--").last ?? "").split(separator: " ").first.map(String.init) ?? ""
            if kind != it.kind { diffs.append("item[\(i)] kind web \(kind) native \(it.kind)") }
            let fg = w["fg"] as? [String: Any] ?? [:], bg = w["bg"] as? [String: Any] ?? [:]
            let clipS = fg["clip"] as? String ?? ""
            let pcts = clipS.components(separatedBy: " ").compactMap { $0.hasSuffix("%") || $0.hasSuffix("%)") ? Double($0.replacingOccurrences(of: "%", with: "").replacingOccurrences(of: ")", with: "")) : nil }
            let clip = pcts.first ?? -1
            let fromLeft = clipS.hasPrefix("inset(0px 0px 0px ")
            if abs(clip - it.clipPct) > 1e-6 || (clip > 0 && fromLeft != it.clipFromLeft) { diffs.append("item[\(i)] clip web \(clipS) native \(it.clipPct)") }
            eqC("item[\(i)] fg", fg["color"] as? String ?? "", p.activeColor); eqC("item[\(i)] bg", bg["color"] as? String ?? "", p.inactiveColor)
            if (fg["text"] as? String) != p.icon { diffs.append("item[\(i)] icon web \(fg["text"] ?? "") native \(p.icon)") }
            if (bg["text"] as? String) != p.emptyIcon { diffs.append("item[\(i)] empty icon web \(bg["text"] ?? "") native \(p.emptyIcon)") }
            let fvs = bg["fvs"] as? String ?? ""
            if !fvs.contains("\"FILL\" \(p.emptyFill)") || !fvs.contains("\"wght\" \(p.emptyWeight)") { diffs.append("item[\(i)] empty axes web \(fvs)") }
            let st = w["state"] as? [String: Any] ?? [:]
            if (st["display"] as? String) != "none", abs(((st["opacity"] as? NSNumber)?.doubleValue ?? -1) - it.stateOpacity) > 1e-6 { diffs.append("item[\(i)] state web \(st["opacity"] ?? "") native \(it.stateOpacity)") }
        }
        let lab = parts.first { ($0["part"] as? String) == "value-label" }
        if (lab != nil) != (p.label != nil) { diffs.append("label presence web \(lab != nil) native \(p.label != nil)") }
        if let lab, let pl = p.label {
            eqR("label", rectOf(lab["rect"]), at(pl))
            eqC("label colour", lab["color"] as? String ?? "", p.labelColor)
            if px(lab["fontSize"]) != p.labelFontSize || Double(lab["fontWeight"] as? String ?? "") != p.labelFontWeight || px(lab["lineHeight"]) != p.labelLineHeight {
                diffs.append("label font web \(lab["fontSize"] ?? "") \(lab["fontWeight"] ?? "") \(lab["lineHeight"] ?? "")")
            }
            if (tree["valueLabel"] as? String) != p.labelText { diffs.append("label text web \(tree["valueLabel"] ?? "nil") native \(p.labelText ?? "nil")") }
        }
        return diffs
    }
}
