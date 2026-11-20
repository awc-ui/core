import Foundation
import Observation

/// Retained item identity is independent of its current display index. In
/// particular, collapsing a panel must never discard this state or its content.
@Observable final class AWCNativeAccordionItemState {
    let id: String
    private(set) var expanded: Bool
    var disabled: Bool
    var headingLevel: Int
    var regionRole: String
    var collapsible: Bool
    /// `hidden` (`display: none`): still a coordinated item, but not rendered or focusable.
    var hidden = false
    private(set) var index = -1
    private(set) var hasChassisHandle = false
    @ObservationIgnored weak var owner: AWCNativeAccordionState?
    @ObservationIgnored private var authored: (heading: Int, region: String, collapsible: Bool)?
    /// Returns whether the item event reaches its owning accordion. Cancelling
    /// a default does not undo the item mutation; stopping propagation can keep
    /// the parent's coordination listener from receiving it.
    @ObservationIgnored var emit: (String, AWCValue) -> Bool = { _, _ in true }
    @ObservationIgnored var requestFocus: () -> Void = {}

    init(id: String, expanded: Bool = false, disabled: Bool = false,
         headingLevel: Int = 3, regionRole: String = "region", collapsible: Bool = true) {
        self.id = id; self.expanded = expanded; self.disabled = disabled
        self.headingLevel = headingLevel; self.regionRole = regionRole; self.collapsible = collapsible
    }
    var toggleBlocked: Bool { disabled || (expanded && !collapsible) }
    func toggle() { if !toggleBlocked { setExpanded(!expanded) } }
    func focusHeader() { if !disabled && !hidden { requestFocus() } }
    /// A direct property update intentionally bypasses the activation guard,
    /// exactly like assigning the Web item's mutable expanded property.
    func setExpanded(_ value: Bool) {
        guard expanded != value else { return }
        expanded = value
        let receiver = owner, eventIndex = index
        if emit("mdItemToggle", ["expanded": .bool(value), "index": .number(Double(eventIndex))]) {
            receiver?.itemToggled(self, expanded: value, index: eventIndex)
        }
    }
    @discardableResult func key(_ key: String, alt: Bool = false) -> Bool {
        guard !disabled else { return false }
        let receiver = owner, from = index
        if alt && (key == "ArrowUp" || key == "ArrowDown") {
            let direction = key == "ArrowUp" ? "up" : "down"
            if emit("mdItemRequestReorder", ["direction": .string(direction), "from": .number(Double(from))]) {
                receiver?.keyboardReorder(self, direction: direction, from: from)
            }
            return true
        }
        if key == "Enter" || key == " " { toggle(); return true }
        let direction: String
        switch key {
        case "ArrowDown": direction = "next"
        case "ArrowUp": direction = "prev"
        case "Home": direction = "first"
        case "End": direction = "last"
        default: return false
        }
        if emit("mdItemRequestFocus", ["direction": .string(direction), "from": .number(Double(from))]) {
            receiver?.navigate(self, direction: direction, from: from)
        }
        return true
    }
    fileprivate func claim(_ owner: AWCNativeAccordionState, index: Int) {
        if authored == nil { authored = (headingLevel, regionRole, collapsible) }
        self.owner = owner; self.index = index
        hasChassisHandle = owner.configuration.floating && index == 0
    }
    fileprivate func release(_ owner: AWCNativeAccordionState) {
        guard self.owner === owner else { return }
        if let authored { headingLevel = authored.heading; regionRole = authored.region; collapsible = authored.collapsible }
        authored = nil; self.owner = nil; index = -1; hasChassisHandle = false
    }
}

