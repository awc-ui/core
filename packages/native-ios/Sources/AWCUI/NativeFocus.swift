import Foundation
import Observation

public struct AWCButtonAccessibilityPolicy: Equatable, Sendable {
    public enum Role: String, Sendable { case button, link, gridcell }
    public let role: Role
    public let selected: Bool
    public let hardDisabled: Bool
    public let activationBlocked: Bool
    public let groupTabindex: Int?
    public init(properties: [String: AWCValue]) {
        hardDisabled = properties["disabled"]?.bool == true
        activationBlocked = hardDisabled || properties["softDisabled"]?.bool == true || properties["loading"]?.bool == true
        groupTabindex = properties["groupTabindex"]?.number.flatMap { $0.isFinite ? Int(exactly: $0) : nil }
        let href = properties["href"]?.string ?? ""
        let safeLink = !activationBlocked && AWCURLRouter(baseURL: URL(string: "https://native.invalid/")) { _ in false }.request(href: href, nodeID: "") != nil
        role = Role(rawValue: properties["roleOverride"]?.string ?? "") ?? (safeLink ? .link : .button)
        selected = properties["selected"]?.bool == true && (role == .gridcell || properties["toggle"]?.bool == true)
    }
    public var sequentiallyFocusable: Bool { !hardDisabled && (groupTabindex ?? 0) >= 0 }
    public var programmaticallyFocusable: Bool { !hardDisabled }
}

public struct AWCButtonFocusItem: Equatable, Sendable {
    public let id: String
    public let disabled: Bool
    public let selected: Bool
    public init(id: String, disabled: Bool = false, selected: Bool = false) { self.id = id; self.disabled = disabled; self.selected = selected }
}

/// Source-ordered, nearest-group native roving focus. Moving focus never activates or selects.
@Observable public final class AWCButtonFocusGroup {
    public private(set) var items: [AWCButtonFocusItem] = []
    public private(set) var activeID: String?
    public private(set) var rightToLeft = false
    private var recentlyFocusedID: String?
    @ObservationIgnored private var focusRequests: [String: () -> Bool] = [:]
    public init() {}
    public func configure(items: [AWCButtonFocusItem], singleSelection: Bool = true, rightToLeft: Bool = false) {
        self.items = items; self.rightToLeft = rightToLeft
        let eligible = items.filter { !$0.disabled }
        activeID = eligible.first { $0.id == recentlyFocusedID }?.id
            ?? (singleSelection ? eligible.first { $0.selected }?.id : nil)
            ?? eligible.first?.id
    }
    public func register(id: String, requestFocus: @escaping () -> Bool) { focusRequests[id] = requestFocus }
    public func unregister(id: String) { focusRequests[id] = nil }
    public func didFocus(id: String) {
        guard items.contains(where: { $0.id == id && !$0.disabled }) else { return }
        recentlyFocusedID = id; activeID = id
    }
    public func tabindex(for id: String) -> Int { id == activeID ? 0 : -1 }
    public func destination(for key: String, from id: String?) -> String? {
        let eligible = items.filter { !$0.disabled }.map(\.id)
        guard !eligible.isEmpty else { return nil }
        if key == "Home" { return eligible.first }; if key == "End" { return eligible.last }
        guard key == "ArrowLeft" || key == "ArrowRight" else { return nil }
        let forward = (key == "ArrowRight") != rightToLeft
        guard let current = eligible.firstIndex(where: { $0 == id }) else { return forward ? eligible.first : eligible.last }
        return eligible[(current + (forward ? 1 : -1) + eligible.count) % eligible.count]
    }
    @discardableResult public func move(_ key: String, from id: String?) -> Bool {
        guard let next = destination(for: key, from: id), next != id else { return false }
        guard focusRequests[next]?() == true else { return false }
        didFocus(id: next); return true
    }
}

/// Optional explicit native table-cell coordinates supplied by a composite owner.
public struct AWCGridCellContext: Equatable, Sendable {
    public let row: Int
    public let column: Int
    public init(row: Int, column: Int) { self.row = row; self.column = column }
    public var rowRange: NSRange { row >= 0 ? NSRange(location: row, length: 1) : NSRange(location: NSNotFound, length: 0) }
    public var columnRange: NSRange { column >= 0 ? NSRange(location: column, length: 1) : NSRange(location: NSNotFound, length: 0) }
}

@Observable final class AWCButtonFocusHandle {
    var isFocused = false
    var showFocus = true
    var isFocusVisible: Bool { isFocused && showFocus }
    @ObservationIgnored var requestFocus: (() -> Bool)?
    @ObservationIgnored var requestPointerFocus: (() -> Bool)?
}
