package dev.awc.nativeui.charts

import java.util.Calendar
import java.util.TimeZone
import kotlin.math.abs
import kotlin.math.floor
import kotlin.math.ceil
import kotlin.math.log10
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow

// Port of packages/core/src/utils/charts/engine/scale.ts (axis scales, breaks and ticks).
// The same IEEE-754 operations in the same order as the Web engine, so scenes match to 0.01 px.

enum class ChartScaleType(val css: String) { CATEGORY("category"), TIME("time"), VALUE("value"), LOG("log");
    companion object { fun of(v: String?): ChartScaleType? = values().firstOrNull { it.css == v } } }

/** An axis value: the Web `string | number | Date` (a Date is epoch ms, used for time-axis ticks). */
sealed class ChartAxisValue {
    data class Num(val v: Double) : ChartAxisValue()
    data class Str(val v: String) : ChartAxisValue()
    data class DateMs(val ms: Double) : ChartAxisValue()
    val numberValue: Double? get() = (this as? Num)?.v
}

data class ChartDomain(val lo: Double, val hi: Double)

class ChartScale(
    val type: ChartScaleType, val size: Double, val domain: ChartDomain, val bandwidth: Double,
    val scale: (Double) -> Double, val invert: (Double) -> Double, val breaks: List<ChartScaleBreak> = emptyList(),
)

data class ChartBreakRange(var from: Double, var to: Double, var gap: Double)
data class ChartScaleBreak(val from: Double, val to: Double, val gap: Double, val px: Double)

/** JS Math.round: halves toward +∞. */
fun jsRound(v: Double): Double { val r = floor(v); return if (v - r >= 0.5) r + 1 else r }

/** JS `Number(string)`. */
fun jsNumber(raw: String): Double {
    val s = raw.trim()
    if (s.isEmpty()) return 0.0
    if (s == "Infinity" || s == "+Infinity") return Double.POSITIVE_INFINITY
    if (s == "-Infinity") return Double.NEGATIVE_INFINITY
    val lower = s.lowercase()
    if (lower.startsWith("0x")) return s.substring(2).toLongOrNull(16)?.toDouble() ?: Double.NaN
    if (lower.startsWith("0b")) return s.substring(2).toLongOrNull(2)?.toDouble() ?: Double.NaN
    if (lower.startsWith("0o")) return s.substring(2).toLongOrNull(8)?.toDouble() ?: Double.NaN
    if (!s.all { it in "0123456789+-.eE" }) return Double.NaN
    return s.toDoubleOrNull() ?: Double.NaN
}

private val isoPattern = Regex("""^([+-]\d{6}|\d{4})(?:-(\d{2})(?:-(\d{2}))?)?(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?)?(Z|[+-]\d{2}:?\d{2})?$""")

/** JS `Date.parse` for ISO strings (date-only → UTC, date-time without offset → local). */
fun jsDateParse(raw: String): Double {
    val s = raw.trim()
    val m = isoPattern.find(s) ?: return jsDateParseLoose(s)
    val g = m.groupValues
    val year = g[1].toIntOrNull() ?: return Double.NaN
    val month = g[2].ifEmpty { "1" }.toInt(); val day = g[3].ifEmpty { "1" }.toInt()
    val hasTime = g[4].isNotEmpty()
    if (month !in 1..12 || day !in 1..31) return Double.NaN
    val tz = when {
        g[8] == "Z" -> TimeZone.getTimeZone("UTC")
        g[8].isNotEmpty() -> { val sign = if (g[8].startsWith("-")) "-" else "+"; val d = g[8].drop(1).replace(":", ""); TimeZone.getTimeZone("GMT$sign${d.take(2)}:${d.takeLast(2)}") }
        !hasTime -> TimeZone.getTimeZone("UTC")
        else -> TimeZone.getDefault()
    }
    val cal = Calendar.getInstance(tz); cal.clear()
    cal.set(year, month - 1, day, g[4].ifEmpty { "0" }.toInt(), g[5].ifEmpty { "0" }.toInt(), g[6].ifEmpty { "0" }.toInt())
    val ms = if (g[7].isNotEmpty()) floor(("0." + g[7]).toDouble() * 1000) else 0.0
    return cal.timeInMillis.toDouble() + ms
}

private fun jsDateParseLoose(s: String): Double {
    for (fmt in listOf("yyyy/MM/dd", "yyyy/M/d", "MMM d, yyyy", "MMMM d, yyyy", "d MMM yyyy", "MM/dd/yyyy", "M/d/yyyy", "yyyy/MM/dd HH:mm", "yyyy/MM/dd HH:mm:ss", "MMM d, yyyy HH:mm")) {
        val f = java.text.SimpleDateFormat(fmt, java.util.Locale.US); f.isLenient = false
        val pos = java.text.ParsePosition(0)
        val d = f.parse(s, pos)
        if (d != null && pos.index == s.length) return d.time.toDouble()
    }
    return Double.NaN
}

