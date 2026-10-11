package dev.awc.nativeui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.unit.Dp
import kotlinx.coroutines.isActive

/** Source md-loading-indicator.css 48-vertex polygons, 4.55s spring morph and rotation. */
internal object NativeButtonLoadingMotion {
    const val duration = 4.55f
    val offsets = listOf(0f,.143f,.286f,.429f,.571f,.714f,.857f,1f)
    val rotations = listOf(0f,154f,309f,463f,617f,771f,926f,1080f)
    private val raw = listOf(
        "50,5.3 55.4,9.1 59.3,15.3 64,16.1 71.2,13.3 77.1,14.7 78.3,21.7 78.1,28.4 82.6,31.2 90,33.4 92.6,38.6 88.4,44.9 85.3,50 88.4,55.1 92.6,61.4 90,66.6 82.6,68.8 78.1,71.6 78.3,78.3 77.1,85.3 71.2,86.7 64,83.9 59.3,84.7 55.4,90.9 50,94.7 44.6,90.9 40.7,84.7 36,83.9 28.8,86.7 22.9,85.3 21.7,78.3 21.9,71.6 17.4,68.8 10,66.6 7.4,61.4 11.6,55.1 14.7,50 11.6,44.9 7.4,38.6 10,33.4 17.4,31.2 21.9,28.4 21.7,21.7 22.9,14.7 28.8,13.3 36,16.1 40.7,15.3 44.6,9.1",
        "50,6.8 55.4,9.1 59.8,13.6 64.2,15.8 70,15.4 76.2,15.9 79.9,20.1 80.8,26.4 81.8,31.6 85.8,35.2 90.8,39.1 92.6,44.4 90,50 86.7,54.8 86.4,59.8 88.1,65.8 87.4,71.6 82.7,75.1 76.7,76.7 72.5,79.4 70,84.6 66.4,89.7 60.9,90.8 55.1,88.4 50,86.8 44.9,88.4 39.1,90.8 33.6,89.7 30,84.6 27.5,79.4 23.3,76.7 17.3,75.1 12.6,71.6 11.9,65.8 13.6,59.8 13.3,54.8 10,50 7.4,44.4 9.2,39.1 14.2,35.2 18.2,31.6 19.2,26.4 20.1,20.1 23.8,15.9 30,15.4 35.8,15.8 40.2,13.6 44.6,9.1",
        "50,6.8 55.4,8.9 60,12.7 63.9,16.4 67.5,19.7 71.1,22.5 75,25 79.5,27.4 84.4,30.1 89.3,33.7 91.4,38.9 90,44.7 87.6,50 85.4,54.7 83.5,59 82.1,63.3 81.2,68 80.2,73.2 78.9,78.9 76.3,84.2 71,86.4 65,86.2 59.5,85.5 54.6,84.8 50,84.6 45.4,84.8 40.5,85.5 35,86.2 29,86.4 23.7,84.2 21.1,78.9 19.8,73.2 18.8,68 17.9,63.3 16.5,59 14.6,54.7 12.4,50 10,44.7 8.6,38.9 10.7,33.7 15.6,30.1 20.5,27.4 25,25 28.9,22.5 32.5,19.7 36.1,16.4 40,12.7 44.6,8.9",
        "50,5.1 55.8,5.6 61.5,7.3 66.6,9.9 71.1,13.4 74.8,17.6 77.6,22.4 79.5,27.4 80.3,32.5 80.1,37.5 79.1,42.2 77.5,46.4 76.4,50 77.5,53.6 79.1,57.8 80.1,62.5 80.3,67.5 79.5,72.6 77.6,77.6 74.8,82.4 71.1,86.6 66.6,90.1 61.5,92.7 55.8,94.4 50,94.9 44.2,94.4 38.5,92.7 33.4,90.1 28.9,86.6 25.2,82.4 22.4,77.6 20.5,72.6 19.7,67.5 19.9,62.5 20.9,57.8 22.5,53.6 23.6,50 22.5,46.4 20.9,42.2 19.9,37.5 19.7,32.5 20.5,27.4 22.4,22.4 25.2,17.6 28.9,13.4 33.4,9.9 38.5,7.3 44.2,5.6",
        "50,3.4 55.7,7.1 59.5,14.5 62.8,19.1 68.4,18.2 76.4,15.7 82.9,17.1 84.3,23.6 81.8,31.6 80.9,37.2 85.5,40.5 92.9,44.3 96.6,50 92.9,55.7 85.5,59.5 80.9,62.8 81.8,68.4 84.3,76.4 82.9,82.9 76.4,84.3 68.4,81.8 62.8,80.9 59.5,85.5 55.7,92.9 50,96.6 44.3,92.9 40.5,85.5 37.2,80.9 31.6,81.8 23.6,84.3 17.1,82.9 15.7,76.4 18.2,68.4 19.1,62.8 14.5,59.5 7.1,55.7 3.4,50 7.1,44.3 14.5,40.5 19.1,37.2 18.2,31.6 15.7,23.6 17.1,17.1 23.6,15.7 31.6,18.2 37.2,19.1 40.5,14.5 44.3,7.1",
        "50,18.1 54.2,17.7 58.9,16.8 64.3,15.5 70.5,14.5 77,14.8 82.4,17.6 85.2,23 85.5,29.5 84.5,35.7 83.2,41.1 82.3,45.8 81.9,50 82.3,54.2 83.2,58.9 84.5,64.3 85.5,70.5 85.2,77 82.4,82.4 77,85.2 70.5,85.5 64.3,84.5 58.9,83.2 54.2,82.3 50,81.9 45.8,82.3 41.1,83.2 35.7,84.5 29.5,85.5 23,85.2 17.6,82.4 14.8,77 14.5,70.5 15.5,64.3 16.8,58.9 17.7,54.2 18.1,50 17.7,45.8 16.8,41.1 15.5,35.7 14.5,29.5 14.8,23 17.6,17.6 23,14.8 29.5,14.5 35.7,15.5 41.1,16.8 45.8,17.7",
        "50,14.5 54.9,12.8 60.3,11.6 66.1,11.2 72,11.9 77.7,13.9 82.5,17.5 86.1,22.3 88.1,28 88.8,33.9 88.4,39.7 87.2,45.1 85.5,50 83.5,54.4 81.3,58.4 79,62 76.5,65.3 73.9,68.4 71.2,71.2 68.4,73.9 65.3,76.5 62,79 58.4,81.3 54.4,83.5 50,85.5 45.1,87.2 39.7,88.4 33.9,88.8 28,88.1 22.3,86.1 17.5,82.5 13.9,77.7 11.9,72 11.2,66.1 11.6,60.3 12.8,54.9 14.5,50 16.5,45.6 18.7,41.6 21,38 23.5,34.7 26.1,31.6 28.8,28.8 31.6,26.1 34.7,23.5 38,21 41.6,18.7 45.6,16.5",
        "50,5.3 55.4,9.1 59.3,15.3 64,16.1 71.2,13.3 77.1,14.7 78.3,21.7 78.1,28.4 82.6,31.2 90,33.4 92.6,38.6 88.4,44.9 85.3,50 88.4,55.1 92.6,61.4 90,66.6 82.6,68.8 78.1,71.6 78.3,78.3 77.1,85.3 71.2,86.7 64,83.9 59.3,84.7 55.4,90.9 50,94.7 44.6,90.9 40.7,84.7 36,83.9 28.8,86.7 22.9,85.3 21.7,78.3 21.9,71.6 17.4,68.8 10,66.6 7.4,61.4 11.6,55.1 14.7,50 11.6,44.9 7.4,38.6 10,33.4 17.4,31.2 21.9,28.4 21.7,21.7 22.9,14.7 28.8,13.3 36,16.1 40.7,15.3 44.6,9.1"
    )
    val polygons = raw.map { polygon -> polygon.split(" ").map { point -> val (x,y)=point.split(",").map(String::toFloat); Offset(x/100f,y/100f) } }
    fun sample(elapsed: Float): Pair<List<Offset>,Float> {
        val progress=(elapsed.coerceAtLeast(0f)%duration)/duration
        val index=(0 until offsets.lastIndex).firstOrNull { progress < offsets[it+1] } ?: offsets.lastIndex-1
        val fraction=(progress-offsets[index])/(offsets[index+1]-offsets[index])
        val eased=cubic(fraction,.34f,1.45f,.4f,1f)
        return polygons[index].zip(polygons[index+1]) { a,b -> a+(b-a)*eased } to (rotations[index]+(rotations[index+1]-rotations[index])*eased)
    }
    fun cubic(progress: Float,x1: Float,y1: Float,x2: Float,y2: Float): Float {
        if(progress<=0f || progress>=1f) return progress
        fun axis(t:Float,a:Float,b:Float)=3f*(1f-t)*(1f-t)*t*a+3f*(1f-t)*t*t*b+t*t*t
        var lower=0f;var upper=1f
        repeat(20) { val t=(lower+upper)/2f; if(axis(t,x1,x2)<progress) lower=t else upper=t }
        return axis((lower+upper)/2f,y1,y2)
    }
}

@Composable internal fun NativeButtonLoading(size: Dp,color: Color,reduceMotion: Boolean) {
    var elapsed by remember { mutableFloatStateOf(0f) }
    LaunchedEffect(Unit) {
        val started=withFrameNanos { it }
        while(isActive) elapsed=withFrameNanos { (it-started)/1_000_000_000f }
    }
    Canvas(Modifier.size(size)) {
        if(reduceMotion) {
            val half=elapsed%2f;val progress=if(half<1f) half else half-1f
            val eased=NativeButtonLoadingMotion.cubic(progress,.42f,0f,.58f,1f)
            drawCircle(color.copy(alpha=color.alpha*(if(half<1f) 1f-.6f*eased else .4f+.6f*eased)))
        } else {
            val (points,angle)=NativeButtonLoadingMotion.sample(elapsed)
            val path=Path().apply { points.forEachIndexed { i,p -> if(i==0) moveTo(p.x*this@Canvas.size.width,p.y*this@Canvas.size.height) else lineTo(p.x*this@Canvas.size.width,p.y*this@Canvas.size.height) };close() }
            rotate(angle) { drawPath(path,color) }
        }
    }
}
