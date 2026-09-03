import { Component, CUSTOM_ELEMENTS_SCHEMA, computed, signal } from '@angular/core';
import {
  TABLES,
  getTotals,
  getTrades,
  holdingRows,
  instrumentKindColor,
  portfolioRing,
  portfolioSeries,
  tradeEstimate,
  tradeSideColor,
  tradeStatusColor,
  watchlistRows,
} from '@awc-ui/showcase-kit/banking';
import { RouterLink } from '@angular/router';
import { ShowcaseComponent } from '../lib/screen.base';
import { PHONE, mediaQuery } from '../lib/media';
import { ScreenComponent } from '../components/screen.component';
import { PanelComponent } from '../components/panel.component';
import { ChartComponent } from '../components/chart.component';
import { EmptyStateComponent } from '../components/empty-state.component';
import {
  ChipComponent,
  CountComponent,
  KpiTileComponent,
  MoneyComponent,
  NumComponent,
  PercentComponent,
  SignedComponent,
} from '../components/bits.component';

/**
 * The investing account: what is held, what is watched, what has been traded.
 *
 * CONSUMER-GRADE ON PURPOSE. The wealth console next door has an institutional
 * order ticket. This is the other thing: a quantity, an estimate, a button.
 *
 * THE PORTFOLIO CURVE IS LABELLED FOR WHAT IT IS — today's quantities re-priced
 * down the history, not what the portfolio was worth on each day.
 */
