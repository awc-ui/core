import SwiftUI

// md-date-picker hooks: the source's `--md-date-picker-*` custom properties as a CSS-name map (suffix after the prefix →
// CSS value), descendant-wide or per node id, as authored `style` declarations on the host also feed it.

public struct AWCDatePickerAppearance: Equatable, Sendable {
    public private(set) var values: [String: String]
    /// Hook suffix (e.g. "container-color") or full name ("--md-date-picker-container-color") → CSS value.
    public init(_ values: [String: String] = [:]) {
        var v: [String: String] = [:]
        for (k, value) in values {
            let key = k.hasPrefix("--md-date-picker-") ? String(k.dropFirst("--md-date-picker-".count)) : k
            let t = value.trimmingCharacters(in: .whitespaces)
            if !t.isEmpty { v[key] = t }
        }
        self.values = v
    }
    /// `style` declarations ("--md-date-picker-x: v; …").
    public init(style: String) {
        var v: [String: String] = [:]
        for decl in style.split(separator: ";") {
            let p = decl.split(separator: ":", maxSplits: 1).map { $0.trimmingCharacters(in: .whitespaces) }
            if p.count == 2, p[0].hasPrefix("--md-date-picker-") { v[p[0]] = p[1] }
        }
        self.init(v)
    }
    public func merging(_ o: Self) -> Self { var s = self; for (k, v) in o.values { s.values[k] = v }; return s }
    func raw(_ k: String) -> String? { values[k] }
    /// A colour hook as #RRGGBB / #RRGGBBAA (hex, rgb(), rgba(), color-mix() as the table's parser reads them).
    func color(_ k: String) -> String? { values[k].flatMap { AWCTableColor.parse($0) }.map { AWCTableColor.hex($0) } }
    /// A length hook in px (unitless 0 allowed).
    func length(_ k: String) -> Double? {
        guard let t = values[k]?.lowercased() else { return nil }
        if t.hasSuffix("px"), let n = Double(t.dropLast(2).trimmingCharacters(in: .whitespaces)), n.isFinite { return n }
        if let n = Double(t), n.isFinite { return n }
        return nil
    }
    /// A duration hook in ms (ms / s).
    func duration(_ k: String) -> Double? {
        guard let t = values[k]?.lowercased() else { return nil }
        if t.hasSuffix("ms"), let n = Double(t.dropLast(2)) { return n }
        if t.hasSuffix("s"), let n = Double(t.dropLast(1)) { return n * 1000 }
        return nil
    }
    /// An easing hook as cubic-bezier control values (x1, y1, x2, y2; x in 0…1).
    func easing(_ k: String) -> [Double]? {
        guard let t = values[k]?.lowercased().trimmingCharacters(in: .whitespaces), t.hasPrefix("cubic-bezier("), t.hasSuffix(")") else { return nil }
        let v = t.dropFirst(13).dropLast().split(separator: ",").compactMap { Double($0.trimmingCharacters(in: .whitespaces)) }
        return v.count == 4 && v.allSatisfy(\.isFinite) && (0...1).contains(v[0]) && (0...1).contains(v[2]) ? v : nil
    }
    /// A hook-map from the Laboratory / JSON: keys by hook name in camel or kebab case, values as CSS text (numbers are px).
    public init(values: [String: AWCValue]) {
        var hooks: [String: String] = [:]
        for (name, value) in values {
            var key = ""
            for c in name { if c.isUppercase { key += "-" + c.lowercased() } else { key.append(c) } }
            if case .string(let text) = value { hooks[key] = text } else if let n = value.number { hooks[key] = String(n) }
        }
        self.init(hooks)
    }
}

