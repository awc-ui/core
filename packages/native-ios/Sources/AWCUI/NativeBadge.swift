import SwiftUI
import Accessibility

enum AWCNativeBadgeValue {
    // ECMAScript whitespace for Number(), rather than a locale-dependent parser.
    private static let whitespace = CharacterSet(charactersIn:
        "\u{0009}\u{000A}\u{000B}\u{000C}\u{000D} \u{00A0}\u{1680}\u{2000}\u{2001}\u{2002}\u{2003}\u{2004}\u{2005}\u{2006}\u{2007}\u{2008}\u{2009}\u{200A}\u{2028}\u{2029}\u{202F}\u{205F}\u{3000}\u{FEFF}")

    static func number(_ value: String) -> Double? {
        let text = value.trimmingCharacters(in: whitespace)
        if text.isEmpty { return 0 }
        for (prefix, radix) in [("0x", 16), ("0b", 2), ("0o", 8)] where text.lowercased().hasPrefix(prefix) {
            let digits = text.dropFirst(2)
            guard !digits.isEmpty else { return nil }
            var result = 0.0
            for character in digits {
                guard let digit = Int(String(character), radix: radix) else { return nil }
                result = result * Double(radix) + Double(digit)
            }
            return result.isFinite ? result : nil
        }
        guard text.range(of: #"^[+-]?(?:[0-9]+\.?[0-9]*|\.[0-9]+)(?:[eE][+-]?[0-9]+)?$"#,
                         options: .regularExpression) != nil,
              let result = Double(text), result.isFinite else { return nil }
        return result
    }

    static func display(properties: [String: AWCValue]) -> String {
        let value = properties["value"]?.string ?? ""
        guard properties["variant"]?.string != "small", !value.isEmpty else { return "" }
        let maximum = properties["max"]?.number ?? 999
        if let number = number(value), number > maximum { return formatted(maximum) + "+" }
        // String(decoding:) replaces a split surrogate with U+FFFD, matching the
        // browser's rendered text when slice(0,4) ends inside a surrogate pair.
        return String(decoding: value.utf16.prefix(4), as: UTF16.self)
    }

    static func visualText(_ text: String) -> String {
        // CSS white-space: nowrap still collapses ASCII whitespace. Keep the
        // original display value for accessibility; only the glyph run collapses.
        text.replacingOccurrences(of: "[\\t\\n\\r\u{000C} ]+", with: " ", options: .regularExpression)
            .trimmingCharacters(in: CharacterSet(charactersIn: " "))
    }

    static func formatted(_ number: Double) -> String {
        if number.isNaN { return "NaN" }
        if number == .infinity { return "Infinity" }
        if number == -.infinity { return "-Infinity" }
        if number == 0 { return "0" }
        let source = String(number).lowercased()
        guard let e = source.firstIndex(of: "e"), let exponent = Int(source[source.index(after: e)...]) else {
            return source.hasSuffix(".0") ? String(source.dropLast(2)) : source
        }
        var mantissa = String(source[..<e])
        if mantissa.hasSuffix(".0") { mantissa.removeLast(2) }
        if abs(number) >= 1e-6 && abs(number) < 1e21 {
            let negative = mantissa.hasPrefix("-")
            if negative { mantissa.removeFirst() }
            let parts = mantissa.split(separator: ".", omittingEmptySubsequences: false)
            let digits = parts.joined()
            let decimal = parts[0].count + exponent
            let expanded: String
            if decimal <= 0 { expanded = "0." + String(repeating: "0", count: -decimal) + digits }
            else if decimal >= digits.count { expanded = digits + String(repeating: "0", count: decimal - digits.count) }
            else { let index = digits.index(digits.startIndex, offsetBy: decimal); expanded = digits[..<index] + "." + digits[index...] }
            return (negative ? "-" : "") + expanded
        }
        return mantissa + "e" + (exponent >= 0 ? "+" : "") + String(exponent)
    }
}

struct AWCNativeBadgeMetrics {
    let small: Bool
    let height: CGFloat
    let iconSize: CGFloat
    let fontSize: CGFloat
    let padding: AWCBadgePadding
    let display: String
    let icon: String
    let children: [AWCNode]
    let accessibleLabel: String
    init(node: AWCNode, properties: [String: AWCValue], appearance: AWCBadgeAppearance, inheritedDensity: Double = 0) {
        let density = AWCNativeDensity.resolve(properties["density"]?.number, inherited: inheritedDensity)
        small = properties["variant"]?.string == "small"
        display = AWCNativeBadgeValue.display(properties: properties)
        children = small ? [] : node.children(inSlot: "icon").filter { $0.tag != "#text" }
        let authoredIcon = properties["icon"]?.string ?? ""
        icon = small || !children.isEmpty ? "" : authoredIcon
        height = CGFloat(small ? appearance.smallSize ?? max(4, 6 + density * 0.5) :
                            appearance.largeHeight ?? max(12, 16 + density))
        iconSize = CGFloat(appearance.iconSize ?? max(8, 10 + density * 0.5))
        fontSize = CGFloat(max(9, 11 + density * 0.5))
        let hasContent = !display.isEmpty || !authoredIcon.isEmpty || !children.isEmpty
        let inset = max(2, 4 + density * 0.5)
        padding = small || !hasContent ? .init() : appearance.largePadding ?? .init(right: inset, left: inset)
        accessibleLabel = small ? "notification" : !display.isEmpty ? display : authoredIcon
    }
}

