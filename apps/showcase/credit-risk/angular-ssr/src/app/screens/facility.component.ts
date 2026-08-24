import { Component, CUSTOM_ELEMENTS_SCHEMA, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  BASE_CURRENCY,
  getCollateralFor,
  getCounterpartyById,
  getCovenantsFor,
  getFacilityById,
  type Facility,
} from '@awc-ui/showcase-kit/data';
import { drawdownSchedule, TABLES, utilisationColor } from '@awc-ui/showcase-kit/credit-risk';
import { ShowcaseComponent } from '../lib/screen.base';
import { ShellComponent, type Crumb } from '../components/shell.component';
import { PanelComponent } from '../components/panel.component';
import { EmptyStateComponent } from '../components/empty-state.component';
import {
  ChipComponent,
  CovenantMeterComponent,
  FactComponent,
  RatioMeterComponent,
} from '../components/bits.component';

/**
 * Screen 4 — the facility, and the bottom of the drill path.
 *
 * Terms, then the three things a credit officer checks after them: covenant
 * headroom, collateral net of haircuts, and the balance profile to maturity.
 *
 * COLLATERAL. `valuation` is in the collateral's own currency, `valuationEur` is
 * the converted twin and `netValue` — always EUR — is already
 * `valuationEur × (1 − haircut)`. The table shows all three so the haircut is
 * visible rather than implied, and the panel header compares total net value
 * against the facility's EAD, which is the coverage ratio that actually matters.
 *
 * SCHEDULE. See `drawdownSchedule()` in `@awc-ui/showcase-kit/credit-risk`: term
 * loans amortise straight-line to maturity, committed revolving lines hold and
 * retire in one step. Both shapes come out of the fixture's own dates, so the
 * table is a projection of the data rather than an invention on top of it.
 */
