import SwiftUI

struct AWCNativeGroupChildGeometry {
    let size: String
    let shape: String
    let connected: Bool
    let left: Bool
    let right: Bool
    let density: Double
    let fullWidth: Bool
    let maximumHeight: CGFloat?
    let motionDelta: CGFloat
    var minimumWidth: CGFloat? { connected && ["xs", "sm"].contains(size) ? 48 : nil }
    func corners(icon: Bool, selected: Bool, pressed: Bool) -> AWCNativeIconButtonCorners? {
        guard connected, left || right else { return nil }
        let index = ["xs","sm","md","lg","xl"].firstIndex(of: size) ?? 1
        let inner: CGFloat = [4,8,8,16,20][index]
        if pressed { let radius: CGFloat = [2,4,4,8,12][index]; return .init(start: radius, end: radius) }
        if selected { let radius: CGFloat = [16,20,24,28,48][index]; return .init(start: radius, end: radius) }
        let outer: CGFloat = shape == "square" ? inner : (icon ? [16,20,28,48,68] : [16,20,24,28,48])[index]
        return .init(start: left ? inner : outer, end: right ? inner : outer)
    }
}
struct AWCNativeButtonGroupContext {
    let selection: (String) -> Bool?
    let commit: (String, Bool) -> Void
    let activate: (String, AWCActivationMetadata) -> Void
    let press: (String) -> Void
    let density: Double
    let motionDelta: (String) -> CGFloat
    let properties: (String) -> [String:AWCValue]?
    let inject: ([String:[String:AWCValue]],Int?) -> Void
    let depth: Int
}
private struct AWCNativeGroupGeometryKey: EnvironmentKey { static let defaultValue: AWCNativeGroupChildGeometry? = nil }
private struct AWCNativeGroupContextKey: EnvironmentKey { static let defaultValue: AWCNativeButtonGroupContext? = nil }
extension EnvironmentValues {
    var awcNativeGroupGeometry: AWCNativeGroupChildGeometry? { get { self[AWCNativeGroupGeometryKey.self] } set { self[AWCNativeGroupGeometryKey.self] = newValue } }
    var awcNativeGroupContext: AWCNativeButtonGroupContext? { get { self[AWCNativeGroupContextKey.self] } set { self[AWCNativeGroupContextKey.self] = newValue } }
}
private struct AWCGroupSelectionPreference: PreferenceKey {
    static var defaultValue: [String:[Bool]] = [:]
    static func reduce(value: inout [String:[Bool]], nextValue: () -> [String:[Bool]]) { value.merge(nextValue()) { _, new in new } }
}
public extension View {
    /// Actual native child state, preserving authored order and duplicate values.
    func awcButtonGroupSelection(rootID: String, onChange: @escaping ([Bool]) -> Void) -> some View {
        onPreferenceChange(AWCGroupSelectionPreference.self) { values in if let selected = values[rootID] { onChange(selected) } }
    }
}
private struct AWCGroupFlexibleChild: LayoutValueKey { static let defaultValue = false }
private struct AWCGroupBoxExtras: LayoutValueKey { static let defaultValue: CGFloat = 0 }

