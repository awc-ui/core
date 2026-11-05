import SwiftUI

struct AWCNativeProgressClock:Equatable {var javascript:Double,css:Double}
private struct AWCProgressClockKey:EnvironmentKey{static let defaultValue:AWCNativeProgressClock?=nil}
private struct AWCProgressReducedMotionKey:EnvironmentKey{static let defaultValue:Bool?=nil}
extension EnvironmentValues {
    var awcProgressClock:AWCNativeProgressClock?{get{self[AWCProgressClockKey.self]}set{self[AWCProgressClockKey.self]=newValue}}
    var awcProgressReducedMotion:Bool?{get{self[AWCProgressReducedMotionKey.self]}set{self[AWCProgressReducedMotionKey.self]=newValue}}
}
struct AWCNativeProgressIndicator:View {
    let nodeID:String,properties:[String:AWCValue],theme:AWCTheme,onComplete:()->Void
    @Environment(\.awcProgressIndicatorAppearance) private var appearance
    @Environment(\.awcNativeDensity) private var density
    @Environment(\.awcThemeTokens) private var inheritedTokens
    @Environment(\.layoutDirection) private var direction
    @Environment(\.displayScale) private var displayScale
    @Environment(\.accessibilityReduceMotion) private var systemReduced
    @Environment(\.awcProgressForcedColors) private var forcedColors
    @Environment(\.awcProgressClock) private var fixedClock
    @Environment(\.awcProgressReducedMotion) private var reducedOverride
    @State private var motion:AWCNativeProgressMotion?
    @State private var mountedAt=Date()
    @State private var revision=0
    private var reduced:Bool{reducedOverride ?? systemReduced}
    private var metrics:AWCNativeProgressMetrics{.init(properties:properties,appearance:appearance,density:density,tokens:theme.tokens.merging(inheritedTokens){_,new in new})}
    private func rgba(_ hex:String)->[Double]{
        let n=UInt64(hex.dropFirst(),radix:16) ?? 0,alpha=hex.count==9,rgb=alpha ? n>>8:n
        return[Double((rgb>>16)&255)/255,Double((rgb>>8)&255)/255,Double(rgb&255)/255,alpha ? Double(n&255)/255:1]
    }
    private func paint(_ hex:String,track:Bool=false)->Color{
        if forcedColors{return track ? .secondary:.primary}
        let c=rgba(hex);return Color(.sRGB,red:c[0],green:c[1],blue:c[2],opacity:c[3])
    }
    private func active(_ m:AWCNativeProgressMetrics,css:Double)->Color {
        guard !forcedColors,m.circular,m.indeterminate,!m.wave,m.fourColor else{return paint(m.activeColor)}
        let t=max(0,css).truncatingRemainder(dividingBy:reduced ? 16:5.332)/(reduced ? 16:5.332)
        let stops=[0.0,0.15,0.25,0.40,0.50,0.65,0.75,0.90,1.0],indices=[0,0,1,1,2,2,3,3,0]
        let i=(0..<8).first{t<stops[$0+1]} ?? 7,p=(t-stops[i])/(stops[i+1]-stops[i])
        let a=rgba(m.fourColors[indices[i]]),b=rgba(m.fourColors[indices[i+1]]),alpha=a[3]+(b[3]-a[3])*p
        let c=(0..<3).map{alpha>0 ? (a[$0]*a[3]*(1-p)+b[$0]*b[3]*p)/alpha:0}
        return .init(.sRGB,red:c[0],green:c[1],blue:c[2],opacity:alpha)
    }
    private func measuredBox(_ part:String?,rect:CGRect,corners:AWCCornerShape,color:Color)->some View{
        AWCNativeCornerShape(corners:corners).fill(color).frame(width:max(0,rect.width),height:max(0,rect.height))
            .modifier(AWCProgressPart(nodeID:nodeID,part:part)).offset(x:rect.minX,y:rect.minY)
    }
    @ViewBuilder private func path(_ shape:Path,part:String?,color:Color,stroke:Double?=nil,opacity:Double=1,rotation:Double=0,center:CGPoint = .zero)->some View{
        let transform=rotationTransform(rotation,center:center)
        let b=shape.isEmpty ? CGRect.zero:shape.boundingRect.applying(transform)
        if !b.isNull,b.minX.isFinite,b.minY.isFinite,b.width.isFinite,b.height.isFinite {
            let shifted=shape.applying(transform).offsetBy(dx:-b.minX,dy:-b.minY)
            Group{if let stroke{shifted.stroke(color,style:.init(lineWidth:stroke,lineCap:.round))}else{shifted.fill(color)}}
                .frame(width:b.width,height:b.height).opacity(opacity)
                .modifier(AWCProgressPart(nodeID:nodeID,part:part))
                .offset(x:b.minX,y:b.minY)
        }
    }
    private func rotationTransform(_ angle:Double,center:CGPoint)->CGAffineTransform {
        let c=cos(angle),s=sin(angle)
        return .init(a:c,b:s,c:-s,d:c,tx:center.x-c*center.x+s*center.y,ty:center.y-s*center.x-c*center.y)
    }
    private func circularPath(_ m:AWCNativeProgressMetrics,start:Double,length:Double)->Path {
        AWCNativeProgressGeometry.arc(m,start:-.pi/2+start*2 * .pi,end:-.pi/2+(start+length)*2 * .pi)
    }
    private func dashedCircle(_ m:AWCNativeProgressMetrics,part:String,color:Color,length:Double,offset:Double,track:Bool,rotation:Double=0,opacity:Double=1)->some View {
        let circumference=2 * .pi*m.radius,full=length>=1
        let dash:[CGFloat]=full ? []:[CGFloat(max(0,length)*circumference),CGFloat((track ? max(0,1-length):1)*circumference)]
        let circle=circularPath(m,start:0,length:1)
        let transform=rotationTransform(rotation,center:.init(x:m.size/2,y:m.size/2))
        // SVG measures the transformed element box, not the tighter bounds of
        // its rotated curve. The native paint layer uses that same actual box.
        let b=circle.boundingRect.applying(transform),shape=circle.applying(transform)
        return shape.offsetBy(dx:-b.minX,dy:-b.minY)
            .stroke(color,style:.init(lineWidth:m.thickness<0 ? 1:min(m.thickness,4*m.size),lineCap:.round,dash:dash,dashPhase:offset*circumference))
            .frame(width:b.width,height:b.height).opacity(opacity)
            .modifier(AWCProgressPart(nodeID:nodeID,part:part)).offset(x:b.minX,y:b.minY)
    }
    @ViewBuilder private func ring(_ m:AWCNativeProgressMetrics,_ state:AWCNativeProgressMotion,clock:AWCNativeProgressClock)->some View {
        let color=active(m,css:clock.css),track=paint(m.trackColor,track:true),stroke=m.thickness<0 ? 1:min(m.thickness,4*m.size)
        ZStack(alignment:.topLeading) {
            if state.completed {
                dashedCircle(m,part:"track",color:track,length:1,offset:0,track:true)
            } else if state.completionArc {
                if state.stage == .circleTrack {
                    dashedCircle(m,part:"track",color:track,length:1,offset:0,track:true,opacity:state.trackOpacity)
                } else {
                    let start=state.stage == .circleErase ? state.erase:0,end=state.stage == .circleErase ? 1:state.fraction,span=end-start
                    let shape=span<1e-4 ? Path():AWCNativeProgressGeometry.wavyArc(m,start:-.pi/2+start*2 * .pi,end:-.pi/2+end*2 * .pi,amplitude:m.wave ? state.amplitude:0,phase:state.phase)
                    let cap=m.thickness/(2 * .pi*m.radius),opacity=state.stage == .circleErase && cap>0 ? min(1,span/cap):1
                    path(shape,part:"active-indicator",color:color,stroke:stroke,opacity:opacity)
                }
            } else if m.wave {
                let sample=state.circularIndeterminate(at:clock.javascript)
                let fraction=m.indeterminate ? sample.fraction:state.fraction
                let rotation=m.indeterminate ? (reduced ? clock.css/4*2 * .pi:sample.rotation):0
                let shapes=AWCNativeProgressGeometry.circularWave(m,fraction:fraction,amplitude:state.amplitude,phase:state.phase,rotation:rotation)
                path(shapes.track,part:"track",color:track,stroke:stroke)
                path(shapes.active,part:"active-indicator",color:color,stroke:stroke,rotation:rotation,center:.init(x:m.size/2,y:m.size/2))
            } else if m.indeterminate {
                let sample=AWCNativeProgressChoreography.circle(clock.css,metrics:m,reduced:reduced)
                dashedCircle(m,part:"track",color:track,length:sample.trackLength,offset:sample.trackOffset,track:true,rotation:sample.rotation)
                dashedCircle(m,part:"active-indicator",color:color,length:sample.length,offset:sample.offset,track:false,rotation:sample.rotation)
            } else {
                let sample=AWCNativeProgressGeometry.circularFlat(m,fraction:state.fraction)
                dashedCircle(m,part:"track",color:track,length:sample.trackLength,offset:-sample.trackStart,track:true,opacity:sample.trackOpacity)
                dashedCircle(m,part:"active-indicator",color:color,length:sample.activeLength,offset:-sample.activeStart,track:false)
            }
        }.frame(width:m.size,height:m.size,alignment:.topLeading).clipped().environment(\.layoutDirection,.leftToRight)
    }
    private func linear(_ m:AWCNativeProgressMetrics,_ state:AWCNativeProgressMotion,clock:AWCNativeProgressClock)->some View {
        GeometryReader{geometry in
            let width=Double(geometry.size.width),height=max(0,m.height),rtl = !m.indeterminate && direction == .rightToLeft
            let origin=geometry.frame(in:.global).origin
            let thickness=m.thickness<0 ? height:m.thickness,trackY=(height-thickness)/2
            let fill=state.fraction*width,start=state.fraction>0 ? AWCNativeProgressGeometry.rounded(state.fraction*100,1000)/100*width+m.gap:0
            let color=active(m,css:clock.css),track=paint(m.trackColor,track:true)
            AWCProgressExactOverlay(width:width,height:height) {
                if m.indeterminate {
                    let bars=AWCNativeProgressChoreography.linearBars(clock.css,width:width,reduced:reduced)
                    if m.wave && !reduced {
                        let intervals=bars.map{bar -> (Double,Double) in
                            let a=max(0,min(width,bar.start-m.thickness/2)),b=max(0,min(width,bar.end+m.thickness/2))
                            return(a,b)
                        }.sorted{$0.0<$1.0}
                        let mask=AWCProgressTrackMask(width:width,height:thickness,intervals:intervals,rtl:rtl)
                        measuredBox("track",rect:.init(x:0,y:trackY,width:width,height:thickness),corners:m.trackShape,color:track).mask(mask)
                        ForEach(0..<bars.count,id:\.self){i in
                            let a=bars[i].start,b=bars[i].end
                            let shape=b-a<1 ? Path():AWCNativeProgressGeometry.linearWave(m,start:a,end:b,amplitude:state.amplitude,phase:state.phase,inset:false)
                            path(rtl ? shape.applying(.init(a:-1,b:0,c:0,d:1,tx:width,ty:0)):shape,part:nil,color:color)
                        }
                    } else {
                        measuredBox("track",rect:.init(x:0,y:trackY,width:width,height:thickness),corners:m.trackShape,color:track)
                        ForEach(0..<bars.count,id:\.self){i in
                            let x=rtl ? width-bars[i].end:bars[i].start
                            measuredBox(nil,rect:.init(x:x,y:trackY,width:bars[i].end-bars[i].start,height:thickness),corners:m.activeShape,color:color)
                        }
                        // The source exposes the translated primary wrapper,
                        // whose measured width remains the full viewport.
                        let primary=bars[0],scale=(primary.end-primary.start)/max(1,width)
                        let logical=primary.start-(1-scale)*width/2,x=rtl ? -logical:logical
                        Color.clear.frame(width:width,height:thickness).modifier(AWCProgressPart(nodeID:nodeID,part:"active-indicator")).offset(x:x,y:trackY)
                    }
                } else {
                    if !m.wave || m.fraction<1 {
                        measuredBox("track",rect:.init(x:rtl ? 0:start,y:trackY,width:max(0,width-start),height:thickness),corners:m.trackShape,color:track)
                    }
                    if m.wave {
                        path(AWCNativeProgressGeometry.linearWave(m,start:rtl ? width-fill:0,end:rtl ? width:fill,amplitude:state.amplitude,phase:state.phase,inset:true),part:"active-indicator",color:color)
                    } else {
                        measuredBox("active-indicator",rect:.init(x:rtl ? width-fill:0,y:trackY,width:fill,height:thickness),corners:m.activeShape,color:color)
                    }
                    let stop=max(0,m.stopSize),x=rtl ? m.stopTrailingSpace:width-m.stopTrailingSpace-stop
                    measuredBox("stop-indicator",rect:.init(x:x,y:(height-stop)/2,width:stop,height:stop),corners:m.stopShape,color:paint(m.stopColor))
                }
            }.clipShape(AWCNativeCornerShape(corners:m.trackShape))
                .scaleEffect(x:m.indeterminate && direction == .rightToLeft ? -1:1,y:state.scale,anchor:.center).environment(\.layoutDirection,.leftToRight)
                .projectionEffect(.init(CGAffineTransform(translationX:origin.x-(origin.x*displayScale).rounded()/displayScale,
                                                        y:origin.y-(origin.y*displayScale).rounded()/displayScale)))
        }.frame(height:max(0,m.height)).environment(\.layoutDirection,.leftToRight)
    }
    private func snapshot(_ m:AWCNativeProgressMetrics)->AWCNativeProgressMotion {
        guard let clock=fixedClock else{return motion ?? .init(m,reduced:reduced)}
        var state=AWCNativeProgressMotion(m,reduced:reduced);state.tick(0)
        var time=1.0/60
        while time<clock.javascript{state.tick(time);time += 1.0/60}
        state.tick(clock.javascript);return state
    }
    private struct Request:Equatable{let metrics:AWCNativeProgressMetrics,reduced:Bool,fixed:AWCNativeProgressClock?}
    private func indicator(_ m:AWCNativeProgressMetrics)->some View {
        let state=snapshot(m),clock=fixedClock ?? .init(javascript:Date().timeIntervalSince(mountedAt),css:Date().timeIntervalSince(mountedAt))
        let request=Request(metrics:m,reduced:reduced,fixed:fixedClock)
        return Group {
            if state.hidden {
                Color.clear.frame(maxWidth:m.circular ? nil:.infinity).frame(width:m.circular ? m.size:nil,height:m.circular ? m.size:max(0,m.height)).awcInspectionAbsent().accessibilityHidden(true)
            } else {
                Group{if m.circular{ring(m,state,clock:clock)}else{linear(m,state,clock:clock)}}
                    .accessibilityHidden(true)
                    .background{AWCNativeDeterminateProgressBridge(id:nodeID,label:m.label,maximum:m.maximum,value:m.value).accessibilityHidden(false)}
                    .accessibilityElement(children:.contain)
                    .awcInspect(nodeID:nodeID,name:"md-progress-indicator"){_ in ["padding":[0,0,0,0],"border":[0,0,0,0],"display":"SwiftUI progress indicator","direction":.string(direction == .rightToLeft ? "rtl":"ltr")]}
            }
        }.task(id:request){
            guard fixedClock==nil else{return}
            if motion==nil{motion = .init(m,reduced:reduced);mountedAt=Date()}
            let before=motion!.completionCount
            motion!.update(m,reduced:reduced)
            if motion!.completionCount>before{onComplete()}
            while !Task.isCancelled {
                let count=motion!.completionCount
                motion!.tick(Date().timeIntervalSince(mountedAt));revision &+= 1
                if motion!.completionCount>count{onComplete()}
                if !motion!.animates{break}
                do{try await Task.sleep(for:.milliseconds(16))}catch{break}
            }
        }.onDisappear{motion?.suspend()}
    }
    @ViewBuilder var body:some View {
        let _=revision,m=metrics
        if m.hidden{Color.clear.frame(width:0,height:0).awcInspectionAbsent().accessibilityHidden(true)}
        else{indicator(m)}
    }
}
/// Absolute source layers retain fractional density geometry. A standard
/// ZStack centers and pixel-aligns each independently sized child.
private struct AWCProgressExactOverlay:Layout {
    let width:Double,height:Double
    func sizeThatFits(proposal:ProposedViewSize,subviews:Subviews,cache:inout())->CGSize{.init(width:width,height:height)}
    func placeSubviews(in bounds:CGRect,proposal:ProposedViewSize,subviews:Subviews,cache:inout()){
        for child in subviews{child.place(at:bounds.origin,anchor:.topLeading,proposal:.unspecified)}
    }
}
private struct AWCProgressPart:ViewModifier {
    let nodeID:String,part:String?
    @ViewBuilder func body(content:Content)->some View {
        if let part{content.awcInspect(nodeID:nodeID,part:part,name:"md-progress-indicator ::part(\(part))")}
        else{content}
    }
}
private struct AWCProgressTrackMask:View {
    let width:Double,height:Double,intervals:[(Double,Double)],rtl:Bool
    var body:some View {
        Path{path in
            var cursor=0.0
            for (a,b) in intervals where b>a {
                if a>cursor{let start=rtl ? width-a:cursor;path.addRect(.init(x:start,y:0,width:a-cursor,height:height))}
                cursor=max(cursor,b)
            }
            if cursor<width{path.addRect(.init(x:rtl ? 0:cursor,y:0,width:width-cursor,height:height))}
        }.fill(Color.white).frame(width:width,height:height)
    }
}
#if canImport(AppKit)
import AppKit
final class AWCNativeDeterminateProgressView:NSView {
    var nodeID="",label="",maximum=100.0,value:Double?
    override var canBecomeKeyView:Bool{false}
    override func hitTest(_ point:NSPoint)->NSView?{nil}
    override func isAccessibilityElement()->Bool{true}
    override func accessibilityRole()->NSAccessibility.Role?{.progressIndicator}
    override func accessibilityIdentifier()->String{nodeID}
    override func accessibilityLabel()->String?{label.isEmpty ? nil:label}
    override func accessibilityMinValue()->Any?{0.0}
    override func accessibilityMaxValue()->Any?{maximum}
    override func accessibilityValue()->Any?{value}
    override func accessibilityValueDescription()->String?{value == nil ? "Indeterminate":nil}
}
private struct AWCNativeDeterminateProgressBridge:NSViewRepresentable {
    let id:String,label:String,maximum:Double,value:Double?
    func makeNSView(context:Context)->AWCNativeDeterminateProgressView{AWCNativeDeterminateProgressView()}
    func updateNSView(_ view:AWCNativeDeterminateProgressView,context:Context){view.nodeID=id;view.label=label;view.maximum=maximum;view.value=value}
}
#elseif canImport(UIKit)
import UIKit
/// UIKit progress role (VoiceOver: "progress") with the source range kept for programmatic inspection.
final class AWCNativeDeterminateProgressView:UIProgressView {
    var nodeID="",label="",maximum=100.0,value:Double?
    override func point(inside point:CGPoint,with event:UIEvent?)->Bool{false}
}
private struct AWCNativeDeterminateProgressBridge:UIViewRepresentable {
    let id:String,label:String,maximum:Double,value:Double?
    func makeUIView(context:Context)->AWCNativeDeterminateProgressView{let view=AWCNativeDeterminateProgressView();view.progressTintColor = .clear;view.trackTintColor = .clear;view.isUserInteractionEnabled=false;return view}
    func updateUIView(_ view:AWCNativeDeterminateProgressView,context:Context){view.nodeID=id;view.label=label;view.maximum=maximum;view.value=value;view.isAccessibilityElement=true;view.accessibilityIdentifier=id;view.accessibilityLabel=label.isEmpty ? nil:label;view.progress=Float(maximum>0 ? (value ?? 0)/maximum:0);view.accessibilityValue=value.map{String($0)} ?? "Indeterminate"}
}
#endif
