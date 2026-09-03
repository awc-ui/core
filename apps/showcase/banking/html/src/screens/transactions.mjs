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
 * WHAT THE CLIENT SCRIPT ADDS (`client/transactions.mjs`), all progressive:
 *
 *   - the month facet, swapping the live day-groups for a template's;
 *   - the account, category and status facets, which hide rows by
 *     `data-account` / `data-category` / `data-status` rather than re-deriving
 *     anything;
 *   - the search box, matching on `data-search` — a lower-cased haystack the
 *     build writes onto each row, never the localised cell text;
 *   - the count and the reset.
 *
 * Filtering by hiding rather than by re-rendering is what keeps the live DOM
 * census equal to React's: React renders the filtered set, so a hidden row
 * would be an extra element. The client DETACHES a filtered-out row instead,
 * the same rule the rest of this build follows.
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
  return html`<div class="stack">
    <div class="statement-day">
      <span>${dateText(t, day.date, 'long')}</span>
      ${flow(t, day.netEur)}
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

  const filterBody = html`<div class="stack">
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
      <!-- The reset ships hidden: with nothing filtered there is nothing to
           reset, and a permanently-inert control in a filter bar is furniture.
           hidden rather than absent so the client has something to reveal. -->
      <md-button${attrs({
        'data-clear': true,
        variant: 'text',
        size: 'sm',
        icon: 'restart_alt',
        hidden: true,
      })}>${t('banking.action.clearFilters')}</md-button>
    </div>
  </div>`;

  return screen(t, {
    locale,
    here: path,
    title: t('banking.screen.transactions.title'),
    subtitle: t('banking.screen.transactions.subtitle'),
    aside: count(t, shown),
    children: html`<!--
        THE FILTERS COLLAPSE ON A PHONE. Both placements ship: the panel is the
        desktop one and the disclosure the phone one, and app.css shows
        exactly one of them. Rendering both is what lets a static page match a
        media query with no script — and the disclosure's content is a clone of
        the panel's, so the two cannot drift.
      -->
      <md-accordion${attrs({ 'data-filter-sheet': true, variant: 'outlined', 'heading-level': '2' })}>
        <md-accordion-item${attrs({ headline: t('banking.action.filter'), icon: 'filter_list' })}>
          ${filterBody}
        </md-accordion-item>
      </md-accordion>

      ${panel({
        attributes: { 'data-filter-panel': true },
        title: t('banking.action.filter'),
        children: filterBody,
      })}

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
