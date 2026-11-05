package dev.awc.nativeui

import kotlin.math.*

internal data class SkeletonPartBox(
    val name:String,val x:Double,val y:Double,val width:Double,val height:Double,
    val color:String?,val corners:AWCCornerShape,
)
internal data class SkeletonGeometry(val width:Double,val height:Double,val gap:Double,val parts:List<SkeletonPartBox>)

internal object NativeSkeletonGeometry {
    /** JS ToInt32, followed by the source minimum. Native safety bounds the
     * number of real layout nodes; it does not reinterpret fractional rows. */
    fun count(raw:Double):Int {
        if(!raw.isFinite() || raw==0.0) return 1
        val integer=if(raw<0) ceil(raw) else floor(raw)
        val unsigned=((integer%4294967296.0)+4294967296.0)%4294967296.0
        val signed=if(unsigned>=2147483648.0) unsigned-4294967296.0 else unsigned
        return signed.coerceIn(1.0,8192.0).toInt()
    }
    fun resolve(
        p:Props,a:AWCSkeletonAppearance,parts:Map<AWCSkeletonPart,AWCSkeletonPartAppearance>,
        context:AWCSkeletonSizingContext,parentWidth:Double,font:Double,rootFont:Double,zero:Double,
        density:Double,rtl:Boolean,defaultRadius:Double=4.0,
    ):SkeletonGeometry {
        val variant=p.str("variant","text");val text=variant=="text";val circle=variant=="circular"
        val fullHeight=p.bool("fullHeight");val parentHeight=context.parentHeight
        fun length(value:AWCSkeletonLength,parent:Double?=null)=value.resolve(parent,font,rootFont,zero)
        fun property(key:String)=p.str(key).takeIf(String::isNotEmpty)?.let(AWCSkeletonLength::parse)
        fun densitySize(base:Double,factor:Double,floor:Double):Double =
            if(density>(Double.MAX_VALUE-base)/factor) Double.MAX_VALUE else max(floor,base+factor*density)
        val size=a.size ?: AWCSkeletonLength(points=densitySize(40.0,3.0,28.0))
        val width=property("width") ?: a.width ?: if(circle) size else AWCSkeletonLength(fraction=1.0)
        val defaultHeight=when(variant) {
            "text"->AWCSkeletonLength(em=max(.75,1+.05*density))
            "rectangular","rounded"->AWCSkeletonLength(points=densitySize(120.0,8.0,80.0))
            else->size
        }
        val height=property("height") ?: a.height ?: defaultHeight
        var hostWidth=if(p.bool("fullWidth")) parentWidth else length(width,parentWidth) ?: parentWidth
        val minimum=if(fullHeight) length(height,parentHeight) ?: 0.0 else 0.0
        // Percentage child heights are relative to the auto host, not to the
        // authored outer parent. fullHeight establishes a definite host only
        // when its containing-block height is explicitly known.
        var hostHeight:Double?=if(fullHeight && parentHeight!=null) max(parentHeight,minimum) else null
        if(fullHeight && circle) {
            hostWidth=hostHeight ?: max(parentWidth,minimum)
            hostHeight=hostWidth
        }
        val gap=length(a.lineGap ?: AWCSkeletonLength(points=max(4.0,8+density)),hostHeight) ?: 0.0
        val ordinaryHeight=length(height,hostHeight)
        val baseCorner=when(variant) {
            "circular"->AWCCornerShape.uniform(fraction=.5)
            "rounded"->a.roundedRadius ?: AWCCornerShape.uniform(points=max(8.0,12+density))
            else->a.radius ?: AWCCornerShape.uniform(points=defaultRadius)
        }
        val count=if(text) count((p["lines"] as? Number)?.toDouble() ?: 1.0) else 1
        val boxes=(0 until count).map { index->
            val last=text && count>1 && index==count-1
            var appearance=parts[if(text) AWCSkeletonPart.Line else AWCSkeletonPart.Shape] ?: AWCSkeletonPartAppearance()
            if(last) appearance=appearance.merged(parts[AWCSkeletonPart.LineLast] ?: AWCSkeletonPartAppearance())
            val w=length(appearance.width ?: AWCSkeletonLength(fraction=if(last) .6 else 1.0),hostWidth) ?: hostWidth
            val h=if(appearance.height!=null) length(appearance.height,hostHeight) ?: if(circle) w else 0.0
                else if(!text && fullHeight) max(hostHeight ?: (if(circle) hostWidth else ordinaryHeight ?: 0.0),minimum)
                else ordinaryHeight ?: if(circle) w else 0.0
            SkeletonPartBox(if(text) "line-$index" else "shape",if(rtl) hostWidth-w else 0.0,0.0,w,h,
                appearance.color ?: a.color,appearance.cornerShape ?: baseCorner)
        }
        val naturalHeight=boxes.sumOf { it.height }+gap*(count-1)
        val resolvedHeight=hostHeight ?: max(if(fullHeight) minimum else 0.0,naturalHeight)
        // Empty flex children have min-height:auto ->0 and shrink together
        // inside a definite full-height text host, while the fixed gap remains.
        val shrink=if(text && hostHeight!=null && naturalHeight>resolvedHeight)
            max(0.0,resolvedHeight-gap*(count-1))/boxes.sumOf { it.height }.takeIf { it>0.0 }.let { it ?: 1.0 }
            else 1.0
        var top=0.0
        val positioned=boxes.map { box->
            val h=box.height*shrink
            val result=box.copy(y=top,height=h);top+=h+gap;result
        }
        return SkeletonGeometry(hostWidth,resolvedHeight,gap,positioned)
    }
}

