import SwiftUI

/// md-slider's exported shadow parts. `md-slider::part(<name>)` rules come from the outer tree, so they win over the hooks and
/// the component's own state rules; natively the same fields are typed (`AWCAccordionPartAppearance`, as md-list / md-accordion)
/// and applied with the source's CSS semantics per part:
/// - `track`: corner shape (the clip of the segments, stops and inset).
/// - `track-active`, `track-inactive`: background colour, corner shape, and the block size (horizontal `height`, vertical
///   `width`) from the track's start edge (they are absolutely placed at `inset-block-start: 0`). The second inactive segment
///   of a centered or range slider is the track's `::after`, not a part.
/// - `thumb-knob`: background colour and size around the thumb centre.
/// - `value-indicator`: background, colour, font size / weight / line height / letter spacing, padding, corner shape.
/// - `inset`: colour (inherited by the icon glyph and by slotted inset-icon content).
/// - `surface`: opacity (multiplies the host's).
/// - `state-layer`: hidden by the source in every state (decision 6), so its fields have nothing to paint.
public enum AWCSliderPart: String, CaseIterable, Sendable, Hashable {
    case surface, track, trackActive = "track-active", trackInactive = "track-inactive", stateLayer = "state-layer"
    case thumbKnob = "thumb-knob", valueIndicator = "value-indicator", inset
}

private struct AWCSliderPartsKey: EnvironmentKey { static let defaultValue: [AWCSliderPart: AWCAccordionPartAppearance] = [:] }
extension EnvironmentValues {
    var awcSliderParts: [AWCSliderPart: AWCAccordionPartAppearance] {
        get { self[AWCSliderPartsKey.self] } set { self[AWCSliderPartsKey.self] = newValue }
    }
}
private struct AWCSliderPartModifier: ViewModifier {
    let part: AWCSliderPart, value: AWCAccordionPartAppearance
    @Environment(\.awcSliderParts) private var inherited
    func body(content: Content) -> some View {
        content.environment(\.awcSliderParts, inherited.merging([part: (inherited[part] ?? .init()).merging(value)]) { _, local in local })
    }
}
public extension View {
    /// `md-slider::part(<part>)` styling for descendant sliders (nearer values win).
    func awcSliderPartAppearance(_ value: AWCAccordionPartAppearance, part: AWCSliderPart) -> some View {
        modifier(AWCSliderPartModifier(part: part, value: value))
    }
}

enum AWCSliderParts {
    /// CSS border-radius on a `w`×`h` box: lengths + percentages, scaled down together when adjacent radii overflow (CSS §5.5).
    static func radii(_ s: AWCCornerShape?, _ w: Double, _ h: Double) -> AWCSliderRadii? {
        guard let s else { return nil }
        func r(_ c: AWCCornerRadius) -> Double { max(0, c.x.points + c.x.fraction * w) }
        var t = AWCSliderRadii(tl: r(s.topLeft), tr: r(s.topRight), br: r(s.bottomRight), bl: r(s.bottomLeft))
        let f = [w / (t.tl + t.tr), w / (t.bl + t.br), h / (t.tl + t.bl), h / (t.tr + t.br)].filter(\.isFinite).reduce(1.0, min)
        if f < 1 { t = AWCSliderRadii(tl: t.tl * f, tr: t.tr * f, br: t.br * f, bl: t.bl * f) }
        return t
    }
    /// The value-indicator part feeds the layout through the value hooks it overrides (its box depends on them).
    static func hooks(_ h: AWCSliderHooks, _ parts: [AWCSliderPart: AWCAccordionPartAppearance]) -> AWCSliderHooks {
        guard let v = parts[.valueIndicator] else { return h }
        var o = h
        if let c = v.backgroundColor { o.valueBg = c }
        if let c = v.color { o.valueColor = c }
        if let f = v.fontSize { o.valueFontSize = f }
        if let w = v.fontWeight { o.valueFontWeight = w }
        if let l = v.lineHeight { o.valueLineHeight = l }
        if let p = v.padding { o.valuePaddingInline = p.left; o.valuePaddingBlock = p.top }
        if let s = v.cornerShape { o.valueShape = s.topLeft.x.points }
        return o
    }
    /// The painted parts after the part rules (the layout itself is unchanged: every overridden box keeps its CSS anchor).
    static func applied(_ paint: AWCSliderPaint, _ parts: [AWCSliderPart: AWCAccordionPartAppearance], vertical: Bool) -> AWCSliderPaint {
        guard !parts.isEmpty else { return paint }
        var p = paint
        func rgba(_ hex: String?) -> AWCSRRGBA? { hex.map { awcSRParseColor($0) } }
        if let o = parts[.surface]?.opacity { p.opacity *= o }
        if let r = radii(parts[.track]?.cornerShape, p.track.width, p.track.height) { p.trackRadius = r.tl }
        for i in p.segments.indices {
            let kind = p.segments[i].kind
            guard let part: AWCSliderPart = kind == "active" ? .trackActive : kind == "inactive" ? .trackInactive : nil, let a = parts[part] else { continue }
            if let c = rgba(a.backgroundColor) { p.segments[i].color = c }
            if !vertical, let h = a.height { p.segments[i].rect.height = h }
            if vertical, let w = a.width { p.segments[i].rect.width = w }
            if let r = radii(a.cornerShape, p.segments[i].rect.width, p.segments[i].rect.height) { p.segments[i].radii = r }
        }
        if let a = parts[.thumbKnob] {
            for i in p.thumbs.indices {
                if let c = rgba(a.backgroundColor) { p.thumbs[i].knobColor = c }
                var k = p.thumbs[i].knob
                let cx = k.x + k.width / 2, cy = k.y + k.height / 2
                if let w = a.width { k.width = w }
                if let h = a.height { k.height = h }
                k.x = cx - k.width / 2; k.y = cy - k.height / 2
                p.thumbs[i].knob = k
            }
        }
        if let ls = parts[.valueIndicator]?.letterSpacing { for i in p.indicators.indices { p.indicators[i].letterSpacing = ls } }
        if let c = rgba(parts[.inset]?.color), p.inset != nil { p.inset?.color = c }
        return p
    }
}

