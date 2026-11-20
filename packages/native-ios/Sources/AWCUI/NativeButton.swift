import SwiftUI
import QuartzCore

/// Resolved values from md-button.css. Kept independent of SwiftUI layout so the
/// source's size/density ladder can be checked without comparing antialiased pixels.
struct AWCNativeButtonMetrics {
    let minimumHeight: CGFloat
    let minimumWidth: CGFloat
    let verticalPadding: CGFloat
    let trailingIconSize: CGFloat
    let fixedCornerRadius: CGFloat?
    let horizontalPadding: CGFloat
    let outlineWidth: CGFloat
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
         tokens: [String: String] = AWCGeneratedTokens.light, appearance: AWCButtonAppearance = .init(), motionDelta: CGFloat = 0) {
        let sizes = ["xs", "sm", "md", "lg", "xl"]
        let index = sizes.firstIndex(of: size) ?? 1
        // The source applies local density only for the four reflected rung values.
        let density = [-1.0, -2.0, -3.0, -4.0].contains(requestedDensity) ? requestedDensity : 0
        func tapered(_ bases: [Double], _ slopes: [Double], _ floors: [Double]) -> CGFloat {
            CGFloat(max(floors[index], bases[index] + density * slopes[index]))
        }
        minimumHeight = CGFloat(appearance.minHeight ?? max(24, [32.0, 40, 56, 96, 136][index] + density * 4))
        minimumWidth = CGFloat(appearance.minWidth ?? max(40, [48.0, 58, 72, 88, 120][index] + density * 4))
        let inset = [12.0, 16, 24, 48, 64][index]
        let outerInset = CGFloat(max(inset / 2, inset + density * inset / 16))
        outlineWidth = appearance.outlineWidth.map { CGFloat($0) } ?? (variant == "outlined" ? CGFloat([1.0, 1, 1, 2, 3][index]) : 0)
        // CSS padding excludes its border. Keep the total inset identical across
        // variants while larger tiers draw their wider M3 Expressive outline.
        horizontalPadding = max(0, CGFloat(appearance.paddingInline ?? Double(outerInset)) - outlineWidth + motionDelta)
        verticalPadding = CGFloat(appearance.paddingBlock ?? 0) + outlineWidth
        fixedCornerRadius = appearance.cornerRadius.map { CGFloat($0) }
        gap = appearance.gap.map { CGFloat($0) } ?? tapered([4, 8, 8, 12, 16], [0.5, 1, 1, 1.5, 2], [2, 4, 4, 6, 8])
        iconSize = appearance.iconSize.map { CGFloat($0) } ?? tapered([20, 20, 24, 32, 40], [2.5, 2.5, 3, 4, 5], [10, 10, 12, 16, 20])
        trailingIconSize = appearance.trailingIconSize.map { CGFloat($0) } ?? iconSize
        loadingSize = appearance.loadingSize.map { CGFloat($0) } ?? max(10, iconSize * 0.7)
        fontSize = appearance.fontSize.map { CGFloat($0) } ?? tapered([14, 14, 16, 24, 32], [0.5, 0.5, 0.5, 1, 2], [12, 12, 13, 18, 24])
        lineHeight = appearance.lineHeight.map { CGFloat($0) } ?? tapered([20, 20, 24, 32, 40], [1, 1, 1, 2, 2], [16, 16, 18, 24, 32])
        let typeRole = ["label-large", "label-large", "title-medium", "headline-small", "headline-large"][index]
        letterSpacing = appearance.letterSpacing.map { CGFloat($0) } ?? CGFloat(awcButtonNumber(tokens["--md-sys-typescale-\(typeRole)-letter-spacing"], [0.1, 0.1, 0.15, 0, 0][index]))
        fontWeight = appearance.fontWeight ?? awcButtonNumber(tokens["--md-sys-typescale-\(typeRole)-font-weight"], index >= 3 ? 400 : 500)
        roundRadius = CGFloat([16.0, 20, 28, 48, 68][index])
        let squareToken = ["medium", "medium", "large", "extra-large", "extra-large"][index]
        squareRadius = CGFloat(awcButtonNumber(tokens["--md-sys-shape-corner-\(squareToken)"], [12, 12, 16, 28, 28][index]))
        let pressToken = ["small", "small", "medium", "large", "large"][index]
        pressedRadius = CGFloat(awcButtonNumber(tokens["--md-sys-shape-corner-\(pressToken)"], [8, 8, 12, 16, 16][index]))
        connectedRadius = CGFloat([4.0, 8, 8, 16, 20][index])
    }

    func inspectionTypography(lineHeight: CGFloat, appearance: AWCButtonAppearance) -> AWCValue {
        // Font construction and inspection share the same resolved numeric weight.
        let weight = AWCNativeFonts.resolvedLabelWeight(fontWeight)
        return .object([
            "size": .number(Double(fontSize)), "lineHeight": .number(Double(lineHeight)),
            "weight": .number(weight), "spacing": .number(Double(letterSpacing)),
            "family": .string(AWCNativeFonts.labelFamily(regular: fontWeight < 500)), "unit": "pt",
        ])
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

    init(start: CGFloat, end: CGFloat) { topLeading = start; bottomLeading = start; topTrailing = end; bottomTrailing = end }
    init(metrics: AWCNativeButtonMetrics, shape: String, shapeMorph: Bool, selected: Bool, pressed: Bool,
         connectedLeft: Bool = false, connectedRight: Bool = false) {
        let round = shape != "square"
        if connectedLeft || connectedRight {
            let start = connectedLeft || !round ? metrics.connectedRadius : metrics.roundRadius
            let end = connectedRight || !round ? metrics.connectedRadius : metrics.roundRadius
            topLeading = start; bottomLeading = start; topTrailing = end; bottomTrailing = end
        } else if let fixed = metrics.fixedCornerRadius {
            topLeading = fixed; bottomLeading = fixed; topTrailing = fixed; bottomTrailing = fixed
        } else {
            let resting = round ? metrics.roundRadius : metrics.squareRadius
            let selectedRadius = round ? metrics.squareRadius : metrics.roundRadius
            let radius = shapeMorph ? (pressed ? metrics.pressedRadius : selected ? selectedRadius : resting) : resting
            topLeading = radius; bottomLeading = radius; topTrailing = radius; bottomTrailing = radius
        }
    }
}

