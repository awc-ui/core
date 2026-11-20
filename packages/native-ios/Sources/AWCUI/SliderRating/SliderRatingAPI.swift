import SwiftUI

// Public native API of md-slider and md-rating: typed hook appearances (the `--md-slider-*` / `--md-rating-*` custom
// properties, inherited like CSS — nearer values win, the host's own inline `style` wins over all) and md-rating's
// method controller.

// MARK: - Slider

/// Typed `--md-slider-*` hooks (24): colours as CSS colour text, lengths in points, font weight 1…1000.
public struct AWCSliderAppearance: Equatable, Sendable {
    public let css: [String: String]
    static let suffixes = ["track-length", "active-color", "inactive-color", "track-shape", "track-height", "tick-active-color", "tick-filled-color",
                           "tick-inactive-color", "thumb-color", "thumb-width", "thumb-height", "value-bg", "value-color", "value-shape", "value-font-family",
                           "value-font-size", "value-font-weight", "value-line-height", "value-padding-inline", "value-padding-block", "inset-icon-color",
                           "inset-icon-active-color", "min-track-length", "value-indicator-reserve"]
    public init(trackLength: Double? = nil, activeColor: String? = nil, inactiveColor: String? = nil, trackShape: Double? = nil, trackHeight: Double? = nil,
                tickActiveColor: String? = nil, tickFilledColor: String? = nil, tickInactiveColor: String? = nil, thumbColor: String? = nil,
                thumbWidth: Double? = nil, thumbHeight: Double? = nil, valueBackground: String? = nil, valueColor: String? = nil, valueShape: Double? = nil,
                valueFontFamily: String? = nil, valueFontSize: Double? = nil, valueFontWeight: Double? = nil, valueLineHeight: Double? = nil,
                valuePaddingInline: Double? = nil, valuePaddingBlock: Double? = nil, insetIconColor: String? = nil, insetIconActiveColor: String? = nil,
                minTrackLength: Double? = nil, valueIndicatorReserve: Double? = nil) {
        var h = AWCSRHookText()
        h.px("track-length", trackLength); h.text("active-color", activeColor); h.text("inactive-color", inactiveColor); h.px("track-shape", trackShape)
        h.px("track-height", trackHeight); h.text("tick-active-color", tickActiveColor); h.text("tick-filled-color", tickFilledColor)
        h.text("tick-inactive-color", tickInactiveColor); h.text("thumb-color", thumbColor); h.px("thumb-width", thumbWidth); h.px("thumb-height", thumbHeight)
        h.text("value-bg", valueBackground); h.text("value-color", valueColor); h.px("value-shape", valueShape); h.text("value-font-family", valueFontFamily)
        h.px("value-font-size", valueFontSize); h.plain("value-font-weight", valueFontWeight); h.px("value-line-height", valueLineHeight)
        h.px("value-padding-inline", valuePaddingInline); h.px("value-padding-block", valuePaddingBlock); h.text("inset-icon-color", insetIconColor)
        h.text("inset-icon-active-color", insetIconActiveColor); h.px("min-track-length", minTrackLength)
        h.px("value-indicator-reserve", valueIndicatorReserve)
        css = h.css
    }
    public init(cssValues: [String: String]) { css = cssValues.filter { Self.suffixes.contains($0.key) } }
    public init(values: [String: AWCValue]) {
        func n(_ k: String) -> Double? { values[k]?.number }
        func s(_ k: String) -> String? { values[k]?.string }
        self.init(trackLength: n("trackLength"), activeColor: s("activeColor"), inactiveColor: s("inactiveColor"), trackShape: n("trackShape"),
                  trackHeight: n("trackHeight"), tickActiveColor: s("tickActiveColor"), tickFilledColor: s("tickFilledColor"),
                  tickInactiveColor: s("tickInactiveColor"), thumbColor: s("thumbColor"), thumbWidth: n("thumbWidth"), thumbHeight: n("thumbHeight"),
                  valueBackground: s("valueBackground"), valueColor: s("valueColor"), valueShape: n("valueShape"), valueFontFamily: s("valueFontFamily"),
                  valueFontSize: n("valueFontSize"), valueFontWeight: n("valueFontWeight"), valueLineHeight: n("valueLineHeight"),
                  valuePaddingInline: n("valuePaddingInline"), valuePaddingBlock: n("valuePaddingBlock"), insetIconColor: s("insetIconColor"),
                  insetIconActiveColor: s("insetIconActiveColor"), minTrackLength: n("minTrackLength"), valueIndicatorReserve: n("valueIndicatorReserve"))
    }
    public func merging(_ o: Self) -> Self { .init(cssValues: css.merging(o.css) { _, new in new }) }
    var hooks: [String: String] { Dictionary(uniqueKeysWithValues: css.map { ("--md-slider-\($0.key)", $0.value) }) }
}

// MARK: - Rating

