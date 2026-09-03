import { Component, CUSTOM_ELEMENTS_SCHEMA, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import {
  BASE_CURRENCY,
  accountSummaries,
  cardStateColor,
  crumbsFor,
  getAccountById,
  getCards,
  getTransactions,
  statementDays,
} from '@awc-ui/showcase-kit/banking';
import { ShowcaseComponent } from '../lib/screen.base';
import { ScreenComponent } from '../components/screen.component';
import { PanelComponent } from '../components/panel.component';
import { EmptyStateComponent } from '../components/empty-state.component';
import {
  ChipComponent,
  CountComponent,
  DateTextComponent,
  FlowComponent,
  MoneyComponent,
  PercentComponent,
  SignedComponent,
  StatementRowComponent,
  VaultMeterComponent,
} from '../components/bits.component';

/**
 * One account: its details, its month, and its statement.
 *
 * A DRILL, NOT A DESTINATION — only reachable from the home screen's account
 * list, and it renders breadcrumbs because it is one level down.
 *
 * THE GUARD IS HERE, NOT IN THE ROUTER. A component taking a plain string from
 * a URL must not trust its caller — the id arrives from the route parameter.
 */
@Component({
  selector: 'awc-account-screen',
  standalone: true,
  styles: ':host { display: contents; }',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [
    ScreenComponent,
    PanelComponent,
    EmptyStateComponent,
    ChipComponent,
    CountComponent,
    DateTextComponent,
    FlowComponent,
    MoneyComponent,
    PercentComponent,
    SignedComponent,
    StatementRowComponent,
    VaultMeterComponent,
  ],
  template: `
    @if (!account()) {
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
        [title]="account()!.nickname"
        [subtitle]="t('banking.screen.account.subtitle')"
      >
        <md-chip aside awcChip [labelKey]="account()!.kindKey" color="info"></md-chip>
        <md-chip
          aside
          variant="assist"
          appearance="outlined"
          color="secondary"
          [attr.label]="account()!.currency"
        ></md-chip>

        <div class="grid-2">
          <awc-panel [title]="t('banking.panel.details')">
            <dl class="dl">
              <div>
                <dt>{{ t('banking.table.balance') }}</dt>
                <dd>
                  <span awcMoney [value]="account()!.balance" [currency]="account()!.currency"></span>
                </dd>
              </div>
              <div>
                <dt>{{ t('banking.table.available') }}</dt>
                <dd>
                  <span awcMoney [value]="account()!.available" [currency]="account()!.currency"></span>
                </dd>
              </div>
              @if (account()!.currency !== baseCurrency) {
                <div>
                  <dt>{{ baseCurrency }}</dt>
                  <dd><span awcMoney [value]="account()!.balanceEur"></span></dd>
                </div>
              }
              <div>
                <dt>{{ t('banking.table.iban') }}</dt>
                <!-- bdi: an IBAN is a neutral-direction string that must not
                     be re-ordered inside the Arabic layout. -->
                <dd><bdi class="num">{{ account()!.iban }}</bdi></dd>
              </div>
              @if (account()!.interestRate !== null) {
                <div>
                  <dt>{{ t('banking.table.interest') }}</dt>
                  <dd><span awcPercent [value]="account()!.interestRate!"></span></dd>
                </div>
              }
            </dl>

            @if (account()!.goalTarget !== null) {
              <div class="budget-row">
                <div class="budget-row__head">
                  <span class="strong">{{ account()!.goalName }}</span>
                  <span class="muted">{{ vaultHint() }}</span>
                </div>
                <awc-vault-meter
                  [fraction]="account()!.goalFundedPct ?? 0"
                  [label]="account()!.goalName ?? ''"
                />
              </div>
            }
          </awc-panel>

          <awc-panel [title]="t('banking.common.thisMonth')">
            <dl class="dl">
              <div>
                <dt>{{ t('banking.kpi.income') }}</dt>
                <dd>
                  <span awcMoney [value]="inThisMonth()" [currency]="account()!.currency"></span>
                </dd>
              </div>
              <div>
                <dt>{{ t('banking.panel.spending') }}</dt>
                <dd>
                  <span awcMoney [value]="outThisMonth()" [currency]="account()!.currency"></span>
                </dd>
              </div>
              <div>
                <dt>{{ t('banking.kpi.netThisMonth') }}</dt>
                <dd><bdi awcSigned [value]="net()" [currency]="account()!.currency"></bdi></dd>
              </div>
            </dl>

            @if (cards().length === 0) {
              <awc-empty-state [message]="t('banking.empty.cards')" />
            } @else {
              <md-list
                [attr.label]="t('banking.panel.cards')"
                interaction-mode="navigation"
                list-style="segmented"
              >
                @for (card of cards(); track card.id) {
                  <md-list-item
                    type="link"
                    [attr.href]="withBase(route.cards())"
                    [attr.headline]="card.label"
                    [attr.overline]="t('banking.unit.endingIn', { last4: card.last4 })"
                    lines="2"
                    leading-icon="credit_card"
                  >
                    <span slot="trailing">
                      <md-chip
                        awcChip
                        [labelKey]="card.stateKey"
                        [color]="cardColour(card.state)"
                      ></md-chip>
                    </span>
                  </md-list-item>
                }
              </md-list>
            }
          </awc-panel>
        </div>

        <awc-panel [title]="t('banking.action.statement')">
          <md-chip actions awcCount [value]="rows().length"></md-chip>
          @if (days().length === 0) {
            <awc-empty-state [message]="t('banking.empty.transactions')" />
          } @else {
            @for (day of days(); track day.date) {
              <div class="stack">
                <div class="statement-day">
                  <span><time awcDate [value]="day.date" format="long"></time></span>
                  <bdi awcFlow [value]="day.netEur"></bdi>
                </div>
                <md-list
                  [attr.label]="t.formatDate(day.date, 'long')"
                  interaction-mode="multi-action"
                  list-style="segmented"
                >
                  @for (txn of day.rows; track txn.id) {
                    <md-list-item awcStatementRow [txn]="txn" [showDate]="false"></md-list-item>
                  }
                </md-list>
              </div>
            }
          }
        </awc-panel>
      </awc-screen>
    }
  `,
})
export class AccountScreen extends ShowcaseComponent {
  protected readonly baseCurrency = BASE_CURRENCY;

  /*
   * The id comes off the route, the way the wealth build's drill screens read
   * theirs. `paramMap` as a signal rather than a subscription, so every derived
   * `computed` below re-runs when the router swaps one drill for another
   * without remounting the component.
   *
   * Decoded: the fixture ids are plain ASCII today, but decoding is what makes
   * a lookup miss mean "no such account" rather than "the id had a character
   * in it".
   */
  private readonly params = toSignal(inject(ActivatedRoute).paramMap);
  private readonly id = computed(() => decodeURIComponent(this.params()?.get('id') ?? ''));

  protected readonly account = computed(() => getAccountById(this.id()));
  private readonly summary = computed(() =>
    accountSummaries().find((s) => s.account.id === this.id()),
  );
  protected readonly cards = computed(() => {
    const a = this.account();
    return a ? getCards({ accountId: a.id }) : [];
  });
  protected readonly rows = computed(() => {
    const a = this.account();
    return a ? getTransactions({ accountId: a.id, limit: 40 }) : [];
  });
  protected readonly days = computed(() => statementDays(this.rows()));
  protected readonly crumbs = computed(() =>
    crumbsFor(this.route.account(this.id()), this.account()?.nickname ?? null),
  );

  protected readonly inThisMonth = computed(() => this.summary()?.inThisMonth ?? 0);
  protected readonly outThisMonth = computed(() => this.summary()?.outThisMonth ?? 0);
  protected readonly net = computed(() => this.inThisMonth() - this.outThisMonth());

  protected cardColour(state: keyof typeof cardStateColor): string {
    return cardStateColor[state];
  }

  protected vaultHint(): string {
    const a = this.account();
    return this.t('banking.hint.vault', {
      pct: this.t.formatPercent(a?.goalFundedPct ?? 0, { maximumFractionDigits: 0 }),
      target: this.t.formatCurrency(a?.goalTarget ?? 0, { notation: 'compact' }),
    });
  }
}
