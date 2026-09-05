<script lang="ts">
  import { t } from '$lib/showcase';
  export let at: string;
</script>
<time datetime={at}>{$t.formatDate(at.slice(0, 10), 'medium')}</time>
