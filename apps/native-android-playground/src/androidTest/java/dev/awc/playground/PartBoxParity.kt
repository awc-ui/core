package dev.awc.playground

import androidx.compose.ui.graphics.Color
import dev.awc.nativeui.AWCPartBox
import kotlin.math.abs

/**
 * Gate-7 R6-17: a wrapper part's `::part()` rule of an oracle case as the typed [AWCPartBox], and the renderer's probed box
 * (background, border width / colour, radius, physical padding) against Chrome's computed box. Shared by the md-tabs,
 * md-navigation-bar, md-breadcrumbs and md-toolbar parity tests.
 */
internal object PartBoxParity {
    private fun px(s: String?) = s?.trim()?.removeSuffix("px")?.toDoubleOrNull()
    private fun hex(v: String) = if (Regex("^#[0-9A-Fa-f]{3,4}$").matches(v)) "#" + v.drop(1).map { "$it$it" }.joinToString("") else v
    /** The declarations of `tag::part(part){…}` in a case's rules. */
    fun rule(css: String, tag: String, part: String): Map<String, String>? {
        val m = Regex(Regex.escape("$tag::part($part){") + "([^}]*)\\}").find(css) ?: return null
        return m.groupValues[1].split(';').mapNotNull { d -> d.split(':', limit = 2).map { it.trim() }.takeIf { it.size == 2 }?.let { it[0] to it[1] } }.toMap().takeIf { it.isNotEmpty() }
    }
    /** background(-color), border (width style colour), border-radius and the padding shorthand → the typed box. */
    fun box(r: Map<String, String>?): AWCPartBox? {
        if (r == null || listOf("background-color", "background", "border", "border-radius", "padding").none { it in r }) return null
        val border = r["border"]?.split(' ')?.filter { it.isNotEmpty() }
        return AWCPartBox((r["background-color"] ?: r["background"])?.let { hex(it) }, border?.firstOrNull()?.let { px(it) }, border?.lastOrNull()?.takeIf { it.startsWith("#") }?.let { hex(it) },
            px(r["border-radius"]), r["padding"]?.split(' ')?.filter { it.isNotEmpty() }?.mapNotNull { px(it) })
    }
    private fun numbers(s: String) = Regex("-?[0-9.]+(e-?[0-9]+)?").findAll(s).mapNotNull { it.value.toDoubleOrNull() }.toList()
    private fun css(s: String): List<Double> { val n = numbers(s)
        return when { s.startsWith("rgba") && n.size >= 4 -> listOf(n[0] / 255, n[1] / 255, n[2] / 255, n[3]); s.startsWith("rgb") && n.size >= 3 -> listOf(n[0] / 255, n[1] / 255, n[2] / 255, 1.0)
            s.startsWith("color(srgb") && n.size >= 3 -> listOf(n[0], n[1], n[2], if (n.size > 3) n[3] else 1.0); else -> listOf(0.0, 0.0, 0.0, 0.0) } }
    private fun rgba(c: Any?): List<Double>? = when (c) {
        is Color -> listOf(c.red.toDouble(), c.green.toDouble(), c.blue.toDouble(), c.alpha.toDouble())
        is List<*> -> c.mapNotNull { (it as? Number)?.toDouble() }.takeIf { it.size == 4 }
        else -> null
    }
    private fun close(a: Any?, web: String, tol: Double = .014): Boolean {
        val n = rgba(a) ?: return false; val w = css(web)
        fun pm(c: List<Double>) = listOf(c[0] * c[3], c[1] * c[3], c[2] * c[3], c[3])
        return pm(n).zip(pm(w)).all { (x, y) -> abs(x - y) <= tol }
    }
    /** The five checks of a probed box (ok, label) against Chrome's computed values (CSS strings; [pad]: top, right, bottom, left). */
    fun checks(label: String, box: Map<String, Any?>?, bg: String, bw: String, bc: String, radius: String, pad: List<String>): List<Pair<Boolean, String>> {
        if (box == null) return listOf(false to "$label box measured")
        val w = px(bw) ?: 0.0
        val p = (box["padding"] as? List<*>)?.mapNotNull { (it as? Number)?.toDouble() } ?: emptyList()
        return listOf(
            close(box["background"], bg) to "$label box background ${rgba(box["background"])} vs $bg",
            (abs(((box["borderWidth"] as? Number)?.toDouble() ?: -1.0) - w) < .01) to "$label box border width ${box["borderWidth"]} vs $bw",
            (w <= 0 || close(box["borderColor"], bc)) to "$label box border colour ${rgba(box["borderColor"])} vs $bc",
            (abs(((box["radius"] as? Number)?.toDouble() ?: -1.0) - (px(radius) ?: 0.0)) < .01) to "$label box radius ${box["radius"]} vs $radius",
            (p.size == 4 && p.zip(pad.map { px(it) ?: -1.0 }).all { (a, b) -> abs(a - b) < .01 }) to "$label box padding $p vs $pad")
    }
}
