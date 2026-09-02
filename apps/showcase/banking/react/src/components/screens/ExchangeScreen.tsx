/**
 * The exchange desk: a ticket, a rate history, and the pairs the desk quotes.
 *
 * THE TICKET IS THE SCREEN. Everything else is context for the number in it.
 *
 * WHY THE QUOTE IS NOT COMPUTED HERE. `quote()` in the kit prices the trade —
 * the mid rate, the spread the desk keeps, the fee off the SOURCE side, and the
 * net. Doing it here would mean five ports each implementing the same rounding,
 * and the fee convention in particular is easy to get subtly wrong: taking it
 * off the destination instead produces a slightly different net for the same
 * trade, which is exactly the kind of small discrepancy that makes a reader
 * think the app cannot add up.
 *
 * THE SUBMIT IS SOFT-DISABLED WITH A STATED REASON rather than absent or
 * silently inert (§9.2). There are three reasons it can be off — no amount, the
 * same currency twice, an unquoted pair — and the ticket says which.
 */

import { useMemo, useRef, useState } from 'react';
import {
  getFxPairs,
  getSpendingAccounts,
  quote,
  rateSeries,
  type Currency,
} from '@awc-ui/showcase-kit/banking';
import { useShowcase, useT } from '@/lib/showcase';
import { useCustomEvent } from '../elements';
import { LineChart } from '../elements';
import { Panel, Screen } from '../Shell';
import { CurrencyChip, Money, Percent, Signed } from '../bits';

