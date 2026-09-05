/**
 * The mixer: a strip per track, and the rule that decides what you hear.
 *
 * THE ASYMMETRY IS THE WHOLE SCREEN. Soloing silences every track that is not
 * soloed; an explicitly muted track stays silent regardless. `audibleTracks()`
 * in the kit is the only place that rule is written, and `data-silent` is keyed
 * on its answer rather than on the mute flag — which is why soloing one strip
 * visibly drops the others back.
 *
 * SIXTY CONTROLS ON ONE SCREEN: every control takes its track's name into its
 * accessible name, because "Mute, button" twelve times is useless.
 */
import { ChangeDetectionStrategy, Component, CUSTOM_ELEMENTS_SCHEMA, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  currentProject,
  muteIcon,
  muteLabelKey,
  projectTracks,
  soloLabelKey,
  trackIcon,
  trackLabelKey,
  type StudioTrack,
} from '@awc-ui/showcase-kit/music';
import { ScreenComponent } from '../components/screen.component';
import { PanelComponent } from '../components/panel.component';
import { EmptyStateComponent } from '../components/empty-state.component';
import { CountComponent, PanReadoutComponent, VolumeReadoutComponent } from '../components/bits.component';
import { MixerSkeletonComponent } from '../components/skeletons.component';
import { ShowcaseService } from '../lib/showcase.service';
import { PlayerService } from '../lib/player.service';
import { SnackbarService } from '../lib/snackbar.service';

@Component({
  /* `:host { display: contents }` — the Angular host must be transparent to
     layout, or it becomes a box between a grid and the element that was meant
     to be its child. A shelf of album cards would lay out the HOSTS, not the
     cards, and the parity check reads it as a different document. */
  styles: ':host { display: contents; }',
  selector: 'awc-mixer-screen',
  standalone: true,
  imports: [
    CommonModule, ScreenComponent, PanelComponent, EmptyStateComponent, CountComponent,
    VolumeReadoutComponent, PanReadoutComponent, MixerSkeletonComponent,
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.Default,
  template: `
    <awc-screen [title]="t('music.screen.mixer.title')" [subtitle]="t('music.screen.mixer.subtitle')">
      <awc-count aside [value]="tracks.length" />
      <awc-mixer-skeleton skeleton />

      <awc-empty-state *ngIf="!project" [message]="t('music.empty.clips')" />
      <awc-panel *ngIf="project as open" [title]="open.title" [subtitle]="t('music.hint.soloRule')">
        <awc-count actions [value]="tracks.length" />

        <div class="mixer" role="group" [attr.aria-label]="t('music.screen.mixer.title')">
          <div
            *ngFor="let track of tracks"
            class="strip"
            [attr.data-track]="track.id"
            [attr.data-silent]="audible(track) ? null : ''"
          >
            <span class="strip__name">{{ track.name }}</span>
            <span class="strip__kind">
              <span class="material-symbols-outlined" aria-hidden="true">{{ glyph(track) }}</span>
              <span class="visually-hidden">{{ t(kindKey(track)) }}</span>
            </span>

            <div class="strip__body">
              <!-- A REAL vertical slider, via the component's own prop.
                   Rotating a horizontal one leaves its hit area and arrow keys
                   horizontal. -->
              <md-slider
                class="strip__fader"
                orientation="vertical"
                full-height=""
                [attr.min]="0"
                [attr.max]="100"
                [attr.step]="1"
                [attr.value]="percent(track.volume)"
                [attr.aria-label]="levelLabel(track)"
                (mdInput)="player.setTrackVolume(track.id, sliderValue($event) / 100)"
              ></md-slider>
            </div>

            <!-- Horizontal, because "md-meter" has no vertical orientation: a
                 linear one squeezed into a ten-pixel column reads as a smudge.
                 Static, since nothing plays. -->
            <md-meter
              class="strip__meter"
              [attr.value]="percent(track.level)"
              [attr.min]="0"
              [attr.max]="100"
              [attr.color]="track.level > 0.85 ? 'error' : 'primary'"
              [attr.label]="levelLabel(track)"
            ></md-meter>

            <awc-volume-readout [volume]="track.volume" />

            <md-slider
              class="strip__pan"
              [attr.min]="-100"
              [attr.max]="100"
              [attr.step]="5"
              [attr.value]="percent(track.pan)"
              [attr.aria-label]="panLabel(track)"
              (mdInput)="player.setTrackPan(track.id, sliderValue($event) / 100)"
            ></md-slider>
            <awc-pan-readout [pan]="track.pan" />

            <div class="strip__buttons">
              <md-icon-button
                class="strip__mute"
                [attr.icon]="muteGlyph(track)"
                size="sm"
                [attr.color]="track.muted ? 'error' : null"
                [attr.data-on]="track.muted ? '' : null"
                [attr.aria-pressed]="track.muted"
                [attr.aria-label]="muteLabel(track)"
                (click)="mute(track)"
              ></md-icon-button>
              <md-icon-button
                class="strip__solo"
                icon="headphones"
                size="sm"
                [attr.color]="track.soloed ? 'primary' : null"
                [attr.data-on]="track.soloed ? '' : null"
                [attr.aria-pressed]="track.soloed"
                [attr.aria-label]="soloLabel(track)"
                (click)="solo(track)"
              ></md-icon-button>
            </div>

            <span class="visually-hidden">{{ audibleWord(track) }} — {{ t(kindKey(track)) }}</span>
          </div>
        </div>
      </awc-panel>
    </awc-screen>
  `,
})
export class MixerScreen {
  private readonly showcase = inject(ShowcaseService);
  readonly player = inject(PlayerService);
  private readonly snackbar = inject(SnackbarService);
  readonly project = currentProject();

  get tracks() {
    if (!this.project) return [];
    return projectTracks(this.project).map(
      (track) => this.player.tracks().find((x) => x.id === track.id) ?? track,
    );
  }

  t = (key: string) => this.showcase.t(key);
  audible = (track: StudioTrack) => this.player.audible().has(track.id);
  audibleWord = (track: StudioTrack) =>
    this.t(this.audible(track) ? 'music.label.audible' : 'music.label.inaudible');
  glyph = (track: StudioTrack) => trackIcon[track.kind];
  kindKey = (track: StudioTrack) => trackLabelKey[track.kind];
  percent = (value: number) => Math.round(value * 100);
  levelLabel = (track: StudioTrack) => `${this.t('music.label.level')}: ${track.name}`;
  panLabel = (track: StudioTrack) => `${this.t('music.label.pan')}: ${track.name}`;
  muteGlyph = (track: StudioTrack) => muteIcon(this.audible(track));
  muteLabel = (track: StudioTrack) => `${this.t(muteLabelKey(track.muted))}: ${track.name}`;
  soloLabel = (track: StudioTrack) => `${this.t(soloLabelKey(track.soloed))}: ${track.name}`;

  mute(track: StudioTrack) {
    const was = track.muted;
    this.player.toggleTrackMute(track.id);
    this.snackbar.say(was ? 'music.msg.unmuted' : 'music.msg.muted', { name: track.name });
  }
  solo(track: StudioTrack) {
    const was = track.soloed;
    this.player.toggleTrackSolo(track.id);
    this.snackbar.say(was ? 'music.msg.unsoloed' : 'music.msg.soloed', { name: track.name });
  }

  /* `md-slider`'s detail is an OBJECT — see the note in the transport. */
  sliderValue(event: Event): number {
    const raw = (event as CustomEvent<{ value: number }>).detail?.value;
    return Number.isFinite(raw) ? Number(raw) : 0;
  }
}
