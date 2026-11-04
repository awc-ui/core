import AppKit
import SwiftUI
import Observation
import QuartzCore
@testable import AWCUI

// Reorder sibling-shift and drop-placeholder motion against actual Chrome
// CSSTransition records and per-frame samples (shift.html): durations/easing
// from source tokens and preset, retargeting from the current value, reversal
// shortening, transition="none" and reduced motion.
@Observable final class AccordionShiftFixtureState {
    var node=AWCNode(id:"accordion",tag:"md-accordion")
    var epoch=0
    var reduced=false
    var measurements:[AWCNativeInspectionNode]=[]
    var events:[AWCEvent]=[]
}
struct AccordionShiftFixture:View {
    let state:AccordionShiftFixtureState
    var body:some View {
        let epoch=state.epoch,theme=AWCTheme.generated(dark:false)
        AWCNativeAccordionGroup(node:state.node,theme:theme,onEvent:{state.events.append($0)})
            .environment(\.awcAccordionReducedMotion,state.reduced)
            .awcTheme(theme).frame(width:400)
            .awcNativeInspection(rootID:"accordion",coordinateSpace:"shift"){if state.epoch==epoch{state.measurements=$0}}
            .id(epoch).padding(40).frame(maxWidth:.infinity,maxHeight:.infinity,alignment:.topLeading)
            .background(theme.background).coordinateSpace(name:"shift")
    }
}
@main @MainActor enum NativeAccordionShiftIntegration {
    static let state=AccordionShiftFixtureState()
    static var host:NSHostingView<AccordionShiftFixture>!,window:NSWindow!
    static var checks=0,failures:[String]=[]
    static var report:[[String:Any]]=[]
    static var reversals:[[String:Any]]=[]
    static func check(_ value:Bool,_ name:String){checks+=1;if !value{failures.append(name);print("FAIL: "+name);fflush(stdout)}}
    static func near(_ a:Double,_ b:Double,_ tolerance:Double,_ name:String){check(abs(a-b)<=tolerance,"\(name): \(a) vs \(b)")}
    static func pump(_ duration:Double=0.1){let end=Date().addingTimeInterval(duration);repeat{while let e=NSApp.nextEvent(matching:.any,until:.distantPast,inMode:.default,dequeue:true){NSApp.sendEvent(e)};host.layoutSubtreeIfNeeded();host.displayIfNeeded();_ = RunLoop.current.run(mode:.default,before:Date().addingTimeInterval(0.002))}while Date()<end}
    static func all(_ v:NSView)->[NSView]{[v]+v.subviews.flatMap(all)}
    static func grip(_ id:String)->AWCAccordionReorderPointerView?{all(host).compactMap{$0 as? AWCAccordionReorderPointerView}.first{$0.accessibilityIdentifier()==id+".reorder-pointer"}}
    static func rect(_ v:NSView)->CGRect{let r=host.convert(v.bounds,from:v);return host.isFlipped ? r:.init(x:r.minX,y:host.bounds.height-r.maxY,width:r.width,height:r.height)}
    static func mouse(_ kind:NSEvent.EventType,_ p:CGPoint){let point=host.convert(.init(x:p.x,y:host.isFlipped ? p.y:host.bounds.height-p.y),to:nil);let e=NSEvent.mouseEvent(with:kind,location:point,modifierFlags:[],timestamp:ProcessInfo.processInfo.systemUptime,windowNumber:window.windowNumber,context:nil,eventNumber:1,clickCount:1,pressure:kind == .leftMouseUp ? 0:1)!;window.sendEvent(e)}
    static let ids=["a","b","c","d"]
    static func setup(preset:String,reduced:Bool){
        state.reduced=reduced
        state.node = .init(id:"accordion",tag:"md-accordion",properties:["reorderable":true,"transition":.string(preset),"variant":"filled"],children:ids.map{.init(id:$0,tag:"md-accordion-item",properties:["headline":.string($0)],children:[.text("Body")])})
        state.epoch+=1;pump(0.2);state.events=[]
    }
    static func translate(_ v:AWCValue)->Double{
        let s=v.string
        if s=="none" || s.isEmpty {return 0}
        return Double(s.replacingOccurrences(of:"translateY(",with:"").replacingOccurrences(of:"px)",with:""))!
    }
    /// Value at time t from a track's full history (the transition active at t, else the resting start value).
    static func at(_ history:[AWCCSSTransition],_ initial:Double,_ t:Double)->Double{
        guard let h=history.last(where:{$0.start<=t}) else {return initial}
        return t>=h.end ? h.to:h.value(t)
    }
    /// Range of the modelled value over [a, b] (paths can turn inside a frame window).
    static func range(_ history:[AWCCSSTransition],_ initial:Double,_ a:Double,_ b:Double)->(Double,Double){
        var lo=Double.infinity,hi = -Double.infinity,t=a
        while t<=b {let v=at(history,initial,t);lo=min(lo,v);hi=max(hi,v);t+=0.5}
        let v=at(history,initial,b);return (min(lo,v),max(hi,v))
    }
    static func value(_ sample:AWCValue,_ target:String)->Double?{target=="placeholder" ? sample["placeholder"].number:sample["items"][target].number}
    /// Exact model check: replay Chrome's style-change times through the native track.
    static func model(_ c:AWCValue,_ label:String){
        let preset=c["preset"].string,reduced=c["reduced"] == .bool(true),from=Int(c["from"].number!)
        let timing=AWCAccordionReorderMotion.timing(preset:preset,reduced:reduced,tokens:AWCTheme.generated(dark:false).tokens)
        let transitions=c["transitions"].array.filter{$0["startTime"].number! > -100}
        let rects=c["rects"].array
        for target in ids+["placeholder"] where target != ids[from] {
            let own=transitions.filter{($0["target"].string=="drop-placeholder" ? "placeholder":$0["target"].string)==target}.sorted{$0["startTime"].number!<$1["startTime"].number!}
            let t=target=="placeholder" ? timing.glide:timing.shift
            let initial=target=="placeholder" ? rects[from]["y"].number!:0
            var track=AWCCSSTransitionTrack();track.snap(initial)
            for w in own {track.set(translate(w["to"]),now:w["startTime"].number!,duration:t.duration,curve:t.curve)}
            let started=track.history.filter(\.animated)
            check(started.count==own.count,"\(label)/\(target) native starts the same transitions (\(started.count) vs \(own.count))")
            for (n,w) in zip(started,own) {
                near(n.duration,w["duration"].number!,0.01,"\(label)/\(target) transition duration incl. reversal shortening")
                near(n.from,translate(w["from"]),0.01,"\(label)/\(target) retarget starts from the current value")
                check(w["easing"].string=="cubic-bezier(\(t.curve.map{String(format:"%g",$0)}.joined(separator:", ")))","\(label)/\(target) easing \(w["easing"].string) vs \(t.curve)")
            }
            if own.isEmpty && !c["samples"].array.isEmpty {
                // No source transition: every sample is a settled value (no intermediate frames).
                let values=Set(c["samples"].array.compactMap{value($0,target)}.map{($0*100).rounded()/100})
                check(values.count<=3,"\(label)/\(target) snaps without intermediate values \(values)")
                check(t.duration==0 || values.count<=1,"\(label)/\(target) native timing also snaps")
            } else {
                for s in c["samples"].array { if let v=value(s,target) { near(at(track.history,initial,s["timeline"].number!),v,0.05,"\(label)/\(target) CSS value at t=\(s["timeline"].number!)") } }
            }
        }
    }
    /// Rendered check: drive the real view with the same schedule; actual offsets follow the native tracks,
    /// and the native tracks reproduce the source transitions.
    static func rendered(_ c:AWCValue,_ label:String){
        let preset=c["preset"].string,reduced=c["reduced"] == .bool(true),scenario=c["scenario"].string,from=Int(c["from"].number!)
        setup(preset:preset,reduced:reduced)
        guard let handle=grip(ids[from]),let context=handle.context,let motion=context.motion else {check(false,"\(label) grip/motion");return}
        let base=Dictionary(uniqueKeysWithValues:ids.map{($0,context.registry.rect($0)!)}),root=context.registry.rect("accordion")!
        let center={(i:Int)->Double in base[ids[i]]!.midY},cross={(i:Int)->Double in center(i)-center(from)+(i>from ? 5:-5)}
        let g=rect(handle),p=CGPoint(x:g.midX,y:g.midY)
        let plan:[(Double,Double)]=scenario=="cross" ? [(0,cross(1))]:scenario=="reverse" ? [(0,cross(1)),(60,0)]:scenario=="extend" ? [(0,cross(1)),(60,cross(2))]:[(0,cross(2))]
        mouse(.leftMouseDown,p);pump(0.15)
        let placeholderBase=root.minY
        var samples:[(t:Double,offsets:[String:Double],placeholder:Double?)]=[]
        let t0=CACurrentMediaTime()*1000;var next=0
        while CACurrentMediaTime()*1000-t0<480 {
            let now=CACurrentMediaTime()*1000-t0
            while next<plan.count && now>=plan[next].0 {mouse(.leftMouseDragged,.init(x:p.x,y:p.y+plan[next].1));next+=1}
            pump(0.004)
            let t=CACurrentMediaTime()*1000
            var offsets:[String:Double]=[:]
            for id in ids where id != ids[from] {offsets[id]=(context.registry.rect(id)?.minY ?? .nan)-base[id]!.minY}
            let ph:Double?=state.measurements.first{$0.name=="drop-placeholder"}.map{Double($0.bounds.minY-(state.measurements.first{$0.id=="component"}!.bounds.minY))}
            samples.append((t,offsets,ph))
        }
        _ = placeholderBase
        // Actual layout follows the native CSS model (display frames lag the clock by up to ~2 frames).
        var compared=0
        for s in samples {
            for (id,actual) in s.offsets {
                guard let track=motion.siblings[id] else {continue}
                let (a,b)=range(track.history,0,s.t-34,s.t+4)
                check(actual>=a-0.6 && actual<=b+0.6,"\(label)/\(id) rendered offset \(actual) within model [\(a),\(b)]");compared+=1
            }
            if let ph=s.placeholder,let track=motion.placeholder {
                let initial=base[ids[from]]!.minY-root.minY
                let (a,b)=range(track.history,initial,s.t-50,s.t+4)
                check(ph>=a-0.6 && ph<=b+0.6,"\(label)/placeholder rendered \(ph) within model [\(a),\(b)]");compared+=1
            }
        }
        check(compared>40,"\(label) rendered samples collected (\(compared))")
        // Native tracks reproduce the source transitions (count, endpoints, durations).
        let web=c["transitions"].array.filter{$0["startTime"].number! > -100}
        let timing=AWCAccordionReorderMotion.timing(preset:preset,reduced:reduced,tokens:AWCTheme.generated(dark:false).tokens)
        for target in ids+["placeholder"] where target != ids[from] {
            let own=web.filter{($0["target"].string=="drop-placeholder" ? "placeholder":$0["target"].string)==target}.sorted{$0["startTime"].number!<$1["startTime"].number!}
            let history=(target=="placeholder" ? motion.placeholder?.history ?? []:motion.siblings[target]?.history ?? []).filter(\.animated)
            check(history.count==own.count,"\(label)/\(target) rendered transition count \(history.count) vs source \(own.count)")
            for (index,(n,w)) in zip(history,own).enumerated() {
                near(n.to,translate(w["to"]),0.6,"\(label)/\(target) transition end value")
                if index>0 && n.shortening<1 {
                    // Reversal: duration shortened by the previous transition's progress at the native retarget time.
                    let previous=history[index-1]
                    near(n.shortening,previous.outputProgress(n.start),1e-9,"\(label)/\(target) reversal factor is the previous output progress")
                    near(n.duration,(target=="placeholder" ? timing.glide:timing.shift).duration*n.shortening,1e-6,"\(label)/\(target) shortened duration")
                    // Exact Chrome reversal equivalence is proven by the model replay above; the rendered
                    // reversal instant depends on frame timing, so only its consistency is asserted here.
                    reversals.append(["case":label,"target":target,"native":n.duration,"source":w["duration"].number!,"nativeElapsed":n.start-previous.start])
                } else {
                    near(n.duration,w["duration"].number!,0.01,"\(label)/\(target) duration")
                }
            }
            let last=c["samples"].array.last!,expected=value(last,target)
            if let expected,let final=(target=="placeholder" ? samples.last?.placeholder:samples.last?.offsets[target]) { near(final,expected,0.6,"\(label)/\(target) settles to the source end value") }
        }
        report.append(["case":label,"samples":samples.count,"siblings":motion.siblings.mapValues{$0.history.map{["from":$0.from,"to":$0.to,"start":$0.start,"duration":$0.duration,"shortening":$0.shortening]}},
                       "placeholder":motion.placeholder?.history.map{["from":$0.from,"to":$0.to,"duration":$0.duration,"shortening":$0.shortening]} ?? []])
        mouse(.leftMouseUp,.init(x:p.x,y:p.y+plan.last!.1));pump(0.12)
        check(motion.siblings.isEmpty && motion.placeholder==nil,"\(label) drop clears reorder motion")
        for id in ids {if let r=context.registry.rect(id),let b=base[id] {check(abs(r.minX-b.minX)<0.6,"\(label)/\(id) no horizontal drift")}}
        check(state.measurements.first{$0.name=="drop-placeholder"}==nil,"\(label) drop removes placeholder")
    }
    static func main(){
        _ = NSApplication.shared;NSApp.setActivationPolicy(.accessory)
        host=NSHostingView(rootView:AccordionShiftFixture(state:state));window=NSWindow(contentRect:.init(x:-20000,y:-20000,width:600,height:700),styleMask:[.borderless],backing:.buffered,defer:false);window.isReleasedWhenClosed=false;window.colorSpace = .sRGB;window.contentView=host;window.orderFrontRegardless();pump(0.2)
        let fixtures=URL(fileURLWithPath:#filePath).deletingLastPathComponent().appendingPathComponent("Fixtures")
        let oracle=try! JSONDecoder().decode(AWCValue.self,from:Data(contentsOf:fixtures.appendingPathComponent("accordion-web-shift.json")))
        for c in oracle["cases"].array {
            let label="\(c["preset"].string)\(c["reduced"] == .bool(true) ? "-reduced":"")/\(c["scenario"].string)"
            model(c,label);rendered(c,label)
        }
        if let output=ProcessInfo.processInfo.environment["AWC_ACCORDION_SHIFT_OUTPUT"]{try! JSONSerialization.data(withJSONObject:["checks":checks,"failures":failures,"report":report,"reversals":reversals],options:[.prettyPrinted,.sortedKeys]).write(to:URL(fileURLWithPath:output))}
        print("Accordion native reorder motion: \(checks-failures.count)/\(checks) checks passed")
        window.close();if !failures.isEmpty{exit(1)}
    }
}
