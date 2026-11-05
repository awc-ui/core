import SwiftUI
import Observation

@Observable final class AWCSnackbarRegistry {
    let coordinateSpace="awc-snackbar-\(UUID().uuidString)"
    var viewport=CGSize.zero
    var ranks:[String:Int]=[:]
    @ObservationIgnored var controllers:[String:AWCSnackbarController]=[:]
    @ObservationIgnored var order:[String]=[]
    @MainActor func register(_ id:String,_ controller:AWCSnackbarController){if controllers[id]==nil{order.append(id)};controllers[id]=controller}
    @MainActor func unregister(_ id:String){controllers[id]=nil;ranks[id]=nil;order.removeAll{$0==id}}
    @MainActor func raise(_ id:String){
        let peers=order.filter{$0 != id && controllers[$0]?.isOpen==true}.sorted{(ranks[$0] ?? 0)<(ranks[$1] ?? 0)}
        var values:[String:Int]=[:];for (index,peer) in peers.enumerated(){values[peer]=index+1};values[id]=peers.count+1;ranks=values
    }
    @discardableResult @MainActor func escape()->Bool{
        // Every open source host owns its own Escape listener. Do not invent
        // topmost-only dismissal: each closeable peer schedules its own ripple.
        let active=controllers.values.filter(\.acceptsEscape)
        for controller in active{controller.requestRippleDismiss()}
        return !active.isEmpty
    }
}
private struct AWCSnackbarRegistryKey:EnvironmentKey{static let defaultValue:AWCSnackbarRegistry?=nil}
extension EnvironmentValues{var awcSnackbarRegistry:AWCSnackbarRegistry?{get{self[AWCSnackbarRegistryKey.self]}set{self[AWCSnackbarRegistryKey.self]=newValue}}}
struct AWCSnackbarEntry:Identifiable {let id:String,content:AnyView}
struct AWCSnackbarEntries:PreferenceKey {
    static var defaultValue:[AWCSnackbarEntry]{[]}
    static func reduce(value:inout [AWCSnackbarEntry],nextValue:()->[AWCSnackbarEntry]){value.append(contentsOf:nextValue())}
}
/// Owns the real overlay viewport. Place it at the application's content root;
/// Snackbars inside it reserve no layout space and float above ordinary content.
public struct AWCSnackbarScope<Content:View>:View {
    @State private var registry=AWCSnackbarRegistry()
    private let content:Content
    public init(@ViewBuilder content:()->Content){self.content=content()}
    public var body:some View{
        ZStack{content}.frame(maxWidth:.infinity,maxHeight:.infinity)
            .environment(\.awcSnackbarRegistry,registry)
            .background{GeometryReader{geometry in Color.clear.onChange(of:geometry.size,initial:true){_,size in registry.viewport=size}}.allowsHitTesting(false)}
            .background{AWCSnackbarNativeHost(registry:registry).allowsHitTesting(false)}
            .overlayPreferenceValue(AWCSnackbarEntries.self){entries in
                GeometryReader{geometry in
                    ForEach(entries){entry in
                        entry.content.environment(\.awcSnackbarRegistry,registry)
                            .frame(width:geometry.size.width,height:geometry.size.height)
                            .zIndex(Double(registry.ranks[entry.id] ?? 0))
                    }
                }
            }.coordinateSpace(name:registry.coordinateSpace)
            .onKeyPress(.escape){registry.escape() ? .handled:.ignored}
    }
}
#if canImport(AppKit)
import AppKit
final class AWCSnackbarHostView:NSView {
    weak var registry:AWCSnackbarRegistry?
    private var monitor:Any?
    override func hitTest(_ point:NSPoint)->NSView?{nil}
    override func viewDidMoveToWindow(){
        super.viewDidMoveToWindow();dispose()
        guard window != nil else{return}
        monitor=NSEvent.addLocalMonitorForEvents(matching:.keyDown){[weak self] event in
            guard let self,event.window === self.window,event.keyCode==53 else{return event}
            return self.registry?.escape()==true ? nil:event
        }
    }
    func dispose(){if let monitor{NSEvent.removeMonitor(monitor);self.monitor=nil}}
}
struct AWCSnackbarNativeHost:NSViewRepresentable {
    let registry:AWCSnackbarRegistry
    func makeNSView(context:Context)->AWCSnackbarHostView{let view=AWCSnackbarHostView();view.registry=registry;return view}
    func updateNSView(_ view:AWCSnackbarHostView,context:Context){view.registry=registry}
    static func dismantleNSView(_ view:AWCSnackbarHostView,coordinator:()){view.dispose()}
}
#elseif canImport(UIKit)
import UIKit
final class AWCSnackbarHostView:UIView {
    weak var registry:AWCSnackbarRegistry?
    override func point(inside point:CGPoint,with event:UIEvent?)->Bool{false}
    override var keyCommands:[UIKeyCommand]?{[UIKeyCommand(input:UIKeyCommand.inputEscape,modifierFlags:[],action:#selector(escape))]}
    @objc private func escape(){registry?.escape()}
}
struct AWCSnackbarNativeHost:UIViewRepresentable {
    let registry:AWCSnackbarRegistry
    func makeUIView(context:Context)->AWCSnackbarHostView{let view=AWCSnackbarHostView();view.registry=registry;return view}
    func updateUIView(_ view:AWCSnackbarHostView,context:Context){view.registry=registry}
}
#endif
