import Foundation
import Observation

/// A synchronous native event. Cancellation controls the component's default
/// action; propagation controls only the enclosing native event scopes.
public final class AWCEventContext {
    public let event: AWCEvent
    public let cancelable: Bool
    public private(set) var defaultPrevented = false
    public private(set) var propagationStopped = false
    public private(set) var currentScopeID: String?
    public private(set) var path: [String] = []
    public init(event: AWCEvent, cancelable: Bool = false) { self.event = event; self.cancelable = cancelable }
    public func preventDefault() { if cancelable { defaultPrevented = true } }
    public func stopPropagation() { propagationStopped = true }
    public var observedEvent: AWCEvent { var result = event; result.defaultPrevented = defaultPrevented; return result }
    fileprivate func enter(_ id: String) { currentScopeID = id }
    fileprivate func finish() { currentScopeID = nil }
    fileprivate func setPath(_ value: [String]) { path = value }
}

/// Explicit inner-to-outer native propagation. There is no implicit DOM capture
/// phase, browser retargeting, composed path, or system input event attached.
public final class AWCEventDispatcher {
    public let id: String
    public let parent: AWCEventDispatcher?
    private let handler: (AWCEventContext) -> Void
    public init(id: String, parent: AWCEventDispatcher? = nil, handler: @escaping (AWCEventContext) -> Void) {
        self.id = id; self.parent = parent; self.handler = handler
    }
    @discardableResult public func dispatch(_ event: AWCEvent, cancelable: Bool = false) -> AWCEventContext {
        let context = AWCEventContext(event: event, cancelable: cancelable)
        var scopes: [AWCEventDispatcher] = []; var current: AWCEventDispatcher? = self
        while let scope = current { scopes.append(scope); current = scope.parent }
        context.setPath([event.nodeID] + scopes.map(\.id))
        for scope in scopes {
            context.enter(scope.id); scope.handler(context)
            if context.propagationStopped { break }
        }
        context.finish(); return context
    }
}

public struct AWCURLRequest: Sendable {
    public let url: URL
    public let rawHref: String
    public let target: String
    public let nodeID: String
}

/// The host chooses navigation behavior. Only explicitly allowed, absolute URL
/// schemes are routed; relative URLs require an explicit safe base URL.
public struct AWCURLRouter {
    public let allowedSchemes: Set<String>
    public let baseURL: URL?
    private let handler: (AWCURLRequest) -> Bool
    public init(allowedSchemes: Set<String> = ["https", "http", "mailto", "tel"], baseURL: URL? = nil,
                handler: @escaping (AWCURLRequest) -> Bool) {
        self.allowedSchemes = Set(allowedSchemes.map { $0.lowercased() }); self.baseURL = baseURL; self.handler = handler
    }
    public func request(href: String, target: String = "_self", nodeID: String) -> AWCURLRequest? {
        guard !href.isEmpty, !href.unicodeScalars.contains(where: { $0.value < 32 || $0.value == 127 }) else { return nil }
        let trimmed = href.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, let url = URL(string: trimmed, relativeTo: baseURL)?.absoluteURL,
              let scheme = url.scheme?.lowercased(), allowedSchemes.contains(scheme),
              !["javascript", "vbscript", "data", "file"].contains(scheme) else { return nil }
        if ["https", "http"].contains(scheme) && (url.host?.isEmpty != false) { return nil }
        if ["mailto", "tel"].contains(scheme) && url.absoluteString.dropFirst(scheme.count + 1).isEmpty { return nil }
        return AWCURLRequest(url: url, rawHref: href, target: target, nodeID: nodeID)
    }
    @discardableResult public func route(href: String, target: String = "_self", nodeID: String) -> Bool {
        guard let request = request(href: href, target: target, nodeID: nodeID) else { return false }
        return handler(request)
    }
}

