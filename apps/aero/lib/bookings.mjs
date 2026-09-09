import { bookingFromInput, bookingFingerprint } from './flights.mjs';

const STORAGE_KEY = 'awc-aero-demo-bookings-v1';
const UUID = /^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i;
const copy = (value) => JSON.parse(JSON.stringify(value));
const exposed = ({ requestKey, ...booking }) => copy(booking);

/** Tab-local demo persistence. It intentionally has no backend or real inventory. */
export function createBookingStore(storageProvider = () => globalThis.sessionStorage) {
  function storage() {
    try {
      const value = storageProvider();
      if (!value) throw new Error();
      return value;
    } catch {
      throw new Error('Demo storage is unavailable. Allow browser storage and try again.');
    }
  }
  function read() {
    try {
      const raw = storage().getItem(STORAGE_KEY);
      if (!raw) return [];
      const state = JSON.parse(raw);
      if (state.version !== 1 || !Array.isArray(state.bookings) || !state.bookings.every((b) =>
        b && UUID.test(b.id) && typeof b.reference === 'string' &&
        ['confirmed', 'cancelled'].includes(b.status) && typeof b.createdAt === 'string' &&
        typeof b.requestKey === 'string' && b.search && Array.isArray(b.passengers) &&
        typeof b.email === 'string' && b.quote && Array.isArray(b.quote.legs) &&
        Number.isFinite(b.quote.total))) throw new Error();
      return state.bookings;
    } catch {
      throw new Error('Your saved demo bookings could not be read. Open a new tab to start a fresh session.');
    }
  }
  function write(bookings) {
    try {
      storage().setItem(STORAGE_KEY, JSON.stringify({ version: 1, bookings }));
    } catch {
      throw new Error('This change could not be saved in your browser. Nothing was charged. Please try again.');
    }
  }
  return {
    list() {
      return read().slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(exposed);
    },
    create(input) {
      if (!input || typeof input.requestId !== 'string' || !UUID.test(input.requestId)) {
        throw new Error('Invalid booking request. Please try again.');
      }
      const bookings = read();
      const requestKey = bookingFingerprint(input);
      const existing = bookings.find((b) => b.id === input.requestId);
      // Compare stable input before time-sensitive validation: an unchanged retry
      // returns its original snapshot even after the flight has departed.
      if (existing) {
        if (existing.requestKey !== requestKey) {
          throw new Error('These booking details have changed. Start a new booking and try again.');
        }
        return exposed(existing);
      }
      const details = bookingFromInput(input);
      const booking = {
        id: input.requestId,
        reference: 'AE-' + input.requestId.replaceAll('-', '').slice(0, 10).toUpperCase(),
        status: 'confirmed',
        createdAt: new Date().toISOString(),
        total: details.quote.total,
        ...details,
        requestKey,
      };
      write([booking, ...bookings]);
      return exposed(booking);
    },
    cancel(id) {
      if (typeof id !== 'string' || !UUID.test(id)) throw new Error('Invalid booking.');
      const bookings = read();
      const booking = bookings.find((b) => b.id === id);
      if (!booking) throw new Error('Booking not found.');
      if (booking.status === 'cancelled') return exposed(booking);
      booking.status = 'cancelled';
      booking.cancelledAt = new Date().toISOString();
      write(bookings);
      return exposed(booking);
    },
  };
}

const bookings = createBookingStore();
export async function listBookings() { return bookings.list(); }
export async function createBooking(input) { return bookings.create(input); }
export async function cancelSavedBooking(id) { return bookings.cancel(id); }
