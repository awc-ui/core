package dev.awc.nativeui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.RoundRect
import androidx.compose.ui.graphics.*
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.semantics.*
import androidx.compose.ui.unit.*
import kotlinx.coroutines.isActive
import kotlin.math.*

internal data class LoadingIndicatorMetrics(val size:Double,val shapeWidth:Double,val shapeHeight:Double) {
    companion object {
        fun from(p:Props,a:AWCLoadingIndicatorAppearance,part:AWCLoadingIndicatorShapeAppearance,inheritedDensity:Double):LoadingIndicatorMetrics {
            val size=a.size ?: max(32.0,48+4*resolveAWCDensity(p["density"],inheritedDensity))
            val shape=a.shapeSize ?: size*.792
            // The source is a horizontal flex container: only the shape's inline
            // dimension shrinks when it exceeds the host; the block axis clips.
            return LoadingIndicatorMetrics(size,min(size,part.width ?: shape),part.height ?: shape)
        }
    }
}

@Composable internal fun NativeLoadingIndicator(p:Props,focused:Boolean) {
    if(p.bool("hidden")) return
    val a=LocalAWCLoadingIndicatorAppearance.current.normalized()
    val part=LocalAWCLoadingIndicatorShapeAppearance.current.normalized()
    val m=LoadingIndicatorMetrics.from(p,a,part,LocalAWCNativeDensity.current)
    val contained=p.str("variant")=="contained"
    val colors=MaterialTheme.colorScheme
    val (reduced,forced)=rememberAWCAccessibilityAppearance()
    val ink=if(forced) colors.onSurface else (part.color ?: a.color)?.let(::statusDotColor)
        ?: if(contained) colors.onPrimaryContainer else colors.primary
    val background=if(!contained) Color.Transparent else if(forced) colors.surface
        else a.containerColor?.let(::statusDotColor) ?: colors.primaryContainer
    val corner=a.containerShape ?: AWCCornerShape.uniform(fraction=.5)
    val clipShape:Shape=if(contained || focused) corner else RectangleShape
    val phase=remember { mutableDoubleStateOf(0.0) }
    val moving=m.size>0 && m.shapeWidth>0 && m.shapeHeight>0
    LaunchedEffect(reduced,moving) {
        phase.doubleValue=0.0
        if(moving) {
            val start=withFrameNanos { it }
            val duration=if(reduced) 2_000_000_000L else 4_550_000_000L
            while(isActive) withFrameNanos { now -> phase.doubleValue=((now-start)%duration).toDouble()/duration }
        }
    }
    val inspection=LocalAWCInspection.current
    val rtl=when(p.str("dir")) { "rtl"->true;"ltr"->false;else->LocalLayoutDirection.current==LayoutDirection.Rtl }
    val root=Modifier.semantics(mergeDescendants=true) {
        contentDescription=p.str("label","Loading")
        progressBarRangeInfo=ProgressBarRangeInfo.Indeterminate
        liveRegion=LiveRegionMode.Polite
    }.inspectAWCNode(inspection,"","md-loading-indicator",AWCInspectionMetrics(
        padding=AWCInspectionInsets(),margin=AWCInspectionInsets(),border=AWCInspectionInsets(),
        display="Compose Layout",direction=if(rtl) "rtl" else "ltr"),allowZeroSize=true)
        .drawWithContent {
            drawContent()
            if(contained && forced || focused) {
                val stroke=(if(focused) 3.dp else 1.dp).toPx()
                val outset=if(focused) 2.dp.toPx()+stroke/2 else stroke/2
                translate(-outset,-outset) {
                    val radii=corner.radii(size.width/density.toDouble(),size.height/density.toDouble())
                        .map { CornerRadius((it.first*density+outset).toFloat(),(it.second*density+outset).toFloat()) }
                    val outline=Outline.Rounded(RoundRect(0f,0f,size.width+2*outset,size.height+2*outset,radii[0],radii[1],radii[2],radii[3]))
                    drawOutline(outline,if(focused) colors.secondary else colors.onSurface,style=Stroke(stroke))
                }
            }
        }.clip(clipShape).background(background)
    Layout(modifier=root,content={
        Canvas(Modifier.graphicsLayer {
            rotationZ=if(reduced) 0f else LoadingIndicatorMotion.at(phase.doubleValue).rotation.toFloat()
            alpha=if(reduced) LoadingIndicatorMotion.reducedOpacity(phase.doubleValue).toFloat() else 1f
        }.inspectAWCNode(inspection,"shape","Shape",AWCInspectionMetrics(display="Compose Canvas"),allowZeroSize=true)
            .clearAndSetSemantics {}) {
            if(reduced) drawOval(ink) else {
                val vertices=LoadingIndicatorMotion.at(phase.doubleValue).vertices
                val path=Path().apply {
                    vertices.forEachIndexed { index,(x,y) ->
                        if(index==0) moveTo((x*size.width).toFloat(),(y*size.height).toFloat())
                        else lineTo((x*size.width).toFloat(),(y*size.height).toFloat())
                    }
                    close()
                }
                drawPath(path,ink)
            }
        }
    }) { measurables,_ ->
        fun pixels(value:Double)=(value*density).coerceIn(0.0,32766.0).roundToInt()
        val size=pixels(m.size)
        val child=measurables.single().measure(Constraints.fixed(min(size,pixels(m.shapeWidth)),pixels(m.shapeHeight)))
        layout(size,size) { child.place((size-child.width)/2,(size-child.height)/2) }
    }
}
