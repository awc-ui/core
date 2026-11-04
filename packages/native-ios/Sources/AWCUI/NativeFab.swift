import SwiftUI

private func awcFabNumber(_ value:String?,_ fallback:Double)->Double { value.flatMap{Double($0.replacingOccurrences(of:"px",with:"").replacingOccurrences(of:"ms",with:""))} ?? fallback }
struct AWCNativeFabMetrics {
    let height:CGFloat, iconSize:CGFloat, cornerRadius:CGFloat
    let fontSize:CGFloat, fontWeight:Double, lineHeight:CGFloat, letterSpacing:CGFloat
    let hasLabel:Bool, hasIcon:Bool, extended:Bool
    let inset:CGFloat, gap:CGFloat, plainInset:CGFloat
    init(properties:[String:AWCValue],hasIcon:Bool,appearance:AWCFabAppearance = .init(),tokens:[String:String] = AWCGeneratedTokens.light) {
        let value=properties["density"]?.number ?? 0,density=[-1.0,-2,-3,-4].contains(value) ? value:0
        let label=properties["label"]?.string ?? ""; hasLabel = !label.isEmpty; self.hasIcon=hasIcon
        extended=hasLabel && (properties["extended"]?.bool ?? true)
        let index=hasLabel ? 0:["standard","medium","large"].firstIndex(of:properties["size"]?.string ?? "standard") ?? 0
        height=CGFloat(max([40.0,64,80][index],[56.0,80,96][index]+density*4))
        iconSize=CGFloat(appearance.iconSize ?? max([18.0,21,27][index],[24.0,28,36][index]+density))
        cornerRadius=CGFloat(appearance.cornerRadius ?? awcFabNumber(tokens["--md-sys-shape-corner-"+(index==0 ? "large":"extra-large")],index==0 ? 16:28))
        fontSize=CGFloat(max(11,14+density*0.5)); fontWeight=awcFabNumber(tokens["--md-sys-typescale-label-large-font-weight"],500)
        lineHeight=CGFloat(awcFabNumber(tokens["--md-sys-typescale-label-large-line-height"],20)); letterSpacing=CGFloat(awcFabNumber(tokens["--md-sys-typescale-label-large-letter-spacing"],0.1))
        // The global tokens sheet applies its spacing payload to local density
        // attributes too; these discrete spacing rungs accompany the calc scale.
        inset=CGFloat(density == -4 ? 8:density <= -2 ? 12:awcFabNumber(tokens["--md-sys-spacing-inset-lg"],16))
        gap=CGFloat(density <= -2 ? 8:awcFabNumber(tokens["--md-sys-spacing-inset-md"],12))
        plainInset=CGFloat(max(12,20+density*2))
    }
    func padding(_ fraction:CGFloat)->(CGFloat,CGFloat) {
        guard hasLabel else { return (0,0) }
        guard hasIcon else { return (plainInset,plainInset) }
        return (inset,inset+(20-inset)*fraction)
    }
}
struct AWCNativeFabPalette {
    let container:String,ink:String
    init(variant:String,lowered:Bool) {
        switch variant {
        case "surface":container=lowered ? "surface-container-low":"surface-container-high";ink="primary"
        case "primary","secondary","tertiary":container=variant;ink="on-"+variant
        case "secondary-container","tertiary-container":container=variant;ink="on-"+variant
        default:container="primary-container";ink="on-primary-container"
        }
    }
}
struct AWCNativeFabSlots {
    let children:[AWCNode]
    let glyph:String
    var hasIcon:Bool { !children.isEmpty || !glyph.isEmpty }
    init(node:AWCNode,properties:[String:AWCValue],menuIcon:String?) {
        if let menuIcon { children=[];glyph=menuIcon }
        else { children=node.children(inSlot:"icon").filter{$0.tag != "#text"};glyph=children.isEmpty ? properties["icon"]?.string ?? "":"" }
    }
}
/// Label width and insets animate from the real natural label measurement, so
/// long labels are not replaced by a guessed fixed-width transition target.
struct AWCNativeFabLayout: Layout {
    let metrics:AWCNativeFabMetrics
    var fraction:CGFloat
    var rtl = false
    var animatableData:CGFloat { get{fraction} set{fraction=newValue} }
    func sizeThatFits(proposal:ProposedViewSize,subviews:Subviews,cache:inout())->CGSize {
        guard metrics.hasLabel else { return .init(width:metrics.height,height:metrics.height) }
        let padding=metrics.padding(fraction), icon=subviews.first?.sizeThatFits(.unspecified).width ?? 0
        let label=subviews.count>1 ? subviews[1].sizeThatFits(.unspecified).width:0
        return .init(width:max(56+24*fraction,icon+label*min(1,max(0,fraction))+(metrics.hasIcon ? metrics.gap*fraction:0)+padding.0+padding.1),height:metrics.height)
    }
    func placeSubviews(in bounds:CGRect,proposal:ProposedViewSize,subviews:Subviews,cache:inout()) {
        guard let icon=subviews.first else{return}
        let naturalIcon=icon.sizeThatFits(.unspecified),labelWidth=subviews.count>1 ? subviews[1].sizeThatFits(.unspecified).width*min(1,max(0,fraction)):0
        let gap=metrics.hasLabel && metrics.hasIcon ? metrics.gap*fraction:0,padding=metrics.padding(fraction)
        let contentWidth=naturalIcon.width+gap+labelWidth
        let x=bounds.minX+padding.0+(bounds.width-padding.0-padding.1-contentWidth)/2
        let first = rtl ? bounds.maxX-(x-bounds.minX):x
        icon.place(at:.init(x:first,y:bounds.midY),anchor:rtl ? .trailing:.leading,proposal:.unspecified)
        if subviews.count>1 { subviews[1].place(at:.init(x:first+(rtl ? -1:1)*(naturalIcon.width+gap),y:bounds.midY),anchor:rtl ? .trailing:.leading,proposal:.init(width:labelWidth,height:metrics.lineHeight)) }
    }
}
private struct AWCNativeFabLabelLayout: Layout {
    func sizeThatFits(proposal:ProposedViewSize,subviews:Subviews,cache:inout())->CGSize {
        let natural=subviews.first?.sizeThatFits(.unspecified) ?? .zero
        return .init(width:proposal.width ?? natural.width,height:natural.height)
    }
    func placeSubviews(in bounds:CGRect,proposal:ProposedViewSize,subviews:Subviews,cache:inout()) { subviews.first?.place(at:.init(x:bounds.minX,y:bounds.midY),anchor:.leading,proposal:.unspecified) }
}
private struct AWCNativeFabStyle: ButtonStyle {
    let nodeID:String,metrics:AWCNativeFabMetrics,appearance:AWCFabAppearance,theme:AWCTheme,palette:AWCNativeFabPalette
    let disabled:Bool,lowered:Bool,ripple:Bool,focused:Bool,nativePressed:Bool
    let activation:Int
    let pointerPressed:()->Void
    var menuCircle=false
    func makeBody(configuration:Configuration)->some View { AWCNativeFabSurface(style:self,configuration:configuration) }
}
private struct AWCNativeFabSurface: View {
    let style:AWCNativeFabStyle,configuration:ButtonStyleConfiguration
    @Environment(\.awcNativePointerState) private var pointer
    /// A docked md-toolbar flattens its paired FAB (box-shadow: none on the slotted host).
    @Environment(\.awcFabFlatElevation) private var flatElevation
    @Environment(\.awcTouchPress) private var touchPress
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.layoutDirection) private var direction
    @State private var frame=CGRect.zero
    @State private var hovered=false
    @State private var localDown=false
    @State private var localOrigin:CGPoint?
    @State private var ready=false
    private var tokens:[String:String] { style.theme.tokens.isEmpty ? AWCGeneratedTokens.light:style.theme.tokens }
    private func color(_ role:String)->Color { Color(awcHex:tokens["--md-sys-color-"+role] ?? "#000000") }
    private func opacity(_ role:String,_ fallback:Double)->Double { awcFabNumber(tokens["--md-sys-state-"+role],fallback) }
    var body:some View {
        let m=style.metrics,a=style.appearance
        let pressed = !style.disabled && configuration.awcPressed(touchPress)
        let hover=pointer.map{$0.location.map(frame.contains) ?? false} ?? hovered
        let alpha=style.disabled ? 0:pressed ? opacity("pressed-state-layer-opacity",0.1):style.focused ? opacity("focus-state-layer-opacity",0.1):hover ? opacity("hover-state-layer-opacity",0.08):0
        let background=style.disabled ? color("on-surface").opacity(opacity("disabled-container-opacity",0.12)):a.containerColor.map{Color(awcHex:$0)} ?? color(style.palette.container)
        let inheritedInk=style.disabled ? color("on-surface").opacity(opacity("disabled-content-opacity",0.38)):a.iconColor.map{Color(awcHex:$0)} ?? color(style.palette.ink)
        let shape=AWCNativeFabShape(radius:m.cornerRadius,circle:style.menuCircle)
        let elevation=style.disabled ? 0:style.lowered ? (hover && !pressed && !style.focused ? 2:1):(hover && !pressed && !style.focused ? 4:3)
        let paint:Animation?=reduceMotion ? nil:.timingCurve(0.2,0,0,1,duration:0.28)
        let spatial:Animation? = !ready || reduceMotion ? nil:.timingCurve(0.38,1.21,0.22,1,duration:awcFabNumber(tokens["--md-sys-motion-spring-spatial-default-duration"],500)/1000)
        let origin=pointer.flatMap{$0.isPointerDown ? $0.pressLocation.map{CGPoint(x:$0.x-frame.minX,y:$0.y-frame.minY)}:nil} ?? (localDown ? localOrigin:nil)
        let content=configuration.label.foregroundStyle(inheritedInk)
            .animation(spatial,value:m.extended)
        let filled=content.background {
            shape.fill(background).animation(paint,value:background)
                .overlay { shape.fill(inheritedInk).opacity(alpha).animation(paint,value:alpha).awcInspect(nodeID:style.nodeID,part:"state-layer",name:"md-fab ::part(state-layer)") }
                .overlay { if style.ripple { AWCNativeButtonRipple(pressed:pressed,nativePressed:!style.disabled && style.nativePressed,nativeActivation:style.activation,color:inheritedInk,origin:origin).opacity(style.disabled ? 0:1) } }
        }.clipShape(shape).contentShape(shape)
        return AnyView(filled).background {
            // --md-sys-elevation-N outside the border box (CSS box-shadow, 280 ms emphasized transition); its corners follow
            // the FAB shape, including the menu's 50% circle morph.
            AWCElevationShadow(level: flatElevation ? 0 : Double(elevation), radii: Array(repeating: Double(min(m.cornerRadius, 9999)), count: 4), circle: style.menuCircle ? 1 : 0, tokens: tokens)
                .animation(paint, value: elevation)
        }.overlay { if style.focused { shape.stroke(color("secondary"),lineWidth:3).padding(-3.5) } }
            .background {GeometryReader{ geometry in Color.clear.onChange(of:geometry.frame(in:.named("awc-native-preview")),initial:true){_,value in frame=value} }}
            .awcObservePointerOrigin(enabled:pointer == nil){origin,down in localDown=down;localOrigin=origin}
            .onHover{hovered=$0}.onChange(of:pressed){_,down in if down {style.pointerPressed()}}
            .animation(!ready || reduceMotion ? nil:.timingCurve(0.2,0,0,1,duration:awcFabNumber(tokens["--md-sys-motion-duration-short4"],200)/1000),value:style.menuCircle)
            .onAppear{ready=true}
            .awcInspect(nodeID:style.nodeID,name:"md-fab") { _ in
                let p=m.padding(m.extended ? 1:0)
                var result:[String:AWCValue]=["padding":[0,.number(Double(direction == .rightToLeft ? p.0:p.1)),0,.number(Double(direction == .rightToLeft ? p.1:p.0))],"border":[0,0,0,0],"margin":[0,0,0,0],"gap":["row":0,"column":.number(Double(m.extended && m.hasIcon ? m.gap:0))],"direction":.string(direction == .rightToLeft ? "rtl":"ltr"),"display":"SwiftUI Button"]
                if m.hasLabel {result["typography"]=["size":.number(Double(m.fontSize)),"lineHeight":.number(Double(m.lineHeight)),"weight":.number(AWCNativeFonts.resolvedLabelWeight(m.fontWeight)),"spacing":.number(Double(m.letterSpacing)),"family":.string(AWCNativeFonts.labelFamily(regular:m.fontWeight<500)),"unit":"pt"]}
                return result
            }
    }
}
private struct AWCNativeFabShape:InsettableShape {
    var radius:CGFloat
    var circleFraction:CGFloat
    var insetAmount:CGFloat=0
    init(radius:CGFloat,circle:Bool) {self.radius=radius;circleFraction=circle ? 1:0}
    var animatableData:AnimatablePair<CGFloat,AnimatablePair<CGFloat,CGFloat>> {
        get {.init(radius,.init(circleFraction,insetAmount))}
        set {radius=newValue.first;circleFraction=newValue.second.first;insetAmount=newValue.second.second}
    }
    func path(in rect:CGRect)->Path {
        let rect=rect.insetBy(dx:insetAmount,dy:insetAmount)
        let initial=min(max(0,radius-insetAmount),min(rect.width,rect.height)/2)
        // CSS border-radius corners are circular/elliptical arcs; the menu morph's 50% radius makes an extended anchor an
        // ellipse (md-fab `:host([data-shape="circle"]) { border-radius: 50% }`), so the corner style is .circular.
        return Path(roundedRect:rect,cornerSize:.init(width:initial+(rect.width/2-initial)*circleFraction,
                                                     height:initial+(rect.height/2-initial)*circleFraction),style:.circular)
    }
    func inset(by amount:CGFloat)->Self {var copy=self;copy.insetAmount += amount;return copy}
}
private struct AWCFabMenuIconMotion:ViewModifier {
    let opacity:Double
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    func body(content:Content)->some View {
        content.opacity(opacity).rotationEffect(.degrees(opacity==0 ? -90:0)).scaleEffect(opacity==0 ? 0.6:1)
            .animation(reduceMotion ? nil:.timingCurve(0.2,0,0,1,duration:0.12),value:opacity)
    }
}
private struct AWCFabPartColor: ViewModifier {
    let hex:String?
    @ViewBuilder func body(content:Content)->some View {if let hex {content.foregroundStyle(Color(awcHex:hex))} else {content}}
}
extension AWCNativeView {
    var nativeFab:some View {
        let controller=fabController ?? ownedFabController
        let menu=fabMenuRegistry?.presentations[node.id]
        let tokens=theme.tokens.isEmpty ? AWCGeneratedTokens.light:theme.tokens
        let appearance=menu?.open == true ? fabAppearance.merging(.init(containerColor:tokens["--md-sys-color-"+(menu?.variant ?? "primary")],iconColor:tokens["--md-sys-color-on-"+(menu?.variant ?? "primary")])):fabAppearance
        let slots=AWCNativeFabSlots(node:node,properties:local,menuIcon:controller.menuIcon)
        let metrics=AWCNativeFabMetrics(properties:local,hasIcon:slots.hasIcon,appearance:fabAppearance,tokens:theme.tokens)
        let direction:LayoutDirection=s("dir") == "rtl" ? .rightToLeft:s("dir") == "ltr" ? .leftToRight:layoutDirection
        let palette=AWCNativeFabPalette(variant:s("variant","primary-container"),lowered:b("lowered"))
        let accessibleName=local["aria-label"]?.string ?? local["ariaLabel"]?.string ?? s("label")
        return AWCNativeActionControl(style:{focused,pressed,activation,pointerPressed in
            AWCNativeFabStyle(nodeID:node.id,metrics:metrics,appearance:appearance,theme:theme,palette:palette,disabled:disabled,lowered:b("lowered"),ripple:b("ripple",true),focused:focused,nativePressed:pressed,activation:activation,pointerPressed:pointerPressed,menuCircle:menu?.open == true)
        },policy:AWCButtonAccessibilityPolicy(properties:local),id:node.id,accessibleLabel:accessibleName,action:{source in
            guard !disabled else{return}
            var event=AWCEvent(name:"mdClick",tag:node.tag,nodeID:node.id,detail:.null);event.activation = .init(kind:.nativeControl,source:source)
            onEvent(AWCEventDispatcher.dispatch(event,through:eventDispatcher,cancelable:true,targetListeners:eventTargetListeners).observedEvent)
        },direction:s("dir")) {
            AWCNativeFabLayout(metrics:metrics,fraction:metrics.extended ? 1:0,rtl:direction == .rightToLeft) {
            HStack(spacing:0) {
                ForEach(slots.children) { item in
                    Group {
                        if item.tag == "#symbol" {AWCMaterialSymbol(item.properties["name"]?.string ?? "",size:metrics.iconSize)}
                        else if item.tag == "#slot-text" {Text(item.properties["text"]?.string ?? "").font(AWCNativeFonts.label(size:metrics.hasLabel ? metrics.fontSize:14,weight:metrics.hasLabel ? metrics.fontWeight:400)).tracking(metrics.hasLabel ? metrics.letterSpacing:0)}
                        else {child(item)}
                    }.frame(width:metrics.iconSize,height:metrics.iconSize).environment(\.awcMaterialSymbolSize,metrics.iconSize)
                }
                if !slots.glyph.isEmpty {AWCMaterialSymbol(slots.glyph,size:metrics.iconSize)}
            }.fixedSize().modifier(AWCFabPartColor(hex:appearance.iconColor))
                .modifier(AWCFabMenuIconMotion(opacity:menu?.iconOpacity ?? 1))
                .awcInspect(nodeID:node.id,part:"icon",name:"md-fab ::part(icon)")
                .environment(\.layoutDirection,direction)
            if metrics.hasLabel {
                AWCNativeFabLabelLayout {Text(s("label")).font(AWCNativeFonts.label(size:metrics.fontSize,weight:metrics.fontWeight)).tracking(metrics.letterSpacing).fixedSize().frame(height:metrics.lineHeight)}
                    .clipped().opacity(metrics.extended ? 1:0)
                    .animation(.timingCurve(0.34,0.8,0.34,1,duration:0.2),value:metrics.extended)
                    .modifier(AWCFabPartColor(hex:appearance.labelColor))
                    .awcInspect(nodeID:node.id,part:"label",name:"md-fab ::part(label)")
                    .environment(\.layoutDirection,direction)
            }
            }.environment(\.layoutDirection,.leftToRight)
        }.onAppear {fabMenuRegistry?.fabControllers[node.id]=controller}
            .onDisappear {fabMenuRegistry?.fabControllers[node.id]=nil}
    }
}
