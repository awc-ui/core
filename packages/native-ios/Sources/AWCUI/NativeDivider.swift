import SwiftUI

struct AWCNativeDividerMetrics {
    let vertical: Bool
    let thickness: CGFloat
    let start: CGFloat
    let end: CGFloat

    init(properties: [String: AWCValue], appearance: AWCDividerAppearance) {
        vertical = properties["vertical"]?.bool == true
        thickness = CGFloat(appearance.thickness ?? 1)
        // Keep the source stylesheet's cascade: end-only wins over start-only,
        // and either one-sided flag wins over the middle-inset flag.
        let startOnly = properties["insetStart"]?.bool == true
        let endOnly = properties["insetEnd"]?.bool == true
        let both = properties["inset"]?.bool == true
        start = !endOnly && (both || startOnly) ? CGFloat(appearance.insetStart ?? 16) : 0
        end = endOnly || (both && !startOnly) ? CGFloat(appearance.insetEnd ?? 16) : 0
    }

    func line(in size: CGSize, rtl: Bool) -> CGRect {
        if vertical {
            return CGRect(x: 0, y: start, width: size.width, height: max(0, size.height - start - end))
        }
        let width = max(0, size.width - start - end)
        return CGRect(x: rtl ? size.width - start - width : start, y: 0, width: width, height: size.height)
    }
}

private struct AWCNativeDividerLayout: Layout {
    let metrics: AWCNativeDividerMetrics
    let rtl: Bool
    let minimumLength: CGFloat

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        if metrics.vertical {
            return CGSize(width: metrics.thickness, height: max(minimumLength, proposal.height.flatMap { $0.isFinite ? $0 : nil } ?? minimumLength))
        }
        return CGSize(width: max(0, proposal.width.flatMap { $0.isFinite ? $0 : nil } ?? 0), height: metrics.thickness)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        guard let line = subviews.first else { return }
        // SwiftUI mirrors custom Layout placements in RTL. Place logical
        // coordinates once; manually reversing them would mirror twice.
        let rect = metrics.line(in: bounds.size, rtl: false)
        line.place(at: CGPoint(x: bounds.minX + rect.minX, y: bounds.minY + rect.minY),
                   anchor: .topLeading, proposal: ProposedViewSize(rect.size))
    }
}

struct AWCNativeDividerView: View {
    let nodeID: String
    let properties: [String: AWCValue]
    let theme: AWCTheme
    @Environment(\.awcDividerAppearance) private var appearance
    @Environment(\.layoutDirection) private var direction
    @Environment(\.awcForcedColors) private var forced
    @ScaledMetric(relativeTo: .body) private var minimumLength = 16.0

    @ViewBuilder var body: some View {
        if properties["hidden"]?.bool != true { separator }
    }

    private var separator: some View {
        let metrics = AWCNativeDividerMetrics(properties: properties, appearance: appearance)
        let rtl = direction == .rightToLeft
        let color = forced.map { Color(awcHex: $0.canvasText) } ??
            Color(awcHex: appearance.color ?? theme.tokens["--md-sys-color-outline-variant"] ?? "#CAC4D0")
        return AWCNativeDividerLayout(metrics: metrics, rtl: rtl, minimumLength: minimumLength) {
            Rectangle().fill(color)
                .awcInspect(nodeID: nodeID, part: "divider", name: "md-divider ::part(divider)") { _ in
                    ["margin": metrics.vertical ? [.number(Double(metrics.start)), 0, .number(Double(metrics.end)), 0] :
                        [0, .number(Double(rtl ? metrics.start : metrics.end)), 0, .number(Double(rtl ? metrics.end : metrics.start))],
                     "direction": .string(rtl ? "rtl" : "ltr"), "display": "SwiftUI Rectangle"]
                }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Separator")
        .accessibilityValue(metrics.vertical ? "Vertical" : "Horizontal")
        .awcInspect(nodeID: nodeID, name: "md-divider") { _ in
            ["padding": [0,0,0,0], "margin": [0,0,0,0], "border": [0,0,0,0],
             "direction": .string(rtl ? "rtl" : "ltr"), "display": "SwiftUI Layout"]
        }
    }
}
