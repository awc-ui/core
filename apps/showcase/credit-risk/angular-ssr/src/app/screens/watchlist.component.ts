import { Component, CUSTOM_ELEMENTS_SCHEMA, ElementRef, ViewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  getRatingGrade,
  getSectors,
  getWatchlist,
  type SectorId,
  type SignalSeverity,
} from '@awc-ui/showcase-kit/data';
import { TABLES } from '@awc-ui/showcase-kit/credit-risk';
import { ShowcaseComponent } from '../lib/screen.base';
import { ShellComponent } from '../components/shell.component';
import { PanelComponent } from '../components/panel.component';
import { EmptyStateComponent } from '../components/empty-state.component';
import { ChipComponent, SeverityDotComponent } from '../components/bits.component';

const SEVERITIES: SignalSeverity[] = ['high', 'medium', 'low'];

/**
 * Screen 5 — early-warning signals.
 *
 * `getWatchlist()` returns rows already denormalised with the counterparty name,
 * sector, grade and EAD, and already sorted highest severity first then largest
 * exposure — so the table needs no join and no comparator, and the filters can
 * be a plain `Array.filter` over the selector's output rather than a second
 * ordering that could disagree with it.
 *
 * FILTERS. Severity is a multiselect segmented set (`mdChange` gives the value
 * of every selected segment, in DOM order); sector is a clearable select. An
 * empty severity selection means "all", which is the same thing the set reports
 * when the user clears the last segment — so no separate "all" segment is
 * needed, and the reset button restores exactly that state.
 *
 * `frozen-header`, NOT `sticky-header`. This is the only table in the app inside
 * a bounded container, so the only one that scrolls vertically, and the two
 * props give different architectures for that. `sticky-header` pins the header
 * inside the scroll port, which means the scroll port — and therefore the
 * scrollbar — spans the header too. `frozen-header` renders the header OUTSIDE
 * the scrolling area so the bar runs beside the rows only.
 */
@Component({
  selector: 'awc-watchlist-screen',
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [
    ShellComponent,
    PanelComponent,
    EmptyStateComponent,
    ChipComponent,
    SeverityDotComponent,
    RouterLink,
  ],
  template: `
    <awc-shell
      [title]="t('screen.watchlist.title')"
      [subtitle]="
        t('screen.watchlist.subtitle', {
          signals: signals.length,
          counterparties: allCounterparties
        })
      "
    >
      <ng-container aside>
        <md-chip
          variant="assist"
          appearance="filled"
          color="error"
          icon="crisis_alert"
          [attr.label]="t('common.showing', { shown: rows.length, total: signals.length })"
        ></md-chip>
      </ng-container>

      <awc-panel [title]="t('action.filter')" [subtitle]="t('table.severity')">
        <div class="row">
          <md-segmented-button-set
            #severitySet
            multiselect
            [attr.aria-label]="t('table.severity')"
            (mdChange)="onSeverityChange($event)"
          >
            @for (severity of severities; track severity) {
              <md-segmented-button
                [attr.value]="severity"
                [attr.label]="t('severity.' + severity)"
              ></md-segmented-button>
            }
          </md-segmented-button-set>

          <md-select
            #sectorSelect
            [attr.label]="t('table.sector')"
            [attr.placeholder]="t('common.all')"
            clearable
            [attr.clear-label]="t('action.clearFilters')"
            (mdChange)="onSectorChange($event)"
          >
            @for (sector of sectors; track sector.id) {
              <md-select-option [attr.value]="sector.id" [attr.label]="t(sector.nameKey)">
                {{ t(sector.nameKey) }}
              </md-select-option>
            }
          </md-select>

          <md-button variant="text" size="sm" icon="filter_alt_off" (click)="clearFilters()">
            {{ t('action.clearFilters') }}
          </md-button>
        </div>
      </awc-panel>

      <awc-panel
        [title]="t('table.signal')"
        [subtitle]="t('common.of', { count: shownCounterparties, total: rows.length })"
      >
        @if (rows.length === 0) {
          <awc-empty-state [message]="t('empty.signals')" [hint]="true" />
        } @else {
          <md-table-container variant="outlined" max-height="60vh">
            <md-table
              [attr.label]="t('screen.watchlist.title')"
              [attr.column-template]="columns"
              [attr.min-width]="minWidth"
              frozen-header
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
                @for (signal of rows; track signal.id) {
                  <md-table-row [attr.value]="signal.id">
                    <md-table-cell>
                      <!-- The severity marker leads the row, beside the
                           obligor's name — the same shape the counterparty
                           table uses for its watchlist dot, so a reader
                           scanning the first column sees the severity without
                           crossing a nine-column table. -->
                      <span class="row" style="gap: var(--md-sys-spacing-gap-xs, 4px)">
                        <md-status-dot awcSeverityDot [severity]="signal.severity"></md-status-dot>
                        <a class="drill" [routerLink]="appPath(route.counterparty(signal.counterpartyId))">
                          {{ signal.counterpartyName }}
                        </a>
                      </span>
                    </md-table-cell>
                    <md-table-cell>
                      <a class="drill" [routerLink]="appPath(route.sector(signal.sectorId))">
                        {{ t('sector.' + signal.sectorId) }}
                      </a>
                    </md-table-cell>
                    <md-table-cell>
                      <!-- The signal row carries the grade but not the band, so
                           the band comes from the rating scale rather than from
                           a second set of thresholds invented here. -->
                      <md-chip awcChip
                        kind="rating"
                        [value]="signal.ratingLabel"
                        [band]="bandFor(signal.grade)"></md-chip>
                    </md-table-cell>
                    <md-table-cell>{{ t(signal.typeKey) }}</md-table-cell>
                    <md-table-cell>
                      <md-chip awcChip kind="severity" [value]="signal.severity"></md-chip>
                    </md-table-cell>
                    <md-table-cell numeric>
                      {{ t.formatCurrency(signal.ead, { notation: 'compact' }) }}
                    </md-table-cell>
                    <md-table-cell>{{ t.formatDate(signal.openedDate, 'medium') }}</md-table-cell>
                    <md-table-cell numeric>
                      <span [attr.title]="t('signal.openFor', { days: signal.daysOpen })">
                        {{ t.formatNumber(signal.daysOpen) }}
                      </span>
                    </md-table-cell>
                    <md-table-cell>{{ signal.owner }}</md-table-cell>
                  </md-table-row>
                }
              </md-table-body>
            </md-table>
          </md-table-container>
        }
      </awc-panel>
    </awc-shell>
  `,
})
export class WatchlistScreen extends ShowcaseComponent {
  @ViewChild('severitySet') private severitySet?: ElementRef<HTMLElement>;
  @ViewChild('sectorSelect') private sectorSelect?: ElementRef<HTMLElement>;

