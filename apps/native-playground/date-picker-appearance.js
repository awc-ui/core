import { appearanceField, appearanceProfile } from './accordion-appearance.js';

// md-date-picker: the 40 source hooks as a native hook map (AWCDatePickerAppearance keeps CSS text), the retained property
// updates and the methods (AWCDatePickerController).
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const quote = (text, platform) => JSON.stringify(text).replace(platform === 'kotlin' ? /\$/g : /(?!)/g, '\\$');
const utf8 = value => new TextEncoder().encode(value).length;

const DP_KINDS = {
  color: ['action-color', 'container-color', 'day-color', 'day-outline-color', 'day-outside-color', 'day-selected-bg', 'day-selected-color', 'field-color',
    'field-focus-color', 'field-supporting-color', 'field-text-color', 'header-color', 'headline-color', 'icon-color', 'label-color', 'menu-color',
    'scrim-color', 'supporting-color', 'today-outline-color', 'weekday-color'],
  length: ['container-shape', 'day-selected-shape', 'day-today-shape', 'docked-panel-width', 'field-filled-pill', 'icon-size', 'panel-max-block-size',
    'panel-width', 'trigger-max-width', 'year-block-size', 'year-grid-gap', 'year-grid-padding-inline', 'year-grid-viewport-block-size', 'year-inline-size'],
  duration: ['calendar-bloom-duration', 'grid-slide-duration', 'panel-bloom-out-duration', 'selection-bloom-duration', 'selection-bloom-out-duration'],
  easing: ['selection-bloom-easing'],
};
const camel = hook => hook.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
const words = hook => hook.replace(/-/g, ' ').replace(/\bbg\b/, 'background').replace(/^./, c => c.toUpperCase());
const EASING_HINT = 'cubic-bezier(x1, y1, x2, y2) with x1 and x2 from 0 to 1 (the curve the menus, the year view, the docked panel and the day grid bloom in with).';
export const DATE_PICKER_APPEARANCE_FIELDS = Object.freeze(Object.entries(DP_KINDS).flatMap(([kind, hooks]) => hooks.map(hook =>
  kind === 'easing' ? Object.freeze({ name: camel(hook), label: words(hook), cssProperty: `--md-date-picker-${hook}`, kind: 'easing', hint: EASING_HINT })
    : appearanceField('date-picker', camel(hook), words(hook), hook, kind)))
  .sort((a, b) => a.cssProperty.localeCompare(b.cssProperty)));
/** The hook name (without the --md-date-picker- prefix) of a field: the key of AWCDatePickerAppearance's hook map. */
export const datePickerHook = name => DATE_PICKER_APPEARANCE_FIELDS.find(f => f.name === name)?.cssProperty.slice('--md-date-picker-'.length);
const DP_CODE = 'INVALID_DATE_PICKER_APPEARANCE';
const dpInvalid = message => Object.assign(new Error(message), { code: DP_CODE });
const dpFields = new Map(DATE_PICKER_APPEARANCE_FIELDS.map(f => [f.name, f]));
const dpProfiles = new Map(DATE_PICKER_APPEARANCE_FIELDS.filter(f => f.kind !== 'easing').map(f => [f.name, appearanceProfile([f], DP_CODE, 'Date Picker')]));
const NUM = '[+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:e[+-]?\\d+)?';
const BEZIER = new RegExp(`^cubic-bezier\\(\\s*(${NUM})\\s*,\\s*(${NUM})\\s*,\\s*(${NUM})\\s*,\\s*(${NUM})\\s*\\)$`, 'i');
/** One hook as canonical CSS text (the native hook map stores what the stylesheet would read). */
function dpText(name, raw) {
  const f = dpFields.get(name);
  if (!f) throw dpInvalid(`Unknown Date Picker appearance field ${String(name)}.`);
  if (typeof raw !== 'string' || utf8(raw) > 1024) throw dpInvalid(`${f.label} must be CSS text.`);
  const text = raw.trim();
  if (f.kind === 'easing') {
    const m = BEZIER.exec(text), v = m ? m.slice(1).map(Number) : [];
    if (!m || !v.every(Number.isFinite) || v[0] < 0 || v[0] > 1 || v[2] < 0 || v[2] > 1) throw dpInvalid(`${f.label} must be cubic-bezier(x1, y1, x2, y2) with x1 and x2 from 0 to 1.`);
    return `cubic-bezier(${v.join(', ')})`;
  }
  const p = dpProfiles.get(name);
  return p.formatInput(name, p.parseInput(name, text));
}
function dpNormalize(value) {
  if (value === undefined) return {};
  if (!plain(value) || Reflect.ownKeys(value).some(key => !dpFields.has(key))) throw dpInvalid(`Use a plain object containing only the ${DATE_PICKER_APPEARANCE_FIELDS.length} Date Picker appearance fields.`);
  for (const key of Reflect.ownKeys(value)) if (!Object.hasOwn(Object.getOwnPropertyDescriptor(value, key), 'value')) throw dpInvalid('Appearance fields must contain data values.');
  return Object.fromEntries(DATE_PICKER_APPEARANCE_FIELDS.filter(f => Object.hasOwn(value, f.name)).map(f => [f.name, dpText(f.name, value[f.name])]));
}
export const datePickerAppearance = Object.freeze({
  fields: DATE_PICKER_APPEARANCE_FIELDS,
  /** AWCDatePickerAppearance is a hook map: native snippets write `.init(["day-selected-bg": "#6750A4"])`. */
  hookPrefix: '--md-date-picker-',
  normalize: dpNormalize,
  css: value => Object.fromEntries(Object.entries(dpNormalize(value)).map(([name, text]) => [dpFields.get(name).cssProperty, text])),
  parseInput: (name, raw) => dpText(name, String(raw ?? '')),
  formatInput: (name, value) => value === undefined ? '' : dpText(name, value),
  nativeValue: (name, value, platform) => dpFields.has(name) ? quote(value, platform) : undefined,
});

