import SwiftUI
import QuartzCore
#if canImport(AppKit)
import AppKit
#endif

// md-app-bar: dedicated SwiftUI renderer (small, medium, large and search bars).
// Contract: docs/native-parity/md-app-bar-source-review.md; geometry, colors and motion from md-app-bar.css / md-app-bar.tsx.

/// The 38 md-app-bar CSS custom properties (hooks), as CSS text (`"72px"`, `"#FFF3E0"`, `"0 0 24px 24px"`, a box-shadow list).
/// Lengths are px; colors are #RRGGBB[AA]; shapes are a physical border-radius shorthand; elevation is a box-shadow list or `none`.
public struct AWCAppBarAppearance: Equatable, Sendable {
    public var containerColor: String?, containerColorScrolled: String?, containerShape: String?, headlineColor: String?, subtitleColor: String?, leadingIconColor: String?
    public var trailingIconColor: String?, containerElevation: String?, rowHeight: String?, paddingInlineStart: String?, paddingInlineEnd: String?, rowPaddingInline: String?
    public var rowPaddingBlockStart: String?, trailingGap: String?, trailingIconTouchSize: String?, iconGap: String?, iconSize: String?, avatarSize: String?
    public var expandedPaddingInline: String?, expandedPaddingBlockEnd: String?, mediumHeight: String?, mediumHeightWithSubtitle: String?, largeHeight: String?, largeHeightWithSubtitle: String?
    public var iconButtonSize: String?, searchContainerColor: String?, searchContainerColorScrolled: String?, searchContainerShape: String?, searchContainerHeight: String?, searchPaddingInlineStart: String?
    public var searchPaddingInlineEnd: String?, searchRowGap: String?, searchTrailingGap: String?, searchFieldTrailingGap: String?, trailingTouchSize: String?, searchPlaceholderColor: String?
    public var searchInputColor: String?, searchTrailingIconColor: String?
    public init(containerColor: String? = nil, containerColorScrolled: String? = nil, containerShape: String? = nil, headlineColor: String? = nil,
                subtitleColor: String? = nil, leadingIconColor: String? = nil, trailingIconColor: String? = nil, containerElevation: String? = nil,
                rowHeight: String? = nil, paddingInlineStart: String? = nil, paddingInlineEnd: String? = nil, rowPaddingInline: String? = nil,
                rowPaddingBlockStart: String? = nil, trailingGap: String? = nil, trailingIconTouchSize: String? = nil, iconGap: String? = nil,
                iconSize: String? = nil, avatarSize: String? = nil, expandedPaddingInline: String? = nil, expandedPaddingBlockEnd: String? = nil,
                mediumHeight: String? = nil, mediumHeightWithSubtitle: String? = nil, largeHeight: String? = nil, largeHeightWithSubtitle: String? = nil,
                iconButtonSize: String? = nil, searchContainerColor: String? = nil, searchContainerColorScrolled: String? = nil, searchContainerShape: String? = nil,
                searchContainerHeight: String? = nil, searchPaddingInlineStart: String? = nil, searchPaddingInlineEnd: String? = nil, searchRowGap: String? = nil,
                searchTrailingGap: String? = nil, searchFieldTrailingGap: String? = nil, trailingTouchSize: String? = nil, searchPlaceholderColor: String? = nil,
                searchInputColor: String? = nil, searchTrailingIconColor: String? = nil) {
        self.containerColor = containerColor; self.containerColorScrolled = containerColorScrolled; self.containerShape = containerShape; self.headlineColor = headlineColor; self.subtitleColor = subtitleColor; self.leadingIconColor = leadingIconColor
        self.trailingIconColor = trailingIconColor; self.containerElevation = containerElevation; self.rowHeight = rowHeight; self.paddingInlineStart = paddingInlineStart; self.paddingInlineEnd = paddingInlineEnd; self.rowPaddingInline = rowPaddingInline
        self.rowPaddingBlockStart = rowPaddingBlockStart; self.trailingGap = trailingGap; self.trailingIconTouchSize = trailingIconTouchSize; self.iconGap = iconGap; self.iconSize = iconSize; self.avatarSize = avatarSize
        self.expandedPaddingInline = expandedPaddingInline; self.expandedPaddingBlockEnd = expandedPaddingBlockEnd; self.mediumHeight = mediumHeight; self.mediumHeightWithSubtitle = mediumHeightWithSubtitle; self.largeHeight = largeHeight; self.largeHeightWithSubtitle = largeHeightWithSubtitle
        self.iconButtonSize = iconButtonSize; self.searchContainerColor = searchContainerColor; self.searchContainerColorScrolled = searchContainerColorScrolled; self.searchContainerShape = searchContainerShape; self.searchContainerHeight = searchContainerHeight; self.searchPaddingInlineStart = searchPaddingInlineStart
        self.searchPaddingInlineEnd = searchPaddingInlineEnd; self.searchRowGap = searchRowGap; self.searchTrailingGap = searchTrailingGap; self.searchFieldTrailingGap = searchFieldTrailingGap; self.trailingTouchSize = trailingTouchSize; self.searchPlaceholderColor = searchPlaceholderColor
        self.searchInputColor = searchInputColor; self.searchTrailingIconColor = searchTrailingIconColor
    }
    static let hooks: [(String, WritableKeyPath<AWCAppBarAppearance, String?>)] = [
        ("container-color", \.containerColor), ("container-color-scrolled", \.containerColorScrolled), ("container-shape", \.containerShape),
        ("headline-color", \.headlineColor), ("subtitle-color", \.subtitleColor), ("leading-icon-color", \.leadingIconColor),
        ("trailing-icon-color", \.trailingIconColor), ("container-elevation", \.containerElevation), ("row-height", \.rowHeight),
        ("padding-inline-start", \.paddingInlineStart), ("padding-inline-end", \.paddingInlineEnd), ("row-padding-inline", \.rowPaddingInline),
        ("row-padding-block-start", \.rowPaddingBlockStart), ("trailing-gap", \.trailingGap), ("trailing-icon-touch-size", \.trailingIconTouchSize),
        ("icon-gap", \.iconGap), ("icon-size", \.iconSize), ("avatar-size", \.avatarSize),
        ("expanded-padding-inline", \.expandedPaddingInline), ("expanded-padding-block-end", \.expandedPaddingBlockEnd), ("medium-height", \.mediumHeight),
        ("medium-height-with-subtitle", \.mediumHeightWithSubtitle), ("large-height", \.largeHeight), ("large-height-with-subtitle", \.largeHeightWithSubtitle),
        ("icon-button-size", \.iconButtonSize), ("search-container-color", \.searchContainerColor), ("search-container-color-scrolled", \.searchContainerColorScrolled),
        ("search-container-shape", \.searchContainerShape), ("search-container-height", \.searchContainerHeight), ("search-padding-inline-start", \.searchPaddingInlineStart),
        ("search-padding-inline-end", \.searchPaddingInlineEnd), ("search-row-gap", \.searchRowGap), ("search-trailing-gap", \.searchTrailingGap),
        ("search-field-trailing-gap", \.searchFieldTrailingGap), ("trailing-touch-size", \.trailingTouchSize), ("search-placeholder-color", \.searchPlaceholderColor),
        ("search-input-color", \.searchInputColor), ("search-trailing-icon-color", \.searchTrailingIconColor)]
    /// From authored CSS custom properties (`--md-app-bar-*` names); unknown names are ignored.
    public init(css: [String: String]) { self.init(); for (name, path) in Self.hooks { if let v = css["--md-app-bar-" + name] { self[keyPath: path] = v.trimmingCharacters(in: .whitespaces) } } }
    subscript(hook name: String) -> String? { Self.hooks.first { $0.0 == name }.flatMap { self[keyPath: $0.1] } }
    /// Inherited CSS custom properties: the inner (more specific) value wins.
    public func merging(_ inner: AWCAppBarAppearance) -> AWCAppBarAppearance {
        var out = self; for (_, path) in Self.hooks { if let v = inner[keyPath: path] { out[keyPath: path] = v } }; return out
    }
}

