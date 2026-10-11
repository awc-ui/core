import SwiftUI

/// Resolved values from md-button.css. Kept independent of SwiftUI layout so the
/// source's size/density ladder can be checked without comparing antialiased pixels.
struct AWCNativeButtonMetrics {
    let minimumHeight: CGFloat
    let minimumWidth: CGFloat
    let horizontalPadding: CGFloat
    let gap: CGFloat
    let iconSize: CGFloat
    let loadingSize: CGFloat
    let fontSize: CGFloat
    let lineHeight: CGFloat
    let letterSpacing: CGFloat
    let fontWeight: Double
    let roundRadius: CGFloat
    let squareRadius: CGFloat
    let pressedRadius: CGFloat
    let connectedRadius: CGFloat

    init(size: String, density requestedDensity: Double, variant: String,
         tokens: [String: String] = AWCGeneratedTokens.light) {
        let sizes = ["xs", "sm", "md", "lg", "xl"]
        let index = sizes.firstIndex(of: size) ?? 1
        // The source applies local density only for the four reflected rung values.
        let density = [-1.0, -2.0, -3.0, -4.0].contains(requestedDensity) ? requestedDensity : 0
        func tapered(_ bases: [Double], _ slopes: [Double], _ floors: [Double]) -> CGFloat {
            CGFloat(max(floors[index], bases[index] + density * slopes[index]))
        }
        minimumHeight = CGFloat(max(24, [32.0, 40, 56, 96, 136][index] + density * 4))
        minimumWidth = CGFloat(max(40, [48.0, 58, 72, 88, 120][index] + density * 4))
        let insets = variant == "outlined" ? [11.0, 23, 27, 31, 47] : [12.0, 16, 24, 48, 64]
        horizontalPadding = CGFloat(max(insets[index] / 2, insets[index] + density * insets[index] / 16))
        gap = tapered([4, 8, 8, 12, 16], [0.5, 1, 1, 1.5, 2], [2, 4, 4, 6, 8])
        iconSize = tapered([20, 20, 24, 32, 40], [2.5, 2.5, 3, 4, 5], [10, 10, 12, 16, 20])
        loadingSize = max(10, iconSize * 0.7)
        fontSize = tapered([12, 14, 14, 16, 24], [0.5, 0.5, 0.5, 0.5, 1], [10, 12, 12, 13, 18])
        lineHeight = tapered([16, 20, 20, 24, 32], [0.5, 1, 1, 1, 2], [14, 16, 16, 18, 24])
        let typeRole = ["label-medium", "label-large", "title-small", "title-medium", "headline-small"][index]
        letterSpacing = CGFloat(awcButtonNumber(tokens["--md-sys-typescale-\(typeRole)-letter-spacing"], [0.5, 0.1, 0.1, 0.15, 0][index]))
        fontWeight = awcButtonNumber(tokens["--md-sys-typescale-\(typeRole)-font-weight"], index == 4 ? 400 : 500)
        roundRadius = CGFloat([16.0, 20, 28, 48, 68][index])
        let squareToken = ["small", "medium", "medium", "large", "extra-large"][index]
        squareRadius = CGFloat(awcButtonNumber(tokens["--md-sys-shape-corner-\(squareToken)"], [8, 12, 12, 16, 28][index]))
        let pressToken = ["extra-small", "small", "small", "medium", "large"][index]
        pressedRadius = CGFloat(awcButtonNumber(tokens["--md-sys-shape-corner-\(pressToken)"], [4, 8, 8, 12, 16][index]))
        connectedRadius = CGFloat([4.0, 8, 8, 16, 20][index])
    }
}

/// Semantic palette rules mirror the cascade, including the different unselected
/// toggle palettes. Loading blocks activation but does not use disabled colors.
struct AWCNativeButtonPalette {
    var containerRole: String?
    var labelRole: String
    var stateRole: String
    var outlineRole: String?
    var containerOpacity: Double = 1
    var labelOpacity: Double = 1
    var outlineOpacity: Double = 1
    var restingElevation: Int = 0
    var hoverElevation: Int = 0

