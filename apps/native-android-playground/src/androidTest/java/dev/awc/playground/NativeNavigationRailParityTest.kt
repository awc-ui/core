package dev.awc.playground

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.graphics.toPixelMap
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dev.awc.nativeui.*
import dev.awc.nativeui.generated.AWCGeneratedTokens
import dev.awc.playground.CardWeb.objects
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import kotlin.math.abs
import kotlin.math.min

/**
 * md-navigation-rail / md-navigation-rail-tab against Chrome (rail.html, Mac Chrome 153, DPR 1; rail-web-paint.json, the
 * same fixture as the SwiftUI suite): host, modal surface and scrim, destinations, toggle, overflow trigger, footer profile,
 * FAB, and per destination its box, colour, indicator / icon wrapper / icon / label / badge boxes and paint, tab stop, role,
 * active state and accessible name; flat pixels of the rail (slotted brand / avatar / name stand-ins masked).
 * rail-web-paint-parts.json (rail-parts.html): the header slot and every exported part styled through ::part() — the typed
 * part appearance scopes with the authored values (part boxes, colours, typography, opacities).
 */
@OptIn(ExperimentalTestApi::class)
class NativeNavigationRailParityTest {
    @get:Rule val compose = createComposeRule()
    private var case by mutableStateOf(JSONObject("{\"name\":\"init\",\"nodesJSON\":\"[]\"}"))
    private var nodes by mutableStateOf<List<JSONObject>>(emptyList())
    private var epoch by mutableIntStateOf(0)
    private var origin by mutableStateOf(24.0 to 24.0)
    private var frame by mutableStateOf(420.0 to 560.0)
    private var viewport by mutableStateOf<Size?>(null)
    private var railParts by mutableStateOf<List<Pair<AWCNavigationRailPart, AWCAccordionPartAppearance>>>(emptyList())
    private var tabParts by mutableStateOf<List<Pair<AWCNavigationRailTabPart, AWCAccordionPartAppearance>>>(emptyList())
    private val scale = 2f
    private val probe = AWCNavigationRailProbe()
    private val events = mutableListOf<Pair<String, String>>()
    private var checks = 0; private val failures = mutableListOf<String>(); private val report = JSONArray()
    private fun check(ok: Boolean, label: String) { checks++; if (!ok) failures += label }
    private fun hex(v: String?) = Color(android.graphics.Color.parseColor(v!!))
    private fun numbers(s: String) = Regex("-?[0-9.]+(e-?[0-9]+)?").findAll(s).mapNotNull { it.value.toDoubleOrNull() }.toList()
    private fun css(s: String): List<Double> { val n = numbers(s)
        return when { s.startsWith("rgba") && n.size >= 4 -> listOf(n[0] / 255, n[1] / 255, n[2] / 255, n[3]); s.startsWith("rgb") && n.size >= 3 -> listOf(n[0] / 255, n[1] / 255, n[2] / 255, 1.0)
            s.startsWith("color(srgb") && n.size >= 3 -> listOf(n[0], n[1], n[2], if (n.size >= 4) n[3] else 1.0); else -> listOf(0.0, 0.0, 0.0, 0.0) } }
    private fun rgba(c: Any?): List<Double>? = (c as? Color)?.let { listOf(it.red.toDouble(), it.green.toDouble(), it.blue.toDouble(), it.alpha.toDouble()) }
    private fun colorClose(a: Any?, web: String, tol: Double = .014): Boolean {
        val n = rgba(a) ?: return false; val w = css(web)
        fun pm(c: List<Double>) = listOf(c[0] * c[3], c[1] * c[3], c[2] * c[3], c[3])
        return pm(n).zip(pm(w)).all { (x, y) -> abs(x - y) <= tol }
    }
    private fun rect(o: JSONObject?): List<Double>? = o?.let { if (it.has("x")) listOf(it.getDouble("x"), it.getDouble("y"), it.getDouble("width"), it.getDouble("height")) else null }
    private fun props(o: JSONObject): Map<String, Any?> = buildMap { val p = o.optJSONObject("properties") ?: JSONObject()
        for (k in p.keys()) if (k != "_hooks" && k != "_box") put(k, p.get(k)); put("id", o.getString("id")) }
    private fun hooks(o: JSONObject?): AWCNavigationRailAppearance {
        val h = o?.optJSONObject("properties")?.optJSONObject("_hooks") ?: return AWCNavigationRailAppearance()
        return AWCNavigationRailAppearance.fromCSS(h.keys().asSequence().associateWith { h.getString(it) })
    }
    @Composable private fun Node(o: JSONObject) {
        val id = o.getString("id"); val kids = o.optJSONArray("children")?.objects() ?: emptyList()
        when (o.getString("tag")) {
            "#text" -> AWCSlotText(o.getJSONObject("properties").getString("text"))
            "#symbol" -> { val p = o.getJSONObject("properties"); val box = p.optDouble("_box", 24.0)
                Box(Modifier.size(box.dp), contentAlignment = Alignment.Center) { AWCMaterialSymbol(p.optString("name"), size = box.dp) } }
            else -> AWCComponent(o.getString("tag"), props(o), onEvent = { n, _ -> events += n to id }) { slot ->
                for (k in kids) { if (k.optString("slot").ifEmpty { "" } != slot) continue; key(k.getString("id")) { Node(k) } }
            }
        }
    }
    /** The case's ::part() rules through the public typed part scopes (nested, one per part). */
    @Composable private fun Parts(rail: List<Pair<AWCNavigationRailPart, AWCAccordionPartAppearance>>, tab: List<Pair<AWCNavigationRailTabPart, AWCAccordionPartAppearance>>,
                                  body: @Composable () -> Unit) {
        when {
            rail.isNotEmpty() -> AWCNavigationRailPartAppearanceScope(rail[0].first, rail[0].second) { Parts(rail.drop(1), tab, body) }
            tab.isNotEmpty() -> AWCNavigationRailTabPartAppearanceScope(tab[0].first, tab[0].second) { Parts(rail, tab.drop(1), body) }
            else -> body()
        }
    }
    private fun partValues(o: JSONObject?): List<Pair<String, AWCAccordionPartAppearance>> = o?.keys()?.asSequence()?.sorted()?.map { k ->
        val f = o.getJSONObject(k); k to AWCAccordionPartAppearance.fromValues(jsonValues(f)) }?.toList() ?: emptyList()
    private fun jsonValues(o: JSONObject): Map<String, Any?> = o.keys().asSequence().associateWith { k -> when (val v = o.get(k)) { is JSONObject -> jsonValues(v); is Number -> v.toDouble(); else -> v } }
    private fun content() { compose.setContent { CompositionLocalProvider(LocalDensity provides Density(scale, 1f)) {
        val c = case; val dark = c.optString("theme") == "dark"; val t = if (dark) AWCGeneratedTokens.dark else AWCGeneratedTokens.light
        // The reference page's body (surface-container-low): what a modal rail's scrim covers.
        AWCTheme(dark) { Box(Modifier.fillMaxSize().background(hex(t["--md-sys-color-surface-container-low"]))) { key(epoch) {
            val dir = if (c.optString("dir") == "rtl") LayoutDirection.Rtl else LayoutDirection.Ltr
            CompositionLocalProvider(LocalAWCNavigationRailProbe provides probe, LocalAWCNavigationRailReducedMotion provides false, LocalAWCNavigationRailViewport provides viewport) {
                AWCNavigationRailAppearanceScope(hooks(nodes.firstOrNull())) { Parts(railParts, tabParts) {
                    // The page is wider than the emulator (540 dp): unbounded, as the Chrome page.
                    Box(Modifier.wrapContentSize(Alignment.TopStart, unbounded = true).requiredSize(1200.dp, 900.dp).background(hex(t["--md-sys-color-surface-container-low"]))) {
                        Box(Modifier.absoluteOffset(origin.first.dp, origin.second.dp).requiredSize(frame.first.dp, frame.second.dp)) {
                            // Leading-aligned in the page direction (an RTL page puts a column rail at its end).
                            CompositionLocalProvider(LocalLayoutDirection provides dir) { Column(Modifier.fillMaxWidth()) { for (n in nodes) key(n.getString("id")) { Node(n) } } }
                        }
                    }
                } }
            }
        } } }
    } } }
    private fun settle(ms: Double) { var t = 0.0; while (t < ms) { compose.mainClock.advanceTimeByFrame(); t += 16.0 }; compose.waitForIdle() }

