import SwiftUI
import Observation
import QuartzCore

// md-time-picker behaviour (md-time-picker.tsx): value model, draft / commit, the dial geometry, the HH / MM buffers, the
// period group, validity and the event details. The view (NativeTimePicker.swift) renders this state.

enum AWCTimePickerMode: String { case dial, input }
enum AWCTimePickerSelection { case hour, minute }

/// The source's user-facing strings (all properties, English defaults).
struct AWCTimePickerLabels: Equatable {
    var label = "Select time", headline = "", headlineInput = "Enter time", headlineDial = "Select time"
    var valueMissing = "Please select a time.", rangeUnderflow = "Please select a time at or after {min}."
    var rangeOverflow = "Please select a time at or before {max}.", rangeOutside = "Please select a time at or after {min} or at or before {max}."
    var cancel = "Cancel", ok = "OK", am = "AM", pm = "PM", hour = "Hour", minute = "Minute"
    var toggleDial = "Toggle dial picker", toggleInput = "Toggle keyboard input", period = "Period"
    init() {}
    init(_ p: [String: AWCValue]) {
        func s(_ k: String, _ f: String) -> String { p[k]?.string ?? f }
        label = s("label", label); headline = s("headline", headline); headlineInput = s("headlineInputLabel", headlineInput)
        headlineDial = s("headlineDialLabel", headlineDial); valueMissing = s("valueMissingLabel", valueMissing)
        rangeUnderflow = s("rangeUnderflowLabel", rangeUnderflow); rangeOverflow = s("rangeOverflowLabel", rangeOverflow)
        rangeOutside = s("rangeOutsideLabel", rangeOutside); cancel = s("cancelLabel", cancel); ok = s("okLabel", ok)
        am = s("amLabel", am); pm = s("pmLabel", pm); hour = s("hourLabel", hour); minute = s("minuteLabel", minute)
        toggleDial = s("toggleDialLabel", toggleDial); toggleInput = s("toggleInputLabel", toggleInput); period = s("periodLabel", period)
    }
}

enum AWCTimeMath {
    /// `^(\d{1,2}):(\d{2})$` within 00:00…23:59 (minutes of the day), or nil.
    static func parse(_ v: String) -> Int? {
        let parts = v.split(separator: ":", omittingEmptySubsequences: false)
        guard parts.count == 2, (1...2).contains(parts[0].count), parts[1].count == 2,
              parts[0].allSatisfy(\.isASCIIDigit), parts[1].allSatisfy(\.isASCIIDigit),
              let h = Int(parts[0]), let m = Int(parts[1]), h <= 23, m <= 59 else { return nil }
        return h * 60 + m
    }
    static func iso(_ h: Int, _ m: Int) -> String { String(format: "%02d:%02d", h, m) }
    /// The hour shown for a 24-hour value (12h: 12, 1…12).
    static func displayHour(_ h24: Int, twelve: Bool) -> Int { twelve ? (h24 == 0 ? 12 : h24 > 12 ? h24 - 12 : h24) : h24 }
    static func hour24(display: Int, pm: Bool, twelve: Bool) -> Int {
        guard twelve else { return ((display % 24) + 24) % 24 }
        let n = display == 0 ? 12 : display
        return n == 12 ? (pm ? 12 : 0) : (pm ? n + 12 : n)
    }
    /// `parseInt` of a buffer (leading digits), or nil.
    static func parseInt(_ s: String) -> Int? { let d = s.prefix { $0.isASCIIDigit }; return d.isEmpty ? nil : Int(d) }
    /// The clock the details read "today" from (`new Date()` in the source); tests pin it as the oracle page does.
    static var clock: () -> Date = { Date() }
    /// Today's date at h:m (local), the detail's `date` / `isoDateTime` (UTC, `toISOString`).
    static func isoDateTime(_ h: Int, _ m: Int, now: Date = clock()) -> String {
        var cal = Calendar.current; cal.timeZone = .current
        let d = cal.date(bySettingHour: h, minute: m, second: 0, of: now) ?? now
        let f = ISO8601DateFormatter(); f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]; f.timeZone = TimeZone(identifier: "UTC")
        return f.string(from: d)
    }
    /// Dial pointer: angle clockwise from 12 o'clock (degrees, 0…360) and distance from the centre.
    static func dialPoint(_ p: CGPoint, size: CGFloat) -> (angle: Double, distance: Double, radius: Double) {
        let dx = Double(p.x - size / 2), dy = Double(p.y - size / 2)
        var a = atan2(dy, dx) * 180 / .pi
        a = (a + 90 + 360).truncatingRemainder(dividingBy: 360)
        return (a, (dx * dx + dy * dy).squareRoot(), Double(size) / 2)
    }
    /// JS `Math.round` (halves toward +∞).
    static func jsRound(_ v: Double) -> Double { (v + 0.5).rounded(.down) }
}
private extension Character { var isASCIIDigit: Bool { ("0"..."9").contains(self) } }

