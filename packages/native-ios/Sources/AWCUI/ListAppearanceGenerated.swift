import SwiftUI

// Generated from work/list-staging/hooks.py (the md-list / md-list-item source hooks). Do not edit by hand.

/// The ten public md-list hooks (`--md-list-*`). Unset fields keep the list-style/theme/density defaults.
public struct AWCListAppearance: Equatable, Sendable {
    /// `--md-list-container-color`
    public let containerColor: String?
    /// `--md-list-container-shape`
    public let containerShape: AWCCornerShape?
    /// `--md-list-padding-block`
    public let paddingBlock: Double?
    /// `--md-list-padding-inline`
    public let paddingInline: Double?
    /// `--md-list-segmented-gap`
    public let segmentedGap: Double?
    /// `--md-list-drop-placeholder-color`
    public let dropPlaceholderColor: String?
    /// `--md-list-drop-placeholder-outline-color`
    public let dropPlaceholderOutlineColor: String?
    /// `--md-list-drop-placeholder-outline-width`
    public let dropPlaceholderOutlineWidth: Double?
    /// `--md-list-drop-placeholder-shape`
    public let dropPlaceholderShape: AWCCornerShape?
    /// `--md-list-drop-placeholder-opacity`
    public let dropPlaceholderOpacity: Double?
    public init(containerColor: String? = nil, containerShape: AWCCornerShape? = nil, paddingBlock: Double? = nil, paddingInline: Double? = nil, segmentedGap: Double? = nil, dropPlaceholderColor: String? = nil, dropPlaceholderOutlineColor: String? = nil, dropPlaceholderOutlineWidth: Double? = nil, dropPlaceholderShape: AWCCornerShape? = nil, dropPlaceholderOpacity: Double? = nil) {
        self.containerColor = awcCardColor(containerColor)
        self.containerShape = containerShape.flatMap { $0.valid ? $0 : nil }
        self.paddingBlock = paddingBlock.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil }
        self.paddingInline = paddingInline.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil }
        self.segmentedGap = segmentedGap.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil }
        self.dropPlaceholderColor = awcCardColor(dropPlaceholderColor)
        self.dropPlaceholderOutlineColor = awcCardColor(dropPlaceholderOutlineColor)
        self.dropPlaceholderOutlineWidth = dropPlaceholderOutlineWidth.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil }
        self.dropPlaceholderShape = dropPlaceholderShape.flatMap { $0.valid ? $0 : nil }
        self.dropPlaceholderOpacity = dropPlaceholderOpacity.flatMap { $0.isFinite ? min(1, max(0, $0)) : nil }
    }
    public init(values: [String: AWCValue]) {
        func text(_ k: String) -> String? { guard case .string(let v) = values[k], !v.isEmpty else { return nil }; return v }
        func number(_ k: String) -> Double? { guard case .number(let v) = values[k] else { return nil }; return v }
        func shape(_ k: String) -> AWCCornerShape? { guard case .object(let v) = values[k] else { return nil }; return AWCCornerShape(values: v) }
        func shadow(_ k: String) -> [AWCBoxShadow]? { guard case .array(let a) = values[k] else { return nil }; let r = a.compactMap { v -> AWCBoxShadow? in guard case .object(let f) = v else { return nil }; return .init(values: f) }; return r.count == a.count ? r : nil }
        self.init(containerColor: text("containerColor"), containerShape: shape("containerShape"), paddingBlock: number("paddingBlock"), paddingInline: number("paddingInline"), segmentedGap: number("segmentedGap"), dropPlaceholderColor: text("dropPlaceholderColor"), dropPlaceholderOutlineColor: text("dropPlaceholderOutlineColor"), dropPlaceholderOutlineWidth: number("dropPlaceholderOutlineWidth"), dropPlaceholderShape: shape("dropPlaceholderShape"), dropPlaceholderOpacity: number("dropPlaceholderOpacity"))
    }
    public func merging(_ o: Self) -> Self { .init(containerColor: o.containerColor ?? containerColor, containerShape: o.containerShape ?? containerShape, paddingBlock: o.paddingBlock ?? paddingBlock, paddingInline: o.paddingInline ?? paddingInline, segmentedGap: o.segmentedGap ?? segmentedGap, dropPlaceholderColor: o.dropPlaceholderColor ?? dropPlaceholderColor, dropPlaceholderOutlineColor: o.dropPlaceholderOutlineColor ?? dropPlaceholderOutlineColor, dropPlaceholderOutlineWidth: o.dropPlaceholderOutlineWidth ?? dropPlaceholderOutlineWidth, dropPlaceholderShape: o.dropPlaceholderShape ?? dropPlaceholderShape, dropPlaceholderOpacity: o.dropPlaceholderOpacity ?? dropPlaceholderOpacity) }
    /// Field name → CSS custom property.
    public static let cssProperties: [String: String] = ["containerColor": "--md-list-container-color", "containerShape": "--md-list-container-shape", "paddingBlock": "--md-list-padding-block", "paddingInline": "--md-list-padding-inline", "segmentedGap": "--md-list-segmented-gap", "dropPlaceholderColor": "--md-list-drop-placeholder-color", "dropPlaceholderOutlineColor": "--md-list-drop-placeholder-outline-color", "dropPlaceholderOutlineWidth": "--md-list-drop-placeholder-outline-width", "dropPlaceholderShape": "--md-list-drop-placeholder-shape", "dropPlaceholderOpacity": "--md-list-drop-placeholder-opacity"]
}

