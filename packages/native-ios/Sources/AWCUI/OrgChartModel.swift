import CoreText
import SwiftUI

// md-organization-chart: data, appearance hooks, metrics and the CSS layout model (the flex tree and the pseudo-element
// connectors of md-organization-chart.css), shared by the SwiftUI renderer and its tests. Geometry is in CSS px (points).

/// One `OrgChartNode` of the source: `id`, `name` required; `children: []` is a leaf.
public struct AWCOrgChartNode: Identifiable, Equatable, Sendable {
    public let id: String, name: String, title: String
    public let avatar: String?, avatarInitials: String?, accent: String?
    public let expanded: Bool?, selectable: Bool?
    public let children: [AWCOrgChartNode]
    /// The source node object, children included (event payloads carry it whole).
    public let raw: AWCValue
    public var hasChildren: Bool { !children.isEmpty }

    /// `nodes`: an array, a single object (wrapped) or a JSON string of either; anything else is an empty tree.
    public static func parse(_ value: AWCValue?) -> [AWCOrgChartNode] {
        var input = value ?? .null
        if case .string(let text) = input {
            guard !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty, let data = text.data(using: .utf8),
                  let decoded = try? JSONDecoder().decode(AWCValue.self, from: data) else { return [] }
            input = decoded
        }
        switch input {
        case .array(let items): return items.compactMap(node)
        case .object: return node(input).map { [$0] } ?? []
        default: return []
        }
    }
    static func node(_ v: AWCValue) -> AWCOrgChartNode? {
        guard case .object(let o) = v, let idValue = o["id"], idValue != .null else { return nil }
        func text(_ k: String) -> String? { if case .string(let s)? = o[k] { return s }; if case .number? = o[k] { return o[k]!.string }; return nil }
        func flag(_ k: String) -> Bool? { if case .bool(let b)? = o[k] { return b }; return nil }
        let kids: [AWCOrgChartNode] = { if case .array(let a)? = o["children"] { return a.compactMap(node) }; return [] }()
        return .init(id: idValue.string, name: text("name") ?? "", title: text("title") ?? "", avatar: text("avatar").flatMap { $0.isEmpty ? nil : $0 },
                     avatarInitials: text("avatarInitials").flatMap { $0.isEmpty ? nil : $0 }, accent: text("accent").flatMap { $0.isEmpty ? nil : $0 },
                     expanded: flag("expanded"), selectable: flag("selectable"), children: kids, raw: v)
    }
}

