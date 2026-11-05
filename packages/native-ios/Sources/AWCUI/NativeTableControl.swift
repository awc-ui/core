import SwiftUI
import QuartzCore

// md-table family public methods on native: md-table (getSelection, selectAll, deselectAll, toggleSelectAll, setSort,
// pinColumn, setColumnVisibility, animateNextChange), md-table-row (toggle) and md-table-pagination (goToPage,
// setRowsPerPage). Controllers attach by node id, like AWCListController.

/// The live table a controller drives (closures refreshed on every render, so they see the current rows).
final class AWCTableHandle {
    var getSelection: () -> AWCValue = { .null }
    var selectAll: (Bool) -> Void = { _ in }
    var toggleSelectAll: () -> Void = {}
    var setSort: (String, String) -> Void = { _, _ in }
    var pinColumn: (Int, String) -> String? = { _, _ in nil }
    var setColumnVisibility: (Int, Bool) -> Bool = { _, _ in true }
    var animateNextChange: () -> Void = {}
    var toggleRow: (String) -> Void = { _ in }
}

/// Native counterpart of md-table's methods.
public final class AWCTableController {
    var handle: AWCTableHandle?
    public init() {}
    public var isConnected: Bool { handle != nil }
    /// `getSelection()`: { count, total, values, all, indeterminate }.
    public func getSelection() -> AWCValue { handle?.getSelection() ?? .null }
    /// Selects every enabled, selectable body row (multiple selection only).
    public func selectAll() { handle?.selectAll(true) }
    public func deselectAll() { handle?.selectAll(false) }
    public func toggleSelectAll() { handle?.toggleSelectAll() }
    /// Sets the sort state and emits `mdSortChange` (the consumer reorders the rows).
    public func setSort(_ column: String, _ order: String) { handle?.setSort(column, order) }
    /// Pins the ORIGINAL column `column` to `start` / `end` (`none` unpins; the same side toggles off); returns the
    /// effective side, or nil when the table cannot pin (no explicit template, colspans, uneven rows).
    @discardableResult public func pinColumn(_ column: Int, _ side: String) -> String? { handle?.pinColumn(column, side) ?? nil }
    /// Hides / shows the ORIGINAL column `column`; the last visible column stays. Returns the effective visibility.
    @discardableResult public func setColumnVisibility(_ column: Int, _ visible: Bool) -> Bool { handle?.setColumnVisibility(column, visible) ?? true }
    /// Glides the rows through the next order change (FLIP), as sort and pagination events do.
    public func animateNextChange() { handle?.animateNextChange() }
    /// md-table-row `toggle()` for the row with node id `row`.
    public func toggleRow(_ row: String) { handle?.toggleRow(row) }
}

final class AWCTablePaginationHandle {
    var goToPage: (Int) -> Void = { _ in }
    var setRowsPerPage: (Int) -> Void = { _ in }
    var state: () -> (page: Int, rowsPerPage: Int) = { (0, 10) }
}
/// Native counterpart of md-table-pagination's methods.
public final class AWCTablePaginationController {
    var handle: AWCTablePaginationHandle?
    public init() {}
    public var isConnected: Bool { handle != nil }
    /// Moves to `page` (clamped) and emits `mdPageChange` when it changes.
    public func goToPage(_ page: Int) { handle?.goToPage(page) }
    /// Sets rows per page, returns to page 0 and emits `mdRowsPerPageChange` then `mdPageChange`.
    public func setRowsPerPage(_ rows: Int) { handle?.setRowsPerPage(rows) }
    public var page: Int { handle?.state().page ?? 0 }
    public var rowsPerPage: Int { handle?.state().rowsPerPage ?? 10 }
}

private struct AWCTableControllersKey: EnvironmentKey { static let defaultValue: [String: AWCTableController] = [:] }
private struct AWCTablePaginationControllersKey: EnvironmentKey { static let defaultValue: [String: AWCTablePaginationController] = [:] }
extension EnvironmentValues {
    var awcTableControllers: [String: AWCTableController] { get { self[AWCTableControllersKey.self] } set { self[AWCTableControllersKey.self] = newValue } }
    var awcTablePaginationControllers: [String: AWCTablePaginationController] { get { self[AWCTablePaginationControllersKey.self] } set { self[AWCTablePaginationControllersKey.self] = newValue } }
}
private struct AWCTableControllerModifier: ViewModifier {
    let id: String, controller: AWCTableController
    @Environment(\.awcTableControllers) private var inherited
    func body(content: Content) -> some View { var c = inherited; c[id] = controller; return content.environment(\.awcTableControllers, c) }
}
private struct AWCTablePaginationControllerModifier: ViewModifier {
    let id: String, controller: AWCTablePaginationController
    @Environment(\.awcTablePaginationControllers) private var inherited
    func body(content: Content) -> some View { var c = inherited; c[id] = controller; return content.environment(\.awcTablePaginationControllers, c) }
}
public extension View {
    /// Attach a controller to the md-table with node id `id` rendered inside this view.
    func awcTableController(_ controller: AWCTableController, for id: String) -> some View { modifier(AWCTableControllerModifier(id: id, controller: controller)) }
    /// Attach a controller to the md-table-pagination with node id `id` rendered inside this view.
    func awcTablePaginationController(_ controller: AWCTablePaginationController, for id: String) -> some View { modifier(AWCTablePaginationControllerModifier(id: id, controller: controller)) }
}

