// fa (2026-10-30): md-stepper / md-step parity against the Mac Chrome 153 oracles (outputs/native-parity/md-stepper/web-oracle,
// byte-identical gzip assets under stepper/): paint (every part's box, colours, scale / transform, halo, focus ring, text and
// its font, the inner header's ARIA, panel boxes / visibility / grid rows, live regions) through StepperLayout, and the state
// runs (normal + reduced motion) replayed through StepperModel + StepperMotion: per-frame bubble colour / scale / width,
// connector fill, panel height / visibility, host height, live regions, active / completed, the md* event sequence, and each
// phase-end snapshot compared like a paint case. Lockstep with Swift's NativeStepperIntegration.swift.
package dev.awc.playground.stepper

import dev.awc.nativeui.stepper.*
import kotlin.math.abs

// MARK: tokens.css

object StepperWebTokens {
    val css: String by lazy { StepperEnv.text("tokens.css") }
    fun block(start: String): Map<String, String> {
        val i = css.indexOf(start); if (i < 0) return emptyMap()
        val open = css.indexOf('{', i); val close = css.indexOf("\n}", open); if (open < 0 || close < 0) return emptyMap()
        val body = css.substring(open + 1, close)
        return Regex("""(--[\w-]+)\s*:\s*([^;]+);""").findAll(body).associate { it.groupValues[1] to it.groupValues[2].trim() }
    }
    val light by lazy { block(":root {") }
    val dark by lazy { light + block("[data-theme=\"dark\"] {") }
    /** The rung payloads must equal StepperTheme.rungs (the view's static table). */
    fun checkRungs(): List<String> {
        val d = ArrayList<String>()
        for (n in listOf(-1, -2, -3, -4)) {
            val b = block("[data-density=\"$n\"],").filterKeys { it.startsWith("--md-sys-spacing-") && it != "--md-sys-spacing-row-height" }
            val web = b.entries.associate { it.key.removePrefix("--md-sys-spacing-") to (stepperPx(it.value) ?: -1.0) }
            val mine = StepperTheme.rungs[n] ?: emptyMap()
            if (web != mine) d += "density rung $n: tokens.css $web native $mine"
        }
        return d
    }
}

// MARK: markup → props (the oracle's HTML)

class StepperMarkup(html: String) {
    var props = StepperProps(); val steps = ArrayList<StepProps>(); var slot = false; var hooks = StepperHooks()
    init {
        val re = Regex("""<(md-stepper|md-step|div)((?:\s+[\w-]+(?:="[^"]*")?)*)\s*>""")
        val attrRe = Regex("""([\w-]+)(?:="([^"]*)")?""")
        for (m in re.findAll(html)) {
            val tag = m.groupValues[1]
            val a = HashMap<String, String>()
            for (am in attrRe.findAll(m.groupValues[2])) a[am.groupValues[1]] = if (am.groups[2] == null) "" else am.groupValues[2]
            when (tag) {
                "md-stepper" -> {
                    props = StepperProps(orientation = a["orientation"] ?: "horizontal", indicator = a["indicator"] ?: "numbered", variant = a["variant"] ?: "default",
                        mode = a["mode"] ?: "linear", active = a["active"]?.toDoubleOrNull() ?: 0.0, autoComplete = a["auto-complete"] != "false", nav = a["nav"] != "false",
                        readonly = "readonly" in a, nextDisabled = "next-disabled" in a, loading = "loading" in a, lazy = "lazy" in a,
                        label = a["label"] ?: "Progress", stepWord = a["step-word"] ?: "Step", ofWord = a["of-word"] ?: "of",
                        completedWord = a["completed-word"] ?: "completed", currentWord = a["current-word"] ?: "current", errorWord = a["error-word"] ?: "error",
                        optionalWord = a["optional-word"] ?: "Optional", nextLabel = a["next-label"] ?: "Continue", backLabel = a["back-label"] ?: "Back",
                        finishLabel = a["finish-label"] ?: "Finish", density = a["density"]?.toDoubleOrNull() ?: 0.0)
                    hooks = StepperHooks.fromStyle(a["style"] ?: "")
                }
                "md-step" -> {
                    // own content: anything between this tag and its </md-step>
                    val start = m.range.last + 1
                    val end = html.indexOf("</md-step>", start)
                    val inner = if (end < 0) "" else html.substring(start, end)
                    steps += StepProps(label = a["label"] ?: "", description = a["description"] ?: "", errorText = a["error-text"] ?: "",
                        completed = "completed" in a, error = "error" in a, disabled = "disabled" in a, optional = "optional" in a,
                        editable = "editable" in a, hideActions = "hide-actions" in a, icon = a["icon"] ?: "",
                        completedIcon = a["completed-icon"] ?: "check", errorIcon = a["error-icon"] ?: "priority_high", accessibleName = a["accessible-name"],
                        density = a["density"]?.toDoubleOrNull() ?: 0.0, hasContent = inner.isNotBlank(), style = a["style"] ?: "")
                }
                "div" -> if (a["slot"] == "content") slot = true
            }
        }
    }
}

