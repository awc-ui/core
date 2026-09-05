/**
 * "Has this binder already run on this element?"
 *
 * EVERY BINDER NEEDS ITS OWN ANSWER, and one shared `data-bound` attribute
 * cannot give it. That is not a hypothetical: the aggregate "View all N
 * comments" button carries `comment__act` for its styling, the comment LIKE
 * binder matched `.comment__act`, and because engagement runs before thread the
 * like binder claimed the flag first — so the open-thread binder saw
 * `[data-bound]`, skipped the button, and pressing "View all 12 comments" did
 * nothing at all. No error, no warning; the flag said bound and it was, just by
 * somebody else.
 *
 * A per-binder key makes that impossible to write. Two binders may legitimately
 * want the same element — that is the point of composing behaviour out of small
 * sweeps — and they must not be able to lock each other out.
 *
 * THE SWEEP RUNS AGAIN whenever markup is cloned in (a thread, the rest of the
 * feed, the composer), so every binder still has to be idempotent. This is what
 * makes it so, and `key` is what makes it honest.
 */
export function claim(element, key) {
  const attribute = `data-bound-${key}`;
  if (element.hasAttribute(attribute)) return false;
  element.setAttribute(attribute, '');
  return true;
}

/** The same, for a whole sweep: every element in `root` matching `selector`. */
export function claimAll(root, selector, key) {
  return [...root.querySelectorAll(selector)].filter((element) => claim(element, key));
}