/// The fifteen public hooks (`--md-org-chart-*`). Unset fields keep the density and theme defaults. Colours: `#RRGGBB[AA]`.
public struct AWCOrgChartAppearance: Equatable, Sendable {
    public var connectorColor: String?, connectorWidth: Double?, nodeColor: String?, nodeOutlineColor: String?, nodeOutlineWidth: Double?
    public var nodeShape: Double?, nodeMinWidth: Double?, nodeMaxWidth: Double?, selectedColor: String?, focusRingColor: String?
    public var stateLayerColor: String?, toggleSize: Double?, levelGap: Double?, siblingGap: Double?, duration: Double?
    public init(connectorColor: String? = nil, connectorWidth: Double? = nil, nodeColor: String? = nil, nodeOutlineColor: String? = nil, nodeOutlineWidth: Double? = nil,
                nodeShape: Double? = nil, nodeMinWidth: Double? = nil, nodeMaxWidth: Double? = nil, selectedColor: String? = nil, focusRingColor: String? = nil,
                stateLayerColor: String? = nil, toggleSize: Double? = nil, levelGap: Double? = nil, siblingGap: Double? = nil, duration: Double? = nil) {
        func c(_ v: String?) -> String? { v.flatMap { awcCardColor($0) } }
        func l(_ v: Double?) -> Double? { v.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil } }
        self.connectorColor = c(connectorColor); self.connectorWidth = l(connectorWidth); self.nodeColor = c(nodeColor); self.nodeOutlineColor = c(nodeOutlineColor)
        self.nodeOutlineWidth = l(nodeOutlineWidth); self.nodeShape = l(nodeShape); self.nodeMinWidth = l(nodeMinWidth); self.nodeMaxWidth = l(nodeMaxWidth)
        self.selectedColor = c(selectedColor); self.focusRingColor = c(focusRingColor); self.stateLayerColor = c(stateLayerColor)
        self.toggleSize = l(toggleSize); self.levelGap = l(levelGap); self.siblingGap = l(siblingGap); self.duration = l(duration)
    }
    /// Keys: the field names above (lengths and the duration as numbers: px / ms).
    public init(values: [String: AWCValue]) {
        func t(_ k: String) -> String? { values[k]?.string.isEmpty == false ? values[k]?.string : nil }
        func n(_ k: String) -> Double? { values[k]?.number }
        self.init(connectorColor: t("connectorColor"), connectorWidth: n("connectorWidth"), nodeColor: t("nodeColor"), nodeOutlineColor: t("nodeOutlineColor"),
                  nodeOutlineWidth: n("nodeOutlineWidth"), nodeShape: n("nodeShape"), nodeMinWidth: n("nodeMinWidth"), nodeMaxWidth: n("nodeMaxWidth"),
                  selectedColor: t("selectedColor"), focusRingColor: t("focusRingColor"), stateLayerColor: t("stateLayerColor"), toggleSize: n("toggleSize"),
                  levelGap: n("levelGap"), siblingGap: n("siblingGap"), duration: n("duration"))
    }
    public func merging(_ o: Self) -> Self {
        .init(connectorColor: o.connectorColor ?? connectorColor, connectorWidth: o.connectorWidth ?? connectorWidth, nodeColor: o.nodeColor ?? nodeColor,
              nodeOutlineColor: o.nodeOutlineColor ?? nodeOutlineColor, nodeOutlineWidth: o.nodeOutlineWidth ?? nodeOutlineWidth, nodeShape: o.nodeShape ?? nodeShape,
              nodeMinWidth: o.nodeMinWidth ?? nodeMinWidth, nodeMaxWidth: o.nodeMaxWidth ?? nodeMaxWidth, selectedColor: o.selectedColor ?? selectedColor,
              focusRingColor: o.focusRingColor ?? focusRingColor, stateLayerColor: o.stateLayerColor ?? stateLayerColor, toggleSize: o.toggleSize ?? toggleSize,
              levelGap: o.levelGap ?? levelGap, siblingGap: o.siblingGap ?? siblingGap, duration: o.duration ?? duration)
    }
}
private struct AWCOrgChartAppearanceKey: EnvironmentKey { static let defaultValue = AWCOrgChartAppearance() }
public extension EnvironmentValues {
    var awcOrgChartAppearance: AWCOrgChartAppearance { get { self[AWCOrgChartAppearanceKey.self] } set { self[AWCOrgChartAppearanceKey.self] = newValue } }
}
public extension View {
    /// md-organization-chart hooks for this subtree; nested scopes merge field by field (inner wins).
    func awcOrgChartAppearance(_ appearance: AWCOrgChartAppearance) -> some View {
        transformEnvironment(\.awcOrgChartAppearance) { $0 = $0.merging(appearance) }
    }
}

/// Source metrics at a density rung (md-organization-chart.css), with the hooks applied.
struct AWCOrgChartMetrics: Equatable {
    let toggle, levelGap, siblingGap, outline, minWidth, maxWidth, line, radius, duration: Double
    let gap, padBlock, padInline, avatar, nameSize, nameLine, titleSize, titleLine: Double
    static let elbow = 12.0
    /// ::part() declarations that size the layout: node / node-selected padding, name / title font, viewport padding.
    var parts = AWCOrgChartParts()
    func border(selected: Bool) -> Double { selected ? outline + 1 : outline }
    /// A card's padding (physical edges): ::part(node) / ::part(node-selected), else the source's (1px less when selected:
    /// the selected ring takes it, so the border box stays put).
    func padding(selected: Bool) -> AWCTableEdges {
        if let p = parts.node(selected: selected).padding { return p }
        let d = selected ? 1.0 : 0
        return AWCTableEdges(top: padBlock - d, right: padInline - d, bottom: padBlock - d, left: padInline - d)
    }
    init(density d: Double, appearance a: AWCOrgChartAppearance) {
        toggle = a.toggleSize ?? max(20, 24 + d); levelGap = a.levelGap ?? max(24, 28 + d); siblingGap = a.siblingGap ?? max(8, 12 + d)
        outline = a.nodeOutlineWidth ?? 1; minWidth = a.nodeMinWidth ?? 176; maxWidth = a.nodeMaxWidth ?? 260; line = a.connectorWidth ?? 1.5
        radius = a.nodeShape ?? 12; duration = a.duration ?? 300
        gap = max(6, 12 + 1.5 * d); padBlock = max(6, 10 + d); padInline = max(8, 14 + 1.5 * d); avatar = max(28, 40 + 3 * d)
        nameSize = max(11, 14 + d / 2); nameLine = max(16, 20 + d); titleSize = max(10, 12 + d / 2); titleLine = max(14, 16 + d / 2)
    }
}

