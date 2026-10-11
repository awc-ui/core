package dev.awc.nativeui

import androidx.compose.runtime.*

/** A registered native value. Its initial value is retained until this field is unregistered. */
@Stable
class AWCFormField internal constructor(val name: String, initialValue: AWCValue, internal var validator: (AWCValue) -> String?) {
    private val initial = copyFormValue(initialValue)
    var value: AWCValue by mutableStateOf(copyFormValue(initialValue))
    var error: String? by mutableStateOf(null)
        internal set
    internal fun reset() { value = copyFormValue(initial); error = null }
}

data class AWCFormSubmission(val values: Map<String, AWCValue>, val submitter: Map<String, AWCValue>)

/** Explicit native form membership; no implicit DOM association or HTML constraint parser. */
@Stable
class AWCFormState(
    private val onSubmit: (AWCFormSubmission) -> Unit = {},
    private val onReset: (Map<String, AWCValue>) -> Unit = {},
    private val onInvalid: (Map<String, String>) -> Unit = {},
) {
    private val fields = mutableStateMapOf<String, AWCFormField>()
    val values: Map<String, AWCValue> get() = fields.mapValues { copyFormValue(it.value.value) }
    val errors: Map<String, String> get() = fields.mapNotNull { (name, field) -> field.error?.let { name to it } }.toMap()

    /** Register once and retain the returned field, or use rememberAWCFormField for lifecycle cleanup. */
    fun register(name: String, initialValue: AWCValue, validate: (AWCValue) -> String? = { null }): AWCFormField {
        return AWCFormField(name, initialValue, validate).also(::attach)
    }
    internal fun attach(field: AWCFormField) {
        require(field.name.isNotBlank()) { "A native form field requires a name." }
        require(fields[field.name] == null || fields[field.name] === field) { "Native form field '${field.name}' is already registered." }
        fields[field.name] = field
    }
    fun unregister(field: AWCFormField) { if (fields[field.name] === field) fields.remove(field.name) }
    fun validate(): Boolean {
        fields.values.toList().forEach { it.error = it.validator(it.value) }
        return errors.isEmpty()
    }
    fun submit(submitter: Map<String, AWCValue> = emptyMap()): Boolean {
        if (!validate()) { onInvalid(errors); return false }
        onSubmit(AWCFormSubmission(values, submitter.toMap()))
        return true
    }
    fun reset() {
        fields.values.toList().forEach { it.reset() }
        onReset(values)
    }
}

private fun copyFormValue(value: AWCValue): AWCValue = when (value) {
    is Map<*, *> -> value.entries.associate { it.key to copyFormValue(it.value) }
    is List<*> -> value.map(::copyFormValue)
    else -> value
}

internal val LocalAWCForm = staticCompositionLocalOf<AWCFormState?> { null }

@Composable
fun rememberAWCFormState(
    onSubmit: (AWCFormSubmission) -> Unit = {},
    onReset: (Map<String, AWCValue>) -> Unit = {},
    onInvalid: (Map<String, String>) -> Unit = {},
): AWCFormState {
    val submit = rememberUpdatedState(onSubmit)
    val reset = rememberUpdatedState(onReset)
    val invalid = rememberUpdatedState(onInvalid)
    return remember { AWCFormState({ submit.value(it) }, { reset.value(it) }, { invalid.value(it) }) }
}

/** A nested scope isolates membership and button submit/reset from its enclosing form. */
@Composable
fun AWCFormScope(state: AWCFormState, content: @Composable () -> Unit) {
    CompositionLocalProvider(LocalAWCForm provides state, content = content)
}

@Composable
fun rememberAWCFormField(name: String, initialValue: AWCValue, validate: (AWCValue) -> String? = { null }): AWCFormField {
    val form = checkNotNull(LocalAWCForm.current) { "Place rememberAWCFormField inside AWCFormScope." }
    val latest = rememberUpdatedState(validate)
    val field = remember(form, name) { AWCFormField(name, initialValue) { latest.value(it) } }
    DisposableEffect(form, field) { form.attach(field); onDispose { form.unregister(field) } }
    return field
}
