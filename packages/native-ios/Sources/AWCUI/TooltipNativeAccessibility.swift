import SwiftUI

final class AWCNativeTooltipFocusContext {
    #if canImport(AppKit)
    weak var anchor:AWCTooltipRegionView?,popup:AWCTooltipRegionView?
    weak var previousAnchorFocus:NSView?
    func containsFocus(_ region:AWCTooltipRegionView?)->Bool{
        guard let region,let focus=region.window?.firstResponder as? NSView,focus.window===region.window else{return false}
        return region.bounds.insetBy(dx:-0.5,dy:-0.5).contains(region.convert(CGPoint(x:focus.bounds.midX,y:focus.bounds.midY),from:focus))
    }
    func restore(){if let previousAnchorFocus,previousAnchorFocus.window != nil{_ = previousAnchorFocus.window?.makeFirstResponder(previousAnchorFocus)}}
    #elseif canImport(UIKit)
    weak var anchor:AWCTooltipRegionView?,popup:AWCTooltipRegionView?
    weak var previousAnchorFocus:UIView?
    func responder(_ view:UIView)->UIView?{if view.isFirstResponder{return view};return view.subviews.lazy.compactMap{self.responder($0)}.first}
    func containsFocus(_ region:AWCTooltipRegionView?)->Bool{
        guard let region,let window=region.window,let focus=responder(window) else{return false};return region.bounds.contains(region.convert(CGPoint(x:focus.bounds.midX,y:focus.bounds.midY),from:focus))
    }
    func restore(){_ = previousAnchorFocus?.becomeFirstResponder()}
    #endif
    func hasOwnedFocus()->Bool{containsFocus(anchor) || containsFocus(popup)}
}
#if canImport(AppKit)
import AppKit
final class AWCTooltipRegionView:NSView{
    weak var focusContext:AWCNativeTooltipFocusContext?
    var controller:AWCTooltipController?,isAnchor=false,enabled=true,descriptionText=""
    private var focused=false,timer:Timer?
    override func hitTest(_ point:NSPoint)->NSView?{nil}
    override func isAccessibilityElement()->Bool{!isAnchor && enabled && controller?.isVisible==true}
    override func accessibilityRole()->NSAccessibility.Role?{.init(rawValue:"AXHelpTag")}
    override func accessibilityLabel()->String?{descriptionText}
    func observe(){
        guard enabled,timer==nil else{if !enabled{stop()};return}
        timer=Timer.scheduledTimer(withTimeInterval:1.0/60,repeats:true){[weak self] _ in MainActor.assumeIsolated{self?.check()}}
    }
    private func check(){
        guard let focusContext,let controller else{return}
        let inside=focusContext.containsFocus(self)
        if inside != focused{
            focused=inside
            if inside{
                if isAnchor{focusContext.previousAnchorFocus=window?.firstResponder as? NSView;controller.triggerFocused()}
                else{controller.popupFocused()}
            }else if !focusContext.hasOwnedFocus(){controller.focusLeftComponent()}
        }
    }
    func stop(){timer?.invalidate();timer=nil;focused=false}
}
struct AWCTooltipRegionBridge:NSViewRepresentable{
    let context:AWCNativeTooltipFocusContext,controller:AWCTooltipController,anchor:Bool,enabled:Bool,description:String
    func makeNSView(context:Context)->AWCTooltipRegionView{.init()}
    func updateNSView(_ view:AWCTooltipRegionView,context:Context){
        view.focusContext=self.context;view.controller=controller;view.isAnchor=anchor;view.enabled=enabled;view.descriptionText=description
        if anchor{self.context.anchor=view}else{self.context.popup=view};view.observe()
    }
    static func dismantleNSView(_ view:AWCTooltipRegionView,coordinator:()){view.stop();if view.isAnchor{view.focusContext?.anchor=nil}else{view.focusContext?.popup=nil}}
}
#elseif canImport(UIKit)
import UIKit
final class AWCTooltipRegionView:UIView{
    weak var focusContext:AWCNativeTooltipFocusContext?
    var controller:AWCTooltipController?,isAnchor=false,enabled=true
    private var regionFocused=false,timer:Timer?
    override func point(inside point:CGPoint,with event:UIEvent?)->Bool{false}
    func observe(){
        guard enabled,timer==nil else{if !enabled{stop()};return}
        timer=Timer.scheduledTimer(withTimeInterval:1.0/60,repeats:true){[weak self] _ in MainActor.assumeIsolated{self?.check()}}
    }
    private func check(){
        guard let focusContext,let controller else{return};let inside=focusContext.containsFocus(self)
        if inside != regionFocused{regionFocused=inside;if inside{if isAnchor{focusContext.previousAnchorFocus=window.flatMap{focusContext.responder($0)};controller.triggerFocused()}else{controller.popupFocused()}}else if !focusContext.hasOwnedFocus(){controller.focusLeftComponent()}}
    }
    func stop(){timer?.invalidate();timer=nil;regionFocused=false}
}
struct AWCTooltipRegionBridge:UIViewRepresentable{
    let context:AWCNativeTooltipFocusContext,controller:AWCTooltipController,anchor:Bool,enabled:Bool,description:String
    func makeUIView(context:Context)->AWCTooltipRegionView{.init()}
    func updateUIView(_ view:AWCTooltipRegionView,context:Context){view.focusContext=self.context;view.controller=controller;view.isAnchor=anchor;view.enabled=enabled;view.accessibilityLabel=description;view.isAccessibilityElement = !anchor && enabled && controller.isVisible;view.accessibilityTraits=[.staticText];if anchor{self.context.anchor=view}else{self.context.popup=view};view.observe()}
    static func dismantleUIView(_ view:AWCTooltipRegionView,coordinator:()){view.stop();if view.isAnchor{view.focusContext?.anchor=nil}else{view.focusContext?.popup=nil}}
}
#endif
