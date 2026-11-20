import SwiftUI
import Observation

struct AWCFabMenuAnchorPresentation: Equatable {
    var open=false
    var variant="primary"
    var icon:String?
    var iconOpacity=1.0
}

/// A scope owns the actual native anchor geometry and focus endpoints. It does
/// not synthesize an anchor or change the authored component tree.
@Observable final class AWCFabMenuRegistry {
    let coordinateSpace="awc-fab-menu-\(UUID().uuidString)"
    var frames:[String:CGRect]=[:]
    var viewport=CGSize.zero
    var windowBounds:CGRect?
    var presentations:[String:AWCFabMenuAnchorPresentation]=[:]
    @ObservationIgnored var handles:[String:AWCButtonFocusHandle]=[:]
    @ObservationIgnored var fabControllers:[String:AWCFabController]=[:]
    @ObservationIgnored var sessions:[String:AWCFabMenuSession]=[:]
    @ObservationIgnored var render:(() async -> Void)?
    @ObservationIgnored private var mounting:[CheckedContinuation<Void,Never>]=[]
    @MainActor func boundary() async {
        if render == nil {await withCheckedContinuation {mounting.append($0)}}
        await render?()
    }
    @MainActor func mounted(_ callback:@escaping () async -> Void) {
        render=callback;let waiting=mounting;mounting=[];waiting.forEach{$0.resume()}
    }
    @MainActor func unmount() {
        render=nil;let waiting=mounting;mounting=[];waiting.forEach{$0.resume()}
        for session in Array(sessions.values) {session.detach()}
        sessions=[:];handles=[:];fabControllers=[:];presentations=[:]
    }
    @MainActor func pointerDown(_ id:String) {
        for session in sessions.values where session.anchor==id {
            session.anchorFocusedAtPress=handles[id]?.isFocused == true
        }
    }
    @MainActor func activateAnchor(_ id:String,source:AWCActivationMetadata.Source)->Bool {
        let anchored=sessions.values.filter{$0.anchor==id}
        for session in anchored {session.activateAnchor(source:source)}
        return !anchored.isEmpty
    }
    @MainActor func key(_ id:String,_ key:String,shift:Bool,modified:Bool)->Bool {
        for session in sessions.values where session.anchor==id || session.items.contains(where:{$0.id==id}) {
            if session.key(id,key,shift:shift,modified:modified) {return true}
        }
        return false
    }
    @MainActor func outsideClick(_ point:CGPoint) {
        for session in sessions.values where session.controller.isOpen {
            if frames[session.anchor]?.contains(point) != true && frames[session.id]?.contains(point) != true {
                session.anchorFocusQuiet=true;session.controller.beginClose()
            }
        }
    }
}

