/**
 * Screen 1 — the advisor's book, and the head of the drill path.
 *
 * WHAT IS ON IT, and why it is in this order. An advisor opens this screen to
 * answer four questions before anything else: how big is the book, is it
 * beating its benchmark, is money arriving or leaving, and what needs attention
 * today. So: a KPI row that answers all four at a glance, then the two shapes
 * those numbers came from (the performance curve and the allocation ring), then
 * the two attention lists, then the book itself as a table you can sort and
 * filter, and the audit trail underneath it.
 *
 * NOTHING HERE IS ARITHMETIC. Every figure, series, colour and column layout
 * comes from `@awc-ui/showcase-kit/wealth`; this file decides layout and
 * nothing else. `.map()` over a kit series to lift one field out is a
 * projection, not a calculation — it is how the credit-risk overview feeds its
 * sparklines too.
 *
 * THREE DECISIONS WORTH KNOWING, all of them forced by a component manual:
 *
 *   1. THE SCREEN HAS NO `md-toolbar`. `md-fab-menu`'s manual (and M3) say not
 *      to pair a FAB menu with a toolbar or a navigation rail. The screen's
 *      actions therefore live where they belong anyway — the table's filters in
 *      `md-table-toolbar`, the period picker in the chart panel's head — and the
 *      quick-actions FAB is rendered ONLY below the rail breakpoint, where
 *      `app.css` takes the rail out of the DOM and `md-navigation-bar` (a FAB's
 *      proper companion) takes its place. Exactly one prominent action exists at
 *      each width: the rail's FAB at desktop, this one on compact.
 *
 *   2. THE DONUT'S SLICE COLOURS ARE TOKEN REFERENCES, PASSED AS-IS. The kit's
 *      palette is `var(--md-sys-color-*)` strings, and the library's
 *      `resolveSeriesColor` now resolves those against the chart host before
 *      they reach a Canvas2D `fillStyle` — the same path axis bands always
 *      took. This screen used to carry a ~50-line probe hook for it
 *      (`useTokenColors`); that was a workaround for the series path not
 *      calling the resolver, fixed in the library.
 *
 *   3. THE DONUT IS NOT `<PieChart>`. `md-pie-chart`'s data prop is `data`, not
 *      `series` — it is the one chart in the library that differs — so the shared
 *      wrapper, which assigns `series`, would render an empty ring. `Donut`
 *      below uses `useElementProps` from `elements.tsx`, the same primitive the
 *      wrappers are built on.
 *
 * THE SKELETON BEAT lives in `../skeletons` now, and `<Screen>` owns the swap
 * for every screen. What stays here is this screen's own SHAPE, because it is
 * the one screen whose opening is not a KPI row and two panels. `md-skeleton` is
 * for content whose shape is known in advance (§7.2), so the placeholder is the
 * REAL layout — four KPI tiles in the same grid, two panels in the same
 * `grid-wide`, two more in the same `grid-2`, the table and the trail — and
 * nothing moves when the data lands. A fixed timeout keeps it deterministic: no
 * clock is read, and two runs produce the same frames.
 */

import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
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
  type AllocationRow,
  type DriftedMandate,
} from '@awc-ui/showcase-kit/wealth';
import { crumbsFor, route, withBase } from '@/lib/routes';
import { isPlainActivation, usePathname, useRouter } from '@/lib/router';
import { useShowcase, useT } from '@/lib/showcase';
import { Panel, Screen } from '../Shell';
import { KpiSkeleton, PanelSkeleton } from '../skeletons';
import {
  LineChart,
  useCustomEvent,
  useDomEvent,
  useElementProps,
  type ChartSeries,
} from '../elements';
import {
  AllocationChip,
  Count,
  DateText,
  Drill,
  DriftMeter,
  Fact,
  KpiTile,
  Money,
  Num,
  Percent,
  Signed,
} from '../bits';
import { OverviewBookTable } from './OverviewBookTable';

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
 * Repeated as constants rather than as classes because a chart takes its height
 * through its own `height` prop — a wrapper class would size a box the canvas
 * does not fill. Same numbers, so two charts meant to be compared still match.
 */
