/**
 * The frame every screen sits in: app bar, navigation rail (desktop),
 * navigation bar (compact), breadcrumb trail, screen heading, screen toolbar,
 * and the showcase dock.
 *
 * Not a single visible string is written here — the translator resolves all of
 * them, including the ones that look like constants (the brand name, the
 * base-currency note). The reporting date goes through `formatDate`, which is
 * pinned to `timeZone: 'UTC'`, so 2026-06-30 is 30 June in every locale and on
 * every machine that builds this.
 *
 * Every link is built with `localeHref`, so a reader in Romanian stays in
 * Romanian as they drill down. No client-routing interception is needed, unlike
 * the React build: this IS a document per route, so a nav click is supposed to
 * be a page load, and the current destination is known while the file is being
 * written — `active-index` is baked into the markup instead of controlled from
 * a pathname.
 *
 * The React build hoists this chrome ABOVE its router so the rail survives
 * navigation and its indicator can animate. This build gets the same outcome
 * for free: the chrome is part of every document, and a navigation is a page
 * load — there is nothing to keep alive. What cannot be static is the rail's
 * expand/collapse toggle and the FAB's action; both are progressive
 * enhancements in `src/client/shell.mjs`.
 *
 * THE THREE NAVIGATION RULES this file obeys, same as the React shell:
 *   - Destinations are `md-navigation-rail` / `md-navigation-bar`, never
 *     `md-tabs`.
 *   - The rail's primary action is an `md-fab` in `slot="fab"`, the only slot
 *     it belongs in. The rail morphs its `extended` state, so it is never set.
 *   - Exactly ONE navigation surface is present at a time: the rail and the
 *     bar render the same five destinations from the kit's `DESTINATIONS`, and
 *     `app.css` shows one and `display: none`s the other at 900px.
 */

import {
  BASE_CURRENCY,
  DESTINATIONS,
  destinationIndex,
  getAdvisor,
  getBookTotals,
  REPORTING_DATE,
  REPORTING_QUARTER,
  route,
} from '@awc-ui/showcase-kit/wealth';
import { attrs, html } from '../lib/html.mjs';
import { localeHref } from '../lib/i18n.mjs';
import { dock } from './dock.mjs';

/* --------------------------------------------------------------- app bar */

/**
 * The masthead. One per page — the host carries `role="banner"`.
 *
 * THE DISCLAIMER IS PART OF THE CHROME, not a footnote: every proper noun in
 * this app is invented, presented in the shape of a real private-banking
 * console. The chip sits in the `headline` SLOT rather than the `headline`
 * prop because the two are alternatives, and the slot renders inside the same
 * `part="title"` span the prop does. `md-tooltip` carries the full sentence;
 * the chip's own label already says the load-bearing part.
 *
 * The trailing slot is CAPPED AT THREE elements by the component. Two are
 * used: the reporting context, and the signed-in advisor. The leading `menu`
 * affordance toggles the rail — wired by the client script, since that is
 * behaviour, not content.
 */
function appBar(t) {
  const advisor = getAdvisor();
  return html`<md-app-bar${attrs({
    class: 'shell__appbar',
    variant: 'small',
    subtitle: t('wealth.app.title'),
    'leading-icon': 'menu',
    'leading-icon-label': t('wealth.nav.menu'),
  })}>
    <span slot="headline" class="shell__brand">${t('wealth.app.brand')}<md-tooltip${attrs({
      text: t('wealth.app.demoNotice'),
    })}><md-chip${attrs({
      label: t('wealth.app.demo'),
      appearance: 'outlined',
      color: 'warning',
      icon: 'science',
    })}></md-chip></md-tooltip></span>

    <div slot="trailing" class="shell__meta">
      <span>${t('wealth.app.reportingDate', { date: t.formatDate(REPORTING_DATE, 'medium') })}</span>
      <span>${t('wealth.app.reportingQuarter', { quarter: REPORTING_QUARTER })}</span>
      <span>${t('wealth.app.baseCurrency', { currency: BASE_CURRENCY })}</span>
    </div>
    <md-avatar slot="trailing"${attrs({
      name: advisor.name,
      label: t('wealth.app.advisor', { name: advisor.name }),
      size: 'small',
    })}></md-avatar>
  </md-app-bar>`;
}

