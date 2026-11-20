import SwiftUI

/// md-select: an md-text-field trigger (read-only, `appear-focused` while open) and an md-menu listbox of radio option
/// rows, composed from the library's own renderers as the source composes its primitives. The menu presents in the
/// nearest `AWCMenuScope` (anchored below the field); outside a scope it renders in flow.
struct AWCNativeSelect: View {
    let node: AWCNode, local: [String: AWCValue], theme: AWCTheme
    let set: (String, AWCValue) -> Void
    let emit: (String, AWCValue) -> Void
    let child: (AWCNode, @escaping (AWCEvent) -> Void) -> AnyView
    @Environment(\.awcMenuRegistry) private var registry
    @Environment(\.awcSelectAppearance) private var inheritedAppearance
    @Environment(\.awcSelectAppearanceTargets) private var appearanceTargets
    @Environment(\.awcSelectControllers) private var controllers
    @Environment(\.awcTextFieldAppearanceTargets) private var fieldTargets
    @Environment(\.awcNativeSpacingRung) private var inheritedRung
    @Environment(\.accessibilityReduceMotion) private var systemReduced
    @Environment(\.awcFieldReducedMotion) private var reducedOverride
    @State private var rt = AWCSelectRuntime()
    @State private var field = AWCTextFieldController()
    @State private var fieldFrame: CGRect = .zero
    @State private var clearFrame: CGRect = .zero

    private func s(_ k: String, _ d: String = "") -> String { local[k]?.string ?? d }
    private func b(_ k: String, _ d: Bool = false) -> Bool { local[k]?.bool ?? d }
    private var appearance: AWCSelectAppearance { inheritedAppearance.merging(appearanceTargets[node.id] ?? .init()) }
    private var reduced: Bool { reducedOverride ?? systemReduced }
    private var open: Bool { b("open") }
    private var disabled: Bool { b("disabled") }
    private var value: String { s("value") }
    private var options: [AWCSelectOptionData] { rt.loaded ?? AWCSelectOptions.collect(node, options: local["options"]) }
    private var anchorID: String { node.id + "::trigger" }
    private var menuID: String { node.id + "::menu" }
    private var display: String { AWCSelectOptions.label(options, value).nonEmpty ?? AWCSelectOptions.hiddenLabel(node, value: value) }
    private var hasValue: Bool { !value.isEmpty && !display.isEmpty }
    /// Visible `label`, else the host's aria-label (names the field's input and the listbox).
    private var accessibleName: String { s("label").nonEmpty ?? s("aria-label").nonEmpty ?? s("ariaLabel").trimmingCharacters(in: .whitespaces) }
    private var validity: AWCConstraintValidity {
        let custom = rt.customMessage
        if !custom.isEmpty { return .init(flag: "customError", message: custom) }
        if b("required") && value.isEmpty { return .init(flag: "valueMissing", message: s("valueMissingLabel", "Please select an item in the list.")) }
        return .validState
    }
    private var validationMessage: String { rt.revealed && !validity.valid ? validity.validationMessage : "" }
    /// `--md-sys-spacing-inset-lg` of the host's density rung (the field's trailing padding).
    private var insetLG: Double {
        let d = local["density"]?.number ?? 0
        let rung = [-1.0, -2, -3, -4].contains(d) ? d : inheritedRung
        return rung <= -4 ? 8 : rung <= -2 ? 12 : 16
    }
    private var tint: String { theme.tokens["--md-sys-color-on-surface-variant"].flatMap(awcFieldColor) ?? "#49454F" }

