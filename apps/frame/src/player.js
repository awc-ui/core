import { escapeHtml } from './model.js';

const speeds = [0.5, 0.75, 1, 1.25, 1.5, 2];
const control = (icon, label, action, extra = '') => `<md-tooltip text="${label}" position="top"><md-icon-button icon="${icon}" aria-label="${label}" data-player-action="${action}" ${extra}></md-icon-button></md-tooltip>`;

export function playerMarkup(video) {
  return `<div id="video-player" class="player-wrap" role="region" aria-busy="true" aria-label="Video player">
    <div class="player-viewport">
      <video id="player" controls playsinline preload="metadata" tabindex="0" poster="${escapeHtml(video.image || '')}" aria-label="${escapeHtml(video.title)}" aria-describedby="player-help"><p>Your browser does not support video playback.</p></video>
      <md-skeleton id="player-skeleton" variant="rectangular" animation="wave" full-width full-height announce="false"></md-skeleton>
      <div id="player-buffering" class="player-buffering" hidden><md-progress-indicator variant="circular" indeterminate size="40" id="player-progress" label="Loading video"></md-progress-indicator></div>
      <div id="player-error" class="player-error" role="alert" hidden><strong>This video couldn’t load.</strong><p>Check your connection, then try again.</p><md-button data-player-action="retry" variant="tonal">Try again</md-button></div>
    </div>
    <div id="player-controls" class="player-controls" hidden>
      <md-slider id="player-seek" size="xs" min="0" max="1" step="1" value="0" disabled aria-label="Video position" value-text="Video duration unavailable"></md-slider>
      <md-toolbar id="player-toolbar" variant="docked" aria-label="Video playback controls">
        ${control('play_arrow', 'Play', 'play', 'id="player-play"')}
        <span class="player-skip">${control('replay_10', 'Back 10 seconds', 'back')}${control('forward_10', 'Forward 10 seconds', 'forward')}</span>
        ${control('volume_up', 'Mute', 'mute', 'id="player-mute"')}
        <md-slider id="player-volume" class="player-volume" min="0" max="100" step="5" value="100" aria-label="Volume" value-text="100 percent"></md-slider>
        <span id="player-time" class="player-time">0:00 / --:--</span>
        <span class="player-spacer" aria-hidden="true"></span>
        ${control('speed', 'Playback speed: 1×', 'speed', 'id="player-speed" aria-haspopup="menu" aria-controls="player-speed-menu"')}
        ${control('fullscreen', 'Enter fullscreen', 'fullscreen', 'id="player-fullscreen"')}
      </md-toolbar>
    </div>
    <md-menu id="player-speed-menu" anchor="player-speed" placement="top-end" aria-label="Playback speed" variant="standard" quick>
      ${speeds.map(speed => `<md-menu-item type="radio" headline="${speed === 1 ? 'Normal (1×)' : `${speed}×`}" data-player-action="rate" data-rate="${speed}" ${speed === 1 ? 'selected' : ''}></md-menu-item>`).join('')}
    </md-menu>
    <span id="player-help" class="sr-only">Video shortcuts: Space or K to play or pause, J and L to seek ten seconds, M to mute, F for fullscreen. Tab to the position and volume sliders; use arrow keys to adjust them.</span>
  </div>`;
}

export function formatMediaTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '--:--';
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor(total / 60) % 60;
  return `${hours ? `${hours}:${String(minutes).padStart(2, '0')}` : minutes}:${String(total % 60).padStart(2, '0')}`;
}

