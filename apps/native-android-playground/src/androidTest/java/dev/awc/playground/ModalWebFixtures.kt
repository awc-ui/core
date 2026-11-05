package dev.awc.playground

import android.graphics.BitmapFactory
import android.os.SystemClock
import android.view.KeyEvent
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.test.platform.app.InstrumentationRegistry
import dev.awc.nativeui.*
import org.json.JSONArray
import org.json.JSONObject
import kotlin.math.abs
import kotlin.math.max

/** Shared harness for the Chrome modal-family oracles (Dialog, Bottom Sheet, Side Sheet, stack). DPR 1 = density 1. */
internal object ModalWeb {
    fun document(name: String) = InstrumentationRegistry.getInstrumentation().context.assets.open(name).bufferedReader().use { JSONObject(it.readText()) }
    fun JSONArray.objects() = (0 until length()).map { getJSONObject(it) }
    fun JSONObject.opt2(k: String): Any? = if (has(k) && !isNull(k)) get(k) else null
    fun numbers(s: String) = Regex("-?[0-9.]+(?:e-?[0-9]+)?").findAll(s).map { it.value.toDouble() }.toList()
    fun JSONObject.toMap(): Map<String, AWCValue> = keys().asSequence().associateWith { k -> opt2(k).let { v -> if (v is JSONObject) v.toMap() else v } }
    /** `18px 8px / 12px 6px` (border-radius shorthand) → physical corner radii. */
    fun corners(css: String): AWCCornerShape {
        val halves = css.split("/").map { h -> h.trim().split(Regex("\\s+")).map { it.removeSuffix("px").toDouble() } }
        fun four(v: List<Double>) = when (v.size) { 1 -> List(4) { v[0] }; 2 -> listOf(v[0], v[1], v[0], v[1]); 3 -> listOf(v[0], v[1], v[2], v[1]); else -> v }
        val h = four(halves[0]); val v = if (halves.size > 1) four(halves[1]) else h
        fun r(i: Int) = AWCCornerRadius(AWCCornerLength(h[i]), AWCCornerLength(v[i]))
        return AWCCornerShape(r(0), r(1), r(2), r(3))
    }
    class Grid(val w: Int, val h: Int, val v: FloatArray) {
        fun at(x: Int, y: Int) = (0..2).map { v[(y * w + x) * 3 + it].toDouble() }
        fun flat(x: Int, y: Int, limit: Float): Boolean {
            if (x < 1 || y < 1 || x + 1 >= w || y + 1 >= h) return false
            for (c in 0..2) { var lo = 999f; var hi = -1f
                for (dy in -1..1) for (dx in -1..1) { val q = v[((y + dy) * w + x + dx) * 3 + c]; if (q < lo) lo = q; if (q > hi) hi = q }
                if (hi - lo > limit) return false }
            return true
        }
        fun diff(o: Grid, x: Int, y: Int): Float { val i = (y * w + x) * 3; return max(abs(v[i] - o.v[i]), max(abs(v[i + 1] - o.v[i + 1]), abs(v[i + 2] - o.v[i + 2]))) }
    }
    private fun grid(b: android.graphics.Bitmap, w: Int, h: Int): Grid {
        val v = FloatArray(w * h * 3) { -999f }
        val px = IntArray(b.width * b.height); b.getPixels(px, 0, b.width, 0, 0, b.width, b.height)
        for (y in 0 until minOf(h, b.height)) for (x in 0 until minOf(w, b.width)) { val p = px[y * b.width + x]; val o = (y * w + x) * 3
            v[o] = (p shr 16 and 255).toFloat(); v[o + 1] = (p shr 8 and 255).toFloat(); v[o + 2] = (p and 255).toFloat() }
        return Grid(w, h, v)
    }
    fun webGrid(path: String, w: Int, h: Int) = InstrumentationRegistry.getInstrumentation().context.assets.open(path).use { grid(BitmapFactory.decodeStream(it), w, h) }
    fun nativeGrid(image: ImageBitmap, w: Int, h: Int) = grid(image.asAndroidBitmap().copy(android.graphics.Bitmap.Config.ARGB_8888, false), w, h)
    /** Every flat CSS pixel (3×3 range ≤ 6 in both) except [skip]; one 8-bit level is compositing quantisation. */
    fun compare(web: Grid, nat: Grid, skip: (Int, Int) -> Boolean = { _, _ -> false }): JSONObject {
        var n = 0; var bad = 0; var sum = 0.0; var raw = 0.0; var worst = 0f; var at = ""
        for (y in 1 until web.h - 1) for (x in 1 until web.w - 1) {
            if (skip(x, y) || !web.flat(x, y, 6f) || !nat.flat(x, y, 6f)) continue
            val q = web.diff(nat, x, y); n++; sum += max(0f, q - 1); raw += q; if (q > 6) bad++
            if (q > worst) { worst = q; at = "($x,$y) web ${web.at(x, y).map { it.toInt() }} native ${nat.at(x, y).map { it.toInt() }}" }
        }
        return JSONObject().put("compared", n).put("meanBeyondOneLevel", sum / max(1, n)).put("mean", raw / max(1, n)).put("over6", bad).put("worst", worst.toDouble()).put("worstAt", at)
            .put("coverage", n.toDouble() / max(1, (web.w - 2) * (web.h - 2)))
    }
    fun ok(r: JSONObject) = r.getDouble("coverage") > .5 && r.getInt("over6").toDouble() / max(1, r.getInt("compared")) <= .005 && r.getDouble("meanBeyondOneLevel") <= 1.0
    private val dir get() = java.io.File(InstrumentationRegistry.getInstrumentation().targetContext.getExternalFilesDir(null), "modal").apply { mkdirs() }
    /** Window-level key events leave the device in keyboard (non-touch) mode; later suites expect touch mode. */
    fun restoreTouchMode() { runCatching { InstrumentationRegistry.getInstrumentation().setInTouchMode(true) } }
    fun log(name: String, json: JSONObject) { restoreTouchMode()
 android.util.Log.i("AWCModal", "$name ${json.toString().take(3000)}"); java.io.File(dir, "$name.json").writeText(json.toString(1)) }
    fun png(name: String, image: ImageBitmap) {
        val folder = java.io.File(dir, "png").apply { mkdirs() }
        java.io.FileOutputStream(java.io.File(folder, "$name.png")).use { image.asAndroidBitmap().compress(android.graphics.Bitmap.CompressFormat.PNG, 100, it) }
    }
    /** Trusted key input through the window (the path a hardware keyboard takes). */
    fun key(code: Int, shift: Boolean = false) {
        val inst = InstrumentationRegistry.getInstrumentation(); val t = SystemClock.uptimeMillis(); val meta = if (shift) KeyEvent.META_SHIFT_ON or KeyEvent.META_SHIFT_LEFT_ON else 0
        inst.sendKeySync(KeyEvent(t, t, KeyEvent.ACTION_DOWN, code, 0, meta))
        inst.sendKeySync(KeyEvent(t, t + 1, KeyEvent.ACTION_UP, code, 0, meta))
    }
}
