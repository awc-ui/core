import SwiftUI

/// The md-list-item CSS parts (CEM order). Part rules come from the outer tree, so a
/// native part appearance wins over the hooks and every internal state rule.
public enum AWCListItemPart: String, CaseIterable, Sendable, Hashable {
    case row, stateLayer = "state-layer", primary, leading, content, headline, overline
    case supportingText = "supporting-text", trailing, trailingSupportingText = "trailing-supporting-text"
    case leadingIcon = "leading-icon", trailingIcon = "trailing-icon", avatar, avatarImage = "avatar-image"
    case avatarInitials = "avatar-initials", avatarIcon = "avatar-icon", image, imageWrap = "image-wrap"
    case imageSelectionIndicator = "image-selection-indicator", imageSelectionCircle = "image-selection-circle"
    case imageSelectionCheck = "image-selection-check", expandButton = "expand-button"
    case expandButtonStateLayer = "expand-button-state-layer", expandButtonIcon = "expand-button-icon"
    case dragHandle = "drag-handle", expandedPanel = "expanded-panel", expandedPanelInner = "expanded-panel-inner"
    case headlineTooltipPopup = "headline-tooltip-popup", supportingTooltipPopup = "supporting-tooltip-popup"
}
/// Sparse `::part()` declarations (shared part-appearance vocabulary).
public typealias AWCListPartAppearance = AWCAccordionPartAppearance

