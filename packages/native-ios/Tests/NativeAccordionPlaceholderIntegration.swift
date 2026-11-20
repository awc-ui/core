import AppKit
import SwiftUI
import Observation
@testable import AWCUI

// Drop-placeholder paint against Chrome captures (placeholder.html): geometry,
// fill, dashed border (Blink intervals and phase along the centerline), corner
// radius, group opacity, default and custom hooks, light/dark, LTR/RTL, variants.
@Observable final class AccordionPlaceholderFixtureState {
    var node=AWCNode(id:"accordion",tag:"md-accordion")
    var epoch=0
    var rtl=false
    var dark=false
    var style="default"
    var measurements:[AWCNativeInspectionNode]=[]
}
struct AccordionPlaceholderFixture:View {
    let state:AccordionPlaceholderFixtureState
    var appearance:AWCAccordionAppearance {
        switch state.style {
        case "custom": return .init(dropPlaceholderColor:"#FFE08280",dropPlaceholderOutlineColor:"#C62828",dropPlaceholderOutlineWidth:3,dropPlaceholderShape:.points(20),dropPlaceholderOpacity:0.7)
        case "solid": return .init(dropPlaceholderColor:"#80CBC4",dropPlaceholderOutlineWidth:0,dropPlaceholderShape:.points(0))
        default: return .init()
        }
    }
    var body:some View {
        let epoch=state.epoch,theme=AWCTheme.generated(dark:state.dark)
        AWCNativeAccordionGroup(node:state.node,theme:theme,onEvent:{_ in})
            .awcAccordionAppearance(appearance)
            .environment(\.awcAccordionReducedMotion,true)
            .environment(\.layoutDirection,state.rtl ? .rightToLeft:.leftToRight)
            .awcTheme(theme).frame(width:400)
            .awcNativeInspection(rootID:"accordion",coordinateSpace:"placeholder"){if state.epoch==epoch{state.measurements=$0}}
            .id(epoch).padding(.leading,40).padding(.top,460).frame(maxWidth:.infinity,maxHeight:.infinity,alignment:.topLeading)
            .background(theme.background).coordinateSpace(name:"placeholder")
    }
}
struct AccordionPlaceholderImage { let width:Int, height:Int, scale:Double, bytes:[UInt8] }
@main @MainActor enum NativeAccordionPlaceholderIntegration {
    static let state=AccordionPlaceholderFixtureState()
    static var host:NSHostingView<AccordionPlaceholderFixture>!,window:NSWindow!
    static var checks=0,failures:[String]=[]
    static var report:[[String:Any]]=[]
    static func check(_ value:Bool,_ name:String){checks+=1;if !value{failures.append(name);print("FAIL: "+name);fflush(stdout)}}
    static func pump(_ duration:Double=0.1){let end=Date().addingTimeInterval(duration);repeat{while let e=NSApp.nextEvent(matching:.any,until:.distantPast,inMode:.default,dequeue:true){NSApp.sendEvent(e)};host.layoutSubtreeIfNeeded();host.displayIfNeeded();_ = RunLoop.current.run(mode:.default,before:Date().addingTimeInterval(0.002))}while Date()<end}
    static func all(_ v:NSView)->[NSView]{[v]+v.subviews.flatMap(all)}
    static func grip(_ id:String)->AWCAccordionReorderPointerView?{all(host).compactMap{$0 as? AWCAccordionReorderPointerView}.first{$0.accessibilityIdentifier()==id+".reorder-pointer"}}
    static func rect(_ v:NSView)->CGRect{let r=host.convert(v.bounds,from:v);return host.isFlipped ? r:.init(x:r.minX,y:host.bounds.height-r.maxY,width:r.width,height:r.height)}
    static func mouse(_ kind:NSEvent.EventType,_ p:CGPoint){let point=host.convert(.init(x:p.x,y:host.isFlipped ? p.y:host.bounds.height-p.y),to:nil);let e=NSEvent.mouseEvent(with:kind,location:point,modifierFlags:[],timestamp:ProcessInfo.processInfo.systemUptime,windowNumber:window.windowNumber,context:nil,eventNumber:1,clickCount:1,pressure:kind == .leftMouseUp ? 0:1)!;window.sendEvent(e);pump()}
    static func decode(_ cg:CGImage,scale:Double)->AccordionPlaceholderImage{
        var buffer=[UInt8](repeating:0,count:cg.width*cg.height*4)
        buffer.withUnsafeMutableBytes{raw in
            let ctx=CGContext(data:raw.baseAddress,width:cg.width,height:cg.height,bitsPerComponent:8,bytesPerRow:cg.width*4,space:CGColorSpace(name:CGColorSpace.sRGB)!,bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue)!
            ctx.draw(cg,in:.init(x:0,y:0,width:cg.width,height:cg.height))
        }
        return .init(width:cg.width,height:cg.height,scale:scale,bytes:buffer)
    }
    static func cell(_ image:AccordionPlaceholderImage,_ x:Double,_ y:Double)->[Double]{
        var sum=[0.0,0.0,0.0],n=0.0
        let x0=Int((x*image.scale).rounded()),y0=Int((y*image.scale).rounded()),k=max(1,Int(image.scale.rounded()))
        for yy in y0..<(y0+k) { for xx in x0..<(x0+k) where xx>=0 && yy>=0 && xx<image.width && yy<image.height {
            let i=(yy*image.width+xx)*4; for c in 0..<3 {sum[c]+=Double(image.bytes[i+c])}; n+=1 } }
        return n==0 ? [-999,-999,-999]:sum.map{$0/n}
    }
    static func diff(_ a:[Double],_ b:[Double])->Double{var m=0.0;for i in 0..<3{m=max(m,abs(a[i]-b[i]))};return m}
    /// Dash runs along a straight border row/column: coverage between fill and border ink crosses 0.5.
    static func runs(_ values:[[Double]],fill:[Double],ink:[Double])->[(Double,Double)]{
        var out:[(Double,Double)]=[],start:Double?=nil
        let den=zip(fill,ink).map{$0-$1}
        func cov(_ v:[Double])->Double{var best=0.0,w=0.0;for i in 0..<3 where abs(den[i])>8{best+=(fill[i]-v[i])/den[i]*abs(den[i]);w+=abs(den[i])};return w==0 ? 0:best/w}
        var prev=cov(values.first ?? fill)
        for (i,v) in values.enumerated() {
            let c=cov(v)
            if prev<0.5 && c>=0.5 {start=Double(i)-0.5+(0.5-prev)/max(1e-9,c-prev)}
            if prev>=0.5 && c<0.5, let s=start {out.append((s,Double(i)-0.5+(prev-0.5)/max(1e-9,prev-c)));start=nil}
            prev=c
        }
        return out
    }
    static func run(_ c:AWCValue,shots:URL){
        let name=c["name"].string
        state.style=c["style"].string;state.dark=c["theme"].string=="dark";state.rtl=c["direction"].string=="rtl"
        state.node = .init(id:"accordion",tag:"md-accordion",properties:["reorderable":true,"transition":"none","variant":.string(c["variant"].string)],children:["a","b","c"].map{.init(id:$0,tag:"md-accordion-item",properties:["headline":.string($0)],children:[.text("Body")])})
        state.epoch+=1;pump(0.3)
        guard let handle=grip("c"),let context=handle.context,let root=context.registry.rect("accordion") else {check(false,"\(name) fixture");return}
        let g=rect(handle),p=CGPoint(x:g.midX,y:g.midY)
        mouse(.leftMouseDown,p);mouse(.leftMouseDragged,.init(x:p.x,y:p.y-330));pump(0.4)
        defer {mouse(.leftMouseUp,.init(x:p.x,y:p.y-330));pump(0.1)}
        guard let ph=state.measurements.first(where:{$0.name=="drop-placeholder"}),let comp=state.measurements.first(where:{$0.id=="component"}),
              let source=NSImage(contentsOf:shots.appendingPathComponent(name+".png"))?.cgImage(forProposedRect:nil,context:nil,hints:nil) else {check(false,"\(name) placeholder/source");return}
        let wr=c["placeholder"]["rect"],wroot=c["root"]
        // Geometry relative to the accordion root.
        let nx=ph.bounds.minX-comp.bounds.minX,ny=ph.bounds.minY-comp.bounds.minY
        for (a,b,label) in [(nx,wr["x"].number!-wroot["x"].number!,"x"),(ny,wr["y"].number!-wroot["y"].number!,"y"),(Double(ph.bounds.width),wr["width"].number!,"width"),(Double(ph.bounds.height),wr["height"].number!,"height")] {
            check(abs(a-b)<0.6,"\(name) placeholder \(label) \(a) vs \(b)")
        }
        let b=host.bitmapImageRepForCachingDisplay(in:host.bounds)!;host.cacheDisplay(in:host.bounds,to:b)
        let native=decode(b.cgImage!,scale:Double(b.pixelsWide)/host.bounds.width),web=decode(source,scale:1)
        if let dir=ProcessInfo.processInfo.environment["AWC_ACCORDION_PLACEHOLDER_CAPTURE_DIRECTORY"] {
            let d=URL(fileURLWithPath:dir);try? FileManager.default.createDirectory(at:d,withIntermediateDirectories:true)
            try? b.representation(using:.png,properties:[:])!.write(to:d.appendingPathComponent(name+".png"))
        }
        // Map web clip coordinates to native host coordinates through the root origins.
        let ox=root.minX-wroot["x"].number!,oy=root.minY-wroot["y"].number!
        let px=wr["x"].number!,py=wr["y"].number!,pw=wr["width"].number!,phh=wr["height"].number!
        let width=Double(c["placeholder"]["borderWidth"].string.replacingOccurrences(of:"px",with:""))!,radius=Double(c["placeholder"]["radius"].string.replacingOccurrences(of:"px",with:""))!
        func both(_ x:Double,_ y:Double)->([Double],[Double]){(cell(web,x,y),cell(native,x+ox,y+oy))}
        // Interior fill (inside the border and corners).
        var interior=0.0,count=0.0,worst=0.0
        var y=py+max(width,radius/2)+3; while y<py+phh-max(width,radius/2)-3 { var x=px+radius+3; while x<px+pw-radius-3 { let (a,n)=both(x,y);let d=diff(a,n);interior+=d;count+=1;worst=max(worst,d);x+=7 }; y+=5 }
        check(count>20 && interior/count<=2.5 && worst<=6,"\(name) interior fill matches (mean \(interior/max(count,1)), max \(worst))")
        // Corner ears outside the outer radius show the backdrop.
        var ear=0.0,earN=0.0
        if radius>=4 { for (cx,cy) in [(px,py),(px+pw-1,py),(px,py+phh-1),(px+pw-1,py+phh-1)] { for v in 0..<Int(radius*0.25) { for u in 0..<Int(radius*0.25) {
            let x=cx==px ? cx+Double(u):cx-Double(u),yy=cy==py ? cy+Double(v):cy-Double(v);let (a,n)=both(x,yy);ear+=diff(a,n);earN+=1 }}}
            check(earN>0 && ear/earN<=4,"\(name) corner ears show the backdrop (mean \(ear/max(earN,1)))") }
        // Dashed border: dash runs along each straight side's centerline.
        var sides:[String:Any]=[:]
        if width>0 {
            let mid=floor(width/2)
            let fillWeb=cell(web,px+pw/2,py+phh/2),inkProbe=c["placeholder"]["borderColor"].string
            _ = inkProbe
            for side in ["top","bottom","left","right"] {
                var wv:[[Double]]=[],nv:[[Double]]=[]
                if side=="top"||side=="bottom" { let yy=side=="top" ? py+mid:py+phh-1-mid; for x in stride(from:px+radius,to:px+pw-radius,by:1) {let (a,n)=both(x,yy);wv.append(a);nv.append(n)} }
                else { let xx=side=="left" ? px+mid:px+pw-1-mid; for yy in stride(from:py+radius,to:py+phh-radius,by:1) {let (a,n)=both(xx,yy);wv.append(a);nv.append(n)} }
                // Ink = darkest/most distant sample from the fill along the web row.
                let ink=wv.max{diff($0,fillWeb)<diff($1,fillWeb)} ?? fillWeb
                let wr_=runs(wv,fill:fillWeb,ink:ink),nr=runs(nv,fill:cell(native,px+pw/2+ox,py+phh/2+oy),ink:ink)
                sides[side]=["web":wr_.map{[$0.0,$0.1]},"native":nr.map{[$0.0,$0.1]}]
                check(abs(wr_.count-nr.count)<=1,"\(name) \(side) dash count \(nr.count) vs \(wr_.count)")
                let wDash=wr_.map{$0.1-$0.0},nDash=nr.map{$0.1-$0.0}
                if wDash.count>2 && nDash.count>2 {
                    let wm=wDash.dropFirst().dropLast().reduce(0,+)/Double(wDash.count-2),nm=nDash.dropFirst().dropLast().reduce(0,+)/Double(nDash.count-2)
                    check(abs(wm-nm)<=0.6,"\(name) \(side) dash length \(nm) vs \(wm)")
                    let wp=(wr_.last!.0-wr_.first!.0)/Double(wr_.count-1),np=(nr.last!.0-nr.first!.0)/Double(nr.count-1)
                    check(abs(wp-np)<=0.15,"\(name) \(side) dash period \(np) vs \(wp)")
                }
                if side=="top", let wf=wr_.first, let nf=nr.first { check(abs(wf.0-nf.0)<=0.75,"\(name) top dash phase starts at the corner end like the source (\(nf.0) vs \(wf.0))") }
                // Every side's phase (r3-20): each full source dash centre has a native dash centre within 1.25 px.
                let wc=wr_.dropFirst().dropLast().map{($0.0+$0.1)/2},nc=nr.map{($0.0+$0.1)/2}
                if !wc.isEmpty && !nc.isEmpty {
                    let residual=wc.map{c in nc.map{abs($0-c)}.min()!}.max()!
                    check(residual<=1.25,"\(name) \(side) every source dash centre has a native dash within 1.25 px (worst \(residual))")
                }
            }
        } else {
            // No outline: the edge row is plain fill.
            let (a,n)=both(px+pw/2,py+0.5);check(diff(a,n)<=4,"\(name) borderless edge matches source fill")
        }
        report.append(["case":name,"interiorMean":interior/max(count,1),"interiorMax":worst,"earMean":earN>0 ? ear/earN:0,"sides":sides])
    }
    static func main(){
        _ = NSApplication.shared;NSApp.setActivationPolicy(.accessory)
        host=NSHostingView(rootView:AccordionPlaceholderFixture(state:state));window=NSWindow(contentRect:.init(x:-20000,y:-20000,width:600,height:760),styleMask:[.borderless],backing:.buffered,defer:false);window.isReleasedWhenClosed=false;window.colorSpace = .sRGB;window.contentView=host;window.orderFrontRegardless();pump(0.2)
        let fixtures=URL(fileURLWithPath:#filePath).deletingLastPathComponent().appendingPathComponent("Fixtures")
        let oracle=try! JSONDecoder().decode(AWCValue.self,from:Data(contentsOf:fixtures.appendingPathComponent("accordion-web-placeholder.json")))
        for c in oracle["cases"].array { run(c,shots:fixtures.appendingPathComponent("accordion-web-placeholder")) }
        if let output=ProcessInfo.processInfo.environment["AWC_ACCORDION_PLACEHOLDER_OUTPUT"]{try! JSONSerialization.data(withJSONObject:["checks":checks,"failures":failures,"report":report],options:[.prettyPrinted,.sortedKeys]).write(to:URL(fileURLWithPath:output))}
        print("Accordion native drop placeholder: \(checks-failures.count)/\(checks) checks passed")
        window.close();if !failures.isEmpty{exit(1)}
    }
}
