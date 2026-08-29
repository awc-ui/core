/**
 * The order ticket: pick a side, an instrument, a mandate and a size, watch the
 * estimate move, then confirm and send.
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
 * `mdLeadingClick` calls `requestSubmit()` on the form rather than pretending to
 * be a submit button. The flow therefore has two independent gates that agree:
 * the soft-disabled state PREDICTS the block (and a tooltip says why), and
 * constraint validation ENFORCES it.
 *
 * WHY THE NUMBER FIELDS ARE NOT REACT-CONTROLLED. `md-number-field` treats a
 * programmatic `value` write as a commit: it reformats the display. Re-rendering
 * `value={quantity}` on every keystroke would therefore regroup the digits under
 * the caret while the user types `1234` into `1,234`. The two number fields are
 * seeded through `useElementProps` keyed on a reset counter instead, so the app
 * writes to them exactly when it means to — on mount, on a clear, and when the
 * instrument changes — and never while the user is typing. The selects and the
 * segmented set have no such hazard and are plainly controlled.
 *
 * THREE COMPOSITION RULES THIS FILE IS BUILT AROUND (§7 of `main-llm.md`):
 *   - `md-split-button` renders no menu. The trailing half emits
 *     `mdTrailingClick`; this file owns the `md-menu`, anchors it by id, and
 *     puts `trailing-checked` back to false from the menu's own `mdClose`.
 *   - A soft-disabled action is paired with an `md-tooltip` that says WHY
 *     (§7.2). `disabled` on the tooltip switches the explanation off once the
 *     block clears, so a usable button never carries a description of its own
 *     unavailability.
 *   - There is exactly ONE dialog, and nothing opens another from inside it.
 *     The confirmation and the progress indicator share it (§7.3).
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react';
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
import { useShowcase, useT } from '@/lib/showcase';
import { Panel } from '../Shell';
import { Fact, Money, Num, OrderSideChip, OrderStatusChip, Signed } from '../bits';
import { Sparkline, useCustomEvent, useElementProps } from '../elements';
import { useTx, type Tx } from './trade-strings';
import './snackbar.css';

/* --------------------------------------------------------------- the ticket */

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

const SIDES: OrderSide[] = ['buy', 'sell'];
const ORDER_TYPES: OrderType[] = ['market', 'limit', 'stop-limit'];
const TIME_IN_FORCE: TimeInForce[] = ['day', 'gtc', 'ioc', 'fok'];

/**
 * How long the round trip to the desk takes.
 *
 * A CONSTANT, not a random or clock-derived interval: two runs of this screen
 * have to behave identically for a cross-framework comparison to mean anything.
 * It gates an animation and nothing that is rendered as a value.
 */
const SUBMIT_MS = 900;

/** `market` is struck at the last close; the other two carry a price. */
function needsLimit(orderType: OrderType): boolean {
  return orderType !== 'market';
}

/* ------------------------------------------------------------------ ticket */