// MARK: Column pinning / visibility (md-table.tsx ensurePinBase / applyPinLayout)

/// Pin base: the ORIGINAL tracks of an explicit template (no repeat()), one cell per column in every row, no colspans.
/// Pins seed from the head row's `sticky` cells; display order = start pins, the rest, end pins; hidden columns drop out.
struct AWCTablePinLayout: Equatable {
    var base: [String]
    var pins: [Int: String]
    var hidden: Set<Int>
    var order: [Int] {
        let all = Array(base.indices)
        return all.filter { pins[$0] == "start" } + all.filter { pins[$0] == nil } + all.filter { pins[$0] == "end" }
    }
    var visible: [Int] { order.filter { !hidden.contains($0) } }
    var template: String { visible.map { base[$0] }.joined(separator: " ") }
    /// Top-level tracks of a template (minmax(a, b) stays one).
    static func split(_ template: String) -> [String] {
        var out: [String] = [], depth = 0, cur = ""
        for ch in template.trimmingCharacters(in: .whitespaces) {
            if ch == "(" { depth += 1 } else if ch == ")" { depth -= 1 }
            if ch.isWhitespace && depth == 0 { if !cur.isEmpty { out.append(cur); cur = "" } } else { cur.append(ch) }
        }
        if !cur.isEmpty { out.append(cur) }
        return out
    }
    static func make(template: String, rows: [AWCTableRowEntry]) -> AWCTablePinLayout? {
        guard !template.isEmpty, !template.contains("repeat(") else { return nil }
        let base = split(template)
        for r in rows {
            let cells = r.cells
            if cells.contains(where: { ($0.properties["colSpan"]?.number ?? $0.properties["colspan"]?.number ?? 1) != 1 }) { return nil }
            if cells.count != base.count { return nil }
        }
        var pins: [Int: String] = [:]
        if let head = rows.first(where: { $0.group == .head }) {
            for (i, c) in head.cells.enumerated() { if let s = c.properties["sticky"]?.string, ["start", "end"].contains(s) { pins[i] = s } }
        }
        return .init(base: base, pins: pins, hidden: [])
    }
}

// MARK: Keyboard scrolling of a frozen body (md-table.tsx onBodyKeyDown + the browser's native keys)

