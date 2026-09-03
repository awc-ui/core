/**
 * Screen 5 — the cards, and the controls that act on them.
 *
 * THE ONLY SCREEN THAT CHANGES ANYTHING, which in a build with no framework
 * means every reachable state has to be in the document or in a template.
 *
 * WHAT SHIPS AND WHAT THE CLIENT SWAPS. The first card's detail is live; the
 * other four ride in a template each, and selecting a row swaps one in. The
 * frozen and blocked hints are templates too. With JavaScript off the page is
 * the first card's full detail — its tile, its facts, its controls and its
 * recent rows — which is what React's first paint is.
 *
 * FREEZE IS A SWITCH, BLOCK IS NOT. frozen is reversible and something the
 * holder did; blocked is terminal. A blocked card's controls ship disabled and
 * the reason is stated, rather than the switch being present and secretly
 * inert.
 */

import {
  getAccountById,
  getCards,
  getTotals,
  getTransactions,
  route,
} from '@awc-ui/showcase-kit/banking';
import { attrs, html } from '../lib/html.mjs';
import {
  cardKindChip,
  cardStateChip,
  count,
  money,
  percent,
  ratioMeter,
  statementRow,
} from '../lib/bits.mjs';
import { panel, screen } from '../components/shell.mjs';

const CONTROLS = [
  { key: 'contactless', labelKey: 'banking.control.contactless', icon: 'contactless' },
  { key: 'onlinePayments', labelKey: 'banking.control.online', icon: 'language' },
  { key: 'atmWithdrawals', labelKey: 'banking.control.atm', icon: 'local_atm' },
];

/** One card's detail pane: the tile, the facts, and the state hint. */
function cardDetail(t, card) {
  const account = getAccountById(card.accountId);
  const terminal = card.state === 'blocked';

  return html`<div class="stack">
    <!-- Decorative: every fact on the tile is repeated beside and below it. -->
    <div class="card-tile"${attrs({ 'data-state': card.state, 'aria-hidden': 'true' })}>
      <div class="card-tile__head">
        <span class="card-tile__label">${card.label}</span>
        <span class="card-tile__network">${card.network === 'visa' ? 'VISA' : 'MC'}</span>
      </div>
      <div class="card-tile__number">•••• •••• •••• ${card.last4}</div>
      <div class="card-tile__foot">
        <span>${card.expiry}</span>
        <span>${card.network.toUpperCase()}</span>
      </div>
    </div>

    <dl class="dl">
      <div>
        <dt>${t('banking.table.status')}</dt>
        <dd data-card-status>${cardStateChip(t, card.state)}</dd>
      </div>
      <div>
        <dt>${t('banking.table.kind')}</dt>
        <dd>${cardKindChip(t, card.kind)}</dd>
      </div>
      <div>
        <dt>${t('banking.table.account')}</dt>
        <dd>${account?.nickname ?? t('banking.common.na')}</dd>
      </div>
      <div>
        <dt>${t('banking.table.expiry')}</dt>
        <dd>${card.expiry}</dd>
      </div>
    </dl>

    <!-- Marked so the client can take the frozen one away again. Blocked is
         terminal, so its hint is never removed — but it is marked the same way
         rather than being the one hint nobody can find. -->
    ${terminal
      ? html`<p class="muted" data-state-hint="blocked">${t('banking.hint.blocked')}</p>`
      : card.state === 'frozen'
        ? html`<p class="muted" data-state-hint="frozen">${t('banking.hint.frozen')}</p>`
        : null}
  </div>`;
}

/** One card's control list. */
function cardControls(t, card) {
  const terminal = card.state === 'blocked';
  const frozen = card.state === 'frozen';

  return html`<md-list${attrs({
    'data-controls': true,
    label: t('banking.panel.controls'),
    class: 'table-host',
    'interaction-mode': 'multi-action',
  })}>
    <!-- Freeze first: the control someone opens this screen to find, and it
         gates the meaning of the three below it. -->
    <md-list-item${attrs({ headline: t('banking.action.freeze'), 'leading-icon': 'ac_unit', lines: '1' })}>
      <md-switch${attrs({
        slot: 'trailing',
        'data-control': 'freeze',
        selected: frozen || undefined,
        disabled: terminal || undefined,
        'aria-label': t('banking.action.freeze'),
      })}></md-switch>
    </md-list-item>

    ${CONTROLS.map(
      (control) => html`<md-list-item${attrs({
        headline: t(control.labelKey),
        'leading-icon': control.icon,
        lines: '1',
      })}>
        <md-switch${attrs({
          slot: 'trailing',
          'data-control': control.key,
          selected: card[control.key] || undefined,
          disabled: terminal || frozen || undefined,
          'aria-label': t(control.labelKey),
        })}></md-switch>
      </md-list-item>`,
    )}
  </md-list>`;
}

