import SwiftUI
import Observation
import QuartzCore

private extension View {
    /// macOS: the fallback actions read in source order (Cancel, OK). SwiftUI listed their platform focus elements in the
    /// opposite order; an AppKit container element lists them in reading order (see AWCNativeContainerAccessibilityView).
    @ViewBuilder func awcDialogFallbackActionsReadingOrder(id: String, active: Bool) -> some View {
        #if os(macOS)
        if active {
            self.accessibilityHidden(true).background {
                AWCNativeContainerAccessibilityBridge(role: "AXGroup", label: "", identifier: id + ".actions", level: 0, members: .all)
            }
        } else { self }
        #else
        self
        #endif
    }
}

/// Slot content of a native dialog (source slots: default, headline, icon, actions, header-action).
public struct AWCDialogSlots {
    public var content: AnyView?, headline: AnyView?, icon: AnyView?, actions: AnyView?, headerAction: AnyView?
    public init(content: AnyView? = nil, headline: AnyView? = nil, icon: AnyView? = nil, actions: AnyView? = nil, headerAction: AnyView? = nil) {
        self.content = content; self.headline = headline; self.icon = icon; self.actions = actions; self.headerAction = headerAction
    }
}

/// Source methods: `show()`, `close()` and `whenClosed()` (resolves once the open cycle and the shell exit
/// motion have finished; immediately under reduced motion).
@MainActor @Observable public final class AWCDialogController {
    @ObservationIgnored var showAction: () -> Void = {}
    @ObservationIgnored var closeAction: () -> Void = {}
    @ObservationIgnored var openState: () -> Bool = { false }
    @ObservationIgnored var exitEnd: Double = 0
    public init() {}
    public var isOpen: Bool { openState() }
    public func show() { showAction() }
    public func close() { closeAction() }
    public func whenClosed() async {
        while openState() || CACurrentMediaTime() * 1000 < exitEnd { try? await Task.sleep(nanoseconds: 4_000_000) }
    }
}
private struct AWCDialogControllersKey: EnvironmentKey { static let defaultValue: [String: AWCDialogController] = [:] }
private struct AWCModalReducedMotionKey: EnvironmentKey { static let defaultValue: Bool? = nil }
extension EnvironmentValues {
    var awcDialogControllers: [String: AWCDialogController] { get { self[AWCDialogControllersKey.self] } set { self[AWCDialogControllersKey.self] = newValue } }
    /// Test/host override of `prefers-reduced-motion` for the modal family.
    var awcModalReducedMotion: Bool? { get { self[AWCModalReducedMotionKey.self] } set { self[AWCModalReducedMotionKey.self] = newValue } }
}
private struct AWCDialogControllerModifier: ViewModifier {
    let controller: AWCDialogController, id: String
    @Environment(\.awcDialogControllers) private var controllers
    func body(content: Content) -> some View { var c = controllers; c[id] = controller; return content.environment(\.awcDialogControllers, c) }
}
public extension View {
    /// Attach a controller to the md-dialog `id` rendered below.
    func awcDialogController(_ controller: AWCDialogController, for id: String) -> some View { modifier(AWCDialogControllerModifier(controller: controller, id: id)) }
    /// Override reduced motion for the modal family (defaults to the system setting).
    func awcModalReducedMotion(_ value: Bool?) -> some View { environment(\.awcModalReducedMotion, value) }
}

struct AWCDialogModel: Equatable {
    var headline = "", ariaLabel = "", icon = "", fullscreen = false, scrimDismissible = true, locale = "en-US"
    var closeLabel = "", cancelLabel = "", okLabel = "", divider = false, headerDivider = false, density: Double? = nil, hidden = false
    init(_ p: [String: AWCValue]) {
        headline = p["headline"]?.string ?? ""; ariaLabel = p["dialogAriaLabel"]?.string ?? ""; icon = p["icon"]?.string ?? ""
        fullscreen = p["fullscreen"]?.bool ?? false; scrimDismissible = p["scrimDismissible"]?.bool ?? true
        locale = p["locale"]?.string ?? "en-US"; closeLabel = p["closeLabel"]?.string ?? ""; cancelLabel = p["cancelLabel"]?.string ?? ""
        okLabel = p["okLabel"]?.string ?? ""; divider = p["divider"]?.bool ?? false; headerDivider = p["headerDivider"]?.bool ?? false
        density = p["density"]?.number; hidden = p["hidden"]?.bool ?? false
    }
    func label(_ key: String) -> String {
        let explicit = key == "close" ? closeLabel : key == "cancel" ? cancelLabel : okLabel
        return explicit.isEmpty ? AWCDialogLabels.resolve(locale, key) : explicit
    }
}

