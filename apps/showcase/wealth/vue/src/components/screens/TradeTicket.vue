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

  WHY THE NUMBER FIELDS ARE NOT VUE-CONTROLLED. `md-number-field` treats a
  programmatic `value` write as a commit: it reformats the display. Re-assigning
  `value` on every keystroke would therefore regroup the digits under the caret
  while the user types `1234` into `1,234` — which rules out `v-awc`'s `props`
  half here, because the directive re-applies its props on EVERY update. The two
  number fields are seeded through explicit watches keyed on a reset counter
  instead (the Vue spelling of the React source's `useElementProps` keyed on
  `seed`), so the app writes to them exactly when it means to — on mount, on a
  clear, and when the instrument changes — and never while the user is typing.
  The selects and the segmented set have no such hazard and are plainly
  controlled.

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

  WHAT CHANGED FROM THE REACT SOURCE'S SHAPE. React split `LimitField` and
  `EstimatePanel` into their own components because its listener hooks bind once
  per ref object and an inline closure component remounts per keystroke. Neither
  hazard exists here: `v-awc` binds when the ELEMENT mounts (so a `v-if` field
  gets fresh listeners every time it returns), and a template's markup is never
  a new component type. Both therefore live inline in this file's template — the
  rendered DOM is identical.
-->
<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import {
  BASE_CURRENCY,
  getInstrumentById,
  getInstruments,
  getOrders,
  getPortfolioById,
  getPortfolios,
  orderEstimate,
  REPORTING_DATE,
  type Order,
  type OrderEstimate,
  type OrderSide,
  type OrderType,
  type TimeInForce,
} from '@awc-ui/showcase-kit/wealth';
import { intlTag } from '@awc-ui/showcase-kit/i18n';
import { useShowcaseState, useT } from '~/composables/useShowcase';
import Panel from '~/components/Panel.vue';
import Sparkline from '~/components/Sparkline.vue';
import Fact from '~/components/bits/Fact.vue';
import Money from '~/components/bits/Money.vue';
import Num from '~/components/bits/Num.vue';
import OrderSideChip from '~/components/bits/OrderSideChip.vue';
import OrderStatusChip from '~/components/bits/OrderStatusChip.vue';
import Signed from '~/components/bits/Signed.vue';
import { useTx } from './trade-strings';
import './snackbar.css';

/* --------------------------------------------------------------- the ticket */

