/**
 * Every enum-ish value's icon, tone and label key, in one place.
 *
 * WHY THIS IS NOT IN THE COMPONENTS. Five framework builds render the same
 * mixer strip and the same clip. If each decided for itself that a muted track
 * is `volume_off` in `error` and a soloed one is `headphones` in `primary`,
 * four of them would eventually be wrong and the parity check would report the
 * symptom rather than the cause. A lookup table is the cheapest possible shared
 * decision.
 *
 * TONES ARE COMPONENT COLOUR NAMES, never hex. The theme decides what `warning`
 * looks like in dark mode; this file only decides what is a warning.
 */

import type {
  ClipKind,
  EditKind,
  LibraryKind,
  PlayState,
  ProjectState,
  RepeatMode,
  TrackKind,
} from './types';

/* --------------------------------------------------------------- transport */

/**
 * The icon the play button SHOWS, which is the action it performs — not the
 * state it is in.
 *
 * THIS IS THE ONE EVERY MEDIA PLAYER GETS WRONG AT LEAST ONCE. A transport that
 * is playing shows a PAUSE glyph, because pressing it pauses. Labelling it with
 * the current state gives you a play triangle you cannot press to play, and the
 * accessible name has to agree with the glyph or a screen-reader user is told
 * the opposite of what a sighted one sees.
 */
export const transportIcon: Record<PlayState, string> = {
  playing: 'pause',
  paused: 'play_arrow',
  stopped: 'play_arrow',
};

/** And the label key for the same button, which must match the glyph. */
export const transportLabelKey: Record<PlayState, string> = {
  playing: 'music.action.pause',
  paused: 'music.action.play',
  stopped: 'music.action.play',
};

/** The three repeat states, in the order the button cycles them. */
export const REPEAT_ORDER: readonly RepeatMode[] = ['off', 'all', 'one'];

export const repeatIcon: Record<RepeatMode, string> = {
  off: 'repeat',
  all: 'repeat',
  one: 'repeat_one',
};

/**
 * `off` gets no colour, which is how a reader tells it is off.
 *
 * `off` and `all` share a glyph — there is no third repeat symbol in the icon
 * set worth using — so the ONLY thing distinguishing them is the tone. A null
 * here and a colour there is the whole signal, which is why both states also
 * carry a distinct label key below.
 */
export const repeatTone: Record<RepeatMode, string | null> = {
  off: null,
  all: 'primary',
  one: 'primary',
};

export const repeatLabelKey: Record<RepeatMode, string> = {
  off: 'music.repeat.off',
  all: 'music.repeat.all',
  one: 'music.repeat.one',
};

/* ----------------------------------------------------------------- library */

export const libraryIcon: Record<LibraryKind, string> = {
  album: 'album',
  playlist: 'queue_music',
  artist: 'person',
};

export const libraryLabelKey: Record<LibraryKind, string> = {
  album: 'music.kind.album',
  playlist: 'music.kind.playlist',
  artist: 'music.kind.artist',
};

/* ------------------------------------------------------------------ studio */

export const trackIcon: Record<TrackKind, string> = {
  drums: 'radio_button_checked',
  bass: 'graphic_eq',
  keys: 'piano',
  guitar: 'music_note',
  vocal: 'mic',
  synth: 'waves',
  fx: 'auto_awesome',
};

export const trackLabelKey: Record<TrackKind, string> = {
  drums: 'music.track.drums',
  bass: 'music.track.bass',
  keys: 'music.track.keys',
  guitar: 'music.track.guitar',
  vocal: 'music.track.vocal',
  synth: 'music.track.synth',
  fx: 'music.track.fx',
};

/**
 * A colour per instrument family, so a clip is identifiable without its label.
 *
 * These are component colour names rather than a palette of my own: a clip is a
 * surface like any other and has to survive a theme swap and a contrast check.
 */
export const trackTone: Record<TrackKind, string> = {
  drums: 'primary',
  bass: 'tertiary',
  keys: 'secondary',
  guitar: 'warning',
  vocal: 'success',
  synth: 'info',
  fx: 'neutral',
};

export const clipIcon: Record<ClipKind, string> = {
  audio: 'graphic_eq',
  midi: 'piano',
};

export const clipLabelKey: Record<ClipKind, string> = {
  audio: 'music.clip.audio',
  midi: 'music.clip.midi',
};

export const projectStateTone: Record<ProjectState, string> = {
  draft: 'neutral',
  mixing: 'info',
  mastering: 'warning',
  released: 'success',
};

export const projectStateIcon: Record<ProjectState, string> = {
  draft: 'edit_note',
  mixing: 'tune',
  mastering: 'graphic_eq',
  released: 'check_circle',
};

/* ----------------------------------------------------------------- history */

/** What each edit is called in the undo button's tooltip and the history list. */
export const editLabelKey: Record<EditKind, string> = {
  'clip.move': 'music.edit.clipMove',
  'clip.resize': 'music.edit.clipResize',
  'clip.remove': 'music.edit.clipRemove',
  'track.rename': 'music.edit.trackRename',
  'track.volume': 'music.edit.trackVolume',
  'track.pan': 'music.edit.trackPan',
  'track.mute': 'music.edit.trackMute',
  'track.solo': 'music.edit.trackSolo',
};

export const editIcon: Record<EditKind, string> = {
  'clip.move': 'drag_pan',
  'clip.resize': 'straighten',
  'clip.remove': 'delete',
  'track.rename': 'edit',
  'track.volume': 'volume_up',
  'track.pan': 'swap_horiz',
  'track.mute': 'volume_off',
  'track.solo': 'headphones',
};

/* ------------------------------------------------------------------- mixer */

/**
 * The glyph a mute button shows, by whether the track is audible.
 *
 * AUDIBILITY IS NOT THE MUTE FLAG — see `audibleTracks()` in `derive.ts`. A
 * track that is not muted can still be silent because something else is soloed,
 * and the button has to show that or the mixer lies about what you are hearing.
 * So this is keyed on the DERIVED state, and the mute flag decides only whether
 * the button reads as pressed.
 */
export const muteIcon = (audible: boolean): string => (audible ? 'volume_up' : 'volume_off');

export const muteLabelKey = (muted: boolean): string =>
  muted ? 'music.action.unmute' : 'music.action.mute';

export const soloLabelKey = (soloed: boolean): string =>
  soloed ? 'music.action.unsolo' : 'music.action.solo';
