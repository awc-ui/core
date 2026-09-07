<script setup lang="ts">
import { pictorSearchText } from "@awc-ui/pictor-model";

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
import {
  fileById,
  getAssets,
  getFiles,
  getProjects,
  projectSlug,
} from "@awc-ui/showcase-kit/design";
import {
  useDocument,
  useTreeRows,
  useSelectableIds,
} from "~/composables/useDocument";
import { useRouter } from "~/lib/router";
import { route } from "~/lib/routes";
import { useCustomEvent, useElementProps } from "~/composables/elements";
import { scrollCommandIntoView } from "@awc-ui/pictor-model";
type Pointer = PointerEvent;
interface Command {
  id: string;
  label: string;
  detail: string;
  icon: string;
  run(): void;
}
const emit = (name: string) => window.dispatchEvent(new CustomEvent(name));
const doc = useDocument();
const router = useRouter();
const open = ref(false);
const setOpen = (
  next: typeof open.value | ((current: typeof open.value) => typeof open.value),
) => {
  open.value = typeof next === "function" ? next(open.value) : next;
};
const query = ref("");
const setQuery = (
  next:
    typeof query.value | ((current: typeof query.value) => typeof query.value),
) => {
  query.value = typeof next === "function" ? next(query.value) : next;
};
const active = ref(0);
const setActive = (
  next:
    | typeof active.value
    | ((current: typeof active.value) => typeof active.value),
) => {
  active.value = typeof next === "function" ? next(active.value) : next;
};
const message = ref("");
const setMessage = (
  next:
    | typeof message.value
    | ((current: typeof message.value) => typeof message.value),
) => {
  message.value = typeof next === "function" ? next(message.value) : next;
};
const dialog = shallowRef<HTMLElement | null>(null);
const snackbar = shallowRef<HTMLElement | null>(null);
const input = shallowRef<HTMLInputElement | null>(null);
const resultList = shallowRef<HTMLElement | null>(null);
const openState = shallowRef(false);
const previousFocus = shallowRef<HTMLElement | null | null>(null);
const openPalette = () => {
  if (openState.value) return;
  let focused = document.activeElement;
  while (focused?.shadowRoot?.activeElement)
    focused = focused.shadowRoot.activeElement;
  previousFocus.value = focused instanceof HTMLElement ? focused : null;
  openState.value = true;
  setOpen(true);
};
const closePalette = () => {
  openState.value = false;
  setOpen(false);
};
useCustomEvent(dialog, "mdClose", (event) => {
  if (event.target === dialog.value) closePalette();
});
useCustomEvent(dialog, "mdOpen", () => input.value?.focus());
useCustomEvent(snackbar, "mdClose", () => setMessage(""));
const save = () =>
  setMessage(
    doc.save()
      ? "Saved to this browser. Your files and history are here when you return."
      : "Browser storage is unavailable. Your work is still open; export a copy to keep it.",
  );
