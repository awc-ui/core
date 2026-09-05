/**
 * The small pieces every screen composes from.
 *
 * ANYTHING RENDERED THE SAME WAY ON TWO SCREENS BELONGS HERE. A track row is on
 * five screens and a peak strip on four; written twice they would be identical
 * until the first correction, and the correction is always applied to one of
 * them. Everything here is presentational — it takes what it draws and reaches
 * for the player only where the thing it draws IS a control.
 */

import {
  MAX_BARS,
  REPORTING_INSTANT,
  albumById,
  artistById,
  clock,
  libraryIcon,
  panPosition,
  trackIcon,
  trackLabelKey,
  volumeDb,
  type Album,
  type Artist,
  type Artwork,
  type Playlist,
  type StudioTrack,
  type Track,
} from '@awc-ui/showcase-kit/music';
import type { ReactNode } from 'react';
import { useT } from '@/lib/showcase';
import { Link } from '@/lib/router';
import { route, withBase } from '@/lib/routes';
import { usePlayer } from '@/lib/player';

/* ------------------------------------------------------------------ numbers */

/**
 * A number, formatted for the reader's locale.
 *
 * `compact` only above ten thousand. Below that the compact form loses more
 * than it saves — "9.9k plays" hides whether that is 9,900 or 9,949, and a play
 * count is a number a reader compares.
 */
export function Count({ value, compact = false }: { value: number; compact?: boolean }) {
  const t = useT();
  return (
    <span className="num">
      {t.formatNumber(
        value,
        compact && value >= 10_000
          ? { notation: 'compact', maximumFractionDigits: 1 }
          : { maximumFractionDigits: 0 },
      )}
    </span>
  );
}

/**
 * A duration or a position, as mm:ss.
 *
 * `clock()` from the kit, and NOT `Intl` — see the note on it. The digits stay
 * Latin in every locale so the scrubber's two readouts and the ruler's bar
 * numbers do not end up in two different numbering systems on the same screen.
 */
export function Clock({ seconds }: { seconds: number }) {
  return <span className="tabular">{clock(seconds)}</span>;
}

/** How long ago, in words, inside a `<time>` that still carries the instant. */
export function When({ at }: { at: string }) {
  const t = useT();
  return (
    <time dateTime={at} title={t.formatDate(at.slice(0, 10), 'long')} className="when">
      {t.formatRelativeTime(at, REPORTING_INSTANT, { style: 'narrow' })}
    </time>
  );
}

/** A calendar date, for a project's "updated" line. */
export function DateText({ at }: { at: string }) {
  const t = useT();
  return <time dateTime={at}>{t.formatDate(at.slice(0, 10), 'medium')}</time>;
}

/* ------------------------------------------------------------------ artwork */

/**
 * Cover art.
 *
 * `altKey` IS MANDATORY on every `Artwork` in the fixture and this is the only
 * place an `<img>` is written, so there is exactly one function that could
 * forget to resolve it. Generated abstract artwork is not self-explanatory the
 * way a photograph is, which is why the rule exists at all.
 */
export function Art({
  art,
  className,
  eager = false,
}: {
  art: Artwork;
  className?: string;
  eager?: boolean;
}) {
  const t = useT();
  return (
    <img
      className={className}
      src={art.src}
      alt={t(art.altKey)}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      draggable={false}
    />
  );
}

/* -------------------------------------------------------------- peak strips */

/**
 * A run of loudness samples as bars.
 *
 * THE HEIGHT IS A DATA ATTRIBUTE, NOT A STYLE. `style-src-attr 'none'` refuses
 * `style="height: 62%"`, so each sample is rounded to one of eleven buckets and
 * `app.css` carries a rule per bucket. Coarser than the data and imperceptible
 * at three pixels wide.
 *
 * `aria-hidden`, because it is a texture rather than information: the numbers a
 * reader needs are the duration and the title beside it, and sixteen unlabelled
 * bars announced individually would be noise.
 */
export function Peaks({ peaks }: { peaks: readonly number[] }) {
  return (
    <span className="peaks" aria-hidden="true">
      {peaks.map((value, index) => (
        <span key={index} className="peaks__bar" data-h={Math.round(Math.max(0, Math.min(1, value)) * 10)} />
      ))}
    </span>
  );
}

/* ------------------------------------------------------------- track naming */

