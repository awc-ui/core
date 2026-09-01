<!--
  Screen 3 — one household, and the only screen that takes a parameter.

  THE GUARD IS THE FIRST BRANCH OF THE MARKUP, and it stays there.
  `householdId` arrives from the URL, so it may be anything at all;
  `getHouseholdById` returns `undefined` for an id the fixture does not know,
  and this renders the empty state rather than reading fields off nothing.

  WHAT THE SCREEN IS. Five figures, then the mandate's performance, then how
  far it has drifted from its target allocation, then what it actually holds,
  then what the money is FOR — and last, four sibling views of the household
  itself behind a tab strip. That is the reading order of a review meeting:
  how big, how it did, how far off, what is in it, who it is for.

  NOTHING HERE COMPUTES ANYTHING. Every number on this screen is a field on a
  kit record or the return value of a kit function: `returnWindows` for the
  windows, `growthOf100` for the chart, `getAllocationFor` and `rebalanceSheet`
  for the drift, `getOrders` for the tickets under it, `driftedMandates` for
  the breach counts, `goalSummary` for the objectives roll-up. The only thing
  this file decides is what is on screen — which is also the only thing the
  settings sheet changes.

  WHAT THE ALLOCATION PANEL IS MISSING, and deliberately does not invent. The
  cards prescribe a trade per class; the obvious next figures are what those
  trades SUM to, what they do to the cash balance, and where the drift lands
  once they settle. None of the three is a kit selector — `rebalanceSheet`
  returns the rows and stops — so none of them is on the screen. Adding them
  means a `rebalanceTotals(portfolioId)` in `packages/showcase-kit/src/wealth/
  derive.ts`, not a `reduce()` in this file.

  THREE PIECES OF LOCAL STATE, and all three are view state rather than data:
  which parts of the screen are shown, whether the settings sheet is open, and
  the transient snackbar message. Everything else is read from the fixture on
  every update, because the fixture is immutable and the selectors are pure.
