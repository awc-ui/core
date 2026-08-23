/**
 * Shapes shared between a screen and the frame it sits in.
 *
 * A Svelte instance script cannot export a type, so anything two components
 * need to agree on lives here rather than in whichever `.svelte` file happened
 * to declare it first.
 */

export interface Crumb {
  label: string;
  /** Root-relative path WITHOUT the base path. Omit on the final crumb. */
  href?: string;
}
