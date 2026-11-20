import SwiftUI

public enum AWCAccordionItemSlot: String, Hashable, Sendable {
    case content = "", headline, leadingIcon = "leading-icon", trailingIcon = "trailing-icon"
}
struct AWCAccordionAuthoredSlot { let content: AnyView; let label: String? }
private struct AWCAccordionSlotsKey: EnvironmentKey {
    static let defaultValue: [String: [AWCAccordionItemSlot: AWCAccordionAuthoredSlot]] = [:]
}
private struct AWCAccordionReducedMotionKey: EnvironmentKey { static let defaultValue: Bool? = nil }
extension EnvironmentValues {
    var awcAccordionReducedMotion: Bool? {
        get { self[AWCAccordionReducedMotionKey.self] }
        set { self[AWCAccordionReducedMotionKey.self] = newValue }
    }
    var awcAccordionSlots: [String: [AWCAccordionItemSlot: AWCAccordionAuthoredSlot]] {
        get { self[AWCAccordionSlotsKey.self] }
        set { self[AWCAccordionSlotsKey.self] = newValue }
    }
}
private struct AWCAccordionSlotModifier: ViewModifier {
    let id: String, slot: AWCAccordionItemSlot, value: AWCAccordionAuthoredSlot
    @Environment(\.awcAccordionSlots) private var inherited
    func body(content: Content) -> some View {
        var values = inherited; values[id, default: [:]][slot] = value
        return content.environment(\.awcAccordionSlots, values)
    }
}
public extension View {
    func awcAccordionItemSlot<Content: View>(_ slot: AWCAccordionItemSlot, for id: String,
        accessibilityLabel: String? = nil, @ViewBuilder content: () -> Content) -> some View {
        modifier(AWCAccordionSlotModifier(id: id, slot: slot, value: .init(content: AnyView(content()), label: accessibilityLabel)))
    }
}

