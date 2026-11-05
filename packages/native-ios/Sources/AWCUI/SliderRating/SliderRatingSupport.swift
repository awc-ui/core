import Foundation
import CoreText

// md-slider / md-rating support: CSS colour parsing with the canvas `fillStyle` normalisation (named colours, hsl()/hwb(),
// modern rgb() syntax → 8-bit sRGB), JS number formatting / parseFloat / Math.round, the stylesheet cubic-bezier easing,
// token reads, the Roboto text metrics and the typed hook text. Copied from the chart port (n5: Charts/ChartColor.swift,
// ChartAnimate.swift, ChartModel.swift, ChartScale.swift, NativeChart.swift, N5/N5PublicAPI.swift) under slider/rating
// names so that the two renderer families install and evolve independently.

typealias AWCSRRGBA = (Double, Double, Double, Double)

#if os(iOS)
/// Pointer input here is a finger: md-slider and md-rating follow Chrome's touch contract (no hover; the range input jumps to
/// the touch point and is not focused; a rating tap focuses without a ring and keeps the item's hover look, as Chrome's
/// emulated :hover after a tap). iPadOS pointer devices take the same path.
let awcSRTouchInput = true
#else
let awcSRTouchInput = false
#endif

/// JS `Math.round`.
@inline(__always) func awcSRJSRound(_ v: Double) -> Double { let r = v.rounded(.down); return v - r >= 0.5 ? r + 1 : r }

/// JS `Number.prototype.toString()` (shortest round-trip, JS exponent rules).
func awcSRJSNumberString(_ v: Double) -> String {
    if v.isNaN { return "NaN" }
    if v.isInfinite { return v < 0 ? "-Infinity" : "Infinity" }
    if v == 0 { return "0" }
    if v == v.rounded(), abs(v) < 1e21 { return String(format: "%.0f", v) }
    // Swift's description is the shortest round-trip representation (same digits as JS).
    var s = "\(v)"
    // Normalise exponent spelling: Swift "1e-07" / "1.5e+22" → JS "1e-7" / "1.5e+22".
    if let eIdx = s.firstIndex(where: { $0 == "e" || $0 == "E" }) {
        let mant = String(s[..<eIdx]); var exp = String(s[s.index(after: eIdx)...])
        let neg = exp.hasPrefix("-"); exp = exp.trimmingCharacters(in: CharacterSet(charactersIn: "+-"))
        let e = Int(exp) ?? 0
        let mantClean = mant.hasSuffix(".0") ? String(mant.dropLast(2)) : mant
        let ev = neg ? -e : e
        // JS uses plain notation for 1e-7 < |v| < 1e21.
        if ev >= -6 && ev < 21 { return awcSRPlainDecimal(mantClean, ev) }
        s = mantClean + "e" + (neg ? "-" : "+") + String(e)
        return s
    }
    if s.hasSuffix(".0") { s.removeLast(2) }
    return s
}

private func awcSRPlainDecimal(_ mantissa: String, _ exp: Int) -> String {
    var neg = false; var m = mantissa
    if m.hasPrefix("-") { neg = true; m.removeFirst() }
    let parts = m.split(separator: ".", omittingEmptySubsequences: false)
    let intPart = String(parts[0]); let frac = parts.count > 1 ? String(parts[1]) : ""
    var digits = intPart + frac
    var point = intPart.count + exp
    while digits.hasPrefix("0") && digits.count > 1 && point > 1 { digits.removeFirst(); point -= 1 }
    var out: String
    if point <= 0 { out = "0." + String(repeating: "0", count: -point) + digits }
    else if point >= digits.count { out = digits + String(repeating: "0", count: point - digits.count) }
    else { out = String(digits.prefix(point)) + "." + String(digits.dropFirst(point)) }
    if out.contains(".") { while out.hasSuffix("0") { out.removeLast() }; if out.hasSuffix(".") { out.removeLast() } }
    return (neg ? "-" : "") + out
}

