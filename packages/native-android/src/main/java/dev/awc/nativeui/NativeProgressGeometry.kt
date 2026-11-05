package dev.awc.nativeui

import java.util.Locale
import kotlin.math.*

/** Source geometry remains Double until native layout/paint applies its limits. */
internal data class ProgressMetrics(
    val circular:Boolean,val wave:Boolean,val indeterminate:Boolean,val fourColor:Boolean,val complete:Boolean,
    val fraction:Double,val maximum:Double,val value:Double,val label:String,val hidden:Boolean,
    val thickness:Double,val amplitude:Double,val wavelength:Double,val speed:Double,val size:Double,
    val gap:Double,val stopSize:Double,val trailing:Double,
) {
    val height:Double get()=if(circular) size else max(0.0,if(wave) 2*amplitude+thickness else thickness)
    val radius:Double get()=max(.5,(size-thickness)/2-if(wave) amplitude else 0.0)
    val vertices:Int get()=max(5,(2*PI*radius/wavelength).coerceIn(0.0,8192.0).roundToInt())
    // A negative SVG stroke width is invalid and falls back to SVG's initial1.
    val stroke:Double get()=if(thickness<0) 1.0 else thickness
    val linearThickness:Double get()=if(thickness<0) height else thickness
    companion object {
        fun from(p:Props,a:AWCProgressIndicatorAppearance,inherited:Double):ProgressMetrics {
            fun number(key:String,default:Double)=(p[key] as? Number)?.toDouble()?.takeIf { it.isFinite() } ?: default
            val circular=p.str("variant","linear")=="circular";val wave=p.bool("wave")
            val density=resolveAWCDensity(p["density"],inherited)
            val rawThickness=number("thickness",4.0)
            val thickness=if(rawThickness==4.0) max(2.0,4+density*.5) else rawThickness
            val size=(number("size",0.0).takeIf { it>0 } ?: ((if(wave) 48.0 else 40.0)+density*3)).coerceIn(24.0,240.0)
            val maxValue=number("max",100.0);val rawValue=number("value",0.0)
            val fraction=if(maxValue==0.0) 0.0 else (rawValue/maxValue).coerceIn(0.0,1.0)
            val maximum=max(0.0,maxValue);val current=rawValue.coerceIn(0.0,maximum)
            val wavelength=number("waveLength",0.0).takeIf { it>0 } ?: if(circular) 15.0 else 40.0
            val defaultSize=max(2.0,4+density*.5)
            return ProgressMetrics(circular,wave,p.bool("indeterminate"),p.bool("fourColor"),p.bool("complete"),
                fraction,maximum,current,p.str("label","Progress"),p.bool("hidden"),thickness,
                number("waveAmplitude",0.0).takeIf { it>0 } ?: if(circular) 1.6 else 3.0,wavelength,
                number("waveSpeed",0.0).takeIf { it>0 } ?: wavelength,size,
                a.trackActiveIndicatorSpace ?: defaultSize,a.stopIndicatorSize ?: defaultSize,a.stopIndicatorTrailingSpace ?: 0.0)
        }
    }
}

