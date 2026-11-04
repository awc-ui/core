import SwiftUI
import Observation

@Observable final class AWCNativeSegmentedState {
    private(set) var selected: [String: Bool] = [:]
    private var authored: [String: Bool] = [:]
    private(set) var injected: [String: [String: AWCValue]] = [:]
    private var initialDepth: [String: Int] = [:]
    @ObservationIgnored var handles: [String: AWCButtonFocusHandle] = [:]
    @ObservationIgnored var actions: [String: () -> Void] = [:]
    init(_ nodes: [AWCNode]) { synchronize(nodes) }
    func synchronize(_ nodes: [AWCNode], prune: Bool = false) {
        if prune {
            let ids=Set(nodes.map(\.id))
            selected=selected.filter{ids.contains($0.key)};authored=authored.filter{ids.contains($0.key)}
            injected=injected.filter{ids.contains($0.key)};initialDepth=initialDepth.filter{ids.contains($0.key)}
            handles=handles.filter{ids.contains($0.key)};actions=actions.filter{ids.contains($0.key)}
        }
        for node in nodes {
            let next = node.properties["selected"]?.bool == true
            if authored[node.id] == nil || authored[node.id] != next { selected[node.id] = next }
            authored[node.id] = next
        }
    }
    func inject(_ nodes: [AWCNode], density: Double, multiple: Bool, depth: Int? = nil) {
        for (index, node) in nodes.enumerated() {
            if let depth, let prior = initialDepth[node.id], prior <= depth { continue }
            injected[node.id] = ["segmentIndex": .number(Double(index)), "segmentTotal": .number(Double(nodes.count)),
                                 "segmentDensity": .number(density), "segmentMultiselect": .bool(multiple)]
            initialDepth[node.id] = depth ?? Int.min
        }
    }
    func commit(_ id: String, proposed: Bool, nodes: [AWCNode], multiple: Bool) -> [String] {
        if multiple { selected[id] = proposed }
        else { for node in nodes { selected[node.id] = node.id == id } }
        return nodes.filter { selected[$0.id] == true }.map { $0.properties["value"]?.string ?? "" }
    }
}
struct AWCNativeSegmentedContext {
    let state: AWCNativeSegmentedState
    let nodes: [AWCNode]
    let depth: Int
    func move(_ key: String, from id: String, multiple: Bool) -> Bool {
        guard ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].contains(key) else { return false }
        let eligible = nodes.filter { $0.properties["disabled"]?.bool != true }
        guard let current = eligible.firstIndex(where: { $0.id == id }), !eligible.isEmpty else { return true }
        let forward = key == "ArrowRight" || key == "ArrowDown"
        let next = eligible[(current + (forward ? 1 : -1) + eligible.count) % eligible.count].id
        _ = state.handles[next]?.requestFocus?()
        if !multiple { state.actions[next]?() }
        return true
    }
}
private struct AWCSegmentedContextKey: EnvironmentKey { static let defaultValue: AWCNativeSegmentedContext? = nil }
extension EnvironmentValues {
    var awcNativeSegmentedContext: AWCNativeSegmentedContext? {
        get { self[AWCSegmentedContextKey.self] } set { self[AWCSegmentedContextKey.self] = newValue }
    }
}
func awcSegmentedDescendants(_ nodes: [AWCNode]) -> [AWCNode] {
    nodes.flatMap { ($0.tag == "md-segmented-button" ? [$0] : []) + awcSegmentedDescendants($0.children) }
}
private struct AWCSegmentedSelectionPreference: PreferenceKey {
    static var defaultValue: [String: [Bool]] = [:]
    static func reduce(value: inout [String: [Bool]], nextValue: () -> [String: [Bool]]) { value.merge(nextValue()) { _, new in new } }
}
public extension View {
    /// Actual child state in authored order; values need not be unique or nonempty.
    func awcSegmentedSelection(rootID: String, onChange: @escaping ([Bool]) -> Void) -> some View {
        onPreferenceChange(AWCSegmentedSelectionPreference.self) { if let selection = $0[rootID] { onChange(selection) } }
    }
}
struct AWCSegmentedLeadingMargin: LayoutValueKey { static let defaultValue: CGFloat = 0 }
struct AWCNativeSegmentedSetLayout: Layout {
    let rtl: Bool
    private func tracks(width: CGFloat, subviews: Subviews) -> [CGFloat] {
        // Grid 1fr tracks retain each item's padding minimum (including the
        // final negative seam margin), even when those tracks overflow the set.
        let minimum = subviews.map { max(0, $0.sizeThatFits(.init(width: 0, height: nil)).width + $0[AWCSegmentedLeadingMargin.self]) }
        var result = minimum, flexible = Set(subviews.indices), remaining = width
        while !flexible.isEmpty {
            let share = remaining / CGFloat(flexible.count)
            let frozen = flexible.filter { minimum[$0] > share }
            if frozen.isEmpty { for index in flexible { result[index] = max(0, share) }; break }
            for index in frozen { remaining -= minimum[index]; flexible.remove(index) }
        }
        return result
    }
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let track = subviews.map { $0.sizeThatFits(.unspecified).width + $0[AWCSegmentedLeadingMargin.self] }.max() ?? 0
        let natural = track * CGFloat(subviews.count)
        let width = min(natural, proposal.width ?? natural)
        let columns = tracks(width: width, subviews: subviews)
        let height = subviews.indices.map { subviews[$0].sizeThatFits(.init(width: columns[$0] - subviews[$0][AWCSegmentedLeadingMargin.self], height: nil)).height }.max() ?? 0
        return .init(width: width, height: height)
    }
    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        guard !subviews.isEmpty else { return }
        let columns = tracks(width: bounds.width, subviews: subviews)
        var offset: CGFloat = 0
        for index in subviews.indices {
            let margin = subviews[index][AWCSegmentedLeadingMargin.self], width = columns[index] - margin
            let x = rtl ? bounds.maxX - offset - columns[index] : bounds.minX + offset + margin
            offset += columns[index]
            subviews[index].place(at: .init(x: x, y: bounds.minY), anchor: .topLeading, proposal: .init(width: width, height: bounds.height))
        }
    }
}
struct AWCNativeSegmentedSet: View {
    let node: AWCNode
    let onEvent: (AWCEvent) -> Void
    @State private var owned: AWCNativeSegmentedState
    @Environment(\.awcNativeSegmentedContext) private var parent
    @Environment(\.awcEventDispatcher) private var dispatcher
    @Environment(\.awcEventTargetListeners) private var listeners
    @Environment(\.layoutDirection) private var inheritedDirection
    init(node: AWCNode, onEvent: @escaping (AWCEvent) -> Void) {
        self.node = node; self.onEvent = onEvent; _owned = State(initialValue: .init(awcSegmentedDescendants(node.children)))
    }
    private var state: AWCNativeSegmentedState { parent?.state ?? owned }
    private var nodes: [AWCNode] { awcSegmentedDescendants(node.children) }
    private var multiple: Bool { node.properties["multiselect"]?.bool == true }
    private var direction: LayoutDirection { node.properties["dir"]?.string == "rtl" ? .rightToLeft : node.properties["dir"]?.string == "ltr" ? .leftToRight : inheritedDirection }
    private func sync(initial: Bool) {
        state.synchronize(nodes,prune:parent == nil)
        state.inject(nodes, density: node.properties["density"]?.number ?? 0, multiple: multiple, depth: initial ? (parent?.depth ?? -1) + 1 : nil)
    }
    var body: some View {
        if node.properties["hidden"]?.bool != true {
            let context = AWCNativeSegmentedContext(state: state, nodes: nodes, depth: (parent?.depth ?? -1) + 1)
            let boundary = AWCEventDispatcher(id: node.id, parent: dispatcher) { event in
                guard event.event.name == "mdSegmentClick", nodes.contains(where: { $0.id == event.targetID }) else { return }
                event.stopPropagation()
                let selected = event.event.detail.object["selected"]?.bool == true
                let values = state.commit(event.targetID, proposed: selected, nodes: nodes, multiple: multiple)
                let changed = AWCEvent(name: "mdChange", tag: node.tag, nodeID: node.id, detail: .array(values.map(AWCValue.string)))
                onEvent(AWCEventDispatcher.dispatch(changed, through: dispatcher, cancelable: true, targetListeners: listeners).observedEvent)
            }
            AWCNativeSegmentedSetLayout(rtl: direction == .rightToLeft) {
                ForEach(node.children) { child in
                    let injected = state.injected[child.id] ?? [:]
                    let index = injected["segmentIndex"]?.number ?? child.properties["segmentIndex"]?.number ?? 0
                    let total = injected["segmentTotal"]?.number ?? child.properties["segmentTotal"]?.number ?? 1
                    AWCNativeView(node: child, onEvent: { if $0.name != "mdSegmentClick" { onEvent($0) } })
                        .environment(\.layoutDirection, direction)
                        .layoutValue(key: AWCSegmentedLeadingMargin.self, value: child.tag == "md-segmented-button" && index != 0 && index == total - 1 ? -1 : 0)
                        .awcInspect(nodeID:node.id,part:"child.\(child.id)",name:child.tag)
                }
            }.environment(\.layoutDirection, .leftToRight)
                .environment(\.awcNativeSegmentedContext, context)
                .environment(\.awcEventDispatcher, boundary)
                .accessibilityElement(children: .contain)
                .accessibilityLabel(node.properties["aria-label"]?.string ?? "")
                .preference(key: AWCSegmentedSelectionPreference.self, value: [node.id: nodes.map { state.selected[$0.id] == true }])
                .awcInspect(nodeID: node.id, name: node.tag) { _ in ["padding":[0,0,0,0],"margin":[0,0,0,0],"border":[0,0,0,0],"gap":["row":0,"column":0],"display":"SwiftUI equal-column Layout","direction":.string(direction == .rightToLeft ? "rtl":"ltr")] }
                .onAppear { sync(initial: true) }
                .onChange(of: node.children) { previous, _ in
                    state.synchronize(nodes,prune:parent == nil)
                    if awcSegmentedDescendants(previous).map(\.id) != nodes.map(\.id) { sync(initial: false) }
                }
                .onChange(of: node.properties) { old, new in
                    if old["density"] != new["density"] || old["multiselect"] != new["multiselect"] { sync(initial: false) }
                }
        }
    }
}
