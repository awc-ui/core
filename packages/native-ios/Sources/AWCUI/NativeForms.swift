import Foundation
import Observation

/// Declarative native validation. Lengths use UTF-16, matching source input constraints.
public struct AWCFormRules: Equatable, Sendable {
    public var required: Bool
    public var minimumLength: Int?
    public var maximumLength: Int?
    public var minimum: Double?
    public var maximum: Double?
    public var pattern: String?
    public var inputType: String
    public var step: Double?
    public var stepBase: Double
    public init(required: Bool = false, minimumLength: Int? = nil, maximumLength: Int? = nil,
                minimum: Double? = nil, maximum: Double? = nil, pattern: String? = nil,
                inputType: String = "text", step: Double? = nil, stepBase: Double = 0) {
        self.required = required; self.minimumLength = minimumLength; self.maximumLength = maximumLength
        self.minimum = minimum; self.maximum = maximum; self.pattern = pattern
        self.inputType = inputType; self.step = step; self.stepBase = stepBase
    }
    static func lengthConstraint(_ value: AWCValue?) -> Int? {
        guard let number = value?.number, number.isFinite, number >= 0 else { return nil }
        return Int(exactly: number)
    }
    static func utf16Prefix(_ text: String, maximum: Int?) -> String {
        guard let maximum else { return text }
        var result = "", count = 0
        for scalar in text.unicodeScalars {
            let size = scalar.value > 0xFFFF ? 2 : 1
            if count + size > maximum { break }; result.unicodeScalars.append(scalar); count += size
        }
        return result
    }
    public func validationMessage(for value: AWCValue) -> String? {
        let missing: Bool
        switch value { case .null: missing = true; case .string(let v): missing = v.isEmpty
        case .array(let v): missing = v.isEmpty; case .bool(let v): missing = !v; default: missing = false }
        if required && missing { return "This field is required." }; if missing { return nil }
        if case .string(let text) = value {
            if let minimumLength, text.utf16.count < minimumLength { return "Enter at least \(minimumLength) UTF-16 code units." }
            if let maximumLength, text.utf16.count > maximumLength { return "Enter at most \(maximumLength) UTF-16 code units." }
            // HTML ignores invalid patterns. ICU is deliberately not claimed to implement JS v-mode.
            if let pattern, !pattern.isEmpty, let expression = try? NSRegularExpression(pattern: "^(?:" + pattern + ")$") {
                let range = NSRange(text.startIndex..<text.endIndex, in: text)
                if expression.firstMatch(in: text, range: range)?.range != range { return "The value does not match the required format." }
            }
            if inputType == "email" {
                let regex = #"^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)*$"#
                if text.range(of: regex, options: .regularExpression) == nil { return "Enter a valid email address." }
            }
            if inputType == "url", (text.unicodeScalars.contains { CharacterSet.whitespacesAndNewlines.contains($0) } || URL(string: text)?.scheme == nil) { return "Enter an absolute URL." }
        }
        if inputType == "number" || minimum != nil || maximum != nil || step != nil {
            guard let number = value.number, number.isFinite else { return "Enter a valid number." }
            if let minimum, number < minimum { return "Enter a value of at least \(minimum)." }
            if let maximum, number > maximum { return "Enter a value of at most \(maximum)." }
            if let step, step.isFinite, step > 0, stepBase.isFinite {
                let increments = (number - stepBase) / step
                if !increments.isFinite || abs(increments - increments.rounded()) > 1e-7 { return "Enter a value on the required step." }
            }
        }
        return nil
    }
}