    var body: some View {
        if b("hidden") { EmptyView() } else { composed }
    }
    private var composed: some View {
        let a = appearance
        return VStack(alignment: .leading, spacing: 0) {
            trigger
            menu
        }
        .frame(minWidth: a.minWidth.map { CGFloat($0) }, maxWidth: a.width.map { CGFloat($0) } ?? .infinity, alignment: .leading)
        .frame(width: a.width.map { CGFloat(max($0, a.minWidth ?? 0)) })
        .awcInspect(nodeID: node.id, name: "md-select") { _ in
            ["value": .string(value), "open": .bool(open), "displayText": .string(display), "focused": .bool(rt.focused), "valid": .bool(validity.valid), "validationMessage": .string(validationMessage)]
        }
        .onAppear { connect() }
        .onDisappear { registry?.stopObservingClicks(node.id) }
        .onChange(of: open) { _, o in syncMenu(o) }
        .onChange(of: validity, initial: true) { _, next in
            rt.validityNow = next
            let key = next.key; defer { rt.lastValidityKey = key }
            if let last = rt.lastValidityKey, last != key { emit("mdValidityChange", next.eventValue) }
        }
        .background { AWCSelectSpaceKey(active: rt.focused && !open && !disabled) { _ = fieldKey(" ", false) } }
        .onChange(of: fieldFrame) { _, f in observeClicks(f) }
        .onChange(of: clearFrame) { _, _ in observeClicks(fieldFrame) }
        .onChange(of: value, initial: true) { _, v in rt.valueNow = v }
        .onChange(of: disabled, initial: true) { _, d in rt.disabledNow = d }
        .onChange(of: options, initial: true) { _, o in rt.optionsNow = o }
    }

    // MARK: Trigger

    private var trigger: some View {
        var p: [String: AWCValue] = [:]
        p["variant"] = .string(s("variant", "outlined")); p["label"] = .string(s("label"))
        if s("label").isEmpty, !accessibleName.isEmpty { p["aria-label"] = .string(accessibleName) }
        p["placeholder"] = .string(hasValue ? "" : s("placeholder")); p["readOnly"] = true; p["disabled"] = .bool(disabled); p["required"] = .bool(b("required"))
        p["error"] = .bool(b("error") || !validationMessage.isEmpty); p["errorText"] = .string(s("errorText").nonEmpty ?? validationMessage)
        p["reserveSupportingSpace"] = .bool(b("reserveSupportingSpace")); p["supportingText"] = .string(s("supportingText"))
        if let d = local["density"]?.number { p["density"] = .number(d) }
        p["appearFocused"] = .bool(open)
        let inner = AWCNode(id: node.id, tag: "md-text-field", properties: p)
        var hooks = AWCFieldHooks()
        hooks.controller = field
        hooks.key = { key, composing in fieldKey(key, composing) }
        hooks.focus = { f in rt.focused = f }
        hooks.trailing = AnyView(trailing)
        hooks.readOnlyKeys = true
        // :host sets --md-text-field-padding-inline-end: inset-lg; a hook targeted at this select still wins.
        let padding = fieldTargets[node.id]?.paddingInlineEnd == nil ? AWCTextFieldAppearance(paddingInlineEnd: insetLG) : AWCTextFieldAppearance()
        return AWCNativeTextField(node: inner, theme: theme, value: display, setValue: { _ in }, emit: { _, _ in },
                                  leading: [], trailing: [], chips: [], clearIcon: [], passwordIcon: [], speechIcon: [], errorIcon: [],
                                  child: { child($0, { _ in }) }, hooks: hooks)
            .awcTextFieldAppearance(padding)
            .awcMenuAnchor(anchorID, label: nil, focus: { field.setFocus() })
            .modifier(AWCSelectScopeFrame(registry: registry) { fieldFrame = $0 })
            .overlay { AWCSelectClickCatcher(exclude: showClear && fieldFrame.width > 0 ? [clearFrame.offsetBy(dx: -fieldFrame.minX, dy: -fieldFrame.minY)] : [],
                                             press: { pressFocus() }, click: { toggleOpen() }, release: { releaseFocus() }) }
            .awcInspect(nodeID: node.id, part: "field", name: "field")
    }
    private var showClear: Bool { b("clearable") && hasValue && !disabled }
    private var trailing: some View {
        let a = appearance
        return Group {
            if b("loading") {
                loader.frame(width: 24, height: 24).awcInspect(nodeID: node.id, part: "loading-spinner", name: "loading-spinner")
            } else {
                HStack(spacing: a.trailingGap ?? 2) {
                    if showClear { clearButton }
                    AWCSelectCaret(nodeID: node.id, since: rt.openWriteAt, open: open, reduced: reduced, size: a.caretSize ?? 24, color: a.caretColor ?? tint, glyph: s("dropdownIcon", "arrow_drop_down"),
                                   slot: node.children(inSlot: "dropdown-icon"), child: { child($0, { _ in }) })
                        .awcInspect(nodeID: node.id, part: "caret", name: "caret")
                }
            }
        }
        .accessibilityHidden(true)
        .awcInspect(nodeID: node.id, part: "trailing", name: "trailing")
    }
    private var loader: some View {
        let size = appearance.spinnerSize ?? 22
        return Group {
            if let slot = node.children(inSlot: "loader").first { child(slot, { _ in }) }
            else { child(AWCNode(id: node.id + "::loader", tag: "md-loading-indicator", properties: ["label": .string(s("loadingText", "Loading…"))]), { _ in }) }
        }
        .awcLoadingIndicatorAppearance(.init(size: size, shapeSize: size))
    }
    private var clearButton: some View {
        let color = appearance.clearColor ?? appearance.caretColor ?? tint
        let n = AWCNode(id: node.id + "::clear", tag: "md-icon-button", properties: ["size": "xs", "icon": .string(s("clearIcon", "close")), "aria-label": .string(s("clearLabel", "Clear selection")),
                                                                                     "shapeMorph": false, "groupTabindex": -1, "toggle": false])
        return child(n, { e in if e.name == "mdClick" { clearValue() } })
            .awcIconButtonAppearance(.init(iconColor: color, stateLayerColor: color, iconSize: 18, width: 24, height: 24))
            .frame(width: 24, height: 24)
            .modifier(AWCSelectScopeFrame(registry: registry) { clearFrame = $0 })
            .awcInspect(nodeID: node.id, part: "clear", name: "clear")
    }

