/**
 * What the reader has done, held above the router.
 *
 * THE FIXTURE IS FROZEN AND STAYS FROZEN. Liking a post, saving it, following
 * someone — all of it is overrides in this provider, keyed by id, on top of the
 * value the fixture shipped. A reload is a reset, which is what keeps the
 * showcase reproducible and every screenshot comparable.
 *
 * WHY IT LIVES ABOVE THE ROUTER rather than in a screen. `App` returns a
 * different component per route, so React unmounts the whole subtree on every
 * navigation — a like held in `FeedScreen` would be forgotten the moment you
 * opened the post you just liked, which is precisely the interaction a reader
 * tries first. `main.tsx` mounts this beside `ShellProvider` for the same
 * reason the rail's expansion lives there.
 *
 * ABSENT MEANS "AS SHIPPED". The maps hold only what has actually been changed,
 * so there is no second copy of the fixture to keep in step, and
 * `engagement()` in the kit does the arithmetic of turning an override plus a
 * shipped count into the number on screen.
 */

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { Person, Post } from '@awc-ui/showcase-kit/social';

interface EngagementState {
  /** `true` when the reader has this post liked, whatever the fixture said. */
  isLiked(post: Post): boolean;
  isSaved(post: Post): boolean;
  /** `true` when the reader follows this person, whatever the fixture said. */
  isFollowing(person: Person): boolean;
  toggleLike(post: Post): boolean;
  toggleSave(post: Post): boolean;
  setFollowing(person: Person, next: boolean): void;
  /** Ids of every post the reader has saved, fixture and overrides combined. */
  savedIds(all: Post[]): Set<string>;
}

const noop = () => false;

const EngagementContext = createContext<EngagementState>({
  isLiked: (post) => post.liked,
  isSaved: (post) => post.saved,
  isFollowing: (person) => person.relationship === 'following' || person.relationship === 'mutual',
  toggleLike: noop,
  toggleSave: noop,
  setFollowing: () => {},
  savedIds: (all) => new Set(all.filter((p) => p.saved).map((p) => p.id)),
});

/** The fixture's own answer for whether the viewer follows someone. */
function shippedFollowing(person: Person): boolean {
  return person.relationship === 'following' || person.relationship === 'mutual';
}

export function EngagementProvider({ children }: { children: ReactNode }) {
  const [likes, setLikes] = useState<Record<string, boolean>>({});
  const [saves, setSaves] = useState<Record<string, boolean>>({});
  const [follows, setFollows] = useState<Record<string, boolean>>({});

  const isLiked = useCallback((post: Post) => likes[post.id] ?? post.liked, [likes]);
  const isSaved = useCallback((post: Post) => saves[post.id] ?? post.saved, [saves]);
  const isFollowing = useCallback(
    (person: Person) => follows[person.id] ?? shippedFollowing(person),
    [follows],
  );

  /*
   * The togglers RETURN the new value rather than only setting it, so a caller
   * that also raises a snackbar can say which thing happened without reading
   * state it has not been re-rendered with yet.
   */
  const toggleLike = useCallback(
    (post: Post) => {
      const next = !(likes[post.id] ?? post.liked);
      setLikes((prev) => ({ ...prev, [post.id]: next }));
      return next;
    },
    [likes],
  );

  const toggleSave = useCallback(
    (post: Post) => {
      const next = !(saves[post.id] ?? post.saved);
      setSaves((prev) => ({ ...prev, [post.id]: next }));
      return next;
    },
    [saves],
  );

  const setFollowing = useCallback((person: Person, next: boolean) => {
    setFollows((prev) => ({ ...prev, [person.id]: next }));
  }, []);

  const savedIds = useCallback(
    (all: Post[]) => new Set(all.filter((post) => saves[post.id] ?? post.saved).map((post) => post.id)),
    [saves],
  );

  const value = useMemo<EngagementState>(
    () => ({ isLiked, isSaved, isFollowing, toggleLike, toggleSave, setFollowing, savedIds }),
    [isLiked, isSaved, isFollowing, toggleLike, toggleSave, setFollowing, savedIds],
  );

  return <EngagementContext.Provider value={value}>{children}</EngagementContext.Provider>;
}

export function useEngagement(): EngagementState {
  return useContext(EngagementContext);
}
