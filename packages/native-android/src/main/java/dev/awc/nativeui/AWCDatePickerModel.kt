package dev.awc.nativeui

import android.icu.text.DateFormat
import android.icu.text.DateFormatSymbols
import android.icu.text.DateTimePatternGenerator
import android.icu.util.Calendar
import android.icu.util.GregorianCalendar
import android.icu.util.TimeZone
import android.icu.util.ULocale

// md-date-picker model: a port of the source's date-utils.ts (the same as AWCUI's DatePickerModel.swift). Days are civil
// dates (no time zone); locale data comes from Android's ICU (CLDR), the source Chrome's Intl reads.

/** A calendar day (proleptic Gregorian, no time zone); month 1…12. */
data class AWCDay(val year: Int, val month: Int, val day: Int) : Comparable<AWCDay> {
    override fun compareTo(other: AWCDay) = compareValuesBy(this, other, { it.year }, { it.month }, { it.day })
    val iso: String get() = "%04d-%02d-%02d".format(java.util.Locale.ROOT, year, month, day)
    override fun toString() = iso
    /** Days since 1970-01-01. */
    val ordinal: Int get() {
        val y = if (month <= 2) year - 1 else year; val era = (if (y >= 0) y else y - 399) / 400; val yoe = y - era * 400
        val doy = (153 * (month + (if (month > 2) -3 else 9)) + 2) / 5 + day - 1; val doe = yoe * 365 + yoe / 4 - yoe / 100 + doy
        return era * 146097 + doe - 719468
    }
    /** 0 = Sunday … 6 = Saturday. */
    val weekday: Int get() = ((ordinal % 7) + 11) % 7
    fun plusDays(n: Int) = ofOrdinal(ordinal + n)
    /** `addMonths`: the same day clamped to the target month's length. */
    fun plusMonths(n: Int): AWCDay {
        val total = year * 12 + (month - 1) + n; val y = Math.floorDiv(total, 12); val m = total - y * 12 + 1
        return AWCDay(y, m, minOf(day, daysIn(y, m)))
    }
    companion object {
        fun daysIn(year: Int, month: Int) = when (month) { 2 -> if ((year % 4 == 0 && year % 100 != 0) || year % 400 == 0) 29 else 28; 4, 6, 9, 11 -> 30; else -> 31 }
        fun valid(y: Int, m: Int, d: Int): AWCDay? = if (m in 1..12 && d >= 1 && d <= daysIn(y, m)) AWCDay(y, m, d) else null
        /** Strict ISO `YYYY-MM-DD`. */
        fun iso(text: String?): AWCDay? {
            val p = (text ?: "").trim().split("-")
            if (p.size != 3 || p[0].length != 4 || p[1].length != 2 || p[2].length != 2 || p.any { s -> s.any { it !in '0'..'9' } }) return null
            return valid(p[0].toInt(), p[1].toInt(), p[2].toInt())
        }
        fun ofOrdinal(z0: Int): AWCDay {
            val z = z0 + 719468; val era = (if (z >= 0) z else z - 146096) / 146097; val doe = z - era * 146097
            val yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365; val doy = doe - (365 * yoe + yoe / 4 - yoe / 100); val mp = (5 * doy + 2) / 153
            val d = doy - (153 * mp + 2) / 5 + 1; val m = if (mp < 10) mp + 3 else mp - 9
            return AWCDay(yoe + era * 400 + (if (m <= 2) 1 else 0), m, d)
        }
        fun today(): AWCDay { val c = java.util.Calendar.getInstance(); return AWCDay(c.get(java.util.Calendar.YEAR), c.get(java.util.Calendar.MONTH) + 1, c.get(java.util.Calendar.DAY_OF_MONTH)) }
    }
}
data class AWCDayCell(val day: AWCDay, val outOfMonth: Boolean)

