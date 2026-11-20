import SwiftUI
import Observation
import CoreText

// MARK: - Hooks

/// md-navigation-rail-tab's public hooks (`--md-navigation-rail-tab-*`, the source stylesheet's documented list). Colours
/// are `#RRGGBB(AA)`, lengths points, the indicator shape one corner radius (9999 = full), opacities 0…1, the caret
/// duration milliseconds. `labelTypography` is accepted and, as on Web (no rule reads it), has no effect.
public struct AWCNavigationRailTabAppearance: Equatable, Sendable {
    public let activeIconColor: String?, activeLabelColor: String?, badgeColor: String?, badgeContentColor: String?
    public let caretDuration: Double?, focusRingColor: String?, focusStateLayerOpacity: Double?
    public let iconColor: String?, iconSize: Double?, indicatorColor: String?, indicatorHeight: Double?, indicatorShape: Double?, indicatorWidth: Double?
    public let labelColor: String?, labelTypography: String?, minHeight: Double?, pressStateLayerOpacity: Double?, stateLayerColor: String?
    public init(activeIconColor: String? = nil, activeLabelColor: String? = nil, badgeColor: String? = nil, badgeContentColor: String? = nil,
                caretDuration: Double? = nil, focusRingColor: String? = nil, focusStateLayerOpacity: Double? = nil,
                iconColor: String? = nil, iconSize: Double? = nil, indicatorColor: String? = nil, indicatorHeight: Double? = nil, indicatorShape: Double? = nil,
                indicatorWidth: Double? = nil, labelColor: String? = nil, labelTypography: String? = nil, minHeight: Double? = nil,
                pressStateLayerOpacity: Double? = nil, stateLayerColor: String? = nil) {
        func len(_ v: Double?) -> Double? { v.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil } }
        func unit(_ v: Double?) -> Double? { v.flatMap { $0.isFinite ? min(1, max(0, $0)) : nil } }
        self.activeIconColor = awcSwitchColor(activeIconColor); self.activeLabelColor = awcSwitchColor(activeLabelColor)
        self.badgeColor = awcSwitchColor(badgeColor); self.badgeContentColor = awcSwitchColor(badgeContentColor)
        self.caretDuration = len(caretDuration); self.focusRingColor = awcSwitchColor(focusRingColor); self.focusStateLayerOpacity = unit(focusStateLayerOpacity)
        self.iconColor = awcSwitchColor(iconColor); self.iconSize = len(iconSize); self.indicatorColor = awcSwitchColor(indicatorColor)
        self.indicatorHeight = len(indicatorHeight); self.indicatorShape = len(indicatorShape); self.indicatorWidth = len(indicatorWidth)
        self.labelColor = awcSwitchColor(labelColor)
        self.labelTypography = labelTypography.map { $0.trimmingCharacters(in: .whitespaces) }.flatMap { $0.isEmpty ? nil : $0 }
        self.minHeight = len(minHeight); self.pressStateLayerOpacity = unit(pressStateLayerOpacity); self.stateLayerColor = awcSwitchColor(stateLayerColor)
    }
    /// Laboratory names (the CSS hook without `--md-navigation-rail-tab-`, camel-cased).
    public init(values: [String: AWCValue]) {
        func s(_ k: String) -> String? { values[k]?.string }
        func n(_ k: String) -> Double? { values[k]?.number }
        self.init(activeIconColor: s("activeIconColor"), activeLabelColor: s("activeLabelColor"), badgeColor: s("badgeColor"), badgeContentColor: s("badgeContentColor"),
                  caretDuration: n("caretDuration"), focusRingColor: s("focusRingColor"), focusStateLayerOpacity: n("focusStateLayerOpacity"),
                  iconColor: s("iconColor"), iconSize: n("iconSize"), indicatorColor: s("indicatorColor"), indicatorHeight: n("indicatorHeight"),
                  indicatorShape: n("indicatorShape"), indicatorWidth: n("indicatorWidth"), labelColor: s("labelColor"), labelTypography: s("labelTypography"),
                  minHeight: n("minHeight"), pressStateLayerOpacity: n("pressStateLayerOpacity"), stateLayerColor: s("stateLayerColor"))
    }
    public func merging(_ o: Self) -> Self {
        .init(activeIconColor: o.activeIconColor ?? activeIconColor, activeLabelColor: o.activeLabelColor ?? activeLabelColor, badgeColor: o.badgeColor ?? badgeColor,
              badgeContentColor: o.badgeContentColor ?? badgeContentColor, caretDuration: o.caretDuration ?? caretDuration, focusRingColor: o.focusRingColor ?? focusRingColor,
              focusStateLayerOpacity: o.focusStateLayerOpacity ?? focusStateLayerOpacity, iconColor: o.iconColor ?? iconColor, iconSize: o.iconSize ?? iconSize,
              indicatorColor: o.indicatorColor ?? indicatorColor, indicatorHeight: o.indicatorHeight ?? indicatorHeight, indicatorShape: o.indicatorShape ?? indicatorShape,
              indicatorWidth: o.indicatorWidth ?? indicatorWidth, labelColor: o.labelColor ?? labelColor, labelTypography: o.labelTypography ?? labelTypography,
              minHeight: o.minHeight ?? minHeight, pressStateLayerOpacity: o.pressStateLayerOpacity ?? pressStateLayerOpacity, stateLayerColor: o.stateLayerColor ?? stateLayerColor)
    }
    static func number(_ raw: String?) -> Double? {
        raw.flatMap { Double($0.replacingOccurrences(of: "px", with: "").replacingOccurrences(of: "ms", with: "").trimmingCharacters(in: .whitespaces)) }
    }
    /// Source hook text (`--md-navigation-rail-tab-*` → value) as the paint fixtures author it.
    public init(css: [String: String]) {
        let t = "--md-navigation-rail-tab-"
        func s(_ k: String) -> String? { css[t + k] }
        func n(_ k: String) -> Double? { Self.number(css[t + k]) }
        self.init(activeIconColor: s("active-icon-color"), activeLabelColor: s("active-label-color"), badgeColor: s("badge-color"), badgeContentColor: s("badge-content-color"),
                  caretDuration: n("caret-duration"), focusRingColor: s("focus-ring-color"), focusStateLayerOpacity: n("focus-state-layer-opacity"),
                  iconColor: s("icon-color"), iconSize: n("icon-size"), indicatorColor: s("indicator-color"), indicatorHeight: n("indicator-height"),
                  indicatorShape: n("indicator-shape"), indicatorWidth: n("indicator-width"), labelColor: s("label-color"), labelTypography: s("label-typography"),
                  minHeight: n("min-height"), pressStateLayerOpacity: n("press-state-layer-opacity"), stateLayerColor: s("state-layer-color"))
    }
}

/// md-navigation-rail's nineteen hooks (`--md-navigation-rail-*`) plus the md-navigation-rail-tab hooks set on the rail,
/// which every destination inherits. The container shape is the CSS border-radius corners (physical), the elevation the
/// CSS box-shadow layers.
public struct AWCNavigationRailAppearance: Equatable, Sendable {
    public let containerColor: String?, containerElevation: [AWCBoxShadow]?, containerShape: AWCCornerShape?
    public let containerWidth: Double?, contentColor: String?, destinationsGap: Double?, expandedMaxWidth: Double?, expandedWidth: Double?
    public let fabSize: Double?, footerGap: Double?, footerLeadingSize: Double?, gap: Double?, headerSpace: Double?
    public let horizontalHeight: Double?, horizontalPaddingBlock: Double?, horizontalPaddingInline: Double?, logoIconSize: Double?
    public let paddingBlock: Double?, paddingInline: Double?
    public let tab: AWCNavigationRailTabAppearance
    public init(containerColor: String? = nil, containerElevation: [AWCBoxShadow]? = nil, containerShape: AWCCornerShape? = nil, containerWidth: Double? = nil,
                contentColor: String? = nil, destinationsGap: Double? = nil, expandedMaxWidth: Double? = nil, expandedWidth: Double? = nil, fabSize: Double? = nil,
                footerGap: Double? = nil, footerLeadingSize: Double? = nil, gap: Double? = nil, headerSpace: Double? = nil, horizontalHeight: Double? = nil,
                horizontalPaddingBlock: Double? = nil, horizontalPaddingInline: Double? = nil, logoIconSize: Double? = nil, paddingBlock: Double? = nil,
                paddingInline: Double? = nil, tab: AWCNavigationRailTabAppearance = .init()) {
        func len(_ v: Double?) -> Double? { v.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil } }
        self.containerColor = awcSwitchColor(containerColor); self.containerElevation = containerElevation; self.containerShape = containerShape
        self.containerWidth = len(containerWidth); self.contentColor = awcSwitchColor(contentColor); self.destinationsGap = len(destinationsGap)
        self.expandedMaxWidth = len(expandedMaxWidth); self.expandedWidth = len(expandedWidth); self.fabSize = len(fabSize); self.footerGap = len(footerGap)
        self.footerLeadingSize = len(footerLeadingSize); self.gap = len(gap); self.headerSpace = len(headerSpace); self.horizontalHeight = len(horizontalHeight)
        self.horizontalPaddingBlock = len(horizontalPaddingBlock); self.horizontalPaddingInline = len(horizontalPaddingInline); self.logoIconSize = len(logoIconSize)
        self.paddingBlock = len(paddingBlock); self.paddingInline = len(paddingInline); self.tab = tab
    }
    /// Laboratory names: the rail hooks plus every md-navigation-rail-tab hook (inherited by the destinations).
    public init(values: [String: AWCValue]) {
        let shape: AWCCornerShape? = { if case .object(let o)? = values["containerShape"] { return AWCCornerShape(values: o) }; return nil }()
        let elevation: [AWCBoxShadow]? = { if case .array(let a)? = values["containerElevation"] {
            let layers = a.compactMap { v -> AWCBoxShadow? in if case .object(let o) = v { return AWCBoxShadow(values: o) }; return nil }
            return layers.count == a.count ? layers : nil }; return nil }()
        func n(_ k: String) -> Double? { values[k]?.number }
        self.init(containerColor: values["containerColor"]?.string, containerElevation: elevation, containerShape: shape, containerWidth: n("containerWidth"),
                  contentColor: values["contentColor"]?.string, destinationsGap: n("destinationsGap"), expandedMaxWidth: n("expandedMaxWidth"),
                  expandedWidth: n("expandedWidth"), fabSize: n("fabSize"), footerGap: n("footerGap"), footerLeadingSize: n("footerLeadingSize"), gap: n("gap"),
                  headerSpace: n("headerSpace"), horizontalHeight: n("horizontalHeight"), horizontalPaddingBlock: n("horizontalPaddingBlock"),
                  horizontalPaddingInline: n("horizontalPaddingInline"), logoIconSize: n("logoIconSize"), paddingBlock: n("paddingBlock"),
                  paddingInline: n("paddingInline"), tab: AWCNavigationRailTabAppearance(values: values))
    }
    public func merging(_ o: Self) -> Self {
        .init(containerColor: o.containerColor ?? containerColor, containerElevation: o.containerElevation ?? containerElevation, containerShape: o.containerShape ?? containerShape,
              containerWidth: o.containerWidth ?? containerWidth, contentColor: o.contentColor ?? contentColor, destinationsGap: o.destinationsGap ?? destinationsGap,
              expandedMaxWidth: o.expandedMaxWidth ?? expandedMaxWidth, expandedWidth: o.expandedWidth ?? expandedWidth, fabSize: o.fabSize ?? fabSize,
              footerGap: o.footerGap ?? footerGap, footerLeadingSize: o.footerLeadingSize ?? footerLeadingSize, gap: o.gap ?? gap, headerSpace: o.headerSpace ?? headerSpace,
              horizontalHeight: o.horizontalHeight ?? horizontalHeight, horizontalPaddingBlock: o.horizontalPaddingBlock ?? horizontalPaddingBlock,
              horizontalPaddingInline: o.horizontalPaddingInline ?? horizontalPaddingInline, logoIconSize: o.logoIconSize ?? logoIconSize,
              paddingBlock: o.paddingBlock ?? paddingBlock, paddingInline: o.paddingInline ?? paddingInline, tab: tab.merging(o.tab))
    }
    /// Source hook text (`--md-navigation-rail-*` / `--md-navigation-rail-tab-*` → value) as the paint fixtures author it.
    public init(css: [String: String]) {
        let r = "--md-navigation-rail-"
        func s(_ k: String) -> String? { css[r + k] }
        func n(_ k: String) -> Double? { AWCNavigationRailTabAppearance.number(css[r + k]) }
        self.init(containerColor: s("container-color"), containerElevation: s("container-elevation").flatMap { AWCBoxShadow.source($0) },
                  containerShape: s("container-shape").flatMap(AWCNavigationBarAppearance.corners(css:)), containerWidth: n("container-width"),
                  contentColor: s("content-color"), destinationsGap: n("destinations-gap"), expandedMaxWidth: n("expanded-max-width"), expandedWidth: n("expanded-width"),
                  fabSize: n("fab-size"), footerGap: n("footer-gap"), footerLeadingSize: n("footer-leading-size"), gap: n("gap"), headerSpace: n("header-space"),
                  horizontalHeight: n("horizontal-height"), horizontalPaddingBlock: n("horizontal-padding-block"), horizontalPaddingInline: n("horizontal-padding-inline"),
                  logoIconSize: n("logo-icon-size"), paddingBlock: n("padding-block"), paddingInline: n("padding-inline"), tab: AWCNavigationRailTabAppearance(css: css))
    }
}

/// md-navigation-rail's methods: `expand()`, `collapse()`, `toggle()` (each emits mdExpand / mdCollapse when the variant
/// changes), `focusTab(index)` (moves keyboard focus and the roving tab stop, no selection) and the destinations'
/// `clearSubmenuSelection()` by index.
@MainActor @Observable public final class AWCNavigationRailController {
    @ObservationIgnored var variantHandler: ((String?) -> Void)?
    @ObservationIgnored var focusHandler: ((Int) -> Void)?
    @ObservationIgnored var clearHandler: ((Int) -> Void)?
    nonisolated public init() {}
    public func expand() { variantHandler?("expanded") }
    public func collapse() { variantHandler?("standard") }
    public func toggle() { variantHandler?(nil) }
    public func focusTab(_ index: Int) { focusHandler?(index) }
    public func clearSubmenuSelection(tabIndex: Int) { clearHandler?(tabIndex) }
}
// MARK: - Parts

/// md-navigation-rail's CSS parts (CEM order). Part rules come from the outer tree, so a native part appearance wins over
/// the hooks and every internal state rule (an opacity replaces the part's own state-driven opacity). Every part honours
/// `backgroundColor`, `cornerShape` and `opacity` on its source box (the opacity also covers what the part contains);
/// `color` inherits to the footer profile text (footer, footer-profile, footer-content) and inks the overflow trigger;
/// `gap` sets the destinations' spacing (destinations), the footer items' spacing (footer) and the profile's leading →
/// text gap (footer-profile); footer-content also takes `fontSize`, `fontWeight` and `letterSpacing`.
public enum AWCNavigationRailPart: String, CaseIterable, Sendable, Hashable {
    case scrim, container, logo, logoContracted = "logo-contracted", logoExpanded = "logo-expanded", toggle, header, fab, destinations
    case overflow, overflowTrigger = "overflow-trigger", footer, footerProfile = "footer-profile", footerLeading = "footer-leading", footerContent = "footer-content"
}
/// md-navigation-rail-tab's CSS parts (CEM order). indicator: `backgroundColor` (every destination, whatever its state),
/// `cornerShape` (also the state layer's), `width` / `height`, `opacity`; state-layer: `backgroundColor`, `opacity` (fixed
/// in every state); icon-wrapper: `backgroundColor`, `cornerShape`, `opacity`, `color` (inherited by the icon); icon:
/// `color`, `fontSize` (the glyph inside its unchanged box), `opacity`; label: `color`, `fontSize`, `lineHeight`,
/// `fontWeight`, `letterSpacing`, `opacity`; caret: `color`, `opacity`; anchor (link destinations; `display: contents`
/// paints nothing): `color`, inherited by the icon.
public enum AWCNavigationRailTabPart: String, CaseIterable, Sendable, Hashable {
    case indicator, label, iconWrapper = "icon-wrapper", icon, stateLayer = "state-layer", caret, anchor
}
/// The shared sparse part vocabulary (md-accordion / md-list).
public typealias AWCNavigationRailPartAppearance = AWCAccordionPartAppearance
private struct AWCNavigationRailPartsKey: EnvironmentKey { static let defaultValue: [AWCNavigationRailPart: AWCNavigationRailPartAppearance] = [:] }
private struct AWCNavigationRailTabPartsKey: EnvironmentKey { static let defaultValue: [AWCNavigationRailTabPart: AWCNavigationRailPartAppearance] = [:] }
private struct AWCNavigationRailTabPartTargetsKey: EnvironmentKey { static let defaultValue: [String: [AWCNavigationRailTabPart: AWCNavigationRailPartAppearance]] = [:] }
extension EnvironmentValues {
    var awcNavigationRailParts: [AWCNavigationRailPart: AWCNavigationRailPartAppearance] { get { self[AWCNavigationRailPartsKey.self] } set { self[AWCNavigationRailPartsKey.self] = newValue } }
    var awcNavigationRailTabParts: [AWCNavigationRailTabPart: AWCNavigationRailPartAppearance] { get { self[AWCNavigationRailTabPartsKey.self] } set { self[AWCNavigationRailTabPartsKey.self] = newValue } }
    var awcNavigationRailTabPartTargets: [String: [AWCNavigationRailTabPart: AWCNavigationRailPartAppearance]] { get { self[AWCNavigationRailTabPartTargetsKey.self] } set { self[AWCNavigationRailTabPartTargetsKey.self] = newValue } }
}
private struct AWCNavigationRailPartModifier: ViewModifier {
    let part: AWCNavigationRailPart, value: AWCNavigationRailPartAppearance
    @Environment(\.awcNavigationRailParts) private var inherited
    func body(content: Content) -> some View {
        content.environment(\.awcNavigationRailParts, inherited.merging([part: (inherited[part] ?? .init()).merging(value)]) { _, local in local })
    }
}
private struct AWCNavigationRailTabPartModifier: ViewModifier {
    let part: AWCNavigationRailTabPart, value: AWCNavigationRailPartAppearance, id: String?
    @Environment(\.awcNavigationRailTabParts) private var inherited
    @Environment(\.awcNavigationRailTabPartTargets) private var targets
    @ViewBuilder func body(content: Content) -> some View {
        if let id {
            let updated: [String: [AWCNavigationRailTabPart: AWCNavigationRailPartAppearance]] = {
                var updated = targets
                updated[id, default: [:]][part] = (targets[id]?[part] ?? .init()).merging(value)
                return updated
            }()
            content.environment(\.awcNavigationRailTabPartTargets, updated)
        } else {
            content.environment(\.awcNavigationRailTabParts, inherited.merging([part: (inherited[part] ?? .init()).merging(value)]) { _, local in local })
        }
    }
}
public extension View {
    /// `md-navigation-rail::part(<part>)` styling for the rails in this subtree.
    func awcNavigationRailPartAppearance(_ value: AWCNavigationRailPartAppearance, part: AWCNavigationRailPart) -> some View {
        modifier(AWCNavigationRailPartModifier(part: part, value: value))
    }
    /// `md-navigation-rail-tab::part(<part>)` styling for every destination in this subtree, or — with `id` — only for the
    /// destination whose node id matches (declared on it, so it wins over the subtree value).
    func awcNavigationRailTabPartAppearance(_ value: AWCNavigationRailPartAppearance, part: AWCNavigationRailTabPart, for id: String? = nil) -> some View {
        modifier(AWCNavigationRailTabPartModifier(part: part, value: value, id: id))
    }
}

