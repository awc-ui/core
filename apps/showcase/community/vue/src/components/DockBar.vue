<!--
  `<awc-showcase-dock>` — the same bar on every screen.

  Registration is the bare `@awc-ui/showcase-kit/dock` import in `src/main.ts`;
  this is only the tag. Nothing here listens for `awc-showcase-change`;
  `composables/useShowcase.ts` owns the single subscription.

  `frameworks` is the kit's list for THIS vertical — five ids, not the
  credit-risk console's ten, and all five are built. The switcher renders the
  roster because it belongs to the route table, not to whichever ports happen
  to exist this week.

  `base-path` is the prefix BEFORE the framework segment, not this build's own
  `BASE_PATH` — the dock swaps `vue` for `svelte` inside the path it finds, and
  only falls back to `base-path` when the current segment is not in the URL.

  `label` IS REQUIRED HERE, even though it looks optional. The dock falls back
  to `t('app.title')` for its own heading, and that key belongs to the first
  vertical — so an unlabelled dock in this app announces itself as "Credit Risk
  Console" under a Vela app. It is a shared component with one fallback
  and two consumers; naming it is the consumer's job.
-->
<script setup lang="ts">
import { useT } from '~/composables/useShowcase';
import { FRAMEWORK, FRAMEWORKS, SHOWCASE_BASE } from '~/lib/routes';

const t = useT();
</script>

<template>
  <awc-showcase-dock
    :frameworks="FRAMEWORKS.join(',')"
    :framework="FRAMEWORK"
    :base-path="SHOWCASE_BASE"
    position="bottom"
    :label="t('community.app.title')"
  ></awc-showcase-dock>
</template>
