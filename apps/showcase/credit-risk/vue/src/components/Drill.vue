<!--
  A drill link into the next screen down.

  It carries a REAL, fully-prefixed `href`, which is the entire reason this is an
  `<a>` and not a button: ⌘-click opens a tab, middle-click opens a tab, "copy
  link address" copies something that resolves, and the deep link works on a cold
  load because the build fans `index.html` out across every route. The click
  handler only vetoes the plain left-click.

  This is what `<NuxtLink :to>` was in the twin, and the element it emits is the
  one Nuxt emitted — `<a class="drill" href="…">` — so the parity check sees no
  difference. `class` is declared before `:href` so the attribute order matches
  as well.
-->
<script setup lang="ts">
import { useRouter } from '~/lib/router';
import { withBase } from '~/lib/routes';

const props = defineProps<{
  /** Root-relative path WITHOUT the base path — `withBase` prefixes it. */
  to: string;
}>();

const router = useRouter();

function onClick(event: MouseEvent) {
  // Anything but a plain primary click is the browser's to handle: modifier
  // clicks open tabs and windows, and a link that looks like a link and then
  // refuses to behave like one is worse than no link.
  if (event.button !== 0) return;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  router.push(props.to);
}
</script>

<template>
  <a class="drill" :href="withBase(to)" @click="onClick"><slot /></a>
</template>
