package dev.awc.playground.faviews

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.Log
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.absoluteOffset
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.requiredHeight
import androidx.compose.foundation.layout.requiredSize
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.wrapContentSize
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.test.platform.app.InstrumentationRegistry
import dev.awc.nativeui.*
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import java.io.File
import java.util.zip.GZIPInputStream
import kotlin.math.abs
import kotlin.math.max

/**
 * fa (gate 7, R6-05): the rendered Compose views of md-slider, md-rating and md-stepper / md-step against Mac Chrome 153 — every
 * paint case (paint, the extras with ::part rules, the inset-icon slot and the hooks) rendered through AWCComponent's dispatch at the
 * oracle host box (2 px per CSS px, compared on the 2 × 2 average): the host's rendered size must equal Chrome's host box and every
 * flat CSS pixel of the clip (glyph / text / antialiased edges excluded in either image) must match Chrome's shot. Lockstep with
 * NativeFaViewsIntegration.swift. Assets: faviews/<tag>/<oracle>.json.gz + faviews/<tag>/<shots dir>/<case>.png.
 */
class FaViewsParityTest {
    @get:Rule val compose = createComposeRule()
    private class Node(val tag: String, val attrs: Map<String, String>) { val children = ArrayList<Node>(); var text = ""
        fun first(t: String): Node? = if (tag == t) this else children.firstNotNullOfOrNull { it.first(t) }
        val allText: String get() = if (tag == "#text") text else children.joinToString(" ") { it.allText } }
    private fun parse(raw: String): Node {
        val s = raw.replace(Regex("<style>[^<]*</style>"), ""); val root = Node("#root", emptyMap()); val stack = arrayListOf(root); var i = 0
        while (i < s.length) {
            if (s[i] == '<') {
                if (i + 1 < s.length && s[i + 1] == '/') {
                    var j = i; while (j < s.length && s[j] != '>') j++
                    val name = s.substring(i + 2, minOf(j, s.length)).trim().lowercase()
                    val k = stack.indexOfLast { it.tag == name }; if (k > 0) while (stack.size > k) stack.removeAt(stack.size - 1)
                    i = j + 1; continue
                }
                var j = i + 1; val name = StringBuilder()
                while (j < s.length && !s[j].isWhitespace() && s[j] != '>' && s[j] != '/') { name.append(s[j]); j++ }
                val attrs = LinkedHashMap<String, String>(); var selfClosing = false
                while (j < s.length && s[j] != '>') {
                    if (s[j].isWhitespace()) { j++; continue }
                    if (s[j] == '/') { selfClosing = true; j++; continue }
                    val k = StringBuilder(); while (j < s.length && !s[j].isWhitespace() && s[j] != '=' && s[j] != '>' && s[j] != '/') { k.append(s[j]); j++ }
                    val v = StringBuilder()
                    if (j < s.length && s[j] == '=') {
                        j++
                        if (j < s.length && (s[j] == '"' || s[j] == '\'')) { val q = s[j]; j++; while (j < s.length && s[j] != q) { v.append(s[j]); j++ }; j++ }
                        else while (j < s.length && !s[j].isWhitespace() && s[j] != '>') { v.append(s[j]); j++ }
                    }
                    if (k.isNotEmpty()) { attrs[k.toString()] = v.toString(); selfClosing = false }
                }
                i = j + 1
                val n = Node(name.toString().lowercase(), attrs); stack.last().children += n
                if (!selfClosing && n.tag !in setOf("br", "img", "input", "circle", "path", "rect")) stack += n
                continue
            }
            val t = StringBuilder(); while (i < s.length && s[i] != '<') { t.append(s[i]); i++ }
            val tt = t.toString().trim(); if (tt.isNotEmpty()) stack.last().children += Node("#text", emptyMap()).also { it.text = tt.replace("&amp;", "&") }
        }
        return root
    }
    private val numeric = setOf("value", "min", "max", "step", "valueStart", "valueEnd", "precision", "density", "active", "defaultValue")
    private fun props(a: Map<String, String>): Map<String, Any?> {
        val p = LinkedHashMap<String, Any?>()
        for ((k, v) in a) {
            if (k.startsWith("data-") || k in setOf("class", "slot", "id", "for", "aria-label")) continue
            val parts = k.split("-"); val key = parts[0] + parts.drop(1).joinToString("") { it.replaceFirstChar(Char::uppercase) }
            p[key] = when { v.isEmpty() && key != "style" -> true; v == "true" || v == "false" -> v == "true"; key in numeric && v.toDoubleOrNull() != null -> v.toDouble(); else -> v }
        }
        a["aria-label"]?.let { p["sliderAriaLabel"] = it; p["ariaLabel"] = it }
        return p
    }
    @Suppress("UNCHECKED_CAST")
    private fun parts(html: String, tag: String): Map<String, AWCAccordionPartAppearance> {
        val raw = Regex("""data-fa-parts='([^']*)'""").find(html)?.groupValues?.get(1) ?: return emptyMap()
        val all = JSONObject(raw); if (!all.has(tag)) return emptyMap()
        val ps = all.getJSONObject(tag); val out = LinkedHashMap<String, AWCAccordionPartAppearance>()
        fun px(o: JSONObject, k: String) = if (o.has(k)) o.getString(k).replace("px", "").trim().toDoubleOrNull() else null
        fun str(o: JSONObject, k: String) = if (o.has(k)) o.getString(k).trim().uppercase() else null
        for (name in ps.keys()) {
            val d = ps.getJSONObject(name)
            // padding: the CSS shorthand of one to four lengths; border: `<width> solid <colour>` (story 5-3).
            val pv = (if (d.has("padding")) d.getString("padding") else "").split(" ").filter { it.isNotBlank() }.mapNotNull { it.replace("px", "").trim().toDoubleOrNull() }
            val pad = when (pv.size) { 1 -> AWCAccordionInsets(pv[0], pv[0], pv[0], pv[0]); 2 -> AWCAccordionInsets(pv[0], pv[1], pv[0], pv[1])
                3 -> AWCAccordionInsets(pv[0], pv[1], pv[2], pv[1]); 4 -> AWCAccordionInsets(pv[0], pv[1], pv[2], pv[3]); else -> null }
            val bt = (if (d.has("border")) d.getString("border") else "").split(" ").filter { it.isNotBlank() }
            out[name] = AWCAccordionPartAppearance(color = str(d, "color"), backgroundColor = str(d, "background-color"),
                borderColor = bt.lastOrNull()?.takeIf { it.startsWith("#") }?.uppercase(), borderWidth = bt.firstOrNull()?.replace("px", "")?.trim()?.toDoubleOrNull(),
                cornerShape = px(d, "border-radius")?.let { r -> AWCCornerRadius(AWCCornerLength(r), AWCCornerLength(r)).let { AWCCornerShape(it, it, it, it) } },
                padding = pad, width = px(d, "width"), height = px(d, "height"),
                opacity = if (d.has("opacity")) d.getString("opacity").toDoubleOrNull() else null, gap = px(d, "gap"), fontSize = px(d, "font-size"),
                lineHeight = px(d, "line-height"), fontWeight = if (d.has("font-weight")) d.getString("font-weight").toDoubleOrNull() else null, letterSpacing = px(d, "letter-spacing"))
        }
        return out
    }
    private fun wrap(inner: @Composable () -> Unit, scope: @Composable (@Composable () -> Unit) -> Unit): @Composable () -> Unit = { scope(inner) }
    private fun hex(s: String): Color { val v = s.trim().removePrefix("#").toLong(16); return Color(0xFF000000 or v) }

