<!--
  `<awc-showcase-dock>` — the same bar on every screen.

  `base-path` is the prefix BEFORE the framework segment, not this app's Nuxt
  `baseURL` — the dock swaps `nuxt` for `svelte` inside the path it finds, and
  only falls back to `base-path` when the current segment is not in the URL.

  Registration happens in `plugins/dock.client.ts`; this is only the tag.
-->
<script setup lang="ts">
import { FRAMEWORK, FRAMEWORKS, SHOWCASE_BASE } from '~/lib/routes';
</script>

<template>
  <awc-showcase-dock
    :frameworks="FRAMEWORKS.join(',')"
    :framework="FRAMEWORK"
    :base-path="SHOWCASE_BASE"
    position="bottom"
  ></awc-showcase-dock>
</template>