/// Spacing rungs set by `[density]` / `[data-density]` (md3.css): inset-xl and gap-sm.
/// The tokens come from the nearest rung that defines them: `[density="-1"]` defines neither, `-2` only
/// inset-xl, so a local -1/-2 keeps the inherited rung's other values (the source's hybrid density).
enum AWCModalSpacing {
    private static func rung(_ local: Double?, _ inherited: Double, defines: Set<Double>) -> Double {
        if let local, defines.contains(local) { return local }
        return defines.contains(inherited) ? inherited : 0
    }
    static func insetXL(local: Double?, inherited: Double) -> Double {
        let d = rung(local, inherited, defines: [-2, -3, -4]); return d <= -3 ? 16 : d <= -2 ? 20 : 24
    }
    static func gapSM(local: Double?, inherited: Double) -> Double { rung(local, inherited, defines: [-3, -4]) <= -3 ? 4 : 8 }
}

/// Column used by the dialog shell: header, dividers and actions keep their natural height (`flex-shrink:0`);
/// the content (`flex:1; min-block-size:0`) takes what remains of `min(natural, max-block-size)` (basic) or the
/// whole viewport (fullscreen) but never less than its padding. Overflowing rows stay in flow and are clipped.
struct AWCDialogColumn: Layout {
    let width: CGFloat, fill: CGFloat?, maxHeight: CGFloat, contentIndex: Int, contentMin: CGFloat, contentNatural: CGFloat
    private func heights(_ subviews: Subviews) -> (rows: [CGFloat], total: CGFloat) {
        var rows = subviews.indices.map { i -> CGFloat in i == contentIndex ? 0 : subviews[i].sizeThatFits(.init(width: width, height: nil)).height }
        let others = rows.reduce(0, +)
        let total = max(0, fill ?? min(others + max(contentMin, contentNatural), maxHeight))
        if rows.indices.contains(contentIndex) { rows[contentIndex] = max(contentMin, total - others) }
        return (rows, total)
    }
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize { .init(width: width, height: heights(subviews).total) }
    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var y = bounds.minY
        for (index, row) in heights(subviews).rows.enumerated() {
            subviews[index].place(at: .init(x: bounds.minX, y: y), anchor: .topLeading, proposal: .init(width: width, height: row)); y += row
        }
    }
}

/// CSS line box: half-leading above and below single and wrapped lines.
struct AWCCSSLineBox: ViewModifier {
    let size: Double, line: Double
    /// Roboto's text line: rounded ascent (1900/2048 em) plus rounded descent (500/2048 em), as SwiftUI lays it out.
    static func natural(_ size: Double) -> Double {
        #if os(iOS)
        // UIKit text layout keeps the unrounded ascent + descent (2400/2048 em) and snaps the line up to device
        // pixels (measured: 22 pt → 26, 24 pt → 28⅓ at 3x), so the half-leading must be taken from that height.
        let scale = Double(UIScreen.main.scale)
        return (size * 2400 / 2048 * scale).rounded(.up) / scale
        #else
        return (size * 1900 / 2048).rounded() + (size * 500 / 2048).rounded()
        #endif
    }
    /// Spacing between wrapped lines. iOS snaps the whole text block (not each line) to device pixels, so the
    /// gap is taken from the unsnapped line; macOS lines are whole points and this is `line - natural`.
    static func spacing(_ size: Double, _ line: Double) -> Double {
        #if os(iOS)
        return max(0, line - size * 2400 / 2048)
        #else
        return max(0, line - natural(size))
        #endif
    }
    func body(content: Content) -> some View {
        let lead = line - AWCCSSLineBox.natural(size)
        content.lineSpacing(AWCCSSLineBox.spacing(size, line)).padding(.vertical, lead / 2)
    }
}

