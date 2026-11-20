import SwiftUI
import ImageIO
#if canImport(AppKit)
import AppKit
#else
import UIKit
#endif

// MARK: Source logic (md-avatar.tsx)

/// Identity resolution shared by the renderer and tests: fallback chain, initials,
/// tonal palette bucket and accessible label, exactly as the source computes them.
public enum AWCAvatarIdentity {
    /// Explicit initials (trimmed, first three grapheme clusters) or name-derived initials
    /// (first grapheme of the first and last whitespace-separated tokens), uppercased in
    /// the current locale like `toLocaleUpperCase()`. A whitespace-only override is unset.
    public static func initials(initials: String, name: String, locale: Locale = .current) -> String {
        let explicit = initials.trimmingCharacters(in: .whitespacesAndNewlines)
        if !explicit.isEmpty { return String(explicit.prefix(3)).uppercased(with: locale) }
        let tokens = name.split(whereSeparator: { $0.isWhitespace }).map(String.init)
        guard let first = tokens.first?.first else { return "" }
        if tokens.count == 1 { return String(first).uppercased(with: locale) }
        return (String(first) + String(tokens.last!.first!)).uppercased(with: locale)
    }
    /// 1…7, or 0 for the neutral tone. Seeds hash their UTF-16 code units with JavaScript
    /// int32 arithmetic (`h = (h << 5) - h + c | 0`, then `Math.abs`).
    public static func palette(initials: String, name: String, label: String, colorFromName: Bool) -> Int {
        guard colorFromName else { return 0 }
        let trim = { (s: String) in s.trimmingCharacters(in: .whitespacesAndNewlines) }
        let seed = [trim(initials), trim(name), trim(label)].first { !$0.isEmpty } ?? ""
        guard !seed.isEmpty else { return 0 }
        var h: Int32 = 0
        for unit in seed.utf16 { h = (h &<< 5) &- h &+ Int32(unit) }
        return Int(Int64(h).magnitude % 7) + 1
    }
    /// `(label || alt || name).trim()`; nil hides the avatar from assistive technology.
    public static func accessibleLabel(label: String, alt: String, name: String) -> String? {
        let raw = [label, alt, name].first { !$0.isEmpty } ?? ""
        let value = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        return value.isEmpty ? nil : value
    }
}

