package dev.awc.playground

/** UI-thread capture lifetime shared by commit wait, timeout and PixelCopy.
 * Completing one request invalidates callbacks already queued for that request. */
internal class LivePreviewCaptureTicket(private val stillCurrent:()->Boolean) {
    private var finished=false
    fun finish():Boolean {
        if(finished) return false
        finished=true
        return true
    }
    fun deliver(expired:()->Unit,current:()->Unit) {
        if(finished || !stillCurrent()) expired() else current()
    }
}
