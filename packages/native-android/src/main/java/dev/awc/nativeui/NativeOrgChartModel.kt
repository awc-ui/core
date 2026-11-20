package dev.awc.nativeui

import android.content.Context
import android.graphics.Paint
import android.graphics.Typeface
import kotlin.math.max
import kotlin.math.min

// md-organization-chart: data, appearance hooks, metrics and the CSS layout model (the flex tree and the pseudo-element
// connectors of md-organization-chart.css), shared by the Compose renderer and its tests. Geometry is in CSS px (dp).
// Port of packages/native-ios/Sources/AWCUI/OrgChartModel.swift; both are checked against the same Chrome 153 oracle.

/** A rectangle in CSS px. */
data class OrgRect(val x: Double, val y: Double, val w: Double, val h: Double) {
    val maxX get() = x + w; val maxY get() = y + h; val midX get() = x + w / 2; val midY get() = y + h / 2
    fun contains(px: Double, py: Double) = px >= x && py >= y && px < maxX && py < maxY
    companion object { val Zero = OrgRect(0.0, 0.0, 0.0, 0.0) }
}

/** One `OrgChartNode` of the source: `id`, `name` required; `children: []` is a leaf. `raw` is the source object. */
data class OrgChartNode(val id: String, val name: String, val title: String, val avatar: String?, val avatarInitials: String?, val accent: String?,
                        val expanded: Boolean?, val selectable: Boolean?, val children: List<OrgChartNode>, val raw: Map<String, AWCValue>) {
    val hasChildren get() = children.isNotEmpty()
    companion object {
        /** `nodes`: an array, a single object (wrapped) or a JSON string of either; anything else is an empty tree. */
        fun parse(value: AWCValue): List<OrgChartNode> {
            val v = if(value is String) runCatching { val t = value.trim(); if(t.startsWith("[")) awcList(t) else if(t.startsWith("{")) awcMap(org.json.JSONObject(t)) else null }.getOrNull() else value
            return when(v) { is List<*> -> v.mapNotNull(::node); is org.json.JSONArray -> awcList(v).mapNotNull(::node); is Map<*, *>, is org.json.JSONObject -> listOfNotNull(node(v)); else -> emptyList() }
        }
        private fun node(v: AWCValue): OrgChartNode? {
            val o = awcMap(v); if(o.isEmpty()) return null
            val id = o["id"] ?: return null
            fun text(k: String): String? = when(val x = o[k]) { is String -> x; is Number -> if(x.toDouble() % 1.0 == 0.0) x.toLong().toString() else x.toString(); else -> null }
            fun flag(k: String): Boolean? = o[k] as? Boolean
            val kids = (o["children"]?.let(::awcList) ?: emptyList()).mapNotNull(::node)
            return OrgChartNode(if(id is Number && id.toDouble() % 1.0 == 0.0) id.toLong().toString() else id.toString(), text("name") ?: "", text("title") ?: "",
                text("avatar")?.takeIf { it.isNotEmpty() }, text("avatarInitials")?.takeIf { it.isNotEmpty() }, text("accent")?.takeIf { it.isNotEmpty() },
                flag("expanded"), flag("selectable"), kids, o)
        }
    }
}