/* ------------------------------------------------------------------- rail */

/**
 * Top-level destinations at desktop width.
 *
 * `href` IS SET ON EVERY DESTINATION: each tab is a real anchor, ⌘-click opens
 * a tab, and — this being the one build where a page load IS the navigation —
 * the anchor needs no interception at all. `active-index` is baked from the
 * page's own path.
 *
 * The FAB has no `href` prop, so its action (open the proposals screen) is
 * wired by the client script off `data-fab-href`; with JavaScript off the FAB
 * is inert, which is honest — it is an md-* element and renders nothing
 * without the runtime anyway.
 */
function rail(t, locale, here) {
  const totals = getBookTotals();
  return html`<md-navigation-rail${attrs({
    class: 'shell__rail',
    label: t('wealth.nav.label'),
    variant: 'standard',
    'active-index': destinationIndex(here),
    'label-visibility': 'all',
  })}>
    <md-fab slot="fab"${attrs({
      icon: 'add',
      label: t('wealth.action.newProposal'),
      'data-fab-href': localeHref(locale, route.proposals()),
    })}></md-fab>

    ${DESTINATIONS.map(
      (destination) => html`<md-navigation-rail-tab${attrs({
        icon: destination.icon,
        label: t(destination.labelKey),
        value: destination.value,
        href: localeHref(locale, destination.path),
        'badge-value':
          destination.value === 'proposals' && totals.openProposalCount > 0
            ? String(totals.openProposalCount)
            : undefined,
      })}></md-navigation-rail-tab>`,
    )}
  </md-navigation-rail>`;
}

/* -------------------------------------------------------------------- bar */

/**
 * The same five destinations, docked at the bottom, below 900px.
 *
 * FIVE IS THE CEILING — `md-navigation-bar` is specified for 3–5, which is why
 * the household drill is not a destination. With `href` set the tab navigates
 * by `window.location.assign()`, which on this build is exactly the right
 * behaviour, so the capture-phase veto the SPA builds need does not exist here.
 * `data-value` mirrors the rail's `value` (this component has no value prop)
 * so the client script and the verifier can find a tab by destination.
 */
function bar(t, locale, here) {
  const totals = getBookTotals();
  return html`<md-navigation-bar${attrs({
    class: 'shell__bar',
    'aria-label': t('wealth.nav.label'),
    'active-index': destinationIndex(here),
    'label-behavior': 'always',
  })}>
    ${DESTINATIONS.map(
      (destination) => html`<md-navigation-tab${attrs({
        'data-value': destination.value,
        icon: destination.icon,
        'active-icon': destination.activeIcon,
        label: t(destination.labelKey),
        href: localeHref(locale, destination.path),
        'badge-value':
          destination.value === 'proposals' && totals.openProposalCount > 0
            ? String(totals.openProposalCount)
            : undefined,
      })}></md-navigation-tab>`,
    )}
  </md-navigation-bar>`;
}

/* ------------------------------------------------------------ breadcrumbs */

/**
 * The trail. Crumb specs come from the kit's `crumbsFor()`: exactly one of
 * `labelKey` (translate it) or `label` (a proper noun, render verbatim). The
 * last crumb is the page you are already on, so it is never a link —
 * md-breadcrumbs promotes it to `current` and gives it `aria-current="page"`
 * itself.
 */
