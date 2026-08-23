/**
 * Screen 4 — the facility, and the bottom of the drill path.
 *
 * Terms, then the three things a credit officer checks after them: covenant
 * headroom, collateral net of haircuts, and the balance profile to maturity.
 *
 * COLLATERAL. `valuation` is in the collateral's own currency, `valuationEur`
 * is the converted twin, and `netValue` — always EUR — is already
 * `valuationEur × (1 − haircut)`. The table shows all three so the haircut is
 * visible rather than implied, and the panel header compares total net value
 * against the facility's EAD, which is the coverage ratio that actually
 * matters.
 *
 * SCHEDULE. See `drawdownSchedule()` in `@awc-ui/showcase-kit/credit-risk`:
 * term loans amortise straight-line to maturity, committed revolving lines hold
 * and retire in one step. Both shapes come out of the fixture's own dates, so
 * the table is a projection of the data rather than an invention on top of it.
 */

import {
  BASE_CURRENCY,
  getCollateralFor,
  getCounterpartyById,
  getCovenantsFor,
  getFacilityById,
} from '@awc-ui/showcase-kit/data';
import { drawdownSchedule, route, TABLES, utilisationColor } from '@awc-ui/showcase-kit/credit-risk';
import { attrs, html, style } from '../lib/html.mjs';
import { covenantMeter, fact, facilityStatusChip, ratioMeter } from '../lib/bits.mjs';
import { emptyState, panel, screen } from '../components/shell.mjs';