interface Ticket {
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

const props = defineProps<{
  /** Set by the screen so its toolbar can put focus into the first field. */
  focusHandle?: { value: (() => void) | null };
}>();

const t = useT();
const tx = useTx();
const state = useShowcaseState();
const locale = computed(() => intlTag(state.value.locale));

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

const ticket = ref<Ticket>({ ...initial });

/*
 * Bumped whenever the app — rather than the user — should own what is in the
 * two number fields. The `watch` below reads the LATEST ticket when it fires,
 * so bumping this pushes the current values into the elements, and leaving it
 * alone lets the user type undisturbed.
 */
const seed = ref(0);

const instrument = computed(() =>
  ticket.value.instrumentId ? getInstrumentById(ticket.value.instrumentId) : undefined,
);
const portfolio = computed(() =>
  ticket.value.portfolioId ? getPortfolioById(ticket.value.portfolioId) : undefined,
);
const showLimit = computed(() => needsLimit(ticket.value.orderType));

/* --------------------------------------------------------------- estimate */

const estimate = computed<OrderEstimate | null>(() =>
  ticket.value.instrumentId
    ? orderEstimate({
        instrumentId: ticket.value.instrumentId,
        quantity: ticket.value.quantity ?? 0,
        side: ticket.value.side,
        limitPrice: needsLimit(ticket.value.orderType) ? ticket.value.limitPrice : null,
        portfolioId: ticket.value.portfolioId || undefined,
      })
    : null,
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
const blockKey = computed<string | null>(() =>
  !ticket.value.instrumentId
    ? 'wealth.trade.needInstrument'
    : !ticket.value.portfolioId
      ? 'wealth.trade.needPortfolio'
      : !estimate.value || estimate.value.lots < 1
        ? 'wealth.trade.needQuantity'
        : showLimit.value && !(ticket.value.limitPrice !== null && ticket.value.limitPrice > 0)
          ? 'wealth.trade.needLimit'
          : estimate.value.exceedsCash
            ? 'wealth.order.exceedsCash'
            : null,
);

const blocked = computed(() => blockKey.value !== null);

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

const instrumentEl = ref<HTMLElement | null>(null);
const quantityEl = ref<HTMLElement | null>(null);
const limitEl = ref<HTMLElement | null>(null);

/*
 * `options`, `value` and `inputValue` are all JS properties here. An array has
 * no attribute form, and `md-autocomplete` deliberately IGNORES the `selected`
 * hint on its option rows — setting `value` (the commitment) and `inputValue`
 * (the visible text) is the whole of its preselection contract. They are
 * assigned only on mount and when the committed instrument changes, never on
 * every render, so typing is never interrupted by a write from Vue — which is
 * exactly why this is an explicit watch rather than `v-awc` props (the
 * directive re-assigns on every update, and a re-render mid-keystroke would
 * drive `inputValue` back to the committed ticker and wipe the query).
 */
function seedInstrument(): void {
  const el = instrumentEl.value as unknown as {
    options: unknown;
    value: string;
    inputValue: string;
  } | null;
  if (!el) return;
  el.options = instrumentOptions;
  el.value = ticket.value.instrumentId;
  el.inputValue = instrument.value?.ticker ?? '';
}
onMounted(seedInstrument);
watch(() => ticket.value.instrumentId, seedInstrument);

/*
 * The number fields, seeded on mount and on `seed`. Stencil's lazy proxy keeps
 * own properties set before the element upgrades, so the mount-time write is
 * not a race.
 */
function seedQuantity(): void {
  const el = quantityEl.value as unknown as { value: number | null } | null;
  if (el) el.value = ticket.value.quantity;
}
function seedLimit(): void {
  const el = limitEl.value as unknown as { value: number | null } | null;
  if (el) el.value = ticket.value.limitPrice;
}
onMounted(seedQuantity);
watch(seed, () => {
  seedQuantity();
  seedLimit();
});
// The limit field comes and goes with the order type (`v-if` below), so its
// mount-time seeding rides on the template ref itself: the ref is reactive and
// flips from null to the element when the field returns from a trip through
// `market`. This is the Vue spelling of the React source's separate
// `LimitField` component, whose whole reason to exist was re-running the
// seeding effect on remount.
watch(limitEl, (el) => {
  if (el) seedLimit();
});

/*
 * The typed text, kept only so the "nothing matched" row can name it.
 *
 * `mdInput` is TYPING and `mdChange` is SELECTION — two distinct signals on
 * this component, and confusing them is its most common misuse. Nothing here
 * writes `inputValue` back: assigning it would change the visible text without
 * filtering anything, because only text the user typed counts as the query.
 */
const query = ref('');

const instrumentListeners = {
  mdInput(event: Event) {
    query.value = (event as CustomEvent<string>).detail ?? '';
  },
  mdChange(event: Event) {
    const detail = (event as CustomEvent<string | string[]>).detail;
    const next = Array.isArray(detail) ? (detail[0] ?? '') : (detail ?? '');
    /*
     * ONLY A REAL INSTRUMENT COUNTS AS A SELECTION.
     *
     * `mdChange` can carry text that matched no option — type "orbs" and press
     * ArrowDown and it arrives as `"orbs"`. Storing that as `instrumentId` made
     * `instrument` undefined, which drove `inputValue` to `''` through the
     * seeding watch and wiped the field the moment you reached for the list.
     * Clearing an empty value is still a selection (it is how the ticket is
     * reset), so only a NON-empty id that resolves to nothing is refused.
     */
    if (next && !getInstrumentById(next)) return;
    // A new instrument invalidates the limit price: it was quoted in the old
    // security's currency and at the old security's scale. The quantity is kept
    // on purpose — the estimate re-snaps it to the new lot size and reports the
    // result, which is the lot rule doing visible work.
    ticket.value = { ...ticket.value, instrumentId: next, limitPrice: null };
    seed.value += 1;
  },
};

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
function onQuantityValue(event: Event): void {
  ticket.value = {
    ...ticket.value,
    quantity: (event as CustomEvent<{ value: number | null }>).detail.value,
  };
}
const quantityListeners = { mdInput: onQuantityValue, mdChange: onQuantityValue };

// Same pair, same reason, for the limit price.
function onLimitValue(event: Event): void {
  ticket.value = {
    ...ticket.value,
    limitPrice: (event as CustomEvent<{ value: number | null }>).detail.value,
  };
}
const limitListeners = { mdInput: onLimitValue, mdChange: onLimitValue };

const sideListeners = {
  mdChange(event: Event) {
    // A single-select set always reports exactly one value and never an empty
    // array — only `multiselect` can clear a choice.
    const next = (event as CustomEvent<string[]>).detail?.[0] as OrderSide | undefined;
    if (next) ticket.value = { ...ticket.value, side: next };
  },
};

const portfolioListeners = {
  mdChange(event: Event) {
    ticket.value = { ...ticket.value, portfolioId: (event as CustomEvent<string>).detail ?? '' };
  },
};

const orderTypeListeners = {
  mdChange(event: Event) {
    const next = ((event as CustomEvent<string>).detail || 'market') as OrderType;
    // Dropping to `market` unmounts the limit field, and an unmounted field
    // cannot show the price still sitting in state — so the state goes with it,
    // and the estimate can never be struck at a price nothing on screen names.
    ticket.value = {
      ...ticket.value,
      orderType: next,
      limitPrice: needsLimit(next) ? ticket.value.limitPrice : null,
    };
  },
};

const tifListeners = {
  mdChange(event: Event) {
    ticket.value = {
      ...ticket.value,
      timeInForce: ((event as CustomEvent<string>).detail || 'day') as TimeInForce,
    };
  },
};

/* ------------------------------------------------------------ submit flow */

const formEl = ref<HTMLFormElement | null>(null);
const menuEl = ref<HTMLElement | null>(null);

const menuOpen = ref(false);
const confirmOpen = ref(false);
const sending = ref(false);
const sheetOpen = ref(false);
const snack = ref({ open: false, message: '' });

/** Which half of the split button asked for this submit. Not rendered — plain. */
let pendingMode: 'clear' | 'keep' = 'clear';
let timer: number | null = null;

function cancelTimer(): void {
  if (timer !== null) {
    window.clearTimeout(timer);
    timer = null;
  }
}

onUnmounted(cancelTimer);

/** Hand the screen's toolbar a way to focus the first field. */
onMounted(() => {
  if (!props.focusHandle) return;
  props.focusHandle.value = () => {
    const el = instrumentEl.value as unknown as {
      focusInput?: () => Promise<void>;
    } | null;
    void el?.focusInput?.();
  };
});
onUnmounted(() => {
  if (props.focusHandle) props.focusHandle.value = null;
});

function clearTicket(): void {
  // The mandate survives a clear: an advisor writing three tickets for one
  // household should not have to re-pick it three times.
  ticket.value = { ...initial, portfolioId: ticket.value.portfolioId };
  seed.value += 1;
}

function requestSubmit(mode: 'clear' | 'keep'): void {
  pendingMode = mode;
  // `requestSubmit()`, not `submit()`: it fires the form's `submit` event AND
  // runs constraint validation, so a `required` field that is still empty
  // reports itself rather than being silently skipped.
  formEl.value?.requestSubmit();
}

const splitListeners = {
  mdLeadingClick: () => requestSubmit('clear'),
  mdTrailingClick(event: Event) {
    const open = Boolean((event as CustomEvent<{ checked: boolean }>).detail?.checked);
    const menu = menuEl.value as unknown as {
      show?: () => Promise<void>;
      close?: () => Promise<void>;
    } | null;
    if (open) void menu?.show?.();
    else void menu?.close?.();
    menuOpen.value = open;
  },
};

/*
 * `md-menu`'s own open/close events do NOT bubble and are NOT composed: they
 * fire on the menu element itself, which is what this listener map is bound to.
 * Without it the split button's chevron stays rotated after an outside click or
 * an Escape, because the component cannot see a close it did not cause.
 *
 * `md-menu-item`'s `mdClick` bubbles and is composed, so one listener on the
 * menu covers every row. The menu closes itself.
 */
const menuListeners = {
  mdClose: () => {
    menuOpen.value = false;
  },
  mdClick: () => requestSubmit('keep'),
};

/** The line the snackbar reports. Built BEFORE the ticket is cleared. */
function completionMessage(mode: 'clear' | 'keep'): string {
  return tx.value(mode === 'keep' ? 'wealth.trade.submittedKept' : 'wealth.trade.submitted', {
    side: t.value(`wealth.orderSide.${ticket.value.side}`),
    quantity: t.value.formatNumber(estimate.value?.effectiveQuantity ?? 0, {
      maximumFractionDigits: 0,
    }),
    ticker: instrument.value?.ticker ?? '',
  });
}

function handleSubmit(event: Event): void {
  event.preventDefault();
  // The soft-disabled split button stops the pointer path; this stops the
  // keyboard one. `md-number-field` calls `requestSubmit()` on Enter, and
  // `exceedsCash` is not a constraint the platform knows anything about.
  if (blocked.value) {
    pendingMode = 'clear';
    return;
  }
  confirmOpen.value = true;
}

function confirmSend(): void {
  // Belt and braces beside the button's own `loading` state: one ticket, one
  // timer, so a second activation can never orphan the first.
  if (timer !== null) return;
  const mode = pendingMode;
  const message = completionMessage(mode);
  sending.value = true;
  timer = window.setTimeout(() => {
    timer = null;
    sending.value = false;
    confirmOpen.value = false;
    snack.value = { open: true, message };
    pendingMode = 'clear';
    if (mode === 'clear') clearTicket();
  }, SUBMIT_MS);
}

function abortSend(): void {
  cancelTimer();
  sending.value = false;
  confirmOpen.value = false;
  pendingMode = 'clear';
}

// Escape and the scrim emit `mdCancel` as well as `mdClose`; only `mdCancel`
// is handled, so a dismissal is not processed twice.
const dialogListeners = { mdCancel: abortSend };
const cancelListeners = { mdClick: abortSend };
const sendListeners = { mdClick: () => confirmSend() };
const closeSheetListeners = {
  mdClick: () => {
    sheetOpen.value = false;
  },
};

/*
 * Auto-hide sets `open` on the element itself, and setting `open = false`
 * directly emits nothing — so `mdClose` is the only signal that the snackbar
 * has gone. Without this handler Vue would still believe it open, and the
 * next render would write `open` back and re-show a stale message.
 */
const snackListeners = {
  mdClose: () => {
    snack.value = { ...snack.value, open: false };
  },
};

const sheetListeners = {
  mdClose: () => {
    sheetOpen.value = false;
  },
};

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
const groupListeners = {
  mdClick(event: Event) {
    event.preventDefault();
    const value = (event as CustomEvent<{ value: string }>).detail?.value;
    if (value === 'clear') clearTicket();
    if (value === 'book') sheetOpen.value = true;
  },
};

/*
 * The sheet shows the book for the chosen instrument, and the newest orders on
 * the whole book when nothing is chosen — both straight out of the selector,
 * filtered BY it rather than by an array method here. There is no bid/ask
 * depth in this console because the fixture carries none, and inventing a
 * ladder of prices is the one thing this showcase is not for.
 */
const bookOrders = computed<Order[]>(() =>
  ticket.value.instrumentId
    ? getOrders({ instrumentId: ticket.value.instrumentId })
    : getOrders({ limit: 8 }),
);

const lotHint = computed(() =>
  instrument.value
    ? t.value('wealth.order.lotHint', {
        size: t.value.formatNumber(instrument.value.lotSize, { maximumFractionDigits: 0 }),
      })
    : '',
);

const portfolioSupporting = computed(() =>
  portfolio.value
    ? `${t.value('wealth.kpi.cash')} · ${t.value.formatCurrency(portfolio.value.cashBalance, {
        notation: 'compact',
      })}`
    : '',
);

/*
 * `format-options` takes a JSON attribute as well as the object property, and
 * the attribute form re-renders with the instrument — so the limit field is
 * always denominated in the security's own currency rather than the mandate's
 * reporting currency.
 */
const limitFormatOptions = computed(() =>
  JSON.stringify({
    style: 'currency',
    currency: instrument.value?.currency ?? BASE_CURRENCY,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }),
);

const limitSupporting = computed(() =>
  instrument.value
    ? `${t.value('wealth.table.price')} · ${t.value.formatCurrency(instrument.value.price, {
        currency: instrument.value.currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`
    : '',
);

/*
 * Twelve month-end closes for the estimate's sparkline, straight off the
 * instrument. Computeds, so a locale switch re-derives the labels and the
 * formatter re-closes over the new translator; `v-awc` re-assigns the function
 * props on that update.
 */
const sparkLabels = computed(() =>
  instrument.value
    ? instrument.value.priceSeriesDates.map((date) => t.value.formatDate(date, 'monthYear'))
    : [],
);

const sparkFormatter = computed(() => {
  const translate = t.value;
  const inst = instrument.value;
  return (value: number | null) =>
    value === null
      ? translate('wealth.common.na')
      : translate.formatCurrency(value, {
          currency: inst?.currency ?? BASE_CURRENCY,
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
});
</script>

<template>
  <div class="grid-wide">
    <Panel
      :title="t('wealth.panel.ticket')"
      :subtitle="tx('wealth.trade.ticketHint', { date: t.formatDate(REPORTING_DATE, 'medium') })"
    >
      <form ref="formEl" class="stack" @submit="handleSubmit">
        <!--
          The set owns selection and has no `value` prop: `selected` on a
          child is how the current side is expressed, and a plain
          `aria-label` names the set, which carries no naming prop of its
          own. Two labelled segments is squarely inside the 2–5 M3 allows.
        -->
        <md-segmented-button-set
          v-awc="{ on: sideListeners }"
          :aria-label="t('wealth.table.side')"
        >
          <md-segmented-button
            v-for="side in SIDES"
            :key="side"
            :value="side"
            :label="t(`wealth.orderSide.${side}`)"
            :icon="side === 'buy' ? 'north_east' : 'south_west'"
            :selected="ticket.side === side"
          ></md-segmented-button>
        </md-segmented-button-set>

        <div class="ticket__fields">
          <md-autocomplete
            ref="instrumentEl"
            v-awc="{ on: instrumentListeners }"
            name="instrument"
            variant="outlined"
            required
            :label="t('wealth.table.instrument')"
            :placeholder="t('wealth.action.search')"
            :supporting-text="instrument ? instrument.name : t('wealth.panel.universe')"
            :value-missing-label="tx('wealth.trade.needInstrument')"
            :no-options-text="t('wealth.empty.generic')"
            :no-results-text="t('wealth.empty.search', { query })"
            virtualize="never"
            reserve-supporting-space
          ></md-autocomplete>
          <!-- The two empty states above say different things, because they ARE
               different things: an empty universe and a query that matched
               nothing. The second one can name what was typed, which is why the
               query is tracked at all. Forty instruments is far inside the
               200-row threshold, but `auto` is a threshold rather than a
               promise: pinning the client-side path (`virtualize="never"`)
               keeps the default label/supporting-text filter (which matches the
               security NAME, not just the ticker) instead of handing matching
               to the WASM engine. -->

          <md-select
            v-awc="{ on: portfolioListeners }"
            name="portfolio"
            variant="outlined"
            required
            :label="t('wealth.panel.mandate')"
            :value="ticket.portfolioId"
            :value-missing-label="tx('wealth.trade.needPortfolio')"
            :supporting-text="portfolioSupporting"
            reserve-supporting-space
          >
            <md-select-option
              v-for="p in portfolios"
              :key="p.id"
              :value="p.id"
              :label="p.reference"
              :supporting-text="t(p.strategyKey)"
            >{{ p.reference }}</md-select-option>
          </md-select>

          <!--
            `md-number-field`, never `md-text-field type="number"` (§5.2).
            The steppers step by the instrument's LOT and `snap-on-step`
            keeps them on that grid, so the buttons cannot produce a size the
            security does not trade in. `error` here is display-only — the
            block itself belongs to the tooltip and to constraint validation
            — but this is where the reader is looking when the size is what
            went wrong. Shift-stepping (`large-step`) moves ten lots: a
            keyboard affordance, not a reported figure — every number this
            screen SHOWS comes from the kit.
          -->
          <md-number-field
            ref="quantityEl"
            v-awc="{ on: quantityListeners }"
            name="quantity"
            variant="outlined"
            required
            :label="t('wealth.table.quantity')"
            :locale="locale"
            :min="0"
            :step="instrument?.lotSize ?? 1"
            :large-step="(instrument?.lotSize ?? 1) * 10"
            snap-on-step
            steppers="inline"
            :increment-label="t('wealth.action.next')"
            :decrement-label="t('wealth.action.back')"
            :value-missing-label="tx('wealth.trade.needQuantity')"
            :supporting-text="lotHint"
            :error="estimate?.exceedsCash || undefined"
            :error-text="estimate?.exceedsCash ? t('wealth.order.exceedsCash') : undefined"
            reserve-supporting-space
          ></md-number-field>

          <md-select
            v-awc="{ on: orderTypeListeners }"
            name="orderType"
            variant="outlined"
            required
            :label="t('wealth.table.orderType')"
            :value="ticket.orderType"
            reserve-supporting-space
          >
            <md-select-option
              v-for="type in ORDER_TYPES"
              :key="type"
              :value="type"
              :label="t(`wealth.orderType.${type}`)"
            >{{ t(`wealth.orderType.${type}`) }}</md-select-option>
          </md-select>

          <!--
            Revealed, not permanently disabled. A market order has no limit
            price at all, and a greyed field is a question the reader keeps
            re-reading. Both of the other two types are struck at a price, so
            the field appears for both. Its listeners and its seeding re-bind
            on every return from `market` — the directive and the `limitEl`
            watch both fire on mount — so no separate component is needed
            (see the header note).
          -->
          <md-number-field
            v-if="showLimit"
            ref="limitEl"
            v-awc="{ on: limitListeners }"
            name="limit"
            variant="outlined"
            required
            :label="t('wealth.table.limitPrice')"
            :locale="locale"
            :min="0"
            :step="0.01"
            :small-step="0.01"
            :large-step="1"
            :increment-label="t('wealth.action.next')"
            :decrement-label="t('wealth.action.back')"
            :value-missing-label="tx('wealth.trade.needLimit')"
            :format-options="limitFormatOptions"
            :supporting-text="limitSupporting"
            reserve-supporting-space
          ></md-number-field>

          <md-select
            v-awc="{ on: tifListeners }"
            name="tif"
            variant="outlined"
            required
            :label="t('wealth.table.timeInForce')"
            :value="ticket.timeInForce"
            reserve-supporting-space
          >
            <md-select-option
              v-for="tif in TIME_IN_FORCE"
              :key="tif"
              :value="tif"
              :label="t(`wealth.timeInForce.${tif}`)"
            >{{ t(`wealth.timeInForce.${tif}`) }}</md-select-option>
          </md-select>
        </div>

        <md-divider></md-divider>

        <div class="ticket__actions">
          <md-button-group
            v-awc="{ on: groupListeners }"
            variant="standard"
            size="sm"
            selection-mode="multi-select"
            :aria-label="tx('wealth.trade.actions')"
          >
            <md-button value="clear" variant="text" icon="restart_alt">
              {{ tx('wealth.trade.clear') }}
            </md-button>
            <md-button value="book" variant="text" icon="receipt_long">
              {{ tx('wealth.trade.book') }}
            </md-button>
          </md-button-group>

          <!--
            §7.2's pairing, and the reason it is in the manual: a
            soft-disabled control keeps `tabindex="0"`, so a keyboard reader
            reaches it and the tooltip tells them what is missing — which a
            hard `disabled` would hide entirely. `disabled` on the TOOLTIP is
            what switches the explanation off once there is nothing to
            explain.
          -->
          <md-tooltip
            :text="blockKey ? tx(blockKey) : ''"
            :disabled="!blocked || undefined"
            position="top-end"
          >
            <md-split-button
              v-awc="{ on: splitListeners }"
              id="trade-submit"
              variant="filled"
              size="sm"
              icon="send"
              :label="t('wealth.action.submit')"
              :menu-label="tx('wealth.trade.submitOptions')"
              controls="trade-submit-menu"
              :soft-disabled="blocked || undefined"
              :trailing-checked="menuOpen"
            ></md-split-button>
          </md-tooltip>
        </div>
      </form>
    </Panel>

    <!--
      The live readout beside the ticket. Inline rather than a component of its
      own: React hoisted `EstimatePanel` because an inline closure component is
      a new type per render and would remount the sparkline on every keystroke —
      a template has no such hazard.
    -->
    <Panel v-if="!estimate || !instrument" :title="tx('wealth.trade.estimate')">
      <p class="muted">{{ tx('wealth.trade.estimateEmpty') }}</p>
    </Panel>
    <Panel v-else :title="tx('wealth.trade.estimate')" :subtitle="instrument.name">
      <div class="stack">
        <div>
          <p class="estimate__value">
            <Money
              :value="estimate.estimatedValue"
              :currency="estimate.currency"
              :digits="estimate.currency === BASE_CURRENCY ? 0 : 2"
            />
          </p>
          <p v-if="estimate.currency !== BASE_CURRENCY" class="estimate__sub">
            <Money :value="estimate.estimatedValueEur" /> · {{ BASE_CURRENCY }}
          </p>
        </div>

        <!--
          Twelve month-end closes, straight off the instrument. The wrapper is
          what makes `data`, `labels` and `valueFormatter` land as JS
          properties; an `md-sparkline` written out here would stringify all
          three.
        -->
        <div class="estimate__spark">
          <Sparkline
            :data="instrument.priceSeries"
            :labels="sparkLabels"
            :value-formatter="sparkFormatter"
            variant="line"
            color="primary"
            curve="monotone"
            show-marks="extremes"
            height="56px"
          />
        </div>

        <dl class="dl">
          <Fact :label="t('wealth.table.price')">
            <Money :value="estimate.referencePrice" :currency="estimate.currency" :digits="2" />
          </Fact>
          <Fact :label="t('wealth.table.quantity')">
            <Num :value="estimate.effectiveQuantity" />
          </Fact>
          <Fact :label="t('wealth.table.weight')">
            <Signed :value="estimate.weightImpact" kind="percent" />
          </Fact>
          <Fact :label="t('wealth.kpi.cash')">
            <Money v-if="portfolio" :value="portfolio.cashBalance" compact />
            <template v-else>{{ t('wealth.common.na') }}</template>
          </Fact>
        </dl>

        <p class="estimate__sub">
          {{
            tx('wealth.trade.lots', {
              lots: t.formatNumber(estimate.lots, { maximumFractionDigits: 0 }),
              size: t.formatNumber(instrument.lotSize, { maximumFractionDigits: 0 }),
            })
          }}
        </p>

        <!--
          The lot rule, made visible. `orderEstimate` rounds DOWN to a whole
          number of lots, so a typed 1,750 of a bond that trades in 1,000
          becomes 1,000 — and a reader who is not told that reads the estimate
          as wrong rather than as rounded.
        -->
        <p
          v-if="(ticket.quantity ?? 0) !== estimate.effectiveQuantity"
          class="estimate__sub"
        >
          {{
            tx('wealth.trade.snapped', {
              typed: t.formatNumber(ticket.quantity ?? 0, { maximumFractionDigits: 0 }),
            })
          }}
        </p>

        <p v-if="estimate.exceedsCash" class="pl-down">{{ t('wealth.order.exceedsCash') }}</p>
      </div>
    </Panel>
  </div>

  <!--
    The split button ships no menu — it emits `mdTrailingClick` and this is
    the menu it opens. `open` is never written into the initial markup: the
    component wires positioning and dismissal from the `open` CHANGE handler,
    so a menu that starts open paints unpositioned and cannot be clicked away.

    `bottom-end`, not `top-end`. A menu belongs BELOW the control that opens
    it unless there is no room, and md-menu already flips itself when the
    space is short — so pinning it upward only forced it to open over the
    form with 448px free underneath. The tooltip above uses `top-end`
    legitimately, which is where this almost certainly came from.

    `vibrant` to match every other menu surface in this app: the default
    `baseline` is square-cornered on a surface container, and one menu in
    a different shape from the rest reads as a different control.
  -->
  <md-menu
    ref="menuEl"
    v-awc="{ on: menuListeners }"
    id="trade-submit-menu"
    anchor="trade-submit"
    placement="bottom-end"
    variant="vibrant"
  >
    <md-menu-item
      :headline="tx('wealth.trade.submitDuplicate')"
      :supporting-text="t('wealth.panel.ticket')"
    ></md-menu-item>
  </md-menu>

  <!-- --------------------------------------------------------- confirm -->
  <md-dialog
    v-awc="{ on: dialogListeners }"
    :open="confirmOpen"
    :headline="tx('wealth.trade.confirm')"
    icon="fact_check"
    divider
    :scrim-dismissible="sending ? 'false' : 'true'"
    :close-label="t('wealth.action.close')"
  >
    <p class="muted">{{ tx('wealth.trade.confirmBody') }}</p>

    <dl class="dl">
      <Fact :label="t('wealth.table.side')">
        <OrderSideChip :side="ticket.side" />
      </Fact>
      <Fact :label="t('wealth.table.instrument')">
        {{ instrument ? instrument.name : t('wealth.common.na') }}
      </Fact>
      <Fact :label="t('wealth.panel.mandate')">
        {{ portfolio ? portfolio.reference : t('wealth.common.na') }}
      </Fact>
      <Fact :label="t('wealth.table.quantity')">
        <Num :value="estimate?.effectiveQuantity ?? 0" />
      </Fact>
      <Fact :label="t('wealth.table.orderType')">
        {{ t(`wealth.orderType.${ticket.orderType}`) }}
      </Fact>
      <Fact :label="t('wealth.table.limitPrice')">
        <Money
          v-if="showLimit && ticket.limitPrice !== null"
          :value="ticket.limitPrice"
          :currency="instrument?.currency"
          :digits="2"
        />
        <template v-else>{{ t('wealth.common.na') }}</template>
      </Fact>
      <Fact :label="t('wealth.table.timeInForce')">
        {{ t(`wealth.timeInForce.${ticket.timeInForce}`) }}
      </Fact>
      <Fact :label="t('wealth.table.estimatedValue')">
        <Money v-if="estimate" :value="estimate.estimatedValueEur" />
        <template v-else>{{ t('wealth.common.na') }}</template>
      </Fact>
    </dl>

    <!--
      Indeterminate, because there is no measurable progress to report — the
      desk either has the ticket or it does not. `label` becomes the
      `aria-label`; the component's own default is the English word
      "Progress".
    -->
    <md-progress-indicator
      v-if="sending"
      variant="linear"
      indeterminate
      :label="tx('wealth.trade.submitting')"
    ></md-progress-indicator>

    <!--
      Slotted actions replace the dialog's fallback pair and do NOT close it
      — they are our markup, so the close is ours to perform. M3 puts the
      dismissive action on the leading side and the component does not
      reorder them.

      Cancel stays LIVE while the ticket is in flight, because it is the
      abort, and it is the same abort Escape and the scrim perform. Confirm
      goes `loading`, which is not merely cosmetic — `md-button` counts it as
      disabled — and the events are read through `mdClick` rather than a
      native `@click` because the disabled path calls `preventDefault()`
      without stopping propagation: the native click would still reach a
      plain handler and start a second submission over the first.
    -->
    <md-button v-awc="{ on: cancelListeners }" slot="actions" variant="text">
      {{ t('wealth.action.cancel') }}
    </md-button>
    <md-button
      v-awc="{ on: sendListeners }"
      slot="actions"
      variant="filled"
      icon="send"
      :loading="sending || undefined"
    >
      {{ t('wealth.action.submit') }}
    </md-button>
  </md-dialog>

  <!-- ------------------------------------------------------------ book -->
  <md-bottom-sheet
    v-awc="{ on: sheetListeners }"
    :open="sheetOpen"
    variant="detached"
    closeable
    top-divider
    :headline="
      instrument
        ? tx('wealth.trade.bookFor', { ticker: instrument.ticker })
        : tx('wealth.trade.bookRecent')
    "
  >
    <dl v-if="instrument" class="dl trade-sheet__facts">
      <Fact :label="t('wealth.table.price')">
        <Money :value="instrument.price" :currency="instrument.currency" :digits="2" />
      </Fact>
      <Fact :label="t('wealth.table.dayChange')">
        <Signed :value="instrument.dayChangePct" kind="percent" />
      </Fact>
      <Fact :label="t('wealth.table.twelveMonth')">
        <Signed :value="instrument.twelveMonthReturn" kind="percent" />
      </Fact>
      <Fact :label="t('wealth.table.quantity')">
        <Num :value="instrument.lotSize" />
      </Fact>
    </dl>

    <p v-if="bookOrders.length === 0" class="muted">{{ tx('wealth.trade.bookEmpty') }}</p>
    <md-list v-else :label="t('wealth.panel.blotter')">
      <md-list-item
        v-for="order in bookOrders"
        :key="order.id"
        lines="3"
        :overline="order.id"
        :headline="order.instrumentName"
        :supporting-text="
          t('wealth.order.filledOf', {
            filled: t.formatNumber(order.filledQuantity, { maximumFractionDigits: 0 }),
            quantity: t.formatNumber(order.quantity, { maximumFractionDigits: 0 }),
          })
        "
        :trailing-supporting-text="
          t.formatCurrency(order.estimatedValueEur, { notation: 'compact' })
        "
      >
        <span slot="leading">
          <OrderSideChip :side="order.side" />
        </span>
        <span slot="trailing">
          <OrderStatusChip :status="order.status" />
        </span>
      </md-list-item>
    </md-list>

    <!--
      A slotted `close` element is NOT wired by the sheet — only the built-in
      `closeable` icon-button is — so this one closes it itself.
    -->
    <md-button v-awc="{ on: closeSheetListeners }" slot="actions" variant="text">
      {{ t('wealth.action.close') }}
    </md-button>
  </md-bottom-sheet>

  <!-- ---------------------------------------------------------- report -->
  <md-snackbar
    v-awc="{ on: snackListeners }"
    class="wealth-snackbar"
    :open="snack.open"
    :message="snack.message"
    position="bottom"
    closeable
    :dismiss-label="t('wealth.action.close')"
  ></md-snackbar>
</template>
