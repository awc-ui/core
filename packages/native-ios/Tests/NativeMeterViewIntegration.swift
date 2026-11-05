import AppKit
import CoreText
import SwiftUI
import Observation
@testable import AWCUI

@Observable final class MeterFixtureState {
    var properties:[String:AWCValue]=[:]
    var appearance=AWCMeterAppearance()
    var dark=false
    var rtl=false
    var reduced=false
    var contrast=false
    var animate=false
    var density=0.0
    var width=240.0
    var tokens:[String:String]=[:]
    var nodes:[AWCNativeInspectionNode]=[]
    var epoch=0
}
struct MeterFixture:View {
    let state:MeterFixtureState
    var body:some View {
        let epoch=state.epoch,id="meter-\(epoch)"
        AWCNativeView(node:.init(id:id,tag:"md-meter",properties:state.properties))
            .awcMeterAppearance(state.appearance)
            .awcNativeInspection(rootID:id,coordinateSpace:"meter-fixture"){if state.epoch==epoch{state.nodes=$0}}
            .id(epoch).frame(width:state.width).frame(width:360,height:320).background(Color.white)
            .awcTheme(.generated(dark:state.dark,tokens:state.tokens)).environment(\.awcThemeTokens,state.tokens)
            .awcDensity(state.density).environment(\.layoutDirection,state.rtl ? .rightToLeft:.leftToRight)
            .environment(\.colorScheme,state.dark ? .dark:.light)
            .environment(\.awcMeterReducedMotion,state.reduced).environment(\.awcMeterIncreasedContrast,state.contrast)
            .transaction{$0.disablesAnimations = !state.animate}.coordinateSpace(name:"meter-fixture")
    }
}
@main @MainActor enum NativeMeterViewIntegration {
    static var checks=0,failures:[String]=[]
    static let state=MeterFixtureState()
    static var host:NSHostingView<MeterFixture>!,window:NSWindow!
    static var capturedPixelWidth=0,capturedScale=1.0
    static func check(_ value:Bool,_ message:String){checks += 1;if !value{failures.append(message);print("FAIL: "+message);fflush(stdout)}}
    static func near(_ a:Double,_ b:Double,_ tolerance:Double=0.02)->Bool{a.isFinite && abs(a-b)<tolerance}
    static func pump(_ seconds:Double=0.07){let end=Date().addingTimeInterval(seconds);while Date()<end{while let e=NSApp.nextEvent(matching:.any,until:Date(),inMode:.default,dequeue:true){NSApp.sendEvent(e)};host?.layoutSubtreeIfNeeded();host?.displayIfNeeded();_ = RunLoop.current.run(mode:.default,before:Date().addingTimeInterval(0.003))}}
    static func descendants(_ view:NSView)->[NSView]{[view]+view.subviews.flatMap(descendants)}
    static func meter()->AWCNativeMeterView?{descendants(host).compactMap{$0 as? AWCNativeMeterView}.last}
    static func node(_ id:String="component")->AWCNativeInspectionNode?{state.nodes.first{$0.id==id}}
    static func pixelData()->[UInt8]{
        let bitmap=host.bitmapImageRepForCachingDisplay(in:host.bounds)!;host.cacheDisplay(in:host.bounds,to:bitmap)
        let image=bitmap.cgImage!;var data=[UInt8](repeating:0,count:image.width*image.height*4)
        capturedPixelWidth=image.width;capturedScale=Double(image.width)/Double(host.bounds.width)
        data.withUnsafeMutableBytes{raw in let context=CGContext(data:raw.baseAddress,width:image.width,height:image.height,bitsPerComponent:8,bytesPerRow:image.width*4,space:CGColorSpace(name:CGColorSpace.sRGB)!,bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue)!;context.draw(image,in:.init(x:0,y:0,width:image.width,height:image.height))};return data
    }
    static func hits(_ bytes:[UInt8],_ rgb:[Double],tolerance:Double=3)->Int{stride(from:0,to:bytes.count,by:4).reduce(0){total,i in total+((0..<3).allSatisfy{abs(Double(bytes[i+$0])-rgb[$0])<=tolerance} ? 1:0)}}
    static func coloredHorizontalBounds(_ channel:Int)->(minimum:Double,maximum:Double)?{
        let bytes=pixelData(),pixelWidth=capturedPixelWidth,scale=capturedScale
        var minimum=pixelWidth,maximum = -1
        for i in stride(from:0,to:bytes.count,by:4) where bytes[i+channel]>160 && (0..<3).filter({$0 != channel}).allSatisfy({bytes[i+$0]<80}){
            let x=(i/4)%pixelWidth;minimum=min(minimum,x);maximum=max(maximum,x)
        }
        return maximum>=minimum ? (Double(minimum)/scale,Double(maximum+1)/scale):nil
    }
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

