package dev.awc.nativeui.charts

import android.graphics.Paint
import android.graphics.Typeface
import android.icu.text.DateFormat
import android.icu.text.NumberFormat
import android.icu.util.ULocale
import java.math.BigDecimal
import java.util.Date
import java.util.concurrent.ConcurrentHashMap

/**
 * `Number.prototype.toLocaleString` / `Date.prototype.toLocaleString` with the Web defaults, on Android's ICU (the
 * same CLDR data a browser's Intl uses). Numbers: grouping on, 0–3 fraction digits, half-expand rounding; dates:
 * the `yMdjms` skeleton (`10/25/2026, 1:44:16 PM` in en-US) in the device time zone. An empty locale is the
 * device default, as `toLocaleString(undefined)` is the browser default.
 */
object ChartIntl {
    private val numberCache = ConcurrentHashMap<String, NumberFormat>()
    private val dateCache = ConcurrentHashMap<String, DateFormat>()

    private fun locale(tag: String): ULocale = if (tag.isEmpty()) ULocale.getDefault() else ULocale.forLanguageTag(tag)

    fun number(v: Double, locale: String, minFrac: Int = 0, maxFrac: Int = 3): String {
        if (v.isNaN()) return "NaN"
        if (v.isInfinite()) return if (v > 0) "∞" else "-∞"
        val f = numberCache.getOrPut("$locale|$minFrac|$maxFrac") {
            NumberFormat.getNumberInstance(locale(locale)).apply {
                minimumFractionDigits = minFrac; maximumFractionDigits = maxFrac
                roundingMode = BigDecimal.ROUND_HALF_UP
                isGroupingUsed = true
            }
        }
        // ICU formats are not thread-safe; the chart formats on the main thread, but stay safe.
        return synchronized(f) { f.format(v) }
    }

    fun date(ms: Double, locale: String): String {
        val f = dateCache.getOrPut(locale) { DateFormat.getInstanceForSkeleton("yMdjms", locale(locale)) }
        return synchronized(f) { f.format(Date(ms.toLong())) }
    }
}

/**
 * Legend chips, value ticks and labels measured with the bundled Roboto (weights 400 / 500 / 700; 600 draws as bold, as
 * the Web falls back). Measured at 2048 px — Roboto's units per em — and scaled: at that size FreeType's hinted advances
 * are whole font units, i.e. the unhinted advances Chrome lays out with (at the real size Paint returns whole pixels).
 */
class ChartPaintMeasurer(private val regular: Typeface, private val medium: Typeface, private val bold: Typeface) : ChartTextMeasurer {
    private val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply { isSubpixelText = true; isLinearText = true; textSize = EM }

    private fun face(weight: Double) = if (weight > 500) bold else if (weight > 400) medium else regular

    override fun width(text: String, size: Double, weight: Double): Double = synchronized(paint) {
        paint.typeface = face(weight)
        paint.measureText(text).toDouble() * size / EM
    }

    /** CSS `line-height: normal` for Roboto: (ascender + |descender|) / unitsPerEm = 2400 / 2048. */
    override fun normalLineHeight(size: Double, weight: Double) = size * 2400.0 / 2048.0

    private companion object { const val EM = 2048f }
}
