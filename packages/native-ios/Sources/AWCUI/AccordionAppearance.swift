import SwiftUI

/// Physical source padding; logical SwiftUI edges are resolved at the use site.
public struct AWCAccordionInsets: Equatable, Sendable {
    public let top: Double, right: Double, bottom: Double, left: Double
    public init(top: Double, right: Double, bottom: Double, left: Double) {
        self.top = top; self.right = right; self.bottom = bottom; self.left = left
    }
    public init(block: Double, inline: Double) { self.init(top: block, right: inline, bottom: block, left: inline) }
    var valid: Bool { [top,right,bottom,left].allSatisfy { $0.isFinite && $0 >= 0 } }
    public init?(values: [String: AWCValue]) {
        guard Set(values.keys).isSubset(of: ["top","right","bottom","left"]) else { return nil }
        func n(_ key: String) -> Double? { guard case .number(let value) = values[key], value.isFinite, value >= 0 else { return nil }; return value }
        guard let t=n("top"), let r=n("right"), let b=n("bottom"), let l=n("left") else { return nil }
        self.init(top:t,right:r,bottom:b,left:l)
    }
    func edges(rtl: Bool) -> EdgeInsets { .init(top:top,leading:rtl ? right:left,bottom:bottom,trailing:rtl ? left:right) }
}
private func accordionColor(_ value: String?) -> String? {
    value.flatMap { $0.range(of: "^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$", options: .regularExpression) != nil ? $0.uppercased() : nil }
}

