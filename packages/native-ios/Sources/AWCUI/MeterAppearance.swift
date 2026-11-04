import SwiftUI

private func awcMeterColor(_ value:String?)->String?{value.flatMap{$0.range(of:"^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$",options:.regularExpression) == nil ? nil:$0.uppercased()}}
private func awcMeterLength(_ value:Double?)->Double?{value.flatMap{$0.isFinite && $0>=0 ? $0:nil}}
/// The seven public meter hooks. Physical corner lengths share LoadingIndicator's
/// percentage/elliptical corner representation and CSS overlap normalization.
public struct AWCMeterAppearance:Equatable,Sendable {
    public let indicatorColor:String?,trackColor:String?,trackShape:AWCCornerShape?,height:Double?,labelColor:String?,valueColor:String?,size:Double?
    public init(indicatorColor:String?=nil,trackColor:String?=nil,trackShape:AWCCornerShape?=nil,height:Double?=nil,labelColor:String?=nil,valueColor:String?=nil,size:Double?=nil){
        self.indicatorColor=awcMeterColor(indicatorColor);self.trackColor=awcMeterColor(trackColor);self.trackShape=trackShape.flatMap{$0.valid ? $0:nil};self.height=awcMeterLength(height);self.labelColor=awcMeterColor(labelColor);self.valueColor=awcMeterColor(valueColor);self.size=awcMeterLength(size)
    }
    public init(values:[String:AWCValue]){
        func number(_ key:String)->Double?{guard case .number(let n)=values[key] else{return nil};return n}
        let shape:AWCCornerShape?;if case .object(let value)=values["trackShape"]{shape=AWCCornerShape(values:value)}else{shape=nil}
        self.init(indicatorColor:values["indicatorColor"]?.string,trackColor:values["trackColor"]?.string,trackShape:shape,height:number("height"),labelColor:values["labelColor"]?.string,valueColor:values["valueColor"]?.string,size:number("size"))
    }
    public func merging(_ local:Self)->Self{.init(indicatorColor:local.indicatorColor ?? indicatorColor,trackColor:local.trackColor ?? trackColor,trackShape:local.trackShape ?? trackShape,height:local.height ?? height,labelColor:local.labelColor ?? labelColor,valueColor:local.valueColor ?? valueColor,size:local.size ?? size)}
}
private struct AWCMeterAppearanceKey:EnvironmentKey{static let defaultValue=AWCMeterAppearance()}
public extension EnvironmentValues{var awcMeterAppearance:AWCMeterAppearance{get{self[AWCMeterAppearanceKey.self]}set{self[AWCMeterAppearanceKey.self]=newValue}}}
private struct AWCMeterAppearanceModifier:ViewModifier{
    let value:AWCMeterAppearance
    @Environment(\.awcMeterAppearance) private var inherited
    func body(content:Content)->some View{content.environment(\.awcMeterAppearance,inherited.merging(value))}
}
public extension View{func awcMeterAppearance(_ value:AWCMeterAppearance)->some View{modifier(AWCMeterAppearanceModifier(value:value))}}
