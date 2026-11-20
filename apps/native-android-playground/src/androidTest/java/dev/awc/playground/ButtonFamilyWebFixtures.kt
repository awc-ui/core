package dev.awc.playground

import androidx.compose.foundation.layout.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import dev.awc.nativeui.*
import org.json.JSONArray
import org.json.JSONObject

/**
 * The button family scene shared by NativeButtonFamilyPaintTest and NativeButtonFamilyStatesTest (gate-7 R1-03a–f): the
 * family.js node schema ({tag,id,props,attrs,appearance,children:[node|{text}|{symbol,slot}]}) rendered through AWCComponent
 * (production dispatch) inside the scope box Chrome used (left/top/width, direction, inherited density). Hooks go through each
 * tag's public appearance scope (fromValues with the Laboratory field names); md-segmented-button and md-fab-menu-item scope
 * their own node only (the source styles that element). md-fab-menu cases render the anchor and the menu in AWCFabMenuScope.
 */
internal typealias FamilySink = (name: String, tag: String, id: String, detail: Any?) -> Unit

internal object FamilyWeb {
    /** The test root's width in CSS px (Density 2 on the emulator screen); scenes wider than it are shifted left (see shift). */
    var viewport = 540.0
    /** Whole-px leftward shift that keeps Chrome's clip on the emulator screen (the comparison maps it back). */
    fun shift(c: JSONObject): Int { val clip = c.optJSONObject("clip") ?: return 0
        return kotlin.math.max(0.0, kotlin.math.ceil(clip.getDouble("x") + clip.getDouble("width") - viewport + 2)).toInt() }
    /** Chrome's root width overflows the scope box (CSS fit-content with a larger min-content): measure it unconstrained. */
    fun overflows(c: JSONObject): Boolean {
        val r = c.optJSONArray("snaps")?.optJSONObject(0)?.optJSONObject("rect") ?: c.optJSONArray("rest")?.optJSONObject(0) ?: return false
        return r.optDouble("width", 0.0) > c.optDouble("width", 360.0) + .5
    }
    fun value(v: Any?): Any? = when (v) {
        null, JSONObject.NULL -> null
        is JSONArray -> (0 until v.length()).map { value(v.get(it)) }
        is JSONObject -> v.keys().asSequence().associateWith { value(v.get(it)) }
        else -> v
    }
    fun map(o: JSONObject?): Map<String, Any?> = o?.keys()?.asSequence()?.associateWith { value(o.get(it)) } ?: emptyMap()
    fun nodes(c: JSONObject): List<JSONObject> = c.getJSONArray("nodes").let { a -> (0 until a.length()).map { a.getJSONObject(it) } }
    fun kids(n: JSONObject): List<JSONObject> = n.optJSONArray("children")?.let { a -> (0 until a.length()).map { a.getJSONObject(it) } } ?: emptyList()
    /** The authored id, else the index path ("n0-1-2"), as on SwiftUI. */
    fun id(n: JSONObject, path: String): String = if (n.has("id") && !n.isNull("id")) n.getString("id") else path
    fun slotOf(n: JSONObject): String = if (n.has("text") || n.has("symbol")) n.optString("slot", "").let { if (it == "null") "" else it }
        else n.optJSONObject("attrs")?.optString("slot", "").orEmpty().ifEmpty { n.optJSONObject("props")?.optString("slot", "").orEmpty() }
    /** md-fab-menu paint cases are opened after build in Chrome and settled: natively the menu is authored open. */
    fun opened(c: JSONObject): JSONObject {
        if (!c.optBoolean("open") || c.getJSONArray("nodes").length() != 2) return c
        val copy = JSONObject(c.toString()); val menu = copy.getJSONArray("nodes").getJSONObject(1)
        (menu.optJSONObject("props") ?: JSONObject().also { menu.put("props", it) }).put("open", true)
        return copy
    }
    /** Applies a recorded `set` action ({at:{root,child?},prop,value}) to a copy of the run's tree. */
    fun set(r: JSONObject, a: JSONObject): JSONObject {
        val copy = JSONObject(r.toString()); val at = a.getJSONObject("at")
        var n = copy.getJSONArray("nodes").getJSONObject(at.getInt("root"))
        if (at.has("child") && !at.isNull("child")) n = n.getJSONArray("children").getJSONObject(at.getInt("child"))
        (n.optJSONObject("props") ?: JSONObject().also { n.put("props", it) }).put(a.getString("prop"), a.get("value"))
        return copy
    }
}

