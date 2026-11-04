package dev.awc.nativeui

import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithCache
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.*
import androidx.compose.ui.graphics.drawscope.clipPath
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import kotlin.math.max

internal fun AWCCornerLength.lerp(to:AWCCornerLength,t:Double)=AWCCornerLength(points+(to.points-points)*t,fraction+(to.fraction-fraction)*t)
internal fun AWCCornerRadius.lerp(to:AWCCornerRadius,t:Double)=AWCCornerRadius(x.lerp(to.x,t),y.lerp(to.y,t))
/** Per-corner interpolation, matching a CSS border-radius transition. */
internal fun AWCCornerShape.lerp(to:AWCCornerShape,t:Double):AWCCornerShape =
    if(t<=0) this else if(t>=1) to else AWCCornerShape(topLeft.lerp(to.topLeft,t),topRight.lerp(to.topRight,t),bottomRight.lerp(to.bottomRight,t),bottomLeft.lerp(to.bottomLeft,t))
internal val AccordionZeroShape=AWCCornerShape.uniform(0.0)
private fun AWCCornerShape.path(size:Size,density:androidx.compose.ui.unit.Density,inset:Float=0f,dx:Float=0f,dy:Float=0f):Path {
    // CSS spread/inset adjusts each radius by the same distance (clamped at zero).
    val scale=density.density.toDouble()
    val radii=radii(size.width/scale,size.height/scale)
    fun r(v:Double)=max(0f,(v*scale).toFloat()-inset)
    val rect=androidx.compose.ui.geometry.Rect(inset+dx,inset+dy,size.width-inset+dx,size.height-inset+dy)
    return Path().apply { if(rect.width>0 && rect.height>0) addRoundRect(androidx.compose.ui.geometry.RoundRect(rect,
        androidx.compose.ui.geometry.CornerRadius(r(radii[0].first),r(radii[0].second)),androidx.compose.ui.geometry.CornerRadius(r(radii[1].first),r(radii[1].second)),
        androidx.compose.ui.geometry.CornerRadius(r(radii[2].first),r(radii[2].second)),androidx.compose.ui.geometry.CornerRadius(r(radii[3].first),r(radii[3].second)))) }
}
/** Gaussian sigma is half the CSS blur radius; Skia's mask filter takes a radius. */
private fun blurFilter(blur:Float):android.graphics.BlurMaskFilter? {
    val sigma=blur/2f
    if(sigma<=.5f) return null
    return android.graphics.BlurMaskFilter((sigma-.5f)/.57735f,android.graphics.BlurMaskFilter.Blur.NORMAL)
}

/**
 * Source box-shadow painting. Outer layers are clipped out of the border box;
 * inset layers are drawn inside it above the background. The first layer is on top.
 */
internal fun Modifier.accordionShadow(shape:AWCCornerShape,layers:List<NativeShadowLayer>,inset:Boolean):Modifier {
    if(layers.none { it.inset==inset && it.color.alpha>0f }) return this
    return accordionShadow(shape,{ layers },inset)
}
/** [accordionShadow] whose layers are read at draw time (a transitioning box-shadow redraws without recomposition). */
internal fun Modifier.accordionShadow(shape:AWCCornerShape,layersAt:()->List<NativeShadowLayer>,inset:Boolean):Modifier {
    return drawWithCache {
        val box=shape.path(size,this)
        onDrawBehind {
            val selected=layersAt().filter { it.inset==inset && it.color.alpha>0f }
            if(selected.isNotEmpty()) drawIntoCanvas { canvas ->
                val native=canvas.nativeCanvas
                for(layer in selected.asReversed()) {
                    val paint=android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG).apply {
                        color=layer.color.toArgb();maskFilter=blurFilter((layer.blur*density).toFloat())
                    }
                    val spread=(layer.spread*density).toFloat();val dx=(layer.x*density).toFloat();val dy=(layer.y*density).toFloat()
                    native.save()
                    if(!inset) {
                        native.clipOutPath(box.asAndroidPath())
                        native.drawPath(shape.path(size,this,-spread,dx,dy).asAndroidPath(),paint)
                    } else {
                        native.clipPath(box.asAndroidPath())
                        val hole=shape.path(size,this,spread,dx,dy).asAndroidPath()
                        val outer=android.graphics.Path().apply {
                            val extent=(layer.blur*density).toFloat()+max(size.width,size.height)+kotlin.math.abs(spread)
                            addRect(-extent,-extent,size.width+extent,size.height+extent,android.graphics.Path.Direction.CW)
                            op(hole,android.graphics.Path.Op.DIFFERENCE)
                        }
                        native.drawPath(outer,paint)
                    }
                    native.restore()
                }
            }
        }
    }
}

/** Every source `--md-sys-elevation-N` box-shadow (N = 0…5), parsed once per theme. */
internal fun awcElevationTokenLayers(tokens:Map<String,String>):List<List<NativeShadowLayer>> = (0..5).map { level ->
    NativeShadowLayer.parse(tokens["--md-sys-elevation-$level"] ?: dev.awc.nativeui.generated.AWCGeneratedTokens.light["--md-sys-elevation-$level"] ?: "none") }
/** The box-shadow at a (transitioning) elevation level: CSS list interpolation between the neighbouring token levels. */
internal fun awcElevationLayers(levels:List<List<NativeShadowLayer>>,level:Float):List<NativeShadowLayer> {
    if(level<=0f || levels.isEmpty()) return emptyList()
    val lo=kotlin.math.floor(level).toInt().coerceIn(0,levels.size-1);val hi=kotlin.math.ceil(level).toInt().coerceIn(0,levels.size-1)
    return if(lo==hi) levels[lo] else NativeShadowLayer.interpolate(levels[lo],levels[hi],(level-lo).toDouble())
}

