package dev.awc.nativeui.stepper

/** md-step's host properties (one composition's worth). */
data class StepProps(
    val label: String = "", val description: String = "", val errorText: String = "", val icon: String = "",
    val completedIcon: String = "check", val errorIcon: String = "priority_high", val accessibleName: String? = null,
    /** A standalone md-step's own `active` (inside a stepper the stepper's index decides). */
    val active: Boolean? = null,
    /** The step's own inline `style` (its `--md-step-*` hooks win over the stepper's). */
    val style: String = "",
    val completed: Boolean = false, val error: Boolean = false, val disabled: Boolean = false, val optional: Boolean = false,
    val editable: Boolean = false, val hideActions: Boolean = false, val density: Double = 0.0,
    /** Whether the step has light-DOM content of its own (drives the panels). */
    val hasContent: Boolean = false,
)

/** md-stepper's host properties. */
data class StepperProps(
    val orientation: String = "horizontal", val indicator: String = "numbered", val variant: String = "default", val mode: String = "linear",
    val active: Double = 0.0, val autoComplete: Boolean = true, val nav: Boolean = true, val readonly: Boolean = false,
    val nextDisabled: Boolean = false, val loading: Boolean = false, val lazy: Boolean = false,
    val label: String = "Progress", val stepWord: String = "Step", val ofWord: String = "of", val completedWord: String = "completed",
    val currentWord: String = "current", val errorWord: String = "error", val optionalWord: String = "Optional",
    val nextLabel: String = "Continue", val backLabel: String = "Back", val finishLabel: String = "Finish", val density: Double = 0.0,
)

/**
 * md-stepper + md-step behaviour (md-stepper.tsx / md-step.tsx), lockstep with Swift's AWCStepperModel: the active index
 * and its watcher (clamp, auto-complete, mdStepChange, the polite announcement), linear reachability (fix J), navigation
 * (next / prev / goTo / reset, header activation, the built-in nav), the cancelable mdBeforeChange and the error
 * announcement driven by app writes to `error` (fix K). Host properties arrive through [sync] with Stencil's watcher
 * semantics: a watcher runs only when its property changed since the last sync, so the component's own writes (active,
 * completed, error) persist until the host changes that property.
 */
class StepperModel {
    var p = StepperProps(); private set
    var steps: List<StepProps> = emptyList(); private set
    var active = 0; private set
    private var lastActive = 0
    /** The polite (role=status) and assertive (role=alert) live-region texts. */
    var live = ""; private set
    var errorLive = ""; private set
    /** The header with keyboard focus (:focus-visible) and the focused element. */
    var focusVisible: Int? = null
    sealed class Focus { data class Header(val i: Int) : Focus(); data class Nav(val i: Int) : Focus(); data class Action(val step: Int, val i: Int) : Focus() }
    var focus: Focus? = null
    /** A standalone md-step: its composed name counts `data-total`, then absent (0). */
    var labelTotal: Int? = null
    /** (name, detail, cancelable) → false when prevented. */
    var emit: (String, Map<String, Any>?, Boolean) -> Boolean = { _, _, _ -> true }
    /** The component's own writes into its props (active) and into its steps (completed / error), for the host. */
    var onWrite: (String, Int?, Any) -> Unit = { _, _, _ -> }
    private var synced: Pair<StepperProps, List<StepProps>>? = null

    fun sync(props: StepperProps, hostSteps: List<StepProps>) {
        val prev = synced
        synced = props to hostSteps
        p = props
        if (prev == null) {
            steps = hostSteps
            active = clamp(props.active.toInt()); lastActive = active      // componentWillLoad: clamp without a change event
            if (active.toDouble() != props.active) onWrite("active", null, active)
            return
        }
        val next = hostSteps.toMutableList()
        var entered: Int? = null; var left = false
        for (i in next.indices) {
            if (i < prev.second.size && i < steps.size) {
                val old = prev.second[i]; val mine = steps[i]
                // A step property keeps the component's value unless the host changed it (the observer's app write).
                if (next[i].completed == old.completed) next[i] = next[i].copy(completed = mine.completed)
                if (next[i].error == old.error) next[i] = next[i].copy(error = mine.error)
                else if (next[i].error) entered = i else left = true
            } else if (next[i].error) entered = i
        }
        steps = next
        if (entered != null) announceError(entered)
        else if (left && steps.none { it.error }) errorLive = ""
        if (props.active != prev.first.active) setActive(if (props.active.isFinite()) props.active.toInt() else 0)
        else if (clamp(active) != active) setActive(clamp(active))
    }