private let awcSRCSSNamedColors: [String: UInt32] = {
    let table = "aliceblue f0f8ff antiquewhite faebd7 aqua 00ffff aquamarine 7fffd4 azure f0ffff beige f5f5dc bisque ffe4c4 black 000000 blanchedalmond ffebcd blue 0000ff blueviolet 8a2be2 brown a52a2a burlywood deb887 cadetblue 5f9ea0 chartreuse 7fff00 chocolate d2691e coral ff7f50 cornflowerblue 6495ed cornsilk fff8dc crimson dc143c cyan 00ffff darkblue 00008b darkcyan 008b8b darkgoldenrod b8860b darkgray a9a9a9 darkgreen 006400 darkgrey a9a9a9 darkkhaki bdb76b darkmagenta 8b008b darkolivegreen 556b2f darkorange ff8c00 darkorchid 9932cc darkred 8b0000 darksalmon e9967a darkseagreen 8fbc8f darkslateblue 483d8b darkslategray 2f4f4f darkslategrey 2f4f4f darkturquoise 00ced1 darkviolet 9400d3 deeppink ff1493 deepskyblue 00bfff dimgray 696969 dimgrey 696969 dodgerblue 1e90ff firebrick b22222 floralwhite fffaf0 forestgreen 228b22 fuchsia ff00ff gainsboro dcdcdc ghostwhite f8f8ff gold ffd700 goldenrod daa520 gray 808080 green 008000 greenyellow adff2f grey 808080 honeydew f0fff0 hotpink ff69b4 indianred cd5c5c indigo 4b0082 ivory fffff0 khaki f0e68c lavender e6e6fa lavenderblush fff0f5 lawngreen 7cfc00 lemonchiffon fffacd lightblue add8e6 lightcoral f08080 lightcyan e0ffff lightgoldenrodyellow fafad2 lightgray d3d3d3 lightgreen 90ee90 lightgrey d3d3d3 lightpink ffb6c1 lightsalmon ffa07a lightseagreen 20b2aa lightskyblue 87cefa lightslategray 778899 lightslategrey 778899 lightsteelblue b0c4de lightyellow ffffe0 lime 00ff00 limegreen 32cd32 linen faf0e6 magenta ff00ff maroon 800000 mediumaquamarine 66cdaa mediumblue 0000cd mediumorchid ba55d3 mediumpurple 9370db mediumseagreen 3cb371 mediumslateblue 7b68ee mediumspringgreen 00fa9a mediumturquoise 48d1cc mediumvioletred c71585 midnightblue 191970 mintcream f5fffa mistyrose ffe4e1 moccasin ffe4b5 navajowhite ffdead navy 000080 oldlace fdf5e6 olive 808000 olivedrab 6b8e23 orange ffa500 orangered ff4500 orchid da70d6 palegoldenrod eee8aa palegreen 98fb98 paleturquoise afeeee palevioletred db7093 papayawhip ffefd5 peachpuff ffdab9 peru cd853f pink ffc0cb plum dda0dd powderblue b0e0e6 purple 800080 rebeccapurple 663399 red ff0000 rosybrown bc8f8f royalblue 4169e1 saddlebrown 8b4513 salmon fa8072 sandybrown f4a460 seagreen 2e8b57 seashell fff5ee sienna a0522d silver c0c0c0 skyblue 87ceeb slateblue 6a5acd slategray 708090 slategrey 708090 snow fffafa springgreen 00ff7f steelblue 4682b4 tan d2b48c teal 008080 thistle d8bfd8 tomato ff6347 turquoise 40e0d0 violet ee82ee wheat f5deb3 white ffffff whitesmoke f5f5f5 yellow ffff00 yellowgreen 9acd32"
    let parts = table.split(separator: " ")
    var out: [String: UInt32] = [:]
    var i = 0
    while i + 1 < parts.count { out[String(parts[i])] = UInt32(parts[i + 1], radix: 16)!; i += 2 }
    return out
}()

/// JS parseInt(s, 16) on a 2-char slice: NaN when the slice starts with a non-hex character.
private func awcSRHexByte(_ s: Substring) -> Double {
    var value = 0, any = false
    for ch in s { guard let d = ch.hexDigitValue else { break }; value = value * 16 + d; any = true }
    return any ? Double(value) : .nan
}

/// JS parseFloat: leading numeric prefix, NaN if none.
func awcSRJSParseFloat(_ raw: String) -> Double {
    let s = raw.trimmingCharacters(in: .whitespaces)
    var end = s.startIndex, seenDigit = false, seenDot = false, seenE = false
    var i = s.startIndex
    if i < s.endIndex, s[i] == "+" || s[i] == "-" { i = s.index(after: i) }
    if s[i...].hasPrefix("Infinity") { return s.hasPrefix("-") ? -.infinity : .infinity }
    while i < s.endIndex {
        let c = s[i]
        if c.isASCII && c.isNumber { seenDigit = true; end = s.index(after: i) }
        else if c == "." && !seenDot && !seenE { seenDot = true }
        else if (c == "e" || c == "E") && seenDigit && !seenE {
            let n = s.index(after: i)
            var j = n
            if j < s.endIndex, s[j] == "+" || s[j] == "-" { j = s.index(after: j) }
            guard j < s.endIndex, s[j].isASCII, s[j].isNumber else { break }
            seenE = true; i = j; end = s.index(after: j); i = s.index(after: i); continue
        } else { break }
        i = s.index(after: i)
    }
    guard seenDigit else { return .nan }
    return Double(s[s.startIndex..<end]) ?? .nan
}

