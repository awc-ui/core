import SwiftUI

private struct AWCFormStateKey: EnvironmentKey { static let defaultValue: AWCFormState? = nil }
private struct AWCEventDispatcherKey: EnvironmentKey { static let defaultValue: AWCEventDispatcher? = nil }
private struct AWCURLRouterKey: EnvironmentKey { static let defaultValue: AWCURLRouter? = nil }
public extension EnvironmentValues {
    var awcFormState: AWCFormState? { get { self[AWCFormStateKey.self] } set { self[AWCFormStateKey.self] = newValue } }
    var awcEventDispatcher: AWCEventDispatcher? { get { self[AWCEventDispatcherKey.self] } set { self[AWCEventDispatcherKey.self] = newValue } }
    var awcURLRouter: AWCURLRouter? { get { self[AWCURLRouterKey.self] } set { self[AWCURLRouterKey.self] = newValue } }
}

/// Descendants participate in the nearest explicit native form, including nested scopes.
public struct AWCFormScope<Content: View>: View {
    public let form: AWCFormState
    private let content: () -> Content
    public init(form: AWCFormState, @ViewBuilder content: @escaping () -> Content) { self.form = form; self.content = content }
    public var body: some View { content().environment(\.awcFormState, form) }
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
    func awcURLRouter(_ router: AWCURLRouter) -> some View { environment(\.awcURLRouter, router) }
}

extension AWCNativeView {
    /// Deliberately limited native field integration. Other controls can register
    /// their host-owned values directly with AWCFormState.
    var nativeFormValueKey: String? {
        guard !s("name").isEmpty else { return nil }
        switch node.tag {
        case "md-text-field", "md-number-field", "md-otp-field", "md-select", "md-multi-select", "md-autocomplete": return "value"
        case "md-checkbox": return "checked"
        case "md-switch": return "selected"
        default: return nil
        }
    }
    func synchronizeFormRegistration() {
        if registeredForm !== formState { registeredForm?.unregister(id: formRegistrationID); registeredForm = formState }
        guard let formState, let key = nativeFormValueKey else { registeredForm?.unregister(id: formRegistrationID); return }
        let rules = AWCFormRules(required: b("required"), minimumLength: AWCFormRules.lengthConstraint(local["minLength"]),
                                 maximumLength: AWCFormRules.lengthConstraint(local["maxLength"]),
                                 minimum: node.tag == "md-number-field" ? local["min"]?.number.flatMap { $0.isFinite ? $0 : nil } : nil,
                                 maximum: node.tag == "md-number-field" ? local["max"]?.number.flatMap { $0.isFinite ? $0 : nil } : nil,
                                 pattern: s("pattern").isEmpty ? nil : s("pattern"))
        formState.register(id: formRegistrationID, name: s("name"), value: p(key), rules: rules, disabled: disabled,
                           onReset: { value in set(key, value) })
    }
}

/// A concrete native scenario for checking forms, cancellation, named slots and
/// intercepted routing. No link in this demo opens an external application.
public struct AWCButtonBehaviorDemo: View {
    public var properties: [String: AWCValue]
    public var onEvent: (AWCEvent) -> Void
    @State private var form = AWCFormState()
    @State private var cancelActions = false
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
        if event.name == "mdChange", event.nodeID == "demo-toggle" { selected = event.detail["selected"].bool ?? false; form.setValue(.bool(selected), for: "demo-toggle-value") }
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
                    AWCNativeView(node: AWCNode(id: "demo-name", tag: "md-text-field", properties: ["name": "name", "label": "Name", "value": "Ada", "required": true]), onEvent: record)
                    Toggle("Cancel actions", isOn: $cancelActions)
                    LazyVGrid(columns: [GridItem(.adaptive(minimum: minimumActionWidth), spacing: 8, alignment: .leading)], alignment: .leading, spacing: 8) {
                        AWCNativeView(node: action("demo-submit", "Submit", ["type": "submit", "toggle": false, "href": ""]), onEvent: record)
                        AWCNativeView(node: action("demo-reset", "Reset", ["type": "reset", "toggle": false, "href": "", "variant": "outlined"]), onEvent: record)
                        AWCNativeView(node: action("demo-toggle", "Toggle", ["type": "button", "toggle": true, "selected": .bool(selected), "href": ""], children: [AWCNode(id: "demo-slot-icon", tag: "#text", properties: ["text": "★"], slot: "leading-icon")]), onEvent: record)
                        AWCNativeView(node: action("demo-link", "Link", ["type": "button", "toggle": false, "href": "https://example.com", "target": "_blank", "variant": "text"]), onEvent: record)
                    }
                    Text("Value: \(form.values["name"]?.string ?? "") · Toggle: \(selected ? "on" : "off")").font(.caption)
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
            form.register(id: "demo-toggle-value", name: "selected", value: .bool(selected), onReset: { value in selected = value.bool ?? false })
            form.onSubmit = { submission in status = "Submitted"; notice("mdSubmit", ["values": .object(submission.values), "submitter": .string(submission.submitter?.id ?? "")]) }
            form.onInvalid = { errors in status = "Validation blocked submission"; notice("mdInvalid", .object(errors.mapValues(AWCValue.string))) }
            form.onReset = { values in status = "Reset to initial values"; notice("mdReset", .object(values)) }
        }
        .onDisappear { form.unregister(id: "demo-toggle-value"); form.onSubmit = { _ in }; form.onInvalid = { _ in }; form.onReset = { _ in } }
    }
}
