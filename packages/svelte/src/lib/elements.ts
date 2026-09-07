import type { JSX as AwcJSX } from '@awc-ui/core';
import type { HTMLAttributes } from 'svelte/elements';

/** AWC event payloads, property types and their default HTML attribute spellings. */
type KebabCase<S extends string> = S extends `${infer First}${infer Rest}`
  ? `${First extends Lowercase<First> ? First : `-${Lowercase<First>}`}${KebabCase<Rest>}`
  : S;

type ComponentAttributes<Props> = Omit<HTMLAttributes<HTMLElement>, keyof Props>
  & { [Key in keyof Props as Key extends `on${string}` ? never : Key]: Props[Key] }
  & { [Key in keyof Props as Key extends string ? Key extends `on${string}` ? never : KebabCase<Key> : never]: Props[Key] }
  & { [Key in keyof Props as Key extends `on${infer Event}` ? `on:${Uncapitalize<Event>}` | `on${Uncapitalize<Event>}` : never]: Props[Key] };

export type AwcElementAttributes = {
  [Tag in keyof AwcJSX.IntrinsicElements]: ComponentAttributes<AwcJSX.IntrinsicElements[Tag]>;
};

// Current Svelte 4 and 5 tooling reads svelte/elements; older Svelte 4 tooling
// reads the global namespace. Both derive from the same core declarations.
declare module 'svelte/elements' {
  interface SvelteHTMLElements extends AwcElementAttributes {}
}

declare global {
  namespace svelteHTML {
    interface IntrinsicElements extends AwcElementAttributes {}
  }
}
