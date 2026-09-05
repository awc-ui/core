<!-- `none` earns no chip — the join button already says they are not in it. -->
<script lang="ts">
  import { roleIcon, roleTone, type GroupRole } from '@awc-ui/showcase-kit/community';
  import StateChip from './StateChip.svelte';
  export let role: GroupRole;
</script>

{#if roleTone[role]}
  <StateChip
    labelKey={`community.role.${role}`}
    color={roleTone[role] ?? undefined}
    icon={roleIcon[role] ?? undefined}
  />
{/if}
