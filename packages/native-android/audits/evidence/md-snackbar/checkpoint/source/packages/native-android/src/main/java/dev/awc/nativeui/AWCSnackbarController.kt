package dev.awc.nativeui

import androidx.compose.runtime.*

enum class AWCSnackbarCloseReason(val source:String) { Auto("auto"), Action("action"), Close("close") }

/** Immediate source state operations. Completion does not await visual motion.
 * A retained controller keeps its state while its component is disconnected. */
@Stable class AWCSnackbarController {
    internal val state=NativeSnackbarState()
    private var owner:Any?=null
    val isOpen:Boolean get()=state.open
    fun show()=state.show()
    fun hide(reason:AWCSnackbarCloseReason=AWCSnackbarCloseReason.Close)=state.hide(reason)
    internal fun attach(identity:Any) {
        check(owner==null || owner===identity) { "AWCSnackbarControllerScope must contain one Snackbar." }
        owner=identity
    }
    internal fun detach(identity:Any) { if(owner===identity) owner=null }
}
@Composable fun rememberAWCSnackbarController()=remember { AWCSnackbarController() }
internal val LocalAWCSnackbarController=staticCompositionLocalOf<AWCSnackbarController?> { null }
@Composable fun AWCSnackbarControllerScope(controller:AWCSnackbarController,content:@Composable ()->Unit) {
    CompositionLocalProvider(LocalAWCSnackbarController provides controller,content=content)
}

internal fun interface SnackbarCancellation { fun cancel() }
internal fun interface SnackbarScheduler { fun schedule(delayMillis:Long,action:()->Unit):SnackbarCancellation }

/** Source lifecycle, independently driven by native timers and tested with a
 * deterministic scheduler. Revisions prevent cancelled callbacks from affecting
 * a new opening cycle even when a platform callback was already queued. */
internal class NativeSnackbarState {
    var open by mutableStateOf(false); private set
    var rank by mutableIntStateOf(0)
    var connected=false; private set
    var autoHide=true
    var autoHideDuration=4000.0
    var closeable=false
    var emit:EventSink={ _,_-> }
    var raise:()->Unit={}
    private var scheduler:SnackbarScheduler?=null
    private var initialized=false
    private var explicitRequest=false
    private var pendingOpen=false
    private var lastSourceOpen:Boolean?=null
    private var paused=false
    private var auto:SnackbarCancellation?=null
    private var ripple:SnackbarCancellation?=null
    private var autoRevision=0L
    private var rippleRevision=0L

    fun sourceOpen(value:Boolean) {
        if(lastSourceOpen==value) return
        val first=lastSourceOpen==null
        lastSourceOpen=value
        // A show() before mounting is not overwritten by the default false prop.
        if(first && explicitRequest) return
        assignOpen(value)
    }
    fun connect(scheduler:SnackbarScheduler) {
        if(connected) return
        this.scheduler=scheduler;connected=true
        if(open) {
            raise()
            if(!initialized || pendingOpen) emit("mdOpen",null)
            pendingOpen=false
            if(autoHide) startAutoHide()
        }
        initialized=true
    }
    fun disconnect() {
        connected=false;scheduler=null
        clearAutoHide();clearRipple();paused=false
    }
    fun show() { explicitRequest=true;assignOpen(true) }
    fun hide(reason:AWCSnackbarCloseReason=AWCSnackbarCloseReason.Close) {
        explicitRequest=true
        if(!open) return
        assignOpen(false);emit("mdClose",mapOf("reason" to reason.source))
    }
    private fun assignOpen(value:Boolean) {
        if(open==value) return
        open=value
        if(value) {
            if(!connected) { pendingOpen=true;return }
            pendingOpen=false;raise();emit("mdOpen",null)
            if(autoHide) startAutoHide()
        } else {
            pendingOpen=false;clearAutoHide();clearRipple();paused=false
        }
    }
    fun action() {
        if(!connected || !open) return
        emit("mdAction",null)
        // Source deliberately restarts the timer even when autoHide is false.
        startAutoHide()
    }
    fun requestClose() {
        if(!connected || !open || ripple!=null) return
        val revision=++rippleRevision
        ripple=scheduler?.schedule(150) {
            if(revision==rippleRevision && connected) {
                ripple=null
                if(open) hide(AWCSnackbarCloseReason.Close)
            }
        }
    }
    fun escape():Boolean {
        if(!connected || !open || !closeable) return false
        requestClose();return true
    }
    fun pause() {
        if(auto!=null && open) { paused=true;clearAutoHide() }
    }
    fun resume() {
        if(paused && open && connected) { paused=false;startAutoHide() }
    }
    private fun startAutoHide() {
        clearAutoHide()
        if(!connected) return
        val revision=++autoRevision
        // Browser timers normalize negative/invalid durations to zero and
        // overflow beyond signed 32-bit milliseconds to an immediate timeout.
        val delay=if(autoHideDuration.isFinite() && autoHideDuration in 0.0..2147483647.0)
            autoHideDuration.toLong() else 0L
        auto=scheduler?.schedule(delay) {
            if(revision==autoRevision && connected) {
                auto=null
                if(open) hide(AWCSnackbarCloseReason.Auto)
            }
        }
    }
    private fun clearAutoHide() { ++autoRevision;auto?.cancel();auto=null }
    private fun clearRipple() { ++rippleRevision;ripple?.cancel();ripple=null }
}
