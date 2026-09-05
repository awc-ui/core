/**
 * The transport bar. The one piece of chrome that makes this a music app.
 *
 * IT LIVES IN THE FRAME, NOT IN A SCREEN, which is the entire architectural
 * claim of this vertical. `App` swaps the screen on every navigation; this bar
 * is rendered by `AppFrame` above the router, so it is the SAME element before
 * and after — the track keeps playing, the playhead stays where it was, and the
 * queue is untouched.
 *
 * NOTHING ADVANCES ON ITS OWN. There is no interval and no audio element.
 * Pressing Play flips a state and relabels a button; the playhead moves only
 * when a reader drags the scrubber or skips. See `src/music/types.ts` in the
 * kit for why a running clock would make the five-build parity check
 * meaningless.
 */

import {
  albumById,
  artistById,
  clock,
  repeatIcon,
  repeatLabelKey,
  repeatTone,
  trackById,
  transportIcon,
  transportLabelKey,
} from '@awc-ui/showcase-kit/music';
import { useT } from '@/lib/showcase';
import { usePlayer } from '@/lib/player';
import { Art } from '@/components/bits';
import { Slider } from '@/components/elements';

export function Transport() {
  const t = useT();
  const player = usePlayer();
  const { transport } = player;
  const track = transport.trackId ? trackById(transport.trackId) : null;
  const album = track ? albumById(track.albumId) : null;
  const artist = track ? artistById(track.artistId) : null;

  const duration = track?.durationSec ?? 0;
  const playing = transport.state === 'playing';

  return (
    <div className="transport" role="region" aria-label={t('music.label.nowPlaying')}>
      {/* ---- what is loaded ---- */}
      <div className="transport__now">
        {album ? <Art art={album.art} className="transport__art" /> : null}
        <div className="transport__text">
          <div className="transport__title">{track ? track.title : t('music.label.nothingLoaded')}</div>
          <div className="transport__artist">{artist?.name ?? ''}</div>
        </div>
      </div>

      {/* ---- the controls, centred by the grid rather than by content ---- */}
      <div className="transport__controls">
        <div className="transport__buttons">
          <md-icon-button
            class="transport__button transport__shuffle"
            icon="shuffle"
            size="sm"
            color={transport.shuffle ? 'primary' : undefined}
            data-on={transport.shuffle ? '' : undefined}
            aria-pressed={transport.shuffle}
            aria-label={t('music.action.shuffle')}
            onClick={() => player.toggleShuffle()}
          />
          <md-icon-button
            class="transport__button transport__previous"
            icon="skip_previous"
            aria-label={t('music.action.previous')}
            onClick={() => player.previous()}
          />
          {/*
           * THE GLYPH IS THE ACTION, NOT THE STATE — a transport that is
           * playing shows PAUSE, because pressing it pauses. `transportIcon`
           * and `transportLabelKey` are keyed the same way in the kit so the
           * icon and the accessible name cannot disagree, which is the bug
           * that tells a screen-reader user the opposite of what a sighted one
           * sees.
           */}
          <md-icon-button
            class="transport__button transport__play"
            icon={transportIcon[transport.state]}
            variant="filled"
            aria-label={t(transportLabelKey[transport.state])}
            data-playing={playing ? '' : undefined}
            onClick={() => player.toggle()}
          />
          <md-icon-button
            class="transport__button transport__next"
            icon="skip_next"
            aria-label={t('music.action.next')}
            onClick={() => player.next()}
          />
          <md-icon-button
            class="transport__button transport__repeat"
            icon={repeatIcon[transport.repeat]}
            size="sm"
            color={repeatTone[transport.repeat] ?? undefined}
            data-repeat={transport.repeat}
            /* `off` and `all` share a glyph, so the LABEL is the only thing
               that distinguishes them for anyone not seeing the colour. */
            aria-label={t(repeatLabelKey[transport.repeat])}
            onClick={() => player.cycleRepeat()}
          />
        </div>

        {/* ---- the scrubber ---- */}
        <div className="transport__scrub">
          <span className="transport__time transport__elapsed">{clock(transport.positionSec)}</span>
          <Slider
            class="transport__slider"
            min={0}
            max={Math.max(1, duration)}
            step={1}
            value={transport.positionSec}
            aria-label={t('music.action.seek')}
            onInput={(value) => player.seek(value, duration)}
          />
          <span className="transport__time transport__duration">{clock(duration)}</span>
        </div>
      </div>

      {/* ---- volume ---- */}
      <div className="transport__side">
        <md-icon-button
          class="transport__mute"
          icon={transport.muted || transport.volume === 0 ? 'volume_off' : 'volume_up'}
          size="sm"
          aria-pressed={transport.muted}
          aria-label={t(transport.muted ? 'music.action.unmute' : 'music.action.mute')}
          onClick={() => player.toggleMute()}
        />
        <Slider
          class="transport__volume"
          min={0}
          max={100}
          step={1}
          /* The fader shows where it IS, not what you can hear — muting must
             not slide it to zero, or un-muting cannot put it back. */
          value={Math.round(transport.volume * 100)}
          aria-label={t('music.action.volume')}
          onInput={(value) => player.setVolume(value / 100)}
        />
      </div>
    </div>
  );
}