extension AWCTableScrollController {
    /// Current logical offsets and the scrollable ranges.
    @MainActor func position() -> (x: Double, y: Double, maxX: Double, maxY: Double)? {
        #if canImport(AppKit)
        guard let scroll = scrollView, let document = scroll.documentView else { return nil }
        let clip = scroll.contentView
        let maxX = Swift.max(0, Double(document.frame.width - clip.bounds.width)), maxY = Swift.max(0, Double(document.frame.height - clip.bounds.height))
        let px = Double(clip.bounds.origin.x), py = document.isFlipped ? Double(clip.bounds.origin.y) : maxY - Double(clip.bounds.origin.y)
        return (rtl ? maxX - px : px, py, maxX, maxY)
        #elseif canImport(UIKit)
        guard let scroll = scrollView else { return nil }
        let maxX = Swift.max(0, Double(scroll.contentSize.width - scroll.bounds.width)), maxY = Swift.max(0, Double(scroll.contentSize.height - scroll.bounds.height))
        let px = Double(scroll.contentOffset.x)
        return (rtl ? maxX - px : px, Double(scroll.contentOffset.y), maxX, maxY)
        #else
        return nil
        #endif
    }
    /// Smooth scroll (Chrome's keyboard scroll: 150 ms, cubic-bezier(0.42, 0, 0.58, 1)) to logical offsets.
    @MainActor @discardableResult func animate(x: Double?, y: Double?, duration: Double = 0.15) -> Bool {
        #if canImport(AppKit)
        guard let scroll = scrollView, let document = scroll.documentView else { return false }
        let clip = scroll.contentView
        let maxX = Swift.max(0, document.frame.width - clip.bounds.width), maxY = Swift.max(0, document.frame.height - clip.bounds.height)
        var origin = clip.bounds.origin
        if let x { let lx = Swift.min(maxX, Swift.max(0, x.rounded())); origin.x = rtl ? maxX - lx : lx }
        if let y { let ly = Swift.min(maxY, Swift.max(0, y.rounded())); origin.y = document.isFlipped ? ly : maxY - ly }
        let start = clip.bounds.origin, t0 = CACurrentMediaTime()
        let logicalY = { (p: CGPoint) in Double(document.isFlipped ? p.y : maxY - p.y) }
        AWCTableMotionRecorder.shared?.record("body-scroll-y", logicalY(start))
        // Step on the main run loop (frame by frame) so geometry observers see every intermediate offset.
        let timer = Timer(timeInterval: 1.0 / 120, repeats: true) { timer in
            MainActor.assumeIsolated {
                let t = Swift.min(1, (CACurrentMediaTime() - t0) / duration), e = AWCNativeLoadingMotion.cubic(t, 0.42, 0, 0.58, 1)
                let p = CGPoint(x: start.x + (origin.x - start.x) * e, y: start.y + (origin.y - start.y) * e)
                clip.scroll(to: p); scroll.reflectScrolledClipView(clip)
                // Motion probe (tests): the offset this tick put on screen.
                AWCTableMotionRecorder.shared?.record("body-scroll-y", logicalY(p))
                if t >= 1 { timer.invalidate() }
            }
        }
        RunLoop.main.add(timer, forMode: .common)
        return true
        #elseif canImport(UIKit)
        guard let scroll = scrollView else { return false }
        let maxX = Swift.max(0, scroll.contentSize.width - scroll.bounds.width), maxY = Swift.max(0, scroll.contentSize.height - scroll.bounds.height)
        var target = scroll.contentOffset
        if let x { let lx = Swift.min(maxX, Swift.max(0, x.rounded())); target.x = rtl ? maxX - lx : lx }
        if let y { target.y = Swift.min(maxY, Swift.max(0, y.rounded())) }
        let start = scroll.contentOffset, t0 = CACurrentMediaTime()
        AWCTableMotionRecorder.shared?.record("body-scroll-y", Double(start.y))
        // Chrome's keyboard scroll curve, stepped frame by frame (setContentOffset(animated:) has UIKit's own curve).
        let timer = Timer(timeInterval: 1.0 / 120, repeats: true) { [weak scroll] timer in
            MainActor.assumeIsolated {
                guard let scroll else { timer.invalidate(); return }
                let t = Swift.min(1, (CACurrentMediaTime() - t0) / duration), e = AWCNativeLoadingMotion.cubic(t, 0.42, 0, 0.58, 1)
                let p = CGPoint(x: start.x + (target.x - start.x) * e, y: start.y + (target.y - start.y) * e)
                scroll.setContentOffset(p, animated: false)
                AWCTableMotionRecorder.shared?.record("body-scroll-y", Double(p.y))
                if t >= 1 { timer.invalidate() }
            }
        }
        RunLoop.main.add(timer, forMode: .common)
        return true
        #else
        return scroll(x: x, y: y)
        #endif
    }
}

/// The frozen body's keyboard tab stop: arrows / Page / Home / End scroll it (vertical keys smooth, horizontal steps of
/// 48 px or to the inline edges with Ctrl/Cmd+Home/End); its inset 2 px secondary ring shows on keyboard focus.
struct AWCTableBodyKeys {
    static func route(_ key: String, shift: Bool, modified: Bool, controller: AWCTableScrollController, pageHeight: Double, rtl: Bool) -> Bool {
        guard let p = MainActor.assumeIsolated({ controller.position() }) else { return false }
        func now(_ x: Double?, _ y: Double?) { MainActor.assumeIsolated { _ = controller.scroll(x: x, y: y) } }
        func smooth(_ y: Double) { MainActor.assumeIsolated { _ = controller.animate(x: nil, y: y) } }
        switch key {
        // md-table.tsx onBodyKeyDown: ArrowRight is dx = isRtl ? -48 : 48 on scrollLeft, i.e. 48 toward the inline end in both
        // directions (RTL scrollLeft runs negative from the inline start).
        case "ArrowRight": guard p.maxX > 0 else { return false }; now(p.x + 48, nil); return true
        case "ArrowLeft": guard p.maxX > 0 else { return false }; now(p.x - 48, nil); return true
        case "Home" where modified: now(0, nil); return true
        case "End" where modified: now(p.maxX, nil); return true
        case "Home" where !shift: smooth(0); return true
        case "End" where !shift: smooth(p.maxY); return true
        case "ArrowDown": smooth(p.y + 40); return true
        case "ArrowUp": smooth(p.y - 40); return true
        case "\u{F72D}", "PageDown": smooth(p.y + pageHeight * 0.875); return true
        case "\u{F72C}", "PageUp": smooth(p.y - pageHeight * 0.875); return true
        case "Space": smooth(p.y + (shift ? -1 : 1) * pageHeight * 0.875); return true
        default: return false
        }
    }
}

