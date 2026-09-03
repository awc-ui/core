import { Component, CUSTOM_ELEMENTS_SCHEMA, computed, signal } from '@angular/core';
import {
  getFxPairs,
  getSpendingAccounts,
  quote,
  rateSeries,
  type Currency,
} from '@awc-ui/showcase-kit/banking';
import { ShowcaseComponent } from '../lib/screen.base';
import { ScreenComponent } from '../components/screen.component';
import { PanelComponent } from '../components/panel.component';
import { ChartComponent } from '../components/chart.component';
import { MoneyComponent, PercentComponent, SignedComponent } from '../components/bits.component';

/**
 * The exchange desk: a ticket, a rate history, and the pairs the desk quotes.
 *
 * WHY THE QUOTE IS NOT COMPUTED HERE. `quote()` in the kit prices the trade —
 * mid rate, spread, the fee off the SOURCE side, and the net. Per-port
 * arithmetic would mean five implementations of the same rounding.
 *
 * AN INVALID PAIR IS UNREACHABLE, not refused: each select drops the other's
 * current value, and the send side is limited to currencies with an account —
 * you cannot send what you do not hold.
 */
@Component({
  selector: 'awc-exchange-screen',
  standalone: true,
  styles: ':host { display: contents; }',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [
    ScreenComponent,
    PanelComponent,
    ChartComponent,
    MoneyComponent,
    PercentComponent,
    SignedComponent,
  ],
  template: `
    <awc-screen
      [title]="t('banking.screen.exchange.title')"
      [subtitle]="t('banking.screen.exchange.subtitle')"
    >
      <div class="grid-2">
        <awc-panel [title]="t('banking.panel.ticket')">
          <div class="stack">
            <!-- Both selects carry supporting text: only one having any made
                 the row bottom-align two boxes of different heights. -->
            <div class="ticket">
              <md-select
                [attr.label]="t('banking.table.send')"
                [attr.value]="from()"
                [attr.supporting-text]="balanceIn(from())"
                (mdChange)="onFrom($event)"
              >
                @for (code of sendOptions(); track code) {
                  <md-select-option [attr.value]="code" [attr.label]="code"></md-select-option>
                }
              </md-select>

              <md-tooltip
                [attr.text]="t('banking.hint.cannotSwap')"
                [attr.disabled]="canSwap() ? '' : null"
              >
                <md-icon-button
                  class="ticket__swap"
                  icon="swap_horiz"
                  [attr.aria-label]="t('banking.action.swap')"
                  [attr.soft-disabled]="canSwap() ? null : ''"
                  (click)="swap()"
                ></md-icon-button>
              </md-tooltip>

              <md-select
                [attr.label]="t('banking.table.receive')"
                [attr.value]="to()"
                [attr.supporting-text]="balanceIn(to())"
                (mdChange)="onTo($event)"
              >
                @for (code of receiveOptions(); track code) {
                  <md-select-option [attr.value]="code" [attr.label]="code"></md-select-option>
                }
              </md-select>
            </div>

            <md-number-field
              [attr.label]="t('banking.table.amount')"
              [attr.value]="amount()"
              [attr.min]="0"
              [attr.step]="10"
              small-step="1"
              large-step="100"
              [attr.locale]="showcase.state().locale"
              [attr.format-options]="formatOptions()"
              (mdInput)="onAmountInput($event)"
              (mdChange)="onAmountChange($event)"
            ></md-number-field>

            @if (priced(); as p) {
              <div class="stack">
                <div class="quote-line">
                  <span>{{ t('banking.table.rate') }}</span>
                  <span class="num">
                    1 {{ from() }} =
                    {{ t.formatNumber(p.rate, { maximumFractionDigits: 4 }) }} {{ to() }}
                  </span>
                </div>
                <div class="quote-line">
                  <span>{{ t('banking.table.spread') }}</span>
                  <span class="num">
                    {{ t('banking.unit.bps', { value: t.formatNumber(p.spreadBps) }) }}
                  </span>
                </div>
                <div class="quote-line">
                  <span>{{ t('banking.table.fee') }}</span>
                  <!-- A zero fee is said in words: "Fee €0.00" reads as a
                       charge that rounds to nothing. The row stays — its
                       absence is indistinguishable from having missed it. -->
                  <span class="num">
                    @if (p.feeFrom === 0) {
                      {{ t('banking.common.free') }}
                    } @else {
                      <span awcMoney [value]="p.feeFrom" [currency]="from()"></span>
                    }
                  </span>
                </div>
                <div class="quote-line quote-line--total">
                  <span>{{ t('banking.table.receive') }}</span>
                  <span class="num"><span awcMoney [value]="p.net" [currency]="to()"></span></span>
                </div>
              </div>
            }

            <div class="row">
              <!-- The tooltip exists only while the gate does: once the ticket
                   is priced the button is live, and an explanation would be a
                   lie. -->
              <md-tooltip
                [attr.text]="reason() ?? ''"
                [attr.disabled]="reason() === null ? '' : null"
              >
                <md-button
                  variant="filled"
                  icon="check"
                  [attr.soft-disabled]="reason() !== null || done() ? '' : null"
                  (click)="done.set(true)"
                >
                  {{ t('banking.action.confirm') }}
                </md-button>
              </md-tooltip>
              @if (done()) {
                <span class="muted">{{ t('banking.msg.exchanged') }}</span>
              }
            </div>
          </div>
        </awc-panel>

        <awc-panel
          [title]="t('banking.panel.rateHistory')"
          [subtitle]="charted() ? charted()!.base + '/' + charted()!.quote : t('banking.common.na')"
        >
          @if (charted(); as c) {
            <bdi actions awcSigned [value]="c.thirtyDayChangePct" kind="percent"></bdi>
          }
          @if (history().length > 0) {
            <awc-chart
              tag="md-line-chart"
              chartClass="chart-md"
              [series]="rateSeriesProp()"
              [xAxis]="rateAxis()"
              [valueFormatter]="formatRate"
              [summary]="t('banking.panel.rateHistory')"
              curve="monotone"
              grid="horizontal"
            />
          }
        </awc-panel>
      </div>

      <awc-panel
        [title]="t('banking.panel.details')"
        [subtitle]="t('banking.screen.exchange.subtitle')"
      >
        <div class="grid-3">
          @for (pair of pairs; track pair.id) {
            <md-card variant="outlined" full-width class="surface-card">
              <div class="row row--between">
                <span class="strong">{{ pair.base }}/{{ pair.quote }}</span>
                <bdi awcSigned [value]="pair.thirtyDayChangePct" kind="percent"></bdi>
              </div>
              <dl class="dl">
                <div>
                  <dt>{{ t('banking.table.rate') }}</dt>
                  <dd class="num">{{ t.formatNumber(pair.rate, { maximumFractionDigits: 4 }) }}</dd>
                </div>
                <div>
                  <dt>{{ t('banking.table.spread') }}</dt>
                  <dd class="num">
                    {{ t('banking.unit.bps', { value: t.formatNumber(pair.spreadBps) }) }}
                  </dd>
                </div>
                <div>
                  <dt>{{ t('banking.table.fee') }}</dt>
                  <dd class="num">
                    @if (pair.feePct === 0) {
                      {{ t('banking.common.free') }}
                    } @else {
                      <span awcPercent [value]="pair.feePct"></span>
                    }
                  </dd>
                </div>
              </dl>
            </md-card>
          }
        </div>
      </awc-panel>

      <awc-panel [title]="t('banking.panel.accounts')">
        <div class="row">
          @for (account of accounts; track account.id) {
            <span class="row">
              <md-chip
                variant="assist"
                appearance="outlined"
                color="secondary"
                [attr.label]="account.currency"
              ></md-chip>
              <span awcMoney [value]="account.balance" [currency]="account.currency"></span>
            </span>
          }
        </div>
      </awc-panel>
    </awc-screen>
  `,
})
export class ExchangeScreen extends ShowcaseComponent {
  protected readonly accounts = getSpendingAccounts();
  protected readonly pairs = getFxPairs();