/// Exact Core Text advances of the card's two text runs (Chrome lays them out at fractional widths).
enum AWCOrgChartText {
    /// The run's own direction: its first strong character (Hebrew/Arabic-script letters are right-to-left).
    static func isRTL(_ s: String) -> Bool {
        for u in s.unicodeScalars {
            switch u.value {
            case 0x0590...0x08FF, 0xFB1D...0xFDFF, 0xFE70...0xFEFF: return true
            default: if u.properties.isAlphabetic { return false }
            }
        }
        return false
    }
    /// Name: weight 600 resolves to the bundled 700 face (CSS font matching prefers the next heavier weight above 500).
    static func nameFont(_ size: Double) -> CTFont { _ = AWCNativeFonts.label(size: 14); return CTFontCreateWithName("Roboto-Bold" as CFString, size, nil) }
    static func titleFont(_ size: Double) -> CTFont { _ = AWCNativeFonts.label(size: 14); return CTFontCreateWithName("Roboto-Regular" as CFString, size, nil) }
    /// A run's advance in the face of `weight` with `letter-spacing` after every character (as Chrome spaces it).
    static func width(_ text: String, size: Double, weight: Double, tracking: Double) -> Double {
        _ = AWCNativeFonts.label(size: 14)
        return width(text, CTFontCreateWithName(AWCOrgChartFonts.face(weight) as CFString, size, nil)) + (text.isEmpty ? 0 : tracking * Double(text.count))
    }
    static func width(_ text: String, _ font: CTFont) -> Double {
        guard !text.isEmpty else { return 0 }
        let line = CTLineCreateWithAttributedString(NSAttributedString(string: text, attributes: [kCTFontAttributeName as NSAttributedString.Key: font]))
        return CTLineGetTypographicBounds(line, nil, nil, nil)
    }
}

/// A CSS border box: physical rect plus per-side border widths, per-corner outer radii and per-side colour roles.
struct AWCOrgChartBorderBox: Equatable {
    enum Role: Equatable { case connector, selected }
    var rect: CGRect
    var top = 0.0, right = 0.0, bottom = 0.0, left = 0.0
    var topLeft = 0.0, topRight = 0.0, bottomRight = 0.0, bottomLeft = 0.0
    var roles: [String: Role] = [:]
    /// The group (parent node id) the pseudo-element belongs to: the unfold motion of that group moves it.
    var owner: String? = nil
    /// The branch (tree item id) a ::before / ::after belongs to; nil for a group's drop and trail run.
    var branch: String? = nil
}

/// The laid-out chart: every visible node's card, branch box, group box, toggle and connectors (host coordinates).
struct AWCOrgChartLayout {
    struct Item { let node: AWCOrgChartNode; let level, posInSet, setSize: Int; let parent: String?; var card, branch: CGRect; var group: CGRect?; var toggle: CGRect?; var onPath: Bool; var groupID: String? }
    var items: [Item] = []                 // DOM (pre-)order
    var tree: CGRect = .zero
    /// The viewport's scroll width: the tree plus the viewport padding (the host width when the tree fits).
    var contentWidth = 0.0
    var hostHeight = 0.0
    var connectors: [AWCOrgChartBorderBox] = []
    /// Per group (by parent id): the box of its children, for the unfold motion.
    var groups: [String: CGRect] = [:]
    var path: Set<String> = []
}

