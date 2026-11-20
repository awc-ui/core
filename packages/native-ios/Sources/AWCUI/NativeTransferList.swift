import SwiftUI

// md-transfer-list SwiftUI renderer: two columns (header with the select-all md-checkbox, title and count pill; the
// md-text-field search; the listbox of option rows with a decorative md-checkbox, label and description, or the empty
// state) around the four md-icon-button movers; the ≤ 640 px stacked layout with rotated movers; RTL mirrored movers;
// density; the twenty hooks; row hover/checked/focus layers (100 ms); the source's check and move rules and events.

private struct AWCTransferListViewportKey: EnvironmentKey { static let defaultValue: CGFloat? = nil }
public extension EnvironmentValues {
    /// The viewport width the source's `@media (max-width: 640px)` reads (nil: the window's).
    var awcTransferListViewport: CGFloat? { get { self[AWCTransferListViewportKey.self] } set { self[AWCTransferListViewportKey.self] = newValue } }
}
public extension View { func awcTransferListViewport(_ width: CGFloat?) -> some View { environment(\.awcTransferListViewport, width) } }

/// Parity-test access to a transfer list's interaction state (checks, queries, row hover and keyboard focus).
public struct AWCTransferListProbe {
    public let toggle: (_ target: Bool, _ value: String) -> Void
    public let search: (_ target: Bool, _ text: String) -> Void
    public let hover: (_ target: Bool, _ value: String?) -> Void
    public let focusRow: (_ target: Bool, _ value: String) -> Void
    /// What the Chrome states oracle samples, now (row backgrounds as premultiplied sRGB + alpha).
    public var snapshot: () -> AWCTransferListSnapshot? = { nil }
}
public struct AWCTransferListRowSnapshot: Equatable { public let label: String, checked: Bool, background: [Double], ring: Bool }
public struct AWCTransferListSideSnapshot: Equatable { public let rows: [AWCTransferListRowSnapshot], count: String, selectAll: [Bool]?, query: String?, empty: String? }
public struct AWCTransferListSnapshot: Equatable {
    public let value: [String], source: AWCTransferListSideSnapshot, target: AWCTransferListSideSnapshot
    public let movers: [String], moversDisabled: [Bool], focusedRow: String?
}

/// The frame clock of parity tests (virtual ms on Chrome's frame grid); nil in production (the display's time).
@MainActor @Observable final class AWCTransferListClock {
    private(set) var now: Double
    init(now: Double = 0) { self.now = now }
    func tick(_ ms: Double = 1000.0 / 60) { now += ms }
}
private struct AWCTransferListClockKey: EnvironmentKey { static let defaultValue: AWCTransferListClock? = nil }
private struct AWCTransferListReducedMotionKey: EnvironmentKey { static let defaultValue: Bool? = nil }
extension EnvironmentValues {
    var awcTransferListClock: AWCTransferListClock? { get { self[AWCTransferListClockKey.self] } set { self[AWCTransferListClockKey.self] = newValue } }
    /// Overrides the system reduced-motion setting for transfer lists in this subtree (parity tests, the Laboratory's motion toggle).
    public var awcTransferListReducedMotion: Bool? { get { self[AWCTransferListReducedMotionKey.self] } set { self[AWCTransferListReducedMotionKey.self] = newValue } }
}

/// A row's `transition: background-color 100ms ease`: CSS colour interpolation (premultiplied Oklab), starting at the first frame
/// after the change (that frame shows the start value); a zero duration (reduced motion) switches at that frame.
struct AWCTransferListTrack {
    var from: [Double], to: [Double], changedAt: Double, start: Double?, duration: Double
    /// The transition this one interrupts: until this one starts it keeps running, and its value at this one's start frame is
    /// where this one begins (Chrome: the style change at that frame sees the running transition's current value).
    var prior: (from: [Double], to: [Double], start: Double?, duration: Double)? = nil
    private static func at(_ p: (from: [Double], to: [Double], start: Double?, duration: Double), _ now: Double) -> [Double] {
        guard let s = p.start else { return p.from }
        guard p.duration > 0 else { return p.to }
        let e = ease(min(1, max(0, (now - s) / p.duration))); return zip(p.from, p.to).map { $0 + ($1 - $0) * e }
    }
    mutating func value(_ now: Double) -> [Double] {
        if start == nil {
            if now > changedAt + 0.5 { start = now; if let p = prior { from = Self.at(p, now) }; prior = nil }
            else { return prior.map { Self.at($0, now) } ?? from }
        }
        guard let s = start, duration > 0 else { return to }
        let p = AWCTransferListTrack.ease(min(1, max(0, (now - s) / duration)))
        return zip(from, to).map { $0 + ($1 - $0) * p }
    }
    /// cubic-bezier(0.25, 0.1, 0.25, 1) (`ease`) at progress x.
    static func ease(_ x: Double) -> Double {
        if x <= 0 || x >= 1 { return x }
        func bx(_ t: Double) -> Double { 3 * (1 - t) * (1 - t) * t * 0.25 + 3 * (1 - t) * t * t * 0.25 + t * t * t }
        func by(_ t: Double) -> Double { 3 * (1 - t) * (1 - t) * t * 0.1 + 3 * (1 - t) * t * t + t * t * t }
        var lo = 0.0, hi = 1.0, t = x
        for _ in 0..<60 { t = (lo + hi) / 2; if bx(t) < x { lo = t } else { hi = t } }
        return by(t)
    }
    /// sRGB `#RRGGBB` at alpha → premultiplied Oklab (L, a, b) + alpha.
    static func oklab(_ hex: String, alpha: Double) -> [Double] {
        let h = hex.trimmingCharacters(in: CharacterSet(charactersIn: "#")), v = Int(h.prefix(6), radix: 16) ?? 0
        func lin(_ c: Double) -> Double { c <= 0.04045 ? c / 12.92 : pow((c + 0.055) / 1.055, 2.4) }
        let r = lin(Double((v >> 16) & 255) / 255), g = lin(Double((v >> 8) & 255) / 255), b = lin(Double(v & 255) / 255)
        let l = cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b), m = cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
        let s = cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
        let lab = [0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s, 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s]
        return lab.map { $0 * alpha } + [alpha]
    }
    /// Premultiplied Oklab + alpha → premultiplied sRGB + alpha (what the row paints).
    static func srgb(_ v: [Double]) -> [Double] {
        let a = v[3]; guard a > 0 else { return [0, 0, 0, 0] }
        let L = v[0] / a, A = v[1] / a, B = v[2] / a
        let l = pow(L + 0.3963377774 * A + 0.2158037573 * B, 3), m = pow(L - 0.1055613458 * A - 0.0638541728 * B, 3), s = pow(L - 0.0894841775 * A - 1.2914855480 * B, 3)
        func gam(_ x: Double) -> Double { let c = min(1, max(0, x)); return c <= 0.0031308 ? 12.92 * c : 1.055 * pow(c, 1 / 2.4) - 0.055 }
        let rgb = [gam(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s), gam(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s), gam(-0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s)]
        return rgb.map { $0 * a } + [a]
    }
}
private struct AWCTransferListInspectorKey: EnvironmentKey { static let defaultValue: ((AWCTransferListProbe) -> Void)? = nil }
public extension EnvironmentValues {
    var awcTransferListInspector: ((AWCTransferListProbe) -> Void)? { get { self[AWCTransferListInspectorKey.self] } set { self[AWCTransferListInspectorKey.self] = newValue } }
}

