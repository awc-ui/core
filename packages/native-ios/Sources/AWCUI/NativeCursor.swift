import SwiftUI
#if os(macOS)
import AppKit
#endif

/// The CSS `cursor` values the AWC sources declare, mapped to the platform pointer.
/// macOS: the matching system cursor (`pointerStyle` on macOS 15+, `NSCursor` before);
/// iPadOS: the pointer hover effect for actionable cursors (iPadOS has no hand/grab pointers);
/// the innermost styled view wins, as the innermost element's `cursor` does in CSS.
public enum AWCCursorStyle: String, Sendable, CaseIterable {
    case pointer, `default`, grab, grabbing, notAllowed = "not-allowed", text, crosshair, ewResize = "ew-resize"

    /// Parses a computed CSS cursor; `auto`/`inherit`/unknown → nil (no own cursor).
    public init?(css: String) {
        let v = css.trimmingCharacters(in: .whitespaces).lowercased()
        guard let s = AWCCursorStyle(rawValue: v) else { return nil }
        self = s
    }
    /// Actionable cursors get the iPadOS hover effect.
    var actionable: Bool { self == .pointer || self == .grab || self == .grabbing }
    #if os(macOS)
    public var nsCursor: NSCursor {
        switch self {
        case .pointer: .pointingHand
        case .default: .arrow
        case .grab: .openHand
        case .grabbing: .closedHand
        case .notAllowed: .operationNotAllowed
        case .text: .iBeam
        case .crosshair: .crosshair
        case .ewResize: .resizeLeftRight
        }
    }
    @available(macOS 15.0, *)
    var pointerStyle: PointerStyle {
        switch self {
        case .pointer: return .link
        case .default: return .default
        case .grab: return .grabIdle
        case .grabbing: return .grabActive
        case .text: return .horizontalText
        case .crosshair: return .rectSelection
        case .notAllowed, .ewResize:
            let c = nsCursor, size = c.image.size
            return .image(Image(nsImage: c.image), hotSpot: UnitPoint(x: size.width > 0 ? c.hotSpot.x / size.width : 0, y: size.height > 0 ? c.hotSpot.y / size.height : 0))
        }
    }
    #endif
}

/// Which cursor is showing: the hovered styled view with the greatest nesting depth (CSS: the innermost element).
/// Tests read `current`; on macOS 14 the arbiter also sets the `NSCursor`.
@MainActor public final class AWCCursorArbiter {
    public static let shared = AWCCursorArbiter()
    private var hovered: [UUID: (depth: Int, order: Int, style: AWCCursorStyle)] = [:]
    private var order = 0
    public private(set) var current: AWCCursorStyle?
    func hover(_ id: UUID, depth: Int, style: AWCCursorStyle, inside: Bool) {
        if inside { if hovered[id] == nil { order += 1 }; hovered[id] = (depth, hovered[id]?.order ?? order, style) } else { hovered[id] = nil }
        resolve()
    }
    func remove(_ id: UUID) { if hovered.removeValue(forKey: id) != nil { resolve() } }
    /// Test hook: forget every hover (a fixture swap removes views without hover-end events).
    public func reset() { hovered = [:]; current = nil }
    private func resolve() {
        current = hovered.values.max { ($0.depth, $0.order) < ($1.depth, $1.order) }?.style
        #if os(macOS)
        if #unavailable(macOS 15.0) { (current?.nsCursor ?? .arrow).set() }
        #endif
    }
}

private struct AWCCursorDepthKey: EnvironmentKey { static let defaultValue = 0 }
extension EnvironmentValues { var awcCursorDepth: Int { get { self[AWCCursorDepthKey.self] } set { self[AWCCursorDepthKey.self] = newValue } } }
private struct AWCCursorTracksInjectedPointerKey: EnvironmentKey { static let defaultValue = false }
public extension EnvironmentValues {
    /// Opt-in for embedding hosts that drive the pointer through `awcNativePointerState` and want the cursor resolved
    /// (integration fixtures). Off by default: per-control geometry tracking perturbs render-order-sensitive state
    /// (modal focus registration), so it is attached only where it is asked for.
    var awcCursorTracksInjectedPointer: Bool {
        get { self[AWCCursorTracksInjectedPointerKey.self] }
        set { self[AWCCursorTracksInjectedPointerKey.self] = newValue }
    }
}

final class AWCCursorTracking { var frame: CGRect = .zero; var inside = false }

