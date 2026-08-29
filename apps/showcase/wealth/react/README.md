# Kestrel Private Bank — Wealth Management Console (React, single-page application)

The **client-routed SPA** build of the `wealth` showcase vertical: Vite,
React 18, and a router written in this repo. One HTML document, one JavaScript
entry, routes resolved in the browser. No meta-framework, no server rendering.

```bash
pnpm --filter @awc-ui/showcase-wealth-react dev     # vite, http://localhost:4337/showcase/wealth/react/
pnpm --filter @awc-ui/showcase-wealth-react build   # -> dist/
pnpm --filter @awc-ui/showcase-wealth-react lint    # tsc --noEmit
```

`dev` and `build` run `sync-runtime` first, which needs `packages/core/dist`
(`pnpm --filter @awc-ui/core build`), and the app imports the kit's compiled
`dist` (`pnpm --filter @awc-ui/showcase-kit build`).

## Screens

| Route | Screen | Status |
|---|---|---|
| `/` | Book overview — the advisor's households, book performance, allocation, attention items | shell + KPIs, body pending |
| `/holdings/` | Every position across the book, plus the instrument universe | shell + KPIs, body pending |
| `/households/[id]` | One household: members, mandate, allocation drift, holdings, objectives, activity | shell + KPIs, body pending |
| `/proposals/` | Advice documents moving through a five-step review | shell + KPIs, body pending |
| `/trade/` | The blotter and the order ticket | shell + KPIs, body pending |
| `/planning/` | Client objectives and whether they land | shell + KPIs, body pending |

Six route patterns, one of them parameterised. The shapes come from
`@awc-ui/showcase-kit/wealth`, so a link written once cannot drift between
ports.

---

# The contract

Everything below is what a screen may rely on. It is stable; if something you
need is missing, add it **to the kit**, not to a component.

## Rule zero: nothing that is not a view lives in the app

Every number, date, label, derived series, status colour and column layout comes
from `@awc-ui/showcase-kit/wealth`. If you find yourself writing arithmetic or a
dictionary lookup in a `.tsx` file, it belongs in
`packages/showcase-kit/src/wealth/derive.ts`.

Three conventions the fixture guarantees, and the screens depend on all three:

1. **Every ratio is a FRACTION.** `0.0135` is 1.35%. Pass it straight to
   `<Percent>` — never multiply by 100 first.
2. **Every date is an ISO calendar date**, `YYYY-MM-DD`. Format through
   `<DateText>`, which is pinned to UTC. `Activity.timestamp` and
   `Order.createdAt` additionally carry a full UTC instant.
3. **Every enum-ish value carries a `…Key` twin.** Render `t(household.strategyKey)`,
   never `household.strategy`. The raw value is for logic and for the status maps.

There is no clock and no randomness anywhere. `Date.now()` and `Math.random()`
must not appear in this app.

## Selectors — `@awc-ui/showcase-kit/wealth`

List selectors return a **fresh array** (safe to sort in place); the records
inside are shared and **read-only**. Single-record selectors return `undefined`
for an unknown id — always guard, because ids arrive from the URL.

```ts
// constants
REPORTING_DATE: '2026-06-30'   REPORTING_QUARTER: '2026-Q2'
BASE_CURRENCY: 'EUR'           HISTORY_MONTHS: 24   PRICE_HISTORY_MONTHS: 12

// the book
getBookTotals(): BookTotals
getAdvisor(): Advisor                       // the signed-in one
getAdvisors(): Advisor[]                    getAdvisorById(id): Advisor | undefined
getFxRates(): Record<Currency, number>      toEur(amount, currency): number
getFixture(): WealthFixture                 // the escape hatch; prefer the rest

// households and clients
getHouseholds(filter?: HouseholdFilter): Household[]   // default: largest AUM first
getHouseholdById(id): Household | undefined
getClients(filter?: ClientFilter): Client[]            // primary member first
getClientsFor(householdId): Client[]                   getClientById(id): Client | undefined

// mandates and holdings
getPortfolios(): Portfolio[]                getPortfolioById(id): Portfolio | undefined
getPortfolioFor(householdId): Portfolio | undefined     // one per household
getPositions(filter?: PositionFilter): Position[]       // default: largest EUR value first
getPositionsFor(portfolioId): Position[]                getPositionById(id): Position | undefined
getInstruments(filter?: InstrumentFilter): Instrument[]
getInstrumentById(id): Instrument | undefined           getInstrumentByTicker(t): Instrument | undefined

// allocation and performance
getAllocation(portfolioId?): AllocationRow[]   // omit the id for the book
getAllocationFor(householdId): AllocationRow[]  getBookAllocation(): AllocationRow[]
getPerformanceSeries(scope?: { portfolioId?, householdId? }): PerformancePoint[]
                                                // omit the scope for the book

// planning, advice, trading, audit
getGoals(filter?: GoalFilter): Goal[]        getGoalsFor(householdId): Goal[]
getGoalById(id): Goal | undefined
getProposals(filter?: ProposalFilter): Proposal[]   // attention-first order
getProposalsFor(householdId): Proposal[]     getProposalById(id): Proposal | undefined
getOrders(filter?: OrderFilter): Order[]     // newest first
getWorkingOrders(): Order[]                  getOrderById(id): Order | undefined
getActivity(filter?: ActivityFilter): Activity[]     // newest first
getActivityFor(householdId, limit?): Activity[]
```