-->
<script lang="ts">
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
    type AllocationRow,
  } from '@awc-ui/showcase-kit/wealth';
  import { navigate, pathname } from '$lib/router';
  import { crumbsFor, route } from '$lib/routes';
  import { state, t } from '$lib/showcase';
  import Screen from '$lib/components/Screen.svelte';
  import Panel from '$lib/components/Panel.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import Chart from '$lib/components/Chart.svelte';
  import Chips from '$lib/bits/Chips.svelte';
  import Count from '$lib/bits/Count.svelte';
  import DateText from '$lib/bits/DateText.svelte';
  import DriftMeter from '$lib/bits/DriftMeter.svelte';
  import Fact from '$lib/bits/Fact.svelte';
  import FundedMeter from '$lib/bits/FundedMeter.svelte';
  import KpiTile from '$lib/bits/KpiTile.svelte';
  import Money from '$lib/bits/Money.svelte';
  import Num from '$lib/bits/Num.svelte';
  import Percent from '$lib/bits/Percent.svelte';
  import Signed from '$lib/bits/Signed.svelte';
  import KpiSkeleton from '$lib/skeletons/KpiSkeleton.svelte';
  import PanelSkeleton from '$lib/skeletons/PanelSkeleton.svelte';
  import TableSkeleton from '$lib/skeletons/TableSkeleton.svelte';
  import ActionButton from './ActionButton.svelte';
  import HouseholdHoldings from './HouseholdHoldings.svelte';
  import HouseholdSettingsSheet, {
    DEFAULT_VIEW,
    type HouseholdView,
  } from './HouseholdSettings.svelte';
  import HouseholdTabs from './HouseholdTabs.svelte';
  import './snackbar.css';

  export let householdId: string;

  let view: HouseholdView = DEFAULT_VIEW;
  let settingsOpen = false;
  let message: string | null = null;

  $: household = getHouseholdById(householdId);

  $: portfolio = household ? getPortfolioFor(household.id) : undefined;
  $: members = household ? getClientsFor(household.id) : [];
  $: goals = household ? getGoalsFor(household.id) : [];
  $: proposals = household ? getProposalsFor(household.id) : [];
  $: activity = household ? getActivityFor(household.id, 12) : [];
  $: allocation = household ? getAllocationFor(household.id) : [];
  $: sheet = portfolio ? rebalanceSheet(portfolio.id) : [];
  /*
   * Every ticket ever raised for this mandate, newest first — the selector's
   * own order, not a sort here.
   *
   * `getOrders({ working: true })` would keep only the live ones, and the
   * settled and cancelled tickets are exactly the ones that explain the drift
   * the panel is reporting: a cancelled fixed-income sell is the last attempt
   * at this same rebalance. Filtering to "working" would hide the history and
   * leave an empty list for a mandate whose last trade filled yesterday.
   */
  $: orders = portfolio ? getOrders({ portfolioId: portfolio.id }) : [];
  $: performance = household ? getPerformanceSeries({ householdId: household.id }) : [];
  $: growth = household ? growthOf100({ householdId: household.id }) : [];
  // 3, 6 (year to date), 12 and 24 months, in that order — the kit's contract.
  $: windows = household ? returnWindows({ householdId: household.id }) : [];
  $: ytd = windows[1];
  $: objectives = goalSummary(goals);

  /*
   * Breach and drift counts come from the kit, not from a `.filter()` here.
   *
   * `driftedMandates()` returns only the mandates with something out of band,
   * so a household that is entirely in band is simply absent from it — which
   * is the zero, and `?? 0` is how that reads without a special case.
   */
  $: drifted = household
    ? driftedMandates().find((row) => row.household.id === household.id)
    : undefined;

  /**
   * The settings sheet's two allocation switches.
   *
   * Both test a field the KIT classified — the asset class and the in-band /
   * drifted / breach status — so this hides rows without deciding anything
   * about them. Generic so a `RebalanceRow` keeps its `side` and `absDrift` on
   * the way through.
   */
  const visible = <T extends AllocationRow>(rows: T[], current: HouseholdView): T[] =>
    rows.filter(
      (row) =>
        (current.cash || row.assetClass !== 'cash') &&
        (current.inBand || row.status !== 'in-band'),
    );

  $: allocationRows = visible(allocation, view);
  $: rebalanceRows = visible(sheet, view);

  /*
   * The snackbar is CONTROLLED, and this listener is what keeps it that way.
   *
   * Auto-hide, the close button and `hide()` all emit `mdClose`; assigning
   * `open = false` from script does not. Clearing the message here means the
   * element's own dismissal and this component's state land in the same frame.
   * Skip it and `open` stays `true` in this component's state while the
   * element has closed itself — and then the next message never reopens it,
   * because nothing changes for Svelte to write.
   */
  function onSnackbarClose() {
    message = null;
  }
</script>

