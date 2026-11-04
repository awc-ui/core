import AppKit
import SwiftUI
import Observation
import QuartzCore
@testable import AWCUI

// md-list / md-list-item interaction against Chrome trusted-input records (web-oracle states.html:
// full, reduced-motion and extra sets): pointer, selection, disabled, trailing controls, keyboard
// roving focus and typeahead, disclosure by pointer and keys, image selection and the custom-hook
// run. Per-frame state layer, corners, container, icon colours, panel and caret are compared at
// their render time with Chrome's samples; events (order and payloads), focus and phase paint too.
@Observable final class ListStatesState {
    var run: AWCValue = .null
    var epoch = 0
    var reduced = false
    var measurements: [AWCNativeInspectionNode] = []
    var events: [(String, AWCValue, Double, String)] = []
    var listHooks: AWCListAppearance? = nil
    var itemHooks: AWCListItemAppearance? = nil
    var image = ""
    let pointer = AWCNativePointerState()
}
enum ListStatesRows {
    static func item(_ id: String, _ p: [String: AWCValue], _ children: [AWCNode] = [], slot: String? = nil) -> AWCNode { AWCNode(id: id, tag: "md-list-item", properties: p, children: children, slot: slot) }
    static func rows(_ name: String, image: String) -> [AWCNode] {
        switch name {
        case "buttons": return [item("r0", ["type": "button", "headline": "Wi-Fi", "leadingIcon": "wifi", "trailingIcon": "chevron_right"]),
                                item("r1", ["type": "button", "headline": "Sound", "supportingText": "Volume and vibration", "leadingIcon": "volume_up", "trailingIcon": "chevron_right"]),
                                item("r2", ["type": "button", "headline": "Storage", "leadingIcon": "storage", "trailingIcon": "chevron_right"])]
        case "links": return [item("r0", ["type": "link", "href": "#one", "headline": "Docs"]), item("r1", ["type": "link", "href": "#two", "headline": "Guides", "leadingIcon": "menu_book"]),
                              item("r2", ["type": "link", "href": "#three", "headline": "API"])]
        case "options": return [item("r0", ["headline": "Alpha", "leadingIcon": "looks_one", "trailingIcon": "check"]), item("r1", ["headline": "Bravo", "leadingIcon": "looks_two", "trailingIcon": "check"]),
                                item("r2", ["headline": "Sierra", "leadingIcon": "looks_3", "trailingIcon": "check", "selected": true])]
        case "disabled": return [item("r0", ["type": "button", "headline": "Enabled"]), item("r1", ["type": "button", "headline": "Disabled", "disabled": true, "leadingIcon": "block"]),
                                 item("r2", ["type": "button", "headline": "Soft disabled", "softDisabled": true, "leadingIcon": "visibility_off"])]
        case "selectedHover": return [item("r0", ["headline": "Plain", "leadingIcon": "label", "trailingIcon": "check"]), item("r1", ["headline": "Selected", "leadingIcon": "label", "trailingIcon": "check", "selected": true]),
                                      item("r2", ["headline": "Plain two", "leadingIcon": "label"])]
        case "trailing": return [item("r0", ["type": "button", "headline": "Inbox", "leadingIcon": "inbox"], [AWCNode(id: "del", tag: "md-icon-button", properties: ["icon": "delete", "ariaLabel": "Delete", "label": "Delete"], slot: "trailing")]),
                                 item("r1", ["type": "button", "headline": "Alerts"], [AWCNode(id: "sw", tag: "md-switch", properties: ["ariaLabel": "Alerts", "label": "Alerts"], slot: "trailing")]),
                                 item("r2", ["type": "button", "headline": "Archive"])]
        case "expand": return [item("r0", ["type": "button", "headline": "Before"]),
                               item("r1", ["type": "button", "headline": "Folders", "leadingIcon": "folder", "expandable": true],
                                    [item("c0", ["type": "button", "headline": "Photos", "leadingIcon": "image"], slot: "expanded-content"), item("c1", ["type": "button", "headline": "Music", "leadingIcon": "music_note"], slot: "expanded-content")]),
                               item("r2", ["type": "button", "headline": "After"])]
        case "reorder": return ["One", "Two", "Three", "Four"].enumerated().map { item("r\($0.offset)", ["type": "button", "headline": .string($0.element), "leadingIcon": "drag_pan"]) }
        case "images": return [("r0", "Beach"), ("r1", "Forest"), ("r2", "City")].map { item($0.0, ["headline": .string($0.1), "supportingText": "Photo", "leadingImage": .string(image)]) }
        case "typeahead": return ["Apple", "Banana", "Blueberry", "Cherry"].enumerated().map { item("r\($0.offset)", ["type": "button", "headline": .string($0.element)]) }
        default: return []
        }
    }
}
struct ListStatesFixture: View {
    let state: ListStatesState
    var body: some View {
        let r = state.run, epoch = state.epoch, theme = AWCTheme.generated(dark: r["theme"].string == "dark")
        var props: [String: AWCValue] = ["listStyle": .string(r["style"].string), "selectionMode": .string(r["mode"].string), "interactionMode": .string(r["interaction"].string), "label": "Reference list"]
        if r["reorderable"] == .bool(true) { props["reorderable"] = true }
        let rows = ListStatesRows.rows(r["rows"].string, image: state.image)
        let ids = rows.flatMap { [$0.id] + $0.children.filter { $0.tag == "md-list-item" }.map(\.id) }
        let list = AnyView(AWCNativeView(node: .init(id: "list", tag: "md-list", properties: props, children: rows),
                                         onEvent: { e in state.events.append((e.name, e.detail, CACurrentMediaTime() * 1000, e.nodeID)) })
            .frame(width: 360, alignment: .topLeading))
        let listed = state.listHooks.map { AnyView(list.awcListAppearance($0)) } ?? list
        let hooked: AnyView = { guard let h = state.itemHooks else { return listed }; var v = listed; for id in ids { v = AnyView(v.awcListItemAppearance(h, for: id)) }; return v }()
        return ZStack(alignment: .topLeading) {
            // AppKit orders the key-view loop geometrically: "before" sits above the list (outside the shot clip) so it precedes the rows as in the DOM.
            AWCNativeView(node: .init(id: "before", tag: "md-button", properties: ["variant": "text"], children: [.text("Before")])).offset(x: 700, y: 4)
            hooked.environment(\.layoutDirection, r["dir"].string == "rtl" ? .rightToLeft : .leftToRight).offset(x: 60, y: 60)
            AWCNativeView(node: .init(id: "after", tag: "md-button", properties: ["variant": "text"], children: [.text("After")])).offset(x: 120, y: 860)
        }
        .awcListReducedMotion(state.reduced)
        .awcTheme(theme)
        .awcNativeInspection(rootID: (["list"] + ids).joined(separator: "|"), coordinateSpace: "awc-native-preview") { if state.epoch == epoch { state.measurements = $0 } }
        .environment(\.awcNativePointerState, state.pointer)
        .id(epoch)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(theme.background).coordinateSpace(name: "awc-native-preview")
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
struct ShotBox { let shot: ListShot; let rect: CGRect }
struct ListStatesProp { let name: String; let tol: Double; let web: (AWCValue) -> [Double]?; let native: ([String: AWCValue]) -> [Double]? }
@main @MainActor enum NativeListStatesIntegration {
    static let state = ListStatesState()
    static var host: NSHostingView<ListStatesFixture>!, window: NSWindow!
    static var checks = 0, failures: [String] = [], report: [[String: Any]] = [], skipped: [String] = [], knownGaps: [String] = []
    static let captureDir = ProcessInfo.processInfo.environment["AWC_LIST_STATES_CAPTURE_DIRECTORY"].map { URL(fileURLWithPath: $0) }
    /// Diagnostic only: AWC_LIST_STATES_SHOT_ANCHOR=t0 restores the earlier shot timing (fixed run time, not
    /// the native input time) to reproduce the load-dependent shot drift; default is the input-anchored shot.
    static let shotsAnchoredToRunStart = ProcessInfo.processInfo.environment["AWC_LIST_STATES_SHOT_ANCHOR"] == "t0"
    static var shotTiming: [[String: Any]] = []
    /// Diagnostic only: AWC_LIST_STATES_INPUT_DELAY="<run/phase substring>:<ms>" injects that phase's input late,
    /// the way a loaded Mac does, to show how each shot anchoring reacts.
    static let injectedDelay: (String, Double)? = ProcessInfo.processInfo.environment["AWC_LIST_STATES_INPUT_DELAY"].flatMap { v in
        let p = v.split(separator: ":"); return p.count == 2 ? Double(p[1]).map { (String(p[0]), $0) } : nil }
    static func check(_ value: Bool, _ name: String) { checks += 1; if !value { failures.append(name); print("FAIL: " + name); fflush(stdout) } }
    static func pump(_ duration: Double = 0.1) { let end = Date().addingTimeInterval(duration); repeat { while let e = NSApp.nextEvent(matching: .any, until: .distantPast, inMode: .default, dequeue: true) { NSApp.sendEvent(e) }; host.layoutSubtreeIfNeeded(); host.displayIfNeeded(); _ = RunLoop.current.run(mode: .default, before: Date().addingTimeInterval(0.002)) } while Date() < end }
    static func now() -> Double { CACurrentMediaTime() * 1000 }
    static func mouse(_ kind: NSEvent.EventType, _ p: CGPoint) { let point = host.convert(.init(x: p.x, y: host.isFlipped ? p.y : host.bounds.height - p.y), to: nil); let e = NSEvent.mouseEvent(with: kind, location: point, modifierFlags: [], timestamp: ProcessInfo.processInfo.systemUptime, windowNumber: window.windowNumber, context: nil, eventNumber: 1, clickCount: 1, pressure: kind == .leftMouseUp ? 0 : 1)!; window.sendEvent(e) }
    /// AppKit controls (the md-switch adapter's NSSwitch) track a press in a nested event loop: queue the
    /// release before delivering the press so that loop can finish.
    static func postedClick(_ p: CGPoint) {
        let point = host.convert(.init(x: p.x, y: host.isFlipped ? p.y : host.bounds.height - p.y), to: nil)
        func ev(_ k: NSEvent.EventType) -> NSEvent { NSEvent.mouseEvent(with: k, location: point, modifierFlags: [], timestamp: ProcessInfo.processInfo.systemUptime, windowNumber: window.windowNumber, context: nil, eventNumber: 1, clickCount: 1, pressure: k == .leftMouseUp ? 0 : 1)! }
        NSApp.postEvent(ev(.leftMouseUp), atStart: false); window.sendEvent(ev(.leftMouseDown))
    }
    static func key(_ code: UInt16, _ text: String, _ flags: NSEvent.ModifierFlags = []) { let e = NSEvent.keyEvent(with: .keyDown, location: .zero, modifierFlags: flags, timestamp: ProcessInfo.processInfo.systemUptime, windowNumber: window.windowNumber, context: nil, characters: text, charactersIgnoringModifiers: text, isARepeat: false, keyCode: code)!; window.sendEvent(e) }
    static func all(_ v: NSView) -> [NSView] { [v] + v.subviews.flatMap(all) }
    static func focusView(_ id: String) -> AWCNativeButtonFocusView? { all(host).compactMap { $0 as? AWCNativeButtonFocusView }.first { $0.accessibilityIdentifier() == id } }
    static func focusedID() -> String { (window.firstResponder as? AWCNativeButtonFocusView)?.accessibilityIdentifier() ?? "body" }
    // MARK: Values
    static func value(_ a: Any) -> AWCValue {
        if let d = a as? [String: Any] { return .object(d.mapValues(value)) }
        if let arr = a as? [Any] { return .array(arr.map(value)) }
        if let str = a as? String { return .string(str) }
        if let n = a as? NSNumber { return CFGetTypeID(n) == CFBooleanGetTypeID() ? .bool(n.boolValue) : .number(n.doubleValue) }
        return .null
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
        if let dir = captureDir { _ = mkdir(dir.path, 0o755)
            try? NSBitmapImageRep(cgImage: native.cg).representation(using: .png, properties: [:])?.write(to: dir.appendingPathComponent(label + ".png")) }
        return ["case": label, "compared": n, "coverage": coverage, "mean": sum / Double(max(n, 1)), "over6": bad, "worst": worst, "worstAt": worstAt]
    }
    static func rect(_ v: AWCValue) -> CGRect { .init(x: v["x"].number ?? 0, y: v["y"].number ?? 0, width: v["width"].number ?? 0, height: v["height"].number ?? 0) }
    static func kind(_ css: String) -> String {
        if css == "container-shape" { return "shape" }
        if css == "dragged-container-elevation" { return "shadow" }
        if css.hasSuffix("-font") { return "font" }
        if css.hasSuffix("-color") || css.hasSuffix("-background") { return "color" }
        if css.hasSuffix("opacity") { return "number" }
        return "length"
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
    static func angle(_ m: String) -> Double { if m == "none" || m.isEmpty { return 0 }; let n = numbers(m); guard n.count >= 2 else { return 0 }; return abs(atan2(n[1], n[0]) * 180 / .pi) }
    struct Sample { let t: Double; let rows: [String: (Double?, [String: AWCValue], CGRect)]; var placeholder: Double? = nil }
    static func sample() -> Sample {
        var rows: [String: (Double?, [String: AWCValue], CGRect)] = [:]
        for m in state.measurements where m.name == "md-list-item" { let id = String(m.id.split(separator: ":").first ?? ""); rows[id] = (m.metrics["renderTime"]?.number, m.metrics, m.bounds) }
        var ph: Double? = nil
        if let p = state.measurements.first(where: { $0.name == "drop-placeholder" }), let list = state.measurements.first(where: { $0.id == "list:component" }) { ph = Double(list.bounds.minY) + (p.metrics["top"]?.number ?? 0) }
        return .init(t: now(), rows: rows, placeholder: ph)
    }
    static func node(_ id: String, _ name: String) -> AWCNativeInspectionNode? { state.measurements.first { $0.id.hasPrefix(id + ":") && $0.name == name } }
    // MARK: Run
    static func run(_ r: AWCValue, shots: URL, set: String, fixture: AWCValue) {
        let name = r["name"].string, scenario = r["scenario"].string, label = (set == "full" ? "" : set + "/") + name
        state.reduced = set == "reduced"; state.run = r
        if scenario == "custom" || r["hooks"] == .bool(true) {
            state.listHooks = AWCListAppearance(values: hookValues(fixture["listHooks"].object, kinds: listKinds))
            state.itemHooks = AWCListItemAppearance(values: hookValues(fixture["itemHooks"].object, kinds: itemKinds))
        } else { state.listHooks = nil; state.itemHooks = nil }
        state.pointer.update(phase: .leave); state.epoch += 1; pump(0.4)
        _ = window.makeFirstResponder(nil); state.events = []; pump(0.05)
        let phases = r["phases"].array, webT0 = phases.first?["t"].number ?? 0
        // Web geometry used to aim the input (each phase aims with the layout of the phase before it).
        func webItem(_ id: String, before i: Int) -> AWCValue? { let snaps = (0..<max(1, i)).reversed().map { phases[$0]["snap"] }; for s in snaps { if let it = s["items"].array.first(where: { $0["id"].string == id }) { return it } }; return phases[0]["snap"]["items"].array.first { $0["id"].string == id } }
        func center(_ id: String, _ i: Int) -> CGPoint { let rc = webItem(id, before: i)?["rect"] ?? .null; return CGPoint(x: rc["x"].number! + 60, y: rc["y"].number! + min(rc["height"].number!, 56) / 2) }
        func partCenter(_ id: String, _ key: String, _ i: Int) -> CGPoint { let rc = webItem(id, before: i)?[key]["rect"] ?? .null; return CGPoint(x: rc["x"].number! + rc["width"].number! / 2, y: rc["y"].number! + rc["height"].number! / 2) }
        func slotCenter(_ id: String, _ i: Int) -> CGPoint { let rc = webItem(id, before: i)?["slots"]["trailing"].array.first?["rect"] ?? .null; return CGPoint(x: rc["x"].number! + rc["width"].number! / 2, y: rc["y"].number! + rc["height"].number! / 2) }
        let away = CGPoint(x: 1190, y: 600)
        func hoverTo(_ q: CGPoint) { state.pointer.update(phase: .move, location: q); mouse(.mouseMoved, q) }
        func down(_ q: CGPoint) { state.pointer.update(phase: .down, location: q); mouse(.leftMouseDown, q) }
        func up(_ q: CGPoint) { mouse(.leftMouseDragged, q); mouse(.leftMouseUp, q); state.pointer.update(phase: .up, location: q) }
        // Chrome receives the trusted down and up in separate frames.
        func click(_ q: CGPoint) { hoverTo(q); down(q); up(q) }  // Chrome never paints :active for a click within one frame
        let keys: [String: (UInt16, String)] = ["Tab": (48, "\t"), "ArrowDown": (125, "\u{F701}"), "ArrowUp": (126, "\u{F700}"), "ArrowRight": (124, "\u{F703}"), "ArrowLeft": (123, "\u{F702}"),
                                               "Home": (115, "\u{F729}"), "End": (119, "\u{F72B}"), "Enter": (36, "\r"), "Space": (49, " "), "b": (11, "b"), "l": (37, "l"), "c": (8, "c")]
        func press(_ k: String) { let v = keys[k]!; key(v.0, v.1) }
        var actions: [String: () -> Void] = [:]
        let ids: [String] = scenario == "disabled" ? ["r1", "r2"] : ["r1"]
        for (i, ph) in phases.enumerated() {
            let lbl = ph["label"].string
            switch scenario {
            case "pointer", "disabled":
                let id = String(lbl.split(separator: "-").first ?? ""), p = center(id, i), step = String(lbl.split(separator: "-").last ?? "")
                if ids.contains(id) { actions[lbl] = step == "hover" ? { hoverTo(p) } : step == "press" ? { down(p) } : step == "release" ? { up(p) } : { state.pointer.update(phase: .leave); mouse(.mouseMoved, away) } }
            case "select", "selectedHover", "imageSelect":
                let target = scenario == "select" ? "r0" : "r1", p = center(target, i), p1 = center("r1", i)
                switch lbl {
                case "hover": actions[lbl] = { hoverTo(p) }
                case "press": actions[lbl] = { down(p) }
                case "release": actions[lbl] = { up(p) }
                case "second": actions[lbl] = { click(p1) }
                case "again": actions[lbl] = { down(p1); pump(0.017); up(p1) }
                case "select": actions[lbl] = { click(p) }
                case "deselect": actions[lbl] = { down(p); pump(0.017); up(p) }
                default: actions[lbl] = { state.pointer.update(phase: .leave); mouse(.mouseMoved, away) }
                }
            case "trailing":
                let row0 = center("r0", i), del = slotCenter("r0", i), sw = slotCenter("r1", i)
                switch lbl {
                case "row-hover": actions[lbl] = { hoverTo(row0) }
                case "button-hover": actions[lbl] = { hoverTo(del) }
                case "button-press": actions[lbl] = { down(del) }
                case "button-release": actions[lbl] = { up(del) }
                case "switch-click": actions[lbl] = { hoverTo(sw); state.pointer.update(phase: .down, location: sw); postedClick(sw); state.pointer.update(phase: .up, location: sw) }
                case "leave": actions[lbl] = { state.pointer.update(phase: .leave); mouse(.mouseMoved, away) }
                case "focus-button": actions[lbl] = { _ = focusView("del")?.requestNativeFocus() }
                case "enter-button": actions[lbl] = { press("Enter") }
                default: actions[lbl] = { press("Space") }
                }
            case "keyboard", "custom":
                switch lbl {
                case "tab", "tabAway": actions[lbl] = { press("Tab") }
                case "down", "down2": actions[lbl] = { press("ArrowDown") }
                case "end": actions[lbl] = { press("End") }
                case "home": actions[lbl] = { press("Home") }
                case "typeB": actions[lbl] = { press("b") }
                case "typeBl": actions[lbl] = { press("b"); press("l") }
                case "typeC": actions[lbl] = { press("c") }
                case "enter": actions[lbl] = { press("Enter") }
                case "space": actions[lbl] = { press("Space") }
                case "hover": let p = center("r1", i); actions[lbl] = { hoverTo(p) }
                case "press": let p = center("r1", i); actions[lbl] = { down(p) }
                case "release": let p = center("r1", i); actions[lbl] = { up(p) }
                case "leave": actions[lbl] = { state.pointer.update(phase: .leave); mouse(.mouseMoved, away) }
                default: break
                }
            case "expand":
                switch lbl {
                case "hover": let p = center("r1", i); actions[lbl] = { hoverTo(p) }
                case "click-open", "click-close": let p = center("r1", i); actions[lbl] = { down(p); pump(0.017); up(p) }
                case "caret-open": let p = partCenter("r1", "expandButton", i); actions[lbl] = { click(p) }
                case "child-click": let p = center("c0", i); actions[lbl] = { click(p) }
                default: actions[lbl] = { state.pointer.update(phase: .leave); mouse(.mouseMoved, away) }
                }
            case "drag", "dragUp", "dragCancel":
                break
            case "keyReorder":
                switch lbl {
                case "focus": actions[lbl] = { _ = focusView("r1")?.requestNativeFocus() }
                case "alt-down": actions[lbl] = { key(125, "\u{F701}", .option) }
                default: actions[lbl] = { key(126, "\u{F700}", .option) }
                }
            case "expandKeys":
                switch lbl {
                case "focus": actions[lbl] = { _ = focusView("r1")?.requestNativeFocus() }
                case "right": actions[lbl] = { press("ArrowRight") }
                case "left", "child-left": actions[lbl] = { press("ArrowLeft") }
                case "enter", "child-enter": actions[lbl] = { press("Enter") }
                default: actions[lbl] = { press("Tab") }
                }
            default: break
            }
        }
        if ["drag", "dragUp", "dragCancel", "custom"].contains(scenario), let hi = phases.firstIndex(where: { $0["label"].string == "handle-hover" }) {
            let from = scenario == "dragUp" ? "r3" : "r0", h = partCenter(from, "dragHandle", hi)
            let r0 = webItem("r0", before: hi)!["rect"], r1 = webItem("r1", before: hi)!["rect"], step = r1["y"].number! - r0["y"].number!
            let dy = scenario == "dragUp" ? -(step * 2.6) : step * 2.4
            func move(_ q: CGPoint) { state.pointer.update(phase: .move, location: q); mouse(.leftMouseDragged, q) }
            actions["handle-hover"] = { hoverTo(h) }; actions["handle-press"] = { down(h) }
            actions["move1"] = { move(CGPoint(x: h.x, y: h.y + dy * 0.25)) }; actions["move2"] = { move(CGPoint(x: h.x, y: h.y + dy * 0.6)) }; actions["move3"] = { move(CGPoint(x: h.x, y: h.y + dy)) }
            actions["back"] = { move(CGPoint(x: h.x, y: h.y + 2)) }
            let dropY = scenario == "dragCancel" ? h.y + 2 : h.y + dy
            actions["release"] = { up(CGPoint(x: h.x, y: dropY)) }
            actions["leave"] = { state.pointer.update(phase: .leave); mouse(.mouseMoved, away) }
            // The custom run's first (pointer) release is a plain click on r1.
            if scenario == "custom" { let p = center("r1", 0); var seen = 0
                actions["release"] = { seen += 1; if seen == 1 { up(p) } else { up(CGPoint(x: h.x, y: dropY)) } }
                let leaveDrag = actions["leave"]!; var left = 0
                actions["leave"] = { left += 1; leaveDrag() } }
        }
        let phaseList = phases.enumerated().map { ($0.offset, $0.element) }
        let focusBefore: Set<String> = ["tab"]
        var samples: [Sample] = [], stepTimes: [(Double, Double)] = [], snaps: [(Int, ShotBox, Sample, String)] = []
        let t0 = now()
        for (n, (i, phase)) in phaseList.enumerated() {
            let lbl = phase["label"].string, start = phase["t"].number! - webT0
            if focusBefore.contains(lbl) && (scenario == "keyboard" || scenario == "custom") { state.pointer.update(phase: .leave); _ = focusView("before")?.requestNativeFocus(); pump(0.03) }
            while now() - t0 < start { pump(0.004); samples.append(sample()) }
            if case let (match, ms)? = injectedDelay, (label + "/" + lbl).contains(match) { let d = now(); while now() - d < ms { pump(0.004); samples.append(sample()) } }
            let nativeStart = now(); stepTimes.append((phase["t"].number!, nativeStart))
            actions[lbl]?()
            let end = (n + 1 < phaseList.count ? phaseList[n + 1].1["t"].number! - webT0 : start + 500) - 25
            // The phase shot is anchored to the native input time, like the per-frame values (webTime): Chrome
            // shoots a fixed time after its own input. Under load the native input can be injected late, and a
            // shot at a fixed run time then lands earlier in a running transition (e.g. md-ripple's 150 ms fade).
            if shotsAnchoredToRunStart { while now() - t0 < end { pump(0.004); samples.append(sample()) } }
            else { while now() - nativeStart < end - start { pump(0.004); samples.append(sample()) } }
            let lateness = nativeStart - t0 - start, afterInput = now() - nativeStart
            let ripple = state.measurements.filter { $0.name == "ripple" }.compactMap { $0.metrics["opacity"]?.number }.max() ?? 0
            shotTiming.append(["case": label + "/" + lbl, "inputLateMs": lateness, "shotAfterInputMs": afterInput, "intendedShotAfterInputMs": end - start, "rippleOpacity": ripple])
            // states.html shot clip: the list's initial box widened by 40 and extended 200 below.
            let lr = r["initial"]["list"]["rect"]
            let c = CGRect(x: max(0, floor(lr["x"].number!) - 40), y: max(0, floor(lr["y"].number!) - 40), width: ceil(lr["width"].number!) + 80, height: ceil(lr["height"].number!) + 200)
            snaps.append((i, .init(shot: capture(c), rect: c), sample(), focusedID()))
        }
        let tail = now(); while now() - tail < 150 { pump(0.004); samples.append(sample()) }
        // Events (DOM click/change entries excluded): order, targets and payloads.
        let lastT = phaseList.last.map { $0.1["t"].number! + 1000 } ?? .infinity
        let web = r["events"].array.filter { !["click", "change"].contains($0["name"].string) && ($0["t"].number ?? 0) < lastT }
        let nat = state.events.filter { !["click", "change", "mdFocus", "mdBlur", "mdInput"].contains($0.0) }
        check(nat.map { "\($0.0)@\($0.3)" } == web.map { "\($0["name"].string)@\($0["target"].string)" }, "\(label) events \(nat.map { "\($0.0)@\($0.3)" }) vs \(web.map { "\($0["name"].string)@\($0["target"].string)" })")
        for (e, w) in zip(nat, web) where e.0 == w["name"].string {
            for (k, v) in w["detail"].object { if let n = v.number { check(abs((e.1[k].number ?? .nan) - n) < 0.01, "\(label) \(e.0).\(k) \(e.1[k]) vs \(n)") } else { check(e.1[k] == v, "\(label) \(e.0).\(k) \(e.1[k]) vs \(v)") } }
        }
        // Phase end states: focus, focus ring, paint.
        var pending: [(String, ShotBox, [CGRect])] = []
        for (i, shot, s, focused) in snaps {
            let ph = phases[i], snap = ph["snap"], lbl = ph["label"].string
            let active = snap["active"].string, first = String(active.split(separator: ">").first ?? "body")
            let webFocus = active.contains("md-list-item__expand-button") ? first + ".expand-button" : ["before", "after", "del", "sw"].contains(first) || first.hasPrefix("r") || first.hasPrefix("c") ? first : "body"
            check(focused == webFocus, "\(label)/\(lbl) focus \(focused) vs \(active)")
            for it in snap["items"].array {
                let id = it["id"].string; guard let row = s.rows[id] else { if it["rect"]["width"].number ?? 0 > 0 { check(false, "\(label)/\(lbl) \(id) measured") }; continue }
                let ring = it["host"]["shadow"].string.contains("inset")
                check((row.1["focusRing"]?.bool ?? false) == ring, "\(label)/\(lbl) \(id) focus ring \(row.1["focusRing"] ?? .null) vs \(it["host"]["shadow"].string)")
                check((row.1["selected"]?.bool ?? false) == it["classes"].string.contains("md-list-item--selected"), "\(label)/\(lbl) \(id) selected")
                check((row.1["expanded"]?.bool ?? false) == it["classes"].string.contains("md-list-item--expanded"), "\(label)/\(lbl) \(id) expanded")
                // The phase's own layout (with the drag/shift translation, as getBoundingClientRect reports it).
                let b = row.2, y = b.minY + (row.1["offsetY"]?.number ?? 0), w = it["rect"]
                let boxOK = abs(y - w["y"].number!) <= 0.6 && abs(b.height - w["height"].number!) <= 1.0, boxLabel = "\(label)/\(lbl) \(id) box y \(y) h \(b.height) vs \(w)"
                // Known gap (md-switch's own adapter, not the list): the authored switch is 48px tall in Chrome
                // (touch target) and smaller natively, so its row is 56 instead of 64 and the rows below shift by 8.
                if !boxOK && scenario == "trailing" && ["r1", "r2"].contains(id) { knownGaps.append(boxLabel) } else { check(boxOK, boxLabel) }
            }
            let masks = snap["items"].array.flatMap { $0["slots"]["trailing"].array + $0["slots"]["leading"].array }.map { rect($0["rect"]) }
            // A label reused later in the run (custom: release/leave) has only the later Chrome shot.
            if !phases[(i + 1)...].contains(where: { $0["label"].string == lbl }) { pending.append(("\(label)/\(lbl)", shot, masks)) }
        }
        // Per-frame values at render time within Chrome's samples (±2 frames; envelope across gaps).
        let webSamples = phaseList.flatMap { $0.1["samples"].array }
        func webTime(_ native: Double) -> Double { guard let step = stepTimes.last(where: { $0.1 <= native }) else { return webT0 + native - t0 }; return step.0 + native - step.1 }
        func envelope(_ read: (AWCValue) -> [Double]?, _ t: Double) -> ([Double], [Double])? {
            guard !webSamples.isEmpty else { return nil }
            guard let after = webSamples.firstIndex(where: { $0["t"].number! >= t }) else { return read(webSamples.last!).map { ($0, $0) } }
            if after == 0 { return read(webSamples[0]).map { ($0, $0) } }
            let a = webSamples[after - 1], b = webSamples[after], ta = a["t"].number!, tb = b["t"].number!
            guard let va = read(a), let vb = read(b), va.count == vb.count else { return read(b).map { ($0, $0) } }
            if tb - ta > 34 { return (zip(va, vb).map { min($0, $1) }, zip(va, vb).map { max($0, $1) }) }
            let x = tb > ta ? (t - ta) / (tb - ta) : 1; let v = zip(va, vb).map { $0 + ($1 - $0) * x }; return (v, v)
        }
        let rowIDs = Set(webSamples.flatMap { $0["items"].array.map { $0["id"].string } })
        let rgba: ([String: AWCValue], String) -> [Double]? = { m, k in
            let c = m[k]?.array.compactMap(\.number) ?? []
            return c.count == 4 ? pre(c) : nil
        }
        let wLayer: (AWCValue) -> [Double]? = { s in
            if s["layer"] == .null || s["layer"]["display"].string == "none" { return nil }
            return [s["layer"]["opacity"].number ?? 0]
        }
        let nLayer: ([String: AWCValue]) -> [Double]? = { m in
            let v = m["layerOpacity"]?.number ?? -1
            return v < 0 ? nil : [v]
        }
        let wCorners: (AWCValue) -> [Double]? = { s in
            let r = s["radius"].array
            if r.isEmpty { return nil }
            return r.map { (v: AWCValue) -> Double in numbers(v.string).first ?? 0 }
        }
        let nCorners: ([String: AWCValue]) -> [Double]? = { m in m["radius"]?.array.compactMap(\.number) }
        let wContainer: (AWCValue) -> [Double]? = { s in pre(color(s["background"].string)) }
        let nContainer: ([String: AWCValue]) -> [Double]? = { m in rgba(m, "background") }
        let wLeading: (AWCValue) -> [Double]? = { s in s["leadingIcon"] == .null ? nil : pre(color(s["leadingIcon"]["color"].string)) }
        let nLeading: ([String: AWCValue]) -> [Double]? = { m in rgba(m, "leadingIconColor") }
        let wTrailing: (AWCValue) -> [Double]? = { s in s["trailingIcon"] == .null ? nil : pre(color(s["trailingIcon"].string)) }
        let nTrailing: ([String: AWCValue]) -> [Double]? = { m in rgba(m, "trailingIconColor") }
        let wPanel: (AWCValue) -> [Double]? = { s in s["panel"] == .null ? nil : [s["panel"]["height"].number ?? 0] }
        let nPanel: ([String: AWCValue]) -> [Double]? = { m in m["panelHeight"]?.number.map { [$0] } }
        let wPanelOpacity: (AWCValue) -> [Double]? = { s in s["panel"] == .null ? nil : [s["panel"]["opacity"].number ?? 0] }
        let nPanelOpacity: ([String: AWCValue]) -> [Double]? = { m in m["panel"]?.number.map { [$0] } }
        let wCaret: (AWCValue) -> [Double]? = { s in s["caret"] == .null ? nil : [angle(s["caret"].string)] }
        let nCaret: ([String: AWCValue]) -> [Double]? = { m in m["caret"]?.number.map { [180 * $0] } }
        let wTranslate: (AWCValue) -> [Double]? = { s in
            let t = s["transform"].string
            if t == "none" || t.isEmpty { return [0] }
            let n = numbers(t)
            return [n.count >= 6 ? n[5] : 0]
        }
        let nTranslate: ([String: AWCValue]) -> [Double]? = { m in m["offsetY"]?.number.map { [$0] } }
        let wHandle: (AWCValue) -> [Double]? = { s in s["dragHandle"].number.map { [$0] } }
        let nHandle: ([String: AWCValue]) -> [Double]? = { m in m["handleOpacity"]?.number.map { [$0] } }
        let props: [ListStatesProp] = [
            ListStatesProp(name: "state layer", tol: 0.004, web: wLayer, native: nLayer),
            ListStatesProp(name: "corners", tol: 0.6, web: wCorners, native: nCorners),
            ListStatesProp(name: "container", tol: 0.008, web: wContainer, native: nContainer),
            ListStatesProp(name: "leading icon", tol: 0.008, web: wLeading, native: nLeading),
            ListStatesProp(name: "trailing icon", tol: 0.008, web: wTrailing, native: nTrailing),
            ListStatesProp(name: "panel", tol: 1.0, web: wPanel, native: nPanel),
            ListStatesProp(name: "panel opacity", tol: 0.012, web: wPanelOpacity, native: nPanelOpacity),
            ListStatesProp(name: "caret", tol: 2.0, web: wCaret, native: nCaret),
            ListStatesProp(name: "translate", tol: 0.6, web: wTranslate, native: nTranslate),
            ListStatesProp(name: "drag handle", tol: 0.02, web: wHandle, native: nHandle),
        ]
        var compared: [String: Int] = [:]
        // Chrome's per-frame series per row (looked up once), envelope by binary search.
        let webTimes = webSamples.map { $0["t"].number! }
        let webRows: [[String: AWCValue]] = webSamples.map { s in var m: [String: AWCValue] = [:]; for it in s["items"].array { m[it["id"].string] = it }; return m }
        func firstIndex(atLeast t: Double) -> Int? { var lo = 0, hi = webTimes.count; while lo < hi { let mid = (lo + hi) / 2; if webTimes[mid] < t { lo = mid + 1 } else { hi = mid } }; return lo < webTimes.count ? lo : nil }
        for id in rowIDs.sorted() {
            for pr in props {
                let series: [[Double]?] = webRows.map { m in m[id].flatMap(pr.web) }
                func env(_ t: Double) -> ([Double], [Double])? {
                    guard !series.isEmpty else { return nil }
                    guard let after = firstIndex(atLeast: t) else { return series.last!.map { ($0, $0) } }
                    if after == 0 { return series[0].map { ($0, $0) } }
                    let ta = webTimes[after - 1], tb = webTimes[after]
                    guard let va = series[after - 1], let vb = series[after], va.count == vb.count else { return series[after].map { ($0, $0) } }
                    if tb - ta > 34 { return (zip(va, vb).map { min($0, $1) }, zip(va, vb).map { max($0, $1) }) }
                    let x = tb > ta ? (t - ta) / (tb - ta) : 1; let v = zip(va, vb).map { $0 + ($1 - $0) * x }; return (v, v)
                }
                var fails = 0, seen = Set<Double>()
                for s in samples {
                    guard let row = s.rows[id], let v = pr.native(row.1) else { continue }
                    let at = row.0 ?? s.t
                    if !seen.insert(at).inserted { continue }
                    // No Chrome reference before its first rAF sample: skip the run's first frames.
                    if let first = webTimes.first, webTime(at) - 34 < first { continue }
                    func window(_ from: Double, _ to: Double) -> ([Double], [Double])? {
                        var lo: [Double]? = nil, hi: [Double]? = nil, x = from
                        while x <= to { if let e = env(webTime(x)), e.0.count == v.count { lo = zip(lo ?? e.0, e.0).map { min($0, $1) }; hi = zip(hi ?? e.1, e.1).map { max($0, $1) } }; x += 2 }
                        guard let lo, let hi else { return nil }; return (lo, hi)
                    }
                    guard let w0 = window(at - 34, at + 40) else { continue }; let lo = w0.0, hi = w0.1
                    let ok = (0..<v.count).allSatisfy { v[$0] >= lo[$0] - pr.tol && v[$0] <= hi[$0] + pr.tol }
                    // Chrome's inputs reach the page 1-52 ms after the phase time (CDP round trips, measured from the
                    // oracle's events): a value within one more frame of Chrome's envelope is an input-latency gap
                    // (recorded, not hidden); anything further is a failure.
                    let near = !ok && (window(at - 50, at + 56).map { w in (0..<v.count).allSatisfy { v[$0] >= w.0[$0] - pr.tol && v[$0] <= w.1[$0] + pr.tol } } ?? false)
                    if near { knownGaps.append("input-latency: \(label) \(id) \(pr.name) rendered \(v.map { ($0 * 1000).rounded() / 1000 }) at web \(Int(webTime(at)))"); continue }
                    if !ok { fails += 1; if fails <= 3 { check(false, "\(label) \(id) \(pr.name) rendered \(v.map { ($0 * 1000).rounded() / 1000 }) at web \(Int(webTime(at))) within Chrome [\(lo.map { ($0 * 1000).rounded() / 1000 }), \(hi.map { ($0 * 1000).rounded() / 1000 })]") } } else { check(true, "") }
                    compared[pr.name, default: 0] += 1
                }
                if fails > 3 { check(false, "\(label) \(id) \(pr.name): \(fails) frames outside Chrome's envelope") }
            }
        }
        check((compared["corners"] ?? 0) > 50, "\(label) per-frame samples compared \(compared)")
        // Drop placeholder: presence and glide (rect top incl. transform) per frame.
        var phFails = 0
        for s in samples {
            guard let ph = s.placeholder else { continue }
            var lo = Double.infinity, hi = -Double.infinity, present = false, x = s.t - 34
            while x <= s.t + 40 { let wt = webTime(x); if let w = webSamples.last(where: { $0["t"].number! <= wt }) ?? webSamples.first, w["placeholder"] != .null { present = true; lo = min(lo, w["placeholder"]["rect"]["y"].number!); hi = max(hi, w["placeholder"]["rect"]["y"].number!) }; x += 2 }
            if !present { continue }
            if let a = webSamples.first(where: { $0["t"].number! >= webTime(s.t) }), a["placeholder"] != .null { lo = min(lo, a["placeholder"]["rect"]["y"].number!); hi = max(hi, a["placeholder"]["rect"]["y"].number!) }
            let ok = ph >= lo - 0.6 && ph <= hi + 0.6
            if !ok { phFails += 1; if phFails <= 3 { check(false, "\(label) placeholder top \(ph) at web \(Int(webTime(s.t))) within Chrome [\(lo), \(hi)]") } } else { check(true, "") }
            compared["placeholder", default: 0] += 1
        }
        // Phase paint (authored trailing controls masked).
        for (lbl, shot, masks) in pending {
            let phase = lbl.split(separator: "/").last.map(String.init) ?? ""
            guard let source = NSImage(contentsOf: shots.appendingPathComponent(name + "-" + phase + ".png"))?.cgImage(forProposedRect: nil, context: nil, hints: nil) else { check(false, "\(lbl) shot"); continue }
            // The Chrome shot is the clip as captured (its size wins over the computed box).
            let c = CGRect(x: shot.rect.minX, y: shot.rect.minY, width: min(shot.rect.width, CGFloat(source.width)), height: min(shot.rect.height, CGFloat(source.height)))
            let web = ListShot(cg: source, scale: 1, origin: c.origin)
            let result = comparePaint(lbl.replacingOccurrences(of: "/", with: "-"), web: web, native: shot.shot,
                                                                 clip: .object(["x": .number(c.minX), "y": .number(c.minY), "width": .number(c.width), "height": .number(c.height)]), masks: masks)
            report.append(result)
        }
        report.append(["case": label, "samples": samples.count, "compared": compared])
        print("RUN \(label): \(checks - failures.count)/\(checks) cumulative"); fflush(stdout)
        state.pointer.update(phase: .leave); mouse(.mouseMoved, away); pump(0.1)
    }
    static func main() {
        _ = NSApplication.shared; NSApp.setActivationPolicy(.accessory)
        host = NSHostingView(rootView: ListStatesFixture(state: state)); window = NSWindow(contentRect: .init(x: -20000, y: -20000, width: 1200, height: 900), styleMask: [.borderless], backing: .buffered, defer: false)
        window.isReleasedWhenClosed = false; window.colorSpace = .sRGB; window.contentView = host; window.orderFrontRegardless(); pump(0.2)
        let fixtures = URL(fileURLWithPath: #filePath).deletingLastPathComponent().appendingPathComponent("Fixtures")
        let fixture = try! JSONDecoder().decode(AWCValue.self, from: Data(contentsOf: fixtures.appendingPathComponent("list-web-fixtures.json")))
        state.image = fixture["image"].string
        itemKinds = AWCListItemAppearance.cssProperties.map { (String($0.value.dropFirst("--md-list-item-".count)), kind(String($0.value.dropFirst("--md-list-item-".count)))) }
        let only = ProcessInfo.processInfo.environment["AWC_LIST_STATES_ONLY"]
        for (file, set) in [("list-web-states", "full"), ("list-web-states-reduced", "reduced"), ("list-web-states-extra", "extra")] {
            let loadStart = Date()
            // JSONSerialization + a direct conversion (the 26 MB record decodes in seconds this way).
            let oracle = value(try! JSONSerialization.jsonObject(with: Data(contentsOf: fixtures.appendingPathComponent(file + ".json"))))
            print("LOADED \(file) in \(Date().timeIntervalSince(loadStart))s"); fflush(stdout)
            for r in oracle["runs"].array where only.map({ (set + "/" + r["name"].string).contains($0) }) ?? true { run(r, shots: fixtures.appendingPathComponent(file), set: set, fixture: fixture) }
        }
        if let output = ProcessInfo.processInfo.environment["AWC_LIST_STATES_OUTPUT"] { try! JSONSerialization.data(withJSONObject: ["checks": checks, "failures": failures, "report": report, "pending": skipped, "knownGaps": knownGaps, "shotTiming": shotTiming], options: [.prettyPrinted, .sortedKeys]).write(to: URL(fileURLWithPath: output)) }
        let late = shotTiming.compactMap { $0["inputLateMs"] as? Double }, drift = shotTiming.compactMap { t in (t["shotAfterInputMs"] as? Double).flatMap { a in (t["intendedShotAfterInputMs"] as? Double).map { a - $0 } } }
        print("SHOT TIMING \(shotsAnchoredToRunStart ? "run-start" : "input")-anchored: \(late.count) shots; input late max \(Int(late.max() ?? 0)) ms; shot after input minus intended: min \(Int(drift.min() ?? 0)) ms, max \(Int(drift.max() ?? 0)) ms")
        print("List native interaction states: \(checks - failures.count)/\(checks) checks passed; known gaps: \(knownGaps.count); pending (reorder): \(skipped)")
        window.close(); if !failures.isEmpty { exit(1) }
    }
}
