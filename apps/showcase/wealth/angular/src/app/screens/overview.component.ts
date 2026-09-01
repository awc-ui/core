import {
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  inject,
  signal,
  type OnDestroy,
  type OnInit,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  assetClassColor,
  driftedMandates,
  getActivity,
  getBookAllocation,
  getBookTotals,
  getPerformanceSeries,
  growthOf100,
  HISTORY_MONTHS,
  plColor,
  REPORTING_DATE,
  returnWindow,
  tail,
  type Activity,
  type AllocationRow,
  type DriftedMandate,
  type GrowthPoint,
  type ReturnWindow,
} from '@awc-ui/showcase-kit/wealth';
import { ShowcaseComponent } from '../lib/screen.base';
import { BASE_PATH, crumbsFor, route, type CrumbSpec } from '../lib/routes';
import { ScreenComponent } from '../components/screen.component';
import { PanelComponent } from '../components/panel.component';
import { ChartComponent, type ChartSeries } from '../components/chart.component';
import { KpiSkeletonComponent, PanelSkeletonComponent } from '../components/skeletons.component';
import {
  ChipComponent,
  CountComponent,
  DateTextComponent,
  DriftMeterComponent,
  FactComponent,
  KpiTileComponent,
  MoneyComponent,
  NumComponent,
  PercentComponent,
  SignedComponent,
} from '../components/bits.component';
import { OverviewBookTable } from './overview-book-table.component';

/**
 * Screen 1 — the advisor's book, and the head of the drill path. Ported from
 * the React build's `OverviewScreen.tsx` + `OverviewBookTable.tsx`.
 *
 * WHAT IS ON IT, and why it is in this order. An advisor opens this screen to
 * answer four questions before anything else: how big is the book, is it
 * beating its benchmark, is money arriving or leaving, and what needs
 * attention today. So: a KPI row that answers all four at a glance, then the
 * two shapes those numbers came from (the performance curve and the allocation
 * ring), then the two attention lists, then the book itself as a table you can
 * sort and filter, and the audit trail underneath it.
 *
 * NOTHING HERE IS ARITHMETIC. Every figure, series, colour and column layout
 * comes from `@awc-ui/showcase-kit/wealth`; this file decides layout and
 * nothing else. `.map()` over a kit series to lift one field out is a
 * projection, not a calculation.
 *
 * THREE DECISIONS WORTH KNOWING, all carried over from the React reference:
 *
 *   1. THE SCREEN HAS NO `md-toolbar`. `md-fab-menu`'s manual (and M3) say not
 *      to pair a FAB menu with a toolbar or a navigation rail. The screen's
 *      actions live where they belong anyway — the table's filters in
 *      `md-table-toolbar`, the period picker in the chart panel's head — and
 *      the quick-actions FAB is rendered ONLY below the rail breakpoint, where
 *      `app.css` takes the rail out of the DOM and `md-navigation-bar` (a
 *      FAB's proper companion) takes its place.
 *
 *   2. THE DONUT'S SLICE COLOURS ARE TOKEN REFERENCES, PASSED AS-IS. The kit's
 *      palette is `var(--md-sys-color-*)` strings, and the library's
 *      `resolveSeriesColor` resolves those against the chart host before they
 *      reach a Canvas2D `fillStyle`.
 *
 *   3. THE DONUT IS NOT `<awc-chart>`. `md-pie-chart`'s data prop is `data`,
 *      not `series`, and this one also needs `tableLabels` and a `center`
 *      slot — so it is hand-wired below with property bindings, exactly as the
 *      shared wrapper's own comment advises.
 */

/* --------------------------------------------------------------- constants */

/** The index the kit rebases the performance series to. `growthOf100()`'s own base. */
const GROWTH_BASE = 100;

/**
 * The performance chart's y-axis floor.
 *
 * TWO REASONS IT IS SET AT ALL. A value axis anchors itself to ZERO unless a
 * `min` is given — correct for a quantity, useless for an index, where both
 * lines start at 100 and the whole story happens in the top sixth of a 0–120
 * plot. And with the floor fixed, the axis is IDENTICAL at all four periods
 * (every window ends at the same last point, so the data-derived top is the
 * same too), which means the picker changes the horizontal range and nothing
 * else — switching from 24 months to 3 cannot make a flat stretch look steep.
 *
 * 95 sits below the whole 24-month series, whose low is 98.6, so nothing is
 * ever cropped. The top is left data-derived on purpose: `includeZero` only
 * ever extends a bound TOWARD zero, and this one is already positive.
 */
