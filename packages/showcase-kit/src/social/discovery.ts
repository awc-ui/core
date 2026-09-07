import type { FeedItem } from './derive';
import { formatNumber } from '../i18n/format';

export type DiscoveryFilter = 'all' | 'saved' | 'carousel';

const COPY = {
  en: {
    eyebrow: 'YOUR CREATIVE CIRCLE',
    title: 'Small moments. Endless inspiration.',
    description:
      'Fresh perspectives from the people you follow. Find a familiar face, rediscover a saved moment, or get lost in a new story.',
    search: 'Search people and captions',
    all: 'For you',
    second: 'Saved',
    third: 'Carousels',
    results: 'moments',
    clear: 'Reset feed',
    empty: 'No moments found',
    hint: 'Try another name or caption, or reset your filters.',
    stat: 'perspectives in your circle',
  },
  ro: {
    eyebrow: 'CERCUL TĂU CREATIV',
    title: 'Momente mici. Inspirație fără limite.',
    description:
      'Perspective noi de la oamenii pe care îi urmărești. Găsește o față cunoscută, redescoperă un moment salvat sau explorează o poveste nouă.',
    search: 'Caută persoane și descrieri',
    all: 'Pentru tine',
    second: 'Salvate',
    third: 'Carusele',
    results: 'momente',
    clear: 'Resetează fluxul',
    empty: 'Niciun moment găsit',
    hint: 'Încearcă alt nume sau altă descriere, ori resetează filtrele.',
    stat: 'perspective în cercul tău',
  },
  ar: {
    eyebrow: 'دائرتك الإبداعية',
    title: 'لحظات صغيرة. إلهام بلا حدود.',
    description:
      'وجهات نظر جديدة من الأشخاص الذين تتابعهم. ابحث عن وجه مألوف، أو أعد اكتشاف لحظة محفوظة، أو استكشف قصة جديدة.',
    search: 'ابحث عن أشخاص وأوصاف',
    all: 'من أجلك',
    second: 'المحفوظات',
    third: 'ألبومات',
    results: 'لحظات',
    clear: 'إعادة ضبط الخلاصة',
    empty: 'لم يتم العثور على لحظات',
    hint: 'جرّب اسمًا أو وصفًا آخر، أو أعد ضبط عوامل التصفية.',
    stat: 'وجهات نظر في دائرتك',
  },
} as const;

/** Localized discovery copy is shared by every native view. */
export function discoveryCopy(locale: string) {
  const language = locale.split('-')[0] as keyof typeof COPY;
  return COPY[language] ?? COPY.en;
}

const countRules = new Map<string, Intl.PluralRules>();

/** A complete result label, including Arabic dual forms and Romanian "de". */
export function discoveryCount(count: number, locale: string): string {
  const requested = locale.split('-')[0];
  const language = requested === 'ar' || requested === 'ro' ? requested : 'en';
  let rules = countRules.get(language);
  if (!rules) {
    rules = new Intl.PluralRules(language);
    countRules.set(language, rules);
  }
  const plural = rules.select(count);
  const number = formatNumber(count, language);
  if (language === 'ar') {
    if (plural === 'zero') return 'لا توجد لحظات';
    if (plural === 'one') return 'لحظة واحدة';
    if (plural === 'two') return 'لحظتان';
    return `${number} ${plural === 'few' ? 'لحظات' : 'لحظة'}`;
  }
  if (language === 'ro') {
    if (plural === 'one') return `${number} moment`;
    return `${number} ${plural === 'other' ? 'de ' : ''}momente`;
  }
  return `${number} ${plural === 'one' ? 'moment' : 'moments'}`;
}

/** Accent- and Arabic-diacritic-insensitive matching, shared with HTML enhancement. */
export function normalizeDiscoveryQuery(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ـ/g, '')
    .toLocaleLowerCase()
    .trim();
}

export function discoverySearchText(item: FeedItem, translate: (key: string) => string): string {
  return [item.author.displayName, item.author.handle, translate(item.post.captionKey)].join(' ');
}

export function matchesDiscovery(
  text: string,
  query: string,
  filter: DiscoveryFilter,
  category: string,
  saved = false,
): boolean {
  const categoryMatches = filter === 'all' || (filter === 'saved' ? saved : category === filter);
  const words = normalizeDiscoveryQuery(query).split(/\s+/).filter(Boolean);
  const haystack = normalizeDiscoveryQuery(text);
  return categoryMatches && words.every((word) => haystack.includes(word));
}

export function discoverFeed(
  items: FeedItem[],
  query: string,
  filter: DiscoveryFilter,
  translate: (key: string) => string,
  isSaved: (item: FeedItem) => boolean = (item) => item.post.saved,
): FeedItem[] {
  return items.filter((item) =>
    matchesDiscovery(
      discoverySearchText(item, translate),
      query,
      filter,
      item.post.kind,
      isSaved(item),
    ),
  );
}
