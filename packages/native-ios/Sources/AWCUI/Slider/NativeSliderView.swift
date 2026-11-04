import SwiftUI

// Dedicated SwiftUI renderer for md-slider: AWCSliderInteraction (the component + its native range inputs) drives
// the values, events and focus; AWCSliderLayout gives every painted box exactly as Chrome lays it out; AWCSliderMotion
// runs the stylesheet's transitions (knob press morph, the stops spring, stop fades). Properties are the node's
// local state: uncontrolled interaction writes `value` / `valueStart` / `valueEnd` back through `set`.

final class AWCSliderModel: ObservableObject {
    let s = AWCSliderInteraction()
    let motion = AWCSliderMotion()
    @Published var version = 0
    /// One native focus element per thumb (single / start / end).
    var handles: [String: AWCButtonFocusHandle] = [:]
    func handle(_ thumb: String) -> AWCButtonFocusHandle { if let h = handles[thumb] { return h }; let h = AWCButtonFocusHandle(); handles[thumb] = h; return h }
    func perform(_ body: () -> Void) { body(); s.render(); version &+= 1 }
}

/// Converts an interaction event detail into the portable event payload.
func awcSliderPayload(_ detail: [String: Any]) -> AWCValue {
    var out: [String: AWCValue] = [:]
    for (k, v) in detail {
        switch v {
        case let d as Double: out[k] = .number(d)
        case let i as Int: out[k] = .number(Double(i))
        case let s as String: out[k] = .string(s)
        case let b as Bool: out[k] = .bool(b)
        default: break
        }
    }
    return .object(out)
}

