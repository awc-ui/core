import SwiftUI
import Accessibility

struct AWCNativeStatusDotMetrics {
    let size: Double
    let outlineWidth: Double
    let inline: Bool
    let circle: Bool
    let insetEnd: AWCStatusDotInset
    let insetBlockEnd: AWCStatusDotInset
    let color: String
    let pulseColor: String
    let pulseOpacity: Double
    let outlineColor: String
    let innerRingColor: String?
    let pulseDuration: Double
    let live: Bool
    let label: String

    init(properties: [String: AWCValue], appearance: AWCStatusDotAppearance,
         density: Double = 0, tokens: [String: String] = [:], displayScale: Double = 1) {
        let density = AWCNativeDensity.resolve(properties["density"]?.number, inherited: density)
        let preset = properties["size"]?.string ?? "medium"
        let large = preset == "large", small = preset == "small"
        inline = properties["inline"]?.bool == true
        circle = properties["shape"]?.string == "circle"
        size = appearance.size ?? (small ? max(4, 8 + density) :
            large ? max(8, 16 + density * 2) : max(6, 12 + density * 1.5))
        let requestedOutline = appearance.outlineWidth ?? (inline ? 0 :
            small ? max(1, 1.5 + density * 0.125) :
            large ? max(1.5, 3 + density * 0.375) : max(1, 2 + density * 0.25))
        let scale = displayScale.isFinite && displayScale > 0 ? displayScale : 1
        outlineWidth = requestedOutline == 0 ? 0 : max(1, floor(requestedOutline * scale)) / scale
        let defaultInset = circle ? AWCStatusDotInset(points: -size / 2, fraction: 0.146447) :
            AWCStatusDotInset(points: large ? -3 : -2)
        insetEnd = appearance.insetEnd ?? defaultInset
        insetBlockEnd = appearance.insetBlockEnd ?? defaultInset
        let state = properties["state"]?.string ?? "neutral"
        let surface = tokens["--md-sys-color-surface"] ?? "#FEF7FF"
        let outline = tokens["--md-sys-color-outline"] ?? "#79747E"
        let semantic = ["online": "#2DC653", "away": "#F4B400", "busy": "#DB4437"][state]
        color = appearance.color ?? semantic ?? (state == "invisible" ? surface :
            state == "offline" ? outline : tokens["--md-sys-color-on-surface-variant"] ?? "#49454F")
        pulseColor = appearance.pulseColor ?? semantic ?? "#00000000"
        pulseOpacity = appearance.pulseColor == nil && semantic != nil ? 0.55 : 1
        outlineColor = appearance.outlineColor ?? surface
        innerRingColor = state == "invisible" ? outline : nil
        pulseDuration = appearance.pulseDuration ?? 1.6
        live = properties["live"]?.bool == true
        let source = properties["label"]?.string ?? ""
        // String.trim() uses ECMAScript whitespace, including BOM but not NEL.
        let whitespace = CharacterSet(charactersIn:
            "\u{0009}\u{000A}\u{000B}\u{000C}\u{000D} \u{00A0}\u{1680}\u{2000}\u{2001}\u{2002}\u{2003}\u{2004}\u{2005}\u{2006}\u{2007}\u{2008}\u{2009}\u{200A}\u{2028}\u{2029}\u{202F}\u{205F}\u{3000}\u{FEFF}")
        label = source.trimmingCharacters(in: whitespace).isEmpty ? "" : source
    }

    func frame(in parent: CGSize, rtl: Bool) -> CGRect {
        let end = insetEnd.resolved(parent.width), bottom = insetBlockEnd.resolved(parent.height)
        return .init(x: rtl ? end : parent.width - end - size, y: parent.height - bottom - size, width: size, height: size)
    }
}

struct AWCNativeStatusPulse {
    let spread: Double
    let opacity: Double
    static func at(_ progress: Double) -> Self {
        let progress = min(1, max(0, progress))
        let first = progress < 0.7
        let eased = easeOut(first ? progress / 0.7 : (progress - 0.7) / 0.3)
        return .init(spread: first ? 8 * eased : 8 * (1 - eased), opacity: first ? 1 - eased : 0)
    }
    private static func easeOut(_ x: Double) -> Double {
        // CSS ease-out = cubic-bezier(0,0,.58,1), independently per keyframe segment.
        var low = 0.0, high = 1.0
        for _ in 0..<24 {
            let t = (low + high) / 2
            let position = 3 * (1 - t) * t * t * 0.58 + t * t * t
            if position < x { low = t } else { high = t }
        }
        let t = (low + high) / 2
        return 3 * (1 - t) * t * t + t * t * t
    }
}

/// CSS outer box shadows never paint the element's interior, even through a
/// translucent fill. An even-odd ring preserves that behavior without a mask.
private struct AWCStatusDotPulseHalo: Shape {
    let spread: Double
    func path(in rect: CGRect) -> Path {
        var path = Path(ellipseIn: rect)
        path.addEllipse(in: rect.insetBy(dx: spread, dy: spread))
        return path
    }
}

