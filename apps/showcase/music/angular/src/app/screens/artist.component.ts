import { ChangeDetectionStrategy, Component, CUSTOM_ELEMENTS_SCHEMA, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { artistAlbums, artistByHandle, artistTopTracks } from '@awc-ui/showcase-kit/music';
import { ScreenComponent } from '../components/screen.component';
import { PanelComponent } from '../components/panel.component';
import { AlbumCardComponent, ArtComponent, CountComponent, TrackListComponent } from '../components/bits.component';
import { ReleaseSkeletonComponent } from '../components/skeletons.component';
import { NotFoundScreen } from './not-found.component';
import { ShowcaseService } from '../lib/showcase.service';
import { PlayerService } from '../lib/player.service';
import { SnackbarService } from '../lib/snackbar.service';

@Component({
  /* `:host { display: contents }` — the Angular host must be transparent to
     layout, or it becomes a box between a grid and the element that was meant
     to be its child. A shelf of album cards would lay out the HOSTS, not the
     cards, and the parity check reads it as a different document. */
  styles: ':host { display: contents; }',
  selector: 'awc-artist-screen',
  standalone: true,
  imports: [
    CommonModule, ScreenComponent, PanelComponent, CountComponent, ArtComponent,
    TrackListComponent, AlbumCardComponent, ReleaseSkeletonComponent, NotFoundScreen,
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.Default,
  template: `
    <awc-not-found-screen *ngIf="!artist" />
    <awc-screen *ngIf="artist as a" [title]="a.name" [subtitle]="t('music.screen.artist.subtitle')" [crumbLabel]="a.name">
      <awc-count aside [value]="albums.length" />
      <awc-release-skeleton skeleton />

      <div class="stack">
        <awc-panel>
          <div class="release-head">
            <awc-art [art]="a.art" className="release-head__art" [eager]="true" />
            <div class="release-head__text">
              <h2 class="release-head__title">{{ a.name }}</h2>
              <p class="person-row__meta">{{ listeners }}</p>
              <p>{{ t(a.bioKey) }}</p>
              <div class="row">
                <md-button
                  class="artist__follow"
                  [attr.variant]="followed ? 'outlined' : 'filled'"
                  [attr.icon]="followed ? 'check' : 'person_add'"
                  [attr.data-followed]="followed ? '' : null"
                  (click)="follow()"
                >{{ t(followed ? 'music.action.unfollow' : 'music.action.follow') }}</md-button>
              </div>
            </div>
          </div>
        </awc-panel>

        <awc-panel [title]="t('music.panel.topTracks')">
          <awc-count actions [value]="top.length" />
          <awc-track-list [tracks]="top" [showArtist]="false" [showAlbum]="true" />
        </awc-panel>

        <awc-panel [title]="t('music.panel.discography')">
          <awc-count actions [value]="albums.length" />
          <div class="shelf"><awc-album-card *ngFor="let al of albums" [album]="al" /></div>
        </awc-panel>
      </div>
    </awc-screen>
  `,
})
export class ArtistScreen {
  private readonly showcase = inject(ShowcaseService);
  private readonly player = inject(PlayerService);
  private readonly snackbar = inject(SnackbarService);
  @Input({ required: true }) handle!: string;

  get artist() { return artistByHandle(this.handle); }
  get albums() { const a = this.artist; return a ? artistAlbums(a) : []; }
  get top() { const a = this.artist; return a ? artistTopTracks(a) : []; }
  get followed() {
    const a = this.artist;
    return a ? this.player.followedFor(a.handle, a.followed) : false;
  }
  get listeners() {
    const a = this.artist;
    if (!a) return '';
    return this.showcase.t('music.label.listeners', {
      count: this.showcase.t.formatNumber(a.monthlyListeners, { notation: 'compact', maximumFractionDigits: 1 }),
    });
  }

  t = (key: string) => this.showcase.t(key);

  follow() {
    const a = this.artist;
    if (!a) return;
    const was = this.followed;
    this.player.toggleFollow(a.handle, a.followed);
    this.snackbar.say(was ? 'music.msg.unfollowed' : 'music.msg.followed', { name: a.name });
  }
}
