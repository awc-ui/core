import SwiftUI

struct AWCNativeSplitMetrics {
    let height:CGFloat, outer:CGFloat, inner:CGFloat, hoverInner:CGFloat, icon:CGFloat, trailingIcon:CGFloat
    let leadingStart:CGFloat, leadingEnd:CGFloat, trailingStart:CGFloat, trailingEnd:CGFloat, gap:CGFloat, border:CGFloat
    let font:CGFloat, line:CGFloat, weight:Double, tracking:CGFloat
    let trailingFont:CGFloat, trailingLine:CGFloat, trailingWeight:Double
    init(properties:[String:AWCValue],inheritedDensity:Double,appearance:AWCSplitButtonAppearance,tokens:[String:String]) {
        let index=["xs","sm","md","lg","xl"].firstIndex(of:properties["size"]?.string ?? "sm") ?? 1
        let density=AWCNativeDensity.resolve(properties["density"]?.number,inherited:inheritedDensity)
        let base=[32.0,40,56,96,136][index],hasIcon = !(properties["icon"]?.string ?? "").isEmpty,checked=properties["trailingChecked"]?.bool == true
        height=CGFloat(max(24,base+4*density));outer=CGFloat(appearance.cornerRadius ?? base/2)
        inner=[4,4,8,12,16][index];hoverInner=[8,8,12,20,28][index]
        icon=CGFloat(appearance.iconSize ?? [16,18,24,36,48][index]);trailingIcon=[22,22,26,38,50][index]
        leadingStart=CGFloat(max(4,[12.0,16,24,36,48][index]-(hasIcon ? 4:0)+2*density))
        leadingEnd=CGFloat(max(4,[10.0,14,20,28,36][index]+2*density))
        trailingStart=CGFloat(max(4,(checked ? [13.0,13,15,29,43]:[12.0,12,13,26,37])[index]+2*density))
        trailingEnd=CGFloat(max(4,(checked ? [13.0,13,15,29,43]:[14.0,14,17,32,49])[index]+2*density))
        gap=CGFloat(max(4,8+density));border=properties["variant"]?.string == "outlined" ? 1:0
        let tier=["label-medium","label-large","title-medium","headline-small","headline-medium"][index]
        font=CGFloat(max([10.0,12,13,18,22][index],[12.0,14,16,24,28][index]+density*(index>=3 ? 1:0.5)))
        line=CGFloat(index>=3 ? max(index==3 ? 24:28,(index==3 ? 32:36)+2*density):max(16,20+density))
        weight=awcFabMenuToken(tokens,"--md-sys-typescale-\(tier)-font-weight",index>=3 ? 400:500)
        tracking=CGFloat(awcFabMenuToken(tokens,"--md-sys-typescale-label-large-letter-spacing",0.1))
        trailingFont=CGFloat(max(12,14+density*0.5));trailingLine=CGFloat(max(16,20+density))
        trailingWeight=awcFabMenuToken(tokens,"--md-sys-typescale-label-large-font-weight",500)
    }
}
struct AWCSplitButtonShape:InsettableShape {
    var topStart:CGFloat,bottomStart:CGFloat,topEnd:CGFloat,bottomEnd:CGFloat
    var rtl:Bool=false,insetAmount:CGFloat=0
    var animatableData:AnimatablePair<AnimatablePair<CGFloat,CGFloat>,AnimatablePair<CGFloat,CGFloat>> {
        get{.init(.init(topStart,bottomStart),.init(topEnd,bottomEnd))}
        set{topStart=newValue.first.first;bottomStart=newValue.first.second;topEnd=newValue.second.first;bottomEnd=newValue.second.second}
    }
    func path(in rect:CGRect)->Path {
        let r=rect.insetBy(dx:insetAmount,dy:insetAmount)
        var tl=max(0,(rtl ? topEnd:topStart)-insetAmount),tr=max(0,(rtl ? topStart:topEnd)-insetAmount)
        var bl=max(0,(rtl ? bottomEnd:bottomStart)-insetAmount),br=max(0,(rtl ? bottomStart:bottomEnd)-insetAmount)
        let scale=min(1,r.width/max(0.0001,tl+tr),r.width/max(0.0001,bl+br),r.height/max(0.0001,tl+bl),r.height/max(0.0001,tr+br))
        tl *= scale;tr *= scale;bl *= scale;br *= scale
        return UnevenRoundedRectangle(topLeadingRadius:tl,bottomLeadingRadius:bl,bottomTrailingRadius:br,topTrailingRadius:tr,style:.circular).path(in:r)
    }
    func inset(by value:CGFloat)->Self {var copy=self;copy.insetAmount += value;return copy}
}
private struct AWCSplitLabelKey:LayoutValueKey {static let defaultValue=false}
private struct AWCSplitContentLayout:Layout {
    let gap:CGFloat, truncate:Bool
    private func widths(_ proposal:ProposedViewSize,_ subviews:Subviews)->[CGFloat] {
        var widths=subviews.map{$0.sizeThatFits(.unspecified).width}
        if truncate,let width=proposal.width,let index=subviews.indices.first(where:{subviews[$0][AWCSplitLabelKey.self]}) {
            let other=widths.enumerated().filter{$0.offset != index}.reduce(0){$0+$1.element}
            widths[index]=min(widths[index],max(0,width-other-gap*CGFloat(max(0,subviews.count-1))))
        }
        return widths
    }
    func sizeThatFits(proposal:ProposedViewSize,subviews:Subviews,cache:inout())->CGSize {
        let widths=widths(proposal,subviews)
        return .init(width:widths.reduce(0,+)+gap*CGFloat(max(0,subviews.count-1)),height:subviews.indices.map{subviews[$0].sizeThatFits(.init(width:widths[$0],height:nil)).height}.max() ?? 0)
    }
    func placeSubviews(in bounds:CGRect,proposal:ProposedViewSize,subviews:Subviews,cache:inout()) {
        let widths=widths(.init(width:bounds.width,height:bounds.height),subviews)
        var x=bounds.minX
        for index in subviews.indices {subviews[index].place(at:.init(x:x,y:bounds.midY),anchor:.leading,proposal:.init(width:widths[index],height:nil));x += widths[index]+gap}
    }
}
private struct AWCSplitHalfLayout:Layout {
    let m:AWCNativeSplitMetrics,trailing:Bool,stretch:Bool
    var start:CGFloat{trailing ? m.trailingStart:m.leadingStart}
    var end:CGFloat{trailing ? m.trailingEnd:m.leadingEnd}
    func sizeThatFits(proposal:ProposedViewSize,subviews:Subviews,cache:inout())->CGSize {
        let natural=(subviews.first?.sizeThatFits(.unspecified).width ?? 0)+start+end+2*m.border
        return .init(width:max(start+end+2*m.border,stretch ? proposal.width ?? natural:natural),height:m.height)
    }
    func placeSubviews(in bounds:CGRect,proposal:ProposedViewSize,subviews:Subviews,cache:inout()) {
        guard let content=subviews.first else{return}
        let offered=max(0,bounds.width-start-end-2*m.border)
        let size=content.sizeThatFits(.init(width:offered,height:nil))
        content.place(at:.init(x:bounds.minX+start+m.border+(offered-size.width)/2,y:bounds.midY),anchor:.leading,proposal:.init(size))
    }
}
private struct AWCSplitPairLayout:Layout {
    let fullWidth:Bool
    func sizeThatFits(proposal:ProposedViewSize,subviews:Subviews,cache:inout())->CGSize {
        let sizes=subviews.map{$0.sizeThatFits(.unspecified)}
        let natural=sizes.reduce(0){$0+$1.width}+2
        return .init(width:fullWidth ? proposal.width ?? natural:natural,height:sizes.map(\.height).max() ?? 0)
    }
    func placeSubviews(in bounds:CGRect,proposal:ProposedViewSize,subviews:Subviews,cache:inout()) {
        guard subviews.count==2 else{return}
        let trailing=subviews[1].sizeThatFits(.unspecified)
        let leading=subviews[0].sizeThatFits(.init(width:fullWidth ? bounds.width-trailing.width-2:nil,height:nil))
        subviews[0].place(at:.init(x:bounds.minX,y:bounds.minY),anchor:.topLeading,proposal:.init(leading))
        subviews[1].place(at:.init(x:bounds.minX+leading.width+2,y:bounds.minY),anchor:.topLeading,proposal:.init(trailing))
    }
}
private struct AWCSplitStyle:ButtonStyle {
    let id:String,m:AWCNativeSplitMetrics,appearance:AWCSplitButtonAppearance,theme:AWCTheme
    let variant:String,trailing:Bool,checked:Bool,disabled:Bool,hardDisabled:Bool,focused:Bool,nativePressed:Bool,activation:Int,ripple:Bool,fullWidth:Bool
    let pointerPressed:()->Void
    func makeBody(configuration:Configuration)->some View {AWCSplitSurface(style:self,configuration:configuration)}
}
private struct AWCSplitSurface:View {
    let style:AWCSplitStyle,configuration:ButtonStyleConfiguration
    @Environment(\.layoutDirection) private var direction
    @Environment(\.awcNativePointerState) private var pointer
    @Environment(\.awcTouchPress) private var touchPress
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var frame=CGRect.zero
    @State private var hovered=false
    @State private var localDown=false
    @State private var localOrigin:CGPoint?
    private var m:AWCNativeSplitMetrics {style.m}
    private var tokens:[String:String]{style.theme.tokens.isEmpty ? AWCGeneratedTokens.light:style.theme.tokens}
    private func color(_ role:String)->Color{Color(awcHex:tokens["--md-sys-color-"+role] ?? "#000000")}
    private func alpha(_ key:String,_ fallback:Double)->Double{awcFabMenuToken(tokens,"--md-sys-state-"+key,fallback)}
    private var hover:Bool{!style.hardDisabled && (pointer.map{$0.location.map(frame.contains) ?? false} ?? hovered)}
    private var pressed:Bool{configuration.awcPressed(touchPress) && !style.hardDisabled}
    private var active:Bool{hover || pressed || style.focused}
    private var shape:AWCSplitButtonShape{
        if style.trailing && style.checked{return .init(topStart:m.outer,bottomStart:m.outer,topEnd:m.outer,bottomEnd:m.outer,rtl:direction == .rightToLeft)}
        let inner=active ? m.hoverInner:m.inner
        let enabled=CGFloat(awcFabMenuToken(tokens,"--md-sys-shape-morph-enabled",1))
        let partial=active ? m.inner+enabled*(m.hoverInner-m.inner):m.inner
        return style.trailing ? .init(topStart:partial,bottomStart:inner,topEnd:m.outer,bottomEnd:m.outer,rtl:direction == .rightToLeft):.init(topStart:m.outer,bottomStart:m.outer,topEnd:inner,bottomEnd:partial,rtl:direction == .rightToLeft)
    }
    private var palette:(String,String){switch style.variant{case "tonal":return("secondary-container","on-secondary-container");case "elevated":return("surface-container-low","primary");case "outlined":return("","primary");default:return("primary","on-primary")}}
    private var fill:Color{if style.variant=="outlined"{return .clear};if style.disabled{return color("on-surface").opacity(alpha("disabled-container-opacity",0.12))};return style.appearance.containerColor.map{Color(awcHex:$0)} ?? color(palette.0)}
    private var ink:Color{if style.disabled{return color("on-surface").opacity(alpha("disabled-content-opacity",0.38))};return style.appearance.labelColor.map{Color(awcHex:$0)} ?? color(palette.1)}
    private var layer:Color{color(palette.1)}
    private var outline:Color{if style.disabled{return color("on-surface").opacity(alpha("disabled-container-opacity",0.12))};return style.appearance.outlineColor.map{Color(awcHex:$0)} ?? color(style.focused ? "primary":"outline")}
    private var opacity:Double{style.disabled ? 0:pressed ? alpha("pressed-state-layer-opacity",0.1):style.focused ? alpha("focus-state-layer-opacity",0.1):hover ? alpha("hover-state-layer-opacity",0.08):0}
    private var elevation:Int{if style.disabled{return 0};if style.variant=="elevated"{return hover && !pressed && !style.focused ? 2:1};return style.variant=="tonal" && hover ? 1:0}
    private var part:String{style.trailing ? "trailing":"leading"}
    private var inspection:[String:AWCValue]{
        let start=style.trailing ? m.trailingStart:m.leadingStart,end=style.trailing ? m.trailingEnd:m.leadingEnd,rtl=direction == .rightToLeft
        let font=style.trailing ? m.trailingFont:m.font,line=style.trailing ? m.trailingLine:m.line,weight=style.trailing ? m.trailingWeight:m.weight
        return ["padding":[0,.number(Double(rtl ? start:end)),0,.number(Double(rtl ? end:start))],"border":.array(Array(repeating:.number(Double(m.border)),count:4)),"margin":[0,0,0,0],"gap":["row":0,"column":.number(Double(style.trailing ? 0:m.gap))],"typography":["size":.number(Double(font)),"lineHeight":.number(Double(line)),"weight":.number(AWCNativeFonts.resolvedLabelWeight(weight)),"spacing":.number(Double(m.tracking)),"family":.string(AWCNativeFonts.labelFamily(regular:weight<500)),"unit":"pt"],"display":"SwiftUI Button","direction":.string(rtl ? "rtl":"ltr")]
    }
    private var origin:CGPoint?{pointer.flatMap{$0.isPointerDown ? $0.pressLocation.map{CGPoint(x:$0.x-frame.minX,y:$0.y-frame.minY)}:nil} ?? (localDown ? localOrigin:nil)}
    private var motion:Animation?{reduceMotion ? nil:.timingCurve(0.2,0,0,1,duration:0.2)}
    var body:some View {
        let surface=AWCSplitHalfLayout(m:m,trailing:style.trailing,stretch:!style.trailing && style.fullWidth){configuration.label}
            .foregroundStyle(ink)
            .background{shape.fill(fill)
                .overlay{if !style.disabled{shape.fill(layer).opacity(opacity).animation(reduceMotion ? nil:.timingCurve(0.2,0,0,1,duration:0.1),value:opacity).awcInspect(nodeID:style.id,part:part+"-state-layer",parentPart:part,name:"md-split-button ::part(\(part)-state-layer)").padding(m.border)}}
                .overlay{if style.ripple{AWCNativeButtonRipple(pressed:pressed && !style.disabled,nativePressed:style.nativePressed && !style.disabled,nativeActivation:style.activation,color:layer,origin:origin).opacity(style.disabled ? 0:1)}}}
            .clipShape(shape).contentShape(shape)
            .overlay{if m.border>0{shape.strokeBorder(outline,lineWidth:m.border)}}
        return AnyView(surface)
            .background{ZStack{
                shape.inset(by:elevation==2 ? -2:-1).fill(color("shadow")).blur(radius:elevation==2 ? 3:1.5).offset(y:elevation==2 ? 2:1).opacity(elevation==0 ? 0:0.15)
                shape.fill(color("shadow")).blur(radius:1).offset(y:1).opacity(elevation==0 ? 0:0.3)
            }}
            .overlay{if style.focused{shape.inset(by:-3.5).stroke(color("secondary"),lineWidth:3)}}
            .modifier(AWCSplitShadowClip(enabled:style.variant=="elevated" && !style.disabled && !style.focused,trailing:style.trailing,rtl:direction == .rightToLeft))
            .animation(motion,value:active).animation(motion,value:style.checked)
            .background{GeometryReader{g in Color.clear.onChange(of:g.frame(in:.named("awc-native-preview")),initial:true){_,value in frame=value}}}
            .awcObservePointerOrigin(enabled:pointer == nil){origin,down in localOrigin=origin;localDown=down}
            .onHover{hovered=$0}.onChange(of:pressed){_,value in if value{style.pointerPressed()}}
            .awcInspect(nodeID:style.id,part:part,name:"md-split-button ::part(\(part))"){_ in inspection}
    }
}
private struct AWCSplitShadowClip:ViewModifier {
    let enabled:Bool,trailing:Bool,rtl:Bool
    @ViewBuilder func body(content:Content)->some View {
        if enabled{content.mask{GeometryReader{g in Rectangle().frame(width:g.size.width+7,height:g.size.height+12).offset(x:(trailing != rtl) ? -1:-6,y:-6)}}}else{content}
    }
}
private struct AWCSplitIconColor:ViewModifier {
    let color:String?,disabled:Bool
    @ViewBuilder func body(content:Content)->some View{if let color,!disabled{content.foregroundStyle(Color(awcHex:color))}else{content}}
}
extension AWCNativeView {
    @ViewBuilder var nativeSplitButton:some View {
        if !b("hidden"){
            let tokens=theme.tokens.isEmpty ? AWCGeneratedTokens.light:theme.tokens
            let m=AWCNativeSplitMetrics(properties:local,inheritedDensity:inheritedDensity,appearance:splitButtonAppearance,tokens:tokens)
            let checked=b("trailingChecked"),full=b("fullWidth"),rtl=s("dir")=="rtl" || (s("dir").isEmpty && layoutDirection == .rightToLeft)
            AWCSplitPairLayout(fullWidth:full){
                splitHalf(trailing:false,metrics:m,checked:checked)
                splitHalf(trailing:true,metrics:m,checked:checked)
            }.environment(\.layoutDirection,rtl ? .rightToLeft:.leftToRight)
                .accessibilityElement(children:.contain)
                .awcReportSplitButtonChecked(id:node.id,value:checked)
                .awcInspect(nodeID:node.id,name:"md-split-button"){_ in ["padding":[0,0,0,0],"border":[0,0,0,0],"margin":[0,0,0,0],"gap":["row":0,"column":2],"display":"SwiftUI split control","direction":.string(rtl ? "rtl":"ltr")]}
        }
    }
    private func splitHalf(trailing:Bool,metrics m:AWCNativeSplitMetrics,checked:Bool)->some View {
        let kind=s("haspopup","menu"),popup=trailing ? AWCNativePopupRelationship(kind:kind=="false" ? nil:kind,expanded:checked,target:popupRegistry?.targets[s("controls")],focusActionLabel:popupRegistry?.focusActionLabel ?? "Move to popup"):nil
        let defaultText=node.children(inSlot:nil).map(\.authoredTextContent).joined()
        let name=trailing ? s("menuLabel","Toggle menu"):s("label").isEmpty ? (local["aria-label"]?.string ?? defaultText):s("label")+defaultText
        return AWCNativeActionControl(style:{focused,pressed,activation,pointer in
            AWCSplitStyle(id:node.id,m:m,appearance:splitButtonAppearance,theme:theme,variant:s("variant","filled"),trailing:trailing,checked:checked,disabled:disabled,hardDisabled:b("disabled"),focused:focused,nativePressed:pressed,activation:activation,ripple:b("ripple",true),fullWidth:b("fullWidth"),pointerPressed:pointer)
        },policy:.init(properties:local),id:node.id+(trailing ? ".trailing":".leading"),accessibleLabel:name,action:{source in
            guard !disabled else{return}
            if trailing{set("trailingChecked",.bool(!b("trailingChecked")))}
            var event=AWCEvent(name:trailing ? "mdTrailingClick":"mdLeadingClick",tag:node.tag,nodeID:node.id,detail:trailing ? ["checked":.bool(b("trailingChecked"))]:.null)
            event.activation = .init(kind:.nativeControl,source:source)
            onEvent(AWCEventDispatcher.dispatch(event,through:eventDispatcher,cancelable:true,targetListeners:eventTargetListeners).observedEvent)
        },direction:s("dir"),popup:popup){
            if trailing {
                AWCMaterialSymbol(s("trailingIcon","keyboard_arrow_down"),size:m.trailingIcon)
                    .rotationEffect(.degrees(checked ? 180:0))
                    .modifier(AWCSplitRotationAnimation(checked:checked))
                    .awcInspect(nodeID:node.id,part:"trailing-icon",parentPart:"trailing",name:"md-split-button ::part(trailing-icon)")
            }else{
                AWCSplitContentLayout(gap:m.gap,truncate:b("fullWidth")){
                    if !s("icon").isEmpty{AWCMaterialSymbol(s("icon"),size:m.icon).modifier(AWCSplitIconColor(color:splitButtonAppearance.iconColor,disabled:disabled)).awcInspect(nodeID:node.id,part:"icon",parentPart:"leading",name:"md-split-button ::part(icon)")}
                    if !s("label").isEmpty{Text(awcCollapsedInlineText(s("label"))).lineLimit(1).truncationMode(.tail).frame(height:m.line).layoutValue(key:AWCSplitLabelKey.self,value:true).awcInspect(nodeID:node.id,part:"label",parentPart:"leading",name:"md-split-button ::part(label)")}
                    ForEach(node.children(inSlot:nil)){item in
                        Group{if ["#text","#slot-text"].contains(item.tag){Text(awcCollapsedInlineText(item.authoredTextContent)).lineLimit(1).fixedSize().frame(height:m.line)}else{child(item)}}
                    }
                }.font(AWCNativeFonts.label(size:m.font,weight:m.weight)).tracking(m.tracking)
            }
        }
    }
}
private struct AWCSplitRotationAnimation:ViewModifier {
    let checked:Bool
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    func body(content:Content)->some View{content.animation(reduceMotion ? nil:.timingCurve(0.2,0,0,1,duration:0.2),value:checked)}
}
