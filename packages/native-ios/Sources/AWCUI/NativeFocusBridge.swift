import SwiftUI

private struct AWCButtonFocusGroupKey: EnvironmentKey { static let defaultValue: AWCButtonFocusGroup? = nil }
private struct AWCNativeFocusChangedKey: EnvironmentKey { static let defaultValue: ((String, Bool) -> Void)? = nil }
private struct AWCGridCellContextKey: EnvironmentKey { static let defaultValue: AWCGridCellContext? = nil }
public extension EnvironmentValues {
    var awcNativeFocusChanged: ((String, Bool) -> Void)? { get { self[AWCNativeFocusChangedKey.self] } set { self[AWCNativeFocusChangedKey.self] = newValue } }
    var awcButtonFocusGroup: AWCButtonFocusGroup? { get { self[AWCButtonFocusGroupKey.self] } set { self[AWCButtonFocusGroupKey.self] = newValue } }
    var awcGridCellContext: AWCGridCellContext? { get { self[AWCGridCellContextKey.self] } set { self[AWCGridCellContextKey.self] = newValue } }
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
    /// The control is the button of a heading (an accordion header): iOS adds the header trait.
    var heading: Bool = false
    var inert = false
    /// md-tab: the accessibility element of the panel it controls (Web aria-controls; macOS AXLinkedUIElements).
    var controls: (() -> AnyObject?)? = nil
    /// Called with the native focus surface on every update (md-tab-panel registers its surface for its tab's link).
    var registerView: ((AnyObject) -> Void)? = nil
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
        if c.routeKeyWithAlt?(key, event.modifierFlags.contains(.option)) == true { return }
        if c.routeKey?(key,event.modifierFlags.contains(.shift),!event.modifierFlags.intersection([.control,.option,.command]).isEmpty) == true {return}
        if key=="Tab" {if event.modifierFlags.contains(.shift) {window?.selectPreviousKeyView(self)} else {window?.selectNextKeyView(self)};return}
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

struct AWCNativeButtonFocusBridge: NSViewRepresentable {
    let configuration: AWCNativeFocusConfiguration
    @Environment(\.awcNativeInert) private var inert
    func makeNSView(context: Context) -> AWCNativeButtonFocusView { AWCNativeButtonFocusView() }
    func updateNSView(_ view: AWCNativeButtonFocusView, context: Context) {
        var configuration = configuration; configuration.inert = configuration.inert || inert
        if let previous = view.configuration, previous.group !== configuration.group || previous.id != configuration.id { previous.group?.unregister(id: previous.id) }
        view.configuration = configuration
        configuration.registerView?(view)
        let focus = { [weak view] in view?.requestNativeFocus() ?? false }
        configuration.handle.requestFocus = focus; configuration.group?.register(id: configuration.id, requestFocus: focus)
        configuration.handle.requestPointerFocus = { [weak view] in view?.requestNativeFocus(showIndicator: false) ?? false }
        configuration.handle.resignFocus = { [weak view] in if let view, view.window?.firstResponder === view { _ = view.window?.makeFirstResponder(nil) } }
        if (configuration.inert || !configuration.policy.programmaticallyFocusable) && view.window?.firstResponder === view { _ = view.window?.makeFirstResponder(nil) }
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
    /// Escape/Tab of an open modal reach its host through this chain (see `AWCModalHostView.active(in:)`).
    override var next: UIResponder? { AWCModalHostView.active(in: window) ?? super.next }
    override var canBecomeFirstResponder: Bool { configuration?.inert == false && configuration?.policy.programmaticallyFocusable == true }
    // AppKit key-view surface (see NativeKeyViewLoop.swift): sequential focus follows the same policy as AppKit `canBecomeKeyView`.
    var awcAcceptsFirstResponder: Bool { canBecomeFirstResponder }
    var awcCanBecomeKeyView: Bool { configuration?.sequential == true && window != nil && !isHidden }
    func awcBecomeKeyView() -> Bool { requestNativeFocus(showIndicator: true) }
    /// iPad keyboard focus (focus system present): Tab moves between focus groups, so each sequential AWC focus view is
    /// its own group and the system enters the AWC key-view loop at the first one (iPhone has no focus system).
    override var focusGroupIdentifier: String? { get { awcCanBecomeKeyView ? "awc.key-view.\(UInt(bitPattern: ObjectIdentifier(self).hashValue))" : nil } set {} }
    private var requestingExplicitFocus = false
    private var requestedFocusIndicator: Bool?
    override var canBecomeFocused: Bool { configuration?.inert == false && configuration?.policy.programmaticallyFocusable == true && (requestingExplicitFocus || configuration?.sequential == true) }
    override func didUpdateFocus(in context: UIFocusUpdateContext, with coordinator: UIFocusAnimationCoordinator) {
        super.didUpdateFocus(in: context, with: coordinator)
        if context.nextFocusedItem === self { _ = becomeFirstResponder() }
        else if context.previouslyFocusedItem === self { _ = resignFirstResponder() }
    }
    func requestNativeFocus(showIndicator: Bool = true) -> Bool {
        guard canBecomeFirstResponder else { return false }
        requestedFocusIndicator = showIndicator
        defer { requestedFocusIndicator = nil }
        configuration?.handle.showFocus = showIndicator
        requestingExplicitFocus = true
        if let system = UIFocusSystem.focusSystem(for: self) {
            system.requestFocusUpdate(to: self); system.updateFocusIfNeeded()
        }
        let accepted = becomeFirstResponder()
        if !accepted { requestingExplicitFocus = false }
        return accepted
    }
    /// Touches reach the SwiftUI content below; the bridge is hit only by `AWCTouchPressRouter`'s target probe.
    override func point(inside point: CGPoint, with event: UIEvent?) -> Bool { AWCTouchPressRouter.probes(self) && bounds.contains(point) }
    override func didMoveToWindow() { super.didMoveToWindow(); if let window { AWCTouchPressRouter.install(in: window) } }
    override func becomeFirstResponder() -> Bool {
        if isFirstResponder { return true }
        guard super.becomeFirstResponder() else { return false }
        configuration?.handle.showFocus = requestedFocusIndicator ?? true
        configuration?.handle.isFocused = true
        if let c = configuration { c.group?.didFocus(id: c.id); c.focusChanged(true) }; return true
    }
    override func resignFirstResponder() -> Bool {
        guard super.resignFirstResponder() else { return false }
        requestingExplicitFocus = false
        configuration?.handle.isFocused = false; configuration?.focusChanged(false); return true
    }
    override var keyCommands: [UIKeyCommand]? {
        guard configuration?.inert == false else { return [] }
        var keys = ["\r", " ", "\t"]
        if configuration?.applicableGroup != nil { keys += [UIKeyCommand.inputLeftArrow, UIKeyCommand.inputRightArrow, UIKeyCommand.inputHome, UIKeyCommand.inputEnd] }
        if configuration?.applicableGroup?.vertical == true { keys += [UIKeyCommand.inputUpArrow, UIKeyCommand.inputDownArrow] }
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
    @objc private func handleKey(_ command: UIKeyCommand) {
        guard let c = configuration, !c.inert else { return }
        c.handle.showFocus = true
        let key = command.input ?? ""
        let menuNames=[UIKeyCommand.inputLeftArrow:"ArrowLeft",UIKeyCommand.inputRightArrow:"ArrowRight",UIKeyCommand.inputUpArrow:"ArrowUp",UIKeyCommand.inputDownArrow:"ArrowDown",UIKeyCommand.inputHome:"Home",UIKeyCommand.inputEnd:"End",UIKeyCommand.inputEscape:"Escape","\t":"Tab","\r":"Enter"," ":"Space"]
        if c.routeKeyWithAlt?(menuNames[key] ?? key, command.modifierFlags.contains(.alternate)) == true { return }
        if c.routeKey?(menuNames[key] ?? key,command.modifierFlags.contains(.shift),!command.modifierFlags.intersection([.control,.alternate,.command]).isEmpty)==true {return}
        // An Escape no router used continues to an open modal (UIKit stops at this key command; AppKit's keyDown passes it on).
        if key == UIKeyCommand.inputEscape { if let window { AWCModalHostView.active(in: window)?.session?.escape() }; return }
        if key == "\t" { if let window { AWCKeyViewLoop.select(from: self, in: window, backward: command.modifierFlags.contains(.shift)) }; return }
        if key == "\r" || key == " " { c.keyPress?(); if !c.policy.activationBlocked { c.performActivation(.keyboard) }; return }
        let names = [UIKeyCommand.inputLeftArrow: "ArrowLeft", UIKeyCommand.inputRightArrow: "ArrowRight", UIKeyCommand.inputUpArrow: "ArrowUp", UIKeyCommand.inputDownArrow: "ArrowDown", UIKeyCommand.inputHome: "Home", UIKeyCommand.inputEnd: "End"]
        if let name = names[key] { _ = c.applicableGroup?.move(name, from: c.id) }
    }
    override func accessibilityActivate() -> Bool {
        guard let c = configuration, !c.inert, !c.policy.activationBlocked else { return false }; c.performActivation(.accessibility); return true
    }
    func accessibilityRowRange() -> NSRange { configuration?.cell?.rowRange ?? NSRange(location: NSNotFound, length: 0) }
    func accessibilityColumnRange() -> NSRange { configuration?.cell?.columnRange ?? NSRange(location: NSNotFound, length: 0) }
}
struct AWCNativeButtonFocusBridge: UIViewRepresentable {
    let configuration: AWCNativeFocusConfiguration
    @Environment(\.awcNativeInert) private var inert
    func makeUIView(context: Context) -> AWCNativeButtonFocusView { AWCNativeButtonFocusView() }
    func updateUIView(_ view: AWCNativeButtonFocusView, context: Context) {
        var configuration = configuration; configuration.inert = configuration.inert || inert
        if let previous = view.configuration, previous.group !== configuration.group || previous.id != configuration.id { previous.group?.unregister(id: previous.id) }
        view.configuration = configuration; view.backgroundColor = .clear
        configuration.registerView?(view)
        view.isAccessibilityElement = !configuration.inert && !configuration.policy.ariaHidden && configuration.policy.role != .tabpanel; view.accessibilityIdentifier = configuration.id; view.accessibilityLabel = configuration.label
        // role=option is static text (+ selected), as WebKit exposes a listbox option and as the AppKit bridge reports it.
        var traits: UIAccessibilityTraits = configuration.policy.role == .link ? .link : configuration.policy.role == .option ? .staticText : .button
        // A switch is a toggle button whose value is 1/0 (SwiftUI Toggle); other selected controls carry the selected trait.
        if configuration.policy.role == .switch || configuration.policy.toggle { traits.insert(.toggleButton) } else if configuration.policy.selected { traits.insert(.selected) }; if configuration.policy.activationBlocked { traits.insert(.notEnabled) }
        if configuration.heading { traits.insert(.header) }
        view.accessibilityTraits = traits
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
        if (configuration.inert || !configuration.policy.programmaticallyFocusable) && view.isFirstResponder { _ = view.resignFirstResponder() }
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
        overlay(content: bridge)
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
