<!--
  How long ago, in words, inside a `<time>` that still carries the instant.

  THE MACHINE-READABLE VALUE SURVIVES. "3h ago" is unambiguous to a reader and
  useless to anything parsing the page, so the ISO instant stays in `datetime`,
  and the `title` carries the full formatted date.

  Measured against `REPORTING_INSTANT`, never `Date.now()`. Every screenshot,
  every parity comparison and every test would otherwise disagree with itself a
  minute later.
-->
<script lang="ts">
  import { REPORTING_INSTANT } from '@awc-ui/showcase-kit/social';
  import { t } from '$lib/showcase';

  export let at: string;
  export let style: 'narrow' | 'short' | 'long' = 'narrow';

  $: text = $t.formatRelativeTime(at, REPORTING_INSTANT, { style });
  $: exact = $t.formatDate(at.slice(0, 10), 'long');
</script>

<time datetime={at} title={exact} class="when">{text}</time>
