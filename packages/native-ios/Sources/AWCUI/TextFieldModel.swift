import Foundation
import SwiftUI

// MARK: Source model (md-text-field.tsx)

/// `clearable` / `password-toggle` / `speech-to-text`: `true` (and the bare attribute) means `internal`.
enum AWCFieldMode: String, Equatable, Sendable {
    case off, `internal`, external
    init(_ value: AWCValue?) {
        switch value {
        case .bool(true)?: self = .internal
        case .string(let s)?: self = s == "external" ? .external : s == "internal" ? .internal : .off
        default: self = .off
        }
    }
    var on: Bool { self != .off }
}

/// md-text-field's props, normalised the way the component normalises them.
struct AWCTextFieldModel: Equatable {
    var variant = "filled", label = "", value = "", placeholder = "", type = "text", name = ""
    var pattern = "", minLength: Int? = nil, maxLength: Int? = nil
    var min: String? = nil, max: String? = nil, step: String? = nil
    var autocomplete = "", inputMode = "", enterKeyHint = "", autoCapitalize = "", spellcheck = true
    var disabled = false, readOnly = false, required = false, error = false
    var errorText = "", supportingText = "", prefixText = "", suffixText = ""
    var clearable = AWCFieldMode.off, passwordToggle = AWCFieldMode.off, speechToText = AWCFieldMode.off
    var showPasswordLabel = "Show password", hidePasswordLabel = "Hide password"
    var density: Double? = nil, multiline = "", rows: Int? = nil, speechLang = "", restrict = "", formatOn = "blur"
    var focusBorderWidth = 3.0, appearFocused = false, chipsWrap = false, reserveSupportingSpace = false
    var debounce = 0.0, throttle = 0.0, inputRole = "", inputExpanded = false, inputAriaAutocomplete = ""
    var hidden = false, ariaLabel = ""

    init(properties p: [String: AWCValue]) {
        func s(_ k: String, _ f: String = "") -> String { p[k]?.string ?? f }
        func b(_ k: String) -> Bool { p[k]?.bool ?? false }
        func n(_ k: String) -> Double? { p[k]?.number.flatMap { $0.isFinite ? $0 : nil } }
        func raw(_ k: String) -> String? {
            switch p[k] { case .string(let v)?: return v.isEmpty ? nil : v
            case .number(let v)?: return v.isFinite ? AWCTextFieldModel.serialize(v) : nil
            default: return nil }
        }
        variant = s("variant", "filled") == "outlined" ? "outlined" : "filled"
        label = s("label"); placeholder = s("placeholder"); type = s("type", "text").isEmpty ? "text" : s("type", "text"); name = s("name")
        pattern = s("pattern")
        minLength = n("minLength").flatMap { $0 >= 0 ? Int(exactly: $0.rounded(.down)) : nil }
        maxLength = n("maxLength").flatMap { $0 >= 0 ? Int(exactly: $0.rounded(.down)) : nil }
        min = raw("min"); max = raw("max"); step = raw("step")
        autocomplete = s("autocomplete"); inputMode = s("inputMode"); enterKeyHint = s("enterKeyHint"); autoCapitalize = s("autoCapitalize")
        spellcheck = p["spellcheck"]?.bool ?? true
        disabled = b("disabled"); readOnly = b("readOnly") || b("readonly"); required = b("required"); error = b("error")
        errorText = s("errorText"); supportingText = s("supportingText"); prefixText = s("prefixText"); suffixText = s("suffixText")
        clearable = AWCFieldMode(p["clearable"]); passwordToggle = AWCFieldMode(p["passwordToggle"]); speechToText = AWCFieldMode(p["speechToText"])
        showPasswordLabel = s("showPasswordLabel", "Show password"); hidePasswordLabel = s("hidePasswordLabel", "Hide password")
        density = n("density")
        switch p["multiline"] { case .string(let v)?: multiline = ["auto-grow", "fixed"].contains(v) ? v : (v.isEmpty ? "" : "auto-grow")
        case .bool(true)?: multiline = "auto-grow"; default: multiline = "" }
        rows = n("rows").map { Int($0) }
        speechLang = s("speechLang"); restrict = s("restrict"); formatOn = s("formatOn", "blur") == "input" ? "input" : "blur"
        focusBorderWidth = n("focusBorderWidth") ?? 3; appearFocused = b("appearFocused"); chipsWrap = b("chipsWrap")
        reserveSupportingSpace = b("reserveSupportingSpace")
        debounce = n("debounce") ?? 0; throttle = n("throttle") ?? 0
        inputRole = s("inputRole") == "combobox" ? "combobox" : ""; inputExpanded = b("inputExpanded"); inputAriaAutocomplete = s("inputAriaAutocomplete")
        hidden = b("hidden"); ariaLabel = [s("aria-label"), s("ariaLabel")].first { !$0.isEmpty } ?? ""
        // The native setter parity for single-line values: CR/LF are stripped.
        let v = s("value"); value = multiline.isEmpty ? v.replacingOccurrences(of: "[\r\n]+", with: "", options: .regularExpression) : v
    }
    static func serialize(_ v: Double) -> String { v == v.rounded() && abs(v) < 1e15 ? String(Int64(v)) : String(v) }
    var isMultiline: Bool { !multiline.isEmpty }
    var effectiveRows: Int { rows ?? (multiline == "fixed" ? 4 : 2) }
    var showPasswordToggle: Bool { !isMultiline && passwordToggle.on }
    /// `restrict` presets or a regex character class (anything outside it is stripped).
    var restrictPattern: NSRegularExpression? {
        guard !restrict.isEmpty else { return nil }
        let presets = ["numeric": "[^0-9]", "integer": "[^0-9-]", "decimal": "[^0-9.\\-]", "alpha": "[^a-zA-Z]", "alphanumeric": "[^a-zA-Z0-9]"]
        if let preset = presets[restrict] { return try? NSRegularExpression(pattern: preset) }
        let inner = restrict.hasPrefix("[") && restrict.hasSuffix("]") && restrict.count >= 2 ? String(restrict.dropFirst().dropLast()) : restrict
        return try? NSRegularExpression(pattern: "[^" + inner + "]")
    }
    func applyRestrict(_ raw: String) -> String {
        guard let r = restrictPattern else { return raw }
        return r.stringByReplacingMatches(in: raw, range: NSRange(raw.startIndex..., in: raw), withTemplate: "")
    }
    /// `maxLength` truncation by code points while the UTF-16 length fits (the source's Array.from loop).
    static func truncate(_ text: String, utf16Limit: Int) -> String {
        var out = "", count = 0
        for scalar in text.unicodeScalars {
            let size = scalar.value > 0xFFFF ? 2 : 1
            if count + size > utf16Limit { break }
            out.unicodeScalars.append(scalar); count += size
        }
        return out
    }
}