    init(variant: String, toggle: Bool, selected: Bool, disabled: Bool) {
        labelRole = "primary"; stateRole = "primary"
        switch variant {
        case "filled": containerRole = "primary"; labelRole = "on-primary"; stateRole = "on-primary"; hoverElevation = 1
        case "tonal": containerRole = "secondary-container"; labelRole = "on-secondary-container"; stateRole = labelRole; hoverElevation = 1
        case "outlined": outlineRole = "outline"
        case "elevated": containerRole = "surface-container-low"; restingElevation = 1; hoverElevation = 2
        default: break
        }
        if toggle && !disabled {
            switch variant {
            case "filled" where !selected:
                containerRole = "surface-container-highest"; labelRole = "primary"; stateRole = labelRole
            case "tonal" where !selected:
                containerRole = "surface-container-highest"; labelRole = "on-surface-variant"; stateRole = labelRole
            case "outlined" where selected:
                containerRole = "secondary-container"; labelRole = "on-secondary-container"; stateRole = labelRole; outlineRole = nil
            case "elevated" where !selected:
                containerRole = "surface-container-highest"; labelRole = "on-surface-variant"; stateRole = labelRole
                restingElevation = 0; hoverElevation = 0
            case "text" where !selected:
                labelRole = "on-surface-variant"; stateRole = labelRole
            default: break
            }
        }
        if disabled {
            containerRole = ["filled", "tonal", "elevated"].contains(variant) ? "on-surface" : nil
            containerOpacity = 0.12; labelRole = "on-surface"; labelOpacity = 0.38
            outlineRole = variant == "outlined" ? "on-surface" : nil; outlineOpacity = 0.12
            restingElevation = 0; hoverElevation = 0
        }
    }
}

struct AWCNativeButtonCorners: Equatable {
    let topLeading: CGFloat
    let bottomLeading: CGFloat
    let topTrailing: CGFloat
    let bottomTrailing: CGFloat

    init(metrics: AWCNativeButtonMetrics, shape: String, shapeMorph: Bool, selected: Bool, pressed: Bool,
         connectedLeft: Bool = false, connectedRight: Bool = false) {
        let round = shape != "square"
        if connectedLeft || connectedRight {
            let start = connectedLeft || !round ? metrics.connectedRadius : metrics.roundRadius
            let end = connectedRight || !round ? metrics.connectedRadius : metrics.roundRadius
            topLeading = start; bottomLeading = start; topTrailing = end; bottomTrailing = end
        } else {
            let resting = round ? metrics.roundRadius : metrics.squareRadius
            let selectedRadius = round ? metrics.squareRadius : metrics.roundRadius
            let radius = shapeMorph ? (pressed ? metrics.pressedRadius : selected ? selectedRadius : resting) : resting
            topLeading = radius; bottomLeading = radius; topTrailing = radius; bottomTrailing = radius
        }
    }
}

private func awcButtonNumber(_ value: String?, _ fallback: Double) -> Double {
    guard let value else { return fallback }
    return Double(value.replacingOccurrences(of: "px", with: "").replacingOccurrences(of: "ms", with: "")) ?? fallback
}

/// md-ripple's farthest-corner geometry and 450ms grow / 150ms release fade.
private struct AWCNativeButtonRipple: View {
    let pressed: Bool
    let color: Color
    let origin: CGPoint?
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var started: Date?
    @State private var released: Date?
    @State private var completion: Task<Void, Never>?
    @State private var waveOrigin: CGPoint?

