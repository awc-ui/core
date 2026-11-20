import SwiftUI
import QuartzCore
#if canImport(AppKit)
import AppKit
#elseif canImport(UIKit)
import UIKit
#endif
#if canImport(Speech)
import Speech
#endif

// md-search: the resting bar (or icon trigger), the docked panel anchored under the bar and the full-screen view in the
// application's modal viewport (AWCModalScope), with the source's value pipeline (mdInput per keystroke, mdSearch
// debounced / maxWait-throttled / trimmed and distinct, flushed on Enter and clear, mdChange on blur), open / close with
// mdOpen / mdClose and the two-stage close motion, result-row keyboard navigation, the full-screen focus trap, the polite
// results announcement, the loading ↔ clear morph and voice search.

// MARK: Appearance (the --md-search-* hooks)

public struct AWCSearchAppearance: Equatable, Sendable {
    /// `--md-search-container-color`
    public let containerColor: String?
    /// `--md-search-container-elevation`
    public let containerElevation: [AWCBoxShadow]?
    /// `--md-search-leading-icon-color`
    public let leadingIconColor: String?
    /// `--md-search-trailing-icon-color`
    public let trailingIconColor: String?
    /// `--md-search-icon-color`
    public let iconColor: String?
    /// `--md-search-loading-color`
    public let loadingColor: String?
    /// `--md-search-container-shape`
    public let containerShape: Double?
    /// `--md-search-container-height`
    public let containerHeight: Double?
    /// `--md-search-icon-button-size`
    public let iconButtonSize: Double?
    /// `--md-search-leading-icon-label-gap`
    public let leadingIconLabelGap: Double?
    /// `--md-search-trailing-icon-label-gap`
    public let trailingIconLabelGap: Double?
    /// `--md-search-container-padding-inline`
    public let containerPaddingInline: Double?
    /// `--md-search-container-padding-inline-focused`
    public let containerPaddingInlineFocused: Double?
    /// `--md-search-leading-padding-inline`
    public let leadingPaddingInline: Double?
    /// `--md-search-trailing-padding-inline`
    public let trailingPaddingInline: Double?
    /// `--md-search-input-color`
    public let inputColor: String?
    /// `--md-search-input-font-family`
    public let inputFontFamily: String?
    /// `--md-search-input-font-size`
    public let inputFontSize: Double?
    /// `--md-search-input-line-height`
    public let inputLineHeight: Double?
    /// `--md-search-input-font-weight`
    public let inputFontWeight: Double?
    /// `--md-search-input-letter-spacing`
    public let inputLetterSpacing: Double?
    /// `--md-search-placeholder-color`
    public let placeholderColor: String?
    /// `--md-search-state-layer-color`
    public let stateLayerColor: String?
    /// `--md-search-focus-indicator-color`
    public let focusIndicatorColor: String?
    /// `--md-search-focus-indicator-offset`
    public let focusIndicatorOffset: Double?
    /// `--md-search-avatar-size`
    public let avatarSize: Double?
    /// `--md-search-panel-min-block-size`
    public let panelMinBlockSize: Double?
    /// `--md-search-panel-max-block-size`
    public let panelMaxBlockSize: Double?
    /// `--md-search-max-block-size`
    public let maxBlockSize: Double?
    /// `--md-search-docked-panel-shape`
    public let dockedPanelShape: Double?
    /// `--md-search-panel-offset`
    public let panelOffset: Double?
    /// `--md-search-bar-fullscreen-color`
    public let barFullscreenColor: String?
    /// `--md-search-fullscreen-results-color`
    public let fullscreenResultsColor: String?
    /// `--md-search-divider-color`
    public let dividerColor: String?
    /// `--md-search-divider-thickness`
    public let dividerThickness: Double?
    /// `--md-search-fullscreen-bar-panel-gap`
    public let fullscreenBarPanelGap: Double?
    /// `--md-search-empty-color`
    public let emptyColor: String?
    /// `--md-search-empty-padding-block`
    public let emptyPaddingBlock: Double?
    /// `--md-search-empty-padding-inline`
    public let emptyPaddingInline: Double?
    /// `--md-search-expand-inset`
    public let expandInset: Double?
    /// `--md-search-expand-focused-inset`
    public let expandFocusedInset: Double?
    /// `--md-search-expand-duration`
    public let expandDuration: Double?
    /// `--md-search-expand-easing`
    public let expandEasing: [Double]?
    /// `--md-search-panel-motion-duration`
    public let panelMotionDuration: Double?
    /// `--md-search-fullscreen-expand-duration`
    public let fullscreenExpandDuration: Double?
    /// `--md-search-fullscreen-expand-easing`
    public let fullscreenExpandEasing: [Double]?
    /// `--md-search-fullscreen-collapse-easing`
    public let fullscreenCollapseEasing: [Double]?
    /// `--md-search-divided-fullscreen-bar-height`
    public let dividedFullscreenBarHeight: Double?
    /// `--md-search-container-min-inline-size`
    public let containerMinInlineSize: Double?
    /// `--md-search-container-max-inline-size`
    public let containerMaxInlineSize: Double?
    /// `--md-search-icon-size`
    public let iconSize: Double?
    /// `--md-search-focus-indicator-thickness`
    public let focusIndicatorThickness: Double?
    /// `--md-search-panel-padding-block-start`
    public let panelPaddingBlockStart: Double?
    /// `--md-search-contained-background-color`
    public let containedBackgroundColor: String?
    /// `--md-search-contained-docked-panel-offset`
    public let containedDockedPanelOffset: Double?
    /// `--md-search-fullscreen-bar-offset-block-start`
    public let fullscreenBarOffsetBlockStart: Double?
    /// `--md-search-fullscreen-bar-offset-inline`
    public let fullscreenBarOffsetInline: Double?
    /// `--md-search-fullscreen-collapse-duration`
    public let fullscreenCollapseDuration: Double?
    /// `--md-search-hover-state-layer-opacity`
    public let hoverStateLayerOpacity: Double?
    /// `--md-search-pressed-state-layer-opacity`
    public let pressedStateLayerOpacity: Double?
    public init(containerColor: String? = nil, containerElevation: [AWCBoxShadow]? = nil, leadingIconColor: String? = nil, trailingIconColor: String? = nil, iconColor: String? = nil, loadingColor: String? = nil, containerShape: Double? = nil, containerHeight: Double? = nil, iconButtonSize: Double? = nil, leadingIconLabelGap: Double? = nil, trailingIconLabelGap: Double? = nil, containerPaddingInline: Double? = nil, containerPaddingInlineFocused: Double? = nil, leadingPaddingInline: Double? = nil, trailingPaddingInline: Double? = nil, inputColor: String? = nil, inputFontFamily: String? = nil, inputFontSize: Double? = nil, inputLineHeight: Double? = nil, inputFontWeight: Double? = nil, inputLetterSpacing: Double? = nil, placeholderColor: String? = nil, stateLayerColor: String? = nil, focusIndicatorColor: String? = nil, focusIndicatorOffset: Double? = nil, avatarSize: Double? = nil, panelMinBlockSize: Double? = nil, panelMaxBlockSize: Double? = nil, maxBlockSize: Double? = nil, dockedPanelShape: Double? = nil, panelOffset: Double? = nil, barFullscreenColor: String? = nil, fullscreenResultsColor: String? = nil, dividerColor: String? = nil, dividerThickness: Double? = nil, fullscreenBarPanelGap: Double? = nil, emptyColor: String? = nil, emptyPaddingBlock: Double? = nil, emptyPaddingInline: Double? = nil, expandInset: Double? = nil, expandFocusedInset: Double? = nil, expandDuration: Double? = nil, expandEasing: [Double]? = nil, panelMotionDuration: Double? = nil, fullscreenExpandDuration: Double? = nil, fullscreenExpandEasing: [Double]? = nil, fullscreenCollapseEasing: [Double]? = nil, dividedFullscreenBarHeight: Double? = nil, containerMinInlineSize: Double? = nil, containerMaxInlineSize: Double? = nil, iconSize: Double? = nil, focusIndicatorThickness: Double? = nil, panelPaddingBlockStart: Double? = nil, containedBackgroundColor: String? = nil, containedDockedPanelOffset: Double? = nil, fullscreenBarOffsetBlockStart: Double? = nil, fullscreenBarOffsetInline: Double? = nil, fullscreenCollapseDuration: Double? = nil, hoverStateLayerOpacity: Double? = nil, pressedStateLayerOpacity: Double? = nil) {
        self.containerColor = awcFieldColor(containerColor)
        self.containerElevation = containerElevation.flatMap { $0.allSatisfy(\.valid) ? $0 : nil }
        self.leadingIconColor = awcFieldColor(leadingIconColor)
        self.trailingIconColor = awcFieldColor(trailingIconColor)
        self.iconColor = awcFieldColor(iconColor)
        self.loadingColor = awcFieldColor(loadingColor)
        self.containerShape = containerShape.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil }
        self.containerHeight = containerHeight.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil }
        self.iconButtonSize = iconButtonSize.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil }
        self.leadingIconLabelGap = leadingIconLabelGap.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil }
        self.trailingIconLabelGap = trailingIconLabelGap.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil }
        self.containerPaddingInline = containerPaddingInline.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil }
        self.containerPaddingInlineFocused = containerPaddingInlineFocused.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil }
        self.leadingPaddingInline = leadingPaddingInline.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil }
        self.trailingPaddingInline = trailingPaddingInline.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil }
        self.inputColor = awcFieldColor(inputColor)
        self.inputFontFamily = inputFontFamily.flatMap { $0.trimmingCharacters(in: .whitespaces).isEmpty ? nil : $0 }
        self.inputFontSize = inputFontSize.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil }
        self.inputLineHeight = inputLineHeight.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil }
        self.inputFontWeight = inputFontWeight.flatMap { $0.isFinite ? $0 : nil }
        self.inputLetterSpacing = inputLetterSpacing.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil }
        self.placeholderColor = awcFieldColor(placeholderColor)
        self.stateLayerColor = awcFieldColor(stateLayerColor)
        self.focusIndicatorColor = awcFieldColor(focusIndicatorColor)
        self.focusIndicatorOffset = focusIndicatorOffset.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil }
        self.avatarSize = avatarSize.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil }
        self.panelMinBlockSize = panelMinBlockSize.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil }
        self.panelMaxBlockSize = panelMaxBlockSize.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil }
        self.maxBlockSize = maxBlockSize.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil }
        self.dockedPanelShape = dockedPanelShape.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil }
        self.panelOffset = panelOffset.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil }
        self.barFullscreenColor = awcFieldColor(barFullscreenColor)
        self.fullscreenResultsColor = awcFieldColor(fullscreenResultsColor)
        self.dividerColor = awcFieldColor(dividerColor)
        self.dividerThickness = dividerThickness.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil }
        self.fullscreenBarPanelGap = fullscreenBarPanelGap.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil }
        self.emptyColor = awcFieldColor(emptyColor)
        self.emptyPaddingBlock = emptyPaddingBlock.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil }
        self.emptyPaddingInline = emptyPaddingInline.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil }
        self.expandInset = expandInset.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil }
        self.expandFocusedInset = expandFocusedInset.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil }
        self.expandDuration = expandDuration.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil }
        self.expandEasing = expandEasing.flatMap { $0.count == 4 && $0.allSatisfy(\.isFinite) ? $0 : nil }
        self.panelMotionDuration = panelMotionDuration.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil }
        self.fullscreenExpandDuration = fullscreenExpandDuration.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil }
        self.fullscreenExpandEasing = fullscreenExpandEasing.flatMap { $0.count == 4 && $0.allSatisfy(\.isFinite) ? $0 : nil }
        self.fullscreenCollapseEasing = fullscreenCollapseEasing.flatMap { $0.count == 4 && $0.allSatisfy(\.isFinite) ? $0 : nil }
        self.dividedFullscreenBarHeight = dividedFullscreenBarHeight.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil }
        self.containerMinInlineSize = containerMinInlineSize.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil }
        self.containerMaxInlineSize = containerMaxInlineSize.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil }
        self.iconSize = iconSize.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil }
        self.focusIndicatorThickness = focusIndicatorThickness.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil }
        self.panelPaddingBlockStart = panelPaddingBlockStart.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil }
        self.containedBackgroundColor = awcFieldColor(containedBackgroundColor)
        self.containedDockedPanelOffset = containedDockedPanelOffset.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil }
        self.fullscreenBarOffsetBlockStart = fullscreenBarOffsetBlockStart.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil }
        self.fullscreenBarOffsetInline = fullscreenBarOffsetInline.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil }
        self.fullscreenCollapseDuration = fullscreenCollapseDuration.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil }
        self.hoverStateLayerOpacity = hoverStateLayerOpacity.flatMap { $0.isFinite ? $0 : nil }
        self.pressedStateLayerOpacity = pressedStateLayerOpacity.flatMap { $0.isFinite ? $0 : nil }
    }
    /// From the Laboratory / host value map (lengths in px, durations in ms, easings as cubic-bezier control points or CSS text).
    public init(values v: [String: AWCValue]) {
        func s(_ k: String) -> String? { (v[k]?.string).flatMap { $0.isEmpty ? nil : $0 } }
        func n(_ k: String) -> Double? { v[k]?.number ?? (v[k]?.string).flatMap { Double($0.replacingOccurrences(of: "px", with: "").replacingOccurrences(of: "ms", with: "").trimmingCharacters(in: .whitespaces)) } }
        func e(_ k: String) -> [Double]? { if case .array(let a) = v[k] { let d = a.compactMap(\.number); return d.count == 4 ? d : nil }; return s(k).flatMap { awcCSSCubicBezier($0) } }
        func sh(_ k: String) -> [AWCBoxShadow]? { s(k).flatMap { AWCBoxShadow.source($0) } }
        self.init(containerColor: s("containerColor"), containerElevation: sh("containerElevation"), leadingIconColor: s("leadingIconColor"), trailingIconColor: s("trailingIconColor"), iconColor: s("iconColor"), loadingColor: s("loadingColor"), containerShape: n("containerShape"), containerHeight: n("containerHeight"), iconButtonSize: n("iconButtonSize"), leadingIconLabelGap: n("leadingIconLabelGap"), trailingIconLabelGap: n("trailingIconLabelGap"), containerPaddingInline: n("containerPaddingInline"), containerPaddingInlineFocused: n("containerPaddingInlineFocused"), leadingPaddingInline: n("leadingPaddingInline"), trailingPaddingInline: n("trailingPaddingInline"), inputColor: s("inputColor"), inputFontFamily: s("inputFontFamily"), inputFontSize: n("inputFontSize"), inputLineHeight: n("inputLineHeight"), inputFontWeight: n("inputFontWeight"), inputLetterSpacing: n("inputLetterSpacing"), placeholderColor: s("placeholderColor"), stateLayerColor: s("stateLayerColor"), focusIndicatorColor: s("focusIndicatorColor"), focusIndicatorOffset: n("focusIndicatorOffset"), avatarSize: n("avatarSize"), panelMinBlockSize: n("panelMinBlockSize"), panelMaxBlockSize: n("panelMaxBlockSize"), maxBlockSize: n("maxBlockSize"), dockedPanelShape: n("dockedPanelShape"), panelOffset: n("panelOffset"), barFullscreenColor: s("barFullscreenColor"), fullscreenResultsColor: s("fullscreenResultsColor"), dividerColor: s("dividerColor"), dividerThickness: n("dividerThickness"), fullscreenBarPanelGap: n("fullscreenBarPanelGap"), emptyColor: s("emptyColor"), emptyPaddingBlock: n("emptyPaddingBlock"), emptyPaddingInline: n("emptyPaddingInline"), expandInset: n("expandInset"), expandFocusedInset: n("expandFocusedInset"), expandDuration: n("expandDuration"), expandEasing: e("expandEasing"), panelMotionDuration: n("panelMotionDuration"), fullscreenExpandDuration: n("fullscreenExpandDuration"), fullscreenExpandEasing: e("fullscreenExpandEasing"), fullscreenCollapseEasing: e("fullscreenCollapseEasing"), dividedFullscreenBarHeight: n("dividedFullscreenBarHeight"), containerMinInlineSize: n("containerMinInlineSize"), containerMaxInlineSize: n("containerMaxInlineSize"), iconSize: n("iconSize"), focusIndicatorThickness: n("focusIndicatorThickness"), panelPaddingBlockStart: n("panelPaddingBlockStart"), containedBackgroundColor: s("containedBackgroundColor"), containedDockedPanelOffset: n("containedDockedPanelOffset"), fullscreenBarOffsetBlockStart: n("fullscreenBarOffsetBlockStart"), fullscreenBarOffsetInline: n("fullscreenBarOffsetInline"), fullscreenCollapseDuration: n("fullscreenCollapseDuration"), hoverStateLayerOpacity: n("hoverStateLayerOpacity"), pressedStateLayerOpacity: n("pressedStateLayerOpacity"))
    }
    public func merging(_ o: Self) -> Self {
        .init(containerColor: o.containerColor ?? containerColor, containerElevation: o.containerElevation ?? containerElevation, leadingIconColor: o.leadingIconColor ?? leadingIconColor, trailingIconColor: o.trailingIconColor ?? trailingIconColor, iconColor: o.iconColor ?? iconColor, loadingColor: o.loadingColor ?? loadingColor, containerShape: o.containerShape ?? containerShape, containerHeight: o.containerHeight ?? containerHeight, iconButtonSize: o.iconButtonSize ?? iconButtonSize, leadingIconLabelGap: o.leadingIconLabelGap ?? leadingIconLabelGap, trailingIconLabelGap: o.trailingIconLabelGap ?? trailingIconLabelGap, containerPaddingInline: o.containerPaddingInline ?? containerPaddingInline, containerPaddingInlineFocused: o.containerPaddingInlineFocused ?? containerPaddingInlineFocused, leadingPaddingInline: o.leadingPaddingInline ?? leadingPaddingInline, trailingPaddingInline: o.trailingPaddingInline ?? trailingPaddingInline, inputColor: o.inputColor ?? inputColor, inputFontFamily: o.inputFontFamily ?? inputFontFamily, inputFontSize: o.inputFontSize ?? inputFontSize, inputLineHeight: o.inputLineHeight ?? inputLineHeight, inputFontWeight: o.inputFontWeight ?? inputFontWeight, inputLetterSpacing: o.inputLetterSpacing ?? inputLetterSpacing, placeholderColor: o.placeholderColor ?? placeholderColor, stateLayerColor: o.stateLayerColor ?? stateLayerColor, focusIndicatorColor: o.focusIndicatorColor ?? focusIndicatorColor, focusIndicatorOffset: o.focusIndicatorOffset ?? focusIndicatorOffset, avatarSize: o.avatarSize ?? avatarSize, panelMinBlockSize: o.panelMinBlockSize ?? panelMinBlockSize, panelMaxBlockSize: o.panelMaxBlockSize ?? panelMaxBlockSize, maxBlockSize: o.maxBlockSize ?? maxBlockSize, dockedPanelShape: o.dockedPanelShape ?? dockedPanelShape, panelOffset: o.panelOffset ?? panelOffset, barFullscreenColor: o.barFullscreenColor ?? barFullscreenColor, fullscreenResultsColor: o.fullscreenResultsColor ?? fullscreenResultsColor, dividerColor: o.dividerColor ?? dividerColor, dividerThickness: o.dividerThickness ?? dividerThickness, fullscreenBarPanelGap: o.fullscreenBarPanelGap ?? fullscreenBarPanelGap, emptyColor: o.emptyColor ?? emptyColor, emptyPaddingBlock: o.emptyPaddingBlock ?? emptyPaddingBlock, emptyPaddingInline: o.emptyPaddingInline ?? emptyPaddingInline, expandInset: o.expandInset ?? expandInset, expandFocusedInset: o.expandFocusedInset ?? expandFocusedInset, expandDuration: o.expandDuration ?? expandDuration, expandEasing: o.expandEasing ?? expandEasing, panelMotionDuration: o.panelMotionDuration ?? panelMotionDuration, fullscreenExpandDuration: o.fullscreenExpandDuration ?? fullscreenExpandDuration, fullscreenExpandEasing: o.fullscreenExpandEasing ?? fullscreenExpandEasing, fullscreenCollapseEasing: o.fullscreenCollapseEasing ?? fullscreenCollapseEasing, dividedFullscreenBarHeight: o.dividedFullscreenBarHeight ?? dividedFullscreenBarHeight, containerMinInlineSize: o.containerMinInlineSize ?? containerMinInlineSize, containerMaxInlineSize: o.containerMaxInlineSize ?? containerMaxInlineSize, iconSize: o.iconSize ?? iconSize, focusIndicatorThickness: o.focusIndicatorThickness ?? focusIndicatorThickness, panelPaddingBlockStart: o.panelPaddingBlockStart ?? panelPaddingBlockStart, containedBackgroundColor: o.containedBackgroundColor ?? containedBackgroundColor, containedDockedPanelOffset: o.containedDockedPanelOffset ?? containedDockedPanelOffset, fullscreenBarOffsetBlockStart: o.fullscreenBarOffsetBlockStart ?? fullscreenBarOffsetBlockStart, fullscreenBarOffsetInline: o.fullscreenBarOffsetInline ?? fullscreenBarOffsetInline, fullscreenCollapseDuration: o.fullscreenCollapseDuration ?? fullscreenCollapseDuration, hoverStateLayerOpacity: o.hoverStateLayerOpacity ?? hoverStateLayerOpacity, pressedStateLayerOpacity: o.pressedStateLayerOpacity ?? pressedStateLayerOpacity)
    }
}
/// Typed counterparts of md-search's `::part()` rules — the declarations that paint in Chrome. Part values come from the outer
/// tree, so they win over the hooks and every internal state rule (a state-layer opacity shows at rest), as `::part()` rules do.
/// Colours are #RRGGBB or #RRGGBBAA, opacities 0…1. Not typed: status (a visually hidden live region), trigger, panel-body and
/// results-host (layout wrappers whose boxes are the trigger button's, the panel's and the viewport's), loading / loading-shape
/// (the loading indicator keeps its own appearance; the loader slot replaces it) and the glyph colours (the icons keep their own
/// colour rule inside the buttons: use the hooks).
public struct AWCSearchPartAppearance: Equatable, Sendable {
    /// `::part(bar) { background-color }` (resting, open, full-screen and disabled bar).
    public let barBackgroundColor: String?
    /// `::part(state-layer) { background-color; opacity }` — the bar's hover / press layer.
    public let stateLayerColor: String?, stateLayerOpacity: Double?
    /// `::part(leading) { background-color }` — the leading box, padding included.
    public let leadingBackgroundColor: String?
    /// `::part(leading-state-layer) { background-color; opacity }` — the leading (search / back) button's layer.
    public let leadingStateLayerColor: String?, leadingStateLayerOpacity: Double?
    /// `::part(input) { color; caret-color }` (the caret follows the colour unless set).
    public let inputColor: String?, caretColor: String?
    /// `::part(trailing) { background-color }` — the trailing cluster's box, padding included.
    public let trailingBackgroundColor: String?
    /// `::part(clear-button | voice-button | trigger-button) { background-color }` — the round button boxes.
    public let clearButtonBackgroundColor: String?, voiceButtonBackgroundColor: String?, triggerButtonBackgroundColor: String?
    /// `::part(divider) { background-color }`, `::part(panel) { background-color }`, `::part(empty) { color }` and
    /// `::part(results-viewport) { background-color }`.
    public let dividerColor: String?, panelBackgroundColor: String?, emptyColor: String?, resultsViewportBackgroundColor: String?
    /// parts2: `::part(trigger)` (display: contents in Chrome: no box, stored and not painted), `::part(panel-body | results-host) { background-color }`,
    /// `::part(loading) { background-color }` (the indicator's box), `::part(loading-shape) { background-color }` (the shape's colour) and
    /// `::part(status)` (visually hidden: stored, nothing paints).
    public let triggerBackgroundColor: String?, panelBodyBackgroundColor: String?, resultsHostBackgroundColor: String?,
        loadingBackgroundColor: String?, loadingShapeBackgroundColor: String?, statusBackgroundColor: String?
    public init(barBackgroundColor: String? = nil, stateLayerColor: String? = nil, stateLayerOpacity: Double? = nil, leadingBackgroundColor: String? = nil,
                leadingStateLayerColor: String? = nil, leadingStateLayerOpacity: Double? = nil, inputColor: String? = nil, caretColor: String? = nil,
                trailingBackgroundColor: String? = nil, clearButtonBackgroundColor: String? = nil, voiceButtonBackgroundColor: String? = nil,
                triggerButtonBackgroundColor: String? = nil, dividerColor: String? = nil, panelBackgroundColor: String? = nil, emptyColor: String? = nil,
                resultsViewportBackgroundColor: String? = nil, triggerBackgroundColor: String? = nil, panelBodyBackgroundColor: String? = nil, resultsHostBackgroundColor: String? = nil, loadingBackgroundColor: String? = nil, loadingShapeBackgroundColor: String? = nil, statusBackgroundColor: String? = nil) {
        func unit(_ v: Double?) -> Double? { v.flatMap { $0.isFinite ? min(1, max(0, $0)) : nil } }
        self.barBackgroundColor = awcFieldColor(barBackgroundColor); self.stateLayerColor = awcFieldColor(stateLayerColor); self.stateLayerOpacity = unit(stateLayerOpacity)
        self.leadingBackgroundColor = awcFieldColor(leadingBackgroundColor); self.leadingStateLayerColor = awcFieldColor(leadingStateLayerColor)
        self.leadingStateLayerOpacity = unit(leadingStateLayerOpacity); self.inputColor = awcFieldColor(inputColor); self.caretColor = awcFieldColor(caretColor)
        self.trailingBackgroundColor = awcFieldColor(trailingBackgroundColor); self.clearButtonBackgroundColor = awcFieldColor(clearButtonBackgroundColor)
        self.voiceButtonBackgroundColor = awcFieldColor(voiceButtonBackgroundColor); self.triggerButtonBackgroundColor = awcFieldColor(triggerButtonBackgroundColor)
        self.dividerColor = awcFieldColor(dividerColor); self.panelBackgroundColor = awcFieldColor(panelBackgroundColor); self.emptyColor = awcFieldColor(emptyColor)
        self.resultsViewportBackgroundColor = awcFieldColor(resultsViewportBackgroundColor)
        self.triggerBackgroundColor = awcFieldColor(triggerBackgroundColor)
        self.panelBodyBackgroundColor = awcFieldColor(panelBodyBackgroundColor)
        self.resultsHostBackgroundColor = awcFieldColor(resultsHostBackgroundColor)
        self.loadingBackgroundColor = awcFieldColor(loadingBackgroundColor)
        self.loadingShapeBackgroundColor = awcFieldColor(loadingShapeBackgroundColor)
        self.statusBackgroundColor = awcFieldColor(statusBackgroundColor)
    }
    public init(values v: [String: AWCValue]) {
        func t(_ k: String) -> String? { (v[k]?.string).flatMap { $0.isEmpty ? nil : $0 } }
        self.init(barBackgroundColor: t("barBackgroundColor"), stateLayerColor: t("stateLayerColor"), stateLayerOpacity: v["stateLayerOpacity"]?.number,
                  leadingBackgroundColor: t("leadingBackgroundColor"), leadingStateLayerColor: t("leadingStateLayerColor"),
                  leadingStateLayerOpacity: v["leadingStateLayerOpacity"]?.number, inputColor: t("inputColor"), caretColor: t("caretColor"),
                  trailingBackgroundColor: t("trailingBackgroundColor"), clearButtonBackgroundColor: t("clearButtonBackgroundColor"),
                  voiceButtonBackgroundColor: t("voiceButtonBackgroundColor"), triggerButtonBackgroundColor: t("triggerButtonBackgroundColor"),
                  dividerColor: t("dividerColor"), panelBackgroundColor: t("panelBackgroundColor"), emptyColor: t("emptyColor"),
                  resultsViewportBackgroundColor: t("resultsViewportBackgroundColor"), triggerBackgroundColor: t("triggerBackgroundColor"), panelBodyBackgroundColor: t("panelBodyBackgroundColor"), resultsHostBackgroundColor: t("resultsHostBackgroundColor"), loadingBackgroundColor: t("loadingBackgroundColor"), loadingShapeBackgroundColor: t("loadingShapeBackgroundColor"), statusBackgroundColor: t("statusBackgroundColor"))
    }
    public func merging(_ o: Self) -> Self {
        .init(barBackgroundColor: o.barBackgroundColor ?? barBackgroundColor, stateLayerColor: o.stateLayerColor ?? stateLayerColor,
              stateLayerOpacity: o.stateLayerOpacity ?? stateLayerOpacity, leadingBackgroundColor: o.leadingBackgroundColor ?? leadingBackgroundColor,
              leadingStateLayerColor: o.leadingStateLayerColor ?? leadingStateLayerColor, leadingStateLayerOpacity: o.leadingStateLayerOpacity ?? leadingStateLayerOpacity,
              inputColor: o.inputColor ?? inputColor, caretColor: o.caretColor ?? caretColor, trailingBackgroundColor: o.trailingBackgroundColor ?? trailingBackgroundColor,
              clearButtonBackgroundColor: o.clearButtonBackgroundColor ?? clearButtonBackgroundColor, voiceButtonBackgroundColor: o.voiceButtonBackgroundColor ?? voiceButtonBackgroundColor,
              triggerButtonBackgroundColor: o.triggerButtonBackgroundColor ?? triggerButtonBackgroundColor, dividerColor: o.dividerColor ?? dividerColor,
              panelBackgroundColor: o.panelBackgroundColor ?? panelBackgroundColor, emptyColor: o.emptyColor ?? emptyColor,
              resultsViewportBackgroundColor: o.resultsViewportBackgroundColor ?? resultsViewportBackgroundColor,
              triggerBackgroundColor: o.triggerBackgroundColor ?? triggerBackgroundColor, panelBodyBackgroundColor: o.panelBodyBackgroundColor ?? panelBodyBackgroundColor, resultsHostBackgroundColor: o.resultsHostBackgroundColor ?? resultsHostBackgroundColor, loadingBackgroundColor: o.loadingBackgroundColor ?? loadingBackgroundColor, loadingShapeBackgroundColor: o.loadingShapeBackgroundColor ?? loadingShapeBackgroundColor, statusBackgroundColor: o.statusBackgroundColor ?? statusBackgroundColor)
    }
}
private struct AWCSearchPartAppearanceKey: EnvironmentKey { static let defaultValue = AWCSearchPartAppearance() }
private struct AWCSearchPartAppearanceTargetsKey: EnvironmentKey { static let defaultValue: [String: AWCSearchPartAppearance] = [:] }
extension EnvironmentValues {
    var awcSearchPartAppearance: AWCSearchPartAppearance { get { self[AWCSearchPartAppearanceKey.self] } set { self[AWCSearchPartAppearanceKey.self] = newValue } }
    var awcSearchPartAppearanceTargets: [String: AWCSearchPartAppearance] { get { self[AWCSearchPartAppearanceTargetsKey.self] } set { self[AWCSearchPartAppearanceTargetsKey.self] = newValue } }
}
private struct AWCSearchPartAppearanceModifier: ViewModifier {
    let value: AWCSearchPartAppearance, id: String?
    @Environment(\.awcSearchPartAppearance) private var inherited
    @Environment(\.awcSearchPartAppearanceTargets) private var targets
    func body(content: Content) -> some View {
        if let id { var t = targets; t[id] = (t[id] ?? .init()).merging(value); return AnyView(content.environment(\.awcSearchPartAppearanceTargets, t)) }
        return AnyView(content.environment(\.awcSearchPartAppearance, inherited.merging(value)))
    }
}
public extension View {
    /// md-search `::part()` values for descendant searches, or for the one with node id `id`.
    func awcSearchPartAppearance(_ value: AWCSearchPartAppearance, for id: String? = nil) -> some View { modifier(AWCSearchPartAppearanceModifier(value: value, id: id)) }
}
private struct AWCSearchAppearanceKey: EnvironmentKey { static let defaultValue = AWCSearchAppearance() }
private struct AWCSearchAppearanceTargetsKey: EnvironmentKey { static let defaultValue: [String: AWCSearchAppearance] = [:] }
private struct AWCSearchControllersKey: EnvironmentKey { static let defaultValue: [String: AWCSearchController] = [:] }
private struct AWCSearchReducedMotionKey: EnvironmentKey { static let defaultValue: Bool? = nil }
private struct AWCNativeKeyInterceptorKey: EnvironmentKey { static let defaultValue: ((String, Bool) -> Bool)? = nil }
extension EnvironmentValues {
    var awcSearchAppearance: AWCSearchAppearance { get { self[AWCSearchAppearanceKey.self] } set { self[AWCSearchAppearanceKey.self] = newValue } }
    var awcSearchAppearanceTargets: [String: AWCSearchAppearance] { get { self[AWCSearchAppearanceTargetsKey.self] } set { self[AWCSearchAppearanceTargetsKey.self] = newValue } }
    var awcSearchControllers: [String: AWCSearchController] { get { self[AWCSearchControllersKey.self] } set { self[AWCSearchControllersKey.self] = newValue } }
    var awcSearchReducedMotion: Bool? { get { self[AWCSearchReducedMotionKey.self] } set { self[AWCSearchReducedMotionKey.self] = newValue } }
    /// Keys a composite takes before the focused AWC control inside it (md-search over its result rows: the source's window
    /// key listener moves focus after the row's own handler). Returns true when handled.
    public var awcNativeKeyInterceptor: ((String, Bool) -> Bool)? { get { self[AWCNativeKeyInterceptorKey.self] } set { self[AWCNativeKeyInterceptorKey.self] = newValue } }
}
private struct AWCSearchAppearanceModifier: ViewModifier {
    let value: AWCSearchAppearance, id: String?
    @Environment(\.awcSearchAppearance) private var inherited
    @Environment(\.awcSearchAppearanceTargets) private var targets
    func body(content: Content) -> some View {
        if let id { var t = targets; t[id] = (t[id] ?? .init()).merging(value); return AnyView(content.environment(\.awcSearchAppearanceTargets, t)) }
        return AnyView(content.environment(\.awcSearchAppearance, inherited.merging(value)))
    }
}
private struct AWCSearchControllerModifier: ViewModifier {
    let controller: AWCSearchController, id: String?
    @Environment(\.awcSearchControllers) private var controllers
    func body(content: Content) -> some View { var c = controllers; c[id ?? ""] = controller; return content.environment(\.awcSearchControllers, c) }
}
public extension View {
    /// md-search hook values for descendant searches, or for the one with node id `id`.
    func awcSearchAppearance(_ value: AWCSearchAppearance, for id: String? = nil) -> some View { modifier(AWCSearchAppearanceModifier(value: value, id: id)) }
    /// Attaches `controller` to the search with node id `id` (every descendant search without an id).
    func awcSearchController(_ controller: AWCSearchController, for id: String? = nil) -> some View { modifier(AWCSearchControllerModifier(controller: controller, id: id)) }
    /// Forces (or, with nil, releases) reduced motion for descendant searches (the system setting otherwise).
    func awcSearchReducedMotion(_ reduced: Bool?) -> some View { environment(\.awcSearchReducedMotion, reduced) }
}

