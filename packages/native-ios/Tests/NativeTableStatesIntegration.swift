import AppKit
import SwiftUI
import Observation
import QuartzCore
@testable import AWCUI

// md-table family interaction against Mac Chrome 153 trusted-input runs (web-oracle states.json, 15 runs, and
// states-reduced-motion.json, 4 runs; fixture table-web-states.json shared byte-identically with Compose):
// pointer hover / press / click, selection (row, select-all, host property, single-mode trim), expansion (pointer,
// keyboard, toggle(), host property), sorting (labels, keyboard, setSort) with the consumer's reorder, pagination
// (buttons, setRowsPerPage, goToPage, silent clamp) with the consumer's paging, Tab order across the whole family,
// frozen-body wheel / thumb drag / keyboard scrolling, sticky container scrolling, loading / empty, pinColumn /
// setColumnVisibility and toolbar auto-binding. Per phase: application events (order and payloads), row / head /
// toolbar / pagination / scroll state, focus, the phase shot (flat pixels) and per-frame motion curves.

@Observable final class TableStatesState {
    var nodes: [AWCNode] = []
    var rtl = false
    var dark = false
    var width = 760.0
    var epoch = 0
    var reduced = false
    var inspect = "n0"
    var measurements: [AWCNativeInspectionNode] = []
    @ObservationIgnored var events: [(name: String, detail: AWCValue, t: Double, id: String)] = []
    @ObservationIgnored var consumer: (AWCEvent) -> Void = { _ in }
    @ObservationIgnored let pointer = AWCNativePointerState()
    @ObservationIgnored let table = AWCTableController()
    @ObservationIgnored let pagination = AWCTablePaginationController()
    /// A fresh scroll controller per run (the previous run's scrollports must not answer).
    var scroller = AWCTableScrollController()
    @ObservationIgnored let motion = AWCTableMotionRecorder()
    @ObservationIgnored var tableID = "n0"
    @ObservationIgnored var paginationID = "-"
}
struct TableStatesFixture: View {
    let state: TableStatesState
    var body: some View {
        let epoch = state.epoch, theme = AWCTheme.generated(dark: state.dark)
        ZStack(alignment: .topLeading) {
            VStack(alignment: .leading, spacing: 0) {
                ForEach(state.nodes) { n in
                    AWCNativeView(node: n) { e in state.events.append((e.name, e.detail, CACurrentMediaTime() * 1000, e.nodeID)); state.consumer(e) }
                }
            }
            .frame(width: state.width, alignment: .topLeading)
            .environment(\.layoutDirection, state.rtl ? .rightToLeft : .leftToRight)
            .offset(x: 24, y: 24)
            // The harness "Run" button (#bar, bottom right): the page's last tab stop after the fixture.
            AWCNativeView(node: AWCNode(id: "after", tag: "md-button", properties: ["variant": "text"], children: [.text("Run")])).offset(x: 1100, y: 850)
        }
        .awcTableController(state.table, for: state.tableID)
        .awcTablePaginationController(state.pagination, for: state.paginationID)
        .awcTableScrollController(state.scroller)
        .awcTableMotionRecorder(state.motion)
        .awcTableReducedMotion(state.reduced)
        .environment(\.awcNativePointerState, state.pointer)
        .scrollIndicators(.hidden)
        .awcTheme(theme)
        .awcNativeInspection(rootID: state.inspect, coordinateSpace: "awc-native-preview") { if state.epoch == epoch { state.measurements = $0 } }
        .id(epoch)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(theme.background)
        .coordinateSpace(name: "awc-native-preview")
    }
}