    // MARK: Menu

    private var emptyText: String {
        if b("loading") { return "" }
        if options.isEmpty { return s("noOptionsText", "No options") }
        if !query.isEmpty && listOptions.isEmpty { return s("noResultsText", "No results") }
        return ""
    }
    private var query: String { b("filterable") ? rt.query.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() : "" }
    private var listOptions: [AWCSelectOptionData] {
        let q = query
        return q.isEmpty ? options : options.filter { $0.label.lowercased().contains(q) || $0.supportingText.lowercased().contains(q) }
    }
    private var rows: [AWCNode] {
        guard !b("loading") else { return [] }
        let iconColor = appearance.optionIconColor ?? tint
        return listOptions.enumerated().map { i, o in
            var p: [String: AWCValue] = ["presentation": "option", "type": "radio", "checkPosition": "start", "keepOpen": true, "disabled": .bool(o.disabled),
                                         "selected": .bool(o.value == value), "headline": .string(o.label), "supportingText": .string(o.supportingText)]
            p["optionValue"] = .string(o.value)
            let icon = o.icon.isEmpty ? [] : [AWCNode(id: "\(node.id)::opt\(i)::icon", tag: "#symbol", properties: ["name": .string(o.icon), "color": .string(awcFieldColor(o.iconColor) ?? iconColor)], slot: "leading-icon")]
            return AWCNode(id: "\(node.id)::opt\(i)", tag: "md-menu-item", properties: p, children: icon)
        }
    }
    private var menu: some View {
        var p: [String: AWCValue] = ["anchor": .string(anchorID), "placement": .string(s("placement", "bottom-start")),
                                     "matchAnchorWidth": .bool(b("matchTriggerWidth", true) || b("fullWidth")), "emptyText": .string(emptyText),
                                     "listbox": true, "listLabel": .string(accessibleName.nonEmpty ?? "Options")]
        if let mh = local["maxHeight"], mh != .null { p["maxHeight"] = mh }
        if let d = local["density"]?.number { p["density"] = .number(d) }
        // The controller drives open / close (with the exit); the node mirrors its state so another model change while open
        // (emptyText, headerRows, …) is not read as a host close (AWCNativeMenu.sync: `open` absent = false). Outside a scope the
        // menu renders in flow and follows the host's `open`.
        p["open"] = .bool(registry.map { $0.controllers[menuID]?.isOpen ?? false } ?? open)
        let menuNode = AWCNode(id: menuID, tag: "md-menu", properties: p, children: rows)
        let byID = Dictionary(listOptions.enumerated().map { ("\(node.id)::opt\($0.offset)", $0.element.value) }, uniquingKeysWith: { a, _ in a })
        return AWCNativeView(node: menuNode) { e in
            switch e.name {
            case "mdOpen": menuOpened()
            case "mdClose": menuClosed()
            case "mdClick": if let v = byID[e.nodeID] { selectValue(v) }
            default: break
            }
        }
        .awcMenuHeader(for: menuID) { header }
    }
    @ViewBuilder private var header: some View {
        if b("loading") {
            child(AWCNode(id: node.id + "::progress", tag: "md-progress-indicator", properties: ["variant": "linear", "indeterminate": true, "wave": true, "label": .string(s("loadingText", "Loading…"))]), { _ in })
                .frame(maxWidth: .infinity)
                .awcInspect(nodeID: node.id, part: "loading-progress", name: "loading-progress")
                .padding(.vertical, insetLG).padding(.horizontal, insetLG)
                .awcInspect(nodeID: node.id, part: "loading-bar", name: "loading-bar")
        } else if b("filterable") {
            AWCSelectSearchField(text: Binding(get: { rt.query }, set: { rt.query = $0; rt.queryText = nil }), placeholder: s("searchPlaceholder", "Search…"),
                                 label: s("filterLabel").nonEmpty ?? (s("label").isEmpty ? "Filter options" : "Filter \(s("label"))"), theme: theme,
                                 pending: rt.queryText, consumed: { rt.queryText = nil })
                .awcInspect(nodeID: node.id, part: "search", name: "search")
                .awcInspect(nodeID: node.id, part: "search-wrap", name: "search-wrap")
        }
    }