/// The source state model (md-organization-chart.tsx) and the layout of its visible tree.
struct AWCOrgChartModel {
    let roots: [AWCOrgChartNode]
    let collapsed: Set<String>
    let collapsible: Bool
    let mode: String
    let selection: [String]
    let vertical: Bool
    let rtl: Bool
    let metrics: AWCOrgChartMetrics

    func isExpanded(_ n: AWCOrgChartNode) -> Bool { !collapsible || !collapsed.contains(n.id) }
    func isSelectable(_ n: AWCOrgChartNode) -> Bool { mode != "none" && n.selectable != false }
    func isSelected(_ n: AWCOrgChartNode) -> Bool { isSelectable(n) && selection.contains(n.id) }

    /// The fold seeds of fresh data: `expanded: false` on a node with children.
    static func seededCollapsed(_ roots: [AWCOrgChartNode]) -> Set<String> {
        var out = Set<String>()
        func walk(_ l: [AWCOrgChartNode]) { for n in l { if n.expanded == false && n.hasChildren { out.insert(n.id) }; walk(n.children) } }
        walk(roots); return out
    }

    /// Every id on the path from a selected (shown or folded-away) node up to its root, the selected node included.
    func pathToSelection() -> Set<String> {
        var path = Set<String>(); guard !selection.isEmpty else { return path }
        let selected = Set(selection)
        func walk(_ n: AWCOrgChartNode) -> Bool {
            let below = n.children.map(walk).contains(true)
            let hit = below || (isSelectable(n) && selected.contains(n.id))
            if hit { path.insert(n.id) }
            return hit
        }
        for r in roots { _ = walk(r) }
        return path
    }

    private struct Measured { let node: AWCOrgChartNode; let card: CGSize; let kids: [Measured]; let group: CGSize; let size: CGSize; let pad: Double; let only: Bool }

    func cardSize(_ n: AWCOrgChartNode) -> CGSize {
        let m = metrics, np = m.parts[.name], tp = m.parts[.title]
        let nameW = AWCOrgChartText.width(n.name, size: np.fontSize ?? m.nameSize, weight: np.fontWeight ?? 600, tracking: np.letterSpacing ?? 0)
        let titleW = n.title.isEmpty ? 0 : AWCOrgChartText.width(n.title, size: tp.fontSize ?? m.titleSize, weight: tp.fontWeight ?? 400, tracking: tp.letterSpacing ?? 0)
        // Border box (box-sizing: border-box, clamped to the min / max widths): border + padding (::part(node)) + content.
        let selected = isSelected(n), b = m.border(selected: selected), p = m.padding(selected: selected)
        let w = min(m.maxWidth, max(m.minWidth, 2 * b + p.left + p.right + m.avatar + m.gap + max(nameW, titleW)))
        let h = 2 * b + p.top + p.bottom + max(m.avatar, m.nameLine + (n.title.isEmpty ? 0 : 2 + m.titleLine))
        return .init(width: w, height: h)
    }

