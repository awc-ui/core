import test from "node:test";
import assert from "node:assert/strict";
import {
  properties,
  destinations,
  getProperty,
  initialSearch,
  nights,
  validateSearch,
  findProperties,
  quote,
  createBooking,
  cancelBooking,
  isCancellable,
  createInitialState,
  parseStoredState,
  formatMoney,
  formatDate,
  escapeHtml,
} from "./model.js";

const NOW = "2026-09-08T17:30:00.000Z";
const search = {
  destination: "",
  checkIn: "2026-09-22",
  checkOut: "2026-09-25",
  adults: 2,
  children: 0,
  rooms: 1,
};
const guest = {
  firstName: "Alex",
  lastName: "Morgan",
  email: "alex@example.com",
};
const makeBooking = (property = properties[0], overrides = {}) =>
  createBooking(property, search, guest, {
    now: NOW,
    id: "ROAM-test-01",
    ...overrides,
  });

test("catalog has nine immutable fictional stays and three destinations", () => {
  assert.equal(properties.length, 9);
  assert.equal(new Set(properties.map((property) => property.id)).size, 9);
  assert.equal(destinations.length, 3);
  for (const property of properties) {
    assert.equal(getProperty(property.id), property);
    assert.ok(property.simulated && Object.isFrozen(property));
    assert.ok(
      property.nightly > 0 && property.capacity >= 2 && property.rating <= 10,
    );
    assert.ok(
      property.amenities.length >= 4 && property.highlights.length >= 3,
    );
    assert.ok(property.images.includes(property.image));
    assert.ok(property.description.length > 100);
  }
  for (const destination of destinations)
    assert.equal(
      properties.filter((property) => property.city === destination.name)
        .length,
      destination.stays,
    );
  assert.throws(() => properties[0].amenities.push("Changed"), TypeError);
  assert.equal(getProperty("missing"), undefined);
});

test("initial dates are fourteen UTC calendar days ahead for a three-night stay", () => {
  assert.deepEqual(initialSearch(NOW), search);
  assert.equal(
    initialSearch("2026-12-25T23:59:59-08:00").checkIn,
    "2027-01-09",
  );
  assert.equal(initialSearch("2028-02-15T12:00:00Z").checkIn, "2028-02-29");
  assert.throws(() => initialSearch("invalid"), /valid current date/);
});

test("night counts use strict UTC date-only values across leap years and DST", () => {
  assert.equal(nights("2028-02-28", "2028-03-01"), 2);
  assert.equal(nights("2027-02-28", "2027-03-01"), 1);
  assert.equal(nights("2026-03-28", "2026-03-30"), 2);
  assert.equal(nights("2026-10-24", "2026-10-26"), 2);
  assert.equal(nights("2026-12-31", "2027-01-02"), 2);
  for (const invalid of [
    "2026-02-29",
    "2026-02-30",
    "2026-04-31",
    "2026-13-01",
    "2026-00-01",
    "2026-09-00",
    "2026-9-01",
    "09/01/2026",
    "2026-09-01T00:00:00Z",
    "",
    null,
    undefined,
  ]) {
    assert.equal(nights(invalid, "2026-12-31"), 0, String(invalid));
    assert.equal(nights("2026-01-01", invalid), 0, String(invalid));
  }
  assert.equal(nights("2026-09-22", "2026-09-22"), 0);
  assert.equal(nights("2026-09-22", "2026-09-21"), 0);
});

test("search dates reject past, invalid, reversed and overlong stays", () => {
  assert.equal(validateSearch(search, NOW), "");
  assert.equal(
    validateSearch(
      { ...search, checkIn: "2026-09-08", checkOut: "2026-09-09" },
      NOW,
    ),
    "",
  );
  assert.match(
    validateSearch({ ...search, checkIn: "2026-09-07" }, NOW),
    /past/,
  );
  assert.match(
    validateSearch({ ...search, checkIn: "2026-02-30" }, NOW),
    /valid check-in/,
  );
  assert.match(
    validateSearch({ ...search, checkOut: "2026-09-31" }, NOW),
    /valid check-out/,
  );
  assert.match(
    validateSearch({ ...search, checkOut: search.checkIn }, NOW),
    /after check-in/,
  );
  assert.equal(validateSearch({ ...search, checkOut: "2026-10-22" }, NOW), "");
  assert.match(
    validateSearch({ ...search, checkOut: "2026-10-23" }, NOW),
    /30 nights/,
  );
  assert.match(validateSearch(null, NOW), /dates and guests/);
  assert.match(
    validateSearch({ ...search, destination: "x".repeat(151) }, NOW),
    /destination/,
  );
});

