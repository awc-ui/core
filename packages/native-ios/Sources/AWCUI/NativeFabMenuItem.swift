import SwiftUI

func awcFabMenuToken(_ tokens:[String:String],_ name:String,_ fallback:Double)->Double {
    tokens[name].flatMap{Double($0.replacingOccurrences(of:"px",with:""))} ?? fallback
}
struct AWCNativeFabMenuItemMetrics {
    let height:CGFloat,iconSize:CGFloat,fontSize:CGFloat,lineHeight:CGFloat,weight:Double,tracking:CGFloat,start:CGFloat,end:CGFloat,gap:CGFloat,radius:CGFloat
    init(properties:[String:AWCValue],hasIcon:Bool,appearance:AWCFabMenuItemAppearance,tokens:[String:String]) {
        let value=properties["density"]?.number ?? 0,d=[-1.0,-2,-3,-4].contains(value) ? value:0
        height=CGFloat(max(32,48+d*4));iconSize=CGFloat(appearance.iconSize ?? max(16,20+d))
        fontSize=CGFloat(max(12,14+d*0.5));lineHeight=CGFloat(max(16,20+d))
        weight=awcFabMenuToken(tokens,"--md-sys-typescale-title-small-font-weight",500)
        tracking=CGFloat(awcFabMenuToken(tokens,"--md-sys-typescale-title-small-letter-spacing",0.1))
        end=CGFloat(d <= -3 ? 16:d == -2 ? 20:awcFabMenuToken(tokens,"--md-sys-spacing-inset-xl",24))
        start=hasIcon ? CGFloat(d == -4 ? 8:d <= -2 ? 12:awcFabMenuToken(tokens,"--md-sys-spacing-inset-lg",16)):end
        gap=CGFloat(d <= -3 ? 4:awcFabMenuToken(tokens,"--md-sys-spacing-gap-sm",8))
        radius=CGFloat(appearance.cornerRadius ?? awcFabMenuToken(tokens,"--md-sys-shape-corner-full",9999))
    }
}
private struct AWCFabMenuItemStyle:ButtonStyle {
    let id:String,metrics:AWCNativeFabMenuItemMetrics,appearance:AWCFabMenuItemAppearance,theme:AWCTheme
    let disabled:Bool,focused:Bool,nativePressed:Bool,activation:Int
    let pointerPressed:()->Void
    func makeBody(configuration:Configuration)->some View {AWCFabMenuItemSurface(style:self,configuration:configuration)}
}
private struct AWCFabMenuItemSurface:View {
    let style:AWCFabMenuItemStyle,configuration:ButtonStyleConfiguration
    @State private var hovered=false
    @State private var frame=CGRect.zero
    @State private var localOrigin:CGPoint?
    @State private var localDown=false
    @Environment(\.awcNativePointerState) private var pointer
    @Environment(\.awcTouchPress) private var touchPress
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.layoutDirection) private var direction
    private var tokens:[String:String] {style.theme.tokens.isEmpty ? AWCGeneratedTokens.light:style.theme.tokens}
    private func color(_ role:String)->Color {Color(awcHex:tokens["--md-sys-color-"+role] ?? "#000000")}
    var body:some View {
        let m=style.metrics,a=style.appearance,pressed=configuration.awcPressed(touchPress) && !style.disabled
        let hover=pointer.map{$0.location.map(frame.contains) ?? false} ?? hovered
        let ink=style.disabled ? color("on-surface").opacity(awcFabMenuToken(tokens,"--md-sys-state-disabled-content-opacity",0.38)):a.labelColor.map{Color(awcHex:$0)} ?? color("on-primary-container")
        let fill=style.disabled ? color("on-surface").opacity(awcFabMenuToken(tokens,"--md-sys-state-disabled-container-opacity",0.12)):a.containerColor.map{Color(awcHex:$0)} ?? color("primary-container")
        let alpha=style.disabled ? 0:pressed ? awcFabMenuToken(tokens,"--md-sys-state-pressed-state-layer-opacity",0.12):style.focused ? awcFabMenuToken(tokens,"--md-sys-state-focus-state-layer-opacity",0.12):hover ? awcFabMenuToken(tokens,"--md-sys-state-hover-state-layer-opacity",0.08):0
        let shape=RoundedRectangle(cornerRadius:m.radius,style:.circular)
        let motion:Animation?=reduceMotion ? nil:.timingCurve(0.2,0,0,1,duration:0.28)
        let origin=pointer.flatMap{$0.isPointerDown ? $0.pressLocation.map{CGPoint(x:$0.x-frame.minX,y:$0.y-frame.minY)}:nil} ?? (localDown ? localOrigin:nil)
        configuration.label
            .foregroundStyle(ink)
            .padding(.leading,m.start).padding(.trailing,m.end)
            .frame(minHeight:m.height)
            .background {
                shape.fill(fill).animation(motion,value:fill)
                    .overlay {shape.fill(ink).opacity(alpha).animation(motion,value:alpha).awcInspect(nodeID:style.id,part:"state-layer",name:"md-fab-menu-item ::part(state-layer)")}
                    .overlay {AWCNativeButtonRipple(pressed:pressed,nativePressed:!style.disabled && style.nativePressed,nativeActivation:style.activation,color:ink,origin:origin).opacity(style.disabled ? 0:1)}
            }
            .clipShape(shape).contentShape(shape)
            .overlay {if style.focused {shape.stroke(color("secondary"),lineWidth:3).padding(-3.5)}}
            .background {GeometryReader {geometry in Color.clear.onChange(of:geometry.frame(in:.named("awc-native-preview")),initial:true){_,bounds in frame=bounds}}}
            .awcObservePointerOrigin(enabled:pointer == nil){origin,down in localOrigin=origin;localDown=down}
            .onHover{hovered=$0}
            .onChange(of:pressed){_,down in if down {style.pointerPressed()}}
            .awcInspect(nodeID:style.id,name:"md-fab-menu-item"){_ in
                ["padding":[0,.number(Double(direction == .rightToLeft ? m.start:m.end)),0,.number(Double(direction == .rightToLeft ? m.end:m.start))],
                 "border":[0,0,0,0],"margin":[0,0,0,0],"gap":["row":0,"column":.number(Double(m.gap))],
                 "typography":["size":.number(Double(m.fontSize)),"lineHeight":.number(Double(m.lineHeight)),"weight":.number(AWCNativeFonts.resolvedLabelWeight(m.weight)),"spacing":.number(Double(m.tracking)),"family":.string(AWCNativeFonts.labelFamily(regular:m.weight<500)),"unit":"pt"],
                 "direction":.string(direction == .rightToLeft ? "rtl":"ltr"),"display":"SwiftUI menu item"]
            }
    }
}
private struct AWCFabMenuIconColor:ViewModifier {
    let color:String?
    @ViewBuilder func body(content:Content)->some View {if let color {content.foregroundStyle(Color(awcHex:color))} else {content}}
}
extension AWCNativeView {
    @ViewBuilder var nativeFabMenuItem:some View {
        if !b("hidden") {
            let appearance=fabMenuItemAppearance.merging(fabMenuItemOverrides[node.id] ?? .init())
            let icons=node.children(inSlot:"icon").filter{$0.tag != "#text"}
            let hasIcon = !icons.isEmpty || !s("icon").isEmpty
            let resolved=local.merging(["density":.number(AWCNativeDensity.resolve(local["density"]?.number,inherited:inheritedDensity))]){_,new in new}
            let m=AWCNativeFabMenuItemMetrics(properties:resolved,hasIcon:hasIcon,appearance:appearance,tokens:theme.tokens)
            var policy=local.merging(["roleOverride":"menuitem","groupTabindex":.number(fabMenuSession?.activeID==node.id ? 0:-1),"_menuRoving":true]){_,new in new}
            let _ = policy["selected"].map{_ in policy.removeValue(forKey:"selected")}
            AWCNativeActionControl(style:{focused,pressed,activation,pointer in
                AWCFabMenuItemStyle(id:node.id,metrics:m,appearance:appearance,theme:theme,disabled:disabled,focused:focused || b("rovingFocusVisible") || fabMenuSession?.rovingID==node.id,nativePressed:pressed,activation:activation,pointerPressed:pointer)
            },policy:.init(properties:policy),id:node.id,accessibleLabel:local["aria-label"]?.string ?? local["ariaLabel"]?.string ?? label,action:{source in
                guard !disabled else{return}
                var event=AWCEvent(name:"mdClick",tag:node.tag,nodeID:node.id,detail:.null)
                event.activation = .init(kind:.nativeControl,source:source)
                let context=AWCEventDispatcher.dispatch(event,through:eventDispatcher,cancelable:true,targetListeners:eventTargetListeners)
                onEvent(context.observedEvent)
            },direction:s("dir")) {
                HStack(spacing:m.gap) {
                    if !icons.isEmpty {
                        ForEach(icons) {icon in
                            Group {
                                if icon.tag=="#symbol" {AWCMaterialSymbol(icon.properties["name"]?.string ?? "",size:m.iconSize)}
                                else if icon.tag=="#slot-text" {Text(icon.properties["text"]?.string ?? "").font(AWCNativeFonts.label(size:m.fontSize,weight:m.weight)).tracking(m.tracking)}
                                else {child(icon)}
                            }.frame(width:m.iconSize,height:m.iconSize).modifier(AWCFabMenuIconColor(color:appearance.iconColor))
                                .environment(\.awcMaterialSymbolSize,m.iconSize)
                        }
                    } else if !s("icon").isEmpty {
                        AWCMaterialSymbol(s("icon"),size:m.iconSize)
                            .modifier(AWCFabMenuIconColor(color:appearance.iconColor))
                            .awcInspect(nodeID:node.id,part:"icon",name:"md-fab-menu-item ::part(icon)")
                    }
                    HStack(spacing:0) {
                        if !s("label").isEmpty {Text(s("label"))}
                        else {ForEach(node.children(inSlot:nil)) {item in
                            if item.tag=="#slot-text" {Text(item.properties["text"]?.string ?? "")} else {child(item)}
                        }}
                    }.font(AWCNativeFonts.label(size:m.fontSize,weight:m.weight)).tracking(m.tracking).fixedSize()
                        .frame(height:m.lineHeight)
                        .awcInspect(nodeID:node.id,part:"label",name:"md-fab-menu-item ::part(label)")
                }.fixedSize()
            }
        }
    }
}
