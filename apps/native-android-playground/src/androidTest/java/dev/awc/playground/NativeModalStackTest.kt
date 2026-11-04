package dev.awc.playground

import android.view.KeyEvent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.layout.LayoutCoordinates
import androidx.compose.ui.layout.boundsInRoot
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import dev.awc.nativeui.*
import dev.awc.playground.ModalWeb.objects
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

/**
 * Mixed modal ownership against Chrome (md-dialog/web-reference/modal-stack.html: 13 runs over Dialog, Bottom Sheet and
 * Side Sheet in both orders, the lower owner closing first, and a bottom-sheet drag cancelled when a dialog covers it).
 * Steps replay at Chrome's phase times on the test frame clock; checks: the event sequence with targets, the focus chain
 * after every phase, the final open state and the end-of-phase paint against Chrome's phase shots (paint order of the
 * two owners and their scrims).
 */
@OptIn(ExperimentalTestApi::class)
class NativeModalStackTest {
    @get:Rule val compose = createComposeRule()
    private var run by mutableStateOf(JSONObject("{\"name\":\"init\",\"a\":\"dialog\",\"b\":\"bottom\"}"))
    private var epoch by mutableIntStateOf(0)
    private val collector = AWCInspectionCollector()
    private val inspections = mutableMapOf<String, AWCModalInspection>()
    private val events = mutableListOf<String>()
    private val coords = mutableMapOf<String, LayoutCoordinates>(); private val focus = mutableMapOf<String, Boolean>()
    private var dialogs = mutableMapOf<String, AWCDialogController>(); private var bottoms = mutableMapOf<String, AWCBottomSheetController>()
    private var sides = mutableMapOf<String, AWCSideSheetController>()
    private var checks = 0; private val failures = mutableListOf<String>(); private val report = JSONArray()
    private fun check(ok: Boolean, label: String) { checks++; if (!ok) failures += label }
    @Composable private fun Tracked(name: String, content: @Composable () -> Unit) =
        Box(Modifier.onGloballyPositioned { coords[name] = it }.onFocusChanged { focus[name] = it.hasFocus }) { content() }
    private fun show(owner: String) { dialogs[owner]?.show(); bottoms[owner]?.show(); sides[owner]?.show() }
    private fun close(owner: String) { dialogs[owner]?.close(); bottoms[owner]?.close(); sides[owner]?.close() }
    private fun isOpen(owner: String) = dialogs[owner]?.isOpen ?: bottoms[owner]?.isOpen ?: sides[owner]?.isOpen ?: false
    @Composable private fun Modal(kind: String, owner: String, button: String, label: String, action: () -> Unit) {
        val slots = mutableMapOf<String, @Composable () -> Unit>("" to {
            Box(Modifier.fillMaxWidth().height(80.dp)) { Text("Body of $owner") }
            Tracked(button) { Box(Modifier.height(36.dp)) { AWCComponent("md-button", mapOf("variant" to "text", "label" to label), onEvent = { n, _ -> if (n == "mdClick") action() }) } }
        })
        val props = mutableMapOf<String, AWCValue>("headline" to owner, "id" to owner)
        val tag = when (kind) { "dialog" -> "md-dialog"; "bottom" -> "md-bottom-sheet"; else -> { props["variant"] = "modal"; "md-side-sheet" } }
        val body = @Composable { AWCSlotsScope(AWCSlotRegistry(slots)) { AWCComponent(tag, props, onEvent = { n, _ -> if (n.startsWith("md")) events += "$owner:$n" }) } }
        when (kind) {
            "dialog" -> AWCDialogControllerScope(dialogs.getOrPut(owner) { AWCDialogController() }) { body() }
            "bottom" -> AWCBottomSheetControllerScope(bottoms.getOrPut(owner) { AWCBottomSheetController() }) { body() }
            else -> AWCSideSheetControllerScope(sides.getOrPut(owner) { AWCSideSheetController() }) { body() }
        }
    }
    private fun content() { compose.setContent { CompositionLocalProvider(LocalDensity provides Density(1f, 1f)) {
        val r = run; val e = epoch
        AWCTheme(false) { AWCAccessibilityAppearanceScope(reducedMotion = false) { key(e) {
            Box(Modifier.requiredSize(800.dp, 600.dp)) { AWCModalScope(Modifier.fillMaxSize(), insets = WindowInsets(0.dp)) {
                Box(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.surface)) {
                    Box(Modifier.absoluteOffset(16.dp, 64.dp).size(200.dp, 120.dp).background(MaterialTheme.colorScheme.primaryContainer))
                    Box(Modifier.absoluteOffset(16.dp, 16.dp)) { Tracked("opener") {
                        AWCComponent("md-button", mapOf("variant" to "text", "label" to "Open"), onEvent = { n, _ -> if (n == "mdClick") show("A") }) } }
                    AWCInspectionScope(collector) { AWCModalInspectionScope({ id, i -> inspections[id] = i }) {
                        Modal(r.getString("a"), "A", "openB", "Open B") { show("B") }
                        Modal(r.getString("b"), "B", "inB", "Inside B") {}
                    } }
                }
            } }
        } } }
    } } }

    @Test fun modalStackMatchesChrome() {
        content()
        for (r in ModalWeb.document("ModalWebStack.json").getJSONArray("runs").objects()) runCase(r)
        ModalWeb.log("modal-stack", JSONObject().put("checks", checks).put("failures", failures.size).put("failureList", JSONArray(failures.take(400))).put("report", report))
        assertTrue("${failures.size} of $checks failed:\n" + failures.take(60).joinToString("\n"), failures.isEmpty())
    }
    private fun center(name: String): Offset? = coords[name]?.takeIf { it.isAttached }?.boundsInRoot()?.center
        ?: collector.snapshot().nodes.firstOrNull { it.name == name }?.bounds?.let { Offset((it.x + it.width / 2).toFloat(), (it.y + it.height / 2).toFloat()) }
    private fun mouse(block: MouseInjectionScope.() -> Unit) = compose.onRoot().performMouseInput(block)
    private fun click(p: Offset) = mouse { moveTo(p, 0); press(); release() }
    private fun focused(): String {
        for (k in listOf("opener", "openB", "inB")) if (focus[k] == true) return k
        for (o in listOf("B", "A")) (inspections[o]?.values?.get("focus") as? String)?.takeIf { it.isNotEmpty() }?.let { return "$o.$it" }
        return ""
    }
    private fun expected(path: List<String>): String? {
        val leaf = path.lastOrNull() ?: return null
        if (leaf == "body") return ""
        for (id in listOf("opener", "openB", "inB")) if (leaf == "button#$id") return id
        val owner = if (path.size > 1) path[path.size - 2].substringAfter('#') else ""
        if (leaf.startsWith("md-icon-button")) return "$owner.close-button"
        if ("[part=container]" in leaf) return "$owner.container"
        return null
    }
    private fun paint(name: String, label: String) {
        val image = compose.onRoot().captureToImage()
        val masks = mutableListOf(androidx.compose.ui.geometry.Rect(12f, 12f, 112f, 60f), androidx.compose.ui.geometry.Rect(12f, 196f, 112f, 244f))
        for (id in listOf("openB", "inB")) coords[id]?.takeIf { it.isAttached }?.boundsInRoot()?.let { masks += androidx.compose.ui.geometry.Rect(it.left - 6, it.top - 4, it.left + 614, it.top + 40) }
        val res = ModalWeb.compare(ModalWeb.webGrid("ModalWebStack/$name-$label.png", 800, 600), ModalWeb.nativeGrid(image, 800, 600)) { x, y -> masks.any { it.contains(Offset(x.toFloat(), y.toFloat())) } }
        check(ModalWeb.ok(res), "$name $label paint $res")
        if (!ModalWeb.ok(res)) ModalWeb.png("stack-$name-$label", image)
        report.put(res.put("case", "$name-$label"))
    }
    private fun runCase(r: JSONObject) {
        val name = r.getString("name")
        compose.mainClock.autoAdvance = true
        mouse { moveTo(Offset(798f, 598f), 0) }
        dialogs = mutableMapOf(); bottoms = mutableMapOf(); sides = mutableMapOf()
        events.clear(); coords.clear(); focus.clear(); inspections.clear(); collector.clear(); run = r; epoch++
        compose.waitForIdle()
        compose.mainClock.autoAdvance = false; compose.mainClock.advanceTimeBy(200); compose.waitForIdle()
        val phases = r.getJSONArray("phases").objects()
        val webT0 = phases[0].getDouble("t"); val t0 = compose.mainClock.currentTime
        fun elapsed() = (compose.mainClock.currentTime - t0).toDouble()
        val focusAtEnd = mutableMapOf<Int, String>()
        var next = 1; var drag = Offset.Zero
        fun endPhase(i: Int) { focusAtEnd[i] = focused(); if (i > 0) paint(name, phases[i].getString("label")) }
        val end = phases.last().getDouble("t") - webT0 + 520
        while (elapsed() < end) {
            while (next < phases.size && elapsed() >= phases[next].getDouble("t") - webT0) {
                endPhase(next - 1)
                when (val step = phases[next].getString("label").substringAfter('-')) {
                    "openA" -> center("opener")?.let(::click)
                    "openB" -> center("openB")?.let(::click)
                    "escape" -> ModalWeb.key(KeyEvent.KEYCODE_ESCAPE)
                    "closeLower" -> close("A")
                    "openBProgrammatic" -> show("B")
                    "pressHandle" -> center("drag-handle")?.let { p -> drag = p; mouse { moveTo(p, 0); press() } }
                    "moveHandle" -> mouse { moveTo(drag + Offset(0f, 50f), 0) }
                    "releaseHandle" -> mouse { moveTo(drag + Offset(0f, 50f), 0); release() }
                    else -> check(false, "$name unknown step $step")
                }
                next++
            }
            compose.mainClock.advanceTimeByFrame(); compose.waitForIdle()
        }
        endPhase(phases.size - 1)
        compose.mainClock.autoAdvance = true
        val web = r.getJSONArray("events").objects().map { it.getString("target").substringAfter('#') + ":" + it.getString("name") }
        check(events == web, "$name events $events vs $web")
        phases.forEachIndexed { i, p ->
            val path = p.getJSONObject("focus").optJSONArray("path")?.let { a -> (0 until a.length()).map { a.getString(it) } } ?: emptyList()
            val want = expected(path); val got = focusAtEnd[i]
            if (want != null && got != null) check(got == want || (want == "" && got !in setOf("opener", "openB", "inB") && '.' !in got), "$name focus after ${p.getString("label")}: $got vs ${path.takeLast(2)} restore=${inspections.values.mapNotNull { it.values["restore"] }} focus=$focus insp=${inspections.mapValues { it.value.values["focus"] }}")
        }
        val st = r.getJSONObject("openState")
        check(isOpen("A") == st.getBoolean("A") && isOpen("B") == st.getBoolean("B"), "$name final open state A=${isOpen("A")} B=${isOpen("B")}")
    }
}