// MARK: comparison

const val STEPPER_TOL = 1.0 / 64 + 1e-6
@Suppress("UNCHECKED_CAST") fun Any?.obj(): Map<String, Any?> = this as? Map<String, Any?> ?: emptyMap()
@Suppress("UNCHECKED_CAST") fun Any?.objs(): List<Map<String, Any?>> = (this as? List<Any?>)?.map { it.obj() } ?: emptyList()
fun Any?.dbl(): Double? = (this as? Number)?.toDouble()
fun swRect(v: Any?): SRect {
    val m = v.obj()
    fun n(k: String) = m[k].dbl() ?: 0.0
    return SRect(n("x"), n("y"), n("width"), n("height"))
}
fun swColor(s: String) = stepperColor(s) ?: SRGBA(0.0, 0.0, 0.0, 0.0)
fun swPx(v: Any?) = stepperPx(v as? String ?: "") ?: 0.0
private fun fmt(r: SRect) = "(${r.x}, ${r.y}, ${r.width}, ${r.height})"

fun stepperTreeDiff(tree: Map<String, Any?>, p: StepperPaint, m: StepperModel, ox: Double, oy: Double, d: (String) -> Unit) {
    fun at(r: SRect) = if (r.isEmpty) r else r.offset(ox, oy)
    fun eqR(l: String, w: SRect, mine: SRect) {
        val n = at(mine)
        if (abs(w.x - n.x) > STEPPER_TOL || abs(w.y - n.y) > STEPPER_TOL || abs(w.width - n.width) > STEPPER_TOL || abs(w.height - n.height) > STEPPER_TOL) d("$l rect web ${fmt(w)} native ${fmt(n)}")
    }
    fun eqC(l: String, web: String, mine: SRGBA) {
        val w = swColor(web)
        if (abs(w.a - mine.a) > 0.002) { d("$l alpha web $web native $mine"); return }
        if (w.a == 0.0) return
        if (abs(w.r - mine.r) > 0.6 / 255 || abs(w.g - mine.g) > 0.6 / 255 || abs(w.b - mine.b) > 0.6 / 255) d("$l colour web $web native $mine")
    }
    eqR("host", swRect(tree["rect"]), p.host)
    val wparts = tree["parts"].objs().associateBy { it["part"] as? String ?: "" }
    val mine = LinkedHashMap<String, SRect>(); mine["list"] = p.list ?: SRect.ZERO; mine["content"] = p.content
    p.nav?.let { mine["nav"] = it }; p.mobileNav?.let { mine["mobile-nav"] = it }; p.mobileProgress?.let { mine["mobile-progress"] = it }
    if (wparts.keys != mine.keys) d("host parts web ${wparts.keys.sorted()} native ${mine.keys.sorted()}")
    for ((k, w) in wparts) mine[k]?.let { eqR(k, swRect(w["rect"]), it) }
    val live = tree["live"].objs().map { it["text"] as? String ?: "" }
    if (live != listOf(m.live, m.errorLive)) d("live web $live native ${listOf(m.live, m.errorLive)}")
    val kids = tree["children"].objs()
    if (kids.size != p.steps.size) { d("steps web ${kids.size} native ${p.steps.size}"); return }
    for ((i, pair) in kids.zip(p.steps).withIndex()) {
        val (ws, s) = pair
        eqR("s$i host", swRect(ws["rect"]), s.hostRect)
        val wa = ws["attrs"].obj()
        val ha = mapOf("role" to "listitem", "aria-current" to (if (m.isActive(i)) "step" else null), "aria-disabled" to (if (m.effectivelyDisabled(i)) "true" else null))
        for ((k, v) in ha) if ((wa[k] as? String) != v) d("s$i host attr $k web ${wa[k]} native $v")
        val names = ArrayList<String>()
        if (s.hasLeadingConnector) names += "connector connector-leading"
        names += listOf("inner", "indicator", "state-layer", if (s.dot) "dot" else "bubble")
        if (s.text != null) { names += "text"; names += s.lines.map { it.part } }
        if (s.connector != null) names += "connector connector-trailing"
        if (s.panel != null) names += "content"
        if (s.actions != null) names += "actions"
        val wp = ws["parts"].objs()
        val wnames = wp.map { it["part"] as? String ?: "" }
        if (wnames != names) { d("s$i parts web $wnames native $names"); continue }
        for (w in wp) {
            val k = w["part"] as? String ?: ""; val L = "s$i $k"; val wr = swRect(w["rect"])
            val op = (w["opacity"] as? String)?.toDoubleOrNull() ?: 1.0
            when (k) {
                "connector connector-leading" -> if ((w["display"] as? String) != "none") d("$L display web ${w["display"]}")
                "inner" -> {
                    eqR(L, wr, s.inner)
                    val a = w["attrs"].obj()
                    val mineA = HashMap<String, String>()
                    if (!m.p.readonly) {
                        mineA["role"] = "button"; mineA["tabindex"] = if (s.disabled) "-1" else "0"; mineA["aria-label"] = m.a11yLabel(i)
                        if (s.disabled) mineA["aria-disabled"] = "true"
                    }
                    if (m.isActive(i)) mineA["aria-current"] = "step"
                    if (s.hasPanel) mineA["aria-expanded"] = if (m.isActive(i)) "true" else "false"
                    if (s.renderPanel) mineA["aria-controls"] = "md-step-panel"
                    for (key in listOf("role", "tabindex", "aria-label", "aria-disabled", "aria-current", "aria-expanded", "aria-controls"))
                        if ((a[key] as? String) != mineA[key]) d("$L attr $key web ${a[key]} native ${mineA[key]}")
                }
                "indicator" -> {
                    eqR(L, wr, s.indicator)
                    if (abs(op - s.indicatorOpacity) > 1e-6) d("$L opacity web $op native ${s.indicatorOpacity}")
                    val bs = w["boxShadow"] as? String ?: "none"
                    val ring = s.focusRing
                    if ((bs == "none") != (ring == null)) d("$L ring web $bs native $ring")
                    else if (ring != null) {
                        val parts = bs.split(", rgb")
                        if (parts.size == 2) {
                            val a1 = parts[0].substring(0, parts[0].lastIndexOf(')') + 1)
                            val p2 = "rgb" + parts[1]
                            val a2 = p2.substring(0, p2.indexOf(')') + 1)
                            eqC("$L ring inner", a1, ring.first); eqC("$L ring outer", a2, ring.second)
                        }
                    }
                }
                "state-layer" -> {
                    eqR(L, wr, s.stateLayer)
                    if (((w["display"] as? String) == "none") == s.stateLayerVisible) d("$L display web ${w["display"]} native ${s.stateLayerVisible}")
                    if (abs(op - s.stateOpacity) > 1e-6) d("$L opacity web $op native ${s.stateOpacity}")
                    if (s.stateLayerVisible) eqC("$L bg", w["backgroundColor"] as? String ?: "", s.stateColor)
                }
                "bubble", "dot" -> {
                    eqR(L, wr, s.bubble)
                    eqC("$L bg", w["backgroundColor"] as? String ?: "", s.bubbleColor)
                    s.bubbleText?.let { eqC("$L fg", w["color"] as? String ?: "", it) }
                    val tr = w["transform"] as? String ?: "none"
                    val sc = if (tr == "none") 1.0 else tr.drop(7).split(',').firstOrNull()?.trim()?.toDoubleOrNull() ?: -1.0
                    if (abs(sc - s.scale) > 1e-6) d("$L scale web $tr native ${s.scale}")
                    if ((tr == "none") != s.transformNone) d("$L transform kind web $tr native none=${s.transformNone}")
                    val bs = w["boxShadow"] as? String ?: "none"
                    val h = s.halo
                    if ((bs == "none") != (h == null)) d("$L halo web $bs native $h")
                    else if (h != null) {
                        val close = bs.lastIndexOf(')')
                        if (close >= 0) {
                            eqC("$L halo", bs.substring(0, close + 1), h.first)
                            val spread = stepperPx(bs.split(' ').last()) ?: -1.0
                            if (abs(spread - h.second) > 1e-3) d("$L halo spread web $bs native ${h.second}")
                        }
                    }
                    if ((w["text"] as? String) != s.number) d("$L text web ${w["text"]} native ${s.number}")
                }
                "text" -> {
                    eqR(L, wr, s.text ?: SRect.ZERO)
                    if (abs(op - s.textOpacity) > 1e-6) d("$L opacity web $op native ${s.textOpacity}")
                }
                "label", "optional", "description" -> {
                    val line = s.lines.firstOrNull { it.part == k }
                    if (line == null) { d("$L missing"); continue }
                    eqR(L, wr, line.rect)
                    eqC("$L fg", w["color"] as? String ?: "", line.color)
                    if ((w["text"] as? String) != line.text) d("$L text web ${w["text"]} native ${line.text}")
                    if (abs(swPx(w["fontSize"]) - line.fontSize) > 1e-6) d("$L fontSize web ${w["fontSize"]} native ${line.fontSize}")
                    if (abs(swPx(w["lineHeight"]) - line.lineHeight) > 1e-6) d("$L lineHeight web ${w["lineHeight"]} native ${line.lineHeight}")
                    if (((w["fontWeight"] as? String)?.toDoubleOrNull() ?: 0.0) != line.weight) d("$L fontWeight web ${w["fontWeight"]} native ${line.weight}")
                }
                "connector connector-trailing" -> {
                    val c = s.connector ?: continue
                    eqR(L, wr, c.rect); eqC("$L bg", w["backgroundColor"] as? String ?: "", c.color)
                }
                "content" -> {
                    val pn = s.panel ?: continue
                    eqR(L, wr, pn.rect)
                    if ((w["visibility"] as? String) != (if (pn.visible) "visible" else "hidden")) d("$L visibility web ${w["visibility"]} native ${pn.visible}")
                    if (abs(op - pn.opacity) > 1e-6) d("$L opacity web $op native ${pn.opacity}")
                    val gr = w["gridTemplateRows"] as? String ?: ""
                    val gv = if (gr.endsWith("px")) stepperPx(gr) else null
                    val mg = pn.gridRows
                    if ((gv == null) != (mg == null) || (gv != null && mg != null && abs(gv - mg) > STEPPER_TOL)) d("$L gridTemplateRows web $gr native $mg")
                }
                "actions" -> eqR(L, wr, s.actions ?: SRect.ZERO)
                else -> d("$L unexpected part")
            }
        }
    }
}