test("party bounds reject coercions, fractions, excessive rooms and unaccompanied rooms", () => {
  assert.equal(
    validateSearch({ ...search, adults: "4", children: "2", rooms: "2" }, NOW),
    "",
  );
  for (const adults of [
    0,
    9,
    1.5,
    true,
    null,
    undefined,
    "",
    "2.5",
    "2abc",
    Infinity,
    NaN,
  ])
    assert.match(
      validateSearch({ ...search, adults }, NOW),
      /adults/,
      String(adults),
    );
  for (const children of [-1, 7, 0.5, true, "", "1abc"])
    assert.match(
      validateSearch({ ...search, children }, NOW),
      /children/,
      String(children),
    );
  for (const rooms of [0, 5, 1.5, false, "", "2x"])
    assert.match(
      validateSearch({ ...search, rooms }, NOW),
      /rooms/,
      String(rooms),
    );
  assert.match(
    validateSearch({ ...search, adults: 1, rooms: 2 }, NOW),
    /at least one adult/,
  );
});

test("destination searches match city, neighborhood, property and accents", () => {
  assert.equal(findProperties(search).length, 9);
  assert.equal(
    findProperties({ ...search, destination: " LISBON " }).length,
    3,
  );
  assert.equal(
    findProperties({ ...search, destination: "Portugal" }).length,
    9,
  );
  assert.equal(
    findProperties({ ...search, destination: "principe real" })[0].id,
    "lisbon-olive",
  );
  assert.equal(
    findProperties({ ...search, destination: "Douro Light" })[0].id,
    "porto-douro",
  );
  assert.equal(
    findProperties({ ...search, destination: "Unknown town" }).length,
    0,
  );
  assert.deepEqual(findProperties({ ...search, checkIn: "invalid" }), []);
});

test("filters compose amenities, price, rating, property type and saved stays", () => {
  const result = findProperties(search, {
    freeCancellation: true,
    breakfast: true,
    minRating: 9,
    maxPrice: 150,
    types: ["Hotel"],
  });
  assert.deepEqual(
    result.map((property) => property.id),
    ["lisbon-azulejo", "algarve-dunes"],
  );
  assert.equal(
    findProperties(search, { types: ["apartment", "Villa"] }).length,
    2,
  );
  assert.deepEqual(findProperties(search, { savedIds: [] }), []);
  assert.deepEqual(
    findProperties(search, { savedIds: ["porto-douro", "missing"] }).map(
      (property) => property.id,
    ),
    ["porto-douro"],
  );
  assert.equal(
    findProperties(search, { maxPrice: "", minRating: "" }).length,
    9,
  );
  assert.equal(findProperties(search, { maxPrice: 50 }).length, 0);
  assert.equal(findProperties(search, { minRating: 11 }).length, 0);
});

test("sorting is stable and never reorders the shared catalog", () => {
  const original = properties.map((property) => property.id);
  const cheapest = findProperties(search, { sort: "price-asc" });
  assert.equal(cheapest[0].id, "porto-courtyard");
  assert.ok(
    cheapest.every(
      (property, index) =>
        !index || cheapest[index - 1].nightly <= property.nightly,
    ),
  );
  const rated = findProperties(search, { sort: "rating" });
  assert.equal(rated[0].id, "algarve-villa");
  assert.ok(
    rated.every(
      (property, index) => !index || rated[index - 1].rating >= property.rating,
    ),
  );
  assert.deepEqual(
    properties.map((property) => property.id),
    original,
  );
  assert.deepEqual(
    findProperties(search, { sort: "recommended" }).map(
      (property) => property.id,
    ),
    original,
  );
});

