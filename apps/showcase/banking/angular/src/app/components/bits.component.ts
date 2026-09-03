import { Component, CUSTOM_ELEMENTS_SCHEMA, Input } from '@angular/core';
import {
  budgetColor,
  categoryIcon,
  flowColor,
  plColor,
  txnTypeIcon,
  type BudgetStatus,
  type Transaction,
} from '@awc-ui/showcase-kit/banking';
import { ShowcaseComponent } from '../lib/screen.base';
import { SparklineComponent } from './sparkline.component';

/**
 * The small, repeated pieces: formatted figures, the chips that carry a domain
 * state, the dots, the meters, and the KPI tile.
 *
 * Every one of them takes a domain value and resolves BOTH halves of it through
 * the kit: the COLOUR through the status maps in `@awc-ui/showcase-kit/banking`,
 * the LABEL through the dictionary key that travels beside the value
 * (`household.strategyKey`, `goal.statusKey`, `order.sideKey`). Nothing here
 * contains English, so nothing here can render English into a translated page.
 *
 * THIS IS THE CONTRACT FOR SCREENS. If you are writing one of the six screens:
 *
 *   - Never call `Intl` and never call `toFixed`. Money goes through
 *     `span[awcMoney]`, ratios through `span[awcPercent]`, signed figures
 *     through `bdi[awcSigned]`, dates through `time[awcDate]`. They are pinned
 *     to the dock's locale and to UTC.
 *   - Never write `status === 'breach' ? 'error' : …`. Use the chip or the dot.
 *   - Never hardcode a chip's `color`. Every mapping is already in the kit.
 *   - A `…Key` field is a dictionary key, not a label. Pass it to `t()`.
 *   - A drill link is the credit-risk Angular idiom, not a component:
 *     `<a class="drill" [routerLink]="appPath(route.household(id))">`.
 *
 * WHY ATTRIBUTE SELECTORS. The React build's bits are wrapperless — `<Money>`
 * IS a `<span class="num">`. An Angular component always renders its own host
 * element, so each of these takes an attribute selector and IS the element it
 * would otherwise wrap: the DOM a screen reader walks, the structural
 * selectors in `app.css` (`.dl > div`, `.with-dot > span`) and the parity
 * check's geometry all stay identical to the other builds'. Wrappers that
 * contain block layout (`KpiTile`, the meters) use `display: contents` hosts
 * instead, per the credit-risk precedent.
 */

/* ------------------------------------------------------------- formatting */

/**
 * A money amount, as `<span awcMoney [value]="x">`.
 *
 * `currency` defaults to EUR because every aggregate in the fixture is in EUR;
 * pass a position's or an order's own `currency` for a local amount. `compact`
 * gives €3.2m — the right choice for a KPI tile or a chart axis, the wrong one
 * for a table cell where the reader is comparing figures digit by digit.
 *
 * A SIGNED money figure is `bdi[awcSigned]`, not a flag here: the kit's
 * `CurrencyOptions` has no `signDisplay`, so composing the `+` is a real piece
 * of work rather than one more option, and it belongs next to the colour
 * decision that goes with it.
 */
@Component({
  selector: 'span[awcMoney]',
  standalone: true,
  host: { class: 'num' },
  template: '{{ text }}',
})
export class MoneyComponent extends ShowcaseComponent {
  @Input({ required: true }) value!: number;
  @Input() currency: string = 'EUR';
  @Input() compact = false;
  /** Force a fraction-digit count. Default: 2 standard, 1 compact. */
  @Input() digits?: number;

  protected get text(): string {
    /*
     * TWO DECIMALS BY DEFAULT in standard notation. The wealth console's
     * default is whole units, right for a book measured in millions. A current
     * account holds €4,218.64, and rendering that as "€4,219" is not a
     * rounding, it is a different balance.
     */
    const places = this.digits ?? (this.compact ? undefined : 2);
    return this.t.formatCurrency(this.value, {
      currency: this.currency,
      notation: this.compact ? 'compact' : 'standard',
      maximumFractionDigits: places,
      minimumFractionDigits: places,
    });
  }
}

/**
 * A ratio, as a percentage: `<span awcPercent [value]="x">`.
 *
 * The value is a FRACTION — `0.0135` renders as `1.35%`. Every ratio in the
 * fixture is stored that way, so pass it straight in and never multiply by 100
 * first.
 */