fun stepperInput(width: Double, dir: String, dark: Boolean, density: Double, mk: StepperMarkup) = StepperLayoutInput(
    width = width, rtl = dir == "rtl", dark = dark, globalDensity = density,
    slotHeight = if (mk.slot) 24.0 else null,      // the oracle's `.panel` div: Roboto 14px, line-height normal (16) + 4px padding × 2
    defaultContentHeight = 24.0, tokens = if (dark) StepperWebTokens.dark else StepperWebTokens.light, hooks = mk.hooks)

class StepperPaintCase(private val c: Map<String, Any?>) {
    fun run(): List<String> {
        val diffs = ArrayList<String>()
        val mk = StepperMarkup(c["html"] as? String ?: "")
        val m = StepperModel()
        m.sync(mk.props, mk.steps)
        if ((c["name"] as? String ?: "").startsWith("focus-visible-header")) m.focusVisible = 0
        val input = stepperInput(c["width"].dbl() ?: 480.0, c["dir"] as? String ?: "ltr", c["theme"] == "dark", c["density"].dbl() ?: 0.0, mk)
        val paint = StepperLayout.layout(m, input, StepperEnv.measure)
        val box = swRect(c["box"])
        stepperTreeDiff(c["tree"].obj(), paint, m, box.x, box.y) { diffs += it }
        return diffs
    }
}

