import AppKit
import SwiftUI
import Observation
@testable import AWCUI

@Observable private final class StatusDotFixtureState {
    var properties: [String: AWCValue] = [:]
    var appearance = AWCStatusDotAppearance()
    var parentSize = CGSize(width: 48, height: 48)
    var tokens: [String: String] = [:]
    var dark = false
    var rtl = false
    var density = 0.0
    var scale = 2.0
    var nodes: [AWCNativeInspectionNode] = []
    var epoch = 0
}
private struct StatusDotFixture: View {
    let state: StatusDotFixtureState
    var body: some View {
        let epoch = state.epoch
        let dot = AWCNativeView(node: .init(id: "status", tag: "md-status-dot", properties: state.properties))
            .awcStatusDotAppearance(state.appearance)
            .awcNativeInspection(rootID: "status", coordinateSpace: "status-fixture") {
                if state.epoch == epoch { state.nodes = $0 }
            }
        return Group {
            if state.properties["inline"]?.bool == true {
                dot.frame(width: state.parentSize.width, height: state.parentSize.height)
            } else {
                Color.clear.frame(width: state.parentSize.width, height: state.parentSize.height)
                    .awcStatusDotOverlay { dot }
            }
        }
        .id(epoch)
        .frame(width: 240, height: 180).background(Color.white)
        .awcTheme(.generated(dark: state.dark, tokens: state.tokens))
        .environment(\.awcThemeTokens, state.tokens)
        .environment(\.colorScheme, state.dark ? .dark : .light)
        .environment(\.layoutDirection, state.rtl ? .rightToLeft : .leftToRight)
        .environment(\.awcNativeDensity, state.density)
        .environment(\.displayScale, state.scale)
        .transaction { $0.disablesAnimations = true }
        .coordinateSpace(name: "status-fixture")
    }
}
@main @MainActor enum NativeStatusDotViewIntegration {
    static var checks = 0
    static var failures: [String] = []
    static func check(_ valid: Bool, _ message: String) {
        checks += 1
        if !valid { failures.append(message); print("FAIL: \(message)"); fflush(stdout) }
    }
    static func pump(_ seconds: Double = 0.07) {
        let until = Date().addingTimeInterval(seconds)
        while Date() < until { _ = RunLoop.current.run(mode: .default, before: Date().addingTimeInterval(0.003)) }
    }
    static func pixels(_ bitmap: NSBitmapImageRep) -> [UInt8] {
        let image = bitmap.cgImage!
        var bytes = [UInt8](repeating: 0, count: image.width * image.height * 4)
        bytes.withUnsafeMutableBytes { data in
            let context = CGContext(data: data.baseAddress, width: image.width, height: image.height,
                bitsPerComponent: 8, bytesPerRow: image.width * 4,
                space: CGColorSpace(name: CGColorSpace.sRGB)!,
                bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
            context.draw(image, in: CGRect(x: 0, y: 0, width: image.width, height: image.height))
        }
        return bytes
    }
    static func colorHits(_ bytes: [UInt8], expected: [Double], tolerance: Double = 3) -> Int {
        stride(from: 0, to: bytes.count, by: 4).filter { offset in
            (0..<3).allSatisfy { abs(Double(bytes[offset + $0]) - expected[$0]) <= tolerance }
        }.count
    }
    static func main() throws {
        try NativeStatusDotCases.run(check)
        let contractChecks = checks
        _ = NSApplication.shared; NSApp.setActivationPolicy(.accessory)
        let state = StatusDotFixtureState()
        let host = NSHostingView(rootView: StatusDotFixture(state: state))
        let window = NSWindow(contentRect: .init(x: -20000, y: -20000, width: 240, height: 180),
            styleMask: .borderless, backing: .buffered, defer: false)
        window.isReleasedWhenClosed = false; window.contentView = host; window.colorSpace = .sRGB
        window.orderFrontRegardless(); defer { window.close() }
        var measured: [[String: Any]] = []
        // R2-D1/R2-D5: the recorded matrices inject their captured tokens; the default-palette pass injects none.
        for (document, defaultPalette) in try NativeStatusDotFixture.documents().map({ ($0, false) }) + NativeStatusDotFixture.defaultDocuments().map({ ($0, true) }) {
            state.tokens = defaultPalette ? [:] : NativeStatusDotFixture.tokens(document)
            state.dark = document["theme"] as? String == "dark"
            state.scale = (document["browser"] as? [String: Any])?["devicePixelRatio"] as? Double ?? 2
            for fixture in document["results"] as! [[String: Any]] {
                let source = fixture["fixture"] as! [String: Any], web = fixture["host"] as! [String: Any]
                let id = "\(defaultPalette ? "default-" : "")\(document["theme"]!)/\(source["id"]!)"
                state.properties = try NativeStatusDotFixture.values(source)
                state.appearance = NativeStatusDotFixture.appearance(source)
                state.parentSize = .init(width: source["parentWidth"] as? Double ?? 48, height: source["parentHeight"] as? Double ?? 48)
                state.rtl = source["dir"] as? String == "rtl"
                state.density = source["inheritedDensity"] as? Double ?? 0
                state.epoch += 1; state.nodes = []
                host.layoutSubtreeIfNeeded(); pump()
                if source["hidden"] as? Bool == true {
                    check(state.nodes.isEmpty, "\(id) hidden removes geometry")
                    continue
                }
                guard let root = state.nodes.first(where: { $0.id == "component" }) else {
                    check(false, "\(id) missing actual native layout"); continue
                }
                let parentX = (240 - state.parentSize.width) / 2, parentY = (180 - state.parentSize.height) / 2
                for (name, value) in [("width", root.bounds.width), ("height", root.bounds.height),
                                     ("x", root.bounds.minX - parentX), ("y", root.bounds.minY - parentY)] {
                    check(abs(value - (web[name] as! Double)) < 0.03, "\(id) actual \(name): \(value), Web \(web[name]!)")
                }
                check(root.metrics["outlineWidth"]?.number == NativeStatusDotFixture.numbers(web["outlineWidth"] as! String)[0],
                    "\(id) inspector reports applied outline")
                measured.append(["id": id, "width": root.bounds.width, "height": root.bounds.height,
                    "x": root.bounds.minX - parentX, "y": root.bounds.minY - parentY])
                if ["online-medium", "invisible-large", "custom-fill", "custom-outline-width", "custom-alpha-fill"].contains(source["id"] as! String) {
                    host.displayIfNeeded()
                    let bitmap = host.bitmapImageRepForCachingDisplay(in: host.bounds)!
                    host.cacheDisplay(in: host.bounds, to: bitmap)
                    let bytes = pixels(bitmap)
                    let webColor = NativeStatusDotFixture.numbers(web["fill"] as! String)
                    let alpha = webColor.count == 4 ? webColor[3] : 1
                    let composited = webColor.prefix(3).map { $0 * alpha + 255 * (1 - alpha) }
                    check(colorHits(bytes, expected: composited) > 8, "\(id) actual source fill pixels, including alpha")
                    if source["state"] as? String == "invisible" {
                        let outline = NativeStatusDotFixture.rgba(NativeStatusDotFixture.tokens(document)["--md-sys-color-outline"]!)
                        check(colorHits(bytes, expected: outline) > 8, "\(id) actual inset ring pixels")
                    }
                    if CommandLine.arguments.count > 1 {
                        let output = URL(fileURLWithPath: CommandLine.arguments[1]).deletingLastPathComponent()
                            .appendingPathComponent("swift-\(state.dark ? "dark" : "light")-\(source["id"]!).png")
                        try bitmap.representation(using: .png, properties: [:])!.write(to: output)
                    }
                }
            }
        }
        state.tokens = NativeStatusDotFixture.tokens(try NativeStatusDotFixture.documents()[1]); state.dark = true
        // Outer CSS shadows must not tint a translucent dot's interior. Verify
        // the native raster while the pulse is active, then set zero duration on
        // the same mounted view and require the halo to disappear.
        state.properties = ["state": "online", "inline": true, "live": true]
        state.parentSize = .init(width: 160, height: 160)
        state.appearance = .init(size: 80, color: "#FF000080", pulseColor: "#00FF00",
                                 outlineWidth: 0, pulseDuration: 2)
        state.epoch += 1
        host.layoutSubtreeIfNeeded(); pump(0.4); host.displayIfNeeded()
        var bitmap = host.bitmapImageRepForCachingDisplay(in: host.bounds)!
        host.cacheDisplay(in: host.bounds, to: bitmap)
        var raster = pixels(bitmap)
        check(colorHits(raster, expected: [255, 127, 127]) > 500,
              "Active pulse preserves the alpha fill's source color")
        func greenPixels(_ bytes: [UInt8]) -> Int {
            stride(from: 0, to: bytes.count, by: 4).filter {
                bytes[$0 + 1] > 240 && bytes[$0] < 245 && bytes[$0 + 2] < 245
            }.count
        }
        check(greenPixels(raster) > 8, "Active pulse paints an exterior halo")
        state.appearance = .init(size: 80, color: "#FF000080", pulseColor: "#00FF00",
                                 outlineWidth: 0, pulseDuration: 0)
        host.layoutSubtreeIfNeeded(); pump(); host.displayIfNeeded()
        bitmap = host.bitmapImageRepForCachingDisplay(in: host.bounds)!
        host.cacheDisplay(in: host.bounds, to: bitmap); raster = pixels(bitmap)
        check(greenPixels(raster) == 0, "Zero duration removes the active pulse from the same view")
        check(colorHits(raster, expected: [255, 127, 127]) > 500, "Zero duration retains static alpha fill")
        state.properties = ["state": "invisible", "inline": true, "live": true]
        state.appearance = .init(size: 80, outlineWidth: 0, pulseDuration: 0)
        host.layoutSubtreeIfNeeded(); pump(); host.displayIfNeeded()
        bitmap = host.bitmapImageRepForCachingDisplay(in: host.bounds)!
        host.cacheDisplay(in: host.bounds, to: bitmap); raster = pixels(bitmap)
        check(colorHits(raster, expected: NativeStatusDotFixture.rgba(state.tokens["--md-sys-color-outline"]!)) > 20,
              "Zero duration retains invisible's inset ring")
        if CommandLine.arguments.count > 1 {
            try JSONSerialization.data(withJSONObject: ["contractChecks": contractChecks,
                "renderChecks": checks - contractChecks, "measurements": measured, "failures": failures],
                options: [.prettyPrinted, .sortedKeys])
                .write(to: URL(fileURLWithPath: CommandLine.arguments[1]))
        }
        precondition(failures.isEmpty, "\(failures.count) Status Dot checks failed; inspect retained log.")
        print("Passed \(contractChecks) Status Dot contract checks and \(checks - contractChecks) actual SwiftUI layout checks.")
    }
}