/** The fifteen public hooks (`--md-org-chart-*`). Unset fields keep the density and theme defaults. Colours: `#RRGGBB[AA]`. */
data class AWCOrgChartAppearance(
    val connectorColor: String? = null, val connectorWidth: Double? = null, val nodeColor: String? = null, val nodeOutlineColor: String? = null,
    val nodeOutlineWidth: Double? = null, val nodeShape: Double? = null, val nodeMinWidth: Double? = null, val nodeMaxWidth: Double? = null,
    val selectedColor: String? = null, val focusRingColor: String? = null, val stateLayerColor: String? = null, val toggleSize: Double? = null,
    val levelGap: Double? = null, val siblingGap: Double? = null, val duration: Double? = null,
) {
    /** Invalid values are dropped (colours must be #RRGGBB[AA]; lengths finite and >= 0). */
    fun validated(): AWCOrgChartAppearance {
        fun c(v: String?) = v?.takeIf { Regex("^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$").matches(it) }?.uppercase()
        fun l(v: Double?) = v?.takeIf { it.isFinite() && it >= 0 }
        return AWCOrgChartAppearance(c(connectorColor), l(connectorWidth), c(nodeColor), c(nodeOutlineColor), l(nodeOutlineWidth), l(nodeShape), l(nodeMinWidth), l(nodeMaxWidth),
            c(selectedColor), c(focusRingColor), c(stateLayerColor), l(toggleSize), l(levelGap), l(siblingGap), l(duration))
    }
    fun merging(o: AWCOrgChartAppearance) = AWCOrgChartAppearance(o.connectorColor ?: connectorColor, o.connectorWidth ?: connectorWidth, o.nodeColor ?: nodeColor,
        o.nodeOutlineColor ?: nodeOutlineColor, o.nodeOutlineWidth ?: nodeOutlineWidth, o.nodeShape ?: nodeShape, o.nodeMinWidth ?: nodeMinWidth, o.nodeMaxWidth ?: nodeMaxWidth,
        o.selectedColor ?: selectedColor, o.focusRingColor ?: focusRingColor, o.stateLayerColor ?: stateLayerColor, o.toggleSize ?: toggleSize, o.levelGap ?: levelGap,
        o.siblingGap ?: siblingGap, o.duration ?: duration)
    companion object {
        /** Keys: the field names above (lengths and the duration as numbers: px / ms). */
        fun of(values: Map<String, AWCValue>): AWCOrgChartAppearance {
            fun t(k: String) = (values[k] as? String)?.takeIf { it.isNotEmpty() }
            fun n(k: String) = (values[k] as? Number)?.toDouble()
            return AWCOrgChartAppearance(t("connectorColor"), n("connectorWidth"), t("nodeColor"), t("nodeOutlineColor"), n("nodeOutlineWidth"), n("nodeShape"),
                n("nodeMinWidth"), n("nodeMaxWidth"), t("selectedColor"), t("focusRingColor"), t("stateLayerColor"), n("toggleSize"), n("levelGap"), n("siblingGap"), n("duration")).validated()
        }
    }
}

/** Source metrics at a density rung (md-organization-chart.css), with the hooks applied. */
data class OrgChartMetrics(val density: Double, val a: AWCOrgChartAppearance, val parts: OrgChartParts = OrgChartParts()) {
    val toggle = a.toggleSize ?: max(20.0, 24 + density); val levelGap = a.levelGap ?: max(24.0, 28 + density); val siblingGap = a.siblingGap ?: max(8.0, 12 + density)
    val outline = a.nodeOutlineWidth ?: 1.0; val minWidth = a.nodeMinWidth ?: 176.0; val maxWidth = a.nodeMaxWidth ?: 260.0; val line = a.connectorWidth ?: 1.5
    val radius = a.nodeShape ?: 12.0; val duration = a.duration ?: 300.0
    val gap = max(6.0, 12 + 1.5 * density); val padBlock = max(6.0, 10 + density); val padInline = max(8.0, 14 + 1.5 * density); val avatar = max(28.0, 40 + 3 * density)
    val nameSize = max(11.0, 14 + density / 2); val nameLine = max(16.0, 20 + density); val titleSize = max(10.0, 12 + density / 2); val titleLine = max(14.0, 16 + density / 2)
    fun border(selected: Boolean) = if(selected) outline + 1 else outline
    /** A card's padding (physical edges): ::part(node) / ::part(node-selected), else the source's (1px less when selected: the
     *  selected ring takes it, so the border box stays put). */
    fun padding(selected: Boolean): AWCTableEdges =
        parts.node(selected).padding ?: (if(selected) 1.0 else 0.0).let { d -> AWCTableEdges(padBlock - d, padInline - d, padBlock - d, padInline - d) }
    companion object { const val ELBOW = 12.0 }
}