function breadcrumbs(t, locale, crumbs) {
  return html`<md-breadcrumbs${attrs({
    label: t('wealth.nav.breadcrumb'),
    'max-items': '4',
    'items-before-collapse': '1',
    'items-after-collapse': '2',
  })}>
    ${crumbs.map(
      (crumb, index) => html`<md-breadcrumb-item${attrs({
        href:
          crumb.href && index < crumbs.length - 1
            ? localeHref(locale, crumb.href)
            : undefined,
      })}>${crumb.labelKey ? t(crumb.labelKey) : crumb.label}</md-breadcrumb-item>`,
    )}
  </md-breadcrumbs>`;
}

/* ------------------------------------------------------------------ screen */

/**
 * A whole page: frame plus one screen's content.
 *
 * @param {object} options
 *   `here`    — the screen's unprefixed path, for marking the destination.
 *   `crumbs`  — kit `CrumbSpec[]` from `crumbsFor()`. A trail of ONE is shown
 *               rather than dropped (the React shell's rule): the single crumb
 *               is link-less, so it reads as the current page, and a
 *               consistently-placed trail is worth more than avoiding one
 *               repetition of a word.
 *   `aside`   — chips, dots or counts that belong beside the heading.
 *   `actions` — screen-level actions, rendered inside the ONE `md-toolbar`
 *               (floating, vibrant — a docked toolbar would sit where the
 *               navigation bar and the dock already are).
 *
 * The trail row is ALWAYS rendered, even when empty — a row that comes and
 * goes moves the heading by its own height between pages; `.shell__trail`
 * reserves it.
 *
 * `.screen-stage > .screen-body` wraps the content even though this build has
 * no skeleton to overlay (a pre-rendered page IS its own first paint): the
 * parity check censuses the DOM against the React build, where those two
 * wrappers always exist.
 */
export function screen(t, { locale, here, title, subtitle, crumbs = [], aside, actions, children }) {
  return html`<div class="shell">
    ${appBar(t)}

    <div class="shell__body">
      ${rail(t, locale, here)}

      <main class="shell__main">
        <div class="shell__trail">
          ${crumbs.length > 0 ? breadcrumbs(t, locale, crumbs) : null}
        </div>

        <div class="screen-head">
          <div class="screen-head__text">
            <h1>${title}</h1>
            ${subtitle ? html`<p>${subtitle}</p>` : null}
          </div>
          ${aside ? html`<div class="screen-head__aside">${aside}</div>` : null}
        </div>

        ${actions
          ? html`<div class="screen-toolbar">
              <md-toolbar${attrs({
                variant: 'floating',
                color: 'vibrant',
                'aria-label': t('wealth.nav.toolbar'),
              })}>${actions}</md-toolbar>
            </div>`
          : null}

        <div class="screen-stage">
          <div class="screen-body">${children}</div>
        </div>
      </main>
    </div>

    ${bar(t, locale, here)}
  </div>

  ${dock(t)}`;
}

/* -------------------------------------------------------------- the bits */

/**
 * A titled surface. Everything on every screen lives in one of these.
 *
 * `.panel__heading` wraps title and subtitle (they are ONE heading sharing a
 * row — an unclassed div would stack them and read as two), with `actions`
 * beside the pair. `attributes` goes onto the card itself, for screens that
 * need to mark a panel without wrapping it and changing the DOM shape the
 * parity check measures.
 */
export function panel({ title, subtitle, actions, variant = 'outlined', children, attributes = {} }) {
  return html`<md-card${attrs({ variant, class: 'panel', 'full-width': true, ...attributes })}>
    <div class="panel__inner">
      ${title
        ? html`<div class="panel__head">
            <div class="panel__heading">
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
 * `hint` defaults to false because most empty states here are facts, not
 * filter results: "every mandate is within its bands" is the whole story, and
 * telling the reader to widen the filters underneath it would be nonsense.
 * Pass `hint` only where a filter or a search actually produced the emptiness.
 */
export function emptyState(t, message, { hint = false, attributes = {} } = {}) {
  return html`<div class="empty"${attrs(attributes)}>
    <p>${message}</p>
    ${hint ? html`<p>${t('wealth.empty.hint')}</p>` : null}
  </div>`;
}
