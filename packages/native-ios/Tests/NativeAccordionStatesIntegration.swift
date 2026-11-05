import AppKit
import SwiftUI
import Observation
import QuartzCore
@testable import AWCUI

// Header state layer, grip hover/drag and md-ripple feedback against Chrome
// trusted-input records (states.html): same steps, source transition timings,
// rendered per-frame values and press-point ripple paint.
@Observable final class AccordionStatesFixtureState {
    var node=AWCNode(id:"accordion",tag:"md-accordion")
    var epoch=0
    var dark=false
    var reduced=false
    var inspect="b"
    var measurements:[AWCNativeInspectionNode]=[]
    let pointer=AWCNativePointerState()
}
struct AccordionStatesFixture:View {
    let state:AccordionStatesFixtureState
    var body:some View {
        let epoch=state.epoch,theme=AWCTheme.generated(dark:state.dark)
        AWCNativeAccordionGroup(node:state.node,theme:theme,onEvent:{_ in})
            .environment(\.awcAccordionReducedMotion,state.reduced)
            .awcTheme(theme).frame(width:400)
            .awcNativeInspection(rootID:state.inspect,coordinateSpace:"awc-native-preview"){if state.epoch==epoch{state.measurements=$0}}
            .id(epoch).padding(40).frame(maxWidth:.infinity,maxHeight:.infinity,alignment:.topLeading)
            .environment(\.awcNativePointerState,state.pointer)
            .background(theme.background).coordinateSpace(name:"awc-native-preview")
    }
}
@main @MainActor enum NativeAccordionStatesIntegration {
    static let state=AccordionStatesFixtureState()
    static var host:NSHostingView<AccordionStatesFixture>!,window:NSWindow!
    static var checks=0,failures:[String]=[]
    static var report:[[String:Any]]=[]
    static var debug:[[String:Any]]=[]
    static func check(_ value:Bool,_ name:String){checks+=1;if !value{failures.append(name);print("FAIL: "+name);fflush(stdout)}}
    static func pump(_ duration:Double=0.1){let end=Date().addingTimeInterval(duration);repeat{while let e=NSApp.nextEvent(matching:.any,until:.distantPast,inMode:.default,dequeue:true){NSApp.sendEvent(e)};host.layoutSubtreeIfNeeded();host.displayIfNeeded();_ = RunLoop.current.run(mode:.default,before:Date().addingTimeInterval(0.002))}while Date()<end}
    static func mouse(_ kind:NSEvent.EventType,_ p:CGPoint){let point=host.convert(.init(x:p.x,y:host.isFlipped ? p.y:host.bounds.height-p.y),to:nil);let e=NSEvent.mouseEvent(with:kind,location:point,modifierFlags:[],timestamp:ProcessInfo.processInfo.systemUptime,windowNumber:window.windowNumber,context:nil,eventNumber:1,clickCount:1,pressure:kind == .leftMouseUp ? 0:1)!;window.sendEvent(e)}
    static func key(_ code:UInt16,_ text:String){let e=NSEvent.keyEvent(with:.keyDown,location:.zero,modifierFlags:[],timestamp:ProcessInfo.processInfo.systemUptime,windowNumber:window.windowNumber,context:nil,characters:text,charactersIgnoringModifiers:text,isARepeat:false,keyCode:code)!;window.sendEvent(e)}
    static func now()->Double{CACurrentMediaTime()*1000}
    /// Values carry the time at which the renderer computed them (`renderTime`), so the
    /// inspection/preference pipeline latency does not shift the comparison.
    struct Sample{let t:Double;let stateT:Double?;let gripT:Double?;let state:Double?;let gripOpacity:Double?;let gripScale:Double?;let gripColor:[Double]?}
    static func sample()->Sample{
        let m=state.measurements
        let layer=m.first{$0.name=="state-layer"},grip=m.first{$0.name=="drag-handle-paint"}
        return .init(t:now(),stateT:layer?.metrics["renderTime"]?.number,gripT:grip?.metrics["renderTime"]?.number,state:layer?.metrics["opacity"]?.number,gripOpacity:grip?.metrics["opacity"]?.number,gripScale:grip?.metrics["scale"]?.number,
                     gripColor:grip?.metrics["color"]?.array.compactMap{$0.number})
    }
    static func css(_ v:AWCValue)->[Double]{
        // rgb()/rgba()/opacity/scale()/none → numeric components
        let s=v.string
        if s=="none" {return [1]}
        let n=s.split(whereSeparator:{!"0123456789.-".contains($0)}).compactMap{Double($0)}
        if s.hasPrefix("rgb") {return n.count>=3 ? [n[0]/255,n[1]/255,n[2]/255]:[]}
        return n
    }
    struct Expected{var start:Double;var duration:Double;var curve:[Double];var from:[Double];var to:[Double]}
    static func value(_ list:[Expected],_ initial:[Double],_ t:Double)->[Double]{
        guard let e=list.last(where:{$0.start<=t}) else {return initial}
        if e.duration<=0 || t>=e.start+e.duration {return e.to}
        let x=(t-e.start)/e.duration,p=AWCNativeLoadingMotion.cubic(x,e.curve[0],e.curve[1],e.curve[2],e.curve[3])
        return zip(e.from,e.to).map{$0+($1-$0)*p}
    }
    static func curve(_ s:String)->[Double]{s.split(whereSeparator:{!"0123456789.-".contains($0)}).compactMap{Double($0)}}
    static func run(_ c:AWCValue){
        let theme=c["theme"].string,preset=c["preset"].string,scenario=c["scenario"].string,reduced=c["reduced"] == .bool(true),target=c["target"].string
        let label="\(theme)/\(preset)\(reduced ? "-reduced":"")/\(scenario)"
        state.dark=theme=="dark";state.reduced=reduced;state.inspect=target
        state.pointer.update(phase:.leave)
        state.node = .init(id:"accordion",tag:"md-accordion",properties:["reorderable":true,"transition":.string(preset),"variant":"filled"],children:["a","b","c"].enumerated().map{i,id in
            .init(id:id,tag:"md-accordion-item",properties:["headline":.string(id),"expanded":.bool(i==0),"disabled":.bool(i==2 && scenario=="disabled")],children:[.text("Body")])})
        state.epoch+=1;pump(0.4);_ = window.makeFirstResponder(nil);pump(0.05)
        let origin=CGPoint(x:40,y:40)
        let header=CGPoint(x:origin.x+c["points"]["header"].array[0].number!,y:origin.y+c["points"]["header"].array[1].number!)
        let grip=CGPoint(x:origin.x+c["points"]["grip"].array[0].number!,y:origin.y+c["points"]["grip"].array[1].number!)
        var samples:[Sample]=[],stepTimes:[String:Double]=[:]
        let steps=c["steps"].array,t0=now(),webT0=steps.first?["t"].number ?? 0
        var next=0,heldPoint:CGPoint?
        let end=(c["samples"].array.last?["t"].number ?? 800)+50
        while now()-t0<end {
            while next<steps.count && now()-t0 >= steps[next]["t"].number!-webT0 {
                let s=steps[next],name=s["label"].string;stepTimes[name]=now()
                switch (scenario,name) {
                case (_, "enter"): state.pointer.update(phase:.move,location:scenario.hasPrefix("grip") ? grip:header)
                case (_, "leave"): state.pointer.update(phase:.leave)
                case ("press","down"): heldPoint=header;state.pointer.update(phase:.down,location:header);mouse(.leftMouseDown,header)
                case ("press","up"): mouse(.leftMouseUp,header);state.pointer.update(phase:.up,location:header)
                case ("grip-drag","down"): heldPoint=grip;state.pointer.update(phase:.down,location:grip);mouse(.leftMouseDown,grip)
                case ("grip-drag","move"): let p=CGPoint(x:grip.x,y:grip.y+20);state.pointer.update(phase:.move,location:p);mouse(.leftMouseDragged,p)
                case ("grip-drag","up"): let p=CGPoint(x:grip.x,y:grip.y+20);mouse(.leftMouseUp,p);state.pointer.update(phase:.up,location:p)
                case ("focus","tab"),("focus","tab2"): key(48,"\t")
                default: break
                }
                next+=1
            }
                pump(0.004);samples.append(sample())
            if ProcessInfo.processInfo.environment["AWC_ACCORDION_STATES_DEBUG"] != nil, let g=state.measurements.first(where:{$0.name=="drag-handle-paint"}) {
                debug.append(["case":label,"t":now()-t0,"metrics":g.metrics.mapValues{"\($0)"}])
            }
        }
        _ = heldPoint
        // Expected values come from Chrome's own per-frame samples, aligned to the step that
        // caused them (piecewise linear between frames); source timings are checked separately.
        // Chrome step time = actual trusted-event delivery (the CDP round trip delays it).
        let webSteps=steps.map{($0["label"].string,$0["input"].number ?? $0["t"].number!)}
        let web=c["samples"].array
        // Before Chrome's first rAF sample the value is given by its own transition record
        // (the first transition can start, in frame time, before the step that caused it).
        var leading:[String:AWCValue]=[:]
        for a in c["anims"].array where leading[a["part"].string+"/"+a["property"].string]==nil { leading[a["part"].string+"/"+a["property"].string]=a }
        func webValue(_ read:(AWCValue)->[Double],_ t:Double,_ key:String="",_ field:String="")->[Double]{
            if let first=web.first,t<first["t"].number!,let a=leading[key] {
                let from=css(a["from"][field]),to=css(a["to"][field]),start=a["startTime"].number!,d=a["duration"].number!,k=curve(a["easing"].string)
                if t<=start || from.count != to.count {return t<=start && from.count==read(first).count ? from:read(first)}
                let x=min(1,(t-start)/max(d,1e-9)),p=AWCNativeLoadingMotion.cubic(x,k[0],k[1],k[2],k[3])
                return zip(from,to).map{$0+($1-$0)*p}
            }
            guard let after=web.firstIndex(where:{$0["t"].number!>=t}) else {return read(web.last!)}
            if after==0 {return read(web[0])}
            let a=web[after-1],b=web[after],ta=a["t"].number!,tb=b["t"].number!,va=read(a),vb=read(b)
            let x=tb>ta ? (t-ta)/(tb-ta):1
            return zip(va,vb).map{$0+($1-$0)*x}
        }
        func webTime(_ native:Double)->Double{
            // Most recent native step at or before this native time, mapped to its Chrome step time.
            let done=webSteps.filter{stepTimes[$0.0].map{$0<=native} ?? false}
            guard let step=done.last,let n=stepTimes[step.0] else {return (webSteps.first?.1 ?? 0)+(native-t0)}
            return step.1+(native-n)
        }
        let anims=c["anims"].array
        let disabled=scenario=="disabled"
        let props:[(String,String,String,(AWCValue)->[Double],(Sample)->[Double]?)]=[
            ("state-layer opacity","state-layer","opacity",{[$0["state"]["opacity"].number!]},{s in s.state.map{[$0]}}),
            ("grip opacity","drag-handle","opacity",{[$0["grip"]["opacity"].number!]},{s in s.gripOpacity.map{[$0]}}),
            ("grip scale","drag-handle","transform",{[$0["grip"]["scale"].number!]},{s in s.gripScale.map{[$0]}}),
            ("grip color","drag-handle","color",{css($0["grip"]["color"])},{s in s.gripColor.map{Array($0.prefix(3))}}),
        ]
        var compared=0
        for (name,part,property,readWeb,read) in props {
            if disabled && name=="state-layer opacity" {
                check(!state.measurements.contains{$0.name=="state-layer"},"\(label) disabled header paints no state layer");continue
            }
            if disabled {continue}
            let motion=AWCNativeAccordionMotion(preset:preset,opening:target=="a",reduced:reduced)
            let timing=AWCAccordionInteractionTiming(motion:motion,preset:preset,tokens:AWCTheme.generated(dark:state.dark).tokens)
            let t=name=="grip scale" ? timing.spring:timing.effects
            for a in anims where a["part"].string==part && a["property"].string==property {
                check(abs(t.duration-a["duration"].number!)<0.01 && zip(t.curve,curve(a["easing"].string)).allSatisfy{abs($0-$1)<1e-9},"\(label) \(name) native timing \(t) equals source \(a["duration"].number!) \(a["easing"].string)")
            }
            if anims.allSatisfy({!($0["part"].string==part && $0["property"].string==property)}) {
                check(t.duration==0 || web.allSatisfy{readWeb($0)==readWeb(web[0])},"\(label) \(name) source changes without a transition only when native timing is instant")
            }
            for s in samples {
                guard let v=read(s),!v.isEmpty else {continue}
                // Each value is compared at the time the renderer produced it. A Chrome style change
                // becomes observable at the first rAF sample after the next style recalc (up to two
                // frames after the input) and a Chrome transition's frame-time start can precede the
                // input by up to a frame, while the native renderer starts at its next render: allow
                // two 60 Hz frames of scheduling difference (native leads ≤ 40 ms, trails ≤ 34 ms).
                let at=(name=="state-layer opacity" ? s.stateT:s.gripT) ?? s.t
                var lo=Array(repeating:Double.infinity,count:v.count),hi=Array(repeating:-Double.infinity,count:v.count),x=at-34
                while x<=at+40 { let e=webValue(readWeb,webTime(x),part+"/"+property,property=="transform" ? "transform":property=="color" ? "color":"opacity"); for i in 0..<min(v.count,e.count) {lo[i]=min(lo[i],e[i]);hi[i]=max(hi[i],e[i])}; x+=2 }
                let tol=name=="grip color" ? 0.012:0.002
                check((0..<min(v.count,lo.count)).allSatisfy{v[$0]>=lo[$0]-tol && v[$0]<=hi[$0]+tol},"\(label) \(name) rendered \(v) within Chrome samples [\(lo),\(hi)]");compared+=1
            }
            if let final=samples.last.flatMap(read) { let want=readWeb(web.last!); check(zip(final,want).allSatisfy{abs($0-$1)<0.012},"\(label) \(name) settles to the source value \(final) vs \(want)") }
        }
        check(disabled || compared>20,"\(label) rendered samples compared (\(compared))")
        report.append(["case":label,"samples":samples.count,"compared":compared])
        state.pointer.update(phase:.leave);pump(0.3)
    }
    static func main(){
        _ = NSApplication.shared;NSApp.setActivationPolicy(.accessory)
        host=NSHostingView(rootView:AccordionStatesFixture(state:state));window=NSWindow(contentRect:.init(x:-20000,y:-20000,width:600,height:600),styleMask:[.borderless],backing:.buffered,defer:false);window.isReleasedWhenClosed=false;window.colorSpace = .sRGB;window.contentView=host;window.orderFrontRegardless();pump(0.2)
        let fixtures=URL(fileURLWithPath:#filePath).deletingLastPathComponent().appendingPathComponent("Fixtures")
        let oracle=try! JSONDecoder().decode(AWCValue.self,from:Data(contentsOf:fixtures.appendingPathComponent("accordion-web-states.json")))
        let only=ProcessInfo.processInfo.environment["AWC_ACCORDION_STATES_ONLY"]
        for c in oracle["cases"].array where only == nil || c["scenario"].string==only { run(c) }
        if let output=ProcessInfo.processInfo.environment["AWC_ACCORDION_STATES_OUTPUT"]{try! JSONSerialization.data(withJSONObject:["checks":checks,"failures":failures,"report":report,"debug":debug],options:[.prettyPrinted,.sortedKeys]).write(to:URL(fileURLWithPath:output))}
        print("Accordion native interaction states: \(checks-failures.count)/\(checks) checks passed")
        window.close();if !failures.isEmpty{exit(1)}
    }
}