/** Native construction of the source Catmull–Rom curves, not a bitmap or WebView. */
internal object ProgressGeometry {
    private fun n(v:Double)=String.format(Locale.ROOT,"%.2f",if(v.isFinite()) v else 0.0)
    fun ease(x:Double,x1:Double=.2,y1:Double=0.0,x2:Double=0.0,y2:Double=1.0):Double {
        if(x<=0) return 0.0
        if(x>=1) return 1.0
        val cx=3*x1;val bx=3*(x2-x1)-cx;val ax=1-cx-bx
        val cy=3*y1;val by=3*(y2-y1)-cy;val ay=1-cy-by
        var t=x
        for(i in 0..7) {
            val delta=((ax*t+bx)*t+cx)*t-x;val slope=(3*ax*t+2*bx)*t+cx
            if(abs(delta)<1e-5 || abs(slope)<1e-6) break
            t-=delta/slope
        }
        t=t.coerceIn(0.0,1.0);return ((ay*t+by)*t+cy)*t
    }
    private fun catmull(points:List<Pair<Double,Double>>):String {
        if(points.size<2) return ""
        return buildString {
            append("M ${n(points[0].first)} ${n(points[0].second)}")
            for(i in 0 until points.lastIndex) {
                val p0=points[max(0,i-1)];val p1=points[i];val p2=points[i+1];val p3=points[min(points.lastIndex,i+2)]
                append(" C ${n(p1.first+(p2.first-p0.first)/6)} ${n(p1.second+(p2.second-p0.second)/6)}")
                append(" ${n(p2.first-(p3.first-p1.first)/6)} ${n(p2.second-(p3.second-p1.second)/6)} ${n(p2.first)} ${n(p2.second)}")
            }
        }
    }
    fun linear(m:ProgressMetrics,start:Double,end:Double,amp:Double,phase:Double,inset:Boolean):String {
        if(end<=start) return ""
        val cy=(2*m.amplitude+m.thickness)/2;val r=m.thickness/2
        val a=if(inset) start+r else start;val b=if(inset) end-r else end
        val amplitude=amp*m.amplitude*min(1.0,max(0.0,b-a)/m.wavelength)
        if(inset && b<=a) {
            val cx=(start+end)/2;val rr=(end-start)/2
            return "M ${n(cx-rr)} ${n(cy)} a ${n(rr)} ${n(rr)} 0 1 0 ${n(2*rr)} 0 a ${n(rr)} ${n(rr)} 0 1 0 ${n(-2*rr)} 0 Z"
        }
        val steps=max(8,((b-a)/m.wavelength*8).coerceIn(0.0,65536.0).roundToInt())
        fun y(x:Double)=cy-amplitude*sin(2*PI*(x/m.wavelength)+phase)
        val bottom=(0..steps).map { val x=a+(b-a)*it/steps;x to y(x)+r }
        val top=(0..steps).map { val x=b-(b-a)*it/steps;x to y(x)-r }
        fun continuation(path:String)=path.substringAfter(" ", "").substringAfter(" ","").substringAfter(" ","")
        return "M ${n(a)} ${n(y(a)-r)} A ${n(r)} ${n(r)} 0 0 0 ${n(a)} ${n(y(a)+r)} "+
            continuation(catmull(bottom))+" A ${n(r)} ${n(r)} 0 0 0 ${n(b)} ${n(y(b)-r)} "+continuation(catmull(top))+" Z"
    }
    fun waveArc(m:ProgressMetrics,start:Double,end:Double,amp:Double,phase:Double):String {
        val span=end-start
        val steps=max(8,ceil(abs(span)/(2*PI)*m.vertices*8).coerceIn(0.0,65536.0).toInt())
        return catmull((0..steps).map {
            val angle=start+span*it/steps;val r=m.radius+amp*m.amplitude*cos(m.vertices*angle-phase)
            m.size/2+r*cos(angle) to m.size/2+r*sin(angle)
        })
    }
    fun arc(m:ProgressMetrics,start:Double,end:Double):String {
        val c=m.size/2;val r=m.radius
        return "M ${n(c+r*cos(start))} ${n(c+r*sin(start))} A $r $r 0 ${if(abs(end-start)>PI) 1 else 0} ${if(end>start) 1 else 0} ${n(c+r*cos(end))} ${n(c+r*sin(end))}"
    }
    data class Paths(val active:String,val track:String,val rotation:Double=0.0)
    fun circular(m:ProgressMetrics,fraction:Double,amp:Double,phase:Double,sweep:Double=.1,rotation:Double=0.0):Paths {
        val start=-PI/2;val end=start+(if(m.indeterminate) sweep else fraction)*2*PI
        val active=if(end-start<1e-4) "" else waveArc(m,start,end,amp,phase)
        val gap=(4+m.thickness+amp*m.amplitude)/m.radius
        val track=if(m.indeterminate || fraction>0 && fraction<1) {
            val rotated=if(m.indeterminate) rotation*PI/180 else 0.0
            val a=end+gap+rotated;val b=start+2*PI-gap+rotated
            if(b>a) arc(m,a,b) else ""
        } else arc(m,start,start+2*PI-1e-3)
        return Paths(active,track,rotation)
    }
    private fun tween(t:Double,at:DoubleArray,values:DoubleArray,curves:Array<DoubleArray?>):Double {
        val i=(0 until at.lastIndex).lastOrNull { t>=at[it] } ?: 0
        val p=((t-at[i])/(at[i+1]-at[i])).coerceIn(0.0,1.0)
        val curve=curves[i];val e=if(curve==null) p else ease(p,curve[0],curve[1],curve[2],curve[3])
        return values[i]+(values[i+1]-values[i])*e
    }
    /** Physical interval before the whole-source RTL mirror. */
    fun bars(elapsed:Double,reduced:Boolean):List<Pair<Double,Double>> = barState(elapsed,reduced).map { it.second to it.third }
    fun barContainers(elapsed:Double,reduced:Boolean):List<Double> = barState(elapsed,reduced).map { it.first }
    private fun barState(elapsed:Double,reduced:Boolean):List<Triple<Double,Double,Double>> {
        val duration=if(reduced) 6000.0 else 2000.0
        val primary=((elapsed+(if(reduced) 4998 else 1666))%duration)/duration
        val secondary=(elapsed%duration)/duration
        val x1=tween(primary,doubleArrayOf(0.0,.2,.5915,1.0),doubleArrayOf(0.0,0.0,.836714,2.5),
            arrayOf(null,doubleArrayOf(.5,0.0,.7017,.4958),doubleArrayOf(.3024,.3814,.55,.9564)))
        val w1=tween(primary,doubleArrayOf(0.0,.3665,.6915,1.0),doubleArrayOf(.08,.08,.58,.62),
            arrayOf(null,doubleArrayOf(.3347,.1248,.7858,1.0),doubleArrayOf(.06,.11,.6,1.0)))
        val x2=tween(secondary,doubleArrayOf(0.0,.25,.4835,1.0),doubleArrayOf(0.0,.376519,.843862,1.60278),
            arrayOf(doubleArrayOf(.15,0.0,.5151,.4097),doubleArrayOf(.3103,.2841,.8,.7337),doubleArrayOf(.4,.627,.6,.902)))
        val w2=tween(secondary,doubleArrayOf(0.0,.1915,.4415,1.0),doubleArrayOf(.08,.4571,.58,.62),
            arrayOf(doubleArrayOf(.205,.0571,.5766,.454),doubleArrayOf(.1523,.1964,.6484,1.0043),doubleArrayOf(.2578,-.0032,.2118,1.3818)))
        return listOf(Triple(-1.45+x1,-1.45+x1+(1-w1)/2,-1.45+x1+(1+w1)/2),Triple(-.55+x2,-.55+x2+(1-w2)/2,-.55+x2+(1+w2)/2))
    }
    data class Spin(val sweep:Double,val offset:Double,val rotation:Double)
    fun flatSpin(elapsed:Double,reduced:Boolean):Spin {
        val p=(elapsed%(if(reduced) 3000 else 1333))/(if(reduced) 3000.0 else 1333.0)
        val e=ease(if(p<.5) p*2 else (p-.5)*2,.4,0.0,.2,1.0)
        return Spin(if(p<.5) .05+.65*e else .70-.65*e,if(p<.5) -.18*e else -.18-.74*e,
            (elapsed%(if(reduced) 4000 else 1568))/(if(reduced) 4000.0 else 1568.0)*360)
    }
    fun waveSpin(elapsed:Double):Spin {
        val p=(elapsed%6000)/6000
        val e=ease(if(p<.5) p*2 else (p-.5)*2)
        return Spin(if(p<.5) .1+.77*e else .87-.77*e,0.0,(1440*elapsed/6000)%360)
    }
    /** Color index and interpolation to its successor. */
    fun color(elapsed:Double,reduced:Boolean):Pair<Int,Double> {
        val p=(elapsed%(if(reduced) 16000 else 5332))/(if(reduced) 16000.0 else 5332.0)*4
        return floor(p).toInt().coerceIn(0,3) to ((p-floor(p)-.6)/.4).coerceIn(0.0,1.0)
    }
}
