package dev.awc.playground.charts

import android.graphics.Bitmap
import android.util.Log
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Canvas
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.graphics.drawscope.CanvasDrawScope
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.LayoutDirection
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import dev.awc.nativeui.charts.*
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min

/**
 * Chart entrance motion on the device against Chrome 153 (motion.json, motion-reduced-motion.json for line / area /
 * bar): each case is mounted on an AWC ChartController with a manual clock, settled, replayed, then stepped frame by frame
 * at Chrome's sample times; every frame's scene is drawn with the Compose renderer (chartDrawScene) into a 1x bitmap and
 * digested as the oracle page digests Chrome's canvas — per series colour (±28 per channel, alpha ≥ 200) the matching
 * pixel count, bounding box and the top / bottom match at each probe column — plus the canvas layer opacity.
 * Edge pixels blended between two series sit near the band edge, so each native measurement (count, each bound, each
 * probe column) is the interval its ±24, ±28 and ±32 digests span, and Chrome's ±28 value must fall inside it (widened by
 * max(24, 3 %, one-pixel ring) for counts, 1 px otherwise) — the SwiftUI NativeChartMotionIntegration rule. Report: files/accordion/chart-motion.txt (+ a few PNG frames).
 */
@RunWith(AndroidJUnit4::class)
class NativeChartMotionTest {
    private class Digest(val probes: Int) { var count = 0; var x0: Int? = null; var y0: Int? = null; var x1: Int? = null; var y1: Int? = null
        val top = arrayOfNulls<Int>(probes); val bottom = arrayOfNulls<Int>(probes) }

    private val bands = listOf(28, 24, 32)

    private fun raster(scene: ChartScene, w: Int, h: Int, targets: List<List<Int>>, probes: List<Int>, dump: File?): List<List<Digest>> {
        val bmp = ImageBitmap(w, h)
        CanvasDrawScope().draw(Density(1f), LayoutDirection.Ltr, Canvas(bmp), Size(w.toFloat(), h.toFloat())) { chartDrawScene(scene, 1f) }
        dump?.let { f -> f.outputStream().use { bmp.asAndroidBitmap().compress(Bitmap.CompressFormat.PNG, 100, it) } }
        val px = IntArray(w * h); bmp.readPixels(px)   // straight (un-premultiplied) ARGB, as getImageData
        val out = bands.map { targets.map { Digest(probes.size) } }
        for (y in 0 until h) for (x in 0 until w) {
            val c = px[y * w + x]; if ((c ushr 24) < 200) continue
            val r = (c shr 16) and 255; val g = (c shr 8) and 255; val b = c and 255
            for ((k, t) in targets.withIndex()) {
                val dist = maxOf(abs(r - t[0]), abs(g - t[1]), abs(b - t[2]))
                for ((n, band) in bands.withIndex()) if (dist <= band) {
                    val d = out[n][k]; d.count++
                    d.x0 = min(d.x0 ?: x, x); d.x1 = max(d.x1 ?: x, x); d.y0 = min(d.y0 ?: y, y); d.y1 = max(d.y1 ?: y, y)
                    val j = probes.indexOf(x); if (j >= 0) { if (d.top[j] == null) d.top[j] = y; d.bottom[j] = y }
                }
            }
        }
        return out
    }

    /** Targets whose colour lies within ±32 of an anti-aliased blend (coverage c, composited alpha ≥ 200) of another
     *  series' line over a third series' area fill it can cross (stacked: the area right above; unstacked: any) — the
     *  SwiftUI motionBlendAmbiguous rule. */
    @Suppress("UNCHECKED_CAST")
    private fun blendAmbiguous(keys: List<String>, targets: List<List<Int>>, areas: List<Map<String, Any?>>): Set<String> {
        val stacked = areas.any { a -> val y0 = (a["baselineY"] as? Number)?.toDouble() ?: return@any false
            (a["basePoints"] as? List<Map<String, Any?>>)?.any { abs(((it["y"] as? Number)?.toDouble() ?: y0) - y0) > 0.5 } ?: false }
        val fills = areas.mapNotNull { a ->
            val css = a["colorTop"] as? String ?: return@mapNotNull null; val si = (a["seriesIndex"] as? Number)?.toInt() ?: return@mapNotNull null
            val n = Regex("[0-9.]+").findAll(css).map { it.value.toDouble() }.toList()
            if (n.size >= 4) Triple(si, n.take(3), n[3]) else null
        }
        val out = HashSet<String>()
        for ((i, t) in targets.withIndex()) for ((j, a) in targets.withIndex()) { if (j == i) continue
            for ((si, fill, alpha) in fills) { if (si == i || si == j || (stacked && si != j + 1)) continue
                for (step in 0..100) {
                    val cov = step / 100.0; val al = cov + alpha * (1 - cov)
                    if (al * 255 < 200) continue
                    val col = (0..2).map { (cov * a[it] + (1 - cov) * alpha * fill[it]) / al }
                    if ((0..2).all { abs(col[it] - t[it]) <= 32 }) out += keys[i]
                }
            }
        }
        return out
    }

