import XCTest
@testable import AWCUI

final class NativeButtonTests: XCTestCase {
    func testActualSourceSizeRules() {
        NativeButtonMetricCases.run { valid, message in XCTAssertTrue(valid, message) }
    }

    func testDensityFloorsAndVariantInsets() {
        let small = AWCNativeButtonMetrics(size: "sm", density: -4, variant: "filled")
        XCTAssertEqual(small.minimumHeight, 24)
        XCTAssertEqual(small.minimumWidth, 42)
        XCTAssertEqual(small.horizontalPadding, 12)
        XCTAssertEqual(small.iconSize, 10)
        XCTAssertEqual(small.loadingSize, 10)
        XCTAssertEqual(small.gap, 4)
        let outlined = AWCNativeButtonMetrics(size: "sm", density: -4, variant: "outlined")
        XCTAssertEqual(outlined.horizontalPadding, 11)
        XCTAssertEqual(outlined.horizontalPadding + outlined.outlineWidth, small.horizontalPadding)
        let extraLarge = AWCNativeButtonMetrics(size: "xl", density: -4, variant: "text")
        XCTAssertEqual(extraLarge.minimumHeight, 120)
        XCTAssertEqual(extraLarge.horizontalPadding, 48)
        XCTAssertEqual(extraLarge.fontSize, 24)
        XCTAssertEqual(extraLarge.lineHeight, 32)
        // Only exact reflected density rungs match a source CSS selector.
        XCTAssertEqual(AWCNativeButtonMetrics(size: "sm", density: -1.5, variant: "filled").minimumHeight, 40)
    }

    func testVariantAndTogglePaletteRules() {
        let filledOff = AWCNativeButtonPalette(variant: "filled", toggle: true, selected: false, disabled: false)
        let filledOn = AWCNativeButtonPalette(variant: "filled", toggle: true, selected: true, disabled: false)
        XCTAssertEqual(filledOff.containerRole, "surface-container-highest")
        XCTAssertEqual(filledOff.labelRole, "primary")
        XCTAssertEqual(filledOn.containerRole, "primary")
        XCTAssertEqual(filledOn.labelRole, "on-primary")
        let tonal = AWCNativeButtonPalette(variant: "tonal", toggle: false, selected: false, disabled: false)
        XCTAssertEqual(tonal.containerRole, "secondary-container")
        XCTAssertEqual(tonal.labelRole, "on-secondary-container")
        let outline = AWCNativeButtonPalette(variant: "outlined", toggle: true, selected: true, disabled: false)
        XCTAssertEqual(outline.containerRole, "secondary-container")
        XCTAssertNil(outline.outlineRole)
        let text = AWCNativeButtonPalette(variant: "text", toggle: true, selected: false, disabled: false)
        XCTAssertNil(text.containerRole)
        XCTAssertNil(text.outlineRole)
        XCTAssertEqual(text.labelRole, "on-surface-variant")
        let elevated = AWCNativeButtonPalette(variant: "elevated", toggle: false, selected: false, disabled: false)
        XCTAssertEqual(elevated.containerRole, "surface-container-low")
        XCTAssertEqual(elevated.restingElevation, 1)
        XCTAssertEqual(elevated.hoverElevation, 2)
        let elevatedOff = AWCNativeButtonPalette(variant: "elevated", toggle: true, selected: false, disabled: false)
        XCTAssertEqual(elevatedOff.restingElevation, 0)
        XCTAssertEqual(elevatedOff.hoverElevation, 0)
    }

    func testDisabledWinsOverSelectedPalette() {
        for variant in ["filled", "tonal", "outlined", "text", "elevated"] {
            let palette = AWCNativeButtonPalette(variant: variant, toggle: true, selected: true, disabled: true)
            XCTAssertEqual(palette.labelRole, "on-surface", variant)
            XCTAssertEqual(palette.labelOpacity, 0.38, variant)
            XCTAssertEqual(palette.restingElevation, 0, variant)
            XCTAssertEqual(palette.hoverElevation, 0, variant)
            XCTAssertEqual(palette.containerRole, ["text", "outlined"].contains(variant) ? nil : "on-surface", variant)
        }
    }

    func testSelectedMorphAndPressedPrecedence() {
        let metrics = AWCNativeButtonMetrics(size: "md", density: 0, variant: "filled")
        func radius(_ shape: String, _ selected: Bool, _ pressed: Bool, _ morph: Bool = true) -> CGFloat {
            AWCNativeButtonCorners(metrics: metrics, shape: shape, shapeMorph: morph, selected: selected, pressed: pressed).topLeading
        }
        XCTAssertEqual(radius("round", false, false), 28)
        XCTAssertEqual(radius("round", true, false), 16)
        XCTAssertEqual(radius("square", false, false), 16)
        XCTAssertEqual(radius("square", true, false), 28)
        XCTAssertEqual(radius("round", true, true), 12)
        XCTAssertEqual(radius("square", true, true), 12)
        XCTAssertEqual(radius("round", true, true, false), 28)
        XCTAssertEqual(radius("square", true, true, false), 16)
    }

    func testConnectedCornersAndGeneratedTokenOverrides() {
        let metrics = AWCNativeButtonMetrics(size: "md", density: 0, variant: "filled")
        let first = AWCNativeButtonCorners(metrics: metrics, shape: "round", shapeMorph: false,
                                           selected: false, pressed: false, connectedRight: true)
        XCTAssertEqual(first.topLeading, 28)
        XCTAssertEqual(first.topTrailing, 8)
        let last = AWCNativeButtonCorners(metrics: metrics, shape: "round", shapeMorph: false,
                                          selected: false, pressed: false, connectedLeft: true)
        XCTAssertEqual(last.topLeading, 8)
        XCTAssertEqual(last.topTrailing, 28)
        let tokens = ["--md-sys-shape-corner-large": "13px", "--md-sys-shape-corner-medium": "7px",
                      "--md-sys-typescale-title-medium-font-weight": "400"]
        let customized = AWCNativeButtonMetrics(size: "md", density: 0, variant: "filled", tokens: tokens)
        XCTAssertEqual(customized.squareRadius, 13)
        XCTAssertEqual(customized.pressedRadius, 7)
        XCTAssertEqual(customized.fontWeight, 400)
    }
}