const CHART_MD = '260px';
const CHART_LG = '340px';

/** How many rows each attention list shows before it stops being a list. */
const ATTENTION_ROWS = 5;
/* The activity feed is one disclosure now, not a short list with a "view all"
   toggle, so there is a single length rather than a collapsed and an expanded
   one. Twelve is what the panel's own header offers to open. */
const ACTIVITY_ROWS = 12;

/* ------------------------------------------------------------------- hooks */

/**
 * A media query as React state.
 *
 * Starts `false` and settles in an effect, so the first frame is the same on
 * every machine and nothing is read during render. The breakpoint mirrors the
 * one `app.css` uses to swap the rail for the bar — it is quoted here rather
 * than imported because it is a CSS fact, and the two are checked together in
 * the browser.
 */
function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia(query);
    const update = () => setMatches(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, [query]);

  return matches;
}

/* ------------------------------------------------------------------ screen */

export function OverviewScreen() {
  const t = useT();
  const pathname = usePathname();
  const totals = getBookTotals();

  /*
   * The loading beat. One timer, cleared on unmount, and it never restarts:
   * leaving the screen and coming back re-mounts this component, which is
   * exactly when a dashboard would refetch anyway.
   */

  return (
    <Screen
      title={t('wealth.screen.overview.title')}
      subtitle={t('wealth.screen.overview.subtitle', {
        date: t.formatDate(REPORTING_DATE, 'long'),
      })}
      crumbs={crumbsFor(pathname)}
      skeleton={<OverviewSkeleton />}
      aside={
        <md-chip
          variant="assist"
          appearance="outlined"
          icon="groups"
          label={t('wealth.common.of', {
            count: totals.householdCount,
            total: totals.clientCount,
          })}
          title={`${t('wealth.kpi.households')} / ${t('wealth.kpi.clients')}`}
        />
      }
    >
      {/* Mounted, not merely hidden: every panel below owns refs and custom-event
          listeners, and an effect that runs while its element does not exist yet
          would never attach one. Swapping whole subtrees keeps that honest —
          `<Screen>` owns the swap now, and is handed this screen's own shape
          above rather than the generic one. */}
      <OverviewBody />

      <QuickActions />
    </Screen>
  );
}

/* -------------------------------------------------------------------- body */

function OverviewBody() {
  return (
    <>
      <KpiRow />

      <section className="grid-wide">
        <PerformancePanel />
        <AllocationPanel />
      </section>

      {/*
        Two columns, not three. `app.css` stretches cards in a row to the
        tallest of them on purpose, so panels sharing a row want similar
        content: five allocation blocks and five drifted mandates are within a
        row of each other, while a six-line timeline in the same row would have
        left a third of a card empty. The trail goes full width at the bottom
        instead, where its rows have room for the actor as well.
      */}
      <section className="grid-2">
        <DriftPanel />
        <RebalancePanel />
      </section>

      <OverviewBookTable />

      <ActivityPanel />
    </>
  );
}

/* ---------------------------------------------------------------- KPI  row */

