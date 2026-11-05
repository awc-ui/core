import SwiftUI

/// Native SwiftUI renderer for the portable AWC component tree.
/// Property changes supplied by the host replace local interaction state.
public struct AWCNativeView: View {
    public let node: AWCNode
    public var onEvent: (AWCEvent) -> Void
    @State var local: [String: AWCValue]
    @State var selectedIDs: Set<String> = []
    @State var buttonFocusGroup = AWCButtonFocusGroup()
    @State var iconFocusHandle = AWCButtonFocusHandle()
    @State var initialSegmentedLabel = false
    @Environment(\.awcButtonFocusGroup) var inheritedButtonFocusGroup
    @Environment(\.awcGridCellContext) var gridCellContext
    @Environment(\.awcNativeFocusChanged) var nativeFocusChanged
    @Environment(\.layoutDirection) var layoutDirection
    @Environment(\.awcPreviewEnabled) var previewEnabled
    @State var query = ""
    @State var auxiliaryQuery = ""
    @State var passwordVisible = false
    @State private var ownedInteractionStore = AWCInteractionStore()
    @Environment(\.awcInteractionStore) private var inheritedInteractionStore
    var interactionStore: AWCInteractionStore { inheritedInteractionStore ?? ownedInteractionStore }
    @Environment(\.awcButtonAppearance) var buttonAppearance
    @Environment(\.awcIconButtonAppearance) var iconButtonAppearance
    @Environment(\.awcIconButtonScheme) var iconButtonScheme
    @Environment(\.awcSplitButtonAppearance) var splitButtonAppearance
    @Environment(\.awcPopupRegistry) var popupRegistry
    @Environment(\.awcFabAppearance) var fabAppearance
    @Environment(\.awcFabController) var fabController
    @State var ownedFabController=AWCFabController()
    @Environment(\.awcFabMenuRegistry) var fabMenuRegistry
    @Environment(\.awcFabMenuSession) var fabMenuSession
    @Environment(\.awcFabMenuItemAppearance) var fabMenuItemAppearance
    @Environment(\.awcFabMenuItemOverrides) var fabMenuItemOverrides
    @Environment(\.awcNativeGroupGeometry) var nativeGroupGeometry
    @Environment(\.awcNativeGroupContext) var nativeGroupContext
    @Environment(\.awcThemeTokens) var inheritedThemeTokens
    @Environment(\.awcNativeDensity) var inheritedDensity
    @Environment(\.awcNativeDenseInset) var inheritedDenseInset
    @Environment(\.awcNativeCompactSmallGap) var inheritedCompactSmallGap
    @Environment(\.awcNativeSpacingRung) var inheritedSpacingRung
    @Environment(\.awcNativeSegmentedContext) var segmentedContext
    @Environment(\.awcSegmentedButtonAppearance) var segmentedAppearance
    @Environment(\.awcSegmentedButtonOverrides) var segmentedOverrides
    @Environment(\.awcTheme) var customTheme
    @Environment(\.openURL) var openURL
    @Environment(\.colorScheme) var colorScheme
    @Environment(\.awcFormState) var formState
    @Environment(\.awcFormRegistry) var formRegistry
    @Environment(\.awcFormOwnerID) var formOwnerID
    @Environment(\.awcEventDispatcher) var eventDispatcher
    @Environment(\.awcEventTargetListeners) var eventTargetListeners
    @Environment(\.awcURLRouter) var urlRouter
    @State var registeredForm: AWCFormState?
    @State var initialFormProperties: [String: AWCValue]?
    @State var formRegistrationID = UUID().uuidString
    @State var fieldValidityBox = AWCFieldValidityBox()