/// CSS inline-flex: fixed children do not compress; full-width flex children
/// share free space with min/max constraints and may overflow a too-small group.
struct AWCNativeButtonGroupLayout: Layout {
    let appearance: AWCButtonGroupAppearance
    let fullWidth: Bool
    let gap: CGFloat
    let rtl: Bool
    var stretchesHeight = false
    func widths(_ proposal: ProposedViewSize, _ subviews: Subviews) -> [CGFloat] {
        let intrinsic = subviews.map { $0.sizeThatFits(.unspecified).width }
        guard fullWidth, let total = proposal.width else { return intrinsic }
        let free = total - gap * CGFloat(max(0, subviews.count - 1))
        var result = intrinsic, active = Set(subviews.indices.filter { subviews[$0][AWCGroupFlexibleChild.self] })
        var fixed = subviews.indices.filter { !active.contains($0) }.reduce(CGFloat.zero) { $0 + intrinsic[$1] }
        while !active.isEmpty {
            let extras = active.reduce(CGFloat.zero) { $0 + subviews[$1][AWCGroupBoxExtras.self] }
            let share = max(0, (free - fixed - extras) / CGFloat(active.count))
            func proposed(_ i: Int) -> CGFloat { share + subviews[i][AWCGroupBoxExtras.self] }
            let clamped = active.filter { abs(subviews[$0].sizeThatFits(.init(width: proposed($0), height: nil)).width - proposed($0)) > 0.001 }
            if clamped.isEmpty { for i in active { result[i] = proposed(i) }; break }
            for i in clamped { result[i] = subviews[i].sizeThatFits(.init(width: proposed(i), height: nil)).width; fixed += result[i]; active.remove(i) }
        }
        return result
    }
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let intrinsic = subviews.map { $0.sizeThatFits(.unspecified) }
        let naturalWidth = intrinsic.reduce(CGFloat.zero) { $0 + $1.width } + gap * CGFloat(max(0, intrinsic.count-1))
        let minWidth = CGFloat(appearance.minWidth ?? 0), minHeight = CGFloat(appearance.minHeight ?? 0)
        let preferred = fullWidth ? proposal.width ?? naturalWidth : appearance.width.map { CGFloat($0) } ?? naturalWidth
        let width = max(minWidth, min(CGFloat(appearance.maxWidth ?? .infinity), preferred))
        let childWidths = widths(.init(width: width, height: nil), subviews)
        let naturalHeight = subviews.indices.map { subviews[$0].sizeThatFits(.init(width: childWidths[$0], height: nil)).height }.max() ?? 0
        let height = max(minHeight, min(CGFloat(appearance.maxHeight ?? .infinity), CGFloat(appearance.height ?? Double(stretchesHeight ? max(naturalHeight,proposal.height ?? 0):naturalHeight))))
        return .init(width: width, height: height)
    }
    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let sizes = widths(.init(width: bounds.width, height: bounds.height), subviews)
        var x = rtl ? bounds.maxX : bounds.minX
        for i in subviews.indices {
            if rtl { x -= sizes[i] }
            subviews[i].place(at: .init(x:x,y:bounds.minY), anchor:.topLeading, proposal:.init(width:sizes[i],height:bounds.height))
            x += rtl ? -gap : sizes[i]+gap
        }
    }
}

