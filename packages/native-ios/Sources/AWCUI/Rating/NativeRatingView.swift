import SwiftUI

// Dedicated SwiftUI renderer for md-rating: AWCRatingInteraction (hover preview, click / reset, keyboard, the
// readonly / disabled / soft-disabled gates) drives the value and events; AWCRatingLayout gives the row, the item
// boxes, the clipped glyph layers, the value label and the focus ring as Chrome lays them out; AWCSliderMotion runs
// the hover pop and state-layer transitions; presses start the glyph-clipped ripple (420 ms).

final class AWCRatingModel: ObservableObject {
    let r = AWCRatingInteraction()
    let motion = AWCSliderMotion()
    var hoverItem = -1, pressedItem = -1
    /// The last tapped item keeps its hover look (Chrome's emulated :hover after a tap) until focus leaves.
    var stickyItem = -1
    /// The item a finger is down on (touch press: ripple only).
    var touchItem = -1
    var ripples: [AWCRatingRipple] = []
    @Published var version = 0
    /// The native focus / accessibility element of the rating.
    let handle = AWCButtonFocusHandle()
    func perform(_ body: () -> Void) { body(); version &+= 1 }
}

/// The bundled Material Symbols face at the given variable axes (FILL / wght / GRAD 0 / opsz 24).
func awcRatingSymbolFont(size: Double, fill: Double, weight: Double) -> Font {
    _ = AWCNativeFonts.symbol(size: size)   // registers the bundled font
    let axes: [NSNumber: Double] = [NSNumber(value: 0x46494C4C): fill, NSNumber(value: 0x77676874): weight,
                                     NSNumber(value: 0x47524144): 0, NSNumber(value: 0x6F70737A): 24]
    let descriptor = CTFontDescriptorCreateWithAttributes([kCTFontNameAttribute: "MaterialSymbolsOutlined-Regular",
                                                           kCTFontVariationAttribute: axes] as CFDictionary)
    return Font(CTFontCreateWithFontDescriptor(descriptor, size, nil))
}

