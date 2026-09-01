<!--
  The order ticket: pick a side, an instrument, a mandate and a size, watch the
  estimate move, then confirm and send.

  THE ONE PIECE OF ARITHMETIC ON THIS SCREEN IS NOT ON THIS SCREEN.
  `orderEstimate()` in the kit snaps the quantity to the instrument's lot size,
  strikes the price at the limit or the last close, converts at the frozen
  fixture FX rate, reports the weight the trade would add to the mandate, and
  says whether a buy exceeds the mandate's cash. Every figure below is a field
  of the object it returns. A change handler that multiplied a price by a
  quantity would be a second formula, and five ports would eventually disagree
  about what a ticket is worth.

  WHY THE FORM IS A REAL `<form>`. `md-autocomplete`, `md-select` and
  `md-number-field` are all form-associated through `ElementInternals`, so
  `required` on them genuinely blocks `requestSubmit()` and reports the missing
  field. `md-split-button` is not form-associated and has no `type`, so its
  `mdLeadingClick` calls `requestSubmit()` on the form rather than pretending to
  be a submit button. The flow therefore has two independent gates that agree:
  the soft-disabled state PREDICTS the block (and a tooltip says why), and
  constraint validation ENFORCES it.

  WHY THE NUMBER FIELDS ARE NOT SVELTE-CONTROLLED. `md-number-field` treats a
  programmatic `value` write as a commit: it reformats the display. Re-assigning
  `value={quantity}` on every keystroke would therefore regroup the digits under
  the caret while the user types `1234` into `1,234`. The two number fields are
  seeded through `objectProps` keyed on a reset counter instead — the props
  object is rebuilt ONLY when `seed` changes, because Svelte's reactive
  statements track only the variables they mention and the ticket is read
  through a function call the compiler does not trace. So the app writes to
  them exactly when it means to — on mount, on a clear, and when the instrument
  changes — and never while the user is typing.

  THREE COMPOSITION RULES THIS FILE IS BUILT AROUND (§7 of `main-llm.md`):
    - `md-split-button` renders no menu. The trailing half emits
      `mdTrailingClick`; this file owns the `md-menu`, anchors it by id, and
      puts `trailing-checked` back to false from the menu's own `mdClose`.
    - A soft-disabled action is paired with an `md-tooltip` that says WHY
      (§7.2). `disabled` on the tooltip switches the explanation off once the
      block clears, so a usable button never carries a description of its own
      unavailability.
    - There is exactly ONE dialog, and nothing opens another from inside it.
      The confirmation and the progress indicator share it (§7.3).
-->
<script lang="ts" context="module">
  import type { OrderSide, OrderType, TimeInForce } from '@awc-ui/showcase-kit/wealth';

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
   * have to behave identically for a cross-framework comparison to mean
   * anything. It gates an animation and nothing that is rendered as a value.
   */
  const SUBMIT_MS = 900;

  /** `market` is struck at the last close; the other two carry a price. */
  function needsLimit(orderType: OrderType): boolean {
    return orderType !== 'market';
  }
</script>

