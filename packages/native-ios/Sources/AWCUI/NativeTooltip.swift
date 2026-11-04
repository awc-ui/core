import SwiftUI

private struct AWCTooltipReducedMotionKey:EnvironmentKey{static let defaultValue:Bool?=nil}
private struct AWCTooltipDescriptionKey:EnvironmentKey{static let defaultValue:String?=nil}
extension EnvironmentValues{
    var awcTooltipReducedMotion:Bool?{get{self[AWCTooltipReducedMotionKey.self]}set{self[AWCTooltipReducedMotionKey.self]=newValue}}
    var awcTooltipDescription:String?{get{self[AWCTooltipDescriptionKey.self]}set{self[AWCTooltipDescriptionKey.self]=newValue}}
}
struct AWCNativeTooltip:View{
    let node:AWCNode,properties:[String:AWCValue],theme:AWCTheme,onEvent:(AWCEvent)->Void,onOpenChanged:(Bool)->Void
    @Environment(\.awcTooltipController) private var suppliedController
    @Environment(\.awcTooltipRegistry) private var registry
    @Environment(\.awcTooltipAppearance) private var appearance
    @Environment(\.awcTooltipSizingContext) private var context
    @Environment(\.awcTooltipSlots) private var slots
    @Environment(\.awcTooltipTexts) private var texts
    @Environment(\.awcTooltipSlotLabels) private var labels
    @Environment(\.awcTooltipParts) private var parts
    @Environment(\.awcTooltipForcedColors) private var forced
    @Environment(\.awcNativeDensity) private var density
    @Environment(\.layoutDirection) private var direction
    @Environment(\.accessibilityReduceMotion) private var systemReduced
    @Environment(\.awcTooltipReducedMotion) private var reducedOverride
    @Environment(\.awcNativePointerState) private var pointer
    @State private var ownedController=AWCTooltipController()
    @State private var focus=AWCNativeTooltipFocusContext()
    @State private var registrationID=UUID().uuidString
    private var controller:AWCTooltipController{suppliedController ?? ownedController}
    private var disabled:Bool{properties["disabled"]?.bool ?? false}
    private func descriptionPart(_ slot:AWCTooltipSlot,_ name:String,_ fallback:String)->String{
        if let text=texts[slot]{return text}
        if slots[slot] != nil{return labels[slot] ?? ""}
        let children=node.children(inSlot:name)
        return children.isEmpty ? properties[fallback]?.string ?? "":children.map(\.authoredTextContent).joined(separator:" ")
    }
    private var description:String{
        guard !disabled else{return ""}
        if properties["variant"]?.string != "rich"{return properties["text"]?.string ?? ""}
        return [descriptionPart(.subhead,"subhead","subhead"),descriptionPart(.content,"content","text")].filter{!$0.isEmpty}.joined(separator:". ")
    }
    @ViewBuilder private var anchor:some View{
        if let text=texts[.anchor]{Text(text)}
        else if let authored=slots[.anchor]{authored}
        else{HStack(spacing:0){ForEach(node.children(inSlot:nil)){AWCNativeView(node:$0,onEvent:onEvent)}}}
    }
    private func popup(_ anchor:CGRect,_ viewport:CGSize)->AnyView{
        AnyView(AWCNativeTooltipPopup(node:node,properties:properties,theme:theme,appearance:appearance,context:context,slots:slots,texts:texts,parts:parts,density:density,rtl:direction == .rightToLeft,forced:forced,reduced:reducedOverride ?? systemReduced,anchor:anchor,viewport:viewport,controller:controller,focus:focus,description:description,onEvent:onEvent))
    }
    @ViewBuilder var body:some View{
        if properties["hidden"]?.bool==true{Color.clear.frame(width:0,height:0).awcInspectionAbsent().accessibilityHidden(true)}
        else{configuredAnchor}
    }
    private var configuredAnchor:some View{
        anchor
            .environment(\.awcTooltipDescription,description.isEmpty ? nil:description)
            .accessibilityHint(description)
            .background{AWCTooltipRegionBridge(context:focus,controller:controller,anchor:true,enabled:!disabled,description:description)}
            .background{GeometryReader{geometry in let inside=pointer?.location.map{geometry.frame(in:.named("awc-native-preview")).contains($0)} ?? false
                Color.clear.onChange(of:inside){_,inside in if inside{controller.triggerEntered()}else{controller.triggerExited()}}
            }.allowsHitTesting(false)}
            .onHover{inside in if inside{controller.triggerEntered()}else{controller.triggerExited()}}
            .simultaneousGesture(LongPressGesture(minimumDuration:0.5).onEnded{_ in Task{@MainActor in await controller.show()}})
            .anchorPreference(key:AWCTooltipEntries.self,value:.bounds){[.init(id:registrationID,anchor:$0,content:popup)]}
            .awcInspect(nodeID:node.id,name:node.tag){_ in ["display":"SwiftUI inline anchor","description":.string(description)]}
            .onAppear{
                registry?.controllers[registrationID]=controller
                controller.attach(initialOpen:properties["open"]?.bool ?? false,disabled:disabled,showDelay:properties["showDelay"]?.number ?? 500,hideDelay:properties["hideDelay"]?.number ?? 200,emit:{name,detail in onEvent(.init(name:name,tag:node.tag,nodeID:node.id,detail:detail))},changed:onOpenChanged)
                controller.hasOwnedFocus={focus.hasOwnedFocus()};controller.restoreTriggerFocus={focus.restore()}
            }
            .onDisappear{registry?.controllers[registrationID]=nil;controller.detach()}
            .onChange(of:properties){old,new in
                controller.update(disabled:new["disabled"]?.bool ?? false,showDelay:new["showDelay"]?.number ?? 500,hideDelay:new["hideDelay"]?.number ?? 200)
                if old["open"] != new["open"]{controller.authoredOpen(new["open"]?.bool ?? false)}
            }
            .onChange(of:node.children(inSlot:nil)){_,children in if children.isEmpty && slots[.anchor]==nil{controller.anchorRemoved()}}
    }
}
private struct AWCNativeTooltipPopup:View{
    let node:AWCNode,properties:[String:AWCValue],theme:AWCTheme,appearance:AWCTooltipAppearance,context:AWCTooltipSizingContext,slots:[AWCTooltipSlot:AnyView],texts:[AWCTooltipSlot:String],parts:[AWCTooltipPart:AWCTooltipPartAppearance],density:Double,rtl:Bool,forced:Bool,reduced:Bool,anchor:CGRect,viewport:CGSize,controller:AWCTooltipController,focus:AWCNativeTooltipFocusContext,description:String,onEvent:(AWCEvent)->Void
    @Environment(\.awcNativePointerState) private var pointer
    @State private var measuredSize=CGSize.zero
    private var metrics:AWCNativeTooltipMetrics{.init(properties:properties,density:density)}
    private func part(_ value:AWCTooltipPart)->AWCTooltipPartAppearance{parts[value] ?? .init()}
    private func color(_ key:String,_ fallback:String)->String{theme.tokens["--md-sys-color-"+key] ?? fallback}
    private var background:String{part(.popup).backgroundColor ?? (metrics.rich ? appearance.richContainerColor ?? color("surface-container","#F3EDF7"):appearance.plainContainerColor ?? color("inverse-surface","#313033"))}
    private var ink:String{part(.popup).color ?? (metrics.rich ? appearance.richTextColor ?? color("on-surface-variant","#49454F"):appearance.plainTextColor ?? color("inverse-on-surface","#F4EFF4"))}
    private var shape:AWCCornerShape{part(.popup).cornerShape ?? (metrics.rich ? appearance.richShape ?? .points(12):appearance.plainShape ?? .points(4))}
    private var hasHeading:Bool{texts[.subhead] != nil || slots[.subhead] != nil || !node.children(inSlot:"subhead").isEmpty || !(properties["subhead"]?.string ?? "").isEmpty}
    private var hasActions:Bool{texts[.actions] != nil || slots[.actions] != nil || !node.children(inSlot:"actions").isEmpty}
    private var popupPart:AWCTooltipPartAppearance{forced ? part(.popup).merging(.init(borderWidth:1)):part(.popup)}
    private func textAppearance(_ p:AWCTooltipPart)->AWCTooltipPartAppearance{metrics.rich ? part(p):part(.popup).merging(part(p))}
    @ViewBuilder private func authored(_ slot:AWCTooltipSlot,_ name:String,_ model:AWCNativeMeterText,_ color:String)->some View{
        if let text=texts[slot]{AWCNativeMeterTextView(model:.init(text:text,size:model.size,lineHeight:model.lineHeight,weight:model.weight,spacing:model.spacing,tabular:false),color:Color(awcHex:color),wrap:true,center:false)}
        else if let view=slots[slot]{HStack(spacing:slot == .actions ? metrics.actionsGap:0){view}.font(AWCNativeFonts.label(size:model.size,weight:model.weight)).tracking(model.spacing).foregroundStyle(Color(awcHex:color))}
        else{HStack(spacing:slot == .actions ? metrics.actionsGap:0){ForEach(node.children(inSlot:name)){child in
            if child.tag=="#text" || child.tag=="#slot-text"{AWCNativeMeterTextView(model:.init(text:child.properties["text"]?.string ?? "",size:model.size,lineHeight:model.lineHeight,weight:model.weight,spacing:model.spacing,tabular:false),color:Color(awcHex:color),wrap:true,center:false)}
            else{AWCNativeView(node:child,onEvent:onEvent)}
        }}}
    }
    private func boxInspection(_ p:AWCTooltipPart)->[String:AWCValue]{
        let style=p == .popup ? popupPart:part(p),border=style.borderWidth ?? 0
        let start=style.paddingInlineStart ?? (p == .popup ? metrics.start:0),end=p == .popup ? metrics.start:0
        let top=p == .popup ? metrics.top:0,bottom=p == .popup ? metrics.bottom:0,margin=style.marginInlineStart ?? 0
        return ["padding":[.number(top),.number(rtl ? start:end),.number(bottom),.number(rtl ? end:start)],
                "border":.array(Array(repeating:.number(border),count:4)),
                "margin":[.number(p == .actions ? metrics.actionsTop:0),.number(rtl ? margin:0),.number(p == .subhead ? metrics.headingGap:0),.number(rtl ? 0:margin)],
                "direction":.string(rtl ? "rtl":"ltr")]
    }
    private func textPart(_ p:AWCTooltipPart,_ slot:AWCTooltipSlot?,_ name:String?,_ fallback:String,heading:Bool=false)->some View{
        let style=textAppearance(p),model=metrics.text(fallback,heading:heading,part:style)
        let color=part(p).color ?? (heading ? appearance.richSubheadColor ?? self.color("on-surface-variant","#49454F"):metrics.rich ? appearance.richTextColor ?? self.color("on-surface-variant","#49454F"):ink)
        return Group{
            if let slot,let name,texts[slot] != nil || slots[slot] != nil || !node.children(inSlot:name).isEmpty{authored(slot,name,model,color)}
            else{AWCNativeMeterTextView(model:model,color:Color(awcHex:color),wrap:true,center:false)}
        }.frame(maxWidth:.infinity,alignment:.leading)
            .modifier(AWCNativeSnackbarPartDecoration(value:part(p).decoration))
            .awcInspect(nodeID:node.id,part:p == .supportingText ? "supporting-text":String(describing:p),name:node.tag){_ in var values=boxInspection(p);values["typography"]=model.inspection;return values}
            .padding(.leading,part(p).marginInlineStart ?? 0).environment(\.layoutDirection,rtl ? .rightToLeft:.leftToRight)
    }
    private var actions:some View{
        let style=part(.popup).merging(part(.actions)),size=style.fontSize ?? context.fontSize
        let model=AWCNativeMeterText(text:"",size:size,lineHeight:style.lineHeight ?? ceil(size*1.171875),weight:style.fontWeight ?? 400,spacing:style.letterSpacing ?? 0,tabular:false,usesDefaultKerning:true)
        return authored(.actions,"actions",model,appearance.richActionColor ?? color("primary","#6750A4"))
            .frame(maxWidth:.infinity,alignment:.trailing)
            .modifier(AWCNativeSnackbarPartDecoration(value:part(.actions).decoration))
            .awcInspect(nodeID:node.id,part:"actions",name:node.tag){_ in var values=boxInspection(.actions);values["typography"]=model.inspection;values["gap"]=["row":.number(metrics.actionsGap),"column":.number(metrics.actionsGap)];return values}
            .padding(.leading,part(.actions).marginInlineStart ?? 0).environment(\.layoutDirection,rtl ? .rightToLeft:.leftToRight)
    }
    private var surface:some View{
        AWCNativeTooltipLayout(metrics:metrics,appearance:appearance,context:context,viewport:viewport,hasHeading:metrics.rich && hasHeading,hasActions:metrics.rich && hasActions,rtl:rtl,part:popupPart,minimumTextWidth:metrics.rich ? 0:metrics.text(properties["text"]?.string ?? "",part:textAppearance(.text)).visible.map{metrics.text(String($0),part:textAppearance(.text)).naturalWidth}.max() ?? 0){
            if metrics.rich{
                if hasHeading{textPart(.subhead,.subhead,"subhead",properties["subhead"]?.string ?? "",heading:true)}
                textPart(.supportingText,.content,"content",properties["text"]?.string ?? "")
                if hasActions{actions}
            }else{textPart(.text,nil,nil,properties["text"]?.string ?? "")}
        }.environment(\.layoutDirection,.leftToRight)
            .background{AWCNativeCornerShape(corners:shape).fill(Color(awcHex:background))}
            .background{if metrics.rich && !forced{AWCNativeTooltipShadow(corners:shape,source:theme.tokens["--md-sys-elevation-2"] ?? "")}}
            .overlay{if let width=popupPart.borderWidth,width>0{AWCNativeCornerShape(corners:shape).strokeBorder(forced ? .primary:Color(awcHex:popupPart.borderColor ?? ink),lineWidth:width)}}
            .awcInspect(nodeID:node.id,part:"popup",name:node.tag){_ in var values=boxInspection(.popup);values["display"] = .string(metrics.rich ? "SwiftUI block":"SwiftUI flex");return values}
            .background{GeometryReader{g in Color.clear.onChange(of:g.size,initial:true){_,size in measuredSize=size}}}
            .background{AWCTooltipRegionBridge(context:focus,controller:controller,anchor:false,enabled:controller.isVisible,description:description)}
            .background{GeometryReader{geometry in let inside=pointer?.location.map{geometry.frame(in:.named("awc-native-preview")).contains($0)} ?? false
                Color.clear.onChange(of:inside){_,inside in if inside{controller.popupEntered()}else{controller.popupExited()}}
            }.allowsHitTesting(false)}
            .onHover{inside in if inside{controller.popupEntered()}else{controller.popupExited()}}
            .allowsHitTesting(controller.isVisible).accessibilityHidden(!controller.isVisible)
    }
    var body:some View{
        let scale = reduced || controller.isVisible ? 1.0:0.9
        let position=AWCNativeTooltipPosition.resolve(anchor:anchor,popup:measuredSize,viewport:viewport,properties:properties,rtl:rtl)
        let margin=rtl ? 0:popupPart.marginInlineStart ?? 0
        let pivot=UnitPoint(x:(position.origin.x+margin+position.animationAnchor.x*measuredSize.width)/max(1,viewport.width),y:(position.origin.y+position.animationAnchor.y*measuredSize.height)/max(1,viewport.height))
        // Transform the stable viewport, not the intrinsic popup: compositing an
        // intrinsic SwiftUI surface rounds its layout box to device pixels.
        return AWCNativeTooltipPlacement(anchor:anchor,viewport:viewport,properties:properties,rtl:rtl,physicalLeftMargin:margin){surface}
            .compositingGroup().scaleEffect(scale,anchor:pivot).opacity(controller.isVisible ? 1:0)
            .animation(reduced ? nil:.timingCurve(0.2,0,0,1,duration:0.1),value:controller.isVisible)
            .environment(\.layoutDirection,.leftToRight)
    }
}
private struct AWCNativeTooltipPlacement:Layout{
    let anchor:CGRect,viewport:CGSize,properties:[String:AWCValue],rtl:Bool,physicalLeftMargin:Double
    func sizeThatFits(proposal:ProposedViewSize,subviews:Subviews,cache:inout())->CGSize{viewport}
    func placeSubviews(in bounds:CGRect,proposal:ProposedViewSize,subviews:Subviews,cache:inout()){
        guard let view=subviews.first else{return};let size=view.sizeThatFits(.unspecified),position=AWCNativeTooltipPosition.resolve(anchor:anchor,popup:size,viewport:viewport,properties:properties,rtl:rtl)
        view.place(at:.init(x:bounds.minX+position.origin.x+physicalLeftMargin,y:bounds.minY+position.origin.y),proposal:.init(size))
    }
}