    public init(node: AWCNode, onEvent: @escaping (AWCEvent) -> Void = { _ in }) {
        self.node = node; self.onEvent = onEvent
        _local = State(initialValue: (AWCComponentCatalog.defaults[node.tag] ?? [:]).merging(node.properties) { _, new in new })
        _initialSegmentedLabel = State(initialValue: !node.authoredTextContent.trimmingCharacters(in:.whitespacesAndNewlines).isEmpty)
    }
    public init(tag: String, properties: [String: AWCValue] = [:], children: [AWCNode] = [], onEvent: @escaping (AWCEvent) -> Void = { _ in }) {
        self.init(node: AWCNode(id: tag, tag: tag, properties: properties, children: children), onEvent: onEvent)
    }
    public var body: some View {
        rendered
            .foregroundStyle(theme.onSurface)
            .tint(theme.primary)
            .disabled(disabled && node.tag != "md-tooltip" && node.tag != "md-chip" && node.tag != "md-switch" && node.tag != "md-checkbox" && node.tag != "md-radio" && node.tag != "md-list-item" && node.tag != "md-menu-item" && node.tag != "md-sub-menu-item" && !(nativeGroupContext?.selection(node.id) != nil && !b("disabled")) && !(node.tag=="md-split-button" || node.tag=="md-segmented-button" || node.tag=="md-fab-menu-item" || (fabMenuRegistry != nil && node.tag=="md-fab" && !b("disabled")) || (node.tag=="md-button" && !b("disabled"))))
            .accessibilityIdentifier(node.id)
            .modifier(AWCMenuAnchorAuto(id: node.id, label: { awcMenuAnchorName(node, local) }))
            .awcKeyViewEntry()
            .environment(\.awcInteractionStore, interactionStore)
            .environment(\.awcNativeDensity, AWCNativeDensity.resolve(local["density"]?.number, inherited: inheritedDensity))
            .environment(\.awcNativeDenseInset, [-2.0,-3,-4].contains(local["density"]?.number ?? 0) || inheritedDenseInset)
            .environment(\.awcNativeCompactSmallGap, [-3.0,-4].contains(local["density"]?.number ?? 0) || inheritedCompactSmallGap)
            .environment(\.awcNativeSpacingRung, [-2.0,-3,-4].contains(local["density"]?.number ?? 0) ? local["density"]!.number! : inheritedSpacingRung)
            .onAppear { synchronizeLinkedState(); synchronizeFormRegistration(); interactionStore.labelTexts.register(node.id, node.authoredTextContent) }
            .onDisappear { registeredForm?.unregister(id: formRegistrationID) }
            .onChange(of: resolvedForm?.id) { _, _ in synchronizeFormRegistration() }
            .onChange(of: node.properties) { previous, value in
                let menuOpen=local["open"],splitChecked=local["trailingChecked"],pickerValue=local["value"]
                local = (AWCComponentCatalog.defaults[node.tag] ?? [:]).merging(value) { _, new in new }
                if ["md-fab-menu","md-snackbar","md-tooltip"].contains(node.tag),previous["open"]==value["open"] {local["open"]=menuOpen}
                if node.tag=="md-split-button",previous["trailingChecked"]==value["trailingChecked"] {local["trailingChecked"]=splitChecked}
                // md-color-picker owns value and open once interaction wrote them; an unrelated property edit keeps them.
                if node.tag=="md-color-picker" { if previous["value"]==value["value"] {local["value"]=pickerValue}; if previous["open"]==value["open"] {local["open"]=menuOpen} }
                synchronizeLinkedState();synchronizeFormRegistration()
                interactionStore.labelTexts.register(node.id, node.authoredTextContent)
            }
    }
    func synchronizeLinkedState() {
        // md-tabs publishes its selection itself (AWCNativeTabs).
        if node.tag == "md-radio" && b("checked") && !s("name").isEmpty { interactionStore.radioValues[s("name")] = s("value") }
    }
    var disabled: Bool { b("disabled") || b("softDisabled") }
    var readOnly: Bool { b("readOnly") || b("readonly") }
    func p(_ key: String) -> AWCValue { local[key] ?? .null }
    func s(_ key: String, _ fallback: String = "") -> String { local[key]?.string ?? fallback }
    func n(_ key: String, _ fallback: Double = 0) -> Double { local[key]?.number ?? fallback }
    func b(_ key: String, _ fallback: Bool = false) -> Bool { (key == "selected" ? nativeGroupContext?.selection(node.id) : nil) ?? local[key]?.bool ?? fallback }
    var nativeActionProperties: [String: AWCValue] { var value = local; value["selected"] = .bool(b("selected")); return value }
    func a(_ key: String) -> [AWCValue] { p(key).array }
    func set(_ key: String, _ value: AWCValue) { local[key] = value; if key == "selected", let selected = value.bool { nativeGroupContext?.commit(node.id, selected) }; if nativeFormValueKey != nil { registeredForm?.setValue(nativeFormControl.value, for: formRegistrationID) } }
    func emit(_ name: String, _ detail: AWCValue = .null) {
        let event = AWCEvent(name: name, tag: node.tag, nodeID: node.id, detail: detail)
        onEvent(AWCEventDispatcher.dispatch(event, through: eventDispatcher, targetListeners: eventTargetListeners).observedEvent)
    }
    var label: String { [s("label"), s("headline"), s("text"), node.children.filter { $0.tag == "#text" && $0.slot == nil }.compactMap { $0.properties["text"]?.string }.joined(separator: " ")].first { !$0.isEmpty } ?? "" }
    /// The accessible name: the host aria-label (or its ariaLabel property alias) wins over the visible label, as on Web.
    var accessibleName: String { [s("aria-label"), s("ariaLabel")].first { !$0.isEmpty } ?? label }
    var spacing: CGFloat { max(4, 12 + CGFloat(n("density")) * 2) }
    var radius: CGFloat { s("shape") == "square" ? 12 : 24 }
    var theme: AWCTheme { customTheme ?? .generated(dark: colorScheme == .dark) }
    var surface: Color { theme.surface }
    var foreground: Color { b("error") ? theme.error : theme.primary }
    var size: CGFloat { ["xs": 28, "sm": 36, "md": 44, "lg": 56, "xl": 72][s("size", "md")] ?? 44 }

