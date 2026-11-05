package dev.awc.nativeui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.LocalContentColor
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.*
import androidx.compose.ui.graphics.*
import androidx.compose.ui.graphics.drawscope.*
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.semantics.*
import androidx.compose.ui.unit.*
import kotlinx.coroutines.isActive
import kotlin.math.*

/** Exact source accessibility values, alongside Android's Float range API. */
data class AWCProgressRange(val maximum:Double,val value:Double?)
val AWCProgressRangeKey=SemanticsPropertyKey<AWCProgressRange>("AWC progress range")

private data class ProgressPaint(
    val id:String?,val name:String,val box:Rect,val color:Color,val shape:Shape?=null,
    val path:Path?=null,val stroke:Double?=null,val opacity:Double=1.0,
    val excluded:List<Pair<Double,Double>> = emptyList(),
)
private fun progressPath(data:String):Path=if(data.isEmpty()) Path() else PathParser().parsePathString(data).toPath()
private fun progressBox(x:Double,y:Double,width:Double,height:Double)=Rect(x.toFloat(),y.toFloat(),(x+max(0.0,width)).toFloat(),(y+max(0.0,height)).toFloat())

@Composable internal fun NativeProgressIndicator(p:Props,emit:(String,AWCValue)->Unit) {
    val a=LocalAWCProgressIndicatorAppearance.current.normalized()
    val requested=ProgressMetrics.from(p,a,LocalAWCNativeDensity.current)
    val (reduced,forced)=rememberAWCAccessibilityAppearance()
    val motion=remember { ProgressMotion(requested,reduced) }
    var frame by remember { mutableLongStateOf(0) }
    val actions=LocalAWCAction.current;val target=LocalAWCActionTarget.current
    val targetID=remember { java.util.UUID.randomUUID().toString() }
    val completion by rememberUpdatedState {
        dispatchNativeAction(AWCActionEvent("mdComplete","md-progress-indicator",emptyMap(),targetID=target?.id ?: targetID,rawDetail=null),
            actions,target?.listeners?.invoke().orEmpty())
        emit("mdComplete",null)
    }
    LaunchedEffect(requested,reduced) {
        motion.configure(requested,reduced);frame++
        if(motion.takeCompletion()) completion()
        while(isActive && motion.needsFrames()) withFrameNanos { now ->
            motion.step(now/1_000_000.0);frame++
            if(motion.takeCompletion()) completion()
        }
        motion.pause()
    }
    frame // Lifecycle visibility and semantics must recompose as frames settle.
    if(requested.hidden) return
    val colors=MaterialTheme.colorScheme
    fun ink(value:String?,fallback:Color)=value?.let(::statusDotColor) ?: fallback
    val defaultActive=if(LocalAWCButtonSlotPart.current!=null) LocalContentColor.current else colors.primary
    val active=if(forced) colors.onSurface else ink(a.activeIndicatorColor,defaultActive)
    val track=if(forced) colors.outline else ink(a.trackColor,colors.secondaryContainer)
    val stop=if(forced) colors.onSurface else ink(a.stopIndicatorColor,colors.primary)
    val cycle=listOf(ink(a.fourColor1,colors.primary),ink(a.fourColor2,colors.primaryContainer),ink(a.fourColor3,colors.tertiary),ink(a.fourColor4,colors.tertiaryContainer))
    val trackShape=a.trackShape ?: AWCCornerShape.uniform(points=9999.0)
    val activeShape=a.activeIndicatorShape ?: trackShape
    val stopShape=a.stopIndicatorShape ?: AWCCornerShape.uniform(points=9999.0)
    val rtl=when(p.str("dir")) { "rtl"->true;"ltr"->false;else->LocalLayoutDirection.current==LayoutDirection.Rtl }
    val inspection=LocalAWCInspection.current
    fun nativeFloat(number:Double)=number.coerceIn(-Float.MAX_VALUE.toDouble(),Float.MAX_VALUE.toDouble()).toFloat()
    val semantics=if(motion.completedHidden) Modifier.clearAndSetSemantics {} else Modifier.clearAndSetSemantics {
        if(requested.label.isNotEmpty()) contentDescription=requested.label
        this[AWCProgressRangeKey]=AWCProgressRange(requested.maximum,requested.value.takeUnless { requested.indeterminate })
        progressBarRangeInfo=if(requested.indeterminate) ProgressBarRangeInfo.Indeterminate
            else ProgressBarRangeInfo(nativeFloat(requested.value),0f..nativeFloat(requested.maximum))
    }
    val root=if(motion.completedHidden) semantics else semantics.inspectAWCNode(inspection,"","md-progress-indicator",AWCInspectionMetrics(
        padding=AWCInspectionInsets(),margin=AWCInspectionInsets(),border=AWCInspectionInsets(),
        display="Compose Canvas",direction=if(rtl) "rtl" else "ltr"),allowZeroSize=true)
    androidx.compose.ui.layout.SubcomposeLayout(root) { constraints ->
        // Keep accepted finite values safe at the native physical coordinate
        // boundary. The source retains signed semantics below that boundary.
        val limit=32766/density.toDouble()
        val m=requested.copy(thickness=requested.thickness.coerceIn(-limit,limit),amplitude=min(requested.amplitude,limit),
            wavelength=requested.wavelength.coerceIn(1e-6,limit),speed=min(requested.speed,Double.MAX_VALUE),
            gap=requested.gap.coerceIn(-limit,limit),stopSize=min(requested.stopSize,limit),trailing=requested.trailing.coerceIn(-limit,limit))
        fun px(value:Double)=(value*density).coerceIn(0.0,32766.0).roundToInt()
        val width=if(m.circular) px(m.size) else if(constraints.hasBoundedWidth) constraints.maxWidth.coerceAtMost(32766) else constraints.minWidth
        val height=px(m.height)
        val logicalWidth=width/density.toDouble();val logicalHeight=height/density.toDouble()
        frame // observe the mounted frame without changing the subtree identity
        val paints=if(motion.completedHidden) emptyList() else progressPaints(m,motion,a,logicalWidth,logicalHeight,rtl,reduced,forced,
            active,track,stop,cycle,activeShape,trackShape,stopShape)
        val content=subcompose("progress") {
            // State is owned above this draw subtree. This Canvas renders every
            // native frame from actual paths; measured parts share those bounds.
            val clipShape=if(m.circular) RectangleShape else if(m.indeterminate && rtl) progressMirroredShape(trackShape) else trackShape
            Layout(modifier=Modifier.clip(clipShape).graphicsLayer { scaleY=if(m.circular) 1f else motion.collapse.toFloat() },content={
                Canvas(Modifier.fillMaxSize()) {
                    val factor=density
                    for(item in paints) {
                        if(item.opacity<=0) continue
                        val color=item.color.copy(alpha=(item.color.alpha*item.opacity).toFloat().coerceIn(0f,1f))
                        fun DrawScope.paint() {
                            if(item.path!=null) {
                                withTransform({ scale(factor,factor,pivot=Offset.Zero) }) {
                                    val stroke=item.stroke
                                    if(stroke==null) drawPath(item.path,color)
                                    else if(stroke>0) {
                                        val bounds=item.box
                                        val cap=2*(hypot(logicalWidth/2,logicalHeight/2)+max(abs(bounds.width.toDouble()),abs(bounds.height.toDouble())))
                                        drawPath(item.path,color,style=Stroke(min(stroke,cap).toFloat(),cap=StrokeCap.Round))
                                    }
                                }
                            } else if(item.box.width>0 && item.box.height>0) {
                                translate(item.box.left*factor,item.box.top*factor) {
                                    val bounds=Size(item.box.width*factor,item.box.height*factor)
                                    drawOutline((item.shape ?: RectangleShape).createOutline(bounds,if(rtl) LayoutDirection.Rtl else LayoutDirection.Ltr,this),color)
                                }
                            }
                        }
                        if(item.excluded.isEmpty()) paint() else {
                            var cursor=0.0
                            for((left,right) in item.excluded) {
                                if(left>cursor) clipRect((cursor*factor).toFloat(),0f,(left*factor).toFloat(),size.height) { paint() }
                                cursor=max(cursor,right)
                            }
                            if(cursor<logicalWidth) clipRect((cursor*factor).toFloat(),0f,size.width,size.height) { paint() }
                        }
                    }
                }
                paints.filter { it.id!=null }.forEach { item ->
                    Box(Modifier.inspectAWCNode(inspection,item.id!!,item.name,
                        AWCInspectionMetrics(display=if(item.path==null) "Compose box" else "Compose path"),allowZeroSize=true))
                }
            }) { children,_ ->
                val canvas=children.first().measure(Constraints.fixed(width,height))
                val parts=paints.filter { it.id!=null }.mapIndexed { index,item ->
                    val w=px(item.box.width.toDouble());val h=px(item.box.height.toDouble())
                    Triple(item,children[index+1].measure(Constraints.fixed(w,h)),w to h)
                }
                layout(width,height) {
                    canvas.place(0,0)
                    for((item,child,dimensions) in parts) {
                        val x=item.box.left*density;val y=item.box.top*density
                        val roundedX=x.roundToInt();val roundedY=y.roundToInt()
                        child.placeWithLayer(roundedX,roundedY) {
                            transformOrigin=TransformOrigin(0f,0f)
                            translationX=x-roundedX;translationY=y-roundedY
                            scaleX=if(dimensions.first>0) item.box.width*density/dimensions.first else 1f
                            scaleY=if(dimensions.second>0) item.box.height*density/dimensions.second else 1f
                        }
                    }
                }
            }
        }.single().measure(Constraints.fixed(width,height))
        layout(width,height) { content.place(0,0) }
    }
}