/** Exact advances of the card's two text runs with the bundled Roboto faces (weight 600 resolves to the 700 face). */
class OrgChartText(context: Context) {
    private val bold: Typeface = context.resources.getFont(R.font.awc_roboto_bold)
    private val regular: Typeface = context.resources.getFont(R.font.awc_roboto_regular)
    private val medium: Typeface = context.resources.getFont(R.font.awc_roboto_medium)
    /** A run's advance in the face of [weight] with `letter-spacing` after every character (as Chrome spaces it). */
    fun width(text: String, size: Double, weight: Double, tracking: Double): Double {
        if(text.isEmpty()) return 0.0
        val face = if(weight >= 600) 'b' else if(weight >= 500) 'm' else 'r'
        return cache.getOrPut("$face$size|$text") {
            paint.typeface = when(face) { 'b' -> bold; 'm' -> medium; else -> regular }; paint.textSize = (size * 16).toFloat(); paint.measureText(text) / 16.0
        } + tracking * text.codePointCount(0, text.length)
    }
    private val paint = Paint(Paint.ANTI_ALIAS_FLAG or Paint.LINEAR_TEXT_FLAG or Paint.SUBPIXEL_TEXT_FLAG)
    private val cache = HashMap<String, Double>()
    fun width(text: String, size: Double, name: Boolean): Double {
        if(text.isEmpty()) return 0.0
        return cache.getOrPut("${if(name) 'b' else 'r'}$size|$text") {
            // Linear advances, measured 16x larger for sub-pixel precision.
            paint.typeface = if(name) bold else regular; paint.textSize = (size * 16).toFloat(); paint.measureText(text) / 16.0
        }
    }
    companion object {
        /** The run's own direction: its first strong character (Hebrew/Arabic-script letters are right-to-left). */
        fun isRtl(s: String): Boolean {
            var i = 0
            while(i < s.length) { val c = s.codePointAt(i)
                if(c in 0x0590..0x08FF || c in 0xFB1D..0xFDFF || c in 0xFE70..0xFEFF) return true
                if(Character.isLetter(c)) return false
                i += Character.charCount(c) }
            return false
        }
    }
}

/** A CSS border box: physical rect plus per-side border widths, per-corner outer radii and per-side colour roles. */
data class OrgChartBorderBox(var rect: OrgRect, var top: Double = 0.0, var right: Double = 0.0, var bottom: Double = 0.0, var left: Double = 0.0,
                             var topLeft: Double = 0.0, var topRight: Double = 0.0, var bottomRight: Double = 0.0, var bottomLeft: Double = 0.0,
                             var roles: Map<String, Boolean> = emptyMap(), var owner: String? = null,
                             /** The branch (tree item id) a ::before / ::after belongs to; null for a group's drop and trail run. */
                             var branch: String? = null) {
    /** True when a side is drawn in the selected (trail) colour. */
    fun selected(side: String) = roles[side] == true
}

/** The laid-out chart: every visible node's card, branch box, group box, toggle and connectors (host coordinates). */
class OrgChartLayout {
    data class Item(val node: OrgChartNode, val level: Int, val posInSet: Int, val setSize: Int, val parent: String?, var card: OrgRect, var branch: OrgRect,
                    var group: OrgRect?, var toggle: OrgRect?, val onPath: Boolean, val groupID: String?)
    val items = mutableListOf<Item>()                // DOM (pre-)order
    var tree = OrgRect.Zero
    /** The viewport's scroll width: the tree plus the viewport padding (the host width when the tree fits). */
    var contentWidth = 0.0
    var hostHeight = 0.0
    var connectors: List<OrgChartBorderBox> = emptyList()
    /** Per group (by parent id): the box of its children, for the unfold motion. */
    val groups = HashMap<String, OrgRect>()
    var path: Set<String> = emptySet()
}