struct AWCNativeAccordionConfiguration: Equatable {
    var variant = "filled", density = 0.0, elevation = 0
    var reorderable = false, floating = false
    var initialX = 24.0, initialY = 24.0, bringToFront = true
    var exclusive = false, keepOneExpanded = false, headingLevel = 3
    var region = "auto", regionThreshold = 6.0, transition = "expressive", defaultExpanded = ""

}
extension AWCNativeAccordionConfiguration {
    init(properties p: [String: AWCValue]) {
        func number(_ key: String, _ fallback: Double) -> Double { p[key]?.number.flatMap { $0.isFinite ? $0 : nil } ?? fallback }
        func integer(_ key: String, _ fallback: Int) -> Int { Int(exactly: number(key, Double(fallback))) ?? fallback }
        variant = p["variant"]?.string ?? "filled"; density = number("density", 0); elevation = integer("elevation", 0)
        reorderable = p["reorderable"]?.bool ?? false; floating = p["floating"]?.bool ?? false
        initialX = number("initialX", 24); initialY = number("initialY", 24); bringToFront = p["bringToFront"]?.bool ?? true
        exclusive = p["exclusive"]?.bool ?? false; keepOneExpanded = p["keepOneExpanded"]?.bool ?? false
        headingLevel = integer("headingLevel", 3); region = p["region"]?.string ?? "auto"; regionThreshold = number("regionThreshold", 6)
        transition = p["transition"]?.string ?? "expressive"; defaultExpanded = p["defaultExpanded"]?.string ?? ""
    }
}
struct AWCNativeAccordionItemRect: Equatable { var top: Double; var height: Double }
struct AWCNativeAccordionPlaceholder: Equatable { var top: Double; var height: Double }
private struct AWCNativeAccordionReorder {
    var item: AWCNativeAccordionItemState
    var pointer: Int, from: Int, target: Int
    var startY: Double, hostTop: Double, distance: Double
    var rects: [AWCNativeAccordionItemRect]
}
private struct AWCNativeAccordionChassisDrag {
    var pointer: Int
    var clientX: Double, clientY: Double, x: Double, y: Double
}

/// Source orchestration, without dependence on SwiftUI mount order or pixels.
/// Only direct children are supplied by the renderer; nested groups have their
/// own instance. Coordinates are physical viewport points, including in RTL.
@Observable final class AWCNativeAccordionState {
    private(set) var configuration: AWCNativeAccordionConfiguration
    private(set) var items: [AWCNativeAccordionItemState] = []
    private(set) var x = 0.0
    private(set) var y = 0.0
    private(set) var zIndex: Int?
    private(set) var chassisDragging = false
    private(set) var dropPlaceholder: AWCNativeAccordionPlaceholder?
    private(set) var draggedItemID: String?
    private(set) var draggedOffset = 0.0
    private(set) var siblingOffsets: [String: Double] = [:]
    private(set) var initialPresentation: [String: Bool]?
    @ObservationIgnored var emit: (String, AWCValue) -> Void = { _, _ in }
    @ObservationIgnored private var originalOrder: [AWCNativeAccordionItemState] = []
    @ObservationIgnored private(set) var loaded = false
    @ObservationIgnored private var connected = false
    @ObservationIgnored private var reorder: AWCNativeAccordionReorder?
    @ObservationIgnored private var chassis: AWCNativeAccordionChassisDrag?
    private static var floatingZ = 1000
    /// Load-time bring-to-front follows source document order (componentDidLoad order), not
    /// SwiftUI's sibling onAppear order: raises connected in one pass are applied together,
    /// sorted by first render.
    @ObservationIgnored private var renderOrder: Int?
    @ObservationIgnored private var loadZ: Int?
    private static var nextRenderOrder = 0
    private static var pendingRaises: [AWCNativeAccordionState] = []

    init(configuration: AWCNativeAccordionConfiguration = .init()) { self.configuration = configuration }
    var expandedIndices: [Int] { items.indices.filter { items[$0].expanded } }
    var originalIndices: [Int] { items.map { item in originalOrder.firstIndex { $0 === item } ?? -1 } }
    private func owns(_ item: AWCNativeAccordionItemState) -> Bool { item.owner === self && items.contains { $0 === item } }

    private func initialTargets() -> Set<Int> {
        var targets = Set(items.indices.filter { items[$0].expanded || Self.defaultIndices(configuration.defaultExpanded).contains($0) })
        if configuration.exclusive, let first = targets.min() { targets = [first] }
        if configuration.keepOneExpanded && targets.isEmpty, let first = items.firstIndex(where: { !$0.disabled }) { targets.insert(first) }
        return targets
    }
    /// Establish direct-owner layout before the first paint without committing
    /// selection or emitting events before native event scopes are attached.
    func prepareForFirstRender(_ children: [AWCNativeAccordionItemState]) {
        guard !loaded else { return }
        synchronize(children)
        let targets = initialTargets()
        initialPresentation = Dictionary(items.enumerated().map { ($0.element.id, targets.contains($0.offset)) }, uniquingKeysWith: { _, next in next })
    }
    func renderedExpanded(_ item: AWCNativeAccordionItemState) -> Bool { initialPresentation?[item.id] ?? item.expanded }

