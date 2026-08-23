import { Component, CUSTOM_ELEMENTS_SCHEMA, Input } from '@angular/core';
import type {
  Covenant,
  CovenantStatus,
  FacilityStatus,
  RatingBand,
  SignalSeverity,
} from '@awc-ui/showcase-kit/data';
import {
  bandColor,
  covenantColor,
  covenantDot,
  facilityColor,
  severityColor,
  severityDot,
  watchlistDot,
} from '@awc-ui/showcase-kit/credit-risk';
import { ShowcaseComponent } from '../lib/screen.base';

/**
 * The small, repeated pieces, in one file.
 *
 * The React build has a `bits.tsx` full of one-line components because a React
 * component is a function call and costs nothing to declare. An Angular
 * component is a decorated class with its own template and imports, and eight
 * files that each render a single `<md-chip>` with a different colour lookup
 * would be more ceremony than the thing they wrap. So they share a module, and
 * the two that vary by domain value take a `kind`.
 *
 * Every one resolves BOTH halves of a domain value through the kit: the colour
 * through the status maps in `@awc-ui/showcase-kit/credit-risk`, the label
 * through the dictionary key that travels beside the value. Nothing here
 * contains English, so nothing here can render English into a Romanian page.
 *
 * EVERY WRAPPER SETS `display: contents` ON ITS HOST. The shared stylesheet is
 * written for the DOM the other five builds emit — `.dl > div`, `.grid-2` whose
 * children are cards, flex children of `.row`. An Angular component always
 * renders its own host element, so without this every one of these would insert
 * an extra box between a layout container and the thing it lays out, and the six
 * builds would stop being screenshot-comparable. `display: contents` makes the
 * host vanish from layout while keeping it in the DOM. Where even that is not
 * enough — a structural `>` selector cannot be rescued by a layout property —
 * the component takes an attribute selector instead and IS the element it would
 * otherwise wrap. `ChipComponent`, `DotComponent`, `SeverityDotComponent` and
 * `FactComponent` are all that shape, and each has its reason written above it.
 */

@Component({
  selector: 'md-chip[awcChip]',
  standalone: true,
  /*
   * An ATTRIBUTE selector on `md-chip` itself, so this component IS the chip
   * rather than wrapping one. `display: contents` would have hidden a wrapper
   * from layout, but not from the DOM — and the DOM is what a screen reader
   * walks. A chip nested inside a wrapper element is no longer the SIBLING of the
   * status dot beside it, which is exactly the relationship the watchlist row
   * depends on: the dot is decorative because the chip next to it carries the
   * word. The repo's own a11y regression check found this, on Angular alone,
   * while the page looked identical.
   */
  host: {
    variant: 'assist',
    '[attr.appearance]': 'appearance',
    '[attr.color]': 'color',
    '[attr.label]': 'label',
    '[attr.title]': 'title',
  },
  template: '',
})
export class ChipComponent extends ShowcaseComponent {
  @Input({ required: true }) kind!: 'rating' | 'covenant' | 'facility' | 'severity';
  /** The domain value: a RatingLabel, CovenantStatus, FacilityStatus or SignalSeverity. */
  @Input({ required: true }) value!: string;
  /** Rating only: the band that decides the colour, and the numeric grade. */
  @Input() band?: string;
  @Input() grade?: number;

  protected get color(): string {
    if (this.kind === 'rating') return bandColor[this.band as RatingBand];
    if (this.kind === 'covenant') return covenantColor[this.value as CovenantStatus];
    if (this.kind === 'facility') return facilityColor[this.value as FacilityStatus];
    return severityColor[this.value as SignalSeverity];
  }

  // The facility chip is the only outlined one — a facility status sits in a
  // table beside a rating chip, and two filled chips per row is a wall of colour
  // that stops any of them meaning anything.
  protected get appearance(): string {
    return this.kind === 'facility' ? 'outlined' : 'filled';
  }

