<!--
  The cards, and the controls that act on them.

  THE ONLY SCREEN THAT CHANGES ANYTHING. All client state, because the fixture
  is frozen and a showcase that mutated it would stop being reproducible. State
  starts at the fixture's own values, so a reload is a reset.

  FREEZE IS A SWITCH, BLOCK IS NOT. `frozen` is reversible and something the
  holder did; `blocked` is terminal. A blocked card offers no thaw — its
  controls are disabled and the reason is stated, rather than the switch being
  present and secretly inert.
-->
<script lang="ts">
  import {
    cardStateColor,
    getAccountById,
    getCards,
    getTotals,
    getTransactions,
    type CardState,
  } from '@awc-ui/showcase-kit/banking';
  import { t } from '$lib/showcase';
  import Screen from '$lib/components/Screen.svelte';
  import Panel from '$lib/components/Panel.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import Count from '$lib/bits/Count.svelte';
  import Money from '$lib/bits/Money.svelte';
  import Percent from '$lib/bits/Percent.svelte';
  import StateChip from '$lib/bits/StateChip.svelte';
  import RatioMeter from '$lib/bits/RatioMeter.svelte';
  import StatementRow from '$lib/bits/StatementRow.svelte';

  const CONTROLS = [
    { key: 'contactless', labelKey: 'banking.control.contactless', icon: 'contactless' },
    { key: 'onlinePayments', labelKey: 'banking.control.online', icon: 'language' },
    { key: 'atmWithdrawals', labelKey: 'banking.control.atm', icon: 'local_atm' },
  ] as const;
  type ControlKey = (typeof CONTROLS)[number]['key'];

  const totals = getTotals();
  const cards = getCards();

  let selectedId = cards[0]?.id ?? '';
  /* Overrides on top of the fixture, keyed by card. Absent means "as shipped". */
  let states: Record<string, CardState> = {};
  let controls: Record<string, Partial<Record<ControlKey, boolean>>> = {};
  let message: string | null = null;

  $: card = cards.find((c) => c.id === selectedId) ?? cards[0];
  $: state = card ? (states[card.id] ?? card.state) : 'active';
  $: account = card ? getAccountById(card.accountId) : undefined;
  $: rows = card ? getTransactions({ cardId: card.id, limit: 8 }) : [];
  $: terminal = state === 'blocked';

  const stateOf = (id: string, s: Record<string, CardState>) =>
    s[id] ?? cards.find((c) => c.id === id)?.state ?? 'active';
  const controlOf = (key: ControlKey) =>
    card ? (controls[card.id]?.[key] ?? card[key]) : false;

  const onListClick = (event: Event) => {
    const row = (event.target as HTMLElement | null)?.closest?.('md-list-item');
    const id = (row as HTMLElement | null)?.dataset?.card;
    if (id) selectedId = id;
  };

  /* `md-switch` emits `mdChange` AFTER it has flipped itself, so the element's
     own state is already right and only this screen has to follow. */
  const onControl = (event: CustomEvent<{ selected: boolean }>) => {
    const key = (event.target as HTMLElement | null)?.dataset?.control as ControlKey | undefined;
    if (!key || !card) return;
    controls = { ...controls, [card.id]: { ...controls[card.id], [key]: event.detail.selected } };
    message = $t('banking.msg.controlSaved');
  };

  const onFreeze = (event: CustomEvent<{ selected: boolean }>) => {
    if (!card) return;
    const next: CardState = event.detail.selected ? 'frozen' : 'active';
    states = { ...states, [card.id]: next };
    message = $t(next === 'frozen' ? 'banking.msg.cardFrozen' : 'banking.msg.cardUnfrozen');
  };

  /* Auto-hide, the close button and `hide()` all emit `mdClose`; assigning
     `open = false` from script does not. Clearing here is what lets the next
     message reopen it. */
  const onSnackClose = () => (message = null);
</script>

