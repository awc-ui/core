/**
 * Row helpers shared by the two screens that sort a table in the browser.
 *
 * The holdings screen and the household's holdings tab render the same
 * `md-table-row`s from the same `getPositions()` records, and both let the
 * reader re-sort them after load. Written twice, the two comparators would
 * agree until the first time one of them was corrected — so they are written
 * once, here, and a fix reaches both.
 */

/**
 * One sort key off a row, as the type it was written as.
 *
 * Attribute names are lowercased by the parser, so `marketValueEur` was written
 * as `data-sort-marketvalueeur` and has to be looked up that way. Raw values,
 * never cell text: the cell shows "€1.2m" in English and "1,2 mln. €" in
 * Romanian, and sorting either of those sorts strings.
 */
export function readKey(row, column) {
  const raw = row.getAttribute(`data-sort-${column.toLowerCase()}`);
  if (raw === null) return '';
  const n = Number(raw);
  return raw !== '' && Number.isFinite(n) ? n : raw;
}

/**
 * The kit's `by()` comparator, mirrored rather than approximated: numbers
 * compare numerically, strings with `localeCompare('en')` over the UNTRANSLATED
 * value, and ties break on the row's `value` (the record id) so two rows with
 * the same figure come out in the same order in every framework build.
 */
export function sorted(rows, { column, order }) {
  const direction = order === 'asc' ? 1 : -1;
  return rows.slice().sort((a, b) => {
    const av = readKey(a, column);
    const bv = readKey(b, column);
    const tie = () =>
      String(a.getAttribute('value')).localeCompare(String(b.getAttribute('value')), 'en');
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * direction || tie();
    return String(av).localeCompare(String(bv), 'en') * direction || tie();
  });
}

/**
 * `{shown} of {total}` — written by the build in the page's own language, with
 * `%shown%` and `%total%` left as holes, and refilled in place from here. The
 * sentence is never assembled in JavaScript: word order differs by locale, and
 * Arabic is one of the three.
 */
export function fillCount(el, attribute, target, shown, total) {
  const template = el?.getAttribute(attribute);
  if (!template) return;
  const text = template.replace('%shown%', String(shown)).replace('%total%', String(total));
  if (target === 'textContent') el.textContent = text;
  else el.setAttribute(target, text);
}
