import SwiftUI
import Observation
#if canImport(AppKit)
import AppKit
#elseif canImport(UIKit)
import UIKit
#endif

@Observable final class AWCTooltipRegistry{
    let coordinateSpace="awc-tooltip-\(UUID().uuidString)"
    @ObservationIgnored var controllers:[String:AWCTooltipController]=[:]
    @discardableResult @MainActor func escape()->Bool{var accepted=false;for controller in controllers.values{if controller.escape(){accepted=true}};return accepted}
}
private struct AWCTooltipRegistryKey:EnvironmentKey{static let defaultValue:AWCTooltipRegistry?=nil}
extension EnvironmentValues{var awcTooltipRegistry:AWCTooltipRegistry?{get{self[AWCTooltipRegistryKey.self]}set{self[AWCTooltipRegistryKey.self]=newValue}}}
struct AWCTooltipEntry:Identifiable{let id:String,anchor:Anchor<CGRect>,content:(CGRect,CGSize)->AnyView}
struct AWCTooltipEntries:PreferenceKey{
    static var defaultValue:[AWCTooltipEntry]{[]}
    static func reduce(value:inout[AWCTooltipEntry],nextValue:()->[AWCTooltipEntry]){value.append(contentsOf:nextValue())}
}
/// Places native popups above ordinary content in a real root viewport. Anchor
/// views keep their intrinsic layout; their popups never enlarge that layout.
public struct AWCTooltipScope<Content:View>:View{
    @State private var registry=AWCTooltipRegistry()
    private let content:Content
    public init(@ViewBuilder content:()->Content){self.content=content()}
    public var body:some View{
        ZStack{content}.frame(maxWidth:.infinity,maxHeight:.infinity)
            .environment(\.awcTooltipRegistry,registry)
            .background{AWCTooltipNativeHost(registry:registry).allowsHitTesting(false)}
            .overlayPreferenceValue(AWCTooltipEntries.self){entries in GeometryReader{geometry in
                ForEach(entries){entry in entry.content(geometry[entry.anchor],geometry.size).environment(\.awcTooltipRegistry,registry).frame(width:geometry.size.width,height:geometry.size.height)}
            }}.coordinateSpace(name:registry.coordinateSpace)
            .onKeyPress(.escape){registry.escape() ? .handled:.ignored}
    }
}
#if canImport(AppKit)
final class AWCTooltipHostView:NSView{
    weak var registry:AWCTooltipRegistry?
    private var monitor:Any?
    override func hitTest(_ point:NSPoint)->NSView?{nil}
    override func viewDidMoveToWindow(){
        super.viewDidMoveToWindow();dispose();guard window != nil else{return}
        monitor=NSEvent.addLocalMonitorForEvents(matching:.keyDown){[weak self] event in
            guard let self,event.window===self.window,event.keyCode==53 else{return event};return self.registry?.escape()==true ? nil:event
        }
    }
    func dispose(){if let monitor{NSEvent.removeMonitor(monitor);self.monitor=nil}}
}
struct AWCTooltipNativeHost:NSViewRepresentable{
    let registry:AWCTooltipRegistry
    func makeNSView(context:Context)->AWCTooltipHostView{let view=AWCTooltipHostView();view.registry=registry;return view}
    func updateNSView(_ view:AWCTooltipHostView,context:Context){view.registry=registry}
    static func dismantleNSView(_ view:AWCTooltipHostView,coordinator:()){view.dispose()}
}
#elseif canImport(UIKit)
final class AWCTooltipHostView:UIView{
    weak var registry:AWCTooltipRegistry?
    override func point(inside point:CGPoint,with event:UIEvent?)->Bool{false}
    override var keyCommands:[UIKeyCommand]?{[UIKeyCommand(input:UIKeyCommand.inputEscape,modifierFlags:[],action:#selector(escape))]}
    @objc private func escape(){registry?.escape()}
}
struct AWCTooltipNativeHost:UIViewRepresentable{
    let registry:AWCTooltipRegistry
    func makeUIView(context:Context)->AWCTooltipHostView{let view=AWCTooltipHostView();view.registry=registry;return view}
    func updateUIView(_ view:AWCTooltipHostView,context:Context){view.registry=registry}
}
#endif
