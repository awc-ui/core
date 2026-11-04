package dev.awc.nativeui

import androidx.compose.foundation.layout.size

import androidx.compose.ui.focus.focusTarget

import android.os.Build
import android.view.KeyEvent
import android.view.View
import android.view.ViewParent
import android.view.Window
import androidx.annotation.RequiresApi
import androidx.compose.foundation.focusGroup
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.runtime.*
import androidx.compose.ui.ExperimentalComposeUiApi
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.*
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.PointerEventType
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInWindow
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.DialogWindowProvider
import kotlinx.coroutines.flow.first

/**
 * Paint order of open modals. [SourceZIndex] reproduces the source stylesheets: the Dialog surface and scrim use
 * `--md-dialog-z-index` / `--md-dialog-scrim-z-index` (near int32 max) while the sheets use 1001/1000, so a dialog
 * paints above a sheet opened on top of it even though the sheet owns focus and keys (measured in Chrome).
 * [OwnerOrder] paints in owner-stack order (the last opened modal on top).
 */
enum class AWCModalPaintOrder { SourceZIndex, OwnerOrder }

/** Safe-area insets (dp) of the modal viewport: the part of the window insets that overlaps the scope. */
@Immutable data class AWCModalInsets(val top: Double = 0.0, val right: Double = 0.0, val bottom: Double = 0.0, val left: Double = 0.0)

/** One open modal in the owner stack (a port of the source `ModalSession` entry). */
internal class AWCModalOwner(val id: String) {
    var escape: () -> Boolean = { false }
    /** After focus moved into the surface: component-specific `:focus-visible` handling (pointer modality hides rings). */
    var focused: (pointer: Boolean) -> Unit = {}
    /** The `tabindex=-1` container: focused when the surface has no tabbable descendant. */
    var focusContainer: () -> Boolean = { false }
    var covered: () -> Unit = {}
    /** The focus group whose focused child was saved when this owner opened (null: nothing was focused). */
    var opener: FocusRequester? = null
    var openerCaptured = false
    /** The owner whose surface holds [opener] (null: the page content). */
    var openerOwner: String? = null
    /** Focus groups inside the surface whose direct children are tabbable (slot content, actions): focus saved in a lower
     *  owner is saved one level from the control (Compose saves/restores a single level per group). */
    var groups: List<FocusRequester> = emptyList()
    /** Whether this owner's own `tabindex=-1` container holds focus (a pointer press on a non-focusable area focuses it). */
    var containerHasFocus: () -> Boolean = { false }
    /** A lower owner whose container held focus when this owner opened: restored with its container focus. */
    var openerContainer: AWCModalOwner? = null
    val surface = FocusRequester()
    var surfaceHasFocus = false
}

internal class AWCModalEntry(val id: String, val zIndex: State<Double>, val content: State<@Composable () -> Unit>)

/**
 * The shared owner stack and viewport for Dialog, Bottom Sheet and Side Sheet. Only the top owner handles Escape,
 * Android back, Tab and scrim dismissal; the content under any owner (and every covered owner) is inert; the
 * focus captured when an owner opens is restored when it closes, and a lower owner closing first forwards its
 * opener to the owner above.
 */
@Stable
class AWCModalSession internal constructor(paintOrder: AWCModalPaintOrder) {
    var paintOrder by mutableStateOf(paintOrder)
    /** The modal viewport in dp (CSS vw/vh, sheet breakpoints, dialog limits). */
    var viewportWidth by mutableDoubleStateOf(0.0); internal set
    var viewportHeight by mutableDoubleStateOf(0.0); internal set
    var safeArea by mutableStateOf(AWCModalInsets()); internal set
    internal val owners = mutableStateListOf<String>()
    internal val registry = mutableMapOf<String, AWCModalOwner>()
    internal val entries = mutableStateListOf<AWCModalEntry>()
    internal val content = FocusRequester()
    internal var contentHasFocus = false
    /** Last input modality: programmatic focus after a pointer press is not focus-visible (Chrome `:focus-visible`). */
    internal var lastInputPointer = false
    /** The document (`<body>`): a non-tabbable focus target outside the page content that blurred focus lands on, so the
     *  platform does not move focus to a default control (Android's keyboard-mode fallback). */
    internal val body = FocusRequester()
    internal var bodyWanted by mutableStateOf(false)
    internal var focusManager: FocusManager? = null
    internal var restoreRequest by mutableStateOf<Pair<FocusRequester?, Int>?>(null)
    internal var restoreContainer: AWCModalOwner? = null
    /** Focus that reached the inert content is recaptured by the top owner (the source focusin trap). */
    internal var recapture by mutableIntStateOf(0)
    /** Key presses seen while a modal is open: Chrome re-evaluates :hover for a control that appeared under a still
     *  pointer at the next key input (the fullscreen close button gains its hover tint on the first Tab). */
    internal var keyInputs by mutableIntStateOf(0)
    /** Diagnostics of the last focus restoration (inspection only). */
    internal var lastRestore = ""
    private var restoreSerial = 0
    val isActive get() = owners.isNotEmpty()
    fun isTop(id: String) = owners.lastOrNull() == id
    internal fun index(id: String) = owners.indexOf(id)
    internal fun covered(id: String) = owners.contains(id) && !isTop(id)
    internal val top get() = owners.lastOrNull()?.let { registry[it] }

