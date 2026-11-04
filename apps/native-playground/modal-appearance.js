import { appearanceField, appearanceProfile } from './accordion-appearance.js';

// The md-dialog (10), md-bottom-sheet (16) and md-side-sheet (9) source hooks. Field order follows the native
// initializers (Swift requires labelled arguments in declaration order).
const dialog = (name, label, suffix, kind) => appearanceField('dialog', name, label, suffix, kind);
export const DIALOG_APPEARANCE_FIELDS = Object.freeze([
  dialog('containerColor', 'Container color', 'container-color', 'color'),
  dialog('containerShape', 'Container corners', 'container-shape', 'corners'),
  dialog('headlineColor', 'Headline color', 'headline-color', 'color'),
  dialog('contentColor', 'Content color', 'content-color', 'color'),
  dialog('iconColor', 'Icon color', 'icon-color', 'color'),
  dialog('iconSize', 'Icon size', 'icon-size', 'length'),
  dialog('scrimColor', 'Scrim color', 'scrim-color', 'color'),
  dialog('dividerColor', 'Divider color', 'divider-color', 'color'),
  dialog('zIndex', 'Stacking order', 'z-index', 'integer'),
  dialog('scrimZIndex', 'Scrim stacking order', 'scrim-z-index', 'integer'),
]);
const sheet = (name, label, suffix, kind) => appearanceField('bottom-sheet', name, label, suffix, kind);
export const BOTTOM_SHEET_APPEARANCE_FIELDS = Object.freeze([
  sheet('containerColor', 'Container color', 'container-color', 'color'),
  sheet('containerShape', 'Container corners', 'container-shape', 'sheetShape'),
  sheet('contentColor', 'Content color', 'content-color', 'color'),
  sheet('headlineColor', 'Headline color', 'headline-color', 'color'),
  sheet('scrimColor', 'Scrim color', 'scrim-color', 'color'),
  sheet('dragHandleColor', 'Drag handle color', 'drag-handle-color', 'color'),
  sheet('dividerColor', 'Divider color', 'divider-color', 'color'),
  sheet('iconColor', 'Icon color', 'icon-color', 'color'),
  sheet('width', 'Width', 'width', 'affine'),
  sheet('minWidth', 'Minimum width', 'min-width', 'affine'),
  sheet('maxWidth', 'Maximum width', 'max-width', 'affine'),
  sheet('height', 'Height', 'height', 'affine'),
  sheet('minHeight', 'Minimum height', 'min-height', 'affine'),
  sheet('maxHeight', 'Maximum height', 'max-height', 'affine'),
  sheet('detachedMargin', 'Detached margin', 'detached-margin', 'length'),
  sheet('contentPaddingInline', 'Content inline padding', 'content-padding-inline', 'length'),
]);
const side = (name, label, suffix, kind) => appearanceField('side-sheet', name, label, suffix, kind);
export const SIDE_SHEET_APPEARANCE_FIELDS = Object.freeze([
  side('containerColor', 'Container color', 'container-color', 'color'),
  side('containerShape', 'Container corners', 'container-shape', 'sheetShape'),
  side('headlineColor', 'Headline color', 'headline-color', 'color'),
  side('contentColor', 'Content color', 'content-color', 'color'),
  side('scrimColor', 'Scrim color', 'scrim-color', 'color'),
  side('dividerColor', 'Divider color', 'divider-color', 'color'),
  side('iconColor', 'Icon color', 'icon-color', 'color'),
  side('width', 'Width', 'width', 'affine'),
  side('maxWidth', 'Maximum width', 'max-width', 'affine'),
]);
/** The source's ::part names; each has a typed native part appearance (AWCModalPartAppearance). */
export const DIALOG_PARTS = Object.freeze(['scrim', 'container', 'header', 'icon', 'headline', 'content', 'divider', 'actions', 'cancel-button', 'ok-button', 'close-button']);
export const BOTTOM_SHEET_PARTS = Object.freeze(['scrim', 'container', 'drag-handle', 'drag-handle-indicator', 'header', 'headline', 'close', 'divider-top', 'divider-bottom', 'content', 'actions']);
export const SIDE_SHEET_PARTS = Object.freeze(['scrim', 'container', 'header', 'headline', 'close', 'divider-top', 'divider-bottom', 'content', 'actions']);
/** Native part enum cases (Swift `AWCDialogPart.cancelButton`, Kotlin `AWCDialogPart.CancelButton`). */
export const partCase = (part, platform) => {
  const camel = part.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  return platform === 'swift' ? camel : camel[0].toUpperCase() + camel.slice(1);
};

const dialogProfile = appearanceProfile(DIALOG_APPEARANCE_FIELDS, 'INVALID_DIALOG_APPEARANCE', 'Dialog');
const bottomProfile = appearanceProfile(BOTTOM_SHEET_APPEARANCE_FIELDS, 'INVALID_BOTTOM_SHEET_APPEARANCE', 'Bottom Sheet', { shapeType: 'AWCBottomSheetShape' });
const sideProfile = appearanceProfile(SIDE_SHEET_APPEARANCE_FIELDS, 'INVALID_SIDE_SHEET_APPEARANCE', 'Side Sheet', { shapeType: 'AWCSideSheetShape' });
export const normalizeDialogAppearance = value => dialogProfile.normalize(value);
export const dialogAppearanceCSS = value => dialogProfile.css(value);
export const parseDialogAppearanceInput = (name, raw) => dialogProfile.parseInput(name, raw);
export const formatDialogAppearanceInput = (name, value) => dialogProfile.formatInput(name, value);
export const dialogAppearanceNativeValue = (name, value, platform) => dialogProfile.nativeValue(name, value, platform);
export const normalizeBottomSheetAppearance = value => bottomProfile.normalize(value);
export const bottomSheetAppearanceCSS = value => bottomProfile.css(value);
export const parseBottomSheetAppearanceInput = (name, raw) => bottomProfile.parseInput(name, raw);
export const formatBottomSheetAppearanceInput = (name, value) => bottomProfile.formatInput(name, value);
export const bottomSheetAppearanceNativeValue = (name, value, platform) => bottomProfile.nativeValue(name, value, platform);
export const normalizeSideSheetAppearance = value => sideProfile.normalize(value);
export const sideSheetAppearanceCSS = value => sideProfile.css(value);
export const parseSideSheetAppearanceInput = (name, raw) => sideProfile.parseInput(name, raw);
export const formatSideSheetAppearanceInput = (name, value) => sideProfile.formatInput(name, value);
export const sideSheetAppearanceNativeValue = (name, value, platform) => sideProfile.nativeValue(name, value, platform);