    @Test fun railMatchesChromePaint() {
        content()
        val only = androidx.test.platform.app.InstrumentationRegistry.getArguments().getString("railOnly")
        for (file in listOf("rail-web-paint", "rail-web-paint-parts"))
            for (c in CardWeb.document("$file.json").getJSONArray("cases").objects()) if (only == null || only.split(',').any { c.getString("name").contains(it) }) paint(c, file)
        AccordionEvidence.log("rail-paint", JSONObject().put("checks", checks).put("failures", failures.size).put("failureList", JSONArray(failures.take(600))).put("report", report))
        android.util.Log.i("AWCRail", "rail-paint ${checks - failures.size}/$checks")
        assertTrue("${failures.size} of $checks failed:\n" + failures.take(80).joinToString("\n"), failures.isEmpty())
    }
    private fun paint(c: JSONObject, file: String) {
        val name = c.getString("name")
        railParts = partValues(c.optJSONObject("partsRail")).mapNotNull { (k, v) -> AWCNavigationRailPart.fromSource(k)?.let { it to v } }
        tabParts = partValues(c.optJSONObject("partsTab")).mapNotNull { (k, v) -> AWCNavigationRailTabPart.fromSource(k)?.let { it to v } }
        val styled = railParts.isNotEmpty() || tabParts.isNotEmpty()
        val host = rect(c.getJSONObject("host").getJSONObject("rect"))!!
        compose.mainClock.autoAdvance = false
        var ns = JSONArray(c.getString("nodesJSON")).objects()
        val d = c.optDouble("density", 0.0)
        if (d != 0.0) ns = ns.map { n -> JSONObject(n.toString()).also { j -> val p = j.getJSONObject("properties"); if (!p.has("density")) p.put("density", d) } }
        val modal = ns.firstOrNull()?.optJSONObject("properties")?.optBoolean("modal") == true
        val horizontal = ns.firstOrNull()?.optJSONObject("properties")?.optString("orientation") == "horizontal"
        case = c; nodes = ns; origin = 24.0 to host[1]
        // A full-height rail is the viewport's height (900): its frame holds it whole (a shorter frame would centre the overflow).
        frame = c.optDouble("width", 420.0) to if (modal) 560.0 else if (horizontal) 120.0 else if (name == "full-height") 900.0 else 560.0
        viewport = if (name == "full-height") Size(1200f, 900f) else null
        probe.tabs.clear(); epoch++
        settle(700.0)
        fun near(a: Double?, b: Double?, l: String, tol: Double = .75) = check(a != null && b != null && abs(a - b) <= tol, "$name $l $a vs $b")
        fun box(r: List<Double>?, w: List<Double>?, l: String, tol: Double = .75) {
            if (r == null || w == null) { check(false, "$name $l measured"); return }
            near(r[0], w[0], "$l x", tol); near(r[1], w[1], "$l y", tol); near(r[2], w[2], "$l width", maxOf(1.0, tol)); near(r[3], w[3], "$l height", maxOf(1.0, tol))
        }
        val rail = compose.runOnIdle { probe.rail }
        // Rail-local values from the probe, placed at the rail's root position (an RTL page puts a column rail at its end).
        @Suppress("UNCHECKED_CAST") val ro = (rail["origin"] as? List<Double>) ?: listOf(origin.first, origin.second)
        @Suppress("UNCHECKED_CAST") fun at(v: Any?): List<Double>? = (v as? List<Double>)?.let { listOf(it[0] + ro[0], it[1] + ro[1], it[2], it[3]) }
        box(at(rail["host"]), host, "host (proposed ${rail["proposed"]})")
        val parts = c.getJSONObject("parts")
        if (modal) {
            box(at(rail["container"]), rect(parts.optJSONObject("container")?.optJSONObject("rect")), "modal surface")
            check(colorClose(rail["background"], parts.getJSONObject("container").optString("backgroundColor")), "$name modal surface colour ${rail["background"]}")
            near(rail["scrim"] as? Double, parts.optJSONObject("scrim")?.optString("opacity")?.toDoubleOrNull(), "scrim opacity", .01)
        } else check(colorClose(rail["background"], c.getJSONObject("host").getJSONObject("style").optString("backgroundColor")), "$name rail colour ${rail["background"]}")
        rect(parts.optJSONObject("destinations")?.optJSONObject("rect"))?.takeIf { it[2] > 0 }?.let { box(at(rail["destinations"]), it, "destinations") }
        rect(parts.optJSONObject("toggle")?.optJSONObject("rect"))?.takeIf { it[2] > 0 }?.let { w -> at(rail["toggle"])?.let { t -> near(t[1], w[1], "toggle y"); near(t[3], w[3], "toggle height") } }
        rect(parts.optJSONObject("overflow-trigger")?.optJSONObject("rect"))?.takeIf { it[2] > 0 }?.let { box(at(rail["overflow"]), it, "overflow trigger") }
        rect(parts.optJSONObject("footer-leading")?.optJSONObject("rect"))?.takeIf { it[2] > 0 }?.let { box(at(rail["leading"]), it, "footer-leading") }
        rect(parts.optJSONObject("footer-content")?.optJSONObject("rect"))?.takeIf { it[2] > 0 }?.let { w -> at(rail["content"])?.let { r -> near(r[0], w[0], "footer-content x"); near(r[1] + r[3] / 2, w[1] + w[3] / 2, "footer-content centre y", 1.0) }
            @Suppress("UNCHECKED_CAST") val fcn = rail["footerContent"] as? Map<String, Any?>; val fw = parts.getJSONObject("footer-content")
            check(colorClose(fcn?.get("color"), fw.optString("color")), "$name footer-content colour ${fcn?.get("color")} vs ${fw.optString("color")}")
            near(fcn?.get("fontSize") as? Double, numbers(fw.optString("fontSize")).firstOrNull(), "footer-content font size", .01)
            near(fcn?.get("fontWeight") as? Double, fw.optString("fontWeight").toDoubleOrNull(), "footer-content font weight", .5)
            if (fw.optString("visibility") != "hidden") near(fcn?.get("opacity") as? Double, fw.optString("opacity").toDoubleOrNull(), "footer-content opacity", .01) }
        parts.optJSONObject("overflow-trigger")?.optString("color")?.takeIf { it.isNotEmpty() && (rect(parts.optJSONObject("overflow-trigger")?.optJSONObject("rect"))?.get(2) ?: 0.0) > 0 }?.let { w ->
            check(colorClose(rail["overflowColor"], w), "$name overflow trigger colour ${rail["overflowColor"]} vs $w") }
        // Painted part boxes: each authored background at the source part's box, in its colour.
        @Suppress("UNCHECKED_CAST") val nboxes = (rail["boxes"] as? Map<String, Map<String, Any?>>) ?: emptyMap()
        for ((part, v) in railParts) {
            if (v.backgroundColor == null || part == AWCNavigationRailPart.Scrim || (modal && part == AWCNavigationRailPart.Container)) continue
            val b = nboxes[part.source] ?: run { check(false, "$name ${part.source} box measured"); null } ?: continue
            box(at(b["rect"]), rect(parts.optJSONObject(part.source)?.optJSONObject("rect")), "${part.source} box", 1.0)
            check(colorClose(b["color"], parts.getJSONObject(part.source).optString("backgroundColor")), "$name ${part.source} box colour ${b["color"]}")
        }
        if (styled && parts.optJSONObject("scrim")?.optString("opacity")?.toDoubleOrNull()?.let { it > 0 } == true) {
            check(colorClose(rail["scrimColor"], parts.getJSONObject("scrim").optString("backgroundColor")), "$name scrim colour ${rail["scrimColor"]}")
            near(rail["scrimOpacity"] as? Double, parts.getJSONObject("scrim").optString("opacity").toDoubleOrNull(), "scrim part opacity", .01) }
        c.optJSONArray("others")?.objects()?.firstOrNull { it.optString("tag") == "md-fab" }?.let { box(at(rail["fab"]), rect(it.optJSONObject("rect")), "fab", 1.0) }
        // A slotted header icon button: on the rail's axis (vertical), centred in a bar.
        c.optJSONArray("others")?.objects()?.firstOrNull { it.optString("tag") == "md-icon-button" }?.let { box(at(rail["headerItem"]), rect(it.optJSONObject("rect")), "header icon button", 1.0) }
        val railNode = ns.first()
        val tabNodes = (railNode.optJSONArray("children")?.objects() ?: emptyList()).filter { it.optString("tag") == "md-navigation-rail-tab" }
        val ax = (c.optJSONArray("ax")?.objects() ?: emptyList()).filter { it.optString("role") in setOf("tab", "link") }
        var axIndex = 0
        c.getJSONArray("tabs").objects().forEachIndexed { i, wt ->
            if (i >= tabNodes.size) return@forEachIndexed
            val id = tabNodes[i].getString("id"); val lbl = "tab$i"; val attrs = wt.getJSONObject("attrs")
            val t = compose.runOnIdle { probe.tabs[id] } ?: run { check(false, "$name $lbl measured"); return@forEachIndexed }
            val overflowedWeb = attrs.has("data-overflowed")
            check((t["overflowed"] as? Boolean ?: false) == overflowedWeb, "$name $lbl overflowed")
            check((t["tabStop"] as? Boolean ?: false) == (attrs.optString("tabindex") == "0"), "$name $lbl tab stop ${t["tabStop"]} vs ${attrs.optString("tabindex")}")
            check(t["role"] == attrs.optString("role"), "$name $lbl role ${t["role"]}")
            check((t["active"] as? Boolean ?: false) == attrs.has("active"), "$name $lbl active")
            if (overflowedWeb) return@forEachIndexed
            if (axIndex < ax.size) { check(t["name"] == ax[axIndex].optString("name"), "$name $lbl name ${t["name"]} vs ${ax[axIndex].optString("name")}"); axIndex++ }
            @Suppress("UNCHECKED_CAST") val rects = t["rects"] as Map<String, List<Double>?>
            box(at(rects["tab"]), rect(wt.getJSONObject("rect")), lbl)
            check(colorClose(t["color"], wt.getJSONObject("style").optString("color")), "$name $lbl colour ${t["color"]} vs ${wt.getJSONObject("style").optString("color")}")
            val p = wt.getJSONObject("parts")
            val ind = p.optJSONObject("indicator")
            if (ind != null && ind.optString("display") != "none") {
                box(at(rects["indicator"]), rect(ind.optJSONObject("rect")), "$lbl indicator")
                check(colorClose(t["indicatorColor"], ind.optString("backgroundColor")), "$name $lbl indicator colour ${t["indicatorColor"]} vs ${ind.optString("backgroundColor")}")
                val wr = rect(ind.optJSONObject("rect")); numbers(ind.optString("borderTopLeftRadius")).firstOrNull()?.let { r -> if (wr != null) near(t["radius"] as? Double, min(r, min(wr[2], wr[3]) / 2), "$lbl indicator radius", .01) }
            }
            p.optJSONObject("icon-wrapper")?.let { iw -> box(at(rects["iconWrapper"]), rect(iw.optJSONObject("rect")), "$lbl icon wrapper")
                if (ind?.optString("display") == "none") check(colorClose(t["indicatorColor"], iw.optString("backgroundColor")), "$name $lbl pill colour") }
            if (styled && ind != null && ind.optString("display") != "none") p.optJSONObject("state-layer")?.let { sl ->
                check(colorClose(t["layerColor"], sl.optString("backgroundColor")), "$name $lbl state layer colour ${t["layerColor"]} vs ${sl.optString("backgroundColor")}")
                near(t["layerOpacity"] as? Double, sl.optString("opacity").toDoubleOrNull(), "$lbl state layer opacity", .01) }
            if (styled && ind?.optString("display") != "none") p.optJSONObject("icon-wrapper")?.optString("backgroundColor")?.let { bg ->
                if (css(bg)[3] > 0) check(colorClose(t["iconWrapperColor"], bg), "$name $lbl icon wrapper colour ${t["iconWrapperColor"]} vs $bg") }
            p.optJSONObject("icon")?.let { ic -> box(at(rects["icon"]), rect(ic.optJSONObject("rect")), "$lbl icon")
                numbers(ic.optString("fontSize")).firstOrNull()?.let { near(t["glyphSize"] as? Double, it, "$lbl icon glyph size", .01) }
                check(colorClose(t["iconColor"], ic.optString("color")), "$name $lbl icon colour ${t["iconColor"]} vs ${ic.optString("color")}")
                near(t["fill"] as? Double, if (ic.optString("fontVariationSettings").contains("\"FILL\" 1")) 1.0 else 0.0, "$lbl icon fill", .01) }
            val lw = p.optJSONObject("label"); val shown = lw != null && lw.optString("display") != "none"
            check((rects["label"] != null) == shown, "$name $lbl label presence")
            if (shown && rects["label"] != null) {
                box(at(rects["label"]), rect(lw!!.optJSONObject("rect")), "$lbl label", 1.0)
                check(colorClose(t["labelColor"], lw.optString("color")), "$name $lbl label colour ${t["labelColor"]} vs ${lw.optString("color")}")
                near(t["labelOpacity"] as? Double, lw.optString("opacity").toDoubleOrNull(), "$lbl label opacity", .01)
                near(t["weight"] as? Double, lw.optString("fontWeight").toDoubleOrNull(), "$lbl label weight", .5)
                near(t["labelSize"] as? Double, numbers(lw.optString("fontSize")).firstOrNull(), "$lbl label size", .01)
                near(t["labelLine"] as? Double, numbers(lw.optString("lineHeight")).firstOrNull(), "$lbl label line height", .01)
                near(t["labelTracking"] as? Double, numbers(lw.optString("letterSpacing")).firstOrNull() ?: 0.0, "$lbl label letter spacing", .01)
            }
            val bw = p.optJSONObject("badge")
            check((rects["badge"] != null) == (bw != null), "$name $lbl badge presence")
            if (bw != null && rects["badge"] != null) {
                box(at(rects["badge"]), rect(bw.optJSONObject("rect")), "$lbl badge", 1.0)
                check(colorClose(t["badgeColor"], bw.optString("backgroundColor")), "$name $lbl badge colour")
                if ((rect(bw.optJSONObject("rect"))?.get(3) ?: 0.0) > 8) check(t["badge"] == bw.optString("text"), "$name $lbl badge text ${t["badge"]} vs ${bw.optString("text")}")
            }
        }
        // Paint: every flat CSS pixel of the rail (the modal: its overlay box, inside the shot's clip); stand-ins masked.
        val clip = c.getJSONObject("clip")
        val area = (if (modal) rect(parts.optJSONObject("scrim")?.optJSONObject("rect")) else null) ?: host
        val x0 = maxOf(area[0], clip.getDouble("x")); val y0 = maxOf(area[1], clip.getDouble("y"))
        val x1 = min(area[0] + area[2], clip.getDouble("x") + clip.getDouble("width")); val y1 = min(area[1] + area[3], clip.getDouble("y") + clip.getDouble("height"))
        val sub = JSONObject().put("x", clip.getInt("x")).put("y", clip.getInt("y")).put("width", clip.getInt("width")).put("height", clip.getInt("height"))
        val web = CardWeb.webGrid("$file/$name.png", sub)
        val shot = compose.onRoot().captureToImage().toPixelMap()
        val nat = CardWeb.nativeGrid(shot, clip.getInt("x"), clip.getInt("y"), clip.getInt("width"), clip.getInt("height"))
        val screen = shot.width / scale
        // Styled cases mask the stand-ins themselves (the brand symbol where the rail placed it, the avatar, the name), not the styled boxes.
        val masks = (if (styled) listOfNotNull(at(rail["logoMark"]), rect(parts.optJSONObject("footer-leading")?.optJSONObject("rect")), rect(parts.optJSONObject("footer-content")?.optJSONObject("rect")))
            else listOf("logo", "logo-contracted", "logo-expanded", "footer-leading", "footer-content").mapNotNull { k -> rect(parts.optJSONObject(k)?.optJSONObject("rect")) }).filter { it[2] > 0 }
            .map { Rect((it[0] - 2).toFloat(), (it[1] - 2).toFloat(), (it[0] + it[2] + 2).toFloat(), (it[1] + it[3] + 2).toFloat()) } +
            listOf(Rect(0f, 0f, 4000f, y0.toFloat()), Rect(0f, y1.toFloat(), 4000f, 4000f), Rect(0f, 0f, x0.toFloat(), 4000f), Rect(x1.toFloat(), 0f, 4000f, 4000f),
                Rect(screen - 3f, 0f, 4000f, 4000f)) +   // beyond the emulator's screen
            // A full-height rail fills Chrome's 900 px viewport: the shot holds no page below it (black), the native page box ends there too.
            (viewport?.let { v -> listOf(Rect(0f, v.height, 4000f, 4000f)) } ?: emptyList())
        val res = CardWeb.compare(web, nat, masks)
        val pixelsOk = res.getInt("compared") > 0 && res.getInt("over6").toDouble() / maxOf(res.getInt("compared"), 1) <= .005 && res.getDouble("mean") <= 1.0
        check(pixelsOk, "$name flat pixels $res")
        // A failed paint case leaves its native capture beside the evidence (rail-<case>.png) for the review.
        if (!pixelsOk) runCatching {
            val dir = java.io.File(androidx.test.platform.app.InstrumentationRegistry.getInstrumentation().targetContext.getExternalFilesDir(null), "accordion").apply { mkdirs() }
            java.io.FileOutputStream(java.io.File(dir, "rail-$name.png")).use { compose.onRoot().captureToImage().asAndroidBitmap().compress(android.graphics.Bitmap.CompressFormat.PNG, 100, it) }
        }
        report.put(res.put("case", name))
    }
}
