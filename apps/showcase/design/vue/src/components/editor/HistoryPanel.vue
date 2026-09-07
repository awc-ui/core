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
import { editIcon } from "@awc-ui/showcase-kit/design";
import {
  useDocument,
  useTreeRows,
  useSelectableIds,
} from "~/composables/useDocument";
import { useT } from "~/composables/useShowcase";
type Pointer = PointerEvent;

const t = useT();
const doc = useDocument();
const { entries, index } = doc.history;

const { document } = globalThis;
</script>
<template>
  <div class="history studio-history" data-history>
    <div class="studio-panel-head">
      <strong>{{ t("Time machine") }}</strong
      ><span>{{ entries.length }} {{ t("edits") }}</span>
    </div>
    <p class="studio-tip">
      {{ t("Revisit any step. Making a new edit replaces the redo branch.") }}
    </p>
    <button
      class="history__row"
      :data-current="index === 0 ? '' : undefined"
      @click="() => doc.jumpHistory(0)"
    >
      <span class="material-symbols-outlined" aria-hidden="true">flag</span
      ><span
        ><strong>{{ t("Starting canvas") }}</strong
        ><small>{{ t("Your document before these edits") }}</small></span
      ><template v-if="index === 0"
        ><span class="studio-history__current">{{
          t("Current")
        }}</span></template
      ><template v-else></template></button
    ><template v-for="(entry, i) in entries" :key="entry.id"
      ><button
        class="history__row"
        :data-edit="entry.kind"
        :data-undone="i >= index ? '' : undefined"
        :data-current="i === index - 1 ? '' : undefined"
        @click="() => doc.jumpHistory(i + 1)"
      >
        <span class="material-symbols-outlined" aria-hidden="true">{{
          editIcon(entry.kind)
        }}</span
        ><span
          ><strong>{{ t(entry.labelKey) }}</strong
          ><small
            >{{ entry.after[0]?.name ?? entry.before[0]?.name ?? t("Canvas")
            }}<template
              v-if="Math.max(entry.before.length, entry.after.length) > 1"
              >{{
                t(" + {count} more", {
                  count: Math.max(entry.before.length, entry.after.length) - 1,
                })
              }}</template
            ><template v-else></template></small></span
        ><template v-if="i === index - 1"
          ><span class="studio-history__current">{{
            t("Current")
          }}</span></template
        ><template v-else
          ><span class="studio-history__number">{{ i + 1 }}</span></template
        >
      </button></template
    ><template v-if="entries.length === 0"
      ><div class="studio-history-empty">
        <span class="material-symbols-outlined" aria-hidden="true"
          >history</span
        >
        <p>
          {{ t("Your next idea starts here. Every change is reversible.") }}
        </p>
      </div></template
    ><template v-else></template>
  </div>
</template>
