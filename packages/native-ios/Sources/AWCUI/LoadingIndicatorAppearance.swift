import SwiftUI

private func awcLoadingColor(_ value:String?)->String?{value.flatMap{$0.range(of:"^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$",options:.regularExpression) == nil ? nil:$0.uppercased()}}
private func awcLoadingLength(_ value:Double?)->Double?{value.flatMap{$0.isFinite && $0>=0 ? $0:nil}}
/// Five source hooks; containerShape retains physical, elliptical and percentage radii.
public struct AWCLoadingIndicatorAppearance:Equatable,Sendable {
    public let color:String?,size:Double?,shapeSize:Double?,containerColor:String?,containerShape:AWCCornerShape?
    public init(color:String?=nil,size:Double?=nil,shapeSize:Double?=nil,containerColor:String?=nil,containerShape:AWCCornerShape?=nil){
        self.color=awcLoadingColor(color);self.size=awcLoadingLength(size);self.shapeSize=awcLoadingLength(shapeSize);self.containerColor=awcLoadingColor(containerColor);self.containerShape=containerShape.flatMap{$0.valid ? $0:nil}
    }
    public init(values:[String:AWCValue]){
        func number(_ key:String)->Double?{guard case .number(let n)=values[key] else{return nil};return n}
        let corners:AWCCornerShape?;if case .object(let value)=values["containerShape"]{corners=AWCCornerShape(values:value)}else{corners=nil}
        self.init(color:values["color"]?.string,size:number("size"),shapeSize:number("shapeSize"),containerColor:values["containerColor"]?.string,containerShape:corners)
    }
    public func merging(_ value:Self)->Self{.init(color:value.color ?? color,size:value.size ?? size,shapeSize:value.shapeSize ?? shapeSize,containerColor:value.containerColor ?? containerColor,containerShape:value.containerShape ?? containerShape)}
}
/// Overrides the exposed shape part independently from the symmetric shapeSize hook.
public struct AWCLoadingIndicatorShapeAppearance:Equatable,Sendable {
    public let width:Double?,height:Double?,color:String?
    public init(width:Double?=nil,height:Double?=nil,color:String?=nil){self.width=awcLoadingLength(width);self.height=awcLoadingLength(height);self.color=awcLoadingColor(color)}
    public func merging(_ value:Self)->Self{.init(width:value.width ?? width,height:value.height ?? height,color:value.color ?? color)}
}
private struct AWCLoadingAppearanceKey:EnvironmentKey{static let defaultValue=AWCLoadingIndicatorAppearance()}
private struct AWCLoadingShapeAppearanceKey:EnvironmentKey{static let defaultValue=AWCLoadingIndicatorShapeAppearance()}
public extension EnvironmentValues{
    var awcLoadingIndicatorAppearance:AWCLoadingIndicatorAppearance{get{self[AWCLoadingAppearanceKey.self]}set{self[AWCLoadingAppearanceKey.self]=newValue}}
    var awcLoadingIndicatorShapeAppearance:AWCLoadingIndicatorShapeAppearance{get{self[AWCLoadingShapeAppearanceKey.self]}set{self[AWCLoadingShapeAppearanceKey.self]=newValue}}
}
private struct AWCLoadingAppearanceModifier:ViewModifier{
    let appearance:AWCLoadingIndicatorAppearance
    @Environment(\.awcLoadingIndicatorAppearance) private var inherited
    func body(content:Content)->some View{content.environment(\.awcLoadingIndicatorAppearance,inherited.merging(appearance))}
}
private struct AWCLoadingShapeAppearanceModifier:ViewModifier{
    let appearance:AWCLoadingIndicatorShapeAppearance
    @Environment(\.awcLoadingIndicatorShapeAppearance) private var inherited
    func body(content:Content)->some View{content.environment(\.awcLoadingIndicatorShapeAppearance,inherited.merging(appearance))}
}
public extension View{
    func awcLoadingIndicatorAppearance(_ appearance:AWCLoadingIndicatorAppearance)->some View{modifier(AWCLoadingAppearanceModifier(appearance:appearance))}
    func awcLoadingIndicatorShapeAppearance(_ appearance:AWCLoadingIndicatorShapeAppearance)->some View{modifier(AWCLoadingShapeAppearanceModifier(appearance:appearance))}
}
