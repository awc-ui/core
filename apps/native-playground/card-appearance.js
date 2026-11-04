import { appearanceField, appearanceProfile } from './accordion-appearance.js';

// The fourteen md-card source hooks. Field order follows the native initializers
// (Swift requires labelled arguments in declaration order).
const field = (name, label, suffix, kind) => appearanceField('card', name, label, suffix, kind);
export const CARD_APPEARANCE_FIELDS = Object.freeze([
  field('containerColor', 'Container color', 'container-color', 'color'),
  field('containerShape', 'Container corners', 'container-shape', 'corners'),
  field('containerElevation', 'Elevation', 'container-elevation', 'shadow'),
  field('outlineColor', 'Outline color', 'outline-color', 'color'),
  field('outlineWidth', 'Outline width', 'outline-width', 'length'),
  field('stateLayerColor', 'State layer color', 'state-layer-color', 'color'),
  field('width', 'Width', 'width', 'affine'),
  field('minWidth', 'Minimum width', 'min-width', 'affine'),
  field('maxWidth', 'Maximum width', 'max-width', 'affine'),
  field('height', 'Height', 'height', 'affine'),
  field('minHeight', 'Minimum height', 'min-height', 'affine'),
  field('maxHeight', 'Maximum height', 'max-height', 'affine'),
  field('padding', 'Padding', 'padding', 'insets'),
  field('gap', 'Gap between content', 'gap', 'length'),
]);
const profile = appearanceProfile(CARD_APPEARANCE_FIELDS, 'INVALID_CARD_APPEARANCE', 'Card', { insetsType: 'AWCCardInsets', lengthType: 'AWCCardLength' });
export const normalizeCardAppearance = value => profile.normalize(value);
export const cardAppearanceCSS = value => profile.css(value);
export const parseCardAppearanceInput = (name, raw) => profile.parseInput(name, raw);
export const formatCardAppearanceInput = (name, value) => profile.formatInput(name, value);
export const cardAppearanceNativeValue = (name, value, platform) => profile.nativeValue(name, value, platform);
