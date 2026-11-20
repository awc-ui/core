import SwiftUI
#if canImport(AppKit)
import AppKit
import ObjectiveC
#endif

/// The accessibility role of a modal surface (md-dialog, md-bottom-sheet, the modal md-side-sheet), as the Web source declares
/// it on the surface: `role="dialog"` / `role="alertdialog"` with `aria-modal="true"`, and `aria-describedby` for md-dialog.
struct AWCModalSurfaceRole: Equatable {
    enum Kind: Equatable { case dialog, alertDialog }
    var kind: Kind, modal: Bool, description: String = ""
}

/// Attributes Chrome reports on macOS for a Web element that a SwiftUI container cannot express: AXSubrole, AXModal,
/// AXRoleDescription and AXGrabbed (aria-grabbed).
struct AWCContainerAccessibilityOverrides: Equatable {
    var subrole: String? = nil, modal: Bool? = nil, roleDescription: String? = nil, grabbed: Bool? = nil, help: String? = nil
}

extension View {
    /// macOS: the SwiftUI container that is the modal surface reports Chrome's mapping of the Web role: AXGroup with subrole
    /// AXApplicationDialog / AXApplicationAlertDialog, AXModal for aria-modal, the role description VoiceOver speaks, and the
    /// described-by text as AXHelp (Chrome reports aria-describedby as AXHelp). iOS keeps `isModal` (accessibilityViewIsModal), which is the platform's channel.
    func awcModalSurfaceAccessibility(id: String, role: AWCModalSurfaceRole?) -> some View {
        #if canImport(AppKit)
        self.awcContainerAccessibility(identifier: id + ".surface", role.map { r in
                .init(subrole: AWCContainerAccessibility.subrole(r), modal: r.modal, roleDescription: AWCContainerAccessibility.roleDescription(r),
                      help: r.description.isEmpty ? nil : r.description) })
        #else
        self
        #endif
    }
    /// macOS: extra attributes for this SwiftUI accessibility container (identified by `identifier`); nil removes them.
    /// iOS: no-op (UIKit has no channel for these attributes; WebKit on iOS does not expose them either).
    func awcContainerAccessibility(identifier: String, _ overrides: AWCContainerAccessibilityOverrides?) -> some View {
        #if canImport(AppKit)
        self.accessibilityIdentifier(identifier)
            .background { AWCContainerAccessibilityRegistration(identifier: identifier, overrides: overrides).accessibilityHidden(true).allowsHitTesting(false) }
        #else
        self
        #endif
    }
}

#if canImport(AppKit)
/// SwiftUI exposes a container (`accessibilityElement(children: .contain)`) as an AXGroup and has no API for its subrole,
/// AXModal or AXGrabbed. The container's element is SwiftUI's accessibility node (an NSObject answering the NSAccessibility
/// getters and the legacy attribute API). Its class is extended once: for the containers registered here, keyed by their
/// accessibility identifier, it answers the registered attributes; every other element keeps SwiftUI's answers.
enum AWCContainerAccessibility {
    private static let lock = NSLock()
    nonisolated(unsafe) private static var roles: [String: AWCContainerAccessibilityOverrides] = [:]
    nonisolated(unsafe) private static var extended = Set<ObjectIdentifier>()

    static func set(_ role: AWCContainerAccessibilityOverrides?, for identifier: String) {
        lock.lock(); roles[identifier] = role; lock.unlock()
        if role != nil { extendNodeClass() }
    }
    static func role(of element: AnyObject) -> AWCContainerAccessibilityOverrides? {
        let selector = NSSelectorFromString("accessibilityIdentifier")
        guard element.responds(to: selector), let id = element.perform(selector)?.takeUnretainedValue() as? String, !id.isEmpty else { return nil }
        lock.lock(); defer { lock.unlock() }
        return roles[id]
    }
    static func subrole(_ r: AWCModalSurfaceRole) -> String { r.kind == .alertDialog ? "AXApplicationAlertDialog" : "AXApplicationDialog" }
    static func roleDescription(_ r: AWCModalSurfaceRole) -> String { r.kind == .alertDialog ? "alert dialog" : "dialog" }

