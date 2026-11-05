import { appearanceField, appearanceProfile } from './accordion-appearance.js';

// The ten md-list and sixty-eight md-list-item source hooks (md-list.css, md-list-item.css). Field order follows
// the native initializers (Swift requires labelled arguments in declaration order).
const field = (prefix, name, label, suffix, kind) => appearanceField(prefix, name, label, suffix, kind);
export const LIST_APPEARANCE_FIELDS = Object.freeze([
  field('list', 'containerColor', 'Container color', 'container-color', 'color'),
  field('list', 'containerShape', 'Container shape', 'container-shape', 'corners'),
  field('list', 'paddingBlock', 'Padding block', 'padding-block', 'length'),
  field('list', 'paddingInline', 'Padding inline', 'padding-inline', 'length'),
  field('list', 'segmentedGap', 'Segmented gap', 'segmented-gap', 'length'),
  field('list', 'dropPlaceholderColor', 'Drop placeholder color', 'drop-placeholder-color', 'color'),
  field('list', 'dropPlaceholderOutlineColor', 'Drop placeholder outline color', 'drop-placeholder-outline-color', 'color'),
  field('list', 'dropPlaceholderOutlineWidth', 'Drop placeholder outline width', 'drop-placeholder-outline-width', 'length'),
  field('list', 'dropPlaceholderShape', 'Drop placeholder shape', 'drop-placeholder-shape', 'corners'),
  field('list', 'dropPlaceholderOpacity', 'Drop placeholder opacity', 'drop-placeholder-opacity', 'opacity'),
]);
export const LIST_ITEM_APPEARANCE_FIELDS = Object.freeze([
  field('list-item', 'containerColor', 'Container color', 'container-color', 'color'),
  field('list-item', 'containerShape', 'Container shape', 'container-shape', 'corners'),
  field('list-item', 'containerShapeStartStart', 'Container corner start-start', 'container-shape-start-start', 'length'),
  field('list-item', 'containerShapeStartEnd', 'Container corner start-end', 'container-shape-start-end', 'length'),
  field('list-item', 'containerShapeEndStart', 'Container corner end-start', 'container-shape-end-start', 'length'),
  field('list-item', 'containerShapeEndEnd', 'Container corner end-end', 'container-shape-end-end', 'length'),
  field('list-item', 'activeContainerShape', 'Active container shape', 'active-container-shape', 'length'),
  field('list-item', 'hoverContainerShape', 'Hover container shape', 'hover-container-shape', 'length'),
  field('list-item', 'focusContainerShape', 'Focus container shape', 'focus-container-shape', 'length'),
  field('list-item', 'pressedContainerShape', 'Pressed container shape', 'pressed-container-shape', 'length'),
  field('list-item', 'selectedContainerShape', 'Selected container shape', 'selected-container-shape', 'length'),
  field('list-item', 'draggedContainerShape', 'Dragged container shape', 'dragged-container-shape', 'length'),
  field('list-item', 'hoverStateLayerOpacity', 'Hover state layer opacity', 'hover-state-layer-opacity', 'opacity'),
  field('list-item', 'focusStateLayerOpacity', 'Focus state layer opacity', 'focus-state-layer-opacity', 'opacity'),
  field('list-item', 'pressedStateLayerOpacity', 'Pressed state layer opacity', 'pressed-state-layer-opacity', 'opacity'),
  field('list-item', 'draggedStateLayerOpacity', 'Dragged state layer opacity', 'dragged-state-layer-opacity', 'opacity'),
  field('list-item', 'disabledStateLayerOpacity', 'Disabled state layer opacity', 'disabled-state-layer-opacity', 'opacity'),
  field('list-item', 'labelTextColor', 'Label text color', 'label-text-color', 'color'),
  field('list-item', 'labelTextFont', 'Label text font', 'label-text-font', 'font'),
  field('list-item', 'supportingTextColor', 'Supporting text color', 'supporting-text-color', 'color'),
  field('list-item', 'supportingTextFont', 'Supporting text font', 'supporting-text-font', 'font'),
  field('list-item', 'overlineColor', 'Overline color', 'overline-color', 'color'),
  field('list-item', 'trailingSupportingTextColor', 'Trailing supporting text color', 'trailing-supporting-text-color', 'color'),
  field('list-item', 'trailingSupportingTextFont', 'Trailing supporting text font', 'trailing-supporting-text-font', 'font'),
  field('list-item', 'leadingIconColor', 'Leading icon color', 'leading-icon-color', 'color'),
  field('list-item', 'leadingIconSize', 'Leading icon size', 'leading-icon-size', 'length'),
  field('list-item', 'leadingIconExpressiveSize', 'Leading icon expressive size', 'leading-icon-expressive-size', 'length'),
  field('list-item', 'trailingIconColor', 'Trailing icon color', 'trailing-icon-color', 'color'),
  field('list-item', 'unselectedTrailingIconColor', 'Unselected trailing icon color', 'unselected-trailing-icon-color', 'color'),
  field('list-item', 'trailingIconSize', 'Trailing icon size', 'trailing-icon-size', 'length'),
  field('list-item', 'trailingIconExpressiveSize', 'Trailing icon expressive size', 'trailing-icon-expressive-size', 'length'),
  field('list-item', 'leadingSpace', 'Leading space', 'leading-space', 'length'),
  field('list-item', 'trailingSpace', 'Trailing space', 'trailing-space', 'length'),
  field('list-item', 'topSpace', 'Top space', 'top-space', 'length'),
  field('list-item', 'bottomSpace', 'Bottom space', 'bottom-space', 'length'),
  field('list-item', 'betweenSpace', 'Between space', 'between-space', 'length'),
  field('list-item', 'threeLineTopSpace', 'Three line top space', 'three-line-top-space', 'length'),
  field('list-item', 'threeLineBottomSpace', 'Three line bottom space', 'three-line-bottom-space', 'length'),
  field('list-item', 'draggedContainerElevation', 'Dragged container elevation', 'dragged-container-elevation', 'shadow'),
  field('list-item', 'leadingVideoWidth', 'Leading video width', 'leading-video-width', 'length'),
  field('list-item', 'leadingVideoHeight', 'Leading video height', 'leading-video-height', 'length'),
  field('list-item', 'leadingVideoShape', 'Leading video shape', 'leading-video-shape', 'length'),
  field('list-item', 'leadingVideoTopSpace', 'Leading video top space', 'leading-video-top-space', 'length'),
  field('list-item', 'leadingAvatarColor', 'Leading avatar color', 'leading-avatar-color', 'color'),
  field('list-item', 'leadingAvatarLabelColor', 'Leading avatar label color', 'leading-avatar-label-color', 'color'),
  field('list-item', 'leadingAvatarSize', 'Leading avatar size', 'leading-avatar-size', 'length'),
  field('list-item', 'leadingAvatarShape', 'Leading avatar shape', 'leading-avatar-shape', 'length'),
  field('list-item', 'leadingImageWidth', 'Leading image width', 'leading-image-width', 'length'),
  field('list-item', 'leadingImageHeight', 'Leading image height', 'leading-image-height', 'length'),
  field('list-item', 'leadingImageShape', 'Leading image shape', 'leading-image-shape', 'length'),
  field('list-item', 'leadingImageExpressiveShape', 'Leading image expressive shape', 'leading-image-expressive-shape', 'length'),
  field('list-item', 'leadingImageSelectionScrimColor', 'Leading image selection scrim color', 'leading-image-selection-scrim-color', 'color'),
  field('list-item', 'leadingImageSelectionCircleColor', 'Leading image selection circle color', 'leading-image-selection-circle-color', 'color'),
  field('list-item', 'leadingImageSelectionIconColor', 'Leading image selection icon color', 'leading-image-selection-icon-color', 'color'),
  field('list-item', 'leadingImageSelectionIconSize', 'Leading image selection icon size', 'leading-image-selection-icon-size', 'length'),
  field('list-item', 'selectedContainerColor', 'Selected container color', 'selected-container-color', 'color'),
  field('list-item', 'selectedLabelTextColor', 'Selected label text color', 'selected-label-text-color', 'color'),
  field('list-item', 'selectedActiveIconColor', 'Selected active icon color', 'selected-active-icon-color', 'color'),
  field('list-item', 'selectedDisabledContainerColor', 'Selected disabled container color', 'selected-disabled-container-color', 'color'),
  field('list-item', 'expandChevronColor', 'Expand chevron color', 'expand-chevron-color', 'color'),
  field('list-item', 'expandDuration', 'Expand duration', 'expand-duration', 'duration'),
  field('list-item', 'collapseDuration', 'Collapse duration', 'collapse-duration', 'duration'),
  field('list-item', 'expandedPanelPaddingBlock', 'Expanded panel padding block', 'expanded-panel-padding-block', 'length'),
  field('list-item', 'expandedPanelPaddingInline', 'Expanded panel padding inline', 'expanded-panel-padding-inline', 'length'),
  field('list-item', 'expandedPanelPaddingInlineStart', 'Expanded panel padding inline start', 'expanded-panel-padding-inline-start', 'length'),
  field('list-item', 'expandedPanelBackground', 'Expanded panel background', 'expanded-panel-background', 'color'),
  field('list-item', 'expandButtonSize', 'Expand button size', 'expand-button-size', 'length'),
  field('list-item', 'expandChevronSize', 'Expand chevron size', 'expand-chevron-size', 'length'),
]);
/** The source's typed part targets (::part names) — md-list: one, md-list-item: twenty-nine. */
export const LIST_PARTS = Object.freeze(['drop-placeholder']);
export const LIST_ITEM_PARTS = Object.freeze(['leading', 'avatar', 'image-wrap', 'image', 'image-selection-indicator', 'image-selection-circle', 'image-selection-check', 'leading-icon',
  'content', 'overline', 'headline', 'supporting-text', 'trailing', 'trailing-supporting-text', 'trailing-icon', 'expand-button', 'drag-handle', 'primary', 'row', 'state-layer',
  'expanded-panel', 'expanded-panel-inner', 'avatar-image', 'avatar-initials', 'avatar-icon', 'headline-tooltip-popup', 'supporting-tooltip-popup', 'expand-button-state-layer', 'expand-button-icon']);
const list = appearanceProfile(LIST_APPEARANCE_FIELDS, 'INVALID_LIST_APPEARANCE', 'List');
const item = appearanceProfile(LIST_ITEM_APPEARANCE_FIELDS, 'INVALID_LIST_ITEM_APPEARANCE', 'List Item');
export const normalizeListAppearance = value => list.normalize(value);
export const listAppearanceCSS = value => list.css(value);
export const parseListAppearanceInput = (name, raw) => list.parseInput(name, raw);
export const formatListAppearanceInput = (name, value) => list.formatInput(name, value);
export const listAppearanceNativeValue = (name, value, platform) => list.nativeValue(name, value, platform);
export const normalizeListItemAppearance = value => item.normalize(value);
export const listItemAppearanceCSS = value => item.css(value);
export const parseListItemAppearanceInput = (name, raw) => item.parseInput(name, raw);
export const formatListItemAppearanceInput = (name, value) => item.formatInput(name, value);
export const listItemAppearanceNativeValue = (name, value, platform) => item.nativeValue(name, value, platform);