function KpiRow() {
  const t = useT();
  const totals = getBookTotals();
  const points = getPerformanceSeries();

  // Bound to the translator, so a locale change re-formats the hover readout.
  const money = useMemo(
    () => (value: number | null) => t.formatCurrency(value ?? 0, { notation: 'compact' }),
    [t],
  );
  const percent = useMemo(
    () => (value: number | null) => t.formatPercent(value ?? 0, { maximumFractionDigits: 2 }),
    [t],
  );

  const monthLabels = points.map((point) => t.formatDate(point.date, 'monthYear'));

  return (
    <section className="kpi-grid">
      <KpiTile
        label={t('wealth.kpi.aum')}
        value={<Money value={totals.aum} compact />}
        hint={t('wealth.kpi.aum.help')}
        trend={points.map((point) => point.marketValue)}
        trendLabels={monthLabels}
        formatTrend={money}
        color="primary"
      />

      {/* The sparkline's colour is the excess return's colour, from the kit's
          own map — so the line agrees with the sign underneath it instead of
          being a decorative accent that happens to be green. */}
      <KpiTile
        label={t('wealth.kpi.ytdReturn')}
        value={<Percent value={totals.ytdReturn} />}
        hint={
          <>
            {t('wealth.common.vsBenchmark')} <Signed value={totals.ytdExcessReturn} kind="percent" />
          </>
        }
        trend={points.map((point) => point.cumulativeReturn)}
        trendLabels={monthLabels}
        formatTrend={percent}
        color={plColor(totals.ytdExcessReturn)}
      />

      <KpiTile
        label={t('wealth.kpi.netNewMoney')}
        value={<Signed value={totals.netNewMoneyYtd} compact />}
        hint={
          <>
            {t('wealth.unit.months', { value: 12 })}{' '}
            <Signed value={totals.netNewMoneyOneYear} compact />
          </>
        }
        // Monthly NET FLOW, not the balance: this tile is about money arriving
        // and leaving, and the balance's own line is already on the AUM tile.
        trend={points.map((point) => point.netFlow)}
        trendLabels={monthLabels}
        formatTrend={money}
        color="tertiary"
      />

      {/* No sparkline: there is no history behind these two counts in the
          fixture, and drawing a flat line would invent one. `trailing` is a
          `Count` chip rather than an `md-badge`, which would anchor to the
          card's corner and be clipped in half — see `bits.tsx`. */}
      <KpiTile
        label={t('wealth.kpi.driftBreaches')}
        value={<Num value={totals.driftBreachCount} />}
        hint={t('wealth.kpi.kycReviewDue')}
        trailing={<Count value={totals.kycReviewDueCount} color="warning" />}
        color="error"
      />
    </section>
  );
}

/* --------------------------------------------------------- performance */

/**
 * Growth of 100, book against benchmark, with the period picker driving the
 * range (§7.2 pairs exactly these two).
 *
 * THE PICKER IS REAL. It re-slices the series through the kit's `tail()` and
 * re-reads the window's returns through `returnWindow()` — the figures under
 * the chart change with it, and neither number is computed here. `base` in the
 * subtitle is the first value actually on screen, read off the kit's series, so
 * the sentence stays true at every window rather than claiming a rebase that
 * only holds over the full history.
 */
