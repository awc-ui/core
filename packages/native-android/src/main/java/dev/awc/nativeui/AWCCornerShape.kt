package dev.awc.nativeui

import androidx.compose.runtime.Immutable
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.RoundRect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Outline
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.LayoutDirection
import java.math.BigDecimal
import java.math.MathContext
import kotlin.math.max
import kotlin.math.min

/** A radius in dp plus a fraction of the corresponding box dimension. */
@Immutable data class AWCCornerLength(val points:Double=0.0,val fraction:Double=0.0) {
    internal val values get()=mapOf("points" to points,"fraction" to fraction)
}
@Immutable data class AWCCornerRadius(
    val x:AWCCornerLength=AWCCornerLength(),val y:AWCCornerLength=AWCCornerLength(),
) {
    internal val values get()=mapOf("x" to x.values,"y" to y.values)
}

/** Physical CSS corner order; RTL does not swap these authored radii. */
@Immutable data class AWCCornerShape(
    val topLeft:AWCCornerRadius=AWCCornerRadius(),val topRight:AWCCornerRadius=AWCCornerRadius(),
    val bottomRight:AWCCornerRadius=AWCCornerRadius(),val bottomLeft:AWCCornerRadius=AWCCornerRadius(),
):Shape {
    internal val values get()=mapOf("topLeft" to topLeft.values,"topRight" to topRight.values,
        "bottomRight" to bottomRight.values,"bottomLeft" to bottomLeft.values)
    internal fun radii(width:Double,height:Double):List<Pair<Double,Double>> {
        val w=width.takeIf { it.isFinite() }?.coerceAtLeast(0.0) ?: 0.0;val h=height.takeIf { it.isFinite() }?.coerceAtLeast(0.0) ?: 0.0
        val lengths=listOf(topLeft,topRight,bottomRight,bottomLeft).flatMap { listOf(it.x,it.y) }
            .map { AWCCornerLength(it.points.takeIf(Double::isFinite) ?: 0.0,it.fraction.takeIf(Double::isFinite) ?: 0.0) }
        val raw=lengths.mapIndexed { i,value -> max(0.0,value.points+value.fraction*if(i%2==0) w else h) }
        val sums=listOf(raw[0]+raw[2],raw[6]+raw[4],raw[1]+raw[7],raw[3]+raw[5])
        if(raw.all { it.isFinite() } && sums.all { it.isFinite() }) {
            val scale=sums.mapIndexed { i,sum -> if(sum>0) (if(i<2) w else h)/sum else 1.0 }.fold(1.0,::min)
            return (0..3).map { raw[it*2]*scale to raw[it*2+1]*scale }
        }
        // Finite authored coefficients may overflow Double when multiplied or
        // summed. Preserve their ratios instead of producing Infinity * 0/NaN.
        val context=MathContext.DECIMAL128
        val exact=lengths.mapIndexed { i,value ->
            BigDecimal.valueOf(value.points).add(BigDecimal.valueOf(value.fraction)
                .multiply(BigDecimal.valueOf(if(i%2==0) w else h))).max(BigDecimal.ZERO)
        }
        val pairs=listOf(0 to 2,6 to 4,1 to 7,3 to 5)
        val scale=pairs.mapIndexed { i,pair ->
            val sum=exact[pair.first].add(exact[pair.second])
            if(sum.signum()>0) BigDecimal.valueOf(if(i<2) w else h).divide(sum,context) else BigDecimal.ONE
        }.fold(BigDecimal.ONE) { a,b -> a.min(b) }
        return (0..3).map { exact[it*2].multiply(scale,context).toDouble() to exact[it*2+1].multiply(scale,context).toDouble() }
    }
    override fun createOutline(size:Size,layoutDirection:LayoutDirection,density:Density):Outline {
        val scale=density.density.toDouble()
        val corners=radii(size.width/scale,size.height/scale).map { CornerRadius((it.first*scale).toFloat(),(it.second*scale).toFloat()) }
        return Outline.Rounded(RoundRect(0f,0f,size.width,size.height,corners[0],corners[1],corners[2],corners[3]))
    }
    companion object {
        fun uniform(points:Double=0.0,fraction:Double=0.0):AWCCornerShape {
            val radius=AWCCornerRadius(AWCCornerLength(points,fraction),AWCCornerLength(points,fraction))
            return AWCCornerShape(radius,radius,radius,radius)
        }
        fun fromValues(value:Any?):AWCCornerShape? {
            val root=value as? Map<*,*> ?: return null
            val names=listOf("topLeft","topRight","bottomRight","bottomLeft")
            if(root.keys.any { it !in names }) return null
            fun length(value:Any?):AWCCornerLength? {
                if(value==null) return AWCCornerLength()
                val data=value as? Map<*,*> ?: return null
                if(data.keys.any { it !in setOf("points","fraction") }) return null
                fun number(key:String)=if(!data.containsKey(key)) 0.0 else (data[key] as? Number)?.toDouble()?.takeIf { it.isFinite() }
                return AWCCornerLength(number("points") ?: return null,number("fraction") ?: return null)
            }
            fun radius(value:Any?):AWCCornerRadius? {
                if(value==null) return AWCCornerRadius()
                val data=value as? Map<*,*> ?: return null
                if(data.keys.any { it !in setOf("x","y") }) return null
                if(listOf("x","y").any { data.containsKey(it) && data[it]==null }) return null
                return AWCCornerRadius(length(data["x"]) ?: return null,length(data["y"]) ?: return null)
            }
            if(names.any { root.containsKey(it) && root[it]==null }) return null
            val corners=names.map { radius(root[it]) ?: return null }
            return AWCCornerShape(corners[0],corners[1],corners[2],corners[3])
        }
    }
}
