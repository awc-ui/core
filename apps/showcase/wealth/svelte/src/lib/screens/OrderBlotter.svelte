<!--
  The blotter: every order the book has raised, filtered and paged.

  FILTERING GOES THROUGH THE SELECTOR, NEVER THROUGH `.filter()` HERE.
  `getOrders()` already knows what "working" means (`submitted` plus
  `partially-filled`) and what a search matches (ticker, security name,
  household, id). Re-deciding either in this file is how two ports end up
  disagreeing about which rows a filter keeps. Paging is the one thing this
  component does own — `md-table-pagination` renders the readout and the
  controls and emits a REQUEST, exactly like a sort header, and taking the
  slice is ours.

  THERE ARE NO SORT HEADERS, and that is deliberate rather than unfinished.
  `OrderFilter` carries no `sortBy` / `sortDir`; the fixture stores orders
  newest first and the selector preserves that. A comparator here would be a
  second ordering the kit knows nothing about, so the headers stay plain and
  the missing filter fields are reported upward instead.

  §7.1's table rule: `md-table-container` WRAPS `md-table`, with the toolbar in
  its `top` slot and the pagination in its `bottom` slot. Neither goes inside
  the table, where they would become children of a grid whose columns belong to
  the rows.

  WHERE THE REACT BUILD HAS A SEPARATE `BlotterTable`, THIS FILE HAS THE TABLE
  INLINE, for two Svelte-specific reasons. First, the React split existed
  because `useCustomEvent` binds in an effect keyed on a ref object that does
  not change when the element behind it is replaced — a table re-rendered after
  the empty state came back with a dead pagination listener. Svelte's `on:`
  attaches when the `{#if}` branch creates the element, so nothing strands.
  Second, the facet row must carry a DOM `slot="top"` attribute INTO
  `md-table-container`'s top band while its state stays with the filters — and
  Svelte reserves the `slot` attribute on anything passed through a component
  boundary, so the row can only keep both (its band and its delegated handler
  in this scope) if the container is in this scope too. The DOM that results is
  the same as the React build's, element for element.
-->
<script lang="ts" context="module">
  import type { OrderSide, OrderStatus } from '@awc-ui/showcase-kit/wealth';

  const SIDES: OrderSide[] = ['buy', 'sell'];

  const STATUSES: OrderStatus[] = [
    'draft',
    'staged',
    'submitted',
    'partially-filled',
    'filled',
    'cancelled',
    'rejected',
  ];

  /**
   * The blotter's facets, as data — one list read by the chip row, the
   * delegated handler, the "any filter on" test and the clear action.
   *
   * NONE of them duplicates the two selects beside them. Side and Status are
   * already single-choice controls, so a chip on either axis would be a second
   * control fighting the first, and picking one of each would strand the reader
   * on a guaranteed-empty table. These three are the axes the selects do NOT
   * cover: lifecycle (working), ownership (mine), provenance (raised under
   * advice rather than as an ad-hoc ticket). Over the 14-order fixture they
   * split it 5 / 8 / 8, so each is worth pressing.
   */
  const FACETS = [
    { id: 'working', labelKey: 'wealth.trade.workingOnly' },
    { id: 'mine', labelKey: 'wealth.trade.filter.mine' },
    { id: 'fromAdvice', labelKey: 'wealth.trade.filter.fromAdvice' },
  ] as const;

  type FacetId = (typeof FACETS)[number]['id'];
  type FacetState = Record<FacetId, boolean>;

  const NO_FACETS: FacetState = { working: false, mine: false, fromAdvice: false };
</script>

