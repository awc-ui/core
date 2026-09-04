<!--
  A count.

  COMPACT ABOVE A THOUSAND, EXACT BELOW IT, and `exact` forces the long form
  where the reader would dispute the rounding — a follower total on a profile
  header is a number people check, a like count on a feed post is not. The
  threshold and the digit rule are the kit's, not this component's.
-->
<script lang="ts">
  import { countOptions } from '@awc-ui/showcase-kit/social';
  import { t } from '$lib/showcase';

  export let value: number;
  export let exact = false;

  $: text = $t.formatNumber(value, countOptions(value, exact ? 'exact' : 'compact'));
</script>

<span class="num">{text}</span>