    internal fun acquire(owner: AWCModalOwner) {
        if (owners.contains(owner.id)) { registry[owner.id] = owner; return }
        val previous = top
        owner.opener = null; owner.openerCaptured = false
        captureOpener(owner)
        registry[owner.id] = owner; owners.add(owner.id)
        previous?.covered?.invoke()
    }
    /**
     * Saves the focused child of the group holding focus (the content or a lower owner's surface) so it is restored
     * when [owner] closes. Called at open and again right before focus first moves into the owner: a pointer press
     * focuses its control asynchronously, after the click that opened the modal (Chrome focuses it at mousedown).
     */
    @OptIn(ExperimentalComposeUiApi::class)
    internal fun captureOpener(owner: AWCModalOwner) {
        if (owner.openerCaptured) return
        val holder = owners.asReversed().filter { it != owner.id }.mapNotNull { registry[it] }.firstOrNull { it.surfaceHasFocus }
        if (holder != null && holder.containerHasFocus()) {
            owner.opener = null; owner.openerContainer = holder; owner.openerOwner = holder.id; owner.openerCaptured = true; return
        }
        owner.openerContainer = null
        owner.opener = when {
            holder != null -> holder.groups.firstOrNull { it.saveFocusedChild() } ?: holder.surface.takeIf { it.saveFocusedChild() }
            contentHasFocus -> content.takeIf { it.saveFocusedChild() }
            else -> null
        }
        owner.openerOwner = if (owner.opener != null) holder?.id else null
        owner.openerCaptured = owner.opener != null
    }
    internal fun release(id: String) {
        val index = owners.indexOf(id); val owner = registry[id] ?: return
        if (index < 0) return
        owners.removeAt(index); registry.remove(id)
        if (index < owners.size) {
            // A lower owner closed first: the owner above inherits its opener (the source forwards restoration).
            registry[owners[index]]?.let { above -> if ((above.opener == null && above.openerContainer == null) || above.openerOwner == owner.id) {
                above.opener = owner.opener; above.openerOwner = owner.openerOwner; above.openerContainer = owner.openerContainer } }
        } else {
            restoreContainer = owner.openerContainer
            restoreRequest = owner.opener to ++restoreSerial
        }
    }
    /**
     * Focus the top owner's first (or, backward, last) tabbable in source order, or its `tabindex=-1` container when
     * it has none: from the focused container, the next traversal stop is its first descendant and the previous one
     * wraps to its last (every other group refuses traversal).
     */
    internal fun focusFirst(owner: AWCModalOwner, backward: Boolean = false) {
        if (!isTop(owner.id)) return
        val fm = focusManager ?: return
        captureOpener(owner)
        if (!owner.focusContainer()) return
        val moved = fm.moveFocus(if (backward) FocusDirection.Previous else FocusDirection.Next)
        if (!moved || !owner.surfaceHasFocus) owner.focusContainer()
        owner.focused(lastInputPointer)
    }
    /** Tab / Shift+Tab: native traversal over the top owner's surface (the only enterable group), wrapping at both ends. */
    internal fun tab(backward: Boolean): Boolean {
        val owner = top ?: return false
        val fm = focusManager ?: return true
        // Focus that escaped (body) is recaptured to the first tabbable (the source focusin trap).
        if (!owner.surfaceHasFocus) { focusFirst(owner); return true }
        val moved = fm.moveFocus(if (backward) FocusDirection.Previous else FocusDirection.Next)
        if (!moved || !owner.surfaceHasFocus) focusFirst(owner, backward)
        return true
    }
    internal fun escape(): Boolean = top?.escape?.invoke() ?: false
    /** Pressing a non-focusable surface (a protected scrim) blurs focus to the document body in Chrome. */
    internal fun blur() {
        bodyWanted = true
        if (!runCatching { body.requestFocus() }.getOrDefault(false)) { bodyWanted = false; focusManager?.clearFocus(true) }
    }
    /** Entries in paint order (bottom first): by source z-index then owner position, or by owner position. */
    internal fun painted(): List<AWCModalEntry> = when (paintOrder) {
        AWCModalPaintOrder.SourceZIndex -> entries.sortedWith(compareBy<AWCModalEntry>({ it.zIndex.value }, { index(it.id.substringBefore('#')) }))
        AWCModalPaintOrder.OwnerOrder -> entries.sortedBy { index(it.id.substringBefore('#')) }
    }
}

