import AppKit
import SwiftUI
import Observation
@testable import AWCUI

// Lifted-item clipping (source `overflow:hidden` + dragging radius/fill) against
// actual Chrome captures of the same fixtures. Corner "ears" (inside the border
// box, outside the rounded padding box) must show the backdrop/shadow rather than
// header tint, and inner corner pixels must match the source paint.
@Observable final class AccordionLiftFixtureState {
    var node=AWCNode(id:"accordion",tag:"md-accordion")
    var epoch=0
    var mounts=0
    var unmounts=0
    var rtl=false
    var dark=false
    var custom=false
    var retained=false
    var measurements:[AWCNativeInspectionNode]=[]
    var events:[AWCEvent]=[]
}
struct AccordionLiftRetainedBody:View {
    let state:AccordionLiftFixtureState
    @State private var count=0
    var body:some View {
        AWCNativeView(node:.init(id:"inside",tag:"md-button",children:[.text("Retained \(count)")])) {
            if $0.name=="mdClick" {count+=1}
        }.onAppear{state.mounts+=1}.onDisappear{state.unmounts+=1}
    }
}
struct AccordionLiftFixture:View {
    let state:AccordionLiftFixtureState
    var body:some View {
        let epoch=state.epoch,theme=AWCTheme.generated(dark:state.dark)
        let custom=AWCAccordionItemAppearance(headerColorExpanded:"#B71C1C",containerColorDragging:"#C8E6C9",containerShapeDragging:.points(20))
        Group {
            if state.retained {
                AWCNativeAccordionGroup(node:state.node,theme:theme,onEvent:{state.events.append($0)})
                    .awcAccordionItemSlot(.content,for:"first"){AccordionLiftRetainedBody(state:state)}
            } else {
                AWCNativeAccordionGroup(node:state.node,theme:theme,onEvent:{state.events.append($0)})
            }
        }
        .awcAccordionItemAppearance(state.custom ? custom:.init())
        .awcAccordionAppearance(AWCAccordionAppearance(dropPlaceholderOpacity:0))
        .environment(\.awcAccordionReducedMotion,true)
        .environment(\.layoutDirection,state.rtl ? .rightToLeft:.leftToRight)
        .awcTheme(theme).frame(width:400)
        .awcNativeInspection(rootID:"accordion",coordinateSpace:"lift"){if state.epoch==epoch{state.measurements=$0}}
        .id(epoch).padding(40).frame(maxWidth:.infinity,maxHeight:.infinity,alignment:.topLeading)
        .background(theme.background).coordinateSpace(name:"lift")
    }
}
struct AccordionLiftImage { let width:Int, height:Int, scale:Double, bytes:[UInt8] }
@main @MainActor enum NativeAccordionLiftIntegration {
    static let state=AccordionLiftFixtureState()
    static var host:NSHostingView<AccordionLiftFixture>!,window:NSWindow!
    static var checks=0,failures:[String]=[]
    static var report:[[String:Any]]=[]
    static func check(_ value:Bool,_ name:String){checks+=1;if !value{failures.append(name);print("FAIL: "+name);fflush(stdout)}}
    static func pump(_ duration:Double=0.1){let end=Date().addingTimeInterval(duration);while Date()<end{while let e=NSApp.nextEvent(matching:.any,until:.distantPast,inMode:.default,dequeue:true){NSApp.sendEvent(e)};host.layoutSubtreeIfNeeded();host.displayIfNeeded();_ = RunLoop.current.run(mode:.default,before:Date().addingTimeInterval(0.003))}}
    static func all(_ v:NSView)->[NSView]{[v]+v.subviews.flatMap(all)}
    static func grip(_ id:String)->AWCAccordionReorderPointerView?{all(host).compactMap{$0 as? AWCAccordionReorderPointerView}.first{$0.accessibilityIdentifier()==id+".reorder-pointer"}}
    static func inside()->AWCNativeButtonFocusView?{all(host).compactMap{$0 as? AWCNativeButtonFocusView}.first{$0.accessibilityIdentifier()=="inside"}}
    static func rect(_ v:NSView)->CGRect{let r=host.convert(v.bounds,from:v);return host.isFlipped ? r:.init(x:r.minX,y:host.bounds.height-r.maxY,width:r.width,height:r.height)}
    static func mouse(_ kind:NSEvent.EventType,_ p:CGPoint){let point=host.convert(.init(x:p.x,y:host.isFlipped ? p.y:host.bounds.height-p.y),to:nil);let e=NSEvent.mouseEvent(with:kind,location:point,modifierFlags:[],timestamp:ProcessInfo.processInfo.systemUptime,windowNumber:window.windowNumber,context:nil,eventNumber:1,clickCount:1,pressure:kind == .leftMouseUp ? 0:1)!;window.sendEvent(e);pump()}
    static func setup(expanded:Bool,variant:String){
        state.node = .init(id:"accordion",tag:"md-accordion",properties:["reorderable":true,"transition":"none","variant":.string(variant)],children:["first","second","third"].enumerated().map{index,id in .init(id:id,tag:"md-accordion-item",properties:["headline":.string(id),"expanded":.bool(index==0 && expanded)],children:[.text("Body")])})
        state.epoch+=1;pump(0.15);state.events=[]
    }
    static func itemBounds(_ id:String)->CGRect?{grip("first")?.context?.registry.rect(id)}
    static func decode(_ cg:CGImage,scale:Double)->AccordionLiftImage{
        var buffer=[UInt8](repeating:0,count:cg.width*cg.height*4)
        buffer.withUnsafeMutableBytes{raw in
            let ctx=CGContext(data:raw.baseAddress,width:cg.width,height:cg.height,bitsPerComponent:8,bytesPerRow:cg.width*4,space:CGColorSpace(name:CGColorSpace.sRGB)!,bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue)!
            ctx.draw(cg,in:.init(x:0,y:0,width:cg.width,height:cg.height))
        }
        return .init(width:cg.width,height:cg.height,scale:scale,bytes:buffer)
    }
    static func nativeImage()->AccordionLiftImage{let b=host.bitmapImageRepForCachingDisplay(in:host.bounds)!;host.cacheDisplay(in:host.bounds,to:b);return decode(b.cgImage!,scale:Double(b.pixelsWide)/host.bounds.width)}
    /// Average colour of the 1×1 CSS-px cell whose top-left is (x,y) in points.
    static func cell(_ image:AccordionLiftImage,_ x:Double,_ y:Double)->[Double]{
        var sum=[0.0,0.0,0.0],n=0.0
        let x0=Int((x*image.scale).rounded()),y0=Int((y*image.scale).rounded()),k=max(1,Int(image.scale.rounded()))
        for yy in y0..<(y0+k) { for xx in x0..<(x0+k) where xx>=0 && yy>=0 && xx<image.width && yy<image.height {
            let i=(yy*image.width+xx)*4; for c in 0..<3 {sum[c]+=Double(image.bytes[i+c])}; n+=1 } }
        return n==0 ? [-999,-999,-999]:sum.map{$0/n}
    }
    /// CSS rgb()/rgba() composited over an opaque backdrop.
    static func rgba(_ css:String,over base:[Double])->[Double]{
        let n=css.split(whereSeparator:{!"0123456789.".contains($0)}).compactMap{Double($0)}
        guard n.count>=3 else {return base}
        let a=n.count>3 ? n[3]:1
        return (0..<3).map{n[$0]*a+base[$0]*(1-a)}
    }
    static func rgb(_ hex:String)->[Double]{let v=Int(hex.dropFirst(),radix:16)!;return [Double(v>>16&255),Double(v>>8&255),Double(v&255)]}
    static func distance(_ a:[Double],_ b:[Double])->Double{var t=0.0;for i in 0..<3{let d:Double=a[i]-b[i];t+=d*d};return t.squareRoot()}
    static func maxDiff(_ a:[Double],_ b:[Double])->Double{var m=0.0;for i in 0..<3{m=max(m,abs(a[i]-b[i]))};return m}
    struct Corner { let name:String; let dx:Int; let dy:Int }
    static let corners=[Corner(name:"top-left",dx:0,dy:0),Corner(name:"top-right",dx:1,dy:0),Corner(name:"bottom-right",dx:1,dy:1),Corner(name:"bottom-left",dx:0,dy:1)]
    static func compare(_ c:AWCValue,web:AccordionLiftImage,native:AccordionLiftImage,item:CGRect){
        let name=c["name"].string, radius=Double(c["radius"].string.replacingOccurrences(of:"px",with:""))!
        let w=c["item"],wx=w["x"].number!.rounded(),wy=w["y"].number!.rounded(),width=w["width"].number!,height=w["height"].number!
        check(abs(item.width-width)<0.7 && abs(item.height-height)<0.7,"\(name) lifted item size \(item.size) vs \(width)x\(height)")
        check(c["dragging"] == .bool(true) && c["overflow"].string=="hidden","\(name) source lifts with overflow hidden")
        let span=Int(radius)+2
        var worst:[String:Any]=[:]
        var ear=0,inner=0,earDiff=0.0,innerDiff=0.0,earMax=0.0,innerMax=0.0,earTint=0,innerTint=0,innerTintSource=0
        let tint=c["style"].string=="custom" ? rgb("#B71C1C"):nil
        for corner in corners {
            for v in 0..<span { for u in 0..<span {
                // CSS px offsets from the item's own edges for this corner.
                let px=corner.dx==0 ? Double(u):width-1-Double(u), py=corner.dy==0 ? Double(v):height-1-Double(v)
                let cx=Double(u)+0.5,cy=Double(v)+0.5,d=hypot(radius-cx,radius-cy)
                guard cx<radius && cy<radius else {continue}
                let outside=d>radius+1.25,inside=d<radius-1.25
                guard outside || inside else {continue}
                let a=cell(web,wx+px,wy+py),b=cell(native,item.minX+px,item.minY+py),diff=maxDiff(a,b)
                if outside {ear+=1;earDiff+=diff;if diff>earMax{earMax=diff;worst=["corner":corner.name,"u":u,"v":v,"web":a,"native":b]};if let tint,distance(b,tint)<60{earTint+=1}}
                else {inner+=1;innerDiff+=diff;innerMax=max(innerMax,diff);if let tint{if distance(b,tint)<30{innerTint+=1};if distance(a,tint)<30{innerTintSource+=1}}}
            }}
        }
        let earMean=ear==0 ? 0:earDiff/Double(ear),innerMean=inner==0 ? 0:innerDiff/Double(inner)
        report.append(["name":name,"earPixels":ear,"innerPixels":inner,"earMeanDiff":earMean,"earMaxDiff":earMax,"innerMeanDiff":innerMean,"innerMaxDiff":innerMax,"earTint":earTint,"innerTint":innerTint,"innerTintSource":innerTintSource,"worstEar":worst])
        check(ear>0 && inner>0,"\(name) corner samples exist")
        check(earMean<=6,"\(name) corner ears match the source backdrop/shadow (mean \(earMean))")
        check(earMax<=40,"\(name) no ear pixel departs grossly from the source (max \(earMax))")
        check(innerMean<=6,"\(name) inner corner paint matches the source (mean \(innerMean))")
        // Header label ink: the lifted header keeps its headline in both directions.
        let hl=c["headline"]["rect"],hx=hl["x"].number!-w["x"].number!,hy=hl["y"].number!-w["y"].number!
        let headerPaint=rgba(c["header"]["background"].string,over:rgba(c["background"].string,over:[0,0,0]))
        // Ink = pixels at least 40% of the way from the header paint to the label colour.
        let threshold=max(12,0.4*distance(rgba(c["headline"]["color"].string,over:headerPaint),headerPaint))
        var webInk=0,nativeInk=0
        for v in 0..<Int(hl["height"].number!) { for u in 0..<Int(hl["width"].number!) {
            if distance(cell(web,wx+hx+Double(u),wy+hy+Double(v)),headerPaint)>threshold {webInk+=1}
            if distance(cell(native,item.minX+hx+Double(u),item.minY+hy+Double(v)),headerPaint)>threshold {nativeInk+=1}
        }}
        report[report.count-1]["headlineInk"]=["web":webInk,"native":nativeInk]
        check(webInk>20 && Double(nativeInk)>=Double(webInk)*0.6 && Double(nativeInk)<=Double(webInk)*1.6,"\(name) lifted headline ink is present like the source (\(nativeInk) vs \(webInk))")
        if tint != nil {
            check(earTint==0,"\(name) clipped header tint never paints outside the dragging radius (\(earTint))")
            check(innerTint==innerTintSource,"\(name) header tint fills the same inner corner pixels as the source (\(innerTint) vs \(innerTintSource))")
        }
    }
    static func cases(_ oracle:AWCValue,shots:URL){
        for c in oracle["cases"].array {
            state.custom=c["style"].string=="custom";state.dark=c["theme"].string=="dark";state.rtl=c["direction"].string=="rtl";state.retained=false
            let expanded=c["expanded"] == .bool(true)
            setup(expanded:expanded,variant:c["variant"].string)
            guard let handle=grip("first") else {check(false,"\(c["name"].string) grip");continue}
            let g=rect(handle),p=CGPoint(x:g.midX,y:g.midY),dy=c["dy"].number!
            save(c["name"].string+"-before")
            mouse(.leftMouseDown,p);pump(0.26);save(c["name"].string+"-pressed");mouse(.leftMouseDragged,.init(x:p.x,y:p.y+dy));pump(0.6)
            guard let item=itemBounds("first"),let source=NSImage(contentsOf:shots.appendingPathComponent(c["name"].string+".png"))?.cgImage(forProposedRect:nil,context:nil,hints:nil) else {check(false,"\(c["name"].string) measurement/source capture");mouse(.leftMouseUp,.init(x:p.x,y:p.y+dy));continue}
            let native=nativeImage()
            compare(c,web:decode(source,scale:1),native:native,item:item)
            save(c["name"].string)
            mouse(.leftMouseUp,.init(x:p.x,y:p.y+dy))
        }
    }
    static func save(_ name:String){
        guard let dir=ProcessInfo.processInfo.environment["AWC_ACCORDION_LIFT_CAPTURE_DIRECTORY"] else {return}
        let d=URL(fileURLWithPath:dir);try? FileManager.default.createDirectory(at:d,withIntermediateDirectories:true)
        let b=host.bitmapImageRepForCachingDisplay(in:host.bounds)!;host.cacheDisplay(in:host.bounds,to:b)
        try? b.representation(using:.png,properties:[:])!.write(to:d.appendingPathComponent(name+".png"))
    }
    static func identity(){
        for variant in ["filled","outlined"] { for custom in [false,true] {
            state.custom=custom;state.dark=false;state.rtl=false;state.retained=true
            setup(expanded:true,variant:variant)
            guard let child=inside() else {check(false,"retained body exists");continue}
            check(child.accessibilityPerformPress(),"\(variant)/\(custom) authored body activates");pump()
            let mounts=state.mounts,unmounts=state.unmounts
            let handle=grip("first")!,g=rect(handle),p=CGPoint(x:g.midX,y:g.midY)
            mouse(.leftMouseDown,p);mouse(.leftMouseDragged,.init(x:p.x,y:p.y+40));pump(0.1)
            check(inside() === child && child.accessibilityLabel()=="Retained 1","\(variant)/\(custom) lifted clip retains the authored native view and state")
            check(state.mounts==mounts && state.unmounts==unmounts,"\(variant)/\(custom) installing the lifted clip does not remount authored content")
            check(child.accessibilityPerformPress(),"\(variant)/\(custom) clipped authored body stays interactive while lifted");pump()
            check(child.accessibilityLabel()=="Retained 2","\(variant)/\(custom) lifted authored state updates")
            mouse(.leftMouseUp,.init(x:p.x,y:p.y+40));pump(0.1)
            check(inside() === child && state.mounts==mounts && state.unmounts==unmounts,"\(variant)/\(custom) dropping removes the clip without remounting")
        }}
    }
    static func main(){
        _ = NSApplication.shared;NSApp.setActivationPolicy(.accessory)
        host=NSHostingView(rootView:AccordionLiftFixture(state:state));window=NSWindow(contentRect:.init(x:-20000,y:-20000,width:600,height:700),styleMask:[.borderless],backing:.buffered,defer:false);window.isReleasedWhenClosed=false;window.colorSpace = .sRGB;window.contentView=host;window.orderFrontRegardless();pump(0.2)
        let fixtures=URL(fileURLWithPath:#filePath).deletingLastPathComponent().appendingPathComponent("Fixtures")
        let oracle=try! JSONDecoder().decode(AWCValue.self,from:Data(contentsOf:fixtures.appendingPathComponent("accordion-web-lift.json")))
        cases(oracle,shots:fixtures.appendingPathComponent("accordion-web-lift"));identity()
        if let output=ProcessInfo.processInfo.environment["AWC_ACCORDION_LIFT_OUTPUT"]{try! JSONSerialization.data(withJSONObject:["checks":checks,"failures":failures,"report":report],options:[.prettyPrinted,.sortedKeys]).write(to:URL(fileURLWithPath:output))}
        print("Accordion native lifted clipping: \(checks-failures.count)/\(checks) checks passed")
        window.close();if !failures.isEmpty{exit(1)}
    }
}