    val count get() = steps.size
    fun clamp(i: Int) = if (steps.isEmpty()) 0 else i.coerceIn(0, steps.size - 1)
    /** A standalone md-step (no stepper): its own `active` property, index 0, a total of 0. */
    var standalone = false
    fun isActive(i: Int) = if (standalone) i < steps.size && steps[i].active == true else i == active
    val panelMode get() = if (p.orientation == "horizontal" && steps.any { it.hasContent }) "step" else "shared"
    fun reachable(i: Int): Boolean {
        if (p.readonly || p.mode != "linear") return true
        return i <= active || steps[i].completed || steps.take(i).all { it.completed || it.optional || it.disabled }
    }
    fun effectivelyDisabled(i: Int) = steps[i].disabled || !reachable(i)
    fun navActions(i: Int) = p.nav && !steps[i].hideActions
    fun hasPanel(i: Int) = if (p.orientation == "vertical") steps[i].hasContent || navActions(i) else panelMode == "step" && steps[i].hasContent
    fun renderPanel(i: Int) = hasPanel(i) && (!p.lazy || isActive(i))
    /** data-position: index 0 is "first" even when it is also the last step. */
    fun isLast(i: Int) = i != 0 && i == steps.size - 1
    fun glyph(i: Int): String? {
        val s = steps[i]
        if (p.indicator == "dot") return null
        if (s.error) return s.errorIcon
        if (s.icon.isNotEmpty()) return s.icon
        if (s.completed) return if (s.editable) "edit" else s.completedIcon
        return null
    }
    fun a11yLabel(i: Int): String {
        val s = steps[i]
        s.accessibleName?.takeIf { it.isNotBlank() }?.let { return it }
        var t = "${p.stepWord} ${i + 1} ${p.ofWord} ${labelTotal ?: steps.size}"
        if (s.label.isNotEmpty()) t += ": ${s.label}"
        if (s.optional) t += ", ${p.optionalWord}"
        if (s.completed) t += ", ${p.completedWord}"
        if (isActive(i)) t += ", ${p.currentWord}"
        if (s.error) t += ", ${p.errorWord}" + (if (s.errorText.isEmpty()) "" else ": ${s.errorText}")
        return t
    }
    /** The visible caption lines (optional caption, supporting / error text) — a readonly header's text. */
    fun textLines(i: Int): List<String> { val s = steps[i]; return listOf(if (s.optional) p.optionalWord else "", if (s.error && s.errorText.isNotEmpty()) s.errorText else s.description) }
    fun regionLabel(i: Int) = steps[i].label.ifEmpty { a11yLabel(i) }
    val isFinishStep get() = active >= steps.size - 1