// MARK: state runs

class StepperStateRun(private val r: Map<String, Any?>, private val reduced: Boolean) {
    private val name = r["name"] as? String ?: ""
    private val diffs = ArrayList<String>()
    private val m = StepperModel(); private val motion = StepperMotion()
    private var pointer = StepperPointer()
    private val mk = StepperMarkup(r["html"] as? String ?: "")
    private val input = stepperInput(swRect(r["box"]).width, r["dir"] as? String ?: "ltr", r["theme"] == "dark", 0.0, mk)
    private val events = ArrayList<Pair<String, String>>()
    companion object { val md = setOf("mdBeforeChange", "mdStepChange", "mdComplete", "mdStepClick", "mdStepNext", "mdStepBack") }
    private fun norm(v: Any?): String = when (v) {
        null -> "null"
        is Map<*, *> -> "{" + v.keys.map { it.toString() }.sorted().joinToString(",") { "$it:${norm(v[it])}" } + "}"
        is Number -> { val dd = v.toDouble(); if (dd == Math.floor(dd) && abs(dd) < 1e15) dd.toLong().toString() else dd.toString() }
        else -> v.toString()
    }
    private fun layout(now: Double) = StepperLayout.layout(m, input, StepperEnv.measure, motion, now, reduced, pointer)

