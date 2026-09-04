/**
 * What the reader has done, held outside every component.
 *
 * THE FIXTURE IS FROZEN AND STAYS FROZEN. Liking a post, saving it, following
 * someone — all of it is overrides keyed by id on top of the value the fixture
 * shipped. A reload is a reset, which is what keeps the showcase reproducible.
 *
 * MODULE-LEVEL STORES, for the reason the React port hoists a provider above
 * its router: `App` swaps the screen component on every navigation, so state
 * held inside a screen is forgotten the moment you open the post you just
 * liked. A module store outlives every component by construction, and there is
 * exactly one viewer per page load, so there is nothing a context boundary
 * would isolate.
 *
 * ABSENT MEANS "AS SHIPPED": the maps hold only what has actually changed, so
 * there is no second copy of the fixture to keep in step.
 */
import { get, writable } from 'svelte/store';
import type { Person, Post } from '@awc-ui/showcase-kit/social';

const likes = writable<Record<string, boolean>>({});
const saves = writable<Record<string, boolean>>({});
const follows = writable<Record<string, boolean>>({});

/** The fixture's own answer for whether the viewer follows someone. */
const shippedFollowing = (person: Person) =>
  person.relationship === 'following' || person.relationship === 'mutual';

export { likes, saves, follows };

export const isLiked = (map: Record<string, boolean>, post: Post) => map[post.id] ?? post.liked;
export const isSaved = (map: Record<string, boolean>, post: Post) => map[post.id] ?? post.saved;
export const isFollowing = (map: Record<string, boolean>, person: Person) =>
  map[person.id] ?? shippedFollowing(person);

/* The togglers RETURN the new value as well as setting it, so a caller that
   also raises a snackbar can say which thing happened without re-reading a
   store it has not been notified about yet. */
export function toggleLike(post: Post): boolean {
  const next = !isLiked(get(likes), post);
  likes.update((m) => ({ ...m, [post.id]: next }));
  return next;
}

export function toggleSave(post: Post): boolean {
  const next = !isSaved(get(saves), post);
  saves.update((m) => ({ ...m, [post.id]: next }));
  return next;
}

export function setFollowing(person: Person, next: boolean): void {
  follows.update((m) => ({ ...m, [person.id]: next }));
}

export const savedIds = (map: Record<string, boolean>, all: Post[]) =>
  new Set(all.filter((post) => map[post.id] ?? post.saved).map((post) => post.id));