struct AWCNativeAccordionGroup: View {
    let node: AWCNode, theme: AWCTheme
    let onEvent: (AWCEvent) -> Void
    @State private var runtime: AWCNativeAccordionRuntime
    @State private var pointerRegistry = AWCAccordionPointerRegistry()
    @State private var reorderMotion = AWCAccordionReorderMotion()
    @Environment(\.accessibilityReduceMotion) private var systemReduced
    @Environment(\.awcAccordionReducedMotion) private var reducedOverride
    @Environment(\.awcNativeDensity) private var density
    @Environment(\.awcNativeCompactSmallGap) private var compactGap
    @Environment(\.awcAccordionAppearance) private var inheritedAppearance
    @Environment(\.awcAccordionAppearanceTargets) private var appearanceTargets
    @Environment(\.awcAccordionItemAppearance) private var inheritedItemAppearance
    private var appearance: AWCAccordionAppearance { inheritedAppearance.merging(appearanceTargets[node.id] ?? .init()) }
    @Environment(\.awcForcedColors) private var forced
    @Environment(\.awcAccordionParts) private var groupParts
    @Environment(\.awcAccordionPartTargets) private var groupPartTargets
    private var placeholderPart: AWCAccordionPartAppearance { (groupParts[.dropPlaceholder] ?? .init()).merging(groupPartTargets[node.id]?[.dropPlaceholder] ?? .init()) }
    private var resolvedDensity: Double { AWCNativeDensity.resolve(node.properties["density"]?.number, inherited: density) }
    @Environment(\.awcEventDispatcher) private var dispatcher
    @Environment(\.awcEventTargetListeners) private var listeners
    init(node: AWCNode, theme: AWCTheme, onEvent: @escaping (AWCEvent) -> Void) {
        self.node = node; self.theme = theme; self.onEvent = onEvent
        _runtime = State(initialValue: AWCNativeAccordionRuntime(node: node))
    }
    var body: some View {
        let _ = runtime.bind(dispatcher: dispatcher, listeners: listeners, observe: onEvent)
        let _ = runtime.state.claimRenderOrder()
        let config = runtime.state.configuration, outlined = config.variant == "outlined"
        // Hidden children (`display: none`) keep their coordination state but take no slot and no gap.
        let children = runtime.displayNodes.filter { !(runtime.items[$0.id]?.hidden ?? ($0.properties["hidden"]?.bool == true)) }, corners = appearance.containerShape ?? .points(max(8, 12 + resolvedDensity))
        let compact = node.properties["density"] != nil ? resolvedDensity <= -3 : compactGap
        let floating = config.floating, floatingCorners = appearance.floatingRadius ?? .points(theme.tokens["--md-sys-shape-corner-large"].flatMap { Double($0.replacingOccurrences(of: "px", with: "")) } ?? 16)
        let panel = VStack(spacing: outlined ? 0 : appearance.gap ?? (compact ? 4 : 8)) {
            ForEach(Array(children.enumerated()), id: \.element.id) { index, child in
                VStack(spacing: 0) {
                    if let item = runtime.items[child.id], child.tag == "md-accordion-item" {
                        AWCNativeAccordionItem(node: child, state: item, owner: runtime.state, theme: theme, onEvent: onEvent,
                                               separator: outlined && index < children.count - 1 ? outlineColor : nil)
                    } else { AWCNativeView(node: child, onEvent: onEvent) }
                }
                .background { AWCAccordionGeometryProbe(id:child.id,registry:pointerRegistry) }
                .modifier(AWCAccordionShiftOffset(motion:reorderMotion,id:child.id,dragged:runtime.state.draggedItemID,draggedOffset:runtime.state.draggedOffset))
                .modifier(AWCStackingLift(own: runtime.state.draggedItemID == child.id ? 10 : 1))
            }
        }
        .padding(outlined && !floating ? 1 : 0)
        // Floating filled items go flush: the panel supplies surface, shape and shadow.
        .environment(\.awcAccordionItemAppearance, floating && !outlined ? inheritedItemAppearance.merging(.init(containerColor:"#00000000",containerShape:.points(0),containerShapeExpanded:.points(0),elevation:[],elevationExpanded:[])) : inheritedItemAppearance)
        .background(alignment:.topLeading) {
            if let placeholder=runtime.state.dropPlaceholder {
                // ::part(drop-placeholder) declarations win over the hooks (outer part rules over the inner sheet).
                let pp=placeholderPart, ghost=pp.cornerShape ?? appearance.dropPlaceholderShape ?? corners
                let shape=AWCNativeCornerShape(corners:ghost)
                let outline=pp.borderWidth ?? appearance.dropPlaceholderOutlineWidth ?? 2
                shape.fill((pp.backgroundColor ?? appearance.dropPlaceholderColor).map{Color(awcHex:$0)} ?? color("primary-container","#EADDFF").opacity(0.45))
                    .overlay { if outline>0 { AWCBlinkDashedBorder(corners:ghost,width:outline,color:(pp.borderColor ?? appearance.dropPlaceholderOutlineColor).map{Color(awcHex:$0)} ?? color("primary","#6750A4").opacity(0.55)) } }
                    // CSS opacity applies to the composited box (fill and dashed border together).
                    .frame(height:placeholder.height).compositingGroup().opacity(pp.opacity ?? appearance.dropPlaceholderOpacity ?? 1)
                    // Border dashes are physical (they start after the top-left corner in both directions).
                    .environment(\.layoutDirection,.leftToRight)
                    .awcInspect(nodeID:node.id,part:"drop-placeholder",name:"drop-placeholder")
                    .padding(.horizontal, outlined ? 1:0)
                    .modifier(AWCAccordionGlideOffset(motion:reorderMotion,target:placeholder.top,inset:outlined ? 1:0))
                    .allowsHitTesting(false).accessibilityHidden(true)
            }
        }
        .modifier(AWCAccordionChassis(outlined: outlined, corners: floating ? floatingCorners:corners, outline: floating ? .clear:outlineColor,
                                      shadows: floating ? []:appearance.elevation ?? AWCBoxShadow.source(theme.tokens["--md-sys-elevation-\((1...5).contains(config.elevation) ? config.elevation:0)"] ?? "none") ?? []))
        .modifier(AWCAccordionFloatingChassis(nodeID: node.id, active: floating, dragging: runtime.state.chassisDragging, corners: floatingCorners,
                                              background: appearance.floatingBackground.map { Color(awcHex:$0) } ?? color("surface-container-low", "#F7F2F9"),
                                              resting: appearance.floatingElevation ?? AWCBoxShadow.source(theme.tokens["--md-sys-elevation-3"] ?? "none") ?? [],
                                              lifted: appearance.floatingElevationActive ?? AWCBoxShadow.source(theme.tokens["--md-sys-elevation-5"] ?? "none") ?? [],
                                              timing: panelTiming(config)))
        // forced-colors: `:host(.md-accordion--floating) { border: 1px solid CanvasText }` (border-box, inside the panel width).
        .modifier(AWCForcedHostBorder(width: 1, color: floating ? forced?.canvasText : nil, fill: nil, corners: floatingCorners))
        .awcCursor(runtime.state.chassisDragging ? .grabbing : nil)
        .awcInspect(nodeID: node.id, name: "md-accordion") { _ in
            ["expandedIndices": .array(runtime.state.expandedIndices.map { .number(Double($0)) }),
             "order": .array(runtime.state.originalIndices.map { .number(Double($0)) }),
             "x": .number(runtime.state.x), "y": .number(runtime.state.y), "zIndex": .number(Double(runtime.state.zIndex ?? -1)),
             "chassisDragging": .bool(runtime.state.chassisDragging)]
        }
        .environment(\.awcNativeDensity, resolvedDensity)
        .environment(\.awcEventDispatcher, runtime.childDispatcher)
        .environment(\.awcAccordionReorderContext,.init(registry:pointerRegistry,state:runtime.state,groupID:node.id,motion:reorderMotion))
        .background { AWCAccordionGeometryProbe(id:node.id,registry:pointerRegistry) }
        .onAppear { runtime.appear() }
        .onChange(of: AWCAccordionShiftTargets(dragged: runtime.state.draggedItemID, offsets: runtime.state.siblingOffsets,
                                               placeholder: runtime.state.dropPlaceholder?.top, ids: runtime.state.items.map(\.id))) { _, next in
            let timing = AWCAccordionReorderMotion.timing(preset: config.transition, reduced: reducedOverride ?? systemReduced, tokens: theme.tokens)
            reorderMotion.update(dragged: next.dragged, ids: next.ids, offsets: next.offsets, placeholderTop: next.placeholder, shift: timing.shift, glide: timing.glide)
        }
        .onChange(of: node) { _, next in runtime.update(next) }
        .onDisappear { runtime.disappear() }
        AWCAccordionFloatingHost(active: floating, x: runtime.state.loaded ? runtime.state.x : config.initialX, y: runtime.state.loaded ? runtime.state.y : config.initialY,
                                 z: Double(runtime.state.zIndex ?? 1000), width: appearance.floatingWidth ?? 360, entryID: node.id, content: panel)
    }
    /// Panel `--_effects-duration` / `--_effects-easing` (spring effects tokens); `transition="none"` and reduced motion snap.
    private func panelTiming(_ config: AWCNativeAccordionConfiguration) -> AWCAccordionReorderMotion.Timing {
        if config.transition == "none" || (reducedOverride ?? systemReduced) { return .init(duration: 0, curve: [0.34,0.8,0.34,1]) }
        return .init(duration: awcCSSDuration(theme.tokens["--md-sys-motion-spring-effects-default-duration"]) ?? 200,
                     curve: awcCSSCubicBezier(theme.tokens["--md-sys-motion-spring-effects-default-easing"]) ?? [0.34,0.8,0.34,1])
    }
    private var outlineColor: Color { appearance.outlineColor.map { Color(awcHex:$0) } ?? color("outline-variant", "#CAC4D0") }
    private func color(_ token: String, _ fallback: String) -> Color { Color(awcHex: theme.tokens["--md-sys-color-" + token] ?? fallback) }
}

