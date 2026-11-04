import AppKit
import SwiftUI
import Observation
@testable import AWCUI

@Observable final class AccordionReorderFixtureState {
    var node=AWCNode(id:"accordion",tag:"md-accordion")
    var epoch=0
    var mounts=0
    var unmounts=0
    var rtl=false
    var dark=false
    var inert=false
    var measurements:[AWCNativeInspectionNode]=[]
    var events:[AWCEvent]=[]
    let controller=AWCAccordionItemController()
}
struct AccordionReorderRetainedBody:View {
    let state:AccordionReorderFixtureState
    @State private var count=0
    var body:some View {
        AWCNativeView(node:.init(id:"inside",tag:"md-button",children:[.text("Retained \(count)")])) {
            if $0.name=="mdClick" {count+=1}
        }.onAppear{state.mounts+=1}.onDisappear{state.unmounts+=1}
    }
}
struct AccordionReorderFixture:View {
    let state:AccordionReorderFixtureState
    var body:some View {
        let epoch=state.epoch,theme=AWCTheme.generated(dark:state.dark)
        AWCNativeAccordionGroup(node:state.node,theme:theme,onEvent:{state.events.append($0)})
            .awcAccordionItemSlot(.content,for:"first"){AccordionReorderRetainedBody(state:state)}
            .awcAccordionItemController(state.controller,for:"first")
            .environment(\.awcAccordionReducedMotion,true)
            .environment(\.layoutDirection,state.rtl ? .rightToLeft:.leftToRight)
            .awcTheme(theme).awcNativeInert(state.inert).frame(width:400)
            .awcNativeInspection(rootID:"accordion",coordinateSpace:"reorder"){if state.epoch==epoch{state.measurements=$0}}
            .id(epoch).padding(30).frame(maxWidth:.infinity,maxHeight:.infinity,alignment:.topLeading)
            .background(theme.background).coordinateSpace(name:"reorder")
    }
}
@main @MainActor enum NativeAccordionReorderIntegration {
    static let state=AccordionReorderFixtureState()
    static var host:NSHostingView<AccordionReorderFixture>!,window:NSWindow!
    static var checks=0,failures:[String]=[]
    static var oracle=AWCValue.null
    static func check(_ value:Bool,_ name:String){checks+=1;if !value{failures.append(name);print("FAIL: "+name);fflush(stdout)}}
    static func near(_ a:Double,_ b:Double,_ name:String){check(abs(a-b)<0.7,"\(name): \(a) vs \(b)")}
    static func pump(_ duration:Double=0.1){let end=Date().addingTimeInterval(duration);while Date()<end{while let e=NSApp.nextEvent(matching:.any,until:.distantPast,inMode:.default,dequeue:true){NSApp.sendEvent(e)};host.layoutSubtreeIfNeeded();host.displayIfNeeded();_ = RunLoop.current.run(mode:.default,before:Date().addingTimeInterval(0.003))}}
    static func all(_ v:NSView)->[NSView]{[v]+v.subviews.flatMap(all)}
    static func header(_ id:String)->AWCNativeButtonFocusView{all(host).compactMap{$0 as? AWCNativeButtonFocusView}.first{$0.accessibilityIdentifier()==id+".header"}!}
    static func grip(_ id:String)->AWCAccordionReorderPointerView?{all(host).compactMap{$0 as? AWCAccordionReorderPointerView}.first{$0.accessibilityIdentifier()==id+".reorder-pointer"}}
    static func inside()->AWCNativeButtonFocusView?{all(host).compactMap{$0 as? AWCNativeButtonFocusView}.first{$0.accessibilityIdentifier()=="inside"}}
    static func rect(_ v:NSView)->CGRect{let r=host.convert(v.bounds,from:v);return host.isFlipped ? r:.init(x:r.minX,y:host.bounds.height-r.maxY,width:r.width,height:r.height)}
    static func mouse(_ kind:NSEvent.EventType,_ p:CGPoint){let point=host.convert(.init(x:p.x,y:host.isFlipped ? p.y:host.bounds.height-p.y),to:nil);let e=NSEvent.mouseEvent(with:kind,location:point,modifierFlags:[],timestamp:ProcessInfo.processInfo.systemUptime,windowNumber:window.windowNumber,context:nil,eventNumber:1,clickCount:1,pressure:kind == .leftMouseUp ? 0:1)!;window.sendEvent(e);pump()}
    static func setup(expanded:Bool=false,variant:String="filled",count:Int=3){
        state.inert=false
        state.node = .init(id:"accordion",tag:"md-accordion",properties:["reorderable":true,"transition":"none","variant":.string(variant)],children:Array(["first","second","third"].prefix(count)).enumerated().map{index,id in .init(id:id,tag:"md-accordion-item",properties:["headline":.string(id),"expanded":.bool(index==0 && expanded)],children:[.text("Body")])})
        state.epoch+=1;pump();state.events=[]
    }
    static func placeholder()->AWCNativeInspectionNode?{state.measurements.first{$0.name=="drop-placeholder"}}
    static func capture(_ name:String){guard let path=ProcessInfo.processInfo.environment["AWC_ACCORDION_REORDER_CAPTURE_DIRECTORY"] else{return};let d=URL(fileURLWithPath:path);try! FileManager.default.createDirectory(at:d,withIntermediateDirectories:true);let b=host.bitmapImageRepForCachingDisplay(in:host.bounds)!;host.cacheDisplay(in:host.bounds,to:b);try! b.representation(using:.png,properties:[:])!.write(to:d.appendingPathComponent(name+".png"))}
    static func compare(_ snapshot:AWCValue,_ context:AWCAccordionReorderContext,_ phase:String) {
        guard let root=context.registry.rect("accordion") else {check(false,"root geometry exists");return}
        near(root.width,snapshot["root"]["width"].number!,phase+" root width")
        near(root.height,snapshot["root"]["height"].number!,phase+" root height")
        for item in snapshot["items"].array {
            guard let r=context.registry.rect(item["id"].string) else {check(false,"item geometry exists");continue}
            let expected=item["rect"]
            near(r.minX-root.minX,expected["x"].number!,phase+" item x")
            near(r.minY-root.minY,expected["y"].number!,phase+" item y")
            near(r.width,expected["width"].number!,phase+" item width")
            near(r.height,expected["height"].number!,phase+" item height")
        }
        if let ghost=placeholder(),snapshot["ghost"] != .null {
            let expected=snapshot["ghost"]["rect"]
            // Inspection uses the fixture coordinate space, while the source capture is root-relative.
            let nativeRoot=state.measurements.first{$0.id=="component"}!
            near(ghost.bounds.minX-nativeRoot.bounds.minX,expected["x"].number!,phase+" placeholder x")
            near(ghost.bounds.minY-nativeRoot.bounds.minY,expected["y"].number!,phase+" placeholder y")
            near(ghost.bounds.width,expected["width"].number!,phase+" placeholder width")
            near(ghost.bounds.height,expected["height"].number!,phase+" placeholder height")
        } else {check(placeholder()==nil && snapshot["ghost"] == .null,phase+" placeholder presence")}
    }
    static func reorder(){
        for dark in [false,true] {for rtl in [false,true] {for variant in ["filled","outlined"] {
            state.dark=dark;state.rtl=rtl;setup(variant:variant)
            guard let handle=grip("first") else{check(false,"real native grip exists");continue}
            let first=header("first"),second=header("second"),third=header("third"),a=rect(first),b=rect(second),c=rect(third),g=rect(handle)
            let reference=oracle["cases"].array.first{$0["theme"].string == (dark ? "dark":"light") && $0["direction"].string == (rtl ? "rtl":"ltr") && $0["variant"].string == variant}!
            let context=handle.context!
            compare(reference["before"],context,"before")
            let point=CGPoint(x:g.midX,y:g.midY),dy=reference["dy"].number!
            mouse(.leftMouseDown,point)
            check(placeholder() != nil,"pointer down exposes drop placeholder")
            check(!state.controller.isExpanded,"grip press does not toggle disclosure")
            compare(reference["lifted"],context,"lifted")
            mouse(.leftMouseDragged,.init(x:point.x,y:point.y+dy))
            near(rect(first).minY,a.minY+dy,"lifted native item follows physical pointer")
            near(rect(second).minY,b.minY-(b.minY-a.minY),"first crossed sibling shifts")
            near(rect(third).minY,c.minY-(b.minY-a.minY),"second crossed sibling shifts")
            check(state.events.filter{$0.name=="mdReorder"}.isEmpty,"no reorder event before release")
            compare(reference["moved"],context,"moved")
            capture("\(dark ? "dark":"light")-\(rtl ? "rtl":"ltr")-\(variant)-drag")
            mouse(.leftMouseUp,.init(x:point.x,y:point.y+dy))
            check(placeholder()==nil,"drop clears placeholder")
            compare(reference["dropped"],context,"dropped")
            check(header("first") === first && header("second") === second,"drop retains native headers")
            let events=state.events.filter{$0.name=="mdReorder"}
            check(events.count==1 && events[0].detail == .object(["from":0,"to":2,"order":[1,2,0]]),"pointer release emits source reorder payload")
            check(rect(header("second")).minY<rect(header("third")).minY && rect(header("third")).minY<rect(header("first")).minY,"native children commit new order")
        }}}
    }
    static func retentionAndCancellation(){
        state.dark=false;state.rtl=false;setup(expanded:true)
        let child=inside()!;check(child.accessibilityPerformPress(),"authored body activates");pump()
        let mounts=state.mounts,unmounts=state.unmounts
        let handle=grip("first")!,g=rect(handle),p=CGPoint(x:g.midX,y:g.midY)
        mouse(.leftMouseDown,p);mouse(.leftMouseDragged,.init(x:p.x,y:p.y+250))
        check(inside() === child && child.accessibilityLabel()=="Retained 1","lifting preserves authored state and responder")
        handle.cancel();pump()
        check(placeholder()==nil && state.events.filter{$0.name=="mdReorder"}.isEmpty,"pointer cancellation clears ghost without reordering")
        check(state.controller.isExpanded && inside() === child,"cancel retains open state and authored content")
        check(state.mounts==mounts && state.unmounts==unmounts,"drag and cancel do not remount authored body")
        mouse(.leftMouseUp,p)
        setup(count:1);let only=rect(grip("first")!);let q=CGPoint(x:only.midX,y:only.midY)
        mouse(.leftMouseDown,q);mouse(.leftMouseUp,q)
        check(!state.controller.isExpanded && placeholder()==nil && state.events.isEmpty,"single-item grip click is consumed without toggle or reorder")
        setup();let disabled=state.node.children[0];var next=disabled;next.properties["disabled"]=true;state.node.children[0]=next;pump()
        check(grip("first")==nil,"disabled item does not expose a pointer grip")
    }
    static func invalidation(){
        for reason in ["inert","disabled","removed","reorderable"] {
            setup();let handle=grip("first")!,g=rect(handle),p=CGPoint(x:g.midX,y:g.midY)
            mouse(.leftMouseDown,p);mouse(.leftMouseDragged,.init(x:p.x,y:p.y+149))
            check(placeholder() != nil,"active drag before "+reason)
            switch reason {
            case "inert": state.inert=true
            case "disabled": state.node.children[0].properties["disabled"]=true
            case "removed": state.node.children.removeFirst()
            default: state.node.properties["reorderable"]=false
            }
            pump();mouse(.leftMouseUp,.init(x:p.x,y:p.y+149))
            check(placeholder()==nil,"invalidating "+reason+" clears ghost")
            check(state.events.filter{$0.name=="mdReorder"}.isEmpty,"invalidating "+reason+" cancels without committing")
        }
        setup();state.inert=true;pump()
        let handle=grip("first")!,g=rect(handle),p=CGPoint(x:g.midX,y:g.midY)
        mouse(.leftMouseDown,p);mouse(.leftMouseDragged,.init(x:p.x,y:p.y+149));mouse(.leftMouseUp,p)
        check(placeholder()==nil && state.events.isEmpty && !state.controller.isExpanded,"inert retained grips cannot reorder or toggle")
        state.inert=false
    }
    static func main(){
        _ = NSApplication.shared;NSApp.setActivationPolicy(.accessory)
        host=NSHostingView(rootView:AccordionReorderFixture(state:state));window=NSWindow(contentRect:.init(x:-20000,y:-20000,width:600,height:800),styleMask:[.borderless],backing:.buffered,defer:false);window.isReleasedWhenClosed=false;window.colorSpace = .sRGB;window.contentView=host;window.orderFrontRegardless();pump(0.2)
        let fixture=URL(fileURLWithPath:#filePath).deletingLastPathComponent().appendingPathComponent("Fixtures/accordion-web-reorder.json")
        oracle=try! JSONDecoder().decode(AWCValue.self,from:Data(contentsOf:fixture))
        reorder();retentionAndCancellation();invalidation()
        if let output=ProcessInfo.processInfo.environment["AWC_ACCORDION_REORDER_OUTPUT"]{try! JSONSerialization.data(withJSONObject:["checks":checks,"failures":failures],options:[.prettyPrinted,.sortedKeys]).write(to:URL(fileURLWithPath:output))}
        print("Accordion native pointer reorder: \(checks-failures.count)/\(checks) checks passed")
        window.close();if !failures.isEmpty{exit(1)}
    }
}