/// The `size` property: `small`/`medium`/`large` presets, a unitless number (px) or a CSS
/// length — px, rem, em, vw, vh, vmin, vmax, pt, in, cm, mm, and calc()/min()/max()/clamp()
/// over them. Percentages need the containing block and are not resolved (nil → default).
enum AWCAvatarSize: Equatable {
    case preset(String), custom(Double)
    static func parse(_ raw: String, viewport: CGSize, fontSize: Double = 16) -> AWCAvatarSize {
        let value = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        if ["small", "medium", "large"].contains(value) { return .preset(value) }
        if value.isEmpty { return .preset("") }
        if value.range(of: "^-?\\d*\\.?\\d+$", options: .regularExpression) != nil, let n = Double(value) { return .custom(max(0, n)) }
        var parser = Parser(text: Array(value.lowercased()), viewport: viewport, em: fontSize)
        guard let v = parser.parse() else { return .preset("") }
        return .custom(max(0, v))
    }
    private struct Parser {
        let text: [Character]; let viewport: CGSize; let em: Double; var i = 0
        init(text: [Character], viewport: CGSize, em: Double) { self.text = text; self.viewport = viewport; self.em = em }
        mutating func parse() -> Double? { guard let v = factor(top: true), v.unit else { return nil }; skip(); return i == text.count ? v.value : nil }
        struct V { var value: Double; var unit: Bool }
        mutating func skip() { while i < text.count, text[i].isWhitespace { i += 1 } }
        mutating func eat(_ c: Character) -> Bool { skip(); if i < text.count, text[i] == c { i += 1; return true }; return false }
        mutating func sum() -> V? {
            guard var a = product() else { return nil }
            while true {
                skip(); guard i < text.count, text[i] == "+" || text[i] == "-" else { return a }
                let op = text[i]; i += 1
                guard let b = product(), a.unit == b.unit else { return nil }
                a.value = op == "+" ? a.value + b.value : a.value - b.value
            }
        }
        mutating func product() -> V? {
            guard var a = factor(top: false) else { return nil }
            while true {
                skip(); guard i < text.count, text[i] == "*" || text[i] == "/" else { return a }
                let op = text[i]; i += 1
                guard let b = factor(top: false) else { return nil }
                if op == "*" { guard !(a.unit && b.unit) else { return nil }; a = V(value: a.value * b.value, unit: a.unit || b.unit) }
                else { guard !b.unit, b.value != 0 else { return nil }; a.value /= b.value }
            }
        }
        mutating func factor(top: Bool) -> V? {
            skip(); guard i < text.count else { return nil }
            if text[i] == "(" { i += 1; let v = sum(); return eat(")") ? v : nil }
            var name = ""; let start = i
            while i < text.count, text[i].isLetter { name.append(text[i]); i += 1 }
            if !name.isEmpty {
                guard eat("(") else { i = start; return nil }
                var args: [V] = []
                repeat { guard let v = sum() else { return nil }; args.append(v) } while eat(",")
                guard eat(")"), args.allSatisfy({ $0.unit == args[0].unit }) else { return nil }
                switch name {
                case "calc": return args.count == 1 ? args[0] : nil
                case "min": return V(value: args.map(\.value).min()!, unit: args[0].unit)
                case "max": return V(value: args.map(\.value).max()!, unit: args[0].unit)
                case "clamp": return args.count == 3 ? V(value: max(args[0].value, min(args[1].value, args[2].value)), unit: args[0].unit) : nil
                default: return nil
                }
            }
            var number = ""
            if text[i] == "+" || text[i] == "-" { number.append(text[i]); i += 1 }
            while i < text.count, text[i].isNumber || text[i] == "." { number.append(text[i]); i += 1 }
            if i < text.count, text[i] == "e", i + 1 < text.count, text[i+1].isNumber || text[i+1] == "-" || text[i+1] == "+" { number.append("e"); i += 1; number.append(text[i]); i += 1; while i < text.count, text[i].isNumber { number.append(text[i]); i += 1 } }
            guard let n = Double(number) else { return nil }
            var unit = ""; while i < text.count, text[i].isLetter || text[i] == "%" { unit.append(text[i]); i += 1 }
            let w = Double(viewport.width), h = Double(viewport.height)
            let scale: [String: Double] = ["px": 1, "rem": 16, "em": em, "vw": w / 100, "vh": h / 100, "vmin": min(w, h) / 100, "vmax": max(w, h) / 100,
                                           "pt": 4.0 / 3, "pc": 16, "in": 96, "cm": 96 / 2.54, "mm": 96 / 25.4, "q": 96 / 101.6]
            if unit.isEmpty { return V(value: n, unit: false) }
            guard let s = scale[unit] else { return nil }
            return V(value: n * s, unit: true)
        }
    }
}

// MARK: Image pipeline

