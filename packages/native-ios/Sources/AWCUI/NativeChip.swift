import SwiftUI
import QuartzCore

// MARK: Source model

/// md-chip's class/attribute logic (md-chip.tsx render) as a pure model.
struct AWCChipModel: Equatable {
    var variant = "assist", icon = "", trailingIcon = "", selected = false, selectable: Bool? = nil
    var appearance = "outlined", color: String? = nil, elevated = false, disabled = false, softDisabled = false
    var removable: Bool? = nil, label = "", contentAlign = "center", density: Double? = nil, hidden = false
    init(properties p: [String: AWCValue], selected: Bool) {
        variant = p["variant"]?.string.isEmpty == false ? p["variant"]!.string : "assist"
        icon = p["icon"]?.string ?? ""; trailingIcon = p["trailingIcon"]?.string ?? ""
        self.selected = selected; selectable = p["selectable"]?.bool
        appearance = p["appearance"]?.string.isEmpty == false ? p["appearance"]!.string : "outlined"
        if case .string(let c)? = p["color"] { color = c }
        elevated = p["elevated"]?.bool ?? false; disabled = p["disabled"]?.bool ?? false; softDisabled = p["softDisabled"]?.bool ?? false
        removable = p["removable"]?.bool; label = p["label"]?.string ?? ""
        contentAlign = ["start", "center", "end"].contains(p["contentAlign"]?.string ?? "") ? p["contentAlign"]!.string : "center"
        density = p["density"]?.number; hidden = p["hidden"]?.bool ?? false
    }
    var effectivelyDisabled: Bool { disabled || softDisabled }
    var effectiveAppearance: String { elevated ? "elevated" : appearance }
    var isSelectable: Bool { selectable ?? (variant == "filter" || variant == "input") }
    var isRemovable: Bool { removable ?? (variant == "input") }
    /// `colorVars`: only a plain CSS ident switches the colour-role rules on.
    var colored: Bool { guard let color, !color.isEmpty else { return false }; return color.range(of: "^[a-zA-Z][a-zA-Z0-9-]*$", options: .regularExpression) != nil }
    var selectedClass: Bool { selected && isSelectable }
    var elevatedClass: Bool { effectiveAppearance == "elevated" }
    var isInteractiveHost: Bool { !(selectable == false && isRemovable) }
    var hostIsButton: Bool { isInteractiveHost && !isRemovable }
    var renderPrimary: Bool { isInteractiveHost && isRemovable }
    func showCheckmark(hasLeading: Bool) -> Bool { variant == "filter" && selected && !hasLeading }
}

/// Pseudo-class inputs of the cascade.
struct AWCChipStates: Equatable, Hashable { var hover = false, focusVisible = false, active = false }