private struct AWCNativeTooltipShadow:View{
    let corners:AWCCornerShape,source:String
    private var alphas:[Double]{
        let regex=try! NSRegularExpression(pattern:"rgba\\([^)]*,\\s*([0-9.]+)\\)")
        let values=regex.matches(in:source,range:NSRange(source.startIndex...,in:source)).compactMap{match in Range(match.range(at:1),in:source).flatMap{Double(source[$0])}}
        return values.count==2 ? values:[0.3,0.15]
    }
    var body:some View{GeometryReader{geometry in
        Canvas{context,size in
            let box=CGRect(x:20,y:20,width:geometry.size.width,height:geometry.size.height),shape=AWCNativeCornerShape(corners:corners)
            var outside=Path(CGRect(origin:.zero,size:size));outside.addPath(shape.path(in:box));context.clip(to:outside,style:.init(eoFill:true))
            for (spread,blur,dy,alpha) in [(2.0,3.0,2.0,alphas[1]),(0.0,1.0,1.0,alphas[0])]{context.drawLayer{layer in
                layer.addFilter(.blur(radius:blur));layer.fill(shape.path(in:box.insetBy(dx:-spread,dy:-spread).offsetBy(dx:0,dy:dy)),with:.color(.black.opacity(alpha)))
            }}
        }.frame(width:geometry.size.width+40,height:geometry.size.height+40).offset(x:-20,y:-20)
    }.allowsHitTesting(false)}
}
