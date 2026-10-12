import SwiftUI

extension AWCNativeView {
    var isFilledButton: Bool { ["filled", "primary", "secondary", "tertiary"].contains(s("variant", "filled")) }
    var actionButton: some View {
        Button {
            _ = iconFocusHandle.requestFocus?()
            if b("toggle") { set("selected", .bool(!b("selected"))) }
            if node.tag == "md-icon-button" { emit("mdClick", ["selected": .bool(b("selected"))]) }
            else { emit("mdClick") }
            activateLink()
        } label: {
            HStack(spacing: 8) {
                if b("loading") { if node.children.contains(where: { $0.slot == "loader" }) { content("loader") } else { ProgressView().controlSize(.small) } }
                else { symbol(b("selected") ? (s("selectedIcon").isEmpty ? s("icon") : s("selectedIcon")) : s("icon"), fallback: node.tag == "md-fab" ? "add" : "") }
                content("leading-icon")
                if node.tag != "md-icon-button" && (!label.isEmpty || node.tag != "md-fab" || b("extended")) { Text(label.isEmpty ? "Action" : label).fontWeight(.semibold) }
                content("trailing-icon")
                symbol(s("trailingIcon"))
            }
            .frame(minHeight: size)
            .padding(.horizontal, node.tag == "md-icon-button" ? 12 : 20)
            .frame(maxWidth: b("fullWidth") ? .infinity : nil)
            .foregroundStyle(isFilledButton ? theme.onPrimary : theme.primary)
            .background(isFilledButton ? theme.primary : surface, in: RoundedRectangle(cornerRadius: radius))
            .overlay(RoundedRectangle(cornerRadius: radius).stroke(s("variant") == "outlined" ? theme.primary.opacity(0.6) : .clear))
            .opacity(b("selected") ? 0.78 : 1)
        }.buttonStyle(.plain).disabled(b("loading"))
        .accessibilityLabel(label.isEmpty ? s("icon", "Action") : label)
        .accessibilityAddTraits(b("selected") ? .isSelected : [])
        .modifier(AWCIconButtonFocusModifier(id: node.id, label: label.isEmpty ? s("icon", "Action") : label,
            enabled: node.tag == "md-icon-button", properties: local, group: inheritedButtonFocusGroup,
            handle: iconFocusHandle, focusChanged: nativeFocusChanged, activate: {
                guard !disabled && !b("loading") else { return }
                if b("toggle") { set("selected", .bool(!b("selected"))) }
                emit("mdClick", ["selected": .bool(b("selected"))]); activateLink()
            }))
    }
    var splitButton: some View {
        HStack(spacing: 2) {
            Button { emit("mdLeadingClick") } label: { Label(label, systemImage: awcSymbol(s("icon", "check"))).padding(12) }
            Button {
                set("trailingChecked", .bool(!b("trailingChecked")))
                emit("mdTrailingClick", ["checked": .bool(b("trailingChecked"))])
            } label: { symbol(s("trailingIcon", "expand_more")).padding(12).rotationEffect(.degrees(b("trailingChecked") ? 180 : 0)) }
        }.buttonStyle(.plain).foregroundStyle(theme.onPrimary).background(theme.primary, in: Capsule())
        .accessibilityElement(children: .contain)
    }
    var segmentedButton: some View {
        Button {
            let selected = !b("selected"); set("selected", .bool(selected))
            emit("mdSegmentClick", ["value": p("value"), "selected": .bool(selected)])
        } label: {
            HStack { if b("selected") && !b("noCheckmark") { Image(systemName: "checkmark") }; content("icon"); symbol(s("icon")); Text(label) }
                .padding(12).background(b("selected") ? theme.primary.opacity(0.22) : surface, in: Capsule())
        }.buttonStyle(.plain).accessibilityAddTraits(b("selected") ? .isSelected : [])
    }
    var nativeButtonFocusItems: [AWCButtonFocusItem] {
        func collect(_ item: AWCNode, selected: Bool? = nil) -> [AWCButtonFocusItem] {
            if item.tag == "md-button-group" { return [] } // Explicit nearest native scope.
            if ["md-button", "md-icon-button"].contains(item.tag) {
                return [.init(id: item.id, disabled: item.properties["disabled"]?.bool == true,
                              selected: selected ?? (item.properties["selected"]?.bool == true))]
            }
            return item.children.flatMap { collect($0) }
        }
        return node.children.enumerated().flatMap { index, item in
            collect(item, selected: ["md-button", "md-icon-button"].contains(item.tag) ? groupSelection.contains(index) : nil)
        }
    }
    func synchronizeButtonFocusGroup() {
        buttonFocusGroup.configure(items: nativeButtonFocusItems, singleSelection: s("selectionMode", "single-select") != "multi-select",
                                   rightToLeft: s("dir") == "rtl" || (s("dir") != "ltr" && layoutDirection == .rightToLeft))
    }
    var nativeButtonGroup: AnyView {
        AnyView(selectionGroup.environment(\.awcButtonFocusGroup, buttonFocusGroup)
            .onAppear { synchronizeButtonFocusGroup() }
            .onChange(of: nativeButtonFocusItems) { _, _ in synchronizeButtonFocusGroup() }
            .onChange(of: s("dir")) { _, _ in synchronizeButtonFocusGroup() }
            .onChange(of: s("selectionMode")) { _, _ in synchronizeButtonFocusGroup() }
            .onChange(of: layoutDirection) { _, _ in synchronizeButtonFocusGroup() })
    }
    var selectionGroup: some View {
        HStack(spacing: s("variant") == "connected" ? 2 : 8) {
            ForEach(Array(node.children.enumerated()), id: \.element.id) { index, item in
                child(item, properties: ["selected": .bool(groupSelection.contains(index))]) { event in
                    onEvent(event)
                    guard !event.defaultPrevented, ["mdClick", "mdSegmentClick"].contains(event.name) else { return }
                    let previousSelection = groupSelection
                    var selection = previousSelection
                    let multiple = b("multiselect") || s("selectionMode") == "multi-select"
                    if selection.contains(index) {
                        if !b("required") || selection.count > 1 { selection.remove(index) }
                    } else { if !multiple { selection.removeAll() }; selection.insert(index) }
                    set("_selection", .array(selection.sorted().map { .number(Double($0)) }))
                    let values = selection.sorted().map { node.children[$0].properties["value"] ?? .string(node.children[$0].id) }
                    emit(node.tag == "md-segmented-button-set" ? "mdChange" : "mdSelectionChange", node.tag == "md-segmented-button-set" ? .array(values) : ["values": .array(values), "added": .array(selection.subtracting(previousSelection).sorted().map { node.children[$0].properties["value"] ?? .string(node.children[$0].id) }), "removed": .array(previousSelection.subtracting(selection).sorted().map { node.children[$0].properties["value"] ?? .string(node.children[$0].id) })])
                }
            }
        }.frame(maxWidth: b("fullWidth") ? .infinity : nil)
    }
    var groupSelection: Set<Int> {
        if local["_selection"] != nil { return Set(a("_selection").compactMap { $0.number.map(Int.init) }) }
        return Set(node.children.enumerated().filter { $0.element.properties["selected"]?.bool == true }.map(\.offset))
    }
    var radioChecked: Bool {
        if let form = resolvedForm, let value = form.value(for: formRegistrationID) { return value.bool ?? false }
        guard node.tag == "md-radio", !s("name").isEmpty, let value = interactionStore.radioValues[s("name")] else { return b("checked") }; return value == s("value")
    }
    var checkControl: some View {
        VStack(alignment: .leading, spacing: 4) {
            if node.tag == "md-switch" {
                Toggle(isOn: Binding(get: { b("selected") }, set: { value in
                    set("selected", .bool(value)); emit("mdInput", ["selected": .bool(value)]); emit("mdChange", ["selected": .bool(value)])
                    if b("required") { validate(value) }
                })) { HStack { if !label.isEmpty { Text(label) } else { content() }; content(b("selected") ? "selected-icon" : "unselected-icon") } }.toggleStyle(.switch)
            } else {
                Button {
                    let checked = node.tag == "md-radio" ? true : !b("checked")
                    set("checked", .bool(checked)); set("indeterminate", false)
                    if node.tag == "md-radio" && !s("name").isEmpty { interactionStore.radioValues[s("name")] = s("value") }
                    emit("mdChange", node.tag == "md-radio" ? ["checked": .bool(checked), "value": p("value")] : ["checked": .bool(checked), "indeterminate": false])
                    if b("required") { validate(checked) }
                } label: {
                    HStack(spacing: 12) {
                        Image(systemName: node.tag == "md-radio" ? (radioChecked ? "largecircle.fill.circle" : "circle") : b("indeterminate") ? "minus.square.fill" : b("checked") ? "checkmark.square.fill" : "square")
                            .font(.title2).foregroundStyle(foreground)
                        if !label.isEmpty { Text(label).foregroundStyle(.primary) }
                        else { content() }
                    }.frame(minHeight: 44, alignment: .leading)
                }.buttonStyle(.plain).accessibilityValue((node.tag == "md-radio" ? radioChecked : b("checked")) ? "Selected" : "Not selected")
            }
            support
        }
    }
    var chip: some View {
        HStack(spacing: 8) {
            Button {
                emit("mdClick")
                if b("selectable") || s("variant") == "filter" {
                    set("selected", .bool(!b("selected"))); emit("mdSelect", ["selected": .bool(b("selected"))])
                }
            } label: {
                HStack { if b("selected") { Image(systemName: "checkmark") }; content("leading-icon"); symbol(s("icon")); Text(label); content("trailing-icon"); symbol(s("trailingIcon")) }.padding(.vertical, 8)
            }.buttonStyle(.plain)
            if b("removable") { Button { emit("mdRemove") } label: { Image(systemName: "xmark.circle.fill") }.buttonStyle(.plain).accessibilityLabel("Remove \(label)") }
        }.padding(.horizontal, 12).background(b("selected") ? theme.primary.opacity(0.2) : surface, in: RoundedRectangle(cornerRadius: 10))
        .overlay(RoundedRectangle(cornerRadius: 10).stroke(theme.primary.opacity(0.25)))
    }
    var rating: some View {
        HStack(spacing: 4) {
            ForEach(1...max(1, Int(n("max", 5))), id: \.self) { index in
                Button {
                    guard !readOnly else { return }
                    let amount = Double(index)
                    let value = n("precision", 1) == 0.5 && n("value") == amount ? amount - 0.5 : amount
                    set("value", .number(value)); emit("mdChange", .number(value))
                } label: {
                    Image(systemName: n("value", n("defaultValue")) >= Double(index) ? awcSymbol(s("icon", "star")) : n("value") >= Double(index) - 0.5 ? "star.leadinghalf.filled" : awcSymbol(s("emptyIcon", "star_border")))
                        .font(.system(size: size * 0.6)).foregroundStyle(theme.primary)
                }.buttonStyle(.plain).accessibilityLabel("\(index) of \(Int(n("max", 5))) stars")
            }
            if b("showValueLabel") { Text(s("value", s("defaultValue", "0"))).monospacedDigit() }
        }.accessibilityLabel(s("ratingLabel", "Rating"))
    }
}