export function ExchangeScreen() {
  const t = useT();
  const { state } = useShowcase();
  const accounts = getSpendingAccounts();
  const pairs = getFxPairs();

  const [from, setFrom] = useState<Currency>('EUR');
  const [to, setTo] = useState<Currency>('GBP');
  /*
   * A NUMBER, because `md-number-field` deals in numbers.
   *
   * This was an `md-text-field type="number"` holding a string, which meant the
   * browser's own spinner arrows and a parse on every keystroke. The component
   * owns both: it emits `{ value: number | null }` already parsed, and renders
   * its own steppers. `null` is empty — distinct from 0, which is a real amount
   * a reader can type and which must not be treated as "nothing entered".
   */
  const [amount, setAmount] = useState<number | null>(250);
  const [done, setDone] = useState(false);

  const valid = amount !== null && amount > 0;

  const priced = useMemo(
    () => (valid && from !== to ? quote(from, to, amount) : null),
    [from, to, amount, valid],
  );

  /* The pair whose history is charted follows the ticket, either way round —
     the desk quotes six pairs, not twelve. */
  const charted = useMemo(
    () => pairs.find((p) => (p.base === from && p.quote === to) || (p.base === to && p.quote === from)),
    [pairs, from, to],
  );
  const history = useMemo(() => (charted ? rateSeries(charted.id) : []), [charted]);

  const amountRef = useRef<HTMLElement | null>(null);
  /* Both events: `mdInput` for typing and `mdChange` for a commit (blur, the
     steppers, the wheel). Listening to only one leaves either the live quote or
     the steppers dead. The detail is `{ value, formattedValue, reason }` and
     `value` is already a number — no parsing here. */
  useCustomEvent<CustomEvent<{ value: number | null }>>(amountRef, 'mdInput', (event) => {
    setAmount(event.detail.value);
    setDone(false);
  });
  useCustomEvent<CustomEvent<{ value: number | null }>>(amountRef, 'mdChange', (event) =>
    setAmount(event.detail.value),
  );

  const fromRef = useRef<HTMLElement | null>(null);
  const toRef = useRef<HTMLElement | null>(null);
  useCustomEvent<CustomEvent<string | string[]>>(fromRef, 'mdChange', (event) => {
    const value = Array.isArray(event.detail) ? event.detail[0] : event.detail;
    if (value) setFrom(value as Currency);
    setDone(false);
  });
  useCustomEvent<CustomEvent<string | string[]>>(toRef, 'mdChange', (event) => {
    const value = Array.isArray(event.detail) ? event.detail[0] : event.detail;
    if (value) setTo(value as Currency);
    setDone(false);
  });

  /**
   * Swap the two sides.
   *
   * ONLY WHEN THE RECEIVE CURRENCY IS ONE YOU HOLD. Narrowing the send list to
   * held currencies made this reachable: with RON on the receive side, swapping
   * would have set the send currency to RON — a value that is deliberately not
   * in that select's own option list, leaving the field showing something it
   * cannot offer. The button is disabled instead, which says the same thing
   * without producing the state.
   */
  const canSwap = accounts.some((a) => a.currency === to);

  const swap = () => {
    if (!canSwap) return;
    setFrom(to);
    setTo(from);
    setDone(false);
  };

  /*
   * One reason, chosen in the order a reader would hit them.
   *
   * There is no same-currency branch any more: the option lists make that state
   * unreachable, and a guard against a state that cannot occur is a branch
   * nobody will ever see and nobody can test.
   */
  const reason = !valid
    ? t('banking.hint.amountNeeded')
    : !priced
      ? t('banking.hint.noPair')
      : null;

  /**
   * Every currency the desk quotes.
   *
   * The two selects offer DIFFERENT SUBSETS of it, and neither offers the
   * other's current value.
   *
   * YOU CANNOT SEND WHAT YOU DO NOT HOLD, so the send side is limited to
   * currencies with an account behind them. RON is quotable and not held, so it
   * can be received and not sent — which is also why the send field can never
   * show "no account".
   *
   * AND YOU CANNOT EXCHANGE A CURRENCY FOR ITSELF. Each list drops the other's
   * current value, so `from === to` is unreachable rather than merely refused:
   * the receive list used to offer EUR while EUR was being sent, and picking it
   * produced a ticket that priced nothing and a Confirm that explained why it
   * was off. A control that cannot be got wrong beats one that says no.
   */
  const QUOTED: Currency[] = ['EUR', 'USD', 'GBP', 'RON'];

  const heldCurrencies = QUOTED.filter((code) => accounts.some((a) => a.currency === code));
  const sendOptions = heldCurrencies.filter((code) => code !== to);
  const receiveOptions = QUOTED.filter((code) => code !== from);

  /**
   * What is held in a currency, as the field's supporting text.
   *
   * Always returns a string, so both boxes keep the same height and the row
   * cannot drift out of alignment. A currency with no account behind it says so
   * in words — an em dash was tried and read as a stray minus sign floating
   * under the field rather than as "nothing here".
   */
  const balanceIn = (currency: Currency) => {
    const account = accounts.find((a) => a.currency === currency);
    // BOTH digit bounds, not just the maximum: the kit's `formatCurrency`
    // defaults the minimum to 0, so a balance of 1164.20 came out "£1,164.2".
    // Same two-decimal rule the `Money` component applies for this vertical.
    return account
      ? t.formatCurrency(account.balance, {
          currency,
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      : t('banking.hint.noAccount');
  };

  return (
    <Screen
      title={t('banking.screen.exchange.title')}
      subtitle={t('banking.screen.exchange.subtitle')}
    >
      <div className="grid-2">
        <Panel title={t('banking.panel.ticket')}>
          <div className="stack">
            {/*
              BOTH SELECTS CARRY SUPPORTING TEXT, and that is an alignment fix
              as much as a content one.

              Only the left one had any — a bare "Account", which under a
              CURRENCY picker read as though the field chose one. The row is
              `align-items: end`, so two boxes of different heights bottom-align
              and the taller one's top sits higher: the receive field hung
              visibly lower than the send field.

              Both now show the balance held in that currency, which is the
              thing a reader actually wants while pricing an exchange — whether
              there is enough to send, and what the other side already holds.
              `balanceIn` always returns a string — a currency with no account
              behind it says so in words — so the two boxes are always the same
              height and the row cannot drift apart again.
            */}
            <div className="ticket">
              <md-select
                ref={fromRef}
                label={t('banking.table.send')}
                value={from}
                supporting-text={balanceIn(from)}
              >
                {sendOptions.map((code) => (
                  <md-select-option key={code} value={code} label={code} />
                ))}
              </md-select>

              {/* An icon button, not a text one: the control has no label to
                  translate and the arrows say what it does in every locale. */}
              <md-tooltip
                text={t('banking.hint.cannotSwap')}
                disabled={canSwap || undefined}
              >
                {/* `class`, NOT `className`. React maps `className` to the
                    `class` attribute for HOST elements only; on a custom
                    element it passes the prop through under the name it was
                    given, so this emitted a literal `className="ticket__swap"`
                    attribute and the `.ticket__swap` rule — the one that
                    centres the button when the ticket stacks on a phone — has
                    never matched. */}
                <md-icon-button
                  class="ticket__swap"
                  icon="swap_horiz"
                  aria-label={t('banking.action.swap')}
                  soft-disabled={!canSwap || undefined}
                  onClick={swap}
                />
              </md-tooltip>

              <md-select
                ref={toRef}
                label={t('banking.table.receive')}
                value={to}
                supporting-text={balanceIn(to)}
              >
                {receiveOptions.map((code) => (
                  <md-select-option key={code} value={code} label={code} />
                ))}
              </md-select>
            </div>

            {/* `format-options` renders the figure as currency in the page's
                locale, so the field shows what it means rather than a bare
                number with the code bolted on. `locale` is passed explicitly:
                the component would otherwise format in the browser's locale
                while every other figure on the screen uses the dock's. */}
            <md-number-field
              ref={amountRef}
              label={t('banking.table.amount')}
              value={amount}
              min={0}
              step={10}
              small-step={1}
              large-step={100}
              locale={state.locale}
              format-options={JSON.stringify({
                style: 'currency',
                currency: from,
                maximumFractionDigits: 2,
              })}
            />

            {priced ? (
              <div className="stack">
                <div className="quote-line">
                  <span>{t('banking.table.rate')}</span>
                  <span className="num">
                    1 {from} = {t.formatNumber(priced.rate, { maximumFractionDigits: 4 })} {to}
                  </span>
                </div>
                <div className="quote-line">
                  <span>{t('banking.table.spread')}</span>
                  <span className="num">
                    {t('banking.unit.bps', { value: t.formatNumber(priced.spreadBps) })}
                  </span>
                </div>
                {/*
                  A ZERO FEE IS SAID IN WORDS, NOT AS A ZERO.
                  Three of the six pairs are free, and "Fee €0.00" reads as a
                  charge that happens to round to nothing — a reader checks it
                  twice. The row stays rather than disappearing: its absence
                  would be the one thing a reader could not tell apart from
                  having missed it.

                  The word is "Free" and not "No fee" because the label beside
                  it already says Fee, and "Fee — No fee" is the label twice.
                */}
                <div className="quote-line">
                  <span>{t('banking.table.fee')}</span>
                  <span className="num">
                    {priced.feeFrom === 0 ? (
                      t('banking.common.free')
                    ) : (
                      <Money value={priced.feeFrom} currency={from} />
                    )}
                  </span>
                </div>
                <div className="quote-line quote-line--total">
                  <span>{t('banking.table.receive')}</span>
                  <span className="num">
                    <Money value={priced.net} currency={to} />
                  </span>
                </div>
              </div>
            ) : null}

            <div className="row">
              {/* The tooltip exists only while the gate does: once the ticket
                  is priced the button is live, and an explanation of why it is
                  off would be a lie. */}
              <md-tooltip text={reason ?? ''} disabled={reason === null || undefined}>
                <md-button
                  variant="filled"
                  icon="check"
                  soft-disabled={reason !== null || done || undefined}
                  onClick={() => setDone(true)}
                >
                  {t('banking.action.confirm')}
                </md-button>
              </md-tooltip>
              {done ? <span className="muted">{t('banking.msg.exchanged')}</span> : null}
            </div>
          </div>
        </Panel>

        <Panel
          title={t('banking.panel.rateHistory')}
          subtitle={charted ? `${charted.base}/${charted.quote}` : t('banking.common.na')}
          actions={
            charted ? <Signed value={charted.thirtyDayChangePct} kind="percent" /> : null
          }
        >
          {history.length === 0 ? null : (
            <LineChart
              class="chart-md"
              series={[
                {
                  id: 'rate',
                  label: `${charted?.base}/${charted?.quote}`,
                  data: history.map((p) => p.rate),
                },
              ]}
              xAxis={{
                data: history.map((p) => t.formatDate(p.date, 'short')),
                scale: 'category',
              }}
              valueFormatter={(value: number | null) =>
                t.formatNumber(value ?? 0, { maximumFractionDigits: 4 })
              }
              summary={t('banking.panel.rateHistory')}
              curve="monotone"
              grid="horizontal"
            />
          )}
        </Panel>
      </div>

      <Panel title={t('banking.panel.details')} subtitle={t('banking.screen.exchange.subtitle')}>
        <div className="grid-3">
          {pairs.map((pair) => (
            <md-card key={pair.id} variant="outlined" full-width class="surface-card">
              <div className="row row--between">
                <span className="strong">
                  {pair.base}/{pair.quote}
                </span>
                <Signed value={pair.thirtyDayChangePct} kind="percent" />
              </div>
              <dl className="dl">
                <div>
                  <dt>{t('banking.table.rate')}</dt>
                  <dd className="num">{t.formatNumber(pair.rate, { maximumFractionDigits: 4 })}</dd>
                </div>
                <div>
                  <dt>{t('banking.table.spread')}</dt>
                  <dd className="num">
                    {t('banking.unit.bps', { value: t.formatNumber(pair.spreadBps) })}
                  </dd>
                </div>
                <div>
                  <dt>{t('banking.table.fee')}</dt>
                  {/* Same rule as the ticket above: "0%" is a rate, "No fee" is
                      the fact. */}
                  <dd className="num">
                    {pair.feePct === 0 ? t('banking.common.free') : <Percent value={pair.feePct} />}
                  </dd>
                </div>
              </dl>
            </md-card>
          ))}
        </div>
      </Panel>

      <Panel title={t('banking.panel.accounts')}>
        <div className="row">
          {accounts.map((account) => (
            <span key={account.id} className="row">
              <CurrencyChip currency={account.currency} />
              <Money value={account.balance} currency={account.currency} />
            </span>
          ))}
        </div>
      </Panel>
    </Screen>
  );
}