    var body: some View {
        GeometryReader { geometry in
            TimelineView(.animation(minimumInterval: 1 / 60, paused: started == nil || reduceMotion)) { context in
                let elapsed = started.map { context.date.timeIntervalSince($0) } ?? 0
                let growth = reduceMotion ? 1 : AWCNativeButtonTiming.cubic(min(1, max(0, elapsed / 0.45)), x1: 0.2, y1: 0, x2: 0, y2: 1)
                let fadeStart = max(0.45, released.flatMap { release in started.map { release.timeIntervalSince($0) } } ?? .infinity)
                let alpha = reduceMotion ? (pressed ? 0.12 : 0) : started == nil ? 0 : 0.12 * (1 - AWCNativeButtonTiming.cubic(min(1, max(0, (elapsed - fadeStart) / 0.15)), x1: 0.2, y1: 0, x2: 0, y2: 1))
                let point = waveOrigin ?? CGPoint(x: geometry.size.width / 2, y: geometry.size.height / 2)
                let dx = max(abs(point.x), abs(geometry.size.width - point.x))
                let dy = max(abs(point.y), abs(geometry.size.height - point.y))
                let diameter = 2 * hypot(dx, dy)
                Circle().fill(color.opacity(alpha)).frame(width: diameter, height: diameter)
                    .scaleEffect(growth).position(point)
            }
        }
        .allowsHitTesting(false).accessibilityHidden(true)
        .onChange(of: pressed) { _, down in
            completion?.cancel()
            if down { started = Date(); released = nil; waveOrigin = origin }
            else if let started {
                let release = Date(); released = release
                let remaining = max(0, 0.45 - release.timeIntervalSince(started)) + 0.15
                completion = Task { @MainActor in
                    try? await Task.sleep(for: .seconds(remaining))
                    guard !Task.isCancelled else { return }
                    self.started = nil; self.released = nil
                }
            }
        }
        .onDisappear { completion?.cancel() }
    }

}

private struct AWCNativeButtonStyle: ButtonStyle {
    let metrics: AWCNativeButtonMetrics
    let palette: AWCNativeButtonPalette
    let theme: AWCTheme
    let variant: String
    let shape: String
    let shapeMorph: Bool
    let selected: Bool
    let ripple: Bool
    let blocked: Bool
    let loading: Bool
    let fullWidth: Bool
    let focused: Bool
    let connectedLeft: Bool
    let connectedRight: Bool
    func makeBody(configuration: Configuration) -> some View {
        AWCNativeButtonStyleBody(metrics: metrics, palette: palette, theme: theme,
                                 variant: variant, shape: shape, shapeMorph: shapeMorph,
                                 selected: selected, ripple: ripple, blocked: blocked,
                                 loading: loading, fullWidth: fullWidth, focused: focused,
                                 connectedLeft: connectedLeft, connectedRight: connectedRight,
                                 configuration: configuration)
    }
}

