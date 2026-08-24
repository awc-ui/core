import { Component, CUSTOM_ELEMENTS_SCHEMA, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  getCounterparties,
  getPortfolioTotals,
  getRatingScale,
  getSectors,
  REPORTING_DATE,
  REPORTING_QUARTER,
} from '@awc-ui/showcase-kit/data';
import { monthlyEadSeries, quarterlySeries } from '@awc-ui/showcase-kit/credit-risk';
import { ShowcaseComponent } from '../lib/screen.base';
import { ShellComponent } from '../components/shell.component';
import { PanelComponent } from '../components/panel.component';
import { ChartComponent } from '../components/chart.component';
import { SparklineComponent } from '../components/sparkline.component';
import { CounterpartyTableComponent } from '../components/counterparty-table.component';
import { KpiTileComponent } from '../components/bits.component';

/**
 * Screen 1 — portfolio overview, and the head of the drill path.
 *
 * Four KPI tiles, each with its own eight-quarter sparkline; exposure by sector;
 * the rating distribution; the exposure trend split by rating band; and the
 * whole counterparty book, paged. Both the sector bars and the table rows are
 * doors: sector bars drill on click, counterparty names are anchors.
 *
 * Every trend on this screen is computed by `@awc-ui/showcase-kit/credit-risk`
 * from the fixture's rating history, calibrated so the last point of a series
 * equals the KPI above it.
 */
@Component({
  selector: 'awc-overview-screen',
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [
    ShellComponent,
    PanelComponent,
    ChartComponent,
    SparklineComponent,
    CounterpartyTableComponent,
    KpiTileComponent,
    RouterLink,
  ],
  template: `
    <awc-shell
      [title]="t('screen.overview.title')"
      [subtitle]="t('screen.overview.subtitle', { date: t.formatDate(reportingDate, 'long') })"
    >
      <ng-container aside>
        <md-chip
          variant="assist"
          appearance="outlined"
          icon="account_balance"
          [attr.label]="t('common.of', { count: totals.counterpartyCount, total: totals.facilityCount })"
          [attr.title]="t('kpi.counterparties') + ' / ' + t('kpi.facilities')"
        ></md-chip>
        <!--
          The badge is a SIBLING of the button, not slotted into it. md-badge
          anchors absolutely and translates itself past its host's corner;
          md-button sets overflow: hidden with no accommodation for that, so a
          slotted badge is sliced in half. With the badge outside, the button no
          longer contains the count, so it needs an explicit accessible name.
        -->
        <span class="badge-anchor">
          <md-button
            variant="tonal"
            size="sm"
            icon="warning"
            [attr.href]="withBase(route.watchlist())"
            [attr.aria-label]="t('kpi.watchlist') + ', ' + totals.watchlistCount"
          >
            {{ t('kpi.watchlist') }}
          </md-button>
          <md-badge [attr.value]="totals.watchlistCount"></md-badge>
        </span>
      </ng-container>

      <section class="kpi-grid">
        <awc-kpi-tile
          [label]="t('kpi.ead')"
          [value]="t.formatCurrency(totals.ead, { notation: 'compact' })"
          [hint]="t('kpi.ead.help')"
          [trend]="monthEad"
        >
          <awc-sparkline
            spark
            [data]="monthEad"
            [labels]="monthLabels"
            [valueFormatter]="money"
            color="primary"
          />
        </awc-kpi-tile>

        <awc-kpi-tile
          [label]="t('kpi.expectedLoss')"
          [value]="t.formatCurrency(totals.expectedLoss, { notation: 'compact' })"
          [hint]="
            t('kpi.expectedLossRatio') +
            ' ' +
            t.formatPercent(totals.expectedLossRatio, { maximumFractionDigits: 2 })
          "
          [trend]="quarterEl"
        >
          <awc-sparkline
            spark
            [data]="quarterEl"
            [labels]="quarterLabels"
            [valueFormatter]="money"
            color="error"
          />
        </awc-kpi-tile>

        <awc-kpi-tile
          [label]="t('kpi.rwa')"
          [value]="t.formatCurrency(totals.rwa, { notation: 'compact' })"
          [hint]="
            t('kpi.rwaDensity') + ' ' + t.formatPercent(totals.rwaDensity, { maximumFractionDigits: 1 })
          "
          [trend]="quarterRwa"
        >
          <awc-sparkline
            spark
            [data]="quarterRwa"
            [labels]="quarterLabels"
            [valueFormatter]="money"
            color="tertiary"
          />
        </awc-kpi-tile>

        <awc-kpi-tile
          [label]="t('kpi.weightedAvgPd')"
          [value]="t.formatPercent(totals.weightedAvgPd, { maximumFractionDigits: 2 })"
          [hint]="
            t('kpi.weightedAvgLgd') +
            ' ' +
            t.formatPercent(totals.weightedAvgLgd, { maximumFractionDigits: 1 })
          "
          [trend]="quarterPd"
        >
          <awc-sparkline
            spark
            [data]="quarterPd"
            [labels]="quarterLabels"
            [valueFormatter]="percent"
            color="warning"
          />
        </awc-kpi-tile>
      </section>

      <!-- The chart components render their own label/subtitle header, which is
           also their accessible name — so these panels deliberately carry no
           title of their own. Two headings saying the same thing is worse than
           one, and dropping the chart's would cost the a11y name. -->
      <section class="grid-2">
        <awc-panel>
          <awc-chart
            tag="md-bar-chart"
            [series]="sectorSeries"
            [xAxis]="sectorAxis"
            [yAxis]="eadAxis"
            [valueFormatter]="money"
            (barClick)="drillSector($event)"
            layout="horizontal"
            legend="none"
            [clickable]="true"
            cornerRadius="8"
            [axisTicks]="true"
            height="320px"
            [label]="t('kpi.ead')"
            [subtitle]="t('table.sector')"
          />
        </awc-panel>

        <awc-panel>
          <awc-chart
            tag="md-bar-chart"
            [series]="gradeSeries"
            [xAxis]="gradeAxis"
            [yAxis]="eadAxis"
            [valueFormatter]="money"
            legend="none"
            [axisTicks]="true"
            height="320px"
            [label]="t('screen.ratings.title')"
            [subtitle]="t('screen.ratings.subtitle')"
          />
        </awc-panel>
      </section>

      <awc-panel>
        <awc-chart
          tag="md-area-chart"
          [series]="bandSeries"
          [xAxis]="quarterAxis"
          [yAxis]="eadAxisFromZero"
          [valueFormatter]="money"
          stack="normal"
          curve="monotone"
          legend="top-end"
          [axisTicks]="true"
          height="300px"
          [label]="t('kpi.ead') + ' · ' + t('table.band')"
          [subtitle]="t('rating.historyHint', { quarter: reportingQuarter })"
          [summary]="
            t('chart.summary.area', { label: t('kpi.ead') + ' · ' + t('table.band'), count: 3 })
          "
        />
      </awc-panel>

      <!-- The whole book, paged — not a top-10 cap. A truncated list with a
           pagination bar underneath would read "1-10 of 10", which tells the
           reader nothing and hides the other 14 counterparties. Sorting by EAD
           desc still puts the largest exposures first. -->
      <awc-panel [title]="t('screen.counterparties.title')">
        <a actions class="drill" [routerLink]="appPath(route.watchlist())">{{ t('nav.watchlist') }}</a>
        <awc-counterparty-table />
      </awc-panel>
    </awc-shell>
  `,
})
export class OverviewScreen extends ShowcaseComponent {
  private readonly router = inject(Router);

