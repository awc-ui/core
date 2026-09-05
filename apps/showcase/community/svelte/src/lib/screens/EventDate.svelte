<!-- Month over day, fixed width, so every row's dates line up down the column.
     A date inside a paragraph cannot be SCANNED. -->
<script lang="ts">
  import { t } from '$lib/showcase';
  export let at: string;
  $: d = new Date(at);
  $: month = new Intl.DateTimeFormat($t.locale, { month: 'short', timeZone: 'UTC' }).format(d);
  $: day = new Intl.DateTimeFormat($t.locale, { day: 'numeric', timeZone: 'UTC' }).format(d);
</script>

<time class="event-date" datetime={at}>
  <span class="event-date__month">{month}</span>
  <span class="event-date__day">{day}</span>
</time>
