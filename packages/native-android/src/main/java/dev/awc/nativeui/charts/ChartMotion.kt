package dev.awc.nativeui.charts

import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min

// The rest of the chart motion (lockstep with ChartMotion.swift): animate.ts `drillScene` (bar drill), the bar-race
// follow (bar-chart.ts barKeys / lerpBar / barsDiffer / renderFollow), and the entrance clock every engine runs.

private const val DRILL_STAGGER = 0.3
private const val FOLLOW_MS = 260.0

/** animate.ts `drillScene`: every bar rises from the baseline at its final slot; `split` cascades left to right. */
fun chartDrillScene(scene: ChartScene, t: Double, split: Boolean): ChartScene {
    val tc = min(1.0, max(0.0, t))
    val maxDi = if (split) max(0, scene.bars.maxOfOrNull { it.dataIndex } ?: 0) else 0
    return scene.copy(bars = scene.bars.map { b ->
        val lag = if (split && maxDi > 0) (b.dataIndex.toDouble() / maxDi) * DRILL_STAGGER else 0.0
        val span = if (1 - lag == 0.0) 1.0 else 1 - lag
        chartGrowBar(b, chartEmphasizedDecelerate(min(1.0, max(0.0, (tc - lag) / span))), scene.barBaseline)
    })
}

/** bar-chart.ts `keyerFor`: identity by series + category when categories are unique, else by slot. */
fun chartBarKeyer(scene: ChartScene): (ChartSceneBar) -> String {
    val cats = scene.xValues.map { when (it) { is ChartAxisValue.Str -> it.v; is ChartAxisValue.Num -> jsNumberString(it.v); is ChartAxisValue.DateMs -> jsNumberString(it.ms) } }
    val unique = cats.isNotEmpty() && cats.toSet().size == cats.size
    return { b -> if (unique) "${b.seriesIndex}::${cats.getOrNull(b.dataIndex) ?: b.dataIndex.toString()}" else "${b.seriesIndex}#${b.dataIndex}" }
}

/** bar-chart.ts `barKeys`: occurrence-aware, so the pieces of a broken-axis bar keep distinct identities (`~n`). */
fun chartBarKeys(scene: ChartScene): List<String> {
    val base = chartBarKeyer(scene)
    val seen = HashMap<String, Int>()
    return scene.bars.map { b -> val k = base(b); val n = seen[k] ?: 0; seen[k] = n + 1; if (n == 0) k else "$k~$n" }
}

fun chartBarsByKey(scene: ChartScene): Map<String, ChartSceneBar> = chartBarKeys(scene).zip(scene.bars).toMap()

fun chartLerpBar(a: ChartSceneBar, b: ChartSceneBar, e: Double) =
    b.copy(x = a.x + (b.x - a.x) * e, y = a.y + (b.y - a.y) * e, w = a.w + (b.w - a.w) * e, h = a.h + (b.h - a.h) * e)

/** bar-chart.ts `barsDiffer` (looks each new bar up by its plain key, as the Web does). */
fun chartBarsDiffer(a: ChartScene, b: ChartScene): Boolean {
    if (a.bars.size != b.bars.size) return true
    val am = chartBarsByKey(a)
    val key = chartBarKeyer(b)
    for (nb in b.bars) {
        val ob = am[key(nb)] ?: return true
        if (abs(ob.x - nb.x) > 0.5 || abs(ob.y - nb.y) > 0.5 || abs(ob.w - nb.w) > 0.5 || abs(ob.h - nb.h) > 0.5) return true
    }
    return false
}

/** The bar-race follow: bars on screen ease a `dt / 260 ms` share of their gap toward the live target each frame. */
class ChartBarFollow {
    var displayed: Map<String, ChartSceneBar>? = null
    var active = false
    var last = 0.0

    fun step(target: ChartScene, rate: Double): List<ChartSceneBar> {
        val keys = chartBarKeys(target)
        val from = displayed ?: chartBarsByKey(target)
        val next = HashMap<String, ChartSceneBar>()
        val bars = ArrayList<ChartSceneBar>()
        var moving = false
        for ((k, b) in keys.zip(target.bars)) {
            val bar = from[k]?.let { chartLerpBar(it, b, rate) } ?: b
            next[k] = bar; bars += bar
            if (abs(bar.x - b.x) > 0.3 || abs(bar.y - b.y) > 0.3 || abs(bar.w - b.w) > 0.3 || abs(bar.h - b.h) > 0.3) moving = true
        }
        displayed = next
        active = moving
        return bars
    }

    fun frame(target: ChartScene, now: Double): List<ChartSceneBar> {
        val dt = if (last != 0.0) now - last else 16.0
        last = now
        return step(target, min(1.0, dt / FOLLOW_MS))
    }

    fun settle(target: ChartScene) { displayed = chartBarsByKey(target); active = false; last = 0.0 }
    fun reset() { displayed = null; active = false; last = 0.0 }
}

/** The entrance every engine plays on its first render with content (and on replay / legend toggle). */
class ChartIntro {
    var start: Double? = null
    var variant = "none"
    var duration = CHART_INTRO_MS
    var hasRendered = false
    /** The entrance's synchronous t = 0 paint (playIntro draws it before the loop starts) is still to be drawn. */
    var firstPaint = false

    /** Called on every render: arms the entrance on the first render that has geometry. */
    fun render(hasContent: Boolean, variant: String, duration: Double, reducedMotion: Boolean, now: Double, staggerSeries: Int) {
        val animate = !hasRendered && variant != "none" && !reducedMotion
        if (animate) {
            hasRendered = hasContent
            this.variant = variant
            this.duration = if (variant == "stagger") min(duration * max(1, staggerSeries), 5200.0) else duration
            start = now
            firstPaint = true
        } else {
            hasRendered = hasRendered || hasContent
            firstPaint = false
            start = null   // stopIntro: any other render ends a running entrance on its final frame
        }
    }

    fun replay() { hasRendered = false }

    /** The raw timeline progress, or null once settled. */
    fun progress(now: Double): Double? {
        val s = start ?: return null
        val t = (now - s) / duration
        if (t >= 1) { start = null; return null }
        return max(0.0, t)
    }
}
