import AppKit
import SwiftUI
import AWCUI

/// Exercises real SwiftUI layout and the opt-in public inspection scope.
@main @MainActor enum NativeInspectionViewIntegration {
    static var checks = 0
    static func check(_ value: Bool, _ message: String) { checks += 1; precondition(value, message) }
    final class Probe { var nodes: [AWCNativeInspectionNode] = [] }
    struct Result { let nodes: [String: AWCNativeInspectionNode]; let pixels: Data; let fitting: CGSize }
    static func fixture(_ node: AWCNode, appearance: AWCButtonAppearance = .init(),
                        rtl: Bool = false, inspect: Bool = true, rootID: String? = nil) -> Result {
        let probe = Probe()
        let button = AWCNativeView(node: node).awcButtonAppearance(appearance)
        let content = inspect
            ? AnyView(button.awcNativeInspection(rootID: rootID ?? node.id, coordinateSpace: "inspection-test") { probe.nodes = $0 })
            : AnyView(button)
        let host = NSHostingView(rootView: content.padding(24).frame(width: 640, height: 180)
            .background(Color.white).awcTheme(.generated()).environment(\.colorScheme, .light)
            .environment(\.layoutDirection, rtl ? .rightToLeft : .leftToRight)
            .coordinateSpace(name: "inspection-test"))
        let window = NSWindow(contentRect: .init(x: -20000, y: -20000, width: 640, height: 180),
                              styleMask: .borderless, backing: .buffered, defer: false)
        window.isReleasedWhenClosed = false; window.colorSpace = .sRGB; window.contentView = host
        window.orderFrontRegardless()
        let end = Date().addingTimeInterval(0.12)
        while Date() < end { _ = RunLoop.current.run(mode: .default, before: Date().addingTimeInterval(0.005)) }
        host.layoutSubtreeIfNeeded()
        let bitmap = host.bitmapImageRepForCachingDisplay(in: host.bounds)!
        host.cacheDisplay(in: host.bounds, to: bitmap)
        let result = Result(nodes: Dictionary(probe.nodes.map { ($0.id, $0) }, uniquingKeysWith: { _, last in last }),
                            pixels: bitmap.representation(using: .png, properties: [:])!, fitting: host.fittingSize)
        window.close()
        return result
    }
    static func main() {
        _ = NSApplication.shared; NSApp.setActivationPolicy(.accessory)
        let plain = AWCNode(id: "test-button", tag: "md-button",
                            properties: ["size": "md", "ripple": false], children: [.text("Continue")])
        let original = fixture(plain, inspect: false), inspected = fixture(plain)
        check(original.fitting == inspected.fitting, "Opt-in inspection preserves layout size")
        check(original.pixels == inspected.pixels, "Opt-in inspection does not change any rendered pixels")
        check(fixture(plain, rootID: "another-node").nodes.isEmpty, "Only the explicitly selected native node is instrumented")
        let root = inspected.nodes["component"]!, content = inspected.nodes["component.content"]!, label = inspected.nodes["component.label"]!
        check(root.bounds.height == 56, "Root excludes the host's padding and minimum frame")
        check(content.parentId == root.id && label.parentId == content.id, "Measured hierarchy supports deepest-part hover")
        check(root.metrics["padding"] == [0, 24, 0, 24], "Native padding reports actual modifiers, not minimum-height centering")
        check(root.metrics["typography"] == label.metrics["typography"], "Root font uses the label measured in the same layout pass")
        check(label.metrics["typography"]?["lineHeight"].number == Double(label.bounds.height), "Font line height is the real label line box")

        let appearance = AWCButtonAppearance(iconSize: 30, trailingIconSize: 26, loadingSize: 18,
            fontSize: 22, fontWeight: 700, lineHeight: 38, letterSpacing: 1.5,
            outlineWidth: 4, paddingInline: 31, paddingBlock: 10, gap: 13)
        var decorated = plain
        decorated.properties.merge(["icon": "add", "trailingIcon": "close", "loading": true]) { _, new in new }
        let custom = fixture(decorated, appearance: appearance, rtl: true).nodes
        let customRoot = custom["component"]!, customContent = custom["component.content"]!, customLabel = custom["component.label"]!
        check(custom.count == 6, "Root, content, label, both icons and loader are independently measured")
        check(customRoot.metrics["padding"] == [14, 31, 14, 31] && customRoot.metrics["border"] == [4, 4, 4, 4],
              "Appearance override reports actual padding and overlaid stroke separately")
        check(abs(customContent.bounds.minX - customRoot.bounds.minX - 31) < 0.01 &&
              abs(customContent.bounds.minY - customRoot.bounds.minY - 14) < 0.01, "Reported insets match real layout coordinates")
        check(customRoot.metrics["gap"] == ["row": 0, "column": 13], "Stack gap comes from the rendered HStack")
        check(customRoot.metrics["direction"] == "rtl", "Inherited RTL is resolved in the native control")
        let typography = customRoot.metrics["typography"]!
        check(typography["size"] == 22 && typography["lineHeight"] == 38 && typography["weight"] == 700 &&
              typography["spacing"] == 1.5 && typography["family"] == "Roboto" && typography["unit"] == "pt",
              "Actual registered font and appearance typography reach inspection")
        check(custom["component.leading-icon"]!.bounds.width == 30 &&
              custom["component.trailing-icon"]!.bounds.width == 26 && custom["component.loader"]!.bounds.width == 18,
              "Independent native part sizes are measured")
        check(custom["component.leading-icon"]!.bounds.minX > customLabel.bounds.maxX &&
              custom["component.trailing-icon"]!.bounds.maxX < customLabel.bounds.minX,
              "Part coordinates follow actual RTL visual order")
        for node in custom.values where node.id != "component" {
            check(custom[node.parentId ?? ""] != nil, "Every measured parent exists")
        }
        decorated.properties["loading"] = false
        decorated.properties["dir"] = "ltr"
        let localDirection = fixture(decorated, appearance: appearance, rtl: true)
        check(localDirection.nodes["component"]!.metrics["direction"] == "ltr", "Local direction wins over inherited RTL")
        check(localDirection.nodes["component.leading-icon"]!.bounds.minX < localDirection.nodes["component.label"]!.bounds.minX,
              "Local direction metadata matches measured part positions")
        check(localDirection.nodes["component.loader"] == nil, "An absent part does not leave stale measurement data")
        let noInspection = fixture(decorated, appearance: appearance, rtl: true, inspect: false)
        check(noInspection.pixels == localDirection.pixels && noInspection.fitting == localDirection.fitting,
              "Inspection also preserves overridden multi-part rendering")
        let tallText = fixture(plain, appearance: .init(fontSize: 40, lineHeight: 8)).nodes
        check(tallText["component.label"]!.bounds.height == 8 &&
              tallText["component"]!.metrics["typography"]?["lineHeight"].number == Double(tallText["component.label"]!.bounds.height),
              "Explicit line height is the actual CSS-compatible line box even when glyphs overflow it")
        let constrained = fixture(plain, appearance: .init(width: 80, minWidth: 0, maxWidth: 90, height: 30, minHeight: 0)).nodes
        check(constrained["component"]!.bounds.size == CGSize(width: 80, height: 30), "Explicit border-box width/height replace intrinsic dimensions")
        check(abs(constrained["component.content"]!.bounds.midX - constrained["component"]!.bounds.midX) < 0.01, "Overflowing nowrap content stays centered")
        let zeroBox = fixture(plain, appearance: .init(paddingInline: 24, paddingBlock: 10, width: 0, minWidth: 0, maxWidth: 0, height: 0, minHeight: 0)).nodes
        check(zeroBox["component"]!.bounds.size == CGSize(width: 48, height: 20), "Zero width/height/max cannot erase CSS border-box padding")
        let thickZeroBox = fixture(plain, appearance: .init(outlineWidth: 4, paddingInline: 0, paddingBlock: 0, width: 0, minWidth: 0, maxWidth: 0, height: 0, minHeight: 0)).nodes
        check(thickZeroBox["component"]!.bounds.size == CGSize(width: 8, height: 8), "Zero padding and dimensions still preserve both border edges")
        let conflicting = fixture(plain, appearance: .init(width: 20, minWidth: 100, maxWidth: 60, height: 10, minHeight: 70)).nodes
        check(conflicting["component"]!.bounds.size == CGSize(width: 100, height: 70), "CSS min dimensions win over conflicting max and explicit dimensions")
        let capped = fixture(plain, appearance: .init(minWidth: 0, maxWidth: 60)).nodes
        check(capped["component"]!.bounds.width == 60, "Max width caps intrinsic layout while label remains nowrap")
        var wide = plain; wide.properties["fullWidth"] = true
        check(fixture(wide).nodes["component"]!.bounds.width == 592, "Full width consumes the available host width excluding padding")
        check(fixture(wide, appearance: .init(width: 150)).nodes["component"]!.bounds.width == 150, "Explicit width wins over fullWidth")
        let slotButton = try! AWCPreviewSlots.applyingValues([
            "leading-icon": ["kind": "symbol", "value": "favorite"],
            "trailing-icon": ["kind": "symbol", "value": "close"], "loader": ["kind": "progress"],
        ], to: AWCNode(id: "slots", tag: "md-button", properties: ["loading": true, "size": "sm"], children: [.text("Slots")]))
        let slots = fixture(slotButton, appearance: .init(iconSize: 38, trailingIconSize: 18, loadingSize: 10)).nodes
        check(slots["component.leading-icon"]!.bounds.width == 38 && slots["component.trailing-icon"]!.bounds.width == 18, "Custom symbol slots inherit independently resolved icon dimensions")
        check(slots["component.loader"]!.bounds.size == CGSize(width: 24, height: 24), "Supplied progress retains its own 24pt layout instead of the default loader size")
        let sizes = ["xs", "sm", "md", "lg", "xl"]
        let heights: [CGFloat] = [32, 40, 56, 96, 136]
        for (index, size) in sizes.enumerated() { for density in 0...4 {
            var rung = plain; rung.properties["size"] = .string(size); rung.properties["density"] = .number(Double(-density))
            let nodes = fixture(rung).nodes
            print("Measured \(size) density \(-density): \(nodes["component"]!.bounds.width)×\(nodes["component"]!.bounds.height) pt, line \(nodes["component.label"]!.bounds.height) pt")
            check(nodes["component"]!.bounds.height == max(24, heights[index] - CGFloat(density * 4)), "\(size)/\(-density) actual native container follows the source size/density ladder")
            check(nodes["component.label"]!.bounds.height == nodes["component"]!.metrics["typography"]?["lineHeight"].number.map { CGFloat($0) }, "\(size)/\(-density) reported line box matches actual layout")
        } }
        var nested = plain
        nested.children = [.init(id: "custom-child", tag: "md-icon", properties: ["icon": "add"])]
        let nestedNodes = fixture(nested).nodes
        check(nestedNodes["component.label"] != nil && nestedNodes["component"]!.metrics["typography"] == nil,
              "Nested custom label content remains measured without invented font metrics")
        nested.children = [.init(id: "tall-child", tag: "md-button", properties: ["size": "lg", "ripple": false], children: [.text("Nested")])]
        let tallNested = fixture(nested).nodes
        check(tallNested["component.label"]!.bounds.height == 96 && tallNested["component"]!.bounds.height == 96, "Arbitrary default-slot children retain their intrinsic height instead of being forced into the text line box")
        print("Passed \(checks) real native inspection layout, typography, hierarchy and rendering checks.")
    }
}
