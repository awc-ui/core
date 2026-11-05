import { appearanceField, appearanceProfile } from './accordion-appearance.js';

// md-stepper and md-step in the Laboratory: their typed hooks (the 22 --md-step-* hooks, which a stepper passes on to every
// step, plus --md-stepper-gap; field order follows the native initializers AWCStepperAppearance), the retained property
// updates (every source property) and md-stepper's methods next(), prev(), goTo(index), reset().
const st = (name, label, suffix, kind) => appearanceField('step', name, label, suffix, kind);
export const STEP_APPEARANCE_FIELDS = Object.freeze([
  st('indicatorSize', 'Indicator size', 'indicator-size', 'length'), st('indicatorRing', 'Indicator ring', 'indicator-ring', 'length'),
  st('indicatorColor', 'Pending indicator color', 'indicator-color', 'color'), st('indicatorText', 'Pending indicator text color', 'indicator-text', 'color'),
  st('activeColor', 'Active indicator color', 'active-color', 'color'), st('activeText', 'Active indicator text color', 'active-text', 'color'),
  st('activeHaloColor', 'Active halo color', 'active-halo-color', 'color'), st('completedColor', 'Completed indicator color', 'completed-color', 'color'),
  st('completedText', 'Completed indicator text color', 'completed-text', 'color'), st('errorColor', 'Error color', 'error-color', 'color'),
  st('errorText', 'Error indicator text color', 'error-text', 'color'), st('connectorColor', 'Connector color', 'connector-color', 'color'),
  st('connectorFilledColor', 'Filled connector color', 'connector-filled-color', 'color'), st('connectorThickness', 'Connector thickness', 'connector-thickness', 'length'),
  st('labelColor', 'Label color', 'label-color', 'color'), st('labelActiveColor', 'Active label color', 'label-active-color', 'color'),
  st('descriptionColor', 'Description color', 'description-color', 'color'), st('stateLayerColor', 'State layer color', 'state-layer-color', 'color'),
  st('panelPaddingBlockStart', 'Panel top padding', 'panel-padding-block-start', 'length'),
  st('connectorDuration', 'Connector fill duration', 'connector-duration', 'duration'), st('expandDuration', 'Panel expand duration', 'expand-duration', 'duration'),
  st('collapseDuration', 'Panel collapse duration', 'collapse-duration', 'duration'),
]);
// The Swift initializer order: gap follows panelPaddingBlockStart, the durations come last.
const GAP = appearanceField('stepper', 'gap', 'Vertical step gap', 'gap', 'length');
export const STEPPER_APPEARANCE_FIELDS = Object.freeze(STEP_APPEARANCE_FIELDS.flatMap(f => f.name === 'panelPaddingBlockStart' ? [f, GAP] : [f]));
export const stepperAppearance = Object.freeze({ ...appearanceProfile(STEPPER_APPEARANCE_FIELDS, 'INVALID_STEPPER_APPEARANCE', 'Stepper'), fields: STEPPER_APPEARANCE_FIELDS });
export const stepAppearance = Object.freeze({ ...appearanceProfile(STEP_APPEARANCE_FIELDS, 'INVALID_STEP_APPEARANCE', 'Step'), fields: STEP_APPEARANCE_FIELDS });
const STEP_GROUPS = [['Indicator', ['indicatorSize', 'indicatorRing', 'indicatorColor', 'indicatorText']],
  ['Active', ['activeColor', 'activeText', 'activeHaloColor', 'labelActiveColor']], ['Completed and error', ['completedColor', 'completedText', 'errorColor', 'errorText']],
  ['Connector', ['connectorColor', 'connectorFilledColor', 'connectorThickness', 'connectorDuration']], ['Text', ['labelColor', 'descriptionColor', 'stateLayerColor']],
  ['Panel', ['panelPaddingBlockStart', 'expandDuration', 'collapseDuration']]];
export const STEP_APPEARANCE_GROUPS = Object.freeze(STEP_GROUPS);
export const STEPPER_APPEARANCE_GROUPS = Object.freeze([...STEP_GROUPS.slice(0, -1), ['Panel and layout', ['panelPaddingBlockStart', 'expandDuration', 'collapseDuration', 'gap']]]);

// ---- retained property updates (every source property) --------------------------------------------------------------
const E = values => ({ enum: values });
const DENSITY = E([0, -1, -2, -3, -4]);
const S = 'string', N = 'number', B = 'boolean', I = 'index';
export const STEPPER_PROPERTY_TYPES = Object.freeze({
  'md-stepper': { orientation: E(['horizontal', 'vertical']), indicator: E(['numbered', 'dot']), variant: E(['default', 'mobile']), mode: E(['linear', 'non-linear']),
    active: I, autoComplete: B, nav: B, readonly: B, nextDisabled: B, loading: B, lazy: B, label: S, stepWord: S, ofWord: S, completedWord: S, currentWord: S,
    errorWord: S, optionalWord: S, nextLabel: S, backLabel: S, finishLabel: S, density: DENSITY },
  'md-step': { label: S, description: S, completed: B, active: B, error: B, errorText: S, disabled: B, optional: B, editable: B, icon: S, completedIcon: S,
    errorIcon: S, accessibleName: S, hideActions: B, density: DENSITY },
});
export const STEPPER_UPDATE_PROPERTIES = Object.freeze(Object.fromEntries(Object.entries(STEPPER_PROPERTY_TYPES).map(([tag, types]) => [tag, Object.freeze(Object.keys(types))])));
const bytes = value => new TextEncoder().encode(value).length;
export function validStepperUpdate(tag, key, value) {
  const type = STEPPER_PROPERTY_TYPES[tag]?.[key];
  if (type === undefined) return false;
  if (type.enum) return type.enum.includes(value);
  switch (type) {
    case B: return typeof value === 'boolean';
    case N: return typeof value === 'number' && Number.isFinite(value);
    case I: return Number.isInteger(value) && value >= 0 && value <= 1000;
    case S: return typeof value === 'string' && bytes(value) <= 4096;
    default: return false;
  }
}

// ---- methods with results -------------------------------------------------------------------------------------------
export const STEPPER_METHODS = Object.freeze({ 'md-stepper': ['next', 'prev', 'goTo', 'reset'] });
export const nativeStepperMethod = (tag, method) => Boolean(STEPPER_METHODS[tag]?.includes(method));
/** goTo(index) takes one step index; next(), prev() and reset() take none. */
export function stepperMethodArguments(tag, method, args) {
  const invalid = message => Object.assign(new Error(message), { code: 'INVALID_METHOD' });
  if (method === 'goTo') {
    if (args.length !== 1 || !Number.isInteger(args[0]) || args[0] < 0 || args[0] > 1000) throw invalid('goTo requires one step index (an integer from 0).');
    return [args[0]];
  }
  if (args.length) throw invalid(`${method} requires no arguments.`);
  return [];
}