@Component({
  selector: 'span[awcPercent]',
  standalone: true,
  host: { class: 'num' },
  template: '{{ text }}',
})
export class PercentComponent extends ShowcaseComponent {
  @Input({ required: true }) value!: number;
  @Input() digits = 2;
  /** Prefix a `+` on positives. Use it for drift, excess return and P/L. */
  @Input() sign = false;

  protected get text(): string {
    return this.t.formatPercent(this.value, {
      maximumFractionDigits: this.digits,
      minimumFractionDigits: Math.min(this.digits, 1),
      signDisplay: this.sign ? 'exceptZero' : undefined,
    });
  }
}

/**
 * A signed figure — profit and loss, an excess return, a drift:
 * `<bdi awcSigned [value]="x">`.
 *
 * THE COLOUR IS NEVER THE ONLY CARRIER. The sign is always in the text, and the
 * cell still says which way it went in monochrome (WCAG 1.4.1). `plColor` has a
 * dead band: a move smaller than the rounding scale is neither green nor red.
 *
 * `<bdi>`, NOT `<span>`: the money branch composes its `+` by hand (the kit's
 * `CurrencyOptions` has no `signDisplay`), and a leading `+` is a bidi-NEUTRAL
 * character — under `dir="rtl"` it moves to the other end and `+€1.5m` renders
 * as `€1.5m+`, a different number. `<bdi>` isolates the run. The percent branch
 * does not need it — `Intl` places that sign itself — but one element for both
 * keeps the two from drifting.
 */
@Component({
  selector: 'bdi[awcSigned]',
  standalone: true,
  host: { '[class]': 'hostClass' },
  template: '{{ text }}',
})
export class SignedComponent extends ShowcaseComponent {
  @Input({ required: true }) value!: number;
  /** `money` formats with a currency; `percent` treats the value as a fraction. */
  @Input() kind: 'money' | 'percent' = 'money';
  @Input() currency: string = 'EUR';
  @Input() compact = false;
  @Input() digits?: number;

  protected get hostClass(): string {
    // The dead band is a fraction for percentages and a currency unit for
    // money — half a cent is not a move, but half a euro on a €40m book is not
    // either.
    const color = plColor(this.value, this.kind === 'percent' ? 0.0005 : 1);
    const state = color === 'success' ? 'pl-up' : color === 'error' ? 'pl-down' : 'pl-flat';
    return `num ${state}`;
  }

  protected get text(): string {
    if (this.kind === 'percent') {
      return this.t.formatPercent(this.value, {
        maximumFractionDigits: this.digits ?? 2,
        minimumFractionDigits: Math.min(this.digits ?? 2, 1),
        signDisplay: 'exceptZero',
      });
    }
    // The same two-decimal default as `MoneyComponent`, for the same reason.
    const places = this.digits ?? (this.compact ? undefined : 2);
    return `${this.value > 0 ? '+' : ''}${this.t.formatCurrency(this.value, {
      currency: this.currency,
      notation: this.compact ? 'compact' : 'standard',
      maximumFractionDigits: places,
      minimumFractionDigits: places,
    })}`;
  }
}

/** A plain number: a quantity, a count, a basis-point figure. */
@Component({
  selector: 'span[awcNum]',
  standalone: true,
  host: { class: 'num' },
  template: '{{ text }}',
})
export class NumComponent extends ShowcaseComponent {
  @Input({ required: true }) value!: number;
  @Input() digits = 0;

  protected get text(): string {
    return this.t.formatNumber(this.value, {
      maximumFractionDigits: this.digits,
      minimumFractionDigits: this.digits,
    });
  }
}

/**
 * A count, as a small chip: `<md-chip awcCount [value]="n">`.
 *
 * This is what goes in a KPI tile's foot and beside a panel title — NOT
 * `md-badge`. A badge has to sit on a host it can overlap, and dropped into a
 * card's foot it anchors to the card's corner and is clipped in half. A chip is
 * a standalone element that takes its own space, which is what a count in a row
 * of facts actually is.
 */
@Component({
  selector: 'md-chip[awcCount]',
  standalone: true,
  host: {
    variant: 'assist',
    appearance: 'outlined',
    '[attr.color]': 'color',
    '[attr.label]': 'label',
  },
  template: '',
})
export class CountComponent extends ShowcaseComponent {
  @Input({ required: true }) value!: number;
  @Input() color = 'primary';

  protected get label(): string {
    return this.t.formatNumber(this.value, { maximumFractionDigits: 0 });
  }
}

/**
 * A calendar date: `<time awcDate [value]="iso">`.
 *
 * The machine-readable `datetime` keeps the ISO value even though the visible
 * text is localised. `formatDate` is pinned to UTC in the kit, so 2026-06-30 is
 * 30 June west of Greenwich too.
 */