private struct AWCNativeButtonStyleBody: View {
    let metrics: AWCNativeButtonMetrics
    let palette: AWCNativeButtonPalette
    let theme: AWCTheme
    let variant: String
    let shape: String
    let shapeMorph: Bool
    let selected: Bool
    let ripple: Bool
    let blocked: Bool
    let loading: Bool
    let fullWidth: Bool
    let focused: Bool
    let connectedLeft: Bool
    let connectedRight: Bool
    let configuration: ButtonStyleConfiguration
    @State private var hovered = false
    @State private var frame = CGRect.zero
    @State private var localOrigin: CGPoint?
    @State private var localPointerDown = false
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.isEnabled) private var enabled
    @Environment(\.awcNativePointerState) private var pointer

    private var tokens: [String: String] { colorScheme == .dark ? AWCGeneratedTokens.dark : AWCGeneratedTokens.light }
    private func color(_ role: String?) -> Color {
        switch role {
        case "primary": return theme.primary
        case "on-primary": return theme.onPrimary
        case "secondary": return theme.secondary
        case "on-surface": return theme.onSurface
        case .some(let name): return Color(awcHex: tokens["--md-sys-color-" + name] ?? "#000000")
        case nil: return .clear
        }
    }
    private func opacity(_ name: String, _ fallback: Double) -> Double {
        awcButtonNumber(tokens["--md-sys-state-" + name + "-opacity"], fallback)
    }
    private func animation(pressed: Bool) -> Animation? {
        guard !reduceMotion else { return nil }
        let seconds = awcButtonNumber(tokens[pressed ? "--md-sys-motion-duration-short4" : "--md-sys-motion-duration-medium4"], pressed ? 200 : 400) / 1000
        return pressed ? .timingCurve(0.2, 0, 0, 1, duration: seconds) : .timingCurve(0.05, 0.7, 0.1, 1, duration: seconds)
    }

    var body: some View {
        let active = enabled && !blocked
        let pressed = active && configuration.isPressed
        let isHovered = pointer.map { state in state.location.map(frame.contains) ?? false } ?? hovered
        let pointerOrigin = pointer.flatMap { state in
            state.isPointerDown ? state.pressLocation.map { CGPoint(x: $0.x - frame.minX, y: $0.y - frame.minY) } : nil
        } ?? (localPointerDown ? localOrigin : nil)
        let corners = AWCNativeButtonCorners(metrics: metrics, shape: shape, shapeMorph: shapeMorph,
                                             selected: selected, pressed: pressed, connectedLeft: connectedLeft, connectedRight: connectedRight)
        let outline = UnevenRoundedRectangle(topLeadingRadius: corners.topLeading, bottomLeadingRadius: corners.bottomLeading,
                                             bottomTrailingRadius: corners.bottomTrailing, topTrailingRadius: corners.topTrailing, style: .circular)
        let stateOpacity = !active ? 0 : pressed ? opacity("pressed-state-layer", 0.12) : focused ? opacity("focus-state-layer", 0.12) : isHovered ? opacity("hover-state-layer", 0.08) : 0
        let borderColor = active && (isHovered || focused) && palette.outlineRole == "outline" ? color("primary") : color(palette.outlineRole)
        let elevation = active && isHovered && !pressed && !focused ? palette.hoverElevation : palette.restingElevation
        let disabledPalette = palette.labelOpacity < 1
        let containerOpacity = disabledPalette ? opacity("disabled-container", 0.12) : palette.containerOpacity
        let contentOpacity = disabledPalette ? opacity("disabled-content", 0.38) : palette.labelOpacity
        // CSS gives colors/shadows 100ms, radius 400ms; the pressed class uses
        // 200ms for the host transitions. Scope animations to avoid stretching
        // a color change across the radius's slower release transition.
        let colorAnimation: Animation? = reduceMotion || disabledPalette ? nil : pressed && shapeMorph
            ? .timingCurve(0.2, 0, 0, 1, duration: 0.2)
            : .timingCurve(0.2, 0, 0, 1, duration: 0.1)
        let shapeAnimation = disabledPalette ? nil : animation(pressed: pressed)
        let label = AnyView(configuration.label
            .font(AWCNativeFonts.label(size: metrics.fontSize, regular: metrics.fontWeight < 500))
            .tracking(metrics.letterSpacing)
            .lineLimit(1)
            .animation(colorAnimation) { content in content.foregroundStyle(color(palette.labelRole).opacity(contentOpacity)) })
        let surface = AnyView(label.padding(.horizontal, metrics.horizontalPadding + (variant == "outlined" ? 1 : 0))
            .frame(minWidth: metrics.minimumWidth, minHeight: metrics.minimumHeight)
            .frame(maxWidth: fullWidth ? .infinity : nil)
            .background {
                Rectangle().fill(color(palette.containerRole).opacity(containerOpacity))
                    .animation(colorAnimation, value: selected)
                    .overlay {
                        Rectangle().fill(color(palette.stateRole).opacity(stateOpacity))
                            .animation(reduceMotion ? nil : .timingCurve(pressed ? 0.05 : 0.2, pressed ? 0.7 : 0, pressed ? 0.1 : 0, 1, duration: pressed ? 0.05 : 0.1), value: stateOpacity)
                    }
                    .overlay {
                        if ripple { AWCNativeButtonRipple(pressed: pressed, color: color(palette.labelRole), origin: pointerOrigin) }
                    }
            })
        let bordered = AnyView(surface.overlay {
                outline.strokeBorder(lineWidth: variant == "outlined" ? 1 : 0)
                    .animation(shapeAnimation, value: corners)
                    .animation(colorAnimation) { content in
                        content.foregroundStyle(borderColor.opacity(disabledPalette ? opacity("disabled-container", 0.12) : palette.outlineOpacity))
                    }
            }
            .contentShape(outline)
            .animation(shapeAnimation) { content in content.clipShape(outline) }
            .background {
                ZStack {
                    outline.inset(by: elevation == 2 ? -2 : -1).fill(color("shadow"))
                        .animation(shapeAnimation, value: corners)
                        .animation(colorAnimation) { content in
                            content.blur(radius: elevation == 2 ? 3 : 1.5).offset(y: elevation == 2 ? 2 : 1).opacity(elevation > 0 ? 0.15 : 0)
                        }
                    outline.fill(color("shadow"))
                        .animation(shapeAnimation, value: corners)
                        .animation(colorAnimation) { content in content.blur(radius: 1).offset(y: 1).opacity(elevation > 0 ? 0.3 : 0) }
                }
            })
        return bordered.overlay {
                if focused && active {
                    outline.stroke(color("secondary"), lineWidth: 3).padding(-3.5).animation(shapeAnimation, value: corners)
                }
            }
            .background {
                GeometryReader { geometry in
                    Color.clear.onChange(of: geometry.frame(in: .named("awc-native-preview")), initial: true) { _, bounds in
                        frame = bounds
                    }
                }
            }
            .simultaneousGesture(DragGesture(minimumDistance: 0).onChanged { value in
                localPointerDown = true; localOrigin = value.startLocation
            }.onEnded { _ in localPointerDown = false }, including: pointer == nil ? .all : .none)
            .onHover { hovered = $0 }
    }
}