export function TradeTicket({
  /** Set by the screen so its toolbar can put focus into the first field. */
  focusHandle,
}: {
  focusHandle?: { current: (() => void) | null };
}) {
  const t = useT();
  const tx = useTx();
  const { state } = useShowcase();
  const locale = intlTag(state.locale);

  const portfolios = useMemo(() => getPortfolios(), []);
  const instruments = useMemo(() => getInstruments(), []);

  /*
   * The mandate is pre-selected and the instrument is not, and that is the
   * starting state on purpose: the ticket opens with a live cash balance to
   * trade against and with exactly one thing missing, so the soft-disabled
   * submit and its tooltip are the first thing the screen demonstrates rather
   * than a state you have to break it to reach.
   */
  const initial = useMemo<Ticket>(
    () => ({
      side: 'buy',
      instrumentId: '',
      portfolioId: portfolios[0]?.id ?? '',
      quantity: null,
      orderType: 'market',
      limitPrice: null,
      timeInForce: 'day',
    }),
    [portfolios],
  );

  const [ticket, setTicket] = useState<Ticket>(initial);

  /*
   * Bumped whenever the app — rather than the user — should own what is in the
   * two number fields. `useElementProps` reads the LATEST props when its deps
   * change, so bumping this pushes the current `ticket` values into the
   * elements, and leaving it alone lets the user type undisturbed.
   */
  const [seed, setSeed] = useState(0);

  const instrument = ticket.instrumentId ? getInstrumentById(ticket.instrumentId) : undefined;
  const portfolio = ticket.portfolioId ? getPortfolioById(ticket.portfolioId) : undefined;
  const showLimit = needsLimit(ticket.orderType);

  /* --------------------------------------------------------------- estimate */

  const estimate = useMemo<OrderEstimate | null>(
    () =>
      ticket.instrumentId
        ? orderEstimate({
            instrumentId: ticket.instrumentId,
            quantity: ticket.quantity ?? 0,
            side: ticket.side,
            limitPrice: needsLimit(ticket.orderType) ? ticket.limitPrice : null,
            portfolioId: ticket.portfolioId || undefined,
          })
        : null,
    [
      ticket.instrumentId,
      ticket.quantity,
      ticket.side,
      ticket.orderType,
      ticket.limitPrice,
      ticket.portfolioId,
    ],
  );

  /*
   * Why the ticket cannot be sent, in the order a desk would ask.
   *
   * ONE key, not a list: a tooltip that recites four sentences is not read. The
   * first unmet condition is the one the reader can act on, and the next appears
   * the moment it is met. `exceedsCash` comes last because it is the only one
   * that needs every other field before it can be evaluated at all — and it
   * BLOCKS rather than merely warns, because this console has no funding flow to
   * point at, so an order the mandate cannot pay for is not a draft.
   */
  const blockKey = !ticket.instrumentId
    ? 'wealth.trade.needInstrument'
    : !ticket.portfolioId
      ? 'wealth.trade.needPortfolio'
      : !estimate || estimate.lots < 1
        ? 'wealth.trade.needQuantity'
        : showLimit && !(ticket.limitPrice !== null && ticket.limitPrice > 0)
          ? 'wealth.trade.needLimit'
          : estimate.exceedsCash
            ? 'wealth.order.exceedsCash'
            : null;

  const blocked = blockKey !== null;

  /* ----------------------------------------------------------------- fields */

  /*
   * The instrument picker's option set.
   *
   * `label` is the ticker and `supportingText` the security name because the
   * component's client-side filter matches BOTH: typing `nes` or `Nestlé`
   * narrows to the same row, while the committed field text stays a bare ticker
   * — a single strong-LTR run that cannot reorder under `dir="rtl"` the way a
   * hand-composed `NESN · Nestlé SA` would.
   */
  const instrumentOptions = useMemo(
    () => instruments.map((i) => ({ value: i.id, label: i.ticker, supportingText: i.name })),
    [instruments],
  );

  /*
   * `options`, `value` and `inputValue` are all JS properties here. An array has
   * no attribute form, and `md-autocomplete` deliberately IGNORES the `selected`
   * hint on its option rows — setting `value` (the commitment) and `inputValue`
   * (the visible text) is the whole of its preselection contract. They are
   * assigned only when the committed instrument changes, never on every render,
   * so typing is never interrupted by a write from React.
   */
  const instrumentRef = useElementProps<HTMLElement>(
    {
      options: instrumentOptions,
      value: ticket.instrumentId,
      inputValue: instrument?.ticker ?? '',
    },
    [ticket.instrumentId, instrumentOptions],
  );

  /*
   * The typed text, kept only so the "nothing matched" row can name it.
   *
   * `mdInput` is TYPING and `mdChange` is SELECTION — two distinct signals on
   * this component, and confusing them is its most common misuse. Nothing here
   * writes `inputValue` back: assigning it would change the visible text without
   * filtering anything, because only text the user typed counts as the query.
   */
  const [query, setQuery] = useState('');
  useCustomEvent<CustomEvent<string>>(instrumentRef, 'mdInput', (event) => {
    setQuery(event.detail ?? '');
  });

  useCustomEvent<CustomEvent<string | string[]>>(instrumentRef, 'mdChange', (event) => {
    const next = Array.isArray(event.detail) ? (event.detail[0] ?? '') : (event.detail ?? '');
    /*
     * ONLY A REAL INSTRUMENT COUNTS AS A SELECTION.
     *
     * `mdChange` can carry text that matched no option — type "orbs" and press
     * ArrowDown and it arrives as `"orbs"`. Storing that as `instrumentId` made
     * `instrument` undefined, which drove `inputValue` to `''` through
     * `useElementProps` and wiped the field the moment you reached for the
     * list. Clearing an empty value is still a selection (it is how the ticket
     * is reset), so only a NON-empty id that resolves to nothing is refused.
     */
    if (next && !getInstrumentById(next)) return;
    // A new instrument invalidates the limit price: it was quoted in the old
    // security's currency and at the old security's scale. The quantity is kept
    // on purpose — the estimate re-snaps it to the new lot size and reports the
    // result, which is the lot rule doing visible work.
    setTicket((current) => ({ ...current, instrumentId: next, limitPrice: null }));
    setSeed((n) => n + 1);
  });

  /*
   * BOTH value events, and the second one is not redundant.
   *
   * `mdInput` reports every move including typing, but a TYPED value is clamped
   * at the commit — blur or Enter — and that clamp arrives as `mdChange`. Type
   * `-5` into a field with `min="0"` and `mdInput` says −5 while the box ends up
   * showing 0; without the commit listener the estimate would go on pricing a
   * quantity nothing on screen displays. The two handlers are the same setter,
   * so hearing both is free.
   */
  const setQuantity = useCallback((value: number | null) => {
    setTicket((current) => ({ ...current, quantity: value }));
  }, []);

  const quantityRef = useElementProps<HTMLElement>({ value: ticket.quantity }, [seed]);
  useCustomEvent<CustomEvent<{ value: number | null }>>(quantityRef, 'mdInput', (event) =>
    setQuantity(event.detail.value),
  );
  useCustomEvent<CustomEvent<{ value: number | null }>>(quantityRef, 'mdChange', (event) =>
    setQuantity(event.detail.value),
  );

  const setLimitPrice = useCallback((value: number | null) => {
    setTicket((current) => ({ ...current, limitPrice: value }));
  }, []);

  const sideRef = useRef<HTMLElement | null>(null);
  useCustomEvent<CustomEvent<string[]>>(sideRef, 'mdChange', (event) => {
    // A single-select set always reports exactly one value and never an empty
    // array — only `multiselect` can clear a choice.
    const next = event.detail?.[0] as OrderSide | undefined;
    if (next) setTicket((current) => ({ ...current, side: next }));
  });

  const portfolioRef = useRef<HTMLElement | null>(null);
  useCustomEvent<CustomEvent<string>>(portfolioRef, 'mdChange', (event) => {
    setTicket((current) => ({ ...current, portfolioId: event.detail ?? '' }));
  });

  const orderTypeRef = useRef<HTMLElement | null>(null);
  useCustomEvent<CustomEvent<string>>(orderTypeRef, 'mdChange', (event) => {
    const next = (event.detail || 'market') as OrderType;
    // Dropping to `market` unmounts the limit field, and an unmounted field
    // cannot show the price still sitting in state — so the state goes with it,
    // and the estimate can never be struck at a price nothing on screen names.
    setTicket((current) => ({
      ...current,
      orderType: next,
      limitPrice: needsLimit(next) ? current.limitPrice : null,
    }));
  });

  const tifRef = useRef<HTMLElement | null>(null);
  useCustomEvent<CustomEvent<string>>(tifRef, 'mdChange', (event) => {
    setTicket((current) => ({ ...current, timeInForce: (event.detail || 'day') as TimeInForce }));
  });

  /* ------------------------------------------------------------ submit flow */

  const formRef = useRef<HTMLFormElement | null>(null);
  const splitRef = useRef<HTMLElement | null>(null);
  const menuRef = useRef<HTMLElement | null>(null);
  const dialogRef = useRef<HTMLElement | null>(null);
  const cancelRef = useRef<HTMLElement | null>(null);
  const sendRef = useRef<HTMLElement | null>(null);
  const snackRef = useRef<HTMLElement | null>(null);
  const sheetRef = useRef<HTMLElement | null>(null);
  const closeSheetRef = useRef<HTMLElement | null>(null);
  const groupRef = useRef<HTMLElement | null>(null);

  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [snack, setSnack] = useState({ open: false, message: '' });

  /** Which half of the split button asked for this submit. */
  const pendingMode = useRef<'clear' | 'keep'>('clear');
  const timer = useRef<number | null>(null);

  const cancelTimer = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  useEffect(() => cancelTimer, [cancelTimer]);

  /** Hand the screen's toolbar a way to focus the first field. */
  useEffect(() => {
    if (!focusHandle) return undefined;
    focusHandle.current = () => {
      const el = instrumentRef.current as unknown as {
        focusInput?: () => Promise<void>;
      } | null;
      void el?.focusInput?.();
    };
    return () => {
      focusHandle.current = null;
    };
  }, [focusHandle, instrumentRef]);

  const clearTicket = useCallback(() => {
    // The mandate survives a clear: an advisor writing three tickets for one
    // household should not have to re-pick it three times.
    setTicket((current) => ({ ...initial, portfolioId: current.portfolioId }));
    setSeed((n) => n + 1);
  }, [initial]);

  const requestSubmit = useCallback((mode: 'clear' | 'keep') => {
    pendingMode.current = mode;
    // `requestSubmit()`, not `submit()`: it fires the form's `submit` event AND
    // runs constraint validation, so a `required` field that is still empty
    // reports itself rather than being silently skipped.
    formRef.current?.requestSubmit();
  }, []);

  useCustomEvent<CustomEvent>(splitRef, 'mdLeadingClick', () => requestSubmit('clear'));

  useCustomEvent<CustomEvent<{ checked: boolean }>>(splitRef, 'mdTrailingClick', (event) => {
    const open = Boolean(event.detail?.checked);
    const menu = menuRef.current as unknown as {
      show?: () => Promise<void>;
      close?: () => Promise<void>;
    } | null;
    if (open) void menu?.show?.();
    else void menu?.close?.();
    setMenuOpen(open);
  });

  /*
   * `md-menu`'s own open/close events do NOT bubble and are NOT composed: they
   * fire on the menu element itself, which is what this ref listens on. Without
   * it the split button's chevron stays rotated after an outside click or an
   * Escape, because the component cannot see a close it did not cause.
   */
  useCustomEvent<CustomEvent<void>>(menuRef, 'mdClose', () => setMenuOpen(false));

  // `md-menu-item`'s `mdClick` bubbles and is composed, so one listener on the
  // menu covers every row. The menu closes itself.
  useCustomEvent<CustomEvent<void>>(menuRef, 'mdClick', () => requestSubmit('keep'));

  /** The line the snackbar reports. Built BEFORE the ticket is cleared. */
  const completionMessage = useCallback(
    (mode: 'clear' | 'keep') =>
      tx(mode === 'keep' ? 'wealth.trade.submittedKept' : 'wealth.trade.submitted', {
        side: t(`wealth.orderSide.${ticket.side}`),
        quantity: t.formatNumber(estimate?.effectiveQuantity ?? 0, { maximumFractionDigits: 0 }),
        ticker: instrument?.ticker ?? '',
      }),
    [tx, t, ticket.side, estimate, instrument],
  );

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // The soft-disabled split button stops the pointer path; this stops the
    // keyboard one. `md-number-field` calls `requestSubmit()` on Enter, and
    // `exceedsCash` is not a constraint the platform knows anything about.
    if (blocked) {
      pendingMode.current = 'clear';
      return;
    }
    setConfirmOpen(true);
  };

  const confirmSend = () => {
    // Belt and braces beside the button's own `loading` state: one ticket, one
    // timer, so a second activation can never orphan the first.
    if (timer.current !== null) return;
    const mode = pendingMode.current;
    const message = completionMessage(mode);
    setSending(true);
    timer.current = window.setTimeout(() => {
      timer.current = null;
      setSending(false);
      setConfirmOpen(false);
      setSnack({ open: true, message });
      pendingMode.current = 'clear';
      if (mode === 'clear') clearTicket();
    }, SUBMIT_MS);
  };

  const abortSend = useCallback(() => {
    cancelTimer();
    setSending(false);
    setConfirmOpen(false);
    pendingMode.current = 'clear';
  }, [cancelTimer]);

  // Escape and the scrim emit `mdCancel` as well as `mdClose`; only `mdCancel`
  // is handled, so a dismissal is not processed twice.
  useCustomEvent<CustomEvent<void>>(dialogRef, 'mdCancel', abortSend);
  useCustomEvent<CustomEvent>(cancelRef, 'mdClick', abortSend);
  useCustomEvent<CustomEvent>(sendRef, 'mdClick', () => confirmSend());
  useCustomEvent<CustomEvent>(closeSheetRef, 'mdClick', () => setSheetOpen(false));

  /*
   * Auto-hide sets `open` on the element itself, and setting `open = false`
   * directly emits nothing — so `mdClose` is the only signal that the snackbar
   * has gone. Without this handler React would still believe it open, and the
   * next render would write `open="true"` back and re-show a stale message.
   */
  useCustomEvent<CustomEvent<{ reason: string }>>(snackRef, 'mdClose', () =>
    setSnack((current) => ({ ...current, open: false })),
  );

  useCustomEvent<CustomEvent<void>>(sheetRef, 'mdClose', () => setSheetOpen(false));

  /*
   * The ticket's two ancillary actions.
   *
   * `md-button-group`'s `syncChildren` writes `toggle = true` onto every child
   * unconditionally, because its usual job is a set of STATES. These are
   * actions, so each child's `mdClick` — cancelable, and reaching the group by
   * bubbling — is vetoed with `preventDefault()`. That suppresses the toggle
   * flip and leaves the group's selection permanently empty, while the reasons
   * to use a group at all survive: one tab stop, RTL-aware arrow-key movement
   * between the two actions, and the fused press flourish. Reading
   * `mdSelectionChange` here would report an empty diff every time, which is why
   * the identity comes off `mdClick`'s own detail instead.
   *
   * ONE WART REMAINS, and it is worth naming rather than hiding: `md-button`
   * renders `aria-pressed` whenever `toggle` is on, so both of these announce as
   * unpressed toggle buttons. The visual state never lies — the veto sees to
   * that — but the accessible one calls an action a state. There is no way to
   * opt out from here (`toggle` is re-written on every sync), so this is
   * reported upward as a gap in `md-button-group` rather than worked around with
   * a fight against the component.
   */
  useCustomEvent<CustomEvent<{ value: string }>>(groupRef, 'mdClick', (event) => {
    event.preventDefault();
    if (event.detail?.value === 'clear') clearTicket();
    if (event.detail?.value === 'book') setSheetOpen(true);
  });

  /*
   * The sheet shows the book for the chosen instrument, and the newest orders on
   * the whole book when nothing is chosen — both straight out of the selector,
   * filtered BY it rather than by an array method here. There is no bid/ask
   * depth in this console because the fixture carries none, and inventing a
   * ladder of prices is the one thing this showcase is not for.
   */
  const bookOrders = useMemo<Order[]>(
    () =>
      ticket.instrumentId ? getOrders({ instrumentId: ticket.instrumentId }) : getOrders({ limit: 8 }),
    [ticket.instrumentId],
  );

  const lotHint = instrument
    ? t('wealth.order.lotHint', {
        size: t.formatNumber(instrument.lotSize, { maximumFractionDigits: 0 }),
      })
    : '';

  /* ------------------------------------------------------------------ render */

  return (
    <>
      <div className="grid-wide">
        <Panel
          title={t('wealth.panel.ticket')}
          subtitle={tx('wealth.trade.ticketHint', { date: t.formatDate(REPORTING_DATE, 'medium') })}
        >
          <form ref={formRef} className="stack" onSubmit={handleSubmit}>
            {/*
              The set owns selection and has no `value` prop: `selected` on a
              child is how the current side is expressed, and a plain
              `aria-label` names the set, which carries no naming prop of its
              own. Two labelled segments is squarely inside the 2–5 M3 allows.
            */}
            <md-segmented-button-set ref={sideRef} aria-label={t('wealth.table.side')}>
              {SIDES.map((side) => (
                <md-segmented-button
                  key={side}
                  value={side}
                  label={t(`wealth.orderSide.${side}`)}
                  icon={side === 'buy' ? 'north_east' : 'south_west'}
                  selected={ticket.side === side}
                />
              ))}
            </md-segmented-button-set>

            <div className="ticket__fields">
              <md-autocomplete
                ref={instrumentRef}
                name="instrument"
                variant="outlined"
                required
                label={t('wealth.table.instrument')}
                placeholder={t('wealth.action.search')}
                supporting-text={instrument ? instrument.name : t('wealth.panel.universe')}
                value-missing-label={tx('wealth.trade.needInstrument')}
                // The two empty states say different things, because they ARE
                // different things: an empty universe and a query that matched
                // nothing. The second one can name what was typed, which is why
                // the query is tracked at all.
                no-options-text={t('wealth.empty.generic')}
                no-results-text={t('wealth.empty.search', { query })}
                // Forty instruments is far inside the 200-row threshold, but
                // `auto` is a threshold rather than a promise: pinning the
                // client-side path keeps the default label/supporting-text
                // filter (which matches the security NAME, not just the ticker)
                // instead of handing matching to the WASM engine.
                virtualize="never"
                reserve-supporting-space
              />

              <md-select
                ref={portfolioRef}
                name="portfolio"
                variant="outlined"
                required
                label={t('wealth.panel.mandate')}
                value={ticket.portfolioId}
                value-missing-label={tx('wealth.trade.needPortfolio')}
                supporting-text={
                  portfolio
                    ? `${t('wealth.kpi.cash')} · ${t.formatCurrency(portfolio.cashBalance, {
                        notation: 'compact',
                      })}`
                    : ''
                }
                reserve-supporting-space
              >
                {portfolios.map((p) => (
                  <md-select-option
                    key={p.id}
                    value={p.id}
                    label={p.reference}
                    supporting-text={t(p.strategyKey)}
                  >
                    {p.reference}
                  </md-select-option>
                ))}
              </md-select>

              {/*
                `md-number-field`, never `md-text-field type="number"` (§5.2).
                The steppers step by the instrument's LOT and `snap-on-step`
                keeps them on that grid, so the buttons cannot produce a size the
                security does not trade in. `error` here is display-only — the
                block itself belongs to the tooltip and to constraint validation
                — but this is where the reader is looking when the size is what
                went wrong.
              */}
              <md-number-field
                ref={quantityRef}
                name="quantity"
                variant="outlined"
                required
                label={t('wealth.table.quantity')}
                locale={locale}
                min={0}
                step={instrument?.lotSize ?? 1}
                // Shift-stepping moves ten lots. A keyboard affordance, not a
                // reported figure — every number this screen SHOWS comes from
                // the kit.
                large-step={(instrument?.lotSize ?? 1) * 10}
                snap-on-step
                steppers="inline"
                increment-label={t('wealth.action.next')}
                decrement-label={t('wealth.action.back')}
                value-missing-label={tx('wealth.trade.needQuantity')}
                supporting-text={lotHint}
                error={estimate?.exceedsCash || undefined}
                error-text={estimate?.exceedsCash ? t('wealth.order.exceedsCash') : undefined}
                reserve-supporting-space
              />

              <md-select
                ref={orderTypeRef}
                name="orderType"
                variant="outlined"
                required
                label={t('wealth.table.orderType')}
                value={ticket.orderType}
                reserve-supporting-space
              >
                {ORDER_TYPES.map((type) => (
                  <md-select-option key={type} value={type} label={t(`wealth.orderType.${type}`)}>
                    {t(`wealth.orderType.${type}`)}
                  </md-select-option>
                ))}
              </md-select>

              {/*
                Revealed, not permanently disabled. A market order has no limit
                price at all, and a greyed field is a question the reader keeps
                re-reading. Both of the other two types are struck at a price, so
                the field appears for both.

                It is its OWN component for the same reason the blotter's table
                is: `useElementProps` and `useCustomEvent` bind in effects keyed
                on a ref object that does not change when the element behind it
                is replaced. Rendered conditionally in this component's tree, the
                field would come back from a trip through `market` with its
                `mdInput` listener still attached to the discarded element — and
                a limit price that could be typed but never read.
              */}
              {showLimit ? (
                <LimitField
                  seed={seed}
                  value={ticket.limitPrice}
                  instrument={instrument}
                  locale={locale}
                  onChange={setLimitPrice}
                />
              ) : null}

              <md-select
                ref={tifRef}
                name="tif"
                variant="outlined"
                required
                label={t('wealth.table.timeInForce')}
                value={ticket.timeInForce}
                reserve-supporting-space
              >
                {TIME_IN_FORCE.map((tif) => (
                  <md-select-option key={tif} value={tif} label={t(`wealth.timeInForce.${tif}`)}>
                    {t(`wealth.timeInForce.${tif}`)}
                  </md-select-option>
                ))}
              </md-select>
            </div>

            <md-divider />

            <div className="ticket__actions">
              <md-button-group
                ref={groupRef}
                variant="standard"
                size="sm"
                selection-mode="multi-select"
                aria-label={tx('wealth.trade.actions')}
              >
                <md-button value="clear" variant="text" icon="restart_alt">
                  {tx('wealth.trade.clear')}
                </md-button>
                <md-button value="book" variant="text" icon="receipt_long">
                  {tx('wealth.trade.book')}
                </md-button>
              </md-button-group>

              {/*
                §7.2's pairing, and the reason it is in the manual: a
                soft-disabled control keeps `tabindex="0"`, so a keyboard reader
                reaches it and the tooltip tells them what is missing — which a
                hard `disabled` would hide entirely. `disabled` on the TOOLTIP is
                what switches the explanation off once there is nothing to
                explain.
              */}
              <md-tooltip
                text={blockKey ? tx(blockKey) : ''}
                disabled={!blocked || undefined}
                position="top-end"
              >
                <md-split-button
                  ref={splitRef}
                  id="trade-submit"
                  variant="filled"
                  size="sm"
                  icon="send"
                  label={t('wealth.action.submit')}
                  menu-label={tx('wealth.trade.submitOptions')}
                  controls="trade-submit-menu"
                  soft-disabled={blocked || undefined}
                  trailing-checked={menuOpen}
                />
              </md-tooltip>
            </div>
          </form>
        </Panel>

        <EstimatePanel
          tx={tx}
          estimate={estimate}
          instrument={instrument}
          portfolio={portfolio}
          typedQuantity={ticket.quantity ?? 0}
        />
      </div>

      {/*
        The split button ships no menu — it emits `mdTrailingClick` and this is
        the menu it opens. `open` is never written into the initial markup: the
        component wires positioning and dismissal from the `open` CHANGE handler,
        so a menu that starts open paints unpositioned and cannot be clicked away.
      */}
      {/*
        `bottom-end`, not `top-end`. A menu belongs BELOW the control that opens
        it unless there is no room, and md-menu already flips itself when the
        space is short — so pinning it upward only forced it to open over the
        form with 448px free underneath. The tooltip above uses `top-end`
        legitimately, which is where this almost certainly came from.
      */}
      {/* `vibrant` to match every other menu surface in this app: the default
          `baseline` is square-cornered on a surface container, and one menu in
          a different shape from the rest reads as a different control. */}
      <md-menu
        ref={menuRef}
        id="trade-submit-menu"
        anchor="trade-submit"
        placement="bottom-end"
        variant="vibrant"
      >
        <md-menu-item
          headline={tx('wealth.trade.submitDuplicate')}
          supporting-text={t('wealth.panel.ticket')}
        />
      </md-menu>

      {/* --------------------------------------------------------- confirm */}
      <md-dialog
        ref={dialogRef}
        open={confirmOpen}
        headline={tx('wealth.trade.confirm')}
        icon="fact_check"
        divider
        scrim-dismissible={sending ? 'false' : 'true'}
        close-label={t('wealth.action.close')}
      >
        <p className="muted">{tx('wealth.trade.confirmBody')}</p>

        <dl className="dl">
          <Fact label={t('wealth.table.side')}>
            <OrderSideChip side={ticket.side} />
          </Fact>
          <Fact label={t('wealth.table.instrument')}>
            {instrument ? instrument.name : t('wealth.common.na')}
          </Fact>
          <Fact label={t('wealth.panel.mandate')}>
            {portfolio ? portfolio.reference : t('wealth.common.na')}
          </Fact>
          <Fact label={t('wealth.table.quantity')}>
            <Num value={estimate?.effectiveQuantity ?? 0} />
          </Fact>
          <Fact label={t('wealth.table.orderType')}>
            {t(`wealth.orderType.${ticket.orderType}`)}
          </Fact>
          <Fact label={t('wealth.table.limitPrice')}>
            {showLimit && ticket.limitPrice !== null ? (
              <Money value={ticket.limitPrice} currency={instrument?.currency} digits={2} />
            ) : (
              t('wealth.common.na')
            )}
          </Fact>
          <Fact label={t('wealth.table.timeInForce')}>
            {t(`wealth.timeInForce.${ticket.timeInForce}`)}
          </Fact>
          <Fact label={t('wealth.table.estimatedValue')}>
            {estimate ? <Money value={estimate.estimatedValueEur} /> : t('wealth.common.na')}
          </Fact>
        </dl>

        {/*
          Indeterminate, because there is no measurable progress to report — the
          desk either has the ticket or it does not. `label` becomes the
          `aria-label`; the component's own default is the English word
          "Progress".
        */}
        {sending ? (
          <md-progress-indicator
            variant="linear"
            indeterminate
            label={tx('wealth.trade.submitting')}
          />
        ) : null}

        {/*
          Slotted actions replace the dialog's fallback pair and do NOT close it
          — they are our markup, so the close is ours to perform. M3 puts the
          dismissive action on the leading side and the component does not
          reorder them.

          Cancel stays LIVE while the ticket is in flight, because it is the
          abort, and it is the same abort Escape and the scrim perform. Confirm
          goes `loading`, which is not merely cosmetic — `md-button` counts it as
          disabled — and the events are read through `mdClick` rather than a
          React `onClick` because the disabled path calls `preventDefault()`
          without stopping propagation: the native click would still reach a
          React handler and start a second submission over the first.
        */}
        <md-button ref={cancelRef} slot="actions" variant="text">
          {t('wealth.action.cancel')}
        </md-button>
        <md-button
          ref={sendRef}
          slot="actions"
          variant="filled"
          icon="send"
          loading={sending || undefined}
        >
          {t('wealth.action.submit')}
        </md-button>
      </md-dialog>

      {/* ------------------------------------------------------------ book */}
      <md-bottom-sheet
        ref={sheetRef}
        open={sheetOpen}
        variant="detached"
        closeable
        top-divider
        headline={
          instrument
            ? tx('wealth.trade.bookFor', { ticker: instrument.ticker })
            : tx('wealth.trade.bookRecent')
        }
      >
        {instrument ? (
          <dl className="dl trade-sheet__facts">
            <Fact label={t('wealth.table.price')}>
              <Money value={instrument.price} currency={instrument.currency} digits={2} />
            </Fact>
            <Fact label={t('wealth.table.dayChange')}>
              <Signed value={instrument.dayChangePct} kind="percent" />
            </Fact>
            <Fact label={t('wealth.table.twelveMonth')}>
              <Signed value={instrument.twelveMonthReturn} kind="percent" />
            </Fact>
            <Fact label={t('wealth.table.quantity')}>
              <Num value={instrument.lotSize} />
            </Fact>
          </dl>
        ) : null}

        {bookOrders.length === 0 ? (
          <p className="muted">{tx('wealth.trade.bookEmpty')}</p>
        ) : (
          <md-list label={t('wealth.panel.blotter')}>
            {bookOrders.map((order) => (
              <md-list-item
                key={order.id}
                lines="3"
                overline={order.id}
                headline={order.instrumentName}
                supporting-text={t('wealth.order.filledOf', {
                  filled: t.formatNumber(order.filledQuantity, { maximumFractionDigits: 0 }),
                  quantity: t.formatNumber(order.quantity, { maximumFractionDigits: 0 }),
                })}
                trailing-supporting-text={t.formatCurrency(order.estimatedValueEur, {
                  notation: 'compact',
                })}
              >
                <span slot="leading">
                  <OrderSideChip side={order.side} />
                </span>
                <span slot="trailing">
                  <OrderStatusChip status={order.status} />
                </span>
              </md-list-item>
            ))}
          </md-list>
        )}

        {/*
          A slotted `close` element is NOT wired by the sheet — only the built-in
          `closeable` icon-button is — so this one closes it itself.
        */}
        <md-button ref={closeSheetRef} slot="actions" variant="text">
          {t('wealth.action.close')}
        </md-button>
      </md-bottom-sheet>

      {/* ---------------------------------------------------------- report */}
      <md-snackbar
        ref={snackRef}
        class="wealth-snackbar"
        open={snack.open}
        message={snack.message}
        position="bottom"
        closeable
        dismiss-label={t('wealth.action.close')}
      />
    </>
  );
}

