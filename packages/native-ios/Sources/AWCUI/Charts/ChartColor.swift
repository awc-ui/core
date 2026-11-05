import Foundation

// Port of engine/color.ts plus the canvas `fillStyle` normalisation the Web engine relies on
// (named colours, hsl()/hwb(), modern rgb() syntax → 8-bit sRGB), and JS number formatting.

typealias AWCChartRGBA = (Double, Double, Double, Double)

/// JS `Number.prototype.toString()` (shortest round-trip, JS exponent rules).
func awcJSNumberString(_ v: Double) -> String {
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
        if ev >= -6 && ev < 21 { return awcPlainDecimal(mantClean, ev) }
        s = mantClean + "e" + (neg ? "-" : "+") + String(e)
        return s
    }
    if s.hasSuffix(".0") { s.removeLast(2) }
    return s
}

private func awcPlainDecimal(_ mantissa: String, _ exp: Int) -> String {
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

private let awcCSSNamedColors: [String: UInt32] = {
    let table = "aliceblue f0f8ff antiquewhite faebd7 aqua 00ffff aquamarine 7fffd4 azure f0ffff beige f5f5dc bisque ffe4c4 black 000000 blanchedalmond ffebcd blue 0000ff blueviolet 8a2be2 brown a52a2a burlywood deb887 cadetblue 5f9ea0 chartreuse 7fff00 chocolate d2691e coral ff7f50 cornflowerblue 6495ed cornsilk fff8dc crimson dc143c cyan 00ffff darkblue 00008b darkcyan 008b8b darkgoldenrod b8860b darkgray a9a9a9 darkgreen 006400 darkgrey a9a9a9 darkkhaki bdb76b darkmagenta 8b008b darkolivegreen 556b2f darkorange ff8c00 darkorchid 9932cc darkred 8b0000 darksalmon e9967a darkseagreen 8fbc8f darkslateblue 483d8b darkslategray 2f4f4f darkslategrey 2f4f4f darkturquoise 00ced1 darkviolet 9400d3 deeppink ff1493 deepskyblue 00bfff dimgray 696969 dimgrey 696969 dodgerblue 1e90ff firebrick b22222 floralwhite fffaf0 forestgreen 228b22 fuchsia ff00ff gainsboro dcdcdc ghostwhite f8f8ff gold ffd700 goldenrod daa520 gray 808080 green 008000 greenyellow adff2f grey 808080 honeydew f0fff0 hotpink ff69b4 indianred cd5c5c indigo 4b0082 ivory fffff0 khaki f0e68c lavender e6e6fa lavenderblush fff0f5 lawngreen 7cfc00 lemonchiffon fffacd lightblue add8e6 lightcoral f08080 lightcyan e0ffff lightgoldenrodyellow fafad2 lightgray d3d3d3 lightgreen 90ee90 lightgrey d3d3d3 lightpink ffb6c1 lightsalmon ffa07a lightseagreen 20b2aa lightskyblue 87cefa lightslategray 778899 lightslategrey 778899 lightsteelblue b0c4de lightyellow ffffe0 lime 00ff00 limegreen 32cd32 linen faf0e6 magenta ff00ff maroon 800000 mediumaquamarine 66cdaa mediumblue 0000cd mediumorchid ba55d3 mediumpurple 9370db mediumseagreen 3cb371 mediumslateblue 7b68ee mediumspringgreen 00fa9a mediumturquoise 48d1cc mediumvioletred c71585 midnightblue 191970 mintcream f5fffa mistyrose ffe4e1 moccasin ffe4b5 navajowhite ffdead navy 000080 oldlace fdf5e6 olive 808000 olivedrab 6b8e23 orange ffa500 orangered ff4500 orchid da70d6 palegoldenrod eee8aa palegreen 98fb98 paleturquoise afeeee palevioletred db7093 papayawhip ffefd5 peachpuff ffdab9 peru cd853f pink ffc0cb plum dda0dd powderblue b0e0e6 purple 800080 rebeccapurple 663399 red ff0000 rosybrown bc8f8f royalblue 4169e1 saddlebrown 8b4513 salmon fa8072 sandybrown f4a460 seagreen 2e8b57 seashell fff5ee sienna a0522d silver c0c0c0 skyblue 87ceeb slateblue 6a5acd slategray 708090 slategrey 708090 snow fffafa springgreen 00ff7f steelblue 4682b4 tan d2b48c teal 008080 thistle d8bfd8 tomato ff6347 turquoise 40e0d0 violet ee82ee wheat f5deb3 white ffffff whitesmoke f5f5f5 yellow ffff00 yellowgreen 9acd32"
    let parts = table.split(separator: " ")
    var out: [String: UInt32] = [:]
    var i = 0
    while i + 1 < parts.count { out[String(parts[i])] = UInt32(parts[i + 1], radix: 16)!; i += 2 }
    return out
}()

/// JS parseInt(s, 16) on a 2-char slice: NaN when the slice starts with a non-hex character.
private func awcHexByte(_ s: Substring) -> Double {
    var value = 0, any = false
    for ch in s { guard let d = ch.hexDigitValue else { break }; value = value * 16 + d; any = true }
    return any ? Double(value) : .nan
}

/// JS parseFloat: leading numeric prefix, NaN if none.
func awcJSParseFloat(_ raw: String) -> Double {
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

private func awcParseHexOrRgb(_ s: String) -> AWCChartRGBA? {
    if s.hasPrefix("#") {
        var h = String(s.dropFirst())
        if h.count == 3 || h.count == 4 { h = h.map { "\($0)\($0)" }.joined() }
        if h.count < 6 { return nil }
        let a = Array(h)
        let r = awcHexByte(Substring(String(a[0...1]))) / 255
        let g = awcHexByte(Substring(String(a[2...3]))) / 255
        let b = awcHexByte(Substring(String(a[4...5]))) / 255
        let al = h.count >= 8 ? awcHexByte(Substring(String(a[6...7]))) / 255 : 1
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
    func chan(_ v: String) -> Double { v.hasSuffix("%") ? (awcJSParseFloat(v) / 100) * 255 : awcJSParseFloat(v) }
    let r = chan(parts[0]) / 255, g = chan(parts[1]) / 255, b = chan(parts[2]) / 255
    var a = 1.0
    if parts.count > 3 { a = parts[3].hasSuffix("%") ? awcJSParseFloat(parts[3]) / 100 : awcJSParseFloat(parts[3]) }
    return (r, g, b, a.isNaN ? 1 : a)
}

/// Canvas fillStyle normalisation: "#rrggbb" for opaque colours, "rgba(r, g, b, a)" otherwise.
private func awcNormalizeColor(_ css: String) -> String? {
    let s = css.trimmingCharacters(in: .whitespaces).lowercased()
    if s == "transparent" { return "rgba(0, 0, 0, 0)" }
    if let v = awcCSSNamedColors[s] { return String(format: "#%06x", v) }
    func serialize(_ r: Double, _ g: Double, _ b: Double, _ a: Double) -> String {
        let R = Int(min(255, max(0, awcJSRound(r)))), G = Int(min(255, max(0, awcJSRound(g)))), B = Int(min(255, max(0, awcJSRound(b))))
        let A = min(1, max(0, a))
        if A >= 1 { return String(format: "#%02x%02x%02x", R, G, B) }
        // Chrome stores alpha in 8 bits and prints the shortest decimal that round-trips it.
        let a8 = awcJSRound(A * 255)
        var text = awcJSNumberString(awcJSRound(a8 / 255 * 100) / 100)
        if awcJSRound((Double(text) ?? 0) * 255) != a8 { text = awcJSNumberString(awcJSRound(a8 / 255 * 1000) / 1000) }
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
        let v = parts[3]; return v.hasSuffix("%") ? awcJSParseFloat(v) / 100 : awcJSParseFloat(v)
    }
    func hue(_ v: String) -> Double {
        if v.hasSuffix("deg") { return awcJSParseFloat(String(v.dropLast(3))) }
        if v.hasSuffix("turn") { return awcJSParseFloat(String(v.dropLast(4))) * 360 }
        if v.hasSuffix("grad") { return awcJSParseFloat(String(v.dropLast(4))) * 0.9 }
        if v.hasSuffix("rad") { return awcJSParseFloat(String(v.dropLast(3))) * 180 / .pi }
        return awcJSParseFloat(v)
    }
    if let p = args(["hsl", "hsla"]), p.count >= 3 {
        var h = hue(p[0]).truncatingRemainder(dividingBy: 360); if h < 0 { h += 360 }
        let sat = min(1, max(0, awcJSParseFloat(p[1]) / 100)), l = min(1, max(0, awcJSParseFloat(p[2]) / 100))
        func f(_ n: Double) -> Double { let k = (n + h / 30).truncatingRemainder(dividingBy: 12); let a = sat * min(l, 1 - l); return l - a * max(-1, min(k - 3, 9 - k, 1)) }
        return serialize(f(0) * 255, f(8) * 255, f(4) * 255, alpha(p))
    }
    if let p = args(["hwb"]), p.count >= 3 {
        var h = hue(p[0]).truncatingRemainder(dividingBy: 360); if h < 0 { h += 360 }
        var w = awcJSParseFloat(p[1]) / 100, bl = awcJSParseFloat(p[2]) / 100
        if w + bl >= 1 { let g = w / (w + bl); return serialize(g * 255, g * 255, g * 255, alpha(p)) }
        func f(_ n: Double) -> Double { let k = (n + h / 30).truncatingRemainder(dividingBy: 12); return 0.5 - 0.5 * max(-1, min(k - 3, 9 - k, 1)) }
        w = max(0, w); bl = max(0, bl)
        return serialize((f(0) * (1 - w - bl) + w) * 255, (f(8) * (1 - w - bl) + w) * 255, (f(4) * (1 - w - bl) + w) * 255, alpha(p))
    }
    if let p = args(["rgb", "rgba"]), p.count >= 3 {
        func chan(_ v: String) -> Double { v.hasSuffix("%") ? awcJSParseFloat(v) / 100 * 255 : awcJSParseFloat(v) }
        let r = chan(p[0]), g = chan(p[1]), b = chan(p[2])
        if r.isNaN || g.isNaN || b.isNaN { return nil }
        return serialize(r, g, b, alpha(p))
    }
    if s.hasPrefix("#") {
        let h = s.dropFirst()
        guard [3, 4, 6, 8].contains(h.count), h.allSatisfy({ $0.isHexDigit }) else { return nil }
        if let c = awcParseHexOrRgb(s) { return serialize(c.0 * 255, c.1 * 255, c.2 * 255, c.3) }
    }
    return nil
}

func awcChartParseColor(_ css: String) -> AWCChartRGBA {
    let s = css.trimmingCharacters(in: .whitespacesAndNewlines)
    if let direct = awcParseHexOrRgb(s) { return direct }
    if let norm = awcNormalizeColor(s), let parsed = awcParseHexOrRgb(norm) { return parsed }
    return (0.5, 0.5, 0.5, 1)
}

func awcChartWithAlpha(_ css: String, _ factor: Double) -> String {
    let (r, g, b, a) = awcChartParseColor(css)
    let alpha = awcJSRound(a * factor * 1000) / 1000
    return "rgba(\(Int(awcJSRound(r * 255))), \(Int(awcJSRound(g * 255))), \(Int(awcJSRound(b * 255))), \(awcJSNumberString(alpha)))"
}

func awcChartOnColor(_ fill: String) -> String {
    let (r, g, b, _) = awcChartParseColor(fill)
    return 0.299 * r + 0.587 * g + 0.114 * b > 0.62 ? "#000000" : "#ffffff"
}

func awcChartMixColor(_ css: String, _ target: String, _ amount: Double) -> String {
    let a = awcChartParseColor(css), b = awcChartParseColor(target)
    let t = max(0, min(1, amount))
    func ch(_ x: Double, _ y: Double) -> Int { Int(awcJSRound((x + (y - x) * t) * 255)) }
    return "rgba(\(ch(a.0, b.0)), \(ch(a.1, b.1)), \(ch(a.2, b.2)), \(awcJSNumberString(a.3)))"
}

/// layout.ts `hexToRgba` (only #hex and rgb() are rewritten; anything else passes through).
func awcChartHexToRgba(_ color: String, _ alpha: Double) -> String {
    if color.hasPrefix("#") {
        var hex = String(color.dropFirst())
        if hex.count == 3 { hex = hex.map { "\($0)\($0)" }.joined() }
        let a = Array(hex)
        func byte(_ i: Int) -> String { guard a.count >= i + 2 else { return a.count > i ? jsIntString(awcHexByte(Substring(String(a[i...])))) : "NaN" }; return jsIntString(awcHexByte(Substring(String(a[i...(i + 1)])))) }
        return "rgba(\(byte(0)), \(byte(2)), \(byte(4)), \(awcJSNumberString(alpha)))"
    }
    if color.hasPrefix("rgb(") { return color.hasSuffix(")") ? "rgba(" + color.dropFirst(4).dropLast() + ", \(awcJSNumberString(alpha)))" : "rgba(" + color.dropFirst(4) }
    return color
}

private func jsIntString(_ v: Double) -> String { awcJSNumberString(v) }
