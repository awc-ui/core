<!--
  Studio — the projects, and the arrangement of whichever one is open.

  THERE IS NO PROJECTS INDEX SCREEN. Studio IS the list of projects with one
  open, which is what an even five-destination split leaves room for and is also
  how arrangement software opens.

  The toolbar's edits are the SAME operations the drag performs, and both go
  through `clipFits` in the kit — so a button cannot put a clip somewhere a drag
  would refuse to.
-->
<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  canRedo,
  canUndo,
  clipFits,
  currentProject,
  editIcon,
  getProjects,
  nextRedo,
  nextUndo,
  projectBySlug,
  projectClips,
  projectStateIcon,
  projectStateTone,
  projectTracks,
  trackClips,
  type Clip,
} from '@awc-ui/showcase-kit/music';
import { useT } from '~/composables/useShowcase';
import { usePlayer } from '~/composables/usePlayer';
import { useSnackbar } from '~/components/screens/useSnackbar';
import { route, withBase } from '~/lib/routes';
import Screen from '~/components/Screen.vue';
import Panel from '~/components/Panel.vue';
import Count from '~/components/bits/Count.vue';
import Art from '~/components/bits/Art.vue';
import DateText from '~/components/bits/DateText.vue';
import Timeline from '~/components/screens/Timeline.vue';
import EmptyState from '~/components/screens/EmptyState.vue';
import NotFoundScreen from '~/components/screens/NotFoundScreen.vue';
import StudioSkeleton from '~/components/skeletons/StudioSkeleton.vue';
import Drill from '~/components/Drill.vue';

const props = defineProps<{ slug?: string }>();
const t = useT();
const player = usePlayer();
const { say } = useSnackbar();

const zoom = ref<'sm' | 'md' | 'lg'>('md');
const ZOOMS = ['sm', 'md', 'lg'] as const;
const selected = ref<string | null>(null);

const project = computed(() => (props.slug ? projectBySlug(props.slug) : currentProject()));
const projects = getProjects();

const tracks = computed(() =>
  project.value
    ? projectTracks(project.value).map(
        (track) => player.tracks.value.find((t2) => t2.id === track.id) ?? track,
      )
    : [],
);
const clips = computed(() =>
  project.value ? projectClips(project.value).filter((c) => !player.clipRemoved(c.id)) : [],
);
const selectedClip = computed(() => clips.value.find((c) => c.id === selected.value) ?? null);

const laneOf = (clip: Clip) =>
  trackClips(clip.trackId)
    .filter((c) => !player.clipRemoved(c.id))
    .map((c) => ({
      id: c.id,
      startBar: player.clipStart(c.id, c.startBar),
      bars: player.clipBars(c.id, c.bars),
    }));

function nudge(clip: Clip, delta: number) {
  if (!project.value) return;
  const from = player.clipStart(clip.id, clip.startBar);
  const bars = player.clipBars(clip.id, clip.bars);
  if (!clipFits(laneOf(clip), clip.id, from + delta, bars, project.value.bars)) return;
  player.moveClip(clip.id, clip.startBar, from + delta);
  say('music.msg.clipMoved', { name: t.value(clip.labelKey) });
}

function stretch(clip: Clip, delta: number) {
  if (!project.value) return;
  const from = player.clipStart(clip.id, clip.startBar);
  const bars = player.clipBars(clip.id, clip.bars) + delta;
  if (bars < 1 || !clipFits(laneOf(clip), clip.id, from, bars, project.value.bars)) return;
  player.resizeClip(clip.id, clip.bars, bars);
  say('music.msg.clipResized', { name: t.value(clip.labelKey) });
}

function drop(clip: Clip) {
  player.removeClip(clip.id);
  selected.value = null;
  say('music.msg.clipRemoved', { name: t.value(clip.labelKey) });
}

const undoable = computed(() => canUndo(player.history.value));
const redoable = computed(() => canRedo(player.history.value));
const pendingUndo = computed(() => nextUndo(player.history.value));
const pendingRedo = computed(() => nextRedo(player.history.value));

function doUndo() {
  const edit = player.undo();
  say(edit ? 'music.msg.undone' : 'music.msg.nothingToUndo', { name: edit ? t.value(edit.labelKey) : '' });
}
function doRedo() {
  const edit = player.redo();
  say(edit ? 'music.msg.redone' : 'music.msg.nothingToRedo', { name: edit ? t.value(edit.labelKey) : '' });
}
</script>

