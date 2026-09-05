<!-- THE VIEWER'S OWN NAME LINKS TO `/profile/`, not to `/people/<handle>/`.
     Both resolve, and the second would be a second URL for the same page. -->
<script lang="ts">
  import type { Person } from '@awc-ui/showcase-kit/community';
  import Drill from '$lib/components/Drill.svelte';
  import { route } from '$lib/routes';
  export let person: Person;
  export let linkClass = 'person-row__name';
  $: target = person.friendship === 'self' ? route.profile() : route.person(person.handle);
</script>

<Drill href={target} {linkClass}><slot>{person.displayName}</slot></Drill>