/// The component's state (@State and private fields of md-time-picker.tsx).
@Observable final class AWCTimePickerRuntime {
    @MainActor static var mounted: [String: Weak] = [:]
    final class Weak { weak var runtime: AWCTimePickerRuntime?; init(_ r: AWCTimePickerRuntime) { runtime = r } }

    // Rendered state.
    var isOpen = false
    var mode: AWCTimePickerMode = .dial
    var selecting: AWCTimePickerSelection = .hour
    var draftHours = 12
    var draftMinutes = 0
    var hourBuffer = ""
    var minuteBuffer = ""
    var hourError = false
    var minuteError = false
    var validationMessage = ""
    /// Inline validation (InlineValidationPresenter): the message shows once reportValidity() revealed it, then follows
    /// the validity until the picker is disabled.
    @ObservationIgnored var revealed = false
    @ObservationIgnored var disabledNow = false
    /// Focused part inside the dialog (input-hour, input-minute, period-am, period-pm, toggle-mode, cancel-button,
    /// confirm-button) or the trigger.
    var focused: String?
    var focusVisible = false
    var hovered: String?
    var pressedPeriod: String?
    /// Bumped to re-seed the HH / MM fields (the source writes the uncontrolled inputs imperatively).
    var inputSeed = 0
    // Committed state and bookkeeping.
    @ObservationIgnored var committedHours = 12
    @ObservationIgnored var committedMinutes = 0
    @ObservationIgnored var committedValue = ""
    @ObservationIgnored var defaultValue = ""
    @ObservationIgnored var loaded = false
    @ObservationIgnored var lastInputEmitKey = -1
    @ObservationIgnored var hourAngle = 0.0
    @ObservationIgnored var minuteAngle = 0.0
    @ObservationIgnored var lastHandMode: AWCTimePickerSelection?
    @ObservationIgnored var lastValidityKey: String?
    @ObservationIgnored var dragging = false
    /// When the dialog first rendered (ms; its enter keyframes start in that frame) and when the mode area last swapped in.
    @ObservationIgnored var openedAt: Double?
    @ObservationIgnored var modeAt: Double?
    var settle = 0
    /// Presented motion per key (scrim, dialog, mode, hand), with frame times in ms (the interaction suites read them).
    @ObservationIgnored var motion: [String: [(t: Double, v: [Double])]] = [:]
    func record(_ key: String, _ v: [Double]) {
        let t = CACurrentMediaTime() * 1000
        var list = motion[key] ?? []
        if let last = list.last, last.v == v { return }
        list.append((t, v)); if list.count > 600 { list.removeFirst(list.count - 600) }
        motion[key] = list
    }
    /// CSS transitions (hand rotation, number / tile / period colours) by key.
    @ObservationIgnored var transitions: [String: AWCColorPickerTransition] = [:]
    @ObservationIgnored var pendingTransitions: [String: (base: AWCColorPickerTransition, start: Double)] = [:]
    /// A style change starts its CSS transition in the next frame; changes before that frame coalesce (one style
    /// computation per frame in Chrome), so a state set and reset within the frame starts none.
    /// `immediate`: the change is applied to the element's style in the input handler itself (the dial hand's rotation),
    /// so its transition starts with the frame being rendered instead of the next one.
    @MainActor func retarget(_ key: String, _ target: [Double], duration: Double, curve: [Double], immediate: Bool = false) {
        guard let track = transitions[key] else { transitions[key] = .init(target); return }
        guard track.value != target else { return }
        let now = CACurrentMediaTime() * 1000
        var base = track, start = now + (immediate ? 0 : AWCColorPickerMotion.frame * 1000)
        if let pending = pendingTransitions[key], now < pending.start { base = pending.base; start = pending.start }
        pendingTransitions[key] = (base, start)
        var next = base
        next.set(target, now: start, duration: max(duration, 0.001), curve: curve); transitions[key] = next
        let wait = UInt64(max(0, AWCColorPickerMotion.frame * 1000 + duration) + 34) * 1_000_000
        Task { @MainActor [weak self] in try? await Task.sleep(nanoseconds: wait); self?.settle &+= 1 }
    }
    /// Colour transitions: Chrome interpolates two legacy colours (rgb(), hex, named) in premultiplied sRGB and any other pair
    /// (a `color-mix()` result is `color(srgb …)`) in premultiplied Oklab. Each colour runs in its pair's space; values are
    /// presented and recorded as premultiplied sRGB.
    @ObservationIgnored var colorSpaces: [String: Bool] = [:]
    @ObservationIgnored var colorLegacy: [String: Bool] = [:]
    @ObservationIgnored var colorTargets: [String: [Double]] = [:]
    @MainActor func retargetColor(_ key: String, _ premultiplied: [Double], legacy: Bool, duration: Double, curve: [Double]) {
        guard let previous = colorTargets[key], transitions[key] != nil else {
            colorTargets[key] = premultiplied; colorLegacy[key] = legacy; colorSpaces[key] = false
            transitions[key] = .init(premultiplied); return
        }
        guard previous != premultiplied else { colorLegacy[key] = legacy; return }
        let oklab = !((colorLegacy[key] ?? true) && legacy), now = CACurrentMediaTime() * 1000
        if oklab != (colorSpaces[key] ?? false) {
            let current = presentedColor(key, now)
            transitions[key] = .init(oklab ? AWCTimePickerOKLab.fromSRGB(current) : current); pendingTransitions[key] = nil
            colorSpaces[key] = oklab
        }
        colorTargets[key] = premultiplied; colorLegacy[key] = legacy
        retarget(key, oklab ? AWCTimePickerOKLab.fromSRGB(premultiplied) : premultiplied, duration: duration, curve: curve)
    }
    func presentedColor(_ key: String, _ now: Double) -> [Double] {
        let v = presented(key, now)
        return colorSpaces[key] == true && v.count == 4 ? AWCTimePickerOKLab.toSRGB(v) : v
    }
    func presented(_ key: String, _ now: Double) -> [Double] { transitions[key]?.presented(now) ?? [] }
    func isRunning(_ key: String, _ now: Double) -> Bool { transitions[key]?.isRunning(now) ?? false }
    @ObservationIgnored var inputs: [String: AWCFieldInputHandle] = [:]
    @MainActor func input(_ id: String) -> AWCFieldInputHandle { if let h = inputs[id] { return h }; let h = AWCFieldInputHandle(); inputs[id] = h; return h }
    /// Focuses the trigger field (close without a session to restore the opener).
    @ObservationIgnored var focusTrigger: () -> Void = {}
    /// The trigger md-text-field's focus (bound by the field), and whether the dialog was opened from it.
    @ObservationIgnored private var triggerFocusTarget: AWCFieldFocusTarget?
    @MainActor var triggerFocus: AWCFieldFocusTarget { if let t = triggerFocusTarget { return t }; let t = AWCFieldFocusTarget(); triggerFocusTarget = t; return t }
    @ObservationIgnored var openedFromTrigger = false
    @ObservationIgnored var activatedFromTrigger = false
    /// The AM / PM buttons' frames in the host's pointer space (`:hover` from AWCNativePointerState).
    @ObservationIgnored var periodFrames: [String: CGRect] = [:]
    /// The AM / PM radios' focus bridges.
    @ObservationIgnored var periodControls: [String: AWCColorPickerControlHandle] = [:]
    /// Methods (`show()`, `close()`, `checkValidity()` / `reportValidity()`), bound by the mounted view.
    @ObservationIgnored var show: () -> Void = {}
    @ObservationIgnored var hide: () -> Void = {}
    @ObservationIgnored var validityRecord: () -> (valid: Bool, message: String, flags: [String: Bool]) = { (true, "", [:]) }

