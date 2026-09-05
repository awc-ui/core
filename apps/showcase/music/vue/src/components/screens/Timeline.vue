<!--
  The arrangement: a ruler, a lane per track, and clips placed in whole bars.

  NOT ONE PIXEL OFFSET IS COMPUTED HERE. The deployed policy is
  `style-src-attr 'none'`, so no element may carry a `style` attribute and the
  usual `left: 340px; width: 96px` technique is unavailable. A lane is a CSS
  grid with one column per bar; a clip declares `data-start` and `data-span`,
  and `app.css` places it.

  DRAGGING REWRITES THOSE TWO NUMBERS, which is why it survives the policy that
  rules out the usual approach. There is no ghost and no transform: the clip
  moves a whole bar at a time because the grid re-places it the instant
  `data-start` changes — the snap is a property of the layout rather than
  something the drag code draws, and it is why this build and the React one drag
  identically. Each is writing one integer.

  EVERY EDIT HAS A KEYBOARD PATH. A timeline that can only be edited with a
  mouse is a timeline half the people who need it cannot use.
-->
<script setup lang="ts">
import { ref } from 'vue';
import {
  barsMoved,
  clipFits,
  placeClip,
  playheadBar,
  rulerTicks,
  trackClips,
  trackIcon,
  type Clip,
  type Project,
  type StudioTrack,
} from '@awc-ui/showcase-kit/music';
import { useT } from '~/composables/useShowcase';
import { usePlayer } from '~/composables/usePlayer';
import Peaks from '~/components/bits/Peaks.vue';
import LaneName from '~/components/screens/LaneName.vue';

const props = defineProps<{
  project: Project;
  tracks: readonly StudioTrack[];
  zoom: 'sm' | 'md' | 'lg';
  selectedClipId: string | null;
}>();
const emit = defineEmits<{
  (e: 'select', clip: Clip | null): void;
  (e: 'message', key: string, params?: Record<string, string | number>): void;
}>();

const t = useT();
const player = usePlayer();

interface Drag {
  clipId: string;
  mode: 'move' | 'resize';
  originX: number;
  fromStart: number;
  fromBars: number;
  laneWidth: number;
}
const drag = ref<Drag | null>(null);
/* A DRAG IS FOLLOWED BY A CLICK, AND THAT CLICK HAS TO BE SWALLOWED — but the
   flag is keyed to the CLIP, not a bare boolean. `pointerup` at the end of a
   gesture is normally followed by a synthetic `click` on the same element, and
   a boolean flag assumes that click always arrives to consume it. It does not:
   with pointer capture the click is sometimes dispatched somewhere the handler
   never sees, and the flag then sat true and swallowed the NEXT click — on a
   different clip, which had nothing to do with the drag. Keying it to the id
   means a stale flag can only ever affect the clip that was dragged. */
const swallowClick = ref<string | null>(null);

const geometry = (clip: Clip) => ({
  startBar: player.clipStart(clip.id, clip.startBar),
  bars: player.clipBars(clip.id, clip.bars),
});

const laneOf = (trackId: string) =>
  trackClips(trackId)
    .filter((c) => !player.clipRemoved(c.id))
    .map((c) => ({ id: c.id, ...geometry(c) }));

const visibleClips = (trackId: string) =>
  trackClips(trackId).filter((clip) => !player.clipRemoved(clip.id));

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
  drag.value = {
    clipId: clip.id,
    mode,
    originX: event.clientX,
    fromStart: here.startBar,
    fromBars: here.bars,
    laneWidth: lane.getBoundingClientRect().width,
  };
  emit('select', clip);
}

function onPointerMove(event: PointerEvent, clip: Clip) {
  const current = drag.value;
  if (!current || current.clipId !== clip.id) return;

  /* RTL reads right to left, so a drag towards the start of the timeline is a
     drag to the RIGHT. Without this the arrangement runs backwards in Arabic. */
  const rtl = document.documentElement.dir === 'rtl';
  const delta = (event.clientX - current.originX) * (rtl ? -1 : 1);
  const moved = barsMoved(delta, current.laneWidth, props.project.bars);
  if (moved === 0) return;

  const others = laneOf(clip.trackId);
  if (current.mode === 'move') {
    const next = current.fromStart + moved;
    if (next === geometry(clip).startBar) return;
    if (!clipFits(others, clip.id, next, current.fromBars, props.project.bars)) return;
    player.moveClip(clip.id, clip.startBar, next);
  } else {
    const next = current.fromBars + moved;
    if (next < 1 || next === geometry(clip).bars) return;
    if (!clipFits(others, clip.id, current.fromStart, next, props.project.bars)) return;
    player.resizeClip(clip.id, clip.bars, next);
  }
}