/// Keeps keyboard focus in SwiftUI's native Button while drawing the source's
/// visual states. The body/action is unchanged by the remote preview transport.
private struct AWCNativeButtonControl<Label: View>: View {
    let style: AWCNativeButtonStyle
    let blocked: Bool
    let action: () -> Void
    let direction: String
    @ViewBuilder let label: () -> Label
    @FocusState private var focused: Bool
    @Environment(\.layoutDirection) private var inheritedDirection
    var body: some View {
        Button(action: action, label: label)
            .buttonStyle(AWCNativeButtonStyle(metrics: style.metrics, palette: style.palette, theme: style.theme,
                                              variant: style.variant, shape: style.shape, shapeMorph: style.shapeMorph,
                                              selected: style.selected, ripple: style.ripple, blocked: style.blocked, loading: style.loading,
                                              fullWidth: style.fullWidth, focused: focused,
                                              connectedLeft: style.connectedLeft, connectedRight: style.connectedRight))
            .focused($focused)
            .focusEffectDisabled()
            .disabled(blocked)
            .environment(\.layoutDirection, direction == "rtl" ? .rightToLeft : direction == "ltr" ? .leftToRight : inheritedDirection)
    }
}

private struct AWCNativeButtonIconAppearance<Content: View>: View {
    let mirrored: Bool
    let expanded: Bool
    let suppressFlip: Bool
    @ViewBuilder let content: () -> Content
    @Environment(\.layoutDirection) private var direction
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        let flipped = mirrored && direction == .rightToLeft
        // The source's later RTL rule replaces the expanded transform.
        let angle: Double = expanded && !suppressFlip && !flipped ? 180 : 0
        content().scaleEffect(x: flipped ? -1 : 1, y: 1)
            .rotationEffect(.degrees(angle))
            .animation(reduceMotion ? nil : .timingCurve(0.2, 0, 0, 1, duration: 0.1), value: angle)
            .animation(reduceMotion ? nil : .timingCurve(0.2, 0, 0, 1, duration: 0.1), value: flipped)
    }
}

