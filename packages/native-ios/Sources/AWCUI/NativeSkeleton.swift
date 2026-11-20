import SwiftUI
import Accessibility

struct AWCNativeSkeletonClock:Equatable{let entrance:Double,recurring:Double}
private struct AWCSkeletonClockKey:EnvironmentKey{static let defaultValue:AWCNativeSkeletonClock?=nil}
private struct AWCSkeletonReducedMotionKey:EnvironmentKey{static let defaultValue:Bool?=nil}
extension EnvironmentValues {
    var awcSkeletonClock:AWCNativeSkeletonClock?{get{self[AWCSkeletonClockKey.self]}set{self[AWCSkeletonClockKey.self]=newValue}}
    var awcSkeletonReducedMotion:Bool?{get{self[AWCSkeletonReducedMotionKey.self]}set{self[AWCSkeletonReducedMotionKey.self]=newValue}}
}
struct AWCNativeSkeleton:View {
    let nodeID:String,properties:[String:AWCValue],theme:AWCTheme
    @Environment(\.awcSkeletonAppearance) private var appearance
    @Environment(\.awcSkeletonParts) private var parts
    @Environment(\.awcSkeletonSizingContext) private var context
    @Environment(\.awcNativeDensity) private var density
    @Environment(\.awcThemeTokens) private var inheritedTokens
    @Environment(\.layoutDirection) private var direction
    @Environment(\.accessibilityReduceMotion) private var systemReduced
    @Environment(\.awcSkeletonReducedMotion) private var reducedOverride
    @Environment(\.awcSkeletonForcedColors) private var forcedColors
    @Environment(\.awcSkeletonClock) private var fixedClock
    @State private var entranceAt=Date()
    @State private var recurringAt=Date()
    private var reduced:Bool{reducedOverride ?? systemReduced}
    private var metrics:AWCNativeSkeletonMetrics{.init(properties:properties,appearance:appearance,density:density,tokens:theme.tokens.merging(inheritedTokens){_,new in new})}
    private func part(_ index:Int,_ m:AWCNativeSkeletonMetrics)->AWCSkeletonPartAppearance{
        var p=parts[m.variant=="text" ? .line:.shape] ?? .init()
        if m.variant=="text" && m.count>1 && index==m.count-1{p=p.merging(parts[.lineLast] ?? .init())}
        return p
    }
    private func row(_ index:Int,_ m:AWCNativeSkeletonMetrics,_ motion:AWCNativeSkeletonMotion.Sample)->some View{
        let p=part(index,m),last=m.variant=="text" && m.count>1 && index==m.count-1
        let corners=p.cornerShape ?? m.corners
        let id=m.variant=="text" ? "line.\(index)":"shape"
        let name=m.variant=="text" ? last ? "line line-last":"line":"shape"
        let color=forcedColors ? Color.secondary:Color(awcHex:p.color ?? m.color).opacity(p.color==nil ? m.baseAlpha:1)
        return AWCNativeCornerShape(corners:corners).fill(color)
            .overlay{
                if !reduced && m.animation=="wave"{
                    GeometryReader{geometry in
                        Canvas{cg,size in
                            let width=size.width,height=size.height,stripWidth=2*width,stripHeight=1.2*height
                            // CSS translates a200%-wide pseudo element, skewed
                            // about its center. RTL changes logical inset and
                            // reverses time; it does not mirror the gradient.
                            let base=direction == .rightToLeft ? 0.0:-width,translation=(-1+3*motion.wave)*stripWidth
                            let skew=tan(-12 * Double.pi/180),center=stripHeight/2
                            cg.translateBy(x:base+translation-skew*center,y:-0.1*height)
                            cg.concatenate(.init(a:1,b:0,c:skew,d:1,tx:0,ty:0))
                            let stops:[Gradient.Stop]=[.init(color:.clear,location:0),.init(color:.clear,location:0.35),.init(color:Color(awcHex:m.highlight),location:0.5),.init(color:.clear,location:0.65),.init(color:.clear,location:1)]
                            cg.fill(Path(CGRect(x:0,y:0,width:stripWidth,height:stripHeight)),with:.linearGradient(.init(stops:stops),startPoint:.zero,endPoint:.init(x:stripWidth,y:0)))
                        }.frame(width:geometry.size.width,height:geometry.size.height)
                    }.clipShape(AWCNativeCornerShape(corners:corners))
                }
            }.opacity(motion.pulse).awcInspect(nodeID:nodeID,part:id,name:"md-skeleton ::part(\(name))")
            .accessibilityHidden(true)
    }
    private func rendered(_ m:AWCNativeSkeletonMetrics,clock:AWCNativeSkeletonClock)->some View {
        let motion=AWCNativeSkeletonMotion.sample(m,entrance:clock.entrance,recurring:clock.recurring,reduced:reduced,rtl:direction == .rightToLeft)
        return AWCNativeSkeletonLayout(metrics:m,context:context,parts:parts,rtl:direction == .rightToLeft){
            ForEach(0..<m.count,id:\.self){row($0,m,motion)}
        }.environment(\.layoutDirection,.leftToRight)
            .accessibilityHidden(true)
            .background{if m.announce{AWCNativeSkeletonStatusBridge(id:nodeID,label:m.label).accessibilityHidden(false)}}
            .accessibilityElement(children:.contain)
            .awcInspect(nodeID:nodeID,name:"md-skeleton"){size in
                let plan=AWCNativeSkeletonLayout(metrics:m,context:context,parts:parts,rtl:direction == .rightToLeft).plan(Double(size.width))
                let gap=plan.rows.count>1 ? plan.rows[1].minY-plan.rows[0].maxY:0
                return ["padding":[0,0,0,0],"border":[0,0,0,0],"gap":["row":.number(gap),"column":0],"display":"SwiftUI loading placeholder","direction":.string(direction == .rightToLeft ? "rtl":"ltr")]
            }
            .modifier(AWCSkeletonEntrance(opacity:motion.opacity,scale:motion.scale))
    }
    @ViewBuilder var body:some View{
        let m=metrics
        if m.hidden{Color.clear.frame(width:0,height:0).awcInspectionAbsent().accessibilityHidden(true)}
        else{
            TimelineView(.animation(minimumInterval:nil,paused:fixedClock != nil || reduced)){timeline in
                rendered(m,clock:fixedClock ?? .init(entrance:timeline.date.timeIntervalSince(entranceAt),recurring:timeline.date.timeIntervalSince(recurringAt)))
            }.onAppear{entranceAt=Date();recurringAt=entranceAt;announce(m)}
                .onChange(of:reduced){_,_ in entranceAt=Date();recurringAt=entranceAt}
                .onChange(of:m.animation){_,_ in recurringAt=Date()}
                .onChange(of:m.label){_,_ in announce(m)}
                .onChange(of:m.announce){_,enabled in if enabled{announce(m)}}
        }
    }
    private func announce(_ m:AWCNativeSkeletonMetrics){
        guard m.announce,!m.label.isEmpty else{return}
        var text=AttributedString(m.label);text.accessibilitySpeechAnnouncementPriority = .low
        AccessibilityNotification.Announcement(text).post()
    }
}
private struct AWCSkeletonEntrance:ViewModifier {
    let opacity:Double,scale:Double
    @ViewBuilder func body(content:Content)->some View{
        if scale==1 && opacity==1{content}
        else{content.scaleEffect(scale).opacity(opacity)}
    }
}
#if canImport(AppKit)
import AppKit
final class AWCNativeSkeletonStatusView:NSView {
    var nodeID="",label=""
    override var canBecomeKeyView:Bool{false}
    override func hitTest(_ point:NSPoint)->NSView?{nil}
    override func isAccessibilityElement()->Bool{true}
    override func accessibilityRole()->NSAccessibility.Role?{.busyIndicator}
    override func accessibilityIdentifier()->String{nodeID}
    override func accessibilityLabel()->String?{label}
    override func accessibilityValue()->Any?{nil}
}
private struct AWCNativeSkeletonStatusBridge:NSViewRepresentable {
    let id:String,label:String
    func makeNSView(context:Context)->AWCNativeSkeletonStatusView{AWCNativeSkeletonStatusView()}
    func updateNSView(_ view:AWCNativeSkeletonStatusView,context:Context){view.nodeID=id;view.label=label}
}
#elseif canImport(UIKit)
import UIKit
/// UIKit busy role (VoiceOver: "in progress") for the loading skeleton.
final class AWCNativeSkeletonStatusView:UIActivityIndicatorView {
    var nodeID="",label=""
    override func point(inside point:CGPoint,with event:UIEvent?)->Bool{false}
    // R2-D12: the authored label is the accessible name, including an empty one (Web: role=status, empty name). UIKit's
    // default ("In progress") must never replace it, whatever the order of SwiftUI updates and accessibility reads.
    override var accessibilityLabel:String?{get{label} set{}}
}
private struct AWCNativeSkeletonStatusBridge:UIViewRepresentable {
    let id:String,label:String
    func makeUIView(context:Context)->AWCNativeSkeletonStatusView{
        let view=AWCNativeSkeletonStatusView(style:.medium);view.nodeID=id;view.label=label;view.color = .clear;view.isUserInteractionEnabled=false;view.hidesWhenStopped=false;view.startAnimating();return view
    }
    func updateUIView(_ view:AWCNativeSkeletonStatusView,context:Context){view.nodeID=id;view.label=label;view.isAccessibilityElement=true;view.accessibilityIdentifier=id;view.accessibilityLabel=label;view.accessibilityTraits.insert(.updatesFrequently)}
}
#endif
