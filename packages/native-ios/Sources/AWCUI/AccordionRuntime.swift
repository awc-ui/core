import SwiftUI
import Observation

/// Native counterparts of the item's toggle() and focusHeader() methods.
/// A controller addresses one retained item and never changes its owner policy.
public final class AWCAccordionItemController {
    private weak var item: AWCNativeAccordionItemState?
    public init() {}
    public var isConnected: Bool { item != nil }
    public var isExpanded: Bool { item?.expanded ?? false }
    public func toggle() { item?.toggle() }
    public func focusHeader() { item?.focusHeader() }
    func attach(_ item: AWCNativeAccordionItemState) { self.item = item }
    func detach(_ item: AWCNativeAccordionItemState) { if self.item === item { self.item = nil } }
}
private struct AWCAccordionControllersKey: EnvironmentKey {
    static let defaultValue: [String: AWCAccordionItemController] = [:]
}
extension EnvironmentValues {
    var awcAccordionControllers: [String: AWCAccordionItemController] {
        get { self[AWCAccordionControllersKey.self] }
        set { self[AWCAccordionControllersKey.self] = newValue }
    }
}
private struct AWCAccordionControllerModifier: ViewModifier {
    let id: String, controller: AWCAccordionItemController
    @Environment(\.awcAccordionControllers) private var inherited
    func body(content: Content) -> some View {
        var controllers = inherited; controllers[id] = controller
        return content.environment(\.awcAccordionControllers, controllers)
    }
}
public extension View {
    func awcAccordionItemController(_ controller: AWCAccordionItemController, for id: String) -> some View {
        modifier(AWCAccordionControllerModifier(id: id, controller: controller))
    }
}

extension AWCNativeAccordionItemState {
    convenience init(node: AWCNode) {
        let p = node.properties
        self.init(id: node.id, expanded: p["expanded"]?.bool ?? false, disabled: p["disabled"]?.bool ?? false,
                  headingLevel: Int(exactly: p["headingLevel"]?.number ?? 3) ?? 3,
                  regionRole: p["regionRole"]?.string ?? "region", collapsible: p["collapsible"]?.bool ?? true)
        hidden = p["hidden"]?.bool ?? false
    }
    func applyProperties(_ next: [String: AWCValue], previous: [String: AWCValue]) {
        // An unrelated authored edit must not overwrite a locally toggled item
        // or the presentation values installed by its direct parent.
        if next["disabled"] != previous["disabled"] { disabled = next["disabled"]?.bool ?? false }
        if next["headingLevel"] != previous["headingLevel"] { headingLevel = Int(exactly: next["headingLevel"]?.number ?? 3) ?? 3 }
        if next["regionRole"] != previous["regionRole"] { regionRole = next["regionRole"]?.string ?? "region" }
        if next["collapsible"] != previous["collapsible"] { collapsible = next["collapsible"]?.bool ?? true }
        if next["hidden"] != previous["hidden"] { hidden = next["hidden"]?.bool ?? false }
        if next["expanded"] != previous["expanded"] { setExpanded(next["expanded"]?.bool ?? false) }
    }
}

/// A SwiftUI render pass may recreate value Views many times. The runtime owns
/// identities, authored property snapshots and synchronous dispatch callbacks;
/// changing a headline must not recreate the item's state or body content.
@Observable final class AWCNativeAccordionRuntime {
    let state: AWCNativeAccordionState
    private(set) var node: AWCNode
    private(set) var items: [String: AWCNativeAccordionItemState] = [:]
    @ObservationIgnored private var ready = false
    @ObservationIgnored private var dispatcher: AWCEventDispatcher?
    @ObservationIgnored private var listeners: [AWCEventListener] = []
    @ObservationIgnored private var observe: (AWCEvent) -> Void = { _ in }
    @ObservationIgnored private(set) var childDispatcher: AWCEventDispatcher?

    init(node: AWCNode) {
        self.node = node; state = .init(configuration: .init(properties: node.properties))
        state.emit = { [weak self] name, detail in self?.emitParent(name, detail) }
        for child in node.children(inSlot: nil) where child.tag == "md-accordion-item" { items[child.id] = makeItem(child) }
        state.prepareForFirstRender(directItems(node))
    }
    private func makeItem(_ node: AWCNode) -> AWCNativeAccordionItemState {
        let item = AWCNativeAccordionItemState(node: node)
        item.emit = { [weak self, weak item] name, detail in
            guard let self, let item else { return false }
            let event = AWCEvent(name: name, tag: "md-accordion-item", nodeID: item.id, detail: detail)
            guard ready else { return false }
            observe(AWCEventDispatcher.dispatch(event, through: childDispatcher, cancelable: true, targetListeners: listeners).observedEvent)
            return false // Coordination already ran at the owning bubble scope.
        }
        return item
    }
    private func directItems(_ node: AWCNode) -> [AWCNativeAccordionItemState] {
        node.children(inSlot: nil).filter { $0.tag == "md-accordion-item" }.compactMap { items[$0.id] }
    }
    private func emitParent(_ name: String, _ detail: AWCValue) {
        let event = AWCEvent(name: name, tag: "md-accordion", nodeID: node.id, detail: detail)
        guard ready else { return }
        observe(AWCEventDispatcher.dispatch(event, through: dispatcher, cancelable: true, targetListeners: listeners).observedEvent)
    }
    func bind(dispatcher: AWCEventDispatcher?, listeners: [AWCEventListener], observe: @escaping (AWCEvent) -> Void) {
        self.dispatcher = dispatcher; self.listeners = listeners; self.observe = observe
        childDispatcher = AWCEventDispatcher(id: node.id, parent: dispatcher) { [weak self] event in
            guard let self, let item = items[event.targetID] else { return }
            state.receiveItemEvent(item, name: event.event.name, detail: event.event.detail)
        }
    }
    func appear() {
        guard !ready else { return }; ready = true
        // The first visual layout was prepared without mutating selection.
        // Commit it now, synchronously, through the real scope ancestry. A
        // stopped initial item event cannot accidentally emit a parent event.
        state.connect(directItems(node))
    }
    func update(_ next: AWCNode) {
        let previous = node
        let oldByID = Dictionary(previous.children.map { ($0.id, $0) }, uniquingKeysWith: { _, next in next })
        let direct = next.children(inSlot: nil).filter { $0.tag == "md-accordion-item" }
        for child in direct where items[child.id] == nil { items[child.id] = makeItem(child) }
        node = next
        state.update(.init(properties: next.properties))
        for child in direct {
            if let old = oldByID[child.id] { items[child.id]?.applyProperties(child.properties, previous: old.properties) }
        }
        let oldIDs = previous.children(inSlot: nil).filter { $0.tag == "md-accordion-item" }.map(\.id)
        if oldIDs != direct.map(\.id) { state.synchronize(directItems(next)) }
        items = items.filter { entry in direct.contains { $0.id == entry.key } }
    }
    var displayNodes: [AWCNode] {
        let children = node.children(inSlot: nil)
        let byID = Dictionary(children.map { ($0.id, $0) }, uniquingKeysWith: { _, next in next })
        var index = 0
        return children.map { child in
            guard child.tag == "md-accordion-item", state.items.indices.contains(index) else { return child }
            defer { index += 1 }; return byID[state.items[index].id] ?? child
        }
    }
    func disappear() { ready = false; state.disconnect() }
}
