import { Injectable, signal } from '@angular/core';
import type { Person, Post } from '@awc-ui/showcase-kit/social';

/**
 * What the reader has done, held for the lifetime of the application.
 *
 * THE FIXTURE IS FROZEN AND STAYS FROZEN. Liking a post, saving it, following
 * someone — all of it is overrides keyed by id on top of the value the fixture
 * shipped. A reload is a reset, which is what keeps the showcase reproducible
 * and every screenshot comparable.
 *
 * `providedIn: 'root'`, for the reason the React port hoists a provider above
 * its router: the router destroys and rebuilds the screen component on every
 * navigation, so state held in a screen is forgotten the moment you open the
 * post you just liked. A root service outlives every route by construction.
 *
 * SIGNALS, NOT PLAIN OBJECTS. Angular's change detection is by reference, and a
 * mutated map would leave every `isLiked()` in a template reading a value the
 * view never re-evaluates. Each setter replaces the map.
 *
 * ABSENT MEANS "AS SHIPPED": the maps hold only what has actually changed, so
 * there is no second copy of the fixture to keep in step.
 */
@Injectable({ providedIn: 'root' })
export class EngagementService {
  private readonly likes = signal<Record<string, boolean>>({});
  private readonly saves = signal<Record<string, boolean>>({});
  private readonly follows = signal<Record<string, boolean>>({});

  /** The fixture's own answer for whether the viewer follows someone. */
  private static shippedFollowing(person: Person): boolean {
    return person.relationship === 'following' || person.relationship === 'mutual';
  }

  isLiked(post: Post): boolean {
    return this.likes()[post.id] ?? post.liked;
  }

  isSaved(post: Post): boolean {
    return this.saves()[post.id] ?? post.saved;
  }

  isFollowing(person: Person): boolean {
    return this.follows()[person.id] ?? EngagementService.shippedFollowing(person);
  }

  /* The togglers RETURN the new value as well as setting it, so a caller that
     also raises a snackbar can say which thing happened without reading a
     signal it has not been re-evaluated against yet. */
  toggleLike(post: Post): boolean {
    const next = !this.isLiked(post);
    this.likes.update((map) => ({ ...map, [post.id]: next }));
    return next;
  }

  toggleSave(post: Post): boolean {
    const next = !this.isSaved(post);
    this.saves.update((map) => ({ ...map, [post.id]: next }));
    return next;
  }

  setFollowing(person: Person, next: boolean): void {
    this.follows.update((map) => ({ ...map, [person.id]: next }));
  }

  savedIds(all: Post[]): Set<string> {
    const map = this.saves();
    return new Set(all.filter((post) => map[post.id] ?? post.saved).map((post) => post.id));
  }
}
