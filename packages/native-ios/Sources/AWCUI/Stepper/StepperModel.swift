import Foundation

/// md-step's host properties (one render's worth).
public struct AWCStepProps: Equatable, Sendable {
    public var label = "", description = "", errorText = "", icon = "", completedIcon = "check", errorIcon = "priority_high"
    public var accessibleName: String? = nil
    /// A standalone md-step's own `active` (inside a stepper the stepper's index decides).
    public var active: Bool? = nil
    /// The step's own inline `style` (its `--md-step-*` hooks win over the stepper's).
    public var style = ""
    public var completed = false, error = false, disabled = false, optional = false, editable = false, hideActions = false
    public var density = 0.0
    /// Whether the step has light-DOM content of its own (drives the panels).
    public var hasContent = false
    public init() {}
}

/// md-stepper's host properties.
public struct AWCStepperProps: Equatable, Sendable {
    public var orientation = "horizontal", indicator = "numbered", variant = "default", mode = "linear"
    public var active = 0.0
    public var autoComplete = true, nav = true, readonly = false, nextDisabled = false, loading = false, lazy = false
    public var label = "Progress", stepWord = "Step", ofWord = "of", completedWord = "completed", currentWord = "current", errorWord = "error"
    public var optionalWord = "Optional", nextLabel = "Continue", backLabel = "Back", finishLabel = "Finish"
    public var density = 0.0
    public init() {}
}

/// md-stepper + md-step behaviour (md-stepper.tsx / md-step.tsx): the active index and its watcher (clamp,
/// auto-complete, mdStepChange, the polite announcement), linear reachability (fix J), navigation (next / prev / goTo /
/// reset, header activation, the built-in nav), the cancelable mdBeforeChange and the error announcement driven by app
/// writes to `error` (fix K). Host properties arrive through `sync(_:steps:)` with Stencil's watcher semantics: a
/// watcher runs only when its property changed since the last sync, so the component's own writes (active, completed,
/// error) persist until the host changes that property.
public final class AWCStepperModel {
    public private(set) var p = AWCStepperProps()
    public private(set) var steps: [AWCStepProps] = []
    public private(set) var active = 0
    private var lastActive = 0
    /// The polite (role=status) and assertive (role=alert) live-region texts.
    public private(set) var live = "", errorLive = ""
    /// The header with keyboard focus (:focus-visible), the focused element.
    public var focusVisible: Int? = nil
    public enum Focus: Equatable { case header(Int), nav(Int), action(Int, Int) }
    public var focus: Focus? = nil
    /// A standalone md-step (no stepper): its composed name counts `data-total`, which is then absent (0).
    public var labelTotal: Int? = nil
    /// (name, detail, cancelable) → false when prevented.
    public var emit: (String, [String: Any]?, Bool) -> Bool = { _, _, _ in true }
    /// The component's own writes into its props (active) and into its steps (completed / error), for the host.
    public var onWrite: (String, Int?, Any) -> Void = { _, _, _ in }
    private var synced: (AWCStepperProps, [AWCStepProps])? = nil

    public init() {}

    // MARK: host sync (Stencil watcher semantics)

    public func sync(_ props: AWCStepperProps, steps hostSteps: [AWCStepProps]) {
        let prev = synced
        synced = (props, hostSteps)
        p = props
        guard let prev else {
            steps = hostSteps
            active = clamp(Int(props.active)); lastActive = active      // componentWillLoad: clamp without a change event
            if Double(active) != props.active { onWrite("active", nil, active) }
            return
        }
        // Steps added / removed: adopt the new list (slotchange), keeping the component's writes for kept indices.
        var next = hostSteps
        var errorEntered: Int? = nil, errorLeft = false
        for i in next.indices {
            if i < prev.1.count, i < steps.count {
                let old = prev.1[i], mine = steps[i]
                // A step property keeps the component's value unless the host changed it (the observer's app write).
                if next[i].completed == old.completed { next[i].completed = mine.completed }
                if next[i].error == old.error { next[i].error = mine.error }
                else if next[i].error { errorEntered = i } else { errorLeft = true }
            } else if next[i].error { errorEntered = i }
        }
        steps = next
        if errorEntered != nil || errorLeft {
            if let i = errorEntered { announceError(i) }
            else if !steps.contains(where: { $0.error }) { errorLive = "" }
        }
        if props.active != prev.0.active { setActive(Int(props.active.isFinite ? props.active : 0)) }
        else if clamp(active) != active { setActive(clamp(active)) }
    }