function PerformancePanel() {
  const t = useT();
  const { state } = useShowcase();
  const [months, setMonths] = useState<number>(HISTORY_MONTHS);

  const pickerRef = useRef<HTMLElement | null>(null);
  useCustomEvent<CustomEvent<string[]>>(pickerRef, 'mdChange', (event) => {
    const [value] = event.detail ?? [];
    if (value) setMonths(Number(value));
  });

  const points = getPerformanceSeries();
  const growth = growthOf100();
  const visible = tail(growth, months);
  const windowReturn = returnWindow(points, months);

  const index = useMemo(
    () => (value: number | null) => t.formatNumber(value ?? 0, { maximumFractionDigits: 1 }),
    [t],
  );

  const title = t('wealth.panel.performance');

  /*
   * THE BENCHMARK IS DASHED, and that is not decoration. The palette's first
   * two roles are a violet and a rose that sit close together in dark mode, and
   * a reference line the reader cannot separate from the mandate is worse than
   * no reference line at all. The stroke style is a second carrier beside the
   * legend, which is exactly what the chart's manual asks for.
   *
   * Typed locally because `ChartSeries` in `elements.tsx` models only the four
   * fields the wrappers needed on day one — `dash`, `color` and `symbol` are
   * real per-series options of `md-line-chart` that it does not carry yet.
   * Widening it HERE rather than there keeps the shared file out of this
   * screen's diff; the array is built as a variable so the extra field is not
   * an excess property on a fresh literal.
   */
  const series: (ChartSeries & { dash?: 'solid' | 'dashed' | 'dotted' })[] = [
    { id: 'book', label: t('wealth.panel.book'), data: visible.map((p) => p.portfolio) },
    {
      id: 'benchmark',
      label: t('wealth.kpi.benchmark'),
      data: visible.map((p) => p.benchmark),
      dash: 'dashed',
    },
  ];

  return (
    <Panel
      title={title}
      subtitle={t('wealth.panel.performanceHint', {
        base: t.formatNumber(visible[0]?.portfolio ?? GROWTH_BASE, { maximumFractionDigits: 0 }),
        months: windowReturn.months,
      })}
      actions={
        <md-segmented-button-set ref={pickerRef} aria-label={title}>
          {PERIODS.map((period) => (
            <md-segmented-button
              key={period}
              value={String(period)}
              // `label`, never slotted text: slotted label content is read once
              // before the first render, so a translated string arriving later
              // would never make it into the segment.
              label={t('wealth.unit.months', { value: period })}
              selected={period === months}
            />
          ))}
        </md-segmented-button-set>
      }
    >
      {/* The chart carries no `label` of its own — the panel above already says
          it, and two headings for one figure is worse than one. `summary`
          replaces the generated English aria-label so the figure is still
          named, in the reader's language. */}
      <LineChart
        series={series}
        xAxis={{ data: visible.map((p) => t.formatDate(p.date, 'monthYear')), scale: 'category' }}
        yAxis={{ label: title, min: GROWTH_FLOOR }}
        valueFormatter={index}
        locale={state.locale}
        curve="monotone"
        legend="top-end"
        axis-ticks
        height={CHART_MD}
        summary={t('chart.summary.line', { label: title, count: 2 })}
      />

      <md-divider />

      {/* The numbers the curve is being read for, and the reason the picker is
          not decoration: all three come from `returnWindow()` for the selected
          window. */}
      <dl className="dl">
        <Fact label={t('wealth.unit.months', { value: windowReturn.months })}>
          <Signed value={windowReturn.portfolio} kind="percent" />
        </Fact>
        <Fact label={t('wealth.kpi.benchmark')}>
          <Percent value={windowReturn.benchmark} />
        </Fact>
        <Fact label={t('wealth.kpi.excessReturn')}>
          <Signed value={windowReturn.excess} kind="percent" />
        </Fact>
      </dl>
    </Panel>
  );
}

/* ---------------------------------------------------------------- donut */

/**
 * `md-pie-chart`, wired by hand.
 *
 * The shared chart wrappers assign `series`; this component reads `data`, which
 * is the one place the five charts disagree. `useElementProps` is the same
 * primitive `elements.tsx` builds them from, so nothing is being worked around
 * — only a different prop name is being honoured.
 */
function Donut({
  data,
  colors,
  locale,
  centre,
  ...attributes
}: {
  data: { label: string; value: number; color?: string }[];
  colors: string[] | null;
  locale: string;
  centre: ReactNode;
  [attribute: string]: unknown;
}) {
  const t = useT();
  const painted = colors ? data.map((d, i) => ({ ...d, color: colors[i] })) : data;

  const money = useMemo(
    () => (value: number) => t.formatCurrency(value, { notation: 'compact' }),
    [t],
  );

  const ref = useElementProps<HTMLElement>(
    {
      data: painted,
      valueFormatter: money,
      tableLabels: {
        category: t('wealth.table.assetClass'),
        value: t('wealth.table.marketValue'),
        share: t('wealth.table.weight'),
      },
    },
    [JSON.stringify(painted), locale],
  );

  return (
    <md-pie-chart
      ref={ref}
      locale={locale}
      label-plot={t('wealth.chart.plotHint')}
      {...attributes}
    >
      <div slot="center">{centre}</div>
    </md-pie-chart>
  );
}