  private readonly QUOTED: Currency[] = ['EUR', 'USD', 'GBP', 'RON'];
  private readonly held = this.QUOTED.filter((code) =>
    this.accounts.some((a) => a.currency === code),
  );

  protected readonly from = signal<Currency>('EUR');
  protected readonly to = signal<Currency>('GBP');
  /* A NUMBER: `md-number-field` emits one already parsed and renders its own
     steppers. `null` is empty — distinct from 0, a real amount. */
  protected readonly amount = signal<number | null>(250);
  protected readonly done = signal(false);

  protected readonly sendOptions = computed(() => this.held.filter((c) => c !== this.to()));
  protected readonly receiveOptions = computed(() => this.QUOTED.filter((c) => c !== this.from()));

  private readonly valid = computed(() => this.amount() !== null && (this.amount() as number) > 0);
  protected readonly priced = computed(() =>
    this.valid() && this.from() !== this.to()
      ? quote(this.from(), this.to(), this.amount() as number)
      : null,
  );

  protected readonly charted = computed(() =>
    this.pairs.find(
      (p) =>
        (p.base === this.from() && p.quote === this.to()) ||
        (p.base === this.to() && p.quote === this.from()),
    ),
  );
  protected readonly history = computed(() => {
    const c = this.charted();
    return c ? rateSeries(c.id) : [];
  });