// HTMLMediaElement owns playback. AWC owns interaction, keyboard semantics,
// focus, and the visual controls; only documented props and events are used.
export function mountPlayer(root, { notify = () => {} } = {}) {
  const $ = selector => root.querySelector(selector);
  const video = $('#player');
  const seek = $('#player-seek');
  const volume = $('#player-volume');
  const menu = $('#player-speed-menu');
  const lifetime = new AbortController();
  const { signal } = lifetime;
  let dragging = false;
  let lastVolume = 1;
  let bufferTimer;
  let enhanced = false;
  let waiting = false;
  let playPending = false;
  const on = (target, event, handler) => target.addEventListener(event, handler, { signal });
  const label = (id, glyph, text) => {
    const button = $(id);
    button.icon = glyph;
    button.setAttribute('aria-label', text);
    button.parentElement.text = text;
  };
  function syncTime() {
    const duration = video.duration;
    const hasDuration = Number.isFinite(duration) && duration > 0;
    seek.max = hasDuration ? duration : 1;
    seek.disabled = !hasDuration;
    if (!dragging) seek.value = hasDuration ? video.currentTime : 0;
    const position = dragging ? seek.value : video.currentTime;
    seek.valueText = hasDuration ? `${formatMediaTime(position)} of ${formatMediaTime(duration)}` : 'Video duration unavailable';
    $('#player-time').textContent = `${formatMediaTime(position)} / ${formatMediaTime(duration)}`;
  }
  function syncPlayback() {
    label('#player-play', video.ended ? 'replay' : video.paused ? 'play_arrow' : 'pause', video.ended ? 'Replay' : video.paused ? 'Play' : 'Pause');
  }
  function syncVolume() {
    const muted = video.muted || video.volume === 0;
    volume.value = muted ? 0 : Math.round(video.volume * 100);
    volume.valueText = muted ? 'Muted' : `${volume.value} percent`;
    label('#player-mute', muted ? 'volume_off' : video.volume < 0.5 ? 'volume_down' : 'volume_up', muted ? 'Unmute' : 'Mute');
    if (video.volume > 0) lastVolume = video.volume;
  }
  function syncRate() {
    label('#player-speed', 'speed', `Playback speed: ${video.playbackRate}×`);
    for (const item of menu.querySelectorAll('[data-rate]')) item.selected = Number(item.dataset.rate) === video.playbackRate;
  }
  function clearBuffering() {
    clearTimeout(bufferTimer);
    $('#player-buffering').hidden = true;
    waiting = false;
    root.setAttribute('aria-busy', 'false');
  }
  function buffer() {
    clearTimeout(bufferTimer);
    waiting = true;
    root.setAttribute('aria-busy', 'true');
    if (video.error || !enhanced) return;
    bufferTimer = setTimeout(() => { $('#player-buffering').hidden = false; }, 250);
  }
  function showError(message) {
    clearBuffering();
    $('#player-skeleton').hidden = true;
    $('#player-error p').textContent = message;
    $('#player-error').hidden = false;
    syncPlayback();
  }
  function jump(position) {
    if (!Number.isFinite(video.duration) || video.duration <= 0) return;
    video.currentTime = Math.max(0, Math.min(video.duration, position));
    syncTime();
  }
  async function act(action, target) {
    try {
      switch (action) {
        case 'play':
          if (video.paused || video.ended) {
            if (playPending) return;
            playPending = true;
            $('#player-play').setAttribute('aria-busy', 'true');
            buffer();
            try { if (video.ended) jump(0); await video.play(); }
            finally { playPending = false; $('#player-play').setAttribute('aria-busy', 'false'); if (!signal.aborted) clearBuffering(); }
          }
          else video.pause();
          break;
        case 'back': jump(video.currentTime - 10); break;
        case 'forward': jump(video.currentTime + 10); break;
        case 'mute':
          if (video.muted || video.volume === 0) { video.volume = video.volume || lastVolume; video.muted = false; }
          else video.muted = true;
          break;
        case 'speed': await menu.show(); break;
        case 'rate':
          if (speeds.includes(Number(target.dataset.rate))) video.playbackRate = Number(target.dataset.rate);
          break;
        case 'fullscreen':
          if (document.fullscreenElement === root) await document.exitFullscreen();
          else if (root.requestFullscreen && document.fullscreenEnabled) await root.requestFullscreen();
          else if (video.webkitEnterFullscreen) video.webkitEnterFullscreen();
          break;
        case 'retry': $('#player-error').hidden = true; $('#player-skeleton').hidden = false; video.load(); buffer(); break;
      }
    } catch (error) {
      if (signal.aborted || error.name === 'AbortError') return;
      if (action === 'play' && video.error) showError('This video could not be played. Try loading it again.');
      else notify(action === 'fullscreen' ? 'Fullscreen is unavailable in this browser window.' : 'Playback could not start. Please try again.');
    }
  }
  on(root, 'mdClick', event => {
    const target = event.composedPath().find(node => node.dataset?.playerAction);
    if (!target) return;
    event.stopPropagation();
    void act(target.dataset.playerAction, target);
  });
  on(seek, 'mdDragStart', () => { dragging = true; });
  on(seek, 'mdInput', event => { seek.value = event.detail.value; syncTime(); });
  on(seek, 'mdChange', event => { dragging = false; jump(event.detail.value); });
  on(seek, 'mdDragEnd', () => { dragging = false; syncTime(); });
  on(volume, 'mdInput', event => { video.volume = Math.max(0, Math.min(1, event.detail.value / 100)); video.muted = video.volume === 0; });
  on(video, 'click', () => { if (enhanced) void act('play'); });
  on(root, 'keydown', event => {
    if (!enhanced || event.defaultPrevented || event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return;
    if (event.composedPath().some(node => ['INPUT', 'TEXTAREA', 'MD-SLIDER', 'MD-MENU', 'MD-MENU-ITEM'].includes(node.tagName) || node.isContentEditable)) return;
    const action = ({ k: 'play', j: 'back', l: 'forward', m: 'mute', f: 'fullscreen' })[event.key.toLowerCase()];
    if (action || (event.key === ' ' && event.target === video)) { event.preventDefault(); void act(action || 'play'); }
  });
  for (const event of ['timeupdate', 'durationchange', 'loadedmetadata', 'emptied']) on(video, event, syncTime);
  for (const event of ['play', 'pause', 'ended']) on(video, event, syncPlayback);
  on(video, 'loadstart', () => { $('#player-skeleton').hidden = video.readyState >= 2; buffer(); });
  on(video, 'loadedmetadata', () => { $('#player-skeleton').hidden = true; clearBuffering(); });
  on(video, 'loadeddata', () => { $('#player-skeleton').hidden = true; clearBuffering(); });
  for (const event of ['waiting', 'seeking']) on(video, event, buffer);
  for (const event of ['playing', 'canplay', 'seeked', 'pause', 'ended', 'emptied']) on(video, event, clearBuffering);
  on(video, 'volumechange', syncVolume);
  on(video, 'ratechange', syncRate);
  on(video, 'error', () => showError('Check your connection, then try again.'));
  on(document, 'fullscreenchange', () => {
    label('#player-fullscreen', document.fullscreenElement === root ? 'fullscreen_exit' : 'fullscreen', document.fullscreenElement === root ? 'Exit fullscreen' : 'Enter fullscreen');
    if (menu.open) void menu.close();
  });
  // Keep native controls as a fallback until every library control has hydrated.
  const controls = [...root.querySelectorAll('md-slider, md-icon-button, md-toolbar, md-tooltip, md-menu, md-menu-item')];
  const dispose = () => { lifetime.abort(); clearTimeout(bufferTimer); };
  if (controls.some(el => typeof el.componentOnReady !== 'function')) return dispose;
  Promise.all(controls.map(el => el.componentOnReady())).then(() => {
    if (signal.aborted) return;
    enhanced = true;
    video.controls = false;
    $('#player-controls').hidden = false;
    $('#player-fullscreen').hidden = !(document.fullscreenEnabled && root.requestFullscreen) && !video.webkitEnterFullscreen;
    syncTime(); syncPlayback(); syncVolume(); syncRate();
    if (video.readyState >= 1) { $('#player-skeleton').hidden = true; clearBuffering(); }
    else if (waiting) buffer();
  }).catch(() => { if (!signal.aborted) video.controls = true; });
  return dispose;
}
