import SwiftUI

/// md-icon-button.css geometry; density changes the box but not its shape tokens.
struct AWCNativeIconButtonMetrics {
    let width: CGFloat
    let height: CGFloat
    let iconSize: CGFloat
    let outlineWidth: CGFloat
    let roundRadius: CGFloat
    let squareRadius: CGFloat
    let pressedRadius: CGFloat
    let connectedRadius: CGFloat
    let restingOverride: CGFloat?
    let morphScale: CGFloat
    init(size: String, buttonWidth: String, density: Double, variant: String,
         appearance: AWCIconButtonAppearance = .init(), tokens: [String: String] = AWCGeneratedTokens.light) {
        let index = ["xs", "sm", "md", "lg", "xl"].firstIndex(of: size) ?? 1
        let scale = [-1.0, -2, -3, -4].contains(density) ? density : 0
        let base = [32.0, 40, 56, 96, 136]
        let widths = buttonWidth == "narrow" ? [28.0, 32, 48, 64, 104] : buttonWidth == "wide" ? [40.0, 52, 72, 128, 184] : base
        outlineWidth = variant == "outlined" ? CGFloat(appearance.outlineWidth ?? 1) : 0
        width = max(2 * outlineWidth, CGFloat(appearance.width ?? max(32, widths[index] + scale * 4)))
        height = max(2 * outlineWidth, CGFloat(appearance.height ?? max(32, base[index] + scale * 4)))
        iconSize = CGFloat(appearance.iconSize ?? max([16.0, 18, 18, 24, 28][index], [20.0, 24, 24, 32, 40][index] + scale * [1.0, 1, 1, 2, 3][index]))
        roundRadius = CGFloat([16.0, 20, 28, 48, 68][index])
        squareRadius = CGFloat(awcIconNumber(tokens["--md-sys-shape-corner-" + ["medium", "medium", "large", "extra-large", "extra-large"][index]], [12, 12, 16, 28, 28][index]))
        pressedRadius = CGFloat(awcIconNumber(tokens["--md-sys-shape-corner-" + ["small", "small", "medium", "large", "large"][index]], [8, 8, 12, 16, 16][index]))
        connectedRadius = CGFloat([4.0, 8, 8, 16, 20][index])
        restingOverride = appearance.cornerRadius.map { CGFloat($0) }
        morphScale = CGFloat(awcIconNumber(tokens["--md-sys-shape-morph-enabled"], 1))
    }
    func corners(shape: String, morph: Bool, selected: Bool, pressed: Bool, left: Bool, right: Bool) -> AWCNativeIconButtonCorners {
        let round = shape != "square"
        if left || right {
            return .init(start: left || !round ? connectedRadius : roundRadius, end: right || !round ? connectedRadius : roundRadius)
        }
        let rest = restingOverride ?? (round ? roundRadius : squareRadius)
        let target = !morph ? rest : pressed ? pressedRadius : selected ? (round ? squareRadius : roundRadius) : rest
        let result = max(0, rest + morphScale * (target - rest))
        return .init(start: result, end: result)
    }
}
struct AWCNativeIconButtonCorners: Equatable {
    let start: CGFloat
    let end: CGFloat
    var shape: UnevenRoundedRectangle {
        .init(topLeadingRadius: start, bottomLeadingRadius: start, bottomTrailingRadius: end, topTrailingRadius: end, style: .circular)
    }
}
struct AWCNativeIconButtonPalette {
    var container: String?
    var icon = "on-surface-variant"
    var outline: String?
    var disabled: Bool
    var allowsCustomContainer = true
    var allowsCustomOutline = true
    init(variant: String, toggle: Bool, selected: Bool, disabled: Bool) {
        self.disabled = disabled
        switch variant {
        case "filled": container = toggle && !selected ? "surface-container-highest" : "primary"; icon = toggle && !selected ? "primary" : "on-primary"
        case "tonal": container = toggle && !selected ? "surface-container-highest" : "secondary-container"; icon = toggle && !selected ? "on-surface-variant" : "on-secondary-container"
        case "outlined": container = selected ? "inverse-surface" : nil; icon = selected ? "inverse-on-surface" : "on-surface-variant"; outline = selected ? nil : "outline"; allowsCustomOutline = !selected
        default: icon = selected ? "primary" : "on-surface-variant"
        }
        if disabled {
            icon = "on-surface"
            if ["filled", "tonal"].contains(variant) { container = "on-surface"; allowsCustomContainer = false }
            else { container = nil }
            outline = variant == "outlined" ? "on-surface" : nil
            allowsCustomOutline = false
        }
    }
}