private struct AWCAccordionChassis: ViewModifier {
    let outlined: Bool, corners: AWCCornerShape, outline: Color, shadows: [AWCBoxShadow]
    @ViewBuilder func body(content: Content) -> some View {
        if outlined {
            content.clipShape(AWCNativeCornerShape(corners:corners))
                .overlay { AWCNativeCornerShape(corners:corners).strokeBorder(outline,lineWidth:1) }
                .background { AWCNativeBoxShadow(corners:corners,layers:shadows) }
        } else { content }
    }
}

/// Content is laid out once at its natural height. Only the containing track
/// and its clip change; no if-expanded branch can destroy authored view state.
struct AWCAccordionDisclosureLayout: Layout {
    let fraction: Double
    var minimum = 0.0
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let natural = subviews.first?.sizeThatFits(.init(width: proposal.width, height: nil)) ?? .zero
        return .init(width: proposal.width ?? natural.width, height: max(minimum,natural.height * min(1, max(0, fraction))))
    }
    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        guard let content = subviews.first else { return }
        content.place(at: bounds.origin, anchor: .topLeading, proposal: .init(width: bounds.width, height: max(minimum,bounds.height * min(1,max(0,fraction)))))
    }
}
/// The grid item clips to its allocated track while its retained child keeps
/// its intrinsic height. This is a real, independently inspectable content box.
struct AWCAccordionContentTrack: Layout {
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let natural=subviews.first?.sizeThatFits(.init(width:proposal.width,height:nil)) ?? .zero
        return .init(width:proposal.width ?? natural.width,height:proposal.height ?? natural.height)
    }
    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        guard let child=subviews.first else{return}
        let natural=child.sizeThatFits(.init(width:bounds.width,height:nil))
        child.place(at:bounds.origin,anchor:.topLeading,proposal:.init(width:bounds.width,height:natural.height))
    }
}
private struct AWCAccordionChevron: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        let points: [CGPoint] = [.init(x: 7.41,y: 8.59),.init(x: 12,y: 13.17),.init(x: 16.59,y: 8.59),.init(x: 18,y: 10),.init(x: 12,y: 16),.init(x: 6,y: 10)]
        path.addLines(points.map { .init(x: rect.minX + $0.x * rect.width / 24, y: rect.minY + $0.y * rect.height / 24) }); path.closeSubpath(); return path
    }
}
private struct AWCAccordionHeaderStyle: ButtonStyle {
    let focused: Bool, disabled: Bool, stateColor: Color, focusColor: Color, rippleColor: Color
    let layer: AWCAccordionPartAppearance, corners: AWCCornerShape, border: Double, nodeID: String
    let dragging: Bool, gripPress: CGPoint?, timing: AWCAccordionInteractionTiming
    var exclusion: CGRect? = nil
    let pointerFocus: () -> Void
    func makeBody(configuration: Configuration) -> some View {
        AWCAccordionHeaderSurface(label: configuration.label, isPressed: configuration.isPressed, focused: focused, disabled: disabled,
                                  stateColor: stateColor, focusColor: focusColor, rippleColor: rippleColor, layer: layer, corners: corners,
                                  border: border, nodeID: nodeID, dragging: dragging, gripPress: gripPress, timing: timing, exclusion: exclusion)
            .onChange(of: configuration.isPressed) { _, pressed in if pressed { pointerFocus() } }
    }
}

/// An md-accordion-item that is not a direct child of an md-accordion (for example one
/// wrapped in another layout): like the source element it is never owned, keeps its own
/// disclosure state, applies authored property edits itself and dispatches its own events.
struct AWCNativeAccordionStandaloneItem: View {
    let node: AWCNode, theme: AWCTheme
    let onEvent: (AWCEvent) -> Void
    @State private var state: AWCNativeAccordionItemState
    init(node: AWCNode, theme: AWCTheme, onEvent: @escaping (AWCEvent) -> Void) {
        self.node = node; self.theme = theme; self.onEvent = onEvent
        _state = State(initialValue: AWCNativeAccordionItemState(node: node))
    }
    var body: some View { AWCNativeAccordionItem(node: node, state: state, owner: nil, theme: theme, onEvent: onEvent) }
}

