import SwiftUI
import Observation

/// The seven public md-radio hooks (`--md-radio-*`). Sizes are points (the state-layer hook is the density base:
/// each rung trims 4, floor 24); colours are `#RRGGBB`/`#RRGGBBAA`.
public struct AWCRadioAppearance: Equatable, Sendable {
    public let iconColor: String?, selectedIconColor: String?, iconSize: Double?, innerCircleSize: Double?
    public let stateLayerSize: Double?, stateLayerColor: String?, selectedStateLayerColor: String?
    public init(iconColor: String? = nil, selectedIconColor: String? = nil, iconSize: Double? = nil, innerCircleSize: Double? = nil,
                stateLayerSize: Double? = nil, stateLayerColor: String? = nil, selectedStateLayerColor: String? = nil) {
        func length(_ v: Double?) -> Double? { v.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil } }
        self.iconColor = awcSwitchColor(iconColor); self.selectedIconColor = awcSwitchColor(selectedIconColor)
        self.iconSize = length(iconSize); self.innerCircleSize = length(innerCircleSize); self.stateLayerSize = length(stateLayerSize)
        self.stateLayerColor = awcSwitchColor(stateLayerColor); self.selectedStateLayerColor = awcSwitchColor(selectedStateLayerColor)
    }
    public init(values: [String: AWCValue]) {
        self.init(iconColor: values["iconColor"]?.string, selectedIconColor: values["selectedIconColor"]?.string, iconSize: values["iconSize"]?.number,
                  innerCircleSize: values["innerCircleSize"]?.number, stateLayerSize: values["stateLayerSize"]?.number,
                  stateLayerColor: values["stateLayerColor"]?.string, selectedStateLayerColor: values["selectedStateLayerColor"]?.string)
    }
    public func merging(_ o: Self) -> Self {
        .init(iconColor: o.iconColor ?? iconColor, selectedIconColor: o.selectedIconColor ?? selectedIconColor, iconSize: o.iconSize ?? iconSize,
              innerCircleSize: o.innerCircleSize ?? innerCircleSize, stateLayerSize: o.stateLayerSize ?? stateLayerSize,
              stateLayerColor: o.stateLayerColor ?? stateLayerColor, selectedStateLayerColor: o.selectedStateLayerColor ?? selectedStateLayerColor)
    }
}

/// `::part(state-layer|outer-circle|inner-circle)` styling: outer-tree rules win over hooks and every state and disabled rule
/// (a state-layer opacity replaces the state opacities). The `container` part has no paint of its own.
public struct AWCRadioPartAppearance: Equatable, Sendable {
    public let stateLayerColor: String?, stateLayerOpacity: Double?, outerColor: String?, outerFill: String?, innerColor: String?
    public init(stateLayerColor: String? = nil, stateLayerOpacity: Double? = nil, outerColor: String? = nil, outerFill: String? = nil, innerColor: String? = nil) {
        self.stateLayerColor = awcSwitchColor(stateLayerColor); self.stateLayerOpacity = stateLayerOpacity.flatMap { $0.isFinite ? min(1, max(0, $0)) : nil }
        self.outerColor = awcSwitchColor(outerColor); self.outerFill = awcSwitchColor(outerFill); self.innerColor = awcSwitchColor(innerColor)
    }
    public func merging(_ o: Self) -> Self {
        .init(stateLayerColor: o.stateLayerColor ?? stateLayerColor, stateLayerOpacity: o.stateLayerOpacity ?? stateLayerOpacity,
              outerColor: o.outerColor ?? outerColor, outerFill: o.outerFill ?? outerFill, innerColor: o.innerColor ?? innerColor)
    }
}

private struct AWCRadioAppearanceKey: EnvironmentKey { static let defaultValue = AWCRadioAppearance() }
private struct AWCRadioPartAppearanceKey: EnvironmentKey { static let defaultValue = AWCRadioPartAppearance() }
extension EnvironmentValues {
    var awcRadioAppearance: AWCRadioAppearance { get { self[AWCRadioAppearanceKey.self] } set { self[AWCRadioAppearanceKey.self] = newValue } }
    var awcRadioPartAppearance: AWCRadioPartAppearance { get { self[AWCRadioPartAppearanceKey.self] } set { self[AWCRadioPartAppearanceKey.self] = newValue } }
}
private struct AWCRadioAppearanceModifier: ViewModifier {
    let value: AWCRadioAppearance
    @Environment(\.awcRadioAppearance) private var inherited
    func body(content: Content) -> some View { content.environment(\.awcRadioAppearance, inherited.merging(value)) }
}
private struct AWCRadioPartAppearanceModifier: ViewModifier {
    let value: AWCRadioPartAppearance
    @Environment(\.awcRadioPartAppearance) private var inherited
    func body(content: Content) -> some View { content.environment(\.awcRadioPartAppearance, inherited.merging(value)) }
}
public extension View {
    /// Applies md-radio hook values to descendant radios.
    func awcRadioAppearance(_ value: AWCRadioAppearance) -> some View { modifier(AWCRadioAppearanceModifier(value: value)) }
    /// Applies `::part(...)` styling to descendant radios.
    func awcRadioPartAppearance(_ value: AWCRadioPartAppearance) -> some View { modifier(AWCRadioPartAppearanceModifier(value: value)) }
}

