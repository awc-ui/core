import AppKit
import SwiftUI
import Observation
import AWCUI

@Observable private final class DividerFixtureState {
    var properties: [String: AWCValue] = [:]
    var appearance = AWCDividerAppearance()
    var height: CGFloat = 96
    var rtl = false
    var nodes: [AWCNativeInspectionNode] = []
    var epoch = 0
}
private struct DividerFixture: View {
    let state: DividerFixtureState
    var body: some View {
        let epoch = state.epoch
        let identity = "divider-\(epoch)"
        return AWCNativeView(node: .init(id: identity, tag: "md-divider", properties: state.properties))
            .awcDividerAppearance(state.appearance)
            .awcNativeInspection(rootID: identity, coordinateSpace: "divider-fixture") {
                if state.epoch == epoch { state.nodes = $0 }
            }
            .id(state.epoch)
            .frame(width: 240, height: state.height, alignment: .topLeading)
            .padding(32).frame(width: 320, height: 220, alignment: .topLeading)
            .background(Color.white).awcTheme(.generated()).environment(\.colorScheme, .light)
            .environment(\.layoutDirection, state.rtl ? .rightToLeft : .leftToRight)
            .transaction { $0.disablesAnimations = true }
            .coordinateSpace(name: "divider-fixture")
    }
}
@main @MainActor enum NativeDividerViewIntegration {
    static var checks = 0
    static func check(_ valid: Bool, _ message: String) { checks += 1; precondition(valid, message) }
    static func pump() {
        let end = Date().addingTimeInterval(0.08)
        while Date() < end { _ = RunLoop.current.run(mode: .default, before: Date().addingTimeInterval(0.003)) }
    }
    static func main() throws {
        _ = NSApplication.shared; NSApp.setActivationPolicy(.accessory)
        let input = try Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[1]))
        let oracle = try JSONSerialization.jsonObject(with: input) as! [String: Any]
        let fixtures = oracle["results"] as! [[String: Any]]
        let state = DividerFixtureState()
        let host = NSHostingView(rootView: DividerFixture(state: state))
        let window = NSWindow(contentRect: .init(x: -20000, y: -20000, width: 320, height: 220),
                              styleMask: .borderless, backing: .buffered, defer: false)
        window.isReleasedWhenClosed = false; window.colorSpace = .sRGB; window.contentView = host; window.orderFrontRegardless()
        defer { window.close() }
        for fixture in fixtures {
            let source = fixture["fixture"] as! [String: Any]
            let id = source["id"] as! String
            let props = source.filter { ["vertical", "inset", "insetStart", "insetEnd", "hidden"].contains($0.key) }
            state.properties = try JSONDecoder().decode([String: AWCValue].self, from: JSONSerialization.data(withJSONObject: props))
            state.appearance = AWCDividerAppearance(values: try JSONDecoder().decode([String: AWCValue].self,
                from: JSONSerialization.data(withJSONObject: source["style"] as? [String: Any] ?? [:])))
            state.rtl = source["dir"] as? String == "rtl"; state.height = CGFloat(source["height"] as? Double ?? 96)
            state.epoch += 1; state.nodes = []
            host.layoutSubtreeIfNeeded(); pump()
            if source["hidden"] as? Bool == true {
                check(state.nodes.isEmpty, "\(id): hidden removes the rendered separator and inspection tree")
                continue
            }
            guard let root = state.nodes.first(where: { $0.id == "component" }),
                  let line = state.nodes.first(where: { $0.id == "component.divider" }) else {
                fatalError("\(id): missing measured native root/part: \(state.nodes)")
            }
            let webHost = fixture["host"] as! [String: Any], webLine = fixture["line"] as! [String: Any]
            func expect(_ actual: CGFloat, _ expected: Any?, _ metric: String) {
                let expected = CGFloat((expected as! NSNumber).doubleValue)
                check(abs(actual - expected) < 0.6, "\(id) \(metric): native \(actual), Web \(expected). Nodes: \(state.nodes)")
            }
            expect(root.bounds.width, webHost["width"], "host width")
            expect(root.bounds.height, webHost["height"], "host height")
            expect(line.bounds.minX - root.bounds.minX, webLine["x"], "line x")
            expect(line.bounds.minY - root.bounds.minY, webLine["y"], "line y")
            expect(line.bounds.width, webLine["width"], "line width")
            expect(line.bounds.height, webLine["height"], "line height")
            if state.appearance.color == "#123456" {
                host.layoutSubtreeIfNeeded(); host.displayIfNeeded()
                let bitmap = host.bitmapImageRepForCachingDisplay(in: host.bounds)!
                host.cacheDisplay(in: host.bounds, to: bitmap)
                let image = bitmap.cgImage!
                var bytes = [UInt8](repeating: 0, count: image.width * image.height * 4)
                bytes.withUnsafeMutableBytes { data in
                    let context = CGContext(data: data.baseAddress, width: image.width, height: image.height,
                        bitsPerComponent: 8, bytesPerRow: image.width * 4,
                        space: CGColorSpace(name: CGColorSpace.sRGB)!,
                        bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
                    context.draw(image, in: CGRect(x: 0, y: 0, width: image.width, height: image.height))
                }
                let matches = stride(from: 0, to: bytes.count, by: 4).filter {
                    abs(Int(bytes[$0]) - 18) <= 3 &&
                    abs(Int(bytes[$0 + 1]) - 52) <= 3 &&
                    abs(Int(bytes[$0 + 2]) - 86) <= 3
                }.count
                if matches <= 20 {
                    try bitmap.representation(using: .png, properties: [:])?.write(to: URL(fileURLWithPath: "/tmp/awc-divider-pixel-failure.png"))
                }
                check(matches > 20, "\(id): actual line pixels use the authored color (\(matches) matching pixels); failure image /tmp/awc-divider-pixel-failure.png")
            }
        }
        let inherited = AWCDividerAppearance(color: "#abcdef", thickness: 3, insetStart: 12, insetEnd: 28)
        check(inherited.merging(.init(thickness: 0, insetStart: -12)) ==
              .init(color: "#ABCDEF", thickness: 0, insetStart: -12, insetEnd: 28), "Appearance inheritance preserves signed insets and explicit zero")
        for invalid: AWCValue in [.number(.nan), .number(.infinity), true, "3"] {
            for key in ["thickness", "insetStart", "insetEnd"] {
                check(AWCDividerAppearance(values: [key: invalid]) == .init(), "\(key): invalid value rejected")
            }
        }
        check(AWCDividerAppearance(thickness: -1).thickness == nil, "Negative thickness rejected")
        print("Passed \(checks) SwiftUI Divider checks against \(fixtures.count) hydrated Web fixtures, including native color pixels.")
    }
}
