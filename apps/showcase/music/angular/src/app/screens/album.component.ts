import { ChangeDetectionStrategy, Component, CUSTOM_ELEMENTS_SCHEMA, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  albumBySlug, albumDuration, albumTracks, artistAlbums, artistById, clock,
} from '@awc-ui/showcase-kit/music';
import { ScreenComponent } from '../components/screen.component';
import { PanelComponent } from '../components/panel.component';
import { AlbumCardComponent, ArtComponent, CountComponent, TrackListComponent } from '../components/bits.component';
import { ReleaseSkeletonComponent } from '../components/skeletons.component';
import { NotFoundScreen } from './not-found.component';
import { ShowcaseService } from '../lib/showcase.service';
import { PlayerService } from '../lib/player.service';
import { appPath, route } from '../lib/routes';

@Component({
  /* `:host { display: contents }` — the Angular host must be transparent to
     layout, or it becomes a box between a grid and the element that was meant
     to be its child. A shelf of album cards would lay out the HOSTS, not the
     cards, and the parity check reads it as a different document. */
  styles: ':host { display: contents; }',
  selector: 'awc-album-screen',
  standalone: true,
  imports: [
    CommonModule, RouterLink, ScreenComponent, PanelComponent, CountComponent, ArtComponent,
    TrackListComponent, AlbumCardComponent, ReleaseSkeletonComponent, NotFoundScreen,
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.Default,
  template: `
    <awc-not-found-screen *ngIf="!album" />
    <awc-screen *ngIf="album as a" [title]="a.title" [subtitle]="t('music.screen.album.subtitle')" [crumbLabel]="a.title">
      <awc-count aside [value]="tracks.length" />
      <awc-release-skeleton skeleton />

      <div class="stack">
        <awc-panel>
          <div class="release-head">
            <awc-art [art]="a.art" className="release-head__art" [eager]="true" />
            <div class="release-head__text">
              <h2 class="release-head__title">{{ a.title }}</h2>
              <div class="row">
                <a *ngIf="artist as ar" class="link" [routerLink]="artistPath">{{ ar.name }}</a>
                <span class="person-row__meta">{{ a.year }}</span>
                <span class="person-row__meta">{{ trackCount }}</span>
                <span class="person-row__meta">{{ duration }}</span>
              </div>
              <div class="row">
                <md-button class="release-head__play" variant="filled" icon="play_arrow" (click)="playAll()">
                  {{ t('music.action.playAll') }}
                </md-button>
              </div>
            </div>
          </div>
        </awc-panel>

        <awc-panel [title]="t('music.panel.tracks')">
          <awc-count actions [value]="tracks.length" />
          <!-- Numbered by TRACK NUMBER: on an album the running order is the
               number printed on the sleeve. -->
          <awc-track-list [tracks]="tracks" [numbered]="true" [showArtist]="false" />
        </awc-panel>

        <awc-panel *ngIf="others.length > 0" [title]="t('music.panel.discography')">
          <awc-count actions [value]="others.length" />
          <div class="shelf"><awc-album-card *ngFor="let o of others" [album]="o" /></div>
        </awc-panel>
      </div>
    </awc-screen>
  `,
})
export class AlbumScreen {
  private readonly showcase = inject(ShowcaseService);
  private readonly player = inject(PlayerService);
  @Input({ required: true }) slug!: string;

  get album() { return albumBySlug(this.slug); }
  get artist() { const a = this.album; return a ? artistById(a.artistId) : null; }
  get tracks() { const a = this.album; return a ? albumTracks(a) : []; }
  get others() {
    const ar = this.artist;
    return ar ? artistAlbums(ar).filter((x) => x.id !== this.album?.id) : [];
  }
  get artistPath() { const ar = this.artist; return ar ? appPath(route.artist(ar.handle)) : ''; }
  get trackCount() {
    return this.showcase.t('music.count.tracks', { count: this.showcase.t.formatNumber(this.tracks.length) });
  }
  get duration() { const a = this.album; return a ? clock(albumDuration(a)) : ''; }

  t = (key: string) => this.showcase.t(key);
  playAll() { const first = this.tracks[0]; if (first) this.player.play(first); }
}
