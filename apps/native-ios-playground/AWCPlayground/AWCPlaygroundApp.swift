import SwiftUI
import AWCUI

@main
struct AWCPlaygroundApp: App {
    var body: some Scene {
        WindowGroup { PlaygroundView() }
    }
}

struct PlaygroundView: View {
    @State private var query = ""
    @State private var selected = "md-button"
    @State private var dark = false
    @State private var component = AWCExamples.node(for: "md-button")
    @State private var events: [AWCEvent] = []
    @State private var editor = ""
    @State private var error: String?
    @State private var generation = 0
    @State private var tab = "Preview"

    private var tags: [String] { AWCComponentCatalog.tags.filter { query.isEmpty || $0.localizedCaseInsensitiveContains(query) || (AWCComponentCatalog.summaries[$0] ?? "").localizedCaseInsensitiveContains(query) } }
    var body: some View {
        NavigationSplitView {
            List(selection: $selected) {
                Section {
                    Text("AWC Native").font(.title.bold())
                    Text("\(AWCComponentCatalog.tags.count) components · SwiftUI").font(.caption).foregroundStyle(.secondary)
                }
                Section("Components") { ForEach(tags, id: \.self) { tag in NavigationLink(value: tag) { Text(tag.replacingOccurrences(of: "md-", with: "")).font(.callout) } } }
            }.searchable(text: $query, prompt: "Find a component")
            .navigationTitle("Catalog")
            .navigationSplitViewColumnWidth(min: 220, ideal: 260)
        } detail: {
            VStack(alignment: .leading, spacing: 0) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(selected).font(.title2.bold().monospaced())
                        Text(AWCComponentCatalog.summaries[selected] ?? "").font(.callout).foregroundStyle(.secondary).lineLimit(3)
                    }
                    Spacer()
                    Toggle(isOn: $dark) { Image(systemName: dark ? "moon.fill" : "sun.max") }.toggleStyle(.switch).labelsHidden().accessibilityLabel("Dark appearance")
                }.padding(20)
                Picker("Workspace panel", selection: $tab) { Text("Preview").tag("Preview"); Text("Properties").tag("Properties"); Text("Events (\(events.count))").tag("Events") }.pickerStyle(.segmented).padding(.horizontal, 20).padding(.bottom, 16)
                Divider()
                if tab == "Preview" { preview }
                else if tab == "Properties" { properties }
                else { eventLog }
            }.toolbar { ToolbarItem { Button { reset() } label: { Label("Reset", systemImage: "arrow.counterclockwise") } } }
            .navigationTitle("Native playground")
        }.preferredColorScheme(dark ? .dark : .light)
        .awcTheme(.generated(dark: dark))
        .onChange(of: selected) { _, _ in reset() }
        .onAppear { reset() }
    }
    private var preview: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                HStack { Label("Native SwiftUI", systemImage: "iphone").font(.caption.bold()); Spacer(); Text(dark ? "Dark theme" : "Light theme").font(.caption).foregroundStyle(.secondary) }
                AWCNativeView(node: component) { event in events.insert(event, at: 0); if events.count > 100 { events.removeLast() } }
                    .id("\(selected)-\(generation)").frame(maxWidth: .infinity, alignment: .leading)
                    .padding(24).background(.background, in: RoundedRectangle(cornerRadius: 20))
                    .overlay(RoundedRectangle(cornerRadius: 20).stroke(.secondary.opacity(0.18)))
                quickControls
                Text("Portable behavior is implemented by native adapters. The Properties panel exposes the source contract; unsupported web-specific behavior is documented in NativeSupport.json.").font(.caption).foregroundStyle(.secondary)
            }.padding(20).frame(maxWidth: 900, alignment: .leading)
        }.background(.secondary.opacity(0.04))
    }
    private var quickControls: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Live properties").font(.headline)
            ForEach(["disabled", "selected", "checked", "loading", "open", "error", "range", "expanded"].filter { component.properties[$0]?.bool != nil }, id: \.self) { key in
                Toggle(key, isOn: Binding(get: { component.properties[key]?.bool ?? false }, set: { component.properties[key] = .bool($0); updateEditor() }))
            }
            let variant = AWCNativeCatalog.components.first { $0.tag == selected }?.properties.first { $0.name == "variant" }
            if let variant, !variant.options.isEmpty {
                Picker("Variant", selection: Binding(get: { component.properties["variant"]?.string ?? variant.options[0] }, set: { component.properties["variant"] = .string($0); updateEditor() })) { ForEach(variant.options, id: \.self) { Text($0).tag($0) } }
            }
        }.padding(16).background(.secondary.opacity(0.06), in: RoundedRectangle(cornerRadius: 14))
    }
    private var properties: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack { Text("Component tree JSON").font(.headline); Spacer(); Button("Apply changes") { applyEditor() }.buttonStyle(.borderedProminent) }
            Text("Edit properties, named slots, and nested children. Changes are applied to the native component.").font(.caption).foregroundStyle(.secondary)
            TextEditor(text: $editor).font(.system(.caption, design: .monospaced)).padding(8).overlay(RoundedRectangle(cornerRadius: 8).stroke(.secondary.opacity(0.3)))
            if let error { Text(error).font(.caption).foregroundStyle(.red) }
        }.padding(20)
    }
    private var eventLog: some View {
        VStack(alignment: .leading) {
            HStack { Text("Native events").font(.headline); Spacer(); Button("Clear") { events.removeAll() } }.padding()
            if events.isEmpty { ContentUnavailableView("No events yet", systemImage: "waveform.path", description: Text("Interact with the component to inspect its event payloads.")) }
            else {
                List(events) { event in
                    VStack(alignment: .leading, spacing: 6) {
                        HStack { Text(event.name).font(.body.monospaced().bold()); Spacer(); Text(event.tag).font(.caption).foregroundStyle(.secondary) }
                        Text(event.detail.json).font(.system(.caption, design: .monospaced)).textSelection(.enabled)
                    }.padding(.vertical, 6)
                }
            }
        }
    }
    private func reset() { component = AWCExamples.node(for: selected); generation += 1; events.removeAll(); error = nil; updateEditor() }
    private func updateEditor() {
        let encoder = JSONEncoder(); encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        editor = (try? String(data: encoder.encode(component), encoding: .utf8)) ?? "{}"
    }
    private func applyEditor() {
        do {
            let value = try JSONDecoder().decode(AWCNode.self, from: Data(editor.utf8))
            guard AWCComponentCatalog.tags.contains(value.tag) else { error = "Unknown component tag: \(value.tag)"; return }
            component = value; generation += 1; error = nil; tab = "Preview"
        } catch { self.error = error.localizedDescription }
    }
}