internal val LocalAWCModalSession = staticCompositionLocalOf<AWCModalSession?> { null }

/**
 * Hosts Dialog, Bottom Sheet and Side Sheet in the application's actual viewport (not platform windows): place it
 * at the content root. Content under an open modal is inert (no focus traversal, hidden from assistive
 * technology; the scrim takes pointer input), Escape, Android back and Tab route to the top owner, and the
 * viewport and safe areas feed vw/vh, the sheet breakpoints and the dialog limits. A component rendered without a
 * scope hosts its own, using its proposed size as the viewport.
 */
@Composable
fun AWCModalScope(modifier: Modifier = Modifier, paintOrder: AWCModalPaintOrder = AWCModalPaintOrder.SourceZIndex,
                  insets: WindowInsets = WindowInsets.safeDrawing, content: @Composable () -> Unit) {
    val session = remember { AWCModalSession(paintOrder) }
    SideEffect { session.paintOrder = paintOrder }
    val fm = LocalFocusManager.current
    SideEffect { session.focusManager = fm }
    ModalWindowRouting(session)
    val restore = session.restoreRequest
    LaunchedEffect(restore) {
        val request = restore ?: return@LaunchedEffect
        // The underlying content leaves the inert state in the composition that released the owner.
        // A lower owner's surface becomes enterable once the released owner's surface stops holding focus: retry for a
        // few frames (the source restores synchronously; a frame later here).
        // The lower owner's container held focus: focus it again (the source restores the container element).
        val container = session.restoreContainer?.takeIf { request.first == null }
        if (container != null) { withFrameNanos { }; if (session.isTop(container.id)) container.focusContainer(); session.restoreContainer = null; return@LaunchedEffect }
        var restored = false; var frames = 0
        while (!restored && frames < 8 && request.first != null) {
            withFrameNanos { }; frames++
            @OptIn(ExperimentalComposeUiApi::class)
            val attempt = request.first?.restoreFocusedChild() == true
            restored = attempt
        }
        // Compose could not locate the saved child (observed for focus saved inside a lower owner's surface): enter the
        // group that held focus instead (its first focusable child).
        var fallback = false
        if (!restored && request.first != null && session.isActive) { fallback = runCatching { request.first!!.requestFocus() }.getOrDefault(false); restored = fallback }
        if (request.first == null) withFrameNanos { }
        session.lastRestore = (session.lastRestore + " | opener=${request.first != null} restored=$restored fallback=$fallback frames=$frames active=${session.isActive} top=${session.top?.id?.take(18)}").takeLast(600)
        if (!restored && !session.isActive) session.blur()
    }
    val recapture = session.recapture
    LaunchedEffect(recapture) {
        if (recapture == 0) return@LaunchedEffect
        withFrameNanos { }
        session.top?.let { if (session.contentHasFocus) session.focusFirst(it) }
    }
    val density = LocalDensity.current
    val view = LocalView.current
    val active = session.isActive
    BoxWithConstraints(modifier
        .onGloballyPositioned { c ->
            val p = c.positionInWindow(); val d = density.density.toDouble()
            // The part of each system inset that intrudes into the scope (a scope extending past the window gains nothing).
            val top = insets.getTop(density) - p.y.coerceAtLeast(0f); val left = insets.getLeft(density, LayoutDirection.Ltr) - p.x.coerceAtLeast(0f)
            val bottom = insets.getBottom(density) - (view.height - (p.y + c.size.height)).coerceAtLeast(0f)
            val right = insets.getRight(density, LayoutDirection.Ltr) - (view.width - (p.x + c.size.width)).coerceAtLeast(0f)
            val next = AWCModalInsets(top.coerceAtLeast(0f) / d, right.coerceAtLeast(0f) / d, bottom.coerceAtLeast(0f) / d, left.coerceAtLeast(0f) / d)
            if (next != session.safeArea) session.safeArea = next
        }
        .pointerInput(session) {
            awaitPointerEventScope {
                while (true) { val e = awaitPointerEvent(PointerEventPass.Initial)
                    if (e.type == PointerEventType.Press) session.lastInputPointer = true }
            }
        }) {
        val w = maxWidth.value.toDouble(); val h = maxHeight.value.toDouble()
        SideEffect { if (session.viewportWidth != w) session.viewportWidth = w; if (session.viewportHeight != h) session.viewportHeight = h }
        CompositionLocalProvider(LocalAWCModalSession provides session) {
            Box(Modifier
                .then(if (active) Modifier.clearAndSetSemantics {} else Modifier)
                .focusRequester(session.content)
                .onFocusChanged { session.contentHasFocus = it.hasFocus; if (it.hasFocus && session.isActive) session.recapture++ }
                // Inert under an open modal: traversal never enters it; explicit requests (a pending pointer focus,
                // restoration) still land, like the source page whose focusin is then recaptured by the trap.
                .focusProperties { if (session.isActive) { canFocus = false; onEnter = { if (requestedFocusDirection != FocusDirection.Enter) cancelFocusChange() } } }
                .focusGroup()) { content() }
            Box(Modifier.size(0.dp).focusRequester(session.body).onFocusChanged { if (!it.isFocused) session.bodyWanted = false }
                .focusProperties { canFocus = session.bodyWanted }.focusTarget())
            // Composition order is paint order; keyed groups keep each entry's state when the order changes.
            for (entry in session.painted()) {
                key(entry.id) { Box(Modifier.matchParentSize()) { entry.content.value() } }
            }
        }
    }
}

