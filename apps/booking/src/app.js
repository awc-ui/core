import { properties, getProperty, initialSearch, validateSearch, findProperties, quote, createBooking, cancelBooking, parseStoredState } from './model.js';
import * as views from './views.js';
import { initIdentity } from './auth.js';
import { initPreferences } from './preferences.js';

const $ = (selector, host = document) => host.querySelector(selector);
const SAVED_KEY = 'roam.saved.v1';
const TRIPS_KEY = 'roam.trips.v1';
const SEARCH_KEY = 'roam.search.v1';
const filterDefaults = () => ({ sort: 'recommended', maxPrice: 500, types: [], freeCancellation: false, breakfast: false, minRating: 0 });
const read = (kind, key) => { try { return JSON.parse(globalThis[kind].getItem(key)); } catch { return null; } };
const restored = parseStoredState({ version: 1, savedIds: read('localStorage', SAVED_KEY), bookings: read('sessionStorage', TRIPS_KEY) });
const oldSearch = read('sessionStorage', SEARCH_KEY);
const state = {
  search: oldSearch && !validateSearch(oldSearch) ? oldSearch : initialSearch(),
  filters: filterDefaults(), saved: restored.savedIds, bookings: restored.bookings, profile: null,
};
let draft = { propertyId: '', step: 0, guest: {}, confirmedId: null };
let routeVersion = 0;
let submitting = false;
let currentRoute = { page: 'home', id: '' };
let dialogContext = null;
let storageWarned = false;
let pendingSection = null;
const paint = () => new Promise(resolve => requestAnimationFrame(() => resolve()));
async function ready(host) {
  const elements = [...host.querySelectorAll('*')].filter(el => el.localName.startsWith('md-'));
  await Promise.all(elements.map(async el => {
    await customElements.whenDefined(el.localName);
    await el.componentOnReady?.();
  }));
}
async function notify(message) {
  const toast = $('#toast');
  await customElements.whenDefined('md-snackbar');
  await toast.componentOnReady?.();
  await toast.show(message);
}
function write(kind, key, value) {
  try { globalThis[kind].setItem(key, JSON.stringify(value)); }
  catch {
    if (!storageWarned) { storageWarned = true; notify('Browser storage is unavailable. Your changes will last until you reload.'); }
  }
}
const saveSearch = () => write('sessionStorage', SEARCH_KEY, state.search);
const saveTrips = () => write('sessionStorage', TRIPS_KEY, state.bookings);
const identity = initIdentity({ notify, onChange(profile) {
  state.profile = profile;
  if ($('#account')) $('#account').innerHTML = views.account(profile);
  if (profile && currentRoute.page === 'checkout' && draft.step === 0) {
    const parts = profile.name.split(/\s+/);
    const defaults = { firstName: parts.shift() || '', lastName: parts.join(' '), email: profile.email };
    for (const [key, id] of [['firstName','first-name'],['lastName','last-name'],['email','guest-email']]) {
      const field = $(`#${id}`);
      if (field && !field.value) { field.value = defaults[key]; draft.guest[key] = defaults[key]; }
    }
  }
} });
state.profile = identity.profile;
const preferences = initPreferences({ notify });
const app = $('#app');
app.innerHTML = views.shell(state.profile);
$('#overlays').innerHTML = `<md-dialog id="travel-dialog" class="stay-dialog" headline="Your stay"><div class="stay-dialog-content" id="travel-dialog-content"></div><div slot="actions" id="travel-dialog-actions"></div></md-dialog>`;
const dialog = $('#travel-dialog');

