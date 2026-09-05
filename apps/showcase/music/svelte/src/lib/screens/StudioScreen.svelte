<!--
  Studio — the projects, and the arrangement of whichever one is open.

  There is no projects index screen: Studio IS the list with one open. The
  toolbar's edits are the SAME operations the drag performs, and both go through
  `clipFits` in the kit, so a button cannot put a clip where a drag would not.
-->
<script lang="ts">
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
  import { t } from '$lib/showcase';
  import { route } from '$lib/routes';
  import {
    player, clipStart, clipBars, clipRemoved, moveClip, resizeClip, removeClip, undo, redo,
  } from '$lib/player';
  import { say } from '$lib/snackbar';
  import Screen from '$lib/components/Screen.svelte';
  import Panel from '$lib/components/Panel.svelte';
  import Drill from '$lib/components/Drill.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import Timeline from '$lib/components/Timeline.svelte';
  import Count from '$lib/bits/Count.svelte';
  import Art from '$lib/bits/Art.svelte';
  import DateText from '$lib/bits/DateText.svelte';
  import NotFoundScreen from '$lib/screens/NotFoundScreen.svelte';
  import StudioSkeleton from '$lib/skeletons/StudioSkeleton.svelte';

  export let slug: string | undefined = undefined;

  const ZOOMS = ['sm', 'md', 'lg'] as const;
  let zoom: 'sm' | 'md' | 'lg' = 'md';
  let selected: string | null = null;

  $: project = slug ? projectBySlug(slug) : currentProject();
  const projects = getProjects();

  $: tracks = project
    ? projectTracks(project).map((track) => $player.tracks.find((x) => x.id === track.id) ?? track)
    : [];
  $: clips = project ? projectClips(project).filter((c) => !clipRemoved($player, c.id)) : [];
  $: selectedClip = clips.find((c) => c.id === selected) ?? null;

  const laneOf = (clip: Clip) =>
    trackClips(clip.trackId)
      .filter((c) => !clipRemoved($player, c.id))
      .map((c) => ({
        id: c.id,
        startBar: clipStart($player, c.id, c.startBar),
        bars: clipBars($player, c.id, c.bars),
      }));

  function nudge(clip: Clip, delta: number) {
    if (!project) return;
    const from = clipStart($player, clip.id, clip.startBar);
    const bars = clipBars($player, clip.id, clip.bars);
    if (!clipFits(laneOf(clip), clip.id, from + delta, bars, project.bars)) return;
    moveClip(clip.id, clip.startBar, from + delta);
    say('music.msg.clipMoved', { name: $t(clip.labelKey) });
  }

  function stretch(clip: Clip, delta: number) {
    if (!project) return;
    const from = clipStart($player, clip.id, clip.startBar);
    const bars = clipBars($player, clip.id, clip.bars) + delta;
    if (bars < 1 || !clipFits(laneOf(clip), clip.id, from, bars, project.bars)) return;
    resizeClip(clip.id, clip.bars, bars);
    say('music.msg.clipResized', { name: $t(clip.labelKey) });
  }

  function drop(clip: Clip) {
    removeClip(clip.id);
    selected = null;
    say('music.msg.clipRemoved', { name: $t(clip.labelKey) });
  }

  function doUndo() {
    const edit = undo();
    say(edit ? 'music.msg.undone' : 'music.msg.nothingToUndo', { name: edit ? $t(edit.labelKey) : '' });
  }
  function doRedo() {
    const edit = redo();
    say(edit ? 'music.msg.redone' : 'music.msg.nothingToRedo', { name: edit ? $t(edit.labelKey) : '' });
  }
</script>

