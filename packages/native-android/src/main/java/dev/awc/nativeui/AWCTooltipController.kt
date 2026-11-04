package dev.awc.nativeui

import androidx.compose.runtime.*

/** Immediate state operations; neither method awaits the 100 ms visual motion. */
@Stable class AWCTooltipController {
    internal val state=NativeTooltipState()
    private var owner:Any?=null
    val isOpen:Boolean get()=state.open
    fun show()=state.show()
    fun hide()=state.hide()
    internal fun attach(identity:Any) {
        check(owner==null || owner===identity) { "AWCTooltipControllerScope must contain one Tooltip." };owner=identity
    }
    internal fun detach(identity:Any) { if(owner===identity) owner=null }
}
@Composable fun rememberAWCTooltipController()=remember { AWCTooltipController() }
internal val LocalAWCTooltipController=staticCompositionLocalOf<AWCTooltipController?> { null }
@Composable fun AWCTooltipControllerScope(controller:AWCTooltipController,content:@Composable ()->Unit) {
    CompositionLocalProvider(LocalAWCTooltipController provides controller,content=content)
}

internal fun interface TooltipCancellation { fun cancel() }
internal fun interface TooltipScheduler { fun schedule(delayMillis:Long,action:()->Unit):TooltipCancellation }

/** Source lifecycle, independent of pixels. Visibility survives a native
 * disconnect; timers and event bindings do not. Revisions reject stale queued
 * callbacks even when the platform cancellation arrives too late. */
internal class NativeTooltipState {
    var open by mutableStateOf(false);private set
    var visible by mutableStateOf(false);private set
    var disabled by mutableStateOf(false);private set
    var connected=false;private set
    var suppressed=false;private set
    var showDelay=500.0
    var hideDelay=200.0
    var emit:EventSink={_,_->}
    var restoreAnchorFocus:()->Unit={}
    var anchorFocused=false
    var popupFocused=false
    private var initialized=false
    private var explicitRequest=false
    private var lastSourceOpen:Boolean?=null
    private var scheduler:TooltipScheduler?=null
    private var timer:TooltipCancellation?=null
    private var revision=0L

    fun sourceOpen(value:Boolean) {
        if(lastSourceOpen==value) return
        val first=lastSourceOpen==null;lastSourceOpen=value
        if(first && explicitRequest) return
        clearTimers();assignOpen(value && !disabled)
    }
    fun updateDisabled(value:Boolean) {
        if(disabled==value) return
        disabled=value
        if(value) { clearTimers();assignOpen(false) }
    }
    fun connect(scheduler:TooltipScheduler) {
        if(connected) return
        this.scheduler=scheduler;connected=true
        if(open && !disabled && (!initialized || !visible)) { visible=true;emit("mdOpen",null) }
        initialized=true
    }
    fun disconnect() {
        clearTimers();connected=false;scheduler=null;anchorFocused=false;popupFocused=false
    }
    fun show() { explicitRequest=true;clearTimers();if(!disabled) assignOpen(true) }
    fun hide() { explicitRequest=true;clearTimers();assignOpen(false) }
    private fun assignOpen(value:Boolean) {
        if(open==value) return
        open=value
        if(value) {
            if(connected && !disabled) { visible=true;emit("mdOpen",null) }
        } else if(visible) { visible=false;emit("mdClose",null) }
    }
    fun triggerEnter() {
        if(disabled || suppressed || !connected) return
        schedule(showDelay) { assignOpen(true) }
    }
    fun triggerLeave() { suppressed=false;scheduleHide() }
    fun triggerFocus() { anchorFocused=true;triggerEnter() }
    fun triggerBlur(focusInside:Boolean) {
        anchorFocused=false
        if(focusInside) return
        suppressed=false;scheduleHide()
    }
    fun popupEnter() { clearTimers() }
    fun popupLeave() { scheduleHide() }
    fun popupFocus() { popupFocused=true;clearTimers() }
    fun popupBlur(focusInside:Boolean) { popupFocused=false;if(!focusInside) scheduleHide() }
    fun removeAnchor() { clearTimers();anchorFocused=false;assignOpen(false) }
    fun escape():Boolean {
        if(!connected || !visible) return false
        clearTimers();suppressed=true
        val focusInside=anchorFocused || popupFocused
        assignOpen(false)
        if(focusInside) restoreAnchorFocus()
        return true
    }
    private fun scheduleHide() { if(connected) schedule(hideDelay) { assignOpen(false) } }
    private fun schedule(delay:Double,action:()->Unit) {
        clearTimers();val current=revision
        val millis=if(delay.isFinite() && delay in 0.0..2147483647.0) delay.toLong() else 0L
        timer=scheduler?.schedule(millis) {
            if(current==revision && connected) { timer=null;action() }
        }
    }
    private fun clearTimers() { ++revision;timer?.cancel();timer=null }
}
