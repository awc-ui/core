import { Component, CUSTOM_ELEMENTS_SCHEMA, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import {
  driftedMandates,
  getActivityFor,
  getAllocationFor,
  getClientsFor,
  getGoalsFor,
  getHouseholdById,
  getOrders,
  getPerformanceSeries,
  getPortfolioFor,
  getProposalsFor,
  goalSummary,
  growthOf100,
  kycDot,
  plColor,
  rebalanceSheet,
  returnWindows,
  type Activity,
  type AllocationRow,
  type Client,
  type DriftedMandate,
  type Goal,
  type GoalSummary,
  type GrowthPoint,
  type Household,
  type Order,
  type PerformancePoint,
  type Portfolio,
  type Proposal,
  type RebalanceRow,
  type ReturnWindow,
} from '@awc-ui/showcase-kit/wealth';
import { ShowcaseComponent } from '../lib/screen.base';
import { crumbsFor, type CrumbSpec } from '../lib/routes';
import { ScreenComponent } from '../components/screen.component';
import { PanelComponent } from '../components/panel.component';
import { EmptyStateComponent } from '../components/empty-state.component';
import { ChartComponent, type ChartSeries } from '../components/chart.component';
import {
  ChipComponent,
  CountComponent,
  DateTextComponent,
  DriftMeterComponent,
  FactComponent,
  FundedMeterComponent,
  KpiTileComponent,
  MoneyComponent,
  NumComponent,
  PercentComponent,
  SignedComponent,
} from '../components/bits.component';
import {
  KpiSkeletonComponent,
  PanelSkeletonComponent,
  TableSkeletonComponent,
} from '../components/skeletons.component';
import { HouseholdHoldingsComponent } from './household-holdings.component';
import {
  DEFAULT_VIEW,
  HouseholdSettingsSheetComponent,
  type HouseholdView,
} from './household-settings.component';
import { ActionButtonComponent, HouseholdTabsComponent } from './household-tabs.component';

/**
 * Screen 3 — one household, and the only screen that takes a parameter.
 * Ported from the React build's `HouseholdScreen.tsx` + `HouseholdHoldings.tsx`
 * (the tabs and the settings sheet are the two files beside this one).
 *
 * THE GUARD IS THE FIRST THING THE TEMPLATE ASKS, and it stays there.
 * `householdId` arrives from the URL, so it may be anything at all;
 * `getHouseholdById` returns `undefined` for an id the fixture does not know,
 * and `data` returns `null` rather than a bundle read off nothing. The 404 for
 * a bad id is this screen's job, not the router's.
 *
 * THE PARAM IS READ REACTIVELY. Angular reuses this component instance when
 * only `:id` changes (one household drilled from another), so the id comes from
 * `paramMap` as a signal, never from a one-shot snapshot — and every cache
 * below is keyed on the household it was built for, so none of them survives
 * into the next one.
 *
 * WHAT THE SCREEN IS. Five figures, then the mandate's performance, then how
 * far it has drifted from its target allocation, then what it actually holds,
 * then what the money is FOR — and last, four sibling views of the household
 * itself behind a tab strip. That is the reading order of a review meeting:
 * how big, how it did, how far off, what is in it, who it is for.
 *
 * NOTHING HERE COMPUTES ANYTHING. Every number on this screen is a field on a
 * kit record or the return value of a kit function: `returnWindows` for the
 * windows, `growthOf100` for the chart, `getAllocationFor` and `rebalanceSheet`
 * for the drift, `getOrders` for the tickets under it, `driftedMandates` for
 * the breach counts, `goalSummary` for the objectives roll-up. The only thing
 * this file decides is what is on screen — which is also the only thing the
 * settings sheet changes.
 *
 * WHAT THE ALLOCATION PANEL IS MISSING, and deliberately does not invent. The
 * cards prescribe a trade per class; the obvious next figures are what those
 * trades SUM to, what they do to the cash balance, and where the drift lands
 * once they settle. None of the three is a kit selector — `rebalanceSheet`
 * returns the rows and stops — so none of them is on the screen. Adding them
 * means a `rebalanceTotals(portfolioId)` in `packages/showcase-kit/src/wealth/
 * derive.ts`, not a `reduce()` in this file.
 *
 * THREE PIECES OF LOCAL STATE, and all three are view state rather than data:
 * which parts of the screen are shown, whether the settings sheet is open, and
 * the transient snackbar message. Everything else is read from the fixture,
 * because the fixture is immutable and the selectors are pure.
 */

/** The chart height `app.css` names `.chart-md`. */
const CHART_MD = '260px';

/**
 * The growth chart's y-axis floor.
 *
 * A value axis anchors itself to zero unless a `min` is given, which is correct
 * for a quantity and useless for an index: both lines start at 100 and the
 * whole story happens in the top sixth of a 0–120 plot. 90 sits under every
 * household's series, so nothing is ever cropped.
 */
const GROWTH_FLOOR = 90;

/** The base `growthOf100()` rebases to. Printed in the panel's subtitle. */
const GROWTH_BASE = 100;

/**
 * Everything the screen reads out of the kit for ONE household, built once per
 * id rather than per change-detection pass.
 *
 * It is a bundle rather than a dozen getters because a getter is called on
 * every pass and half of these walk the whole fixture — and because building
 * them together is what makes the guard a single question with a single answer.
 */
interface HouseholdData {
  household: Household;
  portfolio: Portfolio | undefined;
  members: Client[];
  goals: Goal[];
  proposals: Proposal[];
  activity: Activity[];
  allocation: AllocationRow[];
  sheet: RebalanceRow[];
  orders: Order[];
  performance: PerformancePoint[];
  growth: GrowthPoint[];
  /** 3, 6 (year to date), 12 and 24 months, in that order — the kit's contract. */
  windows: ReturnWindow[];
  ytd: ReturnWindow;
  objectives: GoalSummary;
  drifted: DriftedMandate | undefined;
  /** The two KPI sparklines, as stable arrays the tiles can be handed. */
  aumTrend: number[];
  returnTrend: number[];
}

@Component({
  selector: 'awc-household-screen',
  standalone: true,
  styles: ':host { display: contents; }',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [
    ScreenComponent,
    PanelComponent,
    EmptyStateComponent,
    ChartComponent,
    ChipComponent,
    CountComponent,
    DateTextComponent,
    DriftMeterComponent,
    FactComponent,
    FundedMeterComponent,
    KpiTileComponent,
    MoneyComponent,
    NumComponent,
    PercentComponent,
    SignedComponent,
    KpiSkeletonComponent,
    PanelSkeletonComponent,
    TableSkeletonComponent,
    ActionButtonComponent,
    HouseholdHoldingsComponent,
    HouseholdSettingsSheetComponent,
    HouseholdTabsComponent,
  ],
  template: `
    @if (data; as data) {
      <awc-screen
        [title]="title"
        [subtitle]="
          t('wealth.screen.household.subtitle', {
            segment: t(data.household.segmentKey),
            mandate: t(data.household.mandateKey),
            members: data.members.length
          })
        "
        [crumbs]="crumbs"
        [hasActions]="true"
        [customSkeleton]="true"
      >
        <!--
          Avatar, member-count badge and KYC dot as ONE object.

          md-badge and md-status-dot both position themselves absolutely against
          the nearest POSITIONED ancestor, which is what .badge-anchor is for —
          dropped in bare they anchor to whatever box happens to be positioned
          above them and get clipped by it. The badge takes the top corner and
          the dot the bottom, and the dot is deliberately unlabelled: the KYC
          chip beside it already says the same word, and naming both announces
          the state twice.
        -->
        <span aside class="badge-anchor">
          <md-avatar
            [attr.name]="data.household.name"
            [attr.label]="data.household.name"
            size="medium"
          ></md-avatar>
          <md-badge shape="circle" [attr.value]="data.household.memberCount"></md-badge>
          <md-status-dot
            shape="circle"
            [attr.state]="kycDot[data.household.kycStatus]"
            size="small"
          ></md-status-dot>
        </span>
        <md-chip aside awcChip kind="segment" [value]="data.household.segment"></md-chip>
        <md-chip aside awcChip kind="mandate" [value]="data.household.mandate"></md-chip>
        <md-chip aside awcChip kind="strategy" [value]="data.household.strategy"></md-chip>
        <md-chip aside awcChip kind="kyc" [value]="data.household.kycStatus"></md-chip>

        <!-- An md-toolbar is ONE tab stop with arrow-key movement between its
             DIRECT children, so these are bare md-buttons — a wrapper around
             any of them would drop it out of the roving group. None is
             emphasised: the rail's FAB is already the loudest control here. -->
        <md-button actions awcAction icon="balance" (activate)="openTrade()">
          {{ t('wealth.action.rebalance') }}
        </md-button>
        <md-button
          actions
          awcAction
          icon="mail"
          (activate)="message = t('wealth.activity.client-contacted')"
        >
          {{ t('wealth.action.contact') }}
        </md-button>
        <md-button actions awcAction icon="tune" (activate)="settingsOpen = true">
          {{ t('wealth.action.filter') }}
        </md-button>

        <!--
          THE PLACEHOLDER FOR THIS SCREEN, rather than the generic one.

          Measured on a first drill from the overview: the fallback put 612px of
          placeholder where 3248px of screen was coming, and its four-tile row
          was 16px short of this five-tile one — the only KPI row in the app
          whose tiles carry a sparkline AND a bare text foot, which is what
          makes it 178 rather than 152.

          THE OVERLAYS ARE NOT DRAWN, and that is correct rather than an
          omission: the settings side sheet and the snackbar are out of flow and
          closed, so they occupy nothing and a placeholder for them would occupy
          something.

          THREE OF THE SIX BLOCKS ARE NOT CONSTANTS, because this is the one
          screen drawn for eight different subjects whose panels are different
          heights. None of the three is a guess: each is a COUNT the screen has
          already read out of the fixture before the placeholder goes up, times
          a row height measured across all eight households.

            holdings     263 + 53 × positions   HouseholdHoldings does not
                                                paginate, so the table is
                                                exactly positionCount rows tall.
            allocation   771 + 90 × orders      the blotter under the rebalance
                         −12 when in band       cards is 88px per list row with a
                                                2px seam, and the panel head
                                                loses 12px with no drift chip.
            the tabs     497 + 88 × members     md-tab-panels sizing="active"
                                                takes its height from the open
                                                panel, and that is the members
                                                list.

          PanelSkeleton and TableSkeleton draw 90px of their own chrome — a 16px
          card inset, a 16px panel inset, a 14px head and the 12px gap under it
          — so each height below is the real block MINUS 90. Verified on every
          household in the fixture: hh-01 through hh-08 all swap at 0px.

          ONE ANNOUNCEMENT: the first KPI tile names the household, the rest are
          silent.
        -->
        <ng-container ngProjectAs="[skeleton]">
          <!-- The first two tiles carry a sparkline — AUM and YTD return both
               plot the performance series — and every foot on this row is a
               bare line or a chip: 16px where the hint stands alone, 32px where
               a count sits beside it. The row is as tall as its tallest tile,
               so the two 146px sparkline tiles are what set the 178. -->
          <section class="kpi-grid">
            <awc-kpi-skeleton [announce]="true" [label]="title" foot="16px" />
            <awc-kpi-skeleton foot="16px" />
            <awc-kpi-skeleton [spark]="false" foot="16px" />
            <awc-kpi-skeleton [spark]="false" />
            <awc-kpi-skeleton [spark]="false" />
          </section>

          <!-- Performance: a 260px chart beside its return windows. -->
          <awc-panel-skeleton height="266px" />

          <!-- Allocation: the bar chart, the rebalance cards, and the blotter. -->
          <awc-panel-skeleton [height]="allocationSkeletonHeight" />

          <!-- A real md-table inside a .table-host, so it gets the table shape. -->
          <awc-table-skeleton [height]="holdingsSkeletonHeight" />

          <!-- Objectives: one .goal-row per goal in a .grid-3. -->
          <awc-panel-skeleton height="180px" />

          <!-- The four sibling views, open on the members list. -->
          <awc-panel-skeleton [height]="tabsSkeletonHeight" />
        </ng-container>

        <!-- ------------------------------------------------------------ KPIs -->

        <section class="kpi-grid">
          <awc-kpi-tile
            [label]="t('wealth.kpi.aum')"
            [trend]="view.trend ? data.aumTrend : undefined"
            [trendLabels]="monthLabels"
            [formatTrend]="money"
            [hasFoot]="true"
          >
            <span
              awcMoney
              ngProjectAs="[value]"
              [value]="data.household.totalAum"
              [compact]="true"
            ></span>
            <ng-container ngProjectAs="[hint]">
              {{ data.portfolio ? data.portfolio.reference : t('wealth.common.na') }}
            </ng-container>
          </awc-kpi-tile>

          <!-- The sparkline takes the same colour the excess return is printed
               in, from the kit's own dead-banded mapping — never a ternary. -->
          <awc-kpi-tile
            [label]="t('wealth.kpi.ytdReturn')"
            [color]="excessColor"
            [trend]="view.trend ? data.returnTrend : undefined"
            [trendLabels]="monthLabels"
            [formatTrend]="percent"
            [hasFoot]="true"
          >
            <span awcPercent ngProjectAs="[value]" [value]="data.household.ytdReturn"></span>
            <ng-container ngProjectAs="[hint]"
              >{{ t('wealth.common.vsBenchmark') }}
              <bdi awcSigned [value]="data.ytd.excess" kind="percent"></bdi
            ></ng-container>
          </awc-kpi-tile>

          <awc-kpi-tile [label]="t('wealth.kpi.unrealisedPl')" [hasFoot]="true">
            <bdi
              awcSigned
              ngProjectAs="[value]"
              [value]="data.household.unrealisedPl"
              [compact]="true"
            ></bdi>
            <ng-container ngProjectAs="[hint]">
              @if (data.portfolio; as portfolio) {
                <span awcPercent [value]="portfolio.unrealisedPlPct"></span>
              }
            </ng-container>
          </awc-kpi-tile>

          <awc-kpi-tile [label]="t('wealth.kpi.driftBreaches')" [hasFoot]="true">
            <span awcNum ngProjectAs="[value]" [value]="data.drifted?.breachCount ?? 0"></span>
            <ng-container ngProjectAs="[hint]">
              {{ t('wealth.allocationStatus.drifted') }}
            </ng-container>
            <md-chip
              awcCount
              ngProjectAs="[trailing]"
              [value]="data.drifted?.driftedCount ?? 0"
              color="warning"
            ></md-chip>
          </awc-kpi-tile>

          <awc-kpi-tile [label]="t('wealth.kpi.goals')" [hasFoot]="true">
            <span awcNum ngProjectAs="[value]" [value]="data.objectives.count"></span>
            <ng-container ngProjectAs="[hint]">{{ t('wealth.kpi.goalsOnTrack') }}</ng-container>
            <md-chip
              awcCount
              ngProjectAs="[trailing]"
              [value]="data.objectives.onTrack"
              color="success"
            ></md-chip>
          </awc-kpi-tile>
        </section>

        <!-- ----------------------------------------------------- performance -->

        @if (data.portfolio; as portfolio) {
          <awc-panel
            [title]="t('wealth.panel.performance')"
            [subtitle]="
              t('wealth.panel.performanceHint', {
                base: t.formatNumber(growthBase),
                months: t.formatNumber(data.growth.length)
              })
            "
          >
            <div class="grid-wide">
              <!--
                Growth of 100, not two cumulative percentages: two crossing
                lines are readable and two crossing percentage figures are not.

                The benchmark is dropped from the DATA when the reader turns it
                off, rather than hidden through the chart's own legend — the
                chart remembers legend toggles across a data re-feed, so the two
                would fight over which of them owns "is the benchmark showing".

                summary replaces the generated aria-label, whose default
                sentence is assembled in English. There is no visible label,
                because the panel's own heading already names the chart.
              -->
              <awc-chart
                tag="md-line-chart"
                [series]="growthSeries"
                [xAxis]="growthXAxis"
                [yAxis]="growthYAxis"
                [valueFormatter]="index"
                [height]="chartMd"
                [summary]="t('wealth.panel.performance')"
                curve="monotone"
                grid="horizontal"
                legend="top-end"
              />

              <!--
                THE SAME SURFACE THE CHART SITS ON, and read off the chart
                rather than picked by eye: md-line-chart's host paints
                --md-sys-color-surface-container-low at a 16px corner, which is
                exactly what md-card variant="outlined" is. The two blocks
                answer one question between them — how did this mandate do — so
                putting them on the same surface says so.
              -->
              <md-card variant="outlined" full-width class="surface-card fact-card">
                <dl class="dl">
                  @for (window of data.windows; track window.months) {
                    <div
                      awcFact
                      [label]="t('wealth.unit.months', { value: t.formatNumber(window.months) })"
                    >
                      <span awcPercent [value]="window.portfolio"></span>
                      <br />
                      <bdi awcSigned [value]="window.excess" kind="percent"></bdi>
                    </div>
                  }
                  <div awcFact [label]="t('wealth.kpi.maxDrawdown')">
                    <bdi awcSigned [value]="portfolio.maxDrawdown" kind="percent"></bdi>
                  </div>
                  <div awcFact [label]="t('wealth.table.benchmark')">
                    {{ portfolio.benchmarkName }}
                  </div>
                </dl>
              </md-card>
            </div>
          </awc-panel>
        }

        <!-- ------------------------------------------------------ allocation -->

        <awc-panel
          [title]="t('wealth.panel.allocation')"
          [subtitle]="t('wealth.panel.allocationHint')"
        >
          @if (data.drifted; as drifted) {
            <md-chip actions awcChip kind="allocation" [value]="drifted.worst.status"></md-chip>
          }

          @if (allocationRows.length === 0) {
            <awc-empty-state [message]="t('wealth.empty.rebalance')" />
          } @else {
            <!--
              NOT .grid-wide, and that is the fix rather than a preference.

              The two halves of this panel are the SAME five rows twice — the
              chart is a picture of the cards. Side by side they cannot agree on
              a height: the chart is pinned at 260px while five stacked
              .alloc-rows run to ~800px, so two thirds of the panel's width sat
              under the bars holding nothing at all. So the picture goes full
              width, where ten bars have room to be read, and the cards flow
              into .grid-2 — the auto-fit track with a 340px floor, which is
              what the column they came out of was actually measuring.
            -->
            <div class="stack">
              <!--
                Target against actual, one pair of bars per class. A donut
                cannot show a target beside an actual, which is the only
                comparison this panel exists to make.

                The weights stay FRACTIONS all the way to the axis —
                valueFormatter is what turns 0.62 into 62%, so nothing is
                multiplied by 100 on the way in and the tooltip, the axis and
                the figures beside them cannot disagree. md-bar-chart has no
                summary prop, so label is both the visible title and the seed of
                the accessible name; it names what the bars MEASURE rather than
                repeating the panel heading above it.
              -->
              <awc-chart
                tag="md-bar-chart"
                [series]="allocationSeries"
                [xAxis]="allocationXAxis"
                [yAxis]="allocationYAxis"
                [valueFormatter]="weight"
                [height]="chartMd"
                [label]="t('wealth.table.weight')"
                legend="top-end"
              />

              <div class="grid-2">
                @for (row of rebalanceRows; track row.assetClass) {
                  <md-card variant="outlined" full-width class="alloc-row">
                    <div class="alloc-row__head">
                      <h3 class="alloc-row__name">{{ t(row.assetClassKey) }}</h3>
                      <md-chip awcChip kind="allocation" [value]="row.status"></md-chip>
                    </div>
                    <!-- The meter shows the DISTANCE from target and its colour
                         how far; the direction is in the signed value beside it
                         and in the trade side below, because a bar has no
                         negative half to carry a sign. -->
                    <awc-drift-meter [drift]="row.drift" />
                    <div class="alloc-row__figures">
                      <span>
                        {{ t('wealth.table.target') }}
                        <span awcPercent [value]="row.targetWeight" [digits]="1"></span>
                      </span>
                      <span>
                        {{ t('wealth.table.actual') }}
                        <span awcPercent [value]="row.actualWeight" [digits]="1"></span>
                      </span>
                      <span>
                        {{ t('wealth.table.driftBps') }}
                        {{ t('wealth.unit.bps', { value: t.formatNumber(row.driftBps) }) }}
                      </span>
                    </div>
                    <div class="row">
                      <!-- side is the kit's own 'buy' | 'sell', and the signed
                           amount agrees with it: a sell is a negative trade. -->
                      <md-chip awcChip kind="orderSide" [value]="row.side"></md-chip>
                      <span class="muted">{{ t('wealth.table.rebalance') }}</span>
                      <bdi awcSigned [value]="row.rebalanceAmount" [compact]="true"></bdi>
                    </div>
                  </md-card>
                }
              </div>

              <!--
                WHAT IS ALREADY IN THE MARKET FOR THIS MANDATE.

                Every card above ends in an instruction, and the one thing that
                changes whether an advisor acts on it is whether some of it is
                already done: a submitted equity buy against an equity card that
                asks for a buy, a cancelled fixed-income sell that is the last
                attempt at the very trade the fixed-income card is prescribing.
                A rebalance sheet read without them is read twice.

                Nothing else on this screen carries it: the four tabs at the
                foot are members, mandate, documents and activity, and the
                holdings table below is what is HELD, not what is in flight. It
                is a list rather than a table because a mandate has one or two
                tickets, and list-style="segmented" keeps each one a tile rather
                than a hairline row inside a card that is already outlined.
              -->
              <md-divider></md-divider>

              <div class="row row--between">
                <h3 class="panel__title" id="household-tickets">
                  {{ t('wealth.panel.blotter') }}
                </h3>
                <md-chip awcCount [value]="data.orders.length"></md-chip>
              </div>

              @if (data.orders.length === 0) {
                <awc-empty-state [message]="t('wealth.empty.orders')" />
              } @else {
                <!-- labelledby rather than label: the heading above already
                     names the list, and a label prop would announce that same
                     name a second time.

                     interaction-mode="multi-action" even though no row is
                     clickable — the two state chips in each trailing slot are
                     assist chips, which are focusable controls, and the default
                     single-action treats a row as one target. -->
                <md-list
                  labelledby="household-tickets"
                  list-style="segmented"
                  interaction-mode="multi-action"
                >
                  @for (order of data.orders; track order.id) {
                    <!--
                      EVERY FIELD IS READ, NONE IS COMPUTED. estimatedValueEur
                      is the ticket's own converted figure, filledQuantity and
                      quantity are its own counts, and the *Key fields are the
                      kit's own dictionary keys.

                      THE DATE IS IN THE SUPPORTING LINE, not in
                      trailing-supporting-text: filling the trailing SLOT
                      replaces trailing-icon and trailing-supporting-text
                      outright, so a date slotted there is in the DOM at 0×0 —
                      announced by a screen reader, invisible to everyone else.
                      slot="supporting-text" also keeps the real <time datetime>
                      instead of flattening the date into a string prop.

                      ONE trailing element holding three, not three trailing
                      elements: the slot lays its children out as a column, so
                      siblings stack and triple the row height.
                    -->
                    <md-list-item
                      [attr.headline]="order.instrumentName"
                      [attr.overline]="order.ticker + ' · ' + t(order.assetClassKey)"
                      leading-icon="receipt_long"
                      lines="3"
                    >
                      <span slot="supporting-text">
                        {{ t(order.orderTypeKey) }} · {{ t('wealth.table.filled') }}
                        {{
                          t('wealth.common.of', {
                            count: t.formatNumber(order.filledQuantity),
                            total: t.formatNumber(order.quantity)
                          })
                        }}
                        · <time awcDate [value]="order.createdDate" dateStyle="short"></time>
                      </span>
                      <span slot="trailing" class="row">
                        <md-chip awcChip kind="orderSide" [value]="order.side"></md-chip>
                        <md-chip awcChip kind="orderStatus" [value]="order.status"></md-chip>
                        <span awcMoney [value]="order.estimatedValueEur" [compact]="true"></span>
                      </span>
                    </md-list-item>
                  }
                </md-list>
              }
            </div>
          }
        </awc-panel>

        <!-- -------------------------------------------------------- holdings -->

        <awc-panel [title]="t('wealth.panel.holdings')" [subtitle]="data.portfolio?.reference">
          <md-chip actions awcCount [value]="data.household.positionCount"></md-chip>
          <awc-household-holdings [household]="data.household" [portfolio]="data.portfolio" />
        </awc-panel>

        <!-- ------------------------------------------------------ objectives -->

        <awc-panel
          [title]="t('wealth.panel.objectives')"
          [subtitle]="
            t('wealth.goal.projectedAt', {
              value: t.formatCurrency(data.objectives.projectedTotal, { notation: 'compact' })
            })
          "
        >
          <md-chip actions awcCount [value]="data.objectives.count"></md-chip>

          @if (data.goals.length === 0) {
            <awc-empty-state [message]="t('wealth.empty.goals')" />
          } @else {
            <div class="grid-3">
              @for (goal of data.goals; track goal.id) {
                <div class="goal-row">
                  <div class="row row--between">
                    <span class="strong">{{ t(goal.typeKey) }}</span>
                    <md-chip awcChip kind="goal" [value]="goal.status"></md-chip>
                  </div>
                  <!-- The bar is clamped at 100% but the TEXT is not, so an
                       over-funded objective reads "119%" beside a full bar. -->
                  <awc-funded-meter [fraction]="goal.fundedPct" [status]="goal.status" />
                  <div class="row">
                    <md-chip awcChip kind="priority" [value]="goal.priority"></md-chip>
                    <span class="muted">
                      {{ goal.beneficiaryName ?? t('wealth.common.household') }}
                    </span>
                  </div>
                  <div class="alloc-row__figures">
                    <span>
                      {{
                        t('wealth.goal.fundedOf', {
                          current: t.formatCurrency(goal.currentAmount, { notation: 'compact' }),
                          target: t.formatCurrency(goal.targetAmount, { notation: 'compact' })
                        })
                      }}
                    </span>
                    <span>
                      {{ t('wealth.table.targetDate') }}
                      <time awcDate [value]="goal.targetDate"></time>
                    </span>
                    <span>
                      {{
                        t('wealth.goal.monthsRemaining', {
                          count: t.formatNumber(goal.monthsRemaining)
                        })
                      }}
                    </span>
                  </div>
                </div>
              }
            </div>
          }
        </awc-panel>

        <!-- ------------------------------------------------------------ tabs -->

        <!-- No panel title: the tab strip is the heading of what is under it,
             and a card heading above a tab strip reads as a second, competing
             one. -->
        <awc-panel>
          <awc-household-tabs
            [household]="data.household"
            [portfolio]="data.portfolio"
            [members]="data.members"
            [goals]="data.goals"
            [proposals]="data.proposals"
            [activity]="data.activity"
            [allocation]="data.allocation"
            [breachCount]="data.drifted?.breachCount ?? 0"
            (notify)="message = $event"
          />
        </awc-panel>

        <awc-household-settings
          [open]="settingsOpen"
          [view]="view"
          (viewChange)="view = $event"
          (closed)="settingsOpen = false"
        />

        <!--
          One snackbar, one message. The component has no queue by design and M3
          forbids two at once, so every notification on this screen goes through
          this single element.

          THE SNACKBAR IS CONTROLLED, AND (mdClose) IS WHAT KEEPS IT THAT WAY.
          Auto-hide, the close button and hide() all emit mdClose; assigning
          open = false from script does not. Clearing the message here means the
          element's own dismissal and this component's state land in the same
          pass. Skip it and the binding still holds open="", so Angular sees no
          change to write and the next message never reopens it. mdClose neither
          bubbles nor composes, which is why the listener is on the element.

          position="bottom" is the component default and M3's placement. The
          offset that keeps it clear of the dock and — below 900px — the
          navigation bar is .wealth-snackbar (snackbar.css, loaded app-wide from
          angular.json), shared with the other two screens that toast so all
          three land in the same place.
        -->
        <md-snackbar
          class="wealth-snackbar"
          [attr.open]="message !== null ? '' : null"
          [attr.message]="message ?? ''"
          position="bottom"
          closeable
          auto-hide
          [attr.dismiss-label]="t('wealth.action.close')"
          (mdClose)="message = null"
        ></md-snackbar>
      </awc-screen>
    } @else {
      <awc-screen
        [title]="t('wealth.screen.notFound.title')"
        [subtitle]="t('wealth.screen.household.missing')"
        [crumbs]="crumbs"
      >
        <awc-empty-state [message]="t('wealth.screen.household.missing')" />
      </awc-screen>
    }
  `,
})
export class HouseholdScreen extends ShowcaseComponent {
  private readonly params = toSignal(inject(ActivatedRoute).paramMap);
  private readonly router = inject(Router);

  protected readonly kycDot = kycDot;
  protected readonly chartMd = CHART_MD;
  protected readonly growthBase = GROWTH_BASE;

  /* ----------------------------------------------------------------- state */

  /** What the reader has chosen to see. The settings sheet owns the words. */
  protected view: HouseholdView = DEFAULT_VIEW;
  protected settingsOpen = false;
  protected message: string | null = null;

  /* -------------------------------------------------------------- the data */

  protected get householdId(): string {
    // Decoding is what makes a lookup miss mean "no such household" rather
    // than "the id had a character in it".
    return decodeURIComponent(this.params()?.get('id') ?? '');
  }

  private cache: HouseholdData | null = null;

  /**
   * THE GUARD. `null` for an id the fixture does not know — no field is read
   * off `undefined` anywhere above, because there is nothing to read it from.
   *
   * Rebuilt only when the id changes, which is also what discards the previous
   * household's bundle when this instance is reused for the next one.
   */
  protected get data(): HouseholdData | null {
    const id = this.householdId;
    if (this.cache && this.cache.household.id === id) return this.cache;

    const household = getHouseholdById(id);
    if (!household) {
      this.cache = null;
      return null;
    }

    const portfolio = getPortfolioFor(household.id);
    const performance = getPerformanceSeries({ householdId: household.id });
    const windows = returnWindows({ householdId: household.id });
    const goals = getGoalsFor(household.id);

    this.cache = {
      household,
      portfolio,
      members: getClientsFor(household.id),
      goals,
      proposals: getProposalsFor(household.id),
      activity: getActivityFor(household.id, 12),
      allocation: getAllocationFor(household.id),
      sheet: portfolio ? rebalanceSheet(portfolio.id) : [],
      /*
       * Every ticket ever raised for this mandate, newest first — the
       * selector's own order, not a sort here.
       *
       * `getOrders({ working: true })` would keep only the live ones, and the
       * settled and cancelled tickets are exactly the ones that explain the
       * drift the panel is reporting: a cancelled fixed-income sell is the last
       * attempt at this same rebalance. Filtering to "working" would hide the
       * history and leave an empty list for a mandate whose last trade filled
       * yesterday.
       */
      orders: portfolio ? getOrders({ portfolioId: portfolio.id }) : [],
      performance,
      growth: growthOf100({ householdId: household.id }),
      windows,
      ytd: windows[1],
      objectives: goalSummary(goals),
      /*
       * Breach and drift counts come from the kit, not from a `.filter()` here.
       *
       * `driftedMandates()` returns only the mandates with something out of
       * band, so a household entirely in band is simply absent from it — which
       * is the zero, and `?? 0` at the call sites is how that reads without a
       * special case.
       */
      drifted: driftedMandates().find((row) => row.household.id === household.id),
      aumTrend: performance.map((point) => point.marketValue),
      returnTrend: performance.map((point) => point.cumulativeReturn),
    };
    return this.cache;
  }

  protected get title(): string {
    const household = this.data?.household;
    return household
      ? this.t('wealth.screen.household.title', { name: household.name })
      : this.t('wealth.nav.household');
  }

  protected get crumbs(): CrumbSpec[] {
    return crumbsFor(this.route.household(this.householdId), this.data?.household ?? null);
  }

  protected get excessColor(): string {
    return plColor(this.data?.ytd.excess ?? 0);
  }

  /* ------------------------------------------------------------- view state */

  /**
   * The settings sheet's two allocation switches.
   *
   * Both test a field the KIT classified — the asset class and the in-band /
   * drifted / breach status — so this hides rows without deciding anything
   * about them. Generic so a `RebalanceRow` keeps its `side` and `absDrift` on
   * the way through.
   */
  private visible<T extends AllocationRow>(rows: T[]): T[] {
    return rows.filter(
      (row) =>
        (this.view.cash || row.assetClass !== 'cash') &&
        (this.view.inBand || row.status !== 'in-band'),
    );
  }

  protected get allocationRows(): AllocationRow[] {
    return this.visible(this.data?.allocation ?? []);
  }

  protected get rebalanceRows(): RebalanceRow[] {
    return this.visible(this.data?.sheet ?? []);
  }

  /* ----------------------------------------------------------------- charts */

  /*
   * Every property-bound object below is built through `memo()`, whose key
   * carries everything it depends on besides the locale: the household, and the
   * settings switches that change what is plotted. A fresh literal per
   * change-detection pass would re-assign `series` and make the chart redraw on
   * every mouse move — see `screen.base.ts`.
   */

  protected get growthSeries(): ChartSeries[] {
    const data = this.data;
    const portfolio = data?.portfolio;
    if (!data || !portfolio) return [];
    return this.memo(`growth:${data.household.id}:${this.view.benchmark}`, () => [
      {
        id: 'portfolio',
        label: portfolio.reference,
        data: data.growth.map((point) => point.portfolio),
      },
      ...(this.view.benchmark
        ? [
            {
              id: 'benchmark',
              label: portfolio.benchmarkName,
              data: data.growth.map((point) => point.benchmark),
            },
          ]
        : []),
    ]);
  }

  protected get growthXAxis(): Record<string, unknown> {
    const data = this.data;
    return this.memo(`growthX:${data?.household.id ?? ''}`, () => ({
      data: (data?.growth ?? []).map((point) => this.t.formatDate(point.date, 'monthYear')),
      scale: 'category',
    }));
  }

  protected get growthYAxis(): Record<string, unknown> {
    return this.memo('growthY', () => ({ min: GROWTH_FLOOR }));
  }

  protected get index(): (value: number | null) => string {
    return this.memo('index', () => (value: number | null) =>
      this.t.formatNumber(value ?? 0, { maximumFractionDigits: 1 }),
    );
  }

  protected get allocationSeries(): ChartSeries[] {
    const id = this.data?.household.id ?? '';
    return this.memo(`alloc:${id}:${this.view.cash}:${this.view.inBand}`, () => {
      const rows = this.allocationRows;
      return [
        {
          id: 'target',
          label: this.t('wealth.table.target'),
          data: rows.map((row) => row.targetWeight),
        },
        {
          id: 'actual',
          label: this.t('wealth.table.actual'),
          data: rows.map((row) => row.actualWeight),
        },
      ];
    });
  }

  protected get allocationXAxis(): Record<string, unknown> {
    const id = this.data?.household.id ?? '';
    return this.memo(`allocX:${id}:${this.view.cash}:${this.view.inBand}`, () => ({
      data: this.allocationRows.map((row) => this.t(row.assetClassKey)),
    }));
  }

  protected get allocationYAxis(): Record<string, unknown> {
    return this.memo('allocY', () => ({ min: 0 }));
  }

  protected get weight(): (value: number | null) => string {
    return this.memo('weight', () => (value: number | null) =>
      this.t.formatPercent(value ?? 0, { maximumFractionDigits: 1 }),
    );
  }

  /* ------------------------------------------------------------ sparklines */

  protected get monthLabels(): string[] {
    const data = this.data;
    return this.memo(`monthLabels:${data?.household.id ?? ''}`, () =>
      (data?.performance ?? []).map((point) => this.t.formatDate(point.date, 'monthYear')),
    );
  }

  protected get money(): (value: number | null) => string {
    return this.memo('money', () => (value: number | null) =>
      this.t.formatCurrency(value ?? 0, { notation: 'compact' }),
    );
  }

  protected get percent(): (value: number | null) => string {
    return this.memo('percent', () => (value: number | null) =>
      this.t.formatPercent(value ?? 0, { maximumFractionDigits: 1 }),
    );
  }

  /* -------------------------------------------------------------- skeleton */

  protected get allocationSkeletonHeight(): string {
    const data = this.data;
    const orders = data?.orders.length ?? 0;
    return `${681 + 90 * orders - (data?.drifted ? 0 : 12)}px`;
  }

  protected get holdingsSkeletonHeight(): string {
    return `${173 + 53 * (this.data?.household.positionCount ?? 0)}px`;
  }

  protected get tabsSkeletonHeight(): string {
    return `${407 + 88 * (this.data?.members.length ?? 0)}px`;
  }

  /* --------------------------------------------------------------- actions */

  protected openTrade(): void {
    void this.router.navigateByUrl(this.appPath(this.route.trade()));
  }
}