/// md-rating's exported shadow parts. Every rule a part carries feeds the layout through the value it overrides
/// (part rules win over the hooks and the state rules):
/// - `items`: gap. `item` (also `item-full` / `item-half` / `item-empty`, the same element): width / height = the item box (the glyph keeps the item-size hook, centred in it).
/// - `icon-filled`, `icon-empty`: colour. `state-layer`: background colour (hover / press layer).
/// - `value-label`: colour, font size / weight / line height, letter spacing.
/// - `ripple`: md-ripple's own surface (its colour comes from the state-layer colour).
public enum AWCRatingPart: String, CaseIterable, Sendable, Hashable {
    case items, item, iconFilled = "icon-filled", iconEmpty = "icon-empty", stateLayer = "state-layer", ripple, valueLabel = "value-label"
}
private struct AWCRatingPartsKey: EnvironmentKey { static let defaultValue: [AWCRatingPart: AWCAccordionPartAppearance] = [:] }
extension EnvironmentValues {
    var awcRatingParts: [AWCRatingPart: AWCAccordionPartAppearance] {
        get { self[AWCRatingPartsKey.self] } set { self[AWCRatingPartsKey.self] = newValue }
    }
}
private struct AWCRatingPartModifier: ViewModifier {
    let part: AWCRatingPart, value: AWCAccordionPartAppearance
    @Environment(\.awcRatingParts) private var inherited
    func body(content: Content) -> some View {
        content.environment(\.awcRatingParts, inherited.merging([part: (inherited[part] ?? .init()).merging(value)]) { _, local in local })
    }
}
public extension View {
    /// `md-rating::part(<part>)` styling for descendant ratings (nearer values win).
    func awcRatingPartAppearance(_ value: AWCAccordionPartAppearance, part: AWCRatingPart) -> some View {
        modifier(AWCRatingPartModifier(part: part, value: value))
    }
}
enum AWCRatingParts {
    static func hooks(_ h: AWCRatingHooks, _ parts: [AWCRatingPart: AWCAccordionPartAppearance]) -> AWCRatingHooks {
        guard !parts.isEmpty else { return h }
        var o = h
        if let g = parts[.items]?.gap { o.itemGap = g }
        if let it = parts[.item], let s = it.width ?? it.height { o.itemBox = s }   // the box; the glyph keeps --_size
        if let c = parts[.iconFilled]?.color { o.iconFilledColor = c }   // the filled glyph only (not the host colour)
        if let c = parts[.iconEmpty]?.color { o.inactiveColor = c }
        if let c = parts[.stateLayer]?.backgroundColor { o.stateLayerColor = c }
        if let v = parts[.valueLabel] {
            if let c = v.color { o.valueLabelColor = c }
            if let f = v.fontSize { o.valueLabelFontSize = f }
            if let w = v.fontWeight { o.valueLabelFontWeight = w }
            if let l = v.lineHeight { o.valueLabelLineHeight = l }
            if let s = v.letterSpacing { o.valueLabelLetterSpacing = s }
        }
        return o
    }
}