struct AWCNativeAccordionItem: View {
    let node: AWCNode, state: AWCNativeAccordionItemState, owner: AWCNativeAccordionState?, theme: AWCTheme
    let onEvent: (AWCEvent) -> Void
    var separator: Color? = nil
    @State private var focusHandle = AWCButtonFocusHandle()
    @State private var scrollState = AWCAccordionScrollState()
    @State private var transition: AWCNativeAccordionRunningTransition?
    @State private var completion: Task<Void, Never>?
    @State private var hasPresented = false
    @State private var gripPress: CGPoint?
    @State private var gripFrame: CGRect = .zero
    @State private var chassisFrame: CGRect?
    @Environment(\.awcNativeDensity) private var inheritedDensity
    @Environment(\.layoutDirection) private var direction
    @Environment(\.awcAccordionItemAppearance) private var inheritedAppearance
    @Environment(\.awcAccordionItemAppearanceTargets) private var appearanceTargets
    @Environment(\.awcAccordionItemParts) private var inheritedParts
    @Environment(\.awcAccordionItemPartTargets) private var partTargets
    @Environment(\.awcAccordionReorderContext) private var reorderContext
    private var dragging:Bool { owner?.draggedItemID == node.id }
    private func part(_ part: AWCAccordionItemPart) -> AWCAccordionPartAppearance { (inheritedParts[part] ?? .init()).merging(partTargets[node.id]?[part] ?? .init()) }
    private var headerMargins:AWCAccordionInsets {part(.header).margin ?? .init(block:0,inline:0)}
    private var collapseHeadingTop:Bool {(part(.heading).padding?.top ?? 0)==0 && (part(.heading).borderWidth ?? 0)==0}
    private var collapseHeadingBottom:Bool {(part(.heading).padding?.bottom ?? 0)==0 && (part(.heading).borderWidth ?? 0)==0 && part(.heading).height==nil && (part(.heading).minHeight ?? 0)==0}
    private var headingMargins:AWCAccordionInsets {
        let own=part(.heading).margin ?? .init(block:0,inline:0)
        return .init(top:collapseHeadingTop ? awcAccordionCollapsedMargin(own.top,headerMargins.top):own.top,right:own.right,
                     bottom:collapseHeadingBottom ? awcAccordionCollapsedMargin(own.bottom,headerMargins.bottom):own.bottom,left:own.left)
    }
    @Environment(\.awcForcedColors) private var forced
    private var appearance: AWCAccordionItemAppearance {
        let value = inheritedAppearance.merging(appearanceTargets[node.id] ?? .init())
        // forced-colors: author colours are forced (backgrounds Canvas, text and icons CanvasText); state layers are display: none.
        guard let f = forced else { return value }
        return value.merging(.init(containerColor: f.canvas, containerColorExpanded: f.canvas, headerColor: f.canvas, headerColorExpanded: f.canvas,
                                   headlineColor: f.canvasText, headlineColorExpanded: f.canvasText, supportingColor: f.canvasText, iconColor: f.canvasText,
                                   iconColorExpanded: f.canvasText, stateLayerColor: "#00000000", stateLayerColorExpanded: "#00000000",
                                   elevation: [], elevationExpanded: [], containerColorDragging: f.canvas, chassisHandleColor: f.canvasText))
    }
    @Environment(\.accessibilityReduceMotion) private var systemReduced
    @Environment(\.awcAccordionReducedMotion) private var reducedOverride
    @Environment(\.awcAccordionControllers) private var controllers
    @Environment(\.awcAccordionSlots) private var slots
    @Environment(\.awcNativeFocusChanged) private var focusChanged
    @Environment(\.awcEventDispatcher) private var dispatcher
    @Environment(\.awcEventTargetListeners) private var listeners
    private var density: Double { AWCNativeDensity.resolve(node.properties["density"]?.number, inherited: inheritedDensity) }
    private var reduced: Bool { reducedOverride ?? systemReduced }
    private var expanded: Bool { owner?.renderedExpanded(state) ?? state.expanded }
    private var outlined: Bool { owner?.configuration.variant == "outlined" }
    private var headerPadding: AWCAccordionInsets { appearance.headerPadding ?? .init(block:max(4,16+density*2),inline:max(12,24+density*2)) }
    private var contentPadding: AWCAccordionInsets { part(.contentInner).padding ?? appearance.contentPadding ?? .init(block:max(8,20+density*2),inline:max(12,24+density*2)) }
    private var restingCorners: AWCCornerShape { outlined ? .points(0) : appearance.containerShape ?? .points(12) }
    private var expandedCorners: AWCCornerShape { outlined ? .points(0) : appearance.containerShapeExpanded ?? .points(16) }
    private var restingShadow: [AWCBoxShadow] {
        guard !outlined else { return [] }
        let level = owner?.configuration.elevation ?? 0
        return appearance.elevation ?? AWCBoxShadow.source(theme.tokens["--md-sys-elevation-\((1...5).contains(level) ? level:0)"] ?? "none") ?? []
    }
    private var expandedShadow: [AWCBoxShadow] {
        guard !outlined else { return [] }
        let level = owner?.configuration.elevation ?? 0
        if let override = appearance.elevationExpanded { return override }
        if (1...5).contains(level) { return AWCBoxShadow.source(theme.tokens["--md-sys-elevation-\(min(5,level+1))"] ?? "none") ?? [] }
        return restingShadow
    }
    private var supportingColor: Color { appearance.supportingColor.map { Color(awcHex:$0) } ?? color("on-surface-variant", "#49454F") }
    private func resolvedColor(_ custom: String?, _ token: String, _ fallback: String) -> Color { custom.map { Color(awcHex:$0) } ?? color(token,fallback) }
    private func containerColor(_ fraction: Double) -> Color {
        if dragging { return resolvedColor(appearance.containerColorDragging,"surface-container-low","#F7F2F9") }
        let resting = appearance.containerColor.map { Color(awcHex:$0) } ?? (outlined ? .clear:color("surface-container-low", "#F7F2FA"))
        return outlined ? resting : blend(resting,resolvedColor(appearance.containerColorExpanded,"surface-container","#F3EDF7"),fraction)
    }
    private var iconSize: Double { max(18, 24 + density) }
    private var headline: String { node.properties["headline"]?.string ?? "" }
    private var support: String { node.properties["supportingText"]?.string ?? "" }
    private var contentLimit: String { (node.properties["contentMaxHeight"]?.string ?? "").trimmingCharacters(in: .whitespacesAndNewlines) }
    private var accessibleLabel: String {
        let assigned = node.children(inSlot: "headline")
        let title = slots[node.id]?[.headline]?.label ?? (assigned.isEmpty ? headline : assigned.map(\.authoredTextContent).joined(separator: " "))
        return [title, support].filter { !$0.isEmpty }.joined(separator: " ")
    }
    private var motion: AWCNativeAccordionMotion { .init(preset: owner?.configuration.transition ?? "expressive", opening: expanded, expandDuration: appearance.expandDuration, collapseDuration: appearance.collapseDuration, reduced: reduced) }
    private var interactionTiming: AWCAccordionInteractionTiming { .init(motion: motion, preset: owner?.configuration.transition ?? "expressive", tokens: theme.tokens) }
    private func frame(_ date: Date) -> AWCNativeAccordionMotion.Frame { transition?.frame(date) ?? motion.frame(elapsedMilliseconds: .greatestFiniteMagnitude) }
    var body: some View {
        TimelineView(.animation(paused: transition == nil)) { context in
            let frame = frame(context.date), corners = dragging ? appearance.containerShapeDragging ?? .points(12):restingCorners.interpolated(to: expandedCorners, fraction: frame.shape)
            let icon = blend(resolvedColor(appearance.iconColor,"on-surface-variant","#49454F"),resolvedColor(appearance.iconColorExpanded,"on-secondary-container","#1D192B"),frame.effects)
            let panelMargins=part(.panel).margin ?? .init(block:0,inline:0)
            let contentMargins=part(.content).margin ?? .init(block:0,inline:0)
            AWCAccordionBlockStack(top:headingMargins.top,
                between:awcAccordionCollapsedMargin(part(.heading).margin?.bottom ?? 0,collapseHeadingBottom ? headerMargins.bottom:0,panelMargins.top),
                bottom:panelMargins.bottom) {
                header(frame, icon: icon)
                    .awcAccordionHeadingSemantics(level: state.headingLevel, label: accessibleLabel)
                    .modifier(AWCAccordionPartBox(value:part(.heading),stretch:true))
                    .awcInspect(nodeID: node.id, part: "heading", name: "heading") { _ in ["level": .number(Double(min(6, max(1, state.headingLevel))))] }
                    .modifier(AWCAccordionPartMargin(value:.init(margin:.init(top:0,right:headingMargins.right,bottom:0,left:headingMargins.left))))
                AWCAccordionDisclosureLayout(fraction: frame.height,minimum:part(.content).verticalEdges+contentMargins.top+contentMargins.bottom) {
                    AWCAccordionContentTrack { scrollContent }
                        .modifier(AWCAccordionPartBox(value:part(.content),stretch:true,clip:true))
                        .awcInspect(nodeID:node.id,part:"content",parentPart:"panel",name:"content")
                        .modifier(AWCAccordionPartMargin(value:part(.content)))
                }
                .awcAccordionRegionSemantics(label: expanded ? accessibleLabel : "")
                .background { AWCAccordionPanelAnchor(id: node.id + ".panel", name: expanded ? accessibleLabel : "") }
                .modifier(AWCAccordionPartBox(value:part(.panel),stretch:true,applyOpacity:false))
                .opacity(part(.panel).opacity ?? frame.opacity).awcNativeInert(!expanded)
                .awcInspect(nodeID: node.id, part: "panel", name: "panel") { _ in ["expanded": .bool(state.expanded), "regionRole": .string(state.regionRole)] }
                .modifier(AWCAccordionPartMargin(value:.init(margin:.init(top:0,right:panelMargins.right,bottom:0,left:panelMargins.left))))
            }
            .padding(.bottom, separator == nil ? 0 : 1)
            // Flatten before clipping: on macOS a non-rectangular ancestor clip
            // otherwise mirrors right-to-left header labels out of view.
            .compositingGroup()
            .clipShape(AWCAccordionLiftClip(corners:corners,active:dragging,bottomBorder:separator == nil ? 0:1))
            .background {
                ZStack {
                    AWCNativeCornerShape(corners:corners).fill(containerColor(frame.effects))
                    AWCNativeBoxShadow(corners:corners,layers:restingShadow,toLayers:expandedShadow,fraction:frame.effects,placement:.inner)
                }
            }
            .overlay { if let separator { AWCAccordionSeparatorShape(corners:corners).fill(separator,style:FillStyle(eoFill:true)).accessibilityHidden(true) } }
            .background { AWCNativeBoxShadow(corners:corners,layers:dragging ? AWCBoxShadow.source(theme.tokens["--md-sys-elevation-4"] ?? "none") ?? []:restingShadow,toLayers:dragging ? nil:expandedShadow,fraction:frame.effects,placement:.outer) }
            .modifier(AWCForcedHostBorder(width: 1, color: forced?.canvasText, fill: forced?.canvas, corners: corners))
            .awcCursor(dragging ? .grabbing : nil)
            .awcInspect(nodeID: node.id, name: "md-accordion-item") { size in ["expanded": .bool(state.expanded), "radius": .number(Double(corners.radii(in:size).first?.width ?? 0))] }
            .overlay(alignment: .top) {
                if state.hasChassisHandle {
                    let hook = appearance.chassisHandleColor.map { Color(awcHex:$0) }
                    AWCAccordionChassisHandle(context: reorderContext, nodeID: node.id, expanded: state.expanded, dragging: owner?.chassisDragging ?? false,
                                              barColor: hook ?? (state.expanded ? color("on-secondary-container","#1D192B") : owner?.chassisDragging == true ? color("primary","#6750A4") : color("on-surface-variant","#49454F")),
                                              tint: resolvedColor(appearance.stateLayerColor,"on-surface","#1C1B1F"), hoverTint: appearance.chassisHandleBackgroundHover.map { Color(awcHex:$0) },
                                              timing: interactionTiming, onFrame: { chassisFrame = $0 }, forced: forced != nil, handlePart: part(.chassisHandle), barPart: part(.chassisHandleBar))
                        .padding(.top, 4 + (forced != nil ? 1 : 0))
                }
            }
        }
        .transaction { $0.animation = nil }
        .onAppear {
            controllers[node.id]?.attach(state); bind()
        }
        .onChange(of: node.properties) { previous, next in if owner == nil { state.applyProperties(next, previous: previous) }; bind() }
        .task { hasPresented = true }
        .onChange(of: expanded) { previous, next in
            completion?.cancel()
            guard hasPresented else { transition = nil; return }
            let now = Date(), start = transition?.frame(now) ?? AWCNativeAccordionMotion(opening: previous, reduced: true).frame(elapsedMilliseconds: 0)
            let selected = motion
            if selected.duration == 0 { transition = nil; return }
            transition = .init(start: start, motion: selected, date: now)
            completion = Task { @MainActor in
                try? await Task.sleep(for: .milliseconds(selected.duration))
                if !Task.isCancelled { transition = nil; completion = nil }
            }
        }
        .onChange(of: reduced) { _, value in if value { completion?.cancel(); transition = nil } }
        .onDisappear { hasPresented = false; completion?.cancel(); transition = nil; controllers[node.id]?.detach(state); state.requestFocus = {} }
    }
    private var scrollContent: some View {
        let style=part(.contentInner), border=style.borderWidth ?? 0
        let font=AWCNativeMeterText(text:"",size:style.fontSize ?? max(12,14+density*0.5),lineHeight:style.lineHeight ?? max(16,20+density),weight:style.fontWeight ?? 400,spacing:style.letterSpacing ?? 0,tabular:false)
        let ink=style.color.map{Color(awcHex:$0)} ?? supportingColor
        return AWCAccordionContentLayout(limit: AWCAccordionContentLimit(css: contentLimit),
                                  padding: contentPadding.top + contentPadding.bottom + border*2,
                                  context: .init(fontSize:font.size),authoredHeight:style.height,minimumHeight:style.minHeight) {
            ScrollView(.vertical, showsIndicators: !contentLimit.isEmpty) {
                slot(.content, font:font, color:ink)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(contentPadding.edges(rtl:direction == .rightToLeft))
                    .background { AWCAccordionScrollBridge(id: node.id + ".content", scrollable: !contentLimit.isEmpty, state: scrollState) }
            }
            .scrollDisabled(contentLimit.isEmpty || !expanded)
            .padding(border)
            .frame(width:style.width.map{$0+contentPadding.left+contentPadding.right+border*2})
            .background { AWCNativeCornerShape(corners:style.cornerShape ?? .points(0)).fill(style.backgroundColor.map{Color(awcHex:$0)} ?? .clear) }
            .overlay { if border>0 { AWCNativeCornerShape(corners:style.cornerShape ?? .points(0)).strokeBorder(style.borderColor.map{Color(awcHex:$0)} ?? ink,lineWidth:border) } }
            .opacity(style.opacity ?? 1)
            .overlay { if scrollState.focused { Rectangle().strokeBorder(color("secondary", "#625B71"), lineWidth: 3).allowsHitTesting(false) } }
            .awcInspect(nodeID: node.id, part: "content-inner", parentPart: "content", name: "content-inner")
        }
        .modifier(AWCAccordionPartMargin(value:style))
    }
    private func bind() {
        let handle = focusHandle
        state.requestFocus = { _ = handle.requestFocus?() }
        if owner == nil {
            let nodeID = node.id, tag = node.tag, dispatcher = dispatcher, listeners = listeners, observe = onEvent
            state.emit = { name, detail in
                observe(AWCEventDispatcher.dispatch(.init(name: name, tag: tag, nodeID: nodeID, detail: detail), through: dispatcher, cancelable: true, targetListeners: listeners).observedEvent)
                return false
            }
        }
    }
    private func header(_ frame: AWCNativeAccordionMotion.Frame, icon: Color) -> some View {
        let style=part(.header)
        let color = style.color.map{Color(awcHex:$0)} ?? (state.disabled ? resolvedColor(appearance.headlineColor,"on-surface","#1C1B1F").opacity(0.38) : blend(resolvedColor(appearance.headlineColor,"on-surface","#1C1B1F"),resolvedColor(appearance.headlineColorExpanded,"on-secondary-container","#1D192B"),frame.effects))
        let stateColor = blend(resolvedColor(appearance.stateLayerColor,"on-surface","#1C1B1F"),resolvedColor(appearance.stateLayerColorExpanded,"on-secondary-container","#1D192B"),frame.effects)
        let topCorners=AWCCornerShape(topLeft:expandedCorners.topLeft,topRight:expandedCorners.topRight,bottomRight:.init(.points(0)),bottomLeft:.init(.points(0)))
        let corners=style.cornerShape ?? restingCorners.interpolated(to:topCorners,fraction:frame.shape)
        let policy = AWCButtonAccessibilityPolicy(properties: ["disabled": .bool(state.disabled), "softDisabled": .bool(state.toggleBlocked)])
        return Button { _ = focusHandle.requestPointerFocus?(); state.toggle() } label: {
            HStack(spacing: style.gap ?? max(8,16 + density * 2)) {
                if owner?.configuration.reorderable == true && !state.disabled {
                    AWCAccordionGrip(size:22 + density,rest:resolvedColor(appearance.iconColor,"on-surface-variant","#49454F"),
                                     hoverColor:resolvedColor(appearance.headlineColorExpanded,"on-secondary-container","#1D192B"),
                                     draggingColor:resolvedColor(appearance.iconColorExpanded,"on-secondary-container","#1D192B"),
                                     partColor:part(.dragHandle).color.map{Color(awcHex:$0)},partOpacity:part(.dragHandle).opacity,
                                     dragging:dragging,timing:interactionTiming,nodeID:node.id)
                        .modifier(AWCAccordionPartBox(value:part(.dragHandle),applyOpacity:false))
                        .awcCursor(dragging ? .grabbing : .grab, active: .grabbing)
                        .overlay { if let reorderContext { AWCAccordionReorderCapture(id:node.id,capture:reorderContext,pressed:{ point in
                            gripPress = point.map { CGPoint(x:gripFrame.minX+$0.x,y:gripFrame.minY+$0.y) } }) } }
                        .background { GeometryReader { g in Color.clear.onChange(of:g.frame(in:.named("awc-accordion-header")),initial:true) { _,f in gripFrame=f } } }
                        .awcInspect(nodeID:node.id,part:"drag-handle",parentPart:"header",name:"drag-handle")
                        .padding((part(.dragHandle).margin ?? .init(top:0,right:direction == .rightToLeft ? 0:-4,bottom:0,left:direction == .rightToLeft ? -4:0)).edges(rtl:direction == .rightToLeft))
                }
                if slots[node.id]?[.leadingIcon] != nil || !node.children(inSlot: "leading-icon").isEmpty || !(node.properties["icon"]?.string ?? "").isEmpty {
                    slot(.leadingIcon, color: part(.leadingIcon).color.map{Color(awcHex:$0)} ?? icon, iconFill: frame.effects).frame(width:24,height:24)
                        .modifier(AWCAccordionPartBox(value:part(.leadingIcon)))
                        .awcInspect(nodeID: node.id, part: "leading-icon", parentPart: "header", name: "leading-icon")
                        .scaleEffect(reduced ? 1 : frame.leadingScale)
                        .modifier(AWCAccordionPartMargin(value:part(.leadingIcon)))
                }
                VStack(alignment: .leading, spacing: 2) {
                    headlinePart(color:color)
                    if !support.isEmpty {
                        supportingPart
                    }
                }.frame(maxWidth: .infinity, alignment: .leading)
                slot(.trailingIcon, color: part(.trailingIcon).color.map{Color(awcHex:$0)} ?? icon).frame(width:iconSize,height:iconSize)
                    .modifier(AWCAccordionPartBox(value:part(.trailingIcon)))
                    .awcInspect(nodeID: node.id, part: "trailing-icon", parentPart: "header", name: "trailing-icon")
                    .rotationEffect(.radians(frame.chevronRadians))
                    .modifier(AWCAccordionPartMargin(value:part(.trailingIcon)))
            }
            .modifier(AWCAccordionPartBox(value:style,defaultPadding:headerPadding,defaultShape:corners,
                background:blend(appearance.headerColor.map { Color(awcHex:$0) } ?? .clear,resolvedColor(appearance.headerColorExpanded,"secondary-container","#E8DEF8").opacity(state.disabled ? 0.12:1),frame.effects),
                borderInk:color,borderBox:true,stretch:true,minimumHeight:appearance.headerMinHeight ?? max(40,64+density*4)))
            .coordinateSpace(name:"awc-accordion-header")
        }
        .buttonStyle(AWCAccordionHeaderStyle(focused: focusHandle.isFocusVisible, disabled: state.disabled, stateColor: stateColor,
                                            focusColor: self.color("secondary", "#625B71"),rippleColor:color,layer:part(.stateLayer),corners:corners,border:style.borderWidth ?? 0,nodeID:node.id,
                                            dragging:dragging,gripPress:gripPress,timing:interactionTiming,
                                            exclusion:state.hasChassisHandle ? chassisFrame:nil,
                                            pointerFocus: { _ = focusHandle.requestPointerFocus?() }))
        .disabled(state.disabled).focusable(false).accessibilityHidden(true)
        .awcFocusBridgeLayer {
            AWCNativeButtonFocusBridge(configuration: .init(id: node.id + ".header", label: accessibleLabel, policy: policy, group: nil, cell: nil,
                handle: focusHandle, focusChanged: { focusChanged?(node.id, $0) }, activate: { state.toggle() }, disclosureExpanded: state.expanded,
                routeKeyWithAlt: { key, alt in state.key(key == "Space" ? " " : key, alt: alt) },
                // iOS: focus on the raw touch-down (AWCTouchPressRouter); press, drag and activation stay SwiftUI's.
                touchPress: .init(began: { _ in if !state.disabled { _ = focusHandle.requestPointerFocus?() }; return false }, ended: { _ in }, cancelled: {}),
                heading: true,
                controls: { [id = node.id + ".panel"] in AWCTabPanelLinks.element(controls: id, tabs: "", index: 0, roles: ["AXGroup", "AXScrollArea"]) }))
                .accessibilityHidden(false)
        }
        .awcCursor(state.disabled ? .notAllowed : .pointer)
        .awcInspect(nodeID: node.id, part: "header", parentPart: "heading", name: "header")
        .modifier(AWCAccordionHeaderMargin(margins:.init(top:collapseHeadingTop ? 0:headerMargins.top,right:headerMargins.right,bottom:collapseHeadingBottom ? 0:headerMargins.bottom,left:headerMargins.left)))
    }
    private func headlinePart(color:Color) -> some View {
        let style=part(.headline), inherited=part(.header)
        let font=AWCNativeMeterText(text:"",size:style.fontSize ?? inherited.fontSize ?? max(13,16+density*0.5),
                                  lineHeight:style.lineHeight ?? inherited.lineHeight ?? max(18,24+density),
                                  weight:style.fontWeight ?? inherited.fontWeight ?? 500,spacing:style.letterSpacing ?? inherited.letterSpacing ?? 0.15,tabular:false)
        return slot(.headline,font:font,color:style.color.map{Color(awcHex:$0)} ?? color)
            .frame(maxWidth:.infinity,alignment:.leading)
            .modifier(AWCAccordionPartBox(value:style,stretch:true))
            .awcInspect(nodeID:node.id,part:"headline",parentPart:"header",name:"headline") { _ in ["typography":font.inspection] }
            .modifier(AWCAccordionPartMargin(value:style))
    }
    private var supportingPart: some View {
        let style=part(.supportingText)
        let font=AWCNativeMeterText(text:support,size:style.fontSize ?? max(10,12+density*0.5),lineHeight:style.lineHeight ?? max(14,16+density*0.5),weight:style.fontWeight ?? 400,spacing:style.letterSpacing ?? 0.4,tabular:false)
        return text(support,size:font.size,lineHeight:font.lineHeight,weight:font.weight,spacing:font.spacing,color:style.color.map{Color(awcHex:$0)} ?? supportingColor,wrap:false)
            .frame(maxWidth:.infinity,alignment:.leading)
            .modifier(AWCAccordionPartBox(value:style,stretch:true))
            .awcInspect(nodeID:node.id,part:"supporting-text",parentPart:"header",name:"supporting-text") { _ in ["typography":font.inspection] }
            .modifier(AWCAccordionPartMargin(value:style))
    }
    @ViewBuilder private func slot(_ slot: AWCAccordionItemSlot, font: AWCNativeMeterText? = nil, color: Color, iconFill: Double = 0) -> some View {
        if let authored = slots[node.id]?[slot] {
            authored.content.font(AWCNativeFonts.label(size:font?.size ?? 16,weight:font?.weight ?? 400))
                .tracking(font?.spacing ?? 0).foregroundStyle(color)
        }
        else {
            let children = node.children(inSlot: slot.rawValue)
            if !children.isEmpty {
                let layout = slot == .content ? AnyLayout(VStackLayout(alignment: .leading, spacing: 0)) : AnyLayout(HStackLayout(spacing: 0))
                layout {
                    ForEach(children) { child in
                        if child.tag == "#text" || child.tag == "#slot-text" {
                            let value = child.properties["text"]?.string ?? ""
                            text(value, size: font?.size ?? 16, lineHeight: font?.lineHeight ?? 24, weight: font?.weight ?? 400, spacing: font?.spacing ?? 0, color: color, wrap: slot == .content)
                        } else { AWCNativeView(node: child, onEvent: onEvent).environment(\.awcNativeDensity, density) }
                    }
                }
            } else if slot == .headline {
                text(headline, size: font?.size ?? 16, lineHeight: font?.lineHeight ?? 24, weight: font?.weight ?? 500, spacing: font?.spacing ?? 0.15, color: color, wrap: false)
            } else if slot == .leadingIcon {
                Text(node.properties["icon"]?.string ?? "")
                    .font(Font(AWCNativeFonts.accordionSymbol(size: iconSize, fill: iconFill))).tracking(0)
                    .fixedSize().frame(width:iconSize,height:iconSize).foregroundStyle(color)
                    .environment(\.layoutDirection,.leftToRight).accessibilityHidden(true)
            } else if slot == .trailingIcon {
                AWCAccordionChevron().fill(color).frame(width: 24, height: 24)
            }
        }
    }
    @ViewBuilder private func text(_ value: String, size: Double, lineHeight: Double, weight: Double, spacing: Double, color: Color, wrap: Bool) -> some View {
        if size==0 {
            Color.clear.frame(width:0,height:value.trimmingCharacters(in:.whitespacesAndNewlines).isEmpty ? 0:max(0,lineHeight))
        } else {
            AWCNativeMeterTextView(model: .init(text: value, size: size, lineHeight: lineHeight, weight: weight, spacing: spacing, tabular: false), color: color, wrap: wrap, center: false, ellipsize: !wrap)
                .accessibilityElement().accessibilityLabel(Text(value)).accessibilityAddTraits(.isStaticText)   // custom-drawn text is read as text
        }
    }
    private func color(_ token: String, _ fallback: String) -> Color { Color(awcHex: theme.tokens["--md-sys-color-" + token] ?? fallback) }
    private func blend(_ start: Color, _ end: Color, _ t: Double) -> Color {
        awcInterpolatedColor(start,end,t)
    }
}

