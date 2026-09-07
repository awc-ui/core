import test from 'node:test';
import assert from 'node:assert/strict';
import { mountPlayer, formatMediaTime } from '../src/player.js';

class Control extends EventTarget {
  attributes = new Map();
  parentElement = {};
  dataset = {};
  hidden = true;
  setAttribute(name, value) { this.attributes.set(name, value); }
  getAttribute(name) { return this.attributes.get(name); }
  componentOnReady() { return Promise.resolve(this); }
}
function emit(target, type, detail) {
  target.dispatchEvent(new CustomEvent(type, { detail }));
}
const flush = () => new Promise(resolve => setImmediate(resolve));

function fixture(t, { hydrate = true } = {}) {
  const root = new Control();
  const document = new Control();
  const previousDocument = globalThis.document;
  globalThis.document = document;
  document.fullscreenEnabled = true;
  const controls = Object.fromEntries(['player', 'player-seek', 'player-volume', 'player-speed-menu', 'player-play', 'player-mute', 'player-speed', 'player-fullscreen', 'player-controls', 'player-time', 'player-buffering', 'player-skeleton', 'player-error', 'player-error p'].map(id => [`#${id}`, new Control()]));
  const video = controls['#player'];
  Object.assign(video, { duration: NaN, currentTime: 0, paused: true, ended: false, volume: 1, muted: false, playbackRate: 1, controls: true });
  video.play = async () => { video.paused = false; emit(video, 'play'); };
  video.pause = () => { video.paused = true; emit(video, 'pause'); };
  video.load = () => { video.currentTime = 0; video.duration = NaN; emit(video, 'emptied'); };
  root.querySelector = selector => controls[selector];
  const libraryControls = ['#player-seek', '#player-volume', '#player-play', '#player-speed-menu'].map(selector => controls[selector]);
  if (!hydrate) libraryControls[0].componentOnReady = undefined;
  root.querySelectorAll = () => libraryControls;
  const rates = [0.5, 1, 1.5, 2].map(rate => Object.assign(new Control(), { dataset: { rate: String(rate) } }));
  controls['#player-speed-menu'].querySelectorAll = () => rates;
  const notifications = [];
  const dispose = mountPlayer(root, { notify: message => notifications.push(message) });
  const click = (action, dataset = {}) => {
    const target = Object.assign(new Control(), { dataset: { playerAction: action, ...dataset } });
    const event = new CustomEvent('mdClick');
    event.composedPath = () => [target, root];
    root.dispatchEvent(event);
  };
  t.after(() => { dispose(); if (previousDocument === undefined) delete globalThis.document; else globalThis.document = previousDocument; });
  return { root, video, controls, rates, notifications, click, dispose };
}

test('media metadata and time events drive the accessible timeline; unknown duration cannot seek', async t => {
  const { video, controls } = fixture(t);
  await flush();
  assert.equal(video.controls, false);
  assert.equal(controls['#player-seek'].disabled, true);
  video.duration = 125; video.currentTime = 65;
  emit(video, 'loadedmetadata');
  assert.equal(controls['#player-seek'].disabled, false);
  assert.equal(controls['#player-seek'].max, 125);
  assert.equal(controls['#player-seek'].valueText, '1:05 of 2:05');
  video.currentTime = 67; emit(video, 'timeupdate');
  assert.equal(controls['#player-time'].textContent, '1:07 / 2:05');
  video.load();
  assert.equal(controls['#player-seek'].disabled, true);
});

test('scrubbing previews without seeking on every pointer event, then commits a bounded position', async t => {
  const { video, controls } = fixture(t);
  await flush();
  video.duration = 52.2; video.currentTime = 5; emit(video, 'loadedmetadata');
  const seek = controls['#player-seek'];
  emit(seek, 'mdDragStart'); emit(seek, 'mdInput', { value: 30 });
  video.currentTime = 6; emit(video, 'timeupdate');
  assert.equal(seek.value, 30);
  assert.equal(video.currentTime, 6);
  assert.equal(controls['#player-time'].textContent, '0:30 / 0:52');
  emit(seek, 'mdChange', { value: 30 }); emit(seek, 'mdDragEnd');
  assert.equal(video.currentTime, 30);
  emit(seek, 'mdChange', { value: 100 });
  assert.equal(video.currentTime, 52.2);
  emit(seek, 'mdChange', { value: -5 });
  assert.equal(video.currentTime, 0);
});

