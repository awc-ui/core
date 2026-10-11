package dev.awc.nativeui

import androidx.compose.runtime.*
import java.net.URLEncoder

/** Ordered successful native form data. Repeated names remain separate entries. */
data class AWCFormEntry(val name: String, val value: String)
fun encodeAWCForm(entries: List<AWCFormEntry>): String = entries.joinToString("&") {
    fun encode(value: String) = URLEncoder.encode(value.replace(Regex("\\r\\n|\\r|\\n"), "\r\n"), "UTF-8")
    "${encode(it.name)}=${encode(it.value)}"
}

@Stable
class AWCFormField internal constructor(var name: String, initialValue: AWCValue, internal var validator: (AWCValue) -> String?) {
    private val initial = copyFormValue(initialValue)
    var value: AWCValue by mutableStateOf(copyFormValue(initialValue))
    var error: String? by mutableStateOf(null)
        internal set
    internal var tag: String? = null
    internal var properties: Props = emptyMap()
    internal var resetVersion by mutableIntStateOf(0)
    internal fun reset() {
        value = if (tag == "md-otp-field") "" else copyFormValue(initial)
        error = null
        resetVersion++
    }
    internal val disabled get() = properties.bool("disabled")
    internal fun entries(): List<AWCFormEntry> = nativeFormEntries(this)
}

data class AWCFormSubmission(
    val values: Map<String, AWCValue>,
    val submitter: Map<String, AWCValue>,
    val entries: List<AWCFormEntry> = emptyList(),
) { val encoded: String get() = encodeAWCForm(entries) }

/** Native form membership and rules; no ElementInternals or browser network submission. */
@Stable
class AWCFormState(
    private val onSubmit: (AWCFormSubmission) -> Unit = {},
    private val onReset: (Map<String, AWCValue>) -> Unit = {},
    private val onInvalid: (Map<String, String>) -> Unit = {},
    private val onSubmitEvent: (AWCActionEvent) -> Unit = {},
    private val onResetEvent: (AWCActionEvent) -> Unit = {},
) {
    private val fields = mutableStateListOf<AWCFormField>()
    private val buttons = mutableListOf<Pair<Any, () -> Unit>>()
    val values: Map<String, AWCValue> get() = fields.filter { it.name.isNotEmpty() }.groupBy { it.name }.mapValues { (_, list) ->
        if (list.size == 1) copyFormValue(list.first().value) else list.map { copyFormValue(it.value) }
    }
    val errors: Map<String, String> get() = fields.mapIndexedNotNull { index, field -> field.error?.let { (field.name.ifBlank { "#$index" }) to it } }.toMap()
    val entries: List<AWCFormEntry> get() = fields.flatMap { it.entries() }

    /** Manual registration is retained for custom controls. AWCComponent registers source controls automatically. */
    fun register(name: String, initialValue: AWCValue, validate: (AWCValue) -> String? = { null }): AWCFormField {
        require(name.isNotBlank()) { "A manual native form field requires a name." }
        require(fields.none { it.name == name }) { "Native form field '$name' is already registered." }
        return AWCFormField(name, initialValue, validate).also(::attach)
    }
    internal fun attach(field: AWCFormField) { if (fields.none { it === field }) fields.add(field) }
    fun unregister(field: AWCFormField) { fields.removeAll { it === field } }
    internal fun selectRadio(field: AWCFormField) {
        if (field.value != true || field.name.isEmpty()) return
        fields.filter { it !== field && it.tag == "md-radio" && it.name == field.name }.forEach { it.value = false }
    }
    private fun validationError(field: AWCFormField): String? = when {
                field.disabled -> null
                field.tag == "md-radio" && field.name.isNotEmpty() && fields.any { it.tag == "md-radio" && it.name == field.name && it.properties.bool("required") } ->
                    if (fields.any { it.tag == "md-radio" && it.name == field.name && it.value == true }) null else "Choose an option"
                else -> field.validator(field.value)
            }
    internal fun refreshErrors() { fields.filter { it.error != null }.forEach { it.error = validationError(it) } }
    fun validate(): Boolean {
        fields.toList().forEach { it.error = validationError(it) }
        return errors.isEmpty()
    }
    /** Explicit submitter entries are a native API; source md-button has no name and supplies none. */
    fun submit(submitter: Map<String, AWCValue> = emptyMap(), submitterEntry: AWCFormEntry? = null): Boolean {
        if (!validate()) { onInvalid(errors); return false }
        val event = AWCActionEvent("mdSubmit", "form", mapOf("values" to values, "entries" to entries.map { mapOf("name" to it.name, "value" to it.value) }))
        onSubmitEvent(event)
        if (event.defaultPrevented) return false
        val successful = entries + listOfNotNull(submitterEntry?.takeIf { it.name.isNotEmpty() })
        val mapped = successful.groupBy { it.name }.mapValues { (_, list) -> if (list.size == 1) list.first().value else list.map { it.value } }
        onSubmit(AWCFormSubmission(mapped, submitter.toMap(), successful))
        return true
    }
    fun reset(): Boolean {
        val event = AWCActionEvent("mdReset", "form", mapOf("values" to values))
        onResetEvent(event)
        if (event.defaultPrevented) return false
        fields.toList().forEach { it.reset(); if (it.tag == "md-radio") selectRadio(it) }
        onReset(values)
        return true
    }
    internal fun registerSubmitButton(identity: Any, activate: () -> Unit) { buttons.add(identity to activate) }
    internal fun unregisterSubmitButton(identity: Any) { buttons.removeAll { it.first === identity } }
    /** The first associated submit button remains default even when it blocks activation. */
    fun requestSubmit() { buttons.firstOrNull()?.second?.invoke() ?: submit() }
}