/// Native counterparts of md-transfer-list's methods (`moveSelectedRight`, `moveSelectedLeft`): the movers' moves with their
/// events; nothing when disabled or when no visible, enabled item is checked. A controller addresses one list (by node id).
public final class AWCTransferListController {
    var mover: ((Bool) -> Void)?
    public init() {}
    public var isConnected: Bool { mover != nil }
    public func moveSelectedRight() { mover?(true) }
    public func moveSelectedLeft() { mover?(false) }
}
private struct AWCTransferListControllersKey: EnvironmentKey { static let defaultValue: [String: AWCTransferListController] = [:] }
extension EnvironmentValues {
    var awcTransferListControllers: [String: AWCTransferListController] { get { self[AWCTransferListControllersKey.self] } set { self[AWCTransferListControllersKey.self] = newValue } }
}
private struct AWCTransferListControllerModifier: ViewModifier {
    let id: String
    let controller: AWCTransferListController
    @Environment(\.awcTransferListControllers) private var inherited
    func body(content: Content) -> some View { var c = inherited; c[id] = controller; return content.environment(\.awcTransferListControllers, c) }
}
public extension View {
    /// Attach a controller to the md-transfer-list with node id `id` rendered inside this view.
    func awcTransferListController(_ controller: AWCTransferListController, for id: String) -> some View { modifier(AWCTransferListControllerModifier(id: id, controller: controller)) }
}

/// Per-instance interaction state (checks per side in check order, queries, row hover/focus).
@MainActor @Observable final class AWCTransferListState {
    var sourceChecked: [String] = []
    var targetChecked: [String] = []
    var sourceQuery = ""
    var targetQuery = ""
    var hover: String? = nil
    var focused: String? = nil
    /// Rows under a held primary press (Chrome: pointerdown focuses the row, the click toggles it).
    @ObservationIgnored var pressing: Set<String> = []
    @ObservationIgnored var rowSizes: [String: CGSize] = [:]
    /// The source's Tab order: the source column, the movers, the target column (AWCUI's loop is row-major).
    @ObservationIgnored let tabGroup = AWCKeyViewGroup(regions: 3)
    /// A disabled list's scrollers are focus targets (Web: tabindex=0 for axe scrollable-region-focusable): source, target.
    @ObservationIgnored let listFocus = [AWCKeyViewRegionBox(), AWCKeyViewRegionBox()]
    #if canImport(AppKit)
    @ObservationIgnored var disabledMonitor: Any?
    #endif
    /// While disabled no gesture reaches the rows: a press inside a list focuses its scroller (the source's tabindex=0 list).
    func watchDisabledPresses(_ on: Bool) {
        #if canImport(AppKit)
        if let m = disabledMonitor { NSEvent.removeMonitor(m); disabledMonitor = nil }
        guard on else { return }
        disabledMonitor = NSEvent.addLocalMonitorForEvents(matching: .leftMouseDown) { [weak self] e in
            guard let self else { return e }
            for target in [false, true] {
                if let v = self.listFocus[target ? 1 : 0].view, v.window === e.window, v.convert(v.bounds, to: nil).contains(e.locationInWindow) {
                    DispatchQueue.main.async { self.focusList(target) }
                }
            }
            return e
        }
        #endif
    }
    #if canImport(UIKit)
    /// Pointer focus (no ring) on the nested control whose focus view carries `id` (the movers' md-icon-buttons).
    func focusControl(_ id: String) {
        guard let window = tabGroup.regions[1].view?.window else { return }
        func find(_ v: UIView) -> AWCNativeButtonFocusView? {
            if let b = v as? AWCNativeButtonFocusView, b.accessibilityIdentifier == id { return b }
            for c in v.subviews { if let f = find(c) { return f } }
            return nil
        }
        _ = find(window)?.requestNativeFocus(showIndicator: false)
    }
    #endif
    func focusList(_ target: Bool) {
        guard let v = listFocus[target ? 1 : 0].view else { return }
        #if canImport(AppKit)
        _ = v.window?.makeFirstResponder(v)
        #else
        _ = v.becomeFirstResponder()
        #endif
    }
    @ObservationIgnored var handles: [String: AWCButtonFocusHandle] = [:]
    func handle(_ id: String) -> AWCButtonFocusHandle { if let h = handles[id] { return h }; let h = AWCButtonFocusHandle(); handles[id] = h; return h }
    @ObservationIgnored var ripples: [String: AWCRippleController] = [:]
    @ObservationIgnored var tracks: [String: AWCTransferListTrack] = [:]
    /// Bumped (outside the render pass) when a track starts, so the timeline resumes.
    var kick = 0
    /// The display time (ms) until which the timeline runs: the end of the latest track started.
    @ObservationIgnored var runUntil = 0.0
    @ObservationIgnored var shown: [String: [Double]] = [:]
    func animating(_ now: Double) -> Bool { tracks.values.contains { t in t.start == nil || (t.start.map { now - $0 < t.duration } ?? false) } }
    func ripple(_ id: String) -> AWCRippleController { if let r = ripples[id] { return r }; let r = AWCRippleController(); ripples[id] = r; return r }
}