struct AWCNativeRatingView: View {
    var nodeID: String = ""
    let properties: [String: AWCValue]
    let set: (String, AWCValue) -> Void
    let emit: (String, AWCValue) -> Void
    @Environment(\.awcThemeTokens) private var envTokens
    @Environment(\.awcRatingAppearance) private var appearance
    @Environment(\.awcRatingParts) private var ratingParts
    @Environment(\.awcRatingController) private var publicController
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.layoutDirection) private var direction
    @Environment(\.awcNativeDensity) private var inheritedDensity
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @StateObject private var model = AWCRatingModel()
    @FocusState private var focused: Bool

    init(nodeID: String = "", properties: [String: AWCValue], set: @escaping (String, AWCValue) -> Void, emit: @escaping (String, AWCValue) -> Void) {
        self.nodeID = nodeID; self.properties = properties; self.set = set; self.emit = emit
    }

    private func str(_ k: String, _ d: String) -> String { let v = properties[k]?.string ?? ""; return v.isEmpty ? d : v }
    private func flag(_ k: String, _ d: Bool = false) -> Bool { properties[k]?.bool ?? d }
    /// Theme tokens, then the typed hooks (`.awcRatingAppearance`), then the host's inline `style` custom properties.
    private var tokens: [String: String] {
        awcSREffectiveTokens(envTokens.isEmpty ? AWCTheme.generated(dark: colorScheme == .dark).tokens : envTokens, hooks: appearance.hooks, style: properties["style"]?.string)
    }

    private var theme: AWCRatingTheme {
        let t = tokens, dark = colorScheme == .dark
        var th = AWCRatingTheme(secondary: awcSRToken(t, "--md-sys-color-secondary", dark ? "#CCC2DC" : "#625B71"),
                                onSurface: awcSRToken(t, "--md-sys-color-on-surface", dark ? "#E6E1E5" : "#1C1B1F"),
                                onSurfaceVariant: awcSRToken(t, "--md-sys-color-on-surface-variant", dark ? "#CAC4D0" : "#49454F"))
        th.densityScale = inheritedDensity
        th.gapXs = awcSRNumberToken(t, "--md-sys-spacing-gap-xs", 4); th.gapMd = awcSRNumberToken(t, "--md-sys-spacing-gap-md", 12)
        th.labelLineHeight = awcSRNumberToken(t, "--md-sys-typescale-label-medium-line-height", 16)
        th.disabledContentOpacity = awcSRNumberToken(t, "--md-sys-state-disabled-content-opacity", 0.38)
        th.hoverOpacity = awcSRNumberToken(t, "--md-sys-state-hover-state-layer-opacity", 0.08)
        th.pressedOpacity = awcSRNumberToken(t, "--md-sys-state-pressed-state-layer-opacity", 0.12)
        th.durationShort3Ms = awcSRNumberToken(t, "--md-sys-motion-duration-short3", 150)
        th.rippleEnabled = (t["--md-sys-ripple-enabled"] ?? "").trimmingCharacters(in: .whitespaces) != "0"
        return th
    }

    private var hooks: AWCRatingHooks {
        var hk: [String: String] = [:]
        for (k, v) in tokens where k.hasPrefix("--md-rating-") { hk[String(k.dropFirst("--md-rating-".count))] = v }
        for part in (properties["style"]?.string ?? "").split(separator: ";") {
            let kv = part.split(separator: ":", maxSplits: 1).map { $0.trimmingCharacters(in: .whitespaces) }
            if kv.count == 2, kv[0].hasPrefix("--md-rating-") { hk[String(kv[0].dropFirst("--md-rating-".count))] = kv[1] }
        }
        func px(_ k: String) -> Double? { hk[k].flatMap { awcSRCSSPixels($0) } }
        var h = AWCRatingHooks(itemSize: px("item-size"), itemGap: px("item-gap"), activeColor: hk["active-color"], inactiveColor: hk["inactive-color"],
                               focusRingColor: hk["focus-ring-color"], focusRingWidth: px("focus-ring-width"), focusRingOffset: px("focus-ring-offset"),
                               stateLayerColor: hk["state-layer-color"], valueLabelColor: hk["value-label-color"])
        if let f = hk["value-label-font"], let slash = f.firstIndex(of: "/") {
            let rest = f[f.index(after: slash)...].split(separator: " ", maxSplits: 1)
            h.valueLabelLineHeight = rest.first.flatMap { awcSRCSSPixels(String($0)) }
            h.valueLabelFontFamily = rest.count > 1 ? String(rest[1]) : nil
        }
        h.popScale = hk["pop-scale"].flatMap(Double.init); h.durationMs = hk["duration"].flatMap { Double($0.replacingOccurrences(of: "ms", with: "")) }
        return h
    }

    /// Host properties → the interaction, once per render (the interaction runs Stencil's watchers on changes only).
    private func sync() {
        let r = model.r
        r.getLabel = publicController?.getLabel
        model.motion.reducedMotion = reduceMotion
        r.onEvent = { [emit] n, v in emit(n, v.map { AWCValue.number($0) } ?? .null) }
        // The component's writes into its own value reach the node after the update (a clamp happens during body).
        r.onPropWrite = { [set] v in DispatchQueue.main.async { set("value", .number(v)) } }
        r.sync(AWCRatingProps(value: properties["value"]?.number ?? 0, defaultValue: properties["defaultValue"]?.number ?? 0,
                              max: Swift.max(1, Int(properties["max"]?.number ?? 5)), precision: properties["precision"]?.number ?? 1,
                              readonly: flag("readonly"), disabled: flag("disabled"), softDisabled: flag("softDisabled"), hover: str("hover", "preview"),
                              rtl: str("dir", "") == "rtl" || (str("dir", "") != "ltr" && direction == .rightToLeft)))
    }

    var body: some View {
        let _ = model.version
        let _ = sync()
        let th = theme, hk = AWCRatingParts.hooks(hooks, ratingParts)
        let settled = AWCRatingLayout.layout(model.r, theme: th, hooks: hk, size: str("size", "md"), icon: str("icon", "star"),
                                             emptyIcon: str("emptyIcon", "star"), outlineEmpty: flag("outlineEmpty", true),
                                             showValueLabel: flag("showValueLabel"), densityProp: properties["density"]?.number.map { Int($0) })
        TimelineView(.animation(minimumInterval: nil, paused: !animating)) { ctx in
            let now = ctx.date.timeIntervalSince1970 * 1000
            let p = AWCRatingLayout.layout(model.r, theme: th, hooks: hk, size: str("size", "md"), icon: str("icon", "star"),
                                           emptyIcon: str("emptyIcon", "star"), outlineEmpty: flag("outlineEmpty", true),
                                           showValueLabel: flag("showValueLabel"), densityProp: properties["density"]?.number.map { Int($0) },
                                           hoverItem: model.hoverItem >= 0 ? model.hoverItem : model.stickyItem, pressedItem: model.pressedItem, ripples: model.ripples,
                                           reducedMotion: reduceMotion, motion: model.motion, now: now)
            row(p)
        }
        .frame(width: settled.width, height: settled.height)
        .environment(\.layoutDirection, .leftToRight)   // the layout model already mirrors RTL
        .awcInspect(nodeID: nodeID, name: "md-rating") { size in
            var m: [String: AWCValue] = ["width": .number(Double(size.width)), "height": .number(Double(size.height)), "value": .number(model.r.value),
                                         "focused": .bool(model.r.focused), "items": .number(Double(settled.itemList.count)), "activeColor": .string(awcSRHex(settled.activeColor))]
            if let first = settled.itemList.first { m["itemSize"] = .number(first.rect.height) }
            if let t = settled.labelText { m["valueLabel"] = .string(t) }
            return m
        }
        .onAppear { publicController?.focus = { [model] in _ = model.handle.requestPointerFocus?() } }   // script focus: no ring until a key
        .onDisappear { publicController?.focus = nil }
    }

    private var animating: Bool {
        let now = Date().timeIntervalSince1970 * 1000
        return model.motion.active(now) || model.ripples.contains { now < $0.start + 420 }
    }

    private func row(_ p: AWCRatingPaint) -> some View {
        ZStack(alignment: .topLeading) {
            ForEach(p.itemList, id: \.index) { it in item(it, p) }
            if let l = p.label, let text = p.labelText {
                // CSS `direction: rtl` sets the paragraph's base direction ("2.5 Stars" reads "Stars 2.5"); SwiftUI derives it
                // from the first strong character, so an RTL host leads with a right-to-left mark.
                Text(direction == .rightToLeft ? "\u{200F}" + text : text).font(AWCNativeFonts.label(size: p.labelFontSize, weight: p.labelFontWeight)).monospacedDigit().tracking(p.labelLetterSpacing)
                    .foregroundStyle(Color(awcSRRGBA: p.labelColor)).lineLimit(1).fixedSize()
                    .frame(width: l.width, height: l.height, alignment: .leading)
                    .offset(x: l.x, y: l.y).accessibilityHidden(true)
            }
            if p.focusRing {
                let o = p.focusRingOffset + p.focusRingWidth / 2
                Capsule().stroke(Color(awcSRRGBA: p.focusRingColor), lineWidth: p.focusRingWidth)
                    .frame(width: p.items.width + 2 * o, height: p.items.height + 2 * o)
                    .offset(x: p.items.x - o, y: p.items.y - o).allowsHitTesting(false)
            }
        }
        .frame(width: p.width, height: p.height, alignment: .topLeading)
        // CSS `opacity`: the glyph layers (empty, filled clip, state layer) fade as one composited group.
        .compositingGroup().opacity(p.opacity)
        .accessibilityHidden(true)
        .awcFocusBridgeLayer {
            AWCNativeAdjustableBridge(configuration: AWCAdjustableConfiguration(
                id: nodeID, label: model.r.readonly ? "\(str("ratingLabel", "Rating")): \(model.r.label(model.r.value))" : str("ratingLabel", str("ariaLabel", "Rating")),
                role: model.r.readonly ? .image : .slider, value: model.r.value, min: 0, max: Double(model.r.max), valueText: model.r.label(model.r.value),
                enabled: !model.r.disabled && !model.r.softDisabled, focusable: model.r.focusable, tabStop: model.r.focusable, handle: model.handle,
                focusChanged: { on, keyboard in model.perform { if on { if !model.r.focused { model.r.focus(keyboard: keyboard) } } else { model.r.blur(); model.stickyItem = -1 } } },
                key: { name, up in
                    guard !up else { return true }
                    var handled = false
                    model.perform { handled = model.r.keyDown(name) }
                    return handled
                },
                step: { inc in model.perform { _ = model.r.keyDown(inc ? "ArrowUp" : "ArrowDown") } }))
        }
    }

    private func item(_ it: AWCRatingItemPaint, _ p: AWCRatingPaint) -> some View {
        let size = p.glyphSize
        func glyph(_ name: String, fill: Double, weight: Double, _ color: AWCSRRGBA) -> some View {
            Text(name).font(awcRatingSymbolFont(size: size, fill: fill, weight: weight)).foregroundStyle(Color(awcSRRGBA: color))
                .fixedSize().frame(width: size, height: size)
        }
        // The icon box is 1em (`material-symbols-outlined`): at the item box's top-left corner (top-right in RTL) when
        // ::part(item) makes the box larger than the glyph.
        let corner: Alignment = it.clipFromLeft ? .topTrailing : .topLeading, gx = it.clipFromLeft ? it.rect.width - size : 0
        let clipW = size * (1 - it.clipPct / 100)
        return ZStack(alignment: corner) {
            glyph(p.emptyIcon, fill: Double(p.emptyFill), weight: Double(p.emptyWeight), p.inactiveColor)
            // The filled copy, clipped from the inline-end side (left edge in RTL).
            glyph(p.icon, fill: 1, weight: 500, p.iconColor ?? p.activeColor)
                .mask(alignment: it.clipFromLeft ? .trailing : .leading) { Rectangle().frame(width: Swift.max(0, clipW)) }
            if it.stateVisible && it.stateOpacity > 0 { glyph(p.icon, fill: 1, weight: 500, p.stateLayerColor).opacity(it.stateOpacity) }
            if it.stateVisible, let rad = it.rippleRadiusPct {
                let r = AWCRatingLayout.rippleRadius(rad, it.rect.width, it.rect.height)
                glyph(p.icon, fill: 1, weight: 500, p.stateLayerColor).opacity(it.rippleOpacity)
                    .mask(alignment: .topLeading) {
                        Circle().frame(width: 2 * r, height: 2 * r)
                            .offset(x: it.rippleXPct / 100 * it.rect.width - r - gx, y: it.rippleYPct / 100 * it.rect.height - r)
                    }
            }
        }
        .frame(width: it.rect.width, height: it.rect.height, alignment: corner)
        .scaleEffect(it.scale)
        .offset(x: it.rect.x, y: it.rect.y)
        .contentShape(Rectangle())
        .onContinuousHover { phase in
            switch phase {
            case .active(let loc):
                model.perform { model.hoverItem = it.index; model.stickyItem = -1; model.r.pointerMove(it.index, Swift.max(0, Swift.min(1, loc.x / it.rect.width))) }
            case .ended:
                model.perform { if model.hoverItem == it.index { model.hoverItem = -1; model.r.pointerLeave() } }
            }
        }
        .gesture(DragGesture(minimumDistance: 0)
            .onChanged { v in
                guard model.pressedItem != it.index && model.touchItem != it.index else { return }
                let fx = Swift.max(0, Swift.min(1, v.startLocation.x / it.rect.width))
                model.perform {
                    if awcSRTouchInput {
                        // A finger (Chrome): pointerdown runs the ripple only — no hover preview, no :active layer, no focus yet.
                        model.touchItem = it.index
                    } else {
                        model.hoverItem = it.index; model.pressedItem = it.index
                        model.r.pointerMove(it.index, fx); model.r.pointerDown()
                    }
                    model.ripples.append(AWCRatingRipple(item: it.index, start: Date().timeIntervalSince1970 * 1000, xPct: fx * 100,
                                                         yPct: Swift.max(0, Swift.min(100, v.startLocation.y / it.rect.height * 100))))
                    model.ripples.removeAll { $0.start + 420 < Date().timeIntervalSince1970 * 1000 - 1000 }
                }
                if model.r.focused && !model.handle.isFocused { _ = model.handle.requestPointerFocus?() }
            }
            .onEnded { v in
                let fx = Swift.max(0, Swift.min(1, v.location.x / it.rect.width))
                if awcSRTouchInput {
                    model.perform { model.touchItem = -1; model.stickyItem = it.index; model.pressedItem = it.index; model.r.tap(it.index, fx) }
                    if model.r.focused && !model.handle.isFocused { _ = model.handle.requestPointerFocus?() }
                    // Chrome holds :active 150 ms after the tap's synthesized mousedown (kMinimumActiveInterval).
                    let tapped = it.index
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) { if model.pressedItem == tapped { model.perform { model.pressedItem = -1 } } }
                } else {
                    model.perform { model.pressedItem = -1; model.r.pointerMove(it.index, fx); model.r.click(it.index, fx) }
                }
            })
        .allowsHitTesting(!model.r.disabled && !model.r.softDisabled)
    }
}
