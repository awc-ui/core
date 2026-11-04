package dev.awc.nativeui

import androidx.compose.animation.core.*
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.*
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.layout.*
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.*
import androidx.compose.ui.text.*
import androidx.compose.ui.text.font.*
import androidx.compose.ui.text.style.*
import androidx.compose.ui.unit.*
import kotlin.math.*

/** Exact native range data, alongside Android's Float-based accessibility range. */
data class AWCMeterRange(val minimum:Double,val maximum:Double,val value:Double)
val AWCMeterRangeKey=SemanticsPropertyKey<AWCMeterRange>("AWC read-only meter range")
internal data class NativeMeterMetrics(val minimum:Double,val maximum:Double,val value:Double,val fraction:Double,
    val density:Double,val height:Double,val size:Double,val userSize:Double,val stroke:Double,val radius:Double,
    val labelFont:Double,val labelLine:Double,val valueFont:Double,val valueLine:Double,val gap:Double) {
    companion object {
        fun from(p:Props,a:AWCMeterAppearance,inherited:Double):NativeMeterMetrics {
            fun finite(key:String,default:Double)=(p[key] as? Number)?.toDouble()?.takeIf { it.isFinite() } ?: default
            val low=finite("min",0.0);val high=max(low,finite("max",100.0));val value=min(high,max(low,finite("value",low)))
            val span=high-low
            val fraction=if(high==low) 0.0 else (if(span.isFinite()) (value-low)/span else (value/2-low/2)/(high/2-low/2)).coerceIn(0.0,1.0)
            val density=resolveAWCDensity(p["density"],inherited)
            val thickness=finite("thickness",4.0)
            val rawSize=finite("size",48.0).takeIf { it>0 } ?: 48.0;val userSize=rawSize.coerceIn(24.0,240.0)
            val stroke=thickness.takeIf { it>0 } ?: 4.0
            return NativeMeterMetrics(low,high,value,fraction,density,a.height ?: max(2.0,thickness+density*.5),a.size ?: max(24.0,userSize+2*density),userSize,stroke,max(.5,(userSize-stroke)/2),
                max(11.0,14+density*.5),max(14.0,20+density),max(10.0,12+density*.5),max(12.0,16+density),max(2.0,4+density*.5))
        }
    }
}
private val MeterFont=FontFamily(Font(R.font.awc_roboto_regular,FontWeight.Normal),Font(R.font.awc_roboto_medium,FontWeight.Medium))
private val MeterEasing=CubicBezierEasing(.2f,0f,0f,1f)
private fun meterVisualText(value:String)=value.replace(Regex("[\\t\\n\\r\\u000C ]+")," ").trim(' ')

