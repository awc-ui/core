'use client';
import { listBookings, createBooking, cancelSavedBooking } from '../lib/bookings.mjs';
import flightBanner from './assets/flight-banner.png';
import { submitCompositeFieldOnEnter } from '../lib/composite-field-enter.mjs';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  MdAppBar,
  MdTabs,
  MdTab,
  MdButton,
  MdButtonGroup,
  MdAutocomplete,
  MdDatePicker,
  MdSelect,
  MdSelectOption,
  MdIconButton,
  MdTextField,
  MdCheckbox,
  MdCard,
  MdDivider,
  MdStepper,
  MdStep,
  MdList,
  MdListItem,
  MdDialog,
  MdLoadingIndicator,
  MdSegmentedButtonSet,
  MdSegmentedButton,
  MdTooltip,
} from '@awc-ui/react';

import {
  airport,
  airportOptions,
  dateAfter,
  money,
  dayLabel,
  validateSearch,
  flightsFor,
  durationLabel,
  fares,
  seatUnavailable,
  seatPrice,
  quoteBooking,
  validatePassengers,
} from '../lib/flights.mjs';
type Search = {
  from: string;
  to: string;
  depart: string;
  returnDate: string;
  trip: string;
  travelers: number;
};
type Choice = { flightId: string; fare: string; seats: (string | null)[] };
type Flight = ReturnType<typeof flightsFor>[number];
type Passenger = { firstName: string; lastName: string };
type Screen = 'search' | 'details' | 'seats' | 'review' | 'confirmed' | 'trips';
type Booking = {
  id: string;
  reference: string;
  status: string;
  createdAt: string;
  search: Search;
  passengers: Passenger[];
  email: string;
  extraBag: boolean;
  quote: ReturnType<typeof quoteBooking>;
};
const emptyPassenger = () => ({ firstName: '', lastName: '' });
const initialSearch = (): Search => ({
  from: 'OTP',
  to: 'LIS',
  depart: dateAfter(14),
  returnDate: dateAfter(21),
  trip: 'roundtrip',
  travelers: 1,
});
function Icon({ name, className = '' }: { name: string; className?: string }) {
  return (
    <span
      className={`material-symbols-outlined ${className}`}
      aria-hidden="true"
    >
      {name}
    </span>
  );
}
function nextCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return '';
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return Number.isNaN(date.valueOf()) ? '' : date.toISOString().slice(0, 10);
}
function FlightTimes({ flight }: { flight: Flight }) {
  return (
    <div className="flight-timing">
      <div>
        <strong>{flight.departure}</strong>
        <span>{flight.from}</span>
      </div>
      <div className="flight-path">
        <span>{durationLabel(flight.duration)}</span>
        <div>
          <i />
          <span className="flight-track" />
          <Icon name="flight" />
        </div>
        <small>{flight.stops ? `1 stop · ${flight.via}` : 'Nonstop'}</small>
      </div>
      <div>
        <strong>
          {flight.arrival}
          {flight.arrivalDate > flight.date && <sup>+1</sup>}
        </strong>
        <span>{flight.to}</span>
      </div>
    </div>
  );
}
function Progress({ screen }: { screen: Screen }) {
  const active = ['search', 'details', 'seats', 'review'].indexOf(screen);
  return (
    <MdStepper
      className="booking-progress"
      active={active}
      readonly
      nav={false}
      autoComplete={false}
      label="Booking progress"
    >
      {['Flights', 'Travelers', 'Seats & bags', 'Review'].map((label, i) => (
        <MdStep key={label} label={label} completed={i < active} />
      ))}
    </MdStepper>
  );
}
function Summary({
  search,
  quote,
}: {
  search: Search;
  quote: ReturnType<typeof quoteBooking>;
}) {
  return (
    <aside className="booking-summary" aria-label="Journey and price summary">
      <MdCard variant="filled" fullWidth>
        <h2>Your journey</h2>
        <div className="summary-route">
          {airport(search.from)?.city}
          <Icon name="arrow_forward" />
          {airport(search.to)?.city}
        </div>
        <p className="muted">
          {search.trip === 'roundtrip' ? 'Round trip' : 'One way'} ·{' '}
          {search.travelers} adult{search.travelers === 1 ? '' : 's'}
        </p>
        <MdDivider />
        {quote.legs.map((leg, i) => (
          <div className="summary-leg" key={leg.flight.id}>
            <span>
              {i ? 'Return' : 'Outbound'} · {dayLabel(leg.flight.date)}
            </span>
            <strong>
              {leg.flight.departure} — {leg.flight.arrival}
            </strong>
            <small>
              {leg.flight.airline} ·{' '}
              {fares.find((f) => f.id === leg.fare)?.name}
            </small>
          </div>
        ))}
        <MdDivider />
        <dl className="price-breakdown">
          <div>
            <dt>Flights, including taxes</dt>
            <dd>{money(quote.flights)}</dd>
          </div>
          <div>
            <dt>Seat selection</dt>
            <dd>{quote.seats ? money(quote.seats) : 'Included'}</dd>
          </div>
          <div>
            <dt>Extra checked bags</dt>
            <dd>{quote.bags ? money(quote.bags) : '—'}</dd>
          </div>
          <div className="total">
            <dt>
              Total <small>EUR</small>
            </dt>
            <dd>{money(quote.total)}</dd>
          </div>
        </dl>
        <p className="icon-text muted">
          <Icon name="verified_user" />
          No hidden booking fees
        </p>
      </MdCard>
    </aside>
  );
}
export default function FlightApp() {
  const [search, setSearch] = useState<Search>(initialSearch);
  const [query, setQuery] = useState<Search>(search);
  const [screen, setScreen] = useState<Screen>('search');
  const [error, setError] = useState('');
  const [direct, setDirect] = useState(false);
  const [sort, setSort] = useState('best');
  const [legIndex, setLegIndex] = useState(0);
  const [candidate, setCandidate] = useState<string | null>(null);
  const [choices, setChoices] = useState<Choice[]>([]);
  const [passengers, setPassengers] = useState<Passenger[]>([emptyPassenger()]);
  const [email, setEmail] = useState('');
  const [extraBag, setExtraBag] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [seatLeg, setSeatLeg] = useState(0);
  const [seatTraveler, setSeatTraveler] = useState(0);
  const [busy, setBusy] = useState(false);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [trips, setTrips] = useState<Booking[]>([]);
  const [tripsLoading, setTripsLoading] = useState(true);
  const [tripsError, setTripsError] = useState('');
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState('');
  const requestId = useRef('');
  const submitting = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const resultsHeading = useRef<HTMLHeadingElement>(null);
  const [notice, setNotice] = useState('');
  const quote = useMemo(() => {
    try {
      return quoteBooking(query, choices, extraBag);
    } catch {
      return null;
    }
  }, [query, choices, extraBag]);
  const from = legIndex ? query.to : query.from,
    to = legIndex ? query.from : query.to,
    date = legIndex ? query.returnDate : query.depart;
  const flights = useMemo(() => {
    const result = flightsFor(from, to, date).filter(
      (f) => !direct || !f.stops,
    );
    if (sort === 'price') result.sort((a, b) => a.price - b.price);
    if (sort === 'duration') result.sort((a, b) => a.duration - b.duration);
    return result;
  }, [from, to, date, direct, sort]);
  const update = (key: keyof Search, value: unknown) =>
    setSearch((s) => ({ ...s, [key]: value }));
  async function loadTrips() {
    setTripsLoading(true);
    setTripsError('');
    try {
      setTrips(await listBookings());
    } catch {
      setTripsError('Your trips could not be loaded. Please try again.');
    } finally {
      setTripsLoading(false);
    }
  }
  useEffect(() => {
    void loadTrips();
    if (location.hash === '#trips') setScreen('trips');
  }, []);
  useEffect(() => {
    if (screen !== 'search') heading.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'instant' });
    setError('');
    setNotice('');
  }, [screen, legIndex]);
  function navigate(next: Screen) {
    setScreen(next);
    history.replaceState(null, '', next === 'trips' ? '#trips' : '#flights');
    if (next === 'trips') void loadTrips();
  }
  function startSearch(next: Search) {
    validateSearch(next);
    setSearch({ ...next });
    setQuery({ ...next });
    setChoices([]);
    setCandidate(null);
    setLegIndex(0);
    setSeatLeg(0);
    setSeatTraveler(0);
    setExtraBag(false);
    setAccepted(false);
    setPassengers(Array.from({ length: next.travelers }, emptyPassenger));
    requestId.current = '';
    setScreen('search');
    history.replaceState(null, '', '#flights');
    setError('');
  }
  function chooseFlight(flight: Flight, fare: string) {
    const choice = {
      flightId: flight.id,
      fare,
      seats: Array(query.travelers).fill(null),
    };
    setChoices((current) => {
      const next = current.slice(0, legIndex);
      next[legIndex] = choice;
      return next;
    });
    setCandidate(null);
    setAccepted(false);
    requestId.current = '';
    if (query.trip === 'roundtrip' && legIndex === 0) setLegIndex(1);
    else {
      setPassengers((p) =>
        p.length === query.travelers
          ? p
          : Array.from({ length: query.travelers }, emptyPassenger),
      );
      setScreen('details');
    }
  }
  function goBackToFlights() {
    setLegIndex(query.trip === 'roundtrip' ? 1 : 0);
    setScreen('search');
    setCandidate(null);
  }
  function updatePassenger(index: number, key: keyof Passenger, value: string) {
    setPassengers((p) =>
      p.map((person, i) =>
        i === index ? { ...person, [key]: value } : person,
      ),
    );
    setAccepted(false);
    requestId.current = '';
  }
  function pickSeat(seat: string) {
    if (!quote) return;
    const leg = quote.legs[seatLeg];
    if (seatUnavailable(leg.flight.id, seat)) return;
    const usedBy = choices[seatLeg].seats.indexOf(seat);
    if (usedBy !== -1 && usedBy !== seatTraveler) {
      setNotice(
        `Seat ${seat} belongs to traveler ${usedBy + 1}. Choose another seat.`,
      );
      return;
    }
    setChoices((c) =>
      c.map((choice, i) =>
        i === seatLeg
          ? {
              ...choice,
              seats: choice.seats.map((s, j) =>
                j === seatTraveler ? (s === seat ? null : seat) : s,
              ),
            }
          : choice,
      ),
    );
    setNotice(
      `Seat ${seat} ${choices[seatLeg].seats[seatTraveler] === seat ? 'cleared' : 'selected'} for traveler ${seatTraveler + 1}.`,
    );
    requestId.current = '';
    setAccepted(false);
  }
  async function confirmBooking() {
    if (submitting.current) return;
    try {
      validatePassengers(passengers, query.travelers, email);
      quoteBooking(query, choices, extraBag);
      if (!accepted)
        throw new Error('Please confirm the passenger details before booking.');
      submitting.current = true;
      setBusy(true);
      setError('');
      requestId.current ||= crypto.randomUUID();
      const savedBooking = await createBooking({
          requestId: requestId.current,
          search: query,
          choices,
          passengers,
          email,
          extraBag,
          accepted,
      });
      setBooking(savedBooking);
      setTrips((t) => [
        savedBooking,
        ...t.filter((x) => x.id !== savedBooking.id),
      ]);
      setScreen('confirmed');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  async function cancelBooking(id: string) {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setCancelError('');
    try {
      const cancelledBooking = await cancelSavedBooking(id);
      setTrips((t) => t.map((b) => (b.id === id ? cancelledBooking : b)));
      setCancelId(null);
    } catch (err) {
      setCancelError((err as Error).message);
    } finally {
      setBusy(false);
      submitting.current = false;
    }
  }
  useEffect(() => {
    const context = (document as any).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const register = (tool: any) => {
      try {
        void Promise.resolve(
          context.registerTool(tool, { signal: lifecycle.signal }),
        ).catch(() => {});
      } catch {}
    };
    register({
      name: 'search_demo_flights',
      title: 'Search demo flights',
      description:
        'Search simulated flights and update the visible flight results. This does not book or charge anything.',
      inputSchema: {
        type: 'object',
        properties: {
          from: { type: 'string', enum: airportOptions.map((a) => a.value) },
          to: { type: 'string', enum: airportOptions.map((a) => a.value) },
          depart: { type: 'string' },
          returnDate: { type: 'string' },
          trip: { type: 'string', enum: ['oneway', 'roundtrip'] },
          travelers: { type: 'integer', minimum: 1, maximum: 6 },
        },
        required: ['from', 'to', 'depart', 'trip', 'travelers'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false },
      execute: async (input: any) => {
        const next = { ...input, returnDate: input.returnDate || '' };
        startSearch(next);
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        );
        return {
          flights: flightsFor(next.from, next.to, next.depart).map((f) => ({
            id: f.id,
            departure: f.departure,
            arrival: f.arrival,
            price: f.price,
            stops: f.stops,
          })),
          currency: 'EUR',
          simulated: true,
        };
      },
    });
    register({
      name: 'list_demo_bookings',
      title: 'List saved demo bookings',
      description:
        'Read this tab’s saved simulated bookings. Does not change or cancel bookings.',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true },
      execute: async () => {
        const savedBookings = await listBookings();
        return {
          bookings: savedBookings.map((b: Booking) => ({
            reference: b.reference,
            status: b.status,
            from: b.search.from,
            to: b.search.to,
            depart: b.search.depart,
            total: b.quote.total,
            currency: 'EUR',
          })),
        };
      },
    });
    return () => lifecycle.abort();
  }, []);
  return (
    <div className="aero-app">
      <a href="#main" className="skip-link">
        Skip to booking content
      </a>
      <MdAppBar variant="small" className="app-bar">
        <a
          slot="headline"
          className="wordmark"
          href="#flights"
          onClick={(e) => {
            e.preventDefault();
            navigate('search');
          }}
          aria-label="Aero home"
        >
          <Icon name="flight" />
          aero
        </a>
        <span slot="trailing" className="header-meta">
          EUR · English
        </span>
        <span slot="trailing" className="header-demo">
          Booking demo
        </span>
      </MdAppBar>
      <MdTabs
        className="workspace-tabs"
        aria-label="Booking workspace"
        activeTabIndex={screen === 'trips' ? 1 : 0}
        onMdTabChange={(e) => {
          const next = e.detail.index === 1 ? 'trips' : 'search';
          if ((screen === 'trips') !== (next === 'trips')) navigate(next);
        }}
      >
        <MdTab
          id="flights-tab"
          label="Book a flight"
          icon="flight_takeoff"
          inlineIcon
          controls="flights-panel"
        />
        <MdTab
          id="trips-tab"
          label="My trips"
          icon="confirmation_number"
          inlineIcon
          controls="trips-panel"
          badge={trips.length ? String(trips.length) : undefined}
        />
      </MdTabs>
      <main id="main" className="workspace">
        <div
          id="flights-panel"
          role="tabpanel"
          aria-labelledby="flights-tab"
          hidden={screen === 'trips'}
        >
          {/* Keep core controls connected so tab changes do not replay group initialization. */}
          <div hidden={screen !== 'search'}>
            <section className="search-intro">
              <div>
                <span className="eyebrow">FLIGHT SEARCH</span>
                <h1>Where are you heading?</h1>
                <p>
                  Compare flights, choose your fare, and make it your journey.
                </p>
              </div>
              <img
                src={flightBanner}
                alt="An aircraft wing above the Mediterranean coast"
              />
            </section>
            <MdCard variant="outlined" fullWidth className="search-card">
              <form
                className="search-panel"
                onSubmit={(e) => {
                  e.preventDefault();
                  try {
                    startSearch(search);
                  } catch (err) {
                    setError((err as Error).message);
                  }
                }}
              >
                <div className="search-options">
                  <MdButtonGroup
                    className="trip-type-group"
                    variant="standard"
                    size="sm"
                    selectionMode="single-select"
                    required
                    fullWidth
                    aria-label="Trip type"
                    onMdSelectionChange={(e) => {
                      const [trip] = e.detail.values;
                      if (trip && trip !== search.trip) update('trip', trip);
                    }}
                  >
                    <MdButton
                      value="roundtrip"
                      selected={search.trip === 'roundtrip'}
                    >
                      Round trip
                    </MdButton>
                    <MdButton
                      value="oneway"
                      selected={search.trip === 'oneway'}
                    >
                      One way
                    </MdButton>
                  </MdButtonGroup>
                  <MdSelect
                    name="travelers"
                    label="Travelers"
                    variant="outlined"
                    value={String(search.travelers)}
                    onMdChange={(e) => update('travelers', Number(e.detail))}
                  >
                    {[1, 2, 3, 4, 5, 6].map((n) => (
                      <MdSelectOption
                        key={n}
                        value={String(n)}
                        label={`${n} adult${n === 1 ? '' : 's'}`}
                      />
                    ))}
                  </MdSelect>
                  <span className="icon-text muted cabin-label">
                    <Icon name="airline_seat_recline_normal" />
                    Economy
                  </span>
                </div>
                <div
                  className={`search-grid ${search.trip === 'oneway' ? 'oneway' : ''}`}
                >
                  <div className="route-fields">
                    <div className="route-tools">
                      <h3>Route</h3>
                      <MdButton
                        type="button"
                        variant="text"
                        icon="swap_vert"
                        aria-label="Swap origin and destination"
                        onMdClick={() =>
                          setSearch((s) => ({ ...s, from: s.to, to: s.from }))
                        }
                      >
                        Swap
                      </MdButton>
                    </div>
                    <div className="airport-fields">
                      <MdAutocomplete
                        onKeyDown={(e) =>
                          submitCompositeFieldOnEnter(
                            e.nativeEvent,
                            e.currentTarget,
                          )
                        }
                        label="From"
                        name="from"
                        variant="outlined"
                        clearable={false}
                        options={airportOptions}
                        value={search.from}
                        required
                        onMdChange={(e) => update('from', e.detail)}
                      />
                      <MdTooltip
                        className="airport-swap-desktop"
                        text="Swap airports"
                      >
                        <MdIconButton
                          icon="swap_horiz"
                          size="md"
                          variant="tonal"
                          aria-label="Swap origin and destination"
                          onMdClick={() =>
                            setSearch((s) => ({
                              ...s,
                              from: s.to,
                              to: s.from,
                            }))
                          }
                        />
                      </MdTooltip>
                      <MdAutocomplete
                        onKeyDown={(e) =>
                          submitCompositeFieldOnEnter(
                            e.nativeEvent,
                            e.currentTarget,
                          )
                        }
                        label="To"
                        name="to"
                        variant="outlined"
                        clearable={false}
                        options={airportOptions}
                        value={search.to}
                        required
                        onMdChange={(e) => update('to', e.detail)}
                      />
                    </div>
                  </div>
                  <div className="date-fields">
                    <MdDatePicker
                      name="depart"
                      label="Departure"
                      required
                      reserveSupportingSpace
                      locale="en-GB"
                      value={search.depart}
                      min={dateAfter(0, airport(search.from)?.tz)}
                      max={dateAfter(330, airport(search.from)?.tz)}
                      variant="modal-input"
                      fieldVariant="outlined"
                      onMdChange={(e) => update('depart', e.detail.value)}
                    />
                    {search.trip === 'roundtrip' && (
                      <MdDatePicker
                        name="return"
                        label="Return"
                        required
                        reserveSupportingSpace
                        locale="en-GB"
                        value={search.returnDate}
                        min={nextCalendarDate(search.depart)}
                        max={dateAfter(330, airport(search.from)?.tz)}
                        variant="modal-input"
                        fieldVariant="outlined"
                        onMdChange={(e) => update('returnDate', e.detail.value)}
                      />
                    )}
                  </div>
                  <MdButton type="submit" size="md" icon="search">
                    Find flights
                  </MdButton>
                </div>
                {error && (
                  <p className="error" role="alert">
                    {error}
                  </p>
                )}
              </form>
            </MdCard>
            {legIndex === 1 && choices[0] && (
              <div className="selection-notice" role="status">
                <Icon name="check_circle" />
                <span>Outbound selected. Choose your flight home.</span>
                <MdButton
                  variant="text"
                  onMdClick={() => {
                    setLegIndex(0);
                    setCandidate(null);
                  }}
                >
                  Change outbound
                </MdButton>
              </div>
            )}
            <section aria-labelledby="results-title">
              <div className="results-heading">
                <div>
                  <span className="eyebrow">
                    {legIndex ? 'RETURN FLIGHT' : 'OUTBOUND FLIGHT'}
                  </span>
                  <h2 id="results-title" ref={resultsHeading} tabIndex={-1}>
                    {airport(from)?.city} <Icon name="arrow_forward" />{' '}
                    {airport(to)?.city}
                  </h2>
                  <p className="muted">
                    {dayLabel(date)} · {query.travelers} adult
                    {query.travelers === 1 ? '' : 's'} · {flights.length}{' '}
                    flights
                  </p>
                </div>
                <span className="muted">All times are local</span>
              </div>
              <div className="results-toolbar">
                <label className="check-label">
                  <MdCheckbox
                    checked={direct}
                    onMdChange={(e) => setDirect(e.detail.checked)}
                  />
                  Nonstop only
                </label>
                <MdSegmentedButtonSet
                  className="desktop-control"
                  aria-label="Sort flights"
                  onMdChange={(e) => {
                    if (e.detail[0]) setSort(e.detail[0]);
                  }}
                >
                  <MdSegmentedButton
                    value="best"
                    label="Recommended"
                    selected={sort === 'best'}
                  />
                  <MdSegmentedButton
                    value="price"
                    label="Lowest price"
                    selected={sort === 'price'}
                  />
                  <MdSegmentedButton
                    value="duration"
                    label="Shortest"
                    selected={sort === 'duration'}
                  />
                </MdSegmentedButtonSet>
                <MdSelect
                  className="mobile-control"
                  name="sort"
                  label="Sort flights"
                  value={sort}
                  onMdChange={(e) => setSort(e.detail)}
                >
                  <MdSelectOption value="best" label="Recommended" />
                  <MdSelectOption value="price" label="Lowest price" />
                  <MdSelectOption value="duration" label="Shortest flight" />
                </MdSelect>
              </div>
              <div className="flight-list">
                {flights.length === 0 && (
                  <MdCard variant="outlined" fullWidth>
                    <div className="empty-state">
                      <Icon name="flight_takeoff" />
                      <h3>No flights match this search</h3>
                      <p>
                        Try another date or include connecting flights.
                        Departures within the next hour are unavailable.
                      </p>
                      <MdButton
                        variant="outlined"
                        onMdClick={() => setDirect(false)}
                      >
                        Show all stops
                      </MdButton>
                    </div>
                  </MdCard>
                )}
                {flights.map((flight, i) => (
                  <MdCard
                    className="flight-wrap"
                    variant="outlined"
                    fullWidth
                    key={flight.id}
                  >
                    <article
                      className="flight-card"
                      aria-label={`${flight.airline} ${flight.number}`}
                    >
                      <div className="flight-info">
                        <div className="airline-name">
                          <Icon name="flight" />
                          <strong>{flight.airline}</strong>
                          <span className="muted">{flight.number}</span>
                          {i === 0 && sort === 'best' && (
                            <span className="recommended icon-text">
                              <Icon name="recommend" />
                              Recommended
                            </span>
                          )}
                        </div>
                        <FlightTimes flight={flight} />
                        <span className="flight-meta">
                          {flight.aircraft} · Cabin bag included
                        </span>
                      </div>
                      <div className="flight-price">
                        <div>
                          <span className="muted">from</span>
                          <strong>
                            {money(flight.price * query.travelers)}
                          </strong>
                          <small>
                            {query.travelers === 1
                              ? 'per adult'
                              : 'all travelers'}{' '}
                            · one way
                          </small>
                        </div>
                        <MdButton
                          variant={
                            candidate === flight.id ? 'tonal' : 'outlined'
                          }
                          aria-expanded={candidate === flight.id}
                          aria-controls={`fares-${flight.id}`}
                          onMdClick={() =>
                            setCandidate(
                              candidate === flight.id ? null : flight.id,
                            )
                          }
                          trailingIcon={
                            candidate === flight.id
                              ? 'expand_less'
                              : 'expand_more'
                          }
                        >
                          {candidate === flight.id
                            ? 'Close fares'
                            : 'Select flight'}
                        </MdButton>
                      </div>
                    </article>
                    {candidate === flight.id && (
                      <section
                        id={`fares-${flight.id}`}
                        className="fare-picker"
                        aria-label={`Fares for ${flight.number}`}
                      >
                        <MdDivider />
                        <div className="panel-title">
                          <h3>Choose your fare</h3>
                          <span className="muted">
                            For {query.travelers} adult
                            {query.travelers === 1 ? '' : 's'}, this flight
                          </span>
                        </div>
                        <div className="fare-grid">
                          {fares.map((fare) => (
                            <MdCard
                              variant={
                                fare.id === 'comfort' ? 'filled' : 'outlined'
                              }
                              className="fare-option"
                              fullWidth
                              key={fare.id}
                            >
                              <div className="panel-title">
                                <h4>{fare.name}</h4>
                                {fare.id === 'comfort' && (
                                  <span className="recommended">
                                    Most popular
                                  </span>
                                )}
                              </div>
                              <p className="muted">{fare.description}</p>
                              <strong className="fare-total">
                                {money(
                                  (flight.price + fare.add) * query.travelers,
                                )}
                              </strong>
                              <ul className="fare-features">
                                {fare.features.map((feature) => (
                                  <li key={feature}>
                                    <Icon name="check" />
                                    {feature}
                                  </li>
                                ))}
                              </ul>
                              <MdButton
                                fullWidth
                                variant={
                                  fare.id === 'comfort' ? 'filled' : 'outlined'
                                }
                                onMdClick={() => chooseFlight(flight, fare.id)}
                              >
                                Choose {fare.name}
                              </MdButton>
                            </MdCard>
                          ))}
                        </div>
                        <p className="muted">
                          Simulated fares and schedules. No real ticket will be
                          issued.
                        </p>
                      </section>
                    )}
                  </MdCard>
                ))}
              </div>
            </section>
          </div>
          {['details', 'seats', 'review'].includes(screen) && quote && (
            <>
              <Progress screen={screen} />
              <div className="checkout-heading">
                <MdButton
                  variant="text"
                  icon="arrow_back"
                  onMdClick={() =>
                    screen === 'details'
                      ? goBackToFlights()
                      : setScreen(screen === 'seats' ? 'details' : 'seats')
                  }
                >
                  Back
                </MdButton>
                <h1 ref={heading} tabIndex={-1}>
                  {screen === 'details'
                    ? 'Who’s flying?'
                    : screen === 'seats'
                      ? 'Seats and baggage'
                      : 'Review your booking'}
                </h1>
                <p>
                  {screen === 'details'
                    ? 'Use each traveler’s name as it appears on their travel document.'
                    : screen === 'seats'
                      ? 'Choose a seat, or leave it to us at check-in.'
                      : 'Check your trip and traveler details before confirming.'}
                </p>
              </div>
              <div className="checkout-layout">
                <div className="checkout-main">
                  {screen === 'details' && (
                    <MdCard variant="outlined" fullWidth>
                      <form
                        className="form-panel"
                        onSubmit={(e) => {
                          e.preventDefault();
                          try {
                            validatePassengers(
                              passengers,
                              query.travelers,
                              email,
                            );
                            setError('');
                            setScreen('seats');
                          } catch (err) {
                            setError((err as Error).message);
                          }
                        }}
                      >
                        <div className="panel-title">
                          <h2>Traveler details</h2>
                          <MdButton
                            variant="text"
                            icon="science"
                            onMdClick={() => {
                              setPassengers(
                                Array.from(
                                  { length: query.travelers },
                                  (_, i) => ({
                                    firstName: [
                                      'Alex',
                                      'Sam',
                                      'Jamie',
                                      'Taylor',
                                      'Morgan',
                                      'Casey',
                                    ][i],
                                    lastName: 'Morgan',
                                  }),
                                ),
                              );
                              setEmail('alex@example.com');
                              setAccepted(false);
                              requestId.current = '';
                            }}
                          >
                            Use demo details
                          </MdButton>
                        </div>
                        {passengers.map((person, i) => (
                          <fieldset className="passenger-form" key={i}>
                            <legend>
                              Adult {i + 1}
                              {i === 0 && (
                                <span className="muted"> · Lead traveler</span>
                              )}
                            </legend>
                            <div className="form-grid">
                              <MdTextField
                                variant="outlined"
                                reserveSupportingSpace
                                label="First name"
                                name={`firstName-${i}`}
                                required
                                maxLength={60}
                                value={person.firstName}
                                autocomplete="given-name"
                                onMdInput={(e) =>
                                  updatePassenger(i, 'firstName', e.detail)
                                }
                              />
                              <MdTextField
                                variant="outlined"
                                reserveSupportingSpace
                                label="Last name"
                                name={`lastName-${i}`}
                                required
                                maxLength={60}
                                value={person.lastName}
                                autocomplete="family-name"
                                onMdInput={(e) =>
                                  updatePassenger(i, 'lastName', e.detail)
                                }
                              />
                            </div>
                          </fieldset>
                        ))}
                        <MdDivider />
                        <section className="contact-section">
                          <h3>Booking contact</h3>
                          <p className="muted">
                            Saved on your itinerary. The demo does not send
                            email.
                          </p>
                          <MdTextField
                            variant="outlined"
                            reserveSupportingSpace
                            label="Email address"
                            name="email"
                            type="email"
                            required
                            value={email}
                            autocomplete="email"
                            onMdInput={(e) => {
                              setEmail(e.detail);
                              setAccepted(false);
                              requestId.current = '';
                            }}
                          />
                        </section>
                        {error && (
                          <p className="error" role="alert">
                            {error}
                          </p>
                        )}
                        <div className="form-actions">
                          <span className="icon-text muted">
                            <Icon name="verified_user" />
                            Saved with your demo booking
                          </span>
                          <MdButton
                            type="submit"
                            size="md"
                            trailingIcon="arrow_forward"
                          >
                            Continue to seats
                          </MdButton>
                        </div>
                      </form>
                    </MdCard>
                  )}
                  {screen === 'seats' && (
                    <>
                      <MdCard
                        variant="outlined"
                        fullWidth
                        className="seating-card"
                      >
                        <div className="panel-title">
                          <h2 className="icon-text">
                            <Icon name="airline_seat_recline_normal" />
                            Choose your seats
                          </h2>
                          <span className="muted">Optional</span>
                        </div>
                        <div className="seat-controls">
                          {quote.legs.length === 2 ? (
                            <>
                              <MdSegmentedButtonSet
                                className="desktop-control"
                                key={quote.legs
                                  .map((l) => l.flight.id)
                                  .join('|')}
                                aria-label="Flight for seat selection"
                                onMdChange={(e) => {
                                  if (e.detail[0])
                                    setSeatLeg(Number(e.detail[0]));
                                }}
                              >
                                <MdSegmentedButton
                                  value="0"
                                  label="Outbound"
                                  selected={seatLeg === 0}
                                />
                                <MdSegmentedButton
                                  value="1"
                                  label="Return"
                                  selected={seatLeg === 1}
                                />
                              </MdSegmentedButtonSet>
                              <MdSelect
                                className="mobile-control"
                                name="seatLeg"
                                label="Flight"
                                value={String(seatLeg)}
                                onMdChange={(e) => setSeatLeg(Number(e.detail))}
                              >
                                <MdSelectOption value="0" label="Outbound" />
                                <MdSelectOption value="1" label="Return" />
                              </MdSelect>
                            </>
                          ) : (
                            <span className="muted">Outbound flight</span>
                          )}
                          <MdSelect
                            name="seatTraveler"
                            label="Traveler"
                            variant="outlined"
                            fullWidth
                            value={String(seatTraveler)}
                            onMdChange={(e) =>
                              setSeatTraveler(Number(e.detail))
                            }
                          >
                            {passengers.map((p, i) => (
                              <MdSelectOption
                                key={i}
                                value={String(i)}
                                label={`${i + 1}. ${p.firstName} ${p.lastName}`}
                              />
                            ))}
                          </MdSelect>
                        </div>
                        <div className="seat-layout">
                          <div
                            className="seat-map"
                            role="group"
                            aria-label={`Seat map for ${quote.legs[seatLeg].flight.from} to ${quote.legs[seatLeg].flight.to}`}
                          >
                            <div className="seat-map-caption">
                              <Icon name="flight" />
                              Front of cabin · {
                                quote.legs[seatLeg].flight.from
                              }{' '}
                              → {quote.legs[seatLeg].flight.to}
                            </div>
                            <div className="seat-columns">
                              {'ABCDEF'.split('').map((letter, i) => (
                                <span
                                  key={letter}
                                  style={{ gridColumn: i >= 3 ? i + 2 : i + 1 }}
                                >
                                  {letter}
                                </span>
                              ))}
                            </div>
                            {Array.from({ length: 12 }, (_, r) => (
                              <div className="seat-row" key={r}>
                                {'ABCDEF'.split('').map((letter, col) => {
                                  const seat = `${r + 1}${letter}`,
                                    usedBy =
                                      choices[seatLeg].seats.indexOf(seat),
                                    unavailable = seatUnavailable(
                                      quote.legs[seatLeg].flight.id,
                                      seat,
                                    ),
                                    selected = usedBy === seatTraveler,
                                    other = usedBy !== -1 && !selected;
                                  return (
                                    <MdButton
                                      key={seat}
                                      className="seat"
                                      size="xs"
                                      fullWidth
                                      shape="square"
                                      variant={r < 2 ? 'tonal' : 'outlined'}
                                      toggle
                                      selected={selected}
                                      style={{
                                        gridColumn:
                                          col >= 3 ? col + 2 : col + 1,
                                      }}
                                      disabled={unavailable || other}
                                      aria-label={`Seat ${seat}, ${unavailable ? 'unavailable' : other ? `assigned to traveler ${usedBy + 1}` : selected ? 'selected' : `${r < 2 ? 'extra legroom, ' : ''}${money(seatPrice(quote.legs[seatLeg].fare, seat))}`}`}
                                      onMdClick={(e) => {
                                        e.preventDefault();
                                        pickSeat(seat);
                                      }}
                                    >
                                      {unavailable ? '—' : seat}
                                    </MdButton>
                                  );
                                })}
                              </div>
                            ))}
                          </div>
                          <div className="seat-details">
                            <h3>
                              {passengers[seatTraveler]?.firstName}’s seat
                            </h3>
                            <strong className="chosen-seat">
                              {choices[seatLeg].seats[seatTraveler] ||
                                'Not selected'}
                            </strong>
                            <p className="muted">
                              {choices[seatLeg].seats[seatTraveler]
                                ? `${money(seatPrice(quote.legs[seatLeg].fare, choices[seatLeg].seats[seatTraveler]))} for this seat`
                                : 'We’ll assign a seat at check-in if you skip selection.'}
                            </p>
                            <MdDivider />
                            <p className="muted">
                              Rows 1–2 have extra legroom. Unavailable seats are
                              disabled.
                            </p>
                            <MdList label="Seats for this flight">
                              {passengers.map((p, i) => (
                                <MdListItem
                                  key={i}
                                  headline={p.firstName}
                                  supportingText={`Traveler ${i + 1}`}
                                  trailingSupportingText={
                                    choices[seatLeg].seats[i] || 'Auto'
                                  }
                                />
                              ))}
                            </MdList>
                            <p role="status" className="seat-notice">
                              {notice}
                            </p>
                          </div>
                        </div>
                      </MdCard>
                      <MdCard variant="outlined" fullWidth>
                        <h2 className="icon-text">
                          <Icon name="luggage" />
                          Baggage
                        </h2>
                        <p className="muted">
                          A personal item and 8 kg cabin bag are included for
                          everyone.
                        </p>
                        {quote.legs.some((l) => l.fare === 'light') ? (
                          <label className="bag-choice">
                            <MdCheckbox
                              name="extraBag"
                              checked={extraBag}
                              onMdChange={(e) => {
                                setExtraBag(e.detail.checked);
                                setAccepted(false);
                                requestId.current = '';
                              }}
                            />
                            <span>
                              <strong>Add a 23 kg checked bag</strong>
                              <small>
                                For each traveler on Light-fare flights. Already
                                included with Comfort and Flex.
                              </small>
                            </span>
                            <b>
                              {money(
                                29 *
                                  query.travelers *
                                  quote.legs.filter((l) => l.fare === 'light')
                                    .length,
                              )}
                            </b>
                          </label>
                        ) : (
                          <p className="icon-text success-text">
                            <Icon name="check_circle" />A 23 kg checked bag is
                            included on every flight.
                          </p>
                        )}
                      </MdCard>
                      <div className="next-row">
                        <MdButton
                          variant="text"
                          onMdClick={() => {
                            setChoices((c) =>
                              c.map((x) => ({
                                ...x,
                                seats: Array(query.travelers).fill(null),
                              })),
                            );
                            setAccepted(false);
                            requestId.current = '';
                            setScreen('review');
                          }}
                        >
                          Skip seat selection
                        </MdButton>
                        <MdButton
                          size="md"
                          trailingIcon="arrow_forward"
                          onMdClick={() => setScreen('review')}
                        >
                          Review booking
                        </MdButton>
                      </div>
                    </>
                  )}
                  {screen === 'review' && (
                    <>
                      <MdCard variant="outlined" fullWidth>
                        <div className="panel-title">
                          <h2>Your flights</h2>
                          <MdButton variant="text" onMdClick={goBackToFlights}>
                            Edit flights
                          </MdButton>
                        </div>
                        {quote.legs.map((leg, i) => (
                          <div className="review-flight" key={leg.flight.id}>
                            {i > 0 && <MdDivider />}
                            <div className="panel-title">
                              <span className="eyebrow">
                                {i ? 'RETURN' : 'OUTBOUND'} ·{' '}
                                {dayLabel(leg.flight.date)}
                              </span>
                              <span className="muted">
                                {fares.find((f) => f.id === leg.fare)?.name}
                              </span>
                            </div>
                            <FlightTimes flight={leg.flight} />
                            <p className="muted">
                              {leg.flight.airline} · {leg.flight.number} ·{' '}
                              {leg.flight.stops
                                ? `Connection in ${airport(leg.flight.via)?.city}`
                                : 'Nonstop'}
                              {leg.flight.arrivalDate > leg.flight.date
                                ? ` · Arrives ${dayLabel(leg.flight.arrivalDate)}`
                                : ''}
                            </p>
                          </div>
                        ))}
                      </MdCard>
                      <MdCard variant="outlined" fullWidth>
                        <div className="panel-title">
                          <h2>Travelers & contact</h2>
                          <MdButton
                            variant="text"
                            onMdClick={() => setScreen('details')}
                          >
                            Edit travelers
                          </MdButton>
                        </div>
                        <MdList label="Travelers">
                          {passengers.map((p, i) => (
                            <MdListItem
                              key={i}
                              leadingIcon="person"
                              headline={`${p.firstName} ${p.lastName}`}
                              supportingText={quote.legs
                                .map(
                                  (leg, j) =>
                                    `${j ? 'Return' : 'Outbound'} seat: ${leg.seats[i] || 'Auto-assigned'}`,
                                )
                                .join(' · ')}
                            />
                          ))}
                        </MdList>
                        <MdDivider />
                        <p className="icon-text contact-email">
                          <Icon name="mail" />
                          {email}
                        </p>
                      </MdCard>
                      <MdCard variant="outlined" fullWidth>
                        <form
                          className="form-panel"
                          onSubmit={(e) => {
                            e.preventDefault();
                            void confirmBooking();
                          }}
                        >
                          <h2>Payment</h2>
                          <MdList label="Payment method">
                            <MdListItem
                              leadingIcon="credit_card"
                              headline="Demo card ···· 4242"
                              supportingText="No payment details needed"
                              trailingIcon="check_circle"
                            />
                          </MdList>
                          <p className="icon-text demo-explanation">
                            <Icon name="info" />
                            This saves a simulated booking in this tab. No money is charged
                            and no airline ticket is issued.
                          </p>
                          <MdDivider />
                          <label className="check-label accept-booking">
                            <MdCheckbox
                              name="accepted"
                              required
                              checked={accepted}
                              onMdChange={(e) => setAccepted(e.detail.checked)}
                            />
                            <span>
                              I’ve checked the traveler names, flights, and
                              total price.
                            </span>
                          </label>
                          {error && (
                            <p className="error" role="alert">
                              {error}
                            </p>
                          )}
                          <div className="confirm-total">
                            <span>Total · EUR</span>
                            <strong>{money(quote.total)}</strong>
                          </div>
                          <MdButton
                            type="submit"
                            fullWidth
                            size="md"
                            loading={busy}
                            icon="lock"
                          >
                            Confirm booking
                          </MdButton>
                        </form>
                      </MdCard>
                    </>
                  )}
                </div>
                <Summary search={query} quote={quote} />
              </div>
            </>
          )}
          {['details', 'seats', 'review'].includes(screen) && !quote && (
            <MdCard variant="outlined" fullWidth>
              <div className="empty-state">
                <Icon name="update" />
                <h1>Your flight selection needs updating</h1>
                <p>Please choose your flights again to continue.</p>
                <MdButton onMdClick={() => startSearch(initialSearch())}>
                  Search flights
                </MdButton>
              </div>
            </MdCard>
          )}
          {screen === 'confirmed' && booking && (
            <div className="confirmation">
              <div className="confirmation-heading">
                <Icon
                  name={
                    booking.status === 'cancelled'
                      ? 'event_busy'
                      : 'check_circle'
                  }
                />
                <h1 ref={heading} tabIndex={-1}>
                  {booking.status === 'cancelled'
                    ? 'Booking cancelled'
                    : 'Your booking is confirmed'}
                </h1>
                <p>
                  {booking.status === 'cancelled'
                    ? 'The cancelled itinerary is retained for your records.'
                    : 'Find your demo itinerary in My trips in this tab. It stays in this tab’s browser session.'}
                </p>
              </div>
              <MdCard variant="outlined" fullWidth className="ticket-card">
                <div className="ticket-top">
                  <span className="wordmark">
                    <Icon name="flight" />
                    aero
                  </span>
                  <div>
                    <span className="muted">Booking reference</span>
                    <strong>{booking.reference}</strong>
                  </div>
                </div>
                <MdDivider />
                <div className="ticket-route">
                  <div>
                    <span>{airport(booking.search.from)?.city}</span>
                    <strong>{booking.search.from}</strong>
                  </div>
                  <div>
                    <Icon name="flight_takeoff" />
                    <span>
                      {booking.search.trip === 'roundtrip'
                        ? 'Round trip'
                        : 'One way'}
                    </span>
                  </div>
                  <div>
                    <span>{airport(booking.search.to)?.city}</span>
                    <strong>{booking.search.to}</strong>
                  </div>
                </div>
                <dl className="ticket-facts">
                  <div>
                    <dt>Departure</dt>
                    <dd>{dayLabel(booking.search.depart)}</dd>
                  </div>
                  <div>
                    <dt>
                      {booking.search.trip === 'roundtrip'
                        ? 'Return'
                        : 'Travelers'}
                    </dt>
                    <dd>
                      {booking.search.trip === 'roundtrip'
                        ? dayLabel(booking.search.returnDate)
                        : booking.search.travelers + ' adults'}
                    </dd>
                  </div>
                  <div>
                    <dt>Total · demo payment</dt>
                    <dd>{money(booking.quote.total)}</dd>
                  </div>
                </dl>
                <MdDivider />
                <div className="ticket-details">
                  {booking.quote.legs.map((leg, i) => (
                    <div key={leg.flight.id}>
                      <strong>
                        {i ? 'Return' : 'Outbound'} · {leg.flight.number} ·{' '}
                        {leg.flight.departure}–{leg.flight.arrival}
                      </strong>
                      <p className="muted">
                        {booking.passengers
                          .map(
                            (p, j) =>
                              `${p.firstName} ${p.lastName} (seat ${leg.seats[j] || 'at check-in'})`,
                          )
                          .join(', ')}
                      </p>
                    </div>
                  ))}
                </div>
                <MdDivider />
                <div className="ticket-bottom">
                  <span className="icon-text contact-email">
                    <Icon name="mail" />
                    {booking.email}
                  </span>
                  <span className="icon-text">
                    <Icon
                      name={
                        booking.status === 'cancelled'
                          ? 'event_busy'
                          : 'check_circle'
                      }
                    />
                    {booking.status === 'cancelled' ? 'Cancelled' : 'Confirmed'}
                  </span>
                </div>
              </MdCard>
              <p className="confirmation-note muted">
                Demo itinerary — not valid for travel. No email has been sent.
              </p>
              <div className="confirmation-actions">
                <MdButton
                  variant="outlined"
                  icon="print"
                  onMdClick={() => window.print()}
                >
                  Print itinerary
                </MdButton>
                <MdButton onMdClick={() => navigate('trips')}>
                  View my trips
                </MdButton>
              </div>
            </div>
          )}
        </div>
        <div
          id="trips-panel"
          role="tabpanel"
          aria-labelledby="trips-tab"
          hidden={screen !== 'trips'}
        >
          {screen === 'trips' && (
            <>
              <div className="trips-heading">
                <div>
                  <h1 ref={heading} tabIndex={-1}>
                    My trips
                  </h1>
                  <p className="muted">Saved in this tab only. Your demo bookings stay in this tab’s browser session.</p>
                </div>
                <MdButton
                  variant="outlined"
                  icon="add"
                  onMdClick={() => {
                    startSearch(initialSearch());
                    navigate('search');
                  }}
                >
                  Book a flight
                </MdButton>
              </div>
              {cancelError && !cancelId && (
                <p className="error" role="alert">
                  {cancelError}
                </p>
              )}
              {tripsLoading ? (
                <div className="empty-state">
                  <MdLoadingIndicator label="Loading your trips" />
                  <p>Loading your trips…</p>
                </div>
              ) : tripsError ? (
                <MdCard variant="outlined" fullWidth>
                  <div className="empty-state" role="alert">
                    <Icon name="error" />
                    <h2>{tripsError}</h2>
                    <MdButton onMdClick={() => void loadTrips()}>
                      Try again
                    </MdButton>
                  </div>
                </MdCard>
              ) : trips.length === 0 ? (
                <MdCard variant="outlined" fullWidth>
                  <div className="empty-state">
                    <Icon name="confirmation_number" />
                    <h2>No trips yet</h2>
                    <p>Your confirmed demo bookings will appear here.</p>
                    <MdButton onMdClick={() => navigate('search')}>
                      Find a flight
                    </MdButton>
                  </div>
                </MdCard>
              ) : (
                <MdCard
                  variant="outlined"
                  fullWidth
                  className="saved-trips-card"
                >
                  <MdList label="Saved bookings" interactionMode="multi-action">
                    {trips.map((trip) => (
                      <MdListItem
                        key={trip.id}
                        leadingIcon={
                          trip.status === 'cancelled'
                            ? 'event_busy'
                            : 'flight_takeoff'
                        }
                        overline={`${trip.reference} · ${trip.status === 'cancelled' ? 'Cancelled' : 'Confirmed'}`}
                        headline={`${airport(trip.search.from)?.city} → ${airport(trip.search.to)?.city}`}
                        supportingText={`${dayLabel(trip.search.depart)}${trip.search.trip === 'roundtrip' ? ` — ${dayLabel(trip.search.returnDate)}` : ''} · ${trip.search.travelers} adult${trip.search.travelers === 1 ? '' : 's'} · ${money(trip.quote.total)}`}
                      >
                        <div slot="trailing" className="saved-trip-actions">
                          <MdTooltip text="View itinerary">
                            <MdIconButton
                              icon="confirmation_number"
                              aria-label={`View itinerary ${trip.reference}`}
                              onMdClick={() => {
                                setBooking(trip);
                                setScreen('confirmed');
                              }}
                            />
                          </MdTooltip>
                          {trip.status === 'confirmed' && (
                            <MdTooltip text="Cancel booking">
                              <MdIconButton
                                icon="cancel"
                                disabled={busy}
                                aria-label={`Cancel booking ${trip.reference}`}
                                onMdClick={() => {
                                  setCancelError('');
                                  setCancelId(trip.id);
                                }}
                              />
                            </MdTooltip>
                          )}
                        </div>
                      </MdListItem>
                    ))}
                  </MdList>
                </MdCard>
              )}
            </>
          )}
        </div>
        <footer>
          <span className="wordmark small">
            <Icon name="flight" />
            aero
          </span>
          <p>Simulated flights and payments. No real tickets are issued.</p>
          <span>Made with awc-ui</span>
        </footer>
      </main>
      <MdDialog
        open={cancelId !== null}
        headline="Cancel this booking?"
        scrimDismissible={false}
        onMdClose={() => {
          setCancelId(null);
        }}
      >
        <p>
          Booking {trips.find((t) => t.id === cancelId)?.reference} will be
          marked as cancelled. Its itinerary will stay in My trips.
        </p>
        {cancelError && (
          <p className="error" role="alert">
            {cancelError}
          </p>
        )}
        <MdButton
          slot="actions"
          variant="text"
          onMdClick={() => setCancelId(null)}
        >
          Keep booking
        </MdButton>
        <MdButton
          slot="actions"
          loading={busy}
          onMdClick={() => {
            if (cancelId) void cancelBooking(cancelId);
          }}
        >
          Cancel booking
        </MdButton>
      </MdDialog>
    </div>
  );
}
