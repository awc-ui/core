import SwiftUI
import QuartzCore
#if canImport(AppKit)
import AppKit
#else
import UIKit
#endif

// MARK: Source model

/// md-list-item's property and class logic (md-list-item.tsx getters and render()).
struct AWCListItemModel: Equatable {
    var type = "text", headline = "", overline = "", supportingText = "", trailingSupportingText = ""
    var leadingIcon = "", trailingIcon = "", leadingAvatar = "", leadingAvatarAlt = "", leadingAvatarName = "", leadingAvatarLabel = ""
    var leadingImage = "", leadingImageAlt = "", href = "", target = "_self"
    var lines = 1.0, disabled = false, softDisabled = false, selected = false, expandable = false, expanded = false
    var hidden = false, density: Double? = nil, rovingFocusVisible = false
    init(properties p: [String: AWCValue]) {
        func s(_ k: String) -> String { p[k]?.string ?? "" }
        type = p["type"]?.string ?? "text"
        headline = s("headline"); overline = s("overline"); supportingText = s("supportingText"); trailingSupportingText = s("trailingSupportingText")
        leadingIcon = s("leadingIcon"); trailingIcon = s("trailingIcon"); leadingAvatar = s("leadingAvatar"); leadingAvatarAlt = s("leadingAvatarAlt")
        leadingAvatarName = s("leadingAvatarName"); leadingAvatarLabel = s("leadingAvatarLabel"); leadingImage = s("leadingImage"); leadingImageAlt = s("leadingImageAlt")
        href = s("href"); target = p["target"]?.string ?? "_self"
        let l = p["lines"]?.number ?? 1; lines = [1.0, 2, 3].contains(l) ? l : 1
        disabled = p["disabled"]?.bool ?? false; softDisabled = p["softDisabled"]?.bool ?? false
        selected = p["selected"]?.bool ?? false; expandable = p["expandable"]?.bool ?? false; expanded = p["expanded"]?.bool ?? false
        hidden = p["hidden"]?.bool ?? false; density = p["density"]?.number; rovingFocusVisible = p["rovingFocusVisible"]?.bool ?? false
    }
    var hasAvatar: Bool { !leadingAvatar.isEmpty || !leadingAvatarLabel.isEmpty || !leadingAvatarName.isEmpty }
}

/// Pseudo-class and class inputs of the item cascade.
struct AWCListItemStates: Equatable, Hashable {
    var hover = false, active = false, pressed = false, focusVisible = false, roving = false, dragged = false
}

