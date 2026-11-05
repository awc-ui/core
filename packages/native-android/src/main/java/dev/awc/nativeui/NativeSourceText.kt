package dev.awc.nativeui

import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.*
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.text.*
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.*
import kotlin.math.*

/** CSS content boxes use shaped advances, not Compose's extra intrinsic guard
 * pixels. Native Text still owns shaping, glyph paint, wrapping and semantics. */
@Composable internal fun NativeSourceText(text:String,style:TextStyle,modifier:Modifier=Modifier,wrap:Boolean=true,
    onTextLayout:(TextLayoutResult)->Unit={},wordWrapOnly:Boolean=false,wrapAnywhere:Boolean=false) {
    val context=LocalContext.current
    val weight=style.fontWeight?.weight ?: 400
    val face=remember(weight) { context.resources.getFont(when { weight>=700->R.font.awc_roboto_bold;weight>=500->R.font.awc_roboto_medium;else->R.font.awc_roboto_regular }) }
    val direction=LocalLayoutDirection.current
    val density=androidx.compose.ui.platform.LocalDensity.current
    val paint=remember(style,face,density) { android.text.TextPaint(android.graphics.Paint.ANTI_ALIAS_FLAG or android.graphics.Paint.SUBPIXEL_TEXT_FLAG).apply {
        typeface=face;textSize=with(density) { style.fontSize.toPx() };letterSpacing=style.letterSpacing.value/style.fontSize.value;isLinearText=true
    } }
    fun advance(value:String):Float {
        if(value.isEmpty()) return 0f
        val bidi=java.text.Bidi(value,if(direction==LayoutDirection.Rtl) java.text.Bidi.DIRECTION_RIGHT_TO_LEFT else java.text.Bidi.DIRECTION_LEFT_TO_RIGHT)
        var width=0f
        for(i in 0 until bidi.runCount) {
            val start=bidi.getRunStart(i);val end=bidi.getRunLimit(i)
            width+=paint.getRunAdvance(value,start,end,start,end,bidi.getRunLevel(i)%2==1,end)
        }
        return width
    }
    val preciseNatural=advance(text)
    val natural=preciseNatural.roundToInt()
    fun graphemes(value:String):List<String> {
        val boundaries=java.text.BreakIterator.getCharacterInstance(java.util.Locale.ROOT).apply { setText(value) }
        val result=mutableListOf<String>();var start=boundaries.first();var end=boundaries.next()
        while(end!=java.text.BreakIterator.DONE) { result+=value.substring(start,end);start=end;end=boundaries.next() }
        return result
    }
    val preciseMinimum=(if(wrapAnywhere) graphemes(text) else text.split(Regex("\\s+"))).maxOfOrNull(::advance) ?: 0f
    val minimum=if(wrap) ceil(preciseMinimum).toInt() else natural
    val policy=object:MeasurePolicy {
        override fun MeasureScope.measure(measurables:List<Measurable>,constraints:Constraints):MeasureResult {
            val width=constraints.constrainWidth(natural)
            // Preserve the rounded content box while allowing the native paragraph
            // its subpixel glyph advance. A fractional last glyph must not wrap
            // just because Compose constraints are integer physical pixels.
            val paragraphWidth=if(wrap && width>=natural) max(width,ceil(preciseNatural).toInt()+1) else width // +1: Compose paragraph vs TextPaint advance
            val child=measurables.single().measure(Constraints(minWidth=paragraphWidth,maxWidth=paragraphWidth,maxHeight=constraints.maxHeight))
            return layout(width,child.height) { child.place(0,0) }
        }
        override fun IntrinsicMeasureScope.minIntrinsicWidth(measurables:List<IntrinsicMeasurable>,height:Int)=minimum
        override fun IntrinsicMeasureScope.maxIntrinsicWidth(measurables:List<IntrinsicMeasurable>,height:Int)=natural
        // Same paragraph width as measure(): a fractional last glyph must not wrap at the rounded natural width.
        override fun IntrinsicMeasureScope.minIntrinsicHeight(measurables:List<IntrinsicMeasurable>,width:Int)=measurables.single().minIntrinsicHeight(if(wrap && width>=natural) max(width,ceil(preciseNatural).toInt()+1) else width)
        override fun IntrinsicMeasureScope.maxIntrinsicHeight(measurables:List<IntrinsicMeasurable>,width:Int)=measurables.single().maxIntrinsicHeight(if(wrap && width>=natural) max(width,ceil(preciseNatural).toInt()+1) else width)
    }
    Layout(modifier=modifier,content={
        if((wordWrapOnly || wrapAnywhere) && wrap) {
            // CSS block text permits an unbreakable word to overflow its content
            // box. Android's normal paragraph layout inserts character breaks.
            // Choose word boundaries from real native shaping, then render those
            // lines with native Text so semantics and glyph rendering stay real.
            SubcomposeLayout { constraints->
                // Keep a CSS min-content box's fractional line width. Integer
                // physical constraints must not make an extra character fit.
                val available=if(wrapAnywhere && constraints.maxWidth==minimum) preciseMinimum else constraints.maxWidth.toFloat()
                val lines=mutableListOf<String>();var line=""
                for(word in text.split(' ')) {
                    val candidate=if(line.isEmpty()) word else "$line $word"
                    if(line.isNotEmpty() && advance(candidate)>available+.01f) { lines+=line;line="" }
                    if(wrapAnywhere && advance(word)>available+.01f) {
                        for(grapheme in graphemes(word)) {
                            if(line.isNotEmpty() && advance(line+grapheme)>available+.01f) { lines+=line;line="" }
                            line+=grapheme
                        }
                    } else line=if(line.isEmpty()) word else "$line $word"
                }
                if(line.isNotEmpty() || lines.isEmpty()) lines+=line
                val paragraphWidth=max(constraints.maxWidth,ceil(lines.maxOfOrNull(::advance) ?: 0f).toInt())
                val child=subcompose("paragraph") {
                    Text(lines.joinToString("\n"),style=style,softWrap=false,maxLines=Int.MAX_VALUE,overflow=TextOverflow.Visible,onTextLayout=onTextLayout)
                }.single().measure(Constraints(minWidth=paragraphWidth,maxWidth=paragraphWidth,maxHeight=constraints.maxHeight))
                layout(constraints.maxWidth,child.height) { child.place(0,0) }
            }
        } else Text(text,style=style,softWrap=wrap,maxLines=if(wrap) Int.MAX_VALUE else 1,overflow=TextOverflow.Visible,onTextLayout=onTextLayout)
    },measurePolicy=policy)
}