/// A source control's successful-value and validation behavior, without DOM ownership.
public struct AWCFormControl: Equatable, Sendable {
    public let tag: String
    public var properties: [String: AWCValue]
    public init(tag: String, properties: [String: AWCValue] = [:]) { self.tag = tag; self.properties = properties }
    public static let tags: Set<String> = ["md-text-field", "md-checkbox", "md-radio", "md-switch", "md-select", "md-multi-select", "md-autocomplete", "md-slider", "md-number-field", "md-date-picker", "md-time-picker", "md-rating", "md-otp-field"]
    public var valueKey: String { tag == "md-switch" ? "selected" : ["md-checkbox", "md-radio"].contains(tag) ? "checked" : "value" }
    public var value: AWCValue {
        if tag == "md-slider", flag("range") { return ["valueStart": properties["valueStart"] ?? .number(0), "valueEnd": properties["valueEnd"] ?? .number(100)] }
        return properties[valueKey] ?? (["checked", "selected"].contains(valueKey) ? .bool(false) : .string(""))
    }
    func flag(_ key: String) -> Bool { properties[key]?.bool == true }
    func text(_ key: String) -> String { properties[key]?.string ?? "" }
    func number(_ key: String) -> Double? { properties[key]?.number.flatMap { $0.isFinite ? $0 : nil } }
    public var rules: AWCFormRules {
        var rules = AWCFormRules(required: flag("required"))
        if tag == "md-text-field" {
            rules.minimumLength = AWCFormRules.lengthConstraint(properties["minLength"])
            rules.maximumLength = AWCFormRules.lengthConstraint(properties["maxLength"])
            rules.pattern = text("pattern"); rules.inputType = text("type")
            if rules.inputType == "number" {
                rules.minimum = number("min"); rules.maximum = number("max")
                rules.step = text("step") == "any" ? nil : number("step").flatMap { $0 > 0 ? $0 : nil } ?? 1
                rules.stepBase = number("min") ?? number("value") ?? 0
            }
        }
        return rules
    }
    func entries(id: String, name: String, value: AWCValue) -> [AWCFormEntry] {
        func row(_ name: String, _ value: AWCValue) -> AWCFormEntry { AWCFormEntry(id: id, name: name, value: .string(value.string)) }
        if tag == "md-slider", flag("range") {
            guard !name.isEmpty || !text("nameStart").isEmpty || !text("nameEnd").isEmpty else { return [] }
            return [row(text("nameStart").isEmpty ? name : text("nameStart"), value["valueStart"]), row(text("nameEnd").isEmpty ? name : text("nameEnd"), value["valueEnd"])]
        }
        // These source controls supply FormData directly, including an empty key.
        if tag == "md-multi-select" || (tag == "md-autocomplete" && flag("multiple")) { return value.array.map { row(name, $0) } }
        guard !name.isEmpty else { return [] }
        if ["md-checkbox", "md-radio", "md-switch"].contains(tag) {
            guard value.bool == true else { return [] }
            let configured = properties["value"]?.string ?? "on"
            return [row(name, .string(tag == "md-radio" && configured.isEmpty ? "on" : configured))]
        }
        if ["md-select", "md-date-picker", "md-autocomplete", "md-otp-field"].contains(tag) && value.string.isEmpty { return [] }
        if tag == "md-number-field" && value == .null { return [] }
        if tag == "md-rating" && (value.number ?? 0) == 0 { return [] }
        return [row(name, value)]
    }
    func validationMessage(value: AWCValue) -> String? {
        if tag == "md-rating", flag("required"), (value.number ?? 0) == 0 { return "This field is required." }
        if tag == "md-otp-field", flag("required"), !value.string.isEmpty,
           value.string.utf16.count < (AWCFormRules.lengthConstraint(properties["length"]) ?? 6),
           properties["incompleteLabel"]?.string != "" {
            return text("incompleteLabel").isEmpty ? "Complete the code." : text("incompleteLabel")
        }
        if tag == "md-time-picker", !value.string.isEmpty {
            func minutes(_ string: String) -> Int? {
                let parts = string.split(separator: ":", omittingEmptySubsequences: false)
                guard parts.count == 2, let h = Int(parts[0]), let m = Int(parts[1]), (0..<24).contains(h), (0..<60).contains(m) else { return nil }; return h * 60 + m
            }
            guard let value = minutes(value.string) else { return "Enter a valid time." }
            let min = minutes(text("min")), max = minutes(text("max"))
            if let min, let max, min > max { if value < min && value > max { return "Choose a time inside the overnight range." } }
            else if let min, value < min { return "Choose a later time." }
            else if let max, value > max { return "Choose an earlier time." }
        }
        return nil
    }
}

public struct AWCFormEntry: Equatable, Sendable {
    public let id: String
    public let name: String
    public let value: AWCValue
    public init(id: String, name: String, value: AWCValue) { self.id = id; self.name = name; self.value = value }
}
public struct AWCFormSubmission: Sendable {
    public let entries: [AWCFormEntry]
    public let submitter: AWCNode?
    public var values: [String: AWCValue] { awcFormValues(entries) }
    public func formURLEncoded() -> String { AWCFormEncoding.urlEncoded(entries) }
}
private func awcFormValues(_ entries: [AWCFormEntry]) -> [String: AWCValue] {
    Dictionary(grouping: entries, by: \.name).mapValues { rows in rows.count == 1 ? rows[0].value : .array(rows.map(\.value)) }
}
public enum AWCFormEncoding {
    /// UTF-8 application/x-www-form-urlencoded, preserving entry order and CRLF line breaks. Never sends data.
    public static func urlEncoded(_ entries: [AWCFormEntry]) -> String {
        func encode(_ value: String) -> String {
            let normalized = value.replacingOccurrences(of: "\r\n", with: "\n").replacingOccurrences(of: "\r", with: "\n").replacingOccurrences(of: "\n", with: "\r\n")
            return normalized.utf8.map { byte in
                if byte == 32 { return "+" }
                if (65...90).contains(byte) || (97...122).contains(byte) || (48...57).contains(byte) || [42, 45, 46, 95].contains(byte) { return String(UnicodeScalar(byte)) }
                return String(format: "%%%02X", byte)
            }.joined()
        }
        return entries.map { encode($0.name) + "=" + encode($0.value.string) }.joined(separator: "&")
    }
}

