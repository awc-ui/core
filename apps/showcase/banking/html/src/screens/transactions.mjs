/**
 * Screen 2 — the statement.
 *
 * GROUPED BY DAY, NOT PAGED. A statement is read by day: the heading is what
 * lets someone find "that Tuesday", and it carries the day's net so nobody adds
 * six rows up by eye.
 *
 * A STATEMENT HAS A PERIOD, and this build makes that structural. Every month's
 * rows are written into the document — the reporting month live, the other five
 * plus the whole year each in a `<template data-month>` — and the client swaps
 * one for another. With JavaScript off the page is the reporting month's
 * statement, complete and readable, which is exactly what React's first paint
 * is.
 *
 * WHAT THE CLIENT SCRIPT ADDS (client/transactions.mjs), all progressive: the
 * month facet, which swaps the live day-groups for a template's; the account,
 * category and status facets; the search box; the count and the reset; and the
 * phone placement of the filter panel.
 *
 * IT ASKS THE KIT WHICH ROWS SURVIVE — the same getTransactions() call the
 * React screen makes, with the same five arguments — and then MOVES the rows
 * the build already wrote. It never decides what matches and never adds up a
 * day. That division matters here more than anywhere else in this build: a day
 * heading carries the day's net, so a client that filtered rows by itself would
 * leave every heading stating the unfiltered day's total.
 *
 * DETACHED, NEVER HIDDEN. A hidden row is still a row — to querySelectorAll, to
 * the accessibility tree, and to the parity census — while React renders a
 * shorter list. Rows that fall out of a filter are held in memory and come back
 * in the kit's order.
 */

import {
  REPORTING_MONTH,
  getAccounts,
  getCategorySpend,
  getMonthlyFlow,
  getTransactions,
  route,
  statementDays,
} from '@awc-ui/showcase-kit/banking';
import { attrs, html } from '../lib/html.mjs';
import { count, dateText, flow, statementRow } from '../lib/bits.mjs';
import { panel, screen } from '../components/shell.mjs';

/** `reverted` is too rare to earn a chip. */
const STATUSES = ['completed', 'pending', 'declined'];
const ALL_MONTHS = 'all';

/** One day group: the sticky heading, its net, and the rows under it. */
function dayGroup(t, day) {
  return html`<div class="stack"${attrs({ 'data-day': day.date })}>
    <div class="statement-day">
      <span>${dateText(t, day.date, 'long')}</span>
      ${flow(t, day.netEur, { attributes: { 'data-day-net': true } })}
    </div>
    <md-list${attrs({
      label: t.formatDate(day.date, 'long'),
      'interaction-mode': 'multi-action',
      'list-style': 'segmented',
    })}>
      ${day.rows.map((txn) => statementRow(t, txn, { showDate: false }))}
    </md-list>
  </div>`;
}

/**
 * The rows for one month, with the filter keys the client matches on.
 *
 * The keys go on a wrapper rather than on the row itself because a row is an
 * `md-list-item` whose own attributes the component owns — and because the
 * client hides whole rows, not cells.
 */
function monthGroups(t, month) {
  const rows = getTransactions({ month: month === ALL_MONTHS ? undefined : month });
  return statementDays(rows).map((day) => dayGroup(t, day));
}