private struct AWCNativeBadgeLayout: Layout {
    let metrics: AWCNativeBadgeMetrics
    let rtl: Bool
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        if metrics.small { return .init(width: metrics.height, height: metrics.height) }
        let width = subviews.reduce(CGFloat.zero) { $0 + $1.sizeThatFits(.unspecified).width }
        return .init(width: max(metrics.height, width + metrics.padding.left + metrics.padding.right),
                     height: max(metrics.height, metrics.padding.top + metrics.padding.bottom))
    }
    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let sizes = subviews.map { $0.sizeThatFits(.unspecified) }
        let width = sizes.reduce(CGFloat.zero) { $0 + $1.width }
        let padding = metrics.padding
        var x = bounds.minX + (rtl ? padding.right : padding.left) +
            (bounds.width - padding.left - padding.right - width) / 2
        let y = bounds.minY + padding.top + (bounds.height - padding.top - padding.bottom) / 2
        // SwiftUI mirrors logical layout coordinates in RTL.
        for (index, child) in subviews.enumerated() {
            child.place(at: .init(x: x, y: y), anchor: .leading, proposal: .init(sizes[index]))
            x += sizes[index].width
        }
    }
}

private struct AWCBadgeAnchorSizeKey: EnvironmentKey { static let defaultValue: CGSize? = nil }
struct AWCBadgeInspectionTarget {
    let nodeID: String
    let part: String
    let parentPart: String
}
private struct AWCBadgeInspectionTargetKey: EnvironmentKey { static let defaultValue: AWCBadgeInspectionTarget? = nil }
extension EnvironmentValues {
    var awcBadgeInspectionTarget: AWCBadgeInspectionTarget? {
        get { self[AWCBadgeInspectionTargetKey.self] }
        set { self[AWCBadgeInspectionTargetKey.self] = newValue }
    }
}
private extension EnvironmentValues {
    var awcBadgeAnchorSize: CGSize? {
        get { self[AWCBadgeAnchorSizeKey.self] }
        set { self[AWCBadgeAnchorSizeKey.self] = newValue }
    }
}

private struct AWCBadgeAnchorLayout: Layout {
    let parent: CGSize
    let circle: Bool
    let offsetX: AWCBadgeOffset
    let offsetY: AWCBadgeOffset
    let rtl: Bool
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize { parent }
    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        guard let badge = subviews.first else { return }
        let size = badge.sizeThatFits(.unspecified)
        let inset = circle ? 0.146447 : 0.0
        let physicalX = parent.width * (1 - inset) - size.width + offsetX.resolved(size.width)
        let physicalY = parent.height * inset + offsetY.resolved(size.height)
        // Preserve the source's physical right anchor even when content is RTL.
        let x = rtl ? parent.width - physicalX - size.width : physicalX
        badge.place(at: .init(x: bounds.minX + x, y: bounds.minY + physicalY),
                    anchor: .topLeading, proposal: .init(size))
    }
}

public extension View {
    /// Overlay badges using this view's actual bounds as their containing block.
    /// Badge shape/offset properties determine their positions; the parent keeps
    /// its intrinsic size and receives pointer events through the decorations.
    func awcBadgeOverlay<Badges: View>(@ViewBuilder content: @escaping () -> Badges) -> some View {
        overlay(alignment: .topLeading) {
            GeometryReader { geometry in
                content().environment(\.awcBadgeAnchorSize, geometry.size)
            }.allowsHitTesting(false)
        }
    }
}

struct AWCNativeBadgeView: View {
    let node: AWCNode
    let properties: [String: AWCValue]
    let theme: AWCTheme
    let child: (AWCNode) -> AnyView
    @Environment(\.awcBadgeAppearance) private var appearance
    @Environment(\.awcBadgeAnchorSize) private var anchorSize
    @Environment(\.layoutDirection) private var direction
    @Environment(\.awcBadgeInspectionTarget) private var inspectionTarget
    @Environment(\.awcNativeDensity) private var inheritedDensity
    private var resolvedDirection: LayoutDirection {
        properties["dir"]?.string == "rtl" ? .rightToLeft :
            properties["dir"]?.string == "ltr" ? .leftToRight : direction
    }

