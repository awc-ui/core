import SwiftUI

private struct AWCButtonFocusGroupKey: EnvironmentKey { static let defaultValue: AWCButtonFocusGroup? = nil }
private struct AWCNativeFocusChangedKey: EnvironmentKey { static let defaultValue: ((String, Bool) -> Void)? = nil }
private struct AWCGridCellContextKey: EnvironmentKey { static let defaultValue: AWCGridCellContext? = nil }
/// A key at a control inside a composite, before the control's own handling (md-date-picker: the source's panel-level
/// keydown listener routes the calendar, year-grid and menu keys): the Web key name and its modifiers.
public struct AWCCompositeKey: Equatable, Sendable {
    public let key: String
    public let shift: Bool, alt: Bool, control: Bool, meta: Bool
    public init(key: String, shift: Bool = false, alt: Bool = false, control: Bool = false, meta: Bool = false) {
        self.key = key; self.shift = shift; self.alt = alt; self.control = control; self.meta = meta
    }
}
private struct AWCCompositeKeyRouterKey: EnvironmentKey { static let defaultValue: ((String, AWCCompositeKey) -> Bool)? = nil }
/// A composite's programmatic focus move states whether it is focus-visible (Chrome: `focus()` after a pointer press shows
/// no ring, after a key it does); nil keeps the caller's own indicator.
@MainActor public enum AWCNativeFocusRequest { public static var indicator: Bool? }
private struct AWCUnhandledArrowKey: EnvironmentKey { static let defaultValue: ((String) -> Bool)? = nil }
public extension EnvironmentValues {
    var awcNativeFocusChanged: ((String, Bool) -> Void)? { get { self[AWCNativeFocusChangedKey.self] } set { self[AWCNativeFocusChangedKey.self] = newValue } }
    var awcButtonFocusGroup: AWCButtonFocusGroup? { get { self[AWCButtonFocusGroupKey.self] } set { self[AWCButtonFocusGroupKey.self] = newValue } }
    var awcGridCellContext: AWCGridCellContext? { get { self[AWCGridCellContextKey.self] } set { self[AWCGridCellContextKey.self] = newValue } }
    /// Routes keys of the focused control with this id inside a composite (true: handled, the control does nothing more).
    var awcCompositeKeyRouter: ((String, AWCCompositeKey) -> Bool)? { get { self[AWCCompositeKeyRouterKey.self] } set { self[AWCCompositeKeyRouterKey.self] = newValue } }
    /// iOS: ArrowLeft / ArrowRight a focused control leaves unused (no arrow group or key route took it) go here
    /// (an enclosing scroll container scrolls, as a browser scrolls a scroll container around a focused control).
    var awcUnhandledArrow: ((String) -> Bool)? { get { self[AWCUnhandledArrowKey.self] } set { self[AWCUnhandledArrowKey.self] = newValue } }
}

struct AWCNativeFocusConfiguration {
    let id: String
    let label: String
    let policy: AWCButtonAccessibilityPolicy
    let group: AWCButtonFocusGroup?
    let cell: AWCGridCellContext?
    let handle: AWCButtonFocusHandle
    let focusChanged: (Bool) -> Void
    let activate: () -> Void
    var activateFrom: ((AWCActivationMetadata.Source) -> Void)? = nil
    var keyPress: (() -> Void)? = nil
    var routeKey: ((String,Bool,Bool)->Bool)? = nil
    var menuExpanded:Bool? = nil
    var popup:AWCNativePopupRelationship? = nil
    var tooltipDescription:String? = nil
    var disclosureExpanded: Bool? = nil
    /// A tree item (Web role="treeitem"): its 1-based level; `disclosureExpanded` is then its expanded state.
    var treeLevel: Int? = nil
    /// A tree item's position in the tree's DOM (pre-)order: its container lists the items in this order (reading order).
    var treeOrder: Int? = nil
    var routeKeyWithAlt: ((String, Bool) -> Bool)? = nil
    /// iOS: the control's press and click from the raw UIKit touch (`AWCTouchPressRouter`); nil leaves touches to SwiftUI.
    var touchPress: AWCTouchPressHandler? = nil
    /// The enclosing composite's key router (`awcCompositeKeyRouter`), consulted before every other key handling.
    var compositeKey: ((AWCCompositeKey) -> Bool)? = nil
    /// The control is the button of a heading (an accordion header): iOS adds the header trait.
    var heading: Bool = false
    var inert = false
    /// Keys a composite takes before this control (`awcNativeKeyInterceptor`): true when handled.
    var intercept: ((String, Bool) -> Bool)? = nil
    /// md-tab: the accessibility element of the panel it controls (Web aria-controls; macOS AXLinkedUIElements).
    var controls: (() -> AnyObject?)? = nil
    /// Called with the native focus surface on every update (md-tab-panel registers its surface for its tab's link).
    var registerView: ((AnyObject) -> Void)? = nil
    /// Web aria-grabbed (macOS AXGrabbed, as Chrome reports it); nil when the source sets none.
    var grabbed: Bool? = nil
    func performActivation(_ source: AWCActivationMetadata.Source) {
        guard !inert else { return }
        if let activateFrom { activateFrom(source) } else { activate() }
    }
    var applicableGroup: AWCButtonFocusGroup? { group?.items.contains(where: { $0.id == id }) == true ? group : nil }
    var sequential: Bool { !inert && policy.programmaticallyFocusable && (applicableGroup.map { $0.tabindex(for: id) >= 0 } ?? policy.sequentiallyFocusable) }
}