/// Loads `src` (data:, http(s):, file: URLs) and reports the outcome once per source, like
/// the source `<img>`: a new `src` resets a failure; repeating the same value does nothing.
@MainActor @Observable final class AWCAvatarImageLoader {
    enum Phase: Equatable { case loading, loaded, failed }
    private(set) var source: String?
    private(set) var phase: Phase = .loading
    private(set) var image: CGImage?
    private var cors = ""
    /// A displayed image is requested again when its CORS mode changes (as Chrome does); a
    /// failed source stays failed until `src` itself changes.
    func load(_ src: String, cors: String, emit: (String, AWCValue) -> Void) async {
        guard !src.isEmpty else { source = nil; image = nil; phase = .loading; return }
        if source == src && phase != .loading && (phase == .failed || self.cors == cors) { return }
        let keep = source == src ? image : nil
        source = src; self.cors = cors; image = keep; phase = keep == nil ? .loading : .loaded
        let decoded = await Task.detached(priority: .userInitiated) { () -> CGImage? in
            guard let data = await AWCAvatarImageLoader.data(for: src) else { return nil }
            if let source = CGImageSourceCreateWithData(data as CFData, nil), CGImageSourceGetCount(source) > 0 { return CGImageSourceCreateImageAtIndex(source, 0, nil) }
            // SVG (Chrome draws `data:image/svg+xml` avatars), which ImageIO does not decode.
            return AWCAvatarImageLoader.vector(data)
        }.value
        guard !Task.isCancelled, self.source == src else { return }
        image = decoded; phase = decoded == nil ? .failed : .loaded
        emit(decoded == nil ? "mdError" : "mdLoad", ["src": .string(src)])
    }
    /// An SVG image rasterised at 4× its intrinsic size (the avatar then scales it like any bitmap): AppKit's own SVG
    /// image on macOS; on UIKit, which has no public SVG decoder (`UIImage(data:)` declines it), `AWCSvgRaster`.
    nonisolated static func vector(_ data: Data) -> CGImage? {
        #if canImport(AppKit)
        guard let image = NSImage(data: data), image.size.width > 0, image.size.height > 0 else { return nil }
        let w = Int((image.size.width * 4).rounded()), h = Int((image.size.height * 4).rounded())
        guard let ctx = CGContext(data: nil, width: w, height: h, bitsPerComponent: 8, bytesPerRow: 0, space: CGColorSpace(name: CGColorSpace.sRGB)!,
                                  bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { return nil }
        NSGraphicsContext.saveGraphicsState(); NSGraphicsContext.current = NSGraphicsContext(cgContext: ctx, flipped: false)
        image.draw(in: NSRect(x: 0, y: 0, width: w, height: h)); NSGraphicsContext.restoreGraphicsState()
        return ctx.makeImage()
        #else
        return AWCSvgRaster.decode(data)
        #endif
    }
    nonisolated static func data(for src: String) async -> Data? {
        if src.hasPrefix("data:") {
            guard let comma = src.firstIndex(of: ",") else { return nil }
            let header = src[src.index(src.startIndex, offsetBy: 5)..<comma], body = String(src[src.index(after: comma)...])
            if header.hasSuffix(";base64") { return Data(base64Encoded: body.removingPercentEncoding ?? body, options: .ignoreUnknownCharacters) }
            return (body.removingPercentEncoding ?? body).data(using: .utf8)
        }
        guard let url = URL(string: src) else { return nil }
        if url.isFileURL { return try? Data(contentsOf: url) }
        guard ["http", "https"].contains(url.scheme?.lowercased() ?? "") else { return nil }
        guard let (data, response) = try? await URLSession.shared.data(from: url) else { return nil }
        if let http = response as? HTTPURLResponse, !(200..<300).contains(http.statusCode) { return nil }
        return data
    }
}

// MARK: Renderer

struct AWCNativeAvatar: View {
    let nodeID: String, properties: [String: AWCValue], theme: AWCTheme
    let emit: (String, AWCValue) -> Void
    let slotItems: [AWCNode]
    let child: (AWCNode) -> AnyView
    @State private var loader = AWCAvatarImageLoader()
    /// `loading="lazy"`: the avatar has come within the lazy-load distance of the window (Chrome: 1250 px).
    @State private var nearViewport = false
    @Environment(\.awcAvatarAppearance) private var inheritedAppearance
    @Environment(\.awcAvatarAppearanceTargets) private var appearanceTargets
    @Environment(\.awcAvatarPartAppearance) private var inheritedParts
    @Environment(\.awcAvatarPartAppearanceTargets) private var partTargets
    @Environment(\.awcNativeDensity) private var inheritedDensity
    @Environment(\.awcAvatarViewport) private var viewport
    @Environment(\.awcAccordionViewport) private var panelViewport
    @Environment(\.layoutDirection) private var direction
    @Environment(\.awcForcedColors) private var forced

