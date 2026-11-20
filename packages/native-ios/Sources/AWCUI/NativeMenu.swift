import SwiftUI
import QuartzCore
#if canImport(AppKit)
import AppKit
#endif

// md-menu, md-menu-item, md-sub-menu-item, md-menu-item-group: dedicated SwiftUI renderers.
// Contract: docs/native-parity/md-menu-source-review.md; geometry and colors from the source CSS (MenuSupport.swift).

/// Where a row sits in its menu (the `::slotted` / `:first-child` / `data-*` inputs of the source CSS).
struct AWCMenuItemContext: Equatable {
    var variant = "baseline", first = false, last = false, afterGap = false, directChild = true
    var gapCard = false, useGap = false, inGroup = false, groupShape = 12.0, radioScope = "", listbox = false
}
/// A submenu row hosting a nested md-menu (`slot="submenu"`): its frame in the menu scope and open state.
struct AWCMenuFlyoutHost: Equatable { let rowID: String; let frame: CGRect; let open: Bool }
private struct AWCMenuItemContextKey: EnvironmentKey { static let defaultValue: AWCMenuItemContext? = nil }
private struct AWCMenuHeaderSlotsKey: EnvironmentKey { static let defaultValue: [String: AnyView] = [:] }
public extension View {
    /// Authored `header` slot content of the md-menu node `menuID` (pinned above the scroll viewport).
    func awcMenuHeader<V: View>(for menuID: String, @ViewBuilder _ content: () -> V) -> some View { modifier(AWCMenuHeaderModifier(id: menuID, view: AnyView(content()))) }
}
private struct AWCMenuHeaderModifier: ViewModifier {
    let id: String, view: AnyView
    @Environment(\.awcMenuHeaderSlots) private var outer
    func body(content: Content) -> some View { content.environment(\.awcMenuHeaderSlots, outer.merging([id: view]) { _, new in new }) }
}
private struct AWCMenuFlyoutHostKey: EnvironmentKey { static let defaultValue: AWCMenuFlyoutHost? = nil }
private struct AWCMenuMeasuringKey: EnvironmentKey { static let defaultValue = false }
extension EnvironmentValues {
    var awcMenuItemContext: AWCMenuItemContext? { get { self[AWCMenuItemContextKey.self] } set { self[AWCMenuItemContextKey.self] = newValue } }
    var awcMenuFlyoutHost: AWCMenuFlyoutHost? { get { self[AWCMenuFlyoutHostKey.self] } set { self[AWCMenuFlyoutHostKey.self] = newValue } }
    /// The hidden sizing copy of a top-layer surface: rows render without flyouts.
    var awcMenuMeasuring: Bool { get { self[AWCMenuMeasuringKey.self] } set { self[AWCMenuMeasuringKey.self] = newValue } }
    var awcMenuHeaderSlots: [String: AnyView] { get { self[AWCMenuHeaderSlotsKey.self] } set { self[AWCMenuHeaderSlotsKey.self] = newValue } }
}

/// The environment of the menu's position in the tree, re-applied to its top-layer surface (overlay content
/// is hosted by the scope, outside the menu's ancestors).
struct AWCMenuCarriedEnvironment {
    var direction: LayoutDirection, density: Double, denseInset: Bool, compactSmallGap: Bool, rung: Double
    var appearance: AWCMenuAppearance, reduced: Bool?, theme: AWCTheme?, tokens: [String: String]
    var store: AWCInteractionStore?, dispatcher: AWCEventDispatcher?, pointer: AWCNativePointerState?
    var headers: [String: AnyView] = [:]
    var parts = AWCMenuPartStyles()   // r4: menu parts
}
struct AWCMenuCarry: ViewModifier {
    let env: AWCMenuCarriedEnvironment, controller: AWCMenuController
    func body(content: Content) -> some View {
        content.environment(\.layoutDirection, env.direction).environment(\.awcNativeDensity, env.density)
            .environment(\.awcNativeDenseInset, env.denseInset).environment(\.awcNativeCompactSmallGap, env.compactSmallGap)
            .environment(\.awcNativeSpacingRung, env.rung).environment(\.awcMenuAppearance, env.appearance)
            .environment(\.awcMenuReducedMotion, env.reduced).environment(\.awcTheme, env.theme).environment(\.awcThemeTokens, env.tokens)
            .environment(\.awcInteractionStore, env.store).environment(\.awcEventDispatcher, env.dispatcher)
            .environment(\.awcNativePointerState, env.pointer).environment(\.awcMenuController, controller).environment(\.awcMenuHeaderSlots, env.headers).environment(\.awcMenuParts, env.parts)
    }
}

// MARK: - md-menu

struct AWCNativeMenu: View {
    let node: AWCNode, properties: [String: AWCValue], theme: AWCTheme
    let onEvent: (AWCEvent) -> Void, emit: (String) -> Void, setOpen: (Bool) -> Void
    @Environment(\.awcMenuRegistry) private var registry
    @Environment(\.awcMenuController) private var parentController
    @Environment(\.awcMenuFlyoutHost) private var flyoutHost
    @Environment(\.layoutDirection) private var direction
    @Environment(\.awcNativeDensity) private var inheritedDensity
    @Environment(\.awcNativeDenseInset) private var denseInset
    @Environment(\.awcNativeCompactSmallGap) private var compactSmallGap
    @Environment(\.awcNativeSpacingRung) private var rung
    @Environment(\.awcMenuAppearance) private var appearance
    @Environment(\.awcMenuReducedMotion) private var reducedOverride
    @Environment(\.accessibilityReduceMotion) private var systemReduced
    @Environment(\.awcTheme) private var envTheme
    @Environment(\.awcThemeTokens) private var envTokens
    @Environment(\.awcInteractionStore) private var store
    @Environment(\.awcEventDispatcher) private var dispatcher
    @Environment(\.awcNativePointerState) private var pointer
    @Environment(\.awcMenuHeaderSlots) private var headers
    @Environment(\.awcMenuParts) private var parts
    @State private var controller: AWCMenuController
    init(node: AWCNode, properties: [String: AWCValue], theme: AWCTheme, onEvent: @escaping (AWCEvent) -> Void, emit: @escaping (String) -> Void, setOpen: @escaping (Bool) -> Void) {
        self.node = node; self.properties = properties; self.theme = theme; self.onEvent = onEvent; self.emit = emit; self.setOpen = setOpen
        _controller = State(initialValue: AWCMenuController(nodeID: node.id))
    }
    private var model: AWCMenuModel { AWCMenuModel(properties) }
    private var carried: AWCMenuCarriedEnvironment {
        .init(direction: direction, density: inheritedDensity, denseInset: denseInset, compactSmallGap: compactSmallGap, rung: rung, appearance: appearance,
              reduced: reducedOverride, theme: envTheme, tokens: envTokens, store: store, dispatcher: dispatcher, pointer: pointer, headers: headers, parts: parts)
    }
    var body: some View {
        let model = model
        ZStack(alignment: .topLeading) { Color.clear.frame(width: 0, height: 0); content(model) }
            .onChange(of: model, initial: true) { old, new in sync(old: old, new: new) }
            .onAppear { attach() }
            .onChange(of: node) { _, n in controller.rowOrder = Self.roving(n) }
            .onDisappear { registry?.unregister(controller); if let row = controller.parentRowID { parentController?.children[row] = nil } }
    }
    @ViewBuilder private func content(_ model: AWCMenuModel) -> some View {
        if model.hidden { EmptyView() }
        else if let flyoutHost, let registry {
            Color.clear.frame(width: 0, height: 0)
                .preference(key: AWCMenuEntries.self, value: controller.isOpen || controller.closing || controller.lingering ? [entry(model, registry: registry, flyout: flyoutHost)] : [])
        } else if !model.anchor.isEmpty, let registry {
            Color.clear.frame(width: 0, height: 0)
                .preference(key: AWCMenuEntries.self, value: controller.isOpen || controller.closing || controller.lingering ? [entry(model, registry: registry, flyout: nil)] : [])
        } else if controller.isOpen || controller.closing || controller.lingering {
            AWCMenuMotionSurface(node: node, model: model, theme: theme, controller: controller, onEvent: onEvent, placement: nil, viewport: registry?.viewport ?? .zero)
        }
    }
    private func depth() -> Int { var d = 0; var p = controller.parent; while let q = p { d += 1; p = q.parent }; return d }
    private func entry(_ model: AWCMenuModel, registry: AWCMenuRegistry, flyout: AWCMenuFlyoutHost?) -> AWCMenuEntry {
        let env = carried, controller = controller, node = node, theme = theme, onEvent = onEvent
        return AWCMenuEntry(id: node.id, order: depth()) { viewport in
            AnyView(AWCMenuPopup(node: node, model: model, theme: theme, controller: controller, registry: registry, flyout: flyout, viewport: viewport, onEvent: onEvent)
                .modifier(AWCMenuCarry(env: env, controller: controller)))
        }
    }
    private func attach() {
        controller.registry = registry; controller.parent = flyoutHost != nil ? parentController : nil
        controller.setOpen = setOpen; controller.emit = emit
        if let host = flyoutHost, let parentController { controller.parentRowID = host.rowID; parentController.children[host.rowID] = controller }
        registry?.register(controller)
        if !model.anchor.isEmpty { registry?.wanted.insert(model.anchor) }
        let anchor = model.anchor
        controller.focusAnchorAction = { [weak registry] in registry?.focusAnchor(anchor) ?? false }
    }
    /// Header rows (`headerRows`) first, then the rows in source order.
    static func roving(_ n: AWCNode) -> [String] { (n.properties["headerRows"]?.array ?? []).map { $0.string } + rowIDs(n) }
    static func rowIDs(_ n: AWCNode) -> [String] {
        n.children.flatMap { c -> [String] in
            if c.properties["hidden"]?.bool == true { return [] }
            if c.tag == "md-menu-item" || c.tag == "md-sub-menu-item" { return [c.id] }
            if c.tag == "md-menu-item-group" { return rowIDs(c) }
            return []
        }
    }
    private func sync(old: AWCMenuModel, new: AWCMenuModel) {
        controller.model = new; controller.rowOrder = Self.roving(node)
        if !new.anchor.isEmpty { registry?.wanted.insert(new.anchor) }
        // Changes made by the controller already dispatched their event; host-driven `open` changes dispatch here.
        if new.open && !controller.isOpen { controller.show(keyboard: false) }
        else if !new.open && controller.isOpen { controller.isOpen = false; controller.closing = false; controller.ringed = nil; emit("mdClose") }
    }
}
extension AWCMenuRegistry {
    /// Focus the anchor element named by `anchor` (an AWCNativeView row registers its focus action).
    func focusAnchor(_ id: String) -> Bool { anchorFocus[id]?() ?? false }
}