    private fun act(label: String) {
        fun header(i: Int) { m.activateHeader(i) }
        if (name.startsWith("horizontal-nav") || name.startsWith("mobile") || name == "before-change-cancel") {
            if (label.startsWith("continue") || label == "finish") { m.next(); m.focus = StepperModel.Focus.Nav(1); return }
            if (label == "back") { m.footerBack(); return }
        }
        if (name.startsWith("vertical-panels")) {
            val k = label.firstOrNull { it.isDigit() }?.toString()?.toInt() ?: 0
            if (label.startsWith("continue")) m.stepNext(k) else m.stepBack(k)
            return
        }
        val clicks = mapOf("click-future-blocked" to 2, "click-past-allowed" to 0, "click-last" to 2, "click-first" to 0, "click-after-disabled" to 2, "click-review-blocked" to 3, "click-header" to 2)
        if (name in setOf("linear-header-clicks", "nonlinear-header-clicks", "linear-disabled-skip", "readonly-click")) {
            val i = clicks[label]
            if (i != null) { m.focus = StepperModel.Focus.Header(i); m.focusVisible = null; pointer = StepperPointer(hover = i, pressed = null); header(i); return }
        }
        if (name == "keyboard-headers") {
            if (label.startsWith("tab")) {
                val cur = (m.focus as? StepperModel.Focus.Header)?.i ?: -1
                val nxt = m.tabStops.firstOrNull { it > cur }
                if (nxt != null) { m.focus = StepperModel.Focus.Header(nxt); m.focusVisible = nxt }
                return
            }
            val f = m.focus
            if ((label == "enter" || label == "space") && f is StepperModel.Focus.Header) { header(f.i); return }
        }
        if (name == "loading-next-disabled") {
            var p = m.p
            when (label) {
                "set-loading" -> p = p.copy(loading = true)
                "next-disabled" -> p = p.copy(loading = false, nextDisabled = true)
                "enable-and-continue" -> p = p.copy(nextDisabled = false)
            }
            m.sync(p, mk.steps)
            if (label == "enable-and-continue") { m.next(); m.focus = StepperModel.Focus.Nav(1) }
            return
        }
        if (name == "error-announce") {
            if (label == "set-error") m.setStepError(0, true, "Email is required")
            if (label == "clear-error") m.setStepError(0, false)
            return
        }
        if (name.startsWith("lazy")) { if (label == "next") m.next(); return }
        if (name == "methods") {
            when (label) { "goTo-2" -> m.goTo(2); "prev" -> m.prev(); "reset" -> m.reset() }
            return
        }
        if (name == "header-pointer-states") {
            when (label) {
                "hover" -> pointer = pointer.copy(hover = 1)
                "press" -> { pointer = pointer.copy(pressed = 1); m.focus = StepperModel.Focus.Header(1); m.focusVisible = null }
                "release" -> { pointer = pointer.copy(pressed = null); header(1) }
            }
            return
        }
        diffs += "no action for $name $label"
    }