private struct AWCNavigationRailAppearanceKey: EnvironmentKey { static let defaultValue = AWCNavigationRailAppearance() }
private struct AWCNavigationRailTabAppearanceKey: EnvironmentKey { static let defaultValue = AWCNavigationRailTabAppearance() }
private struct AWCNavigationRailControllerKey: EnvironmentKey { static let defaultValue: AWCNavigationRailController? = nil }
private struct AWCNavigationRailReducedMotionKey: EnvironmentKey { static let defaultValue: Bool? = nil }
private struct AWCNavigationRailViewportKey: EnvironmentKey { static let defaultValue: CGSize? = nil }
private struct AWCFabRailSizeKey: EnvironmentKey { static let defaultValue: Double? = nil }
public extension EnvironmentValues {
    var awcNavigationRailAppearance: AWCNavigationRailAppearance { get { self[AWCNavigationRailAppearanceKey.self] } set { self[AWCNavigationRailAppearanceKey.self] = newValue } }
    var awcNavigationRailTabAppearance: AWCNavigationRailTabAppearance { get { self[AWCNavigationRailTabAppearanceKey.self] } set { self[AWCNavigationRailTabAppearanceKey.self] = newValue } }
    var awcNavigationRailController: AWCNavigationRailController? { get { self[AWCNavigationRailControllerKey.self] } set { self[AWCNavigationRailControllerKey.self] = newValue } }
    /// Overrides the system Reduce Motion setting for the navigation rail (nil follows the system).
    var awcNavigationRailReducedMotion: Bool? { get { self[AWCNavigationRailReducedMotionKey.self] } set { self[AWCNavigationRailReducedMotionKey.self] = newValue } }
    /// The viewport a `fullHeight` rail spans (Web `100dvh`); nil spans the height proposed to it.
    var awcNavigationRailViewport: CGSize? { get { self[AWCNavigationRailViewportKey.self] } set { self[AWCNavigationRailViewportKey.self] = newValue } }
}
extension EnvironmentValues {
    /// A vertical navigation rail's fab-size, read by its slotted md-fab (the labelled FAB's icon inset).
    var awcFabRailSize: Double? { get { self[AWCFabRailSizeKey.self] } set { self[AWCFabRailSizeKey.self] = newValue } }
}
private struct AWCNavigationRailAppearanceModifier: ViewModifier {
    let value: AWCNavigationRailAppearance
    @Environment(\.awcNavigationRailAppearance) private var inherited
    func body(content: Content) -> some View { content.environment(\.awcNavigationRailAppearance, inherited.merging(value)) }
}
private struct AWCNavigationRailTabAppearanceModifier: ViewModifier {
    let value: AWCNavigationRailTabAppearance
    @Environment(\.awcNavigationRailTabAppearance) private var inherited
    func body(content: Content) -> some View { content.environment(\.awcNavigationRailTabAppearance, inherited.merging(value)) }
}
public extension View {
    func awcNavigationRailAppearance(_ value: AWCNavigationRailAppearance) -> some View { modifier(AWCNavigationRailAppearanceModifier(value: value)) }
    func awcNavigationRailTabAppearance(_ value: AWCNavigationRailTabAppearance) -> some View { modifier(AWCNavigationRailTabAppearanceModifier(value: value)) }
    func awcNavigationRailController(_ controller: AWCNavigationRailController) -> some View { environment(\.awcNavigationRailController, controller) }
}

// MARK: - Model

/// One md-navigation-rail-tab as the rail sees it.
struct AWCRailTabSpec {
    let node: AWCNode
    var id: String { node.id }
    var p: [String: AWCValue] { node.properties }
    var label: String { p["label"]?.string ?? "" }
    var icon: String { p["icon"]?.string ?? "" }
    var value: String { p["value"]?.string ?? "" }
    /// `disabled`: dimmed, skipped, never activated. `aria-disabled="true"`: skipped and not activated, painted normally.
    var disabled: Bool { p["disabled"]?.bool == true }
    /// `hidden` (display: none): the destination keeps its index; the rail gives it no box, and it draws and announces nothing.
    var hidden: Bool { p["hidden"]?.bool == true }
    var ariaDisabled: Bool { p["aria-disabled"]?.string == "true" || p["aria-disabled"]?.bool == true || p["ariaDisabled"]?.string == "true" }
    var ariaLabel: String? { [p["aria-label"]?.string, p["ariaLabel"]?.string].compactMap { $0 }.first { !$0.isEmpty } }
    var href: String { p["href"]?.string ?? "" }
    var target: String { p["target"]?.string ?? "" }
    var slotIcon: AWCNode? { node.children.first { $0.slot == "icon" } }
    var menu: AWCNode? { node.children.first { $0.slot == "submenu" && $0.tag == "md-menu" } }
    var menuItems: [AWCNode] { menu?.children.filter { $0.tag == "md-menu-item" } ?? [] }
    /// A link destination: an accepted `href` on an enabled destination (source `sanitizeHref`).
    var isLink: Bool { !disabled && !href.isEmpty && AWCURLRouter(baseURL: URL(string: "https://native.invalid/")) { _ in false }.request(href: href, nodeID: "") != nil }
    /// nil: no badge; "": the dot; text: the large badge (a number above 999 reads "999+").
    var badge: String? {
        let raw: String = { if case .number(let n)? = p["badgeValue"] { return n == n.rounded() && abs(n) < 1e15 ? String(Int(n)) : String(n) }; return p["badgeValue"]?.string ?? "" }()
        if !raw.isEmpty { if let n = Double(raw.trimmingCharacters(in: .whitespaces)), n.isFinite, n > 999 { return "999+" }; return raw }
        return p["badge"]?.bool == true ? "" : nil
    }
    var badgeName: String? { badge.map { $0.isEmpty ? "new notifications" : "\($0) new notifications" } }
    /// Web accessible name: a link reads its label; a destination whose label is not rendered reads aria-label, else its
    /// label; otherwise aria-label, else the content (the badge status, then the label text).
    func name(labelRendered: Bool) -> String {
        if isLink { return label.isEmpty ? (ariaLabel ?? "") : label }
        if label.isEmpty { return ariaLabel ?? (badgeName ?? "") }
        if !labelRendered { return ariaLabel ?? label }
        return ariaLabel ?? [badgeName, label].compactMap { $0 }.joined(separator: " ")
    }
}

/// Rail lengths (every value derives from --md-sys-density-scale by calc) and its hooks.
struct AWCRailMetrics {
    let d: Double, look: AWCNavigationRailAppearance
    var parts: [AWCNavigationRailPart: AWCNavigationRailPartAppearance] = [:]
    var containerWidth: Double { look.containerWidth ?? max(56, 80 + 4 * d) }
    var fabSize: Double { look.fabSize ?? 56 }
    var expandedWidth: Double { look.expandedWidth ?? max(140, 220 + 20 * d) }
    var expandedMax: Double { look.expandedMaxWidth ?? 360 }
    var paddingBlock: Double { look.paddingBlock ?? max(24, 44 + 4 * d) }
    /// The expanded rail's inset (spacing-inset-md) replaces the hook, as the source's expanded rule does.
    func paddingInline(_ expanded: Bool) -> Double { expanded ? 12 : look.paddingInline ?? 0 }
    var gap: Double { look.gap ?? 12 }
    var headerSpace: Double { look.headerSpace ?? max(20, 40 + 4 * d) }
    var destinationsGap: Double { look.destinationsGap ?? max(0, 8 + 2 * d) }
    var logoIconSize: Double { look.logoIconSize ?? 24 }
    var footerLeading: Double { look.footerLeadingSize ?? 32 }
    var footerGap: Double { look.footerGap ?? 12 }
    /// The destinations' spacing (part `destinations` gap wins over the hook).
    var tabGap: Double { parts[.destinations]?.gap ?? destinationsGap }
    /// The footer's item spacing (its own `gap: var(--_destinations-gap)`; part `footer` gap wins).
    var footerItemGap: Double { parts[.footer]?.gap ?? destinationsGap }
    /// The profile's leading → text gap (part `footer-profile` gap wins over the hook).
    var profileGap: Double { parts[.footerProfile]?.gap ?? footerGap }
    var horizontalHeight: Double { look.horizontalHeight ?? max(64, 72 + 4 * d) }
    var horizontalPaddingBlock: Double { look.horizontalPaddingBlock ?? 0 }
    var horizontalPaddingInline: Double { look.horizontalPaddingInline ?? 12 }
    var overflowHeight: Double { max(40, 56 + 2 * d) }
    var overflowIcon: Double { max(18, 24 + d) }
    /// The host width: inline-size / min-inline-size / max-inline-size resolve to the (min-winning) width.
    func width(_ expanded: Bool) -> Double { expanded ? expandedWidth : containerWidth }
}

/// Destination lengths (the destination's own density rung wins over the rail's) and the destination hooks.
struct AWCRailTabMetrics {
    let d: Double, look: AWCNavigationRailTabAppearance
    var parts: [AWCNavigationRailTabPart: AWCNavigationRailPartAppearance] = [:]
    var indicatorWidth: Double { look.indicatorWidth ?? max(40, 56 + 4 * d) }
    var indicatorHeight: Double { look.indicatorHeight ?? max(24, 32 + 2 * d) }
    var iconSize: Double { look.iconSize ?? max(18, 24 + d) }
    var minHeight: Double { max(48, (look.minHeight ?? 56) + 4 * d) }
    var expandedMinHeight: Double { max(48, 56 + 4 * d) }
    var padBlock: Double { max(0, 2 + 0.5 * d) }
    var gap: Double { max(2, 4 + d) }
    var indicatorTop: Double { max(2, 2 - 0.5 * d) }
    var labelSize: Double { parts[.label]?.fontSize ?? max(10, 12 + 0.5 * d) }
    var lineHeight: Double { parts[.label]?.lineHeight ?? max(14, 16 + 0.5 * d) }
    /// The pill (part `indicator` width / height win over the hooks; the icon wrapper keeps the hooked size).
    var pillWidth: Double { parts[.indicator]?.width ?? indicatorWidth }
    var pillHeight: Double { parts[.indicator]?.height ?? indicatorHeight }
    /// Label-large in an expanded rail; part typography wins in every layout.
    var expandedLabelSize: Double { parts[.label]?.fontSize ?? 14 }
    var expandedLineHeight: Double { parts[.label]?.lineHeight ?? 20 }
    func labelTracking(_ expanded: Bool) -> Double { parts[.label]?.letterSpacing ?? (expanded ? 0.1 : 0.5) }
    func labelWeight(_ active: Bool) -> Double { parts[.label]?.fontWeight ?? (active ? 700 : 500) }
    /// The built-in glyph's font size (part `icon` font-size; its box keeps the icon size).
    var glyphSize: Double { parts[.icon]?.fontSize ?? iconSize }
    var shape: Double { look.indicatorShape ?? 9999 }
    var caretSize: Double { max(14, 18 + d) }
    func radius(_ r: CGRect) -> Double { min(shape, Double(min(r.width, r.height)) / 2) }
    /// The indicator's corners: the part's corner shape, else the hooked radius.
    func indicatorCorners(_ r: CGRect) -> AWCCornerShape { parts[.indicator]?.cornerShape ?? .points(radius(r)) }
    /// The inspected indicator radius (the top-left corner, clamped to the box like CSS).
    func indicatorRadius(_ r: CGRect) -> Double {
        guard let c = parts[.indicator]?.cornerShape else { return radius(r) }
        return min(Double(c.topLeft.x.points) + Double(c.topLeft.x.fraction) * Double(r.width), Double(min(r.width, r.height)) / 2)
    }
}

/// Tab-local geometry (points, logical: x from the destination's inline-start edge).
struct AWCRailTabGeometry {
    var frame = CGRect.zero
    var indicator = CGRect.zero, iconWrapper = CGRect.zero, icon = CGRect.zero
    var label: CGRect? = nil, labelOpacity = 1.0, labelTextWidth = 0.0
    var caret: CGRect? = nil
    var overflowed = false
}

struct AWCRailGeometry {
    var size = CGSize.zero
    var container = CGRect.zero
    var logo: CGRect?, toggle: CGRect?, header: CGRect?, fab: CGRect?, fabItem: CGRect?
    var destinations = CGRect.zero
    var overflow: CGRect?, footer: CGRect?, profile: CGRect?, leading: CGRect?, content: CGRect?
    var footerItems: [CGRect] = []
    var tabs: [AWCRailTabGeometry] = []
    var surface = CGRect.zero
    var naturalHeight = 0.0
}

struct AWCRailLayoutInput {
    var specs: [AWCRailTabSpec]
    var metrics: AWCRailMetrics
    var tabMetrics: [AWCRailTabMetrics]
    var activeIndex: Int
    var labelVisibility: String
    var alignment = "top"
    var expanded: Bool
    var horizontal: Bool
    var modal: Bool
    var overflowed: Set<Int>
    var overflowCount: Int
    var overflowLabel: String
    var height: Double
    var hasLogo = false, logoSize = CGSize(width: 24, height: 24), hasToggle = false, hasHeader = false, headerSize = CGSize.zero
    var hasFab = false, fabLabelled = false, fabSize = CGSize(width: 56, height: 56), hasFooterProfile = false, hasFooterLeading = false, leadingHeight = 32.0, contentWidth = 0.0, contentHeight = 19.0
    var footerItems: [CGSize] = []
    var reveal: [Double] = []
    var submenuSelected: Set<Int> = []
    var proposedWidth = 0.0
    /// A destination alone (md-navigation-rail-tab outside a rail).
    var standalone = false
    /// The modal surface as rendered (its inset / size transition); nil: the layout's own (final) surface.
    var surface: CGRect? = nil
}

enum AWCRailLayout {
    static func textWidth(_ text: String, size: Double, weight: Double, tracking: Double) -> Double {
        text.isEmpty ? 0 : AWCNativeFonts.navigationTextWidth(text, size: CGFloat(size), weight: weight, tracking: tracking)
    }
    /// A collapsed (stacked) or horizontal destination: pill over the label, centred in a min-height column.
    static func stacked(_ s: AWCRailTabSpec, _ m: AWCRailTabMetrics, active: Bool, visibility: String, width: Double, height: Double?, reveal: Double, childSelected: Bool) -> AWCRailTabGeometry {
        var g = AWCRailTabGeometry()
        let hasLabel = !s.label.isEmpty && visibility != "none"
        let selectedMode = visibility == "selected"
        // The selected-only reveal: max-block 0 → 1.25rem, margin −4 → 0, opacity 0 → 1 (inactive ↔ active).
        let p = selectedMode ? reveal : 1
        let labelH = hasLabel ? min(m.lineHeight, 20 * p) : 0, margin = hasLabel ? -4 * (1 - p) : 0
        let content = m.indicatorHeight + (hasLabel ? m.gap + margin + labelH : 0)
        let h = height ?? max(m.minHeight, content + 2 * m.padBlock)
        let top = m.padBlock + (h - 2 * m.padBlock - content) / 2
        g.frame = CGRect(x: 0, y: 0, width: width, height: h)
        g.iconWrapper = CGRect(x: (width - m.indicatorWidth) / 2, y: top, width: m.indicatorWidth, height: m.indicatorHeight)
        let centred = visibility == "none" || (selectedMode && !active)
        g.indicator = CGRect(x: (width - m.pillWidth) / 2, y: centred ? (h - m.pillHeight) / 2 : m.indicatorTop, width: m.pillWidth, height: m.pillHeight)
        g.icon = CGRect(x: (width - m.iconSize) / 2, y: top + (m.indicatorHeight - m.iconSize) / 2, width: m.iconSize, height: m.iconSize)
        if hasLabel {
            let weight = m.labelWeight(active)
            let text = textWidth(s.label, size: m.labelSize, weight: weight, tracking: m.labelTracking(false))
            let caret = s.menu != nil ? caretWidth(m) + 2 : 0
            let lw = min(width, text + caret + 8)
            g.labelTextWidth = text
            g.label = CGRect(x: (width - lw) / 2, y: top + m.indicatorHeight + m.gap + margin, width: lw, height: labelH)
            g.labelOpacity = p
            if s.menu != nil { g.caret = CGRect(x: g.label!.minX + 4 + text + 2, y: g.label!.midY - 11, width: caretWidth(m), height: 22) }
        }
        return g
    }
    static func caretWidth(_ m: AWCRailTabMetrics) -> Double { m.caretSize * 1.006 }
    /// An expanded destination: a pill that hugs icon and label (16 + icon + 8 + label + 16), the icon on the collapsed axis.
    static func expanded(_ s: AWCRailTabSpec, _ m: AWCRailTabMetrics, active: Bool, visibility: String, axis: Double, available: Double) -> AWCRailTabGeometry {
        var g = AWCRailTabGeometry()
        let showLabel = !s.label.isEmpty && (visibility == "all" || (visibility == "selected" && active))
        let start = axis - m.iconSize / 2
        let weight = m.labelWeight(active)
        let text = showLabel ? textWidth(s.label, size: m.expandedLabelSize, weight: weight, tracking: m.labelTracking(true)) : 0
        let caret = showLabel && s.menu != nil ? caretWidth(m) + 2 : 0
        let lw = showLabel ? text + caret + 8 : 0
        let natural = start + m.iconSize + (showLabel ? 8 + lw : 0) + 16
        // fit-content: the label does not wrap (white-space: nowrap), so its min-content is its max-content — the pill keeps
        // its natural width even past the rail (clipped by the destinations' overflow-x).
        let w = natural
        _ = available
        let lineH = m.expandedLineHeight + (showLabel && s.menu != nil ? 0.297 : 0)
        let h = max(m.expandedMinHeight, max(m.iconSize, showLabel ? lineH : 0))
        g.frame = CGRect(x: 0, y: 0, width: w, height: h)
        // inset: 0 with auto sizes; a part width centres (margin-inline: auto), a part height sits at the top.
        let pw = m.parts[.indicator]?.width, ph = m.parts[.indicator]?.height
        g.indicator = CGRect(x: pw.map { (w - $0) / 2 } ?? 0, y: 0, width: pw ?? w, height: ph ?? h)
        g.iconWrapper = CGRect(x: start, y: (h - m.iconSize) / 2, width: m.iconSize, height: m.iconSize)
        g.icon = g.iconWrapper
        if showLabel {
            // The label shrinks (ellipsis) when the pill would outgrow the rail.
            let lx = start + m.iconSize + 8
            g.labelTextWidth = text
            g.label = CGRect(x: lx, y: (h - lineH) / 2, width: max(0, min(lw, w - 16 - lx)), height: lineH)
            if s.menu != nil { g.caret = CGRect(x: lx + 4 + text + 2, y: (h - lineH) / 2 + (lineH - 22) / 2 + 0.297, width: caretWidth(m), height: 22) }
        }
        return g
    }

