import CoreText
import SwiftUI

/// Registers the same font files used by the web reference in this process only.
enum AWCNativeFonts {
    private static let registered: Void = {
        // The standalone macOS app embeds SwiftPM resources in Contents/Resources.
        let fonts = Bundle.main.url(forResource: "AWCUI_AWCUI", withExtension: "bundle")
            .flatMap(Bundle.init(url:)) ?? Bundle.module
        for file in ["roboto-latin-400-normal", "roboto-latin-500-normal", "roboto-latin-700-normal", "material-symbols-outlined"] {
            guard let url = fonts.url(forResource: file, withExtension: "woff2", subdirectory: "Fonts") else { continue }
            CTFontManagerRegisterFontsForURL(url as CFURL, .process, nil)
        }
    }()

    static func label(size: CGFloat, regular: Bool = false) -> Font {
        _ = registered
        return .custom(regular ? "Roboto-Regular" : "Roboto-Medium", fixedSize: size)
    }

    static func label(size: CGFloat, weight: Double) -> Font {
        let weights: [Font.Weight] = [.ultraLight, .thin, .light, .regular, .medium, .semibold, .bold, .heavy, .black]
        let index = Int(resolvedLabelWeight(weight) / 100) - 1
        return label(size: size, regular: weight < 500).weight(weights[index])
    }

    static func resolvedLabelWeight(_ weight: Double) -> Double {
        Double(min(9, max(1, Int((weight / 100).rounded())))) * 100
    }

    static func labelFamily(regular: Bool) -> String {
        _ = registered
        let font = CTFontCreateWithName((regular ? "Roboto-Regular" : "Roboto-Medium") as CFString, 16, nil)
        return CTFontCopyFamilyName(font) as String
    }

    static func symbol(size: CGFloat) -> Font {
        _ = registered
        return .custom("MaterialSymbolsOutlined-Regular", fixedSize: size)
    }

    /// The accordion's built-in glyph animates the same variable font axes as
    /// its Web fallback. Authored slot views keep their own font styling.
    static func accordionSymbol(size: CGFloat, fill: Double) -> CTFont {
        _ = registered
        let amount = min(1, max(0, fill.isFinite ? fill : 0))
        let axes: [NSNumber: Double] = [
            NSNumber(value: 0x46494C4C): amount,       // FILL
            NSNumber(value: 0x77676874): 400+100*amount, // wght
            NSNumber(value: 0x47524144): 0,            // GRAD
            NSNumber(value: 0x6F70737A): 24            // opsz
        ]
        let descriptor = CTFontDescriptorCreateWithAttributes([
            kCTFontNameAttribute: "MaterialSymbolsOutlined-Regular",
            kCTFontVariationAttribute: axes
        ] as CFDictionary)
        return CTFontCreateWithFontDescriptor(descriptor, size, nil)
    }

    static func symbolFamily() -> String {
        _ = registered
        return CTFontCopyFamilyName(CTFontCreateWithName("MaterialSymbolsOutlined-Regular" as CFString, 16, nil)) as String
    }
}