{#if !household}
  <Screen
    crumbs={crumbsFor($pathname, null)}
    title={$t('wealth.screen.notFound.title')}
    subtitle={$t('wealth.screen.household.missing')}
  >
    <EmptyState message={$t('wealth.screen.household.missing')} />
  </Screen>
{:else}
  <Screen
    crumbs={crumbsFor($pathname, household)}
    title={$t('wealth.screen.household.title', { name: household.name })}
    subtitle={$t('wealth.screen.household.subtitle', {
      segment: $t(household.segmentKey),
      mandate: $t(household.mandateKey),
      members: members.length,
    })}
  >
    <svelte:fragment slot="aside">
      <!--
        Avatar, member-count badge and KYC dot as ONE object.

        `md-badge` and `md-status-dot` both position themselves absolutely
        against the nearest POSITIONED ancestor, which is what `.badge-anchor`
        is for — dropped in bare they anchor to whatever box happens to be
        positioned above them and get clipped by it. The badge takes the top
        corner and the dot the bottom, and the dot is deliberately unlabelled:
        the KYC chip beside it already says the same word, and naming both
        announces the state twice.
      -->
      <span class="badge-anchor">
        <md-avatar name={household.name} label={household.name} size="medium"></md-avatar>
        <md-badge shape="circle" value={String(household.memberCount)}></md-badge>
        <md-status-dot shape="circle" state={kycDot[household.kycStatus]} size="small"
        ></md-status-dot>
      </span>
      <Chips kind="segment" value={household.segment} />
      <Chips kind="mandate" value={household.mandate} />
      <Chips kind="strategy" value={household.strategy} />
      <Chips kind="kyc" value={household.kycStatus} />
    </svelte:fragment>

    <svelte:fragment slot="actions">
      <!-- An `md-toolbar` is ONE tab stop with arrow-key movement between its
           DIRECT children, so these are bare `md-button`s — a wrapper around
           any of them would drop it out of the roving group. None is
           emphasised: the rail's FAB is already the loudest control here. -->
      <ActionButton icon="balance" onActivate={() => navigate(route.trade())}>
        {$t('wealth.action.rebalance')}
      </ActionButton>
      <ActionButton
        icon="mail"
        onActivate={() => (message = $t('wealth.activity.client-contacted'))}
      >
        {$t('wealth.action.contact')}
      </ActionButton>
      <ActionButton icon="tune" onActivate={() => (settingsOpen = true)}>
        {$t('wealth.action.filter')}
      </ActionButton>
    </svelte:fragment>

    <section class="kpi-grid">
      <KpiTile
        label={$t('wealth.kpi.aum')}
        hint={portfolio ? portfolio.reference : $t('wealth.common.na')}
        trend={view.trend ? performance.map((point) => point.marketValue) : undefined}
        trendLabels={performance.map((point) => $t.formatDate(point.date, 'monthYear'))}
        formatTrend={(value) => $t.formatCurrency(value ?? 0, { notation: 'compact' })}
      >
        <svelte:fragment slot="value"><Money value={household.totalAum} compact /></svelte:fragment>
      </KpiTile>
      <KpiTile
        label={$t('wealth.kpi.ytdReturn')}
        color={plColor(ytd.excess)}
        trend={view.trend ? performance.map((point) => point.cumulativeReturn) : undefined}
        trendLabels={performance.map((point) => $t.formatDate(point.date, 'monthYear'))}
        formatTrend={(value) => $t.formatPercent(value ?? 0, { maximumFractionDigits: 1 })}
      >
        <!-- The sparkline takes the same colour the excess return is printed
             in, from the kit's own dead-banded mapping — never a ternary
             here. -->
        <svelte:fragment slot="value"><Percent value={household.ytdReturn} /></svelte:fragment>
        <svelte:fragment slot="hint">
          {$t('wealth.common.vsBenchmark')} <Signed value={ytd.excess} kind="percent" />
        </svelte:fragment>
      </KpiTile>
      <KpiTile label={$t('wealth.kpi.unrealisedPl')}>
        <svelte:fragment slot="value">
          <Signed value={household.unrealisedPl} compact />
        </svelte:fragment>
        <svelte:fragment slot="hint">
          {#if portfolio}<Percent value={portfolio.unrealisedPlPct} />{/if}
        </svelte:fragment>
      </KpiTile>
      <KpiTile label={$t('wealth.kpi.driftBreaches')} hint={$t('wealth.allocationStatus.drifted')}>
        <svelte:fragment slot="value"><Num value={drifted?.breachCount ?? 0} /></svelte:fragment>
        <svelte:fragment slot="trailing">
          <Count value={drifted?.driftedCount ?? 0} color="warning" />
        </svelte:fragment>
      </KpiTile>
      <KpiTile label={$t('wealth.kpi.goals')} hint={$t('wealth.kpi.goalsOnTrack')}>
        <svelte:fragment slot="value"><Num value={objectives.count} /></svelte:fragment>
        <svelte:fragment slot="trailing">
          <Count value={objectives.onTrack} color="success" />
        </svelte:fragment>
      </KpiTile>
    </section>

    <!-- ------------------------------------------------------- performance -->

    {#if portfolio}
      <Panel
        title={$t('wealth.panel.performance')}
        subtitle={$t('wealth.panel.performanceHint', {
          base: $t.formatNumber(100),
          months: $t.formatNumber(growth.length),
        })}
      >
        <div class="grid-wide">
          <!--
            Growth of 100, not two cumulative percentages: two crossing lines
            are readable and two crossing percentage figures are not.

            The benchmark is dropped from the DATA when the reader turns it
            off, rather than hidden through the chart's own legend — the chart
            remembers legend toggles across a data re-feed, so the two would
            fight over which of them owns "is the benchmark showing".

            `summary` replaces the generated `aria-label`, whose default
            sentence is assembled in English. There is no visible `label`,
            because the panel's own heading already names the chart.
          -->
          <Chart
            tag="md-line-chart"
            class="chart-md"
            series={[
              {
                id: 'portfolio',
                label: portfolio.reference,
                data: growth.map((point) => point.portfolio),
              },
              ...(view.benchmark
                ? [
                    {
                      id: 'benchmark',
                      label: portfolio.benchmarkName,
                      data: growth.map((point) => point.benchmark),
                    },
                  ]
                : []),
            ]}
            xAxis={{
              data: growth.map((point) => $t.formatDate(point.date, 'monthYear')),
              scale: 'category',
            }}
            yAxis={{ min: 90 }}
            valueFormatter={(value) => $t.formatNumber(value ?? 0, { maximumFractionDigits: 1 })}
            locale={$state.locale}
            summary={$t('wealth.panel.performance')}
            curve="monotone"
            grid="horizontal"
            legend="top-end"
          />

          <!--
            THE SAME SURFACE THE CHART SITS ON, and read off the chart rather
            than picked by eye: `md-line-chart`'s host paints
            `--md-sys-color-surface-container-low` at a 16px corner, which is
            exactly what `md-card variant="outlined"` is. The two blocks answer
            one question between them — how did this mandate do — so putting
            them on the same surface says so, where a bare `dl` floating under
            the chart read as an afterthought.
          -->
          <md-card variant="outlined" full-width class="surface-card fact-card">
            <dl class="dl">
              {#each windows as window (window.months)}
                <Fact
                  label={$t('wealth.unit.months', { value: $t.formatNumber(window.months) })}
                >
                  <Percent value={window.portfolio} />
                  <br />
                  <Signed value={window.excess} kind="percent" />
                </Fact>
              {/each}
              <Fact label={$t('wealth.kpi.maxDrawdown')}>
                <Signed value={portfolio.maxDrawdown} kind="percent" />
              </Fact>
              <Fact label={$t('wealth.table.benchmark')}>{portfolio.benchmarkName}</Fact>
            </dl>
          </md-card>
        </div>
      </Panel>
    {/if}

    <!-- -------------------------------------------------------- allocation -->

    <Panel title={$t('wealth.panel.allocation')} subtitle={$t('wealth.panel.allocationHint')}>
      <svelte:fragment slot="actions">
        {#if drifted}<Chips kind="allocation" value={drifted.worst.status} />{/if}
      </svelte:fragment>

      {#if allocationRows.length === 0}
        <EmptyState message={$t('wealth.empty.rebalance')} />
      {:else}
        <!--
          NOT `.grid-wide`, and that is the fix rather than a preference.

          The two halves of this panel are the SAME five rows twice — the chart
          is a picture of the cards. Side by side they cannot agree on a
          height: `.chart-md` pins the chart at 260px while five stacked
          `.alloc-row`s run to ~800px, so two thirds of the panel's width sat
          under the bars holding nothing at all. So the picture goes full
          width, where ten bars have room to be read, and the cards flow into
          `.grid-2` — the auto-fit track with a 340px floor, which is what the
          column they came out of was actually measuring, so each card keeps
          the width and the height it has today and only the number of them per
          row changes.
        -->
        <div class="stack">
          <!--
            Target against actual, one pair of bars per class. A donut cannot
            show a target beside an actual, which is the only comparison this
            panel exists to make.

            The weights stay FRACTIONS all the way to the axis —
            `valueFormatter` is what turns 0.62 into 62%, so nothing is
            multiplied by 100 on the way in and the tooltip, the axis and the
            figures beside them cannot disagree. `md-bar-chart` has no
            `summary` prop, so `label` is both the visible title and the seed
            of the accessible name; it names what the bars MEASURE rather than
            repeating the panel heading above it.
          -->
          <Chart
            tag="md-bar-chart"
            class="chart-md"
            series={[
              {
                id: 'target',
                label: $t('wealth.table.target'),
                data: allocationRows.map((row) => row.targetWeight),
              },
              {
                id: 'actual',
                label: $t('wealth.table.actual'),
                data: allocationRows.map((row) => row.actualWeight),
              },
            ]}
            xAxis={{ data: allocationRows.map((row) => $t(row.assetClassKey)) }}
            yAxis={{ min: 0 }}
            valueFormatter={(value) => $t.formatPercent(value ?? 0, { maximumFractionDigits: 1 })}
            locale={$state.locale}
            label={$t('wealth.table.weight')}
            legend="top-end"
          />

          <div class="grid-2">
            {#each rebalanceRows as row (row.assetClass)}
              <md-card variant="outlined" full-width class="alloc-row">
                <div class="alloc-row__head">
                  <h3 class="alloc-row__name">{$t(row.assetClassKey)}</h3>
                  <Chips kind="allocation" value={row.status} />
                </div>
                <!-- The meter shows the DISTANCE from target and its colour
                     how far; the direction is in the signed value beside it
                     and in the trade side below, because a bar has no negative
                     half to carry a sign. -->
                <DriftMeter drift={row.drift} />
                <div class="alloc-row__figures">
                  <span>
                    {$t('wealth.table.target')} <Percent value={row.targetWeight} digits={1} />
                  </span>
                  <span>
                    {$t('wealth.table.actual')} <Percent value={row.actualWeight} digits={1} />
                  </span>
                  <span>
                    {$t('wealth.table.driftBps')}
                    {$t('wealth.unit.bps', { value: $t.formatNumber(row.driftBps) })}
                  </span>
                </div>
                <div class="row">
                  <!-- `side` is the kit's own `'buy' | 'sell'`, and the signed
                       amount agrees with it: a sell is a negative trade. -->
                  <Chips kind="orderSide" value={row.side} />
                  <span class="muted">{$t('wealth.table.rebalance')}</span>
                  <Signed value={row.rebalanceAmount} compact />
                </div>
              </md-card>
            {/each}
          </div>

          <!--
            WHAT IS ALREADY IN THE MARKET FOR THIS MANDATE.

            Every card above ends in an instruction — sell €506.7k of fixed
            income, buy €490.1k of equity — and the one thing that changes
            whether an advisor acts on it is whether some of it is already
            done. A rebalance sheet read without the tickets is read twice.

            Nothing else on this screen carries it: the four tabs at the foot
            are members, mandate, documents and activity, and the holdings
            table below is what is HELD, not what is in flight. It is a list
            rather than a table (§5.5) because a mandate has one or two
            tickets, and `list-style="segmented"` keeps each one a tile rather
            than a hairline row inside a card that is already outlined.
          -->
          <md-divider></md-divider>

          <div class="row row--between">
            <h3 class="panel__title" id="household-tickets">
              {$t('wealth.panel.blotter')}
            </h3>
            <Count value={orders.length} />
          </div>

          {#if orders.length === 0}
            <EmptyState message={$t('wealth.empty.orders')} />
          {:else}
            <!-- `labelledby` rather than `label`: the heading above already
                 names the list, and a `label` prop would announce that same
                 name a second time.

                 `interaction-mode="multi-action"` even though no row is
                 clickable — the two state chips in each trailing slot are
                 `md-chip variant="assist"`, which is a focusable control, and
                 the default `single-action` treats a row as one target. -->
            <md-list
              labelledby="household-tickets"
              list-style="segmented"
              interaction-mode="multi-action"
            >
              {#each orders as order (order.id)}
                <!--
                  One order raised against this mandate, as a list row.

                  EVERY FIELD IS READ, NONE IS COMPUTED. `estimatedValueEur` is
                  the ticket's own converted figure, `filledQuantity` and
                  `quantity` are its own counts, and the three `*Key` fields
                  are the kit's own dictionary keys — so the row says "Limit"
                  and "Partially filled" in every locale without a lookup table
                  here.

                  ONE trailing element holding three, not three trailing
                  elements: the slot lays its children out as a column, so
                  siblings stack and triple the row height.

                  THE DATE IS IN THE SUPPORTING LINE, not in
                  `trailing-supporting-text`, and that is the manual's rule
                  rather than a preference: filling the `trailing` SLOT
                  replaces `trailing-icon` and `trailing-supporting-text`
                  outright, so a date slotted there is in the DOM at 0×0 —
                  announced by a screen reader, invisible to everyone else.
                  `slot="supporting-text"` keeps `DateText`'s real
                  `<time datetime>` instead of flattening the date into the
                  string prop.
                -->
                <md-list-item
                  headline={order.instrumentName}
                  overline={`${order.ticker} · ${$t(order.assetClassKey)}`}
                  leading-icon="receipt_long"
                  lines="3"
                >
                  <span slot="supporting-text">
                    {$t(order.orderTypeKey)} · {$t('wealth.table.filled')}
                    {$t('wealth.common.of', {
                      count: $t.formatNumber(order.filledQuantity),
                      total: $t.formatNumber(order.quantity),
                    })}
                    · <DateText value={order.createdDate} style="short" />
                  </span>
                  <span slot="trailing" class="row">
                    <Chips kind="orderSide" value={order.side} />
                    <Chips kind="orderStatus" value={order.status} />
                    <Money value={order.estimatedValueEur} compact />
                  </span>
                </md-list-item>
              {/each}
            </md-list>
          {/if}
        </div>
      {/if}
    </Panel>

    <!-- ---------------------------------------------------------- holdings -->

    <Panel
      title={$t('wealth.panel.holdings')}
      subtitle={portfolio ? portfolio.reference : undefined}
    >
      <svelte:fragment slot="actions">
        <Count value={household.positionCount} />
      </svelte:fragment>
      <HouseholdHoldings {household} {portfolio} />
    </Panel>

    <!-- -------------------------------------------------------- objectives -->

    <Panel
      title={$t('wealth.panel.objectives')}
      subtitle={$t('wealth.goal.projectedAt', {
        value: $t.formatCurrency(objectives.projectedTotal, { notation: 'compact' }),
      })}
    >
      <svelte:fragment slot="actions">
        <Count value={objectives.count} />
      </svelte:fragment>

      {#if goals.length === 0}
        <EmptyState message={$t('wealth.empty.goals')} />
      {:else}
        <div class="grid-3">
          {#each goals as goal (goal.id)}
            <div class="goal-row">
              <div class="row row--between">
                <span class="strong">{$t(goal.typeKey)}</span>
                <Chips kind="goalStatus" value={goal.status} />
              </div>
              <!-- The bar is clamped at 100% but the TEXT is not, so an
                   over-funded objective reads "119%" beside a full bar. -->
              <FundedMeter fraction={goal.fundedPct} status={goal.status} />
              <div class="row">
                <Chips kind="priority" value={goal.priority} />
                <span class="muted">
                  {goal.beneficiaryName ?? $t('wealth.common.household')}
                </span>
              </div>
              <div class="alloc-row__figures">
                <span>
                  {$t('wealth.goal.fundedOf', {
                    current: $t.formatCurrency(goal.currentAmount, { notation: 'compact' }),
                    target: $t.formatCurrency(goal.targetAmount, { notation: 'compact' }),
                  })}
                </span>
                <span>
                  {$t('wealth.table.targetDate')} <DateText value={goal.targetDate} />
                </span>
                <span>
                  {$t('wealth.goal.monthsRemaining', {
                    count: $t.formatNumber(goal.monthsRemaining),
                  })}
                </span>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </Panel>

    <!-- ------------------------------------------------------------- tabs -->

    <!-- No panel title: the tab strip is the heading of what is under it, and
         a card heading above a tab strip reads as a second, competing one. -->
    <Panel>
      <HouseholdTabs
        {household}
        {portfolio}
        {members}
        {goals}
        {proposals}
        {activity}
        {allocation}
        breachCount={drifted?.breachCount ?? 0}
        onNotify={(next) => (message = next)}
      />
    </Panel>

    <HouseholdSettingsSheet
      open={settingsOpen}
      {view}
      onChange={(next) => (view = next)}
      onClose={() => (settingsOpen = false)}
    />

    <!--
      One snackbar, one message. The component has no queue by design and M3
      forbids two at once, so every notification on this screen goes through
      this single element.

      `position="bottom"` is the component default and M3's placement: the
      surface is centred on the bottom edge, over content the reader is not
      working in. The offset that keeps it clear of the dock and — below 900px
      — the navigation bar is `.wealth-snackbar`, shared with the other two
      screens that toast so all three land in the same place.
    -->
    <md-snackbar
      class="wealth-snackbar"
      open={message !== null}
      message={message ?? ''}
      position="bottom"
      closeable
      auto-hide
      dismiss-label={$t('wealth.action.close')}
      on:mdClose={onSnackbarClose}
    ></md-snackbar>

    <svelte:fragment slot="skeleton">
      <!--
        The placeholder for THIS screen, rather than the generic one.

        Measured on a first drill from the overview: the fallback put 612px of
        placeholder where 3248px of screen was coming, and its four-tile row
        was 16px short of this five-tile one — the only KPI row in the app
        whose tiles carry a sparkline AND a bare text foot, which is what makes
        it 178 rather than 152.

        The five panels are the reading order of a review meeting, and the
        skeleton keeps it: how it did, how far off, what is in it, who it is
        for, and the four sibling views at the foot.

          .kpi-grid      five tiles, spark, text feet    178px
          the panel      performance                     356px
          the panel      allocation + tickets            951px
          the table      holdings                        740px
          the panel      objectives                      270px
          the panel      the four tabs                   673px

        `PanelSkeleton` and `TableSkeleton` draw 90px of their own chrome — a
        16px card inset, a 16px panel inset, a 14px head and the 12px gap under
        it — so each `height` here is the real block MINUS 90.

        THE OVERLAYS ARE NOT DRAWN, and that is correct rather than an
        omission: the settings side sheet and the snackbar are out of flow and
        closed, so they occupy nothing and a placeholder for them would occupy
        something.

        THREE OF THE SIX BLOCKS ARE NOT CONSTANTS, because this is the one
        screen that is drawn for eight different subjects and their panels are
        different heights. None of the three is a guess: each is a COUNT the
        screen has already read out of the fixture before the placeholder goes
        up, times a row height measured across all eight households.

          holdings     263 + 53 × positions   `HouseholdHoldings` does not
                                              paginate (its own note: nine rows
                                              is nowhere for pagination to go),
                                              so the table is exactly
                                              `positionCount` rows tall.
          allocation   771 + 90 × orders      the blotter under the rebalance
                       −12 when in band       cards is 88px per list row with a
                                              2px seam between them, and the
                                              panel head loses 12px when there
                                              is no drift chip in it.
          the tabs     497 + 88 × members     `md-tab-panels sizing="active"`
                                              takes its height from the open
                                              panel, and the open one is the
                                              members list.

        Verified on every household in the fixture: hh-01 through hh-08 all
        swap at 0px.

        ONE ANNOUNCEMENT: the first KPI tile names the household, the rest are
        silent.
      -->
      <!-- The first two tiles carry a sparkline — AUM and YTD return both plot
           the performance series — and every foot on this row is a bare line
           or a chip: 16px where the hint stands alone, 32px where a count sits
           beside it. The row is as tall as its tallest tile, so the two 146px
           sparkline tiles are what set the 178. -->
      <section class="kpi-grid">
        <KpiSkeleton
          announce
          label={$t('wealth.screen.household.title', { name: household.name })}
          foot="16px"
        />
        <KpiSkeleton foot="16px" />
        <KpiSkeleton spark={false} foot="16px" />
        <KpiSkeleton spark={false} />
        <KpiSkeleton spark={false} />
      </section>

      <!-- Performance: a 260px chart beside its return windows. -->
      <PanelSkeleton height="266px" />

      <!-- Allocation: the bar chart, the rebalance cards, and the blotter. -->
      <PanelSkeleton height={`${681 + 90 * orders.length - (drifted ? 0 : 12)}px`} />

      <!-- A real `md-table` inside a `.table-host`, so it gets the table
           shape. -->
      <TableSkeleton height={`${173 + 53 * household.positionCount}px`} />

      <!-- Objectives: one `.goal-row` per goal in a `.grid-3`. -->
      <PanelSkeleton height="180px" />

      <!-- The four sibling views, open on the members list. -->
      <PanelSkeleton height={`${407 + 88 * members.length}px`} />
    </svelte:fragment>
  </Screen>
{/if}