/** A modal rendered outside any scope hosts one around itself (its proposed size becomes the viewport while shown). */
@Composable
internal fun AWCModalImplicitScope(visible: Boolean, content: @Composable () -> Unit) {
    if (LocalAWCModalSession.current != null) { content(); return }
    AWCModalScope(if (visible) Modifier.fillMaxSize() else Modifier, insets = WindowInsets(0.dp, 0.dp, 0.dp, 0.dp)) { content() }
}

/** Registers [content] as this owner's entry in the scope overlay for as long as it is composed. */
@Composable
internal fun AWCModalEntryEffect(session: AWCModalSession?, id: String, visible: Boolean, zIndex: Double, content: @Composable () -> Unit) {
    val z = rememberUpdatedState(zIndex)
    // The layer reads the latest content in this pass when it can; the applied write below guarantees it re-reads it
    // after any recomposition of the owner (a property change on an open modal, e.g. a retained variant update).
    val c = remember { mutableStateOf(content, neverEqualPolicy()) }
    c.value = content
    SideEffect { c.value = content }
    if (session == null || !visible) return
    DisposableEffect(session, id) {
        val entry = AWCModalEntry(id, z, c)
        session.entries.add(entry)
        onDispose { session.entries.remove(entry) }
    }
}

/**
 * Window-level routing (keys reach the window before any Compose node, also when nothing is focused): Tab and
 * Shift+Tab always go to the top owner; Escape inside the top surface is left to Compose (the surface handles it
 * after its descendants, the source bubbling listener) and otherwise dismisses the top owner; Android back (the
 * key, or OnBackInvokedCallback on API 33+, registered only while a modal is open) dismisses the top owner.
 */