// MARK: Methods

/// Native counterparts of md-search's methods: show, close, whenClosed, toggle, focusInput, startVoice, stopVoice.
@MainActor public final class AWCSearchController {
    weak var runtime: AWCSearchRuntime?
    public init() {}
    public var isConnected: Bool { runtime != nil }
    /// Opens the view (mdOpen once the change applies).
    public func show() { runtime?.requestOpen(true) }
    public func close() { runtime?.requestOpen(false) }
    public func toggle() { guard let r = runtime else { return }; r.requestOpen(!r.open) }
    /// Resolves once the current close (both motion stages and focus restoration) has finished, or at once when closed.
    public func whenClosed(_ done: @escaping @MainActor () -> Void) {
        guard let r = runtime, r.open || r.barExpanded else { done(); return }
        r.closedWaiters.append(done)
    }
    public func whenClosed() async { await withCheckedContinuation { c in whenClosed { c.resume() } } }
    public func focusInput() { _ = runtime?.input.focus() }
    public func startVoice() { runtime?.startVoice() }
    public func stopVoice() { runtime?.stopVoice() }
    /// The open state, the current value and whether voice recognition is listening (inspection and examples).
    public var isOpen: Bool { runtime?.open ?? false }
    public var value: String { runtime?.value ?? "" }
    public var isListening: Bool { runtime?.listening ?? false }
}

