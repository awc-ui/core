import { Component, CUSTOM_ELEMENTS_SCHEMA, ViewChild } from '@angular/core';
import { BASE_CURRENCY, getBookTotals, getOrders } from '@awc-ui/showcase-kit/wealth';
import { ShowcaseComponent } from '../lib/screen.base';
import { crumbsFor, type CrumbSpec } from '../lib/routes';
import { ScreenComponent } from '../components/screen.component';
import {
  KpiSkeletonComponent,
  PanelSkeletonComponent,
  TableSkeletonComponent,
} from '../components/skeletons.component';
import { KpiTileComponent, MoneyComponent, NumComponent } from '../components/bits.component';
import { TradeTicketComponent } from './trade-ticket.component';
import { OrderBlotterComponent } from './order-blotter.component';

/**
 * Screen 5 — the order ticket and the blotter. Ported from the React build's
 * `TradeScreen.tsx` + `TradeTicket.tsx` + `OrderBlotter.tsx`.
 *
 * A transactional screen rather than an analytical one, and it is laid out
 * that way: the thing you came to do is at the top in the wide half of the
 * split, what it is worth is beside it, and the record of everything already
 * raised is underneath. The KPI row is the only part that summarises.
 *
 * NOTHING IS COUNTED OR ADDED UP HERE. Three of the four tiles read a field of
 * `getBookTotals()` and the fourth is the LENGTH of a selector result — which
 * is filtering through the kit, not filtering the kit's answer. There is no
 * `.reduce()` on this screen, and the one figure that would need one (the
 * value of the working orders) is reported upward as a missing aggregate
 * rather than being computed in a component. See the README's rule zero.
 *
 * THE TOOLBAR CARRIES ONE ACTION AND IT WORKS. The shell's manual is explicit
 * that a control that does nothing is worse than an empty corner, so "new
 * order" puts focus in the ticket's first field rather than being a decorative
 * placeholder beside a decorative export. The React build threads a ref-shaped
 * `focusHandle` down for this; in Angular the parent simply calls a public
 * method on the `@ViewChild` — the direction is the same (the toolbar lives in
 * the parent, the control it wants lives in the child) with the framework's
 * own mechanism.
 *
 * Its stylesheet (`trade.css`, copied framework-free from the React app, plus
 * `snackbar.css`) is loaded app-wide via `angular.json`'s `styles`.
 */