#if canImport(AppKit)
import AppKit

/// An owner-supplied accessibility encoding for a focus surface (macOS): a composite whose element role SwiftUI cannot
/// express gives its focus surface that role, name, state and children (md-table: a focusable row is the AXRow listing its cells).
struct AWCFocusAccessibilityOverride {
    var role: NSAccessibility.Role
    var label: String
    var selected: Bool? = nil
    var expanded: Bool? = nil
    var index: Int? = nil
    var children: () -> [Any] = { [] }
}

/// Native first-responder and accessibility surface; pointer hits reach the visible SwiftUI Button.
final class AWCNativeButtonFocusView: NSView {
    var configuration: AWCNativeFocusConfiguration?
    /// Its bridge's place in document order (Tab order, NativeDocumentOrder.swift).
    var documentToken: AWCDocumentToken?
    /// The owner's encoding of this surface (nil: the control encoding from the configuration).
    var awcAccessibilityOverride: AWCFocusAccessibilityOverride?
    override func accessibilityChildren() -> [Any]? { awcAccessibilityOverride.map { $0.children() } ?? super.accessibilityChildren() }
    override func accessibilityIndex() -> Int { awcAccessibilityOverride?.index ?? super.accessibilityIndex() }
    /// The container element that lists this item (AWCNativeContainerAccessibilityView), reported as its accessibility parent.
    weak var awcAccessibilityContainer: NSView?
    override func accessibilityParent() -> Any? { awcAccessibilityContainer ?? super.accessibilityParent() }
    private var requestedFocusIndicator: Bool?
    override var acceptsFirstResponder: Bool { configuration?.inert == false && configuration?.policy.programmaticallyFocusable == true }
    override var canBecomeKeyView: Bool { configuration?.sequential == true && window != nil && !isHidden }
    override func hitTest(_ point: NSPoint) -> NSView? { nil }
    func requestNativeFocus(showIndicator: Bool = true) -> Bool {
        guard acceptsFirstResponder, let window else { return false }
        let showIndicator = AWCNativeFocusRequest.indicator ?? showIndicator
        requestedFocusIndicator = showIndicator
        defer { requestedFocusIndicator = nil }
        configuration?.handle.showFocus = showIndicator
        return window.makeFirstResponder(self)
    }
    override func becomeFirstResponder() -> Bool {
        guard acceptsFirstResponder else { return false }
        if window?.firstResponder === self && configuration?.handle.isFocused == true { return true }
        configuration?.handle.showFocus = requestedFocusIndicator ?? true
        configuration?.handle.isFocused = true
        if let c = configuration { c.group?.didFocus(id: c.id); c.focusChanged(true) }
        return true
    }
    override func resignFirstResponder() -> Bool {
        configuration?.handle.isFocused = false; configuration?.focusChanged(false); return true
    }
    override func keyDown(with event: NSEvent) {
        guard let c = configuration, !c.inert else { return }
        AWCNativeKeyRouting.repeating = event.isARepeat; defer { AWCNativeKeyRouting.repeating = nil }
        c.handle.showFocus = true
        let key: String
        switch event.keyCode {
        case 123: key = "ArrowLeft"; case 124: key = "ArrowRight"; case 125:key="ArrowDown";case 126:key="ArrowUp";case 53:key="Escape";case 115: key = "Home"; case 119: key = "End"
        case 36, 76: key = "Enter"; case 49: key = "Space"
        case 48:key="Tab"
        default:key=event.characters ?? ""
        }
        if let route = c.compositeKey {
            let f = event.modifierFlags, name = event.keyCode == 116 ? "PageUp" : event.keyCode == 121 ? "PageDown" : key
            if route(AWCCompositeKey(key: name, shift: f.contains(.shift), alt: f.contains(.option), control: f.contains(.control), meta: f.contains(.command))) { return }
        }
        if c.intercept?(key, event.modifierFlags.contains(.shift)) == true { return }
        if c.routeKeyWithAlt?(key, event.modifierFlags.contains(.option)) == true { return }
        if c.routeKey?(key,event.modifierFlags.contains(.shift),!event.modifierFlags.intersection([.control,.option,.command]).isEmpty) == true {return}
        if key=="Tab" { AWCDocumentTabOrder.select(from: self, backward: event.modifierFlags.contains(.shift)); return }
        if ["Enter", "Space"].contains(key) { c.keyPress?(); if !c.policy.activationBlocked { c.performActivation(.keyboard) }; return }
        if c.applicableGroup?.ignoresModifiedKeys == true, !event.modifierFlags.intersection([.shift, .control, .option, .command]).isEmpty { super.keyDown(with: event); return }
        if c.applicableGroup?.move(key, from: c.id) != true { super.keyDown(with: event) }
    }
    // A tab panel's element is the SwiftUI group around it (named by its tab); its surface only carries keyboard focus.
    override func isAccessibilityElement() -> Bool { configuration?.inert == false && configuration?.policy.ariaHidden != true && configuration?.policy.role != .tabpanel }
    override func accessibilityIdentifier() -> String { configuration?.id ?? "" }
    override func accessibilityLabel() -> String? { awcAccessibilityOverride?.label ?? configuration?.label }
    override func accessibilityHelp() -> String? { configuration?.policy.invalid == true && configuration?.policy.errorText.isEmpty == false ? configuration?.policy.errorText : configuration?.tooltipDescription }
    override func accessibilityRole() -> NSAccessibility.Role? {
        if let role = awcAccessibilityOverride?.role { return role }
        switch configuration?.policy.role { case .tabpanel: return .group; case .gridcell: return .cell; case .link: return .link;case .menuitem:return .menuItem;case .radio, .tab:return .radioButton;case .checkbox, .switch:return .checkBox; case .option:return .staticText; case .treeitem: return .row; default: return configuration?.policy.toggle == true ? .checkBox : .button }
    }
    override func isAccessibilityEnabled() -> Bool { configuration?.policy.activationBlocked == false }
    override func accessibilitySubrole() -> NSAccessibility.Subrole? { configuration?.policy.role == .treeitem ? .outlineRow : configuration?.policy.role == .tab ? NSAccessibility.Subrole(rawValue: "AXTabButton") : configuration?.policy.role == .switch ? .switch : configuration?.policy.toggle == true ? .toggle : super.accessibilitySubrole() }
    /// Form state AppKit has no typed accessor for (WebKit/Chrome expose the same attribute names).
    override func accessibilityAttributeValue(_ attribute: NSAccessibility.Attribute) -> Any? {
        switch attribute.rawValue {
        case "AXRequired": return NSNumber(value: configuration?.policy.required == true)
        case "AXInvalid": return configuration?.policy.invalid == true ? "true" : "false"
        case "AXGrabbed": if let grabbed = configuration?.grabbed { return NSNumber(value: grabbed) }; return super.accessibilityAttributeValue(attribute)
        default: return super.accessibilityAttributeValue(attribute)
        }
    }
    override func isAccessibilitySelected() -> Bool { awcAccessibilityOverride?.selected ?? (configuration?.policy.selected == true) }
    override func isAccessibilityFocused() -> Bool { window?.firstResponder === self }
    override func setAccessibilityFocused(_ value: Bool) { if value { _ = requestNativeFocus() } }
    override func accessibilityValue() -> Any? {
        if awcAccessibilityOverride != nil { return nil }
        if configuration?.policy.role == .treeitem { return nil }   // a tree item states its fold as AXDisclosing, as an outline row
        if let expanded = configuration?.disclosureExpanded { return expanded ? "Expanded" : "Collapsed" }
        if configuration?.policy.role == .checkbox && configuration?.policy.mixed == true { return NSNumber(value: 2) }
        if configuration?.policy.toggle == true { return NSNumber(value: configuration?.policy.selected == true) }
        if configuration?.policy.role == .option { return configuration?.label }   // an option is text whose value is its name (WebKit/Chrome)
        if configuration?.policy.role == .radio || configuration?.policy.role == .tab || configuration?.policy.role == .checkbox || configuration?.policy.role == .switch { return NSNumber(value:configuration?.policy.selected == true) }
        return configuration?.policy.selected == true ? "Selected" : nil
    }
    override func isAccessibilityDisclosed() -> Bool { configuration?.policy.role == .treeitem ? configuration?.disclosureExpanded == true : super.isAccessibilityDisclosed() }
    override func accessibilityDisclosureLevel() -> Int { configuration?.policy.role == .treeitem ? max(0, (configuration?.treeLevel ?? 1) - 1) : super.accessibilityDisclosureLevel() }
    override func isAccessibilityExpanded()->Bool {if let o = awcAccessibilityOverride { return o.expanded == true }; return configuration?.disclosureExpanded ?? configuration?.popup?.expanded ?? (configuration?.menuExpanded == true)}
    override func accessibilityRoleDescription()->String? {
        if configuration?.policy.role == .tabpanel { return "tab panel" }
        if awcAccessibilityOverride != nil { return super.accessibilityRoleDescription() }
        if configuration?.policy.role == .treeitem { return super.accessibilityRoleDescription() }
        if configuration?.disclosureExpanded != nil { return "Disclosure button" }
        if let kind=configuration?.popup?.kind{return (kind=="true" ? "Menu":kind.capitalized)+" button"}
        return configuration?.menuExpanded != nil ? "Menu button":super.accessibilityRoleDescription()
    }
    override func accessibilityLinkedUIElements()->[Any]? {
        if let controlled = configuration?.controls?() { return [controlled] }
        return configuration?.popup?.target?.view.map{[$0]}
    }
    override func accessibilityCustomActions()->[NSAccessibilityCustomAction]? {
        guard let popup=configuration?.popup,let target=popup.target else{return nil}
        return [.init(name:popup.focusActionLabel,handler:{target.focus()})]
    }
    override func accessibilityRowIndexRange() -> NSRange { configuration?.cell?.rowRange ?? NSRange(location: NSNotFound, length: 0) }
    override func accessibilityColumnIndexRange() -> NSRange { configuration?.cell?.columnRange ?? NSRange(location: NSNotFound, length: 0) }
    override func accessibilityPerformPress() -> Bool {
        guard let c = configuration, !c.inert, !c.policy.activationBlocked else { return false }; c.performActivation(.accessibility); return true
    }
}

