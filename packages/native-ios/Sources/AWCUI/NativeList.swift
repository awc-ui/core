import SwiftUI
import QuartzCore
#if canImport(AppKit)
import AppKit
#elseif canImport(UIKit)
import UIKit
#endif

// MARK: List model and runtime

/// md-list's property logic (md-list.tsx).
struct AWCListModel: Equatable {
    var listStyle = "standard", selectionMode = "none", interactionMode = "single-action", reorderable = false
    var label = "", labelledby = "", roleOverride = "", density: Double? = nil
    init(properties p: [String: AWCValue]) {
        listStyle = p["listStyle"]?.string == "segmented" ? "segmented" : "standard"
        selectionMode = ["single-select", "multi-select"].contains(p["selectionMode"]?.string ?? "") ? p["selectionMode"]!.string : "none"
        interactionMode = p["interactionMode"]?.string == "multi-action" ? "multi-action" : "single-action"
        reorderable = p["reorderable"]?.bool ?? false; label = p["label"]?.string ?? ""; labelledby = p["labelledby"]?.string ?? ""
        roleOverride = p["roleOverride"]?.string ?? ""; density = p["density"]?.number
    }
    func role(expandableRows: Bool) -> String {
        if !roleOverride.isEmpty { return roleOverride }
        return selectionMode != "none" && !expandableRows ? "listbox" : "list"
    }
}

