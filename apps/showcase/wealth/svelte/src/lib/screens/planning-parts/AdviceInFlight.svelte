<!--
  The household's open advice, each with its review position.

  The determinate bar is `completedStepCount` of `stepCount` — a count against
  its total, handed to the component rather than pre-divided into a percentage,
  which is what `value` / `max` are for.
-->
<script lang="ts">
  import { getProposals } from '@awc-ui/showcase-kit/wealth';
  import { t } from '$lib/showcase';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import Money from '$lib/bits/Money.svelte';

  export let householdId: string;

  $: proposals = getProposals({ householdId, open: true });
</script>

{#if proposals.length === 0}
  <EmptyState message={$t('wealth.empty.proposals')} />
{:else}
  <div>
    {#each proposals as proposal (proposal.id)}
      <!-- 1-based for the reader; `currentStepIndex` is an array index. -->
      {@const position = $t('wealth.proposal.stepProgress', {
        current: proposal.currentStepIndex + 1,
        total: proposal.stepCount,
      })}
      {@const step = proposal.steps[proposal.currentStepIndex]}
      <div class="plan-progress">
        <div class="row row--between">
          <span class="strong">{$t(proposal.typeKey)}</span>
          <bdi class="muted">{position}</bdi>
        </div>
        <md-progress-indicator
          variant="linear"
          value={proposal.completedStepCount}
          max={proposal.stepCount}
          label={position}
        ></md-progress-indicator>
        <div class="row row--between">
          <span class="muted">{step ? $t(step.nameKey) : $t(proposal.statusKey)}</span>
          <span class="muted">
            <Money value={proposal.estimatedValue} compact />
          </span>
        </div>
      </div>
    {/each}
  </div>
{/if}
