<!--
  Four sibling views of ONE household: members, mandate, documents, activity.

  THIS IS THE LEGITIMATE USE OF `md-tabs` (§7.3). The tabs do not navigate —
  every panel describes the same household from a different angle, the reader
  may move between them in any order, and the URL does not change. App
  destinations remain the rail and the bar, which the shell owns and this
  file never touches.

  PANELS ARE MOUNTED BEFORE THEY ARE ASKED FOR, but never up front.
  `md-tab-panels` is explicit that nothing is lazily rendered — inactive panel
  content stays in the DOM — and it tells you to mount expensive content
  yourself. So the first panel is built with the screen, and the other three
  are built one at a time during idle periods once it has painted; see
  `opened` below for what that buys and why the idle wait is the whole point.
  The panel ELEMENTS are always present, because `md-tab-panels` pairs panels
  to tabs BY POSITION and a missing panel would shift every one after it.

  `sizing="active"` rather than the default `stable`: with `stable` the region
  is permanently as tall as the tallest panel, and the org chart is several
  times the height of the activity list — a card of empty space under every
  other tab. The trade is a layout shift on switch, which is the honest one.

  SELECTION STATE THAT SURVIVES A TAB SWITCH lives in this component rather
  than in the panels. Keeping panels mounted would preserve it either way now,
  but that is a performance choice this file is free to revisit and not a
  contract — ticking three members, reading the mandate and coming back must
  not clear the selection whichever way the mounting goes.
-->
<script setup lang="ts">
import { computed, onMounted, onScopeDispose, ref, watch } from 'vue';
import type {
  Activity,
  AllocationRow,
  Client,
  Goal,
  Household,
  Portfolio,
  Proposal,
} from '@awc-ui/showcase-kit/wealth';
import { useT } from '~/composables/useShowcase';
import HouseholdActivityPanel from './HouseholdActivityPanel.vue';
import HouseholdDocumentsPanel from './HouseholdDocumentsPanel.vue';
import HouseholdMandatePanel from './HouseholdMandatePanel.vue';
import HouseholdMembersPanel from './HouseholdMembersPanel.vue';

const props = defineProps<{
  household: Household;
  portfolio?: Portfolio;
  members: Client[];
  goals: Goal[];
  proposals: Proposal[];
  activity: Activity[];
  allocation: AllocationRow[];
  /** From the kit's `driftedMandates()`, not counted here. */
  breachCount: number;
}>();

/** Raise a snackbar on the screen. Every message is a dictionary string. */
const emit = defineEmits<{ (e: 'notify', message: string): void }>();

const t = useT();
const active = ref(0);

/*
 * Which panels have been BUILT. A panel in here has its children mounted and
 * keeps them; one outside it is an empty `md-tab-panel`.
 *
 * Panels used to render their children only while active, so leaving a tab
 * destroyed its contents and returning rebuilt them. Mounting on first
 * activation fixed the return visit and not the first one: clicking a tab
 * nobody had opened still mounted dozens of custom elements in the very
 * frame the panel became visible, and the region — `sizing="active"`, so it
 * follows the visible panel — had nothing to be as tall as until the renderer
 * committed. Measured on the React source: one painted frame at 0px, then the
 * content appearing into it. That is the flicker.
 *
 * So panel 0 is built with the screen and the rest are built AHEAD of the
 * click, one per idle period. A first click then finds its panel already
 * built and behaves exactly like a return: one height change, no rebuild.
 *
 * Replaced wholesale (`new Set(...)`) rather than mutated, so the watcher
 * below sees each warm-up commit and schedules the next one.
 */
const opened = ref<Set<number>>(new Set([0]));
const selectedMembers = ref<string[]>([]);
const reviewScore = ref(0);
const reviewed = ref(false);

const tabListeners = {
  mdTabChange(event: Event) {
    const next = (event as CustomEvent<{ index: number; previousIndex: number }>).detail.index;
    active.value = next;
    // The fallback, for a panel the warm-up below has not reached yet — a
    // click inside the first idle period, or a tab that was backgrounded the
    // whole time. Recorded in the same handler as `active`, so the panel
    // mounts in the commit that activates it rather than a pass later.
    if (!opened.value.has(next)) opened.value = new Set(opened.value).add(next);
  },
};

const tabs = computed(() => [
  { labelKey: 'wealth.panel.members', icon: 'group', badge: String(props.members.length) },
  { labelKey: 'wealth.panel.mandate', icon: 'gavel', badge: undefined },
  {
    labelKey: 'wealth.kpi.proposals',
    icon: 'description',
    badge: props.proposals.length ? String(props.proposals.length) : undefined,
  },
  { labelKey: 'wealth.panel.activity', icon: 'history', badge: undefined },
]);

/**
 * Run `work` when the browser has nothing better to do, and return its cancel.
 *
 * `requestIdleCallback` is the whole point of the warm-up below — it is what
 * keeps building a panel nobody has asked for off the critical path, rather
 * than merely off the click. The `timeout` caps how long a busy tab can defer
 * it; without one, a page that never goes idle never warms and the first click
 * pays the old cost. Safari only shipped it in 17, hence the `setTimeout`
 * fallback — a fixed delay is a worse scheduler but a correct one.
 */