private struct AWCListAppearanceKey: EnvironmentKey { static let defaultValue = AWCListAppearance() }
private struct AWCListAppearanceTargetsKey: EnvironmentKey { static let defaultValue: [String: AWCListAppearance] = [:] }
private struct AWCListItemAppearanceKey: EnvironmentKey { static let defaultValue = AWCListItemAppearance() }
private struct AWCListItemAppearanceTargetsKey: EnvironmentKey { static let defaultValue: [String: AWCListItemAppearance] = [:] }
private struct AWCListItemPartAppearanceKey: EnvironmentKey { static let defaultValue: [AWCListItemPart: AWCListPartAppearance] = [:] }
private struct AWCListPlaceholderPartKey: EnvironmentKey { static let defaultValue: AWCListPartAppearance? = nil }
private struct AWCListReducedMotionKey: EnvironmentKey { static let defaultValue: Bool? = nil }
private struct AWCListItemContextKey: EnvironmentKey { static let defaultValue: AWCListItemContext? = nil }
private struct AWCListSpacingRungKey: EnvironmentKey { static let defaultValue: Double? = nil }
extension EnvironmentValues {
    var awcListAppearance: AWCListAppearance { get { self[AWCListAppearanceKey.self] } set { self[AWCListAppearanceKey.self] = newValue } }
    var awcListAppearanceTargets: [String: AWCListAppearance] { get { self[AWCListAppearanceTargetsKey.self] } set { self[AWCListAppearanceTargetsKey.self] = newValue } }
    /// Item hooks inherited from an ancestor (CSS inheritance: the list's `::slotted` rules win over them).
    var awcListItemAppearance: AWCListItemAppearance { get { self[AWCListItemAppearanceKey.self] } set { self[AWCListItemAppearanceKey.self] = newValue } }
    /// Item hooks declared on one item (inline style: wins over the list's `::slotted` rules).
    var awcListItemAppearanceTargets: [String: AWCListItemAppearance] { get { self[AWCListItemAppearanceTargetsKey.self] } set { self[AWCListItemAppearanceTargetsKey.self] = newValue } }
    var awcListItemPartAppearance: [AWCListItemPart: AWCListPartAppearance] { get { self[AWCListItemPartAppearanceKey.self] } set { self[AWCListItemPartAppearanceKey.self] = newValue } }
    var awcListPlaceholderPart: AWCListPartAppearance? { get { self[AWCListPlaceholderPartKey.self] } set { self[AWCListPlaceholderPartKey.self] = newValue } }
    var awcListReducedMotion: Bool? { get { self[AWCListReducedMotionKey.self] } set { self[AWCListReducedMotionKey.self] = newValue } }
    var awcListItemContext: AWCListItemContext? { get { self[AWCListItemContextKey.self] } set { self[AWCListItemContextKey.self] = newValue } }
    /// The density rung of the shared spacing tokens (`--md-sys-spacing-*`): set by the
    /// -2...-4 density rules only, so a local -1 keeps an inherited -4 spacing (source hybrid).
    var awcListSpacingRung: Double? { get { self[AWCListSpacingRungKey.self] } set { self[AWCListSpacingRungKey.self] = newValue } }
}
private struct AWCListAppearanceModifier: ViewModifier {
    let value: AWCListAppearance, id: String?
    @Environment(\.awcListAppearance) private var inherited
    @Environment(\.awcListAppearanceTargets) private var targets
    func body(content: Content) -> some View {
        if let id { var t = targets; t[id] = (t[id] ?? .init()).merging(value); return AnyView(content.environment(\.awcListAppearanceTargets, t)) }
        return AnyView(content.environment(\.awcListAppearance, inherited.merging(value)))
    }
}
private struct AWCListItemAppearanceModifier: ViewModifier {
    let value: AWCListItemAppearance, id: String?
    @Environment(\.awcListItemAppearance) private var inherited
    @Environment(\.awcListItemAppearanceTargets) private var targets
    func body(content: Content) -> some View {
        if let id { var t = targets; t[id] = (t[id] ?? .init()).merging(value); return AnyView(content.environment(\.awcListItemAppearanceTargets, t)) }
        return AnyView(content.environment(\.awcListItemAppearance, inherited.merging(value)))
    }
}
private struct AWCListItemPartAppearanceModifier: ViewModifier {
    let value: AWCListPartAppearance, part: AWCListItemPart
    @Environment(\.awcListItemPartAppearance) private var inherited
    func body(content: Content) -> some View {
        var t = inherited; t[part] = (t[part] ?? .init()).merging(value)
        return content.environment(\.awcListItemPartAppearance, t)
    }
}
public extension View {
    /// md-list hooks for descendant lists, or for the list with `id`.
    func awcListAppearance(_ value: AWCListAppearance, for id: String? = nil) -> some View { modifier(AWCListAppearanceModifier(value: value, id: id)) }
    /// md-list-item hooks. Without `id` the values are inherited by every descendant row (like
    /// setting them on the list); with `id` they are declared on that row and win over the list's
    /// per-position shape rules.
    func awcListItemAppearance(_ value: AWCListItemAppearance, for id: String? = nil) -> some View { modifier(AWCListItemAppearanceModifier(value: value, id: id)) }
    /// `md-list-item::part(<part>)` styling for descendant rows.
    func awcListItemPartAppearance(_ value: AWCListPartAppearance, part: AWCListItemPart) -> some View { modifier(AWCListItemPartAppearanceModifier(value: value, part: part)) }
    /// `md-list::part(drop-placeholder)` styling.
    func awcListPlaceholderPartAppearance(_ value: AWCListPartAppearance) -> some View { environment(\.awcListPlaceholderPart, value) }
    /// Forces reduced (or full) motion for descendant lists, overriding the system setting.
    func awcListReducedMotion(_ reduced: Bool?) -> some View { environment(\.awcListReducedMotion, reduced) }
}

/// What a hosting md-list (or a parent row's expanded panel) tells one row; the source
/// pushes the same values down as data attributes and internal properties.
struct AWCListItemContext {
    var listStyle = "standard", selectionMode = "none", interactionMode = "single-action", containerRole = "list"
    var reorderable = false
    /// Inside an md-list (`:host-context(md-list)` expressive sizing); panel rows inherit it.
    var hostList = false
    var first = false, last = false
    var index = 0, childIndex: Int? = nil, count = 0
    /// Slotted into a parent row's expanded content (flat, square rows).
    var inPanel = false, lastInLastExpanded = false
    var spacingRung: Double = 0
    weak var runtime: AWCListRuntime?
    var inSelectionMode: Bool { selectionMode == "single-select" || selectionMode == "multi-select" }
}

