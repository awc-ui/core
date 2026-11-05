import AppKit
import SwiftUI
import Observation
import AWCUI

@Observable final class FabFixtureState {
    var node=AWCNode(id:"fab",tag:"md-fab",properties:["icon":"add","ripple":false])
    var appearance=AWCFabAppearance()
    var controller=AWCFabController()
    var epoch=0
    var nodes:[AWCNativeInspectionNode]=[]
    var events:[AWCEvent]=[]
    var rtl=false
    var cancel=false
    let pointer=AWCNativePointerState()
}
struct FabFixture:View {
    let state:FabFixtureState
    var body:some View {
        let expectedID=state.node.id
        AWCEventScope(id:"scope",onCapture:{if state.cancel {$0.preventDefault()}},onEvent:{_ in}) {
            AWCNativeView(node:state.node,onEvent:{state.events.append($0)})
                .awcFabAppearance(state.appearance).awcFabController(state.controller)
                .awcNativeInspection(rootID:expectedID,coordinateSpace:"awc-native-preview"){if state.node.id==expectedID {state.nodes=$0}}.id(state.epoch)
        }.padding(32).frame(width:600,height:240).background(Color.white)
            .awcTheme(.generated()).environment(\.colorScheme,.light)
            .environment(\.layoutDirection,state.rtl ? .rightToLeft:.leftToRight)
            .environment(\.awcNativePointerState,state.pointer).coordinateSpace(name:"awc-native-preview")
    }
}
@main @MainActor enum NativeFabViewIntegration {
    static var checks=0
    static let state=FabFixtureState()
    static var host:NSHostingView<FabFixture>!
    static var window:NSWindow!
    static func check(_ value:Bool,_ message:String){checks += 1;precondition(value,message)}
    static func pump(_ interval:TimeInterval=0.08){let end=Date().addingTimeInterval(interval);while Date()<end {host?.layoutSubtreeIfNeeded();host?.displayIfNeeded();_ = RunLoop.current.run(mode:.default,before:Date().addingTimeInterval(0.003))}}
    static func descendants(_ v:NSView)->[NSView]{[v]+v.subviews.flatMap(descendants)}
    static func responder()->NSView {descendants(host).last{String(describing:type(of:$0)).contains("AWCNativeButtonFocusView")}!}
    static func bounds(_ part:String="component")->CGRect {state.nodes.first{$0.id==part}?.bounds ?? .null}
    static func near(_ x:CGFloat,_ y:CGFloat)->Bool{abs(x-y)<0.8}
    static func set(_ props:[String:AWCValue]=[:],_ appearance:AWCFabAppearance = .init(),_ children:[AWCNode]=[]) {
        var transaction=Transaction(animation:nil);transaction.disablesAnimations=true
        withTransaction(transaction) {
        state.epoch += 1
        state.node = .init(id:"fab-\(state.epoch)",tag:"md-fab",properties:["icon":"add","ripple":false].merging(props){_,new in new},children:children)
        state.appearance=appearance;state.controller=AWCFabController();state.events=[];state.rtl=false;state.cancel=false;state.nodes=[];state.pointer.update(phase:.leave)
        }
        _ = window.makeFirstResponder(nil);pump(0.12)
    }
    static func invoke(_ icon:String?){var done=false;Task{@MainActor in await state.controller.setMenuIcon(icon);done=true};pump();check(done,"Scoped async method completes without animation wait")}
    static func key(_ value:String,_ code:UInt16){_ = window.makeFirstResponder(responder());let e=NSEvent.keyEvent(with:.keyDown,location:.zero,modifierFlags:[],timestamp:ProcessInfo.processInfo.systemUptime,windowNumber:window.windowNumber,context:nil,characters:value,charactersIgnoringModifiers:value,isARepeat:false,keyCode:code)!;window.sendEvent(e);pump()}
    static func pointer(_ down:Bool){let r=responder(),p=r.convert(CGPoint(x:r.bounds.midX,y:r.bounds.midY),to:nil),local=r.convert(CGPoint(x:r.bounds.midX,y:r.bounds.midY),to:host)
        state.pointer.update(phase:down ? .down:.up,location:local)
        let e=NSEvent.mouseEvent(with:down ? .leftMouseDown:.leftMouseUp,location:p,modifierFlags:[],timestamp:ProcessInfo.processInfo.systemUptime,windowNumber:window.windowNumber,context:nil,eventNumber:1,clickCount:1,pressure:down ? 1:0)!;window.sendEvent(e);pump()
    }
    static func pixels()->[UInt8]{host.layoutSubtreeIfNeeded();host.displayIfNeeded();let b=host.bitmapImageRepForCachingDisplay(in:host.bounds)!;host.cacheDisplay(in:host.bounds,to:b);let image=b.cgImage!;var data=[UInt8](repeating:0,count:image.width*image.height*4)
        data.withUnsafeMutableBytes{raw in let context=CGContext(data:raw.baseAddress,width:image.width,height:image.height,bitsPerComponent:8,bytesPerRow:image.width*4,space:CGColorSpace(name:CGColorSpace.sRGB)!,bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue)!;context.draw(image,in:.init(x:0,y:0,width:image.width,height:image.height))};return data}
    static func count(_ data:[UInt8],_ red:Int,_ green:Int,_ blue:Int)->Int{stride(from:0,to:data.count,by:4).reduce(0){n,i in n+((abs(Int(data[i])-red)<=3 && abs(Int(data[i+1])-green)<=3 && abs(Int(data[i+2])-blue)<=3) ? 1:0)}}
    static func geometry(){
        for (index,size) in ["standard","medium","large"].enumerated(){for density in 0...4 {
            set(["size":.string(size),"density":.number(Double(-density))])
            let height=CGFloat([56,80,96][index]-density*4),icon=CGFloat([24,28,36][index]-density)
            check(near(bounds().width,height)&&near(bounds().height,height),"\(size)/\(-density) actual square FAB: \(bounds())")
            check(near(bounds("component.icon").width,icon)&&near(bounds("component.icon").height,icon),"Actual Material glyph source size")
        }}
        set([:],.init(iconSize:80));check(near(bounds().width,56)&&near(bounds("component.icon").minX-bounds().minX,-12),"Oversized explicit icon centers symmetrically within fixed56 host before clipping")
        let widths:[CGFloat]=[147.969,144,132.625,128.953,121]
        for size in ["standard","medium","large"] {for density in 0...4 {
            set(["size":.string(size),"density":.number(Double(-density)),"label":"New project"])
            check(near(bounds().width,widths[density])&&near(bounds().height,CGFloat(56-density*4)),"Extended \(size)/\(-density) source measured geometry: \(bounds())")
        }}
        for density in 0...4 {
            set(["label":"New project","extended":false,"density":.number(Double(-density))]);check(near(bounds().width,56)&&near(bounds().height,CGFloat(56-density*4)),"Collapsed labelled FAB keeps56 minimum width")
        }
        set(["label":"New project","icon":""]);check(near(bounds().width,115.969),"Label-only symmetric20 insets")
        set(["label":"New project"],.init(),[.slotText("",slot:"icon")]);check(near(bounds().width,147.969)&&near(bounds("component.icon").width,24),"Explicit blank element suppresses fallback but reserves24 slot")
        set(["label":"New project"],.init(),[.slotText(" ",slot:"icon")]);check(near(bounds().width,147.969),"Whitespace authored slot preserves same box")
        set(["label":"New project"],.init(iconSize:40),[.symbol("favorite",slot:"icon")]);check(near(bounds("component.icon").width,40)&&near(bounds().width,163.969),"Public symbol inherits iconSize hook")
        state.rtl=true;pump();check(bounds("component.icon").minX>bounds("component.label").maxX,"RTL mirrors actual label and icon order")
        set(["label":"New project"]);let expanded=bounds().width;state.node.properties["extended"]=false;pump(0.65);check(near(bounds().width,56),"Extended transition settles at measured collapsed target");state.node.properties["extended"]=true;pump(0.65);check(near(bounds().width,expanded),"Expand restores measured natural label width: expected \(expanded), actual \(bounds()), label \(bounds("component.label"))")
    }
    static func colorsAndSlots(){
        set(["label":"New project"],.init(containerColor:"#0000FF",iconColor:"#FF0000",iconSize:30,cornerRadius:0,labelColor:"#00FF00"));var image=pixels()
        check(count(image,0,0,255)>3000&&count(image,255,0,0)>10&&count(image,0,255,0)>20,"All five hooks reach actual container/glyph/label pixels")
        state.node.properties["disabled"]=true;pump(0.35);image=pixels()
        check(count(image,0,0,255)==0&&count(image,255,0,0)>10&&count(image,0,255,0)>20,"Disabled ignores custom container but explicit icon/label colors still win")
        set(["label":"Create"],.init(containerColor:"#000000",iconColor:"#FF0000",labelColor:"#000000"),[.slotText("X",slot:"icon")]);let literal=count(pixels(),255,0,0)
        set(["label":"Create"],.init(containerColor:"#000000",iconColor:"#FF0000",labelColor:"#000000"),[.symbol("close",slot:"icon")]);let symbol=count(pixels(),255,0,0)
        check(literal>5&&symbol>literal,"Literal slot inherits14pt host typography while typed symbol uses24pt glyph")
        for variant in ["surface","primary-container","secondary-container","tertiary-container","primary","secondary","tertiary"] {for lowered in [false,true] {
            set(["variant":.string(variant),"lowered":.bool(lowered),"icon":""])
            let role=variant=="surface" ? (lowered ? "surface-container-low":"surface-container-high"):variant
            let hex=AWCGeneratedTokens.light["--md-sys-color-"+role]!.dropFirst(),value=Int(hex,radix:16)!
            check(count(pixels(),(value>>16)&255,(value>>8)&255,value&255)>1500,"Actual \(variant)/lowered\(lowered) source palette")
        }}
    }
    static func interactions(){
        set(["label":"Create"]);pointer(true);check(state.events.isEmpty,"Held pointer waits for release");pointer(false)
        check(state.events.count==1&&state.events[0].name=="mdClick"&&state.events[0].detail == .null&&state.events[0].activation?.source == .pointer,"Pointer emits only mdClick with real activation and null DOM-event detail")
        state.events=[];key("\r",36);key(" ",49);check(state.events.count==2&&state.events.allSatisfy{$0.activation?.source == .keyboard},"Enter/Space activate on keydown")
        state.events=[];_ = responder().accessibilityPerformPress();pump();check(state.events.count==1&&state.events[0].activation?.source == .accessibility,"Native accessibility action remains available")
        state.events=[];state.cancel=true;key("\r",36);check(state.events.count==1&&state.events[0].defaultPrevented,"Public scoped cancellation marks FAB notification without invented selection")
        for soft in [false,true] {set([soft ? "softDisabled":"disabled":true,"label":"Create"]);pointer(true);pointer(false);key("\r",36);_ = responder().accessibilityPerformPress();pump();check(state.events.isEmpty,"Disabled/soft-disabled block every activation modality");check(responder().acceptsFirstResponder==soft,"Soft-disabled retains focus while hard-disabled excludes it")}
        set(["label":"Create","disabled":true],.init(iconColor:"#FF0000"),[.slotText("",slot:"icon")]);let original=bounds();check(count(pixels(),255,0,0)==0,"Blank authored slot initially has no ink")
        invoke("close");check(count(pixels(),255,0,0)>15&&near(bounds().width,original.width),"Disabled method shows temporary glyph without changing authored layout")
        state.node.properties["icon"]="favorite";invoke(nil);check(count(pixels(),255,0,0)==0,"Clear restores authored blank slot precedence, not stale fallback")
        state.node.children=[];pump();check(count(pixels(),255,0,0)>15,"Removing slot restores latest authored icon")
        invoke(" ");check(state.controller.menuIcon==" ","Whitespace method argument is preserved")
        invoke("");check(state.controller.menuIcon==nil,"Empty method argument clears temporary override")
    }
    static func main(){_ = NSApplication.shared;NSApp.setActivationPolicy(.accessory);host=NSHostingView(rootView:FabFixture(state:state));window=NSWindow(contentRect:.init(x:-20000,y:-20000,width:600,height:240),styleMask:.borderless,backing:.buffered,defer:false);window.isReleasedWhenClosed=false;window.colorSpace = .sRGB;window.contentView=host;window.orderFrontRegardless();pump(0.2);defer{window.close()};geometry();colorsAndSlots();interactions();print("Passed \(checks) real native FAB geometry, palette, slot, method, pointer/keyboard/accessibility checks.")}
}
