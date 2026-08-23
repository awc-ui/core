/**
 * The whole "framework" of the plain-HTML build: a tagged template that escapes
 * what it interpolates, and an attribute serialiser.
 *
 * The other five builds get escaping from their renderer. This one has no
 * renderer, so it needs the same guarantee written down once — and it genuinely
 * needs it: legal names, relationship-manager names and signal owners come out
 * of the fixture and go straight into markup. `html` escapes every
 * interpolation unless it is itself the result of `html`, which is exactly the
 * rule JSX and every other renderer here follows.
 *
 * `Safe` is that marker. Nesting is therefore free — a screen composes panels
 * that compose rows, and only the leaf strings are ever escaped, never
 * double-escaped on the way up.
 */

/** Markup that has already been escaped, or was authored as markup. */
class Safe {
  /** @param {string} value */
  constructor(value) {
    this.value = value;
  }
  toString() {
    return this.value;
  }
}

/** Wrap a string that is already markup. Use sparingly and never on fixture data. */
export const raw = (value) => new Safe(String(value ?? ''));

/**
 * The five characters that can break out of text or an attribute value.
 * `'` and `"` are both escaped so one function covers both positions.
 */
export function escape(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * `null`, `undefined` and `false` render as nothing, so `cond && html\`…\`` and
 * `maybe ?? null` both work in a template without printing "false" or "null".
 * Arrays flatten, which is what `rows.map(...)` produces.
 */
function render(value) {
  if (value === null || value === undefined || value === false || value === true) return '';
  if (value instanceof Safe) return value.value;
  if (Array.isArray(value)) return value.map(render).join('');
  return escape(value);
}

/** The tagged template. Returns `Safe`, so results compose. */
export function html(strings, ...values) {
  let out = strings[0];
  for (let i = 0; i < values.length; i += 1) out += render(values[i]) + strings[i + 1];
  return new Safe(out);
}

/**
 * Serialise an attribute map.
 *
 * `true` writes a bare attribute (`striped`), which is what the components
 * expect for their boolean props; `false`, `null` and `undefined` omit it
 * entirely rather than writing `="false"`, because Stencil parses the presence
 * of the attribute, not its value, for some of them. Numbers are stringified.
 *
 * Keys are written as given — the call sites use the real attribute names
 * (`column-template`, `sort-order`), not camelCase, because there is no
 * renderer here to convert them and a silently-ignored `columnTemplate` is the
 * hardest kind of bug to see.
 */
export function attrs(map) {
  const parts = [];
  for (const [key, value] of Object.entries(map ?? {})) {
    if (value === undefined || value === null || value === false || value === '') continue;
    if (value === true) {
      parts.push(key);
      continue;
    }
    parts.push(`${key}="${escape(value)}"`);
  }
  return parts.length ? raw(` ${parts.join(' ')}`) : raw('');
}

/** `style="…"` from a map, skipping empty values. Mirrors React's style object. */
export function style(map) {
  const parts = Object.entries(map ?? {})
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}:${v}`);
  return parts.length ? parts.join(';') : undefined;
}