public extension AWCAppBarAppearance {
    /// Laboratory values: field names (`rowHeight`) or hook names without the `--md-app-bar-` prefix (`row-height`); a number
    /// is a px length, a string CSS text. Nil when a key or value is invalid.
    init?(values: [String: AWCValue]) {
        self.init()
        for (k, v) in values {
            let hook = k.contains("-") ? k : k.replacingOccurrences(of: "([A-Z])", with: "-$1", options: .regularExpression).lowercased()
            guard let (_, path) = Self.hooks.first(where: { $0.0 == hook }) else { return nil }
            let text: String
            switch v {
            case .number(let n): guard n.isFinite, n >= 0 else { return nil }; text = (n == n.rounded() && abs(n) < 1e15 ? String(Int64(n)) : String(n)) + "px"
            case .string(let s): text = s.trimmingCharacters(in: .whitespaces); guard !text.isEmpty, text.utf8.count <= 4096 else { return nil }
            default: return nil
            }
            self[keyPath: path] = text
        }
    }
}
// MARK: parts

/// md-app-bar's CSS parts (CEM order; icon and state-layer are the fallback leading icon button's exported parts). Part rules
/// come from the outer tree, so a native part appearance wins over the hooks and every internal state rule (an opacity
/// replaces the part's own). Boxes (row, leading, trailing, expanded, search-host, search-field, search-trailing,
/// leading-icon): `backgroundColor`, `cornerShape`, `opacity`; text (title, subtitle, expanded-headline): `color`,
/// `fontSize`, `lineHeight`, `fontWeight`, `letterSpacing`, `opacity`, `backgroundColor`; search (the pill):
/// `backgroundColor` (every state, scrolled included), `cornerShape`, `opacity`; search-state-layer: `backgroundColor`,
/// `opacity` (fixed in every state); search-input: `color`, `fontSize`, `opacity`; search-content: `color`, `opacity`; icon:
/// `color`; state-layer: `backgroundColor`, `opacity` (fixed in every state).
public enum AWCAppBarPart: String, CaseIterable, Sendable, Hashable {
    case leadingIcon = "leading-icon", title, subtitle, expandedHeadline = "expanded-headline", searchHost = "search-host", search
    case searchStateLayer = "search-state-layer", searchField = "search-field", searchContent = "search-content", searchInput = "search-input"
    case searchTrailing = "search-trailing", row, leading, trailing, expanded, icon, stateLayer = "state-layer"
}
/// The shared sparse part vocabulary (md-accordion / md-list).
public typealias AWCAppBarPartAppearance = AWCAccordionPartAppearance
private struct AWCAppBarPartsKey: EnvironmentKey { static let defaultValue: [AWCAppBarPart: AWCAppBarPartAppearance] = [:] }
extension EnvironmentValues {
    var awcAppBarParts: [AWCAppBarPart: AWCAppBarPartAppearance] { get { self[AWCAppBarPartsKey.self] } set { self[AWCAppBarPartsKey.self] = newValue } }
}
private struct AWCAppBarPartModifier: ViewModifier {
    let part: AWCAppBarPart, value: AWCAppBarPartAppearance
    @Environment(\.awcAppBarParts) private var inherited
    func body(content: Content) -> some View {
        content.environment(\.awcAppBarParts, inherited.merging([part: (inherited[part] ?? .init()).merging(value)]) { _, local in local })
    }
}
public extension View {
    /// `md-app-bar::part(<part>)` styling for the app bars in this subtree.
    func awcAppBarPartAppearance(_ value: AWCAppBarPartAppearance, part: AWCAppBarPart) -> some View { modifier(AWCAppBarPartModifier(part: part, value: value)) }
}
/// A part's own box: its background in its corner shape (physical corners) behind its content, and its opacity over both.
struct AWCAppBarPartBox: ViewModifier {
    let value: AWCAppBarPartAppearance?
    func body(content: Content) -> some View {
        content
            .background { if let v = value, let bg = v.backgroundColor { AWCNativeCornerShape(corners: v.cornerShape ?? .points(0)).fill(Color(awcHex: bg)).environment(\.layoutDirection, .leftToRight) } }
            .opacity(value?.opacity ?? 1)
    }
}

private struct AWCAppBarAppearanceKey: EnvironmentKey { static let defaultValue = AWCAppBarAppearance() }
private struct AWCAppBarReducedMotionKey: EnvironmentKey { static let defaultValue: Bool? = nil }
extension EnvironmentValues {
    var awcAppBarAppearance: AWCAppBarAppearance { get { self[AWCAppBarAppearanceKey.self] } set { self[AWCAppBarAppearanceKey.self] = newValue } }
    var awcAppBarReducedMotion: Bool? { get { self[AWCAppBarReducedMotionKey.self] } set { self[AWCAppBarReducedMotionKey.self] = newValue } }
}
public extension View {
    /// `prefers-reduced-motion` for the app bars in this subtree (nil: the system setting).
    func awcAppBarReducedMotion(_ reduced: Bool?) -> some View { environment(\.awcAppBarReducedMotion, reduced) }
}
/// Development diagnostics of md-app-bar (the source's console warnings), counted for tests.
@MainActor enum AWCAppBarDiagnostics { static var warnings: [String] = [] }
public extension View {
    /// md-app-bar hooks for every app bar in this subtree (inner scopes override outer ones per hook).
    func awcAppBarAppearance(_ appearance: AWCAppBarAppearance) -> some View { modifier(AWCAppBarAppearanceModifier(appearance: appearance)) }
}
private struct AWCAppBarAppearanceModifier: ViewModifier {
    @Environment(\.awcAppBarAppearance) private var outer
    let appearance: AWCAppBarAppearance
    func body(content: Content) -> some View { content.environment(\.awcAppBarAppearance, outer.merging(appearance)) }
}

/// md-app-bar properties (source defaults).
struct AWCAppBarModel: Equatable {
    var variant = "small", centered = false, placeholder = "Search", value = "", ariaLabel = "", searchDisabled = false
    var headline = "", subtitle = "", scrolled = false, density = 0.0, leadingIcon = "", leadingIconLabel = "", hidden = false
    init(_ p: [String: AWCValue]) {
        let v = p["variant"]?.string ?? "small"; variant = ["small", "medium", "large", "search"].contains(v) ? v : "small"
        centered = p["titleAlignment"]?.string == "center"
        placeholder = p["searchPlaceholder"]?.string ?? "Search"; value = p["searchValue"]?.string ?? ""
        ariaLabel = p["searchAriaLabel"]?.string ?? ""; searchDisabled = p["searchDisabled"]?.bool ?? false
        headline = p["headline"]?.string ?? ""; subtitle = p["subtitle"]?.string ?? ""; scrolled = p["scrolled"]?.bool ?? false
        density = p["density"]?.number ?? 0; leadingIcon = p["leadingIcon"]?.string ?? ""; leadingIconLabel = p["leadingIconLabel"]?.string ?? ""
        hidden = p["hidden"]?.bool ?? false
    }
    var flexible: Bool { variant == "medium" || variant == "large" }
    var search: Bool { variant == "search" }
    /// The search field's accessible name: aria label, then the placeholder, then "Search".
    var searchLabel: String { [ariaLabel, placeholder].first { !$0.isEmpty } ?? "Search" }
}

