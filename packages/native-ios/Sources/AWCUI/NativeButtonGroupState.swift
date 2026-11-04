import Foundation
import Observation

/// Source-order identity and the previous *event* snapshot are independent of
/// values: duplicate/empty values must not collapse the selected child set.
@Observable final class AWCNativeButtonGroupState {
    private(set) var children: [AWCNode]
    private(set) var selected: [String: Bool]
    private var authored: [String: Bool]
    private var previousValues: [String]
    private(set) var injected: [String:[String:AWCValue]] = [:]
    private var initialInjectionDepth: [String:Int] = [:]
    func inject(_ values:[String:[String:AWCValue]],initialDepth:Int? = nil) {
        for (id,properties) in values {
            // Stencil loads descendants before the outer composite. SwiftUI's
            // appearance callbacks use the opposite order: retain the same
            // initial outer-wins result without delaying a visible frame.
            if let depth=initialDepth, let prior=initialInjectionDepth[id], prior<=depth {continue}
            injected[id]=properties; initialInjectionDepth[id]=initialDepth ?? Int.min
        }
    }
    var motionTarget: String?
    var motionStarted: Date?
    init(children: [AWCNode]) {
        self.children = children
        let values = Dictionary(children.map { ($0.id, $0.properties["selected"]?.bool == true) }, uniquingKeysWith: { _, last in last })
        selected = values; authored = values
        previousValues = children.filter { values[$0.id] == true }.map { $0.properties["value"]?.string ?? "" }
    }
    func update(children: [AWCNode]) {
        let next = Dictionary(children.map { ($0.id, $0.properties["selected"]?.bool == true) }, uniquingKeysWith: { _, last in last })
        selected = next.mapValues { $0 }.merging(selected.filter { next[$0.key] != nil && authored[$0.key] == next[$0.key] }) { _, old in old }
        authored = next; self.children = children
    }
    func commit(_ id: String, selected value: Bool) { guard selected[id] != nil else { return }; selected[id] = value }
    var selection: [Bool] { children.map { selected[$0.id] == true } }
    var values: [String] { children.filter { selected[$0.id] == true }.map { $0.properties["value"]?.string ?? "" } }
    func reconcile(_ id: String, multiple: Bool, required: Bool) -> AWCValue? {
        guard selected[id] != nil else { return nil }
        if !multiple { for child in children where child.id != id { selected[child.id] = false } }
        if required && !selected.values.contains(true) { selected[id] = true }
        let next = values, previousSet = Set(previousValues), nextSet = Set(next)
        let detail: AWCValue = ["values": .array(next.map(AWCValue.string)),
            "added": .array(next.filter { !previousSet.contains($0) }.map(AWCValue.string)),
            "removed": .array(previousValues.filter { !nextSet.contains($0) }.map(AWCValue.string))]
        previousValues = next
        return detail
    }
}

public enum AWCPreviewButtonGroupSelection {
    /// Applies only to authored button/icon-button descendants, in source order.
    public static func applying(_ selection: [Bool], to original: AWCNode) throws -> AWCNode {
        struct Invalid: LocalizedError { var errorDescription: String? { "Button group selection must match its authored child count." } }
        guard original.tag == "md-button-group", selection.count == descendants(original.children).count else { throw Invalid() }
        var index = 0
        func transform(_ input: AWCNode) -> AWCNode {
            var node = input
            if ["md-button", "md-icon-button"].contains(node.tag) { node.properties["selected"] = .bool(selection[index]); index += 1 }
            node.children = node.children.map(transform)
            return node
        }
        var result = original; result.children = result.children.map(transform); return result
    }
    static func descendants(_ nodes: [AWCNode]) -> [AWCNode] {
        nodes.flatMap { (["md-button", "md-icon-button"].contains($0.tag) ? [$0] : []) + descendants($0.children) }
    }
}
