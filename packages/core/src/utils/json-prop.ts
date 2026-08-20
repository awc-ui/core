/**
 * Array/object props that can also arrive as a JSON string.
 *
 * An attribute can only carry text, so a prop typed `Foo[]` gets no attribute
 * at all — in plain HTML the only way in is a script that assigns the property.
 * That is fine for an app and hostile for a page: every docs example, every
 * CMS-rendered template and every copy-paste snippet has to grow a script block
 * before it can show a single row.
 *
 * Widening the prop to `Foo[] | string` and parsing here gives both doors:
 *
 *     <md-select options='[{"value":"a","label":"Apple"}]'></md-select>   <!-- attribute -->
 *     el.options = [{ value: 'a', label: 'Apple' }];                      // property
 *
 * `md-organization-chart.nodes` established this contract; this is the shared
 * implementation of it.
 */

/** A prop that accepts its own array type or a JSON string of it. */
export type JsonArrayProp<T> = T[] | string | null | undefined;

/**
 * Coerce a JSON-or-array prop into an array.
 *
 * A malformed string degrades to `[]` and warns once per call site rather than
 * throwing: a typo in an authored attribute must not take the whole component
 * down, and a silent empty list with no explanation is just as bad.
 *
 * @param value the raw prop value
 * @param tag   component tag, used only in the warning
 * @param prop  prop name, used only in the warning
 */
export function parseJsonArrayProp<T>(
  value: JsonArrayProp<T>,
  tag: string,
  prop: string,
): T[] {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return [];

  const text = value.trim();
  if (!text) return [];

  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed as T[];
    // A single object is a plausible mistake for a list-shaped prop; accepting
    // it silently would hide the error, so treat it as empty and say why.
    console.warn(
      `[${tag}] \`${prop}\` expects a JSON array, got ${typeof parsed}. Ignoring.`,
    );
    return [];
  } catch {
    console.warn(`[${tag}] \`${prop}\` is not valid JSON. Ignoring:`, text);
    return [];
  }
}