    static func compute(_ i: AWCRailLayoutInput) -> AWCRailGeometry {
        i.horizontal ? horizontal(i) : vertical(i)
    }

    static func vertical(_ i: AWCRailLayoutInput) -> AWCRailGeometry {
        var out = AWCRailGeometry()
        let m = i.metrics, padI = m.paddingInline(i.expanded)
        let cw = m.containerWidth
        // Modal: the in-flow host is the collapsed footprint; the surface floats (16 from the edges when expanded).
        let hostW = i.modal ? cw : m.width(i.expanded)
        out.size = CGSize(width: hostW, height: i.height)
        let finalSurface: CGRect = {
            guard i.modal else { return CGRect(x: 0, y: 0, width: hostW, height: i.height) }
            return i.expanded ? CGRect(x: 16, y: 16, width: min(m.expandedWidth, m.expandedMax), height: max(0, i.height - 32)) : CGRect(x: 0, y: 0, width: cw, height: i.height)
        }()
        let surface = i.surface ?? finalSurface
        out.surface = surface
        let finalAvailable = Double(finalSurface.width) - 2 * padI
        let pb = m.paddingBlock
        let c = CGRect(x: surface.minX + padI, y: surface.minY + pb, width: max(0, surface.width - 2 * padI), height: max(0, surface.height - 2 * pb))
        out.container = c
        // Sections in source order; the destinations take the remaining block size (flex 1 1 auto, min 0).
        enum Item { case logo, toggle, header, fab, destinations, overflow, footer }
        var items: [(Item, Double)] = []
        if i.hasLogo { items.append((.logo, 48)) }
        if i.hasToggle { items.append((.toggle, 48)) }
        if i.hasHeader { items.append((.header, max(56, Double(i.headerSize.height)) + 4)) }
        if i.hasFab { items.append((.fab, Double(i.fabSize.height) + 8)) }
        items.append((.destinations, 0))
        if i.overflowCount > 0 { items.append((.overflow, m.overflowHeight)) }
        // The profile row: min-block-size footer-leading-size; the leading box is footer-leading-size wide, its child's height high.
        let profileH = i.hasFooterProfile ? max(m.footerLeading, i.contentHeight, i.hasFooterLeading ? i.leadingHeight : 0) : 0
        let footerItemsH = i.footerItems.reduce(0.0) { $0 + Double($1.height) } + Double(max(0, i.footerItems.count - 1 + (i.hasFooterProfile ? 1 : 0))) * m.footerItemGap
        let hasFooter = i.hasFooterProfile || !i.footerItems.isEmpty
        if hasFooter { items.append((.footer, 8 + profileH + footerItemsH)) }
        let fixed = items.reduce(0.0) { $0 + $1.1 }
        let destH = max(0, Double(c.height) - fixed - m.gap * Double(items.count - 1))
        var y = Double(c.minY)
        let footerPad = i.expanded ? 8.0 : 0
        for (kind, hh) in items {
            let h = kind == .destinations ? destH : hh
            let r = CGRect(x: c.minX, y: y, width: c.width, height: h)
            switch kind {
            case .logo: out.logo = r
            case .toggle: out.toggle = r
            case .header: out.header = r
            case .fab:
                out.fab = r
                // A labelled FAB keeps its icon on the collapsed axis: inline-start at (container − fab-size) / 2 from
                // the host edge; an icon-only FAB centres on the axis with its own width.
                let fw = Double(i.fabSize.width), labelled = i.fabLabelled
                let x = surface.minX + (labelled ? (cw - m.fabSize) / 2 : cw / 2 - fw / 2)
                out.fabItem = CGRect(x: x, y: y, width: fw, height: Double(i.fabSize.height))
            case .destinations: out.destinations = r
            case .overflow: out.overflow = r
            case .footer:
                out.footer = r
                var fy = y + 8
                if i.hasFooterProfile {
                    let px = surface.minX + (cw - m.footerLeading) / 2
                    let pw = max(0, Double(c.maxX) - px)
                    out.profile = CGRect(x: px, y: fy, width: pw, height: profileH)
                    out.leading = CGRect(x: px, y: fy + (profileH - i.leadingHeight) / 2, width: m.footerLeading, height: i.leadingHeight)
                    let cx = px + m.footerLeading + m.profileGap
                    out.content = CGRect(x: cx, y: fy + (profileH - i.contentHeight) / 2, width: max(0, Double(c.maxX) - cx), height: i.contentHeight)
                    fy += profileH + m.footerItemGap
                }
                for s in i.footerItems {
                    out.footerItems.append(CGRect(x: Double(c.minX) + footerPad, y: fy, width: Double(s.width), height: Double(s.height))); fy += Double(s.height) + m.footerItemGap
                }
            }
            y += h + m.gap
        }
        // Destinations: block padding 5 (header-space − gap after a header or FAB), justified by `alignment`.
        let d = out.destinations
        let padTop = (i.hasHeader || i.hasFab) ? m.headerSpace - m.gap : 5
        var tabs: [AWCRailTabGeometry] = []
        for (k, s) in i.specs.enumerated() {
            let tm = i.tabMetrics[k], active = k == i.activeIndex
            var g: AWCRailTabGeometry
            if i.expanded {
                g = expanded(s, tm, active: active, visibility: i.labelVisibility, axis: cw / 2 - padI, available: finalAvailable)
            } else {
                g = stacked(s, tm, active: active, visibility: i.labelVisibility, width: cw - 2 * padI, height: nil,
                            reveal: k < i.reveal.count ? i.reveal[k] : (active ? 1 : 0), childSelected: i.submenuSelected.contains(k))
            }
            g.overflowed = i.overflowed.contains(k) || i.specs[k].hidden
            tabs.append(g)
        }
        let shown = tabs.indices.filter { !tabs[$0].overflowed }
        let content = shown.reduce(0.0) { $0 + Double(tabs[$1].frame.height) } + m.tabGap * Double(max(0, shown.count - 1))
        let box = Double(d.height) - padTop - 5
        var ty = Double(d.minY) + padTop
        out.tabs = tabs
        out.naturalHeight = 2 * pb + fixed + m.gap * Double(items.count - 1) + padTop + 5 + content
        let offset: Double = { switch i.alignment { case "middle": return (box - content) / 2; case "bottom": return box - content; default: return 0 } }()
        ty += offset
        for k in shown {
            out.tabs[k].frame.origin = CGPoint(x: d.minX, y: ty)
            ty += Double(tabs[k].frame.height) + m.tabGap
        }
        if i.standalone, let s = i.specs.first, !out.tabs.isEmpty {
            // A destination alone is Web's lone md-navigation-rail-tab: inline-size 100% of its box (the pill and label centred),
            // its own block size (min-block-size 56), at the box's origin; no rail around it.
            let w = max(cw, i.proposedWidth)
            var g = stacked(s, i.tabMetrics[0], active: i.activeIndex == 0, visibility: i.labelVisibility, width: w, height: nil,
                            reveal: !i.reveal.isEmpty ? i.reveal[0] : (i.activeIndex == 0 ? 1 : 0), childSelected: false)
            g.frame.origin = .zero
            out.tabs = [g]
            let box = CGRect(origin: .zero, size: g.frame.size)
            out.size = box.size; out.surface = box; out.container = box; out.destinations = box; out.naturalHeight = Double(box.height)
        }
        return out
    }

    static func shownTotal(_ tabs: [AWCRailTabGeometry], _ shown: [Int], _ m: AWCRailMetrics) -> Double {
        shown.reduce(0.0) { $0 + Double(tabs[$1].frame.width) } + m.tabGap * Double(max(0, shown.count - 1))
    }
    static func horizontal(_ i: AWCRailLayoutInput) -> AWCRailGeometry {
        var out = AWCRailGeometry()
        let m = i.metrics, cw = m.containerWidth
        let W = i.proposedWidth, pb = m.horizontalPaddingBlock, pi = m.horizontalPaddingInline
        // Natural widths of the destinations (min container width), the trigger and the side sections.
        var tabs: [AWCRailTabGeometry] = []
        for (k, s) in i.specs.enumerated() {
            let tm = i.tabMetrics[k], active = k == i.activeIndex
            let hasLabel = !s.label.isEmpty && i.labelVisibility != "none"
            let text = hasLabel ? textWidth(s.label, size: tm.labelSize, weight: tm.labelWeight(active), tracking: tm.labelTracking(false)) + (s.menu != nil ? caretWidth(tm) + 2 : 0) + 8 : 0
            let w = max(cw, tm.indicatorWidth, text)
            var g = stacked(s, tm, active: active, visibility: i.labelVisibility, width: w, height: nil, reveal: k < i.reveal.count ? i.reveal[k] : (active ? 1 : 0), childSelected: false)
            g.overflowed = i.overflowed.contains(k) || i.specs[k].hidden
            tabs.append(g)
        }
        let shown = tabs.indices.filter { !tabs[$0].overflowed }
        let naturalTab = shown.map { Double(tabs[$0].frame.height) }.max() ?? 0
        let fabWrapW = i.hasFab ? max(0, (cw - m.fabSize) / 2) + Double(i.fabSize.width) : 0
        let fabWrapH = i.hasFab ? Double(i.fabSize.height) + 8 : 0
        let logoW = i.hasLogo ? 16 + Double(i.logoSize.width) : 0
        let profileW = i.hasFooterProfile ? m.footerLeading + m.profileGap + i.contentWidth : 0
        let footerW = (i.hasFooterProfile || !i.footerItems.isEmpty) ? 8 + profileW + i.footerItems.reduce(0.0) { $0 + Double($1.width) } + m.footerItemGap * Double(max(0, i.footerItems.count - (i.hasFooterProfile ? 0 : 1))) : 0
        let overflowW = i.overflowCount > 0 ? max(cw, textWidth(i.overflowLabel, size: 12, weight: 500, tracking: 0.5) + 16) : 0
        let rowNatural = max(naturalTab, fabWrapH, i.hasFooterProfile ? max(m.footerLeading, i.contentHeight, i.hasFooterLeading ? i.leadingHeight : 0) : 0, i.overflowCount > 0 ? m.overflowHeight : 0,
                             i.hasLogo ? Double(i.logoSize.height) : 0, i.hasHeader ? Double(i.headerSize.height) : 0)
        let rowH = max(m.horizontalHeight - 2 * pb, rowNatural)
        out.size = CGSize(width: W, height: rowH + 2 * pb)
        let c = CGRect(x: pi, y: pb, width: max(0, W - 2 * pi), height: rowH)
        out.container = c
        enum Item { case logo, header, fab, destinations, overflow, footer }
        var items: [(Item, Double)] = []
        if i.hasLogo { items.append((.logo, logoW)) }
        if i.hasHeader { items.append((.header, Double(i.headerSize.width))) }
        if i.hasFab { items.append((.fab, fabWrapW)) }
        items.append((.destinations, 0))
        if i.overflowCount > 0 { items.append((.overflow, overflowW)) }
        if footerW > 0 { items.append((.footer, footerW)) }
        var headerW = Double(i.headerSize.width)
        var destW: Double
        if i.hasHeader {
            // Header basis 100% and the destinations' content basis shrink in proportion to their bases (flex-shrink 1);
            // the header keeps its min-content width, the destinations may shrink to 0.
            let others = items.filter { $0.0 != .header && $0.0 != .destinations }.reduce(0.0) { $0 + $1.1 } + m.gap * Double(items.count - 1)
            // The scaled shrink factors are the inner (content-box) bases: the destinations' padding does not shrink.
            let headerBase = Double(c.width), destInner = shownTotal(tabs, shown, m), destBase = destInner + (m.headerSpace - m.gap) + 5
            let space = Double(c.width) - others - headerBase - destBase
            if space < 0 {
                headerW = max(Double(i.headerSize.width), headerBase + space * headerBase / (headerBase + destInner))
                destW = max(0, Double(c.width) - others - headerW)
            } else { headerW = headerBase; destW = destBase + space }
        } else {
            let fixed = items.reduce(0.0) { $0 + $1.1 }
            destW = max(0, Double(c.width) - fixed - m.gap * Double(items.count - 1))
        }
        var x = Double(c.minX)
        for (kind, ww) in items {
            let w = kind == .destinations ? destW : kind == .header ? headerW : ww
            let r = CGRect(x: x, y: c.minY, width: w, height: c.height)
            switch kind {
            case .logo: out.logo = r
            case .header: out.header = r
            case .fab:
                out.fab = r
                let fx = x + max(0, (cw - m.fabSize) / 2)
                out.fabItem = CGRect(x: fx, y: Double(c.minY) + (Double(c.height) - 8 - Double(i.fabSize.height)) / 2, width: Double(i.fabSize.width), height: Double(i.fabSize.height))
            case .destinations: out.destinations = r
            case .overflow: out.overflow = r
            case .footer:
                out.footer = r
                var fx = x + 8
                if i.hasFooterProfile {
                    let ph = max(m.footerLeading, i.contentHeight, i.hasFooterLeading ? i.leadingHeight : 0)
                    out.profile = CGRect(x: fx, y: Double(c.midY) - ph / 2, width: profileW, height: ph)
                    out.leading = CGRect(x: fx, y: Double(c.midY) - i.leadingHeight / 2, width: m.footerLeading, height: i.leadingHeight)
                    out.content = CGRect(x: fx + m.footerLeading + m.profileGap, y: Double(c.midY) - i.contentHeight / 2, width: i.contentWidth, height: i.contentHeight)
                    fx += profileW + m.footerItemGap
                }
                for s in i.footerItems { out.footerItems.append(CGRect(x: fx, y: Double(c.midY) - Double(s.height) / 2, width: Double(s.width), height: Double(s.height))); fx += Double(s.width) + m.footerItemGap }
            }
            x += w + m.gap
        }
        // Destinations: a centred row (stretching to the bar's height), inline padding 5 (header-space − gap after a FAB).
        let d = out.destinations
        let padStart = (i.hasHeader || i.hasFab) ? m.headerSpace - m.gap : 5
        let total = shown.reduce(0.0) { $0 + Double(tabs[$1].frame.width) } + m.tabGap * Double(max(0, shown.count - 1))
        var tx = Double(d.minX) + padStart + (Double(d.width) - padStart - 5 - total) / 2
        out.tabs = tabs
        for k in shown {
            let s = i.specs[k], tm = i.tabMetrics[k]
            var g = stacked(s, tm, active: k == i.activeIndex, visibility: i.labelVisibility, width: Double(tabs[k].frame.width), height: Double(d.height),
                            reveal: k < i.reveal.count ? i.reveal[k] : (k == i.activeIndex ? 1 : 0), childSelected: false)
            g.frame.origin = CGPoint(x: tx, y: d.minY)
            out.tabs[k] = g
            tx += Double(g.frame.width) + m.tabGap
        }
        return out
    }
}

// MARK: - Motion and runtime

extension AWCTabsCurve {
    /// --md-sys-motion-spring-effects-fast (the destinations' colour, state-layer, weight, FILL and reveal transitions).
    static let effectsFast = AWCTabsCurve(x1: 0.31, y1: 0.94, x2: 0.34, y2: 1)
    /// --md-sys-motion-spring-effects-default (the modal surface's colour, shadow and corners).
    static let effectsDefault = AWCTabsCurve(x1: 0.34, y1: 0.8, x2: 0.34, y2: 1)
}

/// A FLIP of the expand/collapse: the destination's parts start at their previous rendered geometry and settle onto the
/// new layout (translate + scale from the top-left corner, physical), timed with the rail's width transition.
struct AWCRailFlip {
    var start = -Double.infinity, duration = 0.0, curve = AWCTabsCurve.standard
    var indicator: (dx: Double, dy: Double, sx: Double, sy: Double)?
    var icon: CGSize?
    var label: (dx: Double, dy: Double, from: Double, to: Double)?
    /// The outgoing label (a label that stops rendering) stays at its previous box and fades out.
    var outgoing: (rect: CGRect, opacity: Double, size: Double, weight: Double, tracking: Double, text: String)?
    /// The inline size at the flip (RTL: the outgoing box keeps its distance from the inline-start edge as the width animates).
    var space = 0.0
    func progress(_ t: Double) -> Double { duration <= 0 || t >= start + duration ? 1 : t <= start ? 0 : curve((t - start) / duration) }
    func running(_ t: Double) -> Bool { duration > 0 && t < start + duration }
}

