import AppKit
import SwiftUI
import Observation
@testable import AWCUI

// fa (gate 7, R6-05): the rendered SwiftUI views of md-slider, md-rating and md-stepper / md-step against Mac Chrome 153 —
// every paint case of the oracles (paint, the extras with ::part rules, the inset-icon slot and the hooks) is rendered by the
// dedicated view (AWCNativeSliderView / AWCNativeRatingView / AWCNativeStepper with its native md-buttons) at the oracle's host
// box, in an offscreen NSHostingView: the rendered host size must equal Chrome's host box, and every flat CSS pixel of the clip
// (host + 8 px; glyph / text / antialiased edges excluded in either image) must match Chrome's shot — so boxes, colours, the
// slot, the buttons and the placement of every text run (a misplaced run turns Chrome's flat pixels into ink) are measured
// on the views, not on the layout model. Usage: NativeFaViewsIntegration [<outputs/native-parity> [name filter]]
// (AWC_FA_CAPTURE_DIRECTORY: write the native captures).

// MARK: markup (the oracle html: elements with quoted / bare attributes and text)

final class FaNode {
    let tag: String; var attrs: [String: String]; var children: [FaNode] = []; var text = ""
    init(_ tag: String, _ attrs: [String: String]) { self.tag = tag; self.attrs = attrs }
    func first(_ t: String) -> FaNode? { tag == t ? self : children.lazy.compactMap { $0.first(t) }.first }
    var allText: String { tag == "#text" ? text : children.map(\.allText).joined(separator: " ") }
}
func faParse(_ raw: String) -> FaNode {
    let html = raw.replacingOccurrences(of: "<style>[^<]*</style>", with: "", options: .regularExpression)
    let s = Array(html), root = FaNode("#root", [:]); var stack = [root], i = 0
    while i < s.count {
        if s[i] == "<" {
            if i + 1 < s.count && s[i + 1] == "/" {
                var j = i; while j < s.count && s[j] != ">" { j += 1 }
                let name = String(s[(i + 2)..<min(j, s.count)]).trimmingCharacters(in: .whitespaces).lowercased()
                if let k = stack.lastIndex(where: { $0.tag == name }), k > 0 { stack.removeSubrange(k...) }
                i = j + 1; continue
            }
            var j = i + 1, name = ""
            while j < s.count, !s[j].isWhitespace, s[j] != ">", s[j] != "/" { name.append(s[j]); j += 1 }
            var attrs: [String: String] = [:], selfClosing = false
            while j < s.count && s[j] != ">" {
                if s[j].isWhitespace { j += 1; continue }
                if s[j] == "/" { selfClosing = true; j += 1; continue }
                var k = ""; while j < s.count, !s[j].isWhitespace, s[j] != "=", s[j] != ">", s[j] != "/" { k.append(s[j]); j += 1 }
                var v = ""
                if j < s.count && s[j] == "=" {
                    j += 1
                    if j < s.count && (s[j] == "\"" || s[j] == "'") { let q = s[j]; j += 1; while j < s.count && s[j] != q { v.append(s[j]); j += 1 }; j += 1 }
                    else { while j < s.count, !s[j].isWhitespace, s[j] != ">" { v.append(s[j]); j += 1 } }
                }
                if !k.isEmpty { attrs[k] = v; selfClosing = false }
            }
            i = j + 1
            let n = FaNode(name.lowercased(), attrs); stack.last!.children.append(n)
            if !selfClosing && !["br", "img", "input", "circle", "path", "rect"].contains(n.tag) { stack.append(n) }
            continue
        }
        var t = ""; while i < s.count && s[i] != "<" { t.append(s[i]); i += 1 }
        let tt = t.trimmingCharacters(in: .whitespacesAndNewlines)
        if !tt.isEmpty { let n = FaNode("#text", [:]); n.text = tt.replacingOccurrences(of: "&amp;", with: "&"); stack.last!.children.append(n) }
    }
    return root
}
/// Attributes → AWC node properties (camelCase; boolean attributes; the numeric properties of the three components).
let faNumeric: Set<String> = ["value", "min", "max", "step", "valueStart", "valueEnd", "precision", "density", "active", "defaultValue"]
func faProps(_ a: [String: String]) -> [String: AWCValue] {
    var p: [String: AWCValue] = [:]
    for (k, v) in a where !k.hasPrefix("data-") && !["class", "slot", "id", "for", "aria-label"].contains(k) {
        let parts = k.split(separator: "-").map(String.init)
        let key = parts[0] + parts.dropFirst().map { $0.prefix(1).uppercased() + $0.dropFirst() }.joined()
        if v.isEmpty && key != "style" { p[key] = .bool(true) }
        else if v == "true" || v == "false" { p[key] = .bool(v == "true") }
        else if faNumeric.contains(key), let d = Double(v) { p[key] = .number(d) }
        else { p[key] = .string(v) }
    }
    if let l = a["aria-label"] { p["sliderAriaLabel"] = .string(l); p["ariaLabel"] = .string(l) }
    return p
}
/// The case's `::part` rules as data (`data-fa-parts`: {"<tag>": {"<part>": {"<css>": "<value>"}}}).
func faParts(_ html: String, _ tag: String) -> [String: AWCAccordionPartAppearance] {
    guard let r = html.range(of: "data-fa-parts='"), let e = html[r.upperBound...].firstIndex(of: "'"),
          let all = try? JSONSerialization.jsonObject(with: Data(html[r.upperBound..<e].utf8)) as? [String: [String: [String: String]]],
          let parts = all[tag] else { return [:] }
    func px(_ v: String?) -> Double? { v.flatMap { Double($0.replacingOccurrences(of: "px", with: "").trimmingCharacters(in: .whitespaces)) } }
    func hex(_ v: String?) -> String? { v.map { $0.trimmingCharacters(in: .whitespaces).uppercased() } }
    return parts.mapValues { d in
        // padding: the CSS shorthand of one to four lengths; border: `<width> solid <colour>` (story 5-3).
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
        return AWCAccordionPartAppearance(color: hex(d["color"]), backgroundColor: hex(d["background-color"]),
                                   borderColor: bt.last.flatMap { $0.hasPrefix("#") ? hex($0) : nil }, borderWidth: bt.first.flatMap { px($0) },
                                   cornerShape: px(d["border-radius"]).map { AWCCornerShape(AWCCornerRadius(AWCCornerLength(points: $0))) },
                                   padding: pad,
                                   width: px(d["width"]), height: px(d["height"]), opacity: d["opacity"].flatMap(Double.init), gap: px(d["gap"]),
                                   fontSize: px(d["font-size"]), lineHeight: px(d["line-height"]), fontWeight: d["font-weight"].flatMap(Double.init),
                                   letterSpacing: px(d["letter-spacing"]))
    }
}
struct FaBareText: View {
    let text: String, ink: Color
    // The production `#text` node of the shared renderer (story 5-3: its paragraph direction is the layout direction), not a copy of it.
    var body: some View {
        AWCNativeView(node: AWCNode.text(text)).environment(\.awcTextInk, ink).font(AWCNativeFonts.label(size: 16, weight: 400)).frame(maxWidth: .infinity, alignment: .leading)
    }
}
func faHex(_ s: String) -> Color {
    let c = awcStepperColor(s) ?? (0, 0, 0, 1)
    return Color(.sRGB, red: c.r, green: c.g, blue: c.b, opacity: c.a)
}
func faStyle(_ s: String) -> [String: String] {
    var o: [String: String] = [:]
    for d in s.split(separator: ";") { let kv = d.split(separator: ":", maxSplits: 1).map { $0.trimmingCharacters(in: .whitespaces) }; if kv.count == 2 { o[kv[0]] = kv[1] } }
    return o
}

