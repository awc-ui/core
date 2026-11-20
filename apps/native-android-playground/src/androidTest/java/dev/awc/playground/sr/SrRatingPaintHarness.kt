// fa (2026-10-29): from n5's generated md-slider / md-rating harness, decoupled from the chart port.
package dev.awc.playground.sr

import dev.awc.nativeui.rating.*
import dev.awc.nativeui.slider.SliderRect
import dev.awc.nativeui.slider.SrRgba
import java.io.File
import kotlin.math.abs

// md-rating paint.json → RatingLayout: host row, items, each item's box / fill class / clip / glyph colours and
// axes, the value label box, text and font, the focus ring and the disabled opacity.

fun ratingTheme(dark: Boolean, density: Double): RatingTheme {
    val t = if (dark) WebTokens.dark else WebTokens.light
    fun col(n: String) = t.getValue("--md-sys-color-$n")
    return RatingTheme(col("secondary"), col("on-surface"), col("on-surface-variant"), densityScale = density)
}

fun ratingHooks(style: String): RatingHooks {
    val hk = Regex("""--md-rating-([\w-]+)\s*:\s*([^;]+)""").findAll(style).associate { it.groupValues[1] to it.groupValues[2].trim() }
    fun px(k: String) = hk[k]?.removeSuffix("px")?.toDouble()
    // `font` shorthand: [weight] size/line-height family
    val font = hk["value-label-font"]?.let { Regex("""(\d+px)/(\d+)px\s+(.+)$""").find(it) }
    return RatingHooks(itemSize = px("item-size"), itemGap = px("item-gap"), activeColor = hk["active-color"], inactiveColor = hk["inactive-color"],
        focusRingColor = hk["focus-ring-color"], focusRingWidth = px("focus-ring-width"), focusRingOffset = px("focus-ring-offset"),
        stateLayerColor = hk["state-layer-color"], valueLabelColor = hk["value-label-color"],
        valueLabelFontFamily = font?.groupValues?.get(3), valueLabelLineHeight = font?.groupValues?.get(2)?.toDouble(),
        popScale = hk["pop-scale"]?.toDouble(), durationMs = hk["duration"]?.removeSuffix("ms")?.toDouble())
}