<script lang="ts">
  import { onDestroy } from 'svelte';
  import {
    getInstrumentById,
    getInstruments,
    getOrders,
    getPortfolioById,
    getPortfolios,
    orderEstimate,
    REPORTING_DATE,
    type Order,
    type OrderEstimate,
  } from '@awc-ui/showcase-kit/wealth';
  import { intlTag } from '@awc-ui/showcase-kit/i18n';
  import { objectProps } from '$lib/elements';
  import { state, t } from '$lib/showcase';
  import Panel from '$lib/components/Panel.svelte';
  import Fact from '$lib/bits/Fact.svelte';
  import Money from '$lib/bits/Money.svelte';
  import Num from '$lib/bits/Num.svelte';
  import Signed from '$lib/bits/Signed.svelte';
  import Chips from '$lib/bits/Chips.svelte';
  import EstimatePanel from './EstimatePanel.svelte';
  import LimitField from './LimitField.svelte';
  import { tx } from './trade-strings';
  import './snackbar.css';

  $: locale = intlTag($state.locale);

  const portfolios = getPortfolios();
  const instruments = getInstruments();

  /*
   * The mandate is pre-selected and the instrument is not, and that is the
   * starting state on purpose: the ticket opens with a live cash balance to
   * trade against and with exactly one thing missing, so the soft-disabled
   * submit and its tooltip are the first thing the screen demonstrates rather
   * than a state you have to break it to reach.
   */
  const initial: Ticket = {
    side: 'buy',
    instrumentId: '',
    portfolioId: portfolios[0]?.id ?? '',
    quantity: null,
    orderType: 'market',
    limitPrice: null,
    timeInForce: 'day',
  };

  let ticket: Ticket = { ...initial };

  /*
   * Bumped whenever the app — rather than the user — should own what is in the
   * two number fields. The seeded props objects below are rebuilt when it
   * changes, which pushes the current `ticket` values into the elements;
   * leaving it alone lets the user type undisturbed.
   */
  let seed = 0;

  $: instrument = ticket.instrumentId ? getInstrumentById(ticket.instrumentId) : undefined;
  $: portfolio = ticket.portfolioId ? getPortfolioById(ticket.portfolioId) : undefined;
  $: showLimit = needsLimit(ticket.orderType);

  /* --------------------------------------------------------------- estimate */

  $: estimate = (ticket.instrumentId
    ? orderEstimate({
        instrumentId: ticket.instrumentId,
        quantity: ticket.quantity ?? 0,
        side: ticket.side,
        limitPrice: needsLimit(ticket.orderType) ? ticket.limitPrice : null,
        portfolioId: ticket.portfolioId || undefined,
      })
    : null) as OrderEstimate | null;

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
  $: blockKey = !ticket.instrumentId
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

  $: blocked = blockKey !== null;

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
  const instrumentOptions = instruments.map((i) => ({
    value: i.id,
    label: i.ticker,
    supportingText: i.name,
  }));

  /*
   * `options`, `value` and `inputValue` are all JS properties here. An array has
   * no attribute form, and `md-autocomplete` deliberately IGNORES the `selected`
   * hint on its option rows — setting `value` (the commitment) and `inputValue`
   * (the visible text) is the whole of its preselection contract.
   *
   * THE PROPS OBJECT IS REBUILT ONLY WHEN THE COMMITTED ID REALLY CHANGES.
   * `instrumentId` below is a primitive gate: Svelte re-runs `$: instrumentId =
   * ticket.instrumentId` on every ticket write, but an assignment of the SAME
   * string does not invalidate it, so `instrumentProps` — and therefore the
   * `objectProps` re-assignment — fires only on a genuine selection. Deriving
   * this from `ticket` or `instrument` directly would re-assign `inputValue` on
   * every quantity keystroke and wipe a query being typed into the picker.
   */
  $: instrumentId = ticket.instrumentId;
  $: instrumentProps = {
    options: instrumentOptions,
    value: instrumentId,
    inputValue: (instrumentId ? getInstrumentById(instrumentId)?.ticker : '') ?? '',
  };

  /*
   * The typed text, kept only so the "nothing matched" row can name it.
   *
   * `mdInput` is TYPING and `mdChange` is SELECTION — two distinct signals on
   * this component, and confusing them is its most common misuse. Nothing here
   * writes `inputValue` back: assigning it would change the visible text without
   * filtering anything, because only text the user typed counts as the query.
   */
  let query = '';
  function onInstrumentInput(event: Event) {
    query = (event as CustomEvent<string>).detail ?? '';
  }

  function onInstrumentChange(event: Event) {
    const detail = (event as CustomEvent<string | string[]>).detail;
    const next = Array.isArray(detail) ? (detail[0] ?? '') : (detail ?? '');
    /*
     * ONLY A REAL INSTRUMENT COUNTS AS A SELECTION.
     *
     * `mdChange` can carry text that matched no option — type "orbs" and press
     * ArrowDown and it arrives as `"orbs"`. Storing that as `instrumentId` made
     * `instrument` undefined, which drove `inputValue` to `''` through the
     * seeded props and wiped the field the moment you reached for the list.
     * Clearing an empty value is still a selection (it is how the ticket is
     * reset), so only a NON-empty id that resolves to nothing is refused.
     */
    if (next && !getInstrumentById(next)) return;
    // A new instrument invalidates the limit price: it was quoted in the old
    // security's currency and at the old security's scale. The quantity is kept
    // on purpose — the estimate re-snaps it to the new lot size and reports the
    // result, which is the lot rule doing visible work.
    ticket = { ...ticket, instrumentId: next, limitPrice: null };
    seed += 1;
  }

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
  function onQuantityValue(event: Event) {
    ticket = { ...ticket, quantity: (event as CustomEvent<{ value: number | null }>).detail.value };
  }

  /*
   * The quantity field's seeded write. `quantityPropsFor` reads the ticket
   * through a call the compiler does not trace, so `seed` is the ONLY
   * dependency — Svelte's translation of the React build's
   * `useElementProps({ value }, [seed])`.
   */
  $: quantityProps = quantityPropsFor(seed);
  function quantityPropsFor(_seed: number): { value: number | null } {
    return { value: ticket.quantity };
  }

  function setLimitPrice(value: number | null) {
    ticket = { ...ticket, limitPrice: value };
  }

  function onSideChange(event: Event) {
    // A single-select set always reports exactly one value and never an empty
    // array — only `multiselect` can clear a choice.
    const next = (event as CustomEvent<string[]>).detail?.[0] as OrderSide | undefined;
    if (next) ticket = { ...ticket, side: next };
  }

  function onPortfolioChange(event: Event) {
    ticket = { ...ticket, portfolioId: (event as CustomEvent<string>).detail ?? '' };
  }

  function onOrderTypeChange(event: Event) {
    const next = ((event as CustomEvent<string>).detail || 'market') as OrderType;
    // Dropping to `market` unmounts the limit field, and an unmounted field
    // cannot show the price still sitting in state — so the state goes with it,
    // and the estimate can never be struck at a price nothing on screen names.
    ticket = {
      ...ticket,
      orderType: next,
      limitPrice: needsLimit(next) ? ticket.limitPrice : null,
    };
  }

  function onTifChange(event: Event) {
    ticket = {
      ...ticket,
      timeInForce: ((event as CustomEvent<string>).detail || 'day') as TimeInForce,
    };
  }

  /* ------------------------------------------------------------ submit flow */

  let formEl: HTMLFormElement | undefined;
  let instrumentEl: HTMLElement | undefined;
  let menuEl: HTMLElement | undefined;

  let menuOpen = false;
  let confirmOpen = false;
  let sending = false;
  let sheetOpen = false;
  let snack = { open: false, message: '' };

  /** Which half of the split button asked for this submit. */
  let pendingMode: 'clear' | 'keep' = 'clear';
  let timer: number | null = null;

  function cancelTimer() {
    if (timer !== null) {
      window.clearTimeout(timer);
      timer = null;
    }
  }

  // Cleared on the way out, so a fast click-through cannot leave a pending
  // timeout mutating a torn-down component's state.
  onDestroy(cancelTimer);

  /** The screen's toolbar calls this to put focus in the first field. */
  export function focusInstrument() {
    const el = instrumentEl as unknown as { focusInput?: () => Promise<void> } | undefined;
    void el?.focusInput?.();
  }

  function clearTicket() {
    // The mandate survives a clear: an advisor writing three tickets for one
    // household should not have to re-pick it three times.
    ticket = { ...initial, portfolioId: ticket.portfolioId };
    seed += 1;
  }

  function requestSubmit(mode: 'clear' | 'keep') {
    pendingMode = mode;
    // `requestSubmit()`, not `submit()`: it fires the form's `submit` event AND
    // runs constraint validation, so a `required` field that is still empty
    // reports itself rather than being silently skipped.
    formEl?.requestSubmit();
  }

  function onTrailingClick(event: Event) {
    const open = Boolean((event as CustomEvent<{ checked: boolean }>).detail?.checked);
    const menu = menuEl as unknown as {
      show?: () => Promise<void>;
      close?: () => Promise<void>;
    } | undefined;
    if (open) void menu?.show?.();
    else void menu?.close?.();
    menuOpen = open;
  }

  /** The line the snackbar reports. Built BEFORE the ticket is cleared. */
  function completionMessage(mode: 'clear' | 'keep'): string {
    return $tx(mode === 'keep' ? 'wealth.trade.submittedKept' : 'wealth.trade.submitted', {
      side: $t(`wealth.orderSide.${ticket.side}`),
      quantity: $t.formatNumber(estimate?.effectiveQuantity ?? 0, { maximumFractionDigits: 0 }),
      ticker: instrument?.ticker ?? '',
    });
  }

  function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    // The soft-disabled split button stops the pointer path; this stops the
    // keyboard one. `md-number-field` calls `requestSubmit()` on Enter, and
    // `exceedsCash` is not a constraint the platform knows anything about.
    if (blocked) {
      pendingMode = 'clear';
      return;
    }
    confirmOpen = true;
  }

  function confirmSend() {
    // Belt and braces beside the button's own `loading` state: one ticket, one
    // timer, so a second activation can never orphan the first.
    if (timer !== null) return;
    const mode = pendingMode;
    const message = completionMessage(mode);
    sending = true;
    timer = window.setTimeout(() => {
      timer = null;
      sending = false;
      confirmOpen = false;
      snack = { open: true, message };
      pendingMode = 'clear';
      if (mode === 'clear') clearTicket();
    }, SUBMIT_MS);
  }

  function abortSend() {
    cancelTimer();
    sending = false;
    confirmOpen = false;
    pendingMode = 'clear';
  }

  /*
   * Auto-hide sets `open` on the element itself, and setting `open = false`
   * directly emits nothing — so `mdClose` is the only signal that the snackbar
   * has gone. Without this handler Svelte would still believe it open, and the
   * next render would write `open` back and re-show a stale message.
   */
  function onSnackClose() {
    snack = { ...snack, open: false };
  }

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
  function onGroupClick(event: Event) {
    event.preventDefault();
    const value = (event as CustomEvent<{ value: string }>).detail?.value;
    if (value === 'clear') clearTicket();
    if (value === 'book') sheetOpen = true;
  }

  /*
   * The sheet shows the book for the chosen instrument, and the newest orders on
   * the whole book when nothing is chosen — both straight out of the selector,
   * filtered BY it rather than by an array method here. There is no bid/ask
   * depth in this console because the fixture carries none, and inventing a
   * ladder of prices is the one thing this showcase is not for.
   */
  $: bookOrders = (ticket.instrumentId
    ? getOrders({ instrumentId: ticket.instrumentId })
    : getOrders({ limit: 8 })) as Order[];

  $: lotHint = instrument
    ? $t('wealth.order.lotHint', {
        size: $t.formatNumber(instrument.lotSize, { maximumFractionDigits: 0 }),
      })
    : '';
