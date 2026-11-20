import SwiftUI
import Observation
import QuartzCore
#if canImport(AppKit)
import AppKit
#else
import UIKit
#endif

// md-date-picker (packages/core/src/components/md-date-picker): the three Web variants with the Web anatomy (decision 1).
// modal-input: an md-text-field trigger (typed entry, clear and calendar buttons) and a modal dialog; modal: the dialog
// alone (`open` / show()); docked: the trigger and a panel anchored under it with month / year menus. The dialog is
// presented by the nearest AWCModalScope (viewport, scrim, Escape / Tab routing), as md-dialog is; the panel's parts are
// md-button / md-icon-button / md-text-field children, as on the Web.

enum AWCDatePickerViewMode { case calendar, year }

@Observable final class AWCDatePickerRuntime {
    var isOpen = false
    var closing = false
    var inputMode = false
    var viewMode = AWCDatePickerViewMode.calendar
    var viewYear = 2025
    var viewMonth = 6
    /// The staged day (`pendingDate`), committed by OK / Enter.
    var pending: AWCDay? = nil
    /// The roving day-grid focus target.
    var focused = AWCDay(year: 2025, month: 6, day: 1)
    var draft = ""
    var entryDraft = ""
    var fieldFocused = false
    var monthMenuOpen = false
    var yearMenuOpen = false
    /// The modal year grid's roving year (`yearFocus`) and its scroll offset (centred when the view opens, then moved only as
    /// far as a key move needs, as focusYearCell does).
    var yearFocus: Int? = nil
    var yearScroll: Double? = nil
    /// captureYearListRange: the year list's bounds while the year view / menu shows (a pick does not shift the list).
    var yearRange: ClosedRange<Int>? = nil
    /// The picker control holding native focus: Escape and the calendar keys act only while focus is inside the picker (the
    /// source ignores keys whose target left it, e.g. after a press on a non-dismissing scrim or outside the docked panel).
    var focusedControl: String? = nil
    /// Native focus requests of the day cells, the year cells, the docked menu entries and the other panel controls.
    @ObservationIgnored var dayFocus = AWCButtonFocusGroup()
    @ObservationIgnored var yearFocusGroup = AWCButtonFocusGroup()
    @ObservationIgnored var menuFocusGroup = AWCButtonFocusGroup()
    @ObservationIgnored var panelFocus = AWCButtonFocusGroup()
    @ObservationIgnored var fieldTarget: AWCFieldFocusTarget? = nil
    @ObservationIgnored var entryTarget: AWCFieldFocusTarget? = nil
    /// The last activation was a pointer press: a programmatic focus move then shows no ring (Chrome :focus-visible).
    @ObservationIgnored var pointerInput = false
    /// The latest focus request (an older pending one gives up).
    @ObservationIgnored var focusGeneration = 0
    @ObservationIgnored var pickPending = false
    /// A touch drag is scrolling the year grid (its release is not a pick).
    @ObservationIgnored var yearWheel: (Double) -> Void = { _ in }
    @ObservationIgnored var yearDragStart: Double? = nil
    @ObservationIgnored var yearDragging = false
    /// A docked list is blooming out: the day grid mounts under it, hidden, after the list's first exit frame.
    var preloadCalendar = false
    @ObservationIgnored let cells = AWCDatePickerCellActions()
    /// Scrolls the open docked list to an entry (the list scrolls inside the panel, decision 3).
    @ObservationIgnored var revealMenuEntry: (Int) -> Void = { _ in }
    /// Motion: keyframe runs by key (the token of the run in force and the time of its first rendered frame, ms), the
    /// presented values per frame ([opacity, scale, translateY, translateX]) for the interaction suites, and the tokens of
    /// the runs (open / close of the panel, the menus, the year view; the calendar bloom; the grid slide).
    @ObservationIgnored var animations: [String: (token: Int, start: Double, length: Double)] = [:]
    @ObservationIgnored var motion: [String: [(t: Double, v: [Double])]] = [:]
    /// Every run's start by key (ms).
    @ObservationIgnored var runStarts: [String: [Double]] = [:]
    var motionTick = 0
    var lingerEntry = false
    var closeSerial = 0
    var openToken = 0
    var panelClosing = false
    var menuToken = 0
    var menuClosing = false
    var yearToken = 0
    var yearClosing = false
    var calendarToken: Int? = nil
    var slideToken: Int? = nil
    /// Run tokens are never reused: a run keyed by a token seen before would resume that run's start (no new keyframes).
    @ObservationIgnored var runSerial = 0
    func nextRun() -> Int { runSerial &+= 1; return runSerial }
    var slideDirection = 1
    func animationStart(_ key: String, _ token: Int, _ now: Double, _ duration: Double) -> Double {
        if let a = animations[key], a.token == token { return a.start }
        animations[key] = (token, now, duration); runStarts[key, default: []].append(now)
        Task { @MainActor [weak self] in try? await Task.sleep(nanoseconds: UInt64(duration + 34) * 1_000_000); self?.motionTick &+= 1 }
        return now
    }
    /// Suspends until the run `token` of `key` has rendered its last frame (the state change that removes the element waits
    /// for its exit keyframes, as the source's `await delay(…)` after setting the closing class); at most `limit` ms.
    @MainActor func finishRun(_ key: String, _ token: Int, _ duration: Double, limit: Double = 700) async {
        let begin = CACurrentMediaTime() * 1000
        while CACurrentMediaTime() * 1000 - begin < limit {
            if let a = animations[key], a.token == token {
                // `duration` (the source's fixed delay) has passed and the frame of that moment — the run's last keyframe when
                // the run is shorter — has been presented (or a frame is 50 ms overdue: the view is not being drawn).
                let end = a.start + duration, now = CACurrentMediaTime() * 1000
                if now >= end && ((lastFrame[key] ?? 0) >= Swift.min(end, a.start + a.length) || now >= end + 50) { break }
            }
            try? await Task.sleep(nanoseconds: 4_000_000)
        }
        // The run's frame timeline pauses now, a frame before the element leaves (a view removed with a running TimelineView
        // kept its inspection preferences).
        motionTick &+= 1
        try? await Task.sleep(nanoseconds: 16_000_000)
    }
    /// The time of the last presented frame of each run key (also when its value repeats).
    @ObservationIgnored var lastFrame: [String: Double] = [:]
    func record(_ key: String, _ v: [Double]) {
        let t = CACurrentMediaTime() * 1000
        lastFrame[key] = t
        var list = motion[key] ?? []
        if let last = list.last, last.v == v { return }
        list.append((t, v)); if list.count > 600 { list.removeFirst(list.count - 600) }
        motion[key] = list
    }
    /// The last published validity (`valid|message`); nil until the first evaluation primes it.
    @ObservationIgnored var validityKey: String? = nil
    var validationMessage = ""
    var committedValue = ""
    var anchorHeight = 0.0
    /// The calendar's visible height (it scrolls the focused day into view).
    var calendarVisible = 0.0
    /// Docked placement (positionDockedPanel): inline start / end, below / above, a max block size when neither fits.
    var dockedEnd = false
    var dockedAbove = false
    var dockedMaxBlock: Double? = nil
    var anchorFrame = CGRect.zero
    var dockedPanelHeight = 0.0
    /// Bumped after the dialog's first render so the modal overlay republishes (its inspection nodes reach the scope).
    var settle = 0
    @ObservationIgnored var openedAt: CFTimeInterval = 0
    @ObservationIgnored var show: () -> Void = {}
    @ObservationIgnored var hide: () -> Void = {}
    @ObservationIgnored var clear: () -> Void = {}
    @ObservationIgnored var focusInput: () -> Void = {}
    /// Constraint validation (syncFormValue): the current message and failing flag; `setCustomValidity`'s message; whether a
    /// report revealed the message (InlineValidationPresenter: shown as the trigger's error text until valid or reset).
    var validity: (message: String, flag: String?) = ("", nil)
    var customValidity = ""
    var revealed = false
    @ObservationIgnored var isDisabled: () -> Bool = { false }
    @ObservationIgnored var revalidate: () -> Void = {}
    nonisolated(unsafe) static var mounted: [String: AWCDatePickerRuntime] = [:]
}

/// Native counterpart of md-date-picker's methods.
public final class AWCDatePickerController {
    weak var runtime: AWCDatePickerRuntime?
    /// `isDateDisabled`: days it returns true for are disabled (not just greyed), as the source's per-cell predicate.
    public var isDateDisabled: ((AWCDay) -> Bool)?
    public init() {}
    public var isConnected: Bool { runtime != nil }
    @MainActor public func show() { runtime?.show() }
    @MainActor public func close() { runtime?.hide() }
    @MainActor public func clear() { runtime?.clear() }
    @MainActor public func focusInput() { runtime?.focusInput() }
    /// The committed value's validity (`required`, a custom message): `{ valid, validationMessage, flags }` with the failing flag.
    @MainActor public func getValidity() -> AWCDatePickerValidity {
        guard let r = runtime else { return .validState }
        return .init(valid: r.validity.message.isEmpty, validationMessage: r.validity.message, valueMissing: r.validity.flag == "valueMissing", customError: r.validity.flag == "customError")
    }
    /// Validity without presenting it; a disabled picker is barred from validation and reports true.
    @MainActor public func checkValidity() -> Bool { guard let r = runtime else { return true }; return r.isDisabled() || r.validity.message.isEmpty }
    /// Like `checkValidity()`, but an invalid picker shows its message as the field's error text and focuses the field
    /// (the source's inline validation presenter).
    @MainActor @discardableResult public func reportValidity() -> Bool {
        guard let r = runtime, !r.isDisabled(), !r.validity.message.isEmpty else { return true }
        r.revealed = true
        DispatchQueue.main.async { [weak r] in r?.focusInput() }
        return false
    }
    /// A non-empty message makes the picker invalid (`customError`) until it is cleared with "".
    @MainActor public func setCustomValidity(_ message: String) { runtime?.customValidity = message; runtime?.revalidate() }
}
/// md-date-picker's constraint validity, as the source's `getValidity()` record.
public struct AWCDatePickerValidity: Equatable, Sendable {
    public let valid: Bool, validationMessage: String, valueMissing: Bool, customError: Bool
    public static let validState = AWCDatePickerValidity(valid: true, validationMessage: "", valueMissing: false, customError: false)
    /// `{ valid, validationMessage, flags }`; `flags` holds the failing reasons only (as getValidityOf).
    public var value: AWCValue {
        var flags: [String: AWCValue] = [:]
        if valueMissing { flags["valueMissing"] = true }
        if customError { flags["customError"] = true }
        return .object(["valid": .bool(valid), "validationMessage": .string(validationMessage), "flags": .object(flags)])
    }
}
private struct AWCDatePickerControllersKey: EnvironmentKey { static let defaultValue: [String: AWCDatePickerController] = [:] }
extension EnvironmentValues {
    var awcDatePickerControllers: [String: AWCDatePickerController] { get { self[AWCDatePickerControllersKey.self] } set { self[AWCDatePickerControllersKey.self] = newValue } }
}
public extension View {
    /// Attach a controller to the md-date-picker with node id `id` rendered inside this view.
    func awcDatePickerController(_ controller: AWCDatePickerController, for id: String? = nil) -> some View {
        transformEnvironment(\.awcDatePickerControllers) { $0[id ?? ""] = controller }
    }
}

/// The panel column: header and actions at their natural height, the body between them shrunk (and clipped) so the panel
/// stays within its max-block-size, as the source's flex column with `min-block-size: 0; overflow: hidden` on the body.
struct AWCDatePickerColumn: Layout {
    let width: Double, maxHeight: Double, flexible: Int
    func sizes(_ subviews: Subviews) -> [Double] {
        let p = ProposedViewSize(width: width, height: nil)
        let ideal = subviews.map { Double($0.sizeThatFits(p).height) }
        let fixed = ideal.enumerated().filter { $0.offset != flexible }.map(\.element).reduce(0, +)
        return ideal.enumerated().map { $0.offset == flexible ? Swift.max(0, Swift.min($0.element, maxHeight - fixed)) : $0.element }
    }
    /// `flexible < 0`: nothing shrinks (a docked body with actions has the default `flex: 0 1 auto` and a min-content
    /// minimum): the panel box stops at maxHeight and the rest overflows it (`overflow: visible`).
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let total = sizes(subviews).reduce(0, +)
        return CGSize(width: width, height: flexible < 0 ? Swift.min(total, maxHeight) : total)
    }
    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var y = bounds.minY
        for (i, h) in sizes(subviews).enumerated() {
            subviews[i].place(at: CGPoint(x: bounds.minX, y: y), anchor: .topLeading, proposal: ProposedViewSize(width: width, height: h)); y += h
        }
    }
}

/// A keyframe animation of the source (CSS `animation` with `both` fill): the run `token` starts with the first frame that
/// renders it and presents `values(progress)` = [opacity, scale, translateY, translateX]; nil token or reduced motion
/// presents the end state.
struct AWCDatePickerKeyframes: ViewModifier {
    let runtime: AWCDatePickerRuntime, key: String, token: Int?, duration: Double, curve: [Double], reduceMotion: Bool
    var anchor: UnitPoint = .center
    let values: (Double) -> [Double]
    func body(content: Content) -> some View {
        let _ = runtime.motionTick
        let now = CACurrentMediaTime() * 1000
        let running = token != nil && !reduceMotion
        let start = running ? runtime.animationStart(key, token ?? 0, now, duration) : -1e12
        TimelineView(.animation(paused: !running || now > start + duration)) { _ in
            let t = CACurrentMediaTime() * 1000
            let v = values(running ? AWCTimePickerMotion.progress(t - start, duration: duration, curve: curve) : 1)
            let _ = runtime.record(key, v)
            content.scaleEffect(v[1], anchor: anchor).offset(x: v[3], y: v[2]).opacity(v[0])
        }
    }
}
enum AWCDatePickerMotion {
    static let standard: [Double] = [0.2, 0, 0, 1], emphasized: [Double] = [0.2, 0, 0, 1]
    static let decelerate: [Double] = [0.05, 0.7, 0.1, 1], accelerate: [Double] = [0.3, 0, 0.8, 0.15]
    /// md-date-picker-selection-bloom-in (and the docked calendar's: scale from 0.92): opacity 0, translateY 8, scale → 1.
    static func bloomIn(_ p: Double, from scale: Double = 0.94) -> [Double] { [p, scale + (1 - scale) * p, 8 * (1 - p), 0] }
    /// md-date-picker-panel-bloom-out / selection-bloom-out: opacity 1 → 0, translateY 0 → 4, scale 1 → 0.96.
    static func bloomOut(_ p: Double) -> [Double] { [1 - p, 1 - 0.04 * p, 4 * p, 0] }
}

