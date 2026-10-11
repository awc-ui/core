package dev.awc.nativeui

import androidx.compose.runtime.*
import java.net.URI
import java.util.Locale
import java.util.UUID

/** Native dispatch phases; NONE is restored after synchronous delivery. */
enum class AWCEventPhase { NONE, CAPTURE, TARGET, BUBBLE }

data class AWCActivationMetadata(val source: String = "unknown", val x: Float? = null, val y: Float? = null)

/** Synchronous native event. Canceling defaults never cancels the underlying OS event. */
class AWCActionEvent(
    val name: String,
    val tag: String,
    val detail: Map<String, AWCValue>,
    val cancelable: Boolean = name != "mdChange",
    val bubbles: Boolean = true,
    val crossesBoundaries: Boolean = true,
    val targetID: String = UUID.randomUUID().toString(),
    val activation: AWCActivationMetadata = AWCActivationMetadata(),
) {
    var phase: AWCEventPhase = AWCEventPhase.NONE
        internal set
    var currentScopeID: String? = null
        internal set
    var path: List<String> = listOf(targetID)
        internal set
    var defaultPrevented: Boolean = false
        private set
    var propagationStopped: Boolean = false
        private set
    var immediatePropagationStopped: Boolean = false
        private set
    fun preventDefault() { if (cancelable) defaultPrevented = true }
    fun stopPropagation() { propagationStopped = true }
    fun stopImmediatePropagation() { immediatePropagationStopped = true; propagationStopped = true }
}

/** Ordered listeners support multiple callbacks at one native scope or target. */
data class AWCActionListener(val phase: AWCEventPhase, val handler: (AWCActionEvent) -> Unit)

internal class AWCActionDispatcher(
    val parent: AWCActionDispatcher?,
    val id: String = UUID.randomUUID().toString(),
    val boundary: Boolean = false,
    val listeners: () -> List<AWCActionListener> = { emptyList() },
    val listener: (AWCActionEvent) -> Unit,
) {
    fun dispatch(event: AWCActionEvent, targetListeners: List<(AWCActionEvent) -> Unit> = emptyList()) {
        val scopes = mutableListOf<AWCActionDispatcher>()
        var scope: AWCActionDispatcher? = this
        while (scope != null) {
            scopes += scope
            if (scope.boundary && !event.crossesBoundaries) break
            scope = scope.parent
        }
        // Snapshot both membership and listeners before invoking user code.
        val delivery = scopes.associateWith { it.listeners().toList() + AWCActionListener(AWCEventPhase.BUBBLE, it.listener) }
        val targetDelivery = targetListeners.toList()
        event.path = listOf(event.targetID) + scopes.map { it.id }
        fun deliver(node: AWCActionDispatcher, phase: AWCEventPhase) {
            event.phase = phase; event.currentScopeID = node.id
            for (callback in delivery.getValue(node).filter { it.phase == phase }) {
                if (event.immediatePropagationStopped) break
                callback.handler(event)
            }
        }
        try {
            for (node in scopes.asReversed()) {
                if (event.propagationStopped) break
                deliver(node, AWCEventPhase.CAPTURE)
            }
            if (!event.propagationStopped) {
                event.phase = AWCEventPhase.TARGET; event.currentScopeID = event.targetID
                for (callback in targetDelivery) {
                    if (event.immediatePropagationStopped) break
                    callback(event)
                }
            }
            if (event.bubbles) for (node in scopes) {
                if (event.propagationStopped) break
                deliver(node, AWCEventPhase.BUBBLE)
            }
        } finally { event.phase = AWCEventPhase.NONE; event.currentScopeID = null }
    }
}
internal val LocalAWCAction = staticCompositionLocalOf<AWCActionDispatcher?> { null }
internal data class AWCActionTarget(val id: String, val listeners: () -> List<(AWCActionEvent) -> Unit>)
internal val LocalAWCActionTarget = staticCompositionLocalOf<AWCActionTarget?> { null }

/** Capture runs outer-to-inner, then the target, then onAction/listeners inner-to-outer. */
@Composable
fun AWCActionScope(onAction: (AWCActionEvent) -> Unit, content: @Composable () -> Unit) {
    AWCActionScope(onAction = onAction, id = null, content = content)
}

@Composable
fun AWCActionScope(
    onAction: (AWCActionEvent) -> Unit,
    id: String?,
    onCapture: ((AWCActionEvent) -> Unit)? = null,
    boundary: Boolean = false,
    listeners: List<AWCActionListener> = emptyList(),
    content: @Composable () -> Unit,
) {
    val parent = LocalAWCAction.current
    val latest = rememberUpdatedState(onAction)
    val callbacks = rememberUpdatedState(listOfNotNull(onCapture?.let { AWCActionListener(AWCEventPhase.CAPTURE, it) }) + listeners)
    val generatedID = remember { UUID.randomUUID().toString() }
    val dispatcher = remember(parent, id, boundary) { AWCActionDispatcher(parent, id ?: generatedID, boundary, { callbacks.value }) { latest.value(it) } }
    CompositionLocalProvider(LocalAWCAction provides dispatcher, content = content)
}

