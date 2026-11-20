import SwiftUI
import QuartzCore
import CoreText

// MARK: Shared drawing

/// md-table-sort-label's ICON_ARROW (24×24 viewBox).
struct AWCTableArrowShape: Shape {
    func path(in rect: CGRect) -> Path {
        let pts: [(Double, Double)] = [(4, 12), (5.41, 13.41), (11, 7.83), (11, 20), (13, 20), (13, 7.83), (18.58, 13.42), (20, 12), (12, 4)]
        return polygon(pts, rect)
    }
}
/// md-table-cell's built-in push-pin glyph (24×24 viewBox; the cell rotates it 45°).
struct AWCTablePinShape: Shape {
    func path(in rect: CGRect) -> Path {
        let pts: [(Double, Double)] = [(16, 12), (16, 4), (17, 4), (17, 2), (7, 2), (7, 4), (8, 4), (8, 12), (6, 14), (6, 16), (11.2, 16), (11.2, 22), (12.8, 22), (12.8, 16), (18, 16), (18, 14)]
        return polygon(pts, rect)
    }
}
private func polygon(_ pts: [(Double, Double)], _ rect: CGRect) -> Path {
    var p = Path()
    let sx = rect.width / 24, sy = rect.height / 24
    for (i, pt) in pts.enumerated() {
        let q = CGPoint(x: rect.minX + pt.0 * sx, y: rect.minY + pt.1 * sy)
        if i == 0 { p.move(to: q) } else { p.addLine(to: q) }
    }
    p.closeSubpath(); return p
}

/// Exact CSS advance of one line of Roboto text (Core Text typographic width with letter-spacing); SwiftUI rounds
/// text frames to the pixel grid, which would inflate max-content column tracks.
enum AWCTableTextWidth {
    static var cache: [String: Double] = [:]
    static func measure(_ text: String, size: Double, weight: Double, tracking: Double, tabular: Bool) -> Double {
        let key = "\(text)|\(size)|\(weight)|\(tracking)|\(tabular)"
        if let v = cache[key] { return v }
        _ = AWCNativeFonts.labelFamily(regular: true)
        var font = CTFontCreateWithName((weight < 500 ? "Roboto-Regular" : "Roboto-Medium") as CFString, CGFloat(size), nil)
        if tabular {
            let d = CTFontDescriptorCreateCopyWithFeature(CTFontCopyFontDescriptor(font), NSNumber(value: kNumberSpacingType), NSNumber(value: kMonospacedNumbersSelector))
            font = CTFontCreateWithFontDescriptor(d, CGFloat(size), nil)
        }
        let attributes: [NSAttributedString.Key: Any] = [NSAttributedString.Key(kCTFontAttributeName as String): font, NSAttributedString.Key(kCTKernAttributeName as String): tracking]
        let w = Double(CTLineGetTypographicBounds(CTLineCreateWithAttributedString(NSAttributedString(string: text, attributes: attributes)), nil, nil, nil))
        cache[key] = w
        return w
    }
}
/// Sizes text to its own advance (never to the proposal) and to whole CSS line boxes.
struct AWCTableLineBox: Layout {
    let lineHeight: Double, lines: Int
    var exactWidth: Double? = nil
    func metrics(_ proposal: ProposedViewSize, _ subviews: Subviews) -> (CGSize, Double) {
        let probe = Double(subviews[1].sizeThatFits(.unspecified).height)
        let text = subviews[0].sizeThatFits(.init(width: proposal.width, height: nil))
        var n = 1
        if lines > 1 { let spacing = Swift.max(0, lineHeight - probe); n = Swift.max(1, Swift.min(lines, Int(((Double(text.height) + spacing) / (probe + spacing)).rounded()))) }
        var width = Double(text.width)
        if n == 1, let exactWidth { width = exactWidth }
        if let p = proposal.width, p.isFinite, n > 1 { width = Swift.min(width, Double(p)) }
        return (CGSize(width: width, height: Double(n) * lineHeight), probe)
    }
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize { metrics(proposal, subviews).0 }
    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let (_, probe) = metrics(.init(width: bounds.width, height: nil), subviews)
        subviews[0].place(at: .init(x: bounds.minX, y: bounds.minY + (lineHeight - probe) / 2), anchor: .topLeading, proposal: .init(width: bounds.width, height: nil))
        subviews[1].place(at: bounds.origin, anchor: .topLeading, proposal: .unspecified)
    }
}

/// One CSS line box of body text (Roboto, fixed line height; tabular figures for numeric cells). It sizes to the text
/// (the cell aligns it); wrapping text (`white-space: normal`) breaks only when one line does not fit.
struct AWCTableText: View {
    let text: String, size: Double, lineHeight: Double, weight: Double, tracking: Double, color: Color
    var lines = 1, tabular = false, alignment: TextAlignment = .leading, ellipsis = false
    var body: some View {
        if lines > 1 && !ellipsis {
            ViewThatFits(in: .horizontal) { box(1, fixed: true); box(lines, fixed: false) }
        } else {
            box(ellipsis ? 1 : lines, fixed: !ellipsis)
        }
    }
    var font: Font { tabular ? AWCNativeFonts.label(size: size, weight: weight).monospacedDigit() : AWCNativeFonts.label(size: size, weight: weight) }
    func box(_ n: Int, fixed: Bool) -> some View {
        AWCTableLineBox(lineHeight: lineHeight, lines: n, exactWidth: fixed ? AWCTableTextWidth.measure(text, size: size, weight: weight, tracking: tracking, tabular: tabular) : nil) {
            Text(text).font(font).tracking(tracking).foregroundStyle(color).lineLimit(n).truncationMode(.tail).multilineTextAlignment(alignment)
                .lineSpacing(n > 1 ? Swift.max(0, lineHeight - size * 1.171875) : 0)
                .fixedSize(horizontal: fixed, vertical: false)
            Text("Ag").font(font).lineLimit(1).hidden()
        }
    }
}

