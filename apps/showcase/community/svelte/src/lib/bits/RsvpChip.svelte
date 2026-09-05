<script lang="ts">
  import { rsvpIcon, rsvpTone, type Rsvp } from '@awc-ui/showcase-kit/community';
  import StateChip from './StateChip.svelte';
  export let rsvp: Rsvp;
</script>

{#if rsvpTone[rsvp]}
  <StateChip
    labelKey={`community.rsvp.${rsvp}`}
    color={rsvpTone[rsvp] ?? undefined}
    icon={rsvpIcon[rsvp]}
  />
{/if}