    func child(_ node: AWCNode, properties: [String: AWCValue] = [:], handler: ((AWCEvent) -> Void)? = nil) -> AnyView {
        var result = node; result.properties.merge(properties) { _, new in new }
        // md-tab-panels without `for` follows the nearest preceding md-tabs sibling.
        let precedingTabs = result.tag == "md-tab-panels" ? self.node.children.prefix { $0.id != result.id }.last { $0.tag == "md-tabs" }?.id : nil
        return AnyView(AWCNativeView(node: result, onEvent: handler ?? onEvent).environment(\.awcPrecedingTabsID, precedingTabs))
    }
    func content(_ slot: String? = nil) -> AnyView {
        AnyView(VStack(alignment: .leading, spacing: spacing) {
            ForEach(node.children(inSlot: slot)) { child($0) }
        })
    }
    @ViewBuilder func symbol(_ name: String, fallback: String = "") -> some View {
        if !name.isEmpty || !fallback.isEmpty { Image(systemName: awcSymbol(name.isEmpty ? fallback : name)).accessibilityHidden(true) }
    }
    @ViewBuilder var support: some View {
        let text = b("error") ? s("errorText", s("supportingText")) : s("supportingText")
        if !text.isEmpty { Text(text).font(.caption).foregroundStyle(b("error") ? theme.error : .secondary) }
    }
    func textBinding(_ key: String, event: String = "mdInput", object: Bool = false, fallback: String = "") -> Binding<String> {
        Binding(get: { s(key, fallback) }, set: { value in
            set(key, .string(value)); emit(event, object ? ["value": .string(value)] : .string(value))
        })
    }
    func boolBinding(_ key: String, event: String = "mdChange") -> Binding<Bool> {
        Binding(get: { b(key) }, set: { value in set(key, .bool(value)); emit(event, [key: .bool(value)]) })
    }
    func showOverlay(_ value: Bool) { set("open", .bool(value)); emit(value ? "mdOpen" : "mdClose") }
    func activateLink() { if let url = URL(string: s("href")), !s("href").isEmpty { openURL(url) } }
    func validate(_ isValid: Bool) {
        emit("mdValidityChange", ["valid": .bool(isValid), "validationMessage": .string(isValid ? "" : s("valueMissingLabel", "This field is required")), "flags": ["valueMissing": .bool(!isValid)]])
    }

