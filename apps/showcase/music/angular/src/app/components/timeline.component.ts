/**
 * The arrangement: a ruler, a lane per track, and clips placed in whole bars.
 *
 * NOT ONE PIXEL OFFSET IS COMPUTED HERE. `style-src-attr 'none'` forbids the
 * `style` attribute the usual `left: 340px` technique needs, so a lane is a CSS
 * grid with one column per bar and a clip declares `data-start`/`data-span`.
 *
 * DRAGGING REWRITES THOSE TWO NUMBERS. There is no ghost and no transform: the
 * clip moves a whole bar at a time because the grid re-places it the instant
 * `data-start` changes — which is why every build drags identically, each
 * writing one integer.
 *
 * EVERY EDIT HAS A KEYBOARD PATH. A timeline editable only with a mouse is one
 * half the people who need it cannot use.
 */
import {
  ChangeDetectionStrategy,
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  EventEmitter,
  Input,
  Output,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
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
import { ShowcaseService } from '../lib/showcase.service';
import { PlayerService } from '../lib/player.service';
import { PeaksComponent } from './bits.component';
import { LaneNameComponent } from './lane-name.component';

interface Drag {
  clipId: string;
  mode: 'move' | 'resize';
  originX: number;
  fromStart: number;
  fromBars: number;
  laneWidth: number;
}

@Component({
  /* `:host { display: contents }` — the Angular host must be transparent to
     layout, or it becomes a box between a grid and the element that was meant
     to be its child. A shelf of album cards would lay out the HOSTS, not the
     cards, and the parity check reads it as a different document. */
  styles: ':host { display: contents; }',
  selector: 'awc-timeline',
  standalone: true,
  imports: [CommonModule, PeaksComponent, LaneNameComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.Default,
  template: `
    <div class="lanes">
      <div class="lane-names">
        <div class="lane-names__pad"></div>
        <awc-lane-name
          *ngFor="let lane of lanes()"
          [track]="lane.track"
          (message)="message.emit($event)"
        />
      </div>

      <div class="timeline" [attr.data-zoom]="zoom">
        <div class="timeline__inner">
          <div class="ruler" [attr.data-bars]="project.bars">
            <span
              *ngFor="let tick of ticks$()"
              class="ruler__tick"
              [attr.data-start]="tick.bar"
              [attr.data-span]="1"
              [attr.data-labelled]="tick.labelled ? '' : null"
              ><span *ngIf="tick.labelled" class="ruler__label">{{ tick.bar }}</span></span
            >
          </div>

          <div
            *ngFor="let lane of lanes()"
            class="lane"
            [attr.data-bars]="project.bars"
            [attr.data-kind]="lane.track.kind"
          >
            <div
              *ngFor="let item of lane.clips"
              class="clip"
              role="button"
              tabindex="0"
              [attr.data-clip]="item.clip.id"
              [attr.data-start]="item.startBar"
              [attr.data-span]="item.bars"
              [attr.data-selected]="item.clip.id === selectedClipId ? '' : null"
              [attr.data-dragging]="drag()?.clipId === item.clip.id ? drag()!.mode : null"
              [attr.data-kind]="item.clip.kind"
              [attr.aria-label]="item.label"
              [attr.aria-pressed]="item.clip.id === selectedClipId"
              (pointerdown)="onPointerDown($event, item.clip, 'move')"
              (pointermove)="onPointerMove($event, item.clip)"
              (pointerup)="endDrag($event, item.clip)"
              (pointercancel)="endDrag($event, item.clip)"
              (keydown)="onKeyDown($event, item.clip)"
              (click)="onClipClick(item.clip)"
            >
              <span class="clip__label">{{ item.text }}</span>
              <awc-peaks [peaks]="item.clip.peaks" />
              <!-- A separate pointer target on the trailing edge. It stops
                   propagation so grabbing it never starts a move. -->
              <span
                class="clip__resize"
                aria-hidden="true"
                (pointerdown)="$event.stopPropagation(); onPointerDown($event, item.clip, 'resize')"
                (pointermove)="onPointerMove($event, item.clip)"
                (pointerup)="endDrag($event, item.clip)"
                (pointercancel)="endDrag($event, item.clip)"
              ></span>
            </div>
            <!-- A grid item in the column "playheadBar()" returns, the same
                 one-based counting the clips use, so it cannot drift. -->
            <span
              class="playhead"
              [attr.data-start]="head"
              [attr.data-span]="1"
              aria-hidden="true"
            ></span>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class TimelineComponent {
  private readonly showcase = inject(ShowcaseService);
  private readonly player = inject(PlayerService);

  /*
   * SIGNAL INPUTS, so the lane model below can be a `computed()`.
   *
   * A plain `@Input` cannot be a dependency of a computed, and without one the
   * model has to be a method — which returns a new array per change-detection
   * pass and puts `*ngFor` into the loop described in `PlayerService`.
   */
  private readonly project$ = signal<Project | null>(null);
  private readonly tracks$ = signal<readonly StudioTrack[]>([]);

  @Input({ required: true }) set project(value: Project) { this.project$.set(value); }
  get project(): Project { return this.project$()!; }
  @Input({ required: true }) set tracks(value: readonly StudioTrack[]) { this.tracks$.set(value); }
  get tracks(): readonly StudioTrack[] { return this.tracks$(); }
  @Input({ required: true }) zoom!: 'sm' | 'md' | 'lg';
  @Input() selectedClipId: string | null = null;

  /* `@Output` with an `EventEmitter`, NOT an `@Input` callback — the Angular
     port's most repeated correction. */
  @Output() select = new EventEmitter<Clip | null>();
  @Output() message = new EventEmitter<{ key: string; params?: Record<string, string | number> }>();

  readonly drag = signal<Drag | null>(null);
  /* A drag is followed by a synthetic `click` on the same element, which used
     to toggle selection off — so the toolbar vanished the instant a drag
     ended. */
  /*
   * A DRAG IS FOLLOWED BY A CLICK, AND THAT CLICK HAS TO BE SWALLOWED — but the
   * flag is keyed to the CLIP, not a bare boolean. "pointerup" at the end of a
   * gesture is normally followed by a synthetic "click" on the same element,
   * and a boolean flag assumes that click always arrives to consume it. It does
   * not: with pointer capture the click is sometimes dispatched somewhere the
   * handler never sees, and the flag then sat true and swallowed the NEXT click
   * — on a different clip, which had nothing to do with the drag. Keying it to
   * the id means a stale flag can only ever affect the clip that was dragged.
   */
  private swallowClick: string | null = null;

  /*
   * THE WHOLE LANE MODEL, COMPUTED ONCE PER CHANGE. Placement is resolved here
   * rather than in a binding, so the template reads plain numbers and calls no
   * function at all — the only shape `*ngFor` can iterate without re-creating
   * its view every pass.
   */
  readonly lanes = computed(() => {
    const open = this.project$();
    if (!open) return [];
    const starts = this.player.clipStarts();
    const spans = this.player.clipSpans();
    const gone = this.player.removed();
    return this.tracks$().map((track) => ({
      track,
      clips: trackClips(track.id)
        .filter((clip) => gone[clip.id] !== true)
        .map((clip) => {
          const startBar = clip.id in starts ? starts[clip.id]! : clip.startBar;
          const bars = clip.id in spans ? spans[clip.id]! : clip.bars;
          const at = placeClip({ ...clip, startBar, bars }, open.bars);
          return {
            clip,
            startBar: at.startBar,
            bars: at.bars,
            label: `${this.t(clip.labelKey)}, ${this.t('music.label.bar')} ${at.startBar}, ${at.bars} ${this.t('music.label.bars')}`,
            text: this.t(clip.labelKey),
          };
        }),
    }));
  });

  readonly ticks$ = computed(() => rulerTicks(this.project$()?.bars ?? 1));
  get ticks() { return this.ticks$(); }
  get head() { return playheadBar(this.player.transport().positionSec, this.project.bars); }

  t = (key: string) => this.showcase.t(key);

  private geometry(clip: Clip) {
    return {
      startBar: this.player.clipStart(clip.id, clip.startBar),
      bars: this.player.clipBars(clip.id, clip.bars),
    };
  }

  placement(clip: Clip) {
    return placeClip({ ...clip, ...this.geometry(clip) }, this.project.bars);
  }

  clipLabel(clip: Clip) {
    const at = this.placement(clip);
    return `${this.t(clip.labelKey)}, ${this.t('music.label.bar')} ${at.startBar}, ${at.bars} ${this.t('music.label.bars')}`;
  }

  visibleClips(trackId: string) {
    return trackClips(trackId).filter((clip) => !this.player.clipRemoved(clip.id));
  }

  private laneOf(trackId: string) {
    return this.visibleClips(trackId).map((c) => ({ id: c.id, ...this.geometry(c) }));
  }

  onPointerDown(event: PointerEvent, clip: Clip, mode: Drag['mode']) {
    /* Secondary buttons do not drag: a right-click that started a move would
       leave the clip following the pointer with no button held down. */
    if (event.button !== 0) return;
    const target = event.currentTarget as HTMLElement;
    const lane = target.closest('.lane');
    if (!lane) return;
    /* Pointer capture, so the gesture survives the pointer leaving the clip. */
    target.setPointerCapture(event.pointerId);
    event.preventDefault();
    const here = this.geometry(clip);
    this.drag.set({
      clipId: clip.id,
      mode,
      originX: event.clientX,
      fromStart: here.startBar,
      fromBars: here.bars,
      laneWidth: lane.getBoundingClientRect().width,
    });
    this.select.emit(clip);
  }

  onPointerMove(event: PointerEvent, clip: Clip) {
    const current = this.drag();
    if (!current || current.clipId !== clip.id) return;
    /* RTL reads right to left, so a drag towards the start of the timeline is a
       drag to the RIGHT. */
    const rtl = document.documentElement.dir === 'rtl';
    const delta = (event.clientX - current.originX) * (rtl ? -1 : 1);
    const moved = barsMoved(delta, current.laneWidth, this.project.bars);
    if (moved === 0) return;

    const others = this.laneOf(clip.trackId);
    if (current.mode === 'move') {
      const nextBar = current.fromStart + moved;
      if (nextBar === this.geometry(clip).startBar) return;
      if (!clipFits(others, clip.id, nextBar, current.fromBars, this.project.bars)) return;
      this.player.moveClip(clip.id, clip.startBar, nextBar);
    } else {
      const nextBars = current.fromBars + moved;
      if (nextBars < 1 || nextBars === this.geometry(clip).bars) return;
      if (!clipFits(others, clip.id, current.fromStart, nextBars, this.project.bars)) return;
      this.player.resizeClip(clip.id, clip.bars, nextBars);
    }
  }

  endDrag(event: PointerEvent, clip: Clip) {
    const current = this.drag();
    if (!current || current.clipId !== clip.id) return;
    const target = event.currentTarget as HTMLElement;
    if (target.hasPointerCapture(event.pointerId)) target.releasePointerCapture(event.pointerId);
    const here = this.geometry(clip);
    this.drag.set(null);

    const changed =
      current.mode === 'move' ? here.startBar !== current.fromStart : here.bars !== current.fromBars;
    /* Only a gesture that ACTUALLY moved something swallows its click. */
    this.swallowClick = changed ? clip.id : null;
    /* One message per gesture, not per bar crossed. */
    if (changed) {
      this.message.emit({
        key: current.mode === 'move' ? 'music.msg.clipMoved' : 'music.msg.clipResized',
        params: { name: this.t(clip.labelKey) },
      });
    }
  }

  onKeyDown(event: KeyboardEvent, clip: Clip) {
    const here = this.geometry(clip);
    const others = this.laneOf(clip.trackId);
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;

    if (step !== 0) {
      event.preventDefault();
      /* Shift turns the arrows from "move" into "resize". */
      if (event.shiftKey) {
        const bars = here.bars + step;
        if (bars >= 1 && clipFits(others, clip.id, here.startBar, bars, this.project.bars)) {
          this.player.resizeClip(clip.id, clip.bars, bars);
          this.message.emit({ key: 'music.msg.clipResized', params: { name: this.t(clip.labelKey) } });
        }
        return;
      }
      const startBar = here.startBar + step;
      if (clipFits(others, clip.id, startBar, here.bars, this.project.bars)) {
        this.player.moveClip(clip.id, clip.startBar, startBar);
        this.message.emit({ key: 'music.msg.clipMoved', params: { name: this.t(clip.labelKey) } });
      }
      return;
    }

    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      this.player.removeClip(clip.id);
      this.select.emit(null);
      this.message.emit({ key: 'music.msg.clipRemoved', params: { name: this.t(clip.labelKey) } });
    }
  }

  onClipClick(clip: Clip) {
    if (this.swallowClick === clip.id) {
      this.swallowClick = null;
      return;
    }
    this.swallowClick = null;
    this.select.emit(clip.id === this.selectedClipId ? null : clip);
  }
}