class RatingPaintCase(val c: Map<String, Any?>) {
    val name = c["name"] as String
    val diffs = mutableListOf<String>()
    fun d(m: String) { if (diffs.size < 40) diffs.add(m) }
    fun run(): List<String> {
        val html = c["html"] as String
        val a = html.substring(html.indexOf("<md-rating"), html.indexOf('>', html.indexOf("<md-rating")))
        fun attr(n: String): String? = Regex("""\s$n(?:="([^"]*)")?(?=[\s>]|$)""").find(a)?.let { it.groups[1]?.value ?: "" }
        val r = RatingInteraction()
        r.precision = attr("precision")?.toDouble() ?: 1.0; r.max = attr("max")?.toInt() ?: 5
        r.defaultValue = attr("default-value")?.toDouble() ?: 0.0
        r.readonly = attr("readonly") != null; r.disabled = attr("disabled") != null; r.softDisabled = attr("soft-disabled") != null
        r.rtl = c["dir"] == "rtl"
        r.setValueProp(attr("value")?.toDouble() ?: 0.0)
        if (name.startsWith("focus-visible") && r.focusable) r.focus(keyboard = true)
        if (name == "label-getlabel") r.getLabel = { v -> listOf("Awful", "Poor", "Fair", "Good", "Great", "Superb").getOrNull(v.toInt())?.takeIf { v % 1.0 == 0.0 } ?: dev.awc.nativeui.slider.srJsNumberString(v) }
        val density = Regex("""^density-scale-(\d)""").find(name)?.groupValues?.get(1)?.toDouble()?.let { -it } ?: 0.0
        val outlineEmpty = attr("outline-empty")?.let { it != "false" } ?: true
        val icon = attr("icon") ?: "star"
        val p = RatingLayout.layout(r, ratingTheme(c["theme"] == "dark", density), dev.awc.nativeui.RatingParts.hooks(ratingHooks(attr("style") ?: ""), caseParts(c["html"] as String, "md-rating").mapNotNull { (k, v) -> dev.awc.nativeui.AWCRatingPart.fromSource(k)?.let { it to v } }.toMap()), ApproxMeasurer(),
            size = attr("size") ?: "md", icon = icon, emptyIcon = attr("empty-icon") ?: "star",
            outlineEmpty = outlineEmpty, showValueLabel = attr("show-value-label") != null, densityProp = attr("density")?.toIntOrNull())
        val tree: Map<String, Any?> = c["tree"].cast()
        fun n(v: Any?) = (v as Number).toDouble()
        fun rect(v: Any?): SliderRect { val m = v as Map<String, Any?>; return SliderRect(n(m["x"]), n(m["y"]), n(m["width"]), n(m["height"])) }
        fun px(v: Any?) = (v as String).removeSuffix("px").toDouble()
        val tol = 1.0 / 64 + 1e-6
        fun eqR(l: String, w: SliderRect, m: SliderRect) { if (abs(w.x - m.x) > tol || abs(w.y - m.y) > tol || abs(w.width - m.width) > tol || abs(w.height - m.height) > tol) d("$l rect web $w native $m") }
        fun eqC(l: String, web: String, m: SrRgba) {
            val w = cssColor(web)
            if (abs(w.a - m.a) > 0.002) { d("$l alpha web $web native $m"); return }
            if (w.a == 0.0) return
            if (abs(w.r - m.r) > 0.6 / 255 || abs(w.g - m.g) > 0.6 / 255 || abs(w.b - m.b) > 0.6 / 255) d("$l colour web $web native $m")
        }
        val host = rect(tree["rect"]); val ox = host.x; val oy = host.y
        fun at(r: SliderRect) = r.offset(ox, oy)
        eqR("host", host, SliderRect(ox, oy, p.width, p.height))
        val hs: Map<String, Any?> = tree["style"].cast()
        if (abs((hs["opacity"] as String).toDouble() - p.opacity) > 1e-6) d("opacity web ${hs["opacity"]} native ${p.opacity}")
        eqC("host colour", hs["color"] as String, p.activeColor)
        val parts: List<Map<String, Any?>> = tree["parts"].cast()
        parts.firstOrNull { it["part"] == "items" }?.let { w ->
            eqR("items", rect(w["rect"]), at(p.items))
            val ring = w["outlineStyle"] == "solid"
            if (ring != p.focusRing) d("focus ring web $ring native ${p.focusRing}")
            if (ring) {
                eqC("ring colour", w["outlineColor"] as String, p.focusRingColor)
                if (px(w["outlineWidth"]) != p.focusRingWidth || px(w["outlineOffset"]) != p.focusRingOffset) d("ring web ${w["outlineWidth"]}/${w["outlineOffset"]} native ${p.focusRingWidth}/${p.focusRingOffset}")
            }
        }
        val items: List<Map<String, Any?>> = tree["items"].cast()
        if (items.size != p.itemList.size) d("items web ${items.size} native ${p.itemList.size}")
        for ((i, it) in p.itemList.withIndex()) items.getOrNull(i)?.let { w ->
            eqR("item[$i]", rect(w["rect"]), at(it.rect))
            val kind = (w["cls"] as String).substringAfter("md-rating__item--").substringBefore(' ')
            if (kind != it.kind) d("item[$i] kind web $kind native ${it.kind}")
            val fg = w["fg"] as Map<String, Any?>; val bg = w["bg"] as Map<String, Any?>
            val clip = Regex("""[\d.]+(?=%)""").find(fg["clip"] as String)?.value?.toDouble() ?: -1.0
            val fromLeft = (fg["clip"] as String).let { Regex("""inset\(0px 0px 0px [\d.]+%\)""").matches(it) }
            if (abs(clip - it.clipPct) > 1e-6 || (clip > 0 && fromLeft != it.clipFromLeft)) d("item[$i] clip web ${fg["clip"]} native ${it.clipPct}% left=${it.clipFromLeft}")
            eqC("item[$i] fg", fg["color"] as String, p.iconColor ?: p.activeColor); eqC("item[$i] bg", bg["color"] as String, p.inactiveColor)
            if (fg["text"] != p.icon) d("item[$i] icon web ${fg["text"]} native ${p.icon}")
            if (bg["text"] != p.emptyIcon) d("item[$i] empty icon web ${bg["text"]} native ${p.emptyIcon}")
            val fvs = bg["fvs"] as String
            if (!fvs.contains("\"FILL\" ${p.emptyFill}") || !fvs.contains("\"wght\" ${p.emptyWeight}")) d("item[$i] empty axes web $fvs native FILL ${p.emptyFill} wght ${p.emptyWeight}")
            val st = (w["state"] as Map<String, Any?>)
            val stOp = n(st["opacity"]); val shown = st["display"] != "none"
            if (shown && abs(stOp - it.stateOpacity) > 1e-6) d("item[$i] state web $stOp native ${it.stateOpacity}")
            if ((w["transform"] as String) != "none" && it.scale == 1.0) d("item[$i] transform web ${w["transform"]}")
        }
        val lab = parts.firstOrNull { it["part"] == "value-label" }
        if ((lab != null) != (p.label != null)) d("label presence web ${lab != null} native ${p.label != null}")
        if (lab != null && p.label != null) {
            eqR("label", rect(lab["rect"]), at(p.label!!))
            eqC("label colour", lab["color"] as String, p.labelColor)
            if (px(lab["fontSize"]) != p.labelFontSize || (lab["fontWeight"] as String).toDouble() != p.labelFontWeight || px(lab["lineHeight"]) != p.labelLineHeight)
                d("label font web ${lab["fontSize"]} ${lab["fontWeight"]} ${lab["lineHeight"]} native ${p.labelFontSize} ${p.labelFontWeight} ${p.labelLineHeight}")
            if (tree["valueLabel"] != p.labelText) d("label text web ${tree["valueLabel"]} native ${p.labelText}")
        }
        return diffs
    }
}

object RatingPaintCheck { @JvmStatic fun main(args: Array<String>) {
    val root: Map<String, Any?> = srParseJson(File(args[0]).readText()).cast()
    val cases: List<Map<String, Any?>> = root["cases"].cast()
    var ok = 0
    for (c in cases) {
        val r = RatingPaintCase(c)
        val diffs = try { r.run() } catch (e: Exception) { listOf("EXC $e ${e.stackTrace.take(4).joinToString()}") }
        if (diffs.isEmpty()) ok++ else { println("FAIL ${r.name}"); diffs.take(8).forEach { println("   $it") } }
    }
    println("rating paint: $ok/${cases.size}")
} }
