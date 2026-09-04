<!--
  A person's name and handle, linking to their profile.

  THE VIEWER'S OWN NAME LINKS TO `/profile/`, not to `/people/<their handle>/`.
  Both would render, and the second would be a second URL for the same page —
  which is how a "you" state appears on a screen that has already decided it is
  looking at someone else.
-->
<script lang="ts">
  import type { Person } from '@awc-ui/showcase-kit/social';
  import { route } from '$lib/routes';
  import Drill from '$lib/components/Drill.svelte';
  import PersonName from './PersonName.svelte';

  export let person: Person;
  export let showHandle = false;

  $: href = person.relationship === 'self' ? route.profile() : route.person(person.handle);
</script>

<Drill {href} linkClass="person-link"><PersonName {person} {showHandle} /></Drill>