    var period: String { draftHours >= 12 ? "PM" : "AM" }
    func displayHour(twelve: Bool) -> Int { AWCTimeMath.displayHour(draftHours, twelve: twelve) }

    /// `parseValueInto`: an empty value seeds 12:00.
    @discardableResult func parseValueInto(_ v: String) -> Bool {
        if v.isEmpty { draftHours = 12; draftMinutes = 0; return true }
        guard let mins = AWCTimeMath.parse(v) else { return false }
        draftHours = mins / 60; draftMinutes = mins % 60; return true
    }
    func syncInputsFromDraft(twelve: Bool) {
        hourBuffer = String(displayHour(twelve: twelve)); minuteBuffer = String(format: "%02d", draftMinutes)
        hourError = false; minuteError = false; inputSeed &+= 1
    }
    /// The hand angle unwrapped so it turns the short way (advanceHandAngle).
    func advanceHand(_ mode: AWCTimePickerSelection, _ raw: Double) -> Double {
        if lastHandMode != mode {
            lastHandMode = mode
            if mode == .hour { hourAngle = raw } else { minuteAngle = raw }
            return raw
        }
        let last = mode == .hour ? hourAngle : minuteAngle
        let delta = ((raw - last).truncatingRemainder(dividingBy: 360) + 540).truncatingRemainder(dividingBy: 360) - 180
        let next = last + delta
        if mode == .hour { hourAngle = next } else { minuteAngle = next }
        return next
    }
}