struct TSRaster {
    let w: Int, h: Int, px: [UInt8]
    func rgb(_ x: Int, _ y: Int) -> (Int, Int, Int) { let i = (y * w + x) * 4; return (Int(px[i]), Int(px[i + 1]), Int(px[i + 2])) }
    func flat(_ x: Int, _ y: Int, _ limit: Int) -> Bool {
        guard x > 0, y > 0, x + 1 < w, y + 1 < h else { return false }
        for c in 0..<3 {
            var lo = 255, hi = 0
            for dy in -1...1 { for dx in -1...1 { let v = Int(px[((y + dy) * w + x + dx) * 4 + c]); lo = min(lo, v); hi = max(hi, v) } }
            if hi - lo > limit { return false }
        }
        return true
    }
    static func from(_ image: CGImage, width: Int, height: Int) -> TSRaster {
        var buffer = [UInt8](repeating: 0, count: width * height * 4)
        buffer.withUnsafeMutableBytes { raw in
            let ctx = CGContext(data: raw.baseAddress, width: width, height: height, bitsPerComponent: 8, bytesPerRow: width * 4, space: CGColorSpace(name: CGColorSpace.sRGB)!,
                                bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
            ctx.interpolationQuality = .high
            ctx.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
        }
        return .init(w: width, h: height, px: buffer)
    }
}

@main @MainActor enum NativeTableStatesIntegration {
    static let state = TableStatesState()
    static var host: NSHostingView<TableStatesFixture>!, window: NSWindow!
    static var checks = 0, failures: [String] = [], report: [[String: Any]] = [], gaps: [String] = []
    static let env = ProcessInfo.processInfo.environment
    /// AWC_TABLE_TRACE: each phase is announced on stderr (interleaves with runtime warnings such as AttributeGraph cycles).
    static let trace = env["AWC_TABLE_TRACE"] != nil
    static var data: [[AWCValue]] = []
    static func dgSuffix() -> String {
        #if !canImport(AppKit)
        return AWCDG.suffix()
        #else
        return ""
        #endif
    }
    static func check(_ ok: Bool, _ message: @autoclosure () -> String) { checks += 1; if !ok { let m = message(); failures.append(m); print("FAIL: " + m + dgSuffix()); fflush(stdout) } }
    static func now() -> Double { CACurrentMediaTime() * 1000 }
    /// Runs the loop (events, layout, display) and records per-frame native samples.
    static var frames: [(t: Double, scroll: CGPoint?, container: CGPoint?)] = []
    static func pump(_ ms: Double) {
        let end = Date().addingTimeInterval(ms / 1000)
        repeat {
            while let e = NSApp.nextEvent(matching: .any, until: .distantPast, inMode: .default, dequeue: true) { NSApp.sendEvent(e) }
            host.layoutSubtreeIfNeeded(); host.displayIfNeeded()
            _ = RunLoop.current.run(mode: .default, before: Date().addingTimeInterval(0.004))
            frames.append((now(), frozenScroll(), containerScroll()))
        } while Date() < end
    }
    // MARK: Values
    static func value(_ a: Any) -> AWCValue {
        if let d = a as? [String: Any] { return .object(d.mapValues(value)) }
        if let arr = a as? [Any] { return .array(arr.map(value)) }
        if let s = a as? String { return .string(s) }
        if let n = a as? NSNumber { return CFGetTypeID(n) == CFBooleanGetTypeID() ? .bool(n.boolValue) : .number(n.doubleValue) }
        return .null
    }
    static func numbers(_ s: String) -> [Double] { var out: [Double] = [], cur = ""; for ch in s { if "0123456789.-e".contains(ch) { cur.append(ch) } else { if let v = Double(cur) { out.append(v) }; cur = "" } }; if let v = Double(cur) { out.append(v) }; return out }
    static func rgba(_ s: String) -> [Double] {
        let n = numbers(s)
        if s.hasPrefix("rgba"), n.count >= 4 { return [n[0] / 255, n[1] / 255, n[2] / 255, n[3]] }
        if s.hasPrefix("rgb"), n.count >= 3 { return [n[0] / 255, n[1] / 255, n[2] / 255, 1] }
        if s.hasPrefix("color(srgb"), n.count >= 3 { return [n[0], n[1], n[2], n.count > 3 ? n[3] : 1] }
        return [0, 0, 0, 0]
    }
    /// Rotation of a CSS `matrix(a, b, c, d, e, f)` in degrees.
    static func angle(_ m: String) -> Double { if m == "none" || m.isEmpty { return 0 }; let n = numbers(m); guard n.count >= 2 else { return 0 }; return atan2(n[1], n[0]) * 180 / .pi }
    static func translateY(_ m: String) -> Double { if m == "none" || m.isEmpty { return 0 }; let n = numbers(m); return n.count >= 6 ? n[5] : 0 }
    // MARK: Tree helpers
    static func walk(_ nodes: [AWCNode], _ f: (AWCNode) -> Void) { for n in nodes { f(n); walk(n.children, f) } }
    static func find(_ nodes: [AWCNode], _ pred: (AWCNode) -> Bool) -> [AWCNode] { var out: [AWCNode] = []; walk(nodes) { if pred($0) { out.append($0) } }; return out }
    static func update(_ id: String, _ f: (inout AWCNode) -> Void) {
        func go(_ n: inout AWCNode) -> Bool { if n.id == id { f(&n); return true }; for i in n.children.indices { if go(&n.children[i]) { return true } }; return false }
        for i in state.nodes.indices { if go(&state.nodes[i]) { return } }
    }
    static func bodyRows() -> [AWCNode] { find(state.nodes) { $0.tag == "md-table-body" }.first?.children.filter { $0.tag == "md-table-row" } ?? [] }
    static func bodyID() -> String? { find(state.nodes) { $0.tag == "md-table-body" }.first?.id }
    static func rowName(_ r: AWCNode) -> String {
        r.children.first { $0.tag == "md-table-cell" && $0.properties["padding"]?.string != "checkbox" }.map { awcCollapsedInlineText($0.authoredTextContent) } ?? ""
    }
    /// The row's first data cell in inline order as laid out (the source moves pinned cells in the light DOM; the native
    /// table pins visually, so the comparison reads the leftmost cell, or the rightmost in RTL).
    static func visualName(_ r: AWCNode) -> String {
        let all = r.children.filter { $0.tag == "md-table-cell" }
        // Pins / hidden columns re-sequence the cells: the table reports its display order of the authored cells.
        if let order = m(state.tableID)?.metrics["columnOrder"]?.array.compactMap({ $0.number.map(Int.init) }), !order.isEmpty,
           let first = order.compactMap({ $0 < all.count ? all[$0] : nil }).first(where: { $0.properties["padding"]?.string != "checkbox" }) {
            return awcCollapsedInlineText(first.authoredTextContent)
        }
        let cells = r.children.filter { $0.tag == "md-table-cell" && $0.properties["padding"]?.string != "checkbox" }
        let placed = cells.compactMap { c in m(c.id).map { (c, $0.bounds) } }.filter { $0.1.width > 0 }
        guard placed.count == cells.count, let first = (state.rtl ? placed.max { $0.1.maxX < $1.1.maxX } : placed.min { $0.1.minX < $1.1.minX }) else { return rowName(r) }
        return awcCollapsedInlineText(first.0.authoredTextContent)
    }
    static func m(_ id: String, _ part: String? = nil) -> AWCNativeInspectionNode? { state.measurements.first { $0.id == id + ":" + (part.map { "component." + $0 } ?? "component") } }
    static func center(_ id: String, _ part: String? = nil) -> CGPoint? { m(id, part).map { CGPoint(x: $0.bounds.midX, y: $0.bounds.midY) } }
    static func frozenScroll() -> CGPoint? { m(state.tableID, "frozen").map { CGPoint(x: $0.metrics["scrollLeft"]?.number ?? 0, y: $0.metrics["scrollTop"]?.number ?? 0) } }
    static func containerScroll() -> CGPoint? {
        guard let c = find(state.nodes, { $0.tag == "md-table-container" }).first, let n = m(c.id) else { return nil }
        return CGPoint(x: n.metrics["scrollX"]?.number ?? 0, y: n.metrics["scrollY"]?.number ?? 0)
    }
    // MARK: Input
    static func point(_ p: CGPoint) -> NSPoint { host.convert(NSPoint(x: p.x, y: host.isFlipped ? p.y : host.bounds.height - p.y), to: nil) }
    static func mouse(_ kind: NSEvent.EventType, _ p: CGPoint) {
        let e = NSEvent.mouseEvent(with: kind, location: point(p), modifierFlags: [], timestamp: ProcessInfo.processInfo.systemUptime, windowNumber: window.windowNumber,
                                   context: nil, eventNumber: 1, clickCount: 1, pressure: kind == .leftMouseUp ? 0 : 1)!
        window.sendEvent(e)
    }
    static func hover(_ p: CGPoint) { state.pointer.update(phase: .move, location: p); mouse(.mouseMoved, p) }
    static func down(_ p: CGPoint) { state.pointer.update(phase: .down, location: p); mouse(.leftMouseDown, p) }
    static func up(_ p: CGPoint) { mouse(.leftMouseDragged, p); mouse(.leftMouseUp, p); state.pointer.update(phase: .up, location: p) }
    static func click(_ p: CGPoint) { hover(p); down(p); pump(17); up(p) }
    static func drag(_ p: CGPoint) { state.pointer.update(phase: .move, location: p); mouse(.leftMouseDragged, p) }
    static let keyCodes: [String: (UInt16, String)] = ["Tab": (48, "\t"), "Enter": (36, "\r"), "Space": (49, " "), "ArrowDown": (125, "\u{F701}"), "ArrowUp": (126, "\u{F700}"),
                                                       "ArrowRight": (124, "\u{F703}"), "ArrowLeft": (123, "\u{F702}"), "Home": (115, "\u{F729}"), "End": (119, "\u{F72B}"),
                                                       "PageDown": (121, "\u{F72D}"), "PageUp": (116, "\u{F72C}")]
    static func key(_ k: String, _ flags: NSEvent.ModifierFlags = []) {
        let v = keyCodes[k]!
        let e = NSEvent.keyEvent(with: .keyDown, location: .zero, modifierFlags: flags, timestamp: ProcessInfo.processInfo.systemUptime, windowNumber: window.windowNumber,
                                 context: nil, characters: v.1, charactersIgnoringModifiers: v.1, isARepeat: false, keyCode: v.0)!
        // The offscreen window takes key events through sendEvent (no NSApplication monitors): the table's container
        // scrollports see them first, as their local monitor would.
        #if os(macOS)
        // Tab from the document (no first responder) enters the content in document order, as the modal scope's local monitor does
        // in an application (ModalScope.swift; the offscreen window has no monitors). Without a document-order root or a
        // right-to-left row `enter` finds no order and AppKit's own loop takes the key (4-2: the loop used to be AppKit's here,
        // which starts at the leftmost view and passed tb-sort-rtl [4] only because 3 Tabs end on the same label from either end).
        if k == "Tab", flags.intersection([.control, .option, .command]).isEmpty, window.firstResponder == nil || window.firstResponder === window,
           AWCDocumentTabOrder.enter(in: window, backward: flags.contains(.shift)) { /* handled */ }
        else if !AWCTableScrollController.routeKeyDown(e) { window.sendEvent(e) }
        #else
        window.sendEvent(e)
        #endif
        let u = NSEvent.keyEvent(with: .keyUp, location: .zero, modifierFlags: flags, timestamp: ProcessInfo.processInfo.systemUptime, windowNumber: window.windowNumber,
                                 context: nil, characters: v.1, charactersIgnoringModifiers: v.1, isARepeat: false, keyCode: v.0)!
        window.sendEvent(u)
    }
    /// A trusted wheel (pixel deltas like Chrome's oracleWheel: positive deltaY scrolls down, deltaX right), delivered to the
    /// table's platform scroll view (an off-screen window has no screen location for the system's wheel routing).
    /// A wheel event at p: tried as a legacy wheel to the window (window number set, like a real event), then straight to
    /// the scroll view, then as a began/changed/ended gesture; the first form that moves the scrollport is kept.
    static var wheelForm: Int? = nil
    static func wheelEvent(_ p: CGPoint, dx: Double, dy: Double, phase: Int64 = 0) -> NSEvent? {
        #if os(macOS)
        guard let cg = CGEvent(scrollWheelEvent2Source: nil, units: .pixel, wheelCount: 2, wheel1: Int32(-dy), wheel2: Int32(-dx), wheel3: 0) else { return nil }
        let screen = window.convertPoint(toScreen: point(p)), top = NSScreen.screens.first?.frame.maxY ?? 0
        cg.location = CGPoint(x: screen.x, y: top - screen.y)
        cg.setIntegerValueField(.mouseEventWindowUnderMousePointer, value: Int64(window.windowNumber))
        cg.setIntegerValueField(.mouseEventWindowUnderMousePointerThatCanHandleThisEvent, value: Int64(window.windowNumber))
        if phase != 0 { cg.setIntegerValueField(.scrollWheelEventScrollPhase, value: phase) }
        return NSEvent(cgEvent: cg)
        #else
        return nil   // iOS: no wheel; the harness scrolls by the deltas
        #endif
    }
    static func scrollOrigin() -> CGPoint? {
        #if os(macOS)
        return state.scroller.scrollView?.contentView.bounds.origin
        #else
        return state.scroller.scrollView?.contentOffset
        #endif
    }
    static func wheel(_ p: CGPoint, dx: Double, dy: Double) {
        if wheelForm != 1, let e = wheelEvent(p, dx: dx, dy: dy) {
            let before = scrollOrigin(); window.sendEvent(e); pump(40)
            if before != scrollOrigin() { wheelForm = 0; return }
        }
        // SwiftUI's scroll view (HostingScrollView) does not take synthesized wheel events: the harness scrolls the scrollport by
        // the wheel's deltas (logical: +x toward the inline end), which is what the platform does with a real wheel.
        if wheelForm != 1 { gaps.append("wheel input: synthesized NSEvent wheel events do not reach SwiftUI's scroll view; the harness scrolls by the wheel deltas") }
        wheelForm = 1
        let cur = frozenScroll() ?? containerScroll() ?? .zero
        _ = state.scroller.scroll(x: Double(cur.x) + (state.rtl ? -dx : dx), y: Double(cur.y) + dy)
    }
    static var lostFocus: String? = nil
    /// The page's blank click (4, 880) resets focus to the document start. iOS: the pointer only moves there (a touch
    /// outside the fixture reached the last touched control) and the first responder is cleared.
    static func blank() {
        #if os(iOS)
        hover(CGPoint(x: 4, y: 300)); pump(17)
        #else
        click(CGPoint(x: 4, y: 880))
        #endif
        _ = window.makeFirstResponder(nil)
    }
    static func all(_ v: NSView) -> [NSView] { [v] + v.subviews.flatMap(all) }
    static func focusView(_ id: String) -> AWCNativeButtonFocusView? { all(host).compactMap { $0 as? AWCNativeButtonFocusView }.first { $0.configuration?.id == id } }
    static func focusedID() -> String? {
        guard let r = window.firstResponder as? NSView else { return nil }
        if let f = r as? AWCNativeButtonFocusView { return f.configuration?.id }
        var v: NSView? = r
        while let c = v { if !c.accessibilityIdentifier().isEmpty { return c.accessibilityIdentifier() }; v = c.superview }
        // The rows-per-page md-select's own field (AppKit's field editor / the UIKit text field) is the select's tab stop.
        if state.paginationID != "-", let rpp = m(state.paginationID, "rpp")?.bounds {
            let f = r.convert(r.bounds, to: host), mid = CGPoint(x: f.midX, y: host.isFlipped ? f.midY : host.bounds.height - f.midY)
            if rpp.insetBy(dx: -2, dy: -2).contains(mid) { return state.paginationID + "-rpp" }
        }
        return "other:" + String(describing: type(of: r))
    }
    /// The web focus record → element kind (the family's tab stops and the page's).
    static func webFocusKind(_ f: [String]) -> String {
        let head = f.first?.split(separator: " ").first.map(String.init) ?? "body"
        switch head {
        case "body": return "none"
        case "button": return "after"
        case "md-checkbox": return "checkbox"
        case "md-table-sort-label": return "sort-label"
        case "md-table-row": return "row"
        case "md-table-expand-toggle": return "expand-toggle"
        case "md-table-pagination": return "pagination:" + (f.count > 1 ? f[1] : "")
        case "md-table": return f.count > 1 && f[1].contains("body-scroll") ? "body-scroll" : "table"
        default: return head
        }
    }
    static func nativeFocusKind() -> String {
        guard let id = focusedID() else { return "none" }
        if id == "after" { return "after" }
        if id == state.tableID + "-body" { return "body-scroll" }
        if id.hasPrefix(state.paginationID + "-") {
            let tail = String(id.dropFirst(state.paginationID.count + 1))
            return "pagination:" + (["first_page": "first-button", "chevron_left": "prev-button", "chevron_right": "next-button", "last_page": "last-button", "rpp": "rpp-select"][tail] ?? tail)
        }
        let tags = Dictionary(find(state.nodes) { _ in true }.map { ($0.id, $0.tag) }, uniquingKeysWith: { a, _ in a })
        if let tag = tags[id] {
            switch tag { case "md-checkbox": return "checkbox"; case "md-table-sort-label": return "sort-label"; case "md-table-row": return "row"; default: return tag }
        }
        if id.hasSuffix("-button"), tags[String(id.dropLast(7))] == "md-table-expand-toggle" { return "expand-toggle" }
        if id.contains("-rpp") { return "pagination:rpp-select" }
        return "other:" + id
    }
    // MARK: Consumer wiring (what the page did)
    static var page = 0, rpp = 5, renders = 0, paged = false, sortable = false
    static func number(_ v: Double) -> String { v == v.rounded() ? String(Int(v)) : String(v) }
    static func pagedRows() -> [AWCNode] {
        renders += 1
        let from = page * rpp, n = rpp == -1 ? data.count : rpp
        return (0..<n).compactMap { i -> AWCNode? in
            guard from + i < data.count else { return nil }
            let d = data[from + i], name = d[0].string
            var cells: [AWCNode] = [AWCNode(id: "pg\(renders)-\(i)-c", tag: "md-table-cell", properties: ["padding": "checkbox"],
                                            children: [AWCNode(id: "pg\(renders)-\(i)-cb", tag: "md-checkbox", properties: ["ariaLabel": .string("Select " + name)])])]
            for (c, v) in d.enumerated() {
                let text = c == 0 ? name : number(v.number ?? 0)
                cells.append(AWCNode(id: "pg\(renders)-\(i)-\(c)", tag: "md-table-cell", properties: c == 0 ? ["head": true, "scope": "row"] : ["numeric": true], children: [.text(text)]))
            }
            return AWCNode(id: "pg\(renders)-\(i)", tag: "md-table-row", properties: ["value": .string("r\(from + i)")], children: cells)
        }
    }
    static func render() {
        guard let body = bodyID() else { return }
        update(body) { $0.children = pagedRows() }
        update(state.tableID) { $0.properties["rowOffset"] = .number(Double(page * rpp)); $0.properties["rowCount"] = .number(Double(data.count)) }
        // The new rows' measurements (a consumer render can land after the phase's own refresh: iOS touches are asynchronous).
        refreshInspect()
    }
    static func consume(_ e: AWCEvent) {
        switch e.name {
        // Declarative host model: the row properties follow the row events (the page's elements reflect them).
        case "mdRowSelectionChange": update(e.nodeID) { $0.properties["selected"] = .bool(e.detail["selected"].bool ?? false) }
        case "mdRowExpandedChange": update(e.nodeID) { $0.properties["expanded"] = .bool(e.detail["expanded"].bool ?? false) }
        case "mdSortChange" where sortable:
            let column = e.detail["column"].string, order = e.detail["order"].string
            guard let body = bodyID() else { return }
            let rows = bodyRows(), names = rows.map(rowName)
            let ci = ["name", "cal", "fat", "carbs", "protein"].firstIndex(of: column) ?? 0
            let subset = data.prefix(rows.count)
            var ordered = Array(subset)
            if order != "none" {
                ordered.sort { a, z in
                    let x = a[ci], y = z[ci]
                    let gt = x.number.flatMap { xv in y.number.map { xv > $0 } } ?? (x.string > y.string)
                    let lt = x.number.flatMap { xv in y.number.map { xv < $0 } } ?? (x.string < y.string)
                    return order == "desc" ? gt : lt
                }
            }
            let byName = Dictionary(zip(names, rows), uniquingKeysWith: { a, _ in a })
            update(body) { $0.children = ordered.compactMap { byName[$0[0].string] } }
        case "mdPageChange" where paged: page = Int(e.detail["page"].number ?? 0); render()
        case "mdRowsPerPageChange" where paged: rpp = Int(e.detail["rowsPerPage"].number ?? 5); render()
        default: break
        }
    }
    // MARK: Actions per run / phase
    static func cellCenter(_ r: Int, _ c: Int) -> CGPoint? {
        let rows = bodyRows(); guard r < rows.count else { return nil }
        let cells = rows[r].children.filter { $0.tag == "md-table-cell" }; guard c < cells.count else { return nil }
        return center(cells[c].id)
    }
    static func action(_ run: String, _ label: String) -> () -> Void {
        let away = CGPoint(x: 1190, y: 890)
        func leave() { state.pointer.update(phase: .leave); mouse(.mouseMoved, away) }
        func sortLabel(_ col: String) -> CGPoint? { find(state.nodes) { $0.tag == "md-table-sort-label" && $0.properties["column"]?.string == col }.first.flatMap { center($0.id) } }
        func toggle(_ r: Int) -> String? { find(state.nodes) { $0.tag == "md-table-expand-toggle" }.dropFirst(r).first?.id }
        func pag(_ icon: String) -> CGPoint? { center(state.paginationID + "-" + icon) }
        if run.hasPrefix("tb-hover-select") {
            switch label {
            case "hover-row-1": return { cellCenter(1, 3).map(hover) }
            case "hover-row-2": return { cellCenter(2, 3).map(hover) }
            case "press-row-2-checkbox": return { cellCenter(2, 0).map(down) }
            case "release-row-2-checkbox": return { cellCenter(2, 0).map(up) }
            case "hover-selected-row-2-sticky": return { cellCenter(2, 1).map(hover) }
            case "click-head-checkbox-select-all", "click-head-checkbox-deselect-all":
                return { find(state.nodes) { $0.tag == "md-checkbox" }.first.flatMap { center($0.id) }.map(click) }
            case "click-row-3-cell-rowclick": return { cellCenter(3, 3).map(click) }
            default: return leave
            }
        }
        if run.hasPrefix("tb-expand") {
            switch label {
            case "click-toggle-row-0-open", "click-toggle-row-0-close": return { toggle(0).flatMap { center($0 + "-button") ?? center($0) }.map(click) }
            case "Tab-to-toggle-1": return { blank(); key("Tab"); key("Tab") }
            case "Enter-opens-row-1": return { key("Enter") }
            case "Space-closes-row-1": return { key("Space") }
            case "row-2-toggle()-method": return { if bodyRows().count > 2 { state.table.toggleRow(bodyRows()[2].id) } }
            default: return { if bodyRows().count > 2 { update(bodyRows()[2].id) { $0.properties["expanded"] = false } } }
            }
        }
        if run == "tb-contract" {
            switch label {
            case "click-calories-default-desc": return { sortLabel("cal").map(click) }
            case "click-dessert-custom-label", "click-dessert-again-desc": return { sortLabel("name").map(click) }
            case "click-row-1-checkbox-not-selectable": return { cellCenter(1, 0).map(click) }
            case "click-row-2-checkbox": return { cellCenter(2, 0).map(click) }
            case "click-head-checkbox-select-all": return { find(state.nodes) { $0.tag == "md-checkbox" }.first.flatMap { center($0.id) }.map(click) }
            case "click-lone-sort-label": return { sortLabel("lone").map(click) }
            default: return leave
            }
        }
        if run.hasPrefix("tb-sort") {
            switch label {
            case "click-calories", "click-calories-again-desc", "click-calories-third": return { sortLabel("cal").map(click) }
            case "click-dessert": return { sortLabel("name").map(click) }
            case "Tab-to-fat-label": return { blank(); key("Tab"); key("Tab"); key("Tab") }
            case "Enter-sorts-fat": return { key("Enter") }
            case "Space-toggles-fat": return { key("Space") }
            default: return { state.table.setSort("protein", "desc") }
            }
        }
        if run.hasPrefix("tb-pagination") {
            switch label {
            case "select-row-0": return { cellCenter(0, 0).map(click) }
            case "click-next": return { pag("chevron_right").map(click) }
            case "click-last": return { pag("last_page").map(click) }
            case "click-prev": return { pag("chevron_left").map(click) }
            case "click-first": return { pag("first_page").map(click) }
            case "setRowsPerPage(10)": return { state.pagination.setRowsPerPage(10) }
            case "goToPage(1)": return { state.pagination.goToPage(1) }
            default: return { update(state.paginationID) { $0.properties["count"] = 4 } }
            }
        }
        if run == "tb-keyboard" {
            switch label {
            case "blank": return blank
            case "Shift+Tab-x10": return {
                var seq: [String] = [nativeFocusKind()], presses = 10
                if nativeFocusKind() == "none", let after = focusView("after") {
                    // From outside the document Chrome's first Shift+Tab enters at the last control; AppKit's key loop starts at the
                    // first key view, so the harness enters at the last control itself.
                    _ = after.requestNativeFocus(showIndicator: true); presses -= 1; pump(5); seq.append(nativeFocusKind())
                    gaps.append("tb-keyboard Shift+Tab: re-entry from outside the window at the last control (Chrome's browser UI round trip) emulated")
                }
                for _ in 0..<presses { key("Tab", .shift); pump(5); seq.append(nativeFocusKind()) }
                print("DIAG shift-tab: \(seq.joined(separator: " > "))"); fflush(stdout)
            }
            case "Enter": return { key("Enter") }
            case "Space": return { key("Space") }
            case "ArrowDown-no-grid-nav": return { key("ArrowDown") }
            case "ArrowRight": return { key("ArrowRight") }
            default:
                // Tab-18: the page's tab order leaves the document after its last stop (#run); a native window wraps.
                if label == "Tab-18" { return { key("Tab"); if nativeFocusKind() != "none" && nativeFocusKind() != "after" { _ = window.makeFirstResponder(nil); gaps.append("tb-keyboard Tab-18: the window's key loop wraps; Chrome leaves the document (focus reset to none)") } } }
                return { key("Tab") }
            }
        }
        if run.hasPrefix("tb-frozen-scroll") {
            let rtl = run.hasSuffix("rtl")
            switch label {
            case "wheel-down-120": return { cellCenter(1, 2).map { hover($0); wheel($0, dx: 0, dy: 120) } }
            case "wheel-inline-200": return { cellCenter(2, 2).map { hover($0); wheel($0, dx: rtl ? -200 : 200, dy: 0) } }
            case "hover-hthumb": return { center(state.tableID, "hthumb").map(hover) }
            case "drag-hthumb-80":
                return {
                    guard let p = center(state.tableID, "hthumb") else { return }
                    down(p)
                    #if os(macOS)
                    // CDP sends the press, the moves and the release back to back (the release lands in the first frame):
                    // the same here, after one frame that renders the press.
                    pump(16)
                    // SwiftUI's drag gesture reports its first change on the first move: one frame renders the pressed thumb.
                    drag(CGPoint(x: p.x + (rtl ? -10 : 10), y: p.y)); pump(16)
                    for i in 2...8 { drag(CGPoint(x: p.x + Double(rtl ? -10 : 10) * Double(i), y: p.y)) }
                    #else
                    for i in 1...8 { pump(16); drag(CGPoint(x: p.x + Double(rtl ? -10 : 10) * Double(i), y: p.y)) }
                    #endif
                    up(CGPoint(x: p.x + (rtl ? -80 : 80), y: p.y))
                }
            case "focus-body-scroller": return { _ = focusView(state.tableID + "-body")?.requestNativeFocus(showIndicator: false) }
            case "PageDown": return { key("PageDown") }
            case "End": return { key("End") }
            case "Home": return { key("Home") }
            case "ArrowRight-x3": return { key("ArrowRight"); key("ArrowRight"); key("ArrowRight") }
            default: return { key("End", .shift) }
            }
        }
        if run == "tb-sticky-container-scroll" {
            let containerCenter = { find(state.nodes) { $0.tag == "md-table-container" }.first.flatMap { center($0.id) } }
            switch label {
            case "wheel-down-100": return { cellCenter(1, 2).map { hover($0); wheel($0, dx: 0, dy: 100) } }
            case "wheel-down-400": return { containerCenter().map { hover($0); wheel($0, dx: 0, dy: 400) } }
            default: return { containerCenter().map { hover($0); wheel($0, dx: 0, dy: -1000) } }
            }
        }
        if run == "tb-loading-empty" {
            switch label {
            case "loading-overlay-on": return { update(state.tableID) { $0.properties["loading"] = true } }
            case "loading-off": return { update(state.tableID) { $0.properties["loading"] = false } }
            case "skeleton-on": return { update(state.tableID) { $0.properties["loadingMode"] = "skeleton"; $0.properties["loading"] = true } }
            case "skeleton-off-empty-on": return {
                update(state.tableID) { $0.properties["loading"] = false; $0.properties["empty"] = true }
                if let b = bodyID() { update(b) { $0.children = [] } }
            }
            default: return { update(state.tableID) { $0.properties["empty"] = false } }
            }
        }
        if run == "tb-pin-visibility" {
            switch label {
            case "pinColumn(2,start)": return { _ = state.table.pinColumn(2, "start") }
            case "pinColumn(4,end)": return { _ = state.table.pinColumn(4, "end") }
            case "scroll-inline-200": return { _ = state.scroller.scroll(x: 200, y: nil) }
            case "pinColumn(2,none)": return { _ = state.table.pinColumn(2, "none") }
            case "setColumnVisibility(3,false)": return { _ = state.table.setColumnVisibility(3, false) }
            default: return { _ = state.table.setColumnVisibility(3, true) }
            }
        }
        if run == "tb-toolbar-autobind" {
            switch label {
            case "select-two": return { let rs = bodyRows(); for k in [0, 2] where k < rs.count { update(rs[k].id) { $0.properties["selected"] = true } } }
            case "insert-toolbar-late": return {
                guard let c = find(state.nodes, { $0.tag == "md-table-container" }).first else { return }
                let toolbar = AWCNode(id: "late-toolbar", tag: "md-table-toolbar", properties: ["headline": "Desserts", "supportingText": "Nutrition per serving", "autoBind": true], children: [
                    AWCNode(id: "late-filter", tag: "md-icon-button", properties: ["ariaLabel": "Filter list", "icon": "filter_list"], slot: "actions"),
                    AWCNode(id: "late-delete", tag: "md-icon-button", properties: ["ariaLabel": "Delete selected", "icon": "delete"], slot: "selection-actions")], slot: "top")
                update(c.id) { $0.children.insert(toolbar, at: 0) }
                state.inspect += "|late-toolbar|late-filter|late-delete"
            }
            case "move-toolbar": return { guard let c = find(state.nodes, { $0.tag == "md-table-container" }).first else { return }
                update(c.id) { n in if let i = n.children.firstIndex(where: { $0.tag == "md-table-toolbar" }) { let t = n.children.remove(at: i); n.children.insert(t, at: 0) } } }
            case "deselect-one": return { if let r = bodyRows().first { update(r.id) { $0.properties["selected"] = false } } }
            default: return {
                if bodyRows().count > 1 { update(bodyRows()[1].id) { $0.properties["selected"] = true } }
                pump(50); update(state.tableID) { $0.properties["selection"] = "single" }
            }
            }
        }
        return {}
    }
    // MARK: Comparisons
    static let eventNames: Set<String> = ["mdSelectionChange", "mdRowSelectionChange", "mdRowClick", "mdRowExpandedChange", "mdSortChange", "mdPageChange", "mdRowsPerPageChange",
                                          "mdPinChange", "mdColumnVisibilityChange", "mdChange", "mdClick", "mdSortRequest"]
    static func key(of name: String, _ d: AWCValue) -> String {
        switch name {
        case "mdChange": return "mdChange(\(d["checked"].bool ?? false))"
        case "mdSelectionChange": return "mdSelectionChange(\(Int(d["count"].number ?? -1))/\(Int(d["total"].number ?? -1)) \(d["values"].array.map(\.string)) all=\(d["all"].bool ?? false) ind=\(d["indeterminate"].bool ?? false))"
        case "mdRowSelectionChange": return "mdRowSelectionChange(\(d["selected"].bool ?? false) \(d["value"].string))"
        case "mdRowExpandedChange": return "mdRowExpandedChange(\(d["expanded"].bool ?? false))"
        case "mdRowClick": return "mdRowClick(\(d["value"].string))"
        case "mdSortChange": return "mdSortChange(\(d["column"].string) \(d["order"].string))"
        case "mdPageChange": return "mdPageChange(\(Int(d["page"].number ?? -1)))"
        case "mdRowsPerPageChange": return "mdRowsPerPageChange(\(Int(d["rowsPerPage"].number ?? -1)))"
        case "mdPinChange": return "mdPinChange(\(Int(d["column"].number ?? -1)) \(d["side"] == .null ? "null" : d["side"].string))"
        case "mdColumnVisibilityChange": return "mdColumnVisibilityChange(\(Int(d["column"].number ?? -1)) \(d["visible"].bool ?? false) \(d["hidden"].array.compactMap(\.number).map { Int($0) }))"
        default: return name
        }
    }
    static func capture(_ clip: AWCValue) -> TSRaster? {
        guard let x = clip["x"].number, let y = clip["y"].number, let w = clip["width"].number, let h = clip["height"].number, w > 0, h > 0 else { return nil }
        let rect = NSRect(x: x, y: y, width: w, height: h)
        guard let rep = host.bitmapImageRepForCachingDisplay(in: rect) else { return nil }
        host.cacheDisplay(in: rect, to: rep)
        return rep.cgImage.map { TSRaster.from($0, width: Int(w), height: Int(h)) }
    }
    static func load(_ url: URL) -> TSRaster? {
        guard let image = NSImage(contentsOf: url), let cg = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else { return nil }
        return TSRaster.from(cg, width: cg.width, height: cg.height)
    }
    static func png(_ r: TSRaster, _ url: URL) {
        var bytes = r.px
        bytes.withUnsafeMutableBytes { raw in
            let ctx = CGContext(data: raw.baseAddress, width: r.w, height: r.h, bitsPerComponent: 8, bytesPerRow: r.w * 4, space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
            try? NSBitmapImageRep(cgImage: ctx.makeImage()!).representation(using: .png, properties: [:])?.write(to: url)
        }
    }
    /// Nested components owned elsewhere (their own parity suites) and time-based fills are masked in phase shots.
    static func masks(_ run: String, _ label: String) -> [CGRect] {
        var out: [CGRect] = []
        for n in state.measurements where ["md-checkbox", "md-icon-button", "md-select", "md-progress-indicator", "md-button"].contains(n.name) && n.id.hasSuffix(":component") { out.append(n.bounds.insetBy(dx: -2, dy: -2)) }
        for (id, tag) in find(state.nodes, { ["md-checkbox", "md-icon-button", "md-table-expand-toggle"].contains($0.tag) }).map({ ($0.id, $0.tag) }) {
            if let b = m(id)?.bounds { out.append(b.insetBy(dx: -2, dy: -2)) }
            if tag == "md-table-expand-toggle", let b = m(id + "-button")?.bounds { out.append(b.insetBy(dx: -2, dy: -2)) }
        }
        for icon in ["first_page", "chevron_left", "chevron_right", "last_page", "rpp"] { if let b = m(state.paginationID + "-" + icon)?.bounds { out.append(b.insetBy(dx: -2, dy: -2)) } }
        if let b = m(state.paginationID, "rpp")?.bounds { out.append(b.insetBy(dx: -2, dy: -2)) }
        // (The right-to-left custom thumb is compared too: the source defect that pushed it out of its track is fixed, d5 2026-11.)
        if let t = m(state.tableID), (label.contains("loading") || label.contains("skeleton")) { out.append(CGRect(x: t.bounds.minX, y: t.bounds.minY + 57, width: t.bounds.width, height: Swift.max(0, t.bounds.height - 57))) }
        return out
    }
    static func comparePaint(_ name: String, web: TSRaster, native: TSRaster, clip: AWCValue, masks: [CGRect]) -> (Double, Double, Int) {
        let cx = clip["x"].number ?? 0, cy = clip["y"].number ?? 0
        var sum = 0.0, over = 0, n = 0
        for y in 1..<(Swift.min(web.h, native.h) - 1) { for x in 1..<(Swift.min(web.w, native.w) - 1) {
            let p = CGPoint(x: cx + Double(x) + 0.5, y: cy + Double(y) + 0.5)
            if masks.contains(where: { $0.contains(p) }) { continue }
            guard web.flat(x, y, 6), native.flat(x, y, 6) else { continue }
            let a = web.rgb(x, y), b = native.rgb(x, y), d = max(abs(a.0 - b.0), abs(a.1 - b.1), abs(a.2 - b.2))
            sum += Double(d); n += 1; if d > 6 { over += 1 }
        } }
        return (n == 0 ? 0 : sum / Double(n), n == 0 ? 0 : Double(over) / Double(n), n)
    }
    /// Native per-frame value of a motion probe at time t (ms), or the latest value before.
    /// Time of the first probe sample after t whose value differs from that key's previous sample.
    static func firstChange(after t: Double) -> Double? {
        var last: [String: Double] = [:]
        for s in state.motion.samples {
            if s.t >= t, let prev = last[s.key], abs(prev - s.value) > 1e-6 { return s.t }
            last[s.key] = s.value
        }
        return nil
    }
    static func probe(_ key: String, at t: Double) -> Double? {
        var last: Double? = nil
        for s in state.motion.samples where s.key == key { if s.t <= t { last = s.value } else { break } }
        return last
    }
    /// A web curve sampled per frame (τ ms after the input, value) against a native probe with ±2 frames of latency slack.
    /// The input time of the phase being compared (per-key latency alignment looks for that key's first frame after it).
    static var phaseInput = 0.0
    static func motion(_ label: String, web: [(Double, Double)], key: String, t0: Double, tolerance: Double) {
        guard web.count > 2, (web.map(\.1).max() ?? 0) - (web.map(\.1).min() ?? 0) > tolerance else { return }
        func score(_ t0: Double, appearing: AWCTableMotionRecorder.Sample? = nil) -> (Int, [String]) {
            var ok = 0, bad: [String] = []
            for (tau, v) in web {
                // ±2 frames of latency: the native curve passes through the web value within 33 ms either side (between frames too).
                let candidates = [-33.0, -17, 0, 17, 33].compactMap { d -> Double? in
                    let t = t0 + tau + d
                    if let v = probe(key, at: t) { return v }
                    if let a = appearing, t < a.t { return a.value }
                    return nil
                }
                if let lo = candidates.min(), let hi = candidates.max(), v >= lo - tolerance, v <= hi + tolerance { ok += 1 } else { bad.append("\(Int(tau))ms web \(String(format: "%.2f", v)) native \(candidates.map { String(format: "%.2f", $0) })") }
            }
            return (ok, bad)
        }
        var (ok, bad) = score(t0)
        // A key first sampled after the input is an element that appeared then (a new page's row): before its first frame
        // it is compared at the value it appears with.
        if Double(ok) < Double(web.count) * 0.9, !state.motion.samples.contains(where: { $0.key == key && $0.t < phaseInput }),
           let firstSample = state.motion.samples.first(where: { $0.key == key }) {
            let (okA, badA) = score(t0, appearing: firstSample)
            if okA > ok { ok = okA; bad = badA; gaps.append("\(label): \(key) appeared \(Int(firstSample.t - phaseInput)) ms after the input (compared at its first value before that)") }
        }
        if Double(ok) < Double(web.count) * 0.9 {
            // This key's own first frame after the input (another probe may have changed first): align on it (≤ 120 ms), as a gap.
            var last: Double? = nil, first: Double? = nil
            for s in state.motion.samples where s.key == key {
                if s.t >= phaseInput {
                    // The key's first frame after the input: a change, or the element appearing then (a new page's row).
                    if let l = last { if abs(l - s.value) > 1e-6 { first = s.t; break } } else { first = s.t; break }
                }
                last = s.value
            }
            #if os(macOS)
            let cap = 160.0   // 4-2: tb-toolbar-autobind [4] (KNOWN-CAUSES 19): the first render after the update lands up to 122 ms after the input under load; the curve itself is still scored at the same tolerance
            #else
            let cap = 200.0   // the simulator's HID touches reach the view 70–140 ms after the harness's input
            #endif
            if let first, first - 17 > t0, first - phaseInput <= cap {
                let (ok2, bad2) = score(first - 17)
                if ok2 > ok { ok = ok2; bad = bad2; gaps.append("\(label): \(key) aligned on its own first native frame (\(Int(first - phaseInput)) ms after the input)") }
            }
            if Double(ok) < Double(web.count) * 0.9, let first, abs(first - t0) <= cap, let v0 = web.first?.1, v0 > 0.02, v0 < 0.98 {
                // The curve began during the action (the harness's keys take longer than CDP's, e.g. iOS HID keys): the Web's first
                // sample is aligned on the native time the curve passes its value.
                let pts = state.motion.samples.filter { $0.key == key && $0.t >= phaseInput - 20 }.map { ($0.t, $0.value) }
                var tc: Double? = nil
                for k in pts.indices.dropFirst() where tc == nil {
                    let (t1, a) = pts[k - 1], (t2, b) = pts[k]
                    if (a - v0) * (b - v0) <= 0, a != b { tc = t1 + (t2 - t1) * (v0 - a) / (b - a) }
                }
                if let tc, abs(tc - t0) <= cap {
                    let (ok2, bad2) = score(tc)
                    if ok2 > ok { ok = ok2; bad = bad2; gaps.append("\(label): \(key) aligned on the Web's first value, already mid-curve at the Web's input end (\(Int(tc - phaseInput)) ms after the native input)") }
                }
            }
        }
        check(Double(ok) >= Double(web.count) * 0.9, "\(label): motion \(key) \(ok)/\(web.count) frames within \(tolerance) (±2 frames) — \(bad.prefix(4))")
        if Double(ok) < Double(web.count) * 0.9 {
            let near = state.motion.samples.filter { $0.key == key && $0.t >= phaseInput - 40 && $0.t <= phaseInput + 320 }.map { "\(Int($0.t - phaseInput)):\(String(format: "%.2f", $0.value))" }
            print("DIAG motion \(label) \(key): input→t0 \(Int(t0 - phaseInput)) ms; native \(near.prefix(40).joined(separator: " ")) | web \(web.prefix(14).map { "\(Int($0.0)):\(String(format: "%.2f", $0.1))" }.joined(separator: " "))"); fflush(stdout)
        }
        if !bad.isEmpty && Double(ok) >= Double(web.count) * 0.9 { gaps.append("\(label): \(bad.count) frame(s) beyond ±2 frames for \(key)") }
    }
    // MARK: Run
    static func run(_ r: AWCValue, oracle: URL, set: String, captureDir: URL?) {
        let name = r["name"].string, label0 = (set == "full" ? "" : "reduced/") + name
        frames = []; state.motion.reset()
        state.pointer.update(phase: .leave); mouse(.mouseMoved, CGPoint(x: 1190, y: 890))
        state.scroller = AWCTableScrollController(); wheelForm = nil
        state.reduced = set == "reduced"; state.rtl = r["dir"].string == "rtl"; state.dark = r["theme"].string == "dark"
        let nodes = try! JSONDecoder().decode([AWCNode].self, from: JSONSerialization.data(withJSONObject: anyJSON(r["nodes"])))
        state.nodes = nodes
        state.tableID = find(nodes) { $0.tag == "md-table" }.first?.id ?? "n0"
        state.paginationID = find(nodes) { $0.tag == "md-table-pagination" }.first?.id ?? "-"
        sortable = r["prepare"].string == "sortable"; paged = r["prepare"].string == "paged"; page = 0; rpp = 5; renders = 0
        state.consumer = { consume($0) }
        // The page loads its table first and pages the rows in afterwards (prepare: paged), so keep-height's floor (two
        // frames after load) is the header-only height: the view is mounted (new epoch) before the consumer renders rows.
        refreshInspect()
        state.epoch += 1
        // keep-height's floor is taken two frames after load (34 ms after appear here): leave it room before the rows arrive.
        if paged { pump(200); render() }
        pump(400)
        _ = window.makeFirstResponder(nil); state.events = []; pump(50)
        let phases = r["phases"].array, webEvents = r["events"].array
        lostFocus = nil
        var runOK = true
        for (i, ph) in phases.enumerated() {
            let label = ph["label"].string, tag = "\(label0) [\(i)] \(label)"
            let before = failures.count
            let start = ph["t"].number ?? 0, actEnd = ph["actEnd"].number ?? start
            let next = i + 1 < phases.count ? (phases[i + 1]["t"].number ?? start + 450) : ((ph["samples"].array.last?["t"].number ?? start + 400) + 30)
            let eventsBefore = state.events.count
            if trace { FileHandle.standardError.write(Data("PHASE \(tag)\n".utf8)) }
            let act = action(name, label)
            let tAct = now()
            #if !canImport(AppKit)
            AWCDG.input(planned: tAct)
            #endif
            #if !canImport(AppKit)
            AWCDG.start()
            #endif
            act()
            refreshInspect()
            let t0 = now()
            pump(Swift.max(120, next - start - (actEnd - start)))
            // Events of this phase.
            let webKeys = webEvents.filter { ($0["t"].number ?? 0) >= start - 0.5 && ($0["t"].number ?? 0) < next - 0.5 && $0["name"].string != "mdScroll" }.map { key(of: $0["name"].string, $0["detail"]) }
            let nativeKeys = state.events[eventsBefore...].filter { eventNames.contains($0.name) && !(state.paginationID != "-" && $0.id.hasPrefix(state.paginationID + "-")) }.map { key(of: $0.name, $0.detail) }
            check(webKeys == nativeKeys, "\(tag): events \(nativeKeys) vs \(webKeys)")
            let webScroll = webEvents.filter { $0["name"].string == "mdScroll" && ($0["t"].number ?? 0) >= start - 0.5 && ($0["t"].number ?? 0) < next - 0.5 }.last
            let nativeScroll = state.events[eventsBefore...].last { $0.name == "mdScroll" }
            if let w = webScroll {
                let ok = nativeScroll.map { abs(abs($0.detail["scrollLeft"].number ?? 0) - abs(w["detail"]["scrollLeft"].number ?? 0)) <= 2 && abs(($0.detail["scrollTop"].number ?? 0) - (w["detail"]["scrollTop"].number ?? 0)) <= 2 } ?? false
                check(ok, "\(tag): last mdScroll \(nativeScroll.map { "\($0.detail)" } ?? "none") vs \(w["detail"])")
            } else { check(nativeScroll == nil, "\(tag): unexpected mdScroll \(nativeScroll.map { "\($0.detail)" } ?? "")") }
            // Final state.
            let final = ph["samples"].array.last ?? .null
            if name.hasPrefix("tb-frozen-scroll") {
                let pos = state.scroller.position()
                print("DIAG frozen \(tag): metric \(frozenScroll().map { "\($0.x),\($0.y)" } ?? "-") controller \(pos.map { "\($0.x),\($0.y) max \($0.maxX),\($0.maxY)" } ?? "-")"); fflush(stdout)
            }
            compareState(tag, final)
            // Focus.
            let wf = webFocusKind(ph["focus"].array.map(\.string)), nf = nativeFocusKind()
            let pg = final["pagination"].array
            let disabledIndex = ["pagination:first-button": 3, "pagination:prev-button": 4, "pagination:next-button": 5, "pagination:last-button": 6][wf]
            if let k = disabledIndex, pg.count > k, pg[k].bool == true, nf == "none" {
                // Chrome keeps focus on a button disabled while focused; AppKit and Compose cannot focus a disabled control.
                gaps.append("\(tag): focus stays on the disabled \(wf) in Chrome; native moves it away (platform rule)")
                lostFocus = wf
            } else if let lost = lostFocus, wf == lost, nf == "none" {
                // Consequence of the rule above: Chrome's focus is still on that (re-enabled) button.
                gaps.append("\(tag): focus still on \(wf) in Chrome since it was disabled while focused (platform rule)")
            } else { check(wf == nf, "\(tag): focus \(nf) vs \(wf)") }
            // Motion (per frame, from the input).
            // The web's τ = 0 is the input's handling (actEnd); the offscreen AppKit harness can take a few frames to render the
            // input's first frame, so curves are aligned on that first changed frame (one frame before it), recorded as a gap.
            var tm = t0
            phaseInput = tAct
            if let first = firstChange(after: tAct), first > t0 + 17 {
                tm = first - 17
                gaps.append("\(tag): native first frame \(Int(first - t0)) ms after the input (curves aligned on it)")
            }
            compareMotion(tag, ph, t0: tm, actEnd: actEnd)
            // Phase shot.
            if let web = load(oracle.appendingPathComponent(ph["shot"].string)), let native = capture(ph["clip"]) {
                if let captureDir { png(native, captureDir.appendingPathComponent("\(set)-\(name)-\(String(format: "%02d", i))-\(label).png")) }
                let (mean, over, n) = comparePaint(tag, web: web, native: native, clip: ph["clip"], masks: masks(name, label))
                check(mean <= 1.0 && over <= 0.005, "\(tag): phase shot mean \(String(format: "%.3f", mean)) >6 \(String(format: "%.2f", over * 100))% (\(n) px)")
                report.append(["run": label0, "phase": i, "label": label, "mean": mean, "over": over, "compared": n, "ok": failures.count == before])
            } else { check(false, "\(tag): phase shot missing \(ph["shot"].string)") }
            if failures.count != before { runOK = false }
        }
        let keys = Set(state.motion.samples.map { String($0.key.split(separator: ":").first ?? "") })
        print("RUN \(label0): \(runOK ? "ok" : "FAIL") (motion samples \(state.motion.samples.count) kinds \(keys.sorted()) probe calls \(AWCTableMotionProbe.calls))"); fflush(stdout)
    }
    static func refreshInspect() {
        var ids = [state.tableID, state.paginationID, "after"]
        walk(state.nodes) { n in if n.tag != "#text" { ids.append(n.id) }; if n.tag == "md-table-expand-toggle" { ids.append(n.id + "-button") } }
        for icon in ["first_page", "chevron_left", "chevron_right", "last_page", "rpp"] { ids.append(state.paginationID + "-" + icon) }
        let s = ids.joined(separator: "|")
        if state.inspect != s { state.inspect = s }
    }
    static func anyJSON(_ v: AWCValue) -> Any {
        switch v {
        case .object(let o): return o.mapValues(anyJSON)
        case .array(let a): return a.map(anyJSON)
        case .string(let s): return s
        case .number(let n): return n
        case .bool(let b): return b
        default: return NSNull()
        }
    }
    /// Rows, head, toolbar, pagination, scroll, pins and sticky positions at the end of the phase.
    static func compareState(_ tag: String, _ w: AWCValue) {
        // Rows the source keeps in the DOM but does not render (skeleton mode) have no box.
        let webRows = w["rows"].array.filter { $0.array.count < 4 || ($0.array[3].number ?? 1) > 0 }
        let rows = bodyRows()
        let measured = rows.compactMap { r -> (AWCNode, AWCNativeInspectionNode)? in m(r.id).map { (r, $0) } }.sorted { $0.1.bounds.minY < $1.1.bounds.minY }
        if !webRows.isEmpty || !measured.isEmpty {
            check(webRows.map { $0.array.first?.string ?? "" } == measured.map { visualName($0.0) }, "\(tag): row order \(measured.map { visualName($0.0) }) vs \(webRows.map { $0.array.first?.string ?? "" })")
            for (k, wr) in webRows.enumerated() where k < measured.count {
                let a = wr.array, (node, n) = measured[k]
                guard a.count >= 12 else { continue }
                let y = a[2].number ?? 0, h = a[3].number ?? 0
                check(abs(Double(n.bounds.minY) - y) <= 1.5 && abs(Double(n.bounds.height) - h) <= 1.5, "\(tag): row \(k) \(rowName(node)) y/h (\(n.bounds.minY), \(n.bounds.height)) vs (\(y), \(h))")
                if a[4] != .null { check((n.metrics["selected"]?.bool ?? false) == (a[4].string == "true"), "\(tag): row \(k) selected \(n.metrics["selected"] ?? .null) vs aria-selected \(a[4].string)") }
                if a[5] != .null { check((n.metrics["expanded"]?.bool ?? false) == (a[5].string == "true"), "\(tag): row \(k) expanded \(n.metrics["expanded"] ?? .null) vs aria-expanded \(a[5].string)") }
            }
        }
        // Sort labels and head checkbox.
        // The head's sort labels (the oracle's `head` cells); a label outside a table (tb-contract's lone label) is not one.
        let labels = find(find(state.nodes) { $0.tag == "md-table-head" }) { $0.tag == "md-table-sort-label" }
        let webHead = w["head"].array.compactMap { c -> AWCValue? in c.array.count > 1 && c.array[1] != .null ? c.array[1] : nil }
        for (k, wl) in webHead.enumerated() where k < labels.count {
            guard let n = m(labels[k].id) else { continue }
            let a = wl.array
            let active = a[0].bool ?? false, order = active ? a[1].string : "none"
            check((n.metrics["active"]?.bool ?? false) == active && (active ? n.metrics["order"]?.string == order : true), "\(tag): sort label \(labels[k].properties["column"]?.string ?? "") \(n.metrics["active"] ?? .null) \(n.metrics["order"] ?? .null) vs \(active) \(order)")
            if let op = Double(a[3].string) ?? a[3].number { check(abs((n.metrics["iconOpacity"]?.number ?? -1) - op) <= 0.05, "\(tag): sort icon opacity \(n.metrics["iconOpacity"]?.number ?? -1) vs \(op)") }
        }
        if let t = m(state.tableID) {
            for c in w["head"].array where c.array.count > 2 && c.array[2] != .null {
                let cb = c.array[2].array
                let shown = t.metrics["headCheckbox"]?.array.map { $0.bool ?? false } ?? []
                check(shown == cb.map { $0.bool ?? false }, "\(tag): select-all checkbox \(shown) vs \(cb.map { $0.bool ?? false })")
            }
        }
        if w["toolbar"] != .null, let tb = find(state.nodes, { $0.tag == "md-table-toolbar" }).first, let n = m(tb.id) {
            check(Int(n.metrics["numSelected"]?.number ?? -1) == Int(w["toolbar"].array[0].number ?? -2), "\(tag): toolbar numSelected \(n.metrics["numSelected"] ?? .null) vs \(w["toolbar"].array[0])")
        }
        if w["pagination"] != .null, let n = m(state.paginationID) {
            let p = w["pagination"].array
            check(Int(n.metrics["page"]?.number ?? -1) == Int(p[0].number ?? -2) && Int(n.metrics["rowsPerPage"]?.number ?? -1) == Int(p[1].number ?? -2) && n.metrics["display"]?.string == p[2].string,
                  "\(tag): pagination \(n.metrics["page"] ?? .null)/\(n.metrics["rowsPerPage"] ?? .null) '\(n.metrics["display"]?.string ?? "")' vs \(p[0])/\(p[1]) '\(p[2].string)'")
            let flags = ["firstDisabled", "prevDisabled", "nextDisabled", "lastDisabled"]
            for (k, f) in flags.enumerated() where p.count > 3 + k && p[3 + k] != .null {
                check((n.metrics[f]?.bool ?? false) == (p[3 + k].bool ?? false), "\(tag): pagination \(f) \(n.metrics[f] ?? .null) vs \(p[3 + k])")
            }
        }
        // Scroll offsets.
        for s in w["scroll"].array {
            let path = s["path"].string, left = abs(s["left"].number ?? 0), top = s["top"].number ?? 0
            let native: CGPoint? = path.contains("body-scroll") ? frozenScroll() : path.contains("scroll") ? containerScroll() : nil
            if let nv = native { check(abs(Double(nv.x) - left) <= 2 && abs(Double(nv.y) - top) <= 2, "\(tag): scroll \(path) (\(nv.x), \(nv.y)) vs (\(left), \(top))") }
        }
        // Pinned cells' inline positions.
        let webPins = w["pinned"].array
        if !webPins.isEmpty {
            let cells = find(state.nodes) { $0.tag == "md-table-cell" }.compactMap { c -> (String, AWCNativeInspectionNode)? in
                guard let n = m(c.id), let side = n.metrics["pinned"]?.string, !side.isEmpty else { return nil }; return (side, n) }
            for (k, p) in webPins.enumerated() where k < cells.count {
                check(cells[k].0 == p.array[0].string && abs(Double(cells[k].1.bounds.minX) - (p.array[1].number ?? 0)) <= 1.5, "\(tag): pinned \(k) \(cells[k].0)@\(cells[k].1.bounds.minX) vs \(p.array[0].string)@\(p.array[1])")
            }
        }
        if let hy = w["headY"].number, let hc = find(state.nodes, { $0.tag == "md-table-head" }).first.flatMap({ find([$0]) { $0.tag == "md-table-cell" }.first }), let n = m(hc.id) {
            check(abs(Double(n.bounds.minY) - hy) <= 1.5, "\(tag): head y \(n.bounds.minY) vs \(hy)")
        }
        if let fy = w["footY"].number, let fc = find(state.nodes, { $0.tag == "md-table-foot" }).first.flatMap({ find([$0]) { $0.tag == "md-table-cell" }.first }), let n = m(fc.id) {
            check(abs(Double(n.bounds.minY) - fy) <= 1.5, "\(tag): foot y \(n.bounds.minY) vs \(fy)")
        }
        check((m(state.tableID)?.metrics["busy"]?.bool ?? false) == (w["busy"].string == "true"), "\(tag): aria-busy \(m(state.tableID)?.metrics["busy"] ?? .null) vs \(w["busy"])")
    }
    /// Per-frame curves of the phase: expanded zone, caret, sort arrow, row selection, FLIP order, thumb, frozen scroll.
    static func compareMotion(_ tag: String, _ ph: AWCValue, t0: Double, actEnd: Double) {
        let samples = ph["samples"].array.filter { ($0["t"].number ?? 0) >= actEnd - 1 }
        guard samples.count > 2 else { return }
        let rows = bodyRows()
        func tau(_ s: AWCValue) -> Double { (s["t"].number ?? 0) - actEnd }
        // Expanded zone height (fraction of the row's open height) and the caret rotation.
        let toggles = find(state.nodes) { $0.tag == "md-table-expand-toggle" }
        for (k, r) in rows.enumerated() {
            let zone = samples.compactMap { s -> (Double, Double)? in let a = s["rows"].array; return k < a.count ? a[k].array[11].number.map { (tau(s), $0) } : nil }
            if let full = zone.map(\.1).max(), full > 20 { motion(tag, web: zone.map { ($0.0, $0.1 / full) }, key: "expand:" + r.id, t0: t0, tolerance: 0.12) }
            let caret = samples.compactMap { s -> (Double, Double)? in let a = s["rows"].array; guard k < a.count, a[k].array.count > 12, a[k].array[12] != .null else { return nil }; return (tau(s), abs(angle(a[k].array[12].string)) / 90) }
            if let tg = toggles.first(where: { t in r.children.contains { c in c.children.contains { $0.id == t.id } } }) { motion(tag, web: caret, key: "caret:" + tg.id, t0: t0, tolerance: 0.12) }
            // Row selection background (alpha of the selected fill over the transparent row).
            if !(ph["label"].string.contains("hover")) {
                let sel = samples.compactMap { s -> (Double, Double)? in let a = s["rows"].array; return k < a.count ? (tau(s), rgba(a[k].array[6].string)[3]) : nil }
                motion(tag, web: sel, key: "selected:" + r.id, t0: t0, tolerance: 0.15)
            }
        }
        // Sort arrows: rotation (desc = 180°) and opacity.
        // The head's sort labels (the oracle's `head` cells); a label outside a table (tb-contract's lone label) is not one.
        let labels = find(find(state.nodes) { $0.tag == "md-table-head" }) { $0.tag == "md-table-sort-label" }
        for (k, l) in labels.enumerated() {
            func headLabel(_ s: AWCValue) -> [AWCValue]? { let cells = s["head"].array.filter { $0.array.count > 1 && $0.array[1] != .null }; return k < cells.count ? cells[k].array[1].array : nil }
            let rot = samples.compactMap { s in headLabel(s).map { (tau(s), abs(angle($0[2].string)) / 180) } }
            motion(tag, web: rot, key: "sort-rot:" + l.id, t0: t0, tolerance: 0.12)
            let op = samples.compactMap { s in headLabel(s).flatMap { a in (Double(a[3].string) ?? a[3].number).map { (tau(s), $0) } } }
            motion(tag, web: op, key: "sort-op:" + l.id, t0: t0, tolerance: 0.1)
        }
        // FLIP: visual row index (layout y + translateY) during a reorder.
        let namesOf = { (s: AWCValue) in s["rows"].array.map { $0.array.first?.string ?? "" } }
        if let s0 = samples.first, let s1 = samples.last, namesOf(s0) != namesOf(s1), let base = s1["rows"].array.first?.array[2].number {
            let names = rows.map(rowName)
            for (k, r) in rows.enumerated() {
                // The sample's box is getBoundingClientRect (transform included): the row's visual position in 53 px rows.
                var curve: [(Double, Double)] = [], lastTY = 0.0, cut: Double? = nil
                for s in samples {
                    let a = s["rows"].array; guard let i = a.firstIndex(where: { $0.array.first?.string == names[k] }), let y = a[i].array[2].number else { continue }
                    let m = a[i].array[9].string, ty = translateY(m)
                    // Chrome clears a row's FLIP transform early when the transition is cancelled (transitioncancel → clearInline):
                    // a transform still far from rest that is gone in the next frame.
                    if cut == nil, abs(lastTY) > 8, m == "none" { cut = tau(s) }
                    lastTY = ty
                    curve.append((tau(s), (y - base) / 53))
                }
                if let cut {
                    gaps.append("\(tag): Chrome cancels \(names[k])'s FLIP glide at \(Int(cut)) ms (transitioncancel); native completes it (captureFlip contract)")
                    continue
                }
                motion(tag, web: curve, key: "order:" + r.id, t0: t0, tolerance: 0.2)
            }
        }
        // Horizontal thumb colour while dragged (outline → on-surface-variant).
        let thumb = samples.compactMap { s -> (Double, Double)? in let t = s["thumbs"].array; guard let h = t.first, h != .null, h.array.count > 4 else { return nil }; return (tau(s), (121.0 / 255 - rgba(h.array[4].string)[0]) / ((121.0 - 73) / 255)) }
        motion(tag, web: thumb, key: "thumb:" + state.tableID, t0: t0, tolerance: 0.2)
        // Frozen body scroll (smooth keyboard scrolling) frame by frame.
        let scrollTop = samples.compactMap { s -> (Double, Double)? in s["scroll"].array.first { $0["path"].string.contains("body-scroll") }.map { (tau(s), $0["top"].number ?? 0) } }
        if ph["label"].string.hasPrefix("wheel") {
            if scrollTop.count > 2 { gaps.append("\(tag): wheel scrolling follows the platform's scroll physics (Chrome animates wheel deltas); final offsets compared") }
        } else if scrollTop.count > 2, (scrollTop.map(\.1).max() ?? 0) - (scrollTop.map(\.1).min() ?? 0) > 20 {
            // The harness samples the scroll offset once per run-loop turn (a layout pass can take several frames): the native curve
            // is interpolated between its samples and aligned on its first moved frame (a gap when later than one frame).
            // The scroll animation's own ticks (the offset each tick put on screen) when recorded, else the per-turn samples.
            let framesSeries = frames.compactMap { f in f.scroll.map { (f.t, Double($0.y)) } }
            let ticks = state.motion.samples.filter { $0.key == "body-scroll-y" && $0.t >= phaseInput - 20 && $0.t <= t0 + 800 }.map { ($0.t, $0.value) }
            let series = ticks.count >= 3 ? (framesSeries.filter { $0.0 < (ticks.first?.0 ?? 0) } + ticks) : framesSeries
            func at(_ t: Double) -> Double? {
                guard let firstS = series.first else { return nil }
                if t <= firstS.0 { return firstS.1 }
                for k in 1..<series.count where series[k].0 >= t {
                    let (t1, v1) = series[k - 1], (t2, v2) = series[k]
                    return t2 > t1 ? v1 + (v2 - v1) * (t - t1) / (t2 - t1) : v2
                }
                return series.last?.1
            }
            var shift = t0
            if let start = series.first(where: { $0.0 >= t0 })?.1, let moved = series.first(where: { $0.0 >= t0 && abs($0.1 - start) > 0.5 }) {
                // Back to where the interpolated curve left its start value.
                if let k = series.firstIndex(where: { $0.0 == moved.0 }), k > 0, series[k - 1].0 - 17 > t0 { shift = series[k - 1].0 - 17; gaps.append("\(tag): smooth scroll starts \(Int(series[k - 1].0 - t0)) ms after the input (curve aligned on it)") }
            }
            // The animation's own start (first tick) before t0: the key reached the view during the harness's action (iOS HID keys
            // take longer than CDP's): the native start is aligned on the Web's (its last sample before the first move), a gap.
            if let ft = ticks.first?.0, ft < t0 - 8, let v0 = scrollTop.first?.1 {
                let webStart = scrollTop.firstIndex { abs($0.1 - v0) > 0.5 }.map { $0 > 0 ? scrollTop[$0 - 1].0 : 0 } ?? 0
                shift = ft - webStart; gaps.append("\(tag): smooth scroll began \(Int(t0 - ft)) ms before the action ended (aligned on its start)")
            }
            var ok = 0
            for (tv, v) in scrollTop {
                let near = stride(from: -33.0, through: 33.0, by: 4).compactMap { at(shift + tv + $0) }
                if let lo = near.min(), let hi = near.max(), v >= lo - 12, v <= hi + 12 { ok += 1 }
            }
            check(Double(ok) >= Double(scrollTop.count) * 0.9, "\(tag): smooth scroll \(ok)/\(scrollTop.count) frames within 12px (±2 frames)")
            if Double(ok) < Double(scrollTop.count) * 0.9 {
                let nat = frames.filter { $0.t >= t0 - 20 && $0.t <= t0 + 260 }.map { "\(Int($0.t - t0)):\($0.scroll.map { String(format: "%.0f", Double($0.y)) } ?? "-")" }
                print("DIAG smooth \(tag): web \(scrollTop.map { "\(Int($0.0)):\(Int($0.1))" }.joined(separator: " ")) | native \(nat.joined(separator: " ")) | ticks \(ticks.prefix(30).map { "\(Int($0.0 - t0)):\(Int($0.1))" }.joined(separator: " "))"); fflush(stdout)
            }
        }
    }
    static func main() {
        _ = NSApplication.shared; NSApp.setActivationPolicy(.accessory)
        AWCTableMotionRecorder.shared = state.motion
        host = NSHostingView(rootView: TableStatesFixture(state: state))
        window = NSWindow(contentRect: .init(x: -20000, y: -20000, width: 1200, height: 900), styleMask: [.borderless], backing: .buffered, defer: false)
        window.isReleasedWhenClosed = false; window.colorSpace = .sRGB; window.contentView = host
        #if os(macOS)
        window.autorecalculatesKeyViewLoop = true
        #endif
        window.orderFrontRegardless(); pump(200)
        // Defaults next to this file (the iOS harness bundles Fixtures/ and rewrites #filePath into the app bundle).
        let here = URL(fileURLWithPath: #filePath).deletingLastPathComponent()
        let fixtures = env["AWC_TABLE_STATES"].map { URL(fileURLWithPath: $0) } ?? here.appendingPathComponent("Fixtures/table-web-states.json")
        let oracle = env["AWC_TABLE_ORACLE"].map { URL(fileURLWithPath: $0) } ?? here.appendingPathComponent("Fixtures/table-web-oracle")
        let captureDir = env["AWC_TABLE_CAPTURE_DIRECTORY"].map { URL(fileURLWithPath: $0) }
        if let captureDir { try? FileManager.default.createDirectory(at: captureDir, withIntermediateDirectories: true) }
        let file = value(try! JSONSerialization.jsonObject(with: Data(contentsOf: fixtures)))
        data = file["data"].array.map(\.array)
        let only = env["AWC_TABLE_STATES_ONLY"]
        for r in file["runs"].array where only.map({ o in o.split(separator: ",").contains { (r["set"].string + "/" + r["name"].string).contains($0) } }) ?? true {
            run(r, oracle: oracle, set: r["set"].string, captureDir: captureDir)
        }
        if let out = env["AWC_TABLE_REPORT"] { try? JSONSerialization.data(withJSONObject: ["checks": checks, "failures": failures, "gaps": gaps, "report": report], options: [.prettyPrinted, .sortedKeys]).write(to: URL(fileURLWithPath: out)) }
        print("NativeTableStatesIntegration: \(checks - failures.count)/\(checks) checks; latency gaps \(gaps.count)")
        window.close(); exit(failures.isEmpty ? 0 : 1)
    }
}