const GROWTH_FLOOR = 95;

/** The four windows the period picker offers, in months. The last is the whole history. */
const PERIODS: readonly number[] = [3, 6, 12, HISTORY_MONTHS];

/**
 * The chart heights `app.css` names as `.chart-sm` / `.chart-md`.
 *
 * Repeated as constants rather than as classes because a chart takes its
 * height through its own `height` prop — a wrapper class would size a box the
 * canvas does not fill. Same numbers, so two charts meant to be compared still
 * match.
 */
const CHART_MD = '260px';
const CHART_LG = '340px';

/* The activity feed is one disclosure, not a short list with a "view all"
   toggle, so there is a single length rather than a collapsed and an expanded
   one. Twelve is what the panel's own header offers to open. */
const ACTIVITY_ROWS = 12;

/* ---------------------------------------------------------------- KPI row */

@Component({
  selector: 'awc-overview-kpis',
  standalone: true,
  styles: ':host { display: contents; }',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [
    KpiTileComponent,
    CountComponent,
    MoneyComponent,
    NumComponent,
    PercentComponent,
    SignedComponent,
  ],
  template: `
    <section class="kpi-grid">
      <awc-kpi-tile
        [label]="t('wealth.kpi.aum')"
        [trend]="aumTrend"
        [trendLabels]="monthLabels"
        [formatTrend]="money"
        color="primary"
        [hasFoot]="true"
      >
        <span awcMoney [value]="totals.aum" [compact]="true" ngProjectAs="[value]"></span>
        <ng-container ngProjectAs="[hint]">{{ t('wealth.kpi.aum.help') }}</ng-container>
      </awc-kpi-tile>

      <!-- The sparkline's colour is the excess return's colour, from the kit's
           own map — so the line agrees with the sign underneath it instead of
           being a decorative accent that happens to be green. -->
      <awc-kpi-tile
        [label]="t('wealth.kpi.ytdReturn')"
        [trend]="returnTrend"
        [trendLabels]="monthLabels"
        [formatTrend]="percent"
        [color]="ytdColor"
        [hasFoot]="true"
      >
        <span awcPercent [value]="totals.ytdReturn" ngProjectAs="[value]"></span>
        <ng-container ngProjectAs="[hint]"
          >{{ t('wealth.common.vsBenchmark') }}
          <bdi awcSigned [value]="totals.ytdExcessReturn" kind="percent"></bdi
        ></ng-container>
      </awc-kpi-tile>

      <!-- Monthly NET FLOW, not the balance: this tile is about money arriving
           and leaving, and the balance's own line is already on the AUM tile. -->
      <awc-kpi-tile
        [label]="t('wealth.kpi.netNewMoney')"
        [trend]="flowTrend"
        [trendLabels]="monthLabels"
        [formatTrend]="money"
        color="tertiary"
        [hasFoot]="true"
      >
        <bdi awcSigned [value]="totals.netNewMoneyYtd" [compact]="true" ngProjectAs="[value]"></bdi>
        <ng-container ngProjectAs="[hint]"
          >{{ t('wealth.unit.months', { value: 12 }) }}
          <bdi awcSigned [value]="totals.netNewMoneyOneYear" [compact]="true"></bdi
        ></ng-container>
      </awc-kpi-tile>

      <!-- No sparkline: there is no history behind these two counts in the
           fixture, and drawing a flat line would invent one. The trailing is a
           count CHIP rather than an md-badge, which would anchor to the card's
           corner and be clipped in half — see bits.component.ts. -->
      <awc-kpi-tile
        [label]="t('wealth.kpi.driftBreaches')"
        color="error"
        [hasFoot]="true"
      >
        <span awcNum [value]="totals.driftBreachCount" ngProjectAs="[value]"></span>
        <ng-container ngProjectAs="[hint]">{{ t('wealth.kpi.kycReviewDue') }}</ng-container>
        <md-chip
          awcCount
          [value]="totals.kycReviewDueCount"
          color="warning"
          ngProjectAs="[trailing]"
        ></md-chip>
      </awc-kpi-tile>
    </section>
  `,
})
export class KpiRowComponent extends ShowcaseComponent {
  protected readonly totals = getBookTotals();
  private readonly points = getPerformanceSeries();

  protected readonly aumTrend = this.points.map((point) => point.marketValue);
  protected readonly returnTrend = this.points.map((point) => point.cumulativeReturn);
  protected readonly flowTrend = this.points.map((point) => point.netFlow);
  protected readonly ytdColor = plColor(this.totals.ytdExcessReturn);

