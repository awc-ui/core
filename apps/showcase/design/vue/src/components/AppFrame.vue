<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount } from "vue";
import { DESTINATIONS, getViewer } from "@awc-ui/showcase-kit/design";
import { COMPACT_NAV } from "@awc-ui/pictor-model";
import { useT } from "~/composables/useShowcase";
import { useDocument } from "~/composables/useDocument";
import { useRouter, isPlainActivation } from "~/lib/router";
import {
  destinationIndex,
  withBase,
  FRAMEWORK,
  FRAMEWORKS,
  SHOWCASE_BASE,
} from "~/lib/routes";
import WorkbenchCommands from "./WorkbenchCommands.vue";
import ComponentLens from "./ComponentLens.vue";
const t = useT(),
  doc = useDocument(),
  router = useRouter(),
  viewer = getViewer(),
  expanded = ref(false),
  compact = ref(false),
  activeIndex = computed(() => destinationIndex(router.pathname));
let media: MediaQueryList | undefined;
const update = () => (compact.value = !!media?.matches);
onMounted(() => {
  media = matchMedia(COMPACT_NAV);
  update();
  media.addEventListener("change", update);
});
onBeforeUnmount(() => media?.removeEventListener("change", update));
const emit = (name: string) => window.dispatchEvent(new CustomEvent(name));
const navigate = (event: MouseEvent, bar = false) => {
  if (!bar && !isPlainActivation(event)) return;
  const tab = event
    .composedPath()
    .find(
      (node) =>
        node instanceof HTMLElement &&
        node.tagName === (bar ? "MD-NAVIGATION-TAB" : "MD-NAVIGATION-RAIL-TAB"),
    ) as HTMLElement | undefined;
  const value = bar
    ? tab?.getAttribute("data-value")
    : ((tab as (HTMLElement & { value?: string }) | undefined)?.value ??
      tab?.getAttribute("value"));
  const destination = DESTINATIONS.find((item) => item.value === value);
  if (!destination) return;
  event.preventDefault();
  router.push(destination.path);
};
</script>
<template>
  <div class="shell">
    <md-app-bar
      class="shell__appbar"
      variant="small"
      v-awc="{
        props: {
          subtitle: t('design.app.title'),
          leadingIcon: compact ? undefined : 'menu',
          leadingIconLabel: compact ? undefined : t('design.nav.menu'),
        },
        on: { mdLeadingClick: () => (expanded = !expanded) },
      }"
      ><span slot="headline" class="shell__brand">{{
        t("design.app.brand")
      }}</span>
      <div slot="trailing" class="pictor-studio-actions">
        <span
          class="pictor-save-state"
          :data-state="doc.saveStatus"
          :title="
            doc.lastSavedAt
              ? new Date(doc.lastSavedAt).toLocaleString(t.locale)
              : t('Autosaves in this browser')
          "
          ><span class="pictor-save-dot" aria-hidden="true" />{{
            doc.saveStatus === "saved"
              ? t("Saved locally")
              : doc.saveStatus === "unavailable"
                ? t("Storage unavailable")
                : t("Saving…")
          }}</span
        ><button
          class="pictor-command-trigger"
          type="button"
          @click="emit('pictor:commands')"
          :aria-label="t('Open command palette')"
        >
          <span>{{ t("Quick actions") }}</span
          ><kbd>⌘ K</kbd></button
        ><md-button
          variant="text"
          icon="widgets"
          @click="emit('pictor:components')"
          >{{ t("Components") }}</md-button
        >
      </div>
      <md-avatar
        slot="trailing"
        :src="viewer.art.src"
        :name="viewer.displayName"
        :label="t('design.app.viewer', { name: viewer.displayName })"
        size="small"
    /></md-app-bar>
    <div class="shell__body">
      <md-navigation-rail
        class="shell__rail"
        :aria-label="t('design.nav.label')"
        :variant="expanded ? 'expanded' : 'standard'"
        v-awc="{ props: { activeIndex } }"
        label-visibility="all"
        @click="navigate($event)"
        ><md-navigation-rail-tab
          v-for="destination in DESTINATIONS"
          :key="destination.value"
          :value="destination.value"
          :icon="destination.icon"
          :active-icon="destination.activeIcon"
          :label="t(destination.labelKey)"
          :href="withBase(destination.path)"
      /></md-navigation-rail>
      <main class="shell__main"><slot /></main>
    </div>
    <md-navigation-bar
      class="shell__bar"
      :aria-label="t('design.nav.label')"
      v-awc="{ props: { activeIndex } }"
      label-behavior="always"
      @click.capture="navigate($event, true)"
      ><md-navigation-tab
        v-for="destination in DESTINATIONS"
        :key="destination.value"
        :data-value="destination.value"
        :icon="destination.icon"
        :active-icon="destination.activeIcon"
        :label="t(destination.labelKey)"
        :href="withBase(destination.path)"
    /></md-navigation-bar>
  </div>
  <awc-showcase-dock
    collapsed=""
    :frameworks="FRAMEWORKS.join(',')"
    :framework="FRAMEWORK"
    :base-path="SHOWCASE_BASE"
    position="bottom"
    :label="t('design.app.title')"
  /><WorkbenchCommands /><ComponentLens />
</template>