// MARK: Model

/// md-search's properties with the source defaults.
struct AWCSearchModel: Equatable {
    var variant = "contained", layout = "full-screen", trigger: String? = nil, triggerIcon = "search", triggerFor = ""
    var fullWidth = false, placeholder = "Search", disabled = false, elevation = 0
    var leadingIcon = "search", openLeadingIcon: String? = nil, showClearButton = true, voiceSearch = false
    var escapeCloses = true, dismissOnOutsideClick = true, maxBlockSize = "", inputAriaLabel = "", initialFocus = "auto"
    var announceResults = true, resultsLabel = "{count} results available", noResultsLabel = "No results available"
    var loadingLabel = "Searching", debounce = 0.0, throttle = 0.0, density: Double? = nil, hidden = false
    init(_ p: [String: AWCValue]) {
        func s(_ k: String, _ d: String) -> String { p[k]?.string ?? d }
        func b(_ k: String, _ d: Bool) -> Bool { p[k]?.bool ?? d }
        func n(_ k: String) -> Double? { p[k]?.number ?? (p[k]?.string).flatMap { Double($0.trimmingCharacters(in: .whitespaces)) } }
        variant = s("variant", "contained") == "divided" ? "divided" : "contained"
        layout = s("layout", "full-screen") == "docked" ? "docked" : "full-screen"
        trigger = ["bar", "icon"].contains(p["trigger"]?.string ?? "") ? p["trigger"]!.string : nil
        triggerIcon = s("triggerIcon", "search"); triggerFor = s("triggerFor", "")
        fullWidth = b("fullWidth", false); placeholder = s("placeholder", "Search"); disabled = b("disabled", false)
        elevation = Int(max(0, min(5, (n("elevation") ?? 0).rounded())))
        leadingIcon = s("leadingIcon", "search"); openLeadingIcon = (p["openLeadingIcon"]?.string).flatMap { $0.isEmpty ? nil : $0 }
        showClearButton = b("showClearButton", true); voiceSearch = b("voiceSearch", false)
        escapeCloses = b("escapeCloses", true); dismissOnOutsideClick = b("dismissOnOutsideClick", true)
        maxBlockSize = s("maxBlockSize", ""); inputAriaLabel = s("inputAriaLabel", "")
        initialFocus = ["input", "leading"].contains(s("initialFocus", "auto")) ? s("initialFocus", "auto") : "auto"
        announceResults = b("announceResults", true); resultsLabel = s("resultsLabel", "{count} results available")
        noResultsLabel = s("noResultsLabel", "No results available"); loadingLabel = s("loadingLabel", "Searching")
        debounce = max(0, n("debounce") ?? 0); throttle = max(0, n("throttle") ?? 0)
        density = n("density").flatMap { [0, -1, -2, -3, -4].contains($0) ? $0 : nil }; hidden = b("hidden", false)
    }
    var fullScreen: Bool { layout == "full-screen" }
    /// Explicit `trigger` wins; full-screen opens from the icon button, docked keeps the bar; an external opener owns the
    /// resting affordance (nothing on screen until it opens).
    var effectiveTrigger: String { !triggerFor.isEmpty ? "icon" : trigger ?? (fullScreen ? "icon" : "bar") }
    var usesIconTrigger: Bool { effectiveTrigger == "icon" }
    var openGlyph: String { openLeadingIcon ?? (variant == "contained" ? "chevron_left" : "arrow_back") }
    var effectiveLabel: String { !inputAriaLabel.isEmpty ? inputAriaLabel : !placeholder.isEmpty ? placeholder : "Search" }
}

/// The result rows of the `results` slot (md-list-item, role option / menuitem, data-search-result, li), as the source
/// counts them for the announcement; containers count when they hold no items.
enum AWCSearchResults {
    static func isItem(_ n: AWCNode) -> Bool {
        n.tag == "md-list-item" || ["option", "menuitem"].contains(n.properties["role"]?.string ?? "") || n.properties["dataSearchResult"] != nil
            || n.properties["data-search-result"] != nil || n.tag == "li"
    }
    static func items(_ roots: [AWCNode]) -> [AWCNode] {
        var out: [AWCNode] = []
        func walk(_ n: AWCNode) { if isItem(n) { out.append(n) }; for c in n.children { walk(c) } }
        roots.forEach(walk); return out
    }
    static func count(_ roots: [AWCNode]) -> Int { let n = items(roots).count; return n > 0 ? n : roots.count }
}

/// The full-screen entry's timeline: it runs while the runtime's settle clock does (set with every track change, cleared once
/// every timeline has settled), read here so the entry resumes without a new body of the search.
struct AWCSearchEntryTicker<Content: View>: View {
    let rt: AWCSearchRuntime
    @ViewBuilder let content: () -> Content
    var body: some View {
        TimelineView(.animation(paused: rt.settleUntil == 0 && !rt.listening)) { _ in content() }
    }
}

/// Slotted result rows (fix15): rebuilt only when the slotted nodes or the theme change, not on every motion frame of the
/// panel around them (environment changes still reach the rows directly).
struct AWCSearchResultRows: View, Equatable {
    let nodes: [AWCNode]
    let tokens: [String: String]
    let child: (AWCNode) -> AnyView
    nonisolated static func == (l: Self, r: Self) -> Bool { l.nodes == r.nodes && l.tokens == r.tokens }
    var body: some View { VStack(alignment: .leading, spacing: 0) { ForEach(nodes) { child($0) } } }
}

// MARK: Runtime

@MainActor @Observable final class AWCSearchRuntime {
    var value = ""
    var open = false
    /// Bar expansion and the icon morph: lags `open` on close so the panel fades first.
    var barExpanded = false
    /// Results panel reveal: follows `open` at once on close (full-screen reveals one frame after the overlay commits).
    var panelVisible = false
    var focused = false
    var showFocusRing = false
    var listening = false
    var loadingMounted = false
    var loadingIn = false
    var hoverBar = false
    var hoverLeading = false
    var hoverClear = false
    var hoverVoice = false
    var pressedBar = false
    var pressedLeading = false
    var status = ""
    @ObservationIgnored var started = false
    @ObservationIgnored var valueOnFocus = ""
    @ObservationIgnored var keyboardModality = false
    @ObservationIgnored var lastEmittedSearch: String?
    @ObservationIgnored var pendingSearch: String?
    @ObservationIgnored var debounceTask: DispatchWorkItem?
    @ObservationIgnored var maxWaitTask: DispatchWorkItem?
    @ObservationIgnored var closeRevision = 0
    /// The full-screen open's own frame (ms) until the reveal: the reveal's fades are timed from it.
    @ObservationIgnored var openedAt: Double?
    /// When the state last changed through an open / close or a focus change (ms): the motion it starts is timed from it.
    @ObservationIgnored var changedAt: Double?
    /// Mirrors of the panel / bar tracks for the full-screen view: its modal entry renders an escaped copy of the view whose
    /// @State reads are the snapshot of the body that built it; a reference stays current.
    @ObservationIgnored var fsPanel = AWCCSSTransitionTrack(initial: 0)
    @ObservationIgnored var fsBar = AWCCSSTransitionTrack(initial: 0)
    /// The body's inputs, resolved once per body (fix15): token getters read these instead of merging per access.
    @ObservationIgnored var cModel: AWCSearchModel?
    @ObservationIgnored var cA: AWCSearchAppearance?
    @ObservationIgnored var cParts: AWCSearchPartAppearance?
    /// Result-row key interceptor: one stable closure (an unchanged environment value) relaying to the latest body's handler.
    @ObservationIgnored var windowKey: (String, Bool) -> Bool = { _, _ in false }
    @ObservationIgnored var keyInterceptor: ((String, Bool) -> Bool)?
    /// Motion timelines keep ticking until this time (ms); a scheduled refresh pauses them after it.
    var settleUntil = 0.0
    @ObservationIgnored var settleWork: DispatchWorkItem?
    @ObservationIgnored var closedWaiters: [@MainActor () -> Void] = []
    @ObservationIgnored var morphTask: DispatchWorkItem?
    @ObservationIgnored let input = AWCFieldInputHandle()
    @ObservationIgnored var leadingFocus = AWCButtonFocusHandle()
    @ObservationIgnored var clearFocus = AWCButtonFocusHandle()
    @ObservationIgnored var voiceFocus = AWCButtonFocusHandle()
    @ObservationIgnored var triggerFocus = AWCButtonFocusHandle()
    /// Native views marking the host, the docked panel, the results viewport and the full-screen view: result navigation,
    /// the focus trap and outside presses compare native focus views against their window frames.
    @ObservationIgnored let hostRegion = AWCSearchRegionBox()
    @ObservationIgnored let panelRegion = AWCSearchRegionBox()
    @ObservationIgnored let resultsRegion = AWCSearchRegionBox()
    @ObservationIgnored let overlayRegion = AWCSearchRegionBox()
    /// Focus was in the search when it opened (previousFocus === host): closing returns it to the resting target.
    @ObservationIgnored var focusedAtOpen = false
    /// Set by an outside press: only that close restores focus late (Chrome probe 064: 733 ms); Escape and the other closes restore at once.
    @ObservationIgnored var closedByOutside = false
    @ObservationIgnored var requestOpen: (Bool) -> Void = { _ in }
    @ObservationIgnored var startVoice: () -> Void = {}
    @ObservationIgnored var stopVoice: () -> Void = {}
    @ObservationIgnored var announcedStatus = ""
    /// The trigger button opened the view (its press focused it in Chrome): closing returns focus to it.
    @ObservationIgnored var triggerPressed = false
    /// A press on the input clicks the bar (set every render).
    @ObservationIgnored var inputPressed: () -> Void = {}
    #if canImport(AppKit)
    @ObservationIgnored var monitor: Any?
    @ObservationIgnored var inputMonitor: Any?
    #elseif canImport(UIKit)
    @ObservationIgnored var outsideRecognizer: UIGestureRecognizer?
    @ObservationIgnored var inputRecognizer: UIGestureRecognizer?
    #endif
    #if canImport(Speech)
    @ObservationIgnored var recognizer: AnyObject?
    @ObservationIgnored var recognitionTask: AnyObject?
    @ObservationIgnored var audio: AnyObject?
    #endif
    func cancelTimers() { debounceTask?.cancel(); maxWaitTask?.cancel(); debounceTask = nil; maxWaitTask = nil }
    func settleClosed() { let w = closedWaiters; closedWaiters = []; w.forEach { $0() } }
}

// MARK: Renderer

struct AWCNativeSearch: View {
    let node: AWCNode, theme: AWCTheme
    /// Writes a mutable property back to the node (value, open, loading are two-way in the source).
    let setProp: (String, AWCValue) -> Void
    let emit: (String, AWCValue) -> Void
    let child: (AWCNode) -> AnyView
    @Environment(\.awcSearchAppearance) private var inheritedAppearance
    @Environment(\.awcSearchAppearanceTargets) private var appearanceTargets
    @Environment(\.awcSearchPartAppearance) private var inheritedParts
    @Environment(\.awcSearchPartAppearanceTargets) private var partTargets
    @Environment(\.awcSearchControllers) private var controllers
    @Environment(\.awcNativeDensity) private var inheritedDensity
    @Environment(\.awcNativePointerState) private var pointer
    @Environment(\.accessibilityReduceMotion) private var systemReduced
    @Environment(\.awcSearchReducedMotion) private var reducedOverride
    @Environment(\.layoutDirection) private var direction
    @Environment(\.awcModalSession) private var session
    @Environment(\.self) private var environment
    @State private var rt = AWCSearchRuntime()
    @State private var owner: AWCModalOwner
    @State private var insetTrack = AWCCSSTransitionTrack(initial: 0)      // 0 resting inset → 1 focused inset
    @State private var panelTrack = AWCCSSTransitionTrack(initial: 0)      // docked / full-screen panel reveal
    @State private var barTrack = AWCCSSTransitionTrack(initial: 0)        // full-screen bar reveal
    @State private var iconTrack = AWCCSSTransitionTrack(initial: 0)       // leading glyph morph (open)
    @State private var morphTrack = AWCCSSTransitionTrack(initial: 0)      // trailing clear (0) ↔ loading (1)
    @State private var layerTrack = AWCCSSTransitionTrack(initial: 0)      // bar state layer opacity
    @State private var leadingLayerTrack = AWCCSSTransitionTrack(initial: 0)
    @State private var clearLayerTrack = AWCCSSTransitionTrack(initial: 0)
    @State private var voiceLayerTrack = AWCCSSTransitionTrack(initial: 0)
    @State private var resultsHeight: Double = 0
    @State private var hostWidth: Double = 0
    @State private var primed = false

