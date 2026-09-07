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
import {
  getFiles,
  getProjects,
  getTotals,
  projectSlug,
} from "@awc-ui/showcase-kit/design";
import Screen from "~/components/Screen.vue";
import ChoiceTabs from "~/components/editor/ChoiceTabs.vue";
import SelectControl from "~/components/editor/SelectControl.vue";
import StudioDialog from "~/components/editor/StudioDialog.vue";
import TextControl from "~/components/editor/TextControl.vue";
import {
  useDocument,
  useTreeRows,
  useSelectableIds,
} from "~/composables/useDocument";
import Link from "~/components/Link.vue";
import { useRouter } from "~/lib/router";
import { route } from "~/lib/routes";
import {
  TEMPLATES,
  ORB_ART,
  documentSvg,
  makeTemplate,
} from "@awc-ui/pictor-model";
import { useT } from "~/composables/useShowcase";
type Pointer = PointerEvent;

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
const filter = ref("all");
const setFilter = (
  next:
    | typeof filter.value
    | ((current: typeof filter.value) => typeof filter.value),
) => {
  filter.value = typeof next === "function" ? next(filter.value) : next;
};
const sort = ref("recent");
const setSort = (
  next: typeof sort.value | ((current: typeof sort.value) => typeof sort.value),
) => {
  sort.value = typeof next === "function" ? next(sort.value) : next;
};
const view = ref("grid");
const setView = (
  next: typeof view.value | ((current: typeof view.value) => typeof view.value),
) => {
  view.value = typeof next === "function" ? next(view.value) : next;
};
const template = ref<string | null>(null);
const setTemplate = (
  next:
    | typeof template.value
    | ((current: typeof template.value) => typeof template.value),
) => {
  template.value = typeof next === "function" ? next(template.value) : next;
};
const favorites = ref<string[]>(
  (() => {
    try {
      const value = JSON.parse(
        localStorage.getItem("pictor:favorites") || "[]",
      );
      return Array.isArray(value)
        ? value.filter((item) => typeof item === "string")
        : [];
    } catch {
      return [];
    }
  })(),
);
const setFavorites = (
  next:
    | typeof favorites.value
    | ((current: typeof favorites.value) => typeof favorites.value),
) => {
  favorites.value = typeof next === "function" ? next(favorites.value) : next;
};
const totals = computed(() => getTotals());
const projects = computed(() => getProjects());
const files = computed(() =>
  getFiles()
    .filter(
      (file) =>
        (!query.value ||
          `${file.name} ${projects.value.find((project) => project.id === file.projectId)?.name ?? ""}`
            .toLowerCase()
            .includes(query.value.toLowerCase())) &&
        (filter.value === "all" ||
          (filter.value === "favorites" && favorites.value.includes(file.id)) ||
          (filter.value === "shared" && file.editorHandles.length > 1)),
    )
    .slice()
    .sort((a, b) =>
      sort.value === "name"
        ? a.name.localeCompare(b.name)
        : sort.value === "layers"
          ? doc.layersForFile(b.id).length - doc.layersForFile(a.id).length
          : b.updatedAt.localeCompare(a.updatedAt),
    ),
);
const toggleFavorite = (id: string) =>
  setFavorites((current) => {
    const next = current.includes(id)
      ? current.filter((x) => x !== id)
      : [...current, id];
    try {
      localStorage.setItem("pictor:favorites", JSON.stringify(next));
    } catch {}
    return next;
  });
const selectedTemplate = computed(() =>
  template.value ? makeTemplate(template.value) : null,
);

