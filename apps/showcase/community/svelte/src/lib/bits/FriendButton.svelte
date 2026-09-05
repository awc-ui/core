<!-- THE TWO PENDING STATES ARE WHY THIS IS NOT A TOGGLE: somebody who asked
     you and somebody you asked are the same relationship from opposite ends and
     need opposite verbs. `incoming` routes to Accept/Decline, not to this. -->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { friendAction, type Friendship, type Person } from '@awc-ui/showcase-kit/community';
  import { t } from '$lib/showcase';

  export let person: Person;
  export let state: Friendship;
  export let size: 'sm' | 'md' = 'sm';

  const dispatch = createEventDispatcher<{ act: Friendship }>();
  $: action = friendAction[state];

  /*
   * TYPED HERE, NOT CAST IN THE TEMPLATE.
   *
   * `dispatch('act', next)` is a TypeScript assertion inside
   * Svelte markup, and the template is not TypeScript — the compiler reports it
   * as "Unexpected token" at a column that points at the `as`, which is not an
   * obvious message for the mistake. Annotating the reactive declaration gives
   * the value its type where the language can express one.
   */
  let next: Friendship;
  $: next =
    state === 'none'
      ? 'outgoing'
      : state === 'outgoing'
        ? 'none'
        : state === 'friend'
          ? 'none'
          : 'incoming';
</script>

{#if action}
  <md-button
    variant={action.variant}
    {size}
    icon={action.icon ?? undefined}
    data-person={person.id}
    on:mdClick={() => dispatch('act', next)}
  >
    {$t(action.labelKey)}
  </md-button>
{/if}
