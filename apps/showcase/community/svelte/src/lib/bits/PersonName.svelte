<!-- WITH NO ANCHOR: two callers are already links, and an anchor inside an
     anchor is invalid HTML the DOM API builds without complaint. -->
<script lang="ts">
  import type { Person } from '@awc-ui/showcase-kit/community';
  import Verified from './Verified.svelte';
  export let person: Person;
</script>

<span class="person-row__name">{person.displayName}</span><Verified {person} />
