<!--
  A person's name, tick and optional handle — WITH NO ANCHOR.

  This exists because two callers are already links themselves. A post card's
  header wraps the avatar AND the name in one target, and putting `PersonLink`
  inside it produces an `<a>` inside an `<a>`: invalid HTML that a framework
  builds happily and a screen reader reads as two overlapping links.
-->
<script lang="ts">
  import type { Person } from '@awc-ui/showcase-kit/social';
  import Verified from './Verified.svelte';

  export let person: Person;
  export let showHandle = false;
</script>

<span class="person-link__name">{person.displayName}</span>
<Verified {person} />
{#if showHandle}<span class="person-link__handle">@{person.handle}</span>{/if}