/// CSS border-box sizing: explicit width beats full-width; min wins over max.
/// Content stays intrinsic/nowrap and the button's outline clips any overflow.
struct AWCNativeButtonLayout: Layout {
    let metrics: AWCNativeButtonMetrics
    let appearance: AWCButtonAppearance
    let fullWidth: Bool
    var group: AWCNativeGroupChildGeometry? = nil

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let content = subviews.first?.sizeThatFits(.unspecified) ?? .zero
        let natural = CGSize(width: content.width + 2 * (metrics.horizontalPadding + metrics.outlineWidth),
                             height: content.height + 2 * metrics.verticalPadding)
        let preferredWidth = group?.fullWidth == true ? proposal.width ?? natural.width : appearance.width.map { CGFloat($0) }
            ?? (fullWidth ? proposal.width : nil) ?? natural.width
        // A CSS border box cannot be smaller than its own padding and border,
        // even when explicit width/min-width/max-width are all zero.
        let minimumWidth = max(metrics.minimumWidth, 2 * (metrics.horizontalPadding + metrics.outlineWidth))
        let minimumHeight = max(metrics.minimumHeight, 2 * metrics.verticalPadding)
        let maximum = max(minimumWidth, appearance.maxWidth.map { CGFloat($0) } ?? .infinity)
        let height = max(minimumHeight, appearance.height.map { CGFloat($0) } ?? (group == nil ? nil : proposal.height) ?? natural.height)
        return CGSize(width: min(maximum, max(minimumWidth, preferredWidth)),
                      height: min(group?.maximumHeight ?? .infinity, height))
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        for view in subviews { view.place(at: CGPoint(x: bounds.midX, y: bounds.midY), anchor: .center, proposal: .unspecified) }
    }
}

private func awcButtonNumber(_ value: String?, _ fallback: Double) -> Double {
    guard let value else { return fallback }
    return Double(value.replacingOccurrences(of: "px", with: "").replacingOccurrences(of: "ms", with: "")) ?? fallback
}

