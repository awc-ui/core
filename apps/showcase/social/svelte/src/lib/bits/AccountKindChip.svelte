<!-- The account-type chip. `personal` earns none — see the kit's tone map. -->
<script lang="ts">
  import { accountKindTone, type Person } from '@awc-ui/showcase-kit/social';
  import StateChip from './StateChip.svelte';

  export let person: Person;
  $: tone = accountKindTone[person.kind];
</script>

{#if tone}<StateChip labelKey={person.kindKey} color={tone} />{/if}
