import { Component, CUSTOM_ELEMENTS_SCHEMA, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { getFacilitiesFor, type Facility } from '@awc-ui/showcase-kit/data';
import { TABLES } from '@awc-ui/showcase-kit/credit-risk';
import { ShowcaseComponent } from '../lib/screen.base';
import { ChipComponent } from './bits.component';
import { EmptyStateComponent } from './empty-state.component';

/**
 * Facilities booked to one counterparty.
 *
 * CURRENCY IS THE TRAP HERE. `commitment` and `drawn` are denominated in the
 * facility's OWN currency; `commitmentEur`/`drawnEur` are the converted twins
 * and `ead` is always EUR. The commitment column therefore formats with
 * `{ currency: facility.currency }` and shows the EUR equivalent underneath,
 * while the EAD column formats in the base currency with no override. Mixing the
 * two would quietly report a RON line as if it were euros.
 */
@Component({
  selector: 'awc-facility-table',
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  styles: ':host { display: contents; }',
  imports: [RouterLink, ChipComponent, EmptyStateComponent],
  template: `
    @if (rows.length === 0) {
      <awc-empty-state [message]="t('empty.facilities')" />
    } @else {
      <md-table-container variant="outlined">
        <md-table
          [attr.label]="t('screen.facilities.title')"
          [attr.column-template]="columns"
          [attr.min-width]="minWidth"
          keep-height="false"
          striped
        >
          <md-table-head>
            <md-table-row rowgroup="head">
              @for (cell of head; track cell.label) {
                <md-table-cell head scope="col" [attr.numeric]="cell.numeric ? '' : null">
                  {{ cell.label }}
                </md-table-cell>
              }
            </md-table-row>
          </md-table-head>
          <md-table-body>
            @for (facility of rows; track facility.id) {
              <md-table-row [attr.value]="facility.id">
                <md-table-cell>
                  <a class="drill" [routerLink]="appPath(route.facility(facility.id))">
                    {{ facility.id }}
                  </a>
                </md-table-cell>
                <md-table-cell>{{ t(facility.typeKey) }}</md-table-cell>
                <md-table-cell>{{ facility.currency }}</md-table-cell>
                <md-table-cell numeric>
                  <span class="num">
                    {{
                      t.formatCurrency(facility.commitment, {
                        currency: facility.currency,
                        notation: 'compact'
                      })
                    }}
                  </span>
                  @if (facility.currency !== 'EUR') {
                    <br />
                    <span class="muted num" style="font: var(--md-sys-typescale-label-small-font)">
                      {{ t.formatCurrency(facility.commitmentEur, { notation: 'compact' }) }}
                    </span>
                  }
                </md-table-cell>
                <md-table-cell numeric>
                  {{ t.formatCurrency(facility.ead, { notation: 'compact' }) }}
                </md-table-cell>
                <md-table-cell numeric>
                  {{ t.formatPercent(facility.utilisation, { maximumFractionDigits: 0 }) }}
                </md-table-cell>
                <md-table-cell numeric>
                  {{ t('unit.bps', { value: t.formatNumber(facility.marginBps) }) }}
                </md-table-cell>
                <md-table-cell>{{ t.formatDate(facility.maturityDate, 'medium') }}</md-table-cell>
                <md-table-cell>
                  <md-chip awcChip kind="facility" [value]="facility.status"></md-chip>
                </md-table-cell>
              </md-table-row>
            }
          </md-table-body>
        </md-table>
      </md-table-container>
    }
  `,
})
export class FacilityTableComponent extends ShowcaseComponent {
  @Input({ required: true }) counterpartyId!: string;

  protected readonly columns = TABLES.facilities.columns;
  protected readonly minWidth = TABLES.facilities.minWidth;

  protected get rows(): Facility[] {
    return getFacilitiesFor(this.counterpartyId);
  }

  protected get head(): { label: string; numeric?: boolean }[] {
    return [
      { label: this.t('table.facility') },
      { label: this.t('table.type') },
      { label: this.t('table.currency') },
      { label: this.t('table.commitment'), numeric: true },
      { label: this.t('table.ead'), numeric: true },
      { label: this.t('table.utilisation'), numeric: true },
      { label: this.t('table.margin'), numeric: true },
      { label: this.t('table.maturity') },
      { label: this.t('table.status') },
    ];
  }
}