  // Bound to the translator, so a locale change re-formats the hover readout.
  // `memo()` keeps each reference stable per locale, or every change-detection
  // pass would hand the sparkline fresh objects and redraw it.
  protected get money() {
    return this.memo('money', () => (value: number | null) =>
      this.t.formatCurrency(value ?? 0, { notation: 'compact' }),
    );
  }

  protected get percent() {
    return this.memo('percent', () => (value: number | null) =>
      this.t.formatPercent(value ?? 0, { maximumFractionDigits: 2 }),
    );
  }

  protected get monthLabels() {
    return this.memo('monthLabels', () =>
      this.points.map((point) => this.t.formatDate(point.date, 'monthYear')),
    );
  }
}

/* ------------------------------------------------------------ performance */

/**
 * Growth of 100, book against benchmark, with the period picker driving the
 * range (§7.2 pairs exactly these two).
 *
 * THE PICKER IS REAL. It re-slices the series through the kit's `tail()` and
 * re-reads the window's returns through `returnWindow()` — the figures under
 * the chart change with it, and neither number is computed here. `base` in the
 * subtitle is the first value actually on screen, read off the kit's series,
 * so the sentence stays true at every window rather than claiming a rebase
 * that only holds over the full history.
 */
@Component({
  selector: 'awc-overview-performance',
  standalone: true,
  styles: ':host { display: contents; }',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [PanelComponent, ChartComponent, FactComponent, PercentComponent, SignedComponent],
  template: `
    <awc-panel
      [title]="title"
      [subtitle]="
        t('wealth.panel.performanceHint', {
          base: t.formatNumber(base, { maximumFractionDigits: 0 }),
          months: windowReturn.months
        })
      "
    >
      <md-segmented-button-set
        ngProjectAs="[actions]"
        [attr.aria-label]="title"
        (mdChange)="onPeriod($event)"
      >
        @for (period of periods; track period) {
          <!-- label, never slotted text: slotted label content is read once
               before the first render, so a translated string arriving later
               would never make it into the segment. -->
          <md-segmented-button
            [attr.value]="period"
            [attr.label]="t('wealth.unit.months', { value: period })"
            [attr.selected]="period === months ? '' : null"
          ></md-segmented-button>
        }
      </md-segmented-button-set>

      <!-- The chart carries no label of its own — the panel above already says
           it, and two headings for one figure is worse than one. summary
           replaces the generated English aria-label so the figure is still
           named, in the reader's language. -->
      <awc-chart
        tag="md-line-chart"
        [series]="series"
        [xAxis]="xAxis"
        [yAxis]="yAxis"
        [valueFormatter]="index"
        curve="monotone"
        legend="top-end"
        [axisTicks]="true"
        [height]="chartMd"
        [summary]="t('chart.summary.line', { label: title, count: 2 })"
      />

      <md-divider></md-divider>

      <!-- The numbers the curve is being read for, and the reason the picker
           is not decoration: all three come from returnWindow() for the
           selected window. -->
      <dl class="dl">
        <div awcFact [label]="t('wealth.unit.months', { value: windowReturn.months })">
          <bdi awcSigned [value]="windowReturn.portfolio" kind="percent"></bdi>
        </div>
        <div awcFact [label]="t('wealth.kpi.benchmark')">
          <span awcPercent [value]="windowReturn.benchmark"></span>
        </div>
        <div awcFact [label]="t('wealth.kpi.excessReturn')">
          <bdi awcSigned [value]="windowReturn.excess" kind="percent"></bdi>
        </div>
      </dl>
    </awc-panel>
  `,
})
export class PerformancePanelComponent extends ShowcaseComponent {
  protected readonly periods = PERIODS;
  protected readonly chartMd = CHART_MD;

  protected months: number = HISTORY_MONTHS;

  private readonly points = getPerformanceSeries();
  private readonly growth = growthOf100();

  protected get title(): string {
    return this.t('wealth.panel.performance');
  }

  protected get visible(): GrowthPoint[] {
    return this.memo(`visible:${this.months}`, () => tail(this.growth, this.months));
  }

  protected get base(): number {
    return this.visible[0]?.portfolio ?? GROWTH_BASE;
  }

  protected get windowReturn(): ReturnWindow {
    return this.memo(`window:${this.months}`, () => returnWindow(this.points, this.months));
  }

