/**
 * What the reader has done, held above the router.
 *
 * THE FIXTURE IS FROZEN AND STAYS FROZEN. Reacting to a post, answering a
 * friend request, joining a group, RSVPing to an event — all of it is overrides
 * in this provider, keyed by id, on top of the value the fixture shipped. A
 * reload is a reset, which is what keeps the showcase reproducible and every
 * screenshot comparable.
 *
 * WHY IT LIVES ABOVE THE ROUTER. `App` returns a different component per route,
 * so React unmounts the whole subtree on every navigation — a reaction held in
 * `FeedScreen` would be forgotten the moment you opened the post you just
 * reacted to, which is precisely the interaction a reader tries first.
 *
 * ABSENT MEANS "AS SHIPPED". The maps hold only what has actually been changed,
 * so there is no second copy of the fixture to keep in step, and
 * `reactionSummary()` in the kit does the arithmetic of turning an override
 * plus a shipped count into the numbers on screen.
 *
 * FOUR MAPS AND NOT ONE, because the four things are keyed differently and mean
 * different things: a reaction is per post AND per comment, a friendship is per
 * person, a role is per group, an RSVP is per event. One map of `unknown` would
 * need a cast at every read.
 */

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type {
  CommunityEvent,
  Comment,
  Friendship,
  Group,
  GroupRole,
  Person,
  Post,
  ReactionKind,
  Rsvp,
} from '@awc-ui/showcase-kit/community';

interface EngagementState {
  /** The viewer's reaction to a post, after any override. */
  reactionFor(post: Post): ReactionKind | null;
  setReaction(post: Post, next: ReactionKind | null): void;
  /** And to a comment. Same store, different key space. */
  commentReactionFor(comment: Comment): ReactionKind | null;
  setCommentReaction(comment: Comment, next: ReactionKind | null): void;

  friendshipFor(person: Person): Friendship;
  setFriendship(person: Person, next: Friendship): void;

  roleFor(group: Group): GroupRole;
  setRole(group: Group, next: GroupRole): void;

  rsvpFor(event: CommunityEvent): Rsvp;
  setRsvp(event: CommunityEvent, next: Rsvp): void;
}

const EngagementContext = createContext<EngagementState>({
  reactionFor: (post) => post.viewerReaction,
  setReaction: () => {},
  commentReactionFor: (comment) => comment.viewerReaction,
  setCommentReaction: () => {},
  friendshipFor: (person) => person.friendship,
  setFriendship: () => {},
  roleFor: (group) => group.role,
  setRole: () => {},
  rsvpFor: (event) => event.rsvp,
  setRsvp: () => {},
});

export function EngagementProvider({ children }: { children: ReactNode }) {
  const [reactions, setReactions] = useState<Record<string, ReactionKind | null>>({});
  const [commentReactions, setCommentReactions] = useState<Record<string, ReactionKind | null>>({});
  const [friendships, setFriendships] = useState<Record<string, Friendship>>({});
  const [roles, setRoles] = useState<Record<string, GroupRole>>({});
  const [rsvps, setRsvps] = useState<Record<string, Rsvp>>({});

  /*
   * `?? post.viewerReaction` and NOT `|| post.viewerReaction`, throughout.
   *
   * `null` is a legitimate override here — it is what "I took my reaction back"
   * means — and `||` would treat it as absent and fall straight back to the
   * fixture's value, so un-reacting would silently do nothing. `in` is the
   * other correct spelling; `??` is shorter and reads the same way.
   */
  const reactionFor = useCallback(
    (post: Post) => (post.id in reactions ? reactions[post.id] : post.viewerReaction),
    [reactions],
  );
  const setReaction = useCallback((post: Post, next: ReactionKind | null) => {
    setReactions((prev) => ({ ...prev, [post.id]: next }));
  }, []);

  const commentReactionFor = useCallback(
    (comment: Comment) =>
      comment.id in commentReactions ? commentReactions[comment.id] : comment.viewerReaction,
    [commentReactions],
  );
  const setCommentReaction = useCallback((comment: Comment, next: ReactionKind | null) => {
    setCommentReactions((prev) => ({ ...prev, [comment.id]: next }));
  }, []);

  const friendshipFor = useCallback(
    (person: Person) => friendships[person.id] ?? person.friendship,
    [friendships],
  );
  const setFriendship = useCallback((person: Person, next: Friendship) => {
    setFriendships((prev) => ({ ...prev, [person.id]: next }));
  }, []);

  const roleFor = useCallback((group: Group) => roles[group.id] ?? group.role, [roles]);
  const setRole = useCallback((group: Group, next: GroupRole) => {
    setRoles((prev) => ({ ...prev, [group.id]: next }));
  }, []);

  const rsvpFor = useCallback((event: CommunityEvent) => rsvps[event.id] ?? event.rsvp, [rsvps]);
  const setRsvp = useCallback((event: CommunityEvent, next: Rsvp) => {
    setRsvps((prev) => ({ ...prev, [event.id]: next }));
  }, []);

  const value = useMemo<EngagementState>(
    () => ({
      reactionFor,
      setReaction,
      commentReactionFor,
      setCommentReaction,
      friendshipFor,
      setFriendship,
      roleFor,
      setRole,
      rsvpFor,
      setRsvp,
    }),
    [
      reactionFor,
      setReaction,
      commentReactionFor,
      setCommentReaction,
      friendshipFor,
      setFriendship,
      roleFor,
      setRole,
      rsvpFor,
      setRsvp,
    ],
  );

  return <EngagementContext.Provider value={value}>{children}</EngagementContext.Provider>;
}

export function useEngagement(): EngagementState {
  return useContext(EngagementContext);
}