/// The anchored (or flyout) surface positioned in the scope viewport.
struct AWCMenuPopup: View {
    let node: AWCNode, model: AWCMenuModel, theme: AWCTheme, controller: AWCMenuController, registry: AWCMenuRegistry
    let flyout: AWCMenuFlyoutHost?, viewport: CGSize, onEvent: (AWCEvent) -> Void
    @Environment(\.awcMenuAppearance) private var appearance
    @Environment(\.layoutDirection) private var direction
    @State private var measure = AWCMenuSurfaceMeasure()
    @State private var measuringController = AWCMenuController(nodeID: "")
    var body: some View {
        let _ = controller.repositions   // reposition(): a new placement pass from the current anchor and viewport
        let anchor = flyout?.frame ?? registry.anchors[model.anchor]
        let measured = measure.width > 0
        let placement: AWCMenuSurfacePlacement? = {
            guard let anchor, measured else { return nil }
            if flyout != nil {
                let size = CGSize(width: measure.width, height: measure.chrome + min(measure.content, AWCMenuSurfacePlacement.defaultCap(model: model, appearance: appearance, viewport: viewport, margin: 8)))
                let o = awcSubmenuOrigin(row: anchor, size: size, viewport: viewport, rtl: direction == .rightToLeft)
                return .init(origin: o, width: measure.width, cap: AWCMenuSurfacePlacement.defaultCap(model: model, appearance: appearance, viewport: viewport, margin: 8), vertical: "bottom", horizontal: "start", responsive: false)
            }
            return AWCMenuSurfacePlacement.resolve(anchor: anchor, surfaceWidth: measure.width, chrome: measure.chrome, content: measure.content, viewport: viewport, model: model,
                                            appearance: appearance, minWidth: 0)
        }()
        let _ = AWCMenuDebug.log("popup \(node.id) anchor=\(String(describing: anchor)) measure=\(measure) placement=\(String(describing: placement?.origin)) vp=\(viewport)")
        ZStack(alignment: .topLeading) {
            AWCMenuSurface(node: node, model: model, theme: theme, controller: measuringController, onEvent: { _ in }, cap: nil, width: nil,
                           minWidthOverride: model.matchAnchorWidth ? anchor.map { Double($0.width) } : nil, viewport: viewport, measure: $measure)
                .fixedSize()
                .environment(\.layoutDirection, direction)
                .environment(\.awcMenuMeasuring, true)
                .awcInspectionSuppressed()
                .opacity(0).allowsHitTesting(false).accessibilityHidden(true)
            if let placement {
                AWCMenuMotionSurface(node: node, model: model, theme: theme, controller: controller, onEvent: onEvent, placement: placement, viewport: viewport,
                                     matchWidth: model.matchAnchorWidth ? anchor.map { Double($0.width) } : nil)
                    .fixedSize()
                    .environment(\.layoutDirection, direction)
                    .onGeometryChange(for: CGRect.self) { $0.frame(in: .named(registry.space)) } action: { registry.surfaces[node.id] = $0; controller.surfaceFrame = $0 }
                    .padding(.leading, max(0, placement.origin.x)).padding(.top, max(0, placement.origin.y))
            }
        }
        .frame(width: viewport.width, height: viewport.height, alignment: .topLeading)
        .environment(\.layoutDirection, .leftToRight)
        .overlayPreferenceValue(AWCMenuEntries.self) { entries in
            ZStack(alignment: .topLeading) { ForEach(entries.sorted { $0.order < $1.order }) { $0.content(viewport) } }
                .frame(width: viewport.width, height: viewport.height, alignment: .topLeading)
        }
    }
}
enum AWCMenuDebug { static let on = ProcessInfo.processInfo.environment["AWC_MENU_DEBUG"] != nil; static func log(_ s: @autoclosure () -> String) { if on { print("[menu] " + s()); fflush(stdout) } } }
struct AWCMenuSurfaceMeasure: Equatable { var width = 0.0, chrome = 0.0, content = 0.0 }

/// Open / close motion (opacity + scaleY 0.8 from the placement corner) around the surface.
struct AWCMenuMotionSurface: View {
    let node: AWCNode, model: AWCMenuModel, theme: AWCTheme, controller: AWCMenuController, onEvent: (AWCEvent) -> Void
    let placement: AWCMenuSurfacePlacement?, viewport: CGSize
    var matchWidth: Double? = nil
    var measure: Binding<AWCMenuSurfaceMeasure>? = nil
    @Environment(\.awcMenuReducedMotion) private var reducedOverride
    @Environment(\.accessibilityReduceMotion) private var systemReduced
    @State private var track: AWCCSSTransitionTrack
    @State private var primed = false
    /// The timeline keeps running for a few frames after mounting, so a surface that snaps (quick, Reduce Motion) still
    /// republishes its preferences (inspection, nested flyout entries) when it is mounted inside another popup's overlay.
    @State private var settled = false
    init(node: AWCNode, model: AWCMenuModel, theme: AWCTheme, controller: AWCMenuController, onEvent: @escaping (AWCEvent) -> Void, placement: AWCMenuSurfacePlacement?, viewport: CGSize,
         matchWidth: Double? = nil, measure: Binding<AWCMenuSurfaceMeasure>? = nil, initiallyShown: Bool = false) {
        self.node = node; self.model = model; self.theme = theme; self.controller = controller; self.onEvent = onEvent; self.placement = placement; self.viewport = viewport
        self.matchWidth = matchWidth; self.measure = measure
        var track = AWCCSSTransitionTrack(initial: model.quick || initiallyShown ? 1 : 0)
        // 6-6: mounted (or remounted) while the open transition runs -> start on that transition (Chrome: clock from the style change).
        if !model.quick && !initiallyShown && controller.parent == nil && controller.isOpen && !controller.closing && controller.openedAt > 0 {
            track.set(1, now: controller.openedAt + 2000.0 / 60, duration: 150, curve: [0.05, 0.7, 0.1, 1])
        }
        _track = State(initialValue: track)
    }
    private var reduced: Bool { reducedOverride ?? systemReduced }
    private var target: Double { controller.isOpen && !controller.closing ? 1 : 0 }   // lingering = exit still painting
    var body: some View {
        let now = CACurrentMediaTime() * 1000
        TimelineView(.animation(paused: !track.isRunning(now) && settled)) { _ in
            // Quick / reduced menus snap: the first pass already paints the snapped state (a top-layer surface
            // mounted inside another popup's overlay may not republish a second pass in the same frame).
            let t = CACurrentMediaTime() * 1000, p = !primed && (model.quick || reduced) ? target : track.presented(t)
            let scale = reduced ? 1 : 0.8 + 0.2 * p
            AWCMenuSurface(node: node, model: model, theme: theme, controller: controller, onEvent: onEvent, cap: placement?.cap, width: placement?.responsive == true ? placement?.width : nil,
                           minWidthOverride: matchWidth, viewport: viewport, measure: measure)
                .opacity(p)
                .scaleEffect(x: 1, y: scale, anchor: placement?.unitAnchor ?? .topLeading)
                .awcInspect(nodeID: node.id, part: "motion", name: "md-menu-motion") { _ in ["progress": .number(p), "scaleY": .number(scale), "renderTime": .number(t), "open": .bool(controller.isOpen), "closing": .bool(controller.closing)] }
        }
        .task { try? await Task.sleep(for: .milliseconds(150)); settled = true }
        .onChange(of: target, initial: true) { _, next in
            guard primed else { primed = true; if model.quick || reduced { track.snap(next) } else if track.presented(CACurrentMediaTime() * 1000) != next { start(next) }; return }
            start(next)
        }
    }
    private func start(_ next: Double) {
        let now = CACurrentMediaTime() * 1000
        if next == 1 && controller.parent != nil && !(model.quick || reduced) {
            track.snap(0); track.set(1, now: controller.openedAt + 2000.0 / 60, duration: 0.001, curve: [0, 0, 1, 1]); return
        }
        if model.quick || reduced || (next == 1 && controller.parent != nil) {
            let requested = next == 1 ? controller.openedAt : controller.closingAt
            if requested > 0 && now < requested + 2000.0 / 60 { track.set(next, now: requested + 2000.0 / 60, duration: 0.001, curve: [0, 0, 1, 1]) } else { track.snap(next) }
            return
        }
        let requested = next == 1 ? controller.openedAt : controller.closingAt
        // 9-27 (S7-6-02): both the open and the close start two frames after their request time; the close request time is the activation plus the 150 ms of the Web source (MenuController.activated), so the start no longer depends on the wake-up jitter of the sleep
        track.set(next, now: (requested > 0 ? requested : now) + 2000.0 / 60, duration: 150, curve: next == 1 ? [0.05, 0.7, 0.1, 1] : [0.3, 0, 0.8, 0.15])
    }
}