@Composable internal fun NativeMeter(p:Props) {
    if(p.bool("hidden")) return
    val appearance=LocalAWCMeterAppearance.current.normalized()
    val m=NativeMeterMetrics.from(p,appearance,LocalAWCNativeDensity.current)
    val colors=MaterialTheme.colorScheme;val tokens=LocalAWCThemeTokens.current
    val colorRole=p.str("color","primary").takeIf { it!="primary" && it.matches(Regex("[a-zA-Z][a-zA-Z0-9-]*")) }
    fun token(name:String,fallback:Color)=tokens[name]?.let { awcColor(it,fallback) } ?: fallback
    val (reduced,forced)=rememberAWCAccessibilityAppearance()
    val indicator=if(forced) colors.onSurface else appearance.indicatorColor?.let(::statusDotColor)
        ?: colorRole?.let { token("--md-sys-color-$it",colors.primary) } ?: colors.primary
    val track=if(forced) colors.outline else appearance.trackColor?.let(::statusDotColor)
        ?: colorRole?.let { token("--md-sys-color-$it-container",colors.secondaryContainer) } ?: colors.secondaryContainer
    val labelInk=appearance.labelColor?.let(::statusDotColor) ?: colors.onSurface
    val valueInk=appearance.valueColor?.let(::statusDotColor) ?: colors.onSurfaceVariant
    val radius=appearance.trackShape ?: AWCCornerShape.uniform(points=9999.0)
    val label=p.str("label")
    val formatted=remember(m.value,m.fraction,p["valueText"],p["locale"],p["formatOptions"]) {
        MeterNumberFormat.format(m.value,m.fraction,p.str("valueText"),p.str("locale"),p["formatOptions"])
    }
    val circular=p.str("variant")=="circular"
    val rtl=when(p.str("dir")) { "rtl"->true;"ltr"->false;else->LocalLayoutDirection.current==LayoutDirection.Rtl }
    val safeFraction=m.fraction.takeIf { it.isFinite() }?.coerceIn(0.0,1.0)?.toFloat() ?: 0f
    val fraction by animateFloatAsState(safeFraction,tween(if(reduced) 0 else 300,easing=MeterEasing),label="Meter reading")
    val opacity by animateFloatAsState(if(safeFraction>0) 1f else 0f,tween(if(reduced) 0 else 200,easing=LinearEasing),label="Meter arc opacity")
    val inspection=LocalAWCInspection.current
    fun nativeFloat(value:Double)=value.coerceIn(-Float.MAX_VALUE.toDouble(),Float.MAX_VALUE.toDouble()).toFloat()
    val semantics=Modifier.clearAndSetSemantics {
        if(label.isNotEmpty()) contentDescription=label
        stateDescription=formatted
        this[AWCMeterRangeKey]=AWCMeterRange(m.minimum,m.maximum,m.value)
        progressBarRangeInfo=ProgressBarRangeInfo(nativeFloat(m.value),nativeFloat(m.minimum)..nativeFloat(m.maximum))
    }
    val root=semantics.inspectAWCNode(inspection,"","md-meter",AWCInspectionMetrics(
        padding=AWCInspectionInsets(),margin=AWCInspectionInsets(),border=AWCInspectionInsets(),
        display=if(circular) "Compose Column" else "Compose Layout",direction=if(rtl) "rtl" else "ltr"),allowZeroSize=true)
    CompositionLocalProvider(LocalLayoutDirection provides if(rtl) LayoutDirection.Rtl else LayoutDirection.Ltr) {
        SubcomposeLayout(root) { constraints ->
            fun px(value:Double)=(value*density).coerceIn(0.0,32766.0).roundToInt()
            val gap=px(m.gap)
            if(circular) {
                val size=px(m.size)
                // All dependent dimensions use the diameter Compose can really
                // measure, including when an accepted finite hook exceeds its
                // physical layout range.
                val appliedSize=size/density.toDouble()
                val valuePadding=px(appliedSize*.18)/density.toDouble()
                val valueFont=appliedSize*.26
                val caption=if(p.bool("showLabel")) subcompose("caption") {
                    MeterText(meterVisualText(label),m.labelFont,m.labelLine,400,.25,labelInk,"label",true,overflowAtStart=true)
                }.single().measure(Constraints(maxWidth=(size*2).coerceAtMost(32766))) else null
                val ring=subcompose("circular") {
                    Layout(modifier=Modifier.inspectAWCNode(inspection,"circular","Circular",AWCInspectionMetrics(display="Compose Layout"),allowZeroSize=true),content={
                        Canvas(Modifier.fillMaxSize().clipToBounds()) {
                            val scaledRadius=(m.radius*(this.size.width/m.userSize)).toFloat()
                            // Beyond this finite width the stroke already
                            // covers every pixel in the clipped SVG-equivalent
                            // viewport. Avoid sending Infinity to native Skia.
                            val paintLimit=2*(hypot(this.size.width/2.0,this.size.height/2.0)+scaledRadius)
                            val width=min(m.stroke*(this.size.width/m.userSize),paintLimit).toFloat()
                            val center=Offset(this.size.width/2,this.size.height/2)
                            drawCircle(track,scaledRadius,center,style=Stroke(width))
                            if(fraction>0 && opacity>0) drawArc(indicator.copy(alpha=indicator.alpha*opacity),-90f,360f*fraction,false,
                                Offset(center.x-scaledRadius,center.y-scaledRadius),Size(scaledRadius*2,scaledRadius*2),style=Stroke(width,cap=StrokeCap.Round))
                        }
                        Box(Modifier.inspectAWCNode(inspection,"track","Track path",AWCInspectionMetrics(display="Compose circle path"),allowZeroSize=true))
                        Box(Modifier.inspectAWCNode(inspection,"indicator","Indicator path",AWCInspectionMetrics(display="Compose circle path"),allowZeroSize=true))
                        if(p.bool("showValue")) Box(Modifier.inspectAWCNode(inspection,"value","Value",AWCInspectionMetrics(
                            padding=AWCInspectionInsets(valuePadding,valuePadding,valuePadding,valuePadding),
                            typography=AWCInspectionTypography(valueFont,valueFont,500,0.0,"Roboto")),allowZeroSize=true),contentAlignment=androidx.compose.ui.Alignment.Center) {
                            MeterText(meterVisualText(formatted),valueFont,valueFont,500,0.0,valueInk,null,true,Modifier.padding(valuePadding.toFloat().dp))
                        }
                    }) { children,_ ->
                        val canvas=children[0].measure(Constraints.fixed(size,size))
                        val exactPath=if(size>0) 2*m.radius*size/m.userSize else 0.0
                        val path=exactPath.roundToInt().coerceIn(0,32766)
                        val trackBox=children[1].measure(Constraints.fixed(path,path));val fillBox=children[2].measure(Constraints.fixed(path,path))
                        val valueBox=children.getOrNull(3)?.measure(Constraints.fixed(size,size))
                        layout(size,size) {
                            canvas.place(0,0)
                            // Layout dimensions are integral pixels; the drawn
                            // circle path is fractional. A measured transform
                            // keeps its actual part bounds centered and exact.
                            for(box in listOf(trackBox,fillBox)) box.placeWithLayer((size-path)/2,(size-path)/2) {
                                translationX=(size-path)/2f-(size-path)/2;translationY=translationX
                                scaleX=if(path>0) (exactPath/path).toFloat() else 1f;scaleY=scaleX
                            }
                            valueBox?.place(0,0)
                        }
                    }
                }.single().measure(Constraints.fixed(size,size))
                val width=max(size,caption?.width ?: 0);val height=size+(caption?.let { gap+it.height } ?: 0)
                layout(width,height) {
                    ring.placeWithLayer((width-size)/2,0) { translationX=(width-size)/2f-(width-size)/2 }
                    caption?.placeWithLayer((width-caption.width)/2,size+gap) { translationX=(width-caption.width)/2f-(width-caption.width)/2 }
                }
            } else {
                val width=if(constraints.hasBoundedWidth) constraints.maxWidth else constraints.minWidth
                val value=if(p.bool("showValue")) subcompose("value") {
                    MeterText(meterVisualText(formatted),m.valueFont,m.valueLine,500,.5,valueInk,"value",false)
                }.single().measure(Constraints()) else null
                val label=if(p.bool("showLabel")) subcompose("label") {
                    MeterText(meterVisualText(label),m.labelFont,m.labelLine,400,.25,labelInk,"label",false,ellipsis=true)
                }.single().measure(Constraints(maxWidth=max(0,width-(value?.let { it.width+8.dp.roundToPx() } ?: 0)))) else null
                val header=p.bool("showLabel") || p.bool("showValue")
                val baseline=max(label?.get(FirstBaseline)?.takeIf { it!=AlignmentLine.Unspecified } ?: 0,value?.get(FirstBaseline)?.takeIf { it!=AlignmentLine.Unspecified } ?: 0)
                fun offset(child:Placeable?)=child?.get(FirstBaseline)?.takeIf { it!=AlignmentLine.Unspecified }?.let { baseline-it } ?: 0
                val headerHeight=max((label?.height ?: 0)+offset(label),(value?.height ?: 0)+offset(value))
                val trackHeight=px(m.height)
                val bar=subcompose("track") {
                    Layout(modifier=Modifier.inspectAWCNode(inspection,"track","Track",AWCInspectionMetrics(display="Compose Layout"),allowZeroSize=true).clip(radius).background(track),content={
                        Box(Modifier.inspectAWCNode(inspection,"indicator","Indicator",AWCInspectionMetrics(display="Compose Box"),allowZeroSize=true).clip(radius).background(indicator))
                    }) { fill,_ ->
                        val fillWidth=(width*fraction).roundToInt().coerceIn(0,width)
                        val child=fill.single().measure(Constraints.fixed(fillWidth,trackHeight))
                        layout(width,trackHeight) { child.place(if(rtl) width-fillWidth else 0,0) }
                    }
                }.single().measure(Constraints.fixed(width,trackHeight))
                val trackY=if(header) headerHeight+gap else 0
                layout(width,trackY+trackHeight) {
                    label?.place(if(rtl) width-label.width else 0,offset(label))
                    value?.place(if(label==null) { if(rtl) width-value.width else 0 } else if(rtl) 0 else width-value.width,offset(value))
                    bar.place(0,trackY)
                }
            }
        }
    }
}