/// md-dialog: basic (centred alertdialog with scrim) and fullscreen (dialog filling the viewport), hosted by the
/// nearest `AWCModalScope`. Events: mdOpen/mdClose on every open change, user dismissal emits mdCancel then
/// mdClose in the same update; the fallback OK and `close()` emit mdClose only.
struct AWCNativeDialog: View {
    let id: String
    let model: AWCDialogModel
    let theme: AWCTheme
    let open: Binding<Bool>
    let slots: AWCDialogSlots
    let emit: (String) -> Void
    @Environment(\.self) private var environment
    @Environment(\.awcModalSession) private var session
    @Environment(\.awcDialogAppearance) private var inheritedAppearance
    @Environment(\.awcDialogAppearanceTargets) private var appearanceTargets
    @Environment(\.awcDialogParts) private var partValues
    @Environment(\.awcDialogControllers) private var controllers
    @Environment(\.awcNativeDensity) private var inheritedDensity
    @Environment(\.accessibilityReduceMotion) private var systemReduced
    @Environment(\.awcModalReducedMotion) private var reducedOverride
    @Environment(\.awcForcedColors) private var forced
    @State private var track = AWCCSSTransitionTrack()
    @State private var emitted: Bool?
    @State private var owner: AWCModalOwner
    @State private var regions = AWCModalFocusRegions(count: 3)
    @State private var closeFocus = AWCButtonFocusHandle()
    @State private var contentNatural: CGFloat = 0
    @State private var settle = 0
    @State private var boundController: AWCDialogController?

    /// The source's `aria-describedby` target: the text of the content slot.
    var describedBy = ""
    init(id: String, model: AWCDialogModel, theme: AWCTheme, open: Binding<Bool>, slots: AWCDialogSlots, emit: @escaping (String) -> Void) {
        self.id = id; self.model = model; self.theme = theme; self.open = open; self.slots = slots; self.emit = emit
        _owner = State(initialValue: AWCModalOwner(id: id))
    }
    private var appearance: AWCDialogAppearance { inheritedAppearance.merging(appearanceTargets[id] ?? .init()) }
    private func part(_ p: AWCDialogPart) -> AWCModalPartAppearance { (partValues[p.rawValue] ?? .init()).merging(partValues[id + "|" + p.rawValue] ?? .init()) }
    private var density: Double { AWCNativeDensity.resolve(model.density, inherited: inheritedDensity) }
    private var reduced: Bool { reducedOverride ?? systemReduced }
    private var duration: Double { reduced ? 0 : awcCSSDuration(theme.tokens["--md-sys-motion-duration-medium2"]) ?? 300 }
    private var curve: [Double] { awcCSSCubicBezier(theme.tokens["--md-sys-motion-easing-standard"]) ?? [0.2, 0, 0, 1] }
    private func color(_ token: String, _ fallback: String) -> Color { Color(awcHex: theme.tokens["--md-sys-color-" + token] ?? fallback) }
    private func hex(_ value: String?) -> Color? { value.map { Color(awcHex: $0) } }
    /// forced-colors: text and icons CanvasText; backgrounds Canvas keeping their alpha (the UA forcing of the dialog's own colours).
    private func ink(_ c: Color) -> Color { forced.map { Color(awcHex: $0.canvasText) } ?? c }
    private func backdrop(_ value: String?) -> Color? { value.map { v in Color(awcHex: forced.map { $0.canvas(keepingAlphaOf: v) } ?? v) } }

    var body: some View {
        let now = CACurrentMediaTime() * 1000
        let visible = !model.hidden && (open.wrappedValue || track.isRunning(now) || track.presented(now) > 0.0001)
        Color.clear.frame(width: 0, height: 0)
            .preference(key: AWCModalEntries.self, value: visible ? [entry(now)] : [])
            .onAppear { attach(); sync(open.wrappedValue) }
            .onChange(of: open.wrappedValue) { _, value in sync(value) }
            .onChange(of: model.hidden) { _, _ in sync(open.wrappedValue) }
            .onDisappear { if emitted == true { session?.release(id) }; emitted = nil }
            .accessibilityHidden(true)
    }

