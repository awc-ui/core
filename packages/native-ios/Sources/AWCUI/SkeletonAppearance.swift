import SwiftUI

public struct AWCSkeletonAppearance:Equatable,Sendable {
    public let color:String?,highlight:String?,radius:AWCCornerShape?,roundedRadius:AWCCornerShape?
    public let width:AWCSkeletonLength?,height:AWCSkeletonLength?,size:AWCSkeletonLength?,lineGap:AWCSkeletonLength?
    public let pulseDuration:Double?,waveDuration:Double?,bloomDuration:Double?
    public init(color:String?=nil,highlight:String?=nil,radius:AWCCornerShape?=nil,roundedRadius:AWCCornerShape?=nil,width:AWCSkeletonLength?=nil,height:AWCSkeletonLength?=nil,size:AWCSkeletonLength?=nil,lineGap:AWCSkeletonLength?=nil,pulseDuration:Double?=nil,waveDuration:Double?=nil,bloomDuration:Double?=nil){
        func c(_ v:String?)->String?{v.flatMap{$0.range(of:"^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$",options:.regularExpression) != nil ? $0.uppercased():nil}}
        func s(_ v:AWCCornerShape?)->AWCCornerShape?{v.flatMap{$0.valid ? $0:nil}}
        func l(_ v:AWCSkeletonLength?)->AWCSkeletonLength?{v.flatMap{$0.valid ? $0:nil}}
        func t(_ v:Double?)->Double?{v.flatMap{$0.isFinite && $0>=0 ? $0:nil}}
        self.color=c(color);self.highlight=c(highlight);self.radius=s(radius);self.roundedRadius=s(roundedRadius)
        self.width=l(width);self.height=l(height);self.size=l(size);self.lineGap=l(lineGap)
        self.pulseDuration=t(pulseDuration);self.waveDuration=t(waveDuration);self.bloomDuration=t(bloomDuration)
    }
    public init(values:[String:AWCValue]){
        func l(_ key:String)->AWCSkeletonLength?{guard case .object(let v)=values[key] else{return nil};return .init(values:v)}
        func s(_ key:String)->AWCCornerShape?{guard case .object(let v)=values[key] else{return nil};return .init(values:v)}
        func t(_ key:String)->Double?{guard case .number(let v)=values[key] else{return nil};return v}
        self.init(color:values["color"]?.string,highlight:values["highlight"]?.string,radius:s("radius"),roundedRadius:s("roundedRadius"),width:l("width"),height:l("height"),size:l("size"),lineGap:l("lineGap"),pulseDuration:t("pulseDuration"),waveDuration:t("waveDuration"),bloomDuration:t("bloomDuration"))
    }
    public func merging(_ local:Self)->Self{.init(color:local.color ?? color,highlight:local.highlight ?? highlight,radius:local.radius ?? radius,roundedRadius:local.roundedRadius ?? roundedRadius,width:local.width ?? width,height:local.height ?? height,size:local.size ?? size,lineGap:local.lineGap ?? lineGap,pulseDuration:local.pulseDuration ?? pulseDuration,waveDuration:local.waveDuration ?? waveDuration,bloomDuration:local.bloomDuration ?? bloomDuration)}
}
public enum AWCSkeletonPart:String,Sendable{case shape,line,lineLast}
public struct AWCSkeletonPartAppearance:Equatable,Sendable {
    public let color:String?,width:AWCSkeletonLength?,height:AWCSkeletonLength?,cornerShape:AWCCornerShape?
    public init(color:String?=nil,width:AWCSkeletonLength?=nil,height:AWCSkeletonLength?=nil,cornerShape:AWCCornerShape?=nil){
        let validated=AWCSkeletonAppearance(color:color,radius:cornerShape,width:width,height:height)
        self.color=validated.color;self.width=validated.width;self.height=validated.height;self.cornerShape=validated.radius
    }
    public func merging(_ local:Self)->Self{.init(color:local.color ?? color,width:local.width ?? width,height:local.height ?? height,cornerShape:local.cornerShape ?? cornerShape)}
}
private struct AWCSkeletonAppearanceKey:EnvironmentKey{static let defaultValue=AWCSkeletonAppearance()}
private struct AWCSkeletonPartsKey:EnvironmentKey{static let defaultValue:[AWCSkeletonPart:AWCSkeletonPartAppearance]=[:]}
private struct AWCSkeletonForcedColorsKey:EnvironmentKey{static let defaultValue=false}
public extension EnvironmentValues{
    var awcSkeletonAppearance:AWCSkeletonAppearance{get{self[AWCSkeletonAppearanceKey.self]}set{self[AWCSkeletonAppearanceKey.self]=newValue}}
    var awcSkeletonForcedColors:Bool{get{self[AWCSkeletonForcedColorsKey.self]}set{self[AWCSkeletonForcedColorsKey.self]=newValue}}
}
extension EnvironmentValues{var awcSkeletonParts:[AWCSkeletonPart:AWCSkeletonPartAppearance]{get{self[AWCSkeletonPartsKey.self]}set{self[AWCSkeletonPartsKey.self]=newValue}}}
private struct AWCSkeletonAppearanceModifier:ViewModifier {
    let value:AWCSkeletonAppearance
    @Environment(\.awcSkeletonAppearance) private var inherited
    func body(content:Content)->some View{content.environment(\.awcSkeletonAppearance,inherited.merging(value))}
}
private struct AWCSkeletonPartModifier:ViewModifier{
    let value:AWCSkeletonPartAppearance,part:AWCSkeletonPart
    @Environment(\.awcSkeletonParts) private var inherited
    func body(content:Content)->some View{
        var merged=inherited;merged[part]=(merged[part] ?? .init()).merging(value)
        return content.environment(\.awcSkeletonParts,merged)
    }
}
public extension View {
    func awcSkeletonAppearance(_ value:AWCSkeletonAppearance)->some View{modifier(AWCSkeletonAppearanceModifier(value:value))}
    func awcSkeletonPartAppearance(_ value:AWCSkeletonPartAppearance,part:AWCSkeletonPart)->some View{modifier(AWCSkeletonPartModifier(value:value,part:part))}
    func awcSkeletonForcedColors(_ enabled:Bool)->some View{environment(\.awcSkeletonForcedColors,enabled)}
}
