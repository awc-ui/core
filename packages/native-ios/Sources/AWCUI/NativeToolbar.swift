import SwiftUI
import Observation

// MARK: - Hooks

/// md-toolbar's eleven public hooks (`--md-toolbar-*`). Colours are `#RRGGBB(AA)`, lengths points (the container shape
/// one corner radius; 9999 = full). The overflow hooks are the source's opt-in scrolling/wrapping keywords:
/// `overflowX` / `overflowY` (visible | hidden | clip | scroll | auto), `flexWrap` (nowrap | wrap | wrap-reverse) and
/// `scrollbarWidth` (thin | auto | none). Unset hooks keep the source defaults (density ladder, variant, colour scheme).
public struct AWCToolbarAppearance: Equatable, Sendable {
    public let containerColor: String?, iconColor: String?
    public let containerShape: Double?, containerHeight: Double?, padding: Double?, gap: Double?, fabGap: Double?
    public let overflowX: String?, overflowY: String?, flexWrap: String?, scrollbarWidth: String?
    public init(containerColor: String? = nil, iconColor: String? = nil, containerShape: Double? = nil, containerHeight: Double? = nil,
                padding: Double? = nil, gap: Double? = nil, fabGap: Double? = nil, overflowX: String? = nil, overflowY: String? = nil,
                flexWrap: String? = nil, scrollbarWidth: String? = nil) {
        func len(_ v: Double?) -> Double? { v.flatMap { $0.isFinite && $0 >= 0 && $0 <= 10000 ? $0 : nil } }
        func word(_ v: String?, _ allowed: Set<String>) -> String? { v.map { $0.trimmingCharacters(in: .whitespaces).lowercased() }.flatMap { allowed.contains($0) ? $0 : nil } }
        let overflow: Set<String> = ["visible", "hidden", "clip", "scroll", "auto"]
        self.containerColor = awcToolbarHex(containerColor); self.iconColor = awcToolbarHex(iconColor)
        self.containerShape = len(containerShape); self.containerHeight = len(containerHeight); self.padding = len(padding)
        self.gap = len(gap); self.fabGap = len(fabGap)
        self.overflowX = word(overflowX, overflow); self.overflowY = word(overflowY, overflow)
        self.flexWrap = word(flexWrap, ["nowrap", "wrap", "wrap-reverse"]); self.scrollbarWidth = word(scrollbarWidth, ["thin", "auto", "none"])
    }
    /// Laboratory names (the CSS hook without `--md-toolbar-`, camel-cased).
    public init(values: [String: AWCValue]) {
        func s(_ k: String) -> String? { values[k]?.string }
        func n(_ k: String) -> Double? { values[k]?.number }
        self.init(containerColor: s("containerColor"), iconColor: s("iconColor"), containerShape: n("containerShape"), containerHeight: n("containerHeight"),
                  padding: n("padding"), gap: n("gap"), fabGap: n("fabGap"), overflowX: s("overflowX"), overflowY: s("overflowY"),
                  flexWrap: s("flexWrap"), scrollbarWidth: s("scrollbarWidth"))
    }
    /// CSS values keyed by the hook names (`--md-toolbar-gap: 10px`), as authored on Web.
    public init(css: [String: String]) {
        func v(_ k: String) -> String? { css["--md-toolbar-" + k] }
        func px(_ k: String) -> Double? { v(k).flatMap { Double($0.trimmingCharacters(in: .whitespaces).replacingOccurrences(of: "px", with: "")) } }
        self.init(containerColor: v("container-color"), iconColor: v("icon-color"), containerShape: px("container-shape"), containerHeight: px("container-height"),
                  padding: px("padding"), gap: px("gap"), fabGap: px("fab-gap"), overflowX: v("overflow-x"), overflowY: v("overflow-y"),
                  flexWrap: v("flex-wrap"), scrollbarWidth: v("scrollbar-width"))
    }
    public func merging(_ o: Self) -> Self {
        .init(containerColor: o.containerColor ?? containerColor, iconColor: o.iconColor ?? iconColor, containerShape: o.containerShape ?? containerShape,
              containerHeight: o.containerHeight ?? containerHeight, padding: o.padding ?? padding, gap: o.gap ?? gap, fabGap: o.fabGap ?? fabGap,
              overflowX: o.overflowX ?? overflowX, overflowY: o.overflowY ?? overflowY, flexWrap: o.flexWrap ?? flexWrap, scrollbarWidth: o.scrollbarWidth ?? scrollbarWidth)
    }
}
func awcToolbarHex(_ value: String?) -> String? {
    guard let value = value?.trimmingCharacters(in: .whitespaces), value.utf8.count == 7 || value.utf8.count == 9, value.first == "#",
          value.dropFirst().utf8.allSatisfy({ (48...57).contains($0) || (65...70).contains($0) || (97...102).contains($0) }) else { return nil }
    return value.uppercased()
}
func awcToolbarRGBA(_ hex: String) -> AWCValue {
    let h = Array(hex.dropFirst()), n = { (i: Int) -> Double in Double(Int(String(h[i..<i + 2]), radix: 16) ?? 0) / 255 }
    return .array([.number(n(0)), .number(n(2)), .number(n(4)), .number(h.count >= 8 ? n(6) : 1)])
}

