<!--
  The arrangement: a ruler, a lane per track, and clips placed in whole bars.

  NOT ONE PIXEL OFFSET IS COMPUTED HERE. `style-src-attr 'none'` forbids the
  `style` attribute the usual `left: 340px` technique needs, so a lane is a CSS
  grid with one column per bar and a clip declares `data-start`/`data-span`.

  DRAGGING REWRITES THOSE TWO NUMBERS. There is no ghost and no transform: the
  clip moves a whole bar at a time because the grid re-places it the instant
  `data-start` changes, which makes the snap a property of the layout and is why
  every build drags identically — each writes one integer.

  EVERY EDIT HAS A KEYBOARD PATH. A timeline editable only with a mouse is one
  half the people who need it cannot use.
-->
<script lang="ts">
  import {
    barsMoved,
    clipFits,
    placeClip,
    playheadBar,
    rulerTicks,
    trackClips,
    type Clip,
    type Project,
    type StudioTrack,
  } from '@awc-ui/showcase-kit/music';
  import { t } from '$lib/showcase';
  import { player, clipStart, clipBars, clipRemoved, moveClip, resizeClip, removeClip } from '$lib/player';
  import Peaks from '$lib/bits/Peaks.svelte';
  import LaneName from '$lib/components/LaneName.svelte';
  import { createEventDispatcher } from 'svelte';

  export let project: Project;
  export let tracks: readonly StudioTrack[];
  export let zoom: 'sm' | 'md' | 'lg';
  export let selectedClipId: string | null;

  const dispatch = createEventDispatcher<{
    select: Clip | null;
    message: { key: string; params?: Record<string, string | number> };
  }>();

  interface Drag {
    clipId: string;
    mode: 'move' | 'resize';
    originX: number;
    fromStart: number;
    fromBars: number;
    laneWidth: number;
  }
  let drag: Drag | null = null;
  /* A DRAG IS FOLLOWED BY A CLICK, AND THAT CLICK HAS TO BE SWALLOWED — but the
   flag is keyed to the CLIP, not a bare boolean. `pointerup` at the end of a
   gesture is normally followed by a synthetic `click` on the same element, and
   a boolean flag assumes that click always arrives to consume it. It does not:
   with pointer capture the click is sometimes dispatched somewhere the handler
   never sees, and the flag then sat true and swallowed the NEXT click — on a
   different clip, which had nothing to do with the drag. Keying it to the id
   means a stale flag can only ever affect the clip that was dragged. */
  let swallowClick: string | null = null;

  const geometry = (clip: Clip) => ({
    startBar: clipStart($player, clip.id, clip.startBar),
    bars: clipBars($player, clip.id, clip.bars),
  });

  const laneOf = (trackId: string) =>
    trackClips(trackId)
      .filter((c) => !clipRemoved($player, c.id))
      .map((c) => ({ id: c.id, ...geometry(c) }));

  const visibleClips = (trackId: string) =>
    trackClips(trackId).filter((clip) => !clipRemoved($player, clip.id));

  function onPointerDown(event: PointerEvent, clip: Clip, mode: Drag['mode']) {
    /* Secondary buttons do not drag: a right-click that started a move would
       leave the clip following the pointer with no button held down. */
    if (event.button !== 0) return;
    const target = event.currentTarget as HTMLElement;
    const lane = target.closest('.lane');
    if (!lane) return;
    /* Pointer capture, so the gesture survives the pointer leaving the clip —
       which it does at once, the clip being a few bars wide. */
    target.setPointerCapture(event.pointerId);
    event.preventDefault();
    const here = geometry(clip);
    drag = {
      clipId: clip.id,
      mode,
      originX: event.clientX,
      fromStart: here.startBar,
      fromBars: here.bars,
      laneWidth: lane.getBoundingClientRect().width,
    };
    dispatch('select', clip);
  }

  function onPointerMove(event: PointerEvent, clip: Clip) {
    if (!drag || drag.clipId !== clip.id) return;
    /* RTL reads right to left, so a drag towards the start of the timeline is a
       drag to the RIGHT. Without this the arrangement runs backwards in
       Arabic. */
    const rtl = document.documentElement.dir === 'rtl';
    const delta = (event.clientX - drag.originX) * (rtl ? -1 : 1);
    const moved = barsMoved(delta, drag.laneWidth, project.bars);
    if (moved === 0) return;

    const others = laneOf(clip.trackId);
    if (drag.mode === 'move') {
      const nextBar = drag.fromStart + moved;
      if (nextBar === geometry(clip).startBar) return;
      if (!clipFits(others, clip.id, nextBar, drag.fromBars, project.bars)) return;
      moveClip(clip.id, clip.startBar, nextBar);
    } else {
      const nextBars = drag.fromBars + moved;
      if (nextBars < 1 || nextBars === geometry(clip).bars) return;
      if (!clipFits(others, clip.id, drag.fromStart, nextBars, project.bars)) return;
      resizeClip(clip.id, clip.bars, nextBars);
    }
  }

  function endDrag(event: PointerEvent, clip: Clip) {
    if (!drag || drag.clipId !== clip.id) return;
    const target = event.currentTarget as HTMLElement;
    if (target.hasPointerCapture(event.pointerId)) target.releasePointerCapture(event.pointerId);
    const here = geometry(clip);
    const mode = drag.mode;
    const changed = mode === 'move' ? here.startBar !== drag.fromStart : here.bars !== drag.fromBars;
    drag = null;
    /* Only a gesture that ACTUALLY moved something swallows its click; a press
       that never left its bar is a plain click and must still select. */
    swallowClick = changed ? clip.id : null;
    /* One message per gesture, not per bar crossed. */
    if (changed) {
      dispatch('message', {
        key: mode === 'move' ? 'music.msg.clipMoved' : 'music.msg.clipResized',
        params: { name: $t(clip.labelKey) },
      });
    }
  }

  function onKeyDown(event: KeyboardEvent, clip: Clip) {
    const here = geometry(clip);
    const others = laneOf(clip.trackId);
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;

    if (step !== 0) {
      event.preventDefault();
      /* Shift turns the arrows from "move" into "resize" — the shortcut every
         arrangement editor uses, at no extra control. */
      if (event.shiftKey) {
        const bars = here.bars + step;
        if (bars >= 1 && clipFits(others, clip.id, here.startBar, bars, project.bars)) {
          resizeClip(clip.id, clip.bars, bars);
          dispatch('message', { key: 'music.msg.clipResized', params: { name: $t(clip.labelKey) } });
        }
        return;
      }
      const startBar = here.startBar + step;
      if (clipFits(others, clip.id, startBar, here.bars, project.bars)) {
        moveClip(clip.id, clip.startBar, startBar);
        dispatch('message', { key: 'music.msg.clipMoved', params: { name: $t(clip.labelKey) } });
      }
      return;
    }

    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      removeClip(clip.id);
      dispatch('select', null);
      dispatch('message', { key: 'music.msg.clipRemoved', params: { name: $t(clip.labelKey) } });
    }
  }

  function onClipClick(clip: Clip) {
    if (swallowClick === clip.id) {
      swallowClick = null;
      return;
    }
    swallowClick = null;
    dispatch('select', clip.id === selectedClipId ? null : clip);
  }