  protected get label(): string {
    if (this.kind === 'rating') {
      const name = this.t(`rating.${this.value}`);
      return this.grade == null ? name : `${name} · ${this.grade}`;
    }
    if (this.kind === 'covenant') return this.t(`covenantStatus.${this.value}`);
    if (this.kind === 'facility') return this.t(`facilityStatus.${this.value}`);
    return this.t(`severity.${this.value}`);
  }

  protected get title(): string | null {
    return this.kind === 'rating' ? this.t(`ratingBand.${this.band}`) : null;
  }
}

/**
 * The status dots. `inline` on every one: without it `md-status-dot` is a block,
 * and a dot set beside a word sits on its own baseline a few pixels low.
 *
 * The `severity` dot carries NO label, and that is the interesting one. It is
 * rendered immediately beside a chip holding the same word, so naming it too
 * makes every watchlist row announce the severity twice. Unlabelled,
 * `md-status-dot` falls back to `role="presentation"` + `aria-hidden`, which is
 * what a decorative mark sitting next to its own label should be. The `watch`
 * dot stands alone, so its label is the only word available and it keeps one.
 */
@Component({
  selector: 'md-status-dot[awcDot]',
  standalone: true,
  /* An attribute selector, for the same reason the chip above has one. */
  host: {
    inline: '',
    '[attr.state]': 'state',
    '[attr.size]': 'size',
    '[attr.label]': 'label',
  },
  template: '',
})
export class DotComponent extends ShowcaseComponent {
  @Input({ required: true }) kind!: 'watch' | 'covenant' | 'severity';
  @Input({ required: true }) value!: string | boolean;

  protected get state(): string {
    if (this.kind === 'watch') return watchlistDot(Boolean(this.value));
    if (this.kind === 'covenant') return covenantDot[this.value as CovenantStatus];
    return severityDot[this.value as SignalSeverity];
  }

  protected get size(): string {
    return this.kind === 'watch' ? 'medium' : 'small';
  }

  protected get label(): string | null {
    if (this.kind === 'watch') {
      return this.value ? this.t('kpi.watchlist') : this.t('facilityStatus.performing');
    }
    if (this.kind === 'covenant') return this.t(`covenantStatus.${this.value}`);
    return null;
  }
}

/**
 * The severity marker beside the counterparty's name, at the head of the row.
 *
 * IT CARRIES A LABEL, and that is the whole difference from the dot that used
 * to sit inside the severity cell. That one was decorative on purpose: the chip
 * immediately beside it held the same word, so naming both announced the
 * severity twice per row. Here the dot stands alone at the other end of the
 * row, so an unlabelled one would leave its colour as the only carrier of
 * meaning — exactly the failure `md-status-dot`'s `label` exists to prevent.
 *
 * An attribute selector, like the chip and dot above, so the component IS the
 * element rather than wrapping one.
 */
@Component({
  selector: 'md-status-dot[awcSeverityDot]',
  standalone: true,
  host: {
    inline: '',
    '[attr.state]': 'state',
    size: 'small',
    '[attr.label]': 'label',
  },
  template: '',
})
export class SeverityDotComponent extends ShowcaseComponent {
  @Input({ required: true }) severity!: SignalSeverity;

  protected get state(): string {
    return severityDot[this.severity];
  }

  protected get label(): string {
    return this.t(`severity.${this.severity}`);
  }
}

