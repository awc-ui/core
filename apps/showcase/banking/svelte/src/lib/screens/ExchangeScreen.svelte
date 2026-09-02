<!--
  The exchange desk: a ticket, a rate history, and the pairs the desk quotes.

  WHY THE QUOTE IS NOT COMPUTED HERE. `quote()` in the kit prices the trade —
  mid rate, spread, the fee off the SOURCE side, and the net. Per-port
  arithmetic would mean five implementations of the same rounding.

  AN INVALID PAIR IS UNREACHABLE, not refused: each select drops the other's
  current value, and the send side is limited to currencies with an account —
  you cannot send what you do not hold.
-->
<script lang="ts">
  import {
    getFxPairs,
    getSpendingAccounts,
    quote,
    rateSeries,
    type Currency,
  } from '@awc-ui/showcase-kit/banking';
  import { state, t } from '$lib/showcase';
  import Screen from '$lib/components/Screen.svelte';
  import Panel from '$lib/components/Panel.svelte';
  import Chart from '$lib/components/Chart.svelte';
  import Money from '$lib/bits/Money.svelte';
  import Percent from '$lib/bits/Percent.svelte';
  import Signed from '$lib/bits/Signed.svelte';

  const accounts = getSpendingAccounts();
  const pairs = getFxPairs();
  const QUOTED: Currency[] = ['EUR', 'USD', 'GBP', 'RON'];
  const held = QUOTED.filter((code) => accounts.some((a) => a.currency === code));

  let from: Currency = 'EUR';
  let to: Currency = 'GBP';
  /* A NUMBER: `md-number-field` emits one already parsed and renders its own
     steppers. `null` is empty — distinct from 0, a real amount. */
  let amount: number | null = 250;
  let done = false;

  $: sendOptions = held.filter((code) => code !== to);
  $: receiveOptions = QUOTED.filter((code) => code !== from);
  $: valid = amount !== null && amount > 0;
  $: priced = valid && from !== to ? quote(from, to, amount as number) : null;
  $: charted = pairs.find(
    (p) => (p.base === from && p.quote === to) || (p.base === to && p.quote === from),
  );
  $: history = charted ? rateSeries(charted.id) : [];
  $: canSwap = accounts.some((a) => a.currency === to);
  /* No same-currency branch: the option lists make that state unreachable. */
  $: reason = !valid
    ? $t('banking.hint.amountNeeded')
    : !priced
      ? $t('banking.hint.noPair')
      : null;
  $: formatOptions = JSON.stringify({
    style: 'currency',
    currency: from,
    maximumFractionDigits: 2,
  });

  /* Both events: `mdInput` for typing, `mdChange` for a commit. The detail is
     `{ value, formattedValue, reason }` — already a number, no parsing. */
  const onAmountInput = (e: CustomEvent<{ value: number | null }>) => {
    amount = e.detail.value;
    done = false;
  };
  const onAmountChange = (e: CustomEvent<{ value: number | null }>) => {
    amount = e.detail.value;
  };
  const pick = (e: CustomEvent<string | string[]>) => {
    const d = e.detail;
    return Array.isArray(d) ? d[0] : d;
  };
  const onFrom = (e: CustomEvent<string | string[]>) => {
    const v = pick(e);
    if (v) from = v as Currency;
    done = false;
  };
  const onTo = (e: CustomEvent<string | string[]>) => {
    const v = pick(e);
    if (v) to = v as Currency;
    done = false;
  };

  /* Only when the receive currency is one you hold: otherwise the swap sets a
     send currency deliberately absent from that select's own options. */
  const swap = () => {
    if (!canSwap) return;
    const previous = from;
    from = to;
    to = previous;
    done = false;
  };

  /** Always a string, so both boxes keep the same height. */
  const balanceIn = (currency: Currency) => {
    const account = accounts.find((a) => a.currency === currency);
    return account
      ? $t.formatCurrency(account.balance, {
          currency,
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      : $t('banking.hint.noAccount');
  };
</script>

<Screen title={$t('banking.screen.exchange.title')} subtitle={$t('banking.screen.exchange.subtitle')}>
  <div class="grid-2">
    <Panel title={$t('banking.panel.ticket')}>
      <div class="stack">
        <!-- Both selects carry supporting text: only one having any made the
             row bottom-align two boxes of different heights. -->
        <div class="ticket">
          <md-select
            label={$t('banking.table.send')}
            value={from}
            supporting-text={balanceIn(from)}
            on:mdChange={onFrom}
          >
            {#each sendOptions as code (code)}
              <md-select-option value={code} label={code}></md-select-option>
            {/each}
          </md-select>

          <md-tooltip text={$t('banking.hint.cannotSwap')} disabled={canSwap || undefined}>
            <md-icon-button
              class="ticket__swap"
              icon="swap_horiz"
              aria-label={$t('banking.action.swap')}
              soft-disabled={!canSwap || undefined}
              on:click={swap}
            ></md-icon-button>
          </md-tooltip>

          <md-select
            label={$t('banking.table.receive')}
            value={to}
            supporting-text={balanceIn(to)}
            on:mdChange={onTo}
          >
            {#each receiveOptions as code (code)}
              <md-select-option value={code} label={code}></md-select-option>
            {/each}
          </md-select>
        </div>

        <md-number-field
          label={$t('banking.table.amount')}
          value={amount}
          min={0}
          step={10}
          small-step="1"
          large-step="100"
          locale={$state.locale}
          format-options={formatOptions}
          on:mdInput={onAmountInput}
          on:mdChange={onAmountChange}
        ></md-number-field>

        {#if priced}
          <div class="stack">
            <div class="quote-line">
              <span>{$t('banking.table.rate')}</span>
              <span class="num">
                1 {from} = {$t.formatNumber(priced.rate, { maximumFractionDigits: 4 })} {to}
              </span>
            </div>
            <div class="quote-line">
              <span>{$t('banking.table.spread')}</span>
              <span class="num">{$t('banking.unit.bps', { value: $t.formatNumber(priced.spreadBps) })}</span>
            </div>
            <div class="quote-line">
              <span>{$t('banking.table.fee')}</span>
              <!-- A zero fee is said in words: "Fee €0.00" reads as a charge
                   that rounds to nothing. The row stays — its absence is
                   indistinguishable from having missed it. -->
              <span class="num">
                {#if priced.feeFrom === 0}{$t('banking.common.free')}{:else}
                  <Money value={priced.feeFrom} currency={from} />
                {/if}
              </span>
            </div>
            <div class="quote-line quote-line--total">
              <span>{$t('banking.table.receive')}</span>
              <span class="num"><Money value={priced.net} currency={to} /></span>
            </div>
          </div>
        {/if}

        <div class="row">
          <md-tooltip text={reason ?? ''} disabled={reason === null || undefined}>
            <md-button
              variant="filled"
              icon="check"
              soft-disabled={reason !== null || done || undefined}
              on:click={() => (done = true)}
            >
              {$t('banking.action.confirm')}
            </md-button>
          </md-tooltip>
          {#if done}<span class="muted">{$t('banking.msg.exchanged')}</span>{/if}
        </div>
      </div>
    </Panel>

    <Panel
      title={$t('banking.panel.rateHistory')}
      subtitle={charted ? `${charted.base}/${charted.quote}` : $t('banking.common.na')}
    >
      <svelte:fragment slot="actions">
        {#if charted}<Signed value={charted.thirtyDayChangePct} kind="percent" />{/if}
      </svelte:fragment>
      {#if history.length > 0}
        <Chart
          tag="md-line-chart"
          class="chart-md"
          series={[{ id: 'rate', label: `${charted?.base}/${charted?.quote}`, data: history.map((p) => p.rate) }]}
          xAxis={{ data: history.map((p) => $t.formatDate(p.date, 'short')), scale: 'category' }}
          valueFormatter={(v) => $t.formatNumber(v ?? 0, { maximumFractionDigits: 4 })}
          summary={$t('banking.panel.rateHistory')}
          curve="monotone"
          grid="horizontal"
        />
      {/if}
    </Panel>
  </div>

  <Panel title={$t('banking.panel.details')} subtitle={$t('banking.screen.exchange.subtitle')}>
    <div class="grid-3">
      {#each pairs as pair (pair.id)}
        <md-card variant="outlined" full-width class="surface-card">
          <div class="row row--between">
            <span class="strong">{pair.base}/{pair.quote}</span>
            <Signed value={pair.thirtyDayChangePct} kind="percent" />
          </div>
          <dl class="dl">
            <div>
              <dt>{$t('banking.table.rate')}</dt>
              <dd class="num">{$t.formatNumber(pair.rate, { maximumFractionDigits: 4 })}</dd>
            </div>
            <div>
              <dt>{$t('banking.table.spread')}</dt>
              <dd class="num">{$t('banking.unit.bps', { value: $t.formatNumber(pair.spreadBps) })}</dd>
            </div>
            <div>
              <dt>{$t('banking.table.fee')}</dt>
              <dd class="num">
                {#if pair.feePct === 0}{$t('banking.common.free')}{:else}
                  <Percent value={pair.feePct} />
                {/if}
              </dd>
            </div>
          </dl>
        </md-card>
      {/each}
    </div>
  </Panel>

  <Panel title={$t('banking.panel.accounts')}>
    <div class="row">
      {#each accounts as account (account.id)}
        <span class="row">
          <md-chip variant="assist" appearance="outlined" color="secondary" label={account.currency}></md-chip>
          <Money value={account.balance} currency={account.currency} />
        </span>
      {/each}
    </div>
  </Panel>
</Screen>