/// The source cascade (md-chip.css), applied rule by rule in specificity and source order.
struct AWCChipStyle {
    let model: AWCChipModel, appearance: AWCChipHookAppearance, parts: AWCChipPartAppearance, tokens: [String: String]
    func token(_ name: String, _ fallback: String) -> String { tokens["--md-sys-color-" + name] ?? fallback }
    func elevation(_ level: Int) -> [AWCBoxShadow] { AWCBoxShadow.source(tokens["--md-sys-elevation-\(level)"] ?? "none") ?? [] }
    static func mix(_ hex: String, _ alpha: Double) -> String {
        let c = Color(awcHex: hex).resolve(in: EnvironmentValues())
        return String(format: "#%02X%02X%02X%02X", Int((Double(c.red) * 255).rounded()), Int((Double(c.green) * 255).rounded()), Int((Double(c.blue) * 255).rounded()), Int((Double(c.opacity) * alpha * 255).rounded()))
    }
    var onSurface: String { token("on-surface", "#1C1B1F") }
    var primary: String { token("primary", "#6750A4") }
    var onSurfaceVariant: String { token("on-surface-variant", "#49454F") }
    var secondaryContainer: String { token("secondary-container", "#E8DEF8") }
    var onSecondaryContainer: String { token("on-secondary-container", "#1D192B") }
    /// `--_c-main` / `--_c-container` / `--_c-on-container` (role tokens with neutral fallbacks).
    var role: (main: String, container: String, onContainer: String) {
        guard model.colored, let c = model.color else { return (primary, secondaryContainer, onSecondaryContainer) }
        return (tokens["--md-sys-color-\(c)"] ?? primary, tokens["--md-sys-color-\(c)-container"] ?? secondaryContainer, tokens["--md-sys-color-on-\(c)-container"] ?? onSecondaryContainer)
    }
    struct Resolved: Equatable {
        var container: String, label: String, icon: String, outline: String, outlineVisible: Bool, stateLayer: String, elevation: [AWCBoxShadow]
    }
    var resolved: Resolved {
        let h = appearance, m = model, r = role
        // :host (0,1,0)
        var container = h.containerColor ?? "#00000000", containerSelected = h.containerColorSelected ?? secondaryContainer
        var label = h.labelColor ?? onSurfaceVariant
        var labelSelected = h.labelColorSelected ?? onSecondaryContainer
        var icon = h.iconColor ?? primary, outline = h.outlineColor ?? token("outline", "#79747E")
        var layer = h.stateLayerColor ?? onSurface, shadow = h.elevation ?? []
        var hostColor: String? = nil
        // (0,2,0) in source order.
        switch m.variant {
        case "assist": icon = h.iconColor ?? primary; label = h.labelColor ?? onSurface
        case "filter", "suggestion": icon = h.iconColor ?? onSurfaceVariant; label = h.labelColor ?? onSurfaceVariant
        case "input": outline = h.outlineColor ?? token("outline-variant", "#CAC4D0"); icon = h.iconColor ?? onSurfaceVariant; label = h.labelColor ?? onSurfaceVariant
        default: break
        }
        if m.selectedClass { container = containerSelected; hostColor = labelSelected; icon = h.iconColor ?? onSecondaryContainer; layer = h.stateLayerColor ?? onSecondaryContainer }
        if m.elevatedClass { shadow = h.elevation ?? elevation(1) }
        if m.effectiveAppearance == "filled" || m.effectiveAppearance == "elevated" {
            container = h.containerColor ?? token("surface-container-high", "#ECE6F0"); label = h.labelColor ?? onSurfaceVariant; icon = h.iconColor ?? onSurfaceVariant
        }
        // (0,3,0) in source order.
        if m.elevatedClass && m.selectedClass { shadow = h.elevation ?? elevation(1) }
        if m.effectiveAppearance == "outlined" && m.colored { outline = h.outlineColor ?? r.main; label = h.labelColor ?? r.main; icon = h.iconColor ?? r.main; layer = h.stateLayerColor ?? r.main }
        if m.selectedClass && (m.effectiveAppearance == "filled" || m.effectiveAppearance == "elevated") { container = containerSelected; icon = h.iconColor ?? onSecondaryContainer }
        if (m.effectiveAppearance == "filled" || m.effectiveAppearance == "elevated") && m.colored {
            container = h.containerColor ?? r.container; label = h.labelColor ?? r.onContainer; icon = h.iconColor ?? r.onContainer; layer = h.stateLayerColor ?? r.onContainer
        }
        if m.selectedClass && m.colored {
            container = h.containerColorSelected ?? r.container; labelSelected = h.labelColorSelected ?? r.onContainer; hostColor = labelSelected
            icon = h.iconColor ?? r.onContainer; layer = h.stateLayerColor ?? r.onContainer
        }
        let disabledClass = m.effectivelyDisabled
        if disabledClass && m.selectedClass { container = Self.mix(onSurface, 0.12) }
        // (0,4,0): disabled filled and elevated chips share the dimmed tonal container (source fix g).
        if disabledClass && (m.elevatedClass || m.effectiveAppearance == "filled") && !m.selectedClass { container = Self.mix(onSurface, 0.12) }
        // !important (disabled content colours and elevation).
        if disabledClass { hostColor = Self.mix(onSurface, 0.38); icon = Self.mix(onSurface, 0.38); shadow = [] }
        // The outline element: transparent when selected / elevated / filled; the disabled outline (0,6,0) on outlined chips.
        var outlineVisible = !(m.selectedClass || m.elevatedClass || m.effectiveAppearance == "filled")
        if disabledClass && !m.selectedClass && !m.elevatedClass && m.effectiveAppearance != "filled" { outline = Self.mix(onSurface, 0.12); outlineVisible = true }
        return .init(container: container, label: hostColor ?? label, icon: icon, outline: outline, outlineVisible: outlineVisible, stateLayer: layer, elevation: shadow)
    }
    func layerOpacity(_ s: AWCChipStates) -> Double {
        if let fixed = parts.stateLayerOpacity { return fixed }
        var o = 0.0
        if s.hover { o = 0.08 }; if s.focusVisible { o = 0.12 }; if s.active { o = 0.12 }
        if model.effectivelyDisabled && (s.hover || s.active || s.focusVisible) { o = 0 }
        return o
    }
    /// `:host([soft-disabled]) .md-chip__state-layer { display: none }`.
    var layerVisible: Bool { !model.softDisabled }
    var focusRingColor: String { token("secondary", "#625B71") }
}

// MARK: Glyphs

