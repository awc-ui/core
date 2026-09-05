/**
 * Home — the shelves are shelves, not a feed: short scannable rows the reader
 * recognises, each answering a different question.
 */
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  followedArtists,
  getTotals,
  ownPlaylists,
  recentAlbums,
  topTracks,
} from '@awc-ui/showcase-kit/music';
import { ScreenComponent } from '../components/screen.component';
import { PanelComponent } from '../components/panel.component';
import {
  AlbumCardComponent,
  ArtistRowComponent,
  CountComponent,
  PlaylistCardComponent,
  TrackListComponent,
} from '../components/bits.component';
import { HomeSkeletonComponent } from '../components/skeletons.component';
import { ShowcaseService } from '../lib/showcase.service';

@Component({
  /* `:host { display: contents }` — the Angular host must be transparent to
     layout, or it becomes a box between a grid and the element that was meant
     to be its child. A shelf of album cards would lay out the HOSTS, not the
     cards, and the parity check reads it as a different document. */
  styles: ':host { display: contents; }',
  selector: 'awc-home-screen',
  standalone: true,
  imports: [
    CommonModule, ScreenComponent, PanelComponent, CountComponent, TrackListComponent,
    AlbumCardComponent, PlaylistCardComponent, ArtistRowComponent, HomeSkeletonComponent,
  ],
  changeDetection: ChangeDetectionStrategy.Default,
  template: `
    <awc-screen [title]="t('music.screen.home.title')" [subtitle]="t('music.screen.home.subtitle')">
      <awc-count aside [value]="totals.tracks" />
      <awc-home-skeleton skeleton />

      <div class="stack">
        <awc-panel [title]="t('music.panel.topTracks')">
          <awc-count actions [value]="tracks.length" />
          <awc-track-list [tracks]="tracks" [showAlbum]="true" />
        </awc-panel>

        <awc-panel [title]="t('music.panel.recent')">
          <awc-count actions [value]="albums.length" />
          <div class="shelf">
            <awc-album-card *ngFor="let album of albums" [album]="album" />
          </div>
        </awc-panel>

        <awc-panel [title]="t('music.panel.yourPlaylists')">
          <awc-count actions [value]="playlists.length" />
          <div class="shelf">
            <awc-playlist-card *ngFor="let playlist of playlists" [playlist]="playlist" />
          </div>
        </awc-panel>

        <awc-panel [title]="t('music.panel.artists')">
          <awc-count actions [value]="artists.length" />
          <div class="stack">
            <awc-artist-row *ngFor="let artist of artists" [artist]="artist" />
          </div>
        </awc-panel>
      </div>
    </awc-screen>
  `,
})
export class HomeScreen {
  private readonly showcase = inject(ShowcaseService);
  readonly totals = getTotals();
  readonly tracks = topTracks(6);
  readonly albums = recentAlbums(6);
  readonly playlists = ownPlaylists().slice(0, 4);
  readonly artists = followedArtists().slice(0, 4);
  t = (key: string) => this.showcase.t(key);
}