/// md-ripple's farthest-corner geometry and 450ms grow / 150ms release fade.
struct AWCNativeButtonRipple: View {
    let pressed: Bool
    let nativePressed: Bool
    let nativeActivation: Int
    let color: Color
    let origin: CGPoint?
    /// md-ripple's Web Animations wave ignores reduced motion; button adapters keep their verified static fallback.
    var honorsReducedMotion = true
    /// Publishes the wave (origin, diameter, scale, opacity) for this node's inspection; nil for no metrics.
    var inspectNodeID: String? = nil
    /// md-ripple sizes a wave from the host box at the wave's start; with this on, the wave keeps that box while the host
    /// re-lays out (a filter chip gaining its checkmark on activation). Off keeps the live box (gate-7 R4-10).
    var freezesBoxAtStart = false
    /// The host box at a keyboard activation, read by the host before the activation re-lays it out (gate-7 R4-10).
    var startBox: CGSize? = nil
    @Environment(\.accessibilityReduceMotion) private var systemReduceMotion
    @Environment(\.awcTouchPress) private var touchPress
    private var reduceMotion: Bool { honorsReducedMotion && systemReduceMotion }
    @State private var started: Date?
    @State private var released: Date?
    @State private var completion: Task<Void, Never>?
    @State private var waveOrigin: CGPoint?
    @State private var waveBox: CGSize?
    @State private var liveBox: CGSize = .zero

    var body: some View {
        GeometryReader { geometry in
            TimelineView(.animation(minimumInterval: nil, paused: started == nil || reduceMotion)) { context in
                let elapsed = started.map { context.date.timeIntervalSince($0) } ?? 0
                let growth = reduceMotion ? 1 : AWCNativeButtonTiming.cubic(min(1, max(0, elapsed / 0.45)), x1: 0.2, y1: 0, x2: 0, y2: 1)
                let fadeStart = max(0.45, released.flatMap { release in started.map { release.timeIntervalSince($0) } } ?? .infinity)
                let alpha = reduceMotion ? (pressed || nativePressed ? 0.12 : 0) : started == nil ? 0 : 0.12 * (1 - AWCNativeButtonTiming.cubic(min(1, max(0, (elapsed - fadeStart) / 0.15)), x1: 0.2, y1: 0, x2: 0, y2: 1))
                let box = waveBox ?? geometry.size
                let point = waveOrigin ?? CGPoint(x: box.width / 2, y: box.height / 2)
                let dx = max(abs(point.x), abs(box.width - point.x))
                let dy = max(abs(point.y), abs(box.height - point.y))
                let diameter = 2 * hypot(dx, dy)
                if let inspectNodeID {
                    let time = CACurrentMediaTime() * 1000, scale = started == nil ? 0 : growth
                    Circle().fill(color.opacity(alpha)).frame(width: diameter, height: diameter)
                        .scaleEffect(growth).position(point)
                        .awcInspect(nodeID: inspectNodeID, part: "ripple", name: "ripple") { _ in
                            ["x": .number(point.x), "y": .number(point.y), "diameter": .number(diameter), "scale": .number(scale), "opacity": .number(alpha), "renderTime": .number(time)]
                        }
                } else {
                    Circle().fill(color.opacity(alpha)).frame(width: diameter, height: diameter)
                        .scaleEffect(growth).position(point)
                }
            }
        }
        .allowsHitTesting(false).accessibilityHidden(true)
        .onGeometryChange(for: CGSize.self) { $0.size } action: { liveBox = $0 }
        .onChange(of: pressed) { _, down in
            completion?.cancel()
            if down { started = Date(); released = nil; waveOrigin = origin; waveBox = freezesBoxAtStart && liveBox != .zero ? liveBox : nil }
            else if let started {
                let release = Date(); released = release
                let remaining = max(0, 0.45 - release.timeIntervalSince(started)) + 0.15
                finish(after: remaining)
            }
        }
        .onChange(of: touchPress?.pressSerial ?? 0) { _, _ in
            // A touch whose down and up came in one update never changed `pressed`: Chrome still grows the wave, from the touch
            // point and fading from the growth's end, so start it here (the normal case starts it in onChange(of: pressed)).
            guard !pressed, !nativePressed, !reduceMotion else { return }
            completion?.cancel()
            let now = Date(); started = now; released = now; waveOrigin = touchPress?.origin ?? origin
            waveBox = freezesBoxAtStart && liveBox != .zero ? liveBox : nil
            finish(after: 0.6)
        }
        .onChange(of: nativeActivation) { _, _ in
            // Keyboard/accessibility activation has no pointer location or
            // held ButtonStyle press. Start a centered, self-releasing wave.
            completion?.cancel()
            let now = Date(); started = now; released = now; waveOrigin = nil; waveBox = freezesBoxAtStart ? (startBox ?? (liveBox != .zero ? liveBox : nil)) : nil
            finish(after: 0.6)
        }
        .onDisappear { completion?.cancel() }
    }

    private func finish(after seconds: Double) {
        completion = Task { @MainActor in
            try? await Task.sleep(for: .seconds(seconds))
            guard !Task.isCancelled else { return }
            started = nil; released = nil
        }
    }
}