/// The filter checkmark (18×18 viewBox path, scaled to the icon size).
struct AWCChipCheckmarkShape: Shape {
    func path(in rect: CGRect) -> Path {
        let s = rect.width / 18; var p = Path()
        let pts: [(Double, Double)] = [(6.75, 12.127), (3.623, 9), (2.563, 10.057), (6.75, 14.25), (15.75, 5.25), (14.693, 4.193), (6.75, 12.127)]
        p.move(to: .init(x: rect.minX + pts[0].0 * s, y: rect.minY + pts[0].1 * s))
        for q in pts.dropFirst() { p.addLine(to: .init(x: rect.minX + q.0 * s, y: rect.minY + q.1 * s)) }
        p.closeSubpath(); return p
    }
}
/// The remove ✕ (18×18 viewBox path, scaled to the icon size).
struct AWCChipRemoveShape: Shape {
    func path(in rect: CGRect) -> Path {
        let s = rect.width / 18; var p = Path()
        let pts: [(Double, Double)] = [(14.25, 4.808), (13.192, 3.75), (9, 7.942), (4.808, 3.75), (3.75, 4.808), (7.942, 9), (3.75, 13.192), (4.808, 14.25),
                                       (9, 10.058), (13.192, 14.25), (14.25, 13.192), (10.058, 9), (14.25, 4.808)]
        p.move(to: .init(x: rect.minX + pts[0].0 * s, y: rect.minY + pts[0].1 * s))
        for q in pts.dropFirst() { p.addLine(to: .init(x: rect.minX + q.0 * s, y: rect.minY + q.1 * s)) }
        p.closeSubpath(); return p
    }
}

// MARK: Layout

/// `display: inline-flex` row: shrink-to-fit (never wider than the proposal; the label is the
/// only shrinkable item), or the full proposed width when stretched, with the content row
/// positioned by `justify-content` (center / flex-start / flex-end, logical).
struct AWCChipRowLayout: Layout {
    let leading: Double, trailing: Double, gap: Double, height: Double, stretch: Bool, align: String, labelIndex: Int?
    private func widths(_ subviews: Subviews) -> [Double] { subviews.map { Double($0.sizeThatFits(.unspecified).width) } }
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let ideal = widths(subviews).reduce(0, +) + gap * Double(max(0, subviews.count - 1)) + leading + trailing
        guard let pw = proposal.width, pw.isFinite else { return .init(width: ideal, height: height) }
        let fixed = widths(subviews).enumerated().filter { $0.offset != labelIndex }.map(\.element).reduce(0, +) + gap * Double(max(0, subviews.count - 1)) + leading + trailing
        return .init(width: stretch ? max(Double(pw), fixed) : max(fixed, min(ideal, Double(pw))), height: height)
    }
    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var w = widths(subviews)
        let fixed = w.enumerated().filter { $0.offset != labelIndex }.map(\.element).reduce(0, +) + gap * Double(max(0, subviews.count - 1)) + leading + trailing
        if let i = labelIndex { w[i] = min(w[i], max(0, Double(bounds.width) - fixed)) }
        let used = w.reduce(0, +) + gap * Double(max(0, subviews.count - 1)), free = max(0, Double(bounds.width) - leading - trailing - used)
        var x = Double(bounds.minX) + leading + (align == "start" ? 0 : align == "end" ? free : free / 2)
        for (i, s) in subviews.enumerated() {
            s.place(at: .init(x: x, y: Double(bounds.midY)), anchor: .leading, proposal: .init(width: w[i], height: nil))
            x += w[i] + gap
        }
    }
}

// MARK: Renderer

struct AWCNativeChip<Leading: View, Label: View, Trailing: View>: View {
    let node: AWCNode, theme: AWCTheme, model: AWCChipModel
    let hasLeadingSlot: Bool, hasTrailingSlot: Bool, hasLabelSlot: Bool, accessibleLabel: String
    /// Dispatches an event (cancelable like Stencil events) and reports `defaultPrevented`.
    let dispatch: (String, AWCValue) -> Bool
    let setSelected: (Bool) -> Void
    let remove: () -> Void
    @ViewBuilder let leadingSlot: () -> Leading
    @ViewBuilder let labelSlot: () -> Label
    @ViewBuilder let trailingSlot: () -> Trailing
    @Environment(\.awcChipAppearance) private var inheritedAppearance
    @Environment(\.awcChipAppearanceTargets) private var appearanceTargets
    @Environment(\.awcChipPartAppearance) private var inheritedParts
    @Environment(\.awcChipPartAppearanceTargets) private var partTargets
    @Environment(\.awcChipStretch) private var stretch
    @Environment(\.awcNativeDensity) private var inheritedDensity
    /// md3.css replaces the spacing tokens on `[density]` / `[data-density]` rungs -2…-4.
    @Environment(\.awcNativeSpacingRung) private var spacingRung
    @Environment(\.awcNativePointerState) private var pointer
    @Environment(\.accessibilityReduceMotion) private var systemReduced
    @Environment(\.awcChipReducedMotion) private var reducedOverride
    @Environment(\.layoutDirection) private var direction
    @State private var hostFocus = AWCButtonFocusHandle()
    @State private var removeFocus = AWCButtonFocusHandle()
    @State private var hovered = false
    @State private var frame: CGRect = .zero
    @State private var globalFrame: CGRect = .zero
    @State private var removeFrame: CGRect = .zero
    @State private var pressed = false
    @State private var pressOnRemove = false
    @State private var pressOrigin: CGPoint?
    @State private var activation = 0
    @State private var activationBox: CGSize?
    @State private var layer = AWCCSSTransitionTrack()
    @State private var shadowTrack = AWCCardShadowTrack()
    @State private var background = AWCCSSColorTrack()
    @State private var ink = AWCCSSColorTrack()
    @State private var primed = false

