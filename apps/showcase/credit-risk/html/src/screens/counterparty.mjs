/**
 * Screen 3 — the obligor. Header, then three tabs.
 *
 * TABS. `md-tabs` owns the strip and `md-tab-panels` follows it by `for`; the
 * panels are matched to the tabs by DOM order, so the two lists must stay the
 * same length and the same order. All three panels are written into the file —
 * the panel component hides the inactive ones — which is what we want here: the
 * static HTML carries the rating history and the group tree even if the visitor
 * never opens those tabs, and a text search finds them either way.
 *
 * GROUP STRUCTURE. `getGroupTree()` genuinely nests (grp-nordwerk is three deep:
 * cp-04 → cp-05 → cp-07), so the org chart is a real hierarchy rather than a
 * flat list with a header. Each node's second line carries that entity's own
 * exposure, which is the number that makes the tree worth drawing.
 */

import {
  getCounterpartyById,
  getGroupTree,
  getRatingHistory,
  REPORTING_QUARTER,
} from '@awc-ui/showcase-kit/data';
import { route, utilisationColor } from '@awc-ui/showcase-kit/credit-risk';
import { attrs, html } from '../lib/html.mjs';
import { lineChart, organizationChart } from '../lib/charts.mjs';
import { fact, ratingChip, ratioMeter, watchDot } from '../lib/bits.mjs';
import { emptyState, panel, screen } from '../components/shell.mjs';
import { facilityTable } from '../components/tables.mjs';

