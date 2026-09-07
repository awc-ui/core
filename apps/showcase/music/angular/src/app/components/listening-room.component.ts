import { Component, CUSTOM_ELEMENTS_SCHEMA, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  SESSION_MODES,
  sessionCopy,
  listeningSession,
  clock,
  trackById,
  artistById,
  type SessionMode,
  type Track,
} from '@awc-ui/showcase-kit/music';
import { ShowcaseService } from '../lib/showcase.service';
import { PlayerService } from '../lib/player.service';
import { ArtComponent } from './bits.component';
@Component({
  selector: 'awc-listening-room',
  standalone: true,
  imports: [CommonModule, ArtComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  styles: ':host { display: contents; }',
  template: ` <section class="listening-room" [attr.aria-label]="copy().choose">
    <md-card class="listening-room__card" variant="filled" full-width
      ><div class="listening-room__feature">
        <div class="listening-room__copy">
          <span class="listening-room__eyebrow">{{ copy().eyebrow }}</span>
          <h2>{{ copy().title }}</h2>
          <p>{{ copy().description }}</p>
          <md-button-group
            class="listening-room__modes"
            variant="standard"
            selection-mode="single-select"
            required
            [attr.aria-label]="copy().choose"
            ><md-button
              *ngFor="let value of modes; index as index"
              variant="tonal"
              toggle
              [attr.value]="value"
              [attr.selected]="mode() === value ? '' : null"
              [attr.aria-pressed]="mode() === value"
              (click)="mode.set(value)"
              >{{ copy().modes[index] }}</md-button
            ></md-button-group
          >
          <div class="listening-room__session" aria-live="polite">
            <h3>{{ copy().names[at()] }}</h3>
            <p>{{ copy().notes[at()] }}</p>
            <div class="listening-room__facts">
              <span>{{ showcase.t.formatNumber(session().tracks.length) }} {{ copy().tracks }}</span
              ><span>{{ clock(session().duration) }} {{ copy().duration }}</span>
            </div>
          </div>
          <md-button
            class="listening-room__play"
            variant="filled"
            [attr.icon]="playing() ? 'pause' : 'play_arrow'"
            (click)="loaded() ? player.toggle() : player.playSession(session().tracks)"
            >{{ playing() ? copy().pause : loaded() ? copy().resume : copy().play }}</md-button
          >
          <small class="listening-room__demo">{{ copy().demo }}</small>
        </div>
        <div class="listening-room__artwork" aria-hidden="true">
          <div
            *ngFor="let album of session().albums; index as index"
            [class]="'listening-room__cover listening-room__cover--' + index"
          >
            <awc-art [art]="album.art" [eager]="true" />
          </div>
          <div class="listening-room__record"></div>
        </div>
      </div> </md-card
    ><md-card
      variant="outlined"
      role="complementary"
      class="listening-queue"
      [attr.aria-label]="copy().queue"
      ><div class="listening-queue__heading">
        <h3>{{ copy().queue }}</h3>
        <span>{{ showcase.t.formatNumber(queue().length) }} {{ copy().tracks }}</span>
      </div>
      <div class="listening-queue__list">
        <div
          *ngFor="let track of queue()"
          class="listening-queue__row"
          [attr.data-current]="track.id === player.transport().trackId ? '' : null"
        >
          <md-icon-button
            [attr.icon]="
              track.id === player.transport().trackId && player.transport().state === 'playing'
                ? 'pause'
                : 'play_arrow'
            "
            size="sm"
            [attr.aria-label]="
              showcase.t(
                track.id === player.transport().trackId && player.transport().state === 'playing'
                  ? 'music.action.pause'
                  : 'music.action.play'
              ) +
              ': ' +
              track.title
            "
            (click)="track.id === player.transport().trackId ? player.toggle() : player.play(track)"
          />
          <div class="listening-queue__track">
            <strong>{{ track.title }}</strong
            ><span>{{ artistById(track.artistId)?.name }} · {{ clock(track.durationSec) }}</span>
          </div>
          <md-icon-button
            icon="close"
            size="sm"
            [attr.disabled]="track.id === player.transport().trackId ? '' : null"
            [attr.aria-label]="copy().remove + ': ' + track.title"
            (click)="player.removeFromQueue(track.id)"
          />
        </div>
      </div>
    </md-card>
  </section>`,
})
export class ListeningRoomComponent {
  readonly showcase = inject(ShowcaseService);
  readonly player = inject(PlayerService);
  readonly modes = SESSION_MODES;
  readonly mode = signal<SessionMode>('for-you');
  readonly copy = computed(() => sessionCopy(this.showcase.state().locale));
  readonly session = computed(() => listeningSession(this.mode()));
  readonly at = computed(() => SESSION_MODES.indexOf(this.mode()));
  readonly queue = computed(() =>
    this.player
      .transport()
      .queue.map(trackById)
      .filter((track): track is Track => track !== null),
  );
  readonly loaded = computed(
    () =>
      this.session().tracks.some((track) => track.id === this.player.transport().trackId) &&
      this.player
        .transport()
        .queue.every((id) => this.session().tracks.some((track) => track.id === id)),
  );
  readonly playing = computed(() => this.loaded() && this.player.transport().state === 'playing');
  readonly clock = clock;
  readonly artistById = artistById;
}