    private var appearance: AWCChipHookAppearance { inheritedAppearance.merging(appearanceTargets[node.id] ?? .init()) }
    private var parts: AWCChipPartAppearance { inheritedParts.merging(partTargets[node.id] ?? .init()) }
    private var style: AWCChipStyle { .init(model: model, appearance: appearance, parts: parts, tokens: theme.tokens) }
    private var density: Double { AWCNativeDensity.resolve(model.density, inherited: inheritedDensity) }
    private var reduced: Bool { reducedOverride ?? systemReduced }
    private var hasLeading: Bool { !model.icon.isEmpty || hasLeadingSlot }
    private var showCheckmark: Bool { model.showCheckmark(hasLeading: hasLeading) }
    private var hasTrailing: Bool { !model.trailingIcon.isEmpty || hasTrailingSlot }
    /// `pointer-events: none` on a hard-disabled (not soft-disabled) chip.
    private var pointerInert: Bool { model.effectivelyDisabled && !model.softDisabled }
    private var hover: Bool {
        guard !pointerInert else { return false }
        return pointer.map { $0.location.map(frame.contains) ?? false } ?? hovered
    }
    /// Only a button-role host matches `:host(:focus-visible)`; focus on the inner primary / remove
    /// buttons of a group-role chip shows their rings but leaves the state layer at rest (Web oracle).
    private var focusVisible: Bool { model.hostIsButton && hostFocus.isFocusVisible }
    private var states: AWCChipStates {
        let hostPress = pointer.map { $0.isPointerDown && hover } ?? false
        return .init(hover: hover, focusVisible: focusVisible, active: (pressed || hostPress) && !pointerInert)
    }
    private struct Targets: Equatable { var layer: Double, shadow: [AWCBoxShadow], background: String, ink: String }
    private var targets: Targets { let r = style.resolved; return .init(layer: style.layerOpacity(states), shadow: r.elevation, background: r.container, ink: r.label) }
    private func apply(_ next: Targets) {
        guard primed else {
            layer.snap(next.layer); shadowTrack.set(next.shadow, now: 0, duration: 0, curve: [0, 0, 1, 1])
            background.set(Color(awcHex: next.background), now: 0, duration: 0, curve: [0, 0, 1, 1]); ink.set(Color(awcHex: next.ink), now: 0, duration: 0, curve: [0, 0, 1, 1])
            primed = true; return
        }
        let now = CACurrentMediaTime() * 1000, curve = awcCSSCubicBezier(theme.tokens["--md-sys-motion-easing-standard"]) ?? [0.2, 0, 0, 1]
        let short1 = reduced ? 0 : awcCSSDuration(theme.tokens["--md-sys-motion-duration-short1"]) ?? 50
        let short2 = reduced ? 0 : awcCSSDuration(theme.tokens["--md-sys-motion-duration-short2"]) ?? 100
        layer.set(next.layer, now: now, duration: short1, curve: curve)
        shadowTrack.set(next.shadow, now: now, duration: short2, curve: curve)
        background.set(Color(awcHex: next.background), now: now, duration: short2, curve: curve)
        ink.set(Color(awcHex: next.ink), now: now, duration: short2, curve: curve)
    }
    private func running(_ now: Double) -> Bool { layer.isRunning(now) || shadowTrack.isRunning(now) || background.isRunning(now) || ink.isRunning(now) }

    var body: some View {
        if model.hidden { EmptyView() } else {
            let now = CACurrentMediaTime() * 1000
            TimelineView(.animation(paused: !running(now))) { _ in chip(CACurrentMediaTime() * 1000) }
                .onChange(of: targets, initial: true) { _, next in apply(next) }
                .task(id: targets) { await Task.yield(); if !Task.isCancelled { apply(targets) } }
        }
    }