    init(node: AWCNode, theme: AWCTheme, setProp: @escaping (String, AWCValue) -> Void, emit: @escaping (String, AWCValue) -> Void, child: @escaping (AWCNode) -> AnyView) {
        self.node = node; self.theme = theme; self.setProp = setProp; self.emit = emit; self.child = child
        _owner = State(initialValue: AWCModalOwner(id: node.id + "#search"))
    }

    // MARK: Inputs
    private var freshModel: AWCSearchModel { AWCSearchModel(node.properties) }
    private var freshA: AWCSearchAppearance { inheritedAppearance.merging(appearanceTargets[node.id] ?? .init()) }
    private var freshParts: AWCSearchPartAppearance { inheritedParts.merging(partTargets[node.id] ?? .init()) }
    private var model: AWCSearchModel { rt.cModel ?? freshModel }
    private var a: AWCSearchAppearance { rt.cA ?? freshA }
    private var parts: AWCSearchPartAppearance { rt.cParts ?? freshParts }
    private func resolveInputs() {
        rt.cModel = freshModel; rt.cA = freshA; rt.cParts = freshParts
        rt.windowKey = { k, s in windowKey(k, shift: s) }
        if rt.keyInterceptor == nil { let r = rt; rt.keyInterceptor = { [weak r] k, s in r?.windowKey(k, s) ?? false } }
    }
    private var controller: AWCSearchController? { controllers[node.id] ?? controllers[""] }
    private var leadingNodes: [AWCNode] { node.children(inSlot: "leading") }
    private var trailingNodes: [AWCNode] { node.children(inSlot: "trailing") }
    private var resultNodes: [AWCNode] { node.children(inSlot: "results") }
    private var triggerNodes: [AWCNode] { node.children(inSlot: "trigger") }
    private var loaderNodes: [AWCNode] { node.children(inSlot: "loader") }
    // ax2: the source has no default slot; unslotted children are not rendered.
    private var disabled: Bool { model.disabled }
    private var loading: Bool { node.properties["loading"]?.bool ?? false }
    private var reduced: Bool { reducedOverride ?? systemReduced }
    private var rtl: Bool { direction == .rightToLeft }

    // MARK: Tokens (md-search.css :host)
    private var scale: Double { AWCNativeDensity.resolve(model.density, inherited: inheritedDensity) }
    private func token(_ name: String, _ fallback: String) -> String { awcFieldColor(theme.tokens["--md-sys-color-" + name]) ?? fallback }
    private func alpha(_ hex: String, _ a: Double) -> String {
        let h = hex.hasPrefix("#") ? String(hex.dropFirst()) : hex
        let base = h.count >= 6 ? String(h.prefix(6)) : "000000"
        let original = h.count == 8 ? Double(Int(h.suffix(2), radix: 16) ?? 255) / 255 : 1
        return "#" + base.uppercased() + String(format: "%02X", Int((max(0, min(1, a * original)) * 255).rounded()))
    }
    private var onSurface: String { token("on-surface", "#1D1B20") }
    private var onSurfaceVariant: String { token("on-surface-variant", "#49454F") }
    private var containerColor: String { a.containerColor ?? token("surface-container-high", "#ECE6F0") }
    private var inputColor: String { disabled ? disabledContent : a.inputColor ?? onSurface }
    private var placeholderColor: String { disabled ? disabledContent : a.placeholderColor ?? onSurfaceVariant }
    private var leadingIconColor: String { disabled ? disabledContent : a.leadingIconColor ?? onSurface }
    private var trailingIconColor: String { disabled ? disabledContent : a.trailingIconColor ?? a.iconColor ?? onSurfaceVariant }
    private var loadingColor: String { a.loadingColor ?? token("primary", "#6750A4") }
    private var stateLayerColor: String { a.stateLayerColor ?? onSurface }
    private var focusColor: String { a.focusIndicatorColor ?? token("secondary", "#625B71") }
    private var barFullscreenColor: String { a.barFullscreenColor ?? token("surface-container-low", "#F7F2FA") }
    private var fullscreenResultsColor: String { a.fullscreenResultsColor ?? token("surface-container-low", "#F7F2FA") }
    private var dividerColor: String { a.dividerColor ?? token("outline", "#79747E") }
    private var emptyColor: String { a.emptyColor ?? onSurfaceVariant }
    private var disabledContent: String { alpha(onSurface, 0.38) }
    private var hoverOpacity: Double { a.hoverStateLayerOpacity ?? Double(theme.tokens["--md-sys-state-hover-state-layer-opacity"] ?? "") ?? 0.08 }
    private var pressedOpacity: Double { a.pressedStateLayerOpacity ?? 0.1 }
    private var containerHeight: Double { a.containerHeight ?? max(40, 56 + scale * 4) }
    private var dividedFullscreenBarHeight: Double { a.dividedFullscreenBarHeight ?? max(48, 72 + scale * 4) }
    private var iconButton: Double { a.iconButtonSize ?? max(32, 48 + scale * 4) }
    private var iconSize: Double { a.iconSize ?? max(18, 24 + scale) }
    private var leadingPad: Double { a.leadingPaddingInline ?? 4 }
    private var trailingPad: Double { a.trailingPaddingInline ?? 8 }
    private var leadingGap: Double { a.leadingIconLabelGap ?? 4 }
    private var trailingGap: Double { a.trailingIconLabelGap ?? 4 }
    private var padInline: Double { a.containerPaddingInline ?? 0 }
    private var padInlineFocused: Double { a.containerPaddingInlineFocused ?? padInline }
    private var minInline: Double { a.containerMinInlineSize ?? 360 }
    private var maxInline: Double { a.containerMaxInlineSize ?? 720 }
    /// Full-screen and `full-width` zero both insets (the hooks included), as the source's :host rules do.
    private var zeroInsets: Bool { model.fullScreen || model.fullWidth }
    private var expandInset: Double { zeroInsets ? 0 : a.expandInset ?? 24 }
    private var expandFocusedInset: Double { zeroInsets ? 0 : a.expandFocusedInset ?? 12 }
    private var focusOffset: Double { a.focusIndicatorOffset ?? 2 }
    private var focusThickness: Double { a.focusIndicatorThickness ?? 3 }
    private var defaultPanelOffset: Double { focusOffset + focusThickness + 3 }
    private var panelOffset: Double {
        if model.variant == "divided" { return 0 }                               // divided docked: flush under the bar
        return model.layout == "docked" ? a.containedDockedPanelOffset ?? defaultPanelOffset : a.panelOffset ?? defaultPanelOffset
    }
    private var containerShape: Double { a.containerShape ?? Double(theme.tokens["--md-sys-shape-corner-full"]?.replacingOccurrences(of: "px", with: "") ?? "") ?? 9999 }
    private var restingCorner: Double { min(containerShape, containerHeight / 2) }
    private var dockedPanelShape: Double { a.dockedPanelShape ?? Double(theme.tokens["--md-sys-shape-corner-large"]?.replacingOccurrences(of: "px", with: "") ?? "") ?? 16 }
    private var dividerThickness: Double { a.dividerThickness ?? 1 }
    private var maxBlockSizeProp: Double? {
        let raw = model.maxBlockSize.trimmingCharacters(in: .whitespaces)
        if raw.hasSuffix("px") { return Double(raw.dropLast(2)) }
        if raw.hasSuffix("vh") || raw.hasSuffix("dvh") { let v = Double(raw.replacingOccurrences(of: "dvh", with: "").replacingOccurrences(of: "vh", with: "")); return v.map { $0 / 100 * viewport.height } }
        return Double(raw)
    }
    private var maxBlockSize: Double? { maxBlockSizeProp ?? a.maxBlockSize }
    private var panelMax: Double { maxBlockSize ?? a.panelMaxBlockSize ?? 250 }
    private var panelMin: Double { a.panelMinBlockSize ?? 0 }
    private var fullscreenBarHeight: Double { model.variant == "divided" ? dividedFullscreenBarHeight : containerHeight }
    private var fullscreenOffsetTop: Double { model.variant == "divided" ? 0 : a.fullscreenBarOffsetBlockStart ?? 16 }
    private var fullscreenOffsetInline: Double { model.variant == "divided" ? 0 : a.fullscreenBarOffsetInline ?? 8 }
    private var fullscreenGap: Double { a.fullscreenBarPanelGap ?? (model.variant == "divided" ? 0 : defaultPanelOffset) }
    private var panelPaddingTop: Double { a.panelPaddingBlockStart ?? 0 }
    private var emptyPadBlock: Double { a.emptyPaddingBlock ?? 24 }
    private var emptyPadInline: Double { a.emptyPaddingInline ?? 16 }
    private var inputFont: Double { a.inputFontSize ?? max(13, 16 + scale * 0.5) }
    private var inputLine: Double { a.inputLineHeight ?? 24 }
    private var inputTracking: Double { a.inputLetterSpacing ?? 0.5 }
    private var inputWeight: Double { a.inputFontWeight ?? 400 }
    private var avatarSize: Double { a.avatarSize ?? 40 }
    private var viewport: CGSize { session?.viewport ?? CGSize(width: max(hostWidth, 360), height: 800) }
    private func duration(_ name: String, _ fallback: Double) -> Double { reduced ? 0 : awcCSSDuration(theme.tokens[name]) ?? fallback }
    private func easing(_ name: String, _ fallback: [Double]) -> [Double] { awcCSSCubicBezier(theme.tokens[name]) ?? fallback }
    private var motion: (Double, [Double]) { (reduced ? 0 : a.panelMotionDuration ?? duration("--md-sys-motion-duration-medium2", 250), easing("--md-sys-motion-easing-emphasized", [0.2, 0, 0, 1])) }
    private var expandMotion: (Double, [Double]) { (reduced ? 0 : a.expandDuration ?? duration("--md-sys-motion-duration-medium4", 400), a.expandEasing ?? [0.34, 1.56, 0.64, 1]) }
    private var fullscreenExpand: (Double, [Double]) { (reduced ? 0 : a.fullscreenExpandDuration ?? duration("--md-sys-motion-duration-medium2", 300), a.fullscreenExpandEasing ?? easing("--md-sys-motion-easing-standard", [0.2, 0, 0, 1])) }
    private var fullscreenCollapse: (Double, [Double]) { (reduced ? 0 : a.fullscreenCollapseDuration ?? duration("--md-sys-motion-duration-medium2", 300), a.fullscreenCollapseEasing ?? easing("--md-sys-motion-easing-standard", [0.2, 0, 0, 1])) }
    private var morphMotion: (Double, [Double]) { (duration("--md-sys-motion-duration-medium1", 250), easing("--md-sys-motion-easing-emphasized", [0.2, 0, 0, 1])) }
    private var layerMotion: (Double, [Double]) { (duration("--md-sys-motion-duration-short2", 100), easing("--md-sys-motion-easing-standard", [0.2, 0, 0, 1])) }

    // MARK: Derived state (render helpers of the source)
    private var count: Int { AWCSearchResults.count(resultNodes) }
    private var showBar: Bool { !model.usesIconTrigger || rt.barExpanded }
    private var fullScreenOpen: Bool { model.fullScreen && rt.barExpanded }
    private var showEmptyState: Bool { rt.panelVisible && !loading && count == 0 && !rt.value.trimmingCharacters(in: .whitespaces).isEmpty }
    private var showResultsChrome: Bool {
        guard rt.panelVisible, !loading else { return false }
        return count > 0 || showEmptyState
    }
    private var panelRevealed: Bool { model.fullScreen ? rt.panelVisible && rt.barExpanded : showResultsChrome }
    private var panelContent: Bool { model.fullScreen ? panelRevealed : showResultsChrome }
    private var showClear: Bool { model.showClearButton && !rt.value.isEmpty }
    private var voiceSupported: Bool {
        #if canImport(Speech)
        return true
        #else
        return false
        #endif
    }
    private var showVoice: Bool { model.voiceSearch && voiceSupported }
    private var statusText: String {
        guard model.announceResults, rt.open else { return "" }
        if loading { return model.loadingLabel }
        if count > 0 { return model.resultsLabel.replacingOccurrences(of: "{count}", with: String(count)) }
        if showEmptyState { return "" }
        return rt.value.trimmingCharacters(in: .whitespaces).isEmpty ? "" : model.noResultsLabel
    }

    // MARK: Body
    private var trackKey: String {
        "\(rt.barExpanded)|\(rt.panelVisible)|\(rt.focused)|\(panelRevealed)|\(rt.loadingIn)|\(rt.hoverBar)|\(rt.pressedBar)|\(rt.showFocusRing)|\(rt.hoverLeading)|\(rt.pressedLeading)|\(rt.hoverClear)|\(rt.hoverVoice)|\(disabled)"
    }
    private func running(_ now: Double) -> Bool {
        [insetTrack, panelTrack, barTrack, iconTrack, morphTrack, layerTrack, leadingLayerTrack, clearLayerTrack, voiceLayerTrack].contains { $0.isRunning(now) } || rt.listening
            || now < rt.settleUntil
    }
    var body: some View {
        let _ = resolveInputs()
        if model.hidden { Color.clear.frame(width: 0, height: 0).awcInspectionAbsent() } else {
            let now = CACurrentMediaTime() * 1000
            let _ = { rt.inputPressed = { barClick() } }()
            TimelineView(.animation(paused: !running(now))) { _ in host(CACurrentMediaTime() * 1000) }
                // Slotted content inherits the search's density rung (--md-sys-density-scale cascades into the slots).
                .environment(\.awcNativeDensity, scale)
                .preference(key: AWCModalEntries.self, value: model.fullScreen && rt.barExpanded && session != nil ? [entry()] : [])
                .onAppear { start() }
                .onDisappear { stop() }
                .onChange(of: node.properties["value"]) { _, v in externalValue(v) }
                .onChange(of: node.properties["open"]?.bool ?? false) { _, o in if o != rt.open { applyOpen(o, emitEvents: true) } }
                .onChange(of: loading) { _, l in loadingChanged(l) }
                .onChange(of: trackKey, initial: true) { _, _ in applyTracks() }
                .onChange(of: statusText, initial: true) { _, s in announce(s) }
                .onChange(of: model.dismissOnOutsideClick) { _, _ in installOutside() }
        }
    }

    // MARK: Host (in-flow box)
    @ViewBuilder private func host(_ now: Double) -> some View {
        let fsOpen = fullScreenOpen
        if model.usesIconTrigger && !rt.barExpanded {
            triggerView.frame(width: iconButton, height: iconButton)
                .awcInspect(nodeID: node.id, name: "md-search") { _ in rootMetrics }
        } else if fsOpen {
            // position: fixed — the open full-screen view leaves the flow; it draws in the modal viewport.
            Color.clear.frame(width: 0, height: 0)
                .overlay(alignment: .topLeading) { if session == nil { fallbackOverlay(now) } }
                .awcInspect(nodeID: node.id, name: "md-search") { _ in rootMetrics }
        } else {
            let inset = expandInset + (expandFocusedInset - expandInset) * insetTrack.presented(now)
            ZStack(alignment: .top) {
                // Full-screen: the same bar element returns from the closed view at opacity 0 and fades in (the bar track).
                let resting = model.fullScreen ? barTrack.presented(now) : 1
                bar(now, overlay: false, presented: resting).opacity(resting).padding(.horizontal, max(0, inset))
            }
            .frame(height: containerHeight)
            .frame(minWidth: minInline, maxWidth: maxInline)
            .background { GeometryReader { g in Color.clear.onChange(of: g.size.width, initial: true) { _, w in hostWidth = w } } }
            .background { AWCSearchRegion(box: rt.hostRegion) }
            .overlay(alignment: .topLeading) { if model.layout == "docked" { dockedPanel(now) } }
            .awcInspect(nodeID: node.id, name: "md-search") { _ in rootMetrics }
            .frame(maxWidth: .infinity)
        }
    }
    private var rootMetrics: [String: AWCValue] {
        ["open": .bool(rt.open), "value": .string(rt.value), "focused": .bool(rt.focused), "barExpanded": .bool(rt.barExpanded),
         "panelVisible": .bool(rt.panelVisible), "panelContent": .bool(panelContent), "status": .string(statusText), "count": .number(Double(count)),
         "listening": .bool(rt.listening), "focusRing": .bool(rt.showFocusRing), "loading": .bool(loading), "statusBackground": .string(parts.statusBackgroundColor ?? "")]
    }

