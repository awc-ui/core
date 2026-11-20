import SwiftUI

/// A renderer-owned layout measurement. It exists only inside an opted-in
/// inspection scope; normal library use installs no geometry readers.
public struct AWCNativeInspectionNode: Equatable {
    public let id: String
    public let name: String
    public let parentId: String?
    public let bounds: CGRect
    public var metrics: [String: AWCValue]
    // Resolve inherited measurements from this same preference/layout pass.
    // For example, a button inherits its label's measured line box.
    var metricSources: [String: String] = [:]
}

extension AWCNativeInspectionNode {
    /// Sizes derived from device-pixel-snapped edges carry binary rounding noise at 3x (289.6̄ − 251.6̄ =
    /// 37.99999999999997 for a 38 pt box); sizes are reported to 1e-9 pt. Origins are unchanged.
    static func measured(_ rect: CGRect) -> CGRect {
        CGRect(x: rect.minX, y: rect.minY, width: (rect.width * 1e9).rounded() / 1e9, height: (rect.height * 1e9).rounded() / 1e9)
    }
}

private struct AWCNativeInspectionScope: Equatable {
    let rootID: String
    let coordinateSpace: String
    /// `"a|b"` inspects several nodes at once; their ids are then qualified as `"<node>:component…"`.
    func matches(_ nodeID: String) -> Bool { rootID == nodeID || (rootID.contains("|") && rootID.split(separator: "|").contains { $0 == nodeID }) }
    func qualify(_ nodeID: String, _ id: String) -> String { rootID.contains("|") ? nodeID + ":" + id : id }
}

/// Reports the inspection of the composed child `childID` as part `part` of `parentID` (and its parts below it).
struct AWCInspectionAlias: Equatable { let childID: String; let parentID: String; let part: String }
private struct AWCInspectionAliasKey: EnvironmentKey { static let defaultValue: AWCInspectionAlias? = nil }
extension EnvironmentValues {
    var awcInspectionAlias: AWCInspectionAlias? {
        get { self[AWCInspectionAliasKey.self] }
        set { self[AWCInspectionAliasKey.self] = newValue }
    }
}

private struct AWCNativeInspectionScopeKey: EnvironmentKey {
    static let defaultValue: AWCNativeInspectionScope? = nil
}

extension View {
    /// Hidden sizing copies (md-menu top-layer measuring pass) publish no inspection nodes.
    func awcInspectionSuppressed() -> some View { environment(\.awcNativeInspectionScope, nil) }
}

private extension EnvironmentValues {
    var awcNativeInspectionScope: AWCNativeInspectionScope? {
        get { self[AWCNativeInspectionScopeKey.self] }
        set { self[AWCNativeInspectionScopeKey.self] = newValue }
    }
}

private struct AWCNativeInspectionPreference: PreferenceKey {
    static var defaultValue: [AWCNativeInspectionNode] { [] }
    static func reduce(value: inout [AWCNativeInspectionNode], nextValue: () -> [AWCNativeInspectionNode]) {
        value.append(contentsOf: nextValue())
    }
}

/// R2-D11: a hidden host renders nothing (display:none, d3-040: no slot, no gap). When that host is itself the single
/// inspection root (a Laboratory preview, a fixture), EmptyView would also drop the collector's modifiers, so the root
/// keeps reporting its last nodes. The root instead publishes the empty inspection; nested hidden hosts stay EmptyView.
struct AWCHiddenHost: View {
    let nodeID: String
    @Environment(\.awcNativeInspectionScope) private var scope
    var body: some View {
        if scope?.rootID == nodeID { Color.clear.frame(width: 0, height: 0).awcInspectionAbsent().accessibilityHidden(true) }
        else { EmptyView() }
    }
}

/// 9-19: the last inspection delivered by a root and the latest value its preference was recomputed with. When SwiftUI
/// recomputes the root preference but does not run the onPreferenceChange action (measured on iPhone 26.3: 4 of 80 runs
/// after a clear; KNOWN-CAUSES 9-19), the value is delivered on the next main-queue turn instead.
final class AWCInspectionDeliveryBox {
    var delivered: [AWCNativeInspectionNode]?
    private var latest: [AWCNativeInspectionNode] = []
    private var scheduled = false
    func saw(_ value: [AWCNativeInspectionNode], _ deliver: @escaping ([AWCNativeInspectionNode]) -> Void) {
        latest = value
        guard value != (delivered ?? []), !scheduled else { return }
        scheduled = true
        DispatchQueue.main.async { [self] in
            scheduled = false
            guard latest != (delivered ?? []) else { return }
            deliver(latest)
        }
    }
}

private struct AWCNativeInspectionModifier: ViewModifier {
    let rootID: String
    let coordinateSpace: String
    let onChange: ([AWCNativeInspectionNode]) -> Void
    @State private var box = AWCInspectionDeliveryBox()

