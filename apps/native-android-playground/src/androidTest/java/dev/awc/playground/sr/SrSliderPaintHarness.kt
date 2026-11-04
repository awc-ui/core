// fa (2026-10-29): from n5's generated md-slider / md-rating harness, decoupled from the chart port.
package dev.awc.playground.sr

import dev.awc.nativeui.slider.*
import dev.awc.nativeui.slider.SrRgba
import dev.awc.nativeui.slider.srParseColor
import java.io.File
import kotlin.math.abs

// md-slider paint.json → SliderLayout: every painted box (host, track, segments incl. the ::after one, stops, knobs,
// value indicators, inset icon) with its colour, radii and opacity, against Chrome's getBoundingClientRect / computed style.

object WebTokens {
    private val css = SrEnv.text("tokens.css")
    private fun block(start: String): Map<String, String> {
        val i = css.indexOf(start); val body = css.substring(css.indexOf('{', i) + 1, css.indexOf("\n}", i))
        return Regex("""(--[\w-]+)\s*:\s*([^;]+);""").findAll(body).associate { it.groupValues[1] to it.groupValues[2].trim() }
    }
    val light = block(":root {"); val dark = light + block("[data-theme=\"dark\"] {")
    fun theme(dark: Boolean, density: Double): SliderTheme {
        val t = if (dark) this.dark else light
        fun col(n: String) = t.getValue("--md-sys-color-$n")
        return SliderTheme(col("primary"), col("on-primary"), col("secondary"), col("secondary-container"), col("on-secondary-container"),
            col("inverse-surface"), col("inverse-on-surface"), col("surface"), col("on-surface"), densityScale = density)
    }
}

fun cssColor(s: String): SrRgba {
    val m = Regex("""color\(srgb ([\d.e-]+) ([\d.e-]+) ([\d.e-]+)(?: / ([\d.e-]+))?\)""").find(s)
    if (m != null) return SrRgba(m.groupValues[1].toDouble(), m.groupValues[2].toDouble(), m.groupValues[3].toDouble(), m.groupValues[4].ifEmpty { "1" }.toDouble())
    return srParseColor(s)
}

fun sliderHooksFrom(style: String): SliderHooks {
    val hk = Regex("""--md-slider-([\w-]+)\s*:\s*([^;]+)""").findAll(style).associate { it.groupValues[1] to it.groupValues[2].trim() }
    fun hp(k: String) = hk[k]?.removeSuffix("px")?.toDouble()
    return SliderHooks(
        activeColor = hk["active-color"], inactiveColor = hk["inactive-color"], tickActiveColor = hk["tick-active-color"],
        tickFilledColor = hk["tick-filled-color"], tickInactiveColor = hk["tick-inactive-color"], thumbColor = hk["thumb-color"],
        thumbWidth = hp("thumb-width"), thumbHeight = hp("thumb-height"), trackHeight = hp("track-height"), trackShape = hp("track-shape"),
        trackLength = hp("track-length"), minTrackLength = hp("min-track-length"), valueBg = hk["value-bg"], valueColor = hk["value-color"],
        valueShape = hp("value-shape"), valueFontSize = hp("value-font-size"), valueFontWeight = hk["value-font-weight"]?.toDouble(),
        valueLineHeight = hp("value-line-height"), valuePaddingInline = hp("value-padding-inline"), valuePaddingBlock = hp("value-padding-block"),
        insetIconColor = hk["inset-icon-color"], insetIconActiveColor = hk["inset-icon-active-color"], valueIndicatorReserve = hp("value-indicator-reserve"))
}