    // MARK: Behaviour

    private func connect() {
        let r = rt
        rt.show = { if !r.disabledNow { set("open", true) } }
        rt.close = { set("open", false) }
        rt.focusTrigger = { [field] in _ = field.setFocus() }
        rt.reset = { guard !r.valueNow.isEmpty else { return }; set("value", ""); emit("mdChange", .string("")) }
        rt.validity = { r.validityNow }
        rt.reportValidity = { [field] in if r.validityNow.valid { return true }; r.revealed = true; _ = field.setFocus(); return false }
        rt.labels = { values in Dictionary(values.compactMap { v in r.optionsNow.first { $0.value == v }.map { (v, $0.label) } }, uniquingKeysWith: { a, _ in a }) }
        (controllers[node.id] ?? controllers[""])?.runtime = rt
        if open { syncMenu(true) }
        observeClicks(fieldFrame)
    }
    private func observeClicks(_ frame: CGRect) {
        // The field's click catcher handles the field (an AppKit text view tracks a press in a nested loop that local event
        // monitors never see; a UITextField's recognizers end the touch first); the scope's click observers are not used.
        #if canImport(AppKit) || canImport(UIKit)
        return
        #endif
        guard let registry, frame.width > 0 else { return }
        registry.observeClicks(node.id, frame: frame, exclude: showClear ? [clearFrame] : []) { toggleOpen() }
    }
    /// iOS: the press shows the focus at once (Chrome pointerdown) and moves the UIKit responder after the release (6-6 021:
    /// becomeFirstResponder 13-89 ms on the press held back the release 33 ms later and the open with it).
    private func pressFocus() {
        #if os(iOS)
        field.markFocused()
        #else
        _ = field.setFocus()
        #endif
    }
    /// iOS: the UIKit responder follows after the md-menu open motion (6-6 031/032, KNOWN-CAUSES row 28: a cold
    /// becomeFirstResponder inside the 150 ms open left the surface without frames). Reduce Motion: next main turn.
    /// Skipped when the first responder changed meanwhile (another field, or the close already focused the field).
    private func releaseFocus() {
        #if os(iOS)
        let before = AWCFirstResponderProbe.current()
        let move = { [field] in if AWCFirstResponderProbe.current() === before { _ = field.setFocus() } }
        if reduced { DispatchQueue.main.async(execute: move) } else { DispatchQueue.main.asyncAfter(deadline: .now() + 0.2, execute: move) }
        #endif
    }
    private func toggleOpen() { guard !disabled else { return }; let next = !open; set("open", .bool(next)); syncMenu(next) }
    /// `@Watch('open')`: the host's open state drives the menu (its own exit runs on close). Input handlers call it at once, as the
    /// Web watcher runs with the property write; `.onChange(of: open)` covers every other change and is a no-op after that.
    private func syncMenu(_ o: Bool, attempt: Int = 0) {
        if attempt == 0 && rt.openSynced != o { rt.openSynced = o; rt.openWriteAt = CACurrentMediaTime() * 1000 }
        guard let registry else { return }
        guard let c = registry.controllers[menuID] else {
            if attempt < 20 { DispatchQueue.main.async { syncMenu(o, attempt: attempt + 1) } }
            return
        }
        #if os(iOS)
        if o { c.logicalRowFocus = true }
        #endif
        if o { if !c.isOpen || c.closing { c.show(autoFocus: true, keyboard: rt.openedByKey) } }
        else if c.isOpen && !c.closing { c.close() }
        rt.openedByKey = false
    }
    private func menuOpened() {
        // The menu's event handler can hold a copy of this view from before its last update: set without reading `open`.
        set("open", true)
        if rt.lastEmit != "open" { rt.lastEmit = "open"; emit("mdOpen", .null) }
    }
    private func menuClosed() {
        set("open", false)
        if !rt.query.isEmpty { rt.query = "" }
        if rt.lastEmit != "close" { rt.lastEmit = "close"; emit("mdClose", .null) }
    }
    private func selectValue(_ v: String) {
        if rt.valueNow == v { set("open", false); syncMenu(false); return }
        rt.valueNow = v
        set("value", .string(v)); emit("mdChange", .string(v))
        set("open", false); syncMenu(false); _ = field.setFocus()
    }
    private func clearValue() {
        guard !disabled, !value.isEmpty else { return }
        set("value", ""); emit("mdChange", .string("")); _ = field.setFocus()
    }
    /// md-select `handleKeyDown` for keys in the trigger (keys inside the menu belong to the menu).
    private func fieldKey(_ key: String, _ composing: Bool) -> Bool {
        guard !disabled, !composing else { return false }
        if !open && ["ArrowDown", "Enter", " "].contains(key) { rt.openedByKey = true; set("open", true); syncMenu(true); return true }
        #if os(iOS)
        // iOS: the field keeps the first responder while the menu is open; the focused option row is logical (MenuController.logicalRowFocus).
        if open, let c = registry?.controllers[menuID], c.logicalRowFocus, c.comboboxID == nil, c.isOpen, !c.closing, let id = c.focusedID {
            if key == "Enter" || key == " " { c.rows[id]?.keyActivate(key == " " ? "Space" : "Enter"); return true }
            return c.key(key, from: id, shift: false, modified: false)
        }
        #endif
        if open && key == "Escape" { set("open", false); syncMenu(false); _ = field.setFocus(); return true }
        return false
    }
}