    private func s(_ k: String, _ d: String = "") -> String { properties[k]?.string ?? d }
    private func b(_ k: String, _ d: Bool) -> Bool { properties[k]?.bool ?? d }
    private var appearance: AWCAvatarAppearance { inheritedAppearance.merging(appearanceTargets[nodeID] ?? .init()) }
    private var parts: AWCAvatarPartAppearance { inheritedParts.merging(partTargets[nodeID] ?? .init()) }
    private func token(_ name: String, _ fallback: String) -> String { theme.tokens["--md-sys-color-" + name] ?? fallback }
    private static func rgba(_ hex: String) -> [Double] {
        let h = hex.trimmingCharacters(in: CharacterSet(charactersIn: "#")), v = UInt64(h, radix: 16) ?? 0, a = h.count == 8, rgb = a ? v >> 8 : v
        return [Double((rgb >> 16) & 255) / 255, Double((rgb >> 8) & 255) / 255, Double(rgb & 255) / 255, a ? Double(v & 255) / 255 : 1]
    }
    /// `color-mix(in srgb, a p%, b)` for opaque inputs.
    private static func mix(_ a: String, _ p: Double, _ b: String) -> Color {
        let x = rgba(a), y = rgba(b)
        return Color(.sRGB, red: x[0] * p + y[0] * (1 - p), green: x[1] * p + y[1] * (1 - p), blue: x[2] * p + y[2] * (1 - p), opacity: 1)
    }
    private func paletteColors(_ n: Int) -> (Color, Color) {
        let a = appearance
        func hook(_ c: [Int: String], _ fallback: () -> Color) -> Color { c[n].map { Color(awcHex: $0) } ?? fallback() }
        switch n {
        case 1...4:
            let pairs = [("primary-container", "#EADDFF", "on-primary-container", "#21005D"), ("secondary-container", "#E8DEF8", "on-secondary-container", "#1D192B"),
                         ("tertiary-container", "#FFD8E4", "on-tertiary-container", "#31111D"), ("error-container", "#F9DEDC", "on-error-container", "#410E0B")][n - 1]
            return (hook(a.paletteContainerColors) { Color(awcHex: token(pairs.0, pairs.1)) }, hook(a.paletteLabelColors) { Color(awcHex: token(pairs.2, pairs.3)) })
        default:
            let accent = [("primary", "#6750A4"), ("tertiary", "#7D5260"), ("secondary", "#625B71")][n - 5]
            let tone = token(accent.0, accent.1)
            return (hook(a.paletteContainerColors) { Self.mix(tone, 0.22, token("surface", "#FEF7FF")) },
                    hook(a.paletteLabelColors) { Self.mix(tone, 0.72, token("on-surface", "#1C1B1F")) })
        }
    }