    /** @Watch('active'): clamp, auto-complete, mdStepChange, announce. */
    fun setActive(v: Int) {
        val clamped = clamp(v); val previous = lastActive
        if (clamped != v || clamped.toDouble() != p.active) onWrite("active", null, clamped)
        active = clamped
        if (clamped == previous) return
        lastActive = clamped
        if (p.autoComplete) {
            if (clamped > previous) { for (i in steps.indices) if (i >= previous && i < clamped && !steps[i].disabled) write(i, true, false) }
            else if (!(steps[clamped].editable && steps[clamped].completed)) { for (i in steps.indices) if (i >= clamped) write(i, false, null) }
        }
        emit("mdStepChange", mapOf("index" to clamped, "previous" to previous), false)
        announceStep(clamped)
    }
    private fun write(i: Int, completed: Boolean?, error: Boolean?) {
        val m = steps.toMutableList(); var s = m[i]
        if (completed != null && s.completed != completed) { s = s.copy(completed = completed); onWrite("completed", i, completed) }
        if (error != null && s.error != error) { s = s.copy(error = error); onWrite("error", i, error) }
        m[i] = s; steps = m
    }
    private fun commit(target: Int): Boolean {
        if (target == active) return false
        if (!emit("mdBeforeChange", mapOf("index" to target, "previous" to active), true)) return false
        setActive(target); return true
    }
    fun canNavigate(target: Int): Boolean {
        if (target < 0 || target >= steps.size || steps[target].disabled) return false
        if (p.mode != "linear" || target <= active || steps[target].completed) return true
        return steps.take(target).all { it.completed || it.optional || it.disabled }
    }
    fun next() {
        if (steps.isEmpty()) return
        var t = active + 1
        while (t < steps.size && steps[t].disabled) t++
        if (t >= steps.size) {
            if (p.autoComplete && !steps[active].disabled) write(active, true, false)
            emit("mdComplete", null, false); return
        }
        commit(t)
    }
    fun prev() {
        var t = active - 1
        while (t >= 0 && steps[t].disabled) t--
        if (t < 0) return
        commit(t)
    }
    fun goTo(i: Int) { val c = clamp(i); if (canNavigate(c)) commit(c) }
    fun reset() { for (i in steps.indices) write(i, false, false); setActive(0) }
    /** md-step click / Enter / Space: mdStepClick when the header is a live control, then the stepper's onStepClick. */
    fun activateHeader(i: Int): Boolean {
        if (i < 0 || i >= steps.size || p.readonly || effectivelyDisabled(i)) return false
        emit("mdStepClick", mapOf("index" to i), false)
        if (i != active && canNavigate(i)) commit(i)
        return true
    }
    fun stepNext(i: Int) { val before = active; emit("mdStepNext", mapOf("index" to i), false); next(); if (active != before) { focus = Focus.Header(active); focusVisible = null } }
    fun stepBack(i: Int) { val before = active; emit("mdStepBack", mapOf("index" to i), false); prev(); if (active != before) { focus = Focus.Header(active); focusVisible = null } }
    fun footerBack() { prev(); if (active == 0) { focus = Focus.Header(active); focusVisible = null } }
    /** An app write to a step's `error` (the MutationObserver path), outside a host sync. */
    fun setStepError(i: Int, on: Boolean, text: String? = null) {
        val m = steps.toMutableList()
        if (text != null) m[i] = m[i].copy(errorText = text)
        if (m[i].error == on) { steps = m; return }
        m[i] = m[i].copy(error = on); steps = m
        if (on) announceError(i) else if (steps.none { it.error }) errorLive = ""
    }
    private fun announceStep(i: Int) {
        val s = steps[i]
        var m = "${p.stepWord} ${i + 1} ${p.ofWord} ${steps.size}"
        if (s.label.isNotEmpty()) m += ": ${s.label}"
        if (s.optional) m += ", ${p.optionalWord}"
        if (s.completed) m += ", ${p.completedWord}"
        live = m + ", ${p.currentWord}"
    }
    private fun announceError(i: Int) {
        val s = steps[i]
        var m = "${p.stepWord} ${i + 1} ${p.ofWord} ${steps.size}"
        if (s.label.isNotEmpty()) m += ": ${s.label}"
        m += ", ${p.errorWord}"
        if (s.errorText.isNotEmpty()) m += ": ${s.errorText}"
        errorLive = m
    }
    val continueEnabled get() = !p.nextDisabled && !p.loading
    val backEnabled get() = active > 0 && !p.loading
    /** Keyboard order of the step headers (tab stops: reachable, not disabled, not readonly). */
    val tabStops get() = if (p.readonly) emptyList() else steps.indices.filter { !effectivelyDisabled(it) }
}