/// Slot fallback uses meaningful content, not the existence of a text node.
struct AWCNativeIconButtonSlots {
    let defaultChildren: [AWCNode]
    let selectedChildren: [AWCNode]
    let selectedLayer: Bool
    let fallback: String
    let hasBadge: Bool
    var visibleChildren: [AWCNode] { selectedLayer ? selectedChildren : defaultChildren }
    init(node: AWCNode, properties: [String: AWCValue]) {
        defaultChildren = node.children(inSlot: "")
        selectedChildren = node.children(inSlot: "selected")
        func meaningful(_ children: [AWCNode]) -> Bool {
            children.contains { $0.tag != "md-badge" && ($0.tag != "#text" || !($0.properties["text"]?.string ?? "").trimmingCharacters(in: .whitespacesAndNewlines).isEmpty) }
        }
        let selectedIcon = properties["selectedIcon"]?.string ?? ""
        selectedLayer = properties["toggle"]?.bool == true && properties["selected"]?.bool == true && (!selectedIcon.isEmpty || meaningful(selectedChildren))
        fallback = selectedLayer ? (meaningful(selectedChildren) ? "" : selectedIcon) : (meaningful(defaultChildren) ? "" : properties["icon"]?.string ?? "")
        hasBadge = defaultChildren.contains { $0.tag == "md-badge" }
    }
}

private func awcIconNumber(_ raw: String?, _ fallback: Double) -> Double {
    guard let raw else { return fallback }
    return Double(raw.replacingOccurrences(of: "px", with: "").replacingOccurrences(of: "ms", with: "")) ?? fallback
}

