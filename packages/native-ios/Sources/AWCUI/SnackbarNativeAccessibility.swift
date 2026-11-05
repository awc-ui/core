import SwiftUI

#if canImport(AppKit)
import AppKit
final class AWCSnackbarStatusView:NSView {
    var nodeID="",label="",enabled=false,assertive=false
    override func hitTest(_ point:NSPoint)->NSView?{nil}
    override func isAccessibilityElement()->Bool{enabled}
    override func accessibilityRole()->NSAccessibility.Role?{.group}
    override func accessibilityRoleDescription()->String?{assertive ? "alert":"status"}
    override func accessibilityIdentifier()->String{nodeID}
    override func accessibilityLabel()->String?{label}
}
struct AWCSnackbarStatusBridge:NSViewRepresentable {
    let id:String,label:String,enabled:Bool,assertive:Bool
    func makeNSView(context:Context)->AWCSnackbarStatusView{.init()}
    func updateNSView(_ view:AWCSnackbarStatusView,context:Context){view.nodeID=id;view.label=label;view.enabled=enabled;view.assertive=assertive}
}
final class AWCSnackbarFocusView:NSView {
    var changed:(Bool)->Void={_ in}
    private var timer:Timer?,inside=false
    override func hitTest(_ point:NSPoint)->NSView?{nil}
    func setEnabled(_ enabled:Bool){
        guard enabled else{stop();return};guard timer==nil else{return}
        timer=Timer.scheduledTimer(withTimeInterval:1.0/60,repeats:true){[weak self] _ in MainActor.assumeIsolated{self?.check()}}
    }
    private func check(){
        guard let window else{return}
        let focused=window.firstResponder as? NSView
        let point=focused.map{convert($0.bounds.origin,from:$0)}
        let active=point.map{bounds.insetBy(dx:-0.5,dy:-0.5).contains($0)} ?? false
        // AWC controls report focus synchronously before activation. Replaying
        // that entry on a polling tick would incorrectly pause a new timer
        // deliberately started by the fallback action's click handler.
        if focused is AWCNativeButtonFocusView{inside=active;return}
        if active != inside{inside=active;changed(active)}
    }
    func stop(){timer?.invalidate();timer=nil;inside=false}
}
struct AWCSnackbarFocusObserver:NSViewRepresentable {
    let enabled:Bool,changed:(Bool)->Void
    func makeNSView(context:Context)->AWCSnackbarFocusView{.init()}
    func updateNSView(_ view:AWCSnackbarFocusView,context:Context){view.changed=changed;view.setEnabled(enabled)}
    static func dismantleNSView(_ view:AWCSnackbarFocusView,coordinator:()){view.stop()}
}
#elseif canImport(UIKit)
import UIKit
/// Live-region status. UIKit has no status/alert role: as for AWCUI's other UIKit role hints, the hint carries the
/// AppKit role description ("status" / "alert").
final class AWCSnackbarStatusView:UIView {
    var nodeID="",label="",enabled=false,assertive=false
    override func point(inside point:CGPoint,with event:UIEvent?)->Bool{false}
}
struct AWCSnackbarStatusBridge:UIViewRepresentable {
    let id:String,label:String,enabled:Bool,assertive:Bool
    func makeUIView(context:Context)->AWCSnackbarStatusView{let view=AWCSnackbarStatusView();view.isUserInteractionEnabled=false;view.isAccessibilityElement=true;return view}
    func updateUIView(_ view:AWCSnackbarStatusView,context:Context){view.nodeID=id;view.label=label;view.enabled=enabled;view.assertive=assertive;view.accessibilityIdentifier=id;view.accessibilityLabel=label;view.isAccessibilityElement=enabled;view.accessibilityTraits=[.staticText];view.accessibilityHint=assertive ? "alert":"status"}
}
final class AWCSnackbarFocusView:UIView {
    var changed:(Bool)->Void={_ in}
    private var timer:Timer?,inside=false
    override func point(inside point:CGPoint,with event:UIEvent?)->Bool{false}
    func setEnabled(_ enabled:Bool){
        guard enabled else{stop();return};guard timer==nil else{return}
        timer=Timer.scheduledTimer(withTimeInterval:1.0/60,repeats:true){[weak self] _ in MainActor.assumeIsolated{self?.check()}}
    }
    private func responder(_ view:UIView)->UIView?{if view.isFirstResponder{return view};return view.subviews.lazy.compactMap{self.responder($0)}.first}
    private func check(){
        guard let window else{return};let active=responder(window).map{bounds.contains(convert($0.bounds.origin,from:$0))} ?? false
        if active != inside{inside=active;changed(active)}
    }
    func stop(){timer?.invalidate();timer=nil;inside=false}
}
struct AWCSnackbarFocusObserver:UIViewRepresentable {
    let enabled:Bool,changed:(Bool)->Void
    func makeUIView(context:Context)->AWCSnackbarFocusView{.init()}
    func updateUIView(_ view:AWCSnackbarFocusView,context:Context){view.changed=changed;view.setEnabled(enabled)}
    static func dismantleUIView(_ view:AWCSnackbarFocusView,coordinator:()){view.stop()}
}
#endif
