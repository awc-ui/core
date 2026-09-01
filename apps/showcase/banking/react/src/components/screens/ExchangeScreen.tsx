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
import { useT } from '@/lib/showcase';
import { useCustomEvent } from '../elements';
import { LineChart } from '../elements';
import { Panel, Screen } from '../Shell';
import { CurrencyChip, Money, Percent, Signed } from '../bits';

export function ExchangeScreen() {
  const t = useT();
  const accounts = getSpendingAccounts();
  const pairs = getFxPairs();

  const [from, setFrom] = useState<Currency>('EUR');
  const [to, setTo] = useState<Currency>('GBP');
  /* The amount is held as the STRING the field reported, not as a number.
     Parsing on every keystroke turns "1." into 1 and puts the cursor behind the
     dot the reader just typed. It is parsed once, below, where it is used. */
  const [amount, setAmount] = useState('250');
  const [done, setDone] = useState(false);

  const parsed = Number(amount.replace(',', '.'));
  const valid = Number.isFinite(parsed) && parsed > 0;

  const priced = useMemo(
    () => (valid && from !== to ? quote(from, to, parsed) : null),
    [from, to, parsed, valid],
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
     stepper buttons). Listening to only one leaves either the live estimate or
     the arrow keys dead. */
  useCustomEvent<CustomEvent<{ value: string }>>(amountRef, 'mdInput', (event) => {
    setAmount(event.detail?.value ?? '');
    setDone(false);
  });
  useCustomEvent<CustomEvent<{ value: string }>>(amountRef, 'mdChange', (event) =>
    setAmount(event.detail?.value ?? ''),
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

  const swap = () => {
    setFrom(to);
    setTo(from);
    setDone(false);
  };

  /* One reason, chosen in the order a reader would hit them. */
  const reason =
    from === to
      ? t('banking.hint.samePair')
      : !valid
        ? t('banking.hint.amountNeeded')
        : !priced
          ? t('banking.hint.noPair')
          : null;

  const currencies: Currency[] = ['EUR', 'USD', 'GBP', 'RON'];

  return (
    <Screen
      title={t('banking.screen.exchange.title')}
      subtitle={t('banking.screen.exchange.subtitle')}
    >
      <div className="grid-2">
        <Panel title={t('banking.panel.ticket')}>
          <div className="stack">
            <div className="ticket">
              <md-select
                ref={fromRef}
                label={t('banking.table.send')}
                value={from}
                supporting-text={t('banking.table.account')}
              >
                {currencies.map((code) => (
                  <md-select-option key={code} value={code} label={code} />
                ))}
              </md-select>

              {/* An icon button, not a text one: the control has no label to
                  translate and the arrows say what it does in every locale. */}
              <md-icon-button
                className="ticket__swap"
                icon="swap_horiz"
                aria-label={t('banking.action.swap')}
                onClick={swap}
              />

              <md-select ref={toRef} label={t('banking.table.receive')} value={to}>
                {currencies.map((code) => (
                  <md-select-option key={code} value={code} label={code} />
                ))}
              </md-select>
            </div>

            <md-text-field
              ref={amountRef}
              label={t('banking.table.amount')}
              type="number"
              inputmode="decimal"
              min="0"
              step="10"
              value={amount}
              suffix={from}
              error={valid || amount === '' ? undefined : true}
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
                <div className="quote-line">
                  <span>{t('banking.table.fee')}</span>
                  <span className="num">
                    <Money value={priced.feeFrom} currency={from} />
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
                  <dd className="num">
                    <Percent value={pair.feePct} />
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