  protected readonly reportingDate = REPORTING_DATE;
  protected readonly reportingQuarter = REPORTING_QUARTER;
  protected readonly totals = getPortfolioTotals();
  private readonly sectors = getSectors();
  private readonly scale = getRatingScale();
  private readonly quarters = quarterlySeries();
  private readonly months = monthlyEadSeries();

  protected readonly monthEad = this.months.map((m) => m.ead);
  protected readonly quarterEl = this.quarters.map((q) => q.expectedLoss);
  protected readonly quarterRwa = this.quarters.map((q) => q.rwa);
  protected readonly quarterPd = this.quarters.map((q) => q.weightedAvgPd);

  /** EAD by rating grade — the concentration a credit committee reads first. */
  private readonly byGrade = this.scale.map((grade) =>
    getCounterparties()
      .filter((cp) => cp.grade === grade.grade)
      .reduce((sum, cp) => sum + cp.ead, 0),
  );

  protected get money() {
    return this.memo('money', () => (v: number | null) =>
      this.t.formatCurrency(v ?? 0, { notation: 'compact' }),
    );
  }

  protected get percent() {
    return this.memo('percent', () => (v: number | null) =>
      this.t.formatPercent(v ?? 0, { maximumFractionDigits: 2 }),
    );
  }

  protected get monthLabels() {
    return this.memo('monthLabels', () =>
      this.months.map((m) => this.t.formatDate(m.date, 'monthYear')),
    );
  }

  protected get quarterLabels() {
    return this.memo('quarterLabels', () => this.quarters.map((q) => q.quarter));
  }

  protected get sectorSeries() {
    return this.memo('sectorSeries', () => [
      { label: this.t('kpi.ead'), data: this.sectors.map((s) => s.ead) },
    ]);
  }

  protected get sectorAxis() {
    return this.memo('sectorAxis', () => ({ data: this.sectors.map((s) => this.t(s.nameKey)) }));
  }

  protected get gradeSeries() {
    return this.memo('gradeSeries', () => [{ label: this.t('kpi.ead'), data: this.byGrade }]);
  }

  protected get gradeAxis() {
    return this.memo('gradeAxis', () => ({
      data: this.scale.map((g) => this.t(`rating.${g.label}`)),
    }));
  }

  protected get quarterAxis() {
    return this.memo('quarterAxis', () => ({ data: this.quarterLabels, scale: 'category' }));
  }

  protected get eadAxis() {
    return this.memo('eadAxis', () => ({ label: this.t('kpi.ead') }));
  }

  protected get eadAxisFromZero() {
    return this.memo('eadAxisFromZero', () => ({ label: this.t('kpi.ead'), min: 0 }));
  }

  protected get bandSeries() {
    return this.memo('bandSeries', () => [
      {
        label: this.t('ratingBand.investment'),
        data: this.quarters.map((q) => q.byBand.investment),
      },
      {
        label: this.t('ratingBand.speculative'),
        data: this.quarters.map((q) => q.byBand.speculative),
      },
      { label: this.t('ratingBand.default'), data: this.quarters.map((q) => q.byBand.default) },
    ]);
  }

  protected drillSector(event: CustomEvent<{ dataIndex: number }>): void {
    const sector = this.sectors[event.detail?.dataIndex ?? -1];
    if (sector) void this.router.navigateByUrl(this.appPath(this.route.sector(sector.id)));
  }
}