/// `.md-menu__surface`: header slot, the capped scroll viewport and the rows / empty text.
struct AWCMenuSurface: View {
    let node: AWCNode, model: AWCMenuModel, theme: AWCTheme, controller: AWCMenuController, onEvent: (AWCEvent) -> Void
    let cap: Double?, width: Double?
    var minWidthOverride: Double? = nil
    let viewport: CGSize
    var measure: Binding<AWCMenuSurfaceMeasure>? = nil
    @Environment(\.awcMenuAppearance) private var appearance
    @Environment(\.awcNativeSpacingRung) private var inheritedRung
    @Environment(\.layoutDirection) private var direction
    @Environment(\.awcMenuHeaderSlots) private var headerSlots
    @Environment(\.awcMenuInlineFill) private var inlineFill
    @Environment(\.awcMenuParts) private var parts
    @Environment(\.awcNativePointerState) private var pointer
    @State private var surfaceHovered = false
    @State private var surfaceFrame: CGRect = .zero
    private var pointerOver: Bool { pointer.map { $0.location.map(surfaceFrame.contains) ?? false } ?? surfaceHovered }
    @State private var contentHeight = 0.0
    @State private var headerHeight = 0.0
    private var rung: Double { if let d = model.density, d <= -2 { return d }; return inheritedRung }
    var body: some View {
        let sp = AWCMenuSpacing(rung: rung), palette = AWCMenuPalette(tokens: theme.tokens)
        let styled = model.variant != "baseline", cards = model.groupedGapCards
        let padV = cards || inlineFill ? 0 : sp.insetXS, padH = cards || inlineFill ? 0 : (styled ? sp.insetXS : 0)
        let surfacePart = parts.menu(.surface, id: node.id), viewportPart = parts.menu(.menuViewport, id: node.id), emptyPart = parts.menu(.emptyText, id: node.id)
        let radius = surfacePart?.cornerRadius ?? (styled ? Double(px(theme.tokens["--md-sys-shape-corner-large"]) ?? 16) : Double(px(theme.tokens["--md-sys-shape-corner-small"]) ?? 8))
        // Inline fill: square, except the end corners (--md-menu-inline-fill-radius-end).
        let endRadius = AWCCornerRadius(.points(px(appearance.inlineFillRadiusEnd) ?? 0))
        let shape = inlineFill ? AWCNativeCornerShape(corners: AWCCornerShape(bottomRight: endRadius, bottomLeft: endRadius)) : AWCNativeCornerShape(corners: .points(radius))
        let vw = viewport.width > 0 ? viewport : CGSize(width: 1200, height: 900)
        let minW = AWCMenuLength(appearance.minWidth)?.resolve(viewport: vw) ?? 112
        let margin = AWCMenuLength(appearance.viewportMargin)?.resolve(viewport: vw) ?? 8
        let maxW = min(AWCMenuLength(appearance.maxWidth)?.resolve(viewport: vw) ?? Double(vw.width), Double(vw.width) - 2 * margin)
        let capValue = inlineFill ? Double.greatestFiniteMagnitude : cap ?? AWCMenuSurfacePlacement.defaultCap(model: model, appearance: appearance, viewport: vw, margin: margin)
        let header = node.children(inSlot: "header")
        let rows = visibleChildren
        let hasSub = node.children.contains { $0.tag == "md-sub-menu-item" } || node.children.contains { $0.tag == "md-menu-item-group" && $0.children.contains { $0.tag == "md-sub-menu-item" } }
        let column = AWCMenuColumn(gap: cards ? (AWCMenuLength(appearance.groupGap)?.resolve(viewport: vw) ?? 4) : 0) {
            ForEach(Array(rows.enumerated()), id: \.element.id) { i, child in
                AWCNativeView(node: child, onEvent: onEvent)
                    .environment(\.awcMenuItemContext, context(i, rows, cards: cards))
                    .padding(.bottom, model.variant == "baseline" && sectioned(rows) && child.properties["gap"]?.bool == true ? AWCMenuSurfacePlacement.sectionGap(appearance: appearance, viewport: vw) : 0)
                    .awcMenuCardShadow(cards && hasSub && child.tag == "md-menu-item-group")
            }
            if rows.isEmpty || !rows.contains(where: Self.hasVisibleItem), !model.emptyText.isEmpty {
                Text(model.emptyText).font(AWCNativeFonts.label(size: 14, weight: 400)).tracking(emptyPart?.letterSpacing ?? 0).modifier(AWCCSSLineBox(size: 14, line: 20))
                    .foregroundStyle(Color(awcHex: emptyPart?.color ?? palette.emptyInk)).multilineTextAlignment(.center)
                    .frame(maxWidth: .infinity).padding(.vertical, sp.insetMD).padding(.horizontal, sp.insetLG)
                    .modifier(AWCMenuPartBox(part: emptyPart))
                    .awcInspect(nodeID: node.id, part: "empty-text", name: "empty-text")
            }
        }
        VStack(spacing: 0) {
            if let slot = headerSlots[node.id] {
                slot.frame(maxWidth: .infinity, alignment: .leading).modifier(AWCMenuVirtualKeysIf(controller: controller))
                    .onGeometryChange(for: Double.self) { Double($0.size.height) } action: { headerHeight = $0 }
            } else if !header.isEmpty {
                VStack(alignment: .leading, spacing: 0) { ForEach(header) { AWCNativeView(node: $0, onEvent: onEvent) } }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .onGeometryChange(for: Double.self) { Double($0.size.height) } action: { headerHeight = $0 }
            }
            AWCMenuViewport(cap: capValue, scrollTop: controller.scrollTop) {
                column.onGeometryChange(for: Double.self) { Double($0.size.height) } action: { contentHeight = $0 }
            }
            .frame(maxHeight: inlineFill ? .infinity : nil, alignment: .top)
            .clipped()
            .modifier(AWCMenuPartBox(part: viewportPart))
            .modifier(AWCMenuScopeFrame(registry: controller.registry) { controller.viewportFrame = $0 })
            .awcInspect(nodeID: node.id, part: "menu-viewport", name: "menu-viewport") { _ in ["scrollTop": .number(controller.scrollTop), "cap": .number(capValue)] }
        }
        .frame(minWidth: minWidthOverride == nil ? CGFloat(minW) : nil, maxWidth: width == nil && minWidthOverride == nil ? CGFloat(maxW) : nil)
        .padding(.vertical, padV).padding(.horizontal, padH)
        .frame(minWidth: (width ?? minWidthOverride).map { CGFloat($0) }, idealWidth: width.map { CGFloat($0) },
               maxWidth: width.map { CGFloat($0) } ?? (minWidthOverride != nil ? CGFloat(Double(vw.width) - 2 * margin) : nil))
        .frame(maxWidth: inlineFill ? .infinity : nil, maxHeight: inlineFill ? .infinity : nil, alignment: .top)
        .background { if !cards || surfacePart?.background != nil || inlineFill { shape.fill(Color(awcHex: surfacePart?.background ?? (inlineFill ? appearance.inlineSurfaceColor ?? "#00000000" : palette.surface(model.variant)))) } }
        .modifier(AWCMenuInlineClip(on: inlineFill, shape: shape))
        .background { if !cards && !inlineFill { AWCMenuSurfaceBoxShadow(corners: .points(radius), layers: AWCMenuPalette.surfaceShadow(model.variant), placement: .outer) } }
        .modifier(AWCMenuDropShadow(on: cards && !hasSub))
        .modifier(AWCMenuPartBox(part: surfacePart, fill: false))
        .onGeometryChange(for: Double.self) { Double($0.size.width) } action: { w in measure?.wrappedValue.width = w }
        .onChange(of: contentHeight, initial: true) { _, h in measure?.wrappedValue.content = h; if measure == nil { controller.contentHeight = h; controller.viewportHeight = min(h, capValue) } }
        .onChange(of: headerHeight + padV * 2, initial: true) { _, c in measure?.wrappedValue.chrome = c }
        .onContinuousHover(coordinateSpace: .global) { phase in var inside = false; if case .active = phase { inside = true }; surfaceHovered = inside }
        .onGeometryChange(for: CGRect.self) { $0.frame(in: .named("awc-native-preview")) } action: { surfaceFrame = $0 }
        .onChange(of: pointerOver) { _, inside in
            guard controller.pointerInside != inside else { return }
            controller.pointerInside = inside
            // Entering the flyout keeps its row open; leaving it starts the row's close intent.
            if let parent = controller.parent, let row = controller.parentRowID { if inside { parent.rows[row]?.openSubmenu(false) } else { parent.rows[row]?.hoverLeave() } }
        }
        .awcInspect(nodeID: node.id, part: "surface", name: "surface") { _ in ["variant": .string(model.variant), "radius": .number(radius)] }
        .awcInspect(nodeID: node.id, name: "md-menu") { _ in ["open": .bool(controller.isOpen), "role": .string(model.listbox || controller.listboxMode ? "presentation" : "menu"),
                                                             "activeDescendant": controller.activeDescendant.map { .string($0) } ?? .null] }
        .environment(\.awcMenuController, controller)
        .modifier(AWCMenuDensityModifier(value: model.density))
        .modifier(AWCMenuContainerAccessibility(listbox: model.listbox || controller.listboxMode, label: model.listbox || controller.listboxMode ? model.listLabel : menuName, id: node.id))
    }
    private var visibleChildren: [AWCNode] { node.children.filter { $0.tag.hasPrefix("md-") && $0.slot != "header" && $0.properties["hidden"]?.bool != true } }
    /// The menu is named after its anchor (Web ariaLabelledByElements = [anchor]); a flyout after its submenu row.
    private var menuName: String {
        guard let registry = controller.registry else { return "" }
        if let row = controller.parentRowID { return registry.anchorLabels[row] ?? "" }
        return registry.anchorLabels[model.anchor] ?? ""
    }
    static func hasVisibleItem(_ n: AWCNode) -> Bool {
        if n.properties["hidden"]?.bool == true { return false }
        if n.tag == "md-menu-item" || n.tag == "md-sub-menu-item" { return true }
        return n.tag == "md-menu-item-group" && n.children.contains(where: hasVisibleItem)
    }
    private func sectioned(_ rows: [AWCNode]) -> Bool { rows.contains { $0.properties["gap"]?.bool == true } }
    private func context(_ i: Int, _ rows: [AWCNode], cards: Bool) -> AWCMenuItemContext {
        var c = AWCMenuItemContext(); c.variant = model.variant; c.first = i == 0; c.last = i == rows.count - 1
        c.afterGap = i > 0 && rows[i - 1].properties["gap"]?.bool == true; c.directChild = true; c.gapCard = cards
        c.radioScope = node.id; c.listbox = model.listbox; c.useGap = model.useGap
        if let s = AWCMenuLength(appearance.groupContainerShape)?.resolve(viewport: viewport) { c.groupShape = s }
        return c
    }
    private func px(_ s: String?) -> Double? { s.flatMap { Double($0.replacingOccurrences(of: "px", with: "").trimmingCharacters(in: .whitespaces)) } }
}
struct AWCMenuDensityModifier: ViewModifier {
    let value: Double?
    func body(content: Content) -> some View { if let v = value, [-1.0, -2, -3, -4].contains(v) { content.awcDensity(v) } else { content } }
}
struct AWCMenuDropShadow: ViewModifier {
    let on: Bool
    // filter: drop-shadow(0 1px 2px rgba(0,0,0,.15)) drop-shadow(0 2px 6px rgba(0,0,0,.1)); CSS blur b is σ = b/2.
    func body(content: Content) -> some View {
        if on { content.shadow(color: .black.opacity(0.15), radius: 1, x: 0, y: 1).shadow(color: .black.opacity(0.1), radius: 3, x: 0, y: 2) } else { content }
    }
}
private struct AWCMenuCardShadowModifier: ViewModifier {
    let on: Bool
    func body(content: Content) -> some View {
        if on { content.background { AWCNativeBoxShadow(corners: .points(12), layers: AWCMenuPalette.groupShadow, placement: .outer) } } else { content }
    }
}
extension View { func awcMenuCardShadow(_ on: Bool) -> some View { modifier(AWCMenuCardShadowModifier(on: on)) } }