private func awcSRParseHexOrRgb(_ s: String) -> AWCSRRGBA? {
    if s.hasPrefix("#") {
        var h = String(s.dropFirst())
        if h.count == 3 || h.count == 4 { h = h.map { "\($0)\($0)" }.joined() }
        if h.count < 6 { return nil }
        let a = Array(h)
        let r = awcSRHexByte(Substring(String(a[0...1]))) / 255
        let g = awcSRHexByte(Substring(String(a[2...3]))) / 255
        let b = awcSRHexByte(Substring(String(a[4...5]))) / 255
        let al = h.count >= 8 ? awcSRHexByte(Substring(String(a[6...7]))) / 255 : 1
        if r.isNaN || g.isNaN || b.isNaN { return nil }
        return (r, g, b, al)
    }
    guard s.hasPrefix("rgb"), s.hasSuffix(")") else { return nil }
    let lower = s.lowercased()
    let open: String.Index
    if lower.hasPrefix("rgba(") { open = s.index(s.startIndex, offsetBy: 5) }
    else if lower.hasPrefix("rgb(") { open = s.index(s.startIndex, offsetBy: 4) }
    else { return nil }
    let inner = s[open..<s.index(before: s.endIndex)]
    if inner.isEmpty || inner.contains(")") { return nil }
    let parts = inner.split(whereSeparator: { $0 == " " || $0 == "," || $0 == "/" || $0 == "\t" || $0 == "\n" }).map(String.init)
    if parts.count < 3 { return nil }
    func chan(_ v: String) -> Double { v.hasSuffix("%") ? (awcSRJSParseFloat(v) / 100) * 255 : awcSRJSParseFloat(v) }
    let r = chan(parts[0]) / 255, g = chan(parts[1]) / 255, b = chan(parts[2]) / 255
    var a = 1.0
    if parts.count > 3 { a = parts[3].hasSuffix("%") ? awcSRJSParseFloat(parts[3]) / 100 : awcSRJSParseFloat(parts[3]) }
    return (r, g, b, a.isNaN ? 1 : a)
}