@Composable
internal fun FamilyNode(n: JSONObject, path: String, sink: FamilySink, focus: (String, Boolean) -> Unit) {
    if (n.has("text")) { AWCSlotText(n.getString("text")); return }
    if (n.has("symbol")) { AWCMaterialSymbol(n.getString("symbol")); return }
    val tag = n.getString("tag"); val nid = FamilyWeb.id(n, path)
    val props = FamilyWeb.map(n.optJSONObject("props")) + FamilyWeb.map(n.optJSONObject("attrs")).filterKeys { it != "slot" } +
        (if (n.has("id") && !n.isNull("id")) mapOf("id" to nid) else emptyMap())
    val kids = FamilyWeb.kids(n)
    val body: @Composable () -> Unit = {
        AWCComponent(tag, props, Modifier.onFocusChanged { focus(path, it.hasFocus) }, onEvent = { name, d -> sink(name, tag, nid, d) },
            content = if (kids.isEmpty()) null else { slot -> kids.forEachIndexed { i, k -> if (FamilyWeb.slotOf(k) == slot) FamilyNode(k, "$path-$i", sink, focus) } })
    }
    val look = FamilyWeb.map(n.optJSONObject("appearance"))
    if (look.isEmpty()) body() else when (tag) {
        "md-fab" -> AWCFabAppearanceScope(AWCFabAppearance.fromValues(look), body)
        "md-icon-button" -> AWCIconButtonAppearanceScope(AWCIconButtonAppearance.fromValues(look), body)
        "md-button-group" -> AWCButtonGroupAppearanceScope(AWCButtonGroupAppearance.fromValues(look), body)
        "md-segmented-button" -> AWCSegmentedButtonAppearanceScope(AWCSegmentedButtonAppearance.fromValues(look), body)
        "md-split-button" -> AWCSplitButtonAppearanceScope(AWCSplitButtonAppearance.fromValues(look), body)
        "md-fab-menu" -> AWCFabMenuAppearanceScope(AWCFabMenuAppearance.fromValues(look), body)
        "md-fab-menu-item" -> AWCFabMenuItemAppearanceScope(AWCFabMenuItemAppearance.fromValues(look), body)
        else -> body()
    }
}

/**
 * Chrome's scope box: a block of the case width at (left, top) whose inline component starts at the inline-start edge and overflows
 * past the inline-end edge when wider (CSS fit-content with a min-content larger than the box). Positioning is absolute (LTR);
 * the case direction applies inside the box.
 */
@Composable
private fun FamilyBox(c: JSONObject, content: @Composable () -> Unit) {
    val dir = if (c.optString("dir") == "rtl") LayoutDirection.Rtl else LayoutDirection.Ltr
    CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
        Box(Modifier.fillMaxSize()) {
            // The scope keeps Chrome's width even where it passes the emulator screen (shifted cases): unbounded, start-aligned.
            Box(Modifier.absoluteOffset((c.optDouble("left", 40.0) - FamilyWeb.shift(c)).dp, c.optDouble("top", 40.0).dp)
                .wrapContentWidth(androidx.compose.ui.Alignment.Start, unbounded = true).width(c.optDouble("width", 360.0).dp)) {
                val unbounded = FamilyWeb.overflows(c)
                CompositionLocalProvider(LocalLayoutDirection provides dir) {
                    Layout(content) { ms, k ->
                        val ps = ms.map { it.measure(if (unbounded) k.copy(minWidth = 0, minHeight = 0, maxWidth = androidx.compose.ui.unit.Constraints.Infinity) else k.copy(minWidth = 0, minHeight = 0)) }
                        val w = k.maxWidth; val h = ps.sumOf { it.height }
                        layout(w, h) { var y = 0
                            // A placeable larger than its constraints is centred on its coerced box: shift to the inline-start edge.
                            for (p in ps) { val shift = (p.measuredWidth - p.width) / 2
                                p.place(if (layoutDirection == LayoutDirection.Rtl) w - p.measuredWidth + shift else shift, y); y += p.height }
                        }
                    }
                }
            }
        }
    }
}

/** One case (or states run): the roots in Chrome's scope box; the first root is the inspection component. md-fab-menu cases put the
 *  anchor in the box and the menu in AWCFabMenuScope, the viewport (Chrome's menu host is position: fixed, inset 0). */
@Composable
internal fun FamilyScene(c: JSONObject, collector: AWCInspectionCollector, sink: FamilySink, focus: (String, Boolean) -> Unit = { _, _ -> }) {
    val nodes = FamilyWeb.nodes(c)
    val density = if (c.has("density") && !c.isNull("density")) c.getDouble("density") else 0.0
    CompositionLocalProvider(LocalLayoutDirection provides if (c.optString("dir") == "rtl") LayoutDirection.Rtl else LayoutDirection.Ltr) {
        AWCDensityScope(density) {
            if (c.optString("comp") == "fab-menu" && nodes.size == 2) AWCFabMenuScope(Modifier.fillMaxSize()) {
                FamilyBox(c) { AWCInspectionScope(collector) { FamilyNode(nodes[0], "n0", sink, focus) } }
                FamilyNode(nodes[1], "n1", sink, focus)
            } else FamilyBox(c) {
                nodes.forEachIndexed { i, n -> if (i == 0) AWCInspectionScope(collector) { FamilyNode(n, "n0", sink, focus) } else FamilyNode(n, "n$i", sink, focus) }
            }
        }
    }
}
