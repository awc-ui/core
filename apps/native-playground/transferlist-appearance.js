import { appearanceField, appearanceProfile } from './accordion-appearance.js';

// The twenty md-transfer-list source hooks (--md-transfer-list-*), in md-transfer-list.css order. Field order follows the
// native initializers (Swift requires labelled arguments in order). Lengths are px (points on SwiftUI, dp on Android); colours
// #RRGGBB[AA]; the item padding is the CSS padding shorthand (one to four px values: top, right, bottom, left — physical).
const field = (name, label, suffix, kind) => appearanceField('transfer-list', name, label, suffix, kind);
export const TRANSFER_LIST_APPEARANCE_FIELDS = Object.freeze([
  field('width', 'Width', 'width', 'length'),
  field('minWidth', 'Minimum width', 'min-width', 'length'),
  field('maxWidth', 'Maximum width', 'max-width', 'length'),
  field('height', 'Height', 'height', 'length'),
  field('minHeight', 'Minimum height', 'min-height', 'length'),
  field('maxHeight', 'Maximum height', 'max-height', 'length'),
  field('columnMinWidth', 'Column minimum width', 'column-min-width', 'length'),
  field('columnMaxBlock', 'Column maximum height', 'column-max-block', 'length'),
  field('containerShape', 'Container corner radius', 'container-shape', 'length'),
  field('containerColor', 'Container color', 'container-color', 'color'),
  field('headerColor', 'Header color', 'header-color', 'color'),
  field('headerTextColor', 'Header text color', 'header-text-color', 'color'),
  field('itemInset', 'Item inset', 'item-inset', 'length'),
  field('itemPadding', 'Item padding', 'item-padding', 'insets'),
  field('itemGap', 'Item gap', 'item-gap', 'length'),
  field('dividerColor', 'Divider color', 'divider-color', 'color'),
  field('controlsGap', 'Controls gap', 'controls-gap', 'length'),
  field('emptyIconSize', 'Empty icon size', 'empty-icon-size', 'length'),
  field('controlSize', 'Mover size', 'control-size', 'length'),
  field('controlIconSize', 'Mover icon size', 'control-icon-size', 'length'),
]);
const profile = appearanceProfile(TRANSFER_LIST_APPEARANCE_FIELDS, 'INVALID_TRANSFER_LIST_APPEARANCE', 'Transfer list', { insetsType: 'AWCTransferListInsets' });
/** The source's ::part names with their typed native part fields (AWCTransferListPartAppearance: one AWCTransferListPartStyle per part). */
export const TRANSFER_LIST_PARTS = Object.freeze({
  column: ['backgroundColor', 'borderColor', 'shape'], 'column-source': ['backgroundColor', 'borderColor', 'shape'], 'column-target': ['backgroundColor', 'borderColor', 'shape'],
  header: ['backgroundColor', 'borderColor'], 'header-title': ['backgroundColor'],
  count: ['backgroundColor', 'color', 'shape'], search: ['backgroundColor'], list: ['backgroundColor'], item: ['backgroundColor', 'shape'],
  empty: ['backgroundColor', 'color'], 'empty-icon': ['color', 'size', 'opacity'], controls: ['backgroundColor'],
});
export const transferListAppearance = Object.freeze({
  fields: TRANSFER_LIST_APPEARANCE_FIELDS,
  normalize: value => profile.normalize(value),
  css: value => profile.css(value),
  parseInput: (name, raw) => profile.parseInput(name, raw),
  formatInput: (name, value) => profile.formatInput(name, value),
  nativeValue: (name, value, platform) => profile.nativeValue(name, value, platform),
});