/* ------------------------------------------------------------- limit price */

/**
 * The limit price, mounted only for the order types that carry one.
 *
 * Its own component because it comes and goes: both of the hooks it needs bind
 * in effects that do not re-run when the element behind the ref is replaced, and
 * a component that unmounts as a unit is what makes them re-run. `value` is
 * seeded rather than controlled — see the note at the top of this file about
 * `md-number-field` treating a programmatic write as a commit.
 */
function LimitField({
  seed,
  value,
  instrument,
  locale,
  onChange,
}: {
  seed: number;
  value: number | null;
  instrument: Instrument | undefined;
  locale: string;
  onChange: (value: number | null) => void;
}) {
  const t = useT();
  const tx = useTx();

  // Both value events, for the reason given beside the quantity field: typing
  // reports through `mdInput`, and the clamp that a commit applies arrives only
  // as `mdChange`.
  const ref = useElementProps<HTMLElement>({ value }, [seed]);
  useCustomEvent<CustomEvent<{ value: number | null }>>(ref, 'mdInput', (event) =>
    onChange(event.detail.value),
  );
  useCustomEvent<CustomEvent<{ value: number | null }>>(ref, 'mdChange', (event) =>
    onChange(event.detail.value),
  );

  return (
    <md-number-field
      ref={ref}
      name="limit"
      variant="outlined"
      required
      label={t('wealth.table.limitPrice')}
      locale={locale}
      min={0}
      step={0.01}
      small-step={0.01}
      large-step={1}
      increment-label={t('wealth.action.next')}
      decrement-label={t('wealth.action.back')}
      value-missing-label={tx('wealth.trade.needLimit')}
      /*
        `format-options` takes a JSON attribute as well as the object property,
        and the attribute form re-renders with the instrument — so the field is
        always denominated in the security's own currency rather than the
        mandate's reporting currency.
      */
      format-options={JSON.stringify({
        style: 'currency',
        currency: instrument?.currency ?? BASE_CURRENCY,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}
      supporting-text={
        instrument
          ? `${t('wealth.table.price')} · ${t.formatCurrency(instrument.price, {
              currency: instrument.currency,
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`
          : ''
      }
      reserve-supporting-space
    />
  );
}

/* ---------------------------------------------------------------- estimate */

/**
 * The live readout beside the ticket.
 *
 * A top-level component with explicit props rather than a closure inside
 * `TradeTicket`: a component declared inside a render function is a new type on
 * every render, so React would unmount and remount this whole subtree — the
 * sparkline included — on every keystroke in the quantity field.
 */
function EstimatePanel({
  tx,
  estimate,
  instrument,
  portfolio,
  typedQuantity,
}: {
  tx: Tx;
  estimate: OrderEstimate | null;
  instrument: Instrument | undefined;
  portfolio: Portfolio | undefined;
  typedQuantity: number;
}) {
  const t = useT();
  const { state } = useShowcase();

  if (!estimate || !instrument) {
    return (
      <Panel title={tx('wealth.trade.estimate')}>
        <p className="muted">{tx('wealth.trade.estimateEmpty')}</p>
      </Panel>
    );
  }

  return (
    <Panel title={tx('wealth.trade.estimate')} subtitle={instrument.name}>
      <div className="stack">
        <div>
          <p className="estimate__value">
            <Money
              value={estimate.estimatedValue}
              currency={estimate.currency}
              digits={estimate.currency === BASE_CURRENCY ? 0 : 2}
            />
          </p>
          {estimate.currency === BASE_CURRENCY ? null : (
            <p className="estimate__sub">
              <Money value={estimate.estimatedValueEur} /> · {BASE_CURRENCY}
            </p>
          )}
        </div>

        {/*
          Twelve month-end closes, straight off the instrument. The wrapper is
          what makes `data`, `labels` and `valueFormatter` land as JS properties;
          an `md-sparkline` written out here would stringify all three.
        */}
        <div className="estimate__spark">
          <Sparkline
            data={instrument.priceSeries}
            labels={instrument.priceSeriesDates.map((date) => t.formatDate(date, 'monthYear'))}
            valueFormatter={(value) =>
              value === null
                ? t('wealth.common.na')
                : t.formatCurrency(value, {
                    currency: instrument.currency,
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })
            }
            locale={state.locale}
            variant="line"
            color="primary"
            curve="monotone"
            show-marks="extremes"
            height="56px"
          />
        </div>

        <dl className="dl">
          <Fact label={t('wealth.table.price')}>
            <Money value={estimate.referencePrice} currency={estimate.currency} digits={2} />
          </Fact>
          <Fact label={t('wealth.table.quantity')}>
            <Num value={estimate.effectiveQuantity} />
          </Fact>
          <Fact label={t('wealth.table.weight')}>
            <Signed value={estimate.weightImpact} kind="percent" />
          </Fact>
          <Fact label={t('wealth.kpi.cash')}>
            {portfolio ? <Money value={portfolio.cashBalance} compact /> : t('wealth.common.na')}
          </Fact>
        </dl>

        <p className="estimate__sub">
          {tx('wealth.trade.lots', {
            lots: t.formatNumber(estimate.lots, { maximumFractionDigits: 0 }),
            size: t.formatNumber(instrument.lotSize, { maximumFractionDigits: 0 }),
          })}
        </p>

        {/*
          The lot rule, made visible. `orderEstimate` rounds DOWN to a whole
          number of lots, so a typed 1,750 of a bond that trades in 1,000 becomes
          1,000 — and a reader who is not told that reads the estimate as wrong
          rather than as rounded.
        */}
        {typedQuantity !== estimate.effectiveQuantity ? (
          <p className="estimate__sub">
            {tx('wealth.trade.snapped', {
              typed: t.formatNumber(typedQuantity, { maximumFractionDigits: 0 }),
            })}
          </p>
        ) : null}

        {estimate.exceedsCash ? <p className="pl-down">{t('wealth.order.exceedsCash')}</p> : null}
      </div>
    </Panel>
  );
}