/** An artist's name as a link, or plain text when the artist is missing. */
export function ArtistLink({ id }: { id: string }) {
  const artist = artistById(id);
  if (!artist) return null;
  return (
    <Link className="link" href={withBase(route.artist(artist.handle))}>
      {artist.name}
    </Link>
  );
}

/** An album's title as a link. */
export function AlbumLink({ id }: { id: string }) {
  const album = albumById(id);
  if (!album) return null;
  return (
    <Link className="link" href={withBase(route.album(album.slug))}>
      {album.title}
    </Link>
  );
}

/* ------------------------------------------------------------- track rows */

/**
 * One row in a track list.
 *
 * IT MARKS ITSELF WHEN IT IS THE LOADED TRACK, on every screen that lists it —
 * `data-current` comes from the transport, so a reader never has to look at the
 * bar to find where they are. That is the visible payoff of holding the
 * transport above the router.
 *
 * THE WHOLE ROW IS NOT A LINK. It carries a play button, a like button and a
 * link to the track, and a control inside an anchor fires both on a keyboard
 * press. The title is the link; the row is a grid.
 */
export function TrackRow({
  track,
  index,
  showArtist = true,
  showAlbum = false,
}: {
  track: Track;
  index?: number;
  showArtist?: boolean;
  /**
   * A middle column naming the album.
   *
   * ON BY DEFAULT ONLY WHERE IT SAYS SOMETHING. A list drawn from across the
   * library — Home, Liked, the queue — has a different album on every row, and
   * without it the row is a short label on the left and a duration on the far
   * right with a hand's width of nothing between them. On an ALBUM screen every
   * row would repeat the title above it, which is noise. The list decides,
   * because every row in one list has to agree or the columns stop lining up.
   */
  showAlbum?: boolean;
}) {
  const t = useT();
  const player = usePlayer();
  const current = player.transport.trackId === track.id;
  const liked = player.likedFor(track);

  return (
    <div className="track-row" data-track={track.id} data-current={current ? '' : undefined}>
      <span className="track-row__index">{index ?? track.trackNumber}</span>
      <span className="track-row__text">
        <Link className="track-row__title link" href={withBase(route.track(track.id))}>
          {track.title}
        </Link>
        {showArtist ? (
          <span className="track-row__meta">
            <ArtistLink id={track.artistId} />
          </span>
        ) : null}
      </span>
      {showAlbum ? (
        <span className="track-row__album">
          <AlbumLink id={track.albumId} />
        </span>
      ) : null}
      <span className="track-row__time">
        <Clock seconds={track.durationSec} />
      </span>
      <span className="row">
        {/*
          * `toggle` + `selected` + `selectedIcon`, WHICH IS WHAT THE COMPONENT
          * IS FOR — and this was `color="primary"` first, an attribute
          * `md-icon-button` does not have. An unknown attribute is not an
          * error: it sat in the markup doing nothing, so a liked track swapped
          * its glyph and stayed exactly the same grey as an unliked one. The
          * component's own toggle mode paints the selected state, which is the
          * difference between "this control exists" and "this control is on".
          *
          * THE GLYPH IS STILL DRIVEN FROM `icon` rather than `selected-icon`.
          * Both were set at first and only the tint changed — the heart stayed
          * an outline while turning primary, which reads as a hover rather than
          * a state. Setting `icon` from the liked flag is one source of truth
          * for the shape and cannot half-apply.
          *
          * The name says WHICH track, because a list of twelve buttons all
          * called "Like" tells a screen-reader user nothing about which one
          * they are on.
          */}
        <md-icon-button
          class="track-row__like"
          toggle
          selected={liked || undefined}
          icon={liked ? 'favorite' : 'favorite_border'}
          size="sm"
          data-liked={liked ? '' : undefined}
          aria-label={`${t(liked ? 'music.action.unlike' : 'music.action.like')}: ${track.title}`}
          onClick={() => player.toggleLike(track)}
        />
        <md-icon-button
          class="track-row__play"
          icon={current && player.transport.state === 'playing' ? 'pause' : 'play_arrow'}
          size="sm"
          aria-label={`${t('music.action.play')}: ${track.title}`}
          onClick={() => (current ? player.toggle() : player.play(track))}
        />
      </span>
    </div>
  );
}