private struct AWCToolbarAppearanceKey: EnvironmentKey { static let defaultValue = AWCToolbarAppearance() }
/// `::part(container)` of md-toolbar: the container's background-color (floating: the pill's fill, its elevation kept; docked: a
/// fill over the content box, above the bar's own background). Part rules come from the outer tree, so they win over the
/// `--md-toolbar-container-color` hook and the standard / vibrant colours. `fab-container` — the wrapper of the slotted FAB — takes a
/// box (`AWCPartBox`: background, border, radius, padding; the bar and the host grow around it as in Chrome; gate-7 R6-17).
public struct AWCToolbarPartAppearance: Equatable, Sendable {
    public let containerColor: String?
    public let fabContainer: AWCPartBox?
    public init(containerColor: String? = nil, fabContainer: AWCPartBox? = nil) { self.containerColor = awcToolbarHex(containerColor); self.fabContainer = fabContainer }
    /// Laboratory names (the fields above; `fabContainer` as an `AWCPartBox` object).
    public init(values: [String: AWCValue]) { self.init(containerColor: values["containerColor"]?.string, fabContainer: AWCPartBox(value: values["fabContainer"])) }
    public func merging(_ o: Self) -> Self { .init(containerColor: o.containerColor ?? containerColor, fabContainer: AWCPartBox.merge(fabContainer, o.fabContainer)) }
}
private struct AWCToolbarPartAppearanceKey: EnvironmentKey { static let defaultValue = AWCToolbarPartAppearance() }
extension EnvironmentValues {
    var awcToolbarPartAppearance: AWCToolbarPartAppearance { get { self[AWCToolbarPartAppearanceKey.self] } set { self[AWCToolbarPartAppearanceKey.self] = newValue } }
}
private struct AWCToolbarPartAppearanceModifier: ViewModifier {
    @Environment(\.awcToolbarPartAppearance) private var inherited
    let value: AWCToolbarPartAppearance
    func body(content: Content) -> some View { content.environment(\.awcToolbarPartAppearance, inherited.merging(value)) }
}
public extension View {
    /// Applies md-toolbar `::part(container)` styling to descendant toolbars.
    func awcToolbarPartAppearance(_ value: AWCToolbarPartAppearance) -> some View { modifier(AWCToolbarPartAppearanceModifier(value: value)) }
}
/// setFocus(): focuses the toolbar's roving Tab stop (the remembered member, else the preferred one); no-op when the
/// roving group is empty or the toolbar is generic.
@Observable public final class AWCToolbarController {
    @ObservationIgnored var focusHandler: (() -> Bool)?
    public init() {}
    @discardableResult public func setFocus() -> Bool { focusHandler?() ?? false }
}
private struct AWCToolbarControllerKey: EnvironmentKey { static let defaultValue: AWCToolbarController? = nil }
/// The toolbar-only md-icon-button token map a container supplies to its direct icon buttons (md-toolbar section 7).
public struct AWCIconButtonScheme: Equatable, Sendable {
    /// The bar ink for standard / outlined unselected buttons (the icon hook, else on-surface-variant / on-surface).
    let ink: String
    /// Vibrant bars recolour tonal toggles: (container, ink) unselected and selected; nil on standard bars.
    let tonalOff: (String, String)?, tonalOn: (String, String)?
    public static func == (a: Self, b: Self) -> Bool { a.ink == b.ink && a.tonalOff?.0 == b.tonalOff?.0 && a.tonalOff?.1 == b.tonalOff?.1 && a.tonalOn?.0 == b.tonalOn?.0 && a.tonalOn?.1 == b.tonalOn?.1 }
    /// The hooks this state takes, or nil when the button keeps its own colours (filled, selected, standard tonal).
    func appearance(variant: String, toggle: Bool, selected: Bool) -> AWCIconButtonAppearance? {
        if (variant == "standard" || variant == "outlined") && !selected { return .init(iconColor: ink, stateLayerColor: ink) }
        if variant == "tonal" && toggle, let pair = selected ? tonalOn : tonalOff { return .init(containerColor: pair.0, iconColor: pair.1, stateLayerColor: pair.1) }
        return nil
    }
}
private struct AWCIconButtonSchemeKey: EnvironmentKey { static let defaultValue: AWCIconButtonScheme? = nil }
/// A docked toolbar flattens its paired FAB (`::slotted([slot=fab]) { box-shadow: none !important }`).
private struct AWCFabFlatElevationKey: EnvironmentKey { static let defaultValue = false }
public extension EnvironmentValues {
    var awcToolbarAppearance: AWCToolbarAppearance { get { self[AWCToolbarAppearanceKey.self] } set { self[AWCToolbarAppearanceKey.self] = newValue } }
    var awcToolbarController: AWCToolbarController? { get { self[AWCToolbarControllerKey.self] } set { self[AWCToolbarControllerKey.self] = newValue } }
    var awcIconButtonScheme: AWCIconButtonScheme? { get { self[AWCIconButtonSchemeKey.self] } set { self[AWCIconButtonSchemeKey.self] = newValue } }
    var awcFabFlatElevation: Bool { get { self[AWCFabFlatElevationKey.self] } set { self[AWCFabFlatElevationKey.self] = newValue } }
}
private struct AWCToolbarAppearanceModifier: ViewModifier {
    @Environment(\.awcToolbarAppearance) private var inherited
    let appearance: AWCToolbarAppearance
    func body(content: Content) -> some View { content.environment(\.awcToolbarAppearance, inherited.merging(appearance)) }
}
public extension View {
    /// The md-toolbar hooks for this subtree; nearer values win field by field.
    func awcToolbarAppearance(_ appearance: AWCToolbarAppearance) -> some View { modifier(AWCToolbarAppearanceModifier(appearance: appearance)) }
    /// Binds setFocus() for the toolbars below.
    func awcToolbarController(_ controller: AWCToolbarController) -> some View { environment(\.awcToolbarController, controller) }
}

extension AWCNativeView {
    /// The inherited icon-button hooks under a container's per-state token map, which wins over ancestors as the
    /// source's `::slotted` declarations do.
    var schemedIconButtonAppearance: AWCIconButtonAppearance {
        iconButtonScheme?.appearance(variant: s("variant", "standard"), toggle: b("toggle"), selected: b("selected")).map { iconButtonAppearance.merging($0) } ?? iconButtonAppearance
    }
    var nativeToolbar: some View {
        let tokens = (theme.tokens.isEmpty ? (colorScheme == .dark ? AWCGeneratedTokens.dark : AWCGeneratedTokens.light) : theme.tokens).merging(inheritedThemeTokens) { _, new in new }
        return AWCNativeToolbarView(node: node, tokens: tokens, onEvent: onEvent)
    }
}