struct AWCNativeTransferList: View {
    let nodeID: String
    let properties: [String: AWCValue]
    let theme: AWCTheme
    let density: Double
    let renderChild: (AWCNode, ((AWCEvent) -> Void)?) -> AnyView
    let dispatch: (String, AWCValue) -> Void
    let setValue: ([String]) -> Void
    @Environment(\.awcTransferListAppearance) private var appearance
    /// `::part()` values (typed): they win over the hooks and every state rule.
    @Environment(\.awcTransferListPartAppearance) private var parts
    @Environment(\.layoutDirection) private var direction
    @Environment(\.accessibilityReduceMotion) private var systemReduceMotion
    @Environment(\.awcTransferListReducedMotion) private var reducedOverride
    @Environment(\.awcTransferListClock) private var clock
    private var reduceMotion: Bool { reducedOverride ?? systemReduceMotion }
    private func now() -> Double { clock?.now ?? CACurrentMediaTime() * 1000 }
    @Environment(\.awcTransferListViewport) private var viewport
    @Environment(\.awcThemeTokens) private var inheritedTokens
    @Environment(\.awcTransferListInspector) private var inspector
    @Environment(\.awcTransferListControllers) private var controllers
    @State private var state = AWCTransferListState()

    private func s(_ k: String, _ d: String) -> String { properties[k]?.string ?? d }
    private func b(_ k: String, _ d: Bool) -> Bool { properties[k]?.bool ?? d }
    private func cg(_ v: Double?) -> CGFloat? { v.map { CGFloat($0) } }
    private var tokens: [String: String] { theme.tokens.merging(inheritedTokens) { _, b in b } }
    private func token(_ name: String, _ fallback: String) -> String { tokens["--md-sys-color-" + name] ?? fallback }
    private func color(_ hook: String?, _ role: String, _ fallback: String) -> Color { Color(awcHex: hook ?? token(role, fallback)) }
    private var m: AWCTransferListMetrics { .init(density: density, appearance: appearance, fullHeight: b("fullHeight", false)) }
    private var disabled: Bool { b("disabled", false) }
    private var searchable: Bool { b("searchable", true) }
    private var rtl: Bool { direction == .rightToLeft }
    /// The source's `@media (max-width: 640px)` reads the viewport: the host's window, taken from this list's own window once it is attached (the first render
    /// runs before any window is visible and would read the 1200 fallback, flipping the layout, and losing the focused view, at the first re-render).
    private var stacked: Bool { (viewport ?? Self.width(of: state.tabGroup.regions[1].view?.window) ?? Self.windowWidth) <= 640 }
    private var logic: AWCTransferListLogic {
        var l = AWCTransferListLogic(items: AWCTransferItem.parse(properties["items"]), value: (properties["value"]?.array ?? []).map(\.string))
        l.sourceChecked = state.sourceChecked; l.targetChecked = state.targetChecked; l.sourceQuery = state.sourceQuery; l.targetQuery = state.targetQuery
        l.prune(); return l
    }
    /// Width of a host window's content (AppKit: the content view; UIKit: the window's bounds).
    #if canImport(AppKit)
    static func width(of window: NSWindow?) -> CGFloat? { window?.contentView?.bounds.width }
    #else
    static func width(of window: UIWindow?) -> CGFloat? { window?.bounds.width }
    #endif
    static var windowWidth: CGFloat {
        #if canImport(AppKit)
        return NSApplication.shared.windows.first(where: { $0.isVisible })?.contentView?.bounds.width ?? 1200
        #else
        return UIScreen.main.bounds.width
        #endif
    }
    private var probe: AWCTransferListProbe {
        .init(toggle: { t, v in var x = logic; x.toggle(t, v); commit(x) },
              search: { t, q in if t { state.targetQuery = q } else { state.sourceQuery = q } },
              hover: { t, v in state.hover = v.map { (t ? "t:" : "s:") + $0 } },
              focusRow: { t, v in _ = state.handle((t ? "t:" : "s:") + v).requestFocus?() },
              snapshot: { snapshot() })
    }
    /// The row's background at this render: its transition track toward the current state's colour.
    private func background(_ id: String, tint: String, layer: Double) -> [Double] {
        let t = now(), target = AWCTransferListTrack.oklab(tint, alpha: layer)
        var track = state.tracks[id] ?? AWCTransferListTrack(from: target, to: target, changedAt: t, start: t, duration: 0)
        if zip(track.to, target).contains(where: { abs($0 - $1) > 1e-9 }) {
            let current = track.value(t)
            track = .init(from: current, to: target, changedAt: t, start: nil, duration: reduceMotion ? 0 : 100, prior: (track.from, track.to, track.start, track.duration))
            state.runUntil = max(state.runUntil, t + track.duration + 100)
            if clock == nil { let st = state; DispatchQueue.main.async { st.kick &+= 1 } }
        }
        let v = track.value(t); state.tracks[id] = track
        let shown = AWCTransferListTrack.srgb(v); state.shown[id] = shown; return shown
    }
    private func snapshot() -> AWCTransferListSnapshot {
        let x = logic
        func side(_ target: Bool) -> AWCTransferListSideSnapshot {
            let visible = x.visible(target), checked = Set(x.checked(target)), st = x.selectAllState(target), t = target ? "t:" : "s:"
            return .init(rows: visible.map { .init(label: $0.label, checked: checked.contains($0.value), background: state.shown[t + $0.value] ?? [0, 0, 0, 0],
                                                   ring: state.focused == t + $0.value && state.handle(t + $0.value).isFocusVisible) },
                         count: s("countTemplate", "{checked}/{total} selected").replacingFirst("{checked}", String(st.checked)).replacingFirst("{total}", String(st.total)),
                         selectAll: b("showSelectAll", true) ? [st.all, st.some, disabled || st.total == 0] : nil,
                         query: searchable ? (target ? state.targetQuery : state.sourceQuery) : nil, empty: visible.isEmpty ? s("emptyText", "No items") : nil)
        }
        let sourceAvailable = x.sourceItems.contains { !$0.disabled }, targetAvailable = x.targetItems.contains { !$0.disabled }
        var movers = [(s("moveAllRightLabel", "Move all to target"), disabled || !sourceAvailable), (s("moveRightLabel", "Move selected to target"), disabled || x.eligibleChecked(false).isEmpty),
                      (s("moveLeftLabel", "Move selected to source"), disabled || x.eligibleChecked(true).isEmpty), (s("moveAllLeftLabel", "Move all to source"), disabled || !targetAvailable)]
        if b("singleStepOnly", false) { movers = [movers[1], movers[2]] }
        return .init(value: x.value, source: side(false), target: side(true), movers: movers.map(\.0), moversDisabled: movers.map(\.1), focusedRow: state.focused)
    }
    private func commit(_ l: AWCTransferListLogic) { state.sourceChecked = l.sourceChecked; state.targetChecked = l.targetChecked }

