export interface SvelteHydration {
  /** Capture SSR host annotations in SvelteKit's client init hook. */
  capture(root?: ParentNode): void;
  /** Restore missing annotations in onMount before registering components. */
  restore(): void;
}
export declare function createSvelteHydration(): SvelteHydration;
/** Create per request. Buffers all HTML chunks until done, then transforms once. */
export declare function createPageTransform(
  transform: (html: string) => string | Promise<string>,
): (chunk: { html: string; done: boolean }) => Promise<string>;