    // MARK: derived state (md-step)

    public var count: Int { steps.count }
    public func clamp(_ i: Int) -> Int { steps.isEmpty ? 0 : Swift.max(0, Swift.min(steps.count - 1, i)) }
    /// A standalone md-step (no stepper): its own `active` property, index 0, a total of 0.
    public var standalone = false
    public func isActive(_ i: Int) -> Bool { standalone ? (i < steps.count && steps[i].active == true) : i == active }
    public var panelMode: String { p.orientation == "horizontal" && steps.contains { $0.hasContent } ? "step" : "shared" }
    public func reachable(_ i: Int) -> Bool {
        if p.readonly || p.mode != "linear" { return true }
        return i <= active || steps[i].completed || steps[..<i].allSatisfy { $0.completed || $0.optional || $0.disabled }
    }
    public func effectivelyDisabled(_ i: Int) -> Bool { steps[i].disabled || !reachable(i) }
    public func navActions(_ i: Int) -> Bool { p.nav && !steps[i].hideActions }
    public func hasPanel(_ i: Int) -> Bool {
        p.orientation == "vertical" ? (steps[i].hasContent || navActions(i)) : (panelMode == "step" && steps[i].hasContent)
    }
    public func renderPanel(_ i: Int) -> Bool { hasPanel(i) && (!p.lazy || isActive(i)) }
    /// data-position: index 0 is "first" even when it is also the last step.
    public func isLast(_ i: Int) -> Bool { i != 0 && i == steps.count - 1 }
    public func glyph(_ i: Int) -> String? {
        let s = steps[i]
        if p.indicator == "dot" { return nil }
        if s.error { return s.errorIcon }
        if !s.icon.isEmpty { return s.icon }
        if s.completed { return s.editable ? "edit" : s.completedIcon }
        return nil
    }
    public func a11yLabel(_ i: Int) -> String {
        let s = steps[i]
        if let n = s.accessibleName, !n.trimmingCharacters(in: .whitespaces).isEmpty { return n }
        var t = "\(p.stepWord) \(i + 1) \(p.ofWord) \(labelTotal ?? steps.count)"
        if !s.label.isEmpty { t += ": \(s.label)" }
        if s.optional { t += ", \(p.optionalWord)" }
        if s.completed { t += ", \(p.completedWord)" }
        if isActive(i) { t += ", \(p.currentWord)" }
        if s.error { t += ", \(p.errorWord)" + (s.errorText.isEmpty ? "" : ": \(s.errorText)") }
        return t
    }
    /// The visible caption lines (optional caption, supporting / error text) — a readonly header's text.
    public func textLines(_ i: Int) -> [String] {
        let s = steps[i]
        return [s.optional ? p.optionalWord : "", s.error && !s.errorText.isEmpty ? s.errorText : s.description]
    }
    /// The panel's region name: the label, else the composed name.
    public func regionLabel(_ i: Int) -> String { steps[i].label.isEmpty ? a11yLabel(i) : steps[i].label }
    public var isFinishStep: Bool { active >= steps.count - 1 }

    // MARK: md-stepper behaviour