    // MARK: Trigger (full-screen closed: a standard 48px icon button)
    @ViewBuilder private var triggerView: some View {
        if !triggerNodes.isEmpty {
            HStack(spacing: 0) { ForEach(triggerNodes) { child($0) } }.awcInspect(nodeID: node.id, part: "trigger", name: "trigger") { _ in ["background": .string(parts.triggerBackgroundColor ?? "")] }
        } else if model.triggerFor.isEmpty {
            AWCSearchIconButton(id: node.id + "-trigger", label: model.effectiveLabel, glyph: model.triggerIcon, box: iconButton, glyphSize: iconSize,
                                color: disabled ? disabledContent : (a.leadingIconColor ?? onSurface), layer: onSurface, layerOpacity: 0, ring: focusColor,
                                ringWidth: focusThickness, disabled: disabled, pressed: nil, handle: rt.triggerFocus,
                                hover: { _ in }, routeKey: { _, _ in false }, action: { if !disabled && !rt.open { rt.triggerPressed = true; requestOpen(true) } })
                .background { if let tb = parts.triggerButtonBackgroundColor { Circle().fill(Color(awcHex: tb)) } }
                .awcInspect(nodeID: node.id, part: "trigger-button", name: "trigger-button") { _ in ["label": .string(model.effectiveLabel), "glyph": .string(model.triggerIcon),
                                                                                                 "background": .string(parts.triggerButtonBackgroundColor ?? "")] }
        }
    }

    // MARK: Bar
    private func barShape(overlay: Bool) -> AWCSearchBarShape {
        if overlay { return .init(top: model.variant == "divided" ? 0 : min(containerShape, fullscreenBarHeight / 2), bottom: model.variant == "divided" ? 0 : min(containerShape, fullscreenBarHeight / 2)) }
        if model.variant == "divided" && model.layout == "docked" && rt.barExpanded && panelContent { return .init(top: restingCorner, bottom: 0) }
        return .init(top: restingCorner, bottom: restingCorner)
    }
    private func elevationLayers() -> [AWCBoxShadow] {
        if let custom = a.containerElevation { return custom }
        guard model.elevation > 0 else { return [] }
        return AWCBoxShadow.source(theme.tokens["--md-sys-elevation-\(model.elevation)"] ?? "none") ?? []
    }
    @ViewBuilder private func bar(_ now: Double, overlay: Bool, presented: Double = 1) -> some View {
        let shape = barShape(overlay: overlay)
        let height = overlay ? fullscreenBarHeight : containerHeight
        let fill = parts.barBackgroundColor ?? (overlay && model.variant == "divided" ? barFullscreenColor : containerColor)
        let layerColor = parts.stateLayerColor ?? stateLayerColor, layerOpacity = parts.stateLayerOpacity ?? (disabled ? 0 : layerTrack.presented(now))
        let ring = rt.showFocusRing && !overlay
        let corners = shape.corners
        HStack(spacing: 0) {
            leading(now)
            input(overlay: overlay).frame(maxWidth: .infinity)
            trailing(now)
        }
        .padding(.horizontal, rt.focused || rt.barExpanded ? padInlineFocused : padInline)
        .frame(height: height)
        .background {
            // Chrome's stacking: the state layer (hover 8 %, press 10 %; hidden while the keyboard focus ring shows and when disabled;
            // a part opacity shows in every state) paints over the bar, under the leading and trailing boxes (z-index 1).
            ZStack {
                shape.path.fill(Color(awcHex: fill))
                shape.path.fill(Color(awcHex: layerColor)).opacity(layerOpacity).allowsHitTesting(false)
            }
        }
        .clipShape(shape.path)
        .awcRipple(disabled: disabled, cornerRadius: shape.top, appearance: AWCRippleAppearance(extendInline: max(0, expandInset - expandFocusedInset),
                   growDuration: expandMotion.0, growEasing: "cubic-bezier(\(expandMotion.1.map { String($0) }.joined(separator: ",")))"))
        .background {
            AWCNativeBoxShadow(corners: corners, layers: elevationLayers() + (ring ? [AWCBoxShadow(spread: focusOffset, color: containerColor),
                                                                                      AWCBoxShadow(spread: focusOffset + focusThickness, color: focusColor)] : []), placement: .outer)
        }
        .opacity(disabled ? 0.38 : 1)
        .contentShape(shape.path)
        .onTapGesture { barClick() }
        .onContinuousHover { phase in if case .active = phase { rt.hoverBar = true } else { rt.hoverBar = false } }
        .simultaneousGesture(DragGesture(minimumDistance: 0).onChanged { _ in if !rt.pressedBar { rt.pressedBar = true } }.onEnded { _ in rt.pressedBar = false })
        .awcInspect(nodeID: node.id, part: overlay ? "bar" : "bar", name: "bar") { _ in
            ["background": .string(fill), "radiusTop": .number(shape.top), "radiusBottom": .number(shape.bottom), "focusRing": .bool(ring),
             "stateLayer": .number(parts.stateLayerOpacity ?? layerTrack.presented(CACurrentMediaTime() * 1000)), "stateLayerColor": .string(layerColor), "opacity": .number(disabled ? 0.38 : 1),
             "elevation": .number(Double(elevationLayers().count)), "barOpacity": .number(presented)]
        }
    }

    // MARK: Leading
    @ViewBuilder private func leading(_ now: Double) -> some View {
        if !leadingNodes.isEmpty {
            HStack(spacing: 4) { ForEach(leadingNodes) { child($0) } }
                .padding(.leading, leadingPad).padding(.trailing, leadingGap)
                .contentShape(Rectangle())
                .onTapGesture { if !disabled { emit("mdLeadingIconClick", .object(["value": .string(rt.value), "open": .bool(rt.open)])) } }
                .background { if let lb = parts.leadingBackgroundColor { Color(awcHex: lb) } }
                .awcInspect(nodeID: node.id, part: "leading", name: "leading") { _ in ["background": .string(parts.leadingBackgroundColor ?? "")] }
        } else {
            let m = iconTrack.presented(now), open = rt.barExpanded
            AWCSearchIconButton(id: node.id + "-leading", label: open ? "Close search" : "Search", glyph: nil, box: iconButton, glyphSize: iconSize,
                                color: leadingIconColor, layer: parts.leadingStateLayerColor ?? leadingIconColor,
                                layerOpacity: parts.leadingStateLayerOpacity ?? (open && !disabled ? leadingLayerTrack.presented(now) : 0),
                                ring: focusColor, ringWidth: focusThickness, disabled: disabled || !open, pressed: nil, handle: rt.leadingFocus,
                                hover: { h in rt.hoverLeading = h }, routeKey: { k, s in windowKey(k, shift: s) }, action: { leadingClick() }) {
                ZStack {
                    AWCFieldGlyph(name: model.leadingIcon, size: iconSize, fill: 0)
                        .opacity(1 - m).rotationEffect(.degrees(-90 * m)).scaleEffect(1 - 0.4 * m)
                    AWCFieldGlyph(name: model.openGlyph, size: iconSize, fill: 0)
                        .scaleEffect(x: rtl ? -1 : 1, y: 1)
                        .opacity(m).rotationEffect(.degrees(90 * (1 - m))).scaleEffect(0.6 + 0.4 * m)
                }
            }
            // Closed, the resting glyph is no target (pointer-events: none): a press falls through to the bar.
            .allowsHitTesting(open && !disabled)
            .awcInspect(nodeID: node.id, part: "leading-button", name: "leading-button") { _ in
                ["label": .string(open ? "Close search" : "Search"), "morph": .number(m), "glyph": .string(m >= 0.5 ? model.openGlyph : model.leadingIcon),
                 "color": .string(leadingIconColor), "focused": .bool(rt.leadingFocus.isFocused), "layer": .string(parts.leadingStateLayerColor ?? leadingIconColor),
                 "layerOpacity": .number(parts.leadingStateLayerOpacity ?? (open && !disabled ? leadingLayerTrack.presented(CACurrentMediaTime() * 1000) : 0))]
            }
            .padding(.leading, leadingPad).padding(.trailing, leadingGap)
            .background { if let lb = parts.leadingBackgroundColor { Color(awcHex: lb) } }
            .awcInspect(nodeID: node.id, part: "leading", name: "leading") { _ in ["background": .string(parts.leadingBackgroundColor ?? "")] }
        }
    }

    // MARK: Input
    private func inputConfig(overlay: Bool) -> AWCFieldInputConfig {
        var c = AWCFieldInputConfig()
        c.text = rt.value; c.fontSize = inputFont; c.lineHeight = inputLine; c.tracking = inputTracking; c.weight = inputWeight
        c.color = parts.inputColor ?? inputColor; c.caret = parts.caretColor ?? parts.inputColor ?? inputColor; c.placeholder = model.placeholder; c.placeholderColor = placeholderColor
        c.rtl = rtl; c.editable = !disabled; c.enabled = !disabled; c.type = "search"; c.autocomplete = "off"; c.spellcheck = false
        c.accessibilityLabel = model.effectiveLabel; c.role = "combobox"; c.expanded = rt.open
        c.navigationKeys = true
        return c
    }
    private func inputEvents() -> AWCFieldInputEvents {
        var e = AWCFieldInputEvents()
        e.edited = { text, caret, composing in edited(text, caret: caret, composing: composing) }
        e.focusChanged = { f in focusChanged(f) }
        e.command = { key, composing in inputKey(key, composing: composing) }
        return e
    }
    @ViewBuilder private func input(overlay: Bool) -> some View {
        AWCFieldTextInput(config: inputConfig(overlay: overlay), events: inputEvents(), handle: overlay ? overlayInput : rt.input)
            .frame(height: inputLine).padding(.vertical, 1)
            .awcInspect(nodeID: node.id, part: "input", name: "input") { _ in
                ["value": .string(rt.value), "placeholder": .string(model.placeholder), "color": .string(parts.inputColor ?? inputColor), "placeholderColor": .string(placeholderColor),
                 "caret": .string(parts.caretColor ?? parts.inputColor ?? inputColor),
                 "fontSize": .number(inputFont), "lineHeight": .number(inputLine), "label": .string(model.effectiveLabel), "expanded": .bool(rt.open),
                 "focused": .bool(rt.focused)]
            }
    }
    @State private var overlayInput = AWCFieldInputHandle()
    private var activeInput: AWCFieldInputHandle { fullScreenOpen ? overlayInput : rt.input }

    // MARK: Trailing
    @ViewBuilder private func trailing(_ now: Double) -> some View {
        let m = morphTrack.presented(now)
        HStack(spacing: 4) {
            if showClear || rt.loadingMounted {
                ZStack {
                    if rt.loadingMounted {
                        Group {
                            if !loaderNodes.isEmpty { HStack(spacing: 0) { ForEach(loaderNodes) { child($0) } } }
                            else {
                                AWCNativeLoadingIndicator(nodeID: node.id + "-loading", properties: ["label": .string(model.loadingLabel)], theme: theme)
                                    .awcLoadingIndicatorAppearance(AWCLoadingIndicatorAppearance(color: loadingColor, size: iconButton, shapeSize: iconSize, containerColor: parts.loadingBackgroundColor))
                                    .environment(\.awcLoadingIndicatorShapeAppearance, AWCLoadingIndicatorShapeAppearance(color: parts.loadingShapeBackgroundColor))
                            }
                        }
                        .background { if let lb = parts.loadingBackgroundColor { Color(awcHex: lb) } }
                        .opacity(m).scaleEffect(0.6 + 0.4 * m).rotationEffect(.degrees(-90 * (1 - m)))
                        .allowsHitTesting(false)
                        .awcInspect(nodeID: node.id, part: "loading", name: "loading") { _ in ["opacity": .number(m), "label": .string(model.loadingLabel), "background": .string(parts.loadingBackgroundColor ?? ""), "shape": .string(parts.loadingShapeBackgroundColor ?? "")] }
                    }
                    if showClear {
                        AWCSearchIconButton(id: node.id + "-clear", label: "Clear search", glyph: "close", box: iconButton, glyphSize: iconSize,
                                            color: trailingIconColor, layer: trailingIconColor, layerOpacity: disabled ? 0 : clearLayerTrack.presented(now),
                                            ring: focusColor, ringWidth: focusThickness, disabled: disabled, pressed: nil, handle: rt.clearFocus,
                                            hover: { h in rt.hoverClear = h }, routeKey: { k, s in windowKey(k, shift: s) }, action: { clearClick() })
                            .background { if let cb = parts.clearButtonBackgroundColor { Circle().fill(Color(awcHex: cb)) } }
                            .opacity(1 - m).scaleEffect(1 - 0.4 * m).rotationEffect(.degrees(90 * m))
                            .allowsHitTesting(!rt.loadingIn)
                            .overlay {
                                // Chrome's box of the clear button is its transformed box (getBoundingClientRect: scale 1 − 0.4·morph).
                                Color.clear.frame(width: iconButton * (1 - 0.4 * m), height: iconButton * (1 - 0.4 * m)).allowsHitTesting(false)
                                    .awcInspect(nodeID: node.id, part: "clear-button", name: "clear-button") { _ in
                                        ["opacity": .number(1 - m), "label": .string("Clear search"), "color": .string(trailingIconColor), "focused": .bool(rt.clearFocus.isFocused),
                                         "background": .string(parts.clearButtonBackgroundColor ?? "")]
                                    }
                            }
                    }
                }
                .frame(width: iconButton, height: iconButton)
            }
            if showVoice {
                AWCSearchIconButton(id: node.id + "-voice", label: rt.listening ? "Stop voice search" : "Search by voice", glyph: "mic", box: iconButton, glyphSize: iconSize,
                                    color: rt.listening ? token("primary", "#6750A4") : trailingIconColor, layer: trailingIconColor,
                                    layerOpacity: disabled ? 0 : voiceLayerTrack.presented(now), ring: focusColor, ringWidth: focusThickness, disabled: disabled,
                                    pressed: rt.listening, handle: rt.voiceFocus, hover: { h in rt.hoverVoice = h }, routeKey: { k, s in windowKey(k, shift: s) },
                                    action: { if !disabled { if rt.listening { stopVoice() } else { startVoice() } } }, pulse: rt.listening && !reduced ? token("primary", "#6750A4") : nil)
                    .background { if let vb = parts.voiceButtonBackgroundColor { Circle().fill(Color(awcHex: vb)) } }
                    .awcInspect(nodeID: node.id, part: "voice-button", name: "voice-button") { _ in ["label": .string(rt.listening ? "Stop voice search" : "Search by voice"), "pressed": .bool(rt.listening),
                                                                                                     "background": .string(parts.voiceButtonBackgroundColor ?? "")] }
            }
            ForEach(trailingNodes) { n in
                child(n)
                    .frame(width: isAvatar(n) ? avatarSize : nil, height: isAvatar(n) ? avatarSize : nil)
                    .contentShape(Rectangle())
                    .onTapGesture { if !disabled { emit("mdTrailingIconClick", .object(["value": .string(rt.value), "open": .bool(rt.open)])) } }
            }
        }
        .padding(.leading, trailingGap).padding(.trailing, trailingPad)
        .background { if let tb = parts.trailingBackgroundColor { Color(awcHex: tb) } }
        .awcInspect(nodeID: node.id, part: "trailing", name: "trailing") { _ in ["background": .string(parts.trailingBackgroundColor ?? "")] }
    }
    private func isAvatar(_ n: AWCNode) -> Bool { n.tag == "md-avatar" || n.tag == "img" || n.properties["role"]?.string == "img" }

