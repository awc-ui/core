import AppKit
import SwiftUI
import Observation
import AWCUI

@Observable final class BehaviorFixtureState { var showSecond = true }
struct BehaviorFixture: View {
    let outer: AWCFormState
    let inner: AWCFormState
    let state: BehaviorFixtureState
    var body: some View {
        AWCFormScope(form: outer) {
            VStack {
                // All three convenience wrappers intentionally use the same node.id.
                AWCNativeView(tag: "md-text-field", properties: ["name": "first", "value": "Ada", "label": "First", "required": true, "minLength": .number(1e100), "maxLength": "nan"])
                if state.showSecond { AWCNativeView(tag: "md-text-field", properties: ["name": "second", "value": "Grace", "label": "Second", "required": true]) }
                AWCFormScope(form: inner) { AWCNativeView(tag: "md-text-field", properties: ["name": "inner", "value": "Lin", "label": "Nested"]) }
            }.padding(20)
        }
    }
}

@main @MainActor enum NativeBehaviorViewIntegration {
    static var count = 0
    static func check(_ valid: Bool, _ description: String) {
        count += 1; guard valid else { fatalError(description) }
    }
    static func pump(_ duration: TimeInterval = 0.25) {
        let end = Date().addingTimeInterval(duration)
        while Date() < end { _ = RunLoop.current.run(mode: .default, before: Date().addingTimeInterval(0.01)) }
    }
    static func fields(_ view: NSView) -> [NSTextField] { (view as? NSTextField).map { [$0] } ?? view.subviews.flatMap(fields) }
    static func main() {
        let app = NSApplication.shared; app.setActivationPolicy(.accessory)
        let outer = AWCFormState(), inner = AWCFormState(), state = BehaviorFixtureState()
        let host = NSHostingView(rootView: BehaviorFixture(outer: outer, inner: inner, state: state))
        let window = NSWindow(contentRect: NSRect(x: -20000, y: -20000, width: 600, height: 400), styleMask: [.borderless], backing: .buffered, defer: false)
        window.isReleasedWhenClosed = false; window.contentView = host; window.orderFrontRegardless()
        host.layoutSubtreeIfNeeded(); pump(0.5)
        check(outer.entries.count == 2, "Same-tag convenience views must register two independent fields")
        check(Set(outer.entries.map(\.id)).count == 2, "Per-view form identities must be distinct")
        check(outer.values == ["first": "Ada", "second": "Grace"], "Both named values participate")
        check(inner.values == ["inner": "Lin"] && outer.values["inner"] == nil, "Nearest nested form owns its field")
        let identities = Set(outer.entries.map(\.id))
        guard let first = fields(host).first(where: { $0.stringValue == "Ada" }) else { fatalError("First native text field must exist") }
        first.stringValue = "Ada edited"
        first.delegate?.controlTextDidChange?(Notification(name: NSControl.textDidChangeNotification, object: first))
        pump()
        check(outer.values["first"] == "Ada edited", "Extreme invalid length constraints do not crash native editing")
        outer.reset(); pump()
        guard let second = fields(host).first(where: { $0.stringValue == "Grace" }) else { fatalError("Native NSTextField must exist") }
        second.stringValue = "Hopper"
        second.delegate?.controlTextDidChange?(Notification(name: NSControl.textDidChangeNotification, object: second))
        pump()
        check(outer.values == ["first": "Ada", "second": "Hopper"], "Native text editing updates only its registered field")
        check(Set(outer.entries.map(\.id)) == identities, "SwiftUI updates retain form registration identity")
        outer.reset(); pump()
        check(outer.values == ["first": "Ada", "second": "Grace"], "Reset restores both initial form values")
        check(fields(host).contains(where: { $0.stringValue == "Grace" }), "Reset updates the actual native text control")
        check(inner.values == ["inner": "Lin"], "Outer reset leaves nested form unchanged")
        state.showSecond = false; pump()
        check(outer.entries.count == 1 && outer.values["second"] == nil, "Disappearing native field unregisters")
        window.close(); pump()
        print("Passed \(count) real SwiftUI form registration, native editing, reset and nested-scope checks.")
    }
}
