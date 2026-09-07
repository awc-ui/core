import { albumById, getTracks, topTracks } from './selectors';
import type { Album, Track } from './types';
import type { Transport } from './derive';

export const SESSION_MODES = ['for-you', 'focus', 'energy'] as const;
export type SessionMode = (typeof SESSION_MODES)[number];

const copy = {
  en: {
    eyebrow: 'YOUR LISTENING ROOM',
    title: 'Find your next flow.',
    description:
      'A new session for every state of mind. Pick a mix, shape the queue, and make it yours.',
    modes: ['For you', 'Deep focus', 'Fresh energy'],
    names: ['Your daily rotation', 'Room to think', 'A change of pace'],
    notes: [
      'The tracks you keep coming back to.',
      'Longer tracks for uninterrupted creative time.',
      'A shorter, faster-moving selection to reset your day.',
    ],
    choose: 'Choose a listening session',
    play: 'Start session',
    pause: 'Pause session',
    resume: 'Resume session',
    queue: 'Session queue',
    tracks: 'tracks',
    duration: 'total time',
    now: 'Now playing',
    remove: 'Remove from queue',
    demo: 'Interactive playback demo · silent tracks',
  },
  ro: {
    eyebrow: 'SPAȚIUL TĂU MUZICAL',
    title: 'Găsește-ți următorul ritm.',
    description:
      'O sesiune nouă pentru fiecare stare. Alege un mix, organizează coada și fă-l al tău.',
    modes: ['Pentru tine', 'Concentrare', 'Energie nouă'],
    names: ['Selecția ta zilnică', 'Spațiu pentru idei', 'Schimbare de ritm'],
    notes: [
      'Piesele la care revii mereu.',
      'Piese mai lungi pentru momente creative fără întreruperi.',
      'O selecție mai scurtă și mai dinamică pentru o nouă perspectivă.',
    ],
    choose: 'Alege o sesiune de ascultare',
    play: 'Pornește sesiunea',
    pause: 'Pauză',
    resume: 'Continuă sesiunea',
    queue: 'Coada sesiunii',
    tracks: 'piese',
    duration: 'durată totală',
    now: 'În redare',
    remove: 'Elimină din coadă',
    demo: 'Demo de redare interactivă · piese fără sunet',
  },
  ar: {
    eyebrow: 'مساحتك الموسيقية',
    title: 'اكتشف إيقاعك التالي.',
    description: 'جلسة جديدة لكل مزاج. اختر مزيجًا ورتّب قائمة التشغيل واجعله خاصًا بك.',
    modes: ['من أجلك', 'تركيز عميق', 'طاقة متجددة'],
    names: ['اختياراتك اليومية', 'مساحة للتفكير', 'إيقاع مختلف'],
    notes: [
      'المقطوعات التي تعود إليها دائمًا.',
      'مقطوعات أطول لإبداع متواصل دون انقطاع.',
      'اختيارات أقصر وأكثر تنوعًا لتجديد يومك.',
    ],
    choose: 'اختر جلسة استماع',
    play: 'ابدأ الجلسة',
    pause: 'إيقاف الجلسة مؤقتًا',
    resume: 'متابعة الجلسة',
    queue: 'قائمة الجلسة',
    tracks: 'مقطوعات',
    duration: 'المدة الإجمالية',
    now: 'قيد التشغيل',
    remove: 'إزالة من القائمة',
    demo: 'عرض تشغيل تفاعلي · مقطوعات بلا صوت',
  },
} as const;

export const sessionCopy = (locale: string) =>
  copy[locale === 'ar' ? 'ar' : locale === 'ro' ? 'ro' : 'en'];

/** Every port receives the same curation, artwork and ordering. */
export function listeningSession(mode: SessionMode) {
  const tracks =
    mode === 'for-you'
      ? topTracks(6)
      : [...getTracks()]
          .sort(
            (a, b) =>
              (mode === 'focus' ? b.durationSec - a.durationSec : a.durationSec - b.durationSec) ||
              a.id.localeCompare(b.id),
          )
          .slice(0, 6);
  const albums = [...new Set(tracks.map((track) => track.albumId))]
    .map((id) => albumById(id))
    .filter((album): album is Album => album !== null)
    .slice(0, 3);
  return {
    mode,
    tracks,
    albums,
    duration: tracks.reduce((sum, track) => sum + track.durationSec, 0),
  };
}

/** Replace only the listening queue. Volume, mute and repeat remain the listener's choices. */
export function startSession(transport: Transport, tracks: readonly Track[]): Transport {
  const queue = [...new Set(tracks.map((track) => track.id))];
  if (queue.length === 0) return transport;
  return { ...transport, queue, trackId: queue[0]!, positionSec: 0, state: 'playing' };
}

/** Removing an upcoming track must never interrupt the loaded track. */
export function removeQueuedTrack(transport: Transport, id: string): Transport {
  if (transport.trackId === id || !transport.queue.includes(id)) return transport;
  return { ...transport, queue: transport.queue.filter((trackId) => trackId !== id) };
}
