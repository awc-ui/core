<!--
  Screen 5 — the order ticket and the blotter.

  A transactional screen rather than an analytical one, and it is laid out that
  way: the thing you came to do is at the top in the wide half of the split,
  what it is worth is beside it, and the record of everything already raised is
  underneath. The KPI row is the only part that summarises.

  NOTHING IS COUNTED OR ADDED UP HERE. Three of the four tiles read a field of
  `getBookTotals()` and the fourth is the LENGTH of a selector result — which is
  filtering through the kit, not filtering the kit's answer. There is no
  `.reduce()` on this screen, and the one figure that would need one (the value
  of the working orders) is reported upward as a missing aggregate rather than
  being computed in a component. See the README's rule zero.

  THE TOOLBAR CARRIES ONE ACTION AND IT WORKS. The shell's manual is explicit
  that a control that does nothing is worse than an empty corner, so "new order"
  puts focus in the ticket's first field rather than being a decorative
  placeholder beside a decorative export.

  The focus call travels through `bind:this` + an exported instance function
  (`focusInstrument`) — Svelte's shape for the React build's `focusHandle` ref
  box. Same direction (the toolbar lives here, the control lives in the child),
  same single call, no state lifted.
-->
<script lang="ts">
  import { BASE_CURRENCY, getBookTotals, getOrders } from '@awc-ui/showcase-kit/wealth';
  import { pathname } from '$lib/router';
  import { crumbsFor } from '$lib/routes';
  import { t } from '$lib/showcase';
  import Screen from '$lib/components/Screen.svelte';
  import KpiTile from '$lib/bits/KpiTile.svelte';
  import Money from '$lib/bits/Money.svelte';
  import Num from '$lib/bits/Num.svelte';
  import KpiSkeleton from '$lib/skeletons/KpiSkeleton.svelte';
  import PanelSkeleton from '$lib/skeletons/PanelSkeleton.svelte';
  import TableSkeleton from '$lib/skeletons/TableSkeleton.svelte';
  import OrderBlotter from './OrderBlotter.svelte';
  import TradeTicket from './TradeTicket.svelte';
  import './trade.css';

  const totals = getBookTotals();

  // Filtering through the selector, then reading the length of what it returns.
  // `getOrders({ status: 'filled' })` is the kit deciding what "filled" means;
  // `orders.filter(o => o.status === 'filled')` would be this file deciding.
  const filledCount = getOrders({ status: 'filled' }).length;

  let ticket: TradeTicket | undefined;
</script>

<Screen
  crumbs={crumbsFor($pathname)}
  title={$t('wealth.screen.trade.title')}
  subtitle={$t('wealth.screen.trade.subtitle', { working: totals.workingOrderCount })}
>
  <svelte:fragment slot="actions">
    <md-button
      variant="text"
      size="sm"
      icon="edit_note"
      on:click={() => ticket?.focusInstrument()}
    >
      {$t('wealth.action.newOrder')}
    </md-button>
  </svelte:fragment>

  <section class="kpi-grid">
    <KpiTile
      label={$t('wealth.kpi.workingOrders')}
      hint={$t('wealth.common.of', {
        count: totals.workingOrderCount,
        total: totals.orderCount,
      })}
    >
      <svelte:fragment slot="value"><Num value={totals.workingOrderCount} /></svelte:fragment>
    </KpiTile>
    <KpiTile
      label={$t('wealth.orderStatus.filled')}
      hint={$t('wealth.common.of', { count: filledCount, total: totals.orderCount })}
    >
      <svelte:fragment slot="value"><Num value={filledCount} /></svelte:fragment>
    </KpiTile>
    <KpiTile
      label={$t('wealth.kpi.cash')}
      hint={$t('wealth.app.baseCurrency', { currency: BASE_CURRENCY })}
    >
      <svelte:fragment slot="value"><Money value={totals.cash} compact /></svelte:fragment>
    </KpiTile>
    <KpiTile label={$t('wealth.kpi.instruments')} hint={$t('wealth.panel.universe')}>
      <svelte:fragment slot="value"><Num value={totals.instrumentCount} /></svelte:fragment>
    </KpiTile>
  </section>

  <TradeTicket bind:this={ticket} />

  <OrderBlotter />

  <!--
    The placeholder for THIS screen, rather than the generic one.

    `Screen`'s fallback got both halves wrong here. Its tiles carry a sparkline
    and a chip in the foot; these four carry neither, so the placeholder row
    stood 194px against a real 136 and everything below it sat 58px too high.
    And a two-panel `.grid-2` is not the shape of this screen at all: the ticket
    and its valuation are a `.grid-wide` pair and the blotter is a full-width
    table under them. Measured on a first visit through the rail: 612px of
    placeholder swapped for 1440px of screen.

      .kpi-grid      four tiles, no spark, text feet   136px
      .grid-wide     the ticket | what it is worth     377px
      the table      the blotter                       895px

    `PanelSkeleton` and `TableSkeleton` draw 90px of their own chrome — a 16px
    card inset, a 16px panel inset, a 14px head and the 12px gap under it — so
    each `height` here is the real block MINUS 90.

    ONE ANNOUNCEMENT: the first KPI tile names the screen, the rest are silent.
  -->
  <svelte:fragment slot="skeleton">
    <!-- Every foot on this screen is a bare "n of m" line — no chip beside it —
         so all four are 16px, which is what makes the row 136 and not 152. -->
    <section class="kpi-grid">
      <KpiSkeleton announce label={$t('wealth.screen.trade.title')} spark={false} foot="16px" />
      <KpiSkeleton spark={false} foot="16px" />
      <KpiSkeleton spark={false} foot="16px" />
      <KpiSkeleton spark={false} foot="16px" />
    </section>

    <!-- The ticket beside its valuation. `.grid-wide` is a 2fr/1fr pair and the
         row is as tall as the taller cell; both are given the same height
         because the real pair is stretched to one. -->
    <div class="grid-wide">
      <PanelSkeleton height="287px" />
      <PanelSkeleton height="287px" />
    </div>

    <!-- The blotter. `height` rather than a row count: the real block carries a
         toolbar and a pagination bar as well as its rows, so `rows * 40` cannot
         land on 805. -->
    <TableSkeleton height="805px" />
  </svelte:fragment>
</Screen>
