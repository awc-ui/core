/**
 * The investing screen: the trade ticket's estimate, and the holdings layout.
 *
 * THE KIT ESTIMATES, HERE AS AT BUILD TIME. tradeEstimate() returns the price,
 * the fee and the total for a quantity of an instrument; this file writes three
 * spans and computes nothing. The default estimate is priced into the document,
 * so the ticket is correct before this runs.
 *
 * A QUANTITY IS A NUMBER, AND EMPTY IS NOT ZERO. md-number-field emits
 * `{ value: number | null }` already parsed — null is a cleared field, 0 is an
 * amount somebody typed, and the gate distinguishes them.
 *
 * THE HOLDINGS LAYOUT IS A SWAP, NOT A STYLE. Below 720px the nine-column table
 * is replaced by the list the build wrote into a template beside it, because
 * the two are different markup and hiding one would leave a 1040px table in
 * every phone's accessibility tree.
 */

import { tradeEstimate } from '@awc-ui/showcase-kit/banking';
import { createTranslator } from '@awc-ui/showcase-kit/i18n';

const PHONE = '(max-width: 719px)';

export function enhanceTrade(root = document) {
  const picker = root.querySelector('[data-instrument]');
  const quantityField = root.querySelector('[data-quantity]');
  const estimateBlock = root.querySelector('[data-estimate]');

  /* The holdings swap is independent of the ticket — a portfolio with no
     holdings has no ticket and still has a screen. */
  swapHoldings(root);

  if (!picker || !quantityField || !estimateBlock) return;
  if (estimateBlock.hasAttribute('data-bound')) return;
  estimateBlock.setAttribute('data-bound', '');

  const lang = document.documentElement.lang;
  const locale = ['en', 'ro', 'ar'].includes(lang) ? lang : 'en';
  const tr = createTranslator(locale);

  const state = {
    instrumentId: picker.getAttribute('value') ?? '',
    quantity: 1,
    placed: false,
  };

  const parent = estimateBlock.parentElement;
  const anchor = estimateBlock.nextSibling;
  const priceOut = estimateBlock.querySelector('[data-estimate-price]');
  const feeOut = estimateBlock.querySelector('[data-estimate-fee]');
  const totalOut = estimateBlock.querySelector('[data-estimate-total]');

  const buy = root.querySelector('[data-buy]');
  const sell = root.querySelector('[data-sell]');
  const tooltip = root.querySelector('[data-trade-tooltip]');
  const noteTemplate = root.querySelector('template[data-trade-note]');
  const note = noteTemplate?.content.firstElementChild?.cloneNode(true);

  const money = (value) =>
    tr.formatCurrency(value, {
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const apply = () => {
    const estimate =
      state.quantity === null ? null : tradeEstimate(state.instrumentId, state.quantity);

    if (estimate) {
      if (!estimateBlock.isConnected) parent?.insertBefore(estimateBlock, anchor);
      if (priceOut) priceOut.textContent = money(estimate.priceEur);
      if (feeOut) feeOut.textContent = money(estimate.feeEur);
      if (totalOut) totalOut.textContent = money(estimate.totalEur);
    } else if (estimateBlock.isConnected) {
      estimateBlock.remove();
    }

    const reason = estimate === null ? tr.t('banking.hint.quantityNeeded') : null;
    const off = reason !== null || state.placed;
    if (buy) buy.softDisabled = off;
    if (sell) sell.softDisabled = off;
    if (tooltip) {
      tooltip.text = reason ?? '';
      tooltip.disabled = reason === null;
    }
    if (note) {
      if (state.placed && !note.isConnected) buy?.closest('.row')?.appendChild(note);
      else if (!state.placed && note.isConnected) note.remove();
    }
  };

  quantityField.addEventListener('mdInput', (event) => {
    state.quantity = event.detail?.value ?? null;
    state.placed = false;
    apply();
  });
  quantityField.addEventListener('mdChange', (event) => {
    state.quantity = event.detail?.value ?? null;
    apply();
  });

  picker.addEventListener('mdChange', (event) => {
    const value = Array.isArray(event.detail) ? event.detail[0] : event.detail;
    if (value) state.instrumentId = value;
    state.placed = false;
    apply();
  });

  for (const button of [buy, sell]) {
    button?.addEventListener('mdClick', () => {
      state.placed = true;
      apply();
    });
  }

  apply();
}

/**
 * The table below 720px, the list above it — one of them, never both.
 *
 * The table is the one in the document, so a reader with no JavaScript gets the
 * layout that carries every column, scrolling inside its own port. The list is
 * cloned once from its template and then only ever moved in and out.
 */
function swapHoldings(root) {
  const table = root.querySelector('[data-holdings-table]');
  const template = root.querySelector('template[data-holdings-list]');
  if (!table || !template || table.hasAttribute('data-bound')) return;
  table.setAttribute('data-bound', '');

  const list = template.content.firstElementChild?.cloneNode(true);
  if (!list) return;

  const phone = window.matchMedia(PHONE);
  const place = () => {
    if (phone.matches) {
      if (!list.isConnected) table.replaceWith(list);
    } else if (!table.isConnected) {
      list.replaceWith(table);
    }
  };

  place();
  phone.addEventListener('change', place);
}