// MARK: Methods

/// Native counterparts of md-list's methods (`activateNext`, `activatePrevious`, `selectItem`,
/// `getSelectedIndices`). A controller addresses one list (by node id, see `awcListController`).
public final class AWCListController {
    weak var runtime: AWCListRuntime?
    public init() {}
    public var isConnected: Bool { runtime != nil }
    /// Moves roving focus (with a visible ring) to the next focusable row, wrapping; returns its id.
    @discardableResult public func activateNext() -> String? { runtime?.step(1) }
    /// Moves roving focus to the previous focusable row, wrapping; returns its id.
    @discardableResult public func activatePrevious() -> String? { runtime?.step(-1) }
    /// Selects (single) or toggles (multi) the row at `index` without emitting `mdSelect`.
    public func selectItem(_ index: Int) { runtime?.selectSilently(index) }
    /// Indices of the selected rows in display order.
    public func getSelectedIndices() -> [Int] { runtime?.selectedIndices() ?? [] }
}
final class AWCListItemHandle {
    var focus: (Bool) -> Bool = { _ in false }
    var setExpanded: (Bool?) -> Void = { _ in }
}
/// Native counterparts of md-list-item's methods (`setFocus`, `focusItem`, `toggle`, `expand`, `collapse`).
public final class AWCListItemController {
    weak var handle: AWCListItemHandle?
    public init() {}
    public var isConnected: Bool { handle != nil }
    /// Focuses the row; `focusVisible` shows the keyboard ring (`setFocus({ focusVisible: true })`).
    @discardableResult public func setFocus(focusVisible: Bool = false) -> Bool { handle?.focus(focusVisible) ?? false }
    @discardableResult public func focusItem() -> Bool { setFocus() }
    /// Toggles `expanded` (no-op unless expandable and enabled; emits no `mdExpand`, like the source).
    public func toggle() { handle?.setExpanded(nil) }
    public func expand() { handle?.setExpanded(true) }
    public func collapse() { handle?.setExpanded(false) }
}
private struct AWCListControllersKey: EnvironmentKey { static let defaultValue: [String: AWCListController] = [:] }
private struct AWCListItemControllersKey: EnvironmentKey { static let defaultValue: [String: AWCListItemController] = [:] }
extension EnvironmentValues {
    var awcListControllers: [String: AWCListController] { get { self[AWCListControllersKey.self] } set { self[AWCListControllersKey.self] = newValue } }
    var awcListItemControllers: [String: AWCListItemController] { get { self[AWCListItemControllersKey.self] } set { self[AWCListItemControllersKey.self] = newValue } }
}
private struct AWCListControllerModifier: ViewModifier {
    let id: String, controller: AWCListController
    @Environment(\.awcListControllers) private var inherited
    func body(content: Content) -> some View { var c = inherited; c[id] = controller; return content.environment(\.awcListControllers, c) }
}
private struct AWCListItemControllerModifier: ViewModifier {
    let id: String, controller: AWCListItemController
    @Environment(\.awcListItemControllers) private var inherited
    func body(content: Content) -> some View { var c = inherited; c[id] = controller; return content.environment(\.awcListItemControllers, c) }
}
public extension View {
    /// Attach a controller to the md-list with node id `id` rendered inside this view.
    func awcListController(_ controller: AWCListController, for id: String) -> some View { modifier(AWCListControllerModifier(id: id, controller: controller)) }
    /// Attach a controller to the md-list-item with node id `id` rendered inside this view.
    func awcListItemController(_ controller: AWCListItemController, for id: String) -> some View { modifier(AWCListItemControllerModifier(id: id, controller: controller)) }
}
