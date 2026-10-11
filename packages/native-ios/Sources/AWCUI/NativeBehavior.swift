import Foundation
import Observation

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
    private let baseURLProvider: (() -> URL?)?
    public init(allowedSchemes: Set<String> = ["https", "http", "mailto", "tel", "sms", "ftp"], baseURL: URL? = nil, baseURLProvider: (() -> URL?)? = nil,
                handler: @escaping (AWCURLRequest) -> Bool) {
        self.allowedSchemes = Set(allowedSchemes.map { $0.lowercased() }); self.baseURL = baseURL; self.baseURLProvider = baseURLProvider; self.handler = handler
    }
    public func request(href: String, target: String = "_self", nodeID: String) -> AWCURLRequest? {
        guard !href.isEmpty, !href.unicodeScalars.contains(where: { $0.value < 32 || $0.value == 127 }) else { return nil }
        let trimmed = href.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, let url = URL(string: trimmed, relativeTo: baseURLProvider?() ?? baseURL)?.absoluteURL,
              let scheme = url.scheme?.lowercased(), allowedSchemes.contains(scheme),
              !["javascript", "vbscript", "data", "file"].contains(scheme) else { return nil }
        if ["https", "http", "ftp"].contains(scheme) && (url.host?.isEmpty != false) { return nil }
        if ["mailto", "tel", "sms"].contains(scheme) && url.absoluteString.dropFirst(scheme.count + 1).isEmpty { return nil }
        return AWCURLRequest(url: url, rawHref: href, target: target, nodeID: nodeID)
    }
    @discardableResult public func route(href: String, target: String = "_self", nodeID: String) -> Bool {
        guard let request = request(href: href, target: target, nodeID: nodeID) else { return false }
        return handler(request)
    }
}

public enum AWCButtonActionResult: String, Sendable {
    case blocked, canceled, activated, navigated, navigationRejected, submitted, invalidForm, reset, noForm
}

/// Shared by the actual SwiftUI button and deterministic native contract checks.
public enum AWCButtonAction {
    @discardableResult public static func perform(node: AWCNode, form: AWCFormState? = nil,
        dispatcher: AWCEventDispatcher? = nil, router: AWCURLRouter,
        targetListeners: [AWCEventListener] = [], activation: AWCActivationMetadata = .init(kind: .programmatic),
        observe: (AWCEvent) -> Void = { _ in }, commitSelected: (Bool) -> Void) -> AWCButtonActionResult {
        let properties = node.properties
        func flag(_ key: String) -> Bool { properties[key]?.bool == true }
        guard !flag("disabled"), !flag("softDisabled"), !flag("loading") else { return .blocked }
        let toggles = flag("toggle"), next = toggles ? !flag("selected") : flag("selected")
        let href = properties["href"]?.string ?? "", target = properties["target"]?.string ?? "_self"
        var click = AWCEvent(name: "mdClick", tag: node.tag, nodeID: node.id,
                             detail: ["value": properties["value"] ?? .null, "toggle": .bool(toggles), "selected": .bool(next), "href": .string(href), "target": .string(target)])
        click.activation = activation
        let context = AWCEventDispatcher.dispatch(click, through: dispatcher, cancelable: true, targetListeners: targetListeners)
        observe(context.observedEvent)
        guard !context.defaultPrevented else { return .canceled }
        if toggles {
            commitSelected(next)
            var change = AWCEvent(name: "mdChange", tag: node.tag, nodeID: node.id, detail: ["selected": .bool(next), "value": properties["value"] ?? .null])
            change.activation = activation
            observe(AWCEventDispatcher.dispatch(change, through: dispatcher, targetListeners: targetListeners).observedEvent)
        }
        // Raw href presence makes this a link. Rejected/unsafe href must never
        // fall through into form submission/reset, matching the source guard.
        if !href.isEmpty { return router.route(href: href, target: target, nodeID: node.id) ? .navigated : .navigationRejected }
        switch properties["type"]?.string ?? "button" {
        case "submit": guard let form else { return .noForm }; return form.submit(dispatcher: dispatcher, observe: observe) ? .submitted : form.lastActionCanceled ? .canceled : .invalidForm
        case "reset": guard let form else { return .noForm }; return form.reset(dispatcher: dispatcher, observe: observe) ? .reset : .canceled
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