<Screen title={$t('banking.screen.cards.title')} subtitle={$t('banking.screen.cards.subtitle')}>
  <svelte:fragment slot="aside"><Count value={totals.activeCardCount} /></svelte:fragment>

  {#if !card}
    <EmptyState message={$t('banking.empty.cards')} />
  {:else}
    <div class="grid-2">
      <Panel title={$t('banking.panel.cards')}>
        <svelte:fragment slot="actions"><Count value={cards.length} /></svelte:fragment>
        <md-list
          label={$t('banking.panel.cards')}
          interaction-mode="navigation"
          selection-mode="single"
          list-style="segmented"
          on:mdClick={onListClick}
        >
          {#each cards as c (c.id)}
            <md-list-item
              data-card={c.id}
              type="button"
              selected={c.id === card.id || undefined}
              headline={c.label}
              overline={$t('banking.unit.endingIn', { last4: c.last4 })}
              supporting-text={`${$t(c.kindKey)} · ${$t(`banking.cardState.${stateOf(c.id, states)}`)}`}
              lines="3"
              leading-icon="credit_card"
            >
              <span slot="trailing">
                <StateChip
                  labelKey={`banking.cardState.${stateOf(c.id, states)}`}
                  color={cardStateColor[stateOf(c.id, states)]}
                />
              </span>
            </md-list-item>
          {/each}
        </md-list>
      </Panel>

      <Panel title={card.label} subtitle={account?.nickname}>
        <div class="stack">
          <!-- Decorative: every fact on the tile is repeated beside and below. -->
          <div class="card-tile" data-state={state} aria-hidden="true">
            <div class="card-tile__head">
              <span class="card-tile__label">{card.label}</span>
              <span class="card-tile__network">{card.network === 'visa' ? 'VISA' : 'MC'}</span>
            </div>
            <div class="card-tile__number">•••• •••• •••• {card.last4}</div>
            <div class="card-tile__foot">
              <span>{card.expiry}</span>
              <span>{card.network.toUpperCase()}</span>
            </div>
          </div>

          <dl class="dl">
            <div>
              <dt>{$t('banking.table.status')}</dt>
              <dd><StateChip labelKey={`banking.cardState.${state}`} color={cardStateColor[state]} /></dd>
            </div>
            <div>
              <dt>{$t('banking.table.kind')}</dt>
              <dd><StateChip labelKey={card.kindKey} color="secondary" /></dd>
            </div>
            <div>
              <dt>{$t('banking.table.account')}</dt>
              <dd>{account?.nickname ?? $t('banking.common.na')}</dd>
            </div>
            <div>
              <dt>{$t('banking.table.expiry')}</dt>
              <dd>{card.expiry}</dd>
            </div>
          </dl>

          {#if terminal}
            <p class="muted">{$t('banking.hint.blocked')}</p>
          {:else if state === 'frozen'}
            <p class="muted">{$t('banking.hint.frozen')}</p>
          {/if}
        </div>
      </Panel>
    </div>

    <div class="grid-2">
      <Panel title={$t('banking.panel.controls')}>
        <md-list
          label={$t('banking.panel.controls')}
          class="table-host"
          interaction-mode="multi-action"
          on:mdChange={onControl}
        >
          <!-- Freeze first: the control someone opens this screen to find, and
               it gates the meaning of the three below it. -->
          <md-list-item headline={$t('banking.action.freeze')} leading-icon="ac_unit" lines="1">
            <md-switch
              slot="trailing"
              selected={state === 'frozen' || undefined}
              disabled={terminal || undefined}
              aria-label={$t('banking.action.freeze')}
              on:mdChange|stopPropagation={onFreeze}
            ></md-switch>
          </md-list-item>

          {#each CONTROLS as control (control.key)}
            <md-list-item
              headline={$t(control.labelKey)}
              leading-icon={control.icon}
              lines="1"
            >
              <md-switch
                slot="trailing"
                data-control={control.key}
                selected={controlOf(control.key) || undefined}
                disabled={terminal || state === 'frozen' || undefined}
                aria-label={$t(control.labelKey)}
              ></md-switch>
            </md-list-item>
          {/each}
        </md-list>
      </Panel>

      <Panel title={$t('banking.panel.limits')}>
        {#if card.monthlyLimit === null}
          <p class="muted">{$t('banking.common.na')}</p>
        {:else}
          <div class="budget-row">
            <div class="budget-row__head">
              <span>{$t('banking.table.spent')}</span>
              <span class="strong">
                <Money value={card.spentThisMonth} currency={account?.currency} /> /
                <Money value={card.monthlyLimit} currency={account?.currency} />
              </span>
            </div>
            <RatioMeter
              label={$t('banking.panel.limits')}
              fraction={card.spentThisMonth / card.monthlyLimit}
              color={card.spentThisMonth > card.monthlyLimit ? 'error' : 'primary'}
            />
            <div class="budget-row__foot">
              <span><Percent value={card.spentThisMonth / card.monthlyLimit} /></span>
              <span>{$t('banking.common.thisMonth')}</span>
            </div>
          </div>
        {/if}
      </Panel>
    </div>

    <Panel title={$t('banking.panel.recent')} subtitle={card.label}>
      {#if rows.length === 0}
        <EmptyState message={$t('banking.empty.transactions')} />
      {:else}
        <md-list label={$t('banking.panel.recent')} interaction-mode="multi-action" list-style="segmented">
          {#each rows as txn (txn.id)}<StatementRow {txn} />{/each}
        </md-list>
      {/if}
    </Panel>

    <md-snackbar
      class="app-snackbar"
      position="bottom"
      closeable
      auto-hide
      open={message !== null || undefined}
      message={message ?? ''}
      dismiss-label={$t('banking.action.close')}
      on:mdClose={onSnackClose}
    ></md-snackbar>
  {/if}
</Screen>
