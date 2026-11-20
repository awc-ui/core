import AppKit
import SwiftUI
#if canImport(UIKit)
import UIKit
#endif
import Observation
@testable import AWCUI

// md-date-picker paint and geometry against Chrome 153 (Mac capture of dp-paint.html, DPR 1, 129 cases; today pinned to
// 2025-06-12): every variant × theme × direction open and closed, the field states, calendar locales / week starts /
// separators / labels / slots, the entry mode, the year grid, the docked menus, densities, every hook, phone viewports.
// Checks the locale strings (headline, weekdays, day names, field value / hint), the host, every part box, the days'
// states and every flat pixel of the clip.
@Observable final class DatePickerPaintState {
    var node = AWCNode(id: "dp", tag: "md-date-picker")
    var epoch = 0
    var dark = false
    var rtl = false
    var width = 360.0
    var origin = CGPoint(x: 24, y: 24)
    var appearance = AWCDatePickerAppearance()
    var density: Double? = nil
    var measurements: [AWCNativeInspectionNode] = []
    @ObservationIgnored let controller = AWCDatePickerController()
}
struct DatePickerPaintFixture: View {
    let state: DatePickerPaintState
    var body: some View {
        let epoch = state.epoch, theme = AWCTheme.generated(dark: state.dark)
        AWCModalScope {
            ZStack(alignment: .topLeading) {
                AWCNativeView(node: state.node).frame(width: state.width, alignment: .leading)
                    .fixedSize(horizontal: false, vertical: true)
                    .environment(\.layoutDirection, state.rtl ? .rightToLeft : .leftToRight)
                    .padding(.leading, state.origin.x).padding(.top, state.origin.y)
                    .environment(\.layoutDirection, .leftToRight)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
        .modifier(DensityScope(density: state.density))
        .awcDatePickerAppearance(state.appearance).awcDatePickerToday(AWCDay(year: 2025, month: 6, day: 12))
        .awcDatePickerController(state.controller, for: "dp")
        .awcReducedMotion(true)
        .environment(\.locale, Locale(identifier: "en_US"))   // the oracle browser's default locale
        .awcTheme(theme)
        .awcNativeInspection(rootID: "dp", coordinateSpace: "awc-native-preview") { if state.epoch == epoch { state.measurements = $0 } }
        .id(epoch)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(theme.background).coordinateSpace(name: "awc-native-preview")
    }
}
/// A page-level `data-density` (density-global-* cases): the scale and spacing rung every descendant inherits.
struct DensityScope: ViewModifier {
    let density: Double?
    func body(content: Content) -> some View {
        if let d = density { content.environment(\.awcNativeDensity, d).environment(\.awcNativeSpacingRung, [-2.0, -3, -4].contains(d) ? d : 0) } else { content }
    }
}
struct DPGrid {
    let x: Int, y: Int, w: Int, h: Int; var values: [Double]
    func at(_ px: Int, _ py: Int) -> [Double] { let i = ((py - y) * w + (px - x)) * 3; return [values[i], values[i + 1], values[i + 2]] }
    func flatMask(_ limit: Double) -> [Bool] {
        var out = [Bool](repeating: false, count: w * h)
        guard w > 2 && h > 2 else { return out }
        values.withUnsafeBufferPointer { v in out.withUnsafeMutableBufferPointer { o in
            for yy in 1..<(h - 1) { for xx in 1..<(w - 1) {
                var ok = true, c = 0
                while ok && c < 3 {
                    var lo = 999.0, hi = -1.0, dy = -1
                    while dy <= 1 { let row = (yy + dy) * w; var dx = -1
                        while dx <= 1 { let q = v[(row + xx + dx) * 3 + c]; if q < lo { lo = q }; if q > hi { hi = q }; dx += 1 }
                        dy += 1 }
                    if hi - lo > limit { ok = false }; c += 1
                }
                o[yy * w + xx] = ok } }
        } }
        return out
    }
}
@main @MainActor enum NativeDatePickerPaintIntegration {
    static let tolerance = 0.6
    static let state = DatePickerPaintState()
    static var host: NSHostingView<DatePickerPaintFixture>!, window: NSWindow!
    static var checks = 0, failures: [String] = [], report: [[String: Any]] = []
    /// Checks that differ for a recorded decision (source review): listed with the reason, never counted as passed.
    static var recorded: [String] = []
    static let env = ProcessInfo.processInfo.environment
    static func check(_ value: Bool, _ name: String) { checks += 1; if !value { failures.append(name); print("FAIL: " + name); fflush(stdout) } }
    static func pump(_ duration: Double = 0.1) {
        let end = Date().addingTimeInterval(duration)
        repeat {
            var n = 0
            while let e = NSApp.nextEvent(matching: .any, until: .distantPast, inMode: .default, dequeue: true) { NSApp.sendEvent(e); n += 1; if n > 2000 { break } }
            host.layoutSubtreeIfNeeded()
            RunLoop.current.run(until: Date().addingTimeInterval(0.01))
        } while Date() < end
    }
    struct Shot { let cg: CGImage; let scale: Double; let origin: CGPoint }
    static func capture(_ r: CGRect) -> Shot {
        let rr = host.isFlipped ? r : CGRect(x: r.minX, y: host.bounds.height - r.maxY, width: r.width, height: r.height)
        let b = host.bitmapImageRepForCachingDisplay(in: rr)!; host.cacheDisplay(in: rr, to: b)
        return .init(cg: b.cgImage!, scale: Double(b.pixelsWide) / r.width, origin: r.origin)
    }
    static func grid(_ s: Shot, x: Int, y: Int, w: Int, h: Int) -> DPGrid {
        let k = max(1, Int(s.scale.rounded()))
        let crop = CGRect(x: (Double(x) - s.origin.x) * Double(k), y: (Double(y) - s.origin.y) * Double(k), width: Double(w * k), height: Double(h * k))
        var values = [Double](repeating: -999, count: w * h * 3)
        guard let cg = s.cg.cropping(to: crop), cg.width == w * k, cg.height == h * k else { return .init(x: x, y: y, w: w, h: h, values: values) }
        var buffer = [UInt8](repeating: 0, count: cg.width * cg.height * 4)
        buffer.withUnsafeMutableBytes { raw in
            let ctx = CGContext(data: raw.baseAddress, width: cg.width, height: cg.height, bitsPerComponent: 8, bytesPerRow: cg.width * 4, space: CGColorSpace(name: CGColorSpace.sRGB)!,
                                bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
            ctx.draw(cg, in: .init(x: 0, y: 0, width: cg.width, height: cg.height))
        }
        let n = Double(k * k), cw = cg.width
        buffer.withUnsafeBufferPointer { b in values.withUnsafeMutableBufferPointer { out in
            for py in 0..<h { for px in 0..<w { var s0 = 0.0, s1 = 0.0, s2 = 0.0, yy = py * k
                while yy < py * k + k { var xx = px * k
                    while xx < px * k + k { let i = (yy * cw + xx) * 4; s0 += Double(b[i]); s1 += Double(b[i + 1]); s2 += Double(b[i + 2]); xx += 1 }
                    yy += 1 }
                let o = (py * w + px) * 3; out[o] = s0 / n; out[o + 1] = s1 / n; out[o + 2] = s2 / n } }
        } }
        return .init(x: x, y: y, w: w, h: h, values: values)
    }
    static var runtime: AWCDatePickerRuntime? { AWCDatePickerRuntime.mounted["dp"] }

    /// The model's strings against Chrome's (Intl over ICU): headline, weekday letters, day names, field value / hint.
    static func locale(_ c: AWCValue) {
        let name = c["name"].string
        var props: [String: AWCValue] = [:]; if case .object(let o) = c["props"] { props = o }
        let loc = AWCDateLocale(props["locale"]?.string ?? "", fallback: Locale(identifier: "en_US")), sep = props["dateSeparator"]?.string ?? ""
        let value = AWCDay.iso(props["value"]?.string ?? "")
        let fd = Int(props["firstDayOfWeek"]?.number ?? -1), first = (0...6).contains(fd) ? fd : loc.firstDayOfWeek
        let els = c["elements"].array
        let webWeekdays = els.filter { $0["key"].string == "weekday" }.map { $0["text"].string }
        if !webWeekdays.isEmpty { check(webWeekdays == loc.weekdays(first: first), "\(name) locale weekdays \(loc.weekdays(first: first)) vs \(webWeekdays)") }
        if let h = els.first(where: { $0["key"].string == "headline" }), let v = value, !h["text"].string.isEmpty, h["text"].string != "Enter dates", h["text"].string != "Select date",
           (props["headline"] == nil || true) {
            let mine = loc.format(v, skeleton: "MMMEd"); check(mine == h["text"].string, "\(name) locale headline \(mine) vs \(h["text"].string)")
        }
        for e in els where e["key"].string == "day" {
            let iso = e["attrs"]["data-date"].string
            guard let d = AWCDay.iso(iso) else { continue }
            let mine = loc.format(d, skeleton: "yMMMMEEEEd"); if mine != e["attrs"]["aria-label"].string { check(false, "\(name) locale day name \(mine) vs \(e["attrs"]["aria-label"].string)"); break }
            if e["text"].string != String(d.day) { check(false, "\(name) day text \(e["text"].string) vs \(d.day)"); break }
        }
        if let v = els.first(where: { $0["key"].string.hasSuffix("/value") && $0["key"].string.hasPrefix("md-text-field#0") }), let day = value {
            let mine = loc.display(day, separator: sep); check(mine == v["value"].string, "\(name) locale field value \(mine) vs \(v["value"].string)")
        }
        if let st = els.first(where: { $0["key"].string == "md-text-field#0/supporting-text" }), props["supportingText"] == nil, props["error"] == nil, props["errorText"] == nil {
            let mine = loc.pattern(separator: sep); check(mine == st["text"].string, "\(name) locale hint \(mine) vs \(st["text"].string)")
        }
        if let mt = els.first(where: { $0["key"].string == "md-button#3/label" }), let v = value, c["props"]["variant"].string != "docked" {
            let mine = loc.format(AWCDay(year: v.year, month: v.month, day: 1), skeleton: "yMMMM"); check(mine == mt["text"].string || mt["text"].string.isEmpty, "\(name) locale month \(mine) vs \(mt["text"].string)")
        }
    }

    static func run(_ c: AWCValue, shots: URL) {
        let name = c["name"].string, started = Date()
        print("case \(name)"); fflush(stdout)
        defer { print("  \(name) \(Int(Date().timeIntervalSince(started) * 1000)) ms"); fflush(stdout) }
        locale(c)
        let vp = c["viewport"].array.map { $0.number ?? 0 }
        let size = NSSize(width: vp.count == 2 ? vp[0] : 1200, height: vp.count == 2 ? vp[1] : 900)
        if window.contentView?.frame.size != size { window.setContentSize(size); host.frame = NSRect(origin: .zero, size: size) }
        let h = c["host"]
        state.dark = c["theme"].string == "dark"; state.rtl = c["dir"].string == "rtl"
        let modal = c["props"]["variant"].string == "modal"
        state.width = modal ? 1 : (h["width"].number ?? 360)
        state.origin = modal ? CGPoint(x: 24, y: 24) : CGPoint(x: h["x"].number ?? 24, y: h["y"].number ?? 24)
        var hooks: [String: String] = [:]; if case .object(let o) = c["hooks"] { for (k, v) in o { hooks[k] = v.string } }
        state.appearance = AWCDatePickerAppearance(hooks)
        var props: [String: AWCValue] = [:]; if case .object(let o) = c["props"] { props = o }
        // A page-level data-density wrapper (density-global-N, density-0-under-global): the scale every descendant inherits.
        let html = c["html"].string
        state.density = html.components(separatedBy: "data-density=\"").dropFirst().first.flatMap { Double($0.prefix { $0 != "\"" }) }
        state.controller.isDateDisabled = name == "cal-weekends-disabled" ? { $0.weekday == 0 || $0.weekday == 6 } : nil
        let open = props["open"]?.bool == true
        state.node = AWCNode(id: "dp", tag: "md-date-picker", properties: props, children: slots(c["html"].string))
        state.measurements = []; state.epoch += 1; pump(open ? 0.9 : 0.35)
        // The page's preparation (the shown sub-view): entry mode, the year grid, a docked menu.
        let keys = Set(c["elements"].array.map { $0["key"].string })
        if keys.contains("entry") { runtime?.inputMode = true; pump(0.3) }
        if keys.contains("year-grid") { runtime?.viewMode = .year; pump(0.3) }
        if keys.contains("month-menu") { runtime?.monthMenuOpen = true; pump(0.3) }
        if keys.contains("year-menu") { runtime?.yearMenuOpen = true; pump(0.3) }
        let ms = state.measurements
        func m(_ part: String) -> AWCNativeInspectionNode? { ms.first { $0.name == part } }
        if env["AWC_DP_DUMP"] != nil { print("DUMP \(name) state.density \(String(describing: state.density))"); for n in ms where n.name != "day" && n.name != "year" { print("DUMP \(name) \(n.id) \(n.name) \(n.bounds) \(n.metrics)") } }
        func near(_ a: Double, _ b: Double, _ label: String, _ tol: Double = tolerance, record reason: String? = nil) {
            if let reason, abs(a - b) > tol { recorded.append("\(name) \(label) \(a) vs \(b) [\(reason)]"); return }
            check(abs(a - b) <= tol, "\(name) \(label) \(a) vs \(b)")
        }
        // Decision 3: a docked month / year list stays inside the panel (the Web list overflows it, open D4), so what follows the
        // list (its height, the body, the actions, the panel's grown height) is recorded; the list's geometry is checked
        // relative to the selected entry, and the pixels above the list (field, nav, divider).
        let menuCase = keys.contains("month-menu") || keys.contains("year-menu")
        // Decision 9 (motion capture only): the Web centres the selected year from rects measured two frames into the
        // year-grid bloom (scale ~0.96), so hooked year sizes land ~4 % short; the reduced-motion capture (AWC_DP_PAINT_NAME containing "reduced") checks exact centring.
        // The motion capture is the default (1-3 reopen 2026-11-16: sweeps without AWC_DP_D9 failed 606 checks), AWC_DP_D9 stays accepted.
        let yearScroll = (env["AWC_DP_D9"] != nil || !(env["AWC_DP_PAINT_NAME"] ?? "").contains("reduced")) && name.hasPrefix("hook-year") && keys.contains("year-grid")
        func rect(_ n: AWCNativeInspectionNode?, _ r: AWCValue, _ label: String, tol: Double = tolerance, recordY: String? = nil, recordHeight: String? = nil, recordInline: String? = nil) {
            guard r != .null, (r["width"].number ?? 0) > 0 || (r["height"].number ?? 0) > 0 else { return }
            guard let n else { check(false, "\(name) \(label) missing"); return }
            let b = n.bounds
            near(b.minX, r["x"].number!, "\(label) x", tol, record: recordInline); near(b.minY, r["y"].number!, "\(label) y", tol, record: recordY)
            near(b.width, r["width"].number!, "\(label) width", tol, record: recordInline); near(b.height, r["height"].number!, "\(label) height", tol, record: recordHeight)
        }
        // Font availability (AUDIT exception, n4 2026-11-08): Chrome on macOS draws Hebrew with Lucida Grande, which iOS does not
        // ship (the shared fallback list uses Arial Hebrew there): the he-IL month toggle's width (and RTL x) are recorded on iOS.
        #if canImport(UIKit)
        let fontAvailability: String? = name == "cal-locale-he-IL" ? "font availability: no Lucida Grande on iOS" : nil
        #else
        let fontAvailability: String? = nil
        #endif
        let d3 = menuCase ? "decision 3" : nil, d9 = yearScroll ? "decision 9" : nil
        if !modal, let root = m("md-date-picker") {
            near(root.bounds.minX, h["x"].number!, "host x"); near(root.bounds.minY, h["y"].number!, "host y")
            near(root.bounds.width, h["width"].number!, "host width"); near(root.bounds.height, h["height"].number!, "host height")
        }
        let direct: Set<String> = ["modal", "scrim", "panel", "header", "supporting", "headline", "mode-toggle", "body", "nav", "month-toggle", "prev-button", "next-button",
                                   "calendar", "weekdays", "grid", "actions", "cancel-button", "ok-button", "year-grid", "year-grid-scroll", "year-grid-wrap", "entry", "entry-input",
                                   "month-menu-button", "year-menu-button", "prev-month-chevron-slot", "next-month-chevron-slot", "prev-year-chevron-slot", "next-year-chevron-slot"]
        var weekday = 0, optionIndex: [String: Int] = [:]
        for e in c["elements"].array {
            let key = e["key"].string
            switch key {
            case "body", "panel": rect(m(key), e["rect"], key, recordHeight: d3)
            case "actions", "cancel-button", "ok-button": rect(m(key), e["rect"], key, recordY: d3)
            case "year-grid": rect(m(key), e["rect"], key, recordY: d9)
            case "month-toggle": rect(m(key), e["rect"], key, recordInline: fontAvailability)
            case _ where direct.contains(key): rect(m(key), e["rect"], key)
            case "month-menu", "year-menu": rect(m(key), e["rect"], key, recordHeight: d3)
            case "month-option", "year-option":
                // Entry i is month i + 1 / year min + i; geometry relative to the selected entry on both sides.
                let options = c["elements"].array.filter { $0["key"].string == key }
                let i = optionIndex[key, default: 0]; optionIndex[key] = i + 1
                guard let selW = options.first(where: { $0["part"].string.contains("-option-selected") }) else { continue }
                let year = key == "year-option"
                let viewYear = AWCDay.iso(props["value"]?.string ?? "")?.year ?? 2025
                let first = year ? (AWCDay.iso(props["min"]?.string ?? "")?.year ?? viewYear - 100) : 1
                let n = ms.first { $0.name == key && $0.id.hasSuffix("\(key)-\(first + i)") }, sel = ms.first { $0.name == key && $0.metrics["selected"]?.bool == true }
                guard let n, let sel else { check(false, "\(name) \(key) \(first + i) missing"); continue }
                let r = e["rect"]
                near(n.bounds.minX, r["x"].number!, "\(key) \(first + i) x"); near(n.bounds.width, r["width"].number!, "\(key) \(first + i) width")
                near(n.bounds.height, r["height"].number!, "\(key) \(first + i) height")
                near(n.bounds.minY - sel.bounds.minY, r["y"].number! - selW["rect"]["y"].number!, "\(key) \(first + i) y from selected")
                check(((n.metrics["selected"]?.bool) ?? false) == e["part"].string.contains("-option-selected"), "\(name) \(key) \(first + i) selected")
            case "field": rect(m("md-text-field"), e["rect"], key)
            // The field's trailing slot holds the calendar button (and the clear button before it).
            case "calendar-button": rect(m("trailing-icon").map { t in AWCNativeInspectionNode(id: t.id, name: t.name, parentId: t.parentId,
                                            bounds: CGRect(x: state.rtl ? t.bounds.minX : t.bounds.maxX - t.bounds.height, y: t.bounds.minY, width: t.bounds.height, height: t.bounds.height), metrics: t.metrics) }, e["rect"], key)
            case "md-text-field#0/container": rect(m("container"), e["rect"], "field container")
            case "md-text-field#0/label": rect(m("label"), e["rect"], "field label", tol: 1)
            case "md-text-field#0/supporting-text": rect(m("supporting-text"), e["rect"], "field supporting", tol: 1)
            case "weekday":
                rect(ms.first { $0.name == "weekday" && $0.id.hasSuffix("weekday-\(weekday)") } ?? ms.filter { $0.name == "weekday" }.dropFirst(weekday).first, e["rect"], "weekday \(weekday)"); weekday += 1
            case "day":
                let iso = e["attrs"]["data-date"].string
                let n = ms.first { $0.name == "day" && $0.metrics["date"]?.string == iso }
                rect(n, e["rect"], "day \(iso)")
                if let n {
                    let parts = e["part"].string.split(separator: " ").map(String.init)
                    check((n.metrics["selected"]?.bool ?? false) == parts.contains("day-selected"), "\(name) day \(iso) selected")
                    check((n.metrics["today"]?.bool ?? false) == parts.contains("day-today"), "\(name) day \(iso) today")
                    check((n.metrics["disabled"]?.bool ?? false) == parts.contains("day-disabled"), "\(name) day \(iso) disabled")
                }
            case "year":
                let y = Double(e["text"].string) ?? -1
                rect(ms.first { $0.name == "year" && $0.metrics["year"]?.number == y }, e["rect"], "year \(e["text"].string)", recordY: d9)
            default: continue
            }
        }
        // Pixels.
        let clip = c["clip"], cxp = Int(clip["x"].number!), cyp = Int(clip["y"].number!), cw = Int(clip["width"].number!)
        let divider = c["elements"].array.first { $0["key"].string == "selection-divider" }?["rect"]
        let ch = menuCase && divider != nil ? Int((divider!["y"].number! + divider!["height"].number!).rounded(.up)) + 1 - cyp : Int(clip["height"].number!)
        guard let src = NSImage(contentsOf: shots.appendingPathComponent(name + ".png"))?.cgImage(forProposedRect: nil, context: nil, hints: nil) else { check(false, "\(name) source shot"); return }
        let web = grid(.init(cg: src, scale: 1, origin: .init(x: cxp, y: cyp)), x: cxp, y: cyp, w: cw, h: ch)
        let shot = capture(CGRect(x: cxp, y: cyp, width: cw, height: ch)), nat = grid(shot, x: cxp, y: cyp, w: cw, h: ch)
        var n = 0, bad = 0, sum = 0.0, worst = 0.0, worstAt = "", worstPixel = (0, 0)
        let wf = web.flatMask(6), nf = nat.flatMask(6)
        web.values.withUnsafeBufferPointer { wv in nat.values.withUnsafeBufferPointer { nv in
            for py in (cyp + 1)..<(cyp + ch - 1) { for pxx in (cxp + 1)..<(cxp + cw - 1) {
                let j = (py - cyp) * cw + (pxx - cxp); guard wf[j] && nf[j] else { continue }
                let i = j * 3, d = max(abs(wv[i] - nv[i]), abs(wv[i + 1] - nv[i + 1]), abs(wv[i + 2] - nv[i + 2]))
                n += 1; sum += d; if d > 6 { bad += 1 }
                if d > worst { worst = d; worstPixel = (pxx, py) } } }
        } }
        if worst > 0 { worstAt = "(\(worstPixel.0),\(worstPixel.1)) web \(web.at(worstPixel.0, worstPixel.1).map { Int($0) }) native \(nat.at(worstPixel.0, worstPixel.1).map { Int($0.rounded()) })" }
        check(Double(n) / Double(max(1, (cw - 2) * (ch - 2))) > 0.5, "\(name) flat coverage \(n)")
        let pixelsOK = Double(bad) / Double(max(n, 1)) <= 0.005 && sum / Double(max(n, 1)) <= 1.0
        let pixelLabel = "\(name) flat pixels match (mean \(sum / Double(max(n, 1))), >6: \(bad)/\(n), worst \(worst) at \(worstAt))"
        // Decision 9: the year list's scroll differs from the motion capture's mid-bloom one, so do its pixels.
        if !pixelsOK, let d9 { recorded.append(pixelLabel + " [\(d9)]") } else { check(pixelsOK, pixelLabel) }
        if let dir = env["AWC_DP_CAPTURE_DIRECTORY"] {
            try? FileManager.default.createDirectory(atPath: dir, withIntermediateDirectories: true)
            try? NSBitmapImageRep(cgImage: shot.cg).representation(using: .png, properties: [:])?.write(to: URL(fileURLWithPath: dir).appendingPathComponent(name + ".png"))
        }
        report.append(["case": name, "compared": n, "mean": sum / Double(max(n, 1)), "over6": bad, "worst": worst, "worstAt": worstAt])
        runtime?.hide(); pump(0.05); _ = window.makeFirstResponder(nil); pump(0.05)
    }
    /// Light-DOM slot content the cases author (header / actions / leading-icon / calendar-icon).
    static func slots(_ html: String) -> [AWCNode] {
        var out: [AWCNode] = []
        let pattern = try! NSRegularExpression(pattern: #"<(\w[\w-]*)([^>]*)\bslot="([\w-]+)"([^>]*)>(.*?)</\1>"#, options: [.dotMatchesLineSeparators])
        let ns = html as NSString
        for (i, r) in pattern.matches(in: html, range: NSRange(location: 0, length: ns.length)).enumerated() {
            let tag = ns.substring(with: r.range(at: 1)), slot = ns.substring(with: r.range(at: 3)), inner = ns.substring(with: r.range(at: 5))
            let attrs = ns.substring(with: r.range(at: 2)) + ns.substring(with: r.range(at: 4))
            let text = inner.replacingOccurrences(of: "<[^>]+>", with: "", options: .regularExpression).trimmingCharacters(in: .whitespaces)
            if attrs.contains("material-symbols") || tag == "md-icon" { out.append(AWCNode(id: "dp-slot-\(i)", tag: "#symbol", properties: ["name": .string(text)], slot: slot)); continue }
            var props: [String: AWCValue] = [:]
            for m in try! NSRegularExpression(pattern: #"([\w-]+)="([^"]*)""#).matches(in: attrs, range: NSRange(location: 0, length: (attrs as NSString).length)) {
                let k = (attrs as NSString).substring(with: m.range(at: 1)), v = (attrs as NSString).substring(with: m.range(at: 2))
                if k != "slot" && k != "class" { props[k == "variant" ? "variant" : k] = .string(v) }
            }
            out.append(AWCNode(id: "dp-slot-\(i)", tag: tag.hasPrefix("md-") ? tag : "#text", properties: tag.hasPrefix("md-") ? props : ["text": .string(text)],
                               children: tag.hasPrefix("md-") ? [.text(text)] : [], slot: slot))
        }
        return out
    }
    static func main() {
        _ = NSApplication.shared; NSApp.setActivationPolicy(.accessory)
        host = NSHostingView(rootView: DatePickerPaintFixture(state: state)); window = NSWindow(contentRect: .init(x: -20000, y: -20000, width: 1200, height: 900), styleMask: [.borderless], backing: .buffered, defer: false)
        window.isReleasedWhenClosed = false; window.colorSpace = .sRGB; window.contentView = host; window.orderFrontRegardless(); window.makeKey(); pump(0.2)
        let fixtures = env["AWC_DP_FIXTURES"].map { URL(fileURLWithPath: $0) } ?? URL(fileURLWithPath: #filePath).deletingLastPathComponent().appendingPathComponent("Fixtures")
        let paintName = env["AWC_DP_PAINT_NAME"] ?? "datepicker-web-paint"
        let oracle = try! JSONDecoder().decode(AWCValue.self, from: Data(contentsOf: fixtures.appendingPathComponent(paintName + ".json")))
        let only = env["AWC_DP_ONLY"]
        for c in oracle["cases"].array where only.map({ f in f.split(separator: ",").contains { c["name"].string.contains($0) } }) ?? true { run(c, shots: fixtures.appendingPathComponent(paintName)) }
        if let output = env["AWC_DP_PAINT_OUTPUT"] { try! JSONSerialization.data(withJSONObject: ["checks": checks, "failures": failures, "recorded": recorded, "report": report], options: [.prettyPrinted, .sortedKeys]).write(to: URL(fileURLWithPath: output)) }
        let fullyPassing = Set(report.compactMap { $0["case"] as? String }).filter { n in !failures.contains { $0.hasPrefix(n + " ") } }.count
        for r in recorded { print("RECORDED: " + r) }
        print("Date picker native paint: \(checks - failures.count)/\(checks) checks passed, \(fullyPassing) cases fully passing, \(recorded.count) recorded differences")
        window.close(); if !failures.isEmpty { exit(1) }
    }
}