// MARK: - Model

/// The md-toolbar.css geometry for one configuration. Density follows the source: the calc-based height, item gap and icon
/// sizes read the density scale (a local -1…-4 rung, else the inherited one); the spacing tokens (insets, the small and
/// large gaps) read the global rung, which only a -2…-4 rung replaces (`[density]` rules in tokens.css).
struct AWCToolbarMetrics: Equatable {
    let floating: Bool, vertical: Bool
    let height: Double, padding: Double, gap: Double, sectionGap: Double, fabGap: Double, margin: Double, shape: Double
    let justify: String
    init(variant: String, layout: String, alignment: String, appearance a: AWCToolbarAppearance, scale s: Double, rung r: Double) {
        floating = variant == "floating"; vertical = floating && layout == "vertical"
        let insetLg = r <= -4 ? 8.0 : r <= -2 ? 12 : 16, insetSm = r <= -3 ? 4.0 : 8, gapXs = r <= -4 ? 2.0 : 4, gapSm = r <= -3 ? 4.0 : 8
        let gapLg = r <= -4 ? 8.0 : r <= -2 ? 12 : 16, itemGap = max(4, 32 + 2 * s)
        justify = ["start", "center", "end", "space-between"].contains(alignment) ? alignment : "start"
        height = a.containerHeight ?? max(48, 64 + 4 * s)
        if floating {
            gap = a.gap ?? gapXs; sectionGap = gap; padding = a.padding ?? insetSm; fabGap = a.fabGap ?? gapSm; shape = a.containerShape ?? 9999
        } else {
            gap = justify == "space-between" ? 0 : a.gap ?? (justify == "center" ? gapSm : itemGap)
            sectionGap = justify == "space-between" ? a.gap ?? itemGap : gap
            padding = a.padding ?? insetLg; fabGap = a.fabGap ?? gapLg; shape = a.containerShape ?? 0
        }
        margin = floating ? insetLg : 0
    }
}

/// One authored child and its roles: the section it sits in, roving membership (md-icon-button / md-button that is
/// visible, not hard-disabled, not aria-hidden — the source's ROVING members; composites and independent controls such
/// as md-chip, md-fab or md-text-field keep their own Tab stop) and whether it is soft-disabled (reachable by arrows,
/// not the default stop).
struct AWCToolbarChild: Identifiable {
    let node: AWCNode
    var id: String { node.id }
    let slot: AWCToolbarSlot, member: Bool, soft: Bool
    init(_ node: AWCNode) {
        self.node = node
        let p = node.properties
        slot = node.slot == "leading" ? .leading : node.slot == "trailing" ? .trailing : node.slot == "fab" ? .fab : .content
        let hidden = p["aria-hidden"]?.string == "true" || p["ariaHidden"]?.string == "true" || p["aria-hidden"]?.bool == true
        member = slot != .fab && ["md-icon-button", "md-button"].contains(node.tag) && p["disabled"]?.bool != true && !hidden
        soft = p["softDisabled"]?.bool == true
    }
}
enum AWCToolbarSlot: Int { case leading, content, trailing, fab }

@Observable final class AWCToolbarRuntime {
    let group = AWCButtonFocusGroup()
    /// Scroll offset along the opt-in scrolling axis (points from the main-axis start) and its range.
    var scroll = 0.0
    @ObservationIgnored var scrollMax = 0.0
    @ObservationIgnored var dragStart: Double?
    /// Item frames along the main axis from the content start, written by the layout (focus reveal).
    @ObservationIgnored var spans: [String: ClosedRange<Double>] = [:]
    var viewport = 0.0
    func scroll(to x: Double) { let v = min(max(x, 0), scrollMax); if v != scroll { scroll = v } }
    /// scroll-padding-inline: a focused member is brought inside the viewport less the padding (nearest edge).
    func reveal(_ id: String, padding: Double) {
        guard scrollMax > 0, let span = spans[id] else { return }
        let lo = scroll + padding, hi = scroll + viewport - padding
        if span.lowerBound < lo { scroll(to: span.lowerBound - padding) } else if span.upperBound > hi { scroll(to: span.upperBound - viewport + padding) }
    }
}

// MARK: - Layout

struct AWCToolbarSlotKey: LayoutValueKey { static let defaultValue = AWCToolbarSlot.content }
struct AWCToolbarIDKey: LayoutValueKey { static let defaultValue = "" }