export function counterpartyScreen(t, locale, counterpartyId) {
  const cp = getCounterpartyById(counterpartyId);
  if (!cp) throw new Error(`[credit-risk] unknown counterparty: ${counterpartyId}`);

  const history = getRatingHistory(cp.id);
  const tree = cp.groupId ? getGroupTree(cp.groupId) : null;
  const tabsId = `cp-tabs-${cp.id}`;

  const toNode = (node) => ({
    id: node.counterparty.id,
    name: node.counterparty.legalName,
    title: `${t.formatCurrency(node.counterparty.ead, { notation: 'compact' })} · ${t(`rating.${node.counterparty.ratingLabel}`)}`,
    avatarInitials: node.counterparty.legalName.slice(0, 2).toUpperCase(),
    children: node.children.map(toNode),
  });
  const orgNodes = tree ? [toNode(tree.root)] : [];

  const aside = html`${watchDot(t, cp.watchlist)}
    ${ratingChip(t, cp.ratingLabel, cp.ratingBand, cp.grade)}
    ${cp.watchlist
      ? html`<md-chip${attrs({
          variant: 'assist',
          appearance: 'filled',
          color: 'error',
          icon: 'warning',
          label: t('common.of', { count: cp.signalCount, total: cp.signalCount }),
          title: t('screen.watchlist.title'),
        })}></md-chip>`
      : null}`;

  const children = html`<section class="grid-2">
      ${panel({
        title: t('kpi.ead'),
        subtitle: t('app.reportingQuarter', { quarter: REPORTING_QUARTER }),
        children: html`<dl class="dl dl--numeric">
            ${fact(t('kpi.ead'), t.formatCurrency(cp.ead, { notation: 'compact' }))}
            ${fact(t('kpi.limit'), t.formatCurrency(cp.limit, { notation: 'compact' }))}
            ${fact(t('kpi.drawn'), t.formatCurrency(cp.drawn, { notation: 'compact' }))}
            ${fact(t('kpi.undrawn'), t.formatCurrency(cp.undrawn, { notation: 'compact' }))}
            ${fact(t('table.pd'), t.formatPercent(cp.pd, { maximumFractionDigits: 2 }))}
            ${fact(t('table.lgd'), t.formatPercent(cp.lgd, { maximumFractionDigits: 0 }))}
            ${fact(t('kpi.expectedLoss'), t.formatCurrency(cp.expectedLoss, { notation: 'compact' }))}
            ${fact(t('kpi.rwa'), t.formatCurrency(cp.rwa, { notation: 'compact' }))}
            ${fact(t('table.rwaDensity'), t.formatPercent(cp.rwaDensity, { maximumFractionDigits: 0 }))}
          </dl>
          ${ratioMeter(t, {
            label: t('kpi.utilisation'),
            fraction: cp.utilisation,
            color: utilisationColor(cp.utilisation),
          })}`,
      })}

      ${panel({
        title: t('table.manager'),
        subtitle: cp.relationshipManager,
        children: html`<dl class="dl">
          ${fact(t('table.onboarded'), t.formatDate(cp.onboardedDate, 'medium'))}
          ${fact(t('table.lastReview'), t.formatDate(cp.lastReviewDate, 'medium'))}
          ${fact(t('table.nextReview'), t.formatDate(cp.nextReviewDate, 'medium'))}
          ${fact(t('table.band'), t(`ratingBand.${cp.ratingBand}`))}
          ${fact(t('table.facilities'), t.formatNumber(cp.facilityCount))}
          ${fact(t('table.group'), tree ? tree.name : t('common.none'))}
        </dl>`,
      })}
    </section>

    ${panel({
      children: html`<md-tabs${attrs({
          id: tabsId,
          'aria-label': t('nav.label'),
          variant: 'primary',
          'tab-width': 'auto',
          divider: 'full',
        })}>
          <md-tab${attrs({ label: t('nav.facilities'), icon: 'account_balance_wallet', 'inline-icon': true })}></md-tab>
          <md-tab${attrs({ label: t('rating.history'), icon: 'timeline', 'inline-icon': true })}></md-tab>
          <md-tab${attrs({ label: t('nav.groups'), icon: 'account_tree', 'inline-icon': true })}></md-tab>
        </md-tabs>

        <md-tab-panels${attrs({ for: tabsId, sizing: 'stable' })}>
          <md-tab-panel>${facilityTable(t, { locale, counterpartyId: cp.id })}</md-tab-panel>

          <md-tab-panel>
            <div class="stack">
              ${lineChart({
                series: [{ label: t('table.pd'), data: history.map((o) => o.pd) }],
                config: {
                  xAxis: { data: history.map((o) => o.quarter), scale: 'category' },
                  yAxis: { label: t('table.pd'), min: 0 },
                  format: 'percent',
                },
                attributes: {
                  curve: 'monotone',
                  'show-marks': true,
                  grid: 'horizontal',
                  'axis-ticks': true,
                  legend: 'none',
                  height: '300px',
                  label: t('rating.history'),
                  subtitle: t('rating.historyHint', { quarter: REPORTING_QUARTER }),
                  summary: t('chart.summary.line', { label: t('rating.history'), count: 1 }),
                },
              })}
              <div class="row">
                ${history.map(
                  (observation) => html`<md-chip${attrs({
                    variant: 'assist',
                    appearance: 'outlined',
                    label: `${observation.quarter} · ${t(`rating.${observation.label}`)}`,
                    title: t('rating.gradeLabel', { grade: observation.grade }),
                  })}></md-chip>`,
                )}
              </div>
            </div>
          </md-tab-panel>

          <md-tab-panel>
            ${tree
              ? html`<div class="stack">
                  <dl class="dl">
                    ${fact(t('table.group'), tree.name)}
                    ${fact(t('kpi.counterparties'), t.formatNumber(tree.memberCount))}
                    ${fact(t('kpi.ead'), t.formatCurrency(tree.totals.ead, { notation: 'compact' }))}
                    ${fact(t('kpi.expectedLoss'), t.formatCurrency(tree.totals.expectedLoss, { notation: 'compact' }))}
                    ${fact(t('kpi.rwa'), t.formatCurrency(tree.totals.rwa, { notation: 'compact' }))}
                    ${fact(t('kpi.weightedAvgPd'), t.formatPercent(tree.totals.weightedAvgPd, { maximumFractionDigits: 2 }))}
                  </dl>
                  ${organizationChart({
                    nodes: orgNodes,
                    attributes: {
                      label: t('screen.groups.title'),
                      'expand-label': t('action.expand'),
                      'collapse-label': t('action.collapse'),
                      orientation: 'vertical',
                    },
                  })}
                </div>`
              : emptyState(t, t('screen.groups.subtitle'))}
          </md-tab-panel>
        </md-tab-panels>`,
    })}`;

  return screen(t, {
    locale,
    here: route.counterparty(cp.id),
    title: cp.legalName,
    subtitle: t('screen.counterparty.subtitle', {
      id: cp.id,
      sector: t(`sector.${cp.sectorId}`),
      country: t(`country.${cp.country}`),
    }),
    crumbs: [
      { label: t('nav.overview'), href: route.overview() },
      { label: t(`sector.${cp.sectorId}`), href: route.sector(cp.sectorId) },
      { label: cp.legalName },
    ],
    aside,
    children,
  });
}
