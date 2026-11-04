import AppKit
import SwiftUI
import Observation
import CoreText
@testable import AWCUI

@Observable final class AccordionAppearanceFixtureState {
    var node = AWCNode(id:"accordion",tag:"md-accordion")
    var group = AWCAccordionAppearance()
    var localGroup = AWCAccordionAppearance()
    var item = AWCAccordionItemAppearance()
    var local = AWCAccordionItemAppearance()
    var epoch = 0
    var dark = false
    var reduced = true
    var measurements: [AWCNativeInspectionNode] = []
    let controller = AWCAccordionItemController()
}
struct AccordionAppearanceRoot: NSViewRepresentable {
    func makeNSView(context: Context) -> NSView { let v=NSView();v.setAccessibilityIdentifier("fixture.root");return v }
    func updateNSView(_ view: NSView, context: Context) {}
}
struct AccordionAppearanceFixture: View {
    let state: AccordionAppearanceFixtureState
    var body: some View {
        let epoch=state.epoch, theme=AWCTheme.generated(dark:state.dark)
        AWCNativeAccordionGroup(node:state.node,theme:theme,onEvent:{_ in})
            .awcAccordionAppearance(state.group)
            .awcAccordionAppearance(state.localGroup,for:"accordion")
            .awcAccordionItemAppearance(state.item)
            .awcAccordionItemAppearance(state.local,for:"first")
            .awcAccordionItemController(state.controller,for:"first")
            .environment(\.awcAccordionReducedMotion,state.reduced)
            .frame(width:400).background { AccordionAppearanceRoot() }
            .awcNativeInspection(rootID:"first",coordinateSpace:"appearance") { if state.epoch==epoch { state.measurements=$0 } }
            .id(epoch).padding(30).frame(maxWidth:.infinity,maxHeight:.infinity,alignment:.topLeading)
            .background(theme.background).coordinateSpace(name:"appearance")
    }
}
@main @MainActor enum NativeAccordionAppearanceIntegration {
    static let state=AccordionAppearanceFixtureState()
    static var host:NSHostingView<AccordionAppearanceFixture>!,window:NSWindow!
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
        guard let directory=ProcessInfo.processInfo.environment["AWC_ACCORDION_APPEARANCE_CAPTURE_DIRECTORY"] else {return}
        let url=URL(fileURLWithPath:directory);try! FileManager.default.createDirectory(at:url,withIntermediateDirectories:true)
        try! image.representation(using:.png,properties:[:])!.write(to:url.appendingPathComponent(name+".png"))
    }
    static func configure(_ value:AWCValue) {
        let spec=value["spec"]
        state.dark=value["theme"].string=="dark";state.group = .init(values:spec["group"].object);state.localGroup = .init();state.item = .init(values:spec["item"].object);state.local = .init()
        let children=["first","second"].map { id in
            AWCNode(id:id,tag:"md-accordion-item",properties:["headline":.string(id=="first" ? "Account settings":"Secondary details"),"supportingText":"Supporting caption","expanded":value["expanded"]].merging(spec["props"].object){_,b in b},children:[.text("Expanded content with useful details.")])
        }
        state.node = .init(id:"accordion",tag:"md-accordion",properties:["transition":"none"].merging(spec["parent"].object){_,b in b},children:children)
        state.reduced=false
        state.epoch+=1;pump()
    }
    static func liveOverrides(_ oracle: AWCValue) {
        configure(oracle["cases"].array.first { $0["id"].string == "light-filled-e0-false" }!)
        let first = header()
        let second = all(host).compactMap { $0 as? AWCNativeButtonFocusView }.first { $0.accessibilityIdentifier() == "second.header" }!
        state.group = .init(gap: 11)
        state.localGroup = .init(gap: 23)
        state.item = .init(headerColor: "#335577", headerMinHeight: 96)
        state.local = .init(headerColor: "#884422", headerMinHeight: 112)
        pump()
        check(header() === first, "live appearance editing retains the native header")
        near(rect(first).height, 112, "targeted item height overrides the inherited height")
        near(rect(second).height, 96, "targeted item appearance does not leak to siblings")
        near(rect(second).minY-rect(first).maxY, 23, "targeted group gap overrides inherited gap")
        let image = bitmap(), pixels = bytes(image)
        check(hits(image,pixels,rect(first),hex("#884422"))>100,"targeted item color paints the selected item")
        check(hits(image,pixels,rect(second),hex("#335577"))>100,"sibling uses inherited item color")
        state.controller.toggle(); pump()
        check(state.controller.isExpanded, "controller still activates after live style edits")
        state.local = .init(); state.localGroup = .init(); pump()
        check(header() === first && state.controller.isExpanded, "clearing overrides retains native identity and expanded state")
        near(rect(first).height,96,"clearing local item height restores inherited height")
        near(rect(root()).height,96*2+60+11,"clearing local gap restores inherited gap without collapsing the item")
        state.controller.toggle(); pump()
        state.node.properties["transition"] = "expressive"
        state.reduced = false
        state.item = .init(headerMinHeight:96,expandDuration:1000,collapseDuration:800)
        pump()
        let closed = rect(root()).height
        state.controller.toggle(); pump(0.4)
        let opening = rect(root()).height
        check(opening > closed+1 && opening < closed+59.5,"custom 1000ms expansion is still rendering at 400ms")
        pump(0.75); near(rect(root()).height,closed+60,"custom expansion reaches the source endpoint")
        state.controller.toggle(); pump(0.35)
        let closing = rect(root()).height
        check(closing > closed+0.5 && closing < closed+59,"custom 800ms collapse remains in progress at 350ms")
        pump(0.6); near(rect(root()).height,closed,"custom collapse reaches the source endpoint")
        state.item = .init(headerMinHeight:96,expandDuration:0,collapseDuration:0); pump()
        state.controller.toggle(); pump(0.04); near(rect(root()).height,closed+60,"zero duration opens immediately")
        state.controller.toggle(); pump(0.04); near(rect(root()).height,closed,"zero duration closes immediately")
        state.item = .init(headerMinHeight:96,expandDuration:2000,collapseDuration:2000)
        state.reduced = true; pump()
        state.controller.toggle(); pump(0.04); near(rect(root()).height,closed+60,"reduced motion bypasses an authored long duration")
    }
    static func shadowInterpolation() {
        let url=URL(fileURLWithPath:#filePath).deletingLastPathComponent().appendingPathComponent("Fixtures/accordion-web-shadow-motion.json")
        let oracle=try! JSONDecoder().decode(AWCValue.self,from:Data(contentsOf:url))
        for value in oracle["cases"].array {
            let from=AWCBoxShadow.source(value["from"].string)!,to=AWCBoxShadow.source(value["to"].string)!
            let expected=AWCBoxShadow.source(value["resolved"].string)!
            let actual=AWCNativeBoxShadow(corners:.points(12),layers:from,toLayers:to,fraction:value["fraction"].number!).paint
            let id="shadow \(value["from"].string) → \(value["to"].string) at \(value["fraction"].number!)"
            check(actual.count==expected.count,id+" layer count")
            for (rendered,source) in zip(actual,expected) {
                let a=rendered.0
                check(abs(a.x-source.x)<0.001 && abs(a.y-source.y)<0.001 && abs(a.blur-source.blur)<0.001 && abs(a.spread-source.spread)<0.001,id+" physical geometry")
                check(a.inset==source.inset,id+" inset selection")
                let color=rendered.1.resolve(in:EnvironmentValues()),rgba=hex(source.color)
                // Fully transparent CSS colors carry no visible RGB contribution.
                check(abs(Double(color.opacity)-rgba[3])<0.005 && (rgba[3]==0 || zip([color.red,color.green,color.blue],rgba.prefix(3)).allSatisfy{abs(Double($0)*255-$1)<1.5}),id+" premultiplied source color")
            }
        }
        for invalid in ["0 1px nope #112233","0 1px inset inset #112233","0 1px -2px #112233","0 1px #112233 extra","0 1px rgba(1,2,3))"] {
            check(AWCBoxShadow.source(invalid)==nil,"invalid source shadow is rejected: "+invalid)
        }
    }
    static func sourceCases(_ oracle:AWCValue) {
        for value in oracle["cases"].array {
            configure(value)
            let id=value["id"].string,origin=rect(root()).origin,rootRect=rect(root()),headerRect=rect(header())
            near(rootRect.height,value["root"]["rect"]["height"].number!,id+" root height")
            near(headerRect.height,value["parts"]["header"]["rect"]["height"].number!,id+" header height")
            near(headerRect.minX-origin.x,value["parts"]["header"]["rect"]["x"].number!,id+" header x")
            let item=state.measurements.first{$0.id=="component"}
            near(Double(item?.bounds.height ?? -1),value["item"]["rect"]["height"].number!,id+" actual item bounds")
            near(item?.metrics["radius"]?.number ?? -1,number(value["item"]["style"]["borderTopLeftRadius"]),id+" resolved radius")
            for part in ["headline","supporting-text"] {
                guard let measured=state.measurements.first(where:{$0.id=="component."+part}) else {check(false,id+" measured "+part);continue}
                let expected=value["parts"][part]["rect"]
                near(measured.bounds.minX-origin.x,expected["x"].number!,id+" "+part+" x")
                near(measured.bounds.minY-origin.y,expected["y"].number!,id+" "+part+" y")
                near(measured.bounds.height,expected["height"].number!,id+" "+part+" height")
            }
            let image=bitmap(),pixels=bytes(image),base=hex(value["background"].string)
            let container=composite(rgba(value["item"]["style"]["backgroundColor"].string),base)
            let headerPaint=composite(rgba(value["parts"]["header"]["style"]["backgroundColor"].string),container)
            check(hits(image,pixels,headerRect,headerPaint)>100,id+" header background pixels")
            check(hits(image,pixels,headerRect,composite(rgba(value["parts"]["headline"]["style"]["color"].string),headerPaint))>2,id+" headline color pixels")
            check(hits(image,pixels,headerRect,composite(rgba(value["parts"]["supporting-text"]["style"]["color"].string),headerPaint))>2,id+" supporting color pixels")
            if value["expanded"].bool == true {
                let contentRect=CGRect(x:headerRect.minX,y:headerRect.maxY,width:headerRect.width,height:Double(item?.bounds.height ?? 0)-headerRect.height)
                check(hits(image,pixels,contentRect,container)>100,id+" content background stays free of its outer shadow")
                check(hits(image,pixels,contentRect,composite(rgba(value["parts"]["content-inner"]["style"]["color"].string),container))>2,id+" content color pixels")
            }
            if id.contains("filled-custom") {
                let open=value["expanded"].bool == true,area=CGRect(x:open ? headerRect.minX-4:headerRect.maxX+1,y:headerRect.midY,width:1,height:3)
                let ink=hex(open ? "#11664488":"#CC224488")
                check(hits(image,pixels,area,composite(ink,base))>1,id+" actual colored shadow outside the tile")
            }
            if id.contains("inset-shadow") || id.contains("mixed-shadow") {
                if value["expanded"].bool == true {
                    let sample=CGRect(x:headerRect.minX+2,y:headerRect.maxY+8,width:1,height:3)
                    check(hits(image,pixels,sample,composite(hex("#11AA6688"),container))>1,id+" inset shadow paints over the container below its children")
                }
                if id.contains("mixed-shadow") {
                    let sample=CGRect(x:headerRect.maxX+2,y:headerRect.midY,width:1,height:3)
                    let stack=composite(hex("#CC224488"),composite(hex("#2244CC88"),base))
                    check(hits(image,pixels,sample,stack)>1,id+" first outer shadow paints above subsequent layers")
                }
                snapshot(image,id)
            }
            if id.contains("icon-default") {
                let open=value["expanded"].bool==true
                let typeface=AWCNativeFonts.accordionSymbol(size:24,fill:open ? 1:0)
                let variations=CTFontCopyVariation(typeface) as? [NSNumber:NSNumber] ?? [:]
                let axes=CTFontCopyVariationAxes(typeface) as? [[String:Any]] ?? []
                func axis(_ id:UInt32)->Double? {
                    variations[NSNumber(value:id)]?.doubleValue ?? axes.first { ($0[kCTFontVariationAxisIdentifierKey as String] as? NSNumber)?.uint32Value==id }.flatMap { ($0[kCTFontVariationAxisDefaultValueKey as String] as? NSNumber)?.doubleValue }
                }
                check(CTFontCopyFamilyName(typeface) as String == "Material Symbols Outlined",id+" uses the actual bundled symbol font")
                check(axis(0x46494C4C) == (open ? 1:0),id+" actual font FILL axis")
                check(axis(0x77676874) == (open ? 500:400),id+" actual font weight axis")
                check(value["glyph"]["style"]["fontVariationSettings"].string.contains(open ? "\"FILL\" 1":"\"FILL\" 0"),id+" source glyph uses the same fill endpoint")
                if let leading=state.measurements.first(where:{$0.id=="component.leading-icon"}) {
                    let expected=value["parts"]["leading-icon"]["rect"]
                    near(leading.bounds.width,expected["width"].number!,id+" leading icon visual width")
                    near(leading.bounds.minX-origin.x,expected["x"].number!,id+" leading icon visual x")
                    let middle=CGRect(x:leading.bounds.midX-1,y:leading.bounds.midY-1,width:2,height:2)
                    let ink=composite(rgba(value["parts"]["leading-icon"]["style"]["color"].string),headerPaint)
                    check(hits(image,pixels,middle,open ? ink:headerPaint)>1,id+" favorite glyph center changes from outline to filled")
                } else {check(false,id+" leading icon is measurable")}
                snapshot(image,id)
                if open {
                    state.reduced=true; pump()
                    near(Double(state.measurements.first(where:{$0.id=="component.leading-icon"})?.bounds.width ?? -1),24,id+" reduced motion removes leading icon scaling")
                    state.reduced=false; pump()
                }
            }
            if id.contains("custom") && !id.contains("disabled") {snapshot(image,id)}
            if value["spec"]["props"]["disabled"].bool != true {
                check(window.makeFirstResponder(header()),id+" native keyboard focus")
                pump()
                var layer=rgba(value["parts"]["state-layer"]["style"]["backgroundColor"].string);layer[3]*=0.12
                let focused=bitmap(),sample=CGRect(x:headerRect.maxX-70,y:headerRect.midY-2,width:8,height:4)
                check(hits(focused,bytes(focused),sample,composite(layer,headerPaint))>2,id+" focused state-layer custom color pixels")
                _ = window.makeFirstResponder(nil)
            }
        }
    }
    static func main() {
        _ = NSApplication.shared;NSApp.setActivationPolicy(.accessory)
        host=NSHostingView(rootView:AccordionAppearanceFixture(state:state))
        window=NSWindow(contentRect:.init(x:-20000,y:-20000,width:600,height:700),styleMask:[.borderless],backing:.buffered,defer:false)
        window.isReleasedWhenClosed=false;window.colorSpace = .sRGB;window.contentView=host;window.orderFrontRegardless();pump(0.2)
        let url=URL(fileURLWithPath:#filePath).deletingLastPathComponent().appendingPathComponent("Fixtures/accordion-web-appearance.json")
        let oracle=try! JSONDecoder().decode(AWCValue.self,from:Data(contentsOf:url));sourceCases(oracle);liveOverrides(oracle);shadowInterpolation()
        if let path=ProcessInfo.processInfo.environment["AWC_ACCORDION_APPEARANCE_OUTPUT"] {
            try! JSONSerialization.data(withJSONObject:["checks":checks,"failures":failures,"sourceCases":oracle["cases"].array.count],options:[.prettyPrinted,.sortedKeys]).write(to:URL(fileURLWithPath:path))
        }
        print("Accordion native appearance: \(checks-failures.count)/\(checks) checks passed")
        window.close();if !failures.isEmpty {exit(1)}
    }
}
