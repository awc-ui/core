import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  getSectors,
  getStressScenarioById,
  getStressScenarios,
  type ScenarioId,
} from '@awc-ui/showcase-kit/data';
import { TABLES } from '@awc-ui/showcase-kit/credit-risk';
import { ShowcaseComponent } from '../lib/screen.base';
import { ShellComponent } from '../components/shell.component';
import { PanelComponent } from '../components/panel.component';
import { ChartComponent } from '../components/chart.component';
import { FactComponent } from '../components/bits.component';

/**
 * Screen 6 — stress testing.
 *
 * Three scenarios, EAD invariant across all of them, EL and RWA strictly
 * monotone. The comparison charts therefore always plot all three side by side
 * rather than only the selected one: the point of the screen is the SHAPE of the
 * deterioration, and a single-scenario chart hides it. The segmented selector
 * drives the per-sector table and the highlighted deltas underneath.
 *
 * Baseline's `expectedLossDelta` is exactly zero by construction — its EL equals
 * the portfolio EL — so the delta column reads `n/a` there rather than a
 * formatted `+0`, which would look like a rounded-away number.
 */
@Component({
  selector: 'awc-stress-screen',
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [ShellComponent, PanelComponent, ChartComponent, FactComponent, RouterLink],
  template: `
    <awc-shell [title]="t('screen.stress.title')" [subtitle]="t('screen.stress.subtitle')">
      <ng-container aside>
        <md-segmented-button-set
          [attr.aria-label]="t('table.scenario')"
          (mdChange)="onScenarioChange($event)"
        >
          @for (s of scenarios; track s.id) {
            <md-segmented-button
              [attr.value]="s.id"
              [attr.label]="t(s.nameKey)"
              [attr.selected]="s.id === 'adverse' ? '' : null"
            ></md-segmented-button>
          }
        </md-segmented-button-set>
      </ng-container>

      <awc-panel [title]="t(scenario.nameKey)" [subtitle]="description">
        <dl class="dl dl--numeric">
          <div awcFact [label]="t('table.pdMultiplier')">
            {{
              t('unit.times', {
                value: t.formatNumber(scenario.pdMultiplier, { maximumFractionDigits: 2 })
              })
            }}
          </div>
          <div awcFact [label]="t('table.lgdUplift')">
            {{
              t.formatPercent(scenario.lgdUplift, {
                maximumFractionDigits: 0,
                signDisplay: 'exceptZero'
              })
            }}
          </div>
          <div awcFact [label]="t('kpi.ead')">
            {{ t.formatCurrency(scenario.totals.ead, { notation: 'compact' }) }}
          </div>
          <div awcFact [label]="t('kpi.expectedLoss')">
            {{ t.formatCurrency(scenario.totals.expectedLoss, { notation: 'compact' }) }}
          </div>
          <div awcFact [label]="t('table.elDelta')">
            {{
              scenario.totals.expectedLossDelta === 0
                ? t('common.na')
                : t.formatCurrency(scenario.totals.expectedLossDelta, { notation: 'compact' })
            }}
          </div>
          <div awcFact [label]="t('kpi.rwa')">
            {{ t.formatCurrency(scenario.totals.rwa, { notation: 'compact' }) }}
          </div>
          <div awcFact [label]="t('table.rwaDelta')">
            {{
              scenario.totals.rwaDelta === 0
                ? t('common.na')
                : t.formatCurrency(scenario.totals.rwaDelta, { notation: 'compact' })
            }}
          </div>
          <div awcFact [label]="t('kpi.weightedAvgPd')">
            {{ t.formatPercent(scenario.totals.weightedAvgPd, { maximumFractionDigits: 2 }) }}
          </div>
          <div awcFact [label]="t('kpi.rwaDensity')">
            {{ t.formatPercent(scenario.totals.rwaDensity, { maximumFractionDigits: 1 }) }}
          </div>
        </dl>
      </awc-panel>

      <!-- Both charts carry their own header; the panels stay untitled so the
           heading is not printed twice. -->
      <section class="grid-2">
        <awc-panel>
          <awc-chart
            tag="md-bar-chart"
            [series]="elSeries"
            [xAxis]="sectorAxis"
            [yAxis]="elAxis"
            [valueFormatter]="money"
            legend="top-end"
            [axisTicks]="true"
            height="340px"
            [label]="t('kpi.expectedLoss')"
            [subtitle]="t('scenario.compare')"
          />
        </awc-panel>

        <awc-panel>
          <awc-chart
            tag="md-bar-chart"
            [series]="rwaSeries"
            [xAxis]="sectorAxis"
            [yAxis]="rwaAxis"
            [valueFormatter]="money"
            legend="top-end"
            [axisTicks]="true"
            height="340px"
            [label]="t('kpi.rwa')"
            [subtitle]="t('scenario.compare')"
          />
        </awc-panel>
      </section>

      <awc-panel
        [title]="t('table.sector')"
        [subtitle]="t(scenario.nameKey) + ' · ' + t('scenario.vsBaseline')"
      >
        <md-table-container variant="outlined">
          <md-table
            [attr.label]="t('screen.stress.title')"
            [attr.column-template]="columns"
            [attr.min-width]="minWidth"
            striped
          >
            <md-table-head>
              <md-table-row rowgroup="head">
                <md-table-cell head scope="col">{{ t('table.sector') }}</md-table-cell>
                <md-table-cell head scope="col" numeric>{{ t('table.ead') }}</md-table-cell>
                <md-table-cell head scope="col" numeric>{{ t('table.pd') }}</md-table-cell>
                <md-table-cell head scope="col" numeric>{{ t('table.lgd') }}</md-table-cell>
                <md-table-cell head scope="col" numeric>{{ t('table.expectedLoss') }}</md-table-cell>
                <md-table-cell head scope="col" numeric>{{ t('table.elDelta') }}</md-table-cell>
                <md-table-cell head scope="col" numeric>{{ t('table.rwa') }}</md-table-cell>
                <md-table-cell head scope="col" numeric>{{ t('table.rwaDelta') }}</md-table-cell>
              </md-table-row>
            </md-table-head>
            <md-table-body>
              @for (row of scenario.bySector; track row.sectorId) {
                <md-table-row [attr.value]="row.sectorId">
                  <md-table-cell>
                    <a class="drill" [routerLink]="appPath(route.sector(row.sectorId))">
                      {{ t('sector.' + row.sectorId) }}
                    </a>
                  </md-table-cell>
                  <md-table-cell numeric>
                    {{ t.formatCurrency(row.ead, { notation: 'compact' }) }}
                  </md-table-cell>
                  <md-table-cell numeric>
                    {{ t.formatPercent(row.weightedAvgPd, { maximumFractionDigits: 2 }) }}
                  </md-table-cell>
                  <md-table-cell numeric>
                    {{ t.formatPercent(row.weightedAvgLgd, { maximumFractionDigits: 1 }) }}
                  </md-table-cell>
                  <md-table-cell numeric>
                    {{ t.formatCurrency(row.expectedLoss, { notation: 'compact' }) }}
                  </md-table-cell>
                  <md-table-cell numeric>
                    <span
                      [style.color]="
                        row.expectedLossDelta > 0 ? 'var(--md-sys-color-error)' : null
                      "
                    >
                      {{
                        row.expectedLossDelta === 0
                          ? t('common.na')
                          : t.formatCurrency(row.expectedLossDelta, { notation: 'compact' })
                      }}
                    </span>
                  </md-table-cell>
                  <md-table-cell numeric>
                    {{ t.formatCurrency(row.rwa, { notation: 'compact' }) }}
                  </md-table-cell>
                  <md-table-cell numeric>
                    <span [style.color]="row.rwaDelta > 0 ? 'var(--md-sys-color-warning)' : null">
                      {{
                        row.rwaDelta === 0
                          ? t('common.na')
                          : t.formatCurrency(row.rwaDelta, { notation: 'compact' })
                      }}
                    </span>
                  </md-table-cell>
                </md-table-row>
              }
            </md-table-body>
          </md-table>
        </md-table-container>
      </awc-panel>
    </awc-shell>
  `,
})
export class StressScreen extends ShowcaseComponent {
  protected readonly scenarios = getStressScenarios();
  private readonly sectors = getSectors();
  protected readonly columns = TABLES.stress.columns;
  protected readonly minWidth = TABLES.stress.minWidth;