/// Fixed CSS border-box sizing never compresses under a smaller parent proposal.
private struct AWCNativeIconButtonLayout: Layout {
    let metrics: AWCNativeIconButtonMetrics
    let group: AWCNativeGroupChildGeometry?
    var motionDelta: CGFloat = 0
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let natural = metrics.width + 2 * (group?.motionDelta ?? motionDelta)
        let minimum = group?.minimumWidth ?? 0
        return .init(width:max(2*metrics.outlineWidth,minimum,group?.fullWidth == true ? proposal.width ?? natural : natural),height:min(metrics.height,group?.maximumHeight ?? .infinity))
    }
    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        for child in subviews { child.place(at: .init(x: bounds.midX, y: bounds.midY), anchor: .center, proposal: .unspecified) }
    }
}
private struct AWCNativeIconButtonStyle: ButtonStyle {
    let nodeID: String
    let metrics: AWCNativeIconButtonMetrics
    let palette: AWCNativeIconButtonPalette
    let appearance: AWCIconButtonAppearance
    let theme: AWCTheme
    let properties: [String: AWCValue]
    let hasBadge: Bool
    let focused: Bool
    let nativePressed: Bool
    let activation: Int
    let pointerPressed: () -> Void
    func makeBody(configuration: Configuration) -> some View {
        AWCNativeIconButtonSurface(style: self, configuration: configuration)
    }
}
private struct AWCNativeIconButtonSurface: View {
    let style: AWCNativeIconButtonStyle
    let configuration: ButtonStyleConfiguration
    @State private var hovered = false
    @State private var frame = CGRect.zero
    @State private var localOrigin: CGPoint?
    @State private var localDown = false
    @Environment(\.accessibilityReduceMotion) private var systemReduceMotion
    @Environment(\.awcReducedMotion) private var reducedOverride
    private var reduceMotion: Bool { reducedOverride ?? systemReduceMotion }
    @Environment(\.isEnabled) private var enabled
    @Environment(\.awcNativePointerState) private var pointer
    @Environment(\.awcTouchPress) private var touchPress
    @Environment(\.awcThemeTokens) private var themeTokens
    @Environment(\.awcNativeGroupGeometry) private var groupGeometry
    @Environment(\.awcNativeGroupContext) private var groupContext
    @Environment(\.layoutDirection) private var direction
    private var tokens: [String: String] { AWCGeneratedTokens.light.merging(style.theme.tokens) { _, new in new }.merging(themeTokens) { _, new in new } }
    private func color(_ role: String?) -> Color {
        guard let role else { return .clear }
        switch role {
        case "primary": return style.theme.primary
        case "on-primary": return style.theme.onPrimary
        case "secondary": return style.theme.secondary
        case "on-surface": return style.theme.onSurface
        default: return Color(awcHex: tokens["--md-sys-color-" + role] ?? "#000000")
        }
    }
    private func opacity(_ key: String, _ fallback: Double) -> Double { awcIconNumber(tokens["--md-sys-state-" + key + "-opacity"], fallback) }
    var body: some View {
        let p = style.properties, m = style.metrics, palette = style.palette, appearance = style.appearance
        let active = enabled && !palette.disabled
        let pointerDown = active && configuration.awcPressed(touchPress)
        let pressed = active && (pointerDown || style.nativePressed)
        let morph = p["shapeMorph"]?.bool != false
        let corners = groupGeometry?.corners(icon:true,selected:p["selected"]?.bool == true,pressed:pressed && morph) ?? m.corners(shape: p["shape"]?.string ?? "round", morph: morph, selected: p["selected"]?.bool == true,
                                pressed: pressed, left: p["connectedLeft"]?.bool == true, right: p["connectedRight"]?.bool == true)
        let isHovered = pointer.map { $0.location.map(frame.contains) ?? false } ?? hovered
        let alpha = !active ? 0 : style.focused ? opacity("focus-state-layer", 0.12) : pointerDown ? opacity("pressed-state-layer", 0.12) : isHovered ? opacity("hover-state-layer", 0.08) : 0
        let ink = (palette.disabled ? color("on-surface") : appearance.iconColor.map { Color(awcHex: $0) } ?? color(palette.icon)).opacity(palette.disabled ? opacity("disabled-content", 0.38) : 1)
        let fill = (palette.allowsCustomContainer ? appearance.containerColor.map { Color(awcHex: $0) } ?? color(palette.container) : color(palette.container)).opacity(palette.allowsCustomContainer ? 1 : opacity("disabled-container", 0.12))
        let stroke = (palette.allowsCustomOutline ? appearance.outlineColor.map { Color(awcHex: $0) } ?? color(palette.outline) : color(palette.outline)).opacity(palette.disabled ? opacity("disabled-container", 0.12) : 1)
        let pressedDuration = p["buttonWidth"]?.string == "narrow" ? awcIconNumber(tokens["--md-sys-motion-duration-medium1"], 250) : awcIconNumber(tokens["--md-sys-motion-duration-short4"], 200)
        let motion: Animation? = reduceMotion ? nil : pressed && morph ? .timingCurve(0.2, 0, 0, 1, duration: pressedDuration / 1000) : .timingCurve(0.05, 0.7, 0.1, 1, duration: awcIconNumber(tokens["--md-sys-motion-duration-medium4"], 400) / 1000)
        let paint: Animation? = reduceMotion || palette.disabled ? nil : .timingCurve(0.2, 0, 0, 1, duration: pressed && morph ? pressedDuration / 1000 : awcIconNumber(tokens["--md-sys-motion-duration-short2"], 100) / 1000)
        let origin = pointer.flatMap { state in state.isPointerDown ? state.pressLocation.map { CGPoint(x: $0.x - frame.minX, y: $0.y - frame.minY) } : nil } ?? (localDown ? localOrigin : nil)
        let content = AnyView(AWCNativeIconButtonLayout(metrics: m,group:groupGeometry,motionDelta:groupContext?.motionDelta(style.nodeID) ?? 0) { configuration.label.foregroundStyle(ink).animation(paint, value: ink) })
        let clipped = style.hasBadge ? content : AnyView(content.clipShape(corners.shape).animation(motion, value: corners))
        let surface = clipped.background {
            corners.shape.fill(fill).animation(motion, value: corners).animation(paint, value: fill)
                .overlay {
                    corners.shape.fill(appearance.stateLayerColor.map { Color(awcHex: $0) } ?? color(palette.icon)).opacity(alpha)
                        .animation(motion, value: corners).animation(reduceMotion ? nil : .easeOut(duration: 0.1), value: alpha)
                        .awcInspect(nodeID: style.nodeID, part: "state-layer", name: "md-icon-button ::part(state-layer)")
                        .padding(m.outlineWidth)
                }
                .overlay {
                    if p["ripple"]?.bool != false {
                        AWCNativeButtonRipple(pressed: pointerDown, nativePressed: active && style.nativePressed, nativeActivation: style.activation,
                            color: ink, origin: origin).clipShape(corners.shape).opacity(active ? 1 : 0)
                    }
                }
        }.overlay {
            corners.shape.strokeBorder(stroke, lineWidth: m.outlineWidth).animation(motion, value: corners).animation(paint, value: stroke)
        }.overlay {
            if style.focused { corners.shape.stroke(color("secondary"), lineWidth: 3).padding(-3.5).animation(motion, value: corners) }
        }
        return AnyView(surface).contentShape(corners.shape)
            .background { GeometryReader { geometry in Color.clear.onChange(of: geometry.frame(in: .named("awc-native-preview")), initial: true) { _, bounds in frame = bounds } } }
            .awcObservePointerOrigin(enabled:pointer == nil) { origin, down in localDown=down;localOrigin=origin }
            .onHover { hovered = $0 }
            .onChange(of: configuration.awcPressed(touchPress)) { _, down in if down { groupContext?.press(style.nodeID); if groupContext != nil { style.pointerPressed() } } }
            .onChange(of: configuration.awcPressed(touchPress) && enabled) { _, down in if down { style.pointerPressed() } }
            .awcInspect(nodeID: style.nodeID, name: "md-icon-button") { _ in
                ["padding": [0, 0, 0, 0], "margin": [0, 0, 0, 0], "border": .array(Array(repeating: .number(Double(m.outlineWidth)), count: 4)),
                 "display": "SwiftUI Button", "direction": .string(direction == .rightToLeft ? "rtl" : "ltr")]
            }
    }
}

