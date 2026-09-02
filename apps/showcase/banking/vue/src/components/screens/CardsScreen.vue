<!--
  The cards, and the controls that act on them.

  THE ONLY SCREEN THAT CHANGES ANYTHING. Freezing a card, flipping a control,
  moving a limit — all client state, because the fixture is frozen and a
  showcase that mutated it would stop being reproducible. State starts at the
  fixture's own values, so a reload is a reset.

  FREEZE IS A SWITCH, BLOCK IS NOT. `frozen` is reversible and something the
  holder did; `blocked` is terminal and means the card was lost. A blocked card
  offers no thaw — its controls are disabled outright and the reason is stated,
  rather than the switch being present and secretly inert.
-->
<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  cardStateColor,
  getAccountById,
  getCards,
  getTotals,
  getTransactions,
  type CardState,
} from '@awc-ui/showcase-kit/banking';
import { useT } from '~/composables/useShowcase';
import Screen from '~/components/Screen.vue';
import Panel from '~/components/Panel.vue';
import EmptyState from '~/components/EmptyState.vue';
import Count from '~/components/bits/Count.vue';
import Money from '~/components/bits/Money.vue';
import Percent from '~/components/bits/Percent.vue';
import StateChip from '~/components/bits/StateChip.vue';
import RatioMeter from '~/components/bits/RatioMeter.vue';
import StatementRow from '~/components/bits/StatementRow.vue';

const CONTROLS = [
  { key: 'contactless', labelKey: 'banking.control.contactless', icon: 'contactless' },
  { key: 'onlinePayments', labelKey: 'banking.control.online', icon: 'language' },
  { key: 'atmWithdrawals', labelKey: 'banking.control.atm', icon: 'local_atm' },
] as const;

type ControlKey = (typeof CONTROLS)[number]['key'];

const t = useT();
const totals = getTotals();
const cards = getCards();

const selectedId = ref(cards[0]?.id ?? '');
/* Overrides on top of the fixture, keyed by card. Absent means "as shipped",
   which is what makes a reload a reset without a second copy of the data. */
const states = ref<Record<string, CardState>>({});
const controls = ref<Record<string, Partial<Record<ControlKey, boolean>>>>({});
const message = ref<string | null>(null);

const card = computed(() => cards.find((c) => c.id === selectedId.value) ?? cards[0]);
const state = computed<CardState>(() =>
  card.value ? (states.value[card.value.id] ?? card.value.state) : 'active',
);
const account = computed(() => (card.value ? getAccountById(card.value.accountId) : undefined));
const rows = computed(() => (card.value ? getTransactions({ cardId: card.value.id, limit: 8 }) : []));
const terminal = computed(() => state.value === 'blocked');

const stateOf = (id: string) => states.value[id] ?? cards.find((c) => c.id === id)?.state ?? 'active';
const controlOf = (key: ControlKey) =>
  card.value ? (controls.value[card.value.id]?.[key] ?? card.value[key]) : false;

const listListeners = {
  mdClick: (event: Event) => {
    const row = (event.target as HTMLElement | null)?.closest?.('md-list-item');
    const id = (row as HTMLElement | null)?.dataset?.card;
    if (id) selectedId.value = id;
  },
};

/* `md-switch` emits `mdChange` AFTER it has flipped itself, so the element's
   own state is already right and only this screen has to follow. */
const controlsListeners = {
  mdChange: (event: Event) => {
    const key = (event.target as HTMLElement | null)?.dataset?.control as ControlKey | undefined;
    if (!key || !card.value) return;
    controls.value = {
      ...controls.value,
      [card.value.id]: {
        ...controls.value[card.value.id],
        [key]: (event as CustomEvent<{ selected: boolean }>).detail.selected,
      },
    };
    message.value = t.value('banking.msg.controlSaved');
  },
};

const freezeListeners = {
  mdChange: (event: Event) => {
    if (!card.value) return;
    const next: CardState = (event as CustomEvent<{ selected: boolean }>).detail.selected
      ? 'frozen'
      : 'active';
    states.value = { ...states.value, [card.value.id]: next };
    message.value = t.value(next === 'frozen' ? 'banking.msg.cardFrozen' : 'banking.msg.cardUnfrozen');
  },
};

/* Auto-hide, the close button and `hide()` all emit `mdClose`; assigning
   `open = false` from script does not. Clearing here is what lets the next
   message reopen it. */
const snackbarListeners = { mdClose: () => (message.value = null) };
</script>