  /*
   * THE BENCHMARK IS DASHED, and that is not decoration. The palette's first
   * two roles are a violet and a rose that sit close together in dark mode,
   * and a reference line the reader cannot separate from the mandate is worse
   * than no reference line at all. The stroke style is a second carrier beside
   * the legend, which is exactly what the chart's manual asks for.
   *
   * `dash` is typed locally because `ChartSeries` models only the fields the
   * wrapper needed on day one — the same local widening the React reference
   * makes. The memo key carries the window so a period change rebuilds the
   * array (and the locale key inside `memo()` rebuilds it on language change).
   */
  protected get series(): ChartSeries[] {
    return this.memo(`series:${this.months}`, () => {
      const series: (ChartSeries & { dash?: 'solid' | 'dashed' | 'dotted' })[] = [
        {
          id: 'book',
          label: this.t('wealth.panel.book'),
          data: this.visible.map((point) => point.portfolio),
        },
        {
          id: 'benchmark',
          label: this.t('wealth.kpi.benchmark'),
          data: this.visible.map((point) => point.benchmark),
          dash: 'dashed',
        },
      ];
      return series;
    });
  }

  protected get xAxis() {
    return this.memo(`xAxis:${this.months}`, () => ({
      data: this.visible.map((point) => this.t.formatDate(point.date, 'monthYear')),
      scale: 'category',
    }));
  }

  protected get yAxis() {
    return this.memo('yAxis', () => ({ label: this.title, min: GROWTH_FLOOR }));
  }

  protected get index() {
    return this.memo('index', () => (value: number | null) =>
      this.t.formatNumber(value ?? 0, { maximumFractionDigits: 1 }),
    );
  }

  protected onPeriod(event: Event): void {
    const [value] = (event as CustomEvent<string[]>).detail ?? [];
    if (value) this.months = Number(value);
  }
}

/* ----------------------------------------------------------------- donut */

@Component({
  selector: 'awc-overview-allocation',
  standalone: true,
  styles: ':host { display: contents; }',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [PanelComponent, MoneyComponent],
  template: `
    <awc-panel [title]="t('wealth.panel.allocation')" [subtitle]="t('wealth.panel.allocationHint')">
      <!-- md-pie-chart, wired BY HAND: its data prop is data, not series — the
           one member of the chart family with a different shape — and it also
           needs tableLabels and the center slot, which the shared awc-chart
           deliberately does not carry (see its own comment). data,
           valueFormatter and tableLabels have no attribute form, so they are
           property bindings built with memo() below.

           inner-radius first, then the centre slot: content in the middle of a
           SOLID pie sits on top of the slices. The centre overlay is
           aria-hidden by the component, which is fine here because the same
           figure is the first KPI tile on the screen.

           show-labels="false" because a legend is already naming the slices,
           and the label the chart would draw inside them is a nine-digit euro
           amount that does not fit in a 4% wedge. -->
      <md-pie-chart
        [data]="donutData"
        [valueFormatter]="donutMoney"
        [tableLabels]="donutLabels"
        [attr.locale]="t.locale"
        [attr.label-plot]="t('wealth.chart.plotHint')"
        inner-radius="62%"
        padding-angle="1"
        show-labels="false"
        legend="bottom"
        [attr.height]="chartLg"
      >
        <!-- Taller than the line chart beside it (340px against 260px): a ring
             plus a five-item legend needs the height the curve does not, and
             .grid-wide stretches both cards to the taller one anyway. -->
        <div slot="center">
          <strong><span awcMoney [value]="totals.aum" [compact]="true"></span></strong>
          <br />
          {{ t('wealth.kpi.aum.short') }}
        </div>
      </md-pie-chart>
    </awc-panel>
  `,
})
export class AllocationPanelComponent extends ShowcaseComponent {
  protected readonly chartLg = CHART_LG;
  protected readonly totals = getBookTotals();
  private readonly rows = getBookAllocation();

  /*
   * The palette is the kit's, looked up PER ROW rather than taken as
   * `ASSET_CLASS_PALETTE` positionally: a lookup by class cannot drift if
   * either ordering ever changes, and equity must be the same violet in the
   * ring, the chip and the meter or the three stop being readable together.
   * Token REFERENCES go straight to the chart — `resolveSeriesColor` in the
   * library resolves `var()` against the chart host, and re-resolves on its
   * own theme tick, so an accent flip repaints without this screen listening
   * for anything.
   */
  protected get donutData() {
    return this.memo('donutData', () =>
      this.rows.map((row) => ({
        label: this.t(row.assetClassKey),
        value: row.marketValue,
        color: assetClassColor[row.assetClass],
      })),
    );
  }

