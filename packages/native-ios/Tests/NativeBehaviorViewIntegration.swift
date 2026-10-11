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
        while Date() < end {
            while let event = NSApp.nextEvent(matching: .any, until: .distantPast, inMode: .default, dequeue: true) { NSApp.sendEvent(event) }
            _ = RunLoop.current.run(mode: .default, before: Date().addingTimeInterval(0.01))
        }
    }
    static func fields(_ view: NSView) -> [NSTextField] { (view as? NSTextField).map { [$0] } ?? view.subviews.flatMap(fields) }
    static func main() {
        setbuf(stdout, nil)
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
        let extended = AWCFormState(), nested = AWCFormState()
        let registry = AWCFormRegistry(["outer": extended])
        var events: [AWCEvent] = []; var submissions = 0; var encoded = ""
        extended.onSubmit = { submission in submissions += 1; encoded = submission.formURLEncoded() }
        let host2 = NSHostingView(rootView: ExtendedBehaviorFixture(form: extended, nested: nested, registry: registry, observe: { events.append($0) }))
        let window2 = NSWindow(contentRect: NSRect(x: -20000, y: -20000, width: 600, height: 1800), styleMask: [.borderless], backing: .buffered, defer: false)
        window2.isReleasedWhenClosed = false; window2.contentView = host2; window2.orderFrontRegardless(); host2.layoutSubtreeIfNeeded(); pump(0.5)
        check(extended.values["multi"] == ["a", "b"] && extended.values["start"] == "2" && extended.values["end"] == "8", "Actual composite controls auto-register ordered multi-values and range endpoints")
        check(extended.values["date"] == "2026-10-11" && extended.values["time"] == "23:30" && extended.values["rating"] == "3" && extended.values["otp"] == "123456", "Actual date/time/rating/OTP controls auto-register")
        check(extended.values["select"] == "a" && extended.values["auto"] == "a" && extended.values["number"] == "4", "Actual select/autocomplete/number controls auto-register")
        check(extended.values["external"] == "Owner" && nested.values["external"] == nil && nested.values["choice"] == "inner", "Explicit native owner overrides nearest form and radio groups stay isolated")
        let initialDuplicateRadioWinner = extended.values["duplicate-default"]
        func click(_ x: CGFloat, _ y: CGFloat) {
            let point = NSPoint(x: x, y: window2.contentView!.bounds.height - y)
            let time = ProcessInfo.processInfo.systemUptime
            let down = NSEvent.mouseEvent(with: .leftMouseDown, location: point, modifierFlags: [], timestamp: time, windowNumber: window2.windowNumber, context: nil, eventNumber: 1, clickCount: 1, pressure: 1)!
            let up = NSEvent.mouseEvent(with: .leftMouseUp, location: point, modifierFlags: [], timestamp: time + 0.01, windowNumber: window2.windowNumber, context: nil, eventNumber: 2, clickCount: 1, pressure: 0)!
            app.postEvent(up, atStart: false); window2.sendEvent(down); pump()
        }
        click(80, 112)
        check(extended.values["accept"] == "on" && events.contains { $0.nodeID == "check" && $0.name == "mdChange" }, "Real native checkbox pointer changes successful form value")
        click(80, 200)
        check(extended.entries.filter { $0.name == "choice" }.count == 1 && events.contains { $0.nodeID == "radio-b" && $0.name == "mdChange" }, "Real radio click leaves one successful control even with equal values")
        check(nested.values["choice"] == "inner", "Real outer radio click does not alter nested same-name group")
        extended.reset(); pump()
        check(extended.values["accept"] == nil && extended.values["otp"] == nil && extended.entries.filter { $0.name == "choice" }.count == 1, "Reset restores native checkbox/radio and clears source OTP")
        check(extended.entries.filter { $0.name == "duplicate-default" }.count == 1 && extended.values["duplicate-default"] == initialDuplicateRadioWinner, "Actual radio bindings reset multiple checked defaults to the initial registered winner")
        guard let numberText = fields(host2).first(where: { $0.stringValue == "1" }) else { fatalError("Number-type text field must exist") }
        numberText.stringValue = "2"; numberText.delegate?.controlTextDidChange?(Notification(name: NSControl.textDidChangeNotification, object: numberText)); pump()
        check(!extended.validate(), "Edited numeric input retains authored step base: initial1 step2 edited2 invalid")
        numberText.stringValue = "3"; numberText.delegate?.controlTextDidChange?(Notification(name: NSControl.textDidChangeNotification, object: numberText)); pump()
        check(extended.validate(), "Initial1 step2 edited3 satisfies stable step base")
        guard let name = fields(host2).first(where: { $0.stringValue == "Ada" }) else { fatalError("Enter text field must exist") }
        name.selectText(nil); pump()
        guard let client = window2.firstResponder as? NSTextInputClient else { fatalError("Native field editor must receive Enter") }
        events = []; client.doCommand(by: NSSelectorFromString("insertNewline:")); pump()
        check(submissions == 1 && events.map(\.name).contains("mdClick") && events.map(\.name).contains("mdSubmit"), "Real native Enter activates default md-button then submits")
        check(encoded.contains("name=Ada") && encoded.contains("multi=a&multi=b"), "Native Enter submission produces ordered local encoded data")
        name.stringValue = ""; name.delegate?.controlTextDidChange?(Notification(name: NSControl.textDidChangeNotification, object: name)); name.selectText(nil); pump()
        (window2.firstResponder as? NSTextInputClient)?.doCommand(by: NSSelectorFromString("insertNewline:")); pump()
        check(submissions == 1 && !extended.validationMessages.isEmpty && events.contains { $0.name == "mdInvalid" }, "Actual Enter validates and prevents invalid form effects")
        extended.reset(); pump(); extended.onEvent = { context in if context.event.name == "mdSubmit" { context.preventDefault() } }
        name.selectText(nil); pump(); (window2.firstResponder as? NSTextInputClient)?.doCommand(by: NSSelectorFromString("insertNewline:")); pump()
        check(submissions == 1 && events.contains { $0.name == "mdSubmit" && $0.defaultPrevented }, "Actual Enter respects cancelable form submit event")
        extended.onEvent = { _ in }; window2.close(); pump()

        print("Passed \(count) real SwiftUI form registration, native editing, reset and nested-scope checks.")
    }
}

