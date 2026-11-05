import SwiftUI

/// The thirteen source ProgressIndicator hooks. Shape hooks affect the linear
/// boxes; circular SVG strokes retain their source round caps.
public struct AWCProgressIndicatorAppearance:Equatable,Sendable {
    public let activeIndicatorColor:String?,activeIndicatorShape:AWCCornerShape?
    public let trackColor:String?,trackShape:AWCCornerShape?
    public let stopIndicatorColor:String?,stopIndicatorShape:AWCCornerShape?
    public let stopIndicatorSize:Double?,stopIndicatorTrailingSpace:Double?,trackActiveIndicatorSpace:Double?
    public let fourColor1:String?,fourColor2:String?,fourColor3:String?,fourColor4:String?
    public init(activeIndicatorColor:String?=nil,activeIndicatorShape:AWCCornerShape?=nil,trackColor:String?=nil,trackShape:AWCCornerShape?=nil,stopIndicatorColor:String?=nil,stopIndicatorShape:AWCCornerShape?=nil,stopIndicatorSize:Double?=nil,stopIndicatorTrailingSpace:Double?=nil,trackActiveIndicatorSpace:Double?=nil,fourColor1:String?=nil,fourColor2:String?=nil,fourColor3:String?=nil,fourColor4:String?=nil){
        func color(_ value:String?)->String?{value.flatMap{$0.range(of:"^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$",options:.regularExpression) == nil ? nil:$0.uppercased()}}
        func shape(_ value:AWCCornerShape?)->AWCCornerShape?{value.flatMap{$0.valid ? $0:nil}}
        func length(_ value:Double?,signed:Bool=false)->Double?{value.flatMap{$0.isFinite && (signed || $0>=0) ? $0:nil}}
        self.activeIndicatorColor=color(activeIndicatorColor);self.activeIndicatorShape=shape(activeIndicatorShape)
        self.trackColor=color(trackColor);self.trackShape=shape(trackShape)
        self.stopIndicatorColor=color(stopIndicatorColor);self.stopIndicatorShape=shape(stopIndicatorShape)
        self.stopIndicatorSize=length(stopIndicatorSize);self.stopIndicatorTrailingSpace=length(stopIndicatorTrailingSpace,signed:true);self.trackActiveIndicatorSpace=length(trackActiveIndicatorSpace,signed:true)
        self.fourColor1=color(fourColor1);self.fourColor2=color(fourColor2);self.fourColor3=color(fourColor3);self.fourColor4=color(fourColor4)
    }
    public init(values:[String:AWCValue]){
        func number(_ key:String)->Double?{guard case .number(let value)=values[key] else{return nil};return value}
        func shape(_ key:String)->AWCCornerShape?{guard case .object(let value)=values[key] else{return nil};return .init(values:value)}
        self.init(activeIndicatorColor:values["activeIndicatorColor"]?.string,activeIndicatorShape:shape("activeIndicatorShape"),trackColor:values["trackColor"]?.string,trackShape:shape("trackShape"),stopIndicatorColor:values["stopIndicatorColor"]?.string,stopIndicatorShape:shape("stopIndicatorShape"),stopIndicatorSize:number("stopIndicatorSize"),stopIndicatorTrailingSpace:number("stopIndicatorTrailingSpace"),trackActiveIndicatorSpace:number("trackActiveIndicatorSpace"),fourColor1:values["fourColor1"]?.string,fourColor2:values["fourColor2"]?.string,fourColor3:values["fourColor3"]?.string,fourColor4:values["fourColor4"]?.string)
    }
    public func merging(_ local:Self)->Self{.init(activeIndicatorColor:local.activeIndicatorColor ?? activeIndicatorColor,activeIndicatorShape:local.activeIndicatorShape ?? activeIndicatorShape,trackColor:local.trackColor ?? trackColor,trackShape:local.trackShape ?? trackShape,stopIndicatorColor:local.stopIndicatorColor ?? stopIndicatorColor,stopIndicatorShape:local.stopIndicatorShape ?? stopIndicatorShape,stopIndicatorSize:local.stopIndicatorSize ?? stopIndicatorSize,stopIndicatorTrailingSpace:local.stopIndicatorTrailingSpace ?? stopIndicatorTrailingSpace,trackActiveIndicatorSpace:local.trackActiveIndicatorSpace ?? trackActiveIndicatorSpace,fourColor1:local.fourColor1 ?? fourColor1,fourColor2:local.fourColor2 ?? fourColor2,fourColor3:local.fourColor3 ?? fourColor3,fourColor4:local.fourColor4 ?? fourColor4)}
}
private struct AWCProgressIndicatorAppearanceKey:EnvironmentKey{static let defaultValue=AWCProgressIndicatorAppearance()}
public extension EnvironmentValues{var awcProgressIndicatorAppearance:AWCProgressIndicatorAppearance{get{self[AWCProgressIndicatorAppearanceKey.self]}set{self[AWCProgressIndicatorAppearanceKey.self]=newValue}}}
private struct AWCProgressIndicatorAppearanceModifier:ViewModifier{
    let value:AWCProgressIndicatorAppearance
    @Environment(\.awcProgressIndicatorAppearance) private var inherited
    func body(content:Content)->some View{content.environment(\.awcProgressIndicatorAppearance,inherited.merging(value))}
}
public extension View{func awcProgressIndicatorAppearance(_ value:AWCProgressIndicatorAppearance)->some View{modifier(AWCProgressIndicatorAppearanceModifier(value:value))}}
private struct AWCProgressForcedColorsKey:EnvironmentKey{static let defaultValue=false}
public extension EnvironmentValues {
    /// Explicit semantic palette equivalent to CSS forced colors. Native
    /// increased contrast alone does not replace the caller's authored colors.
    var awcProgressForcedColors:Bool {
        get{self[AWCProgressForcedColorsKey.self]}
        set{self[AWCProgressForcedColorsKey.self]=newValue}
    }
}
public extension View {
    func awcProgressForcedColors(_ enabled:Bool)->some View{environment(\.awcProgressForcedColors,enabled)}
}