<script lang="ts">
  import {
    getAdvisor,
    getBookTotals,
    getOrders,
    TABLES,
    type Order,
  } from '@awc-ui/showcase-kit/wealth';
  import { route } from '$lib/routes';
  import { t } from '$lib/showcase';
  import Panel from '$lib/components/Panel.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import Drill from '$lib/components/Drill.svelte';
  import Chips from '$lib/bits/Chips.svelte';
  import DateText from '$lib/bits/DateText.svelte';
  import Highlight from '$lib/bits/Highlight.svelte';
  import Money from '$lib/bits/Money.svelte';
  import Num from '$lib/bits/Num.svelte';
  import { tx } from './trade-strings';

  const totals = getBookTotals();

  let search = '';
  let side: OrderSide | '' = '';
  let status: OrderStatus | '' = '';
  let facets: FacetState = NO_FACETS;
  let page = 0;
  let rowsPerPage = 10;

  let searchEl: HTMLElement | undefined;

  /*
   * The search field is UNCONTROLLED — no `value` attribute is rendered back
   * into it. A controlled text field rewrites the box on every keystroke, which
   * is how a caret ends up jumping to the end of a word being edited in the
   * middle. The consequence is that "clear filters" has to push the empty
   * string back into the element by hand; that is the whole reason `searchEl`
   * exists.
   */
  function onSearchInput(event: Event) {
    search = (event as CustomEvent<string>).detail ?? '';
    page = 0;
  }
  function onSearchClear() {
    search = '';
    page = 0;
  }

  function onSideChange(event: Event) {
    side = ((event as CustomEvent<string>).detail || '') as OrderSide | '';
    page = 0;
  }
  function onStatusChange(event: Event) {
    status = ((event as CustomEvent<string>).detail || '') as OrderStatus | '';
    page = 0;
  }

  /*
   * `mdSelect`, not a click handler.
   *
   * A filter chip toggles its own `selected` before it emits, and the event
   * carries the state it landed on — so the app never has to infer the new
   * value from the old one, and a press that did not activate the chip cannot
   * desynchronise the two.
   *
   * One listener for the whole set: `mdSelect` bubbles and is composed, so it
   * retargets to the `md-chip` host and its `data-facet` reads straight off
   * `event.target`.
   */
  function onFacetSelect(event: Event) {
    const chip = (event.target as HTMLElement | null)?.closest?.('md-chip') as HTMLElement | null;
    const id = chip?.dataset.facet as FacetId | undefined;
    if (!id) return;
    facets = {
      ...facets,
      [id]: Boolean((event as CustomEvent<{ selected: boolean }>).detail?.selected),
    };
    page = 0;
  }

  $: allRows = getOrders({
    // Every key is omitted when empty. `getOrders` treats a falsy value as
    // "not asked for" precisely so a screen can hand its state straight in
    // without deciding anything on the way.
    search: search || undefined,
    side: side || undefined,
    status: status || undefined,
    working: facets.working ? true : undefined,
    advisorId: facets.mine ? getAdvisor().id : undefined,
    fromProposal: facets.fromAdvice ? true : undefined,
  }) as Order[];

  // A filter change can leave the reader stranded past the last page.
  $: lastPage = Math.max(0, Math.ceil(allRows.length / rowsPerPage) - 1);
  $: safePage = Math.min(page, lastPage);

  $: rows = allRows.slice(safePage * rowsPerPage, safePage * rowsPerPage + rowsPerPage);

  $: filtered = Boolean(search || side || status) || FACETS.some((f) => facets[f.id]);

  function clearFilters() {
    search = '';
    side = '';
    status = '';
    facets = NO_FACETS;
    page = 0;
    // The custom elements own their own visual state. The two selects and the
    // chips are controlled and will follow, but the search box is not — Svelte
    // never wrote a `value` into it, so it has nothing to re-render.
    if (searchEl) (searchEl as unknown as { value: string }).value = '';
  }

  $: headers = [
    { key: 'id', label: $t('wealth.table.id') },
    { key: 'side', label: $t('wealth.table.side') },
    { key: 'ticker', label: $t('wealth.table.ticker') },
    { key: 'instrument', label: $t('wealth.table.instrument') },
    { key: 'household', label: $t('wealth.table.household') },
    { key: 'quantity', label: $t('wealth.table.quantity'), numeric: true },
    { key: 'filled', label: $t('wealth.table.filled'), numeric: true },
    { key: 'orderType', label: $t('wealth.table.orderType') },
    { key: 'limit', label: $t('wealth.table.limitPrice'), numeric: true },
    { key: 'tif', label: $t('wealth.table.timeInForce') },
    { key: 'value', label: $t('wealth.table.estimatedValue'), numeric: true },
    { key: 'status', label: $t('wealth.table.status') },
    { key: 'created', label: $t('wealth.table.created') },
  ] as { key: string; label: string; numeric?: boolean }[];

  function onPageChange(event: Event) {
    page = (event as CustomEvent<{ page: number }>).detail.page;
  }
  function onRowsPerPageChange(event: Event) {
    // No `page = 0` here: `md-table-pagination` has already reset the page and
    // emitted `mdPageChange`, which the handler above consumes. Resetting
    // again is that component's documented anti-pattern.
    rowsPerPage = (event as CustomEvent<{ rowsPerPage: number }>).detail.rowsPerPage;
  }