Every `*Filter` type is exported and documents its own defaults. Filter through
the selector — never `.filter()` the result, or two ports will disagree about
what "in profit" means.

## Derived series — the same module

```ts
compound(returns: number[]): number          // COMPOUNDED, never summed
tail(points, months)
returnWindow(points, months): ReturnWindow   // { months, portfolio, benchmark, excess }
returnWindows(scope?): ReturnWindow[]        // 3, 6 (YTD), 12, 24 — in that order
growthOf100(scope?, base?): GrowthPoint[]    // { date, quarter, portfolio, benchmark }

assetClassTotals(positions): ClassTotal[]    // in ASSET_CLASS_ORDER; never includes cash
regionTotals(positions): RegionTotal[]       currencyExposure(positions): CurrencyExposure[]
topMovers(positions, limit?): Mover[]        // largest ABSOLUTE move first
bookHoldings(limit?): BookHolding[]          // one instrument across every mandate

rebalanceSheet(portfolioId): RebalanceRow[]  // worst drift first, with a trade side
driftedMandates(): DriftedMandate[]
goalProjection(goal, maxPoints?): GoalProjectionPoint[]   // ends exactly at goal.projectedAmount
goalSummary(goals?): GoalSummary
orderEstimate({ instrumentId, quantity, side, limitPrice?, portfolioId? }): OrderEstimate | null
concentration(): Concentration
```

`orderEstimate` is the live one: it snaps the quantity to the instrument's lot
size, does the FX, reports the weight impact and says whether a buy exceeds the
mandate's cash. Call it from the ticket's change handler; do **not** recompute
any part of it inline.

## Status maps — domain value → component vocabulary

Never write `status === 'breach' ? 'error' : …`. Every mapping is already here:

```ts
kycColor / kycDot            riskProfileColor      riskToleranceColor
strategyColor                mandateColor          segmentColor
allocationColor / allocationDot                    driftColor(drift): MdColor
goalColor / goalDot          priorityColor         proposalColor
stepState                    // ProposalStep.state → md-step's own four values
orderColor / orderDot        orderSideColor        // deliberately NOT green/red
plColor(value, deadBand?)    plIcon(value, deadBand?)
assetClassColor              ASSET_CLASS_ORDER     ASSET_CLASS_PALETTE
```

`ASSET_CLASS_PALETTE` is an array of `var(--md-sys-color-*)` references, in
`ASSET_CLASS_ORDER`. Feed it to a chart's colours so the donut slice, the bar
segment and the chip agree. Never inline a hex.

## Column layouts — `TABLES`

```ts
TABLES.households(showAdvisor: boolean)   TABLES.positions(showHousehold: boolean)
TABLES.goals(showHousehold: boolean)      TABLES.instruments   TABLES.clients
TABLES.allocation                         TABLES.proposals     TABLES.orders
TABLES.activity
```

Each is `{ columns, minWidth }` — the `column-template` and `min-width` props of
`md-table`. **`md-table-container` WRAPS `md-table`**; the toolbar goes in the
container's `top` slot and the pagination in its `bottom` slot, never inside the
table (§7.1).

## Routes

```ts
route.overview()  route.holdings()  route.household(id)
route.proposals() route.trade()     route.planning()

withBase(path)          // for a raw href on an md-* element
DESTINATIONS            // the five top-level destinations — the shell owns these
destinationFor(path)    destinationIndex(path)    crumbsFor(path, household?)
```

`route.*` values are **unprefixed**. `<Link>` and `useRouter().push()` prefix
them; a raw `href=` on a custom element needs `withBase()`.

Screens call `crumbsFor(usePathname())` and hand the result to `<Screen crumbs>`.
A trail of one is dropped by the shell, so `/holdings/` and `/` both behave.

## Shell — `components/Shell.tsx`

```tsx
<Screen
  title={string}
  subtitle={string}          // optional
  crumbs={CrumbSpec[]}       // optional; from crumbsFor()
  aside={ReactNode}          // chips beside the heading
  actions={ReactNode}        // md-button / md-icon-button, inside an md-toolbar
>
  …the screen…
</Screen>

<Panel title? subtitle? actions? variant?>…</Panel>
<EmptyState message hint? />
```

`Screen` renders the app bar, the rail, the bar, the trail, the heading, the
toolbar and the dock. **Do not render navigation yourself.** The five
destinations, the FAB and the active indicator all live in `Shell.tsx`, and a
second navigation surface would give the page two current destinations.