    // MARK: Panel
    private var panelBodyHeight: Double {
        if showEmptyState { return emptyHeight }
        return resultsHeight
    }
    private var emptyHeight: Double { 20 + 2 * emptyPadBlock }
    @ViewBuilder private func panelBody(fill: Bool) -> some View {
        VStack(spacing: 0) {
            if model.variant == "divided" && panelRevealed {
                Rectangle().fill(Color(awcHex: parts.dividerColor ?? dividerColor)).frame(height: dividerThickness)
                    .awcInspect(nodeID: node.id, part: "divider", name: "divider") { _ in ["color": .string(parts.dividerColor ?? dividerColor)] }
            }
            if showEmptyState {
                Text(model.noResultsLabel)
                    .font(AWCNativeFonts.label(size: 14, regular: true)).tracking(0.25).lineSpacing(0)
                    .foregroundStyle(Color(awcHex: parts.emptyColor ?? emptyColor))
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: .infinity).frame(height: 20)
                    .padding(.vertical, emptyPadBlock).padding(.horizontal, emptyPadInline)
                    .background { AWCSearchPartFill(color: parts.panelBodyBackgroundColor, nodeID: node.id, part: "panel-body") }
                    #if canImport(AppKit)
                    .accessibilityAddTraits(.updatesFrequently)
                    #else
                    .onAppear { if rt.open { AWCSearchFocus.announce(model.noResultsLabel) } }
                    #endif
                    .awcInspect(nodeID: node.id, part: "empty", name: "empty") { _ in ["text": .string(model.noResultsLabel), "color": .string(parts.emptyColor ?? emptyColor)] }
            } else {
                ScrollView(.vertical) {
                    AWCSearchResultRows(nodes: resultNodes, tokens: theme.tokens, child: child).equatable()
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background { GeometryReader { g in Color.clear.onChange(of: g.size.height, initial: true) { _, h in resultsHeight = h } } }
                    // Slotted lists sit flush on the search surface (transparent list / item containers, no list padding).
                    .awcListAppearance(AWCListAppearance(containerColor: "#00000000", paddingBlock: 0))
                    .awcListItemAppearance(AWCListItemAppearance(containerColor: "#00000000"))
                    .environment(\.awcNativeKeyInterceptor, rt.keyInterceptor)
                }
                .scrollIndicators(.automatic)
                .background { if let vb = parts.resultsViewportBackgroundColor { Color(awcHex: vb) } }
                .background { AWCSearchRegion(box: rt.resultsRegion) }
                .frame(maxHeight: fill ? .infinity : nil)
                .background { AWCSearchPartFill(color: parts.resultsHostBackgroundColor, nodeID: node.id, part: "results-host") }
                .background { AWCSearchPartFill(color: parts.panelBodyBackgroundColor, nodeID: node.id, part: "panel-body") }
                .awcInspect(nodeID: node.id, part: "results-viewport", name: "results-viewport") { _ in ["background": .string(parts.resultsViewportBackgroundColor ?? "")] }
            }
        }
    }
    @ViewBuilder private func dockedPanel(_ now: Double) -> some View {
        let p = panelTrack.presented(now)
        let divider = model.variant == "divided" && panelRevealed ? dividerThickness : 0
        let content = panelBodyHeight + divider
        // CSS: a min-block-size above the max-block-size wins.
        let height = max(panelMin, min(content, panelMax))
        let width = max(0, hostWidth - 2 * expandFocusedInset)
        let corners: AWCSearchBarShape = model.variant == "divided" ? .init(top: 0, bottom: restingCorner) : .init(top: dockedPanelShape, bottom: dockedPanelShape)
        panelBody(fill: false)
            .frame(width: width, height: height, alignment: .top)
            .background { corners.path.fill(Color(awcHex: parts.panelBackgroundColor ?? containerColor)) }
            .clipShape(corners.path)
            .background { AWCSearchRegion(box: rt.panelRegion) }
            // Measured inside the transform, as getBoundingClientRect reports it.
            .awcInspect(nodeID: node.id, part: "panel", name: "panel") { _ in
                ["opacity": .number(p), "background": .string(parts.panelBackgroundColor ?? containerColor), "radiusTop": .number(corners.top), "radiusBottom": .number(corners.bottom),
                 "revealed": .bool(panelRevealed), "translateY": .number(-4 * (1 - p))]
            }
            .opacity(p)
            .offset(x: expandFocusedInset, y: containerHeight + panelOffset - 4 * (1 - p))
            .allowsHitTesting(panelRevealed)
            // ax2: the source's panel is role="dialog" named by the label.
            .accessibilityElement(children: .contain).accessibilityLabel(model.effectiveLabel)
            .accessibilityHidden(!panelRevealed)
    }

    // MARK: Full-screen view (the modal viewport)
    private func entry() -> AWCModalEntry {
        let content = AWCSearchEntryTicker(rt: rt) {
            GeometryReader { g in fullScreenView(CACurrentMediaTime() * 1000, viewport: g.size) }
        }
        // Innermost wins: the search's environment, minus the inert bit, with its density rung.
        .environment(\.awcNativeInert, false)
        .environment(\.awcNativeDensity, scale)
        .environment(\.self, environment)
        return .init(id: owner.id, zIndex: 1300, content: AnyView(content))
    }
    /// Without an AWCModalScope the view still covers the window, drawn from the host's own position.
    @ViewBuilder private func fallbackOverlay(_ now: Double) -> some View {
        GeometryReader { g in
            let origin = g.frame(in: .global).origin
            fullScreenView(now, viewport: AWCSearchWindow.size(fallback: CGSize(width: 1200, height: 900))).offset(x: -origin.x, y: -origin.y)
        }.frame(width: 0, height: 0)
    }
    @ViewBuilder private func fullScreenView(_ now: Double, viewport v: CGSize) -> some View {
        let p = rt.fsPanel.presented(now), b = rt.fsBar.presented(now)
        // Pre-reveal draw (fix18): open and still at 0, draw at a sub-pixel opacity so the first drawing precedes the reveal.
        let warm = rt.open ? 0.004 : 0
        let panelTop = fullscreenOffsetTop + fullscreenBarHeight + fullscreenGap + panelPaddingTop
        let maxH = maxBlockSize ?? v.height
        ZStack(alignment: .topLeading) {
            Color(awcHex: parts.panelBackgroundColor ?? fullscreenResultsColor)
                .overlay(alignment: .top) { panelBody(fill: true).accessibilityElement(children: .contain).accessibilityLabel(model.effectiveLabel).padding(.top, panelTop) }
                .frame(width: v.width, height: min(v.height, maxH))
                .awcInspect(nodeID: node.id, part: "panel", name: "panel") { _ in
                    ["opacity": .number(p), "background": .string(parts.panelBackgroundColor ?? fullscreenResultsColor), "revealed": .bool(panelRevealed), "translateY": .number(30 * (1 - p))]
                }
                .opacity(max(p, warm)).offset(y: 30 * (1 - p))
                .allowsHitTesting(panelRevealed)
            bar(now, overlay: true, presented: b)
                .frame(width: max(0, v.width - 2 * fullscreenOffsetInline))
                .opacity(max(b, warm)).offset(x: fullscreenOffsetInline, y: fullscreenOffsetTop + 30 * (1 - b))
                .allowsHitTesting(panelContent)
        }
        .frame(width: v.width, height: v.height, alignment: .topLeading)
        .background { AWCSearchRegion(box: rt.overlayRegion) }
    }

    // MARK: Lifecycle
    private func start() {
        installInputPress()
        if !rt.started {
            rt.started = true
            rt.value = node.properties["value"]?.string ?? ""
            // A programmatic initial value counts as already searched (the distinct guard's baseline).
            rt.lastEmittedSearch = rt.value.trimmingCharacters(in: .whitespaces)
            rt.loadingMounted = loading; rt.loadingIn = loading; morphTrack.snap(loading ? 1 : 0)
            let o = node.properties["open"]?.bool ?? false
            rt.open = o; rt.barExpanded = o; rt.panelVisible = o
            insetTrack.snap(o ? 1 : 0); iconTrack.snap(o ? 1 : 0); panelTrack.snap(o && panelRevealed ? 1 : 0); barTrack.snap(model.usesIconTrigger && !o ? 0 : 1)
            rt.fsPanel = panelTrack; rt.fsBar = barTrack
            connect()
            if o { openSideEffects() }
        } else { connect() }
    }
    private func connect() {
        controller?.runtime = rt
        let r = rt
        rt.requestOpen = { o in requestOpen(o) }
        rt.startVoice = { startVoice() }; rt.stopVoice = { stopVoice() }
        owner.escape = { [weak r] in
            guard let r, r.open, model.escapeCloses else { return false }
            requestOpen(false); return true
        }
        owner.tab = { backward in trapTab(backward: backward) }
        owner.focusInitial = { focusInitial(attempts: 10) }
        installOutside()
    }
    private func stop() {
        rt.cancelTimers(); stopVoice(); removeOutside(); removeInputPress()
        if session?.index(owner.id) != nil { session?.release(owner.id) }
        rt.settleClosed()
    }
    private func externalValue(_ v: AWCValue?) {
        let s = v?.string ?? ""
        if s != rt.value { rt.value = s }
    }

    // MARK: Open / close (@Watch('open'))
    private func requestOpen(_ o: Bool) {
        guard o != rt.open else { return }
        setProp("open", .bool(o))
        applyOpen(o, emitEvents: true)
    }
    private func applyOpen(_ o: Bool, emitEvents: Bool) {
        guard o != rt.open else { return }
        if rt.changedAt == nil { rt.changedAt = AWCSearchFocus.eventTime() ?? CACurrentMediaTime() * 1000 }
        let changedAt = rt.changedAt ?? CACurrentMediaTime() * 1000
        rt.open = o
        rt.closeRevision += 1
        let revision = rt.closeRevision
        if o {
            rt.barExpanded = true
            if model.fullScreen {
                // The overlay commits first; its surface reveals two frames later (componentDidRender → rAF → the next render).
                DispatchQueue.main.asyncAfter(deadline: .now() + max(0, 0.033 - (CACurrentMediaTime() * 1000 - changedAt) / 1000)) { if rt.open && revision == rt.closeRevision { rt.panelVisible = true } }
            } else { rt.panelVisible = true }
            openSideEffects()
            if emitEvents { emit("mdOpen", .null) }
        } else {
            // The full-screen view's input is the source's same input element: focus inside it stays in the search.
            let carry = model.fullScreen && (rt.focused || rt.leadingFocus.isFocused || rt.clearFocus.isFocused || rt.voiceFocus.isFocused)
            rt.panelVisible = false
            stopVoice()
            removeOutside()
            if emitEvents { emit("mdClose", .null) }
            // Panel motion first, then the bar contracts; the completion waits for both stages.
            let first = model.fullScreen ? fullscreenCollapse.0 : motion.0
            // Each stage is the source's finishShellMotion: two frames, then the shell's transitions (none under reduced motion:
            // the bar leaves the open state three frames after the close, the completion two frames later).
            let stage1 = changedAt + max(first + 17, 50)
            DispatchQueue.main.asyncAfter(deadline: .now() + max(0, stage1 - CACurrentMediaTime() * 1000) / 1000) {
                guard revision == rt.closeRevision, !rt.open else { return }
                if rt.changedAt == nil { rt.changedAt = min(stage1, CACurrentMediaTime() * 1000) }
                rt.barExpanded = false
                if carry && !model.usesIconTrigger { restore({ rt.input.focus() }, attempts: 8) }
                let second = model.fullScreen ? fullscreenCollapse.0 : max(expandMotion.0, motion.0)
                let stage2 = stage1 + max(second + 17, 33)
                DispatchQueue.main.asyncAfter(deadline: .now() + max(0, stage2 - CACurrentMediaTime() * 1000) / 1000) {
                    guard revision == rt.closeRevision, !rt.open else { return }
                    finishClose()
                }
            }
        }
    }
    private func openSideEffects() {
        rt.focusedAtOpen = rt.triggerPressed || rt.focused || rt.triggerFocus.isFocused || rt.leadingFocus.isFocused || rt.clearFocus.isFocused || AWCSearchFocus.firstResponderInside(rt.hostRegion.view)
        rt.triggerPressed = false
        installOutside()
        if model.fullScreen, let session {
            if session.index(owner.id) == nil { session.acquire(owner) }   // focusInitial runs from the session
        } else {
            DispatchQueue.main.async { if rt.open { focusInitial(attempts: 10) } }
        }
    }
    private func focusInitial(attempts: Int) {
        guard rt.open else { return }
        let ok: Bool
        if model.initialFocus == "leading", leadingNodes.isEmpty, let request = rt.leadingFocus.requestFocus { ok = request() || activeInput.focus() }
        else { ok = activeInput.focus() }
        if !ok && attempts > 0 { DispatchQueue.main.asyncAfter(deadline: .now() + 0.016) { focusInitial(attempts: attempts - 1) } }
    }
    private func finishClose() {
        if model.fullScreen, let session, session.index(owner.id) != nil { session.release(owner.id) }
        // Do not steal focus from another surface: only when focus is nowhere or still in the search.
        let iconTrigger = model.usesIconTrigger && model.triggerFor.isEmpty
        let target: () -> Bool = iconTrigger ? { rt.triggerFocus.requestFocus?() ?? false } : { rt.input.focus() }
        // Icon trigger (Chrome): focus stays on the view's control while the view closes and falls to the window when it leaves;
        // only an instant (reduced-motion) close returns it to the trigger.
        let instant = (model.fullScreen ? fullscreenCollapse.0 : motion.0) <= 0
        // Chrome (oracle probe, mdClose to focusin): 733 ms with motion, 67 ms reduced; the native finish runs ~50 ms earlier, so the restore waits the difference.
        let restoreRevision = rt.closeRevision, restoreDelay = (instant || !rt.closedByOutside) ? 0.0 : 0.05
        if rt.focusedAtOpen && (!iconTrigger || instant) {
            DispatchQueue.main.asyncAfter(deadline: .now() + restoreDelay) {
                guard restoreRevision == rt.closeRevision, !rt.open, AWCSearchFocus.focusIsFree(within: [rt.hostRegion.view, rt.overlayRegion.view]) else { return }
                restore(target, attempts: 8)
            }
        }
        rt.closedByOutside = false
        rt.settleClosed()
    }
    private func restore(_ target: @escaping () -> Bool, attempts: Int) {
        if target() || attempts <= 0 { return }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.016) { restore(target, attempts: attempts - 1) }
    }

    // MARK: Tracks
    private func applyTracks() {
        let now = CACurrentMediaTime() * 1000
        let snap = !primed
        // Transitions start at the state change (as CSS ones start at the style change), not at the first render after it:
        // opening lays the results out first, and that render can take a few frames.
        let changed0 = rt.changedAt.flatMap { now - $0 <= 250 ? min(now, $0) : nil } ?? now; rt.changedAt = nil
        // Close tracks only: Chrome's close fade starts the frame after the click; the open was never ahead.
        let changed = (model.fullScreen && !rt.open) ? min(now, changed0 + AWCSearchClockLead.ms) : changed0
        func set(_ track: inout AWCCSSTransitionTrack, _ v: Double, _ m: (Double, [Double]), at: Double? = nil) { if snap { track.snap(v) } else { track.set(v, now: at ?? changed, duration: m.0, curve: m.1) } }
        set(&insetTrack, rt.focused || rt.barExpanded ? 1 : 0, expandMotion)
        set(&iconTrack, rt.barExpanded ? 1 : 0, motion)
        set(&morphTrack, rt.loadingIn ? 1 : 0, morphMotion)
        let reveal = panelRevealed ? 1.0 : 0.0
        if model.fullScreen {
            // The open's frame starts the bar's fade-out; the reveal lands two frames later and its fades start then at the latest
            // (a late reveal — a long first render of the view — is timed from where Chrome's would be).
            if rt.open && rt.barExpanded && !panelRevealed && rt.openedAt == nil { rt.openedAt = changed }
            if !rt.barExpanded { rt.openedAt = nil }
            let revealAt = panelRevealed ? rt.openedAt.map { min(now, $0 + 33.3) } : nil
            set(&panelTrack, reveal, reveal > 0 ? fullscreenExpand : fullscreenCollapse, at: revealAt)
            // The same bar element: visible at rest; `--open` without panel content fades it out (collapse), the panel content
            // fades it back in (expand), so the bar dips as in Chrome. Icon trigger: no bar until the view opens.
            if model.usesIconTrigger && !rt.barExpanded { barTrack.snap(0) } else {
                let shown = (!rt.barExpanded && !model.usesIconTrigger) || panelContent
                set(&barTrack, shown ? 1 : 0, shown ? fullscreenExpand : fullscreenCollapse, at: shown ? revealAt : nil)
            }
            if panelRevealed { rt.openedAt = nil }
        }
        // Docked: the panel's open class arrives with the render after the open, one frame after the bar's inset starts.
        else { set(&panelTrack, reveal, motion, at: reveal > 0 ? min(now, changed + 16.7) : nil) }
        let layer = rt.showFocusRing ? 0 : rt.pressedBar ? pressedOpacity : rt.hoverBar ? hoverOpacity : 0
        set(&layerTrack, layer, layerMotion)
        set(&leadingLayerTrack, rt.pressedLeading ? Double(theme.tokens["--md-sys-state-pressed-state-layer-opacity"] ?? "") ?? 0.12 : rt.hoverLeading ? hoverOpacity : 0, layerMotion)
        set(&clearLayerTrack, rt.hoverClear ? 0.08 : 0, layerMotion)
        set(&voiceLayerTrack, rt.hoverVoice ? 0.08 : 0, layerMotion)
        primed = true
        rt.fsPanel = panelTrack; rt.fsBar = barTrack
        rt.settleUntil = now + 250
        scheduleSettle()
    }
    /// Keeps the timelines ticking a moment past the last change, then lets them pause: a paused timeline left the full-screen
    /// entry's inspection on its first frame (the scope's preferences refresh only on a frame where its content changes too).
    private func scheduleSettle() {
        rt.settleWork?.cancel()
        let work = DispatchWorkItem { if running(CACurrentMediaTime() * 1000) { scheduleSettle() } else if rt.settleUntil != 0 { rt.settleUntil = 0 } }
        rt.settleWork = work
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.12, execute: work)
    }
    private func loadingChanged(_ l: Bool) {
        rt.morphTask?.cancel(); rt.morphTask = nil
        if l {
            rt.loadingMounted = true
            DispatchQueue.main.async { if loading { rt.loadingIn = true } }       // commit the visible state next frame
        } else {
            rt.loadingIn = false
            let task = DispatchWorkItem { if !loading { rt.loadingMounted = false } }
            rt.morphTask = task
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.3, execute: task)   // MORPH_MS
        }
    }
    private func announce(_ status: String) {
        guard status != rt.announcedStatus else { return }
        rt.announcedStatus = status
        guard !status.isEmpty else { return }
        AWCSearchFocus.announce(status)
    }

    // MARK: Value pipeline (handleInput / scheduleSearch / flushSearch)
    private func edited(_ text: String, caret: Int, composing: Bool) -> (String, Int)? {
        let previous = rt.value
        if disabled { return (previous, (previous as NSString).length) }
        // Closed, Space activates the field (opens the view) instead of typing a space (keydown default prevented).
        if !rt.open && !composing && (text as NSString).length == (previous as NSString).length + 1 && caret > 0
            && (text as NSString).substring(with: NSRange(location: caret - 1, length: 1)) == " "
            && (text as NSString).replacingCharacters(in: NSRange(location: caret - 1, length: 1), with: "") == previous {
            requestOpen(true)
            return (previous, caret - 1)
        }
        guard text != previous else { return nil }
        rt.value = text
        setProp("value", .string(text))
        // Typing activates the view (focus alone does not).
        if !rt.open { requestOpen(true) }
        emit("mdInput", .object(["value": .string(text)]))
        scheduleSearch(text)
        return nil
    }
    private func scheduleSearch(_ value: String) {
        rt.pendingSearch = value
        let debounce = model.debounce, throttle = model.throttle
        if debounce == 0 && throttle == 0 { flushSearch(); return }
        rt.debounceTask?.cancel()
        let d = DispatchWorkItem { flushSearch() }
        rt.debounceTask = d
        DispatchQueue.main.asyncAfter(deadline: .now() + debounce / 1000, execute: d)
        if throttle > 0 && rt.maxWaitTask == nil {
            let t = DispatchWorkItem { flushSearch() }
            rt.maxWaitTask = t
            DispatchQueue.main.asyncAfter(deadline: .now() + throttle / 1000, execute: t)
        }
    }
    private func flushSearch() {
        rt.cancelTimers()
        guard let value = rt.pendingSearch else { return }
        rt.pendingSearch = nil
        let normalized = value.trimmingCharacters(in: .whitespacesAndNewlines)
        if normalized == rt.lastEmittedSearch { return }        // distinctUntilChanged
        rt.lastEmittedSearch = normalized
        emit("mdSearch", .object(["value": .string(normalized)]))
    }
    private func focusChanged(_ f: Bool) {
        if f != rt.focused, rt.changedAt == nil { rt.changedAt = AWCSearchFocus.eventTime() ?? CACurrentMediaTime() * 1000 }
        if f {
            rt.focused = true
            rt.showFocusRing = AWCSearchFocus.keyboardModality(fallback: rt.keyboardModality)
            rt.valueOnFocus = rt.value
        } else {
            rt.focused = false; rt.showFocusRing = false
            if rt.value != rt.valueOnFocus { emit("mdChange", .object(["value": .string(rt.value)])) }
        }
    }

    // MARK: Keys
    private func inputKey(_ key: String, composing: Bool) -> Bool {
        // The Enter (or Space) that commits an IME composition belongs to the IME.
        if composing || disabled { return false }
        if !rt.open {
            if key == "Enter" { requestOpen(true); return true }
            return false
        }
        switch key {
        case "Enter":
            rt.pendingSearch = rt.value; flushSearch()
            emit("mdSubmit", .object(["value": .string(rt.value)]))
            return true
        case "Escape", "ArrowDown", "ArrowUp", "Tab": return windowKey(key, shift: false)
        case "Shift+Tab": return windowKey("Tab", shift: true)
        default: return false
        }
    }
    /// The source's window keydown listener while open: Escape, result navigation, the full-screen Tab trap.
    private func windowKey(_ key: String, shift: Bool) -> Bool {
        guard rt.open else { return false }
        rt.keyboardModality = true
        switch key {
        case "Escape": if model.escapeCloses { requestOpen(false); return true }; return false
        case "ArrowDown", "ArrowUp": return moveResultFocus(key == "ArrowDown" ? 1 : -1)
        case "Tab": return model.fullScreen && fullScreenOpen ? trapTab(backward: shift) : false
        default: return false
        }
    }
    private func moveResultFocus(_ delta: Int) -> Bool {
        let items = AWCSearchFocus.views(in: rt.resultsRegion.view, sequential: false)
        guard !items.isEmpty else { return false }
        let current = AWCSearchFocus.currentIndex(in: items)
        if delta > 0 { AWCSearchFocus.focus(items[current < 0 ? 0 : min(current + 1, items.count - 1)]); return true }
        if current <= 0 { _ = activeInput.focus(); return true }
        AWCSearchFocus.focus(items[current - 1]); return true
    }
    private func trapTab(backward: Bool) -> Bool {
        let views = AWCSearchFocus.views(in: rt.overlayRegion.view, sequential: true)
        guard !views.isEmpty else { return true }
        let current = AWCSearchFocus.currentIndex(in: views)
        let next = current < 0 ? (backward ? views.count - 1 : 0) : (current + (backward ? -1 : 1) + views.count) % views.count
        AWCSearchFocus.focus(views[next])
        return true
    }

    // MARK: Pointer
    private func barClick() {
        guard !disabled else { return }
        rt.keyboardModality = false
        if !rt.open { requestOpen(true) }
        _ = activeInput.focus()
    }
    private func leadingClick() {
        guard !disabled, rt.open else { return }
        emit("mdLeadingIconClick", .object(["value": .string(rt.value), "open": .bool(rt.open)]))
        requestOpen(false)
    }
    private func clearClick() {
        guard !disabled else { return }
        // Chrome: the press moves focus to the clear button first, so the input's blur reports its pending change.
        if rt.focused && rt.value != rt.valueOnFocus { emit("mdChange", .object(["value": .string(rt.value)])) }
        rt.value = ""; setProp("value", .string(""))
        _ = activeInput.focus()
        rt.valueOnFocus = ""
        emit("mdInput", .object(["value": .string("")]))
        // Clearing drops results at once: flush past any pending debounce.
        rt.pendingSearch = ""; flushSearch()
        emit("mdClear", .null)
    }
    private func installOutside() {
        removeOutside()
        guard rt.open, model.dismissOnOutsideClick else { return }
        let r = rt
        AWCSearchFocus.installOutsidePress(r) { [weak r] in
            guard let r, r.open else { return }
            r.closedByOutside = true
            if AWCSearchFocus.firstResponderInside(r.hostRegion.view) || AWCSearchFocus.firstResponderInside(r.panelRegion.view) { AWCSearchFocus.blur(r.hostRegion.view) }
            requestOpen(false)
        }
    }
    private func removeOutside() { AWCSearchFocus.removeOutsidePress(rt) }
    /// A press on the search's input is a click on the bar (Chrome: the click bubbles from the input to the bar). AppKit's text
    /// field takes the mouse itself, so the bar's tap gesture never sees it: a local mouse-down monitor while mounted.
    private func installInputPress() {
        #if canImport(AppKit)
        guard rt.inputMonitor == nil else { return }
        let r = rt
        rt.inputMonitor = NSEvent.addLocalMonitorForEvents(matching: .leftMouseDown) { [weak r] e in
            guard let r, let window = e.window, let content = window.contentView else { return e }
            let p = content.superview.map { $0.convert(e.locationInWindow, from: nil) } ?? e.locationInWindow
            guard let hit = content.hitTest(p), hit is NSTextField || hit is NSTextView else { return e }
            let f = hit.convert(hit.bounds, to: nil), c = CGPoint(x: f.midX, y: f.midY)
            let regions = [r.hostRegion.view, r.overlayRegion.view].compactMap { $0 }.filter { $0.window === window }
            if regions.contains(where: { $0.convert($0.bounds, to: nil).contains(c) }) { DispatchQueue.main.async { r.inputPressed() } }
            return e
        }
        #elseif canImport(UIKit)
        installInputTap(attempts: 10)
        #endif
    }
    #if canImport(UIKit)
    private func installInputTap(attempts: Int) {
        guard rt.inputRecognizer == nil else { return }
        guard let window = rt.hostRegion.view?.window else {
            if attempts > 0 { DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) { installInputTap(attempts: attempts - 1) } }
            return
        }
        let r = rt, g = AWCSearchOutsidePress(target: nil, action: nil)
        g.cancelsTouchesInView = false; g.delaysTouchesBegan = false; g.delaysTouchesEnded = false
        g.onPress = { [weak r] p in
            guard let r, let w = r.hostRegion.view?.window, let hit = w.hitTest(p, with: nil), hit is UITextField || hit is UITextView else { return }
            if [r.hostRegion.view, r.overlayRegion.view].compactMap({ $0 }).contains(where: { AWCSearchFocus.frame($0).contains(p) }) { DispatchQueue.main.async { r.inputPressed() } }
        }
        window.addGestureRecognizer(g); rt.inputRecognizer = g
    }
    #endif
    private func removeInputPress() {
        #if canImport(AppKit)
        if let m = rt.inputMonitor { NSEvent.removeMonitor(m); rt.inputMonitor = nil }
        #elseif canImport(UIKit)
        if let g = rt.inputRecognizer { g.view?.removeGestureRecognizer(g); rt.inputRecognizer = nil }
        #endif
    }

    // MARK: Voice (SFSpeechRecognizer; the source streams the transcript into the input)
    private func startVoice() {
        guard showVoice, !disabled, !rt.listening else { return }
        if !rt.open { requestOpen(true) }
        _ = activeInput.focus()
        #if canImport(Speech)
        guard Bundle.main.object(forInfoDictionaryKey: "NSSpeechRecognitionUsageDescription") != nil,
              Bundle.main.object(forInfoDictionaryKey: "NSMicrophoneUsageDescription") != nil else { return }   // onerror → onend
        let session = AWCFieldSpeechSession(locale: node.properties["lang"]?.string ?? "")
        rt.recognizer = session; rt.listening = true
        session.start(result: { text, final in voiceResult(text, final: final) }, end: { finalText in
            if rt.listening { voiceResult(finalText, final: true) }
            rt.listening = false; rt.recognizer = nil
        })
        #endif
    }
    private func voiceResult(_ raw: String, final: Bool) {
        let transcript = String(raw.drop(while: { $0.isWhitespace }))
        rt.value = transcript; setProp("value", .string(transcript))
        if !rt.open { requestOpen(true) }
        emit("mdInput", .object(["value": .string(transcript)]))
        scheduleSearch(transcript)
        emit("mdVoice", .object(["value": .string(transcript), "final": .bool(final)]))
        if final { rt.pendingSearch = transcript; flushSearch(); stopVoice() }
    }
    private func stopVoice() {
        rt.listening = false
        #if canImport(Speech)
        (rt.recognizer as? AWCFieldSpeechSession)?.stop(); rt.recognizer = nil
        #endif
    }
}