  protected get donutMoney() {
    return this.memo('donutMoney', () => (value: number) =>
      this.t.formatCurrency(value, { notation: 'compact' }),
    );
  }

  protected get donutLabels() {
    return this.memo('donutLabels', () => ({
      category: this.t('wealth.table.assetClass'),
      value: this.t('wealth.table.marketValue'),
      share: this.t('wealth.table.weight'),
    }));
  }
}

/* ------------------------------------------------------------ drift panel */

/**
 * One asset class per card, target against actual, with the drift as a meter.
 *
 * `md-card`, not a `<div>` with a border — `variant="outlined"` is exactly
 * what the old hand-rolled `.alloc-row` border was, with the component's
 * density scale, RTL-safe logical padding and state layer included. The class
 * now carries nothing but the internal stack.
 *
 * `md-meter`, not `md-progress-indicator`: this is a STATE (how far from
 * target), not an activity. The bar carries the distance and the colour
 * carries the band, while the signed text beside the label carries the
 * direction — colour is never the only signal.
 */
@Component({
  selector: 'awc-overview-drift',
  standalone: true,
  styles: ':host { display: contents; }',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [PanelComponent, ChipComponent, DriftMeterComponent, PercentComponent, SignedComponent],
  template: `
    <!-- No subtitle: the donut panel beside it already carries "target against
         actual, by asset class", and saying it twice on one screen is noise. -->
    <awc-panel [title]="t('wealth.table.drift')">
      <div class="stack">
        @for (row of rows; track row.assetClass) {
          <md-card variant="outlined" full-width class="alloc-row">
            <div class="alloc-row__head">
              <h3 class="alloc-row__name">{{ t(row.assetClassKey) }}</h3>
              <md-chip awcChip kind="allocation" [value]="row.status"></md-chip>
            </div>

            <awc-drift-meter [drift]="row.drift" />

            <div class="alloc-row__figures">
              <span
                >{{ t('wealth.table.target') }}
                <span awcPercent [value]="row.targetWeight" [digits]="1"></span
              ></span>
              <span
                >{{ t('wealth.table.actual') }}
                <span awcPercent [value]="row.actualWeight" [digits]="1"></span
              ></span>
              <span
                >{{ t('wealth.table.rebalance') }}
                <bdi awcSigned [value]="row.rebalanceAmount" [compact]="true"></bdi
              ></span>
            </div>
          </md-card>
        }
      </div>
    </awc-panel>
  `,
})
export class DriftPanelComponent extends ShowcaseComponent {
  protected readonly rows: AllocationRow[] = getBookAllocation();
}

/* -------------------------------------------------------- rebalance panel */

/**
 * EVERY DRIFTED MANDATE, not the first five.
 *
 * This panel once capped at five and printed "2 more" underneath — which spent
 * a row telling the reader something was hidden while leaving enough empty
 * space beneath to have shown it. Seven is the whole set here, and a
 * rebalancing queue is exactly the list you want in full: "2 more" gives no
 * name, no drift and nothing to act on.
 */
@Component({
  selector: 'awc-overview-rebalance',
  standalone: true,
  styles: ':host { display: contents; }',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [
    RouterLink,
    PanelComponent,
    ChipComponent,
    CountComponent,
    NumComponent,
    SignedComponent,
  ],
  template: `
    <awc-panel
      [title]="t('wealth.panel.rebalance')"
      [subtitle]="t('wealth.panel.rebalanceHint')"
    >
      <md-chip
        awcCount
        [value]="drifted.length"
        color="warning"
        ngProjectAs="[actions]"
      ></md-chip>

      @if (drifted.length === 0) {
        <!-- No hint line: this is a fact about the book, not a filter result,
             and telling the reader to widen a filter they never set would be
             nonsense. -->
        <div class="empty">
          <p>{{ t('wealth.empty.rebalance') }}</p>
        </div>
      } @else {
        <div class="stack">
          @for (entry of drifted; track entry.household.id) {
            <md-card variant="outlined" full-width class="alloc-row">
              <div class="alloc-row__head">
                <span class="with-dot">
                  <!-- label names it for assistive tech; name only supplies the
                       initials. A household is not a control and opens
                       nothing, so the avatar is presentational beside the link
                       that does. -->
                  <md-avatar
                    [attr.name]="entry.household.name"
                    [attr.label]="entry.household.name"
                    size="small"
                  ></md-avatar>
                  <a class="drill" [routerLink]="appPath(route.household(entry.household.id))">{{
                    entry.household.name
                  }}</a>
                </span>
                <md-chip awcChip kind="allocation" [value]="entry.worst.status"></md-chip>
              </div>

              <div class="alloc-row__figures">
                <span
                  >{{ t(entry.worst.assetClassKey) }}
                  <bdi awcSigned [value]="entry.worst.drift" kind="percent"></bdi
                ></span>
                <span
                  >{{ t('wealth.kpi.driftBreaches') }}
                  <span awcNum [value]="entry.breachCount"></span
                ></span>
                <span
                  >{{ t('wealth.allocationStatus.drifted') }}
                  <span awcNum [value]="entry.driftedCount"></span
                ></span>
              </div>
            </md-card>
          }
        </div>
      }
    </awc-panel>
  `,
})
export class RebalancePanelComponent extends ShowcaseComponent {
  protected readonly drifted: DriftedMandate[] = driftedMandates();
}