  protected readonly severities = SEVERITIES;
  protected readonly sectors = getSectors();
  protected readonly signals = getWatchlist();
  protected readonly allCounterparties = new Set(this.signals.map((s) => s.counterpartyId)).size;
  protected readonly columns = TABLES.watchlist.columns;
  protected readonly minWidth = TABLES.watchlist.minWidth;

  private selected: SignalSeverity[] = [];
  private sectorId: SectorId | '' = '';

  protected get rows() {
    return this.signals.filter(
      (signal) =>
        (this.selected.length === 0 || this.selected.includes(signal.severity)) &&
        (this.sectorId === '' || signal.sectorId === this.sectorId),
    );
  }

  protected get shownCounterparties(): number {
    return new Set(this.rows.map((signal) => signal.counterpartyId)).size;
  }

  protected get head(): { label: string; numeric?: boolean }[] {
    return [
      { label: this.t('table.counterparty') },
      { label: this.t('table.sector') },
      { label: this.t('table.rating') },
      { label: this.t('table.signal') },
      { label: this.t('table.severity') },
      { label: this.t('table.ead'), numeric: true },
      { label: this.t('table.opened') },
      { label: this.t('table.daysOpen'), numeric: true },
      { label: this.t('table.owner') },
    ];
  }

  protected bandFor(grade: number): string {
    return getRatingGrade(grade)?.band ?? 'speculative';
  }

  protected onSeverityChange(event: Event): void {
    this.selected = ((event as CustomEvent<string[]>).detail ?? []) as SignalSeverity[];
  }

  protected onSectorChange(event: Event): void {
    this.sectorId = ((event as CustomEvent<string>).detail ?? '') as SectorId | '';
  }

  protected clearFilters(): void {
    this.selected = [];
    this.sectorId = '';
    // The custom elements own their own visual state, so the reset has to be
    // pushed back into them; Angular does not re-render an attribute it never set.
    this.severitySet?.nativeElement
      .querySelectorAll('md-segmented-button')
      .forEach((segment) => {
        (segment as unknown as { selected: boolean }).selected = false;
      });
    const select = this.sectorSelect?.nativeElement as unknown as { value: string } | undefined;
    if (select) select.value = '';
  }
}
