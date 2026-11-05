import AppKit
import SwiftUI
import Observation
@testable import AWCUI

// md-table family paint against Mac Chrome (outputs/native-parity/md-table/web-oracle, 109 cases):
// resolved column tracks, row boxes, every flat pixel of the clip (mean ≤ 1.0, > 6 ratio ≤ 0.5 %).
// Animated regions (indeterminate progress, skeleton shimmer) and nested components still pending native
// parity elsewhere (md-select) are masked and reported per case.

struct TableFixtureFile: Decodable { let cases: [TableFixtureCase] }
struct TableFixtureCase: Decodable {
    struct Clip: Decodable { let x: Double, y: Double, width: Double, height: Double }
    struct Scroll: Decodable { let path: String, left: Double, top: Double, cw: Double, ch: Double, sw: Double, sh: Double }
    struct Hover: Decodable { let row: Int?, cell: Int?, sortLabel: String? }
    struct Prepare: Decodable { let scroll: [Scroll]?, hover: Hover?, tabs: Int?, select: [Int]? }
    struct Element: Decodable { let tag: String, rect: [Double?], parts: [String: [Double?]], attrs: [String: String] }
    struct Web: Decodable { let grid: [Double], rows: [[Double]], pinned: [[AWCValue]], elements: [Element] }
    let name: String, subset: String, theme: String, dir: String, width: Double, clip: Clip, nodes: [AWCNode], prepare: Prepare, shot: String, web: Web
}

@Observable final class TablePaintState {
    var nodes: [AWCNode] = []
    var dark = false
    var rtl = false
    var forced = false
    var width = 760.0
    var epoch = 0
    var page: Color = .white
    var inspect = "n0"
    var measurements: [AWCNativeInspectionNode] = []
    @ObservationIgnored let scroller = AWCTableScrollController()
    @ObservationIgnored let pointer = AWCNativePointerState()
}
struct TablePaintFixture: View {
    let state: TablePaintState
    var body: some View {
        let epoch = state.epoch, theme = AWCTheme.generated(dark: state.dark)
        VStack(alignment: .leading, spacing: 0) { ForEach(state.nodes) { AWCNativeView(node: $0) } }
            .frame(width: state.width, alignment: .topLeading)
            .environment(\.layoutDirection, state.rtl ? .rightToLeft : .leftToRight)
            .awcTableForcedColors(state.forced)
            .awcTableReducedMotion(true)
            .awcTableScrollController(state.scroller)
            .environment(\.awcNativePointerState, state.pointer)
            .scrollIndicators(.hidden)   // headless Chrome hides scrollbars in the oracle
            .awcTheme(theme)
            .awcNativeInspection(rootID: state.inspect, coordinateSpace: "awc-native-preview") { if state.epoch == epoch { state.measurements = $0 } }
            .id(epoch)
            .padding(.leading, 24).padding(.top, 24)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .background(state.page)
            .coordinateSpace(name: "awc-native-preview")
    }
}

