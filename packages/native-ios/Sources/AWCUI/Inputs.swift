import SwiftUI
#if canImport(UIKit)
import UIKit
#elseif canImport(AppKit)
import AppKit
#endif

extension AWCNativeView {
    var inputField: some View {
        VStack(alignment: .leading, spacing: 6) {
            if !label.isEmpty { Text(label + (b("required") ? " *" : "")).font(.caption).foregroundStyle(foreground) }
            if node.tag == "md-number-field" { numberField }
            else if node.tag == "md-otp-field" { otpField }
            else {
                HStack(spacing: 8) {
                    if !s("prefixText").isEmpty { Text(s("prefixText")).foregroundStyle(.secondary) }
                    content("leading-icon")
                    if s("type") == "password" && !passwordVisible { SecureField(s("placeholder"), text: fieldBinding).onSubmit { commitText() } }
                    else if s("multiline") != "false" && local["multiline"] != nil && p("multiline") != .bool(false) {
                        TextField(s("placeholder"), text: fieldBinding, axis: .vertical).lineLimit(max(1, Int(n("rows", 3)))...10)
                    } else { TextField(s("placeholder"), text: fieldBinding).onSubmit { commitText() } }
                    if !s("suffixText").isEmpty { Text(s("suffixText")).foregroundStyle(.secondary) }
                    if p("clearable") != .bool(false) && local["clearable"] != nil && !s("value").isEmpty {
                        Button { if s("clearable") == "internal" || p("clearable") == .bool(true) { set("value", ""); emit("mdInput", ""); emit("mdChange", "") }; emit("mdClear") } label: { Image(systemName: "xmark.circle.fill") }.buttonStyle(.plain).accessibilityLabel("Clear").disabled(readOnly)
                    }
                    if ["password", "text"].contains(s("type")) && p("passwordToggle") != .bool(false) && local["passwordToggle"] != nil {
                        Button { if s("passwordToggle") == "internal" || p("passwordToggle") == .bool(true) { passwordVisible.toggle(); emit("mdPasswordToggle", ["visible": .bool(passwordVisible)]) } else { emit("mdPasswordToggle", ["visible": .bool(s("type") == "password")]) } } label: { Image(systemName: passwordVisible ? "eye.slash" : "eye") }.buttonStyle(.plain).accessibilityLabel(passwordVisible ? s("hidePasswordLabel", "Hide password") : s("showPasswordLabel", "Show password"))
                    }
                    content("trailing-icon")
                }.padding(14).background(surface, in: RoundedRectangle(cornerRadius: 8))
                .overlay(RoundedRectangle(cornerRadius: 8).stroke(b("error") ? theme.error : theme.primary.opacity(0.4)))
            }
            support
        }
    }
    var fieldBinding: Binding<String> {
        Binding(get: { s("value") }, set: { text in
            guard !readOnly else { return }
            let value = AWCFormRules.utf16Prefix(text, maximum: AWCFormRules.lengthConstraint(local["maxLength"]))
            guard value != s("value") else { return }
            set("value", .string(value)); emit("mdInput", .string(value))
        })
    }
    func commitText() {
        emit("mdChange", p("value")); if s("type") == "search" { emit("mdSearch", p("value")) }
        if b("required") { validate(!s("value").isEmpty) }; submitFromNativeText()
    }
    var numberField: some View {
        HStack {
            if s("steppers", "inline") != "none" { Button { changeNumber(-n("step", 1)) } label: { Image(systemName: "minus") }.accessibilityLabel(s("decrementLabel", "Decrease")) }
            TextField(s("placeholder", "0"), text: Binding(get: { s("value") }, set: { text in
                let value = Double(text); set("value", value.map(AWCValue.number) ?? .null)
                emit("mdInput", ["value": p("value"), "formattedValue": .string(text), "reason": "input-change"])
            })).multilineTextAlignment(.center).onSubmit {
                guard permitsNativeEnter else { return }
                if let current = p("value").number, current.isFinite { set("value", .number(min(n("max", .greatestFiniteMagnitude), max(n("min", -.greatestFiniteMagnitude), current)))) }
                emit("mdChange", ["value": p("value"), "formattedValue": .string(s("value")), "reason": "input-change"]); _ = resolvedForm?.submit(dispatcher: eventDispatcher, observe: onEvent) }
            if s("steppers", "inline") != "none" { Button { changeNumber(n("step", 1)) } label: { Image(systemName: "plus") }.accessibilityLabel(s("incrementLabel", "Increase")) }
        }.padding(12).background(surface, in: RoundedRectangle(cornerRadius: 10)).disabled(readOnly)
    }
    func changeNumber(_ delta: Double) {
        let value = min(n("max", .greatestFiniteMagnitude), max(n("min", -.greatestFiniteMagnitude), n("value") + delta))
        set("value", .number(value))
        let detail: AWCValue = ["value": .number(value), "formattedValue": .string(s("value")), "reason": .string(delta > 0 ? "increment-press" : "decrement-press")]
        emit("mdInput", detail); emit("mdChange", detail)
    }
    var otpField: some View {
        VStack(spacing: 8) {
            HStack(spacing: 6) {
                ForEach(0..<max(1, min(24, Int(n("length", 6)))), id: \.self) { index in
                    let characters = Array(s("value"))
                    Text(index < characters.count ? (b("mask") ? "•" : String(characters[index])) : "–")
                        .font(.title2.monospaced()).frame(maxWidth: .infinity).frame(height: 48)
                        .background(surface, in: RoundedRectangle(cornerRadius: 8))
                        .overlay(RoundedRectangle(cornerRadius: 8).stroke(theme.primary.opacity(index < characters.count ? 0.7 : 0.2)))
                }
            }.accessibilityHidden(true)
            TextField(s("placeholder", "Enter code"), text: Binding(get: { s("value") }, set: { input in
                let transformed = s("transform") == "uppercase" ? input.uppercased() : input
                let accepted = transformed.filter { character in
                    if character.isWhitespace { return false }
                    switch s("validationType", "numeric") {
                    case "numeric": return character.isNumber
                    case "alpha": return character.isLetter
                    case "alphanumeric": return character.isLetter || character.isNumber
                    default: return true
                    }
                }
                if accepted.count != transformed.filter({ !$0.isWhitespace }).count { emit("mdInvalidInput", ["attempted": .string(input), "reason": "input-change"]) }
                let result = String(accepted.prefix(max(1, Int(n("length", 6)))))
                set("value", .string(result)); emit("mdInput", .string(result)); emit("mdChange", .string(result))
                if result.count == Int(n("length", 6)) { emit("mdComplete", ["value": .string(result)]) }
                if b("required") { validate(result.count == Int(n("length", 6))) }
            })).textContentType(.oneTimeCode).textFieldStyle(.roundedBorder).disabled(readOnly)
        }
    }
    var slider: some View {
        // Dedicated renderer (Slider/NativeSliderView.swift): Web geometry, motion, events and per-thumb inputs.
        // Host-authored properties (outside a form): the component's own writes live in its model until the host changes them.
        AWCNativeSliderView(nodeID: node.id, properties: formState == nil ? (AWCComponentCatalog.defaults[node.tag] ?? [:]).merging(node.properties) { _, new in new } : local,
                            set: { set($0, $1) }, emit: { emit($0, $1) })
    }
    func nativeSlider(_ key: String, lower: Double, upper: Double) -> some View {
        HStack {
            symbol(s("icon"))
            Slider(value: Binding(get: { min(max(n(key, lower), lower), max(lower, upper)) }, set: { value in set(key, .number(value)); emit("mdInput", sliderDetail) }), in: lower...max(lower + 0.0001, upper), step: max(0.0001, n("step", 1)), onEditingChanged: { active in
                var detail = sliderDetail.object; detail["thumb"] = .string(!b("range") ? "single" : key == "valueEnd" ? "end" : "start")
                emit(active ? "mdDragStart" : "mdDragEnd", .object(detail))
                if !active { emit("mdChange", sliderDetail) }
            }).accessibilityLabel(s(key == "valueEnd" ? "ariaLabelEnd" : "ariaLabelStart", s("sliderAriaLabel", "Value")))
            if b("labeled") || b("valueIndicator", true) { Text(String(format: "%.1f", n(key, lower))).font(.caption.monospacedDigit()).frame(width: 48) }
        }
    }
    var sliderDetail: AWCValue { b("range") ? ["value": p("value"), "valueStart": p("valueStart"), "valueEnd": p("valueEnd")] : ["value": p("value")] }