/// CSS text of the hooks.
enum AWCAppBarCSS {
    static func px(_ s: String?) -> Double? {
        guard let t = s?.trimmingCharacters(in: .whitespaces).lowercased(), !t.isEmpty else { return nil }
        let n = t.hasSuffix("px") ? String(t.dropLast(2)) : t
        guard let v = Double(n), v.isFinite else { return nil }; return v
    }
    /// border-radius shorthand of one to four px radii: top-left, top-right, bottom-right, bottom-left.
    static func corners(_ s: String?) -> [Double]? {
        guard let s else { return nil }
        let parts = s.split(whereSeparator: \.isWhitespace).map { px(String($0)) }
        guard (1...4).contains(parts.count), parts.allSatisfy({ $0 != nil && $0! >= 0 }) else { return nil }
        let p = parts.map { $0! }
        switch p.count { case 1: return [p[0], p[0], p[0], p[0]]; case 2: return [p[0], p[1], p[0], p[1]]; case 3: return [p[0], p[1], p[2], p[1]]; default: return p }
    }
    static func color(_ s: String?) -> String? {
        guard let t = s?.trimmingCharacters(in: .whitespaces), t.range(of: "^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$", options: .regularExpression) != nil else { return nil }
        return t.uppercased()
    }
}

/// Resolved geometry (points) for one density scale `s`, spacing rung `r` (the -2…-4 spacing tokens) and the hooks.
struct AWCAppBarMetrics {
    let s: Double, r: Double, a: AWCAppBarAppearance, model: AWCAppBarModel
    // The density-tapered spacing tokens (tokens.css [density] rules).
    var insetXs: Double { 4 }
    var insetSm: Double { r <= -3 ? 4 : 8 }
    var insetMd: Double { r <= -2 ? 8 : 12 }
    var insetLg: Double { r <= -4 ? 8 : r <= -2 ? 12 : 16 }
    var insetXl: Double { r <= -3 ? 16 : r <= -2 ? 20 : 24 }
    var gapXs: Double { r <= -4 ? 2 : 4 }
    var gapSm: Double { r <= -3 ? 4 : 8 }
    func hook(_ n: String) -> Double? { AWCAppBarCSS.px(a[hook: n]) }
    var rowHeight: Double { hook("row-height") ?? max(48, 64 + 4 * s) }
    var iconButton: Double { hook("icon-button-size") ?? max(32, 48 + 4 * s) }
    var trailingIconTouch: Double { hook("trailing-icon-touch-size") ?? iconButton }
    var trailingGap: Double { hook("trailing-gap") ?? 2 }
    var rowPadTop: Double { hook("row-padding-block-start") ?? (model.variant == "large" ? 20 : 0) }
    var iconSize: Double { hook("icon-size") ?? max(18, 24 + s) }
    var avatar: Double { hook("avatar-size") ?? max(24, 32 + 2 * s) }
    var expandedPadInline: Double { hook("expanded-padding-inline") ?? insetLg }
    var expandedPadBottom: Double { hook("expanded-padding-block-end") ?? (model.variant == "large" ? 28 : insetXl) }
    var padStart: Double { hook("padding-inline-start") ?? hook("row-padding-inline") ?? insetXs }
    var padEnd: Double { hook("padding-inline-end") ?? hook("row-padding-inline") ?? insetXs }
    var iconGap: Double { hook("icon-gap") ?? 0 }
    func flexHeight(subtitle: Bool) -> Double {
        model.variant == "medium"
            ? (subtitle ? hook("medium-height-with-subtitle") ?? 136 + 4 * s : hook("medium-height") ?? 112 + 4 * s)
            : (subtitle ? hook("large-height-with-subtitle") ?? 152 + 4 * s : hook("large-height") ?? 120 + 4 * s)
    }
    var searchHeight: Double { hook("search-container-height") ?? max(40, 56 + 4 * s) }
    /// The hint inset: 24 (inset-xl), at most 16 under 600 and 12 under 400 (start-aligned bars), never below 12.
    func searchPadStart(width: Double) -> Double {
        var v = hook("search-padding-inline-start") ?? insetXl
        if !model.centered { if width < 600 { v = min(16, v) }; if width < 400 { v = min(12, v) } }
        return max(12, v)
    }
    var searchPadEnd: Double { hook("search-padding-inline-end") ?? insetSm }
    var searchRowGap: Double { hook("search-row-gap") ?? gapSm }
    var searchTrailingGap: Double { hook("search-trailing-gap") ?? gapXs }
    var searchFieldTrailingGap: Double { hook("search-field-trailing-gap") ?? 6 }
    var trailingTouch: Double { hook("trailing-touch-size") ?? max(32, 48 + 4 * s) }
    // Typography (density tapers of title-large, headline-medium, label-large, title-medium and body-large).
    var titleSize: Double { max(16, 22 + s) }
    var titleLine: Double { max(22, 28 + s) }
    var headlineSize: Double { max(22, 28 + s) }
    var headlineLine: Double { max(28, 36 + 2 * s) }
    var subtitleSize: Double { model.variant == "large" ? max(13, 16 + 0.5 * s) : max(12, 14 + 0.5 * s) }
    var subtitleLine: Double { model.variant == "large" ? max(18, 24 + s) : max(16, 20 + s) }
    var subtitleTracking: Double { model.variant == "large" ? 0.15 : 0.1 }
    var inlineSubtitleSize: Double { max(12, 14 + 0.5 * s) }
    var inlineSubtitleLine: Double { max(16, 20 + s) }
    var inputSize: Double { max(13, 16 + 0.5 * s) }
    var inputLine: Double { max(18, 24 + s) }
}

/// Colors of the bar (theme roles unless hooked).
struct AWCAppBarPalette {
    let tokens: [String: String], a: AWCAppBarAppearance
    func role(_ k: String, _ f: String) -> String { tokens["--md-sys-color-" + k]?.uppercased() ?? f }
    func hook(_ n: String, _ k: String, _ f: String) -> String { AWCAppBarCSS.color(a[hook: n]) ?? role(k, f) }
    var container: String { hook("container-color", "surface", "#FFFBFE") }
    var containerScrolled: String { hook("container-color-scrolled", "surface-container", "#F3EDF7") }
    var headline: String { hook("headline-color", "on-surface", "#1C1B1F") }
    var subtitle: String { hook("subtitle-color", "on-surface-variant", "#49454F") }
    var leadingIcon: String { hook("leading-icon-color", "on-surface", "#1C1B1F") }
    var trailingIcon: String { hook("trailing-icon-color", "on-surface-variant", "#49454F") }
    var search: String { hook("search-container-color", "surface-container-highest", "#E6E0E9") }
    var searchScrolled: String { hook("search-container-color-scrolled", "surface-container", "#F3EDF7") }
    var placeholder: String { hook("search-placeholder-color", "on-surface-variant", "#49454F") }
    var input: String { hook("search-input-color", "on-surface", "#1C1B1F") }
    var searchTrailingIcon: String { hook("search-trailing-icon-color", "on-surface-variant", "#49454F") }
    var focusRing: String { role("secondary", "#625B71") }
    var shadows: [AWCBoxShadow] { a.containerElevation.flatMap { AWCBoxShadow.source($0) } ?? [] }
    var containerCorners: [Double] { AWCAppBarCSS.corners(a.containerShape) ?? [0, 0, 0, 0] }
    /// nil: corner-full (half the pill height).
    var searchCorners: [Double]? { AWCAppBarCSS.corners(a.searchContainerShape) }
}

/// Per-bar runtime: the editing text, focus and modality, pointer state and the CSS transition tracks.
@MainActor @Observable final class AWCAppBarRuntime {
    var editing = ""
    var focused = false
    var keyboardModality = false
    var hovered = false
    var pressed = false
    var scrolled = AWCCSSTransitionTrack()
    /// The pill's own background transition (instant under reduced motion, unlike the host's).
    var pillScrolled = AWCCSSTransitionTrack()
    var layer = AWCCSSTransitionTrack()
    var pillFrame: CGRect = .zero
    var pressInside = false
    /// Set while a pointer press moves focus into the input (that focus shows no ring).
    var pointerFocusing = false
    /// The caret (selection start, UTF-16) as of the last edit or selection change while focused; it survives the blur.
    var caret = 0
    var fieldFrame: CGRect = .zero
    /// The pill's md-ripple (pressed from the pill's own gesture, or from the host pointer state in embedding hosts).
    @ObservationIgnored let ripple = AWCRippleEngine()
    var primed = false
    var warnedCount = 0
    /// Bumped when the running transitions end: the body re-evaluates and pauses its timeline.
    var settled = 0
    @ObservationIgnored let input = AWCFieldInputHandle()
}