watchLifecycle(
  () => {
    const commands = openPalette;
    const saveNow = () => save();
    const keydown = (event: KeyboardEvent) => {
      if (
        !(event.metaKey || event.ctrlKey) ||
        event.altKey ||
        event.isComposing
      )
        return;
      if (event.key.toLowerCase() === "k") {
        event.preventDefault();
        openState.value ? closePalette() : openPalette();
      }
      if (event.key.toLowerCase() === "s") {
        event.preventDefault();
        save();
      }
    };
    window.addEventListener("keydown", keydown);
    window.addEventListener("pictor:commands", commands);
    window.addEventListener("pictor:save", saveNow);
    return () => {
      window.removeEventListener("keydown", keydown);
      window.removeEventListener("pictor:commands", commands);
      window.removeEventListener("pictor:save", saveNow);
    };
  },
  () => [doc.save],
);
watchLifecycle(
  () => {
    if (!open.value) {
      const target = previousFocus.value;
      previousFocus.value = null;
      // A chosen command may open another dialog in this same render. Let it
      // own focus; otherwise return to the still-connected palette trigger.
      if (target?.isConnected && !document.querySelector("md-dialog[open]"))
        target.focus({ preventScroll: true });
      return;
    }
    setQuery("");
    setActive(0);
    const timer = setTimeout(() => input.value?.focus(), 60);
    return () => clearTimeout(timer);
  },
  () => [open.value],
);
const commands = computed(() => {
  const inEditor =
    router.pathname === route.editor() || router.pathname.startsWith("/f/");
  const editorAction = (event: string) => {
    if (inEditor) emit(event);
    else {
      router.push(route.editor());
      setTimeout(() => emit(event), 120);
    }
  };
  return [
    {
      id: "editor",
      label: t("Open canvas"),
      detail: fileById(doc.fileId)?.name ?? t("Continue designing"),
      icon: "draw",
      run: () => router.push(route.editor()),
    },
    {
      id: "projects",
      label: t("Browse projects"),
      detail: t("Your workspace"),
      icon: "folder_open",
      run: () => router.push(route.projects()),
    },
    {
      id: "assets",
      label: t("Explore assets"),
      detail: t("Images, colors and reusable components"),
      icon: "grid_view",
      run: () => router.push(route.assets()),
    },
    {
      id: "save",
      label: t("Save in this browser"),
      detail: t("Keep your files, canvas and undo history"),
      icon: "save",
      run: save,
    },
    {
      id: "export",
      label: t("Export your design"),
      detail: t("Download an SVG or PNG"),
      icon: "download",
      run: () => editorAction("pictor:export"),
    },
    {
      id: "present",
      label: t("Present canvas"),
      detail: t("Explore your design without editor panels"),
      icon: "play_arrow",
      run: () => editorAction("pictor:present"),
    },
    {
      id: "components",
      label: t("Explore AWC components"),
      detail: t("Inspect the real components powering this screen"),
      icon: "widgets",
      run: () => emit("pictor:components"),
    },
    ...getFiles().map((file) => ({
      id: `file:${file.id}`,
      label: file.name,
      detail: t("Design file"),
      icon: "draft",
      run: () => {
        doc.openFile(file.id);
        router.push(route.file(file.id));
      },
    })),
    ...getProjects().map((project) => ({
      id: `project:${project.id}`,
      label: project.name,
      detail: t("Project"),
      icon: "folder",
      run: () => router.push(route.project(projectSlug(project))),
    })),
    ...getAssets().map((asset) => ({
      id: `asset:${asset.id}`,
      label: asset.name,
      detail: t("Asset · {kind}", { kind: t(asset.kindKey) }),
      icon: "interests",
      run: () => router.push(route.asset(asset.id)),
    })),
  ];
});
const normalized = computed(() => pictorSearchText(query.value));
const results = computed(() =>
  commands.value
    .filter(
      (command) =>
        !normalized.value ||
        pictorSearchText(
          `${command.label} ${command.detail} ${command.id}`,
        ).includes(normalized.value),
    )
    .slice(0, 12),
);
const choose = (command?: Command) => {
  if (command) {
    closePalette();
    command.run();
  }
};
const selected = computed(() =>
  Math.min(active.value, Math.max(0, results.value.length - 1)),
);
watch(
  [selected, results, resultList],
  async () => {
    await nextTick();
    scrollCommandIntoView(resultList.value, selected.value);
  },
  { flush: "post" },
);
</script>
<template>
  <template v-if="open"
    ><md-dialog
      :locale="t.locale"
      ref="dialog"
      class="pictor-command-dialog"
      :headline="t('Go anywhere. Make something.')"
      icon="search"
      v-awc="{ props: { open: open || undefined }, on: {} }"
    >
      <div class="pictor-command-search">
        <input
          ref="input"
          :value="query"
          @input="
            (event) => {
              setQuery((event.target as HTMLInputElement).value);
              setActive(0);
            }
          "
          :aria-label="t('Search commands, projects, files and assets')"
          :placeholder="t('Search commands, files, projects…')"
          role="combobox"
          aria-expanded="true"
          aria-controls="pictor-command-results"
          aria-autocomplete="list"
          :aria-activedescendant="
            results.length ? `pictor-command-${selected}` : undefined
          "
          @keydown="
            (event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                setActive((value) =>
                  Math.max(0, Math.min(results.length - 1, value + 1)),
                );
              }
              if (event.key === 'ArrowUp') {
                event.preventDefault();
                setActive((value) => Math.max(0, value - 1));
              }
              if (event.key === 'Enter') {
                event.preventDefault();
                choose(results[selected]);
              }
              if (event.key === 'Escape') {
                event.preventDefault();
                closePalette();
              }
            }
          "
        />
      </div>
      <div
        ref="resultList"
        class="pictor-command-results"
        id="pictor-command-results"
        role="listbox"
        :aria-label="t('Commands and destinations')"
      >
        <template v-for="(command, index) in results" :key="command.id"
          ><button
            :id="`pictor-command-${index}`"
            type="button"
            role="option"
            tabindex="-1"
            :aria-selected="index === selected"
            class="pictor-command-item"
            @mouseenter="() => setActive(index)"
            @click="() => choose(command)"
          >
            <span class="pictor-command-icon" aria-hidden="true">{{
              command.icon
            }}</span>
            <span
              ><strong>{{ command.label }}</strong
              ><small>{{ command.detail }}</small></span
            >
            <span class="pictor-command-enter" aria-hidden="true">↵</span>
          </button></template
        >
        <template v-if="!results.length"
          ><p class="pictor-command-empty">
            {{ t("No matches. Try “canvas”, “export”, or a project name.") }}
          </p></template
        >
      </div>
      <div slot="actions" class="pictor-command-hints">
        <span><kbd>↑</kbd> <kbd>↓</kbd> {{ t("to navigate") }}</span
        ><span><kbd>Enter</kbd> {{ t("to open") }}</span
        ><span><kbd>Esc</kbd> {{ t("to close") }}</span>
      </div>
    </md-dialog></template
  ><template v-else></template>
  <md-snackbar
    ref="snackbar"
    v-awc="{
      props: {
        open: !!message || undefined,
        message: t(message),
        duration: 4500,
      },
      on: {},
    }"
  ></md-snackbar>
</template>