/// The 68 public md-list-item hooks (`--md-list-item-*`). Unset fields keep the source defaults; state, selection and disabled rules still apply over them as in the source cascade.
public struct AWCListItemAppearance: Equatable, Sendable {
    /// `--md-list-item-container-color`
    public let containerColor: String?
    /// `--md-list-item-container-shape`
    public let containerShape: AWCCornerShape?
    /// `--md-list-item-container-shape-start-start`
    public let containerShapeStartStart: Double?
    /// `--md-list-item-container-shape-start-end`
    public let containerShapeStartEnd: Double?
    /// `--md-list-item-container-shape-end-start`
    public let containerShapeEndStart: Double?
    /// `--md-list-item-container-shape-end-end`
    public let containerShapeEndEnd: Double?
    /// `--md-list-item-active-container-shape`
    public let activeContainerShape: Double?
    /// `--md-list-item-hover-container-shape`
    public let hoverContainerShape: Double?
    /// `--md-list-item-focus-container-shape`
    public let focusContainerShape: Double?
    /// `--md-list-item-pressed-container-shape`
    public let pressedContainerShape: Double?
    /// `--md-list-item-selected-container-shape`
    public let selectedContainerShape: Double?
    /// `--md-list-item-dragged-container-shape`
    public let draggedContainerShape: Double?
    /// `--md-list-item-hover-state-layer-opacity`
    public let hoverStateLayerOpacity: Double?
    /// `--md-list-item-focus-state-layer-opacity`
    public let focusStateLayerOpacity: Double?
    /// `--md-list-item-pressed-state-layer-opacity`
    public let pressedStateLayerOpacity: Double?
    /// `--md-list-item-dragged-state-layer-opacity`
    public let draggedStateLayerOpacity: Double?
    /// `--md-list-item-disabled-state-layer-opacity`
    public let disabledStateLayerOpacity: Double?
    /// `--md-list-item-label-text-color`
    public let labelTextColor: String?
    /// `--md-list-item-label-text-font`
    public let labelTextFont: String?
    /// `--md-list-item-supporting-text-color`
    public let supportingTextColor: String?
    /// `--md-list-item-supporting-text-font`
    public let supportingTextFont: String?
    /// `--md-list-item-overline-color`
    public let overlineColor: String?
    /// `--md-list-item-trailing-supporting-text-color`
    public let trailingSupportingTextColor: String?
    /// `--md-list-item-trailing-supporting-text-font`
    public let trailingSupportingTextFont: String?
    /// `--md-list-item-leading-icon-color`
    public let leadingIconColor: String?
    /// `--md-list-item-leading-icon-size`
    public let leadingIconSize: Double?
    /// `--md-list-item-leading-icon-expressive-size`
    public let leadingIconExpressiveSize: Double?
    /// `--md-list-item-trailing-icon-color`
    public let trailingIconColor: String?
    /// `--md-list-item-unselected-trailing-icon-color`
    public let unselectedTrailingIconColor: String?
    /// `--md-list-item-trailing-icon-size`
    public let trailingIconSize: Double?
    /// `--md-list-item-trailing-icon-expressive-size`
    public let trailingIconExpressiveSize: Double?
    /// `--md-list-item-leading-space`
    public let leadingSpace: Double?
    /// `--md-list-item-trailing-space`
    public let trailingSpace: Double?
    /// `--md-list-item-top-space`
    public let topSpace: Double?
    /// `--md-list-item-bottom-space`
    public let bottomSpace: Double?
    /// `--md-list-item-between-space`
    public let betweenSpace: Double?
    /// `--md-list-item-three-line-top-space`
    public let threeLineTopSpace: Double?
    /// `--md-list-item-three-line-bottom-space`
    public let threeLineBottomSpace: Double?
    /// `--md-list-item-dragged-container-elevation`
    public let draggedContainerElevation: [AWCBoxShadow]?
    /// `--md-list-item-leading-video-width`
    public let leadingVideoWidth: Double?
    /// `--md-list-item-leading-video-height`
    public let leadingVideoHeight: Double?
    /// `--md-list-item-leading-video-shape`
    public let leadingVideoShape: Double?
    /// `--md-list-item-leading-video-top-space`
    public let leadingVideoTopSpace: Double?
    /// `--md-list-item-leading-avatar-color`
    public let leadingAvatarColor: String?
    /// `--md-list-item-leading-avatar-label-color`
    public let leadingAvatarLabelColor: String?
    /// `--md-list-item-leading-avatar-size`
    public let leadingAvatarSize: Double?
    /// `--md-list-item-leading-avatar-shape`
    public let leadingAvatarShape: Double?
    /// `--md-list-item-leading-image-width`
    public let leadingImageWidth: Double?
    /// `--md-list-item-leading-image-height`
    public let leadingImageHeight: Double?
    /// `--md-list-item-leading-image-shape`
    public let leadingImageShape: Double?
    /// `--md-list-item-leading-image-expressive-shape`
    public let leadingImageExpressiveShape: Double?
    /// `--md-list-item-leading-image-selection-scrim-color`
    public let leadingImageSelectionScrimColor: String?
    /// `--md-list-item-leading-image-selection-circle-color`
    public let leadingImageSelectionCircleColor: String?
    /// `--md-list-item-leading-image-selection-icon-color`
    public let leadingImageSelectionIconColor: String?
    /// `--md-list-item-leading-image-selection-icon-size`
    public let leadingImageSelectionIconSize: Double?
    /// `--md-list-item-selected-container-color`
    public let selectedContainerColor: String?
    /// `--md-list-item-selected-label-text-color`
    public let selectedLabelTextColor: String?
    /// `--md-list-item-selected-active-icon-color`
    public let selectedActiveIconColor: String?
    /// `--md-list-item-selected-disabled-container-color`
    public let selectedDisabledContainerColor: String?
    /// `--md-list-item-expand-chevron-color`
    public let expandChevronColor: String?
    /// `--md-list-item-expand-duration`
    public let expandDuration: Double?
    /// `--md-list-item-collapse-duration`
    public let collapseDuration: Double?
    /// `--md-list-item-expanded-panel-padding-block`
    public let expandedPanelPaddingBlock: Double?
    /// `--md-list-item-expanded-panel-padding-inline`
    public let expandedPanelPaddingInline: Double?
    /// `--md-list-item-expanded-panel-padding-inline-start`
    public let expandedPanelPaddingInlineStart: Double?
    /// `--md-list-item-expanded-panel-background`
    public let expandedPanelBackground: String?
    /// `--md-list-item-expand-button-size`
    public let expandButtonSize: Double?
    /// `--md-list-item-expand-chevron-size`
    public let expandChevronSize: Double?
    public init(containerColor: String? = nil, containerShape: AWCCornerShape? = nil, containerShapeStartStart: Double? = nil, containerShapeStartEnd: Double? = nil, containerShapeEndStart: Double? = nil, containerShapeEndEnd: Double? = nil, activeContainerShape: Double? = nil, hoverContainerShape: Double? = nil, focusContainerShape: Double? = nil, pressedContainerShape: Double? = nil, selectedContainerShape: Double? = nil, draggedContainerShape: Double? = nil, hoverStateLayerOpacity: Double? = nil, focusStateLayerOpacity: Double? = nil, pressedStateLayerOpacity: Double? = nil, draggedStateLayerOpacity: Double? = nil, disabledStateLayerOpacity: Double? = nil, labelTextColor: String? = nil, labelTextFont: String? = nil, supportingTextColor: String? = nil, supportingTextFont: String? = nil, overlineColor: String? = nil, trailingSupportingTextColor: String? = nil, trailingSupportingTextFont: String? = nil, leadingIconColor: String? = nil, leadingIconSize: Double? = nil, leadingIconExpressiveSize: Double? = nil, trailingIconColor: String? = nil, unselectedTrailingIconColor: String? = nil, trailingIconSize: Double? = nil, trailingIconExpressiveSize: Double? = nil, leadingSpace: Double? = nil, trailingSpace: Double? = nil, topSpace: Double? = nil, bottomSpace: Double? = nil, betweenSpace: Double? = nil, threeLineTopSpace: Double? = nil, threeLineBottomSpace: Double? = nil, draggedContainerElevation: [AWCBoxShadow]? = nil, leadingVideoWidth: Double? = nil, leadingVideoHeight: Double? = nil, leadingVideoShape: Double? = nil, leadingVideoTopSpace: Double? = nil, leadingAvatarColor: String? = nil, leadingAvatarLabelColor: String? = nil, leadingAvatarSize: Double? = nil, leadingAvatarShape: Double? = nil, leadingImageWidth: Double? = nil, leadingImageHeight: Double? = nil, leadingImageShape: Double? = nil, leadingImageExpressiveShape: Double? = nil, leadingImageSelectionScrimColor: String? = nil, leadingImageSelectionCircleColor: String? = nil, leadingImageSelectionIconColor: String? = nil, leadingImageSelectionIconSize: Double? = nil, selectedContainerColor: String? = nil, selectedLabelTextColor: String? = nil, selectedActiveIconColor: String? = nil, selectedDisabledContainerColor: String? = nil, expandChevronColor: String? = nil, expandDuration: Double? = nil, collapseDuration: Double? = nil, expandedPanelPaddingBlock: Double? = nil, expandedPanelPaddingInline: Double? = nil, expandedPanelPaddingInlineStart: Double? = nil, expandedPanelBackground: String? = nil, expandButtonSize: Double? = nil, expandChevronSize: Double? = nil) {
        self.containerColor = awcCardColor(containerColor)
        self.containerShape = containerShape.flatMap { $0.valid ? $0 : nil }
        self.containerShapeStartStart = containerShapeStartStart.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil }
        self.containerShapeStartEnd = containerShapeStartEnd.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil }
        self.containerShapeEndStart = containerShapeEndStart.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil }
        self.containerShapeEndEnd = containerShapeEndEnd.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil }
        self.activeContainerShape = activeContainerShape.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil }
        self.hoverContainerShape = hoverContainerShape.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil }
        self.focusContainerShape = focusContainerShape.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil }
        self.pressedContainerShape = pressedContainerShape.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil }
        self.selectedContainerShape = selectedContainerShape.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil }
        self.draggedContainerShape = draggedContainerShape.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil }
        self.hoverStateLayerOpacity = hoverStateLayerOpacity.flatMap { $0.isFinite ? min(1, max(0, $0)) : nil }
        self.focusStateLayerOpacity = focusStateLayerOpacity.flatMap { $0.isFinite ? min(1, max(0, $0)) : nil }
        self.pressedStateLayerOpacity = pressedStateLayerOpacity.flatMap { $0.isFinite ? min(1, max(0, $0)) : nil }
        self.draggedStateLayerOpacity = draggedStateLayerOpacity.flatMap { $0.isFinite ? min(1, max(0, $0)) : nil }
        self.disabledStateLayerOpacity = disabledStateLayerOpacity.flatMap { $0.isFinite ? min(1, max(0, $0)) : nil }
        self.labelTextColor = awcCardColor(labelTextColor)
        self.labelTextFont = labelTextFont.flatMap { $0.trimmingCharacters(in: .whitespaces).isEmpty ? nil : $0 }
        self.supportingTextColor = awcCardColor(supportingTextColor)
        self.supportingTextFont = supportingTextFont.flatMap { $0.trimmingCharacters(in: .whitespaces).isEmpty ? nil : $0 }
        self.overlineColor = awcCardColor(overlineColor)
        self.trailingSupportingTextColor = awcCardColor(trailingSupportingTextColor)
        self.trailingSupportingTextFont = trailingSupportingTextFont.flatMap { $0.trimmingCharacters(in: .whitespaces).isEmpty ? nil : $0 }
        self.leadingIconColor = awcCardColor(leadingIconColor)
        self.leadingIconSize = leadingIconSize.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil }
        self.leadingIconExpressiveSize = leadingIconExpressiveSize.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil }
        self.trailingIconColor = awcCardColor(trailingIconColor)
        self.unselectedTrailingIconColor = awcCardColor(unselectedTrailingIconColor)
        self.trailingIconSize = trailingIconSize.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil }
        self.trailingIconExpressiveSize = trailingIconExpressiveSize.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil }
        self.leadingSpace = leadingSpace.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil }
        self.trailingSpace = trailingSpace.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil }
        self.topSpace = topSpace.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil }
        self.bottomSpace = bottomSpace.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil }
        self.betweenSpace = betweenSpace.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil }
        self.threeLineTopSpace = threeLineTopSpace.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil }
        self.threeLineBottomSpace = threeLineBottomSpace.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil }
        self.draggedContainerElevation = draggedContainerElevation.flatMap { $0.allSatisfy(\.valid) ? $0 : nil }
        self.leadingVideoWidth = leadingVideoWidth.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil }
        self.leadingVideoHeight = leadingVideoHeight.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil }
        self.leadingVideoShape = leadingVideoShape.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil }
        self.leadingVideoTopSpace = leadingVideoTopSpace.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil }
        self.leadingAvatarColor = awcCardColor(leadingAvatarColor)
        self.leadingAvatarLabelColor = awcCardColor(leadingAvatarLabelColor)
        self.leadingAvatarSize = leadingAvatarSize.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil }
        self.leadingAvatarShape = leadingAvatarShape.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil }
        self.leadingImageWidth = leadingImageWidth.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil }
        self.leadingImageHeight = leadingImageHeight.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil }
        self.leadingImageShape = leadingImageShape.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil }
        self.leadingImageExpressiveShape = leadingImageExpressiveShape.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil }
        self.leadingImageSelectionScrimColor = awcCardColor(leadingImageSelectionScrimColor)
        self.leadingImageSelectionCircleColor = awcCardColor(leadingImageSelectionCircleColor)
        self.leadingImageSelectionIconColor = awcCardColor(leadingImageSelectionIconColor)
        self.leadingImageSelectionIconSize = leadingImageSelectionIconSize.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil }
        self.selectedContainerColor = awcCardColor(selectedContainerColor)
        self.selectedLabelTextColor = awcCardColor(selectedLabelTextColor)
        self.selectedActiveIconColor = awcCardColor(selectedActiveIconColor)
        self.selectedDisabledContainerColor = awcCardColor(selectedDisabledContainerColor)
        self.expandChevronColor = awcCardColor(expandChevronColor)
        self.expandDuration = expandDuration.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil }
        self.collapseDuration = collapseDuration.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil }
        self.expandedPanelPaddingBlock = expandedPanelPaddingBlock.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil }
        self.expandedPanelPaddingInline = expandedPanelPaddingInline.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil }
        self.expandedPanelPaddingInlineStart = expandedPanelPaddingInlineStart.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil }
        self.expandedPanelBackground = awcCardColor(expandedPanelBackground)
        self.expandButtonSize = expandButtonSize.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil }
        self.expandChevronSize = expandChevronSize.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil }
    }
    public init(values: [String: AWCValue]) {
        func text(_ k: String) -> String? { guard case .string(let v) = values[k], !v.isEmpty else { return nil }; return v }
        func number(_ k: String) -> Double? { guard case .number(let v) = values[k] else { return nil }; return v }
        func shape(_ k: String) -> AWCCornerShape? { guard case .object(let v) = values[k] else { return nil }; return AWCCornerShape(values: v) }
        func shadow(_ k: String) -> [AWCBoxShadow]? { guard case .array(let a) = values[k] else { return nil }; let r = a.compactMap { v -> AWCBoxShadow? in guard case .object(let f) = v else { return nil }; return .init(values: f) }; return r.count == a.count ? r : nil }
        self.init(containerColor: text("containerColor"), containerShape: shape("containerShape"), containerShapeStartStart: number("containerShapeStartStart"), containerShapeStartEnd: number("containerShapeStartEnd"), containerShapeEndStart: number("containerShapeEndStart"), containerShapeEndEnd: number("containerShapeEndEnd"), activeContainerShape: number("activeContainerShape"), hoverContainerShape: number("hoverContainerShape"), focusContainerShape: number("focusContainerShape"), pressedContainerShape: number("pressedContainerShape"), selectedContainerShape: number("selectedContainerShape"), draggedContainerShape: number("draggedContainerShape"), hoverStateLayerOpacity: number("hoverStateLayerOpacity"), focusStateLayerOpacity: number("focusStateLayerOpacity"), pressedStateLayerOpacity: number("pressedStateLayerOpacity"), draggedStateLayerOpacity: number("draggedStateLayerOpacity"), disabledStateLayerOpacity: number("disabledStateLayerOpacity"), labelTextColor: text("labelTextColor"), labelTextFont: text("labelTextFont"), supportingTextColor: text("supportingTextColor"), supportingTextFont: text("supportingTextFont"), overlineColor: text("overlineColor"), trailingSupportingTextColor: text("trailingSupportingTextColor"), trailingSupportingTextFont: text("trailingSupportingTextFont"), leadingIconColor: text("leadingIconColor"), leadingIconSize: number("leadingIconSize"), leadingIconExpressiveSize: number("leadingIconExpressiveSize"), trailingIconColor: text("trailingIconColor"), unselectedTrailingIconColor: text("unselectedTrailingIconColor"), trailingIconSize: number("trailingIconSize"), trailingIconExpressiveSize: number("trailingIconExpressiveSize"), leadingSpace: number("leadingSpace"), trailingSpace: number("trailingSpace"), topSpace: number("topSpace"), bottomSpace: number("bottomSpace"), betweenSpace: number("betweenSpace"), threeLineTopSpace: number("threeLineTopSpace"), threeLineBottomSpace: number("threeLineBottomSpace"), draggedContainerElevation: shadow("draggedContainerElevation"), leadingVideoWidth: number("leadingVideoWidth"), leadingVideoHeight: number("leadingVideoHeight"), leadingVideoShape: number("leadingVideoShape"), leadingVideoTopSpace: number("leadingVideoTopSpace"), leadingAvatarColor: text("leadingAvatarColor"), leadingAvatarLabelColor: text("leadingAvatarLabelColor"), leadingAvatarSize: number("leadingAvatarSize"), leadingAvatarShape: number("leadingAvatarShape"), leadingImageWidth: number("leadingImageWidth"), leadingImageHeight: number("leadingImageHeight"), leadingImageShape: number("leadingImageShape"), leadingImageExpressiveShape: number("leadingImageExpressiveShape"), leadingImageSelectionScrimColor: text("leadingImageSelectionScrimColor"), leadingImageSelectionCircleColor: text("leadingImageSelectionCircleColor"), leadingImageSelectionIconColor: text("leadingImageSelectionIconColor"), leadingImageSelectionIconSize: number("leadingImageSelectionIconSize"), selectedContainerColor: text("selectedContainerColor"), selectedLabelTextColor: text("selectedLabelTextColor"), selectedActiveIconColor: text("selectedActiveIconColor"), selectedDisabledContainerColor: text("selectedDisabledContainerColor"), expandChevronColor: text("expandChevronColor"), expandDuration: number("expandDuration"), collapseDuration: number("collapseDuration"), expandedPanelPaddingBlock: number("expandedPanelPaddingBlock"), expandedPanelPaddingInline: number("expandedPanelPaddingInline"), expandedPanelPaddingInlineStart: number("expandedPanelPaddingInlineStart"), expandedPanelBackground: text("expandedPanelBackground"), expandButtonSize: number("expandButtonSize"), expandChevronSize: number("expandChevronSize"))
    }
    public func merging(_ o: Self) -> Self { .init(containerColor: o.containerColor ?? containerColor, containerShape: o.containerShape ?? containerShape, containerShapeStartStart: o.containerShapeStartStart ?? containerShapeStartStart, containerShapeStartEnd: o.containerShapeStartEnd ?? containerShapeStartEnd, containerShapeEndStart: o.containerShapeEndStart ?? containerShapeEndStart, containerShapeEndEnd: o.containerShapeEndEnd ?? containerShapeEndEnd, activeContainerShape: o.activeContainerShape ?? activeContainerShape, hoverContainerShape: o.hoverContainerShape ?? hoverContainerShape, focusContainerShape: o.focusContainerShape ?? focusContainerShape, pressedContainerShape: o.pressedContainerShape ?? pressedContainerShape, selectedContainerShape: o.selectedContainerShape ?? selectedContainerShape, draggedContainerShape: o.draggedContainerShape ?? draggedContainerShape, hoverStateLayerOpacity: o.hoverStateLayerOpacity ?? hoverStateLayerOpacity, focusStateLayerOpacity: o.focusStateLayerOpacity ?? focusStateLayerOpacity, pressedStateLayerOpacity: o.pressedStateLayerOpacity ?? pressedStateLayerOpacity, draggedStateLayerOpacity: o.draggedStateLayerOpacity ?? draggedStateLayerOpacity, disabledStateLayerOpacity: o.disabledStateLayerOpacity ?? disabledStateLayerOpacity, labelTextColor: o.labelTextColor ?? labelTextColor, labelTextFont: o.labelTextFont ?? labelTextFont, supportingTextColor: o.supportingTextColor ?? supportingTextColor, supportingTextFont: o.supportingTextFont ?? supportingTextFont, overlineColor: o.overlineColor ?? overlineColor, trailingSupportingTextColor: o.trailingSupportingTextColor ?? trailingSupportingTextColor, trailingSupportingTextFont: o.trailingSupportingTextFont ?? trailingSupportingTextFont, leadingIconColor: o.leadingIconColor ?? leadingIconColor, leadingIconSize: o.leadingIconSize ?? leadingIconSize, leadingIconExpressiveSize: o.leadingIconExpressiveSize ?? leadingIconExpressiveSize, trailingIconColor: o.trailingIconColor ?? trailingIconColor, unselectedTrailingIconColor: o.unselectedTrailingIconColor ?? unselectedTrailingIconColor, trailingIconSize: o.trailingIconSize ?? trailingIconSize, trailingIconExpressiveSize: o.trailingIconExpressiveSize ?? trailingIconExpressiveSize, leadingSpace: o.leadingSpace ?? leadingSpace, trailingSpace: o.trailingSpace ?? trailingSpace, topSpace: o.topSpace ?? topSpace, bottomSpace: o.bottomSpace ?? bottomSpace, betweenSpace: o.betweenSpace ?? betweenSpace, threeLineTopSpace: o.threeLineTopSpace ?? threeLineTopSpace, threeLineBottomSpace: o.threeLineBottomSpace ?? threeLineBottomSpace, draggedContainerElevation: o.draggedContainerElevation ?? draggedContainerElevation, leadingVideoWidth: o.leadingVideoWidth ?? leadingVideoWidth, leadingVideoHeight: o.leadingVideoHeight ?? leadingVideoHeight, leadingVideoShape: o.leadingVideoShape ?? leadingVideoShape, leadingVideoTopSpace: o.leadingVideoTopSpace ?? leadingVideoTopSpace, leadingAvatarColor: o.leadingAvatarColor ?? leadingAvatarColor, leadingAvatarLabelColor: o.leadingAvatarLabelColor ?? leadingAvatarLabelColor, leadingAvatarSize: o.leadingAvatarSize ?? leadingAvatarSize, leadingAvatarShape: o.leadingAvatarShape ?? leadingAvatarShape, leadingImageWidth: o.leadingImageWidth ?? leadingImageWidth, leadingImageHeight: o.leadingImageHeight ?? leadingImageHeight, leadingImageShape: o.leadingImageShape ?? leadingImageShape, leadingImageExpressiveShape: o.leadingImageExpressiveShape ?? leadingImageExpressiveShape, leadingImageSelectionScrimColor: o.leadingImageSelectionScrimColor ?? leadingImageSelectionScrimColor, leadingImageSelectionCircleColor: o.leadingImageSelectionCircleColor ?? leadingImageSelectionCircleColor, leadingImageSelectionIconColor: o.leadingImageSelectionIconColor ?? leadingImageSelectionIconColor, leadingImageSelectionIconSize: o.leadingImageSelectionIconSize ?? leadingImageSelectionIconSize, selectedContainerColor: o.selectedContainerColor ?? selectedContainerColor, selectedLabelTextColor: o.selectedLabelTextColor ?? selectedLabelTextColor, selectedActiveIconColor: o.selectedActiveIconColor ?? selectedActiveIconColor, selectedDisabledContainerColor: o.selectedDisabledContainerColor ?? selectedDisabledContainerColor, expandChevronColor: o.expandChevronColor ?? expandChevronColor, expandDuration: o.expandDuration ?? expandDuration, collapseDuration: o.collapseDuration ?? collapseDuration, expandedPanelPaddingBlock: o.expandedPanelPaddingBlock ?? expandedPanelPaddingBlock, expandedPanelPaddingInline: o.expandedPanelPaddingInline ?? expandedPanelPaddingInline, expandedPanelPaddingInlineStart: o.expandedPanelPaddingInlineStart ?? expandedPanelPaddingInlineStart, expandedPanelBackground: o.expandedPanelBackground ?? expandedPanelBackground, expandButtonSize: o.expandButtonSize ?? expandButtonSize, expandChevronSize: o.expandChevronSize ?? expandChevronSize) }
    /// Field name → CSS custom property.
    public static let cssProperties: [String: String] = ["containerColor": "--md-list-item-container-color", "containerShape": "--md-list-item-container-shape", "containerShapeStartStart": "--md-list-item-container-shape-start-start", "containerShapeStartEnd": "--md-list-item-container-shape-start-end", "containerShapeEndStart": "--md-list-item-container-shape-end-start", "containerShapeEndEnd": "--md-list-item-container-shape-end-end", "activeContainerShape": "--md-list-item-active-container-shape", "hoverContainerShape": "--md-list-item-hover-container-shape", "focusContainerShape": "--md-list-item-focus-container-shape", "pressedContainerShape": "--md-list-item-pressed-container-shape", "selectedContainerShape": "--md-list-item-selected-container-shape", "draggedContainerShape": "--md-list-item-dragged-container-shape", "hoverStateLayerOpacity": "--md-list-item-hover-state-layer-opacity", "focusStateLayerOpacity": "--md-list-item-focus-state-layer-opacity", "pressedStateLayerOpacity": "--md-list-item-pressed-state-layer-opacity", "draggedStateLayerOpacity": "--md-list-item-dragged-state-layer-opacity", "disabledStateLayerOpacity": "--md-list-item-disabled-state-layer-opacity", "labelTextColor": "--md-list-item-label-text-color", "labelTextFont": "--md-list-item-label-text-font", "supportingTextColor": "--md-list-item-supporting-text-color", "supportingTextFont": "--md-list-item-supporting-text-font", "overlineColor": "--md-list-item-overline-color", "trailingSupportingTextColor": "--md-list-item-trailing-supporting-text-color", "trailingSupportingTextFont": "--md-list-item-trailing-supporting-text-font", "leadingIconColor": "--md-list-item-leading-icon-color", "leadingIconSize": "--md-list-item-leading-icon-size", "leadingIconExpressiveSize": "--md-list-item-leading-icon-expressive-size", "trailingIconColor": "--md-list-item-trailing-icon-color", "unselectedTrailingIconColor": "--md-list-item-unselected-trailing-icon-color", "trailingIconSize": "--md-list-item-trailing-icon-size", "trailingIconExpressiveSize": "--md-list-item-trailing-icon-expressive-size", "leadingSpace": "--md-list-item-leading-space", "trailingSpace": "--md-list-item-trailing-space", "topSpace": "--md-list-item-top-space", "bottomSpace": "--md-list-item-bottom-space", "betweenSpace": "--md-list-item-between-space", "threeLineTopSpace": "--md-list-item-three-line-top-space", "threeLineBottomSpace": "--md-list-item-three-line-bottom-space", "draggedContainerElevation": "--md-list-item-dragged-container-elevation", "leadingVideoWidth": "--md-list-item-leading-video-width", "leadingVideoHeight": "--md-list-item-leading-video-height", "leadingVideoShape": "--md-list-item-leading-video-shape", "leadingVideoTopSpace": "--md-list-item-leading-video-top-space", "leadingAvatarColor": "--md-list-item-leading-avatar-color", "leadingAvatarLabelColor": "--md-list-item-leading-avatar-label-color", "leadingAvatarSize": "--md-list-item-leading-avatar-size", "leadingAvatarShape": "--md-list-item-leading-avatar-shape", "leadingImageWidth": "--md-list-item-leading-image-width", "leadingImageHeight": "--md-list-item-leading-image-height", "leadingImageShape": "--md-list-item-leading-image-shape", "leadingImageExpressiveShape": "--md-list-item-leading-image-expressive-shape", "leadingImageSelectionScrimColor": "--md-list-item-leading-image-selection-scrim-color", "leadingImageSelectionCircleColor": "--md-list-item-leading-image-selection-circle-color", "leadingImageSelectionIconColor": "--md-list-item-leading-image-selection-icon-color", "leadingImageSelectionIconSize": "--md-list-item-leading-image-selection-icon-size", "selectedContainerColor": "--md-list-item-selected-container-color", "selectedLabelTextColor": "--md-list-item-selected-label-text-color", "selectedActiveIconColor": "--md-list-item-selected-active-icon-color", "selectedDisabledContainerColor": "--md-list-item-selected-disabled-container-color", "expandChevronColor": "--md-list-item-expand-chevron-color", "expandDuration": "--md-list-item-expand-duration", "collapseDuration": "--md-list-item-collapse-duration", "expandedPanelPaddingBlock": "--md-list-item-expanded-panel-padding-block", "expandedPanelPaddingInline": "--md-list-item-expanded-panel-padding-inline", "expandedPanelPaddingInlineStart": "--md-list-item-expanded-panel-padding-inline-start", "expandedPanelBackground": "--md-list-item-expanded-panel-background", "expandButtonSize": "--md-list-item-expand-button-size", "expandChevronSize": "--md-list-item-expand-chevron-size"]
}