@Component({
  selector: 'time[awcDate]',
  standalone: true,
  host: { '[attr.datetime]': 'value' },
  template: '{{ text }}',
})
export class DateTextComponent extends ShowcaseComponent {
  @Input({ required: true }) value!: string;
  /* `format`, matching the Vue and Svelte ports — the four are easier to read
     against each other when the prop is called the same thing. */
  @Input() format: 'short' | 'medium' | 'long' | 'monthYear' = 'medium';

  protected get text(): string {
    return this.t.formatDate(this.value, this.format);
  }
}

/** A full UTC instant from the audit trail. The date part is what is shown. */
@Component({
  selector: 'time[awcTimestamp]',
  standalone: true,
  host: { '[attr.datetime]': 'value' },
  template: '{{ text }}',
})
export class TimestampTextComponent extends ShowcaseComponent {
  @Input({ required: true }) value!: string;

  protected get text(): string {
    return this.t.formatDate(this.value.slice(0, 10), 'medium');
  }
}

/* ----------------------------------------------------------------- layout */

/**
 * A `dt`/`dd` pair inside a `.dl` grid: `<div awcFact [label]="…">`.
 *
 * An ATTRIBUTE selector, so the component IS the `<div>` rather than wrapping
 * one. The shared stylesheet targets `.dl > div`, and that is a structural
 * selector — `display: contents` fixes layout but cannot make `.dl > div` match
 * `.dl > awc-fact > div`.
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

/**
 * A status dot beside a name, without the dot pushing the baseline around:
 * `<span awcNameCell><md-status-dot dot awcDot … /> name</span>`.
 */
@Component({
  selector: 'span[awcNameCell]',
  standalone: true,
  host: { class: 'with-dot' },
  template: `
    <ng-content select="[dot]" />
    <span><ng-content /></span>
  `,
})
export class NameCellComponent {}

/* -------------------------------------------------------- search highlight */

/**
 * The regex metacharacters, so a query can be dropped into a pattern.
 * WITHOUT THIS, TYPING `(` THROWS — half the punctuation on a keyboard is
 * syntax to `RegExp`. `$&` in the replacement is the character that matched.
 */
const REGEX_METACHARACTERS = /[.*+?^${}()|[\]\\]/g;

/**
 * The run of `text` a search query matched, wrapped in `<mark>`.
 *
 * FILTERING IS THE KIT'S; SHOWING WHY A ROW SURVIVED IS THE VIEW'S. The
 * selectors match case-insensitively on a TRIMMED query, so this splits on the
 * same trimmed needle with the `i` flag. NEVER BUILT AS AN HTML STRING —
 * `split()` with ONE capture group returns the pieces as strings and the
 * template makes the nodes, so every match is escaped by construction.
 *
 * The mark's colours are a CONTAINER/ON-CONTAINER PAIR, never a literal: the
 * user-agent default (black on yellow) survives into the dark theme. `tertiary`
 * is the accent role this console does not spend on a health state. The
 * element being `<mark>` carries the same fact into the accessibility tree,
 * which is the second carrier WCAG 1.4.1 wants.
 */
@Component({
  selector: 'awc-highlight',
  standalone: true,
  styles: `
    :host {
      display: contents;
    }
    mark {
      background: var(--md-sys-color-tertiary-container);
      color: var(--md-sys-color-on-tertiary-container);
      font-weight: 500;
      /* Inline padding only: padding-block would grow the line box and shift
         the baseline of the one cell in the row that contains a match. */
      padding-inline: 1px;
      border-radius: var(--md-sys-shape-corner-extra-small);
    }
  `,
  template: `
    @for (part of parts; track $index) {
      @if ($index % 2 === 1) {
        <mark>{{ part }}</mark>
      } @else {
        {{ part }}
      }
    }
  `,
})
export class HighlightComponent {
  @Input({ required: true }) text!: string;
  @Input() query?: string;

  protected get parts(): string[] {
    const needle = this.query?.trim() ?? '';
    if (!needle) return [this.text];
    // One capture group makes the result alternate: even indices are the text
    // between matches, odd indices are the matches themselves.
    return this.text.split(
      new RegExp(`(${needle.replace(REGEX_METACHARACTERS, '\\$&')})`, 'gi'),
    );
  }
}

/* --------------------------------------------------------------- KPI tile */