    private func chip(_ t: Double) -> some View {
        let style = style, r = style.resolved, d = density
        let fontSize = max(11, 14 + 0.5 * d), lineHeight = max(16, 20 + d)
        let iconSize: Double = appearance.iconSize.map { awcChipResolve($0, fontSize: fontSize) } ?? max(14, 18 + d)
        let baseHeight: Double = appearance.containerHeight.map { awcChipResolve($0, fontSize: fontSize) } ?? 32
        let height = max(24, baseHeight + 4 * d)
        let corners = appearance.containerShape ?? .points(Double(theme.tokens["--md-sys-shape-corner-small"].flatMap { Double($0.replacingOccurrences(of: "px", with: "")) } ?? 8))
        let shape = AWCNativeCornerShape(corners: corners)
        let opacity = reduced ? targets.layer : layer.presented(t)
        let shadow = shadowTrack.presented(t), fill = background.presented(t) ?? Color(awcHex: r.container), text = ink.presented(t) ?? Color(awcHex: r.label)
        let iconInk = Color(awcHex: r.icon)
        let outlineWidth = parts.outlineWidth ?? appearance.outlineWidth ?? 1
        let outlineInk = Color(awcHex: parts.outlineColor ?? (r.outlineVisible ? r.outline : "#00000000"))
        let layerInk = Color(awcHex: parts.stateLayerColor ?? r.stateLayer)
        // --md-sys-spacing-inset-lg / inset-sm / gap-sm per density rung (tokens.css).
        // Each token comes from the nearest rung that defines it: the chip's own rung, then the inherited one (gate-7 R4-02).
        let localRung: Double? = model.density.flatMap { [-1.0, -2, -3, -4].contains($0) ? $0 : nil }
        let insetLg = AWCSheetSpacing.token("inset-lg", local: localRung, inherited: spacingRung)
        let insetSm = AWCSheetSpacing.token("inset-sm", local: localRung, inherited: spacingRung)
        let gap = AWCSheetSpacing.token("gap-sm", local: localRung, inherited: spacingRung)
        let leadingPad = (hasLeading || showCheckmark) ? insetSm : insetLg, trailingPad = (hasTrailing || model.isRemovable) ? insetSm : insetLg
        let rows = rowItems(iconSize: iconSize, iconInk: iconInk, fontSize: fontSize, lineHeight: lineHeight, text: text)
        let padLeft: Double = direction == .rightToLeft ? trailingPad : leadingPad, padRight: Double = direction == .rightToLeft ? leadingPad : trailingPad
        let focusIndex: Double = model.disabled ? -1 : 0
        let tabindex: AWCValue = .number(model.hostIsButton ? focusIndex : -2), primaryTabindex: AWCValue = .number(model.renderPrimary ? focusIndex : -2)
        let removeTabindex: AWCValue = .number(model.isRemovable ? focusIndex : -2)
        let hostRing = model.hostIsButton && hostFocus.isFocusVisible
        let primaryRing = model.renderPrimary && hostFocus.isFocusVisible
        return chipAccessibility(AWCChipRowLayout(leading: direction == .rightToLeft ? trailingPad : leadingPad, trailing: direction == .rightToLeft ? leadingPad : trailingPad,
                                gap: gap, height: height, stretch: stretch, align: model.contentAlign == "start" ? (direction == .rightToLeft ? "end" : "start") : model.contentAlign == "end" ? (direction == .rightToLeft ? "start" : "end") : "center",
                                labelIndex: rows.labelIndex) {
            rows.views
        }
        .environment(\.layoutDirection, .leftToRight)
        .background {
            ZStack {
                shape.fill(fill)
                if !model.effectivelyDisabled {
                    AWCNativeButtonRipple(pressed: pressed, nativePressed: false, nativeActivation: activation, color: text, origin: pressOrigin, honorsReducedMotion: false, inspectNodeID: node.id, freezesBoxAtStart: true, startBox: activationBox)
                }
                shape.strokeBorder(outlineInk, lineWidth: outlineWidth)
                    .awcInspect(nodeID: node.id, part: "outline", name: "outline") { _ in ["width": .number(outlineWidth), "color": awcChipRGBA(outlineInk)] }
                if style.layerVisible {
                    layerInk.opacity(opacity)
                        .awcInspect(nodeID: node.id, part: "state-layer", name: "state-layer") { _ in ["opacity": .number(opacity), "renderTime": .number(t), "color": awcChipRGBA(layerInk)] }
                }
                // ::part(primary) background: the primary overlay paints above the state layer, below the label (gate-7 R4-09).
                if model.renderPrimary, let tint = parts.primaryBackground { Color(awcHex: tint) }
            }
        }
        .compositingGroup().clipShape(shape)
        .background { AWCNativeBoxShadow(corners: corners, layers: shadow, placement: .outer) }
        .overlay { if hostRing { shape.inset(by: -3.5).stroke(Color(awcHex: style.focusRingColor), lineWidth: 3).allowsHitTesting(false) } }
        .overlay {
            // ::part(primary) outline: the source's focus-visible ring (3px solid secondary, offset -3) unless the part restyles it.
            if model.renderPrimary, (parts.primaryOutlineStyle ?? (primaryRing ? "solid" : "none")) == "solid" {
                let w = parts.primaryOutlineWidth ?? 3, offset = parts.primaryOutlineOffset ?? -3
                shape.inset(by: -(offset + w / 2)).stroke(Color(awcHex: parts.primaryOutlineColor ?? style.focusRingColor), lineWidth: w).allowsHitTesting(false)
            }
        }
        .contentShape(shape)
        .onGeometryChange(for: CGRect.self) { $0.frame(in: .named("awc-native-preview")) } action: { frame = $0 }
        .onGeometryChange(for: CGRect.self) { $0.frame(in: .global) } action: { globalFrame = $0 }
        .onContinuousHover(coordinateSpace: .global) { phase in var next = false; if case .active = phase { next = true }; if hovered != next { hovered = next } }
        .simultaneousGesture(pointerGesture)
        .allowsHitTesting(!pointerInert))
        .awcInspect(nodeID: node.id, name: "md-chip") { size in
            ["renderTime": .number(t), "layerOpacity": .number(style.layerVisible ? opacity : -1),
             "shadow": .array(shadow.flatMap { s -> [AWCValue] in let c = Color(awcHex: s.color).resolve(in: EnvironmentValues())
                 return [.number(s.x), .number(s.y), .number(s.blur), .number(s.spread), .number(Double(c.red)), .number(Double(c.green)), .number(Double(c.blue)), .number(Double(c.opacity))] }),
             "background": awcChipRGBA(fill), "color": awcChipRGBA(text), "icon": awcChipRGBA(iconInk), "outlineColor": awcChipRGBA(outlineInk), "outlineWidth": .number(outlineWidth),
             "hostRing": .bool(hostRing), "primaryRing": .bool(primaryRing), "removeRing": .bool(model.isRemovable && removeFocus.isFocusVisible),
             "role": .string(model.hostIsButton ? "button" : "group"), "primary": .bool(model.renderPrimary), "tabindex": tabindex, "primaryTabindex": primaryTabindex, "removeTabindex": removeTabindex,
             "paddingLeft": .number(padLeft), "paddingRight": .number(padRight), "contentGap": .number(gap),
             "pressedState": .string(model.isSelectable && model.isInteractiveHost ? (model.selected ? "true" : "false") : ""), "selected": .bool(model.selected),
             "focused": .bool(hostFocus.isFocused), "removeFocused": .bool(removeFocus.isFocused), "hover": .bool(states.hover), "active": .bool(states.active),
             "fontSize": .number(fontSize), "lineHeight": .number(lineHeight), "iconSize": .number(iconSize), "height": .number(height), "checkmark": .bool(showCheckmark),
             "label": .string(accessibleLabel), "width": .number(Double(size.width))]
        }
    }

