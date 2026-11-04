import Foundation
import Observation

public struct AWCButtonAccessibilityPolicy: Equatable, Sendable {
    public enum Role: String, Sendable { case button, link, gridcell, menuitem, radio, checkbox, `switch`, option, treeitem, tab, tabpanel }
    public let role: Role
    public let selected: Bool
    /// A toggle button (Web aria-pressed); mixed checkbox; invalid/required form state and its message (aria-invalid/aria-required/aria-describedby).
    public let toggle: Bool
    public let mixed: Bool
    public let invalid: Bool
    public let required: Bool
    public let errorText: String
    public let hardDisabled: Bool
    public let activationBlocked: Bool
    public let groupTabindex: Int?
    /// `aria-hidden="true"`: out of the accessibility tree (the element stays clickable, as on Web).
    public let ariaHidden: Bool
    private let allowsDisabledFocus:Bool
    public init(properties: [String: AWCValue]) {
        hardDisabled = properties["disabled"]?.bool == true
        activationBlocked = hardDisabled || properties["softDisabled"]?.bool == true || properties["loading"]?.bool == true
        groupTabindex = properties["groupTabindex"]?.number.flatMap { $0.isFinite ? Int(exactly: $0) : nil }
        ariaHidden = properties["aria-hidden"]?.string == "true" || properties["aria-hidden"]?.bool == true
        let href = properties["href"]?.string ?? ""
        let safeLink = !activationBlocked && AWCURLRouter(baseURL: URL(string: "https://native.invalid/")) { _ in false }.request(href: href, nodeID: "") != nil
        role = Role(rawValue: properties["roleOverride"]?.string ?? "") ?? (safeLink ? .link : .button)
        selected = properties["selected"]?.bool == true && (role == .treeitem || role == .gridcell || role == .radio || role == .checkbox || role == .switch || role == .option || role == .tab || properties["toggle"]?.bool == true)
        toggle = role == .button && properties["toggle"]?.bool == true
        mixed = properties["mixed"]?.bool == true
        invalid = properties["invalid"]?.bool == true
        required = properties["required"]?.bool == true
        errorText = properties["errorText"]?.string ?? ""
        allowsDisabledFocus = properties["_menuRoving"]?.bool == true
    }
    public var sequentiallyFocusable: Bool { (!hardDisabled || allowsDisabledFocus) && (groupTabindex ?? 0) >= 0 }
    public var programmaticallyFocusable: Bool { !hardDisabled || allowsDisabledFocus }
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
    /// Parent composite receives the same bubbling native focus/key action.
    public var parent: AWCButtonFocusGroup? {
        didSet {
            guard oldValue !== parent else { return }
            for (id, request) in focusRequests { oldValue?.unregister(id:id); parent?.register(id:id,requestFocus:request) }
        }
    }
    private var recentlyFocusedID: String?
    @ObservationIgnored private var focusRequests: [String: () -> Bool] = [:]
    /// A vertical group (md-toolbar floating vertical) roves on ArrowUp/ArrowDown instead of ArrowLeft/ArrowRight.
    public var vertical = false
    /// Arrows with a modifier key pass through untouched (md-toolbar ignores them).
    public var ignoresModifiedKeys = false
    /// Focuses a registered member through its native responder (md-toolbar setFocus()).
    @discardableResult public func focus(_ id: String) -> Bool { focusRequests[id]?() == true }
    public init() {}
    public func configure(items: [AWCButtonFocusItem], singleSelection: Bool = true, rightToLeft: Bool = false) {
        self.items = items; self.rightToLeft = rightToLeft
        let eligible = items.filter { !$0.disabled }
        activeID = eligible.first { $0.id == recentlyFocusedID }?.id
            ?? (singleSelection ? eligible.first { $0.selected }?.id : nil)
            ?? eligible.first?.id
    }
    public func register(id: String, requestFocus: @escaping () -> Bool) { focusRequests[id] = requestFocus; parent?.register(id:id,requestFocus:requestFocus) }
    public func unregister(id: String) { focusRequests[id] = nil; parent?.unregister(id:id) }
    public func didFocus(id: String) {
        guard items.contains(where: { $0.id == id && !$0.disabled }) else { return }
        recentlyFocusedID = id; activeID = id; parent?.didFocus(id:id)
    }
    public func tabindex(for id: String) -> Int { if let parent, parent.items.contains(where:{$0.id == id}) { return parent.tabindex(for:id) }; return id == activeID ? 0 : -1 }
    public func destination(for key: String, from id: String?) -> String? {
        let eligible = items.filter { !$0.disabled }.map(\.id)
        guard !eligible.isEmpty else { return nil }
        if key == "Home" { return eligible.first }; if key == "End" { return eligible.last }
        guard vertical ? key == "ArrowUp" || key == "ArrowDown" : key == "ArrowLeft" || key == "ArrowRight" else { return nil }
        let forward = vertical ? key == "ArrowDown" : (key == "ArrowRight") != rightToLeft
        guard let current = eligible.firstIndex(where: { $0 == id }) else { return forward ? eligible.first : eligible.last }
        return eligible[(current + (forward ? 1 : -1) + eligible.count) % eligible.count]
    }
    @discardableResult public func move(_ key: String, from id: String?) -> Bool {
        var handled = false
        if let next = destination(for:key,from:id), next != id, focusRequests[next]?() == true {
            didFocus(id:next); handled = true
        }
        // Web keydown bubbles even after the inner group preventDefault().
        let parentHandled = parent?.move(key,from:id) ?? false
        return handled || parentHandled
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
    /// Resigns focus when this control holds it (`setBlur()`).
    @ObservationIgnored var resignFocus: (() -> Void)?
}
