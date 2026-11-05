import AppKit
import SwiftUI
import CoreText
@testable import AWCUI

// Harness self-test (iOS only): validates each capture mode against known sRGB swatches placed inside
// and outside the visible screen, confirms the bundled Roboto/Material Symbols fonts register, and
// that the 2x/3x capture normalises to CSS pixels.
struct ProbeSwatch: Identifiable { let id: Int; let x: Double, y: Double; let rgb: [Double] }
let probeSwatches: [ProbeSwatch] = [
    .init(id: 0, x: 20, y: 20, rgb: [255, 0, 0]), .init(id: 1, x: 360, y: 300, rgb: [0, 255, 0]),
    .init(id: 2, x: 520, y: 40, rgb: [0, 0, 255]), .init(id: 3, x: 40, y: 860, rgb: [51, 102, 153]),
    .init(id: 4, x: 1140, y: 850, rgb: [103, 80, 164]), .init(id: 5, x: 700, y: 500, rgb: [255, 251, 254])]
struct ProbeView: View {
    var body: some View {
        ZStack(alignment: .topLeading) {
            Color(red: 0.5, green: 0.5, blue: 0.5)
            ForEach(probeSwatches) { s in Rectangle().fill(Color(.sRGB, red: s.rgb[0] / 255, green: s.rgb[1] / 255, blue: s.rgb[2] / 255)).frame(width: 30, height: 30).offset(x: s.x, y: s.y) }
            AWCNativeView(node: .init(id: "switch", tag: "md-switch", properties: ["selected": true])).offset(x: 100, y: 100)
            Text("Hamburgefonstiv").font(AWCNativeFonts.label(size: 20)).foregroundStyle(.black).offset(x: 100, y: 160).fixedSize()
        }.frame(width: 1200, height: 900, alignment: .topLeading)
    }
}
@main @MainActor enum NativeIOSCaptureProbe {
    static var host: NSHostingView<ProbeView>!, window: NSWindow!
    static func pump(_ d: Double) { let end = Date().addingTimeInterval(d); repeat { host.layoutSubtreeIfNeeded(); host.displayIfNeeded(); _ = RunLoop.current.run(mode: .default, before: Date().addingTimeInterval(0.002)) } while Date() < end }
    static func main() {
        _ = NSApplication.shared; NSApp.setActivationPolicy(.accessory)
        host = NSHostingView(rootView: ProbeView())
        window = NSWindow(contentRect: .init(x: -20000, y: -20000, width: 1200, height: 900), styleMask: [.borderless], backing: .buffered, defer: false)
        window.contentView = host; window.orderFrontRegardless(); pump(0.6)
        let out = ProcessInfo.processInfo.environment["AWC_PROBE_OUTPUT"] ?? NSTemporaryDirectory()
        try? FileManager.default.createDirectory(atPath: out, withIntermediateDirectories: true)
        let roboto = UIFont(name: "Roboto-Medium", size: 14) != nil
        var symbols = false
        if let names = CTFontManagerCopyAvailablePostScriptNames() as? [String] { symbols = names.contains { $0.lowercased().contains("materialsymbols") } }
        print("PROBE fonts roboto=\(roboto) materialSymbols=\(symbols) hostBounds=\(host.bounds) window=\(window.frame) screen=\(window.screen.bounds) scale=\(window.screen.scale)")
        var images: [String: [UInt8]] = [:]
        defer {
            for (a, b) in [("hierarchy", "tile"), ("layer", "tile")] {
                guard let x = images[a], let y = images[b], x.count == y.count else { print("PROBE compare \(a)/\(b) size mismatch"); continue }
                var worst = 0, over2 = 0
                for i in 0..<x.count where i % 4 != 3 { let d = abs(Int(x[i]) - Int(y[i])); worst = max(worst, d); if d > 2 { over2 += 1 } }
                print("PROBE compare \(a) vs \(b): worst channel diff \(worst), channels >2: \(over2) of \(x.count / 4 * 3)")
            }
        }
        for mode in ["hierarchy", "layer", "tile"] {
            AWCShim.captureMode = mode
            let t0 = Date(), rect = CGRect(x: 0, y: 0, width: 1200, height: 900)
            let rep = host.bitmapImageRepForCachingDisplay(in: rect)!; host.cacheDisplay(in: rect, to: rep)
            let secs = Date().timeIntervalSince(t0)
            guard let cg = rep.cgImage, let p = rep.bitmapData else { print("PROBE \(mode) no image"); continue }
            images[mode] = Array(UnsafeBufferPointer(start: p, count: cg.width * cg.height * 4))
            let k = Double(cg.width) / rect.width
            var ok = 0, report: [String] = []
            for s in probeSwatches {
                let cx = Int((s.x + 15) * k), cy = Int((s.y + 15) * k), i = (cy * cg.width + cx) * 4
                let got = [Double(p[i]), Double(p[i + 1]), Double(p[i + 2])]
                let good = zip(got, s.rgb).allSatisfy { abs($0 - $1) <= 2 }
                if good { ok += 1 }; report.append("\(s.id)@\(Int(s.x)),\(Int(s.y)):\(got.map { Int($0) })\(good ? "" : "!=\(s.rgb.map { Int($0) })")")
            }
            print("PROBE mode=\(mode) image=\(cg.width)x\(cg.height) k=\(k) swatches=\(ok)/\(probeSwatches.count) seconds=\(String(format: "%.2f", secs)) \(report.joined(separator: " "))")
            try? rep.representation(using: .png, properties: [:])?.write(to: URL(fileURLWithPath: out).appendingPathComponent("probe-\(mode).png"))
        }
        let m = AWCNativeInspectionProbe.ok
        print("Probe: done \(m)")
        window.close()
    }
}
enum AWCNativeInspectionProbe { static let ok = "inspection-not-used" }