    private var view by mutableStateOf<(@Composable () -> Unit)?>(null)
    private var dark by mutableStateOf(false)
    private var rtl by mutableStateOf(false)
    private var density by mutableStateOf(0.0)
    private var box by mutableStateOf(floatArrayOf(0f, 0f, 0f, 0f, 0f, 0f, 0f, 0f))   // clip x y w h, host x y w h
    private var hostWidthFixed by mutableStateOf(true)
    private var fullHeight by mutableStateOf<Double?>(null)
    private var bg by mutableStateOf(Color.White)
    private var epoch by mutableStateOf(0)
    private var measured = floatArrayOf(0f, 0f)
    private var scale by mutableStateOf(2f)
    private var viewportDp by mutableStateOf(1200)   // the oracle case's viewport width (Configuration.screenWidthDp: what an app's window gives the stepper)

    private fun host() = compose.setContent {
        // Chrome's viewport (1200 CSS px): md-step.css's `@media (max-width: 599px)` compact row must not follow this phone's width.
        val device = androidx.compose.ui.platform.LocalConfiguration.current
        val viewport = remember(device, viewportDp) { android.content.res.Configuration(device).apply { screenWidthDp = viewportDp } }
        CompositionLocalProvider(LocalDensity provides Density(scale, 1f), androidx.compose.ui.platform.LocalConfiguration provides viewport) {
            AWCTheme(dark) {
                AWCDensityScope(density) {
                    AWCStepperSettledScope(true) {
                        val b = box
                        Box(Modifier.testTag("clip").requiredSize(b[2].dp, b[3].dp).background(bg)) {
                            val v = view
                            if (v != null) key(epoch) {
                                CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
                                    Box(Modifier.absoluteOffset((b[4] - b[0]).dp, (b[5] - b[1]).dp).then(if (hostWidthFixed) Modifier.wrapContentSize(Alignment.TopStart, unbounded = true).width(b[6].dp)   /* the oracle host can be wider than the clip (390 in a 374 clip) */ else Modifier.wrapContentSize(Alignment.TopStart, unbounded = true))
                                        .then(fullHeight?.let { Modifier.requiredHeight(it.dp) } ?: Modifier)) {
                                        CompositionLocalProvider(LocalLayoutDirection provides if (rtl) LayoutDirection.Rtl else LayoutDirection.Ltr) {
                                            Box(Modifier.onGloballyPositioned { val k = scale; measured = floatArrayOf(it.size.width / k, it.size.height / k) }) { v() }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    /** The composable of one case, or the reason it is not renderable statically. */
    private fun content(tag: String, c: Map<String, Any?>): Pair<(@Composable () -> Unit)?, String?> {
        val html = c["html"] as String; val name = c["name"] as String; val root = parse(html)
        val el = root.first(tag) ?: return null to "no <$tag>"
        val p = props(el.attrs).toMutableMap()
        return when (tag) {
            "md-slider" -> {
                if (name.startsWith("vertical-full-height-")) p["fullHeight"] = true
                val insetSize = if (p["size"] == "xl") 32.0 else 24.0
                val s = el.children.firstOrNull { it.attrs["slot"] == "inset-icon" }
                val ps = parts(html, tag)
                val body: @Composable () -> Unit = {
                    AWCComponent("md-slider", p) { slot ->
                        if (slot == "inset-icon" && s != null) {
                            val st = s.attrs["style"]?.split(";")?.mapNotNull { d -> d.split(":", limit = 2).takeIf { it.size == 2 }?.let { it[0].trim() to it[1].trim() } }?.toMap()
                            if (s.tag == "svg") {
                                val w = s.attrs["width"]?.toDoubleOrNull() ?: insetSize; val h = s.attrs["height"]?.toDoubleOrNull() ?: insetSize
                                val vb = (s.attrs["viewBox"] ?: "0 0 $w $h").split(" ").mapNotNull { it.toDoubleOrNull() }
                                val ink = androidx.compose.material3.LocalContentColor.current
                                androidx.compose.foundation.Canvas(Modifier.requiredSize(w.dp, h.dp)) {
                                    val sx = size.width / (if (vb.size == 4) vb[2] else w).toFloat()
                                    for (ci in s.children.filter { it.tag == "circle" })
                                        drawCircle(ink, ((ci.attrs["r"]?.toDoubleOrNull() ?: 0.0) * sx).toFloat(), androidx.compose.ui.geometry.Offset(((ci.attrs["cx"]?.toDoubleOrNull() ?: 0.0) * sx).toFloat(), ((ci.attrs["cy"]?.toDoubleOrNull() ?: 0.0) * sx).toFloat()))
                                }
                            } else if (st?.get("width") != null) {
                                val w = st["width"]!!.removeSuffix("px").toDouble(); val h = (st["height"] ?: "0").removeSuffix("px").toDouble(); val r = (st["border-radius"] ?: "0").removeSuffix("px").toDouble()
                                Box(Modifier.requiredSize(w.dp, h.dp).background(hex(st["background"] ?: "#000"), androidx.compose.foundation.shape.RoundedCornerShape(r.dp)))
                            } else {
                                // a Material Symbols ligature span (the inset-size font, the inherited colour)
                                Text(s.allText, color = androidx.compose.material3.LocalContentColor.current, fontFamily = androidx.compose.ui.text.font.FontFamily(androidx.compose.ui.text.font.Font(dev.awc.nativeui.R.font.awc_material_symbols)),
                                    style = TextStyle(fontSize = with(LocalDensity.current) { insetSize.dp.toSp() }, lineHeight = with(LocalDensity.current) { insetSize.dp.toSp() }))
                            }
                        }
                    }
                }
                var v: @Composable () -> Unit = body
                for ((k, a) in ps) { val part = AWCSliderPart.fromSource(k) ?: continue; v = wrap(v) { c2 -> AWCSliderPartAppearanceScope(part, a, c2) } }
                v to null
            }
            "md-rating" -> {
                if (name.startsWith("focus-visible") || name.startsWith("hook-focus-ring")) return null to "keyboard focus (focus-visible) is a runtime state: covered by the states replays"
                val controller = if (name == "label-getlabel") AWCRatingController().apply {
                    // The page's getLabel (the parity harness's names) through the public AWCRatingController.getLabel.
                    getLabel = { v -> val names = listOf("Awful", "Poor", "Fair", "Good", "Great", "Superb")
                        if (v % 1.0 == 0.0 && v >= 0 && v.toInt() < names.size) names[v.toInt()] else v.toString() } } else null
                val body: @Composable () -> Unit = { if (controller != null) AWCRatingControllerScope(controller) { AWCComponent("md-rating", p) } else AWCComponent("md-rating", p) }
                var v: @Composable () -> Unit = body
                for ((k, a) in parts(html, tag)) { val part = AWCRatingPart.fromSource(k) ?: continue; v = wrap(v) { c2 -> AWCRatingPartAppearanceScope(part, a, c2) } }
                v to null
            }
            else -> {
                if (name.startsWith("focus-visible")) return null to "keyboard focus (focus-visible) is a runtime state: covered by the states replays"
                if (name.startsWith("slotted-text")) return null to "Android has no shared text node: slotted text is the host's own Compose Text (layout covered by the parity harness)"
                val steps = el.children.filter { it.tag == "md-step" }
                val slotted = el.children.filter { it.attrs["slot"] == "content" }
                val ink = if (c["theme"] == "dark") Color(0xFFE6E0E9) else Color(0xFF1C1B1F)
                // the oracle's `.panel` div: Roboto 14px, line-height normal (16), 4px block padding
                // The `.panel` div inherits dir=rtl: its paragraph is right-to-left whatever its first letter (U+200F starts it).
                val rlm = if (c["dir"] == "rtl") "\u200F" else ""
                val panel: @Composable (String) -> Unit = { t -> Text(rlm + t, Modifier.padding(vertical = 4.dp), color = ink, fontFamily = androidx.compose.ui.text.font.FontFamily(androidx.compose.ui.text.font.Font(dev.awc.nativeui.R.font.awc_roboto_regular)),
                    style = TextStyle(fontSize = with(LocalDensity.current) { 14.dp.toSp() }, lineHeight = with(LocalDensity.current) { 16.dp.toSp() }), maxLines = 1) }
                val body: @Composable () -> Unit = {
                    AWCComponent("md-stepper", p) { slot ->
                        if (slot == "") for ((k, s) in steps.withIndex()) key(k) {
                            AWCComponent("md-step", props(s.attrs)) { s2 -> if (s2 == "") s.children.filter { it.tag != "#text" }.forEach { panel(it.allText) } }
                        }
                        if (slot == "content") slotted.forEach { panel(it.allText) }
                    }
                }
                var v: @Composable () -> Unit = body
                for ((k, ap) in parts(html, "md-step")) { val part = AWCStepPart.fromSource(k) ?: continue; v = wrap(v) { c2 -> AWCStepPartAppearanceScope(part, ap, c2) } }
                for ((k, ap) in parts(html, "md-stepper")) { val part = AWCStepperPart.fromSource(k) ?: continue; v = wrap(v) { c2 -> AWCStepperPartAppearanceScope(part, ap, c2) } }
                v to null
            }
        }
    }

    private val instr get() = InstrumentationRegistry.getInstrumentation()
    /** An androidTest asset (packaging may store a `.gz` asset gunzipped under its name without `.gz`). */
    private fun asset(path: String): ByteArray = try {
        instr.context.assets.open(path).use { i -> (if (path.endsWith(".gz")) GZIPInputStream(i) else i).readBytes() }
    } catch (e: java.io.FileNotFoundException) {
        if (!path.endsWith(".gz")) throw e
        instr.context.assets.open(path.removeSuffix(".gz")).use { it.readBytes() }
    }
    private fun json(v: Any?): Any? = when (v) {
        null, JSONObject.NULL -> null
        is JSONObject -> LinkedHashMap<String, Any?>().also { m -> v.keys().forEach { k -> m[k] = json(v.opt(k)) } }
        is JSONArray -> (0 until v.length()).map { json(v.opt(it)) }
        else -> v
    }
    private fun num(m: Any?, k: String) = ((m as Map<*, *>)[k] as Number).toDouble()
    private val out = StringBuilder()

    @Test fun viewsMatchChrome() {
        host()
        val capDir = File(instr.targetContext.getExternalFilesDir(null), "accordion/fa-views").apply { deleteRecursively(); mkdirs() }
        val report = File(instr.targetContext.getExternalFilesDir(null), "accordion/fa-views.txt")
        val dm = instr.targetContext.resources.displayMetrics
        var total = 0; var passed = 0; val skipped = ArrayList<String>()
        // Frames are produced by advanceTimeBy only: an endless animation (a loading md-button's indicator) never lets the clock idle.
        compose.mainClock.autoAdvance = false
        val suites = listOf(Triple("md-slider", "paint.json", "shots/paint"), Triple("md-slider", "paint-extra2.json", "shots/extra2"),
            Triple("md-rating", "paint.json", "shots/paint"), Triple("md-rating", "paint-extra2.json", "shots/extra2"),
            Triple("md-stepper", "web-paint.json", "paint-shots"), Triple("md-stepper", "web-paint-extra.json", "paint-extra-shots"), Triple("md-stepper", "web-paint-extra2.json", "paint-extra2-shots"), Triple("md-stepper", "web-paint-compact.json", "paint-compact-shots"))
        for ((tag, file, shots) in suites) {
            @Suppress("UNCHECKED_CAST")
            val cases = (json(JSONObject(String(asset("faviews/$tag/$file.gz")))) as Map<String, Any?>)["cases"] as List<Map<String, Any?>>
            var ok = 0; var ran = 0; var pixels = 0; var badAll = 0; var sumAll = 0.0; var inkLow = 1.0; var at1 = 0
            for (c in cases) {
                val name = c["name"] as String
                val (v, skip) = content(tag, c)
                if (skip != null || v == null) { skipped += "$tag $file $name: $skip"; continue }
                val png = asset("faviews/$tag/$shots/$name.png"); val src = BitmapFactory.decodeByteArray(png, 0, png.size)
                val clip = c["clip"]!!; val r = (c["tree"] as Map<*, *>)["rect"]
                val cx = num(clip, "x"); val cy = num(clip, "y"); val cw = num(clip, "width").toInt(); val ch = num(clip, "height").toInt()
                val hx = num(r, "x"); val hy = num(r, "y"); val hw = num(r, "width"); val hh = num(r, "height")
                val html = c["html"] as String
                // The mobile stepper's slotted content: its 24px top margin collapses through the host in Chrome (outside the
                // host box); the native view keeps it as leading space inside its frame (StepperLayout hostOff).
                val marginTop = if (tag == "md-stepper" && html.contains("variant=\"mobile\"") && html.contains("slot=\"content\"")) 24.0 else 0.0
                val k = if (cw * 2 <= dm.widthPixels && ch * 2 <= dm.heightPixels - 300) 2 else 1
                if (k == 1) at1++
                val bgp = src.getPixel(1, 1)
                bg = Color(bgp); dark = c["theme"] == "dark"; rtl = c["dir"] == "rtl"
                viewportDp = ((c["viewport"] as? List<*>)?.firstOrNull() as? Number)?.toInt() ?: 1200
                var d = (c["density"] as? Number)?.toDouble() ?: 0.0
                if (name.startsWith("density-scale-")) name.removePrefix("density-scale-").take(1).toDoubleOrNull()?.let { d = -it }
                density = d; hostWidthFixed = tag != "md-rating"; fullHeight = if (name.startsWith("vertical-full-height-")) hh else null
                box = floatArrayOf(cx.toFloat(), cy.toFloat(), cw.toFloat(), ch.toFloat(), hx.toFloat(), (hy - marginTop).toFloat(), hw.toFloat(), hh.toFloat())
                scale = k.toFloat(); view = v; epoch++
                val diffs = ArrayList<String>()
                val bmp = try {
                    compose.mainClock.advanceTimeBy(1500); compose.waitForIdle()
                    compose.onNodeWithTag("clip").captureToImage().asAndroidBitmap()
                } catch (e: Throwable) { diffs += "render: ${e.javaClass.simpleName}: ${e.message?.lineSequence()?.firstOrNull()}"; null }
                if (bmp != null) {
                    if (abs(measured[0] - hw) > 0.75 || abs(measured[1] - marginTop - hh) > 0.75) diffs += "host size web ${hw}×$hh native ${measured[0]}×${measured[1] - marginTop}"
                    // Both images as CSS-pixel RGB planes (Chrome at DPR 1; Compose at k px per CSS px, the k × k average).
                    val ok2 = bmp.width >= cw * k && bmp.height >= ch * k && src.width >= cw && src.height >= ch
                    val n = cw * ch; val wv = Array(3) { DoubleArray(n) }; val nv = Array(3) { DoubleArray(n) }
                    if (ok2) {
                        val sp = IntArray(src.width * src.height); src.getPixels(sp, 0, src.width, 0, 0, src.width, src.height)
                        val bp = IntArray(bmp.width * bmp.height); bmp.getPixels(bp, 0, bmp.width, 0, 0, bmp.width, bmp.height)
                        val kk = (k * k).toDouble()
                        for (y in 0 until ch) for (x in 0 until cw) {
                            val q = sp[y * src.width + x]; val i = y * cw + x
                            wv[0][i] = ((q shr 16) and 255).toDouble(); wv[1][i] = ((q shr 8) and 255).toDouble(); wv[2][i] = (q and 255).toDouble()
                            for (yy in 0 until k) for (xx in 0 until k) { val r2 = bp[(k * y + yy) * bmp.width + k * x + xx]
                                nv[0][i] += ((r2 shr 16) and 255) / kk; nv[1][i] += ((r2 shr 8) and 255) / kk; nv[2][i] += (r2 and 255) / kk }
                        }
                    } else diffs += "capture ${bmp.width}x${bmp.height} for clip ${cw}x$ch at $k px per CSS px"
                    // label-external-label: the clip holds the page's own <label for> left of the host — compare the host box only.
                    val hostOnly = name == "label-external-label"
                    fun inside(x: Int, y: Int): Boolean { if (!hostOnly) return true; val px = x + cx; val py = y + cy; return px >= hx && px < hx + hw && py >= hy && py < hy + hh }
                    fun flat(v: Array<DoubleArray>, x: Int, y: Int): Boolean {
                        for (c3 in 0..2) { var lo = 999.0; var hi = -1.0; for (dy in -1..1) for (dx in -1..1) { val q = v[c3][(y + dy) * cw + x + dx]; if (q < lo) lo = q; if (q > hi) hi = q }; if (hi - lo > 6) return false }
                        return true
                    }
                    var count = 0; var bad = 0; var sum = 0.0; var worst = 0.0; var worstAt = ""
                    if (ok2) for (y in 1 until ch - 1) for (x in 1 until cw - 1) if (inside(x, y) && flat(wv, x, y) && flat(nv, x, y)) {
                        val i = y * cw + x; val dd = (0..2).maxOf { abs(wv[it][i] - nv[it][i]) }
                        count++; sum += dd; if (dd > 6) bad++
                        if (dd > worst) { worst = dd; worstAt = "(${x + cx.toInt()},${y + cy.toInt()}) web ${(0..2).map { wv[it][i].toInt() }} native ${(0..2).map { nv[it][i].toInt() }}" }
                    }
                    val mean = sum / max(count, 1)
                    if (!(bad.toDouble() / max(count, 1) <= 0.005 && mean <= 1.0)) diffs += "flat pixels: mean ${"%.2f".format(mean)}, >6: $bad/$count, worst ${worst.toInt()} at $worstAt"
                    if (count < 50) diffs += "only $count flat pixels compared"
                    // Ink (every off-background pixel): each Chrome ink pixel needs native ink within 1 px and vice versa (text placement).
                    if (ok2) {
                        val bg0 = doubleArrayOf(wv[0][cw + 1], wv[1][cw + 1], wv[2][cw + 1])
                        fun mask(v: Array<DoubleArray>) = BooleanArray(n) { i -> inside(i % cw, i / cw) && maxOf(abs(v[0][i] - bg0[0]), abs(v[1][i] - bg0[1]), abs(v[2][i] - bg0[2])) > 48 }
                        fun dilate(m: BooleanArray): BooleanArray { val o = m.copyOf(); for (i in m.indices) if (m[i]) { val x = i % cw; val y = i / cw
                            for (dy in -1..1) for (dx in -1..1) { val xx = x + dx; val yy = y + dy; if (xx in 0 until cw && yy in 0 until ch) o[yy * cw + xx] = true } }; return o }
                        val wm = mask(wv); val nm = mask(nv); val wd = dilate(wm); val nd = dilate(nm)
                        var wInk = 0; var wHit = 0; var nInk = 0; var nHit = 0
                        for (i in wm.indices) { if (wm[i]) { wInk++; if (nd[i]) wHit++ }; if (nm[i]) { nInk++; if (wd[i]) nHit++ } }
                        // No ink on either side (a disabled slider at 0.38 opacity stays within 48 of the page): nothing to place.
                        val wCov = if (wInk == 0) 1.0 else wHit.toDouble() / wInk; val nCov = if (nInk == 0) 1.0 else nHit.toDouble() / nInk
                        inkLow = minOf(inkLow, wCov, nCov)
                        if (wCov < 0.97 || nCov < 0.97) diffs += "ink: Chrome ink covered ${"%.3f".format(wCov)} ($wInk px), native ink covered ${"%.3f".format(nCov)} ($nInk px)"
                    }
                    pixels += count; badAll += bad; sumAll += sum
                }
                total++; ran++
                if (diffs.isEmpty()) { ok++; passed++ } else {
                    out.append("FAIL $name ($tag $file${if (k == 1) ", 1 px per CSS px" else ""})\n"); diffs.forEach { out.append("   $it\n") }
                    if (bmp != null) File(capDir, "$tag-$name.png").outputStream().use { bmp.compress(Bitmap.CompressFormat.PNG, 100, it) }
                }
            }
            out.append("$tag views $file: $ok/$ran  (flat pixels compared $pixels, mean |Δ| ${"%.3f".format(sumAll / max(pixels, 1))}, >6: $badAll; lowest ink cover ${"%.3f".format(inkLow)}; $at1 at 1 px per CSS px)\n")
            view = null; compose.mainClock.advanceTimeBy(100)
            report.writeText(out.toString())          // progressive: a later crash keeps the finished suites
        }
        compose.mainClock.autoAdvance = true
        skipped.forEach { out.append("skipped $it\n") }
        out.append("FaViewsParityTest: $passed/$total rendered cases match Chrome (${skipped.size} skipped)\n")
        report.writeText(out.toString())
        out.lines().filter { !it.startsWith("   ") }.take(60).forEach { Log.i("AWCAccordion", "fa-views: $it") }
        assertTrue(out.lines().filter { it.startsWith("FAIL") || it.startsWith("   ") }.take(60).joinToString("\n"), passed == total)
    }
}