/// md-list-item.css resolved rule by rule (specificity, then source order).
struct AWCListItemStyle {
    let model: AWCListItemModel, ctx: AWCListItemContext?, inline: AWCListItemAppearance, inherited: AWCListItemAppearance
    let tokens: [String: String], rtl: Bool, density: Double, rung: Double, selected: Bool, expanded: Bool
    let slottedOverline: Bool, slottedSupporting: Bool, leadingVideo: Bool, morph: Bool
    var a: AWCListItemAppearance { inherited.merging(inline) }
    func color(_ name: String, _ fallback: String) -> String { tokens["--md-sys-color-" + name] ?? fallback }
    static func mix(_ hex: String, _ alpha: Double) -> String {
        let c = Color(awcHex: hex).resolve(in: EnvironmentValues())
        return String(format: "#%02X%02X%02X%02X", Int((Double(c.red) * 255).rounded()), Int((Double(c.green) * 255).rounded()), Int((Double(c.blue) * 255).rounded()), Int((Double(c.opacity) * alpha * 255).rounded()))
    }
    var inList: Bool { ctx?.hostList ?? false }
    var inSelection: Bool { ctx?.inSelectionMode ?? false }
    var participates: Bool { inSelection && !model.expandable && !(ctx?.inPanel ?? false) }
    var interactive: Bool { !model.disabled && (model.type != "text" || inSelection || model.expandable) }
    var disabledClass: Bool { model.disabled || model.softDisabled }
    var selectedClass: Bool { selected && !model.expandable }
    var reorderable: Bool { ctx?.reorderable ?? false }
    var lines: Int {
        if model.lines != 1 { return Int(model.lines) }
        let o = !model.overline.isEmpty || slottedOverline, s = !model.supportingText.isEmpty || slottedSupporting
        return o && s ? 3 : (o || s ? 2 : 1)
    }
    var hasPrimaryAction: Bool { !participates && !reorderable && !(["menu", "menubar"].contains(ctx?.containerRole ?? "")) && (model.type == "button" || model.type == "link") }
    var expandableOnly: Bool { model.expandable && !participates && model.type == "text" }
    var focusable: Bool { (interactive && !expandableOnly) || reorderable }
    /// A stop of its list's roving focus (md-list isItemFocusable): in a selection list an expandable-only row is one too.
    var rovingFocusable: Bool { inList && !(ctx?.inPanel ?? false) ? !model.disabled && (inSelection || reorderable || model.type != "text") : focusable }
    var onSurface: String { color("on-surface", "#1C1B1F") }
    var disabledInk: String { Self.mix(onSurface, 0.38) }
    var selectedLabel: String { a.selectedLabelTextColor ?? color("on-secondary-container", "#4A4458") }
    // Colors
    var containerColor: String {
        if selectedClass && disabledClass { return a.selectedDisabledContainerColor ?? Self.mix(onSurface, 0.12) }
        if selectedClass { return a.selectedContainerColor ?? color("secondary-container", "#E8DEF8") }
        return a.containerColor ?? color("surface", "#FEF7FF")
    }
    var labelColor: String { disabledClass ? disabledInk : selectedClass ? selectedLabel : a.labelTextColor ?? onSurface }
    var supportingColor: String { disabledClass ? disabledInk : selectedClass ? selectedLabel : a.supportingTextColor ?? color("on-surface-variant", "#49454F") }
    var overlineColor: String { disabledClass ? disabledInk : selectedClass ? selectedLabel : a.overlineColor ?? color("on-surface-variant", "#49454F") }
    var trailingTextColor: String { disabledClass ? disabledInk : selectedClass ? selectedLabel : a.trailingSupportingTextColor ?? color("on-surface-variant", "#49454F") }
    func isActive(_ s: AWCListItemStates) -> Bool { interactive && (s.hover || s.focusVisible || s.roving || s.active || s.pressed || s.dragged) }
    func leadingIconColor(_ s: AWCListItemStates) -> String {
        if disabledClass { return disabledInk }
        if selectedClass && (isActive(s) || (s.pressed || s.dragged)) { return a.selectedActiveIconColor ?? color("on-surface", "#1D1B20") }
        if selectedClass { return selectedLabel }
        return a.leadingIconColor ?? color("on-surface-variant", "#49454F")
    }
    func trailingIconColor(_ s: AWCListItemStates) -> String {
        if disabledClass { return disabledInk }
        if selectedClass && (isActive(s) || (s.pressed || s.dragged)) { return a.selectedActiveIconColor ?? color("on-surface", "#1D1B20") }
        if selectedClass { return selectedLabel }
        if participates { return a.unselectedTrailingIconColor ?? color("on-surface", "#1D1B20") }
        return a.trailingIconColor ?? color("on-surface-variant", "#49454F")
    }
    var chevronColor: String { disabledClass ? disabledInk : a.expandChevronColor ?? color("on-surface-variant", "#49454F") }
    var stateLayerColor: String { selectedClass ? selectedLabel : onSurface }
    var layerVisible: Bool { interactive && !model.softDisabled }
    func layerOpacity(_ s: AWCListItemStates) -> Double {
        guard interactive else { return 0 }
        if s.active { return a.pressedStateLayerOpacity ?? 0.1 }
        if s.roving { return a.focusStateLayerOpacity ?? 0.1 }
        if s.hover { return a.hoverStateLayerOpacity ?? 0.08 }
        if s.focusVisible { return a.focusStateLayerOpacity ?? 0.1 }
        if disabledClass { return a.disabledStateLayerOpacity ?? 0 }
        if s.dragged { return a.draggedStateLayerOpacity ?? 0.16 }
        if s.pressed { return a.pressedStateLayerOpacity ?? 0.1 }
        return 0
    }
    func focusRing(_ s: AWCListItemStates) -> Bool { interactive && (s.focusVisible || s.roving) }
    // Corners (logical start-start, start-end, end-start, end-end)
    var restCorners: [Double] {
        let segmented = ctx?.listStyle == "segmented"
        let panel = ctx?.inPanel ?? false
        func shorthand(_ s: AWCCornerShape?) -> Double? { s.map { $0.topLeft.x.points } }
        var listShorthand: Double? = nil
        if let ctx { listShorthand = panel ? 0 : (ctx.listStyle == "segmented" ? 4 : 0) }
        let containerShape = shorthand(inline.containerShape) ?? listShorthand ?? shorthand(inherited.containerShape) ?? (segmented ? 4 : 0)
        // ::slotted per-position rules from the list (or the parent row's panel).
        var slotted: [Double?] = [nil, nil, nil, nil]
        if let ctx {
            if panel {
                slotted = [0, 0, 0, 0]
                if ctx.lastInLastExpanded { slotted[2] = 16; slotted[3] = 16 }
            } else {
                if ctx.first { slotted[0] = 16; slotted[1] = 16 }
                if ctx.last { slotted[2] = 16; slotted[3] = 16 }
            }
        }
        // The row's own :host rules (expanded rows square their end corners).
        var host: [Double?] = [nil, nil, nil, nil]
        if model.expandable && expanded { host[2] = 0; host[3] = 0 }
        let own = [inline.containerShapeStartStart, inline.containerShapeStartEnd, inline.containerShapeEndStart, inline.containerShapeEndEnd]
        let inh = [inherited.containerShapeStartStart, inherited.containerShapeStartEnd, inherited.containerShapeEndStart, inherited.containerShapeEndEnd]
        return (0..<4).map { own[$0] ?? slotted[$0] ?? host[$0] ?? inh[$0] ?? containerShape }
    }
    /// The row's own `--_container-shape-*` corners (inline, inherited, shorthand): no ::slotted or :host rules.
    var ownCorners: [Double] {
        func shorthand(_ s: AWCCornerShape?) -> Double? { s.map { $0.topLeft.x.points } }
        let containerShape = shorthand(inline.containerShape) ?? shorthand(inherited.containerShape) ?? 0
        let own = [inline.containerShapeStartStart, inline.containerShapeStartEnd, inline.containerShapeEndStart, inline.containerShapeEndEnd]
        let inh = [inherited.containerShapeStartStart, inherited.containerShapeStartEnd, inherited.containerShapeEndStart, inherited.containerShapeEndEnd]
        return (0..<4).map { own[$0] ?? inh[$0] ?? containerShape }
    }
    func stateShape(_ s: AWCListItemStates) -> Double? {
        let active = a.activeContainerShape
        let m = morph ? 1.0 : 0
        if s.roving && interactive { return (a.focusContainerShape ?? active ?? 16) * m }
        if s.active && interactive { return (a.pressedContainerShape ?? active ?? 16) * m }
        if s.focusVisible && interactive { return (a.focusContainerShape ?? active ?? 16) * m }
        if s.dragged { return a.draggedContainerShape ?? active ?? 16 }
        if s.pressed { return (a.pressedContainerShape ?? active ?? 16) * m }
        if selectedClass { return (a.selectedContainerShape ?? active ?? 16) * m }
        return nil
    }
    func corners(_ s: AWCListItemStates) -> [Double] {
        let rest = restCorners
        guard let shape = stateShape(s) else { return rest }
        return rest.map { max($0, shape) }
    }
    /// [topLeft, topRight, bottomRight, bottomLeft] from logical corners.
    func physical(_ c: [Double]) -> [Double] { rtl ? [c[1], c[0], c[2], c[3]] : [c[0], c[1], c[3], c[2]] }
    // Metrics
    func insetLg(_ r: Double) -> Double { r <= -4 ? 8 : r <= -2 ? 12 : 16 }
    var leadingIconSize: Double { a.leadingIconSize ?? (inList ? (a.leadingIconExpressiveSize ?? max(16, 20 + density)) : max(18, 24 + density)) }
    var trailingIconSize: Double { a.trailingIconSize ?? (inList ? (a.trailingIconExpressiveSize ?? max(16, 20 + density)) : max(18, 24 + density)) }
    var imageShape: Double { a.leadingImageShape ?? (inList ? (a.leadingImageExpressiveShape ?? 8) : 0) }
    var padding: (top: Double, bottom: Double, start: Double, end: Double) {
        var top = a.topSpace ?? max(2, 8 + density * 1.5), bottom = a.bottomSpace ?? max(2, 8 + density * 1.5)
        if leadingVideo { top = a.leadingVideoTopSpace ?? max(4, 12 + density * 2); bottom = max(4, 12 + density * 2) }
        if lines == 3 { top = a.threeLineTopSpace ?? max(2, 12 + density * 2.5); bottom = a.threeLineBottomSpace ?? max(2, 12 + density * 2.5) }
        let start = !model.leadingImage.isEmpty ? 16 : a.leadingSpace ?? insetLg(rung)
        return (top, bottom, start, a.trailingSpace ?? insetLg(rung))
    }
    var gap: Double { a.betweenSpace ?? max(8, rung <= -2 ? 8 : 12) }
    var minHeight: Double { lines == 1 ? 56 + density * 4 : (lines == 2 ? 72 : 88) + density * 6 }
    var headlineSize: Double { max(13, 16 + density * 0.5) }
    var headlineLine: Double { max(18, 24 + density) }
    var supportingSize: Double { max(11, 14 + density * 0.5) }
    var supportingLine: Double { max(16, 20 + density) }
}