/// The dropdown caret: rotates 180° while open (200 ms standard easing; none under Reduce Motion).
struct AWCSelectCaret: View {
    let nodeID: String
    /// Time (CACurrentMediaTime ms) of the `open` write that this change follows; 0 = unknown (start at the change).
    var since: Double = 0
    let open: Bool, reduced: Bool, size: Double, color: String, glyph: String
    let slot: [AWCNode]
    let child: (AWCNode) -> AnyView
    @State private var track = AWCCSSTransitionTrack()
    @State private var primed = false
    var body: some View {
        let now = CACurrentMediaTime() * 1000
        TimelineView(.animation(paused: !track.isRunning(now))) { _ in
            let p = track.presented(CACurrentMediaTime() * 1000)
            Group {
                if let n = slot.first { if n.tag == "#symbol" { AWCFieldGlyph(name: n.properties["name"]?.string ?? "", size: size, fill: 0) } else { child(n) } }
                else { AWCFieldGlyph(name: glyph, size: size, fill: 0) }
            }
            .frame(width: size, height: size)
            .foregroundStyle(Color(awcHex: color))
            .rotationEffect(.degrees(180 * p))
            .awcInspect(nodeID: nodeID, part: "caret-glyph", name: "caret-glyph") { _ in ["rotation": .number(p)] }
        }
        .onChange(of: open, initial: true) { _, o in
            let target: Double = o ? 1 : 0
            guard primed, !reduced else { track.snap(target); primed = true; return }
            let now = CACurrentMediaTime() * 1000, start = since > 0 && since <= now && now - since < 200 ? since : now
            track.set(target, now: start, duration: 200, curve: [0.2, 0, 0, 1])
        }
    }
}

