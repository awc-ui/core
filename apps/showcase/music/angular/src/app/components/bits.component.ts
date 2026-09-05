/**
 * The small, repeated pieces: a count, a clock, cover art, a peak strip, a
 * track row and the shelf cards.
 *
 * EVERY BINDING ONTO AN md-* ELEMENT IS [attr.x], NEVER [x].
 *
 * A lazily-hydrated custom element does not have the property yet when Angular
 * first binds, so a plain [icon] sets a field on a plain HTMLElement and the
 * component never sees it. The attribute form always lands, and Stencil reads
 * attributes on upgrade. This is the single most repeated correction in the
 * Angular ports and it fails silently every time.
 *
 * AND A BOOLEAN-ISH ATTRIBUTE IS ? '' : null, NOT ? true : false. Presence is
 * what these mean, and null is what removes an attribute in Angular — false
 * would render the literal string "false" and read as on.
 */
import {
  ChangeDetectionStrategy,
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  Input,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  albumById,
  artistById,
  clock,
  panPosition,
  volumeDb,
  type Album,
  type Artist,
  type Artwork,
  type Playlist,
  type Track,
} from '@awc-ui/showcase-kit/music';
import { ShowcaseService } from '../lib/showcase.service';
import { PlayerService } from '../lib/player.service';
import { appPath, route } from '../lib/routes';

@Component({
  /* `:host { display: contents }` — the Angular host must be transparent to
     layout, or it becomes a box between a grid and the element that was meant
     to be its child. A shelf of album cards would lay out the HOSTS, not the
     cards, and the parity check reads it as a different document. */
  styles: ':host { display: contents; }',
  selector: 'awc-count',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="num">{{ text }}</span>`,
})
export class CountComponent {
  private readonly showcase = inject(ShowcaseService);
  @Input({ required: true }) value!: number;
  /** "compact" only above ten thousand: below that it hides whether "9.9k" is
      9,900 or 9,949, and a play count is a number a reader compares. */
  @Input() compact = false;

  get text(): string {
    return this.showcase.t.formatNumber(
      this.value,
      this.compact && this.value >= 10_000
        ? { notation: 'compact', maximumFractionDigits: 1 }
        : { maximumFractionDigits: 0 },
    );
  }
}

@Component({
  /* `:host { display: contents }` — the Angular host must be transparent to
     layout, or it becomes a box between a grid and the element that was meant
     to be its child. A shelf of album cards would lay out the HOSTS, not the
     cards, and the parity check reads it as a different document. */
  styles: ':host { display: contents; }',
  selector: 'awc-clock',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="tabular">{{ text }}</span>`,
})
export class ClockComponent {
  @Input({ required: true }) seconds!: number;
  /* "clock()" from the kit, NOT "Intl": the digits stay Latin in every locale
     so the scrubber and the ruler's bar numbers cannot end up in two different
     numbering systems on one screen. */
  get text(): string { return clock(this.seconds); }
}

@Component({
  /* `:host { display: contents }` — the Angular host must be transparent to
     layout, or it becomes a box between a grid and the element that was meant
     to be its child. A shelf of album cards would lay out the HOSTS, not the
     cards, and the parity check reads it as a different document. */
  styles: ':host { display: contents; }',
  selector: 'awc-art',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<img
    [class]="className"
    [src]="art.src"
    [alt]="t(art.altKey)"
    [attr.loading]="eager ? 'eager' : 'lazy'"
    decoding="async"
    draggable="false"
  />`,
})
export class ArtComponent {
  private readonly showcase = inject(ShowcaseService);
  @Input({ required: true }) art!: Artwork;
  @Input() className = '';
  @Input() eager = false;
  /* "altKey" is mandatory on every "Artwork", and this is the only place an
     "<img>" is written — so there is exactly one function that could forget. */
  t = (key: string) => this.showcase.t(key);
}

@Component({
  /* `:host { display: contents }` — the Angular host must be transparent to
     layout, or it becomes a box between a grid and the element that was meant
     to be its child. A shelf of album cards would lay out the HOSTS, not the
     cards, and the parity check reads it as a different document. */
  styles: ':host { display: contents; }',
  selector: 'awc-peaks',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="peaks" aria-hidden="true"
    ><span *ngFor="let value of peaks" class="peaks__bar" [attr.data-h]="bucket(value)"></span
  ></span>`,
})
export class PeaksComponent {
  @Input({ required: true }) peaks!: readonly number[];
  /* THE HEIGHT IS A DATA ATTRIBUTE, NOT A STYLE: "style-src-attr none"
     refuses "style="height: 62%"", so each sample is rounded to one of eleven
     buckets and "app.css" carries a rule per bucket. */
  bucket = (v: number) => Math.round(Math.max(0, Math.min(1, v)) * 10);
}

