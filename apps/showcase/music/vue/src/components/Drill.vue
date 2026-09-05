<!--
  A drill link into the next screen down.

  It carries a REAL, fully-prefixed `href`, which is the entire reason this is an
  `<a>` and not a button: ⌘-click opens a tab, middle-click opens a tab, "copy
  link address" copies something that resolves, and the deep link works on a cold
  load because the build fans `index.html` out across every route. The click
  handler only vetoes the plain left-click.

  `linkClass` REPLACES the default rather than adding to it, and that is not
  cosmetic. Vue merges a caller's `class` with the one written here, so a person
  link would come out as `class="drill person-link"` and inherit the drill's
  underline and colour on top of its own. This vertical has six kinds of link —
  a person, a post's media, a grid tile, a handle — and only one of them is a
  drill. The default keeps every existing call site unchanged.

  `class` is declared before `:href` so the attribute order matches the sibling
  builds for the parity check.
-->
<script setup lang="ts">
import { isPlainActivation, useRouter } from '~/lib/router';
import { withBase } from '~/lib/routes';

const props = withDefaults(
  defineProps<{
    /** Root-relative path WITHOUT the base path — `withBase` prefixes it. */
    to: string;
    /** The anchor's class. Replaces `drill`; it does not add to it. */
    linkClass?: string;
  }>(),
  { linkClass: 'drill' },
);

const router = useRouter();

function onClick(event: MouseEvent) {
  // Anything but a plain primary click is the browser's to handle: modifier
  // clicks open tabs and windows, and a link that looks like a link and then
  // refuses to behave like one is worse than no link.
  if (!isPlainActivation(event)) return;
  event.preventDefault();
  router.push(props.to);
}
</script>

<template>
  <a :class="linkClass" :href="withBase(to)" @click="onClick"><slot /></a>
</template>
