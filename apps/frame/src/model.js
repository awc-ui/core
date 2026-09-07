import { videos, channels } from './data.js';
export const STORAGE_KEY = 'awc:frame:v1';
const defaults = () => ({ saved: [], liked: [], history: [], subscriptions: ['north', 'studio', 'slow'], comments: {}, uploads: [], preferences: { theme: 'dark', accent: 'red', compact: false, motion: true, autoplay: false } });
export function normalizeState(raw) {
  const result = defaults();
  if (!raw || typeof raw !== 'object') return result;
  for (const key of ['saved', 'liked', 'history', 'subscriptions']) {
    result[key] = Array.isArray(raw[key]) ? [...new Set(raw[key].filter(id => typeof id === 'string'))] : result[key];
  }
  result.uploads = Array.isArray(raw.uploads) ? raw.uploads.filter(v => v && typeof v.id === 'string' && v.local === true && typeof v.title === 'string') : [];
  if (raw.comments && typeof raw.comments === 'object' && !Array.isArray(raw.comments)) {
    for (const [key, value] of Object.entries(raw.comments)) result.comments[key] = Array.isArray(value) ? value.filter(c => c && typeof c.text === 'string') : [];
  }
  const prefs = raw.preferences || {};
  if (['light', 'dark', 'system'].includes(prefs.theme)) result.preferences.theme = prefs.theme;
  if (['red', 'violet', 'blue'].includes(prefs.accent)) result.preferences.accent = prefs.accent;
  for (const key of ['compact', 'motion', 'autoplay']) if (typeof prefs[key] === 'boolean') result.preferences[key] = prefs[key];
  return result;
}
export function loadState(storage) {
  try { return normalizeState(JSON.parse(storage.getItem(STORAGE_KEY))); } catch { return defaults(); }
}
export function persistState(storage, state) {
  try { storage.setItem(STORAGE_KEY, JSON.stringify(state)); return true; } catch { return false; }
}
export function toggleItem(list, id) { return list.includes(id) ? list.filter(item => item !== id) : [...list, id]; }
export function rememberVideo(history, id) { return [id, ...history.filter(item => item !== id)].slice(0, 100); }
export function getChannel(id) { return channels.find(c => c.id === id) || { id: 'you', name: 'You', initials: 'YO', subscribers: '0', bio: 'Your videos, your perspective.' }; }
export function allVideos(state) { return [...state.uploads, ...videos]; }
export function selectVideos(state, { page = 'home', category = 'All', query = '', channel = '', sort = 'recommended' } = {}) {
  let result = allVideos(state);
  if (page === 'saved' || page === 'liked' || page === 'history') {
    const ids = state[page === 'saved' ? 'saved' : page];
    result = ids.map(id => result.find(video => video.id === id)).filter(Boolean);
  } else if (page === 'subscriptions') result = result.filter(video => state.subscriptions.includes(video.channel));
  else if (page === 'library') result = result.filter(video => video.local || state.saved.includes(video.id) || state.liked.includes(video.id));
  if (channel) result = result.filter(video => video.channel === channel);
  if (category !== 'All') result = result.filter(video => video.category === category);
  const normalized = query.trim().toLowerCase();
  if (normalized) result = result.filter(video => `${video.title} ${video.category} ${getChannel(video.channel).name}`.toLowerCase().includes(normalized));
  if (sort === 'popular' || page === 'explore') result = [...result].sort((a, b) => b.views - a.views);
  return result;
}
export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const formatViews = value => new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(value);

let dbPromise;
function openDatabase() {
  if (!dbPromise) dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open('awc-frame-media', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('videos');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => { dbPromise = undefined; reject(request.error); };
  });
  return dbPromise;
}
export async function saveVideoFile(id, file) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('videos', 'readwrite');
    transaction.objectStore('videos').put(file, id);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error || new Error('Video storage was interrupted.'));
  });
}
export async function getVideoFile(id) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction('videos').objectStore('videos').get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