    var body: some View {
        let l = logic, m = self.m
        let _ = { controllers[nodeID]?.mover = { right in move(right: right, all: false) } }()
        // The inspector's probe reads this render's properties (value, items, disabled…): republished every render.
        let _ = inspector?(probe)
        let _ = state.kick
        // Row transitions run on explicit tracks: the display's frames while one runs (the parity tests' clock otherwise).
        TimelineView(.animation(minimumInterval: 1 / 120, paused: clock != nil || (now() > state.runUntil && !state.animating(now())))) { _ in Group {
            if stacked {
                let block: AWCTransferBlock = searchable && m.columnMaxBlock != nil ? .definite : .content
                VStack(spacing: m.gapLg) {
                    AWCTransferBlockLayout(cap: m.columnMaxBlock, mode: block) { column(false, l) }
                    controls(l, row: true)
                    AWCTransferBlockLayout(cap: m.columnMaxBlock, mode: block) { column(true, l) }
                }
                .frame(minWidth: cg(appearance.minWidth), idealWidth: cg(appearance.width), maxWidth: cg(appearance.width ?? appearance.maxWidth) ?? .infinity,
                       minHeight: cg(appearance.minHeight), maxHeight: cg(appearance.maxHeight), alignment: .topLeading)
            } else {
                // The grid (1fr auto 1fr, one minmax(0, 1fr) row) and the host's size hooks; placed in LTR and mirrored by hand.
                AWCTransferGridLayout(gap: m.gapLg, columnMinWidth: m.columnMinWidth, cap: m.columnMaxBlock, definite: searchable, rtl: rtl,
                                      width: appearance.width, minWidth: appearance.minWidth, maxWidth: appearance.maxWidth, height: appearance.height,
                                      minHeight: appearance.minHeight, maxHeight: appearance.maxHeight, fullWidth: b("fullWidth", false), fullHeight: b("fullHeight", false)) {
                    column(false, l).environment(\.layoutDirection, direction)
                    controls(l, row: false).environment(\.layoutDirection, direction)
                    column(true, l).environment(\.layoutDirection, direction)
                }
                .environment(\.layoutDirection, .leftToRight)
            }
        } }
        .font(AWCNativeFonts.label(size: 16, regular: true))
        .accessibilityElement(children: .contain)
        .onAppear { inspector?(probe); state.tabGroup.rtl = rtl; state.tabGroup.activate(); if viewport == nil { let st = state; DispatchQueue.main.async { st.kick &+= 1 } } }   // re-read the window width once attached
        .onDisappear { state.tabGroup.deactivate() }
        .onChange(of: rtl) { _, r in state.tabGroup.rtl = r }
        .onChange(of: disabled, initial: true) { _, d in state.watchDisabledPresses(d) }
        .onDisappear { state.watchDisabledPresses(false) }
        .onChange(of: properties["items"]) { _, _ in commit(logic) }
        .onChange(of: properties["value"]) { _, _ in commit(logic) }
        // The empty state is role="status" (a polite live region): announced when a side runs empty, not on the first render.
        .onChange(of: [l.visible(false).isEmpty, l.visible(true).isEmpty]) { old, new in
            guard zip(old, new).contains(where: { !$0 && $1 }) else { return }
            var text = AttributedString(s("emptyText", "No items")); text.accessibilitySpeechAnnouncementPriority = .low
            AccessibilityNotification.Announcement(text).post()
        }
    }

    // MARK: column
    @ViewBuilder private func column(_ target: Bool, _ l: AWCTransferListLogic) -> some View {
        let m = self.m, part = parts.column(target: target)
        let divider = color(part.borderColor ?? appearance.dividerColor, "outline-variant", "#CAC4D0"), shape = part.shape ?? m.shape
        VStack(spacing: 0) {
            header(target, l)
            if searchable { search(target) }
            list(target, l)
        }
        .padding(1)   // the 1px border is part of the column's box (box-sizing: border-box)
        .frame(minWidth: m.columnMinWidth, maxWidth: .infinity, maxHeight: .infinity, alignment: .top)   // the block size comes from the grid/block layout
        .background(color(part.backgroundColor ?? appearance.containerColor, "surface-container-low", "#F7F2FA"))
        .clipShape(RoundedRectangle(cornerRadius: shape))
        .overlay(RoundedRectangle(cornerRadius: shape).inset(by: 0.5).stroke(divider, lineWidth: 1))
        .awcInspect(nodeID: nodeID, part: "column-" + (target ? "target" : "source"), name: "column")
        .background { AWCKeyViewRegion(box: state.tabGroup.regions[target ? 2 : 0]) }
    }