test("quotes multiply rooms and nights while the demo tax counts adults only", () => {
  assert.deepEqual(quote(properties[0], search), {
    nights: 3,
    rooms: 1,
    nightly: 148,
    subtotal: 444,
    taxes: 12,
    total: 456,
  });
  assert.deepEqual(
    quote(properties[0], { ...search, adults: 3, children: 1, rooms: 2 }),
    { nights: 3, rooms: 2, nightly: 148, subtotal: 888, taxes: 18, total: 906 },
  );
  assert.deepEqual(quote({ ...properties[0], nightly: 101.105 }, search), {
    nights: 3,
    rooms: 1,
    nightly: 101.11,
    subtotal: 303.33,
    taxes: 12,
    total: 315.33,
  });
});

test("room capacity and inventory limits apply to search and checkout", () => {
  assert.throws(
    () => quote(properties[0], { ...search, children: 1 }),
    /cannot accommodate/,
  );
  assert.doesNotThrow(() =>
    quote(properties[0], { ...search, children: 2, rooms: 2 }),
  );
  assert.throws(
    () => quote(properties[0], { ...search, adults: 8, rooms: 5 }),
    /rooms/,
  );
  assert.throws(() => quote(null, search), /valid stay/);
  assert.throws(
    () => quote({ ...properties[0], nightly: Infinity }, search),
    /valid stay/,
  );
  assert.throws(
    () => quote(properties[0], { ...search, checkOut: search.checkIn }),
    /after check-in/,
  );
  const roomy = findProperties({ ...search, children: 2 });
  assert.deepEqual(
    roomy.map((property) => property.id),
    ["algarve-cove", "algarve-villa"],
  );
});

test("creating a reservation normalizes independent snapshots without storing payment data", () => {
  const request = {
    ...search,
    destination: " Lisbon ",
    adults: "2",
    children: "0",
    rooms: "1",
  };
  const person = {
    firstName: " Alex ",
    lastName: " Morgan ",
    email: " ALEX@EXAMPLE.COM ",
    cardNumber: "ignored",
    password: "ignored",
  };
  const booking = createBooking(properties[0], request, person, {
    now: NOW,
    id: "ROAM-abc",
  });
  assert.deepEqual(booking.search, { ...search, destination: "Lisbon" });
  assert.deepEqual(booking.guest, guest);
  assert.equal(booking.status, "confirmed");
  assert.equal(booking.simulated, true);
  assert.equal(booking.createdAt, NOW);
  request.adults = "8";
  person.firstName = "Changed";
  assert.equal(booking.search.adults, 2);
  assert.equal(booking.guest.firstName, "Alex");
  const original = properties[0];
  assert.equal(
    createBooking({ ...original, nightly: 1 }, search, guest, { now: NOW })
      .quote.nightly,
    original.nightly,
  );
});

test("reservation creation rejects incomplete guests, unknown stays and invalid dates", () => {
  for (const [key, value, pattern] of [
    ["firstName", "  ", /first name/],
    ["lastName", "", /last name/],
    ["email", "alex@", /valid email/],
    ["email", "a b@example.com", /valid email/],
  ]) {
    assert.throws(
      () =>
        createBooking(
          properties[0],
          search,
          { ...guest, [key]: value },
          { now: NOW },
        ),
      pattern,
    );
  }
  assert.throws(
    () => createBooking({ id: "missing" }, search, guest, { now: NOW }),
    /Roam collection/,
  );
  assert.throws(
    () =>
      createBooking(
        properties[0],
        { ...search, checkIn: "2026-09-01" },
        guest,
        { now: NOW },
      ),
    /past/,
  );
  assert.throws(
    () =>
      createBooking(properties[0], { ...search, adults: 3 }, guest, {
        now: NOW,
      }),
    /cannot accommodate/,
  );
  assert.throws(
    () => makeBooking(properties[0], { id: "<script>" }),
    /valid reservation reference/,
  );
});

test("eligible cancellation creates a new snapshot and preserves original confirmation", () => {
  const original = makeBooking();
  for (const value of [
    original.search,
    original.guest,
    original.quote,
    original,
  ])
    Object.freeze(value);
  const cancelled = cancelBooking(original, "2026-09-21T23:59:59Z");
  assert.equal(original.status, "confirmed");
  assert.equal(original.cancelledAt, null);
  assert.equal(cancelled.status, "cancelled");
  assert.equal(cancelled.cancelledAt, "2026-09-21T23:59:59.000Z");
  assert.notEqual(cancelled.search, original.search);
  assert.deepEqual(cancelled.quote, original.quote);
  assert.equal(isCancellable(original, NOW), true);
  assert.equal(isCancellable(cancelled, NOW), false);
  assert.throws(() => cancelBooking(cancelled, NOW), /already cancelled/);
});

