/**
 * What the reader has done, held above the router.
 *
 * THE FIXTURE IS FROZEN AND STAYS FROZEN. Liking a post, saving it, following
 * someone — all of it is overrides keyed by id on top of the value the fixture
 * shipped. A reload is a reset, which is what keeps the showcase reproducible
 * and every screenshot comparable.
 *
 * MODULE SCOPE, NOT `provide`/`inject`. The React port hoists this into a
 * provider above the router for one reason: `App` swaps the screen component on
 * every navigation, so anything held inside a screen is forgotten the moment
 * you open the post you just liked. Vue has the same problem and a simpler
 * answer — a module-level `reactive` outlives every component by construction,
 * and there is exactly one viewer per page load, so there is nothing an
 * injection boundary would isolate.
 *
 * ABSENT MEANS "AS SHIPPED": the maps hold only what has actually changed, so
 * there is no second copy of the fixture to keep in step.
 */
import { reactive } from 'vue';
import type { Person, Post } from '@awc-ui/showcase-kit/social';

const likes = reactive<Record<string, boolean>>({});
const saves = reactive<Record<string, boolean>>({});
const follows = reactive<Record<string, boolean>>({});

/** The fixture's own answer for whether the viewer follows someone. */
function shippedFollowing(person: Person): boolean {
  return person.relationship === 'following' || person.relationship === 'mutual';
}

export function useEngagement() {
  const isLiked = (post: Post) => likes[post.id] ?? post.liked;
  const isSaved = (post: Post) => saves[post.id] ?? post.saved;
  const isFollowing = (person: Person) => follows[person.id] ?? shippedFollowing(person);

  /* The togglers RETURN the new value as well as setting it, so a caller that
     also raises a snackbar can say which thing happened without re-reading
     state it has not been re-rendered with yet. */
  const toggleLike = (post: Post) => {
    const next = !isLiked(post);
    likes[post.id] = next;
    return next;
  };

  const toggleSave = (post: Post) => {
    const next = !isSaved(post);
    saves[post.id] = next;
    return next;
  };

  const setFollowing = (person: Person, next: boolean) => {
    follows[person.id] = next;
  };

  const savedIds = (all: Post[]) =>
    new Set(all.filter((post) => saves[post.id] ?? post.saved).map((post) => post.id));

  return { isLiked, isSaved, isFollowing, toggleLike, toggleSave, setFollowing, savedIds };
}