// ---- retained property updates: every source property but `isDateDisabled` (a function: native API only) ----
const enumOf = values => value => values.includes(value);
const bool = value => typeof value === 'boolean';
const text = value => typeof value === 'string' && utf8(value) <= 4096;
export const DATE_PICKER_UPDATE_PROPERTIES = Object.freeze(['valueMissingLabel', 'reserveSupportingSpace', 'variant', 'value', 'label', 'placeholder', 'min', 'max', 'open',
  'disabled', 'required', 'clearable', 'clearLabel', 'error', 'errorText', 'supportingText', 'locale', 'dateSeparator', 'fieldVariant', 'firstDayOfWeek', 'headline',
  'cancelLabel', 'okLabel', 'selectDateLabel', 'enterDatesLabel', 'invalidDateLabel', 'previousMonthLabel', 'nextMonthLabel', 'previousYearLabel', 'nextYearLabel',
  'chooseMonthLabel', 'chooseYearLabel', 'chooseMonthYearLabel', 'chooseMonthAndYearLabel', 'toggleCalendarLabel', 'toggleTextLabel', 'openCalendarLabel',
  'closeCalendarLabel', 'calendarIcon', 'yearGridLabel', 'scrimDismissible', 'outsideClickDismissible', 'commitOnSelect', 'name', 'density']);
const DP_RULES = { variant: enumOf(['modal', 'modal-input', 'docked']), fieldVariant: enumOf(['outlined', 'filled']), density: enumOf([0, -1, -2, -3, -4]),
  reserveSupportingSpace: bool, open: bool, disabled: bool, required: bool, clearable: bool, error: bool, scrimDismissible: bool, outsideClickDismissible: bool, commitOnSelect: bool,
  // -1 follows the locale; 0 (Sunday) … 6 (Saturday).
  firstDayOfWeek: value => Number.isInteger(value) && value >= -1 && value <= 6 };
export const DATE_PICKER_UPDATES = Object.freeze({ 'md-date-picker': DATE_PICKER_UPDATE_PROPERTIES });
export const DATE_PICKER_UPDATE_LABELS = Object.freeze({ 'md-date-picker': 'Date Picker' });
export function validDatePickerUpdate(key, value) {
  const rule = DP_RULES[key];
  return rule ? rule(value) : text(value);
}

// ---- methods: synchronous calls on the mounted picker (AWCDatePickerController) ----
export const DATE_PICKER_ITEM_METHODS = Object.freeze(['show', 'close', 'clear', 'focusInput']);
export const DATE_PICKER_VALIDITY_METHODS = Object.freeze(['checkValidity', 'reportValidity', 'getValidity', 'setCustomValidity']);
