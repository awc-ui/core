import { events, eventById, sessionById } from './data.js';

export const MAX_TICKETS = 6;
export const stateKey = 'encore.preferences.v1';
export const draftKey = 'encore.checkout.v1';
export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const money = cents => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100);
export const dateLabel = (iso, options = {}) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'Europe/London', ...options }).format(new Date(iso));
export const timeLabel = iso => dateLabel(iso, { day: undefined, month: undefined, hour: '2-digit', minute: '2-digit' });
export const defaultState = () => ({ saved: [], theme: 'light', accent: 'violet', compact: false, direction: 'ltr' });

export function loadState(storage) {
  const defaults = defaultState();
  try {
    const value = JSON.parse((storage || globalThis.localStorage).getItem(stateKey));
    if (!value || typeof value !== 'object') return defaults;
    return { saved: Array.isArray(value.saved) ? [...new Set(value.saved.filter(id => eventById(id)))] : [],
      theme: ['light', 'dark', 'system'].includes(value.theme) ? value.theme : defaults.theme,
      accent: ['violet', 'rose', 'teal'].includes(value.accent) ? value.accent : defaults.accent,
      compact: value.compact === true, direction: value.direction === 'rtl' ? 'rtl' : 'ltr' };
  } catch { return defaults; }
}
export function saveState(state, storage = globalThis.localStorage) { storage.setItem(stateKey, JSON.stringify(state)); }

export function newDraft(event, sessionId = event.sessions[0].id) {
  return { id: crypto.randomUUID(), eventId: event.id, sessionId, quantities: {}, name: '', email: '', promo: '', payment: 'card' };
}
export function restoreDraft(storage = globalThis.sessionStorage) {
  try {
    const draft = JSON.parse(storage.getItem(draftKey));
    const event = eventById(draft?.eventId);
    if (!event || !sessionById(event, draft.sessionId) || typeof draft.id !== 'string' || draft.id.length > 80) return null;
    const quantities = Object.fromEntries(event.tiers.map(tier => [tier.id, Number.isInteger(draft.quantities?.[tier.id]) ? Math.min(MAX_TICKETS, Math.max(0, draft.quantities[tier.id])) : 0]));
    return { ...newDraft(event, draft.sessionId), id: draft.id, quantities,
      name: typeof draft.name === 'string' ? draft.name.slice(0, 80) : '', email: typeof draft.email === 'string' ? draft.email.slice(0, 160) : '',
      promo: draft.promo === 'ENCORE10' ? draft.promo : '', payment: draft.payment === 'wallet' ? 'wallet' : 'card' };
  } catch { return null; }
}
export const saveDraft = (draft, storage = globalThis.sessionStorage) => draft ? storage.setItem(draftKey, JSON.stringify(draft)) : storage.removeItem(draftKey);

export function remaining(event, sessionId, tierId, orders = []) {
  const tier = event?.tiers.find(item => item.id === tierId);
  if (!tier || !sessionById(event, sessionId)) return 0;
  const used = orders.filter(order => order.status === 'confirmed' && order.eventId === event.id && order.sessionId === sessionId)
    .reduce((sum, order) => sum + (order.lines.find(line => line.tierId === tierId)?.quantity || 0), 0);
  return Math.max(0, tier.capacity - used);
}

export function quote(draft, orders = []) {
  const event = eventById(draft?.eventId), session = sessionById(event, draft?.sessionId);
  if (!event || !session) throw new Error('Choose a show and a performance first.');
  const quantities = draft.quantities || {};
  if (Object.keys(quantities).some(id => !event.tiers.some(tier => tier.id === id))) throw new Error('This ticket option is no longer available.');
  const lines = event.tiers.map(tier => ({ tierId: tier.id, name: tier.name, price: tier.price, quantity: quantities[tier.id] ?? 0 }));
  if (lines.some(line => !Number.isInteger(line.quantity) || line.quantity < 0)) throw new Error('Ticket quantities must be whole numbers.');
  const count = lines.reduce((sum, line) => sum + line.quantity, 0);
  if (count > MAX_TICKETS) throw new Error(`Choose up to ${MAX_TICKETS} tickets per booking.`);
  for (const line of lines) if (line.quantity > remaining(event, session.id, line.tierId, orders)) throw new Error(`${line.name} has only ${remaining(event, session.id, line.tierId, orders)} tickets left. Please update your selection.`);
  const subtotal = lines.reduce((sum, line) => sum + line.price * line.quantity, 0);
  const discount = draft.promo === 'ENCORE10' ? Math.round(subtotal / 10) : 0;
  const fee = Math.round((subtotal - discount) * 0.08);
  return { event, session, lines: lines.filter(line => line.quantity), count, subtotal, discount, fee, total: subtotal - discount + fee };
}

