import CoreGraphics
import Foundation

/// SVG images (`image/svg+xml`) where the platform has no public decoder (UIKit: `UIImage(data:)` declines SVG; ImageIO
/// does not read it), rasterised at 4× their intrinsic size — the Swift counterpart of the Compose `AWCSvgRaster`: the static
/// shape subset avatars use — rect (rx/ry), circle, ellipse, line, polyline, polygon and path (every command, arcs included),
/// nested `<g>` with inherited fill/stroke/opacity and translate/scale/rotate/matrix transforms, viewBox, hex/rgb()/named
/// colours. Anything it cannot parse fails the image like a broken one.
enum AWCSvgRaster {
    static let scale: CGFloat = 4

    static func decode(_ data: Data) -> CGImage? {
        guard let text = String(data: data, encoding: .utf8), text.contains("<svg") else { return nil }
        let renderer = Renderer(); let parser = XMLParser(data: data); parser.delegate = renderer
        guard parser.parse(), !renderer.failed else { return nil }
        return renderer.context?.makeImage()
    }

    private struct Style { var fill: CGColor?; var stroke: CGColor?; var strokeWidth: CGFloat; var opacity: CGFloat }

    private final class Renderer: NSObject, XMLParserDelegate {
        var context: CGContext?; var failed = false
        private var styles: [Style] = []
        func parser(_ parser: XMLParser, didStartElement name: String, namespaceURI: String?, qualifiedName: String?, attributes a: [String: String] = [:]) {
            if failed { return }
            let inherited = styles.last ?? Style(fill: CGColor(srgbRed: 0, green: 0, blue: 0, alpha: 1), stroke: nil, strokeWidth: 1, opacity: 1)
            var css: [String: String] = [:]
            for d in (a["style"] ?? "").split(separator: ";") { let kv = d.split(separator: ":", maxSplits: 1); if kv.count == 2 { css[kv[0].trimmingCharacters(in: .whitespaces)] = kv[1].trimmingCharacters(in: .whitespaces) } }
            func prop(_ n: String) -> String? { css[n] ?? a[n] }
            let opacity = min(1, max(0, prop("opacity").flatMap(Double.init).map { CGFloat($0) } ?? 1))
            func paint(_ n: String, _ base: CGColor?) -> CGColor? {
                guard let v = prop(n) else { return base }
                if v == "none" || v == "transparent" { return nil }
                return AWCSvgRaster.color(v) ?? base
            }
            var fill = paint("fill", inherited.fill), stroke = paint("stroke", inherited.stroke)
            if let o = prop("fill-opacity").flatMap(Double.init) { fill = fill.map { $0.copy(alpha: $0.alpha * CGFloat(o)) ?? $0 } }
            if let o = prop("stroke-opacity").flatMap(Double.init) { stroke = stroke.map { $0.copy(alpha: $0.alpha * CGFloat(o)) ?? $0 } }
            let style = Style(fill: fill, stroke: stroke, strokeWidth: prop("stroke-width").flatMap(AWCSvgRaster.len) ?? inherited.strokeWidth, opacity: inherited.opacity * opacity)
            if name == "svg" && context == nil {
                let vb = a["viewBox"].map { $0.split(whereSeparator: { $0 == " " || $0 == "," || $0 == "\n" || $0 == "\t" }).compactMap { Double($0).map { CGFloat($0) } } }.flatMap { $0.count == 4 ? $0 : nil }
                let w = a["width"].flatMap(AWCSvgRaster.len) ?? vb?[2] ?? 150, h = a["height"].flatMap(AWCSvgRaster.len) ?? vb?[3] ?? 150
                guard w > 0, h > 0, w * h * AWCSvgRaster.scale * AWCSvgRaster.scale <= 64e6,
                      let ctx = CGContext(data: nil, width: max(1, Int((w * AWCSvgRaster.scale).rounded())), height: max(1, Int((h * AWCSvgRaster.scale).rounded())), bitsPerComponent: 8, bytesPerRow: 0,
                                          space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { failed = true; return }
                // SVG user space is y-down: flip, then the intrinsic scale and the viewBox mapping.
                ctx.translateBy(x: 0, y: CGFloat(ctx.height)); ctx.scaleBy(x: AWCSvgRaster.scale, y: -AWCSvgRaster.scale)
                if let vb { ctx.scaleBy(x: w / vb[2], y: h / vb[3]); ctx.translateBy(x: -vb[0], y: -vb[1]) }
                context = ctx
            }
            guard let c = context else { failed = true; return }
            c.saveGState(); AWCSvgRaster.transform(c, a["transform"]); styles.append(style)
            func n(_ k: String) -> CGFloat { a[k].flatMap(AWCSvgRaster.len) ?? 0 }
            let path = CGMutablePath()
            switch name {
            case "rect":
                let x = n("x"), y = n("y"), w = n("width"), h = n("height")
                var rx = a["rx"].flatMap(AWCSvgRaster.len), ry = a["ry"].flatMap(AWCSvgRaster.len); if rx == nil { rx = ry }; if ry == nil { ry = rx }
                let r = CGRect(x: x, y: y, width: w, height: h), cw = min(rx ?? 0, w / 2), ch = min(ry ?? 0, h / 2)
                if cw > 0 && ch > 0 { path.addRoundedRect(in: r, cornerWidth: cw, cornerHeight: ch) } else { path.addRect(r) }
            case "circle": let r = n("r"); path.addEllipse(in: CGRect(x: n("cx") - r, y: n("cy") - r, width: 2 * r, height: 2 * r))
            case "ellipse": let rx = n("rx"), ry = n("ry"); path.addEllipse(in: CGRect(x: n("cx") - rx, y: n("cy") - ry, width: 2 * rx, height: 2 * ry))
            case "line": path.move(to: CGPoint(x: n("x1"), y: n("y1"))); path.addLine(to: CGPoint(x: n("x2"), y: n("y2")))
            case "polyline", "polygon":
                let v = (a["points"] ?? "").split(whereSeparator: { $0 == " " || $0 == "," || $0 == "\n" || $0 == "\t" }).compactMap { Double($0).map { CGFloat($0) } }
                for i in 0..<(v.count / 2) { let p = CGPoint(x: v[2 * i], y: v[2 * i + 1]); if i == 0 { path.move(to: p) } else { path.addLine(to: p) } }
                if name == "polygon" && v.count >= 2 { path.closeSubpath() }
            case "path": AWCSvgRaster.pathData(a["d"] ?? "", path)
            default: return
            }
            if path.isEmpty { return }
            if name != "line", let f = style.fill { c.addPath(path); c.setFillColor(f.copy(alpha: f.alpha * style.opacity) ?? f); c.fillPath() }
            if let s = style.stroke { c.addPath(path); c.setStrokeColor(s.copy(alpha: s.alpha * style.opacity) ?? s); c.setLineWidth(style.strokeWidth); c.strokePath() }
        }
        func parser(_ parser: XMLParser, didEndElement name: String, namespaceURI: String?, qualifiedName: String?) {
            guard !failed, context != nil, !styles.isEmpty else { return }
            styles.removeLast(); context?.restoreGState()
        }
        func parser(_ parser: XMLParser, parseErrorOccurred error: Error) { failed = true }
    }