</script>

<div class="grid-wide">
  <Panel
    title={$t('wealth.panel.ticket')}
    subtitle={$tx('wealth.trade.ticketHint', { date: $t.formatDate(REPORTING_DATE, 'medium') })}
  >
    <form bind:this={formEl} class="stack" on:submit={handleSubmit}>
      <!--
        The set owns selection and has no `value` prop: `selected` on a child is
        how the current side is expressed, and a plain `aria-label` names the
        set, which carries no naming prop of its own. Two labelled segments is
        squarely inside the 2–5 M3 allows.
      -->
      <md-segmented-button-set aria-label={$t('wealth.table.side')} on:mdChange={onSideChange}>
        {#each SIDES as side (side)}
          <md-segmented-button
            value={side}
            label={$t(`wealth.orderSide.${side}`)}
            icon={side === 'buy' ? 'north_east' : 'south_west'}
            selected={ticket.side === side}
          ></md-segmented-button>
        {/each}
      </md-segmented-button-set>

      <div class="ticket__fields">
        <md-autocomplete
          bind:this={instrumentEl}
          use:objectProps={instrumentProps}
          name="instrument"
          variant="outlined"
          required
          label={$t('wealth.table.instrument')}
          placeholder={$t('wealth.action.search')}
          supporting-text={instrument ? instrument.name : $t('wealth.panel.universe')}
          value-missing-label={$tx('wealth.trade.needInstrument')}
          no-options-text={$t('wealth.empty.generic')}
          no-results-text={$t('wealth.empty.search', { query })}
          virtualize="never"
          reserve-supporting-space
          on:mdInput={onInstrumentInput}
          on:mdChange={onInstrumentChange}
        ></md-autocomplete>
        <!-- The two empty states above say different things, because they ARE
             different things: an empty universe and a query that matched
             nothing. The second one can name what was typed, which is why the
             query is tracked at all. And forty instruments is far inside the
             200-row threshold, but `auto` is a threshold rather than a promise:
             pinning the client-side path keeps the default label/supporting-text
             filter (which matches the security NAME, not just the ticker)
             instead of handing matching to the WASM engine. -->

        <md-select
          name="portfolio"
          variant="outlined"
          required
          label={$t('wealth.panel.mandate')}
          value={ticket.portfolioId}
          value-missing-label={$tx('wealth.trade.needPortfolio')}
          supporting-text={portfolio
            ? `${$t('wealth.kpi.cash')} · ${$t.formatCurrency(portfolio.cashBalance, {
                notation: 'compact',
              })}`
            : ''}
          reserve-supporting-space
          on:mdChange={onPortfolioChange}
        >
          {#each portfolios as p (p.id)}
            <md-select-option value={p.id} label={p.reference} supporting-text={$t(p.strategyKey)}>
              {p.reference}
            </md-select-option>
          {/each}
        </md-select>

        <!--
          `md-number-field`, never `md-text-field type="number"` (§5.2). The
          steppers step by the instrument's LOT and `snap-on-step` keeps them on
          that grid, so the buttons cannot produce a size the security does not
          trade in. `error` here is display-only — the block itself belongs to
          the tooltip and to constraint validation — but this is where the
          reader is looking when the size is what went wrong. Shift-stepping
          moves ten lots: a keyboard affordance, not a reported figure — every
          number this screen SHOWS comes from the kit.
        -->
        <md-number-field
          use:objectProps={quantityProps}
          name="quantity"
          variant="outlined"
          required
          label={$t('wealth.table.quantity')}
          {locale}
          min={0}
          step={instrument?.lotSize ?? 1}
          large-step={(instrument?.lotSize ?? 1) * 10}
          snap-on-step
          steppers="inline"
          increment-label={$t('wealth.action.next')}
          decrement-label={$t('wealth.action.back')}
          value-missing-label={$tx('wealth.trade.needQuantity')}
          supporting-text={lotHint}
          error={estimate?.exceedsCash || undefined}
          error-text={estimate?.exceedsCash ? $t('wealth.order.exceedsCash') : undefined}
          reserve-supporting-space
          on:mdInput={onQuantityValue}
          on:mdChange={onQuantityValue}
        ></md-number-field>

        <md-select
          name="orderType"
          variant="outlined"
          required
          label={$t('wealth.table.orderType')}
          value={ticket.orderType}
          reserve-supporting-space
          on:mdChange={onOrderTypeChange}
        >
          {#each ORDER_TYPES as type (type)}
            <md-select-option value={type} label={$t(`wealth.orderType.${type}`)}>
              {$t(`wealth.orderType.${type}`)}
            </md-select-option>
          {/each}
        </md-select>

        <!--
          Revealed, not permanently disabled. A market order has no limit price
          at all, and a greyed field is a question the reader keeps re-reading.
          Both of the other two types are struck at a price, so the field
          appears for both.

          Its OWN component, as in the React source: the seeded write must read
          the CURRENT limit price when the field mounts, and a component's
          init-time seeding is what guarantees that — inline, the seeded props
          would date from the last `seed` bump rather than from the mount.
        -->
        {#if showLimit}
          <LimitField
            {seed}
            value={ticket.limitPrice}
            {instrument}
            {locale}
            onChange={setLimitPrice}
          />
        {/if}

        <md-select
          name="tif"
          variant="outlined"
          required
          label={$t('wealth.table.timeInForce')}
          value={ticket.timeInForce}
          reserve-supporting-space
          on:mdChange={onTifChange}
        >
          {#each TIME_IN_FORCE as tif (tif)}
            <md-select-option value={tif} label={$t(`wealth.timeInForce.${tif}`)}>
              {$t(`wealth.timeInForce.${tif}`)}
            </md-select-option>
          {/each}
        </md-select>
      </div>

      <md-divider></md-divider>

      <div class="ticket__actions">
        <md-button-group
          variant="standard"
          size="sm"
          selection-mode="multi-select"
          aria-label={$tx('wealth.trade.actions')}
          on:mdClick={onGroupClick}
        >
          <md-button value="clear" variant="text" icon="restart_alt">
            {$tx('wealth.trade.clear')}
          </md-button>
          <md-button value="book" variant="text" icon="receipt_long">
            {$tx('wealth.trade.book')}
          </md-button>
        </md-button-group>

        <!--
          §7.2's pairing, and the reason it is in the manual: a soft-disabled
          control keeps `tabindex="0"`, so a keyboard reader reaches it and the
          tooltip tells them what is missing — which a hard `disabled` would
          hide entirely. `disabled` on the TOOLTIP is what switches the
          explanation off once there is nothing to explain.
        -->
        <md-tooltip
          text={blockKey ? $tx(blockKey) : ''}
          disabled={!blocked || undefined}
          position="top-end"
        >
          <md-split-button
            id="trade-submit"
            variant="filled"
            size="sm"
            icon="send"
            label={$t('wealth.action.submit')}
            menu-label={$tx('wealth.trade.submitOptions')}
            controls="trade-submit-menu"
            soft-disabled={blocked || undefined}
            trailing-checked={menuOpen}
            on:mdLeadingClick={() => requestSubmit('clear')}
            on:mdTrailingClick={onTrailingClick}
          ></md-split-button>
        </md-tooltip>
      </div>
    </form>
  </Panel>

  <EstimatePanel
    {estimate}
    {instrument}
    {portfolio}
    typedQuantity={ticket.quantity ?? 0}
  />
</div>

<!--
  The split button ships no menu — it emits `mdTrailingClick` and this is the
  menu it opens. `open` is never written into the initial markup: the component
  wires positioning and dismissal from the `open` CHANGE handler, so a menu that
  starts open paints unpositioned and cannot be clicked away.

  `bottom-end`, not `top-end`. A menu belongs BELOW the control that opens it
  unless there is no room, and md-menu already flips itself when the space is
  short — so pinning it upward only forced it to open over the form with 448px
  free underneath. The tooltip above uses `top-end` legitimately, which is where
  this almost certainly came from.

  `vibrant` to match every other menu surface in this app: the default
  `baseline` is square-cornered on a surface container, and one menu in a
  different shape from the rest reads as a different control.

  `md-menu`'s own open/close events do NOT bubble and are NOT composed: they
  fire on the menu element itself, which is what `on:mdClose` here listens on.
  Without it the split button's chevron stays rotated after an outside click or
  an Escape, because the component cannot see a close it did not cause.
  `md-menu-item`'s `mdClick` DOES bubble and is composed, so one listener on the
  menu covers every row; the menu closes itself.
-->
<md-menu
  bind:this={menuEl}
  id="trade-submit-menu"
  anchor="trade-submit"
  placement="bottom-end"
  variant="vibrant"
  on:mdClose={() => (menuOpen = false)}
  on:mdClick={() => requestSubmit('keep')}
>
  <md-menu-item
    headline={$tx('wealth.trade.submitDuplicate')}
    supporting-text={$t('wealth.panel.ticket')}
  ></md-menu-item>
</md-menu>

<!-- ----------------------------------------------------------- confirm -->
<!-- Escape and the scrim emit `mdCancel` as well as `mdClose`; only `mdCancel`
     is handled, so a dismissal is not processed twice. -->
<md-dialog
  open={confirmOpen}
  headline={$tx('wealth.trade.confirm')}
  icon="fact_check"
  divider
  scrim-dismissible={sending ? 'false' : 'true'}
  close-label={$t('wealth.action.close')}
  on:mdCancel={abortSend}
>
  <p class="muted">{$tx('wealth.trade.confirmBody')}</p>

  <dl class="dl">
    <Fact label={$t('wealth.table.side')}>
      <Chips kind="orderSide" value={ticket.side} />
    </Fact>
    <Fact label={$t('wealth.table.instrument')}>
      {instrument ? instrument.name : $t('wealth.common.na')}
    </Fact>
    <Fact label={$t('wealth.panel.mandate')}>
      {portfolio ? portfolio.reference : $t('wealth.common.na')}
    </Fact>
    <Fact label={$t('wealth.table.quantity')}>
      <Num value={estimate?.effectiveQuantity ?? 0} />
    </Fact>
    <Fact label={$t('wealth.table.orderType')}>
      {$t(`wealth.orderType.${ticket.orderType}`)}
    </Fact>
    <Fact label={$t('wealth.table.limitPrice')}>
      {#if showLimit && ticket.limitPrice !== null}
        <Money value={ticket.limitPrice} currency={instrument?.currency} digits={2} />
      {:else}
        {$t('wealth.common.na')}
      {/if}
    </Fact>
    <Fact label={$t('wealth.table.timeInForce')}>
      {$t(`wealth.timeInForce.${ticket.timeInForce}`)}
    </Fact>
    <Fact label={$t('wealth.table.estimatedValue')}>
      {#if estimate}
        <Money value={estimate.estimatedValueEur} />
      {:else}
        {$t('wealth.common.na')}
      {/if}
    </Fact>
  </dl>

  <!--
    Indeterminate, because there is no measurable progress to report — the desk
    either has the ticket or it does not. `label` becomes the `aria-label`; the
    component's own default is the English word "Progress".
  -->
  {#if sending}
    <md-progress-indicator
      variant="linear"
      indeterminate
      label={$tx('wealth.trade.submitting')}
    ></md-progress-indicator>
  {/if}

  <!--
    Slotted actions replace the dialog's fallback pair and do NOT close it —
    they are our markup, so the close is ours to perform. M3 puts the dismissive
    action on the leading side and the component does not reorder them.

    Cancel stays LIVE while the ticket is in flight, because it is the abort,
    and it is the same abort Escape and the scrim perform. Confirm goes
    `loading`, which is not merely cosmetic — `md-button` counts it as disabled
    — and the events are read through `mdClick` rather than a native `on:click`
    because the disabled path calls `preventDefault()` without stopping
    propagation: the native click would still reach a plain handler and start a
    second submission over the first.
  -->
  <md-button slot="actions" variant="text" on:mdClick={abortSend}>
    {$t('wealth.action.cancel')}
  </md-button>
  <md-button
    slot="actions"
    variant="filled"
    icon="send"
    loading={sending || undefined}
    on:mdClick={() => confirmSend()}
  >
    {$t('wealth.action.submit')}
  </md-button>
</md-dialog>

<!-- -------------------------------------------------------------- book -->
<md-bottom-sheet
  open={sheetOpen}
  variant="detached"
  closeable
  top-divider
  headline={instrument
    ? $tx('wealth.trade.bookFor', { ticker: instrument.ticker })
    : $tx('wealth.trade.bookRecent')}
  on:mdClose={() => (sheetOpen = false)}
>
  {#if instrument}
    <dl class="dl trade-sheet__facts">
      <Fact label={$t('wealth.table.price')}>
        <Money value={instrument.price} currency={instrument.currency} digits={2} />
      </Fact>
      <Fact label={$t('wealth.table.dayChange')}>
        <Signed value={instrument.dayChangePct} kind="percent" />
      </Fact>
      <Fact label={$t('wealth.table.twelveMonth')}>
        <Signed value={instrument.twelveMonthReturn} kind="percent" />
      </Fact>
      <Fact label={$t('wealth.table.quantity')}>
        <Num value={instrument.lotSize} />
      </Fact>
    </dl>
  {/if}

  {#if bookOrders.length === 0}
    <p class="muted">{$tx('wealth.trade.bookEmpty')}</p>
  {:else}
    <md-list label={$t('wealth.panel.blotter')}>
      {#each bookOrders as order (order.id)}
        <md-list-item
          lines="3"
          overline={order.id}
          headline={order.instrumentName}
          supporting-text={$t('wealth.order.filledOf', {
            filled: $t.formatNumber(order.filledQuantity, { maximumFractionDigits: 0 }),
            quantity: $t.formatNumber(order.quantity, { maximumFractionDigits: 0 }),
          })}
          trailing-supporting-text={$t.formatCurrency(order.estimatedValueEur, {
            notation: 'compact',
          })}
        >
          <span slot="leading">
            <Chips kind="orderSide" value={order.side} />
          </span>
          <span slot="trailing">
            <Chips kind="orderStatus" value={order.status} />
          </span>
        </md-list-item>
      {/each}
    </md-list>
  {/if}

  <!--
    A slotted `close` element is NOT wired by the sheet — only the built-in
    `closeable` icon-button is — so this one closes it itself.
  -->
  <md-button slot="actions" variant="text" on:mdClick={() => (sheetOpen = false)}>
    {$t('wealth.action.close')}
  </md-button>
</md-bottom-sheet>

<!-- ------------------------------------------------------------ report -->
<md-snackbar
  class="wealth-snackbar"
  open={snack.open}
  message={snack.message}
  position="bottom"
  closeable
  dismiss-label={$t('wealth.action.close')}
  on:mdClose={onSnackClose}
></md-snackbar>
