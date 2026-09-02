import { Component, Input } from '@angular/core';

/**
 * The placeholder shapes every screen shows while it settles.
 *
 * PLAIN DOM, NOT `md-skeleton`. Every shape here is a `<div class="skel">`
 * styled from tokens in `app.css`, and that is the single most important thing
 * about this file: `md-skeleton` and `md-card` are lazily-hydrated custom
 * elements exactly like the content they stand in for, so a placeholder built
 * from them catches the same disease it is there to treat — measured on the
 * React build's holdings screen, such a placeholder was 172px tall for three
 * frames, 228px for one more, and only then its real 1986. Divs have their size
 * in the first paint, before a chunk has loaded, which is the only property a
 * placeholder actually needs.
 *
 * THE PLACEHOLDER DOES NOT HAVE TO BE THE RIGHT HEIGHT. It is absolutely
 * positioned over the real content, which keeps its own box the whole time (see
 * `ScreenComponent`), so revealing is a `visibility` flip with no reflow. The
 * heights below are still MEASURED rather than invented — copied from the React
 * build's skeletons — because the shape should look like what is coming.
 *
 * THE BEAT IS A CONSTANT, NEVER A MEASURED DURATION. These screens read
 * synchronous selectors out of the kit — there is no network here, and the
 * pause exists to demonstrate the pattern rather than to cover a real wait. A
 * clock-derived or random delay would also make two runs of the showcase
 * disagree, which the cross-framework parity check cannot tolerate.
 *
 * Exactly ONE shape per skeleton announces (`role="status"`), with the screen
 * name — more would be a chorus.
 */

/**
 * How long the placeholder layout is shown for, in milliseconds.
 *
 * Long enough to be seen — below ~300ms a placeholder only flashes — and short
 * enough not to be in the way. `?skeleton=hold` or `?skeleton=<ms>` overrides
 * it for inspection; see `ScreenComponent`.
 */
export const SKELETON_MS = 550;

/**
 * One placeholder bar with a corner of its own.
 *
 * A single `border-radius` for everything would be wrong in both directions:
 * measured off the real holdings filter bar, `md-search` is a 9999px pill, an
 * outlined text field is 4px, `md-chip` is 8px and `md-split-button` is 20px.
 *
 * `flex` is how a bar takes the SAME share of a `.row` its control does — the
 * fields in that bar are laid out by `flex: 1 1 260px` and friends, and a
 * placeholder that guessed a percentage instead would break at the first
 * breakpoint.
 */
@Component({
  selector: 'awc-skel-bar',
  standalone: true,
  styles: ':host { display: contents; }',
  template: `
    <div
      class="skel"
      [style.block-size]="height"
      [style.inline-size]="width ?? (flex ? null : '100%')"
      [style.border-radius]="radius"
      [style.flex]="flex ?? null"
    ></div>
  `,
})
export class SkelBarComponent {
  /** A CSS length. The control's own corner, measured, not a guess. */
  @Input({ required: true }) radius!: string;
  @Input({ required: true }) height!: string;
  /** Omit to let the bar fill its box. */
  @Input() width?: string;
  @Input() flex?: string;
}

/**
 * A KPI tile's shape: label line, value line, optional sparkline, foot line.
 *
 * The heights are the tile's OWN, measured off a rendered `KpiTile`: a 16px
 * label, a 32px value, a 34px sparkline, and a foot of 16 or 32 — a foot
 * carrying a bare hint is one 16px text line; a foot carrying a chip beside
 * that text is 32, because the chip is 32.
 */
@Component({
  selector: 'awc-kpi-skeleton',
  standalone: true,
  styles: ':host { display: contents; }',
  template: `
    <div class="skel-card skel-card--filled">
      <div class="kpi">
        <div
          class="skel"
          style="block-size: 16px; inline-size: 60%"
          [attr.role]="announce ? 'status' : null"
          [attr.aria-label]="announce ? label : null"
        ></div>
        <div class="skel" style="block-size: 32px; inline-size: 45%"></div>
        @if (spark) {
          <div class="kpi__spark">
            <div class="skel" style="block-size: 34px; inline-size: 100%"></div>
          </div>
        }
        <div class="skel" [style.block-size]="foot" style="inline-size: 70%"></div>
      </div>
    </div>
  `,
})
export class KpiSkeletonComponent {
  @Input() announce = false;
  @Input() label?: string;
  /** `spark` is what the tile actually has, not decoration. */
  @Input() spark = true;
  /** `'32px'` when the real tile's foot holds a chip, `'16px'` when it is text alone. */
  @Input() foot = '32px';
}

