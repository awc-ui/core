package dev.awc.playground

import androidx.compose.foundation.background
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.*
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.isShiftPressed
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.text.TextRange
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import dev.awc.nativeui.*
import dev.awc.playground.CardWeb.objects
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import kotlin.math.abs
import kotlin.math.atan2
import kotlin.math.sqrt

/**
 * md-color-picker interaction against Chrome 153 (Mac capture of cp-states.html: 23 runs + the same 23 under reduced motion):
 * plate / hue / alpha drags with clamping and release outside (LTR, RTL), keyboard steps and endpoints, Tab order, hex and
 * channel typing with commit on Enter / Tab, presets (hover, press, click, re-click, keyboard), the popover lifecycle
 * (trigger, Escape, Enter / Space, outside press, show(), open, close()), disabled, controlled value / format / alpha.
 * Each phase fires Chrome's input at its recorded time on the test clock; checks: the md* event sequence and values, per-phase
 * end state (value, hex, invalid flag, channels, selected presets, open, focused part, preview colour, thumb centres) and, for
 * every Chrome sample, the presented motion (pop-in, preset springs, thumb press) within one frame of the sample's time.
 */
@OptIn(ExperimentalTestApi::class)
class NativeColorPickerInteractionTest {
    @get:Rule val compose = createComposeRule()
    private var run by mutableStateOf(JSONObject("{\"name\":\"init\",\"props\":{}}"))
    private var props by mutableStateOf<Map<String, Any?>>(emptyMap())
    private var reduced by mutableStateOf(false); private var epoch by mutableIntStateOf(0); private var dialogOpen by mutableStateOf(true)
    private val collector = AWCInspectionCollector(); private var picker: AWCColorPickerRuntime? = null
    private val events = mutableListOf<Pair<String, Map<*, *>>>()
    private val before = FocusRequester(); private var beforeFocused = false; private var afterFocused = false
    private var checks = 0; private val failures = mutableListOf<String>(); private val report = JSONArray()
    private fun check(ok: Boolean, label: String) { checks++; if (!ok) failures += label }
    private fun content() { compose.setContent { CompositionLocalProvider(LocalDensity provides Density(2f, 1f)) {
        val r = run; val rtl = r.optString("dir") == "rtl"
        val width = if (r.has("width") && !r.isNull("width")) r.getDouble("width") else 340.0
        AWCTheme(false) { AWCColorPickerReducedMotionScope(reduced) { Box(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.surface)) { key(epoch) {
            // The modal scope hosts cp-popover-in-dialog's md-dialog (Escape routing, focus restore) as the Laboratory does.
            AWCModalScope(Modifier.fillMaxSize(), insets = WindowInsets(0.dp)) { AWCColorPickerScope(Modifier.fillMaxSize()) {
                // The element before the picker; Shift+Tab from it goes to the picker's last stop (Chrome: body → last element).
                Box(Modifier.absoluteOffset(1000.dp, 10.dp).size(60.dp, 32.dp).focusRequester(before).onFocusChanged { beforeFocused = it.isFocused }
                    .onPreviewKeyEvent { e -> if (e.type == KeyEventType.KeyDown && e.key == Key.Tab && e.isShiftPressed) { val last = (picker?.box("preset-0")?.let { _ ->
                        (0 until 32).map { "preset-$it" }.lastOrNull { picker?.box(it) != null } } ?: "input-hex").removePrefix("input-"); picker?.focus(last) == true } else false }
                    .focusable())
                Box(Modifier.absoluteOffset(24.dp, 24.dp).width(width.dp)) {
                    CompositionLocalProvider(LocalLayoutDirection provides if (rtl) LayoutDirection.Rtl else LayoutDirection.Ltr) {
                        AWCColorPickerInspectionScope({ picker = it }) { AWCInspectionScope(collector) {
                            val pickerView: @Composable () -> Unit = {
                                AWCComponent("md-color-picker", props, onEvent = { n, v -> if (n.startsWith("md")) events += n to (v as? Map<*, *> ?: emptyMap<String, Any>())
                                        // A controlled host: the picker's own value / open follow its events (as the Web element's properties do).
                                        if (n == "mdInput" || n == "mdChange") (v as? Map<*, *>)?.get("value")?.let { props = props + ("value" to it) }
                                        if (n == "mdOpenChange") (v as? Map<*, *>)?.get("open")?.let { props = props + ("open" to it) } },
                                    content = { slot -> if (slot == "trigger") AWCComponent("md-button", mapOf("variant" to "tonal", "label" to "Colour")) })
                            }
                            // cp-popover-in-dialog: the picker inside an open md-dialog (Escape closes the picker first, then the dialog).
                            if (r.optBoolean("inDialog")) AWCComponent("md-dialog", mapOf("open" to dialogOpen, "headline" to "Theme"),
                                onEvent = { n, _ -> if (n == "mdClose") dialogOpen = false }, content = { slot -> if (slot == "") pickerView() })
                            else Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.TopStart) { pickerView() }
                        } }
                    }
                }
                // Past the picker's last stop: Chrome leaves the page (focus on body), so this stop reports "body".
                Box(Modifier.absoluteOffset(10.dp, 880.dp).size(20.dp, 20.dp).onFocusChanged { afterFocused = it.isFocused }
                    .onPreviewKeyEvent { e -> e.key in setOf(Key.DirectionLeft, Key.DirectionRight, Key.DirectionUp, Key.DirectionDown) }.focusable())
            } }
        } } } }
    } } }
    @Test fun colorPickerInteractionMatchesChrome() {
        content()
        for ((file, red) in listOf("ColorPickerWebStates.json" to false, "ColorPickerWebStatesReduced.json" to true))
            for (r in CardWeb.document(file).getJSONArray("runs").objects()) runCase(r, red)
        AccordionEvidence.log("colorpicker-states", JSONObject().put("checks", checks).put("failures", failures.size).put("failureList", JSONArray(failures.take(400))).put("report", report))
        assertTrue("${failures.size} of $checks failed:\n" + failures.take(80).joinToString("\n"), failures.isEmpty())
    }
    /** Native latency (ms) from an input to the first frame of the transition it causes (state: next-frame recomposition, then
     *  the animation's first frame; the pop-in likewise). */
    private fun latency(kind: String): Double = if (kind == "pop") 32.0 else 32.0
    private class Frame(val t: Double, val pop: Float, val presets: Map<Int, Pair<Float, Float>>, val thumbs: Map<String, Float>)
    private fun matrix(t: String?): DoubleArray { if (t == null || !t.startsWith("matrix(")) return doubleArrayOf(1.0, 0.0, 0.0, 1.0, 0.0, 0.0)
        val v = t.removePrefix("matrix(").removeSuffix(")").split(",").map { it.trim().toDouble() }; return v.toDoubleArray() }
    private fun rgba(css: String): List<Double> { val v = css.substringAfter("(").substringBefore(")").split(",").map { it.trim().toDouble() }; return listOf(v[0], v[1], v[2], v.getOrElse(3) { 1.0 }) }

    private fun runCase(r: JSONObject, red: Boolean) {
        val name = (if (red) "reduced/" else "") + r.getString("name")
        android.util.Log.i("AWCAccordion", "colorpicker-states run $name")
        compose.mainClock.autoAdvance = true
        compose.onAllNodes(isRoot()).onFirst().performMouseInput { moveTo(Offset(1000f, 1300f), 0) }
        events.clear(); picker = null; collector.clear(); reduced = red; run = r; dialogOpen = true
        @Suppress("UNCHECKED_CAST") val p0 = (NativeColorPickerParityTest.json(r.optJSONObject("props") ?: JSONObject()) as Map<String, Any?>)
        props = p0; epoch++; compose.waitForIdle()
        compose.mainClock.autoAdvance = false; compose.mainClock.advanceTimeBy(100); compose.waitForIdle(); events.clear()
        val nodes = { collector.snapshot().nodes }
        fun m(n: String) = nodes().firstOrNull { it.name == n }?.bounds
        fun at(part: String, fx: Double, fy: Double): Offset { val b = m(part) ?: return Offset.Zero
            // Chrome's mouse coordinates arrive in 1/16 CSS px steps (fits every Chrome drag event of the oracle; exact,
            // 1/64 and whole-px coordinates do not), so the same points are sent here.
            fun q(v: Double) = Math.floor(v * 16 + .5) / 16
            return Offset((q(b.x + b.width * fx) * 2).toFloat(), (q(b.y + b.height * fy) * 2).toFloat()) }
        val blank = Offset(8f, 1280f)
        // The page is the first root; an md-dialog opens its own window (keys go to the topmost root, which holds focus).
        fun mouse(block: MouseInjectionScope.() -> Unit) { compose.onAllNodes(isRoot()).onFirst().performMouseInput(block) }
        // A key press as Chrome sends it (keydown and keyup together): the default 50 ms press duration would advance the
        // test clock past three frames that are then never sampled.
        fun key(k: Key, shift: Boolean = false) { compose.onAllNodes(isRoot()).onLast().performKeyInput { if (shift) keyDown(Key.ShiftLeft); pressKey(k, 1); if (shift) keyUp(Key.ShiftLeft) } }
        fun input(id: String) = compose.onNode(hasContentDescription(id.uppercase()) and hasSetTextAction())
        // An action is a list of steps, one per frame (Chrome's pointer paths move once per requestAnimationFrame).
        fun path(part: String, fx0: Double, fy0: Double, fx1: Double, fy1: Double, n: Int): List<() -> Unit> = (1..n).map { i -> val f: () -> Unit = {
            val q = at(part, fx0 + (fx1 - fx0) * i / n, fy0 + (fy1 - fy0) * i / n); mouse { moveTo(q, 0) } }; f }
        // A field can be recomposed into a new node between the lookup and the action (seen under machine load in fi-907:
        // "the node is no longer in the tree"): the action is retried once on the current node.
        fun onField(id: String, action: SemanticsNodeInteraction.() -> Unit) { try { input(id).action() } catch (e: AssertionError) { compose.waitForIdle(); input(id).action() } }
        fun typeIn(id: String, text: String): List<() -> Unit> = listOf<() -> Unit>({ val q = at("input-$id", .5, .5); mouse { moveTo(q, 0); press(); release() } },
            { onField(id) { performTextClearance() } }) + text.map { ch -> val f: () -> Unit = { onField(id) { performTextInput(ch.toString()) } }; f }
        val name0 = r.getString("name")
        val acts = mutableMapOf<String, List<() -> Unit>>()
        // Chrome's click is three CDP events (move, press, release): the pointer reaches the target about two frames before
        // the release fires the md* event, so hover motion starts first. These clicks move there at that time.
        val hoverFirst = mutableMapOf<String, () -> Offset>()
        fun one(f: () -> Unit) = listOf(f)
        when {
            name0.startsWith("cp-drag-plate") -> {
                acts["down-25-25"] = one { val q = at("plate", .25, .25); mouse { moveTo(q, 0); press() } }
                acts["drag-to-75-75"] = path("plate", .25, .25, .75, .75, 20)
                acts["drag-outside-clamps"] = path("plate", .75, .75, 1.3, 1.4, 8)
                acts["release-outside"] = one { mouse { release() } }
                acts["click-centre"] = one { val q = at("plate", .5, .5); mouse { moveTo(q, 0); press(); release() } }
            }
            name0.startsWith("cp-drag-") -> { val sl = if (name0.contains("hue")) "hue" else "alpha"
                acts["down-10"] = one { val q = at(sl, .1, .5); mouse { moveTo(q, 0); press() } }
                acts["drag-to-90"] = path(sl, .1, .5, .9, .5, 16)
                acts["drag-past-end"] = path(sl, .9, .5, 1.2, .5, 6)
                acts["drag-past-start-vertical-offset"] = path(sl, 1.2, .5, -.2, 3.0, 12)
                acts["release"] = one { mouse { release() } }
            }
            name0.startsWith("cp-keyboard-") -> { val part = if (name0.contains("plate")) "plate" else if (name0.contains("hue")) "hue" else "alpha"
                acts["focus-$part"] = one { compose.runOnIdle { picker?.focus(part) }; Unit }
                for (k in listOf("ArrowRight" to Key.DirectionRight, "ArrowLeft" to Key.DirectionLeft, "ArrowUp" to Key.DirectionUp, "ArrowDown" to Key.DirectionDown,
                    "Home" to Key.MoveHome, "End" to Key.MoveEnd, "PageDown" to Key.PageDown, "PageUp" to Key.PageUp, "Tab" to Key.Tab)) acts[k.first] = one { key(k.second) }
                acts["Shift+ArrowRight"] = one { key(Key.DirectionRight, true) }; acts["Shift+ArrowUp"] = one { key(Key.DirectionUp, true) }; acts["Shift+ArrowLeft"] = one { key(Key.DirectionLeft, true) }
                acts["Enter-ignored"] = one { key(Key.Enter) }; acts["ArrowLeft-wraps"] = one { key(Key.DirectionLeft) }; acts["End-wraps-to-0"] = one { key(Key.MoveEnd) }
                acts["End-again"] = one { key(Key.MoveEnd) }; acts["ArrowUp-ignored"] = one { key(Key.DirectionUp) }; acts["ArrowLeft-at-min"] = one { key(Key.DirectionLeft) }
                acts["Tab-to-hex"] = one { key(Key.Tab) }
            }
            name0 == "cp-tab-order" -> {
                acts["blank"] = one { mouse { moveTo(blank, 0); press(); release() } }
                acts["Tab-1"] = one { compose.runOnIdle { before.requestFocus() } }
                for (i in 2..18) acts["Tab-$i"] = one { key(Key.Tab) }
                acts["Shift+Tab"] = one { key(Key.Tab, true) }
            }
            name0.startsWith("cp-hex-typing") -> {
                acts["select-type-#ff5722"] = typeIn("hex", "#ff5722"); acts["Enter-commit"] = one { key(Key.Enter) }
                acts["type-short-0f0"] = typeIn("hex", "0f0"); acts["Tab-commit"] = one { key(Key.Tab) }
                acts["type-invalid-zz"] = typeIn("hex", "#zz"); acts["Tab-snaps-back"] = one { key(Key.Tab) }
                acts["focus-blur-no-edit"] = listOf<() -> Unit>({ val q = at("input-hex", .5, .5); mouse { moveTo(q, 0); press(); release() } }, { key(Key.Tab) })
                acts["type-8-digit"] = typeIn("hex", "#11223380")
            }
            name0 == "cp-channels-rgb" -> {
                acts["type-R-255"] = typeIn("r", "255"); acts["Tab-commit"] = one { key(Key.Tab) }
                acts["type-G-999-clamps"] = typeIn("g", "999"); acts["Enter-commit"] = one { key(Key.Enter) }
                acts["ArrowUp-in-B"] = listOf<() -> Unit>({ val q = at("input-b", .3, .5); mouse { moveTo(q, 0); press(); release() } }, { key(Key.DirectionUp) }); acts["Tab-commit-B"] = one { key(Key.Tab) }
                acts["type-A-0.25"] = typeIn("a", "0.25"); acts["Tab-commit-A"] = one { key(Key.Tab) }
            }
            name0 == "cp-channels-hsl" -> { acts["type-H-200"] = typeIn("h", "200"); acts["Tab-commit"] = one { key(Key.Tab) }; acts["type-L-90"] = typeIn("l", "90"); acts["Tab-commit-L"] = one { key(Key.Tab) } }
            name0 == "cp-presets" -> {
                acts["hover-0"] = one { val q = at("preset-0", .5, .5); mouse { moveTo(q, 0) } }
                acts["press-0"] = one { val q = at("preset-0", .5, .5); mouse { moveTo(q, 0); press() } }
                acts["release-0"] = one { mouse { release() } }
                acts["click-5-short-hex"] = one { val q = at("preset-5", .5, .5); mouse { moveTo(q, 0); press(); release() } }; hoverFirst["click-5-short-hex"] = { at("preset-5", .5, .5) }
                acts["reclick-5"] = one { val q = at("preset-5", .5, .5); mouse { moveTo(q, 0); press(); release() } }; hoverFirst["reclick-5"] = { at("preset-5", .5, .5) }
                acts["leave"] = one { mouse { moveTo(blank, 0) } }
                acts["Tab-to-next-preset"] = one { key(Key.Tab) }; acts["Space"] = one { key(Key.Spacebar) }; acts["Tab"] = one { key(Key.Tab) }; acts["Enter"] = one { key(Key.Enter) }
                acts["ArrowRight-ignored"] = one { key(Key.DirectionRight) }
            }
            name0 == "cp-popover-in-dialog" -> {
                acts["show-and-focus-plate"] = listOf<() -> Unit>({ props = props + ("open" to true) }) + List(21) { {} } + listOf<() -> Unit>({ compose.runOnIdle { picker?.focus("plate") }; Unit })
                acts["Escape-closes-picker-only"] = one { key(Key.Escape) }
                acts["Escape-closes-dialog"] = one { key(Key.Escape) }
            }
            name0.startsWith("cp-popover-") -> {
                val trig = { at("md-color-picker", .5, .5) }
                acts["click-trigger-open"] = one { val q = trig(); mouse { moveTo(q, 0); press(); release() } }; hoverFirst["click-trigger-open"] = trig
                acts["Escape-close-focus-stays-on-trigger"] = one { key(Key.Escape) }
                acts["Enter-on-trigger-opens"] = one { key(Key.Enter) }
                acts["Tab-into-panel"] = one { key(Key.Tab) }
                acts["ArrowRight-on-plate"] = one { key(Key.DirectionRight) }
                acts["Escape-returns-focus"] = one { key(Key.Escape) }
                acts["Space-on-trigger-opens"] = one { key(Key.Spacebar) }
                acts["click-plate"] = one { val q = at("plate", .3, .3); mouse { moveTo(q, 0); press(); release() } }; hoverFirst["click-plate"] = { at("plate", .3, .3) }
                acts["outside-click-closes-focus-stays"] = one { mouse { moveTo(blank, 0); press(); release() } }
                acts["show()"] = one { if (props["disabled"] != true) props = props + ("open" to true) }
                acts["trigger-click-toggles-closed"] = one { val q = trig(); mouse { moveTo(q, 0); press(); release() } }; hoverFirst["trigger-click-toggles-closed"] = trig
                acts["open-prop-true"] = one { props = props + ("open" to true) }
                acts["close()"] = one { props = props + ("open" to false) }
            }
            name0 == "cp-disabled" -> {
                acts["click-plate"] = one { val q = at("plate", .2, .2); mouse { moveTo(q, 0); press(); release() } }
                acts["drag-hue"] = listOf<() -> Unit>({ val q = at("hue", .1, .5); mouse { moveTo(q, 0); press() } }) + path("hue", .1, .5, .9, .5, 8) + listOf<() -> Unit>({ mouse { release() } })
                acts["click-preset"] = one { val q = at("preset-0", .5, .5); mouse { moveTo(q, 0); press(); release() } }
                acts["Tab-from-blank"] = listOf<() -> Unit>({ compose.runOnIdle { before.requestFocus() } }, { key(Key.Tab) })
            }
            name0 == "cp-controlled" -> {
                acts["set-value-rgb()"] = one { props = props + ("value" to "rgb(0, 128, 255)") }
                acts["set-value-rgba()"] = one { props = props + ("value" to "rgba(255, 0, 0, 0.5)") }
                acts["set-value-invalid"] = one { props = props + ("value" to "not-a-colour") }
                acts["set-format-hsl"] = one { props = props + ("format" to "hsl") }
                acts["keyboard-emit-in-hsl"] = listOf<() -> Unit>({ compose.runOnIdle { picker?.focus("hue") } }, { key(Key.DirectionRight) })
                acts["set-alpha-false"] = one { props = props + ("alpha" to false) }
            }
        }
        val phases = r.getJSONArray("phases").objects()
        // The run clock starts a little ahead so a first-phase input can lead Chrome's animation start by the native latency.
        val clock0 = compose.mainClock.currentTime + 48
        fun elapsed() = (compose.mainClock.currentTime - clock0).toDouble()
        val frames = mutableListOf<Frame>()
        fun sample() { val pk = picker ?: return; frames += Frame(elapsed(), pk.popIn, pk.presetMotion.toMap(), pk.thumbPress.toMap()) }
        fun advance() { compose.mainClock.advanceTimeByFrame(); compose.waitForIdle(); sample() }
        val webEvents = r.getJSONArray("events").objects()
        // Chrome's animation starts (`anims`: preset / thumb transforms, the popover pop-in, the preview colour fade that marks the
        // frame rendering a state change). A one-step input is timed so that the native transition starts in the frame Chrome's did:
        // anchor − the native latency (Compose: the state recomposes in the next frame and its animation's first frame follows).
        val anims = r.optJSONArray("anims")?.objects()?.map { it.getString("kind") to it.getDouble("start") } ?: emptyList()
        val anchored = mutableListOf<Triple<String, Pair<String, Double>, Double>>()
        // The input plan (oracle only): when each phase's input fires and, for clicks that hover first, when the pointer arrives.
        class Plan(val start: Double, val hover: Double?, val anchor: Pair<String, Double>?)
        fun plan(i: Int): Plan {
            val ph = phases[i]; val lbl = ph.getString("label"); val t = ph.getDouble("t")
            val nextT = if (i + 1 < phases.size) phases[i + 1].getDouble("t") else t + 400
            // A one-step input fires when Chrome's first md* event of the phase did (a click activates on release).
            val first = webEvents.firstOrNull { it.getString("name").startsWith("md") && it.getDouble("t") >= t && it.getDouble("t") < nextT }?.getDouble("t")
            val single = acts[lbl]?.size == 1 || lbl == "show-and-focus-plate"
            val inPhase = anims.filter { it.second >= t - (if (i == 0) 1 else 0) && it.second < nextT }
            var start = if (acts[lbl]?.size == 1 && first != null) maxOf(t, first - 2) else t
            var anchor: Pair<String, Double>? = null
            if (single && inPhase.isNotEmpty()) { val last = inPhase.last(); anchor = last; start = last.second - latency(last.first) }
            val hover = if (hoverFirst[lbl] == null) null else {
                // The pointer reaches the target first: at Chrome's hover transition when one precedes the activation's.
                val h = if (inPhase.size > 1 && inPhase[0].second < inPhase.last().second - 10) inPhase[0].second - latency(inPhase[0].first) else maxOf(t, (first ?: t) - 40)
                minOf(h, start - 4)
            }
            return Plan(start, hover, anchor)
        }
        val plans = phases.indices.map { plan(it) }
        for ((i, ph) in phases.withIndex()) {
            val lbl = ph.getString("label")
            val p = plans[i]; val start = p.start
            hoverFirst[lbl]?.let { target -> p.hover?.let { h -> while (elapsed() < h) advance()
                val q = target(); mouse { moveTo(q, 0) }; compose.waitForIdle(); sample() } }
            while (elapsed() < start) advance()
            p.anchor?.let { anchored += Triple(lbl, it, elapsed()) }
            val steps = acts[lbl]
            if (steps == null) check(false, "$name no native action for $lbl")
            else for ((k, s) in steps.withIndex()) { val c0 = elapsed(); s(); compose.waitForIdle(); val dc = elapsed() - c0
                if (dc > 0) android.util.Log.i("AWCAccordion", "colorpicker-states $name/$lbl step $k advanced the clock ${dc.toInt()} ms")
                sample(); if (k < steps.size - 1) advance() }
            // The phase's end state is read just before the next input (at the latest 20 ms before Chrome's next phase).
            val next = if (i + 1 < phases.size) phases[i + 1].getDouble("t") else start + 400
            val nextInput = if (i + 1 < phases.size) minOf(plans[i + 1].start, plans[i + 1].hover ?: Double.POSITIVE_INFINITY) - 2 else next
            while (elapsed() < minOf(next - 20, nextInput)) advance()
            phaseEnd(name, lbl, ph)
        }
        // Calibration: where each anchored native transition started (the first frame after the input whose value differs).
        for ((lbl, a, fired) in anchored) {
            fun sig(f: Frame): List<Float> = when (a.first) { "pop" -> listOf(f.pop); "thumb" -> f.thumbs.values.toList(); "preset" -> f.presets.values.flatMap { listOf(it.first, it.second) }; else -> emptyList() }
            val before = frames.lastOrNull { it.t <= fired } ?: continue
            val ch = frames.firstOrNull { it.t > fired && sig(it) != sig(before) } ?: continue
            android.util.Log.i("AWCAccordion", "colorpicker-anchor $name/$lbl ${a.first} chrome ${a.second.toInt()} fired ${fired.toInt()} native ${ch.t.toInt()} (${(ch.t - a.second).toInt()} ms)")
        }
        repeat(12) { advance() }
        // The page's clean-up moves focus away (a focused field's blur commits: mdChange).
        compose.runOnIdle { before.requestFocus() }; repeat(3) { advance() }
        // Motion: each Chrome sample against the native frames within one frame of its time (plus the value in force before).
        for (ph in phases) for (smp in ph.getJSONArray("samples").objects()) {
            val st = smp.optDouble("t", Double.NaN); if (st.isNaN()) continue
            val lbl = ph.getString("label")
            // The native frames within one frame of the sample plus the frames bracketing it (input injection can advance the
            // test clock past a whole frame).
            fun window(get: (Frame) -> List<Double>?): List<List<Double>> {
                val inside = frames.filter { abs(it.t - st) <= 20 }.mapNotNull(get)
                val prior = frames.lastOrNull { it.t < st - 20 }?.let(get)
                val before = frames.lastOrNull { it.t <= st }?.let(get); val after = frames.firstOrNull { it.t >= st }?.let(get)
                return inside + listOfNotNull(prior, before, after)
            }
            fun motion(key: String, web: List<Double>, tol: List<Double>, get: (Frame) -> List<Double>?, rest: List<Double>) {
                val cands = window(get).ifEmpty { listOf(rest) }
                val ok = web.indices.all { k -> web[k] >= cands.minOf { it[k] } - tol[k] && web[k] <= cands.maxOf { it[k] } + tol[k] }
                check(ok, "$name/$lbl t=${st.toInt()} $key web $web vs native $cands")
            }
            smp.optJSONObject("popover")?.let { o -> val mx = matrix(o.optString("transform")); val op = o.optString("opacity").toDoubleOrNull() ?: return@let
                motion("popover", listOf(op, mx[0], mx[5]), listOf(.03, .012, .35), { f -> val p = f.pop.toDouble(); val s = .8 + .2 * p; listOf(p, s, s * -8 * (1 - p)) }, listOf(1.0, 1.0, 0.0)) }
            smp.optJSONArray("presetTransforms")?.let { arr -> for (k in 0 until arr.length()) { val mx = matrix(arr.optString(k))
                motion("preset $k", listOf(sqrt(mx[0] * mx[0] + mx[1] * mx[1]), Math.toDegrees(atan2(mx[1], mx[0]))), listOf(.012, .35),
                    { f -> f.presets[k]?.let { listOf(it.first.toDouble(), it.second.toDouble()) } }, listOf(1.0, 0.0)) } }
            for ((key, part) in listOf("plateThumb" to "plate", "hueThumb" to "hue", "alphaThumb" to "alpha")) {
                val o = smp.optJSONObject(key) ?: continue; val sc = matrix(o.optString("transform"))[0]
                motion("$part thumb press", listOf((sc - 1) / .15), listOf(.1), { f -> f.thumbs[part]?.let { listOf(it.toDouble()) } }, listOf(0.0))
            }
        }
        // md* events: names and values.
        val web = r.getJSONArray("events").objects().map { e -> val d = e.optJSONObject("detail")
            e.getString("name") + (if (d != null && d.has("value")) ":" + d.get("value") else if (d != null && d.has("open")) ":" + d.getBoolean("open") else "") }
        val native = events.map { (n, d) -> n + (if (d.containsKey("value")) ":" + d["value"] else if (d.containsKey("open")) ":" + d["open"] else "") }
        // Pointer drags: Chrome's pointer coordinates carry sub-pixel rounding (≈1/16 px, direction-dependent at exact .5
        // channel boundaries) that cannot be reproduced bit for bit; a drag event value may differ by one 8-bit step in one
        // channel (reported, counted, never more).
        fun hexes(v: String) = Regex("^(md\\w+):#([0-9A-F]{6,8})$").find(v)?.groupValues
        fun near(a: String, b: String): Boolean { if (a == b) return true; val x = hexes(a) ?: return false; val y = hexes(b) ?: return false
            if (x[1] != y[1] || x[2].length != y[2].length || !name.contains("drag")) return false
            val d = x[2].chunked(2).zip(y[2].chunked(2)).map { (p, q) -> abs(p.toInt(16) - q.toInt(16)) }
            return d.count { it == 1 } == 1 && d.all { it <= 1 } }
        val lsb = native.indices.count { it < web.size && native[it] != web[it] && near(native[it], web[it]) }
        if (lsb > 0) report.put(JSONObject().put("run", name).put("dragEventsWithinOneStep", lsb))
        val same = native.size == web.size && native.indices.all { near(native[it], web[it]) }
        val d0 = native.indices.firstOrNull { it >= web.size || !near(native[it], web[it]) } ?: if (native.size < web.size) native.size else -1
        check(same, "$name events differ at $d0: native ${native.drop(maxOf(0, d0 - 2)).take(5)} vs web ${web.drop(maxOf(0, d0 - 2)).take(5)} (${native.size} vs ${web.size})")
        report.put(JSONObject().put("run", name).put("events", native.size).put("webEvents", web.size))
        compose.mainClock.autoAdvance = true
    }
    /** The native focused part (Web: the deep active element's part). */
    private fun focusedPart(): String { val f = picker?.focused ?: return if (beforeFocused) "button" else "body"
        return when { f.startsWith("preset") -> "preset"; f in setOf("hex", "r", "g", "b", "a", "h", "s", "l") -> "input"; else -> f } }
    private fun webFocus(f: JSONArray?): String { if (f == null || f.length() == 0) return "body"
        if (f.length() >= 2) return f.optString(1); val a = f.optString(0)
        return if (a == "button") "button" else if (a.startsWith("md-button")) "trigger" else a }
    private fun phaseEnd(name: String, lbl: String, ph: JSONObject) {
        val ss = ph.getJSONArray("samples"); val last = if (ss.length() > 0) ss.getJSONObject(ss.length() - 1) else null
        val pk = picker; val label = "$name/$lbl"
        if (last != null && pk != null) {
            if (last.has("value") && !last.isNull("value")) check(pk.value == last.getString("value"), "$label value ${pk.value} vs ${last.getString("value")}")
            if (last.has("hex") && !last.isNull("hex")) check(pk.hexInput == last.getString("hex"), "$label hex ${pk.hexInput} vs ${last.getString("hex")}")
            check(pk.hexInvalid == (last.optString("hexInvalid") == "true"), "$label hexInvalid ${pk.hexInvalid} vs ${last.opt("hexInvalid")}")
            last.optJSONArray("selectedPresets")?.let { a -> val w = (0 until a.length()).map { a.getString(it) }; check(pk.selectedPresets == w, "$label selected presets ${pk.selectedPresets} vs $w") }
            if (last.has("open") && !last.isNull("open") && props["variant"] == "popover") check(pk.open == last.getBoolean("open"), "$label open ${pk.open} vs ${last.get("open")}")
            last.optJSONArray("channels")?.let { a -> val w = (0 until a.length()).map { a.getString(it) }; if (w.isNotEmpty()) check(pk.channels == w, "$label channels ${pk.channels} vs $w") }
            if (last.has("preview") && !last.isNull("preview")) { val w = rgba(last.getString("preview")); val v = pk.rgba
                check(abs(w[0] - v[0]) <= 1 && abs(w[1] - v[1]) <= 1 && abs(w[2] - v[2]) <= 1 && abs(w[3] - v[3]) <= .01, "$label preview $v vs ${last.getString("preview")}") }
            val nodes = collector.snapshot().nodes
            // Inside md-dialog the Android dialog is its own window (dialog-relative coordinates): thumb centres are page-relative
            // in Chrome, so they are compared only on the page.
            for ((key, part) in listOf("plateThumb" to "thumb", "hueThumb" to "hue-thumb", "alphaThumb" to "alpha-thumb")) {
                if (run.optBoolean("inDialog")) break
                val o = last.optJSONObject(key) ?: continue; val rr = o.optJSONObject("rect") ?: continue
                val n = nodes.firstOrNull { it.name == part }?.bounds ?: run { check(false, "$label $part measured"); null } ?: continue
                val wx = rr.getDouble("x") + rr.getDouble("width") / 2; val wy = rr.getDouble("y") + rr.getDouble("height") / 2
                check(abs(n.x + n.width / 2 - wx) <= 1 && abs(n.y + n.height / 2 - wy) <= 1, "$label $part centre (${n.x + n.width / 2}, ${n.y + n.height / 2}) vs ($wx, $wy)")
            }
        }
        val wf = webFocus(ph.optJSONArray("focus")); val nf = focusedPart()
        // Outside the picker Chrome's focus is the page's button or, past the last stop, the browser (body); which one depends on
        // the browser's tab cycle, not on the component: both count as "outside".
        val outside = setOf("button", "body")
        if (name.removePrefix("reduced/") != "cp-tab-order" || wf != "body") check(nf == wf || (nf in outside && wf in outside), "$label focus $nf vs $wf")
    }
}