    fun run(): List<String> {
        m.emit = { n, d, _ ->
            events += n to norm(d)
            !(n == "mdBeforeChange" && name == "before-change-cancel" && (d?.get("index") as? Int) == 1)
        }
        m.sync(mk.props, mk.steps)
        layout(-1e6)
        val phases = r["phases"].objs(); val anims = r["anims"].objs()
        val webEvents = r["events"].objs().filter { (it["name"] as? String ?: "") in md }
        for ((pi, ph) in phases.withIndex()) {
            val label = ph["label"] as? String ?: ""
            val t0 = ph["t"].dbl() ?: 0.0; val t1 = if (pi + 1 < phases.size) phases[pi + 1]["t"].dbl() ?: Double.POSITIVE_INFINITY else Double.POSITIVE_INFINITY
            val liveBefore = listOf(m.live, m.errorLive)
            val mark = motion.started.size
            act(label)
            val samples = ph["samples"].objs()
            // The step change starts its transitions on one frame (pointer state layers are checked in the phase-end snapshot).
            val starts = anims.filter { a -> val t = a["target"] as? String ?: ""; t.startsWith("md-step[") && !t.contains("state-layer") }
                .mapNotNull { it["startTime"].dbl() }.filter { it >= t0 - 1e-6 && it < t1 }
            val evs = webEvents.mapNotNull { it["t"].dbl() }.filter { it >= t0 - 1e-6 && it < t1 }
            var change: Double? = starts.minOrNull()
            if (change == null) evs.maxOrNull()?.let { last -> change = samples.mapNotNull { it["t"].dbl() }.firstOrNull { it > last - 0.05 } }
            if (change == null && evs.isEmpty()) change = samples.firstOrNull()?.get("t").dbl() ?: t0
            var applied = false
            for (sm in samples) {
                val t = sm["t"].dbl() ?: continue
                val ch = change
                if (!applied && ch != null && t >= ch - 0.05) { layout(ch); applied = true }
                if (!applied) { diffs += "$label#$pi@$t sample before the change frame"; continue }
                val wins = listOf(layout(t - 0.1), layout(t + 0.1), layout(t))
                compare("$label#$pi@${"%.1f".format(t)}", sm, wins, if (ch != null && t < ch + 17) liveBefore else null)
            }
            val ch = change
            if (!applied && ch != null) layout(ch)
            val snapT = (samples.lastOrNull()?.get("t").dbl() ?: t0) + 16.7
            val snapPaint = layout(snapT)
            val snap = ph["snap"]
            if (!motion.active(snapT) && snap is Map<*, *>) {
                val box = swRect(r["box"])
                stepperTreeDiff(snap.obj(), snapPaint, m, box.x, box.y) { diffs += "$label#$pi snap $it" }
            }
            // Keyframe animations started in this phase (glyph-in, lazy content-enter, error pulse) by step, as Chrome ran them.
            val names = mapOf("glyph" to "md-step-glyph-in", "content" to "md-step-content-enter", "pulse" to "md-step-error-pulse")
            val mine = motion.started.drop(mark).mapNotNull { (key, _) ->
                val parts = key.drop(1).split('.')
                parts.getOrNull(1)?.let { names[it] }?.let { "$it s${parts[0]}" }
            }.sorted()
            val web = anims.mapNotNull { a ->
                val n = a["property"] as? String ?: return@mapNotNull null
                val st = a["startTime"].dbl() ?: return@mapNotNull null
                if (n !in names.values || st < t0 - 1e-6 || st >= t1) return@mapNotNull null
                val target = a["target"] as? String ?: ""
                val lab = target.substringAfter('[', "").substringBefore(']', "")
                "$n s${mk.steps.indexOfFirst { it.label == lab }}"
            }.sorted()
            if (mine != web) diffs += "$label#$pi keyframe animations web $web native $mine"
        }
        val web = webEvents.map { (it["name"] as? String ?: "") + " " + norm(it["detail"]) }
        val mine = events.map { it.first + " " + it.second }
        if (web != mine) diffs += "events web $web native $mine"
        return diffs
    }

