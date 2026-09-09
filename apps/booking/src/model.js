/**
 * Roam is a fictional booking showcase. Properties, reviews, prices and inventory
 * are demonstration data; creating a booking never contacts an accommodation.
 */
export const DEMO_NOTICE =
  "A fictional travel showcase. No real reservations or payments.";
// A uniform demo charge, not a statement of Portuguese tax rules.
export const DEMO_TAX_PER_ADULT_NIGHT = 2;
export const MAX_ROOMS = 4;
export const MAX_NIGHTS = 30;
const DAY = 86_400_000;

const stays = [
  {
    id: "lisbon-azulejo",
    name: "Azulejo House by Roam",
    city: "Lisbon",
    area: "Alfama",
    type: "Hotel",
    rating: 9.4,
    reviews: 428,
    nightly: 148,
    capacity: 2,
    bedrooms: 1,
    cancellation: true,
    breakfast: true,
    image: "./images/room.jpg",
    images: ["./images/room.jpg", "./images/suite.jpg", "./images/pool.jpg"],
    amenities: ["Free Wi-Fi", "Breakfast", "Terrace", "Air conditioning"],
    description:
      "A thoughtfully imagined townhouse of blue tiles, warm oak and quiet corners. Start with breakfast in the courtyard, then wander the winding lanes of Alfama.",
    highlights: [
      "Quiet courtyard mornings",
      "Rooftop city views",
      "Characterful old-town setting",
    ],
  },
  {
    id: "lisbon-olive",
    name: "Olive & Linen Studios",
    city: "Lisbon",
    area: "Príncipe Real",
    type: "Apartment",
    rating: 9.2,
    reviews: 216,
    nightly: 112,
    capacity: 3,
    bedrooms: 1,
    cancellation: true,
    breakfast: false,
    image: "./images/suite.jpg",
    images: ["./images/suite.jpg", "./images/room.jpg"],
    amenities: ["Free Wi-Fi", "Kitchen", "Air conditioning", "Workspace"],
    description:
      "Light-filled studios with soft linen, a compact kitchen and space to settle in. This fictional neighborhood hideaway pairs independent living with a slower city rhythm.",
    highlights: [
      "Your own kitchen",
      "Room to work or unwind",
      "Leafy neighborhood inspiration",
    ],
  },
  {
    id: "lisbon-marina",
    name: "Marina Paper Hotel",
    city: "Lisbon",
    area: "Belém",
    type: "Hotel",
    rating: 8.8,
    reviews: 352,
    nightly: 96,
    capacity: 2,
    bedrooms: 1,
    cancellation: false,
    breakfast: true,
    image: "./images/room.jpg",
    images: ["./images/room.jpg", "./images/suite.jpg"],
    amenities: ["Free Wi-Fi", "Breakfast", "Air conditioning", "Restaurant"],
    description:
      "An easygoing stay inspired by Lisbon's riverside light. Pale timber rooms, a neighborhood café and a welcoming lounge make a simple base for a city break.",
    highlights: [
      "Relaxed riverside mood",
      "Breakfast included",
      "A comfortable city base",
    ],
  },
  {
    id: "porto-douro",
    name: "Douro Light House",
    city: "Porto",
    area: "Ribeira",
    type: "Hotel",
    rating: 9.6,
    reviews: 584,
    nightly: 174,
    capacity: 2,
    bedrooms: 1,
    cancellation: true,
    breakfast: true,
    image: "./images/suite.jpg",
    images: ["./images/suite.jpg", "./images/room.jpg"],
    amenities: ["Free Wi-Fi", "Breakfast", "River view", "Air conditioning"],
    description:
      "A fictional riverside address with a contemporary Portuguese spirit. Deep window seats, soft textures and generous breakfasts set the scene for unhurried days.",
    highlights: [
      "Windows made for daydreaming",
      "Seasonal breakfast table",
      "Riverside-inspired interiors",
    ],
  },
  {
    id: "porto-courtyard",
    name: "The Little Fig Courtyard",
    city: "Porto",
    area: "Cedofeita",
    type: "Guesthouse",
    rating: 9.1,
    reviews: 189,
    nightly: 89,
    capacity: 2,
    bedrooms: 1,
    cancellation: true,
    breakfast: false,
    image: "./images/room.jpg",
    images: ["./images/room.jpg", "./images/suite.jpg"],
    amenities: ["Free Wi-Fi", "Garden", "Terrace", "Shared lounge"],
    description:
      "A small guesthouse imagined around a sunlit garden. Handmade ceramics, books to borrow and a friendly common table create an intimate place to pause.",
    highlights: [
      "A garden in the city",
      "Small and personal",
      "Creative neighborhood atmosphere",
    ],
  },
  {
    id: "porto-foundry",
    name: "Foundry No. 8",
    city: "Porto",
    area: "Bonfim",
    type: "Hotel",
    rating: 8.7,
    reviews: 307,
    nightly: 104,
    capacity: 3,
    bedrooms: 1,
    cancellation: false,
    breakfast: false,
    image: "./images/suite.jpg",
    images: ["./images/suite.jpg", "./images/room.jpg"],
    amenities: ["Free Wi-Fi", "Air conditioning", "Workspace", "Restaurant"],
    description:
      "An imagined industrial conversion with high ceilings and a softer side. Warm lighting, practical rooms and an all-day dining room suit curious city explorers.",
    highlights: [
      "Industrial character",
      "Flexible three-person rooms",
      "An all-day gathering place",
    ],
  },
  {
    id: "algarve-cove",
    name: "Cove & Coast Retreat",
    city: "Algarve",
    area: "Lagos",
    type: "Resort",
    rating: 9.5,
    reviews: 672,
    nightly: 228,
    capacity: 4,
    bedrooms: 2,
    cancellation: true,
    breakfast: true,
    image: "./images/resort.jpg",
    images: [
      "./images/resort.jpg",
      "./images/pool.jpg",
      "./images/suite.jpg",
      "./images/coast.jpg",
    ],
    amenities: ["Free Wi-Fi", "Breakfast", "Pool", "Spa", "Parking"],
    description:
      "A fictional coastal retreat shaped around open skies and slow afternoons. Spacious suites, a garden pool and a generous breakfast make room for everyone to unwind.",
    highlights: [
      "Space for the whole family",
      "Poolside afternoons",
      "Breakfast at your own pace",
    ],
  },
  {
    id: "algarve-dunes",
    name: "Dune Notes Hotel",
    city: "Algarve",
    area: "Tavira",
    type: "Hotel",
    rating: 9.0,
    reviews: 243,
    nightly: 136,
    capacity: 2,
    bedrooms: 1,
    cancellation: true,
    breakfast: true,
    image: "./images/pool.jpg",
    images: ["./images/pool.jpg", "./images/room.jpg", "./images/coast.jpg"],
    amenities: [
      "Free Wi-Fi",
      "Breakfast",
      "Pool",
      "Terrace",
      "Air conditioning",
    ],
    description:
      "An imagined escape in a palette of sand, terracotta and sea grass. Shaded terraces and an intimate pool invite a quieter kind of Algarve holiday.",
    highlights: [
      "A slower coastal rhythm",
      "Shaded outdoor spaces",
      "Breakfast included",
    ],
  },
  {
    id: "algarve-villa",
    name: "Villa Solstice by Roam",
    city: "Algarve",
    area: "Carvoeiro",
    type: "Villa",
    rating: 9.7,
    reviews: 126,
    nightly: 286,
    capacity: 6,
    bedrooms: 3,
    cancellation: false,
    breakfast: false,
    image: "./images/resort.jpg",
    images: [
      "./images/resort.jpg",
      "./images/pool.jpg",
      "./images/suite.jpg",
      "./images/coast.jpg",
    ],
    amenities: [
      "Free Wi-Fi",
      "Kitchen",
      "Private pool",
      "Parking",
      "Air conditioning",
    ],
    description:
      "A fictional home for long lunches and shared sunsets. Three bedrooms, a private pool and an open kitchen give your group space to spend time together.",
    highlights: [
      "A whole villa to yourselves",
      "Private pool",
      "Three bedrooms for shared escapes",
    ],
  },
];