    // MARK: Behaviour
    private func attach() {
        owner.escape = { [self] in
            guard open.wrappedValue, session?.isTop(id) == true else { return false }
            dismiss(cancel: true); return true
        }
        owner.tab = { [regions] backward in regions.move(backward: backward) }
        owner.focusInitial = { [regions, session] in regions.focusFirst(visible: !(session?.lastInputPointer ?? false)) }
        boundController = controllers[id]
        if let controller = controllers[id] {
            controller.showAction = { [self] in if !open.wrappedValue { open.wrappedValue = true; sync(true) } }
            controller.closeAction = { [self] in if open.wrappedValue { open.wrappedValue = false; sync(false) } }
            controller.openState = { [self] in open.wrappedValue }
        }
    }
    /// Apply an open change from any source exactly once (the source `@Watch('open')`).
    private func sync(_ value: Bool) {
        let active = value && !model.hidden
        if emitted == nil {
            // First connection: an initially open dialog opens with motion and emits mdOpen (componentDidLoad).
            emitted = active
            if active { track.set(1, now: CACurrentMediaTime() * 1000, duration: duration, curve: curve); session?.acquire(owner); emit("mdOpen"); scheduleSettle() }
            return
        }
        guard active != emitted else { return }
        emitted = active
        let now = CACurrentMediaTime() * 1000
        track.set(active ? 1 : 0, now: now, duration: duration, curve: curve)
        if let controller = boundController { controller.exitEnd = active ? 0 : now + duration }
        if active { session?.acquire(owner); emit("mdOpen") } else { session?.release(id); emit("mdClose") }
        scheduleSettle()
    }
    private func scheduleSettle() {
        let wait = UInt64(max(0, duration) + 34) * 1_000_000
        Task { @MainActor in try? await Task.sleep(nanoseconds: wait); settle += 1 }
    }
    /// User dismissal (Escape, enabled scrim, close button, fallback Cancel): mdCancel then mdClose.
    private func dismiss(cancel: Bool) {
        guard open.wrappedValue, session.map({ $0.isTop(id) }) ?? true else { return }
        if cancel { emit("mdCancel") }
        open.wrappedValue = false; sync(false)
    }

    // MARK: Presentation
    private func entry(_ now: Double) -> AWCModalEntry {
        let running = track.isRunning(now) || settle < 0
        let content = TimelineView(.animation(paused: !running)) { _ in
            GeometryReader { geometry in shell(viewport: geometry.size, time: CACurrentMediaTime() * 1000) }
        }
        // Innermost wins: the host's environment, minus the inert bit of the content it lives in.
        .environment(\.awcNativeInert, false)
        .environment(\.self, environment)
        return .init(id: id, zIndex: appearance.zIndex ?? 2147483647, content: AnyView(content))
    }

    @ViewBuilder private func shell(viewport: CGSize, time: Double) -> some View {
        let p = reduced ? (open.wrappedValue ? 1 : 0) : track.presented(time)
        let fullscreen = model.fullscreen, d = density
        let width = fullscreen ? viewport.width : min(560, max(280, viewport.width - 48))
        let interactive = open.wrappedValue
        ZStack(alignment: .topLeading) {
            if !fullscreen {
                let scrimPart = part(.scrim)
                (backdrop(scrimPart.background ?? appearance.scrimColor) ?? backdrop(forced.map { _ in "#00000052" }) ?? Color(.sRGB, red: 0, green: 0, blue: 0, opacity: 0.32))
                    .frame(width: viewport.width, height: viewport.height)
                    .opacity(p)
                    .contentShape(Rectangle())
                    .onTapGesture {
                        guard session.map({ $0.isTop(id) }) ?? true else { return }
                        // Chrome: pressing the (non-focusable) scrim blurs focus to the body even when protected.
                        if model.scrimDismissible { dismiss(cancel: true) } else { session?.blur() }
                    }
                    .allowsHitTesting(interactive)
                    .awcInspect(nodeID: id, part: "scrim", name: "scrim") { _ in ["opacity": .number(p), "renderTime": .number(time)] }
                    .zIndex(appearance.scrimZIndex ?? 2147483646)
            }
            container(viewport: viewport, width: width, density: d)
                .opacity(p)
                .awcInspect(nodeID: id, part: "container-motion", name: "container-motion") { _ in
                    ["opacity": .number(p), "translateY": .number((fullscreen ? 30 : 20) * (1 - p)), "renderTime": .number(time)]
                }
                .offset(y: (fullscreen ? 30 : 20) * (1 - p))
                .position(x: fullscreen ? viewport.width / 2 : viewport.width / 2, y: viewport.height / 2)
                .allowsHitTesting(interactive)
                .zIndex(appearance.zIndex ?? 2147483647)
        }
        .frame(width: viewport.width, height: viewport.height, alignment: .topLeading)
    }

