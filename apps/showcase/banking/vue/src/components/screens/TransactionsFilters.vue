<!--
  The statement's filter body: a search and four labelled facets.

  A REAL COMPONENT FILE, not a function declared inside the screen. In Vue that
  is simply the idiomatic split — but it is worth saying why it matters, because
  the React port learned it the hard way: a component defined INSIDE another
  component gets a new identity on every render, so React unmounts and remounts
  the subtree and every ref-attached listener ends up holding a discarded node.
  Vue resolves components by module identity, so a separate `.vue` file cannot
  have that problem. The equivalent mistake here would be building the tree with
  a render function created in `setup`.

  EVERY FACET IS LABELLED. Four rows of outlined chips with nothing above them
  are four identical grey bands; a reader cannot tell the months from the
  accounts without reading every chip.

  `defineModel` for each value, so the screen owns the state and this owns the
  presentation — no event plumbing to keep in step.
-->
<script setup lang="ts">
import {
  type Category,
  type CategorySpend,
  type Account,
  type TransactionStatus,
} from '@awc-ui/showcase-kit/banking';
import { useT } from '~/composables/useShowcase';

const props = defineProps<{
  accounts: Account[];
  categories: CategorySpend[];
  months: string[];
  allMonths: string;
  statuses: TransactionStatus[];
  shown: number;
  total: number;
  filtered: boolean;
}>();

const emit = defineEmits<{ clear: [] }>();

const month = defineModel<string>('month', { required: true });
const accountId = defineModel<string | null>('accountId', { required: true });
const category = defineModel<Category | null>('category', { required: true });
const status = defineModel<TransactionStatus | null>('status', { required: true });
const search = defineModel<string>('search', { required: true });

const t = useT();

/*
 * `md-search` carries `{ value }` on every one of its events — unlike
 * `md-text-field`, whose detail is the bare string. `mdSearch` rather than
 * `mdInput`: it is debounced and distinct-until-changed, which is what a filter
 * over hundreds of rows wants, and clearing flushes it immediately.
 */
const searchListeners = {
  mdSearch: (event: Event) => {
    search.value = (event as CustomEvent<{ value: string }>).detail.value ?? '';
  },
};

/* A month is a CHOICE: one is always on, and pressing the current one does
   nothing. The other three deselect when pressed again — `mdSelect` reports
   the new state, so the null branch is the deselect. */
const monthListeners = {
  mdSelect: (event: Event) => {
    const value = (event.target as HTMLElement | null)?.dataset?.month;
    if (value) month.value = value;
  },
};

const pick = <T extends string>(key: string, model: { value: T | null }) => ({
  mdSelect: (event: Event) => {
    const value = (event.target as HTMLElement | null)?.dataset?.[key] as T | undefined;
    if (!value) return;
    model.value = (event as CustomEvent<{ selected: boolean }>).detail.selected ? value : null;
  },
});

const accountListeners = pick<string>('account', accountId);
const categoryListeners = pick<Category>('category', category);
const statusListeners = pick<TransactionStatus>('status', status);
</script>

<template>
  <div class="stack">
    <!-- `trigger="bar"` and `full-width`: the default trigger is an icon that
         opens the field, which in a filter panel is a lone magnifying glass and
         reads as broken. -->
    <md-search
      v-awc="{ on: searchListeners }"
      layout="docked"
      trigger="bar"
      variant="contained"
      full-width
      debounce="250"
      :label="t('banking.action.search')"
      :placeholder="t('banking.table.merchant')"
      :value="search"
    ></md-search>

    <div class="facet">
      <p class="facet__label">{{ t('banking.facet.month') }}</p>
      <div v-awc="{ on: monthListeners }" class="facet-row">
        <md-chip
          v-for="value in props.months"
          :key="value"
          :data-month="value"
          variant="filter"
          appearance="outlined"
          :selected="month === value || undefined"
          :label="t.formatDate(`${value}-01`, 'monthYear')"
        ></md-chip>
        <md-chip
          :data-month="props.allMonths"
          variant="filter"
          appearance="outlined"
          :selected="month === props.allMonths || undefined"
          :label="t('banking.common.all')"
        ></md-chip>
      </div>
    </div>

    <div class="facet">
      <p class="facet__label">{{ t('banking.facet.account') }}</p>
      <div v-awc="{ on: accountListeners }" class="facet-row">
        <md-chip
          v-for="account in props.accounts"
          :key="account.id"
          :data-account="account.id"
          variant="filter"
          appearance="outlined"
          :selected="accountId === account.id || undefined"
          :label="account.nickname"
        ></md-chip>
      </div>
    </div>

    <div class="facet">
      <p class="facet__label">{{ t('banking.facet.category') }}</p>
      <div v-awc="{ on: categoryListeners }" class="facet-row">
        <md-chip
          v-for="row in props.categories"
          :key="row.category"
          :data-category="row.category"
          variant="filter"
          appearance="outlined"
          :selected="category === row.category || undefined"
          :label="t(row.categoryKey)"
        ></md-chip>
      </div>
    </div>

    <div class="facet">
      <p class="facet__label">{{ t('banking.facet.status') }}</p>
      <div v-awc="{ on: statusListeners }" class="facet-row">
        <md-chip
          v-for="value in props.statuses"
          :key="value"
          :data-status="value"
          variant="filter"
          appearance="outlined"
          :selected="status === value || undefined"
          :label="t(`banking.txnStatus.${value}`)"
        ></md-chip>
      </div>
    </div>

    <!-- The count and the reset belong to the panel, not to one facet: inside
         a scrolling chip row they collided with the last chip and scrolled out
         of reach together. -->
    <div class="row row--between facet-foot">
      <span class="muted">{{ t('banking.common.showing', { shown: props.shown, total: props.total }) }}</span>
      <md-button
        v-if="props.filtered"
        variant="text"
        size="sm"
        icon="restart_alt"
        @click="emit('clear')"
      >
        {{ t('banking.action.clearFilters') }}
      </md-button>
    </div>
  </div>
</template>