/// Canvas fillStyle normalisation: "#rrggbb" for opaque colours, "rgba(r, g, b, a)" otherwise.
private func awcSRNormalizeColor(_ css: String) -> String? {
    let s = css.trimmingCharacters(in: .whitespaces).lowercased()
    if s == "transparent" { return "rgba(0, 0, 0, 0)" }
    if let v = awcSRCSSNamedColors[s] { return String(format: "#%06x", v) }
    func serialize(_ r: Double, _ g: Double, _ b: Double, _ a: Double) -> String {
        let R = Int(min(255, max(0, awcSRJSRound(r)))), G = Int(min(255, max(0, awcSRJSRound(g)))), B = Int(min(255, max(0, awcSRJSRound(b))))
        let A = min(1, max(0, a))
        if A >= 1 { return String(format: "#%02x%02x%02x", R, G, B) }
        // Chrome stores alpha in 8 bits and prints the shortest decimal that round-trips it.
        let a8 = awcSRJSRound(A * 255)
        var text = awcSRJSNumberString(awcSRJSRound(a8 / 255 * 100) / 100)
        if awcSRJSRound((Double(text) ?? 0) * 255) != a8 { text = awcSRJSNumberString(awcSRJSRound(a8 / 255 * 1000) / 1000) }
        return "rgba(\(R), \(G), \(B), \(text))"
    }
    func args(_ prefixes: [String]) -> [String]? {
        for p in prefixes where s.hasPrefix(p + "(") && s.hasSuffix(")") {
            let inner = s.dropFirst(p.count + 1).dropLast()
            return inner.split(whereSeparator: { $0 == " " || $0 == "," || $0 == "/" }).map(String.init)
        }
        return nil
    }
    func alpha(_ parts: [String]) -> Double {
        guard parts.count > 3 else { return 1 }
        let v = parts[3]; return v.hasSuffix("%") ? awcSRJSParseFloat(v) / 100 : awcSRJSParseFloat(v)
    }
    func hue(_ v: String) -> Double {
        if v.hasSuffix("deg") { return awcSRJSParseFloat(String(v.dropLast(3))) }
        if v.hasSuffix("turn") { return awcSRJSParseFloat(String(v.dropLast(4))) * 360 }
        if v.hasSuffix("grad") { return awcSRJSParseFloat(String(v.dropLast(4))) * 0.9 }
        if v.hasSuffix("rad") { return awcSRJSParseFloat(String(v.dropLast(3))) * 180 / .pi }
        return awcSRJSParseFloat(v)
    }
    if let p = args(["hsl", "hsla"]), p.count >= 3 {
        var h = hue(p[0]).truncatingRemainder(dividingBy: 360); if h < 0 { h += 360 }
        let sat = min(1, max(0, awcSRJSParseFloat(p[1]) / 100)), l = min(1, max(0, awcSRJSParseFloat(p[2]) / 100))
        func f(_ n: Double) -> Double { let k = (n + h / 30).truncatingRemainder(dividingBy: 12); let a = sat * min(l, 1 - l); return l - a * max(-1, min(k - 3, 9 - k, 1)) }
        return serialize(f(0) * 255, f(8) * 255, f(4) * 255, alpha(p))
    }
    if let p = args(["hwb"]), p.count >= 3 {
        var h = hue(p[0]).truncatingRemainder(dividingBy: 360); if h < 0 { h += 360 }
        var w = awcSRJSParseFloat(p[1]) / 100, bl = awcSRJSParseFloat(p[2]) / 100
        if w + bl >= 1 { let g = w / (w + bl); return serialize(g * 255, g * 255, g * 255, alpha(p)) }
        func f(_ n: Double) -> Double { let k = (n + h / 30).truncatingRemainder(dividingBy: 12); return 0.5 - 0.5 * max(-1, min(k - 3, 9 - k, 1)) }
        w = max(0, w); bl = max(0, bl)
        return serialize((f(0) * (1 - w - bl) + w) * 255, (f(8) * (1 - w - bl) + w) * 255, (f(4) * (1 - w - bl) + w) * 255, alpha(p))
    }
    if let p = args(["rgb", "rgba"]), p.count >= 3 {
        func chan(_ v: String) -> Double { v.hasSuffix("%") ? awcSRJSParseFloat(v) / 100 * 255 : awcSRJSParseFloat(v) }
        let r = chan(p[0]), g = chan(p[1]), b = chan(p[2])
        if r.isNaN || g.isNaN || b.isNaN { return nil }
        return serialize(r, g, b, alpha(p))
    }
    if s.hasPrefix("#") {
        let h = s.dropFirst()
        guard [3, 4, 6, 8].contains(h.count), h.allSatisfy({ $0.isHexDigit }) else { return nil }
        if let c = awcSRParseHexOrRgb(s) { return serialize(c.0 * 255, c.1 * 255, c.2 * 255, c.3) }
    }
    return nil
}

func awcSRParseColor(_ css: String) -> AWCSRRGBA {
    let s = css.trimmingCharacters(in: .whitespacesAndNewlines)
    if let direct = awcSRParseHexOrRgb(s) { return direct }
    if let norm = awcSRNormalizeColor(s), let parsed = awcSRParseHexOrRgb(norm) { return parsed }
    return (0.5, 0.5, 0.5, 1)
}

/// animate.ts `cubicBezier` (Newton then bisection, same iteration counts).
func awcSRCubicBezier(_ x1: Double, _ y1: Double, _ x2: Double, _ y2: Double) -> (Double) -> Double {
    let cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx
    let cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by
    func sampleX(_ t: Double) -> Double { ((ax * t + bx) * t + cx) * t }
    func sampleY(_ t: Double) -> Double { ((ay * t + by) * t + cy) * t }
    func slopeX(_ t: Double) -> Double { (3 * ax * t + 2 * bx) * t + cx }
    return { x in
        if x <= 0 { return 0 }
        if x >= 1 { return 1 }
        var t = x
        for _ in 0..<8 {
            let err = sampleX(t) - x
            if abs(err) < 1e-6 { return sampleY(t) }
            let d = slopeX(t)
            if abs(d) < 1e-6 { break }
            t -= err / d
        }
        var lo = 0.0, hi = 1.0
        t = x
        for _ in 0..<24 {
            let err = sampleX(t) - x
            if abs(err) < 1e-6 { break }
            if err > 0 { hi = t } else { lo = t }
            t = (lo + hi) / 2
        }
        return sampleY(t)
    }
}

