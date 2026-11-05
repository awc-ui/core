import SwiftUI

public typealias AWCTooltipLength = AWCSkeletonLength
public typealias AWCTooltipSizingContext = AWCSkeletonSizingContext
/// Sparse native equivalents of the eleven source appearance hooks.
public struct AWCTooltipAppearance:Equatable,Sendable {
    public let plainContainerColor:String?,plainTextColor:String?,richContainerColor:String?,richSubheadColor:String?,richTextColor:String?,richActionColor:String?
    public let plainShape:AWCCornerShape?,plainMaxWidth:AWCTooltipLength?,richShape:AWCCornerShape?,richMinWidth:AWCTooltipLength?,richMaxWidth:AWCTooltipLength?
    public init(plainContainerColor:String?=nil,plainTextColor:String?=nil,richContainerColor:String?=nil,richSubheadColor:String?=nil,richTextColor:String?=nil,richActionColor:String?=nil,plainShape:AWCCornerShape?=nil,plainMaxWidth:AWCTooltipLength?=nil,richShape:AWCCornerShape?=nil,richMinWidth:AWCTooltipLength?=nil,richMaxWidth:AWCTooltipLength?=nil){
        func color(_ v:String?)->String?{v.flatMap{$0.range(of:"^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$",options:.regularExpression) != nil ? $0.uppercased():nil}}
        self.plainContainerColor=color(plainContainerColor);self.plainTextColor=color(plainTextColor);self.richContainerColor=color(richContainerColor);self.richSubheadColor=color(richSubheadColor);self.richTextColor=color(richTextColor);self.richActionColor=color(richActionColor)
        self.plainShape=plainShape.flatMap{$0.valid ? $0:nil};self.richShape=richShape.flatMap{$0.valid ? $0:nil}
        self.plainMaxWidth=plainMaxWidth.flatMap{$0.valid ? $0:nil};self.richMinWidth=richMinWidth.flatMap{$0.valid ? $0:nil};self.richMaxWidth=richMaxWidth.flatMap{$0.valid ? $0:nil}
    }
    public init(values:[String:AWCValue]){
        func text(_ k:String)->String?{guard case .string(let v)=values[k] else{return nil};return v}
        func length(_ k:String)->AWCTooltipLength?{guard case .object(let v)=values[k] else{return nil};return .init(values:v)}
        func shape(_ k:String)->AWCCornerShape?{guard case .object(let v)=values[k] else{return nil};return .init(values:v)}
        self.init(plainContainerColor:text("plainContainerColor"),plainTextColor:text("plainTextColor"),richContainerColor:text("richContainerColor"),richSubheadColor:text("richSubheadColor"),richTextColor:text("richTextColor"),richActionColor:text("richActionColor"),plainShape:shape("plainShape"),plainMaxWidth:length("plainMaxWidth"),richShape:shape("richShape"),richMinWidth:length("richMinWidth"),richMaxWidth:length("richMaxWidth"))
    }
    public func merging(_ v:Self)->Self{.init(plainContainerColor:v.plainContainerColor ?? plainContainerColor,plainTextColor:v.plainTextColor ?? plainTextColor,richContainerColor:v.richContainerColor ?? richContainerColor,richSubheadColor:v.richSubheadColor ?? richSubheadColor,richTextColor:v.richTextColor ?? richTextColor,richActionColor:v.richActionColor ?? richActionColor,plainShape:v.plainShape ?? plainShape,plainMaxWidth:v.plainMaxWidth ?? plainMaxWidth,richShape:v.richShape ?? richShape,richMinWidth:v.richMinWidth ?? richMinWidth,richMaxWidth:v.richMaxWidth ?? richMaxWidth)}
}
public enum AWCTooltipSlot:Sendable,Hashable{case anchor,subhead,content,actions}
public enum AWCTooltipPart:Sendable,Hashable{case popup,text,subhead,supportingText,actions}
public struct AWCTooltipPartAppearance:Equatable,Sendable{
    public let color:String?,backgroundColor:String?,borderColor:String?
    public let borderWidth:Double?,cornerShape:AWCCornerShape?,fontWeight:Double?,paddingInlineStart:Double?,marginInlineStart:Double?,letterSpacing:Double?,fontSize:Double?,lineHeight:Double?
    public init(color:String?=nil,backgroundColor:String?=nil,borderColor:String?=nil,borderWidth:Double?=nil,cornerShape:AWCCornerShape?=nil,fontWeight:Double?=nil,paddingInlineStart:Double?=nil,marginInlineStart:Double?=nil,letterSpacing:Double?=nil,fontSize:Double?=nil,lineHeight:Double?=nil){
        let base=AWCSnackbarPartAppearance(color:color,backgroundColor:backgroundColor,borderColor:borderColor,borderWidth:borderWidth,cornerShape:cornerShape,fontWeight:fontWeight,paddingInlineStart:paddingInlineStart,marginInlineStart:marginInlineStart)
        self.color=base.color;self.backgroundColor=base.backgroundColor;self.borderColor=base.borderColor;self.borderWidth=base.borderWidth;self.cornerShape=base.cornerShape;self.fontWeight=base.fontWeight;self.paddingInlineStart=base.paddingInlineStart;self.marginInlineStart=base.marginInlineStart;self.letterSpacing=letterSpacing.flatMap{$0.isFinite ? $0:nil};self.fontSize=fontSize.flatMap{$0.isFinite && $0>0 ? $0:nil};self.lineHeight=lineHeight.flatMap{$0.isFinite && $0>0 ? $0:nil}
    }
    public func merging(_ v:Self)->Self{.init(color:v.color ?? color,backgroundColor:v.backgroundColor ?? backgroundColor,borderColor:v.borderColor ?? borderColor,borderWidth:v.borderWidth ?? borderWidth,cornerShape:v.cornerShape ?? cornerShape,fontWeight:v.fontWeight ?? fontWeight,paddingInlineStart:v.paddingInlineStart ?? paddingInlineStart,marginInlineStart:v.marginInlineStart ?? marginInlineStart,letterSpacing:v.letterSpacing ?? letterSpacing,fontSize:v.fontSize ?? fontSize,lineHeight:v.lineHeight ?? lineHeight)}
    var decoration:AWCSnackbarPartAppearance{.init(color:color,backgroundColor:backgroundColor,borderColor:borderColor,borderWidth:borderWidth,cornerShape:cornerShape,fontWeight:fontWeight,paddingInlineStart:paddingInlineStart,marginInlineStart:marginInlineStart)}
}
private struct AWCTooltipAppearanceKey:EnvironmentKey{static let defaultValue=AWCTooltipAppearance()}
private struct AWCTooltipContextKey:EnvironmentKey{static let defaultValue=AWCTooltipSizingContext()}
private struct AWCTooltipSlotsKey:EnvironmentKey{static let defaultValue:[AWCTooltipSlot:AnyView]=[:]}
private struct AWCTooltipTextsKey:EnvironmentKey{static let defaultValue:[AWCTooltipSlot:String]=[:]}
private struct AWCTooltipLabelsKey:EnvironmentKey{static let defaultValue:[AWCTooltipSlot:String]=[:]}
private struct AWCTooltipPartsKey:EnvironmentKey{static let defaultValue:[AWCTooltipPart:AWCTooltipPartAppearance]=[:]}
private struct AWCTooltipForcedColorsKey:EnvironmentKey{static let defaultValue=false}
public extension EnvironmentValues{
    var awcTooltipAppearance:AWCTooltipAppearance{get{self[AWCTooltipAppearanceKey.self]}set{self[AWCTooltipAppearanceKey.self]=newValue}}
    var awcTooltipSizingContext:AWCTooltipSizingContext{get{self[AWCTooltipContextKey.self]}set{self[AWCTooltipContextKey.self]=newValue}}
    var awcTooltipForcedColors:Bool{get{self[AWCTooltipForcedColorsKey.self]}set{self[AWCTooltipForcedColorsKey.self]=newValue}}
}
extension EnvironmentValues{
    var awcTooltipSlots:[AWCTooltipSlot:AnyView]{get{self[AWCTooltipSlotsKey.self]}set{self[AWCTooltipSlotsKey.self]=newValue}}
    var awcTooltipTexts:[AWCTooltipSlot:String]{get{self[AWCTooltipTextsKey.self]}set{self[AWCTooltipTextsKey.self]=newValue}}
    var awcTooltipSlotLabels:[AWCTooltipSlot:String]{get{self[AWCTooltipLabelsKey.self]}set{self[AWCTooltipLabelsKey.self]=newValue}}
    var awcTooltipParts:[AWCTooltipPart:AWCTooltipPartAppearance]{get{self[AWCTooltipPartsKey.self]}set{self[AWCTooltipPartsKey.self]=newValue}}
}
private struct AWCTooltipAppearanceModifier:ViewModifier{
    let value:AWCTooltipAppearance
    @Environment(\.awcTooltipAppearance) private var inherited
    func body(content:Content)->some View{content.environment(\.awcTooltipAppearance,inherited.merging(value))}
}
private struct AWCTooltipPartModifier:ViewModifier{
    let part:AWCTooltipPart,value:AWCTooltipPartAppearance
    @Environment(\.awcTooltipParts) private var inherited
    func body(content:Content)->some View{var values=inherited;values[part]=(values[part] ?? .init()).merging(value);return content.environment(\.awcTooltipParts,values)}
}
private struct AWCTooltipSlotModifier:ViewModifier{
    let slot:AWCTooltipSlot,value:AnyView?,label:String?
    var authoredText:String?=nil
    @Environment(\.awcTooltipSlots) private var inherited
    @Environment(\.awcTooltipSlotLabels) private var labels
    @Environment(\.awcTooltipTexts) private var texts
    func body(content:Content)->some View{var values=inherited;values[slot]=value;var text=labels;text[slot]=label;var authored=texts;authored[slot]=authoredText;return content.environment(\.awcTooltipSlots,values).environment(\.awcTooltipSlotLabels,text).environment(\.awcTooltipTexts,authored)}
}
public extension View{
    func awcTooltipAppearance(_ value:AWCTooltipAppearance)->some View{modifier(AWCTooltipAppearanceModifier(value:value))}
    func awcTooltipSizingContext(_ value:AWCTooltipSizingContext)->some View{environment(\.awcTooltipSizingContext,value)}
    func awcTooltipForcedColors(_ enabled:Bool)->some View{environment(\.awcTooltipForcedColors,enabled)}
    func awcTooltipPartAppearance(_ value:AWCTooltipPartAppearance,part:AWCTooltipPart)->some View{modifier(AWCTooltipPartModifier(part:part,value:value))}
    /// Authored text uses the component's native font, tracking and line boxes.
    /// Use the View builder overload for content with its own layout.
    func awcTooltipSlot(_ slot:AWCTooltipSlot,text:String)->some View{modifier(AWCTooltipSlotModifier(slot:slot,value:nil,label:text,authoredText:text))}
    func awcTooltipSlot<Slot:View>(_ slot:AWCTooltipSlot,accessibilityLabel:String?=nil,@ViewBuilder content:()->Slot)->some View{modifier(AWCTooltipSlotModifier(slot:slot,value:AnyView(content()),label:accessibilityLabel))}
}
