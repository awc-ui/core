import SwiftUI

/// md-avatar lengths (`--md-avatar-size`, label/icon sizes, letter spacing, outline width):
/// px, %, em, rem and ch with additive calc(). em and % resolve against the avatar's
/// inherited font size (16 by default), as in the source's custom-property cascade.
public typealias AWCAvatarLength = AWCSkeletonLength

/// The public md-avatar hooks (`--md-avatar-*`), including the fourteen tonal palette
/// hooks `--md-avatar-palette-{1…7}-container/label`. Unset fields keep the size,
/// shape, palette and theme defaults. As in the source, a resolved name palette wins over
/// `containerColor`/`labelColor`; those apply to neutral avatars (`colorFromName == false`
/// or no seed). Palette hooks replace only their own bucket.
public struct AWCAvatarAppearance: Equatable, Sendable {
    public let size: AWCAvatarLength?, containerColor: String?, containerShape: AWCCornerShape?, labelColor: String?
    public let labelFontFamily: String?, labelFontSize: AWCAvatarLength?, labelFontWeight: Double?, labelLetterSpacing: AWCAvatarLength?
    public let iconSize: AWCAvatarLength?, outlineColor: String?, outlineWidth: AWCAvatarLength?
    /// The palette hooks by bucket (1…7) → `#RRGGBB[AA]`, as set through `palette{N}Container` / `palette{N}Label`.
    public let paletteContainerColors: [Int: String], paletteLabelColors: [Int: String]
    /// One labelled field per source hook: the eleven hooks, then `--md-avatar-palette-{1…7}-container/label`.
    public init(size: AWCAvatarLength? = nil, containerColor: String? = nil, containerShape: AWCCornerShape? = nil, labelColor: String? = nil,
                labelFontFamily: String? = nil, labelFontSize: AWCAvatarLength? = nil, labelFontWeight: Double? = nil, labelLetterSpacing: AWCAvatarLength? = nil,
                iconSize: AWCAvatarLength? = nil, outlineColor: String? = nil, outlineWidth: AWCAvatarLength? = nil,
                palette1Container: String? = nil, palette1Label: String? = nil, palette2Container: String? = nil, palette2Label: String? = nil, palette3Container: String? = nil, palette3Label: String? = nil, palette4Container: String? = nil, palette4Label: String? = nil, palette5Container: String? = nil, palette5Label: String? = nil, palette6Container: String? = nil, palette6Label: String? = nil, palette7Container: String? = nil, palette7Label: String? = nil) {
        let containers: [Int: String?] = [1: palette1Container, 2: palette2Container, 3: palette3Container, 4: palette4Container, 5: palette5Container, 6: palette6Container, 7: palette7Container]
        let labels: [Int: String?] = [1: palette1Label, 2: palette2Label, 3: palette3Label, 4: palette4Label, 5: palette5Label, 6: palette6Label, 7: palette7Label]
        self.init(size: size, containerColor: containerColor, containerShape: containerShape, labelColor: labelColor, labelFontFamily: labelFontFamily, labelFontSize: labelFontSize,
                  labelFontWeight: labelFontWeight, labelLetterSpacing: labelLetterSpacing, iconSize: iconSize, outlineColor: outlineColor, outlineWidth: outlineWidth,
                  containers: containers.compactMapValues { $0 }, labels: labels.compactMapValues { $0 })
    }
    private init(size: AWCAvatarLength?, containerColor: String?, containerShape: AWCCornerShape?, labelColor: String?,
                 labelFontFamily: String?, labelFontSize: AWCAvatarLength?, labelFontWeight: Double?, labelLetterSpacing: AWCAvatarLength?,
                 iconSize: AWCAvatarLength?, outlineColor: String?, outlineWidth: AWCAvatarLength?, containers paletteContainerColors: [Int: String], labels paletteLabelColors: [Int: String]) {
        func length(_ l: AWCAvatarLength?) -> AWCAvatarLength? { l.flatMap { $0.valid ? $0 : nil } }
        self.size = length(size); self.containerColor = awcCardColor(containerColor); self.containerShape = containerShape.flatMap { $0.valid ? $0 : nil }
        self.labelColor = awcCardColor(labelColor)
        let family = labelFontFamily?.trimmingCharacters(in: .whitespacesAndNewlines)
        self.labelFontFamily = family?.isEmpty == false ? family : nil
        self.labelFontSize = length(labelFontSize); self.labelFontWeight = labelFontWeight.flatMap { $0.isFinite && $0 >= 1 && $0 <= 1000 ? $0 : nil }
        self.labelLetterSpacing = length(labelLetterSpacing); self.iconSize = length(iconSize)
        self.outlineColor = awcCardColor(outlineColor); self.outlineWidth = length(outlineWidth)
        func palette(_ p: [Int: String]) -> [Int: String] { p.reduce(into: [:]) { r, e in if (1...7).contains(e.key), let c = awcCardColor(e.value) { r[e.key] = c } } }
        self.paletteContainerColors = palette(paletteContainerColors); self.paletteLabelColors = palette(paletteLabelColors)
    }
    /// Keys: the field names above, plus `palette{N}Container` / `palette{N}Label` (N = 1…7).
    public init(values: [String: AWCValue]) {
        func text(_ k: String) -> String? { values[k]?.string.isEmpty == false ? values[k]?.string : nil }
        func length(_ k: String) -> AWCAvatarLength? { guard case .object(let v) = values[k] else { return nil }; return AWCAvatarLength(values: v) }
        func shape(_ k: String) -> AWCCornerShape? { guard case .object(let v) = values[k] else { return nil }; return AWCCornerShape(values: v) }
        var containers: [Int: String] = [:], labels: [Int: String] = [:]
        for n in 1...7 { if let c = text("palette\(n)Container") { containers[n] = c }; if let l = text("palette\(n)Label") { labels[n] = l } }
        self.init(size: length("size"), containerColor: text("containerColor"), containerShape: shape("containerShape"), labelColor: text("labelColor"),
                  labelFontFamily: text("labelFontFamily"), labelFontSize: length("labelFontSize"), labelFontWeight: values["labelFontWeight"]?.number,
                  labelLetterSpacing: length("labelLetterSpacing"), iconSize: length("iconSize"), outlineColor: text("outlineColor"), outlineWidth: length("outlineWidth"),
                  containers: containers, labels: labels)
    }
    public func merging(_ o: Self) -> Self {
        .init(size: o.size ?? size, containerColor: o.containerColor ?? containerColor, containerShape: o.containerShape ?? containerShape, labelColor: o.labelColor ?? labelColor,
              labelFontFamily: o.labelFontFamily ?? labelFontFamily, labelFontSize: o.labelFontSize ?? labelFontSize, labelFontWeight: o.labelFontWeight ?? labelFontWeight,
              labelLetterSpacing: o.labelLetterSpacing ?? labelLetterSpacing, iconSize: o.iconSize ?? iconSize, outlineColor: o.outlineColor ?? outlineColor, outlineWidth: o.outlineWidth ?? outlineWidth,
              containers: paletteContainerColors.merging(o.paletteContainerColors) { $1 }, labels: paletteLabelColors.merging(o.paletteLabelColors) { $1 })
    }
}