/// The `.md-toolbar__container` flex row (or column): the leading and trailing sections are one flex item each (their
/// items `sectionGap` apart), the default items sit between them `gap` apart; positive free space goes to the sections'
/// auto margins (horizontal bars), else `justify-content`; items are centred on the cross axis; `flex-wrap` breaks
/// lines `gap` apart. Positions are physical (the row runs right to left in RTL); content past the bounds overflows.
struct AWCToolbarItemsLayout: Layout {
    let vertical: Bool, rtl: Bool, gap: Double, sectionGap: Double, justify: String, wrap: Bool, wrapReverse: Bool
    var scrolling = false
    /// The scroller's viewport: content that fits is still justified across it.
    var minimumMain = 0.0
    var runtime: AWCToolbarRuntime? = nil
    struct Unit { var indices: [Int]; var main: Double; var cross: Double; var slot: AWCToolbarSlot }
    private func sizes(_ subviews: Subviews) -> [CGSize] { subviews.map { $0.sizeThatFits(.unspecified) } }
    private func units(_ subviews: Subviews, _ sizes: [CGSize]) -> [Unit] {
        func m(_ i: Int) -> Double { Double(vertical ? sizes[i].height : sizes[i].width) }
        func c(_ i: Int) -> Double { Double(vertical ? sizes[i].width : sizes[i].height) }
        let slots = subviews.map { $0[AWCToolbarSlotKey.self] }
        func group(_ s: AWCToolbarSlot) -> Unit? {
            let ids = slots.indices.filter { slots[$0] == s }
            guard !ids.isEmpty else { return nil }
            return .init(indices: ids, main: ids.map(m).reduce(0, +) + sectionGap * Double(ids.count - 1), cross: ids.map(c).max() ?? 0, slot: s)
        }
        var out: [Unit] = []
        if let g = group(.leading) { out.append(g) }
        for i in slots.indices where slots[i] == .content { out.append(.init(indices: [i], main: m(i), cross: c(i), slot: .content)) }
        if let g = group(.trailing) { out.append(g) }
        return out
    }
    private func lines(_ us: [Unit], _ main: Double) -> [[Int]] {
        guard wrap, !us.isEmpty else { return us.isEmpty ? [] : [Array(us.indices)] }
        var out: [[Int]] = [], cur: [Int] = [], used = 0.0
        for i in us.indices {
            let add = cur.isEmpty ? us[i].main : used + gap + us[i].main
            if !cur.isEmpty && add > main + 0.01 { out.append(cur); cur = [i]; used = us[i].main } else { cur.append(i); used = add }
        }
        if !cur.isEmpty { out.append(cur) }
        return wrapReverse ? out.reversed() : out
    }
    func natural(_ us: [Unit]) -> Double { us.isEmpty ? 0 : us.map(\.main).reduce(0, +) + gap * Double(us.count - 1) }
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let ss = sizes(subviews), us = units(subviews, ss), nat = natural(us)
        let proposed = (vertical ? proposal.height : proposal.width).flatMap { $0.isFinite ? Double($0) : nil }
        let main = scrolling ? max(proposed ?? nat, nat, minimumMain) : proposed ?? nat
        let ls = lines(us, main)
        let content = ls.isEmpty ? 0 : ls.map { l in l.map { us[$0].cross }.max() ?? 0 }.reduce(0, +) + gap * Double(ls.count - 1)
        // A definite cross size (the pill's content box) centres the items in it; an indefinite one hugs them.
        let pc = (vertical ? proposal.width : proposal.height).flatMap { $0.isFinite ? Double($0) : nil }
        let cross = pc ?? content   // items taller than a definite cross size overflow, centred (align-items: center)
        return vertical ? CGSize(width: cross, height: main) : CGSize(width: main, height: cross)
    }
    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let ss = sizes(subviews), us = units(subviews, ss)
        let mainLen = Double(vertical ? bounds.height : bounds.width), crossLen = Double(vertical ? bounds.width : bounds.height)
        let ls = lines(us, mainLen)
        let total = ls.isEmpty ? 0 : ls.map { l in l.map { us[$0].cross }.max() ?? 0 }.reduce(0, +) + gap * Double(ls.count - 1)
        var crossCursor = ls.count == 1 ? 0 : max(0, (crossLen - total) / 2)
        var spans: [String: ClosedRange<Double>] = [:]
        for line in ls {
            let lineCross = ls.count == 1 ? crossLen : line.map { us[$0].cross }.max() ?? 0
            let content = line.map { us[$0].main }.reduce(0, +) + gap * Double(line.count - 1)
            let free = mainLen - content
            let hasLead = !vertical && line.contains { us[$0].slot == .leading }, hasTrail = !vertical && line.contains { us[$0].slot == .trailing }
            let autos = (hasLead ? 1.0 : 0) + (hasTrail ? 1 : 0)
            var cursor = 0.0, between = gap, leadMargin = 0.0, trailMargin = 0.0
            if autos > 0 && free > 0 { let share = free / autos; leadMargin = hasLead ? share : 0; trailMargin = hasTrail ? share : 0 }
            else {
                switch justify {
                case "center": cursor = free / 2
                case "end": cursor = free
                case "space-between": if line.count > 1 && free > 0 { between = gap + free / Double(line.count - 1) }
                default: break
                }
            }
            for u in line.map({ us[$0] }) {
                if u.slot == .trailing { cursor += trailMargin }
                var inner = cursor
                for i in u.indices {
                    let size = ss[i], m = Double(vertical ? size.height : size.width), c = Double(vertical ? size.width : size.height)
                    let crossPos = crossCursor + (lineCross - c) / 2
                    let x: Double, y: Double
                    if vertical { x = Double(bounds.minX) + crossPos; y = Double(bounds.minY) + inner }
                    else { x = rtl ? Double(bounds.maxX) - inner - m : Double(bounds.minX) + inner; y = Double(bounds.minY) + crossPos }
                    subviews[i].place(at: CGPoint(x: x, y: y), anchor: .topLeading, proposal: ProposedViewSize(size))
                    spans[subviews[i][AWCToolbarIDKey.self]] = inner...(inner + m)
                    inner += m + sectionGap
                }
                cursor += u.main + between
                if u.slot == .leading { cursor += leadMargin }
            }
            crossCursor += lineCross + gap
        }
        if let runtime {
            runtime.spans = spans
            if scrolling { let nat = natural(us); runtime.scrollMax = max(0, nat - mainLen) }
        }
    }
}

