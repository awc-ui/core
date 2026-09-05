<!-- Measured against `REPORTING_INSTANT`, never the clock — every screenshot
     and every parity comparison would otherwise disagree a minute later. -->
<script lang="ts">
  import { REPORTING_INSTANT } from '@awc-ui/showcase-kit/community';
  import { t } from '$lib/showcase';
  export let at: string;
</script>

<time datetime={at} title={$t.formatDate(at.slice(0, 10), 'long')} class="when"
  >{$t.formatRelativeTime(at, REPORTING_INSTANT, { style: 'narrow' })}</time
>
