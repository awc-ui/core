import { Component, CUSTOM_ELEMENTS_SCHEMA, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import {
  crumbsFor,
  getHoldingFor,
  getInstrumentById,
  getTrades,
  instrumentKindColor,
  tradeSideColor,
  tradeStatusColor,
} from '@awc-ui/showcase-kit/banking';
import { ShowcaseComponent } from '../lib/screen.base';
import { ScreenComponent } from '../components/screen.component';
import { PanelComponent } from '../components/panel.component';
import { ChartComponent } from '../components/chart.component';
import { EmptyStateComponent } from '../components/empty-state.component';
import {
  ChipComponent,
  CountComponent,
  MoneyComponent,
  NumComponent,
  PercentComponent,
  SignedComponent,
} from '../components/bits.component';

/**
 * One instrument: its price, the position in it, and the trades behind that.
 *
 * THE HOLDING BLOCK IS CONDITIONAL, and that is the shape of the screen: a
 * watched instrument has a price and a chart and nothing else. Rendering an
 * empty position block would say the reader holds zero of it, which is a
 * different claim from not holding it at all.
 */
@Component({
  selector: 'awc-instrument-screen',
  standalone: true,
  styles: ':host { display: contents; }',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [
    ScreenComponent,
    PanelComponent,
    ChartComponent,
    EmptyStateComponent,
    ChipComponent,
    CountComponent,
    MoneyComponent,
    NumComponent,
    PercentComponent,
    SignedComponent,
  ],
  template: `
    @if (!instrument()) {
      <awc-screen
        [crumbs]="crumbs()"
        [title]="t('banking.screen.notFound.title')"
        [subtitle]="t('banking.screen.notFound.body')"
      >
        <awc-empty-state [message]="t('banking.screen.notFound.body')" />
      </awc-screen>
    } @else {
      <awc-screen
        [crumbs]="crumbs()"
        [title]="instrument()!.name"
        [subtitle]="t('banking.screen.instrument.subtitle')"
      >
        <md-chip
          aside
          awcChip
          [labelKey]="instrument()!.kindKey"
          [color]="kindColour()"
        ></md-chip>

        <awc-panel>
          <div class="instrument-head">
            <md-avatar [attr.initials]="instrument()!.initials" size="large"></md-avatar>
            <div class="stack">
              <span class="strong">{{ instrument()!.ticker }}</span>
              <span class="muted">{{ sectorLabel() }}</span>
            </div>
            <div class="instrument-head__figures">
              <span class="kpi__value">
                <span
                  awcMoney
                  [value]="instrument()!.price"
                  [currency]="instrument()!.currency"
                ></span>
              </span>
              <bdi awcSigned [value]="instrument()!.dayChangePct" kind="percent"></bdi>
            </div>
          </div>

          <dl class="dl">
            <div>
              <dt>{{ t('banking.table.day') }}</dt>
              <dd><bdi awcSigned [value]="instrument()!.dayChangePct" kind="percent"></bdi></dd>
            </div>
            <div>
              <dt>{{ t('banking.table.week') }}</dt>
              <dd><bdi awcSigned [value]="instrument()!.weekChangePct" kind="percent"></bdi></dd>
            </div>
            <div>
              <dt>{{ t('banking.table.year') }}</dt>
              <dd><bdi awcSigned [value]="instrument()!.yearChangePct" kind="percent"></bdi></dd>
            </div>
            <div>
              <dt>{{ t('banking.table.currency') }}</dt>
              <dd>{{ instrument()!.currency }}</dd>
            </div>
          </dl>
        </awc-panel>

        <awc-panel [title]="t('banking.panel.performance')">
          <awc-chart
            tag="md-area-chart"
            class="chart-lg"
            [series]="priceSeries()"
            [xAxis]="priceAxis()"
            [valueFormatter]="formatPrice"
            [summary]="t('banking.panel.performance')"
            curve="monotone"
            grid="horizontal"
          />
        </awc-panel>

        @if (holding(); as h) {
          <awc-panel [title]="t('banking.panel.holdings')">
            <dl class="dl">
              <div>
                <dt>{{ t('banking.table.quantity') }}</dt>
                <dd>
                  <span
                    awcNum
                    [value]="h.quantity"
                    [digits]="instrument()!.kind === 'crypto' ? 4 : 2"
                  ></span>
                </dd>
              </div>
              <div>
                <dt>{{ t('banking.table.value') }}</dt>
                <dd><span awcMoney [value]="h.marketValueEur"></span></dd>
              </div>
              <div>
                <dt>{{ t('banking.table.costBasis') }}</dt>
                <dd><span awcMoney [value]="h.costBasisEur"></span></dd>
              </div>
              <div>
                <dt>{{ t('banking.table.pl') }}</dt>
                <dd><bdi awcSigned [value]="h.unrealisedPlEur"></bdi></dd>
              </div>
              <div>
                <dt>{{ t('banking.table.plPct') }}</dt>
                <dd><bdi awcSigned [value]="h.unrealisedPlPct" kind="percent"></bdi></dd>
              </div>
              <div>
                <dt>{{ t('banking.table.allocation') }}</dt>
                <dd><span awcPercent [value]="h.allocation" [digits]="1"></span></dd>
              </div>
            </dl>
          </awc-panel>
        }

        <awc-panel [title]="t('banking.panel.tradeHistory')">
          <md-chip actions awcCount [value]="trades().length"></md-chip>
          @if (trades().length === 0) {
            <awc-empty-state [message]="t('banking.empty.trades')" />
          } @else {
            <md-list
              [attr.label]="t('banking.panel.tradeHistory')"
              interaction-mode="multi-action"
              list-style="segmented"
            >
              @for (trade of trades(); track trade.id) {
                <md-list-item
                  [attr.headline]="t.formatDate(trade.date, 'medium')"
                  [attr.overline]="trade.id"
                  [attr.supporting-text]="
                    t('banking.table.price') + ' ' + t.formatCurrency(trade.priceEur)
                  "
                  lines="3"
                >
                  <span slot="trailing" class="row">
                    <md-chip
                      awcChip
                      [labelKey]="trade.sideKey"
                      [color]="sideColour(trade.side)"
                    ></md-chip>
                    <md-chip
                      awcChip
                      [labelKey]="trade.statusKey"
                      [color]="statusColour(trade.status)"
                    ></md-chip>
                    <span awcMoney [value]="trade.amountEur"></span>
                  </span>
                </md-list-item>
              }
            </md-list>
          }
        </awc-panel>
      </awc-screen>
    }
  `,
})
export class InstrumentScreen extends ShowcaseComponent {
  /* The id comes off the route — see the note on the account drill. */
  private readonly params = toSignal(inject(ActivatedRoute).paramMap);
  private readonly id = computed(() => decodeURIComponent(this.params()?.get('id') ?? ''));

  protected readonly instrument = computed(() => getInstrumentById(this.id()));
  protected readonly holding = computed(() => getHoldingFor(this.id()));
  protected readonly trades = computed(() => getTrades({ instrumentId: this.id() }));
  protected readonly crumbs = computed(() =>
    crumbsFor(this.route.instrument(this.id()), this.instrument()?.name ?? null),
  );

  protected readonly kindColour = computed(() => {
    const i = this.instrument();
    return i ? instrumentKindColor[i.kind] : 'primary';
  });

  protected readonly sectorLabel = computed(() => {
    const i = this.instrument();
    if (!i) return '';
    return i.sectorKey ? this.t(i.sectorKey) : this.t(i.kindKey);
  });

  protected readonly priceSeries = computed(() => {
    const i = this.instrument();
    return i ? [{ id: i.id, label: i.ticker, data: i.history.map((p) => p.price) }] : [];
  });

  protected readonly priceAxis = computed(() => {
    const i = this.instrument();
    return {
      data: i ? i.history.map((p) => this.t.formatDate(p.date, 'short')) : [],
      scale: 'category',
    };
  });

  /* Closes over a resolved currency so the formatter never reaches into a
     possibly-undefined record. */
  protected readonly formatPrice = (value: number | null): string =>
    this.t.formatCurrency(value ?? 0, {
      currency: this.instrument()?.currency ?? 'EUR',
      maximumFractionDigits: 2,
    });

  protected sideColour(side: keyof typeof tradeSideColor): string {
    return tradeSideColor[side];
  }
  protected statusColour(status: keyof typeof tradeStatusColor): string {
    return tradeStatusColor[status];
  }
}
