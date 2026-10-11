import SwiftUI
#if canImport(AppKit)
import AppKit
#endif

private struct AWCFormRegistryKey: EnvironmentKey { static let defaultValue: AWCFormRegistry? = nil }
private struct AWCFormOwnerKey: EnvironmentKey { static let defaultValue: String? = nil }
private struct AWCFormStateKey: EnvironmentKey { static let defaultValue: AWCFormState? = nil }
private struct AWCEventDispatcherKey: EnvironmentKey { static let defaultValue: AWCEventDispatcher? = nil }
private struct AWCURLRouterKey: EnvironmentKey { static let defaultValue: AWCURLRouter? = nil }
public extension EnvironmentValues {
    var awcFormRegistry: AWCFormRegistry? { get { self[AWCFormRegistryKey.self] } set { self[AWCFormRegistryKey.self] = newValue } }
    var awcFormOwnerID: String? { get { self[AWCFormOwnerKey.self] } set { self[AWCFormOwnerKey.self] = newValue } }
    var awcFormState: AWCFormState? { get { self[AWCFormStateKey.self] } set { self[AWCFormStateKey.self] = newValue } }
    var awcEventDispatcher: AWCEventDispatcher? { get { self[AWCEventDispatcherKey.self] } set { self[AWCEventDispatcherKey.self] = newValue } }
    var awcURLRouter: AWCURLRouter? { get { self[AWCURLRouterKey.self] } set { self[AWCURLRouterKey.self] = newValue } }
}

/// Descendants participate in the nearest explicit native form, including nested scopes.
public struct AWCFormScope<Content: View>: View {
    public let form: AWCFormState
    private let content: () -> Content
    public init(form: AWCFormState, @ViewBuilder content: @escaping () -> Content) { self.form = form; self.content = content }
    public var body: some View { content().environment(\.awcFormState, form).environment(\.awcFormOwnerID, nil) }
}

public struct AWCFormRegistryScope<Content: View>: View {
    public let registry: AWCFormRegistry
    private let content: () -> Content
    public init(registry: AWCFormRegistry, @ViewBuilder content: @escaping () -> Content) { self.registry = registry; self.content = content }
    public var body: some View { content().environment(\.awcFormRegistry, registry) }
}

public struct AWCEventScope<Content: View>: View {
    public let id: String
    private let handler: (AWCEventContext) -> Void
    private let content: () -> Content
    @Environment(\.awcEventDispatcher) private var parent
    public init(id: String, onEvent: @escaping (AWCEventContext) -> Void, @ViewBuilder content: @escaping () -> Content) {
        self.id = id; handler = onEvent; self.content = content
    }
    public var body: some View { content().environment(\.awcEventDispatcher, AWCEventDispatcher(id: id, parent: parent, handler: handler)) }
}

public extension View {
    func awcFormOwner(_ id: String) -> some View { environment(\.awcFormOwnerID, id) }
    func awcURLRouter(_ router: AWCURLRouter) -> some View { environment(\.awcURLRouter, router) }
}

extension AWCNativeView {
    var resolvedForm: AWCFormState? {
        if let formOwnerID { return formRegistry?.form(id: formOwnerID) }
        return formState
    }
    var nativeFormValueKey: String? { AWCFormControl.tags.contains(node.tag) ? AWCFormControl(tag: node.tag).valueKey : nil }
    var nativeFormControl: AWCFormControl { AWCFormControl(tag: node.tag, properties: local) }
    func applyFormValue(_ value: AWCValue) {
        if node.tag == "md-slider", b("range") {
            local["valueStart"] = value["valueStart"]; local["valueEnd"] = value["valueEnd"]
        } else if let key = nativeFormValueKey { local[key] = value }
    }
    func synchronizeFormRegistration() {
        let form = resolvedForm
        if registeredForm !== form { registeredForm?.unregister(id: formRegistrationID); registeredForm = form }
        guard let form else { return }
        if node.tag == "md-button" {
            if s("type") == "submit", s("href").isEmpty { form.registerSubmitter(id: formRegistrationID) { activateNativeButton() } }
            else { form.unregisterSubmitter(id: formRegistrationID) }
            return
        }
        guard nativeFormValueKey != nil else { return }
        if initialFormProperties == nil { initialFormProperties = local }
        let control = nativeFormControl
        var rules = control.rules
        if node.tag == "md-text-field", s("type") == "number" {
            rules.stepBase = control.number("min") ?? node.properties["value"]?.number.flatMap { $0.isFinite ? $0 : nil } ?? 0
        }
        form.register(id: formRegistrationID, name: s("name"), value: control.value, rules: rules, disabled: b("disabled"),
                      onReset: { value in
                          applyFormValue(value)
                          if node.tag == "md-checkbox" { local["indeterminate"] = initialFormProperties?["indeterminate"] ?? .bool(false) }
                      }, control: control, initialValue: node.tag == "md-otp-field" ? .string("") : nil,
                      onChange: { value in applyFormValue(value) })
    }
    var permitsNativeEnter: Bool {
        guard !disabled, !b("multiline") else { return false }
        #if canImport(AppKit)
        if let event = NSApp.currentEvent, event.type == .keyDown,
           (!event.modifierFlags.intersection([.shift, .control, .option, .command]).isEmpty || event.isARepeat) { return false }
        #endif
        return true
    }
    func submitFromNativeText() {
        guard permitsNativeEnter else { return }
        _ = resolvedForm?.requestImplicitSubmit(dispatcher: eventDispatcher, observe: onEvent)
    }
}

