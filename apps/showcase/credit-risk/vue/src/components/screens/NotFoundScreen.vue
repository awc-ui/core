<!--
  No such screen.

  Reached only by a path that matches none of the six patterns — a typo, or a
  link into a route this vertical does not have. An unknown *id* on a route that
  does exist (`/sectors/banana/`) never gets here: those three screens look the
  id up themselves and render `MissingScreen` directly, which keeps the
  breadcrumb trail and the section nav in place.

  THE TWIN HAS NO EQUIVALENT, and that is not an omission on either side. Nuxt
  answers an unmatched path from the server, with its own error page, before any
  of these components run. Here the path is matched in the browser by
  `src/App.vue`, so the fallback has to be a screen like any other.
-->
<script setup lang="ts">
import { useT } from '~/composables/useShowcase';
import { route } from '~/lib/routes';
import MissingScreen from './MissingScreen.vue';
import Drill from '../Drill.vue';

const t = useT();
</script>

<template>
  <MissingScreen>
    <Drill :to="route.overview()">{{ t('nav.overview') }}</Drill>
  </MissingScreen>
</template>