const { document } = globalThis;
</script>
<template>
  <Screen
    :title="t('Your creative workspace')"
    :subtitle="t('A little structure. Infinite possibility.')"
  >
    <section class="pictor-hero" :aria-label="t('Welcome to Pictor')">
      <div class="pictor-hero__copy">
        <span class="pictor-eyebrow"
          ><span class="pictor-live-dot"></span>
          {{ t("MADE FOR YOUR NEXT BIG IDEA") }}</span
        >
        <h2>
          {{ t("Big ideas.") }}<br /><em>{{ t("Beautifully made.") }}</em>
        </h2>
        <p>
          {{
            t(
              "From the first spark to the final pixel. Draw, compose, refine and export in one beautifully connected studio.",
            )
          }}
        </p>
        <div class="pictor-hero__actions">
          <md-button
            variant="filled"
            icon="draw"
            @click="() => router.push(route.editor())"
            >{{ t("Enter the studio") }}</md-button
          ><md-button
            variant="text"
            icon="auto_awesome"
            @click="
              () =>
                document
                  .getElementById('pictor-templates')
                  ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            "
            >{{ t("Start with a spark") }}</md-button
          >
        </div>
        <div class="pictor-hero__facts">
          <span
            ><strong>{{ totals.projects }}</strong>
            {{ t("creative spaces") }}</span
          ><span
            ><strong>{{ totals.assets }}</strong>
            {{ t("reusable assets") }}</span
          ><span
            ><strong>{{ t("Yours.") }}</strong>
            {{ t("Saved on this device") }}</span
          >
        </div>
      </div>
      <div class="pictor-hero__art" aria-hidden="true">
        <div class="pictor-art-orbit"></div>
        <img :src="ORB_ART.src" alt="" /><span
          class="pictor-art-label pictor-art-label--top"
          ><span class="material-symbols-outlined" aria-hidden="true"
            >deployed_code</span
          >
          {{ t("Shape the unexpected") }}</span
        ><span class="pictor-art-label pictor-art-label--bottom"
          ><span class="pictor-live-dot"></span>
          {{ t("Boundless by design") }}</span
        >
      </div>
    </section>
    <section id="pictor-templates" class="pictor-section">
      <div class="pictor-section__head">
        <div>
          <span class="pictor-eyebrow">{{ t("SKIP THE BLANK CANVAS") }}</span>
          <h2>{{ t("A starting point. A world of possibilities.") }}</h2>
        </div>
        <span class="pictor-muted">{{
          t("Every layer is yours to change")
        }}</span>
      </div>
      <div class="pictor-template-grid">
        <template v-for="item in TEMPLATES" :key="item.id"
          ><button
            class="pictor-template"
            :data-template="item.id"
            @click="() => setTemplate(item.id)"
          >
            <div class="pictor-template__art" :data-tone="item.tone">
              <img :src="item.art.src" alt="" /><span>{{
                t(item.tagline)
              }}</span
              ><span class="pictor-template__arrow"
                ><span class="material-symbols-outlined" aria-hidden="true"
                  >arrow_outward</span
                ></span
              >
            </div>
            <div class="pictor-template__meta">
              <strong>{{ t(item.name) }}</strong
              ><span>{{ t(item.category) }} · 960 × 640</span>
            </div>
          </button></template
        >
      </div>
    </section>
    <section class="pictor-section">
      <div class="pictor-section__head">
        <div>
          <span class="pictor-eyebrow">{{ t("ROOM TO CREATE") }}</span>
          <h2>{{ t("Your projects") }}</h2>
        </div>
        <span class="pictor-muted"
          >{{ projects.length }} {{ t("spaces, one creative flow") }}</span
        >
      </div>
      <div class="pictor-project-grid">
        <template v-for="(project, index) in projects" :key="project.id"
          ><Link
            :href="route.project(projectSlug(project))"
            class="pictor-project-card"
            ><div
              class="pictor-project-mark"
              :data-tone="TEMPLATES[index % 3].tone"
            >
              <span class="material-symbols-outlined" aria-hidden="true">{{
                [
                  "shapes",
                  "photo_camera",
                  "auto_awesome",
                  "view_quilt",
                  "palette",
                  "architecture",
                ][index % 6]
              }}</span>
            </div>
            <div>
              <strong>{{ project.name }}</strong
              ><span>{{ project.fileIds.length }} {{ t("design files") }}</span>
            </div>
            <span class="material-symbols-outlined" aria-hidden="true"
              >arrow_forward</span
            ></Link
          ></template
        >
      </div>
    </section>
    <section class="pictor-section">
      <div class="pictor-section__head">
        <h2>{{ t("Pick up where inspiration left you") }}</h2>
        <ChoiceTabs
          :label="t('File layout')"
          :value="view"
          :onValue="setView"
          :options="[
            { value: 'grid', label: t('Grid'), icon: 'grid_view' },
            { value: 'list', label: t('List'), icon: 'view_list' },
          ]"
        ></ChoiceTabs>
      </div>
      <div class="pictor-filterbar">
        <md-button-group
          variant="connected"
          selection-mode="single-select"
          required
          :aria-label="t('Filter design files')"
          v-awc="{
            props: { selectionMode: 'single-select', required: true },
            on: {
              mdSelectionChange: (event: CustomEvent<{ values: string[] }>) => {
                if (event.detail.values[0]) setFilter(event.detail.values[0]);
              },
            },
          }"
        >
          <md-button
            value="all"
            variant="tonal"
            v-awc="{ props: { selected: filter === 'all' }, on: {} }"
            >{{ t("All files") }}</md-button
          >
          <md-button
            value="favorites"
            icon="star"
            variant="tonal"
            v-awc="{ props: { selected: filter === 'favorites' }, on: {} }"
            >{{ t("Starred") }}</md-button
          >
          <md-button
            value="shared"
            icon="group"
            variant="tonal"
            v-awc="{ props: { selected: filter === 'shared' }, on: {} }"
            >{{ t("Shared") }}</md-button
          > </md-button-group
        ><TextControl
          :live="true"
          :label="t('Search files')"
          :placeholder="t('Find your next idea…')"
          :value="query"
          :onValue="setQuery"
        ></TextControl
        ><SelectControl
          :label="t('Sort by')"
          :value="sort"
          :onValue="setSort"
          :options="[
            { value: 'recent', label: t('Recently edited') },
            { value: 'name', label: t('Name') },
            { value: 'layers', label: t('Most layers') },
          ]"
        ></SelectControl>
      </div>
      <template v-if="files.length"
        ><div class="pictor-file-grid" :data-view="view">
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
                    >{{
                      projects.find((project) => project.id === file.projectId)
                        ?.name
                    }}
                    · {{ doc.layersForFile(file.id).length }}
                    {{ t("layers") }}</span
                  ></Link
                ><md-icon-button
                  :aria-label="`${favorites.includes(file.id) ? t('Unstar') : t('Star')} ${file.name}`"
                  @click="() => toggleFavorite(file.id)"
                  v-awc="{
                    props: {
                      icon: favorites.includes(file.id)
                        ? 'star'
                        : 'star_outline',
                    },
                    on: {},
                  }"
                ></md-icon-button>
              </div>
              <div class="pictor-file-footer">
                <md-chip
                  v-awc="{ props: { label: t(file.stateKey) }, on: {} }"
                ></md-chip
                ><span
                  ><span class="material-symbols-outlined" aria-hidden="true"
                    >group</span
                  >
                  {{ file.editorHandles.length }}</span
                >
              </div></md-card
            ></template
          >
        </div></template
      ><template v-else
        ><div class="pictor-empty">
          <span class="material-symbols-outlined" aria-hidden="true"
            >search_off</span
          >
          <h3>{{ t("No files in this view") }}</h3>
          <p>
            {{ t("Try another search or star a design to collect it here.") }}
          </p>
          <md-button
            variant="text"
            @click="
              () => {
                setQuery('');
                setFilter('all');
              }
            "
            >{{ t("Show all files") }}</md-button
          >
        </div></template
      >
    </section>
    <StudioDialog
      :open="!!template"
      :onClose="() => setTemplate(null)"
      :title="
        selectedTemplate ? t(selectedTemplate.name) : t('Choose a template')
      "
    >
      <template v-if="selectedTemplate"
        ><img
          class="pictor-template-preview"
          :src="`data:image/svg+xml,${encodeURIComponent(documentSvg(selectedTemplate.layers))}`"
          :alt="t('{name} editable design', { name: t(selectedTemplate.name) })"
        />
        <p>
          {{ t("This replaces your current canvas with") }}
          {{ selectedTemplate.layers.length }}
          {{
            t(
              "editable layers. You can undo the replacement from the studio history.",
            )
          }}
        </p></template
      ><template v-else></template>
      <template #actions
        ><md-button variant="text" @click="() => setTemplate(null)">{{
          t("Keep exploring")
        }}</md-button
        ><md-button
          variant="filled"
          icon="auto_awesome"
          @click="
            () => {
              if (selectedTemplate) {
                doc.replaceCanvas(selectedTemplate.layers);
                setTemplate(null);
                router.push(route.editor());
              }
            }
          "
          >{{ t("Make it yours") }}</md-button
        ></template
      ></StudioDialog
    >
    <template #aside
      ><md-button
        variant="tonal"
        icon="arrow_outward"
        @click="() => router.push(route.editor())"
        >{{ t("Resume designing") }}</md-button
      ></template
    ></Screen
  >
</template>
