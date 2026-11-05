package dev.awc.nativeui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.absolutePadding
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.SubcomposeLayout
import androidx.compose.ui.layout.layout
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import kotlin.math.roundToInt

/** Background and border of a source box in its own corner shape (border drawn inside the box). */
internal fun Modifier.accordionDecor(background:Color,borderWidth:Double,borderColor:Color,shape:AWCCornerShape):Modifier =
    this.then(if(background.alpha>0f) Modifier.background(background,shape) else Modifier)
        .then(if(borderWidth>0) Modifier.border(borderWidth.dp,borderColor,shape) else Modifier)

/** Physical padding plus border width (the content box inset). */
internal fun Modifier.accordionPadding(padding:AWCAccordionInsets?,border:Double):Modifier {
    val p=padding ?: AWCAccordionInsets(0.0,0.0)
    if(p.top==0.0 && p.right==0.0 && p.bottom==0.0 && p.left==0.0 && border==0.0) return this
    return absolutePadding((p.left+border).dp,(p.top+border).dp,(p.right+border).dp,(p.bottom+border).dp)
}

/** Explicit content-box (or border-box) height and minimum height of a source box. */
internal fun Modifier.accordionBoxSize(part:AWCAccordionPartAppearance,borderBox:Boolean):Modifier {
    val edges=if(borderBox) 0.0 else (part.padding?.let { it.top+it.bottom } ?: 0.0)+2*part.border
    return this.then(part.height?.let { Modifier.height((it+edges).dp) } ?: part.minHeight?.let { Modifier.heightIn(min=(it+edges).dp) } ?: Modifier)
}

/**
 * Physical CSS margins (negative values allowed). A block box fills the containing width
 * minus its margins; an inline/flex box wraps its content. An absent (0x0) box keeps no margin.
 */
internal fun Modifier.accordionMargin(margin:AWCAccordionInsets?,block:Boolean=false):Modifier {
    val m=margin ?: return this
    if(m.top==0.0 && m.right==0.0 && m.bottom==0.0 && m.left==0.0) return this
    return layout { measurable,constraints->
        val l=(m.left*density).roundToInt();val r=(m.right*density).roundToInt();val t=(m.top*density).roundToInt();val b=(m.bottom*density).roundToInt()
        if(block && constraints.hasBoundedWidth) {
            val w=(constraints.maxWidth-l-r).coerceAtLeast(0)
            val p=measurable.measure(Constraints(minWidth=w,maxWidth=w,maxHeight=if(constraints.hasBoundedHeight) (constraints.maxHeight-t-b).coerceAtLeast(0) else Constraints.Infinity))
            layout(constraints.maxWidth,(p.height+t+b).coerceAtLeast(0)) { p.place(l,t) }
        } else {
            val p=measurable.measure(constraints.copy(minWidth=0,minHeight=0))
            if(p.width==0 && p.height==0) layout(0,0) { p.place(0,0) }
            else layout((p.width+l+r).coerceAtLeast(0),(p.height+t+b).coerceAtLeast(0)) { p.place(l,t) }
        }
    }
}

/**
 * The header button: source `inline-size: 100%` (or an explicit border-box width) with
 * physical margins; an over-constrained margin is the end edge for the writing direction.
 * Vertical margins that collapse through the heading are applied by the item stack instead.
 */
internal fun Modifier.accordionHeaderPlacement(part:AWCAccordionPartAppearance,margin:AWCAccordionInsets,collapseTop:Boolean,collapseBottom:Boolean,rtl:Boolean):Modifier =
    layout { measurable,constraints->
        val width=constraints.maxWidth
        val w=part.width?.let { (it*density).roundToInt() } ?: width
        val top=if(collapseTop) 0 else (margin.top*density).roundToInt();val bottom=if(collapseBottom) 0 else (margin.bottom*density).roundToInt()
        val p=measurable.measure(Constraints(minWidth=w,maxWidth=w))
        val x=if(rtl) width-w-(margin.right*density).roundToInt() else (margin.left*density).roundToInt()
        layout(width,(p.height+top+bottom).coerceAtLeast(0)) { p.place(x,top) }
    }

/** Content box of a slot host: a fixed centered square/rect, or (null) the full available width. */
internal data class AccordionBoxFrame(val width:Dp?,val height:Dp?,val padding:AWCAccordionInsets?,val border:Double)

/**
 * Authored slot content (explicit registry or the AWCComponent content lambda) replaces a
 * fallback. The host is absent (0x0, so no gap or margin) when neither exists; otherwise it
 * lays the content out in the frame's content box inside its physical padding and border.
 */
@Composable internal fun AccordionSlotHost(name:String,slot:Slot?,modifier:Modifier,frame:AccordionBoxFrame,fallback:(@Composable ()->Unit)?) {
    val registry=LocalAWCSlots.current
    SubcomposeLayout(modifier) { constraints->
        val authored=if(name.isEmpty()) emptyList() else subcompose("authored") {
            androidx.compose.runtime.CompositionLocalProvider(LocalAWCSlots provides null) { if(registry?.contains(name)==true) registry.Render(name) else slot?.invoke(name) } }
        val used=authored.ifEmpty { subcompose("fallback") { fallback?.invoke() } }
        if(used.isEmpty()) return@SubcomposeLayout layout(0,0) {}
        val p=frame.padding ?: AWCAccordionInsets(0.0,0.0);val b=frame.border
        val l=((p.left+b)*density).roundToInt();val r=((p.right+b)*density).roundToInt();val t=((p.top+b)*density).roundToInt();val bt=((p.bottom+b)*density).roundToInt()
        if(frame.width!=null && frame.height!=null) {
            val cw=frame.width.roundToPx();val ch=frame.height.roundToPx()
            val placeables=used.map { it.measure(Constraints()) }
            layout(cw+l+r,ch+t+bt) { placeables.forEach { it.place(l+(cw-it.width)/2,t+(ch-it.height)/2) } }
        } else {
            val inner=(if(constraints.hasBoundedWidth) constraints.maxWidth else 0)-l-r
            val placeables=used.map { it.measure(Constraints(minWidth=inner.coerceAtLeast(0),maxWidth=inner.coerceAtLeast(0))) }
            val ch=placeables.maxOf { it.height }
            layout((inner+l+r).coerceAtLeast(0),(ch+t+bt).coerceIn(constraints.minHeight,constraints.maxHeight)) { placeables.forEach { it.place(l,t+(ch-it.height)/2) } }
        }
    }
}

/** Single-line source text (`white-space: nowrap; text-overflow: ellipsis`). */
@Composable internal fun AccordionText(text:String,style:TextStyle) {
    Text(text,style=style,maxLines=1,softWrap=false,overflow=TextOverflow.Ellipsis)
}