public struct AWCFormRules: Equatable, Sendable {
    public var required: Bool
    public var minimumLength: Int?
    public var maximumLength: Int?
    public var minimum: Double?
    public var maximum: Double?
    public var pattern: String?
    public init(required: Bool = false, minimumLength: Int? = nil, maximumLength: Int? = nil,
                minimum: Double? = nil, maximum: Double? = nil, pattern: String? = nil) {
        self.required = required; self.minimumLength = minimumLength; self.maximumLength = maximumLength
        self.minimum = minimum; self.maximum = maximum; self.pattern = pattern
    }
    static func lengthConstraint(_ value: AWCValue?) -> Int? {
        guard let number = value?.number, number.isFinite, number >= 0 else { return nil }
        return Int(exactly: number)
    }
    public func validationMessage(for value: AWCValue) -> String? {
        let missing: Bool
        switch value { case .null: missing = true; case .string(let v): missing = v.isEmpty
        case .array(let v): missing = v.isEmpty; case .bool(let v): missing = !v; default: missing = false }
        if required && missing { return "This field is required." }
        if missing { return nil }
        if case .string(let text) = value {
            if let minimumLength, text.count < minimumLength { return "Enter at least \(minimumLength) characters." }
            if let maximumLength, text.count > maximumLength { return "Enter at most \(maximumLength) characters." }
            if let pattern, !pattern.isEmpty {
                guard let expression = try? NSRegularExpression(pattern: "^(?:" + pattern + ")$") else { return "The native validation pattern is invalid." }
                let range = NSRange(text.startIndex..<text.endIndex, in: text)
                if expression.firstMatch(in: text, range: range)?.range != range { return "The value does not match the required format." }
            }
        }
        if minimum != nil || maximum != nil {
            guard let number = value.number, number.isFinite else { return "Enter a valid number." }
            if let minimum, number < minimum { return "Enter a value of at least \(minimum)." }
            if let maximum, number > maximum { return "Enter a value of at most \(maximum)." }
        }
        return nil
    }
}

public struct AWCFormEntry: Equatable, Sendable {
    public let id: String
    public let name: String
    public let value: AWCValue
}
public struct AWCFormSubmission: Sendable {
    public let entries: [AWCFormEntry]
    public let submitter: AWCNode?
    /// Duplicate names retain registration order as an array instead of losing values.
    public var values: [String: AWCValue] { awcFormValues(entries) }
}
private func awcFormValues(_ entries: [AWCFormEntry]) -> [String: AWCValue] {
    let groups = Dictionary(grouping: entries, by: \.name)
    return groups.mapValues { rows in rows.count == 1 ? rows[0].value : .array(rows.map(\.value)) }
}

/// Native form state is owned explicitly by the host. Use from the UI thread.
/// Rules are native validations, not an implementation of HTML constraint validation.
@Observable public final class AWCFormState: Identifiable {
    public let id = UUID()
    public private(set) var validationMessages: [String: String] = [:]
    public private(set) var revision = 0
    public var onSubmit: (AWCFormSubmission) -> Void
    public var onInvalid: ([String: String]) -> Void
    public var onReset: ([String: AWCValue]) -> Void
    private struct Field {
        var name: String; var value: AWCValue; let initialValue: AWCValue
        var disabled: Bool; var rules: AWCFormRules
        var validator: ((AWCValue) -> String?)?; var reset: ((AWCValue) -> Void)?
    }
    private var fields: [String: Field] = [:]
    private var order: [String] = []
    public init(onSubmit: @escaping (AWCFormSubmission) -> Void = { _ in },
                onInvalid: @escaping ([String: String]) -> Void = { _ in },
                onReset: @escaping ([String: AWCValue]) -> Void = { _ in }) {
        self.onSubmit = onSubmit; self.onInvalid = onInvalid; self.onReset = onReset
    }
    public var entries: [AWCFormEntry] {
        order.compactMap { id in guard let field = fields[id], !field.disabled, !field.name.isEmpty else { return nil }
            return AWCFormEntry(id: id, name: field.name, value: field.value) }
    }
    public var values: [String: AWCValue] { awcFormValues(entries) }
    public func value(for id: String) -> AWCValue? { fields[id]?.value }
    public func initialValue(for id: String) -> AWCValue? { fields[id]?.initialValue }
    public func register(id: String, name: String, value: AWCValue, rules: AWCFormRules = .init(), disabled: Bool = false,
                         validator: ((AWCValue) -> String?)? = nil, onReset: ((AWCValue) -> Void)? = nil) {
        let initial = fields[id]?.initialValue ?? value
        if fields[id] == nil { order.append(id) }
        fields[id] = Field(name: name, value: value, initialValue: initial, disabled: disabled, rules: rules, validator: validator, reset: onReset)
        if disabled { validationMessages[id] = nil }; revision &+= 1
    }
    public func unregister(id: String) { fields[id] = nil; order.removeAll { $0 == id }; validationMessages[id] = nil; revision &+= 1 }
    public func setValue(_ value: AWCValue, for id: String) {
        guard var field = fields[id], field.value != value else { return }
        field.value = value; fields[id] = field; validationMessages[id] = nil; revision &+= 1
    }
    @discardableResult public func validate() -> Bool {
        var errors: [String: String] = [:]
        for id in order { guard let field = fields[id], !field.disabled else { continue }
            if let error = field.rules.validationMessage(for: field.value) ?? field.validator?(field.value) { errors[id] = error }
        }
        validationMessages = errors; return errors.isEmpty
    }
    @discardableResult public func submit(submitter: AWCNode? = nil) -> Bool {
        guard validate() else { onInvalid(validationMessages); return false }
        onSubmit(AWCFormSubmission(entries: entries, submitter: submitter)); return true
    }
    public func reset() {
        let resets = order.compactMap { id -> (String, AWCValue, ((AWCValue) -> Void)?)? in
            guard let field = fields[id] else { return nil }; return (id, field.initialValue, field.reset)
        }
        for (id, value, _) in resets { fields[id]?.value = value }
        validationMessages = [:]; revision &+= 1
        for (_, value, callback) in resets { callback?(value) }
        onReset(values)
    }
}