// MARK: Motion probes (tests / Laboratory)

/// Records the animated value of the table family's motions on every rendered frame (only when a recorder is installed;
/// normal use installs none). Keys: `selected:<row>`, `hover:<row>`, `expand:<row>`, `caret:<toggle>`, `sort-rot:<label>`,
/// `sort-op:<label>`, `order:<row>`, `toolbar:<toolbar>`, `thumb:<table>`.
public final class AWCTableMotionRecorder {
    public struct Sample { public let t: Double; public let key: String; public let value: Double }
    public private(set) var samples: [Sample] = []
    public init() {}
    /// Process-wide recorder (tests): used when no recorder reaches the view through the environment.
    nonisolated(unsafe) public static var shared: AWCTableMotionRecorder? = nil
    public func reset() { samples = [] }
    func record(_ key: String, _ v: Double) { samples.append(.init(t: CACurrentMediaTime() * 1000, key: key, value: v)) }
}
/// A geometry effect that changes nothing: SwiftUI evaluates it with the interpolated value on every animation frame.
struct AWCTableMotionProbe: GeometryEffect {
    var value: Double
    let key: String
    let recorder: AWCTableMotionRecorder?
    var animatableData: Double { get { value } set { value = newValue } }
    nonisolated(unsafe) static var calls = 0
    func effectValue(size: CGSize) -> ProjectionTransform { Self.calls += 1; (recorder ?? AWCTableMotionRecorder.shared)?.record(key, value); return ProjectionTransform() }
}
private struct AWCTableMotionRecorderKey: EnvironmentKey { static let defaultValue: AWCTableMotionRecorder? = nil }
extension EnvironmentValues {
    var awcTableMotionRecorder: AWCTableMotionRecorder? { get { self[AWCTableMotionRecorderKey.self] } set { self[AWCTableMotionRecorderKey.self] = newValue } }
}
public extension View {
    /// Installs a motion recorder for the md-table family inside this view.
    func awcTableMotionRecorder(_ recorder: AWCTableMotionRecorder?) -> some View { environment(\.awcTableMotionRecorder, recorder) }
}
extension View {
    @ViewBuilder func awcTableMotion(_ key: String, _ value: Double, _ recorder: AWCTableMotionRecorder?, enabled: Bool = true) -> some View {
        if enabled && (recorder != nil || AWCTableMotionRecorder.shared != nil) { modifier(AWCTableMotionProbe(value: value, key: key, recorder: recorder)) } else { self }
    }
}

// MARK: FLIP play (utils/flip.ts captureFlip)

/// One row item's FLIP: jump to the old box (or -8 px and transparent for an entrant), hold for the stagger, then the fast
/// spatial spring (350 ms, cubic-bezier(0.42, 1.67, 0.21, 0.9)) back to rest; entrants fade in on the fast effects curve
/// (150 ms). Transform and opacity only, so the grid's layout never moves mid-flight. `probe` records the row's visual
/// position in rows (index + offset / pitch) for the motion tests.
struct AWCTableFlipEffect: ViewModifier {
    let flip: AWCTableRuntime.Flip?
    let probe: (key: String, index: Double, pitch: Double)?
    let motion: AWCTableMotionRecorder?
    struct Value { var y = 0.0; var opacity = 1.0 }
    func body(content: Content) -> some View {
        let f = flip ?? .init(token: 0, dy: 0, delay: 0, enter: false)
        content.keyframeAnimator(initialValue: Value(), trigger: f.token) { view, v in
            view.offset(y: v.y).opacity(v.opacity)
                .awcTableMotion(probe?.key ?? "", (probe?.index ?? 0) + v.y / Swift.max(1, probe?.pitch ?? 53), probe == nil ? nil : motion, enabled: probe != nil)
        } keyframes: { _ in
            KeyframeTrack(\.y) {
                MoveKeyframe(f.dy)
                LinearKeyframe(f.dy, duration: Swift.max(0.001, f.delay))
                LinearKeyframe(0, duration: 0.35, timingCurve: .bezier(startControlPoint: .init(x: 0.42, y: 1.67), endControlPoint: .init(x: 0.21, y: 0.9)))
            }
            KeyframeTrack(\.opacity) {
                MoveKeyframe(f.enter ? 0 : 1)
                LinearKeyframe(f.enter ? 0 : 1, duration: Swift.max(0.001, f.delay))
                LinearKeyframe(1, duration: 0.15, timingCurve: .bezier(startControlPoint: .init(x: 0.31, y: 0.94), endControlPoint: .init(x: 0.34, y: 1)))
            }
        }
    }
}