internal fun copyFormValue(value: AWCValue): AWCValue = when (value) {
    is Map<*, *> -> value.entries.associate { it.key to copyFormValue(it.value) }
    is List<*> -> value.map(::copyFormValue)
    else -> value
}
internal val LocalAWCForm = staticCompositionLocalOf<AWCFormState?> { null }
internal val LocalAWCFormOwner = staticCompositionLocalOf<String?> { null }
class AWCFormRegistry {
    private val forms = mutableStateMapOf<String, AWCFormState>()
    internal fun attach(id: String, state: AWCFormState) { require(id.isNotBlank()); require(forms[id] == null || forms[id] === state) { "Duplicate native form id '$id'." }; forms[id] = state }
    internal fun detach(id: String, state: AWCFormState) { if (forms[id] === state) forms.remove(id) }
    fun find(id: String): AWCFormState? = forms[id]
}
internal val LocalAWCFormRegistry = staticCompositionLocalOf<AWCFormRegistry?> { null }
@Composable fun AWCFormRegistryScope(registry: AWCFormRegistry = remember { AWCFormRegistry() }, content: @Composable () -> Unit) {
    CompositionLocalProvider(LocalAWCFormRegistry provides registry, content = content)
}
@Composable fun AWCFormOwnerScope(id: String, content: @Composable () -> Unit) {
    CompositionLocalProvider(LocalAWCFormOwner provides id, content = content)
}
@Composable internal fun currentAWCForm(): AWCFormState? {
    val owner = LocalAWCFormOwner.current
    return if (owner == null) LocalAWCForm.current else LocalAWCFormRegistry.current?.find(owner)
}
@Composable
fun rememberAWCFormState(
    onSubmit: (AWCFormSubmission) -> Unit = {}, onReset: (Map<String, AWCValue>) -> Unit = {}, onInvalid: (Map<String, String>) -> Unit = {},
    onSubmitEvent: (AWCActionEvent) -> Unit = {}, onResetEvent: (AWCActionEvent) -> Unit = {},
): AWCFormState {
    val submit = rememberUpdatedState(onSubmit); val reset = rememberUpdatedState(onReset); val invalid = rememberUpdatedState(onInvalid)
    val beforeSubmit = rememberUpdatedState(onSubmitEvent); val beforeReset = rememberUpdatedState(onResetEvent)
    return remember { AWCFormState({ submit.value(it) }, { reset.value(it) }, { invalid.value(it) }, { beforeSubmit.value(it) }, { beforeReset.value(it) }) }
}
@Composable
fun AWCFormScope(state: AWCFormState, id: String? = null, content: @Composable () -> Unit) {
    val registry = LocalAWCFormRegistry.current
    DisposableEffect(registry, id, state) {
        if (id != null) checkNotNull(registry) { "Use AWCFormRegistryScope for named native forms." }.attach(id, state)
        onDispose { if (id != null) registry?.detach(id, state) }
    }
    CompositionLocalProvider(LocalAWCForm provides state, LocalAWCFormOwner provides null, content = content)
}
@Composable
fun rememberAWCFormField(name: String, initialValue: AWCValue, validate: (AWCValue) -> String? = { null }): AWCFormField {
    val form = checkNotNull(currentAWCForm()) { "Place rememberAWCFormField inside a native form scope." }
    val latest = rememberUpdatedState(validate)
    val field = remember(form, name) { AWCFormField(name, initialValue) { latest.value(it) } }
    DisposableEffect(form, field) { form.attach(field); onDispose { form.unregister(field) } }
    return field
}
