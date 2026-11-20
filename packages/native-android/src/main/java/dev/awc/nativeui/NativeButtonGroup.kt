@file:Suppress("DEPRECATION")
package dev.awc.nativeui

import android.animation.ValueAnimator
import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.MultiMeasureLayout
import androidx.compose.ui.layout.layoutId
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.semantics.*
import androidx.compose.ui.unit.*
import kotlin.math.*
import kotlinx.coroutines.Job
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.launch

internal data class ButtonGroupSizing(val minWidth: Float, val inlineInset: Float, val minHeight: Float, val fixedHeight: Float? = null)
/** CSS flex-basis:0 divides content-box space; padding stays outside that basis. */
internal fun buttonGroupFlexWidths(available: Float, floors: List<Float>, insets: List<Float>): List<Float> {
    val result=MutableList(floors.size) { 0f };val pending=floors.indices.toMutableSet()
    var remaining=available
    while(pending.isNotEmpty()) {
        val share=(remaining-pending.sumOf { insets[it].toDouble() }.toFloat())/pending.size
        val frozen=pending.filter { share+insets[it]<floors[it] }
        if(frozen.isEmpty()) { pending.forEach { result[it]=max(floors[it],share+insets[it]) };break }
        frozen.forEach { result[it]=floors[it];remaining-=result[it];pending.remove(it) }
    }
    return result
}
internal data class ButtonGroupChild(val id: Any, val tag: String)
internal val LocalButtonGroupChild = staticCompositionLocalOf<ButtonGroupChild?> { null }
internal fun buttonGroupGap(size: String, density: Float, connected: Boolean): Float {
    val d=density.takeIf { it in listOf(0f,-1f,-2f,-3f,-4f) } ?: 0f
    return if(connected) 2f else when(size) { "xs"->max(10f,18f+2*d);"sm"->max(6f,12f+1.5f*d);else->max(4f,8f+d) }
}
internal fun buttonGroupCorners(size:String,square:Boolean,icon:Boolean,previous:Boolean,next:Boolean,selected:Boolean,pressed:Boolean): Pair<Float,Float> {
    val i=listOf("xs","sm","md","lg","xl").indexOf(size).coerceAtLeast(0)
    val inner=listOf(4f,8f,8f,16f,20f)[i]
    val selectedRadius=listOf(16f,20f,24f,28f,48f)[i]
    val radius=if(pressed) listOf(2f,4f,4f,8f,12f)[i] else if(selected) selectedRadius else null
    if(radius!=null) return radius to radius
    val outer=if(square) inner else if(icon) listOf(16f,20f,28f,48f,68f)[i] else selectedRadius
    return (if(previous) inner else outer) to (if(next) inner else outer)
}

/** A single nowrap row. Native slot content can subcompose, so intrinsic queries
 * are not valid. This small, explicitly multi-measure parent first resolves the
 * content size, then measures the same retained children at their flex/stretch
 * sizes. No duplicate compositions, input targets or state holders are created. */