// MARK: - Fallback faces
// The bundled Roboto files are the Latin subset (as the Web reference's @fontsource files). Chrome on macOS draws the
// characters Roboto lacks with the platform cascade of the primary font: Geeza Pro for Arabic, Lucida Grande for Hebrew
// (the bold face for CSS weights >= 500; probe n4-063), and adds no letter-spacing to cursive (Arabic) runs. SwiftUI /
// CoreText would otherwise fall back to the system UI cascade (SF Arabic / SF Hebrew), whose advances differ from Chrome's.
// Each script lists faces in order; the first installed one is used (iOS has no Lucida Grande: Arial Hebrew).
extension AWCNativeFonts {
    /// One entry of the fallback list: the script's code points and the faces Chrome uses for them.
    struct FallbackFace {
        let script: String
        let pattern: String
        let regular: [String]
        let bold: [String]
        /// CSS letter-spacing is not applied to cursive scripts.
        let cursive: Bool
        /// The first installed face for the weight (CoreText substitutes a missing PostScript name).
        func face(weight: Double) -> String {
            let names = weight >= 500 ? bold : regular
            return names.first { CTFontCopyPostScriptName(CTFontCreateWithName($0 as CFString, 12, nil)) as String == $0 } ?? names[0]
        }
    }
    /// Ordered fallback list (first match wins). Add scripts here, not in components.
    static let fallbackFaces: [FallbackFace] = [
        FallbackFace(script: "Arabic", pattern: "[\u{0600}-\u{06FF}\u{0750}-\u{077F}\u{08A0}-\u{08FF}\u{FB50}-\u{FDFF}\u{FE70}-\u{FEFF}]+",
                     regular: ["GeezaPro"], bold: ["GeezaPro-Bold"], cursive: true),
        FallbackFace(script: "Hebrew", pattern: "[\u{0590}-\u{05FF}\u{FB1D}-\u{FB4F}]+",
                     regular: ["LucidaGrande", "ArialHebrew"], bold: ["LucidaGrande-Bold", "ArialHebrew-Bold"], cursive: false),
    ]
    /// A UTF-16 range of `text` that draws with a fallback face.
    struct FallbackRun { let range: NSRange; let face: FallbackFace }
    /// The fallback runs of `text` in order (empty for Latin-only text).
    static func fallbackRuns(_ text: String) -> [FallbackRun] {
        // Fast path: every listed script lies above U+058F.
        guard text.unicodeScalars.contains(where: { $0.value >= 0x0590 }) else { return [] }
        let all = NSRange(location: 0, length: (text as NSString).length)
        return fallbackFaces.flatMap { face in
            (try? NSRegularExpression(pattern: face.pattern))?.matches(in: text, range: all).map { FallbackRun(range: $0.range, face: face) } ?? []
        }.sorted { $0.range.location < $1.range.location }
    }
    /// A label's text: Roboto runs inherit the environment font and tracking; fallback runs carry their face (cursive
    /// runs without tracking). Latin-only text is `Text(verbatim:)` unchanged.
    static func labelText(_ text: String, size: CGFloat, weight: Double) -> Text {
        let runs = fallbackRuns(text)
        guard !runs.isEmpty else { return Text(verbatim: text) }
        let ns = text as NSString
        var result = Text(verbatim: ""), at = 0
        for run in runs {
            if run.range.location > at { result = result + Text(verbatim: ns.substring(with: NSRange(location: at, length: run.range.location - at))) }
            let piece = Text(verbatim: ns.substring(with: run.range)).font(.custom(run.face.face(weight: weight), fixedSize: size))
            result = result + (run.face.cursive ? piece.tracking(0) : piece)
            at = NSMaxRange(run.range)
        }
        if at < ns.length { result = result + Text(verbatim: ns.substring(from: at)) }
        return result
    }
    /// The advance of a single-line label with the fallback faces (CSS letter-spacing after every non-cursive character).
    /// Latin-only text measures exactly as `tabTextWidth`.
    static func labelTextWidth(_ text: String, size: CGFloat, weight: Double = 500, tracking: Double = 0.1) -> Double {
        let runs = fallbackRuns(text)
        guard !runs.isEmpty else { return tabTextWidth(text, size: size, weight: weight, tracking: tracking) }
        _ = label(size: size, weight: 500)
        let key = NSAttributedString.Key(kCTFontAttributeName as String), ns = text as NSString
        let base = CTFontCreateWithName((weight >= 600 ? "Roboto-Bold" : weight >= 500 ? "Roboto-Medium" : "Roboto-Regular") as CFString, size, nil)
        let value = NSMutableAttributedString(string: text, attributes: [key: base])
        var cursive = 0
        for run in runs {
            value.addAttribute(key, value: CTFontCreateWithName(run.face.face(weight: weight) as CFString, size, nil), range: run.range)
            if run.face.cursive { cursive += ns.substring(with: run.range).count }
        }
        return Double(CTLineGetTypographicBounds(CTLineCreateWithAttributedString(value), nil, nil, nil)) + tracking * Double(text.count - cursive)
    }
}