struct AWCNativeSliderView: View {
    var nodeID: String = ""
    let properties: [String: AWCValue]
    let set: (String, AWCValue) -> Void
    let emit: (String, AWCValue) -> Void
    @Environment(\.awcThemeTokens) private var envTokens
    @Environment(\.awcSliderAppearance) private var appearance
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.layoutDirection) private var direction
    @Environment(\.awcNativeDensity) private var inheritedDensity
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @StateObject private var model = AWCSliderModel()
    @FocusState private var focused: String?
    @State private var dragging = false

    init(nodeID: String = "", properties: [String: AWCValue], set: @escaping (String, AWCValue) -> Void, emit: @escaping (String, AWCValue) -> Void) {
        self.nodeID = nodeID; self.properties = properties; self.set = set; self.emit = emit
    }

    private func num(_ k: String, _ d: Double) -> Double { properties[k]?.number ?? d }
    private func str(_ k: String, _ d: String) -> String { let v = properties[k]?.string ?? ""; return v.isEmpty ? d : v }
    private func flag(_ k: String) -> Bool { properties[k]?.bool ?? false }
    /// Theme tokens, then the typed hooks (`.awcSliderAppearance`), then the host's inline `style` custom properties.
    private var tokens: [String: String] {
        awcSREffectiveTokens(envTokens.isEmpty ? AWCTheme.generated(dark: colorScheme == .dark).tokens : envTokens, hooks: appearance.hooks, style: properties["style"]?.string)
    }

    private var theme: AWCSliderTheme {
        let t = tokens
        func c(_ n: String, _ f: String) -> String { awcSRToken(t, "--md-sys-color-\(n)", f) }
        let dark = colorScheme == .dark
        var th = AWCSliderTheme(primary: c("primary", dark ? "#D0BCFF" : "#6750A4"), onPrimary: c("on-primary", dark ? "#381E72" : "#FFFFFF"),
                                secondary: c("secondary", dark ? "#CCC2DC" : "#625B71"), secondaryContainer: c("secondary-container", dark ? "#4A4458" : "#E8DEF8"),
                                onSecondaryContainer: c("on-secondary-container", dark ? "#E8DEF8" : "#1E192B"), inverseSurface: c("inverse-surface", dark ? "#E6E1E5" : "#313033"),
                                inverseOnSurface: c("inverse-on-surface", dark ? "#313033" : "#F4EFF4"), surface: c("surface", dark ? "#1C1B1F" : "#FFFBFE"),
                                onSurface: c("on-surface", dark ? "#E6E1E5" : "#1C1B1F"))
        th.densityScale = inheritedDensity
        th.spacingInsetMd = awcSRNumberToken(t, "--md-sys-spacing-inset-md", 12)
        th.spacingInsetLg = awcSRNumberToken(t, "--md-sys-spacing-inset-lg", 16)
        th.disabledContentOpacity = awcSRNumberToken(t, "--md-sys-state-disabled-content-opacity", 0.38)
        th.disabledContainerOpacity = awcSRNumberToken(t, "--md-sys-state-disabled-container-opacity", 0.12)
        th.labelLineHeight = awcSRNumberToken(t, "--md-sys-typescale-label-medium-line-height", 16)
        th.labelLetterSpacing = awcSRNumberToken(t, "--md-sys-typescale-label-medium-letter-spacing", 0.5)
        return th
    }

    /// `--md-slider-*` hooks: from the theme tokens, overridden by the host's inline `style`.
    private var hooks: AWCSliderHooks {
        var hk: [String: String] = [:]
        for (k, v) in tokens where k.hasPrefix("--md-slider-") { hk[String(k.dropFirst("--md-slider-".count))] = v }
        let style = properties["style"]?.string ?? ""
        for part in style.split(separator: ";") {
            let kv = part.split(separator: ":", maxSplits: 1).map { $0.trimmingCharacters(in: .whitespaces) }
            if kv.count == 2, kv[0].hasPrefix("--md-slider-") { hk[String(kv[0].dropFirst("--md-slider-".count))] = kv[1] }
        }
        func px(_ k: String) -> Double? { hk[k].flatMap { awcSRCSSPixels($0) } }
        return AWCSliderHooks(activeColor: hk["active-color"], inactiveColor: hk["inactive-color"], tickActiveColor: hk["tick-active-color"],
                              tickFilledColor: hk["tick-filled-color"], tickInactiveColor: hk["tick-inactive-color"], thumbColor: hk["thumb-color"],
                              thumbWidth: px("thumb-width"), thumbHeight: px("thumb-height"), trackHeight: px("track-height"), trackShape: px("track-shape"),
                              trackLength: px("track-length"), minTrackLength: px("min-track-length"), valueBg: hk["value-bg"], valueColor: hk["value-color"],
                              valueShape: px("value-shape"), valueFontFamily: nil, valueFontSize: px("value-font-size"),
                              valueFontWeight: hk["value-font-weight"].flatMap(Double.init), valueLineHeight: px("value-line-height"),
                              valuePaddingInline: px("value-padding-inline"), valuePaddingBlock: px("value-padding-block"),
                              insetIconColor: hk["inset-icon-color"], insetIconActiveColor: hk["inset-icon-active-color"],
                              valueIndicatorReserve: px("value-indicator-reserve"))
    }

    /// Host properties → the interaction, once per render (the interaction runs Stencil's watchers on changes only).
    private func sync() {
        let s = model.s
        model.motion.reducedMotion = reduceMotion
        s.onEvent = { [emit] e in emit(e.name, awcSliderPayload(e.detail)) }
        // The component's writes into its own props reach the node after the update (a clamp happens during body).
        s.onPropWrite = { [set] k, v in DispatchQueue.main.async { set(k, .number(v)) } }
        s.sync(AWCSliderProps(min: num("min", 0), max: num("max", 100), step: num("step", 1), value: num("value", 50),
                              valueStart: num("valueStart", 0), valueEnd: num("valueEnd", 100), disabled: flag("disabled"),
                              variant: str("variant", "standard"), range: flag("range"), stops: flag("stops"), size: str("size", "xs"),
                              orientation: str("orientation", "horizontal"), valueIndicator: flag("valueIndicator"), labeled: flag("labeled"),
                              insetIcon: flag("insetIcon"), controlled: flag("controlled"),
                              rtl: str("dir", "") == "rtl" || (str("dir", "") != "ltr" && direction == .rightToLeft)))
    }

    private var fullHeight: Bool { flag("fullHeight") }
    private var densityProp: Int? { properties["density"]?.number.map { Int($0) } }

    var body: some View {
        let _ = model.version
        let _ = sync()
        let th = theme, hk = hooks
        GeometryReader { geo in
            TimelineView(.animation(minimumInterval: nil, paused: !model.motion.active(Date().timeIntervalSince1970 * 1000))) { ctx in
                let now = ctx.date.timeIntervalSince1970 * 1000
                let p = AWCSliderLayout.layout(model.s, theme: th, hooks: hk, containerWidth: model.s.vertical && !fillsWidth ? 0 : geo.size.width,
                                               containerHeight: geo.size.height, fullHeight: fullHeight, densityProp: densityProp, motion: model.motion, now: now)
                content(p)
            }
        }
        .frame(height: settledHeight(th, hk))
        .frame(maxWidth: model.s.vertical && !fillsWidth ? settledWidth(th, hk) : .infinity, alignment: .leading)
        .environment(\.layoutDirection, .leftToRight)   // the layout model already mirrors RTL
        .awcInspect(nodeID: nodeID, name: "md-slider") { size in
            let p = AWCSliderLayout.layout(model.s, theme: th, hooks: hk, containerWidth: Double(size.width), fullHeight: fullHeight, densityProp: densityProp)
            var m: [String: AWCValue] = ["width": .number(Double(size.width)), "height": .number(Double(size.height)), "disabled": .bool(model.s.disabled),
                                         "trackHeight": .number(p.track.height), "trackRadius": .number(p.trackRadius), "thumbs": .number(Double(p.thumbs.count))]
            if model.s.range { m["valueStart"] = .number(model.s.valueStart); m["valueEnd"] = .number(model.s.valueEnd) } else { m["value"] = .number(model.s.value) }
            if let active = p.segments.first(where: { $0.kind == "active" }) { m["activeColor"] = .string(awcSRHex(active.color)) }
            if let t = p.thumbs.first { m["thumbWidth"] = .number(t.knob.width); m["thumbHeight"] = .number(t.knob.height) }
            return m
        }
    }

    private var fillsWidth: Bool { !model.s.vertical || !fullHeight }
    private func settledHeight(_ th: AWCSliderTheme, _ hk: AWCSliderHooks) -> CGFloat? {
        if model.s.vertical && fullHeight { return nil }
        return AWCSliderLayout.layout(model.s, theme: th, hooks: hk, containerWidth: 0, densityProp: densityProp).height
    }
    private func settledWidth(_ th: AWCSliderTheme, _ hk: AWCSliderHooks) -> CGFloat {
        AWCSliderLayout.layout(model.s, theme: th, hooks: hk, containerWidth: 0, fullHeight: fullHeight, densityProp: densityProp).width
    }

    @ViewBuilder private func content(_ p: AWCSliderPaint) -> some View {
        ZStack(alignment: .topLeading) {
          // CSS `opacity` on the host: the painted layers fade as one composited group (indicator text over its bubble,
          // inset icon over the track), as Chrome composites them.
          ZStack(alignment: .topLeading) {
            Canvas { ctx, _ in draw(p, into: &ctx) }
                .frame(width: p.width, height: p.height)
            if let inset = p.inset {
                AWCMaterialSymbol(str("icon", "volume_up"), size: inset.size)
                    .foregroundStyle(Color(awcSRRGBA: inset.color))
                    .frame(width: inset.rect.width, height: inset.rect.height)
                    // The mask works in the icon's own (un-offset) frame, so it is applied before the offset.
                    .mask(alignment: .topLeading) { trackClip(p).offset(x: -inset.rect.x, y: -inset.rect.y) }
                    .offset(x: inset.rect.x, y: inset.rect.y)
            }
            ForEach(Array(p.indicators.enumerated()), id: \.offset) { _, ind in
                Text(ind.text)
                    .font(AWCNativeFonts.label(size: ind.fontSize, weight: ind.fontWeight)).tracking(ind.letterSpacing)
                    .foregroundStyle(Color(awcSRRGBA: ind.color)).lineLimit(1).fixedSize()
                    .frame(width: ind.rect.width, height: ind.rect.height)
                    .background(Color(awcSRRGBA: ind.background), in: RoundedRectangle(cornerRadius: Swift.min(ind.radius, ind.rect.height / 2, ind.rect.width / 2)))
                    .offset(x: ind.rect.x, y: ind.rect.y)
                    .allowsHitTesting(false)
            }
          }
          .frame(width: p.width, height: p.height, alignment: .topLeading)
          .compositingGroup().opacity(p.opacity)
            ForEach(Array(p.thumbs.enumerated()), id: \.offset) { _, t in thumbHandle(t, p) }
        }
        .frame(width: p.width, height: p.height, alignment: .topLeading)
        .contentShape(Rectangle())
        .gesture(railGesture(p))
        .allowsHitTesting(!model.s.disabled)
    }

    private func trackClip(_ p: AWCSliderPaint) -> some View {
        RoundedRectangle(cornerRadius: Swift.min(p.trackRadius, p.track.width / 2, p.track.height / 2))
            .frame(width: p.track.width, height: p.track.height).offset(x: p.track.x, y: p.track.y)
    }

    private func draw(_ p: AWCSliderPaint, into ctx: inout GraphicsContext) {
        let tr = CGRect(x: p.track.x, y: p.track.y, width: p.track.width, height: p.track.height)
        var track = ctx
        // The track box clips the segments and stops to its rounded rect (CSS clamps oversized radii the same way).
        track.clip(to: Path(roundedRect: tr, cornerRadius: Swift.min(p.trackRadius, tr.width / 2, tr.height / 2)))
        for seg in p.segments where seg.rect.width > 0 && seg.rect.height > 0 {
            let r = CGRect(x: seg.rect.x, y: seg.rect.y, width: seg.rect.width, height: seg.rect.height)
            track.fill(awcSliderRoundedRect(r, seg.radii), with: .color(Color(awcSRRGBA: seg.color)))
        }
        for t in p.ticks where t.opacity > 0 {
            let r = CGRect(x: t.rect.x, y: t.rect.y, width: t.rect.width, height: t.rect.height)
            var c = track; c.opacity = t.opacity
            c.fill(Path(ellipseIn: r), with: .color(Color(awcSRRGBA: t.color)))
        }
        for t in p.thumbs {
            let k = CGRect(x: t.knob.x, y: t.knob.y, width: t.knob.width, height: t.knob.height)
            let capsule = Path(roundedRect: k, cornerRadius: Swift.min(k.width, k.height) / 2)
            ctx.fill(capsule, with: .color(Color(awcSRRGBA: t.knobColor)))
            if t.focusRing {
                // outline: 3px solid secondary, offset 2px, following the capsule.
                let o = k.insetBy(dx: -3.5, dy: -3.5)
                ctx.stroke(Path(roundedRect: o, cornerRadius: Swift.min(o.width, o.height) / 2), with: .color(Color(awcSRRGBA: p.focusRingColor)), lineWidth: 3)
            }
        }
    }

    // MARK: input

    /// The rail drives range and vertical sliders; the single horizontal one goes through its (hidden) native input.
    private func railGesture(_ p: AWCSliderPaint) -> some Gesture {
        DragGesture(minimumDistance: 0, coordinateSpace: .local)
            .onChanged { v in
                let x = v.location.x - p.rail.x, y = v.location.y - p.rail.y
                model.perform {
                    if !dragging { dragging = true; model.s.pointerMove(x, y, p.rail.width, p.rail.height); model.s.pointerDown(x, y, p.rail.width, p.rail.height, touch: awcSRTouchInput) }
                    else { model.s.pointerMove(x, y, p.rail.width, p.rail.height) }
                }
                if let t = model.s.focusedThumb, model.handle(t).isFocused == false { _ = model.handle(t).requestPointerFocus?() }
            }
            .onEnded { v in
                let x = v.location.x - p.rail.x, y = v.location.y - p.rail.y
                dragging = false
                model.perform { model.s.pointerUp(x, y, p.rail.width, p.rail.height) }
            }
    }

    private func label(_ thumb: String) -> String {
        let base = str("sliderAriaLabel", str("ariaLabel", ""))
        switch thumb {
        case "start": return str("ariaLabelStart", str("labelStart", base.isEmpty ? "range start" : base))
        case "end": return str("ariaLabelEnd", str("labelEnd", base.isEmpty ? "range end" : base))
        default: return base.isEmpty ? "slider" : base
        }
    }
    private func valueText(_ thumb: String) -> String {
        let s = model.s
        let custom = thumb == "start" ? str("valueStartText", "") : thumb == "end" ? str("valueEndText", "") : str("valueText", "")
        if !custom.isEmpty { return custom }
        return awcSRJSNumberString(thumb == "start" ? s.displayStart : thumb == "end" ? s.displayEnd : s.displayValue)
    }

    /// Each thumb is a focusable, adjustable element (the Web's per-thumb native range input).
    private func thumbHandle(_ t: AWCSliderThumbPaint, _ p: AWCSliderPaint) -> some View {
        let hit = Swift.max(24.0, model.s.vertical ? t.box.height : t.box.width)
        let w = model.s.vertical ? t.box.width : hit, h = model.s.vertical ? hit : t.box.height
        return Color.clear
            .frame(width: w, height: h)
            .contentShape(Rectangle())
            .accessibilityHidden(true)
            .awcFocusBridgeLayer {
                AWCNativeAdjustableBridge(configuration: AWCAdjustableConfiguration(
                    id: "\(nodeID)-\(t.thumb)", label: label(t.thumb),
                    value: t.thumb == "start" ? model.s.displayStart : t.thumb == "end" ? model.s.displayEnd : model.s.displayValue,
                    min: model.s.min, max: model.s.max, valueText: customValueText(t.thumb), vertical: model.s.vertical,
                    enabled: !model.s.disabled, tabStop: true, handle: model.handle(t.thumb),
                    focusChanged: { on, keyboard in
                        model.perform {
                            if on { if model.s.focusedThumb != t.thumb { model.s.focus(t.thumb, keyboard: keyboard && !dragging) } }
                            else if model.s.focusedThumb == t.thumb { model.s.blur() }
                        }
                    },
                    key: { name, up in
                        guard awcSliderKeyNames.contains(name) else { return false }
                        model.perform { if up { model.s.keyUp(t.thumb, name) } else { model.s.keyDown(t.thumb, name) } }
                        return true
                    },
                    step: { inc in model.perform { model.s.key(t.thumb, inc ? "ArrowUp" : "ArrowDown") } }))
            }
            .offset(x: t.box.x + t.box.width / 2 - w / 2, y: t.box.y + t.box.height / 2 - h / 2)
    }
    /// aria-valuetext of a thumb (valueText / valueStartText / valueEndText), nil when unset.
    private func customValueText(_ thumb: String) -> String? {
        let v = thumb == "start" ? str("valueStartText", "") : thumb == "end" ? str("valueEndText", "") : str("valueText", "")
        return v.isEmpty ? nil : v
    }
}

