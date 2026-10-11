package dev.awc.nativeui

import androidx.compose.runtime.*
import java.net.URI
import java.util.Locale

/** Synchronous native action. Cancellation affects defaults; propagation only affects AWC scopes. */
class AWCActionEvent(
    val name: String,
    val tag: String,
    val detail: Map<String, AWCValue>,
) {
    var defaultPrevented: Boolean = false
        private set
    var propagationStopped: Boolean = false
        private set
    fun preventDefault() { defaultPrevented = true }
    fun stopPropagation() { propagationStopped = true }
}

internal class AWCActionDispatcher(val parent: AWCActionDispatcher?, val listener: (AWCActionEvent) -> Unit) {
    fun dispatch(event: AWCActionEvent) {
        listener(event)
        if (!event.propagationStopped) parent?.dispatch(event)
    }
}
internal val LocalAWCAction = staticCompositionLocalOf<AWCActionDispatcher?> { null }

/** mdClick travels from the nearest scope outwards, after legacy onEvent and before default effects. */
@Composable
fun AWCActionScope(onAction: (AWCActionEvent) -> Unit, content: @Composable () -> Unit) {
    val parent = LocalAWCAction.current
    val latest = rememberUpdatedState(onAction)
    val dispatcher = remember(parent) { AWCActionDispatcher(parent) { latest.value(it) } }
    CompositionLocalProvider(LocalAWCAction provides dispatcher, content = content)
}

data class AWCNavigationRequest(val url: String, val target: String) {
    companion object {
        /** Same scheme allowlist as the source. Relative routes need an application router. */
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

/** Return true if handled. Native routing receives target metadata; it does not create browser contexts. */
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
    commitSelection: (Boolean) -> Boolean,
): Boolean {
    if (!p.enabled() || p.bool("loading")) return false
    val proposed = if (changesSelection) !selected else selected
    val detail = eventDetail("value" to p["value"], "toggle" to p.bool("toggle"), "selected" to proposed,
        "href" to p.str("href"), "target" to p.str("target", "_self"))
    emit("mdClick", detail)
    val event = AWCActionEvent("mdClick", "md-button", detail)
    action?.dispatch(event)
    if (event.defaultPrevented) return false
    if (changesSelection) {
        val committed = commitSelection(proposed)
        if (p.bool("toggle")) emit("mdChange", eventDetail("selected" to committed, "value" to p["value"]))
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