</script>

<Panel>
  <div class="stack">
    <div class="row trade-filters">
      <!--
        `md-text-field type="search"`, not `md-search`: `md-search` owns a
        results surface of its own, and this box filters a table that is
        already on screen (§5.2).
      -->
      <md-text-field
        bind:this={searchEl}
        variant="outlined"
        type="search"
        label={$tx('wealth.trade.searchOrders')}
        clearable="internal"
        on:mdInput={onSearchInput}
        on:mdClear={onSearchClear}
      ></md-text-field>

      <md-select
        variant="outlined"
        label={$t('wealth.table.side')}
        placeholder={$t('wealth.common.all')}
        value={side}
        clearable
        clear-label={$t('wealth.action.clearFilters')}
        on:mdChange={onSideChange}
      >
        {#each SIDES as value (value)}
          <md-select-option {value} label={$t(`wealth.orderSide.${value}`)}>
            {$t(`wealth.orderSide.${value}`)}
          </md-select-option>
        {/each}
      </md-select>

      <md-select
        variant="outlined"
        label={$t('wealth.table.status')}
        placeholder={$t('wealth.common.all')}
        value={status}
        clearable
        clear-label={$t('wealth.action.clearFilters')}
        on:mdChange={onStatusChange}
      >
        {#each STATUSES as value (value)}
          <md-select-option {value} label={$t(`wealth.orderStatus.${value}`)}>
            {$t(`wealth.orderStatus.${value}`)}
          </md-select-option>
        {/each}
      </md-select>

      <!--
        §7.2: an icon-only control and the tooltip that supplies the meaning its
        glyph lacks. The `aria-label` is still required — a tooltip is a
        description, never a name. It sits with the filters rather than in the
        table's toolbar so it survives the empty state, which is exactly when a
        reader wants it.

        `mdClick`, not a native `on:click`: `md-icon-button`'s soft-disabled
        path calls `preventDefault()` and returns — it does NOT stop
        propagation — so the native click would still reach a handler and
        "clear" filters that are already clear. `mdClick` is emitted only when
        the control is genuinely live, which leaves the guard with the
        component instead of duplicating it here where it could drift.
      -->
      <md-tooltip text={$t('wealth.action.clearFilters')}>
        <md-icon-button
          icon="filter_alt_off"
          aria-label={$t('wealth.action.clearFilters')}
          soft-disabled={!filtered || undefined}
          on:mdClick={clearFilters}
        ></md-icon-button>
      </md-tooltip>
    </div>

    {#if rows.length === 0}
      <EmptyState message={$t('wealth.empty.orders')} hint={filtered} />
    {:else}
      <div class="table-host">
        <md-table-container variant="outlined">
          <!--
            The toolbar goes in the CONTAINER's `top` slot, outside the table's
            scroll port, so it stays put while thirteen columns scroll under it.
          -->
          <md-table-toolbar
            slot="top"
            headline={$t('wealth.panel.blotter')}
            supporting-text={$t('wealth.common.showing', {
              shown: allRows.length,
              total: totals.orderCount,
            })}
          ></md-table-toolbar>

          <!--
            A SECOND `top` child, under the toolbar. The band is a flex column,
            so the chips stack beneath the headline and stay outside the scroll
            port with it — the sticky header sticks below them, so the two never
            meet. The row renders here, in the container's top band, while the
            state it drives stays above with every other filter.
          -->
          <div
            slot="top"
            class="row facet-row"
            role="group"
            aria-label={$tx('wealth.trade.filter.group')}
            on:mdSelect={onFacetSelect}
          >
            {#each FACETS as facet (facet.id)}
              <md-chip
                data-facet={facet.id}
                variant="filter"
                label={$tx(facet.labelKey)}
                selected={facets[facet.id]}
              ></md-chip>
            {/each}
          </div>

          <!--
            `keep-height="false"`: `md-table` ratchets its height by default so
            paging cannot make the page jump, but that baseline is measured once
            and never recomputed — a density change then strands the taller
            height as dead space. Pagination already holds the row count steady
            here, so live density switching is worth more than the ratchet.

            `row-offset`/`row-count`: without these, assistive tech announces
            "row 1 of 10" on every page instead of the row's position in the
            whole blotter. `row-count` takes the BODY total; the table adds the
            head and foot rows itself.
          -->
          <md-table
            label={$t('wealth.panel.blotter')}
            column-template={TABLES.orders.columns}
            min-width={TABLES.orders.minWidth}
            keep-height="false"
            striped
            row-offset={safePage * rowsPerPage}
            row-count={allRows.length}
          >
            <md-table-head>
              <md-table-row rowgroup="head">
                {#each headers as header (header.key)}
                  <md-table-cell head scope="col" numeric={header.numeric || undefined}>
                    {header.label}
                  </md-table-cell>
                {/each}
              </md-table-row>
            </md-table-head>

            <md-table-body>
              {#each rows as order (order.id)}
                <md-table-row value={order.id}>
                  <md-table-cell>
                    <!-- `search` is the live query, so the rows can mark what
                         it hit — the state, not the element's value: this is
                         the string the selector was given. `getOrders` matches
                         on ticker, instrument name, household name and id, so
                         those are the four cells that can be marked and no
                         others; marking a fifth would claim the query hit
                         something it never looked at. -->
                    <Highlight text={order.id} query={search} />
                  </md-table-cell>
                  <md-table-cell>
                    <Chips kind="orderSide" value={order.side} />
                  </md-table-cell>
                  <md-table-cell>
                    <Highlight text={order.ticker} query={search} />
                  </md-table-cell>
                  <md-table-cell>
                    <Highlight text={order.instrumentName} query={search} />
                  </md-table-cell>
                  <md-table-cell>
                    <Drill href={route.household(order.householdId)}>
                      <Highlight text={order.householdName} query={search} />
                    </Drill>
                  </md-table-cell>
                  <md-table-cell numeric>
                    <Num value={order.quantity} />
                  </md-table-cell>
                  <md-table-cell numeric>
                    <Num value={order.filledQuantity} />
                  </md-table-cell>
                  <md-table-cell>{$t(order.orderTypeKey)}</md-table-cell>
                  <md-table-cell numeric>
                    {#if order.limitPrice === null}
                      <span class="muted">{$t('wealth.common.na')}</span>
                    {:else}
                      <Money value={order.limitPrice} currency={order.currency} digits={2} />
                    {/if}
                  </md-table-cell>
                  <md-table-cell>{$t(order.timeInForceKey)}</md-table-cell>
                  <!--
                    THE CURRENCY TRAP. `estimatedValue` is in the security's own
                    currency and `estimatedValueEur` is the converted twin. This
                    column compares orders across the book, so the EUR figure
                    leads and the local one sits under it — the other way round
                    would quietly report a CHF ticket as if it were euros.
                  -->
                  <md-table-cell numeric>
                    <Money value={order.estimatedValueEur} compact />
                    {#if order.currency !== 'EUR'}
                      <br />
                      <span
                        class="muted num"
                        style="font: var(--md-sys-typescale-label-small-font)"
                      >
                        {$t.formatCurrency(order.estimatedValue, {
                          currency: order.currency,
                          notation: 'compact',
                        })}
                      </span>
                    {/if}
                  </md-table-cell>
                  <md-table-cell>
                    <Chips kind="orderStatus" value={order.status} />
                  </md-table-cell>
                  <md-table-cell>
                    <DateText value={order.createdDate} style="short" />
                  </md-table-cell>
                </md-table-row>
              {/each}
            </md-table-body>
          </md-table>

          <md-table-pagination
            slot="bottom"
            count={allRows.length}
            page={safePage}
            rows-per-page={rowsPerPage}
            rows-per-page-options="10,25,all"
            show-first-last
            label-rows-per-page={$t('wealth.table.rowsPerPage')}
            label-displayed-rows={$t('wealth.table.displayedRows')}
            label-first-page={$t('wealth.table.firstPage')}
            label-previous-page={$t('wealth.table.previousPage')}
            label-next-page={$t('wealth.table.nextPage')}
            label-last-page={$t('wealth.table.lastPage')}
            label-all={$t('wealth.table.all')}
            on:mdPageChange={onPageChange}
            on:mdRowsPerPageChange={onRowsPerPageChange}
          ></md-table-pagination>
        </md-table-container>
      </div>
    {/if}
  </div>
</Panel>
