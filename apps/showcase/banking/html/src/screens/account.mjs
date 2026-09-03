/**
 * Screen 7 — one account: its details, its month, and its statement.
 *
 * A DRILL, NOT A DESTINATION — only reachable from the home screen's account
 * list, and it renders breadcrumbs because it is one level down.
 *
 * ONE PAGE PER ACCOUNT, written at build time. There is no client guard for an
 * unknown id here and there does not need to be: only the five real accounts
 * have documents on disk, so an unknown one 404s at the host before any script
 * runs. That is the honest difference between a static export and the SPAs,
 * which each carry a not-found screen for the same case.
 *
 * WHAT THE CLIENT SCRIPT ADDS: nothing. Every element is complete as written.
 */

import {
  BASE_CURRENCY,
  accountSummaries,
  crumbsFor,
  getAccountById,
  getCards,
  getTransactions,
  route,
  statementDays,
} from '@awc-ui/showcase-kit/banking';
import { attrs, html } from '../lib/html.mjs';
import { localeHref } from '../lib/i18n.mjs';
import {
  accountKindChip,
  cardStateChip,
  count,
  currencyChip,
  dateText,
  flow,
  money,
  percent,
  signed,
  statementRow,
  vaultMeter,
} from '../lib/bits.mjs';
import { panel, screen } from '../components/shell.mjs';

export function accountScreen(t, locale, id) {
  const account = getAccountById(id);
  const path = route.account(id);
  const summary = accountSummaries().find((s) => s.account.id === id);
  const cards = getCards({ accountId: id });
  const rows = getTransactions({ accountId: id, limit: 40 });
  const days = statementDays(rows);
  const net = (summary?.inThisMonth ?? 0) - (summary?.outThisMonth ?? 0);

  return screen(t, {
    locale,
    here: path,
    crumbs: crumbsFor(path, account.nickname),
    title: account.nickname,
    subtitle: t('banking.screen.account.subtitle'),
    aside: html`${accountKindChip(t, account.kind)} ${currencyChip(account.currency)}`,
    children: html`<div class="grid-2">
        ${panel({
          title: t('banking.panel.details'),
          children: html`<dl class="dl">
              <div>
                <dt>${t('banking.table.balance')}</dt>
                <dd>${money(t, account.balance, { currency: account.currency })}</dd>
              </div>
              <div>
                <dt>${t('banking.table.available')}</dt>
                <dd>${money(t, account.available, { currency: account.currency })}</dd>
              </div>
              ${account.currency === BASE_CURRENCY
                ? null
                : html`<div>
                    <dt>${BASE_CURRENCY}</dt>
                    <dd>${money(t, account.balanceEur)}</dd>
                  </div>`}
              <div>
                <dt>${t('banking.table.iban')}</dt>
                <!-- bdi: an IBAN is a neutral-direction string that must not be
                     re-ordered inside the Arabic layout. -->
                <dd><bdi class="num">${account.iban}</bdi></dd>
              </div>
              ${account.interestRate === null
                ? null
                : html`<div>
                    <dt>${t('banking.table.interest')}</dt>
                    <dd>${percent(t, account.interestRate)}</dd>
                  </div>`}
            </dl>

            ${account.goalTarget === null
              ? null
              : html`<div class="budget-row">
                  <div class="budget-row__head">
                    <span class="strong">${account.goalName}</span>
                    <span class="muted">${t('banking.hint.vault', {
                      pct: t.formatPercent(account.goalFundedPct ?? 0, { maximumFractionDigits: 0 }),
                      target: t.formatCurrency(account.goalTarget, { notation: 'compact' }),
                    })}</span>
                  </div>
                  ${vaultMeter(t, {
                    fraction: account.goalFundedPct ?? 0,
                    label: account.goalName ?? '',
                  })}
                </div>`}`,
        })}

        ${panel({
          title: t('banking.common.thisMonth'),
          children: html`<dl class="dl">
              <div>
                <dt>${t('banking.kpi.income')}</dt>
                <dd>${money(t, summary?.inThisMonth ?? 0, { currency: account.currency })}</dd>
              </div>
              <div>
                <dt>${t('banking.panel.spending')}</dt>
                <dd>${money(t, summary?.outThisMonth ?? 0, { currency: account.currency })}</dd>
              </div>
              <div>
                <dt>${t('banking.kpi.netThisMonth')}</dt>
                <dd>${signed(t, net, { currency: account.currency })}</dd>
              </div>
            </dl>

            ${cards.length === 0
              ? html`<div class="empty"><p>${t('banking.empty.cards')}</p></div>`
              : html`<md-list${attrs({
                  label: t('banking.panel.cards'),
                  'interaction-mode': 'navigation',
                  'list-style': 'segmented',
                })}>
                  ${cards.map(
                    (card) => html`<md-list-item${attrs({
                      type: 'link',
                      href: localeHref(locale, route.cards()),
                      headline: card.label,
                      overline: t('banking.unit.endingIn', { last4: card.last4 }),
                      lines: '2',
                      'leading-icon': 'credit_card',
                    })}>
                      <span slot="trailing">${cardStateChip(t, card.state)}</span>
                    </md-list-item>`,
                  )}
                </md-list>`}`,
        })}
      </div>

      ${panel({
        title: t('banking.action.statement'),
        actions: count(t, rows.length),
        children:
          days.length === 0
            ? html`<div class="empty"><p>${t('banking.empty.transactions')}</p></div>`
            : days.map(
                (day) => html`<div class="stack">
                  <div class="statement-day">
                    <span>${dateText(t, day.date, 'long')}</span>
                    ${flow(t, day.netEur)}
                  </div>
                  <md-list${attrs({
                    label: t.formatDate(day.date, 'long'),
                    'interaction-mode': 'multi-action',
                    'list-style': 'segmented',
                  })}>
                    ${day.rows.map((txn) => statementRow(t, txn, { showDate: false }))}
                  </md-list>
                </div>`,
              ),
      })}`,
  });
}
