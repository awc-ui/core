<!-- A SECOND PRESENTATION, NOT A NARROWER FIRST ONE. `EventRow` is a
     three-column grid sized for the 680px feed column; a rail is REFERENCE
     material, so this carries no controls at all. -->
<script lang="ts">
  import type { CommunityEvent } from '@awc-ui/showcase-kit/community';
  import Drill from '$lib/components/Drill.svelte';
  import DateText from '$lib/bits/DateText.svelte';
  import { route } from '$lib/routes';
  export let event: CommunityEvent;
</script>

<Drill linkClass="rail-row" href={route.event(event.slug)}>
  <span class="material-symbols-outlined" aria-hidden="true">event</span>
  <span class="rail-row__text">
    <span class="rail-row__name">{event.name}</span>
    <span class="rail-row__meta"><DateText at={event.startsAt} /></span>
  </span>
</Drill>