/// `::part(image)`, `::part(initials)` and `::part(icon)` styling. Part rules come from the
/// outer tree, so they win over the hooks. The icon part's font size changes the glyph only;
/// its box keeps `--md-avatar-icon-size`, as in the source.
public struct AWCAvatarPartAppearance: Equatable, Sendable {
    public let initialsColor: String?, initialsFontSize: AWCAvatarLength?, initialsFontWeight: Double?, initialsLetterSpacing: AWCAvatarLength?
    public let iconColor: String?, iconFontSize: AWCAvatarLength?
    /// `object-position` as fractions of the free space (0 = left/top, 0.5 = center), and `opacity`.
    public let imagePositionX: Double?, imagePositionY: Double?, imageOpacity: Double?
    public init(initialsColor: String? = nil, initialsFontSize: AWCAvatarLength? = nil, initialsFontWeight: Double? = nil, initialsLetterSpacing: AWCAvatarLength? = nil,
                iconColor: String? = nil, iconFontSize: AWCAvatarLength? = nil, imagePositionX: Double? = nil, imagePositionY: Double? = nil, imageOpacity: Double? = nil) {
        func length(_ l: AWCAvatarLength?) -> AWCAvatarLength? { l.flatMap { $0.valid ? $0 : nil } }
        func unit(_ v: Double?) -> Double? { v.flatMap { $0.isFinite ? $0 : nil } }
        self.initialsColor = awcCardColor(initialsColor); self.initialsFontSize = length(initialsFontSize)
        self.initialsFontWeight = initialsFontWeight.flatMap { $0.isFinite && $0 >= 1 && $0 <= 1000 ? $0 : nil }; self.initialsLetterSpacing = length(initialsLetterSpacing)
        self.iconColor = awcCardColor(iconColor); self.iconFontSize = length(iconFontSize)
        self.imagePositionX = unit(imagePositionX); self.imagePositionY = unit(imagePositionY); self.imageOpacity = unit(imageOpacity).map { min(1, max(0, $0)) }
    }
    public init(values: [String: AWCValue]) {
        func length(_ k: String) -> AWCAvatarLength? { guard case .object(let v) = values[k] else { return nil }; return AWCAvatarLength(values: v) }
        self.init(initialsColor: values["initialsColor"]?.string, initialsFontSize: length("initialsFontSize"), initialsFontWeight: values["initialsFontWeight"]?.number,
                  initialsLetterSpacing: length("initialsLetterSpacing"), iconColor: values["iconColor"]?.string, iconFontSize: length("iconFontSize"),
                  imagePositionX: values["imagePositionX"]?.number, imagePositionY: values["imagePositionY"]?.number, imageOpacity: values["imageOpacity"]?.number)
    }
    public func merging(_ o: Self) -> Self {
        .init(initialsColor: o.initialsColor ?? initialsColor, initialsFontSize: o.initialsFontSize ?? initialsFontSize, initialsFontWeight: o.initialsFontWeight ?? initialsFontWeight,
              initialsLetterSpacing: o.initialsLetterSpacing ?? initialsLetterSpacing, iconColor: o.iconColor ?? iconColor, iconFontSize: o.iconFontSize ?? iconFontSize,
              imagePositionX: o.imagePositionX ?? imagePositionX, imagePositionY: o.imagePositionY ?? imagePositionY, imageOpacity: o.imageOpacity ?? imageOpacity)
    }
}