/// Slotted light-DOM content rendered with the surrounding text style (cells, expanded zones, empty state).
struct AWCTableSlotContent: View {
    let node: AWCNode, theme: AWCTheme, color: Color, metrics: AWCTableMetrics
    var weight = 400.0, tracking = 0.25, size: Double? = nil, lineHeight: Double? = nil
    let onEvent: (AWCEvent) -> Void
    var body: some View {
        switch node.tag {
        case "#text", "#slot-text":
            AWCTableText(text: node.properties["text"]?.string ?? "", size: size ?? metrics.fontSize, lineHeight: lineHeight ?? metrics.lineHeight, weight: weight, tracking: tracking, color: color, lines: 20)
        case "#symbol":
            AWCMaterialSymbol(node.properties["name"]?.string ?? "", size: 24).foregroundStyle(color)
        case "div", "p", "span", "br", "strong", "em", "b":
            if node.tag == "br" { Color.clear.frame(height: 0) }
            else if node.properties["class"]?.string.contains("material-symbols") == true {
                AWCMaterialSymbol(node.authoredTextContent.trimmingCharacters(in: .whitespacesAndNewlines), size: 24).foregroundStyle(color)
            } else {
                let style = AWCTableInlineStyle(node.properties["style"]?.string ?? "")
                let ink = style.color.map { AWCTableColor.color($0, "#000000") } ?? color
                let kids = ForEach(node.children) { AWCTableSlotContent(node: $0, theme: theme, color: ink, metrics: metrics, weight: style.fontWeight ?? weight, tracking: tracking,
                                                                         size: style.fontSize ?? size, lineHeight: style.fontSize != nil ? nil : lineHeight, onEvent: onEvent) }
                let centred = style.center || (style.flex && style.justifyCenter)
                Group {
                    if style.flex { HStack(alignment: style.alignCenter ? .center : .top, spacing: style.gap ?? 0) { kids } }
                    else { VStack(alignment: style.center ? .center : .leading, spacing: 0) { kids } }
                }
                    .frame(maxWidth: centred || style.fill ? .infinity : nil, maxHeight: style.fill ? .infinity : nil,
                           alignment: Alignment(horizontal: centred ? .center : .leading, vertical: style.flex && style.alignCenter ? .center : .top))
                    .padding(EdgeInsets(top: style.padding[0], leading: style.padding[3], bottom: style.padding[2], trailing: style.padding[1]))
                    .background { if let bg = style.background { Rectangle().fill(AWCTableColor.color(bg, "#00000000")) } }
            }
        default:
            AWCNativeView(node: node, onEvent: onEvent)
        }
    }
}

/// The inline `style` subset slotted content uses in the table family: padding shorthand, text-align, a box that fills its
/// positioned ancestor (`position: absolute; inset: 0`), flex centring, background / text colour, font shorthand and gap.
struct AWCTableInlineStyle {
    var padding: [Double] = [0, 0, 0, 0]   // top, right, bottom, left
    var center = false
    var fill = false, absolute = false, flex = false, alignCenter = false, justifyCenter = false
    var background: String?, color: String?, fontSize: Double?, fontWeight: Double?, gap: Double?
    init(_ raw: String) {
        for decl in raw.split(separator: ";") {
            let kv = decl.split(separator: ":", maxSplits: 1).map { $0.trimmingCharacters(in: .whitespaces) }
            guard kv.count == 2 else { continue }
            let v = kv[1].lowercased()
            switch kv[0].lowercased() {
            case "padding":
                let n = v.split(separator: " ").compactMap { AWCTableTemplate.length(String($0)) }
                switch n.count { case 1: padding = [n[0], n[0], n[0], n[0]]; case 2: padding = [n[0], n[1], n[0], n[1]]; case 3: padding = [n[0], n[1], n[2], n[1]]; case 4: padding = n; default: break }
            case "text-align": center = v == "center"
            case "position": absolute = v == "absolute" || v == "fixed"
            case "inset": fill = v.split(separator: " ").allSatisfy { $0 == "0" || $0 == "0px" }
            case "display": flex = v == "flex" || v == "inline-flex"
            case "align-items": alignCenter = v == "center"
            case "justify-content": justifyCenter = v == "center"
            case "background", "background-color": background = AWCTableColor.parse(v) != nil ? v : nil
            case "color": color = AWCTableColor.parse(v) != nil ? v : nil
            case "font-size": fontSize = AWCTableTemplate.length(v)
            case "font-weight": fontWeight = Double(v) ?? (v == "bold" ? 700 : v == "normal" ? 400 : nil)
            case "gap": gap = AWCTableTemplate.length(v)
            case "font":
                // font: [style] [weight] size[/line-height] family — the weight and size tokens.
                for t in v.split(separator: " ").map(String.init) {
                    if let w = Double(t), (1...1000).contains(w), fontSize == nil { fontWeight = w }
                    else if t == "bold" { fontWeight = 700 }
                    else if fontSize == nil, let px = AWCTableTemplate.length(String(t.split(separator: "/").first ?? "")) { fontSize = px }
                }
            default: break
            }
        }
        fill = fill && absolute
    }
}

// MARK: Rows

