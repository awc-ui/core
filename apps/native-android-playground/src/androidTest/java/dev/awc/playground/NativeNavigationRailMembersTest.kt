package dev.awc.playground

import android.view.KeyEvent
import androidx.compose.foundation.background
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toPixelMap
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import dev.awc.nativeui.*
import dev.awc.nativeui.generated.AWCGeneratedTokens
import dev.awc.playground.CardWeb.objects
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import kotlin.math.abs

/**
 * 9-14 (S7-4-01): the four md-navigation-rail members no suite exercised before the s7-4 audit, on Compose (the SwiftUI twin is
 * NativeNavigationRailMembersIntegration).
 *  toggleLabel            the accessibility label of the expand toggle (default "Toggle navigation");
 *  disableFocusManagement the focus order: with the flag ArrowDown leaves focus where it is, without it focus moves to the next destination;
 *  mdSubmenuToggle        the host's event log: name, target and `open` payload when a destination's submenu opens and closes;
 *  overflowIcon           paint of the overflow trigger against Mac Chrome 153 (rail-web-members.json, the same fixture as the SwiftUI
 *                         suite) with a negative control (the default icon differs from the star).
 */
@OptIn(ExperimentalTestApi::class)
class NativeNavigationRailMembersTest {
    @get:Rule val compose = createComposeRule()
    private var nodes by mutableStateOf<List<JSONObject>>(emptyList())
    private var epoch by mutableIntStateOf(0)
    private var box by mutableStateOf(420.0 to 560.0)
    private val scale = 2f
    private val probe = AWCNavigationRailProbe()
    private val before = FocusRequester()
    private class Event(val name: String, val target: String, val detail: Any?)
    private val events = mutableListOf<Event>()
    private lateinit var view: android.view.View
    private var screenW = 540.0
    private var checks = 0; private val failures = mutableListOf<String>()
    private fun check(ok: Boolean, label: String) { checks++; if (!ok) failures += label }
    private fun hex(v: String?) = Color(android.graphics.Color.parseColor(v!!))
    private fun props(o: JSONObject): Map<String, Any?> = buildMap { val p = o.optJSONObject("properties") ?: JSONObject()
        for (k in p.keys()) if (k != "_hooks" && k != "_box") put(k, p.get(k)); put("id", o.getString("id")) }
    @Composable private fun Node(o: JSONObject) {
        val id = o.getString("id"); val kids = o.optJSONArray("children")?.objects() ?: emptyList()
        when (o.getString("tag")) {
            "#text" -> AWCSlotText(o.getJSONObject("properties").getString("text"))
            else -> AWCComponent(o.getString("tag"), props(o), onEvent = { n, d -> events += Event(n, id, d) }) { slot ->
                for (k in kids) { if (k.optString("slot").ifEmpty { "" } != slot) continue; key(k.getString("id")) { Node(k) } }
            }
        }
    }
    private fun content() { compose.setContent { CompositionLocalProvider(LocalDensity provides Density(scale, 1f)) {
        view = LocalView.current
        val t = AWCGeneratedTokens.light
        AWCTheme(false) { Box(Modifier.fillMaxSize().background(hex(t["--md-sys-color-surface-container-low"]))) { key(epoch) {
            CompositionLocalProvider(LocalAWCNavigationRailProbe provides probe, LocalAWCNavigationRailReducedMotion provides true) {
                Box(Modifier.size(1.dp).focusRequester(before).focusable())
                Box(Modifier.wrapContentSize(Alignment.TopStart, unbounded = true).requiredSize(1200.dp, 900.dp)) {
                    Box(Modifier.absoluteOffset(24.dp, 24.dp).requiredSize(box.first.dp, box.second.dp)) {
                        CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) { Column(Modifier.fillMaxWidth()) { for (n in nodes) key(n.getString("id")) { Node(n) } } }
                    }
                }
            }
        } } }
    } } }
    private fun settle(ms: Double = 400.0) { var t = 0.0; while (t < ms) { compose.mainClock.advanceTimeByFrame(); t += 16.0 }; compose.waitForIdle() }
    private fun sendKey(code: Int) = compose.runOnIdle { view.dispatchKeyEvent(KeyEvent(0, 0, KeyEvent.ACTION_DOWN, code, 0, 0)); view.dispatchKeyEvent(KeyEvent(0, 0, KeyEvent.ACTION_UP, code, 0, 0)) }
    private fun px(x: Double, y: Double) = Offset((x * scale).toFloat(), (y * scale).toFloat())
    private fun tab(id: String, label: String, icon: String, kids: List<JSONObject> = emptyList()) = JSONObject().put("id", id).put("tag", "md-navigation-rail-tab")
        .put("properties", JSONObject().put("label", label).put("icon", icon).put("value", id)).put("children", JSONArray(kids))
    private fun rail(extra: Map<String, Any> = emptyMap(), tabs: List<JSONObject>? = null): List<JSONObject> {
        val p = JSONObject().put("label", "Mail").put("activeIndex", 0.0); for ((k, v) in extra) p.put(k, v)
        return listOf(JSONObject().put("id", "r").put("tag", "md-navigation-rail").put("properties", p)
            .put("children", JSONArray(tabs ?: listOf(tab("t0", "Inbox", "inbox"), tab("t1", "Outbox", "send"), tab("t2", "Trash", "delete")))))
    }
    private fun show(n: List<JSONObject>, w: Double = 420.0, h: Double = 560.0) {
        compose.mainClock.autoAdvance = false
        nodes = n; box = w to h; events.clear(); epoch++; settle(700.0)
    }
    @Suppress("UNCHECKED_CAST") private fun tabCentre(id: String): Offset? = compose.runOnIdle {
        val r = probe.rail; val m = probe.tabs[id] ?: return@runOnIdle null
        val t = (m["rects"] as? Map<String, Any?>)?.get("tab") as? List<Double> ?: return@runOnIdle null
        val o = (r["origin"] as? List<Double>) ?: listOf(24.0, 24.0)
        px(o[0] + t[0] + t[2] / 2, o[1] + t[1] + t[3] / 2) }
    private fun toggleCount(label: String) = compose.onAllNodes(hasContentDescription(label)).fetchSemanticsNodes().size
    @Test fun members() {
        content()
        val only = androidx.test.platform.app.InstrumentationRegistry.getArguments().getString("membersOnly")
        if (only == null || only == "toggleLabel") toggleLabel()
        if (only == null || only == "focus") focus()
        if (only == null || only == "submenu") submenu()
        if (only == null || only == "icon") icon()
        AccordionEvidence.log("rail-members", JSONObject().put("checks", checks).put("failures", failures.size).put("failureList", JSONArray(failures.take(200))))
        android.util.Log.i("AWCRail", "rail-members ${checks - failures.size}/$checks")
        assertTrue("${failures.size} of $checks failed:\n" + failures.take(60).joinToString("\n"), failures.isEmpty())
    }
    private fun toggleLabel() {
        show(rail(mapOf("expandable" to true)))
        check(toggleCount("Toggle navigation") >= 1, "toggleLabel default: the toggle's label is 'Toggle navigation'")
        show(rail(mapOf("expandable" to true, "toggleLabel" to "Open the mail menu")))
        check(toggleCount("Open the mail menu") >= 1, "toggleLabel custom: the toggle's label is 'Open the mail menu'")
        check(toggleCount("Toggle navigation") == 0, "toggleLabel custom: the default label is gone")
        show(rail(mapOf("expandable" to true, "toggleLabel" to "Zona de navigare")))
        check(toggleCount("Zona de navigare") >= 1, "toggleLabel second value: the toggle's label is 'Zona de navigare'")
    }
    private fun focused() = listOf("t0", "t1", "t2").map { probe.tabs[it]?.get("focused") == true }
    private fun stops() = listOf("t0", "t1", "t2").map { probe.tabs[it]?.get("tabStop") == true }
    private fun focus() {
        for (disabled in listOf(false, true)) {
            val name = "disableFocusManagement=$disabled"
            show(rail(if (disabled) mapOf("disableFocusManagement" to true) else emptyMap()))
            check(compose.runOnIdle { stops() } == listOf(true, false, false), "$name: the active destination is the tab stop before any key ${compose.runOnIdle { stops() }}")
            compose.runOnIdle { runCatching { before.requestFocus() } }; sendKey(KeyEvent.KEYCODE_TAB); settle(200.0)
            val f0 = compose.runOnIdle { focused() }
            check(f0 == listOf(true, false, false), "$name: Tab reaches the first destination $f0")
            sendKey(KeyEvent.KEYCODE_DPAD_DOWN); settle(200.0)
            val f = compose.runOnIdle { focused() }; val s = compose.runOnIdle { stops() }
            if (disabled) { check(f == listOf(true, false, false), "$name: ArrowDown does not move focus $f"); check(s == listOf(true, false, false), "$name: tab stop stays on the active destination $s") }
            else { check(f == listOf(false, true, false), "$name: ArrowDown moves focus to the next destination $f"); check(s == listOf(false, true, false), "$name: the roving tab stop follows focus $s") }
            android.util.Log.i("AWCRail", "$name: after ArrowDown focused $f stops $s")
        }
    }
    private fun submenu() {
        val menu = JSONObject().put("id", "mn").put("tag", "md-menu").put("properties", JSONObject().put("slot", "submenu")).put("slot", "submenu").put("children", JSONArray(listOf(
            JSONObject().put("id", "mi0").put("tag", "md-menu-item").put("properties", JSONObject().put("headline", "Work").put("selected", true)).put("children", JSONArray()),
            JSONObject().put("id", "mi1").put("tag", "md-menu-item").put("properties", JSONObject().put("headline", "Personal")).put("children", JSONArray()))))
        show(rail(mapOf("variant" to "expanded"), listOf(tab("t0", "Inbox", "inbox"), tab("t1", "Folders", "folder", listOf(menu)))))
        val c = tabCentre("t1"); check(c != null, "mdSubmenuToggle: the dropdown destination is measured")
        if (c != null) { compose.onRoot().performMouseInput { moveTo(c); press(); release() }; settle(300.0) }
        val opened = events.filter { it.name == "mdSubmenuToggle" }
        check(opened.size == 1 && opened[0].target == "t1" && (opened[0].detail as? Map<*, *>)?.get("open") == true, "mdSubmenuToggle open: ${events.map { it.name + "@" + it.target + "=" + it.detail }}")
        events.clear()
        compose.onNodeWithText("Personal").performClick(); settle(400.0)
        val closed = events.filter { it.name == "mdSubmenuToggle" }
        check(closed.size == 1 && closed[0].target == "t1" && (closed[0].detail as? Map<*, *>)?.get("open") == false, "mdSubmenuToggle close (dismiss): ${events.map { it.name + "@" + it.target + "=" + it.detail }}")
        android.util.Log.i("AWCRail", "mdSubmenuToggle open ${opened.map { it.detail }} close ${closed.map { it.detail }}")
    }
    private fun diff(a: CardWeb.Grid, b: CardWeb.Grid, r: List<Double>): Triple<Double, Int, Int> {
        var sum = 0.0; var bad = 0; var n = 0
        for (py in r[1].toInt() until (r[1] + r[3]).toInt()) for (px in r[0].toInt() until (r[0] + r[2]).toInt()) {
            val x = a.at(px, py); val y = b.at(px, py); val d = (0..2).maxOf { abs(x[it] - y[it]) }; sum += d; n++; if (d > 32) bad++ }
        return Triple(sum / maxOf(n, 1), bad, n)
    }
    private fun icon() {
        val doc = CardWeb.document("rail-web-members.json")
        for (c in doc.getJSONArray("cases").objects()) {
            val name = c.getString("name"); val ns = JSONArray(c.getString("nodesJSON")).objects()
            check(c.getString("nodesJSON").contains("\"overflowIcon\": \"star\""), "$name: the oracle case carries overflowIcon=star")
            val horizontal = ns[0].getJSONObject("properties").optString("orientation") == "horizontal"
            val clip = c.getJSONObject("clip"); val wr = c.getJSONObject("parts").getJSONObject("overflow-trigger").getJSONObject("rect")
            val r = listOf(wr.getDouble("x") + (wr.getDouble("width") - 40.0) / 2, wr.getDouble("y"), 40.0, wr.getDouble("height") * 0.6)  // the icon band (40 wide, upper 60% of the trigger): the label line below and the empty bar around the glyph are not the member under test
            val web = CardWeb.webGrid("rail-web-members/$name.png", clip)
            fun nat(withIcon: Boolean): CardWeb.Grid {
                val copy = ns.map { JSONObject(it.toString()) }
                if (!withIcon) copy[0].getJSONObject("properties").remove("overflowIcon")
                show(copy, c.optDouble("width", 420.0), if (horizontal) 120.0 else 560.0)
                val shot = compose.onRoot().captureToImage().toPixelMap()
                runCatching { val dir = java.io.File(androidx.test.platform.app.InstrumentationRegistry.getInstrumentation().targetContext.getExternalFilesDir(null), "accordion").apply { mkdirs() }
                    java.io.FileOutputStream(java.io.File(dir, "members-$name-${if (withIcon) "star" else "default"}.png")).use { compose.onRoot().captureToImage().asAndroidBitmap().compress(android.graphics.Bitmap.CompressFormat.PNG, 100, it) } }
                screenW = shot.width / scale.toDouble()
                return CardWeb.nativeGrid(shot, clip.getInt("x"), clip.getInt("y"), clip.getInt("width"), clip.getInt("height"))
            }
            val star = nat(true); val def = nat(false)
            val rv = listOf(r[0], r[1], minOf(r[2], screenW - r[0]), r[3])  // the emulator is 540 dp wide: the bar's trigger is clipped there
            val hit = diff(web, star, rv); val ctl = diff(web, def, rv); val own = diff(star, def, rv)
            check(hit.third > 0 && hit.first <= 5.0 && hit.second.toDouble() / maxOf(hit.third, 1) <= 0.06, "$name: overflowIcon=star trigger pixels match Chrome (mean ${hit.first}, >32: ${hit.second}/${hit.third})")
            check(own.second > 0 && ctl.first >= 1.8 * hit.first, "$name: default icon differs from the star (mean vs Chrome ${ctl.first} against ${hit.first}; native star vs default >32: ${own.second})")
            android.util.Log.i("AWCRail", "$name: star mean ${hit.first} >32 ${hit.second}/${hit.third}; control mean ${ctl.first}")
        }
    }
}
