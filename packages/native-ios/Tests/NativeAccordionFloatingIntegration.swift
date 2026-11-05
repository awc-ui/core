import AppKit
import SwiftUI
import Observation
import QuartzCore
@testable import AWCUI

// Floating panel against Chrome captures (floating.html, 1200x900 viewport, DPR 1):
// physical viewport placement with zero in-flow footprint, panel surface, radius and
// elevation, the chassis grip (default and custom hooks, light/dark, LTR/RTL, filled/
// outlined, closed/open); trusted chassis drags (hover, press, three moves, release,
// leave) with per-frame grip/shadow/position values, rendered phase paint and mdDrag*
// payloads; bring-to-front stacking; the calc(100vw - 16px) width limit.
@Observable final class AccordionFloatingFixtureState {
    var panels:[AWCNode]=[]
    var epoch=0
    var rtl=false
    var dark=false
    var style="default"
    var viewport:CGSize?=nil
    var tints:[String:String]=[:]
    var inspect="accordion|a"
    var measurements:[AWCNativeInspectionNode]=[]
    var events:[AWCEvent]=[]
    var before:CGRect = .zero
    var after:CGRect = .zero
    let pointer=AWCNativePointerState()
}
struct AccordionFloatingFixture:View {
    let state:AccordionFloatingFixtureState
    var appearance:AWCAccordionAppearance {
        state.style=="custom" ? .init(floatingWidth:320,floatingBackground:"#E3F2FD",floatingElevation:AWCBoxShadow.source("0px 2px 6px 0px rgba(0, 0, 0, 0.3)"),
                                      floatingElevationActive:AWCBoxShadow.source("0px 12px 24px 0px rgba(0, 0, 0, 0.35)"),floatingRadius:.points(24)) : .init()
    }
    var itemAppearance:AWCAccordionItemAppearance { state.style=="custom" ? .init(chassisHandleColor:"#D81B60",chassisHandleBackgroundHover:"#FFCDD2") : .init() }
    var body:some View {
        let epoch=state.epoch,theme=AWCTheme.generated(dark:state.dark),full=state.viewport==nil
        VStack(alignment:.leading,spacing:0) {
            Color.clear.frame(width:24,height:10).onGeometryChange(for:CGRect.self){$0.frame(in:.named("awc-native-preview"))} action:{state.before=$0}
            ForEach(state.panels,id:\.id) { node in
                AWCNativeAccordionGroup(node:node,theme:theme,onEvent:{state.events.append($0)})
                    .awcAccordionAppearance(state.tints[node.id].map{.init(floatingBackground:$0)} ?? appearance)
                    .environment(\.layoutDirection,state.rtl ? .rightToLeft:.leftToRight)
            }
            Color.clear.frame(width:24,height:10).onGeometryChange(for:CGRect.self){$0.frame(in:.named("awc-native-preview"))} action:{state.after=$0}
        }
        .awcAccordionItemAppearance(itemAppearance)
        .awcTheme(theme)
        .awcNativeInspection(rootID:state.inspect,coordinateSpace:"awc-native-preview"){if state.epoch==epoch{state.measurements=$0}}
        .environment(\.awcNativePointerState,state.pointer)
        .id(epoch)
        .frame(width:state.viewport?.width,height:state.viewport?.height,alignment:.topLeading)
        .frame(maxWidth:full ? .infinity:nil,maxHeight:full ? .infinity:nil,alignment:.topLeading)
        .awcAccordionViewport()
        .frame(maxWidth:.infinity,maxHeight:.infinity,alignment:.topLeading)
        .background(theme.background).coordinateSpace(name:"awc-native-preview")
    }
}
/// CSS-pixel grid of an RGB capture: `values[(y*w+x)*3+c]`, each CSS pixel averaged over its device pixels.
struct AccordionFloatingGrid {
    let x:Int,y:Int,w:Int,h:Int; var values:[Double]
    func at(_ px:Int,_ py:Int)->[Double]{let i=((py-y)*w+(px-x))*3;return [values[i],values[i+1],values[i+2]]}
    func flat(_ px:Int,_ py:Int,_ limit:Double)->Bool{
        guard px-1>=x && py-1>=y && px+1<x+w && py+1<y+h else {return false}
        for c in 0..<3 { var lo=999.0,hi = -1.0
            for dy in -1...1 { for dx in -1...1 { let v=values[((py+dy-y)*w+(px+dx-x))*3+c];lo=min(lo,v);hi=max(hi,v) } }
            if hi-lo>limit {return false} }
        return true
    }
}
@main @MainActor enum NativeAccordionFloatingIntegration {
    static let state=AccordionFloatingFixtureState()
    static var host:NSHostingView<AccordionFloatingFixture>!,window:NSWindow!
    static var checks=0,failures:[String]=[]
    static var report:[[String:Any]]=[]
    static let debug=ProcessInfo.processInfo.environment["AWC_ACCORDION_FLOATING_DEBUG"] != nil
    static let caseFilter=ProcessInfo.processInfo.environment["AWC_ACCORDION_FLOATING_CASE"]
    static var captureDir:URL?=ProcessInfo.processInfo.environment["AWC_ACCORDION_FLOATING_CAPTURE_DIRECTORY"].map{URL(fileURLWithPath:$0)}
    static func check(_ value:Bool,_ name:String){checks+=1;if !value{failures.append(name);print("FAIL: "+name);fflush(stdout)}}
    static func pump(_ duration:Double=0.1){let end=Date().addingTimeInterval(duration);repeat{while let e=NSApp.nextEvent(matching:.any,until:.distantPast,inMode:.default,dequeue:true){NSApp.sendEvent(e)};host.layoutSubtreeIfNeeded();host.displayIfNeeded();_ = RunLoop.current.run(mode:.default,before:Date().addingTimeInterval(0.002))}while Date()<end}
    static func now()->Double{CACurrentMediaTime()*1000}
    static func all(_ v:NSView)->[NSView]{[v]+v.subviews.flatMap(all)}
    static func chassis(_ group:String)->AWCAccordionChassisPointerView?{all(host).compactMap{$0 as? AWCAccordionChassisPointerView}.first{$0.accessibilityIdentifier()==group+".chassis-pointer"}}
    static func rect(_ v:NSView)->CGRect{let r=host.convert(v.bounds,from:v);return host.isFlipped ? r:.init(x:r.minX,y:host.bounds.height-r.maxY,width:r.width,height:r.height)}
    static func mouse(_ kind:NSEvent.EventType,_ p:CGPoint){let point=host.convert(.init(x:p.x,y:host.isFlipped ? p.y:host.bounds.height-p.y),to:nil);let e=NSEvent.mouseEvent(with:kind,location:point,modifierFlags:[],timestamp:ProcessInfo.processInfo.systemUptime,windowNumber:window.windowNumber,context:nil,eventNumber:1,clickCount:1,pressure:kind == .leftMouseUp ? 0:1)!;window.sendEvent(e)}
    static func node(_ name:String)->AWCNativeInspectionNode?{state.measurements.first{$0.name==name}}
    static func node(_ group:String,_ name:String)->AWCNativeInspectionNode?{state.measurements.first{$0.name==name && $0.id.hasPrefix(group+":")}}
    static func panel(_ id:String,variant:String,transition:String="none",x:Double=60,y:Double=80,ids:[String]=["a","b"],expanded:Bool=false,bring:Bool=true)->AWCNode{
        .init(id:id,tag:"md-accordion",properties:["floating":true,"variant":.string(variant),"transition":.string(transition),"initialX":.number(x),"initialY":.number(y),"bringToFront":.bool(bring)],
              children:ids.enumerated().map{i,cid in .init(id:cid,tag:"md-accordion-item",properties:["headline":.string(cid),"expanded":.bool(expanded && i==0)],children:[.text("Body")])})
    }
    // MARK: CSS values
    static func numbers(_ s:String)->[Double]{
        var out:[Double]=[],cur=""
        for ch in s { if "0123456789.-e".contains(ch) {cur.append(ch)} else { if let v=Double(cur){out.append(v)};cur="" } }
        if let v=Double(cur){out.append(v)}
        return out
    }
    static func gamma(_ c:Double)->Double{c<=0.0031308 ? 12.92*c:1.055*pow(c,1/2.4)-0.055}
    /// rgb()/rgba()/color(srgb …)/oklab(…) → sRGB [r,g,b,a] in 0…1.
    static func color(_ s:String)->[Double]{
        let n=numbers(s)
        if s.hasPrefix("rgba") {return [n[0]/255,n[1]/255,n[2]/255,n[3]]}
        if s.hasPrefix("rgb") {return [n[0]/255,n[1]/255,n[2]/255,1]}
        if s.hasPrefix("color(srgb") {return [n[0],n[1],n[2],n.count>3 ? n[3]:1]}
        if s.hasPrefix("oklab") {
            let L=n[0],a=n[1],b=n[2]
            let l=pow(L+0.3963377774*a+0.2158037573*b,3),m=pow(L-0.1055613458*a-0.0638541728*b,3),q=pow(L-0.0894841775*a-1.2914855480*b,3)
            return [gamma(4.0767416621*l-3.3077115913*m+0.2309699292*q),gamma(-1.2684380046*l+2.6097574011*m-0.3413193965*q),gamma(-0.0041960863*l-0.7034186147*m+1.7076147010*q),n.count>3 ? n[3]:1]
        }
        return []
    }
    static func premultiplied(_ c:[Double])->[Double]{c.count<4 ? c:[c[0]*c[3],c[1]*c[3],c[2]*c[3],c[3]]}
    // MARK: Pixels
    /// A capture of a viewport region (`origin`, CSS points) at `scale` device pixels per point.
    struct Shot { let cg:CGImage; let scale:Double; let origin:CGPoint }
    static func capture(_ r:CGRect)->Shot{
        let rr=host.isFlipped ? r:CGRect(x:r.minX,y:host.bounds.height-r.maxY,width:r.width,height:r.height)
        let b=host.bitmapImageRepForCachingDisplay(in:rr)!;host.cacheDisplay(in:rr,to:b)
        return .init(cg:b.cgImage!,scale:Double(b.pixelsWide)/r.width,origin:r.origin)
    }
    static func clipRect(_ clip:AWCValue)->CGRect{.init(x:clip["x"].number!,y:clip["y"].number!,width:clip["width"].number!,height:clip["height"].number!)}
    static func source(_ url:URL,clip:AWCValue)->Shot?{
        guard let cg=NSImage(contentsOf:url)?.cgImage(forProposedRect:nil,context:nil,hints:nil) else {return nil}
        return .init(cg:cg,scale:1,origin:.init(x:clip["x"].number!,y:clip["y"].number!))
    }
    /// CSS-pixel grid of the viewport region (x, y, w, h); each CSS pixel averages its device pixels.
    static func grid(_ s:Shot,x:Int,y:Int,w:Int,h:Int)->AccordionFloatingGrid{
        let k=max(1,Int(s.scale.rounded()))
        let crop=CGRect(x:(Double(x)-s.origin.x)*Double(k),y:(Double(y)-s.origin.y)*Double(k),width:Double(w*k),height:Double(h*k))
        var values=[Double](repeating:-999,count:w*h*3)
        guard let cg=s.cg.cropping(to:crop),cg.width==w*k,cg.height==h*k else {return .init(x:x,y:y,w:w,h:h,values:values)}
        var buffer=[UInt8](repeating:0,count:cg.width*cg.height*4)
        buffer.withUnsafeMutableBytes{raw in
            let ctx=CGContext(data:raw.baseAddress,width:cg.width,height:cg.height,bitsPerComponent:8,bytesPerRow:cg.width*4,space:CGColorSpace(name:CGColorSpace.sRGB)!,bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue)!
            ctx.draw(cg,in:.init(x:0,y:0,width:cg.width,height:cg.height))
        }
        let n=Double(k*k)
        for py in 0..<h { for px in 0..<w {
            var sum=[0.0,0.0,0.0]
            for yy in (py*k)..<(py*k+k) { for xx in (px*k)..<(px*k+k) { let i=(yy*cg.width+xx)*4;for c in 0..<3 {sum[c]+=Double(buffer[i+c])} } }
            for c in 0..<3 {values[(py*w+px)*3+c]=sum[c]/n}
        } }
        return .init(x:x,y:y,w:w,h:h,values:values)
    }
    static func pixel(_ s:Shot,_ x:Double,_ y:Double)->[Double]{grid(s,x:Int(x),y:Int(y),w:1,h:1).at(Int(x),Int(y))}
    static func diff(_ a:[Double],_ b:[Double])->Double{var m=0.0;for i in 0..<3{m=max(m,abs(a[i]-b[i]))};return m}
    /// Every flat (non-edge) CSS pixel of the source clip is compared with the native pixel at the
    /// same viewport position. Glyph and antialiased edges are excluded in either image: font
    /// rasterization differs by platform and is covered by the typography fixtures.
    @discardableResult static func comparePaint(_ label:String,web source:Shot?,clip:AWCValue,native:Shot,extra:[String:Any]=[:])->[String:Any]{
        guard let source else {check(false,"\(label) source shot");return [:]}
        let cx=Int(clip["x"].number!),cy=Int(clip["y"].number!),cw=Int(clip["width"].number!),ch=Int(clip["height"].number!)
        let web=grid(source,x:cx,y:cy,w:cw,h:ch),nat=grid(native,x:cx,y:cy,w:cw,h:ch)
        var n=0,bad=0,sum=0.0,worst=0.0,worstAt=""
        for py in (cy+1)..<(cy+ch-1) { for px in (cx+1)..<(cx+cw-1) where web.flat(px,py,6) && nat.flat(px,py,6) {
            let d=diff(web.at(px,py),nat.at(px,py));n+=1;sum+=d;if d>6 {bad+=1}
            if d>worst {worst=d;worstAt="(\(px),\(py)) web \(web.at(px,py).map{Int($0)}) native \(nat.at(px,py).map{Int($0.rounded())})"}
        } }
        let coverage=Double(n)/Double(max(1,(cw-2)*(ch-2))),ratio=Double(bad)/Double(max(n,1))
        check(coverage>0.6,"\(label) compared flat pixels cover \(coverage) of the clip")
        check(ratio<=0.005 && sum/Double(max(n,1))<=1.0,"\(label) flat pixels match the source (mean \(sum/Double(max(n,1))), >6: \(bad)/\(n), worst \(worst) at \(worstAt))")
        if let dir=captureDir {
            try? FileManager.default.createDirectory(at:dir,withIntermediateDirectories:true)
            try? NSBitmapImageRep(cgImage:native.cg).representation(using:.png,properties:[:])?.write(to:dir.appendingPathComponent(label.replacingOccurrences(of:"/",with:"-")+".png"))
        }
        var out:[String:Any]=["case":label,"compared":n,"coverage":coverage,"mean":sum/Double(max(n,1)),"over6":bad,"worst":worst,"worstAt":worstAt]
        for (k,v) in extra {out[k]=v}
        return out
    }
    static func near(_ a:CGRect?,_ b:AWCValue,_ tol:Double=0.6)->Bool{
        guard let a else {return false}
        return abs(a.minX-b["x"].number!)<=tol && abs(a.minY-b["y"].number!)<=tol && abs(a.width-b["width"].number!)<=tol && abs(a.height-b["height"].number!)<=tol
    }
    static func describe(_ r:CGRect?)->String{r.map{"(\($0.minX),\($0.minY),\($0.width),\($0.height))"} ?? "nil"}
    static func wrect(_ r:AWCValue)->String{"(\(r["x"].number!),\(r["y"].number!),\(r["width"].number!),\(r["height"].number!))"}
    // MARK: Paint
    static func paint(_ c:AWCValue,shots:URL){
        let name=c["name"].string,variant=c["variant"].string,expanded=c["expanded"] == .bool(true)
        state.style=c["style"].string;state.dark=c["theme"].string=="dark";state.rtl=c["direction"].string=="rtl";state.viewport=nil;state.tints=[:];state.inspect="accordion|a"
        state.pointer.update(phase:.leave)
        state.panels=[panel("accordion",variant:variant,expanded:expanded)];state.epoch+=1;pump(0.45)
        guard let pointer=chassis("accordion"),let context=pointer.context else {check(false,"\(name) chassis handle present");return}
        let root=context.registry.rect("accordion")
        check(near(root,c["root"]),"\(name) panel at viewport \(describe(root)) like source \(wrect(c["root"]))")
        for item in c["items"].array { let r=context.registry.rect(item["id"].string); check(near(r,item["rect"]),"\(name) item \(item["id"].string) \(describe(r)) vs \(wrect(item["rect"]))") }
        let handle=node("a","chassis-handle"),bar=node("a","chassis-handle-bar")
        check(near(handle?.bounds,c["handle"]["rect"]),"\(name) handle \(describe(handle?.bounds)) vs \(wrect(c["handle"]["rect"]))")
        check(near(rect(pointer),c["handle"]["rect"]),"\(name) handle hit area \(describe(rect(pointer))) vs \(wrect(c["handle"]["rect"]))")
        check(near(bar?.bounds,c["bar"]["rect"]),"\(name) bar \(describe(bar?.bounds)) vs \(wrect(c["bar"]["rect"]))")
        let opacity=bar?.metrics["opacity"]?.number ?? -1,ink=bar?.metrics["color"]?.array.compactMap{$0.number} ?? [],want=color(c["bar"]["background"].string)
        check(abs(opacity-c["bar"]["opacity"].number!)<0.004,"\(name) bar opacity \(opacity) vs \(c["bar"]["opacity"].number!)")
        check(ink.count==3 && (0..<3).allSatisfy{abs(ink[$0]-want[$0])<0.012},"\(name) bar colour \(ink) vs \(want)")
        let fill=handle?.metrics["background"]?.array.compactMap{$0.number} ?? [],wantFill=color(c["handle"]["background"].string)
        check(fill.count==4 && zip(premultiplied(fill),premultiplied(wantFill)).allSatisfy{abs($0-$1)<0.012},"\(name) handle background \(fill) vs \(wantFill)")
        let group=node("accordion","md-accordion")
        check((group?.metrics["zIndex"]?.number ?? 0)>1000 && Int(c["panel"]["zIndex"].string)! > 1000,"\(name) brought to front on load (\(group?.metrics["zIndex"]?.number ?? 0), source \(c["panel"]["zIndex"].string))")
        check(abs(state.after.minY-state.before.maxY)<0.5,"\(name) floating panel leaves the flow (footprint \(state.after.minY-state.before.maxY))")
        let shot=capture(clipRect(c["clip"])),src=source(shots.appendingPathComponent(name+".png"),clip:c["clip"])
        guard let src else {check(false,"\(name) source");return}
        // Rounded overflow clip: the corner ear outside the radius shows shadow and page, inside shows the panel.
        // Outside the radius the pixel is pure blurred shadow: Skia's analytic rounded-rect blur and the
        // native Gaussian of the rasterized path differ there by up to 6.5/255 (flat areas elsewhere ≤ 3).
        let r=Double(c["panel"]["radius"].string.replacingOccurrences(of:"px",with:""))!,box=c["root"]
        let x0=box["x"].number!,y0=box["y"].number!,x1=x0+box["width"].number!-1,y1=y0+box["height"].number!-1
        var corners:[[String:Any]]=[]
        for (sx,sy) in [(1.0,1.0),(-1.0,1.0),(1.0,-1.0),(-1.0,-1.0)] { for f in [0.15,0.45] {
            let px=(sx>0 ? x0+r*f:x1-r*f).rounded(.down),py=(sy>0 ? y0+r*f:y1-r*f).rounded(.down)
            let a=pixel(src,px,py),b=pixel(shot,px,py)
            corners.append(["at":[px,py],"web":a,"native":b])
            check(diff(a,b)<=(f<0.3 ? 8:6),"\(name) corner \(f<0.3 ? "outside":"inside") radius at (\(px),\(py)) web \(a) native \(b)")
        } }
        let bc=c["bar"]["rect"],bx=(bc["x"].number!+bc["width"].number!/2).rounded(.down),by=bc["y"].number!+1
        let a=pixel(src,bx,by),b=pixel(shot,bx,by)
        check(diff(a,b)<=6,"\(name) grip pill pixel web \(a) native \(b)")
        report.append(comparePaint(name,web:src,clip:c["clip"],native:shot,extra:["corners":corners]))
    }
    // MARK: Drags
    struct Sample{let t:Double;let barT:Double?;let handleT:Double?;let panelT:Double?;let width:Double?;let opacity:Double?;let ink:[Double]?;let fill:[Double]?;let fraction:Double?;let x:Double?;let y:Double?;let dragging:Bool?}
    static func sample()->Sample{
        let bar=node("a","chassis-handle-bar"),handle=node("a","chassis-handle"),panel=node("accordion","floating-panel"),group=node("accordion","md-accordion")
        return .init(t:now(),barT:bar?.metrics["renderTime"]?.number,handleT:handle?.metrics["renderTime"]?.number,panelT:panel?.metrics["renderTime"]?.number,
                     width:bar?.metrics["width"]?.number,opacity:bar?.metrics["opacity"]?.number,ink:bar?.metrics["color"]?.array.compactMap{$0.number},
                     fill:handle?.metrics["background"]?.array.compactMap{$0.number},fraction:panel?.metrics["fraction"]?.number,
                     x:group?.metrics["x"]?.number,y:group?.metrics["y"]?.number,dragging:group?.metrics["chassisDragging"]?.bool)
    }
    static func drag(_ c:AWCValue,shots:URL){
        let name=c["name"].string,variant=c["variant"].string,preset=c["transition"].string
        state.style=c["style"].string;state.dark=false;state.rtl=c["direction"].string=="rtl";state.viewport=nil;state.tints=[:];state.inspect="accordion|a"
        state.pointer.update(phase:.leave)
        state.panels=[panel("accordion",variant:variant,transition:preset)];state.epoch+=1;pump(0.45);state.events=[]
        let phases=c["phases"].array,ev=c["events"].array
        guard phases.count==5,ev.count==6,ev.map({$0["name"].string})==["mdDragStart","mdDragMove","mdDragMove","mdDragMove","mdDragMove","mdDragEnd"] else {check(false,"\(name) source record shape");return}
        guard let pointer=chassis("accordion"),let context=pointer.context else {check(false,"\(name) chassis handle present");return}
        let hp=CGPoint(x:c["handlePoint"].array[0].number!,y:c["handlePoint"].array[1].number!)
        let hr=rect(pointer)
        check(abs(hr.midX-hp.x)<=0.5 && abs(hr.midY-hp.y)<=0.5,"\(name) handle centre (\(hr.midX),\(hr.midY)) at source point \(hp)")
        func point(_ i:Int)->CGPoint{.init(x:ev[i]["detail"]["clientX"].number!,y:ev[i]["detail"]["clientY"].number!)}
        // Chrome step time = trusted-event delivery where the source reports it (mdDrag* timestamps).
        let steps:[(String,Double,()->Void)]=[
            ("hover",phases[0]["t"].number!,{state.pointer.update(phase:.move,location:hp)}),
            ("down",ev[0]["t"].number!,{
                if debug { let w=host.convert(CGPoint(x:hp.x,y:host.isFlipped ? hp.y:host.bounds.height-hp.y),to:nil),hit=host.superview.flatMap{host.hitTest($0.convert(w,from:nil))}
                    print("DEBUG \(name) down hit \(hit.map{String(describing:type(of:$0))} ?? "nil") id \(hit?.accessibilityIdentifier() ?? "") chassis \(hit === chassis("accordion")) rect \(chassis("accordion").map(rect) ?? .zero)") }
                state.pointer.update(phase:.down,location:hp);mouse(.leftMouseDown,hp)
                if debug { print("DEBUG \(name) after down dragging \(context.state.chassisDragging) z \(String(describing:context.state.zIndex))");fflush(stdout) } }),
            ("move1",ev[1]["t"].number!,{state.pointer.update(phase:.move,location:point(1));mouse(.leftMouseDragged,point(1))}),
            ("move2",ev[2]["t"].number!,{state.pointer.update(phase:.move,location:point(2));mouse(.leftMouseDragged,point(2))}),
            ("move3",ev[3]["t"].number!,{state.pointer.update(phase:.move,location:point(3));mouse(.leftMouseDragged,point(3))}),
            ("upmove",ev[4]["t"].number!,{state.pointer.update(phase:.move,location:point(4));mouse(.leftMouseDragged,point(4))}),
            ("up",ev[5]["t"].number!,{mouse(.leftMouseUp,point(5));state.pointer.update(phase:.up,location:point(5))}),
            ("leave",phases[4]["t"].number!,{state.pointer.update(phase:.leave)}),
        ]
        // The source screenshot of each phase precedes the next phase's first input.
        let phaseEnd:[String:Int]=["down":0,"move1":1,"upmove":2,"leave":3]
        var samples:[Sample]=[],stepTimes:[String:Double]=[:],snaps:[Int:[String:Any]]=[:],pending:[(String,URL,AWCValue,Shot)]=[]
        let webT0=steps[0].1,t0=now(),end=phases[4]["t"].number!-webT0+420
        var next=0
        func snapshot(_ i:Int){
            let p=phases[i],label=p["label"].string,s=p["snap"],n=sample()
            let root=context.registry.rect("accordion")
            check(near(root,s["root"]),"\(name)/\(label) panel \(describe(root)) vs \(wrect(s["root"]))")
            for item in s["items"].array { let r=context.registry.rect(item["id"].string); check(near(r,item["rect"]),"\(name)/\(label) item \(item["id"].string) \(describe(r)) vs \(wrect(item["rect"]))") }
            let handle=node("a","chassis-handle"),bar=node("a","chassis-handle-bar")
            check(near(handle?.bounds,s["handle"]["rect"]),"\(name)/\(label) handle \(describe(handle?.bounds)) vs \(wrect(s["handle"]["rect"]))")
            if let b=bar?.bounds { let w=s["bar"]["rect"]
                check(abs(b.midX-(w["x"].number!+w["width"].number!/2))<=0.5 && abs(b.minY-w["y"].number!)<=0.5 && abs(b.height-w["height"].number!)<=0.5,"\(name)/\(label) bar centred like source \(describe(b)) vs \(wrect(w))") }
            else { check(false,"\(name)/\(label) bar measured") }
            check(n.dragging==(s["dragging"] == .bool(true)),"\(name)/\(label) panel dragging \(String(describing:n.dragging)) vs \(s["dragging"])")
            let z=node("accordion","md-accordion")?.metrics["zIndex"]?.number ?? -1
            snaps[i]=["z":z,"webZ":Double(s["panel"]["zIndex"].string)!]
            pending.append(("\(name)/\(label)",shots.appendingPathComponent(name+"-"+label+".png"),p["clip"],capture(clipRect(p["clip"]))))
        }
        while now()-t0<end {
            while next<steps.count && now()-t0 >= steps[next].1-webT0 {
                if let i=phaseEnd[steps[next].0] {snapshot(i)}
                stepTimes[steps[next].0]=now();steps[next].2();next+=1
            }
            pump(0.004);samples.append(sample())
        }
        snapshot(4)
        // Rendered phase paint, compared after the timed run (the comparison is slow in debug builds).
        for (label,url,clip,shot) in pending { report.append(comparePaint(label,web:source(url,clip:clip),clip:clip,native:shot)) }
        // Stacking: bring-to-front raises the panel by exactly one step at drag start (source z-index counter).
        if let h=snaps[0],let p=snaps[1] {
            let dz=(p["z"] as! Double)-(h["z"] as! Double),wdz=(p["webZ"] as! Double)-(h["webZ"] as! Double)
            check(dz==wdz,"\(name) drag start raises the panel \(dz) like source \(wdz)")
            for i in 2...4 { check(snaps[i]?["z"] as? Double==p["z"] as? Double,"\(name) z-index stays raised in phase \(i)") }
        }
        // mdDrag* payloads: physical viewport client point, panel origin and delta.
        let mine=state.events.filter{$0.name.hasPrefix("mdDrag")}
        check(mine.map(\.name)==ev.map{$0["name"].string},"\(name) drag events \(mine.map(\.name))")
        for (e,w) in zip(mine,ev) { for k in ["clientX","clientY","x","y","dx","dy"] {
            let a=e.detail[k].number ?? .nan,b=w["detail"][k].number!
            check(abs(a-b)<0.01,"\(name) \(e.name) \(k) \(a) vs \(b)")
        } ; check(e.nodeID=="accordion","\(name) \(e.name) targets the accordion") }
        // Source timings.
        let motion=AWCNativeAccordionMotion(preset:preset,opening:false,reduced:false)
        let timing=AWCAccordionInteractionTiming(motion:motion,preset:preset,tokens:AWCTheme.generated(dark:false).tokens)
        for a in c["anims"].array where a["property"].string=="width" {
            let k=numbers(a["easing"].string)
            check(abs(timing.spring.duration-a["duration"].number!)<0.01 && zip(timing.spring.curve,k).allSatisfy{abs($0-$1)<1e-9},"\(name) grip width timing \(timing.spring) equals source \(a["duration"].number!) \(a["easing"].string)")
        }
        if preset=="none" { check(timing.spring.duration==0 && timing.effects.duration==0 && c["anims"].array.isEmpty,"\(name) transition none is instant like source") }
        // Per-frame comparison: each native value at its render time against Chrome's samples
        // over two 60 Hz frames of scheduling difference (native leads ≤ 40 ms, trails ≤ 34 ms).
        var web=phases.flatMap{$0["samples"].array}
        let rest=phases[4]["samples"].array.last!,first=phases[0]["samples"].array.first!
        web.insert(.object(["t":.number(webT0),"barWidth":rest["barWidth"],"barOpacity":rest["barOpacity"],"barBackground":rest["barBackground"],"handleBackground":rest["handleBackground"],"shadow":first["shadow"],"x":first["x"],"y":first["y"]]),at:0)
        let restShadow=numbers(first["shadow"].string),liftShadow=numbers(phases[2]["snap"]["panel"]["shadow"].string)
        let key=restShadow.indices.max{abs(liftShadow[$0]-restShadow[$0])<abs(liftShadow[$1]-restShadow[$1])}!
        func fraction(_ s:AWCValue)->[Double]{let v=numbers(s["shadow"].string);return [v.count==restShadow.count ? (v[key]-restShadow[key])/(liftShadow[key]-restShadow[key]):.nan]}
        let webSteps=steps.map{($0.0,$0.1)}
        func webTime(_ native:Double)->Double{
            let done=webSteps.filter{stepTimes[$0.0].map{$0<=native} ?? false}
            guard let step=done.last,let n=stepTimes[step.0] else {return webT0+(native-t0)}
            return step.1+(native-n)
        }
        // Between consecutive rAF samples the value is interpolated; where Chrome recorded no frame
        // for more than two frames (screenshots between phases, a dropped-frame stretch) only the
        // monotone envelope of the neighbouring samples is known.
        func webValue(_ read:(AWCValue)->[Double],_ t:Double)->(lo:[Double],hi:[Double]){
            guard let after=web.firstIndex(where:{$0["t"].number!>=t}) else {let v=read(web.last!);return (v,v)}
            if after==0 {let v=read(web[0]);return (v,v)}
            let a=web[after-1],b=web[after],ta=a["t"].number!,tb=b["t"].number!,va=read(a),vb=read(b)
            if tb-ta>34 {return (zip(va,vb).map{min($0,$1)},zip(va,vb).map{max($0,$1)})}
            let x=tb>ta ? (t-ta)/(tb-ta):1
            let v=zip(va,vb).map{$0+($1-$0)*x}
            return (v,v)
        }
        let props:[(String,Double,(AWCValue)->[Double],(Sample)->(Double?,[Double]?))]=[
            ("grip width",0.1,{[$0["barWidth"].number!]},{s in (s.barT,s.width.map{[$0]})}),
            ("grip opacity",0.004,{[$0["barOpacity"].number!]},{s in (s.barT,s.opacity.map{[$0]})}),
            ("grip colour",0.012,{Array(color($0["barBackground"].string).prefix(3))},{s in (s.barT,s.ink.map{Array($0.prefix(3))})}),
            ("handle tint",0.012,{premultiplied(color($0["handleBackground"].string))},{s in (s.handleT,s.fill.map(premultiplied))}),
            ("panel elevation",0.01,fraction,{s in (s.panelT,s.fraction.map{[$0]})}),
            ("panel position",0.01,{[$0["x"].number!,$0["y"].number!]},{s in (nil,s.x.flatMap{x in s.y.map{[x,$0]}})}),
        ]
        var compared:[String:Int]=[:]
        for (prop,tol,readWeb,read) in props {
            var worst=0.0
            for s in samples {
                let (time,value)=read(s)
                guard let v=value,!v.isEmpty else {continue}
                let at=time ?? s.t
                var lo=Array(repeating:Double.infinity,count:v.count),hi=Array(repeating:-Double.infinity,count:v.count),x=at-34
                while x<=at+40 { let e=webValue(readWeb,webTime(x)); for i in 0..<min(v.count,e.lo.count) {lo[i]=min(lo[i],e.lo[i]);hi[i]=max(hi[i],e.hi[i])}; x+=2 }
                let ok=(0..<min(v.count,lo.count)).allSatisfy{v[$0]>=lo[$0]-tol && v[$0]<=hi[$0]+tol}
                for i in 0..<min(v.count,lo.count) { worst=max(worst,max(lo[i]-v[i],v[i]-hi[i])) }
                check(ok,"\(name) \(prop) rendered \(v) at web \(webTime(at)) within Chrome samples [\(lo),\(hi)]");compared[prop,default:0]+=1
            }
            if let final=samples.last.flatMap({read($0).1}) { let want=readWeb(web.last!); check(zip(final,want).allSatisfy{abs($0-$1)<max(tol,0.012)},"\(name) \(prop) settles to the source \(final) vs \(want)") }
            check((compared[prop] ?? 0)>100,"\(name) \(prop) rendered samples compared (\(compared[prop] ?? 0))")
        }
        report.append(["case":name,"samples":samples.count,"compared":compared])
        state.pointer.update(phase:.leave);pump(0.2)
    }
    // MARK: Stacking, narrow viewport, flow toggle
    static func stacking(_ c:AWCValue){
        state.style="default";state.dark=false;state.rtl=false;state.viewport=nil;state.inspect="f1|f2|f3"
        state.tints=["f1":"#FF0000","f2":"#0000FF","f3":"#00C000"]
        state.panels=[panel("f1",variant:"filled",x:40,y:40,ids:["p","q"]),panel("f2",variant:"outlined",x:140,y:90,ids:["r","s"]),panel("f3",variant:"filled",x:520,y:40,ids:["u","v"],bring:false)]
        state.epoch+=1;pump(0.45)
        func z()->[Double]{["f1","f2","f3"].map{node($0,"md-accordion")?.metrics["zIndex"]?.number ?? -2}}
        func webZ(_ v:AWCValue)->[Double]{v.array.map{Double($0.string)!}}
        func relative(_ native:[Double],_ source:[Double],_ label:String){
            // Native nil z-index = the source stylesheet's z-index: 1000.
            let n=native.map{$0<0 ? 1000:$0}
            check(n[1]-n[0]==source[1]-source[0] && (n[2]==1000)==(source[2]==1000) && (native[2] < 0)==(source[2]==1000),"stacking \(label) z \(native) relative order like source \(source)")
        }
        // Distinct panel tints (native-only) make the paint order observable where f1 and f2 overlap.
        let probe=CGPoint(x:250,y:130)
        relative(z(),webZ(c["initial"]),"on load")
        func probePixel()->[Double]{pixel(capture(.init(x:probe.x,y:probe.y,width:1,height:1)),probe.x,probe.y)}
        var px=probePixel()
        check(diff(px,[0,0,255])<=3,"stacking on load: later raised panel paints on top \(px)")
        func drag(_ id:String){
            guard let v=chassis(id) else {check(false,"stacking \(id) handle");return}
            let r=rect(v),p=CGPoint(x:r.midX,y:r.midY)
            state.pointer.update(phase:.move,location:p);mouse(.leftMouseDown,p);pump(0.05)
            mouse(.leftMouseDragged,.init(x:p.x+10,y:p.y+5));pump(0.05);mouse(.leftMouseUp,.init(x:p.x+10,y:p.y+5));pump(0.15)
        }
        drag("f1");relative(z(),webZ(c["afterFirst"]),"after dragging the first panel")
        px=probePixel()
        check(diff(px,[255,0,0])<=3,"stacking: the dragged panel is brought to front \(px)")
        drag("f3");relative(z(),webZ(c["afterNoBring"]),"after dragging bring-to-front=false")
        for (i,id) in ["f1","f2","f3"].enumerated() { let r=chassis(id)?.context?.registry.rect(id); check(near(r,c["rects"].array[i]),"stacking \(id) rect \(describe(r)) vs \(wrect(c["rects"].array[i]))") }
        state.tints=[:];state.pointer.update(phase:.leave)
    }
    static func narrow(_ c:AWCValue){
        let width=c["viewport"].number!
        state.style="default";state.dark=false;state.rtl=false;state.tints=[:];state.inspect="accordion|a";state.viewport = .init(width:width,height:400)
        state.panels=[panel("accordion",variant:"filled",x:8,y:8)];state.epoch+=1;pump(0.45)
        let r=chassis("accordion")?.context?.registry.rect("accordion")
        check(near(r,c["root"]),"viewport \(width): panel limited to calc(100vw - 16px) \(describe(r)) vs \(wrect(c["root"]))")
        state.viewport=nil
    }
    /// Toggling `floating` (source @Watch): out of floating the panel rejoins the flow and drops its
    /// z-index; back in, it is re-seeded at initial-x/initial-y without a new raise.
    static func toggle(){
        state.style="default";state.dark=false;state.rtl=false;state.tints=[:];state.inspect="accordion|a";state.viewport=nil
        state.panels=[panel("accordion",variant:"filled",x:200,y:300)];state.epoch+=1;pump(0.45)
        guard let context=chassis("accordion")?.context else {check(false,"toggle chassis");return}
        let registry=context.registry,z0=node("accordion","md-accordion")?.metrics["zIndex"]?.number ?? -1
        var p=state.panels[0];p.properties["floating"]=false;state.panels=[p];pump(0.4)
        let inflow=registry.rect("accordion")
        check(chassis("accordion")==nil,"in-flow accordion has no chassis handle")
        check(inflow.map{abs($0.minX)<0.5 && abs($0.minY-state.before.maxY)<0.5 && abs(state.after.minY-$0.maxY)<0.5} ?? false,"in-flow accordion occupies its layout slot \(describe(inflow)) between \(describe(state.before)) and \(describe(state.after))")
        check(node("accordion","md-accordion")?.metrics["zIndex"]?.number == -1,"in-flow accordion drops its z-index")
        p.properties["floating"]=true;state.panels=[p];pump(0.4)
        let back=registry.rect("accordion")
        check(back.map{abs($0.minX-200)<0.5 && abs($0.minY-300)<0.5 && abs($0.width-360)<0.5} ?? false,"re-floated panel is re-seeded at initial-x/initial-y \(describe(back))")
        check(abs(state.after.minY-state.before.maxY)<0.5,"re-floated panel leaves the flow again")
        check(node("accordion","md-accordion")?.metrics["zIndex"]?.number == -1 && z0>1000,"re-floating does not raise (source keeps the stylesheet z-index)")
    }
    static func main(){
        _ = NSApplication.shared;NSApp.setActivationPolicy(.accessory)
        host=NSHostingView(rootView:AccordionFloatingFixture(state:state));window=NSWindow(contentRect:.init(x:-20000,y:-20000,width:1200,height:900),styleMask:[.borderless],backing:.buffered,defer:false);window.isReleasedWhenClosed=false;window.colorSpace = .sRGB;window.contentView=host;window.orderFrontRegardless();pump(0.2)
        let fixtures=URL(fileURLWithPath:#filePath).deletingLastPathComponent().appendingPathComponent("Fixtures")
        let oracle=try! JSONDecoder().decode(AWCValue.self,from:Data(contentsOf:fixtures.appendingPathComponent("accordion-web-floating.json")))
        let shots=fixtures.appendingPathComponent("accordion-web-floating"),only=ProcessInfo.processInfo.environment["AWC_ACCORDION_FLOATING_ONLY"]
        if only==nil || only=="paint" { for c in oracle["paint"].array { paint(c,shots:shots) } }
        if only==nil || only=="drag" { for c in oracle["drags"].array where caseFilter.map({c["name"].string.contains($0)}) ?? true { drag(c,shots:shots) } }
        if only==nil || only=="stacking" { for c in oracle["stacking"].array { stacking(c) } }
        if only==nil || only=="narrow" { for c in oracle["narrow"].array { narrow(c) } }
        if only==nil || only=="toggle" { toggle() }
        if let output=ProcessInfo.processInfo.environment["AWC_ACCORDION_FLOATING_OUTPUT"]{try! JSONSerialization.data(withJSONObject:["checks":checks,"failures":failures,"report":report],options:[.prettyPrinted,.sortedKeys]).write(to:URL(fileURLWithPath:output))}
        print("Accordion native floating panel: \(checks-failures.count)/\(checks) checks passed")
        window.close();if !failures.isEmpty{exit(1)}
    }
}