    func body(content: Content) -> some View {
        content
            .environment(\.awcNativeInspectionScope, .init(rootID: rootID, coordinateSpace: coordinateSpace))
            // 9-19: the transform sees every recomputed root value; SwiftUI can drop the change action (KNOWN-CAUSES 9-19).
            .transformPreference(AWCNativeInspectionPreference.self) { [box] v in box.saw(v) { deliver($0) } }
            .onPreferenceChange(AWCNativeInspectionPreference.self) { measured in deliver(measured) }
    }

    private func deliver(_ measured: [AWCNativeInspectionNode]) {
        guard box.delivered != measured else { return }
        box.delivered = measured
        let byID = Dictionary(measured.map { ($0.id, $0) }, uniquingKeysWith: { _, latest in latest })
        let resolved = byID.values.map { node in
            var node = node
            // Multi-node scopes qualify ids; metric sources stay node-relative.
            let prefix = rootID.contains("|") ? node.id.split(separator: ":").first.map { String($0) + ":" } ?? "" : ""
            for (metric, source) in node.metricSources {
                if let value = byID[prefix + source]?.metrics[metric] { node.metrics[metric] = value }
            }
            return node
        }.sorted { $0.id < $1.id }
        onChange(resolved)
    }
}

private struct AWCNativeInspectionPart: ViewModifier {
    let nodeID: String
    let part: String?
    let parentPart: String?
    let name: String
    let metricSources: [String: String]
    let metrics: (CGSize) -> [String: AWCValue]
    @Environment(\.awcNativeInspectionScope) private var scope

    @Environment(\.awcInspectionAlias) private var alias

    @ViewBuilder func body(content: Content) -> some View {
        if let scope, !scope.matches(nodeID), let alias, alias.childID == nodeID, scope.matches(alias.parentID) {
            // A composed child reported as a part of the inspected component (md-fab-menu items: `component.item-N…`).
            let base = "component.\(alias.part)"
            content.background {
                GeometryReader { geometry in
                    Color.clear.preference(key: AWCNativeInspectionPreference.self, value: [
                        .init(id: scope.qualify(alias.parentID, part.map { base + ".\($0)" } ?? base), name: name,
                              parentId: scope.qualify(alias.parentID, part == nil ? "component" : parentPart.map { base + ".\($0)" } ?? base),
                              bounds: AWCNativeInspectionNode.measured(geometry.frame(in: .named(scope.coordinateSpace))),
                              metrics: metrics(geometry.size), metricSources: metricSources)
                    ])
                }.allowsHitTesting(false).accessibilityHidden(true)
            }
        } else if let scope, scope.matches(nodeID) {
            content.background {
                GeometryReader { geometry in
                    Color.clear.preference(key: AWCNativeInspectionPreference.self, value: [
                        .init(id: scope.qualify(nodeID, part.map { "component.\($0)" } ?? "component"), name: name,
                              parentId: part == nil ? nil : scope.qualify(nodeID, parentPart.map { "component.\($0)" } ?? "component"),
                              bounds: AWCNativeInspectionNode.measured(geometry.frame(in: .named(scope.coordinateSpace))),
                              metrics: metrics(geometry.size), metricSources: metricSources)
                    ])
                }.allowsHitTesting(false).accessibilityHidden(true)
            }
        } else { content }
    }
}

public extension View {
    /// Collect instrumentation supplied by native renderers for the selected
    /// AWC node. Coordinates use the host's named capture coordinate space.
    func awcNativeInspection(rootID: String, coordinateSpace: String,
                             onChange: @escaping ([AWCNativeInspectionNode]) -> Void) -> some View {
        modifier(AWCNativeInspectionModifier(rootID: rootID, coordinateSpace: coordinateSpace, onChange: onChange))
    }
}

extension View {
    /// A hidden renderer still publishes an empty preference so a retained
    /// inspector observes removal of its previous measured nodes.
    func awcInspectionAbsent() -> some View {
        preference(key: AWCNativeInspectionPreference.self, value: [])
    }
    func awcInspect(nodeID: String, part: String? = nil, parentPart: String? = nil, name: String,
                    metricSources: [String: String] = [:],
                    metrics: @escaping (CGSize) -> [String: AWCValue] = { _ in [:] }) -> some View {
        modifier(AWCNativeInspectionPart(nodeID: nodeID, part: part, parentPart: parentPart, name: name,
                                        metricSources: metricSources, metrics: metrics))
    }
}

#if canImport(AppKit)
import AppKit

// MARK: - Nested host (a SwiftUI subtree inside an AppKit container; R6-13)

