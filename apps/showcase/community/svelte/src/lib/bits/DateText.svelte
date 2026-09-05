<!-- AN EVENT IS NOT "IN 3 DAYS", IT IS ON A DATE. Relative time is right for a
     post and wrong for something the reader is planning around. -->
<script lang="ts">
  import { t } from '$lib/showcase';
  export let at: string;
  export let format: 'medium' | 'long' = 'medium';
</script>

<time datetime={at}>{$t.formatDate(at.slice(0, 10), format)}</time>