// MARK: Text

/// CSS line box: each line is `lineHeight` tall with the glyph run centred in it (half-leading),
/// ellipsis after `lines` lines.
struct AWCListText: View {
    let text: String, size: Double, lineHeight: Double, weight: Double, tracking: Double, color: Color
    var family: String? = nil, lines = 1, uppercase = false, clip = false, alignment: TextAlignment = .leading
    /// Reports whether the laid-out text is clipped (the source's scroll vs client size check).
    var onTruncation: ((Bool) -> Void)? = nil
    var font: Font {
        if let family = family?.lowercased() {
            // Chrome's generic families on Apple platforms (the oracle's measured advances).
            if family.contains("monospace") { return .custom("Courier", fixedSize: size) }
            #if os(macOS)
            if family.contains("serif") && !family.contains("sans") { return .custom("Times", fixedSize: size) }
            #else
            if family.contains("serif") && !family.contains("sans") { return .custom("Times New Roman", fixedSize: size) }
            #endif
        }
        return AWCNativeFonts.label(size: size, weight: weight)
    }
    var body: some View {
        let shown = uppercase ? text.uppercased() : text
        AWCListLineBox(lineHeight: lineHeight, lines: lines) {
            Text(shown).font(font).tracking(tracking).foregroundStyle(color).lineLimit(lines).truncationMode(.tail).multilineTextAlignment(alignment)
                .lineSpacing(lines > 1 ? max(0, lineHeight - size * 1.171875) : 0)
            Text("Ag").font(font).lineLimit(1).hidden()
        }
        .background(alignment: .topLeading) {
            if let onTruncation {
                GeometryReader { box in
                    Text(shown).font(font).tracking(tracking).multilineTextAlignment(alignment)
                        .lineSpacing(lines > 1 ? max(0, lineHeight - size * 1.171875) : 0)
                        .frame(width: box.size.width, alignment: .leading).fixedSize(horizontal: false, vertical: true).hidden()
                        .onGeometryChange(for: Bool.self) { $0.size.height > box.size.height + 0.5 } action: { onTruncation($0) }
                }.allowsHitTesting(false).accessibilityHidden(true)
            }
        }
    }
}
/// Sizes the text to whole CSS line boxes: n lines (as laid out, at most `lines`) × lineHeight.
struct AWCListLineBox: Layout {
    let lineHeight: Double, lines: Int
    func metrics(_ proposal: ProposedViewSize, _ subviews: Subviews) -> (CGSize, Double, Int) {
        let probe = Double(subviews[1].sizeThatFits(.unspecified).height)
        let text = subviews[0].sizeThatFits(.init(width: proposal.width, height: nil))
        var n = 1
        if lines > 1 { let spacing = max(0, lineHeight - probe); n = max(1, min(lines, Int(((Double(text.height) + spacing) / (probe + spacing)).rounded()))) }
        let width = proposal.width.flatMap { $0.isFinite ? $0 : nil } ?? text.width
        return (CGSize(width: width, height: Double(n) * lineHeight), probe, n)
    }
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize { metrics(proposal, subviews).0 }
    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let (_, probe, _) = metrics(.init(width: bounds.width, height: nil), subviews)
        subviews[0].place(at: .init(x: bounds.minX, y: bounds.minY + (lineHeight - probe) / 2), anchor: .topLeading, proposal: .init(width: bounds.width, height: nil))
        subviews[1].place(at: bounds.origin, anchor: .topLeading, proposal: .unspecified)
    }
}