    /// SwiftUI's container element class (looked up by name; the identifier-gated overrides leave other elements unchanged).
    static func extendNodeClass() {
        for name in ["SwiftUI.AccessibilityNode", "_TtC7SwiftUI17AccessibilityNode"] {
            if let cls = NSClassFromString(name) { extend(cls); return }
        }
    }
    static func extend(_ cls: AnyClass) {
        lock.lock(); let fresh = extended.insert(ObjectIdentifier(cls)).inserted; lock.unlock()
        guard fresh else { return }
        typealias Getter = @convention(c) (AnyObject, Selector) -> Unmanaged<AnyObject>?
        typealias AttributeGetter = @convention(c) (AnyObject, Selector, NSString) -> Unmanaged<AnyObject>?
        typealias BoolGetter = @convention(c) (AnyObject, Selector) -> Bool
        func ownMethod(_ sel: Selector) -> Method? {
            var count: UInt32 = 0; guard let list = class_copyMethodList(cls, &count) else { return nil }
            defer { free(list) }
            return (0..<Int(count)).map { list[$0] }.first { method_getName($0) == sel }
        }
        func install(_ name: String, _ types: String, _ make: (IMP?, Selector) -> IMP) {
            let sel = NSSelectorFromString(name)
            let inherited = class_getInstanceMethod(cls, sel).map(method_getImplementation)
            let imp = make(inherited, sel)
            if let own = ownMethod(sel) { method_setImplementation(own, imp) } else { class_addMethod(cls, sel, imp, types) }
        }
        install("accessibilitySubrole", "@@:") { original, sel in
            let block: @convention(block) (AnyObject) -> AnyObject? = { obj in
                if let s = role(of: obj)?.subrole { return s as NSString }
                return original.flatMap { unsafeBitCast($0, to: Getter.self)(obj, sel)?.takeUnretainedValue() }
            }
            return imp_implementationWithBlock(block)
        }
        install("accessibilityRoleDescription", "@@:") { original, sel in
            let block: @convention(block) (AnyObject) -> AnyObject? = { obj in
                if let d = role(of: obj)?.roleDescription { return d as NSString }
                return original.flatMap { unsafeBitCast($0, to: Getter.self)(obj, sel)?.takeUnretainedValue() }
            }
            return imp_implementationWithBlock(block)
        }
        install("accessibilityHelp", "@@:") { original, sel in
            let block: @convention(block) (AnyObject) -> AnyObject? = { obj in
                if let h = role(of: obj)?.help { return h as NSString }
                return original.flatMap { unsafeBitCast($0, to: Getter.self)(obj, sel)?.takeUnretainedValue() }
            }
            return imp_implementationWithBlock(block)
        }
        install("isAccessibilityModal", "B@:") { original, sel in
            let block: @convention(block) (AnyObject) -> Bool = { obj in
                if let m = role(of: obj)?.modal { return m }
                return original.map { unsafeBitCast($0, to: BoolGetter.self)(obj, sel) } ?? false
            }
            return imp_implementationWithBlock(block)
        }
        install("accessibilityAttributeValue:", "@@:@") { original, sel in
            let block: @convention(block) (AnyObject, NSString) -> AnyObject? = { obj, attribute in
                if let r = role(of: obj) {
                    switch attribute as String {
                    case "AXSubrole": if let s = r.subrole { return s as NSString }
                    case "AXModal": if let m = r.modal { return NSNumber(value: m) }
                    case "AXRoleDescription": if let d = r.roleDescription { return d as NSString }
                    case "AXGrabbed": if let g = r.grabbed { return NSNumber(value: g) }
                    case "AXHelp": if let h = r.help { return h as NSString }
                    default: break
                    }
                }
                return original.flatMap { unsafeBitCast($0, to: AttributeGetter.self)(obj, sel, attribute)?.takeUnretainedValue() }
            }
            return imp_implementationWithBlock(block)
        }
        install("accessibilityAttributeNames", "@@:") { original, sel in
            let block: @convention(block) (AnyObject) -> AnyObject? = { obj in
                let names = original.flatMap { unsafeBitCast($0, to: Getter.self)(obj, sel)?.takeUnretainedValue() as? [String] } ?? []
                guard let r = role(of: obj) else { return names as NSArray }
                let extra = [r.subrole.map { _ in "AXSubrole" }, r.modal.map { _ in "AXModal" }, r.roleDescription.map { _ in "AXRoleDescription" }, r.grabbed.map { _ in "AXGrabbed" }, r.help.map { _ in "AXHelp" }].compactMap { $0 }
                return (names + extra.filter { !names.contains($0) }) as NSArray
            }
            return imp_implementationWithBlock(block)
        }
    }
}

/// Registers the container's attributes while it is mounted.
struct AWCContainerAccessibilityRegistration: NSViewRepresentable {
    let identifier: String, overrides: AWCContainerAccessibilityOverrides?
    final class Anchor: NSView { var registeredID = ""; override func hitTest(_ point: NSPoint) -> NSView? { nil } }
    func makeNSView(context: Context) -> Anchor { let v = Anchor(); v.registeredID = identifier; AWCContainerAccessibility.set(overrides, for: identifier); return v }
    func updateNSView(_ view: Anchor, context: Context) {
        if view.registeredID != identifier { AWCContainerAccessibility.set(nil, for: view.registeredID); view.registeredID = identifier }
        AWCContainerAccessibility.set(overrides, for: identifier)
    }
    static func dismantleNSView(_ view: Anchor, coordinator: ()) { AWCContainerAccessibility.set(nil, for: view.registeredID) }
}
#endif