@Component({
  selector: 'awc-invest-screen',
  standalone: true,
  styles: ':host { display: contents; }',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [
    RouterLink,
    ScreenComponent,
    PanelComponent,
    ChartComponent,
    EmptyStateComponent,
    ChipComponent,
    CountComponent,
    KpiTileComponent,
    MoneyComponent,
    NumComponent,
    PercentComponent,
    SignedComponent,
  ],
  template: `
    <awc-screen
      [title]="t('banking.screen.invest.title')"
      [subtitle]="t('banking.screen.invest.subtitle')"
    >
      <md-chip aside awcCount [value]="totals.holdingCount"></md-chip>

      <section class="kpi-grid">
        <awc-kpi-tile
          [hasFoot]="true" [label]="t('banking.kpi.portfolio')">
          <span value><span awcMoney [value]="totals.portfolioValueEur" [compact]="true"></span></span>
          <span hint><bdi awcSigned [value]="totals.portfolioReturnPct" kind="percent"></bdi></span>
        </awc-kpi-tile>
        <awc-kpi-tile
          [hasFoot]="true" [label]="t('banking.kpi.unrealisedPl')">
          <span value><bdi awcSigned [value]="totals.portfolioUnrealisedPlEur" [compact]="true"></bdi></span>
          <span hint><span awcMoney [value]="totals.portfolioCostBasisEur" [compact]="true"></span></span>
        </awc-kpi-tile>
        <awc-kpi-tile
          [hasFoot]="true" [label]="t('banking.kpi.dayChange')">
          <span value><bdi awcSigned [value]="totals.portfolioDayChangeEur"></bdi></span>
        </awc-kpi-tile>
        <awc-kpi-tile
          [hasFoot]="true" [label]="t('banking.panel.holdings')">
          <span value><span awcNum [value]="holdings.length"></span></span>
          <span hint>{{ t('banking.kpi.watchlist') }}</span>
          <md-chip trailing awcCount [value]="totals.watchlistCount"></md-chip>
        </awc-kpi-tile>
      </section>

      <div class="grid-2">
        <awc-panel
          [title]="t('banking.panel.performance')"
          [subtitle]="t('banking.hint.portfolioSeries')"
        >
          @if (curve.length > 0) {
            <awc-chart
              tag="md-area-chart"
              class="chart-md"
              [series]="curveSeries"
              [xAxis]="curveAxis"
              [valueFormatter]="formatCompact"
              [summary]="t('banking.panel.performance')"
              curve="monotone"
              grid="horizontal"
            />
          }
        </awc-panel>

        <awc-panel [title]="t('banking.panel.allocation')">
          <awc-chart
            tag="md-pie-chart"
            class="chart-md"
            [data]="ringData"
            [valueFormatter]="formatCompact"
            [summary]="t('banking.panel.allocation')"
            innerRadius="62%"
            showLabels="false"
            legend="bottom"
          >
            <div slot="center" class="ring-centre">
              <span class="ring-centre__value">
                <span awcMoney [value]="totals.portfolioValueEur" [compact]="true"></span>
              </span>
              <span class="ring-centre__label">{{ t('banking.kpi.portfolio') }}</span>
            </div>
          </awc-chart>
        </awc-panel>
      </div>

      <awc-panel [title]="t('banking.panel.tradeTicket')">
        <div class="stack form-stack">
          <md-select
            [attr.label]="t('banking.table.name')"
            [attr.value]="instrumentId()"
            (mdChange)="onPick($event)"
          >
            @for (h of holdings; track h.instrument.id) {
              <md-select-option
                [attr.value]="h.instrument.id"
                [attr.label]="h.instrument.ticker + ' — ' + h.instrument.name"
              ></md-select-option>
            }
          </md-select>

          <!-- No format-options: a quantity is a bare count of units, and a
               crypto holding is fractional to four places. -->
          <md-number-field
            [attr.label]="t('banking.table.quantity')"
            [attr.value]="quantity()"
            [attr.min]="0"
            [attr.step]="1"
            small-step="0.1"
            large-step="10"
            [attr.locale]="showcase.state().locale"
            (mdInput)="onQuantityInput($event)"
            (mdChange)="onQuantityChange($event)"
          ></md-number-field>

          @if (estimate(); as e) {
            <div class="stack">
              <div class="quote-line">
                <span>{{ t('banking.table.price') }}</span>
                <span class="num"><span awcMoney [value]="e.priceEur"></span></span>
              </div>
              <div class="quote-line">
                <span>{{ t('banking.table.fee') }}</span>
                <span class="num"><span awcMoney [value]="e.feeEur"></span></span>
              </div>
              <div class="quote-line quote-line--total">
                <span>{{ t('banking.table.total') }}</span>
                <span class="num"><span awcMoney [value]="e.totalEur"></span></span>
              </div>
            </div>
          }

          <div class="row">
            <md-tooltip
              [attr.text]="reason() ?? ''"
              [attr.disabled]="reason() === null ? '' : null"
            >
              <md-button
                variant="filled"
                icon="trending_up"
                [attr.soft-disabled]="reason() !== null || placed() ? '' : null"
                (click)="placed.set(true)"
              >
                {{ t('banking.action.buy') }}
              </md-button>
            </md-tooltip>
            <md-button
              variant="tonal"
              icon="trending_down"
              [attr.soft-disabled]="reason() !== null || placed() ? '' : null"
              (click)="placed.set(true)"
            >
              {{ t('banking.action.sell') }}
            </md-button>
            @if (placed()) {
              <span class="muted">{{ t('banking.msg.tradePlaced') }}</span>
            }
          </div>
        </div>
      </awc-panel>

      <awc-panel [title]="t('banking.panel.holdings')">
        <md-chip actions awcCount [value]="holdings.length"></md-chip>
        @if (holdings.length === 0) {
          <awc-empty-state [message]="t('banking.empty.holdings')" />
        } @else if (phone()) {
          <!--
            A LIST ON A PHONE, NOT THE TABLE. The table needs 1040px for nine
            columns and scrolls honestly below that, but scrolling a
            nine-column grid sideways on a 390px screen is not reading a
            portfolio — and value, P/L and weight are exactly the columns that
            end up off-screen.
          -->
          <md-list
            [attr.label]="t('banking.panel.holdings')"
            interaction-mode="navigation"
            list-style="segmented"
          >
            @for (h of holdings; track h.instrument.id) {
              <md-list-item
                type="link"
                [attr.href]="withBase(route.instrument(h.instrument.id))"
                [attr.headline]="h.instrument.name"
                [attr.overline]="h.instrument.ticker"
                [attr.supporting-text]="
                  t(h.instrument.kindKey) +
                  ' · ' +
                  t.formatPercent(h.allocation, { maximumFractionDigits: 1 })
                "
                lines="3"
              >
                <span slot="leading">
                  <md-avatar [attr.initials]="h.instrument.initials" size="small"></md-avatar>
                </span>
                <span slot="trailing" class="account-row__figures">
                  <span awcMoney [value]="h.marketValueEur"></span>
                  <bdi awcSigned [value]="h.unrealisedPlPct" kind="percent"></bdi>
                </span>
              </md-list-item>
            }
          </md-list>
        } @else {
          <md-table-container variant="outlined" class="table-host">
            <md-table
              [attr.label]="t('banking.panel.holdings')"
              [attr.column-template]="layout.columns"
              [attr.min-width]="layout.minWidth"
              keep-height="false"
              striped
            >
              <md-table-head>
                <md-table-row rowgroup="head">
                  <md-table-cell head scope="col">{{ t('banking.table.ticker') }}</md-table-cell>
                  <md-table-cell head scope="col">{{ t('banking.table.name') }}</md-table-cell>
                  <md-table-cell head scope="col">{{ t('banking.table.kind') }}</md-table-cell>
                  <md-table-cell head scope="col" numeric>{{ t('banking.table.quantity') }}</md-table-cell>
                  <md-table-cell head scope="col" numeric>{{ t('banking.table.price') }}</md-table-cell>
                  <md-table-cell head scope="col" numeric>{{ t('banking.table.value') }}</md-table-cell>
                  <md-table-cell head scope="col" numeric>{{ t('banking.table.pl') }}</md-table-cell>
                  <md-table-cell head scope="col" numeric>{{ t('banking.table.plPct') }}</md-table-cell>
                  <md-table-cell head scope="col" numeric>{{ t('banking.table.allocation') }}</md-table-cell>
                </md-table-row>
              </md-table-head>
              <md-table-body>
                @for (h of holdings; track h.instrument.id) {
                  <md-table-row [attr.value]="h.instrument.id">
                    <md-table-cell>
                      <!-- routerLink, not an href with a click handler: the
                           router owns in-app navigation here and keeps the
                           drill from reloading the document. -->
                      <a class="drill" [routerLink]="appPath(route.instrument(h.instrument.id))">
                        <span class="strong">{{ h.instrument.ticker }}</span>
                      </a>
                    </md-table-cell>
                    <md-table-cell>{{ h.instrument.name }}</md-table-cell>
                    <md-table-cell>
                      <md-chip
                        awcChip
                        [labelKey]="h.instrument.kindKey"
                        [color]="kindColour(h.instrument.kind)"
                      ></md-chip>
                    </md-table-cell>
                    <md-table-cell numeric>
                      <span
                        awcNum
                        [value]="h.quantity"
                        [digits]="h.instrument.kind === 'crypto' ? 4 : 2"
                      ></span>
                    </md-table-cell>
                    <md-table-cell numeric><span awcMoney [value]="h.instrument.priceEur"></span></md-table-cell>
                    <md-table-cell numeric><span awcMoney [value]="h.marketValueEur" [compact]="true"></span></md-table-cell>
                    <md-table-cell numeric><bdi awcSigned [value]="h.unrealisedPlEur" [compact]="true"></bdi></md-table-cell>
                    <md-table-cell numeric><bdi awcSigned [value]="h.unrealisedPlPct" kind="percent"></bdi></md-table-cell>
                    <md-table-cell numeric><span awcPercent [value]="h.allocation" [digits]="1"></span></md-table-cell>
                  </md-table-row>
                }
              </md-table-body>
            </md-table>
          </md-table-container>
        }
      </awc-panel>

      <div class="grid-2">
        <awc-panel [title]="t('banking.panel.watchlist')">
          <md-chip actions awcCount [value]="watchlist.length"></md-chip>
          @if (watchlist.length === 0) {
            <awc-empty-state [message]="t('banking.empty.watchlist')" />
          } @else {
            <md-list
              [attr.label]="t('banking.panel.watchlist')"
              interaction-mode="navigation"
              list-style="segmented"
            >
              @for (instrument of watchlist; track instrument.id) {
                <md-list-item
                  type="link"
                  [attr.href]="withBase(route.instrument(instrument.id))"
                  [attr.headline]="instrument.name"
                  [attr.overline]="instrument.ticker"
                  [attr.supporting-text]="t(instrument.kindKey)"
                  lines="3"
                >
                  <span slot="leading">
                    <md-avatar [attr.initials]="instrument.initials" size="small"></md-avatar>
                  </span>
                  <span slot="trailing" class="account-row__figures">
                    <span awcMoney [value]="instrument.priceEur"></span>
                    <bdi awcSigned [value]="instrument.dayChangePct" kind="percent"></bdi>
                  </span>
                </md-list-item>
              }
            </md-list>
          }
        </awc-panel>

        <awc-panel [title]="t('banking.panel.tradeHistory')">
          <md-chip actions awcCount [value]="trades.length"></md-chip>
          @if (trades.length === 0) {
            <awc-empty-state [message]="t('banking.empty.trades')" />
          } @else {
            <md-list
              [attr.label]="t('banking.panel.tradeHistory')"
              interaction-mode="multi-action"
              list-style="segmented"
            >
              @for (trade of trades; track trade.id) {
                <md-list-item
                  [attr.headline]="trade.instrumentId"
                  [attr.overline]="t.formatDate(trade.date, 'medium')"
                  [attr.supporting-text]="t(trade.sideKey) + ' · ' + t(trade.statusKey)"
                  lines="3"
                >
                  <span slot="trailing" class="row">
                    <md-chip awcChip [labelKey]="trade.sideKey" [color]="sideColour(trade.side)"></md-chip>
                    <md-chip awcChip [labelKey]="trade.statusKey" [color]="statusColour(trade.status)"></md-chip>
                    <span awcMoney [value]="trade.amountEur"></span>
                  </span>
                </md-list-item>
              }
            </md-list>
          }
        </awc-panel>
      </div>
    </awc-screen>
  `,
})
export class InvestScreen extends ShowcaseComponent {
  protected readonly phone = mediaQuery(PHONE);
  protected readonly totals = getTotals();
  protected readonly holdings = holdingRows();
  protected readonly watchlist = watchlistRows();
  protected readonly trades = getTrades({ limit: 10 });
  protected readonly curve = portfolioSeries();
  protected readonly layout = TABLES.holdings();

