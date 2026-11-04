import AppKit
import SwiftUI
import Observation
import AWCUI

@Observable final class GroupFixtureState {
    var node = AWCNode(id:"group",tag:"md-button-group",children:[])
    var appearance = AWCButtonGroupAppearance()
    var buttonAppearance = AWCButtonAppearance()
    var epoch = 0
    var width: CGFloat = 600
    var rtl = false
    var cancelChild = false
    var cancelGroup = false
    var nodes: [AWCNativeInspectionNode] = []
    var selection: [Bool] = []
    var events: [AWCEvent] = []
    let pointer = AWCNativePointerState()
}
struct GroupFixture: View {
    let state: GroupFixtureState
    var body: some View {
        AWCEventScope(id:"outer",onCapture:{ event in
            if state.cancelChild && event.event.name == "mdClick" { event.preventDefault(); event.stopPropagation() }
            if state.cancelGroup && event.event.name == "mdSelectionChange" { event.preventDefault() }
        },onEvent:{_ in}) {
            AWCNativeView(node:state.node,onEvent:{state.events.append($0)})
                .awcButtonGroupAppearance(state.appearance).awcButtonAppearance(state.buttonAppearance)
                .awcButtonGroupSelection(rootID:state.node.id){state.selection=$0}
                .awcNativeInspection(rootID:state.node.id,coordinateSpace:"awc-native-preview"){state.nodes=$0}.id(state.epoch)
        }.frame(width:state.width).padding(24).frame(width:800,height:300)
            .background(Color.white).awcTheme(.generated()).environment(\.colorScheme,.light)
            .transaction { $0.disablesAnimations=true }
            .environment(\.layoutDirection,state.rtl ? .rightToLeft : .leftToRight)
            .environment(\.awcNativePointerState,state.pointer).coordinateSpace(name:"awc-native-preview")
    }
}
@main @MainActor enum NativeButtonGroupViewIntegration {
    static var checks = 0
    static func check(_ valid:Bool,_ message:String) { checks += 1; precondition(valid,message) }
    static func pump(_ time:TimeInterval = 0.075) { let end=Date().addingTimeInterval(time); while Date()<end { _ = RunLoop.current.run(mode:.default,before:Date().addingTimeInterval(0.003)) } }
    static func descendants(_ view:NSView)->[NSView] { [view]+view.subviews.flatMap(descendants) }
    static func main() {
        _ = NSApplication.shared; NSApp.setActivationPolicy(.accessory)
        let state=GroupFixtureState(), host=NSHostingView(rootView:GroupFixture(state:GroupFixtureState()))
        host.rootView = GroupFixture(state:state)
        let window=NSWindow(contentRect:.init(x:-20000,y:-20000,width:800,height:300),styleMask:.borderless,backing:.buffered,defer:false)
        window.isReleasedWhenClosed=false; window.contentView=host; window.orderFrontRegardless(); pump(0.2)
        defer { window.close() }
        func text(_ id:String,_ selected:Bool=false,_ properties:[String:AWCValue]=[:]) -> AWCNode {
            .init(id:id,tag:"md-button",properties:["value":.string(id),"selected":.bool(selected),"ripple":false].merging(properties){_,new in new},children:[.text(id == "a" ? "Day" : id == "b" ? "Week" : "Month")])
        }
        func icon(_ id:String="b")->AWCNode { .init(id:id,tag:"md-icon-button",properties:["icon":"favorite","value":.string(id),"ripple":false,"aria-label":"Favorite"]) }
        func set(_ props:[String:AWCValue]=[:],_ appearance:AWCButtonGroupAppearance = .init(),_ children:[AWCNode]? = nil) {
            state.node = .init(id:"group",tag:"md-button-group",properties:props,children:children ?? [text("a",true),text("b"),text("c")]); state.appearance=appearance
            state.epoch += 1; state.width=600; state.rtl=false; state.cancelChild=false; state.cancelGroup=false; state.buttonAppearance = .init(); state.events=[]; state.nodes=[]; state.pointer.update(phase:.leave)
            _ = window.makeFirstResponder(nil); pump()
        }
        func bounds(_ part:String="component")->CGRect { state.nodes.first{$0.id == part}?.bounds ?? .null }
        func childBounds(_ id:String)->CGRect { bounds("component.child."+id) }
        func near(_ x:CGFloat,_ y:CGFloat)->Bool { abs(x-y)<0.7 }
        func responder(_ id:String)->NSView { descendants(host).last{String(describing:type(of:$0)).contains("AWCNativeButtonFocusView") && $0.accessibilityIdentifier()==id}! }
        func key(_ id:String,_ value:String,_ code:UInt16) { _ = window.makeFirstResponder(responder(id)); let event=NSEvent.keyEvent(with:.keyDown,location:.zero,modifierFlags:[],timestamp:ProcessInfo.processInfo.systemUptime,windowNumber:window.windowNumber,context:nil,characters:value,charactersIgnoringModifiers:value,isARepeat:false,keyCode:code)!; window.sendEvent(event); pump() }
        func mouse(_ id:String,_ down:Bool) {
            let r=responder(id),point=r.convert(NSPoint(x:r.bounds.midX,y:r.bounds.midY),to:nil),b=r.convert(r.bounds,to:host)
            state.pointer.update(phase:down ? .down : .up,location:CGPoint(x:b.midX,y:b.midY))
            let event=NSEvent.mouseEvent(with:down ? .leftMouseDown:.leftMouseUp,location:point,modifierFlags:[],timestamp:ProcessInfo.processInfo.systemUptime,windowNumber:window.windowNumber,context:nil,eventNumber:1,clickCount:1,pressure:down ? 1:0)!
            window.sendEvent(event); pump(down ? 0.02:0.08)
        }
        let sizes=["xs","sm","md","lg","xl"],heights:[CGFloat]=[32,40,56,96,136]
        for (index,size) in sizes.enumerated() { for density in 0...4 {
            set(["size":.string(size),"density":.number(Double(-density))])
            let expected=max(24,heights[index]-CGFloat(density*4))
            check(near(bounds().height,expected) && ["a","b","c"].allSatisfy{near(childBounds($0).height,expected)},"\(size)/\(-density) actual text child heights expected\(expected): group\(bounds()) children\(["a","b","c"].map{childBounds($0)})")
            let d=Double(density)
            let gap=CGFloat(size == "xs" ? max(10.0,18-d*2) : size == "sm" ? max(6.0,12-d*1.5) : max(4.0,8-d))
            check(near(childBounds("b").minX-childBounds("a").maxX,gap),"\(size)/\(-density) actual source tapered gap")
        } }
        set([:],.init(height:72),[text("a"),icon(),text("c")]); check(near(bounds().height,72) && near(childBounds("a").height,72) && near(childBounds("b").height,40),"Mixed sm explicit group height stretches text but keeps icon definite40")
        set([:],.init(height:20),[text("a"),icon(),text("c")]); check(near(bounds().height,20) && ["a","b","c"].allSatisfy{near(childBounds($0).height,40)},"Small group height lets minimum children overflow")
        set(["size":"lg"],.init(height:72),[text("a"),icon(),text("c")]); check(["a","b","c"].allSatisfy{near(childBounds($0).height,96)},"Large child minimum height overflows72 group")
        set(["size":"lg"],.init(maxHeight:40),[text("a"),icon(),text("c")]); check(near(bounds().height,40) && ["a","b","c"].allSatisfy{near(childBounds($0).height,40)},"Group maximum height updates text minimum and clips both child size classes")
        for (width,textWidth,iconWidth):(CGFloat,CGFloat,CGFloat) in [(600,202.667,170.667),(300,102.667,70.667),(200,69.333,37.333)] {
            set(["fullWidth":true],.init(width:100),[text("a"),icon(),text("c")]); state.width=width; pump()
            check(near(bounds().width,width) && near(childBounds("a").width,textWidth) && near(childBounds("b").width,iconWidth) && near(childBounds("c").width,textWidth),"CSS flex equal content basis at parent\(width): padding is added per child, explicit group width ignored")
        }
        set(["variant":"connected","size":"xs","fullWidth":true],.init(),[text("a"),icon(),text("c")]); state.width=80; pump()
        check(near(bounds().width,80) && ["a","b","c"].allSatisfy{near(childBounds($0).width,48)},"Connected xs minimum48 overflows narrow full-width group")
        set([:],.init(gap:0,width:280,minWidth:300,maxWidth:200,height:72,minHeight:80,maxHeight:60))
        check(near(bounds().width,300) && near(bounds().height,80) && near(childBounds("b").minX-childBounds("a").maxX,0),"Seven layout hooks: min wins max conflict and explicit zero gap")
        set(["density":-4],.init(),[text("a",false,["density":-1]),icon(),text("c")]); check(near(childBounds("a").height,36) && near(childBounds("b").height,32) && near(childBounds("c").height,36),"Child negative density overrides inherited density; auto text siblings stretch to tallest")
        set(); state.rtl=true; pump(); check(childBounds("a").minX>childBounds("c").minX,"RTL reverses visual order without changing authored identity")
        check(state.selection == [true,false,false],"Frame preference exposes exact initial ordered state")
        key("a",String(UnicodeScalar(NSLeftArrowFunctionKey)!),123)
        check((window.firstResponder as? NSView)?.accessibilityIdentifier()=="b" && state.events.isEmpty && state.selection == [true,false,false],"RTL Left roves focus forward without selection or events")
        key("b",String(UnicodeScalar(NSHomeFunctionKey)!),115); check((window.firstResponder as? NSView)?.accessibilityIdentifier()=="a","Home focuses first authored eligible child")
        key("a",String(UnicodeScalar(NSEndFunctionKey)!),119); check((window.firstResponder as? NSView)?.accessibilityIdentifier()=="c","End focuses last authored eligible child")
        set(); key("b"," ",49)
        check(state.events.map(\.name)==["mdClick","mdChange","mdSelectionChange"] && state.selection == [false,true,false],"Keyboard child action precedes raw group reconciliation")
        check(state.events.last?.detail == ["values":["b"],"added":["b"],"removed":["a"]] && state.events.first?.activation == state.events.last?.activation,"Group event exact committed diff shares activation identity")
        set(["required":true]); key("a","\r",36); check(state.selection == [true,false,false] && state.events.last?.detail == ["values":["a"],"added":[],"removed":[]],"Required restores child after deselection and still emits empty group diff")
        set(["selectionMode":"multi-select"]); key("b","\r",36); check(state.selection == [true,true,false],"Multi-select preserves other child state")
        set(); state.cancelChild=true; key("b","\r",36)
        check(state.events.map(\.name)==["mdClick","mdSelectionChange"] && state.events.first?.defaultPrevented == true && state.selection == [false,false,false],"Canceled/stopped mdClick still permits separate raw-click group reconciliation, without child toggle")
        set(); state.cancelGroup=true; key("b","\r",36); check(state.selection == [false,true,false] && state.events.last?.defaultPrevented == true,"Cancelable group notification cannot undo committed selection")
        set([:],.init(),[text("a",true),text("b",false,["softDisabled":true]),text("c")]); mouse("b",true); mouse("b",false)
        check(state.events.map(\.name)==["mdSelectionChange"] && state.selection == [false,false,false],"Soft-disabled pointer still bubbles raw click to group while child emits nothing")
        set([:],.init(),[text("a",true),text("b",false,["loading":true]),text("c")]); mouse("b",true); mouse("b",false)
        check(state.events.map(\.name)==["mdSelectionChange"] && state.selection == [false,false,false],"Loading pointer preserves source raw-click quirk")
        set([:],.init(),[text("a",true),text("b",false,["disabled":true]),text("c")]); mouse("b",true); mouse("b",false)
        check(state.events.isEmpty && state.selection == [true,false,false] && !responder("b").acceptsFirstResponder,"Hard-disabled pointer and focus excluded: events\(state.events.map(\.name)), selection\(state.selection), accepts\(responder("b").acceptsFirstResponder)")
        set([:],.init(),[text("a",true),icon(),text("c")]); mouse("b",true); check(state.events.isEmpty,"Held group pointer does not activate before release"); mouse("b",false)
        check(state.events.map(\.name)==["mdClick","mdSelectionChange"] && state.selection == [false,true,false],"Mixed icon child emits no mdChange before group event")
        set([:],.init(),[text("a",true),.init(id:"inner",tag:"md-button-group",properties:["selectionMode":"multi-select"],children:[text("b"),text("c")])])
        key("c",String(UnicodeScalar(NSRightArrowFunctionKey)!),124)
        check((window.firstResponder as? NSView)?.accessibilityIdentifier()=="a","Nested arrow bubbles to outer group broad descendant ordering")
        state.events=[]; key("b","\r",36)
        check(state.events.map(\.name)==["mdClick","mdChange","mdSelectionChange","mdSelectionChange"] && state.selection == [false,true,false],"Nested raw click reconciles inner then outer groups and exact outer state")
        set(["size":"lg","shape":"round","variant":"connected"],.init(),[text("a"),.init(id:"inner",tag:"md-button-group",properties:["size":"xs","shape":"square","variant":"standard"],children:[text("b"),icon("c")])])
        check(near(responder("a").bounds.height,96) && near(responder("b").bounds.height,96),"Nested initial parent source sync wins over inner authored size: a\(responder("a").bounds.height), b\(responder("b").bounds.height)")
        state.node.children[1].properties["size"]="md"; state.node.children[1].properties["shape"]="round"; pump()
        check(near(responder("a").bounds.height,96) && near(responder("b").bounds.height,96) && near(responder("c").bounds.height,56),"Later inner size sync owns inner properties while text stretches to outer96 and fixed icon remains56")
        state.node.properties["size"]="sm"; state.node.properties["shape"]="square"; pump()
        check(near(responder("a").bounds.height,40) && near(responder("b").bounds.height,40),"Later outer size/shape sync overrides all descendant properties")
        state.node.children[1].properties["variant"]="connected"; pump()
        check(near(responder("a").bounds.height,56) && near(responder("b").bounds.height,56) && near(responder("c").bounds.height,56),"Inner variant re-injects authored md/round; outer sm text stretches to56")
        set(["density":-4],.init(),[text("a"),.init(id:"wrapper",tag:"md-card",children:[text("b")])])
        check(near(responder("b").bounds.height,24),"Wrapped child inherits group density through structural slot composition")
        let wrappedWidth=responder("b").bounds.width; mouse("b",true); pump(0.1)
        check(responder("b").bounds.width>wrappedWidth+5,"Wrapped descendant receives source group neighbor motion"); mouse("b",false); pump(0.45)
        set(); let original=childBounds("a").width; mouse("a",true); pump(0.1)
        check(childBounds("a").width>original+5,"Standard pressed group expands actual padding during source400ms motion")
        mouse("a",false); pump(0.45); check(near(childBounds("a").width,original),"Released group motion completes to original layout")
        set(["variant":"connected"]); state.node.properties["variant"]="standard"; pump(); let unchanged=childBounds("a").width; mouse("a",true); pump(0.1)
        check(near(childBounds("a").width,unchanged),"Initially connected group keeps source no-listener behavior after changing to standard"); mouse("a",false)
        print("Passed \(checks) real native button-group layout, keyboard, pointer, motion, event and ordered-selection checks.")
    }
}