    private static func len(_ v: String) -> CGFloat? {
        var s = v.trimmingCharacters(in: .whitespaces); if s.hasSuffix("px") { s.removeLast(2) }
        return Double(s).map { CGFloat($0) }
    }
    private static let named: [String: UInt32] = ["black": 0x000000, "white": 0xFFFFFF, "red": 0xFF0000, "green": 0x008000, "blue": 0x0000FF, "gray": 0x808080, "grey": 0x808080,
        "yellow": 0xFFFF00, "orange": 0xFFA500, "purple": 0x800080, "teal": 0x008080, "navy": 0x000080, "silver": 0xC0C0C0, "maroon": 0x800000]
    private static func rgb(_ v: UInt32, _ alpha: CGFloat) -> CGColor {
        CGColor(srgbRed: CGFloat((v >> 16) & 0xFF) / 255, green: CGFloat((v >> 8) & 0xFF) / 255, blue: CGFloat(v & 0xFF) / 255, alpha: alpha)
    }
    static func color(_ v: String) -> CGColor? {
        let s = v.trimmingCharacters(in: .whitespaces).lowercased()
        if s.hasPrefix("#") {
            var h = String(s.dropFirst()); if h.count == 3 || h.count == 4 { h = h.map { "\($0)\($0)" }.joined() }
            guard let n = UInt32(h, radix: 16) else { return nil }
            if h.count == 6 { return rgb(n, 1) }
            if h.count == 8 { return rgb(n >> 8, CGFloat(n & 0xFF) / 255) }
            return nil
        }
        if s.hasPrefix("rgb"), let open = s.firstIndex(of: "("), let close = s.firstIndex(of: ")") {
            let parts = s[s.index(after: open)..<close].split(whereSeparator: { $0 == " " || $0 == "," || $0 == "/" }).map(String.init)
            guard parts.count >= 3 else { return nil }
            func ch(_ x: String) -> CGFloat? { x.hasSuffix("%") ? Double(x.dropLast()).map { CGFloat(($0 * 2.55).rounded()) } : Double(x).map { CGFloat($0.rounded()) } }
            guard let r = ch(parts[0]), let g = ch(parts[1]), let b = ch(parts[2]) else { return nil }
            let alpha = parts.count > 3 ? (parts[3].hasSuffix("%") ? Double(parts[3].dropLast()).map { $0 / 100 } : Double(parts[3])) ?? 1 : 1
            let clamp = { (x: CGFloat) in min(255, max(0, x)) / 255 }
            return CGColor(srgbRed: clamp(r), green: clamp(g), blue: clamp(b), alpha: min(1, max(0, CGFloat(alpha))))
        }
        return named[s].map { rgb($0, 1) }
    }
    private static func transform(_ c: CGContext, _ t: String?) {
        guard let t, let re = try? NSRegularExpression(pattern: "(translate|scale|rotate|matrix)\\(([^)]*)\\)") else { return }
        for m in re.matches(in: t, range: NSRange(t.startIndex..., in: t)) {
            guard let kr = Range(m.range(at: 1), in: t), let ar = Range(m.range(at: 2), in: t) else { continue }
            let v = t[ar].split(whereSeparator: { $0 == " " || $0 == "," }).compactMap { Double($0).map { CGFloat($0) } }
            func at(_ i: Int, _ d: CGFloat) -> CGFloat { i < v.count ? v[i] : d }
            switch t[kr] {
            case "translate": c.translateBy(x: at(0, 0), y: at(1, 0))
            case "scale": c.scaleBy(x: at(0, 1), y: at(1, at(0, 1)))
            case "rotate": c.translateBy(x: at(1, 0), y: at(2, 0)); c.rotate(by: at(0, 0) * .pi / 180); c.translateBy(x: -at(1, 0), y: -at(2, 0))
            case "matrix": if v.count == 6 { c.concatenate(CGAffineTransform(a: v[0], b: v[1], c: v[2], d: v[3], tx: v[4], ty: v[5])) }
            default: break
            }
        }
    }
    /// SVG path data: M L H V C S Q T A Z, absolute and relative.
    private static func pathData(_ d: String, _ path: CGMutablePath) {
        guard let re = try? NSRegularExpression(pattern: "[MmLlHhVvCcSsQqTtAaZz]|-?(?:\\d+\\.?\\d*|\\.\\d+)(?:[eE][-+]?\\d+)?") else { return }
        let tokens = re.matches(in: d, range: NSRange(d.startIndex..., in: d)).compactMap { Range($0.range, in: d).map { String(d[$0]) } }
        var i = 0, cmd: Character = "M", prev: Character = " "
        var x: CGFloat = 0, y: CGFloat = 0, sx: CGFloat = 0, sy: CGFloat = 0, cx: CGFloat = 0, cy: CGFloat = 0
        func num() -> CGFloat { defer { i += 1 }; return i < tokens.count ? CGFloat(Double(tokens[i]) ?? 0) : 0 }
        while i < tokens.count {
            if let f = tokens[i].first, f.isLetter { cmd = f; i += 1 }
            let rel = cmd.isLowercase, ox = rel ? x : 0, oy = rel ? y : 0
            switch Character(cmd.uppercased()) {
            case "M": x = ox + num(); y = oy + num(); path.move(to: CGPoint(x: x, y: y)); sx = x; sy = y; cmd = rel ? "l" : "L"
            case "L": x = ox + num(); y = oy + num(); path.addLine(to: CGPoint(x: x, y: y))
            case "H": x = ox + num(); path.addLine(to: CGPoint(x: x, y: y))
            case "V": y = oy + num(); path.addLine(to: CGPoint(x: x, y: y))
            case "C":
                let x1 = ox + num(), y1 = oy + num(); cx = ox + num(); cy = oy + num(); x = ox + num(); y = oy + num()
                path.addCurve(to: CGPoint(x: x, y: y), control1: CGPoint(x: x1, y: y1), control2: CGPoint(x: cx, y: cy))
            case "S":
                let smooth = "CcSs".contains(prev), x1 = smooth ? 2 * x - cx : x, y1 = smooth ? 2 * y - cy : y
                cx = ox + num(); cy = oy + num(); x = ox + num(); y = oy + num()
                path.addCurve(to: CGPoint(x: x, y: y), control1: CGPoint(x: x1, y: y1), control2: CGPoint(x: cx, y: cy))
            case "Q": cx = ox + num(); cy = oy + num(); x = ox + num(); y = oy + num(); path.addQuadCurve(to: CGPoint(x: x, y: y), control: CGPoint(x: cx, y: cy))
            case "T":
                let smooth = "QqTt".contains(prev); cx = smooth ? 2 * x - cx : x; cy = smooth ? 2 * y - cy : y
                x = ox + num(); y = oy + num(); path.addQuadCurve(to: CGPoint(x: x, y: y), control: CGPoint(x: cx, y: cy))
            case "A":
                let rx = abs(num()), ry = abs(num()), rot = num(), large = num() != 0, sweep = num() != 0, x2 = ox + num(), y2 = oy + num()
                arc(path, x, y, x2, y2, rx, ry, rot, large, sweep); x = x2; y = y2
            case "Z": path.closeSubpath(); x = sx; y = sy
            default: i += 1
            }
            prev = cmd
        }
    }
    /// Endpoint → centre parameterisation (SVG implementation notes F.6.5), drawn as a unit-circle arc mapped by
    /// scale(rx, ry) · rotate(φ) · translate(centre).
    private static func arc(_ path: CGMutablePath, _ x1: CGFloat, _ y1: CGFloat, _ x2: CGFloat, _ y2: CGFloat, _ rx0: CGFloat, _ ry0: CGFloat, _ deg: CGFloat, _ large: Bool, _ sweep: Bool) {
        if rx0 == 0 || ry0 == 0 { path.addLine(to: CGPoint(x: x2, y: y2)); return }
        let phi = Double(deg) * .pi / 180, cp = cos(phi), sp = sin(phi)
        let dx = Double(x1 - x2) / 2, dy = Double(y1 - y2) / 2, x1p = cp * dx + sp * dy, y1p = -sp * dx + cp * dy
        var rx = Double(rx0), ry = Double(ry0); let lam = x1p * x1p / (rx * rx) + y1p * y1p / (ry * ry); if lam > 1 { rx *= lam.squareRoot(); ry *= lam.squareRoot() }
        let num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p, den = rx * rx * y1p * y1p + ry * ry * x1p * x1p
        let coef = (large == sweep ? -1.0 : 1.0) * max(0, num / den).squareRoot(), cxp = coef * rx * y1p / ry, cyp = -coef * ry * x1p / rx
        let cx = cp * cxp - sp * cyp + Double(x1 + x2) / 2, cy = sp * cxp + cp * cyp + Double(y1 + y2) / 2
        func ang(_ ux: Double, _ uy: Double, _ vx: Double, _ vy: Double) -> Double { atan2(ux * vy - uy * vx, ux * vx + uy * vy) }
        let t1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry); var dt = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry)
        if !sweep && dt > 0 { dt -= 2 * .pi } else if sweep && dt < 0 { dt += 2 * .pi }
        let map = CGAffineTransform(translationX: CGFloat(cx), y: CGFloat(cy)).rotated(by: CGFloat(phi)).scaledBy(x: CGFloat(rx), y: CGFloat(ry))
        path.addRelativeArc(center: .zero, radius: 1, startAngle: CGFloat(t1), delta: CGFloat(dt), transform: map)
    }
}