@Component({
  selector: 'awc-trade-screen',
  standalone: true,
  styles: ':host { display: contents; }',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [
    ScreenComponent,
    KpiSkeletonComponent,
    PanelSkeletonComponent,
    TableSkeletonComponent,
    KpiTileComponent,
    MoneyComponent,
    NumComponent,
    TradeTicketComponent,
    OrderBlotterComponent,
  ],
  template: `
    <awc-screen
      [title]="t('wealth.screen.trade.title')"
      [subtitle]="t('wealth.screen.trade.subtitle', { working: totals.workingOrderCount })"
      [crumbs]="crumbs"
      [hasActions]="true"
      [customSkeleton]="true"
    >
      <!-- A native (click): the button is never soft-disabled, so there is no
           preventDefault-without-stopping-propagation path to guard against —
           the same reason the React build uses onClick here. -->
      <md-button
        actions
        variant="text"
        size="sm"
        icon="edit_note"
        (click)="focusTicket()"
      >
        {{ t('wealth.action.newOrder') }}
      </md-button>

      <section class="kpi-grid">
        <awc-kpi-tile [label]="t('wealth.kpi.workingOrders')" [hasFoot]="true">
          <span awcNum [value]="totals.workingOrderCount" ngProjectAs="[value]"></span>
          <ng-container ngProjectAs="[hint]">{{
            t('wealth.common.of', {
              count: totals.workingOrderCount,
              total: totals.orderCount
            })
          }}</ng-container>
        </awc-kpi-tile>
        <awc-kpi-tile [label]="t('wealth.orderStatus.filled')" [hasFoot]="true">
          <span awcNum [value]="filledCount" ngProjectAs="[value]"></span>
          <ng-container ngProjectAs="[hint]">{{
            t('wealth.common.of', { count: filledCount, total: totals.orderCount })
          }}</ng-container>
        </awc-kpi-tile>
        <awc-kpi-tile [label]="t('wealth.kpi.cash')" [hasFoot]="true">
          <span awcMoney [value]="totals.cash" [compact]="true" ngProjectAs="[value]"></span>
          <ng-container ngProjectAs="[hint]">{{
            t('wealth.app.baseCurrency', { currency: baseCurrency })
          }}</ng-container>
        </awc-kpi-tile>
        <awc-kpi-tile [label]="t('wealth.kpi.instruments')" [hasFoot]="true">
          <span awcNum [value]="totals.instrumentCount" ngProjectAs="[value]"></span>
          <ng-container ngProjectAs="[hint]">{{ t('wealth.panel.universe') }}</ng-container>
        </awc-kpi-tile>
      </section>

      <awc-trade-ticket />

      <awc-order-blotter />

      <!--
        The placeholder for THIS screen, rather than the generic one.

        The fallback got both halves wrong here. Its tiles carry a sparkline
        and a chip in the foot; these four carry neither, so the placeholder
        row stood 194px against a real 136 and everything below it sat 58px
        too high. And a two-panel .grid-2 is not the shape of this screen at
        all: the ticket and its valuation are a .grid-wide pair and the
        blotter is a full-width table under them. Measured on a first visit
        through the rail: 612px of placeholder swapped for 1440px of screen.

          .kpi-grid    four tiles, no spark, text feet    136px
          .grid-wide   the ticket | what it is worth      377px
          the table    the blotter                        895px

        PanelSkeleton and TableSkeleton draw 90px of their own chrome — a 16px
        card inset, a 16px panel inset, a 14px head and the 12px gap under it —
        so each height here is the real block MINUS 90.

        ONE ANNOUNCEMENT: the first KPI tile names the screen, the rest are
        silent.
      -->
      <ng-container ngProjectAs="[skeleton]">
        <!-- Every foot on this screen is a bare "n of m" line — no chip beside
             it — so all four are 16px, which is what makes the row 136 and
             not 152. -->
        <section class="kpi-grid">
          <awc-kpi-skeleton
            [announce]="true"
            [label]="t('wealth.screen.trade.title')"
            [spark]="false"
            foot="16px"
          />
          <awc-kpi-skeleton [spark]="false" foot="16px" />
          <awc-kpi-skeleton [spark]="false" foot="16px" />
          <awc-kpi-skeleton [spark]="false" foot="16px" />
        </section>

        <!-- The ticket beside its valuation. .grid-wide is a 2fr/1fr pair and
             the row is as tall as the taller cell; both are given the same
             height because the real pair is stretched to one. -->
        <div class="grid-wide">
          <awc-panel-skeleton height="287px" />
          <awc-panel-skeleton height="287px" />
        </div>

        <!-- The blotter. height rather than a row count: the real block
             carries a toolbar and a pagination bar as well as its rows, so
             rows * 40 cannot land on 805. -->
        <awc-table-skeleton height="805px" />
      </ng-container>
    </awc-screen>
  `,
})
export class TradeScreen extends ShowcaseComponent {
  protected readonly crumbs: CrumbSpec[] = crumbsFor(this.route.trade());
  protected readonly totals = getBookTotals();
  protected readonly baseCurrency = BASE_CURRENCY;

  // Filtering through the selector, then reading the length of what it
  // returns. getOrders({ status: 'filled' }) is the kit deciding what "filled"
  // means; orders.filter(o => o.status === 'filled') would be this file
  // deciding.
  protected readonly filledCount = getOrders({ status: 'filled' }).length;

  @ViewChild(TradeTicketComponent) private ticket?: TradeTicketComponent;

  protected focusTicket(): void {
    this.ticket?.focusInstrument();
  }
}