/// Row box paint under the cells: group / stripe / selected / highlight background and the row divider.
struct AWCTableRowChrome: View {
    let row: AWCTableRowEntry, index: Int, env: AWCTableEnvironment, selected: Bool, hovered: Bool, last: Bool
    var background: AWCTableColor.RGBA {
        let pal = env.palette
        switch row.group {
        case .head: return AWCTableColor.parse(env.headBackground) ?? (0, 0, 0, 0)
        case .foot: return AWCTableColor.parse(env.footBackground) ?? (0, 0, 0, 0)
        case .body:
            if row.bool("highlight") { return AWCTableColor.parse(pal.hex("primary-container"))! }
            if selected { return env.forcedColors ? AWCTableColor.parse(pal.hex("primary"))! : (AWCTableColor.parse(env.selectedBackground) ?? (0, 0, 0, 0)) }
            if env.striped && row.groupIndex % 2 == 1 { return env.stripeColor }
            return (0, 0, 0, 0)
        }
    }
    var body: some View {
        let divider = AWCTableColor.color(env.dividerHex, "#00000000")
        let clickable = row.group == .body && row.bool("clickable") && !row.bool("disabled")
        Rectangle().fill(AWCTableColor.color(background))
            .overlay(alignment: row.group == .foot ? .top : .bottom) { Rectangle().fill(divider).frame(height: 1) }
            .awcTableMotion("selected:" + row.id, selected ? 1 : 0, env.motion)
            .animation(env.reducedMotion || row.group != .body ? nil : .timingCurve(0.31, 0.94, 0.34, 1, duration: 0.15), value: selected)
            // A click on the row's text or padding (not on its controls, which sit above) is mdRowClick.
            .contentShape(Rectangle())
            .onTapGesture { if clickable { env.rowClick(row.id) } }
            .allowsHitTesting(clickable)
            .accessibilityHidden(true)
    }
}
/// The row's `::before` hover state layer and its focus ring, above unpinned cells.
struct AWCTableRowOverlay: View {
    let row: AWCTableRowEntry, env: AWCTableEnvironment, hovered: Bool
    let activate: () -> Void
    var index = -1, selected = false, expanded = false
    var ariaRowIndex: Int? = nil
    /// aria-selected only under a selection mode, on enabled selectable body rows; aria-expanded only under a treegrid.
    var axSelected: Bool? { env.selection != "none" && row.group == .body && row.bool("selectable", true) && !row.bool("disabled") ? selected : nil }
    var axExpanded: Bool? { env.axMode == .treegrid && row.bool("expandable") ? expanded : nil }
    @State private var focus = AWCButtonFocusHandle()
    @Environment(\.awcTableRowFocus) private var registry
    var on: Bool { hovered && env.hoverable && row.group == .body && !row.bool("disabled") }
    /// A clickable body row is its own tab stop: Enter / Space are mdRowClick (md-table-row.tsx handleKeyDown).
    var focusable: Bool { row.group == .body && row.bool("clickable") && !row.bool("disabled") }
    var body: some View {
        Rectangle().fill(AWCTableColor.color(AWCTableColor.mix(env.hoverColor, 0.08, nil)))
            .opacity(on ? 1 : 0)
            .awcTableMotion("hover:" + row.id, on ? 1 : 0, env.motion)
            .animation(env.reducedMotion ? nil : .timingCurve(0.31, 0.94, 0.34, 1, duration: 0.15), value: on)
            // :focus-visible — 2px secondary outline, offset -2px (inside the row box).
            .overlay { if focus.isFocusVisible { Rectangle().inset(by: 1).stroke(env.palette.color("secondary"), lineWidth: 2) } }
            .background {
                if focusable {
                    // iOS / Android have no row element: the row's tab stop is named by its cells (macOS: the AXRow, see AWCTableAXTree).
                    AWCNativeButtonFocusBridge(configuration: .init(id: row.id, label: AWCTableAX.rowStopLabel(row, env: env),
                        policy: AWCButtonAccessibilityPolicy(properties: [:]), group: nil, cell: nil, handle: focus, focusChanged: { _ in }, activate: activate))
                }
            }
            #if canImport(AppKit)
            .background {
                if !row.node.awcTablePresentational {
                    AWCTableAXMarker(info: .init(kind: .row, label: AWCTableAX.rowName(row, env: env, mode: env.axMode), identifier: row.id, rowID: row.id,
                                                 selected: axSelected, expanded: axExpanded, rowIndex: index, ariaRowIndex: ariaRowIndex, ownerID: env.tableID))
                }
            }
            #endif
            .allowsHitTesting(false)
            .accessibilityHidden(true)
            .awcInspect(nodeID: row.id, part: "focus", name: "row-focus") { _ in ["focused": .bool(focus.isFocused), "focusRing": .bool(focus.isFocusVisible)] }
            .onAppear { registry?.handles[row.id] = focus }
    }
}
/// ::part(icon) colour and box (its opacity is applied by the owner over the state opacity).
struct AWCTableIconPart: ViewModifier {
    let style: AWCTablePartStyle
    @ViewBuilder func body(content: Content) -> some View {
        if let c = style.color { content.foregroundStyle(AWCTableColor.color(c, "#000000")).background { style.backgroundView } }
        else { content.background { style.backgroundView } }
    }
}
/// An expandable row's detail zone (`part="expanded"`): clipped, revealed with the row.
struct AWCTableExpandedZone: View {
    let row: AWCTableRowEntry, env: AWCTableEnvironment, open: Bool, theme: AWCTheme
    let onEvent: (AWCEvent) -> Void
    var body: some View {
        let ex = env.part(.rowExpanded, row.id)
        VStack(alignment: .leading, spacing: 0) {
            ForEach(row.expandedContent) { item in
                AWCTableSlotContent(node: item, theme: theme, color: ex.color(over: env.palette.color("on-surface")), metrics: env.metrics, onEvent: onEvent)
            }
        }
        .padding(.top, 12).padding(.horizontal, env.metrics.padInline).padding(.bottom, 16)
        .frame(maxWidth: .infinity, alignment: .leading)
        // __expanded-inner: translateY(-10px) → 0 on the fast spatial spring (350 ms, 60 ms after the panel) / 150 ms exit;
        // its opacity 200 ms effects curve (60 ms delay) / 100 ms linear.
        .offset(y: open ? 0 : -10)
        .animation(env.reducedMotion ? nil : open ? .timingCurve(0.38, 1.21, 0.22, 1, duration: 0.35).delay(0.06) : .timingCurve(0.3, 0, 0.8, 0.15, duration: 0.15), value: open)
        .opacity(open ? 1 : 0)
        .animation(env.reducedMotion ? nil : open ? .timingCurve(0.34, 0.8, 0.34, 1, duration: 0.2).delay(0.06) : .linear(duration: 0.1), value: open)
        // ::part(expanded) is the panel around the inner content (its background does not slide with the inner offset).
        .awcTablePartBox(ex)
        // __expanded panel opacity: 200 ms effects curve / 200 ms exit curve.
        .opacity(open ? 1 : 0)
        .animation(env.reducedMotion ? nil : open ? .timingCurve(0.34, 0.8, 0.34, 1, duration: 0.2) : .timingCurve(0.3, 0, 0.8, 0.15, duration: 0.2), value: open)
        .clipped()
        .accessibilityHidden(!open)
        .allowsHitTesting(open)
        // inert while collapsed (md-table-row.tsx): no tab stops, no elements inside the clipped panel.
        .awcNativeInert(!open)
    }
}
struct AWCTableSkeletonChrome: View {
    let env: AWCTableEnvironment
    var body: some View {
        // ::part(skeleton-row): the row box behind its bars.
        let st = env.part(.skeletonRow, env.tableID)
        st.fill(over: .clear).overlay(alignment: .bottom) { Rectangle().fill(AWCTableColor.color(env.dividerHex, "#00000000")).frame(height: 1) }.accessibilityHidden(true)
    }
}
/// `.md-table__bar` shimmer (1.4s ease infinite; static under reduced motion).
struct AWCTableSkeletonBar: View {
    let env: AWCTableEnvironment
    var body: some View {
        let high = AWCTableColor.color(env.palette.hex("surface-container-high"), "#ECE6F0"), mid = AWCTableColor.color(env.palette.hex("surface-container"), "#F3EDF7")
        TimelineView(.animation(paused: env.reducedMotion)) { context in
            GeometryReader { box in
                let w = box.size.width, image = w * 4
                // background-size 400%; background-position animates 100% → 0% (ease): offset = -(image - w) * position.
                let t = env.reducedMotion ? 0 : (context.date.timeIntervalSinceReferenceDate.truncatingRemainder(dividingBy: 1.4)) / 1.4
                let position = 1 - AWCNativeLoadingMotion.cubic(t, 0.25, 0.1, 0.25, 1)
                LinearGradient(stops: [.init(color: high, location: 0.25), .init(color: mid, location: 0.37), .init(color: high, location: 0.63)], startPoint: .leading, endPoint: .trailing)
                    .frame(width: image).offset(x: -(image - w) * position)
            }
            .frame(height: 16).clipShape(Capsule())
        }
        .padding(.horizontal, env.metrics.padInline)
        .frame(maxHeight: .infinity)
        .accessibilityHidden(true)
    }
}