// MARK: Pieces

/// The bar / panel corner shape: equal top corners and equal bottom corners (the divided docked card splits them).
struct AWCSearchBarShape {
    let top: Double, bottom: Double
    var path: AnyShape { AnyShape(UnevenRoundedRectangle(topLeadingRadius: top, bottomLeadingRadius: bottom, bottomTrailingRadius: bottom, topTrailingRadius: top, style: .circular)) }
    var corners: AWCCornerShape {
        func r(_ v: Double) -> AWCCornerRadius { AWCCornerRadius(x: .points(v), y: .points(v)) }
        return AWCCornerShape(topLeft: r(top), topRight: r(top), bottomRight: r(bottom), bottomLeft: r(bottom))
    }
}

/// A press-aware plain button style: the press takes pointer focus first (a mouse press focuses a <button> in Chrome).
/// parts2: a part's background box (clear when the part has no typed colour).
struct AWCSearchPartFill: View {
    let color: String?, nodeID: String, part: String
    var body: some View {
        Group { if let color { Color(awcHex: color) } else { Color.clear } }
            .awcInspect(nodeID: nodeID, part: part, name: part) { _ in let v: [String: AWCValue] = ["background": .string(color ?? "")]; return v }
    }
}
/// Order of one press: the press focus (the button becomes first responder, as Chrome's mousedown does) must come before the action
/// (click), whose focus move is the last word. SwiftUI delivers `isPressed` after the action on iOS 18.6: then the press is consumed.
final class AWCSearchPressOrder { var acted = false }
struct AWCSearchPressStyle: ButtonStyle {
    let onPress: () -> Void
    var order: AWCSearchPressOrder? = nil
    func makeBody(configuration: Configuration) -> some View {
        configuration.label.onChange(of: configuration.isPressed) { _, pressed in
            if pressed { if order?.acted == true { order?.acted = false } else { onPress() } } else { order?.acted = false }
        }
    }
}

