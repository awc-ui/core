import SwiftUI

struct AWCNativeFabMenu:View {
    let node:AWCNode
    let properties:[String:AWCValue]
    let theme:AWCTheme
    let onEvent:(AWCEvent)->Void
    let onOpenChanged:(Bool)->Void
    @Environment(\.awcFabMenuRegistry) private var registry
    @Environment(\.awcFabMenuController) private var suppliedController
    @Environment(\.awcFabMenuAppearance) private var appearance
    @Environment(\.awcFabMenuItemAppearance) private var itemAppearance
    @Environment(\.awcFabMenuItemOverrides) private var itemOverrides
    @Environment(\.awcEventDispatcher) private var dispatcher
    @Environment(\.awcEventTargetListeners) private var targetListeners
    @Environment(\.layoutDirection) private var direction
    @Environment(\.awcNativeDensity) private var inheritedDensity
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var ownedController=AWCFabMenuController()
    @State private var session:AWCFabMenuSession?
    private var controller:AWCFabMenuController {suppliedController ?? ownedController}
    private var items:[AWCNode] {node.children(inSlot:nil)}
    private var rtl:Bool {properties["dir"]?.string=="rtl" || (properties["dir"]?.string != "ltr" && direction == .rightToLeft)}
    private func descendants(_ nodes:[AWCNode])->[AWCNode] {nodes.flatMap{$0.tag=="md-fab-menu-item" ? [$0]:descendants($0.children)}}
    private func attach() {
        guard let registry else{return}
        let state=AWCFabMenuSession(id:node.id,controller:controller)
        session=state
        state.attach(registry:registry,properties:properties,items:descendants(items)) {open in
            onOpenChanged(open)
            let event=AWCEvent(name:open ? "mdOpen":"mdClose",tag:node.tag,nodeID:node.id,detail:.null)
            onEvent(AWCEventDispatcher.dispatch(event,through:dispatcher,cancelable:true,targetListeners:targetListeners).observedEvent)
        }
    }
    var body:some View {
        Color.clear.frame(width:0,height:0).allowsHitTesting(false).accessibilityHidden(true)
            .preference(key:AWCFabMenuEntries.self,value:entries)
            .onAppear {attach()}
            .onDisappear {session?.detach();session=nil}
            .onChange(of:properties) {old,new in
                session?.configure(properties:new,items:descendants(items))
                if old["open"] != new["open"] {controller.setAuthoredOpen(new["open"]?.bool == true)}
            }
            .onChange(of:node.children) {_,_ in session?.configure(properties:properties,items:descendants(items))}
    }
    private var entries:[AWCFabMenuEntry] {
        guard let session,let registry,properties["hidden"]?.bool != true else{return []}
        let variant=properties["variant"]?.string ?? "primary",tokens=theme.tokens.isEmpty ? AWCGeneratedTokens.light:theme.tokens
        let palette=["primary","secondary","tertiary"].contains(variant) ? variant:"primary"
        let defaults=AWCFabMenuItemAppearance(containerColor:appearance.itemContainerColor ?? tokens["--md-sys-color-"+palette+"-container"],
                                              labelColor:appearance.itemLabelColor ?? tokens["--md-sys-color-on-"+palette+"-container"])
            .merging(itemAppearance)
        let density=AWCNativeDensity.resolve(properties["density"]?.number,inherited:inheritedDensity)
        let gap=appearance.itemGap ?? (density == -4 ? 2:awcFabMenuToken(tokens,"--md-sys-spacing-gap-xs",4))
        let children=session.effectivePlacement=="up" ? Array(items.reversed()):items
        let scope=AWCEventDispatcher(id:node.id,parent:dispatcher) {context in
            if context.event.name=="mdClick",context.event.tag=="md-fab-menu-item" {session.activatedItem()}
        }
        let content=VStack(alignment:.trailing,spacing:CGFloat(gap)) {
            ForEach(children) {item in
                // Items are measured as the menu's parts in authored order (`component.item-1`…), as on Android.
                AWCNativeView(node:item,onEvent:onEvent)
                    .environment(\.awcInspectionAlias,.init(childID:item.id,parentID:node.id,part:"item-\((items.firstIndex{$0.id==item.id} ?? 0)+1)"))
            }
        }
        .fixedSize()
        .environment(\.awcTheme,theme)
        .environment(\.awcNativeDensity,density)
        .environment(\.layoutDirection,rtl ? .rightToLeft:.leftToRight)
        .environment(\.awcFabMenuItemAppearance,defaults)
        .environment(\.awcFabMenuItemOverrides,itemOverrides)
        .environment(\.awcEventDispatcher,scope)
        .environment(\.awcEventTargetListeners,targetListeners)
        .environment(\.awcFabMenuSession,session)
        .background {GeometryReader{geometry in Color.clear.preference(key:AWCFabMenuFrames.self,value:[node.id:geometry.frame(in:.named(registry.coordinateSpace))])}}
        .modifier(AWCFabMenuShell(closing:controller.isClosing,up:session.effectivePlacement=="up",reduceMotion:reduceMotion))
        .awcMenuAccessibility(label:properties["menuLabel"]?.string ?? "Actions",id:node.id)
        return [.init(id:node.id,session:session,rtl:rtl,content:AnyView(content))]
    }
}

private struct AWCFabMenuShell:ViewModifier {
    let closing:Bool,up:Bool,reduceMotion:Bool
    @State private var mounted=false
    func body(content:Content)->some View {
        let visible=reduceMotion || (mounted && !closing)
        content.opacity(visible ? 1:0)
            .scaleEffect(x:1,y:visible ? 1:0.8,anchor:up ? .bottomTrailing:.topTrailing)
            .animation(reduceMotion ? nil:closing ? .timingCurve(0.3,0,0.8,0.15,duration:0.15):.timingCurve(0.05,0.7,0.1,1,duration:0.15),value:visible)
            .onAppear {mounted=true}
    }
}
