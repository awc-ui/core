/**
 * What the reader has done, held outside every component.
 *
 * THE FIXTURE IS FROZEN AND STAYS FROZEN. Reacting to a post, answering a
 * friend request, joining a group, RSVPing to an event — all of it is overrides
 * keyed by id on top of the value the fixture shipped. A reload is a reset,
 * which is what keeps the showcase reproducible.
 *
 * MODULE-LEVEL STORES, for the reason the React port hoists a provider above
 * its router: `App` swaps the screen component on every navigation, so state
 * held inside a screen is forgotten the moment you open the post you just
 * reacted to. A module store outlives every component by construction, and
 * there is exactly one viewer per page load, so there is nothing a context
 * boundary would isolate.
 *
 * ABSENT MEANS "AS SHIPPED": the maps hold only what has actually changed, so
 * there is no second copy of the fixture to keep in step, and
 * `reactionSummary()` in the kit does the arithmetic of turning an override
 * plus a shipped count into the numbers on screen.
 *
 * FIVE STORES AND NOT ONE, because the five things are keyed differently and
 * mean different things: a reaction is per post AND per comment, a friendship
 * is per person, a role is per group, an RSVP is per event.
 */
import { writable } from 'svelte/store';
import type {
  Comment,
  CommunityEvent,
  Friendship,
  Group,
  GroupRole,
  Person,
  Post,
  ReactionKind,
  Rsvp,
} from '@awc-ui/showcase-kit/community';

export const reactions = writable<Record<string, ReactionKind | null>>({});
export const commentReactions = writable<Record<string, ReactionKind | null>>({});
export const friendships = writable<Record<string, Friendship>>({});
export const roles = writable<Record<string, GroupRole>>({});
export const rsvps = writable<Record<string, Rsvp>>({});

/*
 * `in` AND NOT `??`, for the two reaction maps.
 *
 * `null` is a legitimate override here — it is what "I took my reaction back"
 * means — and `?? post.viewerReaction` would treat it as absent and fall
 * straight back to the fixture's value, so un-reacting would silently do
 * nothing. The other three have no null member and can use `??`.
 */
export const reactionFor = (
  map: Record<string, ReactionKind | null>,
  post: Post,
): ReactionKind | null => (post.id in map ? map[post.id] : post.viewerReaction);

export const commentReactionFor = (
  map: Record<string, ReactionKind | null>,
  comment: Comment,
): ReactionKind | null => (comment.id in map ? map[comment.id] : comment.viewerReaction);

export const friendshipFor = (map: Record<string, Friendship>, person: Person): Friendship =>
  map[person.id] ?? person.friendship;

export const roleFor = (map: Record<string, GroupRole>, group: Group): GroupRole =>
  map[group.id] ?? group.role;

export const rsvpFor = (map: Record<string, Rsvp>, event: CommunityEvent): Rsvp =>
  map[event.id] ?? event.rsvp;

export function setReaction(post: Post, next: ReactionKind | null) {
  reactions.update((m) => ({ ...m, [post.id]: next }));
}
export function setCommentReaction(comment: Comment, next: ReactionKind | null) {
  commentReactions.update((m) => ({ ...m, [comment.id]: next }));
}
export function setFriendship(person: Person, next: Friendship) {
  friendships.update((m) => ({ ...m, [person.id]: next }));
}
export function setRole(group: Group, next: GroupRole) {
  roles.update((m) => ({ ...m, [group.id]: next }));
}
export function setRsvp(event: CommunityEvent, next: Rsvp) {
  rsvps.update((m) => ({ ...m, [event.id]: next }));
}