/** Apply to one native action target. Target IDs and callbacks are independent of source DOM IDs. */
@Composable
fun AWCActionTargetScope(
    id: String? = null,
    onAction: (AWCActionEvent) -> Unit = {},
    listeners: List<(AWCActionEvent) -> Unit> = emptyList(),
    content: @Composable () -> Unit,
) {
    val generatedID = remember { UUID.randomUUID().toString() }
    val callbacks = rememberUpdatedState(listOf(onAction) + listeners)
    val target = remember(id) { AWCActionTarget(id ?: generatedID) { callbacks.value } }
    CompositionLocalProvider(LocalAWCActionTarget provides target, content = content)
}

internal fun dispatchNativeAction(event: AWCActionEvent, action: AWCActionDispatcher?, targetListeners: List<(AWCActionEvent) -> Unit>) {
    if (action != null) action.dispatch(event, targetListeners)
    else try {
        event.phase = AWCEventPhase.TARGET; event.currentScopeID = event.targetID
        for (callback in targetListeners.toList()) {
            if (event.immediatePropagationStopped) break
            callback(event)
        }
    } finally { event.phase = AWCEventPhase.NONE; event.currentScopeID = null }
}

data class AWCNavigationRequest(val url: String, val target: String) {
    companion object {
        /** Same scheme allowlist as source. Relative links resolve in a native coordinator. */
        fun from(href: String, target: String = "_self"): AWCNavigationRequest? {
            val value = href.trim()
            if (value.isEmpty() || value.any { it.code < 32 || it.code == 127 }) return null
            val uri = runCatching { URI(value) }.getOrNull() ?: return null
            val scheme = uri.scheme?.lowercase(Locale.ROOT)
            if (scheme != null && scheme !in setOf("http", "https", "mailto", "tel", "sms", "ftp")) return null
            if (scheme in setOf("http", "https", "ftp") && uri.rawAuthority.isNullOrEmpty()) return null
            return AWCNavigationRequest(value, target)
        }
    }
}

fun interface AWCURLRouter { fun open(request: AWCNavigationRequest): Boolean }
internal val LocalAWCURLRouter = staticCompositionLocalOf<AWCURLRouter?> { null }

@Composable
fun AWCNavigationScope(router: AWCURLRouter, content: @Composable () -> Unit) {
    CompositionLocalProvider(LocalAWCURLRouter provides router, content = content)
}

/** Explicit native content lookup. Removing a name restores its source fallback on recomposition. */
class AWCSlotRegistry(private val entries: Map<String, @Composable () -> Unit>) {
    fun contains(name: String): Boolean = entries.containsKey(name)
    @Composable fun Render(name: String) { entries[name]?.invoke() }
}
internal val LocalAWCSlots = staticCompositionLocalOf<AWCSlotRegistry?> { null }

@Composable
fun AWCSlotsScope(registry: AWCSlotRegistry, content: @Composable () -> Unit) {
    CompositionLocalProvider(LocalAWCSlots provides registry, content = content)
}

/** Shared by the actual Compose click target and pure action-contract tests. */
internal fun performNativeButtonAction(
    p: Props,
    selected: Boolean,
    emit: EventSink,
    action: AWCActionDispatcher?,
    form: AWCFormState?,
    router: AWCURLRouter,
    changesSelection: Boolean = p.bool("toggle"),
    targetID: String = UUID.randomUUID().toString(),
    targetListeners: List<(AWCActionEvent) -> Unit> = emptyList(),
    activation: AWCActivationMetadata = AWCActivationMetadata(),
    commitSelection: (Boolean) -> Boolean,
): Boolean {
    if (!p.enabled() || p.bool("loading")) return false
    val proposed = if (changesSelection) !selected else selected
    val detail = eventDetail("value" to p["value"], "toggle" to p.bool("toggle"), "selected" to proposed,
        "href" to p.str("href"), "target" to p.str("target", "_self"))
    val event = AWCActionEvent("mdClick", "md-button", detail, targetID = targetID, activation = activation)
    dispatchNativeAction(event, action, targetListeners)
    // Legacy observation remains unconditional, even when capture prevents delivery to the target.
    emit("mdClick", detail)
    if (event.defaultPrevented) return false
    if (changesSelection) {
        val committed = commitSelection(proposed)
        if (p.bool("toggle")) {
            val change = eventDetail("selected" to committed, "value" to p["value"])
            dispatchNativeAction(AWCActionEvent("mdChange", "md-button", change, cancelable = false, targetID = targetID, activation = activation), action, targetListeners)
            emit("mdChange", change)
        }
    }
    // Test the raw href, so an unsafe/non-resolvable link never becomes a form submit.
    if (p.str("href").isNotEmpty()) {
        AWCNavigationRequest.from(p.str("href"), p.str("target", "_self"))?.let(router::open)
        return true
    }
    when (p.str("type", "button")) {
        "submit" -> form?.submit(detail)
        "reset" -> form?.reset()
    }
    return true
}
