<!--
  The household's structure, twice: as a tree and as a list.

  The org chart's own manual asks for exactly this — "offer a non-visual
  alternative for the hierarchy" — because a connector-drawn tree is a PICTURE
  of structure and a picture is not available to every reader. The list below
  it is that alternative, and it is also where the per-member controls live: a
  tree item cannot hold a checkbox, since the chart renders its own node chrome
  and its togglers are deliberately out of the tab order.

  THE TREE IS REAL RELATIONS, not decoration: the household entity at the root,
  its mandate and its members beneath it, and each objective under the member
  it is earmarked for (`Goal.beneficiaryClientId`), with the household-level
  ones hanging off the root. Selecting any node fills the panel beside it.

  `nodes` has no attribute form, so it is assigned as a JS property through
  `v-awc` — and it comes from a `computed`, which is what keeps the reference
  STABLE between unrelated re-renders: the directive re-assigns on every
  update, but Stencil's setter skips identical references, so the chart's
  collapsed set is only rebuilt when the data (or its translated labels)
  actually changes. Folding a per-render array literal in here would re-fold
  every branch the reader had opened each time they clicked a node — the same
  trap the React source avoids by keying its assignment on the JSON of the
  nodes.
-->
<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  kycDot,
  type Client,
  type Goal,
  type Household,
  type Portfolio,
} from '@awc-ui/showcase-kit/wealth';
import { useT } from '~/composables/useShowcase';
import type { OrgNode } from '~/lib/types';
import EmptyState from '~/components/EmptyState.vue';
import Count from '~/components/bits/Count.vue';
import ActionButton from './HouseholdActionButton.vue';
import HouseholdNodeDetail from './HouseholdNodeDetail.vue';

const props = defineProps<{
  household: Household;
  portfolio?: Portfolio;
  members: Client[];
  goals: Goal[];
  selected: string[];
}>();

const emit = defineEmits<{
  (e: 'select', next: string[]): void;
  (e: 'notify', message: string): void;
}>();

const t = useT();

const focusId = ref<string>(props.members[0]?.id ?? props.household.id);

/**
 * Initials for a DECORATIVE avatar.
 *
 * `md-avatar` derives initials from `name` itself — but setting `name` also
 * gives the avatar `role="img"` and an `aria-label`, and the row it sits in
 * already announces that same name as its headline. Passing `initials` and
 * leaving `name` / `label` / `alt` empty is the documented way to make the
 * avatar decorative, which is what a picture beside its own caption is.
 */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1] : '';
  return `${first.slice(0, 1)}${last.slice(0, 1)}`;
}

const nodes = computed<OrgNode[]>(() => {
  const objectivesFor = (clientId: string | null) =>
    props.goals
      .filter((goal) => goal.beneficiaryClientId === clientId)
      .map((goal) => ({
        id: goal.id,
        name: t.value(goal.typeKey),
        title: t.value.formatPercent(goal.fundedPct, { maximumFractionDigits: 0 }),
      }));

  const memberNodes: OrgNode[] = props.members.map((client) => {
    const children = objectivesFor(client.id);
    return {
      id: client.id,
      name: client.name,
      title: t.value(client.roleKey),
      avatarInitials: initialsOf(client.name),
      ...(children.length ? { children } : {}),
    };
  });

  const mandateNode: OrgNode[] = props.portfolio
    ? [
        {
          id: props.portfolio.id,
          name: props.portfolio.reference,
          title: t.value(props.portfolio.strategyKey),
        },
      ]
    : [];

  return [
    {
      id: props.household.id,
      name: props.household.name,
      title: t.value(props.household.segmentKey),
      children: [...mandateNode, ...memberNodes, ...objectivesFor(null)],
    },
  ];
});

// `selectedIds` is property-only — it has no attribute form to render. Its own
// computed keeps the array reference stable until the focus actually moves, so
// the chart's selection watcher is not poked on unrelated re-renders.
const selectedIds = computed(() => (focusId.value ? [focusId.value] : []));

const chartProps = computed(() => ({ nodes: nodes.value, selectedIds: selectedIds.value }));

const chartListeners = {
  mdSelectionChange(event: Event) {
    // Single-select: clicking the selected node DESELECTS it and reports an
    // empty array. Falling back to the household keeps the detail panel from
    // emptying out under the reader.
    const detail = (event as CustomEvent<{ node: OrgNode; selectedIds: string[] }>).detail;
    focusId.value = detail.selectedIds[0] ?? props.household.id;
  },
};

const listListeners = {
  mdChange(event: Event) {
    const id = (event.target as HTMLElement | null)?.dataset?.id;
    if (!id) return;
    const checked = (event as CustomEvent<{ checked: boolean }>).detail.checked;
    emit('select', checked ? [...props.selected, id] : props.selected.filter((one) => one !== id));
  },
  mdClick(event: Event) {
    const id = (event.target as HTMLElement | null)?.dataset?.id;
    if (!id || !props.members.some((client) => client.id === id)) return;
    emit('notify', t.value('wealth.activity.client-contacted'));
  },
};
</script>