fun chartToNumeric(value: ChartAxisValue, scale: ChartScaleType): Double {
    if (scale == ChartScaleType.CATEGORY) return value.numberValue ?: 0.0
    return when (value) {
        is ChartAxisValue.Num -> value.v
        is ChartAxisValue.DateMs -> value.ms
        is ChartAxisValue.Str -> {
            val asNum = jsNumber(value.v)
            if (!asNum.isNaN() && scale != ChartScaleType.TIME) asNum else jsDateParse(value.v).let { if (it.isNaN()) 0.0 else it }
        }
    }
}

fun makeLinearScale(domain: ChartDomain, size: Double, type: ChartScaleType = ChartScaleType.VALUE): ChartScale {
    var lo = domain.lo; var hi = domain.hi
    if (lo == hi) { lo -= 1; hi += 1 }
    val span = hi - lo; val l = lo
    return ChartScale(type, size, ChartDomain(lo, hi), 0.0, { v -> ((v - l) / span) * size }, { px -> l + (px / size) * span })
}

fun makeLogScale(domain: ChartDomain, size: Double): ChartScale {
    val positiveMax = if (domain.hi > 0) domain.hi else 1.0
    val safeMin = if (domain.lo > 0) domain.lo else max(positiveMax / 1e6, java.lang.Double.MIN_VALUE)
    val lo = log10(safeMin)
    val hi = log10(max(positiveMax, safeMin * 10))
    val s = hi - lo
    val span = if (s == 0.0 || s.isNaN()) 1.0 else s
    return ChartScale(ChartScaleType.LOG, size, ChartDomain(safeMin, 10.0.pow(hi)), 0.0,
        { v -> ((log10(if (v <= 0) safeMin else v) - lo) / span) * size }, { px -> 10.0.pow(lo + (px / size) * span) })
}

fun makeCategoryScale(count: Int, size: Double, alignWithLabel: Boolean = true): ChartScale {
    val n = max(count, 1).toDouble()
    val bandwidth = size / n
    val offset = if (alignWithLabel) bandwidth / 2 else 0.0
    return ChartScale(ChartScaleType.CATEGORY, size, ChartDomain(0.0, n - 1), bandwidth, { i -> offset + i * bandwidth }, { px -> jsRound((px - offset) / bandwidth) })
}

const val DEFAULT_BREAK_GAP = 14.0

fun normalizeBreaks(breaks: List<ChartBreakRange>, domain: ChartDomain): List<ChartBreakRange> {
    val lo = min(domain.lo, domain.hi); val hi = max(domain.lo, domain.hi)
    val clipped = breaks.map { ChartBreakRange(max(lo, min(it.from, it.to)), min(hi, max(it.from, it.to)), it.gap) }
        .filter { it.to > it.from && it.from > lo && it.to <= hi }.sortedBy { it.from }
    val merged = mutableListOf<ChartBreakRange>()
    for (b in clipped) {
        val last = merged.lastOrNull()
        if (last != null && b.from <= last.to) { last.to = max(last.to, b.to); last.gap = max(last.gap, b.gap) } else merged.add(b.copy())
    }
    return merged
}

fun openTopSection(ranges: List<ChartBreakRange>, domain: ChartDomain, scale: ChartScaleType): List<ChartBreakRange> {
    val out = ranges.map { it.copy() }
    if (out.isEmpty() || scale == ChartScaleType.LOG) return out
    val last = out.last()
    if (domain.hi - last.to > 1e-9) return out
    val belowFrom = if (out.size > 1) out[out.size - 2].to else domain.lo
    val belowRange = last.from - belowFrom
    if (!(belowRange > 0)) return out
    val t = niceLinearTicks(0.0, domain.hi, 6)
    val outlierStep = if (t.size > 1) t[1] - t[0] else 0.0
    val newTo = domain.hi - max(belowRange, outlierStep)
    if (newTo > last.from + 1e-9) last.to = newTo
    return out
}

fun autoBreaks(values: List<Double>, minGap: Double? = null, maxBreaks: Int? = null, gap: Double? = null): List<ChartBreakRange> {
    val mg = minGap ?: 8.0; val mb = maxBreaks ?: 2
    val sorted = LinkedHashSet(values.filter { it.isFinite() }).toList().sorted()
    if (sorted.size < 4) return emptyList()
    data class G(val from: Double, val to: Double, val size: Double)
    val gaps = (1 until sorted.size).map { G(sorted[it - 1], sorted[it], sorted[it] - sorted[it - 1]) }
    val sizes = gaps.map { it.size }.sorted()
    val median = sizes[sizes.size / 2]
    if (median <= 0) return emptyList()
    return gaps.filter { it.size >= median * mg }.sortedByDescending { it.size }.take(mb)
        .map { ChartBreakRange(it.from, it.to, gap ?: DEFAULT_BREAK_GAP) }.sortedBy { it.from }
}

