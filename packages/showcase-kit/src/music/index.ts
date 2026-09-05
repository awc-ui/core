/**
 * The public surface of the Cygnus vertical.
 *
 * Every framework build imports from `@awc-ui/showcase-kit/music` and never
 * reaches into a file below this one — which is what lets the internals move
 * without touching five applications, and what makes "does a screen do this
 * itself or ask the kit?" a question with a visible answer.
 *
 * `generated.ts` is exported as `FIXTURE` for the invariant checks and for
 * nothing else. A screen that reads it directly has bypassed every selector.
 */

export {
  BEATS_PER_BAR,
  HISTORY_LIMIT,
  MAX_BARS,
  REPORTING_DATE,
  REPORTING_INSTANT,
  SECONDS_PER_BAR,
  TIMELINE_BARS,
  TRACK_PAGE,
  VIEWER_HANDLE,
  ZOOM_LEVELS,
} from './types';

export type {
  Album,
  Artist,
  Artwork,
  ArtworkShape,
  Clip,
  ClipKind,
  Edit,
  EditKind,
  EditValue,
  LibraryKind,
  MusicFixture,
  MusicTotals,
  PlayState,
  Playlist,
  Project,
  ProjectState,
  RepeatMode,
  StudioTrack,
  Track,
  TrackKind,
} from './types';

export {
  REPEAT_ORDER,
  clipIcon,
  clipLabelKey,
  editIcon,
  editLabelKey,
  libraryIcon,
  libraryLabelKey,
  muteIcon,
  muteLabelKey,
  projectStateIcon,
  projectStateTone,
  repeatIcon,
  repeatLabelKey,
  repeatTone,
  soloLabelKey,
  trackIcon,
  trackLabelKey,
  trackTone,
  transportIcon,
  transportLabelKey,
} from './status';

export {
  DESTINATIONS,
  FRAMEWORKS,
  SHOWCASE_BASE,
  createRoutes,
  crumbsFor,
  destinationFor,
  destinationIndex,
  route,
} from './routes';

export type { CrumbSpec, Destination, Framework, MusicRoutes, RouteName } from './routes';

export {
  albumById,
  albumBySlug,
  albumDuration,
  albumTracks,
  artistAlbums,
  artistByHandle,
  artistById,
  artistTopTracks,
  currentProject,
  followedArtists,
  followedPlaylists,
  getAlbums,
  getArtists,
  getClips,
  getFixture,
  getPlaylists,
  getProjects,
  getQueue,
  getStudioTracks,
  getTotals,
  getTracks,
  getViewer,
  likedTracks,
  ownPlaylists,
  playlistBySlug,
  playlistDuration,
  playlistTracks,
  projectBySlug,
  projectClips,
  projectTracks,
  recentAlbums,
  search,
  studioTrackById,
  topTracks,
  trackById,
  trackClips,
} from './selectors';

export type { SearchHits } from './selectors';

export {
  PREVIOUS_RESTART_SEC,
  audibleTracks,
  barsBeats,
  barsMoved,
  barsToSeconds,
  clipFits,
  canRedo,
  canUndo,
  clock,
  cycleRepeat,
  effectiveVolume,
  emptyHistory,
  initialTransport,
  invertEdit,
  isAudible,
  makeEdit,
  next,
  nextRedo,
  nextTrackId,
  nextUndo,
  panPosition,
  placeClip,
  playTrack,
  playheadBar,
  previous,
  queueIndex,
  record,
  redo,
  rulerTicks,
  secondsToBars,
  seekTo,
  setVolume,
  tick,
  toggleMute,
  togglePlay,
  totalDuration,
  undo,
  upNext,
  volumeDb,
} from './derive';

export type { ClipPlacement, History, Tick, Transport } from './derive';

export { FIXTURE } from './generated';
