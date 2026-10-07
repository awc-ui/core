import SwiftUI

extension AWCNativeView {
    @ViewBuilder var accordion: some View {
        if node.tag == "md-accordion-item" {
            VStack(alignment: .leading, spacing: 0) {
                Button {
                    guard b("collapsible", true) || !b("expanded") else { return }
                    set("expanded", .bool(!b("expanded"))); emit("mdItemToggle", ["expanded": .bool(b("expanded")), "index": .number(n("_index"))])
                } label: {
                    HStack { content("leading-icon"); symbol(s("icon")); VStack(alignment: .leading) { content("headline"); Text(label).fontWeight(.semibold); support }; Spacer(); content("trailing-icon"); Image(systemName: b("expanded") ? "chevron.up" : "chevron.down") }.padding(16).contentShape(Rectangle())
                }.buttonStyle(.plain).accessibilityValue(b("expanded") ? "Expanded" : "Collapsed")
                if b("expanded") { content().padding(16).transition(.opacity.combined(with: .move(edge: .top))) }
            }.background(surface, in: RoundedRectangle(cornerRadius: 12)).animation(.easeInOut(duration: 0.2), value: b("expanded"))
        } else {
            VStack(spacing: 4) {
                ForEach(Array(node.children.enumerated()), id: \.element.id) { index, item in
                    child(item, properties: ["expanded": .bool(accordionExpanded.contains(index)), "_index": .number(Double(index))]) { event in
                        onEvent(event)
                        if event.name == "mdItemToggle" {
                            var indices = accordionExpanded; let expanded = event.detail["expanded"].bool ?? false
                            if expanded { if b("exclusive") { indices.removeAll() }; indices.insert(index) }
                            else if !b("keepOneExpanded") || indices.count > 1 { indices.remove(index) }
                            set("_expanded", .array(indices.sorted().map { .number(Double($0)) }))
                            emit("mdToggle", ["index": .number(Double(index)), "expanded": .bool(indices.contains(index)), "expandedIndices": .array(indices.sorted().map { .number(Double($0)) })])
                        }
                    }
                }
            }
        }
    }
    var accordionExpanded: Set<Int> {
        if local["_expanded"] != nil { return Set(a("_expanded").compactMap { $0.number.map(Int.init) }) }
        let defaults = Set(s("defaultExpanded").split(separator: ",").compactMap { Int($0.trimmingCharacters(in: .whitespaces)) })
        return defaults.union(node.children.enumerated().filter { $0.element.properties["expanded"]?.bool == true }.map(\.offset))
    }
    @ViewBuilder var list: some View {
        if node.tag == "md-list" {
            VStack(spacing: 0) {
                ForEach(Array(node.children.enumerated()), id: \.element.id) { index, item in
                    child(item, properties: ["selectionMode": p("selectionMode"), "selected": .bool(groupSelection.contains(index)), "_index": .number(Double(index))]) { event in
                        onEvent(event)
                        if event.name == "mdItemSelect" {
                            var indices = groupSelection
                            if s("selectionMode") == "single-select" { indices = [index] }
                            else if indices.contains(index) { indices.remove(index) } else { indices.insert(index) }
                            set("_selection", .array(indices.sorted().map { .number(Double($0)) }))
                            emit("mdSelect", ["index": .number(Double(index)), "selected": .bool(indices.contains(index)), "selectedIndices": .array(indices.sorted().map { .number(Double($0)) }), "value": item.properties["headline"] ?? .string(item.id), "item": .string(item.id)])
                        }
                        if event.name == "mdItemClick" { emit("mdActivate", ["index": .number(Double(index)), "item": .string(item.id)]) }
                    }
                    if index < node.children.count - 1 { Divider() }
                }
            }.background(surface, in: RoundedRectangle(cornerRadius: s("listStyle") == "segmented" ? 16 : 4)).accessibilityLabel(label)
        } else {
            VStack(alignment: .leading, spacing: 0) {
                Button {
                    guard s("type", "text") != "text" || s("selectionMode", "none") != "none" || b("expandable") else { return }
                    emit("mdClick", ["item": .string(node.id)]); emit("mdItemClick", ["index": .number(n("_index")), "selected": .bool(b("selected"))])
                    if s("selectionMode", "none") != "none" {
                        set("selected", .bool(!b("selected"))); emit("mdItemSelect", ["index": .number(n("_index")), "value": .string(label), "selected": .bool(b("selected")), "item": .string(node.id)])
                    }
                    if b("expandable") { set("expanded", .bool(!b("expanded"))); emit("mdExpand", ["expanded": .bool(b("expanded")), "index": .number(n("_index")), "value": .string(label), "item": .string(node.id)]) }
                    activateLink()
                } label: {
                    HStack(spacing: 12) {
                        if !s("leadingAvatar").isEmpty || !s("leadingAvatarName").isEmpty { child(AWCNode(tag: "md-avatar", properties: ["src": p("leadingAvatar"), "name": p("leadingAvatarName"), "alt": p("leadingAvatarAlt")])) }
                        else { symbol(s("leadingIcon")) }
                        content("leading")
                        VStack(alignment: .leading, spacing: 4) { if !s("overline").isEmpty { Text(s("overline")).font(.caption2) }; content("overline"); content("headline"); Text(label).fontWeight(.medium); content("supporting-text"); support }
                        Spacer(); Text(s("trailingSupportingText")).font(.caption); content("trailing-supporting-text"); content("trailing")
                        if b("expandable") { Image(systemName: b("expanded") ? "chevron.up" : "chevron.down") }
                        else if b("selected") { Image(systemName: "checkmark") } else { symbol(s("trailingIcon")) }
                    }.padding(16).foregroundStyle(.primary).background(b("selected") ? theme.primary.opacity(0.14) : .clear)
                }.buttonStyle(.plain)
                if !b("expandable") || b("expanded") { content("expanded-content"); content() }
            }
        }
    }
    @ViewBuilder var toolbar: some View {
        if node.tag == "md-app-bar" {
            VStack(alignment: s("titleAlignment") == "center" ? .center : .leading, spacing: 12) {
                HStack {
                    if !s("leadingIcon").isEmpty { Button { emit("mdLeadingClick") } label: { symbol(s("leadingIcon")).frame(width: 44, height: 44) }.accessibilityLabel(s("leadingIconLabel", "Back")) }
                    content("leading")
                    if s("variant") == "search" { TextField(s("searchPlaceholder", "Search"), text: textBinding("searchValue", event: "mdSearchInput", object: true)).disabled(b("searchDisabled")).onSubmit { emit("mdSearchActivate", ["value": p("searchValue")]) } } else { Spacer() }
                    content("trailing")
                }
                content("headline"); content("subtitle"); content("search"); content("search-trailing")
                if s("variant") != "search" { Text(label).font(s("variant") == "large" ? .largeTitle : .title2).fontWeight(.semibold); if !s("subtitle").isEmpty { Text(s("subtitle")).foregroundStyle(.secondary) } }
                content()
            }.padding(16).frame(maxWidth: .infinity, alignment: .leading).background(surface)
        } else {
            let layout = s("layout") == "vertical" ? AnyLayout(VStackLayout(spacing: 8)) : AnyLayout(HStackLayout(spacing: 8))
            layout { ForEach(node.children) { child($0) } }.padding(12).background(surface, in: RoundedRectangle(cornerRadius: s("variant") == "floating" ? 24 : 8)).accessibilityLabel(s("ariaLabelProp"))
        }
    }
    var navigation: some View {
        let rail = node.tag == "md-navigation-rail" && s("orientation", "vertical") == "vertical"
        let activeKey = node.tag == "md-tabs" ? "activeTabIndex" : "activeIndex"
        return VStack(alignment: .leading, spacing: 6) {
            content("logo"); content("logo-expanded"); content("header"); content("fab")
            if node.tag == "md-navigation-rail" && b("expandable") { Button { set("_expanded", .bool(!b("_expanded"))); emit(b("_expanded") ? "mdExpand" : "mdCollapse") } label: { Label(s("toggleLabel", "Navigation"), systemImage: "sidebar.left") } }
            let layout = rail ? AnyLayout(VStackLayout(alignment: .leading, spacing: 8)) : AnyLayout(HStackLayout(spacing: 4))
            layout {
                ForEach(Array(node.children.filter { $0.slot == nil }.enumerated()), id: \.element.id) { index, item in
                    child(item, properties: ["active": .bool(index == Int(n(activeKey))), "_index": .number(Double(index))]) { event in
                        onEvent(event)
                        if event.name == "mdTabClick" {
                            let previous = n(activeKey); set(activeKey, .number(Double(index)))
                            if node.tag == "md-tabs" { interactionStore.tabIndices[node.id] = index }
                            emit(node.tag == "md-navigation-bar" ? "mdChange" : "mdTabChange", node.tag == "md-navigation-rail" ? ["index": .number(Double(index)), "value": item.properties["value"] ?? .string(item.id)] : ["index": .number(Double(index)), "previousIndex": .number(previous)])
                        }
                    }
                }
            }
            content("footer-leading"); content("footer-content"); content("footer")
            if node.tag == "md-tabs" { Divider() }
        }.padding(8).background(surface, in: RoundedRectangle(cornerRadius: 16))
    }
    var tabPanels: some View {
        VStack(alignment: .leading, spacing: spacing) {
            ForEach(Array(node.children.enumerated()), id: \.element.id) { index, item in
                if !s("for").isEmpty { child(item, properties: ["active": .bool(index == (interactionStore.tabIndices[s("for")] ?? 0))]) }
                else { child(item) }
            }
        }
    }
    var navigationItem: some View {
        Button {
            set("active", true)
            if node.tag == "md-tab" { emit("mdTabClick") }
            else if node.tag == "md-navigation-rail-tab" { emit("mdTabClick", ["value": p("value")]) }
            else { emit("mdTabClick", ["index": .number(n("_index"))]) }
            activateLink()
        } label: {
            VStack(spacing: 6) {
                HStack(spacing: 4) { content(b("active") ? "active-icon" : "icon"); content("badge"); symbol(b("active") ? (s("activeIcon").isEmpty ? s("icon") : s("activeIcon")) : s("icon")); if b("badge") || !s("badgeValue").isEmpty { Text(s("badgeValue", s("badge"))).font(.caption2).padding(3).background(theme.error, in: Capsule()).foregroundStyle(.white) } }
                if s("labelVisibility") != "none" && (s("labelVisibility") != "selected" || b("active")) { Text(label).font(.caption).fontWeight(b("active") ? .semibold : .regular) }
            }.frame(minWidth: 44, maxWidth: .infinity).padding(10).background(b("active") ? theme.primary.opacity(0.18) : .clear, in: RoundedRectangle(cornerRadius: 18))
        }.buttonStyle(.plain).accessibilityAddTraits(b("active") ? .isSelected : [])
    }
    @ViewBuilder var breadcrumbs: some View {
        if node.tag == "md-breadcrumb-item" {
            Button { emit("mdSelect", ["href": p("href"), "label": .string(label), "current": .bool(b("current")), "itemIndex": .number(n("itemIndex")), "itemTotal": .number(n("itemTotal", 1))]); activateLink() } label: { HStack { content("icon"); symbol(s("icon")); content(); if !label.isEmpty && node.children.isEmpty { Text(label) } }.foregroundStyle(b("current") ? Color.primary : theme.primary) }.buttonStyle(.plain).disabled(b("current"))
        } else {
            ScrollView(.horizontal) {
                HStack(spacing: 8) {
                    ForEach(Array(node.children.enumerated()), id: \.element.id) { index, item in
                        if n("maxItems") <= 0 || node.children.count <= Int(n("maxItems")) || b("_expanded") || index < Int(n("itemsBeforeCollapse", 1)) || index >= node.children.count - Int(n("itemsAfterCollapse", 1)) {
                            child(item, properties: ["itemIndex": .number(Double(index)), "itemTotal": .number(Double(node.children.count))])
                            if index < node.children.count - 1 { Text(s("separator", "/")).foregroundStyle(.secondary) }
                        } else if index == Int(n("itemsBeforeCollapse", 1)) { Button(s("expandLabel", "…")) { set("_expanded", true); emit("mdExpand", ["expanded": true, "itemCount": .number(Double(node.children.count))]) } }
                    }
                }
            }.accessibilityLabel(s("label", "Breadcrumbs"))
        }
    }
    @ViewBuilder var stepper: some View {
        if node.tag == "md-step" {
            VStack(alignment: .leading, spacing: 12) {
                Button { emit("mdStepClick", ["index": .number(n("_index"))]) } label: {
                    HStack { Image(systemName: b("error") ? "exclamationmark.circle.fill" : b("completed") ? "checkmark.circle.fill" : "circle").foregroundStyle(b("error") ? theme.error : theme.primary); VStack(alignment: .leading) { Text(label).fontWeight(.semibold); Text(s("description")).font(.caption).foregroundStyle(.secondary) }; if b("optional") { Text("Optional").font(.caption) } }
                }.buttonStyle(.plain)
                if b("active", true) { content(); if b("error") { Text(s("errorText")).foregroundStyle(theme.error) } }
            }.padding(16).background(b("active") ? surface : .clear, in: RoundedRectangle(cornerRadius: 12))
        } else {
            VStack(alignment: .leading, spacing: 12) {
                ForEach(Array(node.children.filter { $0.slot == nil }.enumerated()), id: \.element.id) { index, item in
                    child(item, properties: ["active": .bool(Int(n("active")) == index), "completed": .bool(b("autoComplete", true) && Int(n("active")) > index), "_index": .number(Double(index))]) { event in
                        onEvent(event)
                        if event.name == "mdStepClick" && !readOnly && (s("mode") == "non-linear" || index <= Int(n("active"))) { changeStep(index) }
                    }
                }
                if b("nav", true) {
                    HStack {
                        Button(s("backLabel", "Back")) { changeStep(Int(n("active")) - 1) }.disabled(n("active") <= 0 || readOnly)
                        Spacer()
                        if b("loading") { ProgressView() }
                        Button(s(Int(n("active")) >= node.children.count - 1 ? "finishLabel" : "nextLabel", Int(n("active")) >= node.children.count - 1 ? "Finish" : "Next")) {
                            if Int(n("active")) >= node.children.count - 1 { emit("mdComplete") } else { changeStep(Int(n("active")) + 1) }
                        }.buttonStyle(AWCActionStyle(primary: true, theme: theme)).disabled(b("nextDisabled") || b("loading") || readOnly)
                    }
                }
            }.accessibilityLabel(label)
        }
    }
    func changeStep(_ index: Int) {
        guard index >= 0 && index < node.children.count else { return }
        let detail: AWCValue = ["index": .number(Double(index)), "previous": .number(n("active"))]
        emit("mdBeforeChange", detail); set("active", .number(Double(index))); emit("mdStepChange", detail)
    }
}