    @ViewBuilder private func header(_ target: Bool, _ l: AWCTransferListLogic) -> some View {
        let m = self.m, st = l.selectAllState(target), title = target ? s("targetTitle", "Chosen") : s("sourceTitle", "Choices")
        let count = s("countTemplate", "{checked}/{total} selected").replacingFirst("{checked}", String(st.checked)).replacingFirst("{total}", String(st.total))
        let ink = color(appearance.headerTextColor, "on-surface", "#1C1B1F")
        HStack(alignment: .center, spacing: m.gapMd) {
            if b("showSelectAll", true) {
                renderChild(AWCNode(id: nodeID + "-all-" + (target ? "t" : "s"), tag: "md-checkbox", properties: [
                    "checked": .bool(st.all), "indeterminate": .bool(st.some), "disabled": .bool(disabled || st.total == 0), "density": .number(density),
                    "aria-label": .string(s("selectAllLabel", "Select all {title}").replacingOccurrences(of: "{title}", with: title))]), { event in
                    guard event.name == "mdChange" else { return }
                    var x = logic; x.toggleSelectAll(target); commit(x)
                })
            }
            VStack(alignment: .leading, spacing: 0) {
                Text(title).font(AWCNativeFonts.label(size: m.titleSize, weight: 500)).foregroundStyle(color(nil, "on-surface", "#1C1B1F"))
                    .lineLimit(1).truncationMode(.tail).frame(height: m.titleLine).frame(maxWidth: .infinity, alignment: .leading)
                Text(rtl ? "\u{200F}" + count : count).font(AWCNativeFonts.label(size: m.countSize, weight: 500)).tracking(0.4).lineLimit(1).fixedSize()
                    .foregroundStyle(color(parts.count.color, "on-secondary-container", "#1D192B")).frame(height: m.countLine)
                    .padding(.vertical, 1).padding(.horizontal, 8)
                    .background(RoundedRectangle(cornerRadius: parts.count.shape ?? 999).fill(color(parts.count.backgroundColor, "secondary-container", "#E8DEF8")))
                    .awcInspect(nodeID: nodeID, part: "count-" + (target ? "target" : "source"), name: "count")
                    .padding(.top, 2)
            }.frame(minWidth: 0, maxWidth: .infinity, alignment: .leading)
            .background(parts.headerTitle.backgroundColor.map { Color(awcHex: $0) } ?? .clear)
            .awcInspect(nodeID: nodeID, part: "header-title-" + (target ? "target" : "source"), name: "header-title")
        }
        .foregroundStyle(ink)
        .padding(.vertical, m.insetMd).padding(.horizontal, m.insetLg)
        .padding(.bottom, 1)   // border-block-end
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(color(parts.header.backgroundColor ?? appearance.headerColor, "surface-container", "#F3EDF7"))
        .overlay(alignment: .bottom) { Rectangle().fill(color(parts.header.borderColor ?? appearance.dividerColor, "outline-variant", "#CAC4D0")).frame(height: 1) }
        .awcInspect(nodeID: nodeID, part: "header-" + (target ? "target" : "source"), name: "header")
    }

    @ViewBuilder private func search(_ target: Bool) -> some View {
        let m = self.m, query = target ? state.targetQuery : state.sourceQuery, icon = s("searchIcon", "search")
        let children: [AWCNode] = icon.isEmpty ? [] : [AWCNode.symbol(icon, slot: "leading-icon")]
        renderChild(AWCNode(id: nodeID + "-search-" + (target ? "t" : "s"), tag: "md-text-field", properties: [
            "variant": "outlined", "density": .number(density), "label": .string(target ? s("targetSearchPlaceholder", "Search chosen") : s("sourceSearchPlaceholder", "Search choices")),
            "value": .string(query), "clearable": "internal", "disabled": .bool(disabled)], children: children), { event in
            guard event.name == "mdInput" else { return }
            if target { state.targetQuery = event.detail.string } else { state.sourceQuery = event.detail.string }
        })
        .padding(.top, m.searchTop).padding(.horizontal, m.insetMd).padding(.bottom, m.insetSm)
        .background(parts.search.backgroundColor.map { Color(awcHex: $0) } ?? .clear)
        .awcInspect(nodeID: nodeID, part: "search-" + (target ? "target" : "source"), name: "search")
    }

    @ViewBuilder private func list(_ target: Bool, _ l: AWCTransferListLogic) -> some View {
        let m = self.m, visible = l.visible(target), checked = Set(l.checked(target))
        if visible.isEmpty {
            VStack(spacing: m.gapSm) {
                if let icon = properties["emptyIcon"]?.string, !icon.isEmpty {
                    let size = CGFloat(parts.emptyIcon.size ?? m.emptyIcon)
                    Text(icon).font(AWCNativeFonts.symbol(size: size)).frame(width: size, height: size)
                        .foregroundStyle(parts.emptyIcon.color.map { AnyShapeStyle(Color(awcHex: $0)) } ?? AnyShapeStyle(HierarchicalShapeStyle.primary))
                        .opacity(parts.emptyIcon.opacity ?? 0.9).accessibilityHidden(true)
                }
                Text(s("emptyText", "No items")).font(AWCNativeFonts.label(size: m.emptySize, regular: true)).multilineTextAlignment(.center)
            }
            .foregroundStyle(color(parts.empty.color, "on-surface-variant", "#49454F"))
            .padding(.vertical, m.emptyPad).padding(.horizontal, m.insetLg).frame(maxWidth: .infinity)
            .background(parts.empty.backgroundColor.map { Color(awcHex: $0) } ?? .clear)
            .accessibilityElement(children: .combine)   // role="status": its text; announced when a side runs empty (body)
            .awcInspect(nodeID: nodeID, part: "empty-" + (target ? "target" : "source"), name: "empty")
        } else {
            ScrollView(.vertical) {
                VStack(spacing: 2) { ForEach(visible, id: \.value) { item in row(target, item, checked.contains(item.value)) } }
                    .padding(.vertical, m.insetXs)
                    .awcInspect(nodeID: nodeID, part: "list-content-" + (target ? "target" : "source"), name: "list-content")
                    #if canImport(AppKit)
                    .background { AWCTransferListScrollBarAX() }
                    #endif
            }
            .background(parts.list.backgroundColor.map { Color(awcHex: $0) } ?? .clear)
            .awcInspect(nodeID: nodeID, part: "list-" + (target ? "target" : "source"), name: "list")
            .background { if disabled { AWCTransferListFocusTarget(id: nodeID + "-list-" + (target ? "target" : "source"), title: target ? s("targetTitle", "Chosen") : s("sourceTitle", "Choices"), box: state.listFocus[target ? 1 : 0]) } }
            #if canImport(UIKit)
            // A press anywhere in a disabled list focuses its scroller (Chrome focuses the tabindex=0 list on mousedown; iPadOS
            // pointer and touch). AppKit takes the press in its mouse-down monitor.
            .simultaneousGesture(DragGesture(minimumDistance: 0).onChanged { _ in
                guard !state.pressing.contains("list") else { return }
                state.pressing.insert("list"); state.focusList(target)
            }.onEnded { _ in state.pressing.remove("list") }, including: disabled ? .all : .subviews)
            #endif
            .scrollIndicators(.automatic)
            .accessibilityLabel(target ? s("targetTitle", "Chosen") : s("sourceTitle", "Choices"))
        }
    }