/** One card's spending limit. */
function cardLimit(t, card) {
  const account = getAccountById(card.accountId);
  if (card.monthlyLimit === null) {
    return html`<p class="muted">${t('banking.common.na')}</p>`;
  }
  const fraction = card.spentThisMonth / card.monthlyLimit;
  return html`<div class="budget-row">
    <div class="budget-row__head">
      <span>${t('banking.table.spent')}</span>
      <span class="strong">
        ${money(t, card.spentThisMonth, { currency: account?.currency })} /
        ${money(t, card.monthlyLimit, { currency: account?.currency })}
      </span>
    </div>
    ${ratioMeter(t, {
      label: t('banking.panel.limits'),
      fraction,
      color: card.spentThisMonth > card.monthlyLimit ? 'error' : 'primary',
    })}
    <div class="budget-row__foot">
      <span>${percent(t, fraction)}</span>
      <span>${t('banking.common.thisMonth')}</span>
    </div>
  </div>`;
}

/** One card's recent rows. */
function cardRows(t, card) {
  const rows = getTransactions({ cardId: card.id, limit: 8 });
  if (rows.length === 0) {
    return html`<div class="empty"><p>${t('banking.empty.transactions')}</p></div>`;
  }
  return html`<md-list${attrs({
    label: t('banking.panel.recent'),
    'interaction-mode': 'multi-action',
    'list-style': 'segmented',
  })}>${rows.map((txn) => statementRow(t, txn))}</md-list>`;
}

export function cardsScreen(t, locale) {
  const path = route.cards();
  const totals = getTotals();
  const cards = getCards();
  const first = cards[0];

  if (!first) {
    return screen(t, {
      locale,
      here: path,
      title: t('banking.screen.cards.title'),
      subtitle: t('banking.screen.cards.subtitle'),
      children: html`<div class="empty"><p>${t('banking.empty.cards')}</p></div>`,
    });
  }

  const others = cards.filter((c) => c.id !== first.id);

  return screen(t, {
    locale,
    here: path,
    title: t('banking.screen.cards.title'),
    subtitle: t('banking.screen.cards.subtitle'),
    aside: count(t, totals.activeCardCount),
    children: html`<div class="grid-2">
        ${panel({
          title: t('banking.panel.cards'),
          actions: count(t, cards.length),
          children: html`<md-list${attrs({
            'data-card-list': true,
            label: t('banking.panel.cards'),
            'interaction-mode': 'navigation',
            'selection-mode': 'single',
            'list-style': 'segmented',
          })}>
            ${cards.map(
              (card) => html`<md-list-item${attrs({
                'data-card': card.id,
                type: 'button',
                selected: card.id === first.id || undefined,
                headline: card.label,
                overline: t('banking.unit.endingIn', { last4: card.last4 }),
                'supporting-text': `${t(card.kindKey)} · ${t(card.stateKey)}`,
                lines: '3',
                'leading-icon': 'credit_card',
              })}>
                <span slot="trailing">${cardStateChip(t, card.state)}</span>
              </md-list-item>`,
            )}
          </md-list>`,
        })}

        ${panel({
          attributes: { 'data-detail-panel': true },
          title: first.label,
          subtitle: getAccountById(first.accountId)?.nickname,
          children: html`<div data-detail>${cardDetail(t, first)}</div>`,
        })}
      </div>

      <div class="grid-2">
        ${panel({
          title: t('banking.panel.controls'),
          children: html`<div data-controls-host>${cardControls(t, first)}</div>`,
        })}

        ${panel({
          title: t('banking.panel.limits'),
          children: html`<div data-limit>${cardLimit(t, first)}</div>`,
        })}
      </div>

      ${panel({
        attributes: { 'data-recent-panel': true },
        title: t('banking.panel.recent'),
        subtitle: first.label,
        children: html`<div data-recent>${cardRows(t, first)}</div>`,
      })}

      <!-- Every other card's four blocks, inert until the client swaps one in.
           A template's content is not in the live DOM, so the element census
           matches React's, which renders one card at a time. -->
      ${others.map(
        (card) => html`<template${attrs({ 'data-card-detail': card.id })}>${cardDetail(t, card)}</template>
          <template${attrs({ 'data-card-controls': card.id })}>${cardControls(t, card)}</template>
          <template${attrs({ 'data-card-limit': card.id })}>${cardLimit(t, card)}</template>
          <template${attrs({ 'data-card-recent': card.id })}>${cardRows(t, card)}</template>`,
      )}

      <!-- The hint the freeze switch reveals. The card labels and account
           names the panel headings take are not templated: the client reads
           them from the kit, which is where the build read them too. -->
      <template data-frozen-hint>
        <p class="muted" data-state-hint="frozen">${t('banking.hint.frozen')}</p>
      </template>

      <md-snackbar${attrs({
        'data-snackbar': true,
        class: 'app-snackbar',
        position: 'bottom',
        closeable: true,
        'auto-hide': true,
        'dismiss-label': t('banking.action.close'),
      })}></md-snackbar>`,
  });
}
