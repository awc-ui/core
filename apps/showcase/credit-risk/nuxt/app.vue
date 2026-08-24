<!--
  The app root.

  Only the document metadata lives here, and it is English on every request.
  That is not a limit of the server render: the dock keeps the locale in a query
  parameter and in localStorage, both of which only client JavaScript reads, so
  the server has no authoritative language for a request to honour. The preboot
  script swaps `lang`/`dir` on <html> and every visible string re-renders
  through the translator — the document metadata cannot follow.
-->
<script setup lang="ts">
import { en } from '@awc-ui/showcase-kit/i18n';

useHead({
  title: `${en['app.brand']} — ${en['app.title']}`,
  meta: [{ name: 'description', content: en['app.subtitle'] }],
});
</script>

<template>
  <NuxtPage />
</template>