/// The native surface of `AWCNativeButtonFocusBridge` (NativeDocumentOrder.swift), which adds its document-order token.
struct AWCNativeButtonFocusSurface: NSViewRepresentable {
    let configuration: AWCNativeFocusConfiguration
    let token: AWCDocumentToken
    @Environment(\.awcNativeInert) private var inert
    @Environment(\.awcNativeKeyInterceptor) private var intercept
    func makeNSView(context: Context) -> AWCNativeButtonFocusView { AWCNativeButtonFocusView() }
    func updateNSView(_ view: AWCNativeButtonFocusView, context: Context) {
        var configuration = configuration; configuration.inert = configuration.inert || inert
        if configuration.intercept == nil { configuration.intercept = intercept }
        if let previous = view.configuration, previous.group !== configuration.group || previous.id != configuration.id { previous.group?.unregister(id: previous.id) }
        view.configuration = configuration; view.documentToken = token
        // SwiftUI's layout direction (an invisible view: only the key-view loop reads it, NativeDocumentOrder.swift).
        view.userInterfaceLayoutDirection = context.environment.layoutDirection == .rightToLeft ? .rightToLeft : .leftToRight
        configuration.registerView?(view)
        let focus = { [weak view] in view?.requestNativeFocus() ?? false }
        configuration.handle.requestFocus = focus; configuration.group?.register(id: configuration.id, requestFocus: focus)
        configuration.handle.requestPointerFocus = { [weak view] in view?.requestNativeFocus(showIndicator: false) ?? false }
        configuration.handle.resignFocus = { [weak view] in if let view, view.window?.firstResponder === view { _ = view.window?.makeFirstResponder(nil) } }
        if (configuration.inert || !(configuration.policy.programmaticallyFocusable || configuration.policy.retainsFocusWhenDisabled)) && view.window?.firstResponder === view { _ = view.window?.makeFirstResponder(nil) }
    }
    static func dismantleNSView(_ view: AWCNativeButtonFocusView, coordinator: ()) {
        view.configuration?.group?.unregister(id: view.configuration?.id ?? ""); view.configuration?.handle.requestFocus = nil
        view.configuration?.handle.requestPointerFocus = nil
    }
}

