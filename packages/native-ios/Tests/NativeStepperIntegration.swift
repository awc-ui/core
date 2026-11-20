import Foundation
@testable import AWCUI

// md-stepper / md-step parity against the Mac Chrome 153 oracles (outputs/native-parity/md-stepper/web-oracle):
// paint (142 cases: every part's box, colours, scale / transform, halo, focus ring, text and its font, the inner
// header's ARIA, panel boxes / visibility / grid rows, live regions) through AWCStepperLayout, and the 20 state runs
// (normal + reduced motion) replayed through AWCStepperModel + AWCStepperMotion: per-frame bubble colour / scale / width,
// connector fill, panel height / visibility, host height, live regions, active / completed, the md* event sequence,
// and each phase-end snapshot compared like a paint case. Lockstep with the Android harness (androidTest dev.awc.playground.stepper).
// Usage: NativeStepperIntegration [<oracle dir>]  (default: Tests/Fixtures/stepper-web-oracle; AWC_TOKENS_CSS: the token
// sheet, default packages/tokens/src/tokens.css)
let awcStepperTestsDir = URL(fileURLWithPath: #filePath).deletingLastPathComponent()

// MARK: tokens.css

enum StepperWebTokens {
    static let css: String = {
        let path = ProcessInfo.processInfo.environment["AWC_TOKENS_CSS"] ?? awcStepperTestsDir.appendingPathComponent("../../tokens/src/tokens.css").standardized.path
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
    /// The rung payloads must equal AWCStepperTheme.rungs (the view's static table).
    static func checkRungs() -> [String] {
        var d: [String] = []
        for n in [-1, -2, -3, -4] {
            let b = block("[data-density=\"\(n)\"],").filter { $0.key.hasPrefix("--md-sys-spacing-") && $0.key != "--md-sys-spacing-row-height" }
            let web = Dictionary(uniqueKeysWithValues: b.map { (String($0.key.dropFirst("--md-sys-spacing-".count)), awcStepperPx($0.value) ?? -1) })
            let mine = AWCStepperTheme.rungs[n] ?? [:]
            if web != mine { d.append("density rung \(n): tokens.css \(web) native \(mine)") }
        }
        return d
    }
}

// MARK: markup → props (the oracle's HTML)

struct StepperMarkup {
    var props = AWCStepperProps(), steps: [AWCStepProps] = [], slot = false, hooks = AWCStepperHooks()
    init(_ html: String) {
        let re = try! NSRegularExpression(pattern: "<(md-stepper|md-step|div)((?:\\s+[\\w-]+(?:=\"[^\"]*\")?)*)\\s*>")
        let attrRe = try! NSRegularExpression(pattern: "([\\w-]+)(?:=\"([^\"]*)\")?")
        var depthInStep = false
        let ns = html as NSString
        var lastStepEnd = 0
        for m in re.matches(in: html, range: NSRange(location: 0, length: ns.length)) {
            let tag = ns.substring(with: m.range(at: 1)), attrsRaw = ns.substring(with: m.range(at: 2))
            var a: [String: String] = [:]
            for am in attrRe.matches(in: attrsRaw, range: NSRange(location: 0, length: (attrsRaw as NSString).length)) {
                let k = (attrsRaw as NSString).substring(with: am.range(at: 1))
                a[k] = am.range(at: 2).location == NSNotFound ? "" : (attrsRaw as NSString).substring(with: am.range(at: 2))
            }
            switch tag {
            case "md-stepper":
                var p = AWCStepperProps()
                p.orientation = a["orientation"] ?? "horizontal"; p.indicator = a["indicator"] ?? "numbered"; p.variant = a["variant"] ?? "default"
                p.mode = a["mode"] ?? "linear"; p.active = Double(a["active"] ?? "0") ?? 0
                p.autoComplete = a["auto-complete"] != "false"; p.nav = a["nav"] != "false"
                p.readonly = a["readonly"] != nil; p.nextDisabled = a["next-disabled"] != nil; p.loading = a["loading"] != nil; p.lazy = a["lazy"] != nil
                p.label = a["label"] ?? "Progress"; p.stepWord = a["step-word"] ?? "Step"; p.ofWord = a["of-word"] ?? "of"
                p.completedWord = a["completed-word"] ?? "completed"; p.currentWord = a["current-word"] ?? "current"; p.errorWord = a["error-word"] ?? "error"
                p.optionalWord = a["optional-word"] ?? "Optional"; p.nextLabel = a["next-label"] ?? "Continue"; p.backLabel = a["back-label"] ?? "Back"
                p.finishLabel = a["finish-label"] ?? "Finish"; p.density = Double(a["density"] ?? "0") ?? 0
                props = p; hooks = AWCStepperHooks(style: a["style"] ?? "")
            case "md-step":
                var s = AWCStepProps()
                s.label = a["label"] ?? ""; s.description = a["description"] ?? ""; s.errorText = a["error-text"] ?? ""
                s.completed = a["completed"] != nil; s.error = a["error"] != nil; s.disabled = a["disabled"] != nil; s.optional = a["optional"] != nil
                s.editable = a["editable"] != nil; s.hideActions = a["hide-actions"] != nil; s.icon = a["icon"] ?? ""
                s.completedIcon = a["completed-icon"] ?? "check"; s.errorIcon = a["error-icon"] ?? "priority_high"; s.accessibleName = a["accessible-name"]
                s.density = Double(a["density"] ?? "0") ?? 0
                s.style = a["style"] ?? ""
                // own content: anything between this tag and its </md-step>
                let end = ns.range(of: "</md-step>", options: [], range: NSRange(location: m.range.location + m.range.length, length: ns.length - m.range.location - m.range.length))
                let inner = end.location == NSNotFound ? "" : ns.substring(with: NSRange(location: m.range.location + m.range.length, length: end.location - m.range.location - m.range.length))
                s.hasContent = !inner.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                steps.append(s); depthInStep = true; lastStepEnd = end.location
            case "div":
                if a["slot"] == "content" { slot = true }
            default: break
            }
        }
        _ = depthInStep; _ = lastStepEnd
    }
}

// MARK: comparison

let stepperTol = 1.0 / 64 + 1e-6
func swRect(_ v: Any?) -> AWCStepperRect {
    guard let m = v as? [String: Any] else { return .zero }
    func n(_ k: String) -> Double { (m[k] as? NSNumber)?.doubleValue ?? 0 }
    return AWCStepperRect(x: n("x"), y: n("y"), width: n("width"), height: n("height"))
}
func swColor(_ s: String) -> AWCStepperRGBA { awcStepperColor(s) ?? (0, 0, 0, 0) }
func swPx(_ v: Any?) -> Double { awcStepperPx((v as? String) ?? "") ?? 0 }

/// story 5-3: a wrapper part's painted box (background, border width, radius) against the Chrome computed style.
func stepperBoxDiff(_ L: String, _ w: [String: Any], _ b: AWCStepperBox?, _ rect: AWCStepperRect, _ d: (String) -> Void) {
    let web = swColor(w["backgroundColor"] as? String ?? ""), mine = b?.background ?? (0, 0, 0, 0)
    if abs(web.a - mine.a) > 0.002 || (web.a > 0 && (abs(web.r - mine.r) > 0.6 / 255 || abs(web.g - mine.g) > 0.6 / 255 || abs(web.b - mine.b) > 0.6 / 255)) { d("\(L) box bg web \(w["backgroundColor"] ?? "") native \(String(describing: b?.background))") }
    let bw = swPx(w["borderTopWidth"])
    if abs(bw - (b?.borderWidth ?? 0)) > 1e-6 { d("\(L) border width web \(bw) native \(b?.borderWidth ?? 0)") }
    if bw > 0 || web.a > 0 {
        let lim = Swift.min(rect.width, rect.height) / 2
        let wr = Swift.min(swPx(w["borderTopLeftRadius"]), lim), nr = Swift.min(b?.radius ?? 0, lim)
        if abs(wr - nr) > 1e-6 { d("\(L) radius web \(w["borderTopLeftRadius"] ?? "") native \(b?.radius ?? 0)") }
    }
}

func stepperTreeDiff(_ tree: [String: Any], _ p: AWCStepperPaint, _ m: AWCStepperModel, ox: Double, oy: Double, _ d: (String) -> Void) {
    func at(_ r: AWCStepperRect) -> AWCStepperRect { r.isEmpty ? r : r.offset(ox, oy) }
    func eqR(_ l: String, _ w: AWCStepperRect, _ mine: AWCStepperRect) {
        let n = at(mine)
        if abs(w.x - n.x) > stepperTol || abs(w.y - n.y) > stepperTol || abs(w.width - n.width) > stepperTol || abs(w.height - n.height) > stepperTol { d("\(l) rect web \(w) native \(n)") }
    }
    func eqC(_ l: String, _ web: String, _ mine: AWCStepperRGBA) {
        let w = swColor(web)
        if abs(w.a - mine.a) > 0.002 { d("\(l) alpha web \(web) native \(mine)"); return }
        if w.a == 0 { return }
        if abs(w.r - mine.r) > 0.6 / 255 || abs(w.g - mine.g) > 0.6 / 255 || abs(w.b - mine.b) > 0.6 / 255 { d("\(l) colour web \(web) native \(mine)") }
    }
    eqR("host", swRect(tree["rect"]), p.host)
    let wparts = (tree["parts"] as? [[String: Any]] ?? []).reduce(into: [String: [String: Any]]()) { $0[$1["part"] as? String ?? ""] = $1 }
    var mine: [String: AWCStepperRect] = ["list": p.list ?? .zero, "content": p.content]
    if let r = p.nav { mine["nav"] = r }
    if let r = p.mobileNav { mine["mobile-nav"] = r }
    if let r = p.mobileProgress { mine["mobile-progress"] = r }
    if Set(wparts.keys) != Set(mine.keys) { d("host parts web \(wparts.keys.sorted()) native \(mine.keys.sorted())") }
    for (k, w) in wparts { if let r = mine[k] { eqR(k, swRect(w["rect"]), r) } }
    // ::part backgrounds (transparent unless a part rule sets one).
    let bgs: [String: AWCStepperRGBA?] = ["list": p.listBackground, "content": p.contentBackground, "nav": p.navBackground, "mobile-nav": p.mobileNavBackground]
    for (k, w) in wparts { if let c = bgs[k] { eqC("\(k) bg", w["backgroundColor"] as? String ?? "", c ?? (0, 0, 0, 0)) } }
    if let w = wparts["mobile-progress"], let r = p.mobileProgress { stepperBoxDiff("mobile-progress", w, p.mobileProgressBox, r, d) }
    if let w = wparts["mobile-progress"], let r = p.mobileProgress { stepperBoxDiff("mobile-progress", w, p.mobileProgressBox, r, d) }
    if let w = wparts["mobile-progress"], let r = p.mobileProgress { stepperBoxDiff("mobile-progress", w, p.mobileProgressBox, r, d) }
    if let w = wparts["mobile-progress"], let r = p.mobileProgress { stepperBoxDiff("mobile-progress", w, p.mobileProgressBox, r, d) }
    let live = (tree["live"] as? [[String: Any]] ?? []).map { $0["text"] as? String ?? "" }
    if live != [m.live, m.errorLive] { d("live web \(live) native \([m.live, m.errorLive])") }
    let kids = tree["children"] as? [[String: Any]] ?? []
    if kids.count != p.steps.count { d("steps web \(kids.count) native \(p.steps.count)"); return }
    for (i, (ws, s)) in zip(kids, p.steps).enumerated() {
        eqR("s\(i) host", swRect(ws["rect"]), s.hostRect)
        let wa = ws["attrs"] as? [String: Any] ?? [:]
        let ha: [String: String?] = ["role": "listitem", "aria-current": m.isActive(i) ? "step" : nil, "aria-disabled": m.effectivelyDisabled(i) ? "true" : nil]
        for (k, v) in ha where (wa[k] as? String) != v { d("s\(i) host attr \(k) web \(wa[k] ?? "nil") native \(v ?? "nil")") }
        // the native part list, in DOM order
        var names: [String] = []
        if s.hasLeadingConnector { names.append("connector connector-leading") }
        names += ["inner", "indicator", "state-layer", s.dot ? "dot" : "bubble"]
        if s.text != nil { names.append("text"); names += s.lines.map(\.part) }
        if s.connector != nil { names.append("connector connector-trailing") }
        if s.panel != nil { names.append("content") }
        if s.actions != nil { names.append("actions") }
        let wp = ws["parts"] as? [[String: Any]] ?? []
        let wnames = wp.map { $0["part"] as? String ?? "" }
        if wnames != names { d("s\(i) parts web \(wnames) native \(names)"); continue }
        for w in wp {
            let k = w["part"] as? String ?? "", L = "s\(i) \(k)", wr = swRect(w["rect"])
            let op = Double(w["opacity"] as? String ?? "1") ?? 1
            switch k {
            case "connector connector-leading":
                if (w["display"] as? String) != "none" { d("\(L) display web \(w["display"] ?? "")") }
            case "inner":
                eqR(L, wr, s.inner); stepperBoxDiff(L, w, s.innerBox, s.inner, d)
                let a = w["attrs"] as? [String: Any] ?? [:]
                var mineA: [String: String] = [:]
                if !m.p.readonly {
                    mineA["role"] = "button"; mineA["tabindex"] = s.disabled ? "-1" : "0"; mineA["aria-label"] = m.a11yLabel(i)
                    if s.disabled { mineA["aria-disabled"] = "true" }
                }
                if m.isActive(i) { mineA["aria-current"] = "step" }
                if s.hasPanel { mineA["aria-expanded"] = m.isActive(i) ? "true" : "false" }
                if s.renderPanel { mineA["aria-controls"] = "md-step-panel" }
                for key in ["role", "tabindex", "aria-label", "aria-disabled", "aria-current", "aria-expanded", "aria-controls"] where (a[key] as? String) != mineA[key] {
                    d("\(L) attr \(key) web \(a[key] ?? "nil") native \(mineA[key] ?? "nil")")
                }
            case "indicator":
                eqR(L, wr, s.indicator); stepperBoxDiff(L, w, s.indicatorBox, s.indicator, d)
                if abs(op - s.indicatorOpacity) > 1e-6 { d("\(L) opacity web \(op) native \(s.indicatorOpacity)") }
                let bs = w["boxShadow"] as? String ?? "none"
                if (bs == "none") != (s.focusRing == nil) { d("\(L) ring web \(bs) native \(String(describing: s.focusRing))") }
                else if let ring = s.focusRing {
                    let parts = bs.components(separatedBy: ", rgb")
                    if parts.count == 2 {
                        let a1 = String(parts[0][..<(parts[0].lastIndex(of: ")").map { parts[0].index(after: $0) } ?? parts[0].endIndex)])
                        let p2 = "rgb" + parts[1]
                        let a2 = String(p2[..<(p2.firstIndex(of: ")").map { p2.index(after: $0) } ?? p2.endIndex)])
                        eqC("\(L) ring inner", a1, ring.inner); eqC("\(L) ring outer", a2, ring.outer)
                    }
                }
            case "state-layer":
                eqR(L, wr, s.stateLayer)
                if ((w["display"] as? String) == "none") == s.stateLayerVisible { d("\(L) display web \(w["display"] ?? "") native \(s.stateLayerVisible)") }
                if abs(op - s.stateOpacity) > 1e-6 { d("\(L) opacity web \(op) native \(s.stateOpacity)") }
                if s.stateLayerVisible { eqC("\(L) bg", w["backgroundColor"] as? String ?? "", s.stateColor) }
            case "bubble", "dot":
                eqR(L, wr, s.bubble)
                eqC("\(L) bg", w["backgroundColor"] as? String ?? "", s.bubbleColor)
                if let fg = s.bubbleText { eqC("\(L) fg", w["color"] as? String ?? "", fg) }
                let tr = w["transform"] as? String ?? "none"
                let sc = tr == "none" ? 1 : Double(tr.dropFirst(7).split(separator: ",").first ?? "") ?? -1
                if abs(sc - s.scale) > 1e-6 { d("\(L) scale web \(tr) native \(s.scale)") }
                if (tr == "none") != s.transformNone { d("\(L) transform kind web \(tr) native none=\(s.transformNone)") }
                let bs = w["boxShadow"] as? String ?? "none"
                if (bs == "none") != (s.halo == nil) { d("\(L) halo web \(bs) native \(String(describing: s.halo))") }
                else if let h = s.halo, let close = bs.lastIndex(of: ")") {
                    eqC("\(L) halo", String(bs[...close]), h.color)
                    let spread = awcStepperPx(String(bs.split(separator: " ").last ?? "")) ?? -1
                    if abs(spread - h.spread) > 1e-3 { d("\(L) halo spread web \(bs) native \(h.spread)") }
                }
                if (w["text"] as? String) != s.number { d("\(L) text web \(w["text"] ?? "nil") native \(s.number ?? "nil")") }
                // border-radius (computed: px or %), clamped to the box like the painted shape.
                let rw = w["borderTopLeftRadius"] as? String ?? ""
                let wrad = Swift.min(rw.hasSuffix("%") ? (Double(rw.dropLast()) ?? 0) / 100 * s.bubbleSize : swPx(rw), s.bubbleSize / 2)
                if abs(wrad - Swift.min(s.bubbleRadius ?? .infinity, s.bubbleSize / 2)) > 1e-6 { d("\(L) radius web \(rw) native \(String(describing: s.bubbleRadius))") }
            case "text":
                eqR(L, wr, s.text ?? .zero); stepperBoxDiff(L, w, s.textBox, s.text ?? .zero, d)
                if abs(op - s.textOpacity) > 1e-6 { d("\(L) opacity web \(op) native \(s.textOpacity)") }
            case "label", "optional", "description":
                guard let line = s.lines.first(where: { $0.part == k }) else { d("\(L) missing"); continue }
                eqR(L, wr, line.rect)
                eqC("\(L) fg", w["color"] as? String ?? "", line.color)
                if (w["text"] as? String) != line.text { d("\(L) text web \(w["text"] ?? "nil") native \(line.text)") }
                if abs(swPx(w["fontSize"]) - line.fontSize) > 1e-6 { d("\(L) fontSize web \(w["fontSize"] ?? "") native \(line.fontSize)") }
                if abs(swPx(w["lineHeight"]) - line.lineHeight) > 1e-6 { d("\(L) lineHeight web \(w["lineHeight"] ?? "") native \(line.lineHeight)") }
                if (Double(w["fontWeight"] as? String ?? "") ?? 0) != line.weight { d("\(L) fontWeight web \(w["fontWeight"] ?? "") native \(line.weight)") }
                let wls = (w["letterSpacing"] as? String).flatMap { $0 == "normal" ? 0 : awcStepperPx($0) } ?? 0
                if abs(wls - line.letterSpacing) > 1e-6 { d("\(L) letterSpacing web \(w["letterSpacing"] ?? "") native \(line.letterSpacing)") }
            case "connector connector-trailing":
                guard let c = s.connector else { continue }
                eqR(L, wr, c.rect); eqC("\(L) bg", w["backgroundColor"] as? String ?? "", c.color)
            case "content":
                guard let pn = s.panel else { continue }
                eqR(L, wr, pn.rect)
                if (w["visibility"] as? String) != (pn.visible ? "visible" : "hidden") { d("\(L) visibility web \(w["visibility"] ?? "") native \(pn.visible)") }
                if abs(op - pn.opacity) > 1e-6 { d("\(L) opacity web \(op) native \(pn.opacity)") }
                eqC("\(L) bg", w["backgroundColor"] as? String ?? "", s.panelBackground ?? (0, 0, 0, 0))
                let gr = w["gridTemplateRows"] as? String ?? ""
                let gv = gr.hasSuffix("px") ? awcStepperPx(gr) : nil
                if (gv == nil) != (pn.gridRows == nil) || (gv != nil && abs(gv! - pn.gridRows!) > stepperTol) { d("\(L) gridTemplateRows web \(gr) native \(String(describing: pn.gridRows))") }
            case "actions":
                eqR(L, wr, s.actions ?? .zero)
            default: d("\(L) unexpected part")
            }
        }
    }
}

/// gate 7 (typed parts): the case's `::part` rules as data (`data-fa-parts` on the root: {"<tag>": {"<part>": {"<css>": "<value>"}}}).
func stepperCaseParts(_ html: String) -> ([AWCStepPart: AWCAccordionPartAppearance], [AWCStepperPart: AWCAccordionPartAppearance]) {
    guard let r = html.range(of: "data-fa-parts='"), let e = html[r.upperBound...].firstIndex(of: "'"),
          let all = try? JSONSerialization.jsonObject(with: Data(html[r.upperBound..<e].utf8)) as? [String: [String: [String: String]]] else { return ([:], [:]) }
    func px(_ v: String?) -> Double? { v.flatMap { Double($0.replacingOccurrences(of: "px", with: "").trimmingCharacters(in: .whitespaces)) } }
    func hex(_ v: String?) -> String? { v.map { $0.trimmingCharacters(in: .whitespaces).uppercased() } }
    func appearance(_ d: [String: String]) -> AWCAccordionPartAppearance {
        let radius = px(d["border-radius"]).map { AWCCornerShape(AWCCornerRadius(AWCCornerLength(points: $0))) }
        // padding: the CSS shorthand of one to four lengths; border: `<width> solid <colour>`.
        let pv = (d["padding"] ?? "").split(separator: " ").compactMap { px(String($0)) }
        var pad: AWCAccordionInsets? = nil
        switch pv.count {
        case 1: pad = AWCAccordionInsets(top: pv[0], right: pv[0], bottom: pv[0], left: pv[0])
        case 2: pad = AWCAccordionInsets(top: pv[0], right: pv[1], bottom: pv[0], left: pv[1])
        case 3: pad = AWCAccordionInsets(top: pv[0], right: pv[1], bottom: pv[2], left: pv[1])
        case 4: pad = AWCAccordionInsets(top: pv[0], right: pv[1], bottom: pv[2], left: pv[3])
        default: break
        }
        let bt = (d["border"] ?? "").split(separator: " ").map(String.init)
        let bwidth = bt.first.flatMap { px($0) }, bcolor = bt.last.flatMap { $0.hasPrefix("#") ? hex($0) : nil }
        return AWCAccordionPartAppearance(color: hex(d["color"]), backgroundColor: hex(d["background-color"]), borderColor: bcolor, borderWidth: bwidth, cornerShape: radius, padding: pad,
                                          gap: px(d["gap"]), fontSize: px(d["font-size"]), lineHeight: px(d["line-height"]),
                                          fontWeight: d["font-weight"].flatMap(Double.init), letterSpacing: px(d["letter-spacing"]))
    }
    let step = Dictionary(uniqueKeysWithValues: (all["md-step"] ?? [:]).compactMap { k, v in AWCStepPart(rawValue: k).map { ($0, appearance(v)) } })
    let stepper = Dictionary(uniqueKeysWithValues: (all["md-stepper"] ?? [:]).compactMap { k, v in AWCStepperPart(rawValue: k).map { ($0, appearance(v)) } })
    return (step, stepper)
}

func stepperInput(width: Double, dir: String, dark: Bool, density: Double, mk: StepperMarkup) -> AWCStepperLayoutInput {
    var input = AWCStepperLayoutInput(width: width)
    input.rtl = dir == "rtl"; input.dark = dark; input.globalDensity = density
    input.slotHeight = mk.slot ? 24 : nil            // the oracle's `.panel` div: Roboto 14px, line-height normal (16) + 4px padding × 2
    input.defaultContentHeight = 24
    input.tokens = dark ? StepperWebTokens.dark : StepperWebTokens.light
    input.hooks = mk.hooks
    return input
}

func stepperStripParts(_ html: String) -> String {
    html.replacingOccurrences(of: "<style>[^<]*</style>", with: "", options: .regularExpression)
        .replacingOccurrences(of: "\\s+data-fa-parts='[^']*'", with: "", options: .regularExpression)
}

final class StepperPaintCase {
    let c: [String: Any]
    init(_ c: [String: Any]) { self.c = c }
    func run() -> [String] {
        var diffs: [String] = []
        let mk = StepperMarkup(stepperStripParts(c["html"] as? String ?? ""))
        let m = AWCStepperModel()
        m.sync(mk.props, steps: mk.steps)
        if (c["name"] as? String ?? "").hasPrefix("focus-visible-header") { m.focusVisible = 0 }
        var input = stepperInput(width: (c["width"] as? NSNumber)?.doubleValue ?? 480, dir: c["dir"] as? String ?? "ltr", dark: (c["theme"] as? String) == "dark",
                                 density: (c["density"] as? NSNumber)?.doubleValue ?? 0, mk: mk)
        (input.stepParts, input.stepperParts) = stepperCaseParts(c["html"] as? String ?? "")
        // A bare text node in a step's panel (no `.panel` div): Roboto 16px, line-height normal = 19px (the oracle's own box).
        if (c["name"] as? String ?? "").hasPrefix("slotted-text") { input.defaultContentHeight = 19 }
        let paint = AWCStepperParts.applied(AWCStepperLayout.layout(m, input, measure: awcStepperCoreTextMeasure), step: input.stepParts, stepper: input.stepperParts)
        let box = swRect(c["box"])
        stepperTreeDiff(c["tree"] as? [String: Any] ?? [:], paint, m, ox: box.x, oy: box.y) { diffs.append($0) }
        return diffs
    }
}

// MARK: state runs

final class StepperStateRun {
    let r: [String: Any], reduced: Bool, name: String
    var diffs: [String] = []
    let m = AWCStepperModel(), motion = AWCStepperMotion()
    var pointer = AWCStepperPointer()
    var mk: StepperMarkup
    var input: AWCStepperLayoutInput
    var events: [(String, String)] = []
    init(_ r: [String: Any], reduced: Bool) {
        self.r = r; self.reduced = reduced; name = r["name"] as? String ?? ""
        mk = StepperMarkup(r["html"] as? String ?? "")
        input = stepperInput(width: swRect(r["box"]).width, dir: r["dir"] as? String ?? "ltr", dark: (r["theme"] as? String) == "dark", density: 0, mk: mk)
    }
    static let md: Set<String> = ["mdBeforeChange", "mdStepChange", "mdComplete", "mdStepClick", "mdStepNext", "mdStepBack"]
    func norm(_ v: Any?) -> String {
        guard let v, !(v is NSNull) else { return "null" }
        if let o = v as? [String: Any] { return "{" + o.keys.sorted().map { "\($0):\(norm(o[$0]))" }.joined(separator: ",") + "}" }
        if let n = v as? NSNumber { return String(format: "%g", n.doubleValue) }
        if let i = v as? Int { return String(i) }
        return "\(v)"
    }
    func layout(_ now: Double) -> AWCStepperPaint { AWCStepperLayout.layout(m, input, measure: awcStepperCoreTextMeasure, motion: motion, now: now, reduced: reduced, pointer: pointer) }

    func act(_ label: String) {
        func header(_ i: Int) { m.activateHeader(i) }
        if name.hasPrefix("horizontal-nav") || name.hasPrefix("mobile") || name == "before-change-cancel" {
            if label.hasPrefix("continue") || label == "finish" { m.next(); m.focus = .nav(1); return }
            if label == "back" { m.footerBack(); return }
        }
        if name.hasPrefix("vertical-panels") {
            let k = Int(String(label.first { $0.isNumber } ?? "0")) ?? 0
            if label.hasPrefix("continue") { m.stepNext(k) } else { m.stepBack(k) }
            return
        }
        let clicks: [String: Int] = ["click-future-blocked": 2, "click-past-allowed": 0, "click-last": 2, "click-first": 0, "click-after-disabled": 2, "click-review-blocked": 3, "click-header": 2]
        if ["linear-header-clicks", "nonlinear-header-clicks", "linear-disabled-skip", "readonly-click"].contains(name), let i = clicks[label] {
            m.focus = .header(i); m.focusVisible = nil; pointer.hover = i; pointer.pressed = nil; header(i); return
        }
        if name == "keyboard-headers" {
            if label.hasPrefix("tab") {
                var cur = -1
                if case .header(let h)? = m.focus { cur = h }
                let nxt = m.tabStops.first { $0 > cur }
                if let nxt { m.focus = .header(nxt); m.focusVisible = nxt }
                return
            }
            if label == "enter" || label == "space", case .header(let h)? = m.focus { header(h); return }
        }
        if name == "loading-next-disabled" {
            var p = m.p
            switch label {
            case "set-loading": p.loading = true
            case "next-disabled": p.loading = false; p.nextDisabled = true
            case "enable-and-continue": p.nextDisabled = false
            default: break
            }
            m.sync(p, steps: currentHostSteps)
            if label == "enable-and-continue" { m.next(); m.focus = .nav(1) }
            return
        }
        if name == "error-announce" {
            if label == "set-error" { m.setStepError(0, true, text: "Email is required") }
            if label == "clear-error" { m.setStepError(0, false) }
            return
        }
        if name.hasPrefix("lazy") { if label == "next" { m.next() }; return }
        if name == "methods" {
            switch label { case "goTo-2": m.goTo(2); case "prev": m.prev(); case "reset": m.reset(); default: break }
            return
        }
        if name == "header-pointer-states" {
            switch label {
            case "hover": pointer.hover = 1
            case "press": pointer.pressed = 1; m.focus = .header(1); m.focusVisible = nil
            case "release": pointer.pressed = nil; header(1)
            default: break
            }
            return
        }
        diffs.append("no action for \(name) \(label)")
    }
    /// The host's steps as authored (the model keeps its own completed / error writes across a sync).
    var currentHostSteps: [AWCStepProps] { mk.steps }

    func run() -> [String] {
        m.emit = { [unowned self] n, d, cancelable in
            events.append((n, norm(d)))
            if n == "mdBeforeChange", name == "before-change-cancel", (d?["index"] as? Int) == 1 { return false }
            return true
        }
        m.sync(mk.props, steps: mk.steps)
        _ = layout(-1e6)
        let phases = r["phases"] as? [[String: Any]] ?? [], anims = r["anims"] as? [[String: Any]] ?? []
        let webEvents = (r["events"] as? [[String: Any]] ?? []).filter { Self.md.contains($0["name"] as? String ?? "") }
        func num(_ v: Any?) -> Double? { (v as? NSNumber)?.doubleValue }
        for (pi, ph) in phases.enumerated() {
            let label = ph["label"] as? String ?? ""
            let t0 = num(ph["t"]) ?? 0, t1 = pi + 1 < phases.count ? num(phases[pi + 1]["t"]) ?? .infinity : .infinity
            let liveBefore = [m.live, m.errorLive]
            let mark = motion.started.count
            act(label)
            let samples = ph["samples"] as? [[String: Any]] ?? []
            // The step change starts its transitions on one frame (pointer state layers are checked in the phase-end snapshot).
            let starts = anims.filter { a in let t = a["target"] as? String ?? ""; return t.hasPrefix("md-step[") && !t.contains("state-layer") }
                .compactMap { num($0["startTime"]) }.filter { $0 >= t0 - 1e-6 && $0 < t1 }
            let evs = webEvents.compactMap { num($0["t"]) }.filter { $0 >= t0 - 1e-6 && $0 < t1 }
            var change: Double? = starts.min()
            if change == nil, let last = evs.max() { change = samples.compactMap { num($0["t"]) }.first { $0 > last - 0.05 } }
            if change == nil && evs.isEmpty { change = samples.first.flatMap { num($0["t"]) } ?? t0 }
            var applied = false
            for sm in samples {
                guard let t = num(sm["t"]) else { continue }
                if !applied, let change, t >= change - 0.05 { _ = layout(change); applied = true }
                // (The oracles have no sample before a phase's change frame.)
                guard applied else { diffs.append("\(label)#\(pi)@\(t) sample before the change frame"); continue }
                let wins = [layout(t - 0.1), layout(t + 0.1), layout(t)]
                compare("\(label)#\(pi)@\(String(format: "%.1f", t))", sm, wins, prevLive: change.map { t < $0 + 17 } == true ? liveBefore : nil)
            }
            if !applied, let change { _ = layout(change) }
            let snapT = (samples.last.flatMap { num($0["t"]) } ?? t0) + 16.7
            let snapPaint = layout(snapT)
            if !motion.active(snapT), let snap = ph["snap"] as? [String: Any] {
                let box = swRect(r["box"])
                stepperTreeDiff(snap, snapPaint, m, ox: box.x, oy: box.y) { diffs.append("\(label)#\(pi) snap \($0)") }
            }
            // Keyframe animations started in this phase (glyph-in, lazy content-enter, error pulse) by step, as Chrome ran them.
            let names = ["glyph": "md-step-glyph-in", "content": "md-step-content-enter", "pulse": "md-step-error-pulse"]
            let mine = motion.started[mark...].compactMap { st -> String? in
                let parts = st.key.dropFirst().split(separator: ".")
                guard parts.count == 2, let n = names[String(parts[1])] else { return nil }
                return "\(n) s\(parts[0])"
            }.sorted()
            let web = anims.compactMap { a -> String? in
                guard let n = a["property"] as? String, names.values.contains(n), let st = num(a["startTime"]), st >= t0 - 1e-6, st < t1 else { return nil }
                let target = a["target"] as? String ?? ""
                guard let open = target.firstIndex(of: "["), let close = target.firstIndex(of: "]") else { return nil }
                let lab = String(target[target.index(after: open)..<close])
                return "\(n) s\(mk.steps.firstIndex { $0.label == lab } ?? -1)"
            }.sorted()
            if mine != web { diffs.append("\(label)#\(pi) keyframe animations web \(web) native \(mine)") }
        }
        let web = webEvents.map { ($0["name"] as? String ?? "") + " " + norm($0["detail"]) }
        let mine = events.map { $0.0 + " " + $0.1 }
        if web != mine { diffs.append("events web \(web) native \(mine)") }
        return diffs
    }

    func compare(_ tag: String, _ sm: [String: Any], _ wins: [AWCStepperPaint], prevLive: [String]?) {
        func within(_ l: String, _ web: Double, _ vals: [Double], _ tol: Double) {
            if web < (vals.min() ?? 0) - tol || web > (vals.max() ?? 0) + tol { diffs.append("\(tag) \(l) web \(web) native \(vals.last ?? .nan)") }
        }
        func num(_ v: Any?) -> Double? { (v as? NSNumber)?.doubleValue }
        if (sm["active"] as? Int) != m.active { diffs.append("\(tag) active web \(sm["active"] ?? "") native \(m.active)") }
        within("h", num(sm["h"]) ?? -1, wins.map(\.host.height), stepperTol)
        let live = sm["live"] as? [String] ?? []
        if live != [m.live, m.errorLive] && !(prevLive != nil && live == prevLive!) { diffs.append("\(tag) live web \(live) native \([m.live, m.errorLive])") }
        for (i, ws) in (sm["steps"] as? [[String: Any]] ?? []).enumerated() where i < m.count {
            if (ws["active"] as? Bool) != m.isActive(i) || (ws["completed"] as? Bool) != m.steps[i].completed {
                diffs.append("\(tag) s\(i) active/completed web \(ws["active"] ?? "")/\(ws["completed"] ?? "") native \(m.isActive(i))/\(m.steps[i].completed)")
            }
            let ss = wins.map { $0.steps[i] }
            let bg = swColor(ws["bubbleBg"] as? String ?? "")
            within("s\(i) bg.r", bg.r * 255, ss.map { $0.bubbleColor.r * 255 }, 1.01)
            within("s\(i) bg.g", bg.g * 255, ss.map { $0.bubbleColor.g * 255 }, 1.01)
            within("s\(i) bg.b", bg.b * 255, ss.map { $0.bubbleColor.b * 255 }, 1.01)
            let tr = ws["bubbleTransform"] as? String ?? "none"
            within("s\(i) scale", tr == "none" ? 1 : Double(tr.dropFirst(7).split(separator: ",").first ?? "") ?? -1, ss.map(\.scale), 2e-4)
            if !ss.map(\.transformNone).contains(tr == "none") { diffs.append("\(tag) s\(i) transform web \(tr) native none=\(ss.last!.transformNone)") }
            if let bw = num(ws["bubbleW"]) { within("s\(i) bubbleW", bw, ss.map(\.bubble.width), 2e-3) }
            let fill = ws["fill"] as? String
            if (fill == nil) != (ss.last!.connector == nil) { diffs.append("\(tag) s\(i) connector web \(fill ?? "nil") native \(ss.last!.connector != nil)") }
            else if let fill, let c = ss.last!.connector {
                let v = fill.dropFirst(7).dropLast().split(separator: ",").map { Double($0.trimmingCharacters(in: .whitespaces)) ?? -1 }
                within("s\(i) fill", c.vertical ? v[3] : v[0], ss.compactMap { $0.connector?.fill }, 2e-4)
            }
            let ph = num(ws["panelH"])
            if (ph == nil) != (ss.last!.panel == nil) { diffs.append("\(tag) s\(i) panel web \(String(describing: ph)) native \(ss.last!.panel != nil)") }
            else if let ph {
                within("s\(i) panelH", ph, ss.compactMap { $0.panel?.rect.height }, stepperTol)
                let vis = (ws["panelVis"] as? String) == "visible"
                if !ss.compactMap({ $0.panel?.visible }).contains(vis) { diffs.append("\(tag) s\(i) panelVis web \(vis) native \(ss.last!.panel!.visible)") }
            }
        }
    }
}

@main enum NativeStepperIntegration {
    static func load(_ dir: String, _ names: [String]) -> [String: Any]? {
        for n in names {
            if let data = try? Data(contentsOf: URL(fileURLWithPath: dir).appendingPathComponent(n)),
               let root = try? JSONSerialization.jsonObject(with: data) as? [String: Any] { return root }
        }
        return nil
    }
    static func main() {
        let dir = CommandLine.arguments.dropFirst().first ?? awcStepperTestsDir.appendingPathComponent("Fixtures/stepper-web-oracle").path
        var total = 0, passed = 0
        let rungs = StepperWebTokens.checkRungs()
        total += 1; if rungs.isEmpty { passed += 1; print("density rungs: tokens.css = AWCStepperTheme.rungs") } else { rungs.forEach { print("FAIL " + $0) } }
        for (files, title, required) in [(["web-paint.json", "paint.json"], "paint", true), (["web-paint-extra.json"], "paint (extra)", false), (["web-paint-extra2.json"], "paint (extra2)", false)] {
            guard let root = load(dir, files), let cases = root["cases"] as? [[String: Any]] else {
                if required { print("missing \(dir)/\(files[0])"); total += 1 }
                continue
            }
            var ok = 0
            for c in cases {
                let d = StepperPaintCase(c).run(); total += 1
                if d.isEmpty { ok += 1; passed += 1 } else { print("FAIL \(c["name"] ?? "?") (\(title))"); d.prefix(10).forEach { print("   " + $0) } }
            }
            print("md-stepper \(title): \(ok)/\(cases.count)")
        }
        // R6-11: the duration-hook runs (web-states-extra*.json) when the oracle folder has them.
        for (file, reduced) in [(["web-states.json", "states.json"], false), (["web-states-reduced.json", "states-reduced.json"], true),
                                (["web-states-extra.json"], false), (["web-states-extra-reduced.json"], true)] {
            guard let root = load(dir, file), let runs = root["runs"] as? [[String: Any]] else {
                if file[0].contains("-extra") { continue }
                print("missing \(dir)/\(file[0])"); total += 1; continue }
            var ok = 0
            for r in runs {
                let d = StepperStateRun(r, reduced: reduced).run(); total += 1
                if d.isEmpty { ok += 1; passed += 1 } else { print("FAIL \(r["name"] ?? "?") (\(file[0]))"); d.prefix(12).forEach { print("   " + $0) } }
            }
            print("md-stepper \(file[0]): \(ok)/\(runs.count)")
        }
        print("NativeStepperIntegration: \(passed)/\(total) identical")
        exit(passed == total ? 0 : 1)
    }
}