/// Premultiplied sRGB ↔ premultiplied Oklab (CSS Color 4), and `color-mix(in srgb, x p%, y)`.
enum AWCTimePickerOKLab {
    static func fromSRGB(_ v: [Double]) -> [Double] {
        let a = v[3]; guard a > 0 else { return [0, 0, 0, 0] }
        func lin(_ c: Double) -> Double { c <= 0.04045 ? c / 12.92 : pow((c + 0.055) / 1.055, 2.4) }
        let r = lin(v[0] / a), g = lin(v[1] / a), b = lin(v[2] / a)
        let l = cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
        let m = cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
        let s = cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
        let L = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s
        let A = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s
        let B = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s
        return [L * a, A * a, B * a, a]
    }
    static func toSRGB(_ v: [Double]) -> [Double] {
        let a = v[3]; guard a > 0 else { return [0, 0, 0, 0] }
        let L = v[0] / a, A = v[1] / a, B = v[2] / a
        let l = pow(L + 0.3963377774 * A + 0.2158037573 * B, 3), m = pow(L - 0.1055613458 * A - 0.0638541728 * B, 3)
        let s = pow(L - 0.0894841775 * A - 1.2914855480 * B, 3)
        func gam(_ c: Double) -> Double { let x = c <= 0.0031308 ? 12.92 * c : 1.055 * pow(c, 1 / 2.4) - 0.055; return min(1, max(0, x)) }
        let r = gam(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s)
        let g = gam(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s)
        let b = gam(-0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s)
        return [r * a, g * a, b * a, a]
    }
    /// `#RRGGBB[AA]` as premultiplied sRGB 0–1.
    static func premultiplied(_ hex: String) -> [Double] {
        let h = hex.trimmingCharacters(in: CharacterSet(charactersIn: "#"))
        let v = UInt64(h, radix: 16) ?? 0, rgba = h.count == 8, rgb = rgba ? v >> 8 : v
        let a = rgba ? Double(v & 255) / 255 : 1
        return [Double((rgb >> 16) & 255) / 255 * a, Double((rgb >> 8) & 255) / 255 * a, Double(rgb & 255) / 255 * a, a]
    }
    /// `color-mix(in srgb, x p, y)` (premultiplied) as `#RRGGBBAA`.
    static func mix(_ x: String, _ p: Double, _ y: String) -> String {
        let cx = premultiplied(x), cy = premultiplied(y)
        let m = (0..<4).map { cx[$0] * p + cy[$0] * (1 - p) }, a = m[3]
        func b(_ c: Double) -> Int { Int((min(1, max(0, c)) * 255).rounded()) }
        return a <= 0 ? "#00000000" : String(format: "#%02X%02X%02X%02X", b(m[0] / a), b(m[1] / a), b(m[2] / a), b(a))
    }
}

