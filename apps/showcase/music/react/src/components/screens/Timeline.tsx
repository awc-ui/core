/**
 * The arrangement: a ruler, a lane per track, and clips placed in whole bars.
 *
 * NOT ONE PIXEL OFFSET IS COMPUTED HERE, and that is the whole design. The
 * deployed policy is `style-src-attr 'none'`, so no element may carry a `style`
 * attribute and the usual `left: 340px; width: 96px` technique is unavailable
 * in all five builds. What a lane does instead is be a CSS grid with one column
 * per bar; a clip declares `data-start` and `data-span`, and `app.css` — which
 * is allowed to do arithmetic the element is not — places it.
 *
 * DRAGGING WORKS BY REWRITING THOSE TWO NUMBERS, which is why it survives the
 * policy that rules out the usual approach. There is no floating ghost and no
 * transform: the clip moves a whole bar at a time because the grid re-places it
 * the instant `data-start` changes. That makes the snap a property of the
 * layout rather than something the drag code has to draw, and it is why all
 * five builds will drag identically — they are each writing one integer.
 *
 * EVERY EDIT HAS A KEYBOARD PATH. A drag is a pointer gesture and nothing else;
 * the same move, resize and delete are on the arrow keys and Delete, because a
 * timeline that can only be edited with a mouse is a timeline half the people
 * who need it cannot use.
 */

import { useCallback, useRef, useState } from 'react';
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
import { useT } from '@/lib/showcase';
import { usePlayer } from '@/lib/player';
import { Peaks } from '@/components/bits';

/** What a pointer gesture is doing, while it is doing it. */
interface Drag {
  clipId: string;
  mode: 'move' | 'resize';
  originX: number;
  fromStart: number;
  fromBars: number;
  laneWidth: number;
}

