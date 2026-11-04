import SwiftUI
import Accessibility
import CoreText

private struct AWCSnackbarReducedMotionKey:EnvironmentKey{static let defaultValue:Bool?=nil}
extension EnvironmentValues{var awcSnackbarReducedMotion:Bool?{get{self[AWCSnackbarReducedMotionKey.self]}set{self[AWCSnackbarReducedMotionKey.self]=newValue}}}

struct AWCNativeSnackbar:View {
    let node:AWCNode,properties:[String:AWCValue],theme:AWCTheme
    let onEvent:(AWCEvent)->Void,onOpenChanged:(Bool)->Void
    @Environment(\.awcSnackbarController) private var suppliedController
    @Environment(\.awcSnackbarRegistry) private var registry
    @Environment(\.awcSnackbarAppearance) private var appearance
    @Environment(\.awcSnackbarSizingContext) private var context
    @Environment(\.awcSnackbarSlots) private var slots
    @Environment(\.awcSnackbarParts) private var parts
    @Environment(\.awcSnackbarSlotLabels) private var slotLabels
    @Environment(\.awcSnackbarForcedColors) private var forcedColors
    @Environment(\.awcNativeDensity) private var density
    @Environment(\.layoutDirection) private var direction
    @Environment(\.accessibilityReduceMotion) private var systemReduced
    @Environment(\.awcSnackbarReducedMotion) private var reducedOverride
    private var reduced:Bool{reducedOverride ?? systemReduced}
    @State private var ownedController=AWCSnackbarController()
    @State private var registrationID=UUID().uuidString
    private var controller:AWCSnackbarController{suppliedController ?? ownedController}
    private var hidden:Bool{properties["hidden"]?.bool ?? false}
    private var configured:AWCNativeSnackbarSurface{
        .init(node:node,properties:properties,theme:theme,appearance:appearance,context:context,slots:slots,parts:parts,slotLabels:slotLabels,
              forcedColors:forcedColors,density:density,rtl:direction == .rightToLeft,reduced:reduced,controller:controller,onEvent:onEvent)
    }
    @ViewBuilder var body:some View{
        if let registry {
            Color.clear.frame(width:0,height:0)
                .preference(key:AWCSnackbarEntries.self,value:hidden ? []:[.init(id:registrationID,content:AnyView(configured))])
                .onAppear{attach(registry)}
                .onDisappear{registry.unregister(registrationID);controller.detach()}
                .onChange(of:properties){old,new in
                    controller.update(autoHide:new["autoHide"]?.bool ?? true,duration:new["autoHideDuration"]?.number ?? 4000,closeable:new["closeable"]?.bool ?? false)
                    if old["open"] != new["open"]{controller.authoredOpen(new["open"]?.bool ?? false)}
                }
        }else{
            // A standalone component can use its proposed native viewport.
            // A root Scope is required to float over unrelated sibling content.
            AWCSnackbarScope{AWCNativeSnackbar(node:node,properties:properties,theme:theme,onEvent:onEvent,onOpenChanged:onOpenChanged)}
        }
    }
    private func attach(_ registry:AWCSnackbarRegistry){
        registry.register(registrationID,controller)
        controller.attach(initialOpen:properties["open"]?.bool ?? false,autoHide:properties["autoHide"]?.bool ?? true,
                          duration:properties["autoHideDuration"]?.number ?? 4000,closeable:properties["closeable"]?.bool ?? false,
                          emit:{name,detail in onEvent(.init(name:name,tag:node.tag,nodeID:node.id,detail:detail))},
                          changed:onOpenChanged,raised:{registry.raise(registrationID)})
    }
}