/** Locale-dependent formatting (Intl.DateTimeFormat equivalents over ICU). Empty identifier = the device locale. */
class AWCDateLocale(identifier: String) {
    val locale: ULocale = if (identifier.isBlank()) ULocale.getDefault() else ULocale.forLanguageTag(identifier.trim())
    /** Chrome 153's patterns where its bundled ICU / CLDR differs from the platform's (decision 8). */
    private val chromePatterns = mapOf("de" to mapOf("MMMEd" to "EEE, d. MMM"), "ja" to mapOf("yMMMMEEEEd" to "y年M月d日EEEE"),
        "ar" to mapOf("MMMEd" to "EEEE، d MMM", "yMMMMEEEEd" to "EEEE، d MMMM y"))
    private fun bestPattern(skeleton: String): String = chromePatterns[locale.language]?.get(skeleton)
        ?: DateTimePatternGenerator.getInstance(locale).getBestPattern(skeleton)
    private fun formatter(skeleton: String): DateFormat {
        val f = android.icu.text.SimpleDateFormat(bestPattern(skeleton), locale); f.calendar = GregorianCalendar(TimeZone.getTimeZone("UTC"), locale); return f
    }
    private fun date(d: AWCDay) = java.util.Date(d.ordinal * 86_400_000L + 43_200_000L)
    /** A day formatted with an ICU skeleton ("MMMEd" headline, "yMMMM" month header, "yMMMMEEEEd" a cell's full name). */
    fun format(d: AWCDay, skeleton: String): String = formatter(skeleton).format(date(d))
    private data class Part(val kind: Char, val literal: String = "")
    /** The numeric date pattern's fields and literals ({year:'numeric', month:'2-digit', day:'2-digit'}). */
    private val numericParts: List<Part> by lazy {
        val out = mutableListOf<Part>(); var literal = StringBuilder(); var quoted = false; var last: Char? = null
        for (ch in bestPattern("yyyyMMdd")) {
            if (ch == '\'') { quoted = !quoted; continue }
            if (!quoted && ch in "yMd") { if (literal.isNotEmpty()) { out += Part('l', literal.toString()); literal = StringBuilder() }; if (last != ch) out += Part(ch); last = ch }
            else { literal.append(ch); last = null }
        }
        if (literal.isNotEmpty()) out += Part('l', literal.toString()); out
    }
    fun separator(explicit: String = ""): String = explicit.ifEmpty { numericParts.firstOrNull { it.kind == 'l' }?.literal ?: "/" }
    /** `formatDisplayDate`: two-digit day / month, full year (ASCII digits) in locale order. */
    fun display(d: AWCDay, separator: String = ""): String { val sep = separator(separator)
        return numericParts.joinToString("") { when (it.kind) { 'd' -> "%02d".format(java.util.Locale.ROOT, d.day); 'M' -> "%02d".format(java.util.Locale.ROOT, d.month); 'y' -> d.year.toString(); else -> sep } } }
    /** `dateFormatPattern`: MM/DD/YYYY, DD.MM.YYYY … */
    fun pattern(separator: String = ""): String { val sep = separator(separator)
        return numericParts.joinToString("") { when (it.kind) { 'd' -> "DD"; 'M' -> "MM"; 'y' -> "YYYY"; else -> sep } } }
    val dayFirst: Boolean get() { val k = numericParts.map { it.kind }; val d = k.indexOf('d'); val m = k.indexOf('M'); return d >= 0 && m >= 0 && d < m }
    /** `getFirstDayOfWeek` (0 = Sunday). */
    val firstDayOfWeek: Int get() = (Calendar.getInstance(locale).firstDayOfWeek - 1 + 7) % 7
    /** `weekdayNames(locale, first, style)`: format-context narrow / short / long names from `first`. */
    fun weekdays(first: Int, style: String = "narrow"): List<String> {
        val s = DateFormatSymbols.getInstance(locale)
        val all = s.getWeekdays(DateFormatSymbols.FORMAT, when (style) { "long" -> DateFormatSymbols.WIDE; "short" -> DateFormatSymbols.ABBREVIATED; else -> DateFormatSymbols.NARROW })
        return (0 until 7).map { all[1 + (first + it) % 7] }
    }
}