/// An AppKit container that is an accessibility element (role group, subrole `AXLandmarkNavigation`, named by `label`)
/// holding the content in its own hosting view, so the content's elements are the landmark's children with a consistent
/// parent chain (the SwiftUI container node cannot take a subrole; an AppKit element listing SwiftUI children exposes them twice).
final class AWCNestedLandmarkView: NSView {
    var label = "", elementIdentifier = ""
    let controller: NSHostingController<AnyView>
    init(root: AnyView) {
        controller = NSHostingController(rootView: root)
        controller.sizingOptions = []
        super.init(frame: .zero)
        let host = controller.view
        host.translatesAutoresizingMaskIntoConstraints = false
        addSubview(host)
        NSLayoutConstraint.activate([host.leadingAnchor.constraint(equalTo: leadingAnchor), host.trailingAnchor.constraint(equalTo: trailingAnchor),
                                     host.topAnchor.constraint(equalTo: topAnchor), host.bottomAnchor.constraint(equalTo: bottomAnchor)])
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }
    private var refreshTimer: Timer?
    // The nested host does not repaint (or republish its accessibility tree) by itself while the window settles: nudge it for a short time after it joins a window.
    override func viewDidMoveToWindow() {
        super.viewDidMoveToWindow()
        refreshTimer?.invalidate(); refreshTimer = nil
        guard window != nil else { return }
        var n = 0
        refreshTimer = Timer.scheduledTimer(withTimeInterval: 1.0 / 30, repeats: true) { [weak self] t in
            guard let self else { t.invalidate(); return }
            n += 1
            self.controller.rootView = self.controller.rootView
            self.controller.view.needsLayout = true
            self.controller.view.needsDisplay = true
            if n == 120 { NSAccessibility.post(element: self, notification: .layoutChanged); t.invalidate() }
        }
    }
    override func isAccessibilityElement() -> Bool { true }
    override func accessibilityRole() -> NSAccessibility.Role? { .group }
    override func accessibilitySubrole() -> NSAccessibility.Subrole? { NSAccessibility.Subrole(rawValue: "AXLandmarkNavigation") }
    override func accessibilityLabel() -> String? { label }
    override func accessibilityIdentifier() -> String { elementIdentifier }
}

/// Re-applies the outer environment (every key, including the library's own) inside the nested tree, and, inside an
/// inspection scope, names the same coordinate space and reports the nodes up (the outer view offsets them by the container's origin).
private struct AWCNestedInspectionRoot: ViewModifier {
    let report: ([AWCNativeInspectionNode]) -> Void
    @Environment(\.awcNativeInspectionScope) private var scope
    @ViewBuilder func body(content: Content) -> some View {
        if let scope {
            content.coordinateSpace(name: scope.coordinateSpace)
                .onPreferenceChange(AWCNativeInspectionPreference.self) { report($0) }
                // The nodes go up through `report` (offset by the container origin); the nested tree's own values must not reach the outer scope.
                .transformPreference(AWCNativeInspectionPreference.self) { $0 = [] }
        } else { content }
    }
}

private struct AWCNestedLandmarkRepresentable<Content: View>: NSViewRepresentable {
    let label: String, identifier: String, content: Content
    let direction: LayoutDirection
    let report: ([AWCNativeInspectionNode]) -> Void
    private func root(_ context: Context, _ phase: String) -> AnyView {
        let environment = context.environment
        // The representable's own context can report the hosting view's layout direction (the locale's) on updates, so the
        // outer view's direction is passed explicitly and applied after the whole environment is re-applied.
        return AnyView(content.modifier(AWCNestedInspectionRoot(report: report)).environment(\.layoutDirection, direction)
            .transformEnvironment(\.self) { $0 = environment })
    }
    func makeNSView(context: Context) -> AWCNestedLandmarkView {
        let v = AWCNestedLandmarkView(root: root(context, "make")); v.label = label; v.elementIdentifier = identifier; return v
    }
    func updateNSView(_ v: AWCNestedLandmarkView, context: Context) {
        v.label = label; v.elementIdentifier = identifier; v.controller.rootView = root(context, "update")
    }
    func sizeThatFits(_ proposal: ProposedViewSize, nsView: AWCNestedLandmarkView, context: Context) -> CGSize? {
        let size = nsView.controller.sizeThatFits(in: CGSize(width: proposal.width ?? 1200, height: proposal.height ?? 100_000))
        return CGSize(width: proposal.width ?? size.width, height: size.height)
    }
}

/// The content in a navigation landmark (macOS). Environment, sizing and inspection pass through the nested host.
struct AWCNestedLandmark<Content: View>: View {
    let label: String, identifier: String
    @ViewBuilder let content: Content
    @Environment(\.awcNativeInspectionScope) private var scope
    @Environment(\.layoutDirection) private var direction
    @State private var nodes: [AWCNativeInspectionNode] = []
    var body: some View {
        AWCNestedLandmarkRepresentable(label: label, identifier: identifier, content: content, direction: direction, report: { nodes = $0 })
            .background {
                if let scope {
                    GeometryReader { g in
                        let origin = g.frame(in: .named(scope.coordinateSpace)).origin
                        Color.clear.preference(key: AWCNativeInspectionPreference.self, value: nodes.map {
                            AWCNativeInspectionNode(id: $0.id, name: $0.name, parentId: $0.parentId,
                                                    bounds: AWCNativeInspectionNode.measured($0.bounds.offsetBy(dx: origin.x, dy: origin.y)),
                                                    metrics: $0.metrics, metricSources: $0.metricSources)
                        })
                    }.allowsHitTesting(false).accessibilityHidden(true)
                }
            }
    }
}
#endif