/// A concrete native scenario for checking forms, cancellation, named slots and
/// intercepted routing. No link in this demo opens an external application.
public struct AWCButtonBehaviorDemo: View {
    public var properties: [String: AWCValue]
    public var onEvent: (AWCEvent) -> Void
    @State private var form = AWCFormState()
    @State private var cancelActions = false
    @State private var cancelFormEvents = false
    @State private var encoded = "No submitted data yet"
    @State private var status = "Ready"
    @State private var selected = false
    public init(properties: [String: AWCValue] = [:], onEvent: @escaping (AWCEvent) -> Void = { _ in }) {
        self.properties = properties; self.onEvent = onEvent
    }
    private func notice(_ name: String, _ detail: AWCValue) {
        onEvent(AWCEvent(name: name, tag: "native-form", nodeID: "button-behavior-form", detail: detail))
    }
    private func record(_ event: AWCEvent) {
        onEvent(event)
        if event.name == "mdChange", event.nodeID == "demo-toggle" { selected = event.detail["selected"].bool ?? false }
    }
    private func action(_ id: String, _ title: String, _ overrides: [String: AWCValue], children: [AWCNode] = []) -> AWCNode {
        var values: [String: AWCValue] = ["variant": "filled", "size": "sm", "type": "button", "toggle": false, "href": ""]
        values.merge(properties) { _, new in new }; values.merge(overrides) { _, new in new }
        // Demo roles stay independent of the main component's selected/toggle values.
        return AWCNode(id: id, tag: "md-button", properties: values, children: [.text(title)] + children)
    }
    private var minimumActionWidth: CGFloat {
        let metrics = AWCNativeButtonMetrics(size: properties["size"]?.string ?? "sm", density: properties["density"]?.number ?? 0, variant: properties["variant"]?.string ?? "filled")
        return max(150, metrics.horizontalPadding * 2 + metrics.fontSize * 6)
    }
    public var body: some View {
        AWCFormScope(form: form) {
            AWCEventScope(id: "button-behavior-scope", onEvent: { context in
                if context.event.name == "mdClick", cancelActions {
                    context.preventDefault(); status = "Canceled \(context.event.nodeID) before effects"
                }
            }) {
                VStack(alignment: .leading, spacing: 14) {
                    Text("Native form & cancellation").font(.headline)
                    AWCNativeView(node: AWCNode(id: "demo-name", tag: "md-text-field", properties: ["name": "name", "label": "Name", "value": "Ada", "required": true, "minLength": 2, "maxLength": 40]), onEvent: record)
                    Toggle("Cancel actions", isOn: $cancelActions)
                    Toggle("Cancel submit / reset events", isOn: $cancelFormEvents)
                    Text("Enter in Name submits this native form.").font(.caption).foregroundStyle(.secondary)
                    LazyVGrid(columns: [GridItem(.adaptive(minimum: minimumActionWidth), spacing: 8, alignment: .leading)], alignment: .leading, spacing: 8) {
                        AWCNativeView(node: action("demo-submit", "Submit", ["type": "submit", "toggle": false, "href": ""]), onEvent: record)
                        AWCNativeView(node: action("demo-reset", "Reset", ["type": "reset", "toggle": false, "href": "", "variant": "outlined"]), onEvent: record)
                        AWCNativeView(node: action("demo-toggle", "Toggle", ["type": "button", "toggle": true, "selected": .bool(selected), "href": ""], children: [AWCNode(id: "demo-slot-icon", tag: "#text", properties: ["text": "★"], slot: "leading-icon")]), onEvent: record)
                        AWCNativeView(node: action("demo-link", "Link", ["type": "button", "toggle": false, "href": "https://example.com", "target": "_blank", "variant": "text"]), onEvent: record)
                    }
                    Text("Value: \(form.values["name"]?.string ?? "") · Toggle: \(selected ? "on" : "off")").font(.caption)
                    Text("Encoded locally: " + encoded).font(.caption.monospaced()).textSelection(.enabled)
                    Text(status).font(.caption).accessibilityIdentifier("native-form-status")
                    ForEach(form.validationMessages.keys.sorted(), id: \.self) { id in Text(form.validationMessages[id] ?? "").font(.caption).foregroundStyle(.red) }
                }
            }
        }
        .awcURLRouter(AWCURLRouter { request in
            status = "Intercepted link to \(request.url.host ?? request.url.absoluteString) (\(request.target))"
            notice("mdNavigate", ["url": .string(request.url.absoluteString), "target": .string(request.target), "nodeID": .string(request.nodeID)])
            return true
        })
        .onAppear {
            form.onSubmit = { submission in status = "Submitted"; encoded = submission.formURLEncoded() }
            form.onEvent = { context in
                if cancelFormEvents && ["mdSubmit", "mdReset"].contains(context.event.name) { context.preventDefault(); status = "Canceled " + context.event.name + " before form effects" }
            }
            form.onInvalid = { _ in status = "Validation blocked submission" }
            form.onReset = { _ in selected = false; status = "Reset to initial values"; encoded = "No submitted data yet" }
        }
        .onDisappear { form.onSubmit = { _ in }; form.onInvalid = { _ in }; form.onReset = { _ in }; form.onEvent = { _ in } }
    }
}