/// The source's detail object (`MdTimePickerChangeDetail`).
func awcTimePickerDetail(_ h: Int, _ m: Int) -> AWCValue {
    let value = AWCTimeMath.iso(h, m), iso = AWCTimeMath.isoDateTime(h, m)
    return ["value": .string(value), "iso": .string(value + ":00"), "isoDateTime": .string(iso), "date": .string(iso),
            "hours": .number(Double(h)), "minutes": .number(Double(m)), "period": .string(h >= 12 ? "PM" : "AM")]
}

/// md-time-picker's public CSS custom properties (`--md-time-picker-<name>`) as native appearance hooks, keyed by the name
/// without the prefix (`"dial-bg"`, `"input-shape"`, …): colours `#RRGGBB[AA]` or `rgb[a](…)`, lengths in points / dp (a `px`
/// suffix is accepted), durations in ms, `motion-easing` a `cubic-bezier(…)`, `dialog-elevation` a box-shadow list,
/// `hand-length` a percentage of the dial radius. Unknown names are ignored, as an unknown custom property is.
public struct AWCTimePickerAppearance: Equatable, Sendable {
    public var hooks: [String: String]
    public init(_ hooks: [String: String] = [:]) { self.hooks = hooks }
    public subscript(_ name: String) -> String? { get { hooks[name] } set { hooks[name] = newValue } }
    /// Later values win (a targeted appearance over the inherited one).
    public func merging(_ other: Self) -> Self { .init(hooks.merging(other.hooks) { $1 }) }
    /// The source's back-compat alias: `time-display-shape` sets the tile shape (`time-display-bg` and the other legacy
    /// `time-display-*` colours were dropped by the source and have no effect).
    func raw(_ k: String) -> String? {
        if let v = hooks[k] { return v.trimmingCharacters(in: .whitespaces) }
        return k == "input-shape" ? hooks["time-display-shape"]?.trimmingCharacters(in: .whitespaces) : nil
    }
    func color(_ k: String) -> String? { raw(k).flatMap(awcTimePickerColor) }
    func number(_ k: String) -> Double? {
        guard var v = raw(k) else { return nil }
        for suffix in ["px", "ms", "%"] where v.hasSuffix(suffix) { v = String(v.dropLast(suffix.count)) }
        return Double(v.trimmingCharacters(in: .whitespaces)).flatMap { $0.isFinite ? $0 : nil }
    }
    var easing: [Double]? { awcCSSCubicBezier(raw("motion-easing")) }
}
/// `#RGB[A]`, `#RRGGBB[AA]` or `rgb[a](r, g, b[, a])` (also the slash and space syntaxes) as `#RRGGBBAA`.
func awcTimePickerColor(_ raw: String) -> String? {
    let v = raw.trimmingCharacters(in: .whitespaces)
    if v.hasPrefix("#") {
        let h = Array(v.dropFirst())
        guard h.allSatisfy(\.isHexDigit) else { return nil }
        switch h.count {
        case 3, 4: return "#" + h.map { "\($0)\($0)" }.joined().uppercased() + (h.count == 3 ? "FF" : "")
        case 6: return v.uppercased() + "FF"
        case 8: return v.uppercased()
        default: return nil
        }
    }
    guard v.hasPrefix("rgb"), let open = v.firstIndex(of: "("), v.hasSuffix(")") else { return nil }
    let body = v[v.index(after: open)..<v.index(before: v.endIndex)]
    let parts = body.replacingOccurrences(of: "/", with: " ").replacingOccurrences(of: ",", with: " ").split(separator: " ").map(String.init)
    guard parts.count == 3 || parts.count == 4 else { return nil }
    var c: [Double] = []
    for (i, p) in parts.enumerated() {
        let pct = p.hasSuffix("%"), n = Double(pct ? String(p.dropLast()) : p)
        guard let n, n.isFinite else { return nil }
        c.append(i < 3 ? min(255, max(0, pct ? n * 2.55 : n)) : min(1, max(0, pct ? n / 100 : n)))
    }
    let a = c.count == 4 ? c[3] : 1
    return String(format: "#%02X%02X%02X%02X", Int(c[0].rounded()), Int(c[1].rounded()), Int(c[2].rounded()), Int((a * 255).rounded()))
}
private struct AWCTimePickerAppearanceKey: EnvironmentKey { static let defaultValue = AWCTimePickerAppearance() }
private struct AWCTimePickerAppearanceTargetsKey: EnvironmentKey { static let defaultValue: [String: AWCTimePickerAppearance] = [:] }
extension EnvironmentValues {
    var awcTimePickerAppearance: AWCTimePickerAppearance { get { self[AWCTimePickerAppearanceKey.self] } set { self[AWCTimePickerAppearanceKey.self] = newValue } }
    var awcTimePickerAppearanceTargets: [String: AWCTimePickerAppearance] { get { self[AWCTimePickerAppearanceTargetsKey.self] } set { self[AWCTimePickerAppearanceTargetsKey.self] = newValue } }
}
private struct AWCTimePickerAppearanceModifier: ViewModifier {
    let value: AWCTimePickerAppearance, id: String?
    @Environment(\.awcTimePickerAppearance) private var inherited
    @Environment(\.awcTimePickerAppearanceTargets) private var targets
    func body(content: Content) -> some View {
        if let id { var t = targets; t[id] = (t[id] ?? .init()).merging(value); return AnyView(content.environment(\.awcTimePickerAppearanceTargets, t)) }
        return AnyView(content.environment(\.awcTimePickerAppearance, inherited.merging(value)))
    }
}
public extension View {
    /// md-time-picker hooks for every picker below (or for the picker with `id`).
    func awcTimePickerAppearance(_ value: AWCTimePickerAppearance, for id: String? = nil) -> some View { modifier(AWCTimePickerAppearanceModifier(value: value, id: id)) }
}

