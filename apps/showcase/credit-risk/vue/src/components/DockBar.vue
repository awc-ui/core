<!--
  `<awc-showcase-dock>` — the same bar on every screen.

  `base-path` is the prefix BEFORE the framework segment, not this app's own
  `BASE_PATH` — the dock swaps `vue` for `svelte` inside the path it finds, and
  only falls back to `base-path` when the current segment is not in the URL.

  Registration is the bare `@awc-ui/showcase-kit/dock` import in `src/main.ts`;
  this is only the tag.
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