final class AWCRailTabMotion {
    var color = AWCTabsTrack([0, 0, 0, 1]), labelColor = AWCTabsTrack([0, 0, 0, 1]), iconColor = AWCTabsTrack([0, 0, 0, 1])
    var indicator = AWCTabsTrack([0, 0, 0, 0]), layer = AWCTabsTrack([0]), fill = AWCTabsTrack([0]), weight = AWCTabsTrack([500]), reveal = AWCTabsTrack([1])
    var flip = AWCRailFlip()
    var initialized = false
    /// The label was rendered (not display: none) at the last retarget.
    var labelDisplayed = true
    func running(_ t: Double) -> Bool { [color, labelColor, iconColor, indicator, layer, fill, weight, reveal].contains { $0.running(t) } || flip.running(t) }
}

/// What a destination rendered last (physical, rail-local): the FLIP's first state.
struct AWCRailTabRendered {
    var indicator = CGRect.zero, iconCentre = CGPoint.zero, label: CGRect? = nil, labelOpacity = 0.0, labelVisible = false
    var labelSize = 12.0, labelWeight = 500.0, labelTracking = 0.5
    /// The inline size the rects were mirrored across (RTL: rail-local x follows the inline-start edge, which moves as the width animates).
    var space = 0.0
}

@MainActor @Observable final class AWCNavigationRailRuntime {
    var activeIndex = -1
    var variant = "standard"
    var hoverID: String?
    var pressedID: String?
    var roving: Int?
    var tick = 0
    var submenuSelection: [String: Int] = [:]
    var menuOpen: String?
    @ObservationIgnored var menuItems: [AWCRailMenuItem] = []
    @ObservationIgnored var menuChanged: ((Bool) -> Void)?
    @ObservationIgnored var lastActiveProperty: AWCValue?
    @ObservationIgnored var lastVariantProperty: AWCValue?
    @ObservationIgnored var width = AWCTabsTrack([80])
    @ObservationIgnored var surface = AWCTabsTrack([0, 0, 80, 0])   // modal surface inset, inset, width, height delta (0 / −32)
    @ObservationIgnored var surfacePaint = AWCTabsTrack([0])       // modal surface colour / shadow / corner fraction
    @ObservationIgnored var scrim = AWCTabsTrack([0])
    @ObservationIgnored var logo = AWCTabsTrack([0])               // expanded-logo cross-fade
    @ObservationIgnored var footerContent = AWCTabsTrack([0])
    @ObservationIgnored var widthInitialized = false
    @ObservationIgnored var pendingFlip = false
    @ObservationIgnored var motions: [String: AWCRailTabMotion] = [:]
    @ObservationIgnored var handles: [String: AWCButtonFocusHandle] = [:]
    @ObservationIgnored var ripples: [String: AWCRippleController] = [:]
    @ObservationIgnored var frames: [String: CGRect] = [:]
    @ObservationIgnored var rendered: [String: AWCRailTabRendered] = [:]
    @ObservationIgnored var measured: [String: CGSize] = [:]
    @ObservationIgnored let toggleTarget: AWCPopupTarget
    @ObservationIgnored let overflowHandle = AWCButtonFocusHandle()
    /// Menu anchors (AppKit views) by destination id / the overflow trigger.
    @ObservationIgnored var anchors: [String: AnyObject] = [:]
    init(node: AWCNode) {
        toggleTarget = AWCPopupTarget(id: node.id + "-toggle")
        let tabs = node.children.filter { $0.tag == "md-navigation-rail-tab" }
        lastActiveProperty = node.properties["activeIndex"]
        var index = Int(node.properties["activeIndex"]?.number ?? -1)
        // Authors may mark a destination `active` instead of setting activeIndex (adopted before the first sync).
        if index < 0, let marked = tabs.firstIndex(where: { $0.properties["active"]?.bool == true }) { index = marked }
        activeIndex = index
        lastVariantProperty = node.properties["variant"]
        variant = node.properties["variant"]?.string == "expanded" ? "expanded" : "standard"
        for t in tabs {
            let items = t.children.first { $0.slot == "submenu" && $0.tag == "md-menu" }?.children.filter { $0.tag == "md-menu-item" } ?? []
            if let j = items.firstIndex(where: { $0.properties["selected"]?.bool == true || $0.properties["aria-checked"]?.string == "true" }) { submenuSelection[t.id] = j }
        }
    }
    func motion(_ id: String) -> AWCRailTabMotion { if let m = motions[id] { return m }; let m = AWCRailTabMotion(); motions[id] = m; return m }
    func handle(_ id: String) -> AWCButtonFocusHandle { if let h = handles[id] { return h }; let h = AWCButtonFocusHandle(); handles[id] = h; return h }
    func ripple(_ id: String) -> AWCRippleController { if let r = ripples[id] { return r }; let r = AWCRippleController(); ripples[id] = r; return r }
}

struct AWCNavigationRailPalette {
    let tokens: [String: String], rail: AWCNavigationRailAppearance, tab: AWCNavigationRailTabAppearance
    func token(_ k: String, _ d: String) -> Color { Color(awcHex: tokens["--md-sys-color-" + k] ?? d) }
    func hex(_ v: String?) -> Color? { v.map { Color(awcHex: $0) } }
    func container(modalExpanded: Bool) -> Color { hex(rail.containerColor) ?? (modalExpanded ? token("surface-container", "#F3EDF7") : token("surface", "#FFFBFE")) }
    var content: Color { hex(rail.contentColor) ?? token("on-surface-variant", "#49454F") }
    var scrim: Color { token("scrim", "#000000") }
    var indicator: Color { hex(tab.indicatorColor) ?? token("secondary-container", "#E8DEF8") }
    var activeIcon: Color { hex(tab.activeIconColor) ?? token("on-secondary-container", "#4A4458") }
    var inactiveIcon: Color { hex(tab.iconColor) ?? token("on-surface-variant", "#49454F") }
    var activeLabel: Color { hex(tab.activeLabelColor) ?? token("secondary", "#625B71") }
    var inactiveLabel: Color { hex(tab.labelColor) ?? token("on-surface-variant", "#49454F") }
    var stateLayer: Color { hex(tab.stateLayerColor) ?? token("on-secondary-container", "#4A4458") }
    var disabled: Color { token("on-surface", "#1C1B1F").opacity(0.38) }
    var badge: Color { hex(tab.badgeColor) ?? token("error", "#B3261E") }
    var onBadge: Color { hex(tab.badgeContentColor) ?? token("on-error", "#FFFFFF") }
    var focusRing: Color { hex(tab.focusRingColor) ?? token("secondary", "#625B71") }
    var overflowRing: Color { token("secondary", "#625B71") }
    var elevation3: [AWCBoxShadow] { AWCBoxShadow.source(tokens["--md-sys-elevation-3"] ?? "0px 4px 8px 3px rgba(0,0,0,0.15), 0px 1px 3px rgba(0,0,0,0.3)") ?? [] }
}

struct AWCRailTabState: Equatable {
    var active = false, disabled = false, ariaDisabled = false, overflowed = false, hover = false, pressed = false
    var focused = false, focusVisible = false, tabStop = false, childSelected = false, isLink = false
    var skipped: Bool { disabled || ariaDisabled || overflowed }
}

/// The rail root: as wide as the (animated) rail — or every proposed point for a bar or a modal overlay — and as tall as
/// proposed (`block-size: 100%`; `fullHeight` spans the viewport).
struct AWCRailRoot: Layout {
    let width: Double?, height: Double?
    var naturalHeight = 0.0
    /// A destination alone: at least the rail's container width when no inline size is proposed.
    var minWidth = 0.0
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        CGSize(width: width.map { CGFloat($0) } ?? max(proposal.width ?? 0, CGFloat(minWidth)), height: height.map { CGFloat($0) } ?? proposal.height ?? CGFloat(naturalHeight))
    }
    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        for s in subviews { s.place(at: bounds.origin, anchor: .topLeading, proposal: ProposedViewSize(bounds.size)) }
    }
}

/// md-navigation-rail: the rail (standard 80 / expanded 220, modal overlay with scrim, or a horizontal bar) with its
/// logo, toggle, header, FAB, destinations (roving tab stop, arrows, Home/End, Enter/Space, Escape in a modal), overflow
/// trigger and footer profile; the expand/collapse width transition with the destinations' FLIP, the destinations' CSS
/// transitions (effects-fast 150 ms) and md-ripple, as the source.
struct AWCNativeNavigationRail: View {
    let node: AWCNode
    let properties: [String: AWCValue]
    let theme: AWCTheme
    let inheritedDensity: Double
    /// (event, target node id, target tag, detail)
    let emit: (String, String, String, AWCValue) -> Void
    let setProperty: (String, AWCValue) -> Void
    let follow: (AWCRailTabSpec) -> Void
    let renderChild: (AWCNode, ((AWCEvent) -> Void)?) -> AnyView
    @Environment(\.layoutDirection) private var direction
    @Environment(\.accessibilityReduceMotion) private var systemReduceMotion
    @Environment(\.awcNavigationRailReducedMotion) private var reducedOverride
    @Environment(\.awcThemeTokens) private var envTokens
    @Environment(\.awcNavigationRailAppearance) private var appearance
    @Environment(\.awcNavigationRailTabAppearance) private var tabAppearance
    @Environment(\.awcNavigationRailController) private var controller
    @Environment(\.awcNativePointerState) private var pointer
    @Environment(\.awcNavigationRailViewport) private var viewport
    @Environment(\.awcNavigationRailParts) private var railParts
    @Environment(\.awcNavigationRailTabParts) private var tabPartsAll
    @Environment(\.awcNavigationRailTabPartTargets) private var tabPartTargets
    @State private var runtime: AWCNavigationRailRuntime
    @State private var proposed = CGSize.zero
    init(node: AWCNode, properties: [String: AWCValue], theme: AWCTheme, inheritedDensity: Double, emit: @escaping (String, String, String, AWCValue) -> Void,
         setProperty: @escaping (String, AWCValue) -> Void, follow: @escaping (AWCRailTabSpec) -> Void, renderChild: @escaping (AWCNode, ((AWCEvent) -> Void)?) -> AnyView) {
        self.node = node; self.properties = properties; self.theme = theme; self.inheritedDensity = inheritedDensity
        self.emit = emit; self.setProperty = setProperty; self.follow = follow; self.renderChild = renderChild
        _runtime = State(initialValue: AWCNavigationRailRuntime(node: node))
    }
    var tokens: [String: String] { envTokens.isEmpty ? theme.tokens : envTokens }
    var reduced: Bool { reducedOverride ?? systemReduceMotion }
    var rtl: Bool { direction == .rightToLeft }
    var standalone: Bool { properties["_standalone"]?.bool == true }
    var specs: [AWCRailTabSpec] { node.children.filter { $0.tag == "md-navigation-rail-tab" }.map(AWCRailTabSpec.init) }
    var horizontal: Bool { properties["orientation"]?.string == "horizontal" }
    var modal: Bool { properties["modal"]?.bool == true && !horizontal }
    var fullHeight: Bool { properties["fullHeight"]?.bool == true }
    var alignment: String { let a = properties["alignment"]?.string ?? "top"; return ["middle", "bottom"].contains(a) ? a : "top" }
    var expandable: Bool { properties["expandable"]?.bool == true && !horizontal }
    var toggleLabel: String { properties["toggleLabel"]?.string ?? "Toggle navigation" }
    var visibility: String { let v = properties["labelVisibility"]?.string ?? "all"; return ["all", "selected", "none"].contains(v) ? v : "all" }
    var label: String { properties["label"]?.string ?? "Navigation" }
    var manageFocus: Bool { properties["disableFocusManagement"]?.bool != true }
    var overflowLabel: String { properties["overflowLabel"]?.string ?? "More" }
    var overflowIcon: String { properties["overflowIcon"]?.string ?? "more_horiz" }
    var railDensity: Double { AWCNativeDensity.resolve(properties["density"]?.number, inherited: inheritedDensity) }
    var look: AWCNavigationRailAppearance { appearance.merging(AWCNavigationRailAppearance(tab: tabAppearance)) }
    var metrics: AWCRailMetrics { AWCRailMetrics(d: railDensity, look: look, parts: railParts) }
    func tabMetrics(_ s: AWCRailTabSpec) -> AWCRailTabMetrics {
        AWCRailTabMetrics(d: AWCNativeDensity.resolve(s.p["density"]?.number, inherited: railDensity), look: look.tab, parts: tabParts(s))
    }
    /// A destination's part appearances: the subtree's, then the ones declared for its id.
    func tabParts(_ s: AWCRailTabSpec) -> [AWCNavigationRailTabPart: AWCNavigationRailPartAppearance] {
        guard let own = tabPartTargets[s.id] else { return tabPartsAll }
        return tabPartsAll.merging(own.mapValues { $0 }) { inherited, local in inherited.merging(local) }
    }
    func rp(_ part: AWCNavigationRailPart) -> AWCNavigationRailPartAppearance? { railParts[part] }
    /// The product of the parts' own opacities along a part's ancestry (opacity covers what a part contains).
    func chain(_ parts: AWCNavigationRailPart...) -> Double { parts.reduce(1.0) { $0 * (railParts[$1]?.opacity ?? 1) } }
    var expanded: Bool { !horizontal && runtime.variant == "expanded" }
    func slot(_ name: String) -> [AWCNode] { node.children.filter { $0.slot == name } }
    var overflowed: Set<Int> {
        let n = specs.count
        guard let cap = properties["maxVisible"]?.number, cap.isFinite, cap >= 1, Double(n) > cap else { return [] }
        return Set(Int(cap)..<n)
    }

    // MARK: Selection, roving, variant

    func skipped(_ s: AWCRailTabSpec, _ i: Int) -> Bool { s.disabled || s.ariaDisabled || overflowed.contains(i) || s.hidden }
    /// The roving tab stop: the destination moved to by arrows / focusTab / a click, else the active one (when it can
    /// take focus), else — with no active destination — the first that can.
    func tabStop(_ specs: [AWCRailTabSpec]) -> Int? {
        guard manageFocus else { return nil }
        if let r = runtime.roving, specs.indices.contains(r), !skipped(specs[r], r) { return r }
        if runtime.roving != nil { return nil }
        if runtime.activeIndex >= 0 { return specs.indices.contains(runtime.activeIndex) && !skipped(specs[runtime.activeIndex], runtime.activeIndex) ? runtime.activeIndex : nil }
        return specs.indices.first { !skipped(specs[$0], $0) }
    }
    func setActive(_ index: Int) {
        runtime.activeIndex = index; runtime.roving = nil; runtime.lastActiveProperty = .number(Double(index)); setProperty("activeIndex", .number(Double(index)))
    }
    /// Pointer / Enter / Space on a destination (source handleTabClick): mdTabClick, then the selection (mdTabChange
    /// only when it moves), the roving stop and other dropdowns' selections cleared; links follow.
    func click(_ index: Int) {
        let specs = specs
        guard specs.indices.contains(index) else { return }
        let s = specs[index]
        guard !s.disabled else { return }
        if s.menu != nil { openSubmenu(index); return }
        if standalone { emit("mdTabClick", s.id, "md-navigation-rail-tab", .object(["value": .string(s.value)])); follow(s); return }
        // aria-disabled (and overflowed) destinations stop the click at the rail.
        guard !skipped(s, index) else { return }
        emit("mdTabClick", s.id, "md-navigation-rail-tab", .object(["value": .string(s.value)]))
        select(index, value: s.value)
        if s.isLink { follow(s) }
    }
    func select(_ index: Int, value: String) {
        let changed = index != runtime.activeIndex
        setActive(index); runtime.roving = index
        for t in specs where t.id != specs[index].id { runtime.submenuSelection[t.id] = nil }
        if changed { emit("mdTabChange", node.id, "md-navigation-rail", .object(["index": .number(Double(index)), "value": .string(value)])) }
    }
    func keyActivate(_ index: Int) {
        let specs = specs
        guard specs.indices.contains(index), !specs[index].disabled else { return }
        runtime.ripple(specs[index].id).trigger()
        click(index)
    }
    /// Rail keydown: Escape dismisses an expanded modal (focus to the toggle); arrows move along the visual axis (Left/Right
    /// follow the writing direction in a bar) and wrap, Home/End jump; disabled / overflowed destinations are skipped.
    func key(_ key: String, from id: String) -> Bool {
        if key == "Escape" && modal && runtime.variant == "expanded" { setVariant("standard"); _ = runtime.toggleTarget.focus(); return true }
        guard manageFocus, !standalone else { return false }
        let specs = specs
        let focusable = specs.indices.filter { !skipped(specs[$0], $0) }
        guard !focusable.isEmpty else { return false }
        let current = specs.firstIndex { $0.id == id }.flatMap { focusable.firstIndex(of: $0) } ?? -1
        let bidi = horizontal && rtl
        let forward = key == "ArrowDown" || key == (bidi ? "ArrowLeft" : "ArrowRight")
        let backward = key == "ArrowUp" || key == (bidi ? "ArrowRight" : "ArrowLeft")
        let next: Int
        if forward { next = current < 0 ? 0 : (current + 1) % focusable.count }
        else if backward { next = current < 0 ? focusable.count - 1 : (current - 1 + focusable.count) % focusable.count }
        else if key == "Home" { next = 0 } else if key == "End" { next = focusable.count - 1 } else { return false }
        let target = focusable[next]
        runtime.roving = target
        _ = runtime.handle(specs[target].id).requestFocus?()
        return true
    }
    /// `variant` writes (toggle, methods, Escape, scrim, the property): the width transition starts from the rendered width,
    /// the destinations FLIP from their rendered geometry; mdExpand / mdCollapse follow.
    func setVariant(_ requested: String?, fromProperty: Bool = false) {
        let next = requested ?? (runtime.variant == "expanded" ? "standard" : "expanded")
        guard next != runtime.variant else { return }
        runtime.variant = next
        runtime.pendingFlip = !reduced && !horizontal
        runtime.roving = nil
        if !fromProperty { runtime.lastVariantProperty = .string(next); setProperty("variant", .string(next)) }
        emit(next == "expanded" ? "mdExpand" : "mdCollapse", node.id, "md-navigation-rail", .null)
    }
    func openSubmenu(_ index: Int) {
        let specs = specs
        guard specs.indices.contains(index), specs[index].menu != nil else { return }
        let s = specs[index]
        let items = s.menuItems.enumerated().map { j, item in
            AWCRailMenuItem(title: item.properties["headline"]?.string ?? item.authoredTextContent, icon: "", enabled: item.properties["disabled"]?.bool != true,
                            checked: runtime.submenuSelection[s.id] == j) { [runtime] in
                runtime.submenuSelection[s.id] = j
                if standalone { emit("mdTabClick", s.id, "md-navigation-rail-tab", .object(["value": .string(s.value)])); return }
                guard !skipped(s, index) else { return }
                emit("mdTabClick", s.id, "md-navigation-rail-tab", .object(["value": .string(s.value)]))
                select(index, value: s.value)
                runtime.submenuSelection[s.id] = j
            }
        }
        present(items, anchor: s.id, above: false) { open in
            runtime.menuOpen = open ? s.id : nil
            emit("mdSubmenuToggle", s.id, "md-navigation-rail-tab", .object(["open": .bool(open)]))
        }
    }
    func openOverflow() {
        let specs = specs
        let items = specs.indices.filter { overflowed.contains($0) }.map { k in
            AWCRailMenuItem(title: specs[k].label, icon: specs[k].icon, enabled: !(specs[k].disabled || specs[k].ariaDisabled), checked: false) {
                guard !(specs[k].disabled || specs[k].ariaDisabled) else { return }
                select(k, value: specs[k].value)
            }
        }
        present(items, anchor: node.id + "-overflow", above: !horizontal) { open in runtime.menuOpen = open ? "overflow" : nil }
    }
    func present(_ items: [AWCRailMenuItem], anchor: String, above: Bool, changed: @escaping (Bool) -> Void) {
        #if canImport(AppKit)
        awcRailPopUpMenu(items, from: runtime.anchors[anchor] as? NSView, above: above, rtl: rtl, changed: changed)
        #else
        runtime.menuItems = items; runtime.menuChanged = changed; runtime.menuOpen = anchor; changed(true)
        #endif
    }
    func bindController() {
        controller?.variantHandler = { v in setVariant(v) }
        controller?.focusHandler = { i in
            let s = self.specs
            guard s.indices.contains(i) else { return }
            if manageFocus { runtime.roving = i }
            _ = runtime.handle(s[i].id).requestFocus?()
        }
        controller?.clearHandler = { i in let s = self.specs; if s.indices.contains(i) { runtime.submenuSelection[s[i].id] = nil } }
    }
}

