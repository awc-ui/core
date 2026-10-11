package dev.awc.nativeui

import androidx.compose.runtime.*
import java.net.URI
import java.util.Locale
import java.util.UUID

/** An observable native destination stack. It does not contain a browser or start network requests. */
class AWCNavigationContext internal constructor(val id: String, val name: String?, val parentID: String?, initialURL: String) {
    private val stack = mutableStateListOf(initialURL)
    var index: Int by mutableIntStateOf(0)
        private set
    val history: List<String> get() = stack.toList()
    val currentURL: String get() = stack[index]
    val canGoBack: Boolean get() = index > 0
    internal fun push(url: String) {
        while (stack.lastIndex > index) stack.removeAt(stack.lastIndex)
        stack.add(url); index = stack.lastIndex
    }
    internal fun goBack() { index-- }
}

data class AWCNavigationTransition(
    val sourceContextID: String,
    val contextID: String,
    val url: String,
    val previousURL: String?,
    val target: String,
    val createsContext: Boolean,
    val kind: String = "navigate",
)

/** Resolve source links into observable native contexts, with veto before commit and presentation after. */
class AWCNavigationCoordinator(
    baseURL: String,
    private val shouldNavigate: (AWCNavigationTransition) -> Boolean = { true },
    private val onPresent: (AWCNavigationTransition) -> Unit = {},
) {
    val baseURL: String = absoluteSafeURL(baseURL)
        ?: throw IllegalArgumentException("Native navigation requires a safe absolute base URL")
    private val storage = mutableStateListOf(AWCNavigationContext("root", null, null, this.baseURL))
    private var inTransition = false
    val rootContextID: String = "root"
    var activeContextID: String by mutableStateOf(rootContextID)
        private set
    val contexts: List<AWCNavigationContext> get() = storage.toList()
    val activeContext: AWCNavigationContext get() = context(activeContextID)!!
    fun context(id: String): AWCNavigationContext? = storage.firstOrNull { it.id == id }
    fun activate(id: String): Boolean {
        if (inTransition || context(id) == null) return false
        activeContextID = id; return true
    }
    /** Close a native child and its descendants; the root remains available. */
    fun close(contextID: String): Boolean {
        if (inTransition) return false
        val closing = context(contextID)?.takeIf { it.id != rootContextID } ?: return false
        val removed = mutableSetOf(contextID)
        do { val count = removed.size; storage.filter { it.parentID in removed }.forEach { removed += it.id } } while (count != removed.size)
        storage.removeAll { it.id in removed }
        if (activeContextID in removed) activeContextID = closing.parentID?.takeIf { context(it) != null } ?: rootContextID
        return true
    }
    /** Explicit child ownership is native application structure, independent of navigation targets. */
    fun createContext(name: String? = null, parentID: String = activeContextID, initialURL: String? = null): AWCNavigationContext {
        check(!inTransition) { "Cannot create a native context while navigation is being approved" }
        val parent = requireNotNull(context(parentID)) { "Unknown native parent context" }
        require(name == null || validContextName(name) && !name.startsWith("_")) { "Use a non-reserved native context name" }
        require(name == null || storage.none { it.name == name }) { "Native context name is already registered" }
        val url = resolve(initialURL ?: parent.currentURL, parent.currentURL) ?: throw IllegalArgumentException("Unsafe native context URL")
        return AWCNavigationContext(UUID.randomUUID().toString(), name, parentID, url).also(storage::add)
    }
    fun navigate(request: AWCNavigationRequest, sourceContextID: String = activeContextID): Boolean {
        if (inTransition) return false
        val source = context(sourceContextID) ?: return false
        val safe = AWCNavigationRequest.from(request.url, request.target) ?: return false
        val url = resolve(safe.url, source.currentURL) ?: return false
        val target = safe.target.ifEmpty { "_self" }
        if (!validContextName(target)) return false
        val reserved = target.lowercase(Locale.ROOT)
        if (target.startsWith("_") && reserved !in setOf("_self", "_parent", "_top", "_blank")) return false
        val destination = when (reserved) {
            "_self" -> source
            "_parent" -> source.parentID?.let(::context) ?: source
            "_top" -> generateSequence(source) { it.parentID?.let(::context) }.last()
            "_blank" -> null
            else -> storage.firstOrNull { it.name == target }
        }
        val id = destination?.id ?: UUID.randomUUID().toString()
        val transition = AWCNavigationTransition(source.id, id, url, destination?.currentURL, target, destination == null)
        return commitTransition(transition) {
            if (destination == null) {
                storage += AWCNavigationContext(id, if (reserved == "_blank") null else target, null, url)
            } else destination.push(url)
            activeContextID = id
        }
    }
    fun back(contextID: String = activeContextID): Boolean {
        if (inTransition) return false
        val destination = context(contextID)?.takeIf { it.canGoBack } ?: return false
        val transition = AWCNavigationTransition(contextID, contextID, destination.history[destination.index - 1], destination.currentURL, "_self", false, "back")
        return commitTransition(transition) { destination.goBack(); activeContextID = destination.id }
    }
    private fun commitTransition(transition: AWCNavigationTransition, commit: () -> Unit): Boolean {
        if (inTransition) return false
        inTransition = true
        try {
            if (!shouldNavigate(transition)) return false
            commit()
        } finally { inTransition = false }
        onPresent(transition)
        return true
    }
    /** If source is omitted, resolves from the active native context at activation time. */
    fun router(sourceContextID: String? = null): AWCURLRouter = AWCURLRouter { navigate(it, sourceContextID ?: activeContextID) }

    private fun resolve(value: String, base: String): String? {
        val request = AWCNavigationRequest.from(value) ?: return null
        val resolved = runCatching {
            val origin = URI(base); val link = URI(request.url)
            // java.net.URI.resolve drops the final path segment for query-only references.
            val destination = if (!origin.isOpaque && !link.isAbsolute && link.rawAuthority == null && link.rawPath.isNullOrEmpty() && link.rawQuery != null) {
                URI(base.substringBefore('#').substringBefore('?') + "?" + link.rawQuery + (link.rawFragment?.let { "#$it" } ?: ""))
            } else origin.resolve(link)
            destination.normalize().toASCIIString()
        }.getOrNull() ?: return null
        return absoluteSafeURL(resolved)
    }
    companion object {
        private fun absoluteSafeURL(value: String): String? = AWCNavigationRequest.from(value)?.url?.takeIf { runCatching { URI(it).isAbsolute }.getOrDefault(false) }
        private fun validContextName(name: String): Boolean = name.isNotEmpty() && name.length <= 256 && name.none { it.isWhitespace() || it.code < 32 || it.code == 127 }
    }
}

@Composable
fun rememberAWCNavigationCoordinator(
    baseURL: String,
    shouldNavigate: (AWCNavigationTransition) -> Boolean = { true },
    onPresent: (AWCNavigationTransition) -> Unit = {},
): AWCNavigationCoordinator {
    val veto = rememberUpdatedState(shouldNavigate); val present = rememberUpdatedState(onPresent)
    return remember(baseURL) { AWCNavigationCoordinator(baseURL, { veto.value(it) }, { present.value(it) }) }
}

@Composable
fun AWCNavigationScope(coordinator: AWCNavigationCoordinator, contextID: String? = null, content: @Composable () -> Unit) {
    val router = remember(coordinator, contextID) { coordinator.router(contextID) }
    AWCNavigationScope(router, content)
}
