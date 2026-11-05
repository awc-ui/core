import AppKit
import SwiftUI
import Observation
@testable import AWCUI

@Observable final class AccordionPartsFixtureState {
    var node=AWCNode(id:"accordion",tag:"md-accordion")
    var parts:[AWCAccordionItemPart:AWCAccordionPartAppearance]=[:]
    var override=AWCAccordionPartAppearance()
    var sharedHeader=AWCAccordionPartAppearance()
    var epoch=0
    var dark=false
    var rtl=false
    var measurements:[AWCNativeInspectionNode]=[]
    let controller=AWCAccordionItemController()
}
struct AccordionPartsRoot: NSViewRepresentable {
    func makeNSView(context:Context)->NSView {let v=NSView();v.setAccessibilityIdentifier("fixture.root");return v}
    func updateNSView(_ view:NSView,context:Context){}
}
struct AccordionPartsFixture:View {
    let state:AccordionPartsFixtureState
    var body:some View {
        let epoch=state.epoch,theme=AWCTheme.generated(dark:state.dark)
        AWCNativeAccordionGroup(node:state.node,theme:theme,onEvent:{_ in})
            .awcAccordionItemPartAppearance(state.override,part:.header,for:"first")
            .awcAccordionItemPartAppearance(state.sharedHeader,part:.header)
            .environment(\.awcAccordionItemParts,state.parts)
            .awcAccordionItemController(state.controller,for:"first")
            .environment(\.awcAccordionReducedMotion,false)
            .environment(\.layoutDirection,state.rtl ? .rightToLeft:.leftToRight)
            .frame(width:400).background{AccordionPartsRoot()}
            .awcNativeInspection(rootID:"first",coordinateSpace:"parts"){if state.epoch==epoch{state.measurements=$0}}
            .id(epoch).padding(30).frame(maxWidth:.infinity,maxHeight:.infinity,alignment:.topLeading)
            .background(theme.background).coordinateSpace(name:"parts")
    }
}
@main @MainActor enum NativeAccordionPartsIntegration {
    static let state=AccordionPartsFixtureState()
    static var host:NSHostingView<AccordionPartsFixture>!,window:NSWindow!
    static var checks=0,failures:[String]=[]
    static func check(_ value:Bool,_ label:String) { checks+=1;if !value {failures.append(label);print("FAIL: "+label);fflush(stdout)} }
    static func near(_ a:Double,_ b:Double,_ label:String) { check(abs(a-b)<=0.6,"\(label): native \(a), Web \(b)") }
    static func pump(_ duration:Double=0.08) {
        let end=Date().addingTimeInterval(duration)
        while Date()<end {
            while let event=NSApp.nextEvent(matching:.any,until:.distantPast,inMode:.default,dequeue:true) { NSApp.sendEvent(event) }
            host.layoutSubtreeIfNeeded();host.displayIfNeeded();_ = RunLoop.current.run(mode:.default,before:Date().addingTimeInterval(0.002))
        }
    }
    static func all(_ view:NSView)->[NSView] { [view]+view.subviews.flatMap(all) }
    static func rect(_ view:NSView)->CGRect { let r=view.convert(view.bounds,to:host);return host.isFlipped ? r:.init(x:r.minX,y:host.bounds.height-r.maxY,width:r.width,height:r.height) }
    static func root()->NSView { all(host).first{$0.accessibilityIdentifier()=="fixture.root"}! }
    static func header()->AWCNativeButtonFocusView { all(host).compactMap{$0 as? AWCNativeButtonFocusView}.first{$0.accessibilityIdentifier()=="first.header"}! }
    static func number(_ css:AWCValue)->Double { Double(css.string.replacingOccurrences(of:"px",with:"")) ?? 0 }
    static func rgba(_ css:String)->[Double] {
        let regex=try! NSRegularExpression(pattern:"[0-9]+(?:\\.[0-9]+)?")
        let n=regex.matches(in:css,range:NSRange(css.startIndex...,in:css)).compactMap{Range($0.range,in:css).flatMap{Double(css[$0])}}
        let normalized=css.hasPrefix("color(srgb ") ? Array(n.prefix(3).map{$0*255})+Array(n.dropFirst(3)):n
        return normalized.count==3 ? normalized+[1]:normalized
    }
    static func hex(_ value:String)->[Double] { let raw=UInt64(value.dropFirst(),radix:16)!;let rgb=value.count==9 ? raw>>8:raw;return [Double((rgb>>16)&255),Double((rgb>>8)&255),Double(rgb&255),value.count==9 ? Double(raw&255)/255:1] }
    static func composite(_ color:[Double],_ base:[Double])->[Double] { (0..<3).map {color[$0]*color[3]+base[$0]*(1-color[3])}+[1] }
    static func bitmap()->NSBitmapImageRep { let b=host.bitmapImageRepForCachingDisplay(in:host.bounds)!;host.cacheDisplay(in:host.bounds,to:b);return b }
    static func bytes(_ image:NSBitmapImageRep)->[UInt8] {
        let source=image.cgImage!;var bytes=[UInt8](repeating:0,count:source.width*source.height*4)
        bytes.withUnsafeMutableBytes { buffer in
            let context=CGContext(data:buffer.baseAddress,width:source.width,height:source.height,bitsPerComponent:8,bytesPerRow:source.width*4,space:CGColorSpace(name:CGColorSpace.sRGB)!,bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue)!
            context.draw(source,in:.init(x:0,y:0,width:source.width,height:source.height))
        };return bytes
    }
    static func hits(_ image:NSBitmapImageRep,_ bytes:[UInt8],_ rect:CGRect,_ color:[Double])->Int {
        let sx=Double(image.pixelsWide)/host.bounds.width,sy=Double(image.pixelsHigh)/host.bounds.height
        var count=0
        for y in max(0,Int(rect.minY*sy))..<min(image.pixelsHigh,max(0,Int(rect.maxY*sy))) {
            for x in max(0,Int(rect.minX*sx))..<min(image.pixelsWide,max(0,Int(rect.maxX*sx))) {
                let index=(y*image.pixelsWide+x)*4
                if (0..<3).allSatisfy({abs(Double(bytes[index+$0])-color[$0])<4}) {count+=1}
            }
        };return count
    }
    static func snapshot(_ image:NSBitmapImageRep,_ name:String) {
        guard let directory=ProcessInfo.processInfo.environment["AWC_ACCORDION_PART_CAPTURE_DIRECTORY"] else {return}
        let url=URL(fileURLWithPath:directory);try! FileManager.default.createDirectory(at:url,withIntermediateDirectories:true)
        try! image.representation(using:.png,properties:[:])!.write(to:url.appendingPathComponent(name+".png"))
    }
    static func configure(_ value:AWCValue) {
        let spec=value["spec"]
        state.dark=value["theme"].string=="dark";state.rtl=value["direction"].string=="rtl"
        state.parts=Dictionary(uniqueKeysWithValues:spec["parts"].object.map{(AWCAccordionItemPart(rawValue:$0.key)!,AWCAccordionPartAppearance(values:$0.value.object))})
        state.override = .init()
        state.sharedHeader = .init()
        state.node = .init(id:"accordion",tag:"md-accordion",properties:["transition":"none"].merging(spec["parent"].object){_,b in b},children:[
            .init(id:"first",tag:"md-accordion-item",properties:["headline":"Account settings","supportingText":"Supporting caption","icon":"favorite","expanded":value["expanded"]].merging(spec["props"].object){_,b in b},children:[.text("Expanded content with useful details.")])
        ])
        state.epoch+=1;pump()
    }
    static func liveOverrides(_ oracle:AWCValue) {
        configure(oracle["cases"].array.first{$0["id"].string=="light-ltr-baseline-false"}!)
        var second=state.node.children[0];second.id="second"
        state.node.children.append(second);pump()
        let first=header(),sibling=all(host).compactMap{$0 as? AWCNativeButtonFocusView}.first{$0.accessibilityIdentifier()=="second.header"}!
        state.sharedHeader = .init(backgroundColor:"#335577",borderColor:"#DD3377",borderWidth:2,minHeight:96)
        state.override = .init(backgroundColor:"#884422",minHeight:112);pump()
        check(header() === first,"public part overrides retain native header identity")
        near(rect(first).height,112,"targeted part height overrides shared style")
        near(rect(sibling).height,96,"targeted part height does not leak to sibling")
        let image=bitmap(),pixels=bytes(image)
        check(hits(image,pixels,rect(first),hex("#884422"))>100,"targeted public part color paints first header")
        check(hits(image,pixels,rect(sibling),hex("#335577"))>100,"shared public part color paints sibling")
        check(hits(image,pixels,rect(first),hex("#DD3377"))>2,"sparse target retains inherited part border")
        state.controller.toggle();pump()
        check(state.controller.isExpanded,"controller activates after public part edits")
        state.override = .init();pump()
        check(header() === first && state.controller.isExpanded,"resetting targeted part retains expansion and identity")
        near(rect(first).height,96,"resetting targeted part restores shared height")
        state.sharedHeader = .init();pump()
        near(rect(first).height,74,"resetting shared part restores default first header")
        near(rect(sibling).height,74,"resetting shared part restores default sibling")
        near(rect(root()).height,216,"resetting all part styles preserves expanded body and default gap")
        snapshot(bitmap(),"live-override-reset")
    }
    static func sourceCases(_ oracle:AWCValue) {
        for value in oracle["cases"].array {
            configure(value)
            let id=value["id"].string,origin=rect(root()).origin,rootRect=rect(root())
            near(rootRect.height,value["root"]["rect"]["height"].number!,id+" root height")
            for name in ["heading","header","state-layer","drag-handle","leading-icon","trailing-icon","headline","supporting-text","panel","content","content-inner"] {
                let expected=value["parts"][name]
                let measured=state.measurements.first{$0.id=="component."+name}
                if expected["style"]["display"].string=="none" {check(measured==nil,id+" hidden "+name);continue}
                guard let measured else {check(false,id+" missing "+name);continue}
                let bounds=measured.bounds,r=expected["rect"]
                near(bounds.minX-origin.x,r["x"].number!,id+" "+name+" x")
                near(bounds.minY-origin.y,r["y"].number!,id+" "+name+" y")
                near(bounds.width,r["width"].number!,id+" "+name+" width")
                near(bounds.height,r["height"].number!,id+" "+name+" height")
            }
            let image=bitmap(),pixels=bytes(image)
            for (name,style) in value["spec"]["parts"].object {
                guard style["opacity"].number==nil || style["opacity"].number==1 else{continue}
                if ["panel","content","content-inner"].contains(name) && value["expanded"].bool != true {continue}
                guard let area=state.measurements.first(where:{$0.id=="component."+name})?.bounds else{continue}
                if case .string(let color)=style["backgroundColor"] {
                    check(hits(image,pixels,area,hex(color))>5,id+" "+name+" background actually paints")
                }
                if case .string(let color)=style["borderColor"],style["borderWidth"].number ?? 0 > 0 {
                    check(hits(image,pixels,area,hex(color))>2,id+" "+name+" border actually paints")
                }
            }
            if value["spec"]["id"].string=="layer-box" {
                let base=hex(value["background"].string)
                let tile=composite(rgba(value["item"]["style"]["backgroundColor"].string),base)
                let headerPaint=composite(rgba(value["parts"]["header"]["style"]["backgroundColor"].string),tile)
                var layer=hex("#1155CC");layer[3]=0.3
                let h=rect(header()),area=CGRect(x:h.maxX-70,y:h.midY-2,width:8,height:4)
                check(hits(image,pixels,area,composite(layer,headerPaint))>2,id+" authored state-layer opacity overrides idle opacity")
            }
            if value["theme"].string=="light" && value["direction"].string=="ltr" && value["expanded"].bool==true {snapshot(image,id)}
        }
    }
    static func main() {
        _ = NSApplication.shared;NSApp.setActivationPolicy(.accessory)
        host=NSHostingView(rootView:AccordionPartsFixture(state:state))
        window=NSWindow(contentRect:.init(x:-20000,y:-20000,width:600,height:750),styleMask:[.borderless],backing:.buffered,defer:false)
        window.isReleasedWhenClosed=false;window.colorSpace = .sRGB;window.contentView=host;window.orderFrontRegardless();pump(0.2)
        let url=URL(fileURLWithPath:#filePath).deletingLastPathComponent().appendingPathComponent("Fixtures/accordion-web-parts.json")
        let oracle=try! JSONDecoder().decode(AWCValue.self,from:Data(contentsOf:url));sourceCases(oracle);liveOverrides(oracle)
        if let path=ProcessInfo.processInfo.environment["AWC_ACCORDION_PART_OUTPUT"] {
            try! JSONSerialization.data(withJSONObject:["checks":checks,"failures":failures,"sourceCases":oracle["cases"].array.count],options:[.prettyPrinted,.sortedKeys]).write(to:URL(fileURLWithPath:path))
        }
        print("Accordion native parts: \(checks-failures.count)/\(checks) checks passed")
        window.close();if !failures.isEmpty {exit(1)}
    }
}