export const properties = Object.freeze(
  stays.map((stay) =>
    Object.freeze({
      ...stay,
      images: Object.freeze(stay.images),
      amenities: Object.freeze(stay.amenities),
      highlights: Object.freeze(stay.highlights),
      simulated: true,
    }),
  ),
);

export const destinations = Object.freeze([
  Object.freeze({
    id: "lisbon",
    name: "Lisbon",
    country: "Portugal",
    description: "Golden light. Endless possibilities.",
    image: "./images/room.jpg",
    stays: 3,
  }),
  Object.freeze({
    id: "porto",
    name: "Porto",
    country: "Portugal",
    description: "A little character around every corner.",
    image: "./images/suite.jpg",
    stays: 3,
  }),
  Object.freeze({
    id: "algarve",
    name: "Algarve",
    country: "Portugal",
    description: "Let the coast set the pace.",
    image: "./images/coast.jpg",
    stays: 3,
  }),
]);

export function getProperty(id) {
  return properties.find((property) => property.id === id);
}

/** Parse ISO date-only values without allowing Date's invalid-day rollover. */
function dateValue(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return NaN;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
    ? date.getTime()
    : NaN;
}

function todayValue(now) {
  const date = new Date(now);
  if (!Number.isFinite(date.getTime()))
    throw new Error("A valid current date is required.");
  return dateValue(date.toISOString().slice(0, 10));
}