export function validateAttendee(draft) {
  if (!draft.name.trim() || draft.name.trim().length < 2) throw new Error('Enter the name to put on your tickets.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim())) throw new Error('Enter a valid email address.');
}

export function makeOrder(draft, orders = [], now = new Date()) {
  const existing = orders.find(order => order.checkoutId === draft.id);
  if (existing) return existing;
  const q = quote(draft, orders);
  if (!q.count) throw new Error('Choose at least one ticket.');
  if (new Date(q.session.start) <= now) throw new Error('This performance has already started. Choose another date.');
  validateAttendee(draft);
  return { id: `EN-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, checkoutId: draft.id,
    eventId: q.event.id, sessionId: q.session.id, lines: q.lines, count: q.count,
    subtotal: q.subtotal, discount: q.discount, fee: q.fee, total: q.total,
    name: draft.name.trim().slice(0, 80), email: draft.email.trim().slice(0, 160),
    payment: draft.payment === 'wallet' ? 'Demo wallet' : 'Demo card · 4242',
    status: 'confirmed', createdAt: now.toISOString() };
}

export function filterEvents({ query = '', category = 'All shows', city = 'All cities', month = 'all', price = 'all', sort = 'recommended', saved } = {}) {
  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  let result = events.filter(event => (!saved || saved.includes(event.id)) && (category === 'All shows' || event.category === category)
    && (city === 'All cities' || event.city === city) && (month === 'all' || event.sessions.some(session => session.start.slice(0, 7) === month))
    && (price === 'all' || (price === 'under30' ? event.price < 3000 : event.price <= 5000))
    && words.every(word => `${event.title} ${event.artist} ${event.category} ${event.city} ${event.venue}`.toLowerCase().includes(word)));
  if (sort === 'date') result.sort((a, b) => a.sessions[0].start.localeCompare(b.sessions[0].start));
  if (sort === 'price') result.sort((a, b) => a.price - b.price);
  return result;
}

let database;
function openDatabase() {
  return database ??= new Promise((resolve, reject) => {
    const request = indexedDB.open('encore.tickets.v1', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('orders', { keyPath: 'id' });
    request.onsuccess = () => { request.result.onversionchange = () => { request.result.close(); database = null; }; resolve(request.result); };
    request.onerror = () => { database = null; reject(new Error('Browser storage is unavailable. Allow site storage, then try again.')); };
    request.onblocked = () => { database = null; reject(new Error('Close other Encore tabs and try again.')); };
  });
}
export async function getOrders() {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction('orders').objectStore('orders').getAll();
    request.onsuccess = () => resolve(request.result.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    request.onerror = () => reject(new Error('Your tickets could not be loaded. Please try again.'));
  });
}
// Availability validation and insertion share one transaction. Two tabs cannot
// both consume the last ticket, and the draft id makes a retried purchase safe.
export async function purchase(draft) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('orders', 'readwrite'), store = transaction.objectStore('orders');
    let order, failure;
    store.getAll().onsuccess = event => {
      try { order = makeOrder(draft, event.target.result); store.put(order); }
      catch (error) { failure = error; transaction.abort(); }
    };
    transaction.oncomplete = () => resolve(order);
    transaction.onabort = transaction.onerror = () => reject(failure || new Error('We could not save your booking. Nothing was charged. Please try again.'));
  });
}
export async function cancelOrder(id) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('orders', 'readwrite'), store = transaction.objectStore('orders');
    let order;
    store.get(id).onsuccess = event => { order = event.target.result; if (order) { order.status = 'cancelled'; store.put(order); } };
    transaction.oncomplete = () => order ? resolve(order) : reject(new Error('That booking could not be found.'));
    transaction.onabort = transaction.onerror = () => reject(new Error('The booking could not be cancelled. Please try again.'));
  });
}

export function calendarFile(order) {
  const event = eventById(order.eventId), session = sessionById(event, order.sessionId);
  if (!event || !session || order.status !== 'confirmed') throw new Error('Only confirmed tickets can be added to your calendar.');
  const stamp = date => new Date(date).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z/, 'Z');
  const value = text => String(text).replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
  return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//AWC UI//Encore demo//EN','BEGIN:VEVENT',`UID:${order.id}@encore.demo`,
    `DTSTAMP:${stamp(order.createdAt)}`,`DTSTART:${stamp(session.start)}`,`DTEND:${stamp(new Date(session.start).getTime() + event.duration * 60000)}`,
    `SUMMARY:${value(event.title)} (demo)`,`LOCATION:${value(`${event.venue}, ${event.city}`)}`,
    'DESCRIPTION:Fictional Encore showcase event. This is not a real booking.','END:VEVENT','END:VCALENDAR',''].join('\r\n');
}