/// An explicit owner registry scoped by the host; it never searches a global DOM.
@Observable public final class AWCFormRegistry {
    private var forms: [String: AWCFormState]
    public init(_ forms: [String: AWCFormState] = [:]) { self.forms = forms }
    public func register(_ form: AWCFormState, id: String) { forms[id] = form }
    public func unregister(id: String) { forms[id] = nil }
    public func form(id: String) -> AWCFormState? { forms[id] }
}

/// UI-thread-owned native form. Fields retain initial snapshots until unregistered.
@Observable public final class AWCFormState: Identifiable {
    public let id = UUID()
    public private(set) var validationMessages: [String: String] = [:]
    public private(set) var revision = 0
    /// Increments on every reset: inline validation presentations hide with it.
    public private(set) var resetCount = 0
    public private(set) var lastActionCanceled = false
    public var onSubmit: (AWCFormSubmission) -> Void
    public var onInvalid: ([String: String]) -> Void
    public var onReset: ([String: AWCValue]) -> Void
    public var onEvent: (AWCEventContext) -> Void = { _ in }
    public var observe: (AWCEvent) -> Void = { _ in }
    private struct Field {
        var name: String; var value: AWCValue; let initialValue: AWCValue
        var disabled: Bool; var rules: AWCFormRules; var control: AWCFormControl?
        var validator: ((AWCValue) -> String?)?; var reset: ((AWCValue) -> Void)?; var change: ((AWCValue) -> Void)?
    }
    private var fields: [String: Field] = [:]
    private var order: [String] = []
    private var submitters: [String: () -> AWCButtonActionResult] = [:]
    private var submitterOrder: [String] = []
    public init(onSubmit: @escaping (AWCFormSubmission) -> Void = { _ in }, onInvalid: @escaping ([String: String]) -> Void = { _ in }, onReset: @escaping ([String: AWCValue]) -> Void = { _ in }) {
        self.onSubmit = onSubmit; self.onInvalid = onInvalid; self.onReset = onReset
    }
    public var entries: [AWCFormEntry] {
        order.flatMap { id -> [AWCFormEntry] in
            guard let field = fields[id], !field.disabled else { return [] }
            if let control = field.control { return control.entries(id: id, name: field.name, value: field.value) }
            return field.name.isEmpty ? [] : [AWCFormEntry(id: id, name: field.name, value: field.value)]
        }
    }
    public var values: [String: AWCValue] { awcFormValues(entries) }
    public func formURLEncoded() -> String { AWCFormEncoding.urlEncoded(entries) }
    public func value(for id: String) -> AWCValue? { fields[id]?.value }
    public func initialValue(for id: String) -> AWCValue? { fields[id]?.initialValue }
    public func register(id: String, name: String, value: AWCValue, rules: AWCFormRules = .init(), disabled: Bool = false,
                         validator: ((AWCValue) -> String?)? = nil, onReset: ((AWCValue) -> Void)? = nil,
                         control: AWCFormControl? = nil, initialValue: AWCValue? = nil, onChange: ((AWCValue) -> Void)? = nil) {
        let initial = fields[id]?.initialValue ?? initialValue ?? value
        if fields[id] == nil { order.append(id) }
        fields[id] = Field(name: name, value: value, initialValue: initial, disabled: disabled, rules: rules, control: control, validator: validator, reset: onReset, change: onChange)
        if disabled { validationMessages[id] = nil }; revision &+= 1
        if control?.tag == "md-radio", value.bool == true { selectRadio(id: id) }
    }
    public func registerSubmitter(id: String, activate: @escaping () -> AWCButtonActionResult) {
        if submitters[id] == nil { submitterOrder.append(id) }; submitters[id] = activate
    }
    public func unregisterSubmitter(id: String) { submitters[id] = nil; submitterOrder.removeAll { $0 == id } }
    public func unregister(id: String) { fields[id] = nil; order.removeAll { $0 == id }; validationMessages[id] = nil; unregisterSubmitter(id: id); revision &+= 1 }
    private func selectRadio(id: String) {
        guard let selected = fields[id], !selected.name.isEmpty else { return }
        for sibling in order where sibling != id {
            guard let field = fields[sibling], field.control?.tag == "md-radio", field.name == selected.name, field.value.bool == true else { continue }
            fields[sibling]?.value = .bool(false); field.change?(.bool(false)); validationMessages[sibling] = nil
        }
    }
    public func setValue(_ value: AWCValue, for id: String) {
        guard var field = fields[id], field.value != value else { return }
        field.value = value; fields[id] = field; validationMessages[id] = nil; revision &+= 1
        if field.control?.tag == "md-radio", value.bool == true { selectRadio(id: id) }
    }
    @discardableResult public func validate() -> Bool {
        var errors: [String: String] = [:]
        for id in order {
            guard let field = fields[id], !field.disabled else { continue }
            if field.control?.tag == "md-text-field", field.control?.flag("readOnly") == true { continue }
            var value = field.value
            var rules = field.rules
            if field.control?.tag == "md-radio", !field.name.isEmpty {
                value = .bool(order.contains { other in fields[other]?.control?.tag == "md-radio" && fields[other]?.name == field.name && fields[other]?.value.bool == true })
                rules.required = order.contains { other in fields[other]?.control?.tag == "md-radio" && fields[other]?.name == field.name && fields[other]?.rules.required == true }
            }
            if let error = rules.validationMessage(for: value) ?? field.control?.validationMessage(value: value) ?? field.validator?(value) { errors[id] = error }
        }
        validationMessages = errors; return errors.isEmpty
    }
    private func event(_ name: String, detail: AWCValue, cancelable: Bool, dispatcher: AWCEventDispatcher?, observation: (AWCEvent) -> Void) -> Bool {
        let event = AWCEvent(name: name, tag: "native-form", nodeID: id.uuidString, detail: detail)
        let scope = AWCEventDispatcher(id: "native-form:" + id.uuidString, parent: dispatcher, handler: onEvent)
        let context = scope.dispatch(event, cancelable: cancelable); observe(context.observedEvent); observation(context.observedEvent)
        lastActionCanceled = context.defaultPrevented; return !context.defaultPrevented
    }
    @discardableResult public func submit(submitter: AWCNode? = nil, dispatcher: AWCEventDispatcher? = nil, observe: (AWCEvent) -> Void = { _ in }) -> Bool {
        lastActionCanceled = false
        guard validate() else { _ = event("mdInvalid", detail: .object(validationMessages.mapValues(AWCValue.string)), cancelable: false, dispatcher: dispatcher, observation: observe); onInvalid(validationMessages); return false }
        let submission = AWCFormSubmission(entries: entries, submitter: submitter)
        guard event("mdSubmit", detail: ["values": .object(submission.values), "encoded": .string(submission.formURLEncoded())], cancelable: true, dispatcher: dispatcher, observation: observe) else { return false }
        onSubmit(AWCFormSubmission(entries: entries, submitter: submitter)); return true
    }
    /// First registered default stays default when blocked; do not skip to a later button.
    @discardableResult public func requestImplicitSubmit(dispatcher: AWCEventDispatcher? = nil, observe: (AWCEvent) -> Void = { _ in }) -> AWCButtonActionResult {
        if let id = submitterOrder.first, let activate = submitters[id] { return activate() }
        return submit(dispatcher: dispatcher, observe: observe) ? .submitted : lastActionCanceled ? .canceled : .invalidForm
    }
    @discardableResult public func reset(dispatcher: AWCEventDispatcher? = nil, observe: (AWCEvent) -> Void = { _ in }) -> Bool {
        guard event("mdReset", detail: .object(values), cancelable: true, dispatcher: dispatcher, observation: observe) else { return false }
        let resets = order.compactMap { id -> (String, AWCValue, ((AWCValue) -> Void)?)? in
            guard let field = fields[id] else { return nil }; return (id, field.initialValue, field.reset)
        }
        // Source radio groups have one checked member even when multiple authored
        // defaults are checked. Registration order chooses the final member.
        var radioWinners: [String: String] = [:]
        for (id, value, _) in resets {
            if let field = fields[id], field.control?.tag == "md-radio", !field.name.isEmpty, value.bool == true { radioWinners[field.name] = id }
        }
        let normalized = resets.map { id, value, callback -> (String, AWCValue, ((AWCValue) -> Void)?) in
            if let field = fields[id], field.control?.tag == "md-radio", !field.name.isEmpty {
                return (id, .bool(radioWinners[field.name] == id), callback)
            }
            return (id, value, callback)
        }
        for (id, value, _) in normalized { fields[id]?.value = value }
        validationMessages = [:]; resetCount &+= 1; revision &+= 1
        for (_, value, callback) in normalized { callback?(value) }; onReset(values); return true
    }
}