/// Roving focus, selection and disclosure state owned by one md-list (the source keeps
/// it on the rows' reflected properties; native keeps one observable owner).
@Observable final class AWCListRuntime {
    var selection: Set<String> = []
    var activeID: String?
    var rovingVisibleID: String?
    var expanded: [String: Bool] = [:]
    var seeded = false
    @ObservationIgnored var focusRequests: [String: (Bool) -> Bool] = [:]
    @ObservationIgnored var emitList: (String, AWCValue) -> Void = { _, _ in }
    @ObservationIgnored var emitItem: (String, String, AWCValue) -> Void = { _, _, _ in }
    @ObservationIgnored var rows: [(id: String, label: String, focusable: Bool, expandable: Bool, node: AWCNode)] = []
    @ObservationIgnored var selectionMode = "none"
    @ObservationIgnored var typeahead = ""
    @ObservationIgnored var typeaheadTime = 0.0
    // Reorder: the displayed order (the source moves light-DOM rows), the live pointer drag and its ghost slot.
    var order: [String]? = nil
    var dragID: String? = nil
    var dragDelta = 0.0
    var dragTarget = 0
    var placeholder: AWCListPlaceholder? = nil
    @ObservationIgnored var reorderable = false
    @ObservationIgnored var authored: [String] = []
    @ObservationIgnored var frames: [String: CGRect] = [:]
    @ObservationIgnored var listFrame: CGRect = .zero
    @ObservationIgnored var dragRects: [(id: String, top: Double, height: Double, center: Double)] = []
    @ObservationIgnored var dragFrom = 0
    @ObservationIgnored var dragStartY = 0.0
    @ObservationIgnored var rowGap = 0.0
    /// Rows re-inserted by a reorder: their transitions restart from the new style (no animation).
    @ObservationIgnored var snapNext: Set<String> = []
    /// Bumped when a reorder re-inserts a row (its transitions restart from rest).
    var reinsertions: [String: Int] = [:]
    func ordered(_ items: [AWCNode]) -> [AWCNode] {
        guard let order, Set(order) == Set(items.map(\.id)), order.count == items.count else { return items }
        return order.compactMap { id in items.first { $0.id == id } }
    }
    /// Pointer down on a row's drag handle (startDrag).
    func beginDrag(_ id: String, y: Double) -> Bool {
        guard reorderable, dragID == nil, let from = rows.firstIndex(where: { $0.id == id }), rows[from].node.properties["disabled"]?.bool != true else { return false }
        dragRects = rows.map { r in let f = frames[r.id] ?? .zero; return (r.id, Double(f.minY), Double(f.height), Double(f.midY)) }
        rowGap = dragRects.count > 1 ? dragRects[1].top - dragRects[0].top : dragRects.first?.height ?? 0
        dragFrom = from; dragTarget = from; dragStartY = y; dragDelta = 0; dragID = id
        placeholder = .init(top: dragRects[from].top - Double(listFrame.minY), height: dragRects[from].height)
        return true
    }
    /// onDragMove: follow the pointer; the target is how many resting centres the row's centre crossed.
    func moveDrag(y: Double) {
        guard dragID != nil else { return }
        dragDelta = y - dragStartY
        let center = dragRects[dragFrom].center + dragDelta
        var target = dragFrom
        for (i, r) in dragRects.enumerated() where i != dragFrom {
            if i < dragFrom && center < r.center { target = min(target, i) }
            if i > dragFrom && center > r.center { target = max(target, i) }
        }
        if target != dragTarget { dragTarget = target; placeholder = .init(top: dragRects[target].top - Double(listFrame.minY), height: dragRects[dragFrom].height) }
    }
    /// applySiblingShifts: rows between the old and new slot slide one row-step.
    func shift(_ id: String) -> Double {
        guard dragID != nil, id != dragID, let i = dragRects.firstIndex(where: { $0.id == id }) else { return 0 }
        if dragFrom < dragTarget && i > dragFrom && i <= dragTarget { return -rowGap }
        if dragFrom > dragTarget && i < dragFrom && i >= dragTarget { return rowGap }
        return 0
    }
    @discardableResult func endDrag() -> Bool {
        guard let id = dragID else { return false }
        let from = dragFrom, to = dragTarget
        dragID = nil; dragDelta = 0; placeholder = nil; dragRects = []
        if to != from { snapNext.insert(id); reinsertions[id, default: 0] += 1; moveItem(from, to); return true }
        return false
    }
    /// Drops first-responder status from the row's focus surface (the moved DOM row loses focus).
    static func blurFocus(_ id: String) {
        MainActor.assumeIsolated {
            #if canImport(AppKit)
            for window in NSApp.windows { if let view = window.firstResponder as? AWCNativeButtonFocusView, view.accessibilityIdentifier() == id { window.makeFirstResponder(nil) } }
            #elseif canImport(UIKit)
            for scene in UIApplication.shared.connectedScenes { for window in (scene as? UIWindowScene)?.windows ?? [] { blur(window, id) } }
            #endif
        }
    }
    #if canImport(UIKit) && !canImport(AppKit)
    @MainActor private static func blur(_ view: UIView, _ id: String) {
        if let v = view as? AWCNativeButtonFocusView, v.isFirstResponder, v.configuration?.id == id { _ = v.resignFirstResponder(); return }
        for sub in view.subviews { blur(sub, id) }
    }
    #endif
    /// Alt+ArrowUp/Down on a focused row (ignored at the edges and on disabled rows).
    func keyReorder(_ id: String, up: Bool) -> Bool {
        guard reorderable, let from = rows.firstIndex(where: { $0.id == id }) else { return false }
        let to = up ? from - 1 : from + 1
        guard to >= 0, to < rows.count, rows[from].node.properties["disabled"]?.bool != true else { return true }
        snapNext.insert(id); reinsertions[id, default: 0] += 1; moveItem(from, to); return true
    }
    func moveItem(_ from: Int, _ to: Int) {
        var ids = rows.map(\.id); let moving = ids.remove(at: from); ids.insert(moving, at: to)
        order = ids
        emitList("mdReorder", ["from": .number(Double(from)), "to": .number(Double(to)), "order": .array(ids.map { .number(Double(authored.firstIndex(of: $0) ?? -1)) })])
    }
    func seed(_ items: [AWCNode], mode: String) {
        guard !seeded else { return }; seeded = true
        selection = Set(items.filter { $0.properties["selected"]?.bool == true && $0.properties["expandable"]?.bool != true }.map(\.id))
        for item in items { for child in item.children(inSlot: "expanded-content") where child.tag == "md-list-item" && child.properties["selected"]?.bool == true { selection.insert(child.id) } }
    }
    func isSelected(_ id: String, fallback: Bool) -> Bool { seeded ? selection.contains(id) : fallback }
    var focusableIDs: [String] { rows.filter(\.focusable).map(\.id) }
    /// Runs while the list body is evaluated: it writes only on a real change (an unconditional
    /// write to observed state from a body re-invalidates that body forever).
    func ensureActive() {
        let ids = focusableIDs
        if let a = activeID, ids.contains(a) { return }
        let next = rows.first(where: { $0.focusable && selection.contains($0.id) })?.id ?? ids.first
        if activeID != next { activeID = next }
    }
    /// Focus landed on `id` (pointer press, keyboard or method): `mdActivate` only on a change.
    func activate(_ id: String, emit: Bool = true, showRoving: Bool = false) {
        guard let index = rows.firstIndex(where: { $0.id == id }) else { return }
        let changed = activeID != id
        activeID = id; rovingVisibleID = showRoving ? id : nil
        if changed && emit { emitList("mdActivate", ["index": .number(Double(index)), "item": .string(id)]) }
    }
    /// List `activateItem(index, fromUserAction)` after a row click.
    func itemClicked(_ id: String) {
        guard let index = rows.firstIndex(where: { $0.id == id }), !rows[index].expandable else { return }
        let value = rows[index].label
        switch selectionMode {
        case "single-select":
            selection = selection.filter { s in !rows.contains { $0.id == s } }; selection.insert(id)
            emitList("mdSelect", ["index": .number(Double(index)), "value": .string(value), "selected": true, "item": .string(id)])
        case "multi-select":
            let next = !selection.contains(id); if next { selection.insert(id) } else { selection.remove(id) }
            emitList("mdSelect", ["index": .number(Double(index)), "value": .string(value), "selected": .bool(next), "item": .string(id)])
        default: break
        }
    }
    /// A row in an expandable parent's panel (the parent coordinates; the list reports the parent index).
    func childClicked(_ child: AWCNode, siblings: [AWCNode], parentID: String) {
        guard selectionMode != "none", let parent = rows.firstIndex(where: { $0.id == parentID }) else { return }
        let ids = siblings.map(\.id)
        if selectionMode == "single-select" { selection.subtract(ids); selection.insert(child.id) }
        else if selection.contains(child.id) { selection.remove(child.id) } else { selection.insert(child.id) }
        let childIndex = ids.firstIndex(of: child.id) ?? 0
        emitList("mdSelect", ["index": .number(Double(parent)), "childIndex": .number(Double(childIndex)), "expanded": .bool(expanded[parentID] ?? true),
                              "value": .string(AWCListRuntime.label(child)), "selected": .bool(selection.contains(child.id)), "item": .string(child.id)])
    }
    static func label(_ n: AWCNode) -> String {
        let h = n.properties["headline"]?.string ?? ""
        return h.isEmpty ? n.authoredTextContent.trimmingCharacters(in: .whitespacesAndNewlines) : h
    }
    func move(_ key: String, from id: String) -> Bool {
        let ids = focusableIDs; guard !ids.isEmpty else { return false }
        let at = ids.firstIndex(of: id) ?? 0
        let target: String
        switch key {
        case "ArrowDown": target = ids[(at + 1) % ids.count]
        case "ArrowUp": target = ids[(at - 1 + ids.count) % ids.count]
        case "Home": target = ids[0]
        case "End": target = ids[ids.count - 1]
        default: return false
        }
        focus(target)
        return true
    }
    func focus(_ id: String) {
        activate(id, showRoving: false)
        _ = focusRequests[id]?(true)
    }
    /// activateNext / activatePrevious.
    func step(_ d: Int) -> String? {
        let ids = focusableIDs; guard !ids.isEmpty else { return nil }
        let cur = activeID.flatMap { ids.firstIndex(of: $0) } ?? -1
        let next = d > 0 ? (cur < ids.count - 1 ? cur + 1 : 0) : (cur > 0 ? cur - 1 : ids.count - 1)
        focus(ids[next]); return ids[next]
    }
    /// selectItem(index): activateItem(index, fromUserAction: false).
    func selectSilently(_ index: Int) {
        guard selectionMode != "none", rows.indices.contains(index), !rows[index].expandable else { return }
        let id = rows[index].id
        if selectionMode == "single-select" { selection = selection.filter { s in !rows.contains { $0.id == s } }; selection.insert(id) }
        else if selection.contains(id) { selection.remove(id) } else { selection.insert(id) }
    }
    func selectedIndices() -> [Int] { rows.enumerated().filter { selection.contains($0.element.id) }.map(\.offset) }
    func typeaheadKey(_ key: String, from id: String) -> Bool {
        guard key.count == 1, let c = key.first, c.isLetter || c.isNumber else { return false }
        let now = CACurrentMediaTime() * 1000
        typeahead = now - typeaheadTime > 500 ? key.lowercased() : typeahead + key.lowercased(); typeaheadTime = now
        let ids = focusableIDs; guard !ids.isEmpty else { return true }
        let at = ids.firstIndex(of: id) ?? 0
        let order = typeahead.count == 1 ? Array(ids[(at + 1)...] + ids[...at]) : Array(ids[at...] + ids[..<at])
        if let hit = order.first(where: { t in rows.first { $0.id == t }?.label.lowercased().hasPrefix(typeahead) == true }) { focus(hit) }
        return true
    }
}

