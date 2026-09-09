import test from 'node:test';
import assert from 'node:assert/strict';
import { createBookingStore } from '../lib/bookings.mjs';
import { dateAfter, flightsFor, quoteBooking } from '../lib/flights.mjs';

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    clear: () => values.clear(),
  };
}
function request() {
  const search = { from: 'OTP', to: 'LIS', depart: dateAfter(14), returnDate: dateAfter(21), trip: 'roundtrip', travelers: 2 };
  const choices = [flightsFor('OTP', 'LIS', search.depart)[0], flightsFor('LIS', 'OTP', search.returnDate)[0]]
    .map((f) => ({ flightId: f.id, fare: 'comfort', seats: [null, null] }));
  return {
    requestId: crypto.randomUUID(), search, choices,
    passengers: [{ firstName: ' Alex ', lastName: 'Morgan' }, { firstName: 'Sam', lastName: 'Morgan' }],
    email: 'alex@example.com', extraBag: false, accepted: true, total: 1,
  };
}

test('booking snapshots recalculate prices and survive a reload in the same tab', () => {
  const storage = memoryStorage();
  const store = createBookingStore(() => storage);
  const input = request();
  const created = store.create(input);
  assert.equal(created.quote.total, quoteBooking(input.search, input.choices).total);
  assert.notEqual(created.total, input.total);
  assert.equal(created.passengers[0].firstName, 'Alex');
  assert.equal(created.requestKey, undefined);
  assert.match(created.reference, /^AE-[A-F0-9]{10}$/);
  const reloaded = createBookingStore(() => storage);
  assert.deepEqual(reloaded.list(), [created]);
  // Caller mutations never corrupt the stored canonical snapshot.
  created.passengers[0].firstName = 'Changed';
  assert.equal(reloaded.list()[0].passengers[0].firstName, 'Alex');
});

test('identical requests are idempotent, conflicting retries cannot overwrite bookings', async () => {
  const store = createBookingStore(() => memory);
  const memory = memoryStorage();
  const input = request();
  const created = store.create(input);
  const attempts = await Promise.allSettled([
    Promise.resolve().then(() => store.create(input)),
    Promise.resolve().then(() => store.create({ ...input, extraBag: true })),
  ]);
  assert.equal(attempts[0].status, 'fulfilled');
  assert.deepEqual(attempts[0].value, created);
  assert.equal(attempts[1].status, 'rejected');
  assert.match(attempts[1].reason.message, /details have changed/);
  assert.equal(store.list().length, 1);
});

test('unchanged retries retain their original snapshot after time-sensitive validation would expire', (t) => {
  const storage = memoryStorage(), store = createBookingStore(() => storage), input = request();
  const created = store.create(input);
  t.mock.method(Date, 'now', () => Date.parse('2040-01-01T00:00:00Z'));
  assert.deepEqual(store.create(input), created);
  assert.throws(() => store.create({ ...input, requestId: crypto.randomUUID() }), /departure/);
});

test('isolated tab stores cannot list or cancel each other’s bookings', () => {
  const firstStorage = memoryStorage(), secondStorage = memoryStorage();
  const first = createBookingStore(() => firstStorage), second = createBookingStore(() => secondStorage);
  const input = request();
  first.create(input);
  assert.deepEqual(second.list(), []);
  assert.throws(() => second.cancel(input.requestId), /not found/);
  firstStorage.clear();
  assert.deepEqual(first.list(), []);
});

test('cancellation persists and remains idempotent through cancellation and create retries', () => {
  const storage = memoryStorage(), store = createBookingStore(() => storage), input = request();
  store.create(input);
  const cancelled = store.cancel(input.requestId);
  assert.equal(cancelled.status, 'cancelled');
  assert.ok(cancelled.cancelledAt);
  assert.deepEqual(store.cancel(input.requestId), cancelled);
  assert.deepEqual(store.create(input), cancelled);
  assert.deepEqual(createBookingStore(() => storage).list(), [cancelled]);
});

test('invalid passengers, seats, acceptance and request IDs never write bookings', () => {
  const storage = memoryStorage(), store = createBookingStore(() => storage), input = request();
  for (const changes of [{ passengers: [] }, { choices: [] }, { accepted: false }, { requestId: 'invalid' }, { email: 'bad' }]) {
    assert.throws(() => store.create({ ...input, ...changes }));
    assert.deepEqual(store.list(), []);
  }
});

test('storage failures cannot report a successful save or cancellation, or discard unreadable records', () => {
  const memory = memoryStorage();
  const blockedWrites = { getItem: memory.getItem, setItem() { throw new Error('quota'); } };
  const blocked = createBookingStore(() => blockedWrites), input = request();
  assert.throws(() => blocked.create(input), /could not be saved/);
  assert.deepEqual(blocked.list(), []);
  const good = createBookingStore(() => memory);
  good.create(input);
  assert.throws(() => blocked.cancel(input.requestId), /could not be saved/);
  assert.equal(good.list()[0].status, 'confirmed');
  const invalid = createBookingStore(() => ({ getItem: () => '{invalid', setItem() { assert.fail('Do not overwrite unreadable records'); } }));
  assert.throws(() => invalid.list(), /could not be read/);
  assert.throws(() => invalid.create(request()), /could not be read/);
  assert.throws(() => createBookingStore(() => { throw new Error('denied'); }).list(), /could not be read/);
});
