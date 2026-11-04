import SwiftUI
import Observation
#if canImport(AppKit)
import AppKit
#elseif canImport(UIKit)
import UIKit
#endif

/// A mounted native group and its real focus destination. Nothing here opens,
/// closes or synthesizes a popup: presentation remains owned by the application.
@Observable final class AWCPopupTarget {
    let id:String
    let identity=UUID()
    @ObservationIgnored var focusGroup:(()->Bool)?
    @ObservationIgnored var handles:[String:AWCButtonFocusHandle]=[:]
    @ObservationIgnored var order:[String]=[]
    /// Escape on a control inside the target's scope that the control itself does not handle (Chrome: keydown bubbles
    /// to the popup host, e.g. md-color-picker closing its popover from the focused trigger).
    @ObservationIgnored var escape:(()->Bool)?
    #if canImport(AppKit)
    @ObservationIgnored weak var view:NSView?
    #elseif canImport(UIKit)
    @ObservationIgnored weak var view:UIView?
    #endif
    init(id:String){self.id=id}
    func register(_ id:String,_ handle:AWCButtonFocusHandle){if handles[id]==nil{order.append(id)};handles[id]=handle}
    func unregister(_ id:String){handles[id]=nil;order.removeAll{$0==id}}
    func focus()->Bool {
        for id in order {if handles[id]?.requestFocus?()==true{return true}}
        return focusGroup?() ?? false
    }
}
@Observable final class AWCPopupRegistry {
    var targets:[String:AWCPopupTarget]=[:]
    var focusActionLabel:String
    init(label:String){focusActionLabel=label}
    func mount(_ target:AWCPopupTarget){if !target.id.isEmpty{targets[target.id]=target}}
    func unmount(_ target:AWCPopupTarget){if targets[target.id]===target{targets[target.id]=nil}}
}
struct AWCNativePopupRelationship {
    let kind:String?
    let expanded:Bool
    let target:AWCPopupTarget?
    let focusActionLabel:String
}
private struct AWCPopupRegistryKey:EnvironmentKey {static let defaultValue:AWCPopupRegistry?=nil}
private struct AWCPopupTargetKey:EnvironmentKey {static let defaultValue:AWCPopupTarget?=nil}
extension EnvironmentValues {
    var awcPopupRegistry:AWCPopupRegistry?{get{self[AWCPopupRegistryKey.self]}set{self[AWCPopupRegistryKey.self]=newValue}}
    var awcPopupTarget:AWCPopupTarget?{get{self[AWCPopupTargetKey.self]}set{self[AWCPopupTargetKey.self]=newValue}}
}
/// Shares authored popup IDs between controls and actual mounted popup content.
public struct AWCPopupScope<Content:View>:View {
    @State private var registry:AWCPopupRegistry
    private let content:Content
    private let focusActionLabel:String
    public init(focusActionLabel:String="Move to popup",@ViewBuilder content:()->Content){_registry=State(initialValue:.init(label:focusActionLabel));self.content=content();self.focusActionLabel=focusActionLabel}
    public var body:some View {content.environment(\.awcPopupRegistry,registry).onChange(of:focusActionLabel){_,value in registry.focusActionLabel=value}}
}
/// Register the content actually controlled by a trigger's `controls` property.
/// The accessibility action focuses its first eligible AWC control, or its native
/// group when no such descendant is present. Unmounted targets never resolve.
public struct AWCPopupTargetScope<Content:View>:View {
    private let id:String, content:Content
    @State private var target:AWCPopupTarget
    @Environment(\.awcPopupRegistry) private var registry
    public init(id:String,@ViewBuilder content:()->Content){self.id=id;self.content=content();_target=State(initialValue:.init(id:id))}
    public var body:some View {
        content.environment(\.awcPopupTarget,target)
            .background{AWCPopupTargetBridge(target:target)}
            .accessibilityElement(children:.contain)
            .onAppear{registry?.mount(target)}
            .onChange(of:id){_,value in registry?.unmount(target);target=AWCPopupTarget(id:value);registry?.mount(target)}
            .onDisappear{registry?.unmount(target)}
    }
}
#if canImport(AppKit)
private final class AWCPopupGroupView:NSView {
    var target:AWCPopupTarget?
    override var acceptsFirstResponder:Bool {window != nil && !isHidden}
    override func hitTest(_ point:NSPoint)->NSView? {nil}
    override func isAccessibilityElement()->Bool {true}
    override func accessibilityRole()->NSAccessibility.Role? {.group}
    override func accessibilityIdentifier()->String {target?.id ?? ""}
    override func isAccessibilityFocused()->Bool {window?.firstResponder===self}
}
private struct AWCPopupTargetBridge:NSViewRepresentable {
    let target:AWCPopupTarget
    func makeNSView(context:Context)->AWCPopupGroupView{AWCPopupGroupView()}
    func updateNSView(_ view:AWCPopupGroupView,context:Context){view.target=target;target.view=view;target.focusGroup={ [weak view] in guard let view,let window=view.window else{return false};return window.makeFirstResponder(view)}}
    static func dismantleNSView(_ view:AWCPopupGroupView,coordinator:()){view.target?.focusGroup=nil;view.target?.view=nil}
}
#elseif canImport(UIKit)
private final class AWCPopupGroupView:UIView {
    override var canBecomeFirstResponder:Bool {window != nil && !isHidden}
    override func point(inside point:CGPoint,with event:UIEvent?)->Bool {false}
}
private struct AWCPopupTargetBridge:UIViewRepresentable {
    let target:AWCPopupTarget
    func makeUIView(context:Context)->AWCPopupGroupView{AWCPopupGroupView()}
    func updateUIView(_ view:AWCPopupGroupView,context:Context){view.isAccessibilityElement=true;view.accessibilityIdentifier=target.id;target.view=view;target.focusGroup={ [weak view] in guard let view,view.window != nil else{return false};let accepted=view.becomeFirstResponder();if accepted{UIAccessibility.post(notification:.layoutChanged,argument:view)};return accepted}}
    static func dismantleUIView(_ view:AWCPopupGroupView,coordinator:()){ }
}
#endif