/// `.md-select__search`: the filter input pinned in the menu header (padding 12 44 12 16, surface-container fill,
/// outline-variant bottom border).
struct AWCSelectSearchField: View {
    @Binding var text: String
    let placeholder: String, label: String, theme: AWCTheme
    var pending: String?
    var consumed: () -> Void = {}
    var body: some View {
        let t = theme.tokens
        ZStack(alignment: .leading) {
            if text.isEmpty { Text(placeholder).font(AWCNativeFonts.label(size: 16, regular: true)).foregroundStyle(Color(awcHex: t["--md-sys-color-on-surface-variant"] ?? "#49454F")).lineLimit(1).allowsHitTesting(false).accessibilityHidden(true) }
            TextField("", text: $text).textFieldStyle(.plain).font(AWCNativeFonts.label(size: 16, regular: true))
                .foregroundStyle(Color(awcHex: t["--md-sys-color-on-surface"] ?? "#1D1B20")).accessibilityLabel(label)
        }
        // The input's content box: `line-height: normal` of 16 px Roboto, rounded as Chrome's inner editor (19); the 1 px
        // outline-variant bottom border adds to the box (12 + 19 + 12 + 1 = 44).
        .frame(height: ((AWCFieldMetrics.ascent + AWCFieldMetrics.descent) * 16).rounded())
        .padding(.top, 12).padding(.bottom, 13).padding(.leading, 16).padding(.trailing, 44)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(awcHex: t["--md-sys-color-surface-container"] ?? "#F3EDF7"))
        .overlay(alignment: .bottom) { Rectangle().fill(Color(awcHex: t["--md-sys-color-outline-variant"] ?? "#CAC4D0")).frame(height: 1) }
        .onChange(of: pending, initial: true) { _, q in if let q { text = q; consumed() } }
    }
}

/// Space in the focused read-only trigger: md-select's host keydown listener opens the listbox (the read-only input's text
/// system never reports the key to the field's hooks on macOS).
#if canImport(AppKit)
struct AWCSelectSpaceKey: NSViewRepresentable {
    let active: Bool, handler: () -> Void
    final class Monitor: NSView {
        var active = false, handler: () -> Void = {}
        private var token: Any?
        override func hitTest(_ point: NSPoint) -> NSView? { nil }
        override func viewDidMoveToWindow() {
            super.viewDidMoveToWindow(); if let token { NSEvent.removeMonitor(token); self.token = nil }
            guard window != nil else { return }
            token = NSEvent.addLocalMonitorForEvents(matching: .keyDown) { [weak self] e in
                guard let self, self.active, e.window === self.window, e.charactersIgnoringModifiers == " ",
                      e.modifierFlags.intersection([.command, .control, .option]).isEmpty else { return e }
                self.handler(); return nil
            }
        }
        deinit { if let token { NSEvent.removeMonitor(token) } }
    }
    func makeNSView(context: Context) -> Monitor { Monitor() }
    func updateNSView(_ v: Monitor, context: Context) { v.active = active; v.handler = handler }
}
#else
struct AWCSelectSpaceKey: View { let active: Bool, handler: () -> Void; var body: some View { Color.clear.allowsHitTesting(false) } }
#endif