/* --------------------------------------------------------- activity panel */

/**
 * The audit trail, as one expandable disclosure list.
 *
 * NO PANEL HEAD. The title, the "newest first" hint and the expand control all
 * live in the list's own disclosure row, so a titled `panel__head` above it
 * would have said the same thing twice with the affordance split across both.
 * `awc-panel`'s `title` is optional precisely for this.
 *
 * The caret is the component's, not ours. An `expandable` row renders its own
 * trailing icon button carrying `aria-expanded` and `aria-controls`, and
 * rotates its glyph — the persistent "this is open" state a hand-rolled toggle
 * never had.
 *
 * A custom element's `href` is the BROWSER's link, not the router's:
 * `md-list-item type="link"` renders a real anchor inside its shadow root,
 * which gives the row a URL to copy and a ⌘-click that opens a tab — but a
 * plain click would walk the whole document out of the SPA. One NATIVE click
 * listener on the list intercepts it: the row is found through
 * `composedPath()` (the only way across a shadow boundary), modifier clicks
 * are the browser's, and everything else routes in place — the same
 * interception the rail and the breadcrumbs carry.
 */
@Component({
  selector: 'awc-overview-activity',
  standalone: true,
  styles: ':host { display: contents; }',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [PanelComponent, DateTextComponent],
  template: `
    <awc-panel>
      @if (rows.length === 0) {
        <div class="empty">
          <p>{{ t('wealth.empty.activity') }}</p>
        </div>
      } @else {
        <!-- md-list, not a hand-rolled ul: the household screen renders this
             same feed as a list, and two views of one entity should not
             disagree about what an activity row looks like. type="link" rather
             than an anchor inside a cell: the household is the only
             destination the row has, so the whole row carries it. -->
        <md-list [attr.label]="t('wealth.panel.activity')" (click)="open($event)">
          <md-list-item
            expandable
            expanded
            leading-icon="history"
            [attr.headline]="t('wealth.panel.activity')"
            [attr.supporting-text]="
              t('wealth.common.entries', { count: rows.length }) +
              ' · ' +
              t('wealth.panel.activityHint')
            "
          >
            @for (entry of rows; track entry.id) {
              <!-- Hairlines are interleaved md-dividers — md-list has no
                   dividers prop, and the list hides them from assistive tech
                   itself, because a list role may not own a separator.
                   Everything in here is slotted: expanded-content takes a FLAT
                   run of rows, never a nested md-list chassis. -->
              @if (!$first) {
                <md-divider slot="expanded-content" inset></md-divider>
              }
              <md-list-item
                slot="expanded-content"
                type="link"
                [attr.href]="withBase(route.household(entry.householdId))"
                leading-icon="history"
                [attr.headline]="t(entry.actionKey) + ' · ' + entry.householdName"
                lines="1"
              >
                <!-- One line, and the household is IN it: the log reads as a
                     sentence, so it is written as one, and the date and actor
                     sit in the trailing metadata where the eye can scan a
                     column of them. -->
                <span slot="trailing-supporting-text"
                  ><time awcDate [value]="entry.date" dateStyle="short"></time> ·
                  {{ entry.actorName }}</span
                >
              </md-list-item>
            }
          </md-list-item>
        </md-list>
      }
    </awc-panel>
  `,
})
export class ActivityPanelComponent extends ShowcaseComponent {
  private readonly router = inject(Router);
  protected readonly rows: Activity[] = getActivity({ limit: ACTIVITY_ROWS });

