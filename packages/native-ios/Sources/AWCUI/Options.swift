import SwiftUI

struct AWCOption: Identifiable {
    let id: String
    let label: String
    let disabled: Bool
    let icon: String
    let supportingText: String
}

extension AWCNativeView {
    var options: [AWCOption] {
        let provided = a("options")
        if !provided.isEmpty {
            return provided.enumerated().map { index, item in
                if item.object.isEmpty { return AWCOption(id: item.string, label: item.string, disabled: false, icon: "", supportingText: "") }
                return AWCOption(id: item["value"].string.isEmpty ? String(index) : item["value"].string, label: item["label"].string, disabled: item["disabled"].bool ?? false, icon: item["icon"].string, supportingText: item["supportingText"].string)
            }
        }
        return node.children.filter { $0.tag == "md-select-option" }.map { item in
            AWCOption(id: item.properties["value"]?.string ?? item.id, label: item.properties["label"]?.string ?? item.children.first?.properties["text"]?.string ?? "", disabled: item.properties["disabled"]?.bool ?? false, icon: item.properties["icon"]?.string ?? "", supportingText: item.properties["supportingText"]?.string ?? "")
        }
    }
    var multiple: Bool { node.tag == "md-multi-select" || b("multiple") }
    var optionSelection: [String] { multiple ? a("value").map(\.string) : (s("value").isEmpty ? [] : [s("value")]) }
    var filteredOptions: [AWCOption] {
        let filtered = options.filter { query.isEmpty || $0.label.localizedCaseInsensitiveContains(query) }
        return n("limitResults") > 0 ? Array(filtered.prefix(Int(n("limitResults")))) : filtered
    }
    var optionPicker: some View {
        VStack(alignment: .leading, spacing: 8) {
            if !label.isEmpty { Text(label + (b("required") ? " *" : "")).font(.caption).foregroundStyle(foreground) }
            Button { query = s("inputValue"); showOverlay(true) } label: {
                HStack {
                    let display = options.filter { optionSelection.contains($0.id) }.map(\.label).joined(separator: ", ")
                    Text(display.isEmpty ? s("placeholder", "Select an option") : display).foregroundStyle(display.isEmpty ? Color.secondary : Color.primary).lineLimit(2)
                    Spacer(); symbol(s("dropdownIcon", "expand_more"))
                }.padding(14).background(surface, in: RoundedRectangle(cornerRadius: 10))
                .overlay(RoundedRectangle(cornerRadius: 10).stroke(foreground.opacity(0.4)))
            }.buttonStyle(.plain)
            if multiple && s("displayMode", "chips") != "count" {
                ScrollView(.horizontal) {
                    HStack {
                        ForEach(optionSelection, id: \.self) { value in
                            HStack { Text(options.first { $0.id == value }?.label ?? value); Button { removeOption(value) } label: { Image(systemName: "xmark.circle.fill") }.buttonStyle(.plain).accessibilityLabel("Remove \(value)") }
                                .font(.caption).padding(8).background(surface, in: Capsule())
                        }
                    }
                }
            }
            if b("clearable") && !optionSelection.isEmpty { Button(s("clearLabel", "Clear")) { set("value", multiple ? [] : ""); emit("mdChange", p("value")); if node.tag != "md-select" { emit("mdClear") } } }
            support
        }.awcPreviewSheet(isPresented: Binding(get: { b("open") }, set: { showOverlay($0) })) {
            VStack(spacing: 0) {
                if previewEnabled {
                    HStack {
                        Text(label.isEmpty ? "Select" : label).font(.headline)
                        Spacer()
                        Button("Done") { showOverlay(false) }
                    }.padding()
                }
                NavigationStack {
                    VStack(spacing: 0) {
                        if b("filterable") || node.tag == "md-autocomplete" || node.tag == "md-multi-select" {
                            TextField(s("searchPlaceholder", "Search options"), text: $query).textFieldStyle(.roundedBorder).padding()
                                .onChange(of: query) { _, value in if node.tag == "md-autocomplete" { set("inputValue", .string(value)); emit("mdInput", .string(value)) } }
                                .onSubmit { if node.tag == "md-autocomplete" && b("freeSolo") && !query.isEmpty { chooseOption(AWCOption(id: query, label: query, disabled: false, icon: "", supportingText: "")) } }
                        }
                        if b("loading") { ProgressView(s("loadingText", "Loading…")).padding() }
                        else if filteredOptions.isEmpty { Text(s(options.isEmpty ? "noOptionsText" : "noResultsText", "No options")).foregroundStyle(.secondary).padding() }
                        else {
                            List {
                                if multiple && b("showSelectAll") { Button(s("selectAllLabel", "Select all")) { let values = Array(filteredOptions.filter { !$0.disabled }.prefix(Int(n("maxSelected") > 0 ? n("maxSelected") : Double(filteredOptions.count)))).map { AWCValue.string($0.id) }; set("value", .array(values)); emit("mdChange", p("value")) } }
                                ForEach(filteredOptions) { option in
                                    Button { chooseOption(option) } label: {
                                        HStack {
                                            symbol(option.icon)
                                            VStack(alignment: .leading) { Text(option.label).foregroundStyle(.primary); if !option.supportingText.isEmpty { Text(option.supportingText).font(.caption).foregroundStyle(.secondary) } }
                                            Spacer(); if optionSelection.contains(option.id) { Image(systemName: "checkmark").foregroundStyle(theme.primary) }
                                        }.contentShape(Rectangle())
                                    }.disabled(option.disabled)
                                }
                            }
                        }
                    }.navigationTitle(label.isEmpty ? "Select" : label)
                    .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { showOverlay(false) } } }
                }
            }.presentationDetents([.medium, .large])
        }
    }
    func chooseOption(_ option: AWCOption) {
        guard !option.disabled else { return }
        if multiple {
            var values = optionSelection
            if values.contains(option.id) { values.removeAll { $0 == option.id } }
            else if n("maxSelected") <= 0 || values.count < Int(n("maxSelected")) { values.append(option.id) }
            set("value", .array(values.map(AWCValue.string)))
        } else { set("value", .string(option.id)) }
        emit("mdChange", p("value")); if b("required") { validate(!optionSelection.isEmpty) }
        if !multiple && !b("disableCloseOnSelect") { showOverlay(false) }
    }
    func removeOption(_ value: String) {
        set("value", .array(optionSelection.filter { $0 != value }.map(AWCValue.string)))
        emit("mdChange", p("value")); if node.tag == "md-multi-select" { emit("mdRemove", .string(value)) }
    }
    var selectOption: some View {
        Button { set("selected", .bool(!b("selected"))); emit("mdSelectOptionChange") } label: {
            HStack { symbol(s("icon")); VStack(alignment: .leading) { Text(label.isEmpty ? s("value") : label); support }; Spacer(); if b("selected") { Image(systemName: "checkmark") } }.padding(12)
        }.buttonStyle(.plain)
    }
}