struct AWCNativeAppBar: View {
    let node: AWCNode, properties: [String: AWCValue], theme: AWCTheme
    let onEvent: (AWCEvent) -> Void, emit: (String, AWCValue) -> Void, setValue: (String) -> Void
    @Environment(\.awcAppBarAppearance) private var appearance
    @Environment(\.awcNativeDensity) private var density
    @Environment(\.awcNativeSpacingRung) private var rung
    @Environment(\.layoutDirection) private var direction
    @Environment(\.accessibilityReduceMotion) private var systemReduceMotion
    @Environment(\.awcAppBarReducedMotion) private var reducedOverride
    @Environment(\.awcNativePointerState) private var pointer
    @Environment(\.awcAppBarParts) private var parts
    private func pp(_ p: AWCAppBarPart) -> AWCAppBarPartAppearance? { parts[p] }
    /// A text part's typography and ink (part values win).
    private func typo(_ p: AWCAppBarPart, size: Double, line: Double, weight: Double, tracking: Double, color: String) -> (size: Double, line: Double, weight: Double, tracking: Double, color: String) {
        let v = parts[p]
        return (v?.fontSize ?? size, v?.lineHeight ?? line, v?.fontWeight ?? weight, v?.letterSpacing ?? tracking, v?.color ?? color)
    }
    private var reduceMotion: Bool { reducedOverride ?? systemReduceMotion }
    @State private var rt = AWCAppBarRuntime()
    @State private var width = 0.0
    private var model: AWCAppBarModel { AWCAppBarModel(properties) }
    private var rtl: Bool { direction == .rightToLeft }

    // MARK: slots
    private func slot(_ name: String) -> [AWCNode] { node.children.filter { ($0.slot ?? "") == name && $0.tag != "#comment" } }
    private func shownTrailing() -> [AWCNode] {
        // The source caps the SHOWN trailing actions at three; an action the author hid stays hidden and does not count.
        let shown = slot("trailing").filter { $0.properties["hidden"]?.bool != true }
        return Array(shown.prefix(3))
    }
    private var hasHeadlineSlot: Bool { !slot("headline").isEmpty }
    private var hasSubtitleSlot: Bool { !slot("subtitle").isEmpty }
    private var hasSubtitle: Bool { !model.subtitle.isEmpty || hasSubtitleSlot }

    var body: some View {
        let m = model
        if m.hidden { EmptyView() } else {
            let metrics = AWCAppBarMetrics(s: density, r: rung, a: appearance, model: m)
            let palette = AWCAppBarPalette(tokens: theme.tokens, a: appearance)
            let now = CACurrentMediaTime() * 1000
            let _ = rt.settled
            TimelineView(.animation(paused: !animating(now))) { _ in
                let t = CACurrentMediaTime() * 1000
                bar(m, metrics, palette, t)
                    // The transitions ended: the body re-evaluates and pauses the timeline. Left running, it re-rendered the bar
                    // on every display frame and, with a frame time in the inspection, published a new inspection every frame;
                    // a host update landing in such a frame could keep the previous inspection after the timeline paused (the
                    // Laboratory's `variant: search` update still read `medium`, 1 run in 2–3: r6-026, d2-064, n5-062).
                    .onChange(of: animating(t)) { _, live in if !live { rt.settled &+= 1 } }
            }
            .onChange(of: m.scrolled, initial: true) { _, next in
                let target = next ? 1.0 : 0
                if !rt.primed { rt.primed = true; rt.scrolled.snap(target); rt.pillScrolled.snap(target); return }
                // CSS transitions (short2 100 ms, standard), starting two frames after the change as Chrome does. Reduced
                // motion shortens only the pill's (0.01 ms); the host keeps its background-color transition.
                let at = CACurrentMediaTime() * 1000 + 2000.0 / 60
                rt.scrolled.set(target, now: at, duration: 100, curve: [0.2, 0, 0, 1])
                if reduceMotion { rt.pillScrolled.set(target, now: at, duration: 0.01, curve: [0.2, 0, 0, 1]) }
                else { rt.pillScrolled.set(target, now: at, duration: 100, curve: [0.2, 0, 0, 1]) }
            }
            .onChange(of: m.value, initial: true) { _, v in if rt.editing != v { rt.editing = v } }
            // A host write of searchValue replaces the typed text in the update that brings it (the host's own property; the
            // merged value follows an update later, when the macOS input's inspected value kept the typed text: n5-058 / n5-059).
            .onChange(of: node.properties["searchValue"]) { _, v in let text = v?.string ?? ""; if rt.editing != text { rt.editing = text } }
            .onAppear { warnTrailingCap() }
            .onChange(of: node.children) { _, _ in warnTrailingCap() }
        }
    }
    /// A transition of the bar is running (or scheduled) at `t`.
    private func animating(_ t: Double) -> Bool { rt.scrolled.isRunning(t) || rt.pillScrolled.isRunning(t) || rt.layer.isRunning(t) }
    private func warnTrailingCap() {
        let shown = slot("trailing").filter { $0.properties["hidden"]?.bool != true }.count
        let over = shown > 3 ? shown : 0
        if over > 0 && over != rt.warnedCount {
            let message = "[md-app-bar] The trailing slot supports at most 3 action icons; \(shown) were provided. Icons beyond the limit are hidden."
            AWCAppBarDiagnostics.warnings.append(message); print(message)
        }
        rt.warnedCount = over
    }

    @ViewBuilder private func bar(_ m: AWCAppBarModel, _ g: AWCAppBarMetrics, _ c: AWCAppBarPalette, _ t: Double) -> some View {
        let scrolledP = rt.scrolled.presented(t)
        let fill = AWCAppBarColor.mix(c.container, c.containerScrolled, scrolledP)
        let corners = c.containerCorners
        let shape = UnevenRoundedRectangle(topLeadingRadius: corners[0], bottomLeadingRadius: corners[3], bottomTrailingRadius: corners[2], topTrailingRadius: corners[1], style: .circular)
        VStack(spacing: 0) {
            if m.search { searchRow(m, g, c, t, rt.pillScrolled.presented(t)) } else { row(m, g, c) }
            if m.flexible { expanded(m, g, c) }
        }
        .frame(maxWidth: .infinity, minHeight: m.flexible ? g.flexHeight(subtitle: hasSubtitle) : nil, alignment: .top)
        .background {
            ZStack {
                // container-elevation: the shared CSS box-shadow painter (outer layers, clipped out of the border box).
                if !c.shadows.isEmpty {
                    AWCNativeBoxShadow(corners: AWCCornerShape(topLeft: .init(.points(corners[0])), topRight: .init(.points(corners[1])),
                                                               bottomRight: .init(.points(corners[2])), bottomLeft: .init(.points(corners[3]))),
                                       layers: c.shadows, placement: .outer)
                }
                shape.fill(Color(awcHex: fill))
            }
            .environment(\.layoutDirection, .leftToRight)
        }
        .onGeometryChange(for: Double.self) { Double($0.size.width) } action: { width = $0 }
        .awcInspect(nodeID: node.id, name: "md-app-bar") { _ in
            var x: [String: AWCValue] = ["variant": .string(m.variant), "scrolled": .bool(m.scrolled), "fill": .string(fill), "role": "banner", "warned": .number(Double(rt.warnedCount))]
            // renderTime, while a transition runs: the frame these values were computed for (inspection reaches a reader frames
            // later). A settled bar reports none: its inspection changes only when the bar does.
            if animating(t) { x["renderTime"] = .number(t) }
            return x
        }
        .accessibilityElement(children: .contain)
    }

