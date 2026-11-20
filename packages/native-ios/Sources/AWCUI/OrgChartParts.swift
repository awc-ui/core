import SwiftUI

/// md-organization-chart's exported `::part()` targets (14), styled with the shared sparse part vocabulary (AWCPartStyle).
/// Part rules come from the outer tree, so they win over the hooks and the parts' own state rules. What each part shows:
/// - viewport: background-color, border-radius, opacity, padding (the scroll box around the tree)
/// - tree, group, branch, branch-on-path: background-color, border-radius, opacity (the list boxes behind the connectors)
/// - node, node-selected (a selected card takes both, node-selected last): background-color, border-radius, opacity, padding
/// - state-layer: background-color, opacity (a part opacity replaces the hover / pressed / selected opacities)
/// - avatar: opacity; avatar-image (md-avatar's image): opacity
/// - name, title: color, font-size, font-weight, letter-spacing, opacity
/// - toggle (the md-icon-button host): background-color, border-radius, opacity
/// - empty: color, background-color, border-radius, opacity, padding, font-size, font-weight, letter-spacing
public enum AWCOrgChartPart: String, CaseIterable, Sendable, Hashable {
    case viewport, tree, group, branch, branchOnPath = "branch-on-path", node, nodeSelected = "node-selected", stateLayer = "state-layer"
    case avatar, avatarImage = "avatar-image", name, title, toggle, empty
    public init?(part: String) { self.init(rawValue: part) }
}
/// md-organization-chart's name for the shared part vocabulary.
public typealias AWCOrgChartPartAppearance = AWCPartStyle

/// The resolved part declarations of one chart.
struct AWCOrgChartParts: Equatable {
    var styles: [AWCOrgChartPart: AWCPartStyle] = [:]
    subscript(_ p: AWCOrgChartPart) -> AWCPartStyle { styles[p] ?? .init() }
    /// A card's declarations: ::part(node), then ::part(node-selected) on a selected card.
    func node(selected: Bool) -> AWCPartStyle { selected ? self[.node].merging(self[.nodeSelected]) : self[.node] }
    /// A branch's declarations: ::part(branch), then ::part(branch-on-path) on the selection path.
    func branch(onPath: Bool) -> AWCPartStyle { onPath ? self[.branch].merging(self[.branchOnPath]) : self[.branch] }
    var isEmpty: Bool { styles.values.allSatisfy(\.isEmpty) }
    /// Any part opacity around the tree items (branch, branch-on-path, group, tree).
    var fades: Bool { [AWCOrgChartPart.branch, .branchOnPath, .group, .tree].contains { self[$0].opacity != nil } }
}

private struct AWCOrgChartPartsKey: EnvironmentKey { static let defaultValue: [AWCOrgChartPart: AWCPartStyle] = [:] }
private struct AWCOrgChartPartTargetsKey: EnvironmentKey { static let defaultValue: [String: [AWCOrgChartPart: AWCPartStyle]] = [:] }
extension EnvironmentValues {
    var awcOrgChartParts: [AWCOrgChartPart: AWCPartStyle] { get { self[AWCOrgChartPartsKey.self] } set { self[AWCOrgChartPartsKey.self] = newValue } }
    var awcOrgChartPartTargets: [String: [AWCOrgChartPart: AWCPartStyle]] { get { self[AWCOrgChartPartTargetsKey.self] } set { self[AWCOrgChartPartTargetsKey.self] = newValue } }
}
private struct AWCOrgChartPartModifier: ViewModifier {
    let styles: [AWCOrgChartPart: AWCPartStyle], id: String?
    @Environment(\.awcOrgChartParts) private var inherited
    @Environment(\.awcOrgChartPartTargets) private var targets
    func body(content: Content) -> some View {
        if let id {
            var t = targets; var own = t[id] ?? [:]
            for (p, s) in styles { own[p] = (own[p] ?? .init()).merging(s) }
            t[id] = own; return AnyView(content.environment(\.awcOrgChartPartTargets, t))
        }
        var all = inherited; for (p, s) in styles { all[p] = (all[p] ?? .init()).merging(s) }
        return AnyView(content.environment(\.awcOrgChartParts, all))
    }
}
public extension View {
    /// `::part()` styling for the organization charts in this view (`for`: only the chart with that node id).
    func awcOrgChartPartAppearance(_ part: AWCOrgChartPart, _ style: AWCOrgChartPartAppearance, for id: String? = nil) -> some View {
        modifier(AWCOrgChartPartModifier(styles: [part: style], id: id))
    }
    /// Several parts at once.
    func awcOrgChartPartAppearance(_ styles: [AWCOrgChartPart: AWCOrgChartPartAppearance], for id: String? = nil) -> some View {
        modifier(AWCOrgChartPartModifier(styles: styles, id: id))
    }
}
extension EnvironmentValues {
    /// The part declarations of the chart with node id `id` (the shared rules under its own).
    func awcOrgChartParts(id: String) -> AWCOrgChartParts {
        var out = awcOrgChartParts
        for (p, s) in awcOrgChartPartTargets[id] ?? [:] { out[p] = (out[p] ?? .init()).merging(s) }
        return .init(styles: out)
    }
}

enum AWCOrgChartFonts {
    /// The bundled Roboto face for a CSS weight (600 and up resolve to the 700 face, 500 to Medium).
    static func face(_ weight: Double) -> String { weight >= 600 ? "Roboto-Bold" : weight >= 500 ? "Roboto-Medium" : "Roboto-Regular" }
    /// `line-height: normal` of Roboto at `size` (Blink: rounded ascent + rounded descent, no line gap).
    static func normalLine(_ size: Double) -> Double { (0.927734375 * size).rounded() + (0.244140625 * size).rounded() }
}
