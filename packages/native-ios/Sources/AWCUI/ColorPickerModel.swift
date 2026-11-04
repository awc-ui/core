import SwiftUI

// md-color-picker colour model: a port of packages/core/src/components/md-color-picker/color-utils.ts with JavaScript's
// rounding (Math.round), parsing (parseFloat, regular expressions) and number formatting, so every accepted input,
// emitted string and channel value matches the Web component bit for bit.

/// HSVA: h 0–360, s / v 0–100 (percent), a 0–1.
public struct AWCHsva: Equatable, Sendable {
    public var h: Double, s: Double, v: Double, a: Double
    public init(h: Double, s: Double, v: Double, a: Double) { self.h = h; self.s = s; self.v = v; self.a = a }
}

enum AWCColorMath {
    static func jsRound(_ x: Double) -> Double { (x + 0.5).rounded(.down) }
    static func clamp(_ n: Double, _ lo: Double, _ hi: Double) -> Double { n.isNaN ? n : max(lo, min(hi, n)) }
    /// JavaScript `parseFloat` (leading decimal number; NaN when none).
    static func parseFloat(_ s: String) -> Double {
        var out = "", seenDot = false, seenDigit = false
        for (i, c) in s.trimmingCharacters(in: .whitespaces).enumerated() {
            if c.isASCII && c.isNumber { out.append(c); seenDigit = true }
            else if c == "." && !seenDot { out.append(c); seenDot = true }
            else if (c == "-" || c == "+") && i == 0 { out.append(c) }
            else { break }
        }
        return seenDigit ? Double(out) ?? .nan : .nan
    }
    /// JavaScript `parseInt(raw, 10)`.
    static func parseInt(_ s: String) -> Double? {
        var out = ""
        for (i, c) in s.trimmingCharacters(in: .whitespaces).enumerated() {
            if c.isASCII && c.isNumber { out.append(c) } else if (c == "-" || c == "+") && i == 0 { out.append(c) } else { break }
        }
        return Double(out)
    }
    /// JavaScript `String(+x.toFixed(2))`.
    static func fixed2(_ x: Double) -> String {
        let v = Double(String(format: "%.2f", x)) ?? x
        if v == v.rounded() && abs(v) < 1e15 { return String(Int(v)) }
        var t = String(format: "%.2f", v); while t.hasSuffix("0") { t.removeLast() }; if t.hasSuffix(".") { t.removeLast() }
        return t
    }
    static func rgbToHsv(_ r: Double, _ g: Double, _ b: Double) -> (h: Double, s: Double, v: Double) {
        let rn = r / 255, gn = g / 255, bn = b / 255, mx = max(rn, gn, bn), mn = min(rn, gn, bn), d = mx - mn
        var h = 0.0
        if d != 0 {
            if mx == rn { h = ((gn - bn) / d).truncatingRemainder(dividingBy: 6) } else if mx == gn { h = (bn - rn) / d + 2 } else { h = (rn - gn) / d + 4 }
            h *= 60; if h < 0 { h += 360 }
        }
        return (h, mx == 0 ? 0 : (d / mx) * 100, mx * 100)
    }
    static func hsvToRgb(_ h: Double, _ s: Double, _ v: Double) -> (r: Double, g: Double, b: Double) {
        let sn = s / 100, vn = v / 100, c = vn * sn, hp = h / 60
        let x = c * (1 - abs(hp.truncatingRemainder(dividingBy: 2) - 1))
        var r = 0.0, g = 0.0, b = 0.0
        if hp >= 0 && hp < 1 { r = c; g = x } else if hp < 2 { r = x; g = c } else if hp < 3 { g = c; b = x }
        else if hp < 4 { g = x; b = c } else if hp < 5 { r = x; b = c } else { r = c; b = x }
        let m = vn - c
        return (jsRound((r + m) * 255), jsRound((g + m) * 255), jsRound((b + m) * 255))
    }
    static func rgbToHsl(_ r: Double, _ g: Double, _ b: Double) -> (h: Double, s: Double, l: Double) {
        let rn = r / 255, gn = g / 255, bn = b / 255, mx = max(rn, gn, bn), mn = min(rn, gn, bn), l = (mx + mn) / 2
        var h = 0.0, s = 0.0
        if mx != mn {
            let d = mx - mn
            s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn)
            if mx == rn { h = (gn - bn) / d + (gn < bn ? 6 : 0) } else if mx == gn { h = (bn - rn) / d + 2 } else { h = (rn - gn) / d + 4 }
            h *= 60
        }
        return (h, s * 100, l * 100)
    }
    static func hslToRgb(_ h: Double, _ s: Double, _ l: Double) -> (r: Double, g: Double, b: Double) {
        let hn = (h.truncatingRemainder(dividingBy: 360) + 360).truncatingRemainder(dividingBy: 360)
        let sn = clamp(s, 0, 100) / 100, ln = clamp(l, 0, 100) / 100
        let c = (1 - abs(2 * ln - 1)) * sn, x = c * (1 - abs((hn / 60).truncatingRemainder(dividingBy: 2) - 1)), m = ln - c / 2
        var r = 0.0, g = 0.0, b = 0.0
        if hn < 60 { r = c; g = x } else if hn < 120 { r = x; g = c } else if hn < 180 { g = c; b = x }
        else if hn < 240 { g = x; b = c } else if hn < 300 { r = x; b = c } else { r = c; b = x }
        return (jsRound((r + m) * 255), jsRound((g + m) * 255), jsRound((b + m) * 255))
    }
    static func rgba(_ c: AWCHsva) -> (r: Double, g: Double, b: Double, a: Double) { let v = hsvToRgb(c.h, c.s, c.v); return (v.r, v.g, v.b, c.a) }
    static func hexByte(_ n: Double) -> String { String(format: "%02x", Int(clamp(jsRound(n), 0, 255))) }
    static func rgbaToHex(_ r: Double, _ g: Double, _ b: Double, _ a: Double, withAlpha: Bool) -> String {
        let base = "#" + hexByte(r) + hexByte(g) + hexByte(b)
        if !withAlpha && a >= 1 { return base.uppercased() }
        return (base + hexByte(a * 255)).uppercased()
    }
    static func hex(_ c: AWCHsva, withAlpha: Bool = false) -> String { let v = rgba(c); return rgbaToHex(v.r, v.g, v.b, v.a, withAlpha: withAlpha || c.a < 1) }
    static func hsl(_ c: AWCHsva) -> (h: Double, s: Double, l: Double) { let v = hsvToRgb(c.h, c.s, c.v); return rgbToHsl(v.r, v.g, v.b) }
    static func parseHex(_ input: String) -> (r: Double, g: Double, b: Double, a: Double)? {
        var s = input.trimmingCharacters(in: .whitespacesAndNewlines); if s.hasPrefix("#") { s.removeFirst() }
        guard !s.isEmpty, s.allSatisfy({ $0.isHexDigit && $0.isASCII }) else { return nil }
        let d = Array(s).map { Double(Int(String($0), radix: 16)!) }
        switch d.count {
        case 3: return (d[0] * 17, d[1] * 17, d[2] * 17, 1)
        case 4: return (d[0] * 17, d[1] * 17, d[2] * 17, d[3] * 17 / 255)
        case 6: return (d[0] * 16 + d[1], d[2] * 16 + d[3], d[4] * 16 + d[5], 1)
        case 8: return (d[0] * 16 + d[1], d[2] * 16 + d[3], d[4] * 16 + d[5], (d[6] * 16 + d[7]) / 255)
        default: return nil
        }
    }
    private static let rgbRE = try! NSRegularExpression(pattern: #"^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.%]+))?\s*\)$"#, options: .caseInsensitive)
    private static let hslRE = try! NSRegularExpression(pattern: #"^hsla?\(\s*([\d.]+)[\s,]+([\d.]+)%?[\s,]+([\d.]+)%?(?:[\s,/]+([\d.%]+))?\s*\)$"#, options: .caseInsensitive)
    private static func groups(_ re: NSRegularExpression, _ s: String) -> [String?]? {
        guard let m = re.firstMatch(in: s, range: NSRange(s.startIndex..., in: s)) else { return nil }
        return (1..<m.numberOfRanges).map { i in Range(m.range(at: i), in: s).map { String(s[$0]) } }
    }
    private static func alpha(_ v: String?) -> Double {
        guard let v else { return 1 }
        return v.hasSuffix("%") ? clamp(parseFloat(v) / 100, 0, 1) : clamp(parseFloat(v), 0, 1)
    }
    static func parseRgb(_ input: String) -> (r: Double, g: Double, b: Double, a: Double)? {
        guard let g = groups(rgbRE, input.trimmingCharacters(in: .whitespacesAndNewlines)) else { return nil }
        func comp(_ v: String) -> Double { v.hasSuffix("%") ? clamp(parseFloat(v) / 100 * 255, 0, 255) : clamp(parseFloat(v), 0, 255) }
        return (jsRound(comp(g[0]!)), jsRound(comp(g[1]!)), jsRound(comp(g[2]!)), alpha(g[3]))
    }
    static func parseHsl(_ input: String) -> (r: Double, g: Double, b: Double, a: Double)? {
        guard let g = groups(hslRE, input.trimmingCharacters(in: .whitespacesAndNewlines)) else { return nil }
        let v = hslToRgb(clamp(parseFloat(g[0]!), 0, 360), clamp(parseFloat(g[1]!), 0, 100), clamp(parseFloat(g[2]!), 0, 100))
        return (v.r, v.g, v.b, alpha(g[3]))
    }
    /// `parseColor`: hex (3/4/6/8, with or without #), rgb[a](), hsl[a](); nil when invalid.
    static func parse(_ input: String) -> AWCHsva? {
        let t = input.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !t.isEmpty else { return nil }
        let rgba: (r: Double, g: Double, b: Double, a: Double)?
        if t.hasPrefix("#") || ((3...8).contains(t.count) && t.allSatisfy { $0.isHexDigit && $0.isASCII }) { rgba = parseHex(t) }
        else if t.lowercased().hasPrefix("rgb") { rgba = parseRgb(t) }
        else if t.lowercased().hasPrefix("hsl") { rgba = parseHsl(t) }
        else { rgba = nil }
        guard let rgba else { return nil }
        let hsv = rgbToHsv(rgba.r, rgba.g, rgba.b)
        return AWCHsva(h: hsv.h, s: hsv.s, v: hsv.v, a: rgba.a)
    }
    /// `formatColor`.
    static func format(_ c: AWCHsva, _ format: String) -> String {
        let v = rgba(c)
        func i(_ x: Double) -> String { String(Int(x)) }
        if format == "rgb" { return c.a < 1 ? "rgba(\(i(v.r)), \(i(v.g)), \(i(v.b)), \(fixed2(c.a)))" : "rgb(\(i(v.r)), \(i(v.g)), \(i(v.b)))" }
        if format == "hsl" {
            let h = rgbToHsl(v.r, v.g, v.b)
            return c.a < 1 ? "hsla(\(i(jsRound(h.h))), \(i(jsRound(h.s)))%, \(i(jsRound(h.l)))%, \(fixed2(c.a)))" : "hsl(\(i(jsRound(h.h))), \(i(jsRound(h.s)))%, \(i(jsRound(h.l)))%)"
        }
        return hex(c, withAlpha: c.a < 1)
    }
    /// Colour of a hex string for painting (#RRGGBB / #RRGGBBAA).
    static func color(_ c: AWCHsva, alpha: Bool) -> Color { let v = rgba(c); return Color(.sRGB, red: v.r / 255, green: v.g / 255, blue: v.b / 255, opacity: alpha ? c.a : 1) }
}

/// Built-in accessible labels (color-picker-labels.ts): English, Arabic, Romanian.
enum AWCColorPickerLabels {
    static let english = ["saturation": "Saturation and brightness", "hue": "Hue", "opacity": "Opacity", "presets": "Color presets", "current": "Current colour"]
    static let translations: [String: [String: String]] = [
        "ar": ["saturation": "التشبّع والسطوع", "hue": "درجة اللون", "opacity": "العتامة", "presets": "ألوان جاهزة", "current": "اللون الحالي"],
        "ro": ["saturation": "Saturație și luminozitate", "hue": "Nuanță", "opacity": "Opacitate", "presets": "Culori predefinite", "current": "Culoarea curentă"],
    ]
    static func label(_ locale: String, _ key: String) -> String {
        let language = (locale.isEmpty ? "en" : locale).trimmingCharacters(in: .whitespacesAndNewlines).lowercased().split(separator: "-", omittingEmptySubsequences: false).first.map(String.init) ?? "en"
        return translations[language]?[key] ?? english[key] ?? key
    }
}

/// md-color-picker's public CSS custom properties (`--md-color-picker-*`) as native appearance hooks.
public struct AWCColorPickerAppearance: Equatable, Sendable {
    public var width: Double?, plateHeight: Double?, radius: Double?
    public var surfaceColor: String?, onSurface: String?, outlineColor: String?, outlineStrong: String?
    public var thumbSize: Double?, thumbBorder: String?, presetSize: Double?
    /// CSS box-shadow text (e.g. `0 0 0 4px #2E7D32`) for the popover; `none` removes it.
    public var popoverElevation: String?
    public init(width: Double? = nil, plateHeight: Double? = nil, radius: Double? = nil, surfaceColor: String? = nil, onSurface: String? = nil,
                outlineColor: String? = nil, outlineStrong: String? = nil, thumbSize: Double? = nil, thumbBorder: String? = nil,
                presetSize: Double? = nil, popoverElevation: String? = nil) {
        func length(_ v: Double?) -> Double? { v.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil } }
        self.width = length(width); self.plateHeight = length(plateHeight); self.radius = length(radius)
        self.surfaceColor = surfaceColor; self.onSurface = onSurface; self.outlineColor = outlineColor; self.outlineStrong = outlineStrong
        self.thumbSize = length(thumbSize); self.thumbBorder = thumbBorder; self.presetSize = length(presetSize); self.popoverElevation = popoverElevation
    }
    public func merging(_ o: AWCColorPickerAppearance) -> AWCColorPickerAppearance {
        .init(width: o.width ?? width, plateHeight: o.plateHeight ?? plateHeight, radius: o.radius ?? radius, surfaceColor: o.surfaceColor ?? surfaceColor,
              onSurface: o.onSurface ?? onSurface, outlineColor: o.outlineColor ?? outlineColor, outlineStrong: o.outlineStrong ?? outlineStrong,
              thumbSize: o.thumbSize ?? thumbSize, thumbBorder: o.thumbBorder ?? thumbBorder, presetSize: o.presetSize ?? presetSize,
              popoverElevation: o.popoverElevation ?? popoverElevation)
    }
}
private struct AWCColorPickerAppearanceKey: EnvironmentKey { static let defaultValue = AWCColorPickerAppearance() }
private struct AWCColorPickerAppearanceTargetsKey: EnvironmentKey { static let defaultValue: [String: AWCColorPickerAppearance] = [:] }
extension EnvironmentValues {
    var awcColorPickerAppearance: AWCColorPickerAppearance { get { self[AWCColorPickerAppearanceKey.self] } set { self[AWCColorPickerAppearanceKey.self] = newValue } }
    var awcColorPickerAppearanceTargets: [String: AWCColorPickerAppearance] { get { self[AWCColorPickerAppearanceTargetsKey.self] } set { self[AWCColorPickerAppearanceTargetsKey.self] = newValue } }
}
private struct AWCColorPickerAppearanceModifier: ViewModifier {
    let value: AWCColorPickerAppearance, id: String?
    @Environment(\.awcColorPickerAppearance) private var inherited
    @Environment(\.awcColorPickerAppearanceTargets) private var targets
    func body(content: Content) -> some View {
        if let id { var t = targets; t[id] = (t[id] ?? .init()).merging(value); return AnyView(content.environment(\.awcColorPickerAppearanceTargets, t)) }
        return AnyView(content.environment(\.awcColorPickerAppearance, inherited.merging(value)))
    }
}
public extension View {
    /// Applies md-color-picker hooks to every picker below (or to the picker with `id`).
    func awcColorPickerAppearance(_ value: AWCColorPickerAppearance, for id: String? = nil) -> some View { modifier(AWCColorPickerAppearanceModifier(value: value, id: id)) }
}
