<script lang="ts">
  import type { Person } from '@awc-ui/showcase-kit/community';
  import { t } from '$lib/showcase';
  export let person: Person;
  export let size: 'small' | 'medium' | 'large' = 'small';
</script>

<md-avatar
  src={person.avatar}
  name={person.displayName}
  initials={person.initials}
  {size}
  label={person.displayName}
  alt={$t('community.alt.arcs')}
></md-avatar>
