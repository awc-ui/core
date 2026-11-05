import Foundation
@testable import AWCUI

enum NativeBadgeCases {
    private static var report: (Bool, String) -> Void = { _, _ in }
    static func run(_ check: @escaping (Bool, String) -> Void) throws {
        report = check
        testValuesFollowNumberAndUTF16SourceSemantics()
        try testAllMeasuredSourceValuesAndAccessibleNames()
        testAuthoredSlotPresenceAndContentDependentPadding()
        testDensityInheritsUnlessANonzeroSelectorOverridesIt()
        testStructuredAppearanceCascadeRejectsInvalidValuesAndPreservesZero()
    }
    private static func checkEqual<T: Equatable>(_ actual: T, _ expected: T, _ message: String = "") {
        report(actual == expected, "\(message): actual \(actual), expected \(expected)")
    }
    private static func checkNil<T>(_ actual: T?, _ message: String = "") { report(actual == nil, message) }

    private static func testValuesFollowNumberAndUTF16SourceSemantics() {
        let cases: [(String, Double, String)] = [
            ("", 999, ""), ("HELLO", 999, "HELL"), ("ABC😀", 999, "ABC�"), ("😀😀😀", 999, "😀😀"),
            ("0x100", 9, "9+"), ("0b1111", 9, "9+"), ("0o17", 9, "9+"), ("+0x100", 9, "+0x1"),
            ("Infinity", 9, "Infi"), ("1e3", 9, "9+"), ("99.5", 9, "9+"), ("  ", 9, "  "),
            ("\u{FEFF}", -1, "-1+"), ("-25", 9, "-25"), ("10", 2.5, "2.5+"), ("1000000", 99999, "99999+"),
            ("1e24", 1e23, "1e+23+"), ("10", 1e-7, "1e-7+"), ("10", 1e-6, "0.000001+"),
            ("-0", -1, "-1+"), ("1e22", 1e20, "100000000000000000000+"),
        ]
        for (value, max, expected) in cases {
            checkEqual(AWCNativeBadgeValue.display(properties: ["value": .string(value), "max": .number(max)]), expected, value)
            checkEqual(AWCNativeBadgeValue.display(properties: ["value": .string(value), "max": .number(max), "variant": "small"]), "")
        }
        for input in ["1_000", "1,000", "0x", "0b2", "0o8", "1e999", "\u{0085}", "\u{180E}"] {
            checkNil(AWCNativeBadgeValue.number(input), input)
        }
    }

    private static func testAllMeasuredSourceValuesAndAccessibleNames() throws {
        let file = URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent()
            .appendingPathComponent("Fixtures/BadgeWebGeometry.json")
        let document = try JSONSerialization.jsonObject(with: Data(contentsOf: file)) as! [String: Any]
        for fixture in document["results"] as! [[String: Any]] {
            let source = fixture["fixture"] as! [String: Any]
            let props = try JSONDecoder().decode([String: AWCValue].self, from: JSONSerialization.data(withJSONObject: source))
            let expected = (fixture["label"] as? [String: Any])?["text"] as? String ?? ""
            checkEqual(AWCNativeBadgeValue.display(properties: props), expected, source["id"] as! String)
            let metrics = AWCNativeBadgeMetrics(node: .init(tag: "md-badge"), properties: props, appearance: .init())
            checkEqual(metrics.accessibleLabel, fixture["accessibleLabel"] as? String ?? "")
        }
    }

    private static func testAuthoredSlotPresenceAndContentDependentPadding() {
        let blank = AWCNode(tag: "#slot-text", properties: ["text": ""], slot: "icon")
        let node = AWCNode(tag: "md-badge", children: [blank, .init(tag: "#symbol", properties: ["name": "favorite"], slot: "icon")])
        let metrics = AWCNativeBadgeMetrics(node: node, properties: ["icon": "error"], appearance: .init())
        checkEqual(metrics.children.count, 2)
        checkEqual(metrics.icon, "")
        checkEqual(metrics.accessibleLabel, "error")
        checkEqual(metrics.padding, .init(right: 4, left: 4))
        let small = AWCNativeBadgeMetrics(node: node, properties: ["variant": "small", "icon": "error", "value": "8"], appearance: .init())
        checkEqual(small.children.count, 0)
        checkEqual(small.display, "")
        checkEqual(small.icon, "")
        checkEqual(small.padding, .init())
        let empty = AWCNativeBadgeMetrics(node: .init(tag: "md-badge"), properties: [:], appearance: .init(largePadding: .init(top: 3, right: 12, bottom: 5, left: 6)))
        checkEqual(empty.padding, .init())
    }

    private static func testDensityInheritsUnlessANonzeroSelectorOverridesIt() {
        let cases: [(AWCValue?, Double, Double, Double)] = [
            (nil, -4, 12, 8), (0, -4, 12, 8), (-2, -4, 14, 9),
            (-1, -4, 15, 9.5), (-4, 0, 12, 8), (1, -4, 12, 8),
            (.number(.nan), -4, 12, 8), (0, .nan, 16, 10),
        ]
        for (value, inherited, height, icon) in cases {
            var properties: [String: AWCValue] = ["value": "8", "icon": "favorite"]
            properties["density"] = value
            let metrics = AWCNativeBadgeMetrics(node: .init(tag: "md-badge"), properties: properties,
                appearance: .init(), inheritedDensity: inherited)
            checkEqual(Double(metrics.height), height, "Inherited density height")
            checkEqual(Double(metrics.iconSize), icon, "Inherited density icon")
        }
    }

    private static func testStructuredAppearanceCascadeRejectsInvalidValuesAndPreservesZero() {
        let base = AWCBadgeAppearance(containerColor: "#abcdef", iconSize: 20, offsetX: .init(fraction: 0.5),
            largePadding: .init(right: 4, left: 4))
        let local = AWCBadgeAppearance(largeHeight: 0, largePadding: .init(), smallSize: 0)
        let merged = base.merging(local)
        checkEqual(merged.containerColor, "#ABCDEF")
        checkEqual(merged.iconSize, 20)
        checkEqual(merged.offsetX, .init(fraction: 0.5))
        checkEqual(merged.largePadding, .init())
        checkEqual(merged.largeHeight, 0)
        checkEqual(merged.smallSize, 0)
        for invalid: AWCValue in [.number(.nan), .number(.infinity), true, "3", -1] {
            for key in ["cornerRadius", "iconSize", "largeHeight", "smallSize"] {
                checkEqual(AWCBadgeAppearance(values: [key: invalid]), .init())
            }
        }
        for bad: AWCValue in [[], [1, 2], [1, 2, 3, -1], [1, "2", 3, 4], [1, 2, true, 4]] {
            checkNil(AWCBadgeAppearance(values: ["largePadding": bad]).largePadding)
        }
        for bad: AWCValue in [3, "50%", ["points": true], ["fraction": "0.5"], ["unexpected": 0], ["points": .number(.infinity)]] {
            checkNil(AWCBadgeAppearance(values: ["offsetX": bad]).offsetX)
        }
        checkEqual(AWCBadgeAppearance(values: ["offsetX": ["fraction": 0.5]]).offsetX, .init(fraction: 0.5))
        checkEqual(AWCBadgeAppearance(values: ["offsetY": ["points": -3]]).offsetY, .init(points: -3))
    }
}
