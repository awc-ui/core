let fallbackId = 0;

/**
 * Create a DOM relationship id once per component instance. These ids are not
 * security tokens: the counter also supports SSR/test environments without
 * Web Crypto. getRandomValues works on both HTTP and HTTPS pages.
 */
export function createId(prefix: string): string {
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
    const suffix = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
    return `${prefix}-${suffix}`;
  }

  return `${prefix}-fallback-${++fallbackId}`;
}
