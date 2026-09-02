<!--
  The statement's filter body: a search and four labelled facets.

  A REAL COMPONENT FILE. In Svelte that is simply the idiomatic split, but it is
  worth stating why: the React port learned the hard way that a component
  defined INSIDE another component gets a new identity every render, so React
  unmounts the subtree and every ref-attached listener ends up holding a
  discarded node. Svelte resolves components at compile time, so the same
  mistake is not available here.

  EVERY FACET IS LABELLED. Four rows of outlined chips with nothing above them
  are four identical grey bands.
-->
<script lang="ts">
  import type { Account, Category, CategorySpend, TransactionStatus } from '@awc-ui/showcase-kit/banking';
  import { t } from '$lib/showcase';

  export let accounts: Account[];
  export let categories: CategorySpend[];
  export let months: string[];
  export let allMonths: string;
  export let statuses: TransactionStatus[];
  export let shown: number;
  export let total: number;
  export let filtered: boolean;

  export let month: string;
  export let accountId: string | null;
  export let category: Category | null;
  export let status: TransactionStatus | null;
  export let search: string;

  export let onClear: () => void;

  /*
   * `md-search` carries `{ value }` on EVERY one of its events — unlike
   * `md-text-field`, whose detail is the bare string. The two are different
   * components and the shapes do not match.
   *
   * `mdSearch` rather than `mdInput`: debounced and distinct-until-changed,
   * which is what a filter over hundreds of rows wants.
   */
  const onSearch = (event: Event) => {
    search = (event as CustomEvent<{ value: string }>).detail.value ?? '';
  };

  /* A month is a CHOICE: one is always on, and pressing the current one does
     nothing. The other three deselect when pressed again. */
  /*
   * A plain `Event`, narrowed inside. The ambient `on:mdSelect` declaration
   * types its detail for the LINK case (`{ href, originalEvent }`), which is
   * what a chip emits when it navigates; a filter chip's detail carries
   * `selected` instead. Declaring the handler with the narrower type is what
   * svelte-check rejects, so the cast happens where the shape is known.
   */
  const selectedOf = (event: Event) =>
    (event as CustomEvent<{ selected: boolean }>).detail.selected;

  const onMonth = (event: Event) => {
    const value = (event.target as HTMLElement | null)?.dataset?.month;
    if (value) month = value;
  };
  const onAccount = (event: Event) => {
    const value = (event.target as HTMLElement | null)?.dataset?.account;
    if (value) accountId = selectedOf(event) ? value : null;
  };
  const onCategory = (event: Event) => {
    const value = (event.target as HTMLElement | null)?.dataset?.category as Category | undefined;
    if (value) category = selectedOf(event) ? value : null;
  };
  const onStatus = (event: Event) => {
    const value = (event.target as HTMLElement | null)?.dataset?.status as TransactionStatus | undefined;
    if (value) status = selectedOf(event) ? value : null;
  };
</script>

<div class="stack">
  <!-- `trigger="bar"` and `full-width`: the default trigger is an icon that
       opens the field, which in a filter panel is a lone magnifying glass and
       reads as broken. -->
  <md-search
    layout="docked"
    trigger="bar"
    variant="contained"
    full-width
    debounce="250"
    label={$t('banking.action.search')}
    placeholder={$t('banking.table.merchant')}
    value={search}
    on:mdSearch={onSearch}
  ></md-search>

  <div class="facet">
    <p class="facet__label">{$t('banking.facet.month')}</p>
    <div class="facet-row" on:mdSelect={onMonth} role="group" aria-label={$t('banking.facet.month')}>
      {#each months as value (value)}
        <md-chip
          data-month={value}
          variant="filter"
          appearance="outlined"
          selected={month === value}
          label={$t.formatDate(`${value}-01`, 'monthYear')}
        ></md-chip>
      {/each}
      <md-chip
        data-month={allMonths}
        variant="filter"
        appearance="outlined"
        selected={month === allMonths}
        label={$t('banking.common.all')}
      ></md-chip>
    </div>
  </div>

  <div class="facet">
    <p class="facet__label">{$t('banking.facet.account')}</p>
    <div class="facet-row" on:mdSelect={onAccount} role="group" aria-label={$t('banking.facet.account')}>
      {#each accounts as account (account.id)}
        <md-chip
          data-account={account.id}
          variant="filter"
          appearance="outlined"
          selected={accountId === account.id}
          label={account.nickname}
        ></md-chip>
      {/each}
    </div>
  </div>

  <div class="facet">
    <p class="facet__label">{$t('banking.facet.category')}</p>
    <div class="facet-row" on:mdSelect={onCategory} role="group" aria-label={$t('banking.facet.category')}>
      {#each categories as row (row.category)}
        <md-chip
          data-category={row.category}
          variant="filter"
          appearance="outlined"
          selected={category === row.category}
          label={$t(row.categoryKey)}
        ></md-chip>
      {/each}
    </div>
  </div>

  <div class="facet">
    <p class="facet__label">{$t('banking.facet.status')}</p>
    <div class="facet-row" on:mdSelect={onStatus} role="group" aria-label={$t('banking.facet.status')}>
      {#each statuses as value (value)}
        <md-chip
          data-status={value}
          variant="filter"
          appearance="outlined"
          selected={status === value}
          label={$t(`banking.txnStatus.${value}`)}
        ></md-chip>
      {/each}
    </div>
  </div>

  <!-- The count and the reset belong to the panel, not to one facet: inside a
       scrolling chip row they collided with the last chip and scrolled out of
       reach together. -->
  <div class="row row--between facet-foot">
    <span class="muted">{$t('banking.common.showing', { shown, total })}</span>
    {#if filtered}
      <md-button variant="text" size="sm" icon="restart_alt" on:click={onClear}>
        {$t('banking.action.clearFilters')}
      </md-button>
    {/if}
  </div>
</div>