@Composable internal fun NativeButtonGroup(scope: SelectionScope, slot: Slot?) {
    val p=scope.props
    val appearance=LocalAWCButtonGroupAppearance.current
    val actions=LocalAWCAction.current
    val target=LocalAWCActionTarget.current
    val targetID=remember { java.util.UUID.randomUUID().toString() }
    SideEffect { scope.groupAction={ detail,activation ->
        dispatchNativeAction(AWCActionEvent("mdSelectionChange","md-button-group",detail,targetID=target?.id ?: targetID,activation=activation),actions,target?.listeners?.invoke().orEmpty())
        scope.emit("mdSelectionChange",detail)
    } }
    val state=LocalAWCButtonGroupState.current
    SideEffect { state?.bind(scope) { scope.indices.map { scope.states[it]==true } };scope.seedPreviousValues() }
    DisposableEffect(state,scope) { onDispose { state?.unbind(scope) } }
    val coroutine=rememberCoroutineScope()
    val motionReduced=LocalAWCButtonReducedMotion.current ?: !ValueAnimator.areAnimatorsEnabled()
    val reducedNow by rememberUpdatedState(motionReduced)
    DisposableEffect(scope) {
        scope.startMotion={ id ->
            if(scope.motionEnabled && scope.props.str("variant","standard")=="standard" &&
                !(scope.props.bool("required") && scope.states[id]==true) && !reducedNow) {
                scope.motionJob?.cancel()
                scope.motionJob=coroutine.launch(start=CoroutineStart.UNDISPATCHED) {
                    val index=scope.indices.indexOf(id)
                    val count=(if(index>0) 1 else 0)+(if(index<scope.indices.lastIndex) 1 else 0)
                    if(index<0 || count==0) return@launch
                    val amount=listOf(3f,4f,5f,6f,8f)[listOf("xs","sm","md","lg","xl").indexOf(scope.props.str("size","sm")).coerceAtLeast(0)]
                    val ids=scope.indices
                    val easing=CubicBezierEasing(.2f,0f,0f,1f)
                    val begin=withFrameNanos { it }
                    try {
                        var elapsed=0f
                        while(elapsed<400f) {
                            val progress=if(elapsed<=150f) easing.transform(elapsed/150f) else 1f-easing.transform((elapsed-150f)/250f)
                            scope.motionOffsets.clear()
                            ids.forEachIndexed { i,key -> if(i==index) scope.motionOffsets[key]=amount*progress else if(abs(i-index)==1) scope.motionOffsets[key]=-amount/count*progress }
                            elapsed=(withFrameNanos { it }-begin)/1_000_000f
                        }
                    } finally { scope.motionOffsets.clear() }
                }
            }
        }
        onDispose { scope.motionJob?.cancel();scope.startMotion={} }
    }
    val gap=appearance.gap?.toFloat() ?: buttonGroupGap(p.str("size","sm"),p.num("density"),p.str("variant")=="connected")
    val inspection=LocalAWCInspection.current
    val metrics=AWCInspectionMetrics(padding=AWCInspectionInsets(),margin=AWCInspectionInsets(),border=AWCInspectionInsets(),
        gap=AWCInspectionGap(0.0,gap.toDouble()),display="Row",direction=if(LocalLayoutDirection.current==LayoutDirection.Rtl) "rtl" else "ltr")
    MultiMeasureLayout(content={ CompositionLocalProvider(LocalAWCButtonGroupState provides null) { slot?.invoke("") } }, modifier=Modifier
        .then(if(p.str("selectionMode","single-select")=="single-select") Modifier.selectableGroup() else Modifier)
        .semantics { collectionInfo=CollectionInfo(1,scope.indices.size) }
        .inspectAWCNode(inspection,"","md-button-group",metrics).buttonGroupTree(scope=scope)) { measurables,constraints ->
        // The final child pass uses fixed flex constraints. Observe motion here
        // too, so changing its content inset invalidates the natural-size pass.
        scope.motionOffsets.toMap()
        val ids=measurables.mapNotNull { (it.layoutId as? ButtonGroupChild)?.id }
        scope.updateDirectChildren(ids.toSet())
        val gapPx=gap.dp.roundToPx()
        val natural=measurables.map { it.measure(Constraints()) }
        val naturalWidth=natural.sumOf { it.width }+max(0,natural.size-1)*gapPx
        val naturalHeight=natural.maxOfOrNull { it.height } ?: 0
        fun px(value:Double?)=value?.dp?.roundToPx()
        val minW=px(appearance.minWidth) ?: 0
        val maxW=max(minW,px(appearance.maxWidth) ?: Constraints.Infinity)
        val minH=px(appearance.minHeight) ?: 0
        val maxH=max(minH,px(appearance.maxHeight) ?: Constraints.Infinity)
        val preferredWidth=if(p.bool("fullWidth") && constraints.hasBoundedWidth) constraints.maxWidth else px(appearance.width) ?: naturalWidth
        val width=preferredWidth.coerceIn(minW,maxW)
        val height=(px(appearance.height) ?: naturalHeight).coerceIn(minH,maxH)
        val sizing=measurables.mapIndexed { i,m -> (m.layoutId as? ButtonGroupChild)?.id?.let { scope.childSizing[it] }
            ?: ButtonGroupSizing(natural[i].width/density,0f,natural[i].height/density) }
        val flex=if(p.bool("fullWidth")) buttonGroupFlexWidths((width-max(0,natural.size-1)*gapPx).toFloat(),
            sizing.map { it.minWidth*density },sizing.map { it.inlineInset*density }) else null
        val items=measurables.mapIndexed { i,m ->
            val childWidth=flex?.get(i)?.roundToInt() ?: natural[i].width
            // A definite child height is not stretched. Otherwise its CSS floor
            // still wins over a group height smaller than the control.
            val childHeight=(sizing[i].fixedHeight?.times(density)?.roundToInt() ?: max(height,(sizing[i].minHeight*density).roundToInt()))
                .coerceAtLeast(0)
            m.measure(Constraints.fixed(childWidth,childHeight))
        }
        layout(width,height) {
            var x=0;items.forEach { it.placeRelative(x,0);x+=it.width+gapPx }
        }
    }
}