struct AWCListPlaceholder: Equatable { var top: Double, height: Double }

/// The drop-target ghost (`::part(drop-placeholder)`): glides between slots with the sibling shift.
struct AWCListPlaceholderView: View {
    let placeholder: AWCListPlaceholder, inset: Double, a: AWCListAppearance, part: AWCListPartAppearance?, tokens: [String: String], reduced: Bool
    @State private var track = AWCCSSTransitionTrack()
    @State private var primed = false
    var body: some View {
        let now = CACurrentMediaTime() * 1000
        TimelineView(.animation(paused: !track.isRunning(now))) { _ in
            let t = CACurrentMediaTime() * 1000, y = track.presented(t)
            let shape = AWCNativeCornerShape(corners: a.dropPlaceholderShape ?? .points(16))
            let fill = part?.backgroundColor ?? a.dropPlaceholderColor ?? AWCListItemStyle.mix(tokens["--md-sys-color-primary-container"] ?? "#EADDFF", 0.45)
            let outline = part?.borderColor ?? a.dropPlaceholderOutlineColor ?? AWCListItemStyle.mix(tokens["--md-sys-color-primary"] ?? "#6750A4", 0.55)
            let width = part?.borderWidth ?? a.dropPlaceholderOutlineWidth ?? 2
            shape.fill(Color(awcHex: fill))
                .overlay { shape.stroke(Color(awcHex: outline), style: StrokeStyle(lineWidth: width * 2, dash: [width * 3, width * 3])).clipShape(shape) }
                .opacity(part?.opacity ?? a.dropPlaceholderOpacity ?? 1)
                .frame(height: placeholder.height).padding(.horizontal, inset)
                .offset(y: y)
                .awcInspect(nodeID: "list", part: "drop-placeholder", name: "drop-placeholder") { _ in ["top": .number(y), "renderTime": .number(t)] }
        }
        .onChange(of: placeholder.top, initial: true) { _, top in
            if !primed { track.snap(top); primed = true; return }
            track.set(top, now: CACurrentMediaTime() * 1000, duration: reduced ? 0 : 200, curve: awcCSSCubicBezier(tokens["--md-sys-motion-easing-standard"]) ?? [0.2, 0, 0, 1])
        }
        .allowsHitTesting(false)
    }
}