extension AWCNativeView {
    var nativeIconButton: some View {
        let tokens = (theme.tokens.isEmpty ? (colorScheme == .dark ? AWCGeneratedTokens.dark : AWCGeneratedTokens.light) : theme.tokens).merging(inheritedThemeTokens) { _, new in new }
        let density = AWCNativeDensity.resolve(local["density"]?.number,
            inherited: nativeGroupGeometry?.density ?? nativeGroupContext?.density ?? inheritedDensity)
        let metrics = AWCNativeIconButtonMetrics(size: s("size", "sm"), buttonWidth: s("buttonWidth", "default"), density: density, variant: s("variant", "standard"), appearance: schemedIconButtonAppearance, tokens: tokens)
        let palette = AWCNativeIconButtonPalette(variant: s("variant", "standard"), toggle: b("toggle"), selected: b("selected"), disabled: disabled)
        let slots = AWCNativeIconButtonSlots(node: node, properties: nativeActionProperties)
        var accessibilityProperties = nativeActionProperties
        accessibilityProperties["roleOverride"] = "button"; accessibilityProperties["loading"] = false
        let accessibleLabel = [s("ariaLabel"), s("aria-label"), label].first { !$0.isEmpty } ?? ""
        return AWCNativeActionControl(style: { focused, pressed, activation, pointerPressed in
            AWCNativeIconButtonStyle(nodeID: node.id, metrics: metrics, palette: palette, appearance: schemedIconButtonAppearance, theme: theme,
                properties: nativeActionProperties, hasBadge: slots.hasBadge, focused: focused, nativePressed: pressed, activation: activation, pointerPressed: pointerPressed)
        }, policy: AWCButtonAccessibilityPolicy(properties: accessibilityProperties), id: node.id, accessibleLabel: accessibleLabel,
            action: { source in _ = activateNativeIconButton(activation: .init(kind: .nativeControl, source: source)) }, direction: s("dir"),
            // aria-expanded (md-navigation-rail's toggle): the native expanded state of a disclosure button.
            popup: (local["aria-expanded"]?.string ?? local["ariaExpanded"]?.string).map { AWCNativePopupRelationship(kind: nil, expanded: $0 == "true", target: nil, focusActionLabel: "") }) {
                nativeIconButtonSlot(slots, size: metrics.iconSize)
        }
        .environment(\.awcNativeDensity, density)
    }

