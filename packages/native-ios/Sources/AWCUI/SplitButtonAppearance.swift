import SwiftUI

/// The six public md-split-button appearance hooks. Lengths are native points.
public struct AWCSplitButtonAppearance: Equatable, Sendable {
    public let containerColor: String?, labelColor: String?, iconColor: String?, outlineColor: String?
    public let cornerRadius: Double?, iconSize: Double?
    public init(containerColor:String?=nil,labelColor:String?=nil,iconColor:String?=nil,outlineColor:String?=nil,cornerRadius:Double?=nil,iconSize:Double?=nil) {
        func color(_ value:String?)->String? {guard let value,value.range(of:"^#[0-9a-fA-F]{6}$",options:.regularExpression) != nil else{return nil};return value.uppercased()}
        func length(_ value:Double?)->Double? {guard let value,value.isFinite,(0...2400).contains(value) else{return nil};return value}
        self.containerColor=color(containerColor);self.labelColor=color(labelColor);self.iconColor=color(iconColor);self.outlineColor=color(outlineColor)
        self.cornerRadius=length(cornerRadius);self.iconSize=length(iconSize)
    }
    public init(values:[String:AWCValue]) {
        func number(_ key:String)->Double? {guard case .number(let value)=values[key] else{return nil};return value}
        self.init(containerColor:values["containerColor"]?.string,labelColor:values["labelColor"]?.string,iconColor:values["iconColor"]?.string,outlineColor:values["outlineColor"]?.string,cornerRadius:number("cornerRadius"),iconSize:number("iconSize"))
    }
    public func merging(_ value:Self)->Self {.init(containerColor:value.containerColor ?? containerColor,labelColor:value.labelColor ?? labelColor,iconColor:value.iconColor ?? iconColor,outlineColor:value.outlineColor ?? outlineColor,cornerRadius:value.cornerRadius ?? cornerRadius,iconSize:value.iconSize ?? iconSize)}
}
private struct AWCSplitButtonAppearanceKey:EnvironmentKey {static let defaultValue=AWCSplitButtonAppearance()}
public extension EnvironmentValues {var awcSplitButtonAppearance:AWCSplitButtonAppearance {get{self[AWCSplitButtonAppearanceKey.self]} set{self[AWCSplitButtonAppearanceKey.self]=newValue}}}
private struct AWCSplitButtonAppearanceModifier:ViewModifier {
    @Environment(\.awcSplitButtonAppearance) private var inherited
    let appearance:AWCSplitButtonAppearance
    func body(content:Content)->some View {content.environment(\.awcSplitButtonAppearance,inherited.merging(appearance))}
}
private struct AWCSplitButtonCheckedPreference:PreferenceKey {
    static var defaultValue:[String:Bool]=[:]
    static func reduce(value:inout [String:Bool],nextValue:()->[String:Bool]){value.merge(nextValue()){_,new in new}}
}
public extension View {
    func awcSplitButtonAppearance(_ appearance:AWCSplitButtonAppearance)->some View {modifier(AWCSplitButtonAppearanceModifier(appearance:appearance))}
    /// Observes committed renderer state; the source event payload stays unchanged.
    func awcSplitButtonChecked(rootID:String,onChange:@escaping(Bool)->Void)->some View {onPreferenceChange(AWCSplitButtonCheckedPreference.self){if let value=$0[rootID]{onChange(value)}}}
}
extension View {func awcReportSplitButtonChecked(id:String,value:Bool)->some View {preference(key:AWCSplitButtonCheckedPreference.self,value:[id:value])}}