    @ViewBuilder var body: some View {
        if properties["hidden"]?.bool != true {
            if let anchorSize {
                AWCBadgeAnchorLayout(parent: anchorSize, circle: properties["shape"]?.string == "circle",
                    offsetX: appearance.offsetX ?? .init(fraction: 0.5),
                    offsetY: appearance.offsetY ?? .init(fraction: -0.5), rtl: resolvedDirection == .rightToLeft) { badge }
                    .environment(\.layoutDirection, resolvedDirection)
            } else { badge.environment(\.layoutDirection, resolvedDirection) }
        }
    }

    private var badge: some View {
        let m = AWCNativeBadgeMetrics(node: node, properties: properties, appearance: appearance, inheritedDensity: inheritedDensity)
        let labelColor = Color(awcHex: appearance.labelColor ?? theme.tokens["--md-sys-color-on-error"] ?? "#FFFFFF")
        let iconColor = Color(awcHex: appearance.iconColor ?? appearance.labelColor ?? theme.tokens["--md-sys-color-on-error"] ?? "#FFFFFF")
        let container = appearance.containerColor.map { Color(awcHex: $0) } ?? theme.error
        let weight = Double(theme.tokens["--md-sys-typescale-label-small-font-weight"] ?? "") ?? 500
        let tracking = Double((theme.tokens["--md-sys-typescale-label-small-letter-spacing"] ?? "").replacingOccurrences(of: "px", with: "")) ?? 0.5
        return AWCNativeBadgeLayout(metrics: m, rtl: resolvedDirection == .rightToLeft) {
            ForEach(m.children) { item in
                Group {
                    if item.tag == "#slot-text" { Text(item.properties["text"]?.string ?? "") }
                    else if item.tag == "#symbol" { AWCMaterialSymbol(item.properties["name"]?.string ?? "", size: m.iconSize) }
                    else { child(item) }
                }
                .font(AWCNativeFonts.label(size: m.iconSize, weight: weight)).tracking(tracking)
                .environment(\.awcMaterialSymbolSize, m.iconSize)
                .foregroundStyle(iconColor).frame(width: m.iconSize, height: m.iconSize)
                .awcInspect(nodeID: node.id, part: "slot.icon.\(item.id)", name: "Authored badge icon")
            }
            if !m.icon.isEmpty {
                AWCMaterialSymbol(m.icon, size: m.iconSize).foregroundStyle(iconColor)
                    .frame(width: m.iconSize, height: m.iconSize).accessibilityHidden(true)
                    .awcInspect(nodeID: node.id, part: "icon", name: "md-badge ::part(icon)")
            }
            if !m.display.isEmpty {
                Text(AWCNativeBadgeValue.visualText(m.display)).font(AWCNativeFonts.label(size: m.fontSize, weight: weight)).tracking(tracking)
                    .fixedSize().frame(height: AWCNativeBadgeValue.visualText(m.display).isEmpty ? 0 : m.fontSize).foregroundStyle(labelColor)
                    .awcInspect(nodeID: node.id, part: "label", name: "md-badge ::part(label)")
            }
        }
        .background(container, in: RoundedRectangle(cornerRadius: appearance.cornerRadius ?? 9999, style: .circular))
        .allowsHitTesting(false)
        .modifier(AWCBadgeAccessibility(label: m.accessibleLabel))
        .onChange(of: m.accessibleLabel) { _, value in
            if !value.isEmpty {
                var announcement = AttributedString(value)
                announcement.accessibilitySpeechAnnouncementPriority = .low
                AccessibilityNotification.Announcement(announcement).post()
            }
        }
        .awcInspect(nodeID: inspectionTarget?.nodeID ?? node.id, part: inspectionTarget?.part,
                    parentPart: inspectionTarget?.parentPart, name: "md-badge") { _ in
            var result:[String:AWCValue] = ["padding": [.number(m.padding.top), .number(m.padding.right), .number(m.padding.bottom), .number(m.padding.left)],
             "margin": [0, 0, 0, 0], "border": [0, 0, 0, 0],
             "direction": .string(resolvedDirection == .rightToLeft ? "rtl" : "ltr"), "display": "SwiftUI Layout"]
            if !m.small {result["typography"] = ["size": .number(m.fontSize), "lineHeight": .number(m.fontSize),
                            "weight": .number(weight), "spacing": .number(tracking),
                            "family": .string(AWCNativeFonts.labelFamily(regular: weight < 500)), "unit": "pt"]}
            return result
        }
    }
}

private struct AWCBadgeAccessibility: ViewModifier {
    let label: String
    @ViewBuilder func body(content: Content) -> some View {
        if label.isEmpty { content.accessibilityElement(children: .combine) }
        else { content.accessibilityElement(children: .ignore).accessibilityLabel(label) }
    }
}