    @ViewBuilder private func nativeIconButtonSlot(_ slots: AWCNativeIconButtonSlots, size: CGFloat) -> some View {
        let part = slots.selectedLayer ? "selected-icon" : "icon"
        HStack(spacing: 0) {
            ForEach(slots.visibleChildren.filter { $0.tag != "md-badge" }) { item in
                if item.tag == "#text" {
                    let text = item.properties["text"]?.string ?? ""
                    if !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { Text(text).font(AWCNativeFonts.label(size: size, weight: 400)).fixedSize() }
                } else if item.tag == "md-avatar" { child(item).fixedSize().awcInspect(nodeID: node.id, part: "\(part).slot.\(item.id)", parentPart: part, name: "md-avatar") }
                else {
                    Group {
                        if item.tag == "#slot-text" { Text(item.properties["text"]?.string ?? "").font(AWCNativeFonts.label(size: size, weight: 400)).fixedSize() }
                        else if item.tag == "#symbol" { AWCMaterialSymbol(item.properties["name"]?.string ?? "", size: size) }
                        else if item.tag == "md-icon" { AWCMaterialSymbol(item.properties["icon"]?.string ?? item.properties["name"]?.string ?? "", size: size) }
                        else { child(item) }
                    }.environment(\.awcMaterialSymbolSize, size).frame(width: size, height: size)
                }
            }
            if !slots.fallback.isEmpty { AWCMaterialSymbol(slots.fallback, size: size) }
        }.fixedSize().frame(width: size, height: size).opacity(size == 0 ? 0 : 1)
            .awcBadgeOverlay {
                ForEach(slots.visibleChildren.filter { $0.tag == "md-badge" }) { badge in
                    child(badge)
                        .environment(\.layoutDirection, s("dir") == "rtl" ? .rightToLeft : s("dir") == "ltr" ? .leftToRight : layoutDirection)
                        .environment(\.awcBadgeInspectionTarget, .init(nodeID: node.id,
                            part: "\(part).badge.\(badge.id)", parentPart: part))
                }
            }
            .awcInspect(nodeID: node.id, part: part, name: "md-icon-button ::part(\(part))")
    }
    @discardableResult func activateNativeIconButton(activation: AWCActivationMetadata = .init(kind: .nativeControl)) -> AWCButtonActionResult {
        var current = node; current.properties = nativeActionProperties
        let router = urlRouter ?? AWCURLRouter { request in openURL(request.url); return true }
        let result = AWCIconButtonAction.perform(node: current, dispatcher: eventDispatcher, router: router,
            targetListeners: eventTargetListeners, activation: activation, observe: onEvent, commitSelected: { set("selected", .bool($0)) })
        nativeGroupContext?.activate(node.id,activation)
        return result
    }
}