@Observable final class AWCFabMenuSession {
    let id:String
    let controller:AWCFabMenuController
    var anchor=""
    var placement="up"
    var variant="primary"
    var effectivePlacement="up"
    var items:[AWCNode]=[]
    var activeID:String?
    var rovingID:String?
    @ObservationIgnored weak var registry:AWCFabMenuRegistry?
    @ObservationIgnored var anchorFocusedAtPress=false
    @ObservationIgnored private var openingFocus=false
    @ObservationIgnored private var focusGeneration=0
    @ObservationIgnored private var morphTask:Task<Void,Never>?
    @ObservationIgnored private var focusTask:Task<Void,Never>?
    @ObservationIgnored private var typeahead=""
    @ObservationIgnored private var lastTypeahead=Date.distantPast
    init(id:String,controller:AWCFabMenuController) {self.id=id;self.controller=controller}
    @MainActor func resolvePlacement() {
        if placement != "auto" {effectivePlacement=placement;return}
        guard let registry,let bounds=registry.frames[anchor] else {effectivePlacement="up";return}
        let viewport=registry.windowBounds ?? CGRect(origin:.zero,size:registry.viewport)
        effectivePlacement=bounds.minY-viewport.minY > viewport.maxY-bounds.maxY ? "up":"down"
    }
    @MainActor func attach(registry:AWCFabMenuRegistry,properties:[String:AWCValue],items:[AWCNode],changed:@escaping (Bool)->Void) {
        self.registry=registry;configure(properties:properties,items:items);registry.sessions[id]=self
        controller.attach(initialOpen:properties["open"]?.bool == true,quick:properties["quick"]?.bool == true,
            renderBoundary:{[weak registry] in await registry?.boundary()},
            onChange:{[weak self] open in
                guard let self else{return}
                // User event callbacks run before source opening side effects,
                // and may synchronously close/disconnect the menu.
                changed(open)
                guard self.registry != nil else{return}
                if open && self.controller.isOpen {self.opened(initial:false)}
                else if !open {self.closed()}
            },onReopen:{[weak self] in self?.opened(initial:false)})
        if controller.isOpen {opened(initial:true)}
    }
    @MainActor func configure(properties:[String:AWCValue],items:[AWCNode]) {
        let previousAnchor=anchor,previousVariant=variant
        anchor=properties["anchor"]?.string ?? "";placement=properties["placement"]?.string ?? "up";variant=properties["variant"]?.string ?? "primary"
        self.items=items;controller.update(quick:properties["quick"]?.bool == true)
        if previousAnchor != anchor {registry?.presentations[previousAnchor]=nil}
        resolvePlacement()
        if controller.isOpen && (previousAnchor != anchor || previousVariant != variant) {morph(open:true)}
    }
    @MainActor func activateAnchor(source:AWCActivationMetadata.Source) {
        openingFocus=source != .pointer || anchorFocusedAtPress
        anchorFocusedAtPress=false
        if controller.isPresented {anchorFocusQuiet=source == .pointer;controller.beginClose()}
        else if !controller.showImmediatelyIfReady() {Task {await controller.show()}}
    }
    @MainActor private func opened(initial:Bool) {
        resolvePlacement();morph(open:true);activeID=items.first?.id;rovingID=nil
        guard !initial else{return}
        focusGeneration &+= 1;let generation=focusGeneration,shouldFocus=openingFocus
        openingFocus=false
        focusTask?.cancel();focusTask=Task { @MainActor [weak self] in
            guard let self else{return};await self.registry?.boundary()
            guard !Task.isCancelled,self.focusGeneration==generation,self.controller.isOpen,!self.controller.isClosing else{return}
            if shouldFocus {self.focusItem(0)}
        }
    }
    @MainActor private func closed() {
        focusGeneration &+= 1;focusTask?.cancel();focusTask=nil
        activeID=nil;rovingID=nil;morph(open:false);focusAnchor(visible:!anchorFocusQuiet);anchorFocusQuiet=false
    }
    @MainActor private func morph(open:Bool) {
        guard let registry,!anchor.isEmpty else{return}
        morphTask?.cancel()
        var value=registry.presentations[anchor] ?? .init()
        value.open=open;value.variant=variant;value.iconOpacity=0
        registry.presentations[anchor]=value
        let anchor=anchor
        morphTask=Task { @MainActor [weak registry] in
            try? await Task.sleep(for:.milliseconds(120))
            guard !Task.isCancelled,let registry else{return}
            var value=registry.presentations[anchor] ?? .init()
            value.icon=open ? "close":nil;value.iconOpacity=1
            registry.presentations[anchor]=value
            await registry.fabControllers[anchor]?.setMenuIcon(open ? "close":nil)
        }
    }
    @MainActor func detach() {
        focusGeneration &+= 1;focusTask?.cancel();morphTask?.cancel()
        let fab=registry?.fabControllers[anchor]
        Task {await fab?.setMenuIcon(nil)}
        controller.detach();registry?.sessions[id]=nil;registry?.presentations[anchor]=nil;registry=nil
    }
    @MainActor func focused(_ id:String) {activeID=id;rovingID=nil}
    /// A press on a non-focusable item blurs the focused element, as Chrome's mousedown on an inert target.
    @MainActor func blurFocus() {for id in [anchor]+items.map(\.id) {registry?.handles[id]?.resignFocus?()}}
    /// A quiet return (no focus indicator) after a pointer activation, as Chrome's :focus-visible heuristics.
    @ObservationIgnored var anchorFocusQuiet=false
    @MainActor func focusAnchor(visible:Bool=true) {
        activeID=nil;rovingID=nil;let handle=registry?.handles[anchor]
        _ = visible ? handle?.requestFocus?() : (handle?.requestPointerFocus?() ?? handle?.requestFocus?())
    }
    @MainActor func focusItem(_ index:Int,visible:Bool=true) {
        guard !items.isEmpty else{return}
        let i=(index % items.count+items.count) % items.count,id=items[i].id
        activeID=id;rovingID=visible ? id:nil
        _ = registry?.handles[id]?.requestFocus?()
    }
    @MainActor func activatedItem(pointer:Bool=false) {anchorFocusQuiet=pointer;controller.beginClose();focusAnchor(visible:!pointer)}
    @MainActor func key(_ id:String,_ key:String,shift:Bool,modified:Bool)->Bool {
        guard controller.isOpen else{return false}
        if id==anchor {
            if key=="Escape" {controller.beginClose();return true}
            if (key=="ArrowUp" && effectivePlacement=="up") || (key=="ArrowDown" && effectivePlacement=="down") {focusItem(0);return true}
            if key=="Tab" && !shift {focusItem(0,visible:false);return true}
            return false
        }
        guard let index=items.firstIndex(where:{$0.id==id}) else{return false}
        switch key {
        case "Escape":controller.beginClose();focusAnchor();return true
        case "Home":focusItem(0);return true
        case "End":focusItem(items.count-1);return true
        case "ArrowUp","ArrowDown":
            let away=(key=="ArrowUp") == (effectivePlacement=="up")
            if away {focusItem(index+1)} else if index==0 {focusAnchor()} else {focusItem(index-1)}
            return true
        case "Tab":
            if shift {if index==0 {focusAnchor()} else {focusItem(index-1,visible:false)};return true}
            if index==items.count-1 {controller.beginClose();return false}
            focusItem(index+1,visible:false);return true
        default:
            guard key.count==1,!modified else{return false}
            let now=Date();if now.timeIntervalSince(lastTypeahead)>0.3 {typeahead=""}
            lastTypeahead=now;typeahead += key.lowercased()
            for offset in 1...items.count {
                let next=(index+offset)%items.count,item=items[next]
                let label=awcFabMenuTypeaheadLabel(item)
                if label.lowercased().hasPrefix(typeahead) {focusItem(next);break}
            }
            return false
        }
    }
}

