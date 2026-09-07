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
  editIcon,
  fileById,
  getFiles,
  getProjects,
  getTotals,
  getViewer,
  recentFiles,
  sharedFiles,
} from "@awc-ui/showcase-kit/design";
import Screen from "~/components/Screen.vue";
import ChoiceTabs from "~/components/editor/ChoiceTabs.vue";
import TextControl from "~/components/editor/TextControl.vue";
import {
  useDocument,
  useTreeRows,
  useSelectableIds,
} from "~/composables/useDocument";
import { documentSvg } from "@awc-ui/pictor-model";
import Link from "~/components/Link.vue";
import { useRouter } from "~/lib/router";
import { route } from "~/lib/routes";
import { useT } from "~/composables/useShowcase";
type Pointer = PointerEvent;

const t = useT();
const doc = useDocument();
const router = useRouter();
const viewer = computed(() => getViewer());
const totals = computed(() => getTotals());
const projects = computed(() => getProjects());
const view = ref("recent");
const setView = (
  next: typeof view.value | ((current: typeof view.value) => typeof view.value),
) => {
  view.value = typeof next === "function" ? next(view.value) : next;
};
const query = ref("");
const setQuery = (
  next:
    typeof query.value | ((current: typeof query.value) => typeof query.value),
) => {
  query.value = typeof next === "function" ? next(query.value) : next;
};
const currentFile = computed(() => fileById(doc.fileId));
const files = computed(() =>
  (view.value === "shared" ? sharedFiles() : recentFiles(12))
    .filter((file) =>
      file.name.toLowerCase().includes(query.value.toLowerCase()),
    )
    .slice(0, 8),
);
const entries = computed(() =>
  doc.history.entries.slice(0, doc.history.index).slice(-4).reverse(),
);
const preview = (fileId: string) =>
  `data:image/svg+xml,${encodeURIComponent(documentSvg(doc.layersForFile(fileId), t))}`;
const metrics = computed(() => [
  { label: t("Projects"), value: totals.value.projects, icon: "folder_open" },
  { label: t("Design files"), value: totals.value.files, icon: "draft" },
  {
    label: t("Layers"),
    value: getFiles().reduce(
      (count, file) => count + doc.layersForFile(file.id).length,
      0,
    ),
    icon: "layers",
  },
  {
    label: t("Components"),
    value: totals.value.components,
    icon: "deployed_code",
  },
  { label: t("Assets"), value: totals.value.assets, icon: "interests" },
]);

