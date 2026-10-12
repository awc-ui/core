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
    @Environment(\.awcButtonFocusGroup) var inheritedButtonFocusGroup
    @Environment(\.awcGridCellContext) var gridCellContext
    @Environment(\.awcNativeFocusChanged) var nativeFocusChanged
    @Environment(\.layoutDirection) var layoutDirection
    @State var query = ""
    @State var auxiliaryQuery = ""
    @State var passwordVisible = false
    @State private var ownedInteractionStore = AWCInteractionStore()
    @Environment(\.awcInteractionStore) private var inheritedInteractionStore
    var interactionStore: AWCInteractionStore { inheritedInteractionStore ?? ownedInteractionStore }
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

    public init(node: AWCNode, onEvent: @escaping (AWCEvent) -> Void = { _ in }) {
        self.node = node; self.onEvent = onEvent
        _local = State(initialValue: (AWCComponentCatalog.defaults[node.tag] ?? [:]).merging(node.properties) { _, new in new })
    }
    public init(tag: String, properties: [String: AWCValue] = [:], children: [AWCNode] = [], onEvent: @escaping (AWCEvent) -> Void = { _ in }) {
        self.init(node: AWCNode(id: tag, tag: tag, properties: properties, children: children), onEvent: onEvent)
    }
    public var body: some View {
        rendered
            .foregroundStyle(theme.onSurface)
            .tint(theme.primary)
            .disabled(disabled)
            .accessibilityIdentifier(node.id)
            .environment(\.awcInteractionStore, interactionStore)
            .onAppear { synchronizeLinkedState(); synchronizeFormRegistration() }
            .onDisappear { registeredForm?.unregister(id: formRegistrationID) }
            .onChange(of: resolvedForm?.id) { _, _ in synchronizeFormRegistration() }
            .onChange(of: node.properties) { _, value in local = (AWCComponentCatalog.defaults[node.tag] ?? [:]).merging(value) { _, new in new }; synchronizeLinkedState(); synchronizeFormRegistration() }
    }
    func synchronizeLinkedState() {
        if node.tag == "md-tabs" { interactionStore.tabIndices[node.id] = Int(n("activeTabIndex")) }
        if node.tag == "md-radio" && b("checked") && !s("name").isEmpty { interactionStore.radioValues[s("name")] = s("value") }
    }
    var disabled: Bool { b("disabled") || b("softDisabled") }
    var readOnly: Bool { b("readOnly") || b("readonly") }
    func p(_ key: String) -> AWCValue { local[key] ?? .null }
    func s(_ key: String, _ fallback: String = "") -> String { local[key]?.string ?? fallback }
    func n(_ key: String, _ fallback: Double = 0) -> Double { local[key]?.number ?? fallback }
    func b(_ key: String, _ fallback: Bool = false) -> Bool { local[key]?.bool ?? fallback }
    func a(_ key: String) -> [AWCValue] { p(key).array }
    func set(_ key: String, _ value: AWCValue) { local[key] = value; if nativeFormValueKey != nil { registeredForm?.setValue(nativeFormControl.value, for: formRegistrationID) } }
    func emit(_ name: String, _ detail: AWCValue = .null) {
        let event = AWCEvent(name: name, tag: node.tag, nodeID: node.id, detail: detail)
        onEvent(AWCEventDispatcher.dispatch(event, through: eventDispatcher, targetListeners: eventTargetListeners).observedEvent)
    }
    var label: String { [s("label"), s("headline"), s("text"), node.children.filter { $0.tag == "#text" && $0.slot == nil }.compactMap { $0.properties["text"]?.string }.joined(separator: " ")].first { !$0.isEmpty } ?? "" }
    var spacing: CGFloat { max(4, 12 + CGFloat(n("density")) * 2) }
    var radius: CGFloat { s("shape") == "square" ? 12 : 24 }
    var theme: AWCTheme { customTheme ?? .generated(dark: colorScheme == .dark) }
    var surface: Color { theme.surface }
    var foreground: Color { b("error") ? theme.error : theme.primary }
    var size: CGFloat { ["xs": 28, "sm": 36, "md": 44, "lg": 56, "xl": 72][s("size", "md")] ?? 44 }

    func child(_ node: AWCNode, properties: [String: AWCValue] = [:], handler: ((AWCEvent) -> Void)? = nil) -> AnyView {
        var result = node; result.properties.merge(properties) { _, new in new }
        return AnyView(AWCNativeView(node: result, onEvent: handler ?? onEvent))
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
        case "md-button": nativeButton
        case "md-icon-button", "md-fab", "md-fab-menu-item": actionButton
        case "md-split-button": splitButton
        case "md-button-group": nativeButtonGroup
        case "md-segmented-button-set": selectionGroup
        case "md-segmented-button": segmentedButton
        case "md-checkbox", "md-radio", "md-switch": checkControl
        case "md-chip": chip
        case "md-text-field", "md-otp-field", "md-number-field": inputField
        case "md-select", "md-multi-select", "md-autocomplete": optionPicker
        case "md-select-option": selectOption
        case "md-slider": slider
        case "md-rating": rating
        case "md-date-picker", "md-time-picker": temporalPicker
        case "md-color-picker": colorPicker
        case "md-divider": divider
        case "md-avatar": avatar
        case "md-badge", "md-status-dot": badge
        case "md-skeleton": skeleton
        case "md-progress-indicator", "md-meter", "md-loading-indicator": progress
        case "md-ripple": ripple
        case "md-card": card
        case "md-accordion", "md-accordion-item": accordion
        case "md-list", "md-list-item": list
        case "md-app-bar", "md-toolbar": toolbar
        case "md-navigation-bar", "md-navigation-rail", "md-tabs": navigation
        case "md-navigation-tab", "md-navigation-rail-tab", "md-tab": navigationItem
        case "md-tab-panels": tabPanels
        case "md-tab-panel": if b("active", true) { content() }
        case "md-breadcrumbs", "md-breadcrumb-item": breadcrumbs
        case "md-stepper", "md-step": stepper
        case "md-dialog", "md-bottom-sheet", "md-side-sheet": sheet
        case "md-menu", "md-fab-menu": menu
        case "md-menu-item", "md-sub-menu-item", "md-menu-item-group": menuItem
        case "md-snackbar": snackbar
        case "md-tooltip": tooltip
        case "md-search": search
        case "md-table", "md-table-container", "md-table-head", "md-table-body", "md-table-foot", "md-table-row", "md-table-cell", "md-table-toolbar", "md-table-pagination", "md-table-sort-label", "md-table-expand-toggle": table
        case "md-transfer-list": transferList
        case "md-organization-chart": organizationChart
        case "md-line-chart", "md-area-chart", "md-bar-chart", "md-pie-chart", "md-sparkline": chart
        default: Text("Unsupported native tag: \(node.tag)").foregroundStyle(.red)
        }
    }
}