private struct AWCNativeButtonStyle: ButtonStyle {
    let nodeID: String
    let metrics: AWCNativeButtonMetrics
    let palette: AWCNativeButtonPalette
    let appearance: AWCButtonAppearance
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
    var pointerPressed: () -> Void = {}
    var nativePressed = false
    var nativeActivation = 0
    func makeBody(configuration: Configuration) -> some View {
        AWCNativeButtonStyleBody(nodeID: nodeID, metrics: metrics, palette: palette, appearance: appearance, theme: theme,
                                 variant: variant, shape: shape, shapeMorph: shapeMorph,
                                 selected: selected, ripple: ripple, blocked: blocked,
                                 loading: loading, fullWidth: fullWidth, focused: focused,
                                 connectedLeft: connectedLeft, connectedRight: connectedRight,
                                 pointerPressed: pointerPressed,
                                 nativePressed: nativePressed, nativeActivation: nativeActivation,
                                 configuration: configuration)
    }
}

private struct AWCNativeButtonStyleBody: View {
    let nodeID: String
    let metrics: AWCNativeButtonMetrics
    let palette: AWCNativeButtonPalette
    let appearance: AWCButtonAppearance
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
    let pointerPressed: () -> Void
    let nativePressed: Bool
    let nativeActivation: Int
    let configuration: ButtonStyleConfiguration
    @State private var hovered = false
    @State private var frame = CGRect.zero
    @State private var localOrigin: CGPoint?
    @State private var localPointerDown = false
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.accessibilityReduceMotion) private var systemReduceMotion
    @Environment(\.awcReducedMotion) private var reducedOverride
    private var reduceMotion: Bool { reducedOverride ?? systemReduceMotion }
    @Environment(\.isEnabled) private var enabled
    @Environment(\.awcNativePointerState) private var pointer
    @Environment(\.awcTouchPress) private var touchPress
    @Environment(\.awcThemeTokens) private var themeTokens
    @Environment(\.awcNativeGroupGeometry) private var groupGeometry
    @Environment(\.awcNativeGroupContext) private var groupContext
    @Environment(\.layoutDirection) private var layoutDirection

    private var tokens: [String: String] {
        if !themeTokens.isEmpty { return themeTokens }
        if !theme.tokens.isEmpty { return theme.tokens }
        return colorScheme == .dark ? AWCGeneratedTokens.dark : AWCGeneratedTokens.light
    }
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
        let stateEnabled = active || (loading && palette.labelOpacity == 1)
        // `:active` from the primary press itself: pointer down inside the button until pointer up (as in Chrome), not only
        // SwiftUI's isPressed, which arrives frames late on iOS 18 and ends when the pointer leaves the button.
        let heldPointer = pointer.map { $0.isPointerDown && ($0.pressLocation.map(frame.contains) ?? false) } ?? localPointerDown
        // iOS: the raw touch press (AWCTouchPressRouter) when the router owns the touch; SwiftUI's isPressed otherwise.
        let touchDown = touchPress?.isDown ?? false
        let buttonPressed = configuration.awcPressed(touchPress)
        let pointerIsPressed = active && (buttonPressed || heldPointer)
        let pressed = active && (buttonPressed || nativePressed || heldPointer)
        let isHovered = pointer.map { state in state.location.map(frame.contains) ?? false } ?? hovered
        let pointerOrigin = pointer.flatMap { state in
            state.isPointerDown ? state.pressLocation.map { CGPoint(x: $0.x - frame.minX, y: $0.y - frame.minY) } : nil
        } ?? (touchDown ? touchPress?.origin : nil) ?? (localPointerDown ? localOrigin : nil)
        let groupedCorners = groupGeometry?.corners(icon:false,selected:selected,pressed:pressed && shapeMorph)
        let corners = groupedCorners.map { AWCNativeButtonCorners(start:$0.start,end:$0.end) } ?? AWCNativeButtonCorners(metrics: metrics, shape: shape, shapeMorph: shapeMorph,
                                             selected: selected, pressed: pressed, connectedLeft: connectedLeft, connectedRight: connectedRight)
        let outline = UnevenRoundedRectangle(topLeadingRadius: corners.topLeading, bottomLeadingRadius: corners.bottomLeading,
                                             bottomTrailingRadius: corners.bottomTrailing, topTrailingRadius: corners.topTrailing, style: .circular)
        let visualPressed = stateEnabled && (buttonPressed || heldPointer)
        let stateOpacity = !stateEnabled ? 0 : appearance.stateLayerOpacity ?? ((pressed || visualPressed) ? (appearance.pressedOpacity ?? opacity("pressed-state-layer", 0.12)) : focused ? (appearance.focusOpacity ?? opacity("focus-state-layer", 0.12)) : isHovered ? (appearance.hoverOpacity ?? opacity("hover-state-layer", 0.08)) : 0)
        let borderColor = appearance.outlineColor.map { Color(awcHex: $0) } ?? (palette.labelOpacity < 1 ? color("on-surface") : stateEnabled && (isHovered || focused) && palette.outlineRole == "outline" ? color("primary") : color(palette.outlineRole ?? (appearance.outlineWidth != nil ? "outline" : nil)))
        let elevation = stateEnabled && isHovered && !visualPressed && !pressed && !focused ? palette.hoverElevation : palette.restingElevation
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
            .font(AWCNativeFonts.label(size: metrics.fontSize, weight: metrics.fontWeight))
            .tracking(metrics.letterSpacing)
            .lineLimit(1)
            .animation(colorAnimation) { content in content.foregroundStyle((appearance.labelColor.map { Color(awcHex: $0) } ?? color(palette.labelRole)).opacity(contentOpacity)) })
        let surface = AnyView(AWCNativeButtonLayout(metrics: metrics, appearance: appearance, fullWidth: fullWidth, group:groupGeometry) { label }
            .background {
                Rectangle().fill((appearance.containerColor.map { Color(awcHex: $0) } ?? color(palette.containerRole)).opacity(containerOpacity))
                    .animation(colorAnimation, value: selected)
                    .overlay {
                        if ripple {
                            // md-ripple's wave plays under reduced motion too (Chrome: 450 ms grow, 150 ms fade). Its colour is
                            // the host's currentColor (the label colour), not the state-layer colour. <md-ripple> precedes the state-layer
                            // span in the shadow DOM, so the state layer paints over the wave.
                            AWCNativeButtonRipple(pressed: pointerIsPressed, nativePressed: active && nativePressed,
                                                  nativeActivation: nativeActivation, color: appearance.labelColor.map { Color(awcHex: $0) } ?? color(palette.labelRole), origin: pointerOrigin,
                                                  honorsReducedMotion: false)
                                .opacity(active ? 1 : 0)
                        }
                    }
                    .overlay {
                        Rectangle().fill(((appearance.stateLayerColor ?? appearance.labelColor).map { Color(awcHex: $0) } ?? color(palette.stateRole)).opacity(stateOpacity))
                            .animation(reduceMotion ? nil : .timingCurve(pressed ? 0.05 : 0.2, pressed ? 0.7 : 0, pressed ? 0.1 : 0, 1, duration: pressed ? 0.05 : 0.1), value: stateOpacity)
                    }
            })
        let bordered = AnyView(surface.overlay {
                outline.strokeBorder(lineWidth: metrics.outlineWidth)
                    .animation(shapeAnimation, value: corners)
                    .animation(colorAnimation) { content in
                        content.foregroundStyle(borderColor.opacity(disabledPalette ? opacity("disabled-container", 0.12) : palette.outlineOpacity))
                    }
            }
            .contentShape(outline)
            .animation(shapeAnimation) { content in content.clipShape(outline) }
            .background {
                // The variant's --md-sys-elevation-N token, outside the border box (CSS box-shadow), with the 100 ms colour
                // timing for elevation and the shape timing for the morphing corners.
                let rtl = layoutDirection == .rightToLeft
                AWCElevationShadow(level: Double(elevation),
                                   radii: rtl ? [corners.topTrailing, corners.topLeading, corners.bottomLeading, corners.bottomTrailing].map(Double.init)
                                              : [corners.topLeading, corners.topTrailing, corners.bottomTrailing, corners.bottomLeading].map(Double.init),
                                   tokens: tokens)
                    .animation(shapeAnimation, value: corners)
                    .animation(colorAnimation, value: elevation)
            })
        return bordered.overlay {
                if focused {
                    outline.stroke(appearance.focusRingColor.map { Color(awcHex: $0) } ?? color("secondary"), lineWidth: 3)
                        .padding(-((appearance.focusRingOffset ?? 2) + 1.5)).animation(shapeAnimation, value: corners)
                }
            }
            .background {
                GeometryReader { geometry in
                    Color.clear.onChange(of: geometry.frame(in: .named("awc-native-preview")), initial: true) { _, bounds in
                        frame = bounds
                    }
                }
            }
            .awcObservePointerOrigin(enabled:pointer == nil) { origin, down in
                localPointerDown=down;localOrigin=origin
            }
            .onHover { hovered = $0 }
            .onChange(of: buttonPressed) { _, down in
                if down { groupContext?.press(nodeID); if groupContext != nil { pointerPressed() } }
            }
            .onChange(of: active && heldPointer) { _, down in if down { groupContext?.press(nodeID) } }
            .onChange(of: configuration.isPressed) { _, down in if !down { touchPress?.swiftUIReleased() } }
            // A pointer press focuses the button even when activation is blocked (soft-disabled, loading): the source
            // host keeps tabindex 0, so Chrome moves focus to it on mousedown. Hard-disabled buttons are not focusable.
            .onChange(of: enabled && buttonPressed) { _, isPressed in
                if isPressed { pointerPressed() }
            }
            .awcInspect(nodeID: nodeID, name: "md-button", metricSources: ["typography": "component.label"]) { _ in
                let horizontal = Double(metrics.horizontalPadding + metrics.outlineWidth)
                let vertical = Double(metrics.verticalPadding)
                return [
                    "padding": .array([vertical, horizontal, vertical, horizontal].map(AWCValue.number)),
                    "margin": .array(Array(repeating: .number(0), count: 4)),
                    "border": .array(Array(repeating: .number(Double(metrics.outlineWidth)), count: 4)),
                    "gap": .object(["row": 0, "column": .number(Double(metrics.gap))]),
                    "display": "SwiftUI Button", "direction": .string(layoutDirection == .rightToLeft ? "rtl" : "ltr"),
                ]
            }
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