@Composable private fun MeterText(text:String,font:Double,line:Double,weight:Int,spacing:Double,color:Color,part:String?,wrap:Boolean,modifier:Modifier=Modifier,ellipsis:Boolean=false,overflowAtStart:Boolean=false) {
    val inspection=LocalAWCInspection.current
    val context=LocalContext.current
    val face=remember(weight) { context.resources.getFont(if(weight<500) R.font.awc_roboto_regular else R.font.awc_roboto_medium) }
    val direction=LocalLayoutDirection.current
    val measured=if(part==null) modifier else modifier.inspectAWCNode(inspection,part,if(part=="label") "Label" else "Value",AWCInspectionMetrics(
        typography=AWCInspectionTypography(font,line,weight,spacing,"Roboto")),allowZeroSize=true)
    if(text.isEmpty() || font<=0) Layout(content={},modifier=measured) { _,_->layout(0,0){} }
    else {
        // Android fallback fonts may have taller glyph bounds than the CSS line
        // box. Keep those glyphs visible without letting them enlarge layout.
        val result=remember { arrayOfNulls<TextLayoutResult>(1) }
        Layout(modifier=measured,content={
            Text(text,modifier=Modifier.clearAndSetSemantics {},color=color,softWrap=wrap,maxLines=if(ellipsis) 1 else Int.MAX_VALUE,
                overflow=if(ellipsis) TextOverflow.Ellipsis else TextOverflow.Visible,onTextLayout={ result[0]=it },
                style=TextStyle(fontFamily=MeterFont,fontSize=font.toFloat().sp,lineHeight=line.toFloat().sp,fontWeight=FontWeight(weight),
                    letterSpacing=spacing.toFloat().sp,fontFeatureSettings=if(weight==500) "'tnum' 1, 'kern' 1" else "'kern' 1",textAlign=if(wrap) TextAlign.Center else TextAlign.Start,
                    textMotion=TextMotion.Animated,platformStyle=PlatformTextStyle(includeFontPadding=false),
                    lineHeightStyle=LineHeightStyle(LineHeightStyle.Alignment.Center,LineHeightStyle.Trim.None,LineHeightStyle.Mode.Fixed)))
        }) { children,constraints ->
            val child=children.single()
            // Compose's intrinsic width includes an extra ceiling/guard pixel.
            // Use the same native font's unrounded shaped advances for the CSS
            // content box; keep native Text responsible for actual glyph paint.
            val paint=android.text.TextPaint(android.graphics.Paint.ANTI_ALIAS_FLAG or android.graphics.Paint.SUBPIXEL_TEXT_FLAG).apply {
                typeface=face;textSize=font.toFloat().sp.toPx();letterSpacing=(spacing/font).toFloat();isLinearText=true
                fontFeatureSettings=if(weight==500) "'tnum' 1, 'kern' 1" else "'kern' 1"
            }
            val bidi=java.text.Bidi(text,if(direction==LayoutDirection.Rtl) java.text.Bidi.DIRECTION_RIGHT_TO_LEFT else java.text.Bidi.DIRECTION_LEFT_TO_RIGHT)
            var advance=0f
            for(i in 0 until bidi.runCount) {
                val start=bidi.getRunStart(i);val end=bidi.getRunLimit(i)
                advance+=paint.getRunAdvance(text,start,end,start,end,bidi.getRunLevel(i)%2==1,end)
            }
            val natural=ceil(advance).toInt()
            val width=constraints.constrainWidth(natural)
            // CSS normal wrapping does not break an unbroken word. Its line
            // overflows the bounded caption/center while normal words wrap.
            val textWidth=if(wrap) max(width,child.minIntrinsicWidth(Constraints.Infinity)) else width
            val placed=child.measure(Constraints(minWidth=textWidth,maxWidth=textWidth))
            val count=result[0]?.lineCount ?: 1
            val height=(line.toFloat().sp.toPx()*count).roundToInt().coerceAtLeast(0)
            val y=(height-placed.height)/2
            val baseline=placed[FirstBaseline].takeIf { it!=AlignmentLine.Unspecified }?.plus(y) ?: height
            layout(width,height,mapOf(FirstBaseline to baseline)) {
                val x=if(wrap && overflowAtStart && textWidth>width) { if(direction==LayoutDirection.Rtl) width-textWidth else 0 }
                    else if(wrap) (width-textWidth)/2 else 0
                placed.place(x,y)
            }
        }
    }
}
