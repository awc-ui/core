import AppKit
import SwiftUI
import Observation
@testable import AWCUI

// 9-14 (S7-4-01): the four md-navigation-rail members no suite exercised before the s7-4 audit.
//  toggleLabel            the accessibility label of the expand toggle (default "Toggle navigation");
//  disableFocusManagement the focus order: with the flag the rail does not rove (ArrowDown leaves focus where it is),
//                         without it the arrow moves focus (and the tab stop) to the next destination;
//  overflowIcon           paint of the overflow trigger against Mac Chrome 153 (rail-members.html -> rail-web-members.json:
//                         the trigger box and every pixel of it, column and bar) plus a negative control (the default icon differs);
//  mdSubmenuToggle        the host's event log: name, target and `open` payload when a destination's submenu opens and closes.
@Observable final class RailMembersState {
    var epoch = 0
    var nodes: [AWCNode] = []
    var width = 420.0
    var height = 560.0
    var measurements: [AWCNativeInspectionNode] = []
    let pointer = AWCNativePointerState()
    @ObservationIgnored var events: [(name: String, detail: AWCValue, target: String)] = []
}
struct RailMembersFixture: View {
    let state: RailMembersState
    var body: some View {
        let epoch = state.epoch, theme = AWCTheme.generated(dark: false)
        let ids = railInspectionIDs(state.nodes)
        ZStack(alignment: .topLeading) {
            AWCNativeView(node: AWCNode(id: "before", tag: "md-button", properties: ["variant": "text"], children: [.text("B")])).offset(x: 0, y: -10).opacity(0.01)
            AWCNativeScope {
                VStack(alignment: .leading, spacing: 0) {
                    ForEach(state.nodes) { n in AWCNativeView(node: n) { e in state.events.append((e.name, e.detail, e.nodeID)) } }
                }
                .frame(width: state.width, height: state.height, alignment: .topLeading)
            }
            .offset(x: 24, y: 24)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .environment(\.awcNativePointerState, state.pointer)
        .awcTheme(theme)
        .awcNativeInspection(rootID: ids.joined(separator: "|"), coordinateSpace: "awc-native-preview") { if state.epoch == epoch { state.measurements = $0 } }
        .id(epoch)
        .background(theme.background).coordinateSpace(name: "awc-native-preview")
    }
}
@main @MainActor enum NativeNavigationRailMembersIntegration {
    static let state = RailMembersState()
    static var host: NSHostingView<RailMembersFixture>!, window: NSWindow!
    static var checks = 0, failures: [String] = []
    static func check(_ value: Bool, _ name: String) { checks += 1; if !value { failures.append(name); print("FAIL: " + name); fflush(stdout) } }
    static func pump(_ d: Double = 0.05) { let end = Date().addingTimeInterval(d); repeat {
        host.layoutSubtreeIfNeeded(); host.displayIfNeeded(); _ = RunLoop.current.run(mode: .default, before: Date().addingTimeInterval(0.004)) } while Date() < end }
    static func mouse(_ kind: NSEvent.EventType, _ p: CGPoint) {
        let point = host.convert(.init(x: p.x, y: host.isFlipped ? p.y : host.bounds.height - p.y), to: nil)
        window.sendEvent(NSEvent.mouseEvent(with: kind, location: point, modifierFlags: [], timestamp: ProcessInfo.processInfo.systemUptime, windowNumber: window.windowNumber, context: nil, eventNumber: 1, clickCount: 1, pressure: kind == .leftMouseUp ? 0 : 1)!)
    }
    static func key(_ code: UInt16, _ text: String) {
        for type in [NSEvent.EventType.keyDown, .keyUp] {
            window.sendEvent(NSEvent.keyEvent(with: type, location: .zero, modifierFlags: [], timestamp: ProcessInfo.processInfo.systemUptime, windowNumber: window.windowNumber, context: nil, characters: text, charactersIgnoringModifiers: text, isARepeat: false, keyCode: code)!)
        }
    }
    // 9-40: activating a dropdown destination pops up a native NSMenu, and NSMenu.popUp runs its own modal tracking loop that returns only
    // when the menu is dismissed. The fixture used to assume that tracking "returns at once" and so hung (the main thread sat in
    // -[NSMenuTrackingSession startRunningMenuEventLoop:] for the rest of the run) whenever nothing dismissed the menu. A user dismisses it
    // with Escape, so the fixture does the same from a main-queue block that runs inside the tracking loop, and a watchdog turns a menu
    // that Escape does not close into a named failure after 10 s instead of an open-ended wait.
    static var keyInFlight = false, escapeSent = false
    static func keyDismissingMenu(_ code: UInt16, _ text: String) {
        keyInFlight = true; escapeSent = false
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
            guard keyInFlight else { return }
            escapeSent = true
            for type in [NSEvent.EventType.keyDown, .keyUp] {
                if let e = NSEvent.keyEvent(with: type, location: .zero, modifierFlags: [], timestamp: ProcessInfo.processInfo.systemUptime, windowNumber: 0, context: nil, characters: "\u{1b}", charactersIgnoringModifiers: "\u{1b}", isARepeat: false, keyCode: 53) { NSApp.postEvent(e, atStart: false) }
            }
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 10) {
            guard keyInFlight else { return }
            print("FAIL: mdSubmenuToggle: the destination menu was still open 10 s after Escape (escapeSent=\(escapeSent))"); fflush(stdout); exit(1)
        }
        key(code, text); keyInFlight = false
    }
    static func all(_ v: NSView) -> [NSView] { [v] + v.subviews.flatMap(all) }
    static func focusView(_ id: String) -> AWCNativeButtonFocusView? { all(host).compactMap { $0 as? AWCNativeButtonFocusView }.first { $0.accessibilityIdentifier() == id } }
    static func focusedID() -> String { (window.firstResponder as? AWCNativeButtonFocusView)?.accessibilityIdentifier() ?? "body" }
    static func m(_ id: String, _ name: String) -> AWCNativeInspectionNode? {
        state.measurements.first { $0.name == name && ($0.id == id || $0.id.hasPrefix(id + ":") || $0.id.hasSuffix(":" + id) || $0.id.contains(":" + id + ":") || $0.id.hasPrefix(id + ".")) }
    }
    static func tab(_ id: String, _ label: String, _ icon: String, children: [AWCNode] = []) -> AWCNode {
        AWCNode(id: id, tag: "md-navigation-rail-tab", properties: ["label": .string(label), "icon": .string(icon), "value": .string(id)], children: children)
    }
    static func rail(_ props: [String: AWCValue], tabs: [AWCNode]? = nil) -> [AWCNode] {
        var p: [String: AWCValue] = ["label": .string("Mail"), "activeIndex": .number(0)]; for (k, v) in props { p[k] = v }
        return [AWCNode(id: "r", tag: "md-navigation-rail", properties: p, children: tabs ?? [tab("t0", "Inbox", "inbox"), tab("t1", "Outbox", "send"), tab("t2", "Trash", "delete")])]
    }
    static func show(_ nodes: [AWCNode], width: Double = 420, height: Double = 560) {
        _ = window.makeFirstResponder(nil)
        state.nodes = nodes; state.width = width; state.height = height; state.events = []; state.measurements = []
        state.pointer.update(phase: .leave); state.epoch += 1; pump(0.7)
    }
    static func click(_ id: String, tag: String = "md-navigation-rail-tab") -> Bool {
        guard let b = m(id, tag)?.bounds else { return false }
        let p = CGPoint(x: b.midX, y: b.midY)
        state.pointer.update(phase: .move, location: p); pump(0.03)
        state.pointer.update(phase: .down, location: p); mouse(.leftMouseDown, p); pump(0.05)
        mouse(.leftMouseUp, p); state.pointer.update(phase: .up, location: p); pump(0.3)
        return true
    }
    static func toggleLabels() -> [String] {
        all(host).compactMap { $0 as? AWCNativeButtonFocusView }.filter { ($0.accessibilityIdentifier() ?? "").hasSuffix("-toggle") }.map { $0.accessibilityLabel() ?? "" }
    }
    // toggleLabel
    static func toggleLabelCases() {
        show(rail(["expandable": .bool(true)]))
        let d = toggleLabels(); check(d == ["Toggle navigation"], "toggleLabel default: toggle accessibility label \(d)")
        show(rail(["expandable": .bool(true), "toggleLabel": .string("Open the mail menu")]))
        let c = toggleLabels(); check(c == ["Open the mail menu"], "toggleLabel custom: toggle accessibility label \(c)")
        show(rail(["expandable": .bool(true), "toggleLabel": .string("Zona de navigare")]))
        let n = toggleLabels(); check(n == ["Zona de navigare"], "toggleLabel second value: toggle accessibility label \(n)")
        print("toggleLabel checked: default \(d) custom \(c)"); fflush(stdout)
    }
    // disableFocusManagement
    static func stops() -> [Bool] { ["t0", "t1", "t2"].map { m($0, "md-navigation-rail-tab")?.metrics["tabStop"]?.bool ?? false } }
    static func focusCases() {
        for disabled in [false, true] {
            let name = "disableFocusManagement=\(disabled)"
            show(rail(disabled ? ["disableFocusManagement": .bool(true)] : [:]))
            let before = stops()
            check(before == [true, false, false], "\(name): the active destination is the tab stop before any key \(before)")
            _ = focusView("t0")?.requestNativeFocus(showIndicator: true); pump(0.2)
            check(focusedID() == "t0", "\(name): destination t0 takes focus (\(focusedID()))")
            key(125, "\u{F701}"); pump(0.3)
            let after = focusedID(), s = stops()
            if disabled {
                check(after == "t0", "\(name): ArrowDown does not move focus (\(after))")
                check(s == [true, false, false], "\(name): tab stop stays on the active destination \(s)")
            } else {
                check(after == "t1", "\(name): ArrowDown moves focus to the next destination (\(after))")
                check(s == [false, true, false], "\(name): the roving tab stop follows focus \(s)")
            }
            print("\(name): after ArrowDown focus \(after) stops \(s)"); fflush(stdout)
        }
    }
    // mdSubmenuToggle
    static func submenuCases() {
        let menu = AWCNode(id: "mn", tag: "md-menu", properties: [:], children: [
            AWCNode(id: "mi0", tag: "md-menu-item", properties: ["headline": .string("Work"), "selected": .bool(true)]),
            AWCNode(id: "mi1", tag: "md-menu-item", properties: ["headline": .string("Personal")])], slot: "submenu")
        show(rail(["variant": .string("expanded")], tabs: [tab("t0", "Inbox", "inbox"), tab("t1", "Folders", "folder", children: [menu])]))
        check(focusView("t1") != nil, "mdSubmenuToggle: the dropdown destination is on screen")
        _ = focusView("t1")?.requestNativeFocus(showIndicator: true); pump(0.2); keyDismissingMenu(36, "\r"); pump(0.6)
        // The headless macOS host's menu tracking returns at once, so the open event is followed by its close event in the same pass:
        // the log must hold exactly [open=true, open=false] for the destination (payload `open`), in that order.
        let toggles = state.events.filter { $0.name == "mdSubmenuToggle" }
        let opened = toggles.filter { $0.detail["open"].bool == true }, closed = toggles.filter { $0.detail["open"].bool == false }
        check(toggles.count == 2 && toggles.allSatisfy { $0.target == "t1" } && toggles.first?.detail["open"].bool == true && toggles.last?.detail["open"].bool == false, "mdSubmenuToggle open then close payloads: \(state.events.map { "\($0.name)@\($0.target)=\($0.detail)" })")
        print("mdSubmenuToggle menu dismissed by Escape: \(escapeSent)"); print("mdSubmenuToggle open \(opened.map { "\($0.target)=\($0.detail)" }) close \(closed.map { "\($0.target)=\($0.detail)" })"); fflush(stdout)
    }
    // overflowIcon paint
    static func grid(_ cg: CGImage, scale k: Int, _ r: CGRect, originX ox: Double, originY oy: Double) -> [Double]? {
        let x = Int(r.minX.rounded()), y = Int(r.minY.rounded()), w = Int(r.width.rounded()), h = Int(r.height.rounded())
        let crop = CGRect(x: (Double(x) - ox) * Double(k), y: (Double(y) - oy) * Double(k), width: Double(w * k), height: Double(h * k))
        guard let c = cg.cropping(to: crop), c.width == w * k, c.height == h * k else { return nil }
        var buf = [UInt8](repeating: 0, count: c.width * c.height * 4)
        buf.withUnsafeMutableBytes { raw in
            let ctx = CGContext(data: raw.baseAddress, width: c.width, height: c.height, bitsPerComponent: 8, bytesPerRow: c.width * 4, space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
            ctx.draw(c, in: .init(x: 0, y: 0, width: c.width, height: c.height))
        }
        var out = [Double](repeating: 0, count: w * h * 3); let n = Double(k * k)
        for py in 0..<h { for px in 0..<w { for ch in 0..<3 { var s = 0.0
            for yy in (py * k)..<(py * k + k) { for xx in (px * k)..<(px * k + k) { s += Double(buf[(yy * c.width + xx) * 4 + ch]) } }
            out[(py * w + px) * 3 + ch] = s / n } } }
        return out
    }
    static func compare(_ a: [Double], _ b: [Double]) -> (mean: Double, over32: Int, n: Int) {
        var sum = 0.0, bad = 0; let n = a.count / 3
        for i in 0..<n { var d = 0.0; for c in 0..<3 { d = max(d, abs(a[i * 3 + c] - b[i * 3 + c])) }; sum += d; if d > 32 { bad += 1 } }
        return (sum / Double(max(n, 1)), bad, n)
    }
    static func nativeTrigger(_ c: AWCValue, icon: String?, shots: URL) -> (CGRect, [Double], [Double])? {
        var nodes = try! JSONDecoder().decode([AWCNode].self, from: Data(c["nodesJSON"].string.utf8))
        if icon != nil { nodes = nodes.map { var n = $0; n.properties["overflowIcon"] = .string(icon!); return n } }
        else { nodes = nodes.map { var n = $0; n.properties["overflowIcon"] = nil; return n } }
        let horizontal = nodes.first?.properties["orientation"]?.string == "horizontal"
        show(nodes, width: c["width"].number ?? 420, height: horizontal ? 120 : 560)
        guard let t = m("rail0", "overflow-trigger") else { check(false, "\(c["name"].string): overflow trigger measured"); return nil }
        guard let src = NSImage(contentsOf: shots.appendingPathComponent(c["name"].string + ".png"))?.cgImage(forProposedRect: nil, context: nil, hints: nil) else { check(false, "\(c["name"].string): source shot"); return nil }
        let clip = c["clip"], ox = clip["x"].number ?? 0, oy = clip["y"].number ?? 0
        let wr = c["parts"]["overflow-trigger"]["rect"]
        let r = CGRect(x: wr["x"].number ?? 0, y: wr["y"].number ?? 0, width: wr["width"].number ?? 0, height: max(8, (wr["height"].number ?? 0) - 24))  // the icon band: the label line below is not the member under test
        guard let web = grid(src, scale: max(1, Int((Double(src.width) / (clip["width"].number ?? 1)).rounded())), r, originX: ox, originY: oy) else { check(false, "\(c["name"].string): web crop"); return nil }
        let rr = host.isFlipped ? r : CGRect(x: r.minX, y: host.bounds.height - r.maxY, width: r.width, height: r.height)
        let b = host.bitmapImageRepForCachingDisplay(in: rr)!; host.cacheDisplay(in: rr, to: b)
        guard let nat = grid(b.cgImage!, scale: max(1, Int((Double(b.pixelsWide) / r.width).rounded())), r, originX: r.minX, originY: r.minY) else { check(false, "\(c["name"].string): native crop"); return nil }
        return (r, web, nat)
    }
    static func main() {
        _ = NSApplication.shared; NSApp.setActivationPolicy(.accessory)
        let screen = NSScreen.main?.frame ?? .init(x: 0, y: 0, width: 1440, height: 900)
        host = NSHostingView(rootView: RailMembersFixture(state: state)); window = NSWindow(contentRect: .init(x: screen.minX, y: screen.minY, width: 1200, height: 700), styleMask: [.borderless], backing: .buffered, defer: false)
        window.isReleasedWhenClosed = false
        window.colorSpace = .sRGB; window.alphaValue = 0; window.ignoresMouseEvents = true; window.hasShadow = false
        window.contentView = host; window.orderFrontRegardless(); pump(0.3)
        let only = ProcessInfo.processInfo.environment["AWC_RAIL_MEMBERS_ONLY"]
        if only == nil || only == "toggleLabel" { toggleLabelCases() }
        if only == nil || only == "focus" { focusCases() }
        if only == nil || only == "submenu" { submenuCases() }
        if only == nil || only == "icon" { iconCases2() }
        print("Navigation rail members: \(checks - failures.count)/\(checks) checks passed")
        window.close(); if !failures.isEmpty { exit(1) }
    }
    static func iconCases2() {
        let fixtures = URL(fileURLWithPath: #filePath).deletingLastPathComponent().appendingPathComponent("Fixtures")
        guard let data = try? Data(contentsOf: fixtures.appendingPathComponent("rail-web-members.json")) else { check(false, "rail-web-members fixture"); return }
        let oracle = try! JSONDecoder().decode(AWCValue.self, from: data)
        for c in oracle["cases"].array {
            let name = c["name"].string, shots = fixtures.appendingPathComponent("rail-web-members")
            check(c["nodesJSON"].string.contains("\"overflowIcon\": \"star\""), "\(name): the oracle case carries overflowIcon=star")
            guard let (r, web, nat) = nativeTrigger(c, icon: "star", shots: shots) else { continue }
            let hit = compare(web, nat)
            check(hit.n > 0 && hit.mean <= 5.0 && Double(hit.over32) / Double(max(hit.n, 1)) <= 0.06, "\(name): overflowIcon=star trigger pixels match Chrome (mean \(hit.mean), >32: \(hit.over32)/\(hit.n), box \(r))")
            // Negative control: the same rail without the property draws the default icon, which Chrome's star must not match.
            guard let (_, _, def) = nativeTrigger(c, icon: nil, shots: shots) else { continue }
            let ctl = compare(web, def), own = compare(nat, def)
            check(own.over32 > 0 && ctl.mean >= 1.8 * hit.mean, "\(name): default icon differs from the star (mean vs Chrome \(ctl.mean) against \(hit.mean); native star vs default >32: \(own.over32))")
            if let t = m("rail0", "overflow-trigger") { check(t.metrics["icon"]?.string == nil || t.metrics["icon"]?.string == "more_horiz", "\(name): control reports the default icon \(String(describing: t.metrics["icon"]))") }
            print("\(name): star mean \(hit.mean) >32 \(hit.over32)/\(hit.n); control mean \(ctl.mean)"); fflush(stdout)
        }
    }
}
/// Every node the fixture inspects: the rails, their toggles, destinations and slotted children.
func railInspectionIDs(_ nodes: [AWCNode]) -> [String] {
    var out: [String] = []
    for n in nodes { out.append(n.id); out.append(n.id + "-toggle"); for c in n.children { out.append(c.id); for g in c.children { out.append(g.id) } } }
    return out
}