    var body: some View {
        let a = appearance, part = parts, density = AWCNativeDensity.resolve(properties["density"]?.number, inherited: inheritedDensity)
        let src = s("src"), name = s("name"), label = s("label"), alt = s("alt"), initialsProp = s("initials")
        let failed = !src.isEmpty && loader.source == src && loader.phase == .failed
        let hasImage = !src.isEmpty && !failed
        let initials = AWCAvatarIdentity.initials(initials: initialsProp, name: name)
        let mode = hasImage ? "image" : !initials.isEmpty ? "initials" : "slot"
        let palette = mode == "image" ? 0 : AWCAvatarIdentity.palette(initials: initialsProp, name: name, label: label, colorFromName: b("colorFromName", true))
        let a11y = AWCAvatarIdentity.accessibleLabel(label: label, alt: alt, name: name)
        let view = viewport ?? panelViewport ?? Self.windowSize
        let sizeValue: Double = {
            switch AWCAvatarSize.parse(s("size", "medium"), viewport: view) {
            case .custom(let px): return px
            case .preset(let preset):
                if let hook = a.size { return max(0, Self.resolve(hook, em: 16)) }
                switch preset {
                case "small": return max(18, 24 + density * 1.5)
                case "large": return max(40, 56 + density * 4)
                default: return max(28, 40 + density * 3)
                }
            }
        }()
        let size = CGFloat(sizeValue)
        let corners = a.containerShape ?? (s("shape", "circle") == "rounded" ? .points(Double(theme.tokens["--md-sys-shape-corner-medium"].flatMap { Double($0.replacingOccurrences(of: "px", with: "")) } ?? 12))
                                            : s("shape", "circle") == "square" ? .points(0) : .fraction(0.5))
        let shape = AWCNativeCornerShape(corners: corners)
        let neutral = (a.containerColor.map { Color(awcHex: $0) } ?? Color(awcHex: token("surface-container-highest", "#E6E0E9")),
                       a.labelColor.map { Color(awcHex: $0) } ?? Color(awcHex: token("on-surface-variant", "#49454F")))
        let colors = palette > 0 ? paletteColors(palette) : neutral
        // forced-colors: `--_container-color: ButtonFace; --_label-color: ButtonText` (the host colour is not forced away).
        let container: Color = forced.map { Color(awcHex: $0.buttonFace) } ?? (mode == "image" ? .clear : colors.0), ink = forced.map { Color(awcHex: $0.buttonText) } ?? colors.1
        let labelSize = a.labelFontSize.map { Self.resolve($0, em: 16) } ?? sizeValue * 0.4
        let iconSize = a.iconSize.map { Self.resolve($0, em: 16) } ?? sizeValue * 0.6
        let outline = forced != nil ? 1 : a.outlineWidth.map { max(0, Self.resolve($0, em: 16)) } ?? 0
        // CSS border-radius corners are physical: shape, outline and clip are drawn left-to-right
        // (SwiftUI would mirror them); the content keeps the authored direction.
        return ZStack {
            shape.fill(container)
            Group {
                switch mode {
                case "image": image(part, size: size)
                case "initials": initialsView(initials, a: a, part: part, size: labelSize, ink: ink)
                default: slotView(iconSize: iconSize, part: part, ink: ink)
                }
            }.environment(\.layoutDirection, direction)
            // A slotted md-badge sizes itself (the source excludes it from the icon box) and is
            // absolutely positioned against the host (top: 0; right: 0, its own offsets), inside
            // the host's overflow clip: the shared badge anchor keeps that physical corner in RTL.
            let badges = slotItems.filter { $0.tag == "md-badge" }
            if mode == "slot" && !badges.isEmpty {
                Color.clear.frame(width: size, height: size)
                    .awcBadgeOverlay { ForEach(badges) { child($0) } }
                    .environment(\.layoutDirection, direction)
            }
        }
        .frame(width: size, height: size)
        .compositingGroup()
        .clipShape(shape)
        // The outline is drawn after the clip, not inside it: inside, its outer edge was anti-aliased twice (stroke coverage
        // times clip coverage on the same circle edge), which left the top pixel row of a 1 pt forced-colors outline at 91 % on a
        // 3x screen (s7-8-01, probe [20, 0.25] native 233 vs Chrome 255). Drawn once, the edge is anti-aliased once.
        .overlay { if outline > 0 { shape.strokeBorder(forced.map { Color(awcHex: $0.buttonText) } ?? a.outlineColor.map { Color(awcHex: $0) } ?? .clear, lineWidth: outline) } }
        .environment(\.layoutDirection, .leftToRight)
        .awcInspect(nodeID: nodeID, name: "md-avatar") { _ in
            let c = container.resolve(in: EnvironmentValues()), l = ink.resolve(in: EnvironmentValues())
            return ["mode": .string(mode), "palette": .number(Double(palette)), "role": .string(a11y == nil ? "presentation" : "img"), "label": a11y.map { .string($0) } ?? .null,
                    "size": .number(sizeValue), "outline": .number(outline), "initials": mode == "initials" ? .string(initials) : .null,
                    "background": .array([c.red, c.green, c.blue, c.opacity].map { .number(Double($0)) }), "color": .array([l.red, l.green, l.blue, l.opacity].map { .number(Double($0)) }),
                    "radii": .array(corners.radii(in: CGSize(width: size, height: size)).map { .array([.number(Double($0.width)), .number(Double($0.height))]) })]
        }
        .modifier(AWCAvatarAccessibility(label: a11y))
        .onGeometryChange(for: Bool.self) { proxy in
            let f = proxy.frame(in: .global), w = Self.windowSize
            return f.width > 0 && CGRect(origin: .zero, size: w).insetBy(dx: -1250, dy: -1250).intersects(f)
        } action: { near in if near && !nearViewport { nearViewport = true } }
        .task(id: (failed ? src : src + "\u{0}" + s("crossorigin")) + (deferLoad ? "\u{1}" : "")) {
            guard !deferLoad else { return }
            await loader.load(src, cors: s("crossorigin"), emit: emit)
        }
    }

