import SwiftUI
import Observation

/// Live link between an md-table-container's table and its auto-bound toolbar / pagination.
@Observable final class AWCTableContainerLink {
    var selectionCount: Int? = nil
}
private struct AWCTableContainerLinkKey: EnvironmentKey { static let defaultValue: AWCTableContainerLink? = nil }
extension EnvironmentValues {
    var awcTableContainerLink: AWCTableContainerLink? { get { self[AWCTableContainerLinkKey.self] } set { self[AWCTableContainerLinkKey.self] = newValue } }
}

// MARK: Container

/// md-table-container: surface variants, shape, elevation, vibrant palette, top / bottom slots and the
/// horizontal (and, with max-height, vertical) scrollport the table pins and sticks within.
struct AWCNativeTableContainer: View {
    let node: AWCNode, theme: AWCTheme
    let onEvent: (AWCEvent) -> Void
    @State private var link = AWCTableContainerLink()
    @Environment(\.awcTableForcedColors) private var forcedColors
    @State private var offset: CGPoint = .zero
    @State private var viewport: CGSize = .zero
    @Environment(\.layoutDirection) private var direction
    @Environment(\.awcTableVars) private var inheritedVars
    func s(_ k: String, _ f: String = "") -> String { node.properties[k]?.string ?? f }
    func b(_ k: String) -> Bool { node.properties[k]?.bool ?? false }
    var palette: AWCTablePalette { AWCTablePalette(tokens: theme.tokens, forced: forcedColors) }
    /// The family's custom properties at the container (its own `style` over inherited ones).
    var vars: AWCTableVars { inheritedVars.merging(style: s("style")) }
    var variant: String { ["outlined", "filled", "flat"].contains(s("variant")) ? s("variant") : "elevated" }
    /// The `shape` class always sets the radius (--md-table-container-shape is the base the classes override; readme).
    var radius: Double { ["extra-large": 28, "large": 16, "medium": 12, "small": 8, "none": 0][s("shape", "large")] ?? 16 }
    /// --md-table-surface: each variant rule re-sets it on the host; an authored declaration wins (and
    /// --md-table-container-color, the base background, is always covered by a variant rule — readme).
    var surface: String {
        if !forcedColors, let v = vars.color("--md-table-surface") { return v }
        return variant == "elevated" || variant == "filled" ? palette.hex("surface-container-low") : palette.hex("surface")
    }
    var outlineWidth: Double { variant == "outlined" ? (vars.length("--md-table-container-outline-width") ?? 1) : 0 }
    var outlineColor: Color { AWCTableColor.color((forcedColors ? nil : vars.color("--md-table-container-outline-color")) ?? palette.hex("outline-variant"), "#CAC4D0") }
    var background: AWCTableColor.RGBA {
        if b("vibrant") && !forcedColors { return AWCTableColor.mix(palette.hex("primary"), 0.06, palette.hex("surface")) }
        return variant == "flat" ? (0, 0, 0, 0) : AWCTableColor.parse(surface) ?? (0, 0, 0, 0)
    }
    var shadow: [AWCBoxShadow] {
        if forcedColors { return [] }
        if let e = node.properties["elevation"]?.number { return AWCBoxShadow.source(theme.tokens["--md-sys-elevation-\(Int(e))"] ?? "none") ?? [] }
        guard variant == "elevated" else { return [] }
        if let hook = vars.shadow("--md-table-container-elevation") { return hook }
        return AWCBoxShadow.source(theme.tokens["--md-sys-elevation-1"] ?? "0 1px 2px rgba(0, 0, 0, 0.08)") ?? []
    }
    var maxHeight: Double? { AWCTableTemplate.length(s("maxHeight")) }
    var minHeight: Double? { AWCTableTemplate.length(s("minHeight")) }
    var body: some View {
        let top = node.children.filter { $0.slot == "top" }, bottom = node.children.filter { $0.slot == "bottom" }
        let main = node.children.filter { ($0.slot ?? "").isEmpty }
        let frozen = main.contains { $0.tag == "md-table" && ($0.properties["frozenHeader"]?.bool ?? false) }
        let context = AWCTableContainerContext(surface: surface, bodyMaxHeight: frozen ? maxHeight : nil, vibrant: b("vibrant"), hasBottomBar: !bottom.isEmpty, inContainer: true)
        let corners = AWCCornerShape.points(radius)
        VStack(spacing: 0) {
            ForEach(top) { AWCNativeView(node: $0, onEvent: onEvent) }
            if frozen { ForEach(main) { AWCNativeView(node: $0, onEvent: onEvent) } }
            else { scrollport(main) }
            ForEach(bottom) { AWCNativeView(node: $0, onEvent: onEvent) }
        }
        .padding(outlineWidth)
        .frame(maxWidth: .infinity, alignment: .topLeading)
        .background(AWCTableColor.color(background))
        .clipShape(RoundedRectangle(cornerRadius: radius, style: .circular))
        .overlay {
            if variant == "outlined" && outlineWidth > 0 { RoundedRectangle(cornerRadius: radius, style: .circular).strokeBorder(outlineColor, lineWidth: outlineWidth) }
        }
        .background { if !shadow.isEmpty { AWCNativeBoxShadow(corners: corners, layers: shadow, placement: .outer) } }
        .environment(\.awcTableContainer, context)
        .environment(\.awcTableContainerLink, link)
        .environment(\.awcTableVars, vars)
        .onPreferenceChange(AWCTableSelectionCountKey.self) { count in if let count { link.selectionCount = count } }
        .awcInspect(nodeID: node.id, name: "md-table-container") { _ in ["variant": .string(variant), "radius": .number(radius), "scrollX": .number(Double(offset.x)), "scrollY": .number(Double(offset.y))] }
    }
    @ViewBuilder func scrollport(_ main: [AWCNode]) -> some View {
        let vertical = maxHeight != nil
        // A horizontal-only scrollport takes its content's height (it grows and shrinks with the rows directly); a capped
        // one (max-height) is sized from the measured content.
        if vertical {
            scroller(main, vertical: true).frame(height: Swift.max(CGFloat(minHeight ?? 0), Swift.min(content.height, CGFloat(maxHeight ?? .infinity))))
        } else {
            scroller(main, vertical: false).frame(minHeight: minHeight.map { CGFloat($0) })
        }
    }
    @ViewBuilder func scroller(_ main: [AWCNode], vertical: Bool) -> some View {
        ScrollView(vertical ? [.horizontal, .vertical] : .horizontal, showsIndicators: true) {
            VStack(spacing: 0) { ForEach(main) { AWCNativeView(node: $0, onEvent: onEvent) } }
                .environment(\.awcTableScroll, .init(offset: offset, viewport: viewport == .zero ? nil : viewport, fill: viewport.width > 0 ? Double(viewport.width) : nil))
                .onGeometryChange(for: CGRect.self) { $0.frame(in: .named("awc-table-scroll")) } action: { frame in
                    let physicalX = -Double(frame.minX), maxX = Swift.max(0, Double(frame.width - viewport.width))
                    let logicalX = direction == .rightToLeft ? maxX - physicalX : physicalX
                    let next = CGPoint(x: Swift.max(0, logicalX), y: Swift.max(0, -Double(frame.minY)))
                    // Applied on the next turn of the run loop: a state change made inside the geometry pass waits for the next
                    // display update, which a content change alone (rows paged in) does not request.
                    DispatchQueue.main.async {
                        if content != frame.size { content = frame.size }
                        if next != offset { offset = next }
                    }
                }
                .background { AWCTableScrollBridge(controller: scrollController ?? ownScroller, arrowScroll: true) }
        }
        .coordinateSpace(name: "awc-table-scroll")
        .scrollBounceBehavior(.basedOnSize)
        .onGeometryChange(for: CGSize.self) { $0.size } action: { viewport = $0 }
    }
    @State private var content: CGSize = .zero
    @State private var ownScroller = AWCTableScrollController()
    @Environment(\.awcTableScrollController) private var scrollController
}
struct AWCTableScrollOffsetKey: PreferenceKey {
    static var defaultValue: CGRect = .zero
    static func reduce(value: inout CGRect, nextValue: () -> CGRect) { let n = nextValue(); if n != .zero { value = n } }
}
struct AWCTableSelectionCountKey: PreferenceKey {
    static var defaultValue: Int? = nil
    static func reduce(value: inout Int?, nextValue: () -> Int?) { value = nextValue() ?? value }
}