public struct AWCAccordionAppearance: Equatable, Sendable {
    public let gap: Double?
    public let outlineColor: String?
    public let containerShape: AWCCornerShape?
    public let elevation: [AWCBoxShadow]?
    public let dropPlaceholderColor: String?, dropPlaceholderOutlineColor: String?
    public let dropPlaceholderOutlineWidth: Double?, dropPlaceholderOpacity: Double?
    public let dropPlaceholderShape: AWCCornerShape?
    /// Floating panel hooks: --md-accordion-floating-width/-bg/-elevation/-elevation-active/-radius.
    public let floatingWidth: Double?, floatingBackground: String?
    public let floatingElevation: [AWCBoxShadow]?, floatingElevationActive: [AWCBoxShadow]?
    public let floatingRadius: AWCCornerShape?
    public init(gap: Double? = nil, outlineColor: String? = nil, containerShape: AWCCornerShape? = nil, elevation: [AWCBoxShadow]? = nil, dropPlaceholderColor: String? = nil, dropPlaceholderOutlineColor: String? = nil, dropPlaceholderOutlineWidth: Double? = nil, dropPlaceholderShape: AWCCornerShape? = nil, dropPlaceholderOpacity: Double? = nil, floatingWidth: Double? = nil, floatingBackground: String? = nil, floatingElevation: [AWCBoxShadow]? = nil, floatingElevationActive: [AWCBoxShadow]? = nil, floatingRadius: AWCCornerShape? = nil) {
        self.floatingWidth = floatingWidth.flatMap { $0.isFinite && $0 >= 0 ? $0:nil }; self.floatingBackground = accordionColor(floatingBackground)
        self.floatingElevation = floatingElevation.flatMap { $0.allSatisfy(\.valid) ? $0:nil }; self.floatingElevationActive = floatingElevationActive.flatMap { $0.allSatisfy(\.valid) ? $0:nil }
        self.floatingRadius = floatingRadius.flatMap { $0.valid ? $0:nil }
        self.dropPlaceholderColor = accordionColor(dropPlaceholderColor)
        self.dropPlaceholderOutlineColor = accordionColor(dropPlaceholderOutlineColor)
        self.dropPlaceholderOutlineWidth = dropPlaceholderOutlineWidth.flatMap { $0.isFinite && $0 >= 0 ? $0:nil }
        self.dropPlaceholderShape = dropPlaceholderShape.flatMap { $0.valid ? $0:nil }
        self.dropPlaceholderOpacity = dropPlaceholderOpacity.flatMap { $0.isFinite ? min(1,max(0,$0)):nil }
        self.gap = gap.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil }
        self.outlineColor = accordionColor(outlineColor)
        self.containerShape = containerShape.flatMap { $0.valid ? $0 : nil }
        self.elevation = elevation.flatMap { $0.allSatisfy(\.valid) ? $0 : nil }
    }
    public init(values: [String: AWCValue]) {
        func text(_ key: String) -> String? { guard case .string(let value) = values[key] else { return nil }; return value }
        func number(_ key: String) -> Double? { guard case .number(let value) = values[key] else { return nil }; return value }
        func shape(_ key: String) -> AWCCornerShape? { guard case .object(let value) = values[key] else { return nil }; return .init(values:value) }
        func insets(_ key: String) -> AWCAccordionInsets? { guard case .object(let value) = values[key] else { return nil }; return .init(values:value) }
        func shadow(_ key: String) -> [AWCBoxShadow]? {
            guard case .array(let array) = values[key] else { return nil }
            let result = array.compactMap { value -> AWCBoxShadow? in guard case .object(let fields) = value else { return nil }; return .init(values:fields) }
            return result.count == array.count ? result : nil
        }
        self.init(gap: number("gap"), outlineColor: text("outlineColor"), containerShape: shape("containerShape"), elevation: shadow("elevation"), dropPlaceholderColor:text("dropPlaceholderColor"), dropPlaceholderOutlineColor:text("dropPlaceholderOutlineColor"), dropPlaceholderOutlineWidth:number("dropPlaceholderOutlineWidth"), dropPlaceholderShape:shape("dropPlaceholderShape"), dropPlaceholderOpacity:number("dropPlaceholderOpacity"), floatingWidth:number("floatingWidth"), floatingBackground:text("floatingBackground"), floatingElevation:shadow("floatingElevation"), floatingElevationActive:shadow("floatingElevationActive"), floatingRadius:shape("floatingRadius"))
    }
    public func merging(_ local: Self) -> Self { .init(gap: local.gap ?? gap, outlineColor: local.outlineColor ?? outlineColor, containerShape: local.containerShape ?? containerShape, elevation: local.elevation ?? elevation, dropPlaceholderColor: local.dropPlaceholderColor ?? dropPlaceholderColor, dropPlaceholderOutlineColor: local.dropPlaceholderOutlineColor ?? dropPlaceholderOutlineColor, dropPlaceholderOutlineWidth: local.dropPlaceholderOutlineWidth ?? dropPlaceholderOutlineWidth, dropPlaceholderShape: local.dropPlaceholderShape ?? dropPlaceholderShape, dropPlaceholderOpacity: local.dropPlaceholderOpacity ?? dropPlaceholderOpacity, floatingWidth: local.floatingWidth ?? floatingWidth, floatingBackground: local.floatingBackground ?? floatingBackground, floatingElevation: local.floatingElevation ?? floatingElevation, floatingElevationActive: local.floatingElevationActive ?? floatingElevationActive, floatingRadius: local.floatingRadius ?? floatingRadius) }
}
private struct AWCAccordionAppearanceKey: EnvironmentKey { static let defaultValue = AWCAccordionAppearance() }
private struct AWCAccordionAppearanceTargetsKey: EnvironmentKey { static let defaultValue: [String: AWCAccordionAppearance] = [:] }
extension EnvironmentValues {
    var awcAccordionAppearance: AWCAccordionAppearance { get { self[AWCAccordionAppearanceKey.self] } set { self[AWCAccordionAppearanceKey.self] = newValue } }
    var awcAccordionAppearanceTargets: [String:AWCAccordionAppearance] { get { self[AWCAccordionAppearanceTargetsKey.self] } set { self[AWCAccordionAppearanceTargetsKey.self] = newValue } }
}
private struct AWCAccordionAppearanceModifier: ViewModifier {
    let value: AWCAccordionAppearance, id: String?
    @Environment(\.awcAccordionAppearance) private var inherited
    @Environment(\.awcAccordionAppearanceTargets) private var targets
    @ViewBuilder func body(content: Content) -> some View {
        if let id {
            let updated = targets.merging([id:(targets[id] ?? .init()).merging(value)]) { _,local in local }
            content.environment(\.awcAccordionAppearanceTargets, updated)
        } else { content.environment(\.awcAccordionAppearance, inherited.merging(value)) }
    }
}
public extension View {
    func awcAccordionAppearance(_ value: AWCAccordionAppearance, for id: String? = nil) -> some View { modifier(AWCAccordionAppearanceModifier(value:value,id:id)) }
}