/// The toolbar host: docked — the container fills the row less the inline padding and the FAB (pushed to the inline end
/// `fabGap` away), items centred in `max(height, content)`; floating — the pill (`height` tall, shrinking under a narrower
/// proposal) with the FAB `fabGap` beside it; floating vertical — `height` wide, the pill above the FAB. Physical positions.
struct AWCToolbarHostLayout: Layout {
    let metrics: AWCToolbarMetrics, rtl: Bool
    private func parts(_ subviews: Subviews) -> (container: LayoutSubview?, fab: LayoutSubview?) {
        (subviews.first { $0[AWCToolbarSlotKey.self] != .fab }, subviews.first { $0[AWCToolbarSlotKey.self] == .fab })
    }
    func frames(_ proposal: ProposedViewSize, _ subviews: Subviews) -> (size: CGSize, container: CGRect, fab: CGRect?) {
        let (container, fab) = parts(subviews), m = metrics
        let fs = fab?.sizeThatFits(.unspecified) ?? .zero, fw = Double(fs.width), fh = Double(fs.height)
        let pw = proposal.width.flatMap { $0.isFinite ? Double($0) : nil }, ph = proposal.height.flatMap { $0.isFinite ? Double($0) : nil }
        if !m.floating {
            let fabExtra = fab == nil ? 0 : m.fabGap + fw
            let natural = Double(container?.sizeThatFits(.unspecified).width ?? 0) + 2 * m.padding + fabExtra
            let w = pw ?? natural, cw = max(0, w - 2 * m.padding - fabExtra)
            let ch = Double(container?.sizeThatFits(.init(width: CGFloat(cw), height: nil)).height ?? 0)
            let h = max(m.height, ch, fh)
            let cx = rtl ? w - m.padding - cw : m.padding
            let fx = rtl ? m.padding : w - m.padding - fw
            return (CGSize(width: w, height: h), CGRect(x: cx, y: (h - ch) / 2, width: cw, height: ch), fab == nil ? nil : CGRect(x: fx, y: (h - fh) / 2, width: fw, height: fh))
        }
        if !m.vertical {
            let fabExtra = fab == nil ? 0 : m.fabGap + fw
            let natural = Double(container?.sizeThatFits(.init(width: nil, height: CGFloat(m.height))).width ?? 0)
            let cw = min(natural, max(0, (pw ?? .infinity) - fabExtra)), h = max(m.height, fh)
            let w = cw + fabExtra
            let cx = rtl ? w - cw : 0, fx = rtl ? 0 : cw + m.fabGap
            return (CGSize(width: w, height: h), CGRect(x: cx, y: (h - m.height) / 2, width: cw, height: m.height), fab == nil ? nil : CGRect(x: fx, y: (h - fh) / 2, width: fw, height: fh))
        }
        let w = m.height, fabExtra = fab == nil ? 0 : m.fabGap + fh
        let natural = Double(container?.sizeThatFits(.init(width: CGFloat(w), height: nil)).height ?? 0)
        let ch = min(natural, max(0, (ph ?? .infinity) - fabExtra)), h = ch + fabExtra
        return (CGSize(width: w, height: h), CGRect(x: 0, y: 0, width: w, height: ch), fab == nil ? nil : CGRect(x: (w - fw) / 2, y: ch + m.fabGap, width: fw, height: fh))
    }
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize { frames(proposal, subviews).size }
    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let f = frames(ProposedViewSize(bounds.size), subviews), (container, fab) = parts(subviews)
        container?.place(at: CGPoint(x: bounds.minX + f.container.minX, y: bounds.minY + f.container.minY), anchor: .topLeading, proposal: ProposedViewSize(f.container.size))
        if let fab, let r = f.fab { fab.place(at: CGPoint(x: bounds.minX + r.minX, y: bounds.minY + r.minY), anchor: .topLeading, proposal: ProposedViewSize(r.size)) }
    }
}

/// The opt-in scroller: the viewport takes the proposed main size, the items keep their natural one (at least the
/// viewport) and move by the scroll offset (from the inline start: the right edge in RTL). Disabled, it is transparent.
struct AWCToolbarScroller: Layout {
    let vertical: Bool, rtl: Bool, enabled: Bool, offset: Double
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        guard let child = subviews.first else { return .zero }
        guard enabled else { return child.sizeThatFits(proposal) }
        let natural = child.sizeThatFits(vertical ? .init(width: proposal.width, height: nil) : .init(width: nil, height: proposal.height))
        return vertical ? CGSize(width: natural.width, height: proposal.height.flatMap { $0.isFinite ? $0 : nil } ?? natural.height)
                        : CGSize(width: proposal.width.flatMap { $0.isFinite ? $0 : nil } ?? natural.width, height: natural.height)
    }
    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        guard let child = subviews.first else { return }
        guard enabled else { child.place(at: bounds.origin, anchor: .topLeading, proposal: ProposedViewSize(bounds.size)); return }
        let size = child.sizeThatFits(vertical ? .init(width: bounds.width, height: nil) : .init(width: nil, height: bounds.height))
        let o = CGFloat(offset)
        let p = vertical ? CGPoint(x: bounds.minX, y: bounds.minY - o) : CGPoint(x: rtl ? bounds.maxX - size.width + o : bounds.minX - o, y: bounds.minY)
        child.place(at: p, anchor: .topLeading, proposal: ProposedViewSize(size))
    }
}
/// overflow: hidden / clip / auto / scroll clip the container; visible (the default) paints past it.
struct AWCToolbarClip: Shape {
    let enabled: Bool
    func path(in rect: CGRect) -> Path { Path(enabled ? rect : rect.insetBy(dx: -100_000, dy: -100_000)) }
}

// MARK: - View

