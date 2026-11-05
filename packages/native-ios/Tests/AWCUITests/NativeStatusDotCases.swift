import Foundation
@testable import AWCUI

enum NativeStatusDotFixture {
    static func documents() throws -> [[String: Any]] {
        let directory = URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent()
            .appendingPathComponent("Fixtures")
        return try ["light", "dark"].map {
            try JSONSerialization.jsonObject(with: Data(contentsOf: directory.appendingPathComponent("StatusDotWeb-\($0).json"))) as! [String: Any]
        }
    }
    /// R2-D1: fresh default-palette Chrome captures (font-only stylesheet, unmodified library tokens).
    static func defaultDocuments() throws -> [[String: Any]] {
        let directory = URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent()
            .appendingPathComponent("Fixtures")
        return try ["light", "dark"].map {
            try JSONSerialization.jsonObject(with: Data(contentsOf: directory.appendingPathComponent("StatusDotWebDefault-\($0).json"))) as! [String: Any]
        }
    }
    static func values(_ source: [String: Any]) throws -> [String: AWCValue] {
        try JSONDecoder().decode([String: AWCValue].self, from: JSONSerialization.data(withJSONObject: source))
    }
    static func tokens(_ document: [String: Any]) -> [String: String] {
        // Native APIs consume resolved hex colors, not CSS shorthand syntax.
        (document["tokens"] as! [String: String]).mapValues { value in
            if value.hasPrefix("#"), value.count == 4 || value.count == 5 {
                return "#" + value.dropFirst().map { "\($0)\($0)" }.joined()
            }
            return value
        }
    }
    static func appearance(_ source: [String: Any]) -> AWCStatusDotAppearance {
        let style = source["style"] as? [String: String] ?? [:]
        func length(_ key: String) -> Double? { style[key].flatMap { Double($0.replacingOccurrences(of: "px", with: "")) } }
        func inset(_ key: String) -> AWCStatusDotInset? {
            guard let text = style[key] else { return nil }
            if text.hasPrefix("calc(") {
                let parts = text.dropFirst(5).dropLast().split(separator: " ")
                return .init(points: Double(parts[2].replacingOccurrences(of: "px", with: ""))! * (parts[1] == "-" ? -1 : 1),
                    fraction: Double(parts[0].dropLast())! / 100)
            }
            if text.hasSuffix("%") { return .init(fraction: Double(text.dropLast())! / 100) }
            return .init(points: Double(text.replacingOccurrences(of: "px", with: ""))!)
        }
        return .init(size: length("size"), color: style["color"], pulseColor: style["pulseColor"],
            outlineColor: style["outlineColor"], outlineWidth: length("outlineWidth"),
            insetEnd: inset("insetEnd"), insetBlockEnd: inset("insetBlockEnd"),
            pulseDuration: style["pulseDuration"].flatMap { Double($0.dropLast()) })
    }
    static func rgba(_ hex: String) -> [Double] {
        let value = UInt64(hex.dropFirst(), radix: 16)!
        let alpha = hex.count == 9, rgb = alpha ? value >> 8 : value
        return [Double((rgb >> 16) & 255), Double((rgb >> 8) & 255), Double(rgb & 255), alpha ? Double(value & 255) / 255 : 1]
    }
    static func numbers(_ string: String) -> [Double] {
        let regex = try! NSRegularExpression(pattern: #"-?(?:\d*\.)?\d+(?:[eE][+-]?\d+)?"#)
        return regex.matches(in: string, range: NSRange(string.startIndex..., in: string)).map {
            Double(String(string[Range($0.range, in: string)!]))!
        }
    }
}

enum NativeStatusDotCases {
    static func run(_ check: (Bool, String) -> Void) throws {
        for document in try NativeStatusDotFixture.documents() {
            let tokens = NativeStatusDotFixture.tokens(document)
            let scale = (document["browser"] as? [String: Any])?["devicePixelRatio"] as? Double ?? 2
            for fixture in document["results"] as! [[String: Any]] {
                let source = fixture["fixture"] as! [String: Any], web = fixture["host"] as! [String: Any]
                let id = "\(document["theme"]!)/\(source["id"]!)"
                let m = AWCNativeStatusDotMetrics(properties: try NativeStatusDotFixture.values(source),
                    appearance: NativeStatusDotFixture.appearance(source), density: source["inheritedDensity"] as? Double ?? 0,
                    tokens: tokens, displayScale: scale)
                if source["hidden"] as? Bool != true {
                    check(abs(m.size - (web["width"] as! Double)) < 0.02, "\(id) source diameter")
                    check(abs(m.outlineWidth - NativeStatusDotFixture.numbers(web["outlineWidth"] as! String)[0]) < 0.001, "\(id) physical-pixel outline width")
                    if !m.inline {
                        let parent = CGSize(width: source["parentWidth"] as? Double ?? 48, height: source["parentHeight"] as? Double ?? 48)
                        let frame = m.frame(in: parent, rtl: source["dir"] as? String == "rtl")
                        check(abs(frame.minX - (web["x"] as! Double)) < 0.02, "\(id) logical horizontal anchor")
                        check(abs(frame.minY - (web["y"] as! Double)) < 0.02, "\(id) block-end anchor")
                    }
                }
                for (paint, expected, name) in [(m.color, web["fill"] as! String, "fill"), (m.outlineColor, web["outlineColor"] as! String, "outline")] {
                    var webColor = NativeStatusDotFixture.numbers(expected)
                    if webColor.count == 3 { webColor.append(1) }
                    check(zip(NativeStatusDotFixture.rgba(paint), webColor).allSatisfy { abs($0 - $1) < 0.002 }, "\(id) source \(name) color")
                }
                check(m.label == (web["ariaLabel"] as? String ?? ""), "\(id) source accessible label")
            }
            for pulse in document["pulses"] as! [[String: Any]] where pulse["available"] as? Bool == true {
                let source = (document["results"] as! [[String: Any]]).first {
                    ($0["fixture"] as? [String: Any])?["id"] as? String == pulse["id"] as? String
                }!["fixture"] as! [String: Any]
                let m = AWCNativeStatusDotMetrics(properties: try NativeStatusDotFixture.values(source),
                    appearance: NativeStatusDotFixture.appearance(source), tokens: tokens)
                for sample in pulse["samples"] as! [[String: Any]] {
                    let progress = sample["fraction"] as! Double
                    let native = AWCNativeStatusPulse.at(progress == 1 ? 0 : progress)
                    let expected = NativeStatusDotFixture.numbers(sample["boxShadow"] as! String)
                    // rgba/rgb components precede x, y, blur, spread.
                    check(abs(native.spread - expected.last!) < 0.002, "\(pulse["id"]!) pulse spread at \(progress)")
                    let alpha = NativeStatusDotFixture.rgba(m.pulseColor)[3] * m.pulseOpacity * native.opacity
                    let expectedAlpha = expected.count == 8 ? expected[3] : 1
                    check(abs(alpha - expectedAlpha) < 0.003, "\(pulse["id"]!) pulse alpha at \(progress)")
                }
                let end = AWCNativeStatusPulse.at(1)
                check(end.spread < 0.002 && end.opacity == 0, "\(pulse["id"]!) finite iteration endpoint")
            }
        }
        let base = AWCStatusDotAppearance(size: 20, color: "#abcdef", pulseColor: "#12345680",
            insetEnd: .init(points: -2, fraction: 0.25))
        let local = AWCStatusDotAppearance(outlineWidth: 0, pulseDuration: 0)
        let merged = base.merging(local)
        check(merged.size == 20 && merged.color == "#ABCDEF" && merged.pulseColor == "#12345680", "Field-wise appearance inheritance")
        check(merged.outlineWidth == 0 && merged.pulseDuration == 0 && merged.insetEnd == base.insetEnd, "Explicit zero and structured insets survive merging")
        for key in ["size", "outlineWidth", "pulseDuration"] {
            for invalid: AWCValue in [-1, .number(.infinity), .number(.nan), "4", true] {
                check(AWCStatusDotAppearance(values: [key: invalid]) == .init(), "\(key) rejects invalid authored values")
            }
        }
        for invalid: AWCValue in [3, "50%", ["points": true], ["fraction": "0.5"], ["unexpected": 0]] {
            check(AWCStatusDotAppearance(values: ["insetEnd": invalid]).insetEnd == nil, "Typed inset rejects invalid input")
        }
        let blank = AWCNativeStatusDotMetrics(properties: ["label": "\u{FEFF}\u{00A0}"], appearance: .init())
        let nel = AWCNativeStatusDotMetrics(properties: ["label": "\u{0085}"], appearance: .init())
        check(blank.label.isEmpty && nel.label == "\u{0085}", "Accessible labels use ECMAScript trim semantics")
    }
}
