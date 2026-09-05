import { ChangeDetectionStrategy, Component, CUSTOM_ELEMENTS_SCHEMA, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { albumById, albumTracks, artistById, clock, trackById } from '@awc-ui/showcase-kit/music';
import { ScreenComponent } from '../components/screen.component';
import { PanelComponent } from '../components/panel.component';
import { ArtComponent, CountComponent, PeaksComponent, TrackListComponent } from '../components/bits.component';
import { ReleaseSkeletonComponent } from '../components/skeletons.component';
import { NotFoundScreen } from './not-found.component';
import { ShowcaseService } from '../lib/showcase.service';
import { PlayerService } from '../lib/player.service';
import { SnackbarService } from '../lib/snackbar.service';
import { appPath, route } from '../lib/routes';

@Component({
  /* `:host { display: contents }` — the Angular host must be transparent to
     layout, or it becomes a box between a grid and the element that was meant
     to be its child. A shelf of album cards would lay out the HOSTS, not the
     cards, and the parity check reads it as a different document. */
  styles: ':host { display: contents; }',
  selector: 'awc-track-screen',
  standalone: true,
  imports: [
    CommonModule, RouterLink, ScreenComponent, PanelComponent, CountComponent, ArtComponent,
    PeaksComponent, TrackListComponent, ReleaseSkeletonComponent, NotFoundScreen,
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.Default,
  template: `
    <awc-not-found-screen *ngIf="!track" />
    <awc-screen *ngIf="track as tr" [title]="tr.title" [subtitle]="t('music.screen.track.subtitle')" [crumbLabel]="tr.title">
      <span class="tabular" aside>{{ length }}</span>
      <awc-release-skeleton skeleton />

      <div class="stack">
        <awc-panel>
          <div class="release-head">
            <awc-art *ngIf="album as al" [art]="al.art" className="release-head__art" [eager]="true" />
            <div class="release-head__text">
              <h2 class="release-head__title">{{ tr.title }}</h2>
              <div class="row">
                <a *ngIf="artist as ar" class="link" [routerLink]="artistPath">{{ ar.name }}</a>
                <span class="person-row__meta">·</span>
                <a *ngIf="album as al" class="link" [routerLink]="albumPath">{{ al.title }}</a>
                <span class="person-row__meta">{{ album?.year ?? '' }}</span>
              </div>
              <awc-peaks [peaks]="tr.peaks" />
              <div class="row">
                <md-button class="track__play" variant="filled" [attr.icon]="playing ? 'pause' : 'play_arrow'" (click)="toggle()">
                  {{ t(playing ? 'music.action.pause' : 'music.action.play') }}
                </md-button>
                <md-button
                  class="track__like"
                  [attr.variant]="liked ? 'tonal' : 'outlined'"
                  [attr.icon]="liked ? 'favorite' : 'favorite_border'"
                  [attr.data-liked]="liked ? '' : null"
                  (click)="like()"
                >{{ t(liked ? 'music.action.unlike' : 'music.action.like') }}</md-button>
                <md-button class="track__queue" variant="text" icon="queue_music" (click)="queue()">
                  {{ t('music.action.addToQueue') }}
                </md-button>
              </div>
            </div>
          </div>
        </awc-panel>

        <awc-panel [title]="t('music.panel.listening')">
          <div class="stat-row">
            <div><dt>{{ t('music.label.duration') }}</dt><dd class="tabular">{{ length }}</dd></div>
            <div><dt>{{ t('music.label.playCount') }}</dt><dd><awc-count [value]="tr.playCount" [compact]="true" /></dd></div>
            <div><dt>{{ t('music.label.year') }}</dt><dd>{{ album?.year ?? '' }}</dd></div>
          </div>
        </awc-panel>

        <awc-panel *ngIf="siblings.length > 0 && album" [title]="t('music.panel.appearsOn')" [subtitle]="album!.title">
          <awc-count actions [value]="siblings.length" />
          <awc-track-list [tracks]="siblings" [numbered]="true" [showArtist]="false" />
        </awc-panel>
      </div>
    </awc-screen>
  `,
})
export class TrackScreen {
  private readonly showcase = inject(ShowcaseService);
  private readonly player = inject(PlayerService);
  private readonly snackbar = inject(SnackbarService);
  @Input({ required: true }) trackId!: string;

  get track() { return trackById(this.trackId); }
  get album() { const t = this.track; return t ? albumById(t.albumId) : null; }
  get artist() { const t = this.track; return t ? artistById(t.artistId) : null; }
  get siblings() {
    const al = this.album;
    return al ? albumTracks(al).filter((x) => x.id !== this.trackId) : [];
  }
  get liked() { const t = this.track; return t ? this.player.likedFor(t) : false; }
  get current() { return this.player.transport().trackId === this.trackId; }
  get playing() { return this.current && this.player.transport().state === 'playing'; }
  get length() { const t = this.track; return t ? clock(t.durationSec) : ''; }
  get artistPath() { const a = this.artist; return a ? appPath(route.artist(a.handle)) : ''; }
  get albumPath() { const a = this.album; return a ? appPath(route.album(a.slug)) : ''; }

  t = (key: string) => this.showcase.t(key);

  toggle() { const t = this.track; if (!t) return; this.current ? this.player.toggle() : this.player.play(t); }
  like() {
    const t = this.track;
    if (!t) return;
    const was = this.liked;
    this.player.toggleLike(t);
    this.snackbar.say(was ? 'music.msg.unliked' : 'music.msg.liked', { name: t.title });
  }
  queue() {
    const t = this.track;
    if (!t) return;
    this.player.enqueue(t);
    this.snackbar.say('music.msg.queued', { name: t.title });
  }
}