<template>
  <EmptyState v-if="members.length === 0" :message="t('wealth.empty.clients')" />
  <div v-else class="stack">
    <div class="grid-wide">
      <md-organization-chart
        v-awc="{ props: chartProps, on: chartListeners }"
        class="table-host"
        selection-mode="single"
        orientation="vertical"
        :label="t('wealth.panel.members')"
        :expand-label="t('action.expand')"
        :collapse-label="t('action.collapse')"
      >
        <!-- The wealth dictionary has no expand/collapse verbs; the two label
             props above are in the shared `core` block, which every locale is
             required to translate — so they are localised in ro and ar today,
             which the component's English defaults would not be (§9.2). -->
        <div slot="empty">{{ t('wealth.empty.clients') }}</div>
      </md-organization-chart>

      <HouseholdNodeDetail :id="focusId" :household="household" />
    </div>

    <md-divider></md-divider>

    <div class="row row--between">
      <h3 class="panel__title">{{ t('wealth.panel.members') }}</h3>
      <!--
        ALWAYS RENDERED, HIDDEN WHILE NOTHING IS SELECTED.

        It used to be mounted only once a row was ticked, so this header row
        was the height of its heading until then and the height of a 40px
        button after — and the whole member list below jumped down the moment
        you selected anything, which is the opposite of what selecting should
        feel like.

        `visibility: hidden` rather than a reserved `min-block-size` on the
        row: the space reserved is then exactly what the real cluster
        occupies, at any density and in any locale, with no number here that
        can drift from it. It also takes the button out of the tab order and
        out of the accessibility tree while it is inert, which `opacity: 0`
        would not.
      -->
      <span
        class="row"
        :aria-hidden="selected.length > 0 ? undefined : true"
        :style="selected.length > 0 ? undefined : { visibility: 'hidden' }"
      >
        <Count :value="selected.length" />
        <ActionButton icon="mail" @activate="emit('notify', t('wealth.activity.client-contacted'))">
          {{ t('wealth.action.contact') }}
        </ActionButton>
      </span>
    </div>

    <!--
      `interaction-mode="multi-action"`: the row is a label and the trailing
      controls are the actions, each keeping its own tab stop. No
      `selection-mode` — the checkbox IS the selection here, and a listbox
      mode would put a second, competing selected state on the row itself.
    -->
    <md-list
      v-awc="{ on: listListeners }"
      :label="t('wealth.panel.members')"
      interaction-mode="multi-action"
    >
      <md-list-item
        v-for="client in members"
        :key="client.id"
        :headline="client.name"
        :overline="t(client.roleKey)"
        :supporting-text="`${t('wealth.table.age')} ${t.formatNumber(client.age)} · ${t(
          `wealth.country.${client.domicile}`,
        )} · ${t(client.kycStatusKey)}`"
        lines="3"
      >
        <!--
          THE KYC STATE IS IN THE SUPPORTING TEXT above, not in a trailing chip,
          and that is a layout decision made by looking at the rendered row.
          `md-list-item` lays its trailing slot out as a column, so a chip pair
          plus the two controls became three stacked lines and a 140px row. The
          trailing edge is for CONTROLS (§7.2 pairs the row with a checkbox, a
          switch or an icon button); the facts belong in the row's own text,
          where they also stay readable at density -4.

          The avatar + corner dot pattern is from `md-status-dot`'s manual:
          the dot positions itself absolutely, so it needs a positioned
          ancestor, and `.badge-anchor` is the one this app already has.
          Both are decorative — the headline carries the name and the
          supporting text carries the KYC state in words, so the dot's
          colour repeats it rather than being its only carrier.
        -->
        <span slot="leading" class="badge-anchor">
          <md-avatar :initials="initialsOf(client.name)" size="small"></md-avatar>
          <md-status-dot shape="circle" :state="kycDot[client.kycStatus]" size="small"></md-status-dot>
        </span>

        <!-- ONE trailing element holding two controls, not two trailing
             elements: the slot lays its children out as a column, so two
             siblings stack and make the row twice as tall. Wrapped in a
             `.row` they sit side by side and each keeps its own tab stop,
             because both are still light-DOM elements. -->
        <span slot="trailing" class="row">
          <md-icon-button
            :data-id="client.id"
            icon="mail"
            :aria-label="`${t('wealth.action.contact')} — ${client.name}`"
          ></md-icon-button>
          <!-- `md-checkbox` renders no slot at all, so a label cannot be
               slotted into it — `aria-label` is the only accessible name a
               checkbox inside a row can have. -->
          <md-checkbox
            :data-id="client.id"
            :checked="selected.includes(client.id)"
            :aria-label="client.name"
          ></md-checkbox>
        </span>
      </md-list-item>
    </md-list>
  </div>
</template>
