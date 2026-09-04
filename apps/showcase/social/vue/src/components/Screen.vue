<!--
  What every screen renders itself inside: trail row, heading, optional toolbar,
  then the stage where the body and its placeholder trade places.

  Only the body is ever a placeholder — the frame above never is.

  THE LAYOUT IS ALWAYS THE REAL CONTENT'S. THE PLACEHOLDER IS PAINTED OVER IT.

  Two problems had to die here, and the React source's Shell.tsx records the
  post-mortem in full:

  FIRST: `md-*` components hydrate from lazily-loaded chunks, so a subtree
  mounted at the moment a placeholder is removed is revealed still un-upgraded
  and contributing no size. That is why the children go into the tree from the
  FIRST render and their chunks load during the placeholder's window.

  SECOND: a placeholder that occupies the layout has to be the same height as
  what replaces it, and it cannot be — the real heights are functions of
  viewport width, density and fixture counts. So the placeholder stops
  occupying layout at all: the real content keeps its box the whole time and is
  merely `visibility: hidden` (via the kit's `[data-placeholder]` rule); the
  placeholder is absolutely positioned over it in `.screen-stage__placeholder`.
  Revealing is then a visibility flip with no reflow — exactly 0px of movement
  at every width, by construction rather than by arithmetic.

  `visibility` and not `display`, deliberately: `display: none` would take the
  box away and put the problem straight back, and it also takes the content out
  of the accessibility tree — which is what we want here, since the placeholder
  is the thing announcing.

  Rendered ONCE, never as a second copy: element ids in this app are literals
  (`md-menu` resolves `anchor` with `getElementById`), so two mounted copies
  would give two of each trigger and the menus would anchor to whichever came
  first.

  The trail row is ALWAYS rendered, even when empty. A row that comes and goes
  moves the heading and every panel under it on each navigation, which is what
  "jumpy" means; its height is reserved in `.shell__trail`. Five of the seven
  screens leave it empty — they are destinations, and a trail naming only
  themselves would repeat the heading directly beneath it.
-->
<script setup lang="ts">
import { computed } from 'vue';
import { usePathname } from '~/lib/router';
import { crumbsFor } from '~/lib/routes';
import { useT } from '~/composables/useShowcase';
import { useScreenReady } from '~/composables/useScreenReady';
import Breadcrumbs from './Breadcrumbs.vue';
import ScreenSkeleton from './skeletons/ScreenSkeleton.vue';

const props = defineProps<{
  title: string;
  subtitle?: string;
  /**
   * The proper noun for the last crumb, where the trail has one.
   *
   * Only the person drill needs it: a post's own crumb is a translated label,
   * because a post has no name. The PATH decides the shape of the trail; this
   * supplies the one part the kit cannot know.
   */
  crumbLabel?: string;
}>();

/**
 * Slots, beyond the default body:
 *  - `aside`    chips, dots or counts that belong beside the heading.
 *  - `actions`  screen-level actions, rendered inside the ONE `md-toolbar`.
 *  - `skeleton` the placeholder shown while the screen settles. Omit it and
 *    the screen gets `<ScreenSkeleton>`; pass one when the opening is
 *    materially different, so the swap does not move the page.
 */

const t = useT();
const ready = useScreenReady();
const pathname = usePathname();

/*
 * DERIVED FROM THE PATH, not passed in by the screen — except for the proper
 * noun, which only the screen knows. A screen that declared its own parent
 * could disagree with the kit's route table, and the two drill screens are
 * exactly where that would go unnoticed. `crumbsFor` returns an empty array on
 * the five destinations, which is also how a top-level screen gets an empty row
 * without saying anything.
 */
const crumbs = computed(() => crumbsFor(pathname.value, props.crumbLabel ?? null));
</script>

<template>
  <div class="shell__trail">
    <Breadcrumbs v-if="crumbs.length > 0" :crumbs="crumbs" />
  </div>

  <div class="screen-head">
    <div class="screen-head__text">
      <h1>{{ title }}</h1>
      <p v-if="subtitle">{{ subtitle }}</p>
    </div>
    <div v-if="$slots.aside" class="screen-head__aside"><slot name="aside" /></div>
  </div>

  <div v-if="$slots.actions" class="screen-toolbar">
    <!-- `floating`, not `docked`: a docked toolbar is `position: sticky`
         against the BOTTOM edge, where the navigation bar and the dock already
         are. A floating one is an inline pill.

         `vibrant` puts the pill on primary-container and applies the MD3
         expressive toolbar-only token map to the icon buttons inside it —
         scoped to slotted children, so it does not touch icon buttons
         elsewhere. This is the app's ONLY `md-toolbar`; every screen's actions
         pass through here, so one attribute is every toolbar. -->
    <md-toolbar variant="floating" color="vibrant" :aria-label="t('social.nav.toolbar')">
      <slot name="actions" />
    </md-toolbar>
  </div>

  <div class="screen-stage">
    <div class="screen-body" :data-placeholder="ready ? undefined : ''">
      <slot />
    </div>
    <div v-if="!ready" class="screen-stage__placeholder">
      <slot name="skeleton">
        <ScreenSkeleton :label="title" />
      </slot>
    </div>
  </div>
</template>