    var temporalPicker: some View {
        VStack(alignment: .leading, spacing: 6) {
            if !b("hideTrigger") {
                Button { showOverlay(true) } label: {
                    HStack { Label(label.isEmpty ? (node.tag == "md-time-picker" ? "Choose time" : "Choose date") : label, systemImage: node.tag == "md-time-picker" ? "clock" : "calendar"); Spacer(); Text(s("value", "Select")).monospacedDigit() }.padding(14).background(surface, in: RoundedRectangle(cornerRadius: 10))
                }.buttonStyle(.plain)
            }
            if b("clearable") && !s("value").isEmpty { Button(s("clearLabel", "Clear")) { set("value", ""); emit("mdChange", ["value": "", "date": .null]) } }
            support
        }.awcPreviewSheet(isPresented: Binding(get: { b("open") }, set: { value in if !value { emit("mdCancel") }; showOverlay(value) })) {
            VStack(alignment: .leading, spacing: 20) {
                Text(s("headline", label)).font(.title2.bold())
                if previewEnabled {
                    AWCPreviewTemporalPicker(selection: temporalBinding, bounds: dateBounds, timeOnly: node.tag == "md-time-picker")
                } else {
                    DatePicker(label.isEmpty ? "Value" : label, selection: temporalBinding, in: dateBounds, displayedComponents: node.tag == "md-time-picker" ? .hourAndMinute : .date)
                        .datePickerStyle(.graphical)
                }
                HStack {
                    Button(s("cancelLabel").isEmpty ? "Cancel" : s("cancelLabel")) { emit("mdCancel"); showOverlay(false) }
                    Spacer()
                    Button(s("okLabel").isEmpty ? "OK" : s("okLabel")) { if s("value").isEmpty { temporalBinding.wrappedValue = Date() }; emit("mdChange", temporalDetail); showOverlay(false) }.buttonStyle(AWCActionStyle(primary: true, theme: theme))
                }
            }.padding(24).presentationDetents([.medium, .large])
        }
    }
    var temporalFormatter: DateFormatter {
        let format = DateFormatter(); format.locale = Locale(identifier: "en_US_POSIX"); format.dateFormat = node.tag == "md-time-picker" ? "HH:mm" : "yyyy-MM-dd"; return format
    }
    var dateBounds: ClosedRange<Date> {
        let low = temporalFormatter.date(from: s("min")) ?? .distantPast
        let high = temporalFormatter.date(from: s("max")) ?? .distantFuture
        return low...max(low, high)
    }
    var temporalBinding: Binding<Date> {
        Binding(get: { min(max(temporalFormatter.date(from: s("value")) ?? Date(), dateBounds.lowerBound), dateBounds.upperBound) }, set: { date in
            set("value", .string(temporalFormatter.string(from: date)))
            emit("mdInput", node.tag == "md-time-picker" ? temporalDetail : ["value": p("value")])
            if node.tag == "md-date-picker" { emit("mdSelected", temporalDetail) }
            if b("commitOnSelect") { emit("mdChange", temporalDetail); showOverlay(false) }
            if b("required") { validate(true) }
        })
    }
    var temporalDetail: AWCValue {
        guard let date = temporalFormatter.date(from: s("value")) else { return ["value": p("value"), "date": .null] }
        if node.tag == "md-date-picker" { return ["value": p("value"), "date": .string(ISO8601DateFormatter().string(from: date))] }
        let parts = Calendar.current.dateComponents([.hour, .minute], from: date)
        let today = Calendar.current.date(bySettingHour: parts.hour ?? 0, minute: parts.minute ?? 0, second: 0, of: Date()) ?? date
        let iso = ISO8601DateFormatter().string(from: today)
        return ["value": p("value"), "iso": .string(s("value") + ":00"), "isoDateTime": .string(iso), "date": .string(iso), "hours": .number(Double(parts.hour ?? 0)), "minutes": .number(Double(parts.minute ?? 0)), "period": .string((parts.hour ?? 0) < 12 ? "AM" : "PM")]
    }
    var colorPicker: some View {
        VStack(alignment: .leading, spacing: 12) {
            let selection = Binding(get: { Color(awcHex: s("value", "#6750A4")) }, set: { color in
                let resolved = color.resolve(in: EnvironmentValues())
                let hex = String(format: "#%02X%02X%02X", Int((resolved.red * 255).rounded()), Int((resolved.green * 255).rounded()), Int((resolved.blue * 255).rounded()))
                set("value", .string(hex)); emit("mdInput", ["value": .string(hex)]); emit("mdChange", ["value": .string(hex)])
            })
            if previewEnabled {
                AWCPreviewColorPicker(selection: selection, label: s("ariaLabelProp").isEmpty ? "Color" : s("ariaLabelProp"))
            } else {
                ColorPicker(s("ariaLabelProp", "Color"), selection: selection, supportsOpacity: b("alpha"))
            }
            if b("showHex", true) { Text(s("value", "#6750A4")).font(.body.monospaced()) }
            HStack { ForEach(a("presets"), id: \.self) { value in Button { set("value", value); emit("mdInput", ["value": value]); emit("mdChange", ["value": value]) } label: { Circle().fill(Color(awcHex: value.string)).frame(width: 32, height: 32) }.accessibilityLabel(value.string) } }
        }
    }
}
