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
import { fileById } from "@awc-ui/showcase-kit/design";
import {
  useDocument,
  useTreeRows,
  useSelectableIds,
} from "~/composables/useDocument";
import { documentSvg, downloadDocument } from "@awc-ui/pictor-model";
import { useT } from "~/composables/useShowcase";
import SelectControl from "~/components/editor/SelectControl.vue";
import StudioDialog from "~/components/editor/StudioDialog.vue";
import ToggleControl from "~/components/editor/ToggleControl.vue";
type Pointer = PointerEvent;

const props = defineProps<{ open: boolean; onClose(): void }>();
const open = toRef(props, "open");
const onClose = toRef(props, "onClose");
const doc = useDocument();
const t = useT();
const format = ref("svg");
const setFormat = (
  next:
    | typeof format.value
    | ((current: typeof format.value) => typeof format.value),
) => {
  format.value = typeof next === "function" ? next(format.value) : next;
};
const scale = ref("1");
const setScale = (
  next:
    typeof scale.value | ((current: typeof scale.value) => typeof scale.value),
) => {
  scale.value = typeof next === "function" ? next(scale.value) : next;
};
const background = ref(false);
const setBackground = (
  next:
    | typeof background.value
    | ((current: typeof background.value) => typeof background.value),
) => {
  background.value = typeof next === "function" ? next(background.value) : next;
};
const busy = ref(false);
const setBusy = (
  next: typeof busy.value | ((current: typeof busy.value) => typeof busy.value),
) => {
  busy.value = typeof next === "function" ? next(busy.value) : next;
};
const message = ref("");
const setMessage = (
  next:
    | typeof message.value
    | ((current: typeof message.value) => typeof message.value),
) => {
  message.value = typeof next === "function" ? next(message.value) : next;
};
const download = async () => {
  setBusy(true);
  setMessage("");
  try {
    await downloadDocument(
      doc.layers,
      t,
      format.value as "svg" | "png" | "json",
      fileById(doc.fileId)?.name ?? "Pictor design",
      Number(scale.value),
      background.value,
    );
    setMessage("Your file is ready. Check your downloads.");
  } catch (error) {
    setMessage(
      error instanceof Error ? error.message : "Export failed. Please try SVG.",
    );
  } finally {
    setBusy(false);
  }
};

const { document } = globalThis;
</script>
<template>
  <StudioDialog
    :open="open"
    :onClose="onClose"
    :title="t('Made by you. Ready for the world.')"
    ><div class="studio-export" data-export-dialog>
      <div class="studio-export__preview">
        <img
          :src="`data:image/svg+xml,${encodeURIComponent(documentSvg(doc.layers, t, { background }))}`"
          :alt="t('Export preview')"
        />
      </div>
      <div class="studio-export__settings">
        <SelectControl
          :label="t('File format')"
          :data-export-format="true"
          :value="format"
          :onValue="
            (value) => {
              setFormat(value);
              setMessage('');
            }
          "
          :options="[
            { value: 'svg', label: t('SVG · Scalable vector') },
            { value: 'png', label: t('PNG · Ready to share') },
            { value: 'json', label: t('JSON · Editable document data') },
          ]"
        ></SelectControl
        ><template v-if="format !== 'json'"
          ><SelectControl
            :label="t('Resolution')"
            :value="scale"
            :onValue="setScale"
            :options="[
              { value: '1', label: '1× · 960 × 640' },
              { value: '2', label: '2× · 1920 × 1280' },
              { value: '3', label: '3× · 2880 × 1920' },
            ]"
          ></SelectControl
          ><ToggleControl
            :selected="background"
            :onValue="setBackground"
            :label="t('Add white background')"
          ></ToggleControl></template
        ><template v-else></template>
        <p class="studio-description">
          <template v-if="format === 'json'">{{
            t(
              "Preserves the complete layer model, including geometry, colors and component references.",
            )
          }}</template
          ><template v-else>{{
            t(
              "Exports visible layers and embedded artwork. Live controls become static vector representations; image adjustments and blend effects are simplified.",
            )
          }}</template>
        </p>
        <div role="status" class="studio-export__message">{{ t(message) }}</div>
      </div>
    </div>
    <template #actions
      ><md-button variant="text" @click="onClose">{{
        t("Back to canvas")
      }}</md-button
      ><md-button
        variant="filled"
        icon="download"
        @click="download"
        data-download
        v-awc="{ props: { disabled: busy || undefined }, on: {} }"
        ><template v-if="busy">{{ t("Preparing…") }}</template
        ><template v-else>{{
          t("Download {format}", { format: format.toUpperCase() })
        }}</template></md-button
      ></template
    ></StudioDialog
  >
</template>