    @ViewBuilder private func row(_ target: Bool, _ item: AWCTransferItem, _ isChecked: Bool) -> some View {
        let m = self.m, id = (target ? "t:" : "s:") + item.value, off = item.disabled || disabled
        let handle = state.handle(id), focusRing = state.focused == id && handle.isFocusVisible, ripple = state.ripple(id)
        let tint = isChecked ? token("primary", "#6750A4") : token("on-surface", "#1C1B1F")
        let layer = off ? 0 : isChecked ? (state.hover == id || focusRing ? 0.12 : 0.08) : (focusRing ? 0.12 : state.hover == id ? 0.08 : 0)
        // `::part(item) { background-color }` replaces the state layers (the outer tree's declaration wins over the hover / checked / focus rules).
        let bg = parts.item.backgroundColor.map(AWCTransferListPartStyle.premultiplied) ?? background(id, tint: tint, layer: layer), corner = parts.item.shape ?? 8
        HStack(spacing: m.itemGap) {
            renderChild(AWCNode(id: nodeID + "-check-" + id, tag: "md-checkbox", properties: ["checked": .bool(isChecked), "disabled": .bool(off), "density": .number(density), "inert": true, "aria-hidden": "true"]), nil)
                .allowsHitTesting(false).accessibilityHidden(true).awcNativeInert(true)   // `inert`: no focus, presses go to the row
            VStack(alignment: .leading, spacing: 0) {
                Text(item.label).font(AWCNativeFonts.label(size: m.labelSize, regular: true)).foregroundStyle(color(nil, "on-surface", "#1C1B1F"))
                    .lineLimit(1).truncationMode(.tail).frame(height: (m.labelSize * 1.4).rounded(.toNearestOrEven))
                if !item.description.isEmpty {
                    Text(item.description).font(AWCNativeFonts.label(size: m.descSize, regular: true)).foregroundStyle(color(nil, "on-surface-variant", "#49454F"))
                        .lineLimit(1).truncationMode(.tail).frame(height: m.descSize * 1.35)
                }
            }.frame(minWidth: 0, maxWidth: .infinity, alignment: .leading)
        }
        .padding(.top, m.itemPad.top).padding(.bottom, m.itemPad.bottom).padding(.leading, rtl ? m.itemPad.right : m.itemPad.left).padding(.trailing, rtl ? m.itemPad.left : m.itemPad.right)
        .awcInspect(nodeID: nodeID, part: "item-" + id, name: "item") { _ in ["checked": .bool(isChecked), "layer": .number(layer)] }
        // The row's state layer, then its md-ripple wave, both under the (positioned) md-checkbox and the labels, as in the source.
        .background {
            ZStack {
                RoundedRectangle(cornerRadius: corner).fill(Color(.sRGB, red: bg[0] / max(bg[3], 1e-9), green: bg[1] / max(bg[3], 1e-9), blue: bg[2] / max(bg[3], 1e-9), opacity: bg[3]))
                if let engine = ripple.engine { AWCRippleWaveLayer(engine: engine, color: color(nil, "on-surface", "#1C1B1F"), cornerRadius: corner, enabled: true, hidden: false, testTime: nil, inspectNodeID: nil) }
            }
        }
        .overlay { if focusRing { RoundedRectangle(cornerRadius: corner).inset(by: 1.5).stroke(color(nil, "secondary", "#625B71"), lineWidth: 3) } }
        .modifier(AWCRippleSurface(disabled: off, hidden: true, cornerRadius: corner, contentColor: nil, controller: ripple, local: nil))
        .opacity(item.disabled ? 0.38 : 1)
        .contentShape(Rectangle())
        .onHover { h in if !off { if h { state.hover = id } else if state.hover == id { state.hover = nil } } }
        .onGeometryChange(for: CGSize.self, of: { $0.size }) { state.rowSizes[id] = $0 }
        // The source keys rows by value: a row that leaves (moved, filtered) comes back as a new element, without a transition
        // from its old state and without its hover.
        .onDisappear { state.tracks[id] = nil; state.shown[id] = nil; if state.hover == id { state.hover = nil } }
        // pointerdown focuses the row (no ring: Chrome's :focus-visible after a mouse focus); the click (release inside) toggles it.
        .simultaneousGesture(DragGesture(minimumDistance: 0, coordinateSpace: .local)
            .onChanged { _ in
                guard !state.pressing.contains(id) else { return }
                state.pressing.insert(id)
                // A press on a row of a disabled list focuses the list (its nearest focusable ancestor in the source).
                if !off { _ = handle.requestPointerFocus?() } else if disabled { state.focusList(target) } }
            .onEnded { v in
                guard state.pressing.remove(id) != nil, !off else { return }
                let size = state.rowSizes[id] ?? .zero
                if CGRect(origin: .zero, size: size).contains(v.location) { var x = logic; x.toggle(target, item.value); commit(x) }
            })
        .background {
            AWCNativeButtonFocusBridge(configuration: .init(id: nodeID + "/" + id, label: item.description.isEmpty ? item.label : item.label + " " + item.description,
                policy: AWCButtonAccessibilityPolicy(properties: ["roleOverride": "option", "selected": .bool(isChecked), "disabled": .bool(off), "groupTabindex": .number(off ? -1 : 0)]),
                group: nil, cell: nil, handle: handle,
                focusChanged: { f in if f { state.focused = id } else if state.focused == id { state.focused = nil } },
                activate: { if !off { var x = logic; x.toggle(target, item.value); commit(x) } }))
        }
        .padding(.horizontal, m.itemInset)
    }

