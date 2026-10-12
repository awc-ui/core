import Foundation
#if !AWC_STANDALONE
@testable import AWCUI
#endif

enum NativeFocusCases {
    static func run(_ check: (Bool, String) -> Void) {
        func policy(_ props: [String: AWCValue]) -> AWCButtonAccessibilityPolicy { .init(properties: props) }
        check(policy([:]).sequentiallyFocusable && policy(["groupTabindex": .null]).sequentiallyFocusable, "Null/default tabindex is an ordinary native entry")
        check(policy(["groupTabindex": 0]).sequentiallyFocusable && !policy(["groupTabindex": -1]).sequentiallyFocusable, "Zero enters native Tab order; minus one does not")
        check(policy(["groupTabindex": -1]).programmaticallyFocusable, "Tab exclusion retains programmatic/arrow focus")
        check(!policy(["disabled": true, "groupTabindex": 0]).programmaticallyFocusable, "Hard-disabled buttons cannot receive native focus")
        check(policy(["softDisabled": true]).sequentiallyFocusable && policy(["softDisabled": true]).activationBlocked, "Soft-disabled keeps focus while blocking actions")
        check(policy(["loading": true]).sequentiallyFocusable && policy(["loading": true]).activationBlocked, "Loading keeps focus while blocking actions")
        check(policy(["roleOverride": "gridcell", "selected": true]).role == .gridcell && policy(["roleOverride": "gridcell", "selected": true]).selected, "Selected gridcell exposes selection independently of toggle")
        check(policy(["roleOverride": "unknown"]).role == .button, "Unknown native role safely falls back to button")
        check(policy(["href": "next"]).role == .link && policy(["href": "javascript:alert(1)"]).role == .button, "Only safe enabled links infer link role")
        check(policy(["href": "next", "loading": true]).role == .button, "Blocked source links use inert button role")
        let group = AWCButtonFocusGroup()
        let items = [AWCButtonFocusItem(id: "a"), .init(id: "disabled", disabled: true), .init(id: "soft"), .init(id: "loading"), .init(id: "z", selected: true)]
        group.configure(items: items)
        check(group.activeID == "z" && group.tabindex(for: "a") == -1 && group.tabindex(for: "z") == 0, "Selected single-select child is the only initial group Tab entry")
        check(group.destination(for: "ArrowRight", from: "a") == "soft", "Arrows skip hard disabled and retain soft disabled")
        check(group.destination(for: "ArrowRight", from: "soft") == "loading", "Loading is arrow-focus eligible")
        check(group.destination(for: "ArrowRight", from: "z") == "a" && group.destination(for: "ArrowLeft", from: "a") == "z", "Horizontal focus wraps")
        check(group.destination(for: "Home", from: "z") == "a" && group.destination(for: "End", from: "a") == "z", "Home/End use source order")
        check(group.destination(for: "Tab", from: "a") == nil && group.destination(for: "ArrowDown", from: "a") == nil, "Group leaves Tab and vertical arrows to native owner")
        var focusCalls: [String] = []
        for item in items { group.register(id: item.id) { focusCalls.append(item.id); return true } }
        check(group.move("ArrowRight", from: "a") && focusCalls == ["soft"] && group.activeID == "soft", "Native group movement invokes only the target focus request")
        group.configure(items: items)
        check(group.activeID == "soft", "Recent focus outranks selected child during updates")
        group.configure(items: items, rightToLeft: true)
        check(group.destination(for: "ArrowRight", from: "soft") == "a" && group.destination(for: "ArrowLeft", from: "soft") == "loading", "RTL reverses only horizontal arrow direction")
        check(group.destination(for: "Home", from: "soft") == "a", "RTL retains Home source order")
        group.configure(items: items.filter { $0.id != "soft" })
        check(group.activeID == "z", "Removed active child recomputes selected fallback")
        group.configure(items: [.init(id: "z", disabled: true), .init(id: "a")])
        check(group.activeID == "a", "Disabled active child recomputes eligible fallback")
        group.configure(items: items, singleSelection: false)
        check(group.activeID == "soft", "Multi-select preserves eligible recent focus")
        let other = AWCButtonFocusGroup(); other.configure(items: items, singleSelection: false)
        check(other.activeID == "a", "Independent multi-select group starts at first eligible without selection preference")
        let cell = AWCGridCellContext(row: 1, column: 2)
        check(cell.rowRange == NSRange(location: 1, length: 1) && cell.columnRange == NSRange(location: 2, length: 1), "Native grid cell context retains actual zero-based owner coordinates")
    }
}
