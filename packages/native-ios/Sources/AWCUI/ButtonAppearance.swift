import SwiftUI

/// Native md-button appearance, inherited by descendants and merged field by field.
/// Colors are #RRGGBB or #RRGGBBAA. Invalid values are ignored, so they cannot erase a valid
/// inherited value. Nil leaves the theme/source default in effect.
public struct AWCButtonAppearance: Equatable, Sendable {
    public let containerColor: String?
    public let labelColor: String?
    public let iconColor: String?
    public let trailingIconColor: String?
    public let loadingColor: String?
    public let stateLayerColor: String?
    public let outlineColor: String?
    public let iconSize: Double?
    public let trailingIconSize: Double?
    public let loadingSize: Double?
    public let fontSize: Double?
    public let fontWeight: Double?
    public let lineHeight: Double?
    public let letterSpacing: Double?
    public let cornerRadius: Double?
    public let outlineWidth: Double?
    public let paddingInline: Double?
    public let paddingBlock: Double?
    public let gap: Double?
    public let hoverOpacity: Double?
    public let focusOpacity: Double?
    public let pressedOpacity: Double?
    public let focusRingColor: String?
    /// Fixed state-layer opacity in every enabled state: the source `::part(state-layer) { opacity }` rule outranks the
    /// internal hover/focus/pressed rules. Nil keeps the per-state opacities.
    public let stateLayerOpacity: Double?
    public let width: Double?
    public let minWidth: Double?
    public let maxWidth: Double?
    public let height: Double?
    public let minHeight: Double?
    /// The focus ring's outline offset (CSS `outline-offset`, default 2px): md-date-picker's day and year cells use -1px.
    public let focusRingOffset: Double?

    public init(
        containerColor: String? = nil,
        labelColor: String? = nil,
        iconColor: String? = nil,
        trailingIconColor: String? = nil,
        loadingColor: String? = nil,
        stateLayerColor: String? = nil,
        outlineColor: String? = nil,
        iconSize: Double? = nil,
        trailingIconSize: Double? = nil,
        loadingSize: Double? = nil,
        fontSize: Double? = nil,
        fontWeight: Double? = nil,
        lineHeight: Double? = nil,
        letterSpacing: Double? = nil,
        cornerRadius: Double? = nil,
        outlineWidth: Double? = nil,
        paddingInline: Double? = nil,
        paddingBlock: Double? = nil,
        gap: Double? = nil,
        hoverOpacity: Double? = nil,
        focusOpacity: Double? = nil,
        pressedOpacity: Double? = nil,
        focusRingColor: String? = nil,
        width: Double? = nil,
        minWidth: Double? = nil,
        maxWidth: Double? = nil,
        height: Double? = nil,
        minHeight: Double? = nil,
        stateLayerOpacity: Double? = nil,
        focusRingOffset: Double? = nil
    ) {
        self.containerColor = Self.hex(containerColor)
        self.labelColor = Self.hex(labelColor)
        self.iconColor = Self.hex(iconColor)
        self.trailingIconColor = Self.hex(trailingIconColor)
        self.loadingColor = Self.hex(loadingColor)
        self.stateLayerColor = Self.hex(stateLayerColor)
        self.outlineColor = Self.hex(outlineColor)
        self.iconSize = Self.number(iconSize, 8...128)
        self.trailingIconSize = Self.number(trailingIconSize, 8...128)
        self.loadingSize = Self.number(loadingSize, 8...128)
        self.fontSize = Self.number(fontSize, 8...96)
        self.fontWeight = Self.number(fontWeight, 100...900, integer: true)
        self.lineHeight = Self.number(lineHeight, 8...160)
        self.letterSpacing = Self.number(letterSpacing, -5...20)
        self.cornerRadius = Self.number(cornerRadius, 0...200)
        self.outlineWidth = Self.number(outlineWidth, 0...16)
        self.paddingInline = Self.number(paddingInline, 0...128)
        self.paddingBlock = Self.number(paddingBlock, 0...128)
        self.gap = Self.number(gap, 0...64)
        self.hoverOpacity = Self.number(hoverOpacity, 0...1)
        self.focusOpacity = Self.number(focusOpacity, 0...1)
        self.pressedOpacity = Self.number(pressedOpacity, 0...1)
        self.focusRingColor = Self.hex(focusRingColor)
        self.width = Self.number(width, 0...2400)
        self.minWidth = Self.number(minWidth, 0...2400)
        self.maxWidth = Self.number(maxWidth, 0...2400)
        self.height = Self.number(height, 0...2400)
        self.minHeight = Self.number(minHeight, 0...2400)
        self.stateLayerOpacity = Self.number(stateLayerOpacity, 0...1)
        self.focusRingOffset = Self.number(focusRingOffset, -8...16)
    }