/** The source state model (md-organization-chart.tsx) and the layout of its visible tree. */
class OrgChartModel(val roots: List<OrgChartNode>, val collapsed: Set<String>, val collapsible: Boolean, val mode: String, val selection: List<String>,
                    val vertical: Boolean, val rtl: Boolean, val metrics: OrgChartMetrics, val text: OrgChartText) {
    fun isExpanded(n: OrgChartNode) = !collapsible || n.id !in collapsed
    fun isSelectable(n: OrgChartNode) = mode != "none" && n.selectable != false
    fun isSelected(n: OrgChartNode) = isSelectable(n) && n.id in selection

    companion object {
        /** The fold seeds of fresh data: `expanded: false` on a node with children. */
        fun seededCollapsed(roots: List<OrgChartNode>): Set<String> {
            val out = HashSet<String>()
            fun walk(l: List<OrgChartNode>) { for(n in l) { if(n.expanded == false && n.hasChildren) out += n.id; walk(n.children) } }
            walk(roots); return out
        }
        /** The visible row for `id`: itself, or the outermost folded ancestor that hides it. */
        fun visibleOwner(id: String, roots: List<OrgChartNode>, collapsed: Set<String>, collapsible: Boolean): String {
            if(!collapsible) return id
            var chain: List<String> = emptyList()
            fun find(l: List<OrgChartNode>, trail: List<String>): Boolean { for(n in l) { if(n.id == id) { chain = trail; return true }; if(find(n.children, trail + n.id)) return true }; return false }
            find(roots, emptyList())
            return chain.firstOrNull { it in collapsed } ?: id
        }
    }

    /** Every id on the path from a selected (shown or folded-away) node up to its root, the selected node included. */
    fun pathToSelection(): Set<String> {
        val path = HashSet<String>(); if(selection.isEmpty()) return path
        val selected = selection.toSet()
        fun walk(n: OrgChartNode): Boolean {
            val below = n.children.map(::walk).contains(true)
            val hit = below || (isSelectable(n) && n.id in selected)
            if(hit) path += n.id
            return hit
        }
        roots.forEach { walk(it) }
        return path
    }

    private class Measured(val node: OrgChartNode, val cw: Double, val ch: Double, val kids: List<Measured>, val gw: Double, val gh: Double, val w: Double, val h: Double, val pad: Double)

    fun cardSize(n: OrgChartNode): Pair<Double, Double> {
        val m = metrics; val np = m.parts[AWCOrgChartPart.NAME]; val tp = m.parts[AWCOrgChartPart.TITLE]
        val column = max(text.width(n.name, np.fontSize ?: m.nameSize, np.fontWeight ?: 600.0, np.letterSpacing ?: 0.0),
            if(n.title.isEmpty()) 0.0 else text.width(n.title, tp.fontSize ?: m.titleSize, tp.fontWeight ?: 400.0, tp.letterSpacing ?: 0.0))
        // Border box (box-sizing: border-box, clamped to the min / max widths): border + padding (::part(node)) + content.
        val sel = isSelected(n); val b = m.border(sel); val p = m.padding(sel)
        val w = min(m.maxWidth, max(m.minWidth, 2 * b + p.left + p.right + m.avatar + m.gap + column))
        val h = 2 * b + p.top + p.bottom + max(m.avatar, m.nameLine + (if(n.title.isEmpty()) 0.0 else 2 + m.titleLine))
        return w to h
    }

    /** Lays the visible tree out in a host `width` wide (CSS flex result + viewport padding and centring). */
    fun layout(width: Double): OrgChartLayout {
        val m = metrics; val L = m.levelGap; val S = m.siblingGap; val W = width
        fun measure(n: OrgChartNode, root: Boolean, only: Boolean): Measured {
            val (cw, ch) = cardSize(n)
            val kids = if(isExpanded(n)) n.children.map { measure(it, false, n.children.size == 1) } else emptyList()
            val pad = if(root || only) 0.0 else L
            return if(vertical) {
                val gw = kids.sumOf { it.w }; val gh = if(kids.isEmpty()) 0.0 else L + kids.maxOf { it.h }
                Measured(n, cw, ch, kids, gw, gh, max(cw, gw) + S, pad + ch + gh, pad)
            } else {
                val gh = kids.sumOf { it.h }; val gw = if(kids.isEmpty()) 0.0 else L + kids.maxOf { it.w }
                Measured(n, cw, ch, kids, gw, gh, pad + cw + gw, max(ch, gh) + S, pad)
            }
        }
        val trees = roots.map { measure(it, true, false) }
        val out = OrgChartLayout()
        if(trees.isEmpty()) return out
        val tw = if(vertical) trees.sumOf { it.w } else trees.maxOf { it.w }
        val th = if(vertical) trees.maxOf { it.h } else trees.sumOf { it.h }
        // The viewport's padding (::part(viewport) physical edges; laid out inline-start first, mirrored for right-to-left).
        val vp = m.parts[AWCOrgChartPart.VIEWPORT].padding
        val padStart = vp?.let { if(rtl) it.right else it.left } ?: 8.0; val padEnd = vp?.let { if(rtl) it.left else it.right } ?: if(vertical) 8.0 else m.toggle / 2 + 10
        val padTop = vp?.top ?: 8.0; val padBottom = vp?.bottom ?: if(vertical) m.toggle / 2 + 10 else 8.0
        val inner = W - padStart - padEnd
        val tx = padStart + max(0.0, (inner - tw) / 2)
        out.tree = OrgRect(tx, padTop, tw, th)
        out.hostHeight = padTop + th + padBottom
        out.contentWidth = max(W, padStart + tw + padEnd)
        out.path = pathToSelection()
        fun place(b: Measured, x: Double, y: Double, level: Int, pos: Int, size: Int, parent: String?, groupID: String?) {
            val item = OrgChartLayout.Item(b.node, level, pos, size, parent, OrgRect.Zero, OrgRect(x, y, b.w, b.h), null, null, b.node.id in out.path, groupID)
            out.items += item
            if(vertical) {
                val cont = max(b.cw, b.gw)
                item.card = OrgRect(x + S / 2 + (cont - b.cw) / 2, y + b.pad, b.cw, b.ch)
                if(b.kids.isNotEmpty()) {
                    val gx = x + S / 2 + (cont - b.gw) / 2; val gy = item.card.maxY
                    item.group = OrgRect(gx, gy, b.gw, b.gh)
                    var kx = gx
                    b.kids.forEachIndexed { i, k -> place(k, kx, gy + L, level + 1, i + 1, b.kids.size, b.node.id, b.node.id); kx += k.w }
                }
            } else {
                val cont = max(b.ch, b.gh)
                item.card = OrgRect(x + b.pad, y + S / 2 + (cont - b.ch) / 2, b.cw, b.ch)
                if(b.kids.isNotEmpty()) {
                    val gy = y + S / 2 + (cont - b.gh) / 2; val gx = item.card.maxX
                    item.group = OrgRect(gx, gy, b.gw, b.gh)
                    var ky = gy
                    b.kids.forEachIndexed { i, k -> place(k, gx + L, ky, level + 1, i + 1, b.kids.size, b.node.id, b.node.id); ky += k.h }
                }
            }
        }
        var cursor = if(vertical) tx else padTop
        trees.forEachIndexed { i, t ->
            if(vertical) { place(t, cursor, padTop, 1, i + 1, trees.size, null, null); cursor += t.w }
            else { place(t, tx, cursor, 1, i + 1, trees.size, null, null); cursor += t.h }
        }
        // Toggles hang centred on the card's block-end (vertical) / inline-end (horizontal) edge, positioned against the
        // padding box (the selected ring is 1px wider than the outline).
        for(item in out.items) if(collapsible && item.node.hasChildren) {
            val c = item.card; val t = m.toggle; val o = if(isSelected(item.node)) m.outline + 1 else m.outline
            item.toggle = if(vertical) OrgRect(c.midX - t / 2, c.maxY - o - t / 2, t, t) else OrgRect(c.maxX - o - t / 2, c.midY - t / 2, t, t)
        }
        if(rtl) {
            fun mirror(r: OrgRect) = OrgRect(W - r.maxX, r.y, r.w, r.h)
            out.tree = mirror(out.tree)
            for(item in out.items) { item.card = mirror(item.card); item.branch = mirror(item.branch); item.group = item.group?.let(::mirror); item.toggle = item.toggle?.let(::mirror) }
        }
        for(item in out.items) item.group?.let { out.groups[item.node.id] = it }
        out.connectors = connectors(out)
        return out
    }

    /** The pseudo-element borders (::before/::after of each non-root branch, the group drop) and each group's trail run. */
    private fun connectors(l: OrgChartLayout): List<OrgChartBorderBox> {
        val m = metrics; val L = m.levelGap; val w = m.line; val r = OrgChartMetrics.ELBOW
        val boxes = mutableListOf<OrgChartBorderBox>()
        val byParent = l.items.filter { it.parent != null }.groupBy { it.parent!! }
        val start = if(rtl) "right" else "left"; val end = if(rtl) "left" else "right"
        fun box(owner: OrgRect, left: Double, top: Double, cw: Double, ch: Double, sides: Set<String>, radii: Map<String, Double> = emptyMap(), roles: Map<String, Boolean>): OrgChartBorderBox {
            val b = OrgChartBorderBox(OrgRect.Zero)
            b.top = if("top" in sides) w else 0.0; b.bottom = if("bottom" in sides) w else 0.0; b.left = if("left" in sides) w else 0.0; b.right = if("right" in sides) w else 0.0
            b.rect = OrgRect(owner.x + left, owner.y + top, cw + b.left + b.right, ch + b.top + b.bottom)
            b.topLeft = radii["top-left"] ?: 0.0; b.topRight = radii["top-right"] ?: 0.0; b.bottomLeft = radii["bottom-left"] ?: 0.0; b.bottomRight = radii["bottom-right"] ?: 0.0
            b.roles = roles; return b
        }
        val risers = HashMap<String, Pair<Double, Double>>()
        for(parent in l.items) {
            val kids = byParent[parent.node.id] ?: continue; val g = parent.group ?: continue
            if(kids.size > 1) kids.forEachIndexed { j, k ->
                val first = j == 0; val last = j == kids.size - 1; val riser = k.onPath
                val bw = k.branch.w; val bh = k.branch.h
                var before: OrgChartBorderBox? = null; var after: OrgChartBorderBox? = null
                if(vertical) {
                    val bs = HashSet<String>(); if(!first) bs += "top"; if(last) { bs += "top"; bs += end }
                    val aS: Set<String> = if(last) emptySet() else setOf("top", start)
                    val ebw = if("left" in bs || "right" in bs) w else 0.0; val eaw = if("left" in aS || "right" in aS) w else 0.0
                    val bl = if(rtl) bw / 2 else bw - bw / 2 - (bw / 2 + ebw); val al = if(rtl) bw - bw / 2 - (bw / 2 + eaw) else bw / 2
                    if(bs.isNotEmpty()) before = box(k.branch, bl, 0.0, bw / 2, L, bs, if(last) mapOf("top-$end" to r) else emptyMap(), mapOf("top" to false, end to riser))
                    if(aS.isNotEmpty()) after = box(k.branch, al, 0.0, bw / 2, L, aS, if(first) mapOf("top-$start" to r) else emptyMap(), mapOf("top" to false, start to riser))
                    if(k.onPath) {
                        // Non-last children rise on ::after's inline-start border, the last one on ::before's inline-end border.
                        val rb = if(last) before!! else after!!; val atLeft = if(last) rtl else !rtl
                        risers[k.node.id] = if(atLeft) rb.rect.x to rb.rect.x + w else rb.rect.maxX - w to rb.rect.maxX
                    }
                } else {
                    val bs = HashSet<String>(); if(!first) bs += start; if(last) { bs += start; bs += "bottom" }
                    val aS: Set<String> = if(last) emptySet() else setOf(start, "top")
                    val bl = if(rtl) bw - (L + w) else 0.0
                    if(bs.isNotEmpty()) before = box(k.branch, bl, 0.0, L, bh / 2, bs, if(last) mapOf("bottom-$start" to r) else emptyMap(), mapOf(start to false, "bottom" to riser))
                    if(aS.isNotEmpty()) after = box(k.branch, bl, bh / 2, L, bh / 2, aS, if(first) mapOf("top-$start" to r) else emptyMap(), mapOf(start to false, "top" to riser))
                    if(k.onPath) { val rb = if(last) before!! else after!!; risers[k.node.id] = if(last) rb.rect.maxY - w to rb.rect.maxY else rb.rect.y to rb.rect.y + w }
                }
                before?.let { it.owner = parent.node.id; it.branch = k.node.id; boxes += it }; after?.let { it.owner = parent.node.id; it.branch = k.node.id; boxes += it }
            }
            val trail = kids.any { it.onPath }
            val drop = if(vertical) box(g, if(rtl) g.w - g.w / 2 - w else g.w / 2, 0.0, 0.0, L, setOf(start), roles = mapOf(start to trail))
                       else box(g, if(rtl) g.w - L else 0.0, g.h / 2, L, 0.0, setOf("top"), roles = mapOf("top" to trail))
            drop.owner = parent.node.id
            boxes += drop
            // The trail's run: one border box from the drop to the outermost on-path riser on each side (source measureTrail).
            if(!trail || kids.size <= 1) continue
            val d0 = if(vertical) drop.rect.x else drop.rect.y; val d1 = d0 + w; val dm = (d0 + d1) / 2
            val on = kids.filter { it.onPath }.mapNotNull { k -> risers[k.node.id]?.let { Triple(k, it.first, it.second) } }
            val lo = on.filter { (it.second + it.third) / 2 < dm - 0.5 }; val hi = on.filter { (it.second + it.third) / 2 > dm + 0.5 }
            if(lo.isEmpty() && hi.isEmpty()) continue
            val from = min(d0, lo.minOfOrNull { it.second } ?: d0); val to = max(d1, hi.maxOfOrNull { it.third } ?: d1)
            val bus = if(vertical) "top" else start
            val loSide = if(vertical) "left" else "top"; val hiSide = if(vertical) "right" else "bottom"
            fun outermost(high: Boolean): String {
                if(!vertical) return (if(high) kids.last() else kids.first()).node.id
                val sorted = kids.sortedBy { it.branch.x }; return (if(high) sorted.last() else sorted.first()).node.id
            }
            val sides = hashSetOf(bus); val radii = HashMap<String, Double>()
            fun corner(e: String) = if(vertical) "$bus-$e" else "$e-$bus"
            if(lo.isNotEmpty()) { sides += loSide; if(lo.any { it.first.node.id == outermost(false) }) radii[corner(loSide)] = r }
            if(hi.isNotEmpty()) { sides += hiSide; if(hi.any { it.first.node.id == outermost(true) }) radii[corner(hiSide)] = r }
            val run = OrgChartBorderBox(if(vertical) OrgRect(from, g.y + L, to - from, L) else OrgRect(if(rtl) g.maxX - 2 * L else g.x + L, from, L, to - from))
            run.top = if("top" in sides) w else 0.0; run.bottom = if("bottom" in sides) w else 0.0; run.left = if("left" in sides) w else 0.0; run.right = if("right" in sides) w else 0.0
            run.topLeft = radii["top-left"] ?: 0.0; run.topRight = radii["top-right"] ?: 0.0; run.bottomLeft = radii["bottom-left"] ?: 0.0; run.bottomRight = radii["bottom-right"] ?: 0.0
            run.roles = mapOf("top" to true, "bottom" to true, "left" to true, "right" to true)
            run.owner = parent.node.id
            boxes += run
        }
        return boxes
    }
}
