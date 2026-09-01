<!--
  One objective, as a card. Read-only: selection is the panel's `md-select` —
  `md-card`'s manual is explicit that a card whose content holds a focusable
  control (these hold chips) drops `role="button"` and its tabindex, leaving
  mouse-only activation and no keyboard path. Either the card is the control or
  its children are.

  `data-selected`, NOT a toggled `class` — the React build learned this the
  hard way: a framework-managed `class` on a custom element replaces the WHOLE
  attribute, taking Stencil's `hydrated` flag with it, and the card becomes a
  correctly-sized, fully-populated, permanently invisible box. Svelte updates
  `class` more surgically than React, but the house rule is the same everywhere
  for a reason: a CHANGING state on a custom element rides on a data attribute,
  never on `class`. `undefined` rather than `''` for the off state, so
  `[data-selected]` matches only when it is on.
-->
<script lang="ts">
  import type { Goal } from '@awc-ui/showcase-kit/wealth';
  import { t } from '$lib/showcase';
  import { route } from '$lib/routes';
  import Drill from '$lib/components/Drill.svelte';
  import Chips from '$lib/bits/Chips.svelte';
  import Dots from '$lib/bits/Dots.svelte';
  import Fact from '$lib/bits/Fact.svelte';
  import FundedMeter from '$lib/bits/FundedMeter.svelte';
  import Money from '$lib/bits/Money.svelte';
  import DateText from '$lib/bits/DateText.svelte';

  export let goal: Goal;
  export let selected: boolean;
  export let swatch: string | undefined = undefined;
</script>

<md-card
  variant={selected ? 'filled' : 'outlined'}
  data-selected={selected ? '' : undefined}
  full-width
  full-height
>
  <!-- `--in-card`: the md-card around this already draws the surface, so the
       body must not draw a second one — see the note in app.css. -->
  <div class="goal-row goal-row--in-card">
    <div class="row row--between">
      <span class="with-dot">
        <Dots kind="goal" value={goal.status} />
        {#if swatch}<span class="plan-swatch" style="background: {swatch}"></span>{/if}
        <span class="strong">{$t(goal.typeKey)}</span>
      </span>
      <Chips kind="priority" value={goal.priority} />
    </div>

    <!-- A proper noun, or the objective belongs to the household itself. -->
    <p class="muted">{goal.beneficiaryName ?? $t('wealth.common.household')}</p>
    <Drill href={route.household(goal.householdId)}>{goal.householdName}</Drill>

    <FundedMeter fraction={goal.fundedPct} status={goal.status} />

    <div class="row row--between">
      <!--
        `<bdi>`, for the reason the `Signed` helper in `bits/` carries one:
        this is a mixed-direction run. The template is English (the wealth
        block ships English only), the two amounts are formatted numbers, and
        the word joining them is bidi-neutral — so under `dir="rtl"` the
        algorithm reorders it to "€900k of €792k" and the sentence says the
        opposite of what it means. `<bdi>` isolates the run and resolves its
        direction from its own first strong character, which keeps
        current-then-target. Verified in the browser at `?dir=rtl`.
      -->
      <bdi class="muted">
        {$t('wealth.goal.fundedOf', {
          current: $t.formatCurrency(goal.currentAmount, {
            notation: 'compact',
            maximumFractionDigits: 1,
          }),
          target: $t.formatCurrency(goal.targetAmount, {
            notation: 'compact',
            maximumFractionDigits: 1,
          }),
        })}
      </bdi>
      <Chips kind="goalStatus" value={goal.status} />
    </div>

    <dl class="dl">
      <Fact label={$t('wealth.table.targetDate')}>
        <DateText value={goal.targetDate} />
      </Fact>
      <Fact label={$t('wealth.table.contribution')}>
        <Money value={goal.monthlyContribution} />
      </Fact>
      <Fact label={$t('wealth.table.projected')}>
        <Money value={goal.projectedAmount} compact />
      </Fact>
      <Fact label={$t('wealth.table.shortfall')}>
        {#if goal.projectedShortfall > 0}
          <Money value={goal.projectedShortfall} compact />
        {:else}
          <span class="muted">{$t('wealth.common.none')}</span>
        {/if}
      </Fact>
    </dl>

    <p class="muted">
      <bdi>
        {$t('wealth.goal.monthsRemaining', {
          count: $t.formatNumber(goal.monthsRemaining, { maximumFractionDigits: 0 }),
        })}
      </bdi>
    </p>
  </div>
</md-card>