/// md-toolbar: the docked bar (full width, surface-container, elevation 2, square corners) or the floating pill
/// (corner-full, elevation 2, the FAB beside it) with standard/vibrant chrome, sections, alignment, density, the eleven
/// hooks, the toolbar-only icon-button tints, the roving Tab stop over its activators (arrows on the bar's axis, wrap,
/// Home/End, soft-disabled members reachable, modifier arrows ignored, the stop remembered), setFocus() and generic mode.
struct AWCNativeToolbarView: View {
    let node: AWCNode
    let tokens: [String: String]
    let onEvent: (AWCEvent) -> Void
    @State private var runtime = AWCToolbarRuntime()
    @Environment(\.awcToolbarAppearance) private var appearance
    @Environment(\.awcToolbarPartAppearance) private var partAppearance
    @Environment(\.awcToolbarController) private var controller
    @Environment(\.awcNativeDensity) private var scale
    /// The bar's own density rung wins over the inherited scale (and, for -2…-4, the spacing rung), read from its property so
    /// a retained update applies in the same render.
    private var localScale: Double { AWCNativeDensity.resolve(p["density"]?.number, inherited: scale) }
    private var localRung: Double { let d = p["density"]?.number ?? 0; return [-2.0, -3, -4].contains(d) ? d : rung }
    @Environment(\.awcNativeSpacingRung) private var rung
    @Environment(\.layoutDirection) private var inheritedDirection
    @Environment(\.awcNativeFocusChanged) private var focusChanged
    private var p: [String: AWCValue] { node.properties }
    private func str(_ k: String, _ d: String = "") -> String { p[k]?.string ?? d }
    private var rtl: Bool { str("dir") == "rtl" || (str("dir") != "ltr" && inheritedDirection == .rightToLeft) }
    private var toolbar: Bool { str("containerSemantics", "toolbar") != "generic" }
    @Environment(\.awcInteractionStore) private var interactionStore
    /// ARIA's name computation prefers aria-labelledby: the referenced nodes' text (IDREFs resolved in the native scope),
    /// then aria-label.
    private var label: String {
        let ids = [str("ariaLabelledby"), str("aria-labelledby")].first { !$0.isEmpty }?.split(whereSeparator: \.isWhitespace).map(String.init) ?? []
        let referenced = ids.compactMap { interactionStore?.labelTexts.texts[$0]?.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }.joined(separator: " ")
        if !referenced.isEmpty { return referenced }
        return [str("aria-label"), str("ariaLabelProp"), str("ariaLabel")].map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.first { !$0.isEmpty } ?? ""
    }
    private var metrics: AWCToolbarMetrics {
        AWCToolbarMetrics(variant: str("variant", "docked"), layout: str("layout", "horizontal"), alignment: str("alignment", "start"), appearance: appearance, scale: localScale, rung: localRung)
    }
    private func token(_ role: String, _ fallback: String) -> String { awcToolbarHex(tokens["--md-sys-color-" + role]) ?? fallback }
    private var vibrant: Bool { str("color", "standard") == "vibrant" }
    private var containerHex: String { appearance.containerColor ?? (vibrant ? token("primary-container", "#EADDFF") : token("surface-container", "#F3EDF7")) }
    private var inkHex: String { appearance.iconColor ?? (vibrant ? token("on-surface", "#1C1B1F") : token("on-surface-variant", "#49454F")) }
    private var scheme: AWCIconButtonScheme {
        .init(ink: inkHex, tonalOff: vibrant ? (token("surface-container", "#F3EDF7"), token("on-surface", "#1C1B1F")) : nil,
              tonalOn: vibrant ? (token("secondary-container", "#E8DEF8"), token("on-secondary-container", "#1E192B")) : nil)
    }
    /// Visible authored children (a `hidden` child takes no space), in authored order.
    private var children: [AWCToolbarChild] { node.children.filter { $0.tag != "#text" && $0.properties["hidden"]?.bool != true }.map(AWCToolbarChild.init) }
    /// The roving group in visual order: leading, default, trailing (the FAB excluded).
    private var members: [AWCToolbarChild] { toolbar ? children.filter(\.member).sorted { $0.slot.rawValue < $1.slot.rawValue } : [] }
    private var preferred: String? { (members.first { !$0.soft } ?? members.first)?.id }
    private func syncFocus() {
        let g = runtime.group
        g.vertical = metrics.vertical; g.ignoresModifiedKeys = true
        g.configure(items: members.map { AWCButtonFocusItem(id: $0.id, disabled: false, selected: $0.id == preferred) }, singleSelection: true, rightToLeft: rtl)
    }
    private var focusSignature: [String] { members.map { $0.id + ($0.soft ? "~" : "") } + [metrics.vertical ? "v" : "h", rtl ? "rtl" : "ltr", toolbar ? "t" : "g"] }
    /// Opt-in scrolling on the bar's axis; wrapping lines never overflow that axis, so a wrapping bar does not scroll.
    private var scrollAxis: Bool {
        let o = metrics.vertical ? appearance.overflowY : appearance.overflowX
        return (o == "auto" || o == "scroll") && appearance.flexWrap != "wrap" && appearance.flexWrap != "wrap-reverse"
    }
    private var clips: Bool { scrollAxis || (metrics.vertical ? appearance.overflowY : appearance.overflowX).map { $0 == "hidden" || $0 == "clip" } == true }

