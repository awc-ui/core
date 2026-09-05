/**
 * The transport bar. The one piece of chrome that makes this a music app.
 *
 * IT LIVES IN THE APP SHELL, NOT IN A ROUTED COMPONENT. The router swaps the
 * screen on every navigation; this bar is rendered outside `<router-outlet>`,
 * so it is the SAME element before and after — the track keeps playing and the
 * playhead stays where it was.
 *
 * NOTHING PLAYS: the playhead advances on an interval that runs only while
 * playing, and there is no audio anywhere.
 */
import {
  ChangeDetectionStrategy,
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  albumById,
  artistById,
  clock,
  repeatIcon,
  repeatLabelKey,
  repeatTone,
  trackById,
  transportIcon,
  transportLabelKey,
} from '@awc-ui/showcase-kit/music';
import { ShowcaseService } from '../lib/showcase.service';
import { PlayerService } from '../lib/player.service';
import { ArtComponent } from './bits.component';

@Component({
  /* `:host { display: contents }` — the Angular host must be transparent to
     layout, or it becomes a box between a grid and the element that was meant
     to be its child. A shelf of album cards would lay out the HOSTS, not the
     cards, and the parity check reads it as a different document. */
  styles: ':host { display: contents; }',
  selector: 'awc-transport',
  standalone: true,
  imports: [CommonModule, ArtComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.Default,
  template: `
    <div class="transport" role="region" [attr.aria-label]="t('music.label.nowPlaying')">
      <div class="transport__now">
        <awc-art *ngIf="album" [art]="album.art" className="transport__art" />
        <div class="transport__text">
          <div class="transport__title">{{ track ? track.title : t('music.label.nothingLoaded') }}</div>
          <div class="transport__artist">{{ artist?.name ?? '' }}</div>
        </div>
      </div>

      <div class="transport__controls">
        <div class="transport__buttons">
          <md-icon-button
            class="transport__button transport__shuffle"
            icon="shuffle"
            size="sm"
            [attr.color]="transport().shuffle ? 'primary' : null"
            [attr.data-on]="transport().shuffle ? '' : null"
            [attr.aria-pressed]="transport().shuffle"
            [attr.aria-label]="t('music.action.shuffle')"
            (click)="player.toggleShuffle()"
          ></md-icon-button>
          <md-icon-button
            class="transport__button transport__previous"
            icon="skip_previous"
            [attr.aria-label]="t('music.action.previous')"
            (click)="player.previous()"
          ></md-icon-button>
          <!-- THE GLYPH IS THE ACTION, NOT THE STATE: a transport that is
               playing shows PAUSE, because pressing it pauses. Icon and label
               come from the same two maps in the kit. -->
          <md-icon-button
            class="transport__button transport__play"
            [attr.icon]="playIcon"
            variant="filled"
            [attr.aria-label]="t(playLabel)"
            [attr.data-playing]="playing ? '' : null"
            (click)="player.toggle()"
          ></md-icon-button>
          <md-icon-button
            class="transport__button transport__next"
            icon="skip_next"
            [attr.aria-label]="t('music.action.next')"
            (click)="player.next()"
          ></md-icon-button>
          <md-icon-button
            class="transport__button transport__repeat"
            [attr.icon]="repeatGlyph"
            size="sm"
            [attr.color]="repeatColour"
            [attr.data-repeat]="transport().repeat"
            [attr.aria-label]="t(repeatLabel)"
            (click)="player.cycleRepeat()"
          ></md-icon-button>
        </div>

        <div class="transport__scrub">
          <span class="transport__time transport__elapsed">{{ elapsed }}</span>
          <md-slider
            class="transport__slider"
            [attr.min]="0"
            [attr.max]="max"
            [attr.step]="1"
            [attr.value]="transport().positionSec"
            [attr.aria-label]="t('music.action.seek')"
            (mdInput)="player.seek(sliderValue($event), duration)"
          ></md-slider>
          <span class="transport__time transport__duration">{{ total }}</span>
        </div>
      </div>

      <div class="transport__side">
        <md-icon-button
          class="transport__mute"
          [attr.icon]="muteGlyph"
          size="sm"
          [attr.aria-pressed]="transport().muted"
          [attr.aria-label]="t(transport().muted ? 'music.action.unmute' : 'music.action.mute')"
          (click)="player.toggleMute()"
        ></md-icon-button>
        <!-- The fader shows where it IS, not what you can hear: muting must not
             slide it to zero, or un-muting cannot put it back. -->
        <md-slider
          class="transport__volume"
          [attr.min]="0"
          [attr.max]="100"
          [attr.step]="1"
          [attr.value]="volumePercent"
          [attr.aria-label]="t('music.action.volume')"
          (mdInput)="player.setVolume(sliderValue($event) / 100)"
        ></md-slider>
      </div>
    </div>
  `,
})
export class TransportComponent {
  private readonly showcase = inject(ShowcaseService);
  readonly player = inject(PlayerService);

  readonly transport = this.player.transport;

  get track() { const id = this.transport().trackId; return id ? trackById(id) : null; }
  get album() { const t = this.track; return t ? albumById(t.albumId) : null; }
  get artist() { const t = this.track; return t ? artistById(t.artistId) : null; }
  get duration() { return this.track?.durationSec ?? 0; }
  get max() { return Math.max(1, this.duration); }
  get playing() { return this.transport().state === 'playing'; }
  get elapsed() { return clock(this.transport().positionSec); }
  get total() { return clock(this.duration); }
  get playIcon() { return transportIcon[this.transport().state]; }
  get playLabel() { return transportLabelKey[this.transport().state]; }
  get repeatGlyph() { return repeatIcon[this.transport().repeat]; }
  get repeatColour() { return repeatTone[this.transport().repeat]; }
  get repeatLabel() { return repeatLabelKey[this.transport().repeat]; }
  get volumePercent() { return Math.round(this.transport().volume * 100); }
  get muteGlyph() {
    const t = this.transport();
    return t.muted || t.volume === 0 ? 'volume_off' : 'volume_up';
  }

  t = (key: string) => this.showcase.t(key);

  /*
   * `md-slider`'s `mdInput` detail is `{ value }`, AN OBJECT — while
   * `md-text-field`'s detail IS the bare string. Assuming one shape for both
   * yields `Number({value: 42})` → NaN, which fails silently because the clamps
   * in `derive.ts` turn NaN back into the value already there.
   */
  sliderValue(event: Event): number {
    const raw = (event as CustomEvent<{ value: number }>).detail?.value;
    return Number.isFinite(raw) ? Number(raw) : 0;
  }
}