    // MARK: leading / trailing
    @ViewBuilder private func leading(_ m: AWCAppBarModel, _ g: AWCAppBarMetrics, _ c: AWCAppBarPalette) -> some View {
        let slotted = slot("leading")
        HStack(spacing: 0) {
            if !slotted.isEmpty {
                ForEach(slotted) { child in
                    AWCNativeView(node: child, onEvent: onEvent)
                        .scaleEffect(x: rtl && child.properties["data-directional"] != nil ? -1 : 1, y: 1)
                }
            } else if !m.leadingIcon.isEmpty {
                let sl = pp(.stateLayer)
                AWCNativeView(node: AWCNode(id: node.id + "-leading-icon", tag: "md-icon-button",
                                            properties: ["icon": .string(m.leadingIcon), "variant": "standard", "size": "md", "buttonWidth": "narrow",
                                                         "aria-label": m.leadingIconLabel.isEmpty ? .null : .string(m.leadingIconLabel)])) { e in
                    if e.name == "mdClick" { emit("mdLeadingClick", .null) }
                }
                // The exported icon / state-layer parts: the glyph's ink; a fixed state layer (the button's own one is replaced).
                .awcIconButtonAppearance(AWCIconButtonAppearance(iconColor: pp(.icon)?.color ?? c.leadingIcon, stateLayerColor: sl == nil ? c.leadingIcon : "#00000000",
                                                                 iconSize: g.iconSize, width: g.iconButton, height: g.iconButton))
                .overlay { if let sl, let bg = sl.backgroundColor { Capsule().fill(Color(awcHex: bg)).opacity(sl.opacity ?? 0).allowsHitTesting(false) } }
                .modifier(AWCAppBarPartBox(value: pp(.leadingIcon)))
                .awcInspect(nodeID: node.id, part: "leading-icon", name: "leading-icon")
            }
        }
        .awcIconButtonAppearance(AWCIconButtonAppearance(iconColor: c.leadingIcon, stateLayerColor: c.leadingIcon, iconSize: g.iconSize, width: g.iconButton, height: g.iconButton))
        .foregroundStyle(Color(awcHex: c.leadingIcon))
    }
    @ViewBuilder private func trailing(_ g: AWCAppBarMetrics, _ c: AWCAppBarPalette) -> some View {
        HStack(spacing: g.trailingGap) {
            ForEach(shownTrailing()) { child in AWCNativeView(node: child, onEvent: onEvent) }
        }
        .awcIconButtonAppearance(AWCIconButtonAppearance(iconColor: c.trailingIcon, stateLayerColor: c.trailingIcon, iconSize: g.iconSize, width: g.trailingIconTouch, height: g.trailingIconTouch))
        .awcAvatarAppearance(AWCAvatarAppearance(size: .points(g.avatar)))
        .foregroundStyle(Color(awcHex: c.trailingIcon))
    }

    // MARK: text
    private func text(_ s: String, size: Double, line: Double, weight: Double, tracking: Double, color: String, lines: Int? = 1) -> some View {
        Text(s).font(AWCNativeFonts.label(size: size, weight: weight)).tracking(tracking).lineLimit(lines).truncationMode(.tail)
            .modifier(AWCCSSLineBox(size: size, line: line)).foregroundStyle(Color(awcHex: color))
    }
    /// Slotted text content (`<span slot>` text runs; `<b>` runs bold).
    private func slotText(_ nodes: [AWCNode], size: Double, line: Double, weight: Double, tracking: Double, color: String, lines: Int? = 1) -> some View {
        func runs(_ n: AWCNode, bold: Bool) -> Text {
            if n.tag == "#text" { let t = Text(n.properties["text"]?.string ?? ""); return bold ? t.bold() : t }
            return n.children.reduce(Text("")) { $0 + runs($1, bold: bold || n.tag == "b" || n.tag == "strong") }
        }
        let combined = nodes.reduce(Text("")) { $0 + runs($1, bold: false) }
        return combined.font(AWCNativeFonts.label(size: size, weight: weight)).tracking(tracking).lineLimit(lines).truncationMode(.tail)
            .modifier(AWCCSSLineBox(size: size, line: line)).foregroundStyle(Color(awcHex: color))
    }
    @ViewBuilder private func partText(_ p: AWCAppBarPart, _ s: String, size: Double, line: Double, weight: Double, tracking: Double, color: String, lines: Int? = 1) -> some View {
        let t = typo(p, size: size, line: line, weight: weight, tracking: tracking, color: color)
        text(s, size: t.size, line: t.line, weight: t.weight, tracking: t.tracking, color: t.color, lines: lines)
    }
    @ViewBuilder private func partSlotText(_ p: AWCAppBarPart, _ nodes: [AWCNode], size: Double, line: Double, weight: Double, tracking: Double, color: String, lines: Int? = 1) -> some View {
        let t = typo(p, size: size, line: line, weight: weight, tracking: tracking, color: color)
        slotText(nodes, size: t.size, line: t.line, weight: t.weight, tracking: t.tracking, color: t.color, lines: lines)
    }
    private func titleWidth(_ m: AWCAppBarModel, _ g: AWCAppBarMetrics) -> Double {
        let t = !m.headline.isEmpty ? m.headline : m.flexible ? "" : slot("headline").map { awcAppBarText($0) }.joined()
        let s = !m.subtitle.isEmpty ? m.subtitle : m.flexible ? "" : slot("subtitle").map { awcAppBarText($0) }.joined()
        let tt = typo(.title, size: g.titleSize, line: g.titleLine, weight: 400, tracking: 0, color: ""), st = typo(.subtitle, size: g.inlineSubtitleSize, line: g.inlineSubtitleLine, weight: 500, tracking: 0.1, color: "")
        let tw = t.isEmpty ? 0 : AWCNativeMeterText(text: t, size: tt.size, lineHeight: tt.line, weight: tt.weight, spacing: tt.tracking, tabular: false, usesDefaultKerning: true).naturalWidth
        let sw = s.isEmpty ? 0 : AWCNativeMeterText(text: s, size: st.size, lineHeight: st.line, weight: st.weight, spacing: st.tracking, tabular: false, usesDefaultKerning: true).naturalWidth
        return max(tw, sw)
    }

