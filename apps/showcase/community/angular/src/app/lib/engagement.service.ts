import { Injectable, signal } from '@angular/core';
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

/**
 * What the reader has done, held for the lifetime of the application.
 *
 * THE FIXTURE IS FROZEN AND STAYS FROZEN. Reacting to a post, answering a
 * friend request, joining a group, RSVPing to an event — all of it is overrides
 * keyed by id on top of the value the fixture shipped. A reload is a reset,
 * which is what keeps the showcase reproducible and every screenshot
 * comparable.
 *
 * `providedIn: 'root'`, for the reason the React port hoists a provider above
 * its router: the router destroys and rebuilds the screen component on every
 * navigation, so state held in a screen is forgotten the moment you open the
 * post you just reacted to — which is the first interaction anybody tries.
 *
 * FIVE SIGNALS AND NOT ONE, because the five things are keyed differently and
 * mean different things: a reaction is per post AND per comment, a friendship
 * is per person, a role is per group, an RSVP is per event. One map of
 * `unknown` would need a cast at every read.
 */
@Injectable({ providedIn: 'root' })
export class EngagementService {
  private readonly reactions = signal<Record<string, ReactionKind | null>>({});
  private readonly commentReactions = signal<Record<string, ReactionKind | null>>({});
  private readonly friendships = signal<Record<string, Friendship>>({});
  private readonly roles = signal<Record<string, GroupRole>>({});
  private readonly rsvps = signal<Record<string, Rsvp>>({});

  /*
   * `in` AND NOT `??`, for the two reaction maps.
   *
   * `null` is a legitimate override here — it is what "I took my reaction back"
   * means — and `?? post.viewerReaction` would treat it as absent and fall
   * straight back to the fixture's value, so un-reacting would silently do
   * nothing. The other three have no null member and can use `??`.
   */
  reactionFor(post: Post): ReactionKind | null {
    const map = this.reactions();
    return post.id in map ? map[post.id] : post.viewerReaction;
  }
  setReaction(post: Post, next: ReactionKind | null): void {
    this.reactions.update((m) => ({ ...m, [post.id]: next }));
  }

  commentReactionFor(comment: Comment): ReactionKind | null {
    const map = this.commentReactions();
    return comment.id in map ? map[comment.id] : comment.viewerReaction;
  }
  setCommentReaction(comment: Comment, next: ReactionKind | null): void {
    this.commentReactions.update((m) => ({ ...m, [comment.id]: next }));
  }

  friendshipFor(person: Person): Friendship {
    return this.friendships()[person.id] ?? person.friendship;
  }
  setFriendship(person: Person, next: Friendship): void {
    this.friendships.update((m) => ({ ...m, [person.id]: next }));
  }

  roleFor(group: Group): GroupRole {
    return this.roles()[group.id] ?? group.role;
  }
  setRole(group: Group, next: GroupRole): void {
    this.roles.update((m) => ({ ...m, [group.id]: next }));
  }

  rsvpFor(event: CommunityEvent): Rsvp {
    return this.rsvps()[event.id] ?? event.rsvp;
  }
  setRsvp(event: CommunityEvent, next: Rsvp): void {
    this.rsvps.update((m) => ({ ...m, [event.id]: next }));
  }
}
