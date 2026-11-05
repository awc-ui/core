import AppKit
import SwiftUI
import Observation
@testable import AWCUI

@Observable final class SnackbarFixtureState {
    var properties:[String:AWCValue]=[:]
    var tokens:[String:String]=[:]
    var appearance=AWCSnackbarAppearance()
    var width=800.0
    var height=240.0
    var density=0.0
    var dark=false
    var rtl=false
    var reduced=true
    var forcedColors=false
    var epoch=0
    var nodes:[AWCNativeInspectionNode]=[]
    var events:[AWCEvent]=[]
    var controller=AWCSnackbarController()
    var closeMargin:Double?
    var parts=false
    var authored=false
    var rawSlots=false
    var slotTexts=["Weight sample","Weight sample","Weight sample"]
    var genericParts:[AWCSnackbarPart:AWCSnackbarPartAppearance]=[:]
    var authoredWeight:Double?
    var mounted=true
    var peer=false
    var peerController=AWCSnackbarController()
    var authoredActions=0
    var authoredCloses=0
}
struct SnackbarFixture:View {
    let state:SnackbarFixtureState
    var body:some View {
        let epoch=state.epoch,id="snackbar-\(epoch)"
        AWCSnackbarScope{
            let base=AWCNativeView(node:.init(id:id,tag:"md-snackbar",properties:state.properties,children:state.rawSlots ? [.slotText(state.slotTexts[0]),.slotText(state.slotTexts[1],slot:"action"),.slotText(state.slotTexts[2],slot:"close")]:[])){state.events.append($0)}
                .awcSnackbarController(state.controller).awcSnackbarAppearance(state.appearance).awcSnackbarForcedColors(state.forcedColors)
            let styled=base
                .awcSnackbarPartAppearance(state.genericParts[.surface] ?? .init(),part:.surface)
                .awcSnackbarPartAppearance(state.genericParts[.message] ?? .init(),part:.message)
                .awcSnackbarPartAppearance(state.genericParts[.actions] ?? .init(),part:.actions)
                .awcSnackbarPartAppearance(state.genericParts[.close] ?? .init(),part:.close)
                .awcSnackbarPartAppearance(state.genericParts[.closeIcon] ?? .init(),part:.closeIcon)
            let component=styled
                .awcSnackbarPartAppearance(.init(fontWeight:state.authoredWeight),part:.surface)
                .awcSnackbarPartAppearance(state.parts ? .init(borderColor:"#FFAA33",borderWidth:2,cornerShape:.points(12)):.init(),part:.surface)
                .awcSnackbarPartAppearance(state.parts ? .init(fontWeight:700):.init(),part:.message)
                .awcSnackbarPartAppearance(state.parts ? .init(paddingInlineStart:13):.init(),part:.actions)
                .awcSnackbarPartAppearance(state.parts ? .init(marginInlineStart:state.closeMargin ?? 7):.init(marginInlineStart:state.closeMargin),part:.close)
                .awcSnackbarPartAppearance(state.parts ? .init(color:"#22CC99"):.init(),part:.closeIcon)
            if !state.mounted{Color.clear.frame(width:0,height:0)}
            else if state.authored {
                component.awcSnackbarSlot(.message,accessibilityLabel:"Authored message"){
                    AWCNativeMeterTextView(model:.init(text:"Authored message",size:14,lineHeight:20,weight:400,spacing:0.25,tabular:false),color:Color(awcHex:"#F4EFF4"),wrap:true,center:false)
                }.awcSnackbarSlot(.action){
                    SnackbarAuthoredButton(text:"Custom action",color:"#D0BCFF"){state.authoredActions += 1}
                }.awcSnackbarSlot(.close){
                    SnackbarAuthoredButton(text:"Custom close",color:"#F4EFF4"){state.authoredCloses += 1}
                }
            }else{component}
            if state.peer{
                AWCNativeView(node:.init(id:"peer",tag:"md-snackbar",properties:["open":false,"message":"","closeable":true,"autoHide":false])){state.events.append($0)}
                    .awcSnackbarController(state.peerController).awcSnackbarAppearance(.init(containerColor:"#0000FF"))
            }
        }.id(epoch).frame(width:state.width,height:state.height)
            .awcNativeInspection(rootID:id,coordinateSpace:"snackbar-fixture"){if state.epoch==epoch{state.nodes=$0}}
            .environment(\.awcNativeDensity,state.density).environment(\.awcSnackbarReducedMotion,state.reduced)
            .awcTheme(.generated(dark:state.dark,tokens:state.tokens))
            .environment(\.layoutDirection,state.rtl ? .rightToLeft:.leftToRight)
            .frame(width:800,height:400,alignment:.topLeading).background(Color.white)
            .coordinateSpace(name:"snackbar-fixture")
    }
}
struct SnackbarAuthoredButton:View {
    let text:String,color:String,action:()->Void
    var body:some View {
        Button(action:action){
            AWCNativeMeterTextView(model:.init(text:text,size:12,lineHeight:16,weight:500,spacing:0,tabular:false,usesDefaultKerning:true),color:Color(awcHex:color),wrap:false,center:false)
                .padding(.horizontal,10).padding(.vertical,6)
                .background(Color(white:0.92)).overlay(Rectangle().strokeBorder(Color(white:0.6),lineWidth:2))
        }.buttonStyle(.plain).accessibilityLabel(text)
    }
}
@main @MainActor enum NativeSnackbarViewIntegration {
    static let state=SnackbarFixtureState()
    static var host:NSHostingView<SnackbarFixture>!,window:NSWindow!
    static var checks=0,failures:[String]=[]
    static func check(_ ok:Bool,_ message:String){checks += 1;if !ok{failures.append(message);print("FAIL: "+message);fflush(stdout)}}
    static func near(_ a:Double,_ b:Double,_ tolerance:Double=0.08)->Bool{a.isFinite && abs(a-b)<=tolerance}
    static func pump(_ seconds:Double=0.06){let end=Date().addingTimeInterval(seconds);while Date()<end{while let event=NSApp.nextEvent(matching:.any,until:Date(),inMode:.default,dequeue:true){NSApp.sendEvent(event)};host?.layoutSubtreeIfNeeded();host?.displayIfNeeded();_ = RunLoop.current.run(mode:.default,before:Date().addingTimeInterval(0.001))}}
    static func node(_ part:String?=nil)->AWCNativeInspectionNode?{state.nodes.first{$0.id==(part.map{"component."+$0} ?? "component")}}
    static func document(_ mode:String)->AWCValue{let p=ProcessInfo.processInfo.environment["AWC_SNACKBAR_ORACLE_DIRECTORY"].map{URL(fileURLWithPath:$0).appendingPathComponent("web-\(mode).json")} ?? URL(fileURLWithPath:#filePath).deletingLastPathComponent().appendingPathComponent("Fixtures/snackbar-web-\(mode).json");return try! JSONDecoder().decode(AWCValue.self,from:Data(contentsOf:p))}
    static func configure(_ entry:AWCValue,_ doc:AWCValue,_ mode:String){
        let f=entry["fixture"];state.epoch += 1;state.nodes=[];state.events=[];state.mounted=true;state.rawSlots=false;state.slotTexts=["Weight sample","Weight sample","Weight sample"];state.genericParts=[:];state.authoredWeight=nil;state.peer=false;state.peerController=AWCSnackbarController();state.controller=AWCSnackbarController();state.properties=f.object;state.authored=f["slots"].bool ?? false;state.parts=f["parts"].bool ?? false;state.closeMargin=nil
        state.properties["open"]=f.object["open"] ?? true;state.properties["autoHide"]=false
        state.width=entry["viewport"]["width"].number ?? 800;state.height=entry["viewport"]["height"].number ?? 240
        state.dark=mode=="dark";state.rtl=f["dir"].string=="rtl";state.density=f["inheritedDensity"].number ?? 0
        state.tokens=doc["tokens"].object.mapValues(\.string)
        let styles=f["style"].object
        func text(_ key:String)->String?{styles[key]?.string}
        func length(_ key:String)->AWCSnackbarLength?{text(key).flatMap(AWCSnackbarLength.init(css:))}
        state.appearance = .init(containerColor:text("container-color"),messageColor:text("message-color"),actionColor:text("action-color"),closeColor:text("close-color"),containerShape:text("container-shape")==nil ? nil:.init(topLeft:.init(x:.points(20),y:.points(8)),topRight:.init(x:.points(4),y:.points(12)),bottomRight:.init(x:.points(20),y:.points(8)),bottomLeft:.init(x:.points(4),y:.points(12))),minWidth:length("min-width"),maxWidth:length("max-width"))
        pump()
    }
    static func oracle(){
        let filter=ProcessInfo.processInfo.environment["AWC_SNACKBAR_CASES"].map{Set($0.split(separator:",").map(String.init))}
        for mode in ["light","dark"]{let doc=document(mode);for entry in doc["results"].array{
            let f=entry["fixture"],id=f["id"].string
            guard filter==nil || filter!.contains(id) else{continue}
            configure(entry,doc,mode)
            if f["hidden"].bool==true{check(node()==nil,"\(mode)/\(id) hidden has no rendered host");continue}
            for part in entry["parts"].array {
                let name=part["part"].string,expected=part["rect"]
                guard let actual=node(name) else{check(false,"\(mode)/\(id) missing \(name)");continue}
                for (key,value) in [("x",actual.bounds.minX),("y",actual.bounds.minY),("width",actual.bounds.width),("height",actual.bounds.height)]{
                    check(near(value,expected[key].number ?? -1),"\(mode)/\(id) \(name).\(key)=\(value) expected \(expected[key].string)")
                }
            }
            let opened=state.events.filter{$0.name=="mdOpen"}
            check(opened.count==(f["open"].bool==false ? 0:1)&&opened.allSatisfy{$0.detail == .null},"\(mode)/\(id) actual initial mdOpen payload and count")
        }}
    }
    static func views(_ view:NSView)->[NSView]{[view]+view.subviews.flatMap(views)}
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
    static func directionalPaint(){
        let doc=document("light"),entry=doc["results"].array.first{$0["fixture"]["id"].string=="bottom-ltr"}!
        for raw in [false,true]{for rtl in [false,true]{
            configure(entry,doc,"light");state.rtl=rtl;state.rawSlots=raw;state.slotTexts=["Aligned","",""]
            state.properties["message"]="Aligned";state.properties["stacked"]=true;state.properties["autoHide"]=false
            state.appearance = .init(containerColor:"#FFFFFF",messageColor:"#FF0000",minWidth:.points(500),maxWidth:.points(500));pump()
            guard let box=node("message")?.bounds else{check(false,"Directional paint requires actual message bounds");continue}
            let image=bytes(),left=CGRect(x:box.minX,y:box.minY,width:box.width/2,height:box.height),right=CGRect(x:box.midX,y:box.minY,width:box.width/2,height:box.height)
            let expected=hits(image,rect:rtl ? right:left,color:[255,0,0]),opposite=hits(image,rect:rtl ? left:right,color:[255,0,0])
            check(expected>10 && opposite==0,"Actual \(raw ? "authored":"fallback") glyph paint follows logical start in \(rtl ? "RTL":"LTR")")
        }}
    }
    static func paint(){
        for mode in ["light","dark"]{let doc=document(mode);for id in ["bottom-ltr","bottom-rtl","density0-stackedtrue","all-styles","all-styles-stacked-rtl","part-styles"]{
            guard let entry=doc["results"].array.first(where:{$0["fixture"]["id"].string==id}) else{continue};configure(entry,doc,mode);pump(0.35)
            let pixels=bytes(),surface=entry["parts"].array.first{$0["part"].string=="surface"}!,base=composite(rgb(surface["style"]["backgroundColor"].string),over:[255,255,255])
            check(hits(pixels,rect:node("surface")!.bounds,color:base)>400,"\(mode)/\(id) actual source container RGB and alpha without inner shadow darkening")
            let message=entry["parts"].array.first{$0["part"].string=="message"}!
            check(hits(pixels,rect:node("message")!.bounds,color:composite(rgb(message["style"]["color"].string),over:base))>8,"\(mode)/\(id) actual message color and alpha")
            for (part,tag,sourcePart) in [("actions","md-button","label"),("close","md-icon-button","icon")]{
                if let nested=entry["nested"].array.first(where:{$0["tag"].string==tag}),let source=nested["parts"].array.first(where:{$0["part"].string==sourcePart}){
                    check(hits(pixels,rect:node(part)!.bounds,color:composite(rgb(source["style"]["color"].string),over:base))>3,"\(mode)/\(id) actual \(part) inherited RGBA/part paint")
                }
            }
            if id=="part-styles"{check(hits(pixels,rect:node("surface")!.bounds,color:[255,170,51])>100,"\(mode) authored surface border paint")}
            if let directory=ProcessInfo.processInfo.environment["AWC_SNACKBAR_CAPTURE_DIRECTORY"]{
                let url=URL(fileURLWithPath:directory);try! FileManager.default.createDirectory(at:url,withIntermediateDirectories:true)
                try! bitmap().representation(using:.png,properties:[:])!.write(to:url.appendingPathComponent("swift-\(mode)-\(id).png"))
            }
        }}
    }
    static func click(_ part:String){
        guard let box=node(part)?.bounds else{check(false,"Missing click target \(part)");return}
        let point=NSPoint(x:box.midX,y:host.isFlipped ? box.midY:host.bounds.height-box.midY),location=host.convert(point,to:nil),now=ProcessInfo.processInfo.systemUptime
        let down=NSEvent.mouseEvent(with:.leftMouseDown,location:location,modifierFlags:[],timestamp:now,windowNumber:window.windowNumber,context:nil,eventNumber:1,clickCount:1,pressure:1)!
        let up=NSEvent.mouseEvent(with:.leftMouseUp,location:location,modifierFlags:[],timestamp:now+0.01,windowNumber:window.windowNumber,context:nil,eventNumber:2,clickCount:1,pressure:0)!
        NSApp.postEvent(up,atStart:false);window.sendEvent(down);pump(0.08)
    }
    static func authoredAndSemantics(){
        let doc=document("light"),entry=doc["results"].array.first{$0["fixture"]["id"].string=="custom-slots"}!
        configure(entry,doc,"light");state.authoredActions=0;state.authoredCloses=0;state.events=[]
        click("actions");click("close")
        check(state.authoredActions==1 && state.authoredCloses==1,"Actual authored native controls receive their own clicks")
        check(state.controller.isOpen && !state.events.contains{$0.name=="mdAction" || $0.name=="mdClose"},"Authored slots do not trigger fallback action/dismiss handlers")
        let status=views(host).compactMap{$0 as? AWCSnackbarStatusView}.first!
        check(status.isAccessibilityElement() && status.accessibilityLabel()=="Authored message" && status.accessibilityRoleDescription()=="status","Actual native status responder exposes authored message semantics")
        state.properties["politeness"]="assertive";pump()
        check(status.accessibilityRoleDescription()=="alert","Retained politeness updates native status semantics")
        state.properties["open"]=false;pump()
        check(!status.isAccessibilityElement() && !state.events.contains{$0.name=="mdClose"},"Authored close hides semantics without synthetic close event")
    }
    static func signedMargins(){
        let doc=document("light"),entry=doc["results"].array[0]
        for rtl in [false,true]{
            configure(entry,doc,"light");state.rtl=rtl;state.appearance = .init(minWidth:.points(0),maxWidth:.points(1200));pump()
            let before=node("surface")!.bounds,closeBefore=node("close")!.bounds
            state.closeMargin = -7;pump()
            let after=node("surface")!.bounds,closeAfter=node("close")!.bounds
            check(near(after.width,before.width-7) && near(after.midX,before.midX),"Signed close margin reduces actual intrinsic surface width in \(rtl ? "RTL":"LTR")")
            check(near(closeAfter.width,40) && near(closeAfter.minX-closeBefore.minX,rtl ? 3.5:-3.5),"Signed close margin preserves control size and logical position in \(rtl ? "RTL":"LTR")")
        }
    }
    static func retainedLifecycle(){
        let doc=document("light");var e=doc["results"].array[0].object
        e["fixture"]=["open":true,"message":"","closeable":true,"autoHide":false]
        configure(.object(e),doc,"light");state.appearance = .init(containerColor:"#FF0000");state.peer=true;pump()
        state.peerController.authoredOpen(true);pump()
        let sample=CGRect(x:350,y:180,width:100,height:20)
        check(hits(bytes(),rect:sample,color:[0,0,255])>100,"Newly opened native peer paints above the older Snackbar")
        for _ in 0..<3{state.controller.authoredOpen(false);state.controller.authoredOpen(true);pump();check(hits(bytes(),rect:sample,color:[255,0,0])>100,"Reopened retained Snackbar rises above its current peers")}
        let nativeHost=views(host).compactMap{$0 as? AWCSnackbarHostView}.first!
        check((nativeHost.registry?.ranks.values.max() ?? 99)<=2,"Actual mounted registry keeps peer ranks bounded")
        let focus=views(host).compactMap{$0 as? AWCNativeButtonFocusView}.first!
        window.makeFirstResponder(focus)
        let key=NSEvent.keyEvent(with:.keyDown,location:.zero,modifierFlags:[],timestamp:ProcessInfo.processInfo.systemUptime,windowNumber:window.windowNumber,context:nil,characters:"\u{1b}",charactersIgnoringModifiers:"\u{1b}",isARepeat:false,keyCode:53)!
        window.sendEvent(key);pump(0.05)
        check(state.controller.isOpen && state.peerController.isOpen,"Real Escape preserves both peers during ripple feedback")
        pump(0.16)
        check(!state.controller.isOpen && !state.peerController.isOpen && state.events.filter{$0.name=="mdClose" && $0.detail==["reason":"close"]}.count==2,"Real native Escape dismisses every open closeable peer once")
        state.peer=false;state.properties["autoHide"]=true;state.properties["autoHideDuration"]=180;state.properties["open"]=false;pump();state.properties["open"]=true;pump(0.04)
        let openings=state.events.filter{$0.name=="mdOpen"}.count
        state.mounted=false;pump(0.25)
        check(state.controller.isOpen,"Actual view detachment cancels pending auto-hide")
        state.mounted=true;pump(0.04)
        check(state.controller.isOpen && state.events.filter{$0.name=="mdOpen"}.count==openings,"Actual reattachment preserves open state without replaying mdOpen")
        pump(0.22);check(!state.controller.isOpen && state.events.last?.detail==["reason":"auto"],"Actual reattachment restores its timer")
    }
    static func authoredTypography(){
        let doc=document("light"),entry=doc["results"].array[0];configure(entry,doc,"light")
        state.rawSlots=true;pump()
        let ordinary=node("actions")!.bounds.width
        state.authoredWeight=700;pump()
        let bold=AWCNativeMeterText(text:"Weight sample",size:16,lineHeight:20,weight:700,spacing:0,tabular:false,usesDefaultKerning:true).naturalWidth
        check(near(node("actions")!.bounds.width,bold) && near(node("close")!.bounds.width,bold),"Raw authored action/close inherit surface typography at host font size")
        check(!near(ordinary,bold),"Changing inherited authored weight changes actual native glyph metrics")
        let info=node("message")!.metrics["typography"] ?? .null
        check(info["weight"].number==400,"Explicit source message typography remains400 under inherited surface weight700")
    }
    static func forcedColors(){
        let doc=document("light"),entry=doc["results"].array[0];configure(entry,doc,"light")
        state.appearance = .init(minWidth:.points(320),maxWidth:.points(320));pump()
        let before=node("surface")!.bounds,messageBefore=node("message")!.bounds
        state.forcedColors=true;pump()
        let after=node("surface")!.bounds,messageAfter=node("message")!.bounds
        check(near(after.height,before.height+2) && near(after.width,before.width),"Explicit forced-colors border participates in the actual native border box: \(before) → \(after)")
        check(near(messageAfter.minX,messageBefore.minX+1),"Forced-colors border moves actual content by its one-point inset: \(messageBefore) → \(messageAfter)")
        state.forcedColors=false;pump()
    }
    static func extraParts(){
        let directory=ProcessInfo.processInfo.environment["AWC_SNACKBAR_EXTRA_PARTS"]
        for mode in ["light","dark"]{
            let url=directory.map{URL(fileURLWithPath:$0).appendingPathComponent("extra-parts-\(mode).json")} ?? URL(fileURLWithPath:#filePath).deletingLastPathComponent().appendingPathComponent("Fixtures/snackbar-web-extra-parts-\(mode).json"),doc=try! JSONDecoder().decode(AWCValue.self,from:Data(contentsOf:url))
            for e in doc["results"].array{
                configure(e,doc,mode);let f=e["fixture"],id=f["id"].string
                let css=f["partCSS"].string
                let name=css.components(separatedBy:"::part(").last?.components(separatedBy:")").first ?? ""
                let key:AWCSnackbarPart?=["surface":.surface,"message":.message,"actions":.actions,"close":.close,"close-icon":.closeIcon][name]
                if let key{
                    if id.hasPrefix("decoration-"){state.genericParts[key] = .init(color:"#22CC99",backgroundColor:"#22446688",borderColor:"#FFAA33",borderWidth:2,cornerShape:.points(9),fontWeight:700,paddingInlineStart:5,marginInlineStart:-3)}
                    else if id.hasPrefix("authored-weight-"){state.genericParts[key] = .init(fontWeight:700)}
                    else{state.genericParts[key] = .init(marginInlineStart:id.contains("margin-7") ? -7:7)}
                }
                if f["simpleSlots"].bool==true{state.authored=false;state.rawSlots=true;state.slotTexts=["Authored message","Authored action","Authored close"]}
                pump()
                for part in e["parts"].array{
                    let name=part["part"].string,expected=part["rect"]
                    guard let actual=node(name) else{check(false,"Extra \(mode)/\(id) missing \(name)");continue}
                    for (key,value) in [("x",actual.bounds.minX),("y",actual.bounds.minY),("width",actual.bounds.width),("height",actual.bounds.height)]{
                        check(near(value,expected[key].number ?? -1,0.08),"Extra \(mode)/\(id) \(name).\(key)=\(value) expected \(expected[key].string)")
                    }
                }
                if let icon=e["nested"].array.first(where:{$0["tag"].string=="md-icon-button"})?["parts"].array.first(where:{$0["part"].string=="icon"}),let actual=node("close-icon"){
                    let expected=icon["rect"]
                    for (key,value) in [("x",actual.bounds.minX),("y",actual.bounds.minY),("width",actual.bounds.width),("height",actual.bounds.height)]{check(near(value,expected[key].number ?? -1),"Extra \(mode)/\(id) close-icon.\(key)=\(value) expected \(expected[key].string)")}
                }
                if id.hasPrefix("decoration-"){
                    pump(0.3)
                    let sourcePart=name=="close-icon" ? e["nested"].array.first{$0["tag"].string=="md-icon-button"}!["parts"].array.first{$0["part"].string=="icon"}!:e["parts"].array.first{$0["part"].string==name}!
                    let base=rgb(e["parts"].array.first{$0["part"].string=="surface"}!["style"]["backgroundColor"].string)
                    let backdrop=name=="surface" ? [255.0,255,255]:composite(base,over:[255,255,255])
                    let color=composite(rgb(sourcePart["style"]["backgroundColor"].string),over:backdrop),pixels=bytes(),box=node(name)!.bounds
                    check(hits(pixels,rect:box,color:color)>10,"Extra \(mode)/\(id) actual translucent part background")
                    check(hits(pixels,rect:box,color:[255,170,51])>10,"Extra \(mode)/\(id) actual part border")
                }
            }
        }
    }
    static func curve(_ x:Double,_ control:[Double])->Double{
        let x=min(1,max(0,x));var low=0.0,high=1.0
        func at(_ t:Double,_ a:Double,_ b:Double)->Double{3*(1-t)*(1-t)*t*a+3*(1-t)*t*t*b+t*t*t}
        for _ in 0..<40{let t=(low+high)/2;if at(t,control[0],control[2])<x{low=t}else{high=t}}
        return at((low+high)/2,control[1],control[3])
    }
    static func motion(){
        let motionURL=URL(fileURLWithPath:#filePath).deletingLastPathComponent().appendingPathComponent("Fixtures/snackbar-web-motion.json")
        let source=try! JSONDecoder().decode(AWCValue.self,from:Data(contentsOf:motionURL))
        for result in source["results"].array{for phase in result["phases"].array{for sample in phase["frames"].array{
            let open=phase["phase"].string=="open",time=sample["time"].number ?? 0
            let expected=open ? curve(time/250,[0.05,0.7,0.1,1]):1-curve(time/200,[0.3,0,0.8,0.15])
            check(abs(Double(sample["host"]["style"]["opacity"].string)!-expected)<0.0001,"Recorded Web transition matches the curve used by actual native frame checks")
        }}}
        let doc=document("light"),original=doc["results"].array[0]
        for position in ["top","bottom","center"]{
            var f=original["fixture"].object;f["open"]=false;f["position"] = .string(position);f["message"]="";f["action"]="";f["closeable"]=false
            var e=original.object;e["fixture"] = .object(f)
            configure(.object(e),doc,"light");state.reduced=false;pump(0.1)
            for open in [true,false]{
                state.controller.authoredOpen(open);pump(open ? 0.1:0.07)
                let before=Date().timeIntervalSince(state.controller.transitionDate),image=bytes(),elapsed=Date().timeIntervalSince(state.controller.transitionDate),expected=open ? curve(elapsed/0.25,[0.05,0.7,0.1,1]):1-curve(elapsed/0.2,[0.3,0,0.8,0.15])
                let x=image.0/2,scale=Double(image.0)/800
                var red=255,top=0
                for y in 0..<Int(400*scale){let value=Int(image.2[(y*image.0+x)*4]);if value<red{red=value;top=y}}
                let alpha=Double(255-red)/206
                let lowerTime=max(0,before-0.035),upperTime=elapsed+0.005
                let early=open ? curve(lowerTime/0.25,[0.05,0.7,0.1,1]):1-curve(lowerTime/0.2,[0.3,0,0.8,0.15]),late=open ? curve(upperTime/0.25,[0.05,0.7,0.1,1]):1-curve(upperTime/0.2,[0.3,0,0.8,0.15])
                check(alpha>=min(early,late)-0.025 && alpha<=max(early,late)+0.025,"\(position)/\(open ? "open":"close") actual rendered opacity follows source curve at \(elapsed)s (\(alpha) vs \(expected))")
                let settled=position=="top" ? 24.0:position=="bottom" ? 168.0:96.0,offset=position=="top" ? -240.0:position=="bottom" ? 240.0:0
                let expectedY=settled+offset*(1-alpha)
                check(abs(Double(top)/scale-max(0,expectedY))<9,"\(position)/\(open ? "open":"close") actual translated surface tracks full viewport offset (\(Double(top)/scale) vs \(expectedY))")
                pump(0.35)
                let final=bytes(),count=hits(final,rect:CGRect(x:260,y:0,width:280,height:240),color:[49,48,51])
                check(open ? count>100:count==0,"\(position) motion reaches the correct visible/hidden endpoint")
            }
        }
        state.reduced=true;state.controller.authoredOpen(true);pump(0.025)
        check(hits(bytes(),rect:CGRect(x:260,y:0,width:280,height:240),color:[49,48,51])>100,"Reduced motion renders the final visible surface immediately")
    }
    static func main(){
        NSApplication.shared.setActivationPolicy(.accessory)
        host=NSHostingView(rootView:SnackbarFixture(state:state));host.frame=CGRect(x:0,y:0,width:800,height:400)
        window=NSWindow(contentRect:host.frame,styleMask:.borderless,backing:.buffered,defer:false);window.isReleasedWhenClosed=false;window.colorSpace = .sRGB
        window.contentView=host;window.setFrameOrigin(.init(x:-10000,y:-10000));window.orderBack(nil);pump()
        if ProcessInfo.processInfo.environment["AWC_SNACKBAR_DIRECTIONAL_ONLY"]=="1"{directionalPaint()}else{oracle();paint();authoredAndSemantics();signedMargins();retainedLifecycle();authoredTypography();forcedColors();motion();extraParts();directionalPaint()};window.close()
        print("Snackbar actual SwiftUI view checks: \(checks-failures.count)/\(checks) passed")
        if !failures.isEmpty{exit(1)}
    }
}