/// The auto-repeat flag of the key event a focus view is routing right now (routes run synchronously inside `keyDown`), so a
/// route does not depend on `NSApp.currentEvent`, which is not that event when it reaches the window directly (gate-7 R4-06).
@MainActor enum AWCNativeKeyRouting { static var repeating: Bool? }

/// An accessibility container element on macOS for a role SwiftUI cannot give a container: an open menu (Web role="menu")
/// or a heading around a disclosure button (Web h3 > button). It owns the native focus elements inside its frame, top to bottom.
final class AWCNativeContainerAccessibilityView: NSView {
    enum Members { case menuItems, all }
    var role: NSAccessibility.Role = .group, label = "", containerIdentifier = "", level = 0, members = Members.all
    override func hitTest(_ point: NSPoint) -> NSView? { nil }
    override func isAccessibilityElement() -> Bool { true }
    override func accessibilityRole() -> NSAccessibility.Role? { role }
    override func accessibilityLabel() -> String? { label }
    override func accessibilityIdentifier() -> String { containerIdentifier }
    override func accessibilityAttributeValue(_ attribute: NSAccessibility.Attribute) -> Any? {
        attribute.rawValue == "AXHeadingLevel" && level > 0 ? NSNumber(value: level) : super.accessibilityAttributeValue(attribute)
    }
    override func accessibilityChildren() -> [Any]? {
        guard let window, let content = window.contentView else { return [] }
        let box = convert(bounds, to: nil).insetBy(dx: -1, dy: -1)
        func all(_ view: NSView) -> [NSView] { [view] + view.subviews.flatMap(all) }
        let items = all(content).compactMap { $0 as? AWCNativeButtonFocusView }.filter { item in
            let r = item.convert(item.bounds, to: nil)
            return item.configuration?.inert == false && item.configuration?.policy.ariaHidden != true && (members == .all || item.configuration?.policy.role == .menuitem) && box.contains(NSPoint(x: r.midX, y: r.midY))
        }.sorted { a, b in
            // A tree lists its items in tree (DOM pre-)order.
            if let x = a.configuration?.treeOrder, let y = b.configuration?.treeOrder { return x < y }
            // Reading order: top to bottom, then along the line (leading to trailing).
            let ra = a.convert(a.bounds, to: nil), rb = b.convert(b.bounds, to: nil)
            if abs(ra.maxY - rb.maxY) > 1 { return ra.maxY > rb.maxY }
            return userInterfaceLayoutDirection == .rightToLeft ? ra.maxX > rb.maxX : ra.minX < rb.minX
        }
        items.forEach { $0.awcAccessibilityContainer = self }
        return items
    }
}
struct AWCNativeContainerAccessibilityBridge: NSViewRepresentable {
    let role: String, label: String, identifier: String, level: Int, members: AWCNativeContainerAccessibilityView.Members
    func makeNSView(context: Context) -> AWCNativeContainerAccessibilityView { AWCNativeContainerAccessibilityView() }
    func updateNSView(_ view: AWCNativeContainerAccessibilityView, context: Context) {
        view.role = NSAccessibility.Role(rawValue: role); view.label = label; view.containerIdentifier = identifier; view.level = level; view.members = members
    }
}
#elseif canImport(UIKit)
import UIKit