    // MARK: row (small / medium / large)
    @ViewBuilder private func inlineHeadline(_ m: AWCAppBarModel, _ g: AWCAppBarMetrics, _ c: AWCAppBarPalette) -> some View {
        VStack(alignment: m.centered ? .center : .leading, spacing: 0) {
            if !m.headline.isEmpty {
                partText(.title, m.headline, size: g.titleSize, line: g.titleLine, weight: 400, tracking: 0, color: c.headline).frame(maxWidth: m.centered ? nil : .infinity, alignment: .leading)
                    .modifier(AWCAppBarPartBox(value: pp(.title))).awcInspect(nodeID: node.id, part: "title", name: "title")
            } else if !m.flexible && hasHeadlineSlot {
                partSlotText(.title, slot("headline"), size: g.titleSize, line: g.titleLine, weight: 400, tracking: 0, color: c.headline).frame(maxWidth: m.centered ? nil : .infinity, alignment: .leading)
                    .modifier(AWCAppBarPartBox(value: pp(.title))).awcInspect(nodeID: node.id, part: "title", name: "title")
            }
            if !m.subtitle.isEmpty {
                partText(.subtitle, m.subtitle, size: g.inlineSubtitleSize, line: g.inlineSubtitleLine, weight: 500, tracking: 0.1, color: c.subtitle).frame(maxWidth: m.centered ? nil : .infinity, alignment: .leading)
                    .modifier(AWCAppBarPartBox(value: pp(.subtitle)))
                    .awcInspect(nodeID: node.id, part: m.flexible ? "inline-subtitle" : "subtitle", name: "subtitle").padding(.top, 2)
            } else if !m.flexible && hasSubtitleSlot {
                partSlotText(.subtitle, slot("subtitle"), size: g.inlineSubtitleSize, line: g.inlineSubtitleLine, weight: 500, tracking: 0.1, color: c.subtitle).frame(maxWidth: m.centered ? nil : .infinity, alignment: .leading)
                    .modifier(AWCAppBarPartBox(value: pp(.subtitle)))
                    .awcInspect(nodeID: node.id, part: m.flexible ? "inline-subtitle" : "subtitle", name: "subtitle").padding(.top, 2)
            }
        }
        .padding(.horizontal, m.centered ? g.insetSm : g.insetMd)
        .opacity(m.flexible ? 0 : 1)
        .accessibilityHidden(m.flexible)
        .awcInspect(nodeID: node.id, part: "headline-inline", name: "headline-inline") { _ in ["opacity": .number(m.flexible ? 0 : 1)] }
    }
    private func hasInline(_ m: AWCAppBarModel) -> Bool { !m.headline.isEmpty || (!m.flexible && hasHeadlineSlot) || !m.subtitle.isEmpty || (!m.flexible && hasSubtitleSlot) }
    @ViewBuilder private func row(_ m: AWCAppBarModel, _ g: AWCAppBarMetrics, _ c: AWCAppBarPalette) -> some View {
        // Start-aligned large rows align their items to the top (flex-start); the centred grid centres them.
        let align: VerticalAlignment = m.variant == "large" && !m.centered ? .top : .center
        let inner = max(0, width - g.padStart - g.padEnd)
        Group {
            if m.centered {
                // Grid: minmax(icon button, 1fr) | minmax(0, auto) | minmax(icon button, 1fr).
                let hasTitle = hasInline(m)
                let titleW = hasTitle ? titleWidth(m, g) + 2 * g.insetSm : 0
                let free = max(0, inner - 2 * g.iconGap)
                let center = min(titleW, max(0, free - 2 * g.iconButton))
                let side = max(g.iconButton, (free - center) / 2)
                HStack(alignment: align, spacing: g.iconGap) {
                    leading(m, g, c).modifier(AWCAppBarPartBox(value: pp(.leading))).awcInspect(nodeID: node.id, part: "leading", name: "leading").frame(width: side, alignment: .leading)
                    // The headline keeps its max-content width (justify-self: center) and overflows its track evenly.
                    Group { if hasTitle { inlineHeadline(m, g, c).fixedSize(horizontal: true, vertical: false) } else { Color.clear.frame(height: 0) } }.frame(width: center)
                    trailing(g, c).modifier(AWCAppBarPartBox(value: pp(.trailing))).awcInspect(nodeID: node.id, part: "trailing", name: "trailing").frame(width: side, alignment: .trailing)
                }
            } else {
                HStack(alignment: align, spacing: g.iconGap) {
                    leading(m, g, c).modifier(AWCAppBarPartBox(value: pp(.leading))).awcInspect(nodeID: node.id, part: "leading", name: "leading")
                    if hasInline(m) { inlineHeadline(m, g, c).frame(maxWidth: .infinity, alignment: .leading) } else { Spacer(minLength: 0) }
                    trailing(g, c).modifier(AWCAppBarPartBox(value: pp(.trailing))).awcInspect(nodeID: node.id, part: "trailing", name: "trailing")
                }
            }
        }
        .frame(height: g.rowHeight, alignment: Alignment(horizontal: .center, vertical: align))
        .padding(.leading, g.padStart).padding(.trailing, g.padEnd).padding(.top, g.rowPadTop)
        .frame(maxWidth: .infinity)
        .modifier(AWCAppBarPartBox(value: pp(.row)))
        .awcInspect(nodeID: node.id, part: "row", name: "row")
    }
    @ViewBuilder private func expanded(_ m: AWCAppBarModel, _ g: AWCAppBarMetrics, _ c: AWCAppBarPalette) -> some View {
        VStack(alignment: m.centered ? .center : .leading, spacing: 0) {
            Group {
                if !m.headline.isEmpty { partText(.expandedHeadline, m.headline, size: g.headlineSize, line: g.headlineLine, weight: 400, tracking: 0, color: c.headline, lines: nil) }
                else { partSlotText(.expandedHeadline, slot("headline"), size: g.headlineSize, line: g.headlineLine, weight: 400, tracking: 0, color: c.headline, lines: nil) }
            }
            .multilineTextAlignment(m.centered ? .center : .leading)
            .fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: m.centered ? nil : .infinity, alignment: .leading)
            .modifier(AWCAppBarPartBox(value: pp(.expandedHeadline)))
            .awcInspect(nodeID: node.id, part: "expanded-headline", name: "expanded-headline")
            if hasSubtitle {
                Group {
                    if !m.subtitle.isEmpty { partText(.subtitle, m.subtitle, size: g.subtitleSize, line: g.subtitleLine, weight: 500, tracking: g.subtitleTracking, color: c.subtitle, lines: nil) }
                    else { partSlotText(.subtitle, slot("subtitle"), size: g.subtitleSize, line: g.subtitleLine, weight: 500, tracking: g.subtitleTracking, color: c.subtitle, lines: nil) }
                }
                .multilineTextAlignment(m.centered ? .center : .leading)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: m.centered ? nil : .infinity, alignment: .leading)
                .modifier(AWCAppBarPartBox(value: pp(.subtitle)))
                .awcInspect(nodeID: node.id, part: "subtitle", name: "subtitle")
                .padding(.top, 2)
            }
        }
        .padding(.horizontal, g.expandedPadInline).padding(.bottom, g.expandedPadBottom)
        // height: auto with the variant's min-height: the block fills what the row leaves and grows with a wrapped headline.
        .frame(maxWidth: .infinity, minHeight: max(0, g.flexHeight(subtitle: hasSubtitle) - g.rowHeight - g.rowPadTop), alignment: m.centered ? .bottom : .bottomLeading)
        .clipped()
        .modifier(AWCAppBarPartBox(value: pp(.expanded)))
        .awcInspect(nodeID: node.id, part: "expanded", name: "expanded")
    }

    // MARK: search row
    @ViewBuilder private func searchRow(_ m: AWCAppBarModel, _ g: AWCAppBarMetrics, _ c: AWCAppBarPalette, _ t: Double, _ scrolledP: Double) -> some View {
        HStack(spacing: g.searchRowGap) {
            leading(m, g, c).frame(minWidth: g.iconButton).modifier(AWCAppBarPartBox(value: pp(.leading))).awcInspect(nodeID: node.id, part: "leading", name: "leading")
            pill(m, g, c, t, scrolledP)
                .frame(maxWidth: .infinity).frame(height: g.rowHeight)
                .modifier(AWCAppBarPartBox(value: pp(.searchHost)))
                .awcInspect(nodeID: node.id, part: "search-host", name: "search-host")
            trailing(g, c).frame(minWidth: g.trailingTouch, minHeight: g.trailingTouch).modifier(AWCAppBarPartBox(value: pp(.trailing))).awcInspect(nodeID: node.id, part: "trailing", name: "trailing")
        }
        .frame(height: g.rowHeight)
        .padding(.leading, g.padStart).padding(.trailing, g.padEnd).padding(.top, g.rowPadTop)
        .frame(maxWidth: .infinity)
        .modifier(AWCAppBarPartBox(value: pp(.row)))
        .awcInspect(nodeID: node.id, part: "row", name: "row")
    }
    private func searchTrailing(_ width: Double) -> [AWCNode] {
        let all = slot("search-trailing")
        // Compact bars (< 600) hide the second and later in-pill items unless they carry data-compact-keep.
        return all.enumerated().filter { i, n in width >= 600 || i == 0 || n.properties["data-compact-keep"] != nil }.map(\.element)
    }
    @ViewBuilder private func pill(_ m: AWCAppBarModel, _ g: AWCAppBarMetrics, _ c: AWCAppBarPalette, _ t: Double, _ scrolledP: Double) -> some View {
        let disabled = m.searchDisabled
        let inPill = searchTrailing(width)
        let hasTrailing = !slot("search-trailing").isEmpty
        // The search part wins over the hooks and the scrolled rule (colour, corners, opacity).
        let sp = pp(.search)
        let fill = sp?.backgroundColor ?? AWCAppBarColor.mix(c.search, c.searchScrolled, scrolledP)
        let radius: [Double]? = sp?.cornerShape.map { s in [s.topLeft, s.topRight, s.bottomRight, s.bottomLeft].map { Double($0.x.points) } } ?? c.searchCorners
        let shape = UnevenRoundedRectangle(topLeadingRadius: radius?[0] ?? g.searchHeight / 2, bottomLeadingRadius: radius?[3] ?? g.searchHeight / 2,
                                           bottomTrailingRadius: radius?[2] ?? g.searchHeight / 2, topTrailingRadius: radius?[1] ?? g.searchHeight / 2, style: .circular)
        let padStart = g.searchPadStart(width: width)
        // The state layer is `display: none` on a disabled search; hover / press still drive its (hidden) opacity.
        let layer = pp(.searchStateLayer)?.opacity ?? (disabled ? 0 : rt.layer.presented(t))
        let ring = rt.focused && rt.keyboardModality && !disabled
        let hovered = pointer.map { p in p.location.map { rt.pillFrame.contains($0) } ?? false } ?? rt.hovered
        // :active also follows a host pointer press that began on the pill (embedding hosts drive input through the pointer state).
        let pointerPressed = pointer.map { p in p.isPointerDown && (p.pressLocation.map { rt.pillFrame.contains($0) } ?? false) } ?? false
        let pressed = rt.pressed || pointerPressed
        let layerTarget = pressed ? 0.12 : hovered ? 0.08 : 0
        let rippleOn = !disabled && theme.tokens["--md-sys-ripple-enabled"]?.trimmingCharacters(in: .whitespaces) != "0"
        let rippleRadius = CGFloat(min(radius?.min() ?? g.searchHeight / 2, g.searchHeight / 2))
        HStack(spacing: g.iconGap) {
            field(m, g, c, padStart: padStart)
            if hasTrailing {
                HStack(spacing: g.searchTrailingGap) { ForEach(inPill) { child in AWCNativeView(node: child, onEvent: onEvent) } }
                    .awcIconButtonAppearance(AWCIconButtonAppearance(iconColor: c.searchTrailingIcon, stateLayerColor: c.searchTrailingIcon, iconSize: g.iconSize, width: g.iconButton, height: g.iconButton))
                    .foregroundStyle(Color(awcHex: c.searchTrailingIcon))
                    .modifier(AWCAppBarPartBox(value: pp(.searchTrailing)))
                    .awcInspect(nodeID: node.id, part: "search-trailing", name: "search-trailing")
                    .padding(.leading, g.searchFieldTrailingGap)
            }
        }
        .padding(.trailing, hasTrailing ? g.searchPadEnd : 0)
        .frame(height: g.searchHeight)
        .background {
            ZStack {
                shape.fill(Color(awcHex: fill))
                shape.fill(Color(awcHex: pp(.searchStateLayer)?.backgroundColor ?? c.input)).opacity(layer)
                    .awcInspect(nodeID: node.id, part: "search-state-layer", name: "search-state-layer") { _ in ["opacity": .number(layer)] }
            }.environment(\.layoutDirection, .leftToRight)
        }
        .overlay {
            // CSS outline 3 px at offset 2 px: the stroke's centre line sits 3.5 outside the pill, its radii grown by as much.
            if ring {
                let o = 3.5, r0 = radius?[0] ?? g.searchHeight / 2, r1 = radius?[1] ?? g.searchHeight / 2, r2 = radius?[2] ?? g.searchHeight / 2, r3 = radius?[3] ?? g.searchHeight / 2
                UnevenRoundedRectangle(topLeadingRadius: r0 + o, bottomLeadingRadius: r3 + o, bottomTrailingRadius: r2 + o, topTrailingRadius: r1 + o, style: .circular)
                    .stroke(Color(awcHex: c.focusRing), lineWidth: 3).padding(-o).environment(\.layoutDirection, .leftToRight)
            }
        }
        // md-ripple (grow short2 100 ms, standard; no inline extent) in the pill's current colour; none while disabled.
        .overlay {
            AWCRippleWaveLayer(engine: rt.ripple, color: Color(awcHex: c.input), cornerRadius: rippleRadius, enabled: rippleOn, hidden: false, testTime: nil, inspectNodeID: nil)
                .allowsHitTesting(false)
        }
        .onGeometryChange(for: CGSize.self) { $0.size } action: { rt.ripple.size = $0 }
        .onAppear {
            rt.ripple.appearance = AWCRippleAppearance(extendInline: 0, growDuration: 100, growEasing: "cubic-bezier(0.2, 0, 0, 1)")
            rt.ripple.connected = true; rt.ripple.disabled = disabled
        }
        .onDisappear { rt.ripple.connected = false; rt.ripple.finish() }
        .onChange(of: disabled) { _, d in rt.ripple.disabled = d; if d { rt.ripple.finish() } }
        .onChange(of: pointer?.pressSequence) { _, _ in
            guard let p = pointer, p.isPointerDown, let at = p.pressLocation, rt.pillFrame.contains(at) else { return }
            if rippleOn { rt.ripple.press(at: CGPoint(x: at.x - rt.pillFrame.minX, y: at.y - rt.pillFrame.minY)) }
            // mousedown on the field focuses the input at once (a pointer focus: no ring).
            if rt.fieldFrame.contains(at), slot("search").isEmpty, !disabled, !rt.focused { rt.pointerFocusing = true; _ = rt.input.focus() }
        }
        .onChange(of: pointer?.isPointerDown) { _, down in if down == false { rt.ripple.release() } }
        .opacity(sp?.opacity ?? (disabled ? 0.38 : 1))
        .contentShape(shape)
        .onGeometryChange(for: CGRect.self) { $0.frame(in: .named("awc-native-preview")) } action: { rt.pillFrame = $0 }
        .onContinuousHover { phase in
            var inside = false; if case .active = phase { inside = true }
            if rt.hovered != inside { rt.hovered = inside }
        }
        .simultaneousGesture(DragGesture(minimumDistance: 0)
            .onChanged { v in if !rt.pressed { rt.pressed = true; if pointer == nil && rippleOn { rt.ripple.press(at: v.startLocation) } } }
            .onEnded { _ in rt.pressed = false; if pointer == nil { rt.ripple.release() } })
        .onChange(of: layerTarget) { _, target in updateLayer(target) }
        .awcInspect(nodeID: node.id, part: "search", name: "search") { _ in
            var x: [String: AWCValue] = ["fill": .string(fill), "focused": .bool(rt.focused), "focusRing": .bool(ring), "opacity": .number(disabled ? 0.38 : 1), "layer": .number(layer),
                                         "layerOpacity": .number(rt.layer.presented(CACurrentMediaTime() * 1000)), "hovered": .bool(hovered), "pressed": .bool(rt.pressed)]
            // The time this frame's values were computed for, while a transition runs (as the host's renderTime).
            if animating(t) { x["renderTime"] = .number(t) }
            return x
        }
    }
    /// State layer (:hover 8 %, :active 12 %): opacity transition short1 50 ms, standard easing, starting two frames after the
    /// input as Chrome does; reduced motion keeps it (only the pill's own transitions are shortened).
    private func updateLayer(_ target: Double) {
        rt.layer.set(target, now: CACurrentMediaTime() * 1000 + 1000.0 / 60, duration: 50, curve: [0.2, 0, 0, 1])
    }
    @ViewBuilder private func field(_ m: AWCAppBarModel, _ g: AWCAppBarMetrics, _ c: AWCAppBarPalette, padStart: Double) -> some View {
        let slotted = slot("search")
        Group {
            if !slotted.isEmpty {
                // Slotted search content is inline text: its box is the font's content area (line-height normal).
                // The field's own hint inset applies to slotted content (start-aligned bars; the input carries it otherwise).
                slotText(slotted, size: g.inputSize, line: g.inputSize * 1.171875, weight: 400, tracking: 0.5, color: pp(.searchContent)?.color ?? c.input)
                    .opacity(pp(.searchContent)?.opacity ?? 1)
                    .padding(.leading, m.centered ? 0 : padStart)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .awcInspect(nodeID: node.id, part: "search-content", name: "search-content")
            } else {
                AWCFieldTextInput(config: inputConfig(m, g, c), events: inputEvents(m), handle: rt.input)
                    .opacity(pp(.searchInput)?.opacity ?? 1)
                    .padding(.leading, padStart).padding(.trailing, m.centered ? padStart : 0)
                    .frame(maxWidth: .infinity).frame(height: g.inputLine)
                    .awcInspect(nodeID: node.id, part: "search-input", name: "search-input") { _ in
                        ["value": .string(rt.editing), "placeholder": .string(m.placeholder), "label": .string(m.searchLabel), "disabled": .bool(m.searchDisabled), "padStart": .number(padStart),
                         "selection": .number(Double(min(rt.caret, rt.editing.utf16.count))), "placeholderCentered": .bool(m.centered)]
                    }
            }
        }
        .frame(maxWidth: .infinity)
        .modifier(AWCAppBarPartBox(value: pp(.searchField)))
        .contentShape(Rectangle())
        .onGeometryChange(for: CGRect.self) { $0.frame(in: .named("awc-native-preview")) } action: { rt.fieldFrame = $0 }
        .simultaneousGesture(DragGesture(minimumDistance: 0).onChanged { _ in
            // A press on the field focuses the input at once (mousedown default action); the focus is a pointer focus (no ring).
            guard slotted.isEmpty, !m.searchDisabled, !rt.focused else { return }
            rt.pointerFocusing = true; _ = rt.input.focus()
        })
        .awcInspect(nodeID: node.id, part: "search-field", name: "search-field")
        // A selection-only change (Home / End, arrows, a click) moves the caret without an edit.
        .modifier(AWCAppBarSelectionWatch { at in if rt.focused, rt.caret != at { rt.caret = at } })
    }
    private func inputConfig(_ m: AWCAppBarModel, _ g: AWCAppBarMetrics, _ c: AWCAppBarPalette) -> AWCFieldInputConfig {
        var x = AWCFieldInputConfig()
        x.text = rt.editing; x.fontSize = pp(.searchInput)?.fontSize ?? g.inputSize; x.lineHeight = g.inputLine; x.tracking = 0.5; x.weight = 400
        x.color = pp(.searchInput)?.color ?? c.input; x.caret = pp(.searchInput)?.color ?? c.input; x.placeholder = m.placeholder; x.placeholderColor = c.placeholder
        x.rtl = rtl; x.enabled = !m.searchDisabled; x.editable = !m.searchDisabled
        // Centred bars centre the placeholder (::placeholder text-align), focused or not; typed text stays at the start.
        x.centered = m.centered && rt.editing.isEmpty
        x.type = "text"; x.inputMode = "search"; x.enterKeyHint = "search"; x.autocomplete = "off"; x.spellcheck = false
        x.accessibilityLabel = m.searchLabel; x.role = "searchbox"
        #if os(iOS)
        // The hardware Home / End (and ↑ / ↓) reach the field as its navigation keys; the bar takes none of them, so the field
        // moves its caret to the start / end as Chrome's input does (UITextField alone does not).
        x.navigationKeys = true
        #endif
        return x
    }
    private func inputEvents(_ m: AWCAppBarModel) -> AWCFieldInputEvents {
        var e = AWCFieldInputEvents()
        e.edited = { text, caret, composing in
            let previous = rt.editing
            rt.keyboardModality = true
            // Space announces activation before the character lands (the source's keydown), then the input event.
            if !composing, text.count == previous.count + 1, text.filter({ $0 == " " }).count == previous.filter({ $0 == " " }).count + 1 { emit("mdSearchActivate", ["value": .string(previous)]) }
            rt.editing = text; rt.caret = caret; setValue(text); emit("mdSearchInput", ["value": .string(text)])
            return nil
        }
        e.selectionChanged = { start, _ in if rt.focused { rt.caret = start } }
        e.focusChanged = { focused in
            // :focus-visible: a focus the pointer gave shows no ring until the user types; any other focus (Tab, focus()) does.
            let keyboard = focused && !rt.pointerFocusing
            rt.keyboardModality = keyboard; rt.pointerFocusing = false
            rt.focused = focused
            // Sequential (Tab / Shift+Tab) focus selects the input's text, as Chrome does; a pointer focus places the caret.
            if keyboard && !rt.editing.isEmpty { DispatchQueue.main.async { rt.input.selectAll(); rt.caret = 0 } }
            if focused && !m.searchDisabled { emit("mdSearchActivate", ["value": .string(rt.editing)]) }
        }
        e.command = { key, composing in
            guard !composing else { return false }
            if key == "Enter" || key == "Return" { rt.keyboardModality = true; emit("mdSearchActivate", ["value": .string(rt.editing)]); return true }
            return false
        }
        return e
    }
}

