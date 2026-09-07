const photo = (id, width = 1000) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=85`;
const mediaSources = {
  flower: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
  bunny: 'https://media.w3.org/2010/05/bunny/trailer.mp4',
  sintel: 'https://download.blender.org/durian/trailer/sintel_trailer-480p.mp4',
  steel: 'https://download.blender.org/demo/movies/ToS/tears_of_steel_720p.mov',
};
export const channels = [
  { id: 'north', name: 'North of ordinary', initials: 'NO', subscribers: '284K', bio: 'Small stories from the great outdoors.' },
  { id: 'studio', name: 'Studio practice', initials: 'SP', subscribers: '128K', bio: 'Design, spaces, and the things we make.' },
  { id: 'everyday', name: 'Everyday objects', initials: 'EO', subscribers: '592K', bio: 'A closer look at the technology around us.' },
  { id: 'slow', name: 'The slow hours', initials: 'SH', subscribers: '76K', bio: 'Music and moments to settle into.' },
  { id: 'open', name: 'Open cinema', initials: 'OC', subscribers: '1.2M', bio: 'Independent stories. Open possibilities.' },
  { id: 'table', name: 'At the table', initials: 'AT', subscribers: '93K', bio: 'Good food and even better company.' },
];
// Editorial fixtures are fictional. Playback sources are explicitly credited demo films.
export const videos = [
  { id: 'v1', title: 'Somewhere with no signal. A week in the wild.', channel: 'north', category: 'Nature', views: 284000, age: '2 days ago', duration: '12:14', image: photo('photo-1464822759023-fed622ff2c3b'), source: 'flower', footage: 'Flower · MDN (CC0)', description: 'Early starts, winding trails, and the kind of quiet you can’t find in a city. A visual journal for your next daydream.' },
  { id: 'v2', title: 'A desk setup that makes room for thinking', channel: 'studio', category: 'Design', views: 128000, age: '1 day ago', duration: '14:32', image: photo('photo-1497215728101-856f4ea42174'), source: 'flower', footage: 'Flower · MDN (CC0)', description: 'Less clutter, more intention. Exploring the small decisions that make a workspace feel like yours.' },
  { id: 'v3', title: 'The camera I keep coming back to', channel: 'everyday', category: 'Technology', views: 416000, age: '3 days ago', duration: '10:08', image: photo('photo-1516035069371-29a1b244cc32'), source: 'flower', footage: 'Flower · MDN (CC0)', description: 'Not a spec sheet. Just a look at the tools that help us pay a little more attention to the world.' },
  { id: 'v4', title: 'A little jazz, a little rain. Sunday sessions.', channel: 'slow', category: 'Music', views: 892000, age: '5 days ago', duration: '42:18', image: photo('photo-1511192336575-5a79af67a629'), source: 'flower', footage: 'Flower · MDN (CC0)', description: 'Settle in for an unhurried afternoon. A collection of sounds for the in-between moments.' },
  { id: 'v5', title: 'Tokyo after dark, through a different lens', channel: 'north', category: 'Cinematic', views: 673000, age: '1 week ago', duration: '8:46', image: photo('photo-1519608487953-e999c86e7455'), source: 'steel', footage: 'Tears of Steel · Blender Foundation', description: 'Neon side streets and last trains. Finding little stories in a city that never quite stands still.' },
  { id: 'v6', title: 'Why great design feels so simple', channel: 'studio', category: 'Design', views: 92000, age: '4 days ago', duration: '18:24', image: photo('photo-1600210492486-724fe5c67fb0'), source: 'flower', footage: 'Flower · MDN (CC0)', description: 'A conversation about restraint, everyday rituals, and the spaces that quietly shape our lives.' },
  { id: 'v7', title: 'One pan. A very good evening.', channel: 'table', category: 'Cooking', views: 218000, age: '2 days ago', duration: '9:52', image: photo('photo-1556909114-f6e7ad7d3136'), source: 'flower', footage: 'Flower · MDN (CC0)', description: 'Simple ingredients, a little patience, and a dinner worth sitting down for.' },
  { id: 'v8', title: 'Big Buck Bunny — the official trailer', channel: 'open', category: 'Animation', views: 2400000, age: '2 weeks ago', duration: '0:33', image: photo('photo-1441974231531-c6227db76b6e'), source: 'bunny', footage: 'Big Buck Bunny · Blender Foundation', description: 'A gentle giant meets three tiny troublemakers. The trailer for the beloved open animated short from the Blender Foundation.' },
  { id: 'v9', title: 'Sintel — the official trailer', channel: 'open', category: 'Animation', views: 1800000, age: '3 weeks ago', duration: '0:52', image: photo('photo-1472396961693-142e6e269027'), source: 'sintel', footage: 'Sintel · Blender Foundation', description: 'The trailer for an independent fantasy short following a young woman and her unlikely friendship with a dragon.' },
  { id: 'v10', title: 'Building a slower morning, one day at a time', channel: 'slow', category: 'Lifestyle', views: 157000, age: '6 days ago', duration: '11:36', image: photo('photo-1442512595331-e89e73853f31'), source: 'flower', footage: 'Flower · MDN (CC0)', description: 'Coffee before screens. Some small rituals for a little more space in the day.' },
  { id: 'v11', title: 'The little things that make a keyboard great', channel: 'everyday', category: 'Technology', views: 349000, age: '1 week ago', duration: '16:02', image: photo('photo-1587829741301-dc798b83add3'), source: 'flower', footage: 'Flower · MDN (CC0)', description: 'Sound, feel, and the details you notice a thousand times a day.' },
  { id: 'v12', title: 'Tears of Steel — an open sci-fi short', channel: 'open', category: 'Cinematic', views: 1200000, age: '1 month ago', duration: '12:14', image: photo('photo-1519608487953-e999c86e7455'), source: 'steel', footage: 'Tears of Steel · Blender Foundation', description: 'A group of warriors and scientists gather in Amsterdam to stage a crucial event from the past.' },
];
export const categories = ['All', 'Music', 'Design', 'Technology', 'Cinematic', 'Nature', 'Animation', 'Cooking', 'Lifestyle'];
export const destinations = [
  ['home', 'home', 'Home'], ['explore', 'explore', 'Explore'], ['subscriptions', 'subscriptions', 'Subscriptions'],
  ['library', 'video_library', 'Your library'], ['history', 'history', 'History'], ['saved', 'schedule', 'Watch later'], ['liked', 'thumb_up', 'Liked videos'],
];
export const sampleComments = [
  { name: 'Alex Morgan', initials: 'AM', text: 'This is exactly the kind of thing I wanted to find today. Beautifully put together.', age: '1 day ago' },
  { name: 'Jamie Chen', initials: 'JC', text: 'The attention to the little details makes all the difference. More of this, please.', age: '2 days ago' },
];
export function sourceUrl(video) { return video.local ? '' : mediaSources[video.source]; }