// MARK: fixture

@Observable final class FaViewsState {
    var epoch = 0
    var content = AnyView(EmptyView())
    var dark = false
    var rtl = false
    var density = 0.0
    var origin = CGPoint.zero
    var width: Double? = nil
    var height: Double? = nil
    var viewport = 1200.0   // the oracle case's viewport width: the input an app would take from its window scene
    var background = Color.white
    var size = CGSize.zero
    var rootID = ""
    var measurements: [AWCNativeInspectionNode] = []
}
struct FaSizeKey: PreferenceKey { static let defaultValue = CGSize.zero; static func reduce(value: inout CGSize, nextValue: () -> CGSize) { value = nextValue() } }
struct FaViewsFixture: View {
    let state: FaViewsState
    var body: some View {
        let epoch = state.epoch
        ZStack(alignment: .topLeading) {
            state.content
                .background(GeometryReader { g in Color.clear.preference(key: FaSizeKey.self, value: g.size) })
                .environment(\.layoutDirection, state.rtl ? .rightToLeft : .leftToRight)
                .environment(\.awcNativeDensity, state.density)
                .environment(\.awcStepperSettled, true)
                .environment(\.awcViewportWidth, state.viewport)
                .frame(width: state.width.map { CGFloat($0) }, height: state.height.map { CGFloat($0) }, alignment: .topLeading)
                .offset(x: state.origin.x, y: state.origin.y)
        }
        .onPreferenceChange(FaSizeKey.self) { s in if state.epoch == epoch { state.size = s } }
        .awcTheme(AWCTheme.generated(dark: state.dark))
        // The views' own inspection (awcInspect): the rendered host box in the fixture's coordinates (the breadcrumbs fixture's way).
        .awcNativeInspection(rootID: state.rootID, coordinateSpace: "fa-views") { m in if state.epoch == epoch { state.measurements = m } }
        .id(epoch)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(state.background).coordinateSpace(name: "fa-views")
    }
}
struct FaGrid {
    let x: Int, y: Int, w: Int, h: Int; var values: [Double]
    func at(_ px: Int, _ py: Int) -> [Double] { let i = ((py - y) * w + (px - x)) * 3; return [values[i], values[i + 1], values[i + 2]] }
    func flat(_ px: Int, _ py: Int, _ limit: Double) -> Bool {
        guard px - 1 >= x && py - 1 >= y && px + 1 < x + w && py + 1 < y + h else { return false }
        for c in 0..<3 { var lo = 999.0, hi = -1.0
            for dy in -1...1 { for dx in -1...1 { let v = values[((py + dy - y) * w + (px + dx - x)) * 3 + c]; lo = min(lo, v); hi = max(hi, v) } }
            if hi - lo > limit { return false } }
        return true
    }
    // Whole-grid passes through unchecked pointers (the fixture is built without optimisation and compares ~30 M pixels).
    /// `flat(px, py, limit)` for every pixel (row-major, the border false).
    func flatMask(_ limit: Double) -> [Bool] {
        var out = [Bool](repeating: false, count: w * h)
        guard w > 2, h > 2 else { return out }
        values.withUnsafeBufferPointer { vb in out.withUnsafeMutableBufferPointer { ob in
            let v = vb.baseAddress!, o = ob.baseAddress!
            for py in 1..<(h - 1) { for px in 1..<(w - 1) {
                var ok = true, c = 0
                while ok && c < 3 {
                    var lo = 999.0, hi = -1.0, dy = -1
                    while dy <= 1 {
                        let r = ((py + dy) * w + px - 1) * 3 + c, a = v[r], b = v[r + 3], d = v[r + 6]
                        if a < lo { lo = a }; if a > hi { hi = a }; if b < lo { lo = b }; if b > hi { hi = b }; if d < lo { lo = d }; if d > hi { hi = d }
                        dy += 1
                    }
                    if hi - lo > limit { ok = false }
                    c += 1
                }
                o[py * w + px] = ok } } } }
        return out
    }
    /// Pixels more than `limit` off `bg` in any channel.
    func inkMask(_ bg: [Double], _ limit: Double) -> [Bool] {
        var out = [Bool](repeating: false, count: w * h)
        let b0 = bg[0], b1 = bg[1], b2 = bg[2]
        values.withUnsafeBufferPointer { vb in out.withUnsafeMutableBufferPointer { ob in
            let v = vb.baseAddress!, o = ob.baseAddress!
            for i in 0..<(w * h) { let j = i * 3; o[i] = abs(v[j] - b0) > limit || abs(v[j + 1] - b1) > limit || abs(v[j + 2] - b2) > limit } } }
        return out
    }
}
/// A mask grown by one pixel in every direction.
func faDilate(_ m: [Bool], _ w: Int, _ h: Int) -> [Bool] {
    var out = m
    m.withUnsafeBufferPointer { mb in out.withUnsafeMutableBufferPointer { ob in
        let a = mb.baseAddress!, o = ob.baseAddress!
        for py in 0..<h { for px in 0..<w where a[py * w + px] {
            let y0 = max(0, py - 1), y1 = min(h - 1, py + 1), x0 = max(0, px - 1), x1 = min(w - 1, px + 1)
            var y = y0; while y <= y1 { var x = x0; while x <= x1 { o[y * w + x] = true; x += 1 }; y += 1 } } } } }
    return out
}

