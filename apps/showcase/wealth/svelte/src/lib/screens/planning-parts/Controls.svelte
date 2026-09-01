<!--
  The what-if control stack: the two sliders and the reset row.

  One component because the SAME stack renders in exactly one of two homes —
  inline in the projection panel above 900px, inside the `md-bottom-sheet`
  below it — and duplicating the markup at both call sites is how the two
  copies drift. Only one instance is ever mounted at a time (the screen's
  `{#if}` sees to that); two mounted at once would be two identically-labelled
  sliders in the document.

  In the React build this stack is a JSX variable in `PlanningScreen.tsx` and
  the two contribution constants live at that file's module scope; here the
  stack is a component, so the constants that bound its control moved with it.
-->
<script lang="ts">
  import type { Goal, GoalProjectionPoint } from '@awc-ui/showcase-kit/wealth';
  import { t } from '$lib/showcase';
  import Money from '$lib/bits/Money.svelte';
  import DateText from '$lib/bits/DateText.svelte';
  import SliderControl from './SliderControl.svelte';

  /**
   * The what-if contribution slider's ceiling, as a multiple of the objective's
   * own monthly contribution, and its increment in euro.
   *
   * These bound a CONTROL; they are not a figure this screen reports. The value
   * the slider produces is fed to the kit and everything downstream of it comes
   * back out of `goalProjection`.
   */
  const CONTRIBUTION_HEADROOM = 3;
  const CONTRIBUTION_STEP = 500;

  export let selected: Goal;
  export let contribution: number;
  export let horizonIndex: number;
  export let lastIndex: number;
  export let livePoint: GoalProjectionPoint | undefined;
  export let adjusted: boolean;
  export let onContribution: (value: number) => void;
  export let onHorizonIndex: (value: number) => void;
  export let onReset: () => void;

  $: contributionMax = Math.max(
    CONTRIBUTION_STEP,
    Math.ceil((selected.monthlyContribution * CONTRIBUTION_HEADROOM) / CONTRIBUTION_STEP) *
      CONTRIBUTION_STEP,
  );

  $: monthsText = $t('wealth.goal.monthsRemaining', {
    count: $t.formatNumber(livePoint?.month ?? 0, { maximumFractionDigits: 0 }),
  });
</script>

<div class="stack">
  <SliderControl
    label={$t('wealth.table.contribution')}
    valueText={$t.formatCurrency(contribution, { maximumFractionDigits: 0 })}
    value={contribution}
    min={0}
    max={contributionMax}
    step={CONTRIBUTION_STEP}
    onChange={onContribution}
  >
    <svelte:fragment slot="display"><Money value={contribution} /></svelte:fragment>
  </SliderControl>

  <SliderControl
    label={$t('wealth.table.targetDate')}
    valueText={monthsText}
    value={horizonIndex}
    min={1}
    max={lastIndex}
    step={1}
    stops
    onChange={onHorizonIndex}
  >
    <svelte:fragment slot="display">
      {#if livePoint}<DateText value={livePoint.date} />{/if}
    </svelte:fragment>
  </SliderControl>

  <div class="row row--between">
    <bdi class="muted">{monthsText}</bdi>
    <!--
      `action.reset` is a CORE key, not a `wealth.` one. The wealth block has
      no reset verb, and an invented key renders as the key itself —
      `createTranslator` falls back to English and then to the string. The core
      block is the shared chrome and is translated in every locale, so
      borrowing it is the least-wrong option until `wealth.action.reset`
      exists. Flagged in the handover.
    -->
    <md-button
      variant="text"
      size="sm"
      icon="restart_alt"
      disabled={!adjusted || undefined}
      on:mdClick={onReset}
    >
      {$t('action.reset')}
    </md-button>
  </div>
</div>
