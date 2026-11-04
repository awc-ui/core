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

private struct AWCNativeInspectionModifier: ViewModifier {
    let rootID: String
    let coordinateSpace: String
    let onChange: ([AWCNativeInspectionNode]) -> Void

    func body(content: Content) -> some View {
        content
            .environment(\.awcNativeInspectionScope, .init(rootID: rootID, coordinateSpace: coordinateSpace))
            .onPreferenceChange(AWCNativeInspectionPreference.self) { measured in
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
