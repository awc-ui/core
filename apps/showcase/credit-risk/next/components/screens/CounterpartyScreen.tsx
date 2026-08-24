'use client';

/**
 * Screen 3 — the obligor. Header, then three tabs.
 *
 * TABS. `md-tabs` owns the strip and `md-tab-panels` follows it by `for`; the
 * panels are matched to the tabs by DOM order, so the two lists must stay the
 * same length and the same order. All three panels are rendered into the export
 * — the panel component hides the inactive ones — which is what we want: the
 * static HTML carries the rating history and the group tree even if the visitor
 * never opens those tabs.
 *
 * GROUP STRUCTURE. `getGroupTree()` genuinely nests (grp-nordwerk is three deep:
 * cp-04 → cp-05 → cp-07), so the org chart is a real hierarchy rather than a
 * flat list with a header. Each node's second line carries that entity's own
 * exposure, which is the number that makes the tree worth drawing.
 */

import { useMemo } from 'react';
import {
  getCounterpartyById,
  getGroupTree,
  getRatingHistory,
  REPORTING_QUARTER,
  type Counterparty,
  type GroupTreeNode,
} from '@awc-ui/showcase-kit/data';
import { useShowcase, useT } from '@/lib/showcase';
import { route } from '@/lib/routes';
import { utilisationColor } from '@awc-ui/showcase-kit/credit-risk';
import { LineChart, OrganizationChart, type OrgNode } from '../elements';
import { EmptyState, Panel, Screen } from '../Shell';
import { Fact, RatingChip, RatioMeter, WatchDot } from '../bits';
import { FacilityTable } from '../FacilityTable';