/// Material Symbols ligature glyph in a `size` square (FILL axis for expanded rows).
struct AWCListGlyph: View {
    let name: String, size: Double, color: Color
    var fill = 0.0, glyphSize: Double? = nil
    var body: some View {
        Text(name).font(Font(AWCNativeFonts.accordionSymbol(size: glyphSize ?? size, fill: fill))).foregroundStyle(color).accessibilityHidden(true)
            .lineLimit(1).fixedSize().frame(width: size, height: size).environment(\.layoutDirection, .leftToRight)
            // Decorative: the glyph's ligature name ("folder") is not content.
            .accessibilityElement(children: .ignore).accessibilityHidden(true)
    }
}

/// Decoded `data:` image (oracle swatches) or a remote image.
struct AWCListImage: View {
    let source: String
    /// The image failed to load (the `<img>` `error` event).
    var onFailure: (() -> Void)? = nil
    /// A `data:` source that does not decode to an image fails at once (Chrome: `error`).
    static func undecodable(_ source: String) -> Bool {
        guard source.hasPrefix("data:") else { return false }
        guard let comma = source.firstIndex(of: ","), let data = Data(base64Encoded: String(source[source.index(after: comma)...])) else { return true }
        #if canImport(AppKit)
        return NSImage(data: data) == nil
        #else
        return UIImage(data: data) == nil
        #endif
    }
    var body: some View {
        if source.hasPrefix("data:"), let comma = source.firstIndex(of: ","), let data = Data(base64Encoded: String(source[source.index(after: comma)...])) {
            #if canImport(AppKit)
            if let image = NSImage(data: data) { Image(nsImage: image).resizable().interpolation(.none).aspectRatio(contentMode: .fill) } else { Color.clear }
            #else
            if let image = UIImage(data: data) { Image(uiImage: image).resizable().interpolation(.none).aspectRatio(contentMode: .fill) } else { Color.clear }
            #endif
        } else if let url = URL(string: source) {
            AsyncImage(url: url) { phase in
                if let image = phase.image { image.resizable().aspectRatio(contentMode: .fill) }
                else if phase.error != nil { Color.clear.onAppear { onFailure?() } }
                else { Color.clear }
            }
        }
    }
}