let awcSliderKeyNames: Set<String> = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown"]

func awcSliderKey(_ key: KeyEquivalent) -> String? {
    switch key {
    case .leftArrow: return "ArrowLeft"
    case .rightArrow: return "ArrowRight"
    case .upArrow: return "ArrowUp"
    case .downArrow: return "ArrowDown"
    case .home: return "Home"
    case .end: return "End"
    case .pageUp: return "PageUp"
    case .pageDown: return "PageDown"
    default: return nil
    }
}

/// A rect with per-corner radii (CSS border-radius, physical corners), radii clamped like CSS.
func awcSliderRoundedRect(_ r: CGRect, _ radii: AWCSliderRadii) -> Path {
    let f = Swift.min(1, r.width / Swift.max(1e-9, Swift.max(radii.tl + radii.tr, radii.bl + radii.br)),
                      r.height / Swift.max(1e-9, Swift.max(radii.tl + radii.bl, radii.tr + radii.br)))
    let tl = radii.tl * f, tr = radii.tr * f, br = radii.br * f, bl = radii.bl * f
    var p = Path()
    p.move(to: CGPoint(x: r.minX + tl, y: r.minY))
    p.addLine(to: CGPoint(x: r.maxX - tr, y: r.minY))
    if tr > 0 { p.addArc(tangent1End: CGPoint(x: r.maxX, y: r.minY), tangent2End: CGPoint(x: r.maxX, y: r.minY + tr), radius: tr) }
    p.addLine(to: CGPoint(x: r.maxX, y: r.maxY - br))
    if br > 0 { p.addArc(tangent1End: CGPoint(x: r.maxX, y: r.maxY), tangent2End: CGPoint(x: r.maxX - br, y: r.maxY), radius: br) }
    p.addLine(to: CGPoint(x: r.minX + bl, y: r.maxY))
    if bl > 0 { p.addArc(tangent1End: CGPoint(x: r.minX, y: r.maxY), tangent2End: CGPoint(x: r.minX, y: r.maxY - bl), radius: bl) }
    p.addLine(to: CGPoint(x: r.minX, y: r.minY + tl))
    if tl > 0 { p.addArc(tangent1End: CGPoint(x: r.minX, y: r.minY), tangent2End: CGPoint(x: r.minX + tl, y: r.minY), radius: tl) }
    p.closeSubpath()
    return p
}

extension Color {
    init(awcSRRGBA c: AWCSRRGBA) { self.init(.sRGB, red: c.0, green: c.1, blue: c.2, opacity: c.3) }
}