/// Typed `--md-rating-*` hooks (13): colours as CSS colour text, lengths in points, `valueLabelFont` a CSS `font`
/// shorthand, `popScale` a number, `duration` in ms, `iconFontFamily` a font family.
public struct AWCRatingAppearance: Equatable, Sendable {
    public let css: [String: String]
    static let suffixes = ["item-size", "item-gap", "active-color", "inactive-color", "focus-ring-color", "focus-ring-width", "focus-ring-offset",
                           "state-layer-color", "value-label-color", "value-label-font", "pop-scale", "duration", "icon-font-family"]
    public init(itemSize: Double? = nil, itemGap: Double? = nil, activeColor: String? = nil, inactiveColor: String? = nil, focusRingColor: String? = nil,
                focusRingWidth: Double? = nil, focusRingOffset: Double? = nil, stateLayerColor: String? = nil, valueLabelColor: String? = nil,
                valueLabelFont: String? = nil, popScale: Double? = nil, duration: Double? = nil, iconFontFamily: String? = nil) {
        var h = AWCSRHookText()
        h.px("item-size", itemSize); h.px("item-gap", itemGap); h.text("active-color", activeColor); h.text("inactive-color", inactiveColor)
        h.text("focus-ring-color", focusRingColor); h.px("focus-ring-width", focusRingWidth); h.px("focus-ring-offset", focusRingOffset)
        h.text("state-layer-color", stateLayerColor); h.text("value-label-color", valueLabelColor); h.text("value-label-font", valueLabelFont)
        h.plain("pop-scale", popScale); h.ms("duration", duration); h.text("icon-font-family", iconFontFamily)
        css = h.css
    }
    public init(cssValues: [String: String]) { css = cssValues.filter { Self.suffixes.contains($0.key) } }
    public init(values: [String: AWCValue]) {
        func n(_ k: String) -> Double? { values[k]?.number }
        func s(_ k: String) -> String? { values[k]?.string }
        self.init(itemSize: n("itemSize"), itemGap: n("itemGap"), activeColor: s("activeColor"), inactiveColor: s("inactiveColor"),
                  focusRingColor: s("focusRingColor"), focusRingWidth: n("focusRingWidth"), focusRingOffset: n("focusRingOffset"),
                  stateLayerColor: s("stateLayerColor"), valueLabelColor: s("valueLabelColor"), valueLabelFont: s("valueLabelFont"),
                  popScale: n("popScale"), duration: n("duration"), iconFontFamily: s("iconFontFamily"))
    }
    public func merging(_ o: Self) -> Self { .init(cssValues: css.merging(o.css) { _, new in new }) }
    var hooks: [String: String] { Dictionary(uniqueKeysWithValues: css.map { ("--md-rating-\($0.key)", $0.value) }) }
}

/// md-rating's method: `focusRating()` moves keyboard focus to the rating (the source focuses its radiogroup host).
@MainActor @Observable public final class AWCRatingController {
    @ObservationIgnored var focus: (() -> Void)?
    /// The source's `getLabel` property: the value's text for the value label and the accessible value (nil: "N Stars").
    public var getLabel: ((Double) -> String)?
    nonisolated public init() {}
    public var isConnected: Bool { focus != nil }
    public func focusRating() { focus?() }
}

// MARK: - Environment

private struct AWCSliderAppearanceKey: EnvironmentKey { static let defaultValue = AWCSliderAppearance() }
private struct AWCRatingAppearanceKey: EnvironmentKey { static let defaultValue = AWCRatingAppearance() }
private struct AWCRatingControllerKey: EnvironmentKey { static let defaultValue: AWCRatingController? = nil }
public extension EnvironmentValues {
    var awcSliderAppearance: AWCSliderAppearance { get { self[AWCSliderAppearanceKey.self] } set { self[AWCSliderAppearanceKey.self] = newValue } }
    var awcRatingAppearance: AWCRatingAppearance { get { self[AWCRatingAppearanceKey.self] } set { self[AWCRatingAppearanceKey.self] = newValue } }
    var awcRatingController: AWCRatingController? { get { self[AWCRatingControllerKey.self] } set { self[AWCRatingControllerKey.self] = newValue } }
}
private struct AWCSRAppearanceModifier<V: Equatable>: ViewModifier {
    let keyPath: WritableKeyPath<EnvironmentValues, V>
    let merge: (V) -> V
    @Environment(\.self) private var env
    func body(content: Content) -> some View { content.environment(keyPath, merge(env[keyPath: keyPath])) }
}
public extension View {
    /// Applies md-slider hook values to descendant sliders (inherited; nearer values win).
    func awcSliderAppearance(_ value: AWCSliderAppearance) -> some View { modifier(AWCSRAppearanceModifier(keyPath: \.awcSliderAppearance) { $0.merging(value) }) }
    /// Applies md-rating hook values to descendant ratings (inherited; nearer values win).
    func awcRatingAppearance(_ value: AWCRatingAppearance) -> some View { modifier(AWCSRAppearanceModifier(keyPath: \.awcRatingAppearance) { $0.merging(value) }) }
    /// Binds `focusRating()` of the rating element below.
    func awcRatingController(_ controller: AWCRatingController) -> some View { environment(\.awcRatingController, controller) }
}
