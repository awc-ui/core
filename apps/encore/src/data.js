export const categories = [
  ['All shows', 'apps'], ['Music', 'music_note'], ['Theatre', 'theater_comedy'],
  ['Comedy', 'mic'], ['Dance', 'nightlife'], ['Experiences', 'auto_awesome'],
].map(([label, icon]) => ({ label, icon }));
const photo = (id, width = 1000) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=85`;
const show = (id, title, category, city, venue, date, price, image, description, extra = {}) => ({
  id, title, category, city, venue, price, image: photo(image), description,
  age: '16+', duration: 120, access: 'Step-free entrance and accessible toilets. Contact the venue team on arrival for assistance.',
  sessions: [{ id: `${id}-a`, start: `${date}T18:30:00Z`, label: 'Evening show' }],
  tiers: [
    { id: 'standard', name: 'General admission', description: 'Be part of the crowd. Unreserved standing.', price, capacity: 80 },
    { id: 'balcony', name: 'Balcony', description: 'A little more space. Unreserved balcony seating.', price: price + 1800, capacity: 30 },
    { id: 'premium', name: 'Premium experience', description: 'Priority entry, a welcome drink, and the best view.', price: price + 4500, capacity: 12 },
  ], ...extra,
});

export const events = [
  show('neon-nights', 'Neon Nights', 'Music', 'London', 'The Glasshouse', '2026-10-16', 4500,
    'photo-1470229722913-7c0e2dbbafd3',
    'An electric night of synth-pop, big feelings, and a dance floor that never stands still. Join Nova & The Satellites for their most ambitious live show yet.',
    { kicker: 'NOVA & THE SATELLITES · LIVE', tag: 'Our pick', artist: 'Nova & The Satellites',
      sessions: [{ id: 'neon-nights-a', start: '2026-10-16T18:30:00Z', label: 'Friday evening' }, { id: 'neon-nights-b', start: '2026-10-17T18:30:00Z', label: 'Saturday evening' }] }),
  show('midnight-jazz', 'Midnight, with a little jazz', 'Music', 'London', 'The Blue Room', '2026-10-03', 2800,
    'photo-1511192336575-5a79af67a629',
    'Settle into a candlelit room for warm brass, new improvisations, and a quartet that makes every note feel personal.',
    { tag: 'Intimate nights', artist: 'The Milo Reed Quartet', age: '18+', duration: 100 }),
  show('the-last-letter', 'The Last Letter', 'Theatre', 'London', 'Riverside Theatre', '2026-10-08', 3800,
    'photo-1503095396549-807759245b35',
    'One letter. Two strangers. A city full of second chances. A beautifully staged new play about the people we almost meet.',
    { tag: 'New production', artist: 'Riverside Company', tiers: [
      { id: 'standard', name: 'Upper circle', description: 'Unreserved seating with a full view of the stage.', price: 3800, capacity: 60 },
      { id: 'balcony', name: 'Dress circle', description: 'Unreserved seating close to the action.', price: 5600, capacity: 24 },
      { id: 'premium', name: 'Stalls', description: 'Unreserved premium seating on the ground floor.', price: 7200, capacity: 10 },
    ] }),
  show('laugh-out-loud', 'A very unserious evening', 'Comedy', 'Manchester', 'The Little Electric', '2026-10-10', 2200,
    'photo-1516280440614-37939bbacd81',
    'Four sharp minds, one microphone, and absolutely no sensible conclusions. A fresh line-up of stand-up voices for your Saturday night.',
    { tag: 'Under £30', artist: 'The Unfiltered Comedy Club', age: '18+', duration: 90 }),
  show('after-hours', 'After Hours: warehouse sessions', 'Dance', 'London', 'Studio 04', '2026-10-24', 3200,
    'photo-1506157786151-b8491531f063',
    'Deep house meets an immersive light installation. Lose track of time with three selectors, a room full of friends, and a very good sound system.',
    { tag: 'Late-night plans', artist: 'Aya / Sol / Late Company', age: '18+', duration: 240 }),
  show('wild-horizons', 'Wild Horizons', 'Music', 'Bristol', 'Harbour Hall', '2026-10-18', 4800,
    'photo-1501386761578-eac5c94b800a',
    'Big guitars and bigger choruses. Indie favourites Wild Horizons bring a new record and the songs you already know by heart.',
    { tag: 'Selling fast', artist: 'Wild Horizons', tiers: [
      { id: 'standard', name: 'General admission', description: 'Unreserved standing on the main floor.', price: 4800, capacity: 8 },
      { id: 'balcony', name: 'Balcony', description: 'Unreserved balcony seating.', price: 6200, capacity: 4 },
      { id: 'premium', name: 'Premium experience', description: 'Priority entry and a welcome drink.', price: 8900, capacity: 2 },
    ] }),
  show('moving-stories', 'Moving Stories', 'Dance', 'Edinburgh', 'The Assembly Stage', '2026-11-06', 3400,
    'photo-1508700115892-45ecd05ae2ad',
    'An inventive contemporary dance programme exploring connection, distance, and the ways we find each other again.',
    { tag: 'Something different', artist: 'Motion Collective', age: 'All ages', duration: 85 }),
  show('candlelight-strings', 'Strings by candlelight', 'Experiences', 'London', 'The Old Observatory', '2026-11-12', 4200,
    'photo-1465847899084-d164df4dedc6',
    'A string ensemble reimagines your favourite film scores beneath a canopy of warm lights. An evening to slow down and listen.',
    { tag: 'Date-night favourite', artist: 'The Aurora Ensemble', age: '8+', duration: 75 }),
  show('summer-echoes', 'Summer Echoes: the final night', 'Music', 'Manchester', 'Union Yard', '2026-10-02', 6500,
    'photo-1492684223066-81342ee5ff30',
    'The closing night of the Summer Echoes tour. This sample performance is sold out; explore another show to try booking.',
    { tag: 'Sold out', artist: 'Summer Echoes', tiers: [
      { id: 'standard', name: 'General admission', description: 'Unreserved standing.', price: 6500, capacity: 0 },
      { id: 'balcony', name: 'Balcony', description: 'Unreserved balcony seating.', price: 8200, capacity: 0 },
    ] }),
];

export const cities = ['All cities', 'London', 'Manchester', 'Bristol', 'Edinburgh'];
export const eventById = id => events.find(event => event.id === id);
export const sessionById = (event, id) => event?.sessions.find(session => session.id === id);