/** md-date-picker's calendar arithmetic (date-utils.ts). */
object AWCDatePickerModel {
    fun monthMatrix(year: Int, month: Int, firstDayOfWeek: Int): List<AWCDayCell> {
        val first = AWCDay(year, month, 1); val lead = (first.weekday - firstDayOfWeek + 7) % 7; val start = first.plusDays(-lead)
        return (0 until 42).map { val d = start.plusDays(it); AWCDayCell(d, d.month != month) }
    }
    fun outOfRange(d: AWCDay, min: String, max: String) = (min.isNotEmpty() && min > d.iso) || (max.isNotEmpty() && d.iso > max)
    fun clamp(d: AWCDay, min: String, max: String): AWCDay = when {
        min.isNotEmpty() && min > d.iso -> AWCDay.iso(min) ?: d
        max.isNotEmpty() && d.iso > max -> AWCDay.iso(max) ?: d
        else -> d
    }
    /** `parseFlexibleDateInput`. */
    fun parse(value: String, locale: AWCDateLocale, separator: String = ""): AWCDay? {
        val t = value.trim(); if (t.isEmpty()) return null
        AWCDay.iso(t)?.let { return it }
        if (t.all { it in '0'..'9' }) return compact(t, locale.dayFirst)
        val parts = (if (separator.isNotEmpty()) t.split(separator) else t.split(Regex("[/\\-.]|\\s+"))).filter { it.isNotEmpty() }
        if (parts.size != 3) return null
        val n = parts.map { p -> p.trimStart().trimStart('+').takeWhile { it in '0'..'9' }.takeIf { it.isNotEmpty() }?.toInt() ?: return null }
        if (parts[0].length == 4 || n[0] > 31) return AWCDay.valid(n[0], n[1], n[2])
        if (!(parts[2].length == 4 || n[2] > 31)) return null
        if (n[0] > 12 && n[1] <= 12) return AWCDay.valid(n[2], n[1], n[0])
        if (n[1] > 12 && n[0] <= 12) return AWCDay.valid(n[2], n[0], n[1])
        return if (locale.dayFirst) AWCDay.valid(n[2], n[1], n[0]) else AWCDay.valid(n[2], n[0], n[1])
    }
    private fun compact(s: String, dayFirst: Boolean): AWCDay? {
        fun num(a: Int, b: Int) = s.substring(a, b).toInt()
        if (s.length == 8) {
            val a = num(0, 2); val b = num(2, 4); val year = num(4, 8)
            return when { a > 12 && b <= 12 -> AWCDay.valid(year, b, a); b > 12 && a <= 12 -> AWCDay.valid(year, a, b); a > 12 && b > 12 -> null
                dayFirst -> AWCDay.valid(year, b, a); else -> AWCDay.valid(year, a, b) }
        }
        if (s.length != 7) return null
        val year = num(3, 7)
        val ok = listOf("MDD" to AWCDay.valid(year, num(0, 1), num(1, 3)), "DDM" to AWCDay.valid(year, num(2, 3), num(0, 2)), "MMD" to AWCDay.valid(year, num(0, 2), num(2, 3)))
            .filter { it.second != null }
        if (ok.isEmpty()) return null
        if (ok.size == 1) return ok[0].second
        if (num(0, 1) in 1..9 && num(1, 3) >= 10) ok.firstOrNull { it.first == "MDD" }?.let { return it.second }
        if (num(0, 2) > 12) ok.firstOrNull { it.first == "DDM" }?.let { return it.second }
        if (num(0, 2) > 12) ok.firstOrNull { it.first == "MMD" }?.let { return it.second }
        val preferred = if (dayFirst) "DDM" else "MMD"
        return (ok.firstOrNull { it.first == preferred } ?: ok[0]).second
    }
}
