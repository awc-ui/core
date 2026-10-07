import SwiftUI

extension AWCNativeView {
    @ViewBuilder var divider: some View {
        if b("vertical") { Rectangle().fill(.secondary.opacity(0.3)).frame(width: 1, height: 56) }
        else { Divider().padding(.leading, b("inset") || b("insetStart") ? 16 : 0).padding(.trailing, b("inset") || b("insetEnd") ? 16 : 0) }
    }
    var avatar: some View {
        let initials = s("initials").isEmpty ? s("name", "A").split(separator: " ").prefix(2).compactMap(\.first).map(String.init).joined() : s("initials")
        let dimensions: [String: CGFloat] = ["xs": 24, "sm": 32, "md": 40, "lg": 56, "xl": 72]
        let dimension: CGFloat = n("size") > 0 ? CGFloat(n("size")) : (dimensions[s("size", "md")] ?? 40)
        return ZStack {
            RoundedRectangle(cornerRadius: s("shape") == "square" ? 8 : dimension / 2).fill(theme.primary.opacity(0.2))
            if let url = URL(string: s("src")), !s("src").isEmpty {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .success(let image): image.resizable().scaledToFill().onAppear { emit("mdLoad", ["src": p("src")]) }
                    case .failure: Text(initials).onAppear { emit("mdError", ["src": p("src")]) }
                    default: ProgressView()
                    }
                }
            } else { Text(initials).font(.system(size: dimension * 0.38, weight: .semibold)).foregroundStyle(theme.primary) }
        }.frame(width: dimension, height: dimension).clipShape(RoundedRectangle(cornerRadius: s("shape") == "square" ? 8 : dimension / 2))
        .accessibilityLabel(s("label", s("alt", s("name", "Avatar"))))
    }
    var badge: some View {
        let status = node.tag == "md-status-dot"
        let role = s("state", "error")
        let color: Color = role == "success" || role == "online" ? .green : role == "warning" || role == "busy" ? .orange : role == "offline" ? .gray : role == "info" ? .blue : theme.error
        return HStack(spacing: 4) {
            if !status && s("variant", "large") != "small" {
                symbol(s("icon"))
                Text(n("value") > n("max", 99) ? "\(Int(n("max", 99)))+" : s("value")).font(.caption2.bold())
            }
        }.frame(minWidth: status || s("variant") == "small" ? 8 : 18, minHeight: status || s("variant") == "small" ? 8 : 18)
        .padding(.horizontal, status ? 0 : 3).foregroundStyle(.white).background(color, in: RoundedRectangle(cornerRadius: s("shape") == "rect" ? 3 : 16))
        .accessibilityLabel(s("label", status ? role : s("value")))
    }
    var skeleton: some View {
        VStack(alignment: .leading, spacing: 8) {
            ForEach(0..<max(1, Int(n("lines", 1))), id: \.self) { index in
                RoundedRectangle(cornerRadius: s("variant") == "circular" ? 100 : s("variant") == "rectangular" ? 0 : 8)
                    .fill(.secondary.opacity(0.15)).frame(width: numericDimension(s("width")), height: numericDimension(s("height")) ?? (s("variant") == "text" ? 18 : 56))
                    .opacity(index == Int(n("lines", 1)) - 1 ? 0.7 : 1)
            }
        }.accessibilityLabel(s("ariaLabelProp", "Loading"))
    }
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
    var ripple: some View {
        content().padding(20).frame(minWidth: 100, minHeight: 60)
            .background(theme.primary.opacity(b("_pressed") ? 0.25 : 0.07), in: RoundedRectangle(cornerRadius: 12))
            .onTapGesture { guard !disabled else { return }; withAnimation(.easeOut(duration: 0.25)) { set("_pressed", .bool(!b("_pressed"))) } }
    }
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
