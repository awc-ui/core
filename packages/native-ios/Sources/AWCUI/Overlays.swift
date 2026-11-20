import SwiftUI

extension AWCNativeView {
    var sheet: some View {
        Button(label.isEmpty ? "Open \(node.tag.replacingOccurrences(of: "md-", with: ""))" : label) { showOverlay(true) }
            .buttonStyle(AWCActionStyle(primary: true, theme: theme))
            .awcPreviewSheet(isPresented: $local[awcBool: "open"], onChange: { value in if !value { emit("mdCancel") }; emit(value ? "mdOpen" : "mdClose") }, placement: node.tag == "md-bottom-sheet" ? .bottom : node.tag == "md-side-sheet" ? .trailing : .center, scrimDismissible: b("scrimDismissible", true)) {
                VStack(alignment: .leading, spacing: 20) {
                    HStack {
                        if b("showBack") { Button { emit("mdBack") } label: { Image(systemName: "arrow.left") }.accessibilityLabel("Back") }
                        content("icon"); content("header-action"); symbol(s("icon")); Text(label).font(.title2.bold()); Spacer()
                        if b("closeable", true) { Button(s("closeLabel").isEmpty ? "Close" : s("closeLabel")) { showOverlay(false) } }
                    }
                    if b("topDivider") || b("headerDivider") { Divider() }
                    content("headline"); ScrollView { content(); content("content") }
                    if b("bottomDivider") || b("divider") { Divider() }
                    content("actions")
                    if node.tag == "md-dialog" && !node.children.contains(where: { $0.slot == "actions" }) {
                        HStack { Spacer(); Button(s("cancelLabel").isEmpty ? "Cancel" : s("cancelLabel")) { emit("mdCancel"); showOverlay(false) }; Button(s("okLabel").isEmpty ? "OK" : s("okLabel")) { showOverlay(false) }.buttonStyle(AWCActionStyle(primary: true, theme: theme)) }
                    }
                }.padding(24).presentationDetents(node.tag == "md-bottom-sheet" ? [.medium, .large] : [.large])
                .presentationDragIndicator(b("showDragHandle", true) ? .visible : .hidden)
                .interactiveDismissDisabled(!b("scrimDismissible", true))
            }
    }
    var snackbar: some View {
        AWCNativeSnackbar(node:node,properties:local,theme:theme,onEvent:{event in
            if event.nodeID==node.id{emit(event.name,event.detail)}else{onEvent(event)}
        },onOpenChanged:{set("open",.bool($0))})
    }
    var tooltip: some View {
        AWCNativeTooltip(node:node,properties:local,theme:theme,onEvent:{event in
            if event.nodeID==node.id{
                onEvent(AWCEventDispatcher.dispatch(event,through:eventDispatcher,cancelable:true,bubbles:false,crossesBoundaries:false,targetListeners:eventTargetListeners).observedEvent)
            }else{onEvent(event)}
        },onOpenChanged:{set("open",.bool($0))})
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
