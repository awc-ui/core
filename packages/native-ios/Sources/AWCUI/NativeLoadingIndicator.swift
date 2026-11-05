import SwiftUI
import Accessibility

struct AWCNativeLoadingMetrics {
    let size:Double,shapeWidth:Double,shapeHeight:Double
    let contained:Bool
    let color:String,containerColor:String,corners:AWCCornerShape,label:String
    init(properties:[String:AWCValue],appearance:AWCLoadingIndicatorAppearance,part:AWCLoadingIndicatorShapeAppearance,inheritedDensity:Double,tokens:[String:String]){
        let density=AWCNativeDensity.resolve(properties["density"]?.number,inherited:inheritedDensity)
        contained=properties["variant"]?.string=="contained"
        size=appearance.size ?? max(32,48+4*density)
        let shape=appearance.shapeSize ?? size*0.792
        // A flex row shrinks the child's inline axis, not its block axis.
        shapeWidth=min(size,part.width ?? shape);shapeHeight=part.height ?? shape
        color=part.color ?? appearance.color ?? tokens[contained ? "--md-sys-color-on-primary-container":"--md-sys-color-primary"] ?? (contained ? "#21005D":"#6750A4")
        containerColor=appearance.containerColor ?? tokens["--md-sys-color-primary-container"] ?? "#EADDFF"
        let token=tokens["--md-sys-shape-corner-full"] ?? "50%"
        let value=Double(token.replacingOccurrences(of:"px",with:"").replacingOccurrences(of:"%",with:"")) ?? (token.hasSuffix("%") ? 50:9999)
        corners=appearance.containerShape ?? (token.hasSuffix("%") ? .fraction(value/100):.points(value))
        label=properties["label"]?.string ?? "Loading"
    }
}
private struct AWCLoadingPhaseKey:EnvironmentKey{static let defaultValue:Double?=nil}
// Internal fixture overrides exercise accessibility preferences without changing
// the user's system settings. Production reads the native SwiftUI preferences.
private struct AWCLoadingReducedMotionKey:EnvironmentKey{static let defaultValue:Bool?=nil}
private struct AWCLoadingContrastKey:EnvironmentKey{static let defaultValue:Bool?=nil}
extension EnvironmentValues{
    var awcLoadingIndicatorPhase:Double?{get{self[AWCLoadingPhaseKey.self]}set{self[AWCLoadingPhaseKey.self]=newValue}}
    var awcLoadingReducedMotion:Bool?{get{self[AWCLoadingReducedMotionKey.self]}set{self[AWCLoadingReducedMotionKey.self]=newValue}}
    var awcLoadingIncreasedContrast:Bool?{get{self[AWCLoadingContrastKey.self]}set{self[AWCLoadingContrastKey.self]=newValue}}
}
struct AWCNativeLoadingIndicator:View {
    let nodeID:String,properties:[String:AWCValue],theme:AWCTheme
    @Environment(\.awcLoadingIndicatorAppearance) private var appearance
    @Environment(\.awcLoadingIndicatorShapeAppearance) private var part
    @Environment(\.awcNativeDensity) private var inheritedDensity
    @Environment(\.awcThemeTokens) private var inheritedTokens
    @Environment(\.layoutDirection) private var direction
    @Environment(\.accessibilityReduceMotion) private var systemReduceMotion
    @Environment(\.colorSchemeContrast) private var systemContrast
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.awcLoadingIndicatorPhase) private var fixedPhase
    @Environment(\.awcLoadingReducedMotion) private var reducedMotionOverride
    @Environment(\.awcLoadingIncreasedContrast) private var contrastOverride
    private var reduceMotion:Bool{reducedMotionOverride ?? systemReduceMotion}
    private var increasedContrast:Bool{contrastOverride ?? (systemContrast == .increased)}
    @State private var start=Date()
    @State private var focused=false
    private var tokens:[String:String]{theme.tokens.merging(inheritedTokens){_,new in new}}
    private var metrics:AWCNativeLoadingMetrics{.init(properties:properties,appearance:appearance,part:part,inheritedDensity:inheritedDensity,tokens:tokens)}
    private func paint(_ hex:String)->Color{
        let value=UInt64(hex.dropFirst(),radix:16) ?? 0,rgba=hex.count==9,rgb=rgba ? value>>8:value
        return .init(.sRGB,red:Double((rgb>>16)&255)/255,green:Double((rgb>>8)&255)/255,blue:Double(rgb&255)/255,opacity:rgba ? Double(value&255)/255:1)
    }
    private func shape(_ m:AWCNativeLoadingMetrics,phase:Double)->some View{
        let sample=AWCNativeLoadingMotion.sample(phase,reducedMotion:reduceMotion)
        let foreground=increasedContrast ? Color.primary:paint(m.color)
        return Group{
            if reduceMotion{Ellipse().fill(foreground)}else{AWCNativeLoadingPolygon(points:sample.points).fill(foreground)}
        }.frame(width:m.shapeWidth,height:m.shapeHeight)
            .opacity(sample.opacity).rotationEffect(.degrees(sample.rotation))
            .awcInspect(nodeID:nodeID,part:"shape",name:"md-loading-indicator ::part(shape)")
            .accessibilityHidden(true)
    }
    private func indicator(_ m:AWCNativeLoadingMetrics)->some View{
        let corners=AWCNativeCornerShape(corners:m.contained || focused ? m.corners:.points(0))
        return TimelineView(.animation(minimumInterval:1.0/60,paused:fixedPhase != nil || m.size==0 || m.shapeWidth==0 || m.shapeHeight==0)){context in
            let fraction=fixedPhase ?? context.date.timeIntervalSince(start)/(reduceMotion ? 2:AWCNativeLoadingMotion.duration)
            shape(m,phase:fraction).frame(width:m.size,height:m.size)
        }
        .background{if m.contained{corners.fill(increasedContrast ? (colorScheme == .dark ? Color.black:Color.white):paint(m.containerColor))}}
        .clipShape(corners)
        .overlay{if increasedContrast && m.contained{corners.inset(by:-0.5).stroke(Color.primary,lineWidth:1)}}
        .overlay{if focused{AWCNativeCornerShape(corners:m.corners).inset(by:-3.5).stroke(paint(tokens["--md-sys-color-secondary"] ?? "#625B71"),lineWidth:3)}}
        .accessibilityHidden(true)
        .background{AWCNativeProgressBridge(id:nodeID,label:m.label,focusChanged:{focused=$0}).accessibilityHidden(false)}
        .accessibilityElement(children:.contain)
        .awcInspect(nodeID:nodeID,name:"md-loading-indicator"){_ in ["padding":[0,0,0,0],"margin":[0,0,0,0],"border":[0,0,0,0],"display":"SwiftUI morphing progress indicator","direction":.string(direction == .rightToLeft ? "rtl":"ltr")]}
        .onChange(of:reduceMotion){_,_ in start=Date()}
        .onChange(of:m.label){_,label in if !label.isEmpty{var message=AttributedString(label);message.accessibilitySpeechAnnouncementPriority = .low;AccessibilityNotification.Announcement(message).post()}}
    }
    @ViewBuilder var body:some View{
        if properties["hidden"]?.bool != true{indicator(metrics)}
        else{Color.clear.frame(width:0,height:0).awcInspectionAbsent().accessibilityHidden(true)}
    }
}
#if canImport(AppKit)
import AppKit
final class AWCNativeProgressView:NSView {
    var nodeID="",label="",focusChanged:((Bool)->Void)?
    override var acceptsFirstResponder:Bool{true}
    override var canBecomeKeyView:Bool{false}
    override func hitTest(_ point:NSPoint)->NSView?{nil}
    override func becomeFirstResponder()->Bool{focusChanged?(true);return true}
    override func resignFirstResponder()->Bool{focusChanged?(false);return true}
    override func isAccessibilityElement()->Bool{true}
    override func accessibilityRole()->NSAccessibility.Role?{.progressIndicator}
    override func accessibilityIdentifier()->String{nodeID}
    override func accessibilityLabel()->String?{label}
    override func accessibilityValue()->Any?{nil}
    override func accessibilityValueDescription()->String?{"Indeterminate"}
    override func isAccessibilityFocused()->Bool{window?.firstResponder===self}
    override func setAccessibilityFocused(_ value:Bool){if value{_ = window?.makeFirstResponder(self)}}
}
private struct AWCNativeProgressBridge:NSViewRepresentable {
    let id:String,label:String,focusChanged:(Bool)->Void
    func makeNSView(context:Context)->AWCNativeProgressView{AWCNativeProgressView()}
    func updateNSView(_ view:AWCNativeProgressView,context:Context){view.nodeID=id;view.label=label;view.focusChanged=focusChanged}
}
#elseif canImport(UIKit)
import UIKit
// Preserve UIKit's native progress accessibility role while SwiftUI owns paint.
final class AWCNativeProgressView:UIProgressView, AWCKeyView {
    var focusChanged:((Bool)->Void)?
    override var canBecomeFirstResponder:Bool{true}
    // Programmatically focusable, never a Tab stop (AppKit `canBecomeKeyView` false); Tab moves on from it.
    var awcAcceptsFirstResponder:Bool{true}
    var awcCanBecomeKeyView:Bool{false}
    func awcBecomeKeyView()->Bool{becomeFirstResponder()}
    override var keyCommands:[UIKeyCommand]?{AWCKeyViewLoop.tabCommands(#selector(tabKey(_:)))}
    @objc private func tabKey(_ command:UIKeyCommand){if let window{AWCKeyViewLoop.select(from:self,in:window,backward:command.modifierFlags.contains(.shift))}}
    override func point(inside point:CGPoint,with event:UIEvent?)->Bool{false}
    override func becomeFirstResponder()->Bool{let result=super.becomeFirstResponder();if result{focusChanged?(true)};return result}
    override func resignFirstResponder()->Bool{let result=super.resignFirstResponder();if result{focusChanged?(false)};return result}
    override func accessibilityElementDidBecomeFocused(){super.accessibilityElementDidBecomeFocused();focusChanged?(true)}
    override func accessibilityElementDidLoseFocus(){super.accessibilityElementDidLoseFocus();focusChanged?(false)}
}
private struct AWCNativeProgressBridge:UIViewRepresentable {
    let id:String,label:String,focusChanged:(Bool)->Void
    func makeUIView(context:Context)->AWCNativeProgressView{AWCNativeProgressView()}
    func updateUIView(_ view:AWCNativeProgressView,context:Context){view.progressTintColor = .clear;view.trackTintColor = .clear;view.isAccessibilityElement=true;view.accessibilityIdentifier=id;view.accessibilityLabel=label;view.accessibilityValue="Indeterminate";view.accessibilityTraits=[.updatesFrequently];view.focusChanged=focusChanged}
}
#endif
