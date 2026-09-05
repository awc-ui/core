/**
 * Every question a screen asks of the fixture.
 *
 * A SCREEN NEVER TOUCHES `generated.ts`. It asks here, and what it gets back is
 * already ordered, already filtered and already resolved — which is what makes
 * "five builds render the same list" a property of this file rather than a
 * coincidence five times over. A build that sorted for itself would be one
 * `localeCompare` away from a parity failure.
 *
 * Nothing here is memoised. The fixture is a few hundred records and every one
 * of these is a single pass; a cache would be five caches with five
 * invalidation bugs.
 */

import { FIXTURE } from './generated';
import { totalDuration } from './derive';
import { TRACK_PAGE } from './types';
import type { Album, Artist, Playlist, Project, StudioTrack, Clip, Track } from './types';

/* ------------------------------------------------------------- the basics */

export const getFixture = () => FIXTURE;
export const getTotals = () => FIXTURE.totals;
export const getViewer = () => FIXTURE.viewer;

export const getArtists = (): readonly Artist[] => FIXTURE.artists;
export const getAlbums = (): readonly Album[] => FIXTURE.albums;
export const getTracks = (): readonly Track[] => FIXTURE.tracks;
export const getPlaylists = (): readonly Playlist[] => FIXTURE.playlists;
export const getProjects = (): readonly Project[] => FIXTURE.projects;
export const getStudioTracks = (): readonly StudioTrack[] => FIXTURE.studioTracks;
export const getClips = (): readonly Clip[] => FIXTURE.clips;
export const getQueue = (): readonly string[] => FIXTURE.queue;

/* ------------------------------------------------------------ by identity */

export const artistById = (id: string): Artist | null =>
  FIXTURE.artists.find((a) => a.id === id) ?? null;

export const artistByHandle = (handle: string): Artist | null =>
  FIXTURE.artists.find((a) => a.handle === handle) ?? null;

export const albumById = (id: string): Album | null =>
  FIXTURE.albums.find((a) => a.id === id) ?? null;

export const albumBySlug = (slug: string): Album | null =>
  FIXTURE.albums.find((a) => a.slug === slug) ?? null;

export const trackById = (id: string): Track | null =>
  FIXTURE.tracks.find((t) => t.id === id) ?? null;

export const playlistBySlug = (slug: string): Playlist | null =>
  FIXTURE.playlists.find((p) => p.slug === slug) ?? null;

export const projectBySlug = (slug: string): Project | null =>
  FIXTURE.projects.find((p) => p.slug === slug) ?? null;

export const studioTrackById = (id: string): StudioTrack | null =>
  FIXTURE.studioTracks.find((t) => t.id === id) ?? null;

/* --------------------------------------------------------------- listening */

/**
 * An album's tracks, in ALBUM order rather than fixture order.
 *
 * `trackIds` is the running order and is the only thing that knows it. Sorting
 * by `trackNumber` would give the same answer today and a different one the
 * first time a fixture holds a compilation, where the numbers restart per disc.
 */
export function albumTracks(album: Album): readonly Track[] {
  return album.trackIds
    .map((id) => trackById(id))
    .filter((t): t is Track => t !== null);
}

export function playlistTracks(playlist: Playlist): readonly Track[] {
  return playlist.trackIds
    .map((id) => trackById(id))
    .filter((t): t is Track => t !== null);
}

/** Everything an artist released, newest first. */
export function artistAlbums(artist: Artist): readonly Album[] {
  return FIXTURE.albums
    .filter((album) => album.artistId === artist.id)
    .slice()
    .sort((a, b) => b.year - a.year || a.title.localeCompare(b.title));
}

/**
 * An artist's most-played tracks.
 *
 * TIES BREAK ON TITLE, not on fixture order. Two tracks with the same play
 * count are otherwise ordered by whichever the generator emitted first, and
 * `Array.prototype.sort` is only stable within one engine's implementation —
 * so the five builds could legitimately disagree.
 */
export function artistTopTracks(artist: Artist, limit = 5): readonly Track[] {
  return FIXTURE.tracks
    .filter((track) => track.artistId === artist.id)
    .slice()
    .sort((a, b) => b.playCount - a.playCount || a.title.localeCompare(b.title))
    .slice(0, limit);
}

