import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import {
  budgetColor,
  budgetRows,
  categoryColor,
  categoryIcon,
  categoryRing,
  flowSeries,
  getTotals,
  spendSeries,
  topMerchants,
  uncappedCategories,
} from '@awc-ui/showcase-kit/banking';
import { ShowcaseComponent } from '../lib/screen.base';
import { ScreenComponent } from '../components/screen.component';
import { PanelComponent } from '../components/panel.component';
import { ChartComponent } from '../components/chart.component';
import { SparklineComponent } from '../components/sparkline.component';
import { EmptyStateComponent } from '../components/empty-state.component';
import {
  BudgetMeterComponent,
  ChipComponent,
  CountComponent,
  KpiTileComponent,
  MoneyComponent,
  PercentComponent,
  SignedComponent,
} from '../components/bits.component';

/**
 * Where the money went this month.
 *
 * THE RING, THEN THE BUDGETS, THEN THE MERCHANTS — decreasing abstraction. The
 * ring says how the month was shaped; the budgets whether that was the plan;
 * the merchant list what to do about it.
 *
 * EVERY FIGURE HERE IS A POSITIVE MAGNITUDE, the one place this app's sign
 * convention is set aside — a ring cannot draw a negative slice. It is set
 * aside by taking the kit's own positive `amountEur`, never by negating here.
 */
@Component({
  selector: 'awc-analytics-screen',
  standalone: true,
  styles: ':host { display: contents; }',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [
    ScreenComponent,
    PanelComponent,
    ChartComponent,
    SparklineComponent,
    EmptyStateComponent,
    BudgetMeterComponent,
    ChipComponent,
    CountComponent,
    KpiTileComponent,
    MoneyComponent,
    PercentComponent,
    SignedComponent,
  ],
  template: `
    <awc-screen
      [title]="t('banking.screen.analytics.title')"
      [subtitle]="t('banking.screen.analytics.subtitle')"
    >
      <md-chip aside awcCount [value]="totals.monthTransactionCount"></md-chip>

      <section class="kpi-grid">
        <awc-kpi-tile
          [hasFoot]="true"
          [label]="t('banking.kpi.spentThisMonth')"
          [trend]="spendTrend"
          [trendLabels]="monthLabels"
          [formatTrend]="formatCompact"
        >
          <span value><span awcMoney [value]="totals.spentThisMonthEur"></span></span>
          <span hint>
            <bdi awcSigned [value]="totals.spendChangePct" kind="percent"></bdi>
            {{ t('banking.common.vsLastMonth') }}
          </span>
        </awc-kpi-tile>
        <awc-kpi-tile
          [hasFoot]="true" [label]="t('banking.kpi.income')">
          <span value><span awcMoney [value]="totals.incomeThisMonthEur"></span></span>
          <span hint>{{ t('banking.common.thisMonth') }}</span>
        </awc-kpi-tile>
        <awc-kpi-tile
          [hasFoot]="true" [label]="t('banking.kpi.netThisMonth')">
          <span value><bdi awcSigned [value]="totals.netThisMonthEur"></bdi></span>
          <span hint>{{ t('banking.common.thisMonth') }}</span>
        </awc-kpi-tile>
        <awc-kpi-tile
          [hasFoot]="true" [label]="t('banking.kpi.subscriptions')">
          <span value><span awcMoney [value]="totals.subscriptionMonthlyEur"></span></span>
          <span hint>{{ t('banking.common.perMonth') }}</span>
          <md-chip trailing awcCount [value]="totals.activeSubscriptionCount"></md-chip>
        </awc-kpi-tile>
      </section>

      <div class="grid-2">
        <awc-panel
          [title]="t('banking.panel.byCategory')"
          [subtitle]="t('banking.common.thisMonth')"
        >
          <!--
            inner-radius makes it a donut — there is no variant prop.
            show-labels is OFF: eight slices, the smallest under 5%, each
            printing a currency figure in white on a mid-tone fill, the two
            smallest overlapping outright. The legend names them, the tooltip
            gives values, and every figure is listed below.
          -->
          <awc-chart
            tag="md-pie-chart"
            class="chart-md"
            [data]="ringData"
            [valueFormatter]="formatCompact"
            [summary]="t('banking.panel.byCategory')"
            innerRadius="62%"
            showLabels="false"
            legend="bottom"
          >
            <div slot="center" class="ring-centre">
              <span class="ring-centre__value">
                <span awcMoney [value]="totals.spentThisMonthEur" [compact]="true"></span>
              </span>
              <span class="ring-centre__label">{{ t('banking.common.thisMonth') }}</span>
            </div>
          </awc-chart>
        </awc-panel>

        <awc-panel [title]="t('banking.panel.flow')">
          <!-- Two bars per month rather than one signed bar: in and out are
               different quantities, and a net bar hides a month where both
               doubled. -->
          <awc-chart
            tag="md-bar-chart"
            class="chart-md"
            [series]="flowSeriesProp"
            [xAxis]="flowAxis"
            [yAxis]="{ min: 0 }"
            [valueFormatter]="formatCompact"
            [label]="t('banking.panel.flow')"
            legend="top-end"
          />
        </awc-panel>
      </div>

      <awc-panel [title]="t('banking.panel.budgets')" [subtitle]="t('banking.common.thisMonth')">
        @if (totals.budgetOverCount > 0) {
          <md-chip
            actions
            variant="assist"
            appearance="outlined"
            color="error"
            [attr.label]="String(totals.budgetOverCount)"
            icon="warning"
          ></md-chip>
        }

        <div class="grid-2">
          @for (budget of budgets; track budget.category) {
            <md-card variant="outlined" full-width class="surface-card">
              <div class="budget-row">
                <div class="budget-row__head">
                  <md-chip
                    awcChip
                    [labelKey]="budget.categoryKey"
                    [color]="categoryColour(budget.category)"
                    [icon]="categoryGlyph(budget.category)"
                  ></md-chip>
                  <md-chip
                    awcChip
                    [labelKey]="budget.statusKey"
                    [color]="budgetColour(budget.status)"
                  ></md-chip>
                </div>
                <awc-budget-meter [fraction]="budget.usedPct" [status]="budget.status" />
                <div class="budget-row__foot">
                  <span>
                    <span awcMoney [value]="budget.spent"></span> /
                    <span awcMoney [value]="budget.monthlyLimit"></span>
                  </span>
                  <span><span awcPercent [value]="budget.usedPct"></span></span>
                </div>
                <!-- The trend separates "over for the first time in a year"
                     from "over every month", which the number cannot say.
                     [color], not [attr.color]: an attribute on the wrapper
                     stays on the wrapper and never reaches the md-sparkline
                     inside it. -->
                <awc-sparkline
                  [data]="budget.trend"
                  [labels]="monthLabels"
                  [valueFormatter]="formatCompact"
                  variant="area"
                  [color]="budget.status === 'over' ? 'error' : 'primary'"
                  curve="monotone"
                  height="34px"
                />
              </div>
            </md-card>
          }
        </div>

        @if (uncapped.length > 0) {
          <div class="row">
            <span class="muted">{{ t('banking.action.setBudget') }}</span>
            @for (row of uncapped; track row.category) {
              <md-chip
                awcChip
                [labelKey]="row.categoryKey"
                [color]="categoryColour(row.category)"
                [icon]="categoryGlyph(row.category)"
              ></md-chip>
            }
          </div>
        }
      </awc-panel>

      <awc-panel [title]="t('banking.panel.byMerchant')">
        <md-chip actions awcCount [value]="merchants.length"></md-chip>
        @if (merchants.length === 0) {
          <awc-empty-state [message]="t('banking.empty.transactions')" />
        } @else {
          <md-list
            [attr.label]="t('banking.panel.byMerchant')"
            interaction-mode="multi-action"
            list-style="segmented"
          >
            @for (merchant of merchants; track merchant.merchantId) {
              <md-list-item
                [attr.headline]="merchant.name"
                [attr.overline]="t(merchant.categoryKey)"
                [attr.supporting-text]="
                  t('banking.common.visits', { count: merchant.transactionCount })
                "
                lines="3"
              >
                <span slot="leading">
                  <md-avatar [attr.initials]="merchant.initials" size="small"></md-avatar>
                </span>
                <span slot="trailing"><span awcMoney [value]="merchant.amountEur"></span></span>
              </md-list-item>
            }
          </md-list>
        }
      </awc-panel>
    </awc-screen>
  `,
})
export class AnalyticsScreen extends ShowcaseComponent {
  protected readonly totals = getTotals();
  protected readonly budgets = budgetRows();
  protected readonly merchants = topMerchants(6);
  protected readonly uncapped = uncappedCategories();
  protected readonly String = String;

