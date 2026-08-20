/**
 * Storybook demo i18n — a message dictionary + a `t(locale, key)` resolver.
 *
 * Deliberately NOT built into the components. `@awc-ui/core` components stay
 * i18n-engine-agnostic: they accept already-resolved text via props/slots. This
 * catalog lives in the DEMO layer and is driven by the Locale toolbar global —
 * exactly how a consuming app would wire its own engine (react-intl, i18next,
 * Lingui, FormatJS): the app owns the strings, resolves them for the active
 * locale, and passes plain text down. Swapping this map for any real engine's
 * output is a drop-in, so the components remain open to whatever engine a
 * consumer already uses.
 *
 * Per-component catalogs live under `./messages/*.ts` (each exports a
 * `messages` map) and are auto-merged here — no central edit needed to add a
 * component's strings. Keys are namespaced per component (e.g. `dialog.title`)
 * except the shared verbs in `messages/common.ts`.
 *
 * Coverage note: this is demo scaffolding, not a production translation set.
 * Non-Latin strings are best-effort (machine-assisted) and should be reviewed
 * by a native speaker before being treated as authoritative.
 */
export type Locale = 'en-US' | 'ar-SA' | 'he-IL' | 'ja-JP' | 'de-DE' | 'fr-FR' | 'zh-CN';

export const LOCALES: Locale[] = ['en-US', 'ar-SA', 'he-IL', 'ja-JP', 'de-DE', 'fr-FR', 'zh-CN'];

/** A single key's per-locale strings. `en-US` is the required fallback. */
export type Entry = Partial<Record<Locale, string>>;

// Auto-merge every per-component catalog. import.meta.glob is a Vite feature;
// `eager` inlines the modules at build so `messages` is ready synchronously.
const modules = import.meta.glob<{ messages: Record<string, Entry> }>('./messages/*.ts', {
  eager: true,
});

export const messages: Record<string, Entry> = {};
for (const mod of Object.values(modules)) {
  if (mod?.messages) Object.assign(messages, mod.messages);
}

/**
 * Resolve a key for the active locale, falling back to en-US, then the key
 * itself. `locale` is the raw Storybook global (e.g. context.globals.locale).
 */
export function t(locale: string | undefined, key: string): string {
  const entry = messages[key];
  if (!entry) return key;
  return entry[locale as Locale] ?? entry['en-US'] ?? key;
}
