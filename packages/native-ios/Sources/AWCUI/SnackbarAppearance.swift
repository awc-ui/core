import SwiftUI

/// Native affine equivalent of the source snackbar's CSS width constraints.
public typealias AWCSnackbarLength = AWCSkeletonLength
public typealias AWCSnackbarSizingContext = AWCSkeletonSizingContext
public struct AWCSnackbarAppearance:Equatable,Sendable {
    public let containerColor:String?,messageColor:String?,actionColor:String?,closeColor:String?
    public let containerShape:AWCCornerShape?,minWidth:AWCSnackbarLength?,maxWidth:AWCSnackbarLength?
    public init(containerColor:String?=nil,messageColor:String?=nil,actionColor:String?=nil,closeColor:String?=nil,containerShape:AWCCornerShape?=nil,minWidth:AWCSnackbarLength?=nil,maxWidth:AWCSnackbarLength?=nil){
        func color(_ value:String?)->String?{value.flatMap{$0.range(of:"^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$",options:.regularExpression) != nil ? $0.uppercased():nil}}
        self.containerColor=color(containerColor);self.messageColor=color(messageColor);self.actionColor=color(actionColor);self.closeColor=color(closeColor)
        self.containerShape=containerShape.flatMap{$0.valid ? $0:nil};self.minWidth=minWidth.flatMap{$0.valid ? $0:nil};self.maxWidth=maxWidth.flatMap{$0.valid ? $0:nil}
    }
    public init(values:[String:AWCValue]){
        func text(_ key:String)->String?{guard case .string(let text)=values[key] else{return nil};return text}
        func length(_ key:String)->AWCSnackbarLength?{guard case .object(let value)=values[key] else{return nil};return .init(values:value)}
        let shape:AWCCornerShape?;if case .object(let value)=values["containerShape"]{shape = .init(values:value)}else{shape=nil}
        self.init(containerColor:text("containerColor"),messageColor:text("messageColor"),actionColor:text("actionColor"),closeColor:text("closeColor"),containerShape:shape,minWidth:length("minWidth"),maxWidth:length("maxWidth"))
    }
    public func merging(_ value:Self)->Self{.init(containerColor:value.containerColor ?? containerColor,messageColor:value.messageColor ?? messageColor,actionColor:value.actionColor ?? actionColor,closeColor:value.closeColor ?? closeColor,containerShape:value.containerShape ?? containerShape,minWidth:value.minWidth ?? minWidth,maxWidth:value.maxWidth ?? maxWidth)}
}
public enum AWCSnackbarSlot:Sendable{case message,action,close}
private struct AWCSnackbarAppearanceKey:EnvironmentKey{static let defaultValue=AWCSnackbarAppearance()}
private struct AWCSnackbarContextKey:EnvironmentKey{static let defaultValue=AWCSnackbarSizingContext()}
private struct AWCSnackbarLabelsKey:EnvironmentKey{static let defaultValue:[AWCSnackbarSlot:String]=[:]}
private struct AWCSnackbarSlotsKey:EnvironmentKey{static let defaultValue:[AWCSnackbarSlot:AnyView]=[:]}
private struct AWCSnackbarForcedColorsKey:EnvironmentKey{static let defaultValue=false}
public extension EnvironmentValues {
    var awcSnackbarAppearance:AWCSnackbarAppearance{get{self[AWCSnackbarAppearanceKey.self]}set{self[AWCSnackbarAppearanceKey.self]=newValue}}
    var awcSnackbarSizingContext:AWCSnackbarSizingContext{get{self[AWCSnackbarContextKey.self]}set{self[AWCSnackbarContextKey.self]=newValue}}
    var awcSnackbarForcedColors:Bool{get{self[AWCSnackbarForcedColorsKey.self]}set{self[AWCSnackbarForcedColorsKey.self]=newValue}}
}
extension EnvironmentValues{
    var awcSnackbarSlotLabels:[AWCSnackbarSlot:String]{get{self[AWCSnackbarLabelsKey.self]}set{self[AWCSnackbarLabelsKey.self]=newValue}}
    var awcSnackbarSlots:[AWCSnackbarSlot:AnyView]{get{self[AWCSnackbarSlotsKey.self]}set{self[AWCSnackbarSlotsKey.self]=newValue}}}
