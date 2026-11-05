package dev.awc.nativeui

import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.*
import kotlin.math.*

/** Tight native contour bounds, excluding the stroke, like an SVG path's box.
 * Path.getBounds() includes Bézier controls that can lie outside the contour. */
internal fun progressTightBounds(path:Path):Rect {
    var left=Double.POSITIVE_INFINITY;var top=left
    var right=Double.NEGATIVE_INFINITY;var bottom=right
    fun point(x:Double,y:Double) { left=min(left,x);top=min(top,y);right=max(right,x);bottom=max(bottom,y) }
    fun roots(a:Double,b:Double,c:Double):List<Double> {
        if(abs(a)<1e-12) return if(abs(b)<1e-12) emptyList() else listOf(-c/b)
        val d=b*b-4*a*c
        if(d<0) return emptyList()
        return listOf((-b+sqrt(d))/(2*a),(-b-sqrt(d))/(2*a))
    }
    // SVG arcs are converted by the native parser to cubics. The conic option
    // also covers future native arc paths without sampling away their extrema.
    val iterator=path.iterator(PathIterator.ConicEvaluation.AsQuadratics,.0001f)
    for(segment in iterator) {
        val p=segment.points
        when(segment.type) {
            PathSegment.Type.Move -> point(p[0].toDouble(),p[1].toDouble())
            PathSegment.Type.Line -> { point(p[0].toDouble(),p[1].toDouble());point(p[2].toDouble(),p[3].toDouble()) }
            PathSegment.Type.Quadratic -> {
                fun at(i:Int,t:Double)=(1-t)*(1-t)*p[i]+2*(1-t)*t*p[i+2]+t*t*p[i+4]
                point(p[0].toDouble(),p[1].toDouble());point(p[4].toDouble(),p[5].toDouble())
                for(i in 0..1) {
                    val denominator=p[i]-2*p[i+2]+p[i+4]
                    if(abs(denominator)>1e-12) {
                        val t=(p[i]-p[i+2])/denominator.toDouble()
                        if(t>0 && t<1) point(at(0,t),at(1,t))
                    }
                }
            }
            PathSegment.Type.Cubic -> {
                fun at(i:Int,t:Double)=(1-t).pow(3)*p[i]+3*(1-t).pow(2)*t*p[i+2]+3*(1-t)*t*t*p[i+4]+t*t*t*p[i+6]
                point(p[0].toDouble(),p[1].toDouble());point(p[6].toDouble(),p[7].toDouble())
                for(i in 0..1) {
                    val a=-p[i]+3.0*p[i+2]-3.0*p[i+4]+p[i+6]
                    val b=2.0*(p[i]-2*p[i+2]+p[i+4]);val c=(p[i+2]-p[i]).toDouble()
                    for(t in roots(a,b,c)) if(t>0 && t<1) point(at(0,t),at(1,t))
                }
            }
            else -> Unit
        }
    }
    return if(left.isFinite()) Rect(left.toFloat(),top.toFloat(),right.toFloat(),bottom.toFloat()) else Rect.Zero
}

/** Indeterminate source animation reflects its entire physical paint group. */
internal fun progressMirroredShape(shape:Shape):Shape = object:Shape {
    override fun createOutline(size:androidx.compose.ui.geometry.Size,
        layoutDirection:androidx.compose.ui.unit.LayoutDirection,density:androidx.compose.ui.unit.Density):Outline {
        val path=Path().apply { addOutline(shape.createOutline(size,layoutDirection,density)) }
        path.transform(Matrix().apply { translate(size.width,0f);scale(-1f,1f) })
        return Outline.Generic(path)
    }
}