    /// Accessibility surface of the drawn chip: an interactive non-button host keeps its children with its own focus bridge;
    /// a host-button chip hides its drawn content and its focus bridge (added after the hiding) is the accessible button.
    private func chipAccessibility<Content: View>(_ content: Content) -> some View {
        content
            .awcFocusBridgeLayer { interactiveHostFocusBridge }
            .accessibilityElement(children: model.hostIsButton ? .ignore : .contain)
            .accessibilityLabel(model.hostIsButton ? "" : accessibleLabel)
            .accessibilityHidden(model.hostIsButton)
            .awcFocusBridgeLayer { hostButtonFocusBridge }
    }
    private var hostFocusConfiguration: AWCNativeFocusConfiguration {
        .init(id: node.id, label: accessibleLabel, policy: AWCButtonAccessibilityPolicy(properties: hostPolicy), group: nil, cell: nil,
              handle: hostFocus, focusChanged: { _ in }, activate: { keyboardActivate() }, routeKey: { key, _, _ in routeKey(key) })
    }
    /// Focus/accessibility surface of an interactive chip whose host is not a button (it keeps its contained children).
    @ViewBuilder private var interactiveHostFocusBridge: some View {
        if model.isInteractiveHost && !model.hostIsButton { AWCNativeButtonFocusBridge(configuration: hostFocusConfiguration).accessibilitySortPriority(1) }
    }
    /// A host-button chip's accessible button (its drawn content is hidden from accessibility).
    @ViewBuilder private var hostButtonFocusBridge: some View {
        if model.hostIsButton { AWCNativeButtonFocusBridge(configuration: hostFocusConfiguration).accessibilityHidden(false) }
    }
    private var hostPolicy: [String: AWCValue] {
        ["disabled": .bool(model.disabled), "softDisabled": .bool(model.softDisabled), "toggle": .bool(model.isSelectable), "selected": .bool(model.selectedClass)]
    }