export function CounterpartyScreen({ counterpartyId }: { counterpartyId: string }) {
  const t = useT();
  const { state } = useShowcase();
  const cp = getCounterpartyById(counterpartyId) as Counterparty | undefined;
  const history = useMemo(() => (cp ? getRatingHistory(cp.id) : []), [cp]);
  const tree = useMemo(() => (cp?.groupId ? getGroupTree(cp.groupId) : null), [cp]);

  const percent = useMemo(
    () => (v: number | null) => t.formatPercent(v ?? 0, { maximumFractionDigits: 2 }),
    [t],
  );

  const orgNodes = useMemo<OrgNode[]>(() => {
    if (!tree) return [];
    const toNode = (node: GroupTreeNode): OrgNode => ({
      id: node.counterparty.id,
      name: node.counterparty.legalName,
      title: `${t.formatCurrency(node.counterparty.ead, { notation: 'compact' })} · ${t(`rating.${node.counterparty.ratingLabel}`)}`,
      avatarInitials: node.counterparty.legalName.slice(0, 2).toUpperCase(),
      children: node.children.map(toNode),
    });
    return [toNode(tree.root)];
  }, [tree, t]);

  if (!cp) {
    return (
      <Screen title={t('empty.generic')} subtitle={t('empty.hint')}>
        <Panel>
          <p className="muted">{t('empty.generic')}</p>
        </Panel>
      </Screen>
    );
  }

  const tabsId = `cp-tabs-${cp.id}`;

  return (
    <Screen
      title={cp.legalName}
      subtitle={t('screen.counterparty.subtitle', {
        id: cp.id,
        sector: t(`sector.${cp.sectorId}`),
        country: t(`country.${cp.country}`),
      })}
      crumbs={[
        { label: t('nav.overview'), href: route.overview() },
        { label: t(`sector.${cp.sectorId}`), href: route.sector(cp.sectorId) },
        { label: cp.legalName },
      ]}
      aside={
        <>
          <WatchDot on={cp.watchlist} />
          <RatingChip label={cp.ratingLabel} band={cp.ratingBand} grade={cp.grade} />
          {cp.watchlist ? (
            <md-chip
              variant="assist"
              appearance="filled"
              color="error"
              icon="warning"
              label={t('common.of', { count: cp.signalCount, total: cp.signalCount })}
              title={t('screen.watchlist.title')}
            />
          ) : null}
        </>
      }
    >
      <section className="grid-2">
        <Panel title={t('kpi.ead')} subtitle={t('app.reportingQuarter', { quarter: REPORTING_QUARTER })}>
          <dl className="dl dl--numeric">
            <Fact label={t('kpi.ead')}>{t.formatCurrency(cp.ead, { notation: 'compact' })}</Fact>
            <Fact label={t('kpi.limit')}>{t.formatCurrency(cp.limit, { notation: 'compact' })}</Fact>
            <Fact label={t('kpi.drawn')}>{t.formatCurrency(cp.drawn, { notation: 'compact' })}</Fact>
            <Fact label={t('kpi.undrawn')}>{t.formatCurrency(cp.undrawn, { notation: 'compact' })}</Fact>
            <Fact label={t('table.pd')}>{t.formatPercent(cp.pd, { maximumFractionDigits: 2 })}</Fact>
            <Fact label={t('table.lgd')}>{t.formatPercent(cp.lgd, { maximumFractionDigits: 0 })}</Fact>
            <Fact label={t('kpi.expectedLoss')}>
              {t.formatCurrency(cp.expectedLoss, { notation: 'compact' })}
            </Fact>
            <Fact label={t('kpi.rwa')}>{t.formatCurrency(cp.rwa, { notation: 'compact' })}</Fact>
            <Fact label={t('table.rwaDensity')}>
              {t.formatPercent(cp.rwaDensity, { maximumFractionDigits: 0 })}
            </Fact>
          </dl>
          <RatioMeter
            label={t('kpi.utilisation')}
            fraction={cp.utilisation}
            color={utilisationColor(cp.utilisation)}
          />
        </Panel>

        <Panel title={t('table.manager')} subtitle={cp.relationshipManager}>
          <dl className="dl">
            <Fact label={t('table.onboarded')}>{t.formatDate(cp.onboardedDate, 'medium')}</Fact>
            <Fact label={t('table.lastReview')}>{t.formatDate(cp.lastReviewDate, 'medium')}</Fact>
            <Fact label={t('table.nextReview')}>{t.formatDate(cp.nextReviewDate, 'medium')}</Fact>
            <Fact label={t('table.band')}>{t(`ratingBand.${cp.ratingBand}`)}</Fact>
            <Fact label={t('table.facilities')}>{t.formatNumber(cp.facilityCount)}</Fact>
            <Fact label={t('table.group')}>{tree ? tree.name : t('common.none')}</Fact>
          </dl>
        </Panel>
      </section>

      <Panel>
        <md-tabs id={tabsId} aria-label={t('nav.label')} variant="primary" tab-width="auto" divider="full">
          <md-tab label={t('nav.facilities')} icon="account_balance_wallet" inline-icon />
          <md-tab label={t('rating.history')} icon="timeline" inline-icon />
          <md-tab label={t('nav.groups')} icon="account_tree" inline-icon />
        </md-tabs>

        <md-tab-panels for={tabsId} sizing="stable">
          <md-tab-panel>
            <FacilityTable counterpartyId={cp.id} />
          </md-tab-panel>

          <md-tab-panel>
            <div className="stack">
              <LineChart
                series={[{ label: t('table.pd'), data: history.map((o) => o.pd) }]}
                xAxis={{ data: history.map((o) => o.quarter), scale: 'category' }}
                yAxis={{ label: t('table.pd'), min: 0 }}
                valueFormatter={percent}
                locale={state.locale}
                curve="monotone"
                show-marks
                grid="horizontal"
                axis-ticks
                legend="none"
                height="300px"
                label={t('rating.history')}
                subtitle={t('rating.historyHint', { quarter: REPORTING_QUARTER })}
                summary={t('chart.summary.line', { label: t('rating.history'), count: 1 })}
              />
              <div className="row">
                {history.map((observation) => (
                  <md-chip
                    key={observation.quarter}
                    variant="assist"
                    appearance="outlined"
                    label={`${observation.quarter} · ${t(`rating.${observation.label}`)}`}
                    title={t('rating.gradeLabel', { grade: observation.grade })}
                  />
                ))}
              </div>
            </div>
          </md-tab-panel>

          <md-tab-panel>
            {tree ? (
              <div className="stack">
                <dl className="dl">
                  <Fact label={t('table.group')}>{tree.name}</Fact>
                  <Fact label={t('kpi.counterparties')}>{t.formatNumber(tree.memberCount)}</Fact>
                  <Fact label={t('kpi.ead')}>{t.formatCurrency(tree.totals.ead, { notation: 'compact' })}</Fact>
                  <Fact label={t('kpi.expectedLoss')}>
                    {t.formatCurrency(tree.totals.expectedLoss, { notation: 'compact' })}
                  </Fact>
                  <Fact label={t('kpi.rwa')}>{t.formatCurrency(tree.totals.rwa, { notation: 'compact' })}</Fact>
                  <Fact label={t('kpi.weightedAvgPd')}>
                    {t.formatPercent(tree.totals.weightedAvgPd, { maximumFractionDigits: 2 })}
                  </Fact>
                </dl>
                <OrganizationChart
                  nodes={orgNodes}
                  label={t('screen.groups.title')}
                  expand-label={t('action.expand')}
                  collapse-label={t('action.collapse')}
                  orientation="vertical"
                />
              </div>
            ) : (
              <EmptyState message={t('screen.groups.subtitle')} />
            )}
          </md-tab-panel>
        </md-tab-panels>
      </Panel>
    </Screen>
  );
}
