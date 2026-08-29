/**
 * The two custom elements the planning screen adds to the app's JSX vocabulary.
 *
 * `src/types/custom-elements.d.ts` is the shared list, and five other screens
 * are being written against it right now — so rather than edit it, this file
 * MERGES into the same global `JSX.IntrinsicElements` interface. TypeScript
 * merges declarations of one interface across files as long as a member that
 * appears twice has the same type, and `CE` here expands to exactly the same
 * structural type the shared file uses. If `md-color-picker` or
 * `md-loading-indicator` later land in the shared list, this file becomes
 * redundant and can be deleted without touching a call site.
 *
 * Both tags are in §6 of `main-llm.md` (Selection, and Status & feedback), so
 * both exist; their manuals are
 * `packages/core/src/components/md-color-picker/readme.md` and
 * `packages/core/src/components/md-loading-indicator/readme.md`, and both were
 * read before the markup was written.
 *
 * Props stay loosely typed for the same reason the shared file gives: the
 * readme is the authority for prop names, and a hand-written mirror would rot
 * against it silently.
 */

import type { DetailedHTMLProps, HTMLAttributes } from 'react';

type CE = DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & Record<string, unknown>;

declare global {
  namespace JSX {
    interface IntrinsicElements {
      /** Selection — an arbitrary colour. §5.3. */
      'md-color-picker': CE;
      /** Status & feedback — the brand-consistent indeterminate wait. §5.5. */
      'md-loading-indicator': CE;
    }
  }
}

export {};