fun sliderTreeDiff(tree: Map<String, Any?>, p: SliderPaint, d: (String) -> Unit, skipHost: Boolean = false) {
    fun px(v: Any?): Double = (v as String).removeSuffix("px").toDouble()
    fun n(v: Any?): Double = (v as Number).toDouble()
    fun rectOf(v: Any?): SliderRect { val m = v as Map<String, Any?>; return SliderRect(n(m["x"]), n(m["y"]), n(m["width"]), n(m["height"])) }
    val tol = 1.0 / 64 + 1e-6
    fun eqR(label: String, web: SliderRect, mine: SliderRect) {
        if (abs(web.x - mine.x) > tol || abs(web.y - mine.y) > tol || abs(web.width - mine.width) > tol || abs(web.height - mine.height) > tol) d("$label rect web $web native $mine")
    }
    fun eqC(label: String, web: String, mine: SrRgba) {
        val w = cssColor(web)
        if (abs(w.a - mine.a) > 0.002) { d("$label alpha web $web native $mine"); return }
        if (w.a == 0.0) return
        if (abs(w.r - mine.r) > 0.6 / 255 || abs(w.g - mine.g) > 0.6 / 255 || abs(w.b - mine.b) > 0.6 / 255) d("$label colour web $web native $mine")
    }
    fun eqN(label: String, web: Double, mine: Double, t: Double = 1e-6) { if (abs(web - mine) > t) d("$label web $web native $mine") }
        val host = rectOf(tree["rect"]); val ox = host.x; val oy = host.y
    fun at(r: SliderRect) = r.offset(ox, oy)
    eqR("host", host, SliderRect(ox, oy, p.width, p.height))
    val hs: Map<String, Any?> = tree["style"].cast()
    eqN("paddingTop", px(hs["paddingTop"]), p.paddingTop); eqN("paddingLeft", px(hs["paddingLeft"]), p.paddingLeft); eqN("paddingRight", px(hs["paddingRight"]), p.paddingRight)
    eqN("opacity", (hs["opacity"] as String).toDouble(), p.opacity)
    val parts: List<Map<String, Any?>> = tree["parts"].cast()
    fun part(k: String) = parts.filter { it["part"] == k }
    fun radii(m: Map<String, Any?>) = SliderRadii(px(m["borderTopLeftRadius"]), px(m["borderTopRightRadius"]), px(m["borderBottomRightRadius"]), px(m["borderBottomLeftRadius"]))
    part("track").single().let { eqR("track", rectOf(it["rect"]), at(p.track)); eqN("trackRadius", px(it["borderTopLeftRadius"]), p.trackRadius) }
    fun segCheck(label: String, web: Map<String, Any?>?, kind: String, rect: SliderRect?, rad: SliderRadii?, bg: String?) {
        val mine = p.segments.firstOrNull { it.kind == kind }
        if ((web == null) != (mine == null)) { d("$label presence web ${web != null} native ${mine != null}"); return }
        if (mine == null) return
        eqR(label, rect!!, at(mine.rect))
        if (rad != mine.radii) d("$label radii web $rad native ${mine.radii}")
        eqC(label, bg!!, mine.color)
    }
    part("track-inactive").single().let { segCheck("inactive", it, "inactive", rectOf(it["rect"]), radii(it), it["backgroundColor"] as String) }
    part("track-active").single().let { segCheck("active", it, "active", rectOf(it["rect"]), radii(it), it["backgroundColor"] as String) }
    val after = tree["trackAfter"] as Map<String, Any?>?
    if (after == null) segCheck("after", null, "after", null, null, null) else {
        // Rebuilt from the pseudo's computed insets (no client rect for ::after): in RTL the used box hangs off
        // `right` — the computed `left` keeps its specified 0px even when over-constrained.
        val tr = rectOf(after["trackRect"]); val aw = px(after["width"])
        val ax = if ((tree["style"] as Map<String, Any?>)["direction"] == "rtl") tr.x + tr.width - px(after["right"]) - aw else tr.x + px(after["left"])
        segCheck("after", after, "after", SliderRect(ax, tr.y + px(after["top"]), aw, px(after["height"])), radii(after), after["backgroundColor"] as String)
    }
    val knobs = part("thumb-knob")
    if (knobs.size != p.thumbs.size) d("knobs web ${knobs.size} native ${p.thumbs.size}")
    val thumbs: List<Map<String, Any?>> = tree["thumbs"].cast()
    for ((i, t) in p.thumbs.withIndex()) {
        knobs.getOrNull(i)?.let { k -> eqR("knob[$i]", rectOf(k["rect"]), at(t.knob)); eqC("knob[$i]", k["backgroundColor"] as String, t.knobColor); eqN("knob[$i] radius", px(k["borderTopLeftRadius"]), 9999.0) }
        thumbs.getOrNull(i)?.let { eqR("thumb[$i]", rectOf(it["rect"]), at(t.box)) }
    }
    val inds = part("value-indicator")
    if (inds.size != p.indicators.size) d("indicators web ${inds.size} native ${p.indicators.size}")
    for ((i, ind) in p.indicators.withIndex()) inds.getOrNull(i)?.let { w ->
        eqR("indicator[$i]", rectOf(w["rect"]), at(ind.rect))
        if (w["text"] != ind.text) d("indicator[$i] text web ${w["text"]} native ${ind.text}")
        eqC("indicator[$i] bg", w["backgroundColor"] as String, ind.background); eqC("indicator[$i] fg", w["color"] as String, ind.color)
        eqN("indicator[$i] radius", px(w["borderTopLeftRadius"]), ind.radius); eqN("indicator[$i] font", px(w["fontSize"]), ind.fontSize)
        eqN("indicator[$i] weight", (w["fontWeight"] as String).toDouble(), ind.fontWeight)
        eqN("indicator[$i] padBlock", px(w["paddingTop"]), ind.paddingBlock); eqN("indicator[$i] padInline", px(w["paddingLeft"]), ind.paddingInline)
    }
    val ins = part("inset")
    if (ins.size != (if (p.inset != null) 1 else 0)) d("inset web ${ins.size} native ${p.inset != null}")
    ins.firstOrNull()?.let { w -> p.inset?.let { eqR("inset", rectOf(w["rect"]), at(it.rect)); eqC("inset fg", w["color"] as String, it.color) } }
    val ticks: List<Map<String, Any?>> = tree["ticks"].cast()
    if (ticks.size != p.ticks.size) d("ticks web ${ticks.size} native ${p.ticks.size}")
    for ((i, t) in p.ticks.withIndex()) ticks.getOrNull(i)?.let { w ->
        val kind = (w["cls"] as String).substringAfter("md-slider__tick--on-")
        if (kind != t.kind) d("tick[$i] kind web $kind native ${t.kind}")
        eqR("tick[$i]", rectOf(w["rect"]), at(t.rect)); eqC("tick[$i]", w["background"] as String, t.color); eqN("tick[$i] opacity", n(w["opacity"]), t.opacity)
    }
    val thumbCls: List<String> = (tree["thumbs"] as List<Map<String, Any?>>).map { it["cls"] as String }
    for ((i, t) in p.thumbs.withIndex()) thumbCls.getOrNull(i)?.let { cls ->
        if (cls.contains("--pressing") != t.pressing) d("thumb[$i] pressing web $cls native ${t.pressing}")
        if (cls.contains("--focus-visible") != t.focusRing) d("thumb[$i] focus-visible web $cls native ${t.focusRing}")
    }
}

