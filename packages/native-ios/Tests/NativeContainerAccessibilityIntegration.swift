import AppKit
import SwiftUI
import Observation
import AWCUI

// d3 (R4-03, r3-09): macOS attributes Chrome reports for Web elements that SwiftUI containers cannot express — the modal
// surfaces' dialog/alertdialog subrole, AXModal, role description and aria-describedby help (md-dialog, md-bottom-sheet, modal
// md-side-sheet), and md-card's aria-grabbed (AXGrabbed) on its container or button element. Read in process with the
// accessibility tree enabled (AXManualAccessibility), through the same NSAccessibility entry points the AX server uses.
@Observable final class ContainerAXState { var nodes: [AWCNode] = []; var epoch = 0 }
struct ContainerAXFixture: View {
    let state: ContainerAXState
    var body: some View {
        AWCModalScope {
            VStack(alignment: .leading, spacing: 16) { ForEach(state.nodes, id: \.id) { AWCNativeView(node: $0).frame(maxWidth: 320, alignment: .leading) } }
                .padding(24).frame(width: 640, height: 480, alignment: .topLeading)
        }
        .awcModalReducedMotion(true).awcTheme(.generated()).frame(width: 640, height: 480).id(state.epoch)
    }
}
@main @MainActor enum NativeContainerAccessibilityIntegration {
    static var checks = 0, failures: [String] = []
    static func check(_ ok: Bool, _ m: String) { checks += 1; if !ok { failures.append(m) } }
    static func pump(_ t: Double) { let end = Date().addingTimeInterval(t); while Date() < end { _ = RunLoop.current.run(mode: .default, before: Date().addingTimeInterval(0.005)) } }
    static func elements(_ e: AnyObject) -> [AnyObject] {
        let kids = (e.accessibilityChildren?() ?? []).map { $0 as AnyObject }
        return [e] + kids.flatMap(elements)
    }
    static func ident(_ e: AnyObject) -> String? { e.responds(to: NSSelectorFromString("accessibilityIdentifier")) ? e.perform(NSSelectorFromString("accessibilityIdentifier"))?.takeUnretainedValue() as? String : nil }
    static func attr(_ e: AnyObject, _ name: String) -> Any? { e.accessibilityAttributeValue?(NSAccessibility.Attribute(rawValue: name)) }
    static func views(_ v: NSView) -> [NSView] { [v] + v.subviews.flatMap(views) }
    static func main() {
        _ = NSApplication.shared; NSApp.setActivationPolicy(.accessory)
        let state = ContainerAXState(), host = NSHostingView(rootView: ContainerAXFixture(state: state))
        let window = NSWindow(contentRect: .init(x: -20000, y: -20000, width: 640, height: 480), styleMask: .borderless, backing: .buffered, defer: false)
        window.isReleasedWhenClosed = false; window.contentView = host; window.orderFrontRegardless()
        NSApp.accessibilitySetValue(true, forAttribute: NSAccessibility.Attribute(rawValue: "AXManualAccessibility"))
        func show(_ nodes: [AWCNode]) {
            state.nodes = nodes; state.epoch += 1; host.layoutSubtreeIfNeeded(); pump(0.6)
            // As an assistive client does: the window's tree is requested, which builds SwiftUI's accessibility nodes.
            NSApp.accessibilitySetValue(true, forAttribute: NSAccessibility.Attribute(rawValue: "AXManualAccessibility"))
            NSApp.accessibilitySetValue(true, forAttribute: NSAccessibility.Attribute(rawValue: "AXEnhancedUserInterface"))
            _ = window.accessibilityChildren(); _ = host.accessibilityChildren(); pump(0.4); _ = elements(host); pump(0.2)
        }
        func element(_ id: String) -> AnyObject? { elements(host).first { ident($0) == id } }
        func surface(_ label: String, _ id: String, subrole: String?, modal: Bool?, description: String?, help: String?) {
            guard let e = element(id + ".surface") else { check(subrole == nil, "\(label): surface element \(id).surface present"); return }
            check(attr(e, "AXSubrole") as? String == subrole, "\(label): AXSubrole \(String(describing: attr(e, "AXSubrole"))) vs \(String(describing: subrole))")
            check((attr(e, "AXModal") as? NSNumber)?.boolValue == modal, "\(label): AXModal \(String(describing: attr(e, "AXModal"))) vs \(String(describing: modal))")
            check(attr(e, "AXRoleDescription") as? String == description || description == nil, "\(label): AXRoleDescription \(String(describing: attr(e, "AXRoleDescription")))")
            let sub = e.responds(to: NSSelectorFromString("accessibilitySubrole")) ? e.perform(NSSelectorFromString("accessibilitySubrole"))?.takeUnretainedValue() as? String : nil
            check(sub == subrole, "\(label): accessibilitySubrole() \(String(describing: sub))")
            if let help { let h = e.perform(NSSelectorFromString("accessibilityHelp"))?.takeUnretainedValue() as? String; check(h == help && attr(e, "AXHelp") as? String == help, "\(label): AXHelp \(String(describing: h)) vs \(help)") }
        }
        show([AWCNode(id: "dg", tag: "md-dialog", properties: ["open": true, "headline": "Project details"], children: [.text("Every great project starts with a shared workspace.")])])
        surface("md-dialog", "dg", subrole: "AXApplicationAlertDialog", modal: true, description: "alert dialog", help: "Every great project starts with a shared workspace.")
        show([AWCNode(id: "fs", tag: "md-dialog", properties: ["open": true, "fullscreen": true, "headline": "Edit"], children: [.text("Body")])])
        surface("md-dialog fullscreen", "fs", subrole: "AXApplicationDialog", modal: true, description: "dialog", help: "Body")
        show([AWCNode(id: "bs", tag: "md-bottom-sheet", properties: ["open": true, "headline": "Sheet"], children: [.text("Body")])])
        surface("md-bottom-sheet", "bs", subrole: "AXApplicationDialog", modal: true, description: "dialog", help: nil)
        show([AWCNode(id: "ss", tag: "md-side-sheet", properties: ["open": true, "variant": "modal", "headline": "Filters"], children: [.text("Body")])])
        surface("md-side-sheet modal", "ss", subrole: "AXApplicationDialog", modal: true, description: "dialog", help: nil)
        show([AWCNode(id: "sr", tag: "md-side-sheet", properties: ["open": true, "headline": "Filters"], children: [.text("Body")])])
        surface("md-side-sheet standard (region)", "sr", subrole: nil, modal: nil, description: nil, help: nil)
        // md-card aria-grabbed: false while drag-enabled (true while dragged), absent otherwise.
        show([AWCNode(id: "cd", tag: "md-card", properties: ["dragEnabled": true], children: [.text("Drag me")]),
              AWCNode(id: "cb", tag: "md-card", properties: ["dragEnabled": true, "interactive": true], children: [.text("Open")]),
              AWCNode(id: "cn", tag: "md-card", properties: ["interactive": true], children: [.text("Plain")])])
        if let e = element("cd") { check((attr(e, "AXGrabbed") as? NSNumber)?.boolValue == false, "container card AXGrabbed \(String(describing: attr(e, "AXGrabbed"))) vs false") }
        else { check(false, "container card element cd present") }
        let bridges = views(host).filter { String(describing: type(of: $0)).contains("ButtonFocusView") }
        if let b = bridges.first(where: { $0.accessibilityIdentifier() == "cb" }) { check((b.accessibilityAttributeValue(NSAccessibility.Attribute(rawValue: "AXGrabbed")) as? NSNumber)?.boolValue == false, "button card AXGrabbed false") }
        else { check(false, "button card focus element cb present (\(bridges.map { $0.accessibilityIdentifier() }))") }
        if let b = bridges.first(where: { $0.accessibilityIdentifier() == "cn" }) { check(b.accessibilityAttributeValue(NSAccessibility.Attribute(rawValue: "AXGrabbed")) == nil, "a card without drag reports no AXGrabbed") }
        if !failures.isEmpty { let all = elements(host); print("DIAG elements \(all.count): " + all.compactMap { ident($0) }.filter { !$0.isEmpty }.joined(separator: ", ")); print("DIAG classes: " + Set(all.map { String(describing: type(of: $0)) }).joined(separator: ", ")) }
        print("Container accessibility: \(checks - failures.count)/\(checks) checks passed")
        failures.forEach { print("FAIL: " + $0) }
        window.close(); if !failures.isEmpty { exit(1) }
    }
}