    @Suppress("UNCHECKED_CAST")
    private fun runCase(c: Map<String, Any?>, kind: String, reduced: Boolean, dumpDir: File?): List<String> {
        val tag = "md-$kind-chart"
        val (props, inline, inherited) = parse(c["html"] as String, tag)
        (c["props"] as? Map<String, Any?>)?.forEach { (k, v) -> props[k] = v }
        val toks = tokens(c["theme"] == "dark"); toks.putAll(inline)
        val fs = c["finalScene"] as Map<String, Any?>
        val w = (fs["width"] as Number).toInt(); val h = (fs["height"] as Number).toInt()
        val rtl = c["dir"] == "rtl"
        val targets = (c["targets"] as List<Map<String, Any?>>).map { t -> (t["rgb"] as List<Number>).map { it.toInt() } }
        val probes = (c["probes"] as List<Number>).map { Math.round(it.toDouble()).toInt() }
        val ambiguous = blendAmbiguous((c["targets"] as List<Map<String, Any?>>).map { it["key"] as String }, targets, fs["areas"] as? List<Map<String, Any?>> ?: emptyList())
        val density = ChartProps(props).num("density")?.takeIf { it in listOf(-1.0, -2.0, -3.0, -4.0) } ?: inherited
        val ctl = ChartController(ChartTestEnv.measurer)
        var clock = 0.0
        ctl.now = { clock }
        ctl.sync(ChartKind.of(tag), props, toks, density, ChartFormatters(), w.toDouble(), h.toDouble(), rtl, reduced)
        clock = 5000.0; ctl.frame(clock)                  // the first entrance (on mount) has finished
        val t0 = 10_000.0; clock = t0
        ctl.perform { ctl.activePlot?.replay() }          // engine.replay(): t = 0 paint, intro armed
        val name = c["name"] as String; val stem = name + if (reduced) "-rm" else ""
        val diffs = mutableListOf<String>()
        for (f in c["frames"] as List<Map<String, Any?>>) {
            val i = (f["i"] as Number).toInt(); val t = (f["t"] as Number).toDouble()
            clock = t0 + t
            // Frame -1 is the synchronous t = 0 paint of the replay (before the first animation frame), f0 the first rAF tick.
            val fr = ctl.frame(clock) ?: run { diffs += "f$i: no frame"; null } ?: continue
            val webAlpha = (f["canvasOpacity"] as? String)?.toDoubleOrNull() ?: 1.0
            if (abs(webAlpha - fr.alpha) > 0.002) diffs += "f$i t$t: opacity web $webAlpha native ${"%.4f".format(fr.alpha)}"
            val dump = dumpDir?.takeIf { i in setOf(0, 6, 12, 30, 60) }?.let { File(it, "$stem-f%03d.png".format(i)) }
            val mine = raster(fr.scene, w, h, targets, probes, dump)
            for ((k, wd) in (f["digest"] as List<Map<String, Any?>>).withIndex()) {
                if (k >= targets.size) break
                val key = wd["key"] as String
                val wc = (wd["count"] as Number).toInt()
                fun wi(n: String) = (wd[n] as? Number)?.toInt()
                val ring = wi("x1")?.let { x1 -> wi("x0")?.let { x1 - it + 1 } } ?: 0
                val tolCount = maxOf(24, (wc * 0.03).toInt(), ring + 2)
                // The native measurement is the interval spanned by the ±24 / ±28 / ±32 digests; Chrome's (±28) must fall inside it.
                val ms = mine.map { it[k] }; val m = ms[0]
                fun inside(wv: Int?, vals: List<Int?>, tol: Int, significant: Boolean): Boolean {
                    if (wv == null) return vals.any { it == null } || !significant
                    val v = vals.filterNotNull(); if (v.isEmpty()) return !significant
                    return wv >= v.min() - tol && wv <= v.max() + tol
                }
                val counts = ms.map { it.count }
                if (!inside(wc, counts, tolCount, true)) diffs += "f$i t$t $key: count web $wc native ${m.count} [${counts.min()}…${counts.max()}]"
                // A target that is not really there in either renderer (a stray anti-aliased pixel) has no meaningful bounds; a
                // target whose colour anti-aliased blends of two other series reproduce is checked by its count only.
                if (max(wc, m.count) <= tolCount || key in ambiguous) continue
                for ((n, get) in listOf<Pair<String, (Digest) -> Int?>>("x0" to { it.x0 }, "y0" to { it.y0 }, "x1" to { it.x1 }, "y1" to { it.y1 })) {
                    val wv = wi(n)
                    if (!inside(wv, ms.map(get), 1, true)) diffs += "f$i t$t $key $n web $wv native ${get(m)}"
                }
                for ((j, col) in (wd["cols"] as List<Map<String, Any?>>).withIndex()) {
                    if (j >= probes.size) break
                    val top = (col["top"] as? Number)?.toInt(); val bottom = (col["bottom"] as? Number)?.toInt()
                    if (!inside(top, ms.map { it.top[j] }, 1, true)) diffs += "f$i $key col$j top web ${top ?: "none"} native ${m.top[j] ?: "none"}"
                    if (!inside(bottom, ms.map { it.bottom[j] }, 1, true)) diffs += "f$i $key col$j bottom web ${bottom ?: "none"} native ${m.bottom[j] ?: "none"}"
                }
            }
        }
        if (dumpDir != null) ctl.frame(t0 + 1_000_000)?.let { raster(it.scene, w, h, emptyList(), emptyList(), File(dumpDir, "$stem-final.png")) }
        return diffs
    }