<template>
  <Screen :title="t('banking.screen.cards.title')" :subtitle="t('banking.screen.cards.subtitle')">
    <template #aside><Count :value="totals.activeCardCount" /></template>

    <EmptyState v-if="!card" :message="t('banking.empty.cards')" />

    <template v-else>
      <div class="grid-2">
        <Panel :title="t('banking.panel.cards')">
          <template #actions><Count :value="cards.length" /></template>
          <md-list
            v-awc="{ on: listListeners }"
            :label="t('banking.panel.cards')"
            interaction-mode="navigation"
            selection-mode="single"
            list-style="segmented"
          >
            <md-list-item
              v-for="c in cards"
              :key="c.id"
              :data-card="c.id"
              type="button"
              :selected="c.id === card.id || undefined"
              :headline="c.label"
              :overline="t('banking.unit.endingIn', { last4: c.last4 })"
              :supporting-text="`${t(c.kindKey)} · ${t(`banking.cardState.${stateOf(c.id)}`)}`"
              lines="3"
              leading-icon="credit_card"
            >
              <span slot="trailing">
                <StateChip
                  :label-key="`banking.cardState.${stateOf(c.id)}`"
                  :color="cardStateColor[stateOf(c.id)]"
                />
              </span>
            </md-list-item>
          </md-list>
        </Panel>

        <Panel :title="card.label" :subtitle="account?.nickname">
          <div class="stack">
            <!-- Decorative: every fact on the tile is repeated in the list
                 beside it and the facts below. -->
            <div class="card-tile" :data-state="state" aria-hidden="true">
              <div class="card-tile__head">
                <span class="card-tile__label">{{ card.label }}</span>
                <span class="card-tile__network">{{ card.network === 'visa' ? 'VISA' : 'MC' }}</span>
              </div>
              <div class="card-tile__number">•••• •••• •••• {{ card.last4 }}</div>
              <div class="card-tile__foot">
                <span>{{ card.expiry }}</span>
                <span>{{ card.network.toUpperCase() }}</span>
              </div>
            </div>

            <dl class="dl">
              <div>
                <dt>{{ t('banking.table.status') }}</dt>
                <dd>
                  <StateChip :label-key="`banking.cardState.${state}`" :color="cardStateColor[state]" />
                </dd>
              </div>
              <div>
                <dt>{{ t('banking.table.kind') }}</dt>
                <dd><StateChip :label-key="card.kindKey" color="secondary" /></dd>
              </div>
              <div>
                <dt>{{ t('banking.table.account') }}</dt>
                <dd>{{ account?.nickname ?? t('banking.common.na') }}</dd>
              </div>
              <div>
                <dt>{{ t('banking.table.expiry') }}</dt>
                <dd>{{ card.expiry }}</dd>
              </div>
            </dl>

            <p v-if="terminal" class="muted">{{ t('banking.hint.blocked') }}</p>
            <p v-else-if="state === 'frozen'" class="muted">{{ t('banking.hint.frozen') }}</p>
          </div>
        </Panel>
      </div>

      <div class="grid-2">
        <Panel :title="t('banking.panel.controls')">
          <md-list
            v-awc="{ on: controlsListeners }"
            :label="t('banking.panel.controls')"
            class="table-host"
            interaction-mode="multi-action"
          >
            <!-- Freeze first: it is the control someone opens this screen to
                 find, and it gates the meaning of the three below it. -->
            <md-list-item :headline="t('banking.action.freeze')" leading-icon="ac_unit" lines="1">
              <md-switch
                v-awc="{ on: freezeListeners }"
                slot="trailing"
                :selected="state === 'frozen' || undefined"
                :disabled="terminal || undefined"
                :aria-label="t('banking.action.freeze')"
              ></md-switch>
            </md-list-item>

            <md-list-item
              v-for="control in CONTROLS"
              :key="control.key"
              :headline="t(control.labelKey)"
              :leading-icon="control.icon"
              lines="1"
            >
              <md-switch
                slot="trailing"
                :data-control="control.key"
                :selected="controlOf(control.key) || undefined"
                :disabled="terminal || state === 'frozen' || undefined"
                :aria-label="t(control.labelKey)"
              ></md-switch>
            </md-list-item>
          </md-list>
        </Panel>

        <Panel :title="t('banking.panel.limits')">
          <p v-if="card.monthlyLimit === null" class="muted">{{ t('banking.common.na') }}</p>
          <div v-else class="budget-row">
            <div class="budget-row__head">
              <span>{{ t('banking.table.spent') }}</span>
              <span class="strong">
                <Money :value="card.spentThisMonth" :currency="account?.currency" /> /
                <Money :value="card.monthlyLimit" :currency="account?.currency" />
              </span>
            </div>
            <RatioMeter
              :label="t('banking.panel.limits')"
              :fraction="card.spentThisMonth / card.monthlyLimit"
              :color="card.spentThisMonth > card.monthlyLimit ? 'error' : 'primary'"
            />
            <div class="budget-row__foot">
              <span><Percent :value="card.spentThisMonth / card.monthlyLimit" /></span>
              <span>{{ t('banking.common.thisMonth') }}</span>
            </div>
          </div>
        </Panel>
      </div>

      <Panel :title="t('banking.panel.recent')" :subtitle="card.label">
        <EmptyState v-if="rows.length === 0" :message="t('banking.empty.transactions')" />
        <md-list v-else :label="t('banking.panel.recent')" interaction-mode="multi-action" list-style="segmented">
          <StatementRow v-for="txn in rows" :key="txn.id" :txn="txn" />
        </md-list>
      </Panel>

      <md-snackbar
        v-awc="{ on: snackbarListeners }"
        class="app-snackbar"
        position="bottom"
        closeable
        auto-hide
        :open="message !== null || undefined"
        :message="message ?? ''"
        :dismiss-label="t('banking.action.close')"
      ></md-snackbar>
    </template>
  </Screen>
</template>
