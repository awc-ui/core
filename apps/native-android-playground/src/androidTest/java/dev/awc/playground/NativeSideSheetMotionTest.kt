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
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.layout.boundsInRoot
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import dev.awc.nativeui.*
import dev.awc.playground.ModalWeb.objects
import androidx.compose.ui.layout.Layout
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min

/**
 * md-side-sheet motion, events, focus, methods and the variant switch against Chrome trusted-input runs (side-sheet
 * native-motion.html: 17 runs plus 2 reduced-motion runs). Each step is replayed at Chrome's step time on the test frame
 * clock (real mouse input, window-level key events); every frame's scrim/container opacity and translateX are compared
 * with Chrome's per-frame samples (±2 frames, monotone envelope across gaps > 34 ms); whenClosed() timing too.
 */
@OptIn(ExperimentalTestApi::class)
class NativeSideSheetMotionTest {
    @get:Rule val compose = createComposeRule()
    private var run by mutableStateOf(JSONObject("{\"name\":\"init\",\"vp\":[800,600],\"props\":{},\"theme\":\"light\",\"dir\":\"ltr\"}"))
    private var reduced by mutableStateOf(false); private var epoch by mutableIntStateOf(0)
    private val collector = AWCInspectionCollector(); private var inspection: AWCModalInspection? = null
    private var controller = AWCSideSheetController()
    private var variant by mutableStateOf<String?>(null)
    private var scope: kotlinx.coroutines.CoroutineScope? = null
    private val events = mutableListOf<Pair<String, Long>>()
    private val rects = mutableMapOf<String, Rect>(); private val focus = mutableMapOf<String, Boolean>()
    private var checks = 0; private val failures = mutableListOf<String>(); private val report = JSONArray(); private val debug = JSONArray()
    private fun check(ok: Boolean, label: String) { checks++; if (!ok) failures += label }
    @Composable private fun Tracked(name: String, content: @Composable () -> Unit) =
        Box(Modifier.onGloballyPositioned { rects[name] = it.boundsInRoot() }.onFocusChanged { focus[name] = it.hasFocus }) { content() }
    private fun content() { compose.setContent { CompositionLocalProvider(LocalDensity provides Density(1f, 1f)) {
        val r = run; val e = epoch; scope = rememberCoroutineScope()
        val vp = r.getJSONArray("vp")
        AWCTheme(r.optString("theme") == "dark") { AWCAccessibilityAppearanceScope(reducedMotion = reduced) { key(e) {
            Box(Modifier.requiredSize(vp.getInt(0).dp, vp.getInt(1).dp)) { AWCModalScope(Modifier.fillMaxSize(), insets = WindowInsets(0.dp)) {
                CompositionLocalProvider(LocalLayoutDirection provides if (r.optString("dir") == "rtl") LayoutDirection.Rtl else LayoutDirection.Ltr) {
                    val props = mutableMapOf<String, AWCValue>("headline" to "Filters", "id" to "dut")
                    r.optJSONObject("props")?.let { p -> p.keys().forEach { k -> props[k] = p.get(k) } }
                    val initialModal = props["variant"] == "modal"
                    variant?.let { props["variant"] = it }
                    val slots = mutableMapOf<String, @Composable () -> Unit>("" to { Box(Modifier.fillMaxWidth().height(120.dp)) { Text("Sheet content") } })
                    if (r.optBoolean("actions")) slots["actions"] = {
                        Tracked("save") { AWCComponent("md-button", mapOf("variant" to "filled", "label" to "Save")) }
                        Tracked("cancel") { AWCComponent("md-button", mapOf("variant" to "outlined", "label" to "Cancel")) } }
                    val main = @Composable { Box(Modifier.fillMaxSize()) {
                        Box(Modifier.absoluteOffset(16.dp, 64.dp).size(200.dp, 120.dp).background(MaterialTheme.colorScheme.primaryContainer))
                        Box(Modifier.absoluteOffset(16.dp, 16.dp)) { Tracked("opener") {
                            AWCComponent("md-button", mapOf("variant" to "text", "label" to "Open"), onEvent = { n, _ -> if (n == "mdClick") controller.show() }) } }
                        Box(Modifier.absoluteOffset(16.dp, 200.dp)) { Tracked("after") { AWCComponent("md-button", mapOf("variant" to "text", "label" to "After")) } }
                    } }
                    val sheet = @Composable {
                        AWCSideSheetControllerScope(controller) { AWCInspectionScope(collector) { AWCModalInspectionScope({ _, i -> if (i.values["frameMillis"] != null || variant == "standard" || !initialModal) inspection = i }) {
                            AWCSlotsScope(AWCSlotRegistry(slots)) {
                                AWCComponent("md-side-sheet", props, onEvent = { n, _ -> if (n.startsWith("md")) events += n to compose.mainClock.currentTime })
                            }
                        } } }
                    }
                    Box(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.surface)) {
                        // The oracle appends a modal sheet inside #main and a standard one beside #main in the flex page.
                        if (initialModal) Box(Modifier.fillMaxSize()) { main(); sheet() }
                        else Layout(content = { main(); sheet() }, modifier = Modifier.fillMaxSize()) { ms, c ->
                            val right = (props["side"] != "start") != (r.optString("dir") == "rtl")
                            val s = ms.getOrNull(1)?.measure(androidx.compose.ui.unit.Constraints(0, c.maxWidth, c.maxHeight, c.maxHeight))
                            val sw = s?.width ?: 0; val mw = max(0, c.maxWidth - sw)
                            val m = ms[0].measure(androidx.compose.ui.unit.Constraints.fixed(mw, c.maxHeight))
                            layout(c.maxWidth, c.maxHeight) { m.place(if (right) 0 else sw, 0); s?.place(if (right) mw else 0, 0) }
                        }
                    }
                }
            } }
        } } }
    } } }

    @Test fun sideSheetMotionMatchesChrome() {
        content()
        for ((file, red) in listOf("SideSheetWebMotion.json" to false, "SideSheetWebMotionReduced.json" to true))
            for (r in ModalWeb.document(file).getJSONArray("runs").objects()) runCase(r, red)
        ModalWeb.log("side-sheet-motion", JSONObject().put("checks", checks).put("failures", failures.size).put("failureList", JSONArray(failures.take(400))).put("report", report).put("debug", debug))
        assertTrue("${failures.size} of $checks failed:\n" + failures.take(60).joinToString("\n"), failures.isEmpty())
    }
    private fun node(name: String) = collector.snapshot().nodes.firstOrNull { it.name == name }?.bounds
    private fun center(name: String): Offset? = rects[name]?.center ?: node(name)?.let { Offset((it.x + it.width / 2).toFloat(), (it.y + it.height / 2).toFloat()) }
    private fun mouse(block: MouseInjectionScope.() -> Unit) = compose.onRoot().performMouseInput(block)
    private fun click(p: Offset) = mouse { moveTo(p, 0); press(); release() }
    private fun focused(): String {
        for (k in listOf("opener", "after", "save", "cancel")) if (focus[k] == true) return k
        return inspection?.values?.get("focus") as? String ?: ""
    }
    private fun expected(path: List<String>, text: String): String? {
        val leaf = path.lastOrNull() ?: return null
        if (leaf == "body") return ""
        if ("#opener" in leaf) return "opener"
        if ("#after" in leaf) return "after"
        if (leaf.startsWith("md-icon-button")) return if (text == "Back") "back-button" else "close-button"
        if ("[slot=actions]" in leaf) return text.lowercase()
        if ("[part=container]" in leaf || leaf.startsWith("md-side-sheet")) return "container"
        return null
    }
    private fun runCase(r: JSONObject, red: Boolean) {
        val name = (if (red) "reduced/" else "") + r.getString("name")
        val vp = r.getJSONArray("vp")
        compose.mainClock.autoAdvance = true
        mouse { moveTo(Offset(vp.getDouble(0).toFloat() - 2, vp.getDouble(1).toFloat() - 2), 0) }
        controller = AWCSideSheetController(); variant = null
        events.clear(); rects.clear(); focus.clear(); inspection = null; collector.clear(); reduced = red; run = r; epoch++
        compose.waitForIdle()
        compose.mainClock.autoAdvance = false; compose.mainClock.advanceTimeBy(200); compose.waitForIdle()
        val phases = r.getJSONArray("phases").objects()
        val webT0 = phases[0].getDouble("t")
        val webEventTimes = r.getJSONArray("events").objects().map { it.getDouble("t") }
        val stepWeb = phases.indices.map { i -> val s = phases[i].getDouble("t"); val e = if (i + 1 < phases.size) phases[i + 1].getDouble("t") else Double.MAX_VALUE
            webEventTimes.filter { it >= s && it < e }.minOrNull() ?: s }
        val t0 = compose.mainClock.currentTime
        fun elapsed() = (compose.mainClock.currentTime - t0).toDouble()
        val stepTimes = mutableMapOf<Int, Double>(); val focusAtEnd = mutableMapOf<Int, String>(); val methods = mutableListOf<Triple<String, Double, Double>>()
        data class Sample(val t: Double, val v: Map<String, Double?>)
        val samples = mutableListOf<Sample>()
        var drag = Offset.Zero; var dy = 0f
        var next = 1
        val end = phases.last().getDouble("t") - webT0 + 560
        while (elapsed() < end) {
            while (next < phases.size && elapsed() >= stepWeb[next] - webT0) {
                focusAtEnd[next - 1] = focused()
                val label = phases[next].getString("label"); val step = label.substringAfter('-')
                stepTimes[next] = elapsed()
                when (step) {
                    "open" -> center("opener")?.let(::click)
                    "escape" -> ModalWeb.key(KeyEvent.KEYCODE_ESCAPE)
                    "tab" -> ModalWeb.key(KeyEvent.KEYCODE_TAB)
                    "shifttab" -> ModalWeb.key(KeyEvent.KEYCODE_TAB, shift = true)
                    "scrim" -> { val cx = node("container")?.let { it.x + it.width / 2 } ?: 0.0; click(if (cx > vp.getDouble(0) / 2) Offset(12f, 12f) else Offset(vp.getDouble(0).toFloat() - 12, 12f)) }
                    "close" -> center("close")?.let(::click)
                    "back" -> center("back")?.let(::click)
                    "show" -> { val c = elapsed(); controller.show(); methods += Triple("show", c, c) }
                    "hide" -> { val c = elapsed(); val ctl = controller; ctl.close(); scope?.launch { ctl.whenClosed(); methods += Triple("whenClosed", c, elapsed()) } }
                    "toStandard" -> variant = "standard"
                    "toModal" -> variant = "modal"
                    else -> check(false, "$name unknown step $step")
                }
                next++
            }
            compose.mainClock.advanceTimeByFrame(); compose.waitForIdle()
            val v = inspection?.values
            if (v != null && v["frameMillis"] != null) samples += Sample(((v["frameMillis"] as? Double) ?: 0.0) - t0, mapOf("opacity" to v["opacity"] as? Double, "translate" to v["translateX"] as? Double,
                "scrim" to v["scrim"] as? Double))
        }
        repeat(20) { compose.mainClock.advanceTimeByFrame(); compose.waitForIdle() }
        focusAtEnd[phases.size - 1] = focused()
        compose.mainClock.autoAdvance = true
        val web = r.getJSONArray("events").objects().map { it.getString("name") to it.getDouble("t") }
        check(events.map { it.first } == web.map { it.first }, "$name events ${events.map { it.first }} vs ${web.map { it.first }}")
        fun stepIndex(wt: Double): Int { var k = 0; phases.forEachIndexed { i, p -> if (p.getDouble("t") <= wt) k = i }; return k }
        for ((nv, wv) in events.zip(web)) {
            val k = stepIndex(wv.second); val ns = stepTimes[k] ?: continue
            val nativeDelay = nv.second - t0 - ns; val webDelay = wv.second - stepWeb[k]
            check(nativeDelay >= -1 && nativeDelay <= webDelay + 40, "$name ${nv.first} $nativeDelay ms after its step (Chrome $webDelay)")
        }
        phases.forEachIndexed { i, p ->
            val f = p.getJSONObject("focus"); val path = f.optJSONArray("path")?.let { a -> (0 until a.length()).map { a.getString(it) } } ?: emptyList()
            val want = expected(path, f.optString("text")); val got = focusAtEnd[i]
            if (want != null && got != null) check(got == want || (want == "" && got !in setOf("container", "close-button", "back-button", "opener", "after", "save", "cancel")), "$name focus after ${p.getString("label")}: $got vs ${path.lastOrNull()}")
        }
        val websamples = mutableListOf<Pair<Double, Map<String, Double>>>()
        for (p in phases) for (s in p.getJSONArray("samples").objects()) {
            val d = s.getJSONObject("md-side-sheet#dut"); val t = d.getDouble("t"); val v = mutableMapOf<String, Double>()
            // Only the modal shell is sampled (a standard container has no shell motion and is `display: none` closed).
            if (d.optJSONObject("host")?.optString("display") == "contents") {
                d.optJSONObject("container")?.let { c ->
                    if (c.has("opacity")) v["opacity"] = c.getDouble("opacity")
                    val tf = c.optString("transform"); val m = ModalWeb.numbers(tf)
                    if (m.size == 6) v["translate"] = m[4] else if (tf == "none") v["translate"] = 0.0
                }
                d.optJSONObject("scrim")?.let { if (it.has("opacity")) v["scrim"] = it.getDouble("opacity") }
            }
            websamples += t to v
        }
        websamples.sortBy { it.first }
        fun webTime(native: Double): Double {
            val best = stepTimes.entries.filter { it.value <= native }.maxByOrNull { it.value } ?: return webT0 + native
            return stepWeb[best.key] + (native - best.value)
        }
        fun envelope(key: String, t: Double): Pair<Double, Double>? {
            val after = websamples.indexOfFirst { it.first >= t }
            if (after < 0) return websamples.lastOrNull()?.second?.get(key)?.let { it to it }
            if (after == 0) return websamples[0].second[key]?.let { it to it }
            val a = websamples[after - 1]; val b = websamples[after]
            val va = a.second[key]; val vb = b.second[key]
            if (va == null || vb == null) return (va ?: vb)?.let { it to it }
            if (b.first - a.first > 34) return min(va, vb) to max(va, vb)
            val x = (t - a.first) / max(1e-9, b.first - a.first); val v = va + (vb - va) * x
            return v to v
        }
        var compared = 0
        for (s in samples) for ((key, tol) in listOf("opacity" to .01, "translate" to .6, "scrim" to .01)) {
            val v = s.v[key] ?: continue
            var lo = Double.POSITIVE_INFINITY; var hi = Double.NEGATIVE_INFINITY; var x = s.t - 34
            while (x <= s.t + 40) { envelope(key, webTime(x))?.let { lo = min(lo, it.first); hi = max(hi, it.second) }; x += 2 }
            if (!lo.isFinite()) continue
            check(v >= lo - tol && v <= hi + tol, "$name $key $v at web ${webTime(s.t)} within Chrome [$lo,$hi]"); compared++
        }
        val modal = r.getJSONObject("props").optString("variant") == "modal"
        if (modal) check(compared > 50, "$name rendered values compared ($compared)")
        for (a in r.getJSONArray("anims").objects()) if (a.getString("target") in setOf("container", "scrim"))
            check(abs(a.getDouble("duration") - (if (red) 0.0 else 300.0)) < .5 && a.getString("easing") == "cubic-bezier(0.2, 0, 0, 1)", "$name ${a.getString("target")} ${a.optString("property")} timing ${a.getDouble("duration")} ${a.getString("easing")}")
        if (red || !modal) check(r.getJSONArray("anims").objects().none { it.getString("target") in setOf("container", "scrim") }, "$name no shell transitions")
        r.optJSONArray("methods")?.objects()?.filter { it.getString("method") == "whenClosed" }?.forEachIndexed { i, m ->
            val webDelay = m.getDouble("resolved") - m.getDouble("called")
            val native = methods.filter { it.first == "whenClosed" }.getOrNull(i)
            if (native == null) check(false, "$name whenClosed resolved") else check(abs(native.third - native.second - webDelay) <= 45, "$name whenClosed after ${native.third - native.second} ms (Chrome $webDelay)")
        }
        report.put(JSONObject().put("run", name).put("samples", samples.size).put("compared", compared).put("events", JSONArray(events.map { it.first })))
    }
}
