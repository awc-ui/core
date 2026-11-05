package dev.awc.nativeui

import kotlin.math.*

internal data class TooltipBox(val left:Double,val top:Double,val width:Double,val height:Double)
internal data class TooltipPlacement(val left:Double,val top:Double,val side:String) {
    val originX:Float get()=when(side.substringBefore('-')) { "left"->1f;"right"->0f;else->.5f }
    val originY:Float get()=when(side.substringBefore('-')) { "top"->1f;"bottom"->0f;else->.5f }
}
internal fun nativeTooltipPlacement(anchor:TooltipBox,popupWidth:Double,popupHeight:Double,
    viewportWidth:Double,viewportHeight:Double,position:String="top",rtl:Boolean=false,
    autoPosition:Boolean=true,offset:Double=8.0,crossOffset:Double=0.0):TooltipPlacement {
    val axes=listOf("top","bottom","right","left")
    val sourceAxis=position.substringBefore('-').takeIf { it in axes } ?: "top"
    val sourceAlign=position.substringAfter('-',"").takeIf { it in setOf("start","end") }.orEmpty()
    val axis=if(rtl) when(sourceAxis) { "left"->"right";"right"->"left";else->sourceAxis } else sourceAxis
    val align=if(rtl && sourceAxis in listOf("top","bottom")) when(sourceAlign) { "start"->"end";"end"->"start";else->"" } else sourceAlign
    fun placement(axis:String)=axis+if(align.isEmpty()) "" else "-$align"
    val preferred=placement(axis)
    // Browser position calculations use offsetWidth/offsetHeight, rounded to
    // whole CSS units, even when the painted box has fractional dimensions.
    val w=floor(popupWidth+.5);val h=floor(popupHeight+.5)
    fun coordinates(side:String):Pair<Double,Double> {
        val a=side.substringBefore('-');val suffix=side.substringAfter('-',"")
        val vertical=a in listOf("top","bottom")
        val cross=when(suffix) { "start"->0.0;"end"->if(vertical) anchor.width-w else anchor.height-h;else->if(vertical) (anchor.width-w)/2 else (anchor.height-h)/2 }
        return if(vertical) anchor.left+cross to anchor.top+if(a=="top") -h-offset else anchor.height+offset
            else anchor.left+(if(a=="left") -w-offset else anchor.width+offset) to anchor.top+cross
    }
    fun fits(side:String):Boolean {
        val (x,y)=coordinates(side)
        return if(side.startsWith("top") || side.startsWith("bottom")) y>=0 && y+h<=viewportHeight else x>=0 && x+w<=viewportWidth
    }
    val opposite=placement(when(axis) { "top"->"bottom";"bottom"->"top";"left"->"right";else->"left" })
    val side=if(autoPosition) (listOf(preferred,opposite)+axes.map(::placement)).distinct().firstOrNull(::fits) ?: preferred else preferred
    var (x,y)=coordinates(side)
    if(side.startsWith("top") || side.startsWith("bottom")) {
        x+=crossOffset
        if(autoPosition) x=x.coerceIn(8.0,max(8.0,viewportWidth-w-8))
    } else {
        y+=crossOffset
        if(autoPosition) y=y.coerceIn(8.0,max(8.0,viewportHeight-h-8))
    }
    return TooltipPlacement(x,y,side)
}
