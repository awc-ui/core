// Plain text is useful for labels and prose. Structural children and action/icon
// slots must retain their component composition instead of becoming inert spans.
const defaultText = new Set(['md-accordion-item', 'md-bottom-sheet', 'md-breadcrumb-item', 'md-button', 'md-card', 'md-chip', 'md-dialog', 'md-fab-menu-item', 'md-list-item', 'md-segmented-button', 'md-select-option', 'md-side-sheet', 'md-snackbar', 'md-split-button', 'md-step', 'md-tab-panel', 'md-table-cell', 'md-table-sort-label']);
const namedText = new Set(['headline', 'subtitle', 'overline', 'supporting-text', 'trailing-supporting-text', 'empty', 'center', 'subhead', 'content', 'expanded', 'expanded-content']);

export const defaultSlotMaskingProperty = tag => ({
  'md-segmented-button': 'label', 'md-fab-menu-item': 'label', 'md-select-option': 'label',
  'md-split-button': 'label', 'md-chip': 'label', 'md-list-item': 'headline', 'md-snackbar': 'message',
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

export function nativeContentSlots(value) {
  if (value === undefined) return {};
  const invalid = message => { const error = new Error(message); error.code = 'INVALID_SLOTS'; throw error; };
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length > 32) invalid('Slots must be an object containing at most 32 text entries.');
  let total = 0;
  const entries = Object.entries(value).sort(([a], [b]) => a.localeCompare(b));
  for (const [name, text] of entries) {
    if (name.length > 80 || typeof text !== 'string') invalid('Slot names must contain at most 80 characters and slot values must be text.');
    const bytes = new TextEncoder().encode(text).byteLength;
    total += bytes;
    if (bytes > 4096 || total > 32768) invalid('Slot text is limited to 4096 UTF-8 bytes per slot and 32768 bytes per request.');
  }
  return { slots: Object.fromEntries(entries) };
}