    static func appearance(_ style:[String:AWCValue])->AWCMeterAppearance{
        func length(_ key:String)->Double?{style[key].flatMap{numbers($0.string).first}}
        return .init(indicatorColor:style["indicatorColor"]?.string,trackColor:style["trackColor"]?.string,trackShape:style["trackShape"].map{corners($0.string)},height:length("height"),labelColor:style["labelColor"]?.string,valueColor:style["valueColor"]?.string,size:length("size"))
    }
    static func document(_ mode:String)->AWCValue{
        let path=URL(fileURLWithPath:#filePath).deletingLastPathComponent().appendingPathComponent("Fixtures/meter-web-\(mode).json")
        return try! JSONDecoder().decode(AWCValue.self,from:Data(contentsOf:path))
    }
    static func contracts(){
        let a=AWCMeterAppearance(indicatorColor:"#12345680",height:0,size:0).merging(.init(valueColor:"#abcdef"))
        check(a.indicatorColor=="#12345680" && a.valueColor=="#ABCDEF" && a.height==0 && a.size==0,"Sparse appearance inherits RGBA/zeros")
        check(AWCMeterAppearance(trackShape:.points(.nan),height:-1,size:.infinity) == .init(),"Invalid styles are rejected")
        let empty=AWCMeterReading(value:100,minimum:10,maximum:0),invalid=AWCMeterReading(value:.nan,minimum:.nan,maximum:.infinity)
        check(empty.minimum==10 && empty.maximum==10 && empty.value==10 && empty.fraction==0,"Inverted range collapses consistently")
        check(invalid.minimum==0 && invalid.maximum==100 && invalid.value==0,"Nonfinite reading inputs use source defaults")
        let extreme=AWCMeterReading(value:0,minimum:-Double.greatestFiniteMagnitude,maximum:Double.greatestFiniteMagnitude)
        check(extreme.fraction==0.5,"Extreme finite interval remains bounded without overflow")
        let reading=AWCMeterReading(value:30,minimum:0,maximum:80)
        check(AWCMeterFormatter.format(reading,locale:"en-US")=="38%","Omitted options format fraction percent")
        check(AWCMeterFormatter.format(reading,locale:"en-US",options:[:])=="30","An authored empty options object formats the raw reading")
        check(AWCMeterFormatter.format(reading,locale:"bad_locale")=="30","Invalid locale has source raw-number fallback")
        check(AWCMeterFormatter.format(reading,locale:"en-US",options:["style":"currency"])=="30","Invalid options have source raw-number fallback")
        check(AWCMeterFormatter.format(reading,locale:"en-US",valueText:"  reading  ")=="  reading  ","Value text overrides are not trimmed for accessibility")
        let formattingURL=URL(fileURLWithPath:#filePath).deletingLastPathComponent().appendingPathComponent("Fixtures/meter-formatting-reference.json")
        let formatting=try! JSONDecoder().decode(AWCValue.self,from:Data(contentsOf:formattingURL))
        for (index,entry) in formatting["cases"].array.enumerated(){
            let result=AWCMeterFormatter.format(.init(value:entry["value"].number!,minimum:-100000,maximum:100000),locale:entry["locale"].string,options:entry["options"].object)
            check(result==entry["expected"].string,"Independent V8 Intl case\(index) expected \(entry["expected"].string), got \(result)")
        }
        let intlURL=URL(fileURLWithPath:#filePath).deletingLastPathComponent().appendingPathComponent("Fixtures/meter-intl-reference.json")
        let intl=try! JSONDecoder().decode(AWCValue.self,from:Data(contentsOf:intlURL))
        for entry in intl["cases"].array{
            let value=entry["negativeZero"].bool==true ? -0.0:entry["value"].number!,hasOptions=entry["optionsPresent"].bool==true
            // The independent oracle supplies already-clamped values. Its only
            // omitted-options case needs the separately supplied fraction.
            let minimum=hasOptions ? -100000:value-entry["fraction"].number!*100
            let reading=AWCMeterReading(value:value,minimum:minimum,maximum:hasOptions ? 100000:minimum+100)
            let result=AWCMeterFormatter.format(reading,locale:entry["locale"].string,options:hasOptions ? entry["options"].object:nil,valueText:entry["valueText"].string)
            check(result==entry["expected"].string,"Independent Node22/ICU78 \(entry["id"].string) expected \(entry["expected"].string), got \(result)")
        }
        let zero=AWCMeterReading(value:0,minimum:-100),minusZero=AWCMeterReading(value:-0.0,minimum:-100)
        check(AWCMeterFormatter.format(zero,locale:"en-US",options:[:])=="0" && AWCMeterFormatter.format(minusZero,locale:"en-US",options:[:])=="-0","Formatter cache preserves positive/negative zero identity")
        let start=Date(timeIntervalSince1970:0),motion=AWCNativeMeterMotion(from:0,to:1,fromOpacity:0,toOpacity:1,start:start,duration:0.3,opacityDuration:0.2)
        check(motion.sample(start).fraction==0 && motion.sample(start).opacity==0,"Motion starts at current presentation state")
        check(near(motion.sample(start.addingTimeInterval(0.1)).opacity,0.5) && motion.sample(start.addingTimeInterval(0.1)).fraction>1/3,"Motion uses independent source linear opacity and eased geometry")
        check(motion.sample(start.addingTimeInterval(0.31)).fraction==1 && motion.sample(start.addingTimeInterval(0.31)).opacity==1,"Motion settles at exact final state")
        let text=AWCNativeMeterText(text:"  Day\n  view\u{00A0} ",size:14,lineHeight:20,weight:400,spacing:0.25,tabular:false)
        check(text.visible=="Day view\u{00A0}","Visible text collapses only ASCII CSS whitespace")
        let word=AWCNativeMeterText(text:"Supercalifragilisticexpialidocious",size:14,lineHeight:20,weight:400,spacing:0.25,tabular:false)
        check(word.lines(width:40,wrap:true).count==1 && word.sizeThatFits(40,wrap:true).height==20,"Normal wrapping does not emergency-break an unbroken caption")
        check(CTLineGetStringRange(word.lines(width:40,wrap:false,ellipsize:false)[0]).length==word.visible.utf16.count,"Nonshrinking value text never acquires header-label ellipsis")
        let huge=AWCNativeMeterMetrics(properties:["variant":"circular","thickness":.number(.greatestFiniteMagnitude)],appearance:.init(height:.greatestFiniteMagnitude,size:.greatestFiniteMagnitude),density:0,tokens:[:])
        check(huge.size==AWCNativeMeterMetrics.maximumUsedLength && huge.height==AWCNativeMeterMetrics.maximumUsedLength,"Extreme accepted dimensions use bounded CSS geometry")
        check(huge.stroke.isFinite && huge.radius.isFinite && huge.centerText.size.isFinite && huge.centerText.size==0.26*huge.size,"Stroke/font math uses the effective viewport and cannot overflow")
        for entry in document("light")["results"].array{
            let p=entry["fixture"].object,m=AWCNativeMeterMetrics(properties:p,appearance:appearance(p["style"]?.object ?? [:]),density:p["inheritedDensity"]?.number ?? 0,tokens:document("light")["tokens"].object.mapValues(\.string))
            check(m.text==entry["host"]["attributes"]["aria-valuetext"].string,"\(p["id"]!.string) public formatter matches browser text \(m.text)")
        }
    }
    static func oracle(defaultPalette:Bool=false){ // R2-D1/R2-D3: the default-palette pass injects no tokens
        for mode in ["light","dark"] {
            let doc=document(defaultPalette ? "default-"+mode:mode);state.tokens=defaultPalette ? [:]:doc["tokens"].object.mapValues(\.string);state.dark=mode=="dark"
            for entry in doc["results"].array {
                let f=entry["fixture"],id=(defaultPalette ? "default-":"")+mode+"/"+f["id"].string
                if let selected=ProcessInfo.processInfo.environment["AWC_METER_CASES"],!selected.split(separator:",").contains(Substring(f["id"].string)){continue}
                var props=f.object;for key in ["id","width","style","inheritedDensity","theme"]{props[key]=nil}
                state.epoch += 1;state.properties=props;state.appearance=appearance(f["style"].object);state.density=f["inheritedDensity"].number ?? 0;state.width=f["width"].number ?? 240;state.rtl=f["dir"].string=="rtl";state.nodes=[]
                state.tokens=(defaultPalette ? [:]:doc["tokens"].object.mapValues(\.string)).merging(f["theme"].object.mapValues(\.string)){_,new in new};pump()
                if f["hidden"].bool==true{check(node()==nil && meter()==nil,"\(id) hidden omits actual layout/semantics");continue}
                guard let root=node(),let control=meter() else{check(false,"\(id) root/semantics missing");continue}
                let web=entry["host"],attrs=web["attributes"]
                check(near(root.bounds.width,web["width"].number!,0.8) && near(root.bounds.height,web["height"].number!,0.05),"\(id) root\(root.bounds.size) expected\(web["width"].string)×\(web["height"].string)")
                check(control.accessibilityRole() == .levelIndicator && control.accessibilityLabel()==(attrs["aria-label"].string.isEmpty ? nil:attrs["aria-label"].string),"\(id) real named meter role")
                check(control.reading.value==Double(attrs["aria-valuenow"].string) && control.reading.minimum==Double(attrs["aria-valuemin"].string) && control.reading.maximum==Double(attrs["aria-valuemax"].string),"\(id) accessible bounded range")
                check(control.accessibilityValueDescription()==attrs["aria-valuetext"].string && !control.canBecomeKeyView,"\(id) formatted accessible value is noninteractive")
                let bytes=pixelData()
                for part in entry["parts"].array {
                    let name=part["part"].string
                    if f["id"].string=="custom-zero-size" && ["track","indicator"].contains(name){check(node("component."+name)==nil,"\(id) no fictitious SVG residual path when viewport zero");continue}
                    guard let actual=node("component."+name) else{check(false,"\(id) missing part\(name)");continue}
                    let text=["label","value"].contains(name),tolerance=text ? 0.8:0.03
                    check(near(actual.bounds.width,part["width"].number!,tolerance) && near(actual.bounds.height,part["height"].number!,0.05),"\(id) \(name) size\(actual.bounds.size) expected\(part["width"].string)×\(part["height"].string)")
                    check(near(actual.bounds.minX-root.bounds.minX,part["x"].number!,text || f["variant"].string=="circular" ? 0.8:0.03) && near(actual.bounds.minY-root.bounds.minY,part["y"].number!,text ? 0.8:0.03),"\(id) \(name) origin\(actual.bounds.minX-root.bounds.minX),\(actual.bounds.minY-root.bounds.minY) expected\(part["x"].string),\(part["y"].string)")
                    if text {check(near(actual.metrics["typography"]?["size"].number ?? -1,numbers(part["fontSize"].string).first ?? 0) && near(actual.metrics["typography"]?["lineHeight"].number ?? -1,numbers(part["lineHeight"].string).first ?? 0),"\(id) \(name) actual line box typography")}
                }
                if root.bounds.width>0 && root.bounds.height>0 {
                    let track=entry["parts"].array.first{$0["part"].string=="track"}!,indicator=entry["parts"].array.first{$0["part"].string=="indicator"}!,circular=f["variant"].string=="circular"
                    let background=composite(track[circular ? "stroke":"fill"].string,over:[255,255,255])
                    let foreground=composite(indicator[circular ? "stroke":"fill"].string,over:background)
                    if control.reading.fraction>0 && (f["thickness"].number ?? 4)<24 && (circular || node("component.track")!.bounds.height>0) {check(hits(bytes,foreground)>2,"\(id) actual indicator RGBA/theme paint")}
                }
            }
        }
    }
    static func transitions(){
        state.epoch += 1;state.dark=false;state.tokens=[:];state.width=240;state.rtl=false;state.density=0;state.appearance = .init();state.properties=["value":20,"showLabel":true,"showValue":true,"label":"Storage","locale":"en-US"];state.nodes=[];pump()
        state.animate=true;pump();let before=pixelData();state.properties["value"]=80;pump(0.08);let middle=pixelData();pump(0.35);let after=pixelData();check(before != middle && middle != after,"Linear fill performs actual timed interpolation")
        check(near(Double(node("component.indicator")?.bounds.width ?? -1),192),"Animated fill settles at exact bounded value")
        state.reduced=true;state.properties["value"]=10;pump();check(near(Double(node("component.indicator")?.bounds.width ?? -1),24),"Reduced motion commits immediately")
        state.properties["variant"]="circular";pump();state.reduced=false;state.properties["value"]=90;pump(0.07);let arc=pixelData();pump(0.35);check(arc != pixelData(),"Circular dash/opacity interpolation changes actual pixels")
        state.properties["valueText"]="A / ٣٨٪؜";pump();let ltrText=pixelData();state.rtl=true;pump();check(ltrText != pixelData(),"Circular mixed-direction value inherits actual RTL text ordering")
        state.contrast=true;pump();check(hits(pixelData(),[103,80,164])==0,"Native increased contrast overrides theme fill")
        state.properties["hidden"]=true;pump();check(node()==nil && meter()==nil,"Hidden transition clears retained inspector and semantic control")
    }
    static func overflow(){
        let url=URL(fileURLWithPath:#filePath).deletingLastPathComponent().appendingPathComponent("Fixtures/meter-web-overflow.json")
        let reference=try! JSONDecoder().decode(AWCValue.self,from:Data(contentsOf:url))
        for entry in reference["results"].array{
            let f=entry["fixture"],id=f["id"].string
            state.epoch += 1;state.nodes=[];state.tokens=[:];state.dark=false;state.width=300;state.density=0;state.reduced=true;state.contrast=false;state.animate=false;state.rtl=f["dir"].string=="rtl"
            state.properties=f.object;state.properties["variant"]="circular";state.properties["showValue"]=true;state.properties["value"]=75
            state.appearance = .init(indicatorColor:"#FFFFFF",trackColor:"#FFFFFF",labelColor:"#FF0000",valueColor:"#0000FF");pump()
            guard let root=node() else{check(false,"\(id) overflow root exists");continue}
            check(near(root.bounds.width,entry["host"]["width"].number!) && near(root.bounds.height,entry["host"]["height"].number!),"\(id) overflow retains actual source layout box")
            for name in ["label","value"]{
                guard let part=entry["parts"].array.first(where:{$0["name"].string==name}),let actual=node("component."+name),let expected=part["textBoxes"].array.last else{continue}
                let model=AWCNativeMeterMetrics(properties:state.properties,appearance:state.appearance,density:0,tokens:AWCTheme.generated().tokens)
                let text=name=="label" ? model.labelText:model.centerText
                check(near(text.naturalWidth,expected["width"].number!,0.4),"\(id) \(name) actual unbroken glyph advance matches browser")
                check(near(actual.bounds.width,part["box"]["width"].number!,0.03) && near(actual.bounds.minX-root.bounds.minX,part["box"]["x"].number!,0.03),"\(id) \(name) layout retains measured part box")
                guard let pixels=coloredHorizontalBounds(name=="label" ? 0:2) else{check(false,"\(id) \(name) has actual colored text");continue}
                let expectedStart=root.bounds.minX+expected["x"].number!,expectedEnd=expectedStart+expected["width"].number!
                check(near(pixels.minimum,expectedStart,2) && near(pixels.maximum,expectedEnd,2.5),"\(id) \(name) actual overflow ink \(pixels.minimum-root.bounds.minX)…\(pixels.maximum-root.bounds.minX) follows browser \(expected["x"].string)…\(expectedEnd-root.bounds.minX)")
            }
        }
    }
    static func clockwisePixels(){
        var captures:[[UInt8]]=[]
        for rtl in [false,true]{
            state.epoch += 1;state.nodes=[];state.tokens=[:];state.dark=false;state.width=240;state.density=0;state.reduced=true;state.contrast=false;state.animate=false;state.rtl=rtl
            state.properties=["variant":"circular","value":25,"showLabel":false,"showValue":false,"thickness":8]
            state.appearance = .init(indicatorColor:"#00FF00",trackColor:"#FF0000",size:72);pump()
            let bytes=pixelData();captures.append(bytes)
            guard let root=node() else{check(false,"Quarter arc root exists");continue}
            let center=root.bounds.midX*capturedScale
            var left=0,right=0
            for i in stride(from:0,to:bytes.count,by:4) where bytes[i+1]>220 && bytes[i]<30 && bytes[i+2]<30{
                let x=Double((i/4)%capturedPixelWidth)
                // Ignore the round cap straddling 12 o'clock; compare the
                // asymmetric arc body beyond one full applied stroke width.
                if x<center-12*capturedScale{left += 1}
                if x>center+12*capturedScale{right += 1}
            }
            check(right>40 && left<10,"Quarter arc is clockwise on the right in \(rtl ? "RTL":"LTR"), actual pixels left\(left)/right\(right)")
        }
        check(captures[0]==captures[1],"Direction alone cannot mirror circular indicator paint")
    }
    static func main(){
        contracts();let contractChecks=checks;NSApplication.shared.setActivationPolicy(.accessory)
        host=NSHostingView(rootView:MeterFixture(state:state));window=NSWindow(contentRect:.init(x:-10000,y:-10000,width:360,height:320),styleMask:[.borderless],backing:.buffered,defer:false);window.isReleasedWhenClosed=false;window.contentView=host;window.colorSpace = .sRGB;window.orderFrontRegardless();pump()
        oracle();oracle(defaultPalette:true);transitions();overflow();clockwisePixels();let configurations=document("light")["results"].array.count+document("dark")["results"].array.count
        print("Meter: \(checks-failures.count)/\(checks) checks passed (\(contractChecks) contracts, \(checks-contractChecks) native) against\(configurations) Web configurations.");window.close();if !failures.isEmpty{exit(1)}
    }
}