fun makeBrokenScale(domain: ChartDomain, size: Double, type: ChartScaleType, breaks: List<ChartBreakRange>, sizing: String = "equal"): ChartScale {
    val base = if (type == ChartScaleType.LOG) makeLogScale(domain, size) else makeLinearScale(domain, size, type)
    val ranges = normalizeBreaks(breaks, base.domain)
    if (ranges.isEmpty()) return base
    data class Cut(val from: Double, val to: Double, val gap: Double, val fromPx: Double, val toPx: Double)
    val cuts = ranges.map { Cut(it.from, it.to, it.gap, base.scale(it.from), base.scale(it.to)) }
    val gaps = cuts.sumOf { it.gap }
    val spans = mutableListOf<Pair<Double, Double>>()
    var cursor = 0.0
    for (c in cuts) { spans.add(cursor to c.fromPx); cursor = c.toPx }
    spans.add(cursor to size)
    val usable = max(0.0, size - gaps)
    val totalSpan = spans.fold(0.0) { a, s -> a + max(0.0, s.second - s.first) }
    data class Sec(val from: Double, val to: Double, val width: Double, val out: Double, val outStart: Double)
    val placed = mutableListOf<Sec>()
    var outCursor = 0.0
    spans.forEachIndexed { i, s ->
        val width = max(0.0, s.second - s.first)
        val out = if (sizing == "equal") usable / spans.size else if (totalSpan > 0) (width / totalSpan) * usable else usable / spans.size
        val start = outCursor
        outCursor += out + (if (i < cuts.size) cuts[i].gap else 0.0)
        placed.add(Sec(s.first, s.second, width, out, start))
    }
    val scaleBreaks = cuts.mapIndexed { i, c -> ChartScaleBreak(c.from, c.to, c.gap, placed[i].outStart + placed[i].out) }
    return ChartScale(type, size, base.domain, 0.0, { v ->
        val px = base.scale(v)
        var result = size
        for (i in placed.indices) {
            val sec = placed[i]
            if (px <= sec.to || i == placed.size - 1) {
                result = if (px < sec.from) (if (i > 0) placed[i - 1].outStart + placed[i - 1].out else sec.outStart)
                else sec.outStart + (if (sec.width > 0) (px - sec.from) / sec.width else 1.0) * sec.out
                break
            }
        }
        result
    }, { px ->
        var result = base.domain.hi
        for (i in placed.indices) {
            val sec = placed[i]
            if (px <= sec.outStart + sec.out || i == placed.size - 1) {
                val t = if (sec.out > 0) (max(px, sec.outStart) - sec.outStart) / sec.out else 0.0
                result = base.invert(sec.from + t * sec.width); break
            }
        }
        result
    }, scaleBreaks)
}

/** `MdChartAxisBreaks`: an array of ranges, "auto", or an options object. */
data class ChartAxisBreaks(
    val ranges: List<Triple<ChartAxisValue, ChartAxisValue, Double?>> = emptyList(), val auto: Boolean = false,
    val minGap: Double? = null, val maxBreaks: Int? = null, val gap: Double? = null, val sizing: String? = null,
)

fun resolveAxisBreaks(breaks: ChartAxisBreaks?, values: List<Double>, scale: ChartScaleType): Pair<List<ChartBreakRange>, String> {
    if (breaks == null) return emptyList<ChartBreakRange>() to "equal"
    val gap = breaks.gap ?: DEFAULT_BREAK_GAP
    val explicit = breaks.ranges.map { ChartBreakRange(chartToNumeric(it.first, scale), chartToNumeric(it.second, scale), it.third ?: gap) }
    val found = if (breaks.auto) autoBreaks(values, breaks.minGap, breaks.maxBreaks, gap) else emptyList()
    return (explicit + found) to (breaks.sizing ?: "equal")
}

fun sectionedTicks(domain: ChartDomain, breaks: List<ChartBreakRange>, scale: ChartScaleType, target: Int = 6): List<Double> {
    fun ticksFor(lo: Double, hi: Double, n: Int) = when (scale) { ChartScaleType.LOG -> logTicks(lo, hi); ChartScaleType.TIME -> timeTicks(lo, hi, n); else -> niceLinearTicks(lo, hi, n) }
    val ranges = normalizeBreaks(breaks, domain)
    if (ranges.isEmpty()) return ticksFor(domain.lo, domain.hi, target)
    val sections = mutableListOf<Pair<Double, Double>>()
    var cursor = domain.lo
    for (b in ranges) { sections.add(cursor to b.from); cursor = b.to }
    sections.add(cursor to domain.hi)
    val per = max(3, jsRound(target.toDouble() / sections.size).toInt())
    val out = mutableListOf<Double>()
    for ((lo, hi) in sections) {
        if (hi <= lo) continue
        var ticks = emptyList<Double>()
        for (n in listOf(per, per * 2, per * 4)) {
            ticks = ticksFor(lo, hi, n).filter { it >= lo - 1e-9 && it <= hi + 1e-9 }
            if (ticks.size >= 3 || scale == ChartScaleType.LOG) break
        }
        out.addAll(ticks)
    }
    return LinkedHashSet(out).toList().sorted()
}