/// The row flex box: fixed leading/trailing, a flexible content (or primary) column, `gap`,
/// padding and min-height; three-line rows align to the top and stretch the trailing column.
struct AWCListRowRole: LayoutValueKey { static let defaultValue = 0 }
struct AWCListRowLayout: Layout {
    let gap: Double, top: Double, bottom: Double, start: Double, end: Double, minHeight: Double, three: Bool, centerLeading: Bool
    private func widths(_ inner: Double, _ subviews: Subviews) -> [Double] {
        let fixed = subviews.map { $0[AWCListRowRole.self] == 1 ? 0 : Double($0.sizeThatFits(.unspecified).width) }
        let flexible = max(0, inner - fixed.reduce(0, +) - gap * Double(max(0, subviews.count - 1)))
        return subviews.indices.map { subviews[$0][AWCListRowRole.self] == 1 ? flexible : fixed[$0] }
    }
    private func heights(_ w: [Double], _ subviews: Subviews) -> [Double] { subviews.indices.map { Double(subviews[$0].sizeThatFits(.init(width: w[$0], height: nil)).height) } }
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width: Double
        if let p = proposal.width, p.isFinite { width = Double(p) }
        else { width = start + end + subviews.map { Double($0.sizeThatFits(.unspecified).width) }.reduce(0, +) + gap * Double(max(0, subviews.count - 1)) }
        let w = widths(width - start - end, subviews), h = heights(w, subviews)
        return CGSize(width: width, height: max(minHeight, top + bottom + (h.max() ?? 0)))
    }
    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let w = widths(Double(bounds.width) - start - end, subviews), h = heights(w, subviews)
        let innerH = Double(bounds.height) - top - bottom
        var x = Double(bounds.minX) + start
        for (i, v) in subviews.enumerated() {
            let role = v[AWCListRowRole.self]
            var y: Double, ph: Double? = nil
            if three {
                y = Double(bounds.minY) + top
                if role == 2 { ph = innerH }
                if role == 0 && centerLeading { y = Double(bounds.minY) + top + (innerH - h[i]) / 2 }
            } else { y = Double(bounds.minY) + top + (innerH - h[i]) / 2 }
            v.place(at: .init(x: x, y: y), anchor: .topLeading, proposal: .init(width: w[i], height: ph ?? h[i]))
            x += w[i] + gap
        }
    }
}

