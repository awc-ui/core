import {
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  ViewChild,
  type AfterViewInit,
  type OnChanges,
  type OnDestroy,
  type SimpleChanges,
} from '@angular/core';
import {
  BASE_CURRENCY,
  getInstrumentById,
  getInstruments,
  getOrders,
  getPortfolioById,
  getPortfolios,
  orderEstimate,
  REPORTING_DATE,
  type Instrument,
  type Order,
  type OrderEstimate,
  type OrderSide,
  type OrderType,
  type Portfolio,
  type TimeInForce,
} from '@awc-ui/showcase-kit/wealth';
import { intlTag } from '@awc-ui/showcase-kit/i18n';
import { ShowcaseComponent } from '../lib/screen.base';
import { PanelComponent } from '../components/panel.component';
import {
  ChipComponent,
  FactComponent,
  MoneyComponent,
  NumComponent,
  SignedComponent,
} from '../components/bits.component';

/**
 * The order ticket: pick a side, an instrument, a mandate and a size, watch the
 * estimate move, then confirm and send. Ported from the React build's
 * `TradeTicket.tsx`.
 *
 * THE ONE PIECE OF ARITHMETIC ON THIS SCREEN IS NOT ON THIS SCREEN.
 * `orderEstimate()` in the kit snaps the quantity to the instrument's lot size,
 * strikes the price at the limit or the last close, converts at the frozen
 * fixture FX rate, reports the weight the trade would add to the mandate, and
 * says whether a buy exceeds the mandate's cash. Every figure below is a field
 * of the object it returns. A change handler that multiplied a price by a
 * quantity would be a second formula, and five ports would eventually disagree
 * about what a ticket is worth.
 *
 * WHY THE FORM IS A REAL `<form>`. `md-autocomplete`, `md-select` and
 * `md-number-field` are all form-associated through `ElementInternals`, so
 * `required` on them genuinely blocks `requestSubmit()` and reports the missing
 * field. `md-split-button` is not form-associated and has no `type`, so its
 * `mdLeadingClick` calls `requestSubmit()` on the form rather than pretending
 * to be a submit button. The flow therefore has two independent gates that
 * agree: the soft-disabled state PREDICTS the block (and a tooltip says why),
 * and constraint validation ENFORCES it.
 *
 * WHY THE NUMBER FIELDS ARE NOT BOUND. `md-number-field` treats a programmatic
 * `value` write as a commit: it reformats the display. A value binding
 * re-written each change-detection pass would regroup the digits under the
 * caret while the user types `1234` into `1,234`. So no template binding
 * touches `value` — the app writes the property IMPERATIVELY, exactly when it
 * means to own the content: on mount, on a clear, and when the instrument
 * changes. That is the React build's `seed` counter, kept here under the same
 * name so the two files read side by side; the limit field re-seeds itself from
 * the `seed` input in `ngOnChanges`.
 *
 * THREE COMPOSITION RULES THIS FILE IS BUILT AROUND (§7 of `main-llm.md`):
 *   - `md-split-button` renders no menu. The trailing half emits
 *     `mdTrailingClick`; this file owns the `md-menu`, anchors it by id, and
 *     puts `trailingChecked` back to false from the menu's own `mdClose` —
 *     which neither bubbles nor composes, so the listener sits on the menu.
 *   - A soft-disabled action is paired with an `md-tooltip` that says WHY
 *     (§7.2). `disabled` on the tooltip switches the explanation off once the
 *     block clears, so a usable button never carries a description of its own
 *     unavailability.
 *   - There is exactly ONE dialog, and nothing opens another from inside it.
 *     The confirmation and the progress indicator share it (§7.3).
 */

/* ---------------------------------------------------------------- the state */

export interface Ticket {
  side: OrderSide;
  instrumentId: string;
  portfolioId: string;
  /** `null` is an empty field — the value `md-number-field` reports. */
  quantity: number | null;
  orderType: OrderType;
  limitPrice: number | null;
  timeInForce: TimeInForce;
}

const SIDES: readonly OrderSide[] = ['buy', 'sell'];
const ORDER_TYPES: readonly OrderType[] = ['market', 'limit', 'stop-limit'];
const TIME_IN_FORCE: readonly TimeInForce[] = ['day', 'gtc', 'ioc', 'fok'];

/**
 * How long the round trip to the desk takes.
 *
 * A CONSTANT, not a random or clock-derived interval: two runs of this screen
 * have to behave identically for a cross-framework comparison to mean
 * anything. It gates an animation and nothing that is rendered as a value.
 */
const SUBMIT_MS = 900;

/** `market` is struck at the last close; the other two carry a price. */
function needsLimit(orderType: OrderType): boolean {
  return orderType !== 'market';
}

/** The element methods used imperatively here. All of them are async. */
type PopupElement = HTMLElement & {
  show?: (options?: unknown) => Promise<void>;
  close?: () => Promise<void>;
  trailingChecked?: boolean;
  focusInput?: () => Promise<void>;
};

type NumberFieldElement = HTMLElement & { value: number | null };

/* ------------------------------------------------------------- limit price */

/**
 * The limit price, mounted only for the order types that carry one.
 *
 * Its own component because it comes and goes with the order type, and the
 * mount is where its seed happens: `ngAfterViewInit` writes the current value
 * into the element (a field that appears after a trip through `market` must
 * show the price in state, which for a fresh mount is `null`), and a `seed`
 * bump from the parent re-writes it. `value` is seeded rather than bound — see
 * the note at the top of this file about `md-number-field` treating a
 * programmatic write as a commit.
 */