<template>
  <NotFoundScreen v-if="!project" />
  <Screen
    v-else
    :title="t('music.screen.studio.title')"
    :subtitle="t('music.screen.studio.subtitle')"
    :crumb-label="project.title"
  >
    <template #aside><Count :value="projects.length" /></template>
    <template #skeleton><StudioSkeleton /></template>

    <div class="stack">
      <Panel>
        <div class="studio-head">
          <div class="studio-head__facts">
            <Art :art="project.art" class-name="project-card__art" eager />
            <div class="project-card__text">
              <h2 class="release-head__title">{{ project.title }}</h2>
              <div class="row">
                <md-chip
                  variant="assist"
                  appearance="outlined"
                  :color="projectStateTone[project.state]"
                  :icon="projectStateIcon[project.state]"
                  :label="t(project.stateKey)"
                />
                <span class="person-row__meta">{{ project.bpm }} {{ t('music.label.bpm') }}</span>
                <span class="person-row__meta">{{ project.bars }} {{ t('music.label.bars') }}</span>
                <span class="person-row__meta">{{ t('music.hint.updated', { date: '' }) }}<DateText :at="project.updatedAt" /></span>
              </div>
            </div>
          </div>

          <div class="studio-head__tools">
            <!-- Undo NAMES what it will reverse. "Undo" alone makes a reader
                 press it to find out. -->
            <md-button
              class="studio__undo"
              variant="text"
              icon="undo"
              size="sm"
              :soft-disabled="!undoable || undefined"
              :aria-label="pendingUndo ? `${t('music.action.undo')}: ${t(pendingUndo.labelKey)}` : t('music.action.undo')"
              @click="doUndo()"
            >{{ t('music.action.undo') }}</md-button>
            <md-button
              class="studio__redo"
              variant="text"
              icon="redo"
              size="sm"
              :soft-disabled="!redoable || undefined"
              :aria-label="pendingRedo ? `${t('music.action.redo')}: ${t(pendingRedo.labelKey)}` : t('music.action.redo')"
              @click="doRedo()"
            >{{ t('music.action.redo') }}</md-button>
            <md-icon-button
              class="studio__zoom-out"
              icon="zoom_out"
              size="sm"
              :soft-disabled="zoom === 'sm' || undefined"
              :aria-label="t('music.action.zoomOut')"
              @click="zoom = ZOOMS[Math.max(0, ZOOMS.indexOf(zoom) - 1)]"
            />
            <md-icon-button
              class="studio__zoom-in"
              icon="zoom_in"
              size="sm"
              :soft-disabled="zoom === 'lg' || undefined"
              :aria-label="t('music.action.zoomIn')"
              @click="zoom = ZOOMS[Math.min(ZOOMS.length - 1, ZOOMS.indexOf(zoom) + 1)]"
            />
          </div>
        </div>
      </Panel>

      <Panel :title="t('music.panel.arrangement')" :subtitle="t('music.hint.editing')">
        <template #actions>
          <span class="row">
            <Count :value="clips.length" />
            <template v-if="selectedClip">
              <md-icon-button
                class="studio__nudge-back"
                icon="chevron_left"
                size="sm"
                :aria-label="`${t('music.edit.clipMove')}: ${t(selectedClip.labelKey)}`"
                @click="nudge(selectedClip, -1)"
              />
              <md-icon-button
                class="studio__nudge-forward"
                icon="chevron_right"
                size="sm"
                :aria-label="`${t('music.edit.clipMove')}: ${t(selectedClip.labelKey)}`"
                @click="nudge(selectedClip, 1)"
              />
              <md-icon-button
                class="studio__shrink"
                icon="compress"
                size="sm"
                :aria-label="`${t('music.edit.clipResize')}: ${t(selectedClip.labelKey)}`"
                @click="stretch(selectedClip, -1)"
              />
              <md-icon-button
                class="studio__grow"
                icon="expand"
                size="sm"
                :aria-label="`${t('music.edit.clipResize')}: ${t(selectedClip.labelKey)}`"
                @click="stretch(selectedClip, 1)"
              />
              <md-icon-button
                class="studio__delete"
                icon="delete"
                size="sm"
                color="error"
                :aria-label="`${t('music.edit.clipRemove')}: ${t(selectedClip.labelKey)}`"
                @click="drop(selectedClip)"
              />
            </template>
          </span>
        </template>

        <Timeline
          :project="project"
          :tracks="tracks"
          :zoom="zoom"
          :selected-clip-id="selected"
          @select="(clip) => (selected = clip === null ? null : clip.id)"
          @message="(k, p) => say(k, p)"
        />
      </Panel>

      <Panel :title="t('music.panel.history')">
        <template #actions><Count :value="player.history.value.done.length" /></template>
        <EmptyState
          v-if="player.history.value.done.length === 0 && player.history.value.undone.length === 0"
          :message="t('music.empty.history')"
        />
        <div v-else class="stack">
          <div v-for="edit in player.history.value.done" :key="edit.id" class="history-row">
            <span class="material-symbols-outlined" aria-hidden="true">{{ editIcon[edit.kind] }}</span>
            <span>{{ t(edit.labelKey) }}</span>
          </div>
          <!-- An undone edit is still listed — it is what redo will reapply. -->
          <div v-for="edit in player.history.value.undone" :key="edit.id" class="history-row" data-undone="">
            <span class="material-symbols-outlined" aria-hidden="true">{{ editIcon[edit.kind] }}</span>
            <span>{{ t(edit.labelKey) }}</span>
          </div>
        </div>
      </Panel>

      <Panel :title="t('music.panel.projects')">
        <template #actions><Count :value="projects.length" /></template>
        <div class="stack">
          <Drill
            v-for="other in projects"
            :key="other.id"
            link-class="project-card"
            :to="route.project(other.slug)"
            :data-current="other.id === project.id ? '' : undefined"
            :data-project="other.slug"
          >
            <Art :art="other.art" class-name="project-card__art" />
            <span class="project-card__text">
              <span class="track-row__title">{{ other.title }}</span>
              <span class="track-row__meta">{{ t(other.stateKey) }} · {{ other.bars }} {{ t('music.label.bars') }}</span>
            </span>
          </Drill>
        </div>
      </Panel>
    </div>
  </Screen>
</template>