private fun progressPaints(m:ProgressMetrics,motion:ProgressMotion,a:AWCProgressIndicatorAppearance,width:Double,height:Double,
    rtl:Boolean,reduced:Boolean,forced:Boolean,active:Color,track:Color,stop:Color,cycle:List<Color>,
    activeShape:Shape,trackShape:Shape,stopShape:Shape):List<ProgressPaint> {
    val items=mutableListOf<ProgressPaint>()
    val f=motion.fraction
    fun box(id:String?,name:String,x:Double,y:Double,w:Double,h:Double,color:Color,shape:Shape,excluded:List<Pair<Double,Double>> = emptyList()) {
        items+=ProgressPaint(id,name,progressBox(x,y,w,h),color,if(m.indeterminate && rtl) progressMirroredShape(shape) else shape,excluded=excluded)
    }
    fun path(id:String?,name:String,data:String,color:Color,stroke:Double?=null,opacity:Double=1.0,rotation:Double=0.0,partBounds:Rect?=null,mirrorX:Boolean=false) {
        val native=progressPath(data)
        // SVG getBoundingClientRect transforms the element's local geometric
        // box, not the tighter contour obtained after rotating the curve. Keep
        // actual paint unchanged while measuring that same transformed surface.
        var bounds=partBounds ?: progressTightBounds(native)
        fun transform(matrix:Matrix) {
            native.transform(matrix)
            if(partBounds!=null || data.isNotEmpty()) {
                val points=listOf(bounds.topLeft,bounds.topRight,bounds.bottomRight,bounds.bottomLeft).map(matrix::map)
                bounds=Rect(points.minOf { it.x },points.minOf { it.y },points.maxOf { it.x },points.maxOf { it.y })
            }
        }
        if(mirrorX) transform(Matrix().apply { translate(width.toFloat(),0f);scale(-1f,1f) })
        if(rotation!=0.0) transform(Matrix().apply { translate((m.size/2).toFloat(),(m.size/2).toFloat());rotateZ(rotation.toFloat());translate((-m.size/2).toFloat(),(-m.size/2).toFloat()) })
        items+=ProgressPaint(id,name,bounds,color,path=native,stroke=stroke,opacity=opacity)
    }
    if(!m.circular) {
        val t=m.linearThickness;val y=(height-t)/2
        if(m.indeterminate) {
            val intervals=ProgressGeometry.bars(motion.elapsed,reduced).map { (start,end)->
                val first=start*width;val last=end*width
                if(rtl) width-last to width-first else first to last
            }
            val exclusions=if(m.wave && !reduced) intervals.map { (left,right) -> max(0.0,left-m.thickness/2) to min(width,right+m.thickness/2) }
                .filter { it.second>it.first }.sortedBy { it.first }.fold(mutableListOf<Pair<Double,Double>>()) { acc,next ->
                    if(acc.isNotEmpty() && next.first<=acc.last().second) acc[acc.lastIndex]=acc.last().first to max(acc.last().second,next.second) else acc+=next
                    acc
                } else emptyList()
            box("track","Track",0.0,y,width,t,track,trackShape,exclusions)
            intervals.forEachIndexed { i,(left,right)->
                if(m.wave && !reduced) path("active-indicator${if(i==0) "" else "-secondary"}","Active wave ${i+1}",
                    if(right-left<1) "" else ProgressGeometry.linear(m,if(rtl) width-right else left,if(rtl) width-left else right,motion.amplitude,motion.wavePhase,false),active,mirrorX=rtl)
                else {
                    val id=if(i==0) "active-indicator" else "active-secondary"
                    val outer=ProgressGeometry.barContainers(motion.elapsed,reduced)[i]*width
                    box(id,"Active bar container ${i+1}",if(rtl) -outer else outer,y,width,t,Color.Transparent,RectangleShape)
                    box("$id.fill","Active bar fill ${i+1}",left,y,right-left,t,active,activeShape)
                }
            }
        } else {
            val fill=if(!m.wave) (f*100000).roundToInt()/100000.0*width else f*width
            val start=if(fill>0) fill+m.gap else 0.0;val trackWidth=max(0.0,width-start)
            if(!m.wave) box("active-indicator","Active indicator",if(rtl) width-fill else 0.0,y,fill,t,active,activeShape)
            if(!m.wave || m.fraction<1) box("track","Track",if(rtl) 0.0 else start,y,trackWidth,t,track,trackShape)
            // An invalid negative CSS size falls back to auto, whose empty
            // absolutely positioned content has no inline size.
            val stopSize=max(0.0,min(m.stopSize,m.thickness))
            box("stop-indicator","Stop indicator",if(rtl) m.trailing else width-m.trailing-stopSize,
                (height-stopSize)/2,stopSize,stopSize,stop,stopShape)
            if(m.wave) path("active-indicator","Active wave",if(fill<=0) "" else ProgressGeometry.linear(m,
                if(rtl) width-fill else 0.0,if(rtl) width else fill,motion.amplitude,motion.wavePhase,true),active)
        }
        return items
    }
    val radius=m.radius;val center=m.size/2
    val circleBounds=progressBox(center-radius,center-radius,2*radius,2*radius)
    fun circlePath(start:Double=0.0,sweep:Double=1.0):String {
        if(sweep>=1-1e-4) return ProgressGeometry.arc(m,-PI/2,-PI/2+PI)+" "+ProgressGeometry.arc(m,-PI/2+PI,-PI/2+2*PI)
        if(sweep<=0) {
            // SVG zero-length dashed circle with round caps paints a dot.
            val angle=-PI/2+start*2*PI;val x=center+radius*cos(angle);val y=center+radius*sin(angle)
            return "M $x $y L ${x+1e-5} $y"
        }
        return ProgressGeometry.arc(m,-PI/2+start*2*PI,-PI/2+(start+sweep)*2*PI)
    }
    if(motion.completedTrack || motion.stage==ProgressMotion.Stage.TRACK_REVEAL) {
        path("track","Track circle",circlePath(),track,m.stroke,motion.trackOpacity,partBounds=circleBounds)
        path("active-indicator","Active circle","",active,m.stroke,0.0,partBounds=circleBounds)
        return items
    }
    if(motion.completing) {
        val erasing=motion.stage==ProgressMotion.Stage.CIRCLE_ERASE
        val start=if(erasing) motion.erase else 0.0;val end=if(erasing) 1.0 else f
        path("track","Track path","",track,m.stroke,0.0,partBounds=if(m.wave) null else circleBounds)
        path("active-indicator","Completing indicator",if(end-start<1e-4) "" else ProgressGeometry.waveArc(m,-PI/2+start*2*PI,-PI/2+end*2*PI,
            if(m.wave) motion.amplitude else 0.0,motion.wavePhase),active,m.stroke,motion.completionOpacity(),partBounds=if(m.wave) null else circleBounds)
        return items
    }
    if(m.wave) {
        val spin=motion.waveSpin()
        val paths=ProgressGeometry.circular(m,f,motion.amplitude,motion.wavePhase,spin.sweep,if(m.indeterminate) spin.rotation else 0.0)
        path("track","Track path",paths.track,track,m.stroke)
        path("active-indicator","Active path",paths.active,active,m.stroke,rotation=paths.rotation)
        return items
    }
    if(m.indeterminate) {
        val spin=ProgressGeometry.flatSpin(motion.elapsed,reduced)
        val gap=(4+m.thickness)/(2*PI*radius);val trackFraction=max(.0001,min(1.0,1-spin.sweep-2*gap))
        path("track","Track circle",circlePath(-spin.offset+spin.sweep+gap,trackFraction),track,m.stroke,rotation=spin.rotation,partBounds=circleBounds)
        val color=if(m.fourColor && !forced) ProgressGeometry.color(motion.elapsed,reduced).let { (i,p) -> lerp(cycle[i],cycle[(i+1)%4],p.toFloat()) } else active
        path("active-indicator","Active circle",circlePath(-spin.offset,spin.sweep),color,m.stroke,rotation=spin.rotation,partBounds=circleBounds)
    } else {
        val gap=(4+m.thickness)/(2*PI*radius)
        val remaining=1-f-2*gap;val fade=m.thickness/(2*PI*radius)
        val opacity=when { f<=1e-4 -> 1.0;f>=1-1e-4 || remaining<=1e-4 -> 0.0;remaining<fade -> (remaining/fade).coerceIn(0.0,1.0);else -> 1.0 }
        val trackStart=if(remaining<fade) 1-gap-fade else f+gap
        val data=if(f<=1e-4) circlePath() else circlePath(trackStart,max(fade,remaining))
        path("track","Track circle",data,track,m.stroke,opacity,partBounds=circleBounds)
        path("active-indicator","Active circle",circlePath(0.0,f),active,m.stroke,partBounds=circleBounds)
    }
    return items
}
