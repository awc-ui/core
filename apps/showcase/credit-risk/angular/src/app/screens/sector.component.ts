import { Component, CUSTOM_ELEMENTS_SCHEMA, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { getSectorById, REPORTING_QUARTER, type Sector } from '@awc-ui/showcase-kit/data';
import { quarterlySeries, utilisationColor } from '@awc-ui/showcase-kit/credit-risk';
import { ShowcaseComponent } from '../lib/screen.base';
import { ShellComponent, type Crumb } from '../components/shell.component';
import { PanelComponent } from '../components/panel.component';
import { ChartComponent } from '../components/chart.component';
import { CounterpartyTableComponent } from '../components/counterparty-table.component';
import { FactComponent, RatioMeterComponent } from '../components/bits.component';

/** House single-sector concentration guideline, as a share of portfolio EAD. */
const CONCENTRATION_CAP = 0.2;

/**
 * Screen 2 — sector detail. One rung down the drill path.
 *
 * The concentration meter compares this sector's share of portfolio EAD against
 * a 20% single-sector guideline, which is why it is drawn on a 0–20% scale
 * rather than 0–100%: on a 0–100% scale every sector looks safe and the meter
 * says nothing. Beside it, utilisation of the committed limit on its own 0–100%
 * scale. Both take their colour from the same thresholds the counterparty table
 * uses.
 */
@Component({
  selector: 'awc-sector-screen',
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [
    ShellComponent,
    PanelComponent,
    ChartComponent,
    CounterpartyTableComponent,
    FactComponent,
    RatioMeterComponent,
  ],
  template: `
    <awc-shell
      [title]="t(sector.nameKey)"
      [subtitle]="t('screen.counterparties.subtitle', { count: sector.counterpartyCount })"
      [crumbs]="crumbs"
    >
      <ng-container aside>
        <md-chip
          variant="assist"
          appearance="filled"
          [attr.color]="share > cap ? 'error' : 'secondary'"
          icon="donut_large"
          [attr.label]="
            t('table.share') + ' ' + t.formatPercent(share, { maximumFractionDigits: 1 })
          "
        ></md-chip>
      </ng-container>

      <section class="grid-2">
        <awc-panel [title]="t('table.share')" [subtitle]="t('kpi.ead')">
          <awc-ratio-meter
            [label]="t('table.share')"
            [fraction]="share"
            [max]="cap"
            [color]="share > cap ? 'error' : 'primary'"
          />
          <awc-ratio-meter
            [label]="t('kpi.utilisation')"
            [fraction]="sector.utilisation"
            [color]="utilisationColor(sector.utilisation)"
          />
          <dl class="dl dl--numeric">
            <div awcFact [label]="t('kpi.ead')">
              {{ t.formatCurrency(sector.ead, { notation: 'compact' }) }}
            </div>
            <div awcFact [label]="t('kpi.limit')">
              {{ t.formatCurrency(sector.limit, { notation: 'compact' }) }}
            </div>
            <div awcFact [label]="t('kpi.drawn')">
              {{ t.formatCurrency(sector.drawn, { notation: 'compact' }) }}
            </div>
            <div awcFact [label]="t('kpi.undrawn')">
              {{ t.formatCurrency(sector.undrawn, { notation: 'compact' }) }}
            </div>
            <div awcFact [label]="t('kpi.expectedLoss')">
              {{ t.formatCurrency(sector.expectedLoss, { notation: 'compact' }) }}
            </div>
            <div awcFact [label]="t('kpi.rwa')">
              {{ t.formatCurrency(sector.rwa, { notation: 'compact' }) }}
            </div>
            <div awcFact [label]="t('kpi.weightedAvgPd')">
              {{ t.formatPercent(sector.weightedAvgPd, { maximumFractionDigits: 2 }) }}
            </div>
            <div awcFact [label]="t('kpi.weightedAvgLgd')">
              {{ t.formatPercent(sector.weightedAvgLgd, { maximumFractionDigits: 1 }) }}
            </div>
            <div awcFact [label]="t('kpi.facilities')">
              {{ t.formatNumber(sector.facilityCount) }}
            </div>
          </dl>
        </awc-panel>

        <!-- No panel title: the chart carries its own header, which is also its
             accessible name.

             TWO SCALES, NOT ONE. Expected loss runs in single-digit millions
             while RWA runs in hundreds of millions, so on a shared axis the EL
             line flattens onto the baseline and reads as zero. Each series gets
             its own axis (yAxes plus a per-series yAxisIndex) — EL on the left,
             RWA on the right — so both curves are legible at their own scale. A
             broken axis would have been the other option, but it distorts slope,
             and slope is the whole point of a trend chart. -->
        <awc-panel>
          <awc-chart
            tag="md-line-chart"
            [series]="trendSeries"
            [xAxis]="quarterAxis"
            [yAxes]="dualAxes"
            [valueFormatter]="money"
            curve="monotone"
            showMarks=""
            grid="horizontal"
            [axisTicks]="true"
            legend="top-end"
            height="340px"
            [label]="t('kpi.expectedLoss') + ' · ' + t('kpi.rwa')"
            [subtitle]="t('rating.historyHint', { quarter: reportingQuarter })"
            [summary]="
              t('chart.summary.line', {
                label: t('kpi.expectedLoss') + ' · ' + t('kpi.rwa'),
                count: 2
              })
            "
          />
        </awc-panel>
      </section>

      <awc-panel
        [title]="t('screen.counterparties.title')"
        [subtitle]="t('screen.counterparties.subtitle', { count: sector.counterpartyCount })"
      >
        <awc-counterparty-table [sectorId]="sector.id" [showSector]="false" />
      </awc-panel>
    </awc-shell>
  `,
})
export class SectorScreen extends ShowcaseComponent {
  private readonly activated = inject(ActivatedRoute);

  protected readonly cap = CONCENTRATION_CAP;
  protected readonly reportingQuarter = REPORTING_QUARTER;
  protected readonly utilisationColor = utilisationColor;

  protected readonly sectorId = String(this.activated.snapshot.paramMap.get('sector'));
  protected readonly sector = getSectorById(this.sectorId) as Sector;
  private readonly quarters = quarterlySeries(this.sectorId as Sector['id']);

  protected get share(): number {
    return this.sector.portfolioShare;
  }

  protected get crumbs(): Crumb[] {
    return this.memo('crumbs', () => [
      { label: this.t('nav.overview'), href: this.route.overview() },
      { label: this.t(this.sector.nameKey) },
    ]);
  }

  protected get money() {
    return this.memo('money', () => (v: number | null) =>
      this.t.formatCurrency(v ?? 0, { notation: 'compact' }),
    );
  }

  protected get quarterAxis() {
    return this.memo('quarterAxis', () => ({
      data: this.quarters.map((q) => q.quarter),
      scale: 'category',
    }));
  }

  protected get trendSeries() {
    return this.memo('trendSeries', () => [
      { label: this.t('kpi.expectedLoss'), data: this.quarters.map((q) => q.expectedLoss) },
      { label: this.t('kpi.rwa'), data: this.quarters.map((q) => q.rwa), yAxisIndex: 1 },
    ]);
  }

  protected get dualAxes() {
    return this.memo('dualAxes', () => [
      { label: this.t('kpi.expectedLoss'), min: 0, valueFormatter: this.money },
      { label: this.t('kpi.rwa'), min: 0, position: 'right', valueFormatter: this.money },
    ]);
  }
}