/// Three-line trailing column (`flex-direction: column; align-items: flex-end`): children stack
/// from the top; a `margin-block: auto` child (the trailing icon) centres in the remaining space.
struct AWCListAutoMargin: LayoutValueKey { static let defaultValue = false }
struct AWCListTrailingColumn: Layout {
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let sizes = subviews.map { $0.sizeThatFits(.unspecified) }
        let natural = sizes.map(\.height).reduce(0, +)
        return CGSize(width: sizes.map(\.width).max() ?? 0, height: max(natural, proposal.height.flatMap { $0.isFinite ? $0 : nil } ?? natural))
    }
    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let sizes = subviews.map { $0.sizeThatFits(.unspecified) }
        var y = bounds.minY
        for (i, v) in subviews.enumerated() {
            let h = sizes[i].height, x = bounds.maxX - sizes[i].width
            if v[AWCListAutoMargin.self] {
                let after = sizes[(i + 1)...].map(\.height).reduce(0, +), remaining = bounds.maxY - y - after
                v.place(at: .init(x: x, y: y + max(0, (remaining - h) / 2)), anchor: .topLeading, proposal: .init(sizes[i])); y += max(h, remaining)
            } else { v.place(at: .init(x: x, y: y), anchor: .topLeading, proposal: .init(sizes[i])); y += h }
        }
    }
}