/// Reports a view's frame in the menu scope's coordinate space.
struct AWCSelectScopeFrame: ViewModifier {
    let registry: AWCMenuRegistry?, action: (CGRect) -> Void
    func body(content: Content) -> some View {
        if let registry { content.onGeometryChange(for: CGRect.self) { $0.frame(in: .named(registry.space)) } action: { action($0) } } else { content }
    }
}

extension String { var nonEmpty: String? { isEmpty ? nil : self } }

/// The source's onClick on its field (macOS): a transparent layer over the trigger takes the press (the input gains focus,
/// as Chrome focuses it on mousedown), tracks it to the release and toggles the menu on a release inside — except over the
/// `exclude` rects (the clear button), which fall through. A read-only NSTextField would otherwise track the press in a
/// nested event loop that no local event monitor sees.
#if canImport(AppKit)
struct AWCSelectClickCatcher: NSViewRepresentable {
    let exclude: [CGRect], press: () -> Void, click: () -> Void
    var release: () -> Void = {}
    final class Catcher: NSView {
        var exclude: [CGRect] = [], press: () -> Void = {}, click: () -> Void = {}
        override var isFlipped: Bool { true }
        override func hitTest(_ point: NSPoint) -> NSView? {
            let local = convert(point, from: superview)
            guard bounds.contains(local), !exclude.contains(where: { $0.contains(local) }) else { return nil }
            return self
        }
        override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true }
        override func mouseDown(with event: NSEvent) {
            press()
            guard let w = window else { return }
            while let e = w.nextEvent(matching: [.leftMouseUp, .leftMouseDragged]) {
                if e.type == .leftMouseUp { if bounds.contains(convert(e.locationInWindow, from: nil)) { click() }; break }
            }
        }
    }
    func makeNSView(context: Context) -> Catcher { Catcher() }
    func updateNSView(_ v: Catcher, context: Context) { v.exclude = exclude; v.press = press; v.click = click }
}
#elseif canImport(UIKit)
/// UIKit: the field's UITextField owns its touches (its gesture recognizers end the touch before the scope sees a click), so
/// the composite takes the touches over the field itself: the press focuses the field, a release inside toggles the menu.
struct AWCSelectClickCatcher: UIViewRepresentable {
    let exclude: [CGRect], press: () -> Void, click: () -> Void
    var release: () -> Void = {}
    final class Catcher: UIView {
        var exclude: [CGRect] = [], press: () -> Void = {}, click: () -> Void = {}, release: () -> Void = {}
        override func point(inside point: CGPoint, with event: UIEvent?) -> Bool {
            bounds.contains(point) && !exclude.contains(where: { $0.contains(point) })
        }
        override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent?) { press() }
        override func touchesEnded(_ touches: Set<UITouch>, with event: UIEvent?) {
            if let t = touches.first, bounds.contains(t.location(in: self)) { click() }
            release()
        }
        override func touchesCancelled(_ touches: Set<UITouch>, with event: UIEvent?) { release() }
    }
    func makeUIView(context: Context) -> Catcher { let v = Catcher(); v.backgroundColor = .clear; v.isMultipleTouchEnabled = false; return v }
    func updateUIView(_ v: Catcher, context: Context) { v.exclude = exclude; v.press = press; v.click = click; v.release = release }
}
#else
struct AWCSelectClickCatcher: View {
    let exclude: [CGRect], press: () -> Void, click: () -> Void
    var release: () -> Void = {}
    var body: some View { Color.clear.allowsHitTesting(false) }
}
#endif

extension AWCNativeView {
    var nativeSelect: some View {
        AWCNativeSelect(node: node, local: local, theme: theme, set: { set($0, $1) }, emit: { emit($0, $1) }, child: { n, h in child(n, handler: h) })
    }
}
