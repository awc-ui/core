<!-- The leading glyph on an activity row, in the kind's own tone. -->
<script lang="ts">
  import { activityIcon, activityTone, type ActivityKind } from '@awc-ui/showcase-kit/social';

  export let kind: ActivityKind;
</script>

<span class="activity-icon" data-tone={activityTone[kind]} aria-hidden="true">
  <span class="material-symbols-outlined">{activityIcon[kind]}</span>
</span>
