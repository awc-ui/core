import AppKit
import SwiftUI
import Observation
import AWCUI

@Observable private final class BadgeFixtureState {
    var properties: [String: AWCValue] = [:]
    var appearance = AWCBadgeAppearance()
    var children: [AWCNode] = []
    var parentSize = CGSize(width: 48, height: 48)
    var rtl = false
    var nodes: [AWCNativeInspectionNode] = []
    var epoch = 0
    var dark = false // R2-D1: default-palette pass
}
private struct BadgeFixture: View {
    let state: BadgeFixtureState
    var body: some View {
        let epoch = state.epoch
        let identity = "badge-\(epoch)"
        return Color.gray.opacity(0.1)
            .frame(width: state.parentSize.width, height: state.parentSize.height)
            .awcBadgeOverlay {
                AWCNativeView(node: .init(id: identity, tag: "md-badge", properties: state.properties, children: state.children))
                    .awcBadgeAppearance(state.appearance)
                    .awcNativeInspection(rootID: identity, coordinateSpace: "badge-fixture") {
                        if state.epoch == epoch { state.nodes = $0 }
                    }
            }
            .id(epoch)
            .frame(width: 320, height: 220)
            .background(Color.white).awcTheme(.generated(dark: state.dark)).environment(\.colorScheme, state.dark ? .dark : .light)
            .environment(\.layoutDirection, state.rtl ? .rightToLeft : .leftToRight)
            .transaction { $0.disablesAnimations = true }
            .coordinateSpace(name: "badge-fixture")
    }
}
@main @MainActor enum NativeBadgeViewIntegration {
    static var checks = 0
    static var failures: [String] = []
    static func check(_ valid: Bool, _ message: String) {
        checks += 1
        if !valid { failures.append(message); print("FAIL: \(message)"); fflush(stdout) }
    }
    static func pump() {
        let end = Date().addingTimeInterval(0.08)
        while Date() < end { _ = RunLoop.current.run(mode: .default, before: Date().addingTimeInterval(0.003)) }
    }
    static func values(_ object: Any) throws -> [String: AWCValue] {
        try JSONDecoder().decode([String: AWCValue].self, from: JSONSerialization.data(withJSONObject: object))
    }
    static func appearance(_ source: [String: Any]) throws -> AWCBadgeAppearance {
        var style = source
        if let padding = style["largePadding"] as? String {
            let parts = padding.split(separator: " ").map { Double($0.replacingOccurrences(of: "px", with: ""))! }
            style["largePadding"] = parts.count == 1 ? Array(repeating: parts[0], count: 4) : parts
        }
        for key in ["offsetX", "offsetY"] {
            if let text = style[key] as? String {
                switch text {
                case "0%": style[key] = ["points": 0, "fraction": 0]
                case "calc(50% + 7px)": style[key] = ["points": 7, "fraction": 0.5]
                case "calc(-50% - 3px)": style[key] = ["points": -3, "fraction": -0.5]
                default: style[key] = ["points": Double(text.replacingOccurrences(of: "px", with: ""))!, "fraction": 0]
                }
            }
        }
        return AWCBadgeAppearance(values: try values(style))
    }
    static func main() throws {
        try NativeBadgeCases.run { check($0, $1) }
        let contractChecks = checks
        _ = NSApplication.shared; NSApp.setActivationPolicy(.accessory)
        let input = try Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[1]))
        let oracle = try JSONSerialization.jsonObject(with: input) as! [String: Any]
        let fixtures = oracle["results"] as! [[String: Any]]
        let state = BadgeFixtureState()
        let host = NSHostingView(rootView: BadgeFixture(state: state))
        let window = NSWindow(contentRect: .init(x: -20000, y: -20000, width: 320, height: 220),
                              styleMask: .borderless, backing: .buffered, defer: false)
        window.isReleasedWhenClosed = false; window.colorSpace = .sRGB; window.contentView = host; window.orderFrontRegardless()
        defer { window.close() }
        var measured: [[String: Any]] = []
        var fontBoundaries: [[String: Any]] = []
        for fixture in fixtures {
            let source = fixture["fixture"] as! [String: Any], id = source["id"] as! String
            state.properties = try values(source.filter { ["variant", "density", "value", "max", "shape", "icon", "hidden"].contains($0.key) })
            state.appearance = try appearance(source["style"] as? [String: Any] ?? [:])
            state.parentSize = .init(width: source["parentWidth"] as? Double ?? 48, height: source["parentHeight"] as? Double ?? 48)
            state.rtl = source["dir"] as? String == "rtl"
            state.children = []
            if let slot = source["slot"] as? String {
                for index in 0..<(slot == "multiple" ? 2 : 1) {
                    state.children.append(.init(id: "slot-\(index)", tag: slot == "symbol" ? "#symbol" : "#slot-text",
                        properties: slot == "symbol" ? ["name": "favorite"] : ["text": .string(slot == "empty" ? "" : index == 0 ? "X" : "Y")], slot: "icon"))
                }
            }
            state.epoch += 1; state.nodes = []
            host.layoutSubtreeIfNeeded(); pump()
            if source["hidden"] as? Bool == true {
                check(state.nodes.isEmpty, "\(id): hidden removes badge inspection")
                continue
            }
            guard let root = state.nodes.first(where: { $0.id == "component" }) else {
                fatalError("\(id): missing measured root: \(state.nodes)")
            }
            let web = fixture["host"] as! [String: Any]
            func expect(_ actual: CGFloat, _ expected: Any?, _ metric: String, tolerance: CGFloat = 0.8) {
                let expected = CGFloat((expected as! NSNumber).doubleValue)
                check(abs(actual - expected) <= tolerance, "\(id) \(metric): native \(actual), Web \(expected). Nodes: \(state.nodes)")
            }
            let nativeEmoji = id == "value-33"
            let label = state.nodes.first { $0.id == "component.label" }
            let icon = state.nodes.first { $0.id == "component.icon" }
            if nativeEmoji {
                check(label != nil, "\(id): native emoji label is measured")
                expect(root.bounds.width, (label?.bounds.width ?? 0) + 8, "native emoji width plus source padding", tolerance: 0.02)
                fontBoundaries.append(["id": id, "webWidth": web["width"]!, "nativeWidth": root.bounds.width,
                    "reason": "CoreText AppleColorEmoji fallback advances differ from Chrome. The native OS glyph is retained; source height, padding and physical anchor rules are still checked."])
            } else { expect(root.bounds.width, web["width"], "width") }
            expect(root.bounds.height, web["height"], "height", tolerance: 0.02)
            let parentX = (320 - state.parentSize.width) / 2, parentY = (220 - state.parentSize.height) / 2
            expect(root.bounds.minX - parentX, nativeEmoji ? state.parentSize.width - root.bounds.width / 2 : web["x"], "x", tolerance: 0.5)
            expect(root.bounds.minY - parentY, web["y"], "y", tolerance: 0.02)
            for (name, actual, expected) in [("label", label, fixture["label"]), ("icon", icon, fixture["icon"])] {
                if let expected = expected as? [String: Any], expected["display"] as? String != "" {
                    check(actual != nil, "\(id): \(name) part present")
                    if let actual {
                        expect(actual.bounds.minX - root.bounds.minX, expected["x"], "\(name) x")
                        expect(actual.bounds.minY - root.bounds.minY, expected["y"], "\(name) y", tolerance: 0.02)
                        if nativeEmoji && name == "label" { check(actual.bounds.width > 0, "\(id): native emoji has positive intrinsic width") }
                        else { expect(actual.bounds.width, expected["width"], "\(name) width") }
                        expect(actual.bounds.height, expected["height"], "\(name) height", tolerance: 0.02)
                    }
                } else { check(actual == nil, "\(id): absent \(name) part") }
            }
            let slots = state.nodes.filter { $0.id.hasPrefix("component.slot.icon.") }.sorted { $0.id < $1.id }
            let expectedSlots = (fixture["slots"] as! [[String: Any]]).filter { $0["display"] as? String != "" }
            check(slots.count == expectedSlots.count, "\(id): authored icon count")
            for (slot, expected) in zip(slots, expectedSlots) {
                expect(slot.bounds.minX - root.bounds.minX, expected["x"], "slot x")
                expect(slot.bounds.minY - root.bounds.minY, expected["y"], "slot y", tolerance: 0.02)
                expect(slot.bounds.width, expected["width"], "slot width", tolerance: 0.02)
                expect(slot.bounds.height, expected["height"], "slot height", tolerance: 0.02)
            }
            measured.append(["id": id, "width": root.bounds.width, "height": root.bounds.height,
                "x": root.bounds.minX - parentX, "y": root.bounds.minY - parentY])
            if id == "styled-56" || id == "small-custom" || nativeEmoji {
                host.layoutSubtreeIfNeeded(); host.displayIfNeeded()
                let bitmap = host.bitmapImageRepForCachingDisplay(in: host.bounds)!
                host.cacheDisplay(in: host.bounds, to: bitmap)
                if CommandLine.arguments.count > 2 {
                    let output = URL(fileURLWithPath: CommandLine.arguments[2]).deletingLastPathComponent()
                        .appendingPathComponent("swift-\(id).png")
                    try bitmap.representation(using: .png, properties: [:])!.write(to: output)
                }
                if state.appearance.containerColor == "#123456" {
                    let image = bitmap.cgImage!
                    var bytes = [UInt8](repeating: 0, count: image.width * image.height * 4)
                    bytes.withUnsafeMutableBytes { data in
                        let context = CGContext(data: data.baseAddress, width: image.width, height: image.height,
                            bitsPerComponent: 8, bytesPerRow: image.width * 4, space: CGColorSpace(name: CGColorSpace.sRGB)!,
                            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
                        context.draw(image, in: CGRect(x: 0, y: 0, width: image.width, height: image.height))
                    }
                    let hits = stride(from: 0, to: bytes.count, by: 4).filter {
                        abs(Int(bytes[$0]) - 18) <= 3 && abs(Int(bytes[$0 + 1]) - 52) <= 3 && abs(Int(bytes[$0 + 2]) - 86) <= 3
                    }.count
                    check(hits > 20, "\(id): actual badge background uses authored color")
                }
            }
        }
        // Gate-7 R2-D1: fresh default-palette Chrome capture (font-only stylesheet, unmodified library tokens), light and
        // dark. The native renderer gets no injected colours: container, label and icon ink must equal Chrome's.
        var paletteCases = 0
        let fixtureDirectory = URL(fileURLWithPath: #filePath).deletingLastPathComponent().appendingPathComponent("Fixtures")
        func rgb(_ css: String) -> [Int] { css.split(whereSeparator: { !"0123456789.".contains($0) }).compactMap { Double($0) }.prefix(3).map { Int($0.rounded()) } }
        for theme in ["light", "dark"] {
            let document = try JSONSerialization.jsonObject(with: Data(contentsOf: fixtureDirectory.appendingPathComponent("BadgeWebDefault-\(theme).json"))) as! [String: Any]
            state.dark = theme == "dark"
            for fixture in document["results"] as! [[String: Any]] {
                let source = fixture["fixture"] as! [String: Any], id = "default-\(theme)/\(source["id"] as! String)"
                if source["style"] != nil || source["hidden"] as? Bool == true || source["id"] as? String == "value-33" { continue }
                state.properties = try values(source.filter { ["variant", "density", "value", "max", "shape", "icon"].contains($0.key) })
                state.appearance = .init()
                state.parentSize = .init(width: source["parentWidth"] as? Double ?? 48, height: source["parentHeight"] as? Double ?? 48)
                state.rtl = source["dir"] as? String == "rtl"
                state.children = []
                if let slot = source["slot"] as? String {
                    for index in 0..<(slot == "multiple" ? 2 : 1) {
                        state.children.append(.init(id: "slot-\(index)", tag: slot == "symbol" ? "#symbol" : "#slot-text",
                            properties: slot == "symbol" ? ["name": "favorite"] : ["text": .string(slot == "empty" ? "" : index == 0 ? "X" : "Y")], slot: "icon"))
                    }
                }
                state.epoch += 1; state.nodes = []
                host.layoutSubtreeIfNeeded(); pump(); host.displayIfNeeded()
                let bitmap = host.bitmapImageRepForCachingDisplay(in: host.bounds)!
                host.cacheDisplay(in: host.bounds, to: bitmap)
                let image = bitmap.cgImage!
                var bytes = [UInt8](repeating: 0, count: image.width * image.height * 4)
                bytes.withUnsafeMutableBytes { data in
                    let context = CGContext(data: data.baseAddress, width: image.width, height: image.height,
                        bitsPerComponent: 8, bytesPerRow: image.width * 4, space: CGColorSpace(name: CGColorSpace.sRGB)!,
                        bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
                    context.draw(image, in: CGRect(x: 0, y: 0, width: image.width, height: image.height))
                }
                let scale = CGFloat(image.width) / host.bounds.width
                func hits(_ c: [Int], _ tolerance: Int, in rect: CGRect? = nil, flipped: Bool = false) -> Int {
                    var n = 0
                    let r = rect.map { CGRect(x: $0.minX * scale, y: (flipped ? host.bounds.height - $0.maxY : $0.minY) * scale, width: $0.width * scale, height: $0.height * scale).integral }
                        ?? CGRect(x: 0, y: 0, width: image.width, height: image.height)
                    for y in max(0, Int(r.minY))..<min(image.height, Int(r.maxY)) { for x in max(0, Int(r.minX))..<min(image.width, Int(r.maxX)) {
                        let o = (y * image.width + x) * 4
                        if abs(Int(bytes[o]) - c[0]) <= tolerance && abs(Int(bytes[o + 1]) - c[1]) <= tolerance && abs(Int(bytes[o + 2]) - c[2]) <= tolerance { n += 1 }
                    } }
                    return n
                }
                let web = fixture["host"] as! [String: Any], container = rgb(web["background"] as! String)
                check(hits(container, 3) > 8, "\(id): default-palette container \(web["background"]!)")
                // Ink is counted only inside the measured part box, which lies inside the container, so a white label
                // cannot be matched by the white page around the badge. Row order is taken from where the container is.
                let value = (source["value"] as? String ?? "").trimmingCharacters(in: .whitespaces)
                for part in ["label", "icon"] where part == "icon" || !value.isEmpty {
                    if let p = fixture[part] as? [String: Any], p["display"] as? String == "block", let color = p["color"] as? String, !color.isEmpty,
                       let box = state.nodes.first(where: { $0.id == "component.\(part)" })?.bounds, box.width > 0, box.height > 0 {
                        let flipped = hits(container, 3, in: box, flipped: true) > hits(container, 3, in: box)
                        check(hits(rgb(color), 8, in: box, flipped: flipped) > 2, "\(id): default-palette \(part) ink \(color) in \(box)")
                    }
                }
                paletteCases += 1
            }
        }
        check(paletteCases > 100, "Default-palette badge cases compared: \(paletteCases)")
        print("Badge default palette: \(paletteCases) cases compared without injected colours.")
        if CommandLine.arguments.count > 2 {
            try JSONSerialization.data(withJSONObject: ["contractChecks": contractChecks, "renderChecks": checks - contractChecks,
                "fixtures": fixtures.count, "fontBoundaries": fontBoundaries, "measurements": measured], options: [.prettyPrinted, .sortedKeys])
                .write(to: URL(fileURLWithPath: CommandLine.arguments[2]))
        }
        precondition(failures.isEmpty, "\(failures.count) Badge checks failed out of \(checks); see the individual measurements above.")
        print("Passed \(contractChecks) Badge contract checks and \(checks - contractChecks) actual SwiftUI checks against \(fixtures.count) hydrated Web cases; \(fontBoundaries.count) explicitly recorded OS emoji-font boundary.")
    }
}