class SliderPaintCase(val c: Map<String, Any?>) {
    val name = c["name"] as String
    val tree: Map<String, Any?> = c["tree"].cast()
    val diffs = mutableListOf<String>()
    fun d(m: String) { if (diffs.size < 40) diffs.add(m) }
    fun px(v: Any?): Double = (v as String).removeSuffix("px").toDouble()
    fun n(v: Any?): Double = (v as Number).toDouble()
    fun rectOf(v: Any?): SliderRect { val m = v as Map<String, Any?>; return SliderRect(n(m["x"]), n(m["y"]), n(m["width"]), n(m["height"])) }
    val tol = 1.0 / 64 + 1e-6
    fun eqR(label: String, web: SliderRect, mine: SliderRect) {
        if (abs(web.x - mine.x) > tol || abs(web.y - mine.y) > tol || abs(web.width - mine.width) > tol || abs(web.height - mine.height) > tol) d("$label rect web $web native $mine")
    }
    fun eqC(label: String, web: String, mine: SrRgba) {
        val w = cssColor(web)
        if (abs(w.a - mine.a) > 0.002) { d("$label alpha web $web native $mine"); return }
        if (w.a == 0.0) return
        if (abs(w.r - mine.r) > 0.6 / 255 || abs(w.g - mine.g) > 0.6 / 255 || abs(w.b - mine.b) > 0.6 / 255) d("$label colour web $web native $mine")
    }
    fun eqN(label: String, web: Double, mine: Double, t: Double = 1e-6) { if (abs(web - mine) > t) d("$label web $web native $mine") }

    fun run(): List<String> {
        val html = c["html"] as String
        val tagStart = html.indexOf("<md-slider")
        val attrs = html.substring(tagStart, html.indexOf('>', tagStart))
        fun attr(n: String): String? = Regex("""\s$n(?:="([^"]*)")?(?=[\s>]|$)""").find(attrs)?.let { it.groups[1]?.value ?: "" }
        fun num(n: String, dflt: Double) = attr(n)?.toDoubleOrNull() ?: dflt
        fun flag(n: String) = attr(n) != null
        val s = SliderInteraction()
        s.min = num("min", 0.0); s.max = num("max", 100.0); s.step = num("step", 1.0)
        s.disabled = flag("disabled"); s.variant = attr("variant") ?: "standard"; s.range = flag("range"); s.stops = flag("stops")
        s.size = attr("size") ?: "xs"; s.orientation = attr("orientation") ?: "horizontal"
        s.valueIndicator = flag("value-indicator"); s.labeled = flag("labeled"); s.insetIcon = flag("inset-icon")
        s.rtl = c["dir"] == "rtl"
        s.load(num("value", 50.0), num("value-start", 0.0), num("value-end", 100.0))
        val hooks = sliderHooksFrom(attr("style") ?: "")
        val densityScale = Regex("""^density-scale-(\d)""").find(name)?.groupValues?.get(1)?.toDouble()?.let { -it } ?: 0.0
        val theme = WebTokens.theme(c["theme"] == "dark", densityScale)
        val fullH = flag("full-height")
        val boxH = when { name.startsWith("vertical-full-height-") -> name.substringAfterLast('-').toDouble(); else -> null }
        val p = SliderLayout.layout(s, theme, hooks, ApproxMeasurer(), if (boxH != null) 0.0 else n(c["width"]), boxH, fullH, attr("density")?.toIntOrNull())

        sliderTreeDiff(tree, p, ::d)
        return diffs
    }
}

object SliderPaintCheck { @JvmStatic fun main(args: Array<String>) {
    val root: Map<String, Any?> = srParseJson(File(args[0]).readText()).cast()
    val cases: List<Map<String, Any?>> = root["cases"].cast()
    var ok = 0
    for (c in cases) {
        val r = SliderPaintCase(c)
        val diffs = try { r.run() } catch (e: Exception) { listOf("EXC $e ${e.stackTrace.take(4).joinToString()}") }
        if (diffs.isEmpty()) ok++ else { println("FAIL ${r.name}"); diffs.take(10).forEach { println("   $it") } }
    }
    println("slider paint: $ok/${cases.size}")
} }