/// Column of rows: ideal width = widest row (max-content), each row placed at the full proposed width.
struct AWCMenuColumn: Layout {
    let gap: Double
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let w = proposal.width ?? subviews.map { $0.sizeThatFits(.unspecified).width }.max() ?? 0
        let h = subviews.map { $0.sizeThatFits(.init(width: w, height: nil)).height }.reduce(0, +) + gap * Double(max(0, subviews.count - 1))
        return .init(width: w, height: h)
    }
    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var y = bounds.minY
        for v in subviews { let h = v.sizeThatFits(.init(width: bounds.width, height: nil)).height; v.place(at: .init(x: bounds.minX, y: y), proposal: .init(width: bounds.width, height: h)); y += h + gap }
    }
}
/// `.md-menu__scroll-shadow`: the content's natural height capped at `cap`, scrolled by `scrollTop`.
struct AWCMenuViewport: Layout {
    let cap: Double, scrollTop: Double
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        guard let v = subviews.first else { return .zero }
        let s = v.sizeThatFits(.init(width: proposal.width, height: nil))
        return .init(width: proposal.width ?? s.width, height: min(Double(s.height), cap))
    }
    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        guard let v = subviews.first else { return }
        let s = v.sizeThatFits(.init(width: bounds.width, height: nil))
        let top = min(max(0, scrollTop), max(0, Double(s.height) - Double(bounds.height)))
        v.place(at: .init(x: bounds.minX, y: bounds.minY - top), proposal: .init(width: bounds.width, height: s.height))
    }
}

// MARK: - rows

/// Flex row of md-menu-item / md-sub-menu-item: fixed children keep their width (plus margin-inline-start),
/// the content column takes the rest (min-width 0, ellipsis). Laid out physically (RTL mirrors the order).
private struct AWCMenuRowRole: LayoutValueKey { static let defaultValue: Double? = 0 }   // nil = flexible content; value = margin-inline-start
/// Exact max-content width (CoreText advances) of a text-sized row child.
private struct AWCMenuRowNatural: LayoutValueKey { static let defaultValue: Double? = nil }
func awcMenuTextWidth(_ text: String, size: Double, weight: Double, spacing: Double = 0) -> Double {
    AWCNativeMeterText(text: text, size: size, lineHeight: size, weight: weight, spacing: spacing, tabular: false, usesDefaultKerning: true).naturalWidth
}
struct AWCMenuRowLayout: Layout {
    let padding: Double, gap: Double, minHeight: Double, bottomPad: Double, rtl: Bool
    private func widths(_ subviews: Subviews) -> [Double] { subviews.map { $0[AWCMenuRowNatural.self] ?? Double($0.sizeThatFits(.unspecified).width) } }
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let w = widths(subviews), margins = subviews.map { $0[AWCMenuRowRole.self] ?? 0 }.reduce(0, +)
        let natural = padding * 2 + w.reduce(0, +) + margins + gap * Double(max(0, subviews.count - 1))
        let width = proposal.width.map(Double.init) ?? natural
        let content = contentWidth(width, subviews, w)
        let h = subviews.enumerated().map { i, v in Double(v.sizeThatFits(.init(width: v[AWCMenuRowRole.self] == nil ? content : w[i], height: nil)).height) }.max() ?? 0
        return .init(width: width, height: max(minHeight, h + bottomPad))
    }
    private func contentWidth(_ width: Double, _ subviews: Subviews, _ w: [Double]) -> Double {
        let fixed = subviews.enumerated().filter { $0.element[AWCMenuRowRole.self] != nil }.map { w[$0.offset] + ($0.element[AWCMenuRowRole.self] ?? 0) }.reduce(0, +)
        return max(0, width - padding * 2 - fixed - gap * Double(max(0, subviews.count - 1)))
    }
    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let w = widths(subviews), content = contentWidth(Double(bounds.width), subviews, w)
        let boxH = Double(bounds.height) - bottomPad
        var x = padding
        for (i, v) in subviews.enumerated() {
            let margin = v[AWCMenuRowRole.self], cw = margin == nil ? content : w[i]
            x += margin ?? 0
            let h = Double(v.sizeThatFits(.init(width: cw, height: nil)).height)
            let px = rtl ? Double(bounds.width) - x - cw : x
            v.place(at: .init(x: Double(bounds.minX) + px, y: Double(bounds.minY) + (boxH - h) / 2), proposal: .init(width: cw, height: h))
            x += cw + gap
        }
    }
}