// MARK: Toolbar

/// md-table-toolbar: headline / supporting text, leading / actions slots, and the selection band
/// (`num-selected > 0`, or the container table's selection with `auto-bind`).
struct AWCNativeTableToolbar: View {
    let node: AWCNode, theme: AWCTheme
    let onEvent: (AWCEvent) -> Void
    @Environment(\.awcTableContainerLink) private var link
    @Environment(\.awcNativeDensity) private var inheritedDensity
    @Environment(\.accessibilityReduceMotion) private var systemReduced
    @Environment(\.awcTableReducedMotion) private var reducedOverride
    @Environment(\.awcTableForcedColors) private var forcedColors
    @Environment(\.awcTableMotionRecorder) private var motion
    @Environment(\.awcTableVars) private var inheritedVars
    func s(_ k: String, _ f: String = "") -> String { node.properties[k]?.string ?? f }
    func b(_ k: String) -> Bool { node.properties[k]?.bool ?? false }
    var palette: AWCTablePalette { AWCTablePalette(tokens: theme.tokens, forced: forcedColors) }
    var vars: AWCTableVars { inheritedVars.merging(style: s("style")) }
    func hookColor(_ name: String) -> String? { forcedColors ? nil : vars.color(name) }
    var count: Int { b("autoBind") ? (link?.selectionCount ?? Int(node.properties["numSelected"]?.number ?? 0)) : Int(node.properties["numSelected"]?.number ?? 0) }
    var body: some View {
        let scale = AWCNativeDensity.resolve(node.properties["density"]?.number, inherited: inheritedDensity)
        let compact = b("compact"), selection = count > 0, reduced = reducedOverride ?? systemReduced
        let v = vars
        let gap = Swift.max(8, 16 + scale * 2), padInline = v.length("--md-table-toolbar-padding-inline") ?? Swift.max(12, 24 + scale * 2)
        // min-block-size applies to the content box; padding-block is --md-sys-spacing-inset-md (12, 8 from -2); `compact` wins over the hooks.
        let minH = compact ? 48 : v.length("--md-table-toolbar-min-height") ?? 64 + scale * 4
        let padBlock = compact ? 6.0 : v.length("--md-table-toolbar-padding-block") ?? (scale <= -2 ? 8 : 12)
        let fgHex = selection ? hookColor("--md-table-toolbar-selection-color") ?? palette.hex("on-secondary-container") : hookColor("--md-table-toolbar-color") ?? palette.hex("on-surface")
        let fg = AWCTableColor.color(fgHex, "#1C1B1F")
        let bg = selection ? AWCTableColor.color(hookColor("--md-table-toolbar-selection-bg") ?? palette.hex("secondary-container"), "#E8DEF8")
                           : hookColor("--md-table-toolbar-bg").map { AWCTableColor.color($0, "#00000000") } ?? Color.clear
        let leading = node.children.filter { $0.slot == "leading" }
        let actions = node.children.filter { $0.slot == (selection ? "selection-actions" : "actions") }
        HStack(spacing: gap) {
            if selection { Color.clear.frame(width: 0, height: 0) }   // the empty leading part still takes a flex gap
            else if !leading.isEmpty { HStack(spacing: 8) { ForEach(leading) { AWCNativeView(node: $0, onEvent: onEvent) } } }
            Group {
                if selection {
                    AWCTableText(text: awcTableSelectedLabel(s("labelSelected", "%count% selected"), count: count),
                                 size: Swift.max(13, 16 + scale * 0.5), lineHeight: Swift.max(18, 24 + scale), weight: 500, tracking: 0, color: fg)
                        .modifier(AWCTableAXText(text: awcTableSelectedLabel(s("labelSelected", "%count% selected"), count: count)))
                        .transition(reduced ? .identity : .opacity.combined(with: .offset(x: -8)))
                } else {
                    let slotMetrics = AWCTableMetrics(density: nil, inheritedScale: scale)
                    let headlineSlot = node.children.filter { $0.slot == "headline" }, supportingSlot = node.children.filter { $0.slot == "supporting-text" }
                    VStack(alignment: .leading, spacing: 2) {
                        // The headline / supporting-text slots replace the property text (rendered only while that property is set).
                        if !s("headline").isEmpty {
                            let size = compact ? 16 : Swift.max(16, 22 + scale), line = compact ? 24 : Swift.max(22, 28 + scale)
                            Group {
                                if headlineSlot.isEmpty { AWCTableText(text: s("headline"), size: size, lineHeight: line, weight: 400, tracking: 0, color: fg) }
                                else { ForEach(headlineSlot) { AWCTableSlotContent(node: $0, theme: theme, color: fg, metrics: slotMetrics, weight: 400, tracking: 0, size: size, lineHeight: line, onEvent: onEvent) } }
                            }
                            .accessibilityAddTraits(.isHeader)
                            .modifier(AWCTableAXText(text: headlineSlot.isEmpty ? s("headline") : awcCollapsedInlineText(headlineSlot.map(\.authoredTextContent).joined(separator: " ")), heading: true))
                        }
                        if !s("supportingText").isEmpty {
                            Group {
                                if supportingSlot.isEmpty { AWCTableText(text: s("supportingText"), size: 14, lineHeight: 20, weight: 400, tracking: 0.25, color: palette.color("on-surface-variant")) }
                                else { ForEach(supportingSlot) { AWCTableSlotContent(node: $0, theme: theme, color: palette.color("on-surface-variant"), metrics: slotMetrics, weight: 400, tracking: 0.25, size: 14, lineHeight: 20, onEvent: onEvent) } }
                            }
                            .modifier(AWCTableAXText(text: supportingSlot.isEmpty ? s("supportingText") : awcCollapsedInlineText(supportingSlot.map(\.authoredTextContent).joined(separator: " "))))
                        }
                        if s("headline").isEmpty && s("supportingText").isEmpty { ForEach(node.children.filter { $0.slot == "title-area" }) { AWCNativeView(node: $0, onEvent: onEvent) } }
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            HStack(spacing: Swift.max(0, 4 + scale)) { ForEach(actions) { AWCNativeView(node: $0, onEvent: onEvent) } }
                .awcIconButtonAppearance(.init(iconSize: Swift.max(18, 24 + scale), width: Swift.max(32, 40 + scale * 4), height: Swift.max(32, 40 + scale * 4)))
        }
        .foregroundStyle(fg)
        .frame(minHeight: minH)
        .padding(.vertical, padBlock).padding(.horizontal, padInline)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(bg)
        .awcTableMotion("toolbar:" + node.id, selection ? 1 : 0, motion)
        .animation(reduced ? nil : .timingCurve(0.34, 0.8, 0.34, 1, duration: 0.2), value: selection)
        // role="toolbar" named by the headline (macOS AXToolbar); the selection caption is aria-live="polite".
        .modifier(AWCTableAXRoot(kind: .toolbar, label: s("headline").isEmpty ? "Table toolbar" : s("headline"), identifier: node.id))
        .onChange(of: selection ? awcTableSelectedLabel(s("labelSelected", "%count% selected"), count: count) : "") { _, caption in AWCTableAX.announce(caption) }
        .awcInspect(nodeID: node.id, name: "md-table-toolbar") { _ in ["selectionMode": .bool(selection), "numSelected": .number(Double(count))] }
    }
}

// MARK: Pagination

/// md-table-pagination: range text, rows-per-page select, previous / next (and first / last) buttons.
struct AWCNativeTablePagination: View {
    let node: AWCNode, theme: AWCTheme
    let onEvent: (AWCEvent) -> Void
    @State private var page: Int? = nil
    @State private var rowsPerPage: Int? = nil
    @State private var authored: [String: AWCValue] = [:]
    @Environment(\.awcNativeDensity) private var inheritedDensity
    @Environment(\.layoutDirection) private var direction
    @Environment(\.awcTableForcedColors) private var forcedColors
    @Environment(\.awcTablePaginationControllers) private var controllers
    @Environment(\.awcTableVars) private var inheritedVars
    @State private var handle = AWCTablePaginationHandle()
    func s(_ k: String, _ f: String = "") -> String { node.properties[k]?.string ?? f }
    func b(_ k: String) -> Bool { node.properties[k]?.bool ?? false }
    var palette: AWCTablePalette { AWCTablePalette(tokens: theme.tokens, forced: forcedColors) }
    var vars: AWCTableVars { inheritedVars.merging(style: s("style")) }
    func connect() -> Bool {
        handle.goToPage = { go($0) }; handle.setRowsPerPage = { setRows($0) }
        handle.state = { (model.clampedPage, model.rowsPerPage) }
        if let c = controllers[node.id], c.handle !== handle { c.handle = handle }
        return true
    }
    var model: AWCTablePaginationModel {
        AWCTablePaginationModel(count: Int(node.properties["count"]?.number ?? 0), page: page ?? Int(node.properties["page"]?.number ?? 0),
                                rowsPerPage: rowsPerPage ?? Int(node.properties["rowsPerPage"]?.number ?? 10))
    }
    func emit(_ name: String, _ detail: AWCValue) { onEvent(AWCEvent(name: name, tag: "md-table-pagination", nodeID: node.id, detail: detail)) }
    func go(_ target: Int) {
        let m = model, t = Swift.max(0, Swift.min(target, m.lastPage))
        guard t != m.clampedPage else { return }
        page = t; emit("mdPageChange", ["page": .number(Double(t))])
    }
    func setRows(_ n: Int) {
        guard n > 0, n != model.rowsPerPage else { return }
        rowsPerPage = n; page = 0
        emit("mdRowsPerPageChange", ["rowsPerPage": .number(Double(n))]); emit("mdPageChange", ["page": 0])
    }
    var body: some View {
        let scale = AWCNativeDensity.resolve(node.properties["density"]?.number, inherited: inheritedDensity)
        let m = model, compact = b("compact"), disabled = b("disabled")
        let _ = connect()
        let v = vars
        let fg = AWCTableColor.color((forcedColors ? nil : v.color("--md-table-pagination-color")) ?? palette.hex("on-surface-variant"), "#49454F")
        let bg = (forcedColors ? nil : v.color("--md-table-pagination-bg")).map { AWCTableColor.color($0, "#00000000") } ?? Color.clear
        let size = Swift.max(10, 12 + scale * 0.5), line = Swift.max(14, 16 + scale * 0.5)
        let options = AWCTablePaginationModel.options(s("rowsPerPageOptions", "5,10,25,50"), count: m.count, labelAll: s("labelAll", "All"))
        let selectDensity = scale <= -2 ? Swift.max(-4, scale) : -2
        // The select's width calc resolves against its own density (md-table-pagination.css): max(56, 80 + density × 4).
        let selectWidth = v.length("--md-table-pagination-select-width") ?? Swift.max(56, 80 + selectDensity * 4)
        let select = AWCNode(id: node.id + "-rpp", tag: "md-select", properties: [
            "options": .array(options.map { ["value": .string(String($0.value)), "label": .string($0.label)] }), "value": .string(String(m.rowsPerPage)),
            "density": .number(selectDensity), "disabled": .bool(disabled), "placement": "top-start", "ariaLabel": .string(s("labelRowsPerPage", "Rows per page:"))])
        HStack(spacing: compact ? 12 : Swift.max(12, 24 + scale * 3)) {
            AWCTableText(text: m.display(s("labelDisplayedRows", "%from%–%to% of %count%")), size: size, lineHeight: line, weight: 400, tracking: 0.4, color: fg)
                .modifier(AWCTableAXText(text: m.display(s("labelDisplayedRows", "%from%–%to% of %count%"))))
                .frame(maxWidth: .infinity, alignment: .leading)
            HStack(spacing: Swift.max(4, 8 + scale)) {
                AWCTableText(text: s("labelRowsPerPage", "Rows per page:"), size: size, lineHeight: line, weight: 400, tracking: 0.4, color: fg).accessibilityHidden(true)
                // The internal select's and buttons' events stop at the pagination (onInternalChrome); only
                // mdPageChange / mdRowsPerPageChange reach the application.
                AWCNativeView(node: select) { event in
                    if !["mdChange", "mdClick", "mdOpen", "mdClose"].contains(event.name) { onEvent(event) }
                    if event.name == "mdChange", let n = Int(event.detail.string.isEmpty ? event.detail["value"].string : event.detail.string) { setRows(n) }
                }
                .frame(width: selectWidth, height: 56 + selectDensity * 4)
                .awcInspect(nodeID: node.id, part: "rpp", name: "rpp-select")
            }
            .fixedSize()
            HStack(spacing: Swift.max(0, 4 + scale)) {
                if b("showFirstLast") { navButton("first_page", s("labelFirstPage", "First page"), disabled || m.clampedPage == 0) { go(0) } }
                navButton("chevron_left", s("labelPreviousPage", "Previous page"), disabled || m.clampedPage == 0) { go(m.clampedPage - 1) }
                navButton("chevron_right", s("labelNextPage", "Next page"), disabled || m.clampedPage >= m.lastPage) { go(m.clampedPage + 1) }
                if b("showFirstLast") { navButton("last_page", s("labelLastPage", "Last page"), disabled || m.clampedPage >= m.lastPage) { go(m.lastPage) } }
                ForEach(node.children.filter { $0.slot == "actions" }) { AWCNativeView(node: $0, onEvent: onEvent) }
            }
            .awcIconButtonAppearance(.init(iconSize: Swift.max(18, 24 + scale), width: Swift.max(32, 40 + scale * 4), height: Swift.max(32, 40 + scale * 4)))
            #if canImport(AppKit)
            .accessibilityHidden(true)   // listed by the landmark through their focus surfaces
            #endif
        }
        // `compact` wins over --md-table-pagination-padding-block. The source declares --md-table-pagination-padding-inline
        // (--_pad-inline) but its padding-inline never reads it: the hook has no effect there, and none here (decision log).
        .padding(.vertical, compact ? 4 : v.length("--md-table-pagination-padding-block") ?? (scale <= -3 ? 4 : 8)).padding(.horizontal, Swift.max(8, 16 + scale * 2))
        .frame(maxWidth: .infinity)
        .background(bg)
        .opacity(disabled ? 0.6 : 1)
        .allowsHitTesting(!disabled)
        .onChange(of: node.properties) { old, new in
            if old["page"] != new["page"] { page = nil }
            if old["rowsPerPage"] != new["rowsPerPage"] { rowsPerPage = nil }
        }
        // role="navigation" (aria-label); the range text is aria-live="polite".
        .modifier(AWCTableAXRoot(kind: .landmark, label: s("label", "Pagination"), identifier: node.id, hideContent: false))
        .onChange(of: m.display(s("labelDisplayedRows", "%from%–%to% of %count%"))) { _, text in AWCTableAX.announce(text) }
        .awcInspect(nodeID: node.id, name: "md-table-pagination") { _ in ["page": .number(Double(m.clampedPage)), "rowsPerPage": .number(Double(m.rowsPerPage)), "lastPage": .number(Double(m.lastPage)), "display": .string(m.display(s("labelDisplayedRows", "%from%–%to% of %count%"))),
             "firstDisabled": .bool(disabled || m.clampedPage == 0), "prevDisabled": .bool(disabled || m.clampedPage == 0),
             "nextDisabled": .bool(disabled || m.clampedPage >= m.lastPage), "lastDisabled": .bool(disabled || m.clampedPage >= m.lastPage)] }
    }
    @ViewBuilder func navButton(_ icon: String, _ label: String, _ disabled: Bool, _ action: @escaping () -> Void) -> some View {
        let button = AWCNode(id: node.id + "-" + icon, tag: "md-icon-button", properties: ["size": "sm", "icon": .string(icon), "ariaLabel": .string(label), "disabled": .bool(disabled)])
        AWCNativeView(node: button) { event in
            if !["mdChange", "mdClick", "mdOpen", "mdClose"].contains(event.name) { onEvent(event) }
            if event.name == "mdClick" { action() }
        }
            .scaleEffect(x: direction == .rightToLeft ? -1 : 1, y: 1)
    }
}
