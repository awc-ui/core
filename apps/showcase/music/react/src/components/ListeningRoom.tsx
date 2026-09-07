import { useState } from 'react';
import {
  SESSION_MODES,
  sessionCopy,
  listeningSession,
  clock,
  trackById,
  artistById,
  type SessionMode,
  type Track,
} from '@awc-ui/showcase-kit/music';
import { useT } from '@/lib/showcase';
import { usePlayer } from '@/lib/player';
import { Art } from '@/components/bits';

export function ListeningRoom() {
  const t = useT();
  const player = usePlayer();
  const [mode, setMode] = useState<SessionMode>('for-you');
  const copy = sessionCopy(t.locale);
  const session = listeningSession(mode);
  const at = SESSION_MODES.indexOf(mode);
  const queue = player.transport.queue
    .map(trackById)
    .filter((track): track is Track => track !== null);
  const loaded =
    session.tracks.some((track) => track.id === player.transport.trackId) &&
    player.transport.queue.every((id) => session.tracks.some((track) => track.id === id));
  const playing = loaded && player.transport.state === 'playing';
  return (
    <section className="listening-room" aria-label={copy.choose}>
      <md-card class="listening-room__card" variant="filled" full-width>
        <div className="listening-room__feature">
          <div className="listening-room__copy">
            <span className="listening-room__eyebrow">{copy.eyebrow}</span>
            <h2>{copy.title}</h2>
            <p>{copy.description}</p>
            <md-button-group
              class="listening-room__modes"
              variant="standard"
              selection-mode="single-select"
              required
              aria-label={copy.choose}
            >
              {SESSION_MODES.map((value, index) => (
                <md-button
                  key={value}
                  variant="tonal"
                  toggle
                  value={value}
                  selected={mode === value || undefined}
                  aria-pressed={mode === value}
                  onClick={() => setMode(value)}
                >
                  {copy.modes[index]}
                </md-button>
              ))}
            </md-button-group>
            <div className="listening-room__session" aria-live="polite">
              <h3>{copy.names[at]}</h3>
              <p>{copy.notes[at]}</p>
              <div className="listening-room__facts">
                <span>
                  {t.formatNumber(session.tracks.length)} {copy.tracks}
                </span>
                <span>
                  {clock(session.duration)} {copy.duration}
                </span>
              </div>
            </div>
            <md-button
              class="listening-room__play"
              variant="filled"
              icon={playing ? 'pause' : 'play_arrow'}
              onClick={() => (loaded ? player.toggle() : player.playSession(session.tracks))}
            >
              {playing ? copy.pause : loaded ? copy.resume : copy.play}
            </md-button>
            <small className="listening-room__demo">{copy.demo}</small>
          </div>
          <div className="listening-room__artwork" aria-hidden="true">
            {session.albums.map((album, index) => (
              <div
                key={album.id}
                className={`listening-room__cover listening-room__cover--${index}`}
              >
                <Art art={album.art} eager />
              </div>
            ))}
            <div className="listening-room__record" />
          </div>
        </div>
      </md-card>
      <md-card
        class="listening-queue"
        variant="outlined"
        role="complementary"
        aria-label={copy.queue}
      >
        <div className="listening-queue__heading">
          <h3>{copy.queue}</h3>
          <span>
            {t.formatNumber(queue.length)} {copy.tracks}
          </span>
        </div>
        <div className="listening-queue__list">
          {queue.map((track) => (
            <div
              className="listening-queue__row"
              key={track.id}
              data-current={track.id === player.transport.trackId || undefined}
            >
              <md-icon-button
                icon={
                  track.id === player.transport.trackId && player.transport.state === 'playing'
                    ? 'pause'
                    : 'play_arrow'
                }
                size="sm"
                aria-label={`${t(track.id === player.transport.trackId && player.transport.state === 'playing' ? 'music.action.pause' : 'music.action.play')}: ${track.title}`}
                onClick={() =>
                  track.id === player.transport.trackId ? player.toggle() : player.play(track)
                }
              />
              <div className="listening-queue__track">
                <strong>{track.title}</strong>
                <span>
                  {artistById(track.artistId)?.name} · {clock(track.durationSec)}
                </span>
              </div>
              <md-icon-button
                icon="close"
                size="sm"
                disabled={track.id === player.transport.trackId || undefined}
                aria-label={`${copy.remove}: ${track.title}`}
                onClick={() => player.removeFromQueue(track.id)}
              />
            </div>
          ))}
        </div>
      </md-card>
    </section>
  );
}