struct AWCNativeMenuRow: View {
    let node: AWCNode, model: AWCMenuItemModel, theme: AWCTheme
    let setSelected: (Bool) -> Void, emit: (String) -> Void, onEvent: (AWCEvent) -> Void
    @Environment(\.awcMenuItemContext) private var contextValue
    @Environment(\.awcMenuController) private var controller
    @Environment(\.awcMenuRegistry) private var registry
    @Environment(\.awcMenuAppearance) private var appearance
    @Environment(\.awcNativeDensity) private var inheritedDensity
    @Environment(\.awcNativeSpacingRung) private var inheritedRung
    @Environment(\.layoutDirection) private var direction
    @Environment(\.awcMenuReducedMotion) private var reducedOverride
    @Environment(\.accessibilityReduceMotion) private var systemReduced
    @Environment(\.awcNativePointerState) private var pointer
    @Environment(\.awcMenuMeasuring) private var measuring
    @Environment(\.awcMenuParts) private var parts
    @State private var settleUntil = 0.0
    private func part(_ name: String) -> AWCMenuPartAppearance? { parts.row(name, id: node.id, sub: model.sub) }
    @State private var focus = AWCButtonFocusHandle()
    @State private var hovered = false
    @State private var pressed = false
    @State private var pressOrigin: CGPoint?
    /// iOS: press and click from the raw UIKit touch (`AWCTouchPressRouter`); SwiftUI's report of that touch is skipped.
    @State private var touch = AWCTouchPressState()
    @State private var activation = 0
    @State private var frame: CGRect = .zero
    @State private var scopeFrame: CGRect = .zero
    @State private var subOpen = false
    @State private var layer = AWCCSSTransitionTrack()
    @State private var corners = [AWCCSSTransitionTrack(), AWCCSSTransitionTrack(), AWCCSSTransitionTrack(), AWCCSSTransitionTrack()]
    @State private var fill = AWCCSSColorTrack()
    @State private var ink = AWCCSSColorTrack()
    @State private var primed = false
    @State private var openTimer = 0
    private var context: AWCMenuItemContext { contextValue ?? .init() }
    private var reduced: Bool { reducedOverride ?? systemReduced }
    private var scale: Double { AWCNativeDensity.resolve(model.density, inherited: inheritedDensity) }
    private var rung: Double { if let d = model.density, d <= -2 { return d }; return inheritedRung }
    private var metrics: AWCMenuRowMetrics { .init(scale: scale, rung: rung, variant: context.variant, sub: model.sub, hooks: appearance, viewport: registry?.viewport ?? .init(width: 1200, height: 900)) }
    private var hover: Bool { guard !model.disabled else { return false }; return pointer.map { $0.location.map(frame.contains) ?? false } ?? hovered }
    private var active: Bool { guard !model.disabled else { return false }; return pressed || (pointer.map { $0.isPointerDown && hover } ?? false) }
    private var ring: Bool { focus.isFocusVisible || (controller?.virtualRing == node.id && controller?.virtualRing != nil) }
    private var accessibleName: String { model.accessibleName(trailingSlot: !node.children(inSlot: "trailing-icon").isEmpty) }
    private var palette: AWCMenuPalette { .init(tokens: theme.tokens) }
    private struct Targets: Equatable { var layer: Double, corners: [Double], fill: String, ink: String }
    private var targets: Targets {
        let c = context, layer: Double = (active || ring) ? 0.12 : (hover || (model.sub && subOpen)) ? 0.08 : 0
        let r = AWCMenuRowCorners.resolve(variant: c.variant, first: c.first, last: c.last, afterGap: c.afterGap, gap: model.gap, directChild: c.directChild,
                                          hover: hover, active: active, selected: model.selected, sub: model.sub)
        return .init(layer: layer, corners: r.values, fill: model.selected ? palette.selectedFill(c.variant) : "#00000000", ink: palette.ink(c.variant, selected: model.selected))
    }
    private func apply(_ next: Targets) {
        let now = CACurrentMediaTime() * 1000
        guard primed else { layer.snap(next.layer); for i in 0..<4 { corners[i].snap(next.corners[i]) }
            fill.set(Color(awcHex: next.fill), now: 0, duration: 0, curve: [0, 0, 1, 1]); ink.set(Color(awcHex: next.ink), now: 0, duration: 0, curve: [0, 0, 1, 1]); primed = true; return }
        let standard = [0.2, 0, 0, 1.0]
        // State layer: 100 ms while :hover / :active match (md-menu-item) and always on submenu rows; leaving is instant on md-menu-item.
        let entering = next.layer > layer.presented(now)
        layer.set(next.layer, now: now, duration: (model.sub || entering) ? 100 : 0, curve: standard)
        for i in 0..<4 { corners[i].set(next.corners[i], now: now, duration: reduced ? 0 : 300, curve: [0.05, 0.7, 0.1, 1]) }
        fill.set(Color(awcHex: next.fill), now: now, duration: reduced ? 0 : 150, curve: standard)
        ink.set(Color(awcHex: next.ink), now: now, duration: reduced ? 0 : 150, curve: standard)
        // A paused TimelineView may keep its last content: run it for two frames so instant changes are drawn too.
        settleUntil = now + 34
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.06) { if CACurrentMediaTime() * 1000 >= settleUntil { settleUntil = 0 } }
    }
    private func running(_ now: Double) -> Bool { now < settleUntil || layer.isRunning(now) || corners.contains { $0.isRunning(now) } || fill.isRunning(now) || ink.isRunning(now) }
    var body: some View {
        if model.hidden { EmptyView() } else {
            let now = CACurrentMediaTime() * 1000
            TimelineView(.animation(paused: !running(now))) { _ in row(CACurrentMediaTime() * 1000) }
                .onChange(of: targets, initial: true) { _, next in apply(next) }
                .onAppear { register() }
                .onDisappear { controller?.unregister(node.id) }
                .onChange(of: model) { _, _ in register() }
                .onChange(of: context) { _, _ in register() }
        }
    }
    private func register() {
        guard let controller else { return }
        let scope = context.radioScope
        if model.sub { registry?.setAnchorLabel(node.id, accessibleName) }
        controller.register(node.id, .init(handle: focus, label: model.headline, disabled: model.disabled, sub: model.sub, radioScope: model.type == "radio" ? scope : nil,
                                           deselect: { setSelected(false) }, openSubmenu: { auto in openSub(autoFocus: auto) }, collapse: { collapseSub() },
                                           hoverLeave: { hoverChanged(false) }, closeSubmenu: { closeSubAnimated() }, activate: { click() }, keyActivate: { keyActivate($0) }))
    }
    private func row(_ t: Double) -> some View {
        let m = metrics, c = context, rtl = direction == .rightToLeft
        let radii = AWCMenuRowCorners(ss: corners[0].presented(t), se: corners[1].presented(t), es: corners[2].presented(t), ee: corners[3].presented(t))
        let shape = AWCNativeCornerShape(corners: radii.physical(rtl: rtl))
        let inkColor = ink.presented(t) ?? Color(awcHex: targets.ink), fillColor = fill.presented(t) ?? .clear
        let second = Color(awcHex: model.selected ? targets.ink : palette.secondaryInk(c.variant, selected: false))
        let layerOpacity = part("state-layer")?.opacity ?? layer.presented(t)
        let layerPart = part("state-layer")
        let layerShape: AWCNativeCornerShape = layerPart?.cornerRadius.map { AWCNativeCornerShape(corners: .points($0)) } ?? (c.useGap && c.inGroup ? AWCNativeCornerShape(corners: .points(max(0, (c.gapCard ? c.groupShape : 12) - 4))) : shape)
        let bottomPad = model.sub && model.divider ? 8.0 : 0
        return AWCMenuRowLayout(padding: m.paddingInline, gap: m.gap, minHeight: m.height, bottomPad: bottomPad, rtl: rtl) {
            if !model.sub && model.type != "button" && model.checkPosition == "start" { check(m).layoutValue(key: AWCMenuRowRole.self, value: 8) }
            if let lead = node.children(inSlot: "leading-icon").first { icon(lead, size: m.iconSize, color: part("leading-icon")?.color.map { Color(awcHex: $0) } ?? (model.selected ? inkColor : second), inspect: node.id).modifier(AWCMenuPartBox(part: part("leading-icon"))) }
            content(m, second: model.selected ? inkColor : second).layoutValue(key: AWCMenuRowRole.self, value: nil)
                .layoutValue(key: AWCMenuRowNatural.self, value: max(awcMenuTextWidth(model.headline, size: m.headlineSize, weight: 400, spacing: part("headline")?.letterSpacing ?? 0),
                                                                     model.supportingText.isEmpty ? 0 : awcMenuTextWidth(model.supportingText, size: m.supportingSize, weight: 400, spacing: part("supporting-text")?.letterSpacing ?? 0)))
            if !model.badge.isEmpty { badge.layoutValue(key: AWCMenuRowRole.self, value: model.sub ? 0 : 12).layoutValue(key: AWCMenuRowNatural.self, value: badgeWidth) }
            if !model.sub, let trail = trailing(m, color: model.selected ? inkColor : second) {
                trail.layoutValue(key: AWCMenuRowRole.self, value: 8)
                    .layoutValue(key: AWCMenuRowNatural.self, value: node.children(inSlot: "trailing-icon").isEmpty ? awcMenuTextWidth(model.trailingText, size: 11, weight: 400, spacing: part("trailing")?.letterSpacing ?? 0) : nil)
            }
            if model.sub { AWCMaterialSymbol("arrow_right", size: m.iconSize).foregroundStyle(model.selected ? inkColor : second)
                .scaleEffect(x: rtl ? -1 : 1, y: 1).rotationEffect(.degrees(subOpen ? 90 : 0)).animation(reduced ? nil : .timingCurve(0.2, 0, 0, 1, duration: 0.1), value: subOpen) }
            if !model.sub && model.type != "button" && model.checkPosition == "end" { check(m).layoutValue(key: AWCMenuRowRole.self, value: 8) }
        }
        .environment(\.layoutDirection, .leftToRight)
        .foregroundStyle(inkColor)
        .background {
            ZStack {
                shape.fill(fillColor)
                if ring { shape.inset(by: 1.5).stroke(Color(awcHex: palette.focusRing), lineWidth: 3) }
                if !model.disabled { AWCMenuRipple(pressed: pressed, activation: activation, color: inkColor, origin: pressOrigin, inspectNodeID: node.id).clipShape(shape) }
                layerShape.fill(Color(awcHex: layerPart?.background ?? palette.stateLayer(c.variant))).modifier(AWCMenuPartBox(part: layerPart, fill: false, applyOpacity: false)).opacity(layerOpacity)
                    .awcInspect(nodeID: node.id, part: "state-layer", name: "state-layer") { _ in ["opacity": .number(layerOpacity), "renderTime": .number(t)] }
            }
        }
        .overlay(alignment: .bottom) { if model.divider { Rectangle().fill(Color(awcHex: palette.divider)).frame(height: 1).allowsHitTesting(false) } }
        .opacity(model.disabled ? 0.38 : 1)
        .contentShape(Rectangle())
        .onGeometryChange(for: CGRect.self) { $0.frame(in: .named("awc-native-preview")) } action: { frame = $0 }
        .modifier(AWCMenuScopeFrame(registry: registry) { scopeFrame = $0; controller?.rowFrames[node.id] = $0 })
        .onContinuousHover(coordinateSpace: .global) { phase in var next = false; if case .active = phase { next = true }; if hovered != next { hovered = next } }
        .onChange(of: hover) { _, inside in AWCMenuDebug.log("hover \(node.id) \(inside) frame \(frame) at \(String(describing: pointer?.location)) t \(CACurrentMediaTime() * 1000)"); hoverChanged(inside) }
        .simultaneousGesture(pointerGesture)
        .allowsHitTesting(!model.disabled)
        .background { focusBridge }
        .overlay(alignment: .topLeading) { if model.sub { submenu } }
        .awcInspect(nodeID: node.id, name: model.sub ? "md-sub-menu-item" : "md-menu-item") { _ in
            ["role": .string(model.sub ? "menuitem" : model.role), "ariaChecked": model.ariaChecked.map { .string($0) } ?? .null, "selected": .bool(model.selected),
             "disabled": .bool(model.disabled), "focusRing": .bool(ring), "layerOpacity": .number(layerOpacity), "corners": .array(radii.values.map { .number($0) }),
             "expanded": model.sub ? .bool(subOpen) : .null, "renderTime": .number(t), "minHeight": .number(m.height)]
        }
        .padding(.bottom, bottomPad)
        .modifier(AWCMenuDensityModifier(value: model.density))
    }
    @ViewBuilder private func icon(_ n: AWCNode, size rowSize: Double, color: Color, inspect: String? = nil) -> some View {
        let size = n.tag == "#symbol" ? (n.properties["size"]?.number ?? rowSize) : rowSize
        Group { if n.tag == "#symbol" { AWCMaterialSymbol(n.properties["name"]?.string ?? "", size: size) } else { AWCNativeView(node: n, onEvent: onEvent) } }
            .foregroundStyle((n.properties["color"]?.string).map { Color(awcHex: $0) } ?? color).frame(width: min(size, rowSize), height: size)
            .modifier(AWCMenuOptionalInspect(nodeID: inspect, part: "leading-icon"))
            .frame(width: rowSize, height: rowSize)
    }
    private func check(_ m: AWCMenuRowMetrics) -> some View {
        AWCMaterialSymbol(model.checkGlyph, size: m.checkSize).frame(width: m.checkSize, height: m.checkSize)
    }
    private func content(_ m: AWCMenuRowMetrics, second: Color) -> some View {
        let rtl = direction == .rightToLeft
        return VStack(alignment: rtl ? .trailing : .leading, spacing: 0) {
            Text(model.headline).font(AWCNativeFonts.label(size: m.headlineSize, weight: 400)).tracking(part("headline")?.letterSpacing ?? 0).lineLimit(1).truncationMode(.tail)
                .modifier(AWCMenuPartInk(color: part("headline")?.color ?? part("content")?.color))
                .modifier(AWCCSSLineBox(size: m.headlineSize, line: m.headlineLine))
                .frame(maxWidth: .infinity, alignment: rtl ? .trailing : .leading)
                .environment(\.layoutDirection, direction)
                .modifier(AWCMenuPartBox(part: part("headline")))
                .awcInspect(nodeID: node.id, part: "headline", name: "headline")
            if !model.supportingText.isEmpty {
                Text(model.supportingText).font(AWCNativeFonts.label(size: m.supportingSize, weight: 400)).tracking(part("supporting-text")?.letterSpacing ?? 0).lineLimit(1).truncationMode(.tail)
                    .modifier(AWCCSSLineBox(size: m.supportingSize, line: m.supportingLine)).foregroundStyle(part("supporting-text")?.color.map { Color(awcHex: $0) } ?? second)
                    .frame(maxWidth: .infinity, alignment: rtl ? .trailing : .leading)
                    .environment(\.layoutDirection, direction)
                    .modifier(AWCMenuPartBox(part: part("supporting-text")))
                    .awcInspect(nodeID: node.id, part: "supporting-text", name: "supporting-text")
            }
        }
        .fixedSize(horizontal: false, vertical: true)
        .modifier(AWCMenuPartBox(part: part("content")))
        .awcInspect(nodeID: node.id, part: "content", name: "content")
    }
    private var badgeWidth: Double { 16 + awcMenuTextWidth(model.badge.trimmingCharacters(in: .whitespacesAndNewlines), size: 11, weight: 500, spacing: part("badge")?.letterSpacing ?? 0.5) }
    private var badge: some View {
        Text(model.badge.trimmingCharacters(in: .whitespacesAndNewlines)).font(AWCNativeFonts.label(size: 11, weight: 500)).tracking(part("badge")?.letterSpacing ?? 0.5).lineLimit(1).fixedSize()
            .modifier(AWCCSSLineBox(size: 11, line: 16)).frame(width: badgeWidth, height: 20)
            .foregroundStyle(Color(awcHex: part("badge")?.color ?? palette.badgeInk))
            .background(RoundedRectangle(cornerRadius: part("badge")?.cornerRadius ?? 10).fill(Color(awcHex: part("badge")?.background ?? palette.badgeFill)))
            .modifier(AWCMenuPartBox(part: part("badge"), fill: false))
            .awcInspect(nodeID: node.id, part: "badge", name: "badge")
    }
    private func trailing(_ m: AWCMenuRowMetrics, color: Color) -> AnyView? {
        if let t = node.children(inSlot: "trailing-icon").first { return AnyView(icon(t, size: m.iconSize, color: part("trailing")?.color.map { Color(awcHex: $0) } ?? color).modifier(AWCMenuPartBox(part: part("trailing"))).awcInspect(nodeID: node.id, part: "trailing", name: "trailing")) }
        guard !model.trailingText.isEmpty else { return nil }
        return AnyView(Text(model.trailingText).font(AWCNativeFonts.label(size: 11, weight: 400)).tracking(part("trailing")?.letterSpacing ?? 0).lineLimit(1).fixedSize().foregroundStyle(part("trailing")?.color.map { Color(awcHex: $0) } ?? color)
            .frame(width: awcMenuTextWidth(model.trailingText, size: 11, weight: 400, spacing: part("trailing")?.letterSpacing ?? 0))
            .modifier(AWCMenuPartBox(part: part("trailing"))).awcInspect(nodeID: node.id, part: "trailing", name: "trailing"))
    }
    // MARK: submenu flyout
    @ViewBuilder private var submenu: some View {
        if measuring { EmptyView() } else if let child = node.children(inSlot: "submenu").first(where: { $0.tag == "md-menu" }) {
            AWCNativeView(node: child, onEvent: onEvent)
                .environment(\.awcMenuFlyoutHost, AWCMenuFlyoutHost(rowID: node.id, frame: scopeFrame, open: subOpen))
                .environment(\.awcMenuItemContext, nil)
                .frame(width: 0, height: 0)
        }
    }
    private func openSub(autoFocus: Bool) {
        guard model.sub, !model.disabled, let controller else { return }
        openTimer &+= 1
        if !subOpen { for (id, row) in controller.rows where id != node.id && row.sub { row.collapse() } }
        subOpen = true; controller.openSubmenu = node.id
        controller.children[node.id]?.show(autoFocus: autoFocus, keyboard: autoFocus)
        if autoFocus { focus.showFocus = false }
    }
    /// `collapse()`: immediate, no exit.
    private func collapseSub() {
        openTimer &+= 1
        guard subOpen else { return }
        subOpen = false; if controller?.openSubmenu == node.id { controller?.openSubmenu = nil }
        controller?.children[node.id]?.closeNow()
    }
    /// `closeSubmenu()`: the flyout's exit starts now; the row stays open (state layer, caret, aria-expanded) for 100 ms.
    private func closeSubAnimated() {
        openTimer &+= 1; let token = openTimer
        guard subOpen else { return }
        controller?.children[node.id]?.close()
        Task { @MainActor in
            try? await Task.sleep(nanoseconds: 100_000_000)
            guard openTimer == token else { return }
            subOpen = false; if controller?.openSubmenu == node.id { controller?.openSubmenu = nil }
        }
    }
    /// Hover intent: open after `open-delay`, close after `close-delay` (pointer paths only).
    private func hoverChanged(_ inside: Bool) {
        guard model.sub, !model.disabled else { return }
        openTimer &+= 1; let token = openTimer
        let delay = inside ? model.openDelay : model.closeDelay
        if inside && subOpen { return }
        if !inside && !subOpen { return }
        Task { @MainActor in
            try? await Task.sleep(nanoseconds: UInt64(max(0, delay) * 1_000_000))
            guard openTimer == token else { return }
            if inside { openSub(autoFocus: false) }
            else if controller?.children[node.id]?.pointerInside == true || hover { return }
            else { closeSubAnimated() }
        }
    }
    // MARK: activation
    private var pointerGesture: some Gesture {
        DragGesture(minimumDistance: 0, coordinateSpace: .local)
            .onChanged { v in if !touch.ownsTouch { pointerDown(at: v.startLocation) } }
            .onEnded { v in
                if touch.ownsTouch { touch.swiftUIReleased(); return }
                pressed = false
                let inside = v.location.x >= 0 && v.location.y >= 0 && v.location.x <= frame.width && v.location.y <= frame.height
                if inside { clickDelivered() } }
    }
    /// 6-6: a click from the SwiftUI drag end is timed from the delivered touch-up (KNOWN-CAUSES row 3), as the raw-touch
    /// router does: a close it requests runs its exit from the release, not from the SwiftUI update after it.
    private func clickDelivered() {
        #if os(iOS)
        AWCInputDelivery.touchEndedAt = AWCInputDelivery.lastTouchUpAt
        defer { AWCInputDelivery.touchEndedAt = nil }
        #endif
        click()
    }
    private func pointerDown(at p: CGPoint) {
        guard !pressed else { return }
        pressed = true; pressOrigin = p; activation &+= 1; controller?.keyboardModality = false; focus.showFocus = false
        // iOS md-select / md-multi-select: the row takes the logical focus, the UIKit responder stays on the trigger field.
        if let c = controller, c.logicalRowFocus, c.comboboxID == nil { _ = c.focus(node.id, ring: false) } else { _ = focus.requestPointerFocus?() }
    }
    /// iOS raw touch (see `AWCTouchPressRouter`): press on touch down, click on touch up inside, as Chrome's pointer.
    private var touchHandler: AWCTouchPressHandler {
        .init(began: { p in touch.begin(at: p); pointerDown(at: p); return true },
              ended: { inside in touch.end(completed: true); pressed = false; if inside { click() } },
              cancelled: { touch.end(completed: false); pressed = false })
    }
    /// md-menu-item `handleClick`; md-sub-menu-item only emits mdClick (its flyout opens on hover / keys).
    private func click() {
        guard !model.disabled else { return }
        if model.sub { emit("mdClick"); return }
        if model.type == "checkbox" { setSelected(!model.selected) }
        else if model.type == "radio" { setSelected(true); controller?.select(radio: node.id) }
        emit("mdClick")
        if !model.keepOpen { controller?.activated() }
    }
    private func keyActivate(_ key: String) {
        guard !model.disabled else { return }
        pressOrigin = nil; activation &+= 1
        if model.sub { openSub(autoFocus: true); return }
        if key == "Space" && model.type != "button" {
            if model.type == "checkbox" { setSelected(!model.selected) } else { setSelected(true); controller?.select(radio: node.id) }
            emit("mdClick"); return
        }
        click()
    }
    private func routeKey(_ key: String, shift: Bool, modified: Bool) -> Bool {
        let rtl = direction == .rightToLeft
        if model.sub && subOpen && (key == "Escape" || key == (rtl ? "ArrowRight" : "ArrowLeft")) { closeSubAnimated(); _ = controller?.focus(node.id, ring: true); return true }
        if model.sub && !model.disabled {
            if key == (rtl ? "ArrowLeft" : "ArrowRight") { keyActivate("Enter"); return true }
        }
        if key == "Enter" || key == "Space" { keyActivate(key); return true }
        return controller?.key(key, from: node.id, shift: shift, modified: modified, rtl: direction == .rightToLeft) ?? false
    }
    private var focusBridge: some View {
        var policy: [String: AWCValue] = ["disabled": .bool(model.disabled), "roleOverride": .string(["menuitemradio": "radio", "menuitemcheckbox": "checkbox", "option": "option", "checkbox": "checkbox", "radio": "radio"][model.role] ?? "menuitem"), "_menuRoving": true,
                                          "groupTabindex": .number(controller?.focusedID == node.id ? 0 : -1)]
        if model.type != "button" { policy["selected"] = .bool(model.selected) }
        // aria-checked="mixed" (an indeterminate, not selected checkbox row: md-multi-select's "Select all").
        if model.ariaChecked == "mixed" { policy["mixed"] = true }
        return AWCNativeButtonFocusBridge(configuration: .init(id: node.id, label: accessibleName, policy: AWCButtonAccessibilityPolicy(properties: policy), group: nil, cell: nil,
            handle: focus, focusChanged: { f in if f { controller?.didFocus(node.id) } }, activate: { keyActivate("Enter") },
            routeKey: { key, shift, modified in routeKey(key, shift: shift, modified: modified) }, menuExpanded: model.sub ? subOpen : nil, touchPress: touchHandler))
    }
}
/// md-ripple as Chrome runs it inside md-menu-item: the wave's Web Animation starts when it is ready, two frames after
/// the press (or the keyboard `trigger()`), grows 450 ms (cubic-bezier(0.2, 0, 0, 1), opacity 0.12), and the release
/// fade (150 ms, same easing) is created when the grow finishes or at the release, and starts one frame later.
/// The wave's colour is the row's currentColor; md-ripple ignores reduced motion (Web Animations).
struct AWCMenuRipple: View {
    let pressed: Bool, activation: Int, color: Color, origin: CGPoint?
    var inspectNodeID: String? = nil
    @State private var start: Double?
    @State private var release: Double?
    @State private var waveOrigin: CGPoint?
    @State private var token = 0
    static let frame = 1000.0 / 60
    /// (opacity, scale) of the wave at `now` (ms).
    static func wave(now: Double, start: Double?, release: Double?) -> (Double, Double) {
        guard let s = start, now >= s else { return (0, 0) }
        let growth = AWCNativeButtonTiming.cubic(min(1, (now - s) / 450), x1: 0.2, y1: 0, x2: 0, y2: 1)
        guard let r = release else { return (0.12, growth) }
        let fadeStart = max(s + 450, r) + frame
        return (0.12 * (1 - AWCNativeButtonTiming.cubic(min(1, max(0, (now - fadeStart) / 150)), x1: 0.2, y1: 0, x2: 0, y2: 1)), growth)
    }
    var body: some View {
        GeometryReader { geometry in
            TimelineView(.animation(minimumInterval: nil, paused: start == nil)) { _ in
                let now = CACurrentMediaTime() * 1000
                let (alpha, growth) = Self.wave(now: now, start: start, release: release)
                let point = waveOrigin ?? CGPoint(x: geometry.size.width / 2, y: geometry.size.height / 2)
                let dx = max(abs(point.x), abs(geometry.size.width - point.x)), dy = max(abs(point.y), abs(geometry.size.height - point.y))
                let diameter = 2 * hypot(dx, dy)
                Circle().fill(color.opacity(alpha)).frame(width: diameter, height: diameter).scaleEffect(growth).position(point)
                    .awcInspect(nodeID: inspectNodeID ?? "", part: "ripple", name: "ripple") { _ in
                        ["x": .number(point.x), "y": .number(point.y), "diameter": .number(diameter), "scale": .number(growth), "opacity": .number(alpha), "renderTime": .number(now)]
                    }
            }
        }
        .allowsHitTesting(false).accessibilityHidden(true)
        .onChange(of: pressed) { _, down in
            let now = CACurrentMediaTime() * 1000
            if down { token &+= 1; start = now + Self.frame; release = nil; waveOrigin = origin }
            else if start != nil, release == nil { release = now; finish() }
        }
        .onChange(of: activation) { _, _ in
            let now = CACurrentMediaTime() * 1000
            token &+= 1
            if let origin {
                // Pointer press (md-ripple onPointerDown): the wave starts at the press point on the next frame and is held until
                // the release; a press whose release arrived in the same update (`pressed` already false) releases at once.
                start = now + Self.frame; waveOrigin = origin; release = pressed ? nil : now
            } else {
                // Keyboard activation (md-menu-item triggerRipple): a centered wave that releases itself when its grow finishes.
                start = now + 2 * Self.frame; waveOrigin = nil; release = now
            }
            if release != nil { finish() }
        }
    }
    private func finish() {
        guard let s = start, let r = release else { return }
        let end = max(s + 450, r) + Self.frame + 150, t = token
        Task { @MainActor in
            try? await Task.sleep(nanoseconds: UInt64(max(0, end - CACurrentMediaTime() * 1000 + 20) * 1_000_000))
            if token == t { start = nil; release = nil }
        }
    }
}

