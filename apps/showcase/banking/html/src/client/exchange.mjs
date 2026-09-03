/**
 * The exchange ticket: the pair, the amount, the quote, and the swap.
 *
 * THE KIT PRICES IT, HERE AS AT BUILD TIME. quote() returns the mid rate, the
 * spread the desk keeps, the fee off the source side and the net — four
 * figures this file writes into four spans and does not compute. The page
 * arrives with a correct EUR to GBP quote already in it; what follows is the
 * re-price.
 *
 * FOUR THINGS FOLLOW THE PAIR, and missing any one of them was visible: the
 * two option lists (neither offers the other side's current value), the two
 * supporting texts, the amount field's currency, and the rate-history panel
 * beside the ticket. React re-renders all of them from state; this walks them.
 *
 * NO ENGLISH. Every string is either a number formatted in the page's locale or
 * a translated one already shipped on an element — the free-fee word rides on
 * its own span, the two gate reasons on the tooltip they belong to.
 */

import {
  getFxPairs,
  getSpendingAccounts,
  quote,
  rateSeries,
} from '@awc-ui/showcase-kit/banking';
import { createTranslator } from '@awc-ui/showcase-kit/i18n';

const QUOTED = ['EUR', 'USD', 'GBP', 'RON'];

export function enhanceExchange(root = document) {
  const ticket = root.querySelector('[data-quote]');
  const fromSelect = root.querySelector('[data-from]');
  const toSelect = root.querySelector('[data-to]');
  const amountField = root.querySelector('[data-amount]');
  if (!ticket || !fromSelect || !toSelect || !amountField) return;
  if (ticket.hasAttribute('data-bound')) return;
  ticket.setAttribute('data-bound', '');

  const lang = document.documentElement.lang;
  const locale = ['en', 'ro', 'ar'].includes(lang) ? lang : 'en';
  const tr = createTranslator(locale);

  const accounts = getSpendingAccounts();
  const pairs = getFxPairs();
  const held = QUOTED.filter((code) => accounts.some((a) => a.currency === code));

  const state = { from: 'EUR', to: 'GBP', amount: 250, done: false };

  /* --------------------------------------------------------- the elements */

  const parent = ticket.parentElement;
  const anchor = ticket.nextSibling;
  const rateOut = ticket.querySelector('[data-quote-rate]');
  const spreadOut = ticket.querySelector('[data-quote-spread]');
  const feeOut = ticket.querySelector('[data-quote-fee]');
  const netOut = ticket.querySelector('[data-quote-net]');

  const swapButton = root.querySelector('[data-swap]');
  const swapTooltip = root.querySelector('[data-swap-tooltip]');
  const confirm = root.querySelector('[data-confirm]');
  const confirmTooltip = root.querySelector('[data-confirm-tooltip]');
  const noteTemplate = root.querySelector('template[data-confirm-note]');
  const note = noteTemplate?.content.firstElementChild?.cloneNode(true);

  const historyPanel = root.querySelector('[data-history-panel]');
  const historyChart = historyPanel?.querySelector('md-line-chart');
  const historySub = historyPanel?.querySelector('.panel__sub');
  const historyChange = historyPanel?.querySelector('.panel__head bdi');

  /**
   * Every option element either select will ever need, by side and by code.
   *
   * Built once from what is live plus what the two templates hold, and then
   * only ever MOVED between the select and nothing. Cloning would give the
   * component a different element for the same currency each time the pair
   * changed, which is how a select ends up with a value it cannot resolve to an
   * option.
   */
  const optionPool = (select, template) => {
    const pool = new Map();
    for (const option of select.querySelectorAll('md-select-option')) {
      pool.set(option.getAttribute('value'), option);
    }
    for (const option of template?.content.querySelectorAll('md-select-option') ?? []) {
      pool.set(option.getAttribute('value'), option);
    }
    return pool;
  };

  const sendPool = optionPool(fromSelect, root.querySelector('template[data-send-options]'));
  const receivePool = optionPool(toSelect, root.querySelector('template[data-receive-options]'));

  /* ------------------------------------------------------------ the pieces */

  /** What is held in a currency, or the words for holding none. */
  const balanceIn = (currency) => {
    const account = accounts.find((a) => a.currency === currency);
    return account
      ? tr.formatCurrency(account.balance, {
          currency,
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      : tr.t('banking.hint.noAccount');
  };

  const money = (value, currency) =>
    tr.formatCurrency(value, { currency, minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const setOptions = (select, pool, codes, value) => {
    const wanted = codes.map((code) => pool.get(code)).filter(Boolean);
    const same =
      wanted.length === select.children.length &&
      wanted.every((option, index) => select.children[index] === option);
    if (!same) select.replaceChildren(...wanted);
    if (select.value !== value) select.value = value;
  };

  /* ------------------------------------------------------------- the apply */

  const apply = () => {
    const { from, to } = state;
    const valid = state.amount !== null && state.amount > 0;
    const priced = valid && from !== to ? quote(from, to, state.amount) : null;

    setOptions(fromSelect, sendPool, held.filter((code) => code !== to), from);
    setOptions(toSelect, receivePool, QUOTED.filter((code) => code !== from), to);
    fromSelect.setAttribute('supporting-text', balanceIn(from));
    toSelect.setAttribute('supporting-text', balanceIn(to));
    amountField.setAttribute(
      'format-options',
      JSON.stringify({ style: 'currency', currency: from, maximumFractionDigits: 2 }),
    );

    /* The breakdown is REMOVED when there is nothing to price, which is what
       React renders — an unpriced ticket showing four stale figures is worse
       than one showing none. */
    if (priced) {
      if (!ticket.isConnected) parent?.insertBefore(ticket, anchor);
      if (rateOut) {
        rateOut.textContent = `1 ${from} = ${tr.formatNumber(priced.rate, {
          maximumFractionDigits: 4,
        })} ${to}`;
      }
      if (spreadOut) {
        spreadOut.textContent = tr.t('banking.unit.bps', {
          value: tr.formatNumber(priced.spreadBps),
        });
      }
      if (feeOut) {
        /* A zero fee is said in words: three of the six pairs are free, and
           "Fee €0.00" reads as a charge that rounds to nothing. */
        feeOut.textContent =
          priced.feeFrom === 0 ? tr.t('banking.common.free') : money(priced.feeFrom, from);
      }
      if (netOut) netOut.textContent = money(priced.net, to);
    } else if (ticket.isConnected) {
      ticket.remove();
    }

    /* You cannot send what you do not hold, so a receive currency with no
       account behind it cannot be swapped into the send side. */
    const canSwap = accounts.some((a) => a.currency === to);
    if (swapButton) swapButton.softDisabled = !canSwap;
    if (swapTooltip) swapTooltip.disabled = canSwap;

    const reason = !valid
      ? tr.t('banking.hint.amountNeeded')
      : !priced
        ? tr.t('banking.hint.noPair')
        : null;
    if (confirm) confirm.softDisabled = reason !== null || state.done;
    if (confirmTooltip) {
      confirmTooltip.text = reason ?? '';
      confirmTooltip.disabled = reason === null;
    }
    if (note) {
      if (state.done && !note.isConnected) confirm?.closest('.row')?.appendChild(note);
      else if (!state.done && note.isConnected) note.remove();
    }

    /* The charted pair follows the ticket either way round — the desk quotes
       six pairs, not twelve. */
    const charted = pairs.find(
      (p) => (p.base === from && p.quote === to) || (p.base === to && p.quote === from),
    );
    if (historySub) {
      historySub.textContent = charted ? `${charted.base}/${charted.quote}` : tr.t('banking.common.na');
    }
    if (historyChange && charted) {
      const pct = charted.thirtyDayChangePct;
      historyChange.textContent = tr.formatPercent(pct, {
        maximumFractionDigits: 2,
        minimumFractionDigits: 1,
        signDisplay: 'exceptZero',
      });
      historyChange.className =
        pct > 0.0005 ? 'num pl-up' : pct < -0.0005 ? 'num pl-down' : 'num pl-flat';
    }
    if (historyChart && charted) {
      const history = rateSeries(charted.id);
      /* Properties, not attributes: `series` deserializes from its attribute
         but `xAxis` does not, which is the whole reason client/charts.mjs
         exists. Both are set here in one place so the plot and its category
         labels can never describe different pairs. */
      historyChart.series = [
        {
          id: 'rate',
          label: `${charted.base}/${charted.quote}`,
          data: history.map((p) => p.rate),
        },
      ];
      historyChart.xAxis = {
        data: history.map((p) => tr.formatDate(p.date, 'short')),
        scale: 'category',
      };
    }
  };

  /* ------------------------------------------------------------ the events */

  /* Both events: `mdInput` for typing and `mdChange` for a commit (blur, the
     steppers, the wheel). Listening to only one leaves either the live quote or
     the steppers dead. The detail is `{ value, formattedValue, reason }` and
     `value` is ALREADY A NUMBER — md-number-field parses it, and `null` is
     empty, which is not the same as the 0 a reader can type. */
  amountField.addEventListener('mdInput', (event) => {
    state.amount = event.detail?.value ?? null;
    state.done = false;
    apply();
  });
  amountField.addEventListener('mdChange', (event) => {
    state.amount = event.detail?.value ?? null;
    apply();
  });

  const pick = (event) => (Array.isArray(event.detail) ? event.detail[0] : event.detail);

  fromSelect.addEventListener('mdChange', (event) => {
    const value = pick(event);
    if (value) state.from = value;
    state.done = false;
    apply();
  });
  toSelect.addEventListener('mdChange', (event) => {
    const value = pick(event);
    if (value) state.to = value;
    state.done = false;
    apply();
  });

  swapButton?.addEventListener('mdClick', () => {
    if (!accounts.some((a) => a.currency === state.to)) return;
    const { from, to } = state;
    state.from = to;
    state.to = from;
    state.done = false;
    apply();
  });

  confirm?.addEventListener('mdClick', () => {
    state.done = true;
    apply();
  });

  apply();
}