function endDrag(event: PointerEvent, clip: Clip) {
  const current = drag.value;
  if (!current || current.clipId !== clip.id) return;
  const target = event.currentTarget as HTMLElement;
  if (target.hasPointerCapture(event.pointerId)) target.releasePointerCapture(event.pointerId);
  const here = geometry(clip);
  drag.value = null;

  const changed =
    current.mode === 'move' ? here.startBar !== current.fromStart : here.bars !== current.fromBars;
  /* Only a gesture that ACTUALLY moved something swallows its click; a press
     that never left its bar is a plain click and must still select. */
  swallowClick.value = changed ? clip.id : null;
  /* One message per gesture, not per bar crossed — the move is recorded bar by
     bar so undo stays fine-grained, but a snackbar per step would strobe. */
  if (changed) {
    emit('message', current.mode === 'move' ? 'music.msg.clipMoved' : 'music.msg.clipResized', {
      name: t.value(clip.labelKey),
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
       arrangement editor uses, and it costs no extra control. */
    if (event.shiftKey) {
      const bars = here.bars + step;
      if (bars >= 1 && clipFits(others, clip.id, here.startBar, bars, props.project.bars)) {
        player.resizeClip(clip.id, clip.bars, bars);
        emit('message', 'music.msg.clipResized', { name: t.value(clip.labelKey) });
      }
      return;
    }
    const startBar = here.startBar + step;
    if (clipFits(others, clip.id, startBar, here.bars, props.project.bars)) {
      player.moveClip(clip.id, clip.startBar, startBar);
      emit('message', 'music.msg.clipMoved', { name: t.value(clip.labelKey) });
    }
    return;
  }

  if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    player.removeClip(clip.id);
    emit('select', null);
    emit('message', 'music.msg.clipRemoved', { name: t.value(clip.labelKey) });
  }
}

function onClipClick(clip: Clip) {
  if (swallowClick.value === clip.id) {
    swallowClick.value = null;
    return;
  }
  swallowClick.value = null;
  emit('select', clip.id === props.selectedClipId ? null : clip);
}

const placementOf = (clip: Clip) => placeClip({ ...clip, ...geometry(clip) }, props.project.bars);
</script>

<template>
  <div class="lanes">
    <div class="lane-names">
      <div class="lane-names__pad" />
      <LaneName
        v-for="track in tracks"
        :key="track.id"
        :track="track"
        @message="(k, p) => emit('message', k, p)"
      />
    </div>

    <div class="timeline" :data-zoom="zoom">
      <div class="timeline__inner">
        <div class="ruler" :data-bars="project.bars">
          <span
            v-for="tick in rulerTicks(project.bars)"
            :key="tick.bar"
            class="ruler__tick"
            :data-start="tick.bar"
            :data-span="1"
            :data-labelled="tick.labelled ? '' : undefined"
          >
            <span v-if="tick.labelled" class="ruler__label">{{ tick.bar }}</span>
          </span>
        </div>

        <div
          v-for="track in tracks"
          :key="track.id"
          class="lane"
          :data-bars="project.bars"
          :data-kind="track.kind"
        >
          <div
            v-for="clip in visibleClips(track.id)"
            :key="clip.id"
            class="clip"
            role="button"
            :tabindex="0"
            :data-clip="clip.id"
            :data-start="placementOf(clip).startBar"
            :data-span="placementOf(clip).bars"
            :data-selected="clip.id === selectedClipId ? '' : undefined"
            :data-dragging="drag?.clipId === clip.id ? drag.mode : undefined"
            :data-kind="clip.kind"
            :aria-label="`${t(clip.labelKey)}, ${t('music.label.bar')} ${placementOf(clip).startBar}, ${placementOf(clip).bars} ${t('music.label.bars')}`"
            :aria-pressed="clip.id === selectedClipId ? 'true' : 'false'"
            @pointerdown="onPointerDown($event, clip, 'move')"
            @pointermove="onPointerMove($event, clip)"
            @pointerup="endDrag($event, clip)"
            @pointercancel="endDrag($event, clip)"
            @keydown="onKeyDown($event, clip)"
            @click="onClipClick(clip)"
          >
            <span class="clip__label">{{ t(clip.labelKey) }}</span>
            <Peaks :peaks="clip.peaks" />
            <!-- A separate pointer target on the trailing edge. It stops
                 propagation so grabbing it never starts a move — the two
                 gestures begin identically. -->
            <span
              class="clip__resize"
              aria-hidden="true"
              @pointerdown.stop="onPointerDown($event, clip, 'resize')"
              @pointermove="onPointerMove($event, clip)"
              @pointerup="endDrag($event, clip)"
              @pointercancel="endDrag($event, clip)"
            />
          </div>
          <!-- A grid item in the column `playheadBar()` returns, the same
               one-based counting the clips use, so it cannot drift by a column. -->
          <span
            class="playhead"
            :data-start="playheadBar(player.transport.value.positionSec, project.bars)"
            :data-span="1"
            aria-hidden="true"
          />
        </div>
      </div>
    </div>
  </div>
</template>
