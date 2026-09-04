<!--
  The follow button, in whichever of its four states applies.

  `toggle` dispatches the state the caller should move TO. The button holds none
  of its own: the screen owns the override, so a reload is a reset.
-->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { followAction, type Person } from '@awc-ui/showcase-kit/social';
  import { t } from '$lib/showcase';

  export let person: Person;
  export let following: boolean;
  export let size: 'sm' | 'md' = 'sm';

  const dispatch = createEventDispatcher<{ toggle: boolean }>();

  /* The kit's table answers for the FIXTURE's relationship; a viewer who has
     since pressed the button is either following or not, and those are the only
     two states reachable after an override. */
  $: knownBoth = person.relationship === 'follower' || person.relationship === 'mutual';
  $: action = following
    ? followAction[knownBoth ? 'mutual' : 'following']
    : followAction[knownBoth ? 'follower' : 'none'];
</script>

{#if action}
  <md-button
    on:mdClick={() => dispatch('toggle', !following)}
    variant={action.variant}
    {size}
    icon={action.icon ?? undefined}
  >
    {$t(action.labelKey)}
  </md-button>
{/if}