function whenIdle(work: () => void): () => void {
  const host = window as typeof window & {
    requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
    cancelIdleCallback?: (handle: number) => void;
  };

  if (typeof host.requestIdleCallback === 'function') {
    const handle = host.requestIdleCallback(work, { timeout: 500 });
    return () => host.cancelIdleCallback?.(handle);
  }

  const timer = window.setTimeout(work, 200);
  return () => window.clearTimeout(timer);
}

/*
 * WARM THE PANELS NOBODY HAS OPENED YET, once the screen is idle.
 *
 * `requestAnimationFrame` first, so the callback is queued behind the commit
 * that mounted panel 0 and cannot run before it has laid out. Then
 * `whenIdle`, which is what makes this a warm-up rather than a mount-it-all:
 * the elements are built in time the browser was going to spend doing
 * nothing, so nothing here competes with the screen's own first paint. ONE
 * panel per callback, not all three, because a single commit of ~120
 * elements is one long task and three small ones are three short ones.
 *
 * A tab nobody opens still costs something — that is the trade, and it is
 * deliberately taken in idle time rather than refused. What the old lazy
 * rule was really protecting was the FIRST PAINT, and that is now protected
 * by when this runs rather than by whether it runs at all. If the tab is
 * backgrounded, `requestAnimationFrame` never fires and no panel is warmed;
 * the mount-on-activation path in `tabListeners` is still there and still
 * correct.
 *
 * BUILDING A PANEL WHILE IT IS HIDDEN IS SAFE FOR WHAT IS IN THESE THREE,
 * and that is a checked claim rather than a hopeful one: `md-accordion-item`
 * expands with `grid-template-rows: 0fr↔1fr`, and `md-rating` and
 * `md-tooltip` only measure from a pointer or a show — none of them reads a
 * box at build time. `md-list-item` is the one that does, for its truncation
 * tooltip, and it re-runs that from its own ResizeObserver the moment the
 * panel gets a size; it toggles a tooltip's `disabled` and never layout.
 * `md-organization-chart`, the component that would have to be argued about,
 * is in panel 0 and is never warmed — it is built with the screen, in the
 * panel the reader is already looking at.
 *
 * Scheduled from `onMounted`, then re-scheduled by the watcher after each
 * warm-up commits (`flush: 'post'`, so the DOM the browser is idle FROM is
 * the one that includes the panel just built) — the same cadence as the
 * React effect that re-runs on each `opened` commit.
 */
let cancelWarmup: (() => void) | null = null;

function scheduleWarmup(): void {
  cancelWarmup?.();
  cancelWarmup = null;
  if (opened.value.size >= tabs.value.length) return;

  let cancelIdle: (() => void) | null = null;
  const frame = requestAnimationFrame(() => {
    cancelIdle = whenIdle(() => {
      const next = new Set(opened.value);
      for (let index = 0; index < tabs.value.length; index += 1) {
        if (next.has(index)) continue;
        next.add(index);
        opened.value = next;
        return;
      }
    });
  });

  cancelWarmup = () => {
    cancelAnimationFrame(frame);
    cancelIdle?.();
  };
}

onMounted(scheduleWarmup);
watch(opened, scheduleWarmup, { flush: 'post' });
onScopeDispose(() => {
  cancelWarmup?.();
});

function onReviewed(): void {
  reviewed.value = true;
  emit('notify', t.value('wealth.activity.review-completed'));
}
</script>

<template>
  <div class="stack">
    <!--
      `tab-width="auto"` rather than the default `equal`: the four labels are
      of very different lengths and equal tracks would truncate the longest in
      English and more of them in a longer language. Every tab carries an icon
      — M3 forbids mixing icon+text tabs with text-only ones in the same set.
      `variant` and `active` are stamped onto the children by the strip, and
      `md-tabs` has no `density` prop, so none of the three appears below.
    -->
    <md-tabs
      v-awc="{ on: tabListeners }"
      id="household-tabs"
      :aria-label="t('wealth.nav.household')"
      :active-tab-index="active"
      tab-width="auto"
    >
      <md-tab
        v-for="tab in tabs"
        :key="tab.labelKey"
        :label="t(tab.labelKey)"
        :icon="tab.icon"
        inline-icon
        :badge="tab.badge"
      ></md-tab>
    </md-tabs>

    <md-tab-panels for="household-tabs" sizing="active">
      <md-tab-panel>
        <HouseholdMembersPanel
          v-if="opened.has(0)"
          :household="household"
          :portfolio="portfolio"
          :members="members"
          :goals="goals"
          :selected="selectedMembers"
          @select="selectedMembers = $event"
          @notify="emit('notify', $event)"
        />
      </md-tab-panel>

      <md-tab-panel>
        <HouseholdMandatePanel
          v-if="opened.has(1)"
          :household="household"
          :portfolio="portfolio"
          :allocation="allocation"
          :breach-count="breachCount"
          :score="reviewScore"
          :reviewed="reviewed"
          @score="reviewScore = $event"
          @reviewed="onReviewed"
        />
      </md-tab-panel>

      <md-tab-panel>
        <HouseholdDocumentsPanel v-if="opened.has(2)" :proposals="proposals" />
      </md-tab-panel>

      <md-tab-panel>
        <HouseholdActivityPanel v-if="opened.has(3)" :activity="activity" />
      </md-tab-panel>
    </md-tab-panels>
  </div>
</template>