/// md-search's icon buttons (leading back, clear, voice, icon trigger): a `--md-search-icon-button-size` circle with an 8 %
/// hover layer, a native focus view (keys, Tab order, accessibility) and the inset focus-visible outline.
struct AWCSearchIconButton<Content: View>: View {
    let id: String, label: String, glyph: String?, box: Double, glyphSize: Double
    let color: String, layer: String, layerOpacity: Double, ring: String, ringWidth: Double, disabled: Bool, pressed: Bool?
    let handle: AWCButtonFocusHandle
    let hover: (Bool) -> Void
    let routeKey: (String, Bool) -> Bool
    let action: () -> Void
    var pulse: String? = nil
    @ViewBuilder var content: () -> Content
    @State private var pressOrder = AWCSearchPressOrder()
    var body: some View {
        Button(action: { if !disabled { pressOrder.acted = true; action() } }) {
            ZStack {
                Circle().fill(Color(awcHex: layer)).opacity(layerOpacity)
                if let pulse { AWCSearchPulse(color: pulse) }
                if let glyph { AWCFieldGlyph(name: glyph, size: glyphSize, fill: 0) } else { content() }
            }
            .foregroundStyle(Color(awcHex: color))
            .frame(width: box, height: box)
            .overlay { if handle.isFocusVisible && !disabled { Circle().strokeBorder(Color(awcHex: ring), lineWidth: ringWidth) } }
            .contentShape(Circle())
        }
        .buttonStyle(AWCSearchPressStyle(onPress: { if !disabled { _ = handle.requestPointerFocus?() } }, order: pressOrder))
        .focusable(false)
        .disabled(disabled)
        .modifier(AWCSearchIconButtonHide())   // ax3: iOS only
        .onContinuousHover { phase in if case .active = phase { hover(!disabled) } else { hover(false) } }
        .awcFocusBridgeLayer {
            AWCNativeButtonFocusBridge(configuration: .init(id: id, label: label,
                policy: AWCButtonAccessibilityPolicy(properties: ["disabled": .bool(disabled), "toggle": .bool(pressed != nil), "selected": .bool(pressed == true), "aria-hidden": .bool(AWCSearchIconButtonLabel.bridgeHidden)]  /* ax4 */),
                group: nil, cell: nil, handle: handle, focusChanged: { _ in }, activate: { if !disabled { action() } },
                routeKey: { key, shift, other in other ? false : routeKey(key, shift) }))
        }
        .modifier(AWCSearchIconButtonLabel(label: label))   // ax3: macOS only
    }
}
/// ax3: iOS hides the SwiftUI Button (the bridge is the element); macOS labels it after the bridge as AWCDialogCloseButton does,
/// so AppKit reports one named AXButton instead of an empty one beside the bridge's.
struct AWCSearchIconButtonHide: ViewModifier {
    func body(content: Content) -> some View {
        #if os(macOS)
        content
        #else
        content.accessibilityHidden(true)
        #endif
    }
}
struct AWCSearchIconButtonLabel: ViewModifier {
    let label: String
    /// ax4: on macOS the labelled SwiftUI Button is the accessibility element; the bridge stays only the key view.
    #if os(macOS)
    static var bridgeHidden: Bool { true }
    #else
    static var bridgeHidden: Bool { false }
    #endif
    func body(content: Content) -> some View {
        #if os(macOS)
        content.accessibilityLabel(label)
        #else
        content
        #endif
    }
}
extension AWCSearchIconButton where Content == EmptyView {
    init(id: String, label: String, glyph: String?, box: Double, glyphSize: Double, color: String, layer: String, layerOpacity: Double, ring: String,
         ringWidth: Double, disabled: Bool, pressed: Bool?, handle: AWCButtonFocusHandle, hover: @escaping (Bool) -> Void,
         routeKey: @escaping (String, Bool) -> Bool, action: @escaping () -> Void, pulse: String? = nil) {
        self.init(id: id, label: label, glyph: glyph, box: box, glyphSize: glyphSize, color: color, layer: layer, layerOpacity: layerOpacity, ring: ring,
                  ringWidth: ringWidth, disabled: disabled, pressed: pressed, handle: handle, hover: hover, routeKey: routeKey, action: action, pulse: pulse) { EmptyView() }
    }
}

/// The listening mic's pulse (md-search-voice-pulse: 1.4 s, scale .82 ↔ 1.12, opacity .55 ↔ .2, standard easing).
struct AWCSearchPulse: View {
    let color: String
    @State private var start = Date()
    var body: some View {
        TimelineView(.animation) { context in
            let t = max(0, context.date.timeIntervalSince(start)).truncatingRemainder(dividingBy: 1.4) / 1.4
            let half = t < 0.5 ? t * 2 : (1 - t) * 2
            let e = AWCSearchPulse.ease(half)
            Circle().fill(Color(awcHex: color).opacity(0.16)).scaleEffect(0.82 + 0.30 * e).opacity(0.55 - 0.35 * e)
        }
    }
    static func ease(_ x: Double) -> Double {
        // cubic-bezier(0.2, 0, 0, 1)
        var lo = 0.0, hi = 1.0
        for _ in 0..<24 { let m = (lo + hi) / 2; let bx = 3 * (1 - m) * (1 - m) * m * 0.2 + m * m * m; if bx < x { lo = m } else { hi = m } }
        let m = (lo + hi) / 2
        return 3 * (1 - m) * m * m * 1 + m * m * m
    }
}

/// Holds the native view of an `AWCSearchRegion`.
final class AWCSearchRegionBox {
    #if canImport(AppKit)
    weak var view: NSView?
    #else
    weak var view: UIView?
    #endif
}

#if canImport(AppKit)
final class AWCSearchRegionView: NSView { override func hitTest(_ point: NSPoint) -> NSView? { nil } }
struct AWCSearchRegion: NSViewRepresentable {
    let box: AWCSearchRegionBox
    func makeNSView(context: Context) -> AWCSearchRegionView { let v = AWCSearchRegionView(); v.setAccessibilityElement(false); box.view = v; return v }
    func updateNSView(_ view: AWCSearchRegionView, context: Context) { box.view = view }
}

enum AWCSearchWindow {
    static func size(fallback: CGSize) -> CGSize { NSApp.keyWindow?.contentView?.bounds.size ?? fallback }
}

/// AppKit focus helpers: native focus views (and the text field) inside a region, in key-view-loop order.
@MainActor enum AWCSearchFocus {
    static func frame(_ v: NSView) -> CGRect { v.convert(v.bounds, to: nil) }
    /// The time (ms, the CACurrentMediaTime clock) of the input event being handled, when it is at most 250 ms old: the motion a
    /// click or key starts is timed from the event, as Chrome's transitions start in the frame that handled it.
    static func eventTime() -> Double? {
        guard let e = NSApp.currentEvent else { return nil }
        let t = e.timestamp * 1000, age = CACurrentMediaTime() * 1000 - t
        return age >= 0 && age <= 250 ? t : nil
    }
    static func current(_ window: NSWindow?) -> NSView? {
        guard let r = window?.firstResponder else { return nil }
        if let tv = r as? NSTextView, tv.isFieldEditor, let f = tv.delegate as? NSView { return f }
        return r as? NSView
    }
    static func views(in region: NSView?, sequential: Bool) -> [NSView] {
        guard let region, let window = region.window, let root = window.contentView else { return [] }
        let area = frame(region).insetBy(dx: -0.5, dy: -0.5)
        var found: [(NSView, CGRect)] = []
        func walk(_ v: NSView) {
            if v.isHidden || v.alphaValue == 0 { return }
            var ok = false
            if let b = v as? AWCNativeButtonFocusView { ok = sequential ? b.canBecomeKeyView : b.acceptsFirstResponder }
            else if let t = v as? NSTextField { ok = t.isEditable && t.isEnabled }
            if ok { let f = frame(v); if area.contains(CGPoint(x: f.midX, y: f.midY)) { found.append((v, f)) } }
            for c in v.subviews { walk(c) }
        }
        walk(root)
        let rtl = region.userInterfaceLayoutDirection == .rightToLeft
        // Rows top to bottom (AppKit y grows upward), leading to trailing within a row.
        return found.sorted { a, b in
            if abs(a.1.midY - b.1.midY) > min(a.1.height, b.1.height) / 2 { return a.1.midY > b.1.midY }
            return rtl ? a.1.midX > b.1.midX : a.1.midX < b.1.midX
        }.map(\.0)
    }
    static func currentIndex(in views: [NSView]) -> Int {
        guard let cur = current(views.first?.window) else { return -1 }
        return views.firstIndex { $0 === cur } ?? -1
    }
    static func focus(_ v: NSView) {
        if let b = v as? AWCNativeButtonFocusView { _ = b.requestNativeFocus(showIndicator: true) } else { _ = v.window?.makeFirstResponder(v) }
    }
    static func firstResponderInside(_ region: NSView?) -> Bool {
        guard let region, let cur = current(region.window), cur !== region.window?.contentView else { return false }
        guard cur is NSTextField || cur is AWCNativeButtonFocusView || cur is NSTextView else { return false }
        let f = frame(cur)
        return frame(region).insetBy(dx: -0.5, dy: -0.5).contains(CGPoint(x: f.midX, y: f.midY))
    }
    /// Focus is on the document (no AWC control) or still inside one of `regions`.
    static func focusIsFree(within regions: [NSView?]) -> Bool {
        guard let window = regions.compactMap({ $0?.window }).first else { return true }
        guard let cur = current(window), cur is NSTextField || cur is AWCNativeButtonFocusView || cur is NSTextView else { return true }
        return regions.contains { firstResponderInside($0) }
    }
    static func blur(_ v: NSView?) { _ = v?.window?.makeFirstResponder(nil) }
    static func keyboardModality(fallback: Bool) -> Bool {
        switch NSApp.currentEvent?.type {
        case .keyDown?: return true
        case .leftMouseDown?, .leftMouseUp?, .rightMouseDown?, .otherMouseDown?: return false
        default: return fallback
        }
    }
    static func announce(_ s: String) {
        guard let element = NSApp.mainWindow ?? NSApp.keyWindow else { return }
        NSAccessibility.post(element: element, notification: .announcementRequested,
                             userInfo: [.announcement: s, .priority: NSAccessibilityPriorityLevel.medium.rawValue])
    }
    static func installOutsidePress(_ rt: AWCSearchRuntime, _ handler: @escaping @MainActor () -> Void) {
        rt.monitor = NSEvent.addLocalMonitorForEvents(matching: [.leftMouseDown, .rightMouseDown, .otherMouseDown]) { [weak rt] e in
            guard let rt else { return e }
            let regions = [rt.hostRegion.view, rt.panelRegion.view].compactMap { $0 }.filter { $0.window === e.window }
            let p = e.locationInWindow
            if !regions.isEmpty && !regions.contains(where: { frame($0).contains(p) }) { DispatchQueue.main.async { handler() } }
            return e
        }
    }
    static func removeOutsidePress(_ rt: AWCSearchRuntime) { if let m = rt.monitor { NSEvent.removeMonitor(m); rt.monitor = nil } }
}
#else
final class AWCSearchRegionView: UIView { override func point(inside point: CGPoint, with event: UIEvent?) -> Bool { false } }
struct AWCSearchRegion: UIViewRepresentable {
    let box: AWCSearchRegionBox
    func makeUIView(context: Context) -> AWCSearchRegionView { let v = AWCSearchRegionView(); v.isAccessibilityElement = false; v.backgroundColor = .clear; box.view = v; return v }
    func updateUIView(_ view: AWCSearchRegionView, context: Context) { box.view = view }
}

enum AWCSearchWindow {
    @MainActor static func size(fallback: CGSize) -> CGSize {
        let window = UIApplication.shared.connectedScenes.compactMap { ($0 as? UIWindowScene)?.keyWindow }.first
        return window?.bounds.size ?? fallback
    }
}

/// An observer that never takes part in the gesture: it reports presses anywhere in the window (Chrome's capture
/// mousedown) and fails at once, so the touch reaches its own target unchanged.
final class AWCSearchOutsidePress: UIGestureRecognizer {
    var onPress: (CGPoint) -> Void = { _ in }
    /// When the last touch reached the window (ms, CACurrentMediaTime): the press that the async handlers act on.
    nonisolated(unsafe) static var lastPress: Double?
    override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent) {
        AWCSearchOutsidePress.lastPress = CACurrentMediaTime() * 1000
        if let t = touches.first, let w = view { onPress(t.location(in: w)) }
        state = .failed
    }
}

/// UIKit focus helpers over AWC key views (AWCKeyViewLoop's surface).
@MainActor enum AWCSearchFocus {
    static func frame(_ v: UIView) -> CGRect { v.convert(v.bounds, to: nil) }
    /// UIKit exposes no current event: a touch the window saw within 120 ms is the event the change answers (its handlers run
    /// a hop later); otherwise the change itself is the reference.
    static func eventTime() -> Double? {
        guard let t = AWCSearchOutsidePress.lastPress else { return nil }
        let age = CACurrentMediaTime() * 1000 - t
        return age >= 0 && age <= 120 ? t : nil
    }
    static func current() -> UIView? { AWCFirstResponderProbe.current() as? UIView }
    static func views(in region: UIView?, sequential: Bool) -> [UIView] {
        guard let region, let window = region.window else { return [] }
        let area = frame(region).insetBy(dx: -0.5, dy: -0.5)
        let found = AWCKeyViewLoop.views(in: window).filter { v in
            guard sequential ? v.awcCanBecomeKeyView : v.awcAcceptsFirstResponder else { return false }
            let f = frame(v); return area.contains(CGPoint(x: f.midX, y: f.midY))
        }.map { ($0 as UIView, frame($0)) }
        // Rows top to bottom, leading to trailing within a row: the search's DOM order, as on macOS (the window loop's document
        // tokens put the full-screen results, drawn under the bar, ahead of it).
        let rtl = region.effectiveUserInterfaceLayoutDirection == .rightToLeft
        return found.sorted { a, b in
            if abs(a.1.midY - b.1.midY) > min(a.1.height, b.1.height) / 2 { return a.1.midY < b.1.midY }
            return rtl ? a.1.midX > b.1.midX : a.1.midX < b.1.midX
        }.map(\.0)
    }
    static func currentIndex(in views: [UIView]) -> Int {
        guard let cur = current() else { return -1 }
        return views.firstIndex { $0 === cur } ?? -1
    }
    static func focus(_ v: UIView) {
        if let b = v as? AWCNativeButtonFocusView { _ = b.requestNativeFocus(showIndicator: true) }
        else if let k = v as? any AWCKeyView { _ = k.awcBecomeKeyView() } else { _ = v.becomeFirstResponder() }
    }
    static func firstResponderInside(_ region: UIView?) -> Bool {
        guard let region, region.window != nil, let cur = current(), cur is any AWCKeyView else { return false }
        let f = frame(cur)
        return frame(region).insetBy(dx: -0.5, dy: -0.5).contains(CGPoint(x: f.midX, y: f.midY))
    }
    static func focusIsFree(within regions: [UIView?]) -> Bool {
        guard let cur = current(), cur is any AWCKeyView else { return true }
        return regions.contains { firstResponderInside($0) }
    }
    static func blur(_ v: UIView?) { _ = current()?.resignFirstResponder() }
    static func keyboardModality(fallback: Bool) -> Bool { fallback }
    static func announce(_ s: String) { UIAccessibility.post(notification: .announcement, argument: s) }
    static func installOutsidePress(_ rt: AWCSearchRuntime, _ handler: @escaping @MainActor () -> Void) {
        guard let window = rt.hostRegion.view?.window else { return }
        let g = AWCSearchOutsidePress(target: nil, action: nil)
        g.cancelsTouchesInView = false; g.delaysTouchesBegan = false; g.delaysTouchesEnded = false
        g.onPress = { [weak rt] p in
            guard let rt else { return }
            let regions = [rt.hostRegion.view, rt.panelRegion.view].compactMap { $0 }.filter { $0.window != nil }
            if !regions.isEmpty && !regions.contains(where: { frame($0).contains(p) }) { DispatchQueue.main.async { handler() } }
        }
        window.addGestureRecognizer(g); rt.outsideRecognizer = g
    }
    static func removeOutsidePress(_ rt: AWCSearchRuntime) {
        if let g = rt.outsideRecognizer { g.view?.removeGestureRecognizer(g); rt.outsideRecognizer = nil }
    }
}
#endif

extension AWCNativeView {
    var nativeSearch: some View {
        AWCNativeSearch(node: node, theme: theme, setProp: { k, v in set(k, v) }, emit: { emit($0, $1) }, child: { child($0) })
    }
}

/// One-frame lead of the full-screen close motion clock behind the state write (Chrome's close fade starts in the frame after the change). AWC_SEARCH_CLOCK_LEAD overrides it for diagnostics.
enum AWCSearchClockLead { static let ms: Double = Double(ProcessInfo.processInfo.environment["AWC_SEARCH_CLOCK_LEAD"] ?? "") ?? 16.7 }
