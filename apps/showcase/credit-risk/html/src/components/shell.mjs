/**
 * The frame every screen sits in: masthead, section nav, breadcrumb trail,
 * screen heading, and the dock.
 *
 * Not a single visible string is written here — the translator resolves all of
 * them, including the ones that look like constants (the brand name, the
 * base-currency note). The reporting date goes through `formatDate`, which is
 * pinned to `timeZone: 'UTC'`, so 2026-03-31 is 31 March in every locale and on
 * every machine that builds this.
 *
 * Every link is built with `localeHref`, so a reader in Romanian stays in
 * Romanian as they drill down. No client-routing interception is needed, unlike
 * the React build: this IS a document per route, so a nav click is supposed to
 * be a page load, and the current section is known while the file is being
 * written.
 */

import { BASE_CURRENCY, REPORTING_DATE, REPORTING_QUARTER } from '@awc-ui/showcase-kit/data';
import { attrs, html } from '../lib/html.mjs';
import { localeHref, route } from '../lib/i18n.mjs';
import { dock } from './dock.mjs';

/**
 * The section nav. The current section is `tonal` rather than `text`, so the
 * nav says where you are — without it three identical buttons give no feedback
 * at all when one of them is the page you are already on.
 */
function sectionNav(t, locale, here) {
  const sections = [
    { path: route.overview(), icon: 'dashboard', label: t('nav.overview') },
    // The overview owns `/` and would otherwise match every path.
    { path: route.watchlist(), icon: 'warning', label: t('nav.watchlist') },
    { path: route.stress(), icon: 'stacked_line_chart', label: t('nav.stress') },
  ];
  const isCurrent = (path) => (path === '/' ? here === '/' : here.startsWith(path));

  return html`<nav class="shell__nav"${attrs({ 'aria-label': t('nav.label') })}>
    ${sections.map(
      (section) => html`<md-button${attrs({
        variant: isCurrent(section.path) ? 'tonal' : 'text',
        size: 'sm',
        icon: section.icon,
        href: localeHref(locale, section.path),
        'aria-current': isCurrent(section.path) ? 'page' : undefined,
      })}>${section.label}</md-button>`,
    )}
  </nav>`;
}

/**
 * @param {object} options
 *   `crumbs` — `{ label, href? }`, href root-relative WITHOUT base or locale.
 *   `here`   — the screen path, for marking the current section.
 *   `aside`  — chips or dots that belong beside the heading.
 */
export function screen(t, { locale, here, title, subtitle, crumbs = [], aside, children }) {
  return html`<div class="shell">
    <!-- Identity, sections and reporting context share one bar. The nav is
         INSIDE the masthead rather than on its own row beneath it — it is still
         a real <nav> with its own accessible name, so nothing is lost to
         assistive tech by the two being visually joined. -->
    <header class="shell__masthead">
      <p class="shell__brand">${t('app.brand')}</p>
      <span class="muted">${t('app.title')}</span>

      ${sectionNav(t, locale, here)}

      <div class="shell__meta">
        <span>${t('app.reportingDate', { date: t.formatDate(REPORTING_DATE, 'medium') })}</span>
        <span>${t('app.reportingQuarter', { quarter: REPORTING_QUARTER })}</span>
        <span>${t('app.baseCurrency', { currency: BASE_CURRENCY })}</span>
      </div>
    </header>

    <!-- The trail has its own row above the heading.

         It appears on the drill path (sector → counterparty → facility), where
         it is the only thing showing where you are and the only way back up.
         Not on the three section screens: the nav already highlights the
         section, so a trail reading "Overview / Watchlist" would only say it
         twice.

         The ROW is always rendered even when empty, because a row that comes
         and goes is what was moving the heading and every panel under it by
         52px on each navigation. Its height is reserved in .shell__trail -->
    <div class="shell__trail">
      ${crumbs.length > 1
        ? html`<md-breadcrumbs${attrs({
            label: t('nav.breadcrumb'),
            'max-items': '4',
            'items-before-collapse': '1',
            'items-after-collapse': '2',
          })}>
            ${crumbs.map(
              (crumb) => html`<md-breadcrumb-item${attrs({
                href: crumb.href ? localeHref(locale, crumb.href) : undefined,
              })}>${crumb.label}</md-breadcrumb-item>`,
            )}
          </md-breadcrumbs>`
        : null}
    </div>

    <div class="screen-head">
      <div class="screen-head__text">
        <h1>${title}</h1>
        ${subtitle ? html`<p>${subtitle}</p>` : null}
      </div>
      ${aside ? html`<div class="screen-head__aside">${aside}</div>` : null}
    </div>

    ${children}
  </div>

  ${dock(locale)}`;
}

/**
 * A titled surface. Everything on every screen lives in one of these.
 *
 * `attributes` goes onto the card itself. The stress screen uses it to mark the
 * two panels it swaps: marking the card rather than wrapping it in a div keeps
 * the DOM the same shape as the other five builds, where the card is a direct
 * child of the screen's flex column.
 */
export function panel({ title, subtitle, actions, variant = 'outlined', children, attributes = {} }) {
  return html`<md-card${attrs({ variant, class: 'panel', 'full-width': true, ...attributes })}>
    <div class="panel__inner">
      ${title
        ? html`<div class="panel__head">
            <div>
              <h2 class="panel__title">${title}</h2>
              ${subtitle ? html`<p class="panel__sub">${subtitle}</p>` : null}
            </div>
            ${actions}
          </div>`
        : null}
      ${children}
    </div>
  </md-card>`;
}

/**
 * The shared empty state.
 *
 * `hint` defaults to false because most empty states here are facts, not filter
 * results: "this facility is unsecured" is the whole story, and telling the
 * reader to widen the filters underneath it would be nonsense. Pass `hint` only
 * where a filter or a search actually produced the emptiness.
 */
export function emptyState(t, message, { hint = false, attributes = {} } = {}) {
  return html`<div class="empty"${attrs(attributes)}>
    <p>${message}</p>
    ${hint ? html`<p>${t('empty.hint')}</p>` : null}
  </div>`;
}

/** A drill link into the next screen down. */
export function drill(locale, path, label) {
  return html`<a class="drill"${attrs({ href: localeHref(locale, path) })}>${label}</a>`;
}