private struct AWCFabMenuRegistryKey:EnvironmentKey {static let defaultValue:AWCFabMenuRegistry?=nil}
private struct AWCFabMenuSessionKey:EnvironmentKey {static let defaultValue:AWCFabMenuSession?=nil}
extension EnvironmentValues {
    var awcFabMenuRegistry:AWCFabMenuRegistry? {get{self[AWCFabMenuRegistryKey.self]} set{self[AWCFabMenuRegistryKey.self]=newValue}}
    var awcFabMenuSession:AWCFabMenuSession? {get{self[AWCFabMenuSessionKey.self]} set{self[AWCFabMenuSessionKey.self]=newValue}}
}
struct AWCFabMenuFrames:PreferenceKey {
    static var defaultValue:[String:CGRect] {[:]}
    static func reduce(value:inout [String:CGRect],nextValue:()->[String:CGRect]) {value.merge(nextValue()){_,new in new}}
}
struct AWCFabMenuEntry:Identifiable {
    let id:String
    let session:AWCFabMenuSession
    let rtl:Bool
    let content:AnyView
}
struct AWCFabMenuEntries:PreferenceKey {
    static var defaultValue:[AWCFabMenuEntry] {[]}
    static func reduce(value:inout [AWCFabMenuEntry],nextValue:()->[AWCFabMenuEntry]) {value.append(contentsOf:nextValue())}
}

/// Place the authored anchor and menu as separate children in this scope.
/// Menus float above the content without adding a scrim or taking its layout space.
public struct AWCFabMenuScope<Content:View>:View {
    @State private var registry=AWCFabMenuRegistry()
    private let content:Content
    public init(@ViewBuilder content:()->Content) {self.content=content()}
    public var body:some View {
        ZStack {content}
            .frame(maxWidth:.infinity,maxHeight:.infinity)
            .environment(\.awcFabMenuRegistry,registry)
            .background {
                GeometryReader {geometry in
                    Color.clear.onChange(of:geometry.size,initial:true){_,size in registry.viewport=size}
                }.allowsHitTesting(false)
                AWCFabMenuNativeHost(registry:registry).allowsHitTesting(false)
            }
            .overlayPreferenceValue(AWCFabMenuEntries.self) {entries in
                GeometryReader {geometry in
                    ForEach(entries) {entry in
                        if entry.session.controller.isPresented,let anchor=registry.frames[entry.session.anchor] {
                            // Source host while open: position fixed, inset 0 (the scope viewport).
                            Color.clear.frame(width:geometry.size.width,height:geometry.size.height).allowsHitTesting(false).accessibilityHidden(true)
                                .awcInspect(nodeID:entry.id,part:"overlay",name:"md-fab-menu overlay"){_ in ["display":"SwiftUI overlay","direction":.string(entry.rtl ? "rtl":"ltr")]}
                            entry.content
                                .environment(\.awcFabMenuRegistry,registry)
                                .environment(\.awcFabMenuSession,entry.session)
                                .fixedSize()
                                .frame(width:geometry.size.width,height:geometry.size.height,alignment:entry.session.effectivePlacement=="up" ? (entry.rtl ? .bottomLeading:.bottomTrailing):(entry.rtl ? .topLeading:.topTrailing))
                                .offset(x:entry.rtl ? anchor.minX:anchor.maxX-geometry.size.width,
                                        y:entry.session.effectivePlacement=="up" ? 0:anchor.maxY+8)
                                .modifier(AWCFabMenuUpPosition(up:entry.session.effectivePlacement=="up",bottom:anchor.minY-8,scopeHeight:geometry.size.height))
                                .environment(\.layoutDirection,.leftToRight)
                        }
                    }
                }.allowsHitTesting(entries.contains{$0.session.controller.isPresented})
            }
            .coordinateSpace(name:registry.coordinateSpace)
            .onPreferenceChange(AWCFabMenuFrames.self) {registry.frames=$0}
    }
}

private struct AWCFabMenuUpPosition:ViewModifier {
    let up:Bool,bottom:CGFloat,scopeHeight:CGFloat
    @ViewBuilder func body(content:Content)->some View {
        // The content's inner alignment is changed in the menu renderer for up;
        // this translates its bottom edge into the measured anchor gap.
        content.offset(y:up ? bottom-scopeHeight:0)
    }
}