/// role="menu" (macOS: an AppKit menu element owns the rows) or, for a listbox menu, a labelled container of options.
struct AWCMenuContainerAccessibility: ViewModifier {
    let listbox: Bool, label: String, id: String
    @ViewBuilder func body(content: Content) -> some View {
        if listbox { content.accessibilityElement(children: .contain).accessibilityLabel(label) }
        else {
            #if canImport(AppKit)
            // Every row kind (menuitem, menuitemcheckbox, menuitemradio) belongs to the menu element or to one of its groups.
            content.accessibilityHidden(true).background { AWCMenuAccessibilityElement(role: .menu, label: label, identifier: id, owner: "") }
            #else
            content.awcMenuAccessibility(label: label, id: id)
            #endif
        }
    }
}

#if canImport(AppKit)
/// The open menu (Web role="menu") and its labelled groups (md-menu-item-group role="group") as AppKit elements: the
/// SwiftUI content stays hidden; the menu owns its groups and the rows outside them, a group owns the rows inside it,
/// in reading order (top to bottom, then along the line).
final class AWCMenuAccessibilityElementView: NSView {
    var role: NSAccessibility.Role = .menu, label = "", elementIdentifier = "", owner = ""
    weak var parentElement: NSView?
    override func hitTest(_ point: NSPoint) -> NSView? { nil }
    override func isAccessibilityElement() -> Bool { true }
    override func accessibilityRole() -> NSAccessibility.Role? { role }
    override func accessibilityLabel() -> String? { label }
    override func accessibilityIdentifier() -> String { elementIdentifier }
    override func accessibilityParent() -> Any? { parentElement ?? super.accessibilityParent() }
    override func accessibilityChildren() -> [Any]? {
        guard let content = window?.contentView else { return [] }
        func box(_ v: NSView) -> NSRect { v.convert(v.bounds, to: nil) }
        func center(_ r: NSRect) -> NSPoint { NSPoint(x: r.midX, y: r.midY) }
        func all(_ v: NSView) -> [NSView] { [v] + v.subviews.flatMap(all) }
        let mine = box(self).insetBy(dx: -1, dy: -1), views = all(content)
        let groups = role == .menu ? views.compactMap { $0 as? AWCMenuAccessibilityElementView }
            .filter { $0 !== self && $0.role == .group && $0.owner == elementIdentifier && $0.window != nil && mine.contains(center(box($0))) } : []
        let groupBoxes = groups.map { box($0).insetBy(dx: -1, dy: -1) }
        let rows = views.compactMap { $0 as? AWCNativeButtonFocusView }.filter { row in
            guard row.configuration?.inert == false else { return false }
            let c = center(box(row)); return mine.contains(c) && !groupBoxes.contains { $0.contains(c) }
        }
        groups.forEach { $0.parentElement = self }; rows.forEach { $0.awcAccessibilityContainer = self }
        let rtl = userInterfaceLayoutDirection == .rightToLeft
        return ((groups as [NSView]) + (rows as [NSView])).sorted { a, b in
            let ra = box(a), rb = box(b)
            if abs(ra.maxY - rb.maxY) > 1 { return ra.maxY > rb.maxY }
            return rtl ? ra.maxX > rb.maxX : ra.minX < rb.minX
        }
    }
}
struct AWCMenuAccessibilityElement: NSViewRepresentable {
    let role: NSAccessibility.Role, label: String, identifier: String, owner: String
    func makeNSView(context: Context) -> AWCMenuAccessibilityElementView { AWCMenuAccessibilityElementView() }
    func updateNSView(_ view: AWCMenuAccessibilityElementView, context: Context) {
        view.role = role; view.label = label; view.elementIdentifier = identifier; view.owner = owner
    }
}
#endif