    /// The image waits while a lazy avatar is far from the viewport.
    private var deferLoad: Bool { s("loading", "lazy") != "eager" && !nearViewport }
    static func resolve(_ l: AWCAvatarLength, em: Double) -> Double { l.points + l.em * em + l.rem * 16 + l.fraction * em + l.ch * em * 0.5 }
    static var windowSize: CGSize {
        #if canImport(AppKit)
        return NSApplication.shared.windows.first(where: { $0.isVisible })?.contentView?.bounds.size ?? CGSize(width: 1200, height: 900)
        #else
        return UIScreen.main.bounds.size
        #endif
    }

    @ViewBuilder private func image(_ part: AWCAvatarPartAppearance, size: CGFloat) -> some View {
        if let cg = loader.image, loader.source == s("src") {
            let w = CGFloat(cg.width), h = CGFloat(cg.height), scale = max(size / max(w, 1), size / max(h, 1))
            let dw = w * scale, dh = h * scale
            let x = CGFloat(part.imagePositionX ?? 0.5), y = CGFloat(part.imagePositionY ?? 0.5)
            Image(decorative: cg, scale: 1).resizable().interpolation(.high)
                .frame(width: dw, height: dh)
                .position(x: (size - dw) * x + dw / 2, y: (size - dh) * y + dh / 2)
                .frame(width: size, height: size).clipped()
                .opacity(part.imageOpacity ?? 1)
                .environment(\.layoutDirection, .leftToRight)
                .awcInspect(nodeID: nodeID, part: "image", name: "image") { _ in ["naturalWidth": .number(Double(cg.width)), "naturalHeight": .number(Double(cg.height))] }
        } else { Color.clear.frame(width: size, height: size) }
    }