@main @MainActor enum NativeFaViewsIntegration {
    static let state = FaViewsState()
    static var host: NSHostingView<FaViewsFixture>!, window: NSWindow!
    static var total = 0, passed = 0, skipped: [String] = []
    static var suitePixels = 0, suiteBad = 0, suiteSum = 0.0, suiteInk = 1.0
    static func pump(_ duration: Double) { let end = Date().addingTimeInterval(duration); repeat { while let e = NSApp.nextEvent(matching: .any, until: .distantPast, inMode: .default, dequeue: true) { NSApp.sendEvent(e) }; host.layoutSubtreeIfNeeded(); host.displayIfNeeded(); RunLoop.current.run(until: Date().addingTimeInterval(0.004)) } while Date() < end }
    static func grid(_ cg: CGImage, scale k: Int, ox: Int, oy: Int, x: Int, y: Int, w: Int, h: Int) -> FaGrid {
        var values = [Double](repeating: -999, count: w * h * 3)
        let crop = CGRect(x: (x - ox) * k, y: (y - oy) * k, width: w * k, height: h * k)
        guard let c = cg.cropping(to: crop), c.width == w * k, c.height == h * k else { return .init(x: x, y: y, w: w, h: h, values: values) }
        var buffer = [UInt8](repeating: 0, count: c.width * c.height * 4)
        buffer.withUnsafeMutableBytes { raw in
            let ctx = CGContext(data: raw.baseAddress, width: c.width, height: c.height, bitsPerComponent: 8, bytesPerRow: c.width * 4, space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
            ctx.draw(c, in: .init(x: 0, y: 0, width: c.width, height: c.height))
        }
        let n = Double(k * k)
        let cwid = c.width
        buffer.withUnsafeBufferPointer { bb in values.withUnsafeMutableBufferPointer { vb in
            let b = bb.baseAddress!, v = vb.baseAddress!
            for py in 0..<h { for px in 0..<w { var s0 = 0.0, s1 = 0.0, s2 = 0.0
                for yy in (py * k)..<(py * k + k) { for xx in (px * k)..<(px * k + k) { let i = (yy * cwid + xx) * 4; s0 += Double(b[i]); s1 += Double(b[i + 1]); s2 += Double(b[i + 2]) } }
                let o = (py * w + px) * 3; v[o] = s0 / n; v[o + 1] = s1 / n; v[o + 2] = s2 / n } } } }
        return .init(x: x, y: y, w: w, h: h, values: values)
    }
    static func capture(_ r: CGRect) -> (CGImage, Int)? {
        let rr = host.isFlipped ? r : CGRect(x: r.minX, y: host.bounds.height - r.maxY, width: r.width, height: r.height)
        guard let b = host.bitmapImageRepForCachingDisplay(in: rr) else { return nil }
        host.cacheDisplay(in: rr, to: b)
        guard let cg = b.cgImage else { return nil }
        return (cg, max(1, Int((Double(b.pixelsWide) / r.width).rounded())))
    }

    /// The view of one case (nil: not renderable statically, with the reason).
    static func content(_ tag: String, _ c: [String: Any]) -> (AnyView, String?) {
        let html = c["html"] as? String ?? "", root = faParse(html), name = c["name"] as? String ?? ""
        guard let el = root.first(tag) else { return (AnyView(EmptyView()), "no <\(tag)>") }
        let defaults = AWCComponentCatalog.defaults[tag] ?? [:]
        var props = defaults.merging(faProps(el.attrs)) { _, new in new }
        switch tag {
        case "md-slider":
            if name.hasPrefix("vertical-full-height-") { props["fullHeight"] = .bool(true) }
            let insetSize: Double = props["size"]?.string == "xl" ? 32 : 24
            var slot: AnyView? = nil
            if let s = el.children.first(where: { $0.attrs["slot"] == "inset-icon" }) {
                if s.tag == "svg" {
                    let w = Double(s.attrs["width"] ?? "") ?? insetSize, h = Double(s.attrs["height"] ?? "") ?? insetSize
                    let vb = (s.attrs["viewBox"] ?? "0 0 \(w) \(h)").split(separator: " ").compactMap { Double($0) }
                    let circles = s.children.filter { $0.tag == "circle" }
                    slot = AnyView(Canvas { ctx, size in
                        let sx = size.width / (vb.count == 4 ? vb[2] : w), sy = size.height / (vb.count == 4 ? vb[3] : h)
                        for ci in circles {
                            let cx = (Double(ci.attrs["cx"] ?? "") ?? 0) * sx, cy = (Double(ci.attrs["cy"] ?? "") ?? 0) * sy, r = (Double(ci.attrs["r"] ?? "") ?? 0) * sx
                            ctx.fill(Circle().path(in: CGRect(x: cx - r, y: cy - r, width: 2 * r, height: 2 * r)), with: .foreground)
                        }
                    }.frame(width: w, height: h))
                } else if let st = s.attrs["style"].map(faStyle), st["width"] != nil {
                    let w = Double((st["width"] ?? "").replacingOccurrences(of: "px", with: "")) ?? 0, h = Double((st["height"] ?? "").replacingOccurrences(of: "px", with: "")) ?? 0
                    let r = Double((st["border-radius"] ?? "0").replacingOccurrences(of: "px", with: "")) ?? 0
                    slot = AnyView(RoundedRectangle(cornerRadius: r).fill(faHex(st["background"] ?? "#000")).frame(width: w, height: h))
                } else {
                    slot = AnyView(AWCMaterialSymbol(s.allText, size: CGFloat(insetSize)))   // a Material Symbols ligature span
                }
            }
            var v = AnyView(AWCNativeSliderView(nodeID: "fa-slider", properties: props, set: { _, _ in }, emit: { _, _ in }, insetContent: slot))
            for (k, a) in faParts(html, tag) { if let p = AWCSliderPart(rawValue: k) { v = AnyView(v.awcSliderPartAppearance(a, part: p)) } }
            return (v, nil)
        case "md-rating":
            if name.hasPrefix("focus-visible") || name.hasPrefix("hook-focus-ring") { return (AnyView(EmptyView()), "keyboard focus (focus-visible) is a runtime state: covered by the states replays") }
            var v = AnyView(AWCNativeRatingView(nodeID: "fa-rating", properties: props, set: { _, _ in }, emit: { _, _ in }))
            if name == "label-getlabel" {
                // The page's getLabel (the parity harness's names) through the public AWCRatingController.getLabel.
                let controller = AWCRatingController()
                controller.getLabel = { v in let names = ["Awful", "Poor", "Fair", "Good", "Great", "Superb"]
                    return v.truncatingRemainder(dividingBy: 1) == 0 && v >= 0 && Int(v) < names.count ? names[Int(v)] : String(v) }
                v = AnyView(v.awcRatingController(controller))
            }
            for (k, a) in faParts(html, tag) { if let p = AWCRatingPart(rawValue: k) { v = AnyView(v.awcRatingPartAppearance(a, part: p)) } }
            return (v, nil)
        default:
            if name.hasPrefix("focus-visible") { return (AnyView(EmptyView()), "keyboard focus (focus-visible) is a runtime state: covered by the states replays") }
            let dark = (c["theme"] as? String) == "dark"
            func panel(_ n: FaNode, slot: String? = nil) -> AWCNode {
                AWCNode(tag: "div", properties: ["text": .string(n.allText)], slot: slot)
            }
            let steps = el.children.filter { $0.tag == "md-step" }.enumerated().map { k, s in
                AWCNode(id: "fa-step-\(k)", tag: "md-step", properties: (AWCComponentCatalog.defaults["md-step"] ?? [:]).merging(faProps(s.attrs)) { _, new in new },
                        children: s.children.filter { $0.tag != "#text" || !$0.text.trimmingCharacters(in: .whitespaces).isEmpty }
                            .map { $0.tag == "#text" ? AWCNode(tag: "#text", properties: ["text": .string($0.text)]) : panel($0) })
            }
            let slotted = el.children.filter { $0.attrs["slot"] == "content" }.map { panel($0, slot: "content") }
            let node = AWCNode(id: "fa-stepper", tag: "md-stepper", properties: props, children: steps + slotted)
            let ink = dark ? faHex("#E6E0E9") : faHex("#1C1B1F")
            // The `.panel` div inherits dir=rtl: its paragraph is right-to-left whatever its first letter (U+200F starts it).
            let rlm = (c["dir"] as? String) == "rtl" ? "\u{200F}" : ""
            var v = AnyView(AWCNativeStepper(node: node, properties: props, theme: AWCTheme.generated(dark: dark), setActive: { _ in },
                                             dispatch: { _, _, _, _, _ in true },
                                             renderChild: { n in
                                                 // a bare text node of the panel: the product's #text path (the element's dir sets the paragraph direction)
                                                 if n.tag == "#text" { return AnyView(FaBareText(text: n.properties["text"]?.string ?? "", ink: ink)) }
                                                 // the oracle's `.panel` div: Roboto 14px, line-height normal (16), 4px block padding
                                                 return AnyView(Text(rlm + (n.properties["text"]?.string ?? "")).font(AWCNativeFonts.label(size: 14, weight: 400)).foregroundStyle(ink)
                                                    .lineLimit(1).frame(height: 16, alignment: .top).padding(.vertical, 4).frame(maxWidth: .infinity, alignment: .leading))
                                             }))
            for (k, a) in faParts(html, "md-step") { if let p = AWCStepPart(rawValue: k) { v = AnyView(v.awcStepPartAppearance(a, part: p)) } }
            for (k, a) in faParts(html, "md-stepper") { if let p = AWCStepperPart(rawValue: k) { v = AnyView(v.awcStepperPartAppearance(a, part: p)) } }
            return (v, nil)
        }
    }

    static func run(_ tag: String, _ c: [String: Any], shots: URL, title: String) -> Bool? {
        let name = c["name"] as? String ?? ""
        let (view, skip) = content(tag, c)
        if let skip { skipped.append("\(title) \(name): \(skip)"); return nil }
        let tree = c["tree"] as? [String: Any] ?? [:], r = tree["rect"] as? [String: Any] ?? [:]
        func n(_ d: [String: Any], _ k: String) -> Double { (d[k] as? NSNumber)?.doubleValue ?? 0 }
        let hx = n(r, "x"), hy = n(r, "y"), hw = n(r, "width"), hh = n(r, "height")
        guard let src = NSImage(contentsOf: shots.appendingPathComponent(name + ".png"))?.cgImage(forProposedRect: nil, context: nil, hints: nil) else { print("FAIL \(name) (\(title)): no Chrome shot"); return false }
        let clip = c["clip"] as? [String: Any] ?? [:], cx = Int(n(clip, "x")), cy = Int(n(clip, "y")), cw = Int(n(clip, "width")), ch = Int(n(clip, "height"))
        let web = grid(src, scale: 1, ox: cx, oy: cy, x: cx, y: cy, w: cw, h: ch)
        // The page background (Chrome's body: surface) from the clip corner, outside the host.
        let bg = web.at(cx + 1, cy + 1)
        state.content = view; state.dark = (c["theme"] as? String) == "dark"; state.rtl = (c["dir"] as? String) == "rtl"
        var density = (c["density"] as? NSNumber)?.doubleValue ?? 0
        if name.hasPrefix("density-scale-"), let k = Double(String(name.dropFirst("density-scale-".count).prefix(1))) { density = -k }
        state.density = density
        state.viewport = ((c["viewport"] as? [NSNumber])?.first?.doubleValue) ?? 1200
        let html = c["html"] as? String ?? ""
        let marginTop: Double = tag == "md-stepper" && html.contains("variant=\"mobile\"") && html.contains("slot=\"content\"") ? 24 : 0
        state.origin = CGPoint(x: hx, y: hy - marginTop)
        state.width = tag == "md-rating" ? nil : hw
        state.height = name.hasPrefix("vertical-full-height-") ? hh : nil
        state.background = Color(.sRGB, red: bg[0] / 255, green: bg[1] / 255, blue: bg[2] / 255, opacity: 1)
        state.size = .zero; state.measurements = []; state.rootID = tag == "md-slider" ? "fa-slider" : tag == "md-rating" ? "fa-rating" : "fa-stepper"; state.epoch += 1
        pump(tag == "md-stepper" ? 0.6 : 0.35)
        var diffs: [String] = []
        // The rendered host box: the view's inspection node (else the GeometryReader size at the oracle origin).
        let hostNode = state.measurements.first { $0.name == tag }
        let nb = hostNode.map { CGRect(x: Double($0.bounds.minX), y: Double($0.bounds.minY) + marginTop, width: Double($0.bounds.width), height: Double($0.bounds.height) - marginTop) }
            ?? CGRect(x: hx, y: hy, width: Double(state.size.width), height: Double(state.size.height) - marginTop)
        if abs(Double(nb.minX) - hx) > 0.75 || abs(Double(nb.minY) - hy) > 0.75 || abs(Double(nb.width) - hw) > 0.75 || abs(Double(nb.height) - hh) > 0.75 {
            diffs.append("host box web (\(hx), \(hy), \(hw), \(hh)) native (\(nb.minX), \(nb.minY), \(nb.width), \(nb.height))\(hostNode == nil ? " (no inspection node)" : "")")
        }
        guard let cap = capture(CGRect(x: cx, y: cy, width: cw, height: ch)) else { print("FAIL \(name) (\(title)): capture"); return false }
        let (shot, k) = cap
        let nat = grid(shot, scale: k, ox: cx, oy: cy, x: cx, y: cy, w: cw, h: ch)
        // label-external-label: the clip holds the page's own <label for> left of the host — compare the host box only.
        let hostOnly = name == "label-external-label"
        var region = [Bool](repeating: true, count: cw * ch)
        if hostOnly { for py in 0..<ch { for px in 0..<cw { let ax = Double(cx + px), ay = Double(cy + py); region[py * cw + px] = ax >= hx && ax < hx + hw && ay >= hy && ay < hy + hh } } }
        let wf = web.flatMask(6), nf = nat.flatMask(6)
        var count = 0, bad = 0, sum = 0.0, worst = 0.0, worstAt = -1
        web.values.withUnsafeBufferPointer { ab in nat.values.withUnsafeBufferPointer { bb in
            let a = ab.baseAddress!, b = bb.baseAddress!
            for i in 0..<(cw * ch) where wf[i] && nf[i] && region[i] {
                let j = i * 3, d = max(abs(a[j] - b[j]), abs(a[j + 1] - b[j + 1]), abs(a[j + 2] - b[j + 2]))
                count += 1; sum += d; if d > 6 { bad += 1 }
                if d > worst { worst = d; worstAt = i } } } }
        let mean = sum / Double(max(count, 1))
        // Ink (every pixel off the page background: text runs, glyphs, surfaces, buttons): each Chrome ink pixel needs native ink
        // within 1 px and vice versa — the placement of every text run and glyph, whose edges the flat-pixel check excludes.
        var wm = web.inkMask(bg, 48), nm = nat.inkMask(bg, 48)
        if hostOnly { for i in 0..<(cw * ch) where !region[i] { wm[i] = false; nm[i] = false } }
        let wd = faDilate(wm, cw, ch), nd = faDilate(nm, cw, ch)
        var wInk = 0, wHit = 0, nInk = 0, nHit = 0
        for i in 0..<(cw * ch) { if wm[i] { wInk += 1; if nd[i] { wHit += 1 } }; if nm[i] { nInk += 1; if wd[i] { nHit += 1 } } }
        // No ink on either side (a disabled slider at 0.38 opacity stays within 48 of the page): nothing to place.
        let wCov = wInk == 0 ? 1 : Double(wHit) / Double(wInk), nCov = nInk == 0 ? 1 : Double(nHit) / Double(nInk)
        suiteInk = min(suiteInk, min(wCov, nCov))
        // Slotted text under dir=rtl (story 5-3): the punctuation sits at the paragraph direction's side, so its ink must place within 1 px
        // (before awcBidiParagraph the lowest cover was 0.970).
        let inkLimit = name.hasPrefix("slotted-text") ? 0.99 : 0.97
        if wCov < inkLimit || nCov < inkLimit { diffs.append(String(format: "ink: Chrome ink covered %.3f (%d px), native ink covered %.3f (%d px)", wCov, wInk, nCov, nInk)) }
        suitePixels += count; suiteBad += bad; suiteSum += sum
        if count < 50 { diffs.append("only \(count) flat pixels compared") }
        if !(Double(bad) / Double(max(count, 1)) <= 0.005 && mean <= 1.0) {
            let wx = cx + max(worstAt, 0) % cw, wy = cy + max(worstAt, 0) / cw
            let at = worstAt < 0 ? "-" : "(\(wx),\(wy)) web \(web.at(wx, wy).map { Int($0) }) native \(nat.at(wx, wy).map { Int($0.rounded()) })"
            diffs.append(String(format: "flat pixels: mean %.2f, >6: %d/%d, worst %.0f at %@", mean, bad, count, worst, at))
        }
        if let dir = ProcessInfo.processInfo.environment["AWC_FA_CAPTURE_DIRECTORY"], !diffs.isEmpty {
            let d = URL(fileURLWithPath: dir).appendingPathComponent(tag)
            try? FileManager.default.createDirectory(at: d, withIntermediateDirectories: true)
            try? NSBitmapImageRep(cgImage: shot).representation(using: .png, properties: [:])?.write(to: d.appendingPathComponent(name + ".png"))
        }
        if diffs.isEmpty { return true }
        print("FAIL \(name) (\(title))"); diffs.forEach { print("   " + $0) }; fflush(stdout)
        return false
    }

    static func main() {
        _ = NSApplication.shared; NSApp.setActivationPolicy(.accessory)
        host = NSHostingView(rootView: FaViewsFixture(state: state))
        window = NSWindow(contentRect: .init(x: -20000, y: -20000, width: 1300, height: 1300), styleMask: [.borderless], backing: .buffered, defer: false)
        window.isReleasedWhenClosed = false; window.colorSpace = .sRGB; window.contentView = host; window.orderFrontRegardless(); pump(0.2)
        let args = CommandLine.arguments
        // No argument: the checked-in copies (Tests/Fixtures/<slider|rating|stepper>-web-oracle with the Chrome shots).
        let fixtures = args.count < 2
        let base = fixtures ? URL(fileURLWithPath: #filePath).deletingLastPathComponent().appendingPathComponent("Fixtures") : URL(fileURLWithPath: args[1])
        let only = args.count > 2 ? args[2] : nil
        let suites: [(String, String, String)] = [
            ("md-slider", "paint.json", "shots/paint"), ("md-slider", "paint-extra2.json", "shots/extra2"),
            ("md-rating", "paint.json", "shots/paint"), ("md-rating", "paint-extra2.json", "shots/extra2"),
            ("md-stepper", "web-paint.json", "paint-shots"), ("md-stepper", "web-paint-extra.json", "paint-extra-shots"), ("md-stepper", "web-paint-extra2.json", "paint-extra2-shots"), ("md-stepper", "web-paint-compact.json", "paint-compact-shots")]
        for (tag, file, shots) in suites {
            // <outputs/native-parity>/<tag>/web-oracle, or the checked-in Tests/Fixtures/<slider|rating|stepper>-web-oracle.
            let dir = fixtures ? base.appendingPathComponent(String(tag.dropFirst(3)) + "-web-oracle") : base.appendingPathComponent(tag).appendingPathComponent("web-oracle")
            guard let data = try? Data(contentsOf: dir.appendingPathComponent(file)), let root = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let cases = root["cases"] as? [[String: Any]] else { print("missing \(tag)/\(file)"); total += 1; continue }
            var ok = 0, ran = 0
            suitePixels = 0; suiteBad = 0; suiteSum = 0; suiteInk = 1
            for c in cases where only.map({ (c["name"] as? String ?? "").contains($0) }) ?? true {
                guard let r = run(tag, c, shots: dir.appendingPathComponent(shots), title: "\(tag) \(file)") else { continue }
                ran += 1; total += 1; if r { ok += 1; passed += 1 }
            }
            print("\(tag) views \(file): \(ok)/\(ran)  (flat pixels compared \(suitePixels), mean |Δ| \(String(format: "%.3f", suiteSum / Double(max(suitePixels, 1)))), >6: \(suiteBad); lowest ink cover \(String(format: "%.3f", suiteInk)))"); fflush(stdout)
        }
        skipped.forEach { print("skipped " + $0) }
        print("NativeFaViewsIntegration: \(passed)/\(total) rendered cases match Chrome (\(skipped.count) skipped)")
        window.close(); exit(passed == total ? 0 : 1)
    }
}