{#if !project}
  <NotFoundScreen />
{:else}
  <!-- The trail names the project: `crumbsFor` puts a proper-noun crumb last
       for a project path, and without a label React rendered a blank crumb and
       this build rendered the string "null". -->
  <Screen
    title={$t('music.screen.studio.title')}
    subtitle={$t('music.screen.studio.subtitle')}
    crumbLabel={project.title}
  >
    <Count slot="aside" value={projects.length} />
    <StudioSkeleton slot="skeleton" />

    <div class="stack">
      <Panel>
        <div class="studio-head">
          <div class="studio-head__facts">
            <Art art={project.art} className="project-card__art" eager />
            <div class="project-card__text">
              <h2 class="release-head__title">{project.title}</h2>
              <div class="row">
                <md-chip
                  variant="assist"
                  appearance="outlined"
                  color={projectStateTone[project.state]}
                  icon={projectStateIcon[project.state]}
                  label={$t(project.stateKey)}
                ></md-chip>
                <span class="person-row__meta">{project.bpm} {$t('music.label.bpm')}</span>
                <span class="person-row__meta">{project.bars} {$t('music.label.bars')}</span>
                <span class="person-row__meta">{$t('music.hint.updated', { date: '' })}<DateText at={project.updatedAt} /></span>
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
              soft-disabled={!canUndo($player.history) || undefined}
              aria-label={nextUndo($player.history)
                ? `${$t('music.action.undo')}: ${$t(nextUndo($player.history)?.labelKey ?? '')}`
                : $t('music.action.undo')}
              on:click={doUndo}
            >{$t('music.action.undo')}</md-button>
            <md-button
              class="studio__redo"
              variant="text"
              icon="redo"
              size="sm"
              soft-disabled={!canRedo($player.history) || undefined}
              aria-label={nextRedo($player.history)
                ? `${$t('music.action.redo')}: ${$t(nextRedo($player.history)?.labelKey ?? '')}`
                : $t('music.action.redo')}
              on:click={doRedo}
            >{$t('music.action.redo')}</md-button>
            <md-icon-button
              class="studio__zoom-out"
              icon="zoom_out"
              size="sm"
              soft-disabled={zoom === 'sm' || undefined}
              aria-label={$t('music.action.zoomOut')}
              on:click={() => (zoom = ZOOMS[Math.max(0, ZOOMS.indexOf(zoom) - 1)])}
            ></md-icon-button>
            <md-icon-button
              class="studio__zoom-in"
              icon="zoom_in"
              size="sm"
              soft-disabled={zoom === 'lg' || undefined}
              aria-label={$t('music.action.zoomIn')}
              on:click={() => (zoom = ZOOMS[Math.min(ZOOMS.length - 1, ZOOMS.indexOf(zoom) + 1)])}
            ></md-icon-button>
          </div>
        </div>
      </Panel>

      <Panel title={$t('music.panel.arrangement')} subtitle={$t('music.hint.editing')}>
        <span class="row" slot="actions">
          <Count value={clips.length} />
          {#if selectedClip}
            <md-icon-button class="studio__nudge-back" icon="chevron_left" size="sm"
              aria-label={`${$t('music.edit.clipMove')}: ${$t(selectedClip.labelKey)}`}
              on:click={() => selectedClip && nudge(selectedClip, -1)}></md-icon-button>
            <md-icon-button class="studio__nudge-forward" icon="chevron_right" size="sm"
              aria-label={`${$t('music.edit.clipMove')}: ${$t(selectedClip.labelKey)}`}
              on:click={() => selectedClip && nudge(selectedClip, 1)}></md-icon-button>
            <md-icon-button class="studio__shrink" icon="compress" size="sm"
              aria-label={`${$t('music.edit.clipResize')}: ${$t(selectedClip.labelKey)}`}
              on:click={() => selectedClip && stretch(selectedClip, -1)}></md-icon-button>
            <md-icon-button class="studio__grow" icon="expand" size="sm"
              aria-label={`${$t('music.edit.clipResize')}: ${$t(selectedClip.labelKey)}`}
              on:click={() => selectedClip && stretch(selectedClip, 1)}></md-icon-button>
            <md-icon-button class="studio__delete" icon="delete" size="sm" color="error"
              aria-label={`${$t('music.edit.clipRemove')}: ${$t(selectedClip.labelKey)}`}
              on:click={() => selectedClip && drop(selectedClip)}></md-icon-button>
          {/if}
        </span>

        <Timeline
          {project}
          {tracks}
          {zoom}
          selectedClipId={selected}
          on:select={(event) => (selected = event.detail === null ? null : event.detail.id)}
          on:message={(event) => say(event.detail.key, event.detail.params)}
        />
      </Panel>

      <Panel title={$t('music.panel.history')}>
        <Count slot="actions" value={$player.history.done.length} />
        {#if $player.history.done.length === 0 && $player.history.undone.length === 0}
          <EmptyState message={$t('music.empty.history')} />
        {:else}
          <div class="stack">
            {#each $player.history.done as edit (edit.id)}
              <div class="history-row">
                <span class="material-symbols-outlined" aria-hidden="true">{editIcon[edit.kind]}</span>
                <span>{$t(edit.labelKey)}</span>
              </div>
            {/each}
            <!-- An undone edit is still listed — it is what redo will reapply. -->
            {#each $player.history.undone as edit (edit.id)}
              <div class="history-row" data-undone="">
                <span class="material-symbols-outlined" aria-hidden="true">{editIcon[edit.kind]}</span>
                <span>{$t(edit.labelKey)}</span>
              </div>
            {/each}
          </div>
        {/if}
      </Panel>

      <Panel title={$t('music.panel.projects')}>
        <Count slot="actions" value={projects.length} />
        <div class="stack">
          {#each projects as other (other.id)}
            <Drill
              linkClass="project-card"
              href={route.project(other.slug)}
              data-current={other.id === project.id ? '' : undefined}
              data-project={other.slug}
            >
              <Art art={other.art} className="project-card__art" />
              <span class="project-card__text">
                <span class="track-row__title">{other.title}</span>
                <span class="track-row__meta">{$t(other.stateKey)} · {other.bars} {$t('music.label.bars')}</span>
              </span>
            </Drill>
          {/each}
        </div>
      </Panel>
    </div>
  </Screen>
{/if}
