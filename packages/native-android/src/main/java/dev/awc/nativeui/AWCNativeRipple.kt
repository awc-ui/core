package dev.awc.nativeui

import android.animation.ValueAnimator
import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.foundation.interaction.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import kotlinx.coroutines.*
import kotlin.math.*

private data class NativeRippleWave(
    val press: PressInteraction.Press,val began: Long?=null,val ended: Long?=null,val released: Boolean=false,
)
private val NativeRippleEasing=CubicBezierEasing(.2f,0f,0f,1f)

/** Source ripple timing with actual pointer origins; no native Material defaults. */
@Composable
internal fun nativeSourceRipple(interactions: MutableInteractionSource,color: Color,enabled: Boolean): Modifier {
    val reduced=!ValueAnimator.areAnimatorsEnabled()
    val waves=remember { mutableStateListOf<NativeRippleWave>() }
    var now by remember { mutableLongStateOf(0) }
    LaunchedEffect(interactions,enabled,reduced) {
        waves.clear()
        var animator: Job?=null
        try {
            interactions.interactions.collect { event ->
                if(enabled) {
                    when(event) {
                        is PressInteraction.Press -> { waves+=NativeRippleWave(event);if(waves.size>4) waves.removeAt(0) }
                        is PressInteraction.Release -> waves.indexOfFirst { it.press==event.press }.takeIf { it>=0 }?.let { waves[it]=waves[it].copy(released=true) }
                        is PressInteraction.Cancel -> waves.indexOfFirst { it.press==event.press }.takeIf { it>=0 }?.let { waves[it]=waves[it].copy(released=true) }
                    }
                    if(animator?.isActive!=true && waves.isNotEmpty()) animator=launch(start=CoroutineStart.UNDISPATCHED) {
                        while(isActive && waves.isNotEmpty()) {
                            now=withFrameNanos { it }
                            waves.indices.forEach { index ->
                                val wave=waves[index]
                                waves[index]=wave.copy(began=wave.began ?: now,ended=if(wave.released) wave.ended ?: now else null)
                            }
                            waves.removeAll { it.ended?.let { end-> reduced || now>max((it.began ?: now)+450_000_000L,end)+150_000_000L } ?: false }
                        }
                    }
                }
            }
        } finally { animator?.cancel();waves.clear() }
    }
    return Modifier.drawWithContent {
        waves.forEach { wave ->
            val elapsed=max(0f,(now-(wave.began ?: now))/1_000_000f)
            val origin=wave.press.pressPosition.takeIf { it.x.isFinite() && it.y.isFinite() } ?: center
            val radius=hypot(max(origin.x,size.width-origin.x),max(origin.y,size.height-origin.y))
            val growth=if(reduced) 1f else NativeRippleEasing.transform((elapsed/450f).coerceIn(0f,1f))
            val fade=wave.ended?.let { max(450f,(it-(wave.began ?: now))/1_000_000f) } ?: Float.POSITIVE_INFINITY
            val opacity=if(reduced) { if(wave.ended==null) .12f else 0f } else .12f*(1-NativeRippleEasing.transform(((elapsed-fade)/150f).coerceIn(0f,1f)))
            drawCircle(color.copy(alpha=color.alpha*opacity),radius*growth,origin)
        }
        drawContent()
    }
}

internal fun CoroutineScope.nativeKeyboardRipple(interactions: MutableInteractionSource): Job = launch(start=CoroutineStart.UNDISPATCHED) {
    val press=PressInteraction.Press(Offset.Unspecified)
    try {
        interactions.emit(press)
        val started=withFrameNanos { it };var now=started
        while(now-started<150_000_000L) now=withFrameNanos { it }
    } finally { interactions.tryEmit(PressInteraction.Release(press)) }
}