</script>

<div class="lanes">
  <div class="lane-names">
    <div class="lane-names__pad"></div>
    {#each tracks as track (track.id)}
      <LaneName {track} on:message />
    {/each}
  </div>

  <div class="timeline" data-zoom={zoom}>
    <div class="timeline__inner">
      <div class="ruler" data-bars={project.bars}>
        {#each rulerTicks(project.bars) as tick (tick.bar)}
          <span
            class="ruler__tick"
            data-start={tick.bar}
            data-span={1}
            data-labelled={tick.labelled ? '' : undefined}
          >{#if tick.labelled}<span class="ruler__label">{tick.bar}</span>{/if}</span>
        {/each}
      </div>

      {#each tracks as track (track.id)}
        <div class="lane" data-bars={project.bars} data-kind={track.kind}>
          {#each visibleClips(track.id) as clip (clip.id)}
            {@const placement = placeClip({ ...clip, ...geometry(clip) }, project.bars)}
            <div
              class="clip"
              role="button"
              tabindex="0"
              data-clip={clip.id}
              data-start={placement.startBar}
              data-span={placement.bars}
              data-selected={clip.id === selectedClipId ? '' : undefined}
              data-dragging={drag?.clipId === clip.id ? drag.mode : undefined}
              data-kind={clip.kind}
              aria-label={`${$t(clip.labelKey)}, ${$t('music.label.bar')} ${placement.startBar}, ${placement.bars} ${$t('music.label.bars')}`}
              aria-pressed={clip.id === selectedClipId ? 'true' : 'false'}
              on:pointerdown={(event) => onPointerDown(event, clip, 'move')}
              on:pointermove={(event) => onPointerMove(event, clip)}
              on:pointerup={(event) => endDrag(event, clip)}
              on:pointercancel={(event) => endDrag(event, clip)}
              on:keydown={(event) => onKeyDown(event, clip)}
              on:click={() => onClipClick(clip)}
            >
              <span class="clip__label">{$t(clip.labelKey)}</span>
              <Peaks peaks={clip.peaks} />
              <!-- A separate pointer target on the trailing edge. It stops
                   propagation so grabbing it never starts a move. -->
              <span
                class="clip__resize"
                aria-hidden="true"
                on:pointerdown|stopPropagation={(event) => onPointerDown(event, clip, 'resize')}
                on:pointermove={(event) => onPointerMove(event, clip)}
                on:pointerup={(event) => endDrag(event, clip)}
                on:pointercancel={(event) => endDrag(event, clip)}
              ></span>
            </div>
          {/each}
          <!-- A grid item in the column `playheadBar()` returns, the same
               one-based counting the clips use, so it cannot drift. -->
          <span
            class="playhead"
            data-start={playheadBar($player.transport.positionSec, project.bars)}
            data-span={1}
            aria-hidden="true"
          ></span>
        </div>
      {/each}
    </div>
  </div>
</div>
