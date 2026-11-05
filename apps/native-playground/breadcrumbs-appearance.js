import { appearanceField, appearanceProfile } from './accordion-appearance.js';

// md-breadcrumbs / md-breadcrumb-item typed hooks: the four trail hooks (--md-breadcrumbs-*) and the eight crumb hooks
// (--md-breadcrumb-item-*), which a trail passes down to its crumbs. Field order follows the native initializer
// (Swift requires labelled arguments in order). Lengths in px (points on SwiftUI, dp on Android); the stagger in ms;
// itemPadding is the CSS padding shorthand (one to four px values).
const trail = (name, label, suffix, kind) => appearanceField('breadcrumbs', name, label, suffix, kind);
const crumb = (name, label, suffix, kind) => appearanceField('breadcrumb-item', name, label, suffix, kind);
export const BREADCRUMB_ITEM_APPEARANCE_FIELDS = Object.freeze([
  crumb('linkColor', 'Link color', 'link-color', 'color'), crumb('currentColor', 'Current page color', 'current-color', 'color'),
  crumb('currentBackground', 'Current page background', 'current-bg', 'color'), crumb('disabledColor', 'Disabled color', 'disabled-color', 'color'),
  crumb('hoverColor', 'Hover color', 'hover-color', 'color'), crumb('stateLayerColor', 'State layer color', 'state-layer-color', 'color'),
  crumb('itemGap', 'Icon gap', 'gap', 'length'), crumb('itemPadding', 'Crumb padding', 'padding', 'insets'),
]);
export const BREADCRUMBS_APPEARANCE_FIELDS = Object.freeze([
  trail('gap', 'Gap between crumbs', 'gap', 'length'), trail('separatorColor', 'Separator color', 'separator-color', 'color'),
  trail('textColor', 'Text color', 'text-color', 'color'), trail('stagger', 'Entrance stagger', 'stagger', 'duration'),
  ...BREADCRUMB_ITEM_APPEARANCE_FIELDS,
]);
const double = value => { const text = String(value); return /[.e]/i.test(text) ? text : `${text}.0`; };
/** itemPadding is a list on both platforms: [top, right, bottom, left] / listOf(top, right, bottom, left). */
function profile(fields, code, label) {
  const base = appearanceProfile(fields, code, label);
  return Object.freeze({
    fields, normalize: base.normalize.bind(base), css: base.css.bind(base), parseInput: base.parseInput.bind(base), formatInput: base.formatInput.bind(base),
    nativeValue(name, value, platform) {
      if (name !== 'itemPadding') return base.nativeValue(name, value, platform);
      const items = ['top', 'right', 'bottom', 'left'].map(edge => double(value[edge]));
      return platform === 'swift' ? `[${items.join(', ')}]` : `listOf(${items.join(', ')})`;
    },
  });
}
export const breadcrumbsAppearance = profile(BREADCRUMBS_APPEARANCE_FIELDS, 'INVALID_BREADCRUMBS_APPEARANCE', 'Breadcrumbs');
export const breadcrumbItemAppearance = profile(BREADCRUMB_ITEM_APPEARANCE_FIELDS, 'INVALID_BREADCRUMB_ITEM_APPEARANCE', 'Breadcrumb Item');