  protected open(event: Event): void {
    const mouse = event as MouseEvent;
    // Anything but a plain primary click is the browser's to handle: modifier
    // clicks open tabs and windows off the real anchor in the shadow root.
    if (mouse.button !== 0 || mouse.metaKey || mouse.ctrlKey || mouse.shiftKey || mouse.altKey) {
      return;
    }
    const item = mouse
      .composedPath()
      .find(
        (node): node is HTMLElement =>
          node instanceof HTMLElement && node.tagName === 'MD-LIST-ITEM',
      );
    // The disclosure header has no href — it falls through here and keeps its
    // own expand/collapse behaviour untouched.
    const href = item?.getAttribute('href');
    if (!href) return;
    event.preventDefault();
    const bare = href.startsWith(BASE_PATH) ? href.slice(BASE_PATH.length) : href;
    void this.router.navigateByUrl(this.appPath(bare || '/'));
  }
}

/* ---------------------------------------------------------- quick actions */

/**
 * The compact-width primary action: one FAB that fans out into three.
 *
 * WHY IT IS COMPACT-ONLY. `md-fab-menu`'s manual is explicit — do not pair a
 * FAB menu with a toolbar or a navigation rail, and M3 says the same. Above
 * 900px this app HAS a rail, and that rail already carries the one FAB M3
 * allows there. Below 900px `app.css` takes the rail out of the DOM entirely
 * and docks `md-navigation-bar` instead, which is the surface a FAB is
 * specified to sit beside. So the menu appears exactly where it is legal, and
 * the screen never shows two prominent actions at once. The breakpoint mirrors
 * the one `app.css` uses to swap the rail for the bar — quoted here rather
 * than imported because it is a CSS fact, and the two are checked together in
 * the browser.
 *
 * The whole cluster MOUNTS AND UNMOUNTS with the breakpoint (the React build
 * splits the gate into its own component so its listener effect sees a live
 * ref; here the `@if` does the same job, and Angular's template bindings
 * rebind on re-mount by themselves).
 *
 * The FAB is icon-only, so it carries its own `aria-label`; the popup is named
 * separately by `menu-label`, which is the only thing naming the
 * `role="menu"`. The menu wires itself to the FAB by `id` and manages
 * `aria-expanded`, `aria-haspopup` and the icon morph — none of which are set
 * here.
 *
 * Positioning is logical (`inset-inline-end`, `inset-block-end`) so the
 * cluster lands in the correct corner under `dir="rtl"`, and it clears both
 * the docked navigation bar and `<awc-showcase-dock>`, whose measured height
 * the kit publishes as `--awc-dock-height`.
 */
