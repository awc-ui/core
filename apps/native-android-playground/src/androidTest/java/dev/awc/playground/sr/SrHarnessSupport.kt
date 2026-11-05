// fa (2026-10-29): helpers shared by the md-slider / md-rating harnesses (from n5's generated harness and chart port).
package dev.awc.playground.sr

import kotlin.math.abs

@Suppress("UNCHECKED_CAST")
fun <T> Any?.cast(): T = this as T
fun num(v: Any?) = (v as Number).toDouble()

/** The Web token sheet (md3.css asset): :root, plus the dark block. */
fun tokens(dark: Boolean): MutableMap<String, String> {
    val css = SrEnv.text("md3.css")
    val out = LinkedHashMap<String, String>()
    fun block(sel: String) { val i = css.indexOf("$sel{").let { if (it < 0) css.indexOf("$sel {") else it }; if (i < 0) return; val body = css.substring(css.indexOf('{', i) + 1, css.indexOf('}', i))
        Regex("""(--[\w-]+)\s*:\s*([^;]+)""").findAll(body).forEach { out[it.groupValues[1]] = it.groupValues[2].trim() } }
    block(":root"); if (dark) block("[data-theme=dark]")
    return out
}

/** Minimal JSON reader for string-valued object/array properties (attribute form). */
fun srParseJson(text: String): Any? {
    var i = 0
    fun ws() { while (i < text.length && text[i].isWhitespace()) i++ }
    fun value(): Any? {
        ws()
        return when (val c = text[i]) {
            '{' -> { i++; val m = LinkedHashMap<String, Any?>(); ws(); if (text[i] == '}') { i++; m } else { while (true) { ws(); val k = value() as String; ws(); i++; m[k] = value(); ws(); if (text[i++] == '}') break }; m } }
            '[' -> { i++; val l = mutableListOf<Any?>(); ws(); if (text[i] == ']') { i++; l } else { while (true) { l.add(value()); ws(); if (text[i++] == ']') break }; l } }
            '"' -> { i++; val sb = StringBuilder(); while (text[i] != '"') { if (text[i] == '\\') { i++; when (text[i]) { 'n' -> sb.append('\n'); 't' -> sb.append('\t'); 'r' -> sb.append('\r'); 'b' -> sb.append('\b'); 'f' -> sb.append('\u000c'); 'u' -> { sb.append(text.substring(i + 1, i + 5).toInt(16).toChar()); i += 4 }; else -> sb.append(text[i]) } } else sb.append(text[i]); i++ }; i++; sb.toString() }
            't' -> { i += 4; true }
            'f' -> { i += 5; false }
            'n' -> { i += 4; null }
            else -> { val start = i; while (i < text.length && (text[i].isDigit() || text[i] in "+-.eE")) i++; text.substring(start, i).toDouble().also { if (c == ' ') Unit } }
        }
    }
    return value()
}