/** The tracks the viewer has liked, most-played first. */
export function likedTracks(limit = TRACK_PAGE): readonly Track[] {
  return FIXTURE.tracks
    .filter((track) => track.liked)
    .slice()
    .sort((a, b) => b.playCount - a.playCount || a.title.localeCompare(b.title))
    .slice(0, limit);
}

/** What the home screen leads with: the most played, across everything. */
export function topTracks(limit = 6): readonly Track[] {
  return FIXTURE.tracks
    .slice()
    .sort((a, b) => b.playCount - a.playCount || a.title.localeCompare(b.title))
    .slice(0, limit);
}

/** Albums for the home screen's shelf, newest first. */
export function recentAlbums(limit = 6): readonly Album[] {
  return FIXTURE.albums
    .slice()
    .sort((a, b) => b.year - a.year || a.title.localeCompare(b.title))
    .slice(0, limit);
}

/** The playlists the viewer made, most recently touched first. */
export function ownPlaylists(): readonly Playlist[] {
  return FIXTURE.playlists
    .filter((p) => p.own)
    .slice()
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** And the ones they only follow. */
export function followedPlaylists(): readonly Playlist[] {
  return FIXTURE.playlists
    .filter((p) => !p.own)
    .slice()
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function followedArtists(): readonly Artist[] {
  return FIXTURE.artists
    .filter((a) => a.followed)
    .slice()
    .sort((a, b) => b.monthlyListeners - a.monthlyListeners || a.name.localeCompare(b.name));
}

/* ------------------------------------------------------------------ studio */

/** A project's tracks, in the project's own order. */
export function projectTracks(project: Project): readonly StudioTrack[] {
  return project.trackIds
    .map((id) => studioTrackById(id))
    .filter((t): t is StudioTrack => t !== null);
}

/**
 * A track's clips, left to right.
 *
 * ORDERED BY START BAR, because the DOM order of a lane's clips is what a
 * keyboard walks through, and reading them in fixture order would tab around
 * the timeline at random.
 */
export function trackClips(trackId: string): readonly Clip[] {
  return FIXTURE.clips
    .filter((clip) => clip.trackId === trackId)
    .slice()
    .sort((a, b) => a.startBar - b.startBar || a.id.localeCompare(b.id));
}

/** Every clip in a project, for a count or an emptiness check. */
export function projectClips(project: Project): readonly Clip[] {
  const ids = new Set(project.trackIds);
  return FIXTURE.clips
    .filter((clip) => ids.has(clip.trackId))
    .slice()
    .sort((a, b) => a.startBar - b.startBar || a.id.localeCompare(b.id));
}

/** The project Studio opens with: the most recently touched. */
export function currentProject(): Project | null {
  return (
    FIXTURE.projects
      .slice()
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null
  );
}

/* ------------------------------------------------------------------ search */

/**
 * One search over three kinds of thing.
 *
 * CASE- AND ACCENT-INSENSITIVE, via `localeCompare`-style normalisation rather
 * than `toLowerCase()` alone: the fixture holds names like "Bjørk Sandø" and
 * "Renée Aubry", and a reader typing `rene` should find the second. `NFD` plus
 * a combining-marks strip is the cheapest correct way and it behaves the same
 * in every engine the five builds run in.
 */
const fold = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

export interface SearchHits {
  readonly tracks: readonly Track[];
  readonly albums: readonly Album[];
  readonly artists: readonly Artist[];
}

export function search(query: string, limit = 5): SearchHits {
  const needle = fold(query.trim());
  if (needle === '') return { tracks: [], albums: [], artists: [] };
  const match = (value: string) => fold(value).includes(needle);
  return {
    tracks: FIXTURE.tracks.filter((t) => match(t.title)).slice(0, limit),
    albums: FIXTURE.albums.filter((a) => match(a.title)).slice(0, limit),
    artists: FIXTURE.artists.filter((a) => match(a.name)).slice(0, limit),
  };
}

/* ------------------------------------------------------------------ totals */

/** An album's running time, for its header. */
export const albumDuration = (album: Album): number => totalDuration(albumTracks(album));

/** A playlist's running time, for its header. */
export const playlistDuration = (playlist: Playlist): number =>
  totalDuration(playlistTracks(playlist));