    /// Lays the visible tree out in a host `width` wide (CSS flex result + viewport padding and centring).
    func layout(width W: Double) -> AWCOrgChartLayout {
        let m = metrics, L = m.levelGap, S = m.siblingGap
        func measure(_ n: AWCOrgChartNode, root: Bool, only: Bool) -> Measured {
            let card = cardSize(n)
            let kids = isExpanded(n) ? n.children.map { measure($0, root: false, only: n.children.count == 1) } : []
            let pad = root || only ? 0 : L
            if vertical {
                let gw = kids.reduce(0) { $0 + $1.size.width }, gh = kids.isEmpty ? 0 : L + (kids.map { $0.size.height }.max() ?? 0)
                return .init(node: n, card: card, kids: kids, group: .init(width: gw, height: gh), size: .init(width: max(card.width, gw) + S, height: pad + card.height + gh), pad: pad, only: only)
            }
            let gh = kids.reduce(0) { $0 + $1.size.height }, gw = kids.isEmpty ? 0 : L + (kids.map { $0.size.width }.max() ?? 0)
            return .init(node: n, card: card, kids: kids, group: .init(width: gw, height: gh), size: .init(width: pad + card.width + gw, height: max(card.height, gh) + S), pad: pad, only: only)
        }
        let trees = roots.map { measure($0, root: true, only: false) }
        var out = AWCOrgChartLayout()
        guard !trees.isEmpty else { return out }
        let tw = vertical ? trees.reduce(0) { $0 + $1.size.width } : (trees.map { $0.size.width }.max() ?? 0)
        let th = vertical ? (trees.map { $0.size.height }.max() ?? 0) : trees.reduce(0) { $0 + $1.size.height }
        // The viewport's padding (::part(viewport) physical edges; laid out inline-start first, mirrored for right-to-left).
        let vp = m.parts[.viewport].padding
        let padStart = vp.map { rtl ? $0.right : $0.left } ?? 8.0, padEnd = vp.map { rtl ? $0.left : $0.right } ?? (vertical ? 8.0 : m.toggle / 2 + 10)
        let padTop = vp?.top ?? 8.0, padBottom = vp?.bottom ?? (vertical ? m.toggle / 2 + 10 : 8.0)
        let inner = W - padStart - padEnd
        let tx = padStart + max(0, (inner - tw) / 2)
        out.tree = .init(x: tx, y: padTop, width: tw, height: th)
        out.hostHeight = padTop + th + padBottom
        out.contentWidth = max(W, padStart + tw + padEnd)
        out.path = pathToSelection()
        func place(_ b: Measured, x: Double, y: Double, level: Int, pos: Int, size: Int, parent: String?, groupID: String?) {
            var item = AWCOrgChartLayout.Item(node: b.node, level: level, posInSet: pos, setSize: size, parent: parent, card: .zero, branch: .init(x: x, y: y, width: b.size.width, height: b.size.height), group: nil, toggle: nil, onPath: out.path.contains(b.node.id), groupID: groupID)
            let index = out.items.count; out.items.append(item)
            if vertical {
                let cont = max(b.card.width, b.group.width)
                item.card = .init(x: x + S / 2 + (cont - b.card.width) / 2, y: y + b.pad, width: b.card.width, height: b.card.height)
                if !b.kids.isEmpty {
                    let gx = x + S / 2 + (cont - b.group.width) / 2, gy = item.card.maxY
                    item.group = .init(x: gx, y: gy, width: b.group.width, height: b.group.height)
                    out.items[index] = item
                    var kx = gx
                    for (i, k) in b.kids.enumerated() { place(k, x: kx, y: gy + L, level: level + 1, pos: i + 1, size: b.kids.count, parent: b.node.id, groupID: b.node.id); kx += k.size.width }
                }
            } else {
                let cont = max(b.card.height, b.group.height)
                item.card = .init(x: x + b.pad, y: y + S / 2 + (cont - b.card.height) / 2, width: b.card.width, height: b.card.height)
                if !b.kids.isEmpty {
                    let gy = y + S / 2 + (cont - b.group.height) / 2, gx = item.card.maxX
                    item.group = .init(x: gx, y: gy, width: b.group.width, height: b.group.height)
                    out.items[index] = item
                    var ky = gy
                    for (i, k) in b.kids.enumerated() { place(k, x: gx + L, y: ky, level: level + 1, pos: i + 1, size: b.kids.count, parent: b.node.id, groupID: b.node.id); ky += k.size.height }
                }
            }
            if b.kids.isEmpty { out.items[index] = item }
        }
        var cursor = vertical ? tx : padTop
        for (i, t) in trees.enumerated() {
            if vertical { place(t, x: cursor, y: padTop, level: 1, pos: i + 1, size: trees.count, parent: nil, groupID: nil); cursor += t.size.width }
            else { place(t, x: tx, y: cursor, level: 1, pos: i + 1, size: trees.count, parent: nil, groupID: nil); cursor += t.size.height }
        }
        // Toggles hang centred on the card's block-end (vertical) / inline-end (horizontal) edge, inside the border.
        for i in out.items.indices where collapsible && out.items[i].node.hasChildren {
            // Positioned against the padding box: the selected ring is 1px wider than the outline.
            let c = out.items[i].card, t = m.toggle, o = isSelected(out.items[i].node) ? m.outline + 1 : m.outline
            out.items[i].toggle = vertical ? CGRect(x: c.midX - t / 2, y: c.maxY - o - t / 2, width: t, height: t)
                                           : CGRect(x: c.maxX - o - t / 2, y: c.midY - t / 2, width: t, height: t)
        }
        if rtl {
            func mirror(_ r: CGRect) -> CGRect { .init(x: W - r.maxX, y: r.minY, width: r.width, height: r.height) }
            out.tree = mirror(out.tree)
            for i in out.items.indices {
                out.items[i].card = mirror(out.items[i].card); out.items[i].branch = mirror(out.items[i].branch)
                out.items[i].group = out.items[i].group.map(mirror); out.items[i].toggle = out.items[i].toggle.map(mirror)
            }
        }
        for item in out.items { if let g = item.group { out.groups[item.node.id] = g } }
        out.connectors = connectors(out)
        return out
    }