  private scenarioId: ScenarioId = 'adverse';

  protected get scenario() {
    return getStressScenarioById(this.scenarioId) ?? this.scenarios[0];
  }

  protected get description(): string {
    const s = this.scenario;
    return this.t(s.descriptionKey, {
      pd: this.t.formatNumber(s.pdMultiplier, { maximumFractionDigits: 2 }),
      lgd: this.t.formatPercent(s.lgdUplift, { maximumFractionDigits: 0 }),
    });
  }

  protected onScenarioChange(event: Event): void {
    const [value] = (event as CustomEvent<string[]>).detail ?? [];
    if (value) this.scenarioId = value as ScenarioId;
  }

  protected get money() {
    return this.memo('money', () => (v: number | null) =>
      this.t.formatCurrency(v ?? 0, { notation: 'compact' }),
    );
  }

  protected get sectorAxis() {
    return this.memo('sectorAxis', () => ({ data: this.sectors.map((s) => this.t(s.nameKey)) }));
  }

  protected get elAxis() {
    return this.memo('elAxis', () => ({ label: this.t('kpi.expectedLoss'), min: 0 }));
  }

  protected get rwaAxis() {
    return this.memo('rwaAxis', () => ({ label: this.t('kpi.rwa'), min: 0 }));
  }

  protected get elSeries() {
    return this.memo('elSeries', () =>
      this.scenarios.map((s) => ({
        id: s.id,
        label: this.t(s.nameKey),
        data: s.bySector.map((row) => row.expectedLoss),
      })),
    );
  }

  protected get rwaSeries() {
    return this.memo('rwaSeries', () =>
      this.scenarios.map((s) => ({
        id: s.id,
        label: this.t(s.nameKey),
        data: s.bySector.map((row) => row.rwa),
      })),
    );
  }
}
