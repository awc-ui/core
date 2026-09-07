import { categories, channels, destinations, sampleComments, sourceUrl } from './data.js';
import { loadState, persistState, toggleItem, rememberVideo, getChannel, allVideos, selectVideos, escapeHtml as e, formatViews, saveVideoFile, getVideoFile } from './model.js';
import { playerMarkup, mountPlayer } from './player.js';
import { shellMarkup } from './shell.js';
import { switchFramework } from './frameworks.js';
import { imageSkeleton, trackImage, createActions } from './loading.js';

// Framework hosts own the shell. This controller owns the empty route, search,
// comments, and subscription outlets, plus AWC events and browser storage.
export function mountFrame(app, { framework = 'html', renderShell = false } = {}) {
const lifetime = new AbortController();
const on = (target, type, listener, options = {}) => target.addEventListener(type, listener, { ...options, signal: lifetime.signal });
let storage;
try { storage = localStorage; } catch { storage = { getItem: () => null, setItem: () => { throw new Error('Storage unavailable'); } }; }
const state = loadState(storage);
let category = 'All';
let sort = 'recommended';
let currentRoute;
let videoObjectUrl;
let pendingFile;
let currentMenuVideo;
let lastUndo;
let renderGeneration = 0;
let disposePlayer;
let imageCleanups = [];
let importing = false;
let actions;
const $ = selector => app.querySelector(selector);
const icon = name => `<span class="symbol" aria-hidden="true">${name}</span>`;
const iconButton = (glyph, label, action, attrs = '') => `<md-tooltip text="${e(label)}" position="bottom"><md-icon-button icon="${glyph}" aria-label="${e(label)}" data-action="${action}" ${attrs}></md-icon-button></md-tooltip>`;
const avatar = (channel, size = 'medium') => `<md-avatar initials="${e(channel.initials)}" size="${size}"></md-avatar>`;
const ready = async el => { if (el?.componentOnReady) await el.componentOnReady(); return el; };

function persist() {
  const saved = persistState(storage, state);
  if (!saved) toast('Browser storage is full or unavailable. Changes will last for this session.');
  return saved;
}
function parseRoute() {
  try {
    const [path, search = ''] = location.hash.replace(/^#\/?/, '').split('?');
    const [page = 'home', id = ''] = path.split('/');
    return { page: page || 'home', id: decodeURIComponent(id), query: new URLSearchParams(search).get('q') || '' };
  } catch { return { page: 'home', id: '', query: '' }; }
}
function navigate(path) {
  category = 'All';
  if (location.hash === `#/${path}`) renderRoute();
  else location.hash = `/${path}`;
}
function setPreferences(patch) {
  Object.assign(state.preferences, patch);
  applyPreferences();
  persist();
}
function applyPreferences() {
  const { theme, accent, compact, motion } = state.preferences;
  const dark = theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  const root = document.documentElement;
  if (dark) root.dataset.theme = 'dark'; else root.removeAttribute('data-theme');
  root.dataset.accent = accent;
  if (compact) root.dataset.density = '-1'; else root.removeAttribute('data-density');
  root.toggleAttribute('data-compact', compact);
  for (const attribute of ['data-ripple', 'data-shape-morph']) {
    if (!motion) root.setAttribute(attribute, 'off'); else root.removeAttribute(attribute);
  }
  document.querySelector('meta[name="theme-color"]').content = dark ? '#111214' : '#ffffff';
  for (const control of document.querySelectorAll('[data-theme-choice]')) control.selected = control.dataset.themeChoice === theme;
  for (const control of document.querySelectorAll('[data-accent-choice]')) control.selected = control.dataset.accentChoice === accent;
  for (const control of document.querySelectorAll('md-switch[data-pref]')) control.selected = state.preferences[control.dataset.pref];
}


function updateSidebar() {
  const subscribed = channels.filter(c => state.subscriptions.includes(c.id));
  $('#subscription-count').textContent = subscribed.length;
  $('#sidebar-channels').innerHTML = subscribed.length ? `<md-list class="channel-list" label="Subscribed creators">${subscribed.slice(0, 5).map(channel => `<md-list-item type="link" href="#/channel/${channel.id}" headline="${e(channel.name)}" leading-avatar-label="${e(channel.initials)}"></md-list-item>`).join('')}</md-list>` : '<p class="muted sidebar-empty">Your creators will appear here.</p>';
}

function filters() {
  return `<div class="category-bar" role="group" aria-label="Video categories">${categories.map(name => `<md-chip variant="filter" appearance="filled" label="${name}" data-category="${name}" ${name === category ? 'selected' : ''}></md-chip>`).join('')}</div>`;
}

function card(video, compact = false) {
  const channel = getChannel(video.channel);
  return `<article class="video-card ${compact ? 'compact-video' : ''}" data-video="${e(video.id)}">
    <md-card variant="filled" interactive class="thumbnail" data-action="watch" data-id="${e(video.id)}" aria-label="Watch ${e(video.title)}">
      ${video.image ? `${imageSkeleton()}<img src="${e(video.image)}" alt="" loading="lazy" decoding="async" width="640" height="360">` : `<div class="local-thumbnail">${icon('movie')}<span>Your perspective</span></div>`}
      <span class="thumbnail-play">${icon('play_arrow')}</span><span class="duration">${e(video.duration)}</span>
      ${state.history.includes(video.id) ? '<span class="watched-label">Watched</span>' : ''}
    </md-card>
    <div class="video-info">${compact ? '' : avatar(channel)}<div class="video-copy"><h3><a href="#/watch/${e(video.id)}" data-route="watch/${e(video.id)}">${e(video.title)}</a></h3><a class="creator" href="#/channel/${e(channel.id)}" data-route="channel/${e(channel.id)}">${e(channel.name)} ${video.local ? '' : icon('check_circle')}</a><p class="video-meta">${formatViews(video.views)} views <span>·</span> ${e(video.age)}</p></div>
      ${iconButton('more_vert', `Options for ${video.title}`, 'video-menu', `id="options-${e(video.id)}" data-id="${e(video.id)}" class="video-options"`)}
    </div>
  </article>`;
}

function featured() {
  const video = allVideos(state).find(v => v.id === 'v1');
  return `<md-card variant="filled" class="featured">
    ${imageSkeleton()}<img class="featured-image" src="${e(video.image)}" alt="Clouds drifting around a rugged mountain peak" fetchpriority="high" width="1400" height="650">
    <div class="featured-shade"></div>
    <div class="featured-content"><span class="featured-kicker">${icon('north_east')} The weekend watch</span><h2>Somewhere with<br>no signal.</h2><p>A little less scrolling. A little more wonder.</p><div class="featured-actions"><md-button icon="play_arrow" data-action="watch" data-id="v1" class="watch-feature">Watch film</md-button><span>North of ordinary <span class="dot">·</span> 12 min</span></div></div>
    <span class="featured-badge">Handpicked for you</span>
    ${iconButton(state.saved.includes('v1') ? 'bookmark_added' : 'bookmark_add', 'Save featured video', 'save', 'data-id="v1" class="featured-save"')}
  </md-card>`;
}

function emptyState(title, description, glyph = 'video_library') {
  return `<div class="empty-state">${icon(glyph)}<h2>${e(title)}</h2><p>${e(description)}</p><md-button variant="tonal" data-action="discover">Find something good</md-button></div>`;
}

function renderBrowse() {
  const { page, query, id } = currentRoute;
  const channel = page === 'channel' ? getChannel(id) : null;
  const headings = {
    home: ['Your next rabbit hole.', 'A fresh perspective is one play away.'],
    explore: ['A world worth exploring.', 'The most watched, the unexpected, and everything in between.'],
    subscriptions: ['From your favorite people.', 'Fresh perspectives from the creators you follow.'],
    library: ['A collection of good things.', 'Your videos, likes, and saved finds. All in one place.'],
    history: ['Pick up where you left off.', 'The videos you’ve watched in this browser.'],
    saved: ['Worth coming back to.', 'Your Watch later collection. No rush.'],
    liked: ['The ones that stayed with you.', 'Every video you gave a little appreciation.'],
    search: [query ? `Results for “${query}”` : 'Find your next favorite.', 'Videos and creators from across Frame.'],
  };
  if (!headings[page] && !channel) {
    $('#main').innerHTML = emptyState('That page wandered off.', 'Head back to discover something new.', 'explore');
    return;
  }
  const heading = channel ? [channel.name, channel.bio] : headings[page];
  document.title = `${channel ? channel.name : page === 'home' ? 'Find your next favorite' : destinations.find(d => d[0] === page)?.[2] || 'Search'} — Frame`;
  $('#main').innerHTML = `${filters()}<div class="page-content">
    <div class="page-heading ${channel ? 'creator-heading' : ''}"><div class="heading-identity">${channel ? `<span class="channel-heading-avatar">${avatar(channel, 'large')}</span>` : ''}<div class="heading-text"><span class="eyebrow">${page === 'home' ? 'Curated for the curious' : channel ? 'Creator channel' : 'Your Frame'}</span><h1>${e(heading[0])}</h1><p>${e(heading[1])}</p></div></div>
      ${channel ? `<md-button data-action="subscribe" data-channel="${e(id)}" variant="${state.subscriptions.includes(id) ? 'tonal' : 'filled'}" icon="${state.subscriptions.includes(id) ? 'notifications_active' : 'add'}">${state.subscriptions.includes(id) ? 'Subscribed' : 'Subscribe'}</md-button>` : page === 'history' && state.history.length ? '<md-button variant="text" icon="delete_outline" data-action="clear-history">Clear history</md-button>' : '<span class="edition">Find something that moves you.</span>'}
    </div>
    ${page === 'library' ? `<div class="library-shortcuts"><md-button variant="tonal" icon="schedule" data-action="open-saved">Watch later · ${state.saved.length}</md-button><md-button variant="tonal" icon="thumb_up" data-action="open-liked">Liked · ${state.liked.length}</md-button><md-button variant="tonal" icon="history" data-action="open-history">History · ${state.history.length}</md-button><md-button variant="text" icon="add" data-action="upload">Add video</md-button></div>` : ''}
    <div id="featured-area"></div>
    <div class="section-heading"><h2 id="grid-heading">${page === 'home' ? 'Made for your curiosity' : channel ? 'Videos' : 'Your discoveries'}<span id="result-count"></span></h2><md-button id="sort-button" variant="text" icon="sort" data-action="sort-menu">${sort === 'popular' ? 'Most viewed' : 'Recommended'}</md-button></div>
    <div id="video-results"></div>
    <footer class="feed-footer"><span class="brand-mark small">${icon('play_arrow')}</span><span>You’ve reached the end. Curiosity never does.</span><a href="https://awc-ui.dev" target="_blank" rel="noreferrer">Made with AWC UI ↗</a></footer>
  </div>`;
  renderResults();
}

function renderResults() {
  if (!$('#video-results')) return;
  const { page, query, id } = currentRoute;
  const items = selectVideos(state, { page, category, query, channel: page === 'channel' ? id : '', sort });
  $('#result-count').textContent = ` ${items.length}`;
  const empty = page === 'saved' ? ['Save your next great find.', 'Use the bookmark action on a video to add it to Watch later.', 'bookmark_border'] : page === 'liked' ? ['A little appreciation goes a long way.', 'Like a video while watching it and you’ll find it here.', 'thumb_up'] : page === 'history' ? ['Your story starts with a play.', 'Watch a video and it will appear in your history.', 'history'] : page === 'library' ? ['Make yourself a collection.', 'Save or like a video, or add one of your own.', 'video_library'] : ['Nothing here just yet.', 'Try another category or search for a different idea.', 'search_off'];
  $('#video-results').innerHTML = items.length ? `<div class="video-grid">${items.map(video => card(video)).join('')}</div>` : emptyState(...empty);
  if ($('#featured-area')) $('#featured-area').innerHTML = page === 'home' && category === 'All' ? featured() : '';
  installImageFallbacks();
}

async function renderWatch(id, generation) {
  const video = allVideos(state).find(v => v.id === id);
  if (!video) { $('#main').innerHTML = emptyState('This video isn’t in the picture.', 'It may be a local video from another browser.', 'videocam_off'); return; }
  const channel = getChannel(video.channel);
  document.title = `${video.title} — Frame`;
  const recommended = allVideos(state).filter(v => v.id !== id).slice(0, 7);
  $('#main').innerHTML = `<div class="watch-page"><md-button class="back-link" variant="text" icon="arrow_back" href="#/home">Back to discovering</md-button><div class="watch-layout"><section class="watch-primary">
    ${playerMarkup(video)}
    <div class="footage-credit">${icon('movie')} ${video.local ? 'Your local video' : `Demo footage: ${e(video.footage)}`} ${video.local ? '' : '<span>Editorial feed is a fictional showcase.</span>'}</div>
    <h1>${e(video.title)}</h1>
    <div class="watch-channel"><a href="#/channel/${channel.id}" data-route="channel/${channel.id}" class="channel-identity">${avatar(channel)}<div><strong>${e(channel.name)}</strong><span>${channel.subscribers} subscribers</span></div></a><md-button variant="${state.subscriptions.includes(channel.id) ? 'tonal' : 'filled'}" data-action="subscribe" data-channel="${channel.id}" ${video.local ? 'hidden' : ''}>${state.subscriptions.includes(channel.id) ? 'Subscribed' : 'Subscribe'}</md-button><div class="watch-actions"><md-button variant="tonal" toggle ${state.liked.includes(id) ? 'selected' : ''} icon="thumb_up" data-action="like" data-id="${e(id)}">${state.liked.includes(id) ? 'Liked' : 'Like'}</md-button><md-button variant="tonal" icon="${state.saved.includes(id) ? 'bookmark_added' : 'bookmark_add'}" data-action="save" data-id="${e(id)}">${state.saved.includes(id) ? 'Saved' : 'Save'}</md-button>${iconButton('share', 'Share video', 'share', `data-id="${e(id)}"`)}</div></div>
    <md-card variant="filled" class="description-card"><strong>${formatViews(video.views)} views <span>·</span> ${e(video.age)}</strong><p>${e(video.description)}</p>${video.local ? '' : `<p class="muted">Playback: ${e(video.footage)}. ${video.footage.includes('Blender') ? '<a href="https://www.blender.org/about/projects/" target="_blank" rel="noreferrer">About Blender’s open movies ↗</a>' : 'Sample video provided for demonstration.'}</p>`}</md-card>
    <div class="comments-heading"><h2>Join the conversation <span id="comment-count"></span></h2></div>
    <form id="comment-form" class="comment-form">${avatar({ initials: 'YO' })}<md-text-field label="Add a thoughtful comment" name="comment" variant="outlined" required max-length="1000" id="comment-field"></md-text-field><md-button type="submit" variant="tonal">Comment</md-button></form><md-list id="comments" label="Comments"></md-list>
  </section><aside class="up-next"><div class="section-heading"><h2>Up next</h2><label class="autoplay-label">Autoplay <md-switch data-pref="autoplay" aria-label="Autoplay next video" ${state.preferences.autoplay ? 'selected' : ''}></md-switch></label></div>${recommended.map(v => card(v, true)).join('')}</aside></div></div>`;
  renderComments(video);
  installImageFallbacks();
  const player = $('#player');
  disposePlayer = mountPlayer($('#video-player'), { notify: toast });
  on(player, 'play', () => {
    state.history = rememberVideo(state.history, id);
    persist();
  }, { once: true });
  on(player, 'ended', () => { if (state.preferences.autoplay && recommended[0]) navigate(`watch/${recommended[0].id}`); });
  on($('#comment-form'), 'submit', event => {
    event.preventDefault();
    const text = $('#comment-field').value.trim();
    if (!text) { $('#comment-field').error = true; $('#comment-field').errorText = 'Write a comment before posting.'; return; }
    state.comments[id] ||= [];
    state.comments[id].unshift({ text, name: 'You', initials: 'YO', age: 'Just now' });
    persist();
    $('#comment-field').value = '';
    $('#comment-field').error = false;
    renderComments(video);
    toast('Your comment was added.');
  });
  if (video.local) {
    try {
      const file = await getVideoFile(id);
      if (generation !== renderGeneration) return;
      if (!file) throw new Error('The video file is no longer stored in this browser.');
      videoObjectUrl = URL.createObjectURL(file);
      player.src = videoObjectUrl;
    } catch (error) {
      if (generation !== renderGeneration) return;
      $('#player-skeleton').hidden = true;
      $('#video-player').setAttribute('aria-busy', 'false');
      $('#player-error').hidden = false;
      $('#player-error p').textContent = error.message;
    }
  } else player.src = sourceUrl(video);
}

function renderComments(video) {
  const comments = [...(state.comments[video.id] || []), ...(video.local ? [] : sampleComments)];
  $('#comment-count').textContent = comments.length;
  $('#comments').innerHTML = comments.map(c => `<md-list-item headline="${e(c.name)}" leading-avatar-label="${e(c.initials)}" trailing-supporting-text="${e(c.age)}" lines="3"><p slot="supporting-text">${e(c.text)}</p></md-list-item>`).join('');
}

async function renderRoute({ focus = true } = {}) {
  const generation = ++renderGeneration;
  imageCleanups.forEach(dispose => dispose());
  imageCleanups = [];
  disposePlayer?.();
  disposePlayer = undefined;
  const player = $('#player');
  if (player) { player.pause(); player.removeAttribute('src'); player.load(); }
  if (videoObjectUrl) { URL.revokeObjectURL(videoObjectUrl); videoObjectUrl = undefined; }
  if (lifetime.signal.aborted) return;
  currentRoute = parseRoute();
  category = 'All';
  const index = destinations.findIndex(d => d[0] === currentRoute.page);
  $('#rail').activeIndex = index;
  $('#mobile-nav').activeIndex = index >= 0 && index < 4 ? index : 3;
  if (currentRoute.page === 'watch') await renderWatch(currentRoute.id, generation); else renderBrowse();
  if (generation !== renderGeneration) return;
  if (focus) { window.scrollTo({ top: 0, behavior: 'instant' }); $('#main').focus({ preventScroll: true }); }
}

function updateSuggestions(query) {
  const results = selectVideos(state, { query }).slice(0, 5);
  $('#search-results').innerHTML = `<div class="search-heading">${query.trim() ? 'A few good matches' : 'Try a new rabbit hole'}</div><md-list label="Search suggestions">${results.map(v => `<md-list-item type="button" headline="${e(v.title)}" supporting-text="${e(getChannel(v.channel).name)} · ${e(v.category)}" leading-icon="${query ? 'play_circle' : 'trending_up'}" data-action="search-watch" data-id="${e(v.id)}"></md-list-item>`).join('')}</md-list>${!results.length ? '<p class="search-empty">No matches. Try “design”, “nature”, or “music”.</p>' : ''}<md-button variant="text" data-action="search-all" icon="search">See all results</md-button>`;
}

function installImageFallbacks() {
  imageCleanups.forEach(dispose => dispose());
  imageCleanups = [...app.querySelectorAll('.thumbnail img, .featured-image')].map(image => trackImage(image, { onError: () => {
    if (image.classList.contains('featured-image')) return;
    const fallback = document.createElement('div');
    fallback.className = 'local-thumbnail';
    fallback.innerHTML = icon('movie');
    image.after(fallback);
  } }));
}

async function toast(message, undo) {
  const bar = await ready($('#toast'));
  if (lifetime.signal.aborted) return;
  lastUndo = undo;
  bar.message = message;
  bar.action = undo ? 'Undo' : '';
  await bar.show();
}
async function showShare(id) {
  const url = new URL(location.href);
  url.hash = `/watch/${id}`;
  $('#share-url').value = url.href;
  await (await ready($('#share-dialog'))).show();
}
function updateVideoActions() {
  for (const control of document.querySelectorAll('[data-action="save"]')) {
    const saved = state.saved.includes(control.dataset.id);
    control.icon = saved ? 'bookmark_added' : 'bookmark_add';
    if (control.tagName === 'MD-BUTTON') control.textContent = saved ? 'Saved' : 'Save';
    else control.setAttribute('aria-label', saved ? 'Remove from Watch later' : 'Save to Watch later');
  }
}
function saveVideo(id) {
  const previous = [...state.saved];
  state.saved = toggleItem(state.saved, id);
  persist();
  updateVideoActions();
  if (['saved', 'library'].includes(currentRoute.page)) renderResults();
  toast(state.saved.includes(id) ? 'Saved to Watch later.' : 'Removed from Watch later.', () => {
    state.saved = previous; persist(); updateVideoActions(); renderResults();
  });
}

on(app, 'click', event => {
  const link = event.target.closest?.('a[data-route]');
  if (!link || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
  event.preventDefault(); navigate(link.dataset.route);
});
on(app, 'mdClick', async event => {
  const target = event.composedPath().find(node => node instanceof HTMLElement && node.dataset.action);
  if (!target) return;
  // A card and its child controls must never both handle a single activation.
  event.stopPropagation();
  const action = target.dataset.action;
  const id = target.dataset.id;
  switch (action) {
    case 'watch': navigate(`watch/${id}`); break;
    case 'search-watch': await $('#search').close(); navigate(`watch/${id}`); break;
    case 'discover': navigate('home'); break;
    case 'navigation': document.body.classList.toggle('rail-collapsed'); syncRail(); break;
    case 'appearance': {
      const tags = [...new Set([...document.querySelectorAll('*')].filter(el => el.localName.startsWith('md-')).map(el => el.localName))].sort();
      $('#component-census').innerHTML = `<strong>${tags.length} AWC UI component types on this screen</strong><div class="component-tags">${tags.map(tag => `<code>${tag}</code>`).join('')}</div>`;
      applyPreferences(); await (await ready($('#appearance'))).show(); break;
    }
    case 'profile': await (await ready($('#profile-dialog'))).show(); break;
    case 'close-profile': await $('#profile-dialog').close(); break;
    case 'profile-library': await $('#profile-dialog').close(); navigate('library'); break;
    case 'open-saved': navigate('saved'); break;
    case 'open-liked': navigate('liked'); break;
    case 'open-history': navigate('history'); break;
    case 'upload': await (await ready($('#upload-dialog'))).show(); break;
    case 'close-upload': await $('#upload-dialog').close(); break;
    case 'choose-file': if (!importing) $('#file-input').click(); break;
    case 'submit-upload': $('#upload-form').requestSubmit(); break;
    case 'save': saveVideo(id); break;
    case 'like': {
      state.liked = toggleItem(state.liked, id); persist();
      target.textContent = state.liked.includes(id) ? 'Liked' : 'Like';
      toast(state.liked.includes(id) ? 'Added to your liked videos.' : 'Removed from your liked videos.'); break;
    }
    case 'subscribe': {
      const channelId = target.dataset.channel;
      state.subscriptions = toggleItem(state.subscriptions, channelId); persist(); updateSidebar();
      const subscribed = state.subscriptions.includes(channelId);
      target.textContent = subscribed ? 'Subscribed' : 'Subscribe'; target.variant = subscribed ? 'tonal' : 'filled';
      toast(subscribed ? `Subscribed to ${getChannel(channelId).name}.` : `Unsubscribed from ${getChannel(channelId).name}.`); break;
    }
    case 'share': await showShare(id); break;
    case 'close-share': await $('#share-dialog').close(); break;
    case 'copy-link': {
      const value = $('#share-url').value;
      try { await actions.run(target, 'Copying video link', () => navigator.clipboard.writeText(value), $('#share-dialog'));
        if (lifetime.signal.aborted) return; await $('#share-dialog').close(); toast('Video link copied.'); }
      catch { if (!lifetime.signal.aborted) { await $('#share-url').select(); toast('Select and copy the video link.'); } } break;
    }
    case 'video-menu': {
      currentMenuVideo = id;
      const menu = await ready($('#video-menu'));
      menu.anchor = target.id;
      $('#menu-save').headline = state.saved.includes(id) ? 'Remove from Watch later' : 'Save to Watch later';
      await menu.show(); break;
    }
    case 'menu-save': saveVideo(currentMenuVideo); break;
    case 'menu-channel': navigate(`channel/${allVideos(state).find(v => v.id === currentMenuVideo).channel}`); break;
    case 'menu-share': await $('#video-menu').close(); await showShare(currentMenuVideo); break;
    case 'sort-menu': await (await ready($('#sort-menu'))).show(); break;
    case 'sort-recommended': case 'sort-popular': sort = action.split('-')[1]; $('#sort-button').textContent = sort === 'popular' ? 'Most viewed' : 'Recommended'; renderResults(); break;
    case 'search-all': { const query = $('#search').value; await $('#search').close(); navigate(`search?q=${encodeURIComponent(query)}`); break; }
    case 'clear-history': await (await ready($('#clear-dialog'))).show(); break;
    case 'cancel-clear': await $('#clear-dialog').close(); break;
    case 'confirm-clear': { const previous = [...state.history]; state.history = []; persist(); await $('#clear-dialog').close(); renderBrowse(); toast('Watch history cleared.', () => { state.history = previous; persist(); renderBrowse(); }); break; }
  }
});
on(app, 'mdSelect', event => {
  const chip = event.target.closest?.('md-chip[data-category]');
  if (!chip) return;
  category = event.detail.selected ? chip.dataset.category : 'All';
  for (const option of document.querySelectorAll('[data-category]')) option.selected = option.dataset.category === category;
  renderResults();
});
on(app, 'mdChange', event => {
  if (event.target.matches?.('md-switch[data-pref]')) setPreferences({ [event.target.dataset.pref]: event.detail.selected });
  if (event.target.id === 'theme-choices') setPreferences({ theme: event.detail[0] });
  if (event.target.id === 'accent-choices') setPreferences({ accent: event.detail[0] });
});

if (renderShell) app.innerHTML = shellMarkup(state);
actions = createActions($('#action-progress'));
app.dataset.framework = framework;
$('#framework-selector').value = framework;
on($('#framework-selector'), 'mdChange', event => switchFramework(event.detail));
updateSidebar();
applyPreferences();
updateSuggestions('');
on(document.querySelector('.skip-link'), 'click', event => {
  event.preventDefault();
  $('#main').focus();
});
// The component's closed surface uses opacity; inert keeps its slotted fields
// out of the tab order and accessibility tree until the dialog opens.
for (const dialog of document.querySelectorAll('md-dialog')) {
  dialog.inert = true;
  on(dialog, 'mdOpen', () => { dialog.inert = false; });
  on(dialog, 'mdClose', () => { dialog.inert = true; });
}
const tabletMedia = matchMedia('(min-width: 701px) and (max-width: 980px)');
const phoneMedia = matchMedia('(max-width: 700px)');
function syncSearch() {
  $('#search').trigger = phoneMedia.matches ? 'icon' : 'bar';
  $('#search').layout = phoneMedia.matches ? 'full-screen' : 'docked';
  $('#search').fullWidth = !phoneMedia.matches;
  $('#search').maxBlockSize = phoneMedia.matches ? '100dvh' : '65vh';
}
on(phoneMedia, 'change', syncSearch);
syncSearch();
function syncRail() {
  const collapsed = tabletMedia.matches || document.body.classList.contains('rail-collapsed');
  $('#rail').variant = collapsed ? 'standard' : 'expanded';
  $('#nav-toggle').setAttribute('aria-expanded', String(!collapsed));
  const shortLabels = ['Home', 'Explore', 'Following', 'Library', 'History', 'Watch later', 'Liked'];
  for (const [index, destination] of [...$('#rail').querySelectorAll('md-navigation-rail-tab')].entries()) {
    destination.label = collapsed ? shortLabels[index] : destinations[index][2];
  }
}
on(tabletMedia, 'change', syncRail);
syncRail();
on($('#rail'), 'mdTabChange', event => { category = 'All'; if (event.detail.value) navigate(event.detail.value); });
// mdChange also fires when activeIndex is synchronized from the URL. Route only
// from a destination activation, including reactivating Library from a subpage.
for (const [index, destination] of [...$('#mobile-nav').children].entries()) {
  on(destination, 'mdTabClick', () => navigate(destinations[index][0]));
}
on($('#search'), 'mdSearch', event => updateSuggestions(event.detail.value));
on($('#search'), 'mdSubmit', async event => { await $('#search').close(); navigate(`search?q=${encodeURIComponent(event.detail.value)}`); });
on($('#toast'), 'mdAction', async () => { const undo = lastUndo; lastUndo = undefined; if (undo) undo(); await $('#toast').hide('action'); });
on($('#file-input'), 'change', event => selectFile(event.target.files[0]));
on($('#file-drop'), 'dragover', event => { event.preventDefault(); event.currentTarget.classList.add('drag-over'); });
on($('#file-drop'), 'dragleave', event => event.currentTarget.classList.remove('drag-over'));
on($('#file-drop'), 'drop', event => { event.preventDefault(); event.currentTarget.classList.remove('drag-over'); selectFile(event.dataTransfer.files[0]); });
function selectFile(file) {
  if (!file || importing) return;
  $('#upload-error').textContent = '';
  if (!file.type.startsWith('video/') || file.size > 100 * 1024 * 1024) {
    $('#upload-error').textContent = 'Choose a video file smaller than 100 MB.'; return;
  }
  pendingFile = file;
  $('#file-label').textContent = file.name;
  if (!$('#upload-title').value) $('#upload-title').value = file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
}
on($('#upload-form'), 'submit', async event => {
  event.preventDefault();
  if (importing) return;
  const title = $('#upload-title').value.trim();
  if (!pendingFile || !title) { $('#upload-error').textContent = 'Choose a video and give it a title.'; return; }
  const submit = $('#upload-submit');
  const file = pendingFile;
  const description = $('#upload-description').value.trim();
  importing = true;
  $('#import-progress').hidden = false;
  $('#upload-title').disabled = true;
  $('#upload-description').disabled = true;
  $('#framework-selector').disabled = true;
  $('#upload-dialog [data-action="close-upload"]').textContent = 'Close';
  const id = `local-${crypto.randomUUID()}`;
  try {
    await actions.run(submit, 'Saving video to this browser', () => saveVideoFile(id, file), $('#upload-form'));
    if (lifetime.signal.aborted) return;
    state.uploads.unshift({ id, title, description, channel: 'you', category: 'Your videos', views: 0, age: 'Just now', duration: 'Local', local: true, image: '' });
    persist();
    await $('#upload-dialog').close();
    pendingFile = undefined; $('#file-input').value = ''; $('#file-label').textContent = 'Choose a video to get started';
    $('#upload-title').value = ''; $('#upload-description').value = ''; $('#upload-error').textContent = '';
    navigate(`watch/${id}`); toast('Your video is ready in your library.');
  } catch { if (!lifetime.signal.aborted) { $('#upload-error').textContent = 'This browser couldn’t save the video. Try a smaller file or allow browser storage.'; toast('Video could not be saved. You can try again from Create.'); } }
  finally {
    importing = false;
    if (!lifetime.signal.aborted) {
      $('#import-progress').hidden = true;
      $('#upload-title').disabled = false;
      $('#upload-description').disabled = false;
      $('#framework-selector').disabled = false;
      $('#upload-dialog [data-action="close-upload"]').textContent = 'Cancel';
    }
  }
});
on(window, 'hashchange', () => renderRoute());
on(window, 'scroll', () => { $('#topbar').scrolled = window.scrollY > 12; }, { passive: true });
on(matchMedia('(prefers-color-scheme: dark)'), 'change', () => { if (state.preferences.theme === 'system') applyPreferences(); });
on(document, 'keydown', async event => {
  if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) return;
  if (event.composedPath().some(el => el instanceof HTMLElement && (['INPUT', 'TEXTAREA', 'MD-TEXT-FIELD'].includes(el.tagName) || el.isContentEditable))) return;
  if (document.querySelector('md-dialog[open], md-side-sheet[open]')) return;
  event.preventDefault(); await (await ready($('#search'))).show(); await $('#search').focusInput();
});
renderRoute({ focus: false });
document.querySelector('#startup-loading')?.remove();
document.dispatchEvent(new Event('frame-ready'));

return () => {
  lifetime.abort();
  imageCleanups.forEach(dispose => dispose());
  actions.dispose();
  ++renderGeneration;
  disposePlayer?.();
  const player = $('#player');
  if (player) { player.pause(); player.removeAttribute('src'); player.load(); }
  if (videoObjectUrl) URL.revokeObjectURL(videoObjectUrl);
};
}