test("cancellation rejects non-refundable, started, corrupt and time-travel reservations", () => {
  assert.throws(
    () => cancelBooking(makeBooking(properties[2]), NOW),
    /does not include free cancellation/,
  );
  const booking = makeBooking();
  assert.equal(isCancellable(booking, "2026-09-22T00:00:00Z"), false);
  assert.throws(
    () => cancelBooking(booking, "2026-09-22T00:00:00Z"),
    /window has ended/,
  );
  assert.throws(
    () => cancelBooking(booking, "2026-09-01T00:00:00Z"),
    /cannot precede/,
  );
  assert.throws(
    () =>
      cancelBooking({ ...booking, quote: { ...booking.quote, total: 0 } }, NOW),
    /could not be read/,
  );
});

test("corrupt or incompatible local storage resets safely", () => {
  for (const raw of [
    undefined,
    null,
    "",
    "{broken",
    "null",
    "[]",
    "42",
    JSON.stringify({ version: 99 }),
    { version: 1, savedIds: false, bookings: "wrong" },
  ])
    assert.deepEqual(parseStoredState(raw), createInitialState());
  const a = createInitialState(),
    b = createInitialState();
  a.savedIds.push("lisbon-azulejo");
  assert.deepEqual(b.savedIds, []);
});

test("persisted records round-trip, deduplicate and discard unknown fields", () => {
  const booking = makeBooking();
  const corrupted = { ...booking, id: "ROAM-bad", propertyId: "missing" };
  const saved = {
    version: 1,
    savedIds: ["lisbon-azulejo", "missing", "lisbon-azulejo"],
    bookings: [
      {
        ...booking,
        propertyName: "tampered",
        image: "javascript:bad",
        payment: "ignored",
      },
      booking,
      corrupted,
    ],
  };
  const parsed = parseStoredState(JSON.stringify(saved));
  assert.deepEqual(parsed.savedIds, ["lisbon-azulejo"]);
  assert.deepEqual(parsed.bookings, [booking]);
  assert.equal("payment" in parsed.bookings[0], false);
  assert.deepEqual(parseStoredState(JSON.stringify(parsed)), parsed);
  const cancelled = cancelBooking(booking, "2026-09-10T12:00:00Z");
  assert.deepEqual(
    parseStoredState({ version: 1, savedIds: [], bookings: [cancelled] })
      .bookings,
    [cancelled],
  );
});

test("historical bookings persist but tampered amounts, dates and cancellation states do not", () => {
  const booking = makeBooking();
  const bad = [
    { ...booking, quote: { ...booking.quote, total: 1 } },
    { ...booking, search: { ...search, checkIn: "2026-09-31" } },
    { ...booking, search: { ...search, adults: 0 } },
    { ...booking, guest: { ...guest, email: "broken" } },
    { ...booking, createdAt: "2026-10-01T00:00:00Z" },
    { ...booking, simulated: false },
    { ...booking, status: "paid" },
    { ...booking, freeCancellation: false },
    { ...booking, status: "cancelled", cancelledAt: "2026-09-23T00:00:00Z" },
    { ...booking, status: "cancelled", cancelledAt: "2026-09-01T00:00:00Z" },
  ];
  for (const value of bad)
    assert.deepEqual(
      parseStoredState({ version: 1, bookings: [value] }).bookings,
      [],
    );
  const historical = createBooking(
    properties[0],
    { ...search, checkIn: "2024-01-01", checkOut: "2024-01-04" },
    guest,
    { now: "2023-12-01T00:00:00Z", id: "ROAM-past" },
  );
  assert.deepEqual(
    parseStoredState({ version: 1, bookings: [historical] }).bookings,
    [historical],
  );
});

test("formatters keep EUR totals and calendar dates stable and escape user text", () => {
  assert.equal(formatMoney(148), "€148");
  assert.equal(formatMoney(148.5), "€148.50");
  assert.equal(formatDate("2026-09-22"), "22 Sept");
  assert.equal(formatDate("2026-02-30"), "");
  assert.equal(
    escapeHtml('<script a="x">A&B\'</script>'),
    "&lt;script a=&quot;x&quot;&gt;A&amp;B&#39;&lt;/script&gt;",
  );
});