private struct AWCStatusDotParentKey: EnvironmentKey { static let defaultValue: CGSize? = nil }
private extension EnvironmentValues {
    var awcStatusDotParent: CGSize? {
        get { self[AWCStatusDotParentKey.self] }
        set { self[AWCStatusDotParentKey.self] = newValue }
    }
}
private struct AWCStatusDotAnchorLayout: Layout {
    let parent: CGSize
    let metrics: AWCNativeStatusDotMetrics
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize { parent }
    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        guard let dot = subviews.first else { return }
        // Logical coordinates are mirrored by SwiftUI in RTL.
        let frame = metrics.frame(in: parent, rtl: false)
        dot.place(at: .init(x: bounds.minX + frame.minX, y: bounds.minY + frame.minY),
            anchor: .topLeading, proposal: .init(frame.size))
    }
}
public extension View {
    /// Attach a non-inline status dot to this view's measured bottom/trailing corner.
    /// Use an ordinary HStack for an inline dot; its label is accessibility-only.
    func awcStatusDotOverlay<Dots: View>(@ViewBuilder content: @escaping () -> Dots) -> some View {
        overlay(alignment: .topLeading) {
            GeometryReader { parent in
                content().environment(\.awcStatusDotParent, parent.size)
            }.allowsHitTesting(false)
        }
    }
}

struct AWCNativeStatusDotView: View {
    let nodeID: String
    let properties: [String: AWCValue]
    let theme: AWCTheme
    @Environment(\.awcStatusDotAppearance) private var appearance
    @Environment(\.awcStatusDotParent) private var parent
    @Environment(\.awcNativeDensity) private var density
    @Environment(\.awcThemeTokens) private var tokens
    @Environment(\.layoutDirection) private var direction
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.displayScale) private var displayScale
    @State private var pulseStart = Date()
    private var resolvedTokens: [String: String] { theme.tokens.merging(tokens) { _, local in local } }
    private var metrics: AWCNativeStatusDotMetrics {
        .init(properties: properties, appearance: appearance, density: density,
            tokens: resolvedTokens, displayScale: displayScale)
    }
    private var resolvedDirection: LayoutDirection {
        properties["dir"]?.string == "rtl" ? .rightToLeft :
            properties["dir"]?.string == "ltr" ? .leftToRight : direction
    }
    private func paint(_ hex: String) -> Color {
        let value = UInt64(hex.dropFirst(), radix: 16) ?? 0
        let rgba = hex.count == 9, rgb = rgba ? value >> 8 : value
        return .init(.sRGB, red: Double((rgb >> 16) & 255) / 255, green: Double((rgb >> 8) & 255) / 255,
            blue: Double(rgb & 255) / 255, opacity: rgba ? Double(value & 255) / 255 : 1)
    }
    @ViewBuilder var body: some View {
        if properties["hidden"]?.bool != true {
            let m = metrics
            Group {
                if let parent, !m.inline {
                    AWCStatusDotAnchorLayout(parent: parent, metrics: m) { dot(m) }
                } else { dot(m) }
            }
            .environment(\.layoutDirection, resolvedDirection)
            .onChange(of: m.live) { _, _ in pulseStart = Date() }
            .onChange(of: reduceMotion) { _, _ in pulseStart = Date() }
        }
    }
    private func dot(_ m: AWCNativeStatusDotMetrics) -> some View {
        let animationActive = m.live && !reduceMotion && m.pulseDuration > 0
        let duration = resolvedTokens["--md-sys-motion-duration-short2"] ?? "200ms"
        let transition = duration.hasSuffix("ms") ? (Double(duration.dropLast(2)) ?? 200) / 1000 :
            duration.hasSuffix("s") ? Double(duration.dropLast()) ?? 0.2 : 0.2
        return Circle().fill(paint(m.color))
            .animation(.timingCurve(0.2, 0, 0, 1, duration: transition), value: m.color)
            .overlay {
                if let ring = m.innerRingColor, !animationActive {
                    Circle().strokeBorder(paint(ring), lineWidth: 2)
                }
            }
            .frame(width: m.size, height: m.size)
            .background {
                if animationActive, m.pulseDuration > 0 {
                    TimelineView(.animation(minimumInterval: 1 / 60)) { tick in
                        let elapsed = max(0, tick.date.timeIntervalSince(pulseStart))
                        let pulse = AWCNativeStatusPulse.at(elapsed.truncatingRemainder(dividingBy: m.pulseDuration) / m.pulseDuration)
                        AWCStatusDotPulseHalo(spread: pulse.spread)
                            .fill(paint(m.pulseColor).opacity(pulse.opacity * m.pulseOpacity),
                                  style: FillStyle(eoFill: true))
                            .frame(width: m.size + 2 * pulse.spread, height: m.size + 2 * pulse.spread)
                    }
                }
            }
            .overlay {
                Circle().strokeBorder(paint(m.outlineColor), lineWidth: m.outlineWidth)
                    .frame(width: m.size + 2 * m.outlineWidth, height: m.size + 2 * m.outlineWidth)
                    .animation(.timingCurve(0.2, 0, 0, 1, duration: transition), value: m.outlineColor)
            }
            .allowsHitTesting(false)
            .accessibilityElement(children: .ignore)
            .accessibilityHidden(m.label.isEmpty)
            .accessibilityLabel(m.label)
            .accessibilityAddTraits(m.live ? [] : .isImage)
            .onChange(of: m.label) { _, value in
                if m.live, !value.isEmpty {
                    var announcement = AttributedString(value)
                    announcement.accessibilitySpeechAnnouncementPriority = .low
                    AccessibilityNotification.Announcement(announcement).post()
                }
            }
            .awcInspect(nodeID: nodeID, name: "md-status-dot") { _ in
                ["padding": [0,0,0,0], "margin": [0,0,0,0], "border": [0,0,0,0],
                 "direction": .string(resolvedDirection == .rightToLeft ? "rtl" : "ltr"),
                 "display": "SwiftUI Circle", "outlineWidth": .number(m.outlineWidth)]
            }
    }
}