    @ViewBuilder var rendered: some View {
        switch node.tag {
        case "#text": Text(s("text"))
        case "#symbol": AWCMaterialSymbol(s("name"))
        case "md-button": nativeButton
        case "md-icon-button": nativeIconButton
        case "md-fab": nativeFab
        case "md-fab-menu-item": nativeFabMenuItem
        case "md-fab-menu": AWCNativeFabMenu(node:node,properties:local,theme:theme,onEvent:onEvent,onOpenChanged:{set("open",.bool($0))})
        case "md-split-button": nativeSplitButton
        case "md-button-group": nativeButtonGroup
        case "md-segmented-button-set": AWCNativeSegmentedSet(node:node,onEvent:onEvent)
        case "md-segmented-button": nativeSegmentedButton
        case "md-switch": nativeSwitch
        case "md-checkbox": nativeCheckbox
        case "md-radio": nativeRadio
        case "md-chip": nativeChip
        case "md-text-field": nativeTextField
        case "md-number-field": nativeNumberField
        case "md-otp-field": nativeOTPField
        case "md-select": nativeSelect
        case "md-multi-select": nativeMultiSelect
        case "md-autocomplete": optionPicker
        case "md-select-option": selectOption
        case "md-slider": slider
        case "md-rating": rating
        case "md-date-picker": temporalPicker
        case "md-time-picker": nativeTimePicker
        case "md-color-picker": nativeColorPicker
        case "md-divider": divider
        case "md-avatar": nativeAvatar
        case "md-badge", "md-status-dot": badge
        case "md-skeleton": skeleton
        case "md-loading-indicator": AWCNativeLoadingIndicator(nodeID:node.id,properties:local,theme:theme)
        case "md-meter": AWCNativeMeter(nodeID:node.id,properties:local,theme:theme)
        case "md-progress-indicator": AWCNativeProgressIndicator(nodeID:node.id,properties:local,theme:theme,onComplete:{emit("mdComplete")})
        case "md-ripple": AWCNativeRippleNode(node: node)
        case "md-card": nativeCard
        case "md-accordion": AWCNativeAccordionGroup(node: node, theme: theme, onEvent: onEvent)
        case "md-accordion-item": AWCNativeAccordionStandaloneItem(node: node, theme: theme, onEvent: onEvent)
        case "md-list": nativeList
        case "md-list-item": nativeListItem
        case "md-app-bar": toolbar
        case "md-toolbar": nativeToolbar
        case "md-navigation-bar": nativeNavigationBar
        case "md-navigation-rail": navigation
        case "md-tabs": nativeTabs
        case "md-navigation-tab": nativeNavigationTab
        case "md-navigation-rail-tab": navigationItem
        case "md-tab": nativeTab
        case "md-tab-panels": nativeTabPanels
        case "md-tab-panel": nativeTabPanel
        case "md-breadcrumbs": nativeBreadcrumbs
        case "md-breadcrumb-item": nativeBreadcrumbItem
        // Dedicated renderers (Stepper/NativeStepper.swift): Web geometry, motion, navigation rules and announcements.
        case "md-stepper": nativeStepper
        case "md-step": nativeStep
        case "md-dialog": nativeDialog
        case "md-bottom-sheet": nativeBottomSheet
        case "md-side-sheet": nativeSideSheet
        case "md-menu": nativeMenu
        case "md-menu-item", "md-sub-menu-item", "md-menu-item-group": nativeMenuItem
        case "md-snackbar": snackbar
        case "md-tooltip": tooltip
        case "md-search": search
        case "md-table", "md-table-container", "md-table-head", "md-table-body", "md-table-foot", "md-table-row", "md-table-cell", "md-table-toolbar", "md-table-pagination", "md-table-sort-label", "md-table-expand-toggle": nativeTableFamily
        case "md-transfer-list": transferList
        case "md-organization-chart": nativeOrgChart
        case "md-line-chart", "md-area-chart", "md-bar-chart", "md-pie-chart", "md-sparkline":
            // Dedicated renderer (Charts/NativeChartView.swift): the ported engine's scene, hover layer, tooltips, legend, zoom, keyboard.
            AWCNativeChartView(nodeID: node.id, tag: node.tag, properties: local,
                               slots: Dictionary(grouping: node.children.filter { $0.slot != nil }, by: { $0.slot ?? "" }), onEvent: onEvent)
        default: Text("Unsupported native tag: \(node.tag)").foregroundStyle(.red)
        }
    }
}