    @ViewBuilder private func item(_ c: AWCToolbarChild) -> some View {
        // Read during the body (observation): the inspection closure runs later and would not refresh on a roving change.
        let stop = c.member && toolbar && runtime.group.activeID == c.id
        AWCNativeView(node: c.node, onEvent: onEvent)
            .environment(\.awcButtonFocusGroup, c.member && toolbar ? runtime.group : nil)
            .environment(\.awcIconButtonScheme, c.node.tag == "md-icon-button" && c.slot != .fab ? scheme : nil)
            .environment(\.awcFabFlatElevation, c.slot == .fab && !metrics.floating)
            .environment(\.layoutDirection, rtl ? .rightToLeft : .leftToRight)
            .environment(\.awcNativeFocusChanged) { id, focused in
                if focused && scrollAxis { runtime.reveal(id, padding: metrics.padding) }
                focusChanged?(id, focused)
            }
            .awcInspect(nodeID: c.id, part: "toolbar-item", name: "toolbar-item") { _ in
                var out: [String: AWCValue] = ["slot": .string(["leading", "default", "trailing", "fab"][c.slot.rawValue]), "member": .bool(c.member && toolbar),
                                               "tabStop": .bool(stop)]
                if c.node.tag == "md-icon-button", c.slot != .fab, let a = scheme.appearance(variant: c.node.properties["variant"]?.string ?? "standard",
                    toggle: c.node.properties["toggle"]?.bool == true, selected: c.node.properties["selected"]?.bool == true) {
                    if let v = a.iconColor { out["iconColor"] = awcToolbarRGBA(v) }; if let v = a.stateLayerColor { out["stateLayerColor"] = awcToolbarRGBA(v) }
                    if let v = a.containerColor { out["containerColor"] = awcToolbarRGBA(v) }
                }
                return out
            }
    }
    private var items: some View {
        let m = metrics, wrap = appearance.flexWrap == "wrap" || appearance.flexWrap == "wrap-reverse"
        let content = children.filter { $0.slot != .fab }
        return AWCToolbarItemsLayout(vertical: m.vertical, rtl: rtl, gap: m.gap, sectionGap: m.sectionGap, justify: m.justify, wrap: wrap,
                                     wrapReverse: appearance.flexWrap == "wrap-reverse", scrolling: scrollAxis, minimumMain: scrollAxis ? runtime.viewport : 0, runtime: runtime) {
            ForEach(content) { c in item(c).layoutValue(key: AWCToolbarSlotKey.self, value: c.slot).layoutValue(key: AWCToolbarIDKey.self, value: c.id) }
        }
    }
    /// The container: the items in the opt-in scroller (an offset the wheel and a drag move; focus reveals the member). The
    /// view structure is the same for every configuration so the children (and their focus responders) keep their identity.
    private var container: some View {
        let v = metrics.vertical, scrolling = scrollAxis
        return AWCToolbarScroller(vertical: v, rtl: rtl, enabled: scrolling, offset: runtime.scroll) { items }
            .clipShape(AWCToolbarClip(enabled: clips))
            .contentShape(Rectangle())
            .gesture(DragGesture(minimumDistance: 4).onChanged { g in
                let start = runtime.dragStart ?? runtime.scroll; runtime.dragStart = start
                let d = Double(v ? g.translation.height : g.translation.width) * (rtl && !v ? -1 : 1)
                runtime.scroll(to: start - d)
            }.onEnded { _ in runtime.dragStart = nil }, including: scrolling ? .all : .subviews)
            .background { AWCToolbarWheel { dx, dy in if scrolling { runtime.scroll(to: runtime.scroll + (v ? dy : (rtl ? -dx : dx))) } } }
            .onGeometryChange(for: Double.self) { Double(v ? $0.size.height : $0.size.width) } action: { if runtime.viewport != $0 { runtime.viewport = $0 } }
    }
    var body: some View {
        if p["hidden"]?.bool == true { EmptyView() } else { bar }
    }
    private var bar: some View {
        let m = metrics, fab = children.filter { $0.slot == .fab }, partFill = partAppearance.containerColor
        let radius = { (size: CGSize) -> Double in min(m.shape, Double(min(size.width, size.height)) / 2) }
        let _ = bindController()
        return AWCToolbarHostLayout(metrics: m, rtl: rtl) {
            container
                .padding(CGFloat(m.floating ? m.padding : 0))
                .frame(height: m.floating && !m.vertical ? CGFloat(m.height) : nil)
                .background { AWCToolbarSurface(color: m.floating ? partFill ?? containerHex : containerHex, radius: radius, tokens: tokens).opacity(m.floating ? 1 : 0) }
                // ::part(container) on the docked bar: a plain fill over the content box (no radius or elevation of its own).
                .background { if !m.floating, let c = partFill { Rectangle().fill(Color(awcHex: c)) } }
            .awcInspect(nodeID: node.id, part: "container", name: "container") { size in
                ["background": m.floating ? awcToolbarRGBA(partFill ?? containerHex) : awcToolbarRGBA(partFill ?? "#00000000"), "radius": .number(m.floating ? radius(size) : 0),
                 "elevation": .number(m.floating ? 2 : 0), "gap": .object(["row": .number(m.gap), "column": .number(m.gap)]), "itemGap": .number(m.gap), "sectionGap": .number(m.sectionGap), "justify": .string(m.justify),
                 // Laboratory inspection schema: four-edge padding, {row, column} gap; the scalar values stay under their own keys.
                 "padding": .array(Array(repeating: .number(m.floating ? m.padding : 0), count: 4)), "paddingValue": .number(m.floating ? m.padding : 0), "scrollMax": .number(runtime.scrollMax), "scroll": .number(runtime.scroll)]
            }
            .layoutValue(key: AWCToolbarSlotKey.self, value: .content)
            if !fab.isEmpty {
                HStack(spacing: 0) { ForEach(fab) { item($0) } }
                    // ::part(fab-container) box (gate-7 R6-17): the host layout measures the FAB with its border and padding.
                    // A border without a colour takes the bar's text colour (the icon colour).
                    .awcPartBox(partAppearance.fabContainer, ink: Color(awcHex: inkHex))
                    .awcInspect(nodeID: node.id, part: "fab-container", name: "fab-container") { _ in partAppearance.fabContainer?.metrics(ink: Color(awcHex: inkHex)) ?? [:] }
                    .layoutValue(key: AWCToolbarSlotKey.self, value: .fab)
            }
        }
        .environment(\.layoutDirection, .leftToRight)
        .background { AWCToolbarSurface(color: containerHex, radius: { _ in m.shape }, tokens: tokens).opacity(m.floating ? 0 : 1) }
        .zIndex(m.floating ? 0 : 100)
        .awcInspect(nodeID: node.id, name: "md-toolbar") { _ in
            ["role": .string(toolbar ? "toolbar" : "generic"), "orientation": .string(toolbar ? (m.vertical ? "vertical" : "horizontal") : ""), "label": .string(toolbar ? label : ""),
             "background": m.floating ? awcToolbarRGBA("#00000000") : awcToolbarRGBA(containerHex), "radius": .number(m.floating ? 0 : m.shape),
             "elevation": .number(m.floating ? 0 : 2), "ink": awcToolbarRGBA(inkHex), "height": .number(m.height),
             // docked: padding-inline; floating: margin-inline (source md-toolbar.css), as four-edge arrays [top, right, bottom, left].
             "padding": .array([0, .number(m.floating ? 0 : m.padding), 0, .number(m.floating ? 0 : m.padding)]), "paddingInline": .number(m.floating ? 0 : m.padding),
             "margin": .array([0, .number(m.margin), 0, .number(m.margin)]), "marginInline": .number(m.margin), "fabGap": .number(m.fabGap), "zIndex": .number(m.floating ? 0 : 100),
             "members": .array(members.map { .string($0.id) }), "activeID": .string(toolbar ? runtime.group.activeID ?? "" : ""), "density": .number(localScale)]
        }
        .modifier(AWCToolbarAccessibility(toolbar: toolbar, label: label, vertical: m.vertical, id: node.id))
        // margin-inline (floating): outside the measured host box, as on Web.
        .padding(.horizontal, CGFloat(m.margin))
        .onAppear { syncFocus() }
        .onChange(of: focusSignature) { _, _ in syncFocus() }
    }
    private func bindController() {
        controller?.focusHandler = { [runtime] in
            guard toolbar else { return false }
            let ids = members.map(\.id), target = runtime.group.activeID.flatMap { ids.contains($0) ? $0 : nil } ?? preferred
            return target.map { runtime.group.focus($0) } ?? false
        }
    }
}

