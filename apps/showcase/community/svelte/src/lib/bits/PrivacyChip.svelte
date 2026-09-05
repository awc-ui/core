<script lang="ts">
  import { privacyIcon, privacyTone, type Group } from '@awc-ui/showcase-kit/community';
  import StateChip from './StateChip.svelte';
  export let group: Group;
</script>

<StateChip
  labelKey={group.privacyKey}
  color={privacyTone[group.privacy]}
  icon={privacyIcon[group.privacy]}
/>
