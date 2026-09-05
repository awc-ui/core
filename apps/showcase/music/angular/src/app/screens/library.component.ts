/**
 * Library — four sections ordered by how often they are opened, not
 * alphabetically: liked tracks first, because that is the list people live in.
 */
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  followedPlaylists,
  getAlbums,
  getTotals,
  likedTracks,
  ownPlaylists,
} from '@awc-ui/showcase-kit/music';
import { ScreenComponent } from '../components/screen.component';
import { PanelComponent } from '../components/panel.component';
import { EmptyStateComponent } from '../components/empty-state.component';
import {
  AlbumCardComponent,
  CountComponent,
  PlaylistCardComponent,
  TrackListComponent,
} from '../components/bits.component';
import { LibrarySkeletonComponent } from '../components/skeletons.component';
import { ShowcaseService } from '../lib/showcase.service';

@Component({
  /* `:host { display: contents }` — the Angular host must be transparent to
     layout, or it becomes a box between a grid and the element that was meant
     to be its child. A shelf of album cards would lay out the HOSTS, not the
     cards, and the parity check reads it as a different document. */
  styles: ':host { display: contents; }',
  selector: 'awc-library-screen',
  standalone: true,
  imports: [
    CommonModule, ScreenComponent, PanelComponent, EmptyStateComponent, CountComponent,
    TrackListComponent, AlbumCardComponent, PlaylistCardComponent, LibrarySkeletonComponent,
  ],
  changeDetection: ChangeDetectionStrategy.Default,
  template: `
    <awc-screen [title]="t('music.screen.library.title')" [subtitle]="t('music.screen.library.subtitle')">
      <awc-count aside [value]="totals.tracks" />
      <awc-library-skeleton skeleton />

      <div class="stack">
        <awc-panel [title]="t('music.panel.liked')">
          <awc-count actions [value]="liked.length" />
          <awc-empty-state *ngIf="liked.length === 0" [message]="t('music.empty.liked')" />
          <awc-track-list *ngIf="liked.length > 0" [tracks]="liked" [showAlbum]="true" />
        </awc-panel>

        <awc-panel [title]="t('music.panel.yourPlaylists')">
          <awc-count actions [value]="own.length" />
          <div class="shelf"><awc-playlist-card *ngFor="let p of own" [playlist]="p" /></div>
        </awc-panel>

        <awc-panel [title]="t('music.panel.followedPlaylists')">
          <awc-count actions [value]="followed.length" />
          <div class="shelf"><awc-playlist-card *ngFor="let p of followed" [playlist]="p" /></div>
        </awc-panel>

        <awc-panel [title]="t('music.panel.albums')">
          <awc-count actions [value]="albums.length" />
          <div class="shelf"><awc-album-card *ngFor="let a of albums" [album]="a" /></div>
        </awc-panel>
      </div>
    </awc-screen>
  `,
})
export class LibraryScreen {
  private readonly showcase = inject(ShowcaseService);
  readonly totals = getTotals();
  readonly liked = likedTracks();
  readonly own = ownPlaylists();
  readonly followed = followedPlaylists();
  readonly albums = getAlbums();
  t = (key: string) => this.showcase.t(key);
}