export function transactionsScreen(t, locale) {
  const path = route.transactions();
  const accounts = getAccounts();
  /* Built from the whole month's categories, not the filtered set, so the chips
     do not disappear as soon as one is chosen. */
  const categories = getCategorySpend();
  /* Newest first — the six months a reader might plausibly scroll back to. */
  const months = getMonthlyFlow().map((m) => m.month).reverse().slice(0, 6);
  const total = getTransactions().length;
  const shown = getTransactions({ month: REPORTING_MONTH }).length;

  /** One labelled facet: a caption, then its chips. */
  const facet = (label, rowAttrs, chips) => html`<div class="facet">
    <p class="facet__label">${label}</p>
    <div class="facet-row"${attrs(rowAttrs)}>${chips}</div>
  </div>`;

  const filterBody = html`<div class="stack" data-filter-body>
    <!-- trigger="bar" and full-width: the default trigger is an icon that
         opens the field, which in a filter panel is a lone magnifying glass and
         reads as broken. -->
    <md-search${attrs({
      'data-search': true,
      layout: 'docked',
      trigger: 'bar',
      variant: 'contained',
      'full-width': true,
      debounce: '250',
      label: t('banking.action.search'),
      placeholder: t('banking.table.merchant'),
    })}></md-search>

    ${facet(
      t('banking.facet.month'),
      { 'data-facet': 'month' },
      html`${months.map(
          (value) => html`<md-chip${attrs({
            'data-month': value,
            variant: 'filter',
            appearance: 'outlined',
            selected: value === REPORTING_MONTH || undefined,
            label: t.formatDate(`${value}-01`, 'monthYear'),
          })}></md-chip>`,
        )}
        <md-chip${attrs({
          'data-month': ALL_MONTHS,
          variant: 'filter',
          appearance: 'outlined',
          label: t('banking.common.all'),
        })}></md-chip>`,
    )}

    ${facet(
      t('banking.facet.account'),
      { 'data-facet': 'account' },
      accounts.map(
        (account) => html`<md-chip${attrs({
          'data-account': account.id,
          variant: 'filter',
          appearance: 'outlined',
          label: account.nickname,
        })}></md-chip>`,
      ),
    )}

    ${facet(
      t('banking.facet.category'),
      { 'data-facet': 'category' },
      categories.map(
        (row) => html`<md-chip${attrs({
          'data-category': row.category,
          variant: 'filter',
          appearance: 'outlined',
          label: t(row.categoryKey),
        })}></md-chip>`,
      ),
    )}

    ${facet(
      t('banking.facet.status'),
      { 'data-facet': 'status' },
      STATUSES.map(
        (value) => html`<md-chip${attrs({
          'data-status': value,
          variant: 'filter',
          appearance: 'outlined',
          label: t(`banking.txnStatus.${value}`),
        })}></md-chip>`,
      ),
    )}

    <!-- The count and the reset belong to the panel, not to one facet: inside a
         scrolling chip row they collided with the last chip and scrolled out of
         reach together. -->
    <div class="row row--between facet-foot">
      <span${attrs({
        'data-count': true,
        'data-count-template': t('banking.common.showing', { shown: '%shown%', total: '%total%' }),
      })} class="muted">${t('banking.common.showing', { shown, total })}</span>
      <!-- The reset exists only while there is something to reset, so it ships
           in a template rather than hidden: a permanently-inert control in a
           filter bar is furniture, and a HIDDEN one is still an element — in
           querySelectorAll, in the accessibility tree, and in the parity
           census, where React renders none. -->
      <template data-clear>
        <md-button${attrs({
          variant: 'text',
          size: 'sm',
          icon: 'restart_alt',
        })}>${t('banking.action.clearFilters')}</md-button>
      </template>
    </div>
  </div>`;

  return screen(t, {
    locale,
    here: path,
    title: t('banking.screen.transactions.title'),
    subtitle: t('banking.screen.transactions.subtitle'),
    aside: count(t, shown, { attributes: { 'data-result-count': true } }),
    children: html`<!--
        THE FILTERS COLLAPSE ON A PHONE, and both placements ship — but only
        one of them is LIVE.

        The desktop panel is in the document; the phone disclosure rides in a
        template and the client moves the panel's own body into it below 720px.
        Shipping both live and hiding one with CSS was the first shape of this
        and it is wrong twice over: a hidden accordion is still four chip rows
        in the accessibility tree, and the parity census counts elements, not
        pixels — the React build renders ONE placement, so a second one is a
        divergence however invisible it looks.

        The body is MOVED, never copied, so the two cannot drift and no chip
        exists twice.

        With JavaScript off a phone gets the desktop panel: taller than it
        should be, entirely usable, and honest about what a static page can do.
      -->
      ${panel({
        attributes: { 'data-filter-panel': true },
        title: t('banking.action.filter'),
        children: filterBody,
      })}

      <template data-filter-sheet>
        <md-accordion${attrs({ variant: 'outlined', 'heading-level': '2' })}>
          <md-accordion-item${attrs({ headline: t('banking.action.filter'), icon: 'filter_list' })}></md-accordion-item>
        </md-accordion>
      </template>

      ${panel({
        attributes: { 'data-statement': true },
        children: html`<div data-groups>${monthGroups(t, REPORTING_MONTH)}</div>
          <!-- Every other period, inert until the client swaps one in. A
               template's content is not in the live DOM, so the element census
               matches React's, which renders one month at a time. -->
          ${[...months.filter((m) => m !== REPORTING_MONTH), ALL_MONTHS].map(
            (month) => html`<template${attrs({ 'data-month-groups': month })}>${monthGroups(t, month)}</template>`,
          )}`,
      })}

      <template data-empty>${html`<div class="empty">
        <p>${t('banking.empty.transactions')}</p>
        <p>${t('banking.empty.hint')}</p>
      </div>`}</template>`,
  });
}
