package dev.awc.playground

import android.app.Presentation
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.drawable.ColorDrawable
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.media.ImageReader
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.view.ViewGroup
import android.view.Window
import android.view.WindowInsets
import android.view.WindowManager
import android.widget.FrameLayout
import androidx.activity.ComponentActivity
import androidx.compose.ui.platform.ComposeView
import androidx.lifecycle.setViewTreeLifecycleOwner
import androidx.lifecycle.setViewTreeViewModelStoreOwner
import androidx.savedstate.setViewTreeSavedStateRegistryOwner
import kotlin.math.ceil

/**
 * A private, app-owned GPU display: Compose lays out and rasterizes at two physical
 * pixels per logical unit, independently of the emulator's physical screen size.
 * The 1×1 ImageReader discards the unused display-compositor output. PixelCopy
 * reads the full-resolution window buffer before that compositor scaling; no
 * captured pixels are enlarged. This avoids allocating an idle 8MP display sink.
 */
internal class LivePreviewSurface(activity: ComponentActivity, logicalWidth: Double) : AutoCloseable {
    val scale = 2f
    val pixelWidth = ceil(logicalWidth * scale).toInt()
    val pixelHeight = minOf(4000, MAX_PIXELS / pixelWidth)
    val maxLogicalHeight = pixelHeight / scale
    private val drainThread = HandlerThread("AWCPreviewDisplay")
    private var reader: ImageReader? = null
    private var display: VirtualDisplay? = null
    private var presentation: Presentation? = null
    val window: Window get() = checkNotNull(presentation?.window)
    lateinit var container: FrameLayout
        private set
    lateinit var preview: ComposeView
        private set
    private var closed = false

    init {
        try {
            drainThread.start()
            val sink = ImageReader.newInstance(1, 1, PixelFormat.RGBA_8888, 2).also { reader = it }
            // Never hold a display buffer while the PNG encoder is busy.
            sink.setOnImageAvailableListener({ source -> runCatching { source.acquireLatestImage()?.close() } }, Handler(drainThread.looper))
            val nativeDisplay = checkNotNull(activity.getSystemService(DisplayManager::class.java)
                .createVirtualDisplay("AWC native preview", pixelWidth, pixelHeight, 320, sink.surface,
                    DisplayManager.VIRTUAL_DISPLAY_FLAG_OWN_CONTENT_ONLY or DisplayManager.VIRTUAL_DISPLAY_FLAG_PRESENTATION)).also { display = it }
            val nativePresentation = Presentation(activity, nativeDisplay.display, android.R.style.Theme_Material_Light_NoActionBar).also { presentation = it }
            container = FrameLayout(nativePresentation.context).apply { setBackgroundColor(Color.WHITE) }
            preview = ComposeView(nativePresentation.context).apply {
                layoutParams = FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
            }
            // Presentation has no LifecycleOwner of its own. Its composition belongs
            // to the token-owned host Activity and is disposed before its display.
            window.decorView.setViewTreeLifecycleOwner(activity)
            window.decorView.setViewTreeViewModelStoreOwner(activity)
            window.decorView.setViewTreeSavedStateRegistryOwner(activity)
            window.setBackgroundDrawable(ColorDrawable(Color.TRANSPARENT))
            window.addFlags(WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED)
            window.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_STATE_ALWAYS_HIDDEN or WindowManager.LayoutParams.SOFT_INPUT_ADJUST_NOTHING)
            container.addView(preview)
            nativePresentation.setContentView(container)
            nativePresentation.show()
            window.setLayout(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
            hideSystemUI()
        } catch (error: Throwable) {
            close()
            throw error
        }
    }

    @Suppress("DEPRECATION")
    fun hideSystemUI() {
        if (Build.VERSION.SDK_INT >= 30) {
            window.setDecorFitsSystemWindows(false)
            window.insetsController?.hide(WindowInsets.Type.systemBars() or WindowInsets.Type.ime())
        } else {
            window.decorView.systemUiVisibility = android.view.View.SYSTEM_UI_FLAG_FULLSCREEN or
                android.view.View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or android.view.View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY or
                android.view.View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or android.view.View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION or
                android.view.View.SYSTEM_UI_FLAG_LAYOUT_STABLE
        }
    }

    override fun close() {
        if (closed) return
        closed = true
        if (::preview.isInitialized) runCatching { preview.disposeComposition() }
        runCatching { presentation?.dismiss() }
        runCatching { display?.release() }
        runCatching { reader?.close() }
        drainThread.quitSafely()
    }

    companion object { const val MAX_PIXELS = 8_000_000 }
}