export function Timeline({
  project,
  tracks,
  zoom,
  selectedClipId,
  onSelectClip,
  onMessage,
}: {
  project: Project;
  tracks: readonly StudioTrack[];
  zoom: 'sm' | 'md' | 'lg';
  selectedClipId: string | null;
  onSelectClip: (clip: Clip | null) => void;
  onMessage: (key: string, params?: Record<string, string | number>) => void;
}) {
  const t = useT();
  const player = usePlayer();
  const ticks = rulerTicks(project.bars);
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);
  dragRef.current = drag;

  /* A DRAG IS FOLLOWED BY A CLICK, AND THAT CLICK HAS TO BE SWALLOWED — but the
   flag is keyed to the CLIP, not a bare boolean. `pointerup` at the end of a
   gesture is normally followed by a synthetic `click` on the same element, and
   a boolean flag assumes that click always arrives to consume it. It does not:
   with pointer capture the click is sometimes dispatched somewhere the handler
   never sees, and the flag then sat true and swallowed the NEXT click — on a
   different clip, which had nothing to do with the drag. Keying it to the id
   means a stale flag can only ever affect the clip that was dragged. */
  const swallowClick = useRef<string | null>(null);

  const head = playheadBar(player.transport.positionSec, project.bars);

  /** The live geometry of one clip, override-aware. */
  const geometry = useCallback(
    (clip: Clip) => ({
      startBar: player.clipStart(clip.id, clip.startBar),
      bars: player.clipBars(clip.id, clip.bars),
    }),
    [player],
  );

  /** The other clips on a lane, as `clipFits` wants them. */
  const laneOf = useCallback(
    (trackId: string) =>
      trackClips(trackId)
        .filter((c) => !player.clipRemoved(c.id))
        .map((c) => ({ id: c.id, ...geometry(c) })),
    [geometry, player],
  );

  /* ------------------------------------------------------------ pointer */

  const onPointerDown = (event: React.PointerEvent<HTMLElement>, clip: Clip, mode: Drag['mode']) => {
    /* SECONDARY BUTTONS DO NOT DRAG. A right-click that started a move would
       leave the clip following the pointer with no button held down. */
    if (event.button !== 0) return;
    const lane = event.currentTarget.closest('.lane');
    if (!lane) return;
    /*
     * POINTER CAPTURE, so the gesture survives the pointer leaving the clip —
     * which it does immediately, because the clip is only a few bars wide and
     * the reader is dragging it somewhere else. Without capture the move ends
     * the moment the cursor crosses the clip's edge.
     */
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
    const here = geometry(clip);
    setDrag({
      clipId: clip.id,
      mode,
      originX: event.clientX,
      fromStart: here.startBar,
      fromBars: here.bars,
      laneWidth: lane.getBoundingClientRect().width,
    });
    onSelectClip(clip);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLElement>, clip: Clip) => {
    const current = dragRef.current;
    if (!current || current.clipId !== clip.id) return;

    /* RTL READS RIGHT TO LEFT, so a drag towards the start of the timeline is a
       drag to the RIGHT. Without this the whole arrangement runs backwards in
       Arabic, which is the kind of thing that only shows up if somebody
       switches locale mid-gesture. */
    const rtl = document.documentElement.dir === 'rtl';
    const delta = (event.clientX - current.originX) * (rtl ? -1 : 1);
    const moved = barsMoved(delta, current.laneWidth, project.bars);
    if (moved === 0) return;

    const others = laneOf(clip.trackId);
    if (current.mode === 'move') {
      const next = current.fromStart + moved;
      if (next === geometry(clip).startBar) return;
      if (!clipFits(others, clip.id, next, current.fromBars, project.bars)) return;
      player.moveClip(clip.id, clip.startBar, next);
    } else {
      const next = current.fromBars + moved;
      if (next < 1 || next === geometry(clip).bars) return;
      if (!clipFits(others, clip.id, current.fromStart, next, project.bars)) return;
      player.resizeClip(clip.id, clip.bars, next);
    }
  };

  const endDrag = (event: React.PointerEvent<HTMLElement>, clip: Clip) => {
    const current = dragRef.current;
    if (!current || current.clipId !== clip.id) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const here = geometry(clip);
    setDrag(null);

    const changed =
      current.mode === 'move'
        ? here.startBar !== current.fromStart
        : here.bars !== current.fromBars;
    /* Only a gesture that ACTUALLY moved something swallows its click. A press
       that never left the bar it started in is a plain click and must still
       select — otherwise clips could not be selected by pointer at all. */
    swallowClick.current = changed ? clip.id : null;

    /* ONE MESSAGE PER GESTURE, not per bar crossed. The move itself is recorded
       bar by bar so undo is fine-grained, but a snackbar on every step would
       be a strobe. */
    if (changed) {
      onMessage(
        current.mode === 'move' ? 'music.msg.clipMoved' : 'music.msg.clipResized',
        { name: t(clip.labelKey) },
      );
    }
  };

  /* ----------------------------------------------------------- keyboard */

  const onKeyDown = (event: React.KeyboardEvent<HTMLElement>, clip: Clip) => {
    const here = geometry(clip);
    const others = laneOf(clip.trackId);
    /* Shift turns the arrows from "move" into "resize", which is the shortcut
       every arrangement editor uses and costs no extra control. */
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;

    if (step !== 0) {
      event.preventDefault();
      if (event.shiftKey) {
        const bars = here.bars + step;
        if (bars >= 1 && clipFits(others, clip.id, here.startBar, bars, project.bars)) {
          player.resizeClip(clip.id, clip.bars, bars);
          onMessage('music.msg.clipResized', { name: t(clip.labelKey) });
        }
        return;
      }
      const startBar = here.startBar + step;
      if (clipFits(others, clip.id, startBar, here.bars, project.bars)) {
        player.moveClip(clip.id, clip.startBar, startBar);
        onMessage('music.msg.clipMoved', { name: t(clip.labelKey) });
      }
      return;
    }

    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      player.removeClip(clip.id, clip.labelKey);
      onSelectClip(null);
      onMessage('music.msg.clipRemoved', { name: t(clip.labelKey) });
    }
  };

  return (
    <div className="lanes">
      <div className="lane-names">
        <div className="lane-names__pad" />
        {tracks.map((track) => (
          <LaneName key={track.id} track={track} onMessage={onMessage} />
        ))}
      </div>

      <div className="timeline" data-zoom={zoom}>
        <div className="timeline__inner">
          <div className="ruler" data-bars={project.bars}>
            {ticks.map((tick) => (
              <span
                key={tick.bar}
                className="ruler__tick"
                data-start={tick.bar}
                data-span={1}
                data-labelled={tick.labelled ? '' : undefined}
              >
                {tick.labelled ? <span className="ruler__label">{tick.bar}</span> : null}
              </span>
            ))}
          </div>

          {tracks.map((track) => (
            <div className="lane" key={track.id} data-bars={project.bars} data-kind={track.kind}>
              {trackClips(track.id)
                .filter((clip) => !player.clipRemoved(clip.id))
                .map((clip) => {
                  const here = geometry(clip);
                  const placement = placeClip({ ...clip, ...here }, project.bars);
                  const selected = clip.id === selectedClipId;
                  return (
                    <div
                      key={clip.id}
                      className="clip"
                      role="button"
                      tabIndex={0}
                      data-clip={clip.id}
                      data-start={placement.startBar}
                      data-span={placement.bars}
                      data-selected={selected ? '' : undefined}
                      data-dragging={drag?.clipId === clip.id ? drag.mode : undefined}
                      data-kind={clip.kind}
                      /*
                       * THE NAME CARRIES THE POSITION, because a timeline of
                       * forty identical "Verse" buttons is unusable with a
                       * screen reader. Bar and length are what the visual
                       * layout conveys and the name otherwise would not.
                       */
                      aria-label={`${t(clip.labelKey)}, ${t('music.label.bar')} ${placement.startBar}, ${placement.bars} ${t('music.label.bars')}`}
                      aria-pressed={selected}
                      onPointerDown={(event) => onPointerDown(event, clip, 'move')}
                      onPointerMove={(event) => onPointerMove(event, clip)}
                      onPointerUp={(event) => endDrag(event, clip)}
                      onPointerCancel={(event) => endDrag(event, clip)}
                      onKeyDown={(event) => onKeyDown(event, clip)}
                      onClick={() => {
                        if (swallowClick.current === clip.id) {
                          swallowClick.current = null;
                          return;
                        }
                        swallowClick.current = null;
                        onSelectClip(selected ? null : clip);
                      }}
                    >
                      <span className="clip__label">{t(clip.labelKey)}</span>
                      <Peaks peaks={clip.peaks} />
                      {/*
                       * THE RESIZE HANDLE IS A SEPARATE POINTER TARGET on the
                       * clip's trailing edge. It stops propagation so grabbing
                       * it never starts a move — the two gestures begin
                       * identically and the handle is the only thing that
                       * distinguishes them.
                       */}
                      <span
                        className="clip__resize"
                        aria-hidden="true"
                        onPointerDown={(event) => {
                          event.stopPropagation();
                          onPointerDown(event, clip, 'resize');
                        }}
                        onPointerMove={(event) => onPointerMove(event, clip)}
                        onPointerUp={(event) => endDrag(event, clip)}
                        onPointerCancel={(event) => endDrag(event, clip)}
                      />
                    </div>
                  );
                })}
              <span className="playhead" data-start={head} data-span={1} aria-hidden="true" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * A lane's name, renameable in place.
 *
 * A DOUBLE-CLICK OPENS IT, and so does Enter — the discoverable gesture and the
 * keyboard one, because a rename reachable only by double-click is a rename
 * most people never find and some cannot perform at all.
 */
function LaneName({
  track,
  onMessage,
}: {
  track: StudioTrack;
  onMessage: (key: string, params?: Record<string, string | number>) => void;
}) {
  const t = useT();
  const player = usePlayer();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(track.name);

  const commit = () => {
    setEditing(false);
    if (draft.trim() !== '' && draft !== track.name) {
      player.renameTrack(track.id, draft.trim());
      onMessage('music.msg.trackRenamed', { name: draft.trim() });
    }
  };

  if (editing) {
    return (
      <div className="lane-name">
        <input
          className="lane-name__input"
          value={draft}
          autoFocus
          aria-label={`${t('music.edit.trackRename')}: ${track.name}`}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commit();
            /* Escape abandons the edit rather than committing a half-typed
               name, which is what a blur would otherwise do. */
            if (event.key === 'Escape') {
              setDraft(track.name);
              setEditing(false);
            }
          }}
        />
      </div>
    );
  }

  return (
    <div
      className="lane-name"
      role="button"
      tabIndex={0}
      data-track={track.id}
      aria-label={`${t('music.edit.trackRename')}: ${track.name}`}
      onDoubleClick={() => {
        setDraft(track.name);
        setEditing(true);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          setDraft(track.name);
          setEditing(true);
        }
      }}
    >
      <span className="material-symbols-outlined" aria-hidden="true">
        {trackIcon[track.kind]}
      </span>
      <span className="lane-name__text">{track.name}</span>
    </div>
  );
}
