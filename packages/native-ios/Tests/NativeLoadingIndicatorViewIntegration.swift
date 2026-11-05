import AppKit
import SwiftUI
import Observation
@testable import AWCUI

@Observable final class LoadingFixtureState {
    var properties:[String:AWCValue]=[:]
    var appearance=AWCLoadingIndicatorAppearance()
    var part=AWCLoadingIndicatorShapeAppearance()
    var dark=false
    var rtl=false
    var density=0.0
    var reduced=false
    var contrast=false
    var phase:Double?=0
    var tokens:[String:String]=[:]
    var nodes:[AWCNativeInspectionNode]=[]
    var epoch=0
}
struct LoadingFixture:View {
    let state:LoadingFixtureState
    var body:some View{
        let epoch=state.epoch,id="loading-\(epoch)"
        AWCNativeView(node:.init(id:id,tag:"md-loading-indicator",properties:state.properties))
            .awcLoadingIndicatorAppearance(state.appearance).awcLoadingIndicatorShapeAppearance(state.part)
            .awcNativeInspection(rootID:id,coordinateSpace:"loading-fixture"){if state.epoch==epoch{state.nodes=$0}}
            .id(epoch).frame(width:200,height:180).background(Color.white)
            .awcTheme(.generated(dark:state.dark,tokens:state.tokens)).environment(\.awcThemeTokens,state.tokens)
            .awcDensity(state.density).environment(\.layoutDirection,state.rtl ? .rightToLeft:.leftToRight)
            .environment(\.colorScheme,state.dark ? .dark:.light).environment(\.awcLoadingIncreasedContrast,state.contrast)
            .environment(\.awcLoadingReducedMotion,state.reduced).environment(\.awcLoadingIndicatorPhase,state.phase)
            .transaction{$0.disablesAnimations=true}.coordinateSpace(name:"loading-fixture")
    }
}
@main @MainActor enum NativeLoadingIndicatorViewIntegration {
    static var checks=0,failures:[String]=[]
    static let state=LoadingFixtureState()
    static var host:NSHostingView<LoadingFixture>!,window:NSWindow!
    static func check(_ value:Bool,_ message:String){checks += 1;if !value{failures.append(message);print("FAIL: "+message);fflush(stdout)}}
    static func near(_ a:Double,_ b:Double,_ tolerance:Double=0.02)->Bool{a.isFinite && abs(a-b)<tolerance}
    static func pump(_ seconds:Double=0.07){let end=Date().addingTimeInterval(seconds);while Date()<end{while let e=NSApp.nextEvent(matching:.any,until:Date(),inMode:.default,dequeue:true){NSApp.sendEvent(e)};host?.layoutSubtreeIfNeeded();host?.displayIfNeeded();_ = RunLoop.current.run(mode:.default,before:Date().addingTimeInterval(0.003))}}
    static func descendants(_ view:NSView)->[NSView]{[view]+view.subviews.flatMap(descendants)}
    static func progress()->AWCNativeProgressView?{descendants(host).compactMap{$0 as? AWCNativeProgressView}.last}
    static func node(_ id:String="component")->AWCNativeInspectionNode?{state.nodes.first{$0.id==id}}
    static func pixelData()->[UInt8]{
        let bitmap=host.bitmapImageRepForCachingDisplay(in:host.bounds)!;host.cacheDisplay(in:host.bounds,to:bitmap)
        let image=bitmap.cgImage!;var data=[UInt8](repeating:0,count:image.width*image.height*4)
        data.withUnsafeMutableBytes{raw in let context=CGContext(data:raw.baseAddress,width:image.width,height:image.height,bitsPerComponent:8,bytesPerRow:image.width*4,space:CGColorSpace(name:CGColorSpace.sRGB)!,bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue)!;context.draw(image,in:.init(x:0,y:0,width:image.width,height:image.height))};return data
    }
    static func hits(_ bytes:[UInt8],_ rgb:[Double],tolerance:Double=3)->Int{stride(from:0,to:bytes.count,by:4).reduce(0){total,i in total+((0..<3).allSatisfy{abs(Double(bytes[i+$0])-rgb[$0])<=tolerance} ? 1:0)}}
    static func numbers(_ text:String)->[Double]{
        let pattern="[-+]?(?:[0-9]*\\.)?[0-9]+(?:[eE][-+]?[0-9]+)?",regex=try! NSRegularExpression(pattern:pattern)
        return regex.matches(in:text,range:NSRange(text.startIndex...,in:text)).compactMap{Range($0.range,in:text).flatMap{Double(text[$0])}}
    }
    static func composite(_ css:String,over background:[Double])->[Double]{let n=numbers(css);guard n.count>=3 else{return background};let alpha=n.count>3 ? n[3]:1;return (0..<3).map{n[$0]*alpha+background[$0]*(1-alpha)}}
    static func corners(_ css:String)->AWCCornerShape{
        func lengths(_ raw:String)->[AWCCornerLength]{
            let values=raw.split(whereSeparator:{$0.isWhitespace}).map{v -> AWCCornerLength in let n=numbers(String(v)).first ?? 0;return v.hasSuffix("%") ? .fraction(n/100):.points(n)}
            switch values.count{case 1:return Array(repeating:values[0],count:4);case 2:return[values[0],values[1],values[0],values[1]];case 3:return[values[0],values[1],values[2],values[1]];case 4:return values;default:return Array(repeating:.init(),count:4)}
        }
        let axes=css.split(separator:"/",omittingEmptySubsequences:false),x=lengths(String(axes.first ?? "0")),y=axes.count>1 ? lengths(String(axes[1])):x
        let r=(0..<4).map{AWCCornerRadius(x:x[$0],y:y[$0])};return .init(topLeft:r[0],topRight:r[1],bottomRight:r[2],bottomLeft:r[3])
    }
    static func appearance(_ style:[String:AWCValue])->AWCLoadingIndicatorAppearance{
        func length(_ key:String)->Double?{style[key].flatMap{numbers($0.string).first}}
        return .init(color:style["color"]?.string,size:length("size"),shapeSize:length("shapeSize"),containerColor:style["containerColor"]?.string,containerShape:style["containerShape"].map{corners($0.string)})
    }
    static func document(_ theme:String)->AWCValue{
        let path=URL(fileURLWithPath:#filePath).deletingLastPathComponent().appendingPathComponent("Fixtures/loading-indicator-web-\(theme).json")
        return try! JSONDecoder().decode(AWCValue.self,from:Data(contentsOf:path))
    }
    static func contracts(){
        let invalid=AWCLoadingIndicatorAppearance(color:"#abcd",size:-1,shapeSize:.nan,containerShape:.points(.infinity))
        check(invalid.color==nil && invalid.size==nil && invalid.shapeSize==nil && invalid.containerShape==nil,"Typed appearance rejects malformed colors/nonfinite lengths/corners")
        let merged=AWCLoadingIndicatorAppearance(color:"#12345680",size:24).merging(.init(shapeSize:80))
        check(merged.color=="#12345680" && merged.size==24 && merged.shapeSize==80,"RGBA and sparse inheritance retain authored zero/size semantics")
        let parsed=AWCCornerShape(values:["topLeft":["x":["points":-2,"fraction":0.5],"y":["fraction":0.25]]])!
        let resolved=parsed.radii(in:.init(width:48,height:48))
        check(resolved[0]==CGSize(width:22,height:12) && resolved[1] == .zero,"Structured signed points/percent coefficients and missing fields resolve truthfully")
        check(AWCCornerShape(values:["topLeft":["x":["points":"bad"]]])==nil,"Invalid nested radius is rejected instead of inventing dimensions")
        let huge=AWCCornerShape(.init(.init(points:Double.greatestFiniteMagnitude,fraction:Double.greatestFiniteMagnitude))).radii(in:.init(width:48,height:24))
        check(huge.allSatisfy{$0.width.isFinite && $0.height.isFinite} && near(huge[0].height,12,0.000001),"Finite extreme coefficients normalize without overflow or NaN")
        let cancellation=AWCCornerShape(.init(.init(points:Double.greatestFiniteMagnitude,fraction:-Double.greatestFiniteMagnitude))).radii(in:.init(width:1,height:1))
        check(cancellation.allSatisfy{$0  == .zero},"Extreme opposite-sign terms retain exact cancellation")
        let over=AWCCornerShape.fraction(1.5).radii(in:.init(width:48,height:24))
        check(over.allSatisfy{$0==CGSize(width:24,height:12)},"All CSS radii share proportional overlap scaling")
        let anisotropic=corners("2px 12px 20px 5px / 3px 7px 9px 2px").radii(in:.init(width:48,height:48))
        check(anisotropic==[CGSize(width:2,height:3),CGSize(width:12,height:7),CGSize(width:20,height:9),CGSize(width:5,height:2)],"Physical asymmetric elliptical radii remain independent")
        for animation in document("light")["animations"].array {
            check(animation["duration"].number==AWCNativeLoadingMotion.duration*1000,"Exact source4550ms morph duration")
            for (index,frame) in animation["keyframes"].array.enumerated(){
                check(near(frame["offset"].number!,AWCNativeLoadingMotion.offsets[index],0.000000001),"Source rounded keyframe offset\(index)")
                let xy=numbers(frame["clipPath"].string),polygon=AWCNativeLoadingMotion.polygons[index]
                check(xy.count==96 && polygon.count==48,"Source polygon\(index) retains48 corresponding vertices")
                for i in polygon.indices {check(near(polygon[i].x,xy[i*2]/100,0.0000001) && near(polygon[i].y,xy[i*2+1]/100,0.0000001),"Keyframe\(index) vertex\(i) matches source")}
            }
            for source in animation["samples"].array {
                let fraction=source["fraction"].number!,sample=AWCNativeLoadingMotion.sample(fraction),xy=numbers(source["clipPath"].string)
                for i in sample.points.indices{check(near(sample.points[i].x,xy[i*2]/100,0.00002) && near(sample.points[i].y,xy[i*2+1]/100,0.00002),"Paused\(fraction) actual cubic interpolation vertex\(i)")}
                let matrix=numbers(source["transform"].string),r=sample.rotation*Double.pi/180
                check(near(cos(r),matrix[0],0.00001) && near(sin(r),matrix[1],0.00001),"Paused\(fraction) exact source rotation matrix")
            }
        }
        check(near(AWCNativeLoadingMotion.sample(0.5,reducedMotion:true).opacity,0.4,0.000001) && near(AWCNativeLoadingMotion.sample(1,reducedMotion:true).opacity,1,0.000001),"Reduced motion circle pulse keeps source1→.4→1 endpoints")
        let last=AWCNativeLoadingMotion.sample(0.999999),first=AWCNativeLoadingMotion.sample(0)
        check(zip(last.points,first.points).allSatisfy{near($0.x,$1.x,0.00001) && near($0.y,$1.y,0.00001)} && near(cos(last.rotation*Double.pi/180),1,0.00001),"Morph loop restarts without orientation/vertex jump")
    }
    static func oracle(defaultPalette:Bool=false){ // R2-D1/R2-D2: the default-palette pass injects no tokens
        for mode in ["light","dark"]{
            let doc=document(defaultPalette ? "default-"+mode:mode);state.tokens=defaultPalette ? [:]:doc["tokens"].object.mapValues(\.string);state.dark=mode=="dark"
            for entry in doc["results"].array{
                let f=entry["fixture"],id=(defaultPalette ? "default-":"")+mode+"/"+f["id"].string
                var properties=f.object;for key in ["id","style","part","inheritedDensity"]{properties[key]=nil}
                state.epoch += 1;state.properties=properties;state.appearance=appearance(f["style"].object);state.part=f["part"].bool==true ? .init(width:20,height:30,color:"#00FF0080"):.init()
                state.density=f["inheritedDensity"].number ?? 0;state.rtl=f["dir"].string=="rtl";state.reduced=false;state.contrast=false;state.phase=0;state.nodes=[]
                _ = window.makeFirstResponder(nil);pump()
                if f["hidden"].bool==true{check(node()==nil && progress()==nil,"\(id) hidden removes geometry and native accessible control");continue}
                guard let root=node(),let shape=node("component.shape") else{check(false,"\(id) real root/shape inspection missing");continue}
                let web=entry["host"],part=entry["shape"]
                check(near(root.bounds.width,web["width"].number!) && near(root.bounds.height,web["height"].number!),"\(id) actual root geometry")
                check(near(shape.bounds.width,part["width"].number!) && near(shape.bounds.height,part["height"].number!),"\(id) actual flex-shrunk shape geometry \(shape.bounds.size)")
                check(near(shape.bounds.minX-root.bounds.minX,part["x"].number!) && near(shape.bounds.minY-root.bounds.minY,part["y"].number!),"\(id) actual centered/clipped part position")
                check(root.metrics["typography"]==nil,"\(id) no visible-text metrics invented")
                check(progress()?.accessibilityRole() == .progressIndicator && progress()?.accessibilityLabel()==web["label"].string,"\(id) named native progressbar semantics preserve raw label")
                check(progress()?.canBecomeKeyView==false && progress()?.accessibilityValue()==nil,"\(id) indeterminate nonsequential progress state")
                let bytes=pixelData(),background=composite(web["fill"].string,over:[255,255,255]),foreground=composite(part["fill"].string,over:background)
                if root.bounds.width>0 && shape.bounds.width>0 && shape.bounds.height>0{check(hits(bytes,foreground)>5,"\(id) actual native shape paint including alpha/theme")}
                if f["variant"].string=="contained" && root.bounds.width>0{check(hits(bytes,background)>5,"\(id) actual contained surface paint including alpha/theme")}
            }
        }
    }
    static func transitions(){
        state.epoch += 1;state.properties=["variant":"contained","label":"Working"];state.appearance = .init(color:"#123456",size:80,containerColor:"#FEDCBA",containerShape:.points(0));state.part = .init();state.dark=false;state.tokens=[:];state.density=0;state.phase=0;state.nodes=[];pump()
        let before=pixelData();state.phase=0.25;pump();check(pixelData() != before,"Paused phase changes actual polygon and rotation pixels")
        state.phase=nil;pump(0.08);let animated=pixelData();pump(0.16);check(pixelData() != animated,"Real TimelineView progresses without explicit frame-property edits")
        state.reduced=true;state.phase=0;pump();let bright=pixelData();check(hits(bright,[18,52,86])>100,"Reduced motion paints circle at full opacity")
        state.phase=0.5;pump();let dim=pixelData();let expected=[18.0,52,86].enumerated().map{$0.element*0.4+[254.0,220,186][$0.offset]*0.6}
        check(hits(dim,expected)>100 && dim != bright,"Reduced motion actual pulse alpha matches source endpoint")
        state.phase=0;state.contrast=true;pump()
        let semantic=NSColor.labelColor.usingColorSpace(.sRGB)!,alpha=Double(semantic.alphaComponent)
        let contrastForeground=[semantic.redComponent,semantic.greenComponent,semantic.blueComponent].map{Double($0)*255*alpha+255*(1-alpha)}
        check(hits(pixelData(),contrastForeground)>100 && hits(pixelData(),[18,52,86])==0,"Increased native contrast substitutes semantic foreground/surface")
        state.contrast=false;state.appearance = .init(color:"#123456",shapeSize:0,containerColor:"#FEDCBA",containerShape:.fraction(0.25));pump()
        let unfocused=pixelData()
        progress()?.setAccessibilityFocused(true);pump();check(progress()?.isAccessibilityFocused()==true,"Native assistive programmatic focus is real")
        check(pixelData() != unfocused,"Programmatic visible focus paints a real external ring")
        state.properties["hidden"]=true;pump();check(node()==nil && progress()==nil,"Hiding active animation removes inspection and progress responder")
        state.properties["hidden"]=false;state.reduced=false;state.phase=0;state.appearance = .init(size:0);pump();check(node()?.bounds.size == .zero && node("component.shape")?.bounds.size == .zero,"Zero-sized component retains truthful zero measurements")
    }
    static func main(){
        contracts();let contractChecks=checks;NSApplication.shared.setActivationPolicy(.accessory);host=NSHostingView(rootView:LoadingFixture(state:state));window=NSWindow(contentRect:.init(x:-10000,y:-10000,width:200,height:180),styleMask:[.borderless],backing:.buffered,defer:false);window.isReleasedWhenClosed=false;window.contentView=host;window.colorSpace = .sRGB;window.orderFrontRegardless();pump()
        oracle();oracle(defaultPalette:true);transitions();print("LoadingIndicator: \(checks-failures.count)/\(checks) checks passed (\(contractChecks) source contracts, \(checks-contractChecks) actual native checks) against 84 Web configurations and 16 paused animation samples.");window.close();if !failures.isEmpty{exit(1)}
    }
}