private struct AWCButtonPartColor: ViewModifier {
    let hex: String?
    let opacity: Double
    @ViewBuilder func body(content: Content) -> some View {
        if let hex { content.foregroundStyle(Color(awcHex: hex).opacity(opacity)) }
        else { content }
    }
}

extension AWCNativeView {
    var nativeButton: some View {
        let variant = s("variant", "filled")
        let tokens = theme.tokens.isEmpty ? (colorScheme == .dark ? AWCGeneratedTokens.dark : AWCGeneratedTokens.light) : theme.tokens
        let effectiveAppearance = buttonAppearance.merging(.init(minWidth:nativeGroupGeometry?.minimumWidth.map{Double($0)},minHeight:nativeGroupGeometry?.maximumHeight.map{Double($0)}))
        let density = AWCNativeDensity.resolve(local["density"]?.number,
            inherited: nativeGroupGeometry?.density ?? nativeGroupContext?.density ?? inheritedDensity)
        let metrics = AWCNativeButtonMetrics(size: s("size", "sm"), density: density, variant: variant, tokens: tokens, appearance: effectiveAppearance,motionDelta:nativeGroupGeometry?.motionDelta ?? nativeGroupContext?.motionDelta(node.id) ?? 0)
        let blocked = disabled || b("loading")
        let palette = AWCNativeButtonPalette(variant: variant, toggle: b("toggle"), selected: b("selected"), disabled: disabled)
        let style = AWCNativeButtonStyle(nodeID: node.id, metrics: metrics, palette: palette, appearance: effectiveAppearance, theme: theme, variant: variant,
                                         shape: s("shape", "round"), shapeMorph: b("shapeMorph", true), selected: b("selected"), ripple: b("ripple", true),
                                         blocked: blocked, loading: b("loading"), fullWidth: b("fullWidth"), focused: false,
                                         connectedLeft: b("connectedLeft"), connectedRight: b("connectedRight"))
        return AWCNativeActionControl(style: { focused, nativePressed, activation, pointerPressed in
            AWCNativeButtonStyle(nodeID: style.nodeID, metrics: style.metrics, palette: style.palette, appearance: style.appearance, theme: style.theme,
                variant: style.variant, shape: style.shape, shapeMorph: style.shapeMorph, selected: style.selected, ripple: style.ripple,
                blocked: style.blocked, loading: style.loading, fullWidth: style.fullWidth, focused: focused,
                connectedLeft: style.connectedLeft, connectedRight: style.connectedRight, pointerPressed: pointerPressed,
                nativePressed: nativePressed, nativeActivation: activation)
        }, policy: AWCButtonAccessibilityPolicy(properties: nativeActionProperties), id: node.id, accessibleLabel: accessibleName, action: { source in _ = activateNativeButton(activation: .init(kind: .nativeControl, source: source)) }, direction: s("dir")) {
            HStack(spacing: metrics.gap) {
                buttonIcon(slot: "leading-icon", fallback: s("icon"), size: metrics.iconSize)
                    .modifier(AWCButtonPartColor(hex: buttonAppearance.iconColor ?? buttonAppearance.labelColor, opacity: palette.labelOpacity))
                let textChildren = node.children(inSlot: "")
                if textChildren.isEmpty {
                    AWCExactTextWidth(width: buttonExactLabelWidth(label, metrics)) { AWCNativeFonts.labelText(label, size: metrics.fontSize, weight: metrics.fontWeight).fixedSize() }.frame(height: metrics.lineHeight)
                        .awcInspect(nodeID: node.id, part: "label", parentPart: "content", name: "md-button ::part(label)") { size in
                            buttonLabelInspection(metrics, lineHeight: size.height)
                        }
                }
                else {
                    AWCExactTextWidth(width: textChildren.count == 1 && textChildren[0].tag == "#text" ? buttonExactLabelWidth(textChildren[0].properties["text"]?.string ?? "", metrics) : nil) {
                    HStack(spacing: 0) {
                        ForEach(textChildren) { item in
                            if item.tag == "#text" { AWCNativeFonts.labelText(item.properties["text"]?.string ?? "", size: metrics.fontSize, weight: metrics.fontWeight) }
                            else { child(item) }
                        }
                    }.fixedSize()
                    }
                        .frame(height: textChildren.allSatisfy { $0.tag == "#text" } ? metrics.lineHeight : nil)
                        .frame(minHeight: textChildren.allSatisfy { $0.tag == "#text" } ? nil : metrics.lineHeight)
                        .awcInspect(nodeID: node.id, part: "label", parentPart: "content", name: "md-button ::part(label)") { size in
                            // Authored nested components may override inherited
                            // text styling; only homogeneous text has one font.
                            textChildren.allSatisfy { $0.tag == "#text" }
                                ? buttonLabelInspection(metrics, lineHeight: size.height)
                                : ["display": "SwiftUI HStack", "direction": .string(buttonInspectionDirection)]
                        }
                }
                buttonIcon(slot: "trailing-icon", fallback: s("trailingIcon"), size: metrics.trailingIconSize)
                    .modifier(AWCButtonPartColor(hex: buttonAppearance.trailingIconColor ?? buttonAppearance.iconColor ?? buttonAppearance.labelColor, opacity: palette.labelOpacity))
                if b("loading") {
                    let loaders = node.children(inSlot: "loader")
                    Group {
                        if loaders.isEmpty {
                            AWCNativeButtonLoading(size: metrics.loadingSize)
                                .awcInspect(nodeID: node.id, part: "loader", parentPart: "content", name: "md-button ::part(loader)") { _ in
                                    buttonPartInspection(display: "SwiftUI TimelineView")
                                }
                        } else {
                            ForEach(Array(loaders.enumerated()), id: \.element.id) { index, item in
                                buttonSlot(item).environment(\.awcMaterialSymbolSize, metrics.loadingSize)
                                    .awcInspect(nodeID: node.id, part: loaders.count == 1 ? "loader" : "loader.\(index)", parentPart: "content", name: "md-button ::part(loader)")
                            }
                        }
                    }.modifier(AWCButtonPartColor(hex: buttonAppearance.loadingColor ?? buttonAppearance.labelColor, opacity: palette.labelOpacity))
                }
            }.awcInspect(nodeID: node.id, part: "content", name: "md-button ::part(content)",
                         metricSources: ["typography": "component.label"]) { _ in
                ["padding": .array(Array(repeating: 0, count: 4)), "margin": .array(Array(repeating: 0, count: 4)),
                 "border": .array(Array(repeating: 0, count: 4)),
                 "gap": .object(["row": 0, "column": .number(Double(metrics.gap))]),
                 "display": "SwiftUI HStack", "direction": .string(buttonInspectionDirection)]
            }
        }

    }