  protected readonly canSwap = computed(() =>
    this.accounts.some((a) => a.currency === this.to()),
  );

  /* No same-currency branch: the option lists make that state unreachable. */
  protected readonly reason = computed(() =>
    !this.valid()
      ? this.t('banking.hint.amountNeeded')
      : !this.priced()
        ? this.t('banking.hint.noPair')
        : null,
  );

  protected readonly formatOptions = computed(() =>
    JSON.stringify({ style: 'currency', currency: this.from(), maximumFractionDigits: 2 }),
  );

  protected readonly rateSeriesProp = computed(() => {
    const c = this.charted();
    return [{ id: 'rate', label: `${c?.base}/${c?.quote}`, data: this.history().map((p) => p.rate) }];
  });

  protected readonly rateAxis = computed(() => ({
    data: this.history().map((p) => this.t.formatDate(p.date, 'short')),
    scale: 'category',
  }));

  protected readonly formatRate = (value: number | null): string =>
    this.t.formatNumber(value ?? 0, { maximumFractionDigits: 4 });

  /* Both events: `mdInput` for typing, `mdChange` for a commit. The detail is
     `{ value, formattedValue, reason }` — already a number, no parsing. */
  protected onAmountInput(event: Event): void {
    this.amount.set((event as CustomEvent<{ value: number | null }>).detail.value);
    this.done.set(false);
  }
  protected onAmountChange(event: Event): void {
    this.amount.set((event as CustomEvent<{ value: number | null }>).detail.value);
  }

  protected onFrom(event: Event): void {
    const value = this.pick(event);
    if (value) this.from.set(value as Currency);
    this.done.set(false);
  }
  protected onTo(event: Event): void {
    const value = this.pick(event);
    if (value) this.to.set(value as Currency);
    this.done.set(false);
  }

  /* Only when the receive currency is one you hold: otherwise the swap sets a
     send currency deliberately absent from that select's own options. */
  protected swap(): void {
    if (!this.canSwap()) return;
    const previous = this.from();
    this.from.set(this.to());
    this.to.set(previous);
    this.done.set(false);
  }

  /** Always a string, so both boxes keep the same height. */
  protected balanceIn(currency: Currency): string {
    const account = this.accounts.find((a) => a.currency === currency);
    return account
      ? this.t.formatCurrency(account.balance, {
          currency,
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      : this.t('banking.hint.noAccount');
  }

  private pick(event: Event): string | undefined {
    const detail = (event as CustomEvent<string | string[]>).detail;
    return Array.isArray(detail) ? detail[0] : detail;
  }
}
