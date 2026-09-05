<script lang="ts">
  import { t } from '$lib/showcase';
  export let at: string;
  $: text = new Intl.DateTimeFormat($t.locale, {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  }).format(new Date(at));
</script>

<time datetime={at}>{text}</time>