    private var buttonInspectionDirection: String {
        s("dir") == "rtl" ? "rtl" : s("dir") == "ltr" ? "ltr" : layoutDirection == .rightToLeft ? "rtl" : "ltr"
    }

    private func buttonLabelInspection(_ metrics: AWCNativeButtonMetrics, lineHeight: CGFloat) -> [String: AWCValue] {
        ["typography": metrics.inspectionTypography(lineHeight: lineHeight, appearance: buttonAppearance),
         "padding": .array(Array(repeating: 0, count: 4)), "margin": .array(Array(repeating: 0, count: 4)),
         "border": .array(Array(repeating: 0, count: 4)),
         "display": "SwiftUI Text", "direction": .string(buttonInspectionDirection)]
    }

    private func buttonPartInspection(display: String) -> [String: AWCValue] {
        ["padding": .array(Array(repeating: 0, count: 4)), "margin": .array(Array(repeating: 0, count: 4)),
         "border": .array(Array(repeating: 0, count: 4)),
         "display": .string(display), "direction": .string(buttonInspectionDirection)]
    }

    @ViewBuilder private func buttonSlot(_ item: AWCNode) -> some View {
        // Plain slot text inherits its button part. Nested components keep their
        // own explicitly authored styling while still receiving the environment.
        if item.tag == "#text" { Text(item.properties["text"]?.string ?? "") }
        else if item.tag == "#symbol" { AWCMaterialSymbol(item.properties["name"]?.string ?? "", size: item.properties["size"]?.number.map { CGFloat($0) }) }
        else if item.tag == "md-progress-indicator", item.properties["variant"]?.string == "circular",
                item.properties["indeterminate"]?.bool == true, item.properties["wave"]?.bool != true {
            AWCNativeCircularProgress(size: CGFloat(min(240, max(24, item.properties["size"]?.number ?? 40))),
                                      thickness: CGFloat(max(0.5, item.properties["thickness"]?.number ?? 4)))
        }
        else { child(item) }
    }