/** Concentration or utilisation against a cap, as a labelled linear meter. */
@Component({
  selector: 'awc-ratio-meter',
  standalone: true,
  styles: ':host { display: contents; }',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <md-meter
      [attr.value]="clamped"
      min="0"
      [attr.max]="max * 100"
      [attr.color]="color"
      thickness="10"
      [attr.label]="label"
      show-label
      show-value
      [attr.value-text]="t.formatPercent(fraction, { maximumFractionDigits: 1 })"
    ></md-meter>
  `,
})
export class RatioMeterComponent extends ShowcaseComponent {
  @Input({ required: true }) label!: string;
  @Input({ required: true }) fraction!: number;
  @Input({ required: true }) color!: string;
  @Input() max = 1;

  protected get clamped(): number {
    return Math.max(0, Math.min(this.max, this.fraction)) * 100;
  }
}

/**
 * One covenant, as a headroom meter.
 *
 * `headroomPct` is a SIGNED fraction of the threshold and can be negative — a
 * breach. `md-meter` has no negative range, so the bar shows headroom clamped
 * into 0…50% of threshold and the sign is carried by the colour, the status chip
 * and the signed percentage text. Reading the bar alone never tells you a
 * breached covenant is fine: at a breach the bar is empty AND red.
 */
@Component({
  selector: 'awc-covenant-meter',
  standalone: true,
  styles: ':host { display: contents; }',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [ChipComponent],
  template: `
    <div class="covenant">
      <div class="covenant__head">
        <h3 class="covenant__name">{{ t(covenant.nameKey + '.abbr') }}</h3>
        <md-chip awcChip kind="covenant" [value]="covenant.status"></md-chip>
      </div>
      <md-meter
        [attr.value]="clamped"
        min="0"
        max="50"
        [attr.color]="color"
        thickness="8"
        [attr.label]="t('table.headroom')"
        show-label
        [attr.value-text]="headroomText"
        show-value
      ></md-meter>
      <div class="covenant__figures">
        <span>{{ t('table.direction') }}: {{ t('covenantDirection.' + covenant.direction) }}</span>
        <span class="num">
          {{ t('table.threshold') }}:
          {{ t.formatNumber(covenant.threshold, { maximumFractionDigits: 2 }) }}
        </span>
        <span class="num">
          {{ t('table.current') }}:
          {{ t.formatNumber(covenant.currentValue, { maximumFractionDigits: 2 }) }}
        </span>
        <span>{{ t('table.nextTest') }}: {{ t.formatDate(covenant.nextTestDate, 'medium') }}</span>
        <span>{{ t(covenant.frequencyKey) }}</span>
      </div>
    </div>
  `,
})
export class CovenantMeterComponent extends ShowcaseComponent {
  @Input({ required: true }) covenant!: Covenant;

  protected get color(): string {
    return covenantColor[this.covenant.status];
  }

  protected get clamped(): number {
    return Math.max(0, Math.min(50, this.covenant.headroomPct * 100));
  }

  protected get headroomText(): string {
    return this.t.formatPercent(this.covenant.headroomPct, {
      maximumFractionDigits: 1,
      signDisplay: 'exceptZero',
    });
  }
}

/**
 * A KPI tile: label, figure, its own eight-point sparkline, and a footnote.
 *
 * The badge is projected rather than an input, because the only tile that has
 * one wants a `<md-badge>` anchored beside a `<md-button>`.
 */
@Component({
  selector: 'awc-kpi-tile',
  standalone: true,
  styles: ':host { display: contents; }',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [],
  template: `
    <md-card variant="filled" full-width>
      <div class="kpi">
        <p class="kpi__label">{{ label }}</p>
        <p class="kpi__value">{{ value }}</p>
        @if (trend && trend.length > 1) {
          <div class="kpi__spark">
            <ng-content select="[spark]" />
          </div>
        }
        @if (hint) {
          <div class="kpi__foot"><span>{{ hint }}</span></div>
        }
      </div>
    </md-card>
  `,
})
export class KpiTileComponent {
  @Input({ required: true }) label!: string;
  @Input({ required: true }) value!: string;
  @Input() hint?: string;
  /** Only used to decide whether the sparkline slot is rendered. */
  @Input() trend?: number[];
}

/**
 * A `dt`/`dd` pair inside a `.dl` grid.
 *
 * An ATTRIBUTE selector, so the component IS the `<div>` rather than wrapping
 * one. The shared stylesheet targets `.dl > div`, and that is a structural
 * selector — `display: contents` fixes layout but cannot make `.dl > div` match
 * `.dl > awc-fact > div`. Used as `<div awcFact [label]="…">`.
 */
@Component({
  selector: 'div[awcFact]',
  standalone: true,
  template: `
    <dt>{{ label }}</dt>
    <dd><ng-content /></dd>
  `,
})
export class FactComponent {
  @Input({ required: true }) label!: string;
}
