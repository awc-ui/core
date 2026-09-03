import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import {
  BASE_CURRENCY,
  accountSummaries,
  balanceSeries,
  budgetOverall,
  cardStateColor,
  getCards,
  getTotals,
  getTransactions,
  headlines,
  upcomingCharges,
} from '@awc-ui/showcase-kit/banking';
import { ShowcaseComponent } from '../lib/screen.base';
import { ScreenComponent } from '../components/screen.component';
import { PanelComponent } from '../components/panel.component';
import { ChartComponent } from '../components/chart.component';
import {
  BudgetMeterComponent,
  ChipComponent,
  CountComponent,
  DateTextComponent,
  KpiTileComponent,
  MoneyComponent,
  PercentComponent,
  SignedComponent,
  StatementRowComponent,
  VaultMeterComponent,
} from '../components/bits.component';

/**
 * Home — what someone opens the app to see.
 *
 * FOUR HEADLINES, THEN THE ACCOUNTS, THEN WHAT NEEDS ATTENTION: the reading
 * order of "am I fine?" — the net figure, then where the money physically is,
 * then anything unusual.
 *
 * NOTHING HERE COMPUTES ANYTHING. Every figure is a kit field or the return of
 * a kit function.
 */
@Component({
  selector: 'awc-home-screen',
  standalone: true,
  styles: ':host { display: contents; }',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [
    ScreenComponent,
    PanelComponent,
    ChartComponent,
    BudgetMeterComponent,
    ChipComponent,
    CountComponent,
    DateTextComponent,
    KpiTileComponent,
    MoneyComponent,
    PercentComponent,
    SignedComponent,
    StatementRowComponent,
    VaultMeterComponent,
  ],
  template: `
    <awc-screen
      [title]="t('banking.screen.home.title')"
      [subtitle]="t('banking.screen.home.subtitle')"
    >
      <md-button
        aside
        variant="tonal"
        size="sm"
        icon="currency_exchange"
        [attr.href]="withBase(route.exchange())"
      >
        {{ t('banking.action.exchange') }}
      </md-button>
      <md-button
        aside
        variant="text"
        size="sm"
        icon="receipt_long"
        [attr.href]="withBase(route.transactions())"
      >
        {{ t('banking.action.statement') }}
      </md-button>

      <section class="kpi-grid">
        @for (h of headlines; track h.labelKey) {
          <awc-kpi-tile
          [hasFoot]="true"
            [label]="t(h.labelKey)"
            [trend]="h.labelKey === 'banking.kpi.balance' ? balanceTrend : undefined"
            [trendLabels]="trendLabels"
            [formatTrend]="formatCompact"
          >
            <span value><span awcMoney [value]="h.valueEur" [compact]="true"></span></span>
            @if (h.changePct !== null) {
              <span hint>
                <bdi awcSigned [value]="h.changePct" kind="percent"></bdi>
                {{
                  h.labelKey === 'banking.kpi.spentThisMonth'
                    ? t('banking.common.vsLastMonth')
                    : t('banking.kpi.unrealisedPl')
                }}
              </span>
            }
          </awc-kpi-tile>
        }
      </section>

      <div class="grid-2">
        <awc-panel
          [title]="t('banking.panel.accounts')"
          [subtitle]="t('banking.app.baseCurrency', { currency: baseCurrency })"
        >
          <md-chip actions awcCount [value]="totals.accountCount"></md-chip>

          <md-list
            [attr.label]="t('banking.panel.accounts')"
            interaction-mode="navigation"
            list-style="segmented"
          >
            @for (row of summaries; track row.account.id) {
              <md-list-item
                type="link"
                [attr.href]="withBase(route.account(row.account.id))"
                [attr.headline]="row.account.nickname"
                lines="3"
                [attr.overline]="t(row.account.kindKey) + ' · ' + row.account.currency"
                [attr.supporting-text]="
                  t('banking.common.transactions', { count: row.transactionCount })
                "
                [attr.leading-icon]="
                  row.account.kind === 'vault' ? 'savings' : 'account_balance_wallet'
                "
              >
                <span slot="trailing" class="account-row__figures">
                  <span awcMoney [value]="row.account.balance" [currency]="row.account.currency"></span>
                  <!-- The EUR twin only when it differs — the same figure twice
                       is noise on the three EUR accounts. -->
                  @if (row.account.currency !== baseCurrency) {
                    <span class="muted">
                      <span awcMoney [value]="row.account.balanceEur" [compact]="true"></span>
                    </span>
                  }
                </span>
              </md-list-item>
            }
          </md-list>

          <!-- The vault's progress, under the list it belongs to rather than as
               a sixth row — the same account, shown a second way. -->
          @for (row of vaults; track row.account.id) {
            <div class="budget-row">
              <div class="budget-row__head">
                <span class="strong">{{ row.account.goalName }}</span>
                <span class="muted">{{ vaultHint(row.account) }}</span>
              </div>
              <awc-vault-meter
                [fraction]="row.account.goalFundedPct ?? 0"
                [label]="row.account.goalName ?? ''"
              />
            </div>
          }
        </awc-panel>

        <awc-panel
          [title]="t('banking.panel.balanceTrend')"
          [subtitle]="t('banking.common.showing', { shown: curve.length, total: curve.length })"
        >
          <awc-chart
            tag="md-area-chart"
            chartClass="chart-md"
            [series]="balanceSeriesProp"
            [xAxis]="balanceAxis"
            [valueFormatter]="formatCompact"
            [summary]="t('banking.panel.balanceTrend')"
            curve="monotone"
            grid="horizontal"
          />
        </awc-panel>
      </div>

      <div class="grid-2">
        <awc-panel [title]="t('banking.panel.spending')" [subtitle]="t('banking.common.thisMonth')">
          <md-button actions variant="text" size="sm" [attr.href]="withBase(route.analytics())">
            {{ t('banking.action.viewAll') }}
          </md-button>

          <dl class="dl">
            <div>
              <dt>{{ t('banking.kpi.spentThisMonth') }}</dt>
              <dd><span awcMoney [value]="totals.spentThisMonthEur"></span></dd>
            </div>
            <div>
              <dt>{{ t('banking.kpi.income') }}</dt>
              <dd><span awcMoney [value]="totals.incomeThisMonthEur"></span></dd>
            </div>
            <div>
              <dt>{{ t('banking.kpi.netThisMonth') }}</dt>
              <dd><bdi awcSigned [value]="totals.netThisMonthEur"></bdi></dd>
            </div>
          </dl>

          <div class="budget-row">
            <div class="budget-row__head">
              <span>{{ t('banking.kpi.budgetUsed') }}</span>
              <span class="strong"><span awcPercent [value]="budget.usedPct"></span></span>
            </div>
            <!-- The overall meter takes the WORST status of the five, not an
                 average: one category 15% over is the thing worth surfacing. -->
            <awc-budget-meter [fraction]="budget.usedPct" [status]="budgetStatus" />
            <div class="budget-row__foot">
              <span>
                <span awcMoney [value]="budget.spent" [compact]="true"></span> /
                <span awcMoney [value]="budget.limit" [compact]="true"></span>
              </span>
              @if (totals.budgetOverCount > 0) {
                <span>{{ t('banking.budgetStatus.over') }}</span>
              }
            </div>
          </div>
        </awc-panel>

        <awc-panel
          [title]="t('banking.panel.upcoming')"
          [subtitle]="t('banking.kpi.subscriptions')"
        >
          <md-chip actions awcCount [value]="totals.activeSubscriptionCount"></md-chip>
          <md-list
            [attr.label]="t('banking.panel.upcoming')"
            interaction-mode="multi-action"
            list-style="segmented"
          >
            @for (charge of charges; track charge.subscriptionId) {
              <md-list-item
                [attr.headline]="charge.name"
                [attr.overline]="t(charge.cadenceKey)"
                lines="2"
              >
                <span slot="leading">
                  <md-avatar [attr.initials]="charge.initials" size="small"></md-avatar>
                </span>
                <span slot="trailing" class="account-row__figures">
                  <span awcMoney [value]="charge.amountEur"></span>
                  <span class="muted"><time awcDate [value]="charge.nextChargeDate"></time></span>
                </span>
              </md-list-item>
            }
          </md-list>
        </awc-panel>
      </div>

      <div class="grid-2">
        <awc-panel [title]="t('banking.panel.recent')">
          <md-button actions variant="text" size="sm" [attr.href]="withBase(route.transactions())">
            {{ t('banking.action.viewAll') }}
          </md-button>
          <md-list
            [attr.label]="t('banking.panel.recent')"
            interaction-mode="multi-action"
            list-style="segmented"
          >
            @for (txn of recent; track txn.id) {
              <md-list-item awcStatementRow [txn]="txn"></md-list-item>
            }
          </md-list>
        </awc-panel>

        <awc-panel [title]="t('banking.panel.cards')">
          <md-button actions variant="text" size="sm" [attr.href]="withBase(route.cards())">
            {{ t('banking.action.viewAll') }}
          </md-button>
          <md-list
            [attr.label]="t('banking.panel.cards')"
            interaction-mode="navigation"
            list-style="segmented"
          >
            @for (card of cards; track card.id) {
              <md-list-item
                type="link"
                [attr.href]="withBase(route.cards())"
                [attr.headline]="card.label"
                [attr.overline]="t('banking.unit.endingIn', { last4: card.last4 })"
                [attr.supporting-text]="t(card.kindKey) + ' · ' + t(card.stateKey)"
                lines="3"
                leading-icon="credit_card"
              >
                <!-- No status dot: it anchors absolutely with nothing to anchor
                     to, and the chip beside it already says the same word. -->
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
        </awc-panel>
      </div>
    </awc-screen>
  `,
})
export class HomeScreen extends ShowcaseComponent {
  protected readonly baseCurrency = BASE_CURRENCY;
  protected readonly totals = getTotals();
  protected readonly summaries = accountSummaries();
  protected readonly curve = balanceSeries();
  protected readonly budget = budgetOverall();
  protected readonly charges = upcomingCharges(4);
  protected readonly cards = getCards();
  /* A preview of the statement, in the statement's own default order. */
  protected readonly recent = getTransactions({ limit: 6 });
  protected readonly headlines = headlines();
  protected readonly vaults = this.summaries.filter(({ account }) => account.goalTarget !== null);
  protected readonly balanceTrend = this.curve.map((p) => p.balanceEur);
  protected readonly budgetStatus =
    this.totals.budgetOverCount > 0 ? 'over' : this.totals.budgetNearCount > 0 ? 'near' : 'under';


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
  protected get trendLabels(): string[] {
    return this.memo('trendLabels', () =>
      this.curve.map((p) => this.t.formatDate(`${p.month}-01`, 'monthYear')),
    );
  }

  protected get balanceSeriesProp() {
    return this.memo('balanceSeries', () => [
      { id: 'balance', label: this.t('banking.kpi.balance'), data: this.balanceTrend },
    ]);
  }

  protected get balanceAxis() {
    return this.memo('balanceAxis', () => ({ data: this.trendLabels, scale: 'category' }));
  }

  protected readonly formatCompact = (value: number | null): string =>
    this.t.formatCurrency(value ?? 0, { notation: 'compact' });

  protected cardColour(state: keyof typeof cardStateColor): string {
    return cardStateColor[state];
  }

  protected vaultHint(account: { goalFundedPct: number | null; goalTarget: number | null }): string {
    return this.t('banking.hint.vault', {
      pct: this.t.formatPercent(account.goalFundedPct ?? 0, { maximumFractionDigits: 0 }),
      target: this.t.formatCurrency(account.goalTarget ?? 0, { notation: 'compact' }),
    });
  }
}
