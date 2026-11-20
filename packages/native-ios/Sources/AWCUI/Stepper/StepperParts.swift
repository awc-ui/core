import SwiftUI

/// md-stepper's exported shadow parts. `md-stepper::part(<name>)` rules come from the outer tree, so they win over the
/// component's own rules; natively the same fields are typed (`AWCAccordionPartAppearance`, as md-list / md-accordion) and
/// applied with the source's CSS semantics:
/// - `list`, `nav`, `mobile-nav`: background colour; `nav` / `mobile-nav` padding (the bar grows by it and its buttons sit
///   inside it — flex-end / space-between as the source).
/// - `content`: background colour and padding. A top padding stops the slotted child's 24px top margin from collapsing
///   through the content box (the margin then sits inside it, as in Chrome).
/// - `mobile-progress`: nothing it can carry is visible — the caption and the dots set their own colours.
public enum AWCStepperPart: String, CaseIterable, Sendable, Hashable {
    case list, content, nav, mobileNav = "mobile-nav", mobileProgress = "mobile-progress"
}

/// md-step's exported shadow parts (applied to every step of the stepper they are declared on):
/// - `bubble` (numbered indicator): background colour, text colour, corner radius (uniform: the top-left corner's value);
///   `dot`: background colour, corner radius. They win over the active / completed / error colours, as `::part` rules do.
/// - `label`, `optional`, `description`: colour, font size / weight / line height, letter spacing (the text boxes are
///   measured with them).
/// - `connector` (and `connector-trailing`, which wins over it): background colour of the track (the fill is the
///   connector's `::after`, not a part). `connector-leading` is display: none in both orientations.
/// - `content`: background colour and padding (the panel box grows by the padding even while collapsed, as the CSS grid does).
/// - `actions`: gap between the Back / Continue buttons.
/// - `state-layer`: background colour. `inner`, `indicator`, `text`: layout boxes only.
public enum AWCStepPart: String, CaseIterable, Sendable, Hashable {
    case inner, indicator, stateLayer = "state-layer", bubble, dot, text, label, optional, description
    case connector, connectorLeading = "connector-leading", connectorTrailing = "connector-trailing", content, actions
}

private struct AWCStepperPartsKey: EnvironmentKey { static let defaultValue: [AWCStepperPart: AWCAccordionPartAppearance] = [:] }
private struct AWCStepPartsKey: EnvironmentKey { static let defaultValue: [AWCStepPart: AWCAccordionPartAppearance] = [:] }
extension EnvironmentValues {
    var awcStepperParts: [AWCStepperPart: AWCAccordionPartAppearance] {
        get { self[AWCStepperPartsKey.self] } set { self[AWCStepperPartsKey.self] = newValue }
    }
    var awcStepParts: [AWCStepPart: AWCAccordionPartAppearance] {
        get { self[AWCStepPartsKey.self] } set { self[AWCStepPartsKey.self] = newValue }
    }
}
private struct AWCStepperPartModifier: ViewModifier {
    let part: AWCStepperPart, value: AWCAccordionPartAppearance
    @Environment(\.awcStepperParts) private var inherited
    func body(content: Content) -> some View {
        content.environment(\.awcStepperParts, inherited.merging([part: (inherited[part] ?? .init()).merging(value)]) { _, local in local })
    }
}
private struct AWCStepPartModifier: ViewModifier {
    let part: AWCStepPart, value: AWCAccordionPartAppearance
    @Environment(\.awcStepParts) private var inherited
    func body(content: Content) -> some View {
        content.environment(\.awcStepParts, inherited.merging([part: (inherited[part] ?? .init()).merging(value)]) { _, local in local })
    }
}
public extension View {
    /// `md-stepper::part(<part>)` styling for descendant steppers (nearer values win).
    func awcStepperPartAppearance(_ value: AWCAccordionPartAppearance, part: AWCStepperPart) -> some View {
        modifier(AWCStepperPartModifier(part: part, value: value))
    }
    /// `md-step::part(<part>)` styling for the steps of descendant steppers and standalone steps (nearer values win).
    func awcStepPartAppearance(_ value: AWCAccordionPartAppearance, part: AWCStepPart) -> some View {
        modifier(AWCStepPartModifier(part: part, value: value))
    }
}

enum AWCStepperParts {
    /// A uniform CSS border-radius on a `size` box (the top-left corner's length + percentage).
    static func radius(_ s: AWCCornerShape?, _ size: Double) -> Double? {
        guard let c = s?.topLeft.x else { return nil }
        return Swift.max(0, c.points + c.fraction * size)
    }
    /// The painted parts after the part rules that do not move a box (the layout already applied the metric ones: text
    /// metrics, paddings). Colours replace the state targets, so a part colour does not transition between states.
    static func applied(_ paint: AWCStepperPaint, step: [AWCStepPart: AWCAccordionPartAppearance], stepper: [AWCStepperPart: AWCAccordionPartAppearance]) -> AWCStepperPaint {
        guard !(step.isEmpty && stepper.isEmpty) else { return paint }
        var p = paint
        func rgba(_ hex: String?) -> AWCStepperRGBA? { hex.flatMap(awcStepperColor) }
        p.listBackground = rgba(stepper[.list]?.backgroundColor)
        p.contentBackground = rgba(stepper[.content]?.backgroundColor)
        p.navBackground = rgba(stepper[.nav]?.backgroundColor)
        p.mobileNavBackground = rgba(stepper[.mobileNav]?.backgroundColor)
        func box(_ a: AWCAccordionPartAppearance?, _ r: AWCStepperRect?) -> AWCStepperBox? {
            guard let a, let r, !r.isEmpty, a.backgroundColor != nil || (a.borderWidth ?? 0) > 0 else { return nil }
            var b = AWCStepperBox()
            b.background = rgba(a.backgroundColor); b.borderWidth = a.borderWidth ?? 0; b.borderColor = rgba(a.borderColor)
            b.radius = radius(a.cornerShape, Swift.min(r.width, r.height)) ?? 0
            return b
        }
        p.mobileProgressBox = box(stepper[.mobileProgress], p.mobileProgress)
        let connector = (step[.connector] ?? .init()).merging(step[.connectorTrailing] ?? .init())
        for i in p.steps.indices {
            var s = p.steps[i]
            s.innerBox = box(step[.inner], s.inner); s.indicatorBox = box(step[.indicator], s.indicator); s.textBox = box(step[.text], s.text)
            if let a = step[s.dot ? .dot : .bubble] {
                if let c = rgba(a.backgroundColor) { s.bubbleColor = c }
                if s.bubbleText != nil, let c = rgba(a.color) { s.bubbleText = c }
                if let r = radius(a.cornerShape, s.bubbleSize) { s.bubbleRadius = r }
            }
            if let c = rgba(step[.stateLayer]?.backgroundColor) { s.stateColor = c }
            for k in s.lines.indices {
                if let part = AWCStepPart(rawValue: s.lines[k].part), let c = rgba(step[part]?.color) { s.lines[k].color = c }
            }
            if let cn = s.connector, let c = rgba(connector.backgroundColor) { s.connector = (cn.rect, c, cn.fill, cn.fillColor, cn.vertical) }
            if s.panel != nil, let c = rgba(step[.content]?.backgroundColor) { s.panelBackground = c }
            p.steps[i] = s
        }
        return p
    }
}
