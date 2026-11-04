import AppKit
import SwiftUI
import Observation
@testable import AWCUI

@Observable final class TooltipFixtureState{
    var properties:[String:AWCValue]=[:]
    var nodes:[AWCNativeInspectionNode]=[]
    var events:[AWCEvent]=[]
    var appearance=AWCTooltipAppearance()
    var controller=AWCTooltipController()
    var width=600.0
    var height=400.0
    var x=260.0
    var y=180.0
    var density=0.0
    var epoch=0
    var dark=false
    var rtl=false
    var actions=false
    var slots=false
    var parts=false
    var partOverrides:[AWCTooltipPart:AWCTooltipPartAppearance]=[:]
    var rawActions=false
    var nativeControls=false
    var mounted=true
    var authoredActivations=0
    var eventDispatcher:AWCEventDispatcher?
    var eventContracts:[[Bool]]=[]
    var eventPreventions:[Bool]=[]
    var eventScopes:[String]=[]
    var reduced=true
}
struct TooltipFixture:View{
    let state:TooltipFixtureState
    var body:some View{
        let epoch=state.epoch
        AWCTooltipScope{
            ZStack(alignment:.topLeading){
                Color.clear
                if state.mounted{AWCNativeView(node:.init(id:"tooltip",tag:"md-tooltip",properties:state.properties,children:state.rawActions ? [.init(tag:"#slot-text",properties:["text":"Details"],slot:"actions"),.init(tag:"#slot-text",properties:["text":"Dismiss"],slot:"actions")]:[])){state.events.append($0)}
                    .awcTooltipController(state.controller).awcTooltipAppearance(state.appearance)
                    .awcTooltipSlot(.anchor){if state.nativeControls{AWCNativeView(node:.init(id:"tooltip-anchor",tag:"md-button",children:[.text("Anchor")]))}else{TooltipAuthoredButton(text:"Anchor",width:80,height:32)}}
                    .modifier(TooltipSlotFixture(state:state))
                    .awcTooltipPartAppearance(state.parts ? .init(borderColor:"#FFAA33",borderWidth:2,cornerShape:.points(12)):.init(),part:.popup)
                    .awcTooltipPartAppearance(state.parts ? .init(fontWeight:700):.init(),part:.subhead)
                    .awcTooltipPartAppearance(state.parts ? .init(letterSpacing:0.75):.init(),part:.supportingText)
                    .awcTooltipPartAppearance(state.parts ? .init(paddingInlineStart:13):.init(),part:.actions)
                    .environment(\.awcTooltipParts,state.partOverrides)
                    .environment(\.layoutDirection,state.rtl ? .rightToLeft:.leftToRight)
                    .offset(x:state.x,y:state.y)}
                if state.nativeControls{AWCNativeView(node:.init(id:"unrelated",tag:"md-button",children:[.text("Elsewhere")])).offset(x:420,y:340)}
            }.frame(width:state.width,height:state.height)
        }.frame(width:state.width,height:state.height)
            .environment(\.awcEventDispatcher,state.eventDispatcher)
            .environment(\.awcEventTargetListeners,[.init(handler:{event in if event.event.tag=="md-tooltip"{state.eventContracts.append([event.bubbles,event.crossesBoundaries,event.cancelable]);event.preventDefault();state.eventPreventions.append(event.defaultPrevented)}})])
            .awcNativeInspection(rootID:"tooltip",coordinateSpace:"tooltip-fixture"){if state.epoch==epoch{state.nodes=$0}}.id(epoch)
            .awcTheme(.generated(dark:state.dark)).environment(\.awcNativeDensity,state.density).environment(\.awcTooltipReducedMotion,state.reduced)
            .frame(width:800,height:600,alignment:.topLeading).background(AWCTheme.generated(dark:state.dark).background).coordinateSpace(name:"tooltip-fixture")
    }
}
struct TooltipSlotFixture:ViewModifier{
    let state:TooltipFixtureState
    @ViewBuilder func body(content:Content)->some View{
        if state.slots{
            content.awcTooltipSlot(.subhead,text:"Authored heading")
                .awcTooltipSlot(.content,text:"Authored supporting text")
                .awcTooltipSlot(.actions){if state.nativeControls{AWCNativeView(node:.init(id:"tooltip-action",tag:"md-button",properties:["variant":"text"],children:[.text("Details")])){if $0.name=="mdClick"{state.authoredActivations += 1}}}else{TooltipAuthoredButton(text:"Details");TooltipAuthoredButton(text:"Dismiss")}}
        }else if state.actions{
            content.awcTooltipSlot(.actions){if state.nativeControls{AWCNativeView(node:.init(id:"tooltip-action",tag:"md-button",properties:["variant":"text"],children:[.text("Details")])){if $0.name=="mdClick"{state.authoredActivations += 1}}}else{TooltipAuthoredButton(text:"Details");TooltipAuthoredButton(text:"Dismiss")}}
        }else{content}
    }
}
struct TooltipAuthoredButton:View{
    let text:String
    @Environment(\.awcTheme) private var theme
    @Environment(\.awcTooltipAppearance) private var appearance
    var width:CGFloat?=nil
    var height:CGFloat?=nil
    var body:some View{
        Button(action:{}){AWCNativeMeterTextView(model:.init(text:text,size:12,lineHeight:16,weight:500,spacing:0,tabular:false,usesDefaultKerning:true),color:Color(awcHex:width != nil ? "#000000":appearance.richActionColor ?? theme?.tokens["--md-sys-color-primary"] ?? "#6750A4"),wrap:false,center:true)
            .padding(.horizontal,8).padding(.vertical,4).padding(1).frame(width:width,height:height)
            .overlay{RoundedRectangle(cornerRadius:4).strokeBorder(Color.gray,lineWidth:1)}}.buttonStyle(.plain)
    }
}
@main @MainActor enum NativeTooltipViewIntegration{
    static let state=TooltipFixtureState()
    static var host:NSHostingView<TooltipFixture>!,window:NSWindow!,checks=0,failures:[String]=[]
    static func check(_ value:Bool,_ label:String){checks += 1;if !value{failures.append(label);print("FAIL: "+label);fflush(stdout)}}
    static func pump(_ seconds:Double=0.09){let end=Date().addingTimeInterval(seconds);while Date()<end{while let e=NSApp.nextEvent(matching:.any,until:Date(),inMode:.default,dequeue:true){NSApp.sendEvent(e)};host.layoutSubtreeIfNeeded();host.displayIfNeeded();_ = RunLoop.current.run(mode:.default,before:Date().addingTimeInterval(0.001))}}
    static func node(_ part:String)->AWCNativeInspectionNode?{state.nodes.first{$0.id=="component."+part}}
    static func bitmap()->NSBitmapImageRep{let value=host.bitmapImageRepForCachingDisplay(in:host.bounds)!;host.cacheDisplay(in:host.bounds,to:value);return value}
    static func bytes()->(Int,Int,[UInt8]){
        let image=bitmap().cgImage!;var pixels=[UInt8](repeating:0,count:image.width*image.height*4)
        pixels.withUnsafeMutableBytes{buffer in let cg=CGContext(data:buffer.baseAddress,width:image.width,height:image.height,bitsPerComponent:8,bytesPerRow:image.width*4,space:CGColorSpace(name:CGColorSpace.sRGB)!,bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue)!;cg.draw(image,in:.init(x:0,y:0,width:image.width,height:image.height))}
        return(image.width,image.height,pixels)
    }
    static func rgb(_ css:String)->[Double]{
        let regex=try! NSRegularExpression(pattern:"[0-9]+(?:\\.[0-9]+)?")
        let n=regex.matches(in:css,range:NSRange(css.startIndex...,in:css)).compactMap{Range($0.range,in:css).flatMap{Double(css[$0])}}
        return n.count==3 ? n+[1]:n
    }
    static func composite(_ color:[Double],over:[Double])->[Double]{(0..<3).map{color[$0]*color[3]+over[$0]*(1-color[3])}}
    static func hits(_ image:(Int,Int,[UInt8]),rect:CGRect,color:[Double],tolerance:Double=4)->Int{
        let scale=Double(image.0)/800,x0=max(0,Int(rect.minX*scale)),x1=min(image.0,Int(rect.maxX*scale)),y0=max(0,Int(rect.minY*scale)),y1=min(image.1,Int(rect.maxY*scale))
        guard x1>x0,y1>y0 else{return 0};var count=0
        for y in y0..<y1{for x in x0..<x1{let i=(y*image.0+x)*4;if (0..<3).allSatisfy({abs(Double(image.2[i+$0])-color[$0])<=tolerance}){count += 1}}};return count
    }
    static func paint(_ entry:AWCValue,_ mode:String){
        let id=entry["fixture"]["id"].string
        guard ["plain-top-ltr","rich-top-ltr","plain-all-styles","rich-all-styles","rich-part-styles","rich-slot-only"].contains(id) || !entry["fixture"]["partStyles"].object.isEmpty,let popup=node("popup"),let source=entry["parts"].array.first(where:{$0["part"].string=="popup"}) else{return}
        let base=AWCTheme.generated(dark:mode=="dark").tokens["--md-sys-color-surface"]!,hex=String(base.dropFirst()),backdrop=stride(from:0,to:6,by:2).map{Double(Int(hex.dropFirst($0).prefix(2),radix:16)!)}
        let image=bytes(),background=composite(rgb(source["style"]["backgroundColor"].string),over:backdrop)
        check(hits(image,rect:popup.bounds,color:background)>100,"\(mode)/\(id) actual container RGB/alpha without inner shadow tint")
        for part in entry["parts"].array where ["text","subhead","supporting-text"].contains(part["part"].string){
            let name=part["part"].string
            let partBackground=composite(rgb(part["style"]["backgroundColor"].string),over:background)
            if let box=node(name)?.bounds,box.width>0,box.height>0{check(hits(image,rect:box,color:composite(rgb(part["style"]["color"].string),over:partBackground))>2,"\(mode)/\(id) actual \(name) foreground RGB/alpha")}
        }
        if entry["fixture"]["rawActions"].bool==true,let box=node("actions")?.bounds,let sourceActions=entry["parts"].array.first(where:{$0["part"].string=="actions"}),let child=entry["slots"].array.first(where:{$0["slot"].string=="actions"}) {
            let actionBackground=composite(rgb(sourceActions["style"]["backgroundColor"].string),over:background)
            check(hits(image,rect:box,color:composite(rgb(child["style"]["color"].string),over:actionBackground))>2,"\(mode)/\(id) authored actions retain their explicit source color under inherited part styling")
        }
        for (name,style) in entry["fixture"]["partStyles"].object where style.object["border"] != nil {
            if let box=node(name)?.bounds{check(hits(image,rect:box,color:[255,170,51])>5,"\(mode)/\(id) actual \(name) public border pixels")}
        }
        if id=="rich-part-styles"{check(hits(image,rect:popup.bounds,color:[255,170,51])>100,"\(mode) authored popup border paint")}
        if let directory=ProcessInfo.processInfo.environment["AWC_TOOLTIP_CAPTURE_DIRECTORY"]{let url=URL(fileURLWithPath:directory);try! FileManager.default.createDirectory(at:url,withIntermediateDirectories:true);try! bitmap().representation(using:.png,properties:[:])!.write(to:url.appendingPathComponent("swift-\(mode)-\(id).png"))}
    }
    static func curve(_ x:Double,_ control:[Double])->Double{
        let x=min(1,max(0,x));var low=0.0,high=1.0
        func at(_ t:Double,_ a:Double,_ b:Double)->Double{3*(1-t)*(1-t)*t*a+3*(1-t)*t*t*b+t*t*t}
        for _ in 0..<40{let t=(low+high)/2;if at(t,control[0],control[2])<x{low=t}else{high=t}}
        return at((low+high)/2,control[1],control[3])
    }
    static func motion(){
        let url=URL(fileURLWithPath:#filePath).deletingLastPathComponent().appendingPathComponent("Fixtures/tooltip-web-motion.json"),doc=try! JSONDecoder().decode(AWCValue.self,from:Data(contentsOf:url))
        for fixture in doc["results"].array{for phase in fixture["phases"].array{for sample in phase["samples"].array{
            let open=phase["phase"].string=="open",t=sample["time"].number ?? 0,alpha=open ? curve(t/100,[0.2,0,0,1]):1-curve(t/100,[0.2,0,0,1])
            check(abs(Double(sample["style"]["opacity"].string)!-alpha)<0.00001,"Actual Web transition uses native standard100ms curve")
            let scale=Double(sample["style"]["transform"].string.components(separatedBy:"(").last!.components(separatedBy:",").first!)!
            check(abs(scale-(0.9+alpha*0.1))<0.00001,"Actual Web scale follows opacity with .9 to1 range")
        }}}
        for position in ["top","bottom","left","right"]{
            state.epoch += 1;state.controller=AWCTooltipController();state.properties=["open":false,"variant":"plain","text":"Width reference","position":.string(position)];state.width=600;state.height=400;state.x=260;state.y=180;state.density=0;state.rtl=false;state.slots=false;state.parts=false;state.actions=false;state.dark=false;state.reduced=false
            state.appearance = .init(plainContainerColor:"#000000",plainTextColor:"#000000",plainShape:.points(0));pump(0.12)
            state.controller.authoredOpen(true);pump(0.15)
            let rect=node("popup")!.bounds,anchorRect=CGRect(x:state.x,y:state.y,width:80,height:32),placement=AWCNativeTooltipPosition.resolve(anchor:anchorRect,popup:rect.size,viewport:.init(width:600,height:400),properties:state.properties,rtl:false)
            state.controller.authoredOpen(false);pump(0.15)
            for open in [true,false]{
                state.controller.authoredOpen(open);pump(0.05)
                let before=Date().timeIntervalSince(state.controller.transitionDate),image=bytes(),after=Date().timeIntervalSince(state.controller.transitionDate),pixelScale=Double(image.0)/800
                var red=255,x0=image.0,x1=0,y0=image.1,y1=0,histogram=[Int:Int]()
                for y in max(0,Int(rect.minY*pixelScale))..<min(image.1,Int(ceil(rect.maxY*pixelScale))){for x in max(0,Int(rect.minX*pixelScale))..<min(image.0,Int(ceil(rect.maxX*pixelScale))){let r=Int(image.2[(y*image.0+x)*4]);if r<250{histogram[r,default:0] += 1;x0=min(x0,x);x1=max(x1,x);y0=min(y0,y);y1=max(y1,y)}}}
                // The modal background intensity measures opacity without
                // counting overlapping text/background pixels twice.
                red=histogram.max(by:{$0.value<$1.value})?.key ?? 255
                let alpha=Double(255-red)/255,early=open ? curve(max(0,before-0.035)/0.1,[0.2,0,0,1]):1-curve(max(0,before-0.035)/0.1,[0.2,0,0,1]),late=open ? curve((after+0.005)/0.1,[0.2,0,0,1]):1-curve((after+0.005)/0.1,[0.2,0,0,1])
                check(alpha>=min(early,late)-0.025 && alpha<=max(early,late)+0.025,"Actual \(position)/\(open ? "open":"close") opacity follows source timing")
                let scale=0.9+alpha*0.1
                check(x1>x0 && abs(Double(x1-x0+1)/pixelScale-rect.width*scale)<1.6,"Actual \(position) popup width follows source scale: pixels=\(Double(x1-x0+1)/pixelScale), expected=\(rect.width*scale), alpha=\(alpha), rect=\(rect)")
                check(abs(Double(y1-y0+1)/pixelScale-rect.height*scale)<1.6,"Actual \(position) popup height follows source scale")
                let expectedY=rect.minY+(1-scale)*rect.height*placement.animationAnchor.y
                check(abs(Double(y0)/pixelScale-expectedY)<1.6,"Actual \(position) transform pivots toward the source anchor")
                pump(0.16)
            }
        }
        state.reduced=true;state.controller.authoredOpen(true);pump(0.02)
        check(hits(bytes(),rect:node("popup")!.bounds,color:[0,0,0])>100,"Reduced motion reaches visible endpoint without scale or opacity animation")
    }
    static func views(_ view:NSView)->[NSView]{[view]+view.subviews.flatMap(views)}
    static func focusView(_ id:String)->AWCNativeButtonFocusView?{views(host).compactMap{$0 as? AWCNativeButtonFocusView}.first{$0.accessibilityIdentifier()==id}}
    static func escape(){let e=NSEvent.keyEvent(with:.keyDown,location:.zero,modifierFlags:[],timestamp:ProcessInfo.processInfo.systemUptime,windowNumber:window.windowNumber,context:nil,characters:"\u{1b}",charactersIgnoringModifiers:"\u{1b}",isARepeat:false,keyCode:53)!;NSApp.sendEvent(e);pump()}
    static func semantics(){
        let outer=AWCEventDispatcher(id:"outer",onCapture:{event in if event.event.tag=="md-tooltip"{state.eventScopes.append("outer-capture")}},handler:{event in if event.event.tag=="md-tooltip"{state.eventScopes.append("outer-bubble")}})
        state.eventDispatcher=AWCEventDispatcher(id:"boundary",parent:outer,isBoundary:true,onCapture:{event in if event.event.tag=="md-tooltip"{state.eventScopes.append("boundary-capture")}},handler:{event in if event.event.tag=="md-tooltip"{state.eventScopes.append("boundary-bubble")}});state.eventContracts=[];state.eventScopes=[]
        state.epoch += 1;state.nativeControls=true;state.mounted=true;state.controller=AWCTooltipController();state.properties=["open":false,"variant":"rich","subhead":"Fallback heading","text":"Fallback body","showDelay":0,"hideDelay":80];state.width=600;state.height=400;state.x=220;state.y=180;state.density=0;state.rtl=false;state.slots=true;state.parts=false;state.actions=false;state.dark=false;state.reduced=true;state.appearance = .init();state.events=[];pump()
        guard let anchor=focusView("tooltip-anchor"),let unrelated=focusView("unrelated") else{check(false,"Real Tooltip anchor and unrelated native responders exist");return}
        for density in [0.0,-1,-2,-3,-4] {
            state.properties["density"] = .number(density);pump()
            check(abs(anchor.bounds.height-(40+4*density))<0.1,"Authored Button anchor inherits Tooltip density \(density)")
            check(abs(unrelated.bounds.height-40)<0.1,"Tooltip density does not escape into unrelated controls")
        }
        state.properties["density"] = .number(0);pump()
        check(anchor.accessibilityRole() == .button && anchor.accessibilityLabel()=="Anchor","Authored anchor retains native button role and label")
        check(anchor.accessibilityHelp()=="Authored heading. Authored supporting text","Actual anchor AXHelp describes authored rich content, excluding fallback and actions")
        _ = anchor.requestNativeFocus();pump(0.12)
        check(state.controller.isVisible,"Real native anchor focus opens Tooltip")
        let region=views(host).compactMap{$0 as? AWCTooltipRegionView}.first{!$0.isAnchor}
        check(region?.isAccessibilityElement()==true && region?.accessibilityRole()?.rawValue=="AXHelpTag" && region?.accessibilityLabel()=="Authored heading. Authored supporting text","Popup exposes a real visible native help-tag role and authored description")
        guard let action=focusView("tooltip-action") else{check(false,"Real authored rich action responder exists");return}
        _ = action.requestNativeFocus();pump(0.15)
        check(state.controller.isVisible,"Focus moving into authored popup action retains visibility")
        action.configuration?.performActivation(.accessibility);pump()
        check(state.authoredActivations==1 && state.controller.isVisible,"Authored action retains its callback without automatic Tooltip dismissal")
        escape();check(!state.controller.isVisible && window.firstResponder===anchor,"Escape restores owned popup focus to the original anchor")
        _ = unrelated.requestNativeFocus();pump();state.controller.authoredOpen(true);pump();escape()
        check(window.firstResponder===unrelated && !state.controller.isVisible,"Escape preserves unrelated native focus")
        state.properties["disabled"]=true;pump()
        check(anchor.accessibilityHelp()==nil && anchor.isAccessibilityEnabled(),"Disabled Tooltip removes description without disabling its authored anchor")
        state.properties["disabled"]=false;pump()
        check(anchor.accessibilityHelp()=="Authored heading. Authored supporting text" && !state.controller.isVisible,"Re-enable restores description without implicitly opening")
        state.controller.authoredOpen(true);pump();let opened=state.events.filter{$0.name=="mdOpen"}.count
        state.mounted=false;pump(0.15);state.mounted=true;pump(0.15)
        check(state.controller.isVisible && state.events.filter{$0.name=="mdOpen"}.count==opened,"Actual view detach/reattach retains visible state without duplicate mdOpen")
        escape();check(!state.controller.isVisible,"Reattached view restores real window-level Escape binding")
        check(state.eventContracts.count>=2 && state.eventContracts.allSatisfy{$0==[false,false,true]},"Actual Tooltip lifecycle events retain non-bubbling, non-composed and cancelable source semantics")
        check(!state.eventPreventions.isEmpty && state.eventPreventions.allSatisfy{$0},"Source lifecycle events accept preventDefault without reverting their committed open state")
        check(!state.eventScopes.isEmpty && state.eventScopes.allSatisfy{$0=="boundary-capture"},"Actual Tooltip events reach local capture/target listeners without bubbling or crossing component boundaries")
        state.nativeControls=false;state.eventDispatcher=nil
    }
    static func directionalPaint(){
        for slots in [false,true]{for rtl in [false,true]{
            state.epoch += 1;state.controller=AWCTooltipController();state.properties=["open":true,"variant":"rich","subhead":"Aligned heading","text":"Aligned body"];state.width=600;state.height=400;state.x=260;state.y=180;state.density=0;state.rtl=rtl;state.slots=slots;state.parts=false;state.actions=false;state.dark=false
            state.appearance = .init(richContainerColor:"#FFFFFF",richSubheadColor:"#FF0000",richTextColor:"#FF0000",richMinWidth:.points(500),richMaxWidth:.points(500));pump()
            let image=bytes()
            for name in ["subhead","supporting-text"]{guard let box=node(name)?.bounds else{check(false,"Directional Tooltip needs actual text bounds");continue}
                let left=CGRect(x:box.minX,y:box.minY,width:box.width/2,height:box.height),right=CGRect(x:box.midX,y:box.minY,width:box.width/2,height:box.height)
                check(hits(image,rect:rtl ? right:left,color:[255,0,0])>10 && hits(image,rect:rtl ? left:right,color:[255,0,0])==0,"Actual \(slots ? "authored":"fallback") \(name) glyphs use logical start in \(rtl ? "RTL":"LTR")")
            }
        }}
    }
    static func oracle(supplement:Bool=false){
        let filter=ProcessInfo.processInfo.environment["AWC_TOOLTIP_CASES"].map{Set($0.split(separator:",").map(String.init))}
        for mode in ["light","dark"]{
            let url=URL(fileURLWithPath:#filePath).deletingLastPathComponent().appendingPathComponent("Fixtures/tooltip-\(supplement ? "supplemental":"web")-\(mode).json"),doc=try! JSONDecoder().decode(AWCValue.self,from:Data(contentsOf:url))
            for entry in doc["results"].array{
                let f=entry["fixture"],id=f["id"].string;guard filter==nil || filter!.contains(id) else{continue}
                state.epoch += 1;state.properties=f.object;state.properties["open"]=f.object["open"] ?? true;state.controller=AWCTooltipController();state.nodes=[];state.events=[]
                state.width=entry["viewport"]["width"].number ?? 600;state.height=entry["viewport"]["height"].number ?? 400
                state.x=entry["trigger"]["rect"]["x"].number ?? 260;state.y=entry["trigger"]["rect"]["y"].number ?? 180
                state.dark=mode=="dark";state.rtl=(f.object["localDir"] ?? f["dir"]).string=="rtl";state.density=f["inheritedDensity"].number ?? 0;state.actions=f["actions"].bool ?? false;state.slots=f["slots"].bool ?? false;state.parts=f["parts"].bool ?? false
                state.rawActions=f["rawActions"].bool ?? false
                state.partOverrides=Dictionary(uniqueKeysWithValues:f["partStyles"].object.compactMap { name,value in
                    let part:[String:AWCTooltipPart] = ["popup":.popup,"text":.text,"subhead":.subhead,"supporting-text":.supportingText,"actions":.actions]
                    guard let p=part[name] else{return nil}
                    func length(_ key:String)->Double? {value.object[key].flatMap{Double($0.string.replacingOccurrences(of:"px",with:""))}}
                    return (p,AWCTooltipPartAppearance(color:value.object["color"]?.string,backgroundColor:value.object["background-color"]?.string,borderColor:value.object["border"]==nil ? nil:"#FFAA33",borderWidth:value.object["border"]==nil ? nil:2,cornerShape:length("border-radius").map{.points($0)},fontWeight:length("font-weight"),paddingInlineStart:length("padding-inline-start"),marginInlineStart:length("margin-inline-start"),letterSpacing:length("letter-spacing"),fontSize:length("font-size"),lineHeight:length("line-height")))
                })
                let styles=f["style"].object
                func color(_ key:String)->String?{styles[key]?.string}
                func length(_ key:String)->AWCTooltipLength?{styles[key].flatMap{.init(css:$0.string)}}
                func shape(_ key:String)->AWCCornerShape?{styles[key]==nil ? nil:.init(topLeft:.init(x:.points(20),y:.points(8)),topRight:.init(x:.points(4),y:.points(12)),bottomRight:.init(x:.points(20),y:.points(8)),bottomLeft:.init(x:.points(4),y:.points(12)))}
                state.appearance = .init(plainContainerColor:color("plain-container-color"),plainTextColor:color("plain-text-color"),richContainerColor:color("rich-container-color"),richSubheadColor:color("rich-subhead-color"),richTextColor:color("rich-text-color"),richActionColor:color("rich-action-color"),plainShape:shape("container-shape"),plainMaxWidth:length("plain-max-inline-size"),richShape:shape("rich-container-shape"),richMinWidth:length("rich-min-inline-size"),richMaxWidth:length("rich-max-inline-size"))
                pump()
                if f["hidden"].bool==true{check(state.nodes.isEmpty,"\(mode) hidden has no native geometry");continue}
                if f["open"].bool==false || f["disabled"].bool==true{check(!state.controller.isVisible,"\(mode)/\(id) is actually hidden");continue}
                for part in entry["parts"].array where part["style"]["display"].string != "none"{
                    let name=part["part"].string,expected=part["rect"]
                    guard let actual=node(name) else{check(false,"\(mode)/\(id) missing \(name)");continue}
                    for (key,value) in [("x",actual.bounds.minX),("y",actual.bounds.minY),("width",actual.bounds.width),("height",actual.bounds.height)]{check(abs(value-(expected[key].number ?? -1))<0.09,"\(mode)/\(id) \(name).\(key)=\(value), expected \(expected[key].string)")}
                }
                if supplement {
                    for source in entry["parts"].array {
                        guard let actual=node(source["part"].string) else{continue}
                        for metric in ["padding","margin","border"] {
                            let values=actual.metrics[metric]?.array ?? []
                            check(values.count==4,"\(mode)/\(id) \(source["part"].string) provides real \(metric) metrics")
                            for (index,edge) in ["Top","Right","Bottom","Left"].enumerated() where index<values.count {
                                let key=metric+edge+(metric=="border" ? "Width":"")
                                let raw=source["style"][metric=="border" ? "borderWidth":key].string
                                if let expected=Double(raw.replacingOccurrences(of:"px",with:"")){check(abs((values[index].number ?? -100)-expected)<0.01,"\(mode)/\(id) inspector \(source["part"].string).\(metric)\(edge) matches source")}
                            }
                        }
                    }
                }
                paint(entry,mode)
                check(state.events.filter{$0.name=="mdOpen"}.count==1,"\(mode)/\(id) has exactly one initial mdOpen")
            }
        }
    }
    static func main(){
        NSApplication.shared.setActivationPolicy(.accessory);host=NSHostingView(rootView:TooltipFixture(state:state));host.frame = .init(x:0,y:0,width:800,height:600)
        window=NSWindow(contentRect:host.frame,styleMask:.borderless,backing:.buffered,defer:false);window.isReleasedWhenClosed=false;window.colorSpace = .sRGB;window.contentView=host;window.setFrameOrigin(.init(x:-10000,y:-10000));window.orderBack(nil);pump();if ProcessInfo.processInfo.environment["AWC_TOOLTIP_SUPPLEMENT_ONLY"]=="1"{oracle(supplement:true)}else if ProcessInfo.processInfo.environment["AWC_TOOLTIP_MOTION_ONLY"]=="1"{motion()}else if ProcessInfo.processInfo.environment["AWC_TOOLTIP_SEMANTICS_ONLY"]=="1"{semantics()}else{oracle();directionalPaint();motion();semantics()};window.close()
        print("Tooltip actual SwiftUI view checks: \(checks-failures.count)/\(checks) passed");if !failures.isEmpty{exit(1)}
    }
}
