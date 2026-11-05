// Plain text is useful for labels and prose. Structural children and action/icon
// slots must retain their component composition instead of becoming inert spans.
const defaultText = new Set(['md-accordion-item', 'md-bottom-sheet', 'md-breadcrumb-item', 'md-button', 'md-card', 'md-chip', 'md-dialog', 'md-fab-menu-item', 'md-list-item', 'md-segmented-button', 'md-select-option', 'md-side-sheet', 'md-snackbar', 'md-split-button', 'md-step', 'md-tab-panel', 'md-table-cell', 'md-table-sort-label']);
const namedText = new Set(['headline', 'subtitle', 'overline', 'supporting-text', 'trailing-supporting-text', 'empty', 'center', 'subhead', 'content', 'expanded', 'expanded-content']);

export const defaultSlotMaskingProperty = tag => ({
  'md-segmented-button': 'label', 'md-fab-menu-item': 'label', 'md-select-option': 'label',
  'md-chip': 'label', 'md-list-item': 'headline', 'md-snackbar': 'message',
})[tag];

export function editableTextSlot(component, name) {
  if (!(component.slots || []).some(slot => slot.name === name)) return false;
  if (!name) return defaultText.has(component.tag);
  if (namedText.has(name)) return true;
  return /^md-(?:area|bar|line|pie)-chart$/.test(component.tag) && ['header', 'footer'].includes(name);
}

export function nativeTextSlot(component, name, platform) {
  if (!editableTextSlot(component, name)) return false;
  const support = component.support?.[platform];
  return !!support && support.status !== 'missing-adapter' && (support.slots || []).includes(name);
}

export const BUTTON_CONTENT_SLOTS = Object.freeze(['leading-icon', 'trailing-icon', 'loader']);
export const ICON_BUTTON_CONTENT_SLOTS = Object.freeze(['', 'selected']);
export const BADGE_CONTENT_SLOTS = Object.freeze(['icon']);
export const FAB_MENU_ITEM_CONTENT_SLOTS = Object.freeze(['icon']);
export const FAB_CONTENT_SLOTS = Object.freeze(['icon']);
export const SEGMENTED_BUTTON_CONTENT_SLOTS = Object.freeze(['icon']);
const noContentSlots = Object.freeze([]);
export const componentContentSlots = tag => tag === 'md-badge' ? BADGE_CONTENT_SLOTS : tag === 'md-fab-menu-item' ? FAB_MENU_ITEM_CONTENT_SLOTS : tag === 'md-segmented-button' ? SEGMENTED_BUTTON_CONTENT_SLOTS : tag === 'md-fab' ? FAB_CONTENT_SLOTS : tag === 'md-button' ? BUTTON_CONTENT_SLOTS : tag === 'md-icon-button' ? ICON_BUTTON_CONTENT_SLOTS : noContentSlots;

const slotError = message => Object.assign(new Error(message), { code: 'INVALID_SLOTS' });
const plainObject = value => value !== null && typeof value === 'object' && !Array.isArray(value)
  && [Object.prototype, null].includes(Object.getPrototypeOf(value));

/** Text remains literal. Typed slot content is a finite, non-executing vocabulary. */
export function normalizeSlotValue(name, value, tag) {
  if (typeof value === 'string') {
    if (new TextEncoder().encode(value).byteLength > 4096) throw slotError('Slot text is limited to 4096 UTF-8 bytes per slot.');
    return value;
  }
  const supported = tag === undefined ? [...BUTTON_CONTENT_SLOTS, ...ICON_BUTTON_CONTENT_SLOTS, ...FAB_CONTENT_SLOTS] : componentContentSlots(tag);
  if (!supported.includes(name) || !plainObject(value)) throw slotError('Use plain text or a supported button slot composition.');
  if (Reflect.ownKeys(value).some(key => !Object.hasOwn(Object.getOwnPropertyDescriptor(value, key), 'value'))) throw slotError('Slot compositions must contain data values.');
  if (value.kind === 'symbol' && Reflect.ownKeys(value).length === 2 &&
      typeof value.value === 'string' && /^[a-z][a-z0-9_]{0,79}$/.test(value.value)) {
    return { kind: 'symbol', value: value.value };
  }
  if (value.kind === 'progress' && name === 'loader' && Reflect.ownKeys(value).length === 1) return { kind: 'progress' };
  throw slotError('Choose a Material Symbol name or a progress indicator for the loader.');
}