/// Name-scoped radio groups of one native tree (the source's `md-radio[name]` in one root): registration order is
/// the arrow order; the checked member, the single roving tab stop and the group's `required` state derive from it.
@MainActor @Observable final class AWCRadioGroups {
    private final class WeakStore { weak var value: AWCInteractionStore?; init(_ value: AWCInteractionStore) { self.value = value } }
    @ObservationIgnored private static var trees: [ObjectIdentifier: (store: WeakStore, groups: AWCRadioGroups)] = [:]
    /// The registry of one interaction scope. Entries are held weakly by their store: a released scope's registry is
    /// dropped (an identifier reused by a later store never inherits stale members).
    static func of(_ store: AWCInteractionStore) -> AWCRadioGroups {
        let key = ObjectIdentifier(store)
        if let entry = trees[key], entry.store.value === store { return entry.groups }
        trees = trees.filter { $0.value.store.value != nil }
        let g = AWCRadioGroups(); trees[key] = (WeakStore(store), g); return g
    }
    final class Member {
        let id: String; var value = "", disabled = false, softDisabled = false, required = false, seq = 0
        var focus: () -> Void = {}, select: (_ source: String) -> Void = { _ in }, uncheck: () -> Void = {}
        /// The member's window frame and direction: document order is the reading order of the rendered radios.
        var frame = CGRect.null, rtl = false
        init(id: String) { self.id = id }
    }
    /// The checked member id per group name (observed: tab stops and validity follow it).
    var checked: [String: String] = [:]
    var revision = 0
    @ObservationIgnored private var members: [String: [Member]] = [:]
    @ObservationIgnored private var seq = 0
    func member(_ name: String, _ id: String) -> Member {
        if let m = members[name]?.first(where: { $0.id == id }) { return m }
        let m = Member(id: id); seq += 1; m.seq = seq; members[name, default: []].append(m); revision &+= 1; return m
    }
    func remove(_ name: String, _ id: String) {
        members[name]?.removeAll { $0.id == id }; if checked[name] == id { checked[name] = nil }; revision &+= 1
    }
    /// Document order: native trees have no shared DOM, and appearance order is not tree order, so members are read
    /// in rendered reading order — rows top to bottom; within a row (vertical overlap over half the smaller height)
    /// leading to trailing, right to left only when every member is right-to-left. Until every member is laid out,
    /// registration order.
    func ordered(_ name: String) -> [Member] {
        let list = members[name] ?? []
        guard list.count > 1, list.allSatisfy({ !$0.frame.isNull && !$0.frame.isEmpty }) else { return list }
        let rtl = list.allSatisfy(\.rtl)
        return list.sorted { a, b in
            let overlap = min(a.frame.maxY, b.frame.maxY) - max(a.frame.minY, b.frame.minY)
            if overlap > 0.5 * min(a.frame.height, b.frame.height) {
                if abs(a.frame.minX - b.frame.minX) > 0.5 { return rtl ? a.frame.minX > b.frame.minX : a.frame.minX < b.frame.minX }
                return a.seq < b.seq
            }
            return a.frame.minY < b.frame.minY
        }
    }
    /// Records a member's rendered frame; observers re-evaluate when the group's order changes.
    func place(_ name: String, _ id: String, frame: CGRect, rtl: Bool) {
        guard let m = members[name]?.first(where: { $0.id == id }), m.frame != frame || m.rtl != rtl else { return }
        let before = ordered(name).map(\.id); m.frame = frame; m.rtl = rtl
        if ordered(name).map(\.id) != before { revision &+= 1 }
    }
    /// `checked` became true for `id`: every other member is unchecked silently (source `uncheckOthers`).
    func didCheck(_ name: String, _ id: String) {
        checked[name] = id
        for m in ordered(name) where m.id != id { m.uncheck() }
    }
    func didUncheck(_ name: String, _ id: String) { if checked[name] == id { checked[name] = nil } }
    /// Roving tab index (WAI-ARIA radio group): the checked radio, else the first radio that is not hard disabled.
    func tabIndex(_ name: String, _ id: String, checked isChecked: Bool, disabled: Bool) -> Int {
        _ = revision
        if disabled { return -1 }
        if isChecked || name.isEmpty { return 0 }
        if let c = checked[name], c != id { return -1 }
        return ordered(name).first(where: { !$0.disabled })?.id == id ? 0 : -1
    }
    /// `required` on any member makes the whole group required; it is missing while nothing is checked.
    func valueMissing(_ name: String, required: Bool) -> Bool {
        _ = revision
        guard !name.isEmpty else { return false }
        return (required || ordered(name).contains { $0.required }) && checked[name] == nil
    }
    /// Arrow navigation (source `focusSibling`): next/previous member that is neither disabled nor soft-disabled,
    /// wrapping; it is focused and, unless already checked, checked with its own `mdChange`.
    func move(_ name: String, from id: String, by step: Int) {
        let enabled = ordered(name).filter { !$0.disabled && !$0.softDisabled }
        guard !enabled.isEmpty, let i = enabled.firstIndex(where: { $0.id == id }) else { return }
        let target = enabled[(i + step + enabled.count) % enabled.count]
        target.focus()
        if checked[name] == target.id { return }
        target.select("arrow")
    }
}