  private readonly ring = portfolioRing();

  /* Defaults to the largest holding — never an empty select. */
  protected readonly instrumentId = signal(this.holdings[0]?.instrument.id ?? '');
  protected readonly quantity = signal<number | null>(1);
  protected readonly placed = signal(false);

  protected readonly estimate = computed(() => {
    const q = this.quantity();
    return q === null ? null : tradeEstimate(this.instrumentId(), q);
  });
  protected readonly reason = computed(() =>
    this.estimate() === null ? this.t('banking.hint.quantityNeeded') : null,
  );


  /*
   * MEMOISED, and this is not an optimisation — it is what stops the page
   * hanging. `series`, `data`, `xAxis` and `labels` are PROPERTY bindings, and
   * Angular dirty-checks those by reference: a getter that builds a fresh array
   * every call is a new reference on every change-detection pass, so the chart
   * re-assigns and Stencil redraws, which schedules another pass. On the
   * analytics screen — five sparklines plus two charts — that thrashed hard
   * enough that the page never became interactive and even an evaluate() call
   * timed out. The base class's `memo` returns the same object until the
   * LOCALE changes, which is the only thing these actually depend on.
   */
  protected get curveSeries() {
    return this.memo('curveSeries', () => [
      {
        id: 'value',
        label: this.t('banking.kpi.portfolio'),
        data: this.curve.map((p) => p.valueEur),
      },
    ]);
  }
  protected get curveAxis() {
    return this.memo('curveAxis', () => ({
      data: this.curve.map((p) => this.t.formatDate(p.date, 'short')),
      scale: 'category',
    }));
  }
  protected get ringData() {
    return this.memo('ringData', () =>
      this.ring.map((s) => ({ id: s.id, label: s.labelKey, value: s.value })),
    );
  }

  protected readonly formatCompact = (value: number | null): string =>
    this.t.formatCurrency(value ?? 0, { notation: 'compact' });

  protected kindColour(kind: keyof typeof instrumentKindColor): string {
    return instrumentKindColor[kind];
  }
  protected sideColour(side: keyof typeof tradeSideColor): string {
    return tradeSideColor[side];
  }
  protected statusColour(status: keyof typeof tradeStatusColor): string {
    return tradeStatusColor[status];
  }

  protected onQuantityInput(event: Event): void {
    this.quantity.set((event as CustomEvent<{ value: number | null }>).detail.value);
    this.placed.set(false);
  }
  protected onQuantityChange(event: Event): void {
    this.quantity.set((event as CustomEvent<{ value: number | null }>).detail.value);
  }
  protected onPick(event: Event): void {
    const detail = (event as CustomEvent<string | string[]>).detail;
    const value = Array.isArray(detail) ? detail[0] : detail;
    if (value) this.instrumentId.set(value);
    this.placed.set(false);
  }
}
