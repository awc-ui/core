import SwiftUI

/// Demonstrates only local native presentation state. No URL is opened or fetched.
public struct AWCButtonNavigationDemo: View {
    public var properties: [String: AWCValue]
    public var onEvent: (AWCEvent) -> Void
    @State private var navigation = AWCNavigationCoordinator(baseURL: URL(string: "https://awc.local/demo/")!)
    @State private var target = "_self"
    @State private var cancelCapture = false
    @State private var stopBubble = false
    @State private var stopImmediate = false
    @State private var rejectNavigation = false
    @State private var trace: [String] = []
    @State private var selection = false
    @State private var status = "Ready · all routes stay local"
    public init(properties: [String: AWCValue] = [:], onEvent: @escaping (AWCEvent) -> Void = { _ in }) {
        self.properties = properties; self.onEvent = onEvent
    }
    private func record(_ context: AWCEventContext, listener: String) {
        let entry = "\(context.event.name) · \(context.phase.rawValue) · \(listener)"
        if context.event.name == "mdClick" { trace = Array((trace + [entry]).suffix(7)) }
        onEvent(AWCEvent(name: "mdPropagation", tag: "native-event", nodeID: context.targetID,
                        detail: ["phase": .string(context.phase.rawValue), "scope": .string(context.currentScopeID ?? ""),
                                 "listener": .string(listener), "path": .array(context.path.map(AWCValue.string)), "event": .string(context.event.name)]))
    }
    private func observed(_ event: AWCEvent) {
        onEvent(event)
        if event.name == "mdClick" && event.defaultPrevented { status = "Click canceled before toggle and navigation" }
        if event.name == "mdChange" { selection = event.detail["selected"].bool ?? false }
    }
    private var actionNode: AWCNode {
        var values = properties
        values.merge(["type": "button", "href": "next", "target": .string(target), "toggle": true,
                      "selected": .bool(selection), "variant": "filled", "size": "sm"]) { _, explicit in explicit }
        return AWCNode(id: "navigation-go", tag: "md-button", properties: values, children: [.text("Navigate + toggle")])
    }
    private var propagationButton: some View {
        AWCEventScope(id: "outer", onCapture: { context in
            if context.event.name == "mdClick" { trace = [] }
            record(context, listener: "outer")
            if cancelCapture && context.event.name == "mdClick" { context.preventDefault() }
        }, onEvent: { record($0, listener: "outer") }) {
            AWCEventScope(id: "inner", onCapture: { record($0, listener: "inner") }, listeners: [
                AWCEventListener { context in
                    record(context, listener: "inner first")
                    if context.event.name == "mdClick" {
                        if stopImmediate { context.stopImmediatePropagation() }
                        else if stopBubble { context.stopPropagation() }
                    }
                }
            ], onEvent: { record($0, listener: "inner second") }) {
                AWCEventTargetScope(onEvent: { record($0, listener: "button") }) {
                    AWCNativeView(node: actionNode, onEvent: observed)
                }
            }
        }.awcURLRouter(navigation.router(from: "editor"))
    }
    public var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Native navigation & event phases").font(.headline)
            Text("Source: editor · relative route: next").font(.caption).foregroundStyle(.secondary)
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 65), spacing: 6)], alignment: .leading, spacing: 4) {
                ForEach(["_self", "_blank", "_parent", "_top", "details"], id: \.self) { value in
                    Button(value) { target = value }.buttonStyle(.bordered).tint(target == value ? .accentColor : .secondary)
                }
            }.controlSize(.small)
            Toggle("Cancel during capture", isOn: $cancelCapture)
            Toggle("Stop bubble at inner scope", isOn: $stopBubble)
            Toggle("Stop other inner listeners", isOn: $stopImmediate)
            Toggle("Host rejects navigation", isOn: $rejectNavigation)
            HStack {
                propagationButton
                Button("Back") { _ = navigation.back() }.buttonStyle(.bordered).disabled(navigation.context(id: navigation.activeContextID)?.canGoBack != true)
            }
            Text(status + " · Toggle: " + (selection ? "on" : "off")).font(.caption)
            VStack(alignment: .leading, spacing: 3) {
                ForEach(Array(navigation.contexts.suffix(4))) { context in
                    Text("\(context.name ?? context.id.prefix(8).description)\(context.id == navigation.activeContextID ? " •" : ""): \(context.currentURL.absoluteString) [\(context.historyIndex + 1)/\(context.history.count)]")
                        .font(.caption.monospaced()).lineLimit(2)
                }
            }.accessibilityIdentifier("native-navigation-contexts")
            Text("Capture → target → bubble").font(.caption.bold())
            VStack(alignment: .leading, spacing: 2) {
                ForEach(Array(trace.enumerated()), id: \.offset) { _, entry in Text(entry).font(.caption.monospaced()).lineLimit(1) }
            }.frame(minHeight: 60, alignment: .topLeading).accessibilityIdentifier("native-event-trace")
        }
        .onAppear {
            _ = navigation.createContext(id: "section", name: "section", parentID: navigation.rootID)
            _ = navigation.createContext(id: "editor", name: "editor", parentID: "section")
            navigation.shouldNavigate = { _ in
                if rejectNavigation { status = "Host rejected navigation; history unchanged"; return false }
                return true
            }
            navigation.onPresent = { transition in
                status = "\(transition.kind.rawValue): \(transition.target) → \(transition.url.path)"
                onEvent(AWCEvent(name: "mdNavigate", tag: "native-navigation", nodeID: "navigation-demo", detail: [
                    "sourceID": .string(transition.sourceID), "destinationID": .string(transition.destinationID),
                    "url": .string(transition.url.absoluteString), "target": .string(transition.target),
                    "createsContext": .bool(transition.createsContext), "kind": .string(transition.kind.rawValue)]))
            }
        }
        .onDisappear { navigation.shouldNavigate = { _ in true }; navigation.onPresent = { _ in } }
    }
}