    private fun compare(tag: String, sm: Map<String, Any?>, wins: List<StepperPaint>, prevLive: List<String>?) {
        fun within(l: String, web: Double, vals: List<Double>, tol: Double) {
            if (web < (vals.minOrNull() ?: 0.0) - tol || web > (vals.maxOrNull() ?: 0.0) + tol) diffs += "$tag $l web $web native ${vals.lastOrNull()}"
        }
        if (sm["active"].dbl()?.toInt() != m.active) diffs += "$tag active web ${sm["active"]} native ${m.active}"
        within("h", sm["h"].dbl() ?: -1.0, wins.map { it.host.height }, STEPPER_TOL)
        @Suppress("UNCHECKED_CAST") val live = (sm["live"] as? List<Any?>)?.map { it as? String ?: "" } ?: emptyList()
        if (live != listOf(m.live, m.errorLive) && !(prevLive != null && live == prevLive)) diffs += "$tag live web $live native ${listOf(m.live, m.errorLive)}"
        for ((i, ws) in sm["steps"].objs().withIndex()) {
            if (i >= m.count) break
            if (ws["active"] as? Boolean != m.isActive(i) || ws["completed"] as? Boolean != m.steps[i].completed)
                diffs += "$tag s$i active/completed web ${ws["active"]}/${ws["completed"]} native ${m.isActive(i)}/${m.steps[i].completed}"
            val ss = wins.map { it.steps[i] }
            val bg = swColor(ws["bubbleBg"] as? String ?: "")
            within("s$i bg.r", bg.r * 255, ss.map { it.bubbleColor.r * 255 }, 1.01)
            within("s$i bg.g", bg.g * 255, ss.map { it.bubbleColor.g * 255 }, 1.01)
            within("s$i bg.b", bg.b * 255, ss.map { it.bubbleColor.b * 255 }, 1.01)
            val tr = ws["bubbleTransform"] as? String ?: "none"
            within("s$i scale", if (tr == "none") 1.0 else tr.drop(7).split(',').firstOrNull()?.trim()?.toDoubleOrNull() ?: -1.0, ss.map { it.scale }, 2e-4)
            if (!ss.map { it.transformNone }.contains(tr == "none")) diffs += "$tag s$i transform web $tr native none=${ss.last().transformNone}"
            ws["bubbleW"].dbl()?.let { bw -> within("s$i bubbleW", bw, ss.map { it.bubble.width }, 2e-3) }
            val fill = ws["fill"] as? String
            val lastC = ss.last().connector
            if ((fill == null) != (lastC == null)) diffs += "$tag s$i connector web $fill native ${lastC != null}"
            else if (fill != null && lastC != null) {
                val v = fill.drop(7).dropLast(1).split(',').map { it.trim().toDoubleOrNull() ?: -1.0 }
                within("s$i fill", if (lastC.vertical) v[3] else v[0], ss.mapNotNull { it.connector?.fill }, 2e-4)
            }
            val ph = ws["panelH"].dbl()
            val lastP = ss.last().panel
            if ((ph == null) != (lastP == null)) diffs += "$tag s$i panel web $ph native ${lastP != null}"
            else if (ph != null && lastP != null) {
                within("s$i panelH", ph, ss.mapNotNull { it.panel?.rect?.height }, STEPPER_TOL)
                val vis = (ws["panelVis"] as? String) == "visible"
                if (!ss.mapNotNull { it.panel?.visible }.contains(vis)) diffs += "$tag s$i panelVis web $vis native ${lastP.visible}"
            }
        }
    }
}

