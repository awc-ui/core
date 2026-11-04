const color = (name, label, cssProperty) => ({ name, label, cssProperty, kind: 'color' });
const length = (name, label, cssProperty) => ({ name, label, cssProperty, kind: 'number', min: 0, max: 2400, step: 1 });

export const FAB_MENU_APPEARANCE_FIELDS = Object.freeze([
  color('itemContainerColor', 'Item container color', '--md-fab-menu-item-container-color'),
  color('itemLabelColor', 'Item label color', '--md-fab-menu-item-label-color'),
  length('itemGap', 'Item gap', '--md-fab-menu-item-gap'),
].map(Object.freeze));
export const FAB_MENU_ITEM_APPEARANCE_FIELDS = Object.freeze([
  color('containerColor', 'Container color', '--md-fab-menu-item-container-color'),
  color('labelColor', 'Label color', '--md-fab-menu-item-label-color'),
  color('iconColor', 'Icon color', '--md-fab-menu-item-icon-color'),
  length('iconSize', 'Icon size', '--md-fab-menu-item-icon-size'),
  length('cornerRadius', 'Corner radius', '--md-fab-menu-item-container-shape'),
].map(Object.freeze));

function profile(fields, code) {
  const byName = new Map(fields.map(field => [field.name, field]));
  const invalid = message => Object.assign(new Error(message), { code });
  const normalize = value => {
    if (value === undefined) return {};
    if (value === null || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw invalid('Appearance must be a plain object.');
    const result = {};
    for (const name of Reflect.ownKeys(value)) {
      const field = byName.get(name), descriptor = Object.getOwnPropertyDescriptor(value, name);
      if (!field || !Object.hasOwn(descriptor, 'value')) throw invalid('Appearance contains an unknown or accessor field.');
      const item = descriptor.value;
      if (field.kind === 'color') {
        if (typeof item !== 'string' || !/^#[\da-f]{6}$/i.test(item)) throw invalid(`${field.label} must be a #RRGGBB color.`);
        result[name] = item.toUpperCase();
      } else {
        if (typeof item !== 'number' || !Number.isFinite(item) || item < field.min || item > field.max) throw invalid(`${field.label} must be a finite number from ${field.min} to ${field.max}.`);
        result[name] = Object.is(item, -0) ? 0 : item;
      }
    }
    return result;
  };
  const css = value => {
    const normalized = normalize(value);
    return Object.fromEntries(fields.filter(field => Object.hasOwn(normalized, field.name)).map(field => [field.cssProperty, field.kind === 'color' ? normalized[field.name] : `${normalized[field.name]}px`]));
  };
  return [normalize, css];
}
export const [normalizeFabMenuAppearance, fabMenuAppearanceCSS] = profile(FAB_MENU_APPEARANCE_FIELDS, 'INVALID_FAB_MENU_APPEARANCE');
export const [normalizeFabMenuItemAppearance, fabMenuItemAppearanceCSS] = profile(FAB_MENU_ITEM_APPEARANCE_FIELDS, 'INVALID_FAB_MENU_ITEM_APPEARANCE');
