<!--
  The app root.

  Only the document metadata lives here. The export is a static file: it has one
  `<title>` and one `lang`, and both are English. The client swaps `lang`/`dir`
  on <html> through the preboot script and the dock, and every visible string
  re-renders through the translator — but the document metadata cannot follow,
  so it stays in the default locale.
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
