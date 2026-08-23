/**
 * The counterparty and facility tables.
 *
 * PAGED, exactly like the React build — same ten rows, same
 * `md-table-pagination`, same `row-offset` / `row-count`. The six builds are
 * meant to be one application, so a screen that renders twenty-four rows here
 * and ten there is a difference in the APP, not in the framework, and it is the
 * one kind of difference this showcase must not have.
 *
 * The other twenty-four rows still ship in the HTML — inside a `<template>`,
 * which the parser keeps out of the document tree. So the payload is the same
 * as React's rendered page (a `<template>` holds no live elements, and
 * `querySelectorAll` cannot see into one), while the client script has the
 * whole book to page and sort through without refetching anything or bundling
 * the fixture.
 *
 * With JavaScript off you get page one — precisely what React's static export
 * gives you with JavaScript off.
 *
 * SORTING AND PAGING ARE BOTH PROGRESSIVE. Rows arrive sorted by exposure
 * descending, the order a credit officer wants first. The comparison uses the
 * `data-sort-*` attributes rather than the cell text, because the text is
 * localised and compacted ("€1.2 md" in Romanian) and sorting that lexically
 * produces an order that is wrong in a different way in each of the three
 * languages.
 *
 * DRILLING. The legal name is a real anchor, not a row click: reachable by
 * keyboard, has a URL you can copy, works before JavaScript arrives. Legal
 * names are proper nouns and are never translated.
 *
 * CURRENCY IS THE TRAP IN THE FACILITY TABLE. `commitment` is denominated in
 * the facility's OWN currency, `commitmentEur` is the converted twin, and `ead`
 * is always EUR. So the commitment column formats with the facility's currency
 * and shows the EUR equivalent underneath, while EAD formats in the base
 * currency with no override. Mixing the two would quietly report a RON line as
 * if it were euros.
 */

import { getCounterparties, getFacilitiesFor } from '@awc-ui/showcase-kit/data';
import { TABLES, route, utilisationColor } from '@awc-ui/showcase-kit/credit-risk';
import { attrs, html } from '../lib/html.mjs';
import { facilityStatusChip, ratingChip, watchDot } from '../lib/bits.mjs';
import { drill, emptyState } from './shell.mjs';

const NUMERIC_KEYS = ['ead', 'pd', 'expectedLoss', 'rwa', 'utilisation', 'grade'];

/** Rows shown per page before the reader changes it. Matches the React build. */
const PAGE_SIZE = 10;

export function counterpartyTable(t, { locale, sectorId, showSector = true }) {
  const rows = getCounterparties({ sectorId, sortBy: 'ead', sortDir: 'desc' });
  const layout = TABLES.counterparties(showSector);

  const columns = [
    { key: 'legalName', label: t('table.counterparty') },
    ...(showSector ? [{ key: null, label: t('table.sector') }] : []),
    { key: null, label: t('table.country') },
    { key: 'grade', label: t('table.rating') },
    { key: 'pd', label: t('table.pd'), numeric: true },
    { key: null, label: t('table.lgd'), numeric: true },
    { key: 'ead', label: t('table.ead'), numeric: true },
    { key: 'expectedLoss', label: t('table.expectedLoss'), numeric: true },
    { key: 'rwa', label: t('table.rwa'), numeric: true },
    { key: 'utilisation', label: t('table.utilisation'), numeric: true },
  ];

  if (rows.length === 0) return emptyState(t, t('empty.counterparties'), { hint: true });

  const row = (cp) => html`<md-table-row${attrs({
    value: cp.id,
    'data-sort-legalname': cp.legalName,
    'data-sort-grade': cp.grade,
    'data-sort-pd': cp.pd,
    'data-sort-ead': cp.ead,
    'data-sort-expectedloss': cp.expectedLoss,
    'data-sort-rwa': cp.rwa,
    'data-sort-utilisation': cp.utilisation,
  })}>
    <md-table-cell>
      <span class="row" style="gap: var(--md-sys-spacing-gap-xs, 4px)">
        ${watchDot(t, cp.watchlist)}
        ${drill(locale, route.counterparty(cp.id), cp.legalName)}
      </span>
    </md-table-cell>
    ${showSector
      ? html`<md-table-cell>${drill(locale, route.sector(cp.sectorId), t(`sector.${cp.sectorId}`))}</md-table-cell>`
      : null}
    <md-table-cell>${t(`country.${cp.country}`)}</md-table-cell>
    <md-table-cell>${ratingChip(t, cp.ratingLabel, cp.ratingBand, cp.grade)}</md-table-cell>
    <md-table-cell numeric>${t.formatPercent(cp.pd, { maximumFractionDigits: 2 })}</md-table-cell>
    <md-table-cell numeric>${t.formatPercent(cp.lgd, { maximumFractionDigits: 0 })}</md-table-cell>
    <md-table-cell numeric>${t.formatCurrency(cp.ead, { notation: 'compact' })}</md-table-cell>
    <md-table-cell numeric>${t.formatCurrency(cp.expectedLoss, { notation: 'compact' })}</md-table-cell>
    <md-table-cell numeric>${t.formatCurrency(cp.rwa, { notation: 'compact' })}</md-table-cell>
    <md-table-cell numeric>
      <span style="color: var(--md-sys-color-${utilisationColor(cp.utilisation)})">${t.formatPercent(cp.utilisation, { maximumFractionDigits: 0 })}</span>
    </md-table-cell>
  </md-table-row>`;

  return html`<md-table-container variant="outlined">
    <md-table${attrs({
      'data-paged': true,
      label: t('screen.counterparties.title'),
      'column-template': layout.columns,
      'min-width': layout.minWidth,
      // md-table ratchets its height by default (keep-height) so paging cannot
      // make the page jump. That baseline is measured once and never
      // recomputed, so a density change strands the taller height and leaves
      // dead space below the rows — 176px at rung -4. Pagination already holds
      // the row count steady, so the ratchet earns little; live density
      // switching matters more.
      'keep-height': 'false',
      striped: true,
      'sort-by': 'ead',
      'sort-order': 'desc',
      // Without these, assistive tech announces "row 1 of 10" on every page
      // instead of the row's position in the whole book. row-count takes the
      // BODY total; md-table adds the head and foot rows itself.
      'row-offset': 0,
      'row-count': rows.length,
    })}>
      <md-table-head>
        <!-- The sort labels carry no active / order: md-table already declares
             sort-by / sort-order above and pushes both down into every label on
             sync, so anything written here could only ever disagree with it. -->
        <md-table-row rowgroup="head">
          ${columns.map(
            (column) => html`<md-table-cell head scope="col"${attrs({ numeric: column.numeric || undefined })}>
              ${column.key
                ? html`<md-table-sort-label${attrs({
                    column: column.key,
                    'default-order': NUMERIC_KEYS.includes(column.key) ? 'desc' : 'asc',
                    'icon-position': column.numeric ? 'start' : 'end',
                  })}>${column.label}</md-table-sort-label>`
                : column.label}
            </md-table-cell>`,
          )}
        </md-table-row>
      </md-table-head>
      <md-table-body>${rows.slice(0, PAGE_SIZE).map(row)}</md-table-body>
    </md-table>
    <md-table-pagination${attrs({
      slot: 'bottom',
      count: rows.length,
      page: 0,
      'rows-per-page': PAGE_SIZE,
      'rows-per-page-options': '10,25,all',
      'show-first-last': true,
      'label-rows-per-page': t('table.rowsPerPage'),
      'label-displayed-rows': t('table.displayedRows'),
      'label-first-page': t('table.firstPage'),
      'label-previous-page': t('table.previousPage'),
      'label-next-page': t('table.nextPage'),
      'label-last-page': t('table.lastPage'),
      'label-all': t('table.all'),
    })}></md-table-pagination>
  </md-table-container>
  <!-- The whole book, parked where the document tree cannot see it. A template's
       content is inert: it is not rendered, not matched by querySelectorAll, and
       carries no upgraded custom elements — so this page holds exactly the ten
       live rows React's does, and the client script still has all twenty-four to
       page and sort through. -->
  <template data-rows>${rows.map(row)}</template>`;
}