/** A whole list of them, numbered by position rather than by track number. */
export function TrackList({
  tracks,
  numbered = false,
  showArtist = true,
  showAlbum = false,
}: {
  tracks: readonly Track[];
  numbered?: boolean;
  showArtist?: boolean;
  showAlbum?: boolean;
}) {
  /* The COLUMN COUNT lives on the list, not the row: rows in one list must all
     use the same grid template or the durations form a ragged edge, which is
     the whole reason a row is a grid rather than a flex line. */
  return (
    <div className="track-list" data-albums={showAlbum ? '' : undefined}>
      {tracks.map((track, at) => (
        <TrackRow
          key={track.id}
          track={track}
          index={numbered ? track.trackNumber : at + 1}
          showArtist={showArtist}
          showAlbum={showAlbum}
        />
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- shelves */

/** A square card for an album or a project, or a wide one for a playlist. */
export function ShelfCard({
  href,
  art,
  title,
  meta,
}: {
  href: string;
  art: Artwork;
  title: string;
  meta?: ReactNode;
}) {
  return (
    <Link className="shelf-card" href={href}>
      <Art art={art} className={`shelf-card__art${art.shape === 'wide' ? ' shelf-card__art--wide' : ''}`} />
      <span className="shelf-card__title">{title}</span>
      {meta ? <span className="shelf-card__meta">{meta}</span> : null}
    </Link>
  );
}

export function AlbumCard({ album }: { album: Album }) {
  return (
    <ShelfCard
      href={withBase(route.album(album.slug))}
      art={album.art}
      title={album.title}
      meta={<ArtistName id={album.artistId} />}
    />
  );
}

/** The artist's name as TEXT, for inside a card that is already a link. */
export function ArtistName({ id }: { id: string }) {
  return <>{artistById(id)?.name ?? ''}</>;
}

export function PlaylistCard({ playlist }: { playlist: Playlist }) {
  const t = useT();
  return (
    <ShelfCard
      href={withBase(route.library())}
      art={playlist.art}
      title={playlist.title}
      meta={t('music.count.tracks', { count: t.formatNumber(playlist.trackIds.length) })}
    />
  );
}

export function ArtistRow({ artist }: { artist: Artist }) {
  const t = useT();
  return (
    <Link className="artist-row" href={withBase(route.artist(artist.handle))}>
      <Art art={artist.art} className="artist-row__art" />
      <span className="track-row__text">
        <span className="track-row__title">{artist.name}</span>
        <span className="track-row__meta">
          {t('music.label.listeners', { count: t.formatNumber(artist.monthlyListeners, { notation: 'compact', maximumFractionDigits: 1 }) })}
        </span>
      </span>
    </Link>
  );
}

/* ----------------------------------------------------------- studio bits */

/** A studio track's icon and translated kind. */
export function TrackKindMark({ track }: { track: StudioTrack }) {
  const t = useT();
  return (
    <>
      <span className="material-symbols-outlined" aria-hidden="true">
        {trackIcon[track.kind]}
      </span>
      <span className="visually-hidden">{t(trackLabelKey[track.kind])}</span>
    </>
  );
}

/**
 * A fader's decibel readout, or the word for silence.
 *
 * `volumeDb()` returns null at zero rather than `-Infinity`, and this is the
 * only place that decision is visible: a fader pulled all the way down reads
 * "Silent", not "-Infinity dB".
 */
export function VolumeReadout({ volume }: { volume: number }) {
  const t = useT();
  const db = volumeDb(volume);
  return (
    <span className="strip__readout">
      {db === null ? t('music.label.silent') : t('music.label.decibels', { value: t.formatNumber(db, { maximumFractionDigits: 1 }) })}
    </span>
  );
}

/** A pan position, as a side and an amount — never a signed number. */
export function PanReadout({ pan }: { pan: number }) {
  const t = useT();
  const position = panPosition(pan);
  if (position.side === 'centre') return <span className="strip__readout">{t('music.label.panCentre')}</span>;
  return (
    <span className="strip__readout">
      {t(position.side === 'left' ? 'music.label.panLeft' : 'music.label.panRight', {
        amount: t.formatNumber(position.amount),
      })}
    </span>
  );
}

/** The library kind icon, for a row that could be any of three things. */
export function KindIcon({ kind }: { kind: 'album' | 'playlist' | 'artist' }) {
  return (
    <span className="material-symbols-outlined" aria-hidden="true">
      {libraryIcon[kind]}
    </span>
  );
}

export { MAX_BARS };
