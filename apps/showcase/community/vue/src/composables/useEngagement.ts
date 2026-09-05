/**
 * What the reader has done, held above the router.
 *
 * THE FIXTURE IS FROZEN AND STAYS FROZEN. Reacting to a post, answering a
 * friend request, joining a group, RSVPing to an event — all of it is overrides
 * keyed by id on top of the value the fixture shipped. A reload is a reset,
 * which is what keeps the showcase reproducible and every screenshot
 * comparable.
 *
 * MODULE SCOPE, NOT `provide`/`inject`. The React port hoists this into a
 * provider above the router for one reason: `App` swaps the screen component on
 * every navigation, so anything held inside a screen is forgotten the moment
 * you open the post you just reacted to. Vue has the same problem and a simpler
 * answer — a module-level `reactive` outlives every component by construction,
 * and there is exactly one viewer per page load, so there is nothing an
 * injection boundary would isolate.
 *
 * ABSENT MEANS "AS SHIPPED": the maps hold only what has actually changed, so
 * there is no second copy of the fixture to keep in step, and
 * `reactionSummary()` in the kit does the arithmetic of turning an override
 * plus a shipped count into the numbers on screen.
 */
import { reactive } from 'vue';
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

/*
 * FOUR MAPS AND NOT ONE, because the four things are keyed differently and mean
 * different things: a reaction is per post AND per comment, a friendship is per
 * person, a role is per group, an RSVP is per event. One map of `unknown` would
 * need a cast at every read.
 */
const state = reactive({
  reactions: {} as Record<string, ReactionKind | null>,
  commentReactions: {} as Record<string, ReactionKind | null>,
  friendships: {} as Record<string, Friendship>,
  roles: {} as Record<string, GroupRole>,
  rsvps: {} as Record<string, Rsvp>,
});

export function useEngagement() {
  return {
    /*
     * `in` AND NOT `??`, for the two reaction maps.
     *
     * `null` is a legitimate override here — it is what "I took my reaction
     * back" means — and `?? post.viewerReaction` would treat it as absent and
     * fall straight back to the fixture's value, so un-reacting would silently
     * do nothing. The other three maps have no null member and can use `??`.
     */
    reactionFor: (post: Post): ReactionKind | null =>
      post.id in state.reactions ? state.reactions[post.id] : post.viewerReaction,
    setReaction(post: Post, next: ReactionKind | null) {
      state.reactions[post.id] = next;
    },

    commentReactionFor: (comment: Comment): ReactionKind | null =>
      comment.id in state.commentReactions
        ? state.commentReactions[comment.id]
        : comment.viewerReaction,
    setCommentReaction(comment: Comment, next: ReactionKind | null) {
      state.commentReactions[comment.id] = next;
    },

    friendshipFor: (person: Person): Friendship =>
      state.friendships[person.id] ?? person.friendship,
    setFriendship(person: Person, next: Friendship) {
      state.friendships[person.id] = next;
    },

    roleFor: (group: Group): GroupRole => state.roles[group.id] ?? group.role,
    setRole(group: Group, next: GroupRole) {
      state.roles[group.id] = next;
    },

    rsvpFor: (event: CommunityEvent): Rsvp => state.rsvps[event.id] ?? event.rsvp,
    setRsvp(event: CommunityEvent, next: Rsvp) {
      state.rsvps[event.id] = next;
    },
  };
}
