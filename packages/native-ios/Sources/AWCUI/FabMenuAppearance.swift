import SwiftUI

private func awcFabMenuColor(_ value:String?)->String? {
    guard let value,value.range(of:"^#[0-9a-fA-F]{6}$",options:.regularExpression) != nil else{return nil}
    return value.uppercased()
}
private func awcFabMenuLength(_ value:Double?)->Double? {
    guard let value,value.isFinite,(0...2400).contains(value) else{return nil};return value
}
private func awcFabMenuNumber(_ values:[String:AWCValue],_ name:String)->Double? {
    guard case .number(let number)=values[name] else{return nil};return number
}
public struct AWCFabMenuAppearance:Equatable,Sendable {
    public let itemContainerColor:String?
    public let itemLabelColor:String?
    public let itemGap:Double?
    public init(itemContainerColor:String?=nil,itemLabelColor:String?=nil,itemGap:Double?=nil) {
        self.itemContainerColor=awcFabMenuColor(itemContainerColor);self.itemLabelColor=awcFabMenuColor(itemLabelColor);self.itemGap=awcFabMenuLength(itemGap)
    }
    public init(values:[String:AWCValue]) {self.init(itemContainerColor:values["itemContainerColor"]?.string,itemLabelColor:values["itemLabelColor"]?.string,itemGap:awcFabMenuNumber(values,"itemGap"))}
    public func merging(_ local:Self)->Self {.init(itemContainerColor:local.itemContainerColor ?? itemContainerColor,itemLabelColor:local.itemLabelColor ?? itemLabelColor,itemGap:local.itemGap ?? itemGap)}
}
public struct AWCFabMenuItemAppearance:Equatable,Sendable {
    public let containerColor:String?
    public let labelColor:String?
    public let iconColor:String?
    public let iconSize:Double?
    public let cornerRadius:Double?
    public init(containerColor:String?=nil,labelColor:String?=nil,iconColor:String?=nil,iconSize:Double?=nil,cornerRadius:Double?=nil) {
        self.containerColor=awcFabMenuColor(containerColor);self.labelColor=awcFabMenuColor(labelColor);self.iconColor=awcFabMenuColor(iconColor)
        self.iconSize=awcFabMenuLength(iconSize);self.cornerRadius=awcFabMenuLength(cornerRadius)
    }
    public init(values:[String:AWCValue]) {self.init(containerColor:values["containerColor"]?.string,labelColor:values["labelColor"]?.string,iconColor:values["iconColor"]?.string,iconSize:awcFabMenuNumber(values,"iconSize"),cornerRadius:awcFabMenuNumber(values,"cornerRadius"))}
    public func merging(_ local:Self)->Self {.init(containerColor:local.containerColor ?? containerColor,labelColor:local.labelColor ?? labelColor,iconColor:local.iconColor ?? iconColor,iconSize:local.iconSize ?? iconSize,cornerRadius:local.cornerRadius ?? cornerRadius)}
}
private struct AWCFabMenuAppearanceKey:EnvironmentKey {static let defaultValue=AWCFabMenuAppearance()}
private struct AWCFabMenuItemAppearanceKey:EnvironmentKey {static let defaultValue=AWCFabMenuItemAppearance()}
private struct AWCFabMenuControllerKey:EnvironmentKey {static let defaultValue:AWCFabMenuController?=nil}
private struct AWCFabMenuItemOverridesKey:EnvironmentKey {static let defaultValue:[String:AWCFabMenuItemAppearance]=[:]}
public extension EnvironmentValues {
    var awcFabMenuAppearance:AWCFabMenuAppearance {get{self[AWCFabMenuAppearanceKey.self]} set{self[AWCFabMenuAppearanceKey.self]=newValue}}
    var awcFabMenuItemAppearance:AWCFabMenuItemAppearance {get{self[AWCFabMenuItemAppearanceKey.self]} set{self[AWCFabMenuItemAppearanceKey.self]=newValue}}
    var awcFabMenuController:AWCFabMenuController? {get{self[AWCFabMenuControllerKey.self]} set{self[AWCFabMenuControllerKey.self]=newValue}}
}
extension EnvironmentValues {
    var awcFabMenuItemOverrides:[String:AWCFabMenuItemAppearance] {get{self[AWCFabMenuItemOverridesKey.self]} set{self[AWCFabMenuItemOverridesKey.self]=newValue}}
}
private struct AWCFabMenuAppearanceModifier:ViewModifier {
    @Environment(\.awcFabMenuAppearance) private var inherited
    let appearance:AWCFabMenuAppearance
    func body(content:Content)->some View {content.environment(\.awcFabMenuAppearance,inherited.merging(appearance))}
}
private struct AWCFabMenuItemAppearanceModifier:ViewModifier {
    @Environment(\.awcFabMenuItemAppearance) private var inherited
    @Environment(\.awcFabMenuItemOverrides) private var overrides
    let appearance:AWCFabMenuItemAppearance
    let nodeID:String?
    @ViewBuilder func body(content:Content)->some View {
        if let nodeID {
            content.environment(\.awcFabMenuItemOverrides,overrides.merging([nodeID:(overrides[nodeID] ?? .init()).merging(appearance)]){_,new in new})
        } else {content.environment(\.awcFabMenuItemAppearance,inherited.merging(appearance))}
    }
}
public extension View {
    func awcFabMenuAppearance(_ appearance:AWCFabMenuAppearance)->some View {modifier(AWCFabMenuAppearanceModifier(appearance:appearance))}
    func awcFabMenuItemAppearance(_ appearance:AWCFabMenuItemAppearance,nodeID:String?=nil)->some View {modifier(AWCFabMenuItemAppearanceModifier(appearance:appearance,nodeID:nodeID))}
    func awcFabMenuController(_ controller:AWCFabMenuController)->some View {environment(\.awcFabMenuController,controller)}
}
