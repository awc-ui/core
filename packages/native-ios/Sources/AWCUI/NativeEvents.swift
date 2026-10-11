import Foundation

/// Describes how our native action API was entered, not a browser or raw OS event.
public struct AWCActivationMetadata: Equatable, Sendable {
    public enum Kind: String, Sendable { case nativeControl, programmatic, implicitSubmit }
    public let id: UUID
    public let kind: Kind
    public init(kind: Kind, id: UUID = UUID()) { self.id = id; self.kind = kind }
}
public enum AWCEventPhase: String, Sendable { case none, capture, target, bubble }
public struct AWCEventListener {
    public let capture: Bool
    public let handler: (AWCEventContext) -> Void
    public init(capture: Bool = false, handler: @escaping (AWCEventContext) -> Void) { self.capture = capture; self.handler = handler }
}

/// A synchronous, single-dispatch native event transaction. Finished contexts are immutable.
public final class AWCEventContext {
    public let event: AWCEvent
    public let cancelable: Bool
    public let bubbles: Bool
    public let crossesBoundaries: Bool
    public var targetID: String { event.nodeID }
    public var activation: AWCActivationMetadata? { event.activation }
    public private(set) var defaultPrevented = false
    public private(set) var propagationStopped = false
    public private(set) var immediatePropagationStopped = false
    public private(set) var currentScopeID: String?
    public private(set) var phase: AWCEventPhase = .none
    public private(set) var path: [String] = []
    private var finished = false
    public init(event: AWCEvent, cancelable: Bool = false, bubbles: Bool = true, crossesBoundaries: Bool = true) {
        self.event = event; self.cancelable = cancelable; self.bubbles = bubbles; self.crossesBoundaries = crossesBoundaries
    }
    public func preventDefault() { if cancelable && !finished { defaultPrevented = true } }
    public func stopPropagation() { if !finished { propagationStopped = true } }
    public func stopImmediatePropagation() { if !finished { immediatePropagationStopped = true; propagationStopped = true } }
    public var observedEvent: AWCEvent {
        var result = event; result.defaultPrevented = defaultPrevented; result.propagationPath = path; return result
    }
    fileprivate func enter(_ id: String, phase: AWCEventPhase) { currentScopeID = id; self.phase = phase }
    fileprivate func finish() { currentScopeID = nil; phase = .none; finished = true }
    fileprivate func setPath(_ value: [String]) { path = value }
}

/// Explicit scope ancestry. Default legacy handlers run during bubbling.
/// Scope lists and the target-first path are snapshotted before any listener runs.
public final class AWCEventDispatcher {
    public let id: String
    public let parent: AWCEventDispatcher?
    public let isBoundary: Bool
    private let listeners: [AWCEventListener]
    public init(id: String, parent: AWCEventDispatcher? = nil, isBoundary: Bool = false,
                onCapture: ((AWCEventContext) -> Void)? = nil, listeners: [AWCEventListener] = [],
                handler: @escaping (AWCEventContext) -> Void) {
        self.id = id; self.parent = parent; self.isBoundary = isBoundary
        self.listeners = (onCapture.map { [AWCEventListener(capture: true, handler: $0)] } ?? []) + listeners + [AWCEventListener(handler: handler)]
    }
    @discardableResult public func dispatch(_ event: AWCEvent, cancelable: Bool = false, bubbles: Bool = true,
                                            crossesBoundaries: Bool = true, targetListeners: [AWCEventListener] = []) -> AWCEventContext {
        Self.dispatch(event, through: self, cancelable: cancelable, bubbles: bubbles, crossesBoundaries: crossesBoundaries, targetListeners: targetListeners)
    }
    @discardableResult public static func dispatch(_ event: AWCEvent, through dispatcher: AWCEventDispatcher? = nil,
        cancelable: Bool = false, bubbles: Bool = true, crossesBoundaries: Bool = true,
        targetListeners: [AWCEventListener] = []) -> AWCEventContext {
        let context = AWCEventContext(event: event, cancelable: cancelable, bubbles: bubbles, crossesBoundaries: crossesBoundaries)
        var scopes: [AWCEventDispatcher] = []; var current = dispatcher
        while let scope = current {
            scopes.append(scope)
            if scope.isBoundary && !crossesBoundaries { break }
            current = scope.parent
        }
        context.setPath([event.nodeID] + scopes.map(\.id))
        defer { context.finish() }
        func invoke(_ listeners: [AWCEventListener], id: String, phase: AWCEventPhase) {
            context.enter(id, phase: phase)
            for listener in listeners {
                guard !context.immediatePropagationStopped else { break }
                listener.handler(context)
            }
        }
        for scope in scopes.reversed() {
            invoke(scope.listeners.filter(\.capture), id: scope.id, phase: .capture)
            if context.propagationStopped { return context }
        }
        invoke(targetListeners.filter(\.capture) + targetListeners.filter { !$0.capture }, id: event.nodeID, phase: .target)
        if bubbles && !context.propagationStopped {
            for scope in scopes {
                invoke(scope.listeners.filter { !$0.capture }, id: scope.id, phase: .bubble)
                if context.propagationStopped { break }
            }
        }
        return context
    }
}