@Component({
  /* `:host { display: contents }` — the Angular host must be transparent to
     layout, or it becomes a box between a grid and the element that was meant
     to be its child. A shelf of album cards would lay out the HOSTS, not the
     cards, and the parity check reads it as a different document. */
  styles: ':host { display: contents; }',
  selector: 'awc-track-row',
  standalone: true,
  imports: [CommonModule, RouterLink, ClockComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.Default,
  template: `
    <div class="track-row" [attr.data-track]="track.id" [attr.data-current]="current ? '' : null">
      <span class="track-row__index">{{ index ?? track.trackNumber }}</span>
      <span class="track-row__text">
        <a class="track-row__title link" [routerLink]="path(route.track(track.id))">{{ track.title }}</a>
        <span class="track-row__meta" *ngIf="showArtist">
          <a *ngIf="artist" class="link" [routerLink]="path(route.artist(artist.handle))">{{ artist.name }}</a>
        </span>
      </span>
      <span class="track-row__album" *ngIf="showAlbum">
        <a *ngIf="album" class="link" [routerLink]="path(route.album(album.slug))">{{ album.title }}</a>
      </span>
      <span class="track-row__time"><awc-clock [seconds]="track.durationSec" /></span>
      <span class="row">
        <!-- "toggle" + "selected"; the FILL comes from the font axis in
             "app.css", because the Outlined face draws both ligature names the
             same and swapping the name alone changes nothing. -->
        <md-icon-button
          class="track-row__like"
          toggle=""
          [attr.selected]="liked ? '' : null"
          [attr.icon]="liked ? 'favorite' : 'favorite_border'"
          size="sm"
          [attr.data-liked]="liked ? '' : null"
          [attr.aria-label]="t(liked ? 'music.action.unlike' : 'music.action.like') + ': ' + track.title"
          (click)="player.toggleLike(track)"
        ></md-icon-button>
        <md-icon-button
          class="track-row__play"
          [attr.icon]="current && player.transport().state === 'playing' ? 'pause' : 'play_arrow'"
          size="sm"
          [attr.aria-label]="t('music.action.play') + ': ' + track.title"
          (click)="current ? player.toggle() : player.play(track)"
        ></md-icon-button>
      </span>
    </div>
  `,
})
export class TrackRowComponent {
  private readonly showcase = inject(ShowcaseService);
  readonly player = inject(PlayerService);
  readonly route = route;

  @Input({ required: true }) track!: Track;
  @Input() index?: number;
  @Input() showArtist = true;
  @Input() showAlbum = false;

  get current() { return this.player.transport().trackId === this.track.id; }
  get liked() { return this.player.likedFor(this.track); }
  get artist(): Artist | null { return artistById(this.track.artistId); }
  get album(): Album | null { return albumById(this.track.albumId); }

  t = (key: string) => this.showcase.t(key);
  /* `routerLink` with `appPath()`: Angular's router matches unslashed paths
     while the kit's `route.*` produces slashed ones, and `appPath` is the one
     place that conversion happens. */
  path = (to: string) => appPath(to);
}

@Component({
  /* `:host { display: contents }` — the Angular host must be transparent to
     layout, or it becomes a box between a grid and the element that was meant
     to be its child. A shelf of album cards would lay out the HOSTS, not the
     cards, and the parity check reads it as a different document. */
  styles: ':host { display: contents; }',
  selector: 'awc-track-list',
  standalone: true,
  imports: [CommonModule, TrackRowComponent],
  changeDetection: ChangeDetectionStrategy.Default,
  /* The COLUMN COUNT lives on the list, not the row: rows in one list must all
     use the same grid template or the durations form a ragged edge. */
  template: `<div class="track-list" [attr.data-albums]="showAlbum ? '' : null">
    <awc-track-row
      *ngFor="let track of tracks; let at = index"
      [track]="track"
      [index]="numbered ? track.trackNumber : at + 1"
      [showArtist]="showArtist"
      [showAlbum]="showAlbum"
    />
  </div>`,
})
export class TrackListComponent {
  @Input({ required: true }) tracks!: readonly Track[];
  @Input() numbered = false;
  @Input() showArtist = true;
  @Input() showAlbum = false;
}

@Component({
  /* `:host { display: contents }` — the Angular host must be transparent to
     layout, or it becomes a box between a grid and the element that was meant
     to be its child. A shelf of album cards would lay out the HOSTS, not the
     cards, and the parity check reads it as a different document. */
  styles: ':host { display: contents; }',
  selector: 'awc-album-card',
  standalone: true,
  imports: [RouterLink, ArtComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<a class="shelf-card" [routerLink]="path">
    <awc-art [art]="album.art" className="shelf-card__art" />
    <span class="shelf-card__title">{{ album.title }}</span>
    <span class="shelf-card__meta">{{ artistName }}</span>
  </a>`,
})
export class AlbumCardComponent {
  private readonly showcase = inject(ShowcaseService);
  @Input({ required: true }) album!: Album;
  get path() { return appPath(route.album(this.album.slug)); }
  get artistName() { return artistById(this.album.artistId)?.name ?? ''; }
}

@Component({
  /* `:host { display: contents }` — the Angular host must be transparent to
     layout, or it becomes a box between a grid and the element that was meant
     to be its child. A shelf of album cards would lay out the HOSTS, not the
     cards, and the parity check reads it as a different document. */
  styles: ':host { display: contents; }',
  selector: 'awc-playlist-card',
  standalone: true,
  imports: [RouterLink, ArtComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<a class="shelf-card" [routerLink]="path">
    <awc-art [art]="playlist.art" className="shelf-card__art shelf-card__art--wide" />
    <span class="shelf-card__title">{{ playlist.title }}</span>
    <span class="shelf-card__meta">{{ meta }}</span>
  </a>`,
})
export class PlaylistCardComponent {
  private readonly showcase = inject(ShowcaseService);
  @Input({ required: true }) playlist!: Playlist;
  get path() { return appPath(route.library()); }
  get meta() {
    return this.showcase.t('music.count.tracks', {
      count: this.showcase.t.formatNumber(this.playlist.trackIds.length),
    });
  }
}

@Component({
  /* `:host { display: contents }` — the Angular host must be transparent to
     layout, or it becomes a box between a grid and the element that was meant
     to be its child. A shelf of album cards would lay out the HOSTS, not the
     cards, and the parity check reads it as a different document. */
  styles: ':host { display: contents; }',
  selector: 'awc-artist-row',
  standalone: true,
  imports: [RouterLink, ArtComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<a class="artist-row" [routerLink]="path">
    <awc-art [art]="artist.art" className="artist-row__art" />
    <span class="track-row__text">
      <span class="track-row__title">{{ artist.name }}</span>
      <span class="track-row__meta">{{ listeners }}</span>
    </span>
  </a>`,
})
export class ArtistRowComponent {
  private readonly showcase = inject(ShowcaseService);
  @Input({ required: true }) artist!: Artist;
  get path() { return appPath(route.artist(this.artist.handle)); }
  get listeners() {
    return this.showcase.t('music.label.listeners', {
      count: this.showcase.t.formatNumber(this.artist.monthlyListeners, {
        notation: 'compact',
        maximumFractionDigits: 1,
      }),
    });
  }
}

@Component({
  /* `:host { display: contents }` — the Angular host must be transparent to
     layout, or it becomes a box between a grid and the element that was meant
     to be its child. A shelf of album cards would lay out the HOSTS, not the
     cards, and the parity check reads it as a different document. */
  styles: ':host { display: contents; }',
  selector: 'awc-volume-readout',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="strip__readout">{{ text }}</span>`,
})
export class VolumeReadoutComponent {
  private readonly showcase = inject(ShowcaseService);
  @Input({ required: true }) volume!: number;
  /* `volumeDb()` returns null at zero rather than `-Infinity`: a fader all the
     way down reads "Silent". */
  get text() {
    const db = volumeDb(this.volume);
    return db === null
      ? this.showcase.t('music.label.silent')
      : this.showcase.t('music.label.decibels', {
          value: this.showcase.t.formatNumber(db, { maximumFractionDigits: 1 }),
        });
  }
}

@Component({
  /* `:host { display: contents }` — the Angular host must be transparent to
     layout, or it becomes a box between a grid and the element that was meant
     to be its child. A shelf of album cards would lay out the HOSTS, not the
     cards, and the parity check reads it as a different document. */
  styles: ':host { display: contents; }',
  selector: 'awc-pan-readout',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="strip__readout">{{ text }}</span>`,
})
export class PanReadoutComponent {
  private readonly showcase = inject(ShowcaseService);
  @Input({ required: true }) pan!: number;
  /* A side and an amount, never a signed number: "L 0" and "R 0" are both
     wrong, and a build formatting a signed float produces one of them. */
  get text() {
    const position = panPosition(this.pan);
    if (position.side === 'centre') return this.showcase.t('music.label.panCentre');
    return this.showcase.t(
      position.side === 'left' ? 'music.label.panLeft' : 'music.label.panRight',
      { amount: this.showcase.t.formatNumber(position.amount) },
    );
  }
}

@Component({
  /* `:host { display: contents }` — the Angular host must be transparent to
     layout, or it becomes a box between a grid and the element that was meant
     to be its child. A shelf of album cards would lay out the HOSTS, not the
     cards, and the parity check reads it as a different document. */
  styles: ':host { display: contents; }',
  selector: 'awc-date-text',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<time [attr.datetime]="at">{{ text }}</time>`,
})
export class DateTextComponent {
  private readonly showcase = inject(ShowcaseService);
  @Input({ required: true }) at!: string;
  get text() { return this.showcase.t.formatDate(this.at.slice(0, 10), 'medium'); }
}