fun inBreak(breaks: List<ChartBreakRange>, v: Double) = breaks.any { v > it.from && v < it.to }

fun niceLinearTicks(minV: Double, maxV: Double, target: Int = 6): List<Double> {
    val lo = min(minV, maxV); val hi = max(minV, maxV)
    if (lo == hi) return listOf(lo)
    val step = niceNum((hi - lo) / max(target - 1, 1), true)
    val niceMin = floor(lo / step) * step
    val niceMax = ceil(hi / step) * step
    val maxTicks = jsRound((niceMax - niceMin) / step).toInt() + 1
    val ticks = (0 until max(0, maxTicks)).map { val v = niceMin + it * step; if (abs(v) < step / 1e6) 0.0 else v }
    return ticks.filter { it >= lo - step / 1e6 && it <= hi + step / 1e6 }
}

private fun niceNum(range: Double, round: Boolean): Double {
    val exp = floor(log10(range))
    val frac = range / 10.0.pow(exp)
    val nice = if (round) (if (frac < 1.5) 1.0 else if (frac < 3) 2.0 else if (frac < 7) 5.0 else 10.0)
    else (if (frac <= 1) 1.0 else if (frac <= 2) 2.0 else if (frac <= 5) 5.0 else 10.0)
    return nice * 10.0.pow(exp)
}

fun logTicks(minV: Double, maxV: Double): List<Double> {
    val lo = floor(log10(if (minV > 0) minV else maxV / 1e6)).toInt()
    val hi = ceil(log10(maxV)).toInt()
    return (lo..hi).map { 10.0.pow(it) }.filter { it >= minV && it <= maxV }
}

fun timeTicks(minMs: Double, maxMs: Double, target: Int = 6): List<Double> {
    val span = maxMs - minMs
    if (span <= 0) return listOf(minMs)
    val S = 1000.0; val M = 60 * S; val H = 60 * M; val D = 24 * H
    val steps = listOf(S, 5 * S, 15 * S, 30 * S, M, 5 * M, 15 * M, 30 * M, H, 3 * H, 6 * H, 12 * H, D, 2 * D, 7 * D, 14 * D, 30 * D, 90 * D, 180 * D, 365 * D)
    val ideal = span / max(target - 1, 1)
    val idx = steps.indexOfFirst { it >= ideal }
    var step = if (idx == -1) steps.last() else steps[idx]
    if (idx > 0) { val finer = steps[idx - 1]; if (span / finer <= max(target - 1, 1) * 1.4) step = finer }
    val ticks = mutableListOf<Double>()
    var t = ceil(minMs / step) * step
    while (t <= maxMs) { ticks.add(t); t += step }
    return ticks
}

fun computeDomain(values: List<Double>, min: Double? = null, max: Double? = null, scale: ChartScaleType = ChartScaleType.VALUE, includeZero: Boolean = false): ChartDomain {
    val isLog = scale == ChartScaleType.LOG
    var dataLo = Double.POSITIVE_INFINITY; var dataHi = Double.NEGATIVE_INFINITY; var hasFinite = false
    for (v in values) {
        if (!v.isFinite()) continue
        if (isLog && v <= 0) continue
        hasFinite = true
        if (v < dataLo) dataLo = v
        if (v > dataHi) dataHi = v
    }
    if (!hasFinite) { dataLo = if (isLog) 1.0 else 0.0; dataHi = if (isLog) 10.0 else 1.0 }
    val loExplicit = min != null && min.isFinite(); val hiExplicit = max != null && max.isFinite()
    var lo = if (loExplicit) min!! else dataLo
    var hi = if (hiExplicit) max!! else dataHi
    if (isLog) {
        if (!loExplicit && lo > 0) lo = 10.0.pow(floor(log10(lo)))
        if (!hiExplicit && hi > 0) hi = 10.0.pow(ceil(log10(hi)))
        if (lo == hi) { lo /= 10; hi *= 10 }
        return ChartDomain(lo, hi)
    }
    if (includeZero) { if (!loExplicit && lo > 0) lo = 0.0; if (!hiExplicit && hi < 0) hi = 0.0 }
    if (lo == hi) { lo -= 1; hi += 1 }
    return ChartDomain(lo, hi)
}