struct AWCNativeButtonGroupView: View {
    let node: AWCNode
    let onEvent: (AWCEvent) -> Void
    @State private var state: AWCNativeButtonGroupState
    @State private var focus = AWCButtonFocusGroup()
    @State private var initialMotionEnabled: Bool
    @Environment(\.awcButtonAppearance) private var buttonAppearance
    @Environment(\.awcIconButtonAppearance) private var iconAppearance
    @Environment(\.awcThemeTokens) private var tokens
    @Environment(\.awcButtonGroupAppearance) private var appearance
    @Environment(\.awcNativeGroupContext) private var parentContext
    @Environment(\.awcButtonFocusGroup) private var parentFocus
    @Environment(\.awcEventDispatcher) private var dispatcher
    @Environment(\.awcEventTargetListeners) private var listeners
    @Environment(\.layoutDirection) private var inheritedDirection
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    init(node: AWCNode, onEvent: @escaping (AWCEvent) -> Void) {
        self.node = node; self.onEvent = onEvent
        _initialMotionEnabled = State(initialValue: node.properties["variant"]?.string != "connected")
        _state = State(initialValue: .init(children: AWCPreviewButtonGroupSelection.descendants(node.children)))
    }
    private var size: String { node.properties["size"]?.string ?? "sm" }
    private var connected: Bool { node.properties["variant"]?.string == "connected" }
    private var multiple: Bool { node.properties["selectionMode"]?.string == "multi-select" }
    private var required: Bool { node.properties["required"]?.bool == true }
    private var fullWidth: Bool { node.properties["fullWidth"]?.bool == true }
    private var direction: LayoutDirection { node.properties["dir"]?.string == "rtl" ? .rightToLeft : node.properties["dir"]?.string == "ltr" ? .leftToRight : inheritedDirection }
    private var density: Double { let value = node.properties["density"]?.number ?? 0; return [-1.0,-2,-3,-4].contains(value) ? value : parentContext?.density ?? 0 }
    private var gap: CGFloat {
        if let gap = appearance.gap { return CGFloat(gap) }
        if connected { return 2 }
        return CGFloat(size == "xs" ? max(10,18+density*2) : size == "sm" ? max(6,12+density*1.5) : max(4,8+density))
    }
    private var focusItems: [AWCButtonFocusItem] { state.children.map { .init(id:$0.id,disabled:$0.properties["disabled"]?.bool == true,selected:state.selected[$0.id] == true) } }
    private func syncFocus() { focus.parent = parentFocus; focus.configure(items:focusItems,singleSelection:!multiple,rightToLeft:direction == .rightToLeft) }
    private func press(_ id: String) {
        parentContext?.press(id)
        guard initialMotionEnabled, !connected, !reduceMotion, state.children.count > 1, !(required && state.selected[id] == true) else { return }
        state.motionTarget = id; state.motionStarted = Date()
    }
    private func commit(_ id: String, _ value: Bool) { state.commit(id,selected:value); parentContext?.commit(id,value) }
    private func activate(_ id: String, _ activation: AWCActivationMetadata) {
        if let detail = state.reconcile(id,multiple:multiple,required:required) {
            for child in state.children { parentContext?.commit(child.id,state.selected[child.id] == true) }
            focus.didFocus(id:id)
            var event = AWCEvent(name:"mdSelectionChange",tag:node.tag,nodeID:node.id,detail:detail); event.activation = activation
            onEvent(AWCEventDispatcher.dispatch(event,through:dispatcher,cancelable:true,targetListeners:listeners).observedEvent)
        }
        parentContext?.activate(id,activation)
    }
    private func injected(_ id:String)->[String:AWCValue]? { parentContext?.properties(id) ?? state.injected[id] }
    private func inject(_ values:[String:[String:AWCValue]],_ initialDepth:Int?) { if let parentContext {parentContext.inject(values,initialDepth)} else {state.inject(values,initialDepth:initialDepth)} }
    private func syncChildren(initial:Bool = false) {
        var values:[String:[String:AWCValue]]=[:]
        for (index,child) in state.children.enumerated() {
            values[child.id] = ["toggle":true,"size":.string(size),"shape":node.properties["shape"] ?? "round","connectedLeft":.bool(connected && index>0),"connectedRight":.bool(connected && index<state.children.count-1)]
        }
        inject(values,initial ? (parentContext?.depth ?? -1)+1:nil)
    }
    private func transformed(_ input: AWCNode) -> AWCNode {
        var child = input
        if state.selected[child.id] != nil {
            child.properties["selected"] = .bool(state.selected[child.id] == true)
            child.properties.merge(injected(child.id) ?? [:]) {_,new in new}
        }
        child.children = child.children.map(transformed)
        return child
    }
    private func delta(_ id: String, now: Date) -> CGFloat {
        guard let started = state.motionStarted, let target = state.motionTarget,
              let selectedIndex = state.children.firstIndex(where:{$0.id==target}), let index = state.children.firstIndex(where:{$0.id==id}) else { return 0 }
        let t = now.timeIntervalSince(started)
        guard t >= 0, t < 0.4 else { return 0 }
        let progress = t < 0.15 ? AWCNativeButtonTiming.cubic(t/0.15,x1:0.2,y1:0,x2:0,y2:1) : 1-AWCNativeButtonTiming.cubic((t-0.15)/0.25,x1:0.2,y1:0,x2:0,y2:1)
        let amount: Double = ["xs":3,"sm":4,"md":5,"lg":6,"xl":8][size] ?? 4
        let neighbors = (selectedIndex > 0 ? 1 : 0)+(selectedIndex < state.children.count-1 ? 1 : 0)
        return CGFloat(progress * (index == selectedIndex ? amount : abs(index-selectedIndex)==1 ? -amount/Double(max(1,neighbors)) : 0))
    }
    private func effectiveDelta(_ id: String, now: Date) -> CGFloat {
        state.motionStarted != nil ? delta(id,now:now) : parentContext?.motionDelta(id) ?? 0
    }
    private func extras(_ child: AWCNode, delta: CGFloat) -> CGFloat {
        if child.tag == "md-button" {
            let local = child.properties["density"]?.number ?? 0
            let metrics = AWCNativeButtonMetrics(size:child.properties["size"]?.string ?? size,density:[-1.0,-2,-3,-4].contains(local) ? local : density,variant:child.properties["variant"]?.string ?? "filled",tokens:tokens,appearance:buttonAppearance,motionDelta:delta)
            return 2 * (metrics.horizontalPadding + metrics.outlineWidth)
        }
        if child.tag == "md-icon-button" {
            let metrics = AWCNativeIconButtonMetrics(size:child.properties["size"]?.string ?? size,buttonWidth:child.properties["buttonWidth"]?.string ?? "default",density:density,variant:child.properties["variant"]?.string ?? "standard",appearance:iconAppearance,tokens:tokens)
            return 2 * metrics.outlineWidth
        }
        return 0
    }
    var body: some View {
        TimelineView(.animation(minimumInterval:1/60,paused:state.motionStarted == nil || reduceMotion)) { clock in
            AWCNativeButtonGroupLayout(appearance:appearance,fullWidth:fullWidth,gap:gap,rtl:direction == .rightToLeft,stretchesHeight:parentContext != nil) {
                ForEach(node.children) { authored in
                    let child = transformed(authored)
                    let direct = ["md-button","md-icon-button"].contains(child.tag)
                    AWCNativeView(node:child,onEvent:onEvent)
                        .environment(\.awcNativeGroupGeometry, direct ? .init(size:size,shape:node.properties["shape"]?.string ?? "round",connected:connected,
                            left:child.properties["connectedLeft"]?.bool == true,right:child.properties["connectedRight"]?.bool == true,density:density,fullWidth:fullWidth,
                            maximumHeight:appearance.maxHeight.map{CGFloat($0)},motionDelta:effectiveDelta(child.id,now:clock.date)) : nil)
                        .environment(\.layoutDirection,direction)
                        .layoutValue(key:AWCGroupFlexibleChild.self,value:direct)
                        .layoutValue(key:AWCGroupBoxExtras.self,value:extras(child,delta:effectiveDelta(child.id,now:clock.date)))
                        .awcInspect(nodeID:node.id,part:"child.\(child.id)",name:child.tag)
                }
            }.environment(\.layoutDirection,.leftToRight)
                .environment(\.awcNativeGroupContext,.init(selection:{state.selected[$0]},commit:commit,activate:activate,press:press,density:density,motionDelta:{effectiveDelta($0,now:clock.date)},properties:injected,inject:inject,depth:(parentContext?.depth ?? -1)+1))
        }
        .environment(\.awcButtonFocusGroup,focus)
        .accessibilityElement(children:.contain)
        .accessibilityLabel(node.properties["aria-label"]?.string ?? "")
        .preference(key:AWCGroupSelectionPreference.self,value:[node.id:state.selection])
        .awcInspect(nodeID:node.id,name:"md-button-group") { _ in
            ["padding":[0,0,0,0],"margin":[0,0,0,0],"border":[0,0,0,0],"gap":["row":0,"column":.number(Double(gap))],"display":"SwiftUI Layout","direction":.string(direction == .rightToLeft ? "rtl" : "ltr")]
        }
        .task(id:state.motionStarted) {
            guard let started = state.motionStarted else { return }
            try? await Task.sleep(for:.seconds(max(0,0.4-Date().timeIntervalSince(started))))
            guard !Task.isCancelled, state.motionStarted == started else { return }
            state.motionStarted = nil; state.motionTarget = nil
        }
        .onAppear { syncChildren(initial:true); syncFocus() }
        .onChange(of:node.children) { old,children in
            let prior=AWCPreviewButtonGroupSelection.descendants(old).map(\.id),next=AWCPreviewButtonGroupSelection.descendants(children)
            state.update(children:next); if prior != next.map(\.id) {syncChildren()}; syncFocus()
        }
        .onChange(of:node.properties) { old,new in
            if ["variant","size","shape","selectionMode","required"].contains(where:{old[$0] != new[$0]}) {syncChildren()}
        }
        .onChange(of:focusItems) { _,_ in syncFocus() }
        .onChange(of:direction) { _,_ in syncFocus() }
        .onChange(of:multiple) { _,_ in syncFocus() }
    }
}
