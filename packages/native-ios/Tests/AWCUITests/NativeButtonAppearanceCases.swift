import Foundation
@testable import AWCUI

enum NativeButtonAppearanceCases {
    static func run(check: (Bool, String) -> Void) {
        let empty = AWCButtonAppearance()
        let base = AWCButtonAppearance(containerColor: "#abcDEF", labelColor: "#123456", iconSize: 26, fontWeight: 600, paddingInline: 30, hoverOpacity: 0.3)
        let local = AWCButtonAppearance(labelColor: "#fedcba", trailingIconSize: 32, cornerRadius: 0, paddingInline: 0, hoverOpacity: 0)
        let merged = base.merging(local)
        check(base.merging(empty) == base && empty.merging(base) == base, "An empty scope changes no inherited fields")
        check(merged.containerColor == "#ABCDEF" && merged.labelColor == "#FEDCBA", "Colors normalize and merge independently")
        check(merged.iconSize == 26 && merged.trailingIconSize == 32 && merged.fontWeight == 600, "Local fields preserve unrelated inherited values")
        check(merged.paddingInline == 0 && merged.hoverOpacity == 0 && merged.cornerRadius == 0, "Valid zero overrides are not mistaken for missing values")
        // Source color hooks accept any CSS color; the native API takes #RRGGBB and #RRGGBBAA.
        check(AWCButtonAppearance(labelColor: "#12345678").labelColor == "#12345678" && AWCButtonAppearance(labelColor: "#abcdef80").labelColor == "#ABCDEF80", "8-digit hex colors keep their alpha")
        let invalid = AWCButtonAppearance(containerColor: "red", labelColor: "#1234567", iconColor: "#GGHHII", fontSize: .nan, fontWeight: 450.5, lineHeight: .infinity, cornerRadius: -1, outlineWidth: 17, paddingInline: 129, hoverOpacity: -0.1)
        check(invalid == empty && base.merging(invalid) == base, "Invalid local inputs cannot erase inherited styles")
        let limits: [(String, Double, Double)] = [
            ("iconSize",8,128), ("trailingIconSize",8,128), ("loadingSize",8,128), ("fontSize",8,96), ("fontWeight",100,900), ("lineHeight",8,160), ("letterSpacing",-5,20), ("cornerRadius",0,200), ("outlineWidth",0,16), ("paddingInline",0,128), ("paddingBlock",0,128), ("gap",0,64), ("hoverOpacity",0,1), ("focusOpacity",0,1), ("pressedOpacity",0,1), ("width",0,2400), ("minWidth",0,2400), ("maxWidth",0,2400), ("height",0,2400), ("minHeight",0,2400)
        ]
        for (field, low, high) in limits {
            for value in [low, high] { check(AWCButtonAppearance(values: [field: .number(value)]) != empty, "\(field) includes valid boundary \(value)") }
            for value in [low - 1, high + 1, Double.nan, Double.infinity] { check(AWCButtonAppearance(values: [field: .number(value)]) == empty, "\(field) rejects unsafe number \(value)") }
            for value in [AWCValue.bool(true), .string("12"), .null] { check(AWCButtonAppearance(values: [field: value]) == empty, "\(field) does not coerce JSON values") }
        }
        check(AWCButtonAppearance(values: ["fontWeight": 450.5]) == empty, "Fractional JSON font weight is rejected")
        for field in ["containerColor", "labelColor", "iconColor", "trailingIconColor", "loadingColor", "stateLayerColor", "outlineColor", "focusRingColor"] {
            check(AWCButtonAppearance(values: [field: "#abcdef"]) != empty && AWCButtonAppearance(values: [field: "#abcdef80"]) != empty, "\(field) accepts hex6 and hex8")
            for value in [AWCValue.string("#FFF"), "#FFFFFFF", "transparent", "#GGGGGG", 100] { check(AWCButtonAppearance(values: [field: value]) == empty, "\(field) rejects non-hex colors") }
        }
        let original = AWCNativeButtonMetrics(size: "md", density: 0, variant: "outlined")
        let defaults = AWCNativeButtonMetrics(size: "md", density: 0, variant: "outlined", appearance: empty)
        check(original.minimumHeight == defaults.minimumHeight && original.horizontalPadding == defaults.horizontalPadding && original.iconSize == defaults.iconSize && original.fontSize == defaults.fontSize, "Unconfigured appearance preserves existing metrics")
        let appearance = AWCButtonAppearance(iconSize: 40, loadingSize: 28, fontSize: 22, fontWeight: 700, lineHeight: 38, letterSpacing: -1, cornerRadius: 7, outlineWidth: 4, paddingInline: 19, paddingBlock: 10, gap: 3)
        let metrics = AWCNativeButtonMetrics(size: "md", density: 0, variant: "filled", appearance: appearance)
        check(metrics.minimumHeight == 56 && metrics.minimumWidth == 72, "Appearance keeps source minimum touch/layout metrics")
        check(metrics.horizontalPadding + metrics.outlineWidth == 19 && metrics.verticalPadding == 14, "Inline inset includes border; block padding is per side")
        check(metrics.outlineWidth == 4, "Explicit outline enables stroke on a filled button")
        check(metrics.iconSize == 40 && metrics.trailingIconSize == 40 && metrics.loadingSize == 28, "Trailing size inherits icon size and loader overrides independently")
        check(metrics.fontSize == 22 && metrics.fontWeight == 700 && metrics.lineHeight == 38 && metrics.letterSpacing == -1 && metrics.gap == 3, "Typography and gap reach resolved native layout")
        for pressed in [false,true] { for selected in [false,true] { for connected in [false,true] {
            let corners = AWCNativeButtonCorners(metrics: metrics, shape: "round", shapeMorph: true, selected: selected, pressed: pressed, connectedLeft: connected)
            check(corners.topLeading == (connected ? metrics.connectedRadius : 7) && corners.bottomLeading == corners.topLeading && corners.topTrailing == (connected ? metrics.roundRadius : 7) && corners.bottomTrailing == corners.topTrailing, "Connected flags take precedence over explicit radius; explicit radius fixes other state morphs")
        } } }
        let separate = AWCNativeButtonMetrics(size: "sm", density: 0, variant: "text", appearance: .init(iconSize: 38, trailingIconSize: 18))
        check(separate.iconSize == 38 && separate.trailingIconSize == 18 && abs(separate.loadingSize - 26.6) < 0.0001, "Separate trailing size wins; loader fallback inherits resolved icon size")
    }
}
