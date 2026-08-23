/**
 * Screen 5 — early-warning signals.
 *
 * `getWatchlist()` returns rows already denormalised with the counterparty
 * name, sector, grade and EAD, and already sorted highest severity first then
 * largest exposure — so the table needs no join and no comparator.
 *
 * FILTERS ARE PROGRESSIVE, unlike the React build. React filters by re-rendering
 * a smaller array; there is no re-render here, so every signal is written into
 * the file and the client script hides the rows that do not match. That
 * ordering matters: the page is complete before the script runs, so with
 * JavaScript off the reader gets the whole watchlist rather than an empty table
 * and three dead controls. The match is against `data-severity` /
 * `data-sector`, not the cell text, because the text is localised and a filter
 * that compares translated strings works in English and quietly fails in the
 * other two languages.
 *
 * An empty severity selection means "all" — which is also exactly what the
 * segmented set reports when the last segment is cleared, so no separate "all"
 * segment is needed and the reset button restores precisely that state.
 *
 * `frozen-header`, NOT `sticky-header`. This is the only table in the app inside
 * a bounded container, so the only one that scrolls vertically.
 * `sticky-header` pins the header inside the scroll port, which means the
 * scrollbar spans the header too; `frozen-header` renders the header OUTSIDE
 * the scrolling area so the bar runs beside the rows only.
 */

import { getRatingGrade, getSectors, getWatchlist } from '@awc-ui/showcase-kit/data';
import { route, TABLES } from '@awc-ui/showcase-kit/credit-risk';
import { attrs, html } from '../lib/html.mjs';
import { ratingChip, severityChip, severityDotMarker } from '../lib/bits.mjs';
import { drill, emptyState, panel, screen } from '../components/shell.mjs';

const SEVERITIES = ['high', 'medium', 'low'];

export function watchlistScreen(t, locale) {
  const sectors = getSectors();
  const signals = getWatchlist();
  const counterparties = new Set(signals.map((s) => s.counterpartyId));

  /**
   * The chip's label is rebuilt in place as rows are hidden. The template
   * carries a `%shown%` placeholder rather than a second translation call on
   * the client, so the sentence stays in this page's language whatever the
   * filter does to the count.
   */
  const countTemplate = t('common.showing', { shown: '%shown%', total: signals.length });

  const aside = html`<md-chip${attrs({
    'data-count': true,
    'data-count-template': countTemplate,
    variant: 'assist',
    appearance: 'filled',
    color: 'error',
    icon: 'crisis_alert',
    label: t('common.showing', { shown: signals.length, total: signals.length }),
  })}></md-chip>`;

  const head = [
    { label: t('table.counterparty') },
    { label: t('table.sector') },
    { label: t('table.rating') },
    { label: t('table.signal') },
    { label: t('table.severity') },
    { label: t('table.ead'), numeric: true },
    { label: t('table.opened') },
    { label: t('table.daysOpen'), numeric: true },
    { label: t('table.owner') },
  ];

  const children = html`    ${panel({
      title: t('action.filter'),
      subtitle: t('table.severity'),
      children: html`<div class="row">
        <md-segmented-button-set data-filter-severity multiselect${attrs({ 'aria-label': t('table.severity') })}>
          ${SEVERITIES.map(
            (severity) => html`<md-segmented-button${attrs({ value: severity, label: t(`severity.${severity}`) })}></md-segmented-button>`,
          )}
        </md-segmented-button-set>

        <md-select data-filter-sector${attrs({
          label: t('table.sector'),
          placeholder: t('common.all'),
          clearable: true,
          'clear-label': t('action.clearFilters'),
        })}>
          ${sectors.map(
            (sector) => html`<md-select-option${attrs({ value: sector.id, label: t(sector.nameKey) })}>${t(sector.nameKey)}</md-select-option>`,
          )}
        </md-select>

        <md-button data-filter-clear${attrs({ variant: 'text', size: 'sm', icon: 'filter_alt_off' })}>${t('action.clearFilters')}</md-button>
      </div>`,
    })}

    ${panel({
      title: t('table.signal'),
      subtitle: t('common.of', { count: counterparties.size, total: signals.length }),
      children: html`<!-- The empty state is what the filter swaps the table for.
             React renders one or the other, never both, so this waits in a
             template rather than sitting in the document under hidden: a
             hidden element is still an element, and the six builds are compared
             on what they contain, not on what is visible. -->
        <template data-empty>${emptyState(t, t('empty.signals'), { hint: true })}</template>
        <md-table-container variant="outlined" max-height="60vh">
          <md-table${attrs({
            label: t('screen.watchlist.title'),
            'column-template': TABLES.watchlist.columns,
            'min-width': TABLES.watchlist.minWidth,
            'frozen-header': true,
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
              ${signals.map(
                (signal) => html`<md-table-row${attrs({
                  value: signal.id,
                  'data-severity': signal.severity,
                  'data-sector': signal.sectorId,
                })}>
                  <md-table-cell>
                    <!-- The severity marker leads the row, beside the obligor's
                         name — the same shape the counterparty table uses for
                         its watchlist dot, so a reader scanning the first
                         column sees the severity without crossing a
                         nine-column table. -->
                    <span class="row" style="gap: var(--md-sys-spacing-gap-xs, 4px)">
                      ${severityDotMarker(t, signal.severity)}
                      ${drill(locale, route.counterparty(signal.counterpartyId), signal.counterpartyName)}
                    </span>
                  </md-table-cell>
                  <md-table-cell>${drill(locale, route.sector(signal.sectorId), t(`sector.${signal.sectorId}`))}</md-table-cell>
                  <!-- The signal row carries the grade but not the band, so the
                       band comes from the rating scale rather than from a second
                       set of thresholds invented here. -->
                  <md-table-cell>${ratingChip(t, signal.ratingLabel, getRatingGrade(signal.grade)?.band ?? 'speculative')}</md-table-cell>
                  <md-table-cell>${t(signal.typeKey)}</md-table-cell>
                  <md-table-cell>${severityChip(t, signal.severity)}</md-table-cell>
                  <md-table-cell numeric>${t.formatCurrency(signal.ead, { notation: 'compact' })}</md-table-cell>
                  <md-table-cell>${t.formatDate(signal.openedDate, 'medium')}</md-table-cell>
                  <md-table-cell numeric>
                    <span${attrs({ title: t('signal.openFor', { days: signal.daysOpen }) })}>${t.formatNumber(signal.daysOpen)}</span>
                  </md-table-cell>
                  <md-table-cell>${signal.owner}</md-table-cell>
                </md-table-row>`,
              )}
            </md-table-body>
          </md-table>
        </md-table-container>`,
    })}`;

  return screen(t, {
    locale,
    here: route.watchlist(),
    title: t('screen.watchlist.title'),
    subtitle: t('screen.watchlist.subtitle', {
      signals: signals.length,
      counterparties: counterparties.size,
    }),
    aside,
    children,
  });
}