`actions` lands inside an `md-toolbar`, which is ONE tab stop with arrow-key
movement between the controls. `md-button` and `md-icon-button` join that roving
group; `md-text-field` and `md-select` keep their own tab stop. Emphasise at most
one — the rail's FAB is already the screen's loudest control.

## Formatting and display — `components/bits.tsx`

```tsx
<Money value currency? compact? digits? />       // a balance
<Signed value kind?='money'|'percent' … />       // P/L, drift, excess return
<Percent value digits?=2 sign? />                // takes a FRACTION
<Num value digits?=0 />                          <Count value color? />
<DateText value style? />                        <TimestampText value />
<Fact label>…</Fact>                             <Drill href>…</Drill>
<NameCell dot>…</NameCell>
<KpiTile label value hint? trend? trendLabels? formatTrend? color? trailing? />
```

Chips (all take the domain value, resolve colour and label from the kit):

```
StrategyChip  MandateChip  SegmentChip  RiskProfileChip  RiskToleranceChip
KycChip  ClientRoleChip  AssetClassChip  InstrumentTypeChip  AllocationChip
GoalStatusChip  PriorityChip  ProposalStatusChip  ProposalTypeChip
OrderStatusChip  OrderSideChip  ActivityCategoryChip
```

Dots: `KycDot` `AllocationDot` `GoalDot` `OrderDot` — every one carries a label,
because colour alone is not an accessible carrier of state.

Meters: `RatioMeter` `FundedMeter` `DriftMeter`.

**Never** call `Intl`, `toFixed`, or `toLocaleString` in a screen. **Never**
hardcode a chip `color`. **Never** put a bare `md-badge` anywhere but on a host
inside a `.badge-anchor` wrapper — it anchors absolutely and gets clipped.

## Custom elements — `components/elements.tsx`

Charts must go through the wrappers: `<BarChart>` `<LineChart>` `<AreaChart>`
`<PieChart>` `<Sparkline>`. Their `series` / `data` / `valueFormatter` props have
no attribute form, so emitting `md-line-chart` yourself renders an empty plot.

`useElementProps(props, deps)` assigns object props to any other element.
`useCustomEvent(ref, 'mdSortChange', fn)` attaches an `md*` listener.
`useDomEvent(ref, 'click', fn, capture?)` is for the native event.

Every `md-*` tag a screen uses must appear in `src/types/custom-elements.d.ts`,
and must appear in §6 of `main-llm.md` — if it is not in §6 it does not exist.
**Read the component's `readme.md` before writing its markup.**

## The three composition rules that bite

- **No component inside a native `<button>` or `<a>`.** Use the component's own
  `href` / `type` props. `<Drill>` is a real `<a>` and is the only anchor a
  screen should write.
- **No dialog opened from inside a dialog.** A multi-step flow is `md-stepper`
  inside ONE `md-dialog` — that is exactly what the proposals screen needs.
- **`md-tabs` is not app navigation.** It switches sibling views of the same
  data inside one screen (holdings ↔ instruments is legitimate). Destinations
  are the rail and the bar, and the shell already owns them.

---

## Decisions worth knowing

**Five destinations, six routes.** `/households/<id>/` is a drill, not a
destination: there is no `/households/` index to link to, and
`md-navigation-bar` is specified for 3–5 items. The rail (3–7) and the bar
render the same array from the kit, so the two navigation surfaces cannot
disagree about what the app contains. On a household screen the rail marks
**Overview**, because the book of households is the overview.

**Only one navigation surface exists at a time.** `app.css` shows the rail above
900px and the bar below it with `display: none`, not `visibility` — a hidden
surface is out of the accessibility tree too, so a screen reader never finds two
"Main navigation" landmarks claiming different current destinations.

**The rail's destinations carry real `href`s.** That makes ⌘-click and "copy
link address" work, and it makes the rail drop its `tablist` role, because a
link cannot be an ARIA `tab`. Documented behaviour, and the right trade — these
are links. Routing is driven from the native `click` rather than `mdTabChange`,
because the anchor is what navigates and because `mdTabChange` does not fire when
you re-activate the destination you are already on.

**The navigation bar's click is vetoed in the CAPTURE phase.** `md-navigation-tab`
reads `event.defaultPrevented` *before* it acts, and with `href` set it navigates
by `window.location.assign()` — a full page load of an SPA. A bubbling listener
would run after that was already decided.

**The dock is given an explicit `label`.** It falls back to `t('app.title')`,
which belongs to the credit-risk vertical, so an unlabelled dock here announces
itself as "Credit Risk Console".

**The components are not bundled.** Stencil's lazy runtime resolves its own
chunks by URL relative to itself, so it is served from `public/awc-runtime/` by a
classic script in `index.html`. `scripts/sync-runtime.mjs` has the full
post-mortem.
