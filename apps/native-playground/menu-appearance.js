import { appearanceField, appearanceProfile } from './accordion-appearance.js';

// md-menu's public hooks: the six md-menu.css hooks plus the five md-menu-item.css hooks, which md-menu passes down to
// every row (custom properties inherit), all CSS lengths edited in px. The native types take the CSS text
// (`AWCMenuAppearance(itemHeight: "56px")`), so a length such as `50vh` written in code keeps the source unit; the
// Laboratory edits px values. `--md-menu-inline-surface-color` / `--md-menu-inline-fill-radius-end` belong to the
// internal inline-fill embedding (md-date-picker): they are not menu hooks here. Field order follows the native initializers.
const mn = (name, label, suffix) => appearanceField('menu', name, label, suffix, 'length');
export const MENU_APPEARANCE_FIELDS = Object.freeze([
  mn('minWidth', 'Minimum width', 'min-width'), mn('maxWidth', 'Maximum width', 'max-width'),
  mn('maxBlockSize', 'Maximum height', 'max-block-size'), mn('viewportMargin', 'Viewport margin', 'viewport-margin'),
  mn('groupGap', 'Group gap (cards)', 'group-gap'), mn('sectionGap', 'Section gap', 'section-gap'),
  mn('itemHeight', 'Item height', 'item-height'), mn('itemPaddingInline', 'Item inline padding', 'item-padding-inline'),
  mn('itemGap', 'Item gap', 'item-gap'), mn('itemIconSize', 'Item icon size', 'item-icon-size'), mn('itemCheckSize', 'Item check size', 'item-check-size'),
]);
const profile = appearanceProfile(MENU_APPEARANCE_FIELDS, 'INVALID_MENU_APPEARANCE', 'Menu');
const cssNumber = value => { const text = String(value); return /e/i.test(text) ? String(Number(value.toPrecision(15))) : text; };
const quote = (text, platform) => JSON.stringify(text).replace(platform === 'kotlin' ? /\$/g : /(?!)/g, '\\$');
export const menuAppearance = Object.freeze({
  fields: MENU_APPEARANCE_FIELDS,
  normalize: value => profile.normalize(value),
  css: value => profile.css(value),
  parseInput: (name, raw) => profile.parseInput(name, raw),
  formatInput: (name, value) => profile.formatInput(name, value),
  // The native hooks are CSS text: "56px".
  nativeValue: (name, value, platform) => MENU_APPEARANCE_FIELDS.some(f => f.name === name) ? quote(`${cssNumber(value)}px`, platform) : undefined,
});