private struct AWCNativeAccordionRunningTransition {
    let start: AWCNativeAccordionMotion.Frame, motion: AWCNativeAccordionMotion, date: Date
    func frame(_ now: Date) -> AWCNativeAccordionMotion.Frame {
        let next = motion.frame(elapsedMilliseconds: max(0,now.timeIntervalSince(date)*1000)), target = motion.opening ? 1.0 : 0.0
        func interpolate(_ from: Double, _ value: Double) -> Double { from + (target-from) * (motion.opening ? value : 1-value) }
        let height = interpolate(start.height,next.height)
        return .init(height: height, contentClip: height*height, opacity: motion.preset == "collapse" ? 1 : interpolate(start.opacity,next.opacity),
                     shape: interpolate(start.shape,next.shape), spatial: interpolate(start.spatial,next.spatial), effects: interpolate(start.effects,next.effects))
    }
}

/// Web: the header button `aria-controls` the panel region. macOS: an invisible anchor view inside the panel registers with the
/// md-tab link table; the header links to the accessibility element around it (AXLinkedUIElements): SwiftUI exposes the panel
/// region as the content's AXScrollArea named like the header. UIKit has no element relation (R6-09).
#if canImport(AppKit)
import AppKit
struct AWCAccordionPanelAnchor: NSViewRepresentable {
    let id: String, name: String
    final class Anchor: NSView { override func hitTest(_ point: NSPoint) -> NSView? { nil }; override func isAccessibilityElement() -> Bool { false } }
    func makeNSView(context: Context) -> Anchor { let v = Anchor(); AWCTabPanelLinks.register(v, id: id, name: name, tabs: nil, index: -1); return v }
    func updateNSView(_ v: Anchor, context: Context) { AWCTabPanelLinks.register(v, id: id, name: name, tabs: nil, index: -1) }
}
#else
struct AWCAccordionPanelAnchor: View { let id: String, name: String; var body: some View { EmptyView() } }
#endif

extension View {
    /// Web renders the header button inside a heading (h3 > button). macOS exposes an AXHeading around the header control;
    /// iOS carries the header trait on the control itself (UIKit has no heading container).
    /// Web's panel is a region named by its header (aria-labelledby). macOS: a group with that name; iOS has no region container.
    @ViewBuilder func awcAccordionRegionSemantics(label: String) -> some View {
        #if os(macOS)
        self.accessibilityElement(children: .contain).accessibilityLabel(Text(label))
        #else
        self
        #endif
    }
    @ViewBuilder func awcAccordionHeadingSemantics(level: Int, label: String) -> some View {
        #if os(macOS)
        self.accessibilityHidden(true).background {
            AWCNativeContainerAccessibilityBridge(role: "AXHeading", label: label, identifier: "", level: min(6, max(1, level)), members: .all)
        }
        #else
        self
        #endif
    }
}