public struct AWCAccordionItemAppearance: Equatable, Sendable {
    /// Chassis-grip hooks: --md-accordion-item-chassis-handle-color / -bg-hover.
    public let chassisHandleColor: String?, chassisHandleBackgroundHover: String?
    public let containerColorDragging: String?
    public let containerShapeDragging: AWCCornerShape?
    public let containerColor: String?
    public let containerColorExpanded: String?
    public let headerColor: String?
    public let headerColorExpanded: String?
    public let headlineColor: String?
    public let headlineColorExpanded: String?
    public let supportingColor: String?
    public let iconColor: String?
    public let iconColorExpanded: String?
    public let stateLayerColor: String?
    public let stateLayerColorExpanded: String?
    public let containerShape: AWCCornerShape?
    public let containerShapeExpanded: AWCCornerShape?
    public let headerPadding: AWCAccordionInsets?
    public let contentPadding: AWCAccordionInsets?
    public let headerMinHeight: Double?
    public let expandDuration: Double?
    public let collapseDuration: Double?
    public let elevation: [AWCBoxShadow]?
    public let elevationExpanded: [AWCBoxShadow]?
    public init(containerColor: String? = nil, containerColorExpanded: String? = nil, headerColor: String? = nil, headerColorExpanded: String? = nil, headlineColor: String? = nil, headlineColorExpanded: String? = nil, supportingColor: String? = nil, iconColor: String? = nil, iconColorExpanded: String? = nil, stateLayerColor: String? = nil, stateLayerColorExpanded: String? = nil, containerShape: AWCCornerShape? = nil, containerShapeExpanded: AWCCornerShape? = nil, headerPadding: AWCAccordionInsets? = nil, contentPadding: AWCAccordionInsets? = nil, headerMinHeight: Double? = nil, expandDuration: Double? = nil, collapseDuration: Double? = nil, elevation: [AWCBoxShadow]? = nil, elevationExpanded: [AWCBoxShadow]? = nil, containerColorDragging: String? = nil, containerShapeDragging: AWCCornerShape? = nil, chassisHandleColor: String? = nil, chassisHandleBackgroundHover: String? = nil) {
        self.chassisHandleColor = accordionColor(chassisHandleColor); self.chassisHandleBackgroundHover = accordionColor(chassisHandleBackgroundHover)
        self.containerColorDragging = accordionColor(containerColorDragging)
        self.containerShapeDragging = containerShapeDragging.flatMap { $0.valid ? $0:nil }
        self.containerColor = accordionColor(containerColor)
        self.containerColorExpanded = accordionColor(containerColorExpanded)
        self.headerColor = accordionColor(headerColor)
        self.headerColorExpanded = accordionColor(headerColorExpanded)
        self.headlineColor = accordionColor(headlineColor)
        self.headlineColorExpanded = accordionColor(headlineColorExpanded)
        self.supportingColor = accordionColor(supportingColor)
        self.iconColor = accordionColor(iconColor)
        self.iconColorExpanded = accordionColor(iconColorExpanded)
        self.stateLayerColor = accordionColor(stateLayerColor)
        self.stateLayerColorExpanded = accordionColor(stateLayerColorExpanded)
        self.containerShape = containerShape.flatMap { $0.valid ? $0 : nil }
        self.containerShapeExpanded = containerShapeExpanded.flatMap { $0.valid ? $0 : nil }
        self.headerPadding = headerPadding.flatMap { $0.valid ? $0 : nil }
        self.contentPadding = contentPadding.flatMap { $0.valid ? $0 : nil }
        self.headerMinHeight = headerMinHeight.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil }
        self.expandDuration = expandDuration.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil }
        self.collapseDuration = collapseDuration.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil }
        self.elevation = elevation.flatMap { $0.allSatisfy(\.valid) ? $0 : nil }
        self.elevationExpanded = elevationExpanded.flatMap { $0.allSatisfy(\.valid) ? $0 : nil }
    }
    public init(values: [String: AWCValue]) {
        func text(_ key: String) -> String? { guard case .string(let value) = values[key] else { return nil }; return value }
        func number(_ key: String) -> Double? { guard case .number(let value) = values[key] else { return nil }; return value }
        func shape(_ key: String) -> AWCCornerShape? { guard case .object(let value) = values[key] else { return nil }; return .init(values:value) }
        func insets(_ key: String) -> AWCAccordionInsets? { guard case .object(let value) = values[key] else { return nil }; return .init(values:value) }
        func shadow(_ key: String) -> [AWCBoxShadow]? {
            guard case .array(let array) = values[key] else { return nil }
            let result = array.compactMap { value -> AWCBoxShadow? in guard case .object(let fields) = value else { return nil }; return .init(values:fields) }
            return result.count == array.count ? result : nil
        }
        self.init(containerColor: text("containerColor"), containerColorExpanded: text("containerColorExpanded"), headerColor: text("headerColor"), headerColorExpanded: text("headerColorExpanded"), headlineColor: text("headlineColor"), headlineColorExpanded: text("headlineColorExpanded"), supportingColor: text("supportingColor"), iconColor: text("iconColor"), iconColorExpanded: text("iconColorExpanded"), stateLayerColor: text("stateLayerColor"), stateLayerColorExpanded: text("stateLayerColorExpanded"), containerShape: shape("containerShape"), containerShapeExpanded: shape("containerShapeExpanded"), headerPadding: insets("headerPadding"), contentPadding: insets("contentPadding"), headerMinHeight: number("headerMinHeight"), expandDuration: number("expandDuration"), collapseDuration: number("collapseDuration"), elevation: shadow("elevation"), elevationExpanded: shadow("elevationExpanded"), containerColorDragging:text("containerColorDragging"), containerShapeDragging:shape("containerShapeDragging"), chassisHandleColor: text("chassisHandleColor"), chassisHandleBackgroundHover: text("chassisHandleBackgroundHover"))
    }
    public func merging(_ local: Self) -> Self { .init(containerColor: local.containerColor ?? containerColor, containerColorExpanded: local.containerColorExpanded ?? containerColorExpanded, headerColor: local.headerColor ?? headerColor, headerColorExpanded: local.headerColorExpanded ?? headerColorExpanded, headlineColor: local.headlineColor ?? headlineColor, headlineColorExpanded: local.headlineColorExpanded ?? headlineColorExpanded, supportingColor: local.supportingColor ?? supportingColor, iconColor: local.iconColor ?? iconColor, iconColorExpanded: local.iconColorExpanded ?? iconColorExpanded, stateLayerColor: local.stateLayerColor ?? stateLayerColor, stateLayerColorExpanded: local.stateLayerColorExpanded ?? stateLayerColorExpanded, containerShape: local.containerShape ?? containerShape, containerShapeExpanded: local.containerShapeExpanded ?? containerShapeExpanded, headerPadding: local.headerPadding ?? headerPadding, contentPadding: local.contentPadding ?? contentPadding, headerMinHeight: local.headerMinHeight ?? headerMinHeight, expandDuration: local.expandDuration ?? expandDuration, collapseDuration: local.collapseDuration ?? collapseDuration, elevation: local.elevation ?? elevation, elevationExpanded: local.elevationExpanded ?? elevationExpanded, containerColorDragging:local.containerColorDragging ?? containerColorDragging, containerShapeDragging:local.containerShapeDragging ?? containerShapeDragging, chassisHandleColor: local.chassisHandleColor ?? chassisHandleColor, chassisHandleBackgroundHover: local.chassisHandleBackgroundHover ?? chassisHandleBackgroundHover) }
}
private struct AWCAccordionItemAppearanceKey: EnvironmentKey { static let defaultValue = AWCAccordionItemAppearance() }
private struct AWCAccordionItemAppearanceTargetsKey: EnvironmentKey { static let defaultValue: [String: AWCAccordionItemAppearance] = [:] }
extension EnvironmentValues {
    var awcAccordionItemAppearance: AWCAccordionItemAppearance { get { self[AWCAccordionItemAppearanceKey.self] } set { self[AWCAccordionItemAppearanceKey.self] = newValue } }
    var awcAccordionItemAppearanceTargets: [String:AWCAccordionItemAppearance] { get { self[AWCAccordionItemAppearanceTargetsKey.self] } set { self[AWCAccordionItemAppearanceTargetsKey.self] = newValue } }
}
private struct AWCAccordionItemAppearanceModifier: ViewModifier {
    let value: AWCAccordionItemAppearance, id: String?
    @Environment(\.awcAccordionItemAppearance) private var inherited
    @Environment(\.awcAccordionItemAppearanceTargets) private var targets
    @ViewBuilder func body(content: Content) -> some View {
        if let id {
            let updated = targets.merging([id:(targets[id] ?? .init()).merging(value)]) { _,local in local }
            content.environment(\.awcAccordionItemAppearanceTargets, updated)
        } else { content.environment(\.awcAccordionItemAppearance, inherited.merging(value)) }
    }
}
public extension View {
    func awcAccordionItemAppearance(_ value: AWCAccordionItemAppearance, for id: String? = nil) -> some View { modifier(AWCAccordionItemAppearanceModifier(value:value,id:id)) }
}