private struct AWCAvatarAppearanceKey: EnvironmentKey { static let defaultValue = AWCAvatarAppearance() }
private struct AWCAvatarAppearanceTargetsKey: EnvironmentKey { static let defaultValue: [String: AWCAvatarAppearance] = [:] }
private struct AWCAvatarPartAppearanceKey: EnvironmentKey { static let defaultValue = AWCAvatarPartAppearance() }
private struct AWCAvatarPartAppearanceTargetsKey: EnvironmentKey { static let defaultValue: [String: AWCAvatarPartAppearance] = [:] }
private struct AWCAvatarViewportKey: EnvironmentKey { static let defaultValue: CGSize? = nil }
extension EnvironmentValues {
    var awcAvatarAppearance: AWCAvatarAppearance { get { self[AWCAvatarAppearanceKey.self] } set { self[AWCAvatarAppearanceKey.self] = newValue } }
    var awcAvatarAppearanceTargets: [String: AWCAvatarAppearance] { get { self[AWCAvatarAppearanceTargetsKey.self] } set { self[AWCAvatarAppearanceTargetsKey.self] = newValue } }
    var awcAvatarPartAppearance: AWCAvatarPartAppearance { get { self[AWCAvatarPartAppearanceKey.self] } set { self[AWCAvatarPartAppearanceKey.self] = newValue } }
    var awcAvatarPartAppearanceTargets: [String: AWCAvatarPartAppearance] { get { self[AWCAvatarPartAppearanceTargetsKey.self] } set { self[AWCAvatarPartAppearanceTargetsKey.self] = newValue } }
    /// Viewport for `vw`/`vh`/`vmin`/`vmax` sizes; nil uses the window.
    var awcAvatarViewport: CGSize? { get { self[AWCAvatarViewportKey.self] } set { self[AWCAvatarViewportKey.self] = newValue } }
}
private struct AWCAvatarAppearanceModifier: ViewModifier {
    let value: AWCAvatarAppearance, id: String?
    @Environment(\.awcAvatarAppearance) private var inherited
    @Environment(\.awcAvatarAppearanceTargets) private var targets
    func body(content: Content) -> some View {
        if let id { var t = targets; t[id] = (t[id] ?? .init()).merging(value); return AnyView(content.environment(\.awcAvatarAppearanceTargets, t)) }
        return AnyView(content.environment(\.awcAvatarAppearance, inherited.merging(value)))
    }
}
private struct AWCAvatarPartAppearanceModifier: ViewModifier {
    let value: AWCAvatarPartAppearance, id: String?
    @Environment(\.awcAvatarPartAppearance) private var inherited
    @Environment(\.awcAvatarPartAppearanceTargets) private var targets
    func body(content: Content) -> some View {
        if let id { var t = targets; t[id] = (t[id] ?? .init()).merging(value); return AnyView(content.environment(\.awcAvatarPartAppearanceTargets, t)) }
        return AnyView(content.environment(\.awcAvatarPartAppearance, inherited.merging(value)))
    }
}
public extension View {
    /// Applies md-avatar hook values to descendant avatars, or to the avatar with `id`.
    func awcAvatarAppearance(_ value: AWCAvatarAppearance, for id: String? = nil) -> some View { modifier(AWCAvatarAppearanceModifier(value: value, id: id)) }
    /// Applies `::part(image|initials|icon)` styling to descendant avatars, or to the avatar with `id`.
    func awcAvatarPartAppearance(_ value: AWCAvatarPartAppearance, for id: String? = nil) -> some View { modifier(AWCAvatarPartAppearanceModifier(value: value, id: id)) }
    /// Declares the viewport that `vw`/`vh` avatar sizes resolve against.
    func awcAvatarViewport(_ size: CGSize?) -> some View { environment(\.awcAvatarViewport, size) }
}