    private func rowItems(iconSize: Double, iconInk: Color, fontSize: Double, lineHeight: Double, text: Color) -> (views: AnyView, labelIndex: Int?) {
        var items: [AnyView] = []
        let partIcon = parts.iconColor.map { Color(awcHex: $0) } ?? iconInk
        if showCheckmark {
            let checkInk = parts.checkmarkColor.map { Color(awcHex: $0) } ?? iconInk
            items.append(AnyView(AWCChipCheckmarkShape().fill(checkInk).frame(width: iconSize, height: iconSize)
                .awcInspect(nodeID: node.id, part: "checkmark", name: "checkmark") { _ in ["color": awcChipRGBA(checkInk)] }))
        }
        if hasLeadingSlot {
            items.append(AnyView(leadingSlot().frame(width: iconSize, height: iconSize).foregroundStyle(iconInk).environment(\.awcMaterialSymbolSize, iconSize)))
        } else if !model.icon.isEmpty && !showCheckmark {
            items.append(AnyView(AWCMaterialSymbol(model.icon, size: iconSize).foregroundStyle(partIcon)
                .awcInspect(nodeID: node.id, part: "icon", name: "icon") { _ in ["color": awcChipRGBA(partIcon), "text": .string(model.icon)] }))
        }
        let labelIndex = items.count
        let labelInk = parts.labelColor.map { Color(awcHex: $0) } ?? text
        let label = Group { if hasLabelSlot { labelSlot() } else { Text(model.label) } }
            .font(AWCNativeFonts.label(size: fontSize, weight: 500)).tracking(0.1).lineLimit(1).truncationMode(.tail)
            .foregroundStyle(labelInk).frame(height: lineHeight)
            // A truncated label fills the width it is given (flex item, min-width 0), text at the inline start.
            .frame(maxWidth: .infinity, alignment: .leading)
            .environment(\.layoutDirection, direction)
            .awcInspect(nodeID: node.id, part: "label", name: "label") { _ in ["color": awcChipRGBA(labelInk)] }
        items.append(AnyView(label))
        if model.isRemovable {
            let removeInk = parts.removeColor.map { Color(awcHex: $0) } ?? iconInk
            let box = max(18, iconSize)
            let glyph = Group { if hasTrailingSlot { trailingSlot().frame(width: iconSize, height: iconSize) } else { AWCChipRemoveShape().fill(removeInk).frame(width: iconSize, height: iconSize) } }
            items.append(AnyView(glyph.foregroundStyle(removeInk).frame(width: box, height: box)
                .overlay { if removeFocus.isFocusVisible { Circle().inset(by: -2).stroke(Color(awcHex: style.focusRingColor), lineWidth: 2) } }
                .onGeometryChange(for: CGRect.self) { $0.frame(in: .global) } action: { removeFrame = $0 }
                .awcFocusBridgeLayer {
                    AWCNativeButtonFocusBridge(configuration: .init(id: node.id + ".remove", label: accessibleLabel.isEmpty ? "Remove" : "Remove \(accessibleLabel)",
                        policy: AWCButtonAccessibilityPolicy(properties: ["disabled": .bool(model.effectivelyDisabled)]), group: nil, cell: nil, handle: removeFocus,
                        focusChanged: { _ in }, activate: { dispatchRemove() }, routeKey: { key, _, _ in routeKey(key) }))
                }
                .awcInspect(nodeID: node.id, part: "remove", name: "remove") { _ in ["color": awcChipRGBA(removeInk)] }))
        } else if hasTrailingSlot {
            items.append(AnyView(trailingSlot().frame(width: iconSize, height: iconSize).foregroundStyle(iconInk).environment(\.awcMaterialSymbolSize, iconSize)))
        } else if !model.trailingIcon.isEmpty {
            let trailInk = parts.trailingIconColor.map { Color(awcHex: $0) } ?? iconInk
            items.append(AnyView(AWCMaterialSymbol(model.trailingIcon, size: iconSize).foregroundStyle(trailInk)
                .awcInspect(nodeID: node.id, part: "trailing-icon", name: "trailing-icon") { _ in ["color": awcChipRGBA(trailInk), "text": .string(model.trailingIcon)] }))
        }
        // Visual order follows the writing direction; layout runs left-to-right.
        let ordered = direction == .rightToLeft ? Array(items.reversed()) : items
        return (AnyView(ForEach(Array(ordered.enumerated()), id: \.offset) { $0.element }), direction == .rightToLeft ? items.count - 1 - labelIndex : labelIndex)
    }