private struct AWCDatePickerAppearanceKey: EnvironmentKey { static let defaultValue = AWCDatePickerAppearance() }
private struct AWCDatePickerAppearanceTargetsKey: EnvironmentKey { static let defaultValue: [String: AWCDatePickerAppearance] = [:] }
private struct AWCDatePickerTodayKey: EnvironmentKey { static let defaultValue: AWCDay? = nil }
extension EnvironmentValues {
    var awcDatePickerAppearance: AWCDatePickerAppearance { get { self[AWCDatePickerAppearanceKey.self] } set { self[AWCDatePickerAppearanceKey.self] = newValue } }
    var awcDatePickerAppearanceTargets: [String: AWCDatePickerAppearance] { get { self[AWCDatePickerAppearanceTargetsKey.self] } set { self[AWCDatePickerAppearanceTargetsKey.self] = newValue } }
    /// "Today" for the calendar (nil: the current date). Tests and previews pin it, as the Web reference pins its clock.
    public var awcDatePickerToday: AWCDay? { get { self[AWCDatePickerTodayKey.self] } set { self[AWCDatePickerTodayKey.self] = newValue } }
}
private struct AWCDatePickerAppearanceModifier: ViewModifier {
    let value: AWCDatePickerAppearance, id: String?
    @Environment(\.awcDatePickerAppearance) private var inherited
    @Environment(\.awcDatePickerAppearanceTargets) private var targets
    func body(content: Content) -> some View {
        if let id { var t = targets; t[id] = (t[id] ?? .init()).merging(value); return AnyView(content.environment(\.awcDatePickerAppearanceTargets, t)) }
        return AnyView(content.environment(\.awcDatePickerAppearance, inherited.merging(value)))
    }
}
public extension View {
    /// md-date-picker hook values for descendant pickers, or for the picker with node id `id`.
    func awcDatePickerAppearance(_ value: AWCDatePickerAppearance, for id: String? = nil) -> some View { modifier(AWCDatePickerAppearanceModifier(value: value, id: id)) }
    /// Pins the calendar's "today" (tests, previews, a server-supplied date).
    func awcDatePickerToday(_ day: AWCDay?) -> some View { environment(\.awcDatePickerToday, day) }
}

/// Resolved geometry for a density scale (`--md-sys-density-scale`) and spacing rung (the `[density]` token rung).
struct AWCDatePickerMetrics {
    let scale: Double, rung: Double
    let daySize, gridGap, weekdaySize, weekdayFont, dayFont, panelWidth, panelMax, dockedWidth, iconSize, shape: Double
    let yearWidth, yearHeight, yearGap, yearPadInline, yearViewport: Double
    let insetXs, insetSm, insetMd, insetLg, insetXl, gapXs, gapSm, gapLg: Double
    let supportingFont, supportingLine, supportingPad, headlineFont, headlineLine, rowMin, menuFont, menuLine, caret, actionsMin, dockedTop, triggerMax: Double
    init(_ a: AWCDatePickerAppearance, scale d: Double, rung r: Double) {
        scale = d; rung = r
        daySize = Swift.max(28, 40 + d * 3); gridGap = Swift.max(2, 6 + d); weekdaySize = 24
        weekdayFont = Swift.max(13, 16 + d * 0.5); dayFont = weekdayFont
        panelWidth = a.length("panel-width") ?? Swift.max(288, 380 + d * 20)
        panelMax = a.length("panel-max-block-size") ?? 524
        dockedWidth = a.length("docked-panel-width") ?? Swift.max(360 + d * 10, panelWidth)
        iconSize = a.length("icon-size") ?? Swift.max(18, 24 + d)
        shape = a.length("container-shape") ?? 28
        yearWidth = a.length("year-inline-size") ?? Swift.max(48, 72 + d * 6); yearHeight = a.length("year-block-size") ?? Swift.max(24, 36 + d * 3)
        yearGap = a.length("year-grid-gap") ?? Swift.max(4, 12 + d * 2); yearPadInline = a.length("year-grid-padding-inline") ?? 30
        yearViewport = a.length("year-grid-viewport-block-size") ?? Swift.max(180, 288 + d * 24)
        insetXs = 4; insetSm = r <= -3 ? 4 : 8; insetMd = r <= -2 ? 8 : 12; insetLg = r <= -4 ? 8 : r <= -2 ? 12 : 16; insetXl = r <= -3 ? 16 : r <= -2 ? 20 : 24
        gapXs = r <= -4 ? 2 : 4; gapSm = r <= -3 ? 4 : 8; gapLg = r <= -4 ? 8 : r <= -2 ? 12 : 16
        supportingFont = Swift.max(10, 12 + d * 0.5); supportingLine = Swift.max(14, 16 + d * 0.5); supportingPad = Swift.max(4, 36 + d * 6)
        headlineFont = Swift.max(24, 32 + d * 2); headlineLine = Swift.max(30, 40 + d * 2.5); rowMin = Swift.max(28, 40 + d * 3)
        menuFont = Swift.max(12, 14 + d * 0.5); menuLine = Swift.max(16, 20 + d); caret = Swift.max(16, 20 + d)
        actionsMin = Swift.max(28, 40 + d * 3); dockedTop = Swift.max(4, 20 + d * 2)
        triggerMax = a.length("trigger-max-width") ?? 360
    }
    /// Day grid height: 6 rows and 5 gaps.
    var gridHeight: Double { 6 * daySize + 5 * gridGap }
}