@Component({
  selector: 'awc-trade-limit-field',
  standalone: true,
  styles: ':host { display: contents; }',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <!--
      BOTH value events, and the second one is not redundant. mdInput reports
      every move including typing, but a TYPED value is clamped at the commit —
      blur or Enter — and that clamp arrives as mdChange. Type -5 into a field
      with min="0" and mdInput says −5 while the box ends up showing 0; without
      the commit listener the estimate would go on pricing a quantity nothing
      on screen displays.
    -->
    <md-number-field
      #field
      name="limit"
      variant="outlined"
      required
      [attr.label]="t('wealth.table.limitPrice')"
      [attr.locale]="locale"
      min="0"
      step="0.01"
      small-step="0.01"
      large-step="1"
      [attr.increment-label]="t('wealth.action.next')"
      [attr.decrement-label]="t('wealth.action.back')"
      [attr.value-missing-label]="t('wealth.trade.needLimit')"
      [attr.format-options]="formatOptions"
      [attr.supporting-text]="supportingText"
      reserve-supporting-space
      (mdInput)="onValue($event)"
      (mdChange)="onValue($event)"
    ></md-number-field>
  `,
})
export class LimitFieldComponent extends ShowcaseComponent implements AfterViewInit, OnChanges {
  /** Bumped by the parent when the app should own the field's content. */
  @Input({ required: true }) seed!: number;
  @Input({ required: true }) value!: number | null;
  @Input() instrument?: Instrument;
  @Input({ required: true }) locale!: string;

  @Output() readonly valueChange = new EventEmitter<number | null>();

  @ViewChild('field') private fieldEl?: ElementRef<NumberFieldElement>;
  private viewReady = false;

  ngAfterViewInit(): void {
    this.viewReady = true;
    this.write();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (this.viewReady && changes['seed']) this.write();
  }

  private write(): void {
    const el = this.fieldEl?.nativeElement;
    if (el) el.value = this.value;
  }

  protected onValue(event: Event): void {
    this.valueChange.emit((event as CustomEvent<{ value: number | null }>).detail.value);
  }

  /*
   * `format-options` takes a JSON attribute as well as the object property, and
   * the attribute form re-renders with the instrument — so the field is always
   * denominated in the security's own currency rather than the mandate's
   * reporting currency.
   */
  protected get formatOptions(): string {
    return JSON.stringify({
      style: 'currency',
      currency: this.instrument?.currency ?? BASE_CURRENCY,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  protected get supportingText(): string {
    return this.instrument
      ? `${this.t('wealth.table.price')} · ${this.t.formatCurrency(this.instrument.price, {
          currency: this.instrument.currency,
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`
      : '';
  }
}

/* ---------------------------------------------------------------- estimate */

/**
 * The live readout beside the ticket.
 *
 * A component with explicit inputs, mirroring the React build's top-level
 * `EstimatePanel` (there it is top-level so it is not remounted per keystroke;
 * here a component is a class either way, and the shape is kept so the two
 * files read side by side).
 */
@Component({
  selector: 'awc-trade-estimate',
  standalone: true,
  styles: ':host { display: contents; }',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [PanelComponent, FactComponent, MoneyComponent, NumComponent, SignedComponent],
  template: `
    @if (!estimate || !instrument) {
      <awc-panel [title]="t('wealth.trade.estimate')">
        <p class="muted">{{ t('wealth.trade.estimateEmpty') }}</p>
      </awc-panel>
    } @else {
      <awc-panel [title]="t('wealth.trade.estimate')" [subtitle]="instrument.name">
        <div class="stack">
          <div>
            <p class="estimate__value">
              <span
                awcMoney
                [value]="estimate.estimatedValue"
                [currency]="estimate.currency"
                [digits]="estimate.currency === baseCurrency ? 0 : 2"
              ></span>
            </p>
            @if (estimate.currency !== baseCurrency) {
              <p class="estimate__sub">
                <span awcMoney [value]="estimate.estimatedValueEur"></span> · {{ baseCurrency }}
              </p>
            }
          </div>

          <!--
            Twelve month-end closes, straight off the instrument. data, labels
            and valueFormatter have no attribute form, so they are PROPERTY
            bindings, memoised per locale and instrument — the formatter closes
            over the translator, and a fresh reference each change-detection
            pass would redraw the plot on every keystroke.
          -->
          <div class="estimate__spark">
            <md-sparkline
              [data]="instrument.priceSeries"
              [labels]="sparkLabels"
              [valueFormatter]="sparkFormatter"
              variant="line"
              color="primary"
              curve="monotone"
              show-marks="extremes"
              height="56px"
            ></md-sparkline>
          </div>

          <dl class="dl">
            <div awcFact [label]="t('wealth.table.price')">
              <span
                awcMoney
                [value]="estimate.referencePrice"
                [currency]="estimate.currency"
                [digits]="2"
              ></span>
            </div>
            <div awcFact [label]="t('wealth.table.quantity')">
              <span awcNum [value]="estimate.effectiveQuantity"></span>
            </div>
            <div awcFact [label]="t('wealth.table.weight')">
              <bdi awcSigned [value]="estimate.weightImpact" kind="percent"></bdi>
            </div>
            <div awcFact [label]="t('wealth.kpi.cash')">
              @if (portfolio; as p) {
                <span awcMoney [value]="p.cashBalance" [compact]="true"></span>
              } @else {
                {{ t('wealth.common.na') }}
              }
            </div>
          </dl>

          <p class="estimate__sub">
            {{
              t('wealth.trade.lots', {
                lots: t.formatNumber(estimate.lots, { maximumFractionDigits: 0 }),
                size: t.formatNumber(instrument.lotSize, { maximumFractionDigits: 0 })
              })
            }}
          </p>

          <!--
            The lot rule, made visible. orderEstimate rounds DOWN to a whole
            number of lots, so a typed 1,750 of a bond that trades in 1,000
            becomes 1,000 — and a reader who is not told that reads the
            estimate as wrong rather than as rounded.
          -->
          @if (typedQuantity !== estimate.effectiveQuantity) {
            <p class="estimate__sub">
              {{
                t('wealth.trade.snapped', {
                  typed: t.formatNumber(typedQuantity, { maximumFractionDigits: 0 })
                })
              }}
            </p>
          }

          @if (estimate.exceedsCash) {
            <p class="pl-down">{{ t('wealth.order.exceedsCash') }}</p>
          }
        </div>
      </awc-panel>
    }
  `,
})
export class EstimatePanelComponent extends ShowcaseComponent {
  @Input({ required: true }) estimate!: OrderEstimate | null;
  @Input() instrument?: Instrument;
  @Input() portfolio?: Portfolio;
  @Input({ required: true }) typedQuantity!: number;

  protected readonly baseCurrency = BASE_CURRENCY;

  protected get sparkLabels(): string[] {
    const instrument = this.instrument;
    if (!instrument) return [];
    return this.memo(`labels:${instrument.id}`, () =>
      instrument.priceSeriesDates.map((date) => this.t.formatDate(date, 'monthYear')),
    );
  }

  protected get sparkFormatter(): (value: number | null) => string {
    const instrument = this.instrument;
    const t = this.t;
    return this.memo(`format:${instrument?.id}`, () => (value: number | null) =>
      value === null || !instrument
        ? t('wealth.common.na')
        : t.formatCurrency(value, {
            currency: instrument.currency,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }),
    );
  }
}

/* ------------------------------------------------------------------ ticket */

@Component({
  selector: 'awc-trade-ticket',
  standalone: true,
  styles: ':host { display: contents; }',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [
    PanelComponent,
    FactComponent,
    ChipComponent,
    MoneyComponent,
    NumComponent,
    SignedComponent,
    LimitFieldComponent,
    EstimatePanelComponent,
  ],
  template: `
    <div class="grid-wide">
      <awc-panel
        [title]="t('wealth.panel.ticket')"
        [subtitle]="t('wealth.trade.ticketHint', { date: t.formatDate(reportingDate, 'medium') })"
      >
        <form #ticketForm class="stack" (submit)="onSubmit($event)">
          <!--
            The set owns selection and has no value prop: selected on a child is
            how the current side is expressed, and a plain aria-label names the
            set, which carries no naming prop of its own. Two labelled segments
            is squarely inside the 2–5 M3 allows.
          -->
          <md-segmented-button-set
            [attr.aria-label]="t('wealth.table.side')"
            (mdChange)="onSide($event)"
          >
            @for (side of sides; track side) {
              <md-segmented-button
                [attr.value]="side"
                [attr.label]="t('wealth.orderSide.' + side)"
                [attr.icon]="side === 'buy' ? 'north_east' : 'south_west'"
                [attr.selected]="ticket.side === side ? '' : null"
              ></md-segmented-button>
            }
          </md-segmented-button-set>

          <div class="ticket__fields">
            <!--
              options is a JS PROPERTY — an array has no attribute form — and
              md-autocomplete deliberately IGNORES the selected hint on its
              option rows: setting value (the commitment) and input-value (the
              visible text) is the whole of its preselection contract. Both are
              attribute bindings whose expressions only change when the
              COMMITTED instrument changes, so typing is never interrupted by a
              write from Angular.

              label is the ticker and supportingText the security name because
              the component's client-side filter matches BOTH: typing "nes" or
              "Nestlé" narrows to the same row, while the committed field text
              stays a bare ticker — a single strong-LTR run that cannot reorder
              under dir="rtl" the way a hand-composed "NESN · Nestlé SA" would.

              mdInput is TYPING and mdChange is SELECTION — two distinct
              signals on this component, and confusing them is its most common
              misuse. The two empty states say different things, because they
              ARE different things: an empty universe and a query that matched
              nothing — the second can name what was typed, which is why the
              query is tracked at all.

              Forty instruments is far inside the 200-row threshold, but auto
              is a threshold rather than a promise: pinning the client-side
              path keeps the default label/supporting-text filter (which
              matches the security NAME, not just the ticker) instead of
              handing matching to the WASM engine.
            -->
            <md-autocomplete
              #instrumentField
              name="instrument"
              variant="outlined"
              required
              [options]="instrumentOptions"
              [attr.value]="ticket.instrumentId"
              [attr.input-value]="instrument?.ticker ?? ''"
              [attr.label]="t('wealth.table.instrument')"
              [attr.placeholder]="t('wealth.action.search')"
              [attr.supporting-text]="instrument ? instrument.name : t('wealth.panel.universe')"
              [attr.value-missing-label]="t('wealth.trade.needInstrument')"
              [attr.no-options-text]="t('wealth.empty.generic')"
              [attr.no-results-text]="t('wealth.empty.search', { query: query })"
              virtualize="never"
              reserve-supporting-space
              (mdInput)="onInstrumentInput($event)"
              (mdChange)="onInstrumentChange($event)"
            ></md-autocomplete>

            <md-select
              name="portfolio"
              variant="outlined"
              required
              [attr.label]="t('wealth.panel.mandate')"
              [attr.value]="ticket.portfolioId"
              [attr.value-missing-label]="t('wealth.trade.needPortfolio')"
              [attr.supporting-text]="
                portfolio
                  ? t('wealth.kpi.cash') +
                    ' · ' +
                    t.formatCurrency(portfolio.cashBalance, { notation: 'compact' })
                  : ''
              "
              reserve-supporting-space
              (mdChange)="onPortfolio($event)"
            >
              @for (p of portfolios; track p.id) {
                <md-select-option
                  [attr.value]="p.id"
                  [attr.label]="p.reference"
                  [attr.supporting-text]="t(p.strategyKey)"
                >{{ p.reference }}</md-select-option>
              }
            </md-select>

            <!--
              md-number-field, never md-text-field type="number" (§5.2). The
              steppers step by the instrument's LOT and snap-on-step keeps them
              on that grid, so the buttons cannot produce a size the security
              does not trade in. error here is display-only — the block itself
              belongs to the tooltip and to constraint validation — but this is
              where the reader is looking when the size is what went wrong.
              Shift-stepping moves ten lots: a keyboard affordance, not a
              reported figure — every number this screen SHOWS comes from the
              kit. NO value binding — see the seeding note at the top.
            -->
            <md-number-field
              #quantityField
              name="quantity"
              variant="outlined"
              required
              [attr.label]="t('wealth.table.quantity')"
              [attr.locale]="locale"
              min="0"
              [attr.step]="instrument?.lotSize ?? 1"
              [attr.large-step]="(instrument?.lotSize ?? 1) * 10"
              snap-on-step
              steppers="inline"
              [attr.increment-label]="t('wealth.action.next')"
              [attr.decrement-label]="t('wealth.action.back')"
              [attr.value-missing-label]="t('wealth.trade.needQuantity')"
              [attr.supporting-text]="lotHint"
              [attr.error]="estimate?.exceedsCash ? '' : null"
              [attr.error-text]="estimate?.exceedsCash ? t('wealth.order.exceedsCash') : null"
              reserve-supporting-space
              (mdInput)="onQuantity($event)"
              (mdChange)="onQuantity($event)"
            ></md-number-field>

            <md-select
              name="orderType"
              variant="outlined"
              required
              [attr.label]="t('wealth.table.orderType')"
              [attr.value]="ticket.orderType"
              reserve-supporting-space
              (mdChange)="onOrderType($event)"
            >
              @for (type of orderTypes; track type) {
                <md-select-option
                  [attr.value]="type"
                  [attr.label]="t('wealth.orderType.' + type)"
                >{{ t('wealth.orderType.' + type) }}</md-select-option>
              }
            </md-select>

            <!--
              Revealed, not permanently disabled. A market order has no limit
              price at all, and a greyed field is a question the reader keeps
              re-reading. Both of the other two types are struck at a price, so
              the field appears for both. Its own component so the mount is
              where its seed happens — see LimitFieldComponent.
            -->
            @if (showLimit) {
              <awc-trade-limit-field
                [seed]="seed"
                [value]="ticket.limitPrice"
                [instrument]="instrument"
                [locale]="locale"
                (valueChange)="onLimit($event)"
              />
            }

            <md-select
              name="tif"
              variant="outlined"
              required
              [attr.label]="t('wealth.table.timeInForce')"
              [attr.value]="ticket.timeInForce"
              reserve-supporting-space
              (mdChange)="onTif($event)"
            >
              @for (tif of timeInForce; track tif) {
                <md-select-option
                  [attr.value]="tif"
                  [attr.label]="t('wealth.timeInForce.' + tif)"
                >{{ t('wealth.timeInForce.' + tif) }}</md-select-option>
              }
            </md-select>
          </div>

          <md-divider></md-divider>

          <div class="ticket__actions">
            <!--
              The ticket's two ancillary actions. md-button-group's
              syncChildren writes toggle = true onto every child
              unconditionally, because its usual job is a set of STATES. These
              are actions, so each child's mdClick — cancelable, and reaching
              the group by bubbling — is vetoed with preventDefault(). That
              suppresses the toggle flip and leaves the group's selection
              permanently empty, while the reasons to use a group at all
              survive: one tab stop, RTL-aware arrow-key movement between the
              two actions, and the fused press flourish. Reading
              mdSelectionChange here would report an empty diff every time,
              which is why the identity comes off mdClick's own detail instead.

              ONE WART REMAINS, and it is worth naming rather than hiding:
              md-button renders aria-pressed whenever toggle is on, so both of
              these announce as unpressed toggle buttons. The visual state
              never lies — the veto sees to that — but the accessible one calls
              an action a state. There is no way to opt out from here (toggle
              is re-written on every sync), so this is reported upward as a gap
              in md-button-group rather than worked around with a fight against
              the component.
            -->
            <md-button-group
              variant="standard"
              size="sm"
              selection-mode="multi-select"
              [attr.aria-label]="t('wealth.trade.actions')"
              (mdClick)="onGroupClick($event)"
            >
              <md-button value="clear" variant="text" icon="restart_alt">
                {{ t('wealth.trade.clear') }}
              </md-button>
              <md-button value="book" variant="text" icon="receipt_long">
                {{ t('wealth.trade.book') }}
              </md-button>
            </md-button-group>

            <!--
              §7.2's pairing, and the reason it is in the manual: a
              soft-disabled control keeps tabindex="0", so a keyboard reader
              reaches it and the tooltip tells them what is missing — which a
              hard disabled would hide entirely. disabled on the TOOLTIP is
              what switches the explanation off once there is nothing to
              explain.
            -->
            <md-tooltip
              [attr.text]="blockKey ? t(blockKey) : ''"
              [attr.disabled]="blocked ? null : ''"
              position="top-end"
            >
              <md-split-button
                #split
                id="trade-submit"
                variant="filled"
                size="sm"
                icon="send"
                [attr.label]="t('wealth.action.submit')"
                [attr.menu-label]="t('wealth.trade.submitOptions')"
                controls="trade-submit-menu"
                [attr.soft-disabled]="blocked ? '' : null"
                (mdLeadingClick)="requestSubmit('clear')"
                (mdTrailingClick)="onTrailing($event)"
              ></md-split-button>
            </md-tooltip>
          </div>
        </form>
      </awc-panel>

      <awc-trade-estimate
        [estimate]="estimate"
        [instrument]="instrument"
        [portfolio]="portfolio"
        [typedQuantity]="ticket.quantity ?? 0"
      />
    </div>

    <!--
      The split button ships no menu — it emits mdTrailingClick and this is the
      menu it opens. open is never written into the initial markup: the
      component wires positioning and dismissal from the open CHANGE handler,
      so a menu that starts open paints unpositioned and cannot be clicked
      away. bottom-end, not top-end: a menu belongs BELOW the control that
      opens it unless there is no room, and md-menu already flips itself when
      the space is short. vibrant to match every other menu surface in this
      app.

      md-menu's own open/close events do NOT bubble and are NOT composed: they
      fire on the menu element itself, which is where this binding listens.
      Without it the split button's chevron stays rotated after an outside
      click or an Escape, because the button cannot see a close it did not
      cause. md-menu-item's mdClick bubbles and is composed, so one listener on
      the menu covers every row; the menu closes itself.
    -->
    <md-menu
      #submitMenu
      id="trade-submit-menu"
      anchor="trade-submit"
      placement="bottom-end"
      variant="vibrant"
      (mdClose)="onMenuClose()"
      (mdClick)="requestSubmit('keep')"
    >
      <md-menu-item
        [attr.headline]="t('wealth.trade.submitDuplicate')"
        [attr.supporting-text]="t('wealth.panel.ticket')"
      ></md-menu-item>
    </md-menu>

    <!-- --------------------------------------------------------- confirm -->
    <!--
      Escape and the scrim emit mdCancel as well as mdClose; only mdCancel is
      handled, so a dismissal is not processed twice.
    -->
    <md-dialog
      [attr.open]="confirmOpen ? '' : null"
      [attr.headline]="t('wealth.trade.confirm')"
      icon="fact_check"
      divider
      [attr.scrim-dismissible]="sending ? 'false' : 'true'"
      [attr.close-label]="t('wealth.action.close')"
      (mdCancel)="abortSend()"
    >
      <p class="muted">{{ t('wealth.trade.confirmBody') }}</p>

      <dl class="dl">
        <div awcFact [label]="t('wealth.table.side')">
          <md-chip awcChip kind="orderSide" [value]="ticket.side"></md-chip>
        </div>
        <div awcFact [label]="t('wealth.table.instrument')">
          {{ instrument ? instrument.name : t('wealth.common.na') }}
        </div>
        <div awcFact [label]="t('wealth.panel.mandate')">
          {{ portfolio ? portfolio.reference : t('wealth.common.na') }}
        </div>
        <div awcFact [label]="t('wealth.table.quantity')">
          <span awcNum [value]="estimate?.effectiveQuantity ?? 0"></span>
        </div>
        <div awcFact [label]="t('wealth.table.orderType')">
          {{ t('wealth.orderType.' + ticket.orderType) }}
        </div>
        <div awcFact [label]="t('wealth.table.limitPrice')">
          @if (showLimit && ticket.limitPrice !== null) {
            <span
              awcMoney
              [value]="ticket.limitPrice"
              [currency]="instrument?.currency ?? 'EUR'"
              [digits]="2"
            ></span>
          } @else {
            {{ t('wealth.common.na') }}
          }
        </div>
        <div awcFact [label]="t('wealth.table.timeInForce')">
          {{ t('wealth.timeInForce.' + ticket.timeInForce) }}
        </div>
        <div awcFact [label]="t('wealth.table.estimatedValue')">
          @if (estimate; as est) {
            <span awcMoney [value]="est.estimatedValueEur"></span>
          } @else {
            {{ t('wealth.common.na') }}
          }
        </div>
      </dl>

      <!--
        Indeterminate, because there is no measurable progress to report — the
        desk either has the ticket or it does not. label becomes the
        aria-label; the component's own default is the English word "Progress".
      -->
      @if (sending) {
        <md-progress-indicator
          variant="linear"
          indeterminate
          [attr.label]="t('wealth.trade.submitting')"
        ></md-progress-indicator>
      }

      <!--
        Slotted actions replace the dialog's fallback pair and do NOT close it
        — they are our markup, so the close is ours to perform. M3 puts the
        dismissive action on the leading side and the component does not
        reorder them.

        Cancel stays LIVE while the ticket is in flight, because it is the
        abort, and it is the same abort Escape and the scrim perform. Confirm
        goes loading, which is not merely cosmetic — md-button counts it as
        disabled — and the events are read through mdClick rather than a native
        (click) because the disabled path calls preventDefault() without
        stopping propagation: the native click would still reach a handler and
        start a second submission over the first.
      -->
      <md-button slot="actions" variant="text" (mdClick)="abortSend()">
        {{ t('wealth.action.cancel') }}
      </md-button>
      <md-button
        slot="actions"
        variant="filled"
        icon="send"
        [attr.loading]="sending ? '' : null"
        (mdClick)="confirmSend()"
      >
        {{ t('wealth.action.submit') }}
      </md-button>
    </md-dialog>

    <!-- ------------------------------------------------------------ book -->
    <md-bottom-sheet
      [attr.open]="sheetOpen ? '' : null"
      variant="detached"
      closeable
      top-divider
      [attr.headline]="
        instrument
          ? t('wealth.trade.bookFor', { ticker: instrument.ticker })
          : t('wealth.trade.bookRecent')
      "
      (mdClose)="sheetOpen = false"
    >
      @if (instrument; as inst) {
        <dl class="dl trade-sheet__facts">
          <div awcFact [label]="t('wealth.table.price')">
            <span awcMoney [value]="inst.price" [currency]="inst.currency" [digits]="2"></span>
          </div>
          <div awcFact [label]="t('wealth.table.dayChange')">
            <bdi awcSigned [value]="inst.dayChangePct" kind="percent"></bdi>
          </div>
          <div awcFact [label]="t('wealth.table.twelveMonth')">
            <bdi awcSigned [value]="inst.twelveMonthReturn" kind="percent"></bdi>
          </div>
          <div awcFact [label]="t('wealth.table.quantity')">
            <span awcNum [value]="inst.lotSize"></span>
          </div>
        </dl>
      }

      @if (bookOrders.length === 0) {
        <p class="muted">{{ t('wealth.trade.bookEmpty') }}</p>
      } @else {
        <md-list [attr.label]="t('wealth.panel.blotter')">
          @for (order of bookOrders; track order.id) {
            <md-list-item
              lines="3"
              [attr.overline]="order.id"
              [attr.headline]="order.instrumentName"
              [attr.supporting-text]="
                t('wealth.order.filledOf', {
                  filled: t.formatNumber(order.filledQuantity, { maximumFractionDigits: 0 }),
                  quantity: t.formatNumber(order.quantity, { maximumFractionDigits: 0 })
                })
              "
              [attr.trailing-supporting-text]="
                t.formatCurrency(order.estimatedValueEur, { notation: 'compact' })
              "
            >
              <span slot="leading">
                <md-chip awcChip kind="orderSide" [value]="order.side"></md-chip>
              </span>
              <span slot="trailing">
                <md-chip awcChip kind="orderStatus" [value]="order.status"></md-chip>
              </span>
            </md-list-item>
          }
        </md-list>
      }

      <!--
        A slotted close element is NOT wired by the sheet — only the built-in
        closeable icon-button is — so this one closes it itself.
      -->
      <md-button slot="actions" variant="text" (mdClick)="sheetOpen = false">
        {{ t('wealth.action.close') }}
      </md-button>
    </md-bottom-sheet>

    <!-- ---------------------------------------------------------- report -->
    <!--
      Auto-hide sets open on the element itself, and setting open = false
      directly emits nothing — so mdClose is the only signal that the snackbar
      has gone. Without this handler Angular would still believe it open, and
      the next attribute write would re-show a stale message.
    -->
    <md-snackbar
      class="wealth-snackbar"
      [attr.open]="snackOpen ? '' : null"
      [attr.message]="snackMessage"
      position="bottom"
      closeable
      [attr.dismiss-label]="t('wealth.action.close')"
      (mdClose)="snackOpen = false"
    ></md-snackbar>
  `,
})
export class TradeTicketComponent
  extends ShowcaseComponent
  implements AfterViewInit, OnDestroy
{
  protected readonly sides = SIDES;
  protected readonly orderTypes = ORDER_TYPES;
  protected readonly timeInForce = TIME_IN_FORCE;
  protected readonly reportingDate = REPORTING_DATE;

  protected readonly portfolios: Portfolio[] = getPortfolios();
  private readonly instruments: Instrument[] = getInstruments();

  /** The picker's option rows — value, ticker, security name. Built once. */
  protected readonly instrumentOptions = this.instruments.map((instrument) => ({
    value: instrument.id,
    label: instrument.ticker,
    supportingText: instrument.name,
  }));

  /*
   * The mandate is pre-selected and the instrument is not, and that is the
   * starting state on purpose: the ticket opens with a live cash balance to
   * trade against and with exactly one thing missing, so the soft-disabled
   * submit and its tooltip are the first thing the screen demonstrates rather
   * than a state you have to break it to reach.
   */
  private readonly initial: Ticket = {
    side: 'buy',
    instrumentId: '',
    portfolioId: this.portfolios[0]?.id ?? '',
    quantity: null,
    orderType: 'market',
    limitPrice: null,
    timeInForce: 'day',
  };

  protected ticket: Ticket = { ...this.initial };

  /*
   * Bumped whenever the app — rather than the user — should own what is in the
   * two number fields: on mount, on a clear, and when the instrument changes.
   * The quantity field is written directly; the limit field re-seeds itself
   * from this input.
   */
  protected seed = 0;

  /** The typed text, kept only so the "nothing matched" row can name it. */
  protected query = '';

  protected confirmOpen = false;
  protected sending = false;
  protected sheetOpen = false;
  protected snackOpen = false;
  protected snackMessage = '';

  /** Which half of the split button asked for this submit. */
  private pendingMode: 'clear' | 'keep' = 'clear';
  private timer: number | null = null;

  @ViewChild('ticketForm') private formEl?: ElementRef<HTMLFormElement>;
  @ViewChild('instrumentField') private instrumentEl?: ElementRef<PopupElement>;
  @ViewChild('quantityField') private quantityEl?: ElementRef<NumberFieldElement>;
  @ViewChild('split') private splitEl?: ElementRef<PopupElement>;
  @ViewChild('submitMenu') private menuEl?: ElementRef<PopupElement>;

  /* -------------------------------------------------------------- derived */

  protected get instrument(): Instrument | undefined {
    return this.ticket.instrumentId ? getInstrumentById(this.ticket.instrumentId) : undefined;
  }

  protected get portfolio(): Portfolio | undefined {
    return this.ticket.portfolioId ? getPortfolioById(this.ticket.portfolioId) : undefined;
  }

  protected get showLimit(): boolean {
    return needsLimit(this.ticket.orderType);
  }

  protected get locale(): string {
    return intlTag(this.showcase.state().locale);
  }

  // Cached on the same six fields the React build's useMemo lists, so the
  // estimate object handed to the panel keeps its identity between passes.
  private estimateKey = '';
  private estimateCache: OrderEstimate | null = null;

  protected get estimate(): OrderEstimate | null {
    const ticket = this.ticket;
    const key = JSON.stringify([
      ticket.instrumentId,
      ticket.quantity,
      ticket.side,
      ticket.orderType,
      ticket.limitPrice,
      ticket.portfolioId,
    ]);
    if (key !== this.estimateKey) {
      this.estimateKey = key;
      this.estimateCache = ticket.instrumentId
        ? orderEstimate({
            instrumentId: ticket.instrumentId,
            quantity: ticket.quantity ?? 0,
            side: ticket.side,
            limitPrice: needsLimit(ticket.orderType) ? ticket.limitPrice : null,
            portfolioId: ticket.portfolioId || undefined,
          })
        : null;
    }
    return this.estimateCache;
  }

  /*
   * Why the ticket cannot be sent, in the order a desk would ask.
   *
   * ONE key, not a list: a tooltip that recites four sentences is not read.
   * The first unmet condition is the one the reader can act on, and the next
   * appears the moment it is met. exceedsCash comes last because it is the
   * only one that needs every other field before it can be evaluated at all —
   * and it BLOCKS rather than merely warns, because this console has no
   * funding flow to point at, so an order the mandate cannot pay for is not a
   * draft.
   */
  protected get blockKey(): string | null {
    const ticket = this.ticket;
    const estimate = this.estimate;
    return !ticket.instrumentId
      ? 'wealth.trade.needInstrument'
      : !ticket.portfolioId
        ? 'wealth.trade.needPortfolio'
        : !estimate || estimate.lots < 1
          ? 'wealth.trade.needQuantity'
          : this.showLimit && !(ticket.limitPrice !== null && ticket.limitPrice > 0)
            ? 'wealth.trade.needLimit'
            : estimate.exceedsCash
              ? 'wealth.order.exceedsCash'
              : null;
  }

  protected get blocked(): boolean {
    return this.blockKey !== null;
  }

  protected get lotHint(): string {
    const instrument = this.instrument;
    return instrument
      ? this.t('wealth.order.lotHint', {
          size: this.t.formatNumber(instrument.lotSize, { maximumFractionDigits: 0 }),
        })
      : '';
  }

  /*
   * The sheet shows the book for the chosen instrument, and the newest orders
   * on the whole book when nothing is chosen — both straight out of the
   * selector, filtered BY it rather than by an array method here. There is no
   * bid/ask depth in this console because the fixture carries none, and
   * inventing a ladder of prices is the one thing this showcase is not for.
   */
  private bookKey: string | null = null;
  private bookCache: Order[] = [];

  protected get bookOrders(): Order[] {
    const key = this.ticket.instrumentId;
    if (key !== this.bookKey) {
      this.bookKey = key;
      this.bookCache = key ? getOrders({ instrumentId: key }) : getOrders({ limit: 8 });
    }
    return this.bookCache;
  }

  /* ------------------------------------------------------------ lifecycle */

  ngAfterViewInit(): void {
    // The mount seed: the app owns the quantity field's (empty) content until
    // the user starts typing. Works pre-upgrade too — Stencil's lazy proxy
    // picks up own properties set before the element upgrades.
    this.writeQuantity();
  }

  ngOnDestroy(): void {
    this.cancelTimer();
  }

  /** Hand the screen's toolbar a way to focus the first field. */
  focusInstrument(): void {
    void this.instrumentEl?.nativeElement?.focusInput?.();
  }

  /* --------------------------------------------------------------- fields */

  protected onInstrumentInput(event: Event): void {
    this.query = (event as CustomEvent<string>).detail ?? '';
  }

  protected onInstrumentChange(event: Event): void {
    const detail = (event as CustomEvent<string | string[]>).detail;
    const next = Array.isArray(detail) ? (detail[0] ?? '') : (detail ?? '');
    /*
     * ONLY A REAL INSTRUMENT COUNTS AS A SELECTION.
     *
     * mdChange can carry text that matched no option — type "orbs" and press
     * ArrowDown and it arrives as "orbs". Storing that as instrumentId made
     * `instrument` undefined, which drove input-value to '' and wiped the
     * field the moment you reached for the list. Clearing an empty value is
     * still a selection (it is how the ticket is reset), so only a NON-empty
     * id that resolves to nothing is refused.
     */
    if (next && !getInstrumentById(next)) return;
    // A new instrument invalidates the limit price: it was quoted in the old
    // security's currency and at the old security's scale. The quantity is
    // kept on purpose — the estimate re-snaps it to the new lot size and
    // reports the result, which is the lot rule doing visible work.
    this.ticket = { ...this.ticket, instrumentId: next, limitPrice: null };
    this.reseed();
  }

  protected onQuantity(event: Event): void {
    this.ticket = {
      ...this.ticket,
      quantity: (event as CustomEvent<{ value: number | null }>).detail.value,
    };
  }

  protected onLimit(value: number | null): void {
    this.ticket = { ...this.ticket, limitPrice: value };
  }

  protected onSide(event: Event): void {
    // A single-select set always reports exactly one value and never an empty
    // array — only multiselect can clear a choice.
    const next = (event as CustomEvent<string[]>).detail?.[0] as OrderSide | undefined;
    if (next) this.ticket = { ...this.ticket, side: next };
  }

  protected onPortfolio(event: Event): void {
    this.ticket = { ...this.ticket, portfolioId: (event as CustomEvent<string>).detail ?? '' };
  }

  protected onOrderType(event: Event): void {
    const next = ((event as CustomEvent<string>).detail || 'market') as OrderType;
    // Dropping to market unmounts the limit field, and an unmounted field
    // cannot show the price still sitting in state — so the state goes with
    // it, and the estimate can never be struck at a price nothing on screen
    // names.
    this.ticket = {
      ...this.ticket,
      orderType: next,
      limitPrice: needsLimit(next) ? this.ticket.limitPrice : null,
    };
  }

  protected onTif(event: Event): void {
    this.ticket = {
      ...this.ticket,
      timeInForce: ((event as CustomEvent<string>).detail || 'day') as TimeInForce,
    };
  }

  /* ---------------------------------------------------------- submit flow */

  protected requestSubmit(mode: 'clear' | 'keep'): void {
    this.pendingMode = mode;
    // requestSubmit(), not submit(): it fires the form's submit event AND runs
    // constraint validation, so a required field that is still empty reports
    // itself rather than being silently skipped.
    this.formEl?.nativeElement.requestSubmit();
  }

  protected onSubmit(event: Event): void {
    event.preventDefault();
    // The soft-disabled split button stops the pointer path; this stops the
    // keyboard one. md-number-field calls requestSubmit() on Enter, and
    // exceedsCash is not a constraint the platform knows anything about.
    if (this.blocked) {
      this.pendingMode = 'clear';
      return;
    }
    this.confirmOpen = true;
  }

  protected onTrailing(event: Event): void {
    const { checked } = (event as CustomEvent<{ checked: boolean }>).detail;
    const menu = this.menuEl?.nativeElement;
    void (checked ? menu?.show?.() : menu?.close?.());
  }

  // The menu can close by Escape, an outside click or a pick, and the button
  // cannot see any of those — so the state is mirrored back into the split
  // button as a property write. (The React build drives a trailing-checked
  // binding from the same event; the property write is this app's established
  // idiom, from the holdings filter bar.)
  protected onMenuClose(): void {
    const split = this.splitEl?.nativeElement;
    if (split) split.trailingChecked = false;
  }

  protected onGroupClick(event: Event): void {
    event.preventDefault();
    const value = (event as CustomEvent<{ value: string }>).detail?.value;
    if (value === 'clear') this.clearTicket();
    if (value === 'book') this.sheetOpen = true;
  }

  /** The line the snackbar reports. Built BEFORE the ticket is cleared. */
  private completionMessage(mode: 'clear' | 'keep'): string {
    return this.t(mode === 'keep' ? 'wealth.trade.submittedKept' : 'wealth.trade.submitted', {
      side: this.t(`wealth.orderSide.${this.ticket.side}`),
      quantity: this.t.formatNumber(this.estimate?.effectiveQuantity ?? 0, {
        maximumFractionDigits: 0,
      }),
      ticker: this.instrument?.ticker ?? '',
    });
  }

  protected confirmSend(): void {
    // Belt and braces beside the button's own loading state: one ticket, one
    // timer, so a second activation can never orphan the first.
    if (this.timer !== null) return;
    const mode = this.pendingMode;
    const message = this.completionMessage(mode);
    this.sending = true;
    this.timer = window.setTimeout(() => {
      this.timer = null;
      this.sending = false;
      this.confirmOpen = false;
      this.snackMessage = message;
      this.snackOpen = true;
      this.pendingMode = 'clear';
      if (mode === 'clear') this.clearTicket();
    }, SUBMIT_MS);
  }

  protected abortSend(): void {
    this.cancelTimer();
    this.sending = false;
    this.confirmOpen = false;
    this.pendingMode = 'clear';
  }

  private cancelTimer(): void {
    if (this.timer !== null) {
      window.clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private clearTicket(): void {
    // The mandate survives a clear: an advisor writing three tickets for one
    // household should not have to re-pick it three times.
    this.ticket = { ...this.initial, portfolioId: this.ticket.portfolioId };
    this.reseed();
  }

  /* ----------------------------------------------------------------- seed */

  private reseed(): void {
    this.seed++;
    this.writeQuantity();
  }

  private writeQuantity(): void {
    const el = this.quantityEl?.nativeElement;
    if (el) el.value = this.ticket.quantity;
  }
}