@Component({
  selector: 'awc-facility-screen',
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [
    ShellComponent,
    PanelComponent,
    EmptyStateComponent,
    ChipComponent,
    CovenantMeterComponent,
    FactComponent,
    RatioMeterComponent,
  ],
  template: `
    <awc-shell
      [title]="facility.id + ' · ' + t(facility.typeKey)"
      [subtitle]="facility.counterpartyName"
      [crumbs]="crumbs"
    >
      <ng-container aside>
        <md-chip awcChip kind="facility" [value]="facility.status"></md-chip>
        <md-chip
          variant="assist"
          appearance="outlined"
          [attr.icon]="facility.secured ? 'lock' : 'lock_open'"
          [attr.label]="facility.secured ? t('common.secured') : t('common.unsecured')"
        ></md-chip>
      </ng-container>

      <section class="grid-2">
        <awc-panel [title]="t('table.facility')" [subtitle]="t(facility.typeKey)">
          <dl class="dl dl--numeric">
            <div awcFact [label]="t('table.currency')">{{ facility.currency }}</div>
            <div awcFact [label]="t('table.commitment')">
              {{ t.formatCurrency(facility.commitment, local) }}
            </div>
            <div awcFact [label]="t('table.drawn')">
              {{ t.formatCurrency(facility.drawn, local) }}
            </div>
            <div awcFact [label]="t('table.undrawn')">
              {{ t.formatCurrency(facility.undrawn, local) }}
            </div>
            <div awcFact [label]="t('table.ead')">
              {{ t.formatCurrency(facility.ead, { notation: 'compact' }) }}
            </div>
            <div awcFact [label]="t('table.ccf')">
              {{ t.formatPercent(facility.ccf, { maximumFractionDigits: 0 }) }}
            </div>
            <div awcFact [label]="t('table.margin')">
              {{ t('unit.bps', { value: t.formatNumber(facility.marginBps) }) }}
            </div>
            <div awcFact [label]="t('table.maturity')">
              {{ t.formatDate(facility.maturityDate, 'long') }}
            </div>
            <div awcFact [label]="t('table.tenor')">
              {{ t('unit.months', { value: t.formatNumber(facility.monthsToMaturity) }) }}
            </div>
          </dl>
          <awc-ratio-meter
            [label]="t('kpi.utilisation')"
            [fraction]="facility.utilisation"
            [color]="utilisationColor(facility.utilisation)"
          />
        </awc-panel>

        <awc-panel
          [title]="t('screen.covenants.title')"
          [subtitle]="t('screen.covenants.subtitle', { breaches: breaches, watch: onWatch })"
        >
          @if (covenants.length === 0) {
            <awc-empty-state [message]="t('empty.covenants')" />
          } @else {
            <div class="stack">
              @for (covenant of covenants; track covenant.id) {
                <awc-covenant-meter [covenant]="covenant" />
              }
            </div>
          }
        </awc-panel>
      </section>

      <awc-panel [title]="t('screen.collateral.title')" [subtitle]="t('screen.collateral.subtitle')">
        @if (collateral.length > 0) {
          <md-chip
            actions
            variant="assist"
            appearance="filled"
            [attr.color]="coverage >= 1 ? 'success' : coverage >= 0.5 ? 'warning' : 'error'"
            [attr.label]="
              t('kpi.collateralCoverage') +
              ' ' +
              t.formatPercent(coverage, { maximumFractionDigits: 0 })
            "
          ></md-chip>
        }

        @if (collateral.length === 0) {
          <awc-empty-state [message]="t('empty.collateral')" />
        } @else {
          <md-table-container variant="outlined">
            <md-table
              [attr.label]="t('screen.collateral.title')"
              [attr.column-template]="collateralColumns"
              [attr.min-width]="collateralMinWidth"
              striped
            >
              <md-table-head>
                <md-table-row rowgroup="head">
                  <md-table-cell head scope="col">{{ t('table.collateral') }}</md-table-cell>
                  <md-table-cell head scope="col">{{ t('table.currency') }}</md-table-cell>
                  <md-table-cell head scope="col" numeric>{{ t('table.valuation') }}</md-table-cell>
                  <md-table-cell head scope="col" numeric>
                    {{ t('table.valuation') }} ({{ baseCurrency }})
                  </md-table-cell>
                  <md-table-cell head scope="col" numeric>{{ t('table.haircut') }}</md-table-cell>
                  <md-table-cell head scope="col" numeric>{{ t('table.netValue') }}</md-table-cell>
                  <md-table-cell head scope="col">{{ t('table.lastValuation') }}</md-table-cell>
                  <md-table-cell head scope="col">{{ t('table.basis') }}</md-table-cell>
                </md-table-row>
              </md-table-head>
              <md-table-body>
                @for (item of collateral; track item.id) {
                  <md-table-row [attr.value]="item.id">
                    <md-table-cell>{{ t(item.typeKey) }}</md-table-cell>
                    <md-table-cell>{{ item.currency }}</md-table-cell>
                    <md-table-cell numeric>
                      {{
                        t.formatCurrency(item.valuation, {
                          currency: item.currency,
                          notation: 'compact'
                        })
                      }}
                    </md-table-cell>
                    <md-table-cell numeric>
                      {{ t.formatCurrency(item.valuationEur, { notation: 'compact' }) }}
                    </md-table-cell>
                    <md-table-cell numeric>
                      {{ t.formatPercent(item.haircutPct, { maximumFractionDigits: 0 }) }}
                    </md-table-cell>
                    <md-table-cell numeric>
                      {{ t.formatCurrency(item.netValue, { notation: 'compact' }) }}
                    </md-table-cell>
                    <md-table-cell>{{ t.formatDate(item.lastValuationDate, 'medium') }}</md-table-cell>
                    <md-table-cell>{{ t(item.valuationBasisKey) }}</md-table-cell>
                  </md-table-row>
                }
              </md-table-body>
              <md-table-foot>
                <md-table-row rowgroup="foot">
                  <!-- head plus scope="row" makes this a rowheader, which is
                       what associates the net-collateral figure below with the
                       word Total. scope without head is inert. -->
                  <md-table-cell head scope="row">{{ t('common.total') }}</md-table-cell>
                  <md-table-cell></md-table-cell>
                  <md-table-cell></md-table-cell>
                  <md-table-cell></md-table-cell>
                  <md-table-cell></md-table-cell>
                  <md-table-cell numeric>
                    {{ t.formatCurrency(netCollateral, { notation: 'compact' }) }}
                  </md-table-cell>
                  <md-table-cell></md-table-cell>
                  <md-table-cell></md-table-cell>
                </md-table-row>
              </md-table-foot>
            </md-table>
          </md-table-container>
        }
      </awc-panel>

      <awc-panel
        [title]="t('table.tenor')"
        [subtitle]="t('unit.months', { value: t.formatNumber(facility.monthsToMaturity) })"
      >
        <md-table-container variant="outlined">
          <md-table
            [attr.label]="t('table.tenor')"
            [attr.column-template]="scheduleColumns"
            [attr.min-width]="scheduleMinWidth"
            striped
          >
            <md-table-head>
              <md-table-row rowgroup="head">
                <md-table-cell head scope="col">{{ t('table.quarter') }}</md-table-cell>
                <md-table-cell head scope="col" numeric>{{ t('table.commitment') }}</md-table-cell>
                <md-table-cell head scope="col" numeric>{{ t('table.drawn') }}</md-table-cell>
                <md-table-cell head scope="col" numeric>{{ t('table.undrawn') }}</md-table-cell>
                <!-- No dictionary key for "movement in the drawn balance"; the
                     delta sign is composed onto the translated noun the same way
                     table.elDelta composes it in the dictionary itself. -->
                <md-table-cell head scope="col" numeric>Δ {{ t('table.drawn') }}</md-table-cell>
                <md-table-cell head scope="col" numeric>{{ t('table.utilisation') }}</md-table-cell>
              </md-table-row>
            </md-table-head>
            <md-table-body>
              @for (row of schedule; track row.quarter; let index = $index) {
                <md-table-row [attr.value]="row.quarter">
                  <md-table-cell>{{ row.quarter }}</md-table-cell>
                  <md-table-cell numeric>{{ t.formatCurrency(row.commitment, local) }}</md-table-cell>
                  <md-table-cell numeric>{{ t.formatCurrency(row.drawn, local) }}</md-table-cell>
                  <md-table-cell numeric>{{ t.formatCurrency(row.undrawn, local) }}</md-table-cell>
                  <md-table-cell numeric>
                    <span [style.color]="movementColor(row.movement)">
                      <!-- The opening row has nothing to move against, so it
                           reads n/a. A genuine zero movement in a later quarter
                           is a real number and is printed as one. Movements are
                           money in the facility's own currency, like the columns
                           beside them — a bare number here would read as
                           euros. -->
                      {{ index === 0 ? t('common.na') : t.formatCurrency(row.movement, local) }}
                    </span>
                  </md-table-cell>
                  <md-table-cell numeric>
                    {{ t.formatPercent(row.utilisation, { maximumFractionDigits: 0 }) }}
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
export class FacilityScreen extends ShowcaseComponent {
  private readonly activated = inject(ActivatedRoute);

  protected readonly baseCurrency = BASE_CURRENCY;
  protected readonly utilisationColor = utilisationColor;
  protected readonly collateralColumns = TABLES.collateral.columns;
  protected readonly collateralMinWidth = TABLES.collateral.minWidth;
  protected readonly scheduleColumns = TABLES.schedule.columns;
  protected readonly scheduleMinWidth = TABLES.schedule.minWidth;

  private readonly facilityId = String(this.activated.snapshot.paramMap.get('id'));
  protected readonly facility = getFacilityById(this.facilityId) as Facility;
  private readonly counterparty = getCounterpartyById(this.facility.counterpartyId);
  protected readonly covenants = getCovenantsFor(this.facilityId);
  protected readonly collateral = getCollateralFor(this.facilityId);
  protected readonly schedule = drawdownSchedule(this.facility);

  protected readonly netCollateral = this.collateral.reduce((sum, item) => sum + item.netValue, 0);
  protected readonly coverage =
    this.facility.ead > 0 ? this.netCollateral / this.facility.ead : 0;
  protected readonly breaches = this.covenants.filter((c) => c.status === 'breach').length;
  protected readonly onWatch = this.covenants.filter((c) => c.status === 'watch').length;

  /** Money in the facility's OWN currency, compact — not the base currency. */
  protected readonly local = {
    currency: this.facility.currency,
    notation: 'compact' as const,
  };

  protected get crumbs(): Crumb[] {
    return this.memo('crumbs', () => [
      { label: this.t('nav.overview'), href: this.route.overview() },
      ...(this.counterparty
        ? [
            {
              label: this.t(`sector.${this.counterparty.sectorId}`),
              href: this.route.sector(this.counterparty.sectorId),
            },
            {
              label: this.counterparty.legalName,
              href: this.route.counterparty(this.counterparty.id),
            },
          ]
        : []),
      { label: this.facility.id },
    ]);
  }

  protected movementColor(movement: number): string | null {
    if (movement < 0) return 'var(--md-sys-color-success)';
    if (movement > 0) return 'var(--md-sys-color-error)';
    return null;
  }
}