func awcSRToken(_ tokens: [String: String], _ name: String, _ fallback: String) -> String {
    let v = (tokens[name] ?? "").trimmingCharacters(in: .whitespaces)
    return v.isEmpty ? fallback : v
}

func awcSRNumberToken(_ tokens: [String: String], _ name: String, _ fallback: Double) -> Double {
    let raw = (tokens[name] ?? "").trimmingCharacters(in: .whitespaces)
    if raw.isEmpty { return fallback }
    let n = awcSRJSParseFloat(raw)
    return n.isFinite ? n : fallback
}

struct AWCSRTextMetrics {
    /// Width of `text` in the chart font (Roboto, CSS weight matching against 400/500/700).
    static func width(_ text: String, size: Double, weight: Double = 400) -> Double {
        let font = awcSRCTFont(size: size, weight: weight)
        let attr = NSAttributedString(string: text, attributes: [NSAttributedString.Key(kCTFontAttributeName as String): font])
        let line = CTLineCreateWithAttributedString(attr)
        return CTLineGetTypographicBounds(line, nil, nil, nil)
    }
    /// CSS `line-height: normal` for the chart font.
    static func normalLineHeight(size: Double, weight: Double = 400) -> Double {
        let f = awcSRCTFont(size: size, weight: weight)
        return CTFontGetAscent(f) + CTFontGetDescent(f) + CTFontGetLeading(f)
    }
}

/// CSS font matching with Roboto 400/500/700 installed (what the reference pages load).
func awcSRFontName(weight: Double) -> String {
    if weight > 500 { return "Roboto-Bold" }
    if weight > 400 { return "Roboto-Medium" }
    return "Roboto-Regular"
}

func awcSRCTFont(size: Double, weight: Double) -> CTFont {
    _ = AWCNativeFonts.labelFamily(regular: true) // registers the bundled Roboto files
    return CTFontCreateWithName(awcSRFontName(weight: weight) as CFString, size, nil)
}

/// CSS `<length>` in px (px, plain numbers); nil for anything else.
func awcSRCSSPixels(_ raw: String?) -> Double? {
    guard var s = raw?.trimmingCharacters(in: .whitespaces), !s.isEmpty else { return nil }
    if s.hasSuffix("px") { s.removeLast(2) }
    let n = awcSRJSParseFloat(s)
    return n.isFinite ? n : nil
}

/// `#RRGGBB` (or `#RRGGBBAA` when translucent) for an inspected colour.
func awcSRHex(_ c: AWCSRRGBA) -> String {
    func b(_ v: Double) -> String { String(format: "%02X", Int((min(1, max(0, v)) * 255).rounded())) }
    return "#" + b(c.0) + b(c.1) + b(c.2) + (c.3 < 1 ? b(c.3) : "")
}

/// The hook text of an appearance, by hook suffix, from typed values (lengths in points = CSS px, durations in ms).
struct AWCSRHookText {
    var css: [String: String] = [:]
    static func number(_ v: Double) -> String { !v.isFinite ? "invalid" : v == v.rounded() && abs(v) < 1e15 ? String(Int64(v)) : String(v) }
    mutating func text(_ suffix: String, _ v: String?) { if let v { css[suffix] = v } }
    mutating func px(_ suffix: String, _ v: Double?) { if let v { css[suffix] = v.isFinite ? Self.number(v) + "px" : "invalid" } }
    mutating func plain(_ suffix: String, _ v: Double?) { if let v { css[suffix] = Self.number(v) } }
    mutating func ms(_ suffix: String, _ v: Double?) { if let v { css[suffix] = v.isFinite ? Self.number(v) + "ms" : "invalid" } }
}

/// The effective custom properties a component reads: theme tokens, then the appearance hooks (full names), then the
/// custom properties of the host's inline `style` (the nearest declaration).
func awcSREffectiveTokens(_ tokens: [String: String], hooks: [String: String], style: String?) -> [String: String] {
    var out = tokens
    for (k, v) in hooks { out[k] = v }
    for part in (style ?? "").split(separator: ";") {
        let kv = part.split(separator: ":", maxSplits: 1).map { $0.trimmingCharacters(in: .whitespaces) }
        if kv.count == 2, kv[0].hasPrefix("--") { out[kv[0]] = kv[1] }
    }
    return out
}