test('playback actions preserve media state, restore volume, and select a valid playback rate', async t => {
  const { video, controls, rates, click } = fixture(t);
  await flush();
  click('play'); await flush();
  assert.equal(controls['#player-play'].getAttribute('aria-label'), 'Pause');
  click('play');
  assert.equal(video.paused, true);
  emit(controls['#player-volume'], 'mdInput', { value: 35 }); emit(video, 'volumechange');
  click('mute'); emit(video, 'volumechange');
  assert.equal(video.muted, true);
  assert.equal(controls['#player-volume'].valueText, 'Muted');
  click('mute'); emit(video, 'volumechange');
  assert.equal(video.volume, 0.35);
  emit(controls['#player-volume'], 'mdInput', { value: 0 }); emit(video, 'volumechange');
  click('mute'); emit(video, 'volumechange');
  assert.equal(video.volume, 0.35);
  assert.equal(video.muted, false);
  click('rate', { rate: '1.5' }); emit(video, 'ratechange');
  assert.equal(video.playbackRate, 1.5);
  assert.deepEqual(rates.filter(item => item.selected).map(item => item.dataset.rate), ['1.5']);
  click('rate', { rate: '500' });
  assert.equal(video.playbackRate, 1.5);
});

test('unavailable library controls retain native playback, and leaving a route removes media listeners', async t => {
  const { video, controls, dispose } = fixture(t, { hydrate: false });
  await flush();
  assert.equal(video.controls, true);
  assert.equal(controls['#player-controls'].hidden, true);
  video.duration = 20; emit(video, 'loadedmetadata');
  const before = controls['#player-time'].textContent;
  dispose(); video.currentTime = 15; emit(video, 'timeupdate');
  assert.equal(controls['#player-time'].textContent, before);
});

test('a rejected play request reports feedback without claiming that playback started', async t => {
  const { video, controls, notifications, click } = fixture(t);
  await flush();
  video.play = async () => { throw new Error('Playback blocked'); };
  click('play'); await flush();
  assert.equal(video.paused, true);
  assert.equal(controls['#player-play'].getAttribute('aria-label'), 'Play');
  assert.equal(notifications.length, 1);
});

test('media time supports long videos and unavailable durations', () => {
  assert.equal(formatMediaTime(3665.8), '1:01:05');
  assert.equal(formatMediaTime(0), '0:00');
  for (const value of [NaN, Infinity, -1]) assert.equal(formatMediaTime(value), '--:--');
});

test('video loading replaces the skeleton on metadata and clears it on failure', async t => {
  const { root, video, controls } = fixture(t);
  await flush();
  video.readyState = 0; emit(video, 'loadstart');
  assert.equal(controls['#player-skeleton'].hidden, false);
  assert.equal(root.getAttribute('aria-busy'), 'true');
  video.readyState = 1; emit(video, 'loadedmetadata');
  assert.equal(controls['#player-skeleton'].hidden, true);
  assert.equal(root.getAttribute('aria-busy'), 'false');
  video.readyState = 0; emit(video, 'loadstart'); video.error = new Error('Missing media'); emit(video, 'error');
  assert.equal(controls['#player-skeleton'].hidden, true);
  assert.equal(controls['#player-buffering'].hidden, true);
  assert.equal(controls['#player-error'].hidden, false);
});

test('a pending play action cannot start twice and releases busy feedback on rejection', async t => {
  const { video, controls, notifications, click } = fixture(t);
  await flush();
  let reject, calls = 0;
  video.play = () => { calls++; return new Promise((_, fail) => { reject = fail; }); };
  click('play'); click('play');
  assert.equal(calls, 1); assert.equal(controls['#player-play'].getAttribute('aria-busy'), 'true');
  reject(new Error('Playback blocked')); await flush();
  assert.equal(controls['#player-play'].getAttribute('aria-busy'), 'false');
  assert.equal(controls['#player-buffering'].hidden, true); assert.equal(notifications.length, 1);
});
