<!--
  Screen 1 — the advisor's book, and the head of the drill path.

  Ported from the React build's `OverviewScreen.tsx` (the source of truth for
  this vertical). Layout only — NOTHING HERE IS ARITHMETIC: every figure,
  series, colour and column layout comes from `@awc-ui/showcase-kit/wealth`.
  `.map()` over a kit series to lift one field out is a projection, not a
  calculation.

  THREE DECISIONS WORTH KNOWING, all forced by a component manual:

    1. THE SCREEN HAS NO `md-toolbar`. `md-fab-menu`'s manual (and M3) say not
       to pair a FAB menu with a toolbar or a navigation rail. The screen's
       actions live where they belong anyway — the table's filters in
       `md-table-toolbar`, the period picker in the chart panel's head — and
       the quick-actions FAB is rendered ONLY below the rail breakpoint, where
       `app.css` takes the rail out of the DOM and `md-navigation-bar` (a
       FAB's proper companion) takes its place.

    2. THE DONUT'S SLICE COLOURS ARE TOKEN REFERENCES, PASSED AS-IS. The
       library's `resolveSeriesColor` resolves `var(--md-sys-color-*)` strings
       against the chart host, and re-resolves on its own theme tick — no
       probe hook needed here.

    3. THE DONUT IS NOT the shared `Chart` wrapper's default path.
       `md-pie-chart`'s data prop is `data`, not `series` — the one chart in
       the library that differs — so it is hand-wired below with the same
       `objectProps` action the wrapper is built on.

  THE SKELETON BEAT is `Screen.svelte`'s; what stays here is this screen's own
  SHAPE, because it is the one screen whose opening is not a KPI row and two
  panels. The placeholder is the REAL layout — same grids, same classes — so
  nothing moves when the data lands.
-->
<script lang="ts">
  import { onMount } from 'svelte';
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
  } from '@awc-ui/showcase-kit/wealth';
  import { crumbsFor, route, withBase } from '$lib/routes';
  import { isPlainClick, navigate, pathname } from '$lib/router';
  import { state, t } from '$lib/showcase';
  import { objectProps, type ChartSeries } from '$lib/elements';
  import Screen from '$lib/components/Screen.svelte';
  import Panel from '$lib/components/Panel.svelte';
  import Chart from '$lib/components/Chart.svelte';
  import Drill from '$lib/components/Drill.svelte';
  import { KpiSkeleton, PanelSkeleton } from '$lib/skeletons';
  import KpiTile from '$lib/bits/KpiTile.svelte';
  import Money from '$lib/bits/Money.svelte';
  import Num from '$lib/bits/Num.svelte';
  import Percent from '$lib/bits/Percent.svelte';
  import Signed from '$lib/bits/Signed.svelte';
  import Count from '$lib/bits/Count.svelte';
  import Fact from '$lib/bits/Fact.svelte';
  import DateText from '$lib/bits/DateText.svelte';
  import Chip from '$lib/bits/Chips.svelte';
  import DriftMeter from '$lib/bits/DriftMeter.svelte';
  import OverviewBookTable from './OverviewBookTable.svelte';

  /* ------------------------------------------------------------- constants */

  /** The index the kit rebases the performance series to. `growthOf100()`'s own base. */
  const GROWTH_BASE = 100;

  /**
   * The performance chart's y-axis floor.
   *
   * A value axis anchors itself to ZERO unless a `min` is given — correct for
   * a quantity, useless for an index where the whole story happens in the top
   * sixth of a 0–120 plot. And with the floor fixed, the axis is IDENTICAL at
   * all four periods, so the picker changes the horizontal range and nothing
   * else. 95 sits below the whole 24-month series (low 98.6), so nothing is
   * ever cropped; the top stays data-derived (`includeZero` only extends a
   * bound TOWARD zero, and this one is already positive).
   */
  const GROWTH_FLOOR = 95;

  /** The four windows the period picker offers, in months. The last is the whole history. */
  const PERIODS: readonly number[] = [3, 6, 12, HISTORY_MONTHS];

  /**
   * The chart heights `app.css` names as `.chart-sm` / `.chart-md` — repeated
   * as constants because a chart takes its height through its own `height`
   * prop; a wrapper class would size a box the canvas does not fill.
   */
  const CHART_MD = '260px';
  const CHART_LG = '340px';

  /* The activity feed is one disclosure, so there is a single length rather
     than a collapsed and an expanded one. Twelve is what the panel's own
     header offers to open. */
  const ACTIVITY_ROWS = 12;

  /* ---------------------------------------------------------- fixture data */

  const totals = getBookTotals();
  const points = getPerformanceSeries();
  const growth = growthOf100();
  const allocRows = getBookAllocation();
  const drifted = driftedMandates();
  const activityRows = getActivity({ limit: ACTIVITY_ROWS });

  /* --------------------------------------------------------------- KPI row */

  // Bound to the translator, so a locale change re-formats the hover readout.
  $: money = (value: number | null) => $t.formatCurrency(value ?? 0, { notation: 'compact' });
  $: percent = (value: number | null) =>
    $t.formatPercent(value ?? 0, { maximumFractionDigits: 2 });
  $: monthLabels = points.map((point) => $t.formatDate(point.date, 'monthYear'));

  /* ----------------------------------------------------------- performance */

  /*
   * Growth of 100, book against benchmark, with the period picker driving the
   * range. THE PICKER IS REAL: it re-slices the series through the kit's
   * `tail()` and re-reads the window's returns through `returnWindow()` — the
   * figures under the chart change with it, and neither number is computed
   * here. `base` in the subtitle is the first value actually on screen, so
   * the sentence stays true at every window.
   */
  let months: number = HISTORY_MONTHS;

  function onPeriodChange(event: Event) {
    const [value] = (event as CustomEvent<string[]>).detail ?? [];
    if (value) months = Number(value);
  }

  $: visible = tail(growth, months);
  $: windowReturn = returnWindow(points, months);
  $: index = (value: number | null) => $t.formatNumber(value ?? 0, { maximumFractionDigits: 1 });
  $: perfTitle = $t('wealth.panel.performance');

  /*
   * THE BENCHMARK IS DASHED, and that is not decoration: the palette's first
   * two roles sit close together in dark mode, and the stroke style is a
   * second carrier beside the legend. Typed past the narrow `ChartSeries`
   * because `dash` is a real per-series option of `md-line-chart` the shared
   * type does not carry yet — widening it HERE keeps the shared file out of
   * this screen's diff.
   */
  $: perfSeries = [
    { id: 'book', label: $t('wealth.panel.book'), data: visible.map((p) => p.portfolio) },
    {
      id: 'benchmark',
      label: $t('wealth.kpi.benchmark'),
      data: visible.map((p) => p.benchmark),
      dash: 'dashed',
    },
  ] as (ChartSeries & { dash?: 'solid' | 'dashed' | 'dotted' })[];

  /* ----------------------------------------------------------------- donut */

  /*
   * `md-pie-chart`, wired by hand: its data prop is `data`, not `series`, so
   * the shared wrapper (which assigns `series`) would render an empty ring.
   * `objectProps` is the same primitive the wrapper is built on — nothing is
   * being worked around, only a different prop name honoured.
   *
   * The palette is the kit's, looked up PER ROW rather than positionally:
   * equity must be the same violet in the ring, the chip and the meter, and a
   * lookup by class cannot drift if either order ever changes.
   */
  const donutColors = allocRows.map((row) => assetClassColor[row.assetClass]);

  $: donutMoney = (value: number) => $t.formatCurrency(value, { notation: 'compact' });
  $: donutProps = {
    data: allocRows.map((row, i) => ({
      label: $t(row.assetClassKey),
      value: row.marketValue,
      color: donutColors[i],
    })),
    valueFormatter: donutMoney,
    tableLabels: {
      category: $t('wealth.table.assetClass'),
      value: $t('wealth.table.marketValue'),
      share: $t('wealth.table.weight'),
    },
  };

  /* -------------------------------------------------------------- activity */

  /*
   * A custom element's `href` is the BROWSER's link, not the router's.
   * `md-list-item type="link"` renders a real anchor inside its shadow root —
   * right, because it gives the row a URL to copy and a ⌘-click that opens a
   * tab — but a plain click would walk the whole document out of the SPA.
   * `composedPath()` is the only way to find the row across the shadow
   * boundary, and every non-plain click is left to the browser.
   */
  function onActivityClick(event: MouseEvent) {
    if (!isPlainClick(event)) return;
    const item = event
      .composedPath()
      .find(
        (node): node is HTMLElement =>
          node instanceof HTMLElement && node.tagName === 'MD-LIST-ITEM',
      );
    const href = item?.getAttribute('href');
    if (!href) return;
    event.preventDefault();
    // The attribute is base-prefixed (it IS the browser's URL); `navigate()`
    // normalises either flavour, so the base is stripped on the way in.
    navigate(href);
  }

  /* --------------------------------------------------------- quick actions */

  /*
   * The compact-width primary action: one FAB that fans out into three.
   * COMPACT-ONLY because `md-fab-menu`'s manual says not to pair a FAB menu
   * with a toolbar or a navigation rail — above 900px this app HAS a rail,
   * and that rail already carries the one FAB M3 allows there. The `{#if}`
   * gate MOUNTS and unmounts the cluster (never merely hides it), the same
   * DOM the React build's gate component produces.
   *
   * The breakpoint mirrors the one `app.css` uses to swap the rail for the
   * bar — quoted rather than imported because it is a CSS fact. `compact`
   * starts false and settles in `onMount`, so the first frame is the same on
   * every machine and nothing is read during render.
   */
  const FAB_ID = 'wealth-overview-quick-actions';

  const QUICK_ACTIONS: readonly { icon: string; labelKey: string; path: string }[] = [
    { icon: 'description', labelKey: 'wealth.action.newProposal', path: route.proposals() },
    { icon: 'swap_horiz', labelKey: 'wealth.action.newOrder', path: route.trade() },
    { icon: 'flag', labelKey: 'wealth.action.newGoal', path: route.planning() },
  ];

  let compact = false;

  onMount(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia('(max-width: 899px)');
    const update = () => (compact = mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  });

  /*
   * `mdClick` from an item carries NO detail — the pressed row is
   * `event.target` even from a listener on the menu, because the event
   * bubbles and is composed. The route rides on a data attribute rather than
   * a prop: `md-fab-menu-item` has no `value`, and `dataset` reads it back
   * without coupling to the component. The menu closes itself and returns
   * focus to the FAB; calling `close()` from here is the documented
   * anti-pattern. `navigate()` takes an UNPREFIXED path and adds the mount
   * itself, so these stay client-side.
   */
  function onQuickAction(event: Event) {
    const item = event.target as HTMLElement | null;
    const path = item?.dataset?.path;
    if (path) navigate(path);
  }