// MARK: - Frame (one rendered frame of the rail, physical, rail-local)

struct AWCRailTabFrame {
    var tab = CGRect.zero, indicator = CGRect.zero, iconWrapper = CGRect.zero, icon = CGRect.zero
    var label: CGRect? = nil, labelOpacity = 1.0, labelSize = 12.0, labelLine = 16.0, labelTracking = 0.5, labelTextWidth = 0.0
    var caret: CGRect? = nil, badge: CGRect? = nil
    var outgoing: (rect: CGRect, opacity: Double, size: Double, weight: Double, tracking: Double, text: String)? = nil
    var indicatorRadius = 0.0, hidden = false
}

struct AWCRailFrame {
    var rootWidth: Double? = nil, rootHeight: Double? = nil, naturalHeight = 0.0, rootMinWidth = 0.0
    /// The width logical rects mirror across (RTL).
    var space = 0.0
    var geometry = AWCRailGeometry()
    var host = CGRect.zero, surface = CGRect.zero, destinations = CGRect.zero
    var surfacePaint = 0.0, scrim = 0.0, logoExpanded = 0.0, footerContent = 0.0
    var tabs: [AWCRailTabFrame] = []
    var states: [AWCRailTabState] = []
    var toggle: CGRect? = nil, fab: CGRect? = nil, logo: CGRect? = nil, logoExpandedRect: CGRect? = nil, header: CGRect? = nil
    var overflow: CGRect? = nil, profile: CGRect? = nil, leading: CGRect? = nil, content: CGRect? = nil, footerItems: [CGRect] = []
}

extension AWCNativeNavigationRail {
    func phys(_ r: CGRect, _ space: Double) -> CGRect { rtl ? CGRect(x: space - Double(r.maxX), y: Double(r.minY), width: Double(r.width), height: Double(r.height)) : r }
    /// A tab part (tab-local, logical) in rail-local physical coordinates.
    func part(_ r: CGRect, in tab: CGRect) -> CGRect {
        let x = rtl ? Double(tab.width) - Double(r.maxX) : Double(r.minX)
        return CGRect(x: Double(tab.minX) + x, y: Double(tab.minY) + Double(r.minY), width: Double(r.width), height: Double(r.height))
    }
    func layoutInput(_ specs: [AWCRailTabSpec], height: Double, surface: CGRect?) -> AWCRailLayoutInput {
        let m = metrics
        var input = AWCRailLayoutInput(specs: specs, metrics: m, tabMetrics: specs.map(tabMetrics), activeIndex: runtime.activeIndex, labelVisibility: visibility,
                                       alignment: alignment, expanded: expanded, horizontal: horizontal, modal: modal, overflowed: overflowed,
                                       overflowCount: overflowed.count, overflowLabel: overflowLabel, height: height)
        let logo = slot("logo").first ?? slot("logo-expanded").first
        input.hasLogo = logo != nil
        if let logo { let b = logo.properties["_box"]?.number; input.logoSize = runtime.measured["logo"] ?? CGSize(width: b ?? 24, height: b ?? 24) }
        input.hasToggle = expandable
        input.hasHeader = !slot("header").isEmpty
        input.headerSize = runtime.measured["header"] ?? .zero
        input.hasFab = !slot("fab").isEmpty
        if let fab = slot("fab").first { input.fabSize = runtime.measured["fab"] ?? CGSize(width: 56, height: 56); input.fabLabelled = !(fab.properties["label"]?.string ?? "").isEmpty }
        let leading = !slot("footer-leading").isEmpty, contentSlot = !slot("footer-content").isEmpty
        input.hasFooterProfile = leading || contentSlot
        input.hasFooterLeading = leading
        if let l = slot("footer-leading").first { input.leadingHeight = Double(runtime.measured["footer-leading"]?.height ?? CGFloat(l.properties["_box"]?.number ?? 32)) }
        input.contentWidth = Double(runtime.measured["footer-content"]?.width ?? 0)
        input.contentHeight = contentSlot ? Double(runtime.measured["footer-content"]?.height ?? 19) : 0
        input.footerItems = slot("footer").map { runtime.measured["footer:" + $0.id] ?? .zero }
        input.reveal = specs.map { runtime.motion($0.id).reveal.value(AWCTabsClock.now())[0] }
        input.submenuSelected = Set(specs.indices.filter { runtime.submenuSelection[specs[$0].id] != nil && $0 != runtime.activeIndex })
        input.proposedWidth = Double(proposed.width); input.standalone = standalone
        input.surface = surface
        return input
    }
    func tabState(_ s: AWCRailTabSpec, _ i: Int, stop: Int?) -> AWCRailTabState {
        let h = runtime.handle(s.id)
        let pointerHover = pointer.map { p in p.location.map { runtime.frames[s.id]?.contains($0) ?? false } ?? false }
        let hover = !s.disabled && (pointerHover ?? (runtime.hoverID == s.id))
        let pressed = !s.disabled && (runtime.pressedID == s.id || (pointer?.isPointerDown == true && hover))
        let tabStop = manageFocus ? stop == i : (!s.disabled && i == runtime.activeIndex)
        return AWCRailTabState(active: i == runtime.activeIndex, disabled: s.disabled, ariaDisabled: s.ariaDisabled, overflowed: overflowed.contains(i) || s.hidden, hover: hover,
                               pressed: pressed, focused: h.isFocused, focusVisible: h.isFocusVisible && !s.disabled, tabStop: standalone ? !s.disabled : tabStop,
                               childSelected: runtime.submenuSelection[s.id] != nil && i != runtime.activeIndex, isLink: s.isLink)
    }
    /// CSS targets of a destination's transitions (effects-fast 150 ms; none under reduced motion).
    func targets(_ s: AWCRailTabSpec, _ st: AWCRailTabState, _ palette: AWCNavigationRailPalette, now: Double) {
        let motion = runtime.motion(s.id), tm = tabMetrics(s), tp = tm.parts
        let host = awcTabsComponents(st.disabled ? palette.disabled : st.active ? palette.activeIcon : palette.inactiveIcon)
        // Part colours win over every state rule: the icon inherits the icon wrapper's (or a link's anchor's) colour.
        let iconPart = (s.slotIcon == nil ? tp[.icon]?.color : nil) ?? tp[.iconWrapper]?.color ?? (st.isLink ? tp[.anchor]?.color : nil)
        let icon = iconPart.map { awcTabsComponents(Color(awcHex: $0)) } ?? (st.childSelected && !st.disabled ? awcTabsComponents(palette.activeIcon) : host)
        let label = tp[.label]?.color.map { awcTabsComponents(Color(awcHex: $0)) } ?? awcTabsComponents(st.childSelected ? palette.activeIcon : st.active ? palette.activeLabel : palette.inactiveLabel)
        var ind = awcTabsComponents(palette.indicator); if !(st.active || st.childSelected) { ind[3] = 0 }
        if let c = (horizontal ? tp[.iconWrapper] : tp[.indicator])?.backgroundColor { ind = awcTabsComponents(Color(awcHex: c)) }
        let tabLook = self.look.tab
        let layer: Double = tp[.stateLayer]?.opacity ?? (st.disabled ? 0 : st.pressed ? (tabLook.pressStateLayerOpacity ?? 0.1) : (st.focusVisible && !horizontal) ? (tabLook.focusStateLayerOpacity ?? 0.1) : st.hover ? 0.08 : 0)
        let reveal: [Double] = [visibility == "selected" && !expanded ? (st.active ? 1 : 0) : 1]
        if !motion.initialized {
            motion.color.snap(host); motion.iconColor.snap(icon); motion.labelColor.snap(label); motion.indicator.snap(ind); motion.layer.snap([layer])
            motion.fill.snap([st.active ? 1 : 0]); motion.weight.snap([tm.labelWeight(st.active)]); motion.reveal.snap(reveal); motion.initialized = true
            motion.labelDisplayed = !(visibility == "selected" && expanded && !st.active); return
        }
        let d = reduced ? 0.0 : 150
        motion.color.set(host, duration: d, curve: .effectsFast, now: now)
        motion.iconColor.set(icon, duration: d, curve: .effectsFast, now: now)
        motion.labelColor.set(label, duration: d, curve: .effectsFast, now: now)
        motion.indicator.set(ind, duration: d, curve: .effectsFast, now: now)
        motion.layer.set([layer], duration: d, curve: .effectsFast, now: now)
        motion.fill.set([st.active ? 1 : 0], duration: d, curve: .effectsFast, now: now)
        motion.weight.set([tm.labelWeight(st.active)], duration: d, curve: .effectsFast, now: now)
        // A label that was display: none (an inactive destination of an expanded labels-selected rail) has no before-change
        // style: CSS starts it at its new reveal without a transition.
        if motion.labelDisplayed { motion.reveal.set(reveal, duration: d, curve: .effectsFast, now: now) } else { motion.reveal.snap(reveal) }
        motion.labelDisplayed = !(visibility == "selected" && expanded && !st.active)
    }

    /// Sets every transition's target (idempotent): the body runs it before deciding whether the timeline ticks, so a
    /// change starts its animation on the next frames.
    @discardableResult func retarget(_ specs: [AWCRailTabSpec], _ palette: AWCNavigationRailPalette, at t: Double) -> [AWCRailTabState] {
        let m = metrics
        let stop = tabStop(specs)
        let states = specs.enumerated().map { tabState($1, $0, stop: stop) }
        for (i, s) in specs.enumerated() { targets(s, states[i], palette, now: t) }
        // Rail-level transitions: the width (standard, 200 ms), the modal surface geometry (standard) and paint (effects
        // default), the scrim, the logo cross-fade and the profile text reveal.
        let dur = reduced ? 0.0 : 200
        let cw = m.containerWidth
        let surfaceTarget: [Double] = modal && expanded ? [16, 16, min(m.expandedWidth, m.expandedMax), -32] : [0, 0, cw, 0]
        let targetWidth = modal || horizontal ? cw : m.width(expanded)
        if !runtime.widthInitialized {
            runtime.width.snap([targetWidth]); runtime.surface.snap(surfaceTarget); runtime.surfacePaint.snap([modal && expanded ? 1 : 0])
            runtime.scrim.snap([modal && expanded ? 0.32 : 0]); runtime.logo.snap([expanded ? 1 : 0]); runtime.footerContent.snap([expanded || horizontal ? 1 : 0])
            runtime.widthInitialized = true
        } else {
            runtime.width.set([targetWidth], duration: dur, curve: .standard, now: t)
            runtime.surface.set(surfaceTarget, duration: dur, curve: .standard, now: t)
            runtime.surfacePaint.set([modal && expanded ? 1 : 0], duration: dur, curve: .effectsDefault, now: t)
            runtime.scrim.set([modal && expanded ? 0.32 : 0], duration: dur, curve: .standard, now: t)
            runtime.logo.set([expanded ? 1 : 0], duration: dur, curve: .standard, now: t)
            runtime.footerContent.set([expanded || horizontal ? 1 : 0], duration: dur, curve: .standard, now: t)
        }
        return states
    }

