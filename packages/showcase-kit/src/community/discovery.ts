import type { FeedItem } from './derive';
import { formatNumber } from '../i18n/format';

export type DiscoveryFilter = 'all' | 'friends' | 'groups';

const COPY = {
  en: {
    eyebrow: 'GOOD THINGS HAPPEN TOGETHER',
    title: 'Your people. Your place.',
    description:
      'Catch up with friends, find the conversations that matter, and make room for your next shared adventure.',
    search: 'Search people, groups and conversations',
    all: 'Everything',
    second: 'Friends',
    third: 'Groups',
    results: 'conversations',
    clear: 'Reset feed',
    empty: 'No conversations found',
    hint: 'Try another person, group or phrase, or reset your filters.',
    stat: 'conversations from your community',
  },
  ro: {
    eyebrow: 'LUCRURILE BUNE SE ÎNTÂMPLĂ ÎMPREUNĂ',
    title: 'Oamenii tăi. Locul tău.',
    description:
      'Află noutățile prietenilor, găsește conversațiile care contează și fă loc următoarei aventuri împreună.',
    search: 'Caută persoane, grupuri și conversații',
    all: 'Totul',
    second: 'Prieteni',
    third: 'Grupuri',
    results: 'conversații',
    clear: 'Resetează fluxul',
    empty: 'Nicio conversație găsită',
    hint: 'Încearcă altă persoană, alt grup sau altă expresie, ori resetează filtrele.',
    stat: 'conversații din comunitatea ta',
  },
  ar: {
    eyebrow: 'معًا نصنع لحظات أجمل',
    title: 'أشخاصك. مساحتك.',
    description: 'تواصل مع الأصدقاء، واعثر على الحوارات التي تهمك، واستعد لمغامرتكم القادمة معًا.',
    search: 'ابحث عن أشخاص ومجموعات ومحادثات',
    all: 'الكل',
    second: 'الأصدقاء',
    third: 'المجموعات',
    results: 'محادثات',
    clear: 'إعادة ضبط الخلاصة',
    empty: 'لم يتم العثور على محادثات',
    hint: 'جرّب شخصًا أو مجموعة أو عبارة أخرى، أو أعد ضبط عوامل التصفية.',
    stat: 'محادثات من مجتمعك',
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
    if (plural === 'zero') return 'لا توجد محادثات';
    if (plural === 'one') return 'محادثة واحدة';
    if (plural === 'two') return 'محادثتان';
    return `${number} ${plural === 'few' ? 'محادثات' : 'محادثة'}`;
  }
  if (language === 'ro') {
    if (plural === 'one') return `${number} conversație`;
    return `${number} ${plural === 'other' ? 'de ' : ''}conversații`;
  }
  return `${number} ${plural === 'one' ? 'conversation' : 'conversations'}`;
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
  return [
    item.author.displayName,
    item.author.handle,
    item.group?.name ?? '',
    translate(item.post.bodyKey),
  ].join(' ');
}

export function matchesDiscovery(
  text: string,
  query: string,
  filter: DiscoveryFilter,
  category: string,
): boolean {
  const categoryMatches = filter === 'all' || category === filter;
  const words = normalizeDiscoveryQuery(query).split(/\s+/).filter(Boolean);
  const haystack = normalizeDiscoveryQuery(text);
  return categoryMatches && words.every((word) => haystack.includes(word));
}

export function discoverFeed(
  items: FeedItem[],
  query: string,
  filter: DiscoveryFilter,
  translate: (key: string) => string,
): FeedItem[] {
  return items.filter((item) =>
    matchesDiscovery(
      discoverySearchText(item, translate),
      query,
      filter,
      item.group ? 'groups' : 'friends',
    ),
  );
}
