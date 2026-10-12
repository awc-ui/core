package dev.awc.playground

import android.content.Intent
import android.content.pm.ApplicationInfo
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.Rect
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.util.Base64
import android.util.Log
import android.view.InputDevice
import android.view.KeyEvent
import android.view.MotionEvent
import android.view.PixelCopy
import android.view.View
import android.view.ViewTreeObserver
import android.view.WindowInsets
import android.view.WindowManager
import android.view.inputmethod.EditorInfo
import android.widget.FrameLayout
import androidx.activity.ComponentActivity
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.ComposeView
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import dev.awc.nativeui.AWCComponent
import dev.awc.nativeui.AWCButtonBehaviorDemo
import dev.awc.nativeui.AWCButtonNavigationDemo
import dev.awc.nativeui.AWCButtonAccessibilityDemo
import dev.awc.nativeui.AWCTheme
import dev.awc.nativeui.AWCValue
import dev.awc.nativeui.normalizeAWCThemeOverrides
import dev.awc.nativeui.generated.AWCNativeCatalog
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.util.UUID
import java.util.concurrent.CompletableFuture
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Debug-only Compose host. ADB forwards its authenticated loopback socket;
 * input is dispatched to this activity's views, never to the Android system.
 */
class LivePreviewActivity : ComponentActivity() {
    private data class Configuration(val tag: String, val properties: Map<String, AWCValue>, val dark: Boolean, val width: Double, val scenario: String, val themeTokens: Map<String, String>, val direction: LayoutDirection, val text: String?)
    private val main = Handler(Looper.getMainLooper())
    private var configuration by mutableStateOf<Configuration?>(null)
    private val previewDensity = 2f
    private var surface: LivePreviewSurface? = null
    private lateinit var preview: ComposeView
    private lateinit var container: FrameLayout
    private var server: LivePreviewServer? = null
    private val events = ArrayDeque<JSONObject>()
    private var downTime = 0L
    private var pointerHeld = false
    private var stream: LivePreviewServer.Stream? = null
    private val captureInFlight = AtomicBoolean(false)
    private var encodingInFlight = false
    private var pendingCapture: Pair<LivePreviewServer.Stream, Captured>? = null
    private var committedDraw = 0L
    private var capturedDraw = -1L
    private var captureSequence = 0L
    private var droppedCaptures = 0L
    private var cachedFrame: JSONObject? = null
    private val firstDraw = CompletableFuture<Unit>()
    private val destroyed = AtomicBoolean(false)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // There is deliberately no live-preview activity in the release manifest.
        if (applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE == 0) { finish(); return }
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        // The physical Activity only owns lifecycle and authentication. The
        // private Presentation below owns native pixels and receives local input.
        setContentView(FrameLayout(this).apply { setBackgroundColor(Color.WHITE) })
        hideSystemUI()
        startHost(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        // A new token is a new session: recreate the host rather than retaining old state.
        server?.close()
        stopStream()
        setIntent(intent)
        recreate()
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) hideSystemUI()
    }

    private fun startHost(intent: Intent) {
        val token = intent.getStringExtra("token")
        if (token == null || !token.matches(Regex("[A-Za-z0-9_-]{32,128}"))) { finish(); return }
        try {
            server = LivePreviewServer(token, command = ::command, openStream = ::openStream).also { it.start() }
        } catch (error: Exception) {
            Log.e("AWCNativeHost", "Could not open the private preview listener.", error)
            finish()
        }
    }

    override fun onDestroy() {
        destroyed.set(true)
        stopStream()
        if (::preview.isInitialized) cancelPointer()
        server?.close()
        if (::preview.isInitialized && preview.viewTreeObserver.isAlive) preview.viewTreeObserver.removeOnPreDrawListener(drawListener)
        surface?.close()
        surface = null
        super.onDestroy()
    }

    @Suppress("DEPRECATION")
    private fun hideSystemUI() {
        surface?.hideSystemUI()
        if (Build.VERSION.SDK_INT >= 30) {
            window.setDecorFitsSystemWindows(false)
            window.insetsController?.hide(WindowInsets.Type.systemBars() or WindowInsets.Type.ime())
        } else {
            window.decorView.systemUiVisibility = View.SYSTEM_UI_FLAG_FULLSCREEN or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or
                View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
        }
    }

    private fun recordEvent(name: String, detail: AWCValue) {
        val tag = configuration?.tag ?: return
        if (events.size >= 256) {
            // A bounded session must fail rather than silently lose a native callback.
            stopStream()
            server?.close()
            finish()
            return
        }
        events.addLast(JSONObject().put("id", UUID.randomUUID().toString()).put("name", name)
            .put("tag", tag).put("nodeID", "$tag-preview").put("detail", JSONObject.wrap(detail)))
    }

    private fun drainEvents(): JSONArray = JSONArray().also { result -> while (events.isNotEmpty()) result.put(events.removeFirst()) }

    private fun <T> onMain(block: () -> T): T {
        check(Looper.myLooper() != Looper.getMainLooper()) { "HTTP work must remain off the Android UI thread." }
        val result = CompletableFuture<T>()
        main.post {
            if (destroyed.get()) result.completeExceptionally(IllegalStateException("Preview activity closed."))
            else try { result.complete(block()) } catch (error: Exception) { result.completeExceptionally(error) }
        }
        return result.get(5, TimeUnit.SECONDS)
    }

    private fun command(request: JSONObject): JSONObject {
        val name = request.optString("command")
        if (name == "close") {
            // Finish this token-owned Activity in the close operation itself.
            // A delayed finish can race a new singleTask intent and kill its replacement.
            onMain {
                stopStream()
                cancelPointer()
                // onDestroy may run after the next activity has already been
                // created. Release the listener before ending this command.
                server?.close()
                server = null
                finish()
            }
            return JSONObject().put("ack", true).put("events", JSONArray())
        }
        if (name == "configure") {
            onMain { configure(request) }
            // A frame-commit callback ensures the first GPU window buffer exists.
            try { firstDraw.get(5, TimeUnit.SECONDS) } catch (error: java.util.concurrent.TimeoutException) {
                throw IllegalStateException(onMain { "Native first draw timed out (${preview.width}×${preview.height}, hardware=${preview.isHardwareAccelerated}, attached=${preview.isAttachedToWindow})." }, error)
            }
            return frame()
        }
        if (name == "frame") { onMain { requireConfigured() }; return frame() }
        val (reply, streaming) = onMain {
            requireConfigured()
            val notice = when (name) {
                "click" -> { click(request); null }
                "pointer" -> { pointer(request); null }
                "text" -> insertText(request)
                "key" -> key(request)
                "stream" -> {
                    require(request.has("enabled") && request.get("enabled") is Boolean) { "Stream requires an enabled boolean." }
                    if (!request.getBoolean("enabled")) stopStream()
                    null
                }
                else -> throw IllegalArgumentException("Unsupported native command: $name")
            }
            if (name == "click" || name == "text" || name == "key") hideSystemUI()
            JSONObject().put("ack", true).put("events", drainEvents()).also { if (notice != null) it.put("inputIgnored", notice) } to (stream != null)
        }
        if (name == "stream" || streaming) return reply
        val rendered = frame()
        val combined = reply.getJSONArray("events")
        val later = rendered.getJSONArray("events")
        for (i in 0 until later.length()) combined.put(later.get(i))
        rendered.put("events", combined)
        if (reply.has("inputIgnored")) rendered.put("inputIgnored", reply.getString("inputIgnored"))
        return rendered
    }

    private fun configure(request: JSONObject) {
        check(configuration == null) { "A native session can only be configured once." }
        val tag = request.optString("tag")
        require(tag in AWCNativeCatalog.tags) { "Unknown native component tag." }
        val text = parseLivePreviewButtonText(request, tag)
        val width = request.optDouble("width", 640.0)
        require(width.isFinite() && width in 320.0..1200.0) { "Width must be finite and between 320 and 1200." }
        val supplied = request.optJSONObject("properties") ?: JSONObject()
        @Suppress("UNCHECKED_CAST")
        val properties = jsonValue(supplied) as Map<String, AWCValue>
        val dark = request.optBoolean("dark", false)
        val scenario = request.optString("scenario", "")
        require(scenario.isEmpty() || (scenario in setOf("button-behavior", "navigation-events", "focus-accessibility") && tag == "md-button")) { "Unknown native example." }
        val direction = request.optString("direction", "ltr")
        require(direction in setOf("ltr", "rtl")) { "Direction must be ltr or rtl." }
        val themeTokens = if (request.has("themeTokens")) {
            val colors = request.getJSONObject("themeTokens")
            normalizeAWCThemeOverrides(colors.keys().asSequence().associateWith { name ->
                val value = colors.get(name)
                require(value is String) { "Native theme colors must be strings." }
                value
            })
        } else emptyMap()
        configuration = Configuration(tag, AWCNativeCatalog.defaults[tag].orEmpty() + fixture(tag) + properties, dark, width, scenario, themeTokens, if(direction == "rtl") LayoutDirection.Rtl else LayoutDirection.Ltr, text)
        createSurface(width)
        container.setBackgroundColor(themeTokens["--md-sys-color-surface"]?.let(Color::parseColor) ?: if (dark) 0xFF141414.toInt() else Color.WHITE)
    }

    private fun createSurface(width: Double) {
        val nativeSurface = LivePreviewSurface(this, width)
        surface = nativeSurface
        preview = nativeSurface.preview
        container = nativeSurface.container
        preview.viewTreeObserver.addOnPreDrawListener(drawListener)
        preview.setContent {
            configuration?.let { config ->
                CompositionLocalProvider(LocalDensity provides Density(previewDensity, 1f), LocalLayoutDirection provides config.direction) {
                    AWCTheme(darkTheme = config.dark, tokenOverrides = config.themeTokens) {
                        Box(Modifier.fillMaxWidth().heightIn(min = 100.dp, max = nativeSurface.maxLogicalHeight.dp)
                            .background(if (config.themeTokens.isEmpty()) androidx.compose.ui.graphics.Color(if (config.dark) 0xFF141414 else 0xFFFFFFFF) else androidx.compose.material3.MaterialTheme.colorScheme.surface)
                            .padding(24.dp), contentAlignment = Alignment.Center) {
                            if (config.scenario == "button-behavior") AWCButtonBehaviorDemo(config.properties, ::recordEvent)
                            else if (config.scenario == "navigation-events") AWCButtonNavigationDemo(config.properties, ::recordEvent)
                            else if (config.scenario == "focus-accessibility") AWCButtonAccessibilityDemo(config.properties, ::recordEvent)
                            else AWCComponent(config.tag, config.properties, onEvent = ::recordEvent) { slot -> LivePreviewSampleSlot(config.tag, slot, config.scenario, config.text, ::recordEvent) }
                        }
                    }
                }
            }
        }
    }

    /** Observe actual GPU draws, rather than sampling the same buffer on a timer. */
    private val drawListener = ViewTreeObserver.OnPreDrawListener {
        if (!destroyed.get()) {
            // Register for every draw. A previous commit may arrive after the
            // next pre-draw; gating registration on it silently halves cadence.
            val committed = Runnable {
                val acceptCommit = Runnable {
                    if (!destroyed.get()) {
                        committedDraw++
                        firstDraw.complete(Unit)
                        captureStreamFrame()
                    }
                }
                if (Looper.myLooper() == Looper.getMainLooper()) acceptCommit.run() else main.post(acceptCommit)
            }
            if (Build.VERSION.SDK_INT >= 29 && preview.isHardwareAccelerated) preview.viewTreeObserver.registerFrameCommitCallback(committed)
            // On older Android, posting from onPreDraw still runs after the
            // Choreographer traversal; PixelCopy checks the submitted buffer.
            else main.post(committed)
        }
        true
    }

    private fun requireConfigured(): Configuration = checkNotNull(configuration) { "Configure the native session first." }

    private fun point(request: JSONObject, outside: Boolean = false): Pair<Float, Float> {
        val x = request.optDouble("x", Double.NaN)
        val y = request.optDouble("y", Double.NaN)
        require(x.isFinite() && y.isFinite()) { "Native input requires finite x and y coordinates." }
        val px = x * previewDensity
        val py = y * previewDensity
        if (!outside) require(px >= 0 && py >= 0 && px < preview.width && py < preview.height) { "Input must be inside the logical preview bounds." }
        require(kotlin.math.abs(px) < 100_000 && kotlin.math.abs(py) < 100_000) { "Pointer coordinates exceed the supported range." }
        return px.toFloat() to py.toFloat()
    }

    private fun touch(action: Int, x: Float, y: Float) {
        val now = SystemClock.uptimeMillis()
        if (action == MotionEvent.ACTION_DOWN) downTime = now
        val event = MotionEvent.obtain(downTime, now, action, x, y, 0)
        event.source = InputDevice.SOURCE_TOUCHSCREEN
        try { preview.dispatchTouchEvent(event) } finally { event.recycle() }
    }

    private fun click(request: JSONObject) {
        check(!pointerHeld) { "Release the held native pointer before clicking." }
        val (x, y) = point(request)
        touch(MotionEvent.ACTION_DOWN, x, y)
        touch(MotionEvent.ACTION_UP, x, y)
    }

    private fun pointer(request: JSONObject) {
        val phase = request.optString("phase")
        require(phase in setOf("down", "up", "cancel", "move", "leave")) { "Unsupported native pointer phase." }
        val (x, y) = point(request, outside = phase != "down")
        when (phase) {
            "down" -> {
                if (pointerHeld) return
                pointerHeld = true
                touch(MotionEvent.ACTION_DOWN, x, y)
            }
            "up" -> {
                if (!pointerHeld) return
                pointerHeld = false
                touch(MotionEvent.ACTION_UP, x, y)
            }
            "cancel" -> cancelPointer()
            "move", "leave" -> {
                val actualX = if (phase == "leave") -1000f else x
                val actualY = if (phase == "leave") -1000f else y
                if (pointerHeld) touch(MotionEvent.ACTION_MOVE, actualX, actualY)
                else {
                    val event = MotionEvent.obtain(SystemClock.uptimeMillis(), SystemClock.uptimeMillis(),
                        if (phase == "leave") MotionEvent.ACTION_HOVER_EXIT else MotionEvent.ACTION_HOVER_MOVE, actualX, actualY, 0)
                    event.source = InputDevice.SOURCE_MOUSE
                    try { preview.dispatchGenericMotionEvent(event) } finally { event.recycle() }
                }
            }
        }
    }

    private fun cancelPointer() {
        if (!pointerHeld) return
        pointerHeld = false
        touch(MotionEvent.ACTION_CANCEL, -1000f, -1000f)
    }

    private fun insertText(request: JSONObject): String? {
        require(request.has("text") && request.get("text") is String) { "Text input requires a string." }
        val text = request.getString("text")
        require(text.length <= 4096) { "Text input exceeds 4096 characters." }
        val focused = preview.findFocus() ?: return "No native text editor is focused."
        val connection = focused.onCreateInputConnection(EditorInfo()) ?: return "The focused native control is not a text editor."
        connection.beginBatchEdit()
        try { connection.commitText(text, 1) } finally { connection.endBatchEdit() }
        return null
    }

    private fun key(request: JSONObject): String? {
        val code = keyCodes[request.optString("key")] ?: throw IllegalArgumentException("Unsupported native key.")
        val modifiers = request.optJSONArray("modifiers") ?: JSONArray()
        require(modifiers.length() <= 4) { "Too many key modifiers." }
        var meta = 0
        for (i in 0 until modifiers.length()) meta = meta or when (modifiers.getString(i)) {
            "shift" -> KeyEvent.META_SHIFT_ON
            "control" -> KeyEvent.META_CTRL_ON
            "alt" -> KeyEvent.META_ALT_ON
            "meta" -> KeyEvent.META_META_ON
            else -> throw IllegalArgumentException("Unsupported key modifier.")
        }
        val now = SystemClock.uptimeMillis()
        val target = preview.findFocus() ?: preview
        target.dispatchKeyEvent(KeyEvent(now, now, KeyEvent.ACTION_DOWN, code, 0, meta))
        target.dispatchKeyEvent(KeyEvent(now, now, KeyEvent.ACTION_UP, code, 0, meta))
        return null
    }

    private data class Captured(val bitmap: Bitmap, val metadata: JSONObject)

    /** PixelCopy captures the actual Compose window surface, including animation frames. */
    private fun capture(stillCurrent: () -> Boolean = { true }, callback: (Result<Captured>) -> Unit) {
        if (destroyed.get()) { callback(Result.failure(IllegalStateException("Preview activity closed."))); return }
        try {
            val captureStarted = SystemClock.elapsedRealtimeNanos()
            val config = requireConfigured()
            val position = IntArray(2)
            preview.getLocationInWindow(position)
            val width = preview.width
            val height = preview.height.coerceAtMost(container.height)
            check(width > 0 && height > 0) { "Native preview has no rendered layout yet." }
            check(width.toLong() * height <= LivePreviewSurface.MAX_PIXELS) { "Native surface exceeds the bounded capture size." }
            val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
            val rect = Rect(position[0], position[1], position[0] + width, position[1] + height)
            val draw = committedDraw
            PixelCopy.request(checkNotNull(surface).window, rect, bitmap, { result ->
                if (destroyed.get() || !stillCurrent()) {
                    bitmap.recycle()
                    callback(Result.failure(IllegalStateException("Native capture was superseded.")))
                } else if (result == PixelCopy.SUCCESS) {
                    capturedDraw = maxOf(capturedDraw, draw)
                    captureSequence++
                    val now = SystemClock.elapsedRealtimeNanos()
                    callback(Result.success(Captured(bitmap, JSONObject().put("platform", "android").put("renderer", "Jetpack Compose")
                        .put("tag", config.tag).put("width", width).put("height", height)
                        .put("logicalWidth", width / previewDensity.toDouble()).put("logicalHeight", height / previewDensity.toDouble())
                        .put("events", drainEvents()).put("diagnostics", JSONObject()
                            .put("captureSequence", captureSequence).put("capturedAtMs", now / 1_000_000.0)
                            .put("captureMs", (now - captureStarted) / 1_000_000.0)
                            .put("captureScale", previewDensity.toDouble()).put("droppedCaptures", droppedCaptures)))))
                } else {
                    bitmap.recycle()
                    callback(Result.failure(IllegalStateException("Native PixelCopy failed with code $result.")))
                }
            }, main)
        } catch (error: Exception) { callback(Result.failure(error)) }
    }

    private fun encode(captured: Captured): JSONObject {
        try {
            val started = SystemClock.elapsedRealtimeNanos()
            val bytes = ByteArrayOutputStream()
            check(captured.bitmap.compress(Bitmap.CompressFormat.PNG, 100, bytes)) { "Native lossless PNG encoding failed." }
            val result = captured.metadata.put("png", Base64.encodeToString(bytes.toByteArray(), Base64.NO_WRAP))
            val encodeMs = (SystemClock.elapsedRealtimeNanos() - started) / 1_000_000.0
            result.getJSONObject("diagnostics").put("encodeMs", encodeMs)
            if (intent.getBooleanExtra("profile", false)) {
                Log.d("AWCNativePerf", "captureMs=${result.getJSONObject("diagnostics").getDouble("captureMs")} encodeMs=$encodeMs bytes=${bytes.size()}")
            }
            return result
        } finally { captured.bitmap.recycle() }
    }

    private fun frame(): JSONObject {
        val captured = CompletableFuture<Captured>()
        main.post { capture { it.fold(captured::complete, captured::completeExceptionally) } }
        return encode(captured.get(5, TimeUnit.SECONDS)).also { result -> onMain { rememberFrame(result) } }
    }

    private fun rememberFrame(frame: JSONObject) {
        val previous = cachedFrame?.getJSONObject("diagnostics")?.getLong("captureSequence") ?: -1
        if (frame.getJSONObject("diagnostics").getLong("captureSequence") >= previous) {
            cachedFrame = JSONObject(frame, frame.keys().asSequence().toList().toTypedArray()).put("events", JSONArray())
        }
    }

    private fun openStream(writer: LivePreviewServer.Stream) {
        onMain {
            requireConfigured()
            // A browser may reconnect before the old idle socket notices EOF.
            // Both writers passed this token's authentication; replace only its
            // prior writer and force a fresh frame for the new subscriber.
            stopStream()
            stream = writer
            capturedDraw = -1L
            main.post(heartbeat)
            captureStreamFrame()
        }
    }

    // Keep the authenticated stream alive without repeatedly copying or encoding
    // an idle surface. Cached responses deliberately retain captureSequence.
    private val heartbeat = object : Runnable {
        override fun run() {
            val target = stream ?: return
            if (!target.isOpen) { stopStream(); return }
            if (committedDraw <= capturedDraw && !captureInFlight.get() && !encodingInFlight && pendingCapture == null) {
                cachedFrame?.takeIf { it.getJSONObject("diagnostics").getLong("captureSequence") == captureSequence }?.let {
                    val values = drainEvents()
                    if (!target.offer(JSONObject(it, it.keys().asSequence().toList().toTypedArray()).put("kind", "frame").put("events", values))) {
                        for (i in values.length() - 1 downTo 0) events.addFirst(values.getJSONObject(i))
                    }
                }
            }
            main.postDelayed(this, 1000)
        }
    }

    private fun captureStreamFrame() {
        val target = stream ?: return
        if (!target.isOpen) { stopStream(); return }
        if (committedDraw <= capturedDraw || !captureInFlight.compareAndSet(false, true)) return
        capture(stillCurrent = { stream === target && target.isOpen }) { result ->
            captureInFlight.set(false)
            if (result.isFailure) {
                if (stream === target) Log.w("AWCNativeHost", "Native stream capture failed.", result.exceptionOrNull())
                target.fail(result.exceptionOrNull()?.message ?: "Native capture failed.")
                if (stream === target) stopStream()
                else if (stream != null) main.post { captureStreamFrame() }
            } else {
                val captured = result.getOrThrow()
                if (destroyed.get() || stream !== target || !target.isOpen) {
                    captured.bitmap.recycle()
                    restoreEvents(captured)
                } else if (encodingInFlight) {
                    // At most one newest bitmap waits behind the encoder.
                    val previous = pendingCapture?.second
                    if (previous != null) {
                        droppedCaptures++
                        if (!prependEvents(previous, captured)) {
                            previous.bitmap.recycle()
                            captured.bitmap.recycle()
                            pendingCapture = null
                            stopStream(); server?.close(); finish()
                            return@capture
                        }
                        previous.bitmap.recycle()
                    }
                    pendingCapture = target to captured
                } else startEncoding(target, captured)
                // A newer GPU draw may have committed while PixelCopy was busy.
                if (committedDraw > capturedDraw) main.post { captureStreamFrame() }
            }
        }
    }

    private fun startEncoding(target: LivePreviewServer.Stream, captured: Captured) {
        encodingInFlight = true
        val accepted = target.encode {
            var delivered = false
            var encoded: JSONObject? = null
            try {
                if (target.isOpen && !destroyed.get()) {
                    encoded = encode(captured).put("kind", "frame")
                    delivered = target.offer(encoded)
                }
                else captured.bitmap.recycle()
            } catch (error: Exception) {
                Log.w("AWCNativeHost", "Native stream encoding failed.", error)
                target.close()
            } finally {
                main.post {
                    if (stream === target) encoded?.let { rememberFrame(it) }
                    if (!delivered) {
                        val waiting = pendingCapture?.second
                        if (waiting == null) restoreEvents(captured)
                        else if (!prependEvents(captured, waiting)) { stopStream(); server?.close(); finish() }
                    }
                    encodingInFlight = false
                    val next = pendingCapture
                    pendingCapture = null
                    if (next != null) {
                        if (!destroyed.get() && stream === next.first && next.first.isOpen) startEncoding(next.first, next.second)
                        else { next.second.bitmap.recycle(); restoreEvents(next.second) }
                    }
                }
            }
        }
        if (!accepted) {
            encodingInFlight = false
            captured.bitmap.recycle()
            restoreEvents(captured)
            if (stream === target) stopStream()
        }
    }

    private fun prependEvents(earlier: Captured, later: Captured): Boolean {
        val older = earlier.metadata.getJSONArray("events")
        val newer = later.metadata.getJSONArray("events")
        if (older.length() + newer.length() > 256) return false
        val combined = JSONArray()
        for (i in 0 until older.length()) combined.put(older.get(i))
        for (i in 0 until newer.length()) combined.put(newer.get(i))
        later.metadata.put("events", combined)
        return true
    }

    private fun restoreEvents(captured: Captured) {
        if (destroyed.get()) return
        val values = captured.metadata.optJSONArray("events") ?: return
        if (events.size + values.length() > 256) { server?.close(); finish(); return }
        // This bitmap predates callbacks that have since entered the activity queue.
        for (i in values.length() - 1 downTo 0) events.addFirst(values.getJSONObject(i))
        captured.metadata.put("events", JSONArray())
    }

    private fun stopStream() {
        main.removeCallbacks(heartbeat)
        stream?.close()
        stream = null
        pendingCapture?.second?.let { it.bitmap.recycle(); restoreEvents(it) }
        pendingCapture = null
    }

    private fun jsonValue(value: Any?, depth: Int = 0): Any? {
        require(depth <= 16) { "Properties exceed the supported nesting depth." }
        return when (value) {
            null, JSONObject.NULL -> null
            is JSONObject -> value.keys().asSequence().associateWith { jsonValue(value.get(it), depth + 1) }
            is JSONArray -> List(value.length()) { jsonValue(value.get(it), depth + 1) }
            else -> value
        }
    }

    companion object {
        private val keyCodes = mapOf("Enter" to KeyEvent.KEYCODE_ENTER, "Tab" to KeyEvent.KEYCODE_TAB,
            "Backspace" to KeyEvent.KEYCODE_DEL, "Delete" to KeyEvent.KEYCODE_FORWARD_DEL,
            "ArrowLeft" to KeyEvent.KEYCODE_DPAD_LEFT, "ArrowRight" to KeyEvent.KEYCODE_DPAD_RIGHT,
            "ArrowUp" to KeyEvent.KEYCODE_DPAD_UP, "ArrowDown" to KeyEvent.KEYCODE_DPAD_DOWN,
            "Home" to KeyEvent.KEYCODE_MOVE_HOME, "End" to KeyEvent.KEYCODE_MOVE_END,
            "Escape" to KeyEvent.KEYCODE_ESCAPE, "Space" to KeyEvent.KEYCODE_SPACE,
            "PageUp" to KeyEvent.KEYCODE_PAGE_UP, "PageDown" to KeyEvent.KEYCODE_PAGE_DOWN)
    }
}

/** Null means omitted; the empty string intentionally clears the default button label. */
internal fun parseLivePreviewButtonText(request: JSONObject, tag: String): String? {
    if (!request.has("text")) return null
    require(tag == "md-button") { "Preview text is only supported for md-button." }
    val text = request.get("text")
    require(text is String) { "Preview text must be a string." }
    require(text.toByteArray(Charsets.UTF_8).size <= 4096) { "Preview text exceeds 4096 UTF-8 bytes." }
    return text
}

@Composable
internal fun LivePreviewSampleSlot(tag: String, slot: String, scenario: String, text: String?, onEvent: (String, AWCValue) -> Unit) {
    if (tag == "md-button" && slot.isEmpty() && scenario.isEmpty() && text != null) Text(text)
    else SampleSlot(tag, slot, onEvent)
}