public enum AWCButtonActionResult: String, Sendable {
    case blocked, canceled, activated, navigated, navigationRejected, submitted, invalidForm, reset, noForm
}

/// Shared by the actual SwiftUI button and deterministic native contract checks.
public enum AWCButtonAction {
    @discardableResult public static func perform(node: AWCNode, form: AWCFormState? = nil,
        dispatcher: AWCEventDispatcher? = nil, router: AWCURLRouter,
        observe: (AWCEvent) -> Void = { _ in }, commitSelected: (Bool) -> Void) -> AWCButtonActionResult {
        let properties = node.properties
        func flag(_ key: String) -> Bool { properties[key]?.bool == true }
        guard !flag("disabled"), !flag("softDisabled"), !flag("loading") else { return .blocked }
        let toggles = flag("toggle"), next = toggles ? !flag("selected") : flag("selected")
        let href = properties["href"]?.string ?? "", target = properties["target"]?.string ?? "_self"
        let click = AWCEvent(name: "mdClick", tag: node.tag, nodeID: node.id,
                             detail: ["value": properties["value"] ?? .null, "toggle": .bool(toggles), "selected": .bool(next), "href": .string(href), "target": .string(target)])
        let context = dispatcher?.dispatch(click, cancelable: true) ?? AWCEventContext(event: click, cancelable: true)
        observe(context.observedEvent)
        guard !context.defaultPrevented else { return .canceled }
        if toggles {
            commitSelected(next)
            let change = AWCEvent(name: "mdChange", tag: node.tag, nodeID: node.id, detail: ["selected": .bool(next), "value": properties["value"] ?? .null])
            observe(dispatcher?.dispatch(change).observedEvent ?? change)
        }
        // Raw href presence makes this a link. Rejected/unsafe href must never
        // fall through into form submission/reset, matching the source guard.
        if !href.isEmpty { return router.route(href: href, target: target, nodeID: node.id) ? .navigated : .navigationRejected }
        switch properties["type"]?.string ?? "button" {
        case "submit": guard let form else { return .noForm }; return form.submit(submitter: node) ? .submitted : .invalidForm
        case "reset": guard let form else { return .noForm }; form.reset(); return .reset
        default: return .activated
        }
    }
}

public extension AWCNode {
    /// Named native children replace slot/query introspection; nil and "" mean the default slot.
    func children(inSlot slot: String? = nil, fallback: [AWCNode] = []) -> [AWCNode] {
        let assigned = children.filter { ($0.slot ?? "") == (slot ?? "") }
        return assigned.isEmpty ? fallback : assigned
    }
    func firstDescendant(id: String) -> AWCNode? {
        for child in children { if child.id == id { return child }; if let found = child.firstDescendant(id: id) { return found } }
        return nil
    }
    func descendants(tag: String) -> [AWCNode] {
        children.flatMap { child in (child.tag == tag ? [child] : []) + child.descendants(tag: tag) }
    }
}
