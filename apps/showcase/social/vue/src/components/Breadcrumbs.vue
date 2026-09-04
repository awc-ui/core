<!--
  The trail, with `mdSelect` intercepted for client-side routing.

  `mdSelect` is cancelable and bubbles from the item to the strip, so one
  listener on the strip is enough, and `preventDefault()` stops the anchor from
  doing a full page load. The crumbs still carry real, fully-prefixed hrefs,
  because a real href is what makes ⌘-click, middle-click and "copy link
  address" behave. `originalEvent` is the MouseEvent or KeyboardEvent that
  produced the selection, so one modifier check covers the Enter path too.

  `mdSelect` is a camelCase custom event, so it goes through `v-awc` —
  `@mdSelect` would compile to a listener for `md-select`, which the library
  never emits.
-->
<script setup lang="ts">
import type { CrumbSpec } from '@awc-ui/showcase-kit/social';
import { useT } from '~/composables/useShowcase';
import { isPlainActivation, useRouter } from '~/lib/router';
import { withBase } from '~/lib/routes';

const props = defineProps<{ crumbs: CrumbSpec[] }>();

const t = useT();
const router = useRouter();

const trailListeners = {
  mdSelect(event: Event) {
    const detail = (
      event as CustomEvent<{ href?: string; originalEvent?: MouseEvent | KeyboardEvent }>
    ).detail;
    const { href, originalEvent } = detail ?? {};
    if (!href) return;
    if (!isPlainActivation(originalEvent as MouseEvent | undefined)) return;
    event.preventDefault();
    router.push(href.replace(withBase(''), '') || '/');
  },
};

/**
 * The last crumb is the page you are already on, so it is never a link —
 * md-breadcrumbs promotes it to `current` and gives it `aria-current="page"`
 * itself. `crumbsFor` already returns a null href for every deep trail's tail;
 * the overview's single crumb is the one case that would otherwise link to
 * itself.
 */
const hrefFor = (crumb: CrumbSpec, index: number) =>
  crumb.href && index < props.crumbs.length - 1 ? withBase(crumb.href) : undefined;
</script>

<template>
  <md-breadcrumbs
    v-awc="{ on: trailListeners }"
    :label="t('social.nav.breadcrumb')"
    max-items="4"
    items-before-collapse="1"
    items-after-collapse="2"
  >
    <md-breadcrumb-item
      v-for="(crumb, index) in crumbs"
      :key="`${crumb.labelKey ?? crumb.label}-${index}`"
      :href="hrefFor(crumb, index)"
    >
      <!-- A crumb is either a translated label or a proper noun. The kit
           returns exactly one of the two and never a pre-translated string. -->
      {{ crumb.labelKey ? t(crumb.labelKey) : crumb.label }}
    </md-breadcrumb-item>
  </md-breadcrumbs>
</template>
