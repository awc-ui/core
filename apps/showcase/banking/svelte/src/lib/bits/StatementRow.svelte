<!--
  One statement line, shared by the home screen, the account drill, the cards
  screen and the statement itself.

  THE LEADING GLYPH IS THE CATEGORY, via the row's own `leading-icon` prop —
  there is no `md-icon` element in this library. A reader scanning a statement
  looks for "the supermarket", not "a card payment"; nine rows in ten are a card
  payment, so the type glyph would be the same shape down the whole list.

  `showDate` is false inside a day group, where the heading already states it.

  NO STATUS DOT. `md-status-dot` anchors absolutely to a positioned parent's
  bottom-end corner, which lands across the last two digits of a currency
  figure. `data-status` on the row drives the treatment from `app.css`.
-->
<script lang="ts">
  import { categoryIcon, txnTypeIcon, type Transaction } from '@awc-ui/showcase-kit/banking';
  import { t } from '$lib/showcase';
  import Flow from './Flow.svelte';

  export let txn: Transaction;
  export let showDate = true;

  $: meta = [
    $t(txn.typeKey),
    $t(txn.categoryKey),
    ...(txn.status === 'completed' ? [] : [$t(txn.statusKey)]),
  ].join(' · ');
</script>

<md-list-item
  headline={txn.counterparty}
  overline={showDate ? $t.formatDate(txn.date, 'medium') : undefined}
  supporting-text={meta}
  lines={showDate ? '3' : '2'}
  data-status={txn.status}
  leading-icon={categoryIcon[txn.category] ?? txnTypeIcon[txn.type]}
>
  <span slot="trailing" class="account-row__figures">
    <span class="txn-row__amount">
      <Flow value={txn.amount} currency={txn.currency} />
    </span>
    {#if txn.currency !== 'EUR'}
      <span class="muted"><Flow value={txn.amountEur} /></span>
    {/if}
  </span>
</md-list-item>