internal data class SkeletonMotionFrame(val opacity:Double,val scale:Double,val pulseOpacity:Double,val waveFraction:Double)
internal object SkeletonMotion {
    private fun easing(x:Double,curve:List<Double>):Double {
        if(x<=0) return 0.0
        if(x>=1) return 1.0
        var low=0.0;var high=1.0
        fun bezier(t:Double,a:Double,b:Double)=3*(1-t)*(1-t)*t*a+3*(1-t)*t*t*b+t*t*t
        repeat(48) { val t=(low+high)/2;if(bezier(t,curve[0],curve[2])<x) low=t else high=t }
        return bezier((low+high)/2,curve[1],curve[3])
    }
    fun curve(raw:String?,fallback:List<Double>):List<Double> {
        val values=raw?.removePrefix("cubic-bezier(")?.removeSuffix(")")?.split(',')?.mapNotNull { it.trim().toDoubleOrNull() }
        return values?.takeIf { it.size==4 && it.all(Double::isFinite) && it[0] in 0.0..1.0 && it[2] in 0.0..1.0 } ?: fallback
    }
    fun frame(time:Double,animation:String,reduced:Boolean,rtl:Boolean,bloom:Double,pulse:Double,wave:Double,
              bloomCurve:List<Double> = listOf(.38,1.21,.22,1.0),
              pulseCurve:List<Double> = listOf(.2,0.0,0.0,1.0),
              waveCurve:List<Double> = listOf(.2,0.0,0.0,1.0)):SkeletonMotionFrame {
        if(reduced) return SkeletonMotionFrame(1.0,1.0,1.0,0.0)
        val entrance=if(bloom<=0) 1.0 else easing((time/bloom).coerceIn(0.0,1.0),bloomCurve)
        val pulseTime=if(pulse<=0) 0.0 else (time%pulse)/pulse
        val pulseValue=if(animation!="pulse" || pulse<=0) 1.0 else if(pulseTime<.5)
            1-.45*easing(pulseTime*2,pulseCurve) else .55+.45*easing((pulseTime-.5)*2,pulseCurve)
        val progress=if(wave<=0) 0.0 else (time%wave)/wave
        val waveValue=easing(if(rtl) 1-progress else progress,waveCurve)
        return SkeletonMotionFrame(entrance.coerceIn(0.0,1.0),.96+.04*entrance,pulseValue,waveValue)
    }
}
