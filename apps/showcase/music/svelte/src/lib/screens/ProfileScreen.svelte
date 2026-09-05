<!--
  Profile — the reader's own listening, playlists and projects.

  IT ALSO CARRIES THE QUEUE, the one place the whole of it is visible: the
  transport shows what is loaded, this shows what follows.
-->
<script lang="ts">
  import {
    artistById, getProjects, getTotals, getViewer, likedTracks, ownPlaylists, trackById, upNext,
  } from '@awc-ui/showcase-kit/music';
  import { t } from '$lib/showcase';
  import { route } from '$lib/routes';
  import { player } from '$lib/player';
  import Screen from '$lib/components/Screen.svelte';
  import Panel from '$lib/components/Panel.svelte';
  import Drill from '$lib/components/Drill.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import Count from '$lib/bits/Count.svelte';
  import Art from '$lib/bits/Art.svelte';
  import TrackList from '$lib/bits/TrackList.svelte';
  import PlaylistCard from '$lib/bits/PlaylistCard.svelte';
  import ProfileSkeleton from '$lib/skeletons/ProfileSkeleton.svelte';

  const viewer = getViewer();
  const totals = getTotals();
  const liked = likedTracks(6);
  const playlists = ownPlaylists();
  const projects = getProjects();

  /* The whole remaining queue, not the transport's five-row preview. */
  $: queue = upNext($player.transport, 50)
    .map((id) => trackById(id))
    .filter((x): x is NonNullable<typeof x> => x !== null);
</script>

<Screen title={$t('music.screen.profile.title')} subtitle={$t('music.screen.profile.subtitle')}>
  <Count slot="aside" value={totals.likedTracks} />
  <ProfileSkeleton slot="skeleton" />

  <div class="stack">
    <Panel>
      <div class="release-head">
        <Art art={viewer.art} className="release-head__art" eager />
        <div class="release-head__text">
          <h2 class="release-head__title">{viewer.displayName}</h2>
          <p class="person-row__meta">@{viewer.handle}</p>
          <div class="stat-row">
            <div><dt>{$t('music.panel.liked')}</dt><dd><Count value={totals.likedTracks} /></dd></div>
            <div><dt>{$t('music.panel.yourPlaylists')}</dt><dd><Count value={playlists.length} /></dd></div>
            <div><dt>{$t('music.panel.projects')}</dt><dd><Count value={totals.projects} /></dd></div>
            <div><dt>{$t('music.label.minutes')}</dt><dd><Count value={totals.listeningMinutes} compact /></dd></div>
          </div>
        </div>
      </div>
    </Panel>

    <Panel title={$t('music.panel.queue')}>
      <Count slot="actions" value={queue.length} />
      {#if queue.length === 0}
        <EmptyState message={$t('music.empty.queue')} />
      {:else}
        <div class="stack">
          {#each queue as track, at (track.id)}
            <div class="queue-row">
              <span class="queue-row__index">{at + 1}</span>
              <span class="track-row__text">
                <Drill linkClass="track-row__title link" href={route.track(track.id)}>{track.title}</Drill>
                <span class="track-row__meta">{artistById(track.artistId)?.name ?? ''}</span>
              </span>
            </div>
          {/each}
        </div>
      {/if}
    </Panel>

    <Panel title={$t('music.panel.liked')}>
      <Count slot="actions" value={liked.length} />
      {#if liked.length === 0}
        <EmptyState message={$t('music.empty.liked')} />
      {:else}
        <TrackList tracks={liked} showAlbum />
      {/if}
    </Panel>

    <Panel title={$t('music.panel.yourPlaylists')}>
      <Count slot="actions" value={playlists.length} />
      <div class="shelf">{#each playlists as playlist (playlist.id)}<PlaylistCard {playlist} />{/each}</div>
    </Panel>

    <Panel title={$t('music.panel.projects')}>
      <Count slot="actions" value={projects.length} />
      <div class="stack">
        {#each projects as project (project.id)}
          <Drill linkClass="project-card" href={route.project(project.slug)}>
            <Art art={project.art} className="project-card__art" />
            <span class="project-card__text">
              <span class="track-row__title">{project.title}</span>
              <span class="track-row__meta">{$t(project.stateKey)}</span>
            </span>
          </Drill>
        {/each}
      </div>
    </Panel>
  </div>
</Screen>