    @Suppress("UNCHECKED_CAST")
    @Test fun chartEntranceMotionMatchesChrome() {
        val files = File(InstrumentationRegistry.getInstrumentation().targetContext.getExternalFilesDir(null), "accordion").apply { mkdirs() }
        val dumpDir = File(files, "chart-motion").apply { mkdirs() }
        val dumpCases = setOf("area-intro-stagger", "area-intro-expressive", "area-intro-draw-rtl", "bar-intro-draw-rtl", "bar-intro-draw", "line-intro-expressive", "line-intro-draw")
        val log = StringBuilder(); var total = 0; var passed = 0
        for (kind in listOf("line", "area", "bar")) for (file in listOf("motion", "motion-reduced-motion")) {
            val root = chartParseJson(File(ChartTestEnv.root, "md-$kind-chart/$file.json").readText()) as Map<String, Any?>
            val cases = root["cases"] as List<Map<String, Any?>>
            var ok = 0
            for (c in cases) {
                val name = c["name"] as String
                val diffs = try { runCase(c, kind, file.contains("reduced"), dumpDir.takeIf { name in dumpCases }) } catch (e: Throwable) { listOf("EXC $e ${e.stackTrace.take(4).joinToString()}") }
                total++
                if (diffs.isEmpty()) { ok++; passed++ } else { log.append("FAIL $name ($file.json): ${diffs.size} frame differences\n"); diffs.take(8).forEach { log.append("   $it\n") } }
            }
            log.append("md-$kind-chart $file.json: $ok/${cases.size}\n")
            Log.i("AWCAccordion", "chart motion: md-$kind-chart $file.json: $ok/${cases.size}")
        }
        log.append("NativeChartMotion: $passed/$total runs within tolerance\n")
        Log.i("AWCAccordion", "chart motion: $passed/$total runs within tolerance")
        File(files, "chart-motion.txt").writeText(log.toString())
        assertTrue(log.lines().filter { it.startsWith("FAIL") || it.startsWith("   ") }.take(60).joinToString("\n"), passed == total)
    }
}