@Composable
private fun ModalWindowRouting(session: AWCModalSession) {
    val view = LocalView.current
    val window = remember(view) { modalWindow(view) }
    val active = session.isActive
    val back = remember(session) { if (Build.VERSION.SDK_INT >= 33) ModalBack33(session) else null }
    DisposableEffect(window, session) {
        val w = window ?: return@DisposableEffect onDispose {}
        val delegate = w.callback
        val callback = object : Window.Callback by delegate {
            override fun dispatchKeyEvent(event: KeyEvent): Boolean {
                if (event.action == KeyEvent.ACTION_DOWN) session.lastInputPointer = false
                if (!session.isActive) return delegate.dispatchKeyEvent(event)
                if (event.action == KeyEvent.ACTION_DOWN) session.keyInputs++
                when (event.keyCode) {
                    KeyEvent.KEYCODE_TAB -> { if (event.action == KeyEvent.ACTION_DOWN) session.tab(event.isShiftPressed); return true }
                    KeyEvent.KEYCODE_ESCAPE -> {
                        if (session.top?.surfaceHasFocus == true) return delegate.dispatchKeyEvent(event)
                        if (event.action == KeyEvent.ACTION_DOWN) session.escape()
                        return true
                    }
                    KeyEvent.KEYCODE_BACK -> {
                        // With OnBackInvokedCallback the system invokes it between down and up (then up is ignored).
                        if (event.action == KeyEvent.ACTION_DOWN) session.backPending = true
                        else if (event.action == KeyEvent.ACTION_UP && session.backPending) { session.backPending = false; session.escape() }
                        return true
                    }
                    else -> return delegate.dispatchKeyEvent(event)
                }
            }
        }
        w.callback = callback
        onDispose { if (w.callback === callback) w.callback = delegate }
    }
    DisposableEffect(window, active, back) {
        val w = window
        if (w != null && active) back?.register(w)
        onDispose { if (w != null) back?.unregister(w) }
    }
}
internal var AWCModalSession.backPending: Boolean
    get() = backPendingFlags[this] == true
    set(value) { backPendingFlags[this] = value }
private val backPendingFlags = java.util.WeakHashMap<AWCModalSession, Boolean>()

@RequiresApi(33)
private class ModalBack33(val session: AWCModalSession) {
    private var registered = false
    private val callback = android.window.OnBackInvokedCallback { session.backPending = false; session.escape() }
    fun register(w: Window) { if (!registered) { w.onBackInvokedDispatcher.registerOnBackInvokedCallback(android.window.OnBackInvokedDispatcher.PRIORITY_OVERLAY, callback); registered = true } }
    fun unregister(w: Window) { if (registered) { runCatching { w.onBackInvokedDispatcher.unregisterOnBackInvokedCallback(callback) }; registered = false } }
}

private fun modalWindow(view: View): Window? {
    var parent: ViewParent? = view.parent
    while (parent != null) { if (parent is DialogWindowProvider) return parent.window; parent = parent.parent }
    var context: android.content.Context? = view.context
    while (context != null) {
        if (context is android.app.Activity) return context.window
        context = (context as? android.content.ContextWrapper)?.baseContext?.takeUnless { it === context }
    }
    return null
}

/**
 * An owner surface: a focus group that reports whether it holds focus, cannot be entered while covered (or
 * closing), and dismisses on an Escape that no descendant consumed.
 */
internal fun Modifier.awcModalSurface(session: AWCModalSession?, owner: AWCModalOwner): Modifier =
    this.onKeyEvent { e -> if (e.type == KeyEventType.KeyDown && e.key == Key.Escape && session?.isTop(owner.id) == true) owner.escape() else false }
        .focusRequester(owner.surface)
        .onFocusChanged { owner.surfaceHasFocus = it.hasFocus }
        .focusProperties { if (session != null && !session.isTop(owner.id)) onEnter = { if (requestedFocusDirection != FocusDirection.Enter) cancelFocusChange() } }
        .focusGroup()

/** Frame clock for modal motion: the frame time (ms) of the latest rendered frame. */
@Stable internal class AWCModalClock {
    var frameMillis by mutableDoubleStateOf(0.0)
    var version by mutableIntStateOf(0)
}
/** Runs [apply] at every frame while [running] (frame-clock ms), then sleeps until [AWCModalClock.version] changes. */
@Composable internal fun AWCModalTicker(clock: AWCModalClock, running: (Double) -> Boolean, apply: (Double) -> Unit) {
    val runningNow by rememberUpdatedState(running); val applyNow by rememberUpdatedState(apply)
    LaunchedEffect(clock) {
        while (true) {
            withFrameNanos { t -> val ms = t / 1e6; applyNow(ms); clock.frameMillis = ms }
            if (!runningNow(clock.frameMillis)) { val v = clock.version; snapshotFlow { clock.version }.first { it != v } }
        }
    }
}
