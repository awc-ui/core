import AppKit
import SwiftUI
import Observation
@testable import AWCUI

@Observable final class SegmentedFixtureState {
    var node = AWCNode(id:"segment",tag:"md-segmented-button",properties:["label":"Week"])
    var appearance = AWCSegmentedButtonAppearance()
    var localAppearance = AWCSegmentedButtonAppearance()
    var localID: String?
    var width: CGFloat?
    var rtl = false
    var epoch = 0
    var inspected: [AWCNativeInspectionNode] = []
    var selection: [Bool] = []
    var events: [AWCEvent] = []
    var targetEvents: [AWCEvent] = []
    var cancel = false
    var stop = false
    var inheritedDensity = 0.0
    var inheritedDenseInset = false
    let pointer = AWCNativePointerState()
}
struct SegmentedFixture: View {
    let state: SegmentedFixtureState
    var body: some View {
        let epoch = state.epoch
        AWCNativeView(node:state.node,onEvent:{state.events.append($0)})
            .awcSegmentedButtonAppearance(state.localAppearance,nodeID:state.localID)
            .awcSegmentedButtonAppearance(state.appearance)
            .awcNativeInspection(rootID:state.node.id,coordinateSpace:"awc-native-preview"){if state.epoch==epoch {state.inspected=$0}}
            .awcSegmentedSelection(rootID:state.node.id){state.selection=$0}
            .environment(\.awcEventTargetListeners,[.init(handler:{event in
                state.targetEvents.append(event.event)
                if event.event.name=="mdSegmentClick" {if state.cancel {event.preventDefault()};if state.stop {event.stopPropagation()}}
            })])
            .frame(width:state.width).id(epoch)
            .padding(24).frame(width:640,height:240).background(Color.white)
            .awcTheme(.generated()).environment(\.colorScheme,.light)
            .environment(\.layoutDirection,state.rtl ? .rightToLeft:.leftToRight)
            .awcDensity(state.inheritedDensity)
            .environment(\.awcNativeDenseInset,state.inheritedDenseInset)
            .environment(\.awcNativePointerState,state.pointer)
            .transaction{$0.disablesAnimations=true}
            .coordinateSpace(name:"awc-native-preview")
    }
}
@main @MainActor enum NativeSegmentedViewIntegration {
    static var checks=0, failures:[String]=[]
    static let state=SegmentedFixtureState()
    static var host:NSHostingView<SegmentedFixture>!
    static var window:NSWindow!
    static func check(_ value:Bool,_ message:String){checks += 1;if !value {failures.append(message);print("FAIL: "+message)}}
    static func near(_ a:CGFloat,_ b:Double,_ tolerance:Double=0.8)->Bool {a.isFinite && abs(Double(a)-b)<tolerance}
    static func pump(_ interval:TimeInterval=0.07){
        let end=Date().addingTimeInterval(interval)
        while Date()<end {while let event=NSApp.nextEvent(matching:.any,until:Date(),inMode:.default,dequeue:true){NSApp.sendEvent(event)};host?.layoutSubtreeIfNeeded();host?.displayIfNeeded();_ = RunLoop.current.run(mode:.default,before:Date().addingTimeInterval(0.003))}
    }
    static func descendants(_ view:NSView)->[NSView]{[view]+view.subviews.flatMap(descendants)}
    static func responder(_ id:String)->AWCNativeButtonFocusView? {descendants(host).compactMap{$0 as? AWCNativeButtonFocusView}.last{$0.configuration?.id==id}}
    static func bounds(_ part:String="component")->CGRect {state.inspected.first{$0.id==part}?.bounds ?? .null}
    static func childBounds(_ id:String)->CGRect {
        if let part=state.inspected.first(where:{$0.id=="component.child.\(id)"}) {return part.bounds}
        guard let view=responder(id) else{return .null};return view.convert(view.bounds,to:host)
    }
    static func key(_ id:String,_ code:UInt16,_ characters:String){
        guard let view=responder(id) else{check(false,"Missing responder \(id)");return}
        _ = window.makeFirstResponder(view)
        view.keyDown(with:NSEvent.keyEvent(with:.keyDown,location:.zero,modifierFlags:[],timestamp:0,windowNumber:window.windowNumber,context:nil,characters:characters,charactersIgnoringModifiers:characters,isARepeat:false,keyCode:code)!)
        pump()
    }
    static func install(_ node:AWCNode,appearance:AWCSegmentedButtonAppearance = .init(),width:CGFloat?=nil,rtl:Bool=false){
        state.epoch += 1;state.node=node;state.appearance=appearance;state.localAppearance = .init();state.localID=nil
        state.width=width;state.rtl=rtl;state.events=[];state.targetEvents=[];state.selection=[];state.inspected=[]
        state.cancel=false;state.stop=false;state.inheritedDensity=0;state.inheritedDenseInset=false
        state.pointer.update(phase:.leave);_ = window.makeFirstResponder(nil);pump()
    }
    static func segment(_ id:String,_ properties:[String:AWCValue]=[:],_ children:[AWCNode]=[])->AWCNode {
        .init(id:id,tag:"md-segmented-button",properties:["label":"Week","ripple":false].merging(properties){_,new in new},children:children)
    }
    static func set(_ children:[AWCNode],_ properties:[String:AWCValue]=[:],id:String="set")->AWCNode {.init(id:id,tag:"md-segmented-button-set",properties:properties,children:children)}
    static func pixels()->[UInt8]{
        host.layoutSubtreeIfNeeded();host.displayIfNeeded()
        let bitmap=host.bitmapImageRepForCachingDisplay(in:host.bounds)!;host.cacheDisplay(in:host.bounds,to:bitmap)
        let image=bitmap.cgImage!;var result=[UInt8](repeating:0,count:image.width*image.height*4)
        result.withUnsafeMutableBytes{raw in let context=CGContext(data:raw.baseAddress,width:image.width,height:image.height,bitsPerComponent:8,bytesPerRow:image.width*4,space:CGColorSpace(name:CGColorSpace.sRGB)!,bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue)!;context.draw(image,in:.init(x:0,y:0,width:image.width,height:image.height))}
        return result
    }
    static func count(_ hex:String,_ bytes:[UInt8])->Int{
        let value=UInt32(hex.dropFirst(),radix:16)!,rgb=[Int(value>>16),Int((value>>8)&255),Int(value&255)]
        return stride(from:0,to:bytes.count,by:4).reduce(0){sum,i in sum+((0..<3).allSatisfy{abs(Int(bytes[i+$0])-rgb[$0])<=3} ? 1:0)}
    }
    static func contracts(){
        let tokens=AWCGeneratedTokens.light
        for density in -4...0 {
            let metric=AWCNativeSegmentedMetrics(properties:["segmentDensity":.number(Double(density))],inheritedDensity:0,denseInset:false,appearance:.init(),tokens:tokens)
            check(metric.height==CGFloat(40+density*4) && metric.padding==12,"Class density \(density) changes scale without replacing inset token")
            let local=AWCNativeSegmentedMetrics(properties:["density":.number(Double(density))],inheritedDensity:0,denseInset:false,appearance:.init(),tokens:tokens)
            check(local.padding==(density <= -2 ? 8:12),"Local density \(density) resolves actual global inset payload")
        }
        let inherited=AWCNativeSegmentedMetrics(properties:["density":-1],inheritedDensity:-4,denseInset:true,appearance:.init(),tokens:tokens)
        check(inherited.height==36 && inherited.padding==8,"Local -1 preserves inherited dense inset")
        let appearance=AWCSegmentedButtonAppearance(containerColor:"#aabbcc",cornerRadius:-1,iconSize:.infinity)
        check(appearance.containerColor=="#AABBCC" && appearance.cornerRadius==nil && appearance.iconSize==nil,"Appearance validates colors and finite nonnegative lengths")
        let narrow=AWCSegmentedShape(start:9999,end:0,rtl:false).path(in:.init(x:0,y:0,width:24,height:40))
        check(!narrow.contains(.init(x:1,y:10)) && narrow.contains(.init(x:12,y:20)),"Single rounded end uses source CSS proportional corner scaling in narrow boxes")
        let children=[segment("a",["value":"","selected":true]),segment("b",["value":"","selected":true]),segment("c",["value":"duplicate"])]
        let store=AWCNativeSegmentedState(children)
        check(children.map{store.selected[$0.id]==true}==[true,true,false],"Initial multiple selection is retained even for a single-select set")
        check(store.commit("b",proposed:true,nodes:children,multiple:false)==[""],"Identity-based single selection accepts duplicate empty values")
        check(store.selected["a"]==false && store.selected["b"]==true,"Only clicked identity remains selected")
        check(store.commit("a",proposed:true,nodes:children,multiple:true)==["",""],"Multi values preserve duplicates and source order")
        store.synchronize(children);check(store.selected["b"]==true && store.selected["a"]==true,"Unchanged authored properties preserve runtime selection")
        store.inject(children,density:-4,multiple:false,depth:0)
        store.inject([children[1]],density:-1,multiple:true,depth:1)
        check(store.injected["b"]?["segmentDensity"] == -4,"Initial outer synchronization wins over nested load order")
        store.inject([children[1]],density:-1,multiple:true)
        check(store.injected["b"]?["segmentDensity"] == -1,"Later inner synchronization can replace managed properties")
    }
    static func oracle(){
        let url=URL(fileURLWithPath:#filePath).deletingLastPathComponent().appendingPathComponent("Fixtures/segmented-web-geometry.json")
        let document=try! JSONDecoder().decode(AWCValue.self,from:Data(contentsOf:url))
        for entry in document["results"].array {
            let fixture=entry["fixture"].object,id=fixture["id"]!.string,isSet=fixture["set"]?.bool==true
            var properties=fixture;for key in ["id","set","children","content","slot","style","width","direction"] {properties[key]=nil}
            let children:[AWCNode]
            if isSet {children=(fixture["children"]?.array ?? []).enumerated().map{segment("\(id)-\($0.offset)",$0.element.object)}}
            else {
                var slots:[AWCNode]=[]
                if let content=fixture["content"] {slots.append(.text(content.string))}
                if let icon=fixture["slot"] {slots.append(.slotText(icon.string,slot:"icon"))}
                children=slots
            }
            let node=isSet ? set(children,properties,id:id):AWCNode(id:id,tag:"md-segmented-button",properties:properties,children:children)
            install(node,appearance:.init(values:fixture["style"]?.object ?? [:]),width:fixture["width"]?.number.map{CGFloat($0)},rtl:fixture["direction"]?.string=="rtl")
            let expected=entry[isSet ? "set":"host"]
            check(near(bounds().width,expected["width"].number!,isSet ? 1.8:0.8),"\(id) actual width \(bounds().width) matches Web \(expected["width"])")
            check(near(bounds().height,expected["height"].number!,0.01),"\(id) actual height \(bounds().height) matches Web")
            if isSet {
                for (index,child) in children.enumerated(){
                    let actual=childBounds(child.id),web=entry["children"].array[index]["host"]
                    check(near(actual.width,web["width"].number!),"\(id) child\(index) equal track/seam width \(actual.width)")
                    check(near(actual.minX-bounds().minX,web["x"].number!-expected["x"].number!,1.8),"\(id) child\(index) placement with accumulated native text rounding")
                    let track=bounds().width/CGFloat(children.count),rtl=fixture["direction"]?.string=="rtl"
                    let exact=rtl ? bounds().width-CGFloat(index+1)*track:CGFloat(index)*track-(index==children.count-1 && index != 0 ? 1:0)
                    check(near(actual.minX-bounds().minX,Double(exact),0.26),"\(id) child\(index) exact native equal-column and seam formula (physical-pixel alignment)")
                    check(responder(child.id)?.accessibilityRole()==(properties["multiselect"]?.bool==true ? .checkBox:.radioButton),"\(id) actual native checked role")
                }
            } else {
                let typography=state.inspected.first{$0.id=="component"}?.metrics["typography"]?.object ?? [:]
                check(typography["size"]?.number==Double(expected["fontSize"].string.replacingOccurrences(of:"px",with:"")),"\(id) actual applied typography size")
                if case .object(let graphic)=entry["graphic"] {
                    let part=properties["selected"]?.bool==true && properties["noCheckmark"]?.bool != true ? "component.checkmark":(properties["icon"]?.string ?? "").isEmpty ? "component.graphic-reservation":"component.icon"
                    check(near(bounds(part).width,graphic["width"]!.number!,0.01),"\(id) actual graphic width")
                }
                if case .object(let label)=entry["label"] {
                    check(near(bounds("component.label").height,label["height"]!.number!,0.01),"\(id) label line box")
                }
            }
        }
    }
    static func narrowOracle(){
        let url=URL(fileURLWithPath:#filePath).deletingLastPathComponent().appendingPathComponent("Fixtures/segmented-web-narrow-geometry.json")
        let document=try! JSONDecoder().decode(AWCValue.self,from:Data(contentsOf:url))
        for entry in document["results"].array {
            let f=entry["fixture"], children=[segment("narrow-day",["label":"Day"]),segment("narrow-week",["label":"Week"]),segment("narrow-month",["label":"Month"])]
            install(set(children,["density":f["density"]]),width:CGFloat(f["width"].number!),rtl:f["direction"].string=="rtl")
            check(near(bounds().width,f["width"].number!,0.01),"\(f["id"]) preserves constrained host width")
            for (index,child) in children.enumerated(){
                let actual=childBounds(child.id),expected=entry["children"].array[index]
                check(near(actual.width,expected["host"]["bounds"]["width"].number!,0.01),"\(f["id"]) child\(index) minimum grid track width")
                check(near(actual.minX-bounds().minX,expected["relative"]["x"].number!,0.01),"\(f["id"]) child\(index) actual overflow placement")
            }
        }
    }
    static func interactions(){
        install(segment("single",["value":"v"]))
        key("single",36,"\r")
        check(responder("single")?.configuration?.policy.selected==false,"Standalone activation proposes state without mutating controlled selected")
        check(state.events.last?.detail==["value":"v","selected":true],"Standalone source event detail is exact")
        state.node.properties["segmentMultiselect"]=true;state.node.properties["selected"]=true;pump()
        key("single",49," ")
        check(state.events.last?.detail==["value":"v","selected":false] && responder("single")?.configuration?.policy.selected==true,"Standalone multiselect toggles proposal only")
        install(set([segment("a",["value":"","selected":true]),segment("b",["value":""]),segment("c",["value":"c"])]))
        check(["a","b","c"].allSatisfy{responder($0)?.canBecomeKeyView==true},"Every enabled segment remains a sequential tab stop")
        state.cancel=true;key("b",36,"\r")
        check(state.selection==[false,true,false],"Set commits despite preventDefault on internal source event")
        check(state.events.map(\.name)==["mdChange"] && state.events.last?.detail==[""],"Set consumes internal event and emits exact array")
        check(state.targetEvents.map(\.name)==["mdSegmentClick","mdChange"],"Internal target event precedes committed set change")
        state.cancel=false;state.stop=true;key("c",36,"\r")
        check(state.selection==[false,true,false] && state.events.count==1,"Target stopPropagation prevents set receipt")
        state.stop=false;key("b",124,"\u{f703}")
        check(state.selection==[false,false,true] && window.firstResponder===responder("c"),"Right arrow focuses and selects next identity")
        state.rtl=true;pump();key("c",125,"\u{f701}")
        check(state.selection==[true,false,false] && window.firstResponder===responder("a"),"Down arrow wraps source order even in RTL")
        state.node.children[1].properties["disabled"]=true;pump();key("a",124,"\u{f703}")
        check(window.firstResponder===responder("c"),"Arrow skips hard-disabled segment")
        state.node.children[1].properties["disabled"]=false;state.node.children[1].properties["softDisabled"]=true;pump();key("a",124,"\u{f703}")
        check(window.firstResponder===responder("b") && state.selection==[false,false,true],"Arrow includes soft-disabled focus but activation remains blocked")
        state.node.properties["multiselect"]=true;pump();let before=state.selection;key("c",123,"\u{f702}")
        check(state.selection==before && window.firstResponder===responder("b"),"Multiselect arrows move focus without changing selection")
        state.node.children[1].properties["softDisabled"]=false;pump();key("b",36,"\r")
        check(state.selection==[false,true,true] && state.events.last?.detail==["","c"],"Multiselect commits ordered identities")
        state.node.children.swapAt(0,2);pump()
        check(state.selection==[true,true,false],"Reorder retains selected identities and publishes new authored order")
        state.node.children[1].properties["selected"]=true;pump()
        state.node.children[1].properties["selected"]=false;pump()
        check(state.selection==[true,false,false],"Changed authored selected property replaces runtime state")
        key("b",36,"\r")
        state.node.children.removeAll{$0.id=="b"};pump()
        state.node.children.append(segment("b",["value":"","selected":false]));pump()
        check(state.selection.last==false,"Removed then recreated identity starts from fresh authored selection")
        install(segment("soft",["softDisabled":true]))
        check(responder("soft")?.acceptsFirstResponder==true && responder("soft")?.accessibilityPerformPress()==false,"Standalone soft-disabled remains focusable and blocks activation")
        install(segment("hard",["disabled":true]))
        check(responder("hard")?.acceptsFirstResponder==false,"Hard-disabled removes programmatic and sequential focus")
        install(segment("hidden",["hidden":true]))
        check(responder("hidden")==nil && bounds().isNull,"Hidden removes visual and native responder")
        install(set([segment("outer"),set([segment("inner-a"),segment("inner-b")],["density":-1,"multiselect":true],id:"inner")],["density":-4]))
        check(responder("inner-a")?.configuration?.policy.role == .radio,"Initial outer synchronization reaches nested descendants")
        key("inner-b",36,"\r")
        check(state.events.last?.nodeID=="inner" && state.events.last?.detail==[""],"Nearest set consumes nested activation")
        check(state.selection==[false,false,true],"Outer actual selection observes nested descendant commit")
        state.node.children[1].properties["density"] = -2;pump()
        check(responder("inner-a")?.configuration?.policy.role == .checkbox,"Later inner synchronization wins managed properties")
        state.node.properties["density"] = -3;pump()
        check(responder("inner-a")?.configuration?.policy.role == .radio,"Later outer synchronization replaces inner managed properties again")
        install(segment("slot",["label":"","icon":"add"],[]))
        state.node.children=[.text("Added")];pump()
        check(bounds("component.label").isNull && bounds().width>42,"Late default slot content remains visible outside initially absent label wrapper")
        install(segment("whitespace",["label":"Day view"]))
        let plain=bounds().size
        state.node.properties["label"]="Day\n  view";pump()
        check(bounds().size==plain && responder("whitespace")?.accessibilityLabel()=="Day\n  view","Visible label collapses ASCII whitespace but accessible name remains authored")
        install(segment("nbsp",["label":"","noCheckmark":true],[.text("\u{00a0}Week\u{00a0}")]))
        let spaced=bounds().width
        install(segment("plain",["label":"","noCheckmark":true],[.text("Week")]))
        check(spaced>bounds().width+5,"Default slot preserves NBSP advances instead of trimming them as CSS whitespace")
        state.inheritedDensity = -2.5;pump()
        check(bounds().height==30 && state.inspected.first{$0.id=="component"}?.metrics["padding"] == [0,8,0,8],"Public awcDensity supplies finite inherited noncanonical scale and dense inset")
        state.node.properties["density"] = -1;pump()
        check(bounds().height==36 && state.inspected.first{$0.id=="component"}?.metrics["padding"] == [0,8,0,8],"Local rung overrides public inherited scale without resetting its spacing token")
    }
    static func palette(){
        func overBlack(_ hex:String,_ alpha:Double)->String {
            let value=UInt32(hex.dropFirst(),radix:16)!
            return "#"+[value>>16,(value>>8)&255,value&255].map{String(format:"%02X",Int((Double($0)*alpha).rounded()))}.joined()
        }
        let style=AWCSegmentedButtonAppearance(containerColor:"#112233",selectedContainerColor:"#345678",labelColor:"#ABCDEF",selectedLabelColor:"#FEDCBA",outlineColor:"#00FF00",cornerRadius:0,iconSize:26)
        install(segment("palette"),appearance:style)
        check(count("#112233",pixels())>1000 && count("#00FF00",pixels())>50,"Unselected custom container and outline paint")
        state.node.properties["selected"]=true;pump()
        check(count("#345678",pixels())>1000 && count("#FEDCBA",pixels())>8,"Selected custom container and ink paint")
        state.node.properties["disabled"]=true;pump()
        check(count("#345678",pixels())==0 && count("#FEDCBA",pixels())==0 && count("#00FF00",pixels())==0,"Disabled selected palette overrides authored color hooks")
        state.node.properties["selected"]=false;pump()
        check(count("#112233",pixels())>1000,"Disabled unselected retains authored container")
        install(set([segment("a"),segment("b"),segment("c")]))
        state.localID="a";state.localAppearance = .init(containerColor:"#FF0000",iconSize:30);pump()
        check(childBounds("a").width==childBounds("b").width,"Scoped custom icon affects equal track sizing")
        check(count("#FF0000",pixels())>1000,"Targeted appearance reaches authored first child")
        // One child's area in device pixels: ×4 is the 2× macOS backing; the iPhone simulator renders 3×.
        let shot=pixels(),pixelScale=(Double(shot.count/4)/Double(host.bounds.width*host.bounds.height)).squareRoot()
        check(count("#FF0000",shot)<Int(Double(childBounds("a").width*childBounds("a").height)*pixelScale*pixelScale),"Targeted appearance does not paint every sibling")
        install(segment("layer"),appearance:.init(containerColor:"#000000",labelColor:"#FF0000",cornerRadius:0))
        let layer=AWCGeneratedTokens.light["--md-sys-color-on-surface"]!
        state.pointer.update(phase:.move,location:.init(x:bounds().midX,y:bounds().midY));pump(0.15)
        check(count(overBlack(layer,0.08),pixels())>1000,"Hover layer uses source theme ink, independently of the label color override")
        _ = window.makeFirstResponder(responder("layer"));pump(0.15)
        let focusAlpha=Double(AWCGeneratedTokens.light["--md-sys-state-focus-state-layer-opacity"] ?? "") ?? 0.10
        check(count(overBlack(layer,focusAlpha),pixels())>1000,"Focused layer paints source token opacity above hover")
    }
    static func main(){
        _ = NSApplication.shared;NSApp.setActivationPolicy(.accessory)
        host=NSHostingView(rootView:SegmentedFixture(state:state))
        window=NSWindow(contentRect:.init(x:-20000,y:-20000,width:640,height:240),styleMask:.borderless,backing:.buffered,defer:false)
        window.isReleasedWhenClosed=false;window.colorSpace = .sRGB;window.contentView=host;window.orderFrontRegardless();pump(0.2)
        defer{window.close()}
        contracts();oracle();narrowOracle();interactions();palette()
        print("Segmented: \(checks-failures.count)/\(checks) checks passed against 35 measured Web fixtures.")
        fflush(stdout)
        precondition(failures.isEmpty,failures.joined(separator:"\n"))
    }
}