/// UIKit has no ARIA gridcell trait. Data-table-cell location plus actionable
/// button/selected traits supplies the native equivalent for composite owners.
final class AWCNativeButtonFocusView: UIView, UIAccessibilityContainerDataTableCell, AWCKeyView {
    var configuration: AWCNativeFocusConfiguration?
    /// The enclosing owner's fallback for unused ArrowLeft / ArrowRight (environment `awcUnhandledArrow`).
    var awcUnhandledArrow: ((String) -> Bool)?
    /// An owner's data-table position for this surface (md-table: the cell holding it), over the configuration's.
    var awcCellOverride: AWCGridCellContext?
    /// Its bridge's place in document order (Tab order, NativeDocumentOrder.swift).
    var documentToken: AWCDocumentToken?
    /// Escape/Tab of an open modal reach its host through this chain (see `AWCModalHostView.active(in:)`).
    override var next: UIResponder? { AWCModalHostView.active(in: window) ?? super.next }
    override var canBecomeFirstResponder: Bool { configuration?.inert == false && (configuration?.policy.programmaticallyFocusable == true || (configuration?.policy.retainsFocusWhenDisabled == true && isFirstResponder)) }
    // AppKit key-view surface (see NativeKeyViewLoop.swift): sequential focus follows the same policy as AppKit `canBecomeKeyView`.
    var awcAcceptsFirstResponder: Bool { canBecomeFirstResponder }
    var awcCanBecomeKeyView: Bool { configuration?.sequential == true && window != nil && !isHidden }
    func awcBecomeKeyView() -> Bool { requestNativeFocus(showIndicator: true) }
    /// iPad keyboard focus (focus system present): Tab moves between focus groups, so each sequential AWC focus view is
    /// its own group and the system enters the AWC key-view loop at the first one (iPhone has no focus system).
    override var focusGroupIdentifier: String? { get { awcCanBecomeKeyView ? "awc.key-view.\(UInt(bitPattern: ObjectIdentifier(self).hashValue))" : nil } set {} }
    fileprivate var requestingExplicitFocus = false
    private var requestedFocusIndicator: Bool?
    override var canBecomeFocused: Bool { (configuration?.inert == false && configuration?.policy.programmaticallyFocusable == true && (requestingExplicitFocus || configuration?.sequential == true)) || (configuration?.policy.retainsFocusWhenDisabled == true && isFocused) }
    override func didUpdateFocus(in context: UIFocusUpdateContext, with coordinator: UIFocusAnimationCoordinator) {
        super.didUpdateFocus(in: context, with: coordinator)
        // iPad: one Tab moves focus once, by the AWC key command (`AWCKeyViewLoop`), as in the Web table's order. The focus system reacts to
        // the same key and re-picks the first focus group (no heading) from the AWC key view that holds focus, before the key command runs
        // or while the loop moves focus. That pick of another AWC key view, which no AWC request asked for, changes neither first
        // responder: the loop owns the moves between AWC key views, so the result does not depend on the order of the two callbacks.
        if let prev = context.previouslyFocusedItem as? AWCNativeButtonFocusView, let next = context.nextFocusedItem as? AWCNativeButtonFocusView,
           prev !== next, context.focusHeading.isEmpty, !next.requestingExplicitFocus {
            // UIKit resigned the first responder of `prev` before this callback; give it back to the last key view the AWC loop (or the user) focused,
            // unless an AWC move already made another view first responder. The system's own pick never owns the first responder.
            if Self.awcFocusHolder == nil, let last = Self.awcLastFocused, last.window != nil, last !== next { _ = last.requestNativeFocus() }
            return
        }
        if context.nextFocusedItem === self { focusSystemUpdate = true; defer { focusSystemUpdate = false }; _ = becomeFirstResponder() }
        else if context.previouslyFocusedItem === self { _ = resignFirstResponder() }
    }
    func requestNativeFocus(showIndicator: Bool = true) -> Bool {
        guard canBecomeFirstResponder else { return false }
        let showIndicator = AWCNativeFocusRequest.indicator ?? showIndicator
        requestedFocusIndicator = showIndicator
        defer { requestedFocusIndicator = nil }
        configuration?.handle.showFocus = showIndicator
        requestingExplicitFocus = true
        if let system = UIFocusSystem.focusSystem(for: self) {
            AWCKeyViewEngineEntry.requesting = true; defer { AWCKeyViewEngineEntry.requesting = false }
            system.requestFocusUpdate(to: self); system.updateFocusIfNeeded()
        }
        let accepted = becomeFirstResponder()
        if !accepted { requestingExplicitFocus = false }
        return accepted
    }
    /// Touches reach the SwiftUI content below; the bridge is hit only by `AWCTouchPressRouter`'s target probe.
    override func point(inside point: CGPoint, with event: UIEvent?) -> Bool { AWCTouchPressRouter.probes(self) && bounds.contains(point) }
    override func didMoveToWindow() { super.didMoveToWindow(); if let window { AWCTouchPressRouter.install(in: window) } }
    /// AWCFocusHolder: the focus view that holds first responder status. UIKit's own "promote the view that was first responder" pass
    /// (run when SwiftUI re-enables a disabled view that still held it, md-table-pagination last-button after click-last) must not take
    /// it back from the view the user moved to; only an explicit request (`requestNativeFocus`) or the focus system moves it.
    private static weak var awcFocusHolder: AWCNativeButtonFocusView?
    private var focusSystemUpdate = false
    fileprivate static weak var awcLastFocused: AWCNativeButtonFocusView?
    override func becomeFirstResponder() -> Bool {
        if isFirstResponder { return true }
        if !requestingExplicitFocus && !focusSystemUpdate, let holder = Self.awcFocusHolder, holder !== self, holder.isFirstResponder { return false }
        guard super.becomeFirstResponder() else { return false }
        Self.awcFocusHolder = self; Self.awcLastFocused = self
        configuration?.handle.showFocus = requestedFocusIndicator ?? true
        configuration?.handle.isFocused = true
        if let c = configuration { c.group?.didFocus(id: c.id); c.focusChanged(true) }; return true
    }
    override func resignFirstResponder() -> Bool {
        guard super.resignFirstResponder() else { return false }
        if Self.awcFocusHolder === self { Self.awcFocusHolder = nil }
        requestingExplicitFocus = false
        configuration?.handle.isFocused = false; configuration?.focusChanged(false); return true
    }
    override var keyCommands: [UIKeyCommand]? {
        guard configuration?.inert == false else { return [] }
        var keys = ["\r", " ", "\t"]
        if configuration?.applicableGroup != nil { keys += [UIKeyCommand.inputLeftArrow, UIKeyCommand.inputRightArrow, UIKeyCommand.inputHome, UIKeyCommand.inputEnd] }
        if configuration?.applicableGroup?.vertical == true { keys += [UIKeyCommand.inputUpArrow, UIKeyCommand.inputDownArrow] }
        if awcUnhandledArrow != nil, configuration?.applicableGroup == nil, configuration?.routeKeyWithAlt == nil { keys += [UIKeyCommand.inputLeftArrow, UIKeyCommand.inputRightArrow] }
        if configuration?.intercept != nil { keys += [UIKeyCommand.inputUpArrow, UIKeyCommand.inputDownArrow, UIKeyCommand.inputEscape, "\t"] }
        if configuration?.routeKey != nil || configuration?.routeKeyWithAlt != nil {keys += [UIKeyCommand.inputLeftArrow,UIKeyCommand.inputRightArrow,UIKeyCommand.inputUpArrow,UIKeyCommand.inputDownArrow,UIKeyCommand.inputHome,UIKeyCommand.inputEnd,UIKeyCommand.inputEscape,"\t"]}
        var commands=Array(Set(keys)).map { input in
            let command = UIKeyCommand(input: input, modifierFlags: [], action: #selector(handleKey(_:)))
            command.wantsPriorityOverSystemBehavior = true; return command
        }
        do {let reverse=UIKeyCommand(input:"\t",modifierFlags:.shift,action:#selector(handleKey(_:)));reverse.wantsPriorityOverSystemBehavior=true;commands.append(reverse)}
        if configuration?.routeKeyWithAlt != nil {
            for key in [UIKeyCommand.inputUpArrow, UIKeyCommand.inputDownArrow] {
                let command = UIKeyCommand(input: key, modifierFlags: .alternate, action: #selector(handleKey(_:)))
                command.wantsPriorityOverSystemBehavior = true; commands.append(command)
            }
        }
        if configuration?.compositeKey != nil {
            let inputs = [UIKeyCommand.inputLeftArrow, UIKeyCommand.inputRightArrow, UIKeyCommand.inputUpArrow, UIKeyCommand.inputDownArrow, UIKeyCommand.inputHome,
                          UIKeyCommand.inputEnd, UIKeyCommand.inputPageUp, UIKeyCommand.inputPageDown, UIKeyCommand.inputEscape, "\r", " "]
            var wanted: [(String, UIKeyModifierFlags)] = inputs.flatMap { i in [UIKeyModifierFlags(), .shift, .alternate, .control].map { (i, $0) } }
            wanted += [("m", .shift), ("y", .shift)]
            for (input, flags) in wanted where !commands.contains(where: { $0.input == input && $0.modifierFlags == flags }) {
                let command = UIKeyCommand(input: input, modifierFlags: flags, action: #selector(handleKey(_:)))
                command.wantsPriorityOverSystemBehavior = true; commands.append(command)
            }
        }
        return commands
    }
    override func pressesBegan(_ presses: Set<UIPress>, with event: UIPressesEvent?) {
        if presses.contains(where: { $0.key != nil }) { configuration?.handle.showFocus = true }
        for press in presses {
            guard let key = press.key else { continue }
            // UIKit reports Backspace as "\u{8}" (AppKit: "\u{7F}") and forward Delete by key code; handlers take the key names.
            let text = key.keyCode == .keyboardDeleteOrBackspace ? "Backspace" : key.keyCode == .keyboardDeleteForward ? "Delete" : key.characters
            if text.count==1 || text=="Backspace" || text=="Delete",![" ","\r","\t"].contains(text),
               configuration?.routeKey?(text,key.modifierFlags.contains(.shift),!key.modifierFlags.intersection([.control,.alternate,.command]).isEmpty)==true {return}
        }
        super.pressesBegan(presses, with: event)
    }
    /// iPad: the release of a Tab that the focus engine took to focus this view from no focus (`AWCKeyViewEngineEntry`).
    override func pressesEnded(_ presses: Set<UIPress>, with event: UIPressesEvent?) {
        if AWCKeyViewEngineEntry.released(presses, at: self) { return }
        super.pressesEnded(presses, with: event)
    }
    @objc private func handleKey(_ command: UIKeyCommand) {
        AWCKeyViewEngineEntry.entered = nil
        // The key command is delivered to the view the focus system holds focus on, which after a system re-pick (see `didUpdateFocus`) can be
        // another AWC key view than the one that is first responder: the key belongs to the first responder, whichever callback ran first.
        if let holder = Self.awcFocusHolder, holder !== self, holder.isFirstResponder { holder.handleKey(command); return }
        guard let c = configuration, !c.inert else { return }
        c.handle.showFocus = true
        let key = command.input ?? ""
        let menuNames=[UIKeyCommand.inputLeftArrow:"ArrowLeft",UIKeyCommand.inputRightArrow:"ArrowRight",UIKeyCommand.inputUpArrow:"ArrowUp",UIKeyCommand.inputDownArrow:"ArrowDown",UIKeyCommand.inputHome:"Home",UIKeyCommand.inputEnd:"End",UIKeyCommand.inputEscape:"Escape","\t":"Tab","\r":"Enter"," ":"Space"]
        if let route = c.compositeKey {
            let f = command.modifierFlags, pages = [UIKeyCommand.inputPageUp: "PageUp", UIKeyCommand.inputPageDown: "PageDown"]
            let name = menuNames[key] ?? pages[key] ?? (f.contains(.shift) ? key.uppercased() : key)
            if route(AWCCompositeKey(key: name, shift: f.contains(.shift), alt: f.contains(.alternate), control: f.contains(.control), meta: f.contains(.command))) { return }
        }
        if c.intercept?(menuNames[key] ?? key, command.modifierFlags.contains(.shift)) == true { return }
        if c.routeKeyWithAlt?(menuNames[key] ?? key, command.modifierFlags.contains(.alternate)) == true { return }
        if c.routeKey?(menuNames[key] ?? key,command.modifierFlags.contains(.shift),!command.modifierFlags.intersection([.control,.alternate,.command]).isEmpty)==true {return}
        // An Escape no router used continues to an open modal (UIKit stops at this key command; AppKit's keyDown passes it on).
        if key == UIKeyCommand.inputEscape { if let window { AWCModalHostView.active(in: window)?.session?.escape() }; return }
        if key == "\t" { if let window { AWCKeyViewLoop.select(from: self, in: window, backward: command.modifierFlags.contains(.shift)) }; return }
        if key == "\r" || key == " " { c.keyPress?(); if !c.policy.activationBlocked { c.performActivation(.keyboard) }; return }
        let names = [UIKeyCommand.inputLeftArrow: "ArrowLeft", UIKeyCommand.inputRightArrow: "ArrowRight", UIKeyCommand.inputUpArrow: "ArrowUp", UIKeyCommand.inputDownArrow: "ArrowDown", UIKeyCommand.inputHome: "Home", UIKeyCommand.inputEnd: "End"]
        if let name = names[key] {
            if c.applicableGroup == nil, c.routeKeyWithAlt == nil, name == "ArrowLeft" || name == "ArrowRight", let fallback = awcUnhandledArrow { _ = fallback(name); return }
            _ = c.applicableGroup?.move(name, from: c.id)
        }
    }
    override func accessibilityActivate() -> Bool {
        guard let c = configuration, !c.inert, !c.policy.activationBlocked else { return false }; c.performActivation(.accessibility); return true
    }
    func accessibilityRowRange() -> NSRange { (awcCellOverride ?? configuration?.cell)?.rowRange ?? NSRange(location: NSNotFound, length: 0) }
    func accessibilityColumnRange() -> NSRange { (awcCellOverride ?? configuration?.cell)?.columnRange ?? NSRange(location: NSNotFound, length: 0) }
}
/// The native surface of `AWCNativeButtonFocusBridge` (NativeDocumentOrder.swift), which adds its document-order token.
struct AWCNativeButtonFocusSurface: UIViewRepresentable {
    let configuration: AWCNativeFocusConfiguration
    let token: AWCDocumentToken
    @Environment(\.awcNativeInert) private var inert
    @Environment(\.awcNativeKeyInterceptor) private var intercept
    @Environment(\.awcUnhandledArrow) private var unhandledArrow
    /// iOS 18+: the view under this bridge routes its touches to `configuration.touchPress` (`AWCFocusBridgeTouchLayer`).
    @Environment(\.awcTouchPressLink) private var touchLink
    func makeUIView(context: Context) -> AWCNativeButtonFocusView { AWCNativeButtonFocusView() }
    func updateUIView(_ view: AWCNativeButtonFocusView, context: Context) {
        var configuration = configuration; configuration.inert = configuration.inert || inert
        if configuration.intercept == nil { configuration.intercept = intercept }
        if let previous = view.configuration, previous.group !== configuration.group || previous.id != configuration.id { previous.group?.unregister(id: previous.id) }
        view.configuration = configuration; view.documentToken = token; view.backgroundColor = .clear; view.awcUnhandledArrow = unhandledArrow; touchLink?.view = view
        configuration.registerView?(view)
        view.isAccessibilityElement = !configuration.inert && !configuration.policy.ariaHidden && configuration.policy.role != .tabpanel; view.accessibilityIdentifier = configuration.id; view.accessibilityLabel = configuration.label
        // role=option is static text (+ selected), as WebKit exposes a listbox option and as the AppKit bridge reports it.
        var traits: UIAccessibilityTraits = configuration.policy.role == .link ? .link : configuration.policy.role == .option ? .staticText : .button
        // A switch is a toggle button whose value is 1/0 (SwiftUI Toggle); other selected controls carry the selected trait.
        if configuration.policy.role == .switch || configuration.policy.toggle { traits.insert(.toggleButton) } else if configuration.policy.selected { traits.insert(.selected) }; if configuration.policy.activationBlocked { traits.insert(.notEnabled) }
        if configuration.heading { traits.insert(.header) }
        // md-tab-panel's Tab stop (gate-7 R6-20) is a focusable container, not a control: no button trait, the semantic-group
        // container type and the panel's name (UIKit has no tab-panel role; the SwiftUI group stays the panel's element).
        if configuration.policy.role == .tabpanel { traits = [] }
        view.accessibilityTraits = traits
        view.accessibilityContainerType = configuration.policy.role == .tabpanel ? .semanticGroup : .none
        view.accessibilityValue=(configuration.disclosureExpanded ?? configuration.popup?.expanded ?? configuration.menuExpanded).map{$0 ? "Expanded":"Collapsed"}
        if configuration.policy.role == .radio || configuration.policy.role == .checkbox {view.accessibilityValue=configuration.policy.selected ? "Checked":"Unchecked"}
        if configuration.policy.role == .switch || configuration.policy.toggle {view.accessibilityValue=configuration.policy.selected ? "1":"0"}
        if configuration.policy.role == .checkbox && configuration.policy.mixed {view.accessibilityValue="Mixed"}
        view.accessibilityHint = configuration.policy.role == .gridcell ? "Grid cell" : configuration.policy.role == .menuitem ? "Menu item":configuration.policy.role == .radio ? "Radio button":configuration.policy.role == .checkbox ? "Checkbox":nil
        if configuration.policy.invalid && !configuration.policy.errorText.isEmpty { view.accessibilityHint = configuration.policy.errorText }
        if configuration.policy.role == .treeitem { view.accessibilityHint = configuration.treeLevel.map { "Level \($0)" } }
        if let popup=configuration.popup {
            view.accessibilityHint=popup.kind.map{($0=="true" ? "Menu":$0.capitalized)+" button"}
            view.accessibilityCustomActions=popup.target.map{target in [UIAccessibilityCustomAction(name:popup.focusActionLabel,actionHandler:{_ in target.focus()})]}
        } else {view.accessibilityCustomActions=nil}
        if let tooltip=configuration.tooltipDescription{view.accessibilityHint=[view.accessibilityHint,tooltip].compactMap{$0}.joined(separator:". ")}
        let focus = { [weak view] in view?.requestNativeFocus() ?? false }
        configuration.handle.requestFocus = focus; configuration.group?.register(id: configuration.id, requestFocus: focus)
        configuration.handle.requestPointerFocus = { [weak view] in view?.requestNativeFocus(showIndicator: false) ?? false }
        configuration.handle.resignFocus = { [weak view] in if let view, view.isFirstResponder { _ = view.resignFirstResponder() } }
        if (configuration.inert || !(configuration.policy.programmaticallyFocusable || configuration.policy.retainsFocusWhenDisabled)) && view.isFirstResponder {
            DispatchQueue.main.async { [weak view] in
                guard let view, view.isFirstResponder, let c = view.configuration, c.inert || !(c.policy.programmaticallyFocusable || c.policy.retainsFocusWhenDisabled) else { return }
                _ = view.resignFirstResponder()
            }
        }
    }
    static func dismantleUIView(_ view: AWCNativeButtonFocusView, coordinator: ()) {
        view.configuration?.group?.unregister(id: view.configuration?.id ?? ""); view.configuration?.handle.requestFocus = nil
        view.configuration?.handle.requestPointerFocus = nil
    }
}
#endif

extension View {
    /// Places an AWC focus bridge (the invisible native view that carries focus, keys and accessibility) with its content.
    /// AppKit: behind the content. UIKit: above it. The iPad focus system skips a view that SwiftUI's own focus item for a
    /// Button or Toggle occludes, even a `.focusable(false)` one (`UIFocusDebugger`: "visually occluded by
    /// UIKitFocusableViewResponderItem"), so a bridge behind one is never reached by Tab. The bridge never hit-tests
    /// (`point(inside:)` is false), so touches still reach the content below it.
    func awcFocusBridgeLayer<Bridge: View>(@ViewBuilder _ bridge: () -> Bridge) -> some View {
        #if canImport(AppKit)
        background(content: bridge)
        #else
        modifier(AWCFocusBridgeTouchLayer(bridge: bridge()))
        #endif
    }
}

struct AWCIconButtonFocusModifier: ViewModifier {
    let id: String
    let label: String
    let enabled: Bool
    let properties: [String: AWCValue]
    let group: AWCButtonFocusGroup?
    let handle: AWCButtonFocusHandle
    let focusChanged: ((String, Bool) -> Void)?
    let activate: () -> Void
    @ViewBuilder func body(content: Content) -> some View {
        if enabled {
            content.focusable(false).accessibilityHidden(true).awcFocusBridgeLayer {
                AWCNativeButtonFocusBridge(configuration: .init(id: id, label: label,
                    policy: .init(properties: properties), group: group, cell: nil, handle: handle,
                    focusChanged: { focusChanged?(id, $0) }, activate: activate)).accessibilityHidden(false)
            }
        } else { content }
    }
}

extension View {
    /// An open menu's container (Web role="menu"). macOS: an AppKit element with the menu role owns the items. iOS has no
    /// menu container trait, so the items stay a contained, labelled group of buttons.
    @ViewBuilder func awcMenuAccessibility(label: String, id: String) -> some View {
        #if canImport(AppKit)
        self.accessibilityHidden(true).background { AWCNativeContainerAccessibilityBridge(role: NSAccessibility.Role.menu.rawValue, label: label, identifier: id, level: 0, members: .menuItems) }
        #else
        self.accessibilityElement(children: .contain).accessibilityLabel(label).accessibilityIdentifier(id)
        #endif
    }
}