struct AWCNativeSnackbarSurface:View {
    let node:AWCNode,properties:[String:AWCValue],theme:AWCTheme,appearance:AWCSnackbarAppearance,context:AWCSnackbarSizingContext
    let slots:[AWCSnackbarSlot:AnyView],parts:[AWCSnackbarPart:AWCSnackbarPartAppearance],slotLabels:[AWCSnackbarSlot:String],forcedColors:Bool,density:Double,rtl:Bool,reduced:Bool,controller:AWCSnackbarController
    let onEvent:(AWCEvent)->Void
    @Environment(\.awcNativePointerState) private var pointer
    @Environment(\.awcNativeFocusChanged) private var inheritedFocusChanged
    @State private var focusedIDs=Set<String>()
    @State private var announcedGeneration = -1
    @State private var announcedMessage:String?
    private func children(_ slot:String?)->[AWCNode]{node.children(inSlot:slot)}
    private var hasMessage:Bool{slots[.message] != nil || !children(nil).isEmpty}
    private var hasAction:Bool{slots[.action] != nil || !children("action").isEmpty || !(properties["action"]?.string ?? "").isEmpty}
    private var hasClose:Bool{slots[.close] != nil || !children("close").isEmpty || properties["closeable"]?.bool==true}
    private var metrics:AWCNativeSnackbarMetrics{.init(properties:properties,density:density,hasAction:hasAction,hasClose:hasClose)}
    private func part(_ key:AWCSnackbarPart)->AWCSnackbarPartAppearance{parts[key] ?? .init()}
    private func text(_ value:String)->AWCNativeMeterText{.init(text:value,size:metrics.fontSize,lineHeight:metrics.lineHeight,weight:part(.message).fontWeight ?? 400,spacing:0.25,tabular:false)}
    private func color(_ key:String,_ fallback:String)->String{theme.tokens["--md-sys-color-"+key] ?? fallback}
    private var messageColor:String{part(.message).color ?? part(.surface).color ?? appearance.messageColor ?? color("inverse-on-surface","#F4EFF4")}
    private var actionColor:String{part(.actions).color ?? appearance.actionColor ?? color("inverse-primary","#D0BCFF")}
    private var closeColor:String{part(.close).color ?? appearance.closeColor ?? color("inverse-on-surface","#F4EFF4")}
    private var messageText:String{slotLabels[.message] ?? (hasMessage ? children(nil).map(\.authoredTextContent).joined(separator:" "):properties["message"]?.string ?? "")}
    private var minimumMessage:Double{
        guard !hasMessage else{return 0}
        return messageText.split(separator:" ").map{text(String($0)).naturalWidth}.max() ?? 0
    }
    private var actionWidth:Double{
        let m=AWCNativeButtonMetrics(size:"sm",density:density,variant:"text",tokens:theme.tokens)
        let text=AWCNativeMeterText(text:properties["action"]?.string ?? "",size:Double(m.fontSize),lineHeight:Double(m.lineHeight),weight:m.fontWeight,spacing:Double(m.letterSpacing),tabular:false)
        // SwiftUI Text rounds its proposed advance to device pixels. The CSS
        // flex row uses fractional glyph advances, so retain that intrinsic
        // border-box width around the same real native action control.
        return max(Double(m.minimumWidth),ceil((text.naturalWidth+Double(m.horizontalPadding)*2)*64)/64)
    }
    private func authoredWeight(_ slot:AWCSnackbarSlot)->Double{
        part(slot == .message ? .message:slot == .action ? .actions:.close).fontWeight ?? (slot == .message ? 400:part(.surface).fontWeight ?? 400)
    }
    private func authoredText(_ value:String,slot:AWCSnackbarSlot)->AWCNativeMeterText{
        if slot == .message{return .init(text:value,size:metrics.fontSize,lineHeight:metrics.lineHeight,weight:authoredWeight(slot),spacing:0.25,tabular:false)}
        let size=context.fontSize,weight=authoredWeight(slot)
        _ = AWCNativeFonts.labelFamily(regular:weight<500)
        let font=CTFontCreateWithName((weight>=600 ? "Roboto-Bold":weight<500 ? "Roboto-Regular":"Roboto-Medium") as CFString,size,nil)
        return .init(text:value,size:size,lineHeight:ceil(Double(CTFontGetAscent(font)+CTFontGetDescent(font)+CTFontGetLeading(font))),weight:weight,spacing:0,tabular:false,usesDefaultKerning:true)
    }
    @ViewBuilder private func authored(_ slot:AWCSnackbarSlot,_ name:String?)->some View{
        Group{
            if let view=slots[slot]{view}
            else{HStack(spacing:0){ForEach(children(name)){item in
                if item.tag=="#text" || item.tag=="#slot-text"{AWCNativeMeterTextView(model:authoredText(item.properties["text"]?.string ?? "",slot:slot),color:Color(awcHex:slot == .action ? appearance.actionColor ?? color("inverse-primary","#D0BCFF"):slot == .close ? appearance.closeColor ?? color("inverse-on-surface","#F4EFF4"):messageColor),wrap:true,center:false)}
                else{AWCNativeView(node:item,onEvent:onEvent)}
            }}}
        }.font(AWCNativeFonts.label(size:slot == .message ? metrics.fontSize:context.fontSize,weight:authoredWeight(slot))).foregroundStyle(Color(awcHex:slot == .action ? appearance.actionColor ?? color("inverse-primary","#D0BCFF"):slot == .close ? appearance.closeColor ?? color("inverse-on-surface","#F4EFF4"):messageColor))
    }
    private var message:some View{
        Group{
            if hasMessage{authored(.message,nil)}
            else{AWCNativeMeterTextView(model:text(messageText),color:Color(awcHex:messageColor),wrap:true,center:false)}
        }.environment(\.layoutDirection,rtl ? .rightToLeft:.leftToRight)
            .font(AWCNativeFonts.label(size:metrics.fontSize,weight:authoredWeight(.message))).foregroundStyle(Color(awcHex:messageColor))
            .padding(.top,metrics.messageTop).padding(.bottom,metrics.messageBottom)
            .frame(maxWidth:.infinity,alignment:.leading)
            .modifier(AWCNativeSnackbarPartDecoration(value:part(.message)))
            .awcInspect(nodeID:node.id,part:"message",name:"md-snackbar ::part(message)"){_ in
                ["padding":[.number(metrics.messageTop),0,.number(metrics.messageBottom),0],"typography":text(messageText).inspection,"direction":.string(rtl ? "rtl":"ltr")]
            }.accessibilityHidden(!hasMessage).padding(.leading,part(.message).marginInlineStart ?? 0).environment(\.layoutDirection,rtl ? .rightToLeft:.leftToRight)
    }
    private var action:some View{
        Group{
            if slots[.action] != nil || !children("action").isEmpty{authored(.action,"action")}
            else{
                AWCNativeView(node:.init(id:node.id+"-action",tag:"md-button",properties:["variant":"text","size":"sm","density":.number(density)],children:[.text(properties["action"]?.string ?? "")])){event in
                    if event.name=="mdClick"{controller.activateAction()}
                }.environment(\.awcButtonAppearance,.init(labelColor:appearance.actionColor ?? color("inverse-primary","#D0BCFF"),iconColor:appearance.actionColor ?? color("inverse-primary","#D0BCFF"),stateLayerColor:appearance.actionColor ?? color("inverse-primary","#D0BCFF"),width:actionWidth))
            }
        }.environment(\.layoutDirection,rtl ? .rightToLeft:.leftToRight)
            .foregroundStyle(Color(awcHex:actionColor)).modifier(AWCNativeSnackbarPartDecoration(value:part(.actions))).awcInspect(nodeID:node.id,part:"actions",name:"md-snackbar ::part(actions)").padding(.leading,part(.actions).marginInlineStart ?? 0).environment(\.layoutDirection,rtl ? .rightToLeft:.leftToRight)
    }
    private var close:some View{
        Group{
            if slots[.close] != nil || !children("close").isEmpty{authored(.close,"close")}
            else{
                AWCNativeView(node:.init(id:node.id+"-close",tag:"md-icon-button",properties:["variant":"standard","icon":"close","ariaLabel":properties["dismissLabel"] ?? "Dismiss","density":.number(density)])){event in
                    if event.name=="mdClick"{controller.requestRippleDismiss()}
                }.environment(\.awcIconButtonAppearance,.init(iconColor:"#00000000",stateLayerColor:closeColor,iconSize:max(18,24+density),width:max(32,40+4*density),height:max(32,40+4*density)))
                    .overlay{
                        AWCMaterialSymbol("close",size:max(18,24+density)).foregroundStyle(Color(awcHex:part(.closeIcon).color ?? appearance.closeColor ?? color("inverse-on-surface","#F4EFF4")))
                            .modifier(AWCNativeSnackbarPartDecoration(value:part(.closeIcon)))
                            .awcInspect(nodeID:node.id,part:"close-icon",parentPart:"close",name:"md-snackbar ::part(close-icon)")
                            .padding(.leading,part(.closeIcon).marginInlineStart ?? 0)
                            .environment(\.layoutDirection,rtl ? .rightToLeft:.leftToRight).allowsHitTesting(false)
                    }
            }
        }.environment(\.layoutDirection,rtl ? .rightToLeft:.leftToRight).foregroundStyle(Color(awcHex:closeColor)).modifier(AWCNativeSnackbarPartDecoration(value:part(.close))).awcInspect(nodeID:node.id,part:"close",name:"md-snackbar ::part(close)").padding(.leading,part(.close).marginInlineStart ?? 0).environment(\.layoutDirection,rtl ? .rightToLeft:.leftToRight)
    }
    private var surfacePart:AWCSnackbarPartAppearance{forcedColors ? part(.surface).merging(.init(borderWidth:1)):part(.surface)}
    private func surface(_ viewport:CGSize)->some View{
        let m=metrics,corners=part(.surface).cornerShape ?? appearance.containerShape ?? .points(4),shape=AWCNativeCornerShape(corners:corners)
        return AWCNativeSnackbarLayout(metrics:m,appearance:appearance,context:context,viewport:viewport,rtl:rtl,messageMinimum:minimumMessage,surfacePart:surfacePart){
            message
            if hasAction{action}
            if hasClose{close}
        }.environment(\.layoutDirection,.leftToRight)
            .background{
                AWCNativeSnackbarShadow(corners:corners)
                shape.fill(Color(awcHex:part(.surface).backgroundColor ?? appearance.containerColor ?? color("inverse-surface","#313033")))
            }
            .overlay{if forcedColors{shape.strokeBorder(Color.primary,lineWidth:1)}else if let width=part(.surface).borderWidth,width>0{shape.strokeBorder(Color(awcHex:part(.surface).borderColor ?? messageColor),lineWidth:width)}}
            .awcInspect(nodeID:node.id,part:"surface",name:"md-snackbar ::part(surface)"){_ in
                ["padding":[.number(m.stacked ? m.insetSmall:0),.number(rtl ? m.start:m.end),.number(m.stacked ? m.insetSmall:0),.number(rtl ? m.end:m.start)],"gap":["row":.number(m.stacked ? 6:0),"column":.number(m.stacked ? m.columnGap:0)],"display":.string(m.stacked ? "SwiftUI grid layout":"SwiftUI flex layout"),"direction":.string(rtl ? "rtl":"ltr")]
            }
            .background{GeometryReader{geometry in
                let bounds=geometry.frame(in:.named("awc-native-preview"))
                let inside=pointer?.location.map{bounds.contains($0)} ?? false
                Color.clear.onChange(of:inside){_,inside in if inside{controller.pointerEntered()}else{controller.pointerExited()}}
            }.allowsHitTesting(false)}
            .background{AWCSnackbarFocusObserver(enabled:controller.isOpen){inside in if inside{controller.focusEntered()}else{controller.focusLeftSurface()}}}
            .onHover{hover in if hover{controller.pointerEntered()}else{controller.pointerExited()}}
            .environment(\.awcNativeFocusChanged,{id,active in
                if active{focusedIDs.insert(id);controller.focusEntered()}
                else{focusedIDs.remove(id);Task { @MainActor in await Task.yield();if focusedIDs.isEmpty{controller.focusLeftSurface()} }}
                inheritedFocusChanged?(id,active)
            })
            .allowsHitTesting(controller.isOpen)
    }
    var body:some View{
        GeometryReader{geometry in
            let m=metrics,offset=m.position.hasPrefix("top") ? -geometry.size.height:m.position.hasPrefix("bottom") ? geometry.size.height:0
            AWCNativeSnackbarPlacement(metrics:m,viewport:geometry.size,rtl:rtl,margin:part(.surface).marginInlineStart ?? 0){surface(geometry.size)}
                .environment(\.layoutDirection,.leftToRight)
                .accessibilityElement(children:.contain)
                .background{AWCSnackbarStatusBridge(id:node.id,label:messageText,enabled:controller.isOpen,assertive:properties["politeness"]?.string=="assertive")}
                .accessibilityHidden(!controller.isOpen)
                .awcInspect(nodeID:node.id,name:node.tag){_ in ["padding":.array(Array(repeating:.number(m.inset(Double(geometry.size.width))),count:4)),"display":"SwiftUI fixed overlay","direction":.string(rtl ? "rtl":"ltr")]}
                .offset(y:controller.isOpen ? 0:offset).opacity(controller.isOpen ? 1:0)
                .animation(reduced ? nil:controller.isOpen ? .timingCurve(0.05,0.7,0.1,1,duration:0.25):.timingCurve(0.3,0,0.8,0.15,duration:0.2),value:controller.isOpen)
        }.environment(\.layoutDirection,rtl ? .rightToLeft:.leftToRight)
            .onAppear{if controller.isOpen{announce()}}
            .onChange(of:controller.openGeneration){_,_ in announce()}
            .onChange(of:messageText){_,_ in if controller.isOpen{announce()}}
    }
    private func announce(){
        guard !messageText.isEmpty,announcedGeneration != controller.openGeneration || announcedMessage != messageText else{return}
        announcedGeneration=controller.openGeneration;announcedMessage=messageText
        var text=AttributedString(messageText)
        text.accessibilitySpeechAnnouncementPriority=properties["politeness"]?.string=="assertive" ? .high:.low
        AccessibilityNotification.Announcement(text).post()
    }
}

/// CSS outer box shadows are knocked out inside the border box. SwiftUI's
/// regular shadow modifier would darken a translucent container from behind.
private struct AWCNativeSnackbarShadow:View {
    let corners:AWCCornerShape
    var body:some View{
        GeometryReader{geometry in
            Canvas{context,size in
                let box=CGRect(x:24,y:24,width:geometry.size.width,height:geometry.size.height)
                let shape=AWCNativeCornerShape(corners:corners)
                var outside=Path(CGRect(origin:.zero,size:size));outside.addPath(shape.path(in:box))
                context.clip(to:outside,style:.init(eoFill:true))
                for (spread,blur,dy,alpha) in [(3.0,4.0,4.0,0.15),(0.0,1.5,1.0,0.3)] {
                    context.drawLayer{layer in
                        layer.addFilter(.blur(radius:blur))
                        layer.fill(shape.path(in:box.insetBy(dx:-spread,dy:-spread).offsetBy(dx:0,dy:dy)),with:.color(.black.opacity(alpha)))
                    }
                }
            }.frame(width:geometry.size.width+48,height:geometry.size.height+48).offset(x:-24,y:-24)
        }.allowsHitTesting(false)
    }
}