export function facilityScreen(t, locale, facilityId) {
  const facility = getFacilityById(facilityId);
  if (!facility) throw new Error(`[credit-risk] unknown facility: ${facilityId}`);

  const counterparty = getCounterpartyById(facility.counterpartyId);
  const covenants = getCovenantsFor(facility.id);
  const collateral = getCollateralFor(facility.id);
  const schedule = drawdownSchedule(facility);

  const netCollateral = collateral.reduce((sum, item) => sum + item.netValue, 0);
  const coverage = facility.ead > 0 ? netCollateral / facility.ead : 0;
  const local = { currency: facility.currency };

  const aside = html`${facilityStatusChip(t, facility.status)}
    <md-chip${attrs({
      variant: 'assist',
      appearance: 'outlined',
      icon: facility.secured ? 'lock' : 'lock_open',
      label: facility.secured ? t('common.secured') : t('common.unsecured'),
    })}></md-chip>`;

  const collateralTable = html`<md-table-container variant="outlined">
    <md-table${attrs({
      label: t('screen.collateral.title'),
      'column-template': TABLES.collateral.columns,
      'min-width': TABLES.collateral.minWidth,
      striped: true,
    })}>
      <md-table-head>
        <md-table-row rowgroup="head">
          <md-table-cell head scope="col">${t('table.collateral')}</md-table-cell>
          <md-table-cell head scope="col">${t('table.currency')}</md-table-cell>
          <md-table-cell head scope="col" numeric>${t('table.valuation')}</md-table-cell>
          <md-table-cell head scope="col" numeric>${`${t('table.valuation')} (${BASE_CURRENCY})`}</md-table-cell>
          <md-table-cell head scope="col" numeric>${t('table.haircut')}</md-table-cell>
          <md-table-cell head scope="col" numeric>${t('table.netValue')}</md-table-cell>
          <md-table-cell head scope="col">${t('table.lastValuation')}</md-table-cell>
          <md-table-cell head scope="col">${t('table.basis')}</md-table-cell>
        </md-table-row>
      </md-table-head>
      <md-table-body>
        ${collateral.map(
          (item) => html`<md-table-row${attrs({ value: item.id })}>
            <md-table-cell>${t(item.typeKey)}</md-table-cell>
            <md-table-cell>${item.currency}</md-table-cell>
            <md-table-cell numeric>${t.formatCurrency(item.valuation, { currency: item.currency, notation: 'compact' })}</md-table-cell>
            <md-table-cell numeric>${t.formatCurrency(item.valuationEur, { notation: 'compact' })}</md-table-cell>
            <md-table-cell numeric>${t.formatPercent(item.haircutPct, { maximumFractionDigits: 0 })}</md-table-cell>
            <md-table-cell numeric>${t.formatCurrency(item.netValue, { notation: 'compact' })}</md-table-cell>
            <md-table-cell>${t.formatDate(item.lastValuationDate, 'medium')}</md-table-cell>
            <md-table-cell>${t(item.valuationBasisKey)}</md-table-cell>
          </md-table-row>`,
        )}
      </md-table-body>
      <md-table-foot>
        <md-table-row rowgroup="foot">
          <!-- head + scope="row" makes this a rowheader, which is what
               associates the net-collateral figure with the word Total.
               scope without head is inert. -->
          <md-table-cell head scope="row">${t('common.total')}</md-table-cell>
          <md-table-cell></md-table-cell>
          <md-table-cell></md-table-cell>
          <md-table-cell></md-table-cell>
          <md-table-cell></md-table-cell>
          <md-table-cell numeric>${t.formatCurrency(netCollateral, { notation: 'compact' })}</md-table-cell>
          <md-table-cell></md-table-cell>
          <md-table-cell></md-table-cell>
        </md-table-row>
      </md-table-foot>
    </md-table>
  </md-table-container>`;

  const scheduleTable = html`<md-table-container variant="outlined">
    <md-table${attrs({
      label: t('table.tenor'),
      'column-template': TABLES.schedule.columns,
      'min-width': TABLES.schedule.minWidth,
      striped: true,
    })}>
      <md-table-head>
        <md-table-row rowgroup="head">
          <md-table-cell head scope="col">${t('table.quarter')}</md-table-cell>
          <md-table-cell head scope="col" numeric>${t('table.commitment')}</md-table-cell>
          <md-table-cell head scope="col" numeric>${t('table.drawn')}</md-table-cell>
          <md-table-cell head scope="col" numeric>${t('table.undrawn')}</md-table-cell>
          <!-- No dictionary key for "movement in the drawn balance"; the delta
               sign is composed onto the translated noun the same way
               table.elDelta composes it in the dictionary itself. -->
          <md-table-cell head scope="col" numeric>${`Δ ${t('table.drawn')}`}</md-table-cell>
          <md-table-cell head scope="col" numeric>${t('table.utilisation')}</md-table-cell>
        </md-table-row>
      </md-table-head>
      <md-table-body>
        ${schedule.map(
          (row, index) => html`<md-table-row${attrs({ value: row.quarter })}>
            <md-table-cell>${row.quarter}</md-table-cell>
            <md-table-cell numeric>${t.formatCurrency(row.commitment, { ...local, notation: 'compact' })}</md-table-cell>
            <md-table-cell numeric>${t.formatCurrency(row.drawn, { ...local, notation: 'compact' })}</md-table-cell>
            <md-table-cell numeric>${t.formatCurrency(row.undrawn, { ...local, notation: 'compact' })}</md-table-cell>
            <md-table-cell numeric>
              <span${attrs({
                style: style({
                  color:
                    row.movement < 0
                      ? 'var(--md-sys-color-success)'
                      : row.movement > 0
                        ? 'var(--md-sys-color-error)'
                        : undefined,
                }),
              })}>${
                /* The opening row has nothing to move against, so it reads n/a.
                   A genuine zero movement in a later quarter is a real number
                   and is printed as one. Movements are money in the facility's
                   own currency, like the columns beside them — a bare number
                   here would read as euros. */
                index === 0
                  ? t('common.na')
                  : t.formatCurrency(row.movement, { ...local, notation: 'compact' })
              }</span>
            </md-table-cell>
            <md-table-cell numeric>${t.formatPercent(row.utilisation, { maximumFractionDigits: 0 })}</md-table-cell>
          </md-table-row>`,
        )}
      </md-table-body>
    </md-table>
  </md-table-container>`;

  const children = html`<section class="grid-2">
      ${panel({
        title: t('table.facility'),
        subtitle: t(facility.typeKey),
        children: html`<dl class="dl dl--numeric">
            ${fact(t('table.currency'), facility.currency)}
            ${fact(t('table.commitment'), t.formatCurrency(facility.commitment, { ...local, notation: 'compact' }))}
            ${fact(t('table.drawn'), t.formatCurrency(facility.drawn, { ...local, notation: 'compact' }))}
            ${fact(t('table.undrawn'), t.formatCurrency(facility.undrawn, { ...local, notation: 'compact' }))}
            ${fact(t('table.ead'), t.formatCurrency(facility.ead, { notation: 'compact' }))}
            ${fact(t('table.ccf'), t.formatPercent(facility.ccf, { maximumFractionDigits: 0 }))}
            ${fact(t('table.margin'), t('unit.bps', { value: t.formatNumber(facility.marginBps) }))}
            ${fact(t('table.maturity'), t.formatDate(facility.maturityDate, 'long'))}
            ${fact(t('table.tenor'), t('unit.months', { value: t.formatNumber(facility.monthsToMaturity) }))}
          </dl>
          ${ratioMeter(t, {
            label: t('kpi.utilisation'),
            fraction: facility.utilisation,
            color: utilisationColor(facility.utilisation),
          })}`,
      })}

      ${panel({
        title: t('screen.covenants.title'),
        subtitle: t('screen.covenants.subtitle', {
          breaches: covenants.filter((c) => c.status === 'breach').length,
          watch: covenants.filter((c) => c.status === 'watch').length,
        }),
        children:
          covenants.length === 0
            ? emptyState(t, t('empty.covenants'))
            : html`<div class="stack">${covenants.map((covenant) => covenantMeter(t, covenant))}</div>`,
      })}
    </section>

    ${panel({
      title: t('screen.collateral.title'),
      subtitle: t('screen.collateral.subtitle'),
      actions:
        collateral.length > 0
          ? html`<md-chip${attrs({
              variant: 'assist',
              appearance: 'filled',
              color: coverage >= 1 ? 'success' : coverage >= 0.5 ? 'warning' : 'error',
              label: `${t('kpi.collateralCoverage')} ${t.formatPercent(coverage, { maximumFractionDigits: 0 })}`,
            })}></md-chip>`
          : null,
      children: collateral.length === 0 ? emptyState(t, t('empty.collateral')) : collateralTable,
    })}

    ${panel({
      title: t('table.tenor'),
      subtitle: t('unit.months', { value: t.formatNumber(facility.monthsToMaturity) }),
      children: scheduleTable,
    })}`;

  return screen(t, {
    locale,
    here: route.facility(facility.id),
    title: `${facility.id} · ${t(facility.typeKey)}`,
    subtitle: facility.counterpartyName,
    crumbs: [
      { label: t('nav.overview'), href: route.overview() },
      ...(counterparty
        ? [
            { label: t(`sector.${counterparty.sectorId}`), href: route.sector(counterparty.sectorId) },
            { label: counterparty.legalName, href: route.counterparty(counterparty.id) },
          ]
        : []),
      { label: facility.id },
    ],
    aside,
    children,
  });
}