function AllocationPanel() {
  const t = useT();
  const { state } = useShowcase();
  const totals = getBookTotals();
  const rows = getBookAllocation();

  /*
   * The palette is the kit's, looked up PER ROW rather than taken as
   * `ASSET_CLASS_PALETTE` positionally: the array is ordered by
   * `ASSET_CLASS_ORDER` and so is the allocation today, but a lookup by class
   * cannot drift if either ever changes, and equity must be the same violet in
   * the ring, the chip and the meter or the three stop being readable together.
   */
  /*
   * Token REFERENCES go straight to the chart now. `resolveSeriesColor` in the
   * library resolves `var()` / `color-mix()` against the chart host — the same
   * path axis bands always took — and because the chart re-resolves on its own
   * `watchMdChartTheme` tick, a theme or accent flip repaints with the new
   * token values without this screen listening for anything. The ~50-line
   * probe hook that used to do this out here is gone with the defect.
   */
  const colors = rows.map((row) => assetClassColor[row.assetClass]);

  return (
    <Panel title={t('wealth.panel.allocation')} subtitle={t('wealth.panel.allocationHint')}>
      {/* `inner-radius` first, then the centre slot: content in the middle of a
          SOLID pie sits on top of the slices. The centre overlay is
          `aria-hidden`, which is fine here because the same figure is the first
          KPI tile on the screen.

          `show-labels="false"` because a legend is already naming the slices,
          and the label the chart would draw inside them is a nine-digit euro
          amount that does not fit in a 4% wedge. */}
      <Donut
        data={rows.map((row) => ({ label: t(row.assetClassKey), value: row.marketValue }))}
        colors={colors}
        locale={state.locale}
        centre={
          <>
            <strong>
              <Money value={totals.aum} compact />
            </strong>
            <br />
            {t('wealth.kpi.aum.short')}
          </>
        }
        inner-radius="62%"
        padding-angle="1"
        show-labels={false}
        legend="bottom"
        // Taller than the line chart beside it: a ring plus a five-item legend
        // needs the height the curve does not, and `.grid-wide` stretches both
        // cards to the taller one anyway — so the choice is between filling
        // that height with chart or with empty card.
        height={CHART_LG}
      />
    </Panel>
  );
}

/* ----------------------------------------------------------- drift  panel */

/**
 * One asset class, target against actual, with the drift as a meter.
 *
 * `md-card`, not a `<div>` with a border. The old `.alloc-row` rule hand-rolled
 * an outlined card — 1px outline-variant, medium corner, surface-container-low
 * — which is exactly what `variant="outlined"` already is, only without the
 * component's density scale, its RTL-safe logical padding, or its state layer.
 * The class now carries nothing but the internal stack.
 */
function AllocationRowBlock({ row }: { row: AllocationRow }) {
  const t = useT();
  return (
    <md-card variant="outlined" full-width class="alloc-row">
      <div className="alloc-row__head">
        <h3 className="alloc-row__name">{t(row.assetClassKey)}</h3>
        <AllocationChip status={row.status} />
      </div>

      {/* `md-meter`, not `md-progress-indicator`: this is a STATE (how far from
          target), not an activity. The bar carries the distance and the colour
          carries the band, while the signed text beside the label carries the
          direction — colour is never the only signal. */}
      <DriftMeter drift={row.drift} />

      <div className="alloc-row__figures">
        <span>
          {t('wealth.table.target')} <Percent value={row.targetWeight} digits={1} />
        </span>
        <span>
          {t('wealth.table.actual')} <Percent value={row.actualWeight} digits={1} />
        </span>
        <span>
          {t('wealth.table.rebalance')} <Signed value={row.rebalanceAmount} compact />
        </span>
      </div>
    </md-card>
  );
}