    @ViewBuilder private func buttonIcon(slot: String, fallback: String, size: CGFloat) -> some View {
        let icons = node.children(inSlot: slot)
        let expanded = slot == "trailing-icon" && (b("ariaExpanded") || b("aria-expanded") || s("aria-expanded") == "true")
        if !icons.isEmpty || !fallback.isEmpty {
            AWCNativeButtonIconAppearance(mirrored: b("mirrorIcon"), expanded: expanded, suppressFlip: b("suppressExpandIconFlip")) {
                if !icons.isEmpty {
                    ForEach(Array(icons.enumerated()), id: \.element.id) { index, item in
                        buttonSlot(item).environment(\.awcMaterialSymbolSize, size).frame(width: size, height: size)
                            .awcInspect(nodeID: node.id, part: icons.count == 1 ? slot : "\(slot).\(index)", parentPart: "content", name: "md-button ::part(\(slot))")
                    }
                } else {
                    AWCMaterialSymbol(fallback, size: size)
                        .awcInspect(nodeID: node.id, part: slot, parentPart: "content", name: "md-button ::part(\(slot))") { bounds in
                            var values = buttonPartInspection(display: "SwiftUI Text")
                            values["typography"] = .object([
                                "size": .number(Double(size)), "lineHeight": .number(Double(bounds.height)),
                                "weight": 400, "spacing": 0, "family": .string(AWCNativeFonts.symbolFamily()), "unit": "pt",
                            ])
                            return values
                        }
                }
            }
        }
    }

