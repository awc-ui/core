import { Component, CUSTOM_ELEMENTS_SCHEMA, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  getCounterpartyById,
  getGroupTree,
  getRatingHistory,
  REPORTING_QUARTER,
  type Counterparty,
  type GroupTreeNode,
} from '@awc-ui/showcase-kit/data';
import { utilisationColor } from '@awc-ui/showcase-kit/credit-risk';
import { ShowcaseComponent } from '../lib/screen.base';
import { ShellComponent, type Crumb } from '../components/shell.component';
import { PanelComponent } from '../components/panel.component';
import { ChartComponent } from '../components/chart.component';
import { OrgChartComponent, type OrgNode } from '../components/org-chart.component';
import { EmptyStateComponent } from '../components/empty-state.component';
import { FacilityTableComponent } from '../components/facility-table.component';
import {
  ChipComponent,
  DotComponent,
  FactComponent,
  RatioMeterComponent,
} from '../components/bits.component';

/**
 * Screen 3 — the obligor. Header, then three tabs.
 *
 * TABS. `md-tabs` owns the strip and `md-tab-panels` follows it by `for`; the
 * panels are matched to the tabs by DOM order, so the two lists must stay the
 * same length and the same order. All three panels are rendered — the panel
 * component hides the inactive ones — which is what we want: switching tab is
 * then a style change rather than a render, the rating history and the group
 * tree are in the DOM for anything reading the page rather than clicking it, and
 * find-in-page reaches all three.
 *
 * GROUP STRUCTURE. `getGroupTree()` genuinely nests (grp-nordwerk is three deep:
 * cp-04 → cp-05 → cp-07), so the org chart is a real hierarchy rather than a
 * flat list with a header. Each node's second line carries that entity's own
 * exposure, which is the number that makes the tree worth drawing.
 */
@Component({
  selector: 'awc-counterparty-screen',
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [
    ShellComponent,
    PanelComponent,
    ChartComponent,
    OrgChartComponent,
    EmptyStateComponent,
    FacilityTableComponent,
    ChipComponent,
    DotComponent,
    FactComponent,
    RatioMeterComponent,
  ],
  template: `
    <awc-shell
      [title]="cp.legalName"
      [subtitle]="
        t('screen.counterparty.subtitle', {
          id: cp.id,
          sector: t('sector.' + cp.sectorId),
          country: t('country.' + cp.country)
        })
      "
      [crumbs]="crumbs"
    >
      <ng-container aside>
        <md-status-dot awcDot kind="watch" [value]="cp.watchlist"></md-status-dot>
        <md-chip awcChip kind="rating" [value]="cp.ratingLabel" [band]="cp.ratingBand" [grade]="cp.grade"></md-chip>
        @if (cp.watchlist) {
          <md-chip
            variant="assist"
            appearance="filled"
            color="error"
            icon="warning"
            [attr.label]="t('common.of', { count: cp.signalCount, total: cp.signalCount })"
            [attr.title]="t('screen.watchlist.title')"
          ></md-chip>
        }
      </ng-container>

      <section class="grid-2">
        <awc-panel
          [title]="t('kpi.ead')"
          [subtitle]="t('app.reportingQuarter', { quarter: reportingQuarter })"
        >
          <dl class="dl dl--numeric">
            <div awcFact [label]="t('kpi.ead')">
              {{ t.formatCurrency(cp.ead, { notation: 'compact' }) }}
            </div>
            <div awcFact [label]="t('kpi.limit')">
              {{ t.formatCurrency(cp.limit, { notation: 'compact' }) }}
            </div>
            <div awcFact [label]="t('kpi.drawn')">
              {{ t.formatCurrency(cp.drawn, { notation: 'compact' }) }}
            </div>
            <div awcFact [label]="t('kpi.undrawn')">
              {{ t.formatCurrency(cp.undrawn, { notation: 'compact' }) }}
            </div>
            <div awcFact [label]="t('table.pd')">
              {{ t.formatPercent(cp.pd, { maximumFractionDigits: 2 }) }}
            </div>
            <div awcFact [label]="t('table.lgd')">
              {{ t.formatPercent(cp.lgd, { maximumFractionDigits: 0 }) }}
            </div>
            <div awcFact [label]="t('kpi.expectedLoss')">
              {{ t.formatCurrency(cp.expectedLoss, { notation: 'compact' }) }}
            </div>
            <div awcFact [label]="t('kpi.rwa')">
              {{ t.formatCurrency(cp.rwa, { notation: 'compact' }) }}
            </div>
            <div awcFact [label]="t('table.rwaDensity')">
              {{ t.formatPercent(cp.rwaDensity, { maximumFractionDigits: 0 }) }}
            </div>
          </dl>
          <awc-ratio-meter
            [label]="t('kpi.utilisation')"
            [fraction]="cp.utilisation"
            [color]="utilisationColor(cp.utilisation)"
          />
        </awc-panel>

        <awc-panel [title]="t('table.manager')" [subtitle]="cp.relationshipManager">
          <dl class="dl">
            <div awcFact [label]="t('table.onboarded')">
              {{ t.formatDate(cp.onboardedDate, 'medium') }}
            </div>
            <div awcFact [label]="t('table.lastReview')">
              {{ t.formatDate(cp.lastReviewDate, 'medium') }}
            </div>
            <div awcFact [label]="t('table.nextReview')">
              {{ t.formatDate(cp.nextReviewDate, 'medium') }}
            </div>
            <div awcFact [label]="t('table.band')">{{ t('ratingBand.' + cp.ratingBand) }}</div>
            <div awcFact [label]="t('table.facilities')">{{ t.formatNumber(cp.facilityCount) }}</div>
            <div awcFact [label]="t('table.group')">
              {{ tree ? tree.name : t('common.none') }}
            </div>
          </dl>
        </awc-panel>
      </section>

      <awc-panel>
        <md-tabs
          [attr.id]="tabsId"
          [attr.aria-label]="t('nav.label')"
          variant="primary"
          tab-width="auto"
          divider="full"
        >
          <md-tab [attr.label]="t('nav.facilities')" icon="account_balance_wallet" inline-icon></md-tab>
          <md-tab [attr.label]="t('rating.history')" icon="timeline" inline-icon></md-tab>
          <md-tab [attr.label]="t('nav.groups')" icon="account_tree" inline-icon></md-tab>
        </md-tabs>

        <md-tab-panels [attr.for]="tabsId" sizing="stable">
          <md-tab-panel>
            <awc-facility-table [counterpartyId]="cp.id" />
          </md-tab-panel>

          <md-tab-panel>
            <div class="stack">
              <awc-chart
                tag="md-line-chart"
                [series]="pdSeries"
                [xAxis]="historyAxis"
                [yAxis]="pdAxis"
                [valueFormatter]="percent"
                curve="monotone"
                showMarks=""
                grid="horizontal"
                [axisTicks]="true"
                legend="none"
                height="300px"
                [label]="t('rating.history')"
                [subtitle]="t('rating.historyHint', { quarter: reportingQuarter })"
                [summary]="t('chart.summary.line', { label: t('rating.history'), count: 1 })"
              />
              <div class="row">
                @for (observation of history; track observation.quarter) {
                  <md-chip
                    variant="assist"
                    appearance="outlined"
                    [attr.label]="
                      observation.quarter + ' · ' + t('rating.' + observation.label)
                    "
                    [attr.title]="t('rating.gradeLabel', { grade: observation.grade })"
                  ></md-chip>
                }
              </div>
            </div>
          </md-tab-panel>

          <md-tab-panel>
            @if (tree) {
              <div class="stack">
                <dl class="dl">
                  <div awcFact [label]="t('table.group')">{{ tree.name }}</div>
                  <div awcFact [label]="t('kpi.counterparties')">
                    {{ t.formatNumber(tree.memberCount) }}
                  </div>
                  <div awcFact [label]="t('kpi.ead')">
                    {{ t.formatCurrency(tree.totals.ead, { notation: 'compact' }) }}
                  </div>
                  <div awcFact [label]="t('kpi.expectedLoss')">
                    {{ t.formatCurrency(tree.totals.expectedLoss, { notation: 'compact' }) }}
                  </div>
                  <div awcFact [label]="t('kpi.rwa')">
                    {{ t.formatCurrency(tree.totals.rwa, { notation: 'compact' }) }}
                  </div>
                  <div awcFact [label]="t('kpi.weightedAvgPd')">
                    {{ t.formatPercent(tree.totals.weightedAvgPd, { maximumFractionDigits: 2 }) }}
                  </div>
                </dl>
                <awc-org-chart [nodes]="orgNodes" />
              </div>
            } @else {
              <awc-empty-state [message]="t('screen.groups.subtitle')" />
            }
          </md-tab-panel>
        </md-tab-panels>
      </awc-panel>
    </awc-shell>
  `,
})
export class CounterpartyScreen extends ShowcaseComponent {
  private readonly activated = inject(ActivatedRoute);