    /// Strict JSON values: booleans and numeric strings are not accepted as numbers.
    public init(values: [String: AWCValue]) {
        func text(_ key: String) -> String? {
            guard case .string(let value) = values[key] else { return nil }; return value
        }
        func number(_ key: String) -> Double? {
            guard case .number(let value) = values[key] else { return nil }; return value
        }
        self.init(
            containerColor: text("containerColor"),
            labelColor: text("labelColor"),
            iconColor: text("iconColor"),
            trailingIconColor: text("trailingIconColor"),
            loadingColor: text("loadingColor"),
            stateLayerColor: text("stateLayerColor"),
            outlineColor: text("outlineColor"),
            iconSize: number("iconSize"),
            trailingIconSize: number("trailingIconSize"),
            loadingSize: number("loadingSize"),
            fontSize: number("fontSize"),
            fontWeight: number("fontWeight"),
            lineHeight: number("lineHeight"),
            letterSpacing: number("letterSpacing"),
            cornerRadius: number("cornerRadius"),
            outlineWidth: number("outlineWidth"),
            paddingInline: number("paddingInline"),
            paddingBlock: number("paddingBlock"),
            gap: number("gap"),
            hoverOpacity: number("hoverOpacity"),
            focusOpacity: number("focusOpacity"),
            pressedOpacity: number("pressedOpacity"),
            focusRingColor: text("focusRingColor"),
            width: number("width"), minWidth: number("minWidth"), maxWidth: number("maxWidth"),
            height: number("height"), minHeight: number("minHeight"),
            stateLayerOpacity: number("stateLayerOpacity"),
            focusRingOffset: number("focusRingOffset")
        )
    }

    public func merging(_ local: AWCButtonAppearance) -> AWCButtonAppearance {
        .init(
            containerColor: local.containerColor ?? containerColor,
            labelColor: local.labelColor ?? labelColor,
            iconColor: local.iconColor ?? iconColor,
            trailingIconColor: local.trailingIconColor ?? trailingIconColor,
            loadingColor: local.loadingColor ?? loadingColor,
            stateLayerColor: local.stateLayerColor ?? stateLayerColor,
            outlineColor: local.outlineColor ?? outlineColor,
            iconSize: local.iconSize ?? iconSize,
            trailingIconSize: local.trailingIconSize ?? trailingIconSize,
            loadingSize: local.loadingSize ?? loadingSize,
            fontSize: local.fontSize ?? fontSize,
            fontWeight: local.fontWeight ?? fontWeight,
            lineHeight: local.lineHeight ?? lineHeight,
            letterSpacing: local.letterSpacing ?? letterSpacing,
            cornerRadius: local.cornerRadius ?? cornerRadius,
            outlineWidth: local.outlineWidth ?? outlineWidth,
            paddingInline: local.paddingInline ?? paddingInline,
            paddingBlock: local.paddingBlock ?? paddingBlock,
            gap: local.gap ?? gap,
            hoverOpacity: local.hoverOpacity ?? hoverOpacity,
            focusOpacity: local.focusOpacity ?? focusOpacity,
            pressedOpacity: local.pressedOpacity ?? pressedOpacity,
            focusRingColor: local.focusRingColor ?? focusRingColor,
            width: local.width ?? width, minWidth: local.minWidth ?? minWidth, maxWidth: local.maxWidth ?? maxWidth,
            height: local.height ?? height, minHeight: local.minHeight ?? minHeight,
            stateLayerOpacity: local.stateLayerOpacity ?? stateLayerOpacity,
            focusRingOffset: local.focusRingOffset ?? focusRingOffset
        )
    }

    private static func hex(_ value: String?) -> String? {
        guard let value, (value.utf8.count == 7 || value.utf8.count == 9), value.first == "#",
              value.dropFirst().utf8.allSatisfy({ (48...57).contains($0) || (65...70).contains($0) || (97...102).contains($0) }) else { return nil }
        return value.uppercased()
    }
    private static func number(_ value: Double?, _ range: ClosedRange<Double>, integer: Bool = false) -> Double? {
        guard let value, value.isFinite, range.contains(value), !integer || value.rounded() == value else { return nil }
        return value
    }
}

private struct AWCButtonAppearanceKey: EnvironmentKey {
    static let defaultValue = AWCButtonAppearance()
}

public extension EnvironmentValues {
    var awcButtonAppearance: AWCButtonAppearance {
        get { self[AWCButtonAppearanceKey.self] }
        set { self[AWCButtonAppearanceKey.self] = newValue }
    }
}

private struct AWCButtonAppearanceModifier: ViewModifier {
    @Environment(\.awcButtonAppearance) private var inherited
    let appearance: AWCButtonAppearance
    func body(content: Content) -> some View {
        content.environment(\.awcButtonAppearance, inherited.merging(appearance))
    }
}

public extension View {
    /// Apply defaults to an app subtree, or fieldwise overrides to one AWCButton.
    func awcButtonAppearance(_ appearance: AWCButtonAppearance) -> some View {
        modifier(AWCButtonAppearanceModifier(appearance: appearance))
    }
}