@Component({
  selector: 'awc-overview-quick-actions',
  standalone: true,
  styles: ':host { display: contents; }',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    @if (compact()) {
      <md-fab
        id="wealth-overview-quick-actions"
        icon="add"
        [attr.aria-label]="t('wealth.nav.toolbar')"
        style="position: fixed; inset-inline-end: var(--md-sys-spacing-inset-lg, 16px); inset-block-end: calc(var(--awc-dock-height, 0px) + 80px + var(--md-sys-spacing-inset-lg, 16px)); z-index: var(--md-sys-z-index-navigation, 200)"
      ></md-fab>
      <!-- mdClick from an item carries NO detail — the pressed row is
           event.target even from a listener on the menu, because the event
           bubbles and is composed. The route rides on a data attribute rather
           than a prop: md-fab-menu-item has no value, and dataset reads it
           back without coupling to the component. The menu closes itself and
           returns focus to the FAB; calling close() from here is the
           documented anti-pattern. -->
      <md-fab-menu
        anchor="wealth-overview-quick-actions"
        placement="up"
        [attr.menu-label]="t('wealth.nav.toolbar')"
        (mdClick)="activate($event)"
      >
        @for (action of actions; track action.labelKey) {
          <md-fab-menu-item
            [attr.icon]="action.icon"
            [attr.label]="t(action.labelKey)"
            [attr.data-path]="action.path"
          ></md-fab-menu-item>
        }
      </md-fab-menu>
    }
  `,
})
export class QuickActionsComponent extends ShowcaseComponent implements OnInit, OnDestroy {
  protected readonly actions: readonly { icon: string; labelKey: string; path: string }[] = [
    { icon: 'description', labelKey: 'wealth.action.newProposal', path: route.proposals() },
    { icon: 'swap_horiz', labelKey: 'wealth.action.newOrder', path: route.trade() },
    { icon: 'flag', labelKey: 'wealth.action.newGoal', path: route.planning() },
  ];

  private readonly router = inject(Router);

  /*
   * A media query as state. Starts `false` and settles in `ngOnInit`, so the
   * first frame is the same on every machine and nothing is read during
   * construction — the same first-frame semantics as the React hook.
   */
  protected readonly compact = signal(false);
  private mq: MediaQueryList | null = null;
  private readonly update = () => this.compact.set(this.mq?.matches ?? false);

  ngOnInit(): void {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    this.mq = window.matchMedia('(max-width: 899px)');
    this.update();
    this.mq.addEventListener('change', this.update);
  }

  ngOnDestroy(): void {
    this.mq?.removeEventListener('change', this.update);
  }

  protected activate(event: Event): void {
    const item = event.target as HTMLElement | null;
    const path = item?.dataset?.['path'];
    if (path) void this.router.navigateByUrl(this.appPath(path));
  }
}

/* ----------------------------------------------------------------- screen */

@Component({
  selector: 'awc-overview-screen',
  standalone: true,
  styles: ':host { display: contents; }',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [
    ScreenComponent,
    KpiSkeletonComponent,
    PanelSkeletonComponent,
    KpiRowComponent,
    PerformancePanelComponent,
    AllocationPanelComponent,
    DriftPanelComponent,
    RebalancePanelComponent,
    ActivityPanelComponent,
    QuickActionsComponent,
    OverviewBookTable,
  ],
  template: `
    <awc-screen
      [title]="t('wealth.screen.overview.title')"
      [subtitle]="
        t('wealth.screen.overview.subtitle', { date: t.formatDate(reportingDate, 'long') })
      "
      [crumbs]="crumbs"
      [customSkeleton]="true"
    >
      <md-chip
        ngProjectAs="[aside]"
        variant="assist"
        appearance="outlined"
        icon="groups"
        [attr.label]="
          t('wealth.common.of', { count: totals.householdCount, total: totals.clientCount })
        "
        [attr.title]="t('wealth.kpi.households') + ' / ' + t('wealth.kpi.clients')"
      ></md-chip>

      <!-- The body is MOUNTED from the first frame, not swapped in after the
           skeleton beat: the panels own delegated listeners and the charts own
           property bindings, and awc-screen hides the lot under
           data-placeholder while their lazy md-* chunks load. -->
      <awc-overview-kpis />

      <section class="grid-wide">
        <awc-overview-performance />
        <awc-overview-allocation />
      </section>

      <!-- Two columns, not three. app.css stretches cards in a row to the
           tallest of them on purpose, so panels sharing a row want similar
           content: five allocation blocks and five drifted mandates are within
           a row of each other, while a six-line timeline in the same row would
           have left a third of a card empty. The trail goes full width at the
           bottom instead, where its rows have room for the actor as well. -->
      <section class="grid-2">
        <awc-overview-drift />
        <awc-overview-rebalance />
      </section>

      <awc-overview-book-table />

      <awc-overview-activity />

      <awc-overview-quick-actions />

      <!-- The screen's own SHAPE with nothing in it yet — this is the one
           screen whose opening is not a KPI row and two panels. Every wrapper
           is the SAME element and the same class as the real body, so the swap
           moves nothing on the page. Exactly ONE shape announces. -->
      <ng-container ngProjectAs="[skeleton]">
        <section class="kpi-grid">
          <awc-kpi-skeleton [announce]="true" />
          <awc-kpi-skeleton />
          <awc-kpi-skeleton />
          <awc-kpi-skeleton />
        </section>

        <section class="grid-wide">
          <awc-panel-skeleton [height]="chartMd" />
          <awc-panel-skeleton [height]="chartLg" />
        </section>

        <section class="grid-2">
          <awc-panel-skeleton [lines]="10" />
          <awc-panel-skeleton [lines]="10" />
        </section>

        <div class="table-host">
          <md-card variant="outlined" class="panel" full-width>
            <div class="panel__inner">
              <div class="panel__head">
                <div class="skel" style="inline-size: 120px; block-size: 16px"></div>
                <div class="skel" style="inline-size: 220px; block-size: 16px"></div>
              </div>
              <div class="skel" style="inline-size: 100%; block-size: 320px"></div>
            </div>
          </md-card>
        </div>

        <awc-panel-skeleton [lines]="8" />
      </ng-container>
    </awc-screen>
  `,
})
export class OverviewScreen extends ShowcaseComponent {
  protected readonly crumbs: CrumbSpec[] = crumbsFor(this.route.overview());
  protected readonly totals = getBookTotals();
  protected readonly reportingDate = REPORTING_DATE;
  protected readonly chartMd = CHART_MD;
  protected readonly chartLg = CHART_LG;
}