// MARK: Constraint validation (Chrome's ValidityState and its English messages)

/// The validity an `<input>` reports: the ten `ValidityState` flags plus Chrome's message.
public struct AWCConstraintValidity: Equatable, Sendable {
    public static let flagNames = ["valueMissing", "typeMismatch", "patternMismatch", "tooLong", "tooShort", "rangeUnderflow", "rangeOverflow", "stepMismatch", "badInput", "customError"]
    public let valid: Bool, validationMessage: String, flags: [String: Bool]
    init(flag: String? = nil, message: String = "") {
        var f = Dictionary(uniqueKeysWithValues: Self.flagNames.map { ($0, false) })
        if let flag { f[flag] = true }
        valid = flag == nil; validationMessage = flag == nil ? "" : message; flags = f
    }
    public static let validState = AWCConstraintValidity()
    /// `getValidity()`: every flag.
    public var value: AWCValue { .object(["valid": .bool(valid), "validationMessage": .string(validationMessage), "flags": .object(flags.mapValues(AWCValue.bool))]) }
    /// `mdValidityChange` detail (`getValidityOf`): only the raised flags.
    public var eventValue: AWCValue { .object(["valid": .bool(valid), "validationMessage": .string(validationMessage), "flags": .object(flags.filter(\.value).mapValues(AWCValue.bool))]) }
    var key: String { "\(valid)|\(validationMessage)" }
}