function integer(value) {
  if (typeof value === "string" && !/^\d+$/.test(value.trim())) return NaN;
  if (!["number", "string"].includes(typeof value)) return NaN;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : NaN;
}

export function initialSearch(now = new Date()) {
  const checkIn = todayValue(now) + 14 * DAY;
  return {
    destination: "",
    checkIn: new Date(checkIn).toISOString().slice(0, 10),
    checkOut: new Date(checkIn + 3 * DAY).toISOString().slice(0, 10),
    adults: 2,
    children: 0,
    rooms: 1,
  };
}

/** Invalid, equal or reversed date ranges have no bookable nights. */
export function nights(checkIn, checkOut) {
  const count = (dateValue(checkOut) - dateValue(checkIn)) / DAY;
  return Number.isSafeInteger(count) && count > 0 ? count : 0;
}

function searchError(search, now) {
  if (!search || typeof search !== "object")
    return "Choose your travel dates and guests.";
  if (typeof search.destination !== "string" || search.destination.length > 150)
    return "Enter a destination of up to 150 characters.";
  if (!Number.isFinite(dateValue(search.checkIn)))
    return "Choose a valid check-in date.";
  if (!Number.isFinite(dateValue(search.checkOut)))
    return "Choose a valid check-out date.";
  if (now !== undefined && dateValue(search.checkIn) < todayValue(now))
    return "Check-in cannot be in the past.";
  const count = nights(search.checkIn, search.checkOut);
  if (!count) return "Check-out must be after check-in.";
  if (count > MAX_NIGHTS)
    return `Choose a stay of ${MAX_NIGHTS} nights or fewer.`;
  const adults = integer(search.adults),
    children = integer(search.children),
    rooms = integer(search.rooms);
  if (!(adults >= 1 && adults <= 8)) return "Choose between 1 and 8 adults.";
  if (!(children >= 0 && children <= 6))
    return "Choose between 0 and 6 children.";
  if (!(rooms >= 1 && rooms <= MAX_ROOMS))
    return `Choose between 1 and ${MAX_ROOMS} rooms.`;
  if (rooms > adults) return "Each room needs at least one adult.";
  return "";
}

export function validateSearch(search, now = new Date()) {
  return searchError(search, now);
}

function normalizedSearch(search) {
  return {
    destination: search.destination.trim(),
    checkIn: search.checkIn,
    checkOut: search.checkOut,
    adults: integer(search.adults),
    children: integer(search.children),
    rooms: integer(search.rooms),
  };
}

