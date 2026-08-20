/**
 * Shared option model + reader for `md-select` / `md-multi-select`.
 *
 * Both components accept options two ways (decided by the consumer):
 *   1. Declarative slotted `<md-select-option>` children (primary API —
 *      framework-friendly, supports rich labels + per-option icons).
 *   2. A programmatic `options` array prop (data-driven lists).
 *
 * `collectOptions()` normalises either source into a single flat
 * `SelectOptionData[]` the pickers render into `md-menu-item`s. When
 * slotted children are present they take precedence; otherwise the
 * array prop is used. This keeps the result predictable (no silent
 * duplication when a consumer accidentally supplies both).
 */

/** Normalised option the pickers render. */
export interface SelectOptionData {
  /** Stable identifier — emitted in the picker `value` and used for matching. */
  value: string;
  /** Visible label rendered in the menu, chips, and the trigger text. */
  label: string;
  /** Disabled options stay visible but cannot be selected. */
  disabled: boolean;
  /** Optional Material Symbols leading-icon glyph. */
  icon?: string;
  /** Optional CSS colour applied to the leading icon (e.g. a status/swatch hue).
   *  Any CSS `<color>` — hex, `rgb()`, or a theme token like
   *  `var(--md-sys-color-primary)`. Ignored when the option has no `icon`, and
   *  not carried on the virtualized (WASM) path — huge datasets fall back to the
   *  `--md-{multi-}select-option-icon-color` token. */
  iconColor?: string;
  /** Optional secondary text rendered under the label in the menu. */
  supportingText?: string;
  /** Initial-selected hint carried by the option element / array entry. */
  selected?: boolean;
}

/** Programmatic option entry accepted by the `options` array prop. */
export interface SelectOptionInit {
  value: string;
  label?: string;
  disabled?: boolean;
  icon?: string;
  iconColor?: string;
  supportingText?: string;
  selected?: boolean;
}

/** Element-side shape of a slotted `<md-select-option>`. */
interface SelectOptionEl extends HTMLElement {
  value?: string;
  label?: string;
  disabled?: boolean;
  icon?: string;
  iconColor?: string;
  supportingText?: string;
  selected?: boolean;
}

function fromElement(el: SelectOptionEl): SelectOptionData {
  const label = (el.label || el.getAttribute('label') || el.textContent || '').trim();
  return {
    value: el.value ?? el.getAttribute('value') ?? '',
    label,
    disabled: el.disabled ?? el.hasAttribute('disabled'),
    icon: el.icon || el.getAttribute('icon') || undefined,
    iconColor: el.iconColor || el.getAttribute('icon-color') || undefined,
    supportingText:
      el.supportingText || el.getAttribute('supporting-text') || undefined,
    selected: el.selected ?? el.hasAttribute('selected'),
  };
}

function fromInit(o: SelectOptionInit): SelectOptionData {
  return {
    value: o.value,
    label: o.label ?? o.value,
    disabled: !!o.disabled,
    icon: o.icon,
    iconColor: o.iconColor,
    supportingText: o.supportingText,
    selected: !!o.selected,
  };
}

/**
 * A dataset given as a row factory rather than a materialised array, so very
 * large option sets (tens of millions) can be streamed into the WASM store
 * without ever holding the whole array in JS at once.
 */
export interface OptionRowSource {
  count: number;
  getRow: (index: number) => SelectOptionInit;
}

/**
 * Type guard distinguishing a row factory from a materialised array.
 * (`Array.isArray` doesn't narrow a `readonly[]` union, so this is explicit.)
 */
export function isRowSource(
  source: ReadonlyArray<SelectOptionInit> | OptionRowSource,
): source is OptionRowSource {
  return !Array.isArray(source);
}

/** Materialise a row source (array or factory) into a plain array. */
export function rowsToArray(
  source: ReadonlyArray<SelectOptionInit> | OptionRowSource,
): SelectOptionInit[] {
  if (!isRowSource(source)) return source.slice();
  const out = new Array<SelectOptionInit>(source.count);
  for (let i = 0; i < source.count; i++) out[i] = source.getRow(i);
  return out;
}

/** Normalise a programmatic `options` array to `SelectOptionData[]`. */
export function normalizeInits(inits: ReadonlyArray<SelectOptionInit>): SelectOptionData[] {
  return inits.map(fromInit);
}

/**
 * Read the option set for a picker host. Slotted `<md-select-option>`
 * children win when present; otherwise the `options` array is used.
 */
export function collectOptions(
  host: HTMLElement,
  optionsProp?: SelectOptionInit[],
): SelectOptionData[] {
  // Direct light-DOM children only (avoids `:scope`, which mock-doc/older
  // engines don't support, and avoids reaching into nested option groups).
  const slotted = Array.from(host.children).filter(
    (c) => c.tagName.toLowerCase() === 'md-select-option',
  ) as SelectOptionEl[];

  if (slotted.length > 0) {
    return slotted.map(fromElement);
  }
  return (optionsProp ?? []).map(fromInit);
}

/** Label for a single value, or '' if not found. */
export function labelFor(options: SelectOptionData[], value: string): string {
  return options.find((o) => o.value === value)?.label ?? '';
}
