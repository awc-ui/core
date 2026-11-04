package dev.awc.nativeui

/** Disclosure and effects have separate clocks; bounded effects finish before
 * the spatial spring. Units are milliseconds, never device-frame counts. */
internal class NativeAccordionMotion(
    val preset:String="expressive",val opening:Boolean,expandDuration:Double?=null,collapseDuration:Double?=null,
    reduced:Boolean=false,emphasized:List<Double> = listOf(.2,0.0,0.0,1.0),standard:List<Double> = listOf(.2,0.0,0.0,1.0),
    spatial:List<Double> = listOf(.38,1.21,.22,1.0),effects:List<Double> = listOf(.34,.8,.34,1.0),effectsLimit:Double=200.0,
) {
    val reduced=reduced || preset=="none"
    val duration:Double
    val effectsDuration:Double
    val geometryCurve:List<Double>
    val spatialCurve:List<Double>
    val effectsCurve:List<Double>
    data class Frame(val height:Double,val contentClip:Double,val opacity:Double,val shape:Double,val spatial:Double,val effects:Double) {
        val chevronRadians get()=Math.PI*spatial
        val leadingScale get()=1+.05*spatial
    }
    init {
        val fallback=when(preset) { "standard","collapse"->300.0;"fade"->if(opening) 300.0 else 200.0;else->if(opening) 350.0 else 250.0 }
        val override=if(opening) expandDuration else collapseDuration
        duration=if(this.reduced) 0.0 else override?.takeIf { it.isFinite() && it>=0 } ?: fallback
        effectsDuration=minOf(duration,effectsLimit.takeIf { it.isFinite() && it>=0 } ?: 200.0)
        fun curve(candidate:List<Double>,fallback:List<Double>)=candidate.takeIf { it.size==4 && it.all(Double::isFinite) && it[0] in 0.0..1.0 && it[2] in 0.0..1.0 } ?: fallback
        val emphasized=curve(emphasized,listOf(.2,0.0,0.0,1.0));val standard=curve(standard,listOf(.2,0.0,0.0,1.0))
        geometryCurve=when(preset) { "collapse"->if(opening) listOf(0.0,0.0,.2,1.0) else listOf(.4,0.0,1.0,1.0);"fade"->standard;else->emphasized }
        spatialCurve=when(preset) { "collapse"->listOf(0.0,0.0,.2,1.0);"standard"->emphasized;"fade"->standard;else->curve(spatial,listOf(.38,1.21,.22,1.0)) }
        effectsCurve=curve(effects,listOf(.34,.8,.34,1.0))
    }
    fun frame(elapsedMilliseconds:Double)=fractions(if(duration==0.0) 1.0 else elapsedMilliseconds/duration,if(effectsDuration==0.0) 1.0 else elapsedMilliseconds/effectsDuration)
    /** Web reference samples each transition at its own duration fraction. */
    fun fractions(disclosure:Double,effects:Double):Frame {
        fun progress(fraction:Double,curve:List<Double>):Double {
            val t=if(reduced || duration==0.0) 1.0 else (fraction.takeIf(Double::isFinite) ?: 0.0).coerceIn(0.0,1.0)
            val e=LoadingIndicatorMotion.ease(t,curve[0],curve[1],curve[2],curve[3])
            return if(opening) e else 1-e
        }
        val height=progress(disclosure,geometryCurve).coerceIn(0.0,1.0)
        val effect=progress(if(effectsDuration==0.0) 1.0 else effects,effectsCurve).coerceIn(0.0,1.0)
        // Auto-height grid and the sub-unit fr track each contribute the reveal
        // factor. Retain full-size content behind that squared clip boundary.
        return Frame(height,height*height,if(preset=="collapse") 1.0 else effect,height,progress(disclosure,spatialCurve),effect)
    }
}