extension AWCNativeView {
    var nativeButton: some View {
        let variant = s("variant", "filled")
        let tokens = colorScheme == .dark ? AWCGeneratedTokens.dark : AWCGeneratedTokens.light
        let metrics = AWCNativeButtonMetrics(size: s("size", "sm"), density: n("density"), variant: variant, tokens: tokens)
        let blocked = disabled || b("loading")
        let palette = AWCNativeButtonPalette(variant: variant, toggle: b("toggle"), selected: b("selected"), disabled: disabled)
        let style = AWCNativeButtonStyle(metrics: metrics, palette: palette, theme: theme, variant: variant,
                                         shape: s("shape", "round"), shapeMorph: b("shapeMorph", true), selected: b("selected"), ripple: b("ripple", true),
                                         blocked: blocked, loading: b("loading"), fullWidth: b("fullWidth"), focused: false,
                                         connectedLeft: b("connectedLeft"), connectedRight: b("connectedRight"))
        return AWCNativeButtonControl(style: style, blocked: blocked, action: { _ = activateNativeButton() }, direction: s("dir")) {
            HStack(spacing: metrics.gap) {
                buttonIcon(slot: "leading-icon", fallback: s("icon"), size: metrics.iconSize)
                let textChildren = node.children(inSlot: "")
                if textChildren.isEmpty { Text(label).frame(minHeight: metrics.lineHeight) }
                else {
                    HStack(spacing: 0) {
                        ForEach(textChildren) { item in
                            if item.tag == "#text" { Text(item.properties["text"]?.string ?? "") }
                            else { child(item) }
                        }
                    }.frame(minHeight: metrics.lineHeight)
                }
                buttonIcon(slot: "trailing-icon", fallback: s("trailingIcon"), size: metrics.iconSize)
                if b("loading") {
                    let loaders = node.children(inSlot: "loader")
                    if loaders.isEmpty {
                        AWCNativeButtonLoading(size: metrics.loadingSize)
                    } else {
                        ForEach(loaders) { child($0).frame(width: metrics.loadingSize, height: metrics.loadingSize) }
                    }
                }
            }
        }
        .accessibilityLabel(label)
        .accessibilityAddTraits(b("toggle") && b("selected") ? .isSelected : [])
    }

    @ViewBuilder private func buttonIcon(slot: String, fallback: String, size: CGFloat) -> some View {
        let icons = node.children(inSlot: slot)
        let expanded = slot == "trailing-icon" && (b("ariaExpanded") || b("aria-expanded") || s("aria-expanded") == "true")
        if !icons.isEmpty || !fallback.isEmpty {
            AWCNativeButtonIconAppearance(mirrored: b("mirrorIcon"), expanded: expanded, suppressFlip: b("suppressExpandIconFlip")) {
                if !icons.isEmpty {
                    ForEach(icons) { child($0).frame(width: size, height: size) }
                } else {
                    Text(fallback).font(AWCNativeFonts.symbol(size: size)).tracking(0)
                        .frame(width: size, height: size).accessibilityHidden(true)
                }
            }
        }
    }

    @discardableResult func activateNativeButton() -> AWCButtonActionResult {
        var current = node; current.properties = local
        let router = urlRouter ?? AWCURLRouter { request in openURL(request.url); return true }
        return AWCButtonAction.perform(node: current, form: resolvedForm, dispatcher: eventDispatcher, router: router,
                                observe: onEvent, commitSelected: { set("selected", .bool($0)) })
    }
}
