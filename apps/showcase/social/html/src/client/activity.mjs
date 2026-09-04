/**
 * Activity's one control: mark everything read.
 *
 * IT CLEARS THE UNREAD MARKS AND THE TWO BADGES, and then removes itself — a
 * button whose whole effect has already happened is a control that does nothing
 * when pressed again, and the four SPA builds drop it from the render for the
 * same reason. The count beside the heading goes with it.
 *
 * IT RAISES NOTHING. This is the only one of the five interactive screens with
 * no snackbar: the marks clearing, the badges going and the button leaving are
 * the confirmation, and a bar restating it would be a second copy of an answer
 * already on the screen.
 */

export function enhanceActivity(root = document) {
  const button = root.querySelector('.activity-mark-all:not([data-bound])');
  if (!button) return;
  button.setAttribute('data-bound', '');

  button.addEventListener('mdClick', () => {
    for (const row of root.querySelectorAll('md-list-item[data-unread]')) {
      row.removeAttribute('data-unread');
    }
    /* The badge sits on the Activity destination in both navigation surfaces,
       and exactly one of the two is displayed at any width — clearing both is
       cheaper than asking which. */
    for (const tab of root.querySelectorAll('[badge-value]')) tab.removeAttribute('badge-value');
    root.querySelector('.screen-head__aside')?.remove();
    button.closest('.screen-toolbar')?.remove();
  });
}