    private func container(viewport: CGSize, width: CGFloat, density d: Double) -> some View {
        let fullscreen = model.fullscreen
        let corners = fullscreen ? AWCCornerShape.points(0) : appearance.containerShape ?? .points(max(16, 28 + 2 * d))
        let shape = AWCNativeCornerShape(corners: corners)
        let fill = forced.map { Color(awcHex: $0.canvas(keepingAlphaOf: appearance.containerColor ?? "#ECE6F0")) } ?? hex(appearance.containerColor) ?? color("surface-container-high", "#ECE6F0")
        let cv = max(8, 16 + 2 * d), ch = max(12, 24 + 2 * d)
        let contentTop = fullscreen ? max(12, 24 + 2 * d) : cv
        let headerDivider = fullscreen && model.headerDivider
        let contentIndex = headerDivider ? 2 : 1
        let containerPart = part(.container)
        return AWCDialogColumn(width: width, fill: fullscreen ? viewport.height : nil, maxHeight: viewport.height - 96, contentIndex: contentIndex,
                               contentMin: contentTop + cv, contentNatural: contentNatural) {
            header(fill: fill, density: d)
            if headerDivider { divider() }
            content(top: contentTop, bottom: cv, inline: ch, density: d)
            if model.divider { divider(second: headerDivider) }
            actions(density: d)
        }
        .frame(width: width, alignment: .topLeading)
        .clipShape(shape)
        .background { shape.fill(hex(containerPart.background) ?? fill) }
        .background {
            if !fullscreen && forced == nil {
                AWCNativeBoxShadow(corners: corners, layers: AWCBoxShadow.source(theme.tokens["--md-sys-elevation-3"] ?? "none") ?? [], placement: .outer)
            }
        }
        .overlay {
            if let outline = containerPart.outlineColor, let lineWidth = containerPart.outlineWidth { shape.strokeBorder(Color(awcHex: outline), lineWidth: lineWidth).allowsHitTesting(false) }
        }
        .modifier(AWCForcedHostBorder(width: 2, color: forced?.canvasText, fill: forced.map { $0.canvas(keepingAlphaOf: appearance.containerColor ?? "#ECE6F0") }, corners: corners))
        .background {
            AWCModalContainerFocus(id: id + ".container", label: accessibleName) { view in regions.container = view }
                .accessibilityHidden(true)
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel(accessibleName)
        .accessibilityAddTraits(.isModal)
        .awcModalSurfaceAccessibility(id: id, role: AWCModalSurfaceRole(kind: fullscreen ? .dialog : .alertDialog, modal: true, description: describedBy))
        .awcInspect(nodeID: id, part: "container", name: "container") { size in
            ["role": .string(fullscreen ? "dialog" : "alertdialog"), "label": .string(accessibleName), "radius": .number(Double(corners.radii(in: size).first?.width ?? 0))]
        }
        .environment(\.awcNativeDensity, d)
    }
    private var hasHeadline: Bool { !model.headline.isEmpty || slots.headline != nil }
    private var hasIcon: Bool { !model.icon.isEmpty || slots.icon != nil }
    private var accessibleName: String { model.ariaLabel.isEmpty ? (hasHeadline ? model.headline : "") : model.ariaLabel }

    @ViewBuilder private func headline(size: Double, line: Double, single: Bool) -> some View {
        let p = part(.headline)
        Group {
            if let slot = slots.headline { slot } else { Text(model.headline) }
        }
        .font(AWCNativeFonts.label(size: size, weight: 400))
        .tracking(p.letterSpacing ?? 0)
        .underline(p.underline ?? false)
        .foregroundStyle(ink(hex(p.color) ?? hex(appearance.headlineColor) ?? color("on-surface", "#1C1B1F")))
        .multilineTextAlignment(hasIcon && !model.fullscreen ? .center : .leading)
        .lineLimit(single ? 1 : nil)
        .truncationMode(.tail)
        .modifier(AWCCSSLineBox(size: size, line: line))
        .background { if let bg = p.background { Color(awcHex: bg) } }
    }
    @ViewBuilder private func header(fill: Color, density d: Double) -> some View {
        let headerPart = part(.header)
        if model.fullscreen {
            let hh = max(48, 64 + 4 * d), pi = max(8, 16 + 2 * d), gap = max(4, 12 + 2 * d)
            HStack(spacing: gap) {
                AWCDialogCloseButton(id: id + ".close-button", label: model.label("close"), theme: theme, part: part(.closeButton), handle: closeFocus,
                                     action: { dismiss(cancel: true) })
                    .awcCursor(.pointer)
                    .awcInspect(nodeID: id, part: "close-button", name: "close-button")
                if hasHeadline {
                    headline(size: max(16, 22 + d), line: max(22, 28 + d), single: true).frame(maxWidth: .infinity, alignment: .leading)
                        .awcInspect(nodeID: id, part: "headline", name: "headline")
                } else if slots.headerAction != nil { Spacer(minLength: 0) }
                if let action = slots.headerAction { action.environment(\.awcPopupTarget, regions.regions[0]) }
            }
            .padding(.horizontal, pi)
            .frame(maxWidth: .infinity, minHeight: hh, maxHeight: hh, alignment: .leading)
            .background(backdrop(headerPart.background) ?? fill)
            .onAppear { if !regions.extra.contains(where: { $0.handle === closeFocus }) { regions.extra.append((0, -1, closeFocus)) } }
            .awcInspect(nodeID: id, part: "header", name: "header")
        } else {
            let pad = max(12, 24 + 2 * d), gap = max(8, 16 + 2 * d)
            VStack(alignment: hasIcon ? .center : .leading, spacing: gap) {
                if hasIcon { icon() }
                if hasHeadline {
                    // A block in a flex-start column is fit-content: its text width on one line, the full line when it wraps.
                    ViewThatFits(in: .horizontal) {
                        headline(size: max(18, 24 + d), line: max(24, 32 + 2 * d), single: false).fixedSize()
                        headline(size: max(18, 24 + d), line: max(24, 32 + 2 * d), single: false).frame(maxWidth: .infinity, alignment: hasIcon ? .center : .leading)
                    }
                    .awcInspect(nodeID: id, part: "headline", name: "headline")
                }
            }
            .frame(maxWidth: .infinity, alignment: hasIcon ? .center : .leading)
            .padding(.top, pad).padding(.horizontal, pad)
            .background { if let bg = headerPart.background { Color(awcHex: bg) } }
            .awcInspect(nodeID: id, part: "header", name: "header")
        }
    }
    @ViewBuilder private func icon() -> some View {
        let p = part(.icon), size = appearance.iconSize ?? 24
        let ink = self.ink(hex(p.color) ?? hex(appearance.iconColor) ?? color("secondary", "#625B71"))
        Group {
            if let slot = slots.icon { slot.font(AWCNativeFonts.symbol(size: size)) } else { AWCMaterialSymbol(model.icon, size: size) }
        }
        .frame(width: size, height: size)
        .foregroundStyle(ink)
        .environment(\.awcMaterialSymbolSize, size)
        .awcInspect(nodeID: id, part: "icon", name: "icon")
    }
    private func divider(second: Bool = false) -> some View {
        let p = part(.divider)
        return Rectangle().fill(forced.map { Color(awcHex: $0.canvasText) } ?? hex(p.background) ?? hex(appearance.dividerColor) ?? color("outline-variant", "#CAC4D0"))
            .frame(maxWidth: .infinity).frame(height: p.height ?? 1)
            .awcInspect(nodeID: id, part: second ? "divider-bottom" : "divider", name: second ? "divider-bottom" : "divider")
    }
    private func content(top: Double, bottom: Double, inline: Double, density d: Double) -> some View {
        let p = part(.content)
        let size = max(12, 14 + 0.5 * d), line = max(16, 20 + d)
        let ink = self.ink(hex(p.color) ?? hex(appearance.contentColor) ?? color("on-surface-variant", "#49454F"))
        return ScrollView(.vertical) {
            VStack(alignment: .leading, spacing: 0) { slots.content }
                .environment(\.awcTextInk, ink).environment(\.awcTextLineBox, CGSize(width: size, height: line))
                .frame(maxWidth: .infinity, alignment: .topLeading)
                .padding(EdgeInsets(top: top, leading: inline, bottom: bottom, trailing: inline))
                .font(AWCNativeFonts.label(size: size, weight: 400)).tracking(0.25)
                .lineSpacing(AWCCSSLineBox.spacing(size, line))
                .foregroundStyle(ink)
                .environment(\.awcPopupTarget, regions.regions[1])
                .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { contentNatural = $0 }
        }
        .scrollIndicators(.never)
        .scrollBounceBehavior(.basedOnSize)
        .background { if let bg = p.background { Color(awcHex: bg) } }
        .awcInspect(nodeID: id, part: "content", name: "content") { _ in ["fontSize": .number(size), "lineHeight": .number(line)] }
    }
    @ViewBuilder private func actions(density d: Double) -> some View {
        let local = model.density.flatMap { [-1.0, -2, -3, -4].contains($0) ? $0 : nil }
        let p = part(.actions), gap = AWCModalSpacing.gapSM(local: local, inherited: inheritedDensity)
        let row = HStack(spacing: gap) {
            Spacer(minLength: 0)
            if let authored = slots.actions { authored } else {
                fallback("cancel-button", variant: "text", label: model.label("cancel")) { dismiss(cancel: true) }
                fallback("ok-button", variant: "filled", label: model.label("ok")) { dismiss(cancel: false) }
            }
        }
        .environment(\.awcPopupTarget, regions.regions[2])
        .awcDialogFallbackActionsReadingOrder(id: id, active: slots.actions == nil)
        Group {
            if model.fullscreen {
                row.frame(minHeight: max(40, 56 + 4 * d)).padding(.vertical, max(4, 8 + d)).padding(.horizontal, max(12, 24 + 2 * d))
            } else {
                let inset = AWCModalSpacing.insetXL(local: local, inherited: inheritedDensity)
                row.padding(.horizontal, inset).padding(.bottom, inset).padding(.top, model.divider ? inset : 0)
            }
        }
        .background { if let bg = p.background { Color(awcHex: bg) } }
        .awcInspect(nodeID: id, part: "actions", name: "actions")
    }
    private func fallback(_ name: String, variant: String, label: String, action: @escaping () -> Void) -> some View {
        AWCNativeView(node: AWCNode(id: id + "." + name, tag: "md-button", properties: ["variant": .string(variant)], children: [.text(label)])) { event in
            if event.name == "mdClick" { action() }
        }
        .fixedSize()
        .awcInspect(nodeID: id, part: name, name: name)
    }
}

/// Fullscreen close control: 40×40 circle, 24 pt glyph, 8 % hover / 12 % press on-surface tint on the
/// short1 standard transition, 3 pt secondary focus ring inset by its width.
struct AWCDialogCloseButton: View {
    let id: String, label: String, theme: AWCTheme, part: AWCModalPartAppearance, handle: AWCButtonFocusHandle, action: () -> Void
    @Environment(\.awcNativePointerState) private var pointer
    @Environment(\.awcModalReducedMotion) private var reducedOverride
    @Environment(\.accessibilityReduceMotion) private var systemReduced
    @Environment(\.awcForcedColors) private var forced
    @State private var hovered = false
    @State private var frame: CGRect = .zero
    @State private var touchPress = AWCTouchPressState()
    var body: some View {
        let hover = pointer.map { $0.location.map(frame.contains) ?? false } ?? hovered
        let reduced = reducedOverride ?? systemReduced
        let face = Face(id: id, ink: Color(awcHex: forced?.buttonText ?? part.color ?? theme.tokens["--md-sys-color-on-surface"] ?? "#1C1B1F"),
                        background: part.background.map { bg in Color(awcHex: forced.map { $0.canvas(keepingAlphaOf: bg) } ?? bg) }, ring: Color(awcHex: forced?.highlight ?? theme.tokens["--md-sys-color-secondary"] ?? "#625B71"),
                        focusVisible: handle.isFocusVisible, hover: hover,
                        duration: reduced ? 0 : awcCSSDuration(theme.tokens["--md-sys-motion-duration-short1"]) ?? 50,
                        curve: awcCSSCubicBezier(theme.tokens["--md-sys-motion-easing-standard"]) ?? [0.2, 0, 0, 1], handle: handle)
        Button(action: { if !touchPress.consumeCompletedTouch() { action() } }) { EmptyView() }
            .buttonStyle(Style(face: face, touch: touchPress))
            .frame(width: 40, height: 40)
            .awcFocusBridgeLayer { AWCNativeButtonFocusBridge(configuration: .init(id: id, label: label, policy: AWCButtonAccessibilityPolicy(properties: [:]), group: nil, cell: nil,
                                                                          handle: handle, focusChanged: { _ in }, activate: action,
                // iOS: press (focus, tint) and click from the raw touch (AWCTouchPressRouter).
                touchPress: .init(began: { _ in touchPress.begin(at: .zero); _ = handle.requestPointerFocus?(); return true },
                                  ended: { inside in touchPress.end(completed: true); if inside { action() } }, cancelled: { touchPress.end(completed: false) }))) }
            .onHover { hovered = $0 }
            .onGeometryChange(for: CGRect.self) { $0.frame(in: .named("awc-native-preview")) } action: { frame = $0 }
            .accessibilityLabel(label)
    }
    struct Style: ButtonStyle {
        let face: Face
        let touch: AWCTouchPressState
        func makeBody(configuration: Configuration) -> some View {
            var f = face; f.pressed = configuration.awcPressed(touch)
            // A press focuses the button (Chrome focuses a clicked <button> on mousedown); a router-owned touch already did.
            return f.onChange(of: configuration.isPressed) { _, pressed in if pressed && !touch.ownsTouch { _ = face.handle.requestPointerFocus?() } }
        }
    }
    struct Face: View {
        let id: String, ink: Color, background: Color?, ring: Color, focusVisible: Bool, hover: Bool, duration: Double, curve: [Double]
        let handle: AWCButtonFocusHandle
        var pressed = false
        @State private var track = AWCCSSTransitionTrack()
        @State private var primed = false
        private var target: Double { pressed ? 0.12 : hover ? 0.08 : 0 }
        var body: some View {
            let now = CACurrentMediaTime() * 1000
            TimelineView(.animation(paused: !track.isRunning(now))) { _ in
                let t = CACurrentMediaTime() * 1000, alpha = track.isRunning(t) ? track.presented(t) : target
                ZStack {
                    Circle().fill(ink.opacity(alpha))
                    if let background { Circle().fill(background) }
                    AWCDialogCloseGlyph().fill(ink).frame(width: 24, height: 24)
                    if focusVisible { Circle().inset(by: 1.5).stroke(ring, lineWidth: 3) }
                }
                .frame(width: 40, height: 40)
                .awcInspect(nodeID: id, part: "tint", name: "close-tint") { _ in ["alpha": .number(alpha), "renderTime": .number(t)] }
            }
            .contentShape(Circle())
            .onChange(of: target, initial: true) { _, next in
                guard primed else { track.snap(next); primed = true; return }
                track.set(next, now: CACurrentMediaTime() * 1000, duration: duration, curve: curve)
            }
        }
    }
}
/// The source close glyph (24×24 SVG path, physical in both directions).
struct AWCDialogCloseGlyph: Shape {
    func path(in rect: CGRect) -> Path {
        let s = rect.width / 24
        let points: [(Double, Double)] = [(19, 6.41), (17.59, 5), (12, 10.59), (6.41, 5), (5, 6.41), (10.59, 12), (5, 17.59), (6.41, 19), (12, 13.41), (17.59, 19), (19, 17.59), (13.41, 12)]
        var path = Path()
        for (i, p) in points.enumerated() {
            let point = CGPoint(x: rect.minX + p.0 * s, y: rect.minY + p.1 * s)
            if i == 0 { path.move(to: point) } else { path.addLine(to: point) }
        }
        path.closeSubpath(); return path
    }
}

extension AWCNativeView {
    var nativeDialog: some View { AWCModalPresentationFallback(modern: nativeDialogRenderer, legacy: sheet) }
    var nativeDialogRenderer: some View {
        let slot = { (name: String?) -> AnyView? in
            let items = node.children(inSlot: name)
            return items.isEmpty ? nil : AnyView(ForEach(items) { item in child(item) })
        }
        var dialog = AWCNativeDialog(id: node.id, model: AWCDialogModel(local), theme: theme,
                               open: $local[awcBool: "open"],
                               slots: AWCDialogSlots(content: slot(nil), headline: slot("headline"), icon: slot("icon"), actions: slot("actions"), headerAction: slot("header-action")),
                               emit: { name in emit(name) })
        dialog.describedBy = awcCollapsedInlineText(node.children(inSlot: nil).map { $0.authoredTextContent.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }.joined(separator: " "))
        return dialog
    }
}