// MARK: Cells

/// md-table-cell's flex box: fills the proposed width and height, centres its content vertically and aligns it
/// on the inline axis (SwiftUI mirrors this layout under right-to-left, so `leading` is the inline start).
struct AWCTableCellBox: Layout {
    let align: Alignment
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        guard let s = subviews.first else { return .zero }
        let child = s.sizeThatFits(.init(width: proposal.width, height: nil))
        return CGSize(width: proposal.width ?? child.width, height: Swift.max(child.height, proposal.height ?? 0))
    }
    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        guard let s = subviews.first else { return }
        let child = s.sizeThatFits(.init(width: bounds.width, height: nil))
        let w = Swift.min(child.width, bounds.width)
        let x: CGFloat = align == .trailing ? bounds.maxX - w : align == .center ? bounds.midX - w / 2 : bounds.minX
        s.place(at: CGPoint(x: x, y: bounds.midY - child.height / 2), anchor: .topLeading, proposal: .init(width: w, height: child.height))
    }
}

/// `min-block-size` when a hook sets one (no frame otherwise).
struct AWCTableOptionalMinHeight: ViewModifier {
    let value: Double?
    func body(content: Content) -> some View { if let value { content.frame(minHeight: CGFloat(value)) } else { content } }
}

struct AWCTableCellView: View {
    let cell: AWCNode, row: AWCTableRowEntry, rowIndex: Int, env: AWCTableEnvironment, pinned: String?, selected: Bool, hovered: Bool, theme: AWCTheme
    let checkboxState: (checked: Bool, indeterminate: Bool, disabled: Bool)?
    let onCheckbox: (Bool) -> Void
    let expanded: Bool
    let onEvent: (AWCEvent) -> Void
    var column = -1, span = 1
    /// aria-rowindex of the cell's row (row-count set): the data-table position on iOS.
    var ariaRowIndex: Int? = nil
    func s(_ k: String, _ f: String = "") -> String { cell.properties[k]?.string ?? f }
    func b(_ k: String) -> Bool { cell.properties[k]?.bool ?? false }
    var head: Bool { b("head") }
    var padding: String { ["none", "checkbox"].contains(s("padding")) ? s("padding") : "default" }
    var align: String { ["center", "end", "justify"].contains(s("align")) ? s("align") : "start" }
    var meta: Bool { s("variant") == "meta" }
    /// md-table-cell--pinned (a head cell of a pinned column that advertises its pin): its content keeps to the inline start.
    var pinnedHead: Bool { head && pinned != nil && padding != "checkbox" && !b("noPinIndicator") && row.group != .body }
    /// The pin glyph itself (--md-table-cell-pin-display: none hides only the glyph).
    var showPin: Bool { pinnedHead && vars["--md-table-cell-pin-display"] != "none" }
    /// md-table-row's own declarations (they shadow the row's `:host` rules, e.g. --md-table-cell-sticky-bg).
    var rowOwn: AWCTableVars { AWCTableVars(style: row.node.properties["style"]?.string) }
    /// The cell's custom properties: the table's, under its row's, under its own `style`.
    var vars: AWCTableVars { env.vars.merging(rowOwn).merging(style: s("style")) }
    /// Author colours give way to the system palette under forced colours (like the source's forced-colors rules).
    func hookColor(_ name: String) -> String? { env.forcedColors ? nil : vars.color(name) }
    /// ::part(content) colour over the cell's own (the part wraps the slotted content).
    var color: Color { env.part(.cellContent, cell.id).color(over: baseColor) }
    var baseColor: Color {
        let pal = env.palette
        if let c = hookColor("--md-table-cell-color") { return AWCTableColor.color(c, "#1C1B1F") }
        if env.forcedColors && selected && row.group == .body { return pal.color("on-primary") }
        switch row.group {
        case .head: return AWCTableColor.color(env.headColor, "#49454F")
        case .body:
            if row.bool("disabled") { return env.forcedColors ? pal.color("on-surface") : AWCTableColor.color(AWCTableColor.mix(pal.hex("on-surface"), 0.38, nil)) }
            if row.bool("highlight") { return pal.color("on-primary-container") }
            if selected { return AWCTableColor.color(env.selectedColor, "#1E192B") }
            return meta ? pal.color("on-surface-variant") : pal.color("on-surface")
        case .foot: return meta ? pal.color("on-surface-variant") : pal.color("on-surface")
        }
    }
    var weight: Double { row.group == .body ? 400 : 500 }
    var tracking: Double { row.group == .head ? 0.1 : 0.25 }
    var stickyBase: String {
        switch row.group {
        case .head: return env.headBackground
        case .foot: return env.footBackground
        case .body:
            if selected { return env.forcedColors ? env.palette.hex("primary") : env.selectedBackground }
            if env.striped && row.groupIndex % 2 == 1 { return AWCTableColor.hex(AWCTableColor.mix(env.palette.hex("on-surface"), 0.04, env.surface)) }
            return env.surface
        }
    }
    var stickyBackground: Color {
        // md-table-row stamps --md-table-cell-sticky-bg per state on its host; the row's or the cell's own declaration wins.
        if !env.forcedColors, let own = rowOwn.merging(style: s("style")).color("--md-table-cell-sticky-bg") { return AWCTableColor.color(own, "#FEF7FF") }
        let base = stickyBase
        if row.group == .body && hovered && env.hoverable && !row.bool("disabled") {
            // The sticky hover mix reads the row's --md-table-row-hover-color (md-table-row.css).
            let hover = env.forcedColors ? env.hoverColor : (env.vars.merging(rowOwn).color("--md-table-row-hover-color") ?? env.hoverColor)
            return AWCTableColor.color(AWCTableColor.mix(hover, 0.08, base))
        }
        return AWCTableColor.color(base, "#FEF7FF")
    }
    /// --md-table-cell-sticky-transition (head / foot rows set 0s): the pinned background's timing in ms.
    var stickyTransition: Double {
        if row.group != .body { return rowOwn.merging(style: s("style")).duration("--md-table-cell-sticky-transition") ?? 0 }
        return vars.duration("--md-table-cell-sticky-transition") ?? 150
    }
    var justify: Alignment {
        if padding == "checkbox" { return .center }
        if pinnedHead && (align == "end" || b("numeric")) { return .leading }
        if b("numeric") || align == "end" { return .trailing }
        if align == "center" { return .center }
        return .leading
    }
    var body: some View {
        let m = env.metrics, v = vars
        let size = meta ? 12 : m.fontSize, line = meta ? 16 : m.lineHeight
        let padBlock = v.length("--md-table-cell-padding-block") ?? m.padBlock, padInline = v.length("--md-table-cell-padding-inline") ?? m.padInline
        let transition = stickyTransition
        AWCTableCellBox(align: justify) {
            HStack(spacing: 0) {
                if showPin { pinGlyph.padding(.trailing, 4) }
                content(size: size, line: line).awcTablePartBox(env.part(.cellContent, cell.id)).awcInspect(nodeID: cell.id, part: "content", name: "content")
            }
        }
        .padding(.top, padding == "default" ? padBlock : 0).padding(.bottom, padding == "default" ? padBlock : 0)
        .padding(.leading, padding == "none" ? 0 : padding == "checkbox" ? 4 : padInline)
        .padding(.trailing, padding == "default" ? padInline : 0)
        // min-block-size: --md-table-cell-min-height (border-box; the row grows to its tallest cell).
        .modifier(AWCTableOptionalMinHeight(value: v.length("--md-table-cell-min-height")))
        .background {
            if pinned != nil {
                Rectangle().fill(stickyBackground)
                    .animation(env.reducedMotion || transition <= 0 ? nil : .timingCurve(0.31, 0.94, 0.34, 1, duration: transition / 1000), value: hovered)
                    .allowsHitTesting(false)
            } else if let bg = hookColor("--md-table-cell-background") {
                Rectangle().fill(AWCTableColor.color(bg, "#00000000")).allowsHitTesting(false)
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityAddTraits(head ? .isHeader : [])
        // cell / gridcell / columnheader / rowheader named from content (macOS AXCell with its row / column, controls inside it;
        // iOS a data-table cell).
        .background {
            AWCTableAXMarker(info: .init(kind: .cell, label: AWCTableAX.name(cell, env: env), identifier: cell.id, header: head, rowIndex: rowIndex, columnIndex: column,
                                         columnSpan: span, rowSpan: axRowSpan,
                                         ariaRowIndex: ariaRowIndex, ownerID: row.node.awcTablePresentational ? "" : row.id))
        }
        .awcInspect(nodeID: cell.id, name: "md-table-cell") { size in
            ["role": .string(head ? (["row", "rowgroup"].contains(s("scope")) ? "rowheader" : "columnheader") : "cell"), "pinned": .string(pinned ?? ""),
             "width": .number(Double(size.width)), "height": .number(Double(size.height)), "rowSpan": .number(Double(axRowSpan)), "colSpan": .number(Double(span))]
        }
    }
    /// aria-rowspan as the semantics receive it (R5-12: asserted by the paint suites through the cell's inspection metrics).
    var axRowSpan: Int { Int(cell.properties["rowSpan"]?.number ?? cell.properties["rowspan"]?.number ?? 1).clamped(1, 65534) }
    @ViewBuilder var pinGlyph: some View {
        let icon = s("pinIcon").isEmpty ? env.pinIcon : s("pinIcon")
        let pin = env.part(.cellPin, cell.id)
        let tint = pin.color(over: env.forcedColors ? env.palette.color("on-surface") : AWCTableColor.color(vars.color("--md-table-cell-pin-color") ?? env.palette.hex("primary"), "#6750A4"))
        let size = vars.length("--md-table-cell-pin-size")
        Group {
        if icon.isEmpty {
            AWCTablePinShape().fill(tint).frame(width: size ?? 16, height: size ?? 16).rotationEffect(.degrees(45)).accessibilityHidden(true)
        } else {
            AWCMaterialSymbol(icon, size: size ?? 14).foregroundStyle(tint).accessibilityHidden(true)
        }
        }
        .awcTablePartBox(pin)
    }
    @ViewBuilder func content(size: Double, line: Double) -> some View {
        let kids = cell.children.filter { ($0.slot ?? "").isEmpty }
        let allText = kids.allSatisfy { $0.tag == "#text" || $0.tag == "#slot-text" }
        if allText {
            let text = awcCollapsedInlineText(kids.map(\.authoredTextContent).joined(separator: " "))
            if !text.isEmpty {
                AWCTableText(text: text, size: size, lineHeight: line, weight: weight, tracking: tracking, color: color,
                             lines: head || b("ellipsis") ? 1 : 20, tabular: b("numeric"), alignment: justify == .trailing ? .trailing : justify == .center ? .center : .leading, ellipsis: b("ellipsis"))
                    .allowsHitTesting(false)
            }
        } else {
            HStack(spacing: 0) {
                ForEach(kids) { kid in element(kid, size: size, line: line) }
            }
        }
    }
    @ViewBuilder func element(_ kid: AWCNode, size: Double, line: Double) -> some View {
        switch kid.tag {
        case "#text", "#slot-text":
            AWCTableText(text: awcCollapsedInlineText(kid.authoredTextContent), size: size, lineHeight: line, weight: weight, tracking: tracking, color: color, tabular: b("numeric")).allowsHitTesting(false)
        case "md-table-sort-label":
            AWCTableSortLabelView(node: kid, env: env, vars: vars, textSize: size, lineHeight: line, weight: weight, tracking: tracking, onEvent: onEvent)
        case "md-table-expand-toggle":
            AWCTableExpandToggleView(node: kid, expanded: expanded, rtl: env.rtl, reduced: env.reducedMotion, vars: vars, toggle: { env.toggleRow(row.id) }, onEvent: onEvent)
        case "md-checkbox":
            checkbox(kid)
        default:
            AWCTableSlotContent(node: kid, theme: theme, color: color, metrics: env.metrics, weight: weight, tracking: tracking, size: size, lineHeight: line, onEvent: onEvent)
        }
    }
    func overridden(_ kid: AWCNode, _ state: (checked: Bool, indeterminate: Bool, disabled: Bool)) -> AWCNode {
        var n = kid
        n.properties["checked"] = .bool(state.checked); n.properties["indeterminate"] = .bool(state.indeterminate); n.properties["disabled"] = .bool(state.disabled)
        return n
    }
    @ViewBuilder func checkbox(_ kid: AWCNode) -> some View {
        if let state = checkboxState {
            AWCNativeView(node: overridden(kid, state)) { event in
                onEvent(event)
                if event.name == "mdChange", event.nodeID == kid.id { onCheckbox(event.detail["checked"].bool ?? false) }
            }
        } else {
            AWCNativeView(node: kid, onEvent: onEvent)
        }
    }
}

// MARK: Sort label

/// md-table-sort-label: button role, arrow at rest 0.38 (hover 0.6, active 1), 180° for descending.
struct AWCTableSortLabelView: View {
    let node: AWCNode, env: AWCTableEnvironment?
    /// The enclosing cell's custom properties (nil: the environment's, for a label outside a table).
    var vars: AWCTableVars? = nil
    var textSize = 14.0, lineHeight = 20.0, weight = 500.0, tracking = 0.1
    let onEvent: (AWCEvent) -> Void
    @State private var pointerHovered = false
    @State private var frame: CGRect = .zero
    @State private var focus = AWCButtonFocusHandle()
    @Environment(\.awcNativePointerState) private var pointer
    var hovered: Bool { pointerHovered || (pointer?.location.map { frame.contains($0) } ?? false) }
    @Environment(\.awcTheme) private var customTheme
    @Environment(\.colorScheme) private var scheme
    func s(_ k: String, _ f: String = "") -> String { node.properties[k]?.string ?? f }
    func b(_ k: String) -> Bool { node.properties[k]?.bool ?? false }
    var column: String { s("column") }
    var active: Bool { env.map { !column.isEmpty && column == $0.sortBy } ?? b("active") }
    var order: String { active ? (env?.sortOrder ?? (["asc", "desc"].contains(s("order")) ? s("order") : "asc")) : "none" }
    var disabled: Bool { b("disabled") }
    @Environment(\.awcTableForcedColors) private var forcedColors
    @Environment(\.awcTableVars) private var inheritedVars
    @Environment(\.awcTableParts) private var partRules
    @Environment(\.awcTablePartTargets) private var partTargets
    /// ::part(label) / ::part(icon) of this label.
    func part(_ p: AWCTablePart) -> AWCTablePartStyle { .resolve(p, node.id, partRules, partTargets, forced: forcedColors) }
    var palette: AWCTablePalette { env?.palette ?? AWCTablePalette(tokens: (customTheme ?? .generated(dark: scheme == .dark)).tokens, forced: forcedColors) }
    /// --md-table-sort-label-* (the label's own declarations over the cell's / container's).
    var hooks: AWCTableVars { (vars ?? inheritedVars).merging(style: s("style")) }
    var forced: Bool { env?.forcedColors ?? forcedColors }
    var activeColor: String { (forced ? nil : hooks.color("--md-table-sort-label-active-color")) ?? palette.hex("primary") }
    /// --md-sys-spacing-gap-xs at the label's own density (2 at -4).
    var gapXS: Double {
        if let d = node.properties["density"]?.number, [-1.0, -2, -3, -4].contains(d) { return d <= -4 ? 2 : 4 }
        return env?.metrics.gapXS ?? 4
    }
    /// The hover rule (`:host(:hover:not(--disabled))`, specificity 0,4,0) beats the active one (0,3,0); focus-visible ties with
    /// active and loses to it (source order).
    var iconOpacity: Double {
        if hovered && !disabled { return 0.6 }
        if active { return 1 }
        if focus.isFocusVisible { return 0.6 }
        return s("inactiveIcon") == "hover" ? 0 : (hooks.number("--md-table-sort-label-rest-opacity").map { Swift.min(1, Swift.max(0, $0)) } ?? 0.38)
    }
    var iconSize: Double { hooks.length("--md-table-sort-label-icon-size") ?? 18 }
    var body: some View {
        let colorHex = (active || (hovered && !disabled)) ? activeColor : sortLabelColor
        let reduced = env?.reducedMotion ?? false
        // A pointer click focuses the label (tabindex 0) without a visible ring, as Chrome does on mousedown.
        // The press runs outside the button style's transaction (UIKit hands the action an animated one): the arrow's own
        // curve (or none, with reduced motion) is the only animation of the sort change.
        Button { withTransaction(Transaction(animation: nil)) { _ = focus.requestPointerFocus?(); activate() } } label: {
            HStack(spacing: hooks.length("--md-table-sort-label-gap") ?? gapXS) {
                if s("iconPosition") == "start" { arrow }
                let lbl = part(.sortLabelLabel)
                AWCTableText(text: awcCollapsedInlineText(node.authoredTextContent), size: lbl.size(over: textSize), lineHeight: lineHeight, weight: lbl.weight(over: weight), tracking: lbl.letterSpacing ?? tracking,
                             color: lbl.color(over: AWCTableColor.color(colorHex, "#1C1B1F")))
                    .awcTablePartBox(lbl)
                if s("iconPosition") != "start" { arrow }
            }
            .foregroundStyle(AWCTableColor.color(colorHex, "#1C1B1F"))
            .padding(.vertical, 2).padding(.horizontal, 4)
            .contentShape(RoundedRectangle(cornerRadius: 4))
        }
        .buttonStyle(.plain)
        .focusEffectDisabled()
        // The focus surface below is the label's one element (named with its sort status, as Chrome names it).
        .accessibilityHidden(true)
        // :focus-visible — 3px secondary outline, offset 2px, following the 4px corners.
        .overlay { if focus.isFocusVisible { RoundedRectangle(cornerRadius: 7.5).inset(by: -3.5).stroke(palette.color("secondary"), lineWidth: 3).allowsHitTesting(false) } }
        .background {
            AWCNativeButtonFocusBridge(configuration: .init(id: node.id, label: AWCTableAX.sortLabelName(node, env: env),
                policy: AWCButtonAccessibilityPolicy(properties: node.properties), group: nil, cell: nil, handle: focus, focusChanged: { _ in }, activate: { activate() }))
        }
        .padding(.horizontal, -4)
        .opacity(disabled ? 0.6 : 1)
        .disabled(disabled)
        .onHover { pointerHovered = $0 }
        .onGeometryChange(for: CGRect.self) { $0.frame(in: .named("awc-native-preview")) } action: { frame = $0 }
        .animation(reduced ? nil : .timingCurve(0.31, 0.94, 0.34, 1, duration: 0.15), value: hovered)
        .animation(reduced ? nil : .timingCurve(0.42, 1.67, 0.21, 0.9, duration: 0.35), value: order)
        // The sr-only status span is aria-live="polite": a new sort state is announced.
        .onChange(of: active ? order : "none") { _, new in
            if new != "none" { AWCTableAX.announce(new == "desc" ? s("sortedDescendingLabel", "sorted descending") : s("sortedAscendingLabel", "sorted ascending")) }
        }
        .awcInspect(nodeID: node.id, name: "md-table-sort-label") { _ in
            ["active": .bool(active), "order": .string(order), "iconOpacity": .number(iconOpacity), "hover": .bool(hovered), "focused": .bool(focus.isFocused), "focusRing": .bool(focus.isFocusVisible)]
        }
    }
    /// `--md-table-sort-label-color` (vibrant containers: on-primary-container).
    var sortLabelColor: String { (forced ? nil : hooks.color("--md-table-sort-label-color")) ?? (env?.vibrant == true ? palette.hex("on-primary-container") : palette.hex("on-surface")) }
    @ViewBuilder var arrow: some View {
        Group {
            if s("icon").isEmpty { AWCTableArrowShape().frame(width: iconSize, height: iconSize) }
            else { AWCMaterialSymbol(s("icon"), size: iconSize).frame(width: iconSize, height: iconSize) }
        }
        .modifier(AWCTableIconPart(style: part(.sortLabelIcon)))
        .opacity(part(.sortLabelIcon).opacity ?? iconOpacity)
        .awcTableMotion("sort-op:" + node.id, part(.sortLabelIcon).opacity ?? iconOpacity, env?.motion)
        // Every opacity change (hover, focus-visible, active) runs the source's opacity transition (150 ms effects curve).
        .animation((env?.reducedMotion ?? false) ? nil : .timingCurve(0.31, 0.94, 0.34, 1, duration: 0.15), value: iconOpacity)
        .rotationEffect(.degrees(active && order == "desc" ? 180 : 0))
        .awcTableMotion("sort-rot:" + node.id, active && order == "desc" ? 1 : 0, env?.motion)
        .accessibilityHidden(true)
    }
    func activate() {
        guard !disabled, !column.isEmpty else { return }
        // md-table stops mdSortRequest at its boundary and answers with mdSortChange; a label alone lets it bubble.
        if let env { env.requestSort(column, s("defaultOrder") == "desc" ? "desc" : "asc") }
        else { onEvent(AWCEvent(name: "mdSortRequest", tag: "md-table-sort-label", nodeID: node.id, detail: ["column": .string(column), "defaultOrder": .string(s("defaultOrder") == "desc" ? "desc" : "asc")])) }
    }
}

// MARK: Expand toggle

/// md-table-expand-toggle: an xs md-icon-button rotated 90° while its row is expanded (mirrored in RTL, T3).
struct AWCTableExpandToggleView: View {
    let node: AWCNode, expanded: Bool, rtl: Bool, reduced: Bool
    var vars: AWCTableVars? = nil
    @Environment(\.awcTableMotionRecorder) private var motion
    @Environment(\.awcTableVars) private var inheritedVars
    let toggle: () -> Void
    let onEvent: (AWCEvent) -> Void
    /// --md-table-expand-toggle-rotation (expanded; default 90°).
    var rotation: Double { (vars ?? inheritedVars).merging(style: node.properties["style"]?.string).angle("--md-table-expand-toggle-rotation") ?? 90 }
    var body: some View {
        let label = node.properties["buttonLabel"]?.string ?? "Expand row"
        let icon = node.properties["icon"]?.string ?? "chevron_right"
        let button = AWCNode(id: node.id + "-button", tag: "md-icon-button", properties: ["size": "xs", "icon": .string(icon.isEmpty ? "chevron_right" : icon), "ariaLabel": .string(label)])
        AWCNativeView(node: button) { event in
            // Pointer: the toggle's click handler opens the row before the inner button's mdClick reaches the page;
            // keyboard: the button's key handler emits mdClick first, then the click toggles.
            guard event.name == "mdClick" else { onEvent(event); return }
            if event.activation?.source == .pointer { toggle(); onEvent(event) } else { onEvent(event); toggle() }
        }
        .scaleEffect(x: rtl ? -1 : 1, y: 1)
        .rotationEffect(.degrees(expanded ? (rtl ? -rotation : rotation) : 0))
        // Probe in the source's terms: the caret's matrix angle / 90° (RTL scaleX(-1) rotate(r): 180° closed, 180° − r open).
        .awcTableMotion("caret:" + node.id, rtl ? (expanded ? (180 - rotation) / 90 : 2) : (expanded ? rotation / 90 : 0), motion)
        .animation(reduced ? nil : .timingCurve(0.42, 1.67, 0.21, 0.9, duration: 0.35), value: expanded)
        .accessibilityValue(expanded ? "expanded" : "collapsed")
        .awcInspect(nodeID: node.id, name: "md-table-expand-toggle") { _ in ["expanded": .bool(expanded), "rotation": .number(rotation)] }
    }
}
