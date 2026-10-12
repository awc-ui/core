import Foundation
@testable import AWCUI

/// Shared by XCTest and the Command Line Tools runner. Expected rows are the
/// audited density-zero M3 Expressive contract, independent of layout rendering.
enum NativeButtonMetricCases {
    static func run(_ check: (Bool, String) -> Void) {
        let sizes = ["xs", "sm", "md", "lg", "xl"]
        let heights: [CGFloat] = [32, 40, 56, 96, 136]
        let widths: [CGFloat] = [48, 58, 72, 88, 120]
        let insets: [CGFloat] = [12, 16, 24, 48, 64]
        let fonts: [CGFloat] = [14, 14, 16, 24, 32]
        let lines: [CGFloat] = [20, 20, 24, 32, 40]
        let icons: [CGFloat] = [20, 20, 24, 32, 40]
        let gaps: [CGFloat] = [4, 8, 8, 12, 16]
        let weights: [Double] = [500, 500, 500, 400, 400]
        let tracking: [CGFloat] = [0.1, 0.1, 0.15, 0, 0]
        let square: [CGFloat] = [12, 12, 16, 28, 28]
        let pressed: [CGFloat] = [8, 8, 12, 16, 16]
        let round: [CGFloat] = [16, 20, 28, 48, 68]
        let connected: [CGFloat] = [4, 8, 8, 16, 20]
        let outlines: [CGFloat] = [1, 1, 1, 2, 3]
        let compactFonts: [CGFloat] = [12, 12, 14, 20, 24]
        let compactLines: [CGFloat] = [16, 16, 20, 24, 32]

        for (index, size) in sizes.enumerated() {
            let standard = AWCNativeButtonMetrics(size: size, density: 0, variant: "filled")
            check(standard.minimumHeight == heights[index] && standard.minimumWidth == widths[index], "\(size) preserves container dimensions")
            check(standard.horizontalPadding == insets[index] && standard.outlineWidth == 0, "\(size) standard inset and no border")
            check(standard.fontSize == fonts[index] && standard.lineHeight == lines[index], "\(size) Expressive type size and line height")
            check(standard.fontWeight == weights[index] && standard.letterSpacing == tracking[index], "\(size) Expressive weight and tracking")
            check(standard.iconSize == icons[index] && standard.gap == gaps[index], "\(size) preserves icons and gaps")
            check(standard.squareRadius == square[index] && standard.pressedRadius == pressed[index], "\(size) Expressive square and pressed corners")
            check(standard.roundRadius == round[index] && standard.connectedRadius == connected[index], "\(size) preserves round and group corners")
            let selected = AWCNativeButtonCorners(metrics: standard, shape: "round", shapeMorph: true, selected: true, pressed: false)
            let held = AWCNativeButtonCorners(metrics: standard, shape: "round", shapeMorph: true, selected: true, pressed: true)
            check(selected.topLeading == square[index] && held.topLeading == pressed[index], "\(size) selection and press consume updated corner tiers")

            for density in [0.0, -1, -2, -3, -4] {
                let filled = AWCNativeButtonMetrics(size: size, density: density, variant: "filled")
                let outlined = AWCNativeButtonMetrics(size: size, density: density, variant: "outlined")
                let expectedInset = insets[index] * CGFloat(1 + density / 16)
                check(outlined.outlineWidth == outlines[index], "\(size) density \(density) outline width remains size-specific")
                check(outlined.horizontalPadding + outlined.outlineWidth == filled.horizontalPadding && filled.horizontalPadding == expectedInset,
                      "\(size) density \(density) outlined outer inset matches standard")
                check(outlined.minimumHeight == filled.minimumHeight && outlined.minimumWidth == filled.minimumWidth,
                      "\(size) density \(density) variant keeps container constraints")
            }
            let compact = AWCNativeButtonMetrics(size: size, density: -4, variant: "text")
            check(compact.fontSize == compactFonts[index] && compact.lineHeight == compactLines[index], "\(size) density -4 typography taper")
        }

        // Distinct token values verify that each size resolves the intended role,
        // instead of accidentally obtaining an equal default from an old role.
        let tokens = [
            "--md-sys-typescale-label-large-font-weight": "501",
            "--md-sys-typescale-title-medium-font-weight": "502",
            "--md-sys-typescale-headline-small-font-weight": "403",
            "--md-sys-typescale-headline-large-font-weight": "404",
            "--md-sys-typescale-label-large-letter-spacing": "0.11px",
            "--md-sys-typescale-title-medium-letter-spacing": "0.22px",
            "--md-sys-typescale-headline-small-letter-spacing": "0.33px",
            "--md-sys-typescale-headline-large-letter-spacing": "0.44px",
            "--md-sys-shape-corner-small": "7px",
            "--md-sys-shape-corner-medium": "11px",
            "--md-sys-shape-corner-large": "17px",
            "--md-sys-shape-corner-extra-large": "29px"
        ]
        for (index, size) in sizes.enumerated() {
            let custom = AWCNativeButtonMetrics(size: size, density: 0, variant: "filled", tokens: tokens)
            check(custom.fontWeight == [501.0, 501, 502, 403, 404][index], "\(size) consumes its typography weight role")
            check(custom.letterSpacing == [CGFloat(0.11), 0.11, 0.22, 0.33, 0.44][index], "\(size) consumes its typography tracking role")
            check(custom.squareRadius == [CGFloat(11), 11, 17, 29, 29][index], "\(size) consumes its square corner role")
            check(custom.pressedRadius == [CGFloat(7), 7, 11, 17, 17][index], "\(size) consumes its pressed corner role")
        }
    }
}
