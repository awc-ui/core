/**
 * The one snackbar on the page, and the only way anything raises it.
 *
 * THE SENTENCE IS NEVER BUILT HERE. Each control that can raise a message
 * carries its own already-translated text on a data attribute — `data-msg`,
 * `data-msg-on`, `data-msg-off` — written by the build in the page's own
 * language with any name already substituted. This function copies a string
 * across and opens the element; it has no dictionary, and giving it one would
 * mean shipping three of them to every reader.
 *
 * Re-raising the SAME message has to close and reopen, or the component sees
 * `open` set to a value it already has and the second press does nothing
 * visible — which reads as the button having failed.
 */
export function raise(message) {
  const bar = document.querySelector('.app-snackbar');
  if (!bar || !message) return;
  bar.removeAttribute('open');
  bar.setAttribute('message', message);
  /* One frame, so the attribute removal is observed before it is set again.
     Without it the two writes coalesce and the reopen never happens. */
  requestAnimationFrame(() => bar.setAttribute('open', ''));
}
