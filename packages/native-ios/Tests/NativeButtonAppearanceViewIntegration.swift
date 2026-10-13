import AppKit
import SwiftUI
import AWCUI

/// Real SwiftUI rendering checks; these exercise the public modifier and generated
/// wrapper instead of copying appearance calculations into a test-only renderer.
@main @MainActor enum NativeButtonAppearanceViewIntegration {
    static var checks = 0
    static func check(_ valid: Bool, _ message: String) { checks += 1; precondition(valid, message) }
    static func pump(_ duration: TimeInterval = 0.22) {
        let until = Date().addingTimeInterval(duration)
        while Date() < until { _ = RunLoop.current.run(mode: .default, before: Date().addingTimeInterval(0.005)) }
    }
    static func descendants(_ view: NSView) -> [NSView] { [view] + view.subviews.flatMap(descendants) }
    struct Pixels {
        let values: [UInt8]
        func count(_ r: Int, _ g: Int, _ b: Int, tolerance: Int = 3) -> Int {
            stride(from: 0, to: values.count, by: 4).reduce(0) { sum, i in
                sum + ((abs(Int(values[i]) - r) <= tolerance && abs(Int(values[i + 1]) - g) <= tolerance && abs(Int(values[i + 2]) - b) <= tolerance) ? 1 : 0)
            }
        }
    }
    static func pixels(_ host: NSView) -> Pixels {
        host.layoutSubtreeIfNeeded(); host.displayIfNeeded()
        let bitmap = host.bitmapImageRepForCachingDisplay(in: host.bounds)!
        host.cacheDisplay(in: host.bounds, to: bitmap)
        let image = bitmap.cgImage!
        var bytes = [UInt8](repeating: 0, count: image.width * image.height * 4)
        bytes.withUnsafeMutableBytes { data in
            let context = CGContext(data: data.baseAddress, width: image.width, height: image.height, bitsPerComponent: 8,
                bytesPerRow: image.width * 4, space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
            context.draw(image, in: CGRect(x: 0, y: 0, width: image.width, height: image.height))
        }
        return .init(values: bytes)
    }
    static func fixture<Content: View>(_ content: Content, test: (NSHostingView<AnyView>, NSWindow) -> Void) {
        let host = NSHostingView(rootView: AnyView(content.padding(24)
            .frame(width: 500, height: 220, alignment: .topLeading).background(Color.white)
            .environment(\.colorScheme, .light).awcTheme(.generated())
            .coordinateSpace(name: "awc-native-preview")))
        let window = NSWindow(contentRect: .init(x: -20000, y: -20000, width: 500, height: 220), styleMask: [.borderless], backing: .buffered, defer: false)
        window.isReleasedWhenClosed = false; window.colorSpace = .sRGB; window.contentView = host
        window.orderFrontRegardless(); host.layoutSubtreeIfNeeded(); pump()
        test(host, window)
        window.close(); pump(0.02)
    }
    static func main() {
        _ = NSApplication.shared; NSApp.setActivationPolicy(.accessory)
        fixture(AWCButton(children: [.text("Continue")])
            .awcButtonAppearance(.init(containerColor: "#0000FF"))
            .awcButtonAppearance(.init(containerColor: "#FF0000", labelColor: "#00FF00", cornerRadius: 0))) { host, _ in
                let image = pixels(host)
                check(image.count(0, 0, 255) > 1000, "Local generated-button scope wins over inherited container")
                check(image.count(0, 255, 0) > 15, "Local scope preserves inherited label color")
                check(image.count(255, 0, 0) == 0, "Overridden inherited container does not leak")
            }
        fixture(AWCButton(properties: .init(disabled: true), children: [.text("Continue")])
            .awcButtonAppearance(.init(containerColor: "#000000", labelColor: "#FF0000", cornerRadius: 0))) { host, _ in
                let image = pixels(host)
                check(image.count(224, 224, 224) > 1000, "Disabled custom container keeps 0.12 alpha over white")
                check(image.count(236, 139, 139) > 10, "Disabled custom label keeps 0.38 alpha")
            }
        fixture(AWCButton(properties: .init(loading: true, icon: "add", trailingIcon: "close"), children: [.text("Wait")])
            .awcButtonAppearance(.init(containerColor: "#000000", labelColor: "#FFFFFF", iconColor: "#FF0000", trailingIconColor: "#00FF00", loadingColor: "#0000FF", iconSize: 32, trailingIconSize: 28, loadingSize: 24))) { host, _ in
                let image = pixels(host)
                check(image.count(255, 0, 0) > 15, "Leading glyph uses its own appearance color")
                check(image.count(0, 255, 0) > 15, "Trailing glyph uses its independent appearance color")
                check(image.count(0, 0, 255) > 30, "Native animated loader uses loading appearance color")
            }
        var events: [AWCEvent] = []
        let pointer = AWCNativePointerState()
        fixture(AWCButton(properties: .init(ripple: false), children: [.text("Continue")], onEvent: { events.append($0) })
            .awcButtonAppearance(.init(containerColor: "#000000", stateLayerColor: "#FF0000", fontSize: 24, lineHeight: 60, cornerRadius: 0, paddingBlock: 15, hoverOpacity: 1))
            .environment(\.awcNativePointerState, pointer)) { host, window in
                guard let button = descendants(host).first(where: { String(describing: type(of: $0)).contains("AWCNativeButtonFocusView") }) else { preconditionFailure("Missing native button surface") }
                check(button.bounds.height >= 90, "Line height and per-side block padding affect actual layout")
                let point = button.convert(CGPoint(x: button.bounds.midX, y: button.bounds.midY), to: host)
                pointer.update(phase: .move, location: CGPoint(x: point.x, y: host.isFlipped ? point.y : host.bounds.height - point.y)); pump()
                check(pixels(host).count(255, 0, 0) > 1000, "Custom hover color/opacity reaches real state layer")
                _ = button.accessibilityPerformPress(); pump()
                check(events.filter { $0.name == "mdClick" }.count == 1, "Appearance leaves native accessibility activation intact")
                _ = window.makeFirstResponder(nil)
            }
        for variant in [AWCButtonVariant.text, .outlined] {
            let hover = AWCNativePointerState()
            fixture(AWCButton(properties: .init(variant: variant, ripple: false), children: [.text("Continue")])
                .awcButtonAppearance(.init(containerColor: "#0000FF", labelColor: "#FF0000", cornerRadius: 0, hoverOpacity: 1))
                .environment(\.awcNativePointerState, hover)) { host, _ in
                    check(pixels(host).count(0, 0, 255) > 1000, "Custom container remains visible in \(variant.rawValue) variant")
                    let button = descendants(host).first(where: { String(describing: type(of: $0)).contains("AWCNativeButtonFocusView") })!
                    let point = button.convert(CGPoint(x: button.bounds.midX, y: button.bounds.midY), to: host)
                    hover.update(phase: .move, location: CGPoint(x: point.x, y: host.isFlipped ? point.y : host.bounds.height - point.y)); pump()
                    check(pixels(host).count(255, 0, 0) > 1000, "State layer inherits explicit label color when its own color is omitted")
                }
        }
        let children: [AWCNode] = [.text("Slots"), .init(id: "leading", tag: "#text", properties: ["text": "L"], slot: "leading-icon"), .init(id: "trailing", tag: "#text", properties: ["text": "T"], slot: "trailing-icon"), .init(id: "loader", tag: "#text", properties: ["text": "X"], slot: "loader")]
        fixture(AWCButton(properties: .init(loading: true), children: children)
            .awcButtonAppearance(.init(containerColor: "#000000", labelColor: "#FFFFFF", iconColor: "#FF0000", trailingIconColor: "#00FF00", loadingColor: "#0000FF", fontSize: 24))
            .environment(\.layoutDirection, .rightToLeft)) { host, _ in
                let image = pixels(host)
                check(image.count(255, 0, 0) > 10 && image.count(0, 255, 0) > 10 && image.count(0, 0, 255) > 10, "Named text slots preserve content, inherited part colors and RTL rendering")
            }
        print("Passed \(checks) real native button appearance rendering/interaction checks.")
    }
}