struct ExtendedBehaviorFixture: View {
    let form: AWCFormState
    let nested: AWCFormState
    let registry: AWCFormRegistry
    let observe: (AWCEvent) -> Void
    var body: some View {
        AWCFormRegistryScope(registry: registry) {
            AWCFormScope(form: form) {
                VStack(alignment: .leading, spacing: 0) {
                    AWCNativeView(node: .init(id: "enter-field", tag: "md-text-field", properties: ["name": "name", "value": "Ada", "required": true]), onEvent: observe).frame(height: 70)
                    AWCNativeView(node: .init(id: "check", tag: "md-checkbox", properties: ["name": "accept", "label": "Accept", "checked": false, "indeterminate": true]), onEvent: observe).frame(height: 44)
                    AWCNativeView(node: .init(id: "radio-a", tag: "md-radio", properties: ["name": "choice", "label": "First choice", "value": "same", "checked": true, "required": true]), onEvent: observe).frame(height: 44)
                    AWCNativeView(node: .init(id: "radio-b", tag: "md-radio", properties: ["name": "choice", "label": "Second choice", "value": "same", "checked": false]), onEvent: observe).frame(height: 44)
                    AWCNativeView(node: .init(id: "switch", tag: "md-switch", properties: ["name": "enabled", "label": "Enable", "selected": true, "value": "yes"]), onEvent: observe).frame(height: 44)
                    AWCNativeView(node: .init(id: "default-submit", tag: "md-button", properties: ["type": "submit"], children: [.text("Send")]), onEvent: observe).frame(height: 60)
                    AWCFormScope(form: nested) {
                        AWCNativeView(tag: "md-radio", properties: ["name": "choice", "value": "inner", "checked": true])
                        AWCNativeView(tag: "md-text-field", properties: ["name": "external", "value": "Owner"]).awcFormOwner("outer")
                    }
                    AWCNativeView(tag: "md-text-field", properties: ["name": "step", "value": "1", "type": "number", "step": 2])
                    AWCNativeView(tag: "md-select", properties: ["name": "select", "value": "a"])
                    AWCNativeView(tag: "md-multi-select", properties: ["name": "multi", "value": ["a", "b"]])
                    AWCNativeView(tag: "md-autocomplete", properties: ["name": "auto", "value": "a"])
                    AWCNativeView(tag: "md-slider", properties: ["range": true, "nameStart": "start", "nameEnd": "end", "valueStart": 2, "valueEnd": 8])
                    AWCNativeView(tag: "md-number-field", properties: ["name": "number", "value": 4])
                    AWCNativeView(tag: "md-date-picker", properties: ["name": "date", "value": "2026-10-11"])
                    AWCNativeView(tag: "md-time-picker", properties: ["name": "time", "value": "23:30", "min": "22:00", "max": "06:00"])
                    AWCNativeView(tag: "md-rating", properties: ["name": "rating", "value": 3])
                    AWCNativeView(tag: "md-otp-field", properties: ["name": "otp", "value": "123456"])
                    AWCNativeView(tag: "md-radio", properties: ["name": "duplicate-default", "value": "first", "checked": true])
                    AWCNativeView(tag: "md-radio", properties: ["name": "duplicate-default", "value": "second", "checked": true])
                }.padding(20).frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            }
        }
    }
}
