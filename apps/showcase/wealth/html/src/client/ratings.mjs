/**
 * `md-rating`'s value label, which the document cannot carry.
 *
 * WHY THIS EXISTS. `getLabel` is a FUNCTION prop: it has no attribute form, and
 * it drives both the visible value label and the control's `aria-valuetext`.
 * Left unset, the component falls back to its own English defaults — "Empty",
 * "1 Star", "2 Stars" — so a build that only emits HTML shipped an untranslated
 * control, and shipped it in Romanian and Arabic too. Measured against the React
 * build on the same screen: `0 of 5` there, `Empty` here.
 *
 * It is the same shape of gap as the proposal builder's transfer list — a prop
 * whose value is not expressible as a string — and it is fixed the same way: the
 * markup carries a marker, and this resolves the real thing at runtime.
 *
 * THE WORDING IS THE REACT BUILD'S, from the same dictionary key, so the two
 * cannot drift: `wealth.common.of` with the value and the maximum.
 *
 * The locale comes from `<html lang>` rather than the dock's state, because this
 * build routes locale through the URL — the document's own language is the
 * authority here, and the dock is told as much by `data-locale-route`.
 */

import { createTranslator } from '@awc-ui/showcase-kit/i18n';

const LOCALES = ['en', 'ro', 'ar'];

export function enhanceRatings(root = document) {
  const ratings = [...root.querySelectorAll('md-rating[data-rating]')].filter(
    (el) => !el.hasAttribute('data-bound'),
  );
  if (ratings.length === 0) return;

  const lang = document.documentElement.lang;
  const t = createTranslator(LOCALES.includes(lang) ? lang : 'en');

  for (const rating of ratings) {
    rating.setAttribute('data-bound', '');
    // `max` is on the element, so the label follows a control that changes its
    // scale rather than assuming five.
    const max = Number(rating.getAttribute('max')) || 5;
    rating.getLabel = (value) =>
      t.t('wealth.common.of', { count: t.formatNumber(value), total: max });
  }
}
