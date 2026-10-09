import CoreText
import SwiftUI

/// Registers the same font files used by the web reference in this process only.
enum AWCNativeFonts {
    private static let registered: Void = {
        // The standalone macOS app embeds SwiftPM resources in Contents/Resources.
        let fonts = Bundle.main.url(forResource: "AWCUI_AWCUI", withExtension: "bundle")
            .flatMap(Bundle.init(url:)) ?? Bundle.module
        for file in ["roboto-latin-400-normal", "roboto-latin-500-normal", "material-symbols-outlined"] {
            guard let url = fonts.url(forResource: file, withExtension: "woff2", subdirectory: "Fonts") else { continue }
            CTFontManagerRegisterFontsForURL(url as CFURL, .process, nil)
        }
    }()

    static func label(size: CGFloat, regular: Bool = false) -> Font {
        _ = registered
        return .custom(regular ? "Roboto-Regular" : "Roboto-Medium", fixedSize: size)
    }

    static func symbol(size: CGFloat) -> Font {
        _ = registered
        return .custom("MaterialSymbolsOutlined-Regular", fixedSize: size)
    }
}
