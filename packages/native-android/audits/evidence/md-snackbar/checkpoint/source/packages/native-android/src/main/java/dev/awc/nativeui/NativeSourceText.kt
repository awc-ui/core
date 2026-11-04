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
    onTextLayout:(TextLayoutResult)->Unit={}) {
    val context=LocalContext.current
    val weight=style.fontWeight?.weight ?: 400
    val face=remember(weight) { context.resources.getFont(when { weight>=700->R.font.awc_roboto_bold;weight>=500->R.font.awc_roboto_medium;else->R.font.awc_roboto_regular }) }
    val direction=LocalLayoutDirection.current
    val density=androidx.compose.ui.platform.LocalDensity.current
    val paint=remember(style,face,density) { android.text.TextPaint(android.graphics.Paint.ANTI_ALIAS_FLAG or android.graphics.Paint.SUBPIXEL_TEXT_FLAG).apply {
        typeface=face;textSize=with(density) { style.fontSize.toPx() };letterSpacing=style.letterSpacing.value/style.fontSize.value;isLinearText=true
    } }
    fun advance(value:String):Int {
        if(value.isEmpty()) return 0
        val bidi=java.text.Bidi(value,if(direction==LayoutDirection.Rtl) java.text.Bidi.DIRECTION_RIGHT_TO_LEFT else java.text.Bidi.DIRECTION_LEFT_TO_RIGHT)
        var width=0f
        for(i in 0 until bidi.runCount) {
            val start=bidi.getRunStart(i);val end=bidi.getRunLimit(i)
            width+=paint.getRunAdvance(value,start,end,start,end,bidi.getRunLevel(i)%2==1,end)
        }
        return if(wrap) ceil(width).toInt() else width.roundToInt()
    }
    val natural=advance(text)
    val minimum=if(wrap) text.split(Regex("\\s+")).maxOfOrNull(::advance) ?: 0 else natural
    val policy=object:MeasurePolicy {
        override fun MeasureScope.measure(measurables:List<Measurable>,constraints:Constraints):MeasureResult {
            val width=constraints.constrainWidth(natural)
            val child=measurables.single().measure(Constraints(minWidth=width,maxWidth=width,maxHeight=constraints.maxHeight))
            return layout(width,child.height) { child.place(0,0) }
        }
        override fun IntrinsicMeasureScope.minIntrinsicWidth(measurables:List<IntrinsicMeasurable>,height:Int)=minimum
        override fun IntrinsicMeasureScope.maxIntrinsicWidth(measurables:List<IntrinsicMeasurable>,height:Int)=natural
        override fun IntrinsicMeasureScope.minIntrinsicHeight(measurables:List<IntrinsicMeasurable>,width:Int)=measurables.single().minIntrinsicHeight(width)
        override fun IntrinsicMeasureScope.maxIntrinsicHeight(measurables:List<IntrinsicMeasurable>,width:Int)=measurables.single().maxIntrinsicHeight(width)
    }
    Layout(modifier=modifier,content={ Text(text,style=style,softWrap=wrap,maxLines=if(wrap) Int.MAX_VALUE else 1,overflow=TextOverflow.Visible,onTextLayout=onTextLayout) },measurePolicy=policy)
}
