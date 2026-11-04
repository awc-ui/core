import AppKit
import SwiftUI
import Observation
@testable import AWCUI

@Observable final class SkeletonFixtureState {
    var properties:[String:AWCValue]=[:]
    var tokens:[String:String]=[:]
    var appearance=AWCSkeletonAppearance()
    var context=AWCSkeletonSizingContext()
    var parts:[AWCSkeletonPart:AWCSkeletonPartAppearance]=[:]
    var dark=false
    var rtl=false
    var forced=false
    var reduced:Bool?=false
    var density=0.0
    var width=240.0
    var epoch=0
    var clock:AWCNativeSkeletonClock? = .init(entrance:10,recurring:0)
    var nodes:[AWCNativeInspectionNode]=[]
}
struct SkeletonFixture:View {
    let state:SkeletonFixtureState
    var body:some View {
        let epoch=state.epoch,id="skeleton-\(epoch)"
        AWCNativeSkeleton(nodeID:id,properties:state.properties,theme:.generated(dark:state.dark,tokens:state.tokens))
            .awcSkeletonAppearance(state.appearance).awcSkeletonSizingContext(state.context)
            .environment(\.awcSkeletonParts,state.parts)
            .awcNativeInspection(rootID:id,coordinateSpace:"skeleton-fixture"){if state.epoch==epoch{state.nodes=$0}}
            .id(epoch).frame(width:state.width,alignment:.leading).frame(width:400,height:400,alignment:.topLeading).background(Color.white)
            .awcDensity(state.density).environment(\.layoutDirection,state.rtl ? .rightToLeft:.leftToRight)
            .environment(\.awcSkeletonClock,state.clock).environment(\.awcSkeletonReducedMotion,state.reduced)
            .awcSkeletonForcedColors(state.forced).coordinateSpace(name:"skeleton-fixture")
    }
}
@main @MainActor enum NativeSkeletonViewIntegration {
    static let state=SkeletonFixtureState()
    static var host:NSHostingView<SkeletonFixture>!,window:NSWindow!
    static var checks=0,failures:[String]=[]
    static func check(_ value:Bool,_ message:String){checks += 1;if !value{failures.append(message);print("FAIL: "+message);fflush(stdout)}}
    static func near(_ a:Double,_ b:Double,_ tolerance:Double=0.04)->Bool{a.isFinite && abs(a-b)<=tolerance}
    static func pump(_ seconds:Double=0.035){let until=Date().addingTimeInterval(seconds);while Date()<until{while let event=NSApp.nextEvent(matching:.any,until:Date(),inMode:.default,dequeue:true){NSApp.sendEvent(event)};host?.layoutSubtreeIfNeeded();host?.displayIfNeeded();_ = RunLoop.current.run(mode:.default,before:Date().addingTimeInterval(0.001))}}
    static func descendants(_ view:NSView)->[NSView]{[view]+view.subviews.flatMap(descendants)}
    static func control()->AWCNativeSkeletonStatusView?{descendants(host).compactMap{$0 as? AWCNativeSkeletonStatusView}.last}
    static func node(_ part:String?=nil)->AWCNativeInspectionNode?{state.nodes.first{$0.id == (part.map{"component."+$0} ?? "component")}}
    static func bitmap()->NSBitmapImageRep{let bitmap=host.bitmapImageRepForCachingDisplay(in:host.bounds)!;host.cacheDisplay(in:host.bounds,to:bitmap);return bitmap}
    static func bytes()->[UInt8]{
        let image=bitmap().cgImage!;var bytes=[UInt8](repeating:0,count:image.width*image.height*4)
        bytes.withUnsafeMutableBytes{buffer in let cg=CGContext(data:buffer.baseAddress,width:image.width,height:image.height,bitsPerComponent:8,bytesPerRow:image.width*4,space:CGColorSpace(name:CGColorSpace.sRGB)!,bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue)!;cg.draw(image,in:.init(x:0,y:0,width:image.width,height:image.height))};return bytes
    }
    static func numbers(_ text:String)->[Double]{let regex=try! NSRegularExpression(pattern:"[-+]?(?:[0-9]*\\.)?[0-9]+(?:[eE][-+]?[0-9]+)?");return regex.matches(in:text,range:NSRange(text.startIndex...,in:text)).compactMap{Range($0.range,in:text).flatMap{Double(text[$0])}}}
    static func cssColor(_ css:String)->[Double]{var n=numbers(css);if css.hasPrefix("color("){n=Array(n.prefix(3)).map{$0*255}+Array(n.dropFirst(3))};return n.count==3 ? n+[1]:n}
    static func colorHits(_ pixels:[UInt8],css:String,opacity:Double=1)->Int {
        let n=cssColor(css);guard n.count>=4 else{return 0};let alpha=n[3]*opacity,expected=(0..<3).map{n[$0]*alpha+255*(1-alpha)}
        var hits=0
        for i in stride(from:0,to:pixels.count,by:4){if (0..<3).allSatisfy({abs(Double(pixels[i+$0])-expected[$0])<=3}){hits += 1;if hits>=16{return hits}}}
        return hits
    }
    static func corners(_ css:String)->AWCCornerShape{
        let sides=css.split(separator:"/").map{numbers(String($0))}
        func four(_ n:[Double])->[Double]{switch n.count{case 1:return Array(repeating:n[0],count:4);case 2:return [n[0],n[1],n[0],n[1]];case 3:return [n[0],n[1],n[2],n[1]];default:return Array(n.prefix(4))}}
        let x=four(sides.first ?? [0]),y=four(sides.count>1 ? sides[1]:sides.first ?? [0]);let r=(0..<4).map{AWCCornerRadius(x:css.contains("%") ? .fraction(x[$0]/100):.points(x[$0]),y:css.contains("%") ? .fraction(y[$0]/100):.points(y[$0]))}
        return .init(topLeft:r[0],topRight:r[1],bottomRight:r[2],bottomLeft:r[3])
    }
    static func appearance(_ style:AWCValue)->AWCSkeletonAppearance{
        func l(_ k:String)->AWCSkeletonLength?{style.object[k].flatMap{AWCSkeletonLength(css:$0.string)}}
        func s(_ k:String)->String?{style.object[k]?.string}
        func t(_ k:String)->Double?{s(k).flatMap{Double($0.replacingOccurrences(of:"ms",with:""))}.map{$0/1000}}
        return .init(color:s("color"),highlight:s("highlight"),radius:s("radius").map(corners),roundedRadius:s("roundedRadius").map(corners),width:l("width"),height:l("height"),size:l("size"),lineGap:l("lineGap"),pulseDuration:t("pulseDuration"),waveDuration:t("waveDuration"),bloomDuration:t("bloomDuration"))
    }
    static func document(_ name:String)->AWCValue{
        let url:URL
        if let directory=ProcessInfo.processInfo.environment["AWC_SKELETON_ORACLE_DIRECTORY"],name != "animation"{url=URL(fileURLWithPath:directory).appendingPathComponent("web-\(name).json")}
        else{url=URL(fileURLWithPath:#filePath).deletingLastPathComponent().appendingPathComponent("Fixtures/skeleton-web-\(name).json")}
        return try! JSONDecoder().decode(AWCValue.self,from:Data(contentsOf:url))
    }
    static func configure(_ entry:AWCValue,doc:AWCValue,mode:String,time:Double?=nil){
        let f=entry["fixture"];state.epoch += 1;state.nodes=[];state.properties=f.object;state.appearance=appearance(f["style"])
        state.context = .init(fontSize:f["fontSize"].number ?? 16,parentHeight:f["parentHeight"].number)
        state.parts=f["part"].bool==true ? [.line:.init(color:"#00FF0080",height:.points(12)),.lineLast:.init(width:.fraction(0.4),cornerShape:.points(0))]:[:]
        state.dark=mode=="dark";state.rtl=entry["host"]["style"]["direction"].string=="rtl";state.density=f["inheritedDensity"].number ?? 0;state.width=entry["parent"]["width"].number ?? 240
        state.tokens=ProcessInfo.processInfo.environment["AWC_SKELETON_NATIVE_DEFAULT_PALETTE"]=="1" ? [:]:doc["tokens"].object.mapValues(\.string);state.clock = .init(entrance:time ?? 10,recurring:time ?? 0);state.reduced=false;state.forced=false;pump()
    }
    static func compare(_ entry:AWCValue,_ context:String,paint:Bool=true){
        let f=entry["fixture"],id=context+"/"+f["id"].string,expected=entry["host"]
        if f["hidden"].bool==true{check(node()==nil && control()==nil,"\(id) hidden removes inspection and semantics");return}
        guard let root=node() else{check(false,"\(id) actual root missing");return}
        check(near(root.bounds.width,expected["width"].number!) && near(root.bounds.height,expected["height"].number!),"\(id) root\(root.bounds.size) expected\(expected["width"].string)×\(expected["height"].string)")
        if f["announce"].bool==false{check(control()==nil,"\(id) decorative removes native responder")}
        else{check(control()?.accessibilityRole()==NSAccessibility.Role.busyIndicator && control()?.accessibilityLabel()==(f.object["ariaLabelProp"]?.string ?? "Loading") && control()?.canBecomeKeyView==false,"\(id) actual loading responder label and no tab stop")}
        let pixels=paint ? bytes():[]
        for (index,part) in entry["parts"].array.enumerated(){
            let name=part["part"].string,key=name=="shape" ? "shape":"line.\(index)"
            guard let actual=node(key) else{check(false,"\(id) missing actual \(key)");continue}
            check(near(actual.bounds.width,part["width"].number!,0.07) && near(actual.bounds.height,part["height"].number!,0.07),"\(id) \(key) size\(actual.bounds.size) expected\(part["width"].string)×\(part["height"].string)")
            check(near(actual.bounds.minX-root.bounds.minX,part["x"].number!,0.07) && near(actual.bounds.minY-root.bounds.minY,part["y"].number!,0.07),"\(id) \(key) origin\(actual.bounds.minX-root.bounds.minX),\(actual.bounds.minY-root.bounds.minY) expected\(part["x"].string),\(part["y"].string)")
            check(actual.name=="md-skeleton ::part(\(name))","\(id) \(key) semantic inspector part identity")
            if paint,actual.bounds.width>3,actual.bounds.height>3{check(colorHits(pixels,css:part["style"]["fill"].string)>2,"\(id) actual base color and alpha \(part["style"]["fill"].string)")}
        }
    }
    static func cornerPixels(){
        let doc=document("light")
        for entry in doc["results"].array where entry["fixture"]["id"].string.hasSuffix("all-styles") || entry["fixture"]["id"].string=="part-override" {
            configure(entry,doc:doc,mode:"light")
            let image=bitmap(),scale=Double(image.pixelsWide)/host.bounds.width
            for (index,part) in entry["parts"].array.enumerated(){
                let key=part["part"].string=="shape" ? "shape":"line.\(index)"
                guard let actual=node(key) else{continue}
                // Computed CSS radii provide the independent expected corner
                // ellipse. Samples stay clear of antialiased boundary pixels.
                let r=corners(part["style"]["radius"].string).radii(in:actual.bounds.size)
                var visited=Set<String>()
                for corner in 0..<4 where r[corner].width>1 && r[corner].height>1 {
                    for u in [0.1,0.35,0.65,0.9]{for v in [0.1,0.35,0.65,0.9]{
                        let left=corner==0 || corner==3,top=corner<2
                        let x=left ? actual.bounds.minX+r[corner].width*u:actual.bounds.maxX-r[corner].width*u
                        let y=top ? actual.bounds.minY+r[corner].height*v:actual.bounds.maxY-r[corner].height*v
                        let px=Int(floor(x*scale)),py=Int(floor(y*scale)),centerX=(Double(px)+0.5)/scale,centerY=(Double(py)+0.5)/scale
                        let dx=(left ? actual.bounds.minX+r[corner].width-centerX:centerX-(actual.bounds.maxX-r[corner].width))/r[corner].width
                        let dy=(top ? actual.bounds.minY+r[corner].height-centerY:centerY-(actual.bounds.maxY-r[corner].height))/r[corner].height
                        let distance=dx*dx+dy*dy
                        guard abs(sqrt(distance)-1)*min(r[corner].width,r[corner].height)>1,
                              px>=0,py>=0,px<image.pixelsWide,py<image.pixelsHigh,
                              visited.insert("\(px),\(py)").inserted else{continue}
                        let color=image.colorAt(x:px,y:py)!.usingColorSpace(.sRGB)!,painted=min(color.redComponent,color.greenComponent,color.blueComponent)<0.97
                        check(painted==(distance<1),"\(entry["fixture"]["id"].string) actual corner\(corner) pixel\(px),\(py) follows computed CSS ellipse")
                    }}
                }
            }
        }
    }
    static func contracts(){
        for source in ["50%","10em","20ch","1.5rem","calc(100% - 32px)","1e310%","calc(1px + 1e310%)","0"]{check(AWCSkeletonLength(css:source) != nil,"Accepted source length \(source)")}
        for source in ["1e311%","-2px","calc(2px*4)","1vw","var(--x)","auto","3","calc(0)"]{check(AWCSkeletonLength(css:source)==nil,"Unsupported source length \(source) stays explicit")}
        let c=AWCSkeletonSizingContext(parentHeight:160)
        check(AWCSkeletonLength(css:"calc(100% - 32px)")?.resolve(parent:240,context:c)==208,"Affine percentage retains actual parent")
        check(AWCSkeletonLength(css:"50%")?.resolve(parent:nil,context:c)==nil,"Indefinite differs from zero")
        check(AWCSkeletonLength(css:"50%")?.resolve(parent:0,context:c)==0,"Definite zero resolves")
        check(AWCSkeletonLength(css:"1e310%")?.fraction==1e308,"Finite normalized percent exponent")
        check(AWCSkeletonLength(points:-1e308,fraction:1e308).resolve(parent:1,context:c)==0,"Huge exact affine cancellation")
        check(AWCSkeletonLength(points:1e308,fraction:1e308).resolve(parent:240,context:c)==AWCSkeletonLength.maximumUsedLength,"Huge finite affine used value stays bounded")
        check(AWCSkeletonAppearance(color:"#12345680",width:.points(0),pulseDuration:0).merging(.init(highlight:"#abcdef")).color=="#12345680","Sparse RGBA appearance merge")
        check(AWCSkeletonAppearance(radius:.points(.nan),width:.points(.infinity),waveDuration:-1) == .init(),"Invalid style cannot poison layout")
        let invalidToken=AWCNativeSkeletonMetrics(properties:[:],appearance:.init(),density:0,tokens:["--md-sys-motion-duration-extra-long2":"invalid"])
        check(invalidToken.waveDuration==1.8 && invalidToken.pulseDuration==1.8,"Unparseable duration uses seconds fallback without1000-fold conversion")
    }
    static func oracle(){
        let filter=ProcessInfo.processInfo.environment["AWC_SKELETON_CASES"].map{Set($0.split(separator:",").map(String.init))}
        for mode in ["light","dark"]{let doc=document(mode);for entry in doc["results"].array where filter==nil || filter!.contains(entry["fixture"]["id"].string){configure(entry,doc:doc,mode:mode);compare(entry,mode)}}
    }
    static func motion(){
        let doc=document("light"),frames=document("animation")["frames"].array
        var pictures:[String:[[UInt8]]]=[:],steadyPictures:[String:[[UInt8]]]=[:]
        for frame in frames{let time=(frame["time"].number ?? 0)/1000;for entry in frame["results"].array{
            configure(entry,doc:doc,mode:"light",time:time);compare(entry,"motion@\(time)",paint:false)
            let m=AWCNativeSkeletonMetrics(properties:state.properties,appearance:state.appearance,density:state.density,tokens:state.tokens),sample=AWCNativeSkeletonMotion.sample(m,entrance:time,recurring:time,reduced:false,rtl:state.rtl)
            check(near(sample.opacity,Double(entry["host"]["style"]["opacity"].string) ?? -1,0.00002),"\(entry["fixture"]["id"].string) sampled actual CSS entrance opacity@\(time)")
            let transform=numbers(entry["host"]["style"]["transform"].string)
            check(near(sample.scale,transform.first ?? 1,0.00001),"\(entry["fixture"]["id"].string) sampled CSS entrance scale@\(time)")
            for part in entry["parts"].array {
                check(near(sample.pulse,Double(part["style"]["opacity"].string) ?? -1,0.00002),"\(entry["fixture"]["id"].string) sampled CSS pulse@\(time)")
                if m.animation=="wave" {
                    let actual=numbers(part["after"]["transform"].string),strip=numbers(part["after"]["width"].string).first ?? 0
                    check(actual.count==6 && near(actual[4],(-1+3*sample.wave)*strip,0.003),"\(entry["fixture"]["id"].string) source pseudo translation/RTL@\(time)")
                    check(actual.count==6 && near(actual[2],tan(-12*Double.pi/180),0.00001),"\(entry["fixture"]["id"].string) source pseudo skew@\(time)")
                }
            }
            let pixels=bytes(),id=entry["fixture"]["id"].string
            pictures[id,default:[]].append(pixels)
            if time>=0.8{steadyPictures[id,default:[]].append(pixels)}
        }}
        for (id,pictures) in pictures{check(pictures.dropFirst().contains{$0 != pictures[0]},"\(id) mount/motion changes actual native pixels")}
        for entry in doc["results"].array where ["text-wave","rounded-wave","circular-wave","text-pulse","rounded-pulse","circular-pulse"].contains(entry["fixture"]["id"].string){
            configure(entry,doc:doc,mode:"light");var series:[[UInt8]]=[]
            for fraction in [0.0,0.04,0.08,0.12,0.18,0.3,0.5]{state.clock = .init(entrance:10,recurring:0.8*fraction);pump();series.append(bytes())}
            check(series.dropFirst().contains{$0 != series[0]},"\(entry["fixture"]["id"].string) recurring motion changes actual native pixels independently of entrance")
        }
    }
    static func lifecycle(){
        let doc=document("light"),entry=doc["results"].array.first{$0["fixture"]["id"].string=="text-wave"}!
        configure(entry,doc:doc,mode:"light");state.clock=nil;pump(0.15);let first=bytes();pump(0.15);check(bytes() != first,"Real animation clock changes painted frame")
        state.reduced=true;pump();let reduced=bytes();pump(0.12);check(bytes()==reduced,"Reduced preference settles entrance and recurring motion")
        state.properties["ariaLabelProp"]="Updated loading label";pump();check(control()?.accessibilityLabel()=="Updated loading label","Retained label update reaches native responder")
        state.properties["announce"]=false;pump();check(control()==nil,"Retained announce false removes native responder")
        state.properties["announce"]=true;pump();check(control() != nil,"Retained announce true restores native responder")
        state.properties["variant"]="circular";state.properties["width"]="48px";state.properties["height"]="32px";pump();check(node()?.bounds.size==CGSize(width:48,height:32),"Retained variant and dimension updates change real shape")
        state.properties["hidden"]=true;pump();check(node()==nil && control()==nil,"Retained hidden removes layout and semantics")
        state.properties["hidden"]=false;pump();check(node() != nil,"Unhide restores layout")
        state.reduced=false;state.clock = .init(entrance:10,recurring:0.2);pump();let normal=bytes();state.forced=true;pump();check(bytes() != normal,"Explicit forced-color semantic opt-in changes actual paint")
    }
    static func main(){
        contracts();let contractCount=checks;NSApplication.shared.setActivationPolicy(.accessory)
        host=NSHostingView(rootView:SkeletonFixture(state:state));host.appearance=NSAppearance(named:.aqua);window=NSWindow(contentRect:.init(x:-10000,y:-10000,width:400,height:400),styleMask:[.borderless],backing:.buffered,defer:false);window.isReleasedWhenClosed=false;window.contentView=host;window.colorSpace = .sRGB;window.orderFrontRegardless();pump()
        oracle();cornerPixels()
        if ProcessInfo.processInfo.environment["AWC_SKELETON_ORACLE_ONLY"] != "1"{motion();lifecycle()}
        print("Skeleton: \(checks-failures.count)/\(checks) checks passed (\(contractCount) source contracts, \(checks-contractCount) native).");window.close();if !failures.isEmpty{exit(1)}
    }
}