/** The same authored element describes live slot content and copyable examples. */
export function buttonSlotElement(name, value, properties = {}) {
  return componentSlotElement('md-button', name, value, properties);
}

export function componentSlotElement(tag, name, value, properties = {}) {
  const normalized = normalizeSlotValue(name, value, tag);
  if (typeof normalized === 'string') return { tag: 'span', attributes: { slot: name }, text: normalized };
  if (normalized.kind === 'progress') return {
    tag: 'md-progress-indicator',
    attributes: { slot: name, variant: 'circular', indeterminate: '', size: '24', label: 'Loading',
      style: '--md-progress-indicator-active-indicator-color:currentColor' },
  };
  const base = ({ xs: 20, sm: 20, md: 24, lg: 32, xl: 40 })[properties.size] || 20;
  const icon = `var(--md-button-icon-size,max(${base / 2}px,calc(${base}px + var(--md-sys-density-scale,0) * ${base / 8}px)))`;
  const iconDimensions = ({ xs: [20, 16, 1], sm: [24, 18, 1], md: [24, 18, 1], lg: [32, 24, 2], xl: [40, 28, 3] })[properties.size] || [24, 18, 1];
  const [iconBase, iconFloor, iconStep] = iconDimensions;
  const fabDimensions = properties.label ? [24, 18] : ({ standard: [24, 18], medium: [28, 21], large: [36, 27] })[properties.size] || [24, 18];
  const size = tag === 'md-badge' ? 'var(--md-badge-icon-size,max(8px,calc(10px + var(--md-sys-density-scale,0) * 0.5px)))' : tag === 'md-fab-menu-item' ? 'var(--md-fab-menu-item-icon-size,max(16px,calc(20px + var(--md-sys-density-scale,0) * 1px)))' : tag === 'md-segmented-button' ? 'var(--md-segmented-button-icon-size,max(14px,calc(18px + var(--md-sys-density-scale,0) * 1px)))' : tag === 'md-fab' ? `var(--md-fab-icon-size,max(${fabDimensions[1]}px,calc(${fabDimensions[0]}px + var(--md-sys-density-scale,0) * 1px)))` : tag === 'md-icon-button' ? `var(--md-icon-button-icon-size,max(${iconFloor}px,calc(${iconBase}px + var(--md-sys-density-scale,0) * ${iconStep}px)))`
    : name === 'trailing-icon' ? `var(--md-button-trailing-icon-size,${icon})`
    : name === 'loader' ? `var(--md-button-loading-size,max(10px,calc(${icon} * 0.7)))` : icon;
  return { tag: 'span', attributes: { slot: name, class: 'material-symbols-outlined', 'aria-hidden': 'true',
    style: `font-family:var(--md-sys-icon-font-family,'Material Symbols Outlined');font-size:${size};width:${size};height:${size};font-weight:400;font-style:normal;line-height:1;letter-spacing:normal;text-transform:none;white-space:nowrap;direction:ltr;font-feature-settings:'liga';-webkit-font-smoothing:antialiased;display:inline-flex;align-items:center;justify-content:center` }, text: normalized.value };
}

export function nativeContentSlots(value, tag) {
  if (value === undefined) return {};
  const invalid = message => { throw slotError(message); };
  if (!plainObject(value) || Reflect.ownKeys(value).length > 32) invalid('Slots must be an object containing at most 32 entries.');
  let total = 0;
  const entries = Reflect.ownKeys(value).sort((a, b) => String(a).localeCompare(String(b))).map(name => {
    if (typeof name !== 'string' || name.length > 80) invalid('Slot names must contain at most 80 characters.');
    const descriptor = Object.getOwnPropertyDescriptor(value, name);
    if (!Object.hasOwn(descriptor, 'value')) invalid('Slot values must be data.');
    const content = normalizeSlotValue(name, descriptor.value, tag);
    const bytes = new TextEncoder().encode(typeof content === 'string' ? content : JSON.stringify(content)).byteLength;
    total += bytes;
    if (bytes > 4096 || total > 32768) invalid('Slot text is limited to 4096 UTF-8 bytes per slot and 32768 bytes per request.');
    return [name, content];
  });
  return { slots: Object.fromEntries(entries) };
}