    private func initialsView(_ text: String, a: AWCAvatarAppearance, part: AWCAvatarPartAppearance, size labelSize: Double, ink: Color) -> some View {
        let fontSize = part.initialsFontSize.map { Self.resolve($0, em: labelSize) } ?? labelSize
        let tracking = part.initialsLetterSpacing.map { Self.resolve($0, em: fontSize) } ?? a.labelLetterSpacing.map { Self.resolve($0, em: fontSize) } ?? fontSize * 0.05
        let weight = part.initialsFontWeight ?? a.labelFontWeight ?? Double(theme.tokens["--md-sys-typescale-title-medium-font-weight"] ?? "") ?? 500
        let color = forced == nil ? part.initialsColor.map { Color(awcHex: $0) } ?? ink : ink
        let font = Self.font(family: a.labelFontFamily, size: fontSize, weight: weight)
        // CSS letter-spacing follows every character, including the last: the run (with its
        // trailing space) is what the flex container centers.
        // Letter spacing follows each glyph in the run's own direction (bidi), not the host's:
        // Latin initials in an RTL avatar keep the spacing on their right, as in Chrome.
        let rtlRun = text.unicodeScalars.first { $0.properties.isAlphabetic }.map { (0x0590...0x08FF).contains($0.value) || (0xFB1D...0xFDFF).contains($0.value) || (0xFE70...0xFEFF).contains($0.value) } ?? false
        return Text(fontSize > 0 ? text : "").font(font).tracking(tracking).monospacedDigit().foregroundStyle(color).lineLimit(1).fixedSize()
            .environment(\.layoutDirection, rtlRun ? .rightToLeft : .leftToRight)
            .awcInspect(nodeID: nodeID, part: "initials", name: "initials") { _ in ["fontSize": .number(fontSize), "letterSpacing": .number(tracking), "fontWeight": .number(weight), "text": .string(text)] }
    }

    static func font(family: String?, size: Double, weight: Double) -> Font {
        let w = AWCNativeFonts.resolvedLabelWeight(weight)
        switch family?.lowercased().split(separator: ",").first.map({ $0.trimmingCharacters(in: CharacterSet(charactersIn: " \"'")) }) {
        case nil, "roboto", "system-ui", "sans-serif":
            return AWCNativeFonts.label(size: CGFloat(size), weight: w)
        case "monospace":
            return .custom("Menlo", fixedSize: CGFloat(size)).weight(w >= 600 ? .bold : .regular)
        case .some(let other):
            return .custom(other, fixedSize: CGFloat(size))
        }
    }

    @ViewBuilder private func slotView(iconSize: Double, part: AWCAvatarPartAppearance, ink: Color) -> some View {
        let box = CGFloat(iconSize), items = slotItems.filter { $0.tag != "md-badge" }
        if items.isEmpty && slotItems.isEmpty {
            let glyph = CGFloat(part.iconFontSize.map { Self.resolve($0, em: iconSize) } ?? iconSize)
            Text("person").font(AWCNativeFonts.symbol(size: glyph)).foregroundStyle(forced == nil ? part.iconColor.map { Color(awcHex: $0) } ?? ink : ink)
                .lineLimit(1).fixedSize().frame(height: glyph)
                .frame(width: box, height: box, alignment: .topLeading).environment(\.layoutDirection, .leftToRight)
                .awcInspect(nodeID: nodeID, part: "icon", name: "icon") { _ in ["fontSize": .number(Double(glyph)), "box": .number(iconSize)] }
        } else {
            ZStack { ForEach(items) { item in
                if item.tag == "#text" {
                    Text(item.properties["text"]?.string ?? "").font(AWCNativeFonts.label(size: box, regular: true)).foregroundStyle(ink).lineLimit(1).fixedSize().frame(width: box, height: box)
                } else { child(item).font(.system(size: box)).foregroundStyle(ink).frame(width: box, height: box) }
            } }
                .awcInspect(nodeID: nodeID, part: "slot", name: "slot") { _ in ["box": .number(iconSize)] }
        }
    }
}

/// role="img" with the derived label, or hidden from assistive technology.
private struct AWCAvatarAccessibility: ViewModifier {
    let label: String?
    func body(content: Content) -> some View {
        if let label { content.accessibilityElement(children: .ignore).accessibilityLabel(Text(label)).accessibilityAddTraits(.isImage) }
        else { content.accessibilityHidden(true) }
    }
}

extension AWCNativeView {
    var nativeAvatar: some View {
        AWCNativeAvatar(nodeID: node.id, properties: local, theme: theme, emit: { name, detail in emit(name, detail) },
                        slotItems: node.children(inSlot: nil), child: { AnyView(child($0)) })
    }
}
