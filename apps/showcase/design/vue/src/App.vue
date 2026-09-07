<script setup lang="ts">
import { computed } from "vue";
import { usePathname } from "~/lib/router";
import { route } from "~/lib/routes";
import AppFrame from "~/components/AppFrame.vue";
import ProjectsScreen from "~/components/screens/ProjectsScreen.vue";
import ProjectScreen from "~/components/screens/ProjectScreen.vue";
import EditorScreen from "~/components/screens/EditorScreen.vue";
import AssetsScreen from "~/components/screens/AssetsScreen.vue";
import AssetScreen from "~/components/screens/AssetScreen.vue";
import ProfileScreen from "~/components/screens/ProfileScreen.vue";
import NotFoundScreen from "~/components/screens/NotFoundScreen.vue";
const pathname = usePathname();
const resolved = computed(() => {
  const path = pathname.value;
  if (path === route.projects()) return { view: ProjectsScreen, props: {} };
  if (path === route.editor()) return { view: EditorScreen, props: {} };
  if (path === route.assets()) return { view: AssetsScreen, props: {} };
  if (path === route.profile()) return { view: ProfileScreen, props: {} };
  try {
    let match = /^\/p\/([^/]+)\/$/.exec(path);
    if (match)
      return {
        view: ProjectScreen,
        props: { slug: decodeURIComponent(match[1]) },
      };
    match = /^\/f\/([^/]+)\/$/.exec(path);
    if (match)
      return {
        view: EditorScreen,
        props: { fileId: decodeURIComponent(match[1]) },
      };
    match = /^\/a\/([^/]+)\/$/.exec(path);
    if (match)
      return {
        view: AssetScreen,
        props: { assetId: decodeURIComponent(match[1]) },
      };
  } catch {}
  return { view: NotFoundScreen, props: {} };
});
</script>
<template>
  <AppFrame
    ><component :is="resolved.view" v-bind="resolved.props" :key="pathname"
  /></AppFrame>
</template>
