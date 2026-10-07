import SwiftUI

extension AWCNativeView {
    var sheet: some View {
        Button(label.isEmpty ? "Open \(node.tag.replacingOccurrences(of: "md-", with: ""))" : label) { showOverlay(true) }
            .buttonStyle(AWCActionStyle(primary: true, theme: theme))
            .sheet(isPresented: Binding(get: { b("open") }, set: { value in if !value { emit("mdCancel") }; showOverlay(value) })) {
                VStack(alignment: .leading, spacing: 20) {
                    HStack {
                        if b("showBack") { Button { emit("mdBack") } label: { Image(systemName: "arrow.left") }.accessibilityLabel("Back") }
                        content("icon"); content("header-action"); symbol(s("icon")); Text(label).font(.title2.bold()); Spacer()
                        if b("closeable", true) { Button(s("closeLabel", "Close")) { showOverlay(false) } }
                    }
                    if b("topDivider") || b("headerDivider") { Divider() }
                    content("headline"); ScrollView { content(); content("content") }
                    if b("bottomDivider") || b("divider") { Divider() }
                    content("actions")
                    if node.tag == "md-dialog" && !node.children.contains(where: { $0.slot == "actions" }) {
                        HStack { Spacer(); Button(s("cancelLabel", "Cancel")) { emit("mdCancel"); showOverlay(false) }; Button(s("okLabel", "OK")) { showOverlay(false) }.buttonStyle(AWCActionStyle(primary: true, theme: theme)) }
                    }
                }.padding(24).presentationDetents(node.tag == "md-bottom-sheet" ? [.medium, .large] : [.large])
                .presentationDragIndicator(b("showDragHandle", true) ? .visible : .hidden)
                .interactiveDismissDisabled(!b("scrimDismissible", true))
            }
    }
    var menu: some View {
        VStack(alignment: .leading, spacing: 8) {
            Button { showOverlay(!b("open")) } label: {
                Label(s(node.tag == "md-fab-menu" ? "menuLabel" : "listLabel", "Menu"), systemImage: node.tag == "md-fab-menu" ? "plus" : "ellipsis")
            }.buttonStyle(AWCActionStyle(primary: true, theme: theme))
            if b("open") {
                VStack(alignment: .leading, spacing: s("layout") == "grouped" ? 12 : 2) {
                    content("header")
                    if node.children.isEmpty { Text(s("emptyText", "No items")).foregroundStyle(.secondary).padding() }
                    ForEach(node.children) { item in
                        child(item) { event in
                            onEvent(event)
                            if event.name == "mdClick" && !b("persistent") && item.properties["keepOpen"]?.bool != true && item.tag != "md-sub-menu-item" { showOverlay(false) }
                        }
                    }
                }.padding(8).background(surface, in: RoundedRectangle(cornerRadius: 16)).overlay(RoundedRectangle(cornerRadius: 16).stroke(theme.primary.opacity(0.15)))
            }
        }.animation(.easeInOut(duration: 0.18), value: b("open"))
    }
    @ViewBuilder var menuItem: some View {
        if node.tag == "md-menu-item-group" {
            VStack(alignment: .leading, spacing: 4) { Text(label).font(.caption.bold()).foregroundStyle(.secondary).padding(.horizontal, 12); content() }
        } else {
            VStack(alignment: .leading, spacing: 0) {
                if b("divider") { Divider() }
                Button {
                    if s("type") == "checkbox" { set("selected", .bool(!b("selected"))) }
                    if s("type") == "radio" { set("selected", true) }
                    if node.tag == "md-sub-menu-item" { set("_expanded", .bool(!b("_expanded"))) }
                    emit("mdClick")
                } label: {
                    HStack(spacing: 12) {
                        content("start"); content("leading-icon")
                        if s("type") == "checkbox" || s("type") == "radio" { Image(systemName: b("selected") ? "checkmark.circle.fill" : "circle") }
                        VStack(alignment: .leading) { Text(label); support }
                        Spacer(); Text(s("trailingText")).font(.caption).foregroundStyle(.secondary)
                        if !s("badge").isEmpty { Text(s("badge")).font(.caption).padding(4).background(theme.primary.opacity(0.2), in: Capsule()) }
                        content("end"); content("trailing-icon")
                        if node.tag == "md-sub-menu-item" { Image(systemName: b("_expanded") ? "chevron.down" : "chevron.right") }
                    }.padding(12).contentShape(Rectangle())
                }.buttonStyle(.plain)
                if node.tag == "md-sub-menu-item" && b("_expanded") { content().padding(.leading, 20); content("submenu").padding(.leading, 20) }
            }
        }
    }
    var snackbar: some View {
        VStack(spacing: 8) {
            if !b("open") { Button("Show message") { showOverlay(true) }.buttonStyle(AWCActionStyle(theme: theme)) }
            else {
                HStack(spacing: 12) {
                    content(); content("action"); content("close"); Text(s("message")).frame(maxWidth: .infinity, alignment: .leading)
                    if !s("action").isEmpty { Button(s("action")) { emit("mdAction"); closeSnackbar("action") }.foregroundStyle(Color.white) }
                    if b("closeable") { Button { closeSnackbar("close") } label: { Image(systemName: "xmark") }.accessibilityLabel(s("dismissLabel", "Dismiss")) }
                }.padding(16).foregroundStyle(.white).background(Color(white: 0.2), in: RoundedRectangle(cornerRadius: 12))
            }
        }.task(id: b("open")) {
            guard b("open") && b("autoHide", true) else { return }
            do { try await Task.sleep(for: .milliseconds(max(0, n("autoHideDuration", 5000)))); if !Task.isCancelled { closeSnackbar("auto") } } catch {}
        }
    }
    func closeSnackbar(_ reason: String) { set("open", false); emit("mdClose", ["reason": .string(reason)]) }
    var tooltip: some View {
        VStack(alignment: .leading, spacing: 8) {
            Button { showOverlay(!b("open")) } label: { if node.children.isEmpty { Label("Details", systemImage: "info.circle") } else { content() } }.buttonStyle(.plain)
            if b("open") {
                VStack(alignment: .leading, spacing: 8) { content("subhead"); content("content"); if !s("subhead").isEmpty { Text(s("subhead")).fontWeight(.semibold) }; Text(s("text")); content("actions") }
                    .font(.callout).padding(12).foregroundStyle(.white).background(Color(white: 0.2), in: RoundedRectangle(cornerRadius: s("variant") == "rich" ? 16 : 6))
            }
        }
    }
    var search: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 12) {
                Button { emit("mdLeadingIconClick", ["value": p("value"), "open": .bool(b("open"))]); showOverlay(!b("open")) } label: { symbol(s("leadingIcon", "search")) }.buttonStyle(.plain)
                TextField(s("placeholder", "Search"), text: Binding(get: { s("value") }, set: { value in
                    set("value", .string(value)); emit("mdInput", ["value": .string(value)]); emit("mdSearch", ["value": .string(value)]); if !b("open") { showOverlay(true) }
                })).onSubmit { emit("mdSubmit", ["value": p("value")]); emit("mdChange", ["value": p("value")]) }
                if b("showClearButton", true) && !s("value").isEmpty { Button { set("value", ""); emit("mdClear"); emit("mdInput", ["value": ""]) } label: { Image(systemName: "xmark.circle.fill") }.buttonStyle(.plain).accessibilityLabel("Clear search") }
                content("trailing")
            }.padding(16).background(surface, in: Capsule())
            if b("loading") { ProgressView(s("loadingLabel", "Searching…")) }
            if b("open") { content(); content("results"); if node.children.isEmpty { Text(s("noResultsLabel", "No results")).font(.caption).foregroundStyle(.secondary) } }
        }
    }
}
