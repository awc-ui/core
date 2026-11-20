import AppKit
import SwiftUI
import Observation
import AWCUI

// Shared d3 fixture (Tests/Fixtures/cursor-hidden-web.json, Chrome 153): the effective CSS cursor at part centres
// (hover and :active press), `hidden` hosts (display: none) and hidden children (no slot, no gap, still coordinated),
// accordion roving onto a hidden item (focus stays), and md-list names from `labelledby`.
@Observable final class CHState {
    var nodes: [AWCNode] = []; var ids = ""; var measured: [AWCNativeInspectionNode] = []; var epoch = 0
    var events: [(name: String, target: String, detail: AWCValue)] = []
    let pointer = AWCNativePointerState()
}
struct CHFixture: View {
    let state: CHState
    func record(_ e: AWCEvent) { state.events.append((e.name, e.nodeID, e.detail)) }
    var body: some View {
        let epoch = state.epoch
        // AWCNativeScope: one document (shared IDREF/interaction scope) for the sibling roots.
        AWCNativeScope { VStack(alignment: .leading, spacing: 8) {
            ForEach(state.nodes, id: \.id) { n in
                if ["md-card", "md-list", "md-accordion", "md-divider"].contains(n.tag) && n.properties["hidden"]?.bool != true {
                    AWCNativeView(node: n, onEvent: record).frame(maxWidth: .infinity, alignment: .leading)
                } else { AWCNativeView(node: n, onEvent: record) }
            }
        } }
        .frame(width: 360, alignment: .topLeading)
        .awcNativeInspection(rootID: state.ids, coordinateSpace: "awc-native-preview") { if state.epoch == epoch { state.measured = $0 } }
        .id(state.epoch)
        .frame(width: 400, height: 900, alignment: .topLeading)
        .environment(\.awcNativePointerState, state.pointer)
        .environment(\.awcCursorTracksInjectedPointer, true)
        .background(Color.white).awcTheme(.generated()).environment(\.colorScheme, .light)
        .transaction { $0.disablesAnimations = true }
        .coordinateSpace(name: "awc-native-preview")
    }
}
@main @MainActor enum NativeCursorHiddenIntegration {
    static let state = CHState()
    static var host: NSHostingView<CHFixture>!, window: NSWindow!
    static var checks = 0, failures: [String] = []
    static func check(_ ok: Bool, _ name: String) { checks += 1; if !ok { failures.append(name); print("FAIL: " + name); fflush(stdout) } }
    static func pump(_ d: Double = 0.05) {
        let end = Date().addingTimeInterval(d)
        repeat { while let e = NSApp.nextEvent(matching: .any, until: .distantPast, inMode: .default, dequeue: true) { NSApp.sendEvent(e) }
            host.layoutSubtreeIfNeeded(); _ = RunLoop.current.run(mode: .default, before: Date().addingTimeInterval(0.004)) } while Date() < end
    }
    static func point(_ p: CGPoint) -> CGPoint { host.convert(.init(x: p.x, y: host.isFlipped ? p.y : host.bounds.height - p.y), to: nil) }
    static func mouse(_ kind: NSEvent.EventType, _ p: CGPoint) {
        NSApp.sendEvent(NSEvent.mouseEvent(with: kind, location: point(p), modifierFlags: [], timestamp: ProcessInfo.processInfo.systemUptime,
            windowNumber: window.windowNumber, context: nil, eventNumber: 1, clickCount: 1, pressure: kind == .leftMouseUp ? 0 : 1)!)
    }
    static func key(_ code: UInt16, _ text: String) {
        for type in [NSEvent.EventType.keyDown, .keyUp] {
            NSApp.sendEvent(NSEvent.keyEvent(with: type, location: .zero, modifierFlags: [], timestamp: ProcessInfo.processInfo.systemUptime,
                windowNumber: window.windowNumber, context: nil, characters: text, charactersIgnoringModifiers: text, isARepeat: false, keyCode: code)!)
            pump(0.03)
        }
    }
    static func node(_ v: AWCValue) -> AWCNode {
        let tag = v["tag"].string, id = v["id"].string
        var props: [String: AWCValue] = [:]; if case .object(let o) = v["properties"] { for (k, x) in o where k != "id" && k != "slot" { props[k] = x } }
        let slot = v["properties"]["slot"] == .null ? nil : v["properties"]["slot"].string
        let kids = v["children"].array.map(node)
        // Plain referenced elements (h2/span with an id) carry their text in the native IDREF scope.
        if tag == "h2" || tag == "span" { return AWCNode(id: id, tag: "#text", properties: ["text": .string(kids.compactMap { $0.properties["text"]?.string }.joined())]) }
        return AWCNode(id: id, tag: tag, properties: props, children: kids, slot: slot)
    }
    static func ids(_ v: AWCValue) -> [String] { [v["id"].string] + v["children"].array.flatMap(ids) }
    static func hostNode(_ id: String, tag: String) -> AWCNativeInspectionNode? {
        let c = state.measured.filter { $0.id.hasPrefix(id + ":") }
        return c.first { $0.name == tag } ?? c.max { $0.bounds.width * $0.bounds.height < $1.bounds.width * $1.bounds.height }
    }
    /// The visible pointer: `auto` (over a control) and `default` both show the arrow.
    static func shown(_ css: String?) -> String { css == nil || css == "auto" || css == "default" ? "arrow" : css! }
    static func main() throws {
        _ = NSApplication.shared; NSApp.setActivationPolicy(.accessory)
        let url = URL(fileURLWithPath: #filePath).deletingLastPathComponent().appendingPathComponent("Fixtures/cursor-hidden-web.json")
        let oracle = try JSONDecoder().decode(AWCValue.self, from: Data(contentsOf: url))
        host = NSHostingView(rootView: CHFixture(state: state))
        window = NSWindow(contentRect: .init(x: -20000, y: -20000, width: 400, height: 900), styleMask: [.borderless], backing: .buffered, defer: false)
        window.isReleasedWhenClosed = false; window.colorSpace = .sRGB; window.contentView = host; window.acceptsMouseMovedEvents = true
        window.makeKeyAndOrderFront(nil)
        defer { window.close() }
        let cases = oracle["cases"].array, results = oracle["results"].array
        for (c, r) in zip(cases, results) {
            let name = c["name"].string
            state.nodes = c["nodes"].array.map(node); state.ids = c["nodes"].array.flatMap(ids).joined(separator: "|")
            state.pointer.update(phase: .leave); AWCCursorArbiter.shared.reset(); _ = window.makeFirstResponder(nil)
            state.epoch += 1; pump(0.5)
            let tags = Dictionary(uniqueKeysWithValues: c["nodes"].array.flatMap { n -> [(String, String)] in
                func walk(_ v: AWCValue) -> [(String, String)] { [(v["id"].string, v["tag"].string)] + v["children"].array.flatMap(walk) }; return walk(n) })
            for p in r["probes"].array {
                let target = p["target"].string, part = p["part"].string, press = p["press"].bool == true
                let label = "\(name) \(target) \(part.isEmpty ? "host" : part)\(press ? " :active" : "")"
                let n = part.isEmpty ? hostNode(target, tag: tags[target] ?? "") : state.measured.first { $0.id.hasPrefix(target + ":") && $0.name == part }
                guard let n else { check(false, "\(label) measured"); continue }
                let at = CGPoint(x: n.bounds.midX, y: n.bounds.midY)
                state.pointer.update(phase: .move, location: at); pump(0.12)
                if press { state.pointer.update(phase: .down, location: at); mouse(.leftMouseDown, at); pump(0.2) }
                let native = AWCCursorArbiter.shared.current
                check(shown(native == .default ? "default" : native?.rawValue) == shown(p["cursor"] == .null ? nil : p["cursor"].string),
                      "\(label) cursor \(native?.rawValue ?? "none") vs Chrome \(p["cursor"].string)")
                if press { mouse(.leftMouseUp, at); state.pointer.update(phase: .up, location: at); pump(0.2) }
                state.pointer.update(phase: .leave); pump(0.08)
            }
            if case .object(let layout) = r["layout"] {
                for (id, l) in layout {
                    let tag = tags[id] ?? ""
                    if l["display"].string == "none" {
                        check(!state.measured.contains { $0.id.hasPrefix(id + ":") }, "\(name) \(id) hidden: no native node, layout or accessibility element")
                        continue
                    }
                    guard let n = hostNode(id, tag: tag) else { check(false, "\(name) \(id) measured"); continue }
                    let rect = l["rect"].array.compactMap(\.number)
                    let parentTop = l["parent"] == .null ? 0 : hostNode(l["parent"].string, tag: tags[l["parent"].string] ?? "")?.bounds.minY ?? .nan
                    check(abs((n.bounds.minY - parentTop) - rect[1]) <= 1 && abs(n.bounds.height - rect[3]) <= 1,
                          "\(name) \(id) y/height \(n.bounds.minY - parentTop)/\(n.bounds.height) vs Chrome \(rect[1])/\(rect[3])")
                }
            }
            if case .object(let names) = r["names"] {
                for (id, w) in names {
                    let got = hostNode(id, tag: "md-list")?.metrics["name"]?.string
                    check(got == w["name"].string, "\(name) \(id) accessible name \(got ?? "nil") vs Chrome \(w["name"].string)")
                }
            }
            // List-facing item events (Chrome order and payloads) for pointer actions.
            for k in r["keys"].array where k["action"]["type"].string == "click" {
                let a = k["action"], types = Set(c["events"].array.map(\.string))
                guard let row = state.measured.first(where: { $0.id.hasPrefix(a["target"].string + ":") && $0.name == a["part"].string }) else { check(false, "\(name) \(a["target"].string) row measured"); continue }
                let p = CGPoint(x: row.bounds.minX + min(24, row.bounds.width / 2), y: row.bounds.midY)
                state.events = []
                state.pointer.update(phase: .move, location: p); pump(0.05)
                state.pointer.update(phase: .down, location: p); mouse(.leftMouseDown, p); pump(0.05); mouse(.leftMouseUp, p); state.pointer.update(phase: .up, location: p); pump(0.4)
                func fmt(_ n: String, _ t: String, _ d: AWCValue) -> String {
                    let keys = ["index", "childIndex", "selected", "expanded", "value", "item"]
                    return "\(n)@\(t)" + keys.compactMap { key -> String? in let v = d[key]; return v == .null ? nil : "\(key)=\(v.string.isEmpty ? (v.bool.map { String($0) } ?? v.number.map { String(Int($0)) } ?? "") : v.string)" }.joined(separator: ",")
                }
                let nat = state.events.filter { types.contains($0.name) }.map { fmt($0.name, $0.target, $0.detail) }
                let web = k["events"].array.map { fmt($0["type"].string, $0["target"].string, $0["detail"]) }
                check(nat == web, "\(name) click \(a["target"].string) events \(nat) vs Chrome \(web)")
                state.pointer.update(phase: .leave); pump(0.1)
            }
            for k in r["keys"].array where k["action"] == .null {
                // A press focuses the first header; ArrowDown targets the hidden next item: the source's focusHeader() is a no-op there.
                if let h = state.measured.first(where: { $0.id.hasPrefix(k["focus"].string + ":") && $0.name == "header" }) {
                    let p = CGPoint(x: h.bounds.midX, y: h.bounds.midY)
                    state.pointer.update(phase: .down, location: p); mouse(.leftMouseDown, p); mouse(.leftMouseUp, p); state.pointer.update(phase: .up, location: p); pump(0.3)
                }
                key(125, "\u{F701}"); pump(0.15)
                guard let header = state.measured.first(where: { $0.id.hasPrefix(k["focusAfter"].string + ":") && $0.name == "header" }),
                      let responder = window.firstResponder as? NSView, responder !== host else { check(false, "\(name) roving focus measured"); continue }
                let f = responder.convert(responder.bounds, to: host), center = CGPoint(x: f.midX, y: host.isFlipped ? f.midY : host.bounds.height - f.midY)
                check(header.bounds.insetBy(dx: -2, dy: -2).contains(center), "\(name) ArrowDown onto a hidden item keeps focus on \(k["focusAfter"].string) (focus at \(center), header \(header.bounds))")
            }
        }
        print("\(failures.isEmpty ? "PASS" : "FAIL") NativeCursorHiddenIntegration: \(checks - failures.count)/\(checks) checks passed")
        if !failures.isEmpty { exit(1) }
    }
}
