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
        check(submits.last?.submitter == nil, "Source md-button requestSubmit does not create a submitter entry")
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
        let source = AWCFormState()
        func register(_ id: String, _ tag: String, _ properties: [String: AWCValue]) {
            let control = AWCFormControl(tag: tag, properties: properties)
            source.register(id: id, name: properties["name"]?.string ?? "", value: control.value, rules: control.rules,
                            disabled: properties["disabled"]?.bool == true, control: control)
        }
        register("text", "md-text-field", ["name": "blank", "value": ""])
        register("check-off", "md-checkbox", ["name": "unchecked", "checked": false])
        register("check-on", "md-checkbox", ["name": "choice", "checked": true])
        register("switch", "md-switch", ["name": "choice", "selected": true, "value": "yes", "softDisabled": true])
        register("disabled", "md-text-field", ["name": "disabled", "value": "hidden", "disabled": true, "required": true])
        register("multi", "md-multi-select", ["name": "choice", "value": ["blue", "green"]])
        register("select", "md-select", ["name": "empty-select", "value": ""])
        register("date", "md-date-picker", ["name": "empty-date", "value": ""])
        register("time", "md-time-picker", ["name": "empty-time", "value": ""])
        register("rating", "md-rating", ["name": "zero-rating", "value": 0])
        register("number", "md-number-field", ["name": "null-number", "value": .null])
        register("range", "md-slider", ["range": true, "nameStart": "start", "nameEnd": "end", "valueStart": 2, "valueEnd": 8])
        check(source.entries.map(\.name) == ["blank", "choice", "choice", "choice", "choice", "empty-time", "start", "end"], "Source successful controls retain ordered duplicates, range endpoints and empty text/time")
        check(source.values["choice"] == ["on", "yes", "blue", "green"], "Checkbox default on, soft-disabled switch value and multi-values serialize correctly")
        check(source.values["disabled"] == nil && source.values["unchecked"] == nil && source.values["empty-select"] == nil && source.values["zero-rating"] == nil, "Disabled and unsuccessful values are omitted")
        register("unnamed", "md-text-field", ["required": true, "value": ""])
        check(!source.validate() && source.validationMessages["unnamed"] != nil, "Unnamed required controls validate without serializing")
        source.unregister(id: "unnamed")
        register("empty-name-array", "md-autocomplete", ["multiple": true, "value": ["x", "y"]])
        check(source.entries.suffix(2).map(\.name) == ["", ""], "Source FormData multiple autocomplete retains empty keys")
        register("radio-a", "md-radio", ["name": "radio", "value": "same", "checked": true, "required": true])
        var sibling = true
        let radio = AWCFormControl(tag: "md-radio", properties: ["name": "radio", "value": "same", "checked": true])
        source.register(id: "radio-b", name: "radio", value: true, control: radio, onChange: { sibling = $0.bool ?? false })
        check(source.value(for: "radio-a") == false && source.entries.filter { $0.name == "radio" }.count == 1, "Same-value radio peers remain exclusive by identity")
        check(source.validate(), "Checked sibling satisfies required radio group")
        source.setValue(true, for: "radio-a")
        check(!sibling && source.value(for: "radio-b") == false, "Radio selection updates peer binding without synthetic input events")
        check(AWCFormRules(maximumLength: 1).validationMessage(for: "😀") != nil && AWCFormRules(minimumLength: 2).validationMessage(for: "😀") == nil, "Length constraints count UTF-16 units")
        check(AWCFormRules(minimumLength: 3).validationMessage(for: "") == nil, "Optional empty input passes minimum length")
        check(AWCFormRules.utf16Prefix("😀x", maximum: 2) == "😀" && AWCFormRules.utf16Prefix("😀", maximum: 1) == "", "Length editing never splits a Unicode surrogate pair")
        check(AWCFormRules(pattern: "[").validationMessage(for: "abc") == nil, "Invalid native regex is ignored like an invalid source pattern")
        check(AWCFormRules(inputType: "email").validationMessage(for: "ada@example.com") == nil && AWCFormRules(inputType: "email").validationMessage(for: "no email") != nil, "Common email input validation")
        check(AWCFormRules(inputType: "url").validationMessage(for: "https://example.com") == nil && AWCFormRules(inputType: "url").validationMessage(for: "relative") != nil, "Common absolute URL input validation")
        check(AWCFormRules(minimum: 0, maximum: 10, inputType: "number", step: 2, stepBase: 1).validationMessage(for: 4) != nil && AWCFormRules(inputType: "number", step: 0.1).validationMessage(for: 0.3) == nil, "Numeric bounds and fractional step tolerance")
        let overnight = AWCFormControl(tag: "md-time-picker", properties: ["min": "22:00", "max": "06:00"])
        check(overnight.validationMessage(value: "23:30") == nil && overnight.validationMessage(value: "03:30") == nil && overnight.validationMessage(value: "12:00") != nil, "Time picker overnight bounds")
        check(AWCFormControl(tag: "md-otp-field", properties: ["required": true, "length": 6]).validationMessage(value: "123") != nil, "Required partial OTP is invalid")
        let encoding = AWCFormEncoding.urlEncoded([.init(id: "1", name: "a b", value: "A+B&=~*"), .init(id: "2", name: "a b", value: "é😀\nline")])
        check(encoding == "a+b=A%2BB%26%3D%7E*&a+b=%C3%A9%F0%9F%98%80%0D%0Aline", "Form encoding preserves duplicates and encodes UTF-8, space, symbols and CRLF")
        var formEffects = 0; var formEvents: [String] = []
        let veto = AWCFormState(onSubmit: { _ in formEffects += 1 }, onReset: { _ in formEffects += 1 })
        veto.register(id: "field", name: "field", value: "initial")
        veto.setValue("changed", for: "field")
        veto.onEvent = { context in formEvents.append(context.event.name); context.preventDefault() }
        check(!veto.submit() && veto.lastActionCanceled && !veto.reset() && veto.values["field"] == "changed" && formEffects == 0, "Form submit/reset cancellation runs before callbacks and reset mutations")
        check(formEvents == ["mdSubmit", "mdReset"], "Cancelable form events are distinct from mdClick")
        let propagated = AWCEventDispatcher(id: "owner") { context in if context.event.name == "mdSubmit" { context.preventDefault() } }
        veto.onEvent = { _ in }
        check(!veto.submit(dispatcher: propagated), "Form event bubbles synchronously into enclosing native scope")
        var defaultClicks = 0; var laterClicks = 0
        veto.registerSubmitter(id: "first") { defaultClicks += 1; return .blocked }
        veto.registerSubmitter(id: "later") { laterClicks += 1; return .submitted }
        check(veto.requestImplicitSubmit() == .blocked && defaultClicks == 1 && laterClicks == 0, "Blocked first default submit button prevents implicit fallback")
        veto.unregister(id: "first")
        check(veto.requestImplicitSubmit() == .submitted && laterClicks == 1, "Removing first default enables next registered submit button")
        veto.unregister(id: "later")
        check(veto.requestImplicitSubmit() == .submitted && formEffects == 1, "Enter without a default submits the form directly")
        let registry = AWCFormRegistry(["outer": source]); registry.register(veto, id: "external")
        check(registry.form(id: "outer") === source && registry.form(id: "external") === veto, "Explicit owner registry resolves local IDs")
        registry.unregister(id: "external"); check(registry.form(id: "external") == nil, "Removed explicit form owner does not fall back to a different form")

        let unnamedRange = AWCFormControl(tag: "md-slider", properties: ["range": true, "valueStart": 1, "valueEnd": 3])
        check(unnamedRange.entries(id: "range", name: "", value: unnamedRange.value).isEmpty, "Entirely unnamed source range slider contributes no entries")
        let halfNamedRange = AWCFormControl(tag: "md-slider", properties: ["range": true, "nameStart": "from", "valueStart": 1, "valueEnd": 3])
        check(halfNamedRange.entries(id: "range", name: "", value: halfNamedRange.value).map(\.name) == ["from", ""], "Partially named range preserves source empty opposite endpoint")
        let requiredGroup = AWCFormState()
        requiredGroup.register(id: "disabled-required", name: "group", value: false, rules: .init(required: true), disabled: true, control: .init(tag: "md-radio"))
        requiredGroup.register(id: "enabled", name: "group", value: false, control: .init(tag: "md-radio"))
        check(!requiredGroup.validate() && requiredGroup.validationMessages["enabled"] != nil, "Radio requiredness belongs to group even when required member is disabled")
        let mutation = AWCFormState()
        var submittedValue: AWCValue = .null
        mutation.register(id: "field", name: "name", value: "before")
        mutation.onEvent = { context in if context.event.name == "mdSubmit" { mutation.setValue("after", for: "field") } }
        mutation.onSubmit = { submittedValue = $0.values["name"] ?? .null }
        check(mutation.submit() && submittedValue == "after", "Successful entries are constructed after uncanceled submit handlers")
        mutation.onEvent = { _ in }
        check(AWCFormControl(tag: "md-otp-field", properties: ["required": true, "length": 6, "incompleteLabel": ""]).validationMessage(value: "123") == nil, "Empty source incompleteLabel disables the partial OTP constraint")

        check(AWCFormRules(inputType: "number", step: 1).validationMessage(for: 1_000_000_000.5) != nil, "Large values cannot relax step tolerance enough to accept a half-step")
        check(AWCFormRules(inputType: "number", step: 1).validationMessage(for: 1_000_000_000) == nil, "Large exact steps remain valid")
        let radioReset = AWCFormState()
        var firstReset: AWCValue = .null; var secondReset: AWCValue = .null
        radioReset.register(id: "first", name: "radios", value: true, onReset: { firstReset = $0 }, control: .init(tag: "md-radio", properties: ["value": "first"]))
        radioReset.register(id: "second", name: "radios", value: true, onReset: { secondReset = $0 }, control: .init(tag: "md-radio", properties: ["value": "second"]))
        check(radioReset.values["radios"] == "second", "Later authored checked radio wins registration")
        radioReset.setValue(true, for: "first"); radioReset.reset()
        check(radioReset.values["radios"] == "second" && radioReset.entries.count == 1, "Reset normalizes multiple authored checked radios to one successful control")
        check(firstReset == false && secondReset == true, "Reset callbacks receive normalized radio values for actual view bindings")

        NativeNavigationEventCases.run(check)
        NativeFocusCases.run(check)
    }
}