    // MARK: movers
    @ViewBuilder private func controls(_ l: AWCTransferListLogic, row: Bool) -> some View {
        let m = self.m, sourceAvailable = l.sourceItems.contains { !$0.disabled }, targetAvailable = l.targetItems.contains { !$0.disabled }
        let movers: [(String, String, String, String, Bool, Bool, Bool)] = [
            ("all-right", s("moveAllRightIcon", "keyboard_double_arrow_right"), s("moveAllRightLabel", "Move all to target"), "tonal", disabled || !sourceAvailable, true, true),
            ("right", s("moveRightIcon", "chevron_right"), s("moveRightLabel", "Move selected to target"), "filled", disabled || l.eligibleChecked(false).isEmpty, true, false),
            ("left", s("moveLeftIcon", "chevron_left"), s("moveLeftLabel", "Move selected to source"), "filled", disabled || l.eligibleChecked(true).isEmpty, false, false),
            ("all-left", s("moveAllLeftIcon", "keyboard_double_arrow_left"), s("moveAllLeftLabel", "Move all to source"), "tonal", disabled || !targetAvailable, false, true)]
        let shown = movers.filter { !(b("singleStepOnly", false) && $0.6) }
        let layout = row ? AnyLayout(HStackLayout(spacing: m.controlsGap)) : AnyLayout(VStackLayout(spacing: m.controlsGap))
        layout {
            // Keyed by slot, as the source's unkeyed buttons re-render in place (focus stays on the slot when the set changes).
            ForEach(Array(shown.enumerated()), id: \.offset) { _, mover in
                renderChild(AWCNode(id: nodeID + "-move-" + mover.0, tag: "md-icon-button", properties: [
                    "variant": .string(mover.3), "icon": .string(mover.1), "disabled": .bool(mover.4), "aria-label": .string(mover.2), "density": .number(density),
                    "_retainFocus": true]), { event in
                    guard event.name == "mdClick" else { return }
                    #if canImport(UIKit)
                    state.focusControl(nodeID + "-move-" + mover.0)
                    #endif
                    move(right: mover.5, all: mover.6)
                })
                .awcInspect(nodeID: nodeID, part: "mover-" + mover.0, name: "mover") { _ in ["disabled": .bool(mover.4)] }
                #if canImport(UIKit)
                // A press focuses an enabled mover (Chrome focuses a button on mousedown; iPadOS pointer / keyboard focus). AppKit's
                // button bridge already takes pointer focus.
                .simultaneousGesture(DragGesture(minimumDistance: 0).onChanged { _ in
                    guard !mover.4, !state.pressing.contains("mover") else { return }
                    state.pressing.insert("mover"); state.focusControl(nodeID + "-move-" + mover.0)
                }.onEnded { _ in state.pressing.remove("mover") })
                #endif
                .awcIconButtonAppearance(AWCIconButtonAppearance(iconSize: m.controlIconSize, width: m.controlSize, height: m.controlSize))
                .rotationEffect(.degrees(row ? 90 : 0))
                .scaleEffect(x: !row && rtl ? -1 : 1, y: 1)
            }
        }
        .padding(.horizontal, row ? 0 : m.insetXs).padding(.vertical, row ? m.insetMd : 0)
        .frame(maxWidth: row ? .infinity : nil, maxHeight: row ? nil : .infinity)
        .background(parts.controls.backgroundColor.map { Color(awcHex: $0) } ?? .clear)
        .awcInspect(nodeID: nodeID, part: "controls", name: "controls")
        .background { AWCKeyViewRegion(box: state.tabGroup.regions[1]) }
    }

    private func move(right: Bool, all: Bool) {
        guard !disabled else { return }
        var x = logic
        guard let (direction, moved, value) = x.move(right: right, all: all) else { return }
        commit(x); setValue(value)
        dispatch("mdChange", .array(value.map(AWCValue.string)))
        dispatch("mdMove", .object(["direction": .string(direction), "moved": .array(moved.map(AWCValue.string)), "target": .array(value.map(AWCValue.string))]))
    }
}

enum AWCTransferBlock { case definite, stretch, content }

/// A column's block size: the definite cap (searchable: `block-size`), stretched to the row up to the cap (`align-items: stretch`
/// under `max-block-size`), or its content up to the cap (stacked auto rows). A null cap is `100%` (full-height): the row.
struct AWCTransferBlockLayout: Layout {
    var cap: Double?
    var mode: AWCTransferBlock
    func height(_ v: LayoutSubview, width: CGFloat?, row: CGFloat?) -> CGFloat {
        let row = row.flatMap { $0.isFinite ? $0 : nil }, c = cap.map { CGFloat($0) }
        switch mode {
        case .definite: if let c { return c }; if let row { return row }
        case .stretch: if let row { return c.map { min(row, $0) } ?? row }
        case .content: break
        }
        let natural = v.sizeThatFits(.init(width: width, height: nil)).height
        return c.map { min(natural, $0) } ?? natural
    }
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        guard let v = subviews.first else { return .zero }
        let h = height(v, width: proposal.width, row: proposal.height)
        return CGSize(width: proposal.width ?? v.sizeThatFits(.init(width: nil, height: h)).width, height: h)
    }
    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        guard let v = subviews.first else { return }
        v.place(at: bounds.origin, anchor: .topLeading, proposal: .init(width: bounds.width, height: height(v, width: bounds.width, row: bounds.height)))
    }
}

