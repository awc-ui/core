package dev.awc.nativeui

import android.animation.ValueAnimator
import android.database.ContentObserver
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import androidx.compose.runtime.*
import androidx.compose.ui.platform.LocalContext

internal data class AWCAccessibilityAppearance(val reducedMotion:Boolean?=null,val forcedColors:Boolean?=null)
internal val LocalAWCAccessibilityAppearance=staticCompositionLocalOf { AWCAccessibilityAppearance() }

/**
 * Native environment overrides, not additional Web component properties.
 * Reduced motion defaults to Android's animation preference. Android has no
 * public CSS forced-palette mode; forcedColors defaults false and is opt-in.
 * A higher system contrast preference alone is not treated as forced colors.
 */
@Composable fun AWCAccessibilityAppearanceScope(reducedMotion:Boolean?=null,forcedColors:Boolean?=null,content:@Composable ()->Unit) {
    val inherited=LocalAWCAccessibilityAppearance.current
    CompositionLocalProvider(LocalAWCAccessibilityAppearance provides AWCAccessibilityAppearance(
        reducedMotion ?: inherited.reducedMotion,forcedColors ?: inherited.forcedColors),content=content)
}
@Composable internal fun rememberAWCAccessibilityAppearance():Pair<Boolean,Boolean> {
    val configured=LocalAWCAccessibilityAppearance.current
    val resolver=LocalContext.current.contentResolver
    var systemReduced by remember { mutableStateOf(!ValueAnimator.areAnimatorsEnabled()) }
    DisposableEffect(resolver,configured.reducedMotion) {
        systemReduced=!ValueAnimator.areAnimatorsEnabled()
        val observer=object:ContentObserver(Handler(Looper.getMainLooper())) {
            override fun onChange(selfChange:Boolean) { systemReduced=!ValueAnimator.areAnimatorsEnabled() }
        }
        val registered=if(configured.reducedMotion==null) runCatching {
            resolver.registerContentObserver(Settings.Global.getUriFor(Settings.Global.ANIMATOR_DURATION_SCALE),false,observer)
            true
        }.getOrDefault(false) else false
        onDispose { if(registered) resolver.unregisterContentObserver(observer) }
    }
    return (configured.reducedMotion ?: systemReduced) to (configured.forcedColors ?: false)
}