    func compute(_ specs: [AWCRailTabSpec], _ palette: AWCNavigationRailPalette, at t: Double) -> AWCRailFrame {
        var f = AWCRailFrame()
        let m = metrics
        f.states = retarget(specs, palette, at: t)
        let H: Double = fullHeight ? Double(viewport?.height ?? proposed.height) : Double(proposed.height)
        let cw = m.containerWidth
        let sv = runtime.surface.value(t)
        let surface: CGRect? = modal ? CGRect(x: sv[1], y: sv[0], width: sv[2], height: max(0, H + sv[3])) : nil
        let g = AWCRailLayout.compute(layoutInput(specs, height: H, surface: surface))
        // A destination alone spans its box's inline size (as proposed) at its own block size.
        let S: Double = standalone && !horizontal ? Double(g.size.width) : horizontal || modal ? Double(proposed.width) : runtime.width.value(t)[0]
        f.geometry = g
        if standalone && !horizontal { f.rootWidth = nil; f.rootMinWidth = Double(cw); f.rootHeight = Double(g.size.height) }
        else if horizontal { f.rootHeight = Double(g.size.height) } else { f.rootWidth = modal ? nil : S; f.rootHeight = fullHeight ? viewport.map { Double($0.height) } : nil }
        f.naturalHeight = g.naturalHeight
        let space = S
        f.space = space
        f.host = horizontal || standalone ? CGRect(x: 0, y: 0, width: S, height: Double(g.size.height)) : phys(CGRect(x: 0, y: 0, width: modal ? cw : S, height: H), space)
        f.surface = modal ? phys(g.surface, space) : f.host
        f.surfacePaint = runtime.surfacePaint.value(t)[0]; f.scrim = runtime.scrim.value(t)[0]
        f.logoExpanded = runtime.logo.value(t)[0]; f.footerContent = runtime.footerContent.value(t)[0]
        // The destinations clip to the container's rendered inline size (overflow-x clip / overflow-y auto).
        var dest = g.destinations
        if !horizontal && !standalone { let padI = m.paddingInline(expanded); dest.size.width = CGFloat(max(0, Double(modal ? g.surface.width : S) - 2 * padI)) }
        f.destinations = phys(dest, space)
        f.toggle = g.toggle.map { phys(CGRect(x: Double(cw) / 2 - 24 + Double(modal ? g.surface.minX : 0), y: Double($0.minY), width: 48, height: 48), space) }
        if let fi = g.fabItem { f.fab = phys(fi, space) }
        if let l = g.logo {
            let size = runtime.measured["logo"] ?? CGSize(width: 24, height: 24)
            let x = horizontal ? Double(l.minX) + 8 : Double(modal ? g.surface.minX : 0) + (cw - m.logoIconSize) / 2
            f.logo = phys(CGRect(x: x, y: Double(l.midY) - Double(size.height) / 2, width: Double(size.width), height: Double(size.height)), space)
            let es = runtime.measured["logo-expanded"] ?? size
            f.logoExpandedRect = phys(CGRect(x: x, y: Double(l.midY) - Double(es.height) / 2, width: Double(es.width), height: Double(es.height)), space)
        }
        f.header = g.header.map { phys($0, space) }
        f.overflow = g.overflow.map { phys($0, space) }
        f.profile = g.profile.map { phys($0, space) }; f.leading = g.leading.map { phys($0, space) }; f.content = g.content.map { phys($0, space) }
        f.footerItems = g.footerItems.map { phys($0, space) }
        // Destinations: the layout's final geometry, then the expand/collapse FLIP.
        let flipNow = runtime.pendingFlip
        runtime.pendingFlip = false
        let timing: (Double, Double, AWCTabsCurve) = {
            let tr = modal ? runtime.surface : runtime.width
            return tr.running(t) ? (tr.start, tr.duration, tr.curve) : (t, 200, .standard)
        }()
        for (i, s) in specs.enumerated() {
            let tg = g.tabs[i], tm = tabMetrics(s), motion = runtime.motion(s.id)
            var tf = AWCRailTabFrame()
            tf.hidden = tg.overflowed
            tf.tab = phys(tg.frame, space)
            tf.indicator = part(tg.indicator, in: tf.tab); tf.iconWrapper = part(tg.iconWrapper, in: tf.tab); tf.icon = part(tg.icon, in: tf.tab)
            tf.label = tg.label.map { part($0, in: tf.tab) }; tf.caret = tg.caret.map { part($0, in: tf.tab) }
            tf.labelTextWidth = tg.labelTextWidth
            tf.labelOpacity = tg.label == nil ? 0 : (visibility == "selected" && !expanded ? motion.reveal.value(t)[0] : 1)
            tf.labelSize = expanded ? tm.expandedLabelSize : tm.labelSize; tf.labelLine = expanded ? tm.expandedLineHeight : tm.lineHeight; tf.labelTracking = tm.labelTracking(expanded)
            if flipNow, let first = runtime.rendered[s.id] {
                var flip = AWCRailFlip(); flip.start = timing.0; flip.duration = timing.1; flip.curve = timing.2; flip.space = space
                // First and last in one frame: RTL rail-local x is measured from the moving inline-start edge (a flip mid-transition,
                // e.g. a reversed expand, sees the width a frame later), so the first rects move by the inline-size change.
                let sh: CGFloat = rtl ? CGFloat(space - first.space) : 0
                var first = first
                first.indicator = first.indicator.offsetBy(dx: sh, dy: 0); first.iconCentre.x += sh; first.label = first.label?.offsetBy(dx: sh, dy: 0)
                let last = tf.indicator
                if first.indicator.width > 0, first.indicator.height > 0, last.width > 0, last.height > 0 {
                    flip.indicator = (Double(first.indicator.minX - last.minX), Double(first.indicator.minY - last.minY), Double(first.indicator.width / last.width), Double(first.indicator.height / last.height))
                }
                let dx = Double(first.iconCentre.x - tf.iconWrapper.midX), dy = Double(first.iconCentre.y - tf.iconWrapper.midY)
                if abs(dx) > 0.5 || abs(dy) > 0.5 { flip.icon = CGSize(width: dx, height: dy) }
                if let l = tf.label, tf.labelOpacity > 0 {
                    let lx = first.labelVisible ? Double((first.label?.minX ?? l.minX) - l.minX) : 0, ly = first.labelVisible ? Double((first.label?.minY ?? l.minY) - l.minY) : 0
                    let from = first.labelVisible ? first.labelOpacity : 0
                    if abs(lx) > 0.5 || abs(ly) > 0.5 || abs(from - tf.labelOpacity) > 0.01 { flip.label = (lx, ly, from, tf.labelOpacity) }
                } else if first.labelVisible, first.labelOpacity > 0, let r = first.label, r.width > 0, r.height > 0 {
                    flip.outgoing = (r, first.labelOpacity, first.labelSize, first.labelWeight, first.labelTracking, s.label)
                }
                motion.flip = flip
            } else if flipNow { motion.flip = AWCRailFlip() }
            // Apply the running FLIP.
            let flip = motion.flip, e = flip.progress(t)
            if flip.running(t) || e < 1 {
                if let a = flip.indicator {
                    let r = tf.indicator
                    tf.indicator = CGRect(x: Double(r.minX) + a.dx * (1 - e), y: Double(r.minY) + a.dy * (1 - e), width: Double(r.width) * (a.sx + (1 - a.sx) * e), height: Double(r.height) * (a.sy + (1 - a.sy) * e))
                }
                if let a = flip.icon { tf.iconWrapper = tf.iconWrapper.offsetBy(dx: a.width * (1 - e), dy: a.height * (1 - e)); tf.icon = tf.icon.offsetBy(dx: a.width * (1 - e), dy: a.height * (1 - e)) }
                if let a = flip.label, let l = tf.label {
                    tf.label = l.offsetBy(dx: a.dx * (1 - e), dy: a.dy * (1 - e)); tf.caret = tf.caret?.offsetBy(dx: a.dx * (1 - e), dy: a.dy * (1 - e))
                    tf.labelOpacity = a.from + (a.to - a.from) * e
                }
                if let o = flip.outgoing, flip.running(t) { tf.outgoing = (o.rect.offsetBy(dx: rtl ? CGFloat(space - flip.space) : 0, dy: 0), o.opacity * (1 - e), o.size, o.weight, o.tracking, o.text) }
            }
            tf.indicatorRadius = tm.indicatorRadius(tf.indicator)
            tf.badge = badgeRect(s, icon: CGRect(x: tf.iconWrapper.midX - CGFloat(tm.iconSize) / 2, y: tf.iconWrapper.midY - CGFloat(tm.iconSize) / 2, width: CGFloat(tm.iconSize), height: CGFloat(tm.iconSize)))
            runtime.rendered[s.id] = AWCRailTabRendered(indicator: tf.indicator, iconCentre: CGPoint(x: tf.iconWrapper.midX, y: tf.iconWrapper.midY), label: tf.label,
                                                        labelOpacity: tf.labelOpacity, labelVisible: tf.label != nil && tf.labelOpacity > 0 && !tg.overflowed,
                                                        labelSize: tf.labelSize, labelWeight: motion.weight.value(t)[0], labelTracking: tf.labelTracking, space: space)
            f.tabs.append(tf)
        }
        return f
    }
    /// Badges anchor on the icon box's inline-end top corner, then translate(50%, −50%) (physical, also in RTL).
    func badgeRect(_ s: AWCRailTabSpec, icon: CGRect) -> CGRect? {
        guard let text = s.badge else { return nil }
        if text.isEmpty { return CGRect(x: rtl ? icon.minX + 3 : icon.maxX - 3, y: icon.minY - 3, width: 6, height: 6) }
        let w = max(16, AWCRailLayout.textWidth(text, size: 11, weight: 500, tracking: 0) + 8)
        return CGRect(x: rtl ? Double(icon.minX) + w / 2 : Double(icon.maxX) - w / 2, y: Double(icon.minY) - 8, width: w, height: 16)
    }
}

/// Places subviews at explicit rail-local frames (real layout frames, so inspection and hit areas match the geometry).
struct AWCRailPlacer: Layout {
    let frames: [CGRect], size: CGSize
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize { size }
    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        for (s, f) in zip(subviews, frames) { s.place(at: CGPoint(x: bounds.minX + f.minX, y: bounds.minY + f.minY), anchor: .topLeading, proposal: ProposedViewSize(f.size)) }
    }
}

/// Reports a slotted child's natural size (the rail lays its sections out around it).
private struct AWCRailMeasure: ViewModifier {
    let key: String, runtime: AWCNavigationRailRuntime
    func body(content: Content) -> some View {
        content.fixedSize().onGeometryChange(for: CGSize.self) { $0.size } action: { size in
            guard runtime.measured[key] != size else { return }
            runtime.measured[key] = size; runtime.tick &+= 1
        }
    }
}

extension AWCNativeNavigationRail {
    /// A transition of the rail or of a destination is running (or the expand / collapse FLIP is pending) at `t`.
    func running(_ specs: [AWCRailTabSpec], at t: Double) -> Bool {
        runtime.pendingFlip || [runtime.width, runtime.surface, runtime.surfacePaint, runtime.scrim, runtime.logo, runtime.footerContent].contains { $0.running(t) }
            || specs.contains { runtime.motion($0.id).running(t) }
    }
    var body: some View {
        let now = AWCTabsClock.now()
        let specs = specs
        let palette = AWCNavigationRailPalette(tokens: tokens, rail: look, tab: look.tab)
        retarget(specs, palette, at: now)
        let animating = running(specs, at: now)
        let _ = runtime.tick
        let _ = runtime.variant
        let _ = runtime.activeIndex
        let _ = runtime.roving
        let _ = runtime.submenuSelection
        let _ = bindController()
        // A fixed origin: the schedule is equal across body updates (a body update per frame — e.g. while the width
        // animates — must not restart the timeline).
        return TimelineView(.periodic(from: Date(timeIntervalSinceReferenceDate: 0), by: animating ? 1.0 / 120 : 3600)) { _ in
            let f = compute(specs, palette, at: AWCTabsClock.now())
            AWCRailRoot(width: f.rootWidth, height: f.rootHeight, naturalHeight: f.naturalHeight, minWidth: f.rootMinWidth) { railFrame(specs, f, palette, at: AWCTabsClock.now()) }
                // The transitions ended: the body re-evaluates and the timeline goes idle (nothing else re-evaluates it then, and
                // the rail would keep rendering 120 frames a second — and publishing an inspection for each — until its next change).
                .onChange(of: running(specs, at: AWCTabsClock.now())) { _, live in if !live { runtime.tick &+= 1 } }
        }
        // The box offered to the rail: a vertical, non-modal rail sizes its own width (the animated width track), so only its
        // height is taken (recording its own width would update the body on every frame of the width transition).
        .onGeometryChange(for: CGSize.self) { $0.size } action: { size in
            let next = horizontal || modal || standalone ? size : CGSize(width: proposed.width, height: size.height)
            if proposed != next { proposed = next }
        }
        .modifier(AWCNavigationRailAccessibility(id: node.id, label: label, tablist: !standalone && !specs.contains { $0.isLink }, enabled: !standalone))
        .onChange(of: node.properties["activeIndex"]) { _, value in
            guard value != runtime.lastActiveProperty else { return }
            runtime.lastActiveProperty = value
            // A write to activeIndex is silent (no mdTabChange).
            runtime.activeIndex = Int(value?.number ?? -1); runtime.roving = nil
        }
        // The variant as the element holds it (the host's value with the rail's own writes over it): a host property change
        // replaces local interaction state (AWCNativeView), so a host write of the variant applies even when the host's value
        // itself did not change after an internal toggle (the Web element's property moved; setting it back collapses).
        .onChange(of: properties["variant"]) { _, value in
            guard value != runtime.lastVariantProperty else { return }
            runtime.lastVariantProperty = value
            setVariant(value?.string == "expanded" ? "expanded" : "standard", fromProperty: true)
        }
        .onChange(of: visibility) { _, _ in runtime.roving = nil }
        #if !canImport(AppKit)
        .popover(isPresented: Binding(get: { runtime.menuOpen != nil }, set: { if !$0 { runtime.menuOpen = nil; runtime.menuChanged?(false) } })) {
            VStack(alignment: .leading, spacing: 0) {
                ForEach(Array(runtime.menuItems.enumerated()), id: \.offset) { _, item in
                    Button { runtime.menuOpen = nil; runtime.menuChanged?(false); item.action() } label: {
                        HStack(spacing: 12) {
                            if !item.icon.isEmpty { AWCMaterialSymbol(item.icon, size: 24) }
                            Text(item.title).font(AWCNativeFonts.label(size: 14, weight: 400))
                            Spacer(minLength: 12)
                            if item.checked { Image(systemName: "checkmark") }
                        }.padding(.horizontal, 12).frame(minWidth: 112, minHeight: 48)
                    }.buttonStyle(.plain).disabled(!item.enabled)
                }
            }.padding(.vertical, 8).presentationCompactAdaptation(.popover)
        }
        #endif
    }

