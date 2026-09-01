<!-- A full UTC instant from the audit trail. The date part is what is shown. -->
<script lang="ts">
  import { t } from '$lib/showcase';

  export let value: string;

  $: date = value.slice(0, 10);
</script>

<time datetime={value}>{$t.formatDate(date, 'medium')}</time>