/// The panel surface: the modal panel clips its content (`overflow: hidden`); the docked one only paints its rounded box.
struct AWCDatePickerSurface: ViewModifier {
    let color: Color, radius: Double, clips: Bool
    func body(content: Content) -> some View {
        if clips { content.background(color).clipShape(RoundedRectangle(cornerRadius: radius, style: .circular)) }
        else { content.background(RoundedRectangle(cornerRadius: radius, style: .circular).fill(color)) }
    }
}

/// `display: grid; grid-template-columns: repeat(N, 1fr); gap; justify-items: center`: equal columns, each child centred in
/// its column at its own size, rows as tall as their tallest child (grid-auto-rows comes from the children's frames).
struct AWCDatePickerGrid: Layout {
    let columns: Int, columnGap: Double, rowGap: Double
    var rowHeight: Double? = nil
    func rows(_ subviews: Subviews) -> [[LayoutSubviews.Element]] { stride(from: 0, to: subviews.count, by: columns).map { Array(subviews[$0..<Swift.min($0 + columns, subviews.count)]) } }
    func height(_ subviews: Subviews) -> [Double] { rows(subviews).map { r in rowHeight ?? r.map { Double($0.sizeThatFits(.unspecified).height) }.max() ?? 0 } }
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let h = height(subviews)
        return CGSize(width: proposal.width ?? 0, height: h.reduce(0, +) + Double(Swift.max(0, h.count - 1)) * rowGap)
    }
    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        // 1fr columns never shrink below their content (min-content): a narrow grid overflows its container instead.
        let widest = subviews.map { Double($0.sizeThatFits(.unspecified).width) }.max() ?? 0
        let col = Swift.max(widest, (Double(bounds.width) - Double(columns - 1) * columnGap) / Double(columns)), hs = height(subviews)
        var y = Double(bounds.minY)
        for (r, row) in rows(subviews).enumerated() {
            for (c, v) in row.enumerated() {
                let size = v.sizeThatFits(.unspecified), i = c
                let x = Double(bounds.minX) + Double(i) * (col + columnGap) + (col - Double(size.width)) / 2
                v.place(at: CGPoint(x: x, y: y), anchor: .topLeading, proposal: ProposedViewSize(size))
            }
            y += hs[r] + rowGap
        }
    }
}

/// A clipping box (overflow hidden / auto) that keeps a target edge in view: focusing the roving day scrolls the calendar to
/// the nearest position showing it (Chrome's focus scroll-into-view in a panel shorter than its six weeks). The visible height
/// is this view's own state, so the scroll settles inside the subtree (the modal overlay does not round-trip the picker).
struct AWCDatePickerScrollClip<Content: View>: View {
    let revealBottom: Double, nodeID: String
    /// story 1-5 a11y (macOS): the grid's AXTable / AXRow markers, laid over the visible frame (visible height, scroll).
    var axLayer: ((Double, Double) -> AnyView)? = nil
    @ViewBuilder let content: () -> Content
    @State private var visible = 0.0
    var body: some View {
        let scroll = visible > 0 ? Swift.max(0, revealBottom - visible) : 0
        content()
            .fixedSize(horizontal: false, vertical: true)
            .padding(.top, -scroll)
            .frame(minHeight: 0, maxHeight: .infinity, alignment: .top)
            .clipped()
            .overlay(alignment: .topLeading) { if let axLayer { axLayer(visible, scroll) } }
            .onGeometryChange(for: Double.self) { Double($0.size.height) } action: { visible = $0 }
            .awcInspect(nodeID: nodeID, part: "calendar", name: "calendar") { _ in ["visible": .number(visible), "scroll": .number(scroll)] }
    }
}

/// The day grid's accessibility (story 1-5): the SwiftUI day buttons are hidden and re-listed by the grid's table. iOS: the grid is
/// a UIKit data table (AWCTableAXView) over the hidden layout, its cells are the day buttons; macOS: the AXTable / AXRow markers
/// are laid over the calendar's visible frame (`axLayer`), the content is only hidden here.
struct AWCDatePickerGridAX: ViewModifier {
    let label: String, identifier: String, active: Bool
    @ViewBuilder func body(content: Content) -> some View {
        #if canImport(AppKit)
        content.accessibilityHidden(true)
        #else
        content.accessibilityHidden(true).background { if active { AWCTableAXMarker(info: .init(kind: .table, label: label, identifier: identifier, columnCount: 7)).allowsHitTesting(false) } }
        #endif
    }
}

/// A docked menu entry (md-menu-item): the selected container, the state layer while pressed or focus-visible, the focus ring.
struct AWCDatePickerMenuRowStyle: ButtonStyle {
    let focused: Bool, nativePressed: Bool, background: Color, layer: Color, ring: Color
    let pointerPressed: () -> Void
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .background(background)
            .overlay { if focused || nativePressed || configuration.isPressed { layer.opacity(0.12).allowsHitTesting(false) } }
            .overlay { if focused { Rectangle().strokeBorder(ring, lineWidth: 3).allowsHitTesting(false) } }
            .contentShape(Rectangle())
            .onChange(of: configuration.isPressed) { _, down in if down { pointerPressed() } }
    }
}

/// The picker's actions for its cells, kept by reference so a cell compares by its values alone.
final class AWCDatePickerCellActions {
    var child: (AWCNode, ((AWCEvent) -> Void)?) -> AnyView = { _, _ in AnyView(EmptyView()) }
    var selectYear: (Int, Bool) -> Void = { _, _ in }
    var pick: (Bool, Int, Bool) -> Void = { _, _, _ in }
}
/// A docked menu entry (md-menu-item, radio) as an equatable view.
struct AWCDatePickerMenuRow: View, Equatable {
    let id: String, n: Int, text: String, year: Bool, selected: Bool, rtl: Bool, background: String, ink: String, ring: String
    let font: Double, inset: Double, gap: Double
    /// Rows away from the visible part of the list draw the same row without the native control (a press still picks):
    /// 201 native rows took ~200 ms to mount or unmount, delaying the list's exit and the calendar's return.
    var live = true
    let actions: AWCDatePickerCellActions
    static func == (a: Self, b: Self) -> Bool {
        a.id == b.id && a.text == b.text && a.selected == b.selected && a.rtl == b.rtl && a.background == b.background && a.ink == b.ink && a.ring == b.ring
            && a.font == b.font && a.inset == b.inset && a.gap == b.gap && a.live == b.live
    }
    var body: some View {
        if live { liveRow }
        else {
            let inkColor = AWCTableColor.color(ink, "#1C1B1F"), actions = actions, n = n, year = year
            content(inkColor)
                .background(AWCTableColor.color(background, "#00000000"))
                .contentShape(Rectangle())
                .onTapGesture { actions.pick(year, n, true) }
        }
    }
    func content(_ inkColor: Color) -> some View {
        HStack(spacing: gap) {
            AWCMaterialSymbol("check", size: 24).foregroundStyle(inkColor).opacity(selected ? 1 : 0).frame(width: 24, height: 24)
            AWCListText(text: text, size: font, lineHeight: 24, weight: 400, tracking: 0.5, color: inkColor).frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.leading, inset + 12).padding(.trailing, 12)
        .frame(height: 48)
    }
    @ViewBuilder var liveRow: some View {
        let inkColor = AWCTableColor.color(ink, "#1C1B1F"), actions = actions, n = n, year = year
        AWCNativeActionControl(style: { focused, pressed, _, pointerPressed in
            AWCDatePickerMenuRowStyle(focused: focused, nativePressed: pressed, background: AWCTableColor.color(background, "#00000000"),
                                      layer: inkColor, ring: AWCTableColor.color(ring, "#625B71"), pointerPressed: pointerPressed)
        }, policy: AWCButtonAccessibilityPolicy(properties: ["roleOverride": "menuitem", "groupTabindex": .number(selected ? 0 : -1)]),
           id: id, accessibleLabel: text, action: { source in actions.pick(year, n, source == .pointer) }, direction: rtl ? "rtl" : "ltr") {
            content(inkColor)
        }
    }
}
/// A year cell (md-button) as an equatable view: a key move re-renders the two cells whose tab stop moved, not the whole list.
struct AWCDatePickerYearCell: View, Equatable {
    let nodeID: String, year: Int, selected: Bool, disabled: Bool, tabStop: Bool, container: String, label: String
    let radius: Double?, font: Double, width: Double, height: Double
    /// Cells outside the scroll viewport (± a row) are inert boxes with the same geometry and inspection: 201 md-buttons
    /// (each with its native focus view) took ~200 ms to mount or unmount, delaying the year view's exit and focus.
    var live = true
    let actions: AWCDatePickerCellActions
    static func == (a: Self, b: Self) -> Bool {
        a.nodeID == b.nodeID && a.year == b.year && a.selected == b.selected && a.disabled == b.disabled && a.tabStop == b.tabStop && a.container == b.container
            && a.label == b.label && a.radius == b.radius && a.font == b.font && a.width == b.width && a.height == b.height && a.live == b.live
    }
    var body: some View {
        if live { liveCell }
        else {
            let y = year
            Color.clear.frame(width: width, height: height)
                .awcInspect(nodeID: nodeID, part: "year-\(y)", name: "year") { _ in ["year": .number(Double(y)), "selected": .bool(selected), "tabindex": .number(tabStop ? 0 : -1)] }
        }
    }
    @ViewBuilder var liveCell: some View {
        let y = year, actions = actions
        let btn = AWCNode(id: nodeID + "-year-\(y)", tag: "md-button",
                          properties: ["variant": .string(selected ? "filled" : "text"), "size": "sm", "shape": "square", "selected": .bool(selected), "disabled": .bool(disabled),
                                       "roleOverride": "gridcell", "groupTabindex": .number(tabStop ? 0 : -1), "ariaLabel": .string(String(y))],
                          children: [.text(String(y))])
        actions.child(btn) { e in if e.name == "mdClick" { actions.selectYear(y, e.activation?.source == .pointer) } }
            .awcButtonAppearance(AWCButtonAppearance(containerColor: container, labelColor: label, fontSize: font, fontWeight: 400, lineHeight: 24, letterSpacing: 0.5,
                                                     cornerRadius: radius, paddingInline: 0, width: width, minWidth: width, height: height, focusRingOffset: -1))
            .frame(width: width, height: height)
            .awcInspect(nodeID: nodeID, part: "year-\(y)", name: "year") { _ in ["year": .number(Double(y)), "selected": .bool(selected), "tabindex": .number(tabStop ? 0 : -1)] }
    }
}

struct AWCNativeDatePicker: View {
    let node: AWCNode
    let theme: AWCTheme
    let props: [String: AWCValue]
    let setProperty: (String, AWCValue) -> Void
    let emit: (String, AWCValue) -> Void
    let child: (AWCNode, ((AWCEvent) -> Void)?) -> AnyView
    /// The application's event sink (slotted content's own events; the picker's internal parts' events stop here, D7).
    let forward: (AWCEvent) -> Void
    @State private var rt = AWCDatePickerRuntime()
    @State private var owner: AWCModalOwner
    @State private var fieldTarget = AWCFieldFocusTarget()
    @State private var entryTarget = AWCFieldFocusTarget()
    /// The docked list's first visible entry (scrollPosition): rows near it render native controls.
    @State private var menuTop: Int? = nil
    @Environment(\.awcNativeFocusChanged) private var inheritedFocusChanged
    @Environment(\.layoutDirection) private var direction
    @Environment(\.awcDatePickerAppearance) private var inheritedAppearance
    @Environment(\.awcDatePickerAppearanceTargets) private var targetedAppearance
    @Environment(\.awcDatePickerToday) private var pinnedToday
    @Environment(\.awcNativeDensity) private var inheritedDensity
    @Environment(\.awcNativeSpacingRung) private var inheritedRung
    @Environment(\.awcModalSession) private var session
    @Environment(\.awcNativeInert) private var inheritedInert
    @Environment(\.awcDatePickerControllers) private var controllers
    @Environment(\.accessibilityReduceMotion) private var systemReduceMotion
    @Environment(\.awcReducedMotion) private var reducedOverride
    /// The dialog renders in the modal scope's overlay, outside this view: the picker's environment is re-applied there.
    @Environment(\.self) private var environment

    init(node: AWCNode, theme: AWCTheme, props: [String: AWCValue], setProperty: @escaping (String, AWCValue) -> Void,
         emit: @escaping (String, AWCValue) -> Void, child: @escaping (AWCNode, ((AWCEvent) -> Void)?) -> AnyView, forward: @escaping (AWCEvent) -> Void) {
        self.node = node; self.theme = theme; self.props = props; self.setProperty = setProperty; self.emit = emit; self.child = child; self.forward = forward
        _owner = State(initialValue: AWCModalOwner(id: node.id + "#date-picker"))
    }

