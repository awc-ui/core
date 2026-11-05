import AppKit
import SwiftUI
import Observation
@testable import AWCUI

@Observable final class ProgressFixtureState {
    var properties:[String:AWCValue]=[:]
    var tokens:[String:String]=[:]
    var appearance=AWCProgressIndicatorAppearance()
    var dark=false
    var rtl=false
    var reduced:Bool?=false
    var contrast=false
    var forcedColors=false
    var density=0.0
    var width=240.0
    var clock:AWCNativeProgressClock? = .init(javascript:6,css:0)
    var epoch=0
    var events=0
    var nodes:[AWCNativeInspectionNode]=[]
}
struct ProgressFixture:View {
    let state:ProgressFixtureState
    var body:some View {
        let epoch=state.epoch,id="progress-\(epoch)"
        AWCNativeProgressIndicator(nodeID:id,properties:state.properties,theme:.generated(dark:state.dark,tokens:state.tokens),onComplete:{state.events += 1})
            .awcProgressIndicatorAppearance(state.appearance)
            .awcNativeInspection(rootID:id,coordinateSpace:"progress-fixture"){if state.epoch==epoch{state.nodes=$0}}
            .id(epoch).frame(width:state.width).frame(width:320,height:280).background(Color.white)
            .awcDensity(state.density).environment(\.layoutDirection,state.rtl ? .rightToLeft:.leftToRight)
            .environment(\.awcProgressClock,state.clock).environment(\.awcProgressReducedMotion,state.reduced)
            .awcProgressForcedColors(state.forcedColors).coordinateSpace(name:"progress-fixture")
    }
}
@main @MainActor enum NativeProgressIndicatorViewIntegration {
    static let state=ProgressFixtureState()
    static var host:NSHostingView<ProgressFixture>!,window:NSWindow!
    static var checks=0,failures:[String]=[]
    static func check(_ value:Bool,_ message:String){checks += 1;if !value{failures.append(message);print("FAIL: "+message);fflush(stdout)}}
    static func near(_ a:Double,_ b:Double,_ tolerance:Double=0.04)->Bool{a.isFinite && abs(a-b)<=tolerance}
    static func pump(_ seconds:Double=0.035){let until=Date().addingTimeInterval(seconds);while Date()<until{while let event=NSApp.nextEvent(matching:.any,until:Date(),inMode:.default,dequeue:true){NSApp.sendEvent(event)};host?.layoutSubtreeIfNeeded();host?.displayIfNeeded();_ = RunLoop.current.run(mode:.default,before:Date().addingTimeInterval(0.001))}}
    static func descendants(_ view:NSView)->[NSView]{[view]+view.subviews.flatMap(descendants)}
    static func control()->AWCNativeDeterminateProgressView?{descendants(host).compactMap{$0 as? AWCNativeDeterminateProgressView}.last}
    static func node(_ part:String?=nil)->AWCNativeInspectionNode?{state.nodes.first{$0.id == (part.map{"component."+$0} ?? "component")}}
    static func bytes()->[UInt8]{
        let bitmap=host.bitmapImageRepForCachingDisplay(in:host.bounds)!;host.cacheDisplay(in:host.bounds,to:bitmap)
        let image=bitmap.cgImage!;var bytes=[UInt8](repeating:0,count:image.width*image.height*4)
        bytes.withUnsafeMutableBytes{buffer in let cg=CGContext(data:buffer.baseAddress,width:image.width,height:image.height,bitsPerComponent:8,bytesPerRow:image.width*4,space:CGColorSpace(name:CGColorSpace.sRGB)!,bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue)!;cg.draw(image,in:.init(x:0,y:0,width:image.width,height:image.height))}
        return bytes
    }
    static func numbers(_ text:String)->[Double]{
        let regex=try! NSRegularExpression(pattern:"[-+]?(?:[0-9]*\\.)?[0-9]+(?:[eE][-+]?[0-9]+)?")
        return regex.matches(in:text,range:NSRange(text.startIndex...,in:text)).compactMap{Range($0.range,in:text).flatMap{Double(text[$0])}}
    }
    static func colorHits(_ pixels:[UInt8],css:String)->Int {
        let n=numbers(css);guard n.count>=3 else{return 0}
        let alpha=n.count>3 ? n[3]:1,expected=(0..<3).map{n[$0]*alpha+255*(1-alpha)}
        return stride(from:0,to:pixels.count,by:4).reduce(0){count,i in count+((0..<3).allSatisfy{abs(Double(pixels[i+$0])-expected[$0])<=3} ? 1:0)}
    }
    static func corners(_ css:String)->AWCCornerShape{
        let n=numbers(css).first ?? 0;return css.contains("%") ? .fraction(n/100):.points(n)
    }
    static func appearance(_ style:AWCValue)->AWCProgressIndicatorAppearance{
        func n(_ key:String)->Double?{numbers(style[key].string).first}
        func s(_ key:String)->String?{style.object[key]?.string}
        return .init(activeIndicatorColor:s("activeColor"),activeIndicatorShape:s("activeShape").map(corners),trackColor:s("trackColor"),trackShape:s("trackShape").map(corners),stopIndicatorColor:s("stopColor"),stopIndicatorShape:s("stopShape").map(corners),stopIndicatorSize:n("stopSize"),stopIndicatorTrailingSpace:n("stopTrailingSpace") ?? n("stop-indicator-trailing-space"),trackActiveIndicatorSpace:n("gap") ?? n("track-active-indicator-space"),fourColor1:s("four1"),fourColor2:s("four2"),fourColor3:s("four3"),fourColor4:s("four4"))
    }
    static func document(_ name:String)->AWCValue{
        let url=URL(fileURLWithPath:#filePath).deletingLastPathComponent().appendingPathComponent("Fixtures/progress-web-\(name).json")
        return try! JSONDecoder().decode(AWCValue.self,from:Data(contentsOf:url))
    }
    static func metrics(_ values:[String:AWCValue],appearance:AWCProgressIndicatorAppearance = .init())->AWCNativeProgressMetrics{.init(properties:values,appearance:appearance,density:0,tokens:[:])}
    static func contracts(){
        let a=AWCProgressIndicatorAppearance(activeIndicatorColor:"#12345680",stopIndicatorSize:0,stopIndicatorTrailingSpace:-7,trackActiveIndicatorSpace:-9).merging(.init(trackColor:"#abcdef"))
        check(a.activeIndicatorColor=="#12345680" && a.trackColor=="#ABCDEF" && a.stopIndicatorSize==0 && a.stopIndicatorTrailingSpace == -7 && a.trackActiveIndicatorSpace == -9,"Sparse fields retain RGBA, zero and signed spaces")
        check(AWCProgressIndicatorAppearance(activeIndicatorShape:.points(.nan),stopIndicatorSize:-1,trackActiveIndicatorSpace:.infinity) == .init(),"Invalid appearance fields cannot poison geometry")
        for circular in [false,true]{for wave in [false,true]{for reduced in [false,true]{
            var p:[String:AWCValue]=["variant":.string(circular ? "circular":"linear"),"wave":.bool(wave),"value":37,"complete":true]
            var m=metrics(p),motion=AWCNativeProgressMotion(m,reduced:reduced);motion.tick(0);motion.tick(1)
            check(!motion.completed && motion.completionCount==0,"Initial complete is inert \(circular)/\(wave)/\(reduced)")
            p["complete"]=false;m=metrics(p);motion.update(m,reduced:reduced)
            p["complete"]=true;m=metrics(p);motion.update(m,reduced:reduced)
            if reduced && !circular && !wave{check(motion.stage == .collapse && !motion.completed,"Reduced flat linear retains its CSS collapse")}
            for frame in 0...300{motion.tick(2+Double(frame)/60)}
            check(motion.completed && motion.completionCount==1,"Completion runs exactly once \(circular)/\(wave)/\(reduced)")
            check(motion.hidden == !(circular && !wave),"Only flat circular retains the terminal track")
            p["complete"]=false;motion.update(metrics(p),reduced:reduced);p["complete"]=true;motion.update(metrics(p),reduced:reduced);motion.tick(20)
            check(motion.completionCount==1 && motion.completed,"False never resets terminal state")
        }}}
        for circular in [false,true]{for wave in [false,true]{
            var p:[String:AWCValue]=["variant":.string(circular ? "circular":"linear"),"wave":.bool(wave),"value":37]
            var motion=AWCNativeProgressMotion(metrics(p),reduced:false);p["complete"]=true;motion.update(metrics(p),reduced:false);motion.tick(0);motion.tick(0.08);motion.update(metrics(p),reduced:true)
            check(motion.completed && motion.completionCount==1,"Reduced preference settles an active rAF lifecycle")
        }}
        var indeterminate=AWCNativeProgressMotion(metrics(["indeterminate":true]),reduced:false)
        indeterminate.update(metrics(["indeterminate":true,"complete":true]),reduced:false);indeterminate.tick(1)
        check(indeterminate.stage == .normal && indeterminate.completionCount==0,"Indeterminate ignores complete watcher")
        for value in [-200.0,-37,37]{let m=metrics(["max":-100,"value":.number(value)]);check(m.fraction==min(1,max(0,value / -100)) && m.value==0 && m.maximum==0,"Negative max source visual and aria distinctions \(value)")}
        let zero=metrics(["thickness":0,"wave":true]),negative=metrics(["thickness":-2,"wave":true])
        check(zero.height==6 && zero.thickness==0 && negative.height==4 && negative.thickness == -2,"Zero and negative thickness retain source wave viewport")
        var moving=AWCNativeProgressMotion(metrics(["value":0]),reduced:false);moving.tick(0);moving.update(metrics(["value":100]),reduced:false);moving.tick(0.016)
        check(moving.fraction>0 && moving.fraction<1,"Retained value changes interpolate rather than remount")
        for thickness in [Double.greatestFiniteMagnitude,-Double.greatestFiniteMagnitude]{
            let m=metrics(["wave":true,"thickness":.number(thickness),"waveAmplitude":.number(.greatestFiniteMagnitude),"waveLength":.number(.leastNonzeroMagnitude),"waveSpeed":.number(.greatestFiniteMagnitude)])
            check(m.height.isFinite && m.radius.isFinite && abs(m.height)<=AWCNativeProgressMetrics.maximumUsedLength,"Extreme finite source values have bounded used layout")
            var motion=AWCNativeProgressMotion(m,reduced:false);motion.tick(0);motion.tick(0.016)
            check(motion.phase.isFinite,"Extreme wavelength/speed keeps finite phase")
            let p=AWCNativeProgressGeometry.wavyArc(m,start:0,end:1,amplitude:1,phase:motion.phase)
            check(!p.boundingRect.isNull && p.boundingRect.width.isFinite && p.boundingRect.height.isFinite,"Extreme wave tessellation remains bounded and finite")
        }
    }
    static func configure(_ entry:AWCValue,document:AWCValue,time:Double,css:Double,mode:String){
        let f=entry["fixture"]
        state.epoch += 1;state.nodes=[];state.events=0;state.properties=f.object
        state.appearance=appearance(f["style"]);state.density=f["inheritedDensity"].number ?? 0;state.width=f["width"].number ?? 240
        state.dark=mode=="dark";state.rtl=(f.object["dir"]?.string ?? f.object["parentDir"]?.string ?? entry["host"]["direction"].string)=="rtl";state.reduced=f["reduced"].bool ?? false;state.contrast=false
        state.tokens=defaultPalette ? [:]:document["tokens"].object.mapValues(\.string);state.clock = .init(javascript:time,css:css);pump()
    }
    static func compare(_ entry:AWCValue,_ context:String){
        let f=entry["fixture"],id=context+"/"+f["id"].string,expected=entry["host"]
        if f["hidden"].bool==true{check(node()==nil && control()==nil,"\(id) hidden removes inspection and semantics");return}
        guard let root=node(),let native=control() else{check(false,"\(id) actual root and semantic responder exist");return}
        check(near(root.bounds.width,expected["width"].number!) && near(root.bounds.height,expected["height"].number!),"\(id) root\(root.bounds.size) expected\(expected["width"].string)×\(expected["height"].string)")
        let attrs=expected["attributes"]
        check(near(native.maximum,Double(attrs["aria-valuemax"].string) ?? 0) && native.value==Double(attrs["aria-valuenow"].string),"\(id) true progress range/indeterminate semantics")
        check(native.label==(attrs.object["aria-label"]?.string ?? "") && !native.canBecomeKeyView,"\(id) source label and no implicit tab stop")
        for part in entry["parts"].array{
            let name=part["part"].string
            guard let actual=node(name) else{check(false,"\(id) missing actual \(name)");continue}
            check(near(actual.bounds.width,part["width"].number!,0.065) && near(actual.bounds.height,part["height"].number!,0.065),"\(id) \(name) \(actual.bounds.size) expected\(part["width"].string)×\(part["height"].string)")
            check(near(actual.bounds.minX-root.bounds.minX,part["x"].number!,0.065) && near(actual.bounds.minY-root.bounds.minY,part["y"].number!,0.065),"\(id) \(name) origin\(actual.bounds.minX-root.bounds.minX),\(actual.bounds.minY-root.bounds.minY) expected\(part["x"].string),\(part["y"].string)")
        }
        if ["light","dark","default-light","default-dark"].contains(context) || (context.hasPrefix("animation") && f["id"].string=="circular-custom-cycle"),root.bounds.width>0,root.bounds.height>0,(f["thickness"].number ?? 4)>0{
            let pixels=bytes()
            for part in entry["parts"].array where (part["width"].number ?? 0)>2 && (part["height"].number ?? 0)>1 && (Double(part["opacity"].string) ?? 1)>0.99 {
                let background=part["background"].string,stroke=part["stroke"].string
                let css=stroke != "none" ? stroke:background != "rgba(0, 0, 0, 0)" && !background.isEmpty ? background:part["attributes"].object["d"] != nil ? part["fill"].string:""
                if css != "none",!css.isEmpty{check(colorHits(pixels,css:css)>2,"\(id) actual \(part["part"].string) palette/alpha pixels \(css)")}
            }
        }
    }
    static var defaultPalette=false // R2-D1/R2-D4: default-palette pass injects no tokens
    static func oracle(){
        let filter=ProcessInfo.processInfo.environment["AWC_PROGRESS_CASES"].map{Set($0.split(separator:",").map(String.init))}
        for mode in ["light","dark"]{
            let doc=document(defaultPalette ? "default-"+mode:mode)
            for entry in doc["results"].array where filter == nil || filter!.contains(entry["fixture"]["id"].string){
                configure(entry,document:doc,time:(doc["clockTime"].number ?? 6000)/1000,css:(doc["cssAnimationTime"].number ?? 0)/1000,mode:mode);compare(entry,defaultPalette ? "default-"+mode:mode)
            }
        }
    }
    static func edges(){
        let doc=document("edges"),first=doc["samples"].array[0]
        for entry in first["results"].array{
            configure(entry,document:doc,time:0,css:0,mode:"light");compare(entry,"edge")
        }
        let temporal=Set(["linear-flat-indeterminate-rtl","linear-wave-indeterminate-rtl","linear-flat-indeterminate-ltr","linear-wave-indeterminate-ltr"])
        for sample in doc["samples"].array.dropFirst(){for entry in sample["results"].array where temporal.contains(entry["fixture"]["id"].string){
            let t=(sample["time"].number ?? 0)/1000
            configure(entry,document:doc,time:t,css:t,mode:"light");compare(entry,"edge@\(t)")
        }}
    }
    static func lifecycle(){
        for variant in ["linear","circular"]{for wave in [false,true]{for reduced in [false,true]{
            state.epoch += 1;state.nodes=[];state.events=0;state.clock=nil;state.tokens=[:];state.density=0;state.reduced=reduced;state.rtl=false;state.appearance = .init()
            state.properties=["variant":.string(variant),"wave":.bool(wave),"value":37,"complete":true];pump(0.06)
            check(state.events==0 && node() != nil,"Mounted initial complete stays visible \(variant)/\(wave)/reduced\(reduced)")
            state.properties["complete"]=false;pump();state.properties["complete"]=true;pump(reduced ? 0.06:2.1)
            if reduced && variant=="linear" && !wave{
                check(state.events==0 && node() != nil,"Native reduced-motion flat completion retains the300ms CSS collapse");pump(0.4)
            }
            check(state.events==1,"Actual retained renderer emits one mdComplete \(variant)/\(wave)/reduced\(reduced)")
            check((node()==nil)==(variant != "circular" || wave),"Actual terminal inspection follows rendered visibility \(variant)/\(wave)")
            state.properties["complete"]=false;pump();check(state.events==1,"Actual false does not reset completion")
        }}}
    }
    static func preferences(){
        state.epoch += 1;state.nodes=[];state.events=0;state.tokens=[:];state.width=240;state.density=0;state.rtl=false;state.dark=false
        state.reduced=true;state.clock = .init(javascript:0,css:0)
        state.properties=["wave":true,"value":37];state.appearance = .init(activeIndicatorColor:"#F01080",trackColor:"#90D020",stopIndicatorColor:"#1080F0")
        pump();let first=bytes()
        check(near(Double(node("active-indicator")?.bounds.height ?? -1),4),"Native reduce-motion preference flattens the actual wave")
        state.clock = .init(javascript:2,css:2);pump()
        check(bytes()==first,"Reduced determinate wave has no moving native pixels")
        host.appearance=NSAppearance(named:.accessibilityHighContrastAqua);pump()
        check(bytes()==first,"Native increased contrast preserves authored Progress colors")
        state.forcedColors=true;pump();let semantic=bytes()
        check(colorHits(semantic,css:"rgb(240,16,128)")==0 && colorHits(semantic,css:"rgb(144,208,32)")==0,"Explicit forced-colors scope replaces authored palette with semantic paint")
        check(control()?.accessibilityRole() == .progressIndicator,"Forced colors retain the real progress accessibility role")
        state.forcedColors=false;host.appearance=NSAppearance(named:.aqua)
        for wave in [false,true]{
            state.epoch += 1;state.properties=["variant":"circular","indeterminate":true,"wave":.bool(wave),"fourColor":true]
            state.clock = .init(javascript:0,css:0);pump();let a=bytes()
            state.clock = .init(javascript:1,css:1);pump()
            check(bytes() != a,"Reduced circular \(wave ? "wave":"flat") continues the source slow rotation")
        }
        state.reduced=false
    }
    static func animationSamples(){
        let doc=document("light"),ids=Set(["linear-wave-37","linear-flat-indeterminate","linear-wave-indeterminate","circular-flat-indeterminate","circular-wave-indeterminate","circular-custom-cycle"])
        var pictures:[String:[[UInt8]]]=[:]
        for sample in doc["samples"].array {
            let time=(sample["time"].number ?? 0)/1000
            for entry in sample["results"].array where ids.contains(entry["fixture"]["id"].string){
                configure(entry,document:doc,time:time,css:time,mode:"light")
                compare(entry,"animation@\(time)")
                pictures[entry["fixture"]["id"].string,default:[]].append(bytes())
            }
        }
        for (id,frames) in pictures{check(frames.dropFirst().contains{$0 != frames[0]},"\(id) source animation changes actual native pixels")}
        state.epoch += 1;state.nodes=[];state.properties=["indeterminate":true,"wave":true];state.appearance = .init(trackShape:.init(bottomLeft:.init(.points(8))));state.density=0;state.width=240;state.reduced=false;state.rtl=false;state.clock = .init(javascript:0.5,css:0.5);pump()
        let ltr=bytes();state.rtl=true;pump();let rtl=bytes()
        let bitmap=host.bitmapImageRepForCachingDisplay(in:host.bounds)!,width=bitmap.pixelsWide,height=bitmap.pixelsHigh
        var reflected=[UInt8](repeating:0,count:ltr.count)
        for y in 0..<height{for x in 0..<width{for c in 0..<4{reflected[(y*width+x)*4+c]=ltr[(y*width+(width-1-x))*4+c]}}}
        // Native path rasterization may differ by one edge pixel after a view
        // reflection. Compare aggregate channel error, retaining real corners.
        let error=zip(reflected,rtl).reduce(0){$0+abs(Int($1.0)-Int($1.1))}
        check(Double(error)/Double(ltr.count)<0.2,"RTL mirrors the whole indeterminate wave, clipping and asymmetric corners exactly once")
    }
    static func main(){
        contracts();let contractCount=checks;NSApplication.shared.setActivationPolicy(.accessory)
        host=NSHostingView(rootView:ProgressFixture(state:state));host.appearance=NSAppearance(named:.aqua);window=NSWindow(contentRect:.init(x:-10000,y:-10000,width:320,height:280),styleMask:[.borderless],backing:.buffered,defer:false);window.isReleasedWhenClosed=false;window.contentView=host;window.colorSpace = .sRGB;window.orderFrontRegardless();pump()
        oracle();defaultPalette=true;oracle();defaultPalette=false;edges();animationSamples();preferences();lifecycle()
        print("Progress: \(checks-failures.count)/\(checks) checks passed (\(contractCount) contracts, \(checks-contractCount) native).");window.close();if !failures.isEmpty{exit(1)}
    }
}