function DriftPanel() {
  const t = useT();
  const rows = getBookAllocation();

  return (
    // No subtitle: the donut panel beside it already carries "target against
    // actual, by asset class", and saying it twice on one screen is noise.
    <Panel title={t('wealth.table.drift')}>
      <div className="stack">
        {rows.map((row) => (
          <AllocationRowBlock key={row.assetClass} row={row} />
        ))}
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------- rebalance  panel */

/** One mandate that has drifted, with the household's initials beside it. */
function DriftedRow({ entry }: { entry: DriftedMandate }) {
  const t = useT();
  const { household, worst } = entry;

  return (
    <md-card variant="outlined" full-width class="alloc-row">
      <div className="alloc-row__head">
        <span className="with-dot">
          {/* `label` names it for assistive tech; `name` only supplies the
              initials. A household is not a control and opens nothing, so the
              avatar is presentational beside the link that does. */}
          <md-avatar name={household.name} label={household.name} size="small" />
          <Drill href={route.household(household.id)}>{household.name}</Drill>
        </span>
        <AllocationChip status={worst.status} />
      </div>

      <div className="alloc-row__figures">
        <span>
          {t(worst.assetClassKey)} <Signed value={worst.drift} kind="percent" />
        </span>
        <span>
          {t('wealth.kpi.driftBreaches')} <Num value={entry.breachCount} />
        </span>
        <span>
          {t('wealth.allocationStatus.drifted')} <Num value={entry.driftedCount} />
        </span>
      </div>
    </md-card>
  );
}

function RebalancePanel() {
  const t = useT();
  /*
   * EVERY DRIFTED MANDATE, not the first five.
   *
   * This panel used to cap at ATTENTION_ROWS and print "2 more" underneath —
   * which spent a row telling the reader something was hidden while leaving
   * enough empty space beneath to have shown it. Seven is the whole set here,
   * and a rebalancing queue is exactly the list you want in full: "2 more"
   * gives no name, no drift and nothing to act on.
   */
  const drifted = driftedMandates();

  return (
    <Panel
      title={t('wealth.panel.rebalance')}
      subtitle={t('wealth.panel.rebalanceHint')}
      actions={<Count value={drifted.length} color="warning" />}
    >
      {drifted.length === 0 ? (
        // No `hint`: this is a fact about the book, not a filter result, and
        // telling the reader to widen a filter they never set would be nonsense.
        <div className="empty">
          <p>{t('wealth.empty.rebalance')}</p>
        </div>
      ) : (
        <div className="stack">
          {drifted.map((entry) => (
            <DriftedRow key={entry.household.id} entry={entry} />
          ))}
        </div>
      )}
    </Panel>
  );
}

/* -------------------------------------------------------- activity  panel */

function ActivityPanel() {
  const t = useT();
  const router = useRouter();
  const listRef = useRef<HTMLElement | null>(null);

  /*
   * A custom element's `href` is the BROWSER's link, not the router's.
   *
   * `md-list-item type="link"` renders a real anchor inside its shadow root,
   * which is right — it gives the row a URL to copy and a ⌘-click that opens a
   * tab. But nothing in a shadow root reaches React's synthetic click system,
   * so a plain click walked the whole document out of the SPA. The rail and the
   * breadcrumbs each carry the same interception for the same reason; this
   * finds the row through `composedPath()`, which is the only way across a
   * shadow boundary, and defers to the browser for every non-plain click.
   */
  useDomEvent(listRef, 'click', (event) => {
    if (!isPlainActivation(event)) return;
    const item = event
      .composedPath()
      .find(
        (node): node is HTMLElement =>
          node instanceof HTMLElement && node.tagName === 'MD-LIST-ITEM',
      );
    const href = item?.getAttribute('href');
    if (!href) return;
    event.preventDefault();
    router.push(href.replace(withBase(''), '') || '/');
  });

  const rows = getActivity({ limit: ACTIVITY_ROWS });

  /*
   * NO PANEL HEAD. The title, the "newest first" hint and the expand control
   * all moved into the list's own disclosure row, so a titled `panel__head`
   * above it would have said the same thing twice with the affordance split
   * across both. `Panel`'s `title` is optional precisely for this.
   *
   * The caret is the component's, not ours. An `expandable` row renders its own
   * trailing `md-icon-button` carrying `aria-expanded` and `aria-controls`,
   * gets the icon-button shape morph while expanded, and rotates its glyph —
   * which is the persistent "this is open" state the hand-rolled toggle in the
   * panel head never had, because a `standard` icon button has no container
   * until you interact with it.
   */
  return (
    <Panel>
      {rows.length === 0 ? (
        <div className="empty">
          <p>{t('wealth.empty.activity')}</p>
        </div>
      ) : (
        /*
         * `md-list`, not a hand-rolled `<ul>`. The household screen's own
         * activity panel (HouseholdTabs.tsx) already renders this same feed as
         * a list, and two views of one entity should not disagree about what
         * an activity row looks like.
         *
         * `type="link"` rather than an anchor inside a cell: the household was
         * the only destination the row had, so the whole row carries it, and
         * the row gets the ripple, focus ring and roving focus that a bare
         * `<li>` had none of.
         */
        <md-list ref={listRef} label={t('wealth.panel.activity')} density="-2">
          <md-list-item
            expandable
            expanded
            leading-icon="history"
            headline={t('wealth.panel.activity')}
            // The count is the point of a disclosure header: it tells you what
            // is behind the caret before you open it.
            supporting-text={`${t('wealth.common.entries', { count: rows.length })} · ${t(
              'wealth.panel.activityHint',
            )}`}
          >
            {rows.map((entry, index) => (
              <Fragment key={entry.id}>
                {/* Hairlines are interleaved `md-divider`s — `md-list` has no
                    `dividers` prop, and the list hides them from assistive tech
                    itself, because a `list` role may not own a separator.
                    Everything in here is slotted: `expanded-content` takes a
                    FLAT run of rows, never a nested `md-list` chassis. */}
                {index > 0 ? <md-divider slot="expanded-content" inset /> : null}
                <md-list-item
                  slot="expanded-content"
                  type="link"
                  // Base-prefixed, because this one IS the browser's URL: the
                  // handler above strips the base back off before routing.
                  href={withBase(route.household(entry.householdId))}
                  leading-icon="history"
                  // One line, and the household is IN it. Three lines each — an
                  // overline, a headline and a supporting line — spent a third
                  // of the panel's height per entry and left the right half of
                  // every row empty. The log reads as a sentence, so it is
                  // written as one, and the date and actor sit in the trailing
                  // metadata where the eye can scan a column of them.
                  headline={`${t(entry.actionKey)} · ${entry.householdName}`}
                  lines="1"
                >
                  <span slot="trailing-supporting-text">
                    <DateText value={entry.date} style="short" /> · {entry.actorName}
                  </span>
                </md-list-item>
              </Fragment>
            ))}
          </md-list-item>
        </md-list>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------ quick actions */

/**
 * The compact-width primary action: one FAB that fans out into three.
 *
 * WHY IT IS COMPACT-ONLY. `md-fab-menu`'s manual is explicit — do not pair a
 * FAB menu with a toolbar or a navigation rail, and M3 says the same. Above
 * 900px this app HAS a rail, and that rail already carries the one FAB M3 allows
 * there. Below 900px `app.css` takes the rail out of the DOM entirely and docks
 * `md-navigation-bar` instead, which is the surface a FAB is specified to sit
 * beside. So the menu appears exactly where it is legal, and the screen never
 * shows two prominent actions at once.
 *
 * The FAB is icon-only, so it carries its own `aria-label`; the popup is named
 * separately by `menu-label`, which is the only thing naming the `role="menu"`.
 * The menu wires itself to the FAB by `id` and manages `aria-expanded`,
 * `aria-haspopup` and the icon morph — none of which are set here.
 *
 * Positioning is logical (`inset-inline-end`, `inset-block-end`) so the cluster
 * lands in the correct corner under `dir="rtl"`, and it clears both the docked
 * navigation bar and `<awc-showcase-dock>`, whose measured height the kit
 * publishes as `--awc-dock-height`.
 */
const FAB_ID = 'wealth-overview-quick-actions';

const QUICK_ACTIONS: readonly { icon: string; labelKey: string; path: string }[] = [
  { icon: 'description', labelKey: 'wealth.action.newProposal', path: route.proposals() },
  { icon: 'swap_horiz', labelKey: 'wealth.action.newOrder', path: route.trade() },
  { icon: 'flag', labelKey: 'wealth.action.newGoal', path: route.planning() },
];

/**
 * The breakpoint gate, split from the cluster on purpose.
 *
 * `useCustomEvent` attaches its listener in an effect that runs ONCE, so the
 * element it is given has to exist by then. Had the gate been an early `return
 * null` inside the cluster, the effect would have run at desktop width against
 * a null ref and never run again — the FAB would open its menu (the component
 * wires that itself) and every item would then do nothing. Mounting the cluster
 * only when it is wanted makes the ref live whenever the effect runs.
 */
function QuickActions() {
  const compact = useMediaQuery('(max-width: 899px)');
  return compact ? <QuickActionsMenu /> : null;
}

function QuickActionsMenu() {
  const t = useT();
  const router = useRouter();
  const menuRef = useRef<HTMLElement | null>(null);

  /*
   * `mdClick` from an item carries NO detail — the pressed row is
   * `event.target` even from a listener on the menu, because the event bubbles
   * and is composed. The route rides on a data attribute rather than a prop:
   * `md-fab-menu-item` has no `value`, and `dataset` reads it back without
   * coupling to the component.
   *
   * The menu closes itself and returns focus to the FAB; calling `close()` from
   * here is the documented anti-pattern. And `router.push` takes an UNPREFIXED
   * path and adds the mount itself, so these stay client-side.
   */
  useCustomEvent<CustomEvent<void>>(menuRef, 'mdClick', (event) => {
    const item = event.target as HTMLElement | null;
    const path = item?.dataset?.path;
    if (path) router.push(path);
  });

  return (
    <>
      <md-fab
        id={FAB_ID}
        icon="add"
        aria-label={t('wealth.nav.toolbar')}
        style={{
          position: 'fixed',
          insetInlineEnd: 'var(--md-sys-spacing-inset-lg, 16px)',
          insetBlockEnd:
            'calc(var(--awc-dock-height, 0px) + 80px + var(--md-sys-spacing-inset-lg, 16px))',
          zIndex: 'var(--md-sys-z-index-navigation, 200)',
        }}
      />
      <md-fab-menu
        ref={menuRef}
        anchor={FAB_ID}
        placement="up"
        menu-label={t('wealth.nav.toolbar')}
      >
        {QUICK_ACTIONS.map((action) => (
          <md-fab-menu-item
            key={action.labelKey}
            icon={action.icon}
            label={t(action.labelKey)}
            data-path={action.path}
          />
        ))}
      </md-fab-menu>
    </>
  );
}

/* ---------------------------------------------------------------- skeleton */

/**
 * The screen's layout with nothing in it yet.
 *
 * Every wrapper here is the SAME element and the same class as the real body —
 * `.kpi-grid`, `.grid-wide`, `.grid-3` — so the swap moves nothing on the page.
 * That is the whole point of a skeleton over a spinner (§5.5, §7.2).
 *
 * Exactly ONE of these announces. `md-skeleton` is a polite live region by
 * default, and fourteen of them saying "loading" is fourteen announcements for
 * one event.
 */
function OverviewSkeleton() {
  return (
    <>
      <section className="kpi-grid">
        <KpiSkeleton announce />
        <KpiSkeleton />
        <KpiSkeleton />
        <KpiSkeleton />
      </section>

      <section className="grid-wide">
        <PanelSkeleton height={CHART_MD} />
        <PanelSkeleton height={CHART_LG} />
      </section>

      <section className="grid-2">
        <PanelSkeleton lines={10} />
        <PanelSkeleton lines={10} />
      </section>

      <div className="table-host">
        <md-card variant="outlined" class="panel" full-width>
          <div className="panel__inner">
            <div className="panel__head">
              <div className="skel" style={{ inlineSize: '120px', blockSize: '16px' }} />
              <div className="skel" style={{ inlineSize: '220px', blockSize: '16px' }} />
            </div>
            <div className="skel" style={{ inlineSize: '100%', blockSize: '320px' }} />
          </div>
        </md-card>
      </div>

      <PanelSkeleton lines={8} />
    </>
  );
}