struct TableRaster {
    let w: Int, h: Int, px: [UInt8]   // RGBA, sRGB, 1 px = 1 CSS px
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
    /// Draws any CGImage into an sRGB RGBA buffer of w × h pixels (downsampling Retina captures by area).
    static func from(_ image: CGImage, width: Int, height: Int) -> TableRaster {
        var buffer = [UInt8](repeating: 0, count: width * height * 4)
        let space = CGColorSpace(name: CGColorSpace.sRGB)!
        buffer.withUnsafeMutableBytes { raw in
            let ctx = CGContext(data: raw.baseAddress, width: width, height: height, bitsPerComponent: 8, bytesPerRow: width * 4, space: space,
                                bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
            ctx.interpolationQuality = .high
            ctx.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
        }
        return .init(w: width, h: height, px: buffer)
    }
}

@main @MainActor enum NativeTablePaintIntegration {
    static let state = TablePaintState()
    static var host: NSHostingView<TablePaintFixture>!, window: NSWindow!
    static var checks = 0, failures: [String] = [], report: [[String: Any]] = []
    static let env = ProcessInfo.processInfo.environment
    static func check(_ ok: Bool, _ message: @autoclosure () -> String) { checks += 1; if !ok { failures.append(message()) } }
    static func settle(_ seconds: Double = 0.12) {
        let end = Date().addingTimeInterval(seconds)
        while Date() < end { RunLoop.main.run(until: Date().addingTimeInterval(0.01)); host.layoutSubtreeIfNeeded() }
    }
    static func capture(_ clip: TableFixtureCase.Clip) -> TableRaster {
        let rect = NSRect(x: clip.x, y: clip.y, width: clip.width, height: clip.height)
        let rep = host.bitmapImageRepForCachingDisplay(in: rect)!
        host.cacheDisplay(in: rect, to: rep)
        return TableRaster.from(rep.cgImage!, width: Int(clip.width), height: Int(clip.height))
    }
    static func load(_ url: URL) -> TableRaster? {
        guard let image = NSImage(contentsOf: url), let cg = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else { return nil }
        return TableRaster.from(cg, width: cg.width, height: cg.height)
    }
    static func png(_ r: TableRaster, _ url: URL) {
        var bytes = r.px
        let space = CGColorSpace(name: CGColorSpace.sRGB)!
        bytes.withUnsafeMutableBytes { raw in
            let ctx = CGContext(data: raw.baseAddress, width: r.w, height: r.h, bitsPerComponent: 8, bytesPerRow: r.w * 4, space: space, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
            let rep = NSBitmapImageRep(cgImage: ctx.makeImage()!)
            try? rep.representation(using: .png, properties: [:])?.write(to: url)
        }
    }
    /// Pixel regions excluded from the flat-pixel comparison (absolute page coordinates) with the reason.
    static func masks(_ c: TableFixtureCase) -> [(CGRect, String)] {
        var out: [(CGRect, String)] = []
        for e in c.web.elements {
            guard e.rect.count == 4, let x = e.rect[0], let y = e.rect[1], let w = e.rect[2], let h = e.rect[3], w > 0, h > 0 else { continue }
            if e.tag == "md-progress-indicator" { out.append((CGRect(x: x, y: y, width: w, height: h).insetBy(dx: -1, dy: -1), "indeterminate progress (time-based)")) }
            if e.tag == "md-select" { out.append((CGRect(x: x, y: y, width: w, height: h).insetBy(dx: -1, dy: -1), "md-select (native parity owned by md-select)")) }
            // Shadow-tree nested components appear as parts of their host.
            var parts = [("rpp-select", "md-select (native parity owned by md-select)"), ("progress", "indeterminate progress (time-based)")]
            if c.subset == "forced-colors" { parts += ["first-button", "prev-button", "next-button", "last-button"].map { ($0, "md-icon-button forced colours (owned by md-icon-button)") } }
            if c.name.contains("gutter") { parts.append(("gutter", "")) }
            for (part, reason) in parts {
                if let r = e.parts[part], r.count == 4, let px = r[0], let py = r[1], let pw = r[2], let ph = r[3], pw > 0, ph > 0 {
                    out.append((CGRect(x: px, y: py, width: pw, height: ph).insetBy(dx: -1, dy: -1), reason))
                }
            }
        }
        if c.name.contains("gutter"), let body = c.web.elements.first(where: { $0.tag == "md-table" }), let x = body.rect[0], let y = body.rect[1], let w = body.rect[2], let h = body.rect[3] {
            // scrollbar="gutter": the platform indicator lives in the reserved strip; headless Chrome draws nothing there.
            out.append((CGRect(x: c.dir == "rtl" ? x : x + w - 10, y: y + 57, width: 10, height: h - 57), "platform scroll indicator in the reserved gutter"))
        }
        if c.subset == "forced-colors" {
            for e in c.web.elements where e.tag == "md-table-expand-toggle" {
                if e.rect.count == 4, let x = e.rect[0], let y = e.rect[1], let w = e.rect[2], let h = e.rect[3], w > 0 { out.append((CGRect(x: x, y: y, width: w, height: h).insetBy(dx: -1, dy: -1), "md-icon-button forced colours (owned by md-icon-button)")) }
            }
            // Nested components without a native forced-colours mode (owned by md-checkbox / md-icon-button).
            for e in c.web.elements where e.tag == "md-checkbox" || e.tag == "md-icon-button" {
                if e.rect.count == 4, let x = e.rect[0], let y = e.rect[1], let w = e.rect[2], let h = e.rect[3], w > 0 { out.append((CGRect(x: x, y: y, width: w, height: h).insetBy(dx: -1, dy: -1), "\(e.tag) forced colours (owned by \(e.tag))")) }
            }
        }
        if c.name.contains("skeleton") {
            // Shimmer phase is wall-clock based: the bar boxes are checked, their gradient is not.
            if let table = c.web.elements.first(where: { $0.tag == "md-table" }), let x = table.rect[0], let y = table.rect[1], let w = table.rect[2], let h = table.rect[3] {
                out.append((CGRect(x: x, y: y + 57, width: w, height: h - 57), "skeleton shimmer (time-based)"))
            }
        }
        return out
    }
    static func compare(_ c: TableFixtureCase, web: TableRaster, native: TableRaster) -> (mean: Double, over: Double, compared: Int, masked: [String]) {
        let m = masks(c)
        var sum = 0.0, over = 0, n = 0
        for y in 1..<(web.h - 1) {
            for x in 1..<(web.w - 1) {
                let page = CGPoint(x: c.clip.x + Double(x) + 0.5, y: c.clip.y + Double(y) + 0.5)
                if m.contains(where: { $0.0.contains(page) }) { continue }
                guard web.flat(x, y, 6), native.flat(x, y, 6) else { continue }
                let a = web.rgb(x, y), b = native.rgb(x, y)
                let d = max(abs(a.0 - b.0), abs(a.1 - b.1), abs(a.2 - b.2))
                sum += Double(d); n += 1; if d > 6 { over += 1 }
            }
        }
        return (n == 0 ? 0 : sum / Double(n), n == 0 ? 0 : Double(over) / Double(n), n, Array(Set(m.map(\.1))))
    }
    static func main() {
        let app = NSApplication.shared; app.setActivationPolicy(.accessory)
        // Defaults next to this file (the iOS harness bundles Fixtures/ and rewrites #filePath into the app bundle).
        let here = URL(fileURLWithPath: #filePath).deletingLastPathComponent()
        let fixtures = env["AWC_TABLE_FIXTURES"].map { URL(fileURLWithPath: $0) } ?? here.appendingPathComponent("Fixtures/table-web-paint.json")
        let oracle = env["AWC_TABLE_ORACLE"].map { URL(fileURLWithPath: $0) } ?? here.appendingPathComponent("Fixtures/table-web-oracle")
        let only = env["AWC_TABLE_CASES"].map { Set($0.split(separator: ",").map(String.init)) }
        let subsets = env["AWC_TABLE_SUBSETS"].map { Set($0.split(separator: ",").map(String.init)) }
        let captureDir = env["AWC_TABLE_CAPTURE_DIRECTORY"].map { URL(fileURLWithPath: $0) }
        if let captureDir { try? FileManager.default.createDirectory(at: captureDir, withIntermediateDirectories: true) }
        let file = try! JSONDecoder().decode(TableFixtureFile.self, from: Data(contentsOf: fixtures))
        host = NSHostingView(rootView: TablePaintFixture(state: state))
        window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1200, height: 900), styleMask: [.borderless], backing: .buffered, defer: false)
        window.colorSpace = .sRGB
        window.contentView = host
        // Keep the real pointer off the fixture (row hover follows the pointer).
        #if os(macOS)
        // Hover comes from the host pointer state only: the real mouse (on any screen) must not reach the fixture.
        window.ignoresMouseEvents = true
        if let screen = NSScreen.main?.frame {
            let mouse = NSEvent.mouseLocation
            window.setFrameOrigin(NSPoint(x: mouse.x < screen.midX ? screen.maxX - 1200 : screen.minX, y: mouse.y < screen.midY ? screen.maxY - 900 : screen.minY))
        }
        #endif
        window.orderFrontRegardless()
        var passed = 0
        for c in file.cases {
            if let only, !only.contains(c.name) { continue }
            if let subsets, !subsets.contains(c.subset) { continue }
            if c.prepare.tabs != nil { report.append(["name": c.name, "skipped": "keyboard focus — NativeTableStatesIntegration"]); continue }
            guard let web = load(oracle.appendingPathComponent(c.shot)) else { check(false, "\(c.name): missing Web shot \(c.shot)"); continue }
            let before = failures.count
            state.pointer.update(phase: .leave)   // before the case renders: a previous hover must not leak
            state.dark = c.theme == "dark"; state.rtl = c.dir == "rtl"; state.forced = c.subset == "forced-colors"
            let corner = web.rgb(0, 0); state.page = Color(.sRGB, red: Double(corner.0) / 255, green: Double(corner.1) / 255, blue: Double(corner.2) / 255)
            var nodes = c.nodes
            if let select = c.prepare.select { nodes = nodes.map { selectRows($0, select) } }
            let cellIDs = ids(nodes, "md-table-cell")
            state.inspect = ([tableID(nodes) ?? "n0"] + cellIDs).joined(separator: "|")
            state.nodes = nodes; state.width = c.width; state.epoch += 1
            settle(0.25)
            if let hover = c.prepare.hover {
                // The page moves a trusted pointer to the target's centre; the host pointer state carries that location.
                let rows = c.web.elements.filter { $0.tag == "md-table-row" }
                var target: [Double?]? = nil
                if let label = hover.sortLabel { let labels = c.web.elements.filter { $0.tag == "md-table-sort-label" }; let order = ["name", "cal", "fat", "carbs", "protein"]; if let i = order.firstIndex(of: label), i < labels.count { target = labels[i].rect } }
                else if let r = hover.row, r + 1 < rows.count {
                    let cells = c.web.elements.filter { $0.tag == "md-table-cell" }
                    let perRow = cells.count / Swift.max(1, rows.count)
                    let k = (r + 1) * perRow + (hover.cell ?? 0)
                    target = k < cells.count ? cells[k].rect : rows[r + 1].rect
                }
                if let t = target, t.count == 4, let x = t[0], let y = t[1], let w = t[2], let h = t[3] { state.pointer.update(phase: .move, location: CGPoint(x: x + w / 2, y: y + h / 2)); settle(0.45) }
            }
            if let scrolls = c.prepare.scroll, let s = scrolls.first {
                _ = state.scroller.scroll(x: abs(s.left) > 0 ? abs(s.left) : nil, y: s.top > 0 ? s.top : nil); settle(0.25)
            }
            // Geometry: resolved tracks and row boxes.
            let table = state.measurements.first { $0.name == "md-table" }
            // Cell boxes and their content boxes against the Web rects (document order).
            let webCells = c.web.elements.filter { $0.tag == "md-table-cell" }
            if !c.name.contains("skeleton") {
                for (i, id) in cellIDs.enumerated() where i < webCells.count {
                    let w = webCells[i]
                    guard w.rect.count == 4, let wx = w.rect[0], let wy = w.rect[1], let ww = w.rect[2], let wh = w.rect[3], ww > 0 else { continue }
                    guard let n = state.measurements.first(where: { $0.id == id + ":component" }) else { continue }
                    let b = n.bounds
                    check(abs(Double(b.minX) - wx) <= 0.6 && abs(Double(b.width) - ww) <= 0.6 && abs(Double(b.minY) - wy) <= 0.6 && abs(Double(b.height) - wh) <= 0.6,
                          "\(c.name): cell \(i) \(id) box \(r2(b)) vs [\(wx), \(wy), \(ww), \(wh)]")
                    if let content = w.parts["content"], content.count == 4, let cx = content[0], let cy = content[1], let cw = content[2], let ch = content[3], cw > 0,
                       let nc = state.measurements.first(where: { $0.id == id + ":component.content" }) {
                        let k = nc.bounds
                        check(abs(Double(k.minX) - cx) <= 0.75 && abs(Double(k.width) - cw) <= 0.75 && abs(Double(k.midY) - (cy + ch / 2)) <= 0.75,
                              "\(c.name): cell \(i) content \(r2(k)) vs [\(cx), \(cy), \(cw), \(ch)]")
                    }
                }
            }
            let columns = table?.metrics["columns"]?.array.compactMap(\.number) ?? []
            if !c.web.grid.isEmpty {
                check(columns.count == c.web.grid.count && zip(columns, c.web.grid).allSatisfy { abs($0 - $1) <= 0.5 }, "\(c.name): columns \(columns.map { ($0 * 100).rounded() / 100 }) vs \(c.web.grid)")
            }
            let rows = table?.metrics["rows"]?.array.map { $0.array.compactMap(\.number) } ?? []
            let webHeights = c.web.rows.map { $0.count > 1 ? $0[1] : 0 }
            if !webHeights.isEmpty && !c.name.contains("frozen") {
                let nativeHeights = rows.map { $0.count > 1 ? $0[1] : 0 }
                check(nativeHeights.count >= webHeights.count && zip(nativeHeights, webHeights).allSatisfy { abs($0 - $1) <= 0.5 }, "\(c.name): row heights \(nativeHeights) vs \(webHeights)")
            }
            // Pixels.
            let native = capture(c.clip)
            if let captureDir { png(native, captureDir.appendingPathComponent(c.name + ".png")) }
            let r = compare(c, web: web, native: native)
            check(r.mean <= 1.0 && r.over <= 0.005, "\(c.name): flat-pixel mean \(String(format: "%.3f", r.mean)) >6 \(String(format: "%.3f", r.over * 100))% (\(r.compared) px)")
            let ok = failures.count == before
            if ok { passed += 1 }
            report.append(["name": c.name, "ok": ok, "mean": r.mean, "over": r.over, "compared": r.compared, "masked": r.masked, "columns": columns])
        }
        if let out = env["AWC_TABLE_REPORT"] { try? JSONSerialization.data(withJSONObject: report, options: [.prettyPrinted, .sortedKeys]).write(to: URL(fileURLWithPath: out)) }
        for f in failures.prefix(80) { print("FAIL", f) }
        print("NativeTablePaintIntegration: \(checks - failures.count)/\(checks) checks, \(passed) cases fully passing")
        exit(failures.isEmpty ? 0 : 1)
    }
    static func r2(_ b: CGRect) -> String { "[\((b.minX * 100).rounded() / 100), \((b.minY * 100).rounded() / 100), \((b.width * 100).rounded() / 100), \((b.height * 100).rounded() / 100)]" }
    static func ids(_ nodes: [AWCNode], _ tag: String) -> [String] { nodes.flatMap { ($0.tag == tag ? [$0.id] : []) + ids($0.children, tag) } }
    static func tableID(_ nodes: [AWCNode]) -> String? {
        for n in nodes { if n.tag == "md-table" { return n.id }; if let id = tableID(n.children) { return id } }
        return nil
    }
    /// The page's autoBindSelect (rows 1 and 3 selected after load) as authored state.
    static func selectRows(_ node: AWCNode, _ indices: [Int]) -> AWCNode {
        var n = node
        if n.tag == "md-table-body" {
            for (i, row) in n.children.enumerated() where row.tag == "md-table-row" && indices.contains(i) { n.children[i].properties["selected"] = true }
            return n
        }
        n.children = n.children.map { selectRows($0, indices) }
        return n
    }
}