/** A panel's shape: a head, then one block the size the real content will be. */
@Component({
  selector: 'awc-panel-skeleton',
  standalone: true,
  styles: ':host { display: contents; }',
  template: `
    <div class="skel-card panel">
      <div class="panel__inner">
        <div class="panel__head">
          <div class="skel" style="block-size: 20px; inline-size: 140px"></div>
          <div class="skel" style="block-size: 20px; inline-size: 60px"></div>
        </div>
        @if (height) {
          <div class="skel" [style.block-size]="height" style="inline-size: 100%"></div>
        }
        @for (line of lineIndexes; track line) {
          <div
            class="skel"
            style="block-size: 16px"
            [style.inline-size]="line === lines - 1 ? '60%' : '100%'"
          ></div>
        }
      </div>
    </div>
  `,
})
export class PanelSkeletonComponent {
  @Input() height?: string;
  @Input() lines = 0;

  protected get lineIndexes(): number[] {
    return Array.from({ length: this.lines }, (_, i) => i);
  }
}

/**
 * A table's shape: the panel head, then one block where the rows will be.
 *
 * One block rather than a row of bars: a table's rows are uniform, and N
 * stacked bars at row height is the same grey rectangle with more elements in
 * the accessibility tree. `height` overrides the row arithmetic (40px a row)
 * when the real table's height is known and is not a whole number of rows — a
 * pagination bar, a toolbar with a wrapped filter row.
 */
@Component({
  selector: 'awc-table-skeleton',
  standalone: true,
  styles: ':host { display: contents; }',
  template: `
    <div class="table-host">
      <div class="skel-card panel">
        <div class="panel__inner">
          <div class="panel__head">
            <div class="skel" style="block-size: 20px; inline-size: 120px"></div>
            <div class="skel" style="block-size: 20px; inline-size: 220px"></div>
          </div>
          <div class="skel" [style.block-size]="blockSize" style="inline-size: 100%"></div>
        </div>
      </div>
    </div>
  `,
})
export class TableSkeletonComponent {
  @Input() rows = 8;
  @Input() height?: string;

  protected get blockSize(): string {
    return this.height ?? `${this.rows * 40}px`;
  }
}

/**
 * The shape a screen gets when it has not described its own.
 *
 * IT IS NOT THE COMMON CASE, and that is the point: every real screen passes
 * its own measured skeleton to `<awc-screen>`, because "a KPI row and two
 * panels" is none of their real layouts. What is left on this fallback is the
 * not-found screen, the household guard — and the six STUBS this scaffold
 * ships, each of which will bring its own skeleton when it is ported. Treat a
 * screen reaching this as one that has not been measured yet.
 */
@Component({
  selector: 'awc-screen-skeleton',
  standalone: true,
  imports: [KpiSkeletonComponent, PanelSkeletonComponent],
  styles: ':host { display: contents; }',
  template: `
    @if (kpis > 0) {
      <section class="kpi-grid">
        @for (i of kpiIndexes; track i) {
          <awc-kpi-skeleton [announce]="i === 0" [label]="label" />
        }
      </section>
    }

    <section class="grid-2">
      @for (i of panelIndexes; track i) {
        <awc-panel-skeleton [lines]="8" />
      }
    </section>
  `,
})
export class ScreenSkeletonComponent {
  @Input() kpis = 4;
  @Input() panels = 2;
  @Input() label?: string;

  protected get kpiIndexes(): number[] {
    return Array.from({ length: this.kpis }, (_, i) => i);
  }

  protected get panelIndexes(): number[] {
    return Array.from({ length: this.panels }, (_, i) => i);
  }
}