/** The source SVG chevron, `M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z`, in a 24 unit box. */
internal fun accordionChevron(scale:Float,left:Float,top:Float)=Path().apply {
    val p=listOf(7.41f to 8.59f,12f to 13.17f,16.59f to 8.59f,18f to 10f,12f to 16f,6f to 10f)
    moveTo(left+p[0].first*scale,top+p[0].second*scale)
    p.drop(1).forEach { lineTo(left+it.first*scale,top+it.second*scale) }
    close()
}

/** Blink's dash intervals for a `dashed` border of [width] (CSS px): 3w/2w below 3px, 2w/w from 3px. */
internal fun accordionDashIntervals(width:Double)=if(width<3) 3*width to 2*width else 2*width to width
/** Blink `StrokeData::SelectBestDashGap`: the gap that fits whole dashes along [length]. */
internal fun accordionBestDashGap(length:Double,dash:Double,gap:Double,closed:Boolean):Double {
    val available=if(closed) length else length+gap
    val minDashes=kotlin.math.floor(available/(dash+gap));val maxDashes=minDashes+1
    val minGaps=if(closed) minDashes else minDashes-1;val maxGaps=if(closed) maxDashes else maxDashes-1
    if(minGaps<=0) return gap
    val minGap=(length-minDashes*dash)/minGaps;val maxGap=(length-maxDashes*dash)/maxGaps
    return if(maxGap<=0 || kotlin.math.abs(minGap-gap)<kotlin.math.abs(maxGap-gap)) minGap else maxGap
}
/**
 * The closed border centerline (dp): starts where the top-left corner meets the top side and
 * runs clockwise (physical, also in RTL); corner radii shrink by half the stroke. Returns the
 * path in px and its length in dp.
 */
internal fun accordionBorderCenterline(shape:AWCCornerShape,widthDp:Double,heightDp:Double,stroke:Double,density:Float):Pair<Path,Double> {
    val r=shape.radii(widthDp,heightDp).map { maxOf(0.0,it.first-stroke/2) to maxOf(0.0,it.second-stroke/2) }
    val h=stroke/2;val w=widthDp;val ht=heightDp
    fun px(v:Double)=(v*density).toFloat()
    val path=Path().apply {
        moveTo(px(h+r[0].first),px(h))
        lineTo(px(w-h-r[1].first),px(h))
        if(r[1].first>0 && r[1].second>0) arcTo(androidx.compose.ui.geometry.Rect(px(w-h-2*r[1].first),px(h),px(w-h),px(h+2*r[1].second)),-90f,90f,false)
        lineTo(px(w-h),px(ht-h-r[2].second))
        if(r[2].first>0 && r[2].second>0) arcTo(androidx.compose.ui.geometry.Rect(px(w-h-2*r[2].first),px(ht-h-2*r[2].second),px(w-h),px(ht-h)),0f,90f,false)
        lineTo(px(h+r[3].first),px(ht-h))
        if(r[3].first>0 && r[3].second>0) arcTo(androidx.compose.ui.geometry.Rect(px(h),px(ht-h-2*r[3].second),px(h+2*r[3].first),px(ht-h)),90f,90f,false)
        lineTo(px(h),px(h+r[0].second))
        if(r[0].first>0 && r[0].second>0) arcTo(androidx.compose.ui.geometry.Rect(px(h),px(h),px(h+2*r[0].first),px(h+2*r[0].second)),180f,90f,false)
        close()
    }
    // Quarter-ellipse perimeter (Ramanujan), exact for circles.
    fun quarter(a:Double,b:Double):Double { if(a<=0 || b<=0) return 0.0
        val hh=((a-b)*(a-b))/((a+b)*(a+b));return Math.PI*(a+b)*(1+3*hh/(10+kotlin.math.sqrt(4-3*hh)))/4 }
    val straight=(w-2*h-r[0].first-r[1].first)+(ht-2*h-r[1].second-r[2].second)+(w-2*h-r[2].first-r[3].first)+(ht-2*h-r[3].second-r[0].second)
    return path to (straight+r.sumOf { quarter(it.first,it.second) })
}
/**
 * Source `border: <width> dashed` of the drop placeholder, as Blink paints a rounded dashed border:
 * one stroke along the closed centerline with its dash intervals, the gap adjusted to whole dashes
 * over the perimeter, phase 0 at the end of the top-left corner.
 */
internal fun Modifier.accordionDashedBorder(shape:AWCCornerShape,width:Double,color:Color):Modifier = if(width<=0 || color.alpha<=0f) this else drawWithCache {
    val (path,length)=accordionBorderCenterline(shape,(size.width/density).toDouble(),(size.height/density).toDouble(),width,density)
    val (dash,gap)=accordionDashIntervals(width)
    val effect=if(length<=dash*2) null else PathEffect.dashPathEffect(floatArrayOf((dash*density).toFloat(),(accordionBestDashGap(length,dash,gap,true)*density).toFloat()),0f)
    val stroke=androidx.compose.ui.graphics.drawscope.Stroke(width=(width*density).toFloat(),pathEffect=effect)
    onDrawWithContent { drawContent();drawPath(path,color,style=stroke) }
}
