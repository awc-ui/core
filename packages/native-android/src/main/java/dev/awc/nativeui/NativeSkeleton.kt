package dev.awc.nativeui

import androidx.compose.foundation.Canvas
import androidx.compose.material3.LocalTextStyle
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.*
import androidx.compose.ui.graphics.drawscope.*
import androidx.compose.ui.layout.SubcomposeLayout
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.semantics.*
import androidx.compose.ui.text.*
import androidx.compose.ui.text.font.*
import androidx.compose.ui.text.style.TextMotion
import androidx.compose.ui.unit.*
import kotlinx.coroutines.isActive
import kotlin.math.*

/** The busy/status meaning has no dedicated Compose Role. Preserve it alongside
 * native polite-live-region and accessible-name semantics, without an action. */
val AWCSkeletonBusyKey=SemanticsPropertyKey<Boolean>("AWC loading status busy")
private val SkeletonFont=FontFamily(Font(R.font.awc_roboto_regular,FontWeight.Normal))

@Composable internal fun NativeSkeleton(p:Props) {
    if(p.bool("hidden")) return
    val a=LocalAWCSkeletonAppearance.current.normalized()
    val parts=LocalAWCSkeletonParts.current
    val context=LocalAWCSkeletonSizingContext.current
    val tokens=LocalAWCThemeTokens.current
    val densityContext=LocalDensity.current
    val nativeDensity=LocalAWCNativeDensity.current
    val rtl=when(p.str("dir")) { "rtl"->true;"ltr"->false;else->LocalLayoutDirection.current==LayoutDirection.Rtl }
    val (reduced,forced)=rememberAWCAccessibilityAppearance()
    val colors=MaterialTheme.colorScheme
    val baseColor=if(forced) colors.outline else a.color?.let(::statusDotColor)
        ?: colors.onSurface.copy(alpha=colors.onSurface.alpha*.16f)
    val highlight=a.highlight?.let(::statusDotColor) ?: colors.surfaceBright
    fun token(key:String,depth:Int=0):String? {
        if(depth>12) return null
        val raw=tokens[key] ?: return null
        return if(raw.startsWith("var(")) {
            val inside=raw.removePrefix("var(").removeSuffix(")")
            token(inside.substringBefore(',').trim(),depth+1) ?: inside.substringAfter(',',"").trim().ifEmpty { null }
        } else raw
    }
    fun duration(key:String,fallback:Double):Double {
        val raw=token(key)?.trim() ?: return fallback
        return when {
            raw.endsWith("ms")->raw.removeSuffix("ms").toDoubleOrNull()
            raw.endsWith("s")->raw.removeSuffix("s").toDoubleOrNull()?.times(1000)
            else->null
        }?.takeIf { it.isFinite() && it>=0 } ?: fallback
    }
    fun milliseconds(seconds:Double?,fallback:Double)=seconds?.let { if(it>Double.MAX_VALUE/1000) Double.MAX_VALUE else it*1000 } ?: fallback
    val recurring=duration("--md-sys-motion-duration-extra-long2",1800.0)
    val bloom=milliseconds(a.bloomDuration,duration("--md-sys-motion-spring-spatial-default-duration",500.0))
    val pulse=milliseconds(a.pulseDuration,recurring);val wave=milliseconds(a.waveDuration,recurring)
    val bloomCurve=SkeletonMotion.curve(token("--md-sys-motion-spring-spatial-default-easing"),listOf(.38,1.21,.22,1.0))
    val pulseCurve=SkeletonMotion.curve(token("--md-sys-motion-easing-standard"),listOf(.2,0.0,0.0,1.0))
    val waveCurve=SkeletonMotion.curve(token("--md-sys-motion-easing-emphasized"),listOf(.2,0.0,0.0,1.0))
    val animation=p.str("animation","pulse")
    var elapsed by remember { mutableDoubleStateOf(0.0) }
    val cycleStart=remember(animation,reduced) { elapsed }
    LaunchedEffect(animation,reduced,bloom,pulse,wave) {
        if(reduced) { elapsed=0.0;return@LaunchedEffect }
        val start=withFrameNanos { it }/1_000_000.0-elapsed
        while(isActive && (elapsed<bloom || animation=="pulse" && pulse>0 || animation=="wave" && wave>0)) {
            withFrameNanos { now->elapsed=max(0.0,now/1_000_000.0-start) }
        }
    }
    fun currentFrame():SkeletonMotionFrame {
        val entrance=SkeletonMotion.frame(elapsed,animation,reduced,rtl,bloom,pulse,wave,bloomCurve,pulseCurve,waveCurve)
        val cycle=SkeletonMotion.frame(max(0.0,elapsed-cycleStart),animation,reduced,rtl,bloom,pulse,wave,bloomCurve,pulseCurve,waveCurve)
        return entrance.copy(pulseOpacity=cycle.pulseOpacity,waveFraction=cycle.waveFraction)
    }
    // em/rem follow actual native font scaling. ch uses the configured native
    // font's fractional advance, not the integer Text layout width.
    val fontSp=min(context.fontSize,32766.0/densityContext.density/densityContext.fontScale)
    val rootSp=min(context.rootFontSize,32766.0/densityContext.density/densityContext.fontScale)
    val font=with(densityContext) { fontSp.toFloat().sp.toPx()/densityContext.density }.toDouble()
    val rootFont=with(densityContext) { rootSp.toFloat().sp.toPx()/densityContext.density }.toDouble()
    val inheritedText=LocalTextStyle.current
    val measurer=rememberTextMeasurer()
    val zero=context.zeroGlyphAdvance ?: remember(measurer,fontSp,inheritedText.fontFamily,densityContext) {
        val result=measurer.measure(AnnotatedString("0"),TextStyle(
            fontFamily=inheritedText.fontFamily ?: SkeletonFont,fontSize=fontSp.toFloat().sp,
            fontWeight=inheritedText.fontWeight ?: FontWeight.Normal,
            letterSpacing=0.sp,textMotion=TextMotion.Animated,platformStyle=PlatformTextStyle(includeFontPadding=false)),
            softWrap=false,maxLines=1)
        (result.getLineRight(0)-result.getLineLeft(0))/densityContext.density.toDouble()
    }
    val inspection=LocalAWCInspection.current
    val semantics=Modifier.clearAndSetSemantics {
        if(p.bool("announce",true)) {
            this[AWCSkeletonBusyKey]=true
            contentDescription=p.str("ariaLabelProp","Loading")
            liveRegion=LiveRegionMode.Polite
        } else hideFromAccessibility()
    }
    val defaultRadius=token("--md-sys-shape-corner-extra-small")?.removeSuffix("px")?.toDoubleOrNull() ?: 4.0
    var measuredGap by remember { mutableDoubleStateOf(0.0) }
    SubcomposeLayout(semantics.graphicsLayer {
        val motion=currentFrame();alpha=motion.opacity.toFloat();scaleX=motion.scale.toFloat();scaleY=motion.scale.toFloat()
    }.inspectAWCNode(inspection,"","md-skeleton",AWCInspectionMetrics(
        padding=AWCInspectionInsets(),margin=AWCInspectionInsets(),border=AWCInspectionInsets(),
        gap=if(p.str("variant","text")=="text") AWCInspectionGap(measuredGap,0.0) else AWCInspectionGap(0.0,0.0),
        display=if(p.str("variant","text")=="text") "Compose column" else "Compose layout",
        direction=if(rtl) "rtl" else "ltr"),allowZeroSize=true)) { constraints->
        val parentWidth=(if(constraints.hasBoundedWidth) min(constraints.maxWidth,32766) else constraints.minWidth)/density.toDouble()
        val geometry=NativeSkeletonGeometry.resolve(p,a,parts,context,parentWidth,font,rootFont,zero,nativeDensity,rtl,defaultRadius)
        if(measuredGap!=geometry.gap) measuredGap=geometry.gap
        fun pixels(value:Double)=(value*density).coerceIn(0.0,32766.0)
        val width=pixels(geometry.width).roundToInt();val height=pixels(geometry.height).roundToInt()
        val children=geometry.parts.map { box->
            val w=pixels(box.width);val h=pixels(box.height)
            val measureWidth=if(w>0) max(1,w.roundToInt()) else 0
            val measureHeight=if(h>0) max(1,h.roundToInt()) else 0
            val color=if(forced) baseColor else box.color?.let(::statusDotColor) ?: baseColor
            val child=subcompose(box.name) {
                Canvas(Modifier.graphicsLayer { alpha=currentFrame().pulseOpacity.toFloat() }
                    .inspectAWCNode(inspection,box.name,if(box.name=="shape") "Shape" else if(box===geometry.parts.last() && geometry.parts.size>1) "Line · line-last" else "Line",
                        AWCInspectionMetrics(display="Compose Canvas"),allowZeroSize=true).clearAndSetSemantics {}) {
                    val outline=box.corners.createOutline(size,if(rtl) LayoutDirection.Rtl else LayoutDirection.Ltr,this)
                    drawOutline(outline,color)
                    if(!reduced && animation=="wave" && wave>0 && size.width>0 && size.height>0) {
                        val clip=Path().apply { addOutline(outline) }
                        clipPath(clip) {
                            val stripWidth=size.width*2;val stripHeight=size.height*1.2f
                            val fraction=currentFrame().waveFraction
                            val left=if(rtl) 0f else -size.width
                            val translation=(-stripWidth+3*stripWidth*fraction).toFloat()
                            val skew=tan(-12.0*PI/180).toFloat()
                            withTransform({
                                translate(left+translation-skew*stripHeight/2,-size.height*.1f)
                                transform(Matrix().apply { this[1,0]=skew })
                            }) {
                                drawRect(Brush.linearGradient(0f to Color.Transparent,.35f to Color.Transparent,
                                    .5f to highlight,.65f to Color.Transparent,1f to Color.Transparent,
                                    start=Offset.Zero,end=Offset(stripWidth,0f)),size=Size(stripWidth,stripHeight))
                            }
                        }
                    }
                }
            }.single().measure(Constraints.fixed(measureWidth,measureHeight))
            Triple(box,child,w to h)
        }
        layout(width,height) {
            children.forEach { (box,child,actual)->
                val x=if(rtl) width-actual.first else pixels(box.x)
                val y=pixels(box.y);val roundedX=x.roundToInt();val roundedY=y.roundToInt()
                child.placeWithLayer(roundedX,roundedY) {
                    transformOrigin=TransformOrigin(0f,0f)
                    translationX=(x-roundedX).toFloat();translationY=(y-roundedY).toFloat()
                    scaleX=if(child.width>0) (actual.first/child.width).toFloat() else 1f
                    scaleY=if(child.height>0) (actual.second/child.height).toFloat() else 1f
                }
            }
        }
    }
}
