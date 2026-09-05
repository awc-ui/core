<script lang="ts">
  import type { Person } from '@awc-ui/showcase-kit/community';
  import Avatar from '$lib/bits/Avatar.svelte';
  import PersonLink from '$lib/bits/PersonLink.svelte';
  import { t } from '$lib/showcase';
  export let person: Person;
</script>

<div class="person-row" data-person={person.id}>
  <PersonLink {person} linkClass="">
    <Avatar {person} size="medium" />
  </PersonLink>
  <span class="person-row__text">
    <PersonLink {person} />
    <span class="person-row__meta"
      >{person.mutualCount === 1
        ? $t('community.count.mutualOne')
        : $t('community.count.mutual', { count: $t.formatNumber(person.mutualCount) })}</span
    >
    <slot />
  </span>
</div>
