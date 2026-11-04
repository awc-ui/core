import SwiftUI

extension AWCNativeView {
    var divider: some View { AWCNativeDividerView(nodeID: node.id, properties: local, theme: theme) }
    @ViewBuilder var badge: some View {
        if node.tag == "md-badge" {
            AWCNativeBadgeView(node: node, properties: local, theme: theme, child: { child($0) })
        } else {
            statusDot
        }
    }
    private var statusDot: some View {
        AWCNativeStatusDotView(nodeID: node.id, properties: local, theme: theme)
    }
    var skeleton: some View { AWCNativeSkeleton(nodeID:node.id,properties:local,theme:theme) }
    func numericDimension(_ value: String) -> CGFloat? {
        guard !value.contains("%"), let number = Double(value.replacingOccurrences(of: "px", with: "")) else { return nil }; return CGFloat(number)
    }
    var progress: some View {
        VStack(alignment: .leading, spacing: 8) {
            if (b("showLabel") || node.tag == "md-loading-indicator") && !label.isEmpty { Text(label).font(.caption) }
            if b("indeterminate") || node.tag == "md-loading-indicator" { ProgressView().controlSize(.large) }
            else if s("variant") == "circular" {
                ZStack {
                    Circle().stroke(theme.primary.opacity(0.15), lineWidth: CGFloat(n("thickness", 6)))
                    Circle().trim(from: 0, to: fraction).stroke(theme.primary, style: StrokeStyle(lineWidth: CGFloat(n("thickness", 6)), lineCap: .round)).rotationEffect(.degrees(-90))
                    if b("showValue") { Text(s("valueText", "\(Int(fraction * 100))%")).font(.caption.monospacedDigit()) }
                }.frame(width: CGFloat(n("size", 64)), height: CGFloat(n("size", 64)))
            } else {
                ProgressView(value: fraction).progressViewStyle(.linear)
                if b("showValue") { Text(s("valueText", "\(Int(fraction * 100))%")).font(.caption.monospacedDigit()) }
            }
        }.accessibilityLabel(label).accessibilityValue("\(Int(fraction * 100)) percent")
        .onChange(of: b("complete") || fraction >= 1) { _, complete in if complete && node.tag == "md-progress-indicator" { emit("mdComplete") } }
    }
    var fraction: Double { min(1, max(0, (n("value") - n("min")) / max(0.0001, n("max", node.tag == "md-meter" ? 1 : 1) - n("min")))) }
    var card: some View {
        VStack(alignment: .leading, spacing: spacing) {
            content("media"); content("headline"); content(); content("supporting-text"); content("actions")
        }.padding(20).frame(maxWidth: b("fullWidth") ? .infinity : nil, alignment: .leading)
        .background(surface, in: RoundedRectangle(cornerRadius: 20))
        .overlay(RoundedRectangle(cornerRadius: 20).stroke(s("variant") == "outlined" ? theme.primary.opacity(0.3) : .clear))
        .shadow(color: .black.opacity(s("variant", "elevated") == "elevated" ? 0.08 : 0), radius: 5, y: 2)
        .onTapGesture { if b("interactive") { emit("mdClick") } }
    }
}
