import { appearanceField, appearanceProfile } from './accordion-appearance.js';

// The twenty-five md-avatar source hooks: the eleven documented ones and the fourteen tonal
// palette hooks --md-avatar-palette-{1…7}-container/label (implemented in md-avatar.css; the CEM
// omits them). Field order follows the native initializers (Swift requires labelled arguments in order).
const lengthHint = 'px, em or rem; additive calc(). em resolves against the avatar font size (16 by default).';
const field = (name, label, suffix, kind) => {
  const value = appearanceField('avatar', name, label, suffix, kind);
  return kind === 'affine' ? Object.freeze({ ...value, hint: lengthHint }) : value;
};
const PALETTE = [1, 2, 3, 4, 5, 6, 7].flatMap(n => [
  field(`palette${n}Container`, `Palette ${n} container`, `palette-${n}-container`, 'color'),
  field(`palette${n}Label`, `Palette ${n} label`, `palette-${n}-label`, 'color'),
]);
export const AVATAR_APPEARANCE_FIELDS = Object.freeze([
  field('size', 'Size', 'size', 'affine'),
  field('containerColor', 'Container color', 'container-color', 'color'),
  field('containerShape', 'Container corners', 'container-shape', 'corners'),
  field('labelColor', 'Label color', 'label-color', 'color'),
  field('labelFontFamily', 'Label font family', 'label-font-family', 'font'),
  field('labelFontSize', 'Label font size', 'label-font-size', 'affine'),
  field('labelFontWeight', 'Label font weight', 'label-font-weight', 'weight'),
  field('labelLetterSpacing', 'Label letter spacing', 'label-letter-spacing', 'affine'),
  field('iconSize', 'Icon size', 'icon-size', 'affine'),
  field('outlineColor', 'Outline color', 'outline-color', 'color'),
  field('outlineWidth', 'Outline width', 'outline-width', 'affine'),
  ...PALETTE,
]);
/** The source's ::part names; each has typed native fields (AWCAvatarPartAppearance). */
export const AVATAR_PARTS = Object.freeze(['image', 'initials', 'icon']);
const CODE = 'INVALID_AVATAR_APPEARANCE';
const profile = appearanceProfile(AVATAR_APPEARANCE_FIELDS, CODE, 'Avatar');
const lengths = new Map(AVATAR_APPEARANCE_FIELDS.filter(f => f.kind === 'affine').map(f => [f.name, f.label]));
// Percentages need the avatar's containing block (size, icon size) or differ by property; ch needs the
// zero glyph's advance. Native lengths resolve px, em and rem exactly.
function exact(name, value) {
  if (lengths.has(name) && value && (value.fraction || value.ch)) throw Object.assign(new Error(`${lengths.get(name)}: use px, em or rem (percentages and ch are not supported natively).`), { code: CODE });
  return value;
}
export const normalizeAvatarAppearance = value => {
  const normalized = profile.normalize(value);
  for (const [name, item] of Object.entries(normalized)) exact(name, item);
  return normalized;
};
export const avatarAppearanceCSS = value => profile.css(normalizeAvatarAppearance(value));
export const parseAvatarAppearanceInput = (name, raw) => exact(name, profile.parseInput(name, raw));
export const formatAvatarAppearanceInput = (name, value) => profile.formatInput(name, value);
export const avatarAppearanceNativeValue = (name, value, platform) => profile.nativeValue(name, value, platform);
