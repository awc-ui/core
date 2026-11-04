import AppKit
import SwiftUI
import Observation
@testable import AWCUI

@Observable final class SplitFixtureState {
    var node=AWCNode(id:"split",tag:"md-split-button",properties:["label":"Create project","icon":"add"])
    var appearance=AWCSplitButtonAppearance()
    var width:CGFloat?
    var rtl=false
    var epoch=0
    var inspected:[AWCNativeInspectionNode]=[]
    var events:[AWCEvent]=[]
    var checked:Bool?
    var cancel=false
    var showPopup=false
    var popupID="actions"
    var actionLabel="Move to popup"
    var tokens:[String:String]=[:]
    let pointer=AWCNativePointerState()
}
struct SplitFixture:View {
    let state:SplitFixtureState
    var body:some View {
        let epoch=state.epoch
        AWCPopupScope(focusActionLabel:state.actionLabel) {
            VStack(spacing:20){
                AWCNativeView(node:state.node,onEvent:{state.events.append($0)})
                    .awcSplitButtonAppearance(state.appearance)
                    .awcSplitButtonChecked(rootID:state.node.id){state.checked=$0}
                    .awcNativeInspection(rootID:state.node.id,coordinateSpace:"awc-native-preview"){if state.epoch==epoch{state.inspected=$0}}
                    .environment(\.awcEventTargetListeners,[.init(handler:{if state.cancel{$0.preventDefault()}})])
                    .frame(width:state.width)
                if state.showPopup{AWCPopupTargetScope(id:state.popupID) {AWCNativeView(node:AWCNode(id:"popup-action",tag:"md-button",properties:["label":"Popup action"]))}}
            }.id(epoch)
        }.padding(24).frame(width:640,height:300).background(Color.white)
            .awcTheme(.generated(tokens:state.tokens)).environment(\.colorScheme,.light)
            .environment(\.layoutDirection,state.rtl ? .rightToLeft:.leftToRight)
            .environment(\.awcNativePointerState,state.pointer)
            .transaction{$0.disablesAnimations=true}.coordinateSpace(name:"awc-native-preview")
    }
}
@main @MainActor enum NativeSplitButtonViewIntegration {
    static var checks=0,failures:[String]=[]
    static let state=SplitFixtureState()
    static var host:NSHostingView<SplitFixture>!,window:NSWindow!
    static func check(_ value:Bool,_ message:String){checks += 1;if !value{failures.append(message);print("FAIL: "+message)}}
    static func near(_ a:CGFloat,_ b:Double,_ tolerance:Double=0.8)->Bool{a.isFinite && abs(Double(a)-b)<tolerance}
    static func pump(_ seconds:Double=0.1){let end=Date().addingTimeInterval(seconds);while Date()<end{while let e=NSApp.nextEvent(matching:.any,until:Date(),inMode:.default,dequeue:true){NSApp.sendEvent(e)};host?.layoutSubtreeIfNeeded();host?.displayIfNeeded();_ = RunLoop.current.run(mode:.default,before:Date().addingTimeInterval(0.003))}}
    static func descendants(_ view:NSView)->[NSView]{[view]+view.subviews.flatMap(descendants)}
    static func responder(_ suffix:String)->AWCNativeButtonFocusView?{let id=suffix=="popup-action" ? suffix:state.node.id+"."+suffix;return descendants(host).compactMap{$0 as? AWCNativeButtonFocusView}.last{$0.configuration?.id==id}}
    static func measured(_ part:String="component")->AWCNativeInspectionNode?{state.inspected.first{$0.id==part}}
    static func bounds(_ part:String="component")->CGRect{measured(part)?.bounds ?? .null}
    static func install(_ properties:[String:AWCValue]=[:],children:[AWCNode]=[],appearance:AWCSplitButtonAppearance = .init(),width:CGFloat?=nil){
        state.epoch += 1;state.node=AWCNode(id:"split-\(state.epoch)",tag:"md-split-button",properties:properties,children:children)
        state.appearance=appearance;state.width=width;state.rtl=properties["dir"]?.string=="rtl";state.events=[];state.checked=nil;state.inspected=[];state.cancel=false;state.showPopup=false;state.popupID="actions";state.actionLabel="Move to popup";state.tokens=[:]
        state.pointer.update(phase:.cancel);_ = window.makeFirstResponder(nil);pump()
    }
    static func key(_ part:String,_ code:UInt16=36,_ chars:String="\r"){
        guard let view=responder(part) else{check(false,"Missing responder \(part)");return}
        _ = view.requestNativeFocus()
        view.keyDown(with:NSEvent.keyEvent(with:.keyDown,location:.zero,modifierFlags:[],timestamp:0,windowNumber:window.windowNumber,context:nil,characters:chars,charactersIgnoringModifiers:chars,isARepeat:false,keyCode:code)!)
        pump()
    }
    static func pixels(_ rect:CGRect?=nil)->[UInt8]{
        let area=rect ?? host.bounds
        let bitmap=host.bitmapImageRepForCachingDisplay(in:area)!;host.cacheDisplay(in:area,to:bitmap)
        let image=bitmap.cgImage!;var bytes=[UInt8](repeating:0,count:image.width*image.height*4)
        bytes.withUnsafeMutableBytes{raw in let context=CGContext(data:raw.baseAddress,width:image.width,height:image.height,bitsPerComponent:8,bytesPerRow:image.width*4,space:CGColorSpace(name:CGColorSpace.sRGB)!,bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue)!;context.draw(image,in:.init(x:0,y:0,width:image.width,height:image.height))};return bytes
    }
    static func count(_ hex:String,_ bytes:[UInt8])->Int{
        let value=UInt32(hex.dropFirst(),radix:16)!,rgb=[Int(value>>16),Int((value>>8)&255),Int(value&255)]
        return stride(from:0,to:bytes.count,by:4).reduce(0){sum,i in sum+((0..<3).allSatisfy{abs(Int(bytes[i+$0])-rgb[$0])<=3} ? 1:0)}
    }
    static func contracts(){
        let colors=AWCSplitButtonAppearance(containerColor:"#aabbcc",labelColor:"bad",cornerRadius:-1,iconSize:.infinity)
        check(colors.containerColor=="#AABBCC" && colors.labelColor==nil && colors.cornerRadius==nil && colors.iconSize==nil,"Typed hooks validate finite lengths and colors")
        let merged=AWCSplitButtonAppearance(containerColor:"#123456",iconSize:28).merging(.init(labelColor:"#ABCDEF"))
        check(merged.iconSize==28 && merged.containerColor=="#123456" && merged.labelColor=="#ABCDEF","Local hooks preserve unspecified inherited values")
        for size in ["xs","sm","md","lg","xl"]{for d in -4...0{
            let m=AWCNativeSplitMetrics(properties:["size":.string(size),"density":.number(Double(d))],inheritedDensity:0,appearance:.init(),tokens:AWCGeneratedTokens.light)
            let index=["xs","sm","md","lg","xl"].firstIndex(of:size)!
            check(m.outer==[16,20,28,48,68][index] && m.trailingIcon==[22,22,26,38,50][index],"\(size)/\(d) fixed base radius/trailing glyph independent of density")
        }}
        let original=AWCNode(tag:"md-split-button",properties:["label":"Create"])
        let slotted=try! AWCPreviewSlots.applying(["":"extra"],to:original)
        check(slotted.properties["label"]=="Create" && slotted.children.first?.authoredTextContent=="extra","Preview default slot is additive and never masks label")
    }
    static func oracle(){
        let url=URL(fileURLWithPath:#filePath).deletingLastPathComponent().appendingPathComponent("Fixtures/split-button-web-geometry.json")
        let document=try! JSONDecoder().decode(AWCValue.self,from:Data(contentsOf:url))
        for entry in document["results"].array{
            let f=entry["fixture"],id=f["id"].string
            var properties=f.object;for key in ["id","content","style","width"]{properties[key]=nil}
            let children=f.object["content"].map{[AWCNode.text($0.string)]} ?? []
            install(properties,children:children,appearance:.init(values:f["style"].object),width:f.object["width"]?.number.map{CGFloat($0)})
            for part in ["host","leading","trailing"]{
                let actual=bounds(part=="host" ? "component":"component."+part),web=entry[part]
                check(near(actual.width,web["width"].number!),"\(id) \(part) width \(actual.width) vs Web \(web["width"])")
                check(near(actual.height,web["height"].number!,0.01),"\(id) \(part) height")
            }
            for part in ["icon","trailingIcon","label"]{
                guard case .object=entry[part] else{continue}
                let actual=bounds("component."+(part=="trailingIcon" ? "trailing-icon":part)),web=entry[part]
                if part != "label" {check(near(actual.width,web["width"].number!,0.01),"\(id) \(part) real glyph box")}
                check(near(actual.height,web["height"].number!,0.01),"\(id) \(part) real line/glyph height")
            }
            for part in ["leading","trailing"]{
                let metrics=measured("component."+part)?.metrics ?? [:],web=entry[part]
                let half=bounds("component."+part),layer=bounds("component."+part+"-state-layer"),border=properties["variant"]?.string=="outlined" ? 1.0:0
                if properties["disabled"]?.bool==true || properties["softDisabled"]?.bool==true {check(measured("component."+part+"-state-layer")==nil,"\(id) disabled state-layer is absent")} else {check(near(layer.width,Double(half.width)-2*border,0.01) && near(layer.height,Double(half.height)-2*border,0.01) && near(layer.minX-half.minX,border,0.01),"\(id) \(part) state-layer is actual padding-box geometry")}
                let expected=Double(web["fontSize"].string.replacingOccurrences(of:"px",with:""))
                check(metrics["typography"]?["size"].number==expected,"\(id) \(part) actual font size")
                let p=web["padding"].string.split(separator:" ").compactMap{Double($0.replacingOccurrences(of:"px",with:""))}
                if p.count==4{check(metrics["padding"]?.array.compactMap(\.number)==p,"\(id) \(part) actual CSS logical padding")}
            }
            let leading=bounds("component.leading"),trailing=bounds("component.trailing")
            check(near(state.rtl ? leading.minX-trailing.maxX:trailing.minX-leading.maxX,2,0.01),"\(id) exact split gap and direction")
        }
    }
    static func interactions(){
        install(["label":"Create","controls":"actions"])
        check(responder("leading")?.canBecomeKeyView==true && responder("trailing")?.canBecomeKeyView==true,"Independent leading/trailing native tab entries")
        check(responder("leading")?.accessibilityLabel()=="Create" && responder("trailing")?.accessibilityLabel()=="Toggle menu","Independent accessible names")
        check(responder("trailing")?.accessibilityCustomActions()==nil,"Unresolved controls never offers a fabricated focus action")
        state.cancel=true;key("leading");key("trailing",49," ")
        check(state.events.map(\.name)==["mdLeadingClick","mdTrailingClick"],"Enter/Space independent exact event names")
        check(state.events.first?.detail == .null && state.events.last?.detail == ["checked":true],"Source event payloads remain null/committed checked")
        check(state.checked==true && responder("trailing")?.isAccessibilityExpanded()==true,"Cancellation does not roll back committed checked state")
        check(state.events.allSatisfy{$0.activation?.source == .keyboard},"Keyboard source metadata is truthful")
        state.node.properties["label"]="Updated";pump()
        check(state.checked==true,"Unrelated authored prop changes preserve live toggle state")
        state.node.properties["trailingChecked"]=false;pump()
        check(state.checked==false,"Changed authored checked input wins over local interaction")
        state.cancel=false;check(responder("trailing")?.accessibilityPerformPress()==true,"Native accessibility press accepted");pump()
        check(state.checked==true && state.events.last?.activation?.source == .accessibility,"Accessibility uses same committed event behavior")
        state.showPopup=true;pump()
        check(responder("trailing")?.accessibilityLinkedUIElements()?.count==1,"Controls resolves to actual mounted native target")
        check(responder("trailing")?.accessibilityCustomActions()?.first?.name=="Move to popup","Resolved target exposes named native focus action")
        check(responder("trailing")?.configuration?.popup?.target?.focus()==true,"Actual popup target accepts focus")
        check(window.firstResponder===responder("popup-action"),"Popup action moves focus into real descendant without toggling")
        state.popupID="renamed";state.node.properties["controls"]="renamed";state.actionLabel="Focus actions";pump()
        check(responder("trailing")?.accessibilityCustomActions()?.first?.name=="Focus actions","Updated localization reaches native action")
        _ = responder("trailing")?.requestNativeFocus()
        check(responder("trailing")?.configuration?.popup?.target?.focus()==true && window.firstResponder===responder("popup-action"),"Retained target identity change re-registers actual descendant focus")
        let checked=state.checked;state.showPopup=false;pump()
        check(responder("trailing")?.accessibilityCustomActions()==nil && state.checked==checked,"Unmount removes relationship without modifying expansion")
        for kind in ["menu","listbox","dialog","grid","tree","true","false"]{
            state.node.properties["haspopup"] = .string(kind);pump()
            check(responder("trailing")?.configuration?.popup?.kind==(kind=="false" ? nil:kind),"Popup kind \(kind) retains exact semantics")
        }
        install(["label":"Disabled","disabled":true])
        check(responder("leading")?.canBecomeKeyView==false && responder("trailing")?.canBecomeKeyView==false,"Hard disabled removes both tab stops")
        check(responder("leading")?.accessibilityPerformPress()==false,"Hard disabled accessibility activation blocked")
        install(["label":"Soft","softDisabled":true]);key("trailing")
        check(responder("trailing")?.canBecomeKeyView==true && responder("leading")?.canBecomeKeyView==true && state.events.isEmpty,"Soft disabled remains independently focusable but blocks activation")
        install(["aria-label":"Explicit action","menuLabel":"Options","icon":"add"])
        check(responder("leading")?.accessibilityLabel()=="Explicit action" && responder("trailing")?.accessibilityLabel()=="Options","Host label fallback/localized trailing label never speak symbol names")
        install(["label":"Day\n  view"],children:[.text(" more")])
        check(near(bounds("component.label").height,20,0.01),"Source collapsible label whitespace stays one line")
    }
    static func palette(){
        let a=AWCSplitButtonAppearance(containerColor:"#123456",labelColor:"#ABCDEF",iconColor:"#FEDCBA",outlineColor:"#00FF00")
        install(["label":"Create","icon":"add"],appearance:a)
        let enabled=pixels();check(count("#123456",enabled)>1000 && count("#ABCDEF",enabled)>15 && count("#FEDCBA",enabled)>10,"Actual custom surface/label/leading glyph paint")
        let idleTrailing=count("#123456",pixels(bounds("component.trailing")))
        let leading=bounds("component.leading")
        state.pointer.update(phase:.move,location:.init(x:leading.midX,y:leading.midY));pump()
        check(count("#123456",pixels(leading))==0 && count("#123456",pixels(bounds("component.trailing")))==idleTrailing,"Hover tint affects only the actual leading segment")
        state.pointer.update(phase:.leave);pump()
        key("trailing");pump(0.25)
        check(count("#123456",pixels(bounds("component.trailing")))==0 && count("#123456",pixels(leading))>500,"Focus tint and ring belong only to trailing segment")
        _ = window.makeFirstResponder(nil);pump()
        state.node.properties["disabled"]=true;pump();let disabled=pixels()
        check(count("#123456",disabled)==0 && count("#ABCDEF",disabled)==0 && count("#FEDCBA",disabled)==0,"Disabled drops all authored enabled palette colors")
        state.node.properties["disabled"]=false;state.node.properties["variant"]="outlined";pump();let outlined=pixels()
        check(count("#123456",outlined)==0 && count("#00FF00",outlined)>100,"Outlined ignores custom container and paints authored border")
    }
    static func main(){
        NSApplication.shared.setActivationPolicy(.accessory)
        host=NSHostingView(rootView:SplitFixture(state:state));window=NSWindow(contentRect:.init(x:0,y:0,width:640,height:300),styleMask:[.borderless],backing:.buffered,defer:false);window.contentView=host;window.orderFrontRegardless();NSApp.activate(ignoringOtherApps:true);pump()
        contracts();oracle();interactions();palette()
        print("SplitButton: \(checks-failures.count)/\(checks) checks passed against 50 measured Web fixtures.")
        window.orderOut(nil);if !failures.isEmpty{exit(1)}
    }
}