/// Reports a row's frame in the menu scope's coordinate space (flyout placement).
struct AWCMenuScopeFrame: ViewModifier {
    let registry: AWCMenuRegistry?, action: (CGRect) -> Void
    func body(content: Content) -> some View {
        if let registry { content.onGeometryChange(for: CGRect.self) { $0.frame(in: .named(registry.space)) } action: { action($0) } } else { content }
    }
}

// MARK: - md-menu-item-group

struct AWCNativeMenuGroup: View {
    let node: AWCNode, theme: AWCTheme, onEvent: (AWCEvent) -> Void
    @Environment(\.awcMenuItemContext) private var contextValue
    @Environment(\.awcNativeSpacingRung) private var inheritedRung
    var body: some View {
        let c = contextValue ?? .init(), palette = AWCMenuPalette(tokens: theme.tokens)
        let density = node.properties["density"]?.number
        let rung: Double = { if let d = density, d <= -2 { return d }; return inheritedRung }()
        let sp = AWCMenuSpacing(rung: rung), label = node.properties["label"]?.string ?? ""
        let rows = node.children.filter { $0.tag.hasPrefix("md-") && $0.properties["hidden"]?.bool != true }
        let card = c.gapCard && c.variant != "baseline"
        VStack(spacing: 0) {
            VStack(alignment: .leading, spacing: 0) {
                if !label.isEmpty {
                    Text(label).font(AWCNativeFonts.label(size: 12, weight: 500)).modifier(AWCCSSLineBox(size: 12, line: 16))
                        .foregroundStyle(Color(awcHex: palette.groupLabel)).accessibilityHidden(true)
                        .padding(.top, sp.insetSM).padding(.bottom, sp.insetXS).padding(.horizontal, sp.insetMD)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                AWCMenuColumn(gap: 0) {
                    ForEach(Array(rows.enumerated()), id: \.element.id) { i, child in
                        AWCNativeView(node: child, onEvent: onEvent).environment(\.awcMenuItemContext, {
                            var x = c; x.first = i == 0; x.last = i == rows.count - 1; x.afterGap = false; x.directChild = false; x.inGroup = true; x.radioScope = node.id; return x }())
                    }
                }
            }
            .padding(card ? sp.insetXS : 0)
            .background { if card { RoundedRectangle(cornerRadius: c.groupShape).fill(Color(awcHex: palette.surface(c.variant))) } }
            .clipShape(RoundedRectangle(cornerRadius: card ? c.groupShape : 0))
            if !c.last && !c.gapCard {
                Rectangle().fill(Color(awcHex: palette.divider)).frame(height: 1).padding(.vertical, sp.gapXS)
            }
        }
        .modifier(AWCMenuDensityModifier(value: density))
        .accessibilityElement(children: .contain).accessibilityLabel(label)
        .modifier(AWCMenuGroupAccessibility(menuMode: !c.listbox, label: label, id: node.id, owner: c.radioScope))
        .awcInspect(nodeID: node.id, name: "md-menu-item-group") { _ in ["role": "group", "label": .string(label)] }
    }
}

/// macOS menu mode: the group is an AppKit element of the menu element (the menu's SwiftUI content is hidden).
struct AWCMenuGroupAccessibility: ViewModifier {
    let menuMode: Bool, label: String, id: String, owner: String
    @ViewBuilder func body(content: Content) -> some View {
        #if canImport(AppKit)
        if menuMode { content.background { AWCMenuAccessibilityElement(role: .group, label: label, identifier: id, owner: owner) } } else { content }
        #else
        content
        #endif
    }
}

/// Applies the owning menu's persisted checkbox / radio state to a row rebuilt by a re-opened surface.
struct AWCNativeMenuRowHost: View {
    let node: AWCNode, local: [String: AWCValue], theme: AWCTheme
    let set: (Bool) -> Void, emit: (String) -> Void, onEvent: (AWCEvent) -> Void
    @Environment(\.awcMenuController) private var controller
    var body: some View {
        var model = AWCMenuItemModel(tag: node.tag, local)
        if let s = controller?.selection[node.id] { model.selected = s }
        return AWCNativeMenuRow(node: node, model: model, theme: theme, setSelected: { v in controller?.selection[node.id] = v; set(v) }, emit: emit, onEvent: onEvent)
    }
}

// MARK: - dispatch

extension AWCNativeView {
    var nativeMenu: some View {
        AWCNativeMenu(node: node, properties: local, theme: theme, onEvent: onEvent, emit: { emit($0) }, setOpen: { set("open", .bool($0)) })
    }
    @ViewBuilder var nativeMenuItem: some View {
        if node.tag == "md-menu-item-group" { AWCNativeMenuGroup(node: node, theme: theme, onEvent: onEvent) }
        else { AWCNativeMenuRowHost(node: node, local: local, theme: theme, set: { set("selected", .bool($0)) }, emit: { emit($0) }, onEvent: onEvent) }
    }
}

/// Measures a menu row part when an inspection id is given.
struct AWCMenuOptionalInspect: ViewModifier {
    let nodeID: String?, part: String
    func body(content: Content) -> some View { if let nodeID { content.awcInspect(nodeID: nodeID, part: part, name: part) } else { content } }
}

/// Inline fill clips the surface (overflow: hidden) to its end-rounded shape; other surfaces are not clipped here.
struct AWCMenuInlineClip: ViewModifier {
    let on: Bool, shape: AWCNativeCornerShape
    @ViewBuilder func body(content: Content) -> some View { if on { content.clipShape(shape) } else { content } }
}
