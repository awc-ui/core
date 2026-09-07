/**
 * What a screen shows while it settles after a navigation.
 *
 * MEASURED, NOT DECORATIVE. Each skeleton is built to the height of the thing
 * it stands in for, because a placeholder that is the wrong height moves the
 * page when the real content lands — and the parity check compares document
 * heights, so a mismatch is also a difference between builds.
 *
 * The panels carry a BORDER rather than an outline: an outline takes no layout
 * space, so a bordered skeleton and an outlined card are one pixel different on
 * every edge. That difference is invisible until it is summed over eight rows.
 */

import type { ReactNode } from 'react';

/** How long a screen holds its skeleton. Long enough to see, short enough not to annoy. */
export const SKELETON_MS = 240;

function Bars({ rows, height = 16 }: { rows: number; height?: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, i) => (
        <md-skeleton key={i} variant="text" style-height={String(height)} />
      ))}
    </>
  );
}

function SkeletonPanel({ children }: { children: ReactNode }) {
  return <div className="skel-panel">{children}</div>;
}

/** The default: a tile grid, which is what three of the four destinations open with. */
export function ScreenSkeleton() {
  return (
    <div className="stack">
      <SkeletonPanel>
        <Bars rows={1} height={24} />
        <div className="grid grid--tiles">
          {Array.from({ length: 6 }, (_, i) => (
            <md-skeleton key={i} variant="rect" />
          ))}
        </div>
      </SkeletonPanel>
    </div>
  );
}

/**
 * The editor's own placeholder, and it is a different shape from every other
 * screen: three columns, not a grid of tiles. Reusing `ScreenSkeleton` here
 * would make the layout jump from one column to three the moment it resolved.
 */
export function EditorSkeleton() {
  return (
    <div className="editor">
      <div className="editor__toolbar skel-panel">
        <Bars rows={1} height={32} />
      </div>
      <div className="editor__tree skel-panel">
        <Bars rows={8} />
      </div>
      <div className="editor__canvas skel-panel">
        <md-skeleton variant="rect" />
      </div>
      <div className="editor__inspector skel-panel">
        <Bars rows={6} />
      </div>
    </div>
  );
}