private struct AWCSnackbarAppearanceModifier:ViewModifier {
    let value:AWCSnackbarAppearance
    @Environment(\.awcSnackbarAppearance) private var inherited
    func body(content:Content)->some View{content.environment(\.awcSnackbarAppearance,inherited.merging(value))}
}
private struct AWCSnackbarSlotModifier:ViewModifier {
    let slot:AWCSnackbarSlot,value:AnyView,label:String?
    @Environment(\.awcSnackbarSlots) private var inherited
    @Environment(\.awcSnackbarSlotLabels) private var labels
    func body(content:Content)->some View{var merged=inherited;merged[slot]=value;var text=labels;text[slot]=label;return content.environment(\.awcSnackbarSlots,merged).environment(\.awcSnackbarSlotLabels,text)}
}
public extension View {
    func awcSnackbarAppearance(_ value:AWCSnackbarAppearance)->some View{modifier(AWCSnackbarAppearanceModifier(value:value))}
    func awcSnackbarSizingContext(_ value:AWCSnackbarSizingContext)->some View{environment(\.awcSnackbarSizingContext,value)}
    func awcSnackbarForcedColors(_ enabled:Bool)->some View{environment(\.awcSnackbarForcedColors,enabled)}
    func awcSnackbarSlot<Slot:View>(_ slot:AWCSnackbarSlot,accessibilityLabel:String?=nil,@ViewBuilder content:()->Slot)->some View{modifier(AWCSnackbarSlotModifier(slot:slot,value:AnyView(content()),label:accessibilityLabel))}
}

/// Native styling for the source component's exported surfaces. Values merge
/// sparsely so a local color override retains an inherited border or padding.
public enum AWCSnackbarPart:Sendable,Hashable {case surface,message,actions,close,closeIcon}
public struct AWCSnackbarPartAppearance:Equatable,Sendable {
    public let color:String?,backgroundColor:String?,borderColor:String?
    public let borderWidth:Double?,cornerShape:AWCCornerShape?,fontWeight:Double?,paddingInlineStart:Double?,marginInlineStart:Double?
    public init(color:String?=nil,backgroundColor:String?=nil,borderColor:String?=nil,borderWidth:Double?=nil,cornerShape:AWCCornerShape?=nil,fontWeight:Double?=nil,paddingInlineStart:Double?=nil,marginInlineStart:Double?=nil){
        func rgba(_ value:String?)->String?{value.flatMap{$0.range(of:"^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$",options:.regularExpression) != nil ? $0.uppercased():nil}}
        func nonnegative(_ value:Double?)->Double?{value.flatMap{$0.isFinite && $0>=0 ? $0:nil}}
        self.color=rgba(color);self.backgroundColor=rgba(backgroundColor);self.borderColor=rgba(borderColor)
        self.borderWidth=nonnegative(borderWidth);self.cornerShape=cornerShape.flatMap{$0.valid ? $0:nil}
        self.fontWeight=fontWeight.flatMap{$0.isFinite && $0>=1 && $0<=1000 ? $0:nil}
        self.paddingInlineStart=nonnegative(paddingInlineStart);self.marginInlineStart=marginInlineStart.flatMap{$0.isFinite ? $0:nil}
    }
    public func merging(_ v:Self)->Self{.init(color:v.color ?? color,backgroundColor:v.backgroundColor ?? backgroundColor,borderColor:v.borderColor ?? borderColor,borderWidth:v.borderWidth ?? borderWidth,cornerShape:v.cornerShape ?? cornerShape,fontWeight:v.fontWeight ?? fontWeight,paddingInlineStart:v.paddingInlineStart ?? paddingInlineStart,marginInlineStart:v.marginInlineStart ?? marginInlineStart)}
}
private struct AWCSnackbarPartsKey:EnvironmentKey{static let defaultValue:[AWCSnackbarPart:AWCSnackbarPartAppearance]=[:]}
extension EnvironmentValues{var awcSnackbarParts:[AWCSnackbarPart:AWCSnackbarPartAppearance]{get{self[AWCSnackbarPartsKey.self]}set{self[AWCSnackbarPartsKey.self]=newValue}}}
private struct AWCSnackbarPartModifier:ViewModifier {
    let part:AWCSnackbarPart,value:AWCSnackbarPartAppearance
    @Environment(\.awcSnackbarParts) private var inherited
    func body(content:Content)->some View{var values=inherited;values[part]=(values[part] ?? .init()).merging(value);return content.environment(\.awcSnackbarParts,values)}
}
public extension View {
    func awcSnackbarPartAppearance(_ value:AWCSnackbarPartAppearance,part:AWCSnackbarPart)->some View{modifier(AWCSnackbarPartModifier(part:part,value:value))}
}
struct AWCNativeSnackbarPartDecoration:ViewModifier {
    let value:AWCSnackbarPartAppearance
    func body(content:Content)->some View{
        let shape=AWCNativeCornerShape(corners:value.cornerShape ?? .points(0)),border=value.borderWidth ?? 0
        content.padding(.leading,value.paddingInlineStart ?? 0).padding(border)
            .background{if let color=value.backgroundColor{shape.fill(Color(awcHex:color))}}
            .overlay{if border>0{shape.strokeBorder(Color(awcHex:value.borderColor ?? value.color ?? "#000000"),lineWidth:border)}}
    }
}