/// The text content of a slotted node (text runs and nested elements).
func awcAppBarText(_ n: AWCNode) -> String { n.tag == "#text" ? (n.properties["text"]?.string ?? "") : n.children.map(awcAppBarText).joined() }

enum AWCAppBarColor {
    /// sRGB interpolation of two #RRGGBB[AA] colors (CSS transitions interpolate premultiplied sRGB; these are opaque roles).
    static func mix(_ a: String, _ b: String, _ p: Double) -> String {
        if p <= 0 { return a }; if p >= 1 { return b }
        func c(_ h: String) -> [Double] { let s = Array(h.dropFirst()); return stride(from: 0, to: min(8, s.count), by: 2).map { Double(Int(String(s[$0...$0 + 1]), radix: 16) ?? 0) } + (s.count == 6 ? [255] : []) }
        let x = c(a), y = c(b)
        let alpha = x[3] + (y[3] - x[3]) * p
        func ch(_ i: Int) -> Int { alpha <= 0 ? 0 : Int((((x[i] * x[3]) + ((y[i] * y[3]) - (x[i] * x[3])) * p) / alpha).rounded()) }
        return String(format: "#%02X%02X%02X%02X", ch(0), ch(1), ch(2), Int(alpha.rounded()))
    }
}

extension AWCNativeView {
    var nativeAppBar: some View {
        AWCNativeAppBar(node: node, properties: local, theme: theme, onEvent: onEvent, emit: { emit($0, $1) }, setValue: { set("searchValue", .string($0)) })
    }
}

/// macOS: the field editor reports selection changes of a single-line field only through NSTextView's notification.
private struct AWCAppBarSelectionWatch: ViewModifier {
    let changed: (Int) -> Void
    func body(content: Content) -> some View {
        #if canImport(AppKit)
        // Only the editing field editor (the window's first responder): resigning resets its selection, which the input keeps.
        content.onReceive(NotificationCenter.default.publisher(for: NSTextView.didChangeSelectionNotification)) { note in
            guard let tv = note.object as? NSTextView, tv.window?.firstResponder === tv else { return }
            changed(tv.selectedRange().location)
        }
        #else
        content
        #endif
    }
}