object StepperParity {
    private fun load(dir: String, names: List<String>): Map<String, Any?>? {
        for (n in names) { val f = java.io.File(dir, n); if (f.exists()) return StepperEnv.parse(f.readText()).obj() }
        return null
    }
    /** Prints one summary line per oracle file ("…: ok/total") and FAIL blocks; returns (passed, total). */
    fun run(dir: String, paint: Boolean, states: Boolean): Pair<Int, Int> {
        var total = 0; var passed = 0
        if (paint) {
            val rungs = StepperWebTokens.checkRungs()
            total++; if (rungs.isEmpty()) { passed++; println("density rungs: tokens.css = StepperTheme.rungs 1/1") } else rungs.forEach { println("FAIL $it") }
            for ((files, title, required) in listOf(Triple(listOf("web-paint.json", "paint.json"), "paint", true), Triple(listOf("web-paint-extra.json"), "paint (extra)", false))) {
                val root = load(dir, files)
                if (root == null) { if (required) { println("missing $dir/${files[0]}"); total++ }; continue }
                val cases = root["cases"].objs()
                var ok = 0
                for (c in cases) {
                    val d = try { StepperPaintCase(c).run() } catch (e: Throwable) { listOf("exception $e") }
                    total++
                    if (d.isEmpty()) { ok++; passed++ } else { println("FAIL ${c["name"]} ($title)"); d.take(10).forEach { println("   $it") } }
                }
                println("md-stepper $title: $ok/${cases.size}")
            }
        }
        if (states) for ((file, reduced) in listOf(listOf("web-states.json", "states.json") to false, listOf("web-states-reduced.json", "states-reduced.json") to true)) {
            val root = load(dir, file)
            if (root == null) { println("missing $dir/${file[0]}"); total++; continue }
            val runs = root["runs"].objs()
            var ok = 0
            for (r in runs) {
                val d = try { StepperStateRun(r, reduced).run() } catch (e: Throwable) { listOf("exception $e ${e.stackTrace.take(4).joinToString()}") }
                total++
                if (d.isEmpty()) { ok++; passed++ } else { println("FAIL ${r["name"]} (${file[0]})"); d.take(12).forEach { println("   $it") } }
            }
            println("md-stepper ${file[0]}: $ok/${runs.size}")
        }
        return passed to total
    }
}