  protected readonly reportingQuarter = REPORTING_QUARTER;
  protected readonly utilisationColor = utilisationColor;

  private readonly counterpartyId = String(this.activated.snapshot.paramMap.get('id'));
  protected readonly cp = getCounterpartyById(this.counterpartyId) as Counterparty;
  protected readonly history = getRatingHistory(this.counterpartyId);
  protected readonly tree = this.cp.groupId ? getGroupTree(this.cp.groupId) : null;
  protected readonly tabsId = `cp-tabs-${this.counterpartyId}`;

  protected get crumbs(): Crumb[] {
    return this.memo('crumbs', () => [
      { label: this.t('nav.overview'), href: this.route.overview() },
      { label: this.t(`sector.${this.cp.sectorId}`), href: this.route.sector(this.cp.sectorId) },
      { label: this.cp.legalName },
    ]);
  }

  protected get percent() {
    return this.memo('percent', () => (v: number | null) =>
      this.t.formatPercent(v ?? 0, { maximumFractionDigits: 2 }),
    );
  }

  protected get pdSeries() {
    return this.memo('pdSeries', () => [
      { label: this.t('table.pd'), data: this.history.map((o) => o.pd) },
    ]);
  }

  protected get historyAxis() {
    return this.memo('historyAxis', () => ({
      data: this.history.map((o) => o.quarter),
      scale: 'category',
    }));
  }

  protected get pdAxis() {
    return this.memo('pdAxis', () => ({ label: this.t('table.pd'), min: 0 }));
  }

  protected get orgNodes(): OrgNode[] {
    return this.memo('orgNodes', () => {
      const toNode = (node: GroupTreeNode): OrgNode => ({
        id: node.counterparty.id,
        name: node.counterparty.legalName,
        title: `${this.t.formatCurrency(node.counterparty.ead, { notation: 'compact' })} · ${this.t(
          `rating.${node.counterparty.ratingLabel}`,
        )}`,
        avatarInitials: node.counterparty.legalName.slice(0, 2).toUpperCase(),
        children: node.children.map(toNode),
      });
      return this.tree ? [toNode(this.tree.root)] : [];
    });
  }
}