/// The bar or pill surface: the container colour in the hooked shape with md-sys-elevation-2 behind it.
private struct AWCToolbarSurface: View {
    let color: String, radius: (CGSize) -> Double, tokens: [String: String]
    var body: some View {
        GeometryReader { g in
            let r = radius(g.size)
            RoundedRectangle(cornerRadius: CGFloat(r), style: .circular).fill(Color(awcHex: color))
                .background { AWCElevationShadow(level: 2, radii: [r, r, r, r], tokens: tokens) }
        }
    }
}

/// role=toolbar with its name and orientation; generic mode is a plain group (a name there is ignored, as ARIA prohibits it).
private struct AWCToolbarAccessibility: ViewModifier {
    let toolbar: Bool, label: String, vertical: Bool, id: String
    func body(content: Content) -> some View {
        #if canImport(AppKit)
        // macOS: an AXToolbar (Chrome's role for role=toolbar) named by the label, holding the controls' native responders in
        // reading order; a divider is decorative there (Chrome exposes separators in a toolbar as AXSplitter, which the
        // checker treats as optional on macOS).
        if toolbar { content.accessibilityHidden(true).background { AWCToolbarAccessibilityBridge(label: label, identifier: id, vertical: vertical) } }
        else { content.accessibilityElement(children: .contain) }
        #else
        if toolbar && !label.isEmpty { content.accessibilityElement(children: .contain).accessibilityLabel(Text(label)) }
        else { content.accessibilityElement(children: .contain) }
        #endif
    }
}

#if canImport(AppKit)
import AppKit
/// The toolbar as Chrome exposes role=toolbar on macOS: an AXToolbar named by the label (orientation as Web
/// aria-orientation) whose children are the controls' native responders inside it — the members' focus bridges and any
/// AppKit control (a text field) — in reading order.
final class AWCToolbarAccessibilityView: NSView {
    var label = "", elementIdentifier = "", vertical = false
    override func hitTest(_ point: NSPoint) -> NSView? { nil }
    override func isAccessibilityElement() -> Bool { true }
    override func accessibilityRole() -> NSAccessibility.Role? { .toolbar }
    override func accessibilityLabel() -> String? { label.isEmpty ? nil : label }
    override func accessibilityIdentifier() -> String { elementIdentifier }
    override func accessibilityOrientation() -> NSAccessibilityOrientation { vertical ? .vertical : .horizontal }
    override func accessibilityChildren() -> [Any]? {
        guard let window, let content = window.contentView else { return [] }
        let box = convert(bounds, to: nil).insetBy(dx: -1, dy: -1)
        func all(_ view: NSView) -> [NSView] { [view] + view.subviews.flatMap(all) }
        let items = all(content).filter { v in
            guard v !== self, (v is AWCNativeButtonFocusView && (v as! AWCNativeButtonFocusView).configuration?.inert == false) || (v is NSTextField && v.isAccessibilityElement()) else { return false }
            let r = v.convert(v.bounds, to: nil); return box.contains(NSPoint(x: r.midX, y: r.midY))
        }.sorted { a, b in
            let ra = a.convert(a.bounds, to: nil), rb = b.convert(b.bounds, to: nil)
            if vertical || abs(ra.midY - rb.midY) > max(ra.height, rb.height) / 2 { return ra.maxY > rb.maxY }
            return userInterfaceLayoutDirection == .rightToLeft ? ra.maxX > rb.maxX : ra.minX < rb.minX
        }
        items.compactMap { $0 as? AWCNativeButtonFocusView }.forEach { $0.awcAccessibilityContainer = self }
        return items
    }
}
private struct AWCToolbarAccessibilityBridge: NSViewRepresentable {
    let label: String, identifier: String, vertical: Bool
    func makeNSView(context: Context) -> AWCToolbarAccessibilityView { AWCToolbarAccessibilityView() }
    func updateNSView(_ view: AWCToolbarAccessibilityView, context: Context) { view.label = label; view.elementIdentifier = identifier; view.vertical = vertical }
}
/// Scroll-wheel deltas over the opt-in scroller (trackpads and mice; the drag gesture covers touch).
private struct AWCToolbarWheel: NSViewRepresentable {
    let onScroll: (Double, Double) -> Void
    final class WheelView: NSView {
        var onScroll: ((Double, Double) -> Void)?
        override func scrollWheel(with e: NSEvent) { onScroll?(-Double(e.scrollingDeltaX), -Double(e.scrollingDeltaY)) }
    }
    func makeNSView(context: Context) -> WheelView { WheelView() }
    func updateNSView(_ view: WheelView, context: Context) { view.onScroll = onScroll }
}
#else
private struct AWCToolbarWheel: View {
    let onScroll: (Double, Double) -> Void
    var body: some View { Color.clear }
}
#endif

/// The authored text of every rendered node by id (registered by AWCNativeView), observed so an IDREF label (md-toolbar
/// aria-labelledby) follows the referenced node however the two are ordered.
@Observable final class AWCLabelTexts {
    var texts: [String: String] = [:]
    func register(_ id: String, _ text: String) { if !id.isEmpty, texts[id] != text { texts[id] = text } }
}