    func connect(_ children: [AWCNativeAccordionItemState]) {
        connected = true
        synchronize(children)
        guard !loaded else { return }
        loaded = true
        let targets = initialTargets()
        for (index, item) in items.enumerated() { item.setExpanded(targets.contains(index)) }
        synchronizePresentation()
        if configuration.floating {
            x = configuration.initialX; y = configuration.initialY
            if configuration.bringToFront { raiseOnLoad() }
        }
        initialPresentation = nil
    }
    func synchronize(_ children: [AWCNativeAccordionItemState]) {
        precondition(Set(children.map(ObjectIdentifier.init)).count == children.count, "An accordion item may occur only once in a group")
        let changed = items.count != children.count || zip(items, children).contains { $0 !== $1 }
        if changed { cancelReorder() }
        for item in items where !children.contains(where: { $0 === item }) { item.release(self) }
        items = children
        for (index, item) in items.enumerated() {
            item.claim(self, index: index)
            if !originalOrder.contains(where: { $0 === item }) { originalOrder.append(item) }
        }
        if loaded { enforceExclusive(); enforceKeepOne() }
        synchronizePresentation()
    }
    func disconnect() {
        connected = false
        cancelReorder(); cancelChassis()
        for item in items { item.release(self) }
    }
    func update(_ next: AWCNativeAccordionConfiguration) {
        let previous = configuration; configuration = next
        if previous.floating != next.floating {
            cancelChassis(); x = next.floating ? next.initialX : 0; y = next.floating ? next.initialY : 0
            if !next.floating { zIndex = nil }
            for (index, item) in items.enumerated() where owns(item) { item.claim(self, index: index) }
        }
        if previous.reorderable && !next.reorderable { cancelReorder() }
        if previous.exclusive != next.exclusive && next.exclusive { enforceExclusive() }
        if previous.keepOneExpanded != next.keepOneExpanded { enforceKeepOne() }
        if previous.headingLevel != next.headingLevel || previous.region != next.region || previous.regionThreshold != next.regionThreshold {
            synchronizePresentation()
        }
    }
    private func enforceExclusive() {
        guard configuration.exclusive else { return }
        var kept = false
        for item in items where owns(item) && item.expanded {
            if kept { item.setExpanded(false) } else { kept = true }
        }
    }
    private func enforceKeepOne() {
        let owned = items.filter(owns)
        if configuration.keepOneExpanded && !owned.contains(where: \.expanded) { owned.first(where: { !$0.disabled })?.setExpanded(true) }
        synchronizeCollapsible()
    }
    private func synchronizeCollapsible() {
        let owned = items.filter(owns), open = items.filter { owns($0) && $0.expanded }
        for item in owned { item.collapsible = !configuration.keepOneExpanded || open.count != 1 || !item.expanded }
    }
    private func synchronizePresentation() {
        let region = configuration.region == "always" || (configuration.region != "never" && Double(items.count) <= configuration.regionThreshold) ? "region" : "group"
        for (index, item) in items.enumerated() where owns(item) {
            item.claim(self, index: index); item.headingLevel = configuration.headingLevel; item.regionRole = region
        }
        synchronizeCollapsible()
    }
    /// Called at the owning scope's bubble phase by the renderer. Returning
    /// false from the item's emit callback then prevents a second delivery.
    /// Target stopPropagation must be able to suppress this listener, whereas
    /// preventDefault deliberately does not undo the already committed state.
    func receiveItemEvent(_ item: AWCNativeAccordionItemState, name: String, detail: AWCValue) {
        switch name {
        case "mdItemToggle": itemToggled(item, expanded: detail["expanded"].bool ?? false, index: Int(exactly: detail["index"].number ?? -1) ?? -1)
        case "mdItemRequestFocus": navigate(item, direction: detail["direction"].string, from: Int(exactly: detail["from"].number ?? -1) ?? -1)
        case "mdItemRequestReorder": keyboardReorder(item, direction: detail["direction"].string, from: Int(exactly: detail["from"].number ?? -1) ?? -1)
        default: break
        }
    }
    fileprivate func itemToggled(_ item: AWCNativeAccordionItemState, expanded: Bool, index: Int) {
        guard owns(item) else { return }
        if configuration.exclusive && expanded {
            for (i, sibling) in items.enumerated() where i != index && owns(sibling) { sibling.setExpanded(false) }
        }
        synchronizeCollapsible()
        emit("mdToggle", ["index": .number(Double(index)), "expanded": .bool(expanded), "expandedIndices": .array(expandedIndices.map { .number(Double($0)) })])
    }
    fileprivate func navigate(_ item: AWCNativeAccordionItemState, direction: String, from: Int) {
        guard owns(item) else { return }
        let enabled = items.indices.filter { owns(items[$0]) && !items[$0].disabled }
        guard let first = enabled.first, let last = enabled.last else { return }
        let target: Int
        if direction == "first" { target = first }
        else if direction == "last" { target = last }
        else {
            guard items.indices.contains(from) else { return }
            target = direction == "next" ? enabled.first(where: { $0 > from }) ?? first : enabled.last(where: { $0 < from }) ?? last
        }
        items[target].focusHeader()
    }
    fileprivate func keyboardReorder(_ item: AWCNativeAccordionItemState, direction: String, from: Int) {
        guard configuration.reorderable, owns(item), items.indices.contains(from), !items[from].disabled else { return }
        let to = from + (direction == "up" ? -1 : 1)
        guard items.indices.contains(to) else { return }
        move(from: from, to: to); items[to].focusHeader(); emitReorder(from: from, to: to)
    }
    private func move(from: Int, to: Int) {
        guard from != to else { return }
        let item = items.remove(at: from); items.insert(item, at: to)
        for (index, item) in items.enumerated() where owns(item) { item.claim(self, index: index) }
    }
    private func emitReorder(from: Int, to: Int) {
        emit("mdReorder", ["from": .number(Double(from)), "to": .number(Double(to)), "order": .array(originalIndices.map { .number(Double($0)) })])
    }
    @discardableResult func beginReorder(item: AWCNativeAccordionItemState, pointer: Int, button: Int = 0, clientY: Double, hostTop: Double, rects: [AWCNativeAccordionItemRect]) -> Bool {
        guard connected, button == 0, configuration.reorderable, reorder == nil, chassis == nil, owns(item), !item.disabled, items.count > 1, rects.count == items.count,
              let from = items.firstIndex(where: { $0 === item }) else { return false }
        let distance = from < items.count - 1 ? rects[from + 1].top - rects[from].top : rects[from].top - rects[from - 1].top
        reorder = .init(item: item, pointer: pointer, from: from, target: from, startY: clientY, hostTop: hostTop, distance: distance == 0 ? rects[from].height : abs(distance), rects: rects)
        draggedItemID = item.id; draggedOffset = 0
        dropPlaceholder = .init(top: rects[from].top - hostTop, height: rects[from].height)
        return true
    }
    func moveReorder(pointer: Int, clientY: Double) {
        guard var drag = reorder, drag.pointer == pointer else { return }
        let dy = clientY - drag.startY; draggedOffset = dy
        let center = drag.rects[drag.from].top + drag.rects[drag.from].height / 2 + dy
        var target = drag.from
        if dy > 0 {
            for i in items.indices where i > drag.from { if center > drag.rects[i].top + drag.rects[i].height / 2 { target = i } else { break } }
        } else if dy < 0 {
            for i in items.indices.reversed() where i < drag.from { if center < drag.rects[i].top + drag.rects[i].height / 2 { target = i } else { break } }
        }
        guard target != drag.target else { return }
        drag.target = target; reorder = drag
        siblingOffsets = [:]
        for (i, item) in items.enumerated() where i != drag.from {
            if target > drag.from && i > drag.from && i <= target { siblingOffsets[item.id] = -drag.distance }
            else if target < drag.from && i < drag.from && i >= target { siblingOffsets[item.id] = drag.distance }
        }
        dropPlaceholder = .init(top: drag.rects[target].top - drag.hostTop, height: drag.rects[drag.from].height)
    }
    func endReorder(pointer: Int, cancelled: Bool = false) {
        guard let drag = reorder, drag.pointer == pointer else { return }
        cancelReorder()
        if !cancelled && drag.target != drag.from { move(from: drag.from, to: drag.target); emitReorder(from: drag.from, to: drag.target) }
    }
    private func cancelReorder() { reorder = nil; draggedItemID = nil; draggedOffset = 0; siblingOffsets = [:]; dropPlaceholder = nil }
    @discardableResult func beginChassis(pointer: Int, button: Int = 0, clientX: Double, clientY: Double) -> Bool {
        guard connected, button == 0, configuration.floating, reorder == nil, chassis == nil else { return false }
        chassis = .init(pointer: pointer, clientX: clientX, clientY: clientY, x: x, y: y); chassisDragging = true
        if configuration.bringToFront { raise() }
        emitDrag("mdDragStart", clientX: clientX, clientY: clientY, dx: 0, dy: 0)
        return true
    }
    func moveChassis(pointer: Int, clientX: Double, clientY: Double) {
        guard let drag = chassis, drag.pointer == pointer else { return }
        let dx = clientX - drag.clientX, dy = clientY - drag.clientY
        x = drag.x + dx; y = drag.y + dy
        emitDrag("mdDragMove", clientX: clientX, clientY: clientY, dx: dx, dy: dy)
    }
    /// Source pointercancel uses the same end path: retain the last move's
    /// position, report the terminal pointer delta, and release capture.
    func endChassis(pointer: Int, clientX: Double, clientY: Double) {
        guard let drag = chassis, drag.pointer == pointer else { return }
        cancelChassis()
        emitDrag("mdDragEnd", clientX: clientX, clientY: clientY, dx: clientX - drag.clientX, dy: clientY - drag.clientY)
    }
    private func cancelChassis() { chassis = nil; chassisDragging = false }
    private func raise() { Self.floatingZ += 1; zIndex = Self.floatingZ }
    /// Called by the renderer on every render; only the first call is recorded.
    func claimRenderOrder() { if renderOrder == nil { Self.nextRenderOrder += 1; renderOrder = Self.nextRenderOrder } }
    private func raiseOnLoad() {
        raise(); loadZ = zIndex
        // Panels connected in the same pass exchange their load-time values so that the
        // stacking follows render order; values changed since (a drag raise) are left alone.
        Self.pendingRaises.append(self)
        if Self.pendingRaises.count == 1 { DispatchQueue.main.async { Self.pendingRaises = [] } }
        let batch = Self.pendingRaises.enumerated().filter { $0.element.zIndex != nil && $0.element.zIndex == $0.element.loadZ }
        let values = batch.compactMap { $0.element.zIndex }.sorted()
        let ordered = batch.sorted { ($0.element.renderOrder ?? .max, $0.offset) < ($1.element.renderOrder ?? .max, $1.offset) }
        for (entry, value) in zip(ordered, values) where entry.element.zIndex != value { entry.element.zIndex = value; entry.element.loadZ = value }
    }
    private func emitDrag(_ name: String, clientX: Double, clientY: Double, dx: Double, dy: Double) {
        emit(name, ["clientX": .number(clientX), "clientY": .number(clientY), "x": .number(x), "y": .number(y), "dx": .number(dx), "dy": .number(dy)])
    }
    static func defaultIndices(_ source: String) -> Set<Int> {
        Set(source.split(separator: ",").compactMap { piece in
            let text = piece.trimmingCharacters(in: CharacterSet(charactersIn: "\u{0009}\u{000A}\u{000B}\u{000C}\u{000D}\u{0020}\u{00A0}\u{1680}\u{2000}\u{2001}\u{2002}\u{2003}\u{2004}\u{2005}\u{2006}\u{2007}\u{2008}\u{2009}\u{200A}\u{2028}\u{2029}\u{202F}\u{205F}\u{3000}\u{FEFF}"))
            guard !text.isEmpty else { return nil }
            let lower = text.lowercased(), number: Double?
            if lower.range(of: "^0x[0-9a-f]+$", options: .regularExpression) != nil { number = UInt64(text.dropFirst(2), radix: 16).map { Double($0) } }
            else if lower.range(of: "^0b[01]+$", options: .regularExpression) != nil { number = UInt64(text.dropFirst(2), radix: 2).map { Double($0) } }
            else if lower.range(of: "^0o[0-7]+$", options: .regularExpression) != nil { number = UInt64(text.dropFirst(2), radix: 8).map { Double($0) } }
            else if text.range(of: "^[+-]?(?:[0-9]+\\.?[0-9]*|\\.[0-9]+)(?:[eE][+-]?[0-9]+)?$", options: .regularExpression) != nil { number = Double(text) }
            else { number = nil }
            guard let number, number.isFinite, number >= 0, number.rounded(.towardZero) == number, number < Double(Int.max) else { return nil }
            return Int(number)
        })
    }
}
