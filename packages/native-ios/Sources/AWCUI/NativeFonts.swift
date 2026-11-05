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
