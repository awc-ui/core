<script setup lang="ts">
import {
  computed,
  ref,
  shallowRef,
  toRefs,
  toRef,
  watch,
  onMounted,
  onBeforeUnmount,
  nextTick,
} from "vue";
import { watchLifecycle } from "~/composables/lifecycle";
import { filesInProject, projectBySlug } from "@awc-ui/showcase-kit/design";
import Screen from "~/components/Screen.vue";
import TextControl from "~/components/editor/TextControl.vue";
import NotFoundScreen from "~/components/screens/NotFoundScreen.vue";
import {
  useDocument,
  useTreeRows,
  useSelectableIds,
} from "~/composables/useDocument";
import { documentSvg, ORB_ART } from "@awc-ui/pictor-model";
import Link from "~/components/Link.vue";
import { useRouter } from "~/lib/router";
import { route } from "~/lib/routes";
import { useT } from "~/composables/useShowcase";
type Pointer = PointerEvent;

const props = defineProps<{ slug: string }>();
const slug = toRef(props, "slug");
const t = useT();
const doc = useDocument();
const router = useRouter();
const query = ref("");
const setQuery = (
  next:
    typeof query.value | ((current: typeof query.value) => typeof query.value),
) => {
  query.value = typeof next === "function" ? next(query.value) : next;
};
const project = computed(() => projectBySlug(slug.value));
const projectFiles = computed(() =>
  project.value ? filesInProject(project.value.id) : [],
);
const files = computed(() =>
  projectFiles.value.filter((file) =>
    file.name.toLowerCase().includes(query.value.toLowerCase()),
  ),
);
const enterStudio = () => {
  const file =
    projectFiles.value.find((item) => item.id === doc.fileId) ??
    projectFiles.value[0];
  if (file) doc.openFile(file.id);
  router.push(route.editor());
};
</script>
<template>
  <template v-if="!project"><NotFoundScreen></NotFoundScreen></template
  ><template v-else
    ><Screen
      :title="project.name"
      :subtitle="t('A shared space for your most interesting ideas.')"
      :crumbLabel="project.name"
      ><div class="pictor-project-banner">
        <div>
          <span class="pictor-eyebrow">{{ t("A SPACE TO CREATE") }}</span>
          <h2>{{ project.name }}</h2>
          <p>{{ t(project.descriptionKey) }}</p>
          <span
            >{{ project.fileIds.length }}
            {{ t("design files · Built to be explored") }}</span
          >
        </div>
        <img :src="ORB_ART.src" alt="" />
      </div>
      <section class="pictor-section">
        <div class="pictor-section__head">
          <h2>{{ t("The work in progress") }}</h2>
          <TextControl
            :live="true"
            :label="t('Search this project')"
            :value="query"
            :onValue="setQuery"
          ></TextControl>
        </div>
        <div class="pictor-file-grid">
          <template v-for="file in files" :key="file.id"
            ><md-card class="pictor-file-card" variant="outlined"
              ><Link
                :href="route.file(file.id)"
                class="pictor-file-preview"
                :aria-label="t('Open {name}', { name: file.name })"
                ><img
                  :src="`data:image/svg+xml,${encodeURIComponent(documentSvg(doc.layersForFile(file.id), t))}`"
                  :alt="t('{name} canvas preview', { name: file.name })"
                  loading="lazy"
                /><span class="pictor-open-label"
                  ><span class="material-symbols-outlined" aria-hidden="true"
                    >open_in_new</span
                  >
                  {{ t("Open canvas") }}</span
                ></Link
              >
              <div class="pictor-file-meta">
                <Link :href="route.file(file.id)"
                  ><strong>{{ file.name }}</strong
                  ><span
                    >{{ doc.layersForFile(file.id).length }} {{ t("layers ·") }}
                    {{ file.editorHandles.length }}
                    {{ t("contributors") }}</span
                  ></Link
                ><span class="material-symbols-outlined" aria-hidden="true"
                  >arrow_outward</span
                >
              </div>
              <div class="pictor-file-footer">
                <md-chip
                  v-awc="{ props: { label: t(file.stateKey) }, on: {} }"
                ></md-chip></div></md-card
          ></template>
        </div>
        <template v-if="!files.length"
          ><div class="pictor-empty">
            <span class="material-symbols-outlined" aria-hidden="true"
              >search_off</span
            >
            <h3>{{ t("No files found") }}</h3>
            <p>{{ t("Try another search.") }}</p>
          </div></template
        ><template v-else></template>
      </section>
      <template #aside
        ><md-button variant="tonal" icon="arrow_outward" @click="enterStudio">{{
          t("Enter the studio")
        }}</md-button></template
      ></Screen
    ></template
  >
</template>