  private readonly ring = categoryRing();
  private readonly flow = flowSeries();
  private readonly spend = spendSeries();

  protected readonly spendTrend = this.spend.map((p) => p.spentEur);


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
  protected get monthLabels(): string[] {
    return this.memo('monthLabels', () =>
      this.spend.map((p) => this.t.formatDate(`${p.month}-01`, 'monthYear')),
    );
  }

  protected get ringData() {
    return this.memo('ringData', () =>
      this.ring.map((slice) => ({
        id: slice.id,
        label: this.t(slice.labelKey),
        value: slice.value,
      })),
    );
  }

  protected get flowSeriesProp() {
    return this.memo('flowSeries', () => [
      { id: 'in', label: this.t('banking.kpi.income'), data: this.flow.map((p) => p.inEur) },
      { id: 'out', label: this.t('banking.panel.spending'), data: this.flow.map((p) => p.outEur) },
    ]);
  }

  protected get flowAxis() {
    return this.memo('flowAxis', () => ({
      data: this.flow.map((p) => this.t.formatDate(`${p.month}-01`, 'monthYear')),
    }));
  }

  protected readonly formatCompact = (value: number | null): string =>
    this.t.formatCurrency(value ?? 0, { notation: 'compact' });

  protected categoryColour(category: keyof typeof categoryColor): string {
    return categoryColor[category];
  }
  protected categoryGlyph(category: keyof typeof categoryIcon): string {
    return categoryIcon[category];
  }
  protected budgetColour(status: keyof typeof budgetColor): string {
    return budgetColor[status];
  }
}
