import Foundation
#if !AWC_STANDALONE
@testable import AWCUI
#endif

/// Shared XCTest/CLI cases execute the same action dispatcher used by md-button.
enum NativeBehaviorContractCases {
    static func run(_ check: @escaping (Bool, String) -> Void) {
        func button(_ properties: [String: AWCValue]) -> AWCNode { AWCNode(id: "button", tag: "md-button", properties: properties) }
        var trace: [String] = []; var selected = false; var navigations: [AWCURLRequest] = []
        let router = AWCURLRouter { navigations.append($0); trace.append("route"); return true }
        let outer = AWCEventDispatcher(id: "outer") { context in trace.append("outer:\(context.event.name)") }
        let cancel = AWCEventDispatcher(id: "inner", parent: outer) { context in
            trace.append("inner:\(context.event.name)"); context.preventDefault()
            check(context.path == ["button", "inner", "outer"], "Native scope path captures target then explicit ancestors")
            check(context.currentScopeID == "inner", "Handler has current native scope")
        }
        let canceled = AWCButtonAction.perform(node: button(["toggle": true, "href": "https://example.com"]), dispatcher: cancel, router: router,
            observe: { trace.append("observe:\($0.name)"); check($0.defaultPrevented, "Legacy observer sees cancellation") }, commitSelected: { selected = $0 })
        check(canceled == .canceled && !selected && navigations.isEmpty, "Cancellation prevents toggle and routing")
        check(trace == ["inner:mdClick", "outer:mdClick", "observe:mdClick"], "Cancellation still propagates and observes before any effects")
        trace = []
        let stopped = AWCEventDispatcher(id: "inner", parent: outer) { context in
            trace.append("inner:\(context.event.name)"); if context.event.name == "mdClick" { context.stopPropagation() }
        }
        let activated = AWCButtonAction.perform(node: button(["toggle": true, "href": "https://example.com", "target": "_blank"]), dispatcher: stopped, router: router,
            observe: { trace.append("observe:\($0.name)") }, commitSelected: { selected = $0; trace.append("commit") })
        check(activated == .navigated && selected, "stopPropagation does not cancel default action")
        check(trace == ["inner:mdClick", "observe:mdClick", "commit", "inner:mdChange", "outer:mdChange", "observe:mdChange", "route"], "Click, toggle, change and route ordering")
        check(navigations.last?.target == "_blank", "Router receives the requested target")
        for flag in ["disabled", "softDisabled", "loading"] {
            var observed = false; var committed = false; let count = navigations.count
            let result = AWCButtonAction.perform(node: button([flag: true, "toggle": true, "href": "https://example.com"]), dispatcher: outer, router: router,
                observe: { _ in observed = true }, commitSelected: { _ in committed = true })
            check(result == .blocked && !observed && !committed && navigations.count == count, "\(flag) blocks all button actions")
        }
        var submits: [AWCFormSubmission] = []; var invalid = 0; var resetValue: AWCValue = .null
        let form = AWCFormState(onSubmit: { submits.append($0) }, onInvalid: { _ in invalid += 1 })
        form.register(id: "name", name: "name", value: "Ada", rules: .init(required: true), onReset: { resetValue = $0 })
        form.setValue("Grace", for: "name")
        form.register(id: "name", name: "name", value: "Grace", rules: .init(required: true), onReset: { resetValue = $0 })
        check(form.initialValue(for: "name") == "Ada", "Re-registration preserves the original reset value")
        let submit = AWCButtonAction.perform(node: button(["type": "submit"]), form: form, router: router, commitSelected: { _ in })
        check(submit == .submitted && submits.last?.values["name"] == "Grace", "Submit uses current registered native values")
        check(submits.last?.submitter?.id == "button", "Submission carries explicit submitter")
        form.setValue("", for: "name")
        let invalidResult = AWCButtonAction.perform(node: button(["type": "submit"]), form: form, router: router, commitSelected: { _ in })
        check(invalidResult == .invalidForm && submits.count == 1 && invalid == 1, "Invalid form does not call submit")
        check(form.validationMessages["name"] != nil, "Invalid native field reports validation error")
        let reset = AWCButtonAction.perform(node: button(["type": "reset"]), form: form, router: router, commitSelected: { _ in })
        check(reset == .reset && form.values["name"] == "Ada" && resetValue == "Ada", "Reset restores initial model and field binding")
        check(form.validationMessages.isEmpty, "Reset clears validation errors")
        form.setValue("Dirty", for: "name")
        for type in ["submit", "reset"] {
            for href in ["javascript:alert(1)", "data:text/html,x", "file:///tmp/x", " ", "https://example.com\n"] {
                let count = submits.count
                let result = AWCButtonAction.perform(node: button(["type": .string(type), "href": .string(href)]), form: form, router: router, commitSelected: { _ in })
                check(result == .navigationRejected && submits.count == count && form.values["name"] == "Dirty", "Raw rejected href suppresses \(type): \(href.debugDescription)")
            }
        }
        var canceledFormEffects = 0
        let cancelForm = AWCFormState(onSubmit: { _ in canceledFormEffects += 1 }, onReset: { _ in canceledFormEffects += 1 })
        for type in ["submit", "reset"] {
            let result = AWCButtonAction.perform(node: button(["type": .string(type)]), form: cancelForm, dispatcher: cancel, router: router, commitSelected: { _ in })
            check(result == .canceled && canceledFormEffects == 0, "Cancellation blocks form \(type)")
        }
        form.register(id: "hidden", name: "hidden", value: "", rules: .init(required: true), disabled: true)
        check(form.validate() && form.values["hidden"] == nil, "Disabled registrations do not validate or submit")
        form.register(id: "name2", name: "name", value: "Other")
        check(form.values["name"] == ["Dirty", "Other"], "Duplicate names retain both values in registration order")
        form.unregister(id: "name2"); check(form.values["name"] == "Dirty", "Unmounted field is removed from submitted values")
        let nested = AWCFormState(); nested.register(id: "nested", name: "name", value: "Inner")
        AWCButtonAction.perform(node: button(["type": "reset"]), form: nested, router: router, commitSelected: { _ in })
        check(form.values["name"] == "Dirty" && nested.values["name"] == "Inner", "Explicit nested form action leaves outer scope untouched")
        let nonCancelable = outer.dispatch(AWCEvent(name: "mdChange", tag: "md-button", nodeID: "button"))
        nonCancelable.preventDefault(); check(!nonCancelable.defaultPrevented, "Observation event cannot be canceled")
        let relative = AWCURLRouter(allowedSchemes: ["https"], baseURL: URL(string: "https://example.com/base/")) { _ in true }
        check(relative.request(href: "next", target: "preview", nodeID: "link")?.url.absoluteString == "https://example.com/base/next", "Relative route requires and resolves explicit base URL")
        check(relative.request(href: "http://example.com", nodeID: "link") == nil, "Router enforces allowed schemes")
        check(router.request(href: "next", nodeID: "link") == nil, "Relative URL without base is rejected")
        check(AWCURLRouter(allowedSchemes: ["javascript"]) { _ in true }.request(href: "javascript:alert(1)", nodeID: "link") == nil, "Executable schemes remain rejected even if configured")
        check(AWCFormRules.lengthConstraint(.number(1e100)) == nil, "Unrepresentable native length is ignored without a trap")
        check(AWCFormRules.lengthConstraint(.string("nan")) == nil, "Nonfinite native length is ignored")
        check(AWCFormRules.lengthConstraint(-1) == nil && AWCFormRules.lengthConstraint(2.5) == nil, "Negative and fractional lengths are not valid constraints")
        check(AWCFormRules.lengthConstraint(2) == 2, "Valid integral length constraint is retained")
        let rules = AWCFormRules(required: true, minimumLength: 2, maximumLength: 4, pattern: "[A-Z]+")
        check(rules.validationMessage(for: "AB") == nil, "Native format validation accepts matching value")
        check(rules.validationMessage(for: "abc") != nil, "Native pattern rejects mismatching value")
        check(AWCFormRules(minimum: 1, maximum: 10).validationMessage(for: 11) != nil, "Native numeric maximum validation")
        let fallback = AWCNode.text("fallback", slot: "leading-icon")
        var tree = AWCNode(id: "parent", tag: "md-button")
        check(tree.children(inSlot: "leading-icon", fallback: [fallback]) == [fallback], "Empty native slot uses fallback")
        let provided = AWCNode(id: "provided", tag: "#text", properties: ["text": "★"], slot: "leading-icon")
        tree.children = [provided, AWCNode(id: "container", tag: "native-group", children: [AWCNode(id: "deep", tag: "md-button")])]
        check(tree.children(inSlot: "leading-icon", fallback: [fallback]) == [provided], "Dynamic assigned native slot replaces fallback")
        check(tree.firstDescendant(id: "deep")?.tag == "md-button" && tree.descendants(tag: "md-button").count == 1, "Explicit descendant lookup replaces selectors")
        check(tree.children(inSlot: nil) == tree.children(inSlot: ""), "Nil and empty default slot are equivalent")
        tree.children.removeAll(); check(tree.children(inSlot: "leading-icon", fallback: [fallback]) == [fallback], "Removing assigned native children restores fallback")
    }
}
