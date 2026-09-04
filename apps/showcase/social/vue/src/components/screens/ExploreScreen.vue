<!--
  Explore — everything on Lyra, as a grid.

  A MASONRY-ISH GRID WITHOUT MASONRY. One in seven tiles spans two columns and
  two rows, which stops a uniform grid reading as a contact sheet. The span
  comes from the kit and is derived from the post's INDEX rather than drawn at
  random, so all five builds lay out identically — a parity check that compared
  a randomised layout would compare nothing.

  EVERY TILE IS SQUARE-CROPPED, whatever the picture's own ratio. That is the
  one place this app deliberately throws away an aspect ratio: a grid whose
  cells were 1:1, 4:5 and 16:9 is not a grid. The full ratio comes back the
  moment the reader opens the post.

  THE SEARCH MATCHES PEOPLE, NOT CAPTIONS, and the field says so — a selector
  cannot see the dictionary, so a caption search would work in English and
  silently return nothing in Arabic.
-->
<script setup lang="ts">
import { computed, ref } from 'vue';
import { exploreTiles, getTotals, postKindIcon, topicFacets } from '@awc-ui/showcase-kit/social';
import { route } from '~/lib/routes';
import { useT } from '~/composables/useShowcase';
import Screen from '~/components/Screen.vue';
import Panel from '~/components/Panel.vue';
import EmptyState from '~/components/EmptyState.vue';
import Drill from '~/components/Drill.vue';
import PanelSkeleton from '~/components/skeletons/PanelSkeleton.vue';
import Count from '~/components/bits/Count.vue';
import Media from '~/components/bits/Media.vue';
import TopicChip from '~/components/bits/TopicChip.vue';

const t = useT();
const totals = getTotals();

const topic = ref<string | null>(null);
const search = ref('');

const facets = computed(() => topicFacets(search.value || undefined));
const tiles = computed(() => exploreTiles(topic.value ?? undefined, search.value || undefined));
const filtered = computed(() => topic.value !== null || search.value !== '');

/* `md-search` carries `{ value }` on every one of its events — unlike
   `md-text-field`, whose `mdInput` detail IS the bare string. Different
   components, different shapes; assuming one from the other has cost this repo
   two silent bugs. `mdSearch` rather than `mdInput` because it is debounced and
   distinct-until-changed. */
const searchListeners = {
  mdSearch: (event: CustomEvent<{ value: string }>) => {
    search.value = event.detail?.value ?? '';
  },
};

const facetListeners = {
  mdSelect: (event: CustomEvent<{ selected: boolean }>) => {
    const value = (event.target as HTMLElement | null)?.dataset?.topic;
    if (!value) return;
    topic.value = event.detail.selected ? value : null;
  },
};

const clearListeners = {
  mdClick: () => {
    topic.value = null;
    search.value = '';
  },
};
</script>

<template>
  <Screen :title="t('social.screen.explore.title')" :subtitle="t('social.screen.explore.subtitle')">
    <template #aside><Count :value="tiles.length" /></template>
    <template #skeleton><PanelSkeleton height="720px" /></template>

    <Panel :title="t('social.panel.topics')">
      <div class="stack">
        <!-- The wrapper is what makes it fill the panel: `md-search` carries a
             360px minimum and a 720px maximum and centres itself in a wider
             parent, so `full-width` alone left it marooned in the middle. -->
        <div class="explore-search">
          <md-search
            v-awc="{ on: searchListeners }"
            layout="docked"
            trigger="bar"
            variant="contained"
            full-width
            debounce="250"
            :label="t('social.action.search')"
            :placeholder="t('social.count.people')"
            :value="search"
          ></md-search>
        </div>

        <div v-awc="{ on: facetListeners }" class="facet-row">
          <TopicChip
            v-for="facet in facets"
            :key="facet.id"
            :id="facet.id"
            :selected="topic === facet.id"
          />
        </div>

        <div class="row row--between facet-foot">
          <span class="muted">
            {{ t('social.common.showing', { shown: tiles.length, total: totals.feedCount }) }}
          </span>
          <!-- The reset exists only while there is something to reset; a
               permanently-inert control in a filter bar is furniture. -->
          <md-button
            v-if="filtered"
            v-awc="{ on: clearListeners }"
            variant="text"
            size="sm"
            icon="restart_alt"
          >
            {{ t('social.action.clearFilters') }}
          </md-button>
        </div>
      </div>
    </Panel>

    <EmptyState
      v-if="tiles.length === 0"
      :message="t('social.empty.explore')"
      :hint="t('social.empty.exploreHint')"
    />
    <ul v-else class="explore-grid">
      <li
        v-for="tile in tiles"
        :key="tile.post.id"
        class="explore-tile"
        :data-span="tile.span === 2 ? '2' : undefined"
      >
        <!-- The link's accessible name is the picture's alt plus whose it is. A
             grid of forty links all named "Post" is one a screen reader cannot
             navigate. -->
        <Drill
          link-class="explore-tile__link"
          :to="route.post(tile.post.id)"
          :aria-label="`${t(tile.post.media[0].altKey)} — ${tile.author.displayName}`"
        >
          <Media :media="tile.post.media[0]" class-name="explore-tile__img" />
          <span
            v-if="postKindIcon[tile.post.kind]"
            class="explore-tile__badge on-media material-symbols-outlined"
            aria-hidden="true"
          >{{ postKindIcon[tile.post.kind] }}</span>
        </Drill>
      </li>
    </ul>
  </Screen>
</template>