</script>

<Screen
  title={$t('wealth.screen.overview.title')}
  subtitle={$t('wealth.screen.overview.subtitle', {
    date: $t.formatDate(REPORTING_DATE, 'long'),
  })}
  crumbs={crumbsFor($pathname)}
>
  <md-chip
    slot="aside"
    variant="assist"
    appearance="outlined"
    icon="groups"
    label={$t('wealth.common.of', {
      count: totals.householdCount,
      total: totals.clientCount,
    })}
    title="{$t('wealth.kpi.households')} / {$t('wealth.kpi.clients')}"
  ></md-chip>

  <!-- ------------------------------------------------------------ KPI row -->
  <section class="kpi-grid">
    <KpiTile
      label={$t('wealth.kpi.aum')}
      hint={$t('wealth.kpi.aum.help')}
      trend={points.map((point) => point.marketValue)}
      trendLabels={monthLabels}
      formatTrend={money}
      color="primary"
    >
      <Money slot="value" value={totals.aum} compact />
    </KpiTile>

    <!-- The sparkline's colour is the excess return's colour, from the kit's
         own map — so the line agrees with the sign underneath it instead of
         being a decorative accent that happens to be green. -->
    <KpiTile
      label={$t('wealth.kpi.ytdReturn')}
      trend={points.map((point) => point.cumulativeReturn)}
      trendLabels={monthLabels}
      formatTrend={percent}
      color={plColor(totals.ytdExcessReturn)}
    >
      <Percent slot="value" value={totals.ytdReturn} />
      <svelte:fragment slot="hint"
        >{$t('wealth.common.vsBenchmark')}
        <Signed value={totals.ytdExcessReturn} kind="percent" /></svelte:fragment
      >
    </KpiTile>

    <!-- Monthly NET FLOW, not the balance: this tile is about money arriving
         and leaving, and the balance's own line is already on the AUM tile. -->
    <KpiTile
      label={$t('wealth.kpi.netNewMoney')}
      trend={points.map((point) => point.netFlow)}
      trendLabels={monthLabels}
      formatTrend={money}
      color="tertiary"
    >
      <Signed slot="value" value={totals.netNewMoneyYtd} compact />
      <svelte:fragment slot="hint"
        >{$t('wealth.unit.months', { value: 12 })}
        <Signed value={totals.netNewMoneyOneYear} compact /></svelte:fragment
      >
    </KpiTile>

    <!-- No sparkline: there is no history behind these two counts in the
         fixture, and drawing a flat line would invent one. `trailing` is a
         `Count` chip rather than an `md-badge`, which would anchor to the
         card's corner and be clipped in half — see `bits/Count.svelte`. -->
    <KpiTile label={$t('wealth.kpi.driftBreaches')} hint={$t('wealth.kpi.kycReviewDue')} color="error">
      <Num slot="value" value={totals.driftBreachCount} />
      <Count slot="trailing" value={totals.kycReviewDueCount} color="warning" />
    </KpiTile>
  </section>

  <section class="grid-wide">
    <!-- ----------------------------------------------------- performance -->
    <Panel
      title={perfTitle}
      subtitle={$t('wealth.panel.performanceHint', {
        base: $t.formatNumber(visible[0]?.portfolio ?? GROWTH_BASE, { maximumFractionDigits: 0 }),
        months: windowReturn.months,
      })}
    >
      <md-segmented-button-set slot="actions" aria-label={perfTitle} on:mdChange={onPeriodChange}>
        {#each PERIODS as period (period)}
          <!-- `label`, never slotted text: slotted label content is read once
               before the first render, so a translated string arriving later
               would never make it into the segment. -->
          <md-segmented-button
            value={String(period)}
            label={$t('wealth.unit.months', { value: period })}
            selected={period === months || undefined}
          ></md-segmented-button>
        {/each}
      </md-segmented-button-set>

      <!-- The chart carries no `label` of its own — the panel above already
           says it, and two headings for one figure is worse than one.
           `summary` replaces the generated English aria-label so the figure
           is still named, in the reader's language. -->
      <Chart
        tag="md-line-chart"
        series={perfSeries}
        xAxis={{ data: visible.map((p) => $t.formatDate(p.date, 'monthYear')), scale: 'category' }}
        yAxis={{ label: perfTitle, min: GROWTH_FLOOR }}
        valueFormatter={index}
        locale={$state.locale}
        curve="monotone"
        legend="top-end"
        axis-ticks
        height={CHART_MD}
        summary={$t('chart.summary.line', { label: perfTitle, count: 2 })}
      />

      <md-divider></md-divider>

      <!-- The numbers the curve is being read for, and the reason the picker
           is not decoration: all three come from `returnWindow()` for the
           selected window. -->
      <dl class="dl">
        <Fact label={$t('wealth.unit.months', { value: windowReturn.months })}>
          <Signed value={windowReturn.portfolio} kind="percent" />
        </Fact>
        <Fact label={$t('wealth.kpi.benchmark')}>
          <Percent value={windowReturn.benchmark} />
        </Fact>
        <Fact label={$t('wealth.kpi.excessReturn')}>
          <Signed value={windowReturn.excess} kind="percent" />
        </Fact>
      </dl>
    </Panel>

    <!-- ------------------------------------------------------ allocation -->
    <Panel title={$t('wealth.panel.allocation')} subtitle={$t('wealth.panel.allocationHint')}>
      <!-- `inner-radius` first, then the centre slot: content in the middle
           of a SOLID pie sits on top of the slices. The centre overlay is
           `aria-hidden` inside the component, which is fine here because the
           same figure is the first KPI tile on the screen.

           `show-labels="false"` — the STRING, matching what the React build
           writes into the DOM — because a legend is already naming the
           slices, and the label the chart would draw inside them is a
           nine-digit euro amount that does not fit in a 4% wedge. -->
      <md-pie-chart
        use:objectProps={donutProps}
        locale={$state.locale}
        label-plot={$t('wealth.chart.plotHint')}
        inner-radius="62%"
        padding-angle="1"
        show-labels="false"
        legend="bottom"
        height={CHART_LG}
      >
        <!-- Taller than the line chart beside it (`height` above): a ring
             plus a five-item legend needs the height the curve does not, and
             `.grid-wide` stretches both cards to the taller one anyway. -->
        <div slot="center">
          <strong><Money value={totals.aum} compact /></strong>
          <br />
          {$t('wealth.kpi.aum.short')}
        </div>
      </md-pie-chart>
    </Panel>
  </section>

  <!-- Two columns, not three: `app.css` stretches cards in a row to the
       tallest of them on purpose, so panels sharing a row want similar
       content. The trail goes full width at the bottom instead, where its
       rows have room for the actor as well. -->
  <section class="grid-2">
    <!-- ----------------------------------------------------- drift panel -->
    <!-- No subtitle: the donut panel beside it already carries "target
         against actual, by asset class", and saying it twice on one screen
         is noise. -->
    <Panel title={$t('wealth.table.drift')}>
      <div class="stack">
        {#each allocRows as row (row.assetClass)}
          <!-- `md-card`, not a `<div>` with a border: `variant="outlined"` is
               exactly what the old hand-rolled rule was, with the component's
               density scale, RTL-safe logical padding and state layer. The
               class carries nothing but the internal stack. -->
          <md-card variant="outlined" full-width class="alloc-row">
            <div class="alloc-row__head">
              <h3 class="alloc-row__name">{$t(row.assetClassKey)}</h3>
              <Chip kind="allocation" value={row.status} />
            </div>

            <!-- `md-meter`, not `md-progress-indicator`: this is a STATE (how
                 far from target), not an activity. Colour is never the only
                 signal — the signed text beside the label carries direction. -->
            <DriftMeter drift={row.drift} />

            <div class="alloc-row__figures">
              <span>
                {$t('wealth.table.target')} <Percent value={row.targetWeight} digits={1} />
              </span>
              <span>
                {$t('wealth.table.actual')} <Percent value={row.actualWeight} digits={1} />
              </span>
              <span>
                {$t('wealth.table.rebalance')} <Signed value={row.rebalanceAmount} compact />
              </span>
            </div>
          </md-card>
        {/each}
      </div>
    </Panel>

    <!-- ------------------------------------------------- rebalance panel -->
    <!-- EVERY DRIFTED MANDATE, not the first five: a rebalancing queue is
         exactly the list you want in full — "2 more" gives no name, no drift
         and nothing to act on. -->
    <Panel title={$t('wealth.panel.rebalance')} subtitle={$t('wealth.panel.rebalanceHint')}>
      <Count slot="actions" value={drifted.length} color="warning" />
      {#if drifted.length === 0}
        <!-- No `hint`: this is a fact about the book, not a filter result,
             and telling the reader to widen a filter they never set would be
             nonsense. -->
        <div class="empty">
          <p>{$t('wealth.empty.rebalance')}</p>
        </div>
      {:else}
        <div class="stack">
          {#each drifted as entry (entry.household.id)}
            <md-card variant="outlined" full-width class="alloc-row">
              <div class="alloc-row__head">
                <span class="with-dot">
                  <!-- `label` names it for assistive tech; `name` only
                       supplies the initials. A household is not a control and
                       opens nothing, so the avatar is presentational beside
                       the link that does. -->
                  <md-avatar
                    name={entry.household.name}
                    label={entry.household.name}
                    size="small"
                  ></md-avatar>
                  <Drill href={route.household(entry.household.id)}>{entry.household.name}</Drill>
                </span>
                <Chip kind="allocation" value={entry.worst.status} />
              </div>

              <div class="alloc-row__figures">
                <span>
                  {$t(entry.worst.assetClassKey)}
                  <Signed value={entry.worst.drift} kind="percent" />
                </span>
                <span>
                  {$t('wealth.kpi.driftBreaches')} <Num value={entry.breachCount} />
                </span>
                <span>
                  {$t('wealth.allocationStatus.drifted')} <Num value={entry.driftedCount} />
                </span>
              </div>
            </md-card>
          {/each}
        </div>
      {/if}
    </Panel>
  </section>

  <OverviewBookTable />

  <!-- ------------------------------------------------------------- trail -->
  <!-- NO PANEL HEAD: the title, the "newest first" hint and the expand
       control all moved into the list's own disclosure row — `Panel`'s
       `title` is optional precisely for this. The caret is the component's:
       an `expandable` row renders its own trailing icon button carrying
       `aria-expanded` / `aria-controls` and rotates its glyph. -->
  <Panel>
    {#if activityRows.length === 0}
      <div class="empty">
        <p>{$t('wealth.empty.activity')}</p>
      </div>
    {:else}
      <!-- `md-list`, not a hand-rolled `<ul>`: the household screen renders
           this same feed as a list, and two views of one entity should not
           disagree about what an activity row looks like. `type="link"`
           rather than an anchor inside a cell: the household is the only
           destination the row has, so the whole row carries it. The click
           listener is the native, bubble-phase delegation described above. -->
      <md-list
        on:click={onActivityClick}
        label={$t('wealth.panel.activity')}
      >
        <md-list-item
          expandable
          expanded
          leading-icon="history"
          headline={$t('wealth.panel.activity')}
          supporting-text="{$t('wealth.common.entries', {
            count: activityRows.length,
          })} · {$t('wealth.panel.activityHint')}"
        >
          {#each activityRows as entry, entryIndex (entry.id)}
            <!-- Hairlines are interleaved `md-divider`s — `md-list` has no
                 `dividers` prop, and the list hides them from assistive tech
                 itself. Everything in here is slotted: `expanded-content`
                 takes a FLAT run of rows, never a nested `md-list` chassis. -->
            {#if entryIndex > 0}
              <md-divider slot="expanded-content" inset></md-divider>
            {/if}
            <!-- One line, and the household is IN it: the log reads as a
                 sentence, so it is written as one, and the date and actor sit
                 in the trailing metadata where the eye can scan a column of
                 them. `href` is base-prefixed because this one IS the
                 browser's URL; the handler strips the base back off before
                 routing. -->
            <md-list-item
              slot="expanded-content"
              type="link"
              href={withBase(route.household(entry.householdId))}
              leading-icon="history"
              headline="{$t(entry.actionKey)} · {entry.householdName}"
              lines="1"
            >
              <span slot="trailing-supporting-text">
                <DateText value={entry.date} style="short" /> · {entry.actorName}
              </span>
            </md-list-item>
          {/each}
        </md-list-item>
      </md-list>
    {/if}
  </Panel>

  <!-- ----------------------------------------------------- quick actions -->
  {#if compact}
    <!-- The FAB is icon-only, so it carries its own `aria-label`; the popup
         is named separately by `menu-label`. The menu wires itself to the FAB
         by `id` and manages `aria-expanded`, `aria-haspopup` and the icon
         morph — none of which are set here. Positioning is logical so the
         cluster lands in the correct corner under `dir="rtl"`, and it clears
         both the docked navigation bar and `<awc-showcase-dock>`, whose
         measured height the kit publishes as `--awc-dock-height`. -->
    <md-fab
      id={FAB_ID}
      icon="add"
      aria-label={$t('wealth.nav.toolbar')}
      style="position: fixed; inset-inline-end: var(--md-sys-spacing-inset-lg, 16px); inset-block-end: calc(var(--awc-dock-height, 0px) + 80px + var(--md-sys-spacing-inset-lg, 16px)); z-index: var(--md-sys-z-index-navigation, 200)"
    ></md-fab>
    <md-fab-menu
      anchor={FAB_ID}
      placement="up"
      menu-label={$t('wealth.nav.toolbar')}
      on:mdClick={onQuickAction}
    >
      {#each QUICK_ACTIONS as action (action.labelKey)}
        <md-fab-menu-item
          icon={action.icon}
          label={$t(action.labelKey)}
          data-path={action.path}
        ></md-fab-menu-item>
      {/each}
    </md-fab-menu>
  {/if}

  <!-- ---------------------------------------------------------- skeleton -->
  <!-- The screen's layout with nothing in it yet: every wrapper is the SAME
       element and the same class as the real body, so the swap moves nothing
       on the page. Exactly ONE shape announces — fourteen polite live regions
       saying "loading" would be fourteen announcements for one event. -->
  <svelte:fragment slot="skeleton">
    <section class="kpi-grid">
      <KpiSkeleton announce />
      <KpiSkeleton />
      <KpiSkeleton />
      <KpiSkeleton />
    </section>

    <section class="grid-wide">
      <PanelSkeleton height={CHART_MD} />
      <PanelSkeleton height={CHART_LG} />
    </section>

    <section class="grid-2">
      <PanelSkeleton lines={10} />
      <PanelSkeleton lines={10} />
    </section>

    <div class="table-host">
      <md-card variant="outlined" class="panel" full-width>
        <div class="panel__inner">
          <div class="panel__head">
            <div class="skel" style="inline-size: 120px; block-size: 16px" />
            <div class="skel" style="inline-size: 220px; block-size: 16px" />
          </div>
          <div class="skel" style="inline-size: 100%; block-size: 320px" />
        </div>
      </md-card>
    </div>

    <PanelSkeleton lines={8} />
  </svelte:fragment>
</Screen>