function fold(value) {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/** Filter the sample catalog; dates do not represent live accommodation inventory. */
export function findProperties(search = initialSearch(), filters = {}) {
  if (searchError(search)) return [];
  const query = fold(search.destination.trim());
  const types = Array.isArray(filters.types) ? filters.types.map(fold) : [];
  const saved = Array.isArray(filters.savedIds)
    ? new Set(filters.savedIds)
    : null;
  const maxPrice =
    filters.maxPrice === "" || filters.maxPrice == null
      ? Infinity
      : Number(filters.maxPrice);
  const minRating =
    filters.minRating === "" || filters.minRating == null
      ? 0
      : Number(filters.minRating);
  const guests = integer(search.adults) + integer(search.children);
  const result = properties.filter(
    (property) =>
      (!query ||
        fold(
          `${property.name} ${property.city} ${property.area} Portugal`,
        ).includes(query)) &&
      (!types.length || types.includes(fold(property.type))) &&
      (!filters.freeCancellation || property.cancellation) &&
      (!filters.breakfast || property.breakfast) &&
      property.rating >= minRating &&
      property.nightly <= maxPrice &&
      guests <= property.capacity * integer(search.rooms) &&
      (!saved || saved.has(property.id)),
  );
  if (filters.sort === "price-asc")
    result.sort((a, b) => a.nightly - b.nightly || b.rating - a.rating);
  if (filters.sort === "rating")
    result.sort((a, b) => b.rating - a.rating || b.reviews - a.reviews);
  return result;
}

const cents = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

export function quote(property, search) {
  const error = searchError(search);
  if (error) throw new Error(error);
  if (
    !property ||
    !Number.isFinite(property.nightly) ||
    property.nightly <= 0 ||
    !Number.isSafeInteger(property.capacity) ||
    property.capacity < 1
  )
    throw new Error("Choose a valid stay.");
  const request = normalizedSearch(search);
  if (request.adults + request.children > property.capacity * request.rooms)
    throw new Error(
      "This stay cannot accommodate your group. Choose more rooms or another stay.",
    );
  const count = nights(request.checkIn, request.checkOut);
  const nightly = cents(property.nightly);
  const subtotal = cents(nightly * count * request.rooms);
  const taxes = cents(DEMO_TAX_PER_ADULT_NIGHT * request.adults * count);
  return {
    nights: count,
    rooms: request.rooms,
    nightly,
    subtotal,
    taxes,
    total: cents(subtotal + taxes),
  };
}

function normalizeGuest(guest) {
  if (!guest || typeof guest !== "object")
    throw new Error("Enter the lead guest's details.");
  const firstName =
    typeof guest.firstName === "string" ? guest.firstName.trim() : "";
  const lastName =
    typeof guest.lastName === "string" ? guest.lastName.trim() : "";
  const email =
    typeof guest.email === "string" ? guest.email.trim().toLowerCase() : "";
  if (!firstName || firstName.length > 80)
    throw new Error("Enter a first name of up to 80 characters.");
  if (!lastName || lastName.length > 80)
    throw new Error("Enter a last name of up to 80 characters.");
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new Error("Enter a valid email address.");
  return { firstName, lastName, email };
}

export function createBooking(
  property,
  search,
  guest,
  { now = new Date(), id } = {},
) {
  const canonical = getProperty(property?.id);
  if (!canonical) throw new Error("Choose a stay from the Roam collection.");
  const error = validateSearch(search, now);
  if (error) throw new Error(error);
  const bookingId = id ?? `ROAM-${globalThis.crypto.randomUUID()}`;
  if (typeof bookingId !== "string" || !/^[a-zA-Z0-9-]{1,80}$/.test(bookingId))
    throw new Error("A valid reservation reference is required.");
  return {
    id: bookingId,
    propertyId: canonical.id,
    propertyName: canonical.name,
    image: canonical.image,
    city: canonical.city,
    search: normalizedSearch(search),
    guest: normalizeGuest(guest),
    quote: quote(canonical, search),
    status: "confirmed",
    freeCancellation: canonical.cancellation,
    createdAt: new Date(now).toISOString(),
    cancelledAt: null,
    simulated: true,
  };
}

/** Free demo cancellation ends at 00:00 UTC on the check-in date. */
export function isCancellable(booking, now = new Date()) {
  return Boolean(
    booking?.status === "confirmed" &&
    booking.freeCancellation === true &&
    dateValue(booking.search?.checkIn) > todayValue(now),
  );
}

export function cancelBooking(booking, now = new Date()) {
  if (!validBooking(booking))
    throw new Error("This reservation could not be read.");
  if (booking.status !== "confirmed")
    throw new Error("This reservation is already cancelled.");
  if (!booking.freeCancellation)
    throw new Error(
      "This demo reservation does not include free cancellation.",
    );
  if (new Date(now).getTime() < Date.parse(booking.createdAt))
    throw new Error("Cancellation cannot precede the reservation.");
  if (!isCancellable(booking, now))
    throw new Error("The free cancellation window has ended.");
  return {
    ...booking,
    search: { ...booking.search },
    guest: { ...booking.guest },
    quote: { ...booking.quote },
    status: "cancelled",
    cancelledAt: new Date(now).toISOString(),
  };
}

function validBooking(booking) {
  try {
    if (
      !booking ||
      typeof booking !== "object" ||
      typeof booking.id !== "string" ||
      !/^[a-zA-Z0-9-]{1,80}$/.test(booking.id)
    )
      return false;
    const property = getProperty(booking.propertyId);
    if (
      !property ||
      searchError(booking.search) ||
      !["confirmed", "cancelled"].includes(booking.status)
    )
      return false;
    if (
      booking.simulated !== true ||
      booking.freeCancellation !== property.cancellation
    )
      return false;
    normalizeGuest(booking.guest);
    const expected = quote(property, booking.search);
    if (
      !booking.quote ||
      !Object.entries(expected).every(
        ([key, value]) => booking.quote[key] === value,
      )
    )
      return false;
    const createdAt =
      typeof booking.createdAt === "string"
        ? Date.parse(booking.createdAt)
        : NaN;
    if (
      !Number.isFinite(createdAt) ||
      todayValue(createdAt) > dateValue(booking.search.checkIn)
    )
      return false;
    if (booking.status === "confirmed") return booking.cancelledAt === null;
    const cancelledAt =
      typeof booking.cancelledAt === "string"
        ? Date.parse(booking.cancelledAt)
        : NaN;
    return (
      booking.freeCancellation &&
      Number.isFinite(cancelledAt) &&
      cancelledAt >= createdAt &&
      cancelledAt < dateValue(booking.search.checkIn)
    );
  } catch {
    return false;
  }
}

export function createInitialState() {
  return { version: 1, savedIds: [], bookings: [] };
}

/** Local storage is untrusted: only reconstruct known fields and valid records. */
export function parseStoredState(raw) {
  const fallback = createInitialState();
  try {
    const stored = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!stored || stored.version !== 1) return fallback;
    const savedIds = [
      ...new Set(
        Array.isArray(stored.savedIds)
          ? stored.savedIds.filter((id) => getProperty(id))
          : [],
      ),
    ];
    const seen = new Set();
    const bookings = (Array.isArray(stored.bookings) ? stored.bookings : [])
      .filter((booking) => {
        if (!validBooking(booking) || seen.has(booking.id)) return false;
        seen.add(booking.id);
        return true;
      })
      .slice(0, 200)
      .map((booking) => {
        const property = getProperty(booking.propertyId);
        return {
          id: booking.id,
          propertyId: property.id,
          propertyName: property.name,
          image: property.image,
          city: property.city,
          search: normalizedSearch(booking.search),
          guest: normalizeGuest(booking.guest),
          quote: quote(property, booking.search),
          status: booking.status,
          freeCancellation: property.cancellation,
          createdAt: new Date(booking.createdAt).toISOString(),
          cancelledAt: booking.cancelledAt
            ? new Date(booking.cancelledAt).toISOString()
            : null,
          simulated: true,
        };
      });
    return { version: 1, savedIds, bookings };
  } catch {
    return fallback;
  }
}

export function formatMoney(value, locale = "en-GB") {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
  }).format(value);
}

export function formatDate(value, locale = "en-GB", options = {}) {
  const timestamp = dateValue(value);
  return Number.isFinite(timestamp)
    ? new Intl.DateTimeFormat(locale, {
        day: "numeric",
        month: "short",
        timeZone: "UTC",
        ...options,
      }).format(timestamp)
    : "";
}

export function escapeHtml(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ],
  );
}
