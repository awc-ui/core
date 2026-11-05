import SwiftUI

struct AWCNativeMeterMetrics {
    // The measured browser saturates used CSS lengths before layout. SwiftUI
    // otherwise converts a finite Double.max frame to Float infinity and AppKit
    // rejects its intrinsic size. Bound resolved geometry consistently, keeping
    // the authored public appearance value intact.
    static let maximumUsedLength=16_777_214.0
    let reading:AWCMeterReading,text:String,label:String,circular:Bool,showLabel:Bool,showValue:Bool
    let height:Double,size:Double,userSize:Double,stroke:Double,radius:Double,gap:Double,headerGap:Double
    let trackShape:AWCCornerShape,indicatorColor:String,trackColor:String,labelColor:String,valueColor:String
    let labelText:AWCNativeMeterText,valueText:AWCNativeMeterText,centerText:AWCNativeMeterText
    init(properties:[String:AWCValue],appearance:AWCMeterAppearance,density:Double,tokens:[String:String]){
        func numeric(_ key:String,_ fallback:Double)->Double{let n=properties[key]?.number ?? fallback;return n.isFinite ? n:fallback}
        reading = .init(value:properties["value"]?.number ?? 0,minimum:properties["min"]?.number ?? 0,maximum:properties["max"]?.number ?? 100)
        let options:[String:AWCValue]?;if case .object(let value)=properties["formatOptions"]{options=value}else{options=nil}
        text=AWCMeterFormatter.format(reading,locale:properties["locale"]?.string ?? "",options:options,valueText:properties["valueText"]?.string ?? "")
        label=properties["label"]?.string ?? "";circular=properties["variant"]?.string=="circular";showLabel=properties["showLabel"]?.bool==true;showValue=properties["showValue"]?.bool==true
        let d=AWCNativeDensity.resolve(properties["density"]?.number,inherited:density),thickness=numeric("thickness",4),requestedSize=numeric("size",48)
        userSize=min(240,max(24,requestedSize>0 ? requestedSize:48));size=min(Self.maximumUsedLength,appearance.size ?? max(24,userSize+2*d))
        height=min(Self.maximumUsedLength,appearance.height ?? max(2,thickness+0.5*d))
        // Beyond four viewport diameters the clipped stroke already covers the
        // entire viewport. Saturating before multiplication preserves that paint
        // while avoiding an overflowing stroke width or unbounded raster extent.
        stroke=min(thickness>0 ? thickness:4,4*userSize)*(size/userSize)
        radius=max(0.5,(userSize-(thickness>0 ? thickness:4))/2)*size/userSize
        gap=min(Self.maximumUsedLength,max(2,4+0.5*d));headerGap=min(Self.maximumUsedLength,awcFabMenuToken(tokens,"--md-sys-spacing-gap-sm",8))
        let token=tokens["--md-sys-shape-corner-full"] ?? "9999px",number=Double(token.replacingOccurrences(of:"px",with:"").replacingOccurrences(of:"%",with:"")) ?? 9999
        trackShape=appearance.trackShape ?? (token.hasSuffix("%") ? .fraction(number/100):.points(number))
        let role=properties["color"]?.string ?? "primary"
        let valid=role != "primary" && role.range(of:"^[a-z][a-z0-9-]*$",options:[.regularExpression,.caseInsensitive]) != nil
        indicatorColor=appearance.indicatorColor ?? (valid ? tokens["--md-sys-color-"+role]:nil) ?? tokens["--md-sys-color-primary"] ?? "#6750A4"
        trackColor=appearance.trackColor ?? (valid ? tokens["--md-sys-color-"+role+"-container"]:nil) ?? tokens["--md-sys-color-secondary-container"] ?? "#E8DEF8"
        labelColor=appearance.labelColor ?? tokens["--md-sys-color-on-surface"] ?? "#1C1B1F"
        valueColor=appearance.valueColor ?? tokens["--md-sys-color-on-surface-variant"] ?? "#49454F"
        let labelWeight=awcFabMenuToken(tokens,"--md-sys-typescale-body-medium-font-weight",400),valueWeight=awcFabMenuToken(tokens,"--md-sys-typescale-label-medium-font-weight",500)
        labelText = .init(text:label,size:min(Self.maximumUsedLength,max(11,14+0.5*d)),lineHeight:min(Self.maximumUsedLength,max(14,20+d)),weight:labelWeight,spacing:awcFabMenuToken(tokens,"--md-sys-typescale-body-medium-letter-spacing",0.25),tabular:false)
        valueText = .init(text:text,size:min(Self.maximumUsedLength,max(10,12+0.5*d)),lineHeight:min(Self.maximumUsedLength,max(12,16+d)),weight:valueWeight,spacing:awcFabMenuToken(tokens,"--md-sys-typescale-label-medium-letter-spacing",0.5),tabular:true)
        centerText = .init(text:text,size:size*0.26,lineHeight:size*0.26,weight:valueWeight,spacing:0,tabular:true)
    }
}
private struct AWCMeterHeaderLayout:Layout {
    let label:Bool,value:Bool,gap:Double
    private func sizes(_ width:CGFloat?,_ subviews:Subviews)->[CGSize]{
        var result=subviews.map{$0.sizeThatFits(.unspecified)}
        if label,let width,!result.isEmpty{let valueWidth=value ? result.last!.width:0;result[0]=subviews[0].sizeThatFits(.init(width:max(0,width-valueWidth-(value ? gap:0)),height:nil))}
        return result
    }
    func sizeThatFits(proposal:ProposedViewSize,subviews:Subviews,cache:inout())->CGSize{
        let sizes=sizes(proposal.width,subviews),baseline=subviews.indices.map{subviews[$0].dimensions(in:.init(sizes[$0]))[.firstTextBaseline]}.max() ?? 0
        let bottom=subviews.indices.map{sizes[$0].height-subviews[$0].dimensions(in:.init(sizes[$0]))[.firstTextBaseline]}.max() ?? 0
        return .init(width:proposal.width ?? sizes.reduce(0){$0+$1.width}+(sizes.count>1 ? gap:0),height:max(0,baseline+bottom))
    }
    func placeSubviews(in bounds:CGRect,proposal:ProposedViewSize,subviews:Subviews,cache:inout()){
        let sizes=sizes(bounds.width,subviews),baseline=subviews.indices.map{subviews[$0].dimensions(in:.init(sizes[$0]))[.firstTextBaseline]}.max() ?? 0
        for i in subviews.indices{let x=i==1 ? max(bounds.minX+sizes[0].width+gap,bounds.maxX-sizes[i].width):bounds.minX,y=bounds.minY+baseline-subviews[i].dimensions(in:.init(sizes[i]))[.firstTextBaseline];subviews[i].place(at:.init(x:x,y:y),proposal:.init(sizes[i]))}
    }
}
private struct AWCMeterColumnLayout:Layout {
    let circular:Bool,gap:Double,caption:Bool,size:Double
    private func sizes(_ width:CGFloat?,_ subviews:Subviews)->[CGSize]{subviews.enumerated().map{index,view in view.sizeThatFits(.init(width:circular ? (caption && index>0 ? size*2:nil):width,height:nil))}}
    func sizeThatFits(proposal:ProposedViewSize,subviews:Subviews,cache:inout())->CGSize{
        let sizes=sizes(proposal.width,subviews)
        return .init(width:circular ? sizes.map(\.width).max() ?? 0:proposal.width ?? sizes.map(\.width).max() ?? 0,height:sizes.reduce(0){$0+$1.height}+gap*Double(max(0,sizes.count-1)))
    }
    func placeSubviews(in bounds:CGRect,proposal:ProposedViewSize,subviews:Subviews,cache:inout()){
        let sizes=sizes(bounds.width,subviews);var y=bounds.minY
        for i in subviews.indices{subviews[i].place(at:.init(x:circular ? bounds.midX-sizes[i].width/2:bounds.minX,y:y),proposal:.init(sizes[i]));y += sizes[i].height+gap}
    }
}
private struct AWCMeterArc:Shape {
    var fraction:Double
    var animatableData:Double{get{fraction}set{fraction=newValue}}
    func path(in rect:CGRect)->Path{var path=Path();path.addArc(center:.init(x:rect.midX,y:rect.midY),radius:rect.width/2,startAngle:.degrees(-90),endAngle:.degrees(-90+max(0,min(1,fraction))*360),clockwise:false);return path}
}
private struct AWCMeterReducedMotionKey:EnvironmentKey{static let defaultValue:Bool?=nil}
private struct AWCMeterContrastKey:EnvironmentKey{static let defaultValue:Bool?=nil}
extension EnvironmentValues{
    var awcMeterReducedMotion:Bool?{get{self[AWCMeterReducedMotionKey.self]}set{self[AWCMeterReducedMotionKey.self]=newValue}}
    var awcMeterIncreasedContrast:Bool?{get{self[AWCMeterContrastKey.self]}set{self[AWCMeterContrastKey.self]=newValue}}
}
struct AWCNativeMeter:View {
    let nodeID:String,properties:[String:AWCValue],theme:AWCTheme
    @Environment(\.awcMeterAppearance) private var appearance
    @Environment(\.awcNativeDensity) private var density
    @Environment(\.awcThemeTokens) private var inheritedTokens
    @Environment(\.layoutDirection) private var direction
    @Environment(\.accessibilityReduceMotion) private var systemReduceMotion
    @Environment(\.colorSchemeContrast) private var systemContrast
    @Environment(\.awcMeterReducedMotion) private var reducedOverride
    @Environment(\.awcMeterIncreasedContrast) private var contrastOverride
    @State private var motion=AWCNativeMeterMotion.resting(0)
    @State private var motionInitialized=false
    @State private var animating=false
    private var reduceMotion:Bool{reducedOverride ?? systemReduceMotion}
    private var increasedContrast:Bool{contrastOverride ?? (systemContrast == .increased)}
    private var tokens:[String:String]{theme.tokens.merging(inheritedTokens){_,new in new}}
    private var metrics:AWCNativeMeterMetrics{.init(properties:properties,appearance:appearance,density:density,tokens:tokens)}
    private func paint(_ hex:String)->Color{let v=UInt64(hex.dropFirst(),radix:16) ?? 0,rgba=hex.count==9,rgb=rgba ? v>>8:v;return Color(.sRGB,red:Double((rgb>>16)&255)/255,green:Double((rgb>>8)&255)/255,blue:Double(rgb&255)/255,opacity:rgba ? Double(v&255)/255:1)}
    private struct MotionRequest:Equatable{let fraction:Double,reduced:Bool,duration:Double,opacityDuration:Double}
    private func text(_ model:AWCNativeMeterText,part:String,color:String,wrap:Bool=false,center:Bool=false)->some View{
        AWCNativeMeterTextView(model:model,color:paint(color),wrap:wrap,center:center,ellipsize:part=="label" && !wrap)
            .awcInspect(nodeID:nodeID,part:part,name:"md-meter ::part(\(part))"){_ in ["typography":model.inspection,"padding":[0,0,0,0],"direction":.string(direction == .rightToLeft ? "rtl":"ltr")]}
    }
    private func linear(_ m:AWCNativeMeterMetrics,fraction:Double)->some View{
        AWCMeterColumnLayout(circular:false,gap:m.gap,caption:false,size:m.size){
            if m.showLabel || m.showValue{AWCMeterHeaderLayout(label:m.showLabel,value:m.showValue,gap:m.headerGap){
                if m.showLabel{text(m.labelText,part:"label",color:m.labelColor)}
                if m.showValue{text(m.valueText,part:"value",color:m.valueColor)}
            }}
            GeometryReader{geometry in
                ZStack(alignment:.leading){
                    AWCNativeCornerShape(corners:m.trackShape).fill(increasedContrast ? Color.gray:paint(m.trackColor))
                    AWCNativeCornerShape(corners:m.trackShape).fill(increasedContrast ? Color.primary:paint(m.indicatorColor))
                        .frame(width:geometry.size.width*fraction)
                        .awcInspect(nodeID:nodeID,part:"indicator",name:"md-meter ::part(indicator)")
                }.clipShape(AWCNativeCornerShape(corners:m.trackShape))
            }.frame(height:m.height).awcInspect(nodeID:nodeID,part:"track",name:"md-meter ::part(track)")
        }
    }
    private func ring(_ m:AWCNativeMeterMetrics,fraction:Double,opacity:Double)->some View{
        ZStack{
            ZStack{if m.size>0{
                Circle().stroke(increasedContrast ? Color.gray:paint(m.trackColor),lineWidth:m.stroke)
                    .frame(width:2*m.radius,height:2*m.radius)
                    .awcInspect(nodeID:nodeID,part:"track",name:"md-meter ::part(track) path")
                AWCMeterArc(fraction:fraction).stroke(increasedContrast ? Color.primary:paint(m.indicatorColor),style:.init(lineWidth:m.stroke,lineCap:.round))
                    .frame(width:2*m.radius,height:2*m.radius)
                    .awcInspect(nodeID:nodeID,part:"indicator",name:"md-meter ::part(indicator) path")
                    .opacity(opacity)
            }}.frame(width:m.size,height:m.size).clipped()
                // SwiftUI mirrors custom Shape paths in RTL. The source SVG
                // always advances clockwise; only the overlaid text inherits
                // paragraph direction.
                .environment(\.layoutDirection,.leftToRight)
            if m.showValue{
                AWCNativeMeterTextView(model:m.centerText,color:paint(m.valueColor),wrap:true,center:true,centerOverflow:true)
                    .frame(width:max(0,m.size*0.64)).frame(width:m.size,height:m.size)
                    .awcInspect(nodeID:nodeID,part:"value",name:"md-meter ::part(value)"){_ in ["typography":m.centerText.inspection,"padding":.array(Array(repeating:.number(m.size*0.18),count:4))]}
            }
        }.frame(width:m.size,height:m.size)
            .awcInspect(nodeID:nodeID,part:"circular",name:"md-meter ::part(circular)")
    }
    private func circular(_ m:AWCNativeMeterMetrics,fraction:Double,opacity:Double)->some View{
        AWCMeterColumnLayout(circular:true,gap:m.gap,caption:m.showLabel,size:m.size){
            ring(m,fraction:fraction,opacity:opacity)
            if m.showLabel{text(m.labelText,part:"label",color:m.labelColor,wrap:true,center:true)}
        }
    }
    private func meter(_ m:AWCNativeMeterMetrics)->some View{
        let request=MotionRequest(fraction:m.reading.fraction,reduced:reduceMotion,duration:awcFabMenuToken(tokens,"--md-sys-motion-duration-medium2",300)/1000,opacityDuration:awcFabMenuToken(tokens,"--md-sys-motion-duration-short4",200)/1000)
        return TimelineView(.animation(minimumInterval:1.0/60,paused:!animating)){context in
            let sample=motionInitialized ? motion.sample(context.date):(fraction:m.reading.fraction,opacity:m.reading.fraction>0 ? 1.0:0.0)
            Group{if m.circular{circular(m,fraction:sample.fraction,opacity:sample.opacity)}else{linear(m,fraction:sample.fraction)}}
        }.task(id:request){
            if !motionInitialized || request.reduced{motion = .resting(request.fraction);motionInitialized=true;animating=false;return}
            let now=Date(),sample=motion.sample(now),opacity=request.fraction>0 ? 1.0:0.0
            if sample.fraction==request.fraction && sample.opacity==opacity{animating=false;return}
            motion = .init(from:sample.fraction,to:request.fraction,fromOpacity:sample.opacity,toOpacity:opacity,start:now,duration:request.duration,opacityDuration:request.opacityDuration)
            animating=true
            do{try await Task.sleep(for:.seconds(max(request.duration,request.opacityDuration)))}catch{return}
            animating=false;motion = .resting(request.fraction)
        }
            .accessibilityHidden(true)
            .background{AWCNativeMeterBridge(id:nodeID,label:m.label,reading:m.reading,text:m.text).accessibilityHidden(false)}
            .accessibilityElement(children:.contain)
            .awcInspect(nodeID:nodeID,name:"md-meter"){_ in ["display":"SwiftUI read-only meter","direction":.string(direction == .rightToLeft ? "rtl":"ltr"),"padding":[0,0,0,0],"border":[0,0,0,0]]}
    }
    @ViewBuilder var body:some View{if properties["hidden"]?.bool != true{meter(metrics)}else{Color.clear.frame(width:0,height:0).awcInspectionAbsent().accessibilityHidden(true)}}
}
#if canImport(AppKit)
import AppKit
final class AWCNativeMeterView:NSView {
    var nodeID="",label="",text="",reading=AWCMeterReading(value:0)
    override var canBecomeKeyView:Bool{false}
    override func hitTest(_ point:NSPoint)->NSView?{nil}
    override func isAccessibilityElement()->Bool{true}
    override func accessibilityRole()->NSAccessibility.Role?{.levelIndicator}
    override func accessibilityIdentifier()->String{nodeID}
    override func accessibilityLabel()->String?{label.isEmpty ? nil:label}
    override func accessibilityValue()->Any?{reading.value}
    override func accessibilityMinValue()->Any?{reading.minimum}
    override func accessibilityMaxValue()->Any?{reading.maximum}
    override func accessibilityValueDescription()->String?{text}
}
private struct AWCNativeMeterBridge:NSViewRepresentable {
    let id:String,label:String,reading:AWCMeterReading,text:String
    func makeNSView(context:Context)->AWCNativeMeterView{AWCNativeMeterView()}
    func updateNSView(_ view:AWCNativeMeterView,context:Context){view.nodeID=id;view.label=label;view.reading=reading;view.text=text}
}
#elseif canImport(UIKit)
import UIKit
/// UIKit has no meter role: the meter is a value element (label + formatted value text), as iOS Safari presents one.
final class AWCNativeMeterView:UIView {
    var nodeID="",label="",text="",reading=AWCMeterReading(value:0)
    override func point(inside point:CGPoint,with event:UIEvent?)->Bool{false}
}
private struct AWCNativeMeterBridge:UIViewRepresentable {
    let id:String,label:String,reading:AWCMeterReading,text:String
    func makeUIView(context:Context)->AWCNativeMeterView{AWCNativeMeterView()}
    func updateUIView(_ view:AWCNativeMeterView,context:Context){view.nodeID=id;view.label=label;view.reading=reading;view.text=text;view.isAccessibilityElement=true;view.accessibilityIdentifier=id;view.accessibilityLabel=label.isEmpty ? nil:label;view.accessibilityValue=text;view.accessibilityTraits=[]}
}
#endif