// MARK: List renderer

struct AWCNativeListView: View {
    let node: AWCNode, theme: AWCTheme
    let emitList: (String, AWCValue) -> Void
    let emitItem: (String, String, AWCValue) -> Void
    let renderChild: (AWCNode) -> AnyView
    @State private var runtime = AWCListRuntime()
    @Environment(\.awcListAppearance) private var inheritedAppearance
    @Environment(\.awcListAppearanceTargets) private var appearanceTargets
    @Environment(\.awcNativeDensity) private var inheritedDensity
    @Environment(\.awcListSpacingRung) private var inheritedRung
    @Environment(\.awcNativeSpacingRung) private var spacingRung
    @Environment(\.awcListPlaceholderPart) private var placeholderPart
    @Environment(\.awcListControllers) private var controllers
    @Environment(\.awcListReducedMotion) private var reducedOverride
    @Environment(\.accessibilityReduceMotion) private var systemReduced
    private var model: AWCListModel { .init(properties: node.properties) }
    private var appearance: AWCListAppearance { inheritedAppearance.merging(appearanceTargets[node.id] ?? .init()) }
    var body: some View {
        let model = model, a = appearance
        let scale = AWCNativeDensity.resolve(model.density, inherited: inheritedDensity)
        let rung = (model.density ?? 0) <= -2 ? model.density! : (inheritedRung ?? spacingRung)
        let authoredItems = node.children.filter { $0.tag == "md-list-item" }
        let items = runtime.ordered(authoredItems)
        // Rows re-slot among themselves; interleaved dividers keep their positions.
        let display: [AWCNode] = { var k = 0; return node.children.filter { $0.tag != "#text" }.map { c in if c.tag == "md-list-item" { defer { k += 1 }; return items[k] }; return c } }()
        let segmented = model.listStyle == "segmented"
        let padBlock = a.paddingBlock ?? (segmented ? 0 : (rung <= -3 ? 4 : 8)), padInline = a.paddingInline ?? 0
        let shape = AWCNativeCornerShape(corners: a.containerShape ?? .points(0))
        let _ = configure(items, model: model)
        VStack(spacing: segmented ? (a.segmentedGap ?? 2) : 0) {
            if node.children.allSatisfy({ $0.tag == "#text" }) { Color.clear.frame(height: 0) }
            ForEach(display) { child in
                if child.tag == "md-list-item" {
                    let index = items.firstIndex { $0.id == child.id } ?? 0
                    AWCNativeListItemView(node: child, theme: theme, ctx: context(index: index, count: items.count, model: model, rung: rung), runtime: runtime,
                                          emitItem: emitItem, renderChild: renderChild)
                        // The lifted row paints above its siblings (z-index 1); the row's own zIndex sits inside its timeline.
                        .zIndex(runtime.dragID == child.id ? 1 : 0)
                } else { renderChild(child).accessibilityHidden(!["toolbar", "menu", "menubar", "listbox"].contains(model.roleOverride)) }
            }
        }
        .padding(.vertical, padBlock).padding(.horizontal, padInline)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(alignment: .topLeading) {
            if let ph = runtime.placeholder {
                AWCListPlaceholderView(placeholder: ph, inset: padInline, a: a, part: placeholderPart, tokens: theme.tokens, reduced: reducedOverride ?? systemReduced)
            }
        }
        .background(shape.fill(Color(awcHex: a.containerColor ?? "#00000000")))
        .onGeometryChange(for: CGRect.self) { $0.frame(in: .global) } action: { runtime.listFrame = $0 }
        .onChange(of: authoredItems.map(\.id)) { _, _ in runtime.order = nil }
        .environment(\.awcNativeDensity, scale)
        .environment(\.awcListSpacingRung, rung)
        .awcInspect(nodeID: node.id, name: "md-list") { _ in
            ["role": .string(model.role(expandableRows: items.contains { $0.properties["expandable"]?.bool == true })),
             "activeID": .string(runtime.activeID ?? ""), "selection": .array(runtime.selection.sorted().map { .string($0) }),
             "padding": .array([.number(padBlock), .number(padInline), .number(padBlock), .number(padInline)]), "paddingBlockInline": .array([.number(padBlock), .number(padInline)]),
             "gap": .object(["row": .number(segmented ? (a.segmentedGap ?? 2) : 0), "column": .number(0)]), "contentGap": .number(segmented ? (a.segmentedGap ?? 2) : 0)]
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel(model.label)
    }
    private func configure(_ items: [AWCNode], model: AWCListModel) {
        runtime.emitList = emitList; runtime.emitItem = emitItem; runtime.selectionMode = model.selectionMode
        controllers[node.id]?.runtime = runtime
        runtime.reorderable = model.reorderable; runtime.authored = node.children.filter { $0.tag == "md-list-item" }.map(\.id)
        runtime.seed(items, mode: model.selectionMode)
        let inSelection = model.selectionMode != "none"
        runtime.rows = items.map { item in
            let m = AWCListItemModel(properties: item.properties)
            let participates = inSelection && !m.expandable
            let interactive = !m.disabled && (m.type != "text" || inSelection || m.expandable)
            let expandableOnly = m.expandable && !participates && m.type == "text"
            let focusable = !m.hidden && ((interactive && !expandableOnly) || model.reorderable)
            return (item.id, AWCListRuntime.label(item), focusable, m.expandable, item)
        }
        runtime.ensureActive()
    }
    private func context(index: Int, count: Int, model: AWCListModel, rung: Double) -> AWCListItemContext {
        var c = AWCListItemContext()
        c.listStyle = model.listStyle; c.selectionMode = model.selectionMode; c.interactionMode = model.interactionMode
        c.containerRole = model.role(expandableRows: false); c.reorderable = model.reorderable; c.hostList = true
        c.first = index == 0; c.last = index == count - 1; c.index = index; c.count = count; c.spacingRung = rung; c.runtime = runtime
        return c
    }
}

extension AWCNativeView {
    /// md-list: the dedicated renderer; md-list-item children render through it.
    var nativeList: some View {
        AWCNativeListView(node: node, theme: theme, emitList: { name, detail in emit(name, detail) },
                          emitItem: { id, name, detail in emitItem(id, name, detail) }, renderChild: { child($0) })
    }
    /// A standalone md-list-item (no hosting list: 24px icons, `listitem`, no roving).
    var nativeListItem: some View {
        AWCNativeListItemView(node: node, theme: theme, ctx: nil, runtime: nil, emitItem: { id, name, detail in emitItem(id, name, detail) }, renderChild: { child($0) })
    }
    func emitItem(_ id: String, _ name: String, _ detail: AWCValue) {
        let event = AWCEvent(name: name, tag: "md-list-item", nodeID: id, detail: detail)
        onEvent(AWCEventDispatcher.dispatch(event, through: eventDispatcher, targetListeners: eventTargetListeners).observedEvent)
    }
}
