package dev.awc.nativeui.stepper

import android.graphics.Paint
import android.graphics.Typeface

/**
 * md-step text measured with the bundled Roboto (400 / 500 / 700; CSS weight 600 matches the bold face, as Chrome's font
 * matching picks it) at 2048 px — Roboto's units per em — and scaled: at that size the hinted advances are whole font
 * units, i.e. the unhinted advances Chrome lays out with. Letter spacing is added after every character, as CSS does.
 */
class StepperPaintMeasure(private val regular: Typeface, private val medium: Typeface, private val bold: Typeface) : StepperMeasure {
    private val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply { isSubpixelText = true; isLinearText = true; textSize = EM }
    private val cache = HashMap<String, Double>()
    fun face(weight: Double): Typeface = if (weight > 500) bold else if (weight > 400) medium else regular
    override fun width(text: String, size: Double, weight: Double, letterSpacing: Double): Double = synchronized(paint) {
        val key = "$size|$weight|$letterSpacing|$text"
        cache[key]?.let { return it }
        paint.typeface = face(weight)
        val w = paint.measureText(text).toDouble() * size / EM + letterSpacing * text.length
        if (cache.size > 512) cache.clear()
        cache[key] = w
        w
    }
    private companion object { const val EM = 2048f }
}