    // MARK: Properties
    func s(_ k: String, _ f: String = "") -> String { props[k]?.string ?? f }
    func b(_ k: String, _ f: Bool = false) -> Bool { props[k]?.bool ?? f }
    var variant: String { ["modal", "modal-input", "docked"].contains(s("variant")) ? s("variant") : "modal-input" }
    var docked: Bool { variant == "docked" }
    var disabled: Bool { b("disabled") }
    // The motion hooks set the keyframes' durations and the bloom-in easing; the state changes that follow an exit keep the
    // source's fixed delays (DOCKED_SELECTION_BLOOM_OUT_MS / PANEL_BLOOM_OUT_MS: 200 ms), as the source's timers do.
    var selBloomMs: Double { appearance.duration("selection-bloom-duration") ?? 450 }
    var selBloomCurve: [Double] { appearance.easing("selection-bloom-easing") ?? AWCDatePickerMotion.decelerate }
    var selOutMs: Double { appearance.duration("selection-bloom-out-duration") ?? 200 }
    var calBloomMs: Double { appearance.duration("calendar-bloom-duration") ?? 300 }
    var gridSlideMs: Double { appearance.duration("grid-slide-duration") ?? 300 }
    var panelOutMs: Double { appearance.duration("panel-bloom-out-duration") ?? 200 }
    var value: String { s("value") }
    var reduceMotion: Bool { reducedOverride ?? systemReduceMotion }
    var rtl: Bool { direction == .rightToLeft }
    @Environment(\.locale) private var environmentLocale
    var locale: AWCDateLocale { AWCDateLocale(s("locale"), fallback: environmentLocale) }
    var today: AWCDay { pinnedToday ?? AWCDay.today() }
    var appearance: AWCDatePickerAppearance { inheritedAppearance.merging(targetedAppearance[node.id] ?? .init()).merging(AWCDatePickerAppearance(style: s("style"))) }
    /// density −1…−4 sets the scale (and −2…−4 the spacing rung) on the host; 0 / unset inherits the page's (`:host([density])`
    /// has no rule for 0).
    var scale: Double { let d = props["density"]?.number ?? 0; return [-1.0, -2, -3, -4].contains(d) ? d : inheritedDensity }
    var rung: Double { let d = props["density"]?.number ?? 0; return [-2.0, -3, -4].contains(d) ? d : inheritedRung }
    /// The viewport (the modal scope's, else unbounded): the panel keeps 16px from every edge.
    var viewport: CGSize { session.map { $0.viewport.width > 0 ? $0.viewport : CGSize(width: 100_000, height: 100_000) } ?? CGSize(width: 100_000, height: 100_000) }
    func panelWidth(_ m: AWCDatePickerMetrics, docked: Bool) -> Double { Swift.min(docked ? m.dockedWidth : m.panelWidth, Double(viewport.width) - 32) }
    func panelMax(_ m: AWCDatePickerMetrics) -> Double {
        if docked, let b = rt.dockedMaxBlock { return Swift.min(b, m.panelMax) }
        return Swift.min(m.panelMax, Double(viewport.height) - 32)
    }
    var metrics: AWCDatePickerMetrics { AWCDatePickerMetrics(appearance, scale: scale, rung: rung) }
    var firstDay: Int { let f = Int(props["firstDayOfWeek"]?.number ?? -1); return (0...6).contains(f) ? f : locale.firstDayOfWeek }
    func label(_ k: String, _ f: String) -> String { props[k]?.string ?? f }
    var hasActionRow: Bool { !node.children(inSlot: "actions").isEmpty || !b("commitOnSelect") || rt.inputMode }

    // MARK: Colours
    func token(_ role: String, _ fallback: String) -> String { theme.tokens["--md-sys-color-" + role] ?? fallback }
    func color(_ hex: String) -> Color { AWCTableColor.color(hex, "#000000") }
    func hook(_ k: String, _ role: String, _ fallback: String) -> String { appearance.color(k) ?? token(role, fallback) }