const { window, Event, setTimeout } = globalThis;
</script>
<template>
  <Screen
    :title="t('Your creative space')"
    :subtitle="t('The things you\'re making, and the possibilities ahead.')"
  >
    <div class="pictor-profile" data-profile>
      <section class="pictor-profile-identity" :aria-label="t('Your profile')">
        <div class="pictor-profile-identity__person">
          <md-avatar
            size="large"
            v-awc="{
              props: {
                src: viewer.art.src,
                name: viewer.displayName,
                label: t(viewer.art.altKey),
              },
              on: {},
            }"
          ></md-avatar>
          <div>
            <span class="pictor-profile-eyebrow">{{
              t("YOUR CORNER OF PICTOR")
            }}</span>
            <h2>{{ viewer.displayName }}</h2>
            <p>
              @{{ viewer.handle }} <span aria-hidden="true">·</span>
              {{ t("A little curiosity goes a long way.") }}
            </p>
          </div>
        </div>
        <div class="pictor-profile-identity__art" aria-hidden="true">
          <svg viewBox="0 0 210 140">
            <circle cx="67" cy="70" r="49" fill="#BEE7AA"></circle>
            <rect
              x="82"
              y="20"
              width="89"
              height="100"
              rx="44"
              fill="none"
              stroke="#C2BBF3"
              stroke-width="20"
              transform="rotate(30 125 70)"
            ></rect>
            <circle cx="174" cy="113" r="11" fill="#F2AAA7"></circle></svg
          ><span>{{ t("ROOM FOR YOUR NEXT BIG IDEA") }}</span>
        </div>
      </section>
      <section
        class="pictor-profile-metrics"
        :aria-label="t('Workspace library overview')"
      >
        <template v-for="metric in metrics" :key="metric.label"
          ><div class="pictor-profile-metric">
            <span class="material-symbols-outlined" aria-hidden="true">{{
              metric.icon
            }}</span
            ><strong>{{ t.formatNumber(metric.value) }}</strong
            ><span>{{ metric.label }}</span>
          </div></template
        >
      </section>
      <template v-if="currentFile"
        ><md-card class="pictor-profile-resume" variant="outlined"
          ><Link
            class="pictor-profile-resume__preview"
            :href="route.editor()"
            :aria-label="
              t('Continue editing {name}', { name: currentFile.name })
            "
            ><img
              :src="preview(currentFile.id)"
              :alt="t('{name} current canvas', { name: currentFile.name })"
          /></Link>
          <div class="pictor-profile-resume__copy">
            <span class="pictor-profile-eyebrow">{{
              t("RIGHT WHERE YOU LEFT OFF")
            }}</span>
            <h2>{{ currentFile.name }}</h2>
            <p>
              {{
                t(
                  "Your canvas is waiting. Pick up a detail, follow an idea, or take the whole thing somewhere new.",
                )
              }}
            </p>
            <div class="pictor-profile-resume__details">
              <span
                ><span class="material-symbols-outlined" aria-hidden="true"
                  >layers</span
                >{{ doc.layers.length }} {{ t("editable layers") }}</span
              ><span
                ><span class="material-symbols-outlined" aria-hidden="true"
                  >history</span
                >{{ doc.history.index }} {{ t("reversible edits") }}</span
              >
            </div>
            <md-button
              variant="filled"
              icon="arrow_forward"
              @click="() => router.push(route.editor())"
              >{{ t("Continue designing") }}</md-button
            >
          </div></md-card
        ></template
      ><template v-else></template>
      <div class="pictor-profile-workspace">
        <section class="pictor-profile-files">
          <div class="pictor-profile-section-head">
            <div>
              <span class="pictor-profile-eyebrow">{{
                t("KEEP YOUR MOMENTUM")
              }}</span>
              <h2>{{ t("Your design files") }}</h2>
            </div>
            <ChoiceTabs
              :label="t('Profile file view')"
              :value="view"
              :onValue="setView"
              :options="[
                { value: 'recent', label: t('Recent') },
                { value: 'shared', label: t('With others') },
              ]"
            ></ChoiceTabs>
          </div>
          <TextControl
            :live="true"
            :label="t('Find a design file')"
            :value="query"
            :onValue="setQuery"
          ></TextControl>
          <div class="pictor-profile-file-list">
            <template v-for="file in files" :key="file.id"
              ><Link :href="route.file(file.id)" class="pictor-profile-file"
                ><img :src="preview(file.id)" alt="" loading="lazy" />
                <div>
                  <strong>{{ file.name }}</strong
                  ><span
                    >{{
                      projects.find((project) => project.id === file.projectId)
                        ?.name
                    }}
                    <span aria-hidden="true">·</span>
                    {{ doc.layersForFile(file.id).length }}
                    {{ t("layers") }}</span
                  >
                </div>
                <md-chip
                  v-awc="{ props: { label: t(file.stateKey) }, on: {} }"
                ></md-chip
                ><span
                  class="material-symbols-outlined pictor-profile-file__arrow"
                  aria-hidden="true"
                  >arrow_outward</span
                ></Link
              ></template
            >
          </div>
          <template v-if="!files.length"
            ><div class="pictor-profile-empty">
              <span class="material-symbols-outlined" aria-hidden="true"
                >search_off</span
              >
              <h3>{{ t("No designs in this view") }}</h3>
              <p>{{ t("Try another name or return to your recent files.") }}</p>
              <md-button
                variant="text"
                @click="
                  () => {
                    setQuery('');
                    setView('recent');
                  }
                "
                >{{ t("Show recent files") }}</md-button
              >
            </div></template
          ><template v-else></template>
        </section>
        <aside class="pictor-profile-sidebar">
          <md-card class="pictor-profile-activity" variant="outlined"
            ><div class="pictor-profile-section-head">
              <h2>{{ t("A little progress") }}</h2>
              <span class="material-symbols-outlined" aria-hidden="true"
                >history</span
              >
            </div>
            <p class="pictor-profile-note">
              {{ t("Recent changes on your current canvas.") }}
            </p>
            <template v-if="entries.length"
              ><ol>
                <template v-for="entry in entries" :key="entry.id"
                  ><li>
                    <span
                      class="material-symbols-outlined"
                      aria-hidden="true"
                      >{{ editIcon(entry.kind) }}</span
                    >
                    <div>
                      <strong>{{ t(entry.labelKey) }}</strong
                      ><span>{{
                        entry.after[0]?.name ??
                        entry.before[0]?.name ??
                        t("Canvas")
                      }}</span>
                    </div>
                  </li></template
                >
              </ol></template
            ><template v-else
              ><div class="pictor-profile-first-step">
                <span class="material-symbols-outlined" aria-hidden="true"
                  >draw</span
                >
                <p>{{ t("Every good idea starts with a first move.") }}</p>
                <md-button
                  variant="text"
                  @click="() => router.push(route.editor())"
                  >{{ t("Make your first edit") }}</md-button
                >
              </div></template
            ></md-card
          >
          <md-card class="pictor-profile-saved" variant="filled"
            ><span class="material-symbols-outlined" aria-hidden="true"
              ><template v-if="doc.saveStatus === 'unavailable'"
                >cloud_off</template
              ><template v-else>check_circle</template></span
            >
            <h3>
              <template v-if="doc.saveStatus === 'unavailable'">{{
                t("Keep a copy of your work")
              }}</template
              ><template v-else>{{ t("Your ideas stay with you.") }}</template>
            </h3>
            <p>
              <template v-if="doc.saveStatus === 'unavailable'">{{
                t("Export your current canvas to keep it beyond this session.")
              }}</template
              ><template v-else>{{
                t(
                  "Your canvases and their history are saved in this browser, ready for your next visit.",
                )
              }}</template>
            </p>
            <md-button
              variant="text"
              @click="
                () => {
                  if (doc.saveStatus === 'unavailable') {
                    router.push(route.editor());
                    setTimeout(
                      () => window.dispatchEvent(new Event('pictor:export')),
                      120,
                    );
                  } else doc.save();
                }
              "
              v-awc="{
                props: {
                  icon: doc.saveStatus === 'unavailable' ? 'download' : 'save',
                },
                on: {},
              }"
              ><template v-if="doc.saveStatus === 'unavailable'">{{
                t("Export a copy")
              }}</template
              ><template v-else>{{ t("Save workspace") }}</template></md-button
            ></md-card
          >
          <Link class="pictor-profile-library-link" :href="route.assets()"
            ><span class="material-symbols-outlined" aria-hidden="true"
              >interests</span
            >
            <div>
              <strong>{{ t("A new ingredient?") }}</strong
              ><span>{{ t("Explore your creative library") }}</span>
            </div>
            <span class="material-symbols-outlined" aria-hidden="true"
              >arrow_forward</span
            ></Link
          >
        </aside>
      </div>
    </div>
    <template #aside
      ><md-button
        variant="tonal"
        icon="arrow_outward"
        @click="() => router.push(route.editor())"
        >{{ t("Open the studio") }}</md-button
      ></template
    ></Screen
  >
</template>