function go(page = '', id = '') {
  const hash = `#/${page}${id ? `/${encodeURIComponent(id)}` : ''}`;
  if (location.hash === hash) return render();
  location.hash = hash;
}
function parseRoute() {
  const [page = '', encoded = ''] = location.hash.replace(/^#\/?/, '').split('/');
  let id = ''; try { id = decodeURIComponent(encoded); } catch {}
  return { page: !page || page === 'home' ? 'home' : page, id };
}
function prefillGuest() {
  if (!state.profile) return { firstName: '', lastName: '', email: '' };
  const parts = state.profile.name.split(/\s+/);
  return { firstName: parts.shift(), lastName: parts.join(' '), email: state.profile.email };
}
function ensureDraft(id) {
  if (draft.propertyId !== id) draft = { propertyId: id, step: 0, guest: prefillGuest(), confirmedId: null };
}
function updateHeader() {
  const nav = $('#main-navigation');
  const saved = $('#saved-navigation');
  saved.badgeValue = state.saved.length ? String(state.saved.length) : '';
  const index = currentRoute.page === 'saved' ? 1 : ['trips', 'confirmation'].includes(currentRoute.page) ? 2 : 0;
  // Hash routes own location; the core bar owns selection and keyboard focus.
  nav.activeIndex = index;
}

async function render({ scroll = true } = {}) {
  const version = ++routeVersion;
  const route = currentRoute = parseRoute();
  if (route.page === 'main') { $('#main').focus(); return; }
  const main = $('#main');
  let content, title;
  const property = getProperty(route.id);
  switch (route.page) {
    case 'home': content = views.home(state); title = 'Find your somewhere'; break;
    case 'search': content = views.results(state, findProperties(state.search, state.filters)); title = 'Explore stays'; break;
    case 'saved': content = views.results(state, properties.filter(p => state.saved.includes(p.id)), true); title = 'Your saved stays'; break;
    case 'trips': content = views.trips(state); title = 'My trips'; break;
    case 'property':
      if (property) { content = views.propertyDetail(property, state); title = property.name; }
      break;
    case 'checkout':
      if (property) {
        ensureDraft(property.id);
        if (draft.confirmedId) { go('confirmation', draft.confirmedId); return; }
        try { const error = validateSearch(state.search); if (error) throw new Error(error); quote(property, state.search); }
        catch (error) { notify(error.message); go('property', property.id); return; }
        content = views.checkout(property, state, draft.step, draft.guest); title = 'Reserve your stay';
      }
      break;
    case 'confirmation': {
      const booking = state.bookings.find(b => b.id === route.id);
      if (booking) { content = views.confirmation(booking); title = 'Reservation details'; }
      break;
    }
  }
  if (!content) { content = `<div class="page-width results-page">${views.empty('This little detour ends here.', 'We could not find that page or reservation in this browser tab.', 'Explore stays', 'browse', 'explore')}</div>`; title = 'Page not found'; }
  document.title = `Roam · ${title}`;
  main.setAttribute('aria-busy', 'true');
  main.classList.add('page-pending');
  main.innerHTML = content;
  updateHeader();
  try { await ready(main); }
  finally {
    if (version === routeVersion) {
      main.classList.remove('page-pending'); main.removeAttribute('aria-busy');
      if (scroll) { window.scrollTo({ top: 0, behavior: 'instant' }); if (app.hasAttribute('data-ready')) main.focus({ preventScroll: true }); }
      if (pendingSection) { const section = document.getElementById(pendingSection); pendingSection = null; section?.scrollIntoView({ block: 'start' }); }
    }
  }
}
function showError(id, message) {
  const error = $(`#${id}`);
  if (error) { error.textContent = message; error.hidden = !message; }
}
function searchFields() {
  return { ...state.search, destination: $('#destination')?.value ?? state.search.destination, checkIn: $('#check-in')?.value ?? state.search.checkIn, checkOut: $('#check-out')?.value ?? state.search.checkOut };
}
async function busy(button, operation) {
  if (button?.loading) return;
  if (button) button.loading = true;
  try { await paint(); return await operation(); }
  finally { if (button?.isConnected) button.loading = false; }
}
function applyFilters() {
  const matches = findProperties(state.search, state.filters);
  const host = $('#property-results');
  if (!host || currentRoute.page !== 'search') return;
  host.innerHTML = matches.length ? matches.map(p => views.propertyCard(p, state, true)).join('') : views.empty('No stays match just yet.', 'Try another destination, a higher budget, or fewer filters.', 'Clear filters', 'reset-filters', 'travel_explore');
  $('#results-count').textContent = `${matches.length} matching ${matches.length === 1 ? 'stay' : 'stays'} · ${views.date(state.search.checkIn)} – ${views.date(state.search.checkOut)} · ${state.search.adults + state.search.children} guests`;
}
function saveStay(id) {
  const property = getProperty(id); if (!property) return;
  const saved = !state.saved.includes(id);
  state.saved = saved ? [...state.saved, id] : state.saved.filter(item => item !== id);
  write('localStorage', SAVED_KEY, state.saved);
  for (const button of document.querySelectorAll(`[data-action="save"][data-id="${id}"]`)) {
    button.selected = saved;
    button.setAttribute('aria-label', `${saved ? 'Unsave' : 'Save'} ${property.name}`);
    const tooltip = button.closest('md-tooltip'); if (tooltip) tooltip.text = saved ? 'Remove saved stay' : 'Save this stay';
  }
  updateHeader();
  if (currentRoute.page === 'saved') render({ scroll: false });
  notify(saved ? `${property.name} added to your wishlist.` : 'Stay removed from your wishlist.');
}
async function openDialog(title, body, actions) {
  dialog.headline = title;
  $('#travel-dialog-content').innerHTML = body;
  $('#travel-dialog-actions').innerHTML = actions;
  await ready($('#overlays'));
  await dialog.show();
}
const closeAction = (text = 'Close') => `<md-button variant="text" data-action="close-dialog">${text}</md-button>`;
function guestFields(search) {
  return `<div class="guest-fields"><md-number-field id="travel-adults" label="Adults" supporting-text="Ages 18+ · one adult per room" variant="outlined" min="1" max="8" value="${search.adults}"></md-number-field><md-number-field id="travel-children" label="Children" supporting-text="Ages 0–17" variant="outlined" min="0" max="6" value="${search.children}"></md-number-field><md-number-field id="travel-rooms" label="Rooms / units" supporting-text="Up to 4 per reservation" variant="outlined" min="1" max="4" value="${search.rooms}"></md-number-field></div><p id="travel-error" class="form-error" role="alert" hidden></p>`;
}
async function openTravel(includeDates = false) {
  dialogContext = { kind: 'travel', includeDates };
  const search = searchFields();
  const dates = includeDates ? `<div class="dialog-dates"><md-date-picker id="travel-in" label="Check-in" variant="docked" locale="en-GB" supporting-text=" " min="${new Date().toISOString().slice(0,10)}" value="${search.checkIn}" commit-on-select></md-date-picker><md-date-picker id="travel-out" label="Check-out" variant="docked" locale="en-GB" supporting-text=" " min="${search.checkIn}" value="${search.checkOut}" commit-on-select></md-date-picker></div>` : '';
  await openDialog(includeDates ? 'A little time for away' : "Who's coming along?", `<p>Make room for your kind of getaway.</p>${dates}${guestFields(search)}`, `${closeAction('Cancel')}<md-button data-action="apply-travel">Apply</md-button>`);
}
async function applyTravel() {
  const next = { ...searchFields(), adults: Number($('#travel-adults').value), children: Number($('#travel-children').value), rooms: Number($('#travel-rooms').value) };
  if (dialogContext?.includeDates) { next.checkIn = $('#travel-in').value; next.checkOut = $('#travel-out').value; }
  const error = validateSearch(next);
  if (error) { showError('travel-error', error); return; }
  state.search = next; saveSearch(); draft.confirmedId = null; draft.step = 0;
  await dialog.close();
  if (dialogContext?.includeDates) await render({ scroll: false });
  else {
    const label = $('#guest-summary');
    if (label) label.textContent = `${next.adults + next.children} guests · ${next.rooms} room${next.rooms > 1 ? 's' : ''}`;
  }
}
function downloadBooking(id) {
  const b = state.bookings.find(item => item.id === id); if (!b) return;
  const text = [`ROAM — DEMO RESERVATION`,b.id,`Status: ${b.status}`,b.propertyName,`${views.date(b.search.checkIn)} – ${views.date(b.search.checkOut)}`,`${b.search.adults} adults, ${b.search.children} children, ${b.search.rooms} rooms`,`Guest: ${b.guest.firstName} ${b.guest.lastName}`,`Total: ${views.money(b.quote.total)} including demo tax`,'','Fictional property. No room is held, no email is sent, and no payment is taken.'].join('\n');
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${b.id}.txt`; document.body.append(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  notify('Your demo confirmation is ready to save.');
}
async function action(element) {
  const { action: name, id, destination } = element.dataset;
  switch (name) {
    case 'preferences': await preferences.open(); break;
    case 'login': case 'signup': await identity.open(name); break;
    case 'profile':
      await openDialog('Your Roam account', `<p>Welcome, ${views.escape(state.profile?.name)}.</p><p>${views.escape(state.profile?.email)}</p><p class="small-note">This is a local demo profile verified with the sample MFA code. No real account has been created.</p>`, `${closeAction()}<md-button variant="outlined" data-action="signout">Sign out</md-button>`); break;
    case 'signout': await dialog.close(); await identity.signOut(); break;
    case 'help': await openDialog('A little about Roam', '<p>Roam is an interactive travel booking showcase built with AWC UI.</p><p>Explore nine fictional stays in Portugal, save a wishlist, and try the reservation flow. Prices, reviews, availability and the €2 per adult/night demo tax are sample data.</p><p>Your wishlist and preferences stay in this browser. Guest details and reservations stay in this tab’s session. No real rooms are reserved, payments taken, or messages sent.</p>', closeAction()); break;
    case 'browse': state.search.destination = ''; state.filters = filterDefaults(); saveSearch(); go('search'); break;
    case 'saved': case 'trips': go(name); break;
    case 'explore': state.search = { ...searchFields(), destination: destination || '' }; if (validateSearch(state.search)) state.search = { ...initialSearch(), destination: destination || '' }; state.filters = filterDefaults(); saveSearch(); go('search'); break;
    case 'property': go('property', id); break;
    case 'save': saveStay(id); break;
    case 'reviews': pendingSection = 'reviews'; go('property', id); break;
    case 'scroll-reviews': $('#reviews')?.scrollIntoView({ block: 'start' }); break;
    case 'guests': await openTravel(); break;
    case 'change-dates': await openTravel(true); break;
    case 'apply-travel': await applyTravel(); break;
    case 'close-dialog': await dialog.close(); break;
    case 'reserve': {
      const error = validateSearch(state.search); if (error) { notify(error); await openTravel(true); break; }
      draft = { propertyId: id, step: 0, guest: prefillGuest(), confirmedId: null }; go('checkout', id); break;
    }
    case 'edit-guest': draft.step = 0; await render(); break;
    case 'reset-filters':
      state.filters = filterDefaults();
      if (!findProperties(state.search, state.filters).length) state.search.destination = '';
      saveSearch(); await render({ scroll: false }); break;
    case 'download': downloadBooking(id); break;
    case 'trip-info': {
      const b = state.bookings.find(item => item.id === id);
      if (b) await openDialog(b.status === 'cancelled' ? 'Reservation cancelled' : 'Your stay is confirmed', `<p>${views.escape(b.propertyName)}</p><p>${views.date(b.search.checkIn)} – ${views.date(b.search.checkOut)}</p><p>${b.status === 'cancelled' ? 'This demo reservation has been cancelled.' : 'Find your dates, price breakdown and saved confirmation in My trips.'}</p><p class="small-note">No real room is held.</p>`, closeAction());
      break;
    }
    case 'cancel-booking': {
      const b = state.bookings.find(item => item.id === id); if (!b) break;
      dialogContext = { kind: 'cancel', id };
      await openDialog('Cancel this reservation?', `<p>Your demo stay at <strong>${views.escape(b.propertyName)}</strong> will be cancelled.</p><p>There is no cancellation charge. You can explore another stay whenever you’re ready.</p><p id="travel-error" class="form-error" role="alert" hidden></p>`, `${closeAction('Keep reservation')}<md-button data-action="cancel-confirmed">Cancel reservation</md-button>`); break;
    }
    case 'cancel-confirmed':
      await busy(element, async () => {
        try {
          const b = state.bookings.find(item => item.id === dialogContext?.id);
          const cancelled = cancelBooking(b); state.bookings = state.bookings.map(item => item.id === cancelled.id ? cancelled : item); saveTrips();
          await dialog.close(); await render({ scroll: false }); notify('Your demo reservation has been cancelled.');
        } catch (error) { showError('travel-error', error.message); }
      }); break;
  }
}
document.addEventListener('mdClick', event => {
  const element = event.target.closest?.('[data-action]');
  if (!element || !element.dataset.action) return;
  action(element).catch(error => { console.error(error); notify('That action could not finish. Please try again.'); });
});
document.addEventListener('mdSelect', event => {
  const chip = event.target;
  if (!chip.dataset.feature) return;
  const coast = chip.dataset.feature === 'coast';
  document.querySelectorAll('[data-feature]').forEach(item => { item.selected = item.dataset.feature === (coast ? 'coast' : 'all'); });
  const ids = coast ? ['algarve-cove','algarve-dunes','algarve-villa'] : ['algarve-cove','lisbon-azulejo','porto-douro','algarve-villa'];
  $('#featured-properties').innerHTML = ids.map(id => views.propertyCard(getProperty(id), state)).join('');
});
document.addEventListener('mdChange', event => {
  const field = event.target;
  if (field.id === 'sort-order') { state.filters.sort = event.detail; applyFilters(); }
  if (field.id === 'max-price') { state.filters.maxPrice = Number(event.detail.value) || 500; applyFilters(); }
  if (field.dataset.filter) {
    const key = field.dataset.filter;
    if (key === 'topRated') state.filters.minRating = event.detail.checked ? 9 : 0;
    else state.filters[key] = event.detail.checked;
    applyFilters();
  }
  if (field.dataset.type) {
    state.filters.types = [...document.querySelectorAll('[data-type]')].filter(item => item.checked).map(item => item.dataset.type); applyFilters();
  }
  if (field.id === 'check-in' || field.id === 'travel-in') {
    const out = $(field.id === 'check-in' ? '#check-out' : '#travel-out');
    const date = new Date(`${event.detail.value}T12:00:00Z`);
    if (out && Number.isFinite(date.getTime())) {
      date.setUTCDate(date.getUTCDate() + 1); const minimum = date.toISOString().slice(0,10); out.min = minimum;
      if (!out.value || out.value < minimum) out.value = minimum;
    }
  }
});
document.addEventListener('submit', async event => {
  const form = event.target;
  if (!['search-form','guest-form','confirm-form'].includes(form.id)) return;
  event.preventDefault();
  if (submitting) return;
  submitting = true;
  try {
    if (form.id === 'search-form') {
      const next = searchFields(), error = validateSearch(next);
      showError('search-error', error);
      if (error) return;
      await busy($('#search-submit'), async () => { state.search = next; saveSearch(); draft.confirmedId = null; await go('search'); });
    } else if (form.id === 'guest-form') {
      const guest = { firstName: $('#first-name').value, lastName: $('#last-name').value, email: $('#guest-email').value };
      try {
        createBooking(getProperty(currentRoute.id), state.search, guest);
        draft.guest = guest; draft.step = 1; await render();
      } catch (error) {
        showError('booking-error', error.message);
        for (const field of form.querySelectorAll('md-text-field')) { if (!await field.checkValidity()) { await field.setFocus(); break; } }
      }
    } else if (form.id === 'confirm-form') {
      if (!$('#demo-consent').checked) { showError('booking-error', 'Please acknowledge that this is a demo reservation.'); await $('#demo-consent').reportValidity(); return; }
      await busy($('#confirm-booking'), async () => {
        try {
          if (draft.confirmedId) { go('confirmation', draft.confirmedId); return; }
          const booking = createBooking(getProperty(currentRoute.id), state.search, draft.guest, { id: `ROAM-${crypto.randomUUID().replaceAll('-','').slice(0,12).toUpperCase()}` });
          state.bookings = [booking, ...state.bookings]; draft.confirmedId = booking.id; saveTrips(); go('confirmation', booking.id);
        } catch (error) { showError('booking-error', error.message); }
      });
    }
  } finally { submitting = false; }
});
window.addEventListener('hashchange', () => { if (location.hash !== '#main') render().catch(error => { console.error(error); notify('This page could not load. Try another page.'); }); });
$('.skip-link').addEventListener('click', event => { event.preventDefault(); $('#main').focus(); $('#main').scrollIntoView(); });
await ready($('.site-header'));
await render({ scroll: false });
await ready(app);
await document.fonts.ready;
app.setAttribute('data-ready', '');
$('#startup').hidden = true;