/**
 * A KPI tile: label, figure, its own sparkline, and a footnote.
 *
 * `value` and `hint` are projected (`[value]`, `[hint]`) so a screen can put a
 * `span[awcMoney]` or `bdi[awcSigned]` inside them, exactly as the React build
 * passes nodes. `hasFoot` gates the foot row because Angular cannot ask whether
 * a slot received content — set it when passing `[hint]` or `[trailing]`.
 *
 * `[trailing]` must be a `md-chip[awcCount]`, never a bare `md-badge`: a badge
 * anchors absolutely against the nearest positioned ancestor and translates
 * itself past that ancestor's corner, so dropped in here it lands on the
 * card's top-right corner and is sliced in half by the card's own
 * `overflow: hidden`.
 */
@Component({
  selector: 'awc-kpi-tile',
  standalone: true,
  styles: ':host { display: contents; }',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [SparklineComponent],
  template: `
    <md-card variant="filled" full-width>
      <div class="kpi">
        <p class="kpi__label">{{ label }}</p>
        <p class="kpi__value"><ng-content select="[value]" /></p>
        @if (trend && trend.length > 1) {
          <div class="kpi__spark">
            <awc-sparkline
              [data]="trend"
              [labels]="trendLabels"
              [valueFormatter]="formatTrend"
              [color]="color"
            />
          </div>
        }
        @if (hasFoot) {
          <div class="kpi__foot">
            <span><ng-content select="[hint]" /></span>
            <ng-content select="[trailing]" />
          </div>
        }
      </div>
    </md-card>
  `,
})
export class KpiTileComponent {
  @Input({ required: true }) label!: string;
  /** Historical values for the sparkline, oldest first. */
  @Input() trend?: number[];
  /** Tooltip x labels — month ends, already formatted. */
  @Input() trendLabels?: string[];
  /** Build with `memo()` keyed on the locale — it closes over the translator. */
  @Input() formatTrend?: (value: number | null) => string;
  /** One of the md colour roles. Use a `status.ts` map, not a guess. */
  @Input() color = 'primary';
  /** Set when projecting `[hint]` or `[trailing]` content. */
  @Input() hasFoot = false;
}

