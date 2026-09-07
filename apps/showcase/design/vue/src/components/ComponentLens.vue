<script setup lang="ts">
import { pictorSearchText, LIVE_COMPONENTS } from "@awc-ui/pictor-model";

const t = useT();
import { useT } from "~/composables/useShowcase";

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
import StudioDialog from "~/components/editor/StudioDialog.vue";
import TextControl from "~/components/editor/TextControl.vue";
type Pointer = PointerEvent;
type Entry = { tag: string; count: number; markup: string };
function inspectComponents(): Entry[] {
  const entries = new Map<string, Entry>();
  for (const element of document.querySelectorAll(".shell *")) {
    if (
      !element.localName.startsWith("md-") ||
      !customElements.get(element.localName) ||
      element.closest("[data-component-lens]")
    )
      continue;
    const entry = entries.get(element.localName);
    if (entry) {
      entry.count++;
      continue;
    }
    const clone = element.cloneNode(true) as Element;
    for (const node of [clone, ...clone.querySelectorAll("*")]) {
      for (const attribute of [...node.attributes]) {
        if (
          /^(class|id|style|data-.+|s-.+|c-id|hydrated)$/.test(attribute.name)
        )
          node.removeAttribute(attribute.name);
      }
    }
    entries.set(element.localName, {
      tag: element.localName,
      count: 1,
      markup: clone.outerHTML,
    });
  }
  return [...entries.values()].sort((a, b) => a.tag.localeCompare(b.tag));
}
const open = ref(false);
const setOpen = (
  next: typeof open.value | ((current: typeof open.value) => typeof open.value),
) => {
  open.value = typeof next === "function" ? next(open.value) : next;
};
const entries = ref<Entry[]>([]);
const setEntries = (
  next:
    | typeof entries.value
    | ((current: typeof entries.value) => typeof entries.value),
) => {
  entries.value = typeof next === "function" ? next(entries.value) : next;
};
const query = ref("");
const setQuery = (
  next:
    typeof query.value | ((current: typeof query.value) => typeof query.value),
) => {
  query.value = typeof next === "function" ? next(query.value) : next;
};
const selected = ref("");
const setSelected = (
  next:
    | typeof selected.value
    | ((current: typeof selected.value) => typeof selected.value),
) => {
  selected.value = typeof next === "function" ? next(selected.value) : next;
};
const copyStatus = ref("");
const setCopyStatus = (
  next:
    | typeof copyStatus.value
    | ((current: typeof copyStatus.value) => typeof copyStatus.value),
) => {
  copyStatus.value = typeof next === "function" ? next(copyStatus.value) : next;
};
watchLifecycle(() => {
  const reveal = () => {
    const snapshot = inspectComponents();
    setEntries(snapshot);
    setSelected(
      snapshot.find((entry) => entry.tag === "md-button")?.tag ??
        snapshot[0]?.tag ??
        "",
    );
    setQuery("");
    setCopyStatus("");
    setOpen(true);
  };
  window.addEventListener("pictor:components", reveal);
  return () => window.removeEventListener("pictor:components", reveal);
}, undefined);
const current = computed(() =>
  entries.value.find((entry) => entry.tag === selected.value),
);
const componentName = (tag: string) => {
  const name = tag.slice(3).replace(/-/g, " ");
  return name[0].toUpperCase() + name.slice(1);
};
const componentSearch = (entry: Entry) => {
  const live = LIVE_COMPONENTS.find(
    (item) => item.id === "awc:" + entry.tag.slice(3),
  );
  return pictorSearchText(
    [
      entry.tag,
      componentName(entry.tag),
      t(componentName(entry.tag)),
      live ? t(live.name) : "",
      live ? t(live.description) : "",
    ].join(" "),
  );
};
const filtered = computed(() =>
  entries.value.filter((entry) =>
    componentSearch(entry).includes(pictorSearchText(query.value)),
  ),
);

const { navigator } = globalThis;
</script>
<template>
  <div data-component-lens>
    <StudioDialog
      :open="open"
      :onClose="() => setOpen(false)"
      :title="t('Inside the interface')"
    >
      <p class="component-lens__intro">
        <strong>{{ entries.length }} {{ t("AWC component types") }}</strong>
        {{
          t(
            "compose this screen. Explore the elements behind the experience, then bring them into your own application.",
          )
        }}
      </p>
      <TextControl
        :live="true"
        :label="t('Find a component')"
        :value="query"
        :onValue="setQuery"
        :placeholder="t('Try button, dialog, slider…')"
      ></TextControl>
      <div class="component-lens__layout">
        <div
          class="component-lens__list"
          :aria-label="t('Components on this screen')"
        >
          <template v-for="entry in filtered" :key="entry.tag"
            ><button
              :aria-pressed="selected === entry.tag"
              @click="
                () => {
                  setSelected(entry.tag);
                  setCopyStatus('');
                }
              "
            >
              <code>{{ entry.tag }}</code
              ><span>{{ entry.count }}</span>
            </button></template
          >
          <template v-if="!filtered.length"
            ><p>{{ t("No matching components on this screen.") }}</p></template
          >
        </div>
        <template v-if="current"
          ><section class="component-lens__detail">
            <span class="component-lens__eyebrow">{{
              t("LIVE ELEMENT MARKUP")
            }}</span>
            <h3>{{ current.tag }}</h3>
            <p>
              {{ current.count }}
              <template v-if="current.count === 1">{{ t("instance") }}</template
              ><template v-else>{{ t("instances") }}</template>
              {{
                t(
                  "in this application surface. This HTML shows the first instance; object properties and event handlers belong in your framework code.",
                )
              }}
            </p>
            <pre
              :tabindex="0"
            ><code><template v-if="current.markup.length > 5000">{{ `${current.markup.slice(0, 5000)}\n… ${t('Preview truncated; copy includes the complete element.')}` }}</template><template v-else>{{ current.markup }}</template></code></pre>
            <div class="component-lens__actions">
              <md-button
                variant="tonal"
                icon="content_copy"
                @click="
                  async () => {
                    try {
                      await navigator.clipboard.writeText(current!.markup);
                      setCopyStatus('Markup copied');
                    } catch {
                      setCopyStatus(
                        'Clipboard unavailable. Select and copy the preview.',
                      );
                    }
                  }
                "
                >{{ t("Copy HTML") }}</md-button
              ><md-button
                variant="text"
                icon="open_in_new"
                target="_blank"
                rel="noopener noreferrer"
                v-awc="{
                  props: {
                    href: `https://awc-ui.dev/components/${current.tag.slice(3)}/`,
                  },
                  on: {},
                }"
                >{{ t("Component API") }}</md-button
              >
            </div>
            <span role="status">{{ t(copyStatus) }}</span>
          </section></template
        >
      </div>
      <div class="component-lens__install">
        <span>{{ t("Start with the library") }}</span
        ><code>npm i @awc-ui/core</code
        ><a
          href="https://awc-ui.dev/getting-started/installation/"
          target="_blank"
          rel="noopener noreferrer"
          >{{ t("Choose your framework →") }}</a
        >
      </div>
      <template #actions
        ><md-button variant="text" @click="() => setOpen(false)">{{
          t("Back to Pictor")
        }}</md-button></template
      ></StudioDialog
    >
  </div>
</template>
