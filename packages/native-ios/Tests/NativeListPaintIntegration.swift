import AppKit
import SwiftUI
import Observation
@testable import AWCUI

// md-list / md-list-item paint against Chrome (paint.html, 264 cases): geometry of the list,
// rows, leading/content/trailing boxes, resting corners, colors and every flat pixel.
@Observable final class ListPaintState {
    var nodes: [AWCNode] = []
    var standalone = false
    var epoch = 0
    var dark = false
    var rtl = false
    var width = 360.0
    var height: Double? = nil
    var inheritedDensity: Double? = nil
    var listHooks: AWCListAppearance? = nil
    var itemHooks: AWCListItemAppearance? = nil
    var hookTarget = "items"
    var itemIDs: [String] = []
    var parts = false
    var morph = true
    var boxes: [String: CGSize] = [:]
    var inspect = "list"
    var measurements: [AWCNativeInspectionNode] = []
}
struct ListPaintFixture: View {
    let state: ListPaintState
    var body: some View {
        let epoch = state.epoch, theme = AWCTheme.generated(dark: state.dark)
        content
            .frame(width: state.width, height: state.height.map { CGFloat($0) }, alignment: .topLeading).clipped()
            .environment(\.layoutDirection, state.rtl ? .rightToLeft : .leftToRight)
            .environment(\.awcListAuthoredBoxes, state.boxes)
            .modifier(Density(value: state.inheritedDensity))
            .awcTheme(theme)
            .awcNativeInspection(rootID: state.inspect, coordinateSpace: "awc-native-preview") { if state.epoch == epoch { state.measurements = $0 } }
            .id(epoch)
            .padding(.leading, 40).padding(.top, 40)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .background(theme.background).coordinateSpace(name: "awc-native-preview")
    }
    struct Density: ViewModifier { let value: Double?; func body(content: Content) -> some View { if let value { content.awcDensity(value) } else { content } } }
    @ViewBuilder var content: some View {
        let base = VStack(alignment: .leading, spacing: 0) { ForEach(state.nodes) { AWCNativeView(node: $0) } }
        let listed = state.listHooks.map { AnyView(base.awcListAppearance($0)) } ?? AnyView(base)
        let hooked: AnyView = {
            guard let hooks = state.itemHooks else { return listed }
            if state.hookTarget == "list" { return AnyView(listed.awcListItemAppearance(hooks)) }
            var v = listed; for id in state.itemIDs { v = AnyView(v.awcListItemAppearance(hooks, for: id)) }; return v
        }()
        if state.parts {
            hooked.awcListItemPartAppearance(.init(borderColor: "#00897B", borderWidth: 2), part: .row).awcListItemPartAppearance(.init(backgroundColor: "#FF6F00"), part: .stateLayer)
                .awcListItemPartAppearance(.init(color: "#5D4037", letterSpacing: 1), part: .headline).awcListItemPartAppearance(.init(color: "#2E7D32"), part: .leadingIcon)
                .awcListItemPartAppearance(.init(backgroundColor: "#FFF59D"), part: .trailing).awcListItemPartAppearance(.init(color: "#C2185B"), part: .dragHandle)
                .awcListItemPartAppearance(.init(backgroundColor: "#F3E5F5"), part: .expandedPanel).awcListItemPartAppearance(.init(borderColor: "#3949AB", borderWidth: 2), part: .avatar)
                .awcListShapeMorph(state.morph)
        } else { hooked.awcListShapeMorph(state.morph) }
    }
}
struct ListShot { let cg: CGImage; let scale: Double; let origin: CGPoint }
struct ListGrid {
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
@main @MainActor enum NativeListPaintIntegration {
    static let state = ListPaintState()
    static var host: NSHostingView<ListPaintFixture>!, window: NSWindow!
    static var checks = 0, failures: [String] = [], report: [[String: Any]] = []
    static var captureDir: URL? = ProcessInfo.processInfo.environment["AWC_LIST_PAINT_CAPTURE_DIRECTORY"].map { URL(fileURLWithPath: $0) }
    static var a11yChecks = 0
    static func focusViews() -> [AWCNativeButtonFocusView] { func all(_ v: NSView) -> [NSView] { [v] + v.subviews.flatMap(all) }; return all(host).compactMap { $0 as? AWCNativeButtonFocusView } }
    /// role=option → static text with AXSelected, as WebKit exposes a listbox option (single- and multi-select) with aria-selected; menuitem → menu item;
    /// listitem with a button/link primary → button/link; aria-disabled → not enabled; position = index in its set.
    static func accessibility(_ name: String, _ id: String, _ index: Int?, _ w: AWCValue, _ c: AWCValue) {
        let role = w["attrs"]["role"].string, primary = w["primary"]["role"].string
        let view = focusViews().first { $0.accessibilityIdentifier() == id }
        let expected: NSAccessibility.Role? = role == "option" ? .staticText : role == "menuitem" ? .menuItem
            : primary == "button" ? .button : primary == "link" ? .link : nil
        guard let expected else { return }
        a11yChecks += 1
        guard let view else { check(false, "\(name) \(id) accessibility element for \(role)/\(primary)"); return }
        check(view.accessibilityRole() == expected, "\(name) \(id) role \(view.accessibilityRole()?.rawValue ?? "") vs \(role)/\(primary)")
        if role == "option" { check(view.isAccessibilitySelected() == (w["attrs"]["ariaSelected"].string == "true"), "\(name) \(id) aria-selected \(view.isAccessibilitySelected()) vs \(w["attrs"]["ariaSelected"].string)") }
        let disabled = w["attrs"]["ariaDisabled"].string == "true" || w["primary"]["ariaDisabled"].string == "true"
        check(view.isAccessibilityEnabled() == !disabled, "\(name) \(id) enabled \(view.isAccessibilityEnabled()) vs aria-disabled \(disabled)")
        if let index { check(view.accessibilityRowIndexRange().location == index, "\(name) \(id) set position \(view.accessibilityRowIndexRange().location) vs \(index)") }
    }
    static func check(_ value: Bool, _ name: String) { checks += 1; if !value { failures.append(name); print("FAIL: " + name); fflush(stdout) } }
    static func pump(_ duration: Double = 0.1) { let end = Date().addingTimeInterval(duration); repeat { while let e = NSApp.nextEvent(matching: .any, until: .distantPast, inMode: .default, dequeue: true) { NSApp.sendEvent(e) }; host.layoutSubtreeIfNeeded(); host.displayIfNeeded(); _ = RunLoop.current.run(mode: .default, before: Date().addingTimeInterval(0.002)) } while Date() < end }
    // MARK: Fixture nodes
    static var counter = 0, image = ""
    static var built: [String: AWCNode] = [:]
    static func build(_ v: AWCValue, items: inout [String]) -> AWCNode {
        let tag = v["tag"].string
        if tag == "#text" { return AWCNode.text(v["text"].string, slot: v["slot"].string.isEmpty ? nil : v["slot"].string) }
        var props: [String: AWCValue] = [:]
        if case .object(let p) = v["props"] { props = p }
        if case .string(let src) = props["leadingImage"] ?? .null, src.hasPrefix("swatch:") { props["leadingImage"] = .string(image) }
        let id: String
        if tag == "md-list-item" { id = "i\(items.count)"; items.append(id) } else { counter += 1; id = "n\(counter)" }
        let children = v["children"].array.map { build($0, items: &items) }
        let n = AWCNode(id: id, tag: tag, properties: props, children: children, slot: v["slot"].string.isEmpty ? nil : v["slot"].string)
        built[id] = n; return n
    }
    static func px(_ v: AWCValue) -> Double? { Double(v.string.replacingOccurrences(of: "px", with: "").replacingOccurrences(of: "ms", with: "")) ?? v.number }
    static func cornerValue(_ p: Double) -> AWCValue { let l: AWCValue = .object(["points": .number(p)]); let c: AWCValue = .object(["x": l, "y": l]); return .object(["topLeft": c, "topRight": c, "bottomRight": c, "bottomLeft": c]) }
    static func shadowValue(_ s: String) -> AWCValue {
        let layers = AWCBoxShadow.source(s) ?? []
        return .array(layers.map { .object(["x": .number($0.x), "y": .number($0.y), "blur": .number($0.blur), "spread": .number($0.spread), "color": .string($0.color), "inset": .bool($0.inset)]) })
    }
    static func hookValues(_ hooks: [String: AWCValue], kinds: [(String, String)]) -> [String: AWCValue] {
        var out: [String: AWCValue] = [:]
        for (css, kind) in kinds { guard let raw = hooks[css] else { continue }
            let name = css.split(separator: "-").enumerated().map { $0.offset == 0 ? String($0.element) : $0.element.prefix(1).uppercased() + $0.element.dropFirst() }.joined()
            switch kind {
            case "color", "font": out[name] = .string(raw.string.uppercased() == raw.string || kind == "font" ? raw.string : raw.string.uppercased())
            case "shape": out[name] = cornerValue(px(raw) ?? 0)
            case "shadow": out[name] = shadowValue(raw.string)
            default: out[name] = .number(px(raw) ?? 0)
            }
        }
        return out
    }
    static let listKinds: [(String, String)] = [("container-color","color"),("container-shape","shape"),("padding-block","length"),("padding-inline","length"),("segmented-gap","length"),("drop-placeholder-color","color"),("drop-placeholder-outline-color","color"),("drop-placeholder-outline-width","length"),("drop-placeholder-shape","shape"),("drop-placeholder-opacity","number")]
    static var itemKinds: [(String, String)] = []
    // MARK: Pixels
    static func capture(_ r: CGRect) -> ListShot {
        let rr = host.isFlipped ? r : CGRect(x: r.minX, y: host.bounds.height - r.maxY, width: r.width, height: r.height)
        let b = host.bitmapImageRepForCachingDisplay(in: rr)!; host.cacheDisplay(in: rr, to: b)
        return .init(cg: b.cgImage!, scale: Double(b.pixelsWide) / r.width, origin: r.origin)
    }
    static func grid(_ s: ListShot, x: Int, y: Int, w: Int, h: Int) -> ListGrid {
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
    static func comparePaint(_ label: String, web: ListShot, native: ListShot, clip: AWCValue, masks: [CGRect]) -> [String: Any] {
        let cx = Int(clip["x"].number!), cy = Int(clip["y"].number!), cw = Int(clip["width"].number!), ch = Int(clip["height"].number!)
        let wg = grid(web, x: cx, y: cy, w: cw, h: ch), ng = grid(native, x: cx, y: cy, w: cw, h: ch)
        var n = 0, bad = 0, sum = 0.0, worst = 0.0, worstAt = ""
        for py in (cy + 1)..<(cy + ch - 1) { for px in (cx + 1)..<(cx + cw - 1) where wg.flat(px, py, 6) && ng.flat(px, py, 6) {
            let p = CGPoint(x: Double(px) + 0.5, y: Double(py) + 0.5); if masks.contains(where: { $0.insetBy(dx: -2, dy: -2).contains(p) }) { continue }
            let d = diff(wg.at(px, py), ng.at(px, py)); n += 1; sum += d; if d > 6 { bad += 1 }
            if d > worst { worst = d; worstAt = "(\(px),\(py)) web \(wg.at(px, py).map { Int($0) }) native \(ng.at(px, py).map { Int($0.rounded()) })" }
        } }
        let coverage = Double(n) / Double(max(1, (cw - 2) * (ch - 2))), ratio = Double(bad) / Double(max(n, 1))
        check(coverage > 0.4, "\(label) compared flat pixels cover \(coverage) of the clip")
        check(ratio <= 0.005 && sum / Double(max(n, 1)) <= 1.0, "\(label) flat pixels match the source (mean \(sum / Double(max(n, 1))), >6: \(bad)/\(n), worst \(worst) at \(worstAt))")
        if let dir = captureDir { try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
            try? NSBitmapImageRep(cgImage: native.cg).representation(using: .png, properties: [:])?.write(to: dir.appendingPathComponent(label + ".png")) }
        return ["case": label, "compared": n, "coverage": coverage, "mean": sum / Double(max(n, 1)), "over6": bad, "worst": worst, "worstAt": worstAt]
    }
    static func rect(_ v: AWCValue) -> CGRect { .init(x: v["x"].number ?? 0, y: v["y"].number ?? 0, width: v["width"].number ?? 0, height: v["height"].number ?? 0) }
    static func near(_ a: CGRect?, _ b: CGRect, _ tol: Double = 0.6) -> Bool { guard let a else { return false }; return abs(a.minX - b.minX) <= tol && abs(a.minY - b.minY) <= tol && abs(a.width - b.width) <= tol && abs(a.height - b.height) <= tol }
    static func d(_ r: CGRect?) -> String { r.map { "(\($0.minX),\($0.minY),\($0.width),\($0.height))" } ?? "nil" }
    static func css(_ s: String) -> [Double] {
        let n = s.split(whereSeparator: { !"0123456789.-".contains($0) }).compactMap { Double($0) }
        if s.hasPrefix("rgba") { return [n[0] / 255, n[1] / 255, n[2] / 255, n[3]] }
        if s.hasPrefix("rgb") { return [n[0] / 255, n[1] / 255, n[2] / 255, 1] }
        if s.hasPrefix("color(srgb") { return [n[0], n[1], n[2], n.count > 3 ? n[3] : 1] }
        return []
    }
    static func node(_ id: String, _ name: String) -> AWCNativeInspectionNode? { state.measurements.first { $0.id.hasPrefix(id + ":") && $0.name == name } }
    // MARK: Case
    static func run(_ c: AWCValue, fixture: AWCValue, shots: URL) {
        let name = c["name"].string
        var items: [String] = []; counter = 0; built = [:]
        let nodes = fixture["paint"][name].array.map { build($0, items: &items) }
        let standalone = c["standalone"] == .bool(true)
        var list = AWCNode(id: "list", tag: "md-list", properties: ["listStyle": .string(c["style"].string), "selectionMode": .string(c["mode"].string), "interactionMode": .string(c["interaction"].string)], children: nodes)
        if c["reorderable"] == .bool(true) { list.properties["reorderable"] = true }
        if let dd = c["density"].number, dd != 0 { list.properties["density"] = .number(dd) }
        for k in ["label", "labelledby", "roleOverride"] where !c[k].string.isEmpty { list.properties[k] = .string(c[k].string) }
        if let itemDensity = c["itemDensity"].number {
            func apply(_ n: AWCNode) -> AWCNode { var m = n; if m.tag == "md-list-item" { m.properties["density"] = .number(itemDensity) }; m.children = m.children.map(apply); return m }
            list.children = list.children.map(apply)
        }
        if c["recipe"].string == "imageSelect" { list.children = list.children.map { var m = $0; m.properties["leadingImage"] = .string(image); return m } }
        state.nodes = standalone ? nodes : [list]; state.standalone = standalone
        state.dark = c["theme"].string == "dark"; state.rtl = c["dir"].string == "rtl"; state.width = c["width"].number ?? 360; state.height = c["height"].number
        state.inheritedDensity = c["inheritedDensity"].number
        let lh = fixture["listHooks"], ih = fixture["itemHooks"]
        if case .array(let keys) = c["listHooks"] { var h: [String: AWCValue] = [:]; for k in keys { h[k.string] = lh[k.string] }; state.listHooks = AWCListAppearance(values: hookValues(h, kinds: listKinds)) } else { state.listHooks = nil }
        if case .array(let keys) = c["itemHooks"] { var h: [String: AWCValue] = [:]; for k in keys { h[k.string] = ih[k.string] }; state.itemHooks = AWCListItemAppearance(values: hookValues(h, kinds: itemKinds)) } else { state.itemHooks = nil }
        state.hookTarget = c["hookTarget"].string == "list" ? "list" : "items"; state.itemIDs = items
        state.parts = c["parts"] == .bool(true); state.morph = c["shapeMorph"].string != "off"
        state.inspect = "list|" + items.joined(separator: "|")
        var boxes: [String: CGSize] = [:]
        for (i, w) in c["items"].array.enumerated() where i < items.count {
            guard let item = built[items[i]] else { continue }
            for slot in ["leading", "trailing"] {
                let natives = item.children(inSlot: slot).filter { $0.tag != "#text" }, webs = w["slots"][slot].array
                for (n, wv) in zip(natives, webs) { boxes[n.id] = CGSize(width: wv["rect"]["width"].number ?? 0, height: wv["rect"]["height"].number ?? 0) }
            }
        }
        state.boxes = boxes
        // The list writes rovingFocusVisible on the row that shows the keyboard ring in the Web capture.
        for (i, w) in c["items"].array.enumerated() where i < items.count && w["classes"].string.contains("md-list-item--roving-focus-visible") {
            func mark(_ n: AWCNode) -> AWCNode { var m = n; if m.id == items[i] { m.properties["rovingFocusVisible"] = true }; m.children = m.children.map(mark); return m }
            state.nodes = state.nodes.map(mark)
        }
        state.epoch += 1; pump(0.5)
        // List geometry.
        if !standalone, case .object = c["list"] {
            let wl = c["list"], native = state.measurements.first { $0.id == "list:component" }
            check(near(native?.bounds, rect(wl["rect"])), "\(name) list \(d(native?.bounds)) vs \(d(rect(wl["rect"])))")
            let pad = native?.metrics["paddingBlockInline"]?.array.compactMap(\.number) ?? []
            check(pad.count == 2 && abs(pad[0] - (wl["style"]["padding"].array[0].number ?? -1)) < 0.01 && abs(pad[1] - (wl["style"]["padding"].array[1].number ?? -1)) < 0.01, "\(name) list padding \(pad) vs \(wl["style"]["padding"])")
            check(abs((native?.metrics["contentGap"]?.number ?? -1) - (wl["style"]["gap"].number ?? 0)) < 0.01, "\(name) list gap")
            check(native?.metrics["role"]?.string == wl["attrs"]["role"].string, "\(name) list role \(native?.metrics["role"]?.string ?? "") vs \(wl["attrs"]["role"].string)")
        }
        var masks: [CGRect] = []
        for (i, w) in c["items"].array.enumerated() where i < items.count {
            let id = items[i], host = rect(w["rect"])
            for s in w["slots"]["leading"].array + w["slots"]["trailing"].array { masks.append(rect(s["rect"])) }
            if host.width == 0 { check(node(id, "md-list-item") == nil, "\(name) \(id) hidden row is not rendered"); continue }
            guard let n = node(id, "md-list-item") else { check(false, "\(name) \(id) rendered"); continue }
            check(near(n.bounds, host), "\(name) \(id) host \(d(n.bounds)) vs \(d(host))")
            // Accessibility (the row's role, selection, disabled state and set position) against Chrome's attributes.
            let top = (state.nodes.first?.tag == "md-list" ? state.nodes.first?.children ?? [] : []).filter { $0.tag == "md-list-item" }.map(\.id)
            accessibility(name, id, top.firstIndex(of: id), w, c)
            // Truncation tooltips: enabled exactly when Chrome's md-tooltip wrappers are (headline, supporting text).
            let tips = w["tooltips"].array
            if tips.count == 2 {
                check((n.metrics["headlineTooltip"]?.bool ?? false) == (tips[0]["disabled"] == .bool(false)), "\(name) \(id) headline tooltip \(n.metrics["headlineTooltip"] ?? .null) vs disabled \(tips[0]["disabled"])")
                if !w["tooltips"].array[1]["cls"].string.contains("--empty") {
                    check((n.metrics["supportingTooltip"]?.bool ?? false) == (tips[1]["disabled"] == .bool(false)), "\(name) \(id) supporting tooltip \(n.metrics["supportingTooltip"] ?? .null) vs disabled \(tips[1]["disabled"])")
                }
            }
            let wr = w["host"]["radius"].array.compactMap { px($0) }, nr = n.metrics["radius"]?.array.compactMap(\.number) ?? []
            check(wr.count == 4 && nr.count == 4 && zip(wr, nr).allSatisfy { abs($0 - $1) < 0.6 }, "\(name) \(id) corners \(nr) vs \(wr)")
            let wb = css(w["host"]["background"].string), nb = n.metrics["background"]?.array.compactMap(\.number) ?? []
            check(wb.count == 4 && nb.count == 4 && (0..<4).allSatisfy { abs(wb[$0] * (wb[3] > 0 ? 1 : 0) - nb[$0] * (nb[3] > 0 ? 1 : 0)) < 0.012 }, "\(name) \(id) background \(nb) vs \(wb)")
            if let row = node(id, "row") {
                let pw = w["row"]["padding"].array.compactMap(\.number), pn = row.metrics["padding"]?.array.compactMap(\.number) ?? []
                check(pw.count == 4 && pn.count == 4 && zip(pw, pn).allSatisfy { abs($0 - $1) < 0.01 }, "\(name) \(id) row padding \(pn) vs \(pw)")
                check(abs((row.metrics["contentGap"]?.number ?? -1) - (w["row"]["gap"].number ?? -2)) < 0.01, "\(name) \(id) row gap")
                check(abs((row.metrics["minHeight"]?.number ?? -1) - (w["row"]["minHeight"].number ?? -2)) < 0.01, "\(name) \(id) row min height")
                check(near(row.bounds, rect(w["row"]["rect"])), "\(name) \(id) row \(d(row.bounds)) vs \(d(rect(w["row"]["rect"])))")
            } else { check(false, "\(name) \(id) row measured") }
            for (part, key) in [("content", "content"), ("headline", "headline"), ("supporting-text", "supporting"), ("overline", "overline"), ("leading", "leading"), ("trailing", "trailing"),
                                ("leading-icon", "leadingIcon"), ("trailing-icon", "trailingIcon"), ("avatar", "avatar"), ("image", "imageWrap"), ("expand-button", "expandButton"), ("drag-handle", "dragHandle")] {
                let wv = w[key]; guard case .object = wv else { continue }
                let wrc = rect(wv["rect"]); if wrc.width == 0 && wrc.height == 0 { check(node(id, part) == nil || part == "headline", "\(name) \(id) \(part) absent"); continue }
                if key == "trailing" && !w["slots"]["trailing"].array.isEmpty { continue }
                check(near(node(id, part)?.bounds, wrc, part == "headline" || part == "supporting-text" || part == "content" || part == "overline" ? 1.0 : 0.6), "\(name) \(id) \(part) \(d(node(id, part)?.bounds)) vs \(d(wrc))")
            }
        }
        // Paint.
        let clip = c["clip"]
        if let src = NSImage(contentsOf: shots.appendingPathComponent(name + ".png"))?.cgImage(forProposedRect: nil, context: nil, hints: nil) {
            let web = ListShot(cg: src, scale: 1, origin: .init(x: clip["x"].number!, y: clip["y"].number!))
            report.append(comparePaint(name, web: web, native: capture(rect(clip)), clip: clip, masks: masks))
        } else { check(false, "\(name) source shot") }
    }
    static func main() {
        _ = NSApplication.shared; NSApp.setActivationPolicy(.accessory)
        host = NSHostingView(rootView: ListPaintFixture(state: state)); window = NSWindow(contentRect: .init(x: -20000, y: -20000, width: 1200, height: 900), styleMask: [.borderless], backing: .buffered, defer: false)
        window.isReleasedWhenClosed = false; window.colorSpace = .sRGB; window.contentView = host; window.orderFrontRegardless(); pump(0.2)
        let fixtures = URL(fileURLWithPath: #filePath).deletingLastPathComponent().appendingPathComponent("Fixtures")
        let oracle = try! JSONDecoder().decode(AWCValue.self, from: Data(contentsOf: fixtures.appendingPathComponent("list-web-paint.json")))
        let fixture = try! JSONDecoder().decode(AWCValue.self, from: Data(contentsOf: fixtures.appendingPathComponent("list-web-fixtures.json")))
        image = fixture["image"].string
        itemKinds = AWCListItemAppearance.cssProperties.map { (String($0.value.dropFirst("--md-list-item-".count)), kind(String($0.value.dropFirst("--md-list-item-".count)))) }
        let only = ProcessInfo.processInfo.environment["AWC_LIST_PAINT_ONLY"]
        let groups = ProcessInfo.processInfo.environment["AWC_LIST_PAINT_GROUPS"].map { Set($0.split(separator: ",").map(String.init)) }
        for c in oracle["cases"].array where (only.map({ c["name"].string.contains($0) }) ?? true) && (groups.map { $0.contains(c["group"].string) } ?? true) { run(c, fixture: fixture, shots: fixtures.appendingPathComponent("list-web-paint")) }
        if let output = ProcessInfo.processInfo.environment["AWC_LIST_PAINT_OUTPUT"] { try! JSONSerialization.data(withJSONObject: ["checks": checks, "failures": failures, "report": report], options: [.prettyPrinted, .sortedKeys]).write(to: URL(fileURLWithPath: output)) }
        print("List native paint: \(checks - failures.count)/\(checks) checks passed")
        window.close(); if !failures.isEmpty { exit(1) }
    }
    static func kind(_ css: String) -> String {
        if css == "container-shape" { return "shape" }
        if css == "dragged-container-elevation" { return "shadow" }
        if css.hasSuffix("-font") { return "font" }
        if css.hasSuffix("-color") || css.hasSuffix("-background") { return "color" }
        if css.hasSuffix("opacity") { return "number" }
        return "length"
    }
}