/// The host grid: `1fr auto 1fr` with the gap, columns at least their min width, one `minmax(0, 1fr)` row that is the host's
/// block size (content, the height hook or full-height; min/max win), searchable columns at the definite cap (overflowing a
/// shorter row), the others stretched up to the cap, the movers stretched to the row. Inline size: auto/full-width fill, the
/// width hook; min/max win. Places in LTR coordinates and mirrors for RTL.
struct AWCTransferGridLayout: Layout {
    var gap: Double
    var columnMinWidth: Double
    var cap: Double?
    var definite: Bool
    var rtl: Bool
    var width: Double?
    var minWidth: Double?
    var maxWidth: Double?
    var height: Double?
    var minHeight: Double?
    var maxHeight: Double?
    var fullWidth: Bool
    var fullHeight: Bool
    private func clamp(_ v: CGFloat, _ lo: Double?, _ hi: Double?) -> CGFloat { max(CGFloat(lo ?? 0), min(hi.map { CGFloat($0) } ?? .infinity, v)) }
    private func finite(_ v: CGFloat?) -> CGFloat? { v.flatMap { $0.isFinite ? $0 : nil } }
    private func columnWidth(_ w: CGFloat, _ ctrl: CGFloat) -> CGFloat { max(CGFloat(columnMinWidth), (w - ctrl - 2 * CGFloat(gap)) / 2) }
    func sizeThatFits(proposal: ProposedViewSize, subviews s: Subviews, cache: inout ()) -> CGSize {
        guard s.count == 3 else { return .zero }
        let ctrl = s[1].sizeThatFits(.unspecified).width, c = cap.map { CGFloat($0) }
        let natural = 2 * CGFloat(columnMinWidth) + ctrl + 2 * CGFloat(gap)
        let w = clamp(fullWidth ? finite(proposal.width) ?? natural : width.map { CGFloat($0) } ?? finite(proposal.width) ?? natural, minWidth, maxWidth)
        let column = columnWidth(w, ctrl)
        func content(_ v: LayoutSubview) -> CGFloat {
            if definite, let c { return c }
            let n = v.sizeThatFits(.init(width: column, height: nil)).height
            return c.map { min(n, $0) } ?? n
        }
        let contentHeight = max(content(s[0]), content(s[2]), s[1].sizeThatFits(.init(width: ctrl, height: nil)).height)
        let h = clamp(fullHeight ? finite(proposal.height) ?? contentHeight : height.map { CGFloat($0) } ?? contentHeight, minHeight, maxHeight)
        return CGSize(width: w, height: h)
    }
    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews s: Subviews, cache: inout ()) {
        guard s.count == 3 else { return }
        let ctrl = s[1].sizeThatFits(.unspecified).width, row = bounds.height, c = cap.map { CGFloat($0) }, g = CGFloat(gap)
        let column = columnWidth(bounds.width, ctrl)
        let xs: [CGFloat] = [0, column + g, column + g + ctrl + g], widths: [CGFloat] = [column, ctrl, column]
        for i in 0..<3 {
            let h: CGFloat = i == 1 ? row : definite ? (c ?? row) : (c.map { min(row, $0) } ?? row)
            let x = rtl ? bounds.width - xs[i] - widths[i] : xs[i]
            s[i].place(at: CGPoint(x: bounds.minX + x, y: bounds.minY), anchor: .topLeading, proposal: .init(width: widths[i], height: h))
        }
    }
}

private extension String {
    func replacingFirst(_ token: String, _ with: String) -> String { guard let r = range(of: token) else { return self }; return replacingCharacters(in: r, with: with) }
}

extension AWCNativeView {
    /// Production dispatch of md-transfer-list (AWCNativeView): the dedicated renderer above.
    @ViewBuilder var nativeTransferList: some View {
        AWCNativeTransferList(nodeID: node.id, properties: local, theme: theme,
                              density: AWCNativeDensity.resolve(local["density"]?.number, inherited: inheritedDensity),
                              renderChild: { n, handler in child(n, handler: handler) },
                              dispatch: { name, detail in emit(name, detail) },
                              setValue: { v in set("value", .array(v.map(AWCValue.string))) })
    }
}

/// The focus target of a disabled list's scroller (Web: `tabindex=0` on the list while disabled): takes focus on a press in the
/// list; not an accessibility element of its own (the list is) and not a hit-test target.
#if canImport(AppKit)
final class AWCTransferListFocusView: NSView {
    var identifier_ = ""
    override var acceptsFirstResponder: Bool { true }
    override func hitTest(_ point: NSPoint) -> NSView? { nil }
    override func accessibilityIdentifier() -> String { identifier_ }
    // The keyboard stop is the list itself (Web: the listbox); assistive technologies get the list from the scroll area.
    override func accessibilityRole() -> NSAccessibility.Role? { .list }
}
struct AWCTransferListFocusTarget: NSViewRepresentable {
    let id: String
    let title: String
    let box: AWCKeyViewRegionBox
    func makeNSView(context: Context) -> AWCTransferListFocusView { let v = AWCTransferListFocusView(); v.setAccessibilityElement(false); box.view = v; return v }
    func updateNSView(_ view: AWCTransferListFocusView, context: Context) { view.identifier_ = id; view.setAccessibilityLabel(title); box.view = view }
}
/// Chrome's accessibility tree has no scroll bars: the list's AppKit scrollers (AXScrollBar with its value indicator and page /
/// arrow buttons) stay out of the accessibility tree; the scroll area keeps its scroll actions.
final class AWCTransferListScrollBarAXView: NSView {
    override func hitTest(_ point: NSPoint) -> NSView? { nil }
    override func viewDidMoveToWindow() { super.viewDidMoveToWindow(); apply() }
    override func layout() { super.layout(); apply() }
    func apply() {
        guard let scroll = enclosingScrollView else { return }
        for scroller in [scroll.verticalScroller, scroll.horizontalScroller] { scroller?.setAccessibilityElement(false); scroller?.setAccessibilityChildren([]) }
    }
}
struct AWCTransferListScrollBarAX: NSViewRepresentable {
    func makeNSView(context: Context) -> AWCTransferListScrollBarAXView { let v = AWCTransferListScrollBarAXView(); v.setAccessibilityElement(false); return v }
    func updateNSView(_ view: AWCTransferListScrollBarAXView, context: Context) { view.apply() }
}
#else
final class AWCTransferListFocusView: UIView, AWCKeyView {
    override var canBecomeFirstResponder: Bool { true }
    override func point(inside point: CGPoint, with event: UIEvent?) -> Bool { false }
    // A Tab stop of AWCUI's key-view loop, as the Web list is while disabled (tabindex=0).
    var awcAcceptsFirstResponder: Bool { true }
    var awcCanBecomeKeyView: Bool { window != nil && !isHidden }
    func awcBecomeKeyView() -> Bool { becomeFirstResponder() }
    override var keyCommands: [UIKeyCommand]? { AWCKeyViewLoop.tabCommands(#selector(tabKey(_:))) }
    @objc private func tabKey(_ command: UIKeyCommand) { if let window { AWCKeyViewLoop.select(from: self, in: window, backward: command.modifierFlags.contains(.shift)) } }
}
struct AWCTransferListFocusTarget: UIViewRepresentable {
    let id: String
    let title: String
    let box: AWCKeyViewRegionBox
    func makeUIView(context: Context) -> AWCTransferListFocusView {
        let v = AWCTransferListFocusView(); v.isAccessibilityElement = false; v.accessibilityContainerType = .semanticGroup; v.backgroundColor = .clear; box.view = v; return v
    }
    func updateUIView(_ view: AWCTransferListFocusView, context: Context) { view.accessibilityIdentifier = id; view.accessibilityLabel = title; box.view = view }
}
#endif