/// `getValidity()` of md-time-picker: validity, message and the three flags the source sets (ElementInternals).
public struct AWCTimePickerValidity: Equatable, Sendable {
    public let valid: Bool, validationMessage: String, valueMissing: Bool, rangeUnderflow: Bool, rangeOverflow: Bool
    public static let validState = AWCTimePickerValidity(valid: true, validationMessage: "", valueMissing: false, rangeUnderflow: false, rangeOverflow: false)
    /// As AWCConstraintValidity.value: `{ valid, validationMessage, flags: { valueMissing, rangeUnderflow, rangeOverflow } }`.
    public var value: AWCValue {
        .object(["valid": .bool(valid), "validationMessage": .string(validationMessage),
                 "flags": .object(["valueMissing": .bool(valueMissing), "rangeUnderflow": .bool(rangeUnderflow), "rangeOverflow": .bool(rangeOverflow)])])
    }
}

/// md-time-picker's methods for a mounted picker: `show()` (opens the dialog), `hide()` (closes it as Cancel: `mdCancel`),
/// and constraint validation (`checkValidity()`, `reportValidity()`, `getValidity()`). Attach with
/// `.awcTimePickerController(controller)` (every picker below) or `.awcTimePickerController(controller, for: id)`.
@MainActor public final class AWCTimePickerController {
    weak var runtime: AWCTimePickerRuntime?
    public init() {}
    /// A picker is mounted and attached.
    public var isConnected: Bool { runtime != nil }
    /// The dialog is open.
    public var isOpen: Bool { runtime?.isOpen ?? false }
    public func show() { runtime?.show() }
    public func hide() { runtime?.hide() }
    /// The committed value's validity (`required`, `min` / `max`, an overnight window), whether or not it is disabled.
    public func getValidity() -> AWCTimePickerValidity {
        guard let v = runtime?.validityRecord() else { return .validState }
        return .init(valid: v.valid, validationMessage: v.message, valueMissing: v.flags["valueMissing"] ?? false,
                     rangeUnderflow: v.flags["rangeUnderflow"] ?? false, rangeOverflow: v.flags["rangeOverflow"] ?? false)
    }
    /// Validity without presenting it; a disabled picker is barred from validation and reports true.
    public func checkValidity() -> Bool { guard let r = runtime else { return true }; return r.disabledNow || getValidity().valid }
    /// Like `checkValidity()`, but an invalid picker shows its message as the trigger's error text and focuses the trigger.
    @discardableResult public func reportValidity() -> Bool {
        guard let r = runtime, !r.disabledNow else { return true }
        let v = getValidity(); guard !v.valid else { return true }
        r.revealed = true; r.validationMessage = v.validationMessage
        DispatchQueue.main.async { [weak r] in r?.focusTrigger() }
        return false
    }
}
private struct AWCTimePickerControllersKey: EnvironmentKey { static let defaultValue: [String: AWCTimePickerController] = [:] }
extension EnvironmentValues {
    var awcTimePickerControllers: [String: AWCTimePickerController] {
        get { self[AWCTimePickerControllersKey.self] } set { self[AWCTimePickerControllersKey.self] = newValue }
    }
}
private struct AWCTimePickerControllerModifier: ViewModifier {
    let id: String, controller: AWCTimePickerController
    @Environment(\.awcTimePickerControllers) private var inherited
    func body(content: Content) -> some View { var c = inherited; c[id] = controller; return content.environment(\.awcTimePickerControllers, c) }
}
public extension View {
    /// Binds `controller` to the md-time-picker with node id `id`, or to every picker below when `id` is nil.
    func awcTimePickerController(_ controller: AWCTimePickerController, for id: String? = nil) -> some View {
        modifier(AWCTimePickerControllerModifier(id: id ?? "", controller: controller))
    }
}

public extension AWCTimePickerAppearance {
    /// Hooks from plain data (the Laboratory transport, picker-appearance.js): strings and numbers by hook name, the name in
    /// kebab or camel case (`dialogHorizontalWidth12h` → `dialog-horizontal-width-12h`); other value types are ignored.
    init(values: [String: AWCValue]) {
        var hooks: [String: String] = [:]
        for (name, value) in values {
            if case .string(let text) = value { hooks[Self.hookName(name)] = text }
            else if let n = value.number { hooks[Self.hookName(name)] = String(n) }
        }
        self.init(hooks)
    }
    /// A dash before each capital and before a number that follows a letter (kebab names are kept).
    static func hookName(_ camel: String) -> String {
        var out = "", previous: Character?
        for c in camel {
            if c.isUppercase || (c.isNumber && previous.map { $0.isLetter } == true) { out += "-" }
            out += c.lowercased(); previous = c
        }
        return out
    }
}
