<!--
  A lane's name, renameable in place. A double-click opens it and so does Enter
  — a rename reachable only by double-click is one most people never find and
  some cannot perform at all.
-->
<script lang="ts">
  import { tick as nextTick } from 'svelte';
  import { trackIcon, type StudioTrack } from '@awc-ui/showcase-kit/music';
  import { t } from '$lib/showcase';
  import { renameTrack } from '$lib/player';
  import { createEventDispatcher } from 'svelte';

  export let track: StudioTrack;
  const dispatch = createEventDispatcher<{
    message: { key: string; params?: Record<string, string | number> };
  }>();

  let editing = false;
  let draft = track.name;
  let field: HTMLInputElement | null = null;

  async function open() {
    draft = track.name;
    editing = true;
    await nextTick();
    field?.focus();
  }

  function commit() {
    editing = false;
    if (draft.trim() !== '' && draft !== track.name) {
      renameTrack(track.id, draft.trim());
      dispatch('message', { key: 'music.msg.trackRenamed', params: { name: draft.trim() } });
    }
  }
</script>

{#if editing}
  <div class="lane-name">
    <input
      bind:this={field}
      bind:value={draft}
      class="lane-name__input"
      aria-label={`${$t('music.edit.trackRename')}: ${track.name}`}
      on:blur={commit}
      on:keydown={(event) => {
        if (event.key === 'Enter') commit();
        /* Escape abandons rather than committing a half-typed name, which is
           what a blur would otherwise do. */
        if (event.key === 'Escape') {
          draft = track.name;
          editing = false;
        }
      }}
    />
  </div>
{:else}
  <div
    class="lane-name"
    role="button"
    tabindex="0"
    data-track={track.id}
    aria-label={`${$t('music.edit.trackRename')}: ${track.name}`}
    on:dblclick={open}
    on:keydown={(event) => event.key === 'Enter' && open()}
  >
    <span class="material-symbols-outlined" aria-hidden="true">{trackIcon[track.kind]}</span>
    <span class="lane-name__text">{track.name}</span>
  </div>
{/if}