    /// @Watch('active'): clamp, auto-complete (forward completes the passed non-disabled steps and clears their error;
    /// backward un-completes the target and later steps unless the target is editable and completed), mdStepChange, announce.
    func setActive(_ v: Int) {
        let clamped = clamp(v), previous = lastActive
        if clamped != v || Double(clamped) != p.active { onWrite("active", nil, clamped) }
        active = clamped
        guard clamped != previous else { return }
        lastActive = clamped
        if p.autoComplete {
            if clamped > previous {
                for i in steps.indices where i >= previous && i < clamped && !steps[i].disabled { write(i, completed: true, error: false) }
            } else if !(steps[clamped].editable && steps[clamped].completed) {
                for i in steps.indices where i >= clamped { write(i, completed: false, error: nil) }
            }
        }
        _ = emit("mdStepChange", ["index": clamped, "previous": previous], false)
        announceStep(clamped)
    }
    private func write(_ i: Int, completed: Bool?, error: Bool?) {
        if let c = completed, steps[i].completed != c { steps[i].completed = c; onWrite("completed", i, c) }
        if let e = error, steps[i].error != e { steps[i].error = e; onWrite("error", i, e) }
    }
    @discardableResult func commit(_ target: Int) -> Bool {
        guard target != active else { return false }
        guard emit("mdBeforeChange", ["index": target, "previous": active], true) else { return false }
        setActive(target); return true
    }
    public func canNavigate(_ target: Int) -> Bool {
        guard target >= 0, target < steps.count, !steps[target].disabled else { return false }
        if p.mode != "linear" || target <= active || steps[target].completed { return true }
        return steps[..<target].allSatisfy { $0.completed || $0.optional || $0.disabled }
    }
    public func next() {
        guard !steps.isEmpty else { return }
        var t = active + 1
        while t < steps.count && steps[t].disabled { t += 1 }
        if t >= steps.count {
            if p.autoComplete && !steps[active].disabled { write(active, completed: true, error: false) }
            _ = emit("mdComplete", nil, false); return
        }
        commit(t)
    }
    public func prev() {
        var t = active - 1
        while t >= 0 && steps[t].disabled { t -= 1 }
        guard t >= 0 else { return }
        commit(t)
    }
    public func goTo(_ i: Int) { let c = clamp(i); if canNavigate(c) { commit(c) } }
    public func reset() {
        for i in steps.indices { write(i, completed: false, error: false) }
        setActive(0)
    }
    /// md-step click / Enter / Space: mdStepClick when the header is a live control, then the stepper's onStepClick.
    @discardableResult public func activateHeader(_ i: Int) -> Bool {
        guard i >= 0, i < steps.count, !p.readonly, !effectivelyDisabled(i) else { return false }
        _ = emit("mdStepClick", ["index": i], false)
        if i != active && canNavigate(i) { commit(i) }
        return true
    }
    /// A vertical step's Continue / Back (mdStepNext / mdStepBack), then focus moves to the new active header.
    public func stepNext(_ i: Int) {
        let before = active
        _ = emit("mdStepNext", ["index": i], false); next()
        if active != before { focus = .header(active); focusVisible = nil }
    }
    public func stepBack(_ i: Int) {
        let before = active
        _ = emit("mdStepBack", ["index": i], false); prev()
        if active != before { focus = .header(active); focusVisible = nil }
    }
    /// The footer / mobile Back: prev(); on the first step (Back disables itself) focus moves to the active header.
    public func footerBack() {
        prev()
        if active == 0 { focus = .header(active); focusVisible = nil }
    }
    /// An app write to a step's `error` (the MutationObserver path), outside a host sync.
    public func setStepError(_ i: Int, _ on: Bool, text: String? = nil) {
        if let text { steps[i].errorText = text }
        guard steps[i].error != on else { return }
        steps[i].error = on
        if on { announceError(i) } else if !steps.contains(where: { $0.error }) { errorLive = "" }
    }
    func announceStep(_ i: Int) {
        let s = steps[i]
        var m = "\(p.stepWord) \(i + 1) \(p.ofWord) \(steps.count)"
        if !s.label.isEmpty { m += ": \(s.label)" }
        if s.optional { m += ", \(p.optionalWord)" }
        if s.completed { m += ", \(p.completedWord)" }
        live = m + ", \(p.currentWord)"
    }
    func announceError(_ i: Int) {
        let s = steps[i]
        var m = "\(p.stepWord) \(i + 1) \(p.ofWord) \(steps.count)"
        if !s.label.isEmpty { m += ": \(s.label)" }
        m += ", \(p.errorWord)"
        if !s.errorText.isEmpty { m += ": \(s.errorText)" }
        errorLive = m
    }
    /// The built-in Continue / Finish is inert while loading or next-disabled; Back while loading or on the first step.
    public var continueEnabled: Bool { !p.nextDisabled && !p.loading }
    public var backEnabled: Bool { active > 0 && !p.loading }
    /// Keyboard order of the step headers (tab stops: reachable, not disabled, not readonly).
    public var tabStops: [Int] { p.readonly ? [] : steps.indices.filter { !effectivelyDisabled($0) } }
}