struct AWCCursorModifier: ViewModifier {
    /// nil = no own cursor (`auto`/`inherit`, or `pointer-events: none`). The modifier stays applied either way, so a
    /// cursor change (e.g. drag start, disabled toggle) never changes the content's structural identity.
    let style: AWCCursorStyle?
    /// CSS `:active` variant, shown while a press that began on this view is held (e.g. `grab` → `grabbing`).
    let active: AWCCursorStyle?
    @Environment(\.awcCursorDepth) private var depth
    /// Hosts that embed the view (the Laboratory live renderer, integration fixtures) supply pointer geometry in the
    /// "awc-native-preview" space instead of AppKit hover events; that is then the only pointer source.
    @Environment(\.awcNativePointerState) private var pointer
    @Environment(\.awcCursorTracksInjectedPointer) private var tracksInjected
    @State private var id = UUID()
    /// Hover/geometry bookkeeping lives in a reference: tracking it must never invalidate the styled view (a re-render
    /// re-registers focus targets and other render-order state of the content).
    @State private var tracking = AWCCursorTracking()
    @State private var pressed = false
    private var effective: AWCCursorStyle? { pressed ? active ?? style : style }
    private func publish() {
        if tracking.inside, let s = effective { AWCCursorArbiter.shared.hover(id, depth: depth, style: s, inside: true) } else { AWCCursorArbiter.shared.remove(id) }
    }
    private func sync() {
        guard let pointer else { return }
        let now = pointer.location.map { tracking.frame.contains($0) } ?? false
        let press = active != nil && pointer.isPointerDown && (pointer.pressLocation.map { tracking.frame.contains($0) } ?? false)
        if press != pressed { pressed = press }
        if now != tracking.inside { tracking.inside = now; publish() }
    }
    private var pressGesture: some Gesture {
        DragGesture(minimumDistance: 0).onChanged { _ in if !pressed { pressed = true; publish() } }.onEnded { _ in pressed = false; publish() }
    }
    /// Only what the context needs is attached (both conditions are fixed for a call site / embedding host, so the
    /// structure never changes at runtime): press tracking for `active` styles, pointer geometry when a host supplies it.
    /// Adding unused gesture or geometry modifiers to every control perturbs the content (e.g. modal focus order).
    func body(content: Content) -> some View {
        let base = content
            .environment(\.awcCursorDepth, depth + 1)
            .modifier(AWCPlatformCursor(style: effective))
            .onContinuousHover(coordinateSpace: .local) { phase in
                guard pointer == nil else { return }
                switch phase { case .active: if !tracking.inside { tracking.inside = true; publish() }; case .ended: tracking.inside = false; publish() }
            }
            .onChange(of: effective) { _, _ in publish() }
            .onDisappear { AWCCursorArbiter.shared.remove(id) }
        if pointer != nil && tracksInjected {
            // A view that appears or moves under a resting pointer (a re-rendered handle, a sliding row) re-evaluates too.
            base.onGeometryChange(for: CGRect.self) { $0.frame(in: .named("awc-native-preview")) } action: { tracking.frame = $0; sync() }
                .onChange(of: pointer?.location) { _, _ in sync() }
                .onChange(of: pointer?.isPointerDown) { _, _ in sync() }
        } else if active != nil {
            base.simultaneousGesture(pressGesture)
        } else { base }
    }
}

private struct AWCPlatformCursor: ViewModifier {
    let style: AWCCursorStyle?
    func body(content: Content) -> some View {
        #if os(macOS)
        if #available(macOS 15.0, *) { content.pointerStyle(style?.pointerStyle) } else { content }
        #else
        content.hoverEffect(.highlight, isEnabled: style?.actionable == true)
        #endif
    }
}

public extension View {
    /// Applies a source CSS `cursor` over this view's bounds (nil: no own cursor). Always the same modifier structure.
    func awcCursor(_ style: AWCCursorStyle?, active: AWCCursorStyle? = nil) -> some View {
        modifier(AWCCursorModifier(style: style, active: active))
    }
}

/// Host-level `cursor` rules of the sources (`:host { cursor }` and their disabled variants), applied by the
/// shared dispatch. Part-level cursors (handles, close buttons, fields) are applied by each renderer.
func awcHostCursor(tag: String, properties p: [String: AWCValue]) -> AWCCursorStyle? {
    func b(_ k: String) -> Bool { p[k]?.bool == true }
    // Hard-disabled hosts set `pointer-events: none`: no own cursor, the content beneath shows through (nil).
    // `[soft-disabled]` restores `pointer-events: auto` with `cursor: default`.
    let disabled = b("disabled"), soft = b("softDisabled") && !disabled
    switch tag {
    case "md-button", "md-icon-button", "md-fab", "md-fab-menu-item", "md-checkbox", "md-switch", "md-radio", "md-chip",
         "md-segmented-button", "md-split-button":
        return disabled ? nil : soft ? .default : .pointer
    case "md-menu-item", "md-sub-menu-item", "md-tab", "md-navigation-rail-tab", "md-table-sort-label":
        return disabled ? nil : .pointer
    case "md-navigation-tab": return disabled ? nil : soft ? .notAllowed : .pointer
    // `.md-slider__input { cursor: pointer }` covers the control even when the host is disabled (`not-allowed`).
    case "md-slider": return .pointer
    case "md-table-row": return b("clickable") ? .pointer : nil
    case "md-time-picker": return disabled ? .notAllowed : nil
    default: return nil
    }
}