    @ViewBuilder func railFrame(_ specs: [AWCRailTabSpec], _ f: AWCRailFrame, _ palette: AWCNavigationRailPalette, at t: Double) -> some View {
        let m = metrics
        let size = CGSize(width: max(f.host.maxX, f.surface.maxX, horizontal || modal ? proposed.width : 0), height: max(f.host.maxY, f.surface.maxY))
        let boxes = partBoxes(f)
        // A scrim part opacity shows the scrim of a docked rail too (over its content: z-index 2, the container is not positioned).
        let scrimOpacity = rp(.scrim)?.opacity ?? f.scrim
        let dockedScrim = !modal && (rp(.scrim)?.opacity ?? 0) > 0
        let layers: [CGRect] = (modal ? [CGRect(origin: .zero, size: proposed)] : []) + [f.surface, CGRect(origin: .zero, size: size), CGRect(origin: .zero, size: size), f.destinations]
            + (dockedScrim ? [f.host] : [])
        AWCRailPlacer(frames: layers, size: size) {
            if modal {
                // The scrim covers the overlay's positioned area (the rail's proposed box); a click collapses the rail.
                scrimView(palette, opacity: scrimOpacity)
                    .contentShape(Rectangle())
                    .allowsHitTesting(runtime.variant == "expanded")
                    .onTapGesture { if runtime.variant == "expanded" { setVariant("standard"); _ = runtime.toggleTarget.focus() } }
                    .awcInspect(nodeID: node.id, part: "scrim", name: "scrim") { _ in ["opacity": .number(scrimOpacity)] }
            }
            surfaceView(f, palette)
            AWCRailPlacer(frames: boxes.map(\.rect), size: size) {
                ForEach(Array(boxes.enumerated()), id: \.offset) { _, b in
                    partBox(b.value, opacity: b.opacity)
                        .awcInspect(nodeID: node.id, part: "box-" + b.part.rawValue, name: "box-" + b.part.rawValue) { _ in
                            ["color": awcTabsRGBA(awcTabsComponents(Color(awcHex: b.value.backgroundColor ?? "#00000000"))), "opacity": .number(b.opacity)]
                        }
                }
            }.allowsHitTesting(false)
            AWCRailPlacer(frames: sectionFrames(f), size: size) { sections(specs, f, palette) }
            destinations(specs, f, palette, at: t).opacity(chain(.container, .destinations))
            if dockedScrim {
                scrimView(palette, opacity: scrimOpacity).allowsHitTesting(false)
                    .awcInspect(nodeID: node.id, part: "scrim", name: "scrim") { _ in ["opacity": .number(scrimOpacity)] }
            }
        }
        .frame(width: size.width, height: size.height, alignment: .topLeading)
        .environment(\.layoutDirection, .leftToRight)
        .awcInspect(nodeID: node.id, name: "md-navigation-rail") { _ in
            ["variant": .string(runtime.variant), "activeIndex": .number(Double(runtime.activeIndex)), "width": .number(Double(f.host.width)),
             "host": .array([f.host.minX, f.host.minY, f.host.width, f.host.height].map { .number(Double($0)) }),
             "container": .array([f.surface.minX, f.surface.minY, f.surface.width, f.surface.height].map { .number(Double($0)) }),
             "label": .string(label), "horizontal": .bool(horizontal), "modal": .bool(modal), "reduced": .bool(reduced), "scrim": .number(f.scrim),
             "count": .number(Double(specs.count)), "overflowCount": .number(Double(overflowed.count)), "density": .number(railDensity),
             "background": awcTabsRGBA(awcTabsComponents(surfaceColor(palette, f))), "paddingInline": .number(m.paddingInline(expanded))]
        }
    }
    @ViewBuilder func scrimView(_ palette: AWCNavigationRailPalette, opacity: Double) -> some View {
        AWCNativeCornerShape(corners: rp(.scrim)?.cornerShape ?? .points(0)).fill(rp(.scrim)?.backgroundColor.map { Color(awcHex: $0) } ?? palette.scrim).opacity(opacity)
    }
    /// The painted part boxes (background + corner shape), each with its ancestry's opacity, in paint order. The modal
    /// container is the surface itself (surfaceView).
    func partBoxes(_ f: AWCRailFrame) -> [(part: AWCNavigationRailPart, value: AWCNavigationRailPartAppearance, rect: CGRect, opacity: Double)] {
        var out: [(part: AWCNavigationRailPart, value: AWCNavigationRailPartAppearance, rect: CGRect, opacity: Double)] = []
        let g = f.geometry, space = f.space
        func add(_ part: AWCNavigationRailPart, _ r: CGRect?, _ opacity: Double) {
            guard let p = rp(part), p.backgroundColor != nil, let r, r.width > 0, r.height > 0 else { return }
            out.append((part, p, r, opacity))
        }
        if !modal { add(.container, phys(g.container, space), chain(.container)) }
        if let l = g.logo {
            add(.logo, phys(l, space), chain(.container, .logo))
            // The two marks span the logo area from one rail inset before it (absolute, inset-inline 0, margin −padding);
            // in a bar they are static boxes with 8 inline padding.
            let mark: CGRect = horizontal ? (f.logo.map { $0.insetBy(dx: -8, dy: 0) } ?? .zero)
                : phys(CGRect(x: Double(l.minX) - metrics.paddingInline(expanded), y: Double(l.minY), width: Double(l.width) + metrics.paddingInline(expanded), height: Double(l.height)), space)
            add(.logoContracted, mark, chain(.container, .logo) * logoOpacity(f, expandedMark: false))
            if !horizontal { add(.logoExpanded, mark, chain(.container, .logo) * logoOpacity(f, expandedMark: true)) }
        }
        // Sections are `inline-size: 100%` content boxes: their inline-start padding (toggle, FAB) or both paddings (the
        // expanded header) overflow the container's inline end.
        let m = metrics, padI = m.paddingInline(expanded), cw = m.containerWidth
        func grown(_ r: CGRect?, _ extra: Double) -> CGRect? { r.map { phys(CGRect(x: Double($0.minX), y: Double($0.minY), width: Double($0.width) + max(0, extra), height: Double($0.height)), space) } }
        add(.toggle, grown(g.toggle, (cw - 40) / 2 - padI), chain(.container, .toggle))
        add(.header, grown(g.header, expanded ? 16 : 0), chain(.container, .header))
        add(.fab, grown(g.fab, horizontal || expanded ? 0 : (cw - m.fabSize) / 2), chain(.container, .fab))
        add(.destinations, f.destinations, chain(.container, .destinations))
        add(.overflow, f.overflow, chain(.container, .overflow))
        add(.overflowTrigger, f.overflow, chain(.container, .overflow, .overflowTrigger))
        add(.footer, g.footer.map { phys($0, space) }, chain(.container, .footer))
        add(.footerProfile, f.profile, chain(.container, .footer, .footerProfile))
        add(.footerLeading, f.leading, chain(.container, .footer, .footerProfile, .footerLeading))
        add(.footerContent, f.content, chain(.container, .footer, .footerProfile) * footerContentOpacity(f))
        return out
    }
    @ViewBuilder func partBox(_ p: AWCNavigationRailPartAppearance, opacity: Double) -> some View {
        AWCNativeCornerShape(corners: p.cornerShape ?? .points(0)).fill(p.backgroundColor.map { Color(awcHex: $0) } ?? .clear).opacity(opacity)
    }
    /// A logo mark's own opacity: the cross-fade (a part opacity replaces it).
    func logoOpacity(_ f: AWCRailFrame, expandedMark: Bool) -> Double {
        if expandedMark { return rp(.logoExpanded)?.opacity ?? f.logoExpanded }
        return rp(.logoContracted)?.opacity ?? (slot("logo-expanded").isEmpty || horizontal ? 1 : 1 - f.logoExpanded)
    }
    /// The profile text: its own opacity (the reveal, or the part's) while visible — `visibility: hidden` once concealed.
    func footerContentOpacity(_ f: AWCRailFrame) -> Double { f.footerContent > 0 ? (rp(.footerContent)?.opacity ?? f.footerContent) : 0 }
    func surfaceColor(_ palette: AWCNavigationRailPalette, _ f: AWCRailFrame) -> Color {
        guard modal else { return palette.container(modalExpanded: false) }
        if let c = rp(.container)?.backgroundColor { return Color(awcHex: c) }
        let a = awcTabsComponents(palette.container(modalExpanded: false)), b = awcTabsComponents(palette.container(modalExpanded: true)), p = f.surfacePaint
        return awcTabsColor(zip(a, b).map { $0 + ($1 - $0) * p })
    }
    /// The rail surface: the container colour in the hooked shape with the hooked elevation; modal: the floating surface
    /// (surface-container, corner-large, elevation 3 when expanded, interpolated by its transition).
    @ViewBuilder func surfaceView(_ f: AWCRailFrame, _ palette: AWCNavigationRailPalette) -> some View {
        let r = f.surface
        let corners: AWCCornerShape = {
            if modal {
                let base = look.containerShape.map { Double($0.topRight.x.points) } ?? 0, open = look.containerShape.map { Double($0.topRight.x.points) } ?? 16
                let p = f.surfacePaint, end = base + (open - base) * p, start = open * p
                // Collapsed only the inline-end corners round; expanded every corner (physical in RTL).
                return rtl ? AWCCornerShape(topLeft: .init(.points(end)), topRight: .init(.points(start)), bottomRight: .init(.points(start)), bottomLeft: .init(.points(end)))
                           : AWCCornerShape(topLeft: .init(.points(start)), topRight: .init(.points(end)), bottomRight: .init(.points(end)), bottomLeft: .init(.points(start)))
            }
            return look.containerShape ?? .points(0)
        }()
        let partCorners = modal ? rp(.container)?.cornerShape : nil
        let shadow: [AWCBoxShadow] = modal ? (look.containerElevation ?? palette.elevation3) : (look.containerElevation ?? [])
        ZStack(alignment: .topLeading) {
            if !shadow.isEmpty {
                AWCNativeBoxShadow(corners: partCorners ?? corners, layers: modal && look.containerElevation == nil ? shadow.map { AWCBoxShadow(x: $0.x, y: $0.y, blur: $0.blur, spread: $0.spread, color: $0.color, inset: $0.inset) } : shadow,
                                   placement: .outer).opacity(modal && look.containerElevation == nil ? max(f.surfacePaint, 0.0004) : 1)
                // 6-4: the elevation shadow is a blurred Canvas; its first draw costs about 15 ms of main-thread CPU (measured 6-4-017:
                // busy max 27.6 ms vs 12.0 ms without it), which delayed the first modal expand beyond two frames. A floor of 0.0004
                // (under 0.03 of an 8-bit level for the 0.3 / 0.15 alpha layers) keeps it drawn while collapsed, so the first expand
                // only changes its opacity. The painted result is unchanged (the inspect value below still reads the true paint).
            }
            AWCNativeCornerShape(corners: partCorners ?? corners).fill(surfaceColor(palette, f))
        }
        .frame(width: r.width, height: r.height)
        .opacity(modal ? chain(.container) : 1)
        .allowsHitTesting(false)
        .awcInspect(nodeID: node.id, part: "container", name: "container") { _ in
            ["background": awcTabsRGBA(awcTabsComponents(surfaceColor(palette, f))), "shadow": .number(shadow.isEmpty ? 0 : (modal ? f.surfacePaint : 1)), "radius": .number(Double((partCorners ?? corners).topRight.x.points))]
        }
    }
    /// A slotted child; an inline svg / img stand-in symbol renders in its authored box.
    @ViewBuilder func slotView(_ n: AWCNode) -> some View {
        if n.tag == "#symbol", let b = n.properties["_box"]?.number ?? n.properties["size"]?.number {
            AWCMaterialSymbol(n.properties["name"]?.string ?? "", size: CGFloat(b)).frame(width: CGFloat(b), height: CGFloat(b))
        } else { renderChild(n, nil) }
    }
    func sectionFrames(_ f: AWCRailFrame) -> [CGRect] {
        var out: [CGRect] = []
        if !slot("logo").isEmpty || !slot("logo-expanded").isEmpty { out.append(f.logo ?? .zero); out.append(f.logoExpandedRect ?? .zero) }
        if expandable { out.append(f.toggle ?? .zero) }
        if !slot("header").isEmpty { out.append(f.header ?? .zero) }
        if !slot("fab").isEmpty { out.append(f.fab ?? .zero) }
        if !overflowed.isEmpty { out.append(f.overflow ?? .zero) }
        if !slot("footer-leading").isEmpty { out.append(f.leading ?? .zero) }
        if !slot("footer-content").isEmpty { out.append(f.content ?? .zero) }
        out.append(contentsOf: f.footerItems)
        return out
    }
    @ViewBuilder func sections(_ specs: [AWCRailTabSpec], _ f: AWCRailFrame, _ palette: AWCNavigationRailPalette) -> some View {
        let m = metrics
        if !slot("logo").isEmpty || !slot("logo-expanded").isEmpty {
            let contracted = slot("logo").first, expandedLogo = slot("logo-expanded").first
            // Two logos cross-fade in place: `logo` shows collapsed (and, with no expanded logo, always); `logo-expanded` expanded.
            let _ = expandedLogo
            Group { if let contracted { slotView(contracted).modifier(AWCRailMeasure(key: "logo", runtime: runtime)) } else { Color.clear } }
                .opacity(chain(.container, .logo) * logoOpacity(f, expandedMark: false)).environment(\.layoutDirection, rtl ? .rightToLeft : .leftToRight)
                .awcInspect(nodeID: node.id, part: "logo-contracted", name: "logo-contracted") { _ in [:] }
            Group { if let expandedLogo, !horizontal { slotView(expandedLogo).modifier(AWCRailMeasure(key: "logo-expanded", runtime: runtime)) } else { Color.clear } }
                .opacity(chain(.container, .logo) * logoOpacity(f, expandedMark: true)).environment(\.layoutDirection, rtl ? .rightToLeft : .leftToRight)
        }
        if expandable {
            let open = runtime.variant == "expanded"
            renderChild(AWCNode(id: node.id + "-toggle", tag: "md-icon-button",
                                properties: ["icon": .string(open ? "menu_open" : "menu"), "aria-label": .string(toggleLabel), "aria-expanded": .string(open ? "true" : "false")], children: []),
                        { event in if event.name == "mdClick" { setVariant(nil) } })
                .environment(\.awcPopupTarget, runtime.toggleTarget)
                .frame(width: 48, height: 48)
                .opacity(chain(.container, .toggle))
                .awcInspect(nodeID: node.id, part: "toggle", name: "toggle") { _ in ["expanded": .bool(open), "icon": .string(open ? "menu_open" : "menu")] }
        }
        if let header = slot("header").first {
            // A column centred on the block axis (above its 4 bottom padding): a slotted icon button centres on the rail's
            // axis (vertical rails), other content centres (collapsed, a bar) or starts after the 8 expanded inset.
            let region = f.header ?? .zero, size = runtime.measured["header"] ?? .zero
            let iconButton = header.tag == "md-icon-button" && !horizontal
            let lead: CGFloat = iconButton ? CGFloat(m.containerWidth / 2 - m.paddingInline(expanded)) - size.width / 2 : 8
            VStack(alignment: expanded ? .leading : .center, spacing: 0) { ForEach(slot("header")) { renderChild($0, nil) } }
                .modifier(AWCRailMeasure(key: "header", runtime: runtime))
                .padding(.leading, iconButton || expanded ? lead : 0)
                .frame(width: region.width, height: max(0, region.height - 4), alignment: iconButton || expanded ? .leading : .center)
                .opacity(chain(.container, .header))
                .environment(\.layoutDirection, rtl ? .rightToLeft : .leftToRight)
                .id(header.id)
        }
        if let fab = slot("fab").first {
            // The FAB morphs with the rail (extended while expanded) on the rail's width clock, and sits flat on the surface.
            renderChild(fab.properties["label"] == nil ? fab : AWCNode(id: fab.id, tag: fab.tag, properties: fab.properties.merging(["extended": .bool(expanded)]) { _, n in n },
                                                                       children: fab.children, slot: fab.slot), nil)
                .environment(\.awcFabFlatElevation, true)
                .environment(\.awcFabRailSize, horizontal ? nil : m.fabSize)
                .environment(\.awcThemeTokens, tokens.merging(["--md-sys-motion-spring-spatial-default-duration": reduced ? "0ms" : "200ms"]) { _, n in n })
                .environment(\.layoutDirection, rtl ? .rightToLeft : .leftToRight)
                .modifier(AWCRailMeasure(key: "fab", runtime: runtime))
                .opacity(chain(.container, .fab))
        }
        if !overflowed.isEmpty { overflowTrigger(f, palette).opacity(chain(.container, .overflow, .overflowTrigger)) }
        if let leading = slot("footer-leading").first {
            slotView(leading).modifier(AWCRailMeasure(key: "footer-leading", runtime: runtime))
                .frame(width: CGFloat(m.footerLeading), height: f.leading?.height ?? CGFloat(m.footerLeading))
                .opacity(chain(.container, .footer, .footerProfile, .footerLeading))
                .awcInspect(nodeID: node.id, part: "footer-leading", name: "footer-leading") { _ in [:] }
                .id(leading.id)
        }
        if let content = slot("footer-content").first {
            // The profile text inherits its colour through footer-profile, footer and the container parts.
            let fc = rp(.footerContent)
            let ink = [AWCNavigationRailPart.footerContent, .footerProfile, .footer, .container].lazy.compactMap { rp($0)?.color }.first
            let size = fc?.fontSize ?? 16, weight = fc?.fontWeight ?? 400, tracking = fc?.letterSpacing ?? 0
            let opacity = footerContentOpacity(f)
            renderChild(content, nil)
                .font(AWCNativeFonts.label(size: CGFloat(size), weight: weight)).tracking(CGFloat(tracking)).foregroundStyle(ink.map { Color(awcHex: $0) } ?? palette.content)
                .lineLimit(1)
                .modifier(AWCRailMeasure(key: "footer-content", runtime: runtime))
                .frame(width: f.content?.width ?? 0, alignment: rtl ? .trailing : .leading).clipped()
                .opacity(chain(.container, .footer, .footerProfile) * opacity)
                .accessibilityHidden(f.footerContent < 0.5)
                .environment(\.layoutDirection, rtl ? .rightToLeft : .leftToRight)
                .awcInspect(nodeID: node.id, part: "footer-content", name: "footer-content") { _ in
                    ["opacity": .number(opacity), "color": awcTabsRGBA(awcTabsComponents(ink.map { Color(awcHex: $0) } ?? palette.content)), "fontSize": .number(size), "fontWeight": .number(weight)]
                }
                .id(content.id)
        }
        ForEach(slot("footer")) { item in
            renderChild(item, nil).modifier(AWCRailMeasure(key: "footer:" + item.id, runtime: runtime)).environment(\.layoutDirection, rtl ? .rightToLeft : .leftToRight)
                .opacity(chain(.container, .footer))
        }
    }
}


// MARK: - Destinations

extension AWCNativeNavigationRail {
    /// The destinations region: clipped to its box (overflow-x clip / overflow-y auto), each destination at its frame.
    @ViewBuilder func destinations(_ specs: [AWCRailTabSpec], _ f: AWCRailFrame, _ palette: AWCNavigationRailPalette, at t: Double) -> some View {
        let clip = f.destinations
        let frames: [CGRect] = specs.indices.map { i in f.tabs[i].tab.offsetBy(dx: -clip.minX, dy: -clip.minY) }
        AWCRailPlacer(frames: frames, size: clip.size) {
            ForEach(Array(specs.enumerated()), id: \.element.id) { i, s in
                tab(s, i, f.tabs[i], f.states[i], palette, at: t)
                    .environment(\.awcInspectionAlias, AWCInspectionAlias(childID: s.id, parentID: node.id, part: "tab-\(i)"))
            }
        }
        .frame(width: clip.width, height: clip.height, alignment: .topLeading)
        .clipped()
        .awcInspect(nodeID: node.id, part: "destinations", name: "destinations") { _ in [:] }
    }

