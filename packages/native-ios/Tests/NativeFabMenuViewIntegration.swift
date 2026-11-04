import AppKit
import SwiftUI
import Observation
@testable import AWCUI

@Observable final class MenuFixtureState {
    var controller=AWCFabMenuController()
    var fab=AWCFabController()
    var epoch=0
    var properties:[String:AWCValue]=["anchor":"anchor","placement":"down"]
    var children=[AWCNode(id:"edit",tag:"md-fab-menu-item",properties:["icon":"edit","label":"Edit"]),
                  AWCNode(id:"duplicate",tag:"md-fab-menu-item",properties:["icon":"content_copy","label":"Duplicate"]),
                  AWCNode(id:"share",tag:"md-fab-menu-item",properties:["icon":"share","label":"Share"])]
    var frames:[String:CGRect]=[:]
    var events:[AWCEvent]=[]
    var appearance=AWCFabMenuAppearance()
    var itemAppearance=AWCFabMenuItemAppearance()
    var rtl=false
    var stop=false
    var cancel=false
    var visible=true
    var anchorOffset=CGSize.zero
    var anchorTag="md-fab"
    var inheritedDensity=0.0
    let pointer=AWCNativePointerState()
}
struct MenuFixture:View {
    let state:MenuFixtureState
    var body:some View {
        AWCFabMenuScope {
            AWCNativeView(node:.init(id:"anchor",tag:state.anchorTag,properties:["icon":"add","label":"Create","aria-label":"Create"],children:state.anchorTag=="md-button" ? [.text("Create")]:[])) {state.events.append($0)}
                .awcFabController(state.fab).offset(state.anchorOffset)
            if state.visible {
                AWCNativeView(node:.init(id:"menu",tag:"md-fab-menu",properties:state.properties,children:state.children)) {state.events.append($0)}
                    .awcFabMenuController(state.controller)
                    .awcFabMenuAppearance(state.appearance)
                    .awcFabMenuItemAppearance(state.itemAppearance,nodeID:"edit")
                    .environment(\.awcEventTargetListeners,[.init(handler:{event in
                        if event.event.tag=="md-fab-menu-item" {if state.stop {event.stopPropagation()};if state.cancel {event.preventDefault()}}
                    })])
            }
        }.id(state.epoch).frame(width:360,height:480).padding(32).background(Color.white)
            .awcTheme(.generated()).environment(\.colorScheme,.light)
            .environment(\.layoutDirection,state.rtl ? .rightToLeft:.leftToRight)
            .environment(\.awcNativeDensity,state.inheritedDensity)
            .onPreferenceChange(AWCFabMenuFrames.self){state.frames=$0}
            .coordinateSpace(name:"awc-native-preview")
            .environment(\.awcNativePointerState,CommandLine.arguments.contains("--native-pointer") ? nil:state.pointer)
    }
}
@main @MainActor enum NativeFabMenuViewIntegration {
    static var checks=0
    static let state=MenuFixtureState()
    static var host:NSHostingView<MenuFixture>!
    static var window:NSWindow!
    /// Every expectation follows an asynchronous native boundary (render, closing settlement, glyph morph, focus task), so
    /// it must hold within 3 s rather than after a fixed wall-clock budget that CPU load can exceed. Values fixed before
    /// the call (elapsed times, counts captured earlier) are passed as constants and stay strict.
    static func check(_ value:@autoclosure () -> Bool,_ message:@autoclosure () -> String){checks += 1;precondition(settle(3,value),message())}
    static func pump(_ interval:TimeInterval=0.08){let end=Date().addingTimeInterval(interval);while Date()<end {while let event=NSApp.nextEvent(matching:.any,until:Date(),inMode:.default,dequeue:true){NSApp.sendEvent(event)};host?.layoutSubtreeIfNeeded();host?.displayIfNeeded();_ = RunLoop.current.run(mode:.default,before:Date().addingTimeInterval(0.003))}}
    static func descendants(_ view:NSView)->[NSView]{[view]+view.subviews.flatMap(descendants)}
    static func responder(_ id:String)->AWCNativeButtonFocusView? {descendants(host).compactMap{$0 as? AWCNativeButtonFocusView}.last{$0.configuration?.id==id}}
    static func frame(_ id:String)->CGRect {state.frames[id] ?? .null}
    static func near(_ a:CGFloat,_ b:CGFloat)->Bool {abs(a-b)<0.8}
    static func pixels()->[UInt8] {
        host.layoutSubtreeIfNeeded();host.displayIfNeeded()
        let bitmap=host.bitmapImageRepForCachingDisplay(in:host.bounds)!;host.cacheDisplay(in:host.bounds,to:bitmap);let image=bitmap.cgImage!
        var bytes=[UInt8](repeating:0,count:image.width*image.height*4)
        bytes.withUnsafeMutableBytes{raw in
            let context=CGContext(data:raw.baseAddress,width:image.width,height:image.height,bitsPerComponent:8,bytesPerRow:image.width*4,space:CGColorSpace(name:CGColorSpace.sRGB)!,bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue)!
            context.draw(image,in:.init(x:0,y:0,width:image.width,height:image.height))
        }
        return bytes
    }
    static func count(_ bytes:[UInt8],_ hex:String)->Int {
        let value=Int(hex.dropFirst(),radix:16)!,red=(value>>16)&255,green=(value>>8)&255,blue=value&255
        return stride(from:0,to:bytes.count,by:4).reduce(0){sum,i in sum+((abs(Int(bytes[i])-red)<4 && abs(Int(bytes[i+1])-green)<4 && abs(Int(bytes[i+2])-blue)<4) ? 1:0)}
    }
    static func method(_ action:@escaping () async -> Void){var done=false;Task {@MainActor in await action();done=true};pump();check(done,"Lifecycle method returns after its actual acceptance boundary")}
    /// Pumps until `condition` holds (an asynchronous native boundary: closing animation, glyph morph, focus task)
    /// or `timeout` passes. Load only delays these boundaries; the checks still require them to happen.
    @discardableResult static func settle(_ timeout:TimeInterval=3,_ condition:() -> Bool)->Bool{
        let end=Date().addingTimeInterval(timeout);while !condition() && Date()<end {pump(0.01)};return condition()}
    static func open(){method{await state.controller.show()};pump(0.22);settle{state.controller.isOpen && !state.controller.isClosing}}
    static func close(){method{await state.controller.close()};pump(0.25);settle{!state.controller.isPresented}}
    static func key(_ id:String,_ text:String,_ code:UInt16,shift:Bool=false){
        guard let responder=responder(id) else {preconditionFailure("Missing native responder \(id), frames \(state.frames)")}
        _ = window.makeFirstResponder(responder)
        let event=NSEvent.keyEvent(with:.keyDown,location:.zero,modifierFlags:shift ? .shift:[],timestamp:ProcessInfo.processInfo.systemUptime,windowNumber:window.windowNumber,context:nil,characters:text,charactersIgnoringModifiers:text,isARepeat:false,keyCode:code)!
        window.sendEvent(event);pump()
    }
    static func click(_ id:String?=nil,point:CGPoint?=nil){
        let position:CGPoint
        if let id,let r=responder(id) {position=r.convert(.init(x:r.bounds.midX,y:r.bounds.midY),to:nil)}
        else {position=host.convert(point ?? .init(x:4,y:4),to:nil)}
        for down in [true,false] {
            let local=host.convert(position,from:nil)
            state.pointer.update(phase:down ? .down:.up,location:local)
            let event=NSEvent.mouseEvent(with:down ? .leftMouseDown:.leftMouseUp,location:position,modifierFlags:[],timestamp:ProcessInfo.processInfo.systemUptime,windowNumber:window.windowNumber,context:nil,eventNumber:1,clickCount:1,pressure:down ? 1:0)!
            if CommandLine.arguments.contains("--native-pointer") { NSApp.postEvent(event,atStart:false) }
            else if down || id != nil {window.sendEvent(event)} else {NSApp.postEvent(event,atStart:false)};pump(0.025)
        }
        pump(0.25)
    }
    static func reset(_ properties:[String:AWCValue]=[:],anchorTag:String="md-fab"){
        state.visible=false;pump()
        state.epoch += 1;state.controller=AWCFabMenuController();state.fab=AWCFabController()
        state.properties=["anchor":"anchor","placement":"down"].merging(properties){_,new in new}
        state.appearance = .init();state.itemAppearance = .init();state.rtl=false;state.events=[];state.stop=false;state.cancel=false;state.anchorOffset = .zero
        state.anchorTag=anchorTag
        state.inheritedDensity=0
        for index in state.children.indices {state.children[index].properties["disabled"]=nil;state.children[index].properties["softDisabled"]=nil;state.children[index].properties["density"]=nil}
        state.children[0].children=[];state.children[0].properties["label"]="Edit";state.children[0].properties["icon"]="edit"
        state.visible=true;_ = window.makeFirstResponder(nil);pump(0.15)
        state.pointer.update(phase:.leave)
    }
    static func geometry(){
        check(!state.controller.isOpen && frame("menu").isNull,"Closed menu adds no geometry")
        open()
        check(near(frame("anchor").width,113.773) && near(frame("anchor").height,56),"Extended anchor retains actual source geometry")
        check(near(frame("edit").width,92.305) && near(frame("duplicate").width,127.852) && near(frame("share").width,104.625),"Actual menu item widths match Web measured label/glyph/insets: \(state.frames)")
        check(near(frame("menu").height,152) && near(frame("menu").minY,frame("anchor").maxY+8),"Down menu uses measured anchor and8pt gap: \(state.frames)")
        check(near(frame("edit").maxX,frame("anchor").maxX) && near(frame("share").maxX,frame("anchor").maxX),"Items independently align inline end")
        check(settle{state.fab.menuIcon=="close"},"Actual anchor controller receives temporary close glyph")
        state.anchorOffset = .init(width:35,height:-40);pump()
        check(near(frame("menu").maxX,frame("anchor").maxX) && near(frame("menu").minY,frame("anchor").maxY+8),"Menu tracks actual anchor layout movement")
        state.properties["placement"]="up";pump()
        check(near(frame("menu").maxY,frame("anchor").minY-8) && frame("edit").minY>frame("share").minY,"Up placement reverses visual order around measured bottom edge: \(state.frames)")
        state.rtl=true;pump()
        check(near(frame("edit").minX,frame("anchor").minX) && near(frame("share").minX,frame("anchor").minX),"RTL uses actual anchor inline start: \(state.frames)")
        // The glyph morph runs 120 ms after the closed settlement (FabMenuScope.morph), which comes 180 ms after close begins.
        let closeStarted=Date();method{await state.controller.close()}
        check(settle{state.fab.menuIcon==nil},"Close restores authored anchor glyph")
        let restoredAfter=Date().timeIntervalSince(closeStarted)
        check(restoredAfter>=0.29,"Glyph restoration waits for the 180 ms closing settlement and the 120 ms morph (\(restoredAfter) s)")
        settle{!state.controller.isPresented}
        let widths:[[CGFloat]]=[[92.305,127.852,104.625],[90.445,124.742,102.336],[80.594,113.641,92.047],[70.742,102.531,81.758],[64.891,95.43,75.461]]
        for variant in ["primary","secondary","tertiary"] {for density in 0...4 {
            reset(["density":.number(Double(-density)),"variant":.string(variant)]);open()
            let height=CGFloat(48-density*4),gap:CGFloat=density==4 ? 2:4
            check(near(frame("edit").height,height) && near(frame("menu").height,height*3+gap*2),"\(variant) density \(-density) source item height and menu spacing")
            check(zip(["edit","duplicate","share"],widths[density]).allSatisfy{near(frame($0.0).width,$0.1)},"\(variant) density \(-density) all three actual widths match Web oracle")
            check(count(pixels(),AWCGeneratedTokens.light["--md-sys-color-"+variant+"-container"]!)>2000,"Actual \(variant) menu item palette")
            close()
        }}
        reset(["density":-3]);state.children[0].properties["density"]=0;state.children[1].properties["density"] = -1;open()
        check(near(frame("edit").height,36) && near(frame("duplicate").height,44) && near(frame("share").height,36),"Explicit zero item density inherits menu; negative local rung overrides it")
        close()
        reset(["density":0]);state.inheritedDensity = -2;open()
        check(near(frame("edit").height,40) && near(frame("menu").height,128),"Menu overlay retains inherited density when its own density is zero")
        close()
        reset(["open":true])
        check(state.controller.isOpen && state.events.isEmpty,"Initially open menu mounts without synthetic mdOpen")
        close()
    }
    static func appearanceAndSlots(){
        reset();state.appearance = .init(itemContainerColor:"#123456",itemLabelColor:"#FEDCBA",itemGap:12);open()
        check(near(frame("menu").height,168) && near(frame("duplicate").minY-frame("edit").maxY,12),"Menu itemGap changes actual stack geometry")
        var image=pixels();check(count(image,"#123456")>8000 && count(image,"#FEDCBA")>100,"Menu palette hooks reach all actual item pixels")
        state.itemAppearance = .init(containerColor:"#0000FF",labelColor:"#00FF00",iconColor:"#FF0000",iconSize:36,cornerRadius:0);pump(0.35);image=pixels()
        check(near(frame("edit").width,108.305) && near(frame("duplicate").width,127.852),"nodeID local item appearance changes only the edited child's icon geometry")
        check(count(image,"#0000FF")>2000 && count(image,"#00FF00")>20 && count(image,"#FF0000")>10 && count(image,"#123456")>5000,"All item color hooks override inherited menu palette only on the authored target")
        state.children[0].children=[.slotText("",slot:"icon")];pump()
        check(count(pixels(),"#FF0000")==0 && near(frame("edit").width,108.305),"Authored empty icon element suppresses fallback while retaining slot width")
        state.children[0].children=[.slotText(" ",slot:"icon")];pump()
        check(count(pixels(),"#FF0000")==0,"Whitespace authored icon element also suppresses fallback")
        state.children[0].children=[.symbol("favorite",slot:"icon")];pump()
        check(count(pixels(),"#FF0000")>10,"Typed Material symbol inherits actual item icon size/color")
        state.children[0].properties["disabled"]=true;pump(0.35);image=pixels()
        check(count(image,"#0000FF")==0 && count(image,"#00FF00")==0 && count(image,"#FF0000")>10,"Disabled source palette overrides authored container/label while explicit icon color remains")
        state.children[0].properties["disabled"]=false;state.children[0].properties["label"]="";state.children[0].children=[.text("Archive")];pump()
        check(responder("edit")?.accessibilityLabel()=="Archive","Empty label reveals authored default text and accessible name")
        close()
    }
    static func interactions(){
        reset();click("anchor")
        check(state.controller.isOpen && state.events.map(\.name)==["mdOpen"],"Pointer anchor capture opens menu and consumes anchor mdClick: open \(state.controller.isOpen), events \(state.events.map{$0.tag+":"+$0.name}), focused \(responder("anchor")?.configuration?.handle.isFocused ?? false), frames \(state.frames)")
        check((window.firstResponder as? AWCNativeButtonFocusView)?.configuration?.id=="anchor","Fresh pointer opening leaves focus on anchor")
        key("anchor","\u{f701}",125)
        check((window.firstResponder as? AWCNativeButtonFocusView)?.configuration?.id=="edit","ArrowDown enters first item")
        key("edit","\u{f701}",125)
        check((window.firstResponder as? AWCNativeButtonFocusView)?.configuration?.id=="duplicate","ArrowDown advances authored items")
        key("duplicate","s",1)
        check((window.firstResponder as? AWCNativeButtonFocusView)?.configuration?.id=="share","Typeahead uses live item label")
        key("share","\t",48,shift:true)
        check((window.firstResponder as? AWCNativeButtonFocusView)?.configuration?.id=="duplicate","Shift Tab walks authored order")
        key("duplicate","\u{1b}",53);pump(0.25)
        check(settle{!state.controller.isOpen && (window.firstResponder as? AWCNativeButtonFocusView)?.configuration?.id=="anchor"},"Escape closes and restores anchor focus")
        reset();key("anchor","\r",36);pump(0.25)
        check(settle{(window.firstResponder as? AWCNativeButtonFocusView)?.configuration?.id=="edit"} && state.events.map(\.name)==["mdOpen"],"Keyboard anchor opens once, focuses first item, emits no anchor mdClick")
        state.children[1].properties["disabled"]=true;pump();key("edit","\u{f701}",125)
        check((window.firstResponder as? AWCNativeButtonFocusView)?.configuration?.id=="duplicate","Roving focus includes source hard-disabled item")
        let events=state.events.count;key("duplicate","\r",36)
        check(state.controller.isOpen && state.events.count==events,"Disabled roving item blocks activation")
        state.cancel=true;key("edit","\r",36);pump(0.25)
        check(settle{!state.controller.isOpen} && state.events.contains{$0.tag=="md-fab-menu-item" && $0.defaultPrevented},"Canceling item custom event does not prevent bubbling menu close")
        reset();open();state.stop=true;key("edit","\r",36);pump(0.25)
        check(state.controller.isOpen,"Stopping item event propagation prevents parent menu close")
        state.stop=false;click(point:.init(x:5,y:5))
        check(!state.controller.isOpen,"Outside click includes native window padding outside scope")
        reset();open();var settled=false;Task {await state.controller.whenClosed();settled=true};pump()
        method{await state.controller.close()}
        check(state.controller.isClosing && !settled,"close returns before visible180ms closing and whenClosed settlement")
        method{await state.controller.show()};pump(0.25)
        check(state.controller.isOpen && !settled,"Reopen cancels pending close and retains cycle waiter")
        close();check(settle{settled},"whenClosed settles after real native closed render, without capture polling")
        open();settled=false;Task {await state.controller.whenClosed();settled=true};pump();state.visible=false;pump()
        check(settled,"Disconnect settles native lifecycle waiter")
        for tag in ["md-button","md-icon-button"] {
            reset(anchorTag:tag);click("anchor")
            check(state.controller.isOpen && state.events.map(\.name)==["mdOpen"],"\(tag) anchor uses ordinary pointer activation and suppresses its own action")
            state.visible=false;pump();state.events=[];click("anchor")
            check(state.events.map(\.name)==["mdClick"],"\(tag) keeps native pointer activation after menu detaches")
        }
    }
    static func main(){
        _ = NSApplication.shared;NSApp.setActivationPolicy(.accessory);NSApp.finishLaunching()
        host=NSHostingView(rootView:MenuFixture(state:state))
        window=NSWindow(contentRect:.init(x:-20000,y:-20000,width:424,height:544),styleMask:.borderless,backing:.buffered,defer:false)
        window.isReleasedWhenClosed=false;window.colorSpace = .sRGB;window.contentView=host;window.orderFrontRegardless();pump(0.2)
        defer{window.close()}
        if !CommandLine.arguments.contains("--interactions-only") {geometry();appearanceAndSlots()}
        interactions()
        print("Passed \(checks) real native FAB Menu geometry, focus, keyboard, activation, outside-click and lifecycle checks.")
    }
}