    @discardableResult func activateNativeButton(activation: AWCActivationMetadata = .init(kind: .nativeControl)) -> AWCButtonActionResult {
        var current = node; current.properties = nativeActionProperties
        let router = urlRouter ?? AWCURLRouter { request in openURL(request.url); return true }
        let result = AWCButtonAction.perform(node: current, form: resolvedForm, dispatcher: eventDispatcher, router: router,
                                targetListeners: eventTargetListeners, activation: activation, observe: onEvent, commitSelected: { set("selected", .bool($0)) })
        nativeGroupContext?.activate(node.id,activation)
        return result
    }
}

extension AWCNativeView {
    /// The exact advance of a plain md-button label (CSS letter-spacing after every character) for the bundled Roboto weights.
    func buttonExactLabelWidth(_ text: String, _ m: AWCNativeButtonMetrics) -> CGFloat? {
        guard !text.isEmpty, [400.0, 500, 700].contains(m.fontWeight), !text.contains("\n") else { return nil }
        return CGFloat(AWCNativeFonts.labelTextWidth(text, size: m.fontSize, weight: m.fontWeight, tracking: Double(m.letterSpacing)))
    }
}

private struct AWCReducedMotionKey: EnvironmentKey { static let defaultValue: Bool? = nil }
extension EnvironmentValues {
    /// Overrides the system Reduce Motion setting for AWC renderers that honour it (tests and previews).
    var awcReducedMotion: Bool? { get { self[AWCReducedMotionKey.self] } set { self[AWCReducedMotionKey.self] = newValue } }
}
extension View {
    func awcReducedMotion(_ value: Bool?) -> some View { environment(\.awcReducedMotion, value) }
}