    // MARK: Pointer, keyboard and removal

    private var pointerGesture: some Gesture {
        DragGesture(minimumDistance: 0, coordinateSpace: .global)
            .onChanged { value in
                guard !pressed else { return }
                pressed = true; pressOnRemove = model.isRemovable && removeFrame.contains(value.startLocation)
                pressOrigin = CGPoint(x: value.startLocation.x - globalFrame.minX, y: value.startLocation.y - globalFrame.minY)
                if model.isInteractiveHost && !pressOnRemove { _ = hostFocus.requestPointerFocus?() }
                if pressOnRemove { _ = removeFocus.requestPointerFocus?() }
            }
            .onEnded { value in
                defer { pressed = false; pressOnRemove = false }
                // A click needs press and release on the same element.
                if pressOnRemove { if removeFrame.contains(value.location) && !model.effectivelyDisabled { dispatchRemove() }; return }
                guard globalFrame.contains(value.location), !(model.isRemovable && removeFrame.contains(value.location)) else { return }
                click()
            }
    }
    /// `handleClick`: disabled chips cancel the click; selectable chips toggle, then `mdClick`.
    private func click() {
        guard !model.effectivelyDisabled else { return }
        if model.isSelectable { let next = !model.selected; setSelected(next); _ = dispatch("mdSelect", ["selected": .bool(next)]) }
        _ = dispatch("mdClick", .null)
    }
    /// Enter / Space on the chip (or its primary action): centred ripple, then the click.
    private func keyboardActivate() {
        guard !model.effectivelyDisabled else { return }
        activationBox = frame.size == .zero ? nil : frame.size   // the pre-toggle box: Chrome sizes the wave before the click re-lays out
        activation &+= 1
        click()
    }
    /// Delete / Backspace on a removable chip (bubbles from the primary action and the ✕).
    private func routeKey(_ key: String) -> Bool {
        guard key == "\u{7F}" || key == "\u{F728}" || key == "Backspace" || key == "Delete" else { return false }
        guard !model.effectivelyDisabled, model.isRemovable else { return true }
        dispatchRemove(); return true
    }
    private func dispatchRemove() {
        guard !model.effectivelyDisabled else { return }
        if !dispatch("mdRemove", .null) { remove() }
    }
}

/// A chip length hook in points: em and ch resolve against the chip's font size, rem against 16.
func awcChipResolve(_ l: AWCChipLength, fontSize: Double) -> Double {
    let em: Double = l.em * fontSize, rem: Double = l.rem * 16, ch: Double = l.ch * fontSize * 0.5
    return l.points + em + rem + ch
}

func awcChipRGBA(_ c: Color) -> AWCValue {
    let r = c.resolve(in: EnvironmentValues())
    return .array([.number(Double(r.red)), .number(Double(r.green)), .number(Double(r.blue)), .number(Double(r.opacity))])
}

extension AWCNativeView {
    /// md-chip: the dedicated renderer (default, leading-icon and trailing-icon slots).
    @ViewBuilder var nativeChip: some View {
        if b("_removed") { EmptyView() } else {
            let leading = node.children(inSlot: "leading-icon"), trailing = node.children(inSlot: "trailing-icon"), labelNodes = node.children(inSlot: nil)
            let text = node.authoredTextContent.trimmingCharacters(in: .whitespacesAndNewlines)
            let model = AWCChipModel(properties: node.properties.merging(local) { _, l in l }, selected: b("selected"))
            AWCNativeChip(node: node, theme: theme, model: model, hasLeadingSlot: !leading.isEmpty, hasTrailingSlot: !trailing.isEmpty,
                          hasLabelSlot: !labelNodes.isEmpty, accessibleLabel: model.label.isEmpty ? text : model.label,
                          dispatch: { name, detail in
                              let context = AWCEventDispatcher.dispatch(AWCEvent(name: name, tag: node.tag, nodeID: node.id, detail: detail), through: eventDispatcher, cancelable: true, targetListeners: eventTargetListeners)
                              onEvent(context.observedEvent); return context.defaultPrevented
                          },
                          setSelected: { set("selected", .bool($0)) }, remove: { set("_removed", .bool(true)) },
                          leadingSlot: { ForEach(leading) { child($0) } }, labelSlot: { HStack(spacing: 0) { ForEach(labelNodes) { child($0) } } },
                          trailingSlot: { ForEach(trailing) { child($0) } })
        }
    }
}
