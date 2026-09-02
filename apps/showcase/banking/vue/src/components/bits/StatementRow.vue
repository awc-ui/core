<!--
  One statement line, shared by the home screen, the account drill, the cards
  screen and the statement itself.

  THE LEADING GLYPH IS THE CATEGORY, via the row's own `leading-icon` prop —
  there is no `md-icon` element in this library. A reader scanning a statement
  is looking for "the supermarket", not "a card payment": nine rows in ten are
  a card payment, so the type glyph would be the same shape down the whole list.

  `showDate` is false inside a day group, where the group heading already
  states it — seven rows under one header would otherwise repeat the same date
  seven times. The home screen's preview is not grouped, so there it stays.

  NO STATUS DOT. `md-status-dot` anchors absolutely to a positioned parent's
  bottom-end corner, which lands across the last two digits of a currency
  figure. `data-status` on the row drives the treatment from `app.css`: a
  pending amount is muted, a declined one muted and struck.
-->
<script setup lang="ts">
import { computed } from 'vue';
import { categoryIcon, txnTypeIcon, type Transaction } from '@awc-ui/showcase-kit/banking';
import { useT } from '~/composables/useShowcase';
import Flow from './Flow.vue';

const props = withDefaults(defineProps<{ txn: Transaction; showDate?: boolean }>(), {
  showDate: true,
});

const t = useT();

const meta = computed(() => {
  const parts = [t.value(props.txn.typeKey), t.value(props.txn.categoryKey)];
  if (props.txn.status !== 'completed') parts.push(t.value(props.txn.statusKey));
  return parts.join(' · ');
});

const glyph = computed(() => categoryIcon[props.txn.category] ?? txnTypeIcon[props.txn.type]);
</script>

<template>
  <md-list-item
    :headline="txn.counterparty"
    :overline="showDate ? t.formatDate(txn.date, 'medium') : undefined"
    :supporting-text="meta"
    :lines="showDate ? '3' : '2'"
    :data-status="txn.status"
    :leading-icon="glyph"
  >
    <span slot="trailing" class="account-row__figures">
      <span class="txn-row__amount">
        <Flow :value="txn.amount" :currency="txn.currency" />
      </span>
      <span v-if="txn.currency !== 'EUR'" class="muted">
        <Flow :value="txn.amountEur" />
      </span>
    </span>
  </md-list-item>
</template>