    @ViewBuilder func tab(_ s: AWCRailTabSpec, _ i: Int, _ tf: AWCRailTabFrame, _ st: AWCRailTabState, _ palette: AWCNavigationRailPalette, at t: Double) -> some View {
        let motion = runtime.motion(s.id), tm = tabMetrics(s), tp = tm.parts
        let host = motion.color.value(t), iconColor = motion.iconColor.value(t), labelColor = motion.labelColor.value(t)
        // Part opacities: the icon wrapper covers the icon and the badge; a label part opacity replaces its reveal.
        let wrapperOpacity = tp[.iconWrapper]?.opacity ?? 1, labelOpacity = tp[.label]?.opacity ?? tf.labelOpacity
        let indicator = motion.indicator.value(t), layer = motion.layer.value(t)[0], fill = motion.fill.value(t)[0], weight = motion.weight.value(t)[0]
        let labelRendered = tf.label != nil && tf.labelOpacity > 0
        let name = s.name(labelRendered: !(visibility == "none" || (visibility == "selected" && expanded && !st.active)))
        let size = tf.tab.size
        let origin = tf.tab.origin
        // Tab-local frames of the parts (the FLIP can place them outside the destination's box).
        let local: (CGRect) -> CGRect = { $0.offsetBy(dx: -origin.x, dy: -origin.y) }
        let ring: CGRect = horizontal ? local(tf.iconWrapper).insetBy(dx: -5, dy: -5) : expanded ? local(tf.indicator) : local(tf.indicator).insetBy(dx: -5, dy: -5)
        let frames: [CGRect] = [CGRect(origin: .zero, size: size), local(tf.indicator), local(tf.iconWrapper), local(tf.icon), tf.label.map(local) ?? .zero,
                                tf.badge.map(local) ?? .zero, ring, tf.outgoing.map { local($0.rect) } ?? .zero]
        AWCRailPlacer(frames: frames, size: size) {
            // The surface takes the pointer; md-ripple fills the destination (its corners: the pill when expanded).
            Color.clear.contentShape(Rectangle())
                .modifier(AWCRippleSurface(disabled: st.disabled, hidden: false, cornerRadius: expanded ? CGFloat(tm.radius(CGRect(origin: .zero, size: size))) : 0,
                                           contentColor: awcTabsColor(host), controller: runtime.ripple(s.id), local: nil, inspectNodeID: s.id + "-ripple"))
            indicatorView(s, tf, tm, palette, indicator: indicator, layer: layer).allowsHitTesting(false)
            iconWrapperView(s, tf, tm, palette, indicator: indicator, layer: layer).allowsHitTesting(false)
            iconView(s, tm, color: iconColor, fill: fill)
                .opacity(wrapperOpacity * (s.slotIcon == nil ? tp[.icon]?.opacity ?? 1 : 1))
                .awcInspect(nodeID: s.id, part: "icon", name: "icon") { _ in ["color": awcTabsRGBA(iconColor), "fill": .number(fill), "glyph": .string(s.icon), "size": .number(tm.glyphSize)] }
                .allowsHitTesting(false)
            Group {
                if let l = tf.label {
                    labelView(s, tf, tm, color: labelColor, weight: weight)
                        .frame(width: l.width, height: l.height, alignment: .top).clipped()
                        .opacity(labelOpacity)
                        .awcInspect(nodeID: s.id, part: "label", name: "label") { _ in
                            ["color": awcTabsRGBA(labelColor), "opacity": .number(labelOpacity), "fontSize": .number(tf.labelSize), "fontWeight": .number(weight), "text": .string(s.label),
                             "lineHeight": .number(tf.labelLine), "letterSpacing": .number(tf.labelTracking)]
                        }
                } else { Color.clear }
            }.allowsHitTesting(false)
            badgeView(s, palette).opacity(wrapperOpacity).allowsHitTesting(false)
            Group {
                if st.focusVisible {
                    let r = horizontal ? tm.radius(tf.iconWrapper) + 5 : expanded ? tm.radius(tf.indicator) : tm.radius(tf.indicator) + 5
                    RoundedRectangle(cornerRadius: CGFloat(r), style: .circular).strokeBorder(palette.focusRing, lineWidth: 3)
                        .awcInspect(nodeID: s.id, part: "focus-ring", name: "focus-ring") { _ in ["color": awcTabsRGBA(awcTabsComponents(palette.focusRing))] }
                } else { Color.clear }
            }.allowsHitTesting(false)
            Group {
                if let o = tf.outgoing {
                    Text(s.label).font(AWCNativeFonts.label(size: CGFloat(o.size), weight: o.weight)).tracking(CGFloat(o.tracking)).lineLimit(1).fixedSize()
                        .foregroundStyle(awcTabsColor(labelColor)).padding(.horizontal, 4).frame(width: o.rect.width, height: o.rect.height, alignment: .leading).clipped()
                        .opacity(o.opacity)
                } else { Color.clear }
            }.allowsHitTesting(false)
        }
        .allowsHitTesting(!st.disabled)
        .opacity(tf.hidden ? 0 : 1)
        .contentShape(Rectangle())
        .onHover { h in if h { runtime.hoverID = s.id } else if runtime.hoverID == s.id { runtime.hoverID = nil } }
        .simultaneousGesture(DragGesture(minimumDistance: 0)
            .onChanged { _ in
                guard runtime.pressedID != s.id, !st.disabled else { return }
                runtime.pressedID = s.id
                let h = runtime.handle(s.id); _ = (h.requestPointerFocus ?? h.requestFocus)?()
            }
            .onEnded { v in
                runtime.pressedID = nil
                if CGRect(origin: .zero, size: size).contains(v.location) { click(i) }
            })
        .onGeometryChange(for: CGRect.self) { $0.frame(in: .named("awc-native-preview")) } action: { runtime.frames[s.id] = $0 }
        .background { anchorView(s.id) }
        .awcFocusBridgeLayer {
            AWCNativeButtonFocusBridge(configuration: AWCNativeFocusConfiguration(
                id: s.id, label: name,
                policy: AWCButtonAccessibilityPolicy(properties: ["roleOverride": .string(st.isLink ? "link" : "tab"), "selected": .bool(st.active), "disabled": .bool(st.disabled),
                                                                   "softDisabled": .bool(st.ariaDisabled), "groupTabindex": .number(st.tabStop ? 0 : -1)]),
                group: nil, cell: nil, handle: runtime.handle(s.id), focusChanged: { _ in },
                activate: { keyActivate(i) }, routeKey: { k, _, modified in modified ? false : key(k, from: s.id) },
                popup: s.menu == nil ? nil : AWCNativePopupRelationship(kind: "menu", expanded: runtime.menuOpen == s.id, target: nil, focusActionLabel: ""),
                inert: tf.hidden))
        }
        .awcInspect(nodeID: s.id, name: "md-navigation-rail-tab") { _ in
            ["active": .bool(st.active), "disabled": .bool(st.disabled), "ariaDisabled": .bool(st.ariaDisabled), "tabStop": .bool(st.tabStop), "overflowed": .bool(st.overflowed),
             "focused": .bool(st.focused), "focusVisible": .bool(st.focusVisible), "hover": .bool(st.hover), "pressed": .bool(st.pressed), "childSelected": .bool(st.childSelected),
             "role": .string(st.isLink ? "link" : "tab"), "color": awcTabsRGBA(host), "layerOpacity": .number(layer), "layerColor": awcTabsRGBA(awcTabsComponents(palette.stateLayer)),
             "indicatorColor": awcTabsRGBA(indicator), "name": .string(name), "expanded": .bool(expanded), "renderTime": .number(t), "animating": .bool(motion.running(t)),
             "haspopup": .bool(s.menu != nil)]
        }
    }
    /// The active-indicator pill (with the state layer, clipped to it); in a bar the pill rides on the icon wrapper instead.
    @ViewBuilder func indicatorView(_ s: AWCRailTabSpec, _ tf: AWCRailTabFrame, _ tm: AWCRailTabMetrics, _ palette: AWCNavigationRailPalette, indicator: [Double], layer: Double) -> some View {
        if horizontal { Color.clear } else {
            // The state layer inherits the pill's corners (border-radius: inherit) and is clipped to it.
            let shape = AWCNativeCornerShape(corners: tm.indicatorCorners(tf.indicator)), layerInk = stateLayerColor(s, palette)
            ZStack {
                shape.fill(awcTabsColor(indicator))
                shape.fill(layerInk).opacity(layer)
                    .awcInspect(nodeID: s.id, part: "state-layer", name: "state-layer") { _ in ["opacity": .number(layer), "color": awcTabsRGBA(awcTabsComponents(layerInk))] }
            }
            .opacity(tm.parts[.indicator]?.opacity ?? 1)
            .awcInspect(nodeID: s.id, part: "indicator", name: "indicator") { _ in ["color": awcTabsRGBA(indicator), "radius": .number(tf.indicatorRadius)] }
        }
    }
    @ViewBuilder func iconWrapperView(_ s: AWCRailTabSpec, _ tf: AWCRailTabFrame, _ tm: AWCRailTabMetrics, _ palette: AWCNavigationRailPalette, indicator: [Double], layer: Double) -> some View {
        let wp = tm.parts[.iconWrapper]
        if horizontal {
            // A bar's pill is the icon wrapper (its ::after tint shares the corners).
            let shape = AWCNativeCornerShape(corners: wp?.cornerShape ?? .points(tm.radius(tf.iconWrapper))), layerInk = stateLayerColor(s, palette)
            ZStack {
                shape.fill(awcTabsColor(indicator))
                shape.fill(layerInk).opacity(layer)
                    .awcInspect(nodeID: s.id, part: "state-layer", name: "state-layer") { _ in ["opacity": .number(layer), "color": awcTabsRGBA(awcTabsComponents(layerInk))] }
            }
            .opacity(wp?.opacity ?? 1)
            .awcInspect(nodeID: s.id, part: "icon-wrapper", name: "icon-wrapper") { _ in ["color": awcTabsRGBA(indicator)] }
        } else if let bg = wp?.backgroundColor {
            AWCNativeCornerShape(corners: wp?.cornerShape ?? .points(0)).fill(Color(awcHex: bg)).opacity(wp?.opacity ?? 1)
                .awcInspect(nodeID: s.id, part: "icon-wrapper", name: "icon-wrapper") { _ in ["color": awcTabsRGBA(awcTabsComponents(Color(awcHex: bg)))] }
        } else {
            Color.clear.awcInspect(nodeID: s.id, part: "icon-wrapper", name: "icon-wrapper") { _ in [:] }
        }
    }
    func stateLayerColor(_ s: AWCRailTabSpec, _ palette: AWCNavigationRailPalette) -> Color { tabParts(s)[.stateLayer]?.backgroundColor.map { Color(awcHex: $0) } ?? palette.stateLayer }
    /// The glyph (FILL 0 → 1 when active, on the destination's colour transition) or the slotted icon.
    @ViewBuilder func iconView(_ s: AWCRailTabSpec, _ tm: AWCRailTabMetrics, color: [Double], fill: Double) -> some View {
        let size = CGFloat(tm.iconSize)
        Group {
            if let slotIcon = s.slotIcon { renderChild(slotIcon, nil).environment(\.awcMaterialSymbolSize, size).foregroundStyle(awcTabsColor(color)) }
            else if !s.icon.isEmpty { Text(s.icon).font(Font(AWCNativeFonts.accordionSymbol(size: CGFloat(tm.glyphSize), fill: fill))).tracking(0).foregroundStyle(awcTabsColor(color)).fixedSize() }
            else { Color.clear }
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }
    @ViewBuilder func labelView(_ s: AWCRailTabSpec, _ tf: AWCRailTabFrame, _ tm: AWCRailTabMetrics, color: [Double], weight: Double) -> some View {
        HStack(spacing: 2) {
            Text(s.label).font(AWCNativeFonts.label(size: CGFloat(tf.labelSize), weight: weight)).tracking(CGFloat(tf.labelTracking)).lineLimit(1).truncationMode(.tail)
                .frame(height: CGFloat(tf.labelLine))
            if s.menu != nil {
                let open = runtime.menuOpen == s.id, cp = tm.parts[.caret]
                Text("arrow_drop_down").font(AWCNativeFonts.symbol(size: CGFloat(tm.caretSize))).fixedSize()
                    .foregroundStyle(cp?.color.map { Color(awcHex: $0) } ?? awcTabsColor(color))
                    .opacity(cp?.opacity ?? 1)
                    .rotationEffect(.degrees(open ? 180 : 0))
                    .animation(reduced ? nil : .timingCurve(0.2, 0, 0, 1, duration: (look.tab.caretDuration ?? 300) / 1000), value: open)
                    .awcInspect(nodeID: s.id, part: "caret", name: "caret") { _ in ["open": .bool(open)] }
            }
        }
        .foregroundStyle(awcTabsColor(color))
        .padding(.horizontal, 4)
        .frame(maxWidth: .infinity, alignment: expanded ? .leading : .center)
        .environment(\.layoutDirection, rtl ? .rightToLeft : .leftToRight)
    }
    @ViewBuilder func badgeView(_ s: AWCRailTabSpec, _ palette: AWCNavigationRailPalette) -> some View {
        if let text = s.badge {
            ZStack {
                Capsule().fill(palette.badge)
                if !text.isEmpty { Text(text).font(AWCNativeFonts.label(size: 11, weight: 500)).foregroundStyle(palette.onBadge).fixedSize() }
            }
            .accessibilityHidden(true)
            .awcInspect(nodeID: s.id, part: "badge", name: "badge") { _ in
                ["text": .string(text), "color": awcTabsRGBA(awcTabsComponents(palette.badge)), "textColor": awcTabsRGBA(awcTabsComponents(palette.onBadge)), "name": .string(s.badgeName ?? "")]
            }
        } else { Color.clear }
    }
    /// The overflow trigger: a button that reads as one more destination (icon over label), opening a menu of the
    /// overflowed destinations (disabled ones as disabled rows); upward in a column, below in a bar.
    @ViewBuilder func overflowTrigger(_ f: AWCRailFrame, _ palette: AWCNavigationRailPalette) -> some View {
        let m = metrics, h = runtime.overflowHandle
        VStack(spacing: 4) {
            AWCMaterialSymbol(overflowIcon, size: CGFloat(m.overflowIcon))
            if visibility != "none" { Text(overflowLabel).font(AWCNativeFonts.label(size: 12, weight: 500)).tracking(0.5).lineLimit(1).fixedSize() }
        }
        .foregroundStyle(rp(.overflowTrigger)?.color.map { Color(awcHex: $0) } ?? palette.content)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .overlay { if h.isFocusVisible { RoundedRectangle(cornerRadius: 8, style: .circular).strokeBorder(palette.overflowRing, lineWidth: 3) } }
        .contentShape(Rectangle())
        .onTapGesture { openOverflow() }
        .background { anchorView(node.id + "-overflow") }
        .awcFocusBridgeLayer {
            AWCNativeButtonFocusBridge(configuration: AWCNativeFocusConfiguration(
                id: node.id + "-overflow", label: overflowLabel, policy: AWCButtonAccessibilityPolicy(properties: ["roleOverride": "button"]),
                group: nil, cell: nil, handle: h, focusChanged: { _ in }, activate: { openOverflow() },
                popup: AWCNativePopupRelationship(kind: "menu", expanded: runtime.menuOpen == "overflow", target: nil, focusActionLabel: "")))
        }
        .awcInspect(nodeID: node.id, part: "overflow-trigger", name: "overflow-trigger") { _ in
            ["label": .string(overflowLabel), "icon": .string(overflowIcon), "color": awcTabsRGBA(awcTabsComponents(rp(.overflowTrigger)?.color.map { Color(awcHex: $0) } ?? palette.content))]
        }
    }
    @ViewBuilder func anchorView(_ id: String) -> some View {
        #if canImport(AppKit)
        AWCRailMenuAnchor { runtime.anchors[id] = $0 }
        #else
        Color.clear
        #endif
    }
}

// MARK: - Menus (overflow and destination dropdowns)

struct AWCRailMenuItem {
    let title: String, icon: String, enabled: Bool, checked: Bool
    let action: () -> Void
}

#if canImport(AppKit)
import AppKit
final class AWCRailMenuAnchorView: NSView { var onWindow: ((NSView) -> Void)?; override func viewDidMoveToWindow() { super.viewDidMoveToWindow(); onWindow?(self) }; override func hitTest(_ point: NSPoint) -> NSView? { nil } }
struct AWCRailMenuAnchor: NSViewRepresentable {
    let register: (NSView) -> Void
    func makeNSView(context: Context) -> AWCRailMenuAnchorView { let v = AWCRailMenuAnchorView(); v.onWindow = register; return v }
    func updateNSView(_ view: AWCRailMenuAnchorView, context: Context) { register(view) }
}
private final class AWCRailMenuTarget: NSObject {
    let action: () -> Void
    init(_ action: @escaping () -> Void) { self.action = action }
    @objc func run() { action() }
}
/// A native AppKit menu at the anchor (below it, or above it for a column's overflow trigger).
@MainActor func awcRailPopUpMenu(_ items: [AWCRailMenuItem], from view: NSView?, above: Bool, rtl: Bool, changed: @escaping (Bool) -> Void) {
    guard let view, !items.isEmpty else { return }
    let menu = NSMenu(); menu.autoenablesItems = false
    menu.userInterfaceLayoutDirection = rtl ? .rightToLeft : .leftToRight
    var targets: [AWCRailMenuTarget] = []
    for item in items {
        let target = AWCRailMenuTarget(item.action); targets.append(target)
        let row = NSMenuItem(title: item.title, action: #selector(AWCRailMenuTarget.run), keyEquivalent: "")
        row.target = target; row.isEnabled = item.enabled; row.state = item.checked ? NSControl.StateValue.on : NSControl.StateValue.off
        menu.addItem(row)
    }
    changed(true)
    let point = above ? NSPoint(x: rtl ? view.bounds.maxX : view.bounds.minX, y: view.isFlipped ? view.bounds.minY : view.bounds.maxY)
                      : NSPoint(x: rtl ? view.bounds.maxX : view.bounds.minX, y: view.isFlipped ? view.bounds.maxY : view.bounds.minY)
    menu.popUp(positioning: above ? menu.items.last : nil, at: point, in: view)
    withExtendedLifetime(targets) {}
    changed(false)
}
#endif

/// The landmark: macOS a navigation landmark group (named by `label`) holding the destinations' tab group (named by
/// `label`, absent when the destinations are links) and the rail's other controls; iOS a labelled container.
struct AWCNavigationRailAccessibility: ViewModifier {
    let id: String, label: String, tablist: Bool, enabled: Bool
    @ViewBuilder func body(content: Content) -> some View {
        if !enabled { content } else {
        #if canImport(AppKit)
        content.accessibilityHidden(true).background { AWCNavigationRailLandmarkBridge(label: label, identifier: id, tablist: tablist) }
        #else
        content.accessibilityElement(children: .contain).accessibilityLabel(label).accessibilityIdentifier(id)
        #endif
        }
    }
}

#if canImport(AppKit)
/// The destinations' tab group (Web `role=tablist` named by the rail's label): the tabs only.
final class AWCNavigationRailTablistView: NSView {
    var label = "", containerIdentifier = ""
    var tabs: [AWCNativeButtonFocusView] = []
    override func hitTest(_ point: NSPoint) -> NSView? { nil }
    override func isAccessibilityElement() -> Bool { true }
    override func accessibilityRole() -> NSAccessibility.Role? { NSAccessibility.Role(rawValue: "AXTabGroup") }
    override func accessibilityLabel() -> String? { label }
    override func accessibilityIdentifier() -> String { containerIdentifier }
    override func accessibilityChildren() -> [Any]? { tabs.forEach { $0.awcAccessibilityContainer = self }; return tabs }
}
final class AWCNavigationRailLandmarkView: NSView {
    var label = "", elementIdentifier = "", tablist = true
    let group = AWCNavigationRailTablistView()
    override init(frame: NSRect) { super.init(frame: frame) }
    required init?(coder: NSCoder) { nil }
    override func hitTest(_ point: NSPoint) -> NSView? { nil }
    override func isAccessibilityElement() -> Bool { true }
    override func accessibilityRole() -> NSAccessibility.Role? { .group }
    override func accessibilitySubrole() -> NSAccessibility.Subrole? { NSAccessibility.Subrole(rawValue: "AXLandmarkNavigation") }
    override func accessibilityLabel() -> String? { label }
    override func accessibilityIdentifier() -> String { elementIdentifier }
    /// Reading order: the rail's controls (toggle, FAB, overflow…) and, at the first destination, the tab group.
    override func accessibilityChildren() -> [Any]? {
        guard let window, let content = window.contentView else { return [] }
        let box = convert(bounds, to: nil).insetBy(dx: -1, dy: -1)
        func all(_ view: NSView) -> [NSView] { [view] + view.subviews.flatMap(all) }
        let items = all(content).compactMap { $0 as? AWCNativeButtonFocusView }.filter { item in
            let r = item.convert(item.bounds, to: nil)
            return item.configuration?.inert == false && box.contains(NSPoint(x: r.midX, y: r.midY))
        }.sorted { a, b in
            let ra = a.convert(a.bounds, to: nil), rb = b.convert(b.bounds, to: nil)
            if abs(ra.maxY - rb.maxY) > 1 { return ra.maxY > rb.maxY }
            return userInterfaceLayoutDirection == .rightToLeft ? ra.maxX > rb.maxX : ra.minX < rb.minX
        }
        guard tablist else { items.forEach { $0.awcAccessibilityContainer = self }; return items }
        var out: [Any] = [], tabs: [AWCNativeButtonFocusView] = []
        for item in items {
            if item.configuration?.policy.role == .tab { if tabs.isEmpty { out.append(group) }; tabs.append(item) }
            else { item.awcAccessibilityContainer = self; out.append(item) }
        }
        group.label = label; group.containerIdentifier = elementIdentifier + ".tablist"; group.tabs = tabs
        group.frame = bounds
        if group.superview == nil { addSubview(group) }
        return out
    }
}
struct AWCNavigationRailLandmarkBridge: NSViewRepresentable {
    let label: String, identifier: String, tablist: Bool
    func makeNSView(context: Context) -> AWCNavigationRailLandmarkView { AWCNavigationRailLandmarkView() }
    func updateNSView(_ view: AWCNavigationRailLandmarkView, context: Context) { view.label = label; view.elementIdentifier = identifier; view.tablist = tablist }
}
#endif

// MARK: - AWCNativeView routing

extension AWCNativeView {
    func followRailTab(_ s: AWCRailTabSpec) {
        guard !s.href.isEmpty else { return }
        let router = urlRouter ?? AWCURLRouter { request in openURL(request.url); return true }
        router.route(href: s.href, target: s.target.isEmpty ? "_self" : s.target, nodeID: s.id)
    }
    /// md-navigation-rail: the dedicated renderer (its md-navigation-rail-tab children are managed by it).
    @ViewBuilder var nativeNavigationRail: some View {
        let properties = node.properties.merging(local) { _, l in l }
        AWCNativeNavigationRail(node: node, properties: properties, theme: theme, inheritedDensity: inheritedDensity,
                                emit: { emitTabs($0, $1, $2, $3) }, setProperty: { set($0, $1) }, follow: { followRailTab($0) },
                                renderChild: { n, handler in child(n, handler: handler) })
    }
    /// A destination outside a rail: its own tab stop; activation emits mdTabClick only and follows its link.
    @ViewBuilder var nativeNavigationRailTab: some View {
        let properties = node.properties.merging(local) { _, l in l }
        let tab = AWCNode(id: node.id, tag: node.tag, properties: properties, children: node.children)
        let rail = AWCNode(id: node.id + "\u{0}rail", tag: "md-navigation-rail", properties: ["_standalone": .bool(true), "activeIndex": .number(properties["active"]?.bool == true ? 0 : -1),
                                                                                              "labelVisibility": properties["labelVisibility"] ?? "all"], children: [tab])
        AWCNativeNavigationRail(node: rail, properties: rail.properties, theme: theme, inheritedDensity: inheritedDensity,
                                emit: { emitTabs($0, $1, $2, $3) }, setProperty: { _, _ in }, follow: { followRailTab($0) },
                                renderChild: { n, handler in child(n, handler: handler) })
    }
}