/// HTML constraint validation for the text-like input types md-text-field renders.
struct AWCTextConstraints: Equatable {
    var type = "text", required = false, pattern = "", minLength: Int? = nil, maxLength: Int? = nil
    var min: String? = nil, max: String? = nil, step: String? = nil, mutable = true
    init(model m: AWCTextFieldModel) {
        type = m.type; required = m.required; pattern = m.pattern; minLength = m.minLength; maxLength = m.maxLength
        min = m.min; max = m.max; step = m.step; mutable = !m.disabled && !m.readOnly
    }
    init() {}
    /// Value sanitisation of the input type (the value the element actually holds).
    func sanitize(_ v: String) -> String {
        switch type {
        case "email", "url": return v.replacingOccurrences(of: "[\r\n]", with: "", options: .regularExpression).trimmingCharacters(in: CharacterSet(charactersIn: " \t\n\u{0C}\r"))
        case "number": return Self.number(v) != nil ? v : ""
        default: return v.replacingOccurrences(of: "[\r\n]", with: "", options: .regularExpression)
        }
    }
    /// HTML "valid floating-point number".
    static func number(_ s: String) -> Double? {
        guard s.range(of: #"^-?(?:[0-9]+(?:\.[0-9]+)?|\.[0-9]+)(?:[eE][-+]?[0-9]+)?$"#, options: .regularExpression) != nil else { return nil }
        return Double(s).flatMap { $0.isFinite ? $0 : nil }
    }
    static func format(_ v: Double) -> String {
        if v == v.rounded(), abs(v) < 1e21 { return String(Int64(v)) }
        var s = String(format: "%.15g", v)
        if s.contains("e") { s = String(v) }
        return s
    }
    /// - Parameters: `raw` is what the user typed (for badInput); `userEdited` is the dirty flag for tooLong/tooShort.
    func evaluate(_ raw: String, userEdited: Bool, custom: String) -> AWCConstraintValidity {
        if !custom.isEmpty { return .init(flag: "customError", message: custom) }
        let value = sanitize(raw)
        if type == "number", !raw.isEmpty, value.isEmpty { return .init(flag: "badInput", message: "Please enter a number.") }
        if required && mutable && value.isEmpty {
            return .init(flag: "valueMissing", message: type == "number" ? "Please enter a number." : "Please fill out this field.")
        }
        if value.isEmpty { return .validState }
        if type == "email", let m = Self.emailMismatch(value) { return .init(flag: "typeMismatch", message: m) }
        if type == "url", !Self.validURL(value) { return .init(flag: "typeMismatch", message: "Please enter a URL.") }
        if !pattern.isEmpty, ["text", "search", "url", "tel", "email", "password"].contains(type),
           let re = try? NSRegularExpression(pattern: "^(?:" + pattern + ")$") {
            let range = NSRange(value.startIndex..., in: value)
            if re.firstMatch(in: value, range: range)?.range != range { return .init(flag: "patternMismatch", message: "Please match the requested format.") }
        }
        if userEdited, type != "number" {
            let length = value.utf16.count
            if let maxLength, length > maxLength {
                return .init(flag: "tooLong", message: "Please shorten this text to \(maxLength) characters or less (you are currently using \(length) character\(length == 1 ? "" : "s")).")
            }
            if let minLength, length < minLength {
                return .init(flag: "tooShort", message: "Please lengthen this text to \(minLength) characters or more (you are currently using \(length) character\(length == 1 ? "" : "s")).")
            }
        }
        if type == "number", let number = Self.number(value) {
            if let min, let lo = Self.number(min), number < lo { return .init(flag: "rangeUnderflow", message: "Value must be greater than or equal to \(Self.format(lo)).") }
            if let max, let hi = Self.number(max), number > hi { return .init(flag: "rangeOverflow", message: "Value must be less than or equal to \(Self.format(hi)).") }
            let stepValue: Double? = step?.lowercased() == "any" ? nil : (step.flatMap(Self.number).flatMap { $0 > 0 ? $0 : nil } ?? 1)
            if let stepValue {
                let base = min.flatMap(Self.number) ?? 0
                let n = (number - base) / stepValue
                if abs(n - n.rounded()) > 1e-9 * Swift.max(1, abs(n)) {
                    let lower = base + n.rounded(.down) * stepValue, upper = lower + stepValue
                    let hi = max.flatMap(Self.number)
                    if let hi, upper > hi { return .init(flag: "stepMismatch", message: "Please enter a valid value. The nearest valid value is \(Self.format(lower)).") }
                    return .init(flag: "stepMismatch", message: "Please enter a valid value. The two nearest valid values are \(Self.format(lower)) and \(Self.format(upper)).")
                }
            }
        }
        return .validState
    }
    static let emailLocal = CharacterSet(charactersIn: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.!#$%&'*+/=?^_`{|}~-")
    static let emailDomain = CharacterSet(charactersIn: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-.")
    /// Chromium's EmailInputType::TypeMismatchText.
    static func emailMismatch(_ v: String) -> String? {
        let valid = #"^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$"#
        if v.range(of: valid, options: .regularExpression) != nil { return nil }
        guard let at = v.firstIndex(of: "@") else { return "Please include an '@' in the email address. '\(v)' is missing an '@'." }
        if at == v.startIndex { return "Please enter a part followed by '@'. '\(v)' is incomplete." }
        if v.index(after: at) == v.endIndex { return "Please enter a part following '@'. '\(v)' is incomplete." }
        let local = v[..<at], domain = v[v.index(after: at)...]
        if let bad = local.unicodeScalars.first(where: { !emailLocal.contains($0) }) { return "A part followed by '@' should not contain the symbol '\(bad)'." }
        if let bad = domain.unicodeScalars.first(where: { !emailDomain.contains($0) }) { return "A part following '@' should not contain the symbol '\(bad)'." }
        if domain.hasPrefix(".") || domain.hasSuffix(".") || domain.contains("..") { return "'.' is used at a wrong position in '\(domain)'." }
        return "Please enter an email address."
    }
    static func validURL(_ v: String) -> Bool {
        guard let colon = v.firstIndex(of: ":"), colon != v.startIndex else { return false }
        let scheme = v[..<colon]
        guard let first = scheme.unicodeScalars.first, CharacterSet.letters.contains(first),
              scheme.unicodeScalars.allSatisfy({ CharacterSet.alphanumerics.contains($0) || "+-.".unicodeScalars.contains($0) }) else { return false }
        return !v.contains(" ") && URL(string: v) != nil
    }
}

// MARK: mdSearch emission (debounce / throttle / distinct-until-changed)

/// The source's `emitSearch`: `debounce` is trailing, `throttle` emits a leading value and then at most one per
/// window (the latest value at the window's end), and every emission is distinct-until-changed.
@MainActor final class AWCSearchEmitter {
    private var lastEmitted: String?
    private var debounceItem: DispatchWorkItem?
    private var throttleItem: DispatchWorkItem?
    private var throttlePending = false
    var send: (String) -> Void = { _ in }
    var current: () -> String = { "" }
    func distinct(_ value: String) { guard value != lastEmitted else { return }; lastEmitted = value; send(value) }
    func emit(_ value: String, debounce: Double, throttle: Double) {
        if debounce > 0 {
            debounceItem?.cancel()
            let item = DispatchWorkItem { [weak self] in self?.distinct(value) }
            debounceItem = item; DispatchQueue.main.asyncAfter(deadline: .now() + debounce / 1000, execute: item)
        }
        if throttle > 0 {
            if throttleItem == nil {
                distinct(value); throttlePending = false
                let item = DispatchWorkItem { [weak self] in
                    guard let self else { return }
                    self.throttleItem = nil
                    if self.throttlePending { self.distinct(self.current()); self.throttlePending = false }
                }
                // Chrome runs input before a timer due at the same instant: the window closes 1 ms after its end.
                throttleItem = item; DispatchQueue.main.asyncAfter(deadline: .now() + (throttle + 1) / 1000, execute: item)
            } else { throttlePending = true }
        }
        if debounce <= 0 && throttle <= 0 { distinct(value) }
    }
    func cancel() { debounceItem?.cancel(); throttleItem?.cancel(); debounceItem = nil; throttleItem = nil; throttlePending = false }
}

// MARK: Formatter / parser (the `formatter` / `parser` function props)

/// Native counterpart of the `formatter` / `parser` props: closures cannot travel through the portable node tree,
/// so they attach with `.awcTextFieldFormatting(_:for:)`.
public struct AWCTextFieldFormatting {
    public var formatter: ((String) -> String)?
    public var parser: ((String) -> String)?
    public init(formatter: ((String) -> String)? = nil, parser: ((String) -> String)? = nil) { self.formatter = formatter; self.parser = parser }
}
private struct AWCTextFieldFormattingKey: EnvironmentKey { static let defaultValue: [String: AWCTextFieldFormatting] = [:] }
extension EnvironmentValues {
    var awcTextFieldFormatting: [String: AWCTextFieldFormatting] { get { self[AWCTextFieldFormattingKey.self] } set { self[AWCTextFieldFormattingKey.self] = newValue } }
}
private struct AWCTextFieldFormattingModifier: ViewModifier {
    let value: AWCTextFieldFormatting, id: String
    @Environment(\.awcTextFieldFormatting) private var inherited
    func body(content: Content) -> some View { var f = inherited; f[id] = value; return content.environment(\.awcTextFieldFormatting, f) }
}
public extension View {
    /// Attaches `formatter` / `parser` to the md-text-field with node id `id` (or every descendant field when nil).
    func awcTextFieldFormatting(_ value: AWCTextFieldFormatting, for id: String? = nil) -> some View {
        modifier(AWCTextFieldFormattingModifier(value: value, id: id ?? ""))
    }
}