export function facilityTable(t, { locale, counterpartyId }) {
  const rows = getFacilitiesFor(counterpartyId);
  if (rows.length === 0) return emptyState(t, t('empty.facilities'));

  const head = [
    { label: t('table.facility') },
    { label: t('table.type') },
    { label: t('table.currency') },
    { label: t('table.commitment'), numeric: true },
    { label: t('table.ead'), numeric: true },
    { label: t('table.utilisation'), numeric: true },
    { label: t('table.margin'), numeric: true },
    { label: t('table.maturity') },
    { label: t('table.status') },
  ];

  return html`<md-table-container variant="outlined">
    <md-table${attrs({
      label: t('screen.facilities.title'),
      'column-template': TABLES.facilities.columns,
      'min-width': TABLES.facilities.minWidth,
      'keep-height': 'false',
      striped: true,
    })}>
      <md-table-head>
        <md-table-row rowgroup="head">
          ${head.map(
            (cell) => html`<md-table-cell head scope="col"${attrs({ numeric: cell.numeric || undefined })}>${cell.label}</md-table-cell>`,
          )}
        </md-table-row>
      </md-table-head>
      <md-table-body>
        ${rows.map(
          (facility) => html`<md-table-row${attrs({ value: facility.id })}>
            <md-table-cell>${drill(locale, route.facility(facility.id), facility.id)}</md-table-cell>
            <md-table-cell>${t(facility.typeKey)}</md-table-cell>
            <md-table-cell>${facility.currency}</md-table-cell>
            <md-table-cell numeric>
              <span class="num">${t.formatCurrency(facility.commitment, { currency: facility.currency, notation: 'compact' })}</span>
              ${facility.currency === 'EUR'
                ? null
                : html`<br /><span class="muted num" style="font: var(--md-sys-typescale-label-small-font)">${t.formatCurrency(facility.commitmentEur, { notation: 'compact' })}</span>`}
            </md-table-cell>
            <md-table-cell numeric>${t.formatCurrency(facility.ead, { notation: 'compact' })}</md-table-cell>
            <md-table-cell numeric>${t.formatPercent(facility.utilisation, { maximumFractionDigits: 0 })}</md-table-cell>
            <md-table-cell numeric>${t('unit.bps', { value: t.formatNumber(facility.marginBps) })}</md-table-cell>
            <md-table-cell>${t.formatDate(facility.maturityDate, 'medium')}</md-table-cell>
            <md-table-cell>${facilityStatusChip(t, facility.status)}</md-table-cell>
          </md-table-row>`,
        )}
      </md-table-body>
    </md-table>
  </md-table-container>`;
}