/**
 * A fraction against a cap, as a labelled linear meter.
 *
 * `md-meter` is for a read-only value in a known range — a funded percentage, a
 * weight, a coverage ratio. It is NOT a progress indicator: nothing here is
 * loading.
 */
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
      [attr.thickness]="thickness"
      [attr.label]="label"
      show-label
      show-value
      [attr.value-text]="t.formatPercent(fraction, { maximumFractionDigits: 1 })"
    ></md-meter>
  `,
})
export class RatioMeterComponent extends ShowcaseComponent {
  @Input({ required: true }) label!: string;
  /** A fraction. Clamped into 0…`max` for the bar; the text keeps the real value. */
  @Input({ required: true }) fraction!: number;
  @Input({ required: true }) color!: string;
  @Input() max = 1;
  @Input() thickness = 10;

  protected get clamped(): number {
    return Math.max(0, Math.min(this.max, this.fraction)) * 100;
  }
}


/**
 * Every chip in the app: `<md-chip awcChip [labelKey]="…" [color]="…">`.
 *
 * ONE COMPONENT, ONE MAPPING TABLE, so a category is the same colour in the
 * ring, the statement row and the budget meter. A screen names the domain value
 * and resolves the colour through `status.ts` — it never picks one itself.
 *
 * An attribute selector on `md-chip` rather than a wrapper element, so the
 * custom element is the host and no extra box enters the layout.
 */
@Component({
  selector: 'md-chip[awcChip]',
  standalone: true,
  host: {
    variant: 'assist',
    '[attr.appearance]': 'appearance',
    '[attr.color]': 'color',
    '[attr.label]': 'label',
    '[attr.icon]': 'icon ?? null',
  },
  template: '',
})
export class ChipComponent extends ShowcaseComponent {
  @Input({ required: true }) labelKey!: string;
  @Input({ required: true }) color!: string;
  @Input() icon?: string;
  @Input() appearance = 'outlined';

  protected get label(): string {
    return this.t(this.labelKey);
  }
}

/**
 * A signed movement, coloured by DIRECTION rather than by sentiment.
 *
 * Credits are green; debits are the ordinary body colour. A statement where
 * every purchase is red is unreadable after four rows.
 *
 * `bdi` is load-bearing: the `+` is composed by hand because the kit's
 * `CurrencyOptions` has no `signDisplay`, and a leading `+` is a bidi-NEUTRAL
 * character that RTL would move to the other end of the number.
 */
@Component({
  selector: 'bdi[awcFlow]',
  standalone: true,
  host: { '[class]': 'classes' },
  template: '{{ text }}',
})
export class FlowComponent extends ShowcaseComponent {
  @Input({ required: true }) value!: number;
  @Input() currency: string = 'EUR';
  @Input() compact = false;

  protected get classes(): string {
    return flowColor(this.value) === 'success' ? 'num pl-up' : 'num';
  }

  protected get text(): string {
    return `${this.value > 0 ? '+' : ''}${this.t.formatCurrency(this.value, {
      currency: this.currency,
      notation: this.compact ? 'compact' : 'standard',
      maximumFractionDigits: this.compact ? undefined : 2,
      minimumFractionDigits: this.compact ? undefined : 2,
    })}`;
  }
}

/** A budget's usage. Clamped bar, uncapped text — 115% reads as 115%. */
@Component({
  selector: 'awc-budget-meter',
  standalone: true,
  imports: [RatioMeterComponent],
  styles: ':host { display: contents; }',
  template: `
    <awc-ratio-meter [label]="t('banking.kpi.budgetUsed')" [fraction]="fraction" [color]="colour" />
  `,
})
export class BudgetMeterComponent extends ShowcaseComponent {
  @Input({ required: true }) fraction!: number;
  @Input({ required: true }) status!: BudgetStatus;

  protected get colour(): string {
    return budgetColor[this.status];
  }
}

/**
 * A vault's progress towards its goal.
 *
 * Always `primary`: saving towards something is not a state that can go wrong,
 * so there is no colour to earn. A vault at 12% is not a problem.
 */
@Component({
  selector: 'awc-vault-meter',
  standalone: true,
  imports: [RatioMeterComponent],
  styles: ':host { display: contents; }',
  template: '<awc-ratio-meter [label]="label" [fraction]="fraction" color="primary" [thickness]="8" />',
})
export class VaultMeterComponent {
  @Input({ required: true }) fraction!: number;
  @Input({ required: true }) label!: string;
}

/**
 * One statement line, shared by four screens.
 *
 * THE LEADING GLYPH IS THE CATEGORY, via the row's own `leading-icon` — there
 * is no `md-icon` element in this library. A reader scanning a statement looks
 * for "the supermarket", not "a card payment".
 *
 * `showDate` is false inside a day group, where the heading already states it.
 *
 * NO STATUS DOT: `md-status-dot` anchors absolutely to a positioned parent's
 * bottom-end corner, which lands across the last two digits of a currency
 * figure. `data-status` on the row drives the treatment from `app.css`.
 */
@Component({
  /*
   * AN ATTRIBUTE SELECTOR ON `md-list-item`, not a wrapper element — and that
   * is behavioural, not cosmetic. A wrapping `<awc-statement-row>` sits between
   * the `md-list` and the `md-list-item` in the DOM, so the list no longer sees
   * the row as its own child and cannot push its interaction mode down:
   * measured, every row resolved to `single-action` where React's resolved to
   * `multi-action`. `display: contents` does not help — it changes layout, not
   * the tree. The other bits in this file take attribute selectors for the same
   * reason.
   */
  selector: 'md-list-item[awcStatementRow]',
  standalone: true,
  imports: [FlowComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  host: {
    '[attr.headline]': 'txn.counterparty',
    '[attr.overline]': "showDate ? t.formatDate(txn.date, 'medium') : null",
    '[attr.supporting-text]': 'meta',
    '[attr.lines]': "showDate ? '3' : '2'",
    '[attr.data-status]': 'txn.status',
    '[attr.leading-icon]': 'glyph',
  },
  template: `
    <span slot="trailing" class="account-row__figures">
      <span class="txn-row__amount">
        <bdi awcFlow [value]="txn.amount" [currency]="txn.currency"></bdi>
      </span>
      @if (txn.currency !== 'EUR') {
        <span class="muted"><bdi awcFlow [value]="txn.amountEur"></bdi></span>
      }
    </span>
  `,
})
export class StatementRowComponent extends ShowcaseComponent {
  @Input({ required: true }) txn!: Transaction;
  @Input() showDate = true;

  protected get meta(): string {
    const parts = [this.t(this.txn.typeKey), this.t(this.txn.categoryKey)];
    if (this.txn.status !== 'completed') parts.push(this.t(this.txn.statusKey));
    return parts.join(' · ');
  }

  protected get glyph(): string {
    return categoryIcon[this.txn.category] ?? txnTypeIcon[this.txn.type];
  }
}