    /// The pseudo-element borders (::before/::after of each non-root branch, the group drop) and each group's trail run.
    private func connectors(_ l: AWCOrgChartLayout) -> [AWCOrgChartBorderBox] {
        let m = metrics, L = m.levelGap, w = m.line, r = AWCOrgChartMetrics.elbow
        var boxes: [AWCOrgChartBorderBox] = []
        let byParent = Dictionary(grouping: l.items.filter { $0.parent != nil }, by: { $0.parent! })
        // Physical sides of the logical inline start/end.
        let start = rtl ? "right" : "left", end = rtl ? "left" : "right"
        func box(_ owner: CGRect, left: Double, top: Double, width cw: Double, height ch: Double, sides: Set<String>, radii: [String: Double] = [:], roles: [String: AWCOrgChartBorderBox.Role]) -> AWCOrgChartBorderBox {
            var b = AWCOrgChartBorderBox(rect: .zero)
            b.top = sides.contains("top") ? w : 0; b.bottom = sides.contains("bottom") ? w : 0; b.left = sides.contains("left") ? w : 0; b.right = sides.contains("right") ? w : 0
            b.rect = .init(x: owner.minX + left, y: owner.minY + top, width: cw + b.left + b.right, height: ch + b.top + b.bottom)
            b.topLeft = radii["top-left"] ?? 0; b.topRight = radii["top-right"] ?? 0; b.bottomLeft = radii["bottom-left"] ?? 0; b.bottomRight = radii["bottom-right"] ?? 0
            b.roles = roles; return b
        }
        var risers: [String: (CGFloat, CGFloat)] = [:]   // on-path child id → its riser interval on the bus axis
        for parent in l.items {
            guard let kids = byParent[parent.node.id], let g = parent.group else { continue }
            for (j, k) in kids.enumerated() where kids.count > 1 {
                let first = j == 0, last = j == kids.count - 1, riser: AWCOrgChartBorderBox.Role = k.onPath ? .selected : .connector
                let bw = k.branch.width, bh = k.branch.height
                var before: AWCOrgChartBorderBox?, after: AWCOrgChartBorderBox?
                if vertical {
                    var bs: Set<String> = first ? [] : ["top"]; if last { bs.formUnion(["top", end]) }
                    let `as`: Set<String> = last ? [] : ["top", start]
                    let ebw = bs.contains("left") || bs.contains("right") ? w : 0, eaw = `as`.contains("left") || `as`.contains("right") ? w : 0
                    let bl = rtl ? bw / 2 : bw - bw / 2 - (bw / 2 + ebw), al = rtl ? bw - bw / 2 - (bw / 2 + eaw) : bw / 2
                    if !bs.isEmpty { before = box(k.branch, left: bl, top: 0, width: bw / 2, height: L, sides: bs, radii: last ? ["top-" + end: r] : [:], roles: ["top": .connector, end: riser]) }
                    if !`as`.isEmpty { after = box(k.branch, left: al, top: 0, width: bw / 2, height: L, sides: `as`, radii: first ? ["top-" + start: r] : [:], roles: ["top": .connector, start: riser]) }
                    if k.onPath {
                        // Non-last children rise on ::after's inline-start border, the last one on ::before's inline-end border.
                        let rb = last ? before! : after!, atLeft = last ? rtl : !rtl
                        risers[k.node.id] = atLeft ? (rb.rect.minX, rb.rect.minX + w) : (rb.rect.maxX - w, rb.rect.maxX)
                    }
                } else {
                    var bs: Set<String> = first ? [] : [start]; if last { bs.formUnion([start, "bottom"]) }
                    let `as`: Set<String> = last ? [] : [start, "top"]
                    let bl = rtl ? bw - (L + w) : 0
                    if !bs.isEmpty { before = box(k.branch, left: bl, top: 0, width: L, height: bh / 2, sides: bs, radii: last ? ["bottom-" + start: r] : [:], roles: [start: .connector, "bottom": riser]) }
                    if !`as`.isEmpty { after = box(k.branch, left: bl, top: bh / 2, width: L, height: bh / 2, sides: `as`, radii: first ? ["top-" + start: r] : [:], roles: [start: .connector, "top": riser]) }
                    if k.onPath { let rb = last ? before! : after!; risers[k.node.id] = last ? (rb.rect.maxY - w, rb.rect.maxY) : (rb.rect.minY, rb.rect.minY + w) }
                }
                if var before { before.owner = parent.node.id; before.branch = k.node.id; boxes.append(before) }
                if var after { after.owner = parent.node.id; after.branch = k.node.id; boxes.append(after) }
            }
            let trail = kids.contains { $0.onPath }
            let role: AWCOrgChartBorderBox.Role = trail ? .selected : .connector
            var drop = vertical ? box(g, left: rtl ? g.width - g.width / 2 - w : g.width / 2, top: 0, width: 0, height: L, sides: [start], roles: [start: role])
                                : box(g, left: rtl ? g.width - L : 0, top: g.height / 2, width: L, height: 0, sides: ["top"], roles: ["top": role])
            drop.owner = parent.node.id
            boxes.append(drop)
            // The trail's run: one border box from the drop to the outermost on-path riser on each side (source measureTrail).
            guard trail, kids.count > 1 else { continue }
            let d0 = vertical ? drop.rect.minX : drop.rect.minY, d1 = d0 + w, dm = (d0 + d1) / 2
            let on = kids.filter { $0.onPath }.compactMap { k in risers[k.node.id].map { (k, Double($0.0), Double($0.1)) } }
            let lo = on.filter { ($0.1 + $0.2) / 2 < dm - 0.5 }, hi = on.filter { ($0.1 + $0.2) / 2 > dm + 0.5 }
            guard !lo.isEmpty || !hi.isEmpty else { continue }
            let from = min(d0, lo.map { $0.1 }.min() ?? d0), to = max(d1, hi.map { $0.2 }.max() ?? d1)
            let bus = vertical ? "top" : start
            let loSide = vertical ? "left" : "top", hiSide = vertical ? "right" : "bottom"
            func outermost(_ high: Bool) -> String {
                if !vertical { return (high ? kids.last! : kids.first!).node.id }
                let sorted = kids.sorted { $0.branch.minX < $1.branch.minX }; return (high ? sorted.last! : sorted.first!).node.id
            }
            var sides: Set<String> = [bus], radii: [String: Double] = [:]
            func corner(_ e: String) -> String { vertical ? "\(bus)-\(e)" : "\(e)-\(bus)" }
            if !lo.isEmpty { sides.insert(loSide); if lo.contains(where: { $0.0.node.id == outermost(false) }) { radii[corner(loSide)] = r } }
            if !hi.isEmpty { sides.insert(hiSide); if hi.contains(where: { $0.0.node.id == outermost(true) }) { radii[corner(hiSide)] = r } }
            var run = AWCOrgChartBorderBox(rect: vertical ? .init(x: from, y: g.minY + L, width: to - from, height: L)
                                                          : .init(x: rtl ? g.maxX - 2 * L : g.minX + L, y: from, width: L, height: to - from))
            run.top = sides.contains("top") ? w : 0; run.bottom = sides.contains("bottom") ? w : 0; run.left = sides.contains("left") ? w : 0; run.right = sides.contains("right") ? w : 0
            run.topLeft = radii["top-left"] ?? 0; run.topRight = radii["top-right"] ?? 0; run.bottomLeft = radii["bottom-left"] ?? 0; run.bottomRight = radii["bottom-right"] ?? 0
            run.roles = ["top": .selected, "bottom": .selected, "left": .selected, "right": .selected]
            run.owner = parent.node.id
            boxes.append(run)
        }
        return boxes
    }
}