    // MARK: Lifecycle
    func connect() -> Bool {
        rt.show = { [self] in openPicker() }
        rt.hide = { [self] in closePicker(emitClose: true) }
        rt.clear = { [self] in clearValue() }
        rt.focusInput = { [self] in _ = fieldTarget.focus() }
        rt.isDisabled = { [self] in disabled }
        rt.revalidate = { [self] in syncValidity(value) }
        rt.fieldTarget = fieldTarget; rt.entryTarget = entryTarget
        // The modal scope routes Escape and Tab to the top owner (the source: routePickerKeyDown / trapTab).
        owner.escape = { [self] in
            guard rt.isOpen, focusInside else { return false }
            escapeKey(); return true
        }
        owner.tab = { [self] backward in tabTrap(backward) }
        AWCDatePickerRuntime.mounted[node.id] = rt
        (controllers[node.id] ?? controllers[""])?.runtime = rt
        return true
    }
    func load() {
        rt.committedValue = value; syncValidity(value)
        let v = AWCDay.iso(value) ?? today
        rt.viewYear = v.year; rt.viewMonth = v.month; rt.focused = v; rt.pending = AWCDay.iso(value)
        if b("open") { openPicker(emitOpen: false) }
    }
    func openPicker(emitOpen: Bool = true) {
        guard !rt.isOpen, !disabled else { return }
        let v = AWCDay.iso(value)
        rt.pending = v; rt.inputMode = false; rt.viewMode = .calendar; rt.monthMenuOpen = false; rt.yearMenuOpen = false; rt.preloadCalendar = false; rt.yearFocus = nil; rt.yearScroll = nil
        let base = v ?? today
        rt.viewYear = base.year; rt.viewMonth = base.month
        rt.focused = AWCDatePickerModel.clamp(v ?? today, min: s("min"), max: s("max"))
        rt.entryDraft = v.map { locale.display($0, separator: s("dateSeparator")) } ?? ""
        rt.isOpen = true; rt.closing = false; rt.panelClosing = false; rt.menuClosing = false; rt.yearClosing = false
        rt.openToken &+= 1; rt.calendarToken = nil; rt.slideToken = nil; rt.openedAt = CACurrentMediaTime()
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) { [rt] in rt.settle &+= 1 }
        if !b("open") { setProperty("open", true) }
        if !docked {
            session?.acquire(owner)
            if openerInside { owner.opener = nil }
        }
        if emitOpen { emit("mdOpen", .null) }
        // focusFocusedDay: the roving day takes focus once rendered (decision 6).
        focusDay()
    }
    /// The responder that opened the dialog is one of the picker's own parts (the trigger's calendar button or input).
    var openerInside: Bool {
        if (owner.opener as? AWCNativeButtonFocusView)?.configuration?.id.hasPrefix(node.id + "-") == true { return true }
        return rt.fieldTarget?.isFocused() == true
    }
    /// dismissPanel: open docked menus bloom out first (200ms), then the panel (and the scrim) bloom out (200ms); `open`
    /// turns false (mdClose) when that ends. Reduced motion closes at once.
    func closePicker(emitClose: Bool) {
        guard rt.isOpen, !rt.closing else { return }
        if reduceMotion {
            #if canImport(UIKit)
            // UIKit: a synchronous close inside the tap's update left the removed dialog's inspection in the overlay; the close
            // lands on the next run-loop turn (the same events, a few ms later).
            rt.closing = true
            DispatchQueue.main.async { [self] in rt.closing = false; finishClose(emitClose: emitClose) }
            #else
            finishClose(emitClose: emitClose)
            #endif
            return
        }
        rt.closing = true
        let menus = docked && (rt.monthMenuOpen || rt.yearMenuOpen), runtime = rt
        if menus { rt.menuClosing = true } else { rt.panelClosing = true }
        Task { @MainActor in
            if menus {
                await runtime.finishRun(runtime.yearMenuOpen ? "yearMenu" : "monthMenu", -runtime.menuToken, 200)
                guard AWCDatePickerRuntime.mounted[node.id] === runtime else { return }
                runtime.monthMenuOpen = false; runtime.yearMenuOpen = false; runtime.menuClosing = false; runtime.preloadCalendar = false; runtime.panelClosing = true
            }
            await runtime.finishRun("panel", -runtime.openToken, 200)
            guard AWCDatePickerRuntime.mounted[node.id] === runtime, runtime.closing else { return }
            finishClose(emitClose: emitClose)
        }
    }
    func finishClose(emitClose: Bool) {
        guard rt.isOpen else { return }
        rt.isOpen = false; rt.closing = false; rt.panelClosing = false; rt.menuClosing = false; rt.yearClosing = false
        rt.monthMenuOpen = false; rt.yearMenuOpen = false; rt.preloadCalendar = false; rt.focusedControl = nil; rt.focusGeneration &+= 1
        // The removed dialog's inspection leaves the modal scope with the next update.
        rt.settle &+= 1; rt.closeSerial &+= 1
        if !docked { rt.lingerEntry = true; let runtime = rt; Task { @MainActor in try? await Task.sleep(nanoseconds: 80_000_000); runtime.lingerEntry = false } }
        if !docked { session?.release(owner.id) }
        if b("open") { setProperty("open", false) }
        if emitClose { emit("mdClose", .null) }
    }
    func cancel() { guard rt.isOpen, !rt.closing else { return }; emit("mdCancel", .null); closePicker(emitClose: true) }
    /// syncFormValue: the value's constraint validity; mdValidityChange when it moves (the first evaluation only primes).
    func syncValidity(_ v: String) {
        let missing = b("required") && v.isEmpty, custom = rt.customValidity
        let message = missing ? label("valueMissingLabel", "Please choose a date.") : custom
        let flag: String? = missing ? "valueMissing" : !custom.isEmpty ? "customError" : nil
        if rt.validity.message != message || rt.validity.flag != flag { rt.validity = (message, flag) }
        let key = "\(message.isEmpty)|\(message)"
        guard rt.validityKey != key else { return }
        let primed = rt.validityKey != nil
        rt.validityKey = key
        if primed {
            let flags: AWCValue = missing ? ["valueMissing": true] : !custom.isEmpty ? ["customError": true] : .object([:])
            emit("mdValidityChange", ["valid": .bool(message.isEmpty), "validationMessage": .string(message), "flags": flags])
        }
    }
    func commit() {
        guard let d = rt.pending else { closePicker(emitClose: true); return }
        if d.iso != value {
            setProperty("value", .string(d.iso)); rt.committedValue = d.iso; syncValidity(d.iso)
            emit("mdChange", ["value": .string(d.iso), "date": .string(d.iso)])
        }
        closePicker(emitClose: true)
    }
    func clearValue() {
        guard !value.isEmpty else { return }
        setProperty("value", ""); rt.committedValue = ""; rt.pending = nil; rt.draft = ""; syncValidity("")
        emit("mdChange", ["value": "", "date": .null])
    }
    func select(_ d: AWCDay) {
        guard !isDisabled(d) else { return }
        rt.pending = d; rt.focused = d
        if d.month != rt.viewMonth || d.year != rt.viewYear { rt.viewYear = d.year; rt.viewMonth = d.month }
        emit("mdSelected", ["value": .string(d.iso), "date": .string(d.iso)])
        if b("commitOnSelect") && !rt.inputMode { commit() }
    }
    func isDisabled(_ d: AWCDay) -> Bool {
        if AWCDatePickerModel.outOfRange(d, min: s("min"), max: s("max")) { return true }
        return (controllers[node.id] ?? controllers[""])?.isDateDisabled?(d) ?? false
    }
    /// setGridSlideDirection: the day grid slides in from the side the new month lies on (not while a menu shows).
    func slideGrid(_ delta: Int) {
        guard !reduceMotion, !rt.monthMenuOpen, !rt.yearMenuOpen, !rt.menuClosing else { return }
        rt.slideDirection = delta > 0 ? 1 : -1; rt.slideToken = rt.nextRun()
    }
    func goToMonth(_ delta: Int, source: String?) {
        slideGrid(delta)
        let m = AWCDay(year: rt.viewYear, month: rt.viewMonth, day: 1).adding(months: delta)
        rt.viewYear = m.year; rt.viewMonth = m.month
        if let source { emit("mdViewChange", ["month": .number(Double(m.month - 1)), "year": .number(Double(m.year)), "source": .string(source)]) }
    }

    // MARK: Body
    var body: some View {
        let m = metrics
        let _ = connect()
        content(m)
            .environment(\.awcNativeDensity, scale).environment(\.awcNativeSpacingRung, rung)
    }
    @ViewBuilder func content(_ m: AWCDatePickerMetrics) -> some View {
        Group {
            if variant == "modal" { Color.clear.frame(width: 0, height: 0).accessibilityHidden(true) }
            else { trigger(m) }
        }
        // .md-date-picker__docked-popup: 4px under the anchor (the field with its supporting line) at its inline start; when the
        // viewport has no room, at the inline end and / or above it, or capped (positionDockedPanel).
        .onGeometryChange(for: CGRect.self) { $0.frame(in: .global) } action: { rt.anchorFrame = $0; rt.anchorHeight = Double($0.height); positionDocked(m) }
        .overlay(alignment: rt.dockedEnd ? .topTrailing : .topLeading) {
            if docked && rt.isOpen {
                dockedPanel(m)
                    .onGeometryChange(for: Double.self) { Double($0.size.height) } action: { h in
                        if rt.dockedMaxBlock == nil { rt.dockedPanelHeight = h }
                        positionDocked(m)
                    }
                    .offset(y: rt.dockedAbove ? -(4 + Swift.min(rt.dockedPanelHeight, rt.dockedMaxBlock ?? .infinity)) : rt.anchorHeight + 4)
            }
        }
        .background {
            if docked && rt.isOpen && !disabled { AWCColorPickerOutsidePress(owner: rt) { outsidePress() } }
        }
        .zIndex(docked && rt.isOpen ? 1 : 0)
        .background {
            Color.clear.frame(width: 0, height: 0)
                .preference(key: AWCModalEntries.self, value: !docked && session != nil ? (rt.isOpen ? [modalEntry(m)] : rt.lingerEntry ? [emptyEntry] : []) : [])
        }
        .opacity(disabled ? 0.5 : 1)
        .allowsHitTesting(!disabled)
        .onAppear { load() }
        .onChange(of: b("open")) { _, v in if v && !rt.isOpen { openPicker() } else if !v && rt.isOpen { closePicker(emitClose: true) } }
        .onChange(of: value) { _, v in syncValidity(v); if v != rt.committedValue { rt.committedValue = v; rt.pending = AWCDay.iso(v) } }
        .onChange(of: b("required")) { _, _ in syncValidity(value) }
        // InlineValidationPresenter.reset: a renamed or disabled control forgets a reported message.
        .onChange(of: s("name")) { _, _ in rt.revealed = false }
        .onChange(of: disabled) { _, off in if off { rt.revealed = false } }
        // The source focuses the shown sub-view's roving target: the year cell (focusYearCell 'open'), the entry input, the
        // selected entry of a docked menu (afterDockedSelectionMenuPaint).
        .onChange(of: rt.viewMode) { _, mode in
            guard rt.isOpen, mode == .year else { return }
            if rt.yearFocus == nil { rt.yearFocus = nearestEnabledYear(rt.viewYear, 1) }
            let id = node.id + "-year-\(yearFocusTarget)"
            focusSoon { [rt] in rt.yearFocusGroup.focus(id) }
        }
        .onChange(of: rt.inputMode) { _, input in if input && rt.isOpen { focusSoon { [rt] in rt.entryTarget?.focus() ?? false } } }
        .onChange(of: rt.monthMenuOpen || rt.yearMenuOpen) { _, open in
            guard open, rt.isOpen else { return }
            let id = menuRowID(year: rt.yearMenuOpen, rt.yearMenuOpen ? rt.viewYear : rt.viewMonth)
            focusSoon { [rt] in rt.menuFocusGroup.focus(id) }
        }
        .awcInspect(nodeID: node.id, name: "md-date-picker") { _ in ["open": .bool(rt.isOpen), "variant": .string(variant), "inputMode": .bool(rt.inputMode),
                                                                  "scale": .number(scale), "rung": .number(rung), "inheritedDensity": .number(inheritedDensity),
                                                                  "closes": .number(Double(rt.closeSerial))] }
    }

    // MARK: Trigger
    /// The md-text-field trigger node: label, the formatted value, the hint / error, leading slot, clear and calendar buttons.
    func triggerNode() -> AWCNode {
        let selected = AWCDay.iso(value)
        // A reported invalid value shows its message until it is valid again (InlineValidationPresenter.refresh).
        let reported = rt.revealed ? rt.validity.message : ""
        let shown = rt.validationMessage.isEmpty ? reported : rt.validationMessage
        let showError = b("error") || !shown.isEmpty
        let errorText = s("errorText").isEmpty ? shown : s("errorText")
        let display = rt.fieldFocused ? rt.draft : selected.map { locale.display($0, separator: s("dateSeparator")) } ?? ""
        let supporting = showError && !errorText.isEmpty ? "" : (s("supportingText").isEmpty ? locale.pattern(separator: s("dateSeparator")) : s("supportingText"))
        let calendarSlot = node.children(inSlot: "calendar-icon")
        var trailing: [AWCNode] = []
        if b("clearable") && !value.isEmpty && !disabled {
            trailing.append(AWCNode(id: node.id + "-clear", tag: "md-icon-button", properties: ["variant": "standard", "icon": "close", "ariaLabel": .string(label("clearLabel", "Clear date"))], slot: "trailing-icon"))
        }
        let calendar = AWCNode(id: node.id + "-calendar", tag: "md-icon-button",
                               properties: ["variant": .string(rt.isOpen ? "tonal" : "standard"), "icon": .string(calendarSlot.isEmpty ? s("calendarIcon", "calendar_today") : ""),
                                            "ariaLabel": .string(rt.isOpen ? label("closeCalendarLabel", "Close calendar") : label("openCalendarLabel", "Open calendar")),
                                            "ariaHaspopup": "dialog", "ariaExpanded": .string(rt.isOpen ? "true" : "false"), "disabled": .bool(disabled)],
                               children: calendarSlot.map { var n = $0; n.slot = nil; return n }, slot: "trailing-icon")
        trailing.append(calendar)
        let leading = node.children(inSlot: "leading-icon")
        let field = AWCNode(id: node.id + "-field", tag: "md-text-field",
                            properties: ["variant": .string(s("fieldVariant") == "filled" ? "filled" : "outlined"), "label": .string(label("label", "Date")), "value": .string(display),
                                         "supportingText": .string(supporting), "error": .bool(showError), "errorText": .string(errorText),
                                         "reserveSupportingSpace": .bool(b("reserveSupportingSpace")), "disabled": .bool(disabled), "required": .bool(b("required")),
                                         "appearFocused": .bool(rt.isOpen)],
                            children: leading + trailing)
        return field
    }
    @ViewBuilder func trigger(_ m: AWCDatePickerMetrics) -> some View {
        let a = appearance, selected = AWCDay.iso(value), field = triggerNode()
        let focusColor = a.color("field-focus-color") ?? token("primary", "#6750A4")
        child(field) { e in
            switch (e.name, e.nodeID) {
            case ("mdClick", node.id + "-calendar"):
                rt.pointerInput = e.activation?.source == .pointer
                if rt.isOpen { closePicker(emitClose: true) } else { openPicker() }
            case ("mdClick", node.id + "-clear"):
                // The pressed clear button leaves with the value; focus continues on the calendar button (as Chrome's).
                rt.pointerInput = e.activation?.source == .pointer
                clearValue(); let id = node.id + "-calendar"; focusSoon(whileOpen: false) { [rt] in rt.panelFocus.focus(id) }
            // Typing shows the draft (the source's `focused ? inputDraft : formatted`) until a commit (Enter / blur) succeeds.
            case ("mdInput", node.id + "-field"): rt.fieldFocused = true; rt.draft = e.detail.string; emit("mdInput", ["value": e.detail])
            case ("mdChange", node.id + "-field"): rt.draft = e.detail.string; fieldCommit(); rt.fieldFocused = !rt.validationMessage.isEmpty
            // Slotted content (leading icon, calendar-icon slot) is the application's: its own events reach it.
            default: if !e.nodeID.hasPrefix(node.id + "-") { forward(e) }
            }
        }
        .awcTextFieldAppearance(AWCTextFieldAppearance(activeIndicatorColor: focusColor, containerColor: a.color("field-container-color"), containerShape: a.length("field-container-shape"),
                                                       filledPill: a.length("field-filled-pill"), iconColor: rt.isOpen ? focusColor : a.color("icon-color"),
                                                       inputColor: a.color("field-text-color"), labelColor: a.color("label-color"), outlineColor: a.color("field-color"),
                                                       supportingTextColor: a.color("field-supporting-color")), for: node.id + "-field")
        .frame(maxWidth: m.triggerMax)
        .background(AWCColorPickerOutsidePressRegion(owner: rt))
        .onGeometryChange(for: CGRect.self) { $0.frame(in: .named("awc-native-preview")) } action: { AWCColorPickerPreviewRegions.set($0, "field", owner: ObjectIdentifier(rt)) }
        .environment(\.awcFieldFocusTarget, fieldTarget)
        .environment(\.awcButtonFocusGroup, rt.panelFocus)
        .environment(\.awcInspectionAlias, AWCInspectionAlias(childID: node.id + "-field", parentID: node.id, part: "field"))
    }
    /// The trigger field's commit (Enter / blur): parse per locale; invalid or disabled dates set the error.
    func fieldCommit() {
        let text = rt.draft.trimmingCharacters(in: .whitespaces)
        if text.isEmpty { if !value.isEmpty { clearValue() }; rt.validationMessage = ""; return }
        guard let d = AWCDatePickerModel.parse(text, locale: locale, separator: s("dateSeparator")), !isDisabled(d) else {
            rt.validationMessage = label("invalidDateLabel", "Invalid date"); return
        }
        rt.validationMessage = ""
        if d.iso != value { setProperty("value", .string(d.iso)); rt.committedValue = d.iso; syncValidity(d.iso); emit("mdChange", ["value": .string(d.iso), "date": .string(d.iso)]) }
    }

    // MARK: Modal
    /// After an animated close the entry stays one update with empty content, so the removed dialog's inspection nodes
    /// leave the scope (an overlay removed while nothing else in the scope changes kept its last preferences).
    private var emptyEntry: AWCModalEntry { AWCModalEntry(id: owner.id, zIndex: 1000, content: AnyView(Color.clear.frame(width: 0, height: 0))) }
    private func modalEntry(_ m: AWCDatePickerMetrics) -> AWCModalEntry {
        let content = modalLayer(m).environment(\.awcNativeDensity, scale).environment(\.awcNativeSpacingRung, rung)
            .environment(\.awcNativeInert, false).environment(\.self, environment)
        return AWCModalEntry(id: owner.id, zIndex: 1000, content: AnyView(content))
    }
    @ViewBuilder func modalLayer(_ m: AWCDatePickerMetrics) -> some View {
        let scrim = AWCTableColor.mix(hook("scrim-color", "scrim", "#000000"), 0.32, nil)
        let closing = rt.panelClosing, token = closing ? -rt.openToken : rt.openToken
        ZStack {
            // md-date-picker-fade-in 150ms / fade-out 200ms, standard easing.
            Rectangle().fill(AWCTableColor.color(scrim))
                .modifier(AWCDatePickerKeyframes(runtime: rt, key: "scrim", token: token, duration: closing ? panelOutMs : 150, curve: AWCDatePickerMotion.standard,
                                                 reduceMotion: reduceMotion, values: { p in [closing ? 1 - p : p, 1, 0, 0] }))
                .contentShape(Rectangle())
                .onTapGesture { if b("scrimDismissible", true) { cancel() } else { dropFocus() } }
            .awcInspect(nodeID: node.id, part: "scrim", name: "scrim")
            // md-date-picker-scale 300ms emphasized (opacity, scale 0.9 → 1) / panel-bloom-out 200ms, from the centre top.
            panel(m, docked: false)
                .modifier(AWCDatePickerKeyframes(runtime: rt, key: "panel", token: token, duration: closing ? panelOutMs : 300,
                                                 curve: closing ? AWCDatePickerMotion.accelerate : AWCDatePickerMotion.emphasized, reduceMotion: reduceMotion, anchor: .top,
                                                 values: { p in closing ? AWCDatePickerMotion.bloomOut(p) : [p, 0.9 + 0.1 * p, 0, 0] }))
            .allowsHitTesting(!closing)
        }
        .padding(0)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .awcInspect(nodeID: node.id, part: "modal", name: "modal")
    }

    // MARK: Panel
    @ViewBuilder func panel(_ m: AWCDatePickerMetrics, docked: Bool) -> some View {
        let bg = docked ? token("surface-container-high", "#ECE6F0") : hook("container-color", "surface-container-high", "#ECE6F0")
        let radius = docked ? 16 : m.shape
        let width = panelWidth(m, docked: docked)
        // Docked: only a body without actions (or with an open menu, decision 3) shrinks; the docked panel is `overflow: visible`.
        AWCDatePickerColumn(width: width, maxHeight: panelMax(m), flexible: docked ? (hasActionRow && !rt.monthMenuOpen && !rt.yearMenuOpen ? -1 : 0) : 1) {
            if !docked { header(m) }
            body(m, docked: docked)
            if hasActionRow { actions(m) }
        }
        .modifier(AWCDatePickerSurface(color: color(bg), radius: radius, clips: !docked))
        .background {
            if !docked {
                AWCNativeBoxShadow(corners: AWCCornerShape.points(radius),
                                   layers: AWCBoxShadow.source(theme.tokens["--md-sys-elevation-3"] ?? "0 4px 8px 3px rgba(0, 0, 0, 0.15), 0 1px 3px rgba(0, 0, 0, 0.3)") ?? [], placement: .outer)
            }
        }
        .foregroundStyle(color(hook("field-text-color", "on-surface", "#1C1B1F")))
        .environment(\.awcCompositeKeyRouter, { id, k in pickerKey(id, k) })
        .environment(\.awcNativeFocusChanged, { id, focused in
            if focused { rt.focusedControl = id } else if rt.focusedControl == id { rt.focusedControl = nil }
            inheritedFocusChanged?(id, focused)
        })
        .environment(\.awcButtonFocusGroup, rt.panelFocus)
        .accessibilityElement(children: .contain).accessibilityLabel(label("label", "Date"))
        .accessibilityAddTraits(docked ? [] : .isModal)
        .awcInspect(nodeID: node.id, part: "panel", name: "panel") { _ in ["settle": .number(Double(rt.settle))] }
    }

    @ViewBuilder func header(_ m: AWCDatePickerMetrics) -> some View {
        let slotted = node.children(inSlot: "header")
        VStack(alignment: .leading, spacing: 0) {
            if !slotted.isEmpty {
                ForEach(slotted) { child($0, nil) }
            } else {
                AWCListText(text: label("headline", "Select date"), size: m.supportingFont, lineHeight: m.supportingLine, weight: 500, tracking: 0.5,
                            color: color(hook("supporting-color", "on-surface-variant", "#49454F")))
                    .padding(.bottom, m.supportingPad)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .awcInspect(nodeID: node.id, part: "supporting", name: "supporting")
                HStack(spacing: m.gapSm) {
                    AWCListText(text: rt.inputMode ? label("enterDatesLabel", "Enter dates") : rt.pending.map { locale.format($0, skeleton: "MMMEd") } ?? label("selectDateLabel", "Select date"),
                                size: m.headlineFont, lineHeight: m.headlineLine, weight: 400, tracking: 0, color: color(hook("headline-color", "on-surface", "#1C1B1F")))
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .awcInspect(nodeID: node.id, part: "headline", name: "headline")
                    if !docked {
                        let toggle = AWCNode(id: node.id + "-mode-toggle", tag: "md-icon-button",
                                             properties: ["icon": .string(rt.inputMode ? "calendar_today" : "edit"),
                                                          "ariaLabel": .string(rt.inputMode ? label("toggleCalendarLabel", "Switch to calendar input") : label("toggleTextLabel", "Switch to text input"))])
                        child(toggle) { e in if e.name == "mdClick" { toggleInputMode() } }
                            // story 1-5 a11y: md-tooltip text = the button's description (Web aria-description)
                            .environment(\.awcTooltipDescription, rt.inputMode ? label("toggleCalendarLabel", "Switch to calendar input") : label("toggleTextLabel", "Switch to text input"))
                            .awcIconButtonAppearance(AWCIconButtonAppearance(width: 48, height: 48))
                            .awcInspect(nodeID: node.id, part: "mode-toggle", name: "mode-toggle")
                    }
                }
                .frame(minHeight: m.rowMin)
            }
        }
        .padding(EdgeInsets(top: m.insetLg, leading: m.insetXl, bottom: m.insetMd, trailing: m.insetMd))
        .frame(width: panelWidth(m, docked: false), alignment: .leading)
        .background(color(hook("header-color", "surface-container-high", "#ECE6F0")))
        .overlay(alignment: .bottom) { Rectangle().fill(color(token("outline-variant", "#CAC4D0"))).frame(height: 1) }
        .padding(.bottom, 1)
        .awcInspect(nodeID: node.id, part: "header", name: "header")
    }
    func toggleInputMode() {
        #if canImport(UIKit)
        // UIKit: the entry's text field resigns before it leaves the hierarchy, and the switch lands on the next run-loop turn
        // (removing a first-responder UITextField inside the overlay's update left the overlay stale and ignoring taps).
        if rt.inputMode && rt.entryTarget?.isFocused() == true {
            UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
            DispatchQueue.main.async { [self] in applyInputMode() }
            return
        }
        #endif
        applyInputMode()
    }
    func applyInputMode() {
        rt.inputMode.toggle()
        if rt.inputMode { rt.entryDraft = rt.pending.map { locale.display($0, separator: s("dateSeparator")) } ?? "" }
        else if !rt.entryDraft.isEmpty, let d = AWCDatePickerModel.parse(rt.entryDraft, locale: locale, separator: s("dateSeparator")), !isDisabled(d) {
            rt.pending = d; rt.focused = d; rt.viewYear = d.year; rt.viewMonth = d.month
        }
        emit("mdModeChange", ["mode": .string(rt.inputMode ? "input" : "calendar")])
        // The swapped body's inspection nodes reach the scope (an overlay's own preferences are not read again when only its
        // content changed: the entry's nodes stayed after entry → calendar on UIKit, n4-072), as after the dialog's first render.
        for delay in [0.05, 0.3] { DispatchQueue.main.asyncAfter(deadline: .now() + delay) { [rt] in rt.settle &+= 1 } }
    }

    @ViewBuilder func body(_ m: AWCDatePickerMetrics, docked: Bool) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            if rt.inputMode && !docked { entry(m) }
            else if docked {
                dockedNav(m)
                let menuOpen = rt.monthMenuOpen || rt.yearMenuOpen
                // The day grid mounts — hidden, inert, without layout height — right after the list's first exit frame (the
                // bloom-out barely moves in its first frames), so its own bloom starts with the frame after the list leaves:
                // mounting its 42 md-buttons takes ~85 ms, which otherwise passed between the list's last frame and the grid's first.
                if !menuOpen || rt.preloadCalendar {
                    bloomingCalendar(m, docked: true)
                        .frame(height: menuOpen ? 0 : nil, alignment: .top)
                        .opacity(menuOpen ? 0 : 1)
                        .allowsHitTesting(!menuOpen)
                        // story 1-5 a11y round 2: no accessibilityHidden(menuOpen) here (an explicit `false` on an ancestor un-hid the weekday
                        // header and the grid's own hiding); calendar() hides itself and drops its AX markers while a menu is open.
                        .environment(\.awcNativeInert, menuOpen || inheritedInert)
                }
                if menuOpen {
                    // The selection divider and the inline month / year list replace the day grid (they span the body padding).
                    let closing = rt.menuClosing, key = rt.yearMenuOpen ? "yearMenu" : "monthMenu"
                    Rectangle().fill(color(token("outline-variant", "#CAC4D0"))).frame(height: 1)
                        .modifier(AWCDatePickerKeyframes(runtime: rt, key: "divider", token: closing ? nil : rt.menuToken, duration: selBloomMs, curve: selBloomCurve,
                                                         reduceMotion: reduceMotion, values: { p in [p, 1, 0, 0] }))
                    .awcInspect(nodeID: node.id, part: "selection-divider", name: "selection-divider")
                    .padding(.horizontal, -12)
                    // md-date-picker-selection-bloom-in 450ms on every mount / selection-bloom-out 200ms, from the centre top.
                    selectionMenu(m, year: rt.yearMenuOpen)
                        .modifier(AWCDatePickerKeyframes(runtime: rt, key: key, token: closing ? -rt.menuToken : rt.menuToken, duration: closing ? selOutMs : selBloomMs,
                                                         curve: closing ? AWCDatePickerMotion.accelerate : selBloomCurve, reduceMotion: reduceMotion, anchor: .top,
                                                         values: { p in closing ? AWCDatePickerMotion.bloomOut(p) : AWCDatePickerMotion.bloomIn(p) }))
                    .allowsHitTesting(!closing)
                    .padding(.horizontal, -12)
                }
            } else {
                nav(m)
                if rt.viewMode == .year {
                    let closing = rt.yearClosing
                    yearGrid(m)
                        .modifier(AWCDatePickerKeyframes(runtime: rt, key: "yearWrap", token: closing ? -rt.yearToken : rt.yearToken, duration: closing ? selOutMs : selBloomMs,
                                                         curve: closing ? AWCDatePickerMotion.accelerate : selBloomCurve, reduceMotion: reduceMotion, anchor: .top,
                                                         values: { p in closing ? AWCDatePickerMotion.bloomOut(p) : AWCDatePickerMotion.bloomIn(p) }))
                    .allowsHitTesting(!closing)
                } else { bloomingCalendar(m, docked: false) }
            }
        }
        .padding(EdgeInsets(top: rt.inputMode && !docked ? m.insetXl : docked ? m.dockedTop : m.insetMd, leading: rt.inputMode && !docked ? m.insetXl : 12,
                            bottom: rt.inputMode && !docked ? m.insetSm : hasActionRow ? 0 : (docked ? Swift.max(0, m.dockedTop - m.insetSm) : m.dockedTop),
                            trailing: rt.inputMode && !docked ? m.insetXl : 12))
        .frame(width: panelWidth(m, docked: docked), alignment: .topLeading)
        .frame(minHeight: 0, maxHeight: .infinity, alignment: .top)
        .clipped()
        .awcInspect(nodeID: node.id, part: "body", name: "body")
    }

    // MARK: Nav (modal)
    @ViewBuilder func nav(_ m: AWCDatePickerMetrics) -> some View {
        let expanded = rt.viewMode == .year
        HStack(spacing: 0) {
            monthToggle(m, id: "-month-toggle", text: locale.format(AWCDay(year: rt.viewYear, month: rt.viewMonth, day: 1), skeleton: "yMMMM"), expanded: expanded,
                        ariaLabel: label("chooseMonthYearLabel", "Choose a different month and year"),
                        tip: locale.format(AWCDay(year: rt.viewYear, month: rt.viewMonth, day: 1), skeleton: "yMMMM") + " · " + label("chooseMonthAndYearLabel", "Choose month and year"), part: "month-toggle") { e in
                rt.pointerInput = e.activation?.source == .pointer
                if expanded { closeYearView() }
                else {
                    rt.calendarToken = nil; rt.yearClosing = false; rt.yearToken &+= 1
                    captureYearRange(); rt.yearFocus = nearestEnabledYear(rt.viewYear, 1); rt.yearScroll = nil; rt.viewMode = .year; emit("mdMenuOpen", ["type": "year"])
                }
            }
            Spacer(minLength: 0)
            if !expanded {
                HStack(spacing: m.gapXs) {
                    chevron("prev", "-prev", label("previousMonthLabel", "Previous month"), part: "prev-button", shortcut: "Page Up") { goToMonth(-1, source: "chevron-month") }
                    chevron("next", "-next", label("nextMonthLabel", "Next month"), part: "next-button", shortcut: "Page Down") { goToMonth(1, source: "chevron-month") }
                }
            }
        }
        .padding(.horizontal, m.insetXs)
        .frame(minHeight: 48)
        .awcInspect(nodeID: node.id, part: "nav", name: "nav")
        .padding(.bottom, m.insetXs)
    }
    @ViewBuilder func monthToggle(_ m: AWCDatePickerMetrics, id: String, text: String, expanded: Bool, ariaLabel: String, tip: String, part: String, action: @escaping (AWCEvent) -> Void) -> some View {
        // `.md-date-picker__menu-caret`: a fixed 20px trailing slot whose glyph follows density (max(16px, 20px + d)).
        let caret = AWCNode(id: node.id + id + "-caret", tag: "#symbol", properties: ["name": .string(expanded ? "arrow_drop_up" : "arrow_drop_down"), "size": .number(m.caret)],
                            slot: "trailing-icon")
        let btn = AWCNode(id: node.id + id, tag: "md-button",
                          properties: ["variant": "text", "size": "sm", "toggle": true, "selected": .bool(expanded),
                                       "suppressExpandIconFlip": true, "mirrorIcon": .bool(expanded), "ariaLabel": .string(ariaLabel), "ariaExpanded": .string(expanded ? "true" : "false")],
                          children: [.text(text), caret])
        child(btn) { e in if e.name == "mdClick" { action(e) } }
            .environment(\.awcTooltipDescription, tip)
            .awcButtonAppearance(AWCButtonAppearance(containerColor: expanded ? token("secondary-container", "#E8DEF8") : nil,
                                                     labelColor: expanded ? token("on-secondary-container", "#1D192B") : token("on-surface-variant", "#49454F"),
                                                     iconColor: expanded ? token("on-secondary-container", "#1D192B") : token("on-surface-variant", "#49454F"),
                                                     stateLayerColor: expanded ? token("on-secondary-container", "#1D192B") : token("on-surface-variant", "#49454F"),
                                                     iconSize: 20, trailingIconSize: 20, fontSize: m.menuFont, fontWeight: 500, lineHeight: m.menuLine, letterSpacing: 0.1, gap: 2))
            .fixedSize()
            .awcInspect(nodeID: node.id, part: part, name: part) { _ in ["label": .string(text), "expanded": .bool(expanded)] }
    }
    @ViewBuilder func chevron(_ side: String, _ id: String, _ aria: String, part: String, shortcut: String, enabled: Bool = true, action: @escaping () -> Void) -> some View {
        let btn = AWCNode(id: node.id + id, tag: "md-icon-button",
                          properties: ["size": "sm", "icon": .string(side == "prev" ? "chevron_left" : "chevron_right"), "ariaLabel": .string(aria), "disabled": .bool(!enabled)])
        child(btn) { e in if e.name == "mdClick" { action() } }
            .environment(\.awcTooltipDescription, "\(aria) (\(shortcut))")
            .scaleEffect(x: rtl ? -1 : 1, y: 1)
            .awcInspect(nodeID: node.id, part: part, name: part)
    }

    // MARK: Docked nav
    @ViewBuilder func dockedNav(_ m: AWCDatePickerMetrics) -> some View {
        let chevronSize = Swift.max(32, 40 + m.scale * 4)
        let first = AWCDay(year: rt.viewYear, month: rt.viewMonth, day: 1)
        HStack(spacing: m.gapLg) {
            HStack(spacing: m.gapXs) {
                chevronSlot("prev", "month", size: chevronSize, visible: !rt.yearMenuOpen) { goToMonth(-1, source: "chevron-month") }
                monthToggle(m, id: "-month-menu-button", text: locale.format(first, skeleton: "MMM"), expanded: rt.monthMenuOpen, ariaLabel: label("chooseMonthLabel", "Choose month"),
                            tip: locale.format(first, skeleton: "MMMM") + " · " + label("chooseMonthLabel", "Choose month") + " (Shift+M)", part: "month-menu-button") { e in toggleMenu(year: false, pointer: e.activation?.source == .pointer) }
                chevronSlot("next", "month", size: chevronSize, visible: !rt.yearMenuOpen) { goToMonth(1, source: "chevron-month") }
            }
            HStack(spacing: m.gapXs) {
                chevronSlot("prev", "year", size: chevronSize, visible: !rt.monthMenuOpen) { goToMonth(-12, source: "chevron-year") }
                monthToggle(m, id: "-year-menu-button", text: String(rt.viewYear), expanded: rt.yearMenuOpen, ariaLabel: label("chooseYearLabel", "Choose year"),
                            tip: label("chooseYearLabel", "Choose year") + " (Shift+Y)", part: "year-menu-button") { e in toggleMenu(year: true, pointer: e.activation?.source == .pointer) }
                chevronSlot("next", "year", size: chevronSize, visible: !rt.monthMenuOpen) { goToMonth(12, source: "chevron-year") }
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.bottom, 30)
        .awcInspect(nodeID: node.id, part: "nav", name: "nav")
    }
    @ViewBuilder func chevronSlot(_ side: String, _ scope: String, size: Double, visible: Bool, action: @escaping () -> Void) -> some View {
        let aria = side == "prev" ? (scope == "month" ? label("previousMonthLabel", "Previous month") : label("previousYearLabel", "Previous year"))
                                  : (scope == "month" ? label("nextMonthLabel", "Next month") : label("nextYearLabel", "Next year"))
        ZStack {
            chevron(side, "-\(side)-\(scope)", aria, part: "\(side)-\(scope)-button", shortcut: (scope == "month" ? "" : "Shift+") + (side == "prev" ? "Page Up" : "Page Down"), enabled: visible, action: action).opacity(visible ? 1 : 0)
        }
        .frame(width: size, height: size)
        .awcInspect(nodeID: node.id, part: "\(side)-\(scope)-chevron-slot", name: "\(side)-\(scope)-chevron-slot")
    }

    // MARK: Calendar
    /// The day grid returning after a docked pick or the year view (md-date-picker-docked-calendar-bloom-in 300ms).
    @ViewBuilder func bloomingCalendar(_ m: AWCDatePickerMetrics, docked: Bool) -> some View {
        calendar(m, docked: docked)
            .modifier(AWCDatePickerKeyframes(runtime: rt, key: "calendar", token: rt.calendarToken, duration: calBloomMs, curve: selBloomCurve,
                                             reduceMotion: reduceMotion, anchor: .top, values: { p in AWCDatePickerMotion.bloomIn(p, from: 0.92) }))
    }
    @ViewBuilder func calendar(_ m: AWCDatePickerMetrics, docked: Bool) -> some View {
        let cells = AWCDatePickerModel.monthMatrix(year: rt.viewYear, month: rt.viewMonth, firstDayOfWeek: firstDay)
        let names = locale.weekdays(first: firstDay, style: "narrow")
        let axOff = docked && (rt.monthMenuOpen || rt.yearMenuOpen)
        let gridName = locale.format(AWCDay(year: rt.viewYear, month: rt.viewMonth, day: 1), skeleton: "yMMMM")
        // The calendar clips (overflow hidden / auto): focusing the roving day scrolls it into view (nearest edge), as Chrome
        // does for the focused day of a panel shorter than its six weeks.
        let row = Double((cells.firstIndex { $0.day == rt.focused } ?? 0) / 7)
        let rowBottom = m.weekdaySize + m.insetLg + row * (m.daySize + m.gridGap) + m.daySize
        AWCDatePickerScrollClip(revealBottom: rowBottom, nodeID: node.id, axLayer: axLayer(cells, m, gridName: gridName, active: !axOff)) {
        VStack(spacing: 0) {
            AWCDatePickerGrid(columns: 7, columnGap: m.gridGap, rowGap: m.gridGap) {
                ForEach(Array(names.enumerated()), id: \.offset) { i, n in
                    AWCListText(text: n, size: m.weekdayFont, lineHeight: 24, weight: 400, tracking: 0.5, color: color(hook("weekday-color", "on-surface", "#1C1B1F")), alignment: .center)
                        .frame(width: m.daySize, height: m.weekdaySize)
                        .accessibilityHidden(true)
                        .awcInspect(nodeID: node.id, part: "weekday-\(i)", name: "weekday")
                }
            }
            .padding(.bottom, m.insetLg)
            .accessibilityHidden(true)   // story 1-5 a11y: Web role="row" aria-hidden="true"
            .awcInspect(nodeID: node.id, part: "weekdays", name: "weekdays")
            let gridWidth = panelWidth(m, docked: docked) - 24, slide = Double(rt.slideDirection) * (rtl ? -1 : 1)
            AWCDatePickerGrid(columns: 7, columnGap: m.gridGap, rowGap: m.gridGap, rowHeight: m.daySize) {
                ForEach(Array(cells.enumerated()), id: \.element.day) { i, cell in day(cell, m, index: i) }
            }
            .modifier(AWCDatePickerKeyframes(runtime: rt, key: "grid", token: rt.slideToken, duration: gridSlideMs, curve: AWCDatePickerMotion.emphasized,
                                             reduceMotion: reduceMotion, values: { p in [1, 1, 0, slide * gridWidth * (1 - p)] }))
            .environment(\.awcButtonFocusGroup, rt.dayFocus)
            .frame(height: m.gridHeight, alignment: .top)
            .modifier(AWCDatePickerGridAX(label: gridName, identifier: node.id + ".grid", active: !axOff))
            .awcInspect(nodeID: node.id, part: "grid", name: "grid")
        }
        .padding(.bottom, docked ? m.insetSm : 0)
        }
    }
    /// story 1-5 a11y: the weeks as AXRow elements named by their days' names (Web role="row"); macOS only (UIKit has no row
    /// element: the data table lists its cells).
    func axLayer(_ cells: [AWCDayCell], _ m: AWCDatePickerMetrics, gridName: String, active: Bool) -> ((Double, Double) -> AnyView)? {
        #if canImport(AppKit)
        guard active else { return nil }
        return { visible, scroll in
            let top = m.weekdaySize + m.insetLg - scroll, pitch = m.daySize + m.gridGap
            // The elements' frames are cropped to the calendar's visible part (the actions sit over a clipped sixth week): a control
            // belongs to the container its frame lies in, the days to their week by identity.
            func crop(_ t: Double, _ h: Double) -> (y: Double, h: Double) { let a = Swift.min(Swift.max(t, 0), visible), b = Swift.min(Swift.max(t + h, 0), visible); return (a, b - a) }
            let g = crop(top, m.gridHeight)
            return AnyView(ZStack(alignment: .topLeading) {
                Color.clear.frame(maxWidth: .infinity).frame(height: g.h).offset(y: g.y)
                    .background { AWCTableAXMarker(info: .init(kind: .table, label: gridName, identifier: node.id + ".grid", columnCount: 7)) }
                ForEach(0..<Swift.min(6, cells.count / 7), id: \.self) { r in
                    let c = crop(top + Double(r) * pitch, m.daySize), week = cells[(r * 7)..<(r * 7 + 7)]
                    Color.clear.frame(maxWidth: .infinity).frame(height: c.h).offset(y: c.y)
                        .background {
                            AWCTableAXMarker(info: .init(kind: .row, label: week.map { locale.format($0.day, skeleton: "yMMMMEEEEd") }.joined(separator: " "),
                                                         identifier: node.id + ".row\(r)", rowIndex: r, ownerID: node.id + ".grid", memberIDs: week.map { dayID($0.day) }))
                        }
                        .accessibilityHidden(true)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .allowsHitTesting(false))
        }
        #else
        return nil
        #endif
    }
    @ViewBuilder func day(_ cell: AWCDayCell, _ m: AWCDatePickerMetrics, index: Int) -> some View {
        let d = cell.day, disabled = isDisabled(d), isToday = d == today, selected = rt.pending == d
        let a = appearance
        let base = hook("day-color", "on-surface", "#1C1B1F")
        let labelHex: String = selected ? hook("day-selected-color", "on-primary", "#FFFFFF")
            : disabled ? AWCTableColor.hex(AWCTableColor.mix(base, 0.38, nil))
            : isToday ? hook("today-outline-color", "primary", "#6750A4")
            : cell.outOfMonth ? hook("day-outside-color", "on-surface-variant", "#49454F") : base
        let radius: Double? = isToday && !selected ? (a.length("day-today-shape") ?? m.daySize / 2) : selected ? a.length("day-selected-shape") : nil
        let btn = AWCNode(id: node.id + "-day-" + d.iso, tag: "md-button",
                          properties: ["variant": .string(selected ? "filled" : "text"), "size": "sm", "shape": "square", "selected": .bool(selected), "disabled": .bool(disabled),
                                       "roleOverride": "gridcell", "groupTabindex": .number(d == rt.focused ? 0 : -1), "ariaLabel": .string(locale.format(d, skeleton: "yMMMMEEEEd")),
                                       "ariaSelected": .string(selected ? "true" : "false")],
                          children: [.text(String(d.day))])
        child(btn) { e in if e.name == "mdClick" { rt.pointerInput = e.activation?.source == .pointer; select(d) } }
            .awcButtonAppearance(AWCButtonAppearance(containerColor: selected ? hook("day-selected-bg", "primary", "#6750A4") : "#00000000", labelColor: labelHex,
                                                     fontSize: m.dayFont, fontWeight: 400, lineHeight: 24, letterSpacing: 0.5, cornerRadius: radius, paddingInline: 0,
                                                     width: m.daySize, minWidth: m.daySize, height: m.daySize, focusRingOffset: -1))
            .overlay {
                if isToday && !selected {
                    RoundedRectangle(cornerRadius: radius ?? m.daySize / 2, style: .circular).inset(by: -0.5)
                        .stroke(color(hook("today-outline-color", "primary", "#6750A4")), lineWidth: 1).allowsHitTesting(false)
                }
            }
            .frame(width: m.daySize, height: m.daySize)
            #if canImport(UIKit)
            .background { AWCTableAXMarker(info: .init(kind: .cell, rowIndex: index / 7, columnIndex: index % 7)).allowsHitTesting(false).accessibilityHidden(true) }
            #endif
            .awcInspect(nodeID: node.id, part: "day-" + d.iso, name: "day") { _ in ["date": .string(d.iso), "selected": .bool(selected), "today": .bool(isToday), "disabled": .bool(disabled),
                                                                                    "outside": .bool(cell.outOfMonth), "label": .string(labelHex), "tabindex": .number(d == rt.focused ? 0 : -1)] }
    }

    // MARK: Year grid (modal)
    @ViewBuilder func yearGrid(_ m: AWCDatePickerMetrics) -> some View {
        let bounds = yearBounds
        let years = Array(bounds.min...Swift.max(bounds.min, bounds.max))
        let rows = (years.count + 2) / 3
        let top = rt.yearScroll ?? yearScrollTop(m, years: years, rows: rows)
        // Rows in the scroll viewport (± one row: the bloom's scale pulls a row in) render md-buttons.
        let pitch = m.yearHeight + m.yearGap
        let liveRows = Swift.max(0, Int(((top - 8) / pitch).rounded(.down)) - 1)...Swift.max(0, Int(((top + m.yearViewport - 8) / pitch).rounded(.up)) + 1)
        VStack(spacing: m.yearGap) {
            // Rows keyed by their first year: a re-rendered list never moves a focused cell to another year.
            ForEach(Array(stride(from: 0, to: years.count, by: 3)).map { years[$0] }, id: \.self) { firstYear in
                let r = (firstYear - years[0]) / 3
                HStack(spacing: 0) {
                    ForEach(0..<3, id: \.self) { c in
                        let i = r * 3 + c
                        if i < years.count { yearCell(years[i], m, live: liveRows.contains(r)).frame(maxWidth: .infinity, alignment: c == 0 ? .leading : c == 1 ? .center : .trailing) }
                        else { Color.clear.frame(maxWidth: .infinity, maxHeight: 1) }
                    }
                }
                .frame(height: m.yearHeight)
            }
        }
        .padding(EdgeInsets(top: 8, leading: m.yearPadInline, bottom: 16, trailing: m.yearPadInline))
        .environment(\.awcButtonFocusGroup, rt.yearFocusGroup)
        .awcInspect(nodeID: node.id, part: "year-grid", name: "year-grid") { _ in ["scrollTop": .number(top)] }
        .offset(y: -top)
        .frame(height: m.yearViewport, alignment: .top)
        .clipped()
        .awcInspect(nodeID: node.id, part: "year-grid-scroll", name: "year-grid-scroll")
        // `overflow-y: auto`: the wheel (AppKit) or a touch drag (UIKit; a drag is not a pick) scrolls the years; keys keep
        // revealing the roving year.
        .background { let _ = { rt.yearWheel = { [self] d in scrollYears(to: (rt.yearScroll ?? top) + d, m, rows: rows) } }()
                      AWCTabsWheel(enabled: !rt.yearClosing) { [rt] d in rt.yearWheel(d) } }
        #if canImport(UIKit)
        .simultaneousGesture(DragGesture(minimumDistance: 10).onChanged { v in
            let start = rt.yearDragStart ?? top; rt.yearDragStart = start; rt.yearDragging = true
            scrollYears(to: start - Double(v.translation.height), m, rows: rows)
        }.onEnded { _ in
            rt.yearDragStart = nil
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) { [rt] in rt.yearDragging = false }
        })
        #endif
        // The wrap shrinks with the body (flex 1 1 auto, min-block-size 0, overflow hidden) and spans the body's padding.
        .frame(minHeight: 0, maxHeight: .infinity, alignment: .top)
        .clipped()
        .awcInspect(nodeID: node.id, part: "year-grid-wrap", name: "year-grid-wrap")
        .padding(.horizontal, -12)
    }
    /// A user scroll of the year grid, clamped to its content.
    func scrollYears(to target: Double, _ m: AWCDatePickerMetrics, rows: Int) {
        let n = Double(rows), content: Double = 8 + n * m.yearHeight + Swift.max(0, n - 1) * m.yearGap + 16
        let next = Swift.max(0, Swift.min(target, Swift.max(0, content - m.yearViewport)))
        if rt.yearScroll != next { rt.yearScroll = next }
    }
    /// The selected year is scrolled to the viewport's centre (scrollIntoView block: center over the real geometry; the source's
    /// calculateModalYearGridScrollTop uses the default sizes, which give the same offset without hooks).
    func yearScrollTop(_ m: AWCDatePickerMetrics, years: [Int], rows: Int) -> Double {
        let index = Swift.max(0, Swift.min(rt.viewYear - (years.first ?? rt.viewYear), years.count - 1))
        let row = Double(index / 3), n = Double(rows)
        let content: Double = 8 + n * m.yearHeight + Swift.max(0, n - 1) * m.yearGap + 16
        let target: Double = 8 + row * (m.yearHeight + m.yearGap) + m.yearHeight / 2 - m.yearViewport / 2
        return Swift.max(0, Swift.min(target, Swift.max(0, content - m.yearViewport)))
    }
    @ViewBuilder func yearCell(_ y: Int, _ m: AWCDatePickerMetrics, live: Bool = true) -> some View {
        let selected = y == rt.viewYear
        let minY = AWCDay.iso(s("min"))?.year, maxY = AWCDay.iso(s("max"))?.year
        let disabled = (minY.map { y < $0 } ?? false) || (maxY.map { y > $0 } ?? false)
        let base = hook("day-color", "on-surface", "#1C1B1F")
        let labelHex = selected ? hook("day-selected-color", "on-primary", "#FFFFFF") : disabled ? AWCTableColor.hex(AWCTableColor.mix(base, 0.38, nil)) : base
        let _ = { rt.cells.child = child; rt.cells.selectYear = { [self] y, pointer in if pointer && rt.yearDragging { return }; rt.pointerInput = pointer; selectYear(y) } }()
        AWCDatePickerYearCell(nodeID: node.id, year: y, selected: selected, disabled: disabled, tabStop: y == yearFocusTarget,
                              container: selected ? hook("day-selected-bg", "primary", "#6750A4") : "#00000000", label: labelHex,
                              radius: selected ? appearance.length("day-selected-shape") : nil, font: m.dayFont, width: m.yearWidth, height: m.yearHeight,
                              live: live || y == yearFocusTarget, actions: rt.cells)
            .equatable()
    }
    /// closeYearViewAnimated: the grid blooms out (200ms), then the day grid blooms in; `then` runs when the calendar shows.
    func closeYearView(then: @escaping () -> Void = {}) {
        guard rt.viewMode == .year, !rt.yearClosing else { return }
        if reduceMotion { rt.viewMode = .calendar; rt.yearFocus = nil; rt.yearRange = nil; then(); return }
        rt.yearClosing = true
        let runtime = rt
        Task { @MainActor in
            await runtime.finishRun("yearWrap", -runtime.yearToken, 200)
            guard AWCDatePickerRuntime.mounted[node.id] === runtime, runtime.yearClosing else { return }
            runtime.yearClosing = false; runtime.viewMode = .calendar; runtime.yearFocus = nil; runtime.yearRange = nil; runtime.calendarToken = runtime.nextRun()
            then()
        }
    }
    func selectYear(_ y: Int) {
        guard !isDisabledYear(y) else { return }
        // The picked cell unmounts with the grid: focus lands on the day grid when it was in the grid (source selectYear).
        let inGrid = rt.focusedControl?.hasPrefix(node.id + "-year-") ?? false
        rt.viewYear = y; rt.focused = AWCDay(year: y, month: rt.viewMonth, day: 1); rt.yearFocus = nil
        emit("mdMenuSelect", ["type": "year", "value": .number(Double(y)), "label": .string(String(y))])
        emit("mdViewChange", ["month": .number(Double(rt.viewMonth - 1)), "year": .number(Double(y)), "source": "year-menu"])
        closeYearView { if inGrid { focusDay() } }
    }

    // MARK: Entry (modal input mode)
    @ViewBuilder func entry(_ m: AWCDatePickerMetrics) -> some View {
        let showError = b("error") || !rt.validationMessage.isEmpty
        let field = AWCNode(id: node.id + "-entry", tag: "md-text-field",
                            properties: ["variant": "outlined", "label": .string(label("label", "Date")), "placeholder": .string(s("placeholder").isEmpty ? locale.pattern(separator: s("dateSeparator")) : s("placeholder")),
                                         "value": .string(rt.entryDraft), "error": .bool(showError), "errorText": .string(s("errorText").isEmpty ? rt.validationMessage : s("errorText")),
                                         "reserveSupportingSpace": .bool(b("reserveSupportingSpace"))])
        // An embedded md-text-field (as md-number-field's): its Enter reaches the picker first (tryCommitDialogInputOnEnter).
        AWCNativeTextField(node: field, theme: theme, value: rt.entryDraft, setValue: { raw in rt.entryDraft = raw },
                           emit: { name, detail in if name == "mdInput" { emit("mdInput", ["value": detail]) } },
                           leading: [], trailing: [], chips: [], clearIcon: [], passwordIcon: [], speechIcon: [], errorIcon: [],
                           child: { child($0, nil) }, hooks: entryHooks())
        .environment(\.awcFieldFocusTarget, entryTarget)
        .environment(\.awcInspectionAlias, AWCInspectionAlias(childID: node.id + "-entry", parentID: node.id, part: "entry-field"))
        .frame(maxWidth: .infinity)
        .awcInspect(nodeID: node.id, part: "entry-input", name: "entry-input")
        .awcInspect(nodeID: node.id, part: "entry", name: "entry")
    }

    // MARK: Actions
    @ViewBuilder func actions(_ m: AWCDatePickerMetrics) -> some View {
        let slotted = node.children(inSlot: "actions")
        HStack(spacing: m.gapSm) {
            Spacer(minLength: 0)
            if !slotted.isEmpty { ForEach(slotted) { child($0, nil) } }
            else {
                actionButton("-cancel", label("cancelLabel", "Cancel"), part: "cancel-button") { cancel() }
                actionButton("-ok", label("okLabel", "OK"), part: "ok-button") {
                    if rt.inputMode { entryCommit(); if !rt.validationMessage.isEmpty { return } }
                    commit()
                }
            }
        }
        .frame(minHeight: m.actionsMin)
        .padding(EdgeInsets(top: m.insetSm, leading: 12, bottom: m.insetMd, trailing: 12))
        .awcInspect(nodeID: node.id, part: "actions", name: "actions")
    }
    @ViewBuilder func actionButton(_ id: String, _ text: String, part: String, action: @escaping () -> Void) -> some View {
        let btn = AWCNode(id: node.id + id, tag: "md-button", properties: ["variant": "text", "size": "sm"], children: [.text(text)])
        child(btn) { e in if e.name == "mdClick" { action() } }
            .awcButtonAppearance(AWCButtonAppearance(labelColor: hook("action-color", "primary", "#6750A4")))
            .fixedSize()
            .awcInspect(nodeID: node.id, part: part, name: part)
    }
    func entryHooks() -> AWCFieldHooks {
        var hooks = AWCFieldHooks()
        hooks.key = { key, composing in
            guard !composing, key == "Enter" else { return false }
            entryEnter(); return true
        }
        return hooks
    }
    /// A valid typed date commits and closes; an invalid one shows the error and keeps the dialog open.
    func entryEnter() {
        entryCommit()
        guard rt.validationMessage.isEmpty, rt.pending != nil else { return }
        commit()
    }
    func entryCommit() {
        let text = rt.entryDraft.trimmingCharacters(in: .whitespaces)
        guard !text.isEmpty else { rt.validationMessage = ""; return }
        guard let d = AWCDatePickerModel.parse(text, locale: locale, separator: s("dateSeparator")), !isDisabled(d) else {
            rt.validationMessage = label("invalidDateLabel", "Invalid date"); return
        }
        rt.validationMessage = ""; rt.pending = d
    }

    // MARK: Docked month / year lists
    /// The inline baseline md-menu of the docked panel (radio items, check at the start). Decision 3: the list scrolls inside
    /// the panel (the source lets it overflow the panel and scroll the page, D4), with the selected entry in view.
    @ViewBuilder func selectionMenu(_ m: AWCDatePickerMetrics, year: Bool) -> some View {
        let bounds = yearBounds
        let entries: [(id: Int, text: String)] = year ? (bounds.min...Swift.max(bounds.min, bounds.max)).map { ($0, String($0)) }
            : (1...12).map { ($0, locale.format(AWCDay(year: 2024, month: $0, day: 1), skeleton: "MMMM")) }
        let current = year ? rt.viewYear : rt.viewMonth
        let _ = { rt.cells.pick = { [self] year, n, pointer in rt.pointerInput = pointer; year ? pickYear(n) : pickMonth(n) } }()
        // The year list (201 entries): native rows near the visible part (from the first visible entry), the selected and
        // focused entries (± 3) and both ends (Home / End); the rest draw the same row without the native control.
        let topIndex = menuTop.flatMap { id in entries.firstIndex { $0.id == id } } ?? Swift.max(0, (entries.firstIndex { $0.id == current } ?? 0) - 4)
        let optionPrefix = node.id + (year ? "-year-option-" : "-month-option-")
        let focusedN: Int? = rt.focusedControl.flatMap { f in f.hasPrefix(optionPrefix) ? Int(f.dropFirst(optionPrefix.count)) : nil }
        let liveRange = (topIndex - 6)...(topIndex + 20)
        ScrollViewReader { proxy in
            ScrollView(.vertical) {
                VStack(spacing: 0) {
                    ForEach(Array(entries.enumerated()), id: \.element.id) { i, e in
                        let selected = e.id == current, rowID = menuRowID(year: year, e.id)
                        let live = !year || liveRange.contains(i) || selected || i == 0 || i == entries.count - 1 || focusedN.map { abs($0 - e.id) <= 3 } == true
                        // md-menu-item (radio, check at the start): a focusable entry roving on ArrowUp / ArrowDown / Home / End;
                        // :focus-visible paints the 12% on-surface layer and the 3px secondary outline inset by 3px. Equatable: a
                        // pick re-renders the two entries whose selection moved.
                        AWCDatePickerMenuRow(id: rowID, n: e.id, text: e.text, year: year, selected: selected, rtl: rtl,
                                             background: selected ? token("secondary-container", "#E8DEF8") : "#00000000", ink: token("on-surface", "#1C1B1F"),
                                             ring: token("secondary", "#625B71"), font: m.dayFont, inset: m.insetLg, gap: m.gapLg, live: live, actions: rt.cells)
                            .equatable()
                        .id(e.id)
                        .awcInspect(nodeID: node.id, part: (year ? "year-option-" : "month-option-") + String(e.id), name: year ? "year-option" : "month-option") { _ in ["selected": .bool(selected)] }
                    }
                }
                .environment(\.awcButtonFocusGroup, rt.menuFocusGroup)
                .scrollTargetLayout()
            }
            .scrollPosition(id: $menuTop)
            .onAppear {
                rt.menuFocusGroup.vertical = true
                rt.menuFocusGroup.configure(items: entries.map { AWCButtonFocusItem(id: menuRowID(year: year, $0.id), selected: $0.id == current) })
                proxy.scrollTo(current, anchor: .center)
                rt.revealMenuEntry = { n in proxy.scrollTo(n) }
            }
            // Keyboard focus keeps the focused entry in view (the source's focus scroll).
            .onChange(of: rt.focusedControl) { _, id in
                let prefix = node.id + (year ? "-year-option-" : "-month-option-")
                if let id, id.hasPrefix(prefix), let n = Int(id.dropFirst(prefix.count)) { proxy.scrollTo(n) }
            }
        }
        .frame(minHeight: 0, maxHeight: .infinity)
        .background(color(hook("menu-color", "surface-container-high", "#ECE6F0")))
        .clipShape(UnevenRoundedRectangle(bottomLeadingRadius: 16, bottomTrailingRadius: 16))
        .awcInspect(nodeID: node.id, part: year ? "year-menu" : "month-menu", name: year ? "year-menu" : "month-menu")
    }
    func menuRowID(year: Bool, _ n: Int) -> String { node.id + (year ? "-year-option-" : "-month-option-") + String(n) }
    /// toggleMonthMenu / toggleYearMenu: opening one closes the other; closing by the toggle returns focus to it.
    func toggleMenu(year: Bool, pointer: Bool) {
        rt.pointerInput = pointer
        let opening = year ? !rt.yearMenuOpen : !rt.monthMenuOpen
        if opening {
            rt.calendarToken = nil; rt.menuClosing = false; rt.menuToken &+= 1; menuTop = nil
            rt.yearRange = nil; if year { captureYearRange() }
            rt.monthMenuOpen = !year; rt.yearMenuOpen = year
            emit("mdMenuOpen", ["type": .string(year ? "year" : "month")])
        } else { closeMenus(restoreFocus: true) }
    }
    /// closeMenus(null, restoreFocus): Escape in an open docked menu.
    /// closeDockedSelectionMenu: the list blooms out (200ms), the day grid blooms in; focus returns to the menu button
    /// (`restoreFocus`) or to the roving day (decision 6). `then` runs once the list is gone.
    func closeMenus(restoreFocus: Bool, then: @escaping () -> Void = {}) {
        guard rt.monthMenuOpen || rt.yearMenuOpen, !rt.menuClosing else { return }
        let year = rt.yearMenuOpen, runtime = rt
        let finish = { [self] in
            runtime.monthMenuOpen = false; runtime.yearMenuOpen = false; runtime.menuClosing = false; runtime.yearRange = nil; runtime.preloadCalendar = false
            if !reduceMotion { runtime.calendarToken = runtime.nextRun() }
            // A pick: focusFocusedDay — the roving day when the new view shows it; otherwise the removed entry's focus leaves the
            // picker (Chrome: the body, D8).
            if restoreFocus { let id = node.id + (year ? "-year-menu-button" : "-month-menu-button"); focusSoon { runtime.panelFocus.focus(id) } }
            else if runtime.focused.year == runtime.viewYear && runtime.focused.month == runtime.viewMonth { focusDay() } else { dropFocus() }
            then()
        }
        if reduceMotion { finish(); return }
        rt.menuClosing = true
        Task { @MainActor in
            let key = year ? "yearMenu" : "monthMenu", token = -runtime.menuToken
            // Once the exit's first frame is out, the day grid mounts under the list (see the docked body).
            for _ in 0..<50 { if runtime.animations[key]?.token == token { break }; try? await Task.sleep(nanoseconds: 4_000_000) }
            try? await Task.sleep(nanoseconds: 8_000_000)
            if runtime.menuClosing, AWCDatePickerRuntime.mounted[node.id] === runtime { runtime.preloadCalendar = true }
            await runtime.finishRun(key, token, 200)
            guard AWCDatePickerRuntime.mounted[node.id] === runtime, runtime.menuClosing else { return }
            finish()
        }
    }
    /// pickMonth / pickYear: the view changes (the roving day does not); focus returns to the day grid's roving day (decision 6).
    /// pickDockedSelection: the picked entry's ripple settles first (waitForHostRipple: md-ripple's whenSettled is bounded at 200ms
    /// after the click; a 150ms release beat under reduced motion).
    func afterRipple(_ body: @escaping () -> Void) {
        let runtime = rt, due = CACurrentMediaTime() + (reduceMotion ? 0.15 : 0.2)
        runtime.pickPending = true
        Task { @MainActor in
            // From the click, whatever the update that mounts the day grid takes.
            try? await Task.sleep(nanoseconds: UInt64(Swift.max(0, due - CACurrentMediaTime()) * 1e9))
            runtime.pickPending = false
            guard AWCDatePickerRuntime.mounted[node.id] === runtime, runtime.isOpen else { return }
            body()
        }
    }
    func pickMonth(_ month: Int) {
        guard !rt.menuClosing, !rt.pickPending else { return }
        afterRipple { applyMonth(month) }
    }
    func pickYear(_ year: Int) {
        guard !rt.menuClosing, !rt.pickPending else { return }
        afterRipple { applyYear(year) }
    }
    func applyMonth(_ month: Int) {
        rt.viewMonth = month
        emit("mdMenuSelect", ["type": "month", "value": .number(Double(month - 1)), "label": .string(locale.format(AWCDay(year: 2024, month: month, day: 1), skeleton: "MMMM"))])
        emit("mdViewChange", ["month": .number(Double(month - 1)), "year": .number(Double(rt.viewYear)), "source": "month-menu"])
        closeMenus(restoreFocus: false)
    }
    func applyYear(_ year: Int) {
        rt.viewYear = year
        emit("mdMenuSelect", ["type": "year", "value": .number(Double(year)), "label": .string(String(year))])
        emit("mdViewChange", ["month": .number(Double(rt.viewMonth - 1)), "year": .number(Double(year)), "source": "year-menu"])
        closeMenus(restoreFocus: false)
    }

    // MARK: Keyboard and focus
    func dayID(_ d: AWCDay) -> String { node.id + "-day-" + d.iso }
    var focusInside: Bool { rt.focusedControl != nil || (rt.fieldTarget?.isFocused() ?? false) || (rt.entryTarget?.isFocused() ?? false) }
    /// A focus request once its target has rendered (the source waits two animation frames), retried for ~1 s; the ring
    /// shows unless the last input was a pointer press. A newer request supersedes it.
    func focusSoon(whileOpen: Bool = true, _ request: @escaping () -> Bool) {
        let ring = !rt.pointerInput
        rt.focusGeneration &+= 1
        let generation = rt.focusGeneration, runtime = rt
        Task { @MainActor in
            for attempt in 0..<40 {
                try? await Task.sleep(nanoseconds: attempt == 0 ? 16_000_000 : 25_000_000)
                guard runtime.focusGeneration == generation, runtime.isOpen || !whileOpen else { return }
                AWCNativeFocusRequest.indicator = ring
                let done = request()
                AWCNativeFocusRequest.indicator = nil
                if done { return }
            }
        }
    }
    func focusDay() { let id = dayID(rt.focused); focusSoon { [rt] in rt.dayFocus.focus(id) } }
    /// A press that leaves the picker (a non-dismissing scrim): Chrome moves focus to the body, so later keys miss the picker.
    func dropFocus() {
        rt.focusGeneration &+= 1
        #if canImport(AppKit)
        for w in NSApp.windows where (w.firstResponder as? AWCNativeButtonFocusView)?.configuration?.id.hasPrefix(node.id + "-") == true { _ = w.makeFirstResponder(nil) }
        #else
        UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
        #endif
        rt.focusedControl = nil
    }
    /// A press outside the docked field and panel (the source's document pointerdown listener).
    func outsidePress() {
        guard rt.isOpen, docked else { return }
        if b("outsideClickDismissible", true) { cancel() } else { dropFocus() }
    }
    func escapeKey() {
        if docked && (rt.monthMenuOpen || rt.yearMenuOpen) { closeMenus(restoreFocus: true) } else { cancel() }
    }
    /// routePickerKeyDown / onPanelKeyDown for a key at the picker control `id`: Escape, Shift+M / Shift+Y (docked), the year
    /// grid's keys, then the calendar keys (canHandleCalendarKeyDown / handleCalendarKeyDown). Unhandled keys reach the control.
    func pickerKey(_ id: String, _ k: AWCCompositeKey) -> Bool {
        guard rt.isOpen, !rt.closing else { return false }
        rt.pointerInput = false
        if k.key == "Escape" { escapeKey(); return true }
        let menuOpen = rt.monthMenuOpen || rt.yearMenuOpen
        if docked && k.shift && !k.control && !k.meta && !k.alt && ["m", "y"].contains(k.key.lowercased()) && rt.viewMode == .calendar && !rt.inputMode {
            toggleMenu(year: k.key.lowercased() == "y", pointer: false); return true
        }
        if rt.viewMode == .year { return id.hasPrefix(node.id + "-year-") && yearKey(k) }
        guard !rt.inputMode, !menuOpen, !id.hasPrefix(node.id + "-month-option-"), !id.hasPrefix(node.id + "-year-option-") else { return false }
        // resolveNavigationKey: Alt+ArrowUp / Alt+ArrowDown are Page Up / Page Down (compact Mac keyboards).
        var key = k.key
        if k.alt && !k.shift && !k.control && !k.meta { key = key == "ArrowUp" ? "PageUp" : key == "ArrowDown" ? "PageDown" : key }
        let f = rt.focused, inline = rtl ? -1 : 1, onDay = id.hasPrefix(node.id + "-day-")
        let next: AWCDay
        switch key {
        case "ArrowRight": next = f.adding(days: inline)
        case "ArrowLeft": next = f.adding(days: -inline)
        case "ArrowDown": next = f.adding(days: 7)
        case "ArrowUp": next = f.adding(days: -7)
        case "Home": next = AWCDay(year: f.year, month: f.month, day: 1)
        case "End": next = AWCDay(year: f.year, month: f.month, day: AWCDay.daysIn(f.year, f.month))
        case "PageUp": next = f.adding(months: k.shift ? -12 : -1)
        case "PageDown": next = f.adding(months: k.shift ? 12 : 1)
        case "Enter":
            guard onDay else { return false }
            if !isDisabled(f) { select(f); if rt.isOpen { commit() } }
            return true
        case "Space", " ":
            guard onDay else { return false }
            select(f); return true
        default: return false
        }
        rt.focused = AWCDatePickerModel.clamp(next, min: s("min"), max: s("max"))
        if (key == "PageUp" || key == "PageDown") && (rt.focused.year != rt.viewYear || rt.focused.month != rt.viewMonth) { slideGrid(key == "PageDown" ? 1 : -1) }
        rt.viewYear = rt.focused.year; rt.viewMonth = rt.focused.month
        focusDay()
        return true
    }
    var yearBounds: (min: Int, max: Int) {
        if let r = rt.yearRange { return (r.lowerBound, r.upperBound) }
        return (AWCDay.iso(s("min"))?.year ?? rt.viewYear - 100, AWCDay.iso(s("max"))?.year ?? rt.viewYear + 100)
    }
    func captureYearRange() { let b = yearBounds; rt.yearRange = b.min...Swift.max(b.min, b.max) }
    func isDisabledYear(_ y: Int) -> Bool { (AWCDay.iso(s("min")).map { y < $0.year } ?? false) || (AWCDay.iso(s("max")).map { y > $0.year } ?? false) }
    func nearestEnabledYear(_ from: Int, _ step: Int) -> Int {
        let b = yearBounds, start = Swift.max(b.min, Swift.min(b.max, from))
        for dir in [step, -step] {
            var y = start
            while y >= b.min && y <= b.max { if !isDisabledYear(y) { return y }; y += dir }
        }
        return start
    }
    var yearFocusTarget: Int { rt.yearFocus ?? nearestEnabledYear(rt.viewYear, 1) }
    /// handleYearGridKeyDown: three years a row (horizontal arrows mirrored in RTL), Page ± 18, Home / End the row's ends
    /// (Control: the list's), disabled years skipped; Enter / Space reach the focused cell (selectYear).
    func yearKey(_ k: AWCCompositeKey) -> Bool {
        if k.alt || k.meta { return false }
        let b = yearBounds, current = yearFocusTarget, inline = rtl ? -1 : 1
        let rowStart = b.min + ((current - b.min) / 3) * 3
        let target: Int, step: Int
        switch k.key {
        case "ArrowRight": target = current + inline; step = inline
        case "ArrowLeft": target = current - inline; step = -inline
        case "ArrowDown": target = current + 3; step = 1
        case "ArrowUp": target = current - 3; step = -1
        case "PageDown": target = current + 18; step = 1
        case "PageUp": target = current - 18; step = -1
        case "Home": target = k.control ? b.min : rowStart; step = 1
        case "End": target = k.control ? b.max : Swift.min(b.max, rowStart + 2); step = -1
        default: return false
        }
        if k.key.hasPrefix("Arrow") && (target < b.min || target > b.max) { return true }
        let next = nearestEnabledYear(target, step)
        if isDisabledYear(next) { return true }
        rt.yearFocus = next; revealYear(next)
        let id = node.id + "-year-\(next)"
        focusSoon { [rt] in rt.yearFocusGroup.focus(id) }
        return true
    }
    /// focusYearCell('move'): scroll only as far as needed to show the cell in the 288px scroll viewport.
    func revealYear(_ y: Int) {
        let m = metrics, b = yearBounds, years = Array(b.min...Swift.max(b.min, b.max)), rows = (years.count + 2) / 3
        let current = rt.yearScroll ?? yearScrollTop(m, years: years, rows: rows)
        let row = Double((y - b.min) / 3), top = 8 + row * (m.yearHeight + m.yearGap), bottom = top + m.yearHeight
        let content = 8 + Double(rows) * m.yearHeight + Double(Swift.max(0, rows - 1)) * m.yearGap + 16
        var next = current
        if top < current { next = top } else if bottom > current + m.yearViewport { next = bottom - m.yearViewport }
        rt.yearScroll = Swift.max(0, Swift.min(next, Swift.max(0, content - m.yearViewport)))
    }
    /// trapTab: Tab / Shift+Tab cycle the modal panel's tab stops in document order.
    func tabTrap(_ backward: Bool) -> Bool {
        guard rt.isOpen, !docked else { return false }
        var ids: [String] = [], requests: [() -> Bool] = []
        let p = rt.panelFocus
        func add(_ id: String, _ request: @escaping () -> Bool) { ids.append(id); requests.append(request) }
        func control(_ suffix: String) { let id = node.id + suffix; add(id) { p.focus(id) } }
        if node.children(inSlot: "header").isEmpty { control("-mode-toggle") }
        if rt.inputMode { add(node.id + "-entry") { [rt] in rt.entryTarget?.focus() ?? false } }
        else {
            control("-month-toggle")
            if rt.viewMode == .calendar {
                control("-prev"); control("-next")
                let day = dayID(rt.focused); add(day) { [rt] in rt.dayFocus.focus(day) }
            } else { let year = node.id + "-year-\(yearFocusTarget)"; add(year) { [rt] in rt.yearFocusGroup.focus(year) } }
        }
        if hasActionRow && node.children(inSlot: "actions").isEmpty { control("-cancel"); control("-ok") }
        let n = ids.count
        guard n > 0 else { return false }
        let current = rt.focusedControl ?? ((rt.entryTarget?.isFocused() ?? false) ? node.id + "-entry" : nil)
        var j = current.flatMap { ids.firstIndex(of: $0) }.map { backward ? ($0 + n - 1) % n : ($0 + 1) % n } ?? (backward ? n - 1 : 0)
        rt.pointerInput = false; rt.focusGeneration &+= 1
        AWCNativeFocusRequest.indicator = true
        defer { AWCNativeFocusRequest.indicator = nil }
        for _ in 0..<n { if requests[j]() { return true }; j = backward ? (j + n - 1) % n : (j + 1) % n }
        return true
    }

    // MARK: Docked panel
    /// The window's content size (the modal scope's viewport when there is one).
    var windowSize: CGSize {
        if let v = session?.viewport, v.width > 0 { return v }
        #if canImport(AppKit)
        if let w = NSApplication.shared.keyWindow ?? NSApplication.shared.windows.first { return w.contentLayoutRect.size }
        #else
        if let w = UIApplication.shared.connectedScenes.compactMap({ $0 as? UIWindowScene }).first?.windows.first { return w.bounds.size }
        #endif
        return CGSize(width: 100_000, height: 100_000)
    }
    /// md-date-picker.tsx positionDockedPanel (16px viewport margin, 4px gap).
    func positionDocked(_ m: AWCDatePickerMetrics) {
        guard docked && rt.isOpen, rt.dockedPanelHeight > 0 else { return }
        let a = rt.anchorFrame, vw = Double(windowSize.width), vh = Double(windowSize.height), margin = 16.0, gap = 4.0
        let w = panelWidth(m, docked: true), h = rt.dockedPanelHeight
        func projected(_ end: Bool) -> (left: Double, right: Double) {
            let start = !end
            if start { return rtl ? (Double(a.maxX) - w, Double(a.maxX)) : (Double(a.minX), Double(a.minX) + w) }
            return rtl ? (Double(a.minX), Double(a.minX) + w) : (Double(a.maxX) - w, Double(a.maxX))
        }
        var end = false
        if projected(false).right > vw - margin, projected(true).left >= margin { end = true }
        let active = projected(end)
        if active.left < margin { if projected(true).left >= margin { end = true } }
        else if end, projected(true).left < margin, projected(false).right <= vw - margin { end = false }
        var above = false, maxBlock: Double? = nil
        if Double(a.maxY) + gap + h > vh - margin {
            if Double(a.minY) - gap - h >= margin { above = true }
            else { let available = vh - margin - Double(a.maxY) - gap; if available > 0 { maxBlock = available.rounded(.down) } }
        }
        if above { let available = Double(a.minY) - gap - margin; if available > 0 && h > available { maxBlock = available.rounded(.down) } }
        if rt.dockedEnd != end { rt.dockedEnd = end }
        if rt.dockedAbove != above { rt.dockedAbove = above }
        if rt.dockedMaxBlock != maxBlock { rt.dockedMaxBlock = maxBlock }
    }
    @ViewBuilder func dockedPanel(_ m: AWCDatePickerMetrics) -> some View {
        let closing = rt.panelClosing, end = rt.dockedEnd != rtl
        let anchor: UnitPoint = rt.dockedAbove && !closing ? (end ? .bottomTrailing : .bottomLeading) : (end ? .topTrailing : .topLeading)
        panel(m, docked: true)
            .modifier(AWCDatePickerKeyframes(runtime: rt, key: "panel", token: closing ? -rt.openToken : rt.openToken, duration: closing ? panelOutMs : selBloomMs,
                                             curve: closing ? AWCDatePickerMotion.accelerate : selBloomCurve, reduceMotion: reduceMotion, anchor: anchor,
                                             values: { p in closing ? AWCDatePickerMotion.bloomOut(p) : AWCDatePickerMotion.bloomIn(p) }))
        .allowsHitTesting(!closing)
            .environment(\.layoutDirection, direction)
            .background(AWCColorPickerOutsidePressRegion(owner: rt))
            .onGeometryChange(for: CGRect.self) { $0.frame(in: .named("awc-native-preview")) } action: { AWCColorPickerPreviewRegions.set($0, "panel", owner: ObjectIdentifier(rt)) }
    }
}

extension AWCNativeView {
    var nativeDatePicker: some View {
        AWCNativeDatePicker(node: node, theme: theme, props: local, setProperty: { k, v in set(k, v) }, emit: { emit($0, $1) },
                            child: { n, h in child(n, handler: h ?? onEvent) }, forward: onEvent)
    }
}
