import Foundation
import Observation

public struct AWCNavigationContext: Identifiable, Equatable, Sendable {
    public let id: String
    public let name: String?
    public let parentID: String?
    public fileprivate(set) var history: [URL]
    public fileprivate(set) var historyIndex: Int
    public var currentURL: URL { history[historyIndex] }
    public var canGoBack: Bool { historyIndex > 0 }
}
public struct AWCNavigationTransition: Sendable {
    public enum Kind: String, Sendable { case navigate, back }
    public let kind: Kind
    public let sourceID: String
    public let destinationID: String
    public let url: URL
    public let target: String
    public let createsContext: Bool
    public let nodeID: String
}

/// Local presentation state. No method opens an application or performs network I/O.
@Observable public final class AWCNavigationCoordinator {
    public let rootID: String
    public let allowedSchemes: Set<String>
    public private(set) var contexts: [AWCNavigationContext]
    public private(set) var activeContextID: String
    /// Preflight veto runs before state/history changes. Presentation observes committed state.
    public var shouldNavigate: (AWCNavigationTransition) -> Bool = { _ in true }
    public var onPresent: (AWCNavigationTransition) -> Void
    private var transactionActive = false
    public init(baseURL: URL, rootID: String = "root", allowedSchemes: Set<String> = ["https", "http", "mailto", "tel", "sms", "ftp"],
                onPresent: @escaping (AWCNavigationTransition) -> Void = { _ in }) {
        self.rootID = rootID; self.allowedSchemes = Set(allowedSchemes.map { $0.lowercased() }); self.onPresent = onPresent
        contexts = [AWCNavigationContext(id: rootID, name: nil, parentID: nil, history: [baseURL], historyIndex: 0)]
        activeContextID = rootID
    }
    public func context(id: String) -> AWCNavigationContext? { contexts.first { $0.id == id } }
    public func context(named name: String) -> AWCNavigationContext? { contexts.first { $0.name == name } }
    /// Native owners explicitly create embedded contexts. IDs/names stay local to this coordinator.
    @discardableResult public func createContext(id: String = UUID().uuidString, name: String? = nil, parentID: String? = nil, url: URL? = nil) -> String? {
        guard !transactionActive, !id.isEmpty, context(id: id) == nil,
              name == nil || (validName(name!) && context(named: name!) == nil) else { return nil }
        let parent = parentID ?? rootID
        guard let owner = context(id: parent) else { return nil }
        let url = url ?? owner.currentURL
        guard let request = safeRequest(href: url.absoluteString, target: "_self", nodeID: "", from: parent) else { return nil }
        contexts.append(AWCNavigationContext(id: id, name: name, parentID: parent, history: [request.url], historyIndex: 0)); return id
    }
    private func validName(_ name: String) -> Bool {
        !name.isEmpty && !name.hasPrefix("_") && !name.unicodeScalars.contains { $0.value <= 32 || $0.value == 127 }
    }
    private func safeRequest(href: String, target: String, nodeID: String, from sourceID: String) -> AWCURLRequest? {
        guard let source = context(id: sourceID) else { return nil }
        return AWCURLRouter(allowedSchemes: allowedSchemes, baseURL: source.currentURL) { _ in false }.request(href: href, target: target, nodeID: nodeID)
    }
    /// Resolve against the current source URL on every action, even if this router is retained.
    public func router(from sourceID: String) -> AWCURLRouter {
        AWCURLRouter(allowedSchemes: allowedSchemes, baseURLProvider: { [weak self] in self?.context(id: sourceID)?.currentURL }) { [weak self] request in
            self?.navigate(href: request.rawHref, target: request.target, from: sourceID, nodeID: request.nodeID) ?? false
        }
    }
    @discardableResult public func navigate(href: String, target: String = "_self", from sourceID: String? = nil, nodeID: String = "") -> Bool {
        let sourceID = sourceID ?? activeContextID
        guard !transactionActive, let source = context(id: sourceID), let request = safeRequest(href: href, target: target, nodeID: nodeID, from: sourceID) else { return false }
        let target = target.isEmpty ? "_self" : target
        var destination: AWCNavigationContext?
        var name: String?
        switch target.lowercased() {
        case "_self": destination = source
        case "_parent": destination = context(id: source.parentID ?? source.id)
        case "_top":
            var ancestor = source
            while let parent = ancestor.parentID, let context = context(id: parent) { ancestor = context }
            destination = ancestor
        case "_blank": break
        default: guard validName(target) else { return false }; name = target; destination = context(named: target)
        }
        let creates = destination == nil, destinationID = destination?.id ?? UUID().uuidString
        let transition = AWCNavigationTransition(kind: .navigate, sourceID: sourceID, destinationID: destinationID, url: request.url, target: target, createsContext: creates, nodeID: nodeID)
        transactionActive = true; defer { transactionActive = false }
        guard shouldNavigate(transition) else { return false }
        if var existing = destination, let index = contexts.firstIndex(where: { $0.id == destinationID }) {
            existing.history = Array(existing.history.prefix(existing.historyIndex + 1)) + [request.url]
            existing.historyIndex = existing.history.count - 1; contexts[index] = existing
        } else {
            // New tabs/windows are native top-level contexts, not children of an opener.
            contexts.append(AWCNavigationContext(id: destinationID, name: name, parentID: nil, history: [request.url], historyIndex: 0))
        }
        activeContextID = destinationID; onPresent(transition); return true
    }
    @discardableResult public func back(in contextID: String? = nil) -> Bool {
        let id = contextID ?? activeContextID
        guard !transactionActive, var context = context(id: id), context.canGoBack,
              let index = contexts.firstIndex(where: { $0.id == id }) else { return false }
        let transition = AWCNavigationTransition(kind: .back, sourceID: id, destinationID: id, url: context.history[context.historyIndex - 1], target: "_self", createsContext: false, nodeID: "")
        transactionActive = true; defer { transactionActive = false }
        guard shouldNavigate(transition) else { return false }
        context.historyIndex -= 1; contexts[index] = context; activeContextID = id; onPresent(transition); return true
    }
}
